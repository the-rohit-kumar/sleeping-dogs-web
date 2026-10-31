/**
 * Sleeping Dogs Browser Reconstruction — 3D Viewport Renderer.
 * Modern WebGL2 pipeline with perspective camera, orbital navigation,
 * real-time procedural lighting, dynamic texture mapping, and technical metrics.
 * ZERO synthetic assets: Renders only authentic base-game geometry and textures.
 */

import { DecodedTexture } from './texture-decoder';
import { DecodedMesh } from './mesh-decoder';

export class Viewport3D {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program!: WebGLProgram;
    private gridProgram!: WebGLProgram;
    private vao!: WebGLVertexArrayObject;
    private gridVao!: WebGLVertexArrayObject;
    private texture: WebGLTexture | null = null;
    private hasTexture = false;

    private vbo!: WebGLBuffer;
    private ebo!: WebGLBuffer;

    // Camera state
    public distance = 5.5;
    public yaw = 0.75;
    public pitch = 0.35;
    public target = [0, 0.4, 0];
    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;

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
                float ambientStrength = 0.4;
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
                float alpha = exp(-dist * 0.12);
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
        this.vao = gl.createVertexArray()!;
        this.vbo = gl.createBuffer()!;
        this.ebo = gl.createBuffer()!;

        // Ground Grid Geometry
        const gridSize = 25;
        const gridVerts: number[] = [];
        for (let i = -gridSize; i <= gridSize; i++) {
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

    /**
     * Binds and displays an authentic decoded 3D mesh
     */
    public setMesh(mesh: DecodedMesh) {
        const gl = this.gl;
        this.currentMeshName = mesh.name;
        this.triangleCount = mesh.triangleCount;

        // Auto-frame camera to model bounding box
        if (mesh.bounds) {
            this.target = [mesh.bounds.center[0], mesh.bounds.center[1], mesh.bounds.center[2]];
            const maxDim = Math.max(mesh.bounds.size[0], mesh.bounds.size[1], mesh.bounds.size[2]);
            this.distance = Math.max(2.5, maxDim * 1.6);
        }

        // Pack interleaved attributes [Px, Py, Pz, Nx, Ny, Nz, U, V]
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

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
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
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.distance += e.deltaY * 0.005;
            this.distance = Math.max(0.5, Math.min(50.0, this.distance));
        }, { passive: false });

        window.addEventListener('resize', () => this.resize());
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
        this.lastTime = now;

        this.frameCounter++;
        if (now - this.fpsTimer >= 1000) {
            this.fps = this.frameCounter;
            this.frameCounter = 0;
            this.fpsTimer = now;
        }

        this.drawCalls = 0;

        gl.clearColor(0.04, 0.05, 0.07, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Perspective camera
        const aspect = this.canvas.width / this.canvas.height;
        const proj = this.perspective(Math.PI / 4, aspect, 0.1, 100.0);

        // Orbit Eye Position
        const eyeX = this.target[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw);
        const eyeY = this.target[1] + this.distance * Math.sin(this.pitch);
        const eyeZ = this.target[2] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw);

        const view = this.lookAt([eyeX, eyeY, eyeZ], this.target, [0, 1, 0]);

        // Draw Ground Grid
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.gridProgram);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uProjection'), false, proj);
        gl.bindVertexArray(this.gridVao);
        gl.drawArrays(gl.LINES, 0, 51 * 4);
        this.drawCalls++;
        gl.disable(gl.BLEND);

        // Draw Main Model
        if (this.triangleCount > 0) {
            const model = this.identity();
            const spin = now * 0.0004;
            this.rotateY(model, spin);

            gl.useProgram(this.program);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModel'), false, model);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uView'), false, view);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, proj);

            gl.uniform3f(gl.getUniformLocation(this.program, 'uLightPos'), 6.0, 10.0, 7.0);
            gl.uniform3f(gl.getUniformLocation(this.program, 'uLightColor'), 1.0, 0.96, 0.92);
            gl.uniform3f(gl.getUniformLocation(this.program, 'uObjectColor'), 0.88, 0.18, 0.22); // Crimson red
            gl.uniform3f(gl.getUniformLocation(this.program, 'uViewPos'), eyeX, eyeY, eyeZ);

            gl.activeTexture(gl.TEXTURE0);
            if (this.hasTexture && this.texture) {
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
                gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 1);
            } else {
                gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 0);
            }

            gl.bindVertexArray(this.vao);
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
        const lenZ = 1 / Math.hypot(z0, z1, z2);
        const zx = z0 * lenZ, zy = z1 * lenZ, zz = z2 * lenZ;

        const x0 = up[1] * zz - up[2] * zy, x1 = up[2] * zx - up[0] * zz, x2 = up[0] * zy - up[1] * zx;
        const lenX = 1 / Math.hypot(x0, x1, x2);
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
