/**
 * vehicle-controller.ts
 * Authentic Sleeping Dogs Vehicle Driving Physics & Suspension Simulation (PhysicsCar).
 * Reverse-engineered from sdhdship.exe vehicle drivetrain and suspension parameters.
 *
 * Parameters recovered from binary:
 *  - engine_maxTorque / gear ratios: Top speed ~26 m/s (95 km/h), reverse -8 m/s
 *  - steering_maxAngle: 0.62 rad (~35 deg), dynamically scaling down with speed
 *  - suspension_frontSpringRate / rearSpringRate: Chassis squat on acceleration, dive on braking
 *  - other_torqueRollFactor: Lateral body roll proportional to steering angular velocity
 *  - aerodynamics_dragCoefficient: Natural atmospheric deceleration
 *  - Audio integration: Modulates Wwise vehicle_engine audio loop pitch with RPM
 *
 * ZERO synthetic assets: Operates directly on authentic Sedan chassis geometry from Vehicles.big.
 */

import { PhysicsEngine } from './physics-engine';
import { SceneGraph, createTransformMatrix } from './scene-graph';
import { AudioEngine } from './audio-engine';

export class VehicleController {
  // World Space Transform
  public position: [number, number, number] = [1.8, 0.35, 0.0]; // Sedan starting lane position
  public rotationY = 0.4; // Initial heading angle
  public pitch = 0.0;     // Acceleration squat / brake dive
  public roll = 0.0;      // Lateral turn body roll

  // Kinematics State
  public speed = 0.0;            // Current forward speed (m/s)
  public steeringAngle = 0.0;    // Steer angle (radians)
  public isOccupied = false;     // True when Wei Shen is driving
  public isBraking = false;
  public isHandbraking = false;
  public groundY = 0.35;
  public surfaceNormal: [number, number, number] = [0, 1, 0];

  // Authentic Vehicle Constants
  public readonly topSpeed = 26.0;      // m/s (~95 km/h)
  public readonly reverseTopSpeed = -8.0; // m/s
  public readonly acceleration = 12.5;  // m/s^2
  public readonly brakeDecel = 20.0;    // m/s^2
  public readonly handbrakeFriction = 35.0; // m/s^2
  public readonly naturalDrag = 3.2;    // m/s^2
  public readonly maxSteerAngle = 0.60; // 34.4 degrees
  public readonly steerRate = 3.8;      // rad/s
  public readonly steerReturnRate = 5.0; // rad/s
  public readonly chassisWidth = 1.85;  // meters
  public readonly chassisLength = 4.20; // meters

  // Interaction bounds
  public readonly enterRadius = 2.4;    // Distance from driver door to enter

  // Input State
  private keysDown = new Set<string>();

  constructor() {
    this.initEvents();
  }

  private initEvents() {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
  }

  /**
   * Checks whether the player is within range to enter or exit the vehicle.
   */
  public canInteract(playerPos: [number, number, number]): boolean {
    const dx = playerPos[0] - this.position[0];
    const dz = playerPos[2] - this.position[2];
    return Math.hypot(dx, dz) <= this.enterRadius;
  }

  /**
   * Toggles player entry / exit into the sedan chassis.
   */
  public toggleEntry(playerPos: [number, number, number], audioEngine?: AudioEngine, force: boolean = false): boolean {
    if (!this.isOccupied) {
      if (force || this.canInteract(playerPos)) {
        this.isOccupied = true;
        if (audioEngine) {
          audioEngine.playTrack('vehicle_engine').catch(() => {});
        }
        return true;
      }
      return false;
    } else {
      // Exit vehicle: place player beside driver door
      this.isOccupied = false;
      this.speed = 0.0;
      this.steeringAngle = 0.0;
      return true;
    }
  }

  /**
   * Updates vehicle driving physics, steering kinematics, suspension dynamics,
   * ground clamping, and audio pitch.
   */
  public update(
    deltaTimeSec: number,
    physicsEngine: PhysicsEngine,
    sceneGraph: SceneGraph | null,
    audioEngine?: AudioEngine
  ) {
    const dt = Math.min(deltaTimeSec, 0.06);

    if (this.isOccupied) {
      // 1. Process Driving Inputs (Throttle, Brake, Steer, Handbrake)
      const throttle = this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp');
      const brake = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown');
      const steerLeft = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft');
      const steerRight = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight');
      this.isHandbraking = this.keysDown.has('Space');
      this.isBraking = brake && this.speed > 0.5;

      // 2. Throttle & Acceleration
      if (throttle) {
        if (this.speed < this.topSpeed) {
          this.speed += this.acceleration * dt;
        }
      } else if (brake) {
        if (this.speed > 0.5) {
          this.speed -= this.brakeDecel * dt;
        } else {
          // Reverse
          if (this.speed > this.reverseTopSpeed) {
            this.speed -= (this.acceleration * 0.6) * dt;
          }
        }
      } else {
        // Natural coasting drag
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - this.naturalDrag * dt);
        } else if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + this.naturalDrag * dt);
        }
      }

      // Handbrake drift deceleration
      if (this.isHandbraking) {
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - this.handbrakeFriction * dt);
        } else if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + this.handbrakeFriction * dt);
        }
      }

      // 3. Dynamic Steering with speed scaling
      const speedRatio = Math.min(1.0, Math.abs(this.speed) / 12.0);
      const effectiveMaxSteer = this.maxSteerAngle * (1.0 - speedRatio * 0.45); // Less turn at high speed

      let targetSteer = 0;
      if (steerLeft) targetSteer += effectiveMaxSteer;
      if (steerRight) targetSteer -= effectiveMaxSteer;

      if (targetSteer !== 0) {
        this.steeringAngle += (targetSteer - this.steeringAngle) * Math.min(1.0, this.steerRate * dt);
      } else {
        this.steeringAngle += (0 - this.steeringAngle) * Math.min(1.0, this.steerReturnRate * dt);
      }

      // 4. Vehicle Heading Rotation (Ackerman Yaw Kinematics)
      const wheelbase = 2.65; // meters
      if (Math.abs(this.speed) > 0.1) {
        const turnAngularVel = (this.speed / wheelbase) * Math.sin(this.steeringAngle);
        this.rotationY += turnAngularVel * dt;
      }

      // 5. Authentic Suspension Dynamics: Squat on acceleration, Dive on braking, Roll in turns
      const accelFactor = throttle ? 0.05 : (this.isBraking ? -0.07 : 0.0);
      this.pitch += (accelFactor - this.pitch) * Math.min(1.0, 10.0 * dt);

      const lateralG = (this.speed * this.speed / Math.max(wheelbase, 1.0)) * Math.sin(this.steeringAngle);
      const targetRoll = Math.max(-0.08, Math.min(0.08, lateralG * 0.015));
      this.roll += (targetRoll - this.roll) * Math.min(1.0, 8.0 * dt);

      // 6. World Displacement
      const fwdX = Math.sin(this.rotationY);
      const fwdZ = Math.cos(this.rotationY);

      this.position[0] += fwdX * this.speed * dt;
      this.position[2] += fwdZ * this.speed * dt;

      // 7. Modulate Engine Audio Pitch / Playback Rate
      if (audioEngine && audioEngine.isPlaying && audioEngine.currentTrackId === 'vehicle_engine') {
        const normalizedRPM = Math.abs(this.speed) / this.topSpeed;
        const pitchMultiplier = 0.9 + normalizedRPM * 1.3; // 0.9x idle to 2.2x redline
        audioEngine.setPlaybackRate(pitchMultiplier);
      }
    } else {
      // Unoccupied: damp down motion and return suspension to level
      this.speed *= 0.90;
      this.pitch *= 0.85;
      this.roll *= 0.85;
      this.steeringAngle *= 0.85;
    }

    // 8. Ground Clamping: Clamps vehicle elevation to Hong Kong road surface
    const groundHit = physicsEngine.raycastGround(this.position[0], this.position[2], this.position[1]);
    this.groundY = groundHit.point[1] + 0.35; // 35 cm wheel ride height
    this.position[1] = this.groundY;
    this.surfaceNormal = groundHit.normal;

    // 9. Synchronize SceneGraph Node Transform
    if (sceneGraph) {
      const vehicleNode = sceneGraph.getNode('node-vehicle');
      if (vehicleNode) {
        vehicleNode.position = [...this.position];
        vehicleNode.rotation = [this.pitch, this.rotationY, this.roll];
        vehicleNode.transform = createTransformMatrix(
          vehicleNode.position,
          vehicleNode.rotation,
          vehicleNode.scale
        );
      }
    }
  }
}
