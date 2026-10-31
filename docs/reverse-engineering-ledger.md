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
| GF-08 | `CONFIRMED` | Swap Chain Creation | `0x1406a04a0` | Calls `IDXGIFactory::CreateSwapChain` (vtable +0x50), `IDXGISwapChain::GetBuffer` (+0x48), `ID3D11Device::CreateRenderTargetView` (+0x48). Swap chain stored in `DAT_142439b10`, backbuffer texture in `DAT_142439aa0`, RTV in `DAT_142439b18`. |
| GF-09 | `CONFIRMED` | Swap Chain Resize | `0x1406a14e0` | Calls `IDXGISwapChain::ResizeBuffers` (vtable +0x68) with BufferCount=2, format 0x1C (`DXGI_FORMAT_R8G8B8A8_UNORM`), flags=2. Reconstructs BackBuffer, PresentBuffer, LeftEye, RightEye targets. |
| GF-10 | `CONFIRMED` | Frame Submission & Present | `0x1406a0870` | Copies render target to backbuffer via `ID3D11DeviceContext::CopyResource` (vtable +0x178), executes `IDXGISwapChain::Present` (+0x40), checks for device loss (`0x887A0005`, `0x887A0007`), and triggers automatic device re-creation if lost. |

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
| AR-01 | `CONFIRMED` | BIX Magic Signature | `data-file-signatures.csv`, all `.bix` | `.bix` files begin with 4-byte magic `A8 40 5C 2C` (`0x2C5C40A8` in Little Endian). |
| AR-02 | `CONFIRMED` | BIX Header Layout | All 11 `.bix` files | Offset 0x00: Magic, 0x04: Payload size, 0x44: Archive name ASCII, 0x70: Entry count, 0xC0: Start of 24-byte record array. |
| AR-03 | `CONFIRMED` | 24-byte Entry Layout | All 26,894 entries across 11 archives | Offset 0: mUID, 4: mOffset in .big, 8: mPart1Size, 12: mPart2Size, 16: mPadding, 20: mTotalSpan. Invariant: `mPart1Size + mPart2Size == mTotalSpan + mPadding` verified on 100% of multi-part records (12,614/12,614). |
| AR-04 | `UNKNOWN` | Compression Codecs | BIG payloads | Exact compression algorithms (e.g., zlib, LZO, LZMA, or proprietary) to be verified from chunks. |

---

## 5. Illusion Engine Architecture (Textures & Geometry)

| ID | Status | Subject | Evidence / Address | Details |
|---|---|---|---|---|
| IL-01 | `CONFIRMED` | Rendering Namespace | RTTI in `.rdata` (`0x1420317f8`, `0x1420214d8`) | Engine graphics layer is namespaced as `Illusion::` (`Illusion::rTexture`, `Illusion::rMaterial`, `Illusion::BufferLoader`, `Illusion::TextureLoader`). |
| IL-02 | `CONFIRMED` | Compression Engine | `0x140e94000`, `0x1408e3380`, `0x141ac3781` | Statically links zlib / Deflate 1.2.7 (`deflate 1.2.7 Copyright 1995-2012 Jean-loup Gailly and Mark Adler`). Used in Autodesk Scaleform GFx UI streams and chunk decompressors. |
| IL-03 | `CONFIRMED` | `Illusion::rTexture` Header | `0x140a18e90`, `0x140a16ed0` | Offset `+0x28`: Format code (0=RGBA8, 1=BC1, 2=BC2, 3=BC3, 4=BC4, 5=BC5), `+0x30`: Width, `+0x32`: Height, `+0x34`: MipLevels, `+0x36`: Array/Depth. `+0xB4`: pixel stream. Maps 1:1 to `D3D11_TEXTURE2D_DESC`. |
| IL-04 | `CONFIRMED` | Block Compression Pitch | `0x140a18e90` lines 183-184 | RowPitch computed as `((width + 3) / 4) * blockSize`, SlicePitch as `((height + 3) / 4) * rowPitch`. 8 bytes/block for BC1, 16 bytes/block for BC2/BC3/BC5. |
| IL-05 | `CONFIRMED` | `Illusion::BufferLoader` Descriptors | `0x140a18c70`, `0x140a16e20` | Offset `-0x38`: BufferType (0=Vertex, 1=Index), `-0x34`: ByteWidth, `-0x30`: 64-bit relative data offset to raw vertex/index array. Dispatches directly to `ID3D11Device::CreateBuffer`. |
| IL-06 | `CONFIRMED` | Vertex Stream Attributes | `0x140a18c70` & `Vehicles.big` at `0x1f0a400` | Interleaved vertex buffers support 32-byte (Pos3+Norm3+UV2), 40-byte (Pos3+Norm3+Tang4+UV2), and 48-byte skinned vertex streams. Single-part archive entries store uncompressed raw geometry buffers. |
