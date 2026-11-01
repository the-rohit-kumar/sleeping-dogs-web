import test from 'node:test';
import assert from 'node:assert';

// Mock BIX parser logic for standalone CI testing
const BIX_MAGIC = 0x2C5C40A8;
const BIX_HEADER_SIZE = 0xC0;
const BIX_RECORD_STRIDE = 24;

function parseBixBuffer(buffer) {
  if (buffer.byteLength < BIX_HEADER_SIZE) {
    throw new Error(`BIX buffer too small (${buffer.byteLength} bytes, expected at least ${BIX_HEADER_SIZE})`);
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== BIX_MAGIC) {
    throw new Error(`Invalid BIX magic: 0x${magic.toString(16)} (expected 0x${BIX_MAGIC.toString(16)})`);
  }

  const payloadSize = view.getUint32(4, true);
  const entryCount = view.getUint32(0x70, true);
  const expectedLen = BIX_HEADER_SIZE + entryCount * BIX_RECORD_STRIDE;
  if (buffer.byteLength < expectedLen) {
    throw new Error(`Truncated BIX: expected ${expectedLen} bytes for ${entryCount} entries, got ${buffer.byteLength}`);
  }

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const off = BIX_HEADER_SIZE + i * BIX_RECORD_STRIDE;
    const uid = view.getUint32(off + 0, true);
    const boff = view.getUint32(off + 4, true);
    const p1 = view.getUint32(off + 8, true);
    const p2 = view.getUint32(off + 12, true);
    const pad = view.getUint32(off + 16, true);
    const span = view.getUint32(off + 20, true);

    // Invariant check for multi-part records
    if (p1 > 0 || p2 > 0) {
      if (p1 + p2 !== span + pad) {
        throw new Error(`Integrity violation at entry ${i}: p1 (${p1}) + p2 (${p2}) != span (${span}) + pad (${pad})`);
      }
    }
    entries.push({ uid, offset: boff, p1, p2, pad, span });
  }

  return { magic, payloadSize, entryCount, entries };
}

test('BIX Parser: rejects truncated buffer', () => {
  const truncated = new ArrayBuffer(64);
  assert.throws(() => parseBixBuffer(truncated), /too small/);
});

test('BIX Parser: rejects invalid magic number', () => {
  const buf = new ArrayBuffer(BIX_HEADER_SIZE);
  const view = new DataView(buf);
  view.setUint32(0, 0x12345678, true);
  assert.throws(() => parseBixBuffer(buf), /Invalid BIX magic/);
});

test('BIX Parser: correctly parses valid single-part and multi-part entries', () => {
  const entryCount = 2;
  const buf = new ArrayBuffer(BIX_HEADER_SIZE + entryCount * BIX_RECORD_STRIDE);
  const view = new DataView(buf);

  // Set header
  view.setUint32(0, BIX_MAGIC, true);
  view.setUint32(4, 1000, true);
  view.setUint32(0x70, entryCount, true);

  // Entry 0: Single-part (Sedan UID 0x008c038c, span 3840)
  const e0 = BIX_HEADER_SIZE;
  view.setUint32(e0 + 0, 0x008c038c, true);
  view.setUint32(e0 + 4, 0x01f0a400, true);
  view.setUint32(e0 + 8, 0, true);
  view.setUint32(e0 + 12, 0, true);
  view.setUint32(e0 + 16, 0, true);
  view.setUint32(e0 + 20, 3840, true);

  // Entry 1: Multi-part (UID 0x9f09c2c6, p1=192688, p2=442854, pad=22, span=635520)
  const e1 = BIX_HEADER_SIZE + BIX_RECORD_STRIDE;
  view.setUint32(e1 + 0, 0x9f09c2c6, true);
  view.setUint32(e1 + 4, 0x01f0a800, true);
  view.setUint32(e1 + 8, 192688, true);
  view.setUint32(e1 + 12, 442854, true);
  view.setUint32(e1 + 16, 22, true);
  view.setUint32(e1 + 20, 635520, true); // 192688 + 442854 = 635542 = 635520 + 22

  const parsed = parseBixBuffer(buf);
  assert.strictEqual(parsed.entryCount, 2);
  assert.strictEqual(parsed.entries[0].uid, 0x008c038c);
  assert.strictEqual(parsed.entries[0].span, 3840);
  assert.strictEqual(parsed.entries[1].uid, 0x9f09c2c6);
  assert.strictEqual(parsed.entries[1].span, 635520);
});

test('BIX Parser: detects corrupted multipart invariant', () => {
  const entryCount = 1;
  const buf = new ArrayBuffer(BIX_HEADER_SIZE + entryCount * BIX_RECORD_STRIDE);
  const view = new DataView(buf);

  view.setUint32(0, BIX_MAGIC, true);
  view.setUint32(0x70, entryCount, true);

  const e0 = BIX_HEADER_SIZE;
  view.setUint32(e0 + 0, 0x11223344, true);
  view.setUint32(e0 + 4, 0x1000, true);
  view.setUint32(e0 + 8, 100, true);
  view.setUint32(e0 + 12, 200, true);
  view.setUint32(e0 + 16, 0, true);
  view.setUint32(e0 + 20, 9999, true); // Invariant violated: 100 + 200 != 9999 + 0

  assert.throws(() => parseBixBuffer(buf), /Integrity violation/);
});

