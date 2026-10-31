import struct
from pathlib import Path

game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
bix_files = list(game_dir.glob("*.bix"))

for bix in sorted(bix_files, key=lambda f: f.stat().st_size):
    data = bix.read_bytes()
    magic, s1, s2, fl = struct.unpack_from("<IIII", data, 0)
    print(f"{bix.name:20s}: total={len(data):8d}, s1={s1:8d}, s2={s2:8d}, fl=0x{fl:08x}")
    # Inspect first 64 bytes of payload (starting at offset 16)
    print("  First 32 bytes of payload:", data[16:48].hex(" "))
