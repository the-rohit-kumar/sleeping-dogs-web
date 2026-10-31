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

window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('viewport') as HTMLCanvasElement;
    const renderer = new Viewport3D(canvas);
    const audioEngine = new AudioEngine();
    const animPlayer = new AnimationPlayer();
    const physicsEngine = new PhysicsEngine();
    const cameraController = new CameraController();
    const characterController = new CharacterController();

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

    // Viewport click triggers combat strike in follow camera mode
    canvas.addEventListener('click', (e) => {
        if (renderer.cameraMode === 'follow' && e.button === 0) {
            characterController.triggerAttack(animPlayer, audioEngine);
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

            // Position player character and lock follow camera
            characterController.position = [-2.2, 0.0, 1.2];
            characterController.velocity = [0, 0, 0];
            characterController.isGrounded = true;
            cameraController.targetPos = [...characterController.position];
            updateCameraModeUI('follow');

            cardStatus.textContent = 'Assembled composite street scene with Havok physics & follow camera';
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

    // Main Engine Render & Animation Loop
    let lastLoopTime = performance.now();
    function loop() {
        const now = performance.now();
        const deltaTimeSec = Math.min((now - lastLoopTime) / 1000.0, 0.1);
        lastLoopTime = now;

        // 1. Advance Player Character Locomotion & Havok Physics (Milestone 5)
        if (renderer.sceneGraph) {
            characterController.update(
                deltaTimeSec,
                cameraController.yaw,
                physicsEngine,
                renderer.sceneGraph,
                animPlayer,
                audioEngine
            );

            // Update authentic Sleeping Dogs follow camera target
            cameraController.targetPos = [...characterController.position];
            cameraController.update(deltaTimeSec, physicsEngine);
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

        // Milestone 5: Physics & Locomotion Telemetry
        hudPlayerPos.textContent = `X: ${characterController.position[0].toFixed(2)} Y: ${characterController.position[1].toFixed(2)} Z: ${characterController.position[2].toFixed(2)}`;
        const horizSpeed = Math.hypot(characterController.velocity[0], characterController.velocity[2]);
        const stateTag = characterController.isAttacking
            ? 'STRIKE'
            : (characterController.isGrounded
                ? (characterController.isSprinting ? 'SPRINT' : (horizSpeed > 0.15 ? 'WALK' : 'IDLE'))
                : 'AIRBORNE');
        hudLocomotion.textContent = `${horizSpeed.toFixed(1)} m/s [${stateTag}]`;
        hudGroundElev.textContent = `Y: ${characterController.groundY.toFixed(2)}m [${characterController.surfaceNormal[0].toFixed(1)}, ${characterController.surfaceNormal[1].toFixed(1)}, ${characterController.surfaceNormal[2].toFixed(1)}] ${characterController.slopeDegrees.toFixed(0)}°`;

        const obsStatus = characterController.isColliding ? 'VEHICLE CONTACT' : 'CLEAR';
        const camOcclStatus = cameraController.inCollision ? `PUSH: ${cameraController.collisionPush.toFixed(2)}m` : 'UNBLOCKED';
        hudCollisionStatus.textContent = `${obsStatus} | ${camOcclStatus}`;

        badgePhysicsState.textContent = characterController.isAttacking
            ? 'Combat Strike'
            : (characterController.isGrounded
                ? (characterController.isColliding ? 'Obstacle Contact' : 'Grounded')
                : 'Airborne');
        badgePhysicsState.style.color = characterController.isColliding
            ? '#f59e0b'
            : (characterController.isGrounded ? '#4ade80' : '#38bdf8');

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
