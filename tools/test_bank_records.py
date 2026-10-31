import struct

SFX_PCK = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2\SFX.pck"

with open(SFX_PCK, "rb") as f:
    hdr = f.read(62468)
    bank_offset = 0x18 + 20 # 0x2C
    count = struct.unpack("<I", hdr[bank_offset:bank_offset+4])[0]
    print(f"Bank Table has {count} entries (stride=24):")
    for i in range(min(15, count)):
        off = bank_offset + 4 + i * 24
        f0, f1, f2, f3, f4, f5 = struct.unpack("<IIIIII", hdr[off:off+24])
        print(f"[{i:3d}] f0={f0:10d} (0x{f0:08x}) f1={f1} f2={f2:8d} (0x{f2:08x}) f3={f3} f4={f4:10d} (0x{f4:08x}) f5={f5}")

