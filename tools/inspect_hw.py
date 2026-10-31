import struct

def float16_to_float32(h):
    s = (h >> 15) & 0x0001
    e = (h >> 10) & 0x001f
    f = h & 0x03ff
    if e == 0:
        return ((-1 if s else 1) * (2 ** -14) * (f / 1024))
    elif e == 0x1f:
        return float('nan') if f else ((-1 if s else 1) * float('inf'))
    return ((-1 if s else 1) * (2 ** (e - 15)) * (1 + f / 1024))

CHAR_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Characters.big"
with open(CHAR_BIG, "rb") as f:
    f.seek(0x161f3000)
    data = f.read(10944)

for i in range(15):
    h0, h1, h2, h3 = struct.unpack("<HHHH", data[i*8:(i+1)*8])
    x = float16_to_float32(h0)
    y = float16_to_float32(h1)
    z = float16_to_float32(h2)
    w = float16_to_float32(h3)
    print(f"Vertex {i:2d}: ({x:7.3f}, {y:7.3f}, {z:7.3f}) | h3=0x{h3:04x} ({h3}) float={w:7.3f}")
