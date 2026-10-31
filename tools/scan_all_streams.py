import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2"

def scan_all_streams(pck_name):
    pck_path = os.path.join(GAME_DIR, pck_name)
    with open(pck_path, "rb") as f:
        head = f.read(24)
        magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", head)
        stream_offset = 0x18 + lang_size + bank_size
        f.seek(stream_offset)
        stream_count = struct.unpack("<I", f.read(4))[0]
        
        tags = set()
        pcm_streams = []
        for i in range(stream_count):
            f.seek(stream_offset + 4 + i * 24)
            s_id, s_align, s_sz, s_lang, s_off, s_unk = struct.unpack("<IIIIII", f.read(24))
            
            f.seek(s_off)
            rhead = f.read(36)
            if rhead.startswith(b"RIFF"):
                tag, n_ch, rate = struct.unpack("<HHI", rhead[20:28])
                tags.add(tag)
                if tag != 0xffff:
                    pcm_streams.append((s_id, s_off, s_sz, tag, n_ch, rate))
                    
        print(f"{pck_name}: {stream_count} streams. Tags found: {[hex(t) for t in tags]}")
        if pcm_streams:
            print(f"  Found {len(pcm_streams)} non-0xffff streams!")
            for s in pcm_streams[:10]:
                print(f"    ID {s[0]}: tag=0x{s[3]:04x}, {s[4]} ch, {s[5]} Hz, {s[2]} bytes @ 0x{s[1]:x}")

if __name__ == "__main__":
    scan_all_streams("SFX.pck")
    scan_all_streams("English(US).pck")
