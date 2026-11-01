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
    streams = {}
    for i in range(count):
        off = stream_offset + 4 + i * 24
        if off + 24 <= len(data):
            lang, sz, flg, boff, pad, sid = struct.unpack("<IIIIII", data[off:off+24])
            streams[boff] = {
                "index": i,
                "size": sz,
                "offset": boff,
                "stream_id": sid,
                "lang": lang
            }
    return streams

def decode_and_save(pck_path, offset, size, out_name):
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
    if res.returncode == 0 and out_wav.exists():
        return out_wav.stat().st_size
    return None

if __name__ == "__main__":
    sfx = get_pck_streams(SFX_PCK)
    eng = get_pck_streams(ENG_PCK)

    # Master registry for Chapter 2
    tracks = [
        # (key, pck_path, offset, name)
        ("wedding_banquet_music", SFX_PCK, 0x0925706b, "Winston & Peggy Wedding Chinese Banquet Theme"),
        ("wedding_massacre_alarm", SFX_PCK, 0x0986b230, "18K Banquet Ambush & Gunfire Chaos"),
        ("machete_blade_slash", SFX_PCK, 0x19325c91, "18K Machete & Meat Cleaver Combat Strike"),
        ("sports_car_engine_rev", SFX_PCK, 0x09e613fd, "Central Luxury Sports Car Turbo Engine"),
        ("chapter2_finale_fanfare", SFX_PCK, 0x0984a0ab, "Chapter 2 Grand Finale Orchestral Fanfare"),
        ("winston_wedding_toast", ENG_PCK, 0x190016c7, "Winston Chu Wedding Toast to Wei Shen & Family"),
        ("winston_dying_words", ENG_PCK, 0x19121f9a, "Winston Chu Dying Words & Vengeance Order"),
        ("mrs_chu_vengeance", ENG_PCK, 0x192129a8, "Mrs. Chu Kitchen Vengeance Mandate"),
        ("ratface_interrogation", ENG_PCK, 0x193c01db, "Johnny Ratface Confession & Dogeyes Link"),
        ("broken_nose_jiang_meeting", ENG_PCK, 0x19569713, "Broken Nose Jiang Council Guidance in Central"),
        ("two_chin_tsao_arrogance", ENG_PCK, 0x1961ce50, "Two-Chin Tsao Triad Politics & Casino Boast"),
        ("dogeyes_dock_taunt", ENG_PCK, 0x19734cd9, "Dogeyes Dockside Yacht Showdown Taunt"),
        ("dogeyes_defeat_confession", ENG_PCK, 0x1987c01a, "Dogeyes Defeat & Plea for Mercy")
    ]

    print("Decoding and caching Chapter 2 authentic audio streams...")
    output_dict = {}
    for key, pck_file, off, desc in tracks:
        pck_dict = sfx if pck_file == SFX_PCK else eng
        entry = pck_dict.get(off)
        if not entry:
            print(f"ERROR: Offset 0x{off:08x} not found in PCK header table!")
            continue
        sz = entry["size"]
        wav_size = decode_and_save(pck_file, off, sz, key)
        print(f"  [OK] {key}: offset=0x{off:08x}, encoded_sz={sz}b -> wav_sz={wav_size}b ({desc})")
        output_dict[key] = {
            "pck": "SFX_PCK" if pck_file == SFX_PCK else "ENG_PCK",
            "offset": off,
            "size": sz,
            "name": desc,
            "wav_bytes": wav_size
        }

    print("\nExtraction complete! Ready to wire into asset_server.py and audio-engine.ts.")
