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
    if res.returncode == 0 and out_wav.exists():
        return out_wav.stat().st_size
    return None

if __name__ == "__main__":
    sfx = get_pck_streams(SFX_PCK)
    eng = get_pck_streams(ENG_PCK)
    print(f"Loaded {len(sfx)} SFX streams and {len(eng)} English streams.")

    # Streams for Mission 7 ("Listening In"), Mission 8 ("Chain of Command"), Mission 9 ("Payback"), Mission 10 ("Uncle Po Finale")
    # 1. Wiretap frequency tuner hum & calibration tone
    # 2. Pendrew wiretap instructions & Golden Koi surveillance
    # 3. Raymond Mak chain of command warning
    # 4. Warehouse alarm & Dogeyes enforcer firefight
    # 5. Uncle Po tea ceremony dialogue & Chapter 1 completion fanfare
    
    # Let's inspect candidate SFX streams:
    sfx_candidates = [
        ("wiretap_tuner_hum", 0x385d1c81, 4898),       # resonant tone
        ("warehouse_alarm", 0x0985d257, 57305),        # siren / alarm
        ("smg_fire_burst", 0x19325c91, 4902),          # automatic gunfire
        ("truck_engine_rev", 0x0d528ab2, 14194),       # heavy vehicle engine
        ("chapter1_finale_fanfare", 0x0984a0ab, 78252) # grand orchestral fanfare
    ]

    for name, off, sz in sfx_candidates:
        w_sz = decode_and_test(SFX_PCK, off, sz, name)
        print(f"Decoded SFX {name}: {w_sz} bytes (offset 0x{off:08x})")

    # Candidate English dialogue streams for remaining Chapter 1 missions:
    eng_candidates = [
        ("pendrew_listening_in", 0x18011a82, 32277), # Pendrew Golden Koi bugging orders
        ("winston_office_secret", 0x1802633c, 32687),# Winston Chu private office phone call
        ("raymond_chain_warning", 0x1804a15c, 44242),# Raymond Mak police chain of command warning
        ("wei_mak_defiance", 0x18069424, 39806),     # Wei Shen undercover resolve
        ("dogeyes_warehouse_taunt", 0x18085874, 34920), # Dogeyes warehouse boss confrontation
        ("uncle_po_tea_meeting", 0x1808e0dc, 46532), # Dragon Head Uncle Po Sun On Yee evaluation
    ]

    for name, off, sz in eng_candidates:
        w_sz = decode_and_test(ENG_PCK, off, sz, name)
        print(f"Decoded English {name}: {w_sz} bytes (offset 0x{off:08x})")

