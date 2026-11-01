"""
asset_server.py
Lightweight, read-only local HTTP streaming bridge for base game archives.
Serves Sleeping Dogs Definitive Edition files to the browser client with CORS and Range headers.
Implements HTTP 206 Partial Content for byte-range streaming directly from .big containers.
Decodes and streams authentic base-game audio tracks from Wwise SFX.pck and English(US).pck.
Zero modifications to game files. Read-only.
"""

import http.server
from http import HTTPStatus
import socketserver
import os
import sys
import subprocess
import urllib.parse
from pathlib import Path

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
VGM_CLI = Path(__file__).parent / "vgmstream" / "vgmstream-cli.exe"
PORT = 8080

SFX_PCK = GAME_DIR / "data" / "Audio" / "SD2" / "SFX.pck"
ENG_PCK = GAME_DIR / "data" / "Audio" / "SD2" / "English(US).pck"

AUDIO_TRACKS = {
    "hk_ambience": {
        "pck": SFX_PCK,
        "offset": 0x9251ad9,
        "size": 21906,
        "name": "Hong Kong Urban Ambience"
    },
    "vehicle_engine": {
        "pck": SFX_PCK,
        "offset": 0x0d528ab2,
        "size": 14194,
        "name": "Vehicle Engine Sound"
    },
    "combat_strike": {
        "pck": SFX_PCK,
        "offset": 0x104d1f2f,
        "size": 14406,
        "name": "Martial Arts Combat Strike"
    },
    "counter_impact": {
        "pck": SFX_PCK,
        "offset": 0x0f01c9e7,
        "size": 12383,
        "name": "Martial Arts Counter Bone Crunch"
    },
    "vehicle_horn": {
        "pck": SFX_PCK,
        "offset": 0x0ba87b9b,
        "size": 13468,
        "name": "Vehicle Horn / Tire Screech"
    },
    "radio_boosey": {
        "pck": SFX_PCK,
        "offset": 0x0adb78f3,
        "size": 5402087,
        "name": "Boosey & Hawkes 98.4 FM"
    },
    "radio_kerrang": {
        "pck": SFX_PCK,
        "offset": 0x104d5775,
        "size": 4857121,
        "name": "Kerrang! Radio 105.2 FM"
    },
    "radio_softly": {
        "pck": SFX_PCK,
        "offset": 0x0a9d941e,
        "size": 4056277,
        "name": "Softly FM Hong Kong Lounge"
    },
    "hk_dialogue": {
        "pck": ENG_PCK,
        "offset": 0x00431f8c,
        "size": 16681,
        "name": "Hong Kong Pedestrian Dialogue"
    },
    "env_takedown": {
        "pck": SFX_PCK,
        "offset": 0x09e7f465,
        "size": 28466,
        "name": "Environmental Takedown Slam"
    },
    "police_siren": {
        "pck": SFX_PCK,
        "offset": 0x0985d257,
        "size": 57305,
        "name": "Hong Kong Police Dispatch Siren"
    },
    "mission_fanfare": {
        "pck": SFX_PCK,
        "offset": 0x0984a0ab,
        "size": 78252,
        "name": "Mission Accomplished Orchestral Sting"
    },
    "triad_brawl_shout": {
        "pck": SFX_PCK,
        "offset": 0x0ce55550,
        "size": 89872,
        "name": "Triad Brawl Shouts & Fight Atmosphere"
    },
    "raymond_interrogate": {
        "pck": ENG_PCK,
        "offset": 0x0504b727,
        "size": 32360,
        "name": "Inspector Raymond Mak Interrogation Dialogue"
    },
    "pendrew_briefing": {
        "pck": ENG_PCK,
        "offset": 0x0636bfa5,
        "size": 22169,
        "name": "Superintendent Thomas Pendrew Undercover Briefing"
    },
    "jackie_reunion": {
        "pck": ENG_PCK,
        "offset": 0x0c03073d,
        "size": 21834,
        "name": "Jackie Ma Holding Cell Reunion Dialogue"
    },
    "winston_shakedown": {
        "pck": ENG_PCK,
        "offset": 0x143cebc4,
        "size": 30788,
        "name": "Winston Chu Water Street Extortion Orders"
    },
    "vendor_argument": {
        "pck": ENG_PCK,
        "offset": 0x18fda27b,
        "size": 29679,
        "name": "Night Market Vendor Refusal & Argument"
    },
    "triad_threat": {
        "pck": ENG_PCK,
        "offset": 0x271235be,
        "size": 43786,
        "name": "Dogeyes 18K Thugs Ambush Threats"
    }
}

# In-memory WAV cache
AUDIO_CACHE = {}
CACHE_DIR = Path(__file__).parent / "audio_cache"

def get_decoded_wav(track_key):
    if track_key in AUDIO_CACHE:
        return AUDIO_CACHE[track_key]

    # Check disk cache first for zero-latency streaming
    disk_file = CACHE_DIR / f"{track_key}.wav"
    if disk_file.exists():
        with open(disk_file, "rb") as f:
            wav_bytes = f.read()
        AUDIO_CACHE[track_key] = wav_bytes
        return wav_bytes

    if track_key not in AUDIO_TRACKS:
        return None

    info = AUDIO_TRACKS[track_key]
    if not info["pck"].exists():
        return None

    with open(info["pck"], "rb") as f:
        f.seek(info["offset"])
        wem_data = f.read(info["size"])

    # Write temporary file for vgmstream-cli
    tmp_wem = Path(__file__).parent / f"_temp_{track_key}.wem"
    tmp_wav = Path(__file__).parent / f"_temp_{track_key}.wav"
    try:
        with open(tmp_wem, "wb") as f:
            f.write(wem_data)

        cmd = [str(VGM_CLI), "-o", str(tmp_wav), str(tmp_wem)]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and tmp_wav.exists():
            with open(tmp_wav, "rb") as f:
                wav_bytes = f.read()
            AUDIO_CACHE[track_key] = wav_bytes
            return wav_bytes
    finally:
        if tmp_wem.exists():
            try: os.remove(tmp_wem)
            except OSError: pass
        if tmp_wav.exists():
            try: os.remove(tmp_wav)
            except OSError: pass

    return None

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

    def do_GET(self):
        # Handle /api/audio/<track_id>
        if self.path.startswith('/api/audio/'):
            track_key = self.path[len('/api/audio/'):].split('?')[0]
            wav_data = get_decoded_wav(track_key)
            if wav_data:
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(wav_data)))
                self.end_headers()
                self.wfile.write(wav_data)
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, f"Audio track '{track_key}' not found")
                return

        return super().do_GET()

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

def run_server():
    if not GAME_DIR.exists():
        print(f"Error: Game directory not found at {GAME_DIR}")
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), ReadOnlyGameAssetHandler) as httpd:
        print(f"Sleeping Dogs Asset Streaming Bridge active on http://127.0.0.1:{PORT}")
        print(f"Game Directory: {GAME_DIR}")
        print(f"HTTP 206 Partial Content enabled for multi-gigabyte .big containers.")
        print(f"Authentic Audio Decoder active for Wwise SFX.pck and English(US).pck.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down asset streaming server.")

if __name__ == "__main__":
    run_server()
