import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
    f.seek(0x14aa3000)
    data = f.read(464)

print(f"Data length: {len(data)}")
for i in range(0, len(data) - 16, 4):
    f0, f1, f2, f3 = struct.unpack("<ffff", data[i:i+16])
    # Hong Kong world coordinates are typically -1500 to +1500 for X, Y, and -100 to +300 for Z
    is_hk_coord = any(-2000.0 < val < 2000.0 and abs(val) > 1.0 for val in (f0, f1, f2))
    if is_hk_coord and not any(abs(val) > 100000.0 or abs(val) < 1e-6 and val != 0.0 for val in (f0, f1, f2, f3)):
        print(f"[{i:3d} / 0x{i:03x}] floats: ({f0:10.3f}, {f1:10.3f}, {f2:10.3f}, {f3:10.3f})")
