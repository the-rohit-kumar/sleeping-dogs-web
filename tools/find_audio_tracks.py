import struct
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2"
SFX_PCK = os.path.join(GAME_DIR, "SFX.pck")
ENG_PCK = os.path.join(GAME_DIR, "English(US).pck")

def inspect_tracks(pck_path, max_tracks=20):
    with open(pck_path, "rb") as f:
        head = f.read(24)
        magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", head)
        stream_offset = 0x18 + lang_size + bank_size
        f.seek(stream_offset)
        stream_count = struct.unpack("<I", f.read(4))[0]
        
        print(f"\n=== {os.path.basename(pck_path)} (Total Streams: {stream_count}) ===")
        tracks = []
        for i in range(min(stream_count, 100)):
            f.seek(stream_offset + 4 + i * 24)
            s_id, s_align, s_sz, s_lang, s_off, s_unk = struct.unpack("<IIIIII", f.read(24))
            
            f.seek(s_off)
            rhead = f.read(36)
            if rhead.startswith(b"RIFF"):
                tag, n_ch, rate = struct.unpack("<HHI", rhead[20:28])
                tracks.append({
                    "id": s_id,
                    "offset": s_off,
                    "size": s_sz,
                    "channels": n_ch,
                    "rate": rate,
                    "tag": tag
                })
                
        # Sort by size to find ambient loops vs short impacts
        tracks.sort(key=lambda t: t["size"], reverse=True)
        print("Longest Streams (Ambience / Engine loops / Music):")
        for t in tracks[:10]:
            duration_est = t["size"] / (t["rate"] * t["channels"] * 0.25) # rough compressed estimate
            print(f"  ID: {t['id']:10d} @ 0x{t['offset']:08x} ({t['offset']:10d}) | size={t['size']:8d}b | {t['rate']} Hz, {t['channels']} ch")
            
        print("\nShorter Streams (Impacts / Foley / Steps):")
        for t in tracks[-10:]:
            print(f"  ID: {t['id']:10d} @ 0x{t['offset']:08x} ({t['offset']:10d}) | size={t['size']:8d}b | {t['rate']} Hz, {t['channels']} ch")

if __name__ == "__main__":
    inspect_tracks(SFX_PCK)
    inspect_tracks(ENG_PCK)

