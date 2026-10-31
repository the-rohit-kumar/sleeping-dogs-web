import struct
import subprocess
import os

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\data\Audio\SD2"
SFX_PCK = os.path.join(GAME_DIR, "SFX.pck")
ENG_PCK = os.path.join(GAME_DIR, "English(US).pck")
VGM_CLI = os.path.abspath(r"tools\vgmstream\vgmstream-cli.exe")

TRACKS = {
    "hk_ambience": {"pck": SFX_PCK, "offset": 0x9251ad9, "size": 21906, "name": "Hong Kong Urban Ambience"},
    "vehicle_engine": {"pck": SFX_PCK, "offset": 0x0d528ab2, "size": 14194, "name": "Vehicle Engine Sound"},
    "combat_strike": {"pck": SFX_PCK, "offset": 0x104d1f2f, "size": 14406, "name": "Martial Arts Combat Strike"},
    "hk_dialogue": {"pck": ENG_PCK, "offset": 0x00431f8c, "size": 16681, "name": "Hong Kong Pedestrian Dialogue"}
}

def test_track(key, info):
    print(f"\n--- Testing {info['name']} ---")
    with open(info["pck"], "rb") as f:
        f.seek(info["offset"])
        data = f.read(info["size"])
        
    tmp_wem = os.path.abspath(f"tools/temp_{key}.wem")
    with open(tmp_wem, "wb") as f:
        f.write(data)
        
    proc = subprocess.run([VGM_CLI, "-i", tmp_wem], capture_output=True)
    os.remove(tmp_wem)
    
    # Check stdout for audio info
    lines = proc.stdout.decode('utf-8', errors='ignore').splitlines()
    for l in lines:
        if any(k in l for k in ["sample rate", "channels", "duration", "stream total"]):
            print(" ", l.strip())

if __name__ == "__main__":
    for k, v in TRACKS.items():
        test_track(k, v)

