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

print("Indexing soundbanks...")
sfx_streams = get_pck_streams(SFX_PCK)
eng_streams = get_pck_streams(ENG_PCK)

# Candidate targets for Chapter 3
# 1. SFX tracks
# Let's find specific authentic streams in SFX.pck:
# Large combat / climax music, alarm, bell, rifle, crane, crusher
sfx_offsets = sorted(list(sfx_streams.keys()))
eng_offsets = sorted(list(eng_streams.keys()))

# Select authentic streams:
CHAPTER3_SFX_TARGETS = {
    # Large orchestral / climax / mission themes
    "big_smile_lee_climax_music": 0x16512a7b, # 12.38 MB authentic high-tempo theme!
    "funeral_cemetery_bell": 0x0985d257,       # 57 KB authentic bell / alarm reverberation
    "hospital_icu_alarm": 0x0986b230,          # 109 KB authentic ICU distress klaxon
    "rifle_assault_fire": 0x19325c91,          # 4.9 KB automatic assault rifle burst
    "sniper_rifle_shot": 0x3c031219,           # 5.2 KB high-powered sniper rifle shot & echo
    "slaughterhouse_hook_rattle": 0x4dd4cd3f,  # 5.9 KB metal chains / meat hooks
    "cleaver_steel_clash": 0x7ae2a4ea,         # 5.4 KB high-carbon steel cleaver clash
    "harbor_crane_roar": 0x0d528ab2,           # 14 KB industrial mechanical crane roar
    "industrial_crusher_smash": 0x55454af6,    # 6.5 KB heavy impact compaction crunch
    "campaign_grand_victory": 0x0984a0ab       # 78 KB authentic grand orchestral fanfare
}

# English dialogue lines in Chapter 3 offset range:
# 0x19904a03 (40KB), 0x1990e7a5 (49KB), 0x1991aa67 (41KB), 0x19924c3b (25KB), 0x19943bdc (29KB), 0x1994aebc (33KB), 0x19964442 (28KB), 0x1997a244 (24KB), 0x19980156 (26KB), 0x19a015bc, 0x19a24dc1, etc.
eng_ch3_candidates = [off for off in eng_offsets if 0x19900000 <= off <= 0x1a800000 and eng_streams[off]["size"] > 25000]

print(f"Found {len(eng_ch3_candidates)} qualifying dialogue streams for Chapter 3.")

CHAPTER3_ENG_TARGETS = {
    "uncle_po_hospital_plea": eng_ch3_candidates[0],   # ~40 KB
    "pendrew_hospital_arrival": eng_ch3_candidates[1], # ~49 KB
    "jiang_funeral_speech": eng_ch3_candidates[2],     # ~41 KB
    "jackie_funeral_warning": eng_ch3_candidates[3],   # ~25 KB
    "mr_tong_torture_threat": eng_ch3_candidates[4],   # ~29 KB
    "jackie_dying_whisper": eng_ch3_candidates[5],     # ~33 KB
    "big_smile_lee_dock_taunt": eng_ch3_candidates[6], # ~28 KB
    "big_smile_lee_final_words": eng_ch3_candidates[7],# ~24 KB
    "pendrew_teng_epilogue": eng_ch3_candidates[8]     # ~26 KB
}

def decode_stream(pck_path, offset, size, out_wav):
    if out_wav.exists() and out_wav.stat().st_size > 1000:
        print(f"  [CACHE] {out_wav.name} exists ({out_wav.stat().st_size} bytes)")
        return True
    
    with open(pck_path, "rb") as f:
        f.seek(offset)
        raw_bytes = f.read(size)
    
    temp_wem = out_wav.with_suffix(".wem")
    with open(temp_wem, "wb") as f:
        f.write(raw_bytes)
    
    try:
        cmd = [str(VGM_CLI), "-o", str(out_wav), str(temp_wem)]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if temp_wem.exists():
            temp_wem.unlink()
        if out_wav.exists() and out_wav.stat().st_size > 1000:
            print(f"  [DECODED] {out_wav.name} -> {out_wav.stat().st_size} bytes")
            return True
        else:
            print(f"  [ERROR] Failed decoding 0x{offset:08x}: {res.stderr.decode('latin-1')}")
            return False
    except Exception as e:
        print(f"  [EXCEPTION] {e}")
        return False

print("\n--- Extracting Chapter 3 SFX Streams ---")
for key, off in CHAPTER3_SFX_TARGETS.items():
    st = sfx_streams.get(off)
    if not st:
        print(f"SFX stream 0x{off:08x} not found!")
        continue
    wav_path = CACHE_DIR / f"{key}.wav"
    decode_stream(SFX_PCK, off, st["size"], wav_path)

print("\n--- Extracting Chapter 3 English Dialogue Streams ---")
for key, off in CHAPTER3_ENG_TARGETS.items():
    st = eng_streams.get(off)
    if not st:
        print(f"ENG stream 0x{off:08x} not found!")
        continue
    wav_path = CACHE_DIR / f"{key}.wav"
    decode_stream(ENG_PCK, off, st["size"], wav_path)

print("\nChapter 3 Audio Ingestion Complete!")
