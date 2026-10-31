import struct
from pathlib import Path
from dataclasses import dataclass
from typing import List

@dataclass
class BigFileIndexEntry:
    resource_uid: int
    data_offset: int
    compressed_size: int
    uncompressed_size: int
    compression_flags: int
    total_size: int

    @property
    def is_compressed(self) -> bool:
        return self.compressed_size > 0 and self.compression_flags != 0

@dataclass
class BigFileIndex:
    magic: int
    payload_size: int
    archive_name: str
    entry_count: int
    entries: List[BigFileIndexEntry]

def parse_bix(path: Path) -> BigFileIndex:
    data = path.read_bytes()
    if len(data) < 0xC0:
        raise ValueError(f"BIX file too small: {len(data)} bytes (min 192)")
    
    magic, s1, s2, flags = struct.unpack_from("<IIII", data, 0)
    if magic != 0x2C5C40A8:
        raise ValueError(f"Invalid BIX magic: 0x{magic:08X} (expected 0x2C5C40A8)")
    
    # Read archive name from 0x44 (null-terminated ascii)
    name_bytes = data[0x44:0x70]
    name_end = name_bytes.find(b"\0")
    if name_end < 0:
        name_end = len(name_bytes)
    archive_name = name_bytes[:name_end].decode("ascii", errors="replace")
    
    entry_count = struct.unpack_from("<I", data, 0x70)[0]
    expected_size = 0xC0 + entry_count * 24
    if len(data) < expected_size:
        raise ValueError(f"BIX truncated: {len(data)} bytes, expected {expected_size} for {entry_count} entries")
    
    entries = []
    for i in range(entry_count):
        off = 0xC0 + i * 24
        uid, boff, csize, usize, cflags, tsize = struct.unpack_from("<IIIIII", data, off)
        entries.append(BigFileIndexEntry(
            resource_uid=uid,
            data_offset=boff,
            compressed_size=csize,
            uncompressed_size=usize,
            compression_flags=cflags,
            total_size=tsize
        ))
    
    return BigFileIndex(
        magic=magic,
        payload_size=s1,
        archive_name=archive_name,
        entry_count=entry_count,
        entries=entries
    )

if __name__ == "__main__":
    game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")
    for bix_path in sorted(game_dir.glob("*.bix"), key=lambda f: f.stat().st_size):
        idx = parse_bix(bix_path)
        compressed_count = sum(1 for e in idx.entries if e.is_compressed)
        print(f"Archive: {idx.archive_name:15s} | BIX: {bix_path.name:18s} | Entries: {idx.entry_count:6d} | Compressed: {compressed_count:5d} | Raw: {idx.entry_count - compressed_count:5d}")
