import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

def parse_bix(bix_path):
    with open(bix_path, "rb") as f:
        data = f.read()
    count = struct.unpack("<I", data[0x70:0x74])[0]
    entries = []
    for i in range(count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack("<IIIIII", data[off:off+24])
        entries.append({
            "index": i,
            "uid": uid,
            "offset": boff,
            "p1": p1,
            "p2": p2,
            "span": span,
            "single_part": (p1 == 0 and p2 == 0)
        })
    return entries

def inspect_single_part_entries():
    entries = parse_bix(os.path.join(GAME_DIR, "Game.bix"))
    single_parts = [e for e in entries if e["single_part"] and e["span"] > 0]
    print(f"Total single-part entries with span > 0 in Game.bix: {len(single_parts)}")
    
    with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
        for e in single_parts[:30]:
            f.seek(e["offset"])
            head = f.read(64)
            c_uid, c_sz = struct.unpack("<II", head[:8])
            # Check for strings or identifiers
            ascii_preview = "".join(chr(b) if 32 <= b <= 126 else "." for b in head[:48])
            print(f"[{e['index']:4d}] UID=0x{e['uid']:08x} off=0x{e['offset']:08x} span={e['span']:6d} | chunkUID=0x{c_uid:08x} sz={c_sz:6d} | {ascii_preview}")

if __name__ == "__main__":
    inspect_single_part_entries()
