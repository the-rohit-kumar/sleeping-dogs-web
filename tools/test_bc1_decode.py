import struct
from pathlib import Path

GAME_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")

def unpack_rgb565(c):
    r = (c >> 11) & 0x1f
    g = (c >> 5) & 0x3f
    b = c & 0x1f
    return (round((r * 255) / 31), round((g * 255) / 63), round((b * 255) / 31))

def decode_bc1(data, width, height):
    rgba = bytearray(width * height * 4)
    bx_count = max(1, (width + 3) // 4)
    by_count = max(1, (height + 3) // 4)
    
    offset = 0
    for by in range(by_count):
        for bx in range(bx_count):
            if offset + 8 > len(data):
                break
            c0, c1 = struct.unpack("<HH", data[offset:offset+4])
            lookup = struct.unpack("<I", data[offset+4:offset+8])[0]
            offset += 8
            
            r0, g0, b0 = unpack_rgb565(c0)
            r1, g1, b1 = unpack_rgb565(c1)
            
            colors = [
                (r0, g0, b0, 255),
                (r1, g1, b1, 255),
                (0, 0, 0, 255),
                (0, 0, 0, 255)
            ]
            if c0 > c1:
                colors[2] = (round((2*r0 + r1)/3), round((2*g0 + g1)/3), round((2*b0 + b1)/3), 255)
                colors[3] = (round((r0 + 2*r1)/3), round((g0 + 2*g1)/3), round((b0 + 2*b1)/3), 255)
            else:
                colors[2] = (round((r0 + r1)/2), round((g0 + g1)/2), round((b0 + b1)/2), 255)
                colors[3] = (0, 0, 0, 0)
                
            for py in range(4):
                for px in range(4):
                    code = (lookup >> (2 * (py * 4 + px))) & 0x03
                    col = colors[code]
                    x = bx * 4 + px
                    y = by * 4 + py
                    if x < width and y < height:
                        idx = (y * width + x) * 4
                        rgba[idx:idx+4] = col
                        
    return rgba

TESTS = [
    ("Vehicles", 0x020f3400, 131072, 512, 512, "Vehicle Body"),
    ("Characters", 0x16063400 + 16, 131072, 512, 512, "Character Clothing"),
    ("Game", 0x36341c00 + 16, 32768, 256, 256, "Asphalt Road"),
    ("Game", 0x30136000 + 16, 32768, 256, 256, "Building Facade"),
    ("Game", 0x0ef12800 + 16, 32768, 256, 256, "Neon Signage")
]

for archive, off, span, w, h, label in TESTS:
    p = GAME_DIR / f"{archive}.big"
    with open(p, "rb") as f:
        f.seek(off)
        raw = f.read(span)
    rgba = decode_bc1(raw, w, h)
    non_zero = sum(1 for b in rgba[::4] if b > 0)
    avg_r = sum(rgba[0::4]) / (w * h)
    avg_g = sum(rgba[1::4]) / (w * h)
    avg_b = sum(rgba[2::4]) / (w * h)
    print(f"[{archive}] {label} ({w}x{h}): {len(rgba)} bytes RGBA | Non-zero pixels={non_zero}/{w*h} ({(non_zero/(w*h))*100:.1f}%) | Avg RGB=({avg_r:.1f}, {avg_g:.1f}, {avg_b:.1f})")

