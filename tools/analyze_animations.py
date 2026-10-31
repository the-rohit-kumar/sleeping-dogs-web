import struct
import os

ANIM_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.big"
ANIM_BIX = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.bix"

def parse_bix():
    with open(ANIM_BIX, "rb") as f:
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
            "span": span
        })
    return entries

def inspect_animations():
    entries = parse_bix()
    print(f"Total entries in Animation.bix: {len(entries)}")
    
    with open(ANIM_BIG, "rb") as f:
        for e in entries[:15]:
            f.seek(e["offset"])
            head = f.read(min(e["span"], 256))
            
            # Check chunk header or signatures
            c_uid, c_sz = struct.unpack("<II", head[:8])
            ascii_preview = "".join(chr(b) if 32 <= b <= 126 else "." for b in head[8:64])
            print(f"[{e['index']:3d}] UID=0x{e['uid']:08x} @ 0x{e['offset']:08x} span={e['span']:7d} (p1={e['p1']:6d}, p2={e['p2']:6d}) | ChunkUID=0x{c_uid:08x} sz={c_sz} | {ascii_preview}")

if __name__ == "__main__":
    inspect_animations()
