/**
 * asset-loader.ts
 * Streaming bridge client for Sleeping Dogs base-game archives.
 * Streams authentic vehicle meshes, character meshes, and textures
 * directly from the local read-only bridge (http://127.0.0.1:8080/) via HTTP 206 Partial Content.
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

export const ASSET_BRIDGE_BASE = 'http://127.0.0.1:8080';

/**
 * Streams a specific byte range directly from a base-game .big archive container
 */
export async function fetchRange(archiveName: string, offset: number, length: number): Promise<Uint8Array> {
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
  return new Uint8Array(arrayBuffer);
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
  // Offset + 16 bytes chunk header skips straight to BC3 compressed blocks
  const payload = await fetchRange('UI', 0x02f9ec00 + 16, 16384);
  return decodeAuthenticTexture(payload, 128, 128, TextureFormat.BC3, "Authentic_UI_Texture (UI.big 0x02f9ec00)");
}

/**
 * Loads authentic base-game Hong Kong world city sector from Game.big
 * Resource UID: 0x7b8f6706 | Offset: 0x1b7ef400 | Span: 1,648 bytes
 */
export async function loadAuthenticWorldSector(): Promise<DecodedMesh> {
  const data = await fetchRange('Game', 0x1b7ef400, 1648);
  return decodeAuthenticWorldMesh(data, "Authentic_HongKong_Sector (Game.big 0x1b7ef400)");
}
