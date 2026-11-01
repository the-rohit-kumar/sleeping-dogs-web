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
  DecodedMesh
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
const MAX_L1_ENTRIES = 128;
const l1Cache = new Map<string, Uint8Array>();

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
 * with two-tier L1/L2 caching.
 */
export async function fetchRange(archiveName: string, offset: number, length: number): Promise<Uint8Array> {
  const cacheKey = `${archiveName}:${offset}:${length}`;

  // 1. Check L1 Memory Cache
  if (l1Cache.has(cacheKey)) {
    cacheStats.l1Hits++;
    // Move to end for LRU refresh
    const cached = l1Cache.get(cacheKey)!;
    l1Cache.delete(cacheKey);
    l1Cache.set(cacheKey, cached);
    return cached;
  }

  // 2. Check L2 IndexedDB Cache
  const idbCached = await idbGet(cacheKey);
  if (idbCached) {
    cacheStats.l2Hits++;
    // Promote to L1
    l1Cache.set(cacheKey, idbCached);
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

  if (response.status !== 206 && response.status !== 200) {
    throw new Error(`Failed to stream range [${offset}-${end}] from ${archiveName}.big (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  cacheStats.bytesLoaded += data.byteLength;
  cacheStats.bytesCached += data.byteLength;

  // Store in L1
  if (l1Cache.size >= MAX_L1_ENTRIES) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey) l1Cache.delete(oldestKey);
  }
  l1Cache.set(cacheKey, data);

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

export interface AuthenticTextures {
  asphalt: DecodedTexture;
  building: DecodedTexture;
  neon: DecodedTexture;
  vehicle: DecodedTexture;
  clothing: DecodedTexture;
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
    asphaltNormal,
    vehicleNormal,
    characterNormal
  };

  const sceneGraph = new SceneGraph();

  // 1. City Road Sector Node (Ground Anchor)
  const worldNode: SceneNode = {
    id: 'node-hk-sector',
    name: 'Hong Kong City Sector (Game.big 0x7b8f6706)',
    mesh: worldMesh,
    texture: asphaltTexture,
    normalMap: asphaltNormal,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [0.05, 0.05, 0.05], // Normalized broad city sector
    color: [0.85, 0.85, 0.85], // Balanced diffuse albedo
    visible: true,
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

  // 3. Authentic Character Node (Placed on the sidewalk)
  const charNode: SceneNode = {
    id: 'node-character',
    name: 'Hong Kong Pedestrian Model (Characters.big 0x030e17e9)',
    mesh: charMesh,
    texture: clothingTexture,
    normalMap: characterNormal,
    position: [-2.2, 0.0, 1.2],
    rotation: [0, -0.6, 0],
    scale: [1.0, 1.0, 1.0],
    color: [0.20, 0.65, 0.90], // Hong Kong denim blue
    visible: true,
    transform: createTransformMatrix([-2.2, 0.0, 1.2], [0, -0.6, 0], [1.0, 1.0, 1.0])
  };
  sceneGraph.addNode(charNode);

  return { sceneGraph, texture: asphaltTexture, textures };
}
