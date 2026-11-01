import struct
from pathlib import Path
import subprocess

AUDIO_DIR = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2")
SFX_PCK = AUDIO_DIR / "SFX.pck"
ENG_PCK = AUDIO_DIR / "English(US).pck"
VGM_CLI = (Path(__file__).parent / "vgmstream" / "vgmstream-cli.exe").resolve()
CACHE_DIR = (Path(__file__).parent / "audio_cache").resolve()

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
    print(f"Loaded {len(sfx)} SFX streams and {len(eng)} English streams.")
    
    # Find electronic/club music tracks in SFX (500KB - 3MB)
    club_candidates = [s for s in sfx if 300000 <= s['size'] <= 2500000 and s['offset'] > 0x0a000000]
    print(f"\nClub music candidates in SFX: {len(club_candidates)}")
    for i, s in enumerate(club_candidates[:5]):
        w = decode_and_test(SFX_PCK, s['offset'], s['size'], f"test_club_{i}")
        print(f"  Club track {i}: off=0x{s['offset']:08x}, size={s['size']}, wav={w} bytes")

    # Find additional impact SFX (glass / porcelain)
    shatter_candidates = [s for s in sfx if 10000 <= s['size'] <= 25000 and 0x0f000000 <= s['offset'] <= 0x12000000]
    print(f"\nShatter/impact candidates in SFX: {len(shatter_candidates)}")
    for i, s in enumerate(shatter_candidates[:5]):
        w = decode_and_test(SFX_PCK, s['offset'], s['size'], f"test_shatter_{i}")
        print(f"  Shatter {i}: off=0x{s['offset']:08x}, size={s['size']}, wav={w} bytes")

    # Test decoding Winston / club dialogue in English(US)
    # Streams between 20KB and 50KB
    eng_candidates = [s for s in eng if 25000 <= s['size'] <= 55000 and 0x14000000 <= s['offset'] <= 0x16000000]
    print(f"English dialogue candidates: {len(eng_candidates)}")
    for i, s in enumerate(eng_candidates[:6]):
        wav_size = decode_and_test(ENG_PCK, s['offset'], s['size'], f"test_eng_{i}")
        print(f"  Candidate {i}: off=0x{s['offset']:08x}, size={s['size']}, wav={wav_size} bytes")
