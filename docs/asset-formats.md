# Sleeping Dogs: Definitive Edition — Asset & Archive Formats

**Document Version:** 1.0  
**Status:** `CONFIRMED` via mathematical validation across 26,894 archive entries.

---

## 1. BIG / BIX Archive Architecture

Sleeping Dogs packages all runtime assets into paired archive files:
- **`.big`**: Data container storing aligned resource payloads.
- **`.bix`**: Index file defining catalog entries, resource UIDs, payload offsets, and section sizes.

All 11 archives in the game installation have been verified:

| Archive Name | BIX File | Total Resources | Multi-Part Resources | Single-Part Resources | Total Payload Size |
|---|---|---:|---:|---:|---:|
| `PrefabData` | `PrefabData.bix` | 1 | 0 | 1 | 4.0 KB |
| `GameHD2` | `GameHD2.bix` | 44 | 40 | 4 | 458.5 MB |
| `CharactersHD` | `CharactersHD.bix` | 394 | 236 | 158 | 413.0 MB |
| `AnimationNIS` | `AnimationNIS.bix` | 471 | 316 | 155 | 482.9 MB |
| `Global` | `Global.bix` | 913 | 159 | 754 | 60.6 MB |
| `Animation` | `Animation.bix` | 1,071 | 922 | 149 | 110.9 MB |
| `Vehicles` | `Vehicles.bix` | 1,192 | 555 | 637 | 141.2 MB |
| `GameHD` | `GameHD.bix` | 4,260 | 2,917 | 1,343 | 6.07 GB |
| `Characters` | `Characters.bix` | 4,487 | 1,985 | 2,502 | 1.50 GB |
| `UI` | `UI.bix` | 6,913 | 810 | 6,103 | 212.9 MB |
| `Game` | `Game.bix` | 7,148 | 4,674 | 2,474 | 4.31 GB |
| **TOTALS** | | **26,894** | **12,614** | **14,280** | **~13.46 GB** |

---

## 2. BIX Header Specification (192 bytes / 0xC0)

| Offset (Hex) | Type | Field Name | Description |
|---|---|---|---|
| `0x0000` | `uint32_t` | `mChunkUID` | Chunk Magic: `0x2C5C40A8` (Little-Endian: `A8 40 5C 2C`) |
| `0x0004` | `uint32_t` | `mPayloadSize` | Index payload byte count (`file_size - 16`) |
| `0x0008` | `uint32_t` | `mTotalSize` | Total chunk byte count (`file_size - 16`) |
| `0x000C` | `uint32_t` | `mReserved` | Header flags (consistently `0x00000000`) |
| `0x0044` | `char[44]` | `mArchiveName` | Null-terminated ASCII archive identifier (e.g., `"Global"`, `"UI"`, `"GameHD"`) |
| `0x0070` | `uint32_t` | `mEntryCount` | Total number of index records ($N$) |
| `0x0078` | `uint32_t` | `mHeaderSize` | Inner header size (`0x48` = 72 bytes) |
| `0x00C0` | `Record[N]`| `mEntries` | Array of 24-byte resource records |

---

## 3. BIX Entry Record Specification (24 bytes)

```text
+-------------------+-------------------+-------------------+
|  mUID (uint32)    |  mOffset (uint32) | mPart1Size(uint32)|
+-------------------+-------------------+-------------------+
| mPart2Size(uint32)| mPadding (uint32) | mTotalSpan(uint32)|
+-------------------+-------------------+-------------------+
```

| Offset | Type | Field | Description |
|---|---|---|---|
| `+0x00` | `uint32_t` | `mUID` | Unique 32-bit resource hash / UID |
| `+0x04` | `uint32_t` | `mOffset` | Absolute byte offset in `.big` container |
| `+0x08` | `uint32_t` | `mPart1Size` | Segment 1 byte length (metadata / chunk header) |
| `+0x0C` | `uint32_t` | `mPart2Size` | Segment 2 byte length (payload / stream data) |
| `+0x10` | `uint32_t` | `mPadding` | Alignment padding bytes |
| `+0x14` | `uint32_t` | `mTotalSpan` | Total span in archive bytes |

### Mathematical Invariants (Verified 100% across all 12,614 multi-part entries):
$$\text{mPart1Size} + \text{mPart2Size} = \text{mTotalSpan} + \text{mPadding}$$

For single-part entries ($\text{mPart1Size} = 0, \text{mPart2Size} = 0, \text{mPadding} = 0$):
$$\text{Payload Size} = \text{mTotalSpan}$$


---

## 4. Illusion Engine Texture Specification (`Illusion::rTexture`)

**Status:** `CONFIRMED` via Ghidra decompiler analysis of `FUN_140a18e90` and `FUN_140a16ed0`.

### 4.1 Chunk Header Layout

| Relative Offset | Type | Field | Description |
|---|---|---|---|
| `+0x24` | `uint32_t` | `mFlags` | Texture flags (cube map, volume, deferred streaming) |
| `+0x28` | `uint8_t` | `mFormat` | Texture compression format code (see below) |
| `+0x29` | `uint8_t` | `mDimension` | Dimension type: `0` = 2D Texture, `2` = Cube Map, `3` = Volume |
| `+0x30` | `uint16_t` | `mWidth` | Width in pixels |
| `+0x32` | `uint16_t` | `mHeight` | Height in pixels |
| `+0x34` | `uint8_t` | `mMipLevels` | Number of mipmap levels |
| `+0x36` | `uint16_t` | `mDepthOrArraySize` | Array slices or 3D depth |
| `+0xB4` | `uint8_t[]` | `mPixels` | Raw block-compressed or uncompressed pixel payload |

### 4.2 Format Code Table & Direct3D 11 / WebGL2 / WebGPU Mapping

| Code | Format Name | Block Size | WebGL2 / WebGPU Equivalent | Usage in Sleeping Dogs |
|---|---|---|---|---|
| `0` | `RGBA8_UNORM` | 4 bytes / pixel | `gl.RGBA8` / `'rgba8unorm'` | UI icons, fonts, uncompressed textures |
| `1` | `BC1_UNORM` (DXT1) | 8 bytes / 4x4 block | `COMPRESSED_RGBA_S3TC_DXT1_EXT` / `'bc1-rgba-unorm'` | Diffuse textures, vehicle liveries, environment |
| `2` | `BC2_UNORM` (DXT3) | 16 bytes / 4x4 block | `COMPRESSED_RGBA_S3TC_DXT3_EXT` / `'bc2-rgba-unorm'` | Decals with sharp alpha |
| `3` | `BC3_UNORM` (DXT5) | 16 bytes / 4x4 block | `COMPRESSED_RGBA_S3TC_DXT5_EXT` / `'bc3-rgba-unorm'` | Diffuse with smooth alpha, specular maps |
| `4` | `BC4_UNORM` (ATI1) | 8 bytes / 4x4 block | `COMPRESSED_RED_RGTC1_EXT` / `'bc4-r-unorm'` | Height maps, ambient occlusion |
| `5` | `BC5_UNORM` (ATI2/3Dc)| 16 bytes / 4x4 block| `COMPRESSED_SIGNED_RG_RGTC2_EXT` / `'bc5-rg-unorm'` | Tangent-space normal maps |

### 4.3 Block Compression Math
For a mip level with dimensions $(W, H)$:
$$\text{RowPitch} = \left\lfloor\frac{W + 3}{4}\right\rfloor \times \text{BlockSize}$$
$$\text{SlicePitch} = \left\lfloor\frac{H + 3}{4}\right\rfloor \times \text{RowPitch}$$

---

## 5. Illusion Engine Buffer Specification (`Illusion::BufferLoader`)

**Status:** `WORKING HYPOTHESIS / REVERSE-ENGINEERING IN PROGRESS` (Heuristic and decompilation analysis under investigation).

### 5.1 Buffer Descriptor Layout (Hypothesis)

The following layout is derived from preliminary static analysis of buffer setup routines (`FUN_140a18c70` and `FUN_140a16e20` in the local Ghidra project). It represents a working hypothesis for resource chunk headers preceding buffer data:

| Relative Offset | Type | Field | Description |
|---|---|---|---|
| `-0x38` | `uint8_t` | `mBufferType` | `0` = Vertex Buffer (`D3D11_BIND_VERTEX_BUFFER`), `1` = Index Buffer (`D3D11_BIND_INDEX_BUFFER`) |
| `-0x36` | `uint16_t` | `mFlags` | Stride and access flags |
| `-0x34` | `uint32_t` | `mByteWidth` | Total buffer payload size in bytes (`D3D11_BUFFER_DESC::ByteWidth`) |
| `-0x30` | `int64_t` | `mDataOffset` | Relative offset from this field to raw buffer memory |

### 5.2 Vertex Buffer Layouts & Stride Accounting

Sleeping Dogs uses interleaved vertex streams. The exact strides observed in vertex buffers include 8-byte half-float streams, 16-byte streams, and potential 32/40/48-byte full attribute streams. Note on stride arithmetic:

- **Compact Half-Float Stride (8 bytes) [VERIFIED IN ENTRY 6]:**
  - Position: 4x float16 (8 bytes: X, Y, Z, W)
- **Standard Stride (32 bytes) [Hypothesis]:**
  - Position: 3x float32 (12 bytes)
  - Normal: 3x float32 (12 bytes)
  - UV0: 2x float32 (8 bytes)
  - Total: $12 + 12 + 8 = 32\text{ bytes}$ (Fully accounted)
- **High-Detail Mesh Stride (40 bytes) [Hypothesis]:**
  - Position: 3x float32 (12 bytes)
  - Normal: 3x float32 (12 bytes)
  - Tangent: 4x int8_snorm (4 bytes)
  - UV0: 2x float32 (8 bytes)
  - *Remaining 4 bytes:* Attributed to either a 4-byte packed Binormal/Bitangent sign (`4x int8_snorm`) or 4-byte alignment padding. Total: $12 + 12 + 4 + 8 + 4 = 40\text{ bytes}$.
- **Skinned Mesh Stride (48 bytes) [Hypothesis]:**
  - Position: 3x float32 (12 bytes)
  - BlendWeights: 4x uint8_unorm (4 bytes)
  - BlendIndices: 4x uint8 (4 bytes)
  - Normal: 3x float32 (12 bytes)
  - UV0: 2x float32 (8 bytes)
  - *Remaining 8 bytes:* Attributed to secondary UV channel (`2x float32` / 8 bytes) or packed Tangent/Bitangent. Total: $12 + 4 + 4 + 12 + 8 + 8 = 48\text{ bytes}$.

> [!NOTE]
> The 32-, 40-, and 48-byte vertex layouts remain working hypotheses. The exact `D3D11_INPUT_ELEMENT_DESC` arrays from `CreateInputLayout` calls in the executable have not yet been extracted from the binary. Entry 6 (`Vehicles.big 0x01f0a400`) currently renders using authentic 8-byte float16 vertex streams.
