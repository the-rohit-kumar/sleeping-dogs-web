# Antigravity Handoff — Sleeping Dogs: Definitive Edition Browser Reconstruction

**Prepared:** 31 October 2026  
**Primary objective:** Build a browser-playable reconstruction of *Sleeping Dogs: Definitive Edition*, progressing toward the complete game experience.  
**Current phase:** Feasibility, executable analysis, asset-format discovery, and graphics-pipeline reconstruction.  
**Important:** This is a handoff of the work and evidence collected so far. It is not a claim that a playable browser port or a complete engine already exists.

---

## 0. Instructions to the receiving agent

Act as the lead technical investigator and implementation engineer. Take ownership of the research, code analysis, architecture decisions, implementation, testing, and documentation. The user is a beginner in reverse engineering and does not want to spend hours manually navigating Ghidra or copying individual decompilations. **Do the heavy work autonomously wherever your environment permits.**

### Operating rules

1. **Inspect before changing.** First inspect the current workspace, repository, scripts, reports, and available game files. Do not overwrite or reorganize existing work until it has been inventoried.
2. **Do not assume local access.** The game is installed on the user's Windows machine. You may not automatically have access to that machine, its Steam directory, Ghidra database, or local MCP servers. Verify what is accessible. If it is not accessible, state the one minimal action needed to bridge the gap; do not pretend to have inspected it.
3. **Batch the work.** Prefer Ghidra scripts, headless analysis, REA/MCP, structured exports, asset scanners, and repeatable tests over one-function-at-a-time manual requests.
4. **Do not make the user perform analysis.** Give the user only short, necessary execution steps. The agent should choose the next functions, data structures, and assets to investigate.
5. **Maintain an evidence ledger.** Every important conclusion must be labelled `CONFIRMED`, `STRONG INFERENCE`, `HYPOTHESIS`, or `UNKNOWN`, with the function/address/file that supports it. Correct earlier conclusions when new evidence contradicts them.
6. **Do not overinterpret decompiler output.** Verify important indirect calls, ABI arguments, structure offsets, pointer ownership, and function boundaries in the Listing/assembly or with a second method. Ghidra's inferred prototypes and variable names are not ground truth.
7. **Build a runnable vertical slice early.** Do not spend weeks only researching. Establish a minimal browser application, renderer, asset-loading path, and automated tests as soon as the repo and asset formats allow it.
8. **Keep the user informed with concrete deliverables.** Prefer working code, scripts, test reports, diagrams, and concise summaries over repeated explanations.
9. **Do not silently broaden scope.** The full game is the long-term target. Deliver it incrementally, with a working slice at every milestone.
10. **Do not claim completion without evidence.** A feature is complete only when it builds, runs, and passes stated tests. Record limitations honestly.

### First response expected from Antigravity

After inspecting the available workspace, report:

- what files/repositories you can actually access;
- whether the game installation and Ghidra project are accessible;
- what has already been built versus what is only researched;
- the shortest end-to-end path to the first browser-rendered game asset;
- the immediate implementation tasks you will execute next.

Do not ask the user to re-explain the project. This document is the project context.

---

## 1. Product objective and success definition

### Primary objective

Create a browser-based reconstruction of **Sleeping Dogs: Definitive Edition**. The intended end state is the full experience, not merely a static scene or an asset viewer. Development should proceed through increasingly complete, testable milestones.

The original game is a Windows native executable using Direct3D 11 and proprietary game data. A browser cannot directly execute the original Windows x64 executable as-is. The practical route is to build an independent browser runtime and progressively understand/reimplement the engine systems and content formats needed to load and simulate the game.

### Target platform

- Modern desktop browsers.
- Prefer WebGPU as the primary modern graphics backend, with a considered WebGL2 fallback if useful for compatibility.
- Use Web Workers for CPU-heavy parsing, decompression, streaming, and background preparation where appropriate.
- Design for asynchronous asset loading and browser memory constraints.
- Keep the architecture modular so that game systems can be implemented incrementally.

### Milestone definition

The first meaningful milestone is **not** “the whole game runs.” It is a verified vertical slice that:

1. reads a real, locally owned game archive without modifying it;
2. parses its index and locates a selected resource;
3. decompresses/decodes that resource if the format is understood;
4. loads the result into a browser application;
5. renders it with a controllable camera or useful inspection UI;
6. includes automated tests and reproducible documentation.

The later milestones should add scene/world loading, materials, animation, audio, physics, player control, vehicles, NPCs, UI, mission/game logic, streaming, and save/state management.

### Secondary/portfolio objective

A related project concept is **REX — Reverse Engineering Explorer**, an agent-assisted reverse-engineering workflow/platform. Treat REX as supporting tooling and a separate portfolio deliverable; it must not replace the main browser-reconstruction objective. REX can automate function discovery, Ghidra analysis, cross-reference mapping, structure inference, and documentation generation.

---

## 2. User, machine, and local environment

Known setup from the user:

- OS: Windows 11.
- Game distribution: Steam.
- Game installation path:  
  `C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition`
- Hardware: approximately 16 GB RAM and a mid-tier dedicated GPU. Do not assume the exact GPU model.
- Ghidra installation: `ghidra_12.2_PUBLIC_20261016\ghidra_12.2_PUBLIC`.
- Java: Eclipse Temurin 25.0.5 was installed and `java -version` worked.
- Ghidra project: `SleepingDogs_Research`; the user later created a clean project and successfully completed auto-analysis with conservative options.
- The earlier first analysis attempt produced memory/Flow Arrow problems. A clean analysis was completed afterwards. Do not ask the user to repeat Ghidra setup unless a concrete blocker requires it.

**Access warning:** Antigravity may run in a separate workspace or agent environment. Verify access to the Windows paths above. Do not assume `/mnt/data` in this handoff environment maps to the user's Windows machine.

---

## 3. Main executable — verified facts

Executable:

`sdhdship.exe`

Installed game evidence:

- PE type: PE32+ (64-bit x86-64).
- File version reported by the audit: `1.0.000.0`.
- File size: `37,490,688` bytes.
- Image base: `0x140000000`.
- Entry point RVA: `0x12BA5B4`.
- SizeOfImage: approximately `41,308,160` bytes.

### Relevant imported APIs

The executable imports, among others:

- `d3d11.dll`
- `dxgi.dll`
- `d3dcompiler_46.dll`
- `dinput8.dll`
- `xinput9_1_0.dll`
- `winmm.dll`
- `bink2w64.dll`
- `steam_api64.dll`
- `twitchsdk_64_release`
- `winhttp.dll`, `libcurl.dll`, `wininet.dll`, `wsock32.dll`, `iphlpapi.dll`
- standard Win32 libraries including `kernel32`, `user32`, `gdi32`, `ole32`, `advapi32`, `psapi`, `secur32`, `shlwapi`, `crypt32`, and `msacm32`.

This supports a native Windows game with D3D11 rendering, input/audio/media integrations, Steam integration, and network-related functionality. An import alone does not prove a particular feature is used at runtime.

### PDB identity warning

The executable contains CodeView information:

- GUID: `39fb50f8-bf80-45cf-b459-c80373629312`
- Expected PDB age: `16`
- Embedded PDB path: `d:\ufg\madscience\project\builds\sdhd\sdhd_pc\build\project\int\sdhd-pc64-ship\sdhdship.pdb`

A PDB downloaded from SDmodding was checked:

- GUID matches the executable.
- PDB age is `15`, whereas the executable expects `16`.
- Size is approximately 230,394,880 bytes (~219.7 MiB).

**Do not treat that PDB as an exact symbol match.** It may be useful for exploratory types/symbols, but it is a near-version mismatch and must be marked as such. Prefer finding the exact age-16 PDB. Any addresses or function identities imported from the age-15 PDB must be independently validated against the executable.

---

## 4. Game installation and archive inventory

A read-only audit found approximately 248 files and 16.51 GiB in the game installation.

Important paired archive files:

| Archive | Approximate size |
|---|---:|
| `GameHD.big` | 6.07 GB |
| `Game.big` | 4.31 GB |
| `Characters.big` | 1.50 GB |
| `AnimationNIS.big` | 483 MB |
| `GameHD2.big` | 459 MB |
| `CharactersHD.big` | 413 MB |
| `UI.big` | 213 MB |
| `Vehicles.big` | 141 MB |
| `Animation.big` | 111 MB |
| `Global.big` | 61 MB |

The large audio archives include `.pck` files of roughly 2.16 GB and 993 MB. There are also `.bik` / `.bk2` video files and other game resources.

### BIG/BIX format evidence

- Game archives commonly have `.big` / `.bix` pairs.
- The BIX index begins with bytes `A8 40 5C 2C` in the inspected sample.
- Existing SDmodding BigFileSystem source indicates that index entries contain a resource UID, data offset, compressed size, uncompressed size, and compression metadata.
- A parser/tooling reference exists in the SDmodding ecosystem.

**Still unknown:** exact archive versioning, endianness rules, record layout for every archive variant, compression algorithms, resource-type mapping, hash/name resolution, and whether all archives use precisely the same index variant.

### Immediate archive-engineering tasks

1. Identify all archive/BIX variants and record their headers, record counts, offsets, and checksums.
2. Implement a strictly read-only BIG/BIX parser with robust bounds checks.
3. Add unit tests for header parsing, record parsing, offset validation, and size validation.
4. Identify compression algorithms from metadata and known samples; implement or reuse well-understood decoders only after validating the format.
5. Build an archive inspector that lists entries, types, sizes, hashes/UIDs, offsets, compression flags, and extraction status.
6. Extract only a small number of user-owned assets to a separate workspace for format analysis. Never modify the installed archives.
7. Prioritize a low-risk, easy-to-visualize resource (for example, a UI texture or simple texture) for the first browser-rendered asset.

Do not assume that an asset entry is a mesh until its header and payload have been inspected. Do not infer resource types from filenames alone.

---

## 5. Existing tools and generated evidence

The following files exist in the current handoff container. Their exact availability in Antigravity's machine must be checked rather than assumed.

| File | Purpose |
|---|---|
| `SleepingDogs-ReadOnly-Audit.ps1` | Read-only audit of the installed game files |
| `SleepingDogs-PE-Inspector.py` | PE executable inspection |
| `SleepingDogs_Graphics_Batch_Export.py` | Ghidra script intended to batch-export graphics-related functions and references |
| `report.txt` / `report(1).txt` | PE analysis summaries |
| `pe-analysis.json` | Structured PE analysis |
| `imports(1).csv` | Imported functions and modules |
| `files.csv`, `binaries.csv`, `data-file-signatures.csv`, `extension-summary.csv` | Installation inventory and file-type data |
| `pdb-identifiers.csv` | PDB identity information |
| `sdhdship.pdb` | Downloaded PDB with age mismatch (15 vs expected 16) |

The audit and PE inspector scripts are evidence-gathering utilities. Preserve read-only behavior unless a separately reviewed tool is explicitly designed to write into a new output directory.

### Batch Ghidra export

`SleepingDogs_Graphics_Batch_Export.py` was prepared to reduce manual copy/paste. The user found the Ghidra Script Manager setup too time-consuming. The preferred path now is for Antigravity to:

- inspect the script for API compatibility with Ghidra 12.2;
- use Ghidra headless analysis or a supported scripting workflow if available;
- batch-export the targeted functions, callers/callees, XREFs, imports, and relevant globals;
- produce a consolidated report for agent analysis.

Do not make the user spend time configuring the script manually if Antigravity can access the database or run a batch script itself. If it cannot, reduce this to one short, copyable operation.

---

## 6. Ghidra investigation history and findings

### 6.1 Entry/startup observations

- Entry point: `0x14012BA5B4`.
- Decompiled `entry()` called `FUN_1412d1c74()` and then `FUN_1412ba5c8()`.
- Nearby startup helpers included Windows startup show-state handling, storing a startup parameter, and calling `GetProcessHeap()`.
- These first functions were runtime/startup plumbing, not yet identified game systems.

### 6.2 Locale/runtime detour — stop unless useful

A substantial function cluster around `0x1412C...` and `0x1412D...` turned out to be locale and reference-counting infrastructure, not the game-specific renderer. Evidence included explicit `LC_COLLATE`, `LC_CTYPE`, `LC_MONETARY`, `LC_NUMERIC`, and `LC_TIME` category strings, locale parsing, category dispatch, and reference-counted locale state.

Functions examined:

- `FUN_1412c8ab4` — acquires a number of references in a 0x158-byte managed object.
- `FUN_1412c8cd8` — decrements corresponding references.
- `FUN_1412c8b40` — cleanup/destruction path.
- `FUN_1412c8df4` — reference-counted pointer replacement.
- `FUN_1412cad08` — copies 0x158 bytes, resets reference count, then acquires references.
- `FUN_1412cb1f0` — high-level locale setting/update operation.
- `FUN_1412cb560` — locale-string and category processing.
- `FUN_1412cb7cc` — per-category locale update, dispatch and rollback.
- `FUN_1412d8d2c`, `FUN_1412d9358`, `FUN_1412d96b0` — cleanup of subordinate locale-related data.
- `FUN_1412c395c`, `FUN_1412c3688`, `FUN_1412c38a0` — FLS/fiber-local context setup and cleanup.
- `FUN_1412b08e0` — wrapper around Windows process-heap deallocation, with error reporting.

One category callback at `FUN_140ef0810` simply returns zero. The locale subsystem should be treated as runtime infrastructure and not as a game asset/resource model. Do not spend more time on it unless later evidence shows a dependency.

### 6.3 Confirmed graphics call sequence

The graphics initialization sequence observed in `FUN_14069f9e0()` is:

```text
FUN_1406a0dd0()
CreateDXGIFactory1(...)
FUN_14069f240()      // enumerate adapters, outputs and display modes
FUN_1406a1e80()      // select an adapter/output and inspect vendor/device ID
FUN_1406a2050()      // initialize/update display configuration
...                  // optional stereo initialization
D3D11CreateDevice(...)
...                  // feature-level checks, optional stereo setup,
                     // QueryInterface, GPU timing query creation
```

This chain is directly relevant to porting the graphics initialization concepts to a browser runtime.

### 6.4 `FUN_14069f240()` — DXGI enumeration

Observed from decompilation:

- Uses the DXGI factory vtable call at `+0x60` to enumerate adapters (consistent with `IDXGIFactory1::EnumAdapters1`).
- For each adapter, calls vtable `+0x48` (consistent with `IDXGIAdapter::CheckInterfaceSupport`) and `+0x50` (consistent with `IDXGIAdapter1::GetDesc1`). The GUID passed to `CheckInterfaceSupport` is at `0x1417f9e88`; its exact identity is unresolved.
- Enumerates output objects using adapter vtable `+0x38` (consistent with `IDXGIAdapter::EnumOutputs`).
- Calls output vtable `+0x38` (consistent with `IDXGIOutput::GetDesc`) and `+0x40` (consistent with `IDXGIOutput::GetDisplayModeList`).
- Queries display modes with format `0x1C` (`DXGI_FORMAT_R8G8B8A8_UNORM`) and flags `3` (consistent with interlaced and scaling enumeration flags), first obtaining count and then allocated mode records.
- The display-mode record size passed to the allocator is `0x1C`, consistent with `DXGI_MODE_DESC` size.
- Stores enumerated adapters and outputs in dynamically growing arrays.
- Computes a width/height ratio from the last mode in the first output's mode list; why this exact mode is selected is not yet known.

Inferred custom adapter-record layout (validate against field writes):

| Offset | Inferred field |
|---:|---|
| `0x000–0x137` | `DXGI_ADAPTER_DESC1` (0x138 bytes) |
| `0x138` | Adapter interface pointer |
| `0x140` | Adapter enumeration index |
| `0x144` | First output index |
| `0x148` | Number of outputs |

Inferred output-record layout (validate against field writes):

| Offset | Inferred field |
|---:|---|
| `0x000–0x05F` | `DXGI_OUTPUT_DESC` (0x60 bytes) |
| `0x060` | Output interface pointer |
| `0x068` | Parent adapter index |
| `0x06C` | Number of display modes |
| `0x070` | Pointer to display-mode array |

Relevant globals:

- `DAT_142439bf0` — output/monitor records.
- `DAT_142439be8` — output-record count.
- `DAT_142439bec` — output-record capacity.
- `DAT_14243a3a8` — adapter records.
- `DAT_14243a3a0` — adapter-record count.
- `DAT_14243a3a4` — adapter-record capacity.
- `DAT_14209344c` — aspect-ratio-like value derived from a display-mode record.

These layouts are strong inferences from the code and standard DXGI structure sizes, not yet formalized Ghidra data types.

### 6.5 `FUN_1406a1e80()` — adapter/output selection

Observed behavior:

- Resets `DAT_142439af8`, `DAT_142439b00`, and `DAT_142439adc`.
- Iterates over adapter records until it finds one whose output count at record offset `0x148` is nonzero.
- Selects that adapter's interface pointer at offset `0x138` into `DAT_142439af8`.
- Selects the first output associated with that adapter, using the first-output index at `0x144` and the output array; stores output interface pointer in `DAT_142439b00` and output index in `DAT_142439adc`.
- No ranking by video memory or performance is visible in this function. The observed rule is the first enumerated adapter with at least one output. Other code may later change the selected adapter; a second writer to the adapter global exists at `0x1406a1efb` and has not yet been investigated.
- Checks `VendorId == 0x1002` (AMD) and compares the `DeviceId` against an internal table beginning at `0x1417f9cc0`. It sets `_DAT_14243a328` to 1 for a match and 2 if no match is found. The meaning of these values remains unknown; do not infer a compatibility policy without tracing uses.
- Reads/copies additional adapter description and monitor information into globals.

### 6.6 `FUN_1406a2050()` — display settings

Observed behavior:

- Calls `FUN_14069ed80()` and `FUN_14069e790()` against global display configuration (`DAT_14243a2d0` and related fields).
- If the initial setup path does not return `1`, constructs a local configuration using the selected output's `DXGI_OUTPUT_DESC::DesktopCoordinates` when `AttachedToDesktop` is nonzero:
  - width = Right − Left
  - height = Bottom − Top
- It tries up to four progressively modified configurations through `FUN_14069ed80()`. Some fields are set to `0xFFFFFFFF` during fallback.
- Under critical section `DAT_14243a370`, it copies a new configuration from `DAT_142439b20`, calls `FUN_14069e790()`, and sets `DAT_142439a93 = 1` if width/height changed.

**Unknown:** precise meanings of `FUN_14069ed80`, `FUN_14069e790`, local config fields, fullscreen/windowed/borderless modes, and what `DAT_142439a93` triggers. Do not label these fallback attempts as fullscreen or windowed without examining those helpers and callers.

### 6.7 `FUN_14069f9e0()` — D3D11 device initialization

The decompilation includes this call:

```cpp
D3D11CreateDevice(
    DAT_142439af8,       // selected DXGI adapter
    0,                   // D3D_DRIVER_TYPE_UNKNOWN
    0,                   // Software module = NULL
    0x20,                // D3D11_CREATE_DEVICE_BGRA_SUPPORT
    0,                   // pFeatureLevels = NULL
    0,                   // FeatureLevels = 0
    7,                   // D3D11_SDK_VERSION
    &DAT_142439ae0,      // ID3D11Device output
    local_res10,         // selected feature level output
    &DAT_142439ae8       // ID3D11DeviceContext output
);
```

Confirmed interpretation:

- Uses selected DXGI adapter with `D3D_DRIVER_TYPE_UNKNOWN`.
- Enables `D3D11_CREATE_DEVICE_BGRA_SUPPORT` (`0x20`).
- Uses default feature-level list by passing a null array and zero count.
- Uses SDK version 7 (`D3D11_SDK_VERSION`).
- Stores device and immediate context in globals.
- Rejects feature levels below `0xA000` (10.0).
- Sets an internal capability tier based on returned feature level: below 10.1 => 0; 10.1 but below 11.0 => 1; 11.0+ => 2. The code as decompiled compares against `0xA0FF` and `0xB000`.

Additional paths:

- Detects an NVIDIA stereo capability path using helpers `FUN_140e9aa80()` and `FUN_140e9b930()`, then can construct an `NVStereo3D` object. Otherwise it constructs a fallback stereo object using `FUN_14069e5b0()`. Exact helper meanings and behavior remain to be verified.
- Calls the D3D device's `QueryInterface` with GUID at `0x1417f9ea8`; exact target interface is unknown.
- Makes six calls through the device vtable slot at `+0xC0`. The query descriptors use numeric types `3` and `2`, consistent with `D3D11_QUERY_TIMESTAMP_DISJOINT` and `D3D11_QUERY_TIMESTAMP`. The loop appears to create two disjoint queries and four timestamp queries (two groups, each with one disjoint and two timestamps). Verify output storage and HRESULT handling before treating this as final.
- No swap-chain creation or presentation is visible in this function.

### 6.8 Import-thunk note

The import xref at `0x140e9aa4c` was initially opened as if it were the game function. That was an import thunk, not the actual caller. The real caller is `FUN_14069f9e0()`; the `D3D11CreateDevice` call is visible in its decompilation. Do not repeat this misstep with other imports: always follow the call site into its containing function.

---

## 7. Graphics investigation — highest-priority next steps

The next work should finish the graphics initialization path without spending time on unrelated runtime code.

### Priority A — finish display configuration

Investigate in batch:

1. `FUN_14069ed80()` — called repeatedly with display configuration structures; likely validates/chooses/applies a configuration. Determine its exact fields, return semantics, and side effects.
2. `FUN_14069e790()` — called after configuration selection and update; determine whether it stores, applies, or propagates display settings.
3. All callers and callees of both helpers.
4. The code that sets and consumes `DAT_142439b20` and `DAT_142439a93`.

Output required: named display-config structure with offsets, field meanings, valid modes, default/fallback behavior, and evidence.

### Priority B — discover swap chain and presentation

Search imports, call sites, vtable calls, and XREFs for:

- `IDXGIFactory::CreateSwapChain` or `IDXGIFactory2::CreateSwapChainForHwnd` / `CreateSwapChainForCoreWindow`;
- `IDXGISwapChain::Present` / `Present1`;
- `ResizeBuffers`;
- `GetBuffer`;
- `D3D11CreateDeviceAndSwapChain` (if imported or referenced);
- render-target view creation (`ID3D11Device::CreateRenderTargetView`);
- depth-stencil texture/view creation;
- viewport setup (`RSSetViewports`);
- render loop / frame submission.

COM methods may be called through vtables and will not necessarily appear as ordinary imported functions. Identify the interface object and vtable slot from SDK headers or type information, then validate the slot and arguments in assembly.

Output required: a call graph from window creation through swap-chain creation, backbuffer/depth target setup, frame rendering, and `Present`.

### Priority C — render pipeline

Locate and map:

- shader compilation/loading;
- vertex and index buffer creation;
- input layouts;
- texture and sampler creation;
- constant buffers;
- rasterizer, blend, depth-stencil states;
- render passes / post-processing / HDR / anti-aliasing;
- resolution changes and swap-chain resize handling;
- GPU timing query begin/end/readback;
- device-lost and resize recovery.

Use imports plus vtable method recognition and string/XREF searches. Batch decompile call graphs rather than asking the user for each function.

### Priority D — identify the game's own renderer boundary

Separate generic D3D11 wrapper functions from engine renderer systems. Follow actual call stacks and global state into functions that issue draw calls. Identify:

- draw submission (`Draw`, `DrawIndexed`, instanced variants);
- command batching / render queues;
- world geometry path;
- material and shader systems;
- texture streaming;
- shadow, lighting, post-processing paths.

Build a renderer architecture diagram and data-flow document.

---

## 8. Broader reverse-engineering priorities

Do not restrict the work to graphics. The end-state browser reconstruction will need multiple systems. Prioritize discovery based on dependencies and asset evidence.

Suggested subsystem order:

1. **Archive/index/resource identification** — required to access all other systems.
2. **Texture/material decoding** — quickest route to visible content.
3. **Mesh/geometry decoding** — enables static scenes.
4. **Scene/world streaming and transforms** — enables world rendering.
5. **Camera and input** — enables interaction.
6. **Animation and skeletons** — characters and moving objects.
7. **Audio and video** — use PCK/Bink formats and appropriate playback/transcoding strategies.
8. **Physics and collision** — world interaction, vehicles, ragdolls.
9. **Gameplay systems** — player state, NPCs, combat, vehicles, missions, progression, UI.
10. **Save/state and streaming robustness** — persistence, long sessions, memory budgets.

For every subsystem, maintain a feature inventory with dependencies, known file types, functions, structures, algorithms, and unknowns.

---

## 9. Browser implementation architecture — recommended starting point

Do not commit to a full rewrite in a particular language until the current project repository has been inspected. The design should, however, keep the following boundaries.

### 9.1 Suggested components

```text
browser-client/
  app/                     # UI, menus, developer/asset inspector
  renderer/                # WebGPU backend; optional WebGL2 fallback
  runtime/                 # frame loop, scene graph, transforms, camera
  input/                   # keyboard, mouse, gamepad abstraction
  audio/                   # Web Audio backend and streamed audio
  streaming/               # prioritized async IO, prefetch, LRU cache
  assets/
    big-bix/               # read-only archive parser
    decompression/         # verified codecs
    textures/              # texture resource decoder
    meshes/                # geometry decoder
    animation/             # skeleton/animation decoder
    materials/             # material and shader metadata
  workers/                 # CPU-heavy decoding / parsing workers
  tests/
  docs/
```

This is a conceptual layout, not a requirement to refactor an existing repository to match it.

### 9.2 Core constraints

- Keep archive parsing separate from browser rendering.
- Keep original game assets immutable. Use a separate cache/extraction directory.
- Avoid loading multi-gigabyte archives into one JavaScript ArrayBuffer. Prefer random-access file reads, streaming, and index-only loading.
- Define explicit resource lifetimes and GPU disposal. The original game has complex reference counting, but the browser implementation may use a simpler explicit handle/cache model.
- Make all asset decoders pure/testable where possible.
- Treat unknown fields as unknown; preserve raw bytes and metadata for future decoders.
- Use workers for decompression and large CPU-side conversions; do not block the render thread.
- Establish a stable resource-ID abstraction even if source IDs are hashes or internal UIDs.
- Log decode failures with resource UID, archive, offset, compressed size, uncompressed size, flags, and codec guess.
- Add progressive loading, cancellation, and memory budgets.

### 9.3 First vertical slice acceptance criteria

A good first milestone should:

- open an archive without writing to it;
- parse and validate its index;
- list its resource count and metadata;
- select one supported texture or mesh;
- decode it with a verified decoder;
- render it in browser with a camera or inspectable preview;
- display the source resource ID and technical metadata;
- include test fixtures and corruption/bounds tests;
- document the decoder assumptions and known gaps.

If no real asset format is yet decodable, build the viewer and renderer with a procedural test asset while continuing archive analysis. Do not block all implementation on complete reverse engineering.

---

## 10. Reference projects studied previously

These are architecture references, not permission to copy code or proprietary game assets. Recheck their current licensing and repository state before reusing anything.

- **OpenMW-Web** — `https://github.com/Virtastic/openmw-web`  
  Useful reference for porting a C++ game engine to WebAssembly, browser-specific adaptations, asynchronous asset access/streaming, and browser storage. Earlier study notes: retains most of original C++ engine; Emscripten build; WebGL2 due to the OpenSceneGraph stack; worker-assisted streaming and browser filesystem integration. Use as an architecture study, not a drop-in engine.
- **reVC Web** — `https://github.com/origami-ltd/wasm-revc`  
  Useful reference for adapting a reverse-engineered C++ game engine with Emscripten and GLES-to-WebGL. Earlier notes flagged special MIT-PoU/custom terms and separate upstream engine licensing; examine the exact license before reuse.
- **OpenLara** — `https://github.com/XProger/OpenLara`  
  Useful browser-oriented game-engine reference, especially WebGL rendering and asset/runtime separation.
- **WebXash** — investigate upstream repository and current docs for browser client, input, cache and filesystem references.
- **Grand-V / GTA V browser project** and **Cyberpunk2077.lol** were previously studied as examples of browser-based high-end game demonstrations. The earlier review did not verify that either exposed the original proprietary engine source. Do not use them as proof that Sleeping Dogs can be ported by simply running its executable in a browser.

### Important prior conclusions

- Browser game demonstrations may use streaming, workers, WebAssembly, WebGPU/WebGL, and local caching, but each project must be evaluated independently.
- Do not assume an unofficial web port uses the original engine or that its source is reusable.
- The original Sleeping Dogs game code and content remain proprietary unless a specific asset/code license says otherwise.

---

## 11. Legal, licensing, and safety boundaries

This is a technical research and reconstruction project. Keep these boundaries explicit:

- Assume the user is working from a legally obtained local copy of the game.
- Do not distribute the original executable, PDB, proprietary game archives, extracted copyrighted models, textures, music, dialogue, videos, or other game assets.
- Do not upload proprietary game files to third-party services or public repositories.
- Keep local asset extraction and derived caches out of public Git repositories. Add appropriate ignore rules.
- Do not bypass DRM, Steam authentication, encryption, or access controls. Do not write tools whose purpose is to defeat access controls.
- Do not assume reverse engineering or asset reuse is legally permitted in every jurisdiction or under the game's EULA. The user should obtain qualified legal advice for distribution/commercial plans.
- Prefer independently implemented code and clean-room documentation of observable formats/behavior. When studying open-source reference projects, respect their license and attribution requirements.
- Public portfolio artifacts should focus on the agent tooling, architecture, parsers written independently, synthetic test fixtures, and original code. Never publish extracted game content without permission.

---

## 12. REA / MCP automation track

Project references:

- REA source: `https://github.com/morluto/rea`
- REA documentation: `https://rea.tools/`

Previous research described REA as an MCP server/CLI that exposes native binary analysis capabilities for agents, working with an underlying analysis provider such as Ghidra. It is not a replacement for Ghidra.

### Current status

- REA has **not** been connected to the user's Ghidra project in this chat.
- No successful REA MCP session has been demonstrated.
- The user has Ghidra 12.2, while earlier documentation review indicated Windows Ghidra support may be experimental and the verified configuration may target an earlier Ghidra 12.1 line. Re-check upstream documentation before installation.
- The user's Codex/Antigravity environment may differ. Confirm which MCP client and runtime are available.

### Desired automation capability

The agent should be able to:

- enumerate functions and imports;
- decompile a function by address/name;
- list callers, callees, and XREFs;
- inspect data references and global reads/writes;
- search strings and constants;
- identify COM vtable call patterns;
- export structs, function signatures, and call graphs;
- run controlled Ghidra scripts or headless analysis;
- preserve source addresses and evidence citations in generated reports.

If REA is not compatible, use Ghidra's headless analyzer and scripting API as an interim batch path. Do not make the user manually open dozens of functions.

---

## 13. Repository and engineering standards

Before implementation, inspect whether a project repository already exists. Preserve it if present.

Required engineering hygiene:

- Use Git; create a baseline commit or branch before major changes.
- Add a `README` with exact setup/build/run commands.
- Add `docs/architecture.md`, `docs/reverse-engineering-ledger.md`, `docs/asset-formats.md`, and `docs/roadmap.md`.
- Keep raw observations separate from interpretation.
- Use typed data structures for archive entries and decoded resources.
- Add fuzz/bounds tests to parsers; malformed archive data must not cause out-of-bounds reads or unbounded allocations.
- Add deterministic fixtures based on synthetic data where proprietary assets cannot be committed.
- Add benchmarks for index parsing and decompression.
- Track memory usage and decode time for large resources.
- Keep console output and logs actionable.
- Use reproducible package versions and lockfiles.
- Keep game paths configurable; never hardcode the Steam path into production code.
- Do not build destructive extraction or patching features into a read-only inspector by accident.

---

## 14. Immediate execution plan for Antigravity

Work through these tasks in order and produce artifacts for each.

### Task 1 — Workspace and artifact audit

- Inspect the current workspace and repository.
- Locate the game-installation audit artifacts and PE reports if available.
- Locate the Ghidra project or determine whether it is inaccessible.
- Identify existing code and avoid duplicating completed work.
- Produce `docs/current-state.md` with files, tools, build status, and verified blockers.

### Task 2 — Batch reverse-engineering export

- Validate `SleepingDogs_Graphics_Batch_Export.py` against Ghidra 12.2 API.
- Prefer headless/batch execution if the Ghidra database can be accessed.
- Export all functions in the graphics initialization call chain plus callers/callees/XREFs and global read/write references.
- Search globally for swap-chain creation, `Present`, `ResizeBuffers`, render-target setup, and draw calls.
- Export the data behind the second writer to `DAT_142439af8` at `0x1406a1efb`.
- Produce one consolidated `graphics-research.md` with addresses, signatures, pseudocode, and confidence ratings.

### Task 3 — Finish the graphics pipeline map

- Resolve `FUN_14069ed80` and `FUN_14069e790`.
- Find swap-chain construction, backbuffer, depth buffer, viewport, render targets, and presentation.
- Identify the frame loop and first major game-specific render submission path.
- Produce a Mermaid diagram and a table of the graphics lifecycle.

### Task 4 — BIG/BIX parser proof of concept

- Identify a representative BIG/BIX pair and verify its header and index record layout.
- Implement parser with bounds checking and tests.
- Do not modify source archives.
- Produce a CLI report listing first N entries and validating offsets/sizes.
- Identify one small texture or other easy resource suitable for first browser visualization.

### Task 5 — Browser shell and renderer

- Inspect existing repo; if none exists, bootstrap a minimal modern web client using a maintainable stack.
- Build a minimal WebGPU renderer and a WebGL2 fallback only if needed by the target compatibility plan.
- Implement a resource-inspector UI and async loading pipeline.
- Render a procedural test asset first, then the first verified game resource.
- Add a basic camera and keyboard/mouse controls.

### Task 6 — Feasibility report and milestone roadmap

After the first vertical slice, provide an honest feasibility assessment for full-game reconstruction. Estimate complexity by subsystem, not by a simplistic single completion date. Identify the biggest unknowns and the dependencies that could block progress.

---

## 15. Known mistakes to avoid

1. **Do not continue reverse-engineering the locale subsystem** as though it were the game renderer. The `LC_*` string/category evidence marks it as runtime locale infrastructure.
2. **Do not call an import thunk the real implementation.** The `D3D11CreateDevice` thunk at `0x140e9aa4c` led to misleading recursive pseudocode; the actual caller was `FUN_14069f9e0()`.
3. **Do not claim the graphics path is complete.** Device creation is known; swap chain, presentation, actual frame rendering, and game-specific renderer internals remain to be mapped.
4. **Do not label display modes prematurely.** `FUN_1406a2050()` uses helper functions whose semantics remain unknown.
5. **Do not infer gameplay subsystem meaning from generic refcounting or cleanup.** Establish the owning subsystem through constructors, callers, strings, and data flow.
6. **Do not trust the age-15 PDB as an exact match** for an executable expecting age 16.
7. **Do not assume a public browser port of another game proves source or asset compatibility for Sleeping Dogs.**
8. **Do not require the user to hand-copy function pseudocode one function at a time.** Automate it.

---

## 16. Current state summary

### Confirmed

- Original executable is 64-bit Windows PE and imports D3D11/DXGI.
- DXGI adapter/output/display-mode enumeration exists.
- The game selects an adapter/output before D3D11 device creation.
- The observed selection function takes the first enumerated adapter with at least one output; another writer exists and must be checked.
- D3D11 device creation requests BGRA support and requires at least feature level 10.0.
- The game has optional NVIDIA stereo-related code and creates GPU timestamp/disjoint query objects.
- Display configuration is set up/updated between adapter selection and D3D11 device creation.
- Large BIG/BIX archives and PCK audio files are present in the local game installation.
- The user has a working Ghidra 12.2 project with auto-analysis completed.

### Strong inferences

- The observed record layouts match standard `DXGI_ADAPTER_DESC1`, `DXGI_OUTPUT_DESC`, and `DXGI_MODE_DESC` structures with custom metadata appended.
- The adapter/output enumeration uses standard DXGI methods based on COM vtable slots.
- The six D3D query creations are two timestamp-disjoint queries and four timestamp queries.
- The earlier `0x1412C...` function cluster is CRT locale/runtime code rather than a game-specific resource system.

### Unknown / unresolved

- Exact PDB age-16 symbol file.
- Exact meaning of the DXGI `CheckInterfaceSupport` GUID.
- Reason for the AMD device-ID table and `_DAT_14243a328` values.
- What the second writer at `0x1406a1efb` does.
- Exact semantics of `FUN_14069ed80` and `FUN_14069e790`.
- Swap-chain creation and configuration.
- Present/frame loop and render submission path.
- Game-specific renderer architecture and resource formats.
- Complete BIG/BIX layout variants and compression algorithms.
- Texture, mesh, animation, material, audio, and scene format specifications.
- Whether there is an existing implementation repo and its current state.
- REA compatibility with the user's Ghidra 12.2 installation.

### Not yet built / not demonstrated

- No complete browser game.
- No proven browser renderer using original Sleeping Dogs assets.
- No verified BIG/BIX production parser.
- No verified asset decoder.
- No successful REA-to-Ghidra MCP connection.
- No verified browser world/scene loader.

---

## 17. Final instruction

Take ownership of the project from this point. Start by auditing the workspace and available artifacts, then automate the Ghidra investigation and implement the first end-to-end browser vertical slice. Keep the scope focused on the **actual objective: a browser-playable Sleeping Dogs reconstruction**. Use reverse engineering to reduce uncertainty, not as an end in itself. Preserve all evidence, distinguish fact from inference, minimize manual work for the user, and deliver working increments with tests and documentation.
