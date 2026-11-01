import subprocess
import os
from pathlib import Path

AUDIO_DIR = Path("C:/Program Files (x86)/Steam/steamapps/common/SleepingDogsDefinitiveEdition/data/Audio/SD2")
SFX_PCK = AUDIO_DIR / "SFX.pck"
ENG_PCK = AUDIO_DIR / "English(US).pck"
VGM_CLI = Path(__file__).parent / "vgmstream" / "vgmstream-cli.exe"
CACHE_DIR = Path(__file__).parent / "audio_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

AUDIO_TRACKS = {
    "hk_ambience": {"pck": SFX_PCK, "offset": 0x9251ad9, "size": 21906},
    "vehicle_engine": {"pck": SFX_PCK, "offset": 0x0d528ab2, "size": 14194},
    "combat_strike": {"pck": SFX_PCK, "offset": 0x104d1f2f, "size": 14406},
    "counter_impact": {"pck": SFX_PCK, "offset": 0x0f01c9e7, "size": 12383},
    "vehicle_horn": {"pck": SFX_PCK, "offset": 0x0ba87b9b, "size": 13468},
    "hk_dialogue": {"pck": ENG_PCK, "offset": 0x00431f8c, "size": 16681},
    "env_takedown": {"pck": SFX_PCK, "offset": 0x09e7f465, "size": 28466},
    "police_siren": {"pck": SFX_PCK, "offset": 0x0985d257, "size": 57305},
    "mission_fanfare": {"pck": SFX_PCK, "offset": 0x0984a0ab, "size": 78252},
    "triad_brawl_shout": {"pck": SFX_PCK, "offset": 0x0ce55550, "size": 89872},
    "raymond_interrogate": {"pck": ENG_PCK, "offset": 0x0504b727, "size": 32360},
    "pendrew_briefing": {"pck": ENG_PCK, "offset": 0x0636bfa5, "size": 22169},
    "jackie_reunion": {"pck": ENG_PCK, "offset": 0x0c03073d, "size": 21834},
    "winston_shakedown": {"pck": ENG_PCK, "offset": 0x143cebc4, "size": 30788},
    "vendor_argument": {"pck": ENG_PCK, "offset": 0x18fda27b, "size": 29679},
    "triad_threat": {"pck": ENG_PCK, "offset": 0x271235be, "size": 43786}
}

for key, info in AUDIO_TRACKS.items():
    out_wav = CACHE_DIR / f"{key}.wav"
    if out_wav.exists() and out_wav.stat().st_size > 1000:
        print(f"  [ALREADY CACHED] {key} ({out_wav.stat().st_size} bytes)")
        continue
    with open(info["pck"], "rb") as f:
        f.seek(info["offset"])
        data = f.read(info["size"])
    tmp_wem = CACHE_DIR / f"_temp_{key}.wem"
    with open(tmp_wem, "wb") as f:
        f.write(data)
    cmd = [str(VGM_CLI), "-o", str(out_wav), str(tmp_wem)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if tmp_wem.exists():
        try: os.remove(tmp_wem)
        except OSError: pass
    if res.returncode == 0 and out_wav.exists():
        print(f"  [DECODED] {key} -> {out_wav.stat().st_size} bytes")
    else:
        print(f"  [FAILED] {key}: {res.stderr}")

print("Pre-cache complete.")
