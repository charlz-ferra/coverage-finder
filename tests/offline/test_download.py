"""Check the download a reader gets from the README, not a freshly built stand-in."""
import re
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DOWNLOAD = ROOT / 'downloads' / 'Coverage-Finder.zip'


class ReaderDownload(unittest.TestCase):
    def test_ready_to_extract(self):
        self.assertTrue(DOWNLOAD.is_file(), 'The README must offer a ready-built ZIP')
        with ZipFile(DOWNLOAD) as archive:
            self.assertIsNone(archive.testzip())
            names = set(archive.namelist())
            self.assertEqual(len(names), len(archive.infolist()))
            extras = {'Open-Coverage-Finder.cmd', 'scripts/open-library.py', 'START-HERE.txt', 'LICENSE', 'docs/artwork.md'}
            self.assertEqual({n for n in names if not n.startswith('dist/')}, extras)
            for name in ('dist/data/LICENSE-DATA.md', 'dist/data/demo/library.json', 'dist/fonts/fonts.css'):
                self.assertIn(name, names)
            index = archive.read('dist/index.html').decode()
            for ref in re.findall(r'(?:src|href)="(\./[^"]+)"', index):
                self.assertIn('dist/' + ref[2:], names)
            self.assertTrue(any(n.startswith('dist/assets/worker-') and n.endswith('.js') for n in names))
            for source, entry in [('docs/offline-start.txt', 'START-HERE.txt'),
                                  ('scripts/open-library.py', 'scripts/open-library.py'),
                                  ('Open-Coverage-Finder.cmd', 'Open-Coverage-Finder.cmd')]:
                self.assertEqual((ROOT / source).read_text(encoding='utf-8').splitlines(),
                                 archive.read(entry).decode('utf-8').splitlines())


if __name__ == '__main__':
    unittest.main()
