import struct
from collections import Counter

ANIM_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.big"
ANIM_BIX = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.bix"

with open(ANIM_BIX, "rb") as f:
    data = f.read()

count = struct.unpack("<I", data[0x70:0x74])[0]
chunk_types = Counter()
examples = {}

with open(ANIM_BIG, "rb") as f:
    for i in range(count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack("<IIIIII", data[off:off+24])
        f.seek(boff)
        head = f.read(16)
        if len(head) >= 8:
            c_uid, c_sz = struct.unpack("<II", head[:8])
            chunk_types[c_uid] += 1
            if c_uid not in examples:
                examples[c_uid] = (uid, boff, span, p1, p2)

print(f"Animation.big Chunk Types:")
for c_uid, cnt in chunk_types.most_common(15):
    ex = examples[c_uid]
    print(f"  Chunk UID: 0x{c_uid:08x} count={cnt:4d} (example: UID 0x{ex[0]:08x} @ 0x{ex[1]:08x} span={ex[2]} p1={ex[3]} p2={ex[4]})")
