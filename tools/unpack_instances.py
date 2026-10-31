import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
    f.seek(0x14aa3000)
    data = f.read(464)

for i in range(0, len(data), 16):
    chunk = data[i:i+16]
    hex_str = chunk.hex(" ")
    ascii_str = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
    print(f"0x{i:03x}: {hex_str:48s} | {ascii_str}")
