import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition"
SFX_PCK = os.path.join(GAME_DIR, "data", "Audio", "SD2", "SFX.pck")
ENG_PCK = os.path.join(GAME_DIR, "data", "Audio", "SD2", "English(US).pck")

def parse_pck_header(pck_path):
    print(f"\n=== Parsing {os.path.basename(pck_path)} ===")
    with open(pck_path, "rb") as f:
        head = f.read(128)
        magic = head[0:4]
        hdr_size, unk0, lang_table_size, bank_table_size = struct.unpack("<IIII", head[4:20])
        print(f"Magic: {magic} (hex: {magic.hex()})")
        print(f"Header Size: {hdr_size} bytes (0x{hdr_size:x})")
        print(f"Language Table Size: {lang_table_size} bytes")
        print(f"Bank Table Size: {bank_table_size} bytes")

        # Read the full header
        f.seek(0)
        header_data = f.read(hdr_size)

        # Standard Wwise PCK layout:
        # 0x00: AKPK
        # 0x04: Header size
        # 0x08: Version or unk
        # 0x0C: Language section size
        # 0x10: Bank section size
        # 0x14: Stream section size (or language table starts)
        
        pos = 20
        # Let's inspect sections
        # Look for BK (SoundBanks) and FS (File Streams) or RIFF headers in the package
        print("\nSearching for RIFF / BK / WEM signatures in header data...")
        # Check tables
        # Let's read through the header bytes and look for file count and records
        # Usually each entry has: FileID (uint32 or uint64), BlockSize (uint32), FileSize (uint32), FileOffset (uint32 * 4 or uint64)

if __name__ == "__main__":
    parse_pck_header(SFX_PCK)
    parse_pck_header(ENG_PCK)

