import struct
from pathlib import Path

def dump_entries(path_str, n=5):
    p = Path(path_str)
    data = p.read_bytes()
    count = struct.unpack_from("<I", data, 0x70)[0]
    print(f"\n=================== {p.name}: {count} entries, start=0xC0, stride=24 ===================")
    
    for i in range(min(count, n)):
        off = 0xC0 + i * 24
        chunk = data[off:off+24]
        # Try 6 uint32s:
        u1, u2, u3, u4, u5, u6 = struct.unpack_from("<IIIIII", chunk, 0)
        # Try uint64, uint64, uint64:
        q1, q2, q3 = struct.unpack_from("<QQQ", chunk, 0)
        # Try uint64 (uid), uint32 (offset), uint32 (csize), uint32 (usize), uint32 (flags):
        # Or uint32 (uid), uint32 (type?), uint32 (offset), uint32 (csize), uint32 (usize), uint32 (flags)
        print(f"[{i:03d}] @ 0x{off:04x} | Hex: {chunk.hex(' ')}")
        print(f"     u32: [{u1:#010x}, {u2:#010x}, {u3:#010x}, {u4:#010x}, {u5:#010x}, {u6:#010x}]")
        print(f"     dec: [u1={u1}, u2={u2}, u3={u3}, u4={u4}, u5={u5}, u6={u6}]")

if __name__ == "__main__":
    dump_entries(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\PrefabData.bix")
    dump_entries(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\GameHD2.bix")
    dump_entries(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Global.bix")

