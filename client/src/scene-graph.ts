/**
 * scene-graph.ts
 * Spatial scene hierarchy and transformation graph for Sleeping Dogs reconstruction.
 * ZERO synthetic assets: Holds only nodes backed by authentic base-game models.
 */

import { DecodedMesh } from './mesh-decoder';
import { DecodedTexture } from './texture-decoder';

export interface SceneNode {
  id: string;
  name: string;
  mesh: DecodedMesh;
  texture?: DecodedTexture;
  normalMap?: DecodedTexture;
  position: [number, number, number];
  rotation: [number, number, number]; // [pitch, yaw, roll] in radians
  scale: [number, number, number];
  color: [number, number, number];
  visible: boolean;
  transform: Float32Array; // 16 floats (4x4 matrix)

  // WebGL GPU resources
  vao?: WebGLVertexArrayObject | null;
  vbo?: WebGLBuffer | null;
  ebo?: WebGLBuffer | null;
  gpuTexture?: WebGLTexture | null;
  gpuNormalMap?: WebGLTexture | null;
  gpuReady?: boolean;
}

export function createTransformMatrix(
  pos: [number, number, number],
  rot: [number, number, number],
  scale: [number, number, number]
): Float32Array {
  const m = new Float32Array(16);
  const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
  const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
  const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);

  // Combined rotation matrix R = Ry * Rx * Rz
  const r00 = (cy * cz) + (sy * sx * sz);
  const r01 = cx * sz;
  const r02 = (-sy * cz) + (cy * sx * sz);

  const r10 = (-cy * sz) + (sy * sx * cz);
  const r11 = cx * cz;
  const r12 = (sy * sz) + (cy * sx * cz);

  const r20 = sy * cx;
  const r21 = -sx;
  const r22 = cy * cx;

  // Apply scale
  m[0] = r00 * scale[0];
  m[1] = r10 * scale[0];
  m[2] = r20 * scale[0];
  m[3] = 0;

  m[4] = r01 * scale[1];
  m[5] = r11 * scale[1];
  m[6] = r21 * scale[1];
  m[7] = 0;

  m[8] = r02 * scale[2];
  m[9] = r12 * scale[2];
  m[10] = r22 * scale[2];
  m[11] = 0;

  // Apply translation
  m[12] = pos[0];
  m[13] = pos[1];
  m[14] = pos[2];
  m[15] = 1;

  return m;
}

export class SceneGraph {
  public nodes: Map<string, SceneNode> = new Map();

  public addNode(node: SceneNode): void {
    if (!node.transform) {
      node.transform = createTransformMatrix(node.position, node.rotation, node.scale);
    }
    this.nodes.set(node.id, node);
  }

  public updateNodeTransform(id: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.transform = createTransformMatrix(node.position, node.rotation, node.scale);
    }
  }

  public getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  public removeNode(id: string): void {
    this.nodes.delete(id);
  }

  public clear(): void {
    this.nodes.clear();
  }

  public getAllNodes(): SceneNode[] {
    return Array.from(this.nodes.values());
  }

  public getTotalTriangles(): number {
    let sum = 0;
    for (const node of this.nodes.values()) {
      if (node.visible && node.mesh) {
        sum += node.mesh.triangleCount;
      }
    }
    return sum;
  }

  public getTotalVertices(): number {
    let sum = 0;
    for (const node of this.nodes.values()) {
      if (node.visible && node.mesh) {
        sum += node.mesh.vertexCount;
      }
    }
    return sum;
  }
}

