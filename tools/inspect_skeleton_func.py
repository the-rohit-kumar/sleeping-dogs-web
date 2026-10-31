import struct

with open(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\sdhdship.exe", "rb") as f:
    f.seek(0x0146e004 - 32)
    code = f.read(96)

print("Code bytes around 0x14146e004:")
for i in range(0, len(code), 16):
    chunk = code[i:i+16]
    print(f"+0x{i:02x}: {chunk.hex(' ')}")

