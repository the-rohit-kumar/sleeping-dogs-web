"""
asset_server.py
Lightweight, read-only local HTTP streaming bridge for base game archives.
Serves Sleeping Dogs Definitive Edition files to the browser client with CORS and Range headers.
Implements HTTP 206 Partial Content for byte-range streaming directly from .big containers.
Zero modifications to game files. Read-only.
"""

import http.server
from http import HTTPStatus
import socketserver
import os
import sys
import urllib.parse
from pathlib import Path

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
PORT = 8080

class RangeFileWrapper:
    def __init__(self, fp, length):
        self.fp = fp
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b""
        if size < 0 or size > self.remaining:
            size = self.remaining
        data = self.fp.read(size)
        self.remaining -= len(data)
        return data

    def close(self):
        self.fp.close()

class ReadOnlyGameAssetHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(GAME_DIR), **kwargs)

    def end_headers(self):
        # Enable CORS for browser engine on port 5173
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        ctype = self.guess_type(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        try:
            fs = os.fstat(f.fileno())
            file_len = fs[6]

            range_header = self.headers.get('Range')
            if range_header and range_header.startswith('bytes='):
                range_str = range_header[6:].strip()
                ranges = range_str.split('-')
                start = int(ranges[0]) if ranges[0] else 0
                end = int(ranges[1]) if ranges[1] else file_len - 1
                if end >= file_len:
                    end = file_len - 1
                if start > end or start >= file_len:
                    self.send_error(HTTPStatus.RANGE_NOT_SATISFIABLE, "Requested Range Not Satisfiable")
                    f.close()
                    return None

                content_len = end - start + 1
                f.seek(start)
                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_len}")
                self.send_header("Content-Length", str(content_len))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                return RangeFileWrapper(f, content_len)

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(file_len))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        except Exception:
            f.close()
            raise

if __name__ == "__main__":
    if not GAME_DIR.exists():
        print(f"Error: Game directory not found at {GAME_DIR}")
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), ReadOnlyGameAssetHandler) as httpd:
        print(f"Base Game Read-Only Asset Bridge serving at http://127.0.0.1:{PORT}/")
        print(f"Game Directory: {GAME_DIR}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down asset bridge.")
