import { Viewport3D } from './renderer';
import { parseBixBuffer, BixArchive } from './bix-parser';
import { createVehicleMesh, DecodedMesh } from './mesh-decoder';
import { decompressBC1, decompressBC3, createProceduralTexture, TextureFormat, DecodedTexture } from './texture-decoder';

window.addEventListener('DOMContentLoaded', () => {
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
    const btnMeshCrate = document.getElementById('btn-mesh-crate')!;
    const btnTexBc1 = document.getElementById('btn-tex-bc1')!;
    const btnTexBc3 = document.getElementById('btn-tex-bc3')!;
    const btnTexUv = document.getElementById('btn-tex-uv')!;

    // Simple procedural box mesh for crate
    function createCrateMesh(): DecodedMesh {
        const p = [
            -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,
            -1, -1, -1,  -1,  1, -1,   1,  1, -1,   1, -1, -1,
            -1,  1, -1,  -1,  1,  1,   1,  1,  1,   1,  1, -1,
            -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,
             1, -1, -1,   1,  1, -1,   1,  1,  1,   1, -1,  1,
            -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1
        ];
        const n = [
             0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
             0, 0,-1,   0, 0,-1,   0, 0,-1,   0, 0,-1,
             0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
             0,-1, 0,   0,-1, 0,   0,-1, 0,   0,-1, 0,
             1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0
        ];
        const u = [
            0,0, 1,0, 1,1, 0,1,
            1,0, 1,1, 0,1, 0,0,
            0,1, 0,0, 1,0, 1,1,
            0,0, 1,0, 1,1, 0,1,
            1,0, 1,1, 0,1, 0,0,
            0,0, 1,0, 1,1, 0,1
        ];
        const idx = [
             0, 1, 2,  0, 2, 3,
             4, 5, 6,  4, 6, 7,
             8, 9,10,  8,10,11,
            12,13,14, 12,14,15,
            16,17,18, 16,18,19,
            20,21,22, 20,22,23
        ];
        return {
            name: "Prop_Shipping_Crate",
            positions: new Float32Array(p),
            normals: new Float32Array(n),
            uvs: new Float32Array(u),
            indices: new Uint16Array(idx),
            vertexCount: 24,
            triangleCount: 12
        };
    }

    // Showcase button events
    btnMeshVehicle.addEventListener('click', () => {
        btnMeshVehicle.classList.add('active');
        btnMeshCrate.classList.remove('active');
        renderer.setMesh(createVehicleMesh("SleepingDogs_Sedan_LOD0"));
    });

    btnMeshCrate.addEventListener('click', () => {
        btnMeshCrate.classList.add('active');
        btnMeshVehicle.classList.remove('active');
        renderer.setMesh(createCrateMesh());
    });

    btnTexBc1.addEventListener('click', () => {
        btnTexBc1.classList.add('active');
        btnTexBc3.classList.remove('active');
        btnTexUv.classList.remove('active');

        // Create synthetic BC1 block compressed texture (simulating Sleeping Dogs vehicle paint/decal)
        const bc1Blocks = new Uint8Array(64 * 64 * 8 / 16);
        for (let i = 0; i < bc1Blocks.length; i += 8) {
            bc1Blocks[i + 0] = 0xf8; bc1Blocks[i + 1] = 0x00; // Red color 0
            bc1Blocks[i + 2] = 0x00; bc1Blocks[i + 3] = 0x1f; // Blue color 1
            bc1Blocks[i + 4] = 0x1b; bc1Blocks[i + 5] = 0xe4; // Mixed interpolation
            bc1Blocks[i + 6] = 0xe4; bc1Blocks[i + 7] = 0x1b;
        }
        const tex: DecodedTexture = {
            width: 64,
            height: 64,
            mipLevels: 1,
            format: TextureFormat.BC1,
            formatName: "Decoded BC1 / DXT1",
            rgbaPixels: decompressBC1(bc1Blocks, 64, 64)
        };
        renderer.setTexture(tex);
    });

    btnTexBc3.addEventListener('click', () => {
        btnTexBc3.classList.add('active');
        btnTexBc1.classList.remove('active');
        btnTexUv.classList.remove('active');

        // Synthetic BC3 block compressed texture (with alpha gradient)
        const bc3Blocks = new Uint8Array(64 * 64);
        for (let i = 0; i < bc3Blocks.length; i += 16) {
            bc3Blocks[i + 0] = 0xff; bc3Blocks[i + 1] = 0x20; // Alpha endpoints
            bc3Blocks[i + 8] = 0x07; bc3Blocks[i + 9] = 0xe0; // Green color 0
            bc3Blocks[i + 10] = 0xff; bc3Blocks[i + 11] = 0xff; // White color 1
            bc3Blocks[i + 12] = 0x55; bc3Blocks[i + 13] = 0x55;
            bc3Blocks[i + 14] = 0xaa; bc3Blocks[i + 15] = 0xaa;
        }
        const tex: DecodedTexture = {
            width: 64,
            height: 64,
            mipLevels: 1,
            format: TextureFormat.BC3,
            formatName: "Decoded BC3 / DXT5",
            rgbaPixels: decompressBC3(bc3Blocks, 64, 64)
        };
        renderer.setTexture(tex);
    });

    btnTexUv.addEventListener('click', () => {
        btnTexUv.classList.add('active');
        btnTexBc1.classList.remove('active');
        btnTexBc3.classList.remove('active');
        const tex: DecodedTexture = {
            width: 256,
            height: 256,
            mipLevels: 1,
            format: TextureFormat.RGBA8,
            formatName: "Procedural UV Grid",
            rgbaPixels: createProceduralTexture(256, 256)
        };
        renderer.setTexture(tex);
    });

    // Animation loop
    function animate() {
        renderer.render();

        hudFps.textContent = renderer.fps.toString();
        hudFrameTime.textContent = renderer.frameTimeMs.toFixed(2) + ' ms';
        hudDrawCalls.textContent = renderer.drawCalls.toString();
        hudTriangles.textContent = renderer.triangleCount.toLocaleString();
        hudMesh.textContent = renderer.currentMeshName;
        hudTexture.textContent = renderer.currentTextureFormat;

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    // File Drag & Drop Handlers
    dropzone.addEventListener('click', () => fileInput.click());

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
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const buffer = reader.result as ArrayBuffer;
                const archive = parseBixBuffer(buffer);
                displayArchive(archive);
            } catch (err: any) {
                alert('Failed to parse archive: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function displayArchive(archive: BixArchive) {
        cardName.textContent = archive.name;
        cardEntries.textContent = archive.entryCount.toLocaleString();
        cardSize.textContent = archive.payloadSize.toLocaleString() + ' bytes';
        badgeCount.textContent = archive.entryCount.toLocaleString() + ' Entries';

        // Check mathematical invariants
        let validInvariants = 0;
        let multiPart = 0;
        for (const e of archive.entries) {
            if (e.isMultiPart) {
                multiPart++;
                if (e.part1Size + e.part2Size === e.totalSpan + e.padding) {
                    validInvariants++;
                }
            }
        }

        if (multiPart === 0 || validInvariants === multiPart) {
            cardStatus.textContent = '100% Invariants Verified';
            cardStatus.style.color = '#4ade80';
        } else {
            cardStatus.textContent = `Warning: ${multiPart - validInvariants} invalid`;
            cardStatus.style.color = '#ef4444';
        }

        entryList.innerHTML = '';
        const displayLimit = Math.min(200, archive.entries.length);

        for (let i = 0; i < displayLimit; i++) {
            const e = archive.entries[i];
            const div = document.createElement('div');
            div.className = 'entry-item';
            div.innerHTML = `
                <span>${e.uidHex}</span>
                <span style="color: var(--text-muted);">${e.offsetHex}</span>
                <span style="color: var(--accent-cyan);">${e.totalSpan.toLocaleString()} B</span>
            `;

            div.addEventListener('click', () => {
                document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                console.log('Selected Resource Entry:', e);
            });

            entryList.appendChild(div);
        }
    }

    // Load initial sample data (GameHD2 representation)
    const initialSample: BixArchive = {
        name: 'GameHD2 (Demo Catalog)',
        entryCount: 44,
        payloadSize: 1232,
        entries: [
            { index: 0, uid: 0x11718ba9, uidHex: '0x11718ba9', offset: 0x061c5000, offsetHex: '0x061c5000', part1Size: 3532176, part2Size: 24025815, padding: 7, totalSpan: 27557984, isMultiPart: true },
            { index: 1, uid: 0x1435d4c6, uidHex: '0x1435d4c6', offset: 0x06d16c00, offsetHex: '0x06d16c00', part1Size: 1498056, part2Size: 979024, padding: 8, totalSpan: 2477072, isMultiPart: true },
            { index: 2, uid: 0x15362c4c, uidHex: '0x15362c4c', offset: 0x02ad4800, offsetHex: '0x02ad4800', part1Size: 2525976, part2Size: 1312606, padding: 6, totalSpan: 3838576, isMultiPart: true },
            { index: 3, uid: 0x203c51c5, uidHex: '0x203c51c5', offset: 0x01b44800, offsetHex: '0x01b44800', part1Size: 1928072, part2Size: 1682288, padding: 8, totalSpan: 3610352, isMultiPart: true },
            { index: 4, uid: 0x2377ea2e, uidHex: '0x2377ea2e', offset: 0x0251a000, offsetHex: '0x0251a000', part1Size: 1958856, part2Size: 1377402, padding: 2, totalSpan: 3336256, isMultiPart: true }
        ]
    };
    displayArchive(initialSample);
});
