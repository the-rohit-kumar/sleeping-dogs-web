/**
 * crowd-system.ts
 * Milestone 7B & Gameplay Phase 1: Authentic NPC Pedestrian Crowd Variety & Reactive Brawler AI.
 *
 * Streams authentic character models directly from Characters.big and populates
 * Hong Kong sidewalks with Triad enforcers, street vendors, and urban pedestrians.
 *
 * Implements:
 *  - Character model variety (Triad Enforcer, Street Vendor, HK Citizen, Sun On Yee Gangster)
 *  - Active Triad Brawler AI: Attack windup, red counter warning flash, counter reversals
 *  - Reactive panic / defensive stagger upon vehicle approach or combat
 *  - Melee lock-on compatibility with CombatSystem
 *
 * ZERO synthetic assets: All character models decoded from Sleeping Dogs Characters.big.
 */

import { DecodedMesh, parseIllusionBuffer } from './mesh-decoder';
import { fetchRange } from './asset-loader';
import { DecodedTexture } from './texture-decoder';
import { SceneGraph, SceneNode, createTransformMatrix } from './scene-graph';
import { AudioEngine } from './audio-engine';

export interface CrowdCharacterType {
  id: string;
  name: string;
  uid: number;
  offset: number;
  span: number;
  role: 'triad' | 'vendor' | 'citizen';
  color: [number, number, number];
  height: number;
}

export const AUTHENTIC_CROWD_CATALOG: CrowdCharacterType[] = [
  {
    id: 'triad-enforcer',
    name: '18K Triad Enforcer (Characters.big 0x00882829)',
    uid: 0x00882829,
    offset: 0x08770000,
    span: 25072,
    role: 'triad',
    color: [0.18, 0.18, 0.22], // Jet black leather jacket
    height: 1.88
  },
  {
    id: 'night-vendor',
    name: 'Night Market Food Vendor (Characters.big 0x01bf39f3)',
    uid: 0x01bf39f3,
    offset: 0x15d0e000,
    span: 10672,
    role: 'vendor',
    color: [0.85, 0.45, 0.15], // Hong Kong market apron orange
    height: 1.72
  },
  {
    id: 'hk-citizen',
    name: 'North Point Pedestrian (Characters.big 0x01ede6c8)',
    uid: 0x01ede6c8,
    offset: 0x16317400,
    span: 21840,
    role: 'citizen',
    color: [0.25, 0.55, 0.75], // Denim blue
    height: 1.78
  },
  {
    id: 'sun-on-yee',
    name: 'Sun On Yee Gangster (Characters.big 0x020e44c8)',
    uid: 0x020e44c8,
    offset: 0x15c4e000,
    span: 23200,
    role: 'triad',
    color: [0.72, 0.15, 0.20], // Crimson Triad red
    height: 1.82
  }
];

export type NPCCombatState = 'idle' | 'walking' | 'talking' | 'panicked' | 'staggered' | 'circling' | 'windup' | 'countered' | 'knocked_out';

export interface CrowdNPCInstance {
  id: string;
  type: CrowdCharacterType;
  mesh: DecodedMesh;
  position: [number, number, number];
  rotationY: number;
  state: NPCCombatState;
  walkDirZ: number;
  sidewalkX: number;
  minZ: number;
  maxZ: number;
  walkSpeed: number;
  staggerTimer: number;
  health: number;
  maxHealth: number;
  nodeId: string;

  // Brawler AI & Sleeping Dogs Counter System
  isHostile: boolean;
  attackCooldown: number;
  windupTimer: number;
  isCounterable: boolean;
  defeated: boolean;
  baseColor: [number, number, number];
}

export class CrowdSystem {
  private characterMeshes = new Map<string, DecodedMesh>();
  public npcs: CrowdNPCInstance[] = [];
  public crowdEnabled = true;
  private clothingTexture?: DecodedTexture;
  public onPlayerDamaged?: (damage: number) => void;
  public onEnemyDefeated?: (npc: CrowdNPCInstance) => void;

  /**
   * Initializes the crowd system by prefetching models from Characters.big
   */
  public async init(sceneGraph: SceneGraph, clothingTexture?: DecodedTexture): Promise<void> {
    this.clothingTexture = clothingTexture;

    // 1. Preload authentic character meshes from Characters.big
    for (const cType of AUTHENTIC_CROWD_CATALOG) {
      try {
        const raw = await fetchRange('Characters', cType.offset, cType.span);
        const mesh = parseIllusionBuffer(raw, cType.name);
        if (mesh) {
          this.characterMeshes.set(cType.id, mesh);
        }
      } catch (err) {
        console.warn(`[CrowdSystem] Failed to load character ${cType.id}:`, err);
      }
    }

    // 2. Spawn authentic crowd instances on sidewalks
    this.spawnCrowdNPCs(sceneGraph);
  }

  public async initCrowd(sceneGraph: SceneGraph, clothingTexture?: DecodedTexture): Promise<void> {
    return this.init(sceneGraph, clothingTexture);
  }

  /**
   * Spawns diverse NPCs along the sidewalks with active 18K Triad ambush brawlers
   */
  private spawnCrowdNPCs(sceneGraph: SceneGraph): void {
    const crowdSpawns = [
      // Ambush Thugs (Active Brawlers near player starting position [-2.2, 0.0, 1.2])
      { typeId: 'triad-enforcer', sidewalkX: -4.5, z:  3.5, dirZ: -1, minZ: -4.0, maxZ: 8.0, state: 'circling' as const, hostile: true },
      { typeId: 'sun-on-yee',    sidewalkX: -3.8, z: -3.2, dirZ:  1, minZ: -8.0, maxZ: 2.0, state: 'circling' as const, hostile: true },
      { typeId: 'triad-enforcer', sidewalkX: -5.5, z: -10.0, dirZ: 1, minZ: -18.0, maxZ: -4.0, state: 'circling' as const, hostile: true },
      { typeId: 'sun-on-yee',    sidewalkX:  4.2, z:  0.0, dirZ: -1, minZ: -6.0, maxZ: 6.0, state: 'circling' as const, hostile: true },

      // Civilians & Market Vendors
      { typeId: 'night-vendor',  sidewalkX: -6.8, z:  8.0, dirZ: -1, minZ:  4.0, maxZ: 14.0, state: 'talking' as const, hostile: false },
      { typeId: 'hk-citizen',    sidewalkX: -6.8, z: 22.0, dirZ: -1, minZ: 10.0, maxZ: 35.0, state: 'walking' as const, hostile: false },
      { typeId: 'hk-citizen',    sidewalkX:  6.8, z: -20.0, dirZ:  1, minZ: -30.0, maxZ: -10.0, state: 'walking' as const, hostile: false },
      { typeId: 'night-vendor',  sidewalkX:  6.8, z: 15.0, dirZ:  1, minZ:  8.0, maxZ: 24.0, state: 'talking' as const, hostile: false }
    ];

    crowdSpawns.forEach((cfg, idx) => {
      const cType = AUTHENTIC_CROWD_CATALOG.find(t => t.id === cfg.typeId);
      const mesh = this.characterMeshes.get(cfg.typeId);
      if (!cType || !mesh) return;

      const instId = `crowd-npc-${idx}`;
      const nodeId = `node-${instId}`;
      const rotY = cfg.dirZ > 0 ? 0 : Math.PI;

      const instance: CrowdNPCInstance = {
        id: instId,
        type: cType,
        mesh,
        position: [cfg.sidewalkX, 0.28, cfg.z],
        rotationY: rotY,
        state: cfg.state,
        walkDirZ: cfg.dirZ,
        sidewalkX: cfg.sidewalkX,
        minZ: cfg.minZ,
        maxZ: cfg.maxZ,
        walkSpeed: 1.35 + (idx % 3) * 0.25,
        staggerTimer: 0.0,
        health: cfg.hostile ? 80.0 : 50.0,
        maxHealth: cfg.hostile ? 80.0 : 50.0,
        nodeId,
        isHostile: cfg.hostile,
        attackCooldown: 1.8 + Math.random() * 2.2,
        windupTimer: 0.0,
        isCounterable: false,
        defeated: false,
        baseColor: [...cType.color]
      };

      const sceneNode: SceneNode = {
        id: nodeId,
        name: `${cType.name} [${cfg.hostile ? '18K Brawler' : 'Crowd'} #${idx + 1}]`,
        mesh,
        texture: this.clothingTexture,
        position: instance.position,
        rotation: [0, rotY, 0],
        scale: [1, 1, 1],
        color: cType.color,
        visible: true,
        transform: createTransformMatrix(instance.position, [0, rotY, 0], [1, 1, 1])
      };

      sceneGraph.addNode(sceneNode);
      this.npcs.push(instance);
    });
  }

  /**
   * Updates crowd locomotion, active brawler combat AI, red-flash windups, and ragdoll knockouts
   */
  public update(
    deltaTimeSec: number,
    sceneGraph: SceneGraph,
    playerPos: [number, number, number],
    isPlayerDriving: boolean,
    audioEngine?: AudioEngine
  ): void {
    if (!this.crowdEnabled) return;

    for (const npc of this.npcs) {
      if (npc.defeated) {
        // Keep knocked-out thugs on the ground
        const node = sceneGraph.getNode(npc.nodeId);
        if (node) {
          node.rotation = [Math.PI / 2, npc.rotationY, 0]; // Lying flat on ground
          node.position = [npc.position[0], 0.12, npc.position[2]];
          node.color = [0.25, 0.25, 0.28];
          node.transform = createTransformMatrix(node.position, node.rotation, [1, 1, 1]);
        }
        continue;
      }

      const dx = playerPos[0] - npc.position[0];
      const dz = playerPos[2] - npc.position[2];
      const distToPlayer = Math.hypot(dx, dz);

      // -------------------------------------------------------------
      // 1. Hostile 18K Triad Brawler AI
      // -------------------------------------------------------------
      if (npc.isHostile && !isPlayerDriving) {
        if (npc.state === 'countered') {
          npc.staggerTimer -= deltaTimeSec;
          // Flung back on the pavement
          npc.position[0] -= Math.sin(npc.rotationY) * 2.5 * deltaTimeSec;
          npc.position[2] -= Math.cos(npc.rotationY) * 2.5 * deltaTimeSec;

          if (npc.staggerTimer <= 0) {
            if (npc.health <= 0) {
              this.knockOutNPC(npc, audioEngine);
            } else {
              npc.state = 'circling';
              npc.attackCooldown = 2.0 + Math.random() * 2.0;
            }
          }
        } else if (npc.state === 'staggered') {
          npc.staggerTimer -= deltaTimeSec;
          if (npc.staggerTimer <= 0) {
            if (npc.health <= 0) {
              this.knockOutNPC(npc, audioEngine);
            } else {
              npc.state = 'circling';
              npc.attackCooldown = 1.5 + Math.random() * 1.5;
            }
          }
        } else if (npc.state === 'windup') {
          // Attacking windup (THE SLEEPING DOGS COUNTER WINDOW)
          npc.windupTimer -= deltaTimeSec;
          npc.isCounterable = true;

          // Pulse glowing red to signal counter opportunity
          const pulse = 1.5 + Math.sin(performance.now() * 0.025) * 1.5;
          const node = sceneGraph.getNode(npc.nodeId);
          if (node) {
            node.color = [3.2 * pulse, 0.12, 0.12];
          }

          // Step slightly forward during attack
          npc.position[0] += Math.sin(npc.rotationY) * 1.2 * deltaTimeSec;
          npc.position[2] += Math.cos(npc.rotationY) * 1.2 * deltaTimeSec;

          if (npc.windupTimer <= 0) {
            // Player missed the counter window: Attack lands!
            npc.isCounterable = false;
            npc.state = 'circling';
            npc.attackCooldown = 2.8 + Math.random() * 1.8;

            if (distToPlayer < 2.2) {
              if (this.onPlayerDamaged) this.onPlayerDamaged(15);
              if (audioEngine) audioEngine.playTrack('combat_strike').catch(() => {});
            }

            if (node) node.color = [...npc.baseColor];
          }
        } else if (npc.state === 'circling') {
          // Face the player
          npc.rotationY = Math.atan2(dx, dz);
          npc.isCounterable = false;

          const node = sceneGraph.getNode(npc.nodeId);
          if (node) node.color = [...npc.baseColor];

          // Circle around Wei Shen
          const idealDist = 2.4;
          const distDiff = distToPlayer - idealDist;
          const approachSpeed = Math.min(2.0, Math.max(-1.5, distDiff * 1.8));

          // Forward/back approach
          npc.position[0] += (dx / distToPlayer) * approachSpeed * deltaTimeSec;
          npc.position[2] += (dz / distToPlayer) * approachSpeed * deltaTimeSec;

          // Lateral circle strafe
          const strafeX = -dz / distToPlayer;
          const strafeZ =  dx / distToPlayer;
          npc.position[0] += strafeX * 0.9 * deltaTimeSec;
          npc.position[2] += strafeZ * 0.9 * deltaTimeSec;

          npc.attackCooldown -= deltaTimeSec;
          if (npc.attackCooldown <= 0 && distToPlayer <= 2.6) {
            // Initiate attack windup!
            npc.state = 'windup';
            npc.windupTimer = 0.70; // 700ms authentic counter window
            npc.isCounterable = true;
          }
        } else {
          // If alerted, engage in fight
          if (distToPlayer < 7.0) {
            npc.state = 'circling';
            npc.attackCooldown = 1.0 + Math.random() * 1.5;
          }
        }
      }

      // -------------------------------------------------------------
      // 2. Civilian / Vendor reactive AI
      // -------------------------------------------------------------
      if (!npc.isHostile) {
        if (npc.staggerTimer > 0) {
          npc.staggerTimer -= deltaTimeSec;
          if (npc.staggerTimer <= 0) {
            npc.state = 'panicked';
          }
        } else if (npc.state === 'walking') {
          npc.position[2] += npc.walkDirZ * npc.walkSpeed * deltaTimeSec;

          if (npc.position[2] > npc.maxZ) {
            npc.walkDirZ = -1;
            npc.rotationY = Math.PI;
          } else if (npc.position[2] < npc.minZ) {
            npc.walkDirZ = 1;
            npc.rotationY = 0.0;
          }

          if (distToPlayer < 3.2 && !isPlayerDriving) {
            npc.state = 'panicked';
          }
        } else if (npc.state === 'panicked') {
          const fleeDirZ = npc.position[2] > playerPos[2] ? 1 : -1;
          npc.position[2] += fleeDirZ * 3.5 * deltaTimeSec;
          npc.rotationY = fleeDirZ > 0 ? 0 : Math.PI;

          if (distToPlayer > 12.0) {
            npc.state = 'walking';
          }
        }
      }

      // Sync transform to SceneGraph
      const node = sceneGraph.getNode(npc.nodeId);
      if (node) {
        node.position = [...npc.position];
        node.transform = createTransformMatrix(node.position, [0, npc.rotationY, 0], [1, 1, 1]);
      }
    }
  }

  /**
   * Knocks out an NPC completely
   */
  private knockOutNPC(npc: CrowdNPCInstance, audioEngine?: AudioEngine): void {
    npc.state = 'knocked_out';
    npc.defeated = true;
    npc.isCounterable = false;
    if (audioEngine) {
      audioEngine.playTrack('hk_dialogue').catch(() => {});
    }
    if (this.onEnemyDefeated) {
      this.onEnemyDefeated(npc);
    }
  }

  /**
   * Returns any hostile brawler currently in their attack windup within counter range
   */
  public getCounterableAttacker(playerPos: [number, number, number], maxDist = 3.4): CrowdNPCInstance | null {
    for (const npc of this.npcs) {
      if (npc.isHostile && npc.state === 'windup' && npc.isCounterable && !npc.defeated) {
        const dist = Math.hypot(npc.position[0] - playerPos[0], npc.position[2] - playerPos[2]);
        if (dist <= maxDist) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * Executes the signature Sleeping Dogs counter reversal
   */
  public applyCounterReversal(npcId: string, playerPos: [number, number, number], audioEngine?: AudioEngine): { success: boolean; damage: number } {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return { success: false, damage: 0 };

    const damage = 45; // Brutal reversal counter damage
    npc.health -= damage;
    npc.state = 'countered';
    npc.staggerTimer = 1.4; // Ground stun
    npc.isCounterable = false;

    // Face player
    npc.rotationY = Math.atan2(playerPos[0] - npc.position[0], playerPos[2] - npc.position[2]);

    if (audioEngine) {
      audioEngine.playTrack('combat_strike').catch(() => {});
    }

    if (npc.health <= 0) {
      this.knockOutNPC(npc, audioEngine);
    }

    return { success: true, damage };
  }

  /**
   * Applies melee damage & knockback from Wei Shen's martial arts combos
   */
  public applyCombatHit(npcId: string, damage: number, knockbackDir: [number, number, number], audioEngine?: AudioEngine): void {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc || npc.defeated) return;

    npc.health -= damage;
    npc.state = 'staggered';
    npc.staggerTimer = 0.85;
    npc.isCounterable = false;

    // Push back physically
    npc.position[0] += knockbackDir[0] * 0.75;
    npc.position[2] += knockbackDir[2] * 0.75;

    if (audioEngine) {
      audioEngine.playTrack('combat_strike').catch(() => {});
    }

    if (npc.health <= 0) {
      this.knockOutNPC(npc, audioEngine);
    }
  }

  /**
   * Finds closest combat target for Wei Shen's soft lock-on
   */
  public findClosestCombatTarget(playerPos: [number, number, number], maxDist = 3.2): CrowdNPCInstance | null {
    let closest: CrowdNPCInstance | null = null;
    let closestDist = maxDist;

    for (const npc of this.npcs) {
      if (npc.defeated) continue;
      const dist = Math.hypot(npc.position[0] - playerPos[0], npc.position[2] - playerPos[2]);
      if (dist < closestDist) {
        closestDist = dist;
        closest = npc;
      }
    }

    return closest;
  }
}
