# Reverse Engineering Evidence Ledger

This ledger tracks verified technical facts, inferences, hypotheses, and unknowns regarding the *Sleeping Dogs: Definitive Edition* executable (`sdhdship.exe`) and data formats.

---

## Confidence Level Definitions

- **`CONFIRMED`**: Directly verified in disassembly, assembly instructions, PE headers, or binary file parsing.
- **`STRONG INFERENCE`**: Consistently supported by struct alignments, API call parameters, and standard SDK definitions (e.g. DXGI/D3D11 COM vtable layouts).
- **`HYPOTHESIS`**: Plausible interpretation of code or data patterns requiring further cross-referencing.
- **`UNKNOWN`**: Unresolved area requiring active reverse engineering.

---

## 1. Executable and Runtime Facts

| ID | Status | Subject | Evidence / Address | Details |
|---|---|---|---|---|
| PE-01 | `CONFIRMED` | Architecture | PE Header (`sdhdship.exe`) | PE32+ (64-bit AMD64), Image Base `0x140000000`, Entry Point RVA `0x12BA5B4`. Size: 37,490,688 bytes. |
| PE-02 | `CONFIRMED` | Graphics API | `imports.csv` | Imports `d3d11.dll`, `dxgi.dll`, and `d3dcompiler_46.dll`. |
| PE-03 | `CONFIRMED` | CodeView PDB | Debug Directory | GUID `39fb50f8-bf80-45cf-b459-c80373629312`, Age `16`. Embedded path: `d:\ufg\madscience\project\builds\sdhd\sdhd_pc\build\project\int\sdhd-pc64-ship\sdhdship.pdb`. |
| PE-04 | `CONFIRMED` | PDB Mismatch | `pdb-identifiers.csv` | Downloaded community PDB is Age `15`. Mismatch; must not be treated as ground truth for addresses. |

---

## 2. Graphics Pipeline Initialization

| ID | Status | Subject | Evidence / Address | Details |
|---|---|---|---|---|
| GF-01 | `CONFIRMED` | Adapter & Output Enum | `0x14069f240` | Uses `IDXGIFactory1::EnumAdapters1` (vtable +0x60) and `IDXGIAdapter::EnumOutputs` (vtable +0x38). Queries mode format `0x1C` (`DXGI_FORMAT_R8G8B8A8_UNORM`). |
| GF-02 | `STRONG INFERENCE` | Adapter Record Layout | `0x14069f240` | Offset `0x000`:`DXGI_ADAPTER_DESC1` (0x138 bytes), `0x138`: adapter ptr, `0x140`: index, `0x144`: first output idx, `0x148`: output count. |
| GF-03 | `STRONG INFERENCE` | Output Record Layout | `0x14069f240` | Offset `0x000`:`DXGI_OUTPUT_DESC` (0x60 bytes), `0x060`: output ptr, `0x068`: parent adapter idx, `0x06C`: mode count, `0x070`: mode array ptr. |
| GF-04 | `CONFIRMED` | Adapter Selection | `0x1406a1e80` | Iterates adapter records, selects first adapter with `output_count > 0` (`0x148`). Stores adapter in `DAT_142439af8` and output in `DAT_142439b00`. |
| GF-05 | `CONFIRMED` | D3D11 Device Creation | `0x14069f9e0` | Calls `D3D11CreateDevice` with selected adapter `DAT_142439af8`, `D3D_DRIVER_TYPE_UNKNOWN`, flags `0x20` (`BGRA_SUPPORT`), SDK Version `7`. Device stored in `DAT_142439ae0`, context in `DAT_142439ae8`. |
| GF-06 | `CONFIRMED` | Feature Level Floor | `0x14069f9e0` | Rejects feature levels below `0xA000` (Direct3D 10.0). Tiers: <10.1 => 0, 10.1..<11.0 => 1, >=11.0 => 2. |
| GF-07 | `STRONG INFERENCE` | GPU Timing Queries | `0x14069f9e0` | Creates two disjoint queries (`D3D11_QUERY_TIMESTAMP_DISJOINT`, type 3) and four timestamp queries (`D3D11_QUERY_TIMESTAMP`, type 2) via device vtable slot `+0xC0`. |
| GF-08 | `UNKNOWN` | Swap Chain Creation | Global search needed | Swap chain creation call site and presentation loop (`IDXGISwapChain::Present`) not yet mapped. |

---

## 3. Discarded Dead-Ends & Isolated Code

| ID | Status | Subject | Evidence / Address | Details |
|---|---|---|---|---|
| RT-01 | `CONFIRMED` | CRT Locale Detour | `0x1412c8...` - `0x1412d9...` | Confirmed to be standard MSVC CRT locale management (`LC_COLLATE`, `LC_CTYPE`, `LC_MONETARY`, fiber-local storage). Not engine renderer code. |
| RT-02 | `CONFIRMED` | Import Thunk Trap | `0x140e9aa4c` | `D3D11CreateDevice` import thunk; actual calling logic is in `FUN_14069f9e0()`. |

---

## 4. Archive Formats (BIG / BIX)

| ID | Status | Subject | Evidence / Address | Details |
|---|---|---|---|---|
| AR-01 | `CONFIRMED` | BIX Magic Signature | `data-file-signatures.csv`, `PrefabData.bix`, `Global.bix` | `.bix` files begin with 4-byte magic `A8 40 5C 2C` (`0x2C5C40A8` in Little Endian). |
| AR-02 | `CONFIRMED` | BIX Size Fields | `PrefabData.bix`, `Global.bix` | Bytes 4-7 and 8-11 encode the index payload byte length (Total File Size - 16 bytes). |
| AR-03 | `STRONG INFERENCE` | Index Record Content | SDModding references & hex audit | Entries contain resource UID / name hash, offset in `.big`, compressed size, uncompressed size, and compression flags. |
| AR-04 | `UNKNOWN` | Compression Codecs | BIG payloads | Exact compression algorithms (e.g., zlib, LZO, LZMA, or proprietary) to be verified from chunks. |
