import struct
from pathlib import Path

def inspect_bix(path_str):
    p = Path(path_str)
    data = p.read_bytes()
    print(f"=== BIX: {p.name} (Size: {len(data)} bytes) ===")
    magic, size1, size2, flags = struct.unpack_from("<IIII", data, 0)
    print(f"Header: Magic=0x{magic:08X}, Size1={size1}, Size2={size2}, Flags={flags}")
    
    # Let's inspect the remaining bytes after 16
    payload = data[16:]
    print(f"Payload length: {len(payload)} bytes")
    
    # Let's see if there are recognizable records
    # Let's check common struct sizes: 16, 20, 24, 28, 32, 36, 40, 48, 64
    for record_size in [16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64]:
        if len(payload) % record_size == 0:
            count = len(payload) // record_size
            print(f"  Divisible by record_size={record_size} -> {count} records")

if __name__ == "__main__":
    import sys
    inspect_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\PrefabData.bix")
    inspect_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Global.bix")
    inspect_bix(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\GameHD2.bix")
