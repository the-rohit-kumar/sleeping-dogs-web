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
    },
    "ming_flee": {
        "pck": ENG_PCK,
        "offset": 0x04fe5f89,
        "size": 31228,
        "name": "Dirty Ming Night Market Panic and Flight"
    },
    "wei_pursuit": {
        "pck": ENG_PCK,
        "offset": 0x10c4870f,
        "size": 30059,
        "name": "Wei Shen Rooftop Chase Demands"
    },
    "ming_rooftop_threat": {
        "pck": ENG_PCK,
        "offset": 0x09fdad97,
        "size": 43553,
        "name": "Dirty Ming Rooftop Balcony Ambush Command"
    },
    "blade_slash": {
        "pck": SFX_PCK,
        "offset": 0x09e86397,
        "size": 11851,
        "name": "Triad Blade Slash Whoosh Impact"
    },
    "knife_stab": {
        "pck": SFX_PCK,
        "offset": 0x09e891e2,
        "size": 9634,
        "name": "Triad Knife Disarm and Counter Reversal"
    },
    "bambam_club_music": {
        "pck": SFX_PCK,
        "offset": 0x0a2d3663,
        "size": 1001822,
        "name": "Club Bam Bam Electronic Dance Floor Atmosphere"
    },
    "glass_shatter": {
        "pck": SFX_PCK,
        "offset": 0x0f626504,
        "size": 11485,
        "name": "Club Bam Bam VIP Glass and Bottle Shatter"
    },
    "winston_bambam_order": {
        "pck": ENG_PCK,
        "offset": 0x140002db,
        "size": 34447,
        "name": "Winston Chu Golden Koi Briefing for Club Bam Bam"
    },
    "benny_threat": {
        "pck": ENG_PCK,
        "offset": 0x1408ec37,
        "size": 42468,
        "name": "Benny VIP Lounge Confrontation and Panic"
    },
    "urinal_smash": {
        "pck": SFX_PCK,
        "offset": 0x09e7f465,
        "size": 28466,
        "name": "Bathroom Porcelain Urinal Environmental Slam"
    },
    "teng_popstar_lead": {
        "pck": ENG_PCK,
        "offset": 0x150247f9,
        "size": 45988,
        "name": "Inspector Jane Teng Popstar Drug Lead Briefing"
    },
    "wei_teng_response": {
        "pck": ENG_PCK,
        "offset": 0x1503c793,
        "size": 40661,
        "name": "Wei Shen Police Wiretap Acknowledgment"
    },
    "drug_dealer_threat": {
        "pck": ENG_PCK,
        "offset": 0x15078e80,
        "size": 32843,
        "name": "Popstar Drug Ring Supplier Hostile Confrontation"
    },
    "teng_bust_complete": {
        "pck": ENG_PCK,
        "offset": 0x1504e23c,
        "size": 26244,
        "name": "Inspector Jane Teng Tactical Unit Bust Confirmation"
    },
    "ui_hack_tick": {
        "pck": SFX_PCK,
        "offset": 0x47e51674,
        "size": 5609,
        "name": "Surveillance Camera Hacking Keypad Digit Input"
    },
    "ui_click_denied": {
        "pck": SFX_PCK,
        "offset": 0x6ec8b405,
        "size": 4698,
        "name": "Surveillance Camera Hacking Access Denied Buzzer"
    },
    "ui_chime_granted": {
        "pck": SFX_PCK,
        "offset": 0x385d1c81,
        "size": 4898,
        "name": "Surveillance Camera Hacking Access Granted Chime"
    },
    "radio_static_burst": {
        "pck": SFX_PCK,
        "offset": 0x63039db2,
        "size": 6284,
        "name": "HKPD Police Radio Frequency Squelch & Static"
    },
    "police_radio_call": {
        "pck": SFX_PCK,
        "offset": 0x7e225378,
        "size": 6552,
        "name": "HKPD Central Police Dispatch Chime"
    },
    "gun_pistol_fire": {
        "pck": SFX_PCK,
        "offset": 0x19325c91,
        "size": 4902,
        "name": "9mm Handgun Fire Sound"
    },
    "gun_bullet_ricochet": {
        "pck": SFX_PCK,
        "offset": 0x3c031219,
        "size": 5200,
        "name": "Bullet Impact Metal Ricochet"
    },
    "gun_reload_slide": {
        "pck": SFX_PCK,
        "offset": 0x7ae2a4ea,
        "size": 5488,
        "name": "Semi-Automatic Handgun Chamber Slide Rack"
    },
    "gun_impact_concrete": {
        "pck": SFX_PCK,
        "offset": 0x4dd4cd3f,
        "size": 5936,
        "name": "High-Velocity Bullet Impact on Concrete"
    },
    "gun_shotgun_blast": {
        "pck": SFX_PCK,
        "offset": 0x0efee76a,
        "size": 6589,
        "name": "Pump-Action Shotgun Blast"
    },
    "tire_blowout": {
        "pck": SFX_PCK,
        "offset": 0x55454af6,
        "size": 6595,
        "name": "Vehicular Tire Blowout and Rim Friction"
    },
    "wiretap_tuner_hum": {
        "pck": SFX_PCK,
        "offset": 0x385d1c81,
        "size": 4898,
        "name": "Wiretap Resonance Frequency Tuner Hum"
    },
    "warehouse_alarm": {
        "pck": SFX_PCK,
        "offset": 0x0985d257,
        "size": 57305,
        "name": "Dogeyes Docks Warehouse Siren & Alarm"
    },
    "smg_fire_burst": {
        "pck": SFX_PCK,
        "offset": 0x19325c91,
        "size": 4902,
        "name": "Automatic SMG Gunfire Burst"
    },
    "truck_engine_rev": {
        "pck": SFX_PCK,
        "offset": 0x0d528ab2,
        "size": 14194,
        "name": "Heavy Getaway Delivery Truck Engine Rev"
    },
    "chapter1_finale_fanfare": {
        "pck": SFX_PCK,
        "offset": 0x0984a0ab,
        "size": 78252,
        "name": "Chapter 1 Sun On Yee Initiation Grand Fanfare"
    },
    "pendrew_listening_in": {
        "pck": ENG_PCK,
        "offset": 0x18011a82,
        "size": 32277,
        "name": "Superintendent Pendrew Golden Koi Wiretap Orders"
    },
    "winston_office_secret": {
        "pck": ENG_PCK,
        "offset": 0x1802633c,
        "size": 32687,
        "name": "Winston Chu Private Office Intercepted Wiretap"
    },
    "raymond_chain_warning": {
        "pck": ENG_PCK,
        "offset": 0x1804a15c,
        "size": 44242,
        "name": "Inspector Raymond Mak Chain of Command Warning"
    },
    "wei_mak_defiance": {
        "pck": ENG_PCK,
        "offset": 0x18069424,
        "size": 39806,
        "name": "Wei Shen Undercover Resolve and Defiance"
    },
    "dogeyes_warehouse_taunt": {
        "pck": ENG_PCK,
        "offset": 0x18085874,
        "size": 34920,
        "name": "Dogeyes Warehouse Ambush Confrontation"
    },
    "uncle_po_tea_meeting": {
        "pck": ENG_PCK,
        "offset": 0x1808e0dc,
        "size": 46532,
        "name": "Sun On Yee Mountain Master Uncle Po Tea Ceremony"
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
        if self.path == '/health':
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"sleeping-dogs-asset-server"}')
            return

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

    def do_HEAD(self):
        if self.path == '/health':
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            return

        if self.path.startswith('/api/audio/'):
            track_key = self.path[len('/api/audio/'):].split('?')[0]
            wav_data = get_decoded_wav(track_key)
            if wav_data:
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(wav_data)))
                self.end_headers()
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, f"Audio track '{track_key}' not found")
                return

        return super().do_HEAD()

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
