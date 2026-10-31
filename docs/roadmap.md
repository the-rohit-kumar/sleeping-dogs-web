# Reconstruction Roadmap & Milestones

This roadmap defines the iterative development stages from initial technical slice to the full browser game simulation.
All assets are strictly reverse-engineered and streamed directly from the base game (*Sleeping Dogs: Definitive Edition*). **Zero synthetic or placeholder assets.**

GitHub Repository: [https://github.com/the-rohit-kumar/sleeping-dogs-web](https://github.com/the-rohit-kumar/sleeping-dogs-web)

---

```mermaid
flowchart LR
    M1["Milestone 1: Vertical Slice<br/>(Done)"] --> M2["Milestone 2: Authentic Geometry & Shading<br/>(Done)"]
    M2 --> M3["Milestone 3: World Streaming & Scene Graph<br/>(Done)"]
    M3 --> M4["Milestone 4: Skeletal Animation & Audio<br/>(Done)"]
    M4 --> M5["Milestone 5: Physics & Controls<br/>(Done)"]
    M5 --> M6["Milestone 6: Game Systems & Simulation<br/>(Done)"]
```

---

## Milestone 1: The Initial Vertical Slice (Completed)

**Goal:** Prove end-to-end viability by rendering a real, locally owned asset from the game archives in a modern browser canvas.

- [X] **Read-only BIG/BIX parser** with bounds checks and automated tests.
- [X] **Extraction of candidate asset** from base game archives without modification.
- [X] **Browser shell** (Vite + WebGL2 canvas with perspective camera and orbital controls).
- [X] **Render authentic 3D resource** with technical metadata inspector and pipeline HUD.

---

## Milestone 2: Authentic Geometry, Textures & Shading (Completed)

**Goal:** Reverse-engineer and stream authentic 3D models and textures directly from base-game containers (`Vehicles.big`, `Characters.big`, `UI.big`).

- [X] **Local Read-Only HTTP 206 Streaming Bridge** (`tools/asset_server.py`):
  - Streams byte ranges from multi-gigabyte `.big` containers via standard HTTP `Range` requests (`bytes=start-end`).
  - Zero modifications to user's Steam installation; CORS enabled for browser client.
- [X] **Zero Synthetic Asset Guarantee**:
  - All procedural geometry generators (mock coupes, crates) and procedural checkerboard textures purged.
  - 100% of rendered vertices and pixels originate from genuine game payloads.
- [X] **Authentic Vehicle Mesh Streamer (2A)**:
  - Streams `Vehicles.big` offset `0x01f0a400` (UID `0x008c038c`, 3,840 bytes).
  - Unpacks 318 authentic half-float (`DXGI_FORMAT_R16G16B16A16_FLOAT`) vehicle chassis coordinates.
  - Automatically centers camera and computes smooth surface normals and UV mappings.
- [X] **Authentic Character Mesh Streamer (2B)**:
  - Streams `Characters.big` offset `0x161f3000` (UID `0x030e17e9`, 10,944 bytes).
  - Unpacks 286 authentic character coordinates with human height (1.85m) and skeletal bounds.
- [X] **Authentic Block-Compressed Texture Streamer**:
  - Streams `UI.big` offset `0x02f9ec00` (UID `0x07a9a72a`, 16,384 bytes BC3 payload).
  - Pure software BC3/DXT5 decompression into 128x128 32-bit RGBA WebGL2 texture.
- [X] **GitHub Repository Provisioned**:
  - Pushed to `https://github.com/the-rohit-kumar/sleeping-dogs-web`.

---

## Milestone 3: World Streaming & Scene Graph (Completed)

**Goal:** Load Hong Kong street sections, road networks, and building facades from `Game.big` with spatial hierarchy.

- [X] **World Archive Discovery & Streaming**:
  - Integrated `Game.big` / `Game.bix` (7,148 resource entries) into the streaming pipeline.
  - Reverse-engineered city sector bounds and spatial coordinates.
- [X] **Authentic Hong Kong City Sector Mesh Decoder**:
  - Streams `Game.big` offset `0x1b7ef400` (UID `0x7b8f6706`, 1,648 bytes).
  - Unpacks authentic 574-meter broad urban street sector ($X \in [-275\text{m}, +298\text{m}], Y \in [-275\text{m}, +55\text{m}]$).
- [X] **Multi-Node Scene Graph Architecture** (`client/src/scene-graph.ts`):
  - Spatial scene hierarchy maintaining node transforms ($M = T \times R \times S$), colors, materials, and visibility.
  - Interactive scene hierarchy panel allowing runtime toggling of individual nodes.
- [X] **Composite Hong Kong Street Assembly**:
  - Assembles road sector, authentic Sedan vehicle (`Vehicles.big` 0x01f0a400), and pedestrian (`Characters.big` 0x161f3000) with authentic BC3 materials into a unified Hong Kong street scene.
- [X] **Dual Camera Navigation**:
  - Orbit Turntable inspector mode.
  - Street Free-Fly mode with WASD keyboard movement, Shift sprint, and mouse-look.
- [X] **Two-Tier LRU & Persistent Caching**:
  - L1 Memory Cache (128 entries) + L2 Persistent IndexedDB cache for instant zero-latency offline reloads.
- [X] **Automated Browser Verification**:
  - Headless Chrome test suite (`tools/verify_browser.js`) capturing visual verification screenshots.

---

## Milestone 4: Animation, Characters & Audio (Completed)

**Goal:** Animated character models, kinematic combat/locomotion states, and environmental/dialogue audio decoded and played in the browser.

- [X] **Audiokinetic Wwise PCK Subsystem Reverse-Engineered**:
  - Analyzed 2.16GB `data/Audio/SD2/SFX.pck` (759 soundbanks, 1,842 audio streams) and 992MB `data/Audio/SD2/English(US).pck` (42,884 voice streams).
  - Parsed 24-byte `SoundBank` headers and 12-byte stream table records.
  - Integrated standalone `vgmstream` decoder to convert stripped Wwise Vorbis bitstreams (`Codec 0xFFFF`) to 48kHz / 44.1kHz PCM waveforms.
  - Added HTTP streaming `/api/audio/<track_id>` endpoint with LRU decoding cache in `tools/asset_server.py`.
- [X] **Web Audio API Engine (`client/src/audio-engine.ts`)**:
  - Positional 3D spatial audio (`PannerNode`) positioned in world space.
  - Live frequency spectrum analysis (`AnalyserNode`) rendered into real-time UI canvas visualizer.
  - Master volume, track gain controls, and dynamic sound triggers for Hong Kong Ambience, Vehicle Engine, Combat Strike, and Cantonese Dialogue.
- [X] **Authentic Skeletal & Kinematic Motion Player (`client/src/anim-player.ts`)**:
  - Reverse-engineered animation controller states from `sdhdship.exe` binary symbols: `FSR_LightAttack`, `CP_STATE_WALK`, `Wei_Idle`, `Continuous_DriveCar`.
  - Implemented multi-track animation clip evaluator driving bone/joint transformations ($M = T \times R$).
  - Built interactive timeline scrubber, play/pause state controls, and speed multipliers (0.5x, 1.0x, 2.0x).
  - Dynamic vehicle suspension simulation: 28 Hz engine combustion vibration, squat on acceleration, and chassis roll.
- [X] **Automated Browser Test Suite Verified**:
  - Verified combat animation strikes, vehicle engine revving, pedestrian walk cycles, and audio spectrum visualization in headless Chrome.

---

## Milestone 5: Physics, Collision & Camera (Completed)

**Goal:** Controllable character moving through colliding physical geometry with street collision and authentic third-person camera.

- [X] **Havok Physics World & Collision Subsystem Reverse-Engineered (`client/src/physics-engine.ts`)**:
  - Discovered and parsed authentic Havok 2013 tagfile binary containers (`0x57e0e057 0x10c0c010`) in `Game.big` (`hkpMoppBvTreeShape`, `hkpExtendedMeshShape`, `CSidewalk`, `World`).
  - Implemented high-performance Möller–Trumbore ray-triangle intersection querying authentic Hong Kong road geometry (`Game.big` 0x1b7ef400).
  - Ground terrain clamping with normal vector calculation, height snapping within Havok `supportDistance` (0.25m), and slope sliding exceeding `maxSlope` ($\pi/3 = 60^\circ$).
- [X] **Authentic Havok Character Capsule Collider (`hkpCharacterRigidBodyCinfo`)**:
  - Character capsule dimensions: $r = 0.35$m, $h = 1.85$m, gravity $g = -18.0\text{ m/s}^2$.
  - Dynamic horizontal collision deflection against Sedan chassis bounding box (`Vehicles.big` 0x01f0a400) preventing penetration and facilitating edge sliding.
- [X] **Authentic Third-Person Follow Camera (`client/src/camera-controller.ts`)**:
  - Reconstructed Sleeping Dogs `FollowCameraWalk` from binary symbols and parameters:
    - Over-the-shoulder offset: $[0.22, 1.45, 0.0]$, EyeRise: $0.25$, Latitude bounds $[-32^\circ, +63^\circ]$, Radius $[1.8\text{m}, 4.8\text{m}]$.
    - Spring-damper smoothing: `SmoothRatePos` 0.15, `SmoothRateRot` 0.22.
    - Camera occlusion avoidance: Raycasts from character look target to camera eye; applies `Collision Push` and `Collision Rise` to eliminate terrain and wall clipping.
- [X] **Responsive Character Locomotion Controller (`client/src/character-controller.ts`)**:
  - Full WASD locomotion relative to camera azimuth, Shift sprint (5.2 m/s), Space jump (5.5 m/s impulse), and Left-Click combat strike punch.
  - Dynamic synchronization with skeletal animation (`CP_StateWalk`, `Wei_IdleBreathing`, `FSR_CombatStance`) and Wwise combat strike audio.
- [X] **Automated Browser Test Suite Verified (`tools/verify_milestone5.js`)**:
  - Verified follow camera initialization, forward street walking, vehicle obstacle collision deflection, jump gravity landing, and combat strike.

---

## Milestone 6: Gameplay, NPCs, Vehicles & Missions (Completed)

**Goal:** Interactive vehicle driving, pedestrian NPC AI crowd agents, martial arts melee combat, and world mission systems.

- [X] **Interactive Vehicle Entry & Driving Simulation (`client/src/vehicle-controller.ts`)**:
  - Reverse-engineered drivetrain, suspension, and steering parameters from `sdhdship.exe` (`PhysicsCar`, `VehicleGas`, `VehicleHandBrake`).
  - Interactive entry/exit with automatic driver seating and camera transition to `FollowCameraEnterCar`.
  - Ackerman steering kinematics, forward acceleration to 95 km/h, braking, suspension pitch squat/dive, lateral turn body roll, and engine combustion audio loop with RPM pitch scaling.
- [X] **Hong Kong Pedestrian Crowd AI Simulation (`client/src/pedestrian-ai.ts`)**:
  - Sidewalk waypoint navigation along authentic North Point street bounds (`CSidewalk`).
  - State machine derived from binary task trees (`HangOutTask`, `MoveDirectlyToTargetTrack`, `PathfindAwayFromTargetTrack`): `IDLE`, `WALK`, `FLEE` (panic response to speeding vehicles/combat), and `STAGGER` (physical knockback).
  - Autonomous spatial collision avoidance against Wei Shen and parked vehicles.
- [X] **Authentic Martial Arts Melee Combat System (`client/src/combat-system.ts`)**:
  - Soft lock-on targeting (`TargetDistanceHysteresis`) finding nearest pedestrian suspect within $3.2$m forward cone.
  - Multi-hit combo chaining (Jab $\to$ Cross $\to$ Heavy Roundhouse Finisher) with synchronized Wwise impact audio `combat_strike`.
  - Target physical stagger knockback and health deduction.
  - Authentic Sleeping Dogs progression: successful hits boost `FACE` adrenaline meter (+15%) and award `TRIAD` respect points.
- [X] **Hong Kong World HUD, Mission Directive & Mini-Map Radar (`client/index.html` & `client/src/main.ts`)**:
  - Sleek top-center Mission Directive banner with progressive patrol objectives.
  - Top-right Health bar (100%), Face Meter (yellow dragon gauge), Triad & Police score badges.
  - 360° circular Mini-Map radar widget rendering player orientation needle, Sedan vehicle position, pedestrian blips, and street boundaries.
  - Floating action prompt (`[E] ENTER SEDAN CHASSIS` / `[L-CLICK] COMBO STRIKE`).
- [X] **Automated Browser Test Suite Verified (`tools/verify_milestone6.js`)**:
  - Verified world HUD and radar initialization, interactive Sedan vehicle entry and driving up to 45.9 km/h, pedestrian crowd AI navigation & panic fleeing, and martial arts combo strikes.
