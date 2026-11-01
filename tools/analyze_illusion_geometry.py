# analyze_illusion_geometry.py
from pathlib import Path
import struct

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
VEHICLES_BIG = GAME_DIR / "Vehicles.big"
VEHICLES_BIX = GAME_DIR / "Vehicles.bix"

def inspect():
    bix_bytes = VEHICLES_BIX.read_bytes()
    entry_count = struct.unpack("<I", bix_bytes[0x70:0x74])[0]
    print(f"Vehicles.bix entries: {entry_count}")

    target = 0x01f0a400
    entries = []
    for i in range(entry_count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack("<IIIIII", bix_bytes[off:off+24])
        if abs(boff - target) < 65536:
            entries.append((i, uid, boff, p1, p2, pad, span))

    print(f"Entries near {hex(target)}:")
    for e in entries:
        print(f"  Entry {e[0]}: UID={hex(e[1])}, Offset={hex(e[2])}, p1={e[3]}, p2={e[4]}, pad={e[5]}, span={e[6]}")

    # Inspect the exact payload at 0x01f0a400 in Vehicles.big
    with open(VEHICLES_BIG, "rb") as f:
        f.seek(target)
        payload = f.read(3840)

    print(f"\nPayload at {hex(target)}: {len(payload)} bytes")
    # Check first 64 bytes
    print("Header bytes (hex):", payload[:64].hex())
    # Look for possible index buffer chunks or model descriptor chunks
    # Illusion engine chunk headers usually start with 4-byte chunk ID or length
    for chunk_offset in range(0, min(len(payload), 256), 4):
        val = struct.unpack("<I", payload[chunk_offset:chunk_offset+4])[0]
        # check if it looks like an offset, vertex count, index count, or magic
        print(f"  +0x{chunk_offset:02x}: 0x{val:08x} ({val})")

if __name__ == "__main__":
    inspect()
