import struct

CHAR_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Characters.big"

with open(CHAR_BIG, "rb") as f:
    f.seek(0x161f3000)
    data = f.read(10944)

print(f"Characters.big Entry @ 0x161f3000 (length={len(data)}):")
for i in range(0, min(len(data), 192), 48):
    chunk = data[i:i+48]
    if len(chunk) == 48:
        # Test 48-byte skinned stride:
        # Px, Py, Pz (3 floats = 12b)
        # Weights (4 uint8 = 4b)
        # Indices (4 uint8 = 4b)
        # Nx, Ny, Nz (3 floats = 12b)
        # UV (2 floats = 8b)
        # Tangent or extra (8b)
        p = struct.unpack("<fff", chunk[:12])
        w = struct.unpack("<BBBB", chunk[12:16])
        bi = struct.unpack("<BBBB", chunk[16:20])
        print(f"Vertex {i//48:2d}: Pos=({p[0]:6.3f}, {p[1]:6.3f}, {p[2]:6.3f}) | Weights={w} | Bones={bi}")
