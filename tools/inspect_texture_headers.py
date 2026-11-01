import struct
from pathlib import Path

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")

TESTS = [
    ("Vehicles", 0x020f3400, 131072, "Vehicle Body (512x512 BC1)"),
    ("Vehicles", 0x01ea9800, 65536, "Vehicle Detail (256x256 BC3)"),
    ("Characters", 0x16063400, 131088, "Character Clothing (512x512 BC1)"),
    ("Characters", 0x16249800, 65552, "Character Face/Skin (256x256 BC3)"),
    ("Game", 0x36341c00, 32784, "Asphalt Road (256x256 BC1)"),
    ("Game", 0x30136000, 32784, "Building Facade (256x256 BC1)"),
    ("Game", 0x0ef12800, 32784, "Neon Signage (256x256 BC1)")
]

for archive, off, span, label in TESTS:
    p = GAME_DIR / f"{archive}.big"
    with open(p, "rb") as f:
        f.seek(off)
        data = f.read(min(span, 64))
        magic = data[:4]
        print(f"[{archive}] {label} @ 0x{off:08x}:")
        print(f"  First 16 bytes: {data[:16].hex(' ')}")
        if len(data) >= 32:
            print(f"  Next 16 bytes:  {data[16:32].hex(' ')}")

