import struct
import os
from pathlib import Path

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")

BIX_RECORD_START = 0xC0
BIX_RECORD_STRIDE = 24

def parse_bix(archive_name):
    bix_path = GAME_DIR / f"{archive_name}.bix"
    if not bix_path.exists():
        print(f"{bix_path} not found")
        return []

    entries = []
    with open(bix_path, "rb") as f:
        data = f.read()
        entry_count = struct.unpack("<I", data[0x70:0x74])[0]
        for i in range(entry_count):
            off = BIX_RECORD_START + i * BIX_RECORD_STRIDE
            uid, boff, p1, p2, pad, span = struct.unpack("<IIIIII", data[off:off+24])
            entries.append((uid, boff, span, p1, p2))
    print(f"{archive_name}.bix: {len(entries)} entries")
    return entries

def scan_textures(archive_name, max_scan=1500):
    entries = parse_bix(archive_name)
    big_path = GAME_DIR / f"{archive_name}.big"
    if not big_path.exists():
        return

    found = []
    with open(big_path, "rb") as f:
        for idx, (uid, off, span, p1, p2) in enumerate(entries[:max_scan]):
            if span < 64:
                continue
            f.seek(off)
            head = f.read(min(span, 256))
            
            # Check for DDS
            if head.startswith(b"DDS "):
                h, w = struct.unpack("<II", head[12:20])
                fourcc = head[84:88].decode('latin1', 'replace')
                found.append((idx, uid, off, span, w, h, f"DDS_{fourcc}"))
                continue

            # Look for Illusion rTexture chunk signatures
            # Typically 0xb655b4a0 or has width & height as uint16 powers of two
            # Also check if span matches power of 2 BC1/BC3 sizes:
            # 128x128 BC1 = 8192 (+ header)
            # 128x128 BC3 = 16384 (+ header)
            # 256x256 BC1 = 32768
            # 256x256 BC3 = 65536
            # 512x512 BC1 = 131072
            # 512x512 BC3 = 262144
            for check_dim in [512, 256, 128]:
                bc1_size = (check_dim * check_dim) // 2
                bc3_size = check_dim * check_dim
                if abs(span - bc1_size) < 128:
                    found.append((idx, uid, off, span, check_dim, check_dim, "Candidate_BC1"))
                    break
                elif abs(span - bc3_size) < 128:
                    found.append((idx, uid, off, span, check_dim, check_dim, "Candidate_BC3"))
                    break

    print(f"{archive_name}.big: Found {len(found)} candidate textures:")
    for t in found[:20]:
        print(f"  #{t[0]:4d} | UID=0x{t[1]:08x} | Off=0x{t[2]:08x} | Span={t[3]:7d} | {t[4]}x{t[5]} {t[6]}")

if __name__ == "__main__":
    scan_textures("UI", 500)
    scan_textures("Vehicles", 2000)
    scan_textures("Characters", 2000)
    scan_textures("Game", 2000)
