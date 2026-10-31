import struct
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from test_bix_parser import parse_bix

game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
ui_idx = parse_bix(game_dir / "UI.bix")

print(f"Scanning UI.bix ({ui_idx.entry_count} entries)...")

magics = {}
with open(game_dir / "UI.big", "rb") as f:
    for i, e in enumerate(ui_idx.entries):
        f.seek(e.data_offset)
        head = f.read(32)
        if len(head) >= 4:
            m = head[:4]
            magics[m] = magics.get(m, 0) + 1

print("\nTop 15 Chunk Magics in UI.big:")
for m, count in sorted(magics.items(), key=lambda x: -x[1])[:15]:
    hex_str = m.hex(" ")
    ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in m)
    print(f"  Magic: [{hex_str}] ({ascii_str}) -> {count:5d} entries")
