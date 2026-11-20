"""Serve the built offline application at the same local origin on every launch."""

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
from pathlib import Path
import socket
import sys
import urllib.error
import urllib.request
import webbrowser


class LocalServer(ThreadingHTTPServer):
    def server_bind(self):
        # Windows SO_REUSEADDR otherwise permits a second live server to bind the same port.
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.allow_reuse_address = False
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    folder = Path(__file__).resolve().parents[1] / "dist"
    index = folder / "index.html"
    if not index.is_file():
        sys.exit("Run pnpm install and pnpm build first.")
    host, port = "127.0.0.1", 8765
    address = f"http://{host}:{port}/"
    # On Windows these associations come from the registry and vary between installations.
    for extension, mime_type in {".js": "text/javascript", ".woff2": "font/woff2", ".webp": "image/webp"}.items():
        mimetypes.add_type(mime_type, extension)
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(folder))
    try:
        server = LocalServer((host, port), handler)
    except OSError as error:
        # Reuse a running copy. Moving to a random port would start an empty IndexedDB.
        try:
            with urllib.request.urlopen(address, timeout=2) as response:
                if response.read(index.stat().st_size + 1) == index.read_bytes():
                    if not args.no_browser:
                        webbrowser.open(address)
                    return
        except (OSError, urllib.error.URLError):
            pass
        sys.exit(f"Could not open {address}. Close the application using port {port}. ({error})")
    with server:
        print(f"Coverage Finder: {address}\nKeep this window open. Press Ctrl+C to stop.", flush=True)
        if not args.no_browser:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
