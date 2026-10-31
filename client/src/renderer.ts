/**
 * Sleeping Dogs Browser Reconstruction — 3D Viewport Renderer.
 * Modern WebGL2 pipeline with perspective camera, orbital navigation,
 * real-time procedural lighting, and technical metrics.
 */

export class Viewport3D {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program!: WebGLProgram;
    private gridProgram!: WebGLProgram;
    private vao!: WebGLVertexArrayObject;
    private gridVao!: WebGLVertexArrayObject;

    // Camera state
    public distance = 5.0;
    public yaw = 0.6;
    public pitch = 0.4;
    public target = [0, 0, 0];
    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;

    // Metrics
    public fps = 0;
    public frameTimeMs = 0;
    public drawCalls = 0;
    public triangleCount = 0;

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
        this.initGeometry();
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

            out vec4 fragColor;

            void main() {
                // Ambient
                float ambientStrength = 0.25;
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
                vec3 specular = 0.4 * spec * uLightColor;

                // Subtle grid accent
                vec2 grid = abs(fract(vUV * 8.0 - 0.5) - 0.5) / fwidth(vUV * 8.0);
                float line = min(grid.x, grid.y);
                float gridFactor = 1.0 - min(line, 1.0);
                vec3 baseColor = mix(uObjectColor, vec3(0.0, 0.9, 1.0), gridFactor * 0.4);

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
                float alpha = exp(-dist * 0.15);
                vec2 g = abs(fract(vWorldPos.xz) - 0.5) / fwidth(vWorldPos.xz);
                float line = min(g.x, g.y);
                float gridMask = 1.0 - min(line, 1.0);
                vec3 color = mix(vec3(0.12, 0.14, 0.18), vec3(0.15, 0.6, 0.9), gridMask);
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

    private initGeometry() {
        const gl = this.gl;

        // Create an inspectable faceted test model (a stylized container / crate asset)
        // Vertices: [posX, posY, posZ, normX, normY, normZ, u, v]
        const vertices = new Float32Array([
            // Front face
            -1, -1,  1,  0,  0,  1,  0, 0,
             1, -1,  1,  0,  0,  1,  1, 0,
             1,  1,  1,  0,  0,  1,  1, 1,
            -1,  1,  1,  0,  0,  1,  0, 1,
            // Back face
            -1, -1, -1,  0,  0, -1,  1, 0,
            -1,  1, -1,  0,  0, -1,  1, 1,
             1,  1, -1,  0,  0, -1,  0, 1,
             1, -1, -1,  0,  0, -1,  0, 0,
            // Top face
            -1,  1, -1,  0,  1,  0,  0, 1,
            -1,  1,  1,  0,  1,  0,  0, 0,
             1,  1,  1,  0,  1,  0,  1, 0,
             1,  1, -1,  0,  1,  0,  1, 1,
            // Bottom face
            -1, -1, -1,  0, -1,  0,  0, 0,
             1, -1, -1,  0, -1,  0,  1, 0,
             1, -1,  1,  0, -1,  0,  1, 1,
            -1, -1,  1,  0, -1,  0,  0, 1,
            // Right face
             1, -1, -1,  1,  0,  0,  1, 0,
             1,  1, -1,  1,  0,  0,  1, 1,
             1,  1,  1,  1,  0,  0,  0, 1,
             1, -1,  1,  1,  0,  0,  0, 0,
            // Left face
            -1, -1, -1, -1,  0,  0,  0, 0,
            -1, -1,  1, -1,  0,  0,  1, 0,
            -1,  1,  1, -1,  0,  0,  1, 1,
            -1,  1, -1, -1,  0,  0,  0, 1,
        ]);

        const indices = new Uint16Array([
            0, 1, 2,  0, 2, 3,
            4, 5, 6,  4, 6, 7,
            8, 9, 10, 8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23
        ]);

        this.triangleCount = indices.length / 3;

        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        const stride = 8 * 4;
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(0);

        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.enableVertexAttribArray(1);

        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
        gl.enableVertexAttribArray(2);

        // Ground Grid Geometry
        const gridSize = 20;
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

            if (e.buttons === 1) { // Left click: orbit
                this.yaw += dx * 0.008;
                this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.008));
            } else if (e.buttons === 2) { // Right click: pan
                this.target[0] -= (dx * Math.cos(this.yaw) - dy * Math.sin(this.yaw)) * 0.005;
                this.target[2] -= (dx * Math.sin(this.yaw) + dy * Math.cos(this.yaw)) * 0.005;
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.distance = Math.max(1.5, Math.min(30.0, this.distance + e.deltaY * 0.005));
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
        const delta = now - this.lastTime;
        this.lastTime = now;
        this.frameTimeMs = delta;

        // Calculate FPS
        this.frameCounter++;
        if (now - this.fpsTimer >= 500) {
            this.fps = Math.round((this.frameCounter * 1000) / (now - this.fpsTimer));
            this.frameCounter = 0;
            this.fpsTimer = now;
        }

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        // Dark modern background (Sleeping Dogs dark aesthetic)
        gl.clearColor(0.07, 0.08, 0.10, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Matrices
        const aspect = this.canvas.width / this.canvas.height;
        const proj = this.perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);

        const eyeX = this.target[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw);
        const eyeY = this.target[1] + this.distance * Math.sin(this.pitch);
        const eyeZ = this.target[2] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw);
        const view = this.lookAt([eyeX, eyeY, eyeZ], this.target, [0, 1, 0]);

        this.drawCalls = 0;

        // Draw Ground Grid
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.gridProgram);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uProjection'), false, proj);
        gl.bindVertexArray(this.gridVao);
        gl.drawArrays(gl.LINES, 0, 41 * 4);
        this.drawCalls++;
        gl.disable(gl.BLEND);

        // Draw Main Inspection Model
        const model = this.identity();
        // Slow gentle idle rotation
        const spin = now * 0.0005;
        this.rotateY(model, spin);

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModel'), false, model);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uView'), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, proj);

        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightPos'), 5.0, 8.0, 6.0);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightColor'), 1.0, 0.95, 0.9);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uObjectColor'), 0.85, 0.22, 0.25); // Sleeping Dogs crimson red
        gl.uniform3f(gl.getUniformLocation(this.program, 'uViewPos'), eyeX, eyeY, eyeZ);

        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        this.drawCalls++;
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
