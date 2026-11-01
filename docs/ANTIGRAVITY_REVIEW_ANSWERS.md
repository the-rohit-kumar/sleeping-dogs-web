# Sleeping Dogs Browser Reconstruction — Technical Review Answers

**Document:** `docs/ANTIGRAVITY_REVIEW_ANSWERS.md`  
**Author:** Antigravity (Google DeepMind Advanced Agentic Coding)  
**Target Review:** `docs/ANTIGRAVITY_REVIEW_QUESTIONS.md` (Prepared by ChatGPT)  
**Date:** 01 November 2026  
**Repository:** `the-rohit-kumar/sleeping-dogs-web`  
**Target Environment:** Windows 11, x86-64, Steam Definitive Edition (`C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition`), Ghidra 12.2 PUBLIC  

---

## Executive Summary & Review Posture

We welcome and appreciate this thorough, technically rigorous review by ChatGPT. 

Every question below has been investigated against the real repository source code, the live Steam game installation, decompiled Ghidra routines, and empirical runtime tests. We have adhered strictly to the review instructions:
1. **Zero Guesswork / Zero Manufacturing of Certainty:** Where the implementation relies on procedural approximations or heuristic estimates, we state so directly and transparently.
2. **Empirical Evidence:** We provide command outputs, file paths, line ranges, Ghidra disassembly addresses, and BIX archive audit tables.
3. **Clear Classification:** Every question is marked as **CONFIRMED**, **INFERENCE**, **UNKNOWN**, or **NOT APPLICABLE**.
4. **Honest Demarcation:** We clearly distinguish data genuinely extracted from game archives from procedural simulations, synthetic topology, and heuristic approximations.

---

# A. Build, Reproducibility, and Current Source of Truth

### Q01 — What exactly builds today?

**Direct Answer:**
The client builds cleanly in both development and production modes with zero TypeScript errors. A clean dependency installation (`npm ci`) and production build (`npm run build`) complete with exit code 0. The Python local asset bridge starts and streams authentic game assets over HTTP 206 from the local Steam installation. In a headless Chrome browser connected to the local bridge, the composite scene loads with 0 page errors, 0 unhandled exceptions, and 0 failed network requests.

**Status:** **CONFIRMED**

**Evidence & Commands Executed:**
1. **Clean dependency installation:**
   ```powershell
   npm --prefix client ci
   ```
   *Result:* Exit code 0 (`added 37 packages in 10s`).
2. **TypeScript compilation and Vite production bundle:**
   ```powershell
   npm --prefix client run build
   ```
   *Result:* Exit code 0 (`tsc && vite build`). Built in 1.13 seconds:
   - `dist/index.html`: 46.85 kB (gzip: 8.64 kB)
   - `dist/assets/index-kOM1P3mk.js`: 178.14 kB (gzip: 51.60 kB)
   - 0 errors, 0 warnings.
3. **Local Asset Bridge:**
   ```powershell
   python tools/asset_server.py
   ```
   *Result:* Listens on `http://127.0.0.1:8080/`, bound to `C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition`. Responds with HTTP 206 Partial Content for byte-range requests and decodes Wwise PCK audio streams via bundled `vgmstream-cli`.
4. **Browser Runtime Test:**
   Executed via Puppeteer (`tools/verify_missions_3_and_4.js` / headless Chrome 1024x640):
   - Page console errors: 0
   - Unhandled exceptions: 0
   - HTTP Range requests served: 100% successful (HTTP 206)
   - Audio endpoints (`/api/audio/*`): 100% successful (HTTP 200 WAV)

**Distinction:**
A successful TypeScript/Vite build only validates syntactic and type correctness of the frontend bundle. A functioning browser session requires the local Python bridge running concurrently with access to a valid local Steam installation of *Sleeping Dogs: Definitive Edition*. Without the game installation, the client will fail to stream mesh and texture payloads unless mock fallbacks are used.

---

### Q02 — Which document represents the real current state?

**Direct Answer:**
`docs/current-state.md` is the designated authoritative single source of truth. The other documentation files (`ANTIGRAVITY_HANDOFF_SLEEPING_DOGS_BROWSER_RECONSTRUCTION.md`, `docs/roadmap.md`, and `browser_verification_report.md`) reflect different historical milestones and contained material discrepancies that are reconciled in this update.

**Status:** **CONFIRMED**

**Discrepancy Reconciliation:**
- `ANTIGRAVITY_HANDOFF_SLEEPING_DOGS_BROWSER_RECONSTRUCTION.md`: Written at project inception before any code was written. Its statements that the vertical slice was "not yet built" and "not demonstrated" were true on Day 1, but are obsolete. It is preserved strictly as a historical specification.
- `docs/roadmap.md`: Documented the progression through Milestones 1–10 and Gameplay Phases 1–4. However, it used sweeping promotional phrases such as *"Zero synthetic or placeholder assets"* and *"100% of rendered vertices originate from genuine game payloads"*. As established in Q04, Q13, Q15, and Q24, those claims were inaccurate regarding mesh index topology, secondary sectors, traffic vehicles, vehicle dynamics, and SSR.
- `docs/current-state.md`: Now updated as the sole authoritative reference, detailing exactly which subsystems are authentic extracted data, which are procedural simulations, and which are heuristic approximations.

---

### Q03 — What does "complete" mean for this project?

**Direct Answer:**
To avoid conflating "implemented in code" with "faithful reproduction of the original engine", the capability matrix below classifies each subsystem across six verification states.

**Status:** **CONFIRMED**

| Subsystem | Implemented in Source | Built Successfully | Runs Locally | Tested with Real Archives | Verified Against Original Structures | Faithful Engine Reproduction | Current Architectural Classification |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Archive Parsing (`.big`/`.bix`)** | YES | YES | YES | YES | PARTIAL | PARTIAL | Real `.big` HTTP 206 streaming; `.bix` header parsed, but offsets largely hard-coded. |
| **Mesh Decoding (`mesh-decoder.ts`)** | YES | YES | YES | YES | PARTIAL | NO | Authentic half-float position streams; **synthetic** triangle-strip indices; no real index buffers. |
| **Texture Decoding (`texture-decoder.ts`)** | YES | YES | YES | YES | YES | PARTIAL | Authentic BC1/BC2/BC3/BC5 software decoders; dimensions and formats hard-coded by caller. |
| **Rendering Pipeline (`renderer.ts`)** | YES | YES | YES | YES | NO | NO | Forward WebGL2 + ACES tone mapping + shadow mapping; **not** Illusion Engine deferred renderer. |
| **World Streaming (`world-streamer.ts`)** | YES | YES | YES | YES | NO | NO | Distance-based visibility culling of 5 static sectors; secondary sectors use heuristic offsets. |
| **Animation (`character-animator.ts`)** | YES | YES | YES | N/A | NO | NO | **100% Procedural kinematics** (Euler sine curves); Havok `.hkx` animations not parsed. |
| **Physics & Collision (`physics-engine.ts`)** | YES | YES | YES | N/A | NO | NO | **Custom TypeScript physics** (Möller–Trumbore raycasts + AABBs); no Havok runtime. |
| **Audio Pipeline (`asset_server.py`)** | YES | YES | YES | YES | YES | YES | **100% Authentic bitstreams** extracted from `SFX.pck` and `English(US).pck` via `vgmstream`. |
| **Traffic System (`traffic-system.ts`)** | YES | YES | YES | YES | NO | NO | Procedural waypoint simulation; secondary vehicle models use heuristic offsets. |
| **Crowd System (`crowd-system.ts`)** | YES | YES | YES | YES | PARTIAL | NO | State-machine wandering; models extracted from `Characters.big`, but animated procedurally. |
| **Combat System (`combat-system.ts`)** | YES | YES | YES | N/A | NO | NO | Authored martial arts combo state machine; inspired by game mechanics, not bytecode. |
| **Campaign Missions (`main.ts`)** | YES | YES | YES | YES | PARTIAL | NO | Authored mission scripts (Missions 1–4) utilizing authentic spoken dialogue audio streams. |

---

# B. Authentic Asset Decoding — Highest Priority

### Q04 — Does the mesh decoder reconstruct real topology, or does it invent it?

**Direct Answer:**
The mesh decoder **invents its topology**. The index buffers rendered in the browser are NOT extracted from the game archives; they are synthetically generated in TypeScript as alternating triangle strips. Furthermore, vertex attributes (normals and UVs) are mathematically computed rather than decoded from the buffer descriptors.

**Status:** **CONFIRMED**

**Technical Analysis & Evidence:**
1. **Actual Vertex Layout:**
   In [client/src/mesh-decoder.ts](file:///client/src/mesh-decoder.ts#L138-L164), `decodeAuthenticVehicleMesh` assumes an 8-byte stride containing 4 half-floats (Float16):
   - Offset 0: `hx` (X position)
   - Offset 2: `hy` (Y position)
   - Offset 4: `hz` (Z position)
   - Offset 6: ignored (assumed padding or attribute)
2. **Coordinate Threshold Discarding:**
   Lines 155–159 and lines 220–224 silently discard any vertex failing hardcoded coordinate limits:
   - Vehicle: `Math.abs(x) < 15.0 && Math.abs(y) < 15.0 && Math.abs(z) < 15.0`
   - Character: `Math.abs(x) < 5.0 && Math.abs(y) < 5.0 && Math.abs(z) < 5.0`
   - World Sector: `Math.abs(x) < 500.0 && Math.abs(y) < 500.0 && Math.abs(z) < 500.0`
   Any vertex exceeding these thresholds is dropped from `rawPoints`.
3. **Synthetic Index Generation:**
   In [client/src/mesh-decoder.ts](file:///client/src/mesh-decoder.ts#L165-L173), [L230-L238](file:///client/src/mesh-decoder.ts#L230-L238), and [L295-L303](file:///client/src/mesh-decoder.ts#L295-L303):
   ```typescript
   const rawIndices: number[] = [];
   for (let i = 0; i < vertexCount - 2; i++) {
     if (i % 2 === 0) {
       rawIndices.push(i, i + 1, i + 2);
     } else {
       rawIndices.push(i + 1, i, i + 2);
     }
   }
   const indices = new Uint16Array(rawIndices);
   ```
   This generates an artificial triangle strip across consecutive surviving vertices. It is not decoded from the `.big` archive.
4. **Normals and UVs:**
   - Normals are generated via `computeSmoothNormals()` ([client/src/mesh-decoder.ts#L86-L132](file:///client/src/mesh-decoder.ts#L86-L132)) by computing cross products of the synthetic triangle faces.
   - UVs are generated via planar bounding-box projection: `(pos - bounds.min) / bounds.span` ([client/src/mesh-decoder.ts#L177-L184](file:///client/src/mesh-decoder.ts#L177-L184)).
5. **Original Engine Comparison (Ghidra Decompilation):**
   In [docs/buffer-create-decomp.txt](file:///docs/buffer-create-decomp.txt), function `FUN_140a18c70` (`BufferLoader::CreateBufferResource`) reads the buffer descriptor at negative offsets from the sysMem pointer:
   - `*(uint *)(param_1 - 0x38)`: Buffer Type (`0` = Vertex Buffer, `1` = Index Buffer)
   - `*(uint *)(param_1 - 0x34)`: ByteWidth (passed to `D3D11_BUFFER_DESC.ByteWidth`)
   - `*(param_1 - 0x30)`: SysMem pointer (passed to `D3D11_SUBRESOURCE_DATA.pSysMem`)
   The game engine loads explicit index buffers containing 16-bit or 32-bit indices matching DirectX primitive topologies (`D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST` or `TRIANGLESTRIP`). `mesh-decoder.ts` bypasses this entire mechanism.

**Conclusion:**
The meshes rendered in the browser are **geometry approximations**: authentic vertex point clouds bound together by synthetic alternating triangle-strip topology.

---

### Q05 — What does `parseIllusionBuffer` really recognize?

**Direct Answer:**
`parseIllusionBuffer` does not recognize chunk headers, magic numbers, or buffer descriptors. It uses a brute-force statistical trial over fixed strides `[8, 16, 24]` bytes, testing whether the first 6 bytes decode as IEEE 754 half-floats within `[-500.0, 500.0]`. If $\ge 12$ consecutive records pass, it declares the buffer a valid mesh and generates synthetic indices.

**Status:** **CONFIRMED**

**Evidence & Vulnerability:**
In [client/src/mesh-decoder.ts](file:///client/src/mesh-decoder.ts#L332-L397):
```typescript
for (const stride of [8, 16, 24]) {
  // decodes half-floats at offset 0, 2, 4
  // filters Math.abs(coord) < 500.0
  if (rawPoints.length / 3 >= 12) { ... return DecodedMesh; }
}
```
- **False Positives:** If an uncompressed texture payload, string table, or audio header contains 16-bit integers whose bit patterns correspond to half-floats under 500.0, `parseIllusionBuffer` will treat them as 3D vertices and produce a distorted mesh.
- **Validation Deficiency:** There is no magic check (e.g. `0x54584554` for textures or `0x42554646` for buffers), no CRC check, and no descriptor validation.

---

### Q06 — Are the hard-coded archive offsets and spans validated against BIX entries?

**Direct Answer:**
Mixed. We executed a complete cross-reference audit tool ([tools/audit_bix_resources.py](file:///tools/audit_bix_resources.py)) comparing all 18 hard-coded resources across `asset-loader.ts`, `world-streamer.ts`, `traffic-system.ts`, and `crowd-system.ts` against the binary `.bix` indices (`Vehicles.bix`, `Characters.bix`, `Game.bix`, and `UI.bix`).

- **5 resources** are **EXACT BIX MATCHES** (UID, offset, and span match the real `.bix` file).
- **2 resources** have valid BIX offsets, but the TypeScript code used the offset value as the UID.
- **11 resources** are **HEURISTIC / ARBITRARY OFFSETS** that do NOT exist in the BIX indices.

**Status:** **CONFIRMED**

**Empirical Audit Table ([tools/audit_bix_resources.py](file:///tools/audit_bix_resources.py)):**

| Resource | Archive | Requested UID | Requested Offset | BIX Entry Index | True BIX UID | True BIX Offset | BIX Span (Bytes) | Match Status |
|---|---|---|---|---|---|---|---|---|
| **Sedan Mesh** | `Vehicles.big` | `0x008c038c` | `0x01f0a400` | 6 | `0x008c038c` | `0x01f0a400` | 3,840 | **EXACT MATCH** |
| **Pedestrian Mesh** | `Characters.big` | `0x030e17e9` | `0x161f3000` | 51 | `0x030e17e9` | `0x161f3000` | 10,944 | **EXACT MATCH** |
| **Hong Kong Sector** | `Game.big` | `0x7b8f6706` | `0x1b7ef400` | 3445 | `0x7b8f6706` | `0x1b7ef400` | 1,648 | **EXACT MATCH** |
| **Crowd Triad** | `Characters.big` | `0x00882829` | `0x08770000` | 7 | `0x00882829` | `0x08770000` | 25,072 | **EXACT MATCH** |
| **Crowd Vendor** | `Characters.big` | `0x01bf39f3` | `0x15d0e000` | 23 | `0x01bf39f3` | `0x15d0e000` | 10,672 | **EXACT MATCH** |
| **Taxi Livery** | `Vehicles.big` | `0x0207f800` | `0x0207f800` | 7 | `0x00eb307d` | `0x0207f800` | 174,752 | **OFFSET MATCH** (UID substituted) |
| **Triad Clothing** | `Characters.big` | `0x16595000` | `0x16595000` | 875 | `0x2fa100db` | `0x16595000` | 131,088 | **OFFSET MATCH** (UID substituted) |
| **Crate Texture** | `UI.big` | `0x0854388e` | `0x0356b800` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Concrete Road** | `Game.big` | `0x10360800` | `0x10360800` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Shop Neon** | `UI.big` | `0x07dc4800` | `0x07dc4800` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Sector North** | `Game.big` | `0x7b8f6707` | `0x1b800000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Sector South** | `Game.big` | `0x7b8f6708` | `0x1b810000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Sector East** | `Game.big` | `0x7b8f6709` | `0x1b820000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Sector West** | `Game.big` | `0x7b8f670a` | `0x1b830000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Traffic Minivan** | `Vehicles.big` | `0x008c0400` | `0x01f20000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Traffic SUV** | `Vehicles.big` | `0x008c0500` | `0x01f30000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Traffic Bus** | `Vehicles.big` | `0x008c0600` | `0x01f40000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |
| **Crowd Citizen** | `Characters.big` | `0x00062a74` | `0x028d0000` | None | None | None | None | **NOT IN BIX** (Heuristic offset) |

---

### Q07 — Is the BIX parser validating enough to support production streaming?

**Direct Answer:**
No. `client/src/bix-parser.ts` parses the 32-byte header and entry records, but does not perform production-grade boundary checks.

**Status:** **CONFIRMED**

**Missing Validations in `client/src/bix-parser.ts`:**
1. Does not check entry offsets against the actual `.big` file size on disk.
2. Does not validate the mathematical sum of part 1, part 2, and alignment padding against the span.
3. Does not guard against integer overflow on total entry count.
4. Does not detect duplicate UIDs or overlapping byte ranges.
5. Does not verify archive pairing magic (ensuring `Game.bix` matches `Game.big`).

---

### Q08 — Are the mesh decoders consistent with the documented vertex layouts?

**Direct Answer:**
No. `docs/asset-formats.md` documents complex 32-byte, 40-byte, and 48-byte vertex layouts containing packed normals, tangents, UV channels, and 4-bone blend weights. The actual TypeScript decoder ([client/src/mesh-decoder.ts](file:///client/src/mesh-decoder.ts)) implements none of these: it uses an 8-byte half-float stride reading positions only.

**Status:** **CONFIRMED**

- **Documented Layouts:** Derived from Ghidra disassembly of D3D11 input element arrays (`D3D11_INPUT_ELEMENT_DESC`) in `sdhdship.exe`.
- **Implemented Code:** A simplified 8-byte half-float reader (`x, y, z` at byte offsets `0, 2, 4`).
- **Missing Fields:** Tangents, binormals, vertex colors, blend indices, and blend weights are not decoded in the current client.

---

### Q09 — Are texture headers actually parsed, or are known payloads being decoded by hard-coded assumptions?

**Direct Answer:**
Known payloads are decoded using **hard-coded caller assumptions**. While the decompression algorithms for BC1, BC2, BC3, and BC5 in [client/src/texture-decoder.ts](file:///client/src/texture-decoder.ts) are fully functional software implementations, `decodeAuthenticTexture()` does not parse the `Illusion::rTexture` header at runtime.

**Status:** **CONFIRMED**

**Evidence:**
- In [client/src/texture-decoder.ts#L367-L373](file:///client/src/texture-decoder.ts#L367-L373):
  `decodeAuthenticTexture(payload, width, height, format, name)` receives `width`, `height`, and `format` as external arguments.
- The caller in [client/src/asset-loader.ts#L225-L235](file:///client/src/asset-loader.ts#L225-L235) hard-codes `128, 128, TextureFormat.BC3` or `256, 256, TextureFormat.BC1`.
- Native `Illusion::rTexture` metadata (magic `0x54455855`, mipmap count, DXGI format enum) is not read dynamically.

---

### Q10 — Can we prove that the rendered vehicle, character, and world-sector assets are the correct original assets?

**Direct Answer:**
Yes for the 3 primary assets; No for the secondary assets.

**Status:** **CONFIRMED**

1. **Primary Sedan Chassis (`Vehicles.big` @ `0x01f0a400`, UID `0x008c038c`):**
   - Confirmed Entry 6 in `Vehicles.bix`.
   - Bounding box spans $X \in [-1.8\text{m}, +1.8\text{m}], Y \in [0.0\text{m}, +1.45\text{m}], Z \in [-2.1\text{m}, +2.1\text{m}]$, matching sedan vehicle dimensions.
2. **Primary Pedestrian (`Characters.big` @ `0x161f3000`, UID `0x030e17e9`):**
   - Confirmed Entry 51 in `Characters.bix`.
   - Bounding box spans height $Y \approx 1.85\text{m}$, matching adult human character height.
3. **Primary Hong Kong Sector (`Game.big` @ `0x1b7ef400`, UID `0x7b8f6706`):**
   - Confirmed Entry 3445 in `Game.bix`.
   - Bounding box spans broad urban street boundaries (~574m).
4. **Secondary Assets:**
   As shown in Q06, secondary sectors (`0x1b800000`-`0x1b830000`) and traffic models (`0x01f20000`-`0x01f40000`) do not exist in BIX files and cannot be verified as authentic models.

---

# C. World Assembly and Streaming

### Q11 — Is the current world system actually demand-driven streaming?

**Direct Answer:**
No. `client/src/world-streamer.ts` implements **distance-based visibility culling** across 5 statically defined sector objects. It does not dynamically discover, request, load, or evict new sectors from the full game map as the player moves.

**Status:** **CONFIRMED**

- `initPrimaryWorld()` instantiates 5 static sector groups.
- `update()` iterates over the 5 groups and toggles `.visible = distance < streamRadius`.
- If the player travels beyond the 5 sectors, no new terrain is streamed.

---

### Q12 — Are the five streamed sectors real adjacent game-world sectors?

**Direct Answer:**
No. Only the central sector (`0x1b7ef400`) is a verified BIX entry. The North, South, East, and West sectors use synthetic UIDs (`0x7b8f6707`-`0x7b8f670a`) and heuristic byte offsets (`0x1b800000`, `0x1b810000`, etc.) placed at manually tuned coordinates (`[-48, 0, 0]`, `[+48, 0, 0]`). They are not parsed adjacent sectors from the game's world database.

**Status:** **CONFIRMED**

---

### Q13 — Which parts of the displayed city are extracted assets and which are procedural?

**Direct Answer:**
The table below provides a complete inventory of every visual element in the 3D scene.

**Status:** **CONFIRMED**

| Scene Element | Geometry Source | Texture Source | Placement Source | Architectural Classification |
|---|---|---|---|---|
| **Central Road / Ground** | Extracted (`Game.big` `0x1b7ef400`) | Extracted (`UI.big` BC3) | Origin `(0,0,0)` | **Extracted Vertices / Synthetic Topology** |
| **Surrounding Sectors** | Heuristic (`Game.big` `0x1b800000`+) | Extracted (`UI.big` BC3) | Manual offsets (`±48m`) | **Heuristic Offset / Synthetic Topology** |
| **Buildings / Facades** | Procedural (`generateBoxMesh`) | Extracted BC3 + Tint | Procedural street grid | **100% Procedural Model** |
| **Sidewalks / Curbs** | Procedural box geometry | Procedural material | Procedural road margins | **100% Procedural Geometry** |
| **Neon Signs** | Procedural quads | Procedural canvas text | Predefined positions | **100% Procedural Element** |
| **Street Furniture (Stalls, Booths)** | Procedural primitives (`generateMarketStallMesh`, etc.) | Procedural material | Hard-coded sidewalk spots | **100% Procedural Prop** |
| **City Skyline** | Procedural backdrop | Procedural gradient | Sky dome | **100% Procedural Simulation** |
| **Sedan Chassis** | Extracted (`Vehicles.big` `0x01f0a400`) | Extracted Taxi Livery BC3 | Vehicle position | **Extracted Vertices / Synthetic Topology** |
| **Vehicle Wheels / Tires** | Procedural cylinders | Procedural rubber shader | Vehicle wheel mounts | **100% Procedural Geometry** |
| **Characters (Wei, Ming, Thugs)** | Extracted (`Characters.big` `0x161f3000`) | Extracted BC3 + Tint | Character transforms | **Extracted Vertices / Procedural Rig** |
| **Rain / Wet Road / Skid Marks** | Procedural GPU particles & decals | Procedural shaders | Dynamic physics simulation | **100% Procedural Simulation** |

---

### Q14 — Is collision initialized from the entire active world?

**Direct Answer:**
No. In `main.ts`, `physicsEngine.initFromSceneNodes()` is called only with `node-hk-sector` and `node-vehicle`. Additional sectors and procedural street furniture are collidable only through separate analytic AABB checks in `environmental-hazards.ts` and `physics-engine.ts`. There is no unified world collision mesh.

**Status:** **CONFIRMED**

---

# D. Physics, Animation, Characters, and Vehicles

### Q15 — What part of the physics system is genuinely Havok-derived?

**Direct Answer:**
**0% of the physics system is Havok-derived.** The physics engine in [client/src/physics-engine.ts](file:///client/src/physics-engine.ts) is a custom TypeScript implementation using Möller–Trumbore raycasts against the ground mesh, horizontal capsule-like penetration pushes against AABBs, and custom Euler integration. Havok `.hkx` collision files (`hkpRigidBody`, `hkpMoppCode`) are neither decompressed nor executed.

**Status:** **CONFIRMED**

- Gravity (`-19.6 m/s²`), player capsule radius (`0.35m`), and height (`1.85m`) are authored design estimates chosen to provide a responsive action-game feel, not extracted Havok constants.

---

### Q16 — Are authentic animation clips loaded and evaluated?

**Direct Answer:**
No. All character animations in [client/src/character-animator.ts](file:///client/src/character-animator.ts) and [client/src/anim-player.ts](file:///client/src/anim-player.ts) are **procedural trigonometric kinematics** evaluated in TypeScript.

**Status:** **CONFIRMED**

- Motion is generated mathematically via sinusoidal Euler rotations: `Math.sin(time * speed + phase) * amplitude`.
- No keyframe data, spline compression, or animation tracks are parsed from `Animation.big` or `AnimationNIS.big`.
- Animation names (e.g. `FSR_LightAttack`, `CP_STATE_WALK`) are descriptive identifiers inspired by game strings, not references to active game clips.

---

### Q17 — Is character skinning really implemented?

**Direct Answer:**
No. There is no GPU vertex-skinning shader and no CPU matrix-palette skinning. Characters are rendered as rigid mesh components transformed as a whole, or structured with procedural hierarchical bone groups. Blend weights and inverse bind matrices are not parsed from the game files.

**Status:** **CONFIRMED**

---

### Q18 — Are traffic and crowd instances actually decoded from valid models?

**Direct Answer:**
Crowd models are decoded from genuine BIX entries; traffic vehicles (minivan, SUV, bus) are not.

**Status:** **CONFIRMED**

- **Crowd Models:**
  - Crowd Triad: UID `0x00882829` @ `0x08770000` (BIX Entry 7, 25,072 bytes) -> **Valid BIX resource**.
  - Crowd Vendor: UID `0x01bf39f3` @ `0x15d0e000` (BIX Entry 23, 10,672 bytes) -> **Valid BIX resource**.
- **Traffic Models:**
  - Minivan (`0x01f20000`), SUV (`0x01f30000`), Bus (`0x01f40000`) do not exist in `Vehicles.bix`. They load heuristic byte ranges and apply procedural scaling.

---

### Q19 — How faithful are vehicle physics and driving behavior?

**Direct Answer:**
Vehicle driving in [client/src/vehicle-controller.ts](file:///client/src/vehicle-controller.ts) is an **authored arcade raycast/bicycle model**, not a port of Havok Vehicle SDK.

**Status:** **CONFIRMED**

- Driving parameters (torque, gear ratios, tire friction, drift slip multipliers) are authored tuning constants calibrated to emulate the high-speed drifting feel of Sleeping Dogs.
- Skid marks, tire smoke, and wheel rotation are procedurally injected based on lateral tire slip angles.

---

# E. Combat, Missions, and Simulation

### Q20 — Are the combat animation names backed by actual animation resources?

**Direct Answer:**
No. Combat animations in [client/src/combat-system.ts](file:///client/src/combat-system.ts) trigger procedural kinematic bone poses. The timing windows (0.45s strike combo window, 0.6s counter reversal window) and damage multipliers are authored gameplay logic, not decompiled engine bytecode.

**Status:** **CONFIRMED**

---

### Q21 — Are environmental takedowns real game interactions or scripted hazard triggers?

**Direct Answer:**
They are **scripted hazard triggers**. [client/src/environmental-hazards.ts](file:///client/src/environmental-hazards.ts) registers predefined bounding zones around phone booths, dumpsters, and electrical fuse boxes. When an enemy is grappled within 2.5 meters of a hazard, pressing the action key triggers a scripted takedown sequence, playing authentic impact audio from `SFX.pck` and neutralizing the NPC.

**Status:** **CONFIRMED**

---

### Q22 — What is the real scope of the campaign implementation?

**Direct Answer:**
The campaign system implements high-level story mission prototypes covering the first four narrative sequences:
1. **Prologue:** Night market foot chase, parkour vaulting, and dockside thug combat.
2. **Mission 2:** Holding cell dialogue, night market vendor extortion shakedown, thug brawl, and carjacking drive to safehouse.
3. **Mission 3 (Night Market Chase):** Confronting food vendor contact, pursuing Dirty Ming across market rooftops, and balcony knife brawl.
4. **Mission 4 (Amanda Tour):** Escort driving tour with Amanda Cartwright and Master Kwok Kung Fu dojo sparring.

**Status:** **CONFIRMED**

- Spoken dialogue audio streams are 100% authentic bitstreams extracted from `English(US).pck`.
- Mission progression logic is an authored TypeScript state machine in `main.ts`, not original binary mission bytecode.

---

### Q23 — Are automated NPC and traffic behaviors based on recovered game AI?

**Direct Answer:**
No. Traffic lane navigation and pedestrian crowd wandering are authored state machines in `traffic-system.ts` and `crowd-system.ts`. Original Havok AI navigation meshes (`.nav`), pathfinding graphs, and behavior trees are not parsed.

**Status:** **CONFIRMED**

---

# F. Renderer and Visual Effects

### Q24 — Is the wet-road effect actually screen-space reflection?

**Direct Answer:**
No. The effect in [client/src/renderer.ts#L367-L386](file:///client/src/renderer.ts#L367-L386) is an **analytic anisotropic specular streak approximation**. It calculates specular streaks against 6 hard-coded neon sign positions and colors (`uNeonPositions`, `uNeonColors`). There is no screen color buffer raymarching or depth buffer traversal.

**Status:** **CONFIRMED**

- Wet puddle masks are generated via procedural multi-frequency sine noise ([L350-L352](file:///client/src/renderer.ts#L350-L352)) and animated wave ripple perturbation ([L356-L361](file:///client/src/renderer.ts#L356-L361)), not extracted texture masks.

---

### Q25 — Which rendering features are present, and which are merely described?

**Direct Answer:**
The table below documents the actual implementation status of every graphics feature in [client/src/renderer.ts](file:///client/src/renderer.ts).

**Status:** **CONFIRMED**

| Feature | Actual Implementation | Input Data | Status | Notes |
|---|---|---|:---:|---|
| **Shadow Mapping** | Single-pass directional depth FBO | Scene vertices | **Present** | `1024x1024` depth map with 4-tap Poisson PCF. (Roadmap claim of 2048 was inaccurate). |
| **Contact AO** | Analytic ground proximity calculation | Player / Wheel position | **Present** | Attenuates ambient light directly beneath feet and tires. |
| **ACES Tone Mapping** | Analytic Narkowicz ACES filmic curve | Shaded HDR fragment | **Present** | Implemented directly in fragment shader (`acesTonemap()`). |
| **Normal Mapping** | Cotangent-frame per-pixel TBN | BC5 / Tangent normals | **Present** | Implemented using standard WebGL2 derivative functions (`dFdx`/`dFdy`). |
| **Rain Particles** | GPU particle system (`THREE.Points`) | Uniform buffers | **Present** | 5,000 rain streaks with wind slant and puddle ripples. |
| **Screen-Space Reflections** | None (Analytic neon streaks) | 6 uniform positions | **Approx** | Not raymarched SSR. |

---

### Q26 — Is the project WebGL2-only today?

**Direct Answer:**
Yes. The project is exclusively WebGL2. There is no WebGPU renderer, no capability detection fallback, and no Web Workers. All rendering and decompression currently execute on the main thread.

**Status:** **CONFIRMED**

---

# G. Local Bridge, Archive Safety, and Performance

### Q27 — Is the local asset bridge safely read-only and correctly constrained?

**Direct Answer:**
The bridge in [tools/asset_server.py](file:///tools/asset_server.py) is strictly read-only (implements `GET`, `HEAD`, and `OPTIONS` only; no `POST`, `PUT`, or `DELETE`), but has architectural limitations:
1. It does not enforce a strict filename allowlist (serves any file within `GAME_DIR`).
2. CORS uses a wildcard (`Access-Control-Allow-Origin: *`).
3. Suffix ranges (`bytes=-N`) are handled incorrectly due to simple string splitting on `-`.
4. It is single-threaded (`socketserver.TCPServer`).

**Status:** **CONFIRMED**

---

### Q28 — Can a Range request accidentally load an entire multi-gigabyte archive?

**Direct Answer:**
Previously, yes: `asset-loader.ts` accepted HTTP 200 alongside HTTP 206, which could cause the browser to attempt reading a multi-gigabyte `.big` file into memory if the server returned full content.

**Remediation Applied in this Update:**
In [client/src/asset-loader.ts#L151-L162](file:///client/src/asset-loader.ts#L151-L162), `fetchRange()` now strictly requires `HTTP 206 Partial Content`, verifies `Content-Range`, checks that the received byte count matches `length`, and rejects full-file responses immediately before materializing the ArrayBuffer.

**Status:** **CONFIRMED**

---

### Q29 — Are cache semantics correct and bounded?

**Direct Answer:**
L1 memory cache is strictly bounded to 128 chunks (LRU via `Map` key refresh). L2 IndexedDB cache stores chunks indefinitely without an eviction policy or cache invalidation by game file modification date. Concurrent duplicate range requests are not deduplicated.

**Status:** **CONFIRMED**

---

### Q30 — Does the audio decoder use verified Wwise stream metadata?

**Direct Answer:**
Audio streams in [tools/asset_server.py](file:///tools/asset_server.py) are extracted using verified byte offsets and sizes directly from `SFX.pck` and `English(US).pck`. The raw Wwise Vorbis bitstreams are decoded into authentic 48kHz WAV waveforms via bundled `vgmstream-cli` and cached in `audio_cache/`. Spoken dialogue and combat SFX played in the browser are 100% authentic bitstreams.

**Status:** **CONFIRMED**

---

### Q31 — What are the measured performance and memory limits?

**Direct Answer:**
Empirical measurements captured via Puppeteer running against the live server and local game installation:
- **Startup Time to Network Idle:** 7,118 ms (includes pre-caching audio and streaming initial world assets).
- **HTTP Network Requests:** 50 requests.
- **Total Network Transfer:** 2.78 MB (assets + scripts + audio).
- **Active Draw Calls:** 111 draw calls per frame.
- **Rendered Triangle Count:** 40,911 triangles.
- **JS Heap Memory:** 12.9 MB.
- **Frame Rate:** 40–60 FPS (headless software rendering vs hardware acceleration).

**Status:** **CONFIRMED**

---

# H. Verification Quality and Repository Hygiene

### Q32 — What do the current verification scripts truly prove?

**Direct Answer:**
The verification scripts in `tools/verify_*.js` demonstrate end-to-end visual composition, browser rendering stability, and audio bridge responsiveness. However, they rely on fixed timeout delays and state injection rather than rigorous assertion-based testing. They do not rigorously assert return values or throw on non-fatal console warnings.

**Status:** **CONFIRMED**

---

### Q33 — What is the automated test coverage?

**Direct Answer:**
Currently, there is no unit test suite (Jest/Vitest) in `package.json`. All automated verification has been conducted through standalone Puppeteer browser automation scripts. 

**Recommendation:**
Introduce unit tests for `mesh-decoder.ts`, `texture-decoder.ts`, and `bix-parser.ts` using self-contained synthetic binary fixtures that run in CI without requiring the game installation.

**Status:** **CONFIRMED**

---

### Q34 — Are screenshots and test artifacts reproducible and portable?

**Direct Answer:**
The verification scripts currently use hardcoded Windows paths to Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) and local artifact directories. They require manual path adjustment to execute on other development machines.

**Status:** **CONFIRMED**

---

### Q35 — Are third-party binaries and repository contents properly documented?

**Direct Answer:**
- `tools/vgmstream/`: Contains `vgmstream-cli.exe` and supporting DLLs with the full open-source license ([tools/vgmstream/COPYING](file:///tools/vgmstream/COPYING)).
- **Proprietary Game Assets:** Zero copyrighted `.big` files, `.pck` soundbanks, or raw game extracts are committed to the git repository (`git ls-files` verified). The project operates strictly on the user's legally owned local Steam installation.

**Status:** **CONFIRMED**

---

# I. Final Synthesis Requested

### Q36 — What is the next technically correct milestone?

**Direct Answer:**
The next technically correct milestone is:
**"Authentic Index Buffer & Vertex Descriptor Extraction for Resource 0x008c038c (Vehicles.big Entry 6)"**

**Milestone Specification:**
1. **Target Asset:** Sedan Chassis (UID `0x008c038c`, Entry 6 in `Vehicles.bix`, offset `0x01f0a400`, span 3,840 bytes).
2. **Implementation Goal:**
   - Parse the `Illusion::BufferLoader` descriptor at negative offsets (`-0x38`, `-0x34`) as identified in Ghidra decompilation `FUN_140a18c70`.
   - Locate and decode the authentic index buffer resource corresponding to this mesh.
   - Completely eliminate the synthetic alternating triangle strip formula (`rawIndices.push(i, i+1, i+2)`).
3. **Acceptance Criteria:**
   - 100% of rendered index tuples `(i0, i1, i2)` originate from the archive payload.
   - Zero synthetic triangle strip generation.
   - Tested and verified with automated unit tests asserting decoded index buffer topology against known ground truth.

---

### Q37 — What claims in the existing documentation must be corrected immediately?

**Direct Answer:**
The following claims have been identified as inaccurate or needing qualification and are immediately reconciled across all documentation:

1. **"Zero synthetic assets"** -> **Corrected to:** *"Hybrid architecture: authentic vertex positions, texture payloads, and audio bitstreams combined with procedural triangle-strip topology, procedural shaders, and procedural physics."*
2. **"Authentic Havok Physics"** -> **Corrected to:** *"Custom TypeScript arcade physics calibrated to emulate Sleeping Dogs handling; Havok runtime is not executed."*
3. **"Authentic Skeletal Animation"** -> **Corrected to:** *"Procedural kinematic animation and bone Euler curves; Havok .hkx animation tracks are not parsed."*
4. **"Screen-Space Reflections (SSR)"** -> **Corrected to:** *"Analytic anisotropic neon streak reflection shader; no depth-buffer raymarching."*
5. **"Full-Map World Streaming"** -> **Corrected to:** *"Five-sector North Point street prototype with distance-based visibility culling."*
6. **"WebGPU Primary"** -> **Corrected to:** *"Forward WebGL2 rendering pipeline."*
7. **"Fully operational browser port"** -> **Corrected to:** *"Playable browser vertical slice and four-mission campaign prototype."*

---
*End of Review Answers.*
