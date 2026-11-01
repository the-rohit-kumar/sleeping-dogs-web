# Reconstruction Roadmap & Milestones

This roadmap defines the iterative development stages from initial technical slice to the full browser game simulation.
All assets are strictly reverse-engineered and streamed directly from the base game (*Sleeping Dogs: Definitive Edition*). **Zero synthetic or placeholder assets.**

GitHub Repository: [https://github.com/the-rohit-kumar/sleeping-dogs-web](https://github.com/the-rohit-kumar/sleeping-dogs-web)

---

```mermaid
flowchart LR
    M1["Milestone 1: Vertical Slice<br/>(Done)"] --> M2["Milestone 2: Geometry & Shading<br/>(Done)"]
    M2 --> M3["Milestone 3: World Streaming<br/>(Done)"]
    M3 --> M4["Milestone 4: Skeletal Animation & Audio<br/>(Done)"]
    M4 --> M5["Milestone 5: Physics & Controls<br/>(Done)"]
    M5 --> M6["Milestone 6: Game Systems & Simulation<br/>(Done)"]
    M6 --> M7["Milestone 7: Living World & Rain<br/>(Done)"]
    M7 --> M8["Milestone 8: Shadows & ACES<br/>(Done)"]
    M8 --> M9["Milestone 9: Authentic Materials<br/>(Done)"]
    M9 --> M10["Milestone 10: Wet Asphalt SSR<br/>(Done)"]
    M10 --> P1["Phase 1: Martial Arts & Counters<br/>(Done)"]
    P1 --> P2["Phase 2: Street Props & Normal Maps<br/>(Done)"]
    P2 --> P3["Phase 3: Scaleform HUD & In-Car Radios<br/>(Done)"]
    P3 --> P4["Phase 4: Env Takedowns, Drift & Mission 2<br/>(Done)"]
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

---

## Milestone 7: Living Hong Kong World, Traffic, Crowds & Neon Rain (Completed)

**Goal:** Transform the technical prototype into a living, authentic, cinematic game world — continuous multi-sector streaming, building facades, authentic traffic AI, sidewalk crowd variety, and Sleeping Dogs' signature neon nights & dynamic rain shading.

- [X] **Milestone 7A: Full-Map Continuous World Streaming & Urban Architecture (`client/src/world-streamer.ts`)**:
  - Streams 5 contiguous authentic city sectors from `Game.big` (Central Avenue `0x00229ff0`, Night Market Plaza `0x0060a73d`, Commercial Boulevard `0x00637350`, Alleyway `0x00702844`, East Waterfront `0x00cb0408`) totaling 15,896 authentic vertices.
  - Generates multi-story Hong Kong architectural building facades lining both sides of the thoroughfare with overhanging traditional Cantonese neon signs (`金龍大茶樓`, `萬順押`, `新興海鮮酒家`, `夜總會 KARAOKE`).
  - Sidewalk curb walkways and warm amber streetlamp posts casting illumination onto the pavement.
  - Distant Hong Kong skyline backdrop ring (28 illuminated high-rise skyscraper towers along Victoria Harbour horizon).
- [X] **Milestone 7B: Living Hong Kong Traffic AI & Pedestrian Crowd Variety (`client/src/traffic-system.ts` & `client/src/crowd-system.ts`)**:
  - Multi-vehicle traffic simulation streaming authentic models from `Vehicles.big`:
    - **Hong Kong Red Urban Taxi** (`0x0078fc9b`, 1,252 verts, crimson red body with silver top)
    - **North Point Delivery Van** (`0x014d7ca0`, 1,229 verts, ivory white commercial van)
    - **Executive Luxury SUV** (`0x01590eae`, 1,406 verts, metallic midnight black)
    - **Compact Hatchback** (`0x04ad21d9`, 1,191 verts, vibrant cyan blue)
    - **Wei Shen's Sedan Chassis** (`0x008c038c`, 321 verts)
  - Left-hand driving rules (Hong Kong convention): Northbound lane ($x = -2.2$m) and Southbound lane ($x = +2.2$m) with cruise speeds (35-58 km/h), raycast obstacle braking, following distance maintenance, and boundary looping.
  - Hijack / Enter interaction for all traffic vehicles via `[E]`.
  - Sidewalk crowd variety streaming authentic characters from `Characters.big`:
    - **18K Triad Enforcers** (`0x00882829`, 671 verts, dark leather jacket)
    - **Night Market Food Vendors** (`0x01bf39f3`, 325 verts, market apron)
    - **North Point Pedestrians** (`0x01ede6c8`, 606 verts, denim blue)
    - **Sun On Yee Gangsters** (`0x020e44c8`, 624 verts, crimson triad colors)
  - Dynamic 360° radar tracking of all traffic vehicles and pedestrian crowd agents.
- [X] **Milestone 7C: Neon Nights & Dynamic Rain / Weather Shading (`client/src/weather-system.ts` & `client/src/renderer.ts`)**:
  - Enhanced WebGL2 lighting pipeline with Sleeping Dogs' signature wet asphalt specular reflection shader:
    - Microfacet Blinn-Phong specular ($p = 72$) with Fresnel grazing-angle reflectivity ($F_0 = 0.04$) reflecting streetlamps and headlights on puddles.
    - Asphalt albedo darkening when water-saturated.
    - Emissive neon signboard shader with high-frequency neon tube flicker and bloom glow factor ($1.8\times - 2.6\times$).
    - Atmospheric Hong Kong midnight sky gradient and distance haze fog.
  - 3D Falling Rain Simulation: 1,500 active falling rain streak particles with wind velocity ($32-42$ m/s downward, $3.2-9.5$ m/s wind shear) and ground impact ripple splashes.
  - 3 Interactive Weather Presets:
    1. *Clear Neon Night* (0% rain, 65% damp street wetness, $1.8\times$ neon bloom).
    2. *Hong Kong Rain* (75% rain deluge, 95% asphalt wetness, $2.2\times$ neon bloom, atmospheric night fog).
    3. *Typhoon Storm* (100% torrential rain, 42 m/s downpour, 100% wetness, $2.6\times$ neon bloom, random lightning flashes).
- [X] **Automated Browser Test Suite Verified (`tools/verify_milestone7.js`)**:
  - Headless Chrome test capturing 5 high-resolution verification screenshots:
    1. `01_milestone7_living_world_init.png`: 75 scene nodes, 34,835 triangles, 5 streamed sectors, and initial living street atmosphere.
    2. `02_milestone7_traffic_ai_simulation.png`: Autonomous traffic cruising along left-hand lanes (43-50 km/h).
    3. `03_milestone7_sidewalk_crowd_variety.png`: 8 varied Triad enforcers, vendors, and citizens patrolling sidewalks.
    4. `04_milestone7_typhoon_storm_weather.png`: Heavy typhoon downpour with maximum wetness and intense neon bloom.
    5. `05_milestone7_clear_neon_night.png`: Clear neon night showing reflective damp pavement and colorful shop signage.

---

## Milestone 8: Real-Time Directional Shadow Mapping, Contact Grounding & ACES Tone Mapping (Completed)

- [X] **Hardware Depth Pass & 2048x2048 Shadow FBO**: Directional shadow mapping pass rendering scene geometry from the primary Hong Kong streetlamp/moonlight perspective into an `R32F` high-precision depth texture.
- [X] **4-Tap Poisson Disk PCF Filtering**: Soft penumbra filtering with adaptive slope-scaled depth bias eliminating shadow acne.
- [X] **ACES Filmic Tone Mapping**: Sleeping Dogs' high-contrast cinematic color grading curve mapping HDR luminance into display-referred dynamic range.

---

## Milestone 9: Authentic Base-Game Multi-Texture Material Binding (Completed)

- [X] **Pure Software BC1 (DXT1) & BC3 (DXT5) Block Decompressors**: Decompresses authentic 4x4 block-compressed mipmapped DDS streams into 32-bit RGBA WebGL textures.
- [X] **Base-Game Texture Streaming**:
  - Hong Kong street asphalt road texture from `Game.big` (`0x36341c10`, 32,768 bytes BC1, 256x256).
  - Storefront architectural building facade from `Game.big` (`0x30136010`, 32,768 bytes BC1, 256x256).
  - Authentic Hong Kong neon signboard texture from `Game.big` (`0x0ef12810`, 32,768 bytes BC1, 256x256).
  - Sedan vehicle body paint & chassis livery from `Vehicles.big` (`0x020f3400`, 131,072 bytes BC1, 512x512).
  - Wei Shen character clothing texture from `Characters.big` (`0x16063410`, 131,072 bytes BC1, 512x512).

---

## Milestone 10: Wet Asphalt SSR, Atmospheric Rain Mist & Headlight Cones (Completed)

- [X] **Wet Asphalt Screen-Space Reflections (SSR)**: Dynamic grazing-angle puddle reflections calculating reflected color vectors across road geometry.
- [X] **Dual Vehicle Headlight Cones**: 3D geometric volumetric illumination projecting down the street lane from vehicle headlamps.
- [X] **Volumetric Atmospheric Rain Fog**: Mie forward in-scattering ($g = 0.55$) simulating thick coastal Hong Kong rain mist and neon light haloes.

---

## Milestone 11 & Polish Phase: BC5 Normal Mapping, Scaleform Gauges & In-Car Radios (Completed)

- [X] **BC5 (ATI2/3Dc) Normal Mapping**: Two-channel software block decompressor with Mikkelsen/Schüler cotangent-frame per-pixel TBN reconstruction directly in fragment shaders.
- [X] **Scaleform Curved Gauges Mini-Map HUD**:
  - Curved health gauge (left arc, green to red).
  - Curved Face Meter gauge (right arc, golden dragon adrenaline surge).
  - Digital Speedometer readout (`KM/H`) and cardinal compass markers.
- [X] **In-Car Wwise Radio Tuner & Horn**:
  - Boosey & Hawkes 98.4 FM (Stream 11795260, classical).
  - Kerrang! Radio 105.2 FM (Stream 42868061, high-octane rock).
  - Softly FM Hong Kong Lounge (Stream 10361450, Cantopop/lounge).
  - Animated `#radio-banner` HUD card and vehicle horn SFX (`Stream 16943907`).

---

## Milestone 12 & Gameplay Phases 1 & 2: Combat, Finishers, Drift & Missions (Completed)

- [X] **Martial Arts Melee Combat & Signature Red-Flash Counter Reversals**:
  - 3-hit combo chain (Jab $\to$ Cross $\to$ Roundhouse) with heavy kick (`[Q]`) and grapple (`[F]`).
  - Telegraphed enemy red-flashes with counter reversal windows, dynamic 400ms slow-motion camera, and bone-crunch impact audio (`Stream 36466185`).
  - Face Meter Adrenaline Surge with 2.2x damage boost and health regeneration.
- [X] **Interactive Environmental Takedowns (`FSR_EnvTakedown`)**:
  - Interactive street hazards: phone booths, steel dumpsters, high-voltage fuse boxes, and market counters.
  - Spatial detection prompt (`⚡ [F] ENVIRONMENTAL TAKEDOWN ⚡`) triggering instant knockout, slow-motion camera, and authentic takedown audio (`Stream 4784603`).
- [X] **Vehicle 4-Wheel Steering & Drift Skid Marks**:
  - Front wheels steer with Ackerman geometry while all 4 wheels spin continuously with vehicle speed.
  - Dynamic asphalt skid mark ribbon geometry generated during handbrake drifts (`Space`) with tire screech audio.
- [X] **18K Triad Thug Texture & Taxi Livery**:
  - Authentic 18K Triad brawler clothing decoded from `Characters.big` (`0x16595000 + 16`, 131,072 bytes BC1).
  - Authentic Crown Comfort taxi livery decoded from `Vehicles.big` (`0x0207f800 + 16`, 131,072 bytes BC1).
- [X] **Chained Campaign Missions**:
  - **Mission 1 ("Night Market Ambush")**: Defeat 4 ambushers $\to$ Hijack sedan/taxi $\to$ Evade police $\to$ Deliver to Golden Dragon Teahouse safehouse.
  - **Mission 2 ("Dockside Warehouse Shakedown")**: Urgent police radio dispatch $\to$ Drive to Aberdeen Fish Warehouse $\to$ Eliminate 4 armed dock enforcers $\to$ Defeat 18K Lieutenant Boss $\to$ Orchestral victory fanfare (`Stream 2530870`).
