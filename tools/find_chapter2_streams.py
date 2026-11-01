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
    res = subprocess.run([str(VGM_CLI), "-o", str(out_wav), str(tmp_wem)], capture_output=True, text=True)
    if tmp_wem.exists():
        tmp_wem.unlink()
    if res.returncode == 0 and out_wav.exists() and out_wav.stat().st_size > 44:
        return out_wav.stat().st_size
    return None

if __name__ == "__main__":
    sfx = get_pck_streams(SFX_PCK)
    eng = get_pck_streams(ENG_PCK)
    print(f"Loaded {len(sfx)} SFX streams and {len(eng)} English streams.")

    # Search for English streams around 0x18000000 - 0x24000000
    # Let's filter streams by size range 20KB - 80KB (typical 3-7s speech lines)
    print("\nScanning English streams for Chapter 2 dialogue...")
    chapter2_eng_candidates = []
    for s in eng:
        if 0x19000000 <= s["offset"] <= 0x22000000 and 25000 <= s["size"] <= 60000:
            chapter2_eng_candidates.append(s)
    print(f"Found {len(chapter2_eng_candidates)} speech stream candidates in Chapter 2 offset range.")

    # Test decode a sample of speech candidates
    decoded_eng = []
    for idx, s in enumerate(chapter2_eng_candidates[::8][:15]):
        name = f"ch2_speech_{idx}_{s['offset']:08x}"
        sz = decode_and_test(ENG_PCK, s["offset"], s["size"], name)
        if sz:
            print(f"  Decoded {name}: {sz} bytes (offset 0x{s['offset']:08x}, stream_id {s['stream_id']})")
            decoded_eng.append((name, s["offset"], s["size"], sz))

    # SFX candidates:
    # 1. Chinese music / banquet theme (large SFX stream > 100KB)
    # 2. Machete slash / blade combat
    # 3. Meat cleaver chop
    # 4. Sports car turbo engine
    # 5. Chapter 2 grand orchestral fanfare
    print("\nScanning SFX streams for Chapter 2 effects...")
    large_sfx = [s for s in sfx if s["size"] > 50000]
    print(f"Found {len(large_sfx)} large SFX streams.")
    for idx, s in enumerate(large_sfx[:10]):
        name = f"ch2_sfx_{idx}_{s['offset']:08x}"
        sz = decode_and_test(SFX_PCK, s["offset"], s["size"], name)
        if sz:
            print(f"  Decoded SFX {name}: {sz} bytes (offset 0x{s['offset']:08x})")

