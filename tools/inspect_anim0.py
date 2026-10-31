import struct

ANIM_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.big"

with open(ANIM_BIG, "rb") as f:
    f.seek(0x00ca3000)
    data = f.read(5600)

print(f"Entry 0 length: {len(data)}")
for i in range(0, min(len(data), 256), 16):
    chunk = data[i:i+16]
    hex_str = chunk.hex(" ")
    ascii_str = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
    print(f"0x{i:03x}: {hex_str:48s} | {ascii_str}")

