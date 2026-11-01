import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

def parse_bix(bix_path):
    with open(bix_path, "rb") as f:
        data = f.read()
    count = struct.unpack("<I", data[0x70:0x74])[0]
    entries = []
    for i in range(count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack("<IIIIII", data[off:off+24])
        entries.append({
            "index": i,
            "uid": uid,
            "offset": boff,
            "p1": p1,
            "p2": p2,
            "span": span
        })
    return entries

def float16_to_float32(h):
    s = (h >> 15) & 0x0001
    e = (h >> 10) & 0x001f
    f = h & 0x03ff
    if e == 0:
        return ((-1 if s else 1) * (2 ** -14) * (f / 1024))
    elif e == 0x1f:
        return float('nan') if f else ((-1 if s else 1) * float('inf'))
    return ((-1 if s else 1) * (2 ** (e - 15)) * (1 + f / 1024))

def scan_props():
    entries = parse_bix(os.path.join(GAME_DIR, "Game.bix"))
    small_props = [] # 1m to 8m size: street lamps, railings, AC units, stalls
    buildings = []   # 10m to 50m size: multi-story building facades

    with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
        for e in entries:
            span = e["span"]
            if span < 800 or span > 40000:
                continue
            f.seek(e["offset"])
            buf = f.read(span)
            
            points = []
            for i in range(len(buf) // 8):
                hx, hy, hz = struct.unpack("<HHH", buf[i*8:i*8+6])
                x = float16_to_float32(hx)
                y = float16_to_float32(hy)
                z = float16_to_float32(hz)
                if abs(x) < 300.0 and abs(y) < 300.0 and abs(z) < 300.0:
                    points.append((x, y, z))
                    
            if len(points) >= 40:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                zs = [p[2] for p in points]
                dx = max(xs) - min(xs)
                dy = max(ys) - min(ys)
                dz = max(zs) - min(zs)
                max_dim = max(dx, dy, dz)
                min_dim = min(dx, dy, dz)

                # Props: Human/street scale (1m - 9m)
                if 1.0 < max_dim < 9.0 and min_dim > 0.2:
                    small_props.append((e, len(points), (dx, dy, dz), (min(xs), min(ys), min(zs))))
                elif 10.0 < max_dim < 45.0 and dy > 8.0:
                    buildings.append((e, len(points), (dx, dy, dz), (min(xs), min(ys), min(zs))))

    print(f"Discovered {len(small_props)} street prop candidates and {len(buildings)} building facade candidates!")
    print("\n--- Top Street Props (Lamps, Stalls, Railings, AC Units) ---")
    for e, vc, dims, origin in small_props[:15]:
        print(f"  Prop Entry [{e['index']:4d}] UID=0x{e['uid']:08x} @ 0x{e['offset']:08x} span={e['span']:5d} verts={vc:4d} | Dims: {dims[0]:4.1f}x{dims[1]:4.1f}x{dims[2]:4.1f}m")

    print("\n--- Top Building Facades ---")
    for e, vc, dims, origin in buildings[:15]:
        print(f"  Building Entry [{e['index']:4d}] UID=0x{e['uid']:08x} @ 0x{e['offset']:08x} span={e['span']:5d} verts={vc:4d} | Dims: {dims[0]:4.1f}x{dims[1]:4.1f}x{dims[2]:4.1f}m")

if __name__ == "__main__":
    scan_props()
