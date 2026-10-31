import struct
import os

SFX_PCK = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2\SFX.pck"

with open(SFX_PCK, "rb") as f:
    hdr = f.read(64)
    magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", hdr[:24])
    print(f"Header Size: {hdr_size}")
    print(f"Version/flags: {version}")
    print(f"Language Section Size: {lang_size}")
    print(f"Bank Section Size: {bank_size}")
    print(f"Stream Section Size: {stream_size}")
    
    # Read the full header
    f.seek(0)
    data = f.read(hdr_size)
    
    # Language section starts at 0x18
    # Then Bank section
    bank_offset = 0x18 + lang_size
    bank_count = struct.unpack("<I", data[bank_offset:bank_offset+4])[0]
    print(f"\nBank Count at 0x{bank_offset:x}: {bank_count}")
    
    # Let's inspect the bank records
    # Usually: ID (uint32), BlockSize (uint32), FileSize (uint32), Offset (uint32 or uint64), LanguageID (uint32)
    # Let's test record strides: 20 bytes (ID, Block, Size, Offset, Lang) or 24 bytes
    print("Testing Bank Record layouts at 0x{:x}...".format(bank_offset + 4))
    for stride in [20, 24, 28, 32]:
        try:
            records = []
            for i in range(min(5, bank_count)):
                rec_off = bank_offset + 4 + i * stride
                rec = struct.unpack("<IIII", data[rec_off:rec_off+16])
                records.append(rec)
            print(f"Stride {stride}:")
            for r in records:
                print(f"   ID=0x{r[0]:08x} ({r[0]}), Block={r[1]}, Size={r[2]:8d}, Offset=0x{r[3]:08x}")
        except Exception as e:
            print(f"Stride {stride} failed: {e}")

