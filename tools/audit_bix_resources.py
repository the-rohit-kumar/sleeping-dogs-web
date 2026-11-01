from pathlib import Path
import struct

GAME_DIR = Path('C:/Program Files (x86)/Steam/steamapps/common/SleepingDogsDefinitiveEdition')

def load_bix(arch):
    path = GAME_DIR / f'{arch}.bix'
    with open(path, 'rb') as f:
        buf = f.read()
    entry_count, = struct.unpack('<I', buf[0x70:0x74])
    entries = []
    for i in range(entry_count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack('<IIIIII', buf[off:off+24])
        entries.append({'index': i, 'uid': uid, 'offset': boff, 'p1': p1, 'p2': p2, 'pad': pad, 'span': span})
    return entries

bix_data = {a: load_bix(a) for a in ['Vehicles', 'Characters', 'Game', 'UI']}

resources = [
    ('Sedan Mesh (Vehicles)', 'Vehicles', 0x008c038c, 0x01f0a400, 3840),
    ('Pedestrian Mesh (Characters)', 'Characters', 0x030e17e9, 0x161f3000, 10944),
    ('Hong Kong Sector (Game)', 'Game', 0x7b8f6706, 0x1b7ef400, 32768),
    ('Crate Texture (UI)', 'UI', 0x0854388e, 0x0356b800, 32768),
    ('Taxi Livery (Vehicles)', 'Vehicles', 0x0207f800, 0x0207f800, 131072),
    ('Triad Clothing (Characters)', 'Characters', 0x16595000, 0x16595000, 131072),
    ('Concrete Road (Game)', 'Game', 0x10360800, 0x10360800, 131072),
    ('Shop Neon (UI)', 'UI', 0x07dc4800, 0x07dc4800, 131072),
    ('Sector North (Game)', 'Game', 0x7b8f6707, 0x1b800000, 32768),
    ('Sector South (Game)', 'Game', 0x7b8f6708, 0x1b810000, 32768),
    ('Sector East (Game)', 'Game', 0x7b8f6709, 0x1b820000, 32768),
    ('Sector West (Game)', 'Game', 0x7b8f670a, 0x1b830000, 32768),
    ('Traffic Minivan (Vehicles)', 'Vehicles', 0x008c0400, 0x01f20000, 4096),
    ('Traffic SUV (Vehicles)', 'Vehicles', 0x008c0500, 0x01f30000, 4096),
    ('Traffic Bus (Vehicles)', 'Vehicles', 0x008c0600, 0x01f40000, 4096),
    ('Crowd Triad (Characters)', 'Characters', 0x00882829, 0x08770000, 25072),
    ('Crowd Vendor (Characters)', 'Characters', 0x01bf39f3, 0x15d0e000, 10672),
    ('Crowd Citizen (Characters)', 'Characters', 0x00062a74, 0x028d0000, 12288)
]

print(f"{'Resource':<30} | {'Arch':<10} | {'UID Req':<10} | {'Off Req':<10} | {'BIX Idx':<8} | {'BIX UID':<10} | {'BIX Off':<10} | {'BIX Span':<9} | Status")
print("-" * 125)

for name, arch, req_uid, req_off, req_span in resources:
    entries = bix_data[arch]
    m_uid = [e for e in entries if e['uid'] == req_uid]
    m_off = [e for e in entries if e['offset'] == req_off]
    
    if m_uid:
        e = m_uid[0]
        status = "EXACT UID MATCH" if e['offset'] == req_off else f"OFFSET MISMATCH (BIX has 0x{e['offset']:08x})"
        print(f"{name:<30} | {arch:<10} | 0x{req_uid:08x} | 0x{req_off:08x} | {e['index']:<8} | 0x{e['uid']:08x} | 0x{e['offset']:08x} | {e['span']:<9} | {status}")
    elif m_off:
        e = m_off[0]
        print(f"{name:<30} | {arch:<10} | 0x{req_uid:08x} | 0x{req_off:08x} | {e['index']:<8} | 0x{e['uid']:08x} | 0x{e['offset']:08x} | {e['span']:<9} | OFFSET MATCH (UID differed)")
    else:
        print(f"{name:<30} | {arch:<10} | 0x{req_uid:08x} | 0x{req_off:08x} | {'None':<8} | {'None':<10} | {'None':<10} | {'None':<9} | NOT IN BIX (Arbitrary range)")
