import struct
import math
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
    f.seek(0x2ca39000)
    data = f.read(4096)

print(f"Scanning first 4096 bytes of Entry 235 for Unit Quaternions + World Positions...")

valid_instances = []
for i in range(0, len(data) - 32, 4):
    qx, qy, qz, qw = struct.unpack("<ffff", data[i:i+16])
    mag_sq = qx*qx + qy*qy + qz*qz + qw*qw
    if abs(mag_sq - 1.0) < 0.01:
        # Check if adjacent 16 bytes contain valid HK coordinates (-2000 to +2000)
        # Check both before (-16) and after (+16)
        for delta in [+16, -16, +20, -20, +24, -24]:
            pos_off = i + delta
            if 0 <= pos_off <= len(data) - 12:
                x, y, z = struct.unpack("<fff", data[pos_off:pos_off+12])
                if -2000 < x < 2000 and -2000 < y < 2000 and -100 < z < 500:
                    if abs(x) > 1.0 and abs(y) > 1.0:
                        valid_instances.append({
                            "quat_off": i,
                            "quat": (qx, qy, qz, qw),
                            "pos_off": pos_off,
                            "delta": delta,
                            "pos": (x, y, z)
                        })

print(f"Found {len(valid_instances)} quaternion+pos pairs:")
for inst in valid_instances[:15]:
    q = inst["quat"]
    p = inst["pos"]
    print(f"  Quat @ 0x{inst['quat_off']:04x}: ({q[0]:6.3f}, {q[1]:6.3f}, {q[2]:6.3f}, {q[3]:6.3f}) | Pos @ 0x{inst['pos_off']:04x} (delta={inst['delta']:+d}): ({p[0]:8.2f}, {p[1]:8.2f}, {p[2]:8.2f})")

