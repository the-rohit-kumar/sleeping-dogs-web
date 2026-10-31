#!/usr/bin/env python3
"""Read-only PE inspector for Sleeping Dogs: Definitive Edition.

Uses only Python's standard library. It does not execute or modify game files.
It reports PE metadata, imported DLLs/functions, delay imports, CodeView/PDB
identity (RSDS GUID + age + embedded path), section layout, and nearby PDB files.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import struct
import sys
from pathlib import Path
from typing import Any

MACHINE = {0x14C: "x86", 0x8664: "x64", 0xAA64: "ARM64"}
DIR_IMPORT = 1
DIR_DEBUG = 6
DIR_DELAY_IMPORT = 13
IMAGE_DIRECTORY_ENTRY_DEBUG = 6
IMAGE_DEBUG_TYPE_CODEVIEW = 2

class PEError(Exception):
    pass

def u16(data: bytes, off: int) -> int:
    return struct.unpack_from("<H", data, off)[0]

def u32(data: bytes, off: int) -> int:
    return struct.unpack_from("<I", data, off)[0]

def u64(data: bytes, off: int) -> int:
    return struct.unpack_from("<Q", data, off)[0]

def cstr(data: bytes, off: int, maxlen: int = 4096) -> str:
    if off < 0 or off >= len(data):
        return ""
    end = data.find(b"\0", off, min(len(data), off + maxlen))
    if end < 0:
        end = min(len(data), off + maxlen)
    return data[off:end].decode("utf-8", errors="replace")

def parse_pe(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 0x40 or data[:2] != b"MZ":
        raise PEError("Missing DOS MZ header")
    peoff = u32(data, 0x3C)
    if peoff + 24 > len(data) or data[peoff:peoff+4] != b"PE\0\0":
        raise PEError("Missing PE signature")
    coff = peoff + 4
    machine = u16(data, coff)
    nsects = u16(data, coff + 2)
    timestamp = u32(data, coff + 4)
    opt_size = u16(data, coff + 16)
    opt = coff + 20
    if opt + opt_size > len(data):
        raise PEError("Optional header extends past end of file")
    magic = u16(data, opt)
    if magic == 0x20B:
        pe_kind, dd_off, num_off, ptr_size = "PE32+", 112, 108, 8
    elif magic == 0x10B:
        pe_kind, dd_off, num_off, ptr_size = "PE32", 96, 92, 4
    else:
        raise PEError(f"Unknown optional-header magic 0x{magic:04x}")
    image_base = u64(data, opt + 24) if magic == 0x20B else u32(data, opt + 28)
    entrypoint = u32(data, opt + 16)
    size_image = u32(data, opt + 56)
    size_headers = u32(data, opt + 60)
    n_dirs = u32(data, opt + num_off)
    directories = []
    for i in range(min(n_dirs, (opt_size - dd_off)//8)):
        directories.append((u32(data, opt + dd_off + i*8), u32(data, opt + dd_off + i*8 + 4)))

    sections = []
    sec_off = opt + opt_size
    for i in range(nsects):
        o = sec_off + i*40
        if o + 40 > len(data):
            break
        name = data[o:o+8].split(b"\0",1)[0].decode("ascii", errors="replace")
        vsize, va, raw_size, raw_ptr = struct.unpack_from("<IIII", data, o+8)
        sections.append({"name":name,"virtual_size":vsize,"virtual_address":va,
                         "raw_size":raw_size,"raw_offset":raw_ptr,
                         "characteristics":f"0x{u32(data,o+36):08x}"})

    def rva_to_off(rva: int) -> int:
        if rva < size_headers:
            if rva < len(data): return rva
        for s in sections:
            start, vsize, rawsize = s["virtual_address"], s["virtual_size"], s["raw_size"]
            span = max(vsize, rawsize)
            if start <= rva < start + span:
                delta = rva - start
                off = s["raw_offset"] + delta
                if delta < rawsize and off < len(data):
                    return off
        raise PEError(f"RVA 0x{rva:x} cannot be mapped to file offset")

    imports = []
    if len(directories) > DIR_IMPORT:
        rva, size = directories[DIR_IMPORT]
        if rva and size:
            try:
                base = rva_to_off(rva)
                step = 20
                for idx in range(min(size//step + 1, 4096)):
                    o = base + idx*step
                    if o + step > len(data): break
                    oft, tds, fwd, name_rva, ft = struct.unpack_from("<IIIII", data, o)
                    if not any((oft,tds,fwd,name_rva,ft)): break
                    dll = cstr(data, rva_to_off(name_rva)).lower()
                    thunk_rva = oft or ft
                    thunk_off = rva_to_off(thunk_rva)
                    names = []
                    for ti in range(20000):
                        to = thunk_off + ti*ptr_size
                        if to + ptr_size > len(data): break
                        val = u64(data,to) if ptr_size==8 else u32(data,to)
                        if val == 0: break
                        ordinal_mask = 1 << (ptr_size*8-1)
                        if val & ordinal_mask:
                            names.append(f"ORDINAL_{val & 0xffff}")
                        else:
                            try:
                                nameoff = rva_to_off(val)
                                names.append(cstr(data,nameoff+2))
                            except Exception:
                                names.append(f"<unresolved RVA 0x{val:x}>")
                    imports.append({"dll":dll,"functions":names,"count":len(names)})
            except Exception as e:
                imports.append({"dll":"<import parse error>","functions":[str(e)],"count":0})

    delay_imports = []
    if len(directories) > DIR_DELAY_IMPORT:
        rva, size = directories[DIR_DELAY_IMPORT]
        if rva and size:
            try:
                base = rva_to_off(rva)
                for idx in range(min(size//32 + 1, 4096)):
                    o = base + idx*32
                    if o+32 > len(data): break
                    vals = struct.unpack_from("<IIIIIIII",data,o)
                    if not any(vals): break
                    attrs, name_rva = vals[0], vals[1]
                    if attrs & 1:
                        name_rva_effective = name_rva
                    else:
                        name_rva_effective = name_rva - image_base if name_rva >= image_base else name_rva
                    dll = cstr(data,rva_to_off(name_rva_effective)).lower() if name_rva_effective else "<unresolved>"
                    delay_imports.append(dll)
            except Exception as e:
                delay_imports.append(f"<delay import parse error: {e}>")

    codeview = []
    if len(directories) > DIR_DEBUG:
        rva, size = directories[DIR_DEBUG]
        if rva and size:
            try:
                base = rva_to_off(rva)
                for idx in range(min(size//28, 4096)):
                    o = base + idx*28
                    if o+28 > len(data): break
                    chars, tstamp, maj, minr, typ, dsize, drva, dptr = struct.unpack_from("<IIHHIIII",data,o)
                    if typ != IMAGE_DEBUG_TYPE_CODEVIEW or not dptr or dptr+ dsize > len(data):
                        continue
                    raw = data[dptr:dptr+dsize]
                    if raw[:4] == b"RSDS" and len(raw) >= 24:
                        guid = raw[4:20]
                        age = struct.unpack_from("<I",raw,20)[0]
                        try:
                            import uuid
                            guid_text = str(uuid.UUID(bytes_le=guid))
                        except Exception:
                            guid_text = guid.hex()
                        pdb_path = raw[24:].split(b"\0",1)[0].decode("utf-8",errors="replace")
                        codeview.append({"format":"RSDS","guid":guid_text,"age":age,"pdb_path":pdb_path})
                    elif raw[:4] == b"NB10" and len(raw) >= 16:
                        sig, age = struct.unpack_from("<II",raw,8)
                        pdb_path = raw[16:].split(b"\0",1)[0].decode("utf-8",errors="replace")
                        codeview.append({"format":"NB10","signature":f"0x{sig:08x}","age":age,"pdb_path":pdb_path})
            except Exception as e:
                codeview.append({"error":str(e)})

    return {
        "file":str(path), "size_bytes":len(data), "machine":MACHINE.get(machine,f"0x{machine:04x}"),
        "machine_hex":f"0x{machine:04x}", "format":pe_kind, "timestamp":timestamp,
        "entrypoint_rva":f"0x{entrypoint:x}", "image_base":f"0x{image_base:x}",
        "size_of_image":size_image, "sections":sections, "imports":imports,
        "delay_imports":delay_imports, "codeview":codeview,
    }

def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("game_path", help="Path to SleepingDogsDefinitiveEdition installation")
    ap.add_argument("--output", help="Output directory (default: Desktop/SleepingDogs-PE-Analysis)")
    args=ap.parse_args()
    root=Path(args.game_path).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: game folder does not exist: {root}",file=sys.stderr); return 2
    out=Path(args.output).expanduser().resolve() if args.output else Path.home()/"Desktop"/"SleepingDogs-PE-Analysis"
    out.mkdir(parents=True,exist_ok=True)
    candidates=[]
    for pattern in ("*.exe","*.dll"):
        candidates.extend(root.rglob(pattern))
    candidates=sorted(set(p for p in candidates if p.is_file()))
    results=[]
    for p in candidates:
        try: results.append(parse_pe(p))
        except Exception as e: results.append({"file":str(p),"error":str(e)})
    pdbs=sorted(str(p.relative_to(root)) for p in root.rglob("*.pdb") if p.is_file())
    (out/"pe-analysis.json").write_text(json.dumps({"game_path":str(root),"binaries":results,"pdb_files_found":pdbs},indent=2),encoding="utf-8")
    with (out/"imports.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["Binary","Machine","DLL","ImportCount","ImportedFunctions"])
        for r in results:
            if r.get("error"): continue
            for imp in r.get("imports",[]):
                w.writerow([r["file"],r["machine"],imp["dll"],imp["count"],"; ".join(imp["functions"])])
    with (out/"pdb-identifiers.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["Binary","Format","GUID","Signature","Age","EmbeddedPdbPath"])
        for r in results:
            for cv in r.get("codeview",[]):
                w.writerow([r.get("file"),cv.get("format"),cv.get("guid"),cv.get("signature"),cv.get("age"),cv.get("pdb_path")])
    lines=["SLEEPING DOGS PE INSPECTION (READ-ONLY)",f"Game folder: {root}",f"PE files scanned: {len(results)}",f"PDB files found in game folder: {len(pdbs)}","", "BINARIES"]
    for r in results:
        lines += ["",f"[{r.get('file')}]"]
        if r.get("error"):
            lines.append("ERROR: "+r["error"]); continue
        lines += [f"Machine: {r['machine']} ({r['machine_hex']}) | {r['format']}",f"Image base: {r['image_base']} | Entry point RVA: {r['entrypoint_rva']}",f"Image size: {r['size_of_image']:,} bytes", "Sections: "+", ".join(f"{s['name']} (raw {s['raw_size']:,}, VA {s['virtual_address']:#x})" for s in r['sections'])]
        lines.append("Imported DLLs: "+", ".join(i['dll'] for i in r.get('imports',[])))
        if r.get("delay_imports"): lines.append("Delay imports: "+", ".join(r["delay_imports"]))
        if r.get("codeview"):
            for cv in r["codeview"]: lines.append("CodeView/PDB: "+json.dumps(cv,ensure_ascii=False))
        else: lines.append("CodeView/PDB: no RSDS/NB10 record found")
    lines += ["", "PDB FILES FOUND:"] + (pdbs or ["None in the scanned game folder."])
    (out/"report.txt").write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(f"Inspection complete. Output: {out}")
    print(f"Scanned {len(results)} PE files. PDB files found: {len(pdbs)}")
    print("Upload report.txt, imports.csv and pdb-identifiers.csv for analysis.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
