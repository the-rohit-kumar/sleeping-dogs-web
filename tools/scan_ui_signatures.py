import struct
from pathlib import Path

bix_path = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\UI.bix")
big_path = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\UI.big")

bix_data = bix_path.read_bytes()
count = struct.unpack_from("<I", bix_data, 0x70)[0]

with open(big_path, "rb") as big_file:
    for i in range(count):
        off = 0xC0 + i * 24
        uid, boff, csize, usize, flags, u6 = struct.unpack_from("<IIIIII", bix_data, off)
        
        big_file.seek(boff)
        head = big_file.read(16)
        
        # Check known signatures:
        # DDS = b'DDS ' (0x20534444)
        # PNG = b'\x89PNG'
        # GFx = b'GFX' or b'CFX'
        # SWF = b'FWS' or b'CWS'
        if head.startswith(b"DDS "):
            print(f"DDS Texture found at entry {i:04d}: UID=0x{uid:08x}, off={boff}, size={u6}")
        elif head.startswith(b"CFX") or head.startswith(b"GFX"):
            print(f"Scaleform GFx found at entry {i:04d}: UID=0x{uid:08x}, off={boff}, size={u6}")
        elif head.startswith(b"FWS") or head.startswith(b"CWS"):
            print(f"Flash SWF found at entry {i:04d}: UID=0x{uid:08x}, off={boff}, size={u6}")
        elif head.startswith(b"RIFF") or head.startswith(b"BKHD"):
            print(f"Audio found at entry {i:04d}: UID=0x{uid:08x}, off={boff}, size={u6}")
