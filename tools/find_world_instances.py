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
            "span": span
        })
    return entries

def scan_world_instances():
    entries = parse_bix(os.path.join(GAME_DIR, "Game.bix"))
    instance_entries = []
    
    with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
        for e in entries:
            if e["span"] == 0:
                continue
            f.seek(e["offset"])
            head = f.read(min(e["span"], 256))
            if b"Instances" in head or b"MergeMo" in head or b"Scene" in head or b"Layer" in head:
                instance_entries.append((e, head))
                
    print(f"Found {len(instance_entries)} scene/instance entries in Game.big:")
    for e, head in instance_entries[:20]:
        ascii_head = "".join(chr(b) if 32 <= b <= 126 else "." for b in head[:64])
        print(f"  Entry [{e['index']:4d}] UID=0x{e['uid']:08x} @ 0x{e['offset']:08x} span={e['span']:6d} | {ascii_head}")

if __name__ == "__main__":
    scan_world_instances()
