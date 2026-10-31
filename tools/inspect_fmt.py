import struct

SFX_PCK = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2\SFX.pck"
with open(SFX_PCK, "rb") as f:
    f.seek(62476 + 0x3d8 + 8)
    head = f.read(128)

print("fmt chunk (66 bytes):")
fmt_bytes = head[20:20+66]
print("Hex:")
print(fmt_bytes.hex(" "))
print("\nUnpacked:")
fmt_tag, n_chan, rate, avg_bps, align, bits_samp, cb_size = struct.unpack("<HHI IHH H", fmt_bytes[:18])
print(f"  Tag: 0x{fmt_tag:04x}, Channels: {n_chan}, Rate: {rate}, cbSize: {cb_size}")
extra = fmt_bytes[18:]
print(f"  Extra bytes length: {len(extra)}")
print(f"  Extra hex: {extra.hex(' ')}")

