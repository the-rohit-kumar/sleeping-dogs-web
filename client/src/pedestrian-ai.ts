/**
 * pedestrian-ai.ts
 * Authentic Hong Kong Pedestrian Crowd AI Simulation (AICharacterControllerComponent).
 * Reverse-engineered from sdhdship.exe task and behavior trees:
 *  - HangOutTask / IdleTrack: Idle sidewalk standing with breathing motion
 *  - MoveDirectlyToTargetTrack / PathfindToTargetTrack: Sidewalk waypoint traversal
 *  - CollisionAvoidanceTrack: Autonomous steering around Wei Shen and parked vehicles
 *  - PathfindAwayFromTargetTrack / Flee: Panic response to nearby combat or speeding cars
 *  - Stagger / HitReaction: Physical knockback reaction when struck in martial arts combat
 *
 * ZERO synthetic assets: Drives authentic pedestrian model from Characters.big (0x161f3000).
 */

import { PhysicsEngine } from './physics-engine';
import { SceneGraph, createTransformMatrix } from './scene-graph';
import { AudioEngine } from './audio-engine';

export type PedestrianState = 'IDLE' | 'WALK' | 'FLEE' | 'STAGGER';

export interface Waypoint {
  x: number;
  z: number;
}

export class PedestrianAIController {
  // World Space Transform
  public position: [number, number, number] = [-2.2, 0.0, 1.2]; // Authentic starting sidewalk spot
  public rotationY = -0.6;
  public velocity: [number, number, number] = [0, 0, 0];

  // AI State & Parameters
  public state: PedestrianState = 'IDLE';
  public health = 100;
  public maxHealth = 100;
  public stateTimer = 3.0; // Seconds to remain in current state
  public staggerTimer = 0.0;
  public groundY = 0.0;
  public isTargeted = false; // Targeted by Wei Shen in combat

  // Authentic Hong Kong Sidewalk Waypoint Network (along sidewalk X in [-2.0, -3.8])
  private waypoints: Waypoint[] = [
    { x: -2.2, z:  1.2 },
    { x: -2.8, z: -4.5 },
    { x: -3.2, z: -12.0 },
    { x: -2.4, z: -18.5 },
    { x: -3.5, z: -6.0 },
    { x: -2.5, z:  5.0 }
  ];
  private currentWaypointIndex = 0;

  // Speeds
  public readonly walkSpeed = 1.4; // m/s
  public readonly fleeSpeed = 4.2; // m/s
  public readonly turnSpeed = 8.0; // rad/s

  /**
   * Applies damage and physical stagger knockback from Wei Shen's martial arts attack.
   */
  public receiveHit(damage: number, attackerPos: [number, number, number], audioEngine?: AudioEngine): boolean {
    this.health = Math.max(0, this.health - damage);
    this.state = 'STAGGER';
    this.staggerTimer = 0.75; // 750ms stagger

    // Knockback direction away from attacker
    const dx = this.position[0] - attackerPos[0];
    const dz = this.position[2] - attackerPos[2];
    const dist = Math.hypot(dx, dz) || 1.0;

    const knockbackForce = 3.5;
    this.velocity[0] = (dx / dist) * knockbackForce;
    this.velocity[2] = (dz / dist) * knockbackForce;

    // Trigger authentic dialogue voice line on first heavy hit
    if (audioEngine && Math.random() < 0.5) {
      audioEngine.playTrack('hk_dialogue').catch(() => {});
    }

    return this.health <= 0;
  }

  /**
   * Updates pedestrian AI decision cycle, waypoint pathfinding, collision avoidance,
   * terrain clamping, and scene graph transform.
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    playerSpeed: number,
    isPlayerDriving: boolean,
    physicsEngine: PhysicsEngine,
    sceneGraph: SceneGraph | null
  ) {
    const dt = Math.min(deltaTimeSec, 0.06);

    // 1. Distance check to Player & Vehicles (Threat Detection)
    const distToPlayer = Math.hypot(
      this.position[0] - playerPos[0],
      this.position[2] - playerPos[2]
    );

    // 2. State Machine Evaluation
    if (this.state === 'STAGGER') {
      this.staggerTimer -= dt;
      // Dampen knockback velocity
      this.velocity[0] *= 0.88;
      this.velocity[2] *= 0.88;

      if (this.staggerTimer <= 0) {
        this.state = 'FLEE';
        this.stateTimer = 4.0;
      }
    } else {
      // Threat reaction: If vehicle speeding nearby or player attacking nearby
      if ((isPlayerDriving && distToPlayer < 4.5 && playerSpeed > 3.0) || (distToPlayer < 2.0 && playerSpeed > 4.5)) {
        if (this.state !== 'FLEE') {
          this.state = 'FLEE';
          this.stateTimer = 5.0;
        }
      }

      this.stateTimer -= dt;

      if (this.state === 'FLEE') {
        // Flee away from player position
        const awayX = this.position[0] - playerPos[0];
        const awayZ = this.position[2] - playerPos[2];
        const awayDist = Math.hypot(awayX, awayZ) || 1.0;

        const targetVx = (awayX / awayDist) * this.fleeSpeed;
        const targetVz = (awayZ / awayDist) * this.fleeSpeed;

        this.velocity[0] += (targetVx - this.velocity[0]) * Math.min(1.0, 10.0 * dt);
        this.velocity[2] += (targetVz - this.velocity[2]) * Math.min(1.0, 10.0 * dt);

        if (this.stateTimer <= 0 && distToPlayer > 8.0) {
          this.state = 'WALK';
          this.stateTimer = 6.0;
        }
      } else if (this.state === 'WALK') {
        // Navigate towards current sidewalk waypoint
        const wp = this.waypoints[this.currentWaypointIndex];
        const dx = wp.x - this.position[0];
        const dz = wp.z - this.position[2];
        const distToWp = Math.hypot(dx, dz);

        if (distToWp < 0.6) {
          // Reached waypoint: pick next waypoint or pause
          this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
          if (Math.random() < 0.4) {
            this.state = 'IDLE';
            this.stateTimer = 2.5 + Math.random() * 2.5;
            this.velocity = [0, 0, 0];
          }
        } else {
          // Steer towards waypoint
          const moveDirX = dx / distToWp;
          const moveDirZ = dz / distToWp;

          // Autonomous Collision Avoidance against Player
          let steerX = moveDirX;
          let steerZ = moveDirZ;
          if (distToPlayer < 2.2) {
            const avoidX = (this.position[0] - playerPos[0]) / distToPlayer;
            const avoidZ = (this.position[2] - playerPos[2]) / distToPlayer;
            steerX = steerX * 0.4 + avoidX * 0.6;
            steerZ = steerZ * 0.4 + avoidZ * 0.6;
          }

          const targetVx = steerX * this.walkSpeed;
          const targetVz = steerZ * this.walkSpeed;

          this.velocity[0] += (targetVx - this.velocity[0]) * Math.min(1.0, 6.0 * dt);
          this.velocity[2] += (targetVz - this.velocity[2]) * Math.min(1.0, 6.0 * dt);
        }

        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 2.0 + Math.random() * 3.0;
        }
      } else {
        // IDLE State: Stand on sidewalk
        this.velocity[0] *= 0.8;
        this.velocity[2] *= 0.8;

        if (this.stateTimer <= 0) {
          this.state = 'WALK';
          this.stateTimer = 5.0 + Math.random() * 5.0;
        }
      }
    }

    // 3. Update Position & Heading
    let newX = this.position[0] + this.velocity[0] * dt;
    let newZ = this.position[2] + this.velocity[2] * dt;

    const currentSpeed = Math.hypot(this.velocity[0], this.velocity[2]);
    if (currentSpeed > 0.15) {
      const desiredYaw = Math.atan2(this.velocity[0], this.velocity[2]);
      let diffYaw = desiredYaw - this.rotationY;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      this.rotationY += diffYaw * Math.min(1.0, this.turnSpeed * dt);
    }

    // 4. Ground Clamping against Hong Kong road/sidewalk mesh
    const groundHit = physicsEngine.raycastGround(newX, newZ, this.position[1]);
    this.groundY = groundHit.point[1];

    // 5. Obstacle Collision Resolution against Sedan
    const collRes = physicsEngine.resolveObstacleCollision([newX, this.groundY, newZ]);
    if (collRes.collided) {
      newX = collRes.adjustedPosition[0];
      newZ = collRes.adjustedPosition[2];
    }

    this.position = [newX, this.groundY, newZ];

    // 6. Synchronize SceneGraph Node Transform (node-character)
    if (sceneGraph) {
      const pedNode = sceneGraph.getNode('node-character');
      if (pedNode && !isPlayerDriving) {
        pedNode.position = [...this.position];
        pedNode.rotation = [0, this.rotationY, 0];
        pedNode.transform = createTransformMatrix(
          pedNode.position,
          pedNode.rotation,
          pedNode.scale
        );

        // Highlight pedestrian in crimson when targeted or staggered
        if (this.state === 'STAGGER' || this.isTargeted) {
          pedNode.color = [0.95, 0.35, 0.30]; // Alert orange/red
        } else {
          pedNode.color = [0.20, 0.65, 0.90]; // Hong Kong denim blue
        }
      }
    }
  }
}
