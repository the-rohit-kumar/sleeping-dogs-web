#!/usr/bin/env python3
"""Sleeping Dogs BIG/BIX Read-Only Archive Inspector.

Parses .bix index archives and validates entry offsets against .big data files.
Strictly read-only with comprehensive bounds and integrity checks.
"""

from __future__ import annotations
import argparse
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

BIX_MAGIC = 0x2C5C40A8
BIX_RECORD_START = 0xC0
BIX_RECORD_STRIDE = 24

@dataclass(frozen=True)
class BixEntry:
    index: int
    uid: int
    offset: int
    part1_size: int
    part2_size: int
    padding: int
    total_span: int

    @property
    def is_multi_part(self) -> bool:
        return self.part1_size > 0 or self.part2_size > 0

    @property
    def payload_size(self) -> int:
        if self.is_multi_part:
            return self.part1_size + self.part2_size - self.padding
        return self.total_span


@dataclass(frozen=True)
class BixArchive:
    path: Path
    name: str
    entry_count: int
    payload_size: int
    entries: List[BixEntry]


def parse_bix_file(bix_path: Path) -> BixArchive:
    if not bix_path.is_file():
        raise FileNotFoundError(f"BIX file not found: {bix_path}")

    data = bix_path.read_bytes()
    if len(data) < BIX_RECORD_START:
        raise ValueError(f"BIX file too small ({len(data)} bytes, min {BIX_RECORD_START})")

    magic, payload_size, total_size, _ = struct.unpack_from("<IIII", data, 0)
    if magic != BIX_MAGIC:
        raise ValueError(f"Invalid BIX magic: 0x{magic:08X} (expected 0x{BIX_MAGIC:08X})")

    # Archive name at 0x44 (null-terminated ASCII)
    raw_name = data[0x44:0x70]
    nul_idx = raw_name.find(b"\0")
    name = raw_name[:nul_idx].decode("ascii", errors="replace") if nul_idx >= 0 else raw_name.decode("ascii", errors="replace")

    entry_count = struct.unpack_from("<I", data, 0x70)[0]
    expected_len = BIX_RECORD_START + entry_count * BIX_RECORD_STRIDE
    if len(data) < expected_len:
        raise ValueError(f"Truncated BIX: has {len(data)} bytes, expected {expected_len} for {entry_count} entries")

    entries: List[BixEntry] = []
    for i in range(entry_count):
        off = BIX_RECORD_START + i * BIX_RECORD_STRIDE
        uid, boff, p1, p2, pad, span = struct.unpack_from("<IIIIII", data, off)
        entries.append(BixEntry(
            index=i,
            uid=uid,
            offset=boff,
            part1_size=p1,
            part2_size=p2,
            padding=pad,
            total_span=span
        ))

    return BixArchive(
        path=bix_path,
        name=name,
        entry_count=entry_count,
        payload_size=payload_size,
        entries=entries
    )


def verify_archive(bix_archive: BixArchive, big_path: Optional[Path] = None) -> dict:
    if big_path is None:
        big_path = bix_archive.path.with_suffix(".big")

    big_size = big_path.stat().st_size if big_path.is_file() else None
    
    multi_part_count = 0
    single_part_count = 0
    invariant_failures = 0
    bounds_failures = 0

    for e in bix_archive.entries:
        if e.is_multi_part:
            multi_part_count += 1
            if e.part1_size + e.part2_size != e.total_span + e.padding:
                invariant_failures += 1
        else:
            single_part_count += 1

        if big_size is not None:
            if e.offset + e.total_span > big_size:
                bounds_failures += 1

    return {
        "archive_name": bix_archive.name,
        "entry_count": bix_archive.entry_count,
        "multi_part": multi_part_count,
        "single_part": single_part_count,
        "big_file_exists": big_size is not None,
        "big_file_size": big_size,
        "invariant_failures": invariant_failures,
        "bounds_failures": bounds_failures,
        "integrity_ok": invariant_failures == 0 and bounds_failures == 0
    }


def main():
    parser = argparse.ArgumentParser(description="Sleeping Dogs BIG/BIX Archive Inspector")
    parser.add_argument("bix_file", type=Path, help="Path to .bix archive")
    parser.add_argument("--limit", type=int, default=15, help="Number of entries to display")
    parser.add_argument("--verify", action="store_true", help="Perform full integrity validation against .big")
    args = parser.parse_args()

    archive = parse_bix_file(args.bix_file)
    print(f"Archive: {archive.name} (File: {archive.path.name})")
    print(f"Total Entries: {archive.entry_count:,}")

    if args.verify:
        v = verify_archive(archive)
        print("\n--- Integrity Verification ---")
        print(f"BIG File Size: {v['big_file_size']:,} bytes" if v['big_file_exists'] else "BIG File: NOT FOUND")
        print(f"Multi-Part Entries: {v['multi_part']:,}")
        print(f"Single-Part Entries: {v['single_part']:,}")
        print(f"Invariant Failures: {v['invariant_failures']}")
        print(f"Bounds Failures:    {v['bounds_failures']}")
        print(f"Status:             {'PASS (100% VALID)' if v['integrity_ok'] else 'FAIL'}\n")

    print(f"Displaying first {min(args.limit, archive.entry_count)} entries:")
    print(f"{'Idx':>5} | {'UID':>10} | {'Offset (Hex)':>12} | {'Part1':>10} | {'Part2':>10} | {'Padding':>8} | {'TotalSpan':>10}")
    print("-" * 80)
    for e in archive.entries[:args.limit]:
        print(f"{e.index:5d} | 0x{e.uid:08x} | 0x{e.offset:08x}   | {e.part1_size:10,d} | {e.part2_size:10,d} | {e.padding:8,d} | {e.total_span:10,d}")

if __name__ == "__main__":
    main()
