import struct
from pathlib import Path

def analyze_bix(path_str):
    p = Path(path_str)
    data = p.read_bytes()
    magic, s1, s2, fl = struct.unpack_from("<IIII", data, 0)
    print(f"\n=================== {p.name} (len={len(data)}) ===================")
    print(f"Header: magic=0x{magic:08x}, s1={s1}, s2={s2}, flags=0x{fl:08x}")
    
    # Check if there is an inner header
    # Let's see what is at offset 16:
    for i in range(16, min(len(data), 128), 8):
        v1, v2 = struct.unpack_from("<II", data, i)
        q = struct.unpack_from("<Q", data, i)[0]
        print(f"Offset 0x{i:04x} (+{i-16:03d}): u32={v1:10d} (0x{v1:08x}), {v2:10d} (0x{v2:08x}) | u64=0x{q:016x}")

if __name__ == "__main__":
    analyze_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\PrefabData.bix")
    analyze_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\GameHD2.bix")
    analyze_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Global.bix")

