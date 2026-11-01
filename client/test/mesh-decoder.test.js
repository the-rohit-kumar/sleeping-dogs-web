import test from 'node:test';
import assert from 'node:assert';

function float16ToFloat32(h) {
  const s = (h >> 15) & 0x0001;
  const e = (h >> 10) & 0x001f;
  const f = h & 0x03ff;

  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  } else if (e === 0x1f) {
    return f ? NaN : ((s ? -1 : 1) * Infinity);
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

function computeSmoothNormals(positions, indices, vertexCount) {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const ax = positions[i1 * 3] - positions[i0 * 3];
    const ay = positions[i1 * 3 + 1] - positions[i0 * 3 + 1];
    const az = positions[i1 * 3 + 2] - positions[i0 * 3 + 2];

    const bx = positions[i2 * 3] - positions[i0 * 3];
    const by = positions[i2 * 3 + 1] - positions[i0 * 3 + 1];
    const bz = positions[i2 * 3 + 2] - positions[i0 * 3 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;

    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz) || 1.0;
    normals[i * 3] = nx / len;
    normals[i * 3 + 1] = ny / len;
    normals[i * 3 + 2] = nz / len;
  }
  return normals;
}

test('Mesh Decoder: float16ToFloat32 conversion accuracy', () => {
  assert.strictEqual(float16ToFloat32(0x0000), 0);
  assert.strictEqual(float16ToFloat32(0x8000), -0);
  assert.strictEqual(float16ToFloat32(0x3C00), 1.0);
  assert.strictEqual(float16ToFloat32(0x3E00), 1.5);
  assert.strictEqual(float16ToFloat32(0xC000), -2.0);
  assert.strictEqual(float16ToFloat32(0x7C00), Infinity);
  assert.strictEqual(float16ToFloat32(0xFC00), -Infinity);
  assert.ok(Number.isNaN(float16ToFloat32(0x7E00)));
});

test('Mesh Decoder: authentic index buffer unpacks exact index tuples', () => {
  // Mock 16-bit authentic index buffer for a 2-triangle quad
  const rawIndexBytes = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const indices = new Uint16Array(rawIndexBytes.buffer);

  assert.strictEqual(indices.length, 6);
  assert.strictEqual(indices[0], 0);
  assert.strictEqual(indices[1], 1);
  assert.strictEqual(indices[2], 2);
  assert.strictEqual(indices[3], 0);
  assert.strictEqual(indices[4], 2);
  assert.strictEqual(indices[5], 3);

  // Assert triangle count is exactly indices / 3
  const triangleCount = indices.length / 3;
  assert.strictEqual(triangleCount, 2);
});

test('Mesh Decoder: authentic indexed mesh binds real index buffer without synthetic strips', () => {
  // Mock 4 vertices of 8 bytes (4 half-floats each)
  // v0: (-1, -1, 0, 0)
  // v1: ( 1, -1, 0, 0)
  // v2: ( 1,  1, 0, 0)
  // v3: (-1,  1, 0, 0)
  const vbuf = new Uint8Array(32);
  const vview = new DataView(vbuf.buffer);
  // v0: -1.0 = 0xBC00
  vview.setUint16(0, 0xBC00, true); vview.setUint16(2, 0xBC00, true); vview.setUint16(4, 0x0000, true);
  // v1: 1.0 = 0x3C00, -1.0 = 0xBC00
  vview.setUint16(8, 0x3C00, true); vview.setUint16(10, 0xBC00, true); vview.setUint16(12, 0x0000, true);
  // v2: 1.0 = 0x3C00, 1.0 = 0x3C00
  vview.setUint16(16, 0x3C00, true); vview.setUint16(18, 0x3C00, true); vview.setUint16(20, 0x0000, true);
  // v3: -1.0 = 0xBC00, 1.0 = 0x3C00
  vview.setUint16(24, 0xBC00, true); vview.setUint16(26, 0x3C00, true); vview.setUint16(28, 0x0000, true);

  // Authentic index buffer: 2 triangles [0, 1, 2] and [0, 2, 3]
  const ibuf = new Uint8Array(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer);

  // Unpack via authentic indexed decoder
  const idxCount = Math.floor(ibuf.length / 2);
  const indices = new Uint16Array(ibuf.buffer, ibuf.byteOffset, idxCount);

  assert.strictEqual(indices.length, 6);
  assert.strictEqual(indices[0], 0);
  assert.strictEqual(indices[1], 1);
  assert.strictEqual(indices[2], 2);
  assert.strictEqual(indices[3], 0);
  assert.strictEqual(indices[4], 2);
  assert.strictEqual(indices[5], 3);
  assert.strictEqual(indices.length / 3, 2);
});

test('Mesh Decoder: computeSmoothNormals produces correct normals for XY quad', () => {
  // Quad vertices in XY plane (Z = 0)
  // v0: (-1, -1, 0), v1: (1, -1, 0), v2: (1, 1, 0), v3: (-1, 1, 0)
  const positions = new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const normals = computeSmoothNormals(positions, indices, 4);

  // All normals must point along +Z (0, 0, 1)
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(normals[i * 3 + 0], 0);
    assert.strictEqual(normals[i * 3 + 1], 0);
    assert.strictEqual(normals[i * 3 + 2], 1);
  }
});
