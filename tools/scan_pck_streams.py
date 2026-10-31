import struct
from collections import Counter
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2"

def scan_pck(name):
    pck_path = os.path.join(GAME_DIR, name)
    codecs = Counter()
    examples = {}
    
    with open(pck_path, "rb") as f:
        # Read header size and bank size
        head = f.read(24)
        magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", head)
        print(f"\n=== {name} (Hdr: {hdr_size}, BankSize: {bank_size}, StreamSize: {stream_size}) ===")
        
        bank_offset = 0x18 + lang_size
        f.seek(bank_offset)
        bank_count = struct.unpack("<I", f.read(4))[0]
        print(f"Bank count: {bank_count}")
        
        # Also check stream table!
        stream_offset = bank_offset + bank_size
        f.seek(stream_offset)
        stream_count = struct.unpack("<I", f.read(4))[0]
        print(f"Stream count: {stream_count}")
        
        for si in range(min(stream_count, 30)):
            f.seek(stream_offset + 4 + si * 24)
            s_id, s_align, s_sz, s_lang, s_off, s_unk = struct.unpack("<IIIIII", f.read(24))
            f.seek(s_off)
            rhead = f.read(32)
            if rhead.startswith(b"RIFF"):
                tag, n_ch, rate = struct.unpack("<HHI", rhead[20:28])
                codecs[tag] += 1
                if tag not in examples:
                    examples[tag] = (s_id, s_off, s_sz, rate, n_ch)
                    
    print("Stream Codecs:")
    for tag, cnt in codecs.most_common():
        ex = examples[tag]
        print(f"  Codec 0x{tag:04x}: count={cnt} (ex: ID {ex[0]} @ 0x{ex[1]:x}, {ex[2]} bytes, {ex[3]} Hz, {ex[4]} ch)")

if __name__ == "__main__":
    scan_pck("SFX.pck")
    scan_pck("English(US).pck")

