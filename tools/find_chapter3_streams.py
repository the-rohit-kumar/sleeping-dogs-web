import struct
from pathlib import Path
import subprocess
import os

AUDIO_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2")
SFX_PCK = AUDIO_DIR / "SFX.pck"
ENG_PCK = AUDIO_DIR / "English(US).pck"
VGM_CLI = (Path(__file__).parent / "vgmstream" / "vgmstream-cli.exe").resolve()
CACHE_DIR = (Path(__file__).parent / "audio_cache").resolve()
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_pck_streams(pck_path):
    with open(pck_path, "rb") as f:
        hdr = f.read(64)
        magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", hdr[:24])
        f.seek(0)
        data = f.read(hdr_size)
    stream_offset = 0x18 + lang_size + 4 + bank_size
    count = (stream_size - 4) // 24
    streams = []
    for i in range(count):
        off = stream_offset + 4 + i * 24
        if off + 24 <= len(data):
            lang, sz, flg, boff, pad, sid = struct.unpack("<IIIIII", data[off:off+24])
            streams.append({
                "index": i,
                "size": sz,
                "offset": boff,
                "stream_id": sid,
                "lang": lang
            })
    return streams

print("Reading SFX.pck streams...")
sfx_streams = get_pck_streams(SFX_PCK)
print(f"Total SFX streams: {len(sfx_streams)}")
sfx_by_off = {s["offset"]: s for s in sfx_streams}

print("Reading English(US).pck streams...")
eng_streams = get_pck_streams(ENG_PCK)
print(f"Total English streams: {len(eng_streams)}")

# Let's inspect streams in SFX for high-energy music / combat / alarm / crane / finale
# Sort by size or search in offsets
print("\n--- Largest SFX streams (> 100KB) ---")
large_sfx = sorted([s for s in sfx_streams if s["size"] > 50000], key=lambda x: x["size"], reverse=True)
for s in large_sfx[:25]:
    print(f"  SFX Offset: 0x{s['offset']:08x}, Size: {s['size']} bytes ({s['size']/1024:.1f} KB)")

print("\n--- Candidate English streams in range 0x19900000 - 0x1b000000 ---")
ch3_eng = [s for s in eng_streams if 0x19900000 <= s["offset"] <= 0x1affffff]
print(f"Found {len(ch3_eng)} candidate English speech streams in Chapter 3 range.")
for s in ch3_eng[:25]:
    print(f"  ENG Offset: 0x{s['offset']:08x}, Size: {s['size']} bytes ({s['size']/1024:.1f} KB)")
