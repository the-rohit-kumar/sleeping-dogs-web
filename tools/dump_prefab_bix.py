import struct
from pathlib import Path

p = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\PrefabData.bix")
data = p.read_bytes()

print("Offset | hex (16B)                                       | uint32 values")
print("-" * 80)
for off in range(0, len(data), 16):
    chunk = data[off:off+16]
    hex_str = chunk.hex(" ")
    u32_str = " ".join(f"{u:10d}" for (u,) in struct.iter_unpack("<I", chunk[:len(chunk)//4*4]))
    print(f"0x{off:04X} | {hex_str:47s} | {u32_str}")
