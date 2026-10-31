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
