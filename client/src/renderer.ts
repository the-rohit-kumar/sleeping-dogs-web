/**
 * Sleeping Dogs Browser Reconstruction — 3D Viewport Renderer.
 * Modern WebGL2 pipeline with perspective camera, dual camera controllers
 * (Orbital Inspection & First-Person Street Free-Fly), real-time lighting,
 * dynamic texture mapping, multi-node Scene Graph hierarchy, and technical metrics.
 *
 * ZERO synthetic assets: Renders only authentic base-game geometry and textures.
 */

import { DecodedTexture } from './texture-decoder';
import { DecodedMesh } from './mesh-decoder';
import { SceneGraph, SceneNode } from './scene-graph';
import { CameraController } from './camera-controller';

export type CameraMode = 'follow' | 'orbit' | 'freefly';

export class Viewport3D {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program!: WebGLProgram;
    private gridProgram!: WebGLProgram;
    private singleVao!: WebGLVertexArrayObject;
    private gridVao!: WebGLVertexArrayObject;
    private texture: WebGLTexture | null = null;
    private hasTexture = false;

    private singleVbo!: WebGLBuffer;
    private singleEbo!: WebGLBuffer;

    // Active Scene Graph (for multi-object composite scenes)
    public sceneGraph: SceneGraph | null = null;

    // Authentic Follow Camera Controller (Milestone 5)
    public cameraController: CameraController | null = null;

    // Camera Mode & State
    public cameraMode: CameraMode = 'follow';

    // Orbit Camera State
    public distance = 5.5;
    public yaw = 0.75;
    public pitch = 0.35;
    public target = [0, 0.4, 0];

    // Free-Fly Street Camera State
    public freeflyPos = [0.0, 1.6, 6.0]; // Eye level (1.6m height)
    public freeflyYaw = 0.0;
    public freeflyPitch = 0.0;
    public moveSpeed = 6.0; // meters per second
    public sprintMultiplier = 2.8;

    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;
    private keysDown = new Set<string>();

    // Metrics
    public fps = 0;
    public frameTimeMs = 0;
    public drawCalls = 0;
    public triangleCount = 0;
    public currentMeshName = "Pending Base Game Stream";
    public currentTextureFormat = "No Texture Bound";

    private lastTime = performance.now();
    private frameCounter = 0;
    private fpsTimer = performance.now();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
        if (!gl) {
            throw new Error('WebGL2 is not supported by your browser.');
        }
        this.gl = gl;

        this.initShaders();
        this.initBuffers();
        this.initEvents();
        this.resize();
    }

    private initShaders() {
        const gl = this.gl;

        // Model Shaders
        const vsSource = `#version 300 es
            layout(location = 0) in vec3 aPosition;
            layout(location = 1) in vec3 aNormal;
            layout(location = 2) in vec2 aUV;

            uniform mat4 uModel;
            uniform mat4 uView;
            uniform mat4 uProjection;

            out vec3 vNormal;
            out vec3 vFragPos;
            out vec2 vUV;

            void main() {
                vFragPos = vec3(uModel * vec4(aPosition, 1.0));
                vNormal = mat3(transpose(inverse(uModel))) * aNormal;
                vUV = aUV;
                gl_Position = uProjection * uView * vec4(vFragPos, 1.0);
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;

            in vec3 vNormal;
            in vec3 vFragPos;
            in vec2 vUV;

            uniform vec3 uLightPos;
            uniform vec3 uLightColor;
            uniform vec3 uObjectColor;
            uniform vec3 uViewPos;
            uniform sampler2D uTexture;
            uniform bool uHasTexture;

            out vec4 fragColor;

            void main() {
                // Ambient
                float ambientStrength = 0.38;
                vec3 ambient = ambientStrength * uLightColor;

                // Diffuse
                vec3 norm = normalize(vNormal);
                vec3 lightDir = normalize(uLightPos - vFragPos);
                float diff = max(dot(norm, lightDir), 0.0);
                vec3 diffuse = diff * uLightColor;

                // Specular (Blinn-Phong)
                vec3 viewDir = normalize(uViewPos - vFragPos);
                vec3 halfwayDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(norm, halfwayDir), 0.0), 32.0);
                vec3 specular = 0.35 * spec * uLightColor;

                vec3 baseColor = uObjectColor;
                if (uHasTexture) {
                    vec4 texColor = texture(uTexture, vUV);
                    baseColor = mix(uObjectColor, texColor.rgb, 0.85);
                }

                vec3 result = (ambient + diffuse + specular) * baseColor;
                fragColor = vec4(result, 1.0);
            }
        `;

        this.program = this.createProgram(vsSource, fsSource);

        // Ground Grid Shaders
        const gridVs = `#version 300 es
            layout(location = 0) in vec3 aPosition;
            uniform mat4 uView;
            uniform mat4 uProjection;
            out vec3 vWorldPos;
            void main() {
                vWorldPos = aPosition;
                gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            }
        `;

        const gridFs = `#version 300 es
            precision highp float;
            in vec3 vWorldPos;
            out vec4 fragColor;
            void main() {
                float dist = length(vWorldPos.xz);
                float alpha = exp(-dist * 0.05);
                vec2 g = abs(fract(vWorldPos.xz) - 0.5) / fwidth(vWorldPos.xz);
                float line = min(g.x, g.y);
                float gridMask = 1.0 - min(line, 1.0);
                vec3 color = mix(vec3(0.08, 0.10, 0.14), vec3(0.12, 0.55, 0.95), gridMask);
                fragColor = vec4(color, alpha * 0.7);
            }
        `;

        this.gridProgram = this.createProgram(gridVs, gridFs);
    }

    private createProgram(vsCode: string, fsCode: string): WebGLProgram {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsCode);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsCode);
        gl.compileShader(fs);

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Shader compilation failure: ' + gl.getProgramInfoLog(prog));
        }
        return prog;
    }

    private initBuffers() {
        const gl = this.gl;
        this.singleVao = gl.createVertexArray()!;
        this.singleVbo = gl.createBuffer()!;
        this.singleEbo = gl.createBuffer()!;

        // Ground Grid Geometry (Large 60m x 60m street grid)
        const gridSize = 60;
        const gridVerts: number[] = [];
        for (let i = -gridSize; i <= gridSize; i += 2) {
            gridVerts.push(-gridSize, 0, i, gridSize, 0, i);
            gridVerts.push(i, 0, -gridSize, i, 0, gridSize);
        }

        this.gridVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.gridVao);
        const gridVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, gridVbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVerts), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
        gl.enableVertexAttribArray(0);
        gl.bindVertexArray(null);
    }

    public setCameraMode(mode: CameraMode) {
        this.cameraMode = mode;
        if (mode === 'freefly') {
            // Initialize freefly position relative to current target
            this.freeflyPos = [this.target[0], 1.6, this.target[2] + 4.5];
            this.freeflyYaw = this.yaw;
            this.freeflyPitch = 0.0;
        } else if (mode === 'follow' && this.cameraController) {
            this.cameraController.yaw = this.yaw;
            this.cameraController.pitch = this.pitch;
        }
    }

    /**
     * Sets an active composite Scene Graph
     */
    public setSceneGraph(sg: SceneGraph) {
        this.sceneGraph = sg;
        this.currentMeshName = `Composite Scene Graph (${sg.getAllNodes().length} Nodes)`;
        this.triangleCount = sg.getTotalTriangles();
    }

    /**
     * Prepares GPU buffers for a specific SceneNode
     */
    private initNodeGpu(node: SceneNode) {
        const gl = this.gl;
        const mesh = node.mesh;

        node.vao = gl.createVertexArray();
        node.vbo = gl.createBuffer();
        node.ebo = gl.createBuffer();

        const vertexCount = mesh.vertexCount;
        const interleaved = new Float32Array(vertexCount * 8);
        for (let i = 0; i < vertexCount; i++) {
            interleaved[i * 8 + 0] = mesh.positions[i * 3 + 0];
            interleaved[i * 8 + 1] = mesh.positions[i * 3 + 1];
            interleaved[i * 8 + 2] = mesh.positions[i * 3 + 2];

            interleaved[i * 8 + 3] = mesh.normals[i * 3 + 0];
            interleaved[i * 8 + 4] = mesh.normals[i * 3 + 1];
            interleaved[i * 8 + 5] = mesh.normals[i * 3 + 2];

            interleaved[i * 8 + 6] = mesh.uvs[i * 2 + 0];
            interleaved[i * 8 + 7] = mesh.uvs[i * 2 + 1];
        }

        gl.bindVertexArray(node.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, node.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, node.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        const stride = 8 * 4;
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(0);

        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.enableVertexAttribArray(1);

        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
        gl.enableVertexAttribArray(2);

        gl.bindVertexArray(null);
        node.gpuReady = true;
    }

    /**
     * Binds and displays a single authentic decoded 3D mesh
     */
    public setMesh(mesh: DecodedMesh) {
        this.sceneGraph = null; // Clear multi-node graph when viewing single mesh
        const gl = this.gl;
        this.currentMeshName = mesh.name;
        this.triangleCount = mesh.triangleCount;

        // Auto-frame camera to model bounding box
        if (mesh.bounds) {
            this.target = [mesh.bounds.center[0], mesh.bounds.center[1], mesh.bounds.center[2]];
            const maxDim = Math.max(mesh.bounds.size[0], mesh.bounds.size[1], mesh.bounds.size[2]);
            this.distance = Math.max(2.5, maxDim * 1.6);
        }

        const vertexCount = mesh.vertexCount;
        const interleaved = new Float32Array(vertexCount * 8);
        for (let i = 0; i < vertexCount; i++) {
            interleaved[i * 8 + 0] = mesh.positions[i * 3 + 0];
            interleaved[i * 8 + 1] = mesh.positions[i * 3 + 1];
            interleaved[i * 8 + 2] = mesh.positions[i * 3 + 2];

            interleaved[i * 8 + 3] = mesh.normals[i * 3 + 0];
            interleaved[i * 8 + 4] = mesh.normals[i * 3 + 1];
            interleaved[i * 8 + 5] = mesh.normals[i * 3 + 2];

            interleaved[i * 8 + 6] = mesh.uvs[i * 2 + 0];
            interleaved[i * 8 + 7] = mesh.uvs[i * 2 + 1];
        }

        gl.bindVertexArray(this.singleVao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.singleVbo);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.singleEbo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        const stride = 8 * 4;
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(0);

        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.enableVertexAttribArray(1);

        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
        gl.enableVertexAttribArray(2);

        gl.bindVertexArray(null);
    }

    /**
     * Binds and uploads an authentic decoded texture
     */
    public setTexture(tex: DecodedTexture) {
        const gl = this.gl;
        this.currentTextureFormat = `${tex.formatName} (${tex.width}x${tex.height})`;

        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            tex.width,
            tex.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            tex.rgbaPixels
        );

        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        this.hasTexture = true;
    }

    private initEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            if (this.cameraMode === 'follow' && this.cameraController) {
                if (e.buttons === 1 || e.buttons === 2) {
                    this.cameraController.handleMouseMove(dx, dy);
                }
            } else if (this.cameraMode === 'orbit') {
                if (e.buttons === 1) { // Left-click: Orbit
                    this.yaw += dx * 0.008;
                    this.pitch += dy * 0.008;
                    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
                } else if (e.buttons === 2) { // Right-click: Pan
                    const panSpeed = this.distance * 0.0015;
                    const forwardX = -Math.sin(this.yaw);
                    const forwardZ = -Math.cos(this.yaw);
                    const rightX = -forwardZ;
                    const rightZ = forwardX;

                    this.target[0] -= rightX * dx * panSpeed;
                    this.target[2] -= rightZ * dx * panSpeed;
                    this.target[1] += dy * panSpeed;
                }
            } else {
                // Free-Fly Camera Look
                this.freeflyYaw += dx * 0.004;
                this.freeflyPitch -= dy * 0.004;
                this.freeflyPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.freeflyPitch));
            }
        });

        window.addEventListener('keydown', (e) => {
            this.keysDown.add(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.code);
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.cameraMode === 'follow' && this.cameraController) {
                this.cameraController.handleWheel(e.deltaY);
            } else if (this.cameraMode === 'orbit') {
                this.distance += e.deltaY * 0.005;
                this.distance = Math.max(0.5, Math.min(150.0, this.distance));
            } else {
                // Adjust freefly movement speed with wheel
                this.moveSpeed += (e.deltaY < 0 ? 1.0 : -1.0);
                this.moveSpeed = Math.max(1.0, Math.min(30.0, this.moveSpeed));
            }
        }, { passive: false });

        window.addEventListener('resize', () => this.resize());
    }

    private updateFreefly(deltaTimeSec: number) {
        if (this.cameraMode !== 'freefly') return;

        const isSprinting = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight');
        const speed = this.moveSpeed * (isSprinting ? this.sprintMultiplier : 1.0) * deltaTimeSec;

        // Forward vector in horizontal plane
        const fX = -Math.sin(this.freeflyYaw);
        const fZ = -Math.cos(this.freeflyYaw);
        const rX = -fZ;
        const rZ = fX;

        if (this.keysDown.has('KeyW')) {
            this.freeflyPos[0] += fX * speed;
            this.freeflyPos[2] += fZ * speed;
        }
        if (this.keysDown.has('KeyS')) {
            this.freeflyPos[0] -= fX * speed;
            this.freeflyPos[2] -= fZ * speed;
        }
        if (this.keysDown.has('KeyA')) {
            this.freeflyPos[0] -= rX * speed;
            this.freeflyPos[2] -= rZ * speed;
        }
        if (this.keysDown.has('KeyD')) {
            this.freeflyPos[0] += rX * speed;
            this.freeflyPos[2] += rZ * speed;
        }
        if (this.keysDown.has('KeyE') || this.keysDown.has('Space')) {
            this.freeflyPos[1] += speed; // Elevate
        }
        if (this.keysDown.has('KeyQ') || this.keysDown.has('KeyC')) {
            this.freeflyPos[1] -= speed; // Lower
        }
    }

    public resize() {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
        const displayHeight = Math.floor(this.canvas.clientHeight * dpr);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
        }
    }

    public render() {
        const gl = this.gl;
        const now = performance.now();
        this.frameTimeMs = now - this.lastTime;
        const deltaTimeSec = Math.min((now - this.lastTime) / 1000.0, 0.1);
        this.lastTime = now;

        this.frameCounter++;
        if (now - this.fpsTimer >= 1000) {
            this.fps = this.frameCounter;
            this.frameCounter = 0;
            this.fpsTimer = now;
        }

        // Process freefly movement
        this.updateFreefly(deltaTimeSec);

        this.drawCalls = 0;

        gl.clearColor(0.04, 0.05, 0.07, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Perspective Camera
        const aspect = this.canvas.width / this.canvas.height;
        const fov = (this.cameraMode === 'follow' && this.cameraController) ? this.cameraController.fov : Math.PI / 4;
        const proj = this.perspective(fov, aspect, 0.1, 500.0);

        let eyePos: [number, number, number];
        let view: Float32Array;

        if (this.cameraMode === 'follow' && this.cameraController) {
            eyePos = [...this.cameraController.eyePos];
            view = this.cameraController.getViewMatrix();
        } else if (this.cameraMode === 'orbit') {
            const eyeX = this.target[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw);
            const eyeY = this.target[1] + this.distance * Math.sin(this.pitch);
            const eyeZ = this.target[2] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw);
            eyePos = [eyeX, eyeY, eyeZ];
            view = this.lookAt(eyePos, this.target, [0, 1, 0]);
        } else {
            eyePos = [this.freeflyPos[0], this.freeflyPos[1], this.freeflyPos[2]];
            // Forward look direction
            const lookDirX = -Math.sin(this.freeflyYaw) * Math.cos(this.freeflyPitch);
            const lookDirY = Math.sin(this.freeflyPitch);
            const lookDirZ = -Math.cos(this.freeflyYaw) * Math.cos(this.freeflyPitch);
            const lookTarget: [number, number, number] = [
                eyePos[0] + lookDirX,
                eyePos[1] + lookDirY,
                eyePos[2] + lookDirZ
            ];
            view = this.lookAt(eyePos, lookTarget, [0, 1, 0]);
        }

        // Draw Ground Grid
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.gridProgram);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uProjection'), false, proj);
        gl.bindVertexArray(this.gridVao);
        gl.drawArrays(gl.LINES, 0, 61 * 4);
        this.drawCalls++;
        gl.disable(gl.BLEND);

        // Render Geometry
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, proj);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightPos'), 20.0, 45.0, 30.0);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightColor'), 1.0, 0.96, 0.92);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uViewPos'), eyePos[0], eyePos[1], eyePos[2]);

        gl.activeTexture(gl.TEXTURE0);
        if (this.hasTexture && this.texture) {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 1);
        } else {
            gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 0);
        }

        if (this.sceneGraph) {
            // Render Multi-Node Scene Graph
            let totalTris = 0;
            const nodes = this.sceneGraph.getAllNodes();
            for (const node of nodes) {
                if (!node.visible || !node.mesh) continue;

                if (!node.gpuReady) {
                    this.initNodeGpu(node);
                }

                gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModel'), false, node.transform);
                gl.uniform3f(gl.getUniformLocation(this.program, 'uObjectColor'), node.color[0], node.color[1], node.color[2]);

                gl.bindVertexArray(node.vao!);
                gl.drawElements(gl.TRIANGLES, node.mesh.triangleCount * 3, gl.UNSIGNED_SHORT, 0);
                this.drawCalls++;
                totalTris += node.mesh.triangleCount;
            }
            this.triangleCount = totalTris;
        } else if (this.triangleCount > 0) {
            // Render Single Active Mesh (with auto-spin if in orbit mode)
            const model = this.identity();
            if (this.cameraMode === 'orbit') {
                const spin = now * 0.0004;
                this.rotateY(model, spin);
            }

            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModel'), false, model);
            gl.uniform3f(gl.getUniformLocation(this.program, 'uObjectColor'), 0.88, 0.18, 0.22); // Crimson

            gl.bindVertexArray(this.singleVao);
            gl.drawElements(gl.TRIANGLES, this.triangleCount * 3, gl.UNSIGNED_SHORT, 0);
            this.drawCalls++;
        }
    }

    // Matrix helpers
    private perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
        const out = new Float32Array(16);
        const f = 1.0 / Math.tan(fov / 2);
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) / (near - far);
        out[11] = -1.0;
        out[14] = (2 * far * near) / (near - far);
        return out;
    }

    private lookAt(eye: number[], center: number[], up: number[]): Float32Array {
        const z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
        const lenZ = 1 / (Math.hypot(z0, z1, z2) || 1);
        const zx = z0 * lenZ, zy = z1 * lenZ, zz = z2 * lenZ;

        const x0 = up[1] * zz - up[2] * zy, x1 = up[2] * zx - up[0] * zz, x2 = up[0] * zy - up[1] * zx;
        const lenX = 1 / (Math.hypot(x0, x1, x2) || 1);
        const xx = x0 * lenX, xy = x1 * lenX, xz = x2 * lenX;

        const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;

        const out = new Float32Array(16);
        out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
        out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
        out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
        out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
        out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
        out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
        out[15] = 1;
        return out;
    }

    private identity(): Float32Array {
        const out = new Float32Array(16);
        out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
        return out;
    }

    private rotateY(m: Float32Array, rad: number) {
        const s = Math.sin(rad), c = Math.cos(rad);
        const a0 = m[0], a2 = m[2], a8 = m[8], a10 = m[10];
        m[0] = a0 * c - a2 * s;
        m[2] = a0 * s + a2 * c;
        m[8] = a8 * c - a10 * s;
        m[10] = a8 * s + a10 * c;
    }
}
