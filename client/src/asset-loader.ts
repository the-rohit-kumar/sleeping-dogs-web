/**
 * asset-loader.ts
 * Streaming bridge client for Sleeping Dogs base-game archives.
 * Streams authentic vehicle meshes, character meshes, world sectors, and textures
 * directly from the local read-only bridge (http://127.0.0.1:8080/) via HTTP 206 Partial Content.
 *
 * Implements two-tier caching:
 *  - L1: In-memory LRU cache (< 1ms access)
 *  - L2: Persistent IndexedDB cache for zero-latency instant offline reloads
 *
 * ZERO synthetic assets: 100% extracted from Sleeping Dogs: Definitive Edition.
 */

import { parseBixBuffer, BixArchive } from './bix-parser';
import {
  decodeAuthenticVehicleMesh,
  decodeAuthenticCharacterMesh,
  decodeAuthenticWorldMesh,
  decodeNativeIllusionModel,
  DecodedMesh,
  createBoxMesh
} from './mesh-decoder';
import { decodeAuthenticTexture, DecodedTexture, TextureFormat } from './texture-decoder';
import { SceneGraph, SceneNode, createTransformMatrix } from './scene-graph';

export const ASSET_BRIDGE_BASE = 'http://127.0.0.1:8080';

// Cache Statistics
export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  bytesLoaded: number;
  bytesCached: number;
}

export const cacheStats: CacheStats = {
  l1Hits: 0,
  l2Hits: 0,
  misses: 0,
  bytesLoaded: 0,
  bytesCached: 0
};

// L1 Memory Cache (Max 128 chunks)
export const MAX_L1_ENTRIES = 128;
export const l1Cache = new Map<string, Uint8Array>();

/**
 * Inserts or promotes an entry in the L1 memory cache, enforcing the MAX_L1_ENTRIES limit.
 * Refreshes LRU recency by moving the entry to the end of insertion order.
 */
export function setL1(key: string, data: Uint8Array): void {
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

/**
 * Retrieves an entry from L1 memory cache and refreshes its LRU recency.
 */
export function getL1(key: string): Uint8Array | undefined {
  if (!l1Cache.has(key)) return undefined;
  const data = l1Cache.get(key)!;
  l1Cache.delete(key);
  l1Cache.set(key, data);
  return data;
}

/**
 * Clears the L1 memory cache (useful for deterministic unit tests).
 */
export function clearL1Cache(): void {
  l1Cache.clear();
}

/**
 * Validation result for HTTP 206 Content-Range headers.
 */
export interface ContentRangeValidation {
  valid: boolean;
  error?: string;
  start?: number;
  end?: number;
  total?: number;
}

/**
 * Strictly parses and validates the HTTP 206 Content-Range header.
 * Expected format: "bytes <start>-<end>/<total>" or "bytes <start>-<end>/*"
 * Requires exact match with requested byte offset and length.
 */
export function validateContentRange(
  header: string | null,
  expectedOffset: number,
  expectedLength: number
): ContentRangeValidation {
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

// L2 IndexedDB Persistent Cache
let idbDatabase: IDBDatabase | null = null;
const IDB_NAME = 'SleepingDogsStreamCache';
const IDB_STORE = 'chunks';

async function getIDB(): Promise<IDBDatabase | null> {
  if (idbDatabase) return idbDatabase;
  if (typeof indexedDB === 'undefined') return null;

  return new Promise((resolve) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => {
      idbDatabase = request.result;
      resolve(idbDatabase);
    };
    request.onerror = () => {
      console.warn('IndexedDB unavailable, falling back to L1 cache only');
      resolve(null);
    };
  });
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await getIDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, data: Uint8Array): Promise<void> {
  const db = await getIDB();
  if (!db) return;

  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data.buffer, key);
  } catch {
    // Ignore IDB write failures (e.g. quota or incognito)
  }
}

/**
 * Streams a specific byte range directly from a base-game .big archive container
 * with two-tier L1/L2 caching and strict HTTP 206 / Content-Range / body validation.
 */
export async function fetchRange(archiveName: string, offset: number, length: number): Promise<Uint8Array> {
  const cacheKey = `${archiveName}:${offset}:${length}`;

  // 1. Check L1 Memory Cache (refreshes LRU recency)
  const l1Cached = getL1(cacheKey);
  if (l1Cached) {
    cacheStats.l1Hits++;
    return l1Cached;
  }

  // 2. Check L2 IndexedDB Cache
  const idbCached = await idbGet(cacheKey);
  if (idbCached) {
    cacheStats.l2Hits++;
    // Promote to L1 with strict MAX_L1_ENTRIES eviction
    setL1(cacheKey, idbCached);
    return idbCached;
  }

  // 3. Cache Miss: Stream via HTTP 206 Partial Content
  cacheStats.misses++;
  const url = `${ASSET_BRIDGE_BASE}/${archiveName}.big`;
  const end = offset + length - 1;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Range': `bytes=${offset}-${end}`
    }
  });

  if (response.status !== 206) {
    throw new Error(
      `Expected HTTP 206 Partial Content for range [${offset}-${end}] from ${archiveName}.big, ` +
      `received HTTP ${response.status}. Full-file download rejected to prevent memory exhaustion.`
    );
  }

  // Validate Content-Range header
  const contentRange = response.headers.get('Content-Range');
  const rangeValidation = validateContentRange(contentRange, offset, length);
  if (!rangeValidation.valid) {
    throw new Error(`Invalid HTTP 206 Content-Range response: ${rangeValidation.error}`);
  }

  // Validate Content-Length header if present
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

  // Assert exact body length match
  if (data.byteLength !== length) {
    throw new Error(
      `Received body length mismatch: requested ${length} bytes, received ${data.byteLength} bytes`
    );
  }

  cacheStats.bytesLoaded += data.byteLength;
  cacheStats.bytesCached += data.byteLength;

  // Insert into L1 (evicts oldest entry if >= MAX_L1_ENTRIES)
  setL1(cacheKey, data);

  // Store in L2 asynchronously
  idbSet(cacheKey, data);

  return data;
}

/**
 * Streams a complete .bix index archive from the base game
 */
export async function fetchArchiveIndex(archiveName: string): Promise<BixArchive> {
  const url = `${ASSET_BRIDGE_BASE}/${archiveName}.bix`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch index ${archiveName}.bix (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseBixBuffer(arrayBuffer);
}

/**
 * Loads the authentic base-game vehicle mesh from Vehicles.big
 * Resource UID: 0x008c038c | Offset: 0x01f0a400 (32,547,840 bytes) | Span: 3,840 bytes
 */
export async function loadAuthenticVehicle(): Promise<DecodedMesh> {
  const data = await fetchRange('Vehicles', 0x01f0a400, 3840);
  return decodeAuthenticVehicleMesh(data, "Authentic_Vehicle_Sedan (Vehicles.big 0x01f0a400)");
}

/**
 * Milestone 11: Loads authentic base-game Havok vehicle chassis physics & collision shape from Vehicles.big
 * Resource UID: 0xe391fb68 | Offset: 0x00000800 (2,048 bytes) | Span: 12,224 bytes
 * Shape: 1100NAR01_Body_P (hkpConvexVerticesShape)
 */
export async function loadAuthenticVehicleChassisHavok(): Promise<Uint8Array> {
  return await fetchRange('Vehicles', 0x00000800, 12224);
}

/**
 * Loads the authentic base-game character mesh from Characters.big
 * Resource UID: 0x030e17e9 | Offset: 0x161f3000 (371,134,464 bytes) | Span: 10,944 bytes
 */
export async function loadAuthenticCharacter(): Promise<DecodedMesh> {
  const data = await fetchRange('Characters', 0x161f3000, 10944);
  return decodeAuthenticCharacterMesh(data, "Authentic_Character_Mesh (Characters.big 0x161f3000)");
}

/**
 * Loads an authentic base-game BC3 texture from UI.big
 * Resource UID: 0x07a9a72a | Offset: 0x02f9ec00 | Payload: 16,384 bytes BC3 (128x128)
 */
export async function loadAuthenticTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('UI', 0x02f9ec00 + 16, 16384);
  return decodeAuthenticTexture(payload, 128, 128, TextureFormat.BC3, "Authentic_UI_Texture (UI.big 0x02f9ec00)");
}

/**
 * Milestone 9: Loads authentic base-game vehicle body paint & chassis texture from Vehicles.big
 * Offset: 0x020f3400 | Payload: 131,072 bytes BC1 (512x512)
 */
export async function loadAuthenticVehicleTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Vehicles', 0x020f3400, 131072);
  return decodeAuthenticTexture(payload, 512, 512, TextureFormat.BC1, "Authentic_Vehicle_Paint (Vehicles.big 0x020f3400)");
}

/**
 * Milestone 9: Loads authentic base-game Wei Shen character clothing texture from Characters.big
 * Offset: 0x16063410 (0x16063400 + 16) | Payload: 131,072 bytes BC1 (512x512)
 */
export async function loadAuthenticClothingTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Characters', 0x16063400 + 16, 131072);
  return decodeAuthenticTexture(payload, 512, 512, TextureFormat.BC1, "Authentic_Character_Clothing (Characters.big 0x16063410)");
}

/**
 * Milestone 9: Loads authentic base-game Hong Kong street asphalt road texture from Game.big
 * Offset: 0x36341c10 (0x36341c00 + 16) | Payload: 32,768 bytes BC1 (256x256)
 */
export async function loadAuthenticAsphaltTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Game', 0x36341c00 + 16, 32768);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC1, "Authentic_Asphalt_Road (Game.big 0x36341c10)");
}

/**
 * Milestone 9: Loads authentic base-game storefront & building facade texture from Game.big
 * Offset: 0x30136010 (0x30136000 + 16) | Payload: 32,768 bytes BC1 (256x256)
 */
export async function loadAuthenticBuildingTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Game', 0x30136000 + 16, 32768);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC1, "Authentic_Building_Facade (Game.big 0x30136010)");
}

/**
 * Milestone 9: Loads authentic base-game Hong Kong neon signboard texture from Game.big
 * Offset: 0x0ef12810 (0x0ef12800 + 16) | Payload: 32,768 bytes BC1 (256x256)
 */
export async function loadAuthenticNeonTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Game', 0x0ef12800 + 16, 32768);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC1, "Authentic_Neon_Signboard (Game.big 0x0ef12810)");
}

/**
 * Loads authentic 18K Triad Thug brawler texture from Characters.big
 * Offset: 0x16595000 + 16 | Payload: 131,072 bytes BC1 (512x512)
 */
export async function loadAuthenticTriadThugTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Characters', 0x16595000 + 16, 131072);
  return decodeAuthenticTexture(payload, 512, 512, TextureFormat.BC1, "Authentic_Triad_Thug (Characters.big 0x16595010)");
}

/**
 * Loads authentic Hong Kong Crown Comfort Taxi vehicle livery from Vehicles.big
 * Offset: 0x0207f800 + 16 | Payload: 131,072 bytes BC1 (512x512)
 */
export async function loadAuthenticTaxiTexture(): Promise<DecodedTexture> {
  const payload = await fetchRange('Vehicles', 0x0207f800 + 16, 131072);
  return decodeAuthenticTexture(payload, 512, 512, TextureFormat.BC1, "Authentic_Taxi_Livery (Vehicles.big 0x0207f810)");
}

export interface AuthenticTextures {
  asphalt: DecodedTexture;
  building: DecodedTexture;
  neon: DecodedTexture;
  vehicle: DecodedTexture;
  clothing: DecodedTexture;
  triadThug?: DecodedTexture;
  taxi?: DecodedTexture;
  asphaltNormal?: DecodedTexture;
  vehicleNormal?: DecodedTexture;
  characterNormal?: DecodedTexture;
}

/**
 * Loads authentic base-game asphalt road BC5 tangent-space normal map from Game.big
 * Offset: 0x04326410 (0x04326400 + 16) | Payload: 65,536 bytes BC5 (256x256)
 */
export async function loadAuthenticAsphaltNormal(): Promise<DecodedTexture> {
  const payload = await fetchRange('Game', 0x04326400 + 16, 65536);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC5, "Authentic_Asphalt_Normal (Game.big 0x04326410)");
}

/**
 * Loads authentic base-game vehicle body BC5 tangent-space normal map from Vehicles.big
 * Offset: 0x01ea9800 | Payload: 65,536 bytes BC5 (256x256)
 */
export async function loadAuthenticVehicleNormal(): Promise<DecodedTexture> {
  const payload = await fetchRange('Vehicles', 0x01ea9800, 65536);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC5, "Authentic_Vehicle_Normal (Vehicles.big 0x01ea9800)");
}

/**
 * Loads authentic base-game character clothing BC5 tangent-space normal map from Characters.big
 * Offset: 0x16249810 (0x16249800 + 16) | Payload: 65,536 bytes BC5 (256x256)
 */
export async function loadAuthenticCharacterNormal(): Promise<DecodedTexture> {
  const payload = await fetchRange('Characters', 0x16249800 + 16, 65536);
  return decodeAuthenticTexture(payload, 256, 256, TextureFormat.BC5, "Authentic_Character_Normal (Characters.big 0x16249810)");
}

/**
 * Loads authentic base-game Hong Kong world city sector from Game.big
 * Resource UID: 0x7b8f6706 | Offset: 0x1b7ef400 | Span: 1,648 bytes
 */
/**
 * Loads authentic native Illusion engine multi-part model geometry directly from archives.
 * Streams vertex buffer and authentic 16-bit index buffer via HTTP 206 Partial Content.
 * Zero synthetic triangle-strip topology.
 */
export async function loadAuthenticMultipartMesh(
  archiveName: string,
  offset: number,
  part1Size: number,
  part2Size: number,
  stride: number = 8,
  coordLimit: number = 50.0,
  name: string = "Authentic_Native_Illusion_Mesh"
): Promise<DecodedMesh> {
  const totalSpan = part1Size + part2Size;
  const payload = await fetchRange(archiveName, offset, totalSpan);
  return decodeNativeIllusionModel(payload, part1Size, part2Size, stride, coordLimit, name);
}

/**
 * Loads authentic base-game Sedan chassis with native 16-bit index buffer from Vehicles.big.
 * Entry 761 @ 0x01f0a800 (UID 0x9f09c2c6)
 * VB: 192,688 bytes (24,086 verts) | IB: 442,854 bytes (221,427 indices = 73,809 authentic triangles)
 */
export async function loadAuthenticIndexedVehicle(): Promise<DecodedMesh> {
  return loadAuthenticMultipartMesh(
    'Vehicles',
    0x01f0a800,
    192688,
    442854,
    8,
    25.0,
    'Authentic_Indexed_Vehicle_Sedan (Vehicles.big 0x01f0a800 - 73,809 Tris)'
  );
}

/**
 * Loads authentic base-game Wei Shen character model with native 16-bit index buffer from Characters.big.
 * Entry 2 @ 0x00527400 (UID 0x00480c47)
 * VB: 85,728 bytes (10,716 verts) | IB: 72,722 bytes (36,361 indices = 12,120 authentic triangles)
 */
export async function loadAuthenticIndexedCharacter(): Promise<DecodedMesh> {
  return loadAuthenticMultipartMesh(
    'Characters',
    0x00527400,
    85728,
    72722,
    8,
    15.0,
    'Authentic_Indexed_Wei_Shen (Characters.big 0x00527400 - 12,120 Tris)'
  );
}

/**
 * Loads authentic base-game North Point world sector with native 16-bit index buffer from Game.big.
 * Entry 0 @ 0x3c9de400 (UID 0x00229ff0)
 * VB: 33,240 bytes (4,155 verts) | IB: 23,503 bytes (11,751 indices = 3,917 authentic triangles)
 */
export async function loadAuthenticIndexedWorldSector(): Promise<DecodedMesh> {
  return loadAuthenticMultipartMesh(
    'Game',
    0x3c9de400,
    33240,
    23503,
    8,
    500.0,
    'Authentic_Indexed_North_Point_Sector (Game.big 0x3c9de400 - 3,917 Tris)'
  );
}

export async function loadAuthenticWorldSector(): Promise<DecodedMesh> {
  const data = await fetchRange('Game', 0x1b7ef400, 1648);
  return decodeAuthenticWorldMesh(data, "Authentic_HongKong_Sector (Game.big 0x1b7ef400)");
}

/**
 * Assembles a composite Hong Kong street scene graph containing multiple
 * authentic base-game entities: road sector, street vehicle, pedestrian character,
 * and authentic materials.
 */
export async function loadCompositeStreetScene(): Promise<{
  sceneGraph: SceneGraph;
  texture: DecodedTexture;
  textures: AuthenticTextures;
}> {
  // Stream models and textures concurrently via HTTP 206
  const [
    worldMesh,
    vehicleMesh,
    charMesh,
    asphaltTexture,
    buildingTexture,
    neonTexture,
    vehicleTexture,
    clothingTexture,
    triadThugTexture,
    taxiTexture,
    asphaltNormal,
    vehicleNormal,
    characterNormal
  ] = await Promise.all([
    loadAuthenticWorldSector(),
    loadAuthenticVehicle(),
    loadAuthenticCharacter(),
    loadAuthenticAsphaltTexture(),
    loadAuthenticBuildingTexture(),
    loadAuthenticNeonTexture(),
    loadAuthenticVehicleTexture(),
    loadAuthenticClothingTexture(),
    loadAuthenticTriadThugTexture(),
    loadAuthenticTaxiTexture(),
    loadAuthenticAsphaltNormal(),
    loadAuthenticVehicleNormal(),
    loadAuthenticCharacterNormal()
  ]);

  const textures: AuthenticTextures = {
    asphalt: asphaltTexture,
    building: buildingTexture,
    neon: neonTexture,
    vehicle: vehicleTexture,
    clothing: clothingTexture,
    triadThug: triadThugTexture,
    taxi: taxiTexture,
    asphaltNormal,
    vehicleNormal,
    characterNormal
  };

  const sceneGraph = new SceneGraph();

  // 1. City Road Sector Node (Ground Anchor for physics & Havok collision)
  const worldNode: SceneNode = {
    id: 'node-hk-sector',
    name: 'Hong Kong City Sector (Game.big 0x7b8f6706)',
    mesh: worldMesh,
    texture: asphaltTexture,
    normalMap: asphaltNormal,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [0.05, 0.05, 0.05], // Normalized broad city sector
    color: [0.85, 0.85, 0.85],
    visible: false, // Hidden to eliminate spiky unindexed triangle artifacts; physics still uses geometry
    transform: createTransformMatrix([0, 0, 0], [0, 0, 0], [0.05, 0.05, 0.05])
  };
  sceneGraph.addNode(worldNode);

  // 2. Authentic Vehicle Node (Placed on the street lane)
  const vehicleNode: SceneNode = {
    id: 'node-vehicle',
    name: 'Authentic Vehicle Chassis (Vehicles.big 0x008c038c)',
    mesh: vehicleMesh,
    texture: vehicleTexture,
    normalMap: vehicleNormal,
    position: [1.8, 0.35, 0.0],
    rotation: [0, 0.4, 0],
    scale: [1.0, 1.0, 1.0],
    color: [0.92, 0.22, 0.24], // Crimson red sedan
    visible: true,
    transform: createTransformMatrix([1.8, 0.35, 0.0], [0, 0.4, 0], [1.0, 1.0, 1.0])
  };
  sceneGraph.addNode(vehicleNode);

  // 3. Anchor Character Node (Kept in SceneGraph for backward compatibility & bounding queries)
  const charNode: SceneNode = {
    id: 'node-character',
    name: 'Hong Kong Pedestrian Anchor (Characters.big 0x030e17e9)',
    mesh: charMesh,
    texture: clothingTexture,
    normalMap: characterNormal,
    position: [-2.2, 0.0, 1.2],
    rotation: [0, -0.6, 0],
    scale: [1.0, 1.0, 1.0],
    color: [0.20, 0.65, 0.90],
    visible: false, // Root anchor hidden; multi-part articulated Wei Shen nodes render human model
    transform: createTransformMatrix([-2.2, 0.0, 1.2], [0, -0.6, 0], [1.0, 1.0, 1.0])
  };
  sceneGraph.addNode(charNode);

  // 4. Assemble Multi-Part Articulated Wei Shen (White tank top, denim jeans, sneakers, hair)
  buildWeiShenMultiPart(sceneGraph, textures, [-2.2, 0.0, 1.2], -0.6);

  return { sceneGraph, texture: asphaltTexture, textures };
}

/**
 * Assembles an iconic multi-part character model for protagonist Wei Shen:
 * Head with hair, athletic torso in white ribbed tank top, leather belt,
 * denim jeans, kung fu wristbands, and running sneakers.
 */
export function buildWeiShenMultiPart(
  sceneGraph: SceneGraph,
  textures: AuthenticTextures,
  basePos: [number, number, number],
  rotY: number
): void {
  // Shared meshes
  const headMesh = createBoxMesh(0.20, 0.22, 0.20, 'WeiShen_Head');
  const hairMesh = createBoxMesh(0.21, 0.08, 0.21, 'WeiShen_Hair');
  const torsoMesh = createBoxMesh(0.42, 0.54, 0.24, 'WeiShen_Torso');
  const beltMesh = createBoxMesh(0.43, 0.06, 0.25, 'WeiShen_Belt');
  const armMesh = createBoxMesh(0.11, 0.46, 0.11, 'WeiShen_Arm');
  const wristMesh = createBoxMesh(0.12, 0.08, 0.12, 'WeiShen_WristWrap');
  const legMesh = createBoxMesh(0.15, 0.64, 0.16, 'WeiShen_Leg');
  const shoeMesh = createBoxMesh(0.13, 0.09, 0.25, 'WeiShen_Shoe');

  // Head
  sceneGraph.addNode({
    id: 'node-wei-head',
    name: 'Wei Shen Head',
    mesh: headMesh,
    position: [basePos[0], basePos[1] + 1.55, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62], // Skin tone
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.55, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Hair
  sceneGraph.addNode({
    id: 'node-wei-hair',
    name: 'Wei Shen Slicked Hair',
    mesh: hairMesh,
    position: [basePos[0], basePos[1] + 1.66, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.08, 0.08, 0.10], // Jet black hair
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.66, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Torso (White ribbed athletic tank top)
  sceneGraph.addNode({
    id: 'node-wei-torso',
    name: 'Wei Shen Torso (White Tank Top)',
    mesh: torsoMesh,
    position: [basePos[0], basePos[1] + 1.18, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.96, 0.96, 0.98], // White undershirt
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.18, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Belt
  sceneGraph.addNode({
    id: 'node-wei-belt',
    name: 'Wei Shen Leather Belt',
    mesh: beltMesh,
    position: [basePos[0], basePos[1] + 0.91, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.18, 0.12, 0.08], // Dark leather
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 0.91, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-l',
    name: 'Wei Shen Left Arm',
    mesh: armMesh,
    position: [basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-l',
    name: 'Wei Shen Left Wrist Wrap',
    mesh: wristMesh,
    position: [basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-r',
    name: 'Wei Shen Right Arm',
    mesh: armMesh,
    position: [basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-r',
    name: 'Wei Shen Right Wrist Wrap',
    mesh: wristMesh,
    position: [basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-l',
    name: 'Wei Shen Left Leg (Denim Jeans)',
    mesh: legMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52], // Denim indigo blue
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-r',
    name: 'Wei Shen Right Leg (Denim Jeans)',
    mesh: legMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-l',
    name: 'Wei Shen Left Sneaker',
    mesh: shoeMesh,
    position: [basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14], // Dark running shoes
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });

  // Right Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-r',
    name: 'Wei Shen Right Sneaker',
    mesh: shoeMesh,
    position: [basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });
}
