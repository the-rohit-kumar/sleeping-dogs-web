from pathlib import Path
exe_path = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\sdhdship.exe")
with open(exe_path, "rb") as f:
    data = f.read()

zerrs = [
    b"invalid block type",
    b"invalid stored block lengths",
    b"too many length or distance symbols",
    b"invalid literal/lengths set",
    b"invalid distances set",
    b"invalid bit length repeat",
    b"incorrect header check",
    b"unknown compression method",
    b"invalid window size",
    b"incompatible version",
    b"buffer error",
    b"insufficient memory"
]
for ze in zerrs:
    pos = data.find(ze)
    if pos != -1:
        print(f"Found zlib string: '{ze.decode()}' at file offset 0x{pos:x}")
