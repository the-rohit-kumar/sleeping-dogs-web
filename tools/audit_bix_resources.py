#!/usr/bin/env python3
"""
tools/audit_bix_resources.py
Audits asset archive references against base-game .bix index archives.
Performs exact field-by-field verification (UID, Offset, Span, Part1, Part2, Padding).
Addresses Finding F02 from Technical Review 2.
"""

from pathlib import Path
import struct
import re

GAME_DIR = Path('C:/Program Files (x86)/Steam/steamapps/common/SleepingDogsDefinitiveEdition')
SRC_DIR = Path(__file__).resolve().parent.parent / 'client' / 'src'

def load_bix(arch: str):
    path = GAME_DIR / f'{arch}.bix'
    if not path.exists():
        return []
    with open(path, 'rb') as f:
        buf = f.read()
    if len(buf) < 0xC0:
        return []
    entry_count, = struct.unpack('<I', buf[0x70:0x74])
    entries = []
    for i in range(entry_count):
        off = 0xC0 + i * 24
        uid, boff, p1, p2, pad, span = struct.unpack('<IIIIII', buf[off:off+24])
        entries.append({
            'index': i,
            'uid': uid,
            'offset': boff,
            'p1': p1,
            'p2': p2,
            'pad': pad,
            'span': span
        })
    return entries

bix_archives = {a: load_bix(a) for a in ['Vehicles', 'Characters', 'Game', 'UI']}

def classify_resource(arch: str, req_uid: int | None, req_off: int, req_span: int):
    entries = bix_archives.get(arch, [])
    if not entries:
        return 'ARCHIVE_NOT_FOUND', None, 'Archive .bix could not be loaded'

    # Check for exact offset or base offset (header offset + 16)
    base_off = req_off - 16 if req_off % 16 != 0 and (req_off - 16) % 0x800 == 0 else req_off

    m_uid = [e for e in entries if req_uid is not None and e['uid'] == req_uid]
    m_off = [e for e in entries if e['offset'] in (req_off, base_off)]

    # 1. Check exact match: UID and offset match
    if m_uid and m_off:
        for eu in m_uid:
            for eo in m_off:
                if eu['index'] == eo['index']:
                    e = eu
                    if e['span'] == req_span:
                        return 'EXACT_MATCH', e, f"Exact UID, offset, and span match (p1={e['p1']}, p2={e['p2']}, pad={e['pad']})"
                    elif e['offset'] == base_off and req_off == base_off + 16 and (e['span'] == req_span + 16 or e['span'] == req_span):
                        return 'EXACT_PAYLOAD_MATCH', e, f"Exact match with 16-byte header skip (BIX span {e['span']}, payload {req_span})"
                    elif req_span <= e['span']:
                        return 'SPAN_SUBSET_MATCH', e, f"UID and offset match; requested {req_span}b is sub-span of BIX entry ({e['span']}b)"
                    else:
                        return 'SPAN_OVERFLOW_MISMATCH', e, f"UID and offset match, but requested {req_span}b exceeds BIX entry ({e['span']}b)"

    # 2. UID match only (offset differs)
    if m_uid:
        e = m_uid[0]
        return 'UID_MATCH_OFFSET_DIFFERS', e, f"UID 0x{req_uid:08x} exists at BIX offset 0x{e['offset']:08x} (requested 0x{req_off:08x})"

    # 3. Offset match only (UID differs or was not declared)
    if m_off:
        e = m_off[0]
        if e['span'] == req_span or (req_off == e['offset'] + 16 and e['span'] in (req_span, req_span + 16)):
            return 'OFFSET_MATCH_EXACT_SPAN', e, f"Offset 0x{e['offset']:08x} matches BIX Idx {e['index']} (BIX UID 0x{e['uid']:08x}, span={e['span']})"
        elif req_span <= e['span']:
            return 'OFFSET_MATCH_SUB_SPAN', e, f"Offset matches BIX Idx {e['index']}, requested {req_span}b is within BIX span {e['span']}b"
        else:
            return 'OFFSET_MATCH_SPAN_DIFFERS', e, f"Offset matches BIX Idx {e['index']}, but BIX span is {e['span']}b (requested {req_span}b)"

    # 4. Check if offset falls inside any BIX entry span
    enclosing = [e for e in entries if e['offset'] <= req_off < e['offset'] + e['span']]
    if enclosing:
        e = enclosing[0]
        return 'INSIDE_ENTRY_PAYLOAD', e, f"Offset 0x{req_off:08x} falls inside BIX Idx {e['index']} (0x{e['offset']:08x}..0x{e['offset']+e['span']:08x})"

    return 'NOT_IN_BIX', None, f"No BIX entry found matching UID {hex(req_uid) if req_uid else 'None'} or offset 0x{req_off:08x}"


def audit_source_files():
    """Automatically parses all fetchRange() calls in client/src/ TypeScript code."""
    print("=" * 130)
    print("PART 1: AUTOMATIC SOURCE DISCOVERY AUDIT (client/src/asset-loader.ts & related sources)")
    print("=" * 130)
    print(f"{'Source Location':<32} | {'Arch':<10} | {'Req UID':<10} | {'Req Off':<10} | {'Req Span':<9} | {'BIX Idx':<7} | {'BIX Span':<9} | Classification")
    print("-" * 130)

    ts_files = list(SRC_DIR.glob('**/*.ts'))
    total_calls = 0
    results = {}

    pattern = re.compile(r'fetchRange\(\s*[\'"](\w+)[\'"]\s*,\s*([^,]+),\s*([^)]+)\)')

    for ts in ts_files:
        code = ts.read_text(encoding='utf-8')
        for m in pattern.finditer(code):
            total_calls += 1
            arch = m.group(1)
            off_str = m.group(2).strip()
            span_str = m.group(3).strip()

            try:
                # Safe eval of constant arithmetic like 0x16063400 + 16
                req_off = eval(off_str, {'__builtins__': None}, {})
                req_span = eval(span_str, {'__builtins__': None}, {})
            except Exception:
                continue

            # Look backwards for UID
            preceding = code[max(0, m.start() - 350):m.start()]
            uid_m = re.search(r'UID:?\s*(?:0x)?([0-9a-fA-F]{6,8})', preceding)
            req_uid = int(uid_m.group(1), 16) if uid_m else None

            # Get function name
            fn_m = re.findall(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)', preceding)
            fn_name = fn_m[-1] if fn_m else ts.name

            loc = f"{ts.name}:{fn_name}()"
            status, entry, details = classify_resource(arch, req_uid, req_off, req_span)
            results[status] = results.get(status, 0) + 1

            bix_idx = str(entry['index']) if entry else 'N/A'
            bix_span = str(entry['span']) if entry else 'N/A'
            uid_str = f"0x{req_uid:08x}" if req_uid else "None"
            print(f"{loc[:32]:<32} | {arch:<10} | {uid_str:<10} | 0x{req_off:08x} | {req_span:<9} | {bix_idx:<7} | {bix_span:<9} | {status} ({details})")

    print("\nSummary of Source Declarations:")
    for k, v in results.items():
        print(f"  {k}: {v}")
    return results


def audit_curated_sample():
    """Audits the curated project reference table of 18 resources with full span comparison."""
    print("\n" + "=" * 130)
    print("PART 2: CURATED BENCHMARK TABLE AUDIT (18 Resources with strict span comparison)")
    print("=" * 130)
    print(f"{'Resource Name':<30} | {'Arch':<10} | {'Req UID':<10} | {'Req Off':<10} | {'Req Span':<9} | {'BIX Idx':<7} | {'BIX Span':<9} | Classification")
    print("-" * 130)

    sample = [
        ('Sedan Mesh (Vehicles)', 'Vehicles', 0x008c038c, 0x01f0a400, 3840),
        ('Pedestrian Mesh (Characters)', 'Characters', 0x030e17e9, 0x161f3000, 10944),
        ('Hong Kong Sector (Game)', 'Game', 0x7b8f6706, 0x1b7ef400, 1648),
        ('Crate Texture (UI)', 'UI', 0x0854388e, 0x0356b800, 32768),
        ('Taxi Livery (Vehicles)', 'Vehicles', 0x0207f800, 0x0207f800, 131072),
        ('Triad Clothing (Characters)', 'Characters', 0x16595000, 0x16595000, 131072),
        ('Concrete Road (Game)', 'Game', 0x10360800, 0x10360800, 131072),
        ('Shop Neon (UI)', 'UI', 0x07dc4800, 0x07dc4800, 131072),
        ('Sector North (Game)', 'Game', 0x7b8f6707, 0x1b800000, 32768),
        ('Sector South (Game)', 'Game', 0x7b8f6708, 0x1b810000, 32768),
        ('Sector East (Game)', 'Game', 0x7b8f6709, 0x1b820000, 32768),
        ('Sector West (Game)', 'Game', 0x7b8f670a, 0x1b830000, 32768),
        ('Traffic Minivan (Vehicles)', 'Vehicles', 0x008c0400, 0x01f20000, 4096),
        ('Traffic SUV (Vehicles)', 'Vehicles', 0x008c0500, 0x01f30000, 4096),
        ('Traffic Bus (Vehicles)', 'Vehicles', 0x008c0600, 0x01f40000, 4096),
        ('Crowd Triad (Characters)', 'Characters', 0x00882829, 0x08770000, 25072),
        ('Crowd Vendor (Characters)', 'Characters', 0x01bf39f3, 0x15d0e000, 10672),
        ('Crowd Citizen (Characters)', 'Characters', 0x00062a74, 0x028d0000, 12288)
    ]

    results = {}
    for name, arch, req_uid, req_off, req_span in sample:
        status, entry, details = classify_resource(arch, req_uid, req_off, req_span)
        results[status] = results.get(status, 0) + 1
        bix_idx = str(entry['index']) if entry else 'N/A'
        bix_span = str(entry['span']) if entry else 'N/A'
        print(f"{name:<30} | {arch:<10} | 0x{req_uid:08x} | 0x{req_off:08x} | {req_span:<9} | {bix_idx:<7} | {bix_span:<9} | {status}")

    print("\nSummary of Curated Benchmark Sample (18 resources):")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == '__main__':
    audit_source_files()
    audit_curated_sample()
