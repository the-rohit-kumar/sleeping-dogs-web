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
