import struct
from collections import Counter

SFX_PCK = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2\SFX.pck"

def scan_audio_codecs():
    codecs = Counter()
    sample_rates = Counter()
    channels_count = Counter()
    examples = {}
    
    with open(SFX_PCK, "rb") as f:
        # Bank table starts at 0x2C
        f.seek(0x2C)
        bank_count = struct.unpack("<I", f.read(4))[0]
        
        # Scan first 20 banks
        for bi in range(min(bank_count, 20)):
            f.seek(0x30 + bi * 24)
            b_id, b_align, b_sz, b_lang, b_off, b_unk = struct.unpack("<IIIIII", f.read(24))
            
            f.seek(b_off)
            bank_head = f.read(min(b_sz, 65536))
            
            # Find DIDX and DATA
            didx_idx = bank_head.find(b"DIDX")
            data_idx = bank_head.find(b"DATA")
            if didx_idx != -1 and data_idx != -1:
                didx_sz = struct.unpack("<I", bank_head[didx_idx+4:didx_idx+8])[0]
                num_items = didx_sz // 12
                data_base = b_off + data_idx + 8
                
                for ti in range(min(num_items, 15)):
                    t_id, t_moff, t_msz = struct.unpack("<III", bank_head[didx_idx+8+ti*12:didx_idx+8+(ti+1)*12])
                    
                    # Read RIFF header
                    f.seek(data_base + t_moff)
                    riff_head = f.read(48)
                    if riff_head.startswith(b"RIFF"):
                        fmt_tag, n_chan, s_rate = struct.unpack("<HHI", riff_head[20:28])
                        codecs[fmt_tag] += 1
                        sample_rates[s_rate] += 1
                        channels_count[n_chan] += 1
                        if fmt_tag not in examples:
                            examples[fmt_tag] = {
                                "bank_id": b_id,
                                "track_id": t_id,
                                "abs_offset": data_base + t_moff,
                                "size": t_msz,
                                "rate": s_rate,
                                "channels": n_chan
                            }

    print(f"Codecs Found:")
    for tag, cnt in codecs.most_common():
        ex = examples[tag]
        print(f"  Codec 0x{tag:04x}: count={cnt} (example: Track {ex['track_id']} in Bank {ex['bank_id']} @ 0x{ex['abs_offset']:08x}, {ex['rate']} Hz, {ex['channels']} ch, {ex['size']} bytes)")

if __name__ == "__main__":
    scan_audio_codecs()
