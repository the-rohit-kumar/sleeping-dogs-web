import { test, describe } from 'node:test';
import assert from 'node:assert';

// Exact implementation from client/src/asset-loader.ts
const MAX_L1_ENTRIES = 128;
const l1Cache = new Map();

function setL1(key, data) {
  if (l1Cache.has(key)) {
    l1Cache.delete(key);
  } else if (l1Cache.size >= MAX_L1_ENTRIES) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey !== undefined) {
      l1Cache.delete(oldestKey);
    }
  }
  l1Cache.set(key, data);
}

function getL1(key) {
  if (!l1Cache.has(key)) return undefined;
  const data = l1Cache.get(key);
  l1Cache.delete(key);
  l1Cache.set(key, data);
  return data;
}

function clearL1Cache() {
  l1Cache.clear();
}

function validateContentRange(header, expectedOffset, expectedLength) {
  if (!header) {
    return { valid: false, error: 'Missing Content-Range header in HTTP 206 response' };
  }

  const match = header.trim().match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) {
    return { valid: false, error: `Malformed Content-Range header: "${header}"` };
  }

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  const expectedEnd = expectedOffset + expectedLength - 1;

  if (start !== expectedOffset) {
    return {
      valid: false,
      error: `Content-Range start mismatch: expected ${expectedOffset}, got ${start}`
    };
  }

  if (end !== expectedEnd) {
    return {
      valid: false,
      error: `Content-Range end mismatch: expected ${expectedEnd}, got ${end}`
    };
  }

  if (start > end) {
    return { valid: false, error: `Content-Range start (${start}) cannot exceed end (${end})` };
  }

  if (match[3] !== '*') {
    const total = parseInt(match[3], 10);
    if (isNaN(total) || total <= 0) {
      return { valid: false, error: `Invalid Content-Range total size: "${match[3]}"` };
    }
    if (end >= total) {
      return { valid: false, error: `Content-Range end (${end}) exceeds total size (${total})` };
    }
    return { valid: true, start, end, total };
  }

  return { valid: true, start, end };
}

async function fetchRangeMock(url, offset, length, fetchFn) {
  const cacheKey = `${url}:${offset}:${length}`;
  const end = offset + length - 1;

  const response = await fetchFn(url, {
    method: 'GET',
    headers: { 'Range': `bytes=${offset}-${end}` }
  });

  if (response.status !== 206) {
    throw new Error(
      `Expected HTTP 206 Partial Content for range [${offset}-${end}], ` +
      `received HTTP ${response.status}. Full-file download rejected to prevent memory exhaustion.`
    );
  }

  const contentRange = response.headers.get('Content-Range');
  const rangeValidation = validateContentRange(contentRange, offset, length);
  if (!rangeValidation.valid) {
    throw new Error(`Invalid HTTP 206 Content-Range response: ${rangeValidation.error}`);
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength !== null) {
    const cl = parseInt(contentLength, 10);
    if (!isNaN(cl) && cl !== length) {
      throw new Error(
        `HTTP 206 Content-Length header mismatch: expected ${length} bytes, received ${cl} bytes`
      );
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  if (data.byteLength !== length) {
    throw new Error(
      `Received body length mismatch: requested ${length} bytes, received ${data.byteLength} bytes`
    );
  }

  setL1(cacheKey, data);
  return data;
}

describe('Asset Loader: HTTP 206 Content-Range Validation (Finding F01)', () => {
  test('rejects null or empty Content-Range header', () => {
    const resNull = validateContentRange(null, 100, 50);
    assert.strictEqual(resNull.valid, false);
    assert.match(resNull.error, /Missing Content-Range header/);

    const resEmpty = validateContentRange('', 100, 50);
    assert.strictEqual(resEmpty.valid, false);
    assert.match(resEmpty.error, /Missing Content-Range header/);
  });

  test('rejects malformed Content-Range header format', () => {
    const malformed = [
      'byte 100-149/1000',
      'bytes 100:149/1000',
      'bytes 100-149',
      'bytes abc-149/1000',
      'bytes 100-def/1000',
      'bytes 100-149/-5'
    ];

    for (const h of malformed) {
      const res = validateContentRange(h, 100, 50);
      assert.strictEqual(res.valid, false, `Expected malformed rejection for: ${h}`);
      assert.match(res.error, /Malformed Content-Range header/);
    }
  });

  test('rejects range start mismatch', () => {
    const res = validateContentRange('bytes 105-149/1000', 100, 50);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /start mismatch: expected 100, got 105/);
  });

  test('rejects range end mismatch', () => {
    const res = validateContentRange('bytes 100-150/1000', 100, 50);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /end mismatch: expected 149, got 150/);
  });

  test('rejects start > end in range', () => {
    const res = validateContentRange('bytes 200-100/1000', 200, -99);
    assert.strictEqual(res.valid, false);
  });

  test('rejects invalid or zero total size', () => {
    const res = validateContentRange('bytes 100-149/0', 100, 50);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Invalid Content-Range total size/);
  });

  test('rejects range end exceeding total size', () => {
    const res = validateContentRange('bytes 100-149/120', 100, 50);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /exceeds total size/);
  });

  test('accepts exact matching Content-Range with integer total', () => {
    const res = validateContentRange('bytes 100-149/1000', 100, 50);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.start, 100);
    assert.strictEqual(res.end, 149);
    assert.strictEqual(res.total, 1000);
  });

  test('accepts exact matching Content-Range with wildcard total', () => {
    const res = validateContentRange('bytes 0-1023/*', 0, 1024);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.start, 0);
    assert.strictEqual(res.end, 1023);
    assert.strictEqual(res.total, undefined);
  });
});

describe('Asset Loader: HTTP 206 fetch edge cases (Finding F01)', () => {
  test('rejects HTTP 200 (full content download instead of partial content)', async () => {
    const mockFetch = async () => new Response(new Uint8Array(100), {
      status: 200,
      headers: { 'Content-Length': '100' }
    });

    await assert.rejects(
      async () => fetchRangeMock('http://localhost:8080/test.big', 0, 100, mockFetch),
      /Expected HTTP 206 Partial Content.*received HTTP 200/
    );
  });

  test('rejects HTTP 206 with mismatched Content-Length header', async () => {
    const mockFetch = async () => new Response(new Uint8Array(100), {
      status: 206,
      headers: {
        'Content-Range': 'bytes 0-99/1000',
        'Content-Length': '50'
      }
    });

    await assert.rejects(
      async () => fetchRangeMock('http://localhost:8080/test.big', 0, 100, mockFetch),
      /Content-Length header mismatch: expected 100 bytes, received 50/
    );
  });

  test('rejects HTTP 206 with short body (fewer bytes than requested)', async () => {
    const mockFetch = async () => new Response(new Uint8Array(40), {
      status: 206,
      headers: {
        'Content-Range': 'bytes 0-99/1000',
        'Content-Length': '100'
      }
    });

    await assert.rejects(
      async () => fetchRangeMock('http://localhost:8080/test.big', 0, 100, mockFetch),
      /Received body length mismatch: requested 100 bytes, received 40 bytes/
    );
  });

  test('rejects HTTP 206 with oversized body (more bytes than requested)', async () => {
    const mockFetch = async () => new Response(new Uint8Array(120), {
      status: 206,
      headers: {
        'Content-Range': 'bytes 0-99/1000',
        'Content-Length': '100'
      }
    });

    await assert.rejects(
      async () => fetchRangeMock('http://localhost:8080/test.big', 0, 100, mockFetch),
      /Received body length mismatch: requested 100 bytes, received 120 bytes/
    );
  });

  test('accepts valid HTTP 206 response and caches verified payload', async () => {
    clearL1Cache();
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const mockFetch = async () => new Response(payload, {
      status: 206,
      headers: {
        'Content-Range': 'bytes 100-107/1000',
        'Content-Length': '8'
      }
    });

    const result = await fetchRangeMock('http://localhost:8080/test.big', 100, 8, mockFetch);
    assert.strictEqual(result.byteLength, 8);
    assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4, 5, 6, 7, 8]);

    // Verify present in L1
    const l1Entry = getL1('http://localhost:8080/test.big:100:8');
    assert.ok(l1Entry);
    assert.strictEqual(l1Entry.byteLength, 8);
  });
});

describe('Asset Loader: L1 Memory Cache strictly bounded to 128 entries (Finding F03)', () => {
  test('L1 cache never exceeds MAX_L1_ENTRIES upon promotion and insertion', () => {
    clearL1Cache();

    // Fill to 128 entries
    for (let i = 0; i < MAX_L1_ENTRIES; i++) {
      setL1(`chunk_${i}`, new Uint8Array([i & 0xff]));
    }
    assert.strictEqual(l1Cache.size, MAX_L1_ENTRIES);

    // Promote/insert 50 additional distinct entries (simulating IndexedDB hits)
    for (let i = 128; i < 178; i++) {
      setL1(`idb_promoted_${i}`, new Uint8Array([i & 0xff]));
      assert.strictEqual(l1Cache.size, MAX_L1_ENTRIES, `Cache exceeded MAX_L1_ENTRIES at entry ${i}`);
    }

    // Verify oldest keys were evicted
    assert.strictEqual(l1Cache.has('chunk_0'), false);
    assert.strictEqual(l1Cache.has('chunk_49'), false);
    // Verify newly promoted keys exist
    assert.strictEqual(l1Cache.has('idb_promoted_177'), true);
  });

  test('L1 cache read refreshes LRU recency to prevent eviction', () => {
    clearL1Cache();

    // Insert 128 entries
    for (let i = 0; i < MAX_L1_ENTRIES; i++) {
      setL1(`key_${i}`, new Uint8Array([i]));
    }

    // Touch key_0 so it becomes most recently used
    const touched = getL1('key_0');
    assert.ok(touched);

    // Insert one more entry - should evict key_1, NOT key_0!
    setL1('key_new', new Uint8Array([255]));

    assert.strictEqual(l1Cache.size, MAX_L1_ENTRIES);
    assert.strictEqual(l1Cache.has('key_0'), true, 'Recently read key_0 should not be evicted');
    assert.strictEqual(l1Cache.has('key_1'), false, 'Oldest unread key_1 should be evicted');
    assert.strictEqual(l1Cache.has('key_new'), true);
  });
});
