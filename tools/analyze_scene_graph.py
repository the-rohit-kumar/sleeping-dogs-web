import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"

def inspect_entry_start(big_name, offsets):
    big_path = os.path.join(GAME_DIR, f"{big_name}.big")
    with open(big_path, "rb") as f:
        for off in offsets:
            f.seek(off)
            head = f.read(128)
            c_uid, c_sz = struct.unpack("<II", head[:8])
            ascii_preview = "".join(chr(b) if 32 <= b <= 126 else "." for b in head[8:64])
            print(f"Offset 0x{off:08x}: ChunkUID=0x{c_uid:08x} sz={c_sz} ({c_sz:x}h) | {ascii_preview}")

if __name__ == "__main__":
    inspect_entry_start("Game", [
        0x00002c00,
        0x00031400,
        0x0008b000,
        0x000bbc00,
        0x000fd800,
    ])
