import test from 'node:test';
import assert from 'node:assert';

function unpackRGB565(c) {
  const r = (c >> 11) & 0x1f;
  const g = (c >> 5) & 0x3f;
  const b = c & 0x1f;
  return [
    Math.round((r * 255) / 31),
    Math.round((g * 255) / 63),
    Math.round((b * 255) / 31)
  ];
}

function decompressBC1Block(data, offset = 0) {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const c0 = view.getUint16(0, true);
  const c1 = view.getUint16(2, true);
  const bits = view.getUint32(4, true);

  const rgb0 = unpackRGB565(c0);
  const rgb1 = unpackRGB565(c1);

  const palette = [
    [rgb0[0], rgb0[1], rgb0[2], 255],
    [rgb1[0], rgb1[1], rgb1[2], 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255]
  ];

  if (c0 > c1) {
    palette[2] = [
      Math.round((2 * rgb0[0] + rgb1[0]) / 3),
      Math.round((2 * rgb0[1] + rgb1[1]) / 3),
      Math.round((2 * rgb0[2] + rgb1[2]) / 3),
      255
    ];
    palette[3] = [
      Math.round((rgb0[0] + 2 * rgb1[0]) / 3),
      Math.round((rgb0[1] + 2 * rgb1[1]) / 3),
      Math.round((rgb0[2] + 2 * rgb1[2]) / 3),
      255
    ];
  } else {
    palette[2] = [
      Math.round((rgb0[0] + rgb1[0]) / 2),
      Math.round((rgb0[1] + rgb1[1]) / 2),
      Math.round((rgb0[2] + rgb1[2]) / 2),
      255
    ];
    palette[3] = [0, 0, 0, 0]; // 1-bit transparent
  }

  const pixels = [];
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const bitIdx = (py * 4 + px) * 2;
      const code = (bits >> bitIdx) & 0x03;
      pixels.push(palette[code]);
    }
  }
  return pixels;
}

test('Texture Decoder: unpackRGB565 extracts full-range endpoints', () => {
  assert.deepStrictEqual(unpackRGB565(0x0000), [0, 0, 0]); // Pure Black
  assert.deepStrictEqual(unpackRGB565(0xFFFF), [255, 255, 255]); // Pure White
  assert.deepStrictEqual(unpackRGB565(0xF800), [255, 0, 0]); // Pure Red
  assert.deepStrictEqual(unpackRGB565(0x07E0), [0, 255, 0]); // Pure Green
  assert.deepStrictEqual(unpackRGB565(0x001F), [0, 0, 255]); // Pure Blue
});

test('Texture Decoder: BC1 decompressor handles 4-color mode and exact pixel interpolation', () => {
  // Construct 8-byte BC1 block:
  // c0 = 0xF800 (Red: 255, 0, 0)
  // c1 = 0x001F (Blue: 0, 0, 255)
  // c0 > c1 -> 4-color mode
  // pixel 0: code 0 (c0 -> pure red)
  // pixel 1: code 1 (c1 -> pure blue)
  // pixel 2: code 2 (2/3 c0 + 1/3 c1 -> [170, 0, 85])
  // pixel 3: code 3 (1/3 c0 + 2/3 c1 -> [85, 0, 170])
  const block = new Uint8Array(8);
  const view = new DataView(block.buffer);
  view.setUint16(0, 0xF800, true);
  view.setUint16(2, 0x001F, true);
  // Bits: pixel 0=00, pixel 1=01, pixel 2=10, pixel 3=11 -> 0b11_10_01_00 = 0xE4
  view.setUint32(4, 0x000000E4, true);

  const pixels = decompressBC1Block(block);
  assert.strictEqual(pixels.length, 16);
  assert.deepStrictEqual(pixels[0], [255, 0, 0, 255]); // c0
  assert.deepStrictEqual(pixels[1], [0, 0, 255, 255]); // c1
  assert.deepStrictEqual(pixels[2], [170, 0, 85, 255]); // 2/3 c0 + 1/3 c1
  assert.deepStrictEqual(pixels[3], [85, 0, 170, 255]); // 1/3 c0 + 2/3 c1
});

test('Texture Decoder: BC1 decompressor handles 1-bit transparency (c0 <= c1)', () => {
  const block = new Uint8Array(8);
  const view = new DataView(block.buffer);
  view.setUint16(0, 0x001F, true); // c0 = Blue
  view.setUint16(2, 0xF800, true); // c1 = Red (c0 <= c1)
  // Pixel 3 set to code 3 (transparent)
  view.setUint32(4, 0x000000C0, true); // 0b11_00_00_00

  const pixels = decompressBC1Block(block);
  assert.deepStrictEqual(pixels[3], [0, 0, 0, 0]); // Transparent black
});

