/**
 * main.ts
 * Main entry point for the Sleeping Dogs Browser Reconstruction Engine.
 * Streams authentic vehicle and character geometry and textures directly from
 * the local base-game read-only bridge (http://127.0.0.1:8080/).
 * ZERO synthetic assets: 100% extracted from Sleeping Dogs: Definitive Edition.
 */

import { Viewport3D } from './renderer';
import { parseBixBuffer, BixArchive } from './bix-parser';
import { parseIllusionBuffer } from './mesh-decoder';
import { decodeAuthenticTexture, TextureFormat } from './texture-decoder';
import {
    loadAuthenticVehicle,
    loadAuthenticCharacter,
    loadAuthenticWorldSector,
    loadAuthenticTexture,
    fetchArchiveIndex,
    fetchRange
} from './asset-loader';

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

    // Sidebar Elements
    const dropzone = document.getElementById('dropzone')!;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const cardName = document.getElementById('card-name')!;
    const cardEntries = document.getElementById('card-entries')!;
    const cardSize = document.getElementById('card-size')!;
    const cardStatus = document.getElementById('card-status')!;
    const entryList = document.getElementById('entry-list')!;
    const badgeCount = document.getElementById('badge-count')!;

    // Showcase buttons
    const btnMeshVehicle = document.getElementById('btn-mesh-vehicle')!;
    const btnMeshCharacter = document.getElementById('btn-mesh-character')!;
    const btnMeshWorld = document.getElementById('btn-mesh-world')!;
    const btnTexBc3 = document.getElementById('btn-tex-bc3')!;

    // Archive selector buttons
    const btnBixVehicles = document.getElementById('btn-bix-vehicles')!;
    const btnBixCharacters = document.getElementById('btn-bix-characters')!;
    const btnBixGame = document.getElementById('btn-bix-game')!;
    const btnBixUi = document.getElementById('btn-bix-ui')!;

    let currentArchiveName = 'Vehicles';
    let currentArchive: BixArchive | null = null;
    let hasAuthenticTexture = false;

    // Helper: Format bytes
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Populate Sidebar Entry List
    function renderEntries(archive: BixArchive) {
        currentArchive = archive;
        cardName.textContent = archive.name;
        cardEntries.textContent = `${archive.entries.length} assets`;
        cardSize.textContent = formatBytes(archive.payloadSize);
        cardStatus.textContent = 'HTTP 206 Streaming Active';
        cardStatus.style.color = '#4ade80';
        badgeCount.textContent = `${archive.entries.length} Entries`;

        entryList.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Render first 200 entries for smooth scrolling performance
        const displayLimit = Math.min(archive.entries.length, 250);
        for (let i = 0; i < displayLimit; i++) {
            const e = archive.entries[i];
            const div = document.createElement('div');
            div.className = 'entry-item';
            div.id = `entry-${i}`;

            const hexUid = e.uidHex;
            const hexOff = e.offsetHex;

            div.innerHTML = `
                <div>
                    <span style="color: var(--accent-cyan); margin-right: 6px;">#${e.index}</span>
                    <span>${hexUid}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 10px;">
                    ${hexOff} | ${e.totalSpan}b
                </div>
            `;

            div.addEventListener('click', async () => {
                document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');

                // If entry has a non-zero span, stream it live from .big
                if (e.totalSpan > 0) {
                    try {
                        const raw = await fetchRange(archive.name.replace('.bix', ''), e.offset, e.totalSpan);

                        // Try decoding as buffer mesh
                        const mesh = parseIllusionBuffer(raw, `Entry_${hexUid}`);
                        if (mesh) {
                            renderer.setMesh(mesh);
                            hudMesh.textContent = mesh.name;
                        } else if (raw.length >= 4096) {
                            // Try decoding as BC3 texture
                            const dim = raw.length >= 16384 ? 128 : 64;
                            const tex = decodeAuthenticTexture(raw.subarray(16), dim, dim, TextureFormat.BC3, `Tex_${hexUid}`);
                            renderer.setTexture(tex);
                            hudTexture.textContent = tex.formatName;
                        }
                    } catch (err) {
                        console.warn(`Could not decode entry ${hexUid}:`, err);
                    }
                }
            });

            fragment.appendChild(div);
        }

        entryList.appendChild(fragment);
    }

    // Stream an archive index (.bix) from base game bridge
    async function switchArchive(name: string) {
        currentArchiveName = name;
        [btnBixVehicles, btnBixCharacters, btnBixGame, btnBixUi].forEach(b => b.classList.remove('active'));

        if (name === 'Vehicles') btnBixVehicles.classList.add('active');
        if (name === 'Characters') btnBixCharacters.classList.add('active');
        if (name === 'Game') btnBixGame.classList.add('active');
        if (name === 'UI') btnBixUi.classList.add('active');

        cardStatus.textContent = `Streaming ${name}.bix...`;
        cardStatus.style.color = 'var(--accent-cyan)';

        try {
            const archive = await fetchArchiveIndex(name);
            renderEntries(archive);
        } catch (err: any) {
            cardStatus.textContent = `Error: ${err.message}`;
            cardStatus.style.color = 'var(--accent-crimson)';
        }
    }

    // Showcase: Authentic Vehicle (2A)
    btnMeshVehicle.addEventListener('click', async () => {
        btnMeshVehicle.classList.add('active');
        btnMeshCharacter.classList.remove('active');
        btnMeshWorld.classList.remove('active');

        try {
            hudMesh.textContent = "Streaming Vehicles.big [0x01f0a400]...";
            const mesh = await loadAuthenticVehicle();
            renderer.setMesh(mesh);
            hudMesh.textContent = mesh.name;
        } catch (err: any) {
            hudMesh.textContent = `Error: ${err.message}`;
        }
    });

    // Showcase: Authentic Character (2B)
    btnMeshCharacter.addEventListener('click', async () => {
        btnMeshCharacter.classList.add('active');
        btnMeshVehicle.classList.remove('active');
        btnMeshWorld.classList.remove('active');

        try {
            hudMesh.textContent = "Streaming Characters.big [0x161f3000]...";
            const mesh = await loadAuthenticCharacter();
            renderer.setMesh(mesh);
            hudMesh.textContent = mesh.name;
        } catch (err: any) {
            hudMesh.textContent = `Error: ${err.message}`;
        }
    });

    // Showcase: Authentic World Sector (Milestone 3)
    btnMeshWorld.addEventListener('click', async () => {
        btnMeshWorld.classList.add('active');
        btnMeshVehicle.classList.remove('active');
        btnMeshCharacter.classList.remove('active');

        try {
            hudMesh.textContent = "Streaming Game.big [0x1b7ef400]...";
            const mesh = await loadAuthenticWorldSector();
            renderer.setMesh(mesh);
            hudMesh.textContent = mesh.name;
        } catch (err: any) {
            hudMesh.textContent = `Error: ${err.message}`;
        }
    });

    // Showcase: Authentic UI Texture
    btnTexBc3.addEventListener('click', async () => {
        btnTexBc3.classList.add('active');

        try {
            hudTexture.textContent = "Streaming UI.big [0x02f9ec00]...";
            const tex = await loadAuthenticTexture();
            renderer.setTexture(tex);
            hasAuthenticTexture = true;
            hudTexture.textContent = tex.formatName;
        } catch (err: any) {
            hudTexture.textContent = `Error: ${err.message}`;
        }
    });

    // Archive selector clicks
    btnBixVehicles.addEventListener('click', () => switchArchive('Vehicles'));
    btnBixCharacters.addEventListener('click', () => switchArchive('Characters'));
    btnBixGame.addEventListener('click', () => switchArchive('Game'));
    btnBixUi.addEventListener('click', () => switchArchive('UI'));

    // Dropzone local file handler
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const buf = event.target?.result as ArrayBuffer;
            if (buf) {
                const archive = parseBixBuffer(buf);
                renderEntries(archive);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const buf = event.target?.result as ArrayBuffer;
            if (buf) {
                const archive = parseBixBuffer(buf);
                renderEntries(archive);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Initial Base Game Stream: Authentic Vehicle + Authentic Texture + Vehicles.bix Index
    async function initBaseGameStream() {
        try {
            hudMesh.textContent = "Connecting to bridge at 127.0.0.1:8080...";
            const vehicleMesh = await loadAuthenticVehicle();
            renderer.setMesh(vehicleMesh);
            hudMesh.textContent = vehicleMesh.name;

            const baseTex = await loadAuthenticTexture();
            renderer.setTexture(baseTex);
            hasAuthenticTexture = true;
            hudTexture.textContent = baseTex.formatName;

            await switchArchive('Vehicles');
        } catch (err: any) {
            console.error("Initial base game stream failure:", err);
            hudMesh.textContent = `Stream Error: ${err.message}`;
        }
    }

    // Animation & HUD metrics loop
    function animate() {
        renderer.render();

        hudFps.textContent = renderer.fps.toString();
        hudFrameTime.textContent = renderer.frameTimeMs.toFixed(2) + ' ms';
        hudDrawCalls.textContent = renderer.drawCalls.toString();
        hudTriangles.textContent = renderer.triangleCount.toLocaleString();

        requestAnimationFrame(animate);
    }

    // Launch!
    animate();
    initBaseGameStream();
});
