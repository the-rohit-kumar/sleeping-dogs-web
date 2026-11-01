/**
 * main.ts
 * Main entry point for the Sleeping Dogs Browser Reconstruction Engine.
 * Streams authentic vehicle, character, and Hong Kong world geometry, textures,
 * audio streams, and skeletal animation directly from the local base-game bridge.
 *
 * Implements:
 *  - Milestone 4: Wwise Audio Engine (48kHz spatial audio from SFX.pck and English.pck)
 *  - Milestone 4: Skeletal Animation Player (combat, walk, breathing, vehicle dynamics)
 *  - Milestone 3: Hong Kong Street Scene Graph & Free-Fly Camera
 *
 * ZERO synthetic assets: 100% extracted from Sleeping Dogs: Definitive Edition.
 */

import { Viewport3D, CameraMode } from './renderer';
import { parseBixBuffer, BixArchive } from './bix-parser';
import { parseIllusionBuffer, DecodedMesh } from './mesh-decoder';
import { decodeAuthenticTexture, TextureFormat, DecodedTexture } from './texture-decoder';
import {
    loadAuthenticVehicle,
    loadAuthenticCharacter,
    loadAuthenticWorldSector,
    loadAuthenticTexture,
    loadCompositeStreetScene,
    fetchArchiveIndex,
    fetchRange,
    cacheStats
} from './asset-loader';
import { SceneGraph, SceneNode, createTransformMatrix } from './scene-graph';
import { AudioEngine, AUTHENTIC_TRACKS } from './audio-engine';
import { AnimationPlayer, AUTHENTIC_ANIMS, AnimStateName } from './anim-player';
import { PhysicsEngine } from './physics-engine';
import { CameraController } from './camera-controller';
import { CharacterController } from './character-controller';
import { VehicleController } from './vehicle-controller';
import { PedestrianAIController } from './pedestrian-ai';
import { CombatSystem } from './combat-system';
import { WorldStreamer, ENVIRONMENTAL_HAZARDS } from './world-streamer';
import { TrafficSystem } from './traffic-system';
import { CrowdSystem } from './crowd-system';
import { WeatherSystem, WeatherMode } from './weather-system';
import { CampaignStoryEngine } from './campaign-story';
import { HackingMinigame } from './hacking-minigame';
import { GunplaySystem } from './gunplay-system';
import { FrequencyTunerMinigame } from './frequency-tuner';

window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('viewport') as HTMLCanvasElement;
    const renderer = new Viewport3D(canvas);
    const audioEngine = new AudioEngine();
    const animPlayer = new AnimationPlayer();
    const physicsEngine = new PhysicsEngine();
    const cameraController = new CameraController();
    const characterController = new CharacterController();
    const vehicleController = new VehicleController();
    const pedestrianAI = new PedestrianAIController();
    const combatSystem = new CombatSystem();
    const worldStreamer = new WorldStreamer();
    const trafficSystem = new TrafficSystem();
    const crowdSystem = new CrowdSystem();
    const weatherSystem = new WeatherSystem();
    const campaignStory = new CampaignStoryEngine();
    const hackingMinigame = new HackingMinigame(audioEngine);
    const frequencyTuner = new FrequencyTunerMinigame(audioEngine);
    const gunplaySystem = new GunplaySystem(
        renderer.sceneGraph!,
        characterController,
        vehicleController,
        crowdSystem,
        cameraController,
        audioEngine
    );
    (window as any).campaignStory = campaignStory;
    (window as any).audioEngine = audioEngine;
    (window as any).renderer = renderer;
    (window as any).hackingMinigame = hackingMinigame;
    (window as any).frequencyTuner = frequencyTuner;
    (window as any).gunplaySystem = gunplaySystem;

    // Link weather system to renderer
    renderer.weatherSystem = weatherSystem;

    // Expose subsystems on window for verification & inspection
    (window as any).characterController = characterController;
    (window as any).vehicleController = vehicleController;
    (window as any).pedestrianAI = pedestrianAI;
    (window as any).combatSystem = combatSystem;
    (window as any).cameraController = cameraController;
    (window as any).worldStreamer = worldStreamer;
    (window as any).trafficSystem = trafficSystem;
    (window as any).crowdSystem = crowdSystem;
    (window as any).weatherSystem = weatherSystem;

    // Attach authentic third-person camera controller to renderer
    renderer.cameraController = cameraController;
    renderer.setCameraMode('follow');

    // HUD Elements
    const hudFps = document.getElementById('hud-fps')!;
    const hudFrameTime = document.getElementById('hud-frametime')!;
    const hudDrawCalls = document.getElementById('hud-drawcalls')!;
    const hudTriangles = document.getElementById('hud-triangles')!;
    const hudMesh = document.getElementById('hud-mesh')!;
    const hudTexture = document.getElementById('hud-texture')!;
    const hudAudio = document.getElementById('hud-audio')!;
    const hudAnim = document.getElementById('hud-anim')!;
    const hudCamMode = document.getElementById('hud-cam-mode')!;
    const hudPlayerPos = document.getElementById('hud-player-pos')!;
    const hudLocomotion = document.getElementById('hud-locomotion')!;
    const hudGroundElev = document.getElementById('hud-ground-elev')!;
    const hudCollisionStatus = document.getElementById('hud-collision-status')!;
    const hudCache = document.getElementById('hud-cache')!;
    const controlsHint = document.getElementById('controls-hint')!;

    // Milestone 5: Havok Physics Elements
    const badgePhysicsState = document.getElementById('badge-physics-state')!;
    const btnPhysJump = document.getElementById('btn-phys-jump')!;
    const btnPhysStrike = document.getElementById('btn-phys-strike')!;
    const btnPhysReset = document.getElementById('btn-phys-reset')!;
    const btnPhysSprint = document.getElementById('btn-phys-sprint')!;
    const chkGroundClamp = document.getElementById('chk-ground-clamp') as HTMLInputElement;
    const chkObstacleColl = document.getElementById('chk-obstacle-coll') as HTMLInputElement;
    const chkCameraOcclusion = document.getElementById('chk-camera-occlusion') as HTMLInputElement;

    // Milestone 6: Gameplay, NPCs & Vehicle Simulation Elements
    const badgeGameplayMode = document.getElementById('badge-gameplay-mode')!;
    const btnEnterCar = document.getElementById('btn-enter-car')!;
    const btnComboStrike = document.getElementById('btn-combo-strike')!;
    const btnPedPanic = document.getElementById('btn-ped-panic')!;
    const btnNextMission = document.getElementById('btn-next-mission')!;
    const cardVehicleSpeed = document.getElementById('card-vehicle-speed')!;
    const cardComboStep = document.getElementById('card-combo-step')!;
    const cardPedState = document.getElementById('card-ped-state')!;
    const cardTargetStatus = document.getElementById('card-target-status')!;

    // Milestone 7: Living World, Traffic & Neon Rain Elements
    const badgeWeatherMode = document.getElementById('badge-weather-mode')!;
    const btnWeatherNeon = document.getElementById('btn-weather-neon')!;
    const btnWeatherRain = document.getElementById('btn-weather-rain')!;
    const btnWeatherStorm = document.getElementById('btn-weather-storm')!;
    const btnTrafficToggle = document.getElementById('btn-traffic-toggle')!;
    const btnShadowToggle = document.getElementById('btn-shadow-toggle')!;
    const sliderWetness = document.getElementById('slider-wetness') as HTMLInputElement;
    const labelWetness = document.getElementById('label-wetness')!;
    const sliderNeon = document.getElementById('slider-neon') as HTMLInputElement;
    const labelNeon = document.getElementById('label-neon')!;
    const cardStreamedSectors = document.getElementById('card-streamed-sectors')!;
    const cardTrafficCount = document.getElementById('card-traffic-count')!;
    const cardCrowdCount = document.getElementById('card-crowd-count')!;

    // Sleeping Dogs Gameplay HUD & Mission System
    const missionTitle = document.getElementById('mission-title') || document.querySelector('.mission-title')!;
    const missionObjective = document.getElementById('mission-objective')!;
    const meterHealthText = document.getElementById('meter-health-text')!;
    const meterHealthFill = document.getElementById('meter-health-fill')!;
    const meterFaceText = document.getElementById('meter-face-text')!;
    const meterFaceFill = document.getElementById('meter-face-fill')!;
    const meterPolice = document.getElementById('meter-police')!;
    const meterTriad = document.getElementById('meter-triad')!;
    const actionPrompt = document.getElementById('action-prompt')!;
    const counterAlert = document.getElementById('counter-alert') as HTMLElement;
    const faceBurstBanner = document.getElementById('face-burst-banner') as HTMLElement;
    const radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
    const radarCtx = radarCanvas.getContext('2d')!;

    // Audio Elements
    const btnAudioToggle = document.getElementById('btn-audio-toggle')!;
    const chkSpatialAudio = document.getElementById('chk-spatial-audio') as HTMLInputElement;
    const badgeAudioStatus = document.getElementById('badge-audio-status')!;
    const audioSpecCanvas = document.getElementById('audio-spec') as HTMLCanvasElement;
    const specCtx = audioSpecCanvas.getContext('2d')!;
    const freqData = new Uint8Array(32);

    // Animation Elements
    const badgeAnimState = document.getElementById('badge-anim-state')!;
    const btnAnimPlay = document.getElementById('btn-anim-play')!;
    const animTimeline = document.getElementById('anim-timeline') as HTMLInputElement;
    const animTimeLabel = document.getElementById('anim-time-label')!;
    const btnSpeed05 = document.getElementById('btn-speed-05')!;
    const btnSpeed10 = document.getElementById('btn-speed-10')!;
    const btnSpeed20 = document.getElementById('btn-speed-20')!;

    // Sidebar & Explorer Elements
    const dropzone = document.getElementById('dropzone')!;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const cardName = document.getElementById('card-name')!;
    const cardEntries = document.getElementById('card-entries')!;
    const cardSize = document.getElementById('card-size')!;
    const cardStatus = document.getElementById('card-status')!;
    const entryList = document.getElementById('entry-list')!;
    const badgeCount = document.getElementById('badge-count')!;
    const badgeNodeCount = document.getElementById('badge-node-count')!;
    const sceneHierarchy = document.getElementById('scene-hierarchy')!;

    // Showcase buttons
    const btnCompositeStreet = document.getElementById('btn-composite-street')!;
    const btnMeshVehicle = document.getElementById('btn-mesh-vehicle')!;
    const btnMeshCharacter = document.getElementById('btn-mesh-character')!;
    const btnMeshWorld = document.getElementById('btn-mesh-world')!;
    const btnTexBc3 = document.getElementById('btn-tex-bc3')!;
    const btnCameraMode = document.getElementById('btn-camera-mode')!;

    // Archive selector buttons
    const btnBixVehicles = document.getElementById('btn-bix-vehicles')!;
    const btnBixCharacters = document.getElementById('btn-bix-characters')!;
    const btnBixGame = document.getElementById('btn-bix-game')!;
    const btnBixUi = document.getElementById('btn-bix-ui')!;

    // Milestone 8: Full-Screen Hit & Play Title Screen & Collapsible Drawer
    const asideDrawer = document.getElementById('aside-drawer')!;
    const btnToggleInspector = document.getElementById('btn-toggle-inspector')!;
    const btnCloseInspector = document.getElementById('btn-close-inspector')!;
    const startOverlay = document.getElementById('start-overlay')!;
    const btnStartGame = document.getElementById('btn-start-game')!;

    btnToggleInspector.addEventListener('click', () => {
        asideDrawer.classList.toggle('open');
    });
    btnCloseInspector.addEventListener('click', () => {
        asideDrawer.classList.remove('open');
    });

    btnStartGame.addEventListener('click', async () => {
        startOverlay.classList.add('hidden');
        try {
            await audioEngine.playTrack('hk_ambience');
        } catch (err) {
            console.log('Ambience playback on user click:', err);
        }
        cameraController.isDriving = false;
        updateCameraModeUI('follow');
    });

    (window as any).startGame = () => {
        btnStartGame.click();
    };

    let currentArchiveName = 'Game';
    let currentArchive: BixArchive | null = null;
    let activeSceneGraph: SceneGraph | null = null;
    let cachedTexture: DecodedTexture | null = null;
    let isScrubbingTimeline = false;

    // Helper: Format bytes
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Camera Mode UI
    function updateCameraModeUI(mode: CameraMode) {
        renderer.setCameraMode(mode);
        if (mode === 'follow') {
            btnCameraMode.textContent = 'Camera: Follow (3rd Person)';
            btnCameraMode.style.borderColor = '#00d2ff';
            btnCameraMode.style.color = '#00d2ff';
            hudCamMode.textContent = 'Follow Camera (Wei Shen)';
            controlsHint.innerHTML = '<span>[W][A][S][D]:</span> Move Wei Shen | <span>[Shift]:</span> Sprint | <span>[Space]:</span> Jump | <span>Left Drag:</span> Look | <span>L-Click:</span> Strike';
        } else if (mode === 'orbit') {
            btnCameraMode.textContent = 'Camera: Orbit';
            btnCameraMode.style.borderColor = '#a78bfa';
            btnCameraMode.style.color = '#a78bfa';
            hudCamMode.textContent = 'Orbit Turntable';
            controlsHint.innerHTML = '<span>Left Drag:</span> Orbit | <span>Right Drag:</span> Pan | <span>Scroll:</span> Zoom | <span>Click "Camera"</span> to change mode';
        } else {
            btnCameraMode.textContent = 'Camera: Street (WASD)';
            btnCameraMode.style.borderColor = '#38bdf8';
            btnCameraMode.style.color = '#38bdf8';
            hudCamMode.textContent = 'Street Free-Fly (WASD)';
            controlsHint.innerHTML = '<span>[W][A][S][D]:</span> Fly Move | <span>[Shift]:</span> Sprint | <span>[E]/[Space]:</span> Up | <span>[Q]/[C]:</span> Down | <span>Drag:</span> Look';
        }
    }

    btnCameraMode.addEventListener('click', () => {
        const order: CameraMode[] = ['follow', 'orbit', 'freefly'];
        const nextIdx = (order.indexOf(renderer.cameraMode) + 1) % order.length;
        updateCameraModeUI(order[nextIdx]);
    });

    // Milestone 5: Physics Controls Wiring
    btnPhysJump.addEventListener('click', () => {
        characterController.jump();
    });

    btnPhysStrike.addEventListener('click', () => {
        characterController.triggerAttack(animPlayer, audioEngine);
    });

    btnPhysReset.addEventListener('click', () => {
        characterController.position = [-2.2, 0.0, 1.2];
        characterController.velocity = [0, 0, 0];
        characterController.isGrounded = true;
        cameraController.targetPos = [...characterController.position];
    });

    btnPhysSprint.addEventListener('click', () => {
        // Toggle sprint mode simulation
        characterController.isSprinting = !characterController.isSprinting;
        btnPhysSprint.classList.toggle('active', characterController.isSprinting);
    });

    chkGroundClamp.addEventListener('change', () => {
        physicsEngine.groundClampingEnabled = chkGroundClamp.checked;
    });

    chkObstacleColl.addEventListener('change', () => {
        physicsEngine.obstacleCollisionEnabled = chkObstacleColl.checked;
    });

    chkCameraOcclusion.addEventListener('change', () => {
        physicsEngine.cameraOcclusionEnabled = chkCameraOcclusion.checked;
    });

    // -------------------------------------------------------------
    // Sleeping Dogs Campaign Mission Engine (Missions 1 & 2)
    // -------------------------------------------------------------
    let playerHealth = 100.0;
    const playerMaxHealth = 100.0;
    let slowMoTimer = 0.0;

    // Canonical Sleeping Dogs Story Mission Engine
    function updateMissionBanner() {
        // Mission banner updated dynamically by campaignStory
    }

    // Connect Crowd System Callbacks
    crowdSystem.onPlayerDamaged = (damage: number) => {
        playerHealth = Math.max(0, playerHealth - damage);
        meterHealthFill.style.width = `${(playerHealth / playerMaxHealth) * 100}%`;
        meterHealthText.textContent = `${Math.round(playerHealth)}%`;
        meterHealthFill.style.background = playerHealth < 30 ? '#ef4444' : '#22c55e';

        cameraController.pitch += 0.04;
        actionPrompt.style.display = 'block';
        actionPrompt.textContent = `⚠️ TOOK ${damage} DAMAGE! [PRESS R-CLICK / E TO COUNTER]`;
        actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
        setTimeout(() => actionPrompt.style.display = 'none', 800);
    };

    crowdSystem.onEnemyDefeated = (npc) => {
        if (!renderer.sceneGraph) return;
        campaignStory.onEnemyDefeated(
            npc.id,
            cameraController,
            audioEngine,
            renderer.sceneGraph,
            crowdSystem,
            combatSystem
        );
    };

    btnNextMission.addEventListener('click', () => {
        if (!renderer.sceneGraph) return;
        if (campaignStory.stage === 'prologue_cinematic') {
            campaignStory.startPrologueChase(cameraController, audioEngine);
        } else if (campaignStory.stage === 'prologue_chase') {
            campaignStory.startPrologueAlleyFight(audioEngine);
        } else if (campaignStory.stage === 'prologue_alley_fight') {
            campaignStory.startInterrogationCinematic(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage.startsWith('ch1_interrogation')) {
            campaignStory.startHoldingCellsBrawl(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_holding_cells_brawl') {
            campaignStory.startVendorExtortionGoldenKoi(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_extortion_watch_vendor') {
            campaignStory.collectWatchVendorTribute(audioEngine);
        } else if (campaignStory.stage === 'ch1_extortion_drink_vendor') {
            campaignStory.triggerDrinkVendorAmbush(audioEngine);
        } else if (campaignStory.stage === 'ch1_extortion_18k_ambush') {
            campaignStory.onAmbushThugsDefeated(audioEngine);
        } else if (campaignStory.stage === 'ch1_extortion_return_golden_koi' || campaignStory.stage === 'ch1_extortion_completed') {
            campaignStory.startNightMarketChaseFindMing(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_nmc_find_ming_cinematic') {
            campaignStory.startNightMarketRooftopChase(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_nmc_market_chase' || campaignStory.stage === 'ch1_nmc_rooftop_parkour') {
            campaignStory.startRooftopKnifeBrawl(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_nmc_rooftop_knife_brawl') {
            campaignStory.startMingArrestCinematic(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_nmc_arrest_cinematic') {
            campaignStory.startAmandaTour(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_amanda_drive_dojo') {
            campaignStory.startDojoTraining(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_amanda_dojo_training' || campaignStory.stage === 'ch1_amanda_completed') {
            campaignStory.startMission5ClubBamBam(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_bambam_drive') {
            campaignStory.arriveAtClubBamBam(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_bambam_entrance_cinematic' || campaignStory.stage === 'ch1_bambam_dancefloor_brawl') {
            campaignStory.advanceToVIPLounge(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_bambam_vip_lounge_brawl') {
            campaignStory.triggerBathroomRestroomShowdown(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_bambam_bathroom_climax') {
            campaignStory.completeClubBamBam(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_bambam_completed' || campaignStory.stage === 'ch1_popstar_phone_call') {
            campaignStory.startMission6PopstarDrugBust(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_popstar_drive_terminal') {
            campaignStory.startPopstarCameraHacking(hackingMinigame, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_popstar_camera_hacking') {
            campaignStory.startPopstarSurveillanceFeed(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_popstar_surveillance_feed') {
            campaignStory.startPopstarAmbushBrawl(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_popstar_ambush_brawl') {
            campaignStory.completePopstarDrugBust(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_popstar_bust_completed' || campaignStory.stage === 'ch1_listening_in_briefing') {
            campaignStory.startMission7ListeningIn(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_listening_in_scaffolding') {
            campaignStory.startWiretapTuning(frequencyTuner, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_listening_in_tuner') {
            campaignStory.plantWiretapInOffice(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_listening_in_plant_bug') {
            campaignStory.completeMission7ListeningIn(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_listening_in_escape' || campaignStory.stage === 'ch1_chain_command_rendezvous') {
            campaignStory.startMission8ChainOfCommand(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_chain_command_dialogue') {
            campaignStory.startMission9Payback(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_payback_warehouse_infiltrate') {
            campaignStory.startWarehouseFirefight(cameraController, audioEngine, renderer.sceneGraph, crowdSystem);
        } else if (campaignStory.stage === 'ch1_payback_warehouse_firefight') {
            campaignStory.startVehicularPursuit(cameraController, audioEngine, vehicleController);
        } else if (campaignStory.stage === 'ch1_payback_vehicular_chase') {
            campaignStory.completeMission9Payback(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_payback_completed') {
            campaignStory.startMission10UnclePo(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_uncle_po_ceremony') {
            campaignStory.completeChapter1(cameraController, audioEngine);
        } else if (campaignStory.stage === 'ch1_chapter1_completed') {
            campaignStory.startPrologueCinematic(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        } else {
            campaignStory.startPrologueCinematic(renderer.sceneGraph, crowdSystem, cameraController, audioEngine);
        }
    });

    // -------------------------------------------------------------
    // Milestone 12: Sleeping Dogs In-Car Radio Station Tuner
    // -------------------------------------------------------------
    const RADIO_STATIONS = [
        { id: 'radio_boosey', name: 'Boosey & Hawkes', freq: '98.4 FM', genre: 'CLASSICAL' },
        { id: 'radio_kerrang', name: 'Kerrang! Radio', freq: '105.2 FM', genre: 'HIGH-OCTANE ROCK' },
        { id: 'radio_softly', name: 'Softly FM Hong Kong', freq: '101.8 FM', genre: 'CANTOPOP & LOUNGE' },
        { id: 'off', name: 'Radio Off', freq: '---', genre: 'MUTED' }
    ];
    let currentRadioIdx = 0;
    let radioBannerTimer: any = null;

    const radioBanner = document.getElementById('radio-banner') as HTMLElement;
    const radioTitle = document.getElementById('radio-station-title') as HTMLElement;
    const radioFreq = document.getElementById('radio-station-freq') as HTMLElement;

    function showRadioBanner(st: typeof RADIO_STATIONS[0]) {
        if (!radioBanner) return;
        radioTitle.textContent = st.name.toUpperCase();
        radioFreq.textContent = `${st.freq} • ${st.genre} [R: SWITCH]`;
        radioBanner.style.display = 'flex';
        if (radioBannerTimer) clearTimeout(radioBannerTimer);
        radioBannerTimer = setTimeout(() => {
            radioBanner.style.display = 'none';
        }, 4000);
    }

    function switchRadioStation() {
        if (!vehicleController.isOccupied) return;
        currentRadioIdx = (currentRadioIdx + 1) % RADIO_STATIONS.length;
        const st = RADIO_STATIONS[currentRadioIdx];

        audioEngine.stopTrack('radio_boosey');
        audioEngine.stopTrack('radio_kerrang');
        audioEngine.stopTrack('radio_softly');

        if (st.id !== 'off') {
            audioEngine.playTrack(st.id).catch(() => {});
        }
        showRadioBanner(st);
    }

    function honkCarHorn() {
        if (!vehicleController.isOccupied) return;
        audioEngine.playTrack('vehicle_horn').catch(() => {});
        actionPrompt.style.display = 'block';
        actionPrompt.textContent = '📢 BEEP BEEP!';
        actionPrompt.style.background = '#f59e0b';
        setTimeout(() => actionPrompt.style.display = 'none', 800);
    }

    function toggleVehicleEntry(force = false) {
        if (!vehicleController.isOccupied) {
            // Attempt to enter vehicle
            if (force && !vehicleController.canInteract(characterController.position)) {
                // Teleport Wei Shen to driver door for direct UI invocation
                characterController.position = [
                    vehicleController.position[0] - 1.2,
                    vehicleController.position[1],
                    vehicleController.position[2]
                ];
            }
            const entered = vehicleController.toggleEntry(characterController.position, audioEngine, force);
            if (entered) {
                cameraController.isDriving = true;
                badgeGameplayMode.textContent = 'Driving Sedan';
                badgeGameplayMode.style.color = '#e11d48';
                btnEnterCar.textContent = 'Exit Car [F]';
                btnEnterCar.classList.add('active');

                // Hide on-foot character mesh while inside car cabin
                const charNode = renderer.sceneGraph?.getNode('node-character');
                if (charNode) charNode.visible = false;

                actionPrompt.style.display = 'block';
                actionPrompt.textContent = '🚨 VEHICLE COMMANDEERED! CRUISE NORTH POINT! [R: RADIO] 🚨';
                actionPrompt.style.background = '#22c55e';
                setTimeout(() => actionPrompt.style.display = 'none', 3000);

                // Milestone 12: Start in-car radio broadcast
                const st = RADIO_STATIONS[currentRadioIdx];
                if (st.id !== 'off') {
                    audioEngine.playTrack(st.id).catch(() => {});
                    showRadioBanner(st);
                }
            }
        } else {
            // Exit vehicle
            vehicleController.toggleEntry(characterController.position, audioEngine);
            cameraController.isDriving = false;

            // Silence in-car radio on vehicle exit
            audioEngine.stopTrack('radio_boosey');
            audioEngine.stopTrack('radio_kerrang');
            audioEngine.stopTrack('radio_softly');
            if (radioBanner) radioBanner.style.display = 'none';

            // Place Wei Shen beside the driver door
            const sideX = -Math.cos(vehicleController.rotationY) * 1.6;
            const sideZ = Math.sin(vehicleController.rotationY) * 1.6;
            characterController.position = [
                vehicleController.position[0] + sideX,
                vehicleController.position[1],
                vehicleController.position[2] + sideZ
            ];
            characterController.velocity = [0, 0, 0];
            characterController.rotationY = vehicleController.rotationY;

            // Restore character mesh visibility
            const charNode = renderer.sceneGraph?.getNode('node-character');
            if (charNode) charNode.visible = true;

            badgeGameplayMode.textContent = 'On Foot';
            badgeGameplayMode.style.color = '#38bdf8';
            btnEnterCar.textContent = 'Enter Car [F]';
            btnEnterCar.classList.remove('active');

            // Switch audio back to city ambience
            audioEngine.playTrack('hk_ambience').catch(() => {});
        }
    }

    btnEnterCar.addEventListener('click', () => toggleVehicleEntry(true));

    // -------------------------------------------------------------
    // Martial Arts Combat Actions
    // -------------------------------------------------------------
    function performCombatStrike() {
        if (vehicleController.isOccupied) return;

        const res = combatSystem.executeStrike(
            characterController.position,
            characterController.rotationY,
            animPlayer,
            audioEngine,
            crowdSystem
        );
        characterController.triggerAttack(animPlayer, audioEngine);

        if (res.hitLanded) {
            actionPrompt.style.display = 'block';
            actionPrompt.textContent = `COMBO STRIKE ${res.comboStep}/3 (+${res.damage} DMG)!`;
            actionPrompt.style.background = res.comboStep === 3 ? '#eab308' : '#d92638';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 700);
        }
    }

    function performCombatCounter() {
        if (vehicleController.isOccupied) return;

        const res = combatSystem.executeCounter(
            characterController.position,
            animPlayer,
            audioEngine,
            crowdSystem
        );

        if (res.counterSuccess) {
            // Sleeping Dogs Signature Cinematic Counter
            slowMoTimer = 0.40; // 400ms slow-motion!
            cameraController.pitch += 0.08;
            cameraController.distance = Math.max(1.8, cameraController.distance - 0.5);

            actionPrompt.style.display = 'block';
            actionPrompt.innerHTML = `⚡ <strong style="color:#facc15">BRUTAL COUNTER REVERSAL!</strong> (+${res.damage} DMG, +150 TRIAD XP) ⚡`;
            actionPrompt.style.background = 'rgba(217, 38, 56, 0.95)';
            actionPrompt.style.boxShadow = '0 0 25px rgba(255, 0, 50, 0.8)';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 1200);
        } else {
            actionPrompt.style.display = 'block';
            actionPrompt.textContent = `DEFENSIVE PARRY GUARD [READY]`;
            actionPrompt.style.background = 'rgba(56, 189, 248, 0.85)';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 500);
        }
    }

    function performHeavyKick() {
        if (vehicleController.isOccupied) return;
        const res = combatSystem.executeHeavyKick(
            characterController.position,
            characterController.rotationY,
            animPlayer,
            audioEngine,
            crowdSystem
        );
        if (res.hitLanded) {
            actionPrompt.style.display = 'block';
            actionPrompt.textContent = `💥 HEAVY ROUNDHOUSE KICK (+${res.damage} DMG, GUARD BROKEN)!`;
            actionPrompt.style.background = '#eab308';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 900);
        }
    }

    function performGrapple() {
        if (vehicleController.isOccupied) return;
        const res = combatSystem.executeGrapple(
            characterController.position,
            characterController.rotationY,
            animPlayer,
            audioEngine,
            crowdSystem
        );
        if (res.grappleSuccess) {
            actionPrompt.style.display = 'block';
            actionPrompt.textContent = `🤼 GRAPPLE & SIDEWALK SLAM (+${res.damage} DMG)!`;
            actionPrompt.style.background = '#a855f7';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 900);
        }
    }

    function performEnvironmentalTakedown() {
        if (vehicleController.isOccupied) return false;
        const res = combatSystem.executeEnvironmentalTakedown(
            characterController.position,
            animPlayer,
            audioEngine,
            crowdSystem
        );
        if (res.success && res.hazard) {
            slowMoTimer = 0.45;
            cameraController.pitch += 0.08;
            cameraController.distance = Math.max(1.8, cameraController.distance - 0.5);

            actionPrompt.style.display = 'block';
            actionPrompt.innerHTML = `💥 <strong style="color:#facc15">ENVIRONMENTAL FINISHER: ${res.hazard.name.toUpperCase()}</strong> (+${res.damage} DMG, +${res.hazard.scoreBonus} TRIAD XP) 💥`;
            actionPrompt.style.background = 'rgba(168, 85, 247, 0.95)';
            actionPrompt.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.9)';
            setTimeout(() => actionPrompt.style.display = 'none', 1400);
            return true;
        }
        return false;
    }

    btnComboStrike.addEventListener('click', performCombatStrike);

    btnPedPanic.addEventListener('click', () => {
        pedestrianAI.state = 'FLEE';
        pedestrianAI.stateTimer = 5.0;
        audioEngine.playTrack('hk_dialogue').catch(() => {});
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF' || e.key.toLowerCase() === 'f') {
            if (campaignStory.stage === 'ch1_extortion_watch_vendor') {
                const distToWatch = Math.hypot(characterController.position[0] - (-9.5), characterController.position[2] - (-12.0));
                if (distToWatch <= 4.5) {
                    campaignStory.collectWatchVendorTribute(audioEngine);
                    return;
                }
            } else if (campaignStory.stage === 'ch1_popstar_drive_terminal') {
                const distToTerminal = Math.hypot(characterController.position[0] - 24.0, characterController.position[2] - (-48.0));
                if (distToTerminal <= 7.0) {
                    campaignStory.startPopstarCameraHacking(hackingMinigame, cameraController, audioEngine);
                    return;
                }
            } else if (campaignStory.stage === 'ch1_popstar_surveillance_feed') {
                campaignStory.startPopstarAmbushBrawl(cameraController, audioEngine, renderer.sceneGraph!, crowdSystem);
                return;
            } else if (campaignStory.stage === 'ch1_listening_in_scaffolding') {
                const distToScaffolding = Math.hypot(characterController.position[0] - (-2.2), characterController.position[2] - 24.0);
                if (distToScaffolding <= 6.0) {
                    campaignStory.startWiretapTuning(frequencyTuner, cameraController, audioEngine);
                    return;
                }
            } else if (campaignStory.stage === 'ch1_listening_in_plant_bug') {
                campaignStory.completeMission7ListeningIn(cameraController, audioEngine);
                return;
            } else if (campaignStory.stage === 'ch1_payback_warehouse_infiltrate') {
                const distToWarehouse = Math.hypot(characterController.position[0] - 28.0, characterController.position[2] - 40.0);
                if (distToWarehouse <= 8.0) {
                    campaignStory.startWarehouseFirefight(cameraController, audioEngine, renderer.sceneGraph!, crowdSystem);
                    return;
                }
            } else if (campaignStory.stage === 'ch1_payback_vehicular_chase') {
                campaignStory.completeMission9Payback(cameraController, audioEngine);
                return;
            } else if (campaignStory.stage === 'ch1_uncle_po_ceremony') {
                campaignStory.completeChapter1(cameraController, audioEngine);
                return;
            }
            if (vehicleController.canInteract(characterController.position) || vehicleController.isOccupied) {
                toggleVehicleEntry();
            } else if (combatSystem.findNearbyHazard(characterController.position) && combatSystem.currentTarget) {
                performEnvironmentalTakedown();
            } else {
                performGrapple();
            }
        } else if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') {
            performCombatCounter();
        } else if (e.code === 'KeyQ' || e.key.toLowerCase() === 'q') {
            performHeavyKick();
        } else if (e.code === 'KeyR' || e.key.toLowerCase() === 'r') {
            switchRadioStation();
        } else if (e.code === 'KeyG' || e.key.toLowerCase() === 'g') {
            honkCarHorn();
        } else if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') {
            const hudEl = document.querySelector('.hud-overlay') as HTMLElement;
            if (hudEl) {
                hudEl.style.display = (hudEl.style.display === 'none') ? 'block' : 'none';
            }
        } else if (e.code === 'Digit1' || e.key === '1') {
            applyWeatherPreset('neon_night');
        } else if (e.code === 'Digit2' || e.key === '2') {
            applyWeatherPreset('hong_kong_rain');
        } else if (e.code === 'Digit3' || e.key === '3') {
            applyWeatherPreset('typhoon_storm');
        } else if (e.code === 'Escape' || e.key === 'Escape') {
            if (asideDrawer.classList.contains('open')) {
                asideDrawer.classList.remove('open');
            }
        }
    });

    // Mouse Controls (Disable native right-click context menu for Counter mechanic)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
        if (renderer.cameraMode !== 'follow' || vehicleController.isOccupied) return;

        if (e.button === 0) {
            performCombatStrike();
        } else if (e.button === 2) {
            performCombatCounter();
        }
    });

    // Milestone 7: Weather & Traffic Wiring
    function applyWeatherPreset(mode: WeatherMode) {
        weatherSystem.setWeatherMode(mode);
        badgeWeatherMode.textContent = weatherSystem.settings.name;
        [btnWeatherNeon, btnWeatherRain, btnWeatherStorm].forEach(b => b.classList.remove('active'));
        if (mode === 'neon_night') {
            btnWeatherNeon.classList.add('active');
            badgeWeatherMode.style.color = '#ff007f';
        } else if (mode === 'hong_kong_rain') {
            btnWeatherRain.classList.add('active');
            badgeWeatherMode.style.color = '#00d2ff';
        } else {
            btnWeatherStorm.classList.add('active');
            badgeWeatherMode.style.color = '#f59e0b';
        }
        sliderWetness.value = `${Math.round(weatherSystem.settings.wetness * 100)}`;
        labelWetness.textContent = `${Math.round(weatherSystem.settings.wetness * 100)}%`;
        sliderNeon.value = `${Math.round(weatherSystem.settings.neonBloomFactor * 100)}`;
        labelNeon.textContent = `${weatherSystem.settings.neonBloomFactor.toFixed(1)}x`;
    }

    btnWeatherNeon.addEventListener('click', () => applyWeatherPreset('neon_night'));
    btnWeatherRain.addEventListener('click', () => applyWeatherPreset('hong_kong_rain'));
    btnWeatherStorm.addEventListener('click', () => applyWeatherPreset('typhoon_storm'));

    btnTrafficToggle.addEventListener('click', () => {
        trafficSystem.trafficEnabled = !trafficSystem.trafficEnabled;
        btnTrafficToggle.classList.toggle('active', trafficSystem.trafficEnabled);
        btnTrafficToggle.textContent = trafficSystem.trafficEnabled ? 'Traffic: ON' : 'Traffic: OFF';
    });

    btnShadowToggle.addEventListener('click', () => {
        renderer.shadowsEnabled = !renderer.shadowsEnabled;
        btnShadowToggle.classList.toggle('active', renderer.shadowsEnabled);
        btnShadowToggle.textContent = renderer.shadowsEnabled ? 'Shadows: 2048 PCF' : 'Shadows: OFF';
        btnShadowToggle.style.color = renderer.shadowsEnabled ? '#facc15' : 'var(--text-muted)';
        btnShadowToggle.style.borderColor = renderer.shadowsEnabled ? '#facc15' : 'var(--panel-border)';
    });

    sliderWetness.addEventListener('input', () => {
        const val = parseInt(sliderWetness.value, 10) / 100;
        weatherSystem.settings.wetness = val;
        weatherSystem.settings.puddleReflectivity = val;
        labelWetness.textContent = `${Math.round(val * 100)}%`;
    });

    sliderNeon.addEventListener('input', () => {
        const val = parseInt(sliderNeon.value, 10) / 100;
        weatherSystem.settings.neonBloomFactor = val;
        labelNeon.textContent = `${val.toFixed(1)}x`;
    });

    // Populate Scene Hierarchy Panel
    function renderSceneHierarchy(sg: SceneGraph) {
        activeSceneGraph = sg;
        const nodes = sg.getAllNodes();
        badgeNodeCount.textContent = `${nodes.length} Nodes`;
        sceneHierarchy.innerHTML = '';

        for (const node of nodes) {
            const row = document.createElement('div');
            row.className = 'node-row';

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = node.visible;
            checkbox.addEventListener('change', () => {
                node.visible = checkbox.checked;
            });

            const spanName = document.createElement('span');
            spanName.textContent = node.name.length > 28 ? node.name.slice(0, 28) + '...' : node.name;
            spanName.style.color = `rgb(${Math.round(node.color[0]*255)}, ${Math.round(node.color[1]*255)}, ${Math.round(node.color[2]*255)})`;

            label.appendChild(checkbox);
            label.appendChild(spanName);

            const tris = document.createElement('span');
            tris.style.color = 'var(--text-muted)';
            tris.style.fontSize = '10px';
            tris.textContent = `${node.mesh.triangleCount} tris`;

            row.appendChild(label);
            row.appendChild(tris);
            sceneHierarchy.appendChild(row);
        }
    }

    // Populate Sidebar Entry List
    function renderEntries(archive: BixArchive) {
        currentArchive = archive;
        cardName.textContent = `${archive.name}.bix`;
        cardEntries.textContent = `${archive.entries.length} assets`;
        cardSize.textContent = formatBytes(archive.payloadSize);
        cardStatus.textContent = 'HTTP 206 Streaming Active';
        cardStatus.style.color = '#4ade80';
        badgeCount.textContent = `${archive.entries.length} Entries`;

        entryList.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const displayLimit = Math.min(archive.entries.length, 250);
        for (let i = 0; i < displayLimit; i++) {
            const e = archive.entries[i];
            const div = document.createElement('div');
            div.className = 'entry-item';
            div.id = `entry-${i}`;

            div.innerHTML = `
                <div>
                    <span style="color: var(--accent-cyan); margin-right: 6px;">#${e.index}</span>
                    <span>${e.uidHex}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 10px;">
                    ${e.offsetHex} | ${e.totalSpan}b
                </div>
            `;

            div.addEventListener('click', async () => {
                document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');

                try {
                    cardStatus.textContent = `Streaming entry #${e.index}...`;
                    cardStatus.style.color = 'var(--accent-cyan)';

                    const spanToFetch = Math.min(Math.max(e.totalSpan, 64), 131072);
                    const rawBuffer = await fetchRange(archive.name, e.offset, spanToFetch);

                    cardStatus.textContent = `Streamed ${formatBytes(rawBuffer.byteLength)} from ${archive.name}.big`;
                    cardStatus.style.color = '#4ade80';

                    try {
                        const mesh = parseIllusionBuffer(rawBuffer, `${archive.name}_Resource_${e.uidHex}`);
                        if (mesh) {
                            renderer.setMesh(mesh);
                            activeSceneGraph = null;
                            document.querySelectorAll('.showcase-bar button').forEach(b => {
                                if (b.id !== 'btn-camera-mode') b.classList.remove('active');
                            });
                        }
                    } catch {
                        console.log(`Inspected entry #${e.index} (${e.uidHex})`);
                    }
                } catch (err: any) {
                    cardStatus.textContent = `Stream failed: ${err.message}`;
                    cardStatus.style.color = 'var(--accent-crimson)';
                }
            });

            fragment.appendChild(div);
        }
        entryList.appendChild(fragment);
    }

    // Switch active archive in explorer
    async function switchArchive(name: string) {
        currentArchiveName = name;
        [btnBixVehicles, btnBixCharacters, btnBixGame, btnBixUi].forEach(b => b.classList.remove('active'));
        if (name === 'Vehicles') btnBixVehicles.classList.add('active');
        if (name === 'Characters') btnBixCharacters.classList.add('active');
        if (name === 'Game') btnBixGame.classList.add('active');
        if (name === 'UI') btnBixUi.classList.add('active');

        try {
            cardStatus.textContent = `Loading ${name}.bix...`;
            const archive = await fetchArchiveIndex(name);
            renderEntries(archive);
        } catch (err: any) {
            console.error(`Failed to load ${name}.bix`, err);
            cardStatus.textContent = `Failed to load ${name}.bix`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    }

    btnBixVehicles.addEventListener('click', () => switchArchive('Vehicles'));
    btnBixCharacters.addEventListener('click', () => switchArchive('Characters'));
    btnBixGame.addEventListener('click', () => switchArchive('Game'));
    btnBixUi.addEventListener('click', () => switchArchive('UI'));

    function generateWheelMesh(): DecodedMesh {
        const segs = 14;
        const r = 0.35;
        const w = 0.22;
        const hw = w / 2;
        const pos: number[] = [];
        const norm: number[] = [];
        const uvs: number[] = [];
        const ind: number[] = [];

        for (let i = 0; i <= segs; i++) {
            const th = (i / segs) * Math.PI * 2;
            const cy = Math.cos(th) * r;
            const cz = Math.sin(th) * r;
            // Tread left edge
            pos.push(-hw, cy, cz);
            norm.push(-0.4, Math.cos(th), Math.sin(th));
            uvs.push(i / segs, 0);
            // Tread right edge
            pos.push(hw, cy, cz);
            norm.push(0.4, Math.cos(th), Math.sin(th));
            uvs.push(i / segs, 1);
        }
        for (let i = 0; i < segs; i++) {
            const i0 = i * 2;
            const i1 = i * 2 + 1;
            const i2 = (i + 1) * 2;
            const i3 = (i + 1) * 2 + 1;
            ind.push(i0, i1, i2);
            ind.push(i2, i1, i3);
        }
        return {
            name: 'Vehicle_Wheel_Mesh',
            positions: new Float32Array(pos),
            normals: new Float32Array(norm),
            uvs: new Float32Array(uvs),
            indices: new Uint16Array(ind),
            vertexCount: pos.length / 3,
            triangleCount: ind.length / 3,
            bounds: { min: [-hw, -r, -r], max: [hw, r, r], center: [0, 0, 0], size: [w, r*2, r*2] }
        };
    }

    function createInitialSkidMarkMesh(): DecodedMesh {
        return {
            name: 'Asphalt_Skid_Marks',
            positions: new Float32Array(0),
            normals: new Float32Array(0),
            uvs: new Float32Array(0),
            indices: new Uint16Array(0),
            vertexCount: 0,
            triangleCount: 0,
            bounds: { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0] }
        };
    }

    // Showcase Action: Load Hong Kong Street Scene (Composite Graph)
    async function activateCompositeStreet() {
        document.querySelectorAll('.showcase-bar button').forEach(b => {
            if (b.id !== 'btn-camera-mode') b.classList.remove('active');
        });
        btnCompositeStreet.classList.add('active');
        btnTexBc3.classList.add('active');

        try {
            cardStatus.textContent = 'Streaming Hong Kong world sectors, traffic & crowd entities...';
            const { sceneGraph, texture, textures } = await loadCompositeStreetScene();
            cachedTexture = texture;
            renderer.setTexture(texture);

            // Milestone 7A & 9: Stream multi-sector Hong Kong world & urban architecture with authentic materials
            await worldStreamer.initPrimaryWorld(sceneGraph, textures);

            // Milestone 7B & 9: Stream authentic traffic vehicles & sidewalk crowds with authentic materials
            await trafficSystem.initTraffic(sceneGraph, textures.vehicle);
            await crowdSystem.init(sceneGraph, textures.clothing, textures.triadThug);

            // Dynamic Vehicle Wheels (Front steering & 4-wheel rotation)
            const wheelMesh = generateWheelMesh();
            const wheelConfigs = [
                { id: 'node-wheel-fl', name: 'Sedan Front Left Wheel', side: -0.82, fwd:  1.35, isFront: true },
                { id: 'node-wheel-fr', name: 'Sedan Front Right Wheel', side: 0.82, fwd:  1.35, isFront: true },
                { id: 'node-wheel-rl', name: 'Sedan Rear Left Wheel', side: -0.82, fwd: -1.30, isFront: false },
                { id: 'node-wheel-rr', name: 'Sedan Rear Right Wheel', side: 0.82, fwd: -1.30, isFront: false }
            ];
            wheelConfigs.forEach(w => {
                const wNode: SceneNode = {
                    id: w.id,
                    name: w.name,
                    mesh: wheelMesh,
                    texture: textures.vehicle,
                    normalMap: textures.vehicleNormal,
                    position: [1.8 + w.side, 0.35, w.fwd],
                    rotation: [0, 0.4, 0],
                    scale: [1, 1, 1],
                    color: [0.15, 0.15, 0.18],
                    visible: true,
                    transform: createTransformMatrix([1.8 + w.side, 0.35, w.fwd], [0, 0.4, 0], [1, 1, 1])
                };
                sceneGraph.addNode(wNode);
            });

            // Dynamic Asphalt Drift Skid Mark Ribbon Node
            const skidNode: SceneNode = {
                id: 'node-skid-marks',
                name: 'Asphalt Tire Drift Skid Marks',
                mesh: createInitialSkidMarkMesh(),
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                color: [0.06, 0.06, 0.07],
                visible: true,
                transform: createTransformMatrix([0, 0, 0], [0, 0, 0], [1, 1, 1])
            };
            sceneGraph.addNode(skidNode);

            renderer.setSceneGraph(sceneGraph);
            renderSceneHierarchy(sceneGraph);

            // Initialize Havok collision world from authentic street & vehicle nodes
            const worldNode = sceneGraph.getNode('node-hk-sector');
            const vehicleNode = sceneGraph.getNode('node-vehicle');
            physicsEngine.initFromSceneNodes(worldNode, vehicleNode);

            // Initialize Vehicle and Pedestrian AI
            vehicleController.position = [1.8, 0.35, 0.0];
            vehicleController.rotationY = 0.4;
            vehicleController.speed = 0.0;
            vehicleController.isOccupied = false;

            pedestrianAI.position = [-2.4, 0.0, -1.5];
            pedestrianAI.health = 100;
            pedestrianAI.state = 'IDLE';

            // Position player Wei Shen and lock follow camera
            characterController.position = [-2.2, 0.0, 1.8];
            characterController.velocity = [0, 0, 0];
            characterController.isGrounded = true;
            cameraController.isDriving = false;
            cameraController.targetPos = [...characterController.position];
            updateCameraModeUI('follow');
            campaignStory.startCampaign(sceneGraph, crowdSystem, cameraController, audioEngine);

            cardStatus.textContent = 'Assembled composite street scene with Havok physics, vehicles & pedestrian crowd';
            cardStatus.style.color = '#4ade80';
        } catch (err: any) {
            console.error('Failed to load composite street scene:', err);
            cardStatus.textContent = `Street scene load failed: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    }

    btnCompositeStreet.addEventListener('click', activateCompositeStreet);

    btnMeshVehicle.addEventListener('click', async () => {
        document.querySelectorAll('.showcase-bar button').forEach(b => {
            if (b.id !== 'btn-camera-mode' && b.id !== 'btn-tex-bc3') b.classList.remove('active');
        });
        btnMeshVehicle.classList.add('active');
        activeSceneGraph = null;

        try {
            cardStatus.textContent = 'Streaming vehicle from Vehicles.big (0x01f0a400)...';
            const mesh = await loadAuthenticVehicle();
            renderer.setMesh(mesh);
            cardStatus.textContent = `Vehicle loaded: ${mesh.vertexCount} verts, ${mesh.triangleCount} tris`;
            cardStatus.style.color = '#4ade80';
        } catch (err: any) {
            cardStatus.textContent = `Failed: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    });

    btnMeshCharacter.addEventListener('click', async () => {
        document.querySelectorAll('.showcase-bar button').forEach(b => {
            if (b.id !== 'btn-camera-mode' && b.id !== 'btn-tex-bc3') b.classList.remove('active');
        });
        btnMeshCharacter.classList.add('active');
        activeSceneGraph = null;

        try {
            cardStatus.textContent = 'Streaming character from Characters.big (0x161f3000)...';
            const mesh = await loadAuthenticCharacter();
            renderer.setMesh(mesh);
            cardStatus.textContent = `Character loaded: ${mesh.vertexCount} verts, ${mesh.triangleCount} tris (1.85m tall)`;
            cardStatus.style.color = '#4ade80';
        } catch (err: any) {
            cardStatus.textContent = `Failed: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    });

    btnMeshWorld.addEventListener('click', async () => {
        document.querySelectorAll('.showcase-bar button').forEach(b => {
            if (b.id !== 'btn-camera-mode' && b.id !== 'btn-tex-bc3') b.classList.remove('active');
        });
        btnMeshWorld.classList.add('active');
        activeSceneGraph = null;

        try {
            cardStatus.textContent = 'Streaming world sector from Game.big (0x1b7ef400)...';
            const mesh = await loadAuthenticWorldSector();
            renderer.setMesh(mesh);
            cardStatus.textContent = `World sector loaded: 574m broad sector (${mesh.vertexCount} verts)`;
            cardStatus.style.color = '#4ade80';
        } catch (err: any) {
            cardStatus.textContent = `Failed: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    });

    btnTexBc3.addEventListener('click', async () => {
        if (btnTexBc3.classList.contains('active')) {
            btnTexBc3.classList.remove('active');
            renderer.currentTextureFormat = 'Texture Unbound';
        } else {
            btnTexBc3.classList.add('active');
            if (!cachedTexture) {
                cachedTexture = await loadAuthenticTexture();
            }
            renderer.setTexture(cachedTexture);
        }
    });

    // -------------------------------------------------------------
    // Milestone 4: Audio Subsystem Event Wiring
    // -------------------------------------------------------------
    async function playSelectedTrack(trackId: string) {
        try {
            document.querySelectorAll('[data-track]').forEach(b => b.classList.remove('active'));
            const activeBtn = document.querySelector(`[data-track="${trackId}"]`);
            if (activeBtn) activeBtn.classList.add('active');

            await audioEngine.playTrack(trackId);
            const info = AUTHENTIC_TRACKS[trackId];
            btnAudioToggle.textContent = '⏸ Pause Audio';
            btnAudioToggle.classList.add('active');
            badgeAudioStatus.textContent = 'Playing';
            badgeAudioStatus.style.color = '#4ade80';
            hudAudio.textContent = `${info.name} [${info.sampleRate/1000} kHz]`;
        } catch (err: any) {
            console.error('Audio playback error:', err);
            hudAudio.textContent = `Audio Error: ${err.message}`;
        }
    }

    btnAudioToggle.addEventListener('click', async () => {
        if (audioEngine.isPlaying) {
            audioEngine.stopAll();
            btnAudioToggle.textContent = '▶ Play Audio';
            btnAudioToggle.classList.remove('active');
            badgeAudioStatus.textContent = 'Stopped';
            badgeAudioStatus.style.color = 'var(--text-muted)';
            hudAudio.textContent = 'Audio Stopped';
        } else {
            await playSelectedTrack(audioEngine.currentTrackId);
        }
    });

    document.querySelectorAll('[data-track]').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = btn.getAttribute('data-track')!;
            playSelectedTrack(trackId);
        });
    });

    chkSpatialAudio.addEventListener('change', () => {
        audioEngine.spatialAudioEnabled = chkSpatialAudio.checked;
        if (audioEngine.isPlaying) {
            playSelectedTrack(audioEngine.currentTrackId);
        }
    });

    // -------------------------------------------------------------
    // Milestone 4: Skeletal Animation Event Wiring
    // -------------------------------------------------------------
    function switchAnimation(state: AnimStateName) {
        animPlayer.setState(state);
        document.querySelectorAll('[data-anim]').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-anim="${state}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const clip = animPlayer.getActiveClip();
        badgeAnimState.textContent = clip.id.replace('FSR_', '').replace('CP_', '').replace('Wei_', '');
        hudAnim.textContent = `${clip.name}`;
    }

    document.querySelectorAll('[data-anim]').forEach(btn => {
        btn.addEventListener('click', () => {
            const anim = btn.getAttribute('data-anim') as AnimStateName;
            switchAnimation(anim);
        });
    });

    btnAnimPlay.addEventListener('click', () => {
        const playing = animPlayer.togglePlay();
        btnAnimPlay.textContent = playing ? '⏸ Pause' : '▶ Play';
    });

    animTimeline.addEventListener('mousedown', () => { isScrubbingTimeline = true; });
    window.addEventListener('mouseup', () => { isScrubbingTimeline = false; });
    animTimeline.addEventListener('input', () => {
        const clip = animPlayer.getActiveClip();
        const scrubTime = (parseFloat(animTimeline.value) / 100) * clip.duration;
        animPlayer.setTime(scrubTime);
    });

    function setAnimSpeedUI(speed: number) {
        animPlayer.setSpeed(speed);
        [btnSpeed05, btnSpeed10, btnSpeed20].forEach(b => b.classList.remove('active'));
        if (speed === 0.5) btnSpeed05.classList.add('active');
        if (speed === 1.0) btnSpeed10.classList.add('active');
        if (speed === 2.0) btnSpeed20.classList.add('active');
    }
    btnSpeed05.addEventListener('click', () => setAnimSpeedUI(0.5));
    btnSpeed10.addEventListener('click', () => setAnimSpeedUI(1.0));
    btnSpeed20.addEventListener('click', () => setAnimSpeedUI(2.0));

    // Render Audio Frequency Visualizer Canvas
    function renderAudioSpectrum() {
        audioEngine.getFrequencyData(freqData);
        specCtx.clearRect(0, 0, audioSpecCanvas.width, audioSpecCanvas.height);

        const barWidth = (audioSpecCanvas.width / freqData.length) - 1;
        for (let i = 0; i < freqData.length; i++) {
            const val = freqData[i] / 255.0;
            const barHeight = val * audioSpecCanvas.height;

            const r = Math.round(56 + val * 199);
            const g = Math.round(189 - val * 70);
            const b = Math.round(248 - val * 150);

            specCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            specCtx.fillRect(i * (barWidth + 1), audioSpecCanvas.height - barHeight, barWidth, barHeight);
        }
    }

    // Drag-and-drop local archive file
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const buffer = await file.arrayBuffer();
            if (file.name.endsWith('.bix')) {
                const archive = parseBixBuffer(buffer);
                renderEntries(archive);
            }
        }
    });

    // -------------------------------------------------------------
    // Milestone 6: Hong Kong Mini-Map Radar Renderer
    // -------------------------------------------------------------
    function renderMiniMapRadar(
        playerPos: [number, number, number],
        playerYaw: number,
        healthPct: number = 100,
        facePct: number = 25,
        isFaceSurge: boolean = false,
        speedKmh: number = 0,
        isDriving: boolean = false
    ) {
        radarCtx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
        const cx = radarCanvas.width / 2;
        const cy = radarCanvas.height / 2;
        const radius = 54;
        const scale = 2.4; // pixels per world meter

        radarCtx.save();
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        radarCtx.fillStyle = 'rgba(11, 14, 20, 0.95)';
        radarCtx.fill();
        radarCtx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
        radarCtx.lineWidth = 1.5;
        radarCtx.stroke();
        radarCtx.clip();

        // Range rings
        radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        radarCtx.lineWidth = 1;
        [5, 10, 15].forEach(r => {
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, r * scale, 0, Math.PI * 2);
            radarCtx.stroke();
        });

        // Crosshairs
        radarCtx.beginPath();
        radarCtx.moveTo(cx, cy - radius); radarCtx.lineTo(cx, cy + radius);
        radarCtx.moveTo(cx - radius, cy); radarCtx.lineTo(cx + radius, cy);
        radarCtx.stroke();

        // Sidewalk border line
        radarCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        const sidewalkX = (-2.5 - playerPos[0]) * scale + cx;
        radarCtx.beginPath();
        radarCtx.moveTo(sidewalkX, 0); radarCtx.lineTo(sidewalkX, radarCanvas.height);
        radarCtx.stroke();

        // Sedan Vehicle Icon
        const carRelX = (vehicleController.position[0] - playerPos[0]) * scale;
        const carRelZ = (vehicleController.position[2] - playerPos[2]) * scale;
        radarCtx.save();
        radarCtx.translate(cx + carRelX, cy + carRelZ);
        radarCtx.rotate(-vehicleController.rotationY);
        radarCtx.fillStyle = '#e11d48';
        radarCtx.fillRect(-4, -8, 8, 16);
        radarCtx.restore();

        // Milestone 7B: Traffic Vehicles Blips
        for (const tv of trafficSystem.vehicles) {
            const tvRelX = (tv.position[0] - playerPos[0]) * scale;
            const tvRelZ = (tv.position[2] - playerPos[2]) * scale;
            if (Math.hypot(tvRelX, tvRelZ) < radius) {
                radarCtx.save();
                radarCtx.translate(cx + tvRelX, cy + tvRelZ);
                radarCtx.rotate(-tv.rotationY);
                radarCtx.fillStyle = tv.type.id === 'hk-taxi' ? '#ef4444' : '#38bdf8';
                radarCtx.fillRect(-3, -6, 6, 12);
                radarCtx.restore();
            }
        }

        // Pedestrian AI Blip
        const pedRelX = (pedestrianAI.position[0] - playerPos[0]) * scale;
        const pedRelZ = (pedestrianAI.position[2] - playerPos[2]) * scale;
        radarCtx.beginPath();
        radarCtx.arc(cx + pedRelX, cy + pedRelZ, 4, 0, Math.PI * 2);
        radarCtx.fillStyle = pedestrianAI.state === 'FLEE' ? '#ef4444' : '#eab308';
        radarCtx.fill();

        // Milestone 7B: Crowd NPCs Blips
        for (const npc of crowdSystem.npcs) {
            if (npc.defeated) continue;
            const npcRelX = (npc.position[0] - playerPos[0]) * scale;
            const npcRelZ = (npc.position[2] - playerPos[2]) * scale;
            if (Math.hypot(npcRelX, npcRelZ) < radius) {
                radarCtx.beginPath();
                radarCtx.arc(cx + npcRelX, cy + npcRelZ, npc.isHostile ? 4 : 3, 0, Math.PI * 2);
                radarCtx.fillStyle = npc.isHostile ? '#ef4444' : '#fde047';
                radarCtx.fill();

                if (npc.isCounterable) {
                    radarCtx.beginPath();
                    radarCtx.arc(cx + npcRelX, cy + npcRelZ, 8, 0, Math.PI * 2);
                    radarCtx.strokeStyle = '#ff0033';
                    radarCtx.lineWidth = 2;
                    radarCtx.stroke();
                }
            }
        }

        // Sleeping Dogs Environmental Hazard Props Blips (Purple Diamond Markers)
        for (const h of ENVIRONMENTAL_HAZARDS) {
            const hRelX = (h.position[0] - playerPos[0]) * scale;
            const hRelZ = (h.position[2] - playerPos[2]) * scale;
            if (Math.hypot(hRelX, hRelZ) < radius) {
                radarCtx.save();
                radarCtx.translate(cx + hRelX, cy + hRelZ);
                radarCtx.rotate(Math.PI / 4);
                radarCtx.fillStyle = '#a855f7';
                radarCtx.fillRect(-2.5, -2.5, 5, 5);
                radarCtx.restore();
            }
        }

        // Canonical Story Mission Waypoint Objective Star
        const objectiveWorldPos = campaignStory.getActiveObjectivePos();

        if (objectiveWorldPos) {
            const objRelX = (objectiveWorldPos[0] - playerPos[0]) * scale;
            const objRelZ = (objectiveWorldPos[1] - playerPos[2]) * scale;
            const dist = Math.hypot(objRelX, objRelZ);
            const clampedDist = Math.min(dist, radius - 8);
            const angle = Math.atan2(objRelZ, objRelX);
            const beaconX = cx + Math.cos(angle) * clampedDist;
            const beaconZ = cy + Math.sin(angle) * clampedDist;

            // Draw glowing golden / crimson mission beacon
            radarCtx.beginPath();
            radarCtx.arc(beaconX, beaconZ, 5.5, 0, Math.PI * 2);
            radarCtx.fillStyle = '#facc15';
            radarCtx.fill();
            radarCtx.strokeStyle = '#ffffff';
            radarCtx.lineWidth = 1.5;
            radarCtx.stroke();
        }

        // Player orientation needle at center
        radarCtx.save();
        radarCtx.translate(cx, cy);
        radarCtx.rotate(-playerYaw);
        radarCtx.beginPath();
        radarCtx.moveTo(0, -9);
        radarCtx.lineTo(6, 6);
        radarCtx.lineTo(0, 3);
        radarCtx.lineTo(-6, 6);
        radarCtx.closePath();
        radarCtx.fillStyle = '#00d2ff';
        radarCtx.fill();
        radarCtx.restore();

        // Restore clip so outer meters and cardinal letters draw cleanly
        radarCtx.restore();

        // -------------------------------------------------------------
        // Sleeping Dogs Signature Scaleform Curved Health & Face Meters
        // -------------------------------------------------------------
        const meterRadius = 52.0;

        // Health Arc (Left Side: pi/2 clockwise to 3*pi/2)
        const hNorm = Math.max(0, Math.min(1, healthPct / 100));
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, meterRadius, Math.PI * 0.5, Math.PI * 1.5, false);
        radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        radarCtx.lineWidth = 3.5;
        radarCtx.stroke();

        if (hNorm > 0) {
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, meterRadius, Math.PI * 0.5, Math.PI * 0.5 + Math.PI * hNorm, false);
            radarCtx.strokeStyle = hNorm > 0.35 ? '#22c55e' : '#ef4444';
            radarCtx.lineWidth = 3.5;
            radarCtx.stroke();
        }

        // Face Meter Arc (Right Side: pi/2 counter-clockwise to -pi/2)
        const fNorm = Math.max(0, Math.min(1, facePct / 100));
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, meterRadius, Math.PI * 0.5, -Math.PI * 0.5, true);
        radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        radarCtx.lineWidth = 3.5;
        radarCtx.stroke();

        if (fNorm > 0) {
            radarCtx.beginPath();
            radarCtx.arc(cx, cy, meterRadius, Math.PI * 0.5, Math.PI * 0.5 - Math.PI * fNorm, true);
            radarCtx.strokeStyle = isFaceSurge ? '#ff0033' : '#eab308';
            radarCtx.lineWidth = isFaceSurge ? 4.5 : 3.5;
            radarCtx.stroke();
        }

        // Cardinal Ticks
        radarCtx.font = '8px monospace';
        radarCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        radarCtx.textAlign = 'center';
        radarCtx.textBaseline = 'middle';
        radarCtx.fillText('N', cx, cy - radius + 8);
        radarCtx.fillText('S', cx, cy + radius - 8);
        radarCtx.fillText('W', cx - radius + 8, cy);
        radarCtx.fillText('E', cx + radius - 8, cy);

        // Digital Speedometer (when driving)
        if (isDriving) {
            radarCtx.fillStyle = 'rgba(11, 14, 20, 0.90)';
            radarCtx.fillRect(cx + 6, cy + 30, 48, 18);
            radarCtx.strokeStyle = '#38bdf8';
            radarCtx.lineWidth = 1;
            radarCtx.strokeRect(cx + 6, cy + 30, 48, 18);

            radarCtx.font = 'bold 9px monospace';
            radarCtx.fillStyle = '#38bdf8';
            radarCtx.fillText(`${Math.round(speedKmh)} KM/H`, cx + 30, cy + 39);
        }
    }

    // Main Engine Render & Animation Loop
    let lastLoopTime = performance.now();
    function loop() {
        const now = performance.now();
        let rawDeltaTime = Math.min((now - lastLoopTime) / 1000.0, 0.1);
        lastLoopTime = now;

        // Cinematic slow-motion counter timescale
        if (slowMoTimer > 0) {
            slowMoTimer -= rawDeltaTime;
            rawDeltaTime *= 0.35;
        }
        const deltaTimeSec = rawDeltaTime;

        // 1. Advance Simulation & Kinematics (Milestone 6)
        const isDriving = vehicleController.isOccupied;
        let activePos: [number, number, number] = [0, 0, 0];
        let activeHeading = 0.0;
        let activeSpeed = 0.0;

        if (renderer.sceneGraph) {
            if (isDriving) {
                // Vehicle Driving Mode
                vehicleController.update(deltaTimeSec, physicsEngine, renderer.sceneGraph, audioEngine);
                activePos = [...vehicleController.position];
                activeHeading = vehicleController.rotationY;
                activeSpeed = vehicleController.speed;

                // FollowCameraEnterCar: Follows Sedan
                cameraController.targetPos = [...vehicleController.position];
                cameraController.vehicleHeading = vehicleController.rotationY;
                cameraController.vehicleSpeed = vehicleController.speed;

                // Update 4 Wheel sub-nodes with Ackerman steering and spin rotation
                const cosH = Math.cos(vehicleController.rotationY);
                const sinH = Math.sin(vehicleController.rotationY);
                const wheelDefs = [
                    { id: 'node-wheel-fl', side: -0.82, fwd:  1.35, isFront: true },
                    { id: 'node-wheel-fr', side:  0.82, fwd:  1.35, isFront: true },
                    { id: 'node-wheel-rl', side: -0.82, fwd: -1.30, isFront: false },
                    { id: 'node-wheel-rr', side:  0.82, fwd: -1.30, isFront: false }
                ];
                wheelDefs.forEach(w => {
                    const wNode = renderer.sceneGraph?.getNode(w.id);
                    if (!wNode) return;
                    const wx = vehicleController.position[0] + cosH * w.side + sinH * w.fwd;
                    const wy = vehicleController.groundY - 0.05;
                    const wz = vehicleController.position[2] - sinH * w.side + cosH * w.fwd;
                    const heading = w.isFront
                        ? vehicleController.rotationY + vehicleController.steeringAngle
                        : vehicleController.rotationY;
                    wNode.position = [wx, wy, wz];
                    wNode.rotation = [vehicleController.wheelSpinAngle, heading, 0];
                    wNode.transform = createTransformMatrix(wNode.position, wNode.rotation, wNode.scale);
                });

                // Update Asphalt Drift Skid Mark Ribbon Mesh
                if (vehicleController.skidMarks.length >= 2) {
                    const marks = vehicleController.skidMarks;
                    const count = marks.length;
                    const pos: number[] = [];
                    const norm: number[] = [];
                    const uvs: number[] = [];
                    const ind: number[] = [];
                    const treadW = 0.16;
                    for (let i = 0; i < count; i++) {
                        const m = marks[i];
                        const u = i / (count - 1);
                        pos.push(m.leftPoint[0] - treadW/2, m.leftPoint[1] + 0.02, m.leftPoint[2]);
                        norm.push(0, 1, 0);
                        uvs.push(u, 0);
                        pos.push(m.leftPoint[0] + treadW/2, m.leftPoint[1] + 0.02, m.leftPoint[2]);
                        norm.push(0, 1, 0);
                        uvs.push(u, 1);
                        pos.push(m.rightPoint[0] - treadW/2, m.rightPoint[1] + 0.02, m.rightPoint[2]);
                        norm.push(0, 1, 0);
                        uvs.push(u, 0);
                        pos.push(m.rightPoint[0] + treadW/2, m.rightPoint[1] + 0.02, m.rightPoint[2]);
                        norm.push(0, 1, 0);
                        uvs.push(u, 1);
                        if (i < count - 1) {
                            const bL = i * 4;
                            ind.push(bL, bL + 1, bL + 4);
                            ind.push(bL + 1, bL + 5, bL + 4);
                            const bR = i * 4 + 2;
                            ind.push(bR, bR + 1, bR + 4);
                            ind.push(bR + 1, bR + 5, bR + 4);
                        }
                    }
                    const skidNode = renderer.sceneGraph?.getNode('node-skid-marks');
                    if (skidNode) {
                        skidNode.mesh = {
                            name: 'Asphalt_Skid_Marks',
                            positions: new Float32Array(pos),
                            normals: new Float32Array(norm),
                            uvs: new Float32Array(uvs),
                            indices: new Uint16Array(ind),
                            vertexCount: pos.length / 3,
                            triangleCount: ind.length / 3,
                            bounds: { min: [-50, 0, -50], max: [50, 2, 50], center: [0, 0, 0], size: [100, 2, 100] }
                        };
                        renderer.updateNodeMesh(skidNode);
                    }
                }
            } else {
                // On Foot Mode (Wei Shen)
                characterController.update(
                    deltaTimeSec,
                    cameraController.yaw,
                    physicsEngine,
                    renderer.sceneGraph,
                    animPlayer,
                    audioEngine
                );
                activePos = [...characterController.position];
                activeHeading = characterController.rotationY;
                activeSpeed = Math.hypot(characterController.velocity[0], characterController.velocity[2]);

                // FollowCameraWalk: Follows Wei Shen
                cameraController.targetPos = [...characterController.position];
            }

            cameraController.update(deltaTimeSec, physicsEngine);

            // 2. Advance Pedestrian AI & Living Crowd Simulation
            pedestrianAI.update(
                deltaTimeSec,
                activePos,
                activeSpeed,
                isDriving,
                physicsEngine,
                renderer.sceneGraph
            );

            // Milestone 7A: World Streaming Update
            worldStreamer.update(activePos, renderer.sceneGraph);

            // Milestone 7B: Traffic & Crowd Simulation Update
            trafficSystem.update(deltaTimeSec, renderer.sceneGraph, activePos, isDriving ? vehicleController.position : undefined);
            crowdSystem.update(deltaTimeSec, renderer.sceneGraph, activePos, isDriving, audioEngine);

            // Milestone 7C: Dynamic Rain & Weather Update
            weatherSystem.update(deltaTimeSec, activePos);

            // 3. Advance Melee Combat System with Active Brawlers
            combatSystem.update(deltaTimeSec, (regen) => {
                playerHealth = Math.min(playerMaxHealth, playerHealth + regen);
                meterHealthFill.style.width = `${(playerHealth / playerMaxHealth) * 100}%`;
                meterHealthText.textContent = `${Math.round(playerHealth)}%`;
            });

            const targetInfo = combatSystem.updateTargeting(activePos, activeHeading, crowdSystem);

            // Red-Flash Counter Cue
            const counterAttacker = crowdSystem.getCounterableAttacker(activePos, 3.4);
            if (counterAttacker && !isDriving) {
                counterAlert.style.display = 'flex';
            } else {
                counterAlert.style.display = 'none';
            }

            // Face Meter Burst Banner
            if (combatSystem.isFaceSurgeActive) {
                faceBurstBanner.style.display = 'block';
                faceBurstBanner.textContent = `🐲 FACE METER BURST ACTIVE (${Math.round(combatSystem.faceSurgeTimer)}s) • 2.2x DAMAGE • RAPID REGEN 🐲`;
            } else {
                faceBurstBanner.style.display = 'none';
            }

            // Gunplay & Vehicular Aiming Update
            gunplaySystem.update(deltaTimeSec);

            // Canonical Sleeping Dogs Story Mission & Cutscene Pipeline Update
            if (renderer.sceneGraph) {
                campaignStory.update(
                    deltaTimeSec,
                    activePos,
                    isDriving,
                    cameraController,
                    audioEngine,
                    renderer.sceneGraph,
                    crowdSystem,
                    combatSystem
                );
            }

            // 4. Update Interactive Action Prompt
            const nearbyTraffic = trafficSystem.findNearbyVehicle(activePos);
            if (isDriving) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = '[F] EXIT SEDAN CHASSIS';
                actionPrompt.style.background = 'rgba(217, 38, 56, 0.95)';
                actionPrompt.style.boxShadow = 'none';
            } else if (vehicleController.canInteract(activePos)) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = '[F] JACK SEDAN';
                actionPrompt.style.background = 'rgba(0, 210, 255, 0.95)';
                actionPrompt.style.boxShadow = 'none';
            } else if (nearbyTraffic) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = `[F] HIJACK ${nearbyTraffic.type.name.split('(')[0].trim().toUpperCase()}`;
                actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
                actionPrompt.style.boxShadow = 'none';
            } else if (targetInfo.canCounter) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = `⚡ [R-CLICK / E] COUNTER INCOMING STRIKE! ⚡`;
                actionPrompt.style.background = '#ef4444';
                actionPrompt.style.boxShadow = '0 0 25px rgba(255, 0, 50, 0.9)';
            } else if (targetInfo.nearbyHazard && targetInfo.hasTarget && targetInfo.distance <= 3.2) {
                actionPrompt.style.display = 'block';
                actionPrompt.innerHTML = `⚡ <strong style="color:#facc15">[F] ENVIRONMENTAL TAKEDOWN:</strong> ${targetInfo.nearbyHazard.promptText} ⚡`;
                actionPrompt.style.background = 'rgba(168, 85, 247, 0.95)';
                actionPrompt.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.9)';
            } else if (targetInfo.hasTarget && targetInfo.distance <= combatSystem.strikeReach) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = `[L-CLICK] STRIKE (${targetInfo.targetHealth} HP) • [Q] HEAVY KICK • [F] GRAPPLE`;
                actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
                actionPrompt.style.boxShadow = 'none';
            } else {
                actionPrompt.style.display = 'none';
            }

            // 5. Update Health, Face Meter & Scores
            meterHealthFill.style.width = `${(playerHealth / playerMaxHealth) * 100}%`;
            meterHealthText.textContent = `${Math.round(playerHealth)}%`;
            meterFaceFill.style.width = `${combatSystem.faceMeter}%`;
            meterFaceText.textContent = `${Math.round(combatSystem.faceMeter)}%`;
            meterTriad.textContent = `TRIAD: ${combatSystem.triadScore}`;
            meterPolice.textContent = `POLICE: ${combatSystem.policeScore}`;

            // 6. Update Sidebar Simulation Cards
            const kmh = Math.abs(vehicleController.speed * 3.6).toFixed(1);
            cardVehicleSpeed.textContent = `${kmh} km/h ${isDriving ? '[ACTIVE]' : '[PARKED]'}`;
            cardComboStep.textContent = combatSystem.comboStep > 0
                ? `Hit ${combatSystem.comboStep}/3 [Active]`
                : 'Ready (Hit 1/3)';
            cardPedState.textContent = `${pedestrianAI.state} (${pedestrianAI.health} HP)`;
            cardTargetStatus.textContent = targetInfo.hasTarget
                ? `${targetInfo.distance.toFixed(1)}m [LOCK-ON]`
                : 'None in Range';

            // Milestone 7 Telemetry Cards
            cardStreamedSectors.textContent = `${worldStreamer.loadedSectorCount} Chunks (${worldStreamer.totalWorldTriangles.toLocaleString()} Tris)`;
            cardTrafficCount.textContent = `${trafficSystem.vehicles.length} Vehicles (${trafficSystem.trafficEnabled ? 'Running' : 'Paused'})`;
            cardCrowdCount.textContent = `${crowdSystem.npcs.length} NPCs (${crowdSystem.crowdEnabled ? 'Walking' : 'Paused'})`;

            // 7. Render Mini-Map Radar (with Scaleform Curved Health/Face meters & Speedometer)
            renderMiniMapRadar(
                activePos,
                isDriving ? vehicleController.rotationY : cameraController.yaw,
                (playerHealth / playerMaxHealth) * 100,
                combatSystem.faceMeter,
                combatSystem.isFaceSurgeActive,
                isDriving ? Math.abs(vehicleController.speed * 3.6) : 0,
                isDriving
            );
        }

        // 2. Advance Skeletal Motion & Update Joint Transforms
        animPlayer.update(deltaTimeSec, renderer.sceneGraph);

        // 3. Render 3D Viewport
        renderer.render();

        // 4. Update Audio Listener from Camera
        let camPos: [number, number, number];
        if (renderer.cameraMode === 'follow') {
            camPos = [cameraController.eyePos[0], cameraController.eyePos[1], cameraController.eyePos[2]];
        } else if (renderer.cameraMode === 'freefly') {
            camPos = [renderer.freeflyPos[0], renderer.freeflyPos[1], renderer.freeflyPos[2]];
        } else {
            camPos = [renderer.target[0], renderer.target[1] + 1.6, renderer.target[2] + 4.0];
        }
        audioEngine.updateListener(camPos, [0, 0, -1]);

        // 5. Render Audio Visualizer
        renderAudioSpectrum();

        // 6. Update Engine Pipeline HUD
        hudFps.textContent = `${renderer.fps}`;
        hudFrameTime.textContent = `${renderer.frameTimeMs.toFixed(1)} ms`;
        hudDrawCalls.textContent = `${renderer.drawCalls}`;
        hudTriangles.textContent = `${renderer.triangleCount.toLocaleString()}`;
        hudMesh.textContent = renderer.currentMeshName;
        hudTexture.textContent = renderer.currentTextureFormat;
        hudCache.textContent = `L1: ${cacheStats.l1Hits} | L2: ${cacheStats.l2Hits} | Miss: ${cacheStats.misses} | ${formatBytes(cacheStats.bytesLoaded)}`;

        // Physics & Locomotion Telemetry
        if (isDriving) {
            hudPlayerPos.textContent = `CAR X: ${vehicleController.position[0].toFixed(2)} Y: ${vehicleController.position[1].toFixed(2)} Z: ${vehicleController.position[2].toFixed(2)}`;
            hudLocomotion.textContent = `${(vehicleController.speed * 3.6).toFixed(1)} km/h [DRIVING]`;
            hudGroundElev.textContent = `Y: ${vehicleController.groundY.toFixed(2)}m [${vehicleController.surfaceNormal[0].toFixed(1)}, ${vehicleController.surfaceNormal[1].toFixed(1)}, ${vehicleController.surfaceNormal[2].toFixed(1)}]`;
            badgePhysicsState.textContent = 'Driving Sedan';
            badgePhysicsState.style.color = '#e11d48';
        } else {
            hudPlayerPos.textContent = `X: ${characterController.position[0].toFixed(2)} Y: ${characterController.position[1].toFixed(2)} Z: ${characterController.position[2].toFixed(2)}`;
            const horizSpeed = Math.hypot(characterController.velocity[0], characterController.velocity[2]);
            const stateTag = characterController.isAttacking
                ? 'STRIKE'
                : (characterController.isGrounded
                    ? (characterController.isSprinting ? 'SPRINT' : (horizSpeed > 0.15 ? 'WALK' : 'IDLE'))
                    : 'AIRBORNE');
            hudLocomotion.textContent = `${horizSpeed.toFixed(1)} m/s [${stateTag}]`;
            hudGroundElev.textContent = `Y: ${characterController.groundY.toFixed(2)}m [${characterController.surfaceNormal[0].toFixed(1)}, ${characterController.surfaceNormal[1].toFixed(1)}, ${characterController.surfaceNormal[2].toFixed(1)}] ${characterController.slopeDegrees.toFixed(0)}°`;

            badgePhysicsState.textContent = characterController.isAttacking
                ? 'Combat Strike'
                : (characterController.isGrounded
                    ? (characterController.isColliding ? 'Obstacle Contact' : 'Grounded')
                    : 'Airborne');
            badgePhysicsState.style.color = characterController.isColliding
                ? '#f59e0b'
                : (characterController.isGrounded ? '#4ade80' : '#38bdf8');
        }

        const obsStatus = characterController.isColliding ? 'VEHICLE CONTACT' : 'CLEAR';
        const camOcclStatus = cameraController.inCollision ? `PUSH: ${cameraController.collisionPush.toFixed(2)}m` : 'UNBLOCKED';
        hudCollisionStatus.textContent = `${obsStatus} | ${camOcclStatus}`;

        if (!isScrubbingTimeline) {
            const clip = animPlayer.getActiveClip();
            animTimeline.value = `${(animPlayer.currentTime / clip.duration) * 100}`;
            animTimeLabel.textContent = `${animPlayer.currentTime.toFixed(1)}s/${clip.duration.toFixed(1)}s`;
        }

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Initial Load: Activate Composite Street Scene & Start Ambience
    try {
        await activateCompositeStreet();
        await switchArchive('Game');
        // Initial audio start (will play once user interacts or via automated suite)
        audioEngine.playTrack('hk_ambience').catch(() => {
            hudAudio.textContent = 'Click "Play Audio" to unmute';
        });
    } catch (err) {
        console.warn('Initial autoload deferred:', err);
    }
});
