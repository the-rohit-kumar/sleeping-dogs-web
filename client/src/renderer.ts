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
import { WeatherSystem } from './weather-system';
import { HONG_KONG_NEON_SIGNS } from './world-streamer';

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

    // Milestone 8: Real-Time Directional Shadow Mapping & Contact Occlusion
    private shadowProgram!: WebGLProgram;
    private shadowFbo!: WebGLFramebuffer;
    private shadowDepthTexture!: WebGLTexture;
    public shadowMapSize = 1024;
    public shadowsEnabled = true;
    public playerPos: [number, number, number] = [0, 0, 0];

    // Milestone 10: Wet Asphalt SSR & Volumetric Rain Fog
    private neonPositions = new Float32Array(18);
    private neonColors = new Float32Array(18);

    private singleVbo!: WebGLBuffer;
    private singleEbo!: WebGLBuffer;

    // Active Scene Graph (for multi-object composite scenes)
    public sceneGraph: SceneGraph | null = null;

    // Authentic Follow Camera Controller (Milestone 5)
    public cameraController: CameraController | null = null;

    // Milestone 7C: Weather & Atmospheric System
    public weatherSystem: WeatherSystem | null = null;

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

        // Milestone 10: Cache authentic neon sign positions & colors for SSR
        HONG_KONG_NEON_SIGNS.forEach((sign, idx) => {
            this.neonPositions[idx * 3 + 0] = sign.position[0];
            this.neonPositions[idx * 3 + 1] = sign.position[1];
            this.neonPositions[idx * 3 + 2] = sign.position[2];

            this.neonColors[idx * 3 + 0] = sign.color[0];
            this.neonColors[idx * 3 + 1] = sign.color[1];
            this.neonColors[idx * 3 + 2] = sign.color[2];
        });

        this.initShaders();
        this.initBuffers();
        this.initEvents();
        this.resize();
    }

    private initShaders() {
        const gl = this.gl;

        // Milestone 8: Dedicated Shadow Map Depth Shaders
        const shadowVs = `#version 300 es
            layout(location = 0) in vec3 aPosition;
            uniform mat4 uModel;
            uniform mat4 uLightSpaceMatrix;
            void main() {
                gl_Position = uLightSpaceMatrix * uModel * vec4(aPosition, 1.0);
            }
        `;

        const shadowFs = `#version 300 es
            precision highp float;
            void main() {
                // Hardware depth written automatically to gl_FragDepth
            }
        `;
        this.shadowProgram = this.createProgram(shadowVs, shadowFs);

        // Model Shaders with Real-Time Directional Shadow Receiver & Contact Grounding
        const vsSource = `#version 300 es
            layout(location = 0) in vec3 aPosition;
            layout(location = 1) in vec3 aNormal;
            layout(location = 2) in vec2 aUV;

            uniform mat4 uModel;
            uniform mat4 uView;
            uniform mat4 uProjection;
            uniform mat4 uLightSpaceMatrix;

            out vec3 vNormal;
            out vec3 vFragPos;
            out vec2 vUV;
            out vec4 vFragPosLightSpace;

            void main() {
                vFragPos = vec3(uModel * vec4(aPosition, 1.0));
                vNormal = mat3(transpose(inverse(uModel))) * aNormal;
                vUV = aUV;
                vFragPosLightSpace = uLightSpaceMatrix * vec4(vFragPos, 1.0);
                gl_Position = uProjection * uView * vec4(vFragPos, 1.0);
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;

            in vec3 vNormal;
            in vec3 vFragPos;
            in vec2 vUV;
            in vec4 vFragPosLightSpace;

            uniform vec3 uLightPos;
            uniform vec3 uLightColor;
            uniform vec3 uObjectColor;
            uniform vec3 uViewPos;
            uniform sampler2D uTexture;
            uniform bool uHasTexture;

            // Milestone 11: Authentic BC5 Tangent-Space Normal Mapping
            uniform sampler2D uNormalMap;
            uniform bool uHasNormalMap;

            // Milestone 8: Shadow Depth Map & Contact Occlusion
            uniform sampler2D uShadowMap;
            uniform bool uShadowsEnabled;
            uniform vec3 uPlayerPos;

            // Milestone 7C: Neon Nights & Wet Road Shading
            uniform float uWetness;
            uniform float uPuddleReflectivity;
            uniform float uNeonFactor;
            uniform bool uIsEmissive;
            uniform vec3 uSkyAmbient;
            uniform float uFogDensity;
            uniform float uTime;
            uniform float uLightningFlash;

            // Milestone 10: Wet Asphalt SSR, Neon Reflections & Headlight Cones
            uniform vec3 uNeonPositions[6];
            uniform vec3 uNeonColors[6];
            uniform float uRainIntensity;
            uniform vec3 uCarHeadlightPos;
            uniform vec3 uCarHeadlightDir;
            uniform bool uCarHeadlightActive;

            out vec4 fragColor;

            // ACES Filmic Tone Mapping Curve (Authentic Sleeping Dogs High-Contrast Cinema)
            vec3 acesTonemap(vec3 x) {
                const float a = 2.51;
                const float b = 0.03;
                const float c = 2.43;
                const float d = 0.59;
                const float e = 0.14;
                return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
            }

            // 4-tap Poisson disk kernel (smooth penumbra & ultra-fast for WebGL2)
            const vec2 POISSON[4] = vec2[4](
                vec2(-0.326, -0.406),
                vec2(-0.840, -0.074),
                vec2( 0.696,  0.457),
                vec2( 0.202, -0.628)
            );

            float calculateShadow(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir) {
                if (!uShadowsEnabled) return 0.0;

                // Perspective divide to NDC
                vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
                projCoords = projCoords * 0.5 + 0.5;

                // Keep outside shadow map bounds unshadowed
                if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) {
                    return 0.0;
                }

                // Adaptive slope-scaled bias to eliminate shadow acne
                float bias = max(0.0035 * (1.0 - dot(normal, lightDir)), 0.0010);
                float currentDepth = projCoords.z;

                vec2 texelSize = 1.0 / vec2(1024.0, 1024.0);
                float shadow = 0.0;
                for (int i = 0; i < 4; ++i) {
                    float pcfDepth = texture(uShadowMap, projCoords.xy + POISSON[i] * texelSize * 1.5).r;
                    shadow += (currentDepth - bias > pcfDepth) ? 1.0 : 0.0;
                }
                return shadow * 0.25;
            }

            // Cotangent Frame Per-Pixel TBN Generator (Mikkelsen / Schueler WebGL2 Standard)
            mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
                vec3 dp1 = dFdx(p);
                vec3 dp2 = dFdy(p);
                vec2 duv1 = dFdx(uv);
                vec2 duv2 = dFdy(uv);
                vec3 dp2perp = cross(dp2, N);
                vec3 dp1perp = cross(N, dp1);
                vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
                vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
                float invmax = inversesqrt(max(dot(T,T), dot(B,B)));
                return mat3(T * invmax, B * invmax, N);
            }

            void main() {
                // Emissive neon signage & lanterns
                if (uIsEmissive) {
                    float flicker = 0.95 + 0.05 * sin(uTime * 14.0) * cos(uTime * 5.5);
                    vec3 neonColor = uObjectColor * uNeonFactor * flicker;
                    if (uHasTexture) {
                        vec4 tex = texture(uTexture, vUV);
                        neonColor = mix(neonColor, tex.rgb * uNeonFactor * 1.5, 0.45);
                    }
                    fragColor = vec4(acesTonemap(neonColor * 1.6), 1.0);
                    return;
                }

                // Hong Kong night ambient lighting: rich city sky glow + lightning flash
                vec3 sky = uSkyAmbient + vec3(uLightningFlash * 0.55, uLightningFlash * 0.58, uLightningFlash * 0.65);
                vec3 ambientColor = sky * 1.6 + vec3(0.18, 0.20, 0.24); // Ambient bounce from surrounding city
                float ambientStrength = 0.55;
                vec3 ambient = ambientStrength * ambientColor;

                // Directional Sunlight / Streetlamp Light
                vec3 norm = normalize(vNormal);

                // Milestone 11: Authentic BC5 Tangent-Space Normal Mapping
                if (uHasNormalMap) {
                    vec3 mapN = texture(uNormalMap, vUV).xyz * 2.0 - 1.0;
                    mapN.xy *= 1.35; // Enhance authentic Hong Kong asphalt roughness & vehicle panel seams
                    mapN = normalize(mapN);
                    mat3 tbn = cotangentFrame(norm, vFragPos, vUV);
                    norm = normalize(tbn * mapN);
                }

                vec3 lightDir = normalize(uLightPos - vFragPos);
                float diff = max(dot(norm, lightDir), 0.0);
                vec3 diffuse = diff * uLightColor * 1.35;

                // View & Specular
                vec3 viewDir = normalize(uViewPos - vFragPos);
                vec3 halfwayDir = normalize(lightDir + viewDir);

                // Wet asphalt specular calculation (Sleeping Dogs signature)
                float isGround = clamp(norm.y, 0.0, 1.0);
                float specPower = mix(24.0, 72.0, uWetness);
                float spec = pow(max(dot(norm, halfwayDir), 0.0), specPower);

                // Fresnel reflectance (grazing angles reflect streetlamps and neon signs)
                float nDotV = max(dot(norm, viewDir), 0.0);
                float fresnel = 0.04 + (1.0 - 0.04) * pow(1.0 - nDotV, 5.0);
                float wetSpecularStrength = mix(0.40, 2.0 * uPuddleReflectivity, uWetness * isGround);
                vec3 specular = wetSpecularStrength * (spec + fresnel * 0.35) * uLightColor;

                vec3 baseColor = uObjectColor;
                if (uHasTexture) {
                    vec4 texColor = texture(uTexture, vUV);
                    // Milestone 9: Authentic multi-texture diffuse modulation
                    float saturation = max(uObjectColor.r, max(uObjectColor.g, uObjectColor.b)) - min(uObjectColor.r, min(uObjectColor.g, uObjectColor.b));
                    if (saturation > 0.15) {
                        // Colored objects (e.g. Red Taxi, Denim Pedestrian, Triad jackets): modulate texture with body tint
                        baseColor = texColor.rgb * (uObjectColor * 2.2);
                    } else {
                        // Neutral surfaces (e.g. Asphalt roads, building facades, curbs): preserve rich raw texture details
                        baseColor = texColor.rgb * (uObjectColor * 1.25);
                    }
                }

                // Wet asphalt darkens albedo when saturated with water
                if (isGround > 0.5) {
                    baseColor *= mix(1.0, 0.78, uWetness);
                }

                // Milestone 8: Real-Time Directional Shadow Mapping (attenuates direct lighting, preserves ambient bounce)
                float shadow = (diff > 0.001) ? calculateShadow(vFragPosLightSpace, norm, lightDir) : 1.0;
                vec3 directLighting = (1.0 - shadow * 0.68) * diffuse + (1.0 - shadow * 0.82) * specular;

                // Milestone 8: Contact Ambient Occlusion directly underneath character feet & wheels
                float contactAO = 1.0;
                if (isGround > 0.5) {
                    float distToPlayer = length(vFragPos.xz - uPlayerPos.xz);
                    if (distToPlayer < 0.95 && abs(vFragPos.y - uPlayerPos.y) < 0.35) {
                        float footOcclusion = smoothstep(0.90, 0.15, distToPlayer);
                        contactAO *= (1.0 - footOcclusion * 0.52);
                    }
                }

                // -------------------------------------------------------------
                // Milestone 10: Wet Asphalt Puddle Mask & Rain Ripple Perturbation
                // -------------------------------------------------------------
                vec3 wetNormal = norm;
                float puddleMask = 0.0;
                vec3 ssrReflection = vec3(0.0);

                if (isGround > 0.45 && uWetness > 0.05) {
                    // Procedural puddle accumulation in road depressions
                    float puddleNoise = sin(vFragPos.x * 0.42 + sin(vFragPos.z * 0.32) * 1.8) * cos(vFragPos.z * 0.36);
                    puddleNoise += 0.45 * sin(vFragPos.x * 1.15 - vFragPos.z * 0.85);
                    puddleMask = smoothstep(0.18 - uWetness * 0.55, 0.62, puddleNoise) * uWetness;

                    // Animated multi-frequency rain ripples oscillating on wet puddle pools
                    vec2 rippleUV = vFragPos.xz * 2.8;
                    float t = uTime * 4.2;
                    vec2 waveVec = vec2(
                        sin(length(fract(rippleUV) - 0.5) * 22.0 - t * 5.5) + sin(length(fract(rippleUV * 1.6 + 0.3) - 0.5) * 18.0 - t * 7.0),
                        cos(length(fract(rippleUV) - 0.5) * 22.0 - t * 5.5) + cos(length(fract(rippleUV * 1.6 + 0.3) - 0.5) * 18.0 - t * 7.0)
                    );
                    vec2 ripplePerturb = waveVec * (0.038 * uRainIntensity + 0.012 * uWetness) * puddleMask;
                    wetNormal = normalize(norm + vec3(ripplePerturb.x, 0.0, ripplePerturb.y));

                    // Calculate ground reflection ray
                    vec3 reflRay = reflect(-viewDir, wetNormal);

                    // Screen-Space Neon Sign Reflections (Signature Hong Kong Rain Mirrors)
                    for (int i = 0; i < 6; ++i) {
                        vec3 toSign = uNeonPositions[i] - vFragPos;
                        float distToSign = length(toSign);
                        vec3 dirToSign = toSign / max(distToSign, 0.001);

                        // Anisotropic ground reflection streak along view reflection direction
                        float reflDot = clamp(dot(reflRay, dirToSign), 0.0, 1.0);
                        float streakPower = mix(36.0, 10.0, 1.0 - puddleMask);
                        float streak = pow(reflDot, streakPower);

                        // Distance attenuation
                        float atten = 1.0 / (1.0 + distToSign * 0.042 + distToSign * distToSign * 0.0015);

                        // Subtle sign flicker
                        float signFlicker = 0.96 + 0.04 * sin(uTime * 12.0 + float(i) * 1.6);

                        ssrReflection += uNeonColors[i] * streak * atten * uNeonFactor * signFlicker * 3.4;
                    }

                    // Wet Fresnel enhancement at grazing angles
                    ssrReflection *= mix(0.40, 1.0, fresnel) * puddleMask * uPuddleReflectivity;
                }

                // -------------------------------------------------------------
                // Milestone 10: Vehicle Headlight Projections & Wet Ground Cones
                // -------------------------------------------------------------
                vec3 headlightColor = vec3(0.0);
                if (uCarHeadlightActive && isGround > 0.45) {
                    vec3 toFrag = vFragPos - uCarHeadlightPos;
                    float distHead = length(toFrag);
                    vec3 dirHead = toFrag / max(distHead, 0.001);

                    float spotDot = dot(dirHead, uCarHeadlightDir);
                    float spotCone = smoothstep(0.72, 0.95, spotDot);
                    float distAtten = clamp(1.0 - distHead / 26.0, 0.0, 1.0);

                    float beam = spotCone * distAtten * distAtten;
                    vec3 headHalfway = normalize(-uCarHeadlightDir + viewDir);
                    float headSpec = pow(max(dot(wetNormal, headHalfway), 0.0), 32.0) * puddleMask;

                    headlightColor = vec3(1.0, 0.96, 0.88) * (beam * 1.6 + headSpec * 2.4 * uPuddleReflectivity);
                }

                vec3 result = (ambient * contactAO + directLighting) * baseColor + ssrReflection + headlightColor;

                // -------------------------------------------------------------
                // Milestone 10: Volumetric Rain Fog & Mie Light In-Scattering
                // -------------------------------------------------------------
                float dist = length(vFragPos - uViewPos);
                float dynamicFogDensity = uFogDensity * mix(1.0, 1.9, uWetness);
                float fogFactor = clamp(exp(-pow(dist * dynamicFogDensity, 1.25)), 0.0, 1.0);

                // Mie forward scattering phase from neon signs & streetlights through rain mist
                float cosTheta = dot(viewDir, lightDir);
                float g = 0.55;
                float miePhase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5) * 0.159;

                vec3 neonAmbientGlow = vec3(0.08, 0.12, 0.18) * uNeonFactor;
                vec3 scatteredFog = mix(ambientColor, ambientColor + neonAmbientGlow * 1.5, 0.55) + miePhase * uLightColor * 0.35;

                result = mix(scatteredFog, result, fogFactor);

                // Exposure scaled ACES Filmic Tone Mapping for authentic cinema contrast
                fragColor = vec4(acesTonemap(result * 1.55), 1.0);
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
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compile log:', gl.getShaderInfoLog(fs));
        }

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const fsLog = gl.getShaderInfoLog(fs);
            const vsLog = gl.getShaderInfoLog(vs);
            throw new Error(`Shader compilation failure: prog=[${gl.getProgramInfoLog(prog)}] fs=[${fsLog}] vs=[${vsLog}]`);
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

        // Milestone 8: Initialize Shadow Framebuffer & 2048x2048 Depth Map
        this.initShadowMap();
    }

    private initShadowMap() {
        const gl = this.gl;
        this.shadowDepthTexture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
            this.shadowMapSize, this.shadowMapSize, 0,
            gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.shadowFbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowDepthTexture, 0);
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Shadow FBO initialization error:', status);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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

        // Milestone 9: Upload authentic node diffuse texture to GPU (cached across shared materials)
        if (node.texture) {
            if (!node.texture.gpuTexture) {
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(
                    gl.TEXTURE_2D, 0, gl.RGBA,
                    node.texture.width, node.texture.height, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE,
                    node.texture.rgbaPixels
                );
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                node.texture.gpuTexture = tex;
            }
            node.gpuTexture = node.texture.gpuTexture;
        }

        // Milestone 11: Upload authentic BC5 tangent-space normal map to GPU
        if (node.normalMap) {
            if (!node.normalMap.gpuTexture) {
                const nTex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, nTex);
                gl.texImage2D(
                    gl.TEXTURE_2D, 0, gl.RGBA,
                    node.normalMap.width, node.normalMap.height, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE,
                    node.normalMap.rgbaPixels
                );
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                node.normalMap.gpuTexture = nTex;
            }
            node.gpuNormalMap = node.normalMap.gpuTexture;
        }

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

        // Active Player / Target Center for Shadow Projection Focus
        const targetCenter: [number, number, number] = (this.cameraMode === 'follow' && this.cameraController)
            ? [this.cameraController.targetPos[0], this.cameraController.targetPos[1], this.cameraController.targetPos[2]]
            : (this.cameraMode === 'freefly'
                ? [this.freeflyPos[0], 0.0, this.freeflyPos[2] - 4.0]
                : [this.target[0], this.target[1], this.target[2]]);

        // Directional Key Light (Key moonlight / high street fixture from Hong Kong sky)
        const lightDir: [number, number, number] = [0.35, 0.85, 0.4];
        const lightDist = 28.0;
        const lightEye: [number, number, number] = [
            targetCenter[0] + lightDir[0] * lightDist,
            targetCenter[1] + lightDir[1] * lightDist,
            targetCenter[2] + lightDir[2] * lightDist
        ];
        const lightView = this.lookAt(lightEye, targetCenter, [0, 1, 0]);
        const shadowFrustumSize = 25.0;
        const lightProj = this.ortho(
            -shadowFrustumSize, shadowFrustumSize,
            -shadowFrustumSize, shadowFrustumSize,
            1.0, 65.0
        );
        const lightSpaceMatrix = this.multiplyMat4(lightProj, lightView);

        // -----------------------------------------------------------------
        // PASS 1: Dedicated Shadow Map Depth Pass (2048x2048 FBO)
        // -----------------------------------------------------------------
        if (this.shadowsEnabled && this.sceneGraph) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
            gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LESS);
            gl.disable(gl.CULL_FACE); // Both sides cast shadows for authentic street geometry

            gl.useProgram(this.shadowProgram);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProgram, 'uLightSpaceMatrix'), false, lightSpaceMatrix);

            const nodes = this.sceneGraph.getAllNodes();
            for (const node of nodes) {
                if (!node.visible || !node.mesh) continue;
                // Exclude distant Hong Kong skyline towers from casting shadows across local alley
                if (node.id.includes('distant-tower')) continue;
                if (!node.gpuReady) this.initNodeGpu(node);

                gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProgram, 'uModel'), false, node.transform);
                gl.bindVertexArray(node.vao!);
                gl.drawElements(gl.TRIANGLES, node.mesh.triangleCount * 3, gl.UNSIGNED_SHORT, 0);
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        // -----------------------------------------------------------------
        // PASS 2: Main Camera Viewport Render Pass (with PCF Shadows & ACES)
        // -----------------------------------------------------------------
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        const ambient = this.weatherSystem ? this.weatherSystem.settings.skyAmbient : [0.04, 0.05, 0.07];
        const flash = this.weatherSystem ? this.weatherSystem.lightningFlash : 0.0;
        gl.clearColor(
            ambient[0] + flash * 0.45,
            ambient[1] + flash * 0.48,
            ambient[2] + flash * 0.55,
            1.0
        );
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
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uLightSpaceMatrix'), false, lightSpaceMatrix);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uShadowsEnabled'), this.shadowsEnabled ? 1 : 0);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uPlayerPos'), targetCenter[0], targetCenter[1], targetCenter[2]);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightPos'), lightEye[0], lightEye[1], lightEye[2]);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uLightColor'), 1.0, 0.96, 0.92);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uViewPos'), eyePos[0], eyePos[1], eyePos[2]);

        // Weather & Atmospheric parameters
        const wetness = this.weatherSystem ? this.weatherSystem.settings.wetness : 0.0;
        const puddleRefl = this.weatherSystem ? this.weatherSystem.settings.puddleReflectivity : 0.0;
        const neonFactor = this.weatherSystem ? this.weatherSystem.settings.neonBloomFactor : 1.0;
        const fogDensity = this.weatherSystem ? this.weatherSystem.settings.fogDensity : 0.005;

        gl.uniform1f(gl.getUniformLocation(this.program, 'uWetness'), wetness);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uPuddleReflectivity'), puddleRefl);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uNeonFactor'), neonFactor);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uFogDensity'), fogDensity);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uSkyAmbient'), ambient[0], ambient[1], ambient[2]);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uTime'), now * 0.001);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uLightningFlash'), flash);

        // Milestone 10: Neon sign positions, colors and weather rain intensity
        gl.uniform3fv(gl.getUniformLocation(this.program, 'uNeonPositions'), this.neonPositions);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'uNeonColors'), this.neonColors);
        gl.uniform1f(gl.getUniformLocation(this.program, 'uRainIntensity'), this.weatherSystem ? this.weatherSystem.settings.rainIntensity : 0.0);

        // Milestone 10: Vehicle dual headlight projection
        let carHeadlightPos = [1.8, 0.45, 1.2];
        let carHeadlightDir = [0.0, -0.15, 1.0];
        let carHeadlightActive = false;
        if (this.sceneGraph) {
            const vehicleNode = this.sceneGraph.getNode('node-vehicle');
            if (vehicleNode) {
                carHeadlightActive = true;
                const yaw = vehicleNode.rotation[1];
                const forwardX = Math.sin(yaw);
                const forwardZ = Math.cos(yaw);
                carHeadlightPos = [
                    vehicleNode.position[0] + forwardX * 1.8,
                    vehicleNode.position[1] + 0.35,
                    vehicleNode.position[2] + forwardZ * 1.8
                ];
                carHeadlightDir = [forwardX, -0.12, forwardZ];
            }
        }
        gl.uniform3f(gl.getUniformLocation(this.program, 'uCarHeadlightPos'), carHeadlightPos[0], carHeadlightPos[1], carHeadlightPos[2]);
        gl.uniform3f(gl.getUniformLocation(this.program, 'uCarHeadlightDir'), carHeadlightDir[0], carHeadlightDir[1], carHeadlightDir[2]);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uCarHeadlightActive'), carHeadlightActive ? 1 : 0);

        // Unit 0: Diffuse Texture
        gl.activeTexture(gl.TEXTURE0);
        if (this.hasTexture && this.texture) {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 1);
        } else {
            gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 0);
        }

        // Unit 1: Shadow Depth Texture
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uShadowMap'), 1);

        if (this.sceneGraph) {
            // Render Multi-Node Scene Graph
            let totalTris = 0;
            const nodes = this.sceneGraph.getAllNodes();
            for (const node of nodes) {
                if (!node.visible || !node.mesh) continue;

                if (!node.gpuReady) {
                    this.initNodeGpu(node);
                }

                // Milestone 9: Bind node-specific authentic base-game texture
                gl.activeTexture(gl.TEXTURE0);
                if (node.gpuTexture) {
                    gl.bindTexture(gl.TEXTURE_2D, node.gpuTexture);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 1);
                } else if (this.hasTexture && this.texture) {
                    gl.bindTexture(gl.TEXTURE_2D, this.texture);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 1);
                } else {
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasTexture'), 0);
                }

                // Milestone 11: Bind node-specific authentic BC5 tangent-space normal map
                gl.activeTexture(gl.TEXTURE2);
                if (node.gpuNormalMap) {
                    gl.bindTexture(gl.TEXTURE_2D, node.gpuNormalMap);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uNormalMap'), 2);
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasNormalMap'), 1);
                } else {
                    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasNormalMap'), 0);
                }

                const isEmissive = node.id.includes('neon-sign') ||
                                   node.name.toLowerCase().includes('neon') ||
                                   node.name.toLowerCase().includes('lantern');
                gl.uniform1i(gl.getUniformLocation(this.program, 'uIsEmissive'), isEmissive ? 1 : 0);

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

            gl.uniform1i(gl.getUniformLocation(this.program, 'uIsEmissive'), 0);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModel'), false, model);
            gl.uniform3f(gl.getUniformLocation(this.program, 'uObjectColor'), 0.88, 0.18, 0.22); // Crimson

            gl.bindVertexArray(this.singleVao);
            gl.drawElements(gl.TRIANGLES, this.triangleCount * 3, gl.UNSIGNED_SHORT, 0);
            this.drawCalls++;
        }

        // Render Dynamic 3D Falling Rain Particles
        if (this.weatherSystem) {
            if (!this.weatherSystem.rainProgram) {
                this.weatherSystem.initGpu(this.gl);
            }
            this.weatherSystem.renderRain(this.gl, view, proj);
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

    private ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
        const out = new Float32Array(16);
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        out[0] = -2 * lr;
        out[5] = -2 * bt;
        out[10] = 2 * nf;
        out[12] = (left + right) * lr;
        out[13] = (top + bottom) * bt;
        out[14] = (far + near) * nf;
        out[15] = 1;
        return out;
    }

    private multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
        const out = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                out[j * 4 + i] =
                    a[i] * b[j * 4] +
                    a[4 + i] * b[j * 4 + 1] +
                    a[8 + i] * b[j * 4 + 2] +
                    a[12 + i] * b[j * 4 + 3];
            }
        }
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
