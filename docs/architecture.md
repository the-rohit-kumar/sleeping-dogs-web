# Sleeping Dogs Browser Reconstruction — Architecture Specification

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph BrowserClient["Browser Application (WebGPU / TypeScript)"]
        UI[Inspector UI & HUD]
        Renderer[WebGPU Modern Pipeline / WebGL2 Fallback]
        Camera[Orbit & Free-fly Camera Controllers]
        Loop[Engine Frame Loop & Simulation]
    end

    subgraph Workers["Asynchronous Web Worker Pool"]
        WorkerPool[Worker Pool Manager]
        BigParser[BIG/BIX Index Parser]
        Decompressor[Compression Decoders: zlib / LZO]
        MeshDecoder[Geometry & Buffer Layout Decoders]
        TextureDecoder[Texture & BCn / DDS Decoders]
    end

    subgraph Storage["Browser Storage & Local File Access"]
        FSA[File System Access API / Drag-and-Drop Local Archives]
        Cache[IndexedDB / CacheStorage for decoded assets]
    end

    UI --> Loop
    Loop --> Renderer
    Camera --> Renderer
    Renderer --> UI

    Loop --> WorkerPool
    WorkerPool --> BigParser
    WorkerPool --> Decompressor
    WorkerPool --> MeshDecoder
    WorkerPool --> TextureDecoder

    BigParser --> FSA
    Decompressor --> Cache
```

---

## 2. Component Design Principles

### A. Immutability of Game Data
The user's original game files (`.big`, `.bix`, `.pck`) are treated strictly as **read-only source archives**. All decoding operates in-memory or persists into local browser storage caches.

### B. Decoupled Parsing and Rendering
- The archive and resource decoding layer is written as pure, headless TypeScript modules.
- The rendering layer consumes standardized browser structures (`GPUVertexBufferLayout`, `GPUTexture`, etc.) without knowing archive details.

### C. Zero Main-Thread Blocking
All archive parsing, decompilation, decompression, and geometry unpacking run in dedicated Web Workers. Only finalized typed arrays (Float32Array, Uint16Array) are transferred to the main thread via zero-copy `ArrayBuffer` transfers.

---

## 3. Technology Stack

- **Language:** TypeScript
- **Bundler / Dev Server:** Vite
- **Graphics Backend:** WebGPU (`navigator.gpu`) with clean WebGL2 fallback
- **Math & Scene Graph:** Modular lightweight linear algebra (`gl-matrix` or custom SIMD-ready primitives)
- **Archive IO:** Web Streams API / `Blob.slice()` for chunked, random-access streaming without loading multi-gigabyte `.big` files into RAM.

