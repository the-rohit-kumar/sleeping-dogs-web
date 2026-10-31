/**
 * Sleeping Dogs BIG/BIX Archive Parser for Browser Runtime.
 * Pure TypeScript implementation with zero external dependencies.
 */

export const BIX_MAGIC = 0x2C5C40A8;
export const BIX_RECORD_START = 0xC0;
export const BIX_RECORD_STRIDE = 24;

export interface BixEntry {
    index: number;
    uid: number;
    uidHex: string;
    offset: number;
    offsetHex: string;
    part1Size: number;
    part2Size: number;
    padding: number;
    totalSpan: number;
    isMultiPart: boolean;
}

export interface BixArchive {
    name: string;
    entryCount: number;
    payloadSize: number;
    entries: BixEntry[];
}

export function parseBixBuffer(buffer: ArrayBuffer): BixArchive {
    if (buffer.byteLength < BIX_RECORD_START) {
        throw new Error(`BIX buffer too small: ${buffer.byteLength} bytes (minimum ${BIX_RECORD_START})`);
    }

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    if (magic !== BIX_MAGIC) {
        throw new Error(`Invalid BIX magic: 0x${magic.toString(16).toUpperCase()} (expected 0x${BIX_MAGIC.toString(16).toUpperCase()})`);
    }

    const payloadSize = view.getUint32(4, true);

    // Read archive name from 0x44 (null-terminated ASCII)
    const nameBytes = new Uint8Array(buffer, 0x44, 44);
    let nameLen = 0;
    while (nameLen < nameBytes.length && nameBytes[nameLen] !== 0) {
        nameLen++;
    }
    const decoder = new TextDecoder('ascii');
    const name = decoder.decode(nameBytes.subarray(0, nameLen));

    const entryCount = view.getUint32(0x70, true);
    const requiredSize = BIX_RECORD_START + entryCount * BIX_RECORD_STRIDE;
    if (buffer.byteLength < requiredSize) {
        throw new Error(`Truncated BIX archive: has ${buffer.byteLength} bytes, required ${requiredSize} for ${entryCount} records`);
    }

    const entries: BixEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
        const off = BIX_RECORD_START + i * BIX_RECORD_STRIDE;
        const uid = view.getUint32(off, true);
        const boff = view.getUint32(off + 4, true);
        const p1 = view.getUint32(off + 8, true);
        const p2 = view.getUint32(off + 12, true);
        const pad = view.getUint32(off + 16, true);
        const span = view.getUint32(off + 20, true);

        entries.push({
            index: i,
            uid,
            uidHex: '0x' + uid.toString(16).padStart(8, '0'),
            offset: boff,
            offsetHex: '0x' + boff.toString(16).padStart(8, '0'),
            part1Size: p1,
            part2Size: p2,
            padding: pad,
            totalSpan: span,
            isMultiPart: p1 > 0 || p2 > 0
        });
    }

    return {
        name: name || 'UnknownArchive',
        entryCount,
        payloadSize,
        entries
    };
}
