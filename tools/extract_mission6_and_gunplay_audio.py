import struct
from pathlib import Path
import subprocess

AUDIO_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2")
SFX_PCK = AUDIO_DIR / "SFX.pck"
ENG_PCK = AUDIO_DIR / "English(US).pck"
VGM_CLI = (Path(__file__).parent / "vgmstream" / "vgmstream-cli.exe").resolve()
CACHE_DIR = (Path(__file__).parent / "audio_cache").resolve()
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_pck_streams(pck_path):
    with open(pck_path, "rb") as f:
        hdr = f.read(64)
        magic, hdr_size, version, lang_size, bank_size, stream_size = struct.unpack("<IIIIII", hdr[:24])
        f.seek(0)
        data = f.read(hdr_size)
    stream_offset = 0x18 + lang_size + 4 + bank_size
    count = (stream_size - 4) // 24
    streams = []
    for i in range(count):
        off = stream_offset + 4 + i * 24
        if off + 24 <= len(data):
            lang, sz, flg, boff, pad, sid = struct.unpack("<IIIIII", data[off:off+24])
            streams.append({
                "index": i,
                "size": sz,
                "offset": boff,
                "stream_id": sid,
                "lang": lang
            })
    return streams

def decode_and_test(pck_path, offset, size, out_name):
    out_wav = CACHE_DIR / f"{out_name}.wav"
    with open(pck_path, "rb") as f:
        f.seek(offset)
        wem_data = f.read(size)
    tmp_wem = CACHE_DIR / f"_temp_{out_name}.wem"
    with open(tmp_wem, "wb") as f:
        f.write(wem_data)
    cmd = [str(VGM_CLI), "-o", str(out_wav), str(tmp_wem)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if tmp_wem.exists():
        tmp_wem.unlink()
    if res.returncode == 0 and out_wav.exists():
        return out_wav.stat().st_size
    return None

if __name__ == "__main__":
    sfx = get_pck_streams(SFX_PCK)
    eng = get_pck_streams(ENG_PCK)
    print(f"Total SFX: {len(sfx)}, Total English: {len(eng)}")
    
    # Let's search SFX for gunshots / beeps / radio:
    # Keypad beeps / UI clicks: typically short 2KB - 15KB
    # Gunshots: typically 8KB - 25KB
    gun_candidates = [s for s in sfx if 8000 <= s['size'] <= 22000 and 0x08000000 <= s['offset'] <= 0x0c000000]
    print(f"Candidate gunshot/UI SFX: {len(gun_candidates)}")
    for i, s in enumerate(gun_candidates[:12]):
        sz = decode_and_test(SFX_PCK, s['offset'], s['size'], f"sfx_gun_{i}")
        print(f"  SFX {i}: off=0x{s['offset']:08x}, size={s['size']}, stream_id=0x{s['stream_id']:08x}, wav={sz}")
    
    # Jane Teng & Police radio dialogue in English(US).pck:
    # Let's inspect some dialogue streams in English(US) around 0x16000000 to 0x20000000
    teng_candidates = [s for s in eng if 25000 <= s['size'] <= 60000 and 0x15000000 <= s['offset'] <= 0x18000000]
    print(f"\nCandidate dialogue streams: {len(teng_candidates)}")
    for i, s in enumerate(teng_candidates[:8]):
        sz = decode_and_test(ENG_PCK, s['offset'], s['size'], f"dialogue_candidate_{i}")
        print(f"  Dialogue {i}: off=0x{s['offset']:08x}, size={s['size']}, stream_id=0x{s['stream_id']:08x}, wav={sz}")
