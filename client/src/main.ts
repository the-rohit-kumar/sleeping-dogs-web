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
import { parseIllusionBuffer } from './mesh-decoder';
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
import { SceneGraph } from './scene-graph';
import { AudioEngine, AUTHENTIC_TRACKS } from './audio-engine';
import { AnimationPlayer, AUTHENTIC_ANIMS, AnimStateName } from './anim-player';
import { PhysicsEngine } from './physics-engine';
import { CameraController } from './camera-controller';
import { CharacterController } from './character-controller';
import { VehicleController } from './vehicle-controller';
import { PedestrianAIController } from './pedestrian-ai';
import { CombatSystem } from './combat-system';

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

    // Expose subsystems on window for verification & inspection
    (window as any).characterController = characterController;
    (window as any).vehicleController = vehicleController;
    (window as any).pedestrianAI = pedestrianAI;
    (window as any).combatSystem = combatSystem;
    (window as any).cameraController = cameraController;

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

    // Milestone 6: Sleeping Dogs Mission & In-Game HUD
    const missionObjective = document.getElementById('mission-objective')!;
    const meterHealthText = document.getElementById('meter-health-text')!;
    const meterHealthFill = document.getElementById('meter-health-fill')!;
    const meterFaceText = document.getElementById('meter-face-text')!;
    const meterFaceFill = document.getElementById('meter-face-fill')!;
    const meterPolice = document.getElementById('meter-police')!;
    const meterTriad = document.getElementById('meter-triad')!;
    const actionPrompt = document.getElementById('action-prompt')!;
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
    // Milestone 6: Gameplay, NPCs & Vehicle Simulation Wiring
    // -------------------------------------------------------------
    const MISSION_OBJECTIVES = [
        "Approach the Sedan chassis [E] or patrol Hong Kong market sidewalk",
        "Drive Sedan through North Point sector [W/A/S/D] and test suspension dynamics",
        "Confront Triad pedestrian suspects on the sidewalk [L-Click Combo Strike]",
        "Perform a 3-hit martial arts combo to max out Face Meter and gain Triad Respect"
    ];
    let currentMissionIndex = 0;

    function setMissionObjective(index: number) {
        currentMissionIndex = index % MISSION_OBJECTIVES.length;
        missionObjective.textContent = MISSION_OBJECTIVES[currentMissionIndex];
    }

    btnNextMission.addEventListener('click', () => {
        setMissionObjective(currentMissionIndex + 1);
    });

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
                btnEnterCar.textContent = 'Exit Car [E]';
                btnEnterCar.classList.add('active');

                // Hide on-foot character mesh while inside car cabin
                const charNode = renderer.sceneGraph?.getNode('node-character');
                if (charNode) charNode.visible = false;

                setMissionObjective(1);
            }
        } else {
            // Exit vehicle
            vehicleController.toggleEntry(characterController.position, audioEngine);
            cameraController.isDriving = false;

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
            btnEnterCar.textContent = 'Enter Car [E]';
            btnEnterCar.classList.remove('active');

            // Switch audio back to city ambience
            audioEngine.playTrack('hk_ambience').catch(() => {});
            setMissionObjective(0);
        }
    }

    btnEnterCar.addEventListener('click', () => toggleVehicleEntry(true));

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE' || e.code === 'KeyF') {
            toggleVehicleEntry();
        }
    });

    function performCombatStrike() {
        if (vehicleController.isOccupied) return;

        const res = combatSystem.executeStrike(characterController.position, animPlayer, audioEngine);
        characterController.triggerAttack(animPlayer, audioEngine);

        if (res.hitLanded) {
            actionPrompt.style.display = 'block';
            actionPrompt.textContent = `COMBO HIT ${res.comboStep} (${res.damage} DMG)!`;
            actionPrompt.style.background = res.comboStep === 3 ? '#eab308' : '#d92638';
            setTimeout(() => {
                actionPrompt.style.display = 'none';
            }, 800);
        }
    }

    btnComboStrike.addEventListener('click', performCombatStrike);

    btnPedPanic.addEventListener('click', () => {
        pedestrianAI.state = 'FLEE';
        pedestrianAI.stateTimer = 5.0;
        audioEngine.playTrack('hk_dialogue').catch(() => {});
    });

    // Viewport click triggers combat strike in follow camera mode when on foot
    canvas.addEventListener('click', (e) => {
        if (renderer.cameraMode === 'follow' && e.button === 0 && !vehicleController.isOccupied) {
            performCombatStrike();
        }
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

    // Showcase Action: Load Hong Kong Street Scene (Composite Graph)
    async function activateCompositeStreet() {
        document.querySelectorAll('.showcase-bar button').forEach(b => {
            if (b.id !== 'btn-camera-mode') b.classList.remove('active');
        });
        btnCompositeStreet.classList.add('active');
        btnTexBc3.classList.add('active');

        try {
            cardStatus.textContent = 'Streaming composite street entities...';
            const { sceneGraph, texture } = await loadCompositeStreetScene();
            cachedTexture = texture;
            renderer.setTexture(texture);
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
            setMissionObjective(0);

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
    function renderMiniMapRadar(playerPos: [number, number, number], playerYaw: number) {
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

        // Pedestrian AI Blip
        const pedRelX = (pedestrianAI.position[0] - playerPos[0]) * scale;
        const pedRelZ = (pedestrianAI.position[2] - playerPos[2]) * scale;
        radarCtx.beginPath();
        radarCtx.arc(cx + pedRelX, cy + pedRelZ, 4, 0, Math.PI * 2);
        radarCtx.fillStyle = pedestrianAI.state === 'FLEE' ? '#ef4444' : '#eab308';
        radarCtx.fill();

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

        radarCtx.restore();
    }

    // Main Engine Render & Animation Loop
    let lastLoopTime = performance.now();
    function loop() {
        const now = performance.now();
        const deltaTimeSec = Math.min((now - lastLoopTime) / 1000.0, 0.1);
        lastLoopTime = now;

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

            // 2. Advance Pedestrian AI Crowd Simulation
            pedestrianAI.update(
                deltaTimeSec,
                activePos,
                activeSpeed,
                isDriving,
                physicsEngine,
                renderer.sceneGraph
            );

            // 3. Advance Melee Combat System
            combatSystem.update(deltaTimeSec);
            const targetInfo = combatSystem.updateTargeting(activePos, activeHeading, [pedestrianAI]);

            // 4. Update Interactive Action Prompt
            if (isDriving) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = '[E] EXIT SEDAN CHASSIS';
                actionPrompt.style.background = 'rgba(217, 38, 56, 0.95)';
            } else if (vehicleController.canInteract(activePos)) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = '[E] ENTER SEDAN CHASSIS';
                actionPrompt.style.background = 'rgba(0, 210, 255, 0.95)';
            } else if (targetInfo.hasTarget && targetInfo.distance <= combatSystem.strikeReach) {
                actionPrompt.style.display = 'block';
                actionPrompt.textContent = `[L-CLICK] STRIKE TARGET (${targetInfo.targetHealth} HP)`;
                actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
            } else {
                actionPrompt.style.display = 'none';
            }

            // 5. Update Health, Face Meter & Scores
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

            // 7. Render Mini-Map Radar
            renderMiniMapRadar(activePos, isDriving ? vehicleController.rotationY : cameraController.yaw);
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
