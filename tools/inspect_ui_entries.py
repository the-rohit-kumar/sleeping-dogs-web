import struct
from pathlib import Path

bix_path = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\UI.bix")
big_path = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\UI.big")

bix_data = bix_path.read_bytes()
count = struct.unpack_from("<I", bix_data, 0x70)[0]
print(f"UI.bix total entries: {count}")

with open(big_path, "rb") as big_file:
    for i in range(15):
        off = 0xC0 + i * 24
        u1, u2, u3, u4, u5, u6 = struct.unpack_from("<IIIIII", bix_data, off)
        # u1: UID / hash
        # u2: Offset in .big
        # u3: Compressed size
        # u4: Uncompressed size
        # u5: Flags / compression type
        # u6: Extra / total size
        
        # Read header of resource in UI.big at offset u2
        big_file.seek(u2)
        head = big_file.read(32)
        magic = head[:4].hex(' ') if len(head) >= 4 else "N/A"
        ascii_sample = "".join(chr(b) if 32 <= b < 127 else "." for b in head)
        print(f"Entry {i:04d}: UID=0x{u1:08x}, off=0x{u2:08x} ({u2:9d}), csize={u3:8d}, usize={u4:8d}, flags=0x{u5:x}, u6={u6:8d} | magic=[{magic}] {ascii_sample}")

