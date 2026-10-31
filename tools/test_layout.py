import struct
import os

with open(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Game.big", "rb") as f:
    f.seek(0x2ca39000 + 420)
    b = f.read(40)
    for i in range(len(b)):
        c = chr(b[i]) if 32 <= b[i] <= 126 else "."
        print(f"{420+i:3d} (0x{420+i:03x}): {b[i]:02x} ({c})")
