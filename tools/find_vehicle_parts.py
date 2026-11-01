from pathlib import Path

game_dir = Path(r'C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition')
big_path = game_dir / 'Vehicles.big'

with open(big_path, 'rb') as f:
    f.seek(0x00000000)
    data = f.read(0x00010000) # first 64KB

# Find all vehicle body strings
strings = []
cur = []
for i, b in enumerate(data):
    if 32 <= b < 127:
        cur.append(chr(b))
    else:
        if len(cur) >= 6:
            s = ''.join(cur)
            strings.append((i - len(cur), s))
        cur = []

print(f"Found {len(strings)} strings in first 64KB of Vehicles.big:")
for off, s in strings:
    if any(k in s for k in ['Body', 'Door', 'Wheel', 'NAR', 'Chassis', 'Bumper', 'Glass', 'Mesh', 'ExtendedMesh', 'Convex']):
        print(f"  0x{off:06x}: {s}")

