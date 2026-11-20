"""Build the reader ZIP from a fresh Vite output; --check never rebuilds or writes."""
import argparse
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'downloads' / 'Coverage-Finder.zip'
EXTRAS = {'START-HERE.txt': 'docs/offline-start.txt', 'LICENSE': 'LICENSE',
          'docs/artwork.md': 'docs/artwork.md', 'Open-Coverage-Finder.cmd': 'Open-Coverage-Finder.cmd',
          'scripts/open-library.py': 'scripts/open-library.py'}
INPUTS = ['apps/web/src', 'apps/web/public', 'apps/web/index.html', 'apps/web/vite.config.ts',
          'apps/web/svelte.config.js', 'apps/web/data-attribution.ts', 'apps/web/package.json',
          'packages/core/src', 'packages/core/package.json', 'packages/lang-en/src', 'packages/lang-en/package.json',
          'data', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']


def tracked_inputs():
    paths = subprocess.check_output(['git', 'ls-files', '-z', '--', *INPUTS], cwd=ROOT)
    return [p.decode('utf-8') for p in paths.split(b'\0') if p]


def fingerprint(paths):
    # A Windows checkout and the Linux CI runner can use different text line endings.
    digest = hashlib.sha256()
    for rel in sorted(set(paths) | set(EXTRAS.values())):
        data = (ROOT / rel).read_bytes()
        if Path(rel).suffix.lower() not in {'.woff2', '.webp'}:
            data = data.replace(b'\r\n', b'\n')
        digest.update(rel.encode() + b'\0' + hashlib.sha256(data).digest())
    return b'Coverage Finder inputs (SHA-256): ' + digest.hexdigest().encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    paths = tracked_inputs()
    stamp = fingerprint(paths)
    if args.check:
        with ZipFile(OUTPUT) as archive:
            if archive.comment != stamp or archive.testzip() is not None:
                raise SystemExit('Reader ZIP is stale or damaged. Run python scripts/package-offline.py')
        print('Reader ZIP matches the source fingerprint; all entries passed CRC checks.')
        return

    pnpm = shutil.which('pnpm')
    if not pnpm:
        raise SystemExit('Packaging requires pnpm. Readers do not need it.')
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=OUTPUT.parent) as tmp:
        build = Path(tmp) / 'dist'
        subprocess.run([pnpm, '--filter', '@coverage/web', 'exec', 'vite', 'build', '--outDir', str(build)],
                       cwd=ROOT, check=True)
        files = {name: ROOT / src for name, src in EXTRAS.items()}
        public = 'apps/web/public/'
        allowed = {p[len(public):] for p in paths if p.startswith(public)} | {p for p in paths if p.startswith('data/')}
        for file in build.rglob('*'):
            if file.is_file():
                rel = file.relative_to(build).as_posix()
                if rel != 'index.html' and rel not in allowed and not re.fullmatch(r'assets/(index|worker)-[\w-]+\.(js|css)', rel):
                    raise SystemExit(f'Unexpected build output; review before distributing: {rel}')
                files['dist/' + rel] = file
        bundle = Path(tmp) / OUTPUT.name
        with ZipFile(bundle, 'w') as archive:
            for name, path in sorted(files.items()):
                info = ZipInfo(name)  # Stable metadata; do not copy workstation paths or timestamps.
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                data = path.read_bytes()
                if name.endswith('.cmd'):
                    data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
                archive.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
            archive.comment = stamp
        bundle.replace(OUTPUT)
    print(f'{OUTPUT.name}: {OUTPUT.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
