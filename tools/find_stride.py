import struct
from pathlib import Path

def inspect_records(path_str):
    p = Path(path_str)
    data = p.read_bytes()
    count = struct.unpack_from("<I", data, 0x70)[0]
    print(f"\nFile: {p.name}, reported count = {count}")
    
    # Let's test different candidate start offsets and strides
    # Total remaining length:
    rem = len(data) - 0x78
    print(f"Remaining bytes after 0x78: {rem}")
    for start in [0x78, 0x80, 0x88, 0x90, 0x98, 0xa0, 0xc0, 0xe0, 0x100]:
        r = len(data) - start
        if count > 0 and r % count == 0:
            print(f"  Candidate: start=0x{start:x}, stride={r // count}")

if __name__ == "__main__":
    inspect_records(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\PrefabData.bix")
    inspect_records(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\GameHD2.bix")
    inspect_records(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\CharactersHD.bix")
    inspect_records(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\Global.bix")
    inspect_records(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition\UI.bix")
