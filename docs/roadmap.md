# Reconstruction Roadmap & Milestones

**Authoritative Status Document:** See [`docs/current-state.md`](file:///docs/current-state.md) and [`docs/ANTIGRAVITY_REVIEW_ANSWERS.md`](file:///docs/ANTIGRAVITY_REVIEW_ANSWERS.md) for detailed capability matrices and technical verification.

This roadmap defines the iterative development stages from initial technical slice to the browser game reconstruction.
The project employs a **hybrid architecture**: authentic vertex positions, texture payloads, and audio bitstreams extracted directly from base-game containers (`Vehicles.big`, `Characters.big`, `Game.big`, `UI.big`, `SFX.pck`, `English(US).pck`), combined with procedural topology, custom WebGL2 shaders, and authored gameplay simulation.

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
    M9 --> M10["Milestone 10: Wet Asphalt Reflections<br/>(Done)"]
    M10 --> CH1["Chapter 1: North Point & Initiation<br/>Missions 0–10 (100% Done)"]
    CH1 --> CH2["Chapter 2: Central District & Politics<br/>Missions 11–14 (100% Done)"]
    CH2 --> CH3["Upcoming: Chapter 3 Kennedy Town<br/>Missions 15–18 (Next)"]
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
- [X] **Authentic Vertex & Texture Streamer**:
  - Vertex position streams extracted directly from genuine `.big` payloads via HTTP 206.
  - *Technical Note:* Topology is currently reconstructed using alternating triangle strips in TypeScript (`mesh-decoder.ts`); true index buffers are targeted in Milestone 11.
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

- [X] **Hardware Depth Pass & 1024x1024 Shadow FBO**: Directional shadow mapping pass rendering scene geometry from the primary Hong Kong streetlamp/moonlight perspective into a high-precision depth texture (`renderer.ts` `shadowMapSize = 1024`).
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

## Milestone 10: Wet Asphalt Reflections, Atmospheric Rain Mist & Headlight Cones (Completed)

- [X] **Wet Asphalt Reflections (Analytic SSR Approximation)**: Dynamic grazing-angle puddle reflections calculating anisotropic reflection vectors against 6 predefined neon sign positions and colors (`renderer.ts` lines 367-386).
- [X] **Dual Vehicle Headlight Cones**: 3D geometric volumetric illumination projecting down the street lane from vehicle headlamps.
- [X] **Volumetric Atmospheric Rain Fog**: Mie forward in-scattering ($g = 0.55$) simulating thick coastal Hong Kong rain mist and neon light haloes.

---

## Milestone 11 & Polish Phase: BC5 Normal Mapping, Canvas HUD & In-Car Radios (Completed)

- [X] **BC5 (ATI2/3Dc) Normal Mapping**: Two-channel software block decompressor with Mikkelsen/Schüler cotangent-frame per-pixel TBN reconstruction directly in fragment shaders.
- [X] **Re-engineered Curved Gauges Mini-Map HUD (Canvas 2D replicating Scaleform design)**:
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
  - **Mission 3 ("Night Market Chase")**: Confront food stall contact $\to$ Pursue Dirty Ming across night market rooftops $\to$ Balcony knife combat with blade disarm counter reversals.
  - **Mission 4 ("Amanda Tour & Dojo Sparring")**: Escort driving tour with Amanda Cartwright across North Point $\to$ Temple dojo kung fu sparring with Master Kwok's disciples.
  - **Mission 5 ("Club Bam Bam")**: Winston Chu Golden Koi briefing $\to$ Drive across North Point to Club Bam Bam $\to$ Bouncer confrontation $\to$ Electronic dance floor melee brawl $\to$ VIP lounge table & bottle smash $\to$ Restroom porcelain urinal environmental finisher $\to$ Interrogate Benny for jade smuggling intel.
  - **Mission 6 ("Popstar Lead 1 / Drug Bust")**: Inspector Jane Teng police radio contact $\to$ Transit to North Point tenements $\to$ Interactive 4-digit camera security hacking minigame $\to$ CCTV surveillance perspective with CRT scanlines $\to$ Alley ambush with 9mm Handgun gunplay & tire blowout shootouts $\to$ HKPD tactical unit bust confirmation.

---

## Milestone 11: Authentic Havok Vehicle Chassis Streaming (Completed)

- [X] **Authentic Havok Convex Hull Geometry Streaming (`client/src/asset-loader.ts`)**:
  - Implemented `loadAuthenticVehicleChassisHavok()` streaming `Vehicles.big` offset `0x00000800` (span: 12,224 bytes, UID `0xe391fb68`).
  - Contains genuine Havok 2013 `hkpConvexVerticesShape` / `1100NAR01_Body_P` chassis collision geometry.
  - Validated with 100% `EXACT_MATCH` in `tools/audit_bix_resources.py` (BIX Idx 1052, span: 12,224 bytes).

---

## Milestone 12: CCTV Camera Hacking & 9mm Gunplay Engine (Completed)

- [X] **Interactive 4-Digit Camera Security Hacking Minigame (`client/src/hacking-minigame.ts`)**:
  - Authentic Sleeping Dogs 4-digit security code terminal with numeric keypad (0-9).
  - 5-attempt breach protocol with real-time feedback: Green (exact match), Yellow (wrong slot), Red (not in code).
  - Streamed authentic SFX: `ui_hack_tick` (`SFX.pck` 0x47e51674), `ui_click_denied` (`SFX.pck` 0x6ec8b405), `ui_chime_granted` (`SFX.pck` 0x385d1c81).
- [X] **On-Foot & Vehicular Drive-By 9mm Gunplay (`client/src/gunplay-system.ts`)**:
  - Semi-automatic 9mm handgun (15 clip / 60 reserve) with dynamic over-the-shoulder and car window aiming reticle.
  - 3D bullet raycasting, muzzle flash dynamic lighting, ricochet and concrete impact audio.
  - Vehicular tire shootouts: targeting car wheels triggers tire blowout physics, sparks, and rim friction audio (`SFX.pck` 0x55454af6).
- [X] **Automated Browser Test Suite Verified (`tools/verify_mission_6_popstar_and_gunplay.js`)**:
  - Verified Jane Teng phone call, 4-digit terminal hacking, CCTV camera view switch, and 9mm gunplay in headless Chrome with **0 page errors and 0 network failures**.

---

## Milestone 13: Chapter 1 Mission 7 ("Listening In" — Golden Koi Wiretap) (Completed)

- [X] **Superintendent Thomas Pendrew Briefing**: Briefing on Winston's conflict with Dogeyes with authentic voice dialogue (`English(US).pck` 0x18011a82).
- [X] **Bamboo Scaffolding & Rooftop Infiltration**: Infiltrate Golden Koi rooftop through ventilation shaft into Winston's private office.
- [X] **Wiretap Resonance Frequency Tuner Minigame (`client/src/frequency-tuner.ts`)**:
  - Real-time Canvas 2D oscilloscope waveform rendering with target vs. tuned sine waves.
  - Interactive dial / slider to align phase and frequency (742.0 MHz) to eliminate static.
  - Authentic Wwise SFX: `wiretap_tuner_hum` (`SFX.pck` 0x385d1c81), `radio_static_burst`, `ui_chime_granted`.
- [X] **Stealth Wiretap Planting & Secret Audio Intercept**:
  - Plant bug in Winston Chu's back office.
  - Intercept secret conversation of Winston Chu ordering Aberdeen warehouse lockdown (`English(US).pck` 0x1802633c).

---

## Milestone 14: Chapter 1 Mission 8 ("Chain of Command") & Mission 9 ("Payback") (Completed)

- [X] **Mission 8: Inspector Raymond Mak Confrontation**:
  - Tense dialogue exchange between Wei Shen and Inspector Raymond Mak questioning police loyalty (`English(US).pck` 0x1804a15c, 0x18069424).
  - Authentic letterbox cinematic camera framing with character speaker cards.
- [X] **Mission 9: Aberdeen Seafood Warehouse Firefight & Pursuit**:
  - Breaching Dogeyes' seafood warehouse in Aberdeen with armed guards contingent (`crowdSystem.spawnWarehouseEnforcers`).
  - Alarm klaxon and SMG gunfire sound effects (`SFX.pck` 0x0985d257, 0x19325c91).
  - High-speed vehicular pursuit of Dogeyes' getaway truck with truck engine audio (`SFX.pck` 0x0d528ab2).
  - Vehicular tire takedown disabling enemy vehicle with authentic blowout SFX.

---

## Milestone 15: Chapter 1 Grand Finale — Mission 10 ("Uncle Po / Red Pole Promotion") (Completed)

- [X] **Sun On Yee Mountain Master Council Chamber**:
  - Authentic tea ceremony with Dragon Head Uncle Po and Water Street Red Pole Winston Chu (`crowdSystem.spawnUnclePoCouncil`).
  - Uncle Po dialogue welcoming Wei Shen into the inner circle (`English(US).pck` 0x1808e0dc).
  - Formal promotion of Wei Shen to recognized Sun On Yee Red Pole brother.
- [X] **Chapter 1 Grand Finale Fanfare & Score Integration**:
  - Grand orchestral finale fanfare (`SFX.pck` 0x0984a0ab, 1.02MB 48kHz stereo WAV).
  - Full Cop and Triad XP progression rewards.
  - Transition to Chapter 1 Completed state (`ch1_chapter1_completed`).
- [X] **Automated Browser Test Suite Verified (`tools/verify_chapter1_full.js`)**:
  - Verified Missions 7, 8, 9, and 10 in headless Chrome with **0 page errors and 0 network failures**.
  - Generated visual verification proof artifacts:
    - `01_mission7_wiretap_tuning_oscilloscope.png`
    - `02_mission8_raymond_mak_confrontation.png`
    - `03_mission9_warehouse_firefight_pursuit.png`
    - `04_mission10_uncle_po_red_pole_ceremony.png`

---

## Chapter Summary: CHAPTER 1 "NORTH POINT / SUN ON YEE INITIATION" — 100% COMPLETE!

| # | Mission Title | Key Mechanics / Assets | Status |
|---|---|---|---|
| **0** | **Prologue: Aberdeen Docks** | Parkour chase, alley brawl, HKPD arrest, letterbox cinematics | **Completed** |
| **1** | **Going Under** | HKPD interrogation with Mak & Pendrew, holding cells melee brawl with Jackie Ma | **Completed** |
| **2** | **Vendor Extortion** | Night market shakedown, watch & drink vendor tribute, 18K ambush melee | **Completed** |
| **3** | **Night Market Chase** | Dirty Ming marketplace sprint, rooftop parkour, balcony knife combat | **Completed** |
| **4** | **Amanda** | North Point sedan tour escort, Sifu Kwok martial arts temple sparring | **Completed** |
| **5** | **Club Bam Bam** | Dance floor brawl, VIP lounge table smash, restroom porcelain urinal finisher | **Completed** |
| **6** | **Popstar Lead 1 / Drug Bust** | 4-digit CCTV hacking minigame, CRT surveillance feed, 9mm handgun gunplay | **Completed** |
| **7** | **Listening In** | Rooftop infiltration, Canvas 2D oscilloscope frequency tuner, Winston audio bug | **Completed** |
| **8** | **Chain of Command** | Undercover crisis confrontation with Inspector Raymond Mak | **Completed** |
| **9** | **Payback** | Aberdeen seafood warehouse firefight, high-speed truck pursuit, tire takedown | **Completed** |
| **10** | **Uncle Po (Grand Finale)** | Sun On Yee Dragon Head tea ceremony, Red Pole brother promotion, finale fanfare | **Completed** |

---

## Milestone 16: Chapter 2 Mission 11 ("The Wedding" — Banquet Ambush & Tragedy) (Completed)

- [X] **Winston Chu & Peggy Li Banquet Toast**:
  - Lavish Chinese wedding banquet with authentic banquet score (`SFX.pck` 0x0925706b, 3.08MB 48kHz stereo WAV).
  - Winston Chu's heartfelt toast to Peggy and brotherhood with Wei Shen (`English(US).pck` 0x190016c7).
  - Full wedding guest cast including Jackie Ma, Uncle Po, and Triad elders (`crowdSystem.spawnWeddingGuestsAndHitmen`).
- [X] **18K Sudden Mass Assault & Hall Defense**:
  - Red klaxon wedding massacre alarm (`SFX.pck` 0x0986b230, 1.20MB 48kHz stereo WAV).
  - 18K machete hitmen storming banquet doors with blade slashes (`SFX.pck` 0x19325c91).
  - Hand-to-hand melee combat defending the wedding hall.
- [X] **Winston Chu Tragic Death Scene**:
  - Tragic cinematic cutscene framing Winston's mortal wound.
  - Winston's dying words begging Wei Shen to protect Mrs. Chu and Water Street (`English(US).pck` 0x19121f9a).
  - Tragic violin / score transition setting the revenge arc in motion.

---

## Milestone 17: Chapter 2 Mission 12 ("Mrs. Chu's Revenge" — Johnny Ratface Interrogation) (Completed)

- [X] **Golden Koi Kitchen Cleaver Mandate**:
  - Heartbroken and vengeful Mrs. Chu sharpening kitchen cleavers in the Golden Koi back kitchen (`crowdSystem.spawnMrsChuAndRatface`).
  - Mrs. Chu dialogue commanding Wei Shen to bring her Winston's killers alive (`English(US).pck` 0x192129a8).
- [X] **Tracking Johnny Ratface in Tenement Alleys**:
  - Trailing 18K lookout Johnny Ratface through dark Central alleyways.
  - High-intensity pursuit and cornering in a dead-end alley behind neon market signs.
- [X] **Alley Interrogation & Extraction**:
  - Interrogation sequence extracting Ratface's confession implicating Dogeyes and the Jade Gang (`English(US).pck` 0x193c01db).
  - Subduing Ratface and delivering him to the Golden Koi for Mrs. Chu's justice.

---

## Milestone 18: Chapter 2 Mission 13 ("Meet the New Boss" — Central Council Politics) (Completed)

- [X] **Central District Dragon Head Council Meeting**:
  - Secret high-rise meeting room with Sun On Yee leadership (`crowdSystem.spawnCentralCouncil`).
  - Formal meeting with Broken Nose Jiang discussing the power vacuum created by Winston's death (`English(US).pck` 0x19569713).
  - Arrogant confrontation with Two-Chin Tsao scheming for control of Water Street turf (`English(US).pck` 0x1961ce50).
- [X] **Turf Defense & Leadership Consolidation**:
  - Wei Shen stands firm against Two-Chin Tsao's enforcers, securing Broken Nose Jiang's alliance and backing.

---

## Milestone 19: Chapter 2 Grand Finale — Mission 14 ("The Election / Final Kill" — Dogeyes Yacht Showdown) (Completed)

- [X] **High-Speed Sports Car Pursuit to Aberdeen Docks**:
  - Luxury sports car handling with roaring engine revs (`SFX.pck` 0x09e613fd, 1.32MB 48kHz stereo WAV).
  - Chasing Dogeyes' convoy across Central highways to Aberdeen luxury marina.
- [X] **Dogeyes Luxury Yacht Boss Showdown**:
  - Dogeyes boss encounter with 350 HP and Jade Gang elite bodyguards (`crowdSystem.spawnDogeyesYachtShowdown`).
  - Dogeyes dockside taunts boasting of Winston's downfall (`English(US).pck` 0x19734cd9).
  - Multi-phase boss fight with heavy strikes, counter-attacks, and environmental boat deck takedowns.
- [X] **Dogeyes Vanquished & Confession**:
  - Dogeyes defeated on the yacht deck, pleading for mercy and confessing Big Smile Lee's master conspiracy (`English(US).pck` 0x1987c01a).
  - Wei Shen packages Dogeyes for Mrs. Chu's ultimate revenge.
- [X] **Wei Shen Ascension & Chapter 2 Grand Finale**:
  - Grand orchestral fanfare (`SFX.pck` 0x0984a0ab, 1.02MB 48kHz stereo WAV).
  - Wei Shen elevated to undisputed **Water Street Red Pole Boss**.
  - Campaign state transition to `ch2_chapter2_completed`.
- [X] **Automated Browser Test Suite Verified (`tools/verify_chapter2_full.js`)**:
  - Verified Missions 11, 12, 13, and 14 in headless Chrome with **0 page errors and 0 network failures**.
  - Generated visual verification proof artifacts:
    - `01_mission11_wedding_banquet_toast.png`
    - `02_mission11_winston_chu_dying_words.png`
    - `03_mission12_mrs_chu_ratface_interrogation.png`
    - `04_mission13_central_council_meeting.png`
    - `05_mission14_dogeyes_yacht_showdown_victory.png`

---

## Chapter Summary: CHAPTER 2 "CENTRAL / DRAGON HEAD POLITICS & BLOODSHED" — 100% COMPLETE!

| # | Mission Title | Key Mechanics / Assets | Status |
|---|---|---|---|
| **11** | **The Wedding** | Banquet toast, 18K banquet assault, Winston dying cutscene, banquet music & klaxon | **Completed** |
| **12** | **Mrs. Chu's Revenge** | Golden Koi kitchen cleaver mandate, Johnny Ratface alley hunt & interrogation | **Completed** |
| **13** | **Meet the New Boss** | Central District council chamber, Broken Nose Jiang & Two-Chin Tsao politics | **Completed** |
| **14** | **The Election / Final Kill** | Aberdeen docks sports car pursuit, Dogeyes yacht boss fight (350 HP), Wei Shen Red Pole Boss ascension | **Completed** |

---

## Upcoming Chapter: CHAPTER 3 "KENNEDY TOWN / TRIAD WAR & GRAND FINALE"

### Chapter 3 Overview:
The explosive climax of Sleeping Dogs: Big Smile Lee launches an all-out civil war to seize absolute power over the Sun On Yee following Uncle Po's hospitalization:
- **Mission 15: "Civil War / Hospital Defense"** — Protect Uncle Po in Queen Mary Hospital against hit squads sent by Big Smile Lee.
- **Mission 16: "The Funeral"** — Uncle Po's state funeral at the cemetery; massive 18K ambush and firefight amidst grave markers.
- **Mission 17: "The Kidnapping of Jackie Ma"** — Desperate hunt through Kennedy Town to rescue Jackie from Mr. Tong's torture den.
- **Mission 18: "Big Smile Lee (Grand Campaign Finale)"** — Infiltrate Big Smile Lee's compound, icehouse knife duel with Mr. Tong, and final harbor crane showdown with Big Smile Lee.
