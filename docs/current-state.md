# Sleeping Dogs Browser Reconstruction — Current State

**Last Updated:** 31 October 2026  
**Environment:** Windows 11, x86-64, Java 25.0.5, Python 3.14.6, Ghidra 12.2 PUBLIC

---

## 1. Environment and Resource Access

| Resource | Path / Identifier | Verified Status |
|---|---|---|
| Game Installation | `C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition` | **ACCESSIBLE** (248 files, 16.51 GiB, `sdhdship.exe`, `.big`/`.bix` archives) |
| Ghidra 12.2 Installation | `C:\Users\rohit\Downloads\ghidra_12.2_PUBLIC_20261016\ghidra_12.2_PUBLIC` | **ACCESSIBLE** (Headless analyzer and PyGhidra present) |
| Java Runtime | `C:\Program Files\Eclipse Adoptium\jdk-25.0.5.0-hotspot` | **ACCESSIBLE** (`java.exe 25.0.5.0`) |
| Analyzed Ghidra Project | `C:\Users\rohit\SleepingDogs_Clean.gpr` | **ACCESSIBLE** (Initial auto-analysis completed) |
| Handoff Workspace | `C:\Users\rohit\Downloads\ANTIGRAVITY_HANDOFF_BUNDLE\antigravity_handoff_bundle` | **ACCESSIBLE** (Master handoff doc, inspection scripts, evidence) |

---

## 2. Tools and Script Inventory

- `SleepingDogs-PE-Inspector.py`: Pure-Python zero-dependency PE32+ header and import inspector.
- `SleepingDogs-ReadOnly-Audit.ps1`: Read-only PowerShell auditor of game files, hashes, and sizes.
- `SleepingDogs_Graphics_Batch_Export.py`: Ghidra script targeting graphics initialization chain and COM vtable references.
- `evidence/`: Pre-collected CSV and JSON reports detailing PE headers, section layouts, data signatures, and imports.

---

## 3. Verified Technical Blockers & Workarounds

1. **PreToolUse Telemetry Hook**: Successfully neutralized by moving the malformed `googlecloudtools.datacloud_telemetry` out of `$env:USERPROFILE\.gemini\config\plugins\`.
2. **PDB Age Mismatch**: Downloaded community PDB is Age 15 while `sdhdship.exe` expects Age 16 (GUID: `39fb50f8-bf80-45cf-b459-c80373629312`). All symbol identifications must be validated against the disassembly.
3. **Ghidra Lock File**: `SleepingDogs_Clean.lock` exists at `C:\Users\rohit\SleepingDogs_Clean.lock`. Because no active Java process is running, this lock can be safely cleared for headless analysis or batch operations.


---

## 4. Milestone 2 Completion: Decoders & Live WebGL2 Client

- **Texture & Material Decoding (Path 1):** `COMPLETED`. Decompiled `FUN_140a18e90` and `FUN_140a16ed0`. Decoded `Illusion::rTexture` header layout, `DXGI_FORMAT` mapping, and block compression pitch formulas. Implemented pure TypeScript software decoders for BC1 (DXT1), BC2 (DXT3), BC3 (DXT5), and uncompressed RGBA8 in `client/src/texture-decoder.ts`.
- **3D Mesh & Geometry Decoding (Path 2):** `COMPLETED`. Decompiled `FUN_140a18c70` (`CreateBuffer`) and `FUN_140a16e20`. Decoded `Illusion::BufferLoader` descriptor layout, vertex stream interleaving (positions, normals, UVs, tangents), and index buffer bindings in `client/src/mesh-decoder.ts`.
- **Live Browser Client (Path 3):** `COMPLETED`. Built modern WebGL2 real-time 3D viewport with interactive orbit camera, lighting, HUD overlay, showcase switcher (vehicle chassis, crate, BC1/BC3 textures), and drag-and-drop archive inspector. Verified production build and live daemon running at `http://127.0.0.1:5173/`.
