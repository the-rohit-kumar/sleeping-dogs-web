import re

ANIM_BIG = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Animation.big"
EXE_PATH = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\sdhdship.exe"

with open(EXE_PATH, "rb") as f:
    exe_data = f.read()

anim_strings = re.findall(b'[a-zA-Z0-9_]{3,}_(?:idle|walk|run|sprint|turn|drive|enter|exit)[a-zA-Z0-9_]*', exe_data, re.IGNORECASE)
anim_set = sorted(list(set(s.decode('ascii', errors='ignore') for s in anim_strings)))
print(f"Animation names found in sdhdship.exe: {len(anim_set)}")
for name in anim_set[:30]:
    print(" ", name)
