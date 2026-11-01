# Sleeping Dogs Browser Reconstruction — Authoritative Project Status

**Document:** `docs/current-state.md`  
**Status:** **AUTHORITATIVE SINGLE SOURCE OF TRUTH**  
**Last Updated:** 01 November 2026  
**Environment:** Windows 11, x86-64, Java 25.0.5, Python 3.12.6 / 3.14.6, Ghidra 12.2 PUBLIC  
**Repository:** [https://github.com/the-rohit-kumar/sleeping-dogs-web](https://github.com/the-rohit-kumar/sleeping-dogs-web)  

---

## 1. Project Purpose & Architectural Reality

The goal of this project is to build an in-browser WebGL reconstruction of *Sleeping Dogs: Definitive Edition* that runs on the player's local machine, streaming assets directly from their legally owned Steam installation via a local read-only bridge.

### Architecture Classification: Hybrid Reconstruction
As established in the technical review (`docs/ANTIGRAVITY_REVIEW_ANSWERS.md`), the current project architecture is a **hybrid reconstruction**:
1. **Authentic Extracted Data (Genuine Base Game Streams):**
   - **Audio Bitstreams:** 100% authentic spoken dialogue (42,884 streams in `English(US).pck`) and combat sound effects (260,010 streams in `SFX.pck`) decoded via `vgmstream`.
   - **Vertex Coordinates:** Authentic half-float position streams extracted from `Game.big`, `Vehicles.big`, and `Characters.big` via HTTP 206 range requests.
   - **Texture Payloads:** Authentic block-compressed payloads (BC1, BC2, BC3, BC5) streamed from `UI.big`, `Vehicles.big`, and `Characters.big` and software-decoded.
2. **Procedural & Re-engineered Game Systems:**
   - **Renderer:** Forward WebGL2 pipeline with custom GLSL shaders, ACES tone mapping, shadow mapping, and analytic neon reflections (not the Illusion Engine deferred renderer).
   - **Animation:** 15-bone procedural trigonometric kinematics and blend state machines (not Havok `.hkx` skeletal tracks).
   - **Physics & Vehicles:** Custom TypeScript raycast/bicycle arcade vehicle model and AABB collision (not Havok Physics runtime).
   - **User Interface:** Clean HTML5 Canvas 2D and CSS3 overlay (replacing Autodesk Scaleform Flash `.gfx`).
3. **Geometry Approximations:**
   - **Mesh Topology:** Index buffers are currently synthesized using alternating triangle strips in TypeScript (`mesh-decoder.ts`); true index buffers and DXGI input element layouts are not yet decoded.

---

## 2. Subsystem Capability Matrix

| Subsystem | Implemented in Source | Tested Locally | Tested Real Archives | Verified Against Game Structures | Architectural Classification |
|---|:---:|:---:|:---:|:---:|---|
| **Archive Streaming Bridge** | YES | YES | YES | PARTIAL | HTTP 206 Partial Content server in Python reading real multi-gigabyte `.big` files. |
| **Mesh Decoding** | YES | YES | YES | PARTIAL | Authentic half-float vertices + synthetic triangle strip topology (`mesh-decoder.ts`). |
| **Texture Decoding** | YES | YES | YES | YES | Pure TypeScript BC1/BC2/BC3/BC5 software decoders (`texture-decoder.ts`). |
| **3D Rendering Engine** | YES | YES | YES | NO | WebGL2 forward renderer with shadow maps, ACES tonemap, normal maps, rain (`renderer.ts`). |
| **World Streaming** | YES | YES | YES | PARTIAL | 5-sector North Point street layout; central sector extracted, secondary sectors heuristic. |
| **Character Animation** | YES | YES | N/A | NO | Procedural kinematic Euler rotations and locomotion state machine (`character-animator.ts`). |
| **Physics & Collision** | YES | YES | N/A | NO | Custom raycast ground clamping + obstacle AABBs (`physics-engine.ts`). |
| **Vehicle Simulation** | YES | YES | YES | NO | Arcade bicycle/raycast drift model with tire slip & skid marks (`vehicle-controller.ts`). |
| **Audio Pipeline** | YES | YES | YES | YES | Wwise PCK extraction + `vgmstream` decode + Web Audio 3D HRTF panning (`asset_server.py`). |
| **Traffic System** | YES | YES | YES | NO | Waypoint traffic loop; sedan chassis extracted, other vehicles heuristic (`traffic-system.ts`). |
| **Crowd & Pedestrians** | YES | YES | YES | PARTIAL | Ambient crowd wandering; Triad and Vendor models extracted from `Characters.big`. |
| **Martial Arts Combat** | YES | YES | N/A | NO | Combo strikes, grapple takedowns, and counter-reversals with timing windows. |
| **Campaign Story Missions** | YES | YES | YES | PARTIAL | Missions 1–4 implemented with authentic dialogue audio from `English(US).pck`. |

---

## 3. Verified Playable Scope

The browser client is a fully interactive 3D playable prototype running at `http://127.0.0.1:5173/`:
- **Free-Roam Sandbox:**
  - Drive the authentic Sedan through the rainy North Point street section.
  - Carjack or enter/exit vehicles (`F` key).
  - Listen to authentic radio stations (Boosey & Hawkes, Kerrang!, Softly FM) with in-car HUD.
  - Explore the street on foot with third-person follow camera, sprint, jump, and parkour vaulting.
  - Engage ambient Triad thugs in kung fu combat with environmental takedowns (phone booths, dumpsters, fuse boxes).
- **Campaign Story Progression (Missions 1–4):**
  - **Prologue:** Market foot chase, dockside combat tutorial, and police pursuit cutscene.
  - **Mission 2:** Holding cell meeting with Jackie Ma, night market vendor extortion shakedown, thug brawl, and carjacking drive to safehouse.
  - **Mission 3 (Night Market Chase):** Confronting market contact, rooftop pursuit of Dirty Ming, and balcony knife fight with counter reversals.
  - **Mission 4 (Amanda Tour):** Escort driving tour with Amanda Cartwright across North Point and kung fu sparring at Master Kwok's martial arts dojo.

---

## 4. Current Blockers & Next Milestones

1. **Top Engineering Priority (Milestone 11):**
   - **Authentic Index Buffer & BufferLoader Extraction:** Parse the `Illusion::BufferLoader` descriptors (`FUN_140a18c70` in Ghidra) for Sedan UID `0x008c038c` to decode authentic index buffers, replacing synthetic triangle strips.
2. **Archive Validation:**
   - Expand `bix-parser.ts` to validate entry bounds against actual `.big` file size and eliminate hardcoded heuristic offsets.
3. **Automated Testing:**
   - Add unit test suite for standalone binary decoders using synthetic byte fixtures.
