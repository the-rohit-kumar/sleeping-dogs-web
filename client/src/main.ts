/**
 * main.ts
 * Main entry point for the Sleeping Dogs Browser Reconstruction Engine.
 * Streams authentic vehicle, character, and Hong Kong world geometry and textures
 * directly from the local base-game read-only bridge (http://127.0.0.1:8080/).
 *
 * Implements:
 *  - Milestone 3: Hong Kong Street Scene Graph with spatial hierarchy & node transforms
 *  - Dual Camera Navigation: Orbit Turntable & Street Free-Fly (WASD + Mouse Look)
 *  - Two-tier LRU / IndexedDB caching
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

window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('viewport') as HTMLCanvasElement;
    const renderer = new Viewport3D(canvas);

    // HUD Elements
    const hudFps = document.getElementById('hud-fps')!;
    const hudFrameTime = document.getElementById('hud-frametime')!;
    const hudDrawCalls = document.getElementById('hud-drawcalls')!;
    const hudTriangles = document.getElementById('hud-triangles')!;
    const hudMesh = document.getElementById('hud-mesh')!;
    const hudTexture = document.getElementById('hud-texture')!;
    const hudCamMode = document.getElementById('hud-cam-mode')!;
    const hudCache = document.getElementById('hud-cache')!;
    const controlsHint = document.getElementById('controls-hint')!;

    // Sidebar Elements
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

    // Helper: Format bytes
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Update Camera Mode UI & Hint
    function updateCameraModeUI(mode: CameraMode) {
        renderer.setCameraMode(mode);
        if (mode === 'orbit') {
            btnCameraMode.textContent = 'Camera: Orbit';
            btnCameraMode.style.borderColor = '#a78bfa';
            btnCameraMode.style.color = '#a78bfa';
            hudCamMode.textContent = 'Orbit Turntable';
            controlsHint.innerHTML = '<span>Left Drag:</span> Orbit | <span>Right Drag:</span> Pan | <span>Scroll:</span> Zoom | <span>Click "Camera"</span> for Street WASD';
        } else {
            btnCameraMode.textContent = 'Camera: Street (WASD)';
            btnCameraMode.style.borderColor = '#38bdf8';
            btnCameraMode.style.color = '#38bdf8';
            hudCamMode.textContent = 'Street Free-Fly (WASD)';
            controlsHint.innerHTML = '<span>[W][A][S][D]:</span> Move | <span>[Shift]:</span> Sprint | <span>[E]/[Space]:</span> Up | <span>[Q]/[C]:</span> Down | <span>Drag:</span> Look';
        }
    }

    btnCameraMode.addEventListener('click', () => {
        const nextMode = renderer.cameraMode === 'orbit' ? 'freefly' : 'orbit';
        updateCameraModeUI(nextMode);
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
                        // Not a standard 32-byte mesh buffer; inspected metadata logged
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

            // Frame camera nicely on the composite scene
            renderer.target = [0, 0.4, 0];
            renderer.distance = 12.0;
            renderer.yaw = 0.8;
            renderer.pitch = 0.35;

            cardStatus.textContent = 'Assembled composite street scene graph';
            cardStatus.style.color = '#4ade80';
        } catch (err: any) {
            console.error('Failed to load composite street scene:', err);
            cardStatus.textContent = `Street scene load failed: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    }

    btnCompositeStreet.addEventListener('click', activateCompositeStreet);

    // Showcase Action: Stream Vehicle Mesh
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

    // Showcase Action: Stream Character Mesh
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

    // Showcase Action: Stream Hong Kong World Sector
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

    // Showcase Action: Toggle Authentic Texture
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

    // Render Loop & HUD Update
    function loop() {
        renderer.render();

        hudFps.textContent = `${renderer.fps}`;
        hudFrameTime.textContent = `${renderer.frameTimeMs.toFixed(1)} ms`;
        hudDrawCalls.textContent = `${renderer.drawCalls}`;
        hudTriangles.textContent = `${renderer.triangleCount.toLocaleString()}`;
        hudMesh.textContent = renderer.currentMeshName;
        hudTexture.textContent = renderer.currentTextureFormat;
        hudCache.textContent = `L1: ${cacheStats.l1Hits} | L2: ${cacheStats.l2Hits} | Miss: ${cacheStats.misses} | ${formatBytes(cacheStats.bytesLoaded)}`;

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Initial Load: Activate Milestone 3 Composite Street Scene Graph
    try {
        await activateCompositeStreet();
        await switchArchive('Game');
    } catch (err) {
        console.warn('Initial autoload deferred:', err);
    }
});
