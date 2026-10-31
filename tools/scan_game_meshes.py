import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

def float16_to_float32(h):
    s = (h >> 15) & 0x0001
    e = (h >> 10) & 0x001f
    f = h & 0x03ff
    if e == 0:
        return ((-1 if s else 1) * (2 ** -14) * (f / 1024))
    elif e == 0x1f:
        return float('nan') if f else ((-1 if s else 1) * float('inf'))
    return ((-1 if s else 1) * (2 ** (e - 15)) * (1 + f / 1024))

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

def scan_game_meshes():
    entries = parse_bix(os.path.join(GAME_DIR, "Game.bix"))
    valid_meshes = []
    
    with open(os.path.join(GAME_DIR, "Game.big"), "rb") as f:
        for e in entries:
            span = e["span"]
            if span < 500 or span > 100000:
                continue
            f.seek(e["offset"])
            buf = f.read(span)
            
            # Unpack 8-byte half-float stride
            points = []
            for i in range(len(buf) // 8):
                hx, hy, hz = struct.unpack("<HHH", buf[i*8:i*8+6])
                x = float16_to_float32(hx)
                y = float16_to_float32(hy)
                z = float16_to_float32(hz)
                if abs(x) < 600.0 and abs(y) < 600.0 and abs(z) < 600.0:
                    points.append((x, y, z))
                    
            if len(points) >= 30:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                zs = [p[2] for p in points]
                dx = max(xs) - min(xs)
                dy = max(ys) - min(ys)
                dz = max(zs) - min(zs)
                # Valid physical mesh must span at least 1m in 2 dimensions
                if (dx > 1.0 and dy > 1.0) or (dx > 1.0 and dz > 1.0) or (dy > 1.0 and dz > 1.0):
                    valid_meshes.append({
                        "entry": e,
                        "vert_count": len(points),
                        "bounds": (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)),
                        "extents": (dx, dy, dz)
                    })
                    
    print(f"Total authentic world/prop meshes found in Game.big: {len(valid_meshes)}")
    for vm in valid_meshes[:30]:
        e = vm["entry"]
        bx = vm["bounds"]
        ex = vm["extents"]
        print(f"  Entry [{e['index']:4d}] UID=0x{e['uid']:08x} @ 0x{e['offset']:08x} span={e['span']:6d} verts={vm['vert_count']:4d} | Bounds: X[{bx[0]:6.1f}..{bx[1]:6.1f}] Y[{bx[2]:6.1f}..{bx[3]:6.1f}] Z[{bx[4]:6.1f}..{bx[5]:6.1f}] | Span: {ex[0]:5.1f}x{ex[1]:5.1f}x{ex[2]:5.1f}m")

if __name__ == "__main__":
    scan_game_meshes()
