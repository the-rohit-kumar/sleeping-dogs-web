import re

EXE_PATH = r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\sdhdship.exe"

with open(EXE_PATH, "rb") as f:
    exe_data = f.read()

strings = re.findall(b'(?:FSR_|Combat_|Wei_|Ped_|Vehicle_)[a-zA-Z0-9_]{3,}', exe_data)
unique_strings = sorted(list(set(s.decode('ascii', errors='ignore') for s in strings)))
print(f"Total matching combat & animation states: {len(unique_strings)}")
for s in unique_strings[:40]:
    print(" ", s)
