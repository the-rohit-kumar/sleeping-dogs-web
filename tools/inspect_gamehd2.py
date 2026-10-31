import struct
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from test_bix_parser import parse_bix

game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
idx = parse_bix(game_dir / "GameHD2.bix")

print(f"=== GameHD2.bix: {idx.entry_count} entries ===")
with open(game_dir / "GameHD2.big", "rb") as f:
    for i, e in enumerate(idx.entries):
        f.seek(e.data_offset)
        chunk = f.read(64)
        cuid, csize, tsize = struct.unpack_from("<III", chunk, 0)
        # Check if there are readable ASCII strings in chunk
        ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk[:48])
        print(f"[{i:02d}] UID=0x{e.resource_uid:08x} @ off=0x{e.data_offset:08x} | Part1={e.compressed_size:7d}, Part2={e.uncompressed_size:9d} | ChunkUID=0x{cuid:08x} | {ascii_str}")
