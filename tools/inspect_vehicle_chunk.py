from pathlib import Path
import struct

game_dir = Path(r'C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition')
bix_path = game_dir / 'Vehicles.bix'
buf = bix_path.read_bytes()
entry_count, = struct.unpack('<I', buf[0x70:0x74])

entries = []
for i in range(entry_count):
    off = 0xC0 + i * 24
    uid, boff, p1, p2, pad, span = struct.unpack('<IIIIII', buf[off:off+24])
    entries.append({'index': i, 'uid': uid, 'offset': boff, 'p1': p1, 'p2': p2, 'pad': pad, 'span': span})

entries.sort(key=lambda e: e['offset'])

for i in range(len(entries)):
    if entries[i]['offset'] == 0x01f0a400 or entries[i]['uid'] == 0x008c038c:
        print('Surrounding entries sorted by offset:')
        for j in range(max(0, i-5), min(len(entries), i+10)):
            e = entries[j]
            next_off = entries[j+1]['offset'] if j+1 < len(entries) else 'EOF'
            diff = next_off - e['offset'] if next_off != 'EOF' else 'N/A'
            print(f"Idx {e['index']:4d} | UID 0x{e['uid']:08x} | Off 0x{e['offset']:08x} | Span {e['span']:8d} | NextDiff {str(diff):8s} | p1={e['p1']:7d} | p2={e['p2']:7d}")
        break
