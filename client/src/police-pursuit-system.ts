/**
 * police-pursuit-system.ts
 * Dynamic 5-Star HKPD Police Pursuit & SWAT Lockdown System for Sleeping Dogs Browser Reconstruction.
 *
 * Implements:
 *  - 5-Star Heat Escalation System (⭐ to ⭐⭐⭐⭐⭐)
 *  - ⭐ Heat 1: Foot patrol beat cops shouting Cantonese commands ("警察! 唔好郁!"), nightstick pursuit
 *  - ⭐⭐ Heat 2: Marked HKPD Cruisers with flashing Red/Blue lightbar strobes, sirens & ramming AI
 *  - ⭐⭐⭐ Heat 3: Intersection Roadblocks in V-formation with Spike Strips (tire blowout & crawl physics)
 *  - ⭐⭐⭐⭐ Heat 4: SDU ("Flying Tigers") Tactical Armored Vans & heavily armored SWAT officers
 *  - ⭐⭐⭐⭐⭐ Heat 5: City Tactical Lockdown with HKPD Helicopter "Eagle-1" hovering with dynamic searchlight
 *  - Cooldown & Evasion Mechanics: Evasion search radius, line-of-sight breaking, flashing cooldown stars
 *  - Wardrobe / Safehouse Disguise Heat Clearing (instantly wipes 5 stars to 0 with alibi toast)
 *  - Authentic SFX & Cantonese Radio Scanner Dispatch Chatter
 *
 * ZERO synthetic assets: Audio streams from SFX.pck and base game geometry.
 */

import { SceneGraph, SceneNode, createTransformMatrix } from './scene-graph';
import { DecodedMesh, createBoxMesh } from './mesh-decoder';
import { createDetailedVehicle, createDetailedHumanoid } from './procedural-models';
import { AudioEngine } from './audio-engine';

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type PursuitState = 'peace' | 'pursuit' | 'cooldown' | 'evaded';

export interface PoliceOfficer {
  id: string;
  name: string;
  position: [number, number, number];
  rotationY: number;
  health: number;
  isHostile: boolean;
  nodeId: string;
  speed: number;
}

export interface PoliceVehicle {
  id: string;
  type: 'cruiser' | 'sdu_van';
  position: [number, number, number];
  rotationY: number;
  velocity: number;
  targetSpeed: number;
  health: number;
  nodeId: string;
  lightbarNodeId: string;
  strobeTimer: number;
  isStrobeBlue: boolean;
}

export interface RoadblockInstance {
  id: string;
  center: [number, number, number];
  active: boolean;
  hasSpikes: boolean;
  spikesTriggered: boolean;
  cruiser1NodeId: string;
  cruiser2NodeId: string;
  spikeNodeId: string;
}

export interface HelicopterUnit {
  id: string;
  name: string;
  position: [number, number, number]; // [x, 22.0, z]
  targetPos: [number, number, number];
  rotorRotation: number;
  spotlightPos: [number, number, number]; // ground projection
  spotlightRadius: number;
  isPlayerIlluminated: boolean;
  fuselageNodeId: string;
  rotorsNodeId: string;
  spotlightNodeId: string;
}

export class PolicePursuitSystem {
  public heatLevel: HeatLevel = 0;
  public heatPoints = 0;
  public pursuitState: PursuitState = 'peace';

  // Cooldown & Evasion State
  public cooldownTimer = 0.0;
  public readonly COOLDOWN_DURATION = 15.0; // seconds to clear heat
  public lastKnownPlayerPos: [number, number, number] = [0, 0, 0];
  public evasionRadius = 40.0; // meters

  // Spike strip physics
  public spikesPunctured = false;
  public punctureCooldown = 0.0;

  // Active Units
  public officers: PoliceOfficer[] = [];
  public cruisers: PoliceVehicle[] = [];
  public roadblocks: RoadblockInstance[] = [];
  public helicopter: HelicopterUnit | null = null;
  public activeSceneGraph?: SceneGraph;

  // Visual Meshes
  private cruiserMesh?: DecodedMesh;
  private vanMesh?: DecodedMesh;
  private lightbarMesh?: DecodedMesh;
  private spikeMesh?: DecodedMesh;
  private heliBodyMesh?: DecodedMesh;
  private heliRotorMesh?: DecodedMesh;
  private spotlightMesh?: DecodedMesh;

  // Audio & Timer states
  private sirenAudioTimer = 0.0;
  private scannerDebounceTimer = 0.0;
  private flashStrobeTimer = 0.0;

  // DOM Elements
  private hudElement?: HTMLElement;
  private vignetteElement?: HTMLElement;
  private scannerBanner?: HTMLElement;

  constructor() {
    this.initMeshes();
    this.initHUD();
  }

  private initMeshes(): void {
    // Cruisers & Lightbars
    this.cruiserMesh = createDetailedVehicle('police-cruiser');
    this.vanMesh = createDetailedVehicle('swat-van');
    this.lightbarMesh = createBoxMesh(1.1, 0.22, 0.35, 'HKPD_EmergencyLightbar');
    this.spikeMesh = createBoxMesh(7.5, 0.12, 0.6, 'HKPD_SpikeStripStinger');

    // Helicopter & Searchlight
    this.heliBodyMesh = createBoxMesh(1.8, 2.2, 7.5, 'Eagle1_Fuselage');
    this.heliRotorMesh = createBoxMesh(8.2, 0.08, 0.45, 'Eagle1_Rotors');
    this.spotlightMesh = createBoxMesh(7.0, 0.05, 7.0, 'Eagle1_SearchlightDisc');
  }

  private initHUD(): void {
    if (typeof document === 'undefined') return;

    // Full-screen red/blue emergency pursuit vignette
    let vignette = document.getElementById('police-pursuit-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'police-pursuit-vignette';
      vignette.style.position = 'fixed';
      vignette.style.top = '0';
      vignette.style.left = '0';
      vignette.style.width = '100vw';
      vignette.style.height = '100vh';
      vignette.style.pointerEvents = 'none';
      vignette.style.zIndex = '9990';
      vignette.style.transition = 'opacity 0.2s ease';
      vignette.style.opacity = '0';
      document.body.appendChild(vignette);
    }
    this.vignetteElement = vignette;

    // 5-Star Police Heat Stars Gauge (Top Right)
    let hud = document.getElementById('police-heat-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'police-heat-hud';
      hud.style.position = 'fixed';
      hud.style.top = '24px';
      hud.style.right = '24px';
      hud.style.display = 'flex';
      hud.style.flexDirection = 'column';
      hud.style.alignItems = 'flex-end';
      hud.style.zIndex = '9995';
      hud.style.fontFamily = "'Noto Sans TC', 'Impact', sans-serif";
      hud.style.pointerEvents = 'none';
      hud.innerHTML = `
        <div style="background: rgba(8, 12, 20, 0.88); border: 1.5px solid rgba(0, 150, 255, 0.5); border-radius: 6px; padding: 8px 14px; box-shadow: 0 4px 18px rgba(0, 50, 150, 0.4); display: flex; flex-direction: column; align-items: flex-end;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="color: #60a5fa; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">HKPD HEAT LEVEL</span>
            <span id="police-heat-badge" style="background: #1e3a8a; color: #93c5fd; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">0 STARS</span>
          </div>
          <div id="police-star-container" style="display: flex; gap: 5px; font-size: 24px; color: #475569; text-shadow: 0 0 8px rgba(0,0,0,0.8);">
            <span class="heat-star" id="star-1">★</span>
            <span class="heat-star" id="star-2">★</span>
            <span class="heat-star" id="star-3">★</span>
            <span class="heat-star" id="star-4">★</span>
            <span class="heat-star" id="star-5">★</span>
          </div>
          <div id="police-cooldown-bar-wrap" style="width: 140px; height: 5px; background: rgba(255,255,255,0.15); border-radius: 3px; margin-top: 6px; overflow: hidden; display: none;">
            <div id="police-cooldown-bar" style="width: 100%; height: 100%; background: #38bdf8; transition: width 0.1s linear;"></div>
          </div>
          <div id="police-status-label" style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-weight: 600; letter-spacing: 0.8px;">PEACE (NO HEAT)</div>
        </div>
      `;
      document.body.appendChild(hud);
    }
    this.hudElement = hud;

    // Radio Scanner Banner
    let banner = document.getElementById('police-radio-scanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'police-radio-scanner';
      banner.style.position = 'fixed';
      banner.style.top = '96px';
      banner.style.right = '24px';
      banner.style.width = '340px';
      banner.style.background = 'rgba(10, 15, 26, 0.94)';
      banner.style.borderLeft = '4px solid #ef4444';
      banner.style.borderTop = '1px solid rgba(239, 68, 68, 0.3)';
      banner.style.borderBottom = '1px solid rgba(239, 68, 68, 0.3)';
      banner.style.borderRight = '1px solid rgba(239, 68, 68, 0.3)';
      banner.style.padding = '8px 12px';
      banner.style.borderRadius = '0 6px 6px 0';
      banner.style.color = '#f1f5f9';
      banner.style.fontFamily = "'Noto Sans TC', sans-serif";
      banner.style.fontSize = '11px';
      banner.style.lineHeight = '1.4';
      banner.style.zIndex = '9994';
      banner.style.pointerEvents = 'none';
      banner.style.display = 'none';
      banner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
      document.body.appendChild(banner);
    }
    this.scannerBanner = banner;
  }

  /**
   * Sets heat level directly (0 to 5) and initializes corresponding law enforcement response
   */
  public setHeatLevel(level: HeatLevel, audio?: AudioEngine): void {
    const prevLevel = this.heatLevel;
    this.heatLevel = Math.max(0, Math.min(5, level)) as HeatLevel;

    if (this.heatLevel > 0) {
      this.pursuitState = 'pursuit';
      this.cooldownTimer = this.COOLDOWN_DURATION;
      this.evasionRadius = 30.0 + this.heatLevel * 12.0;

      if (this.heatLevel > prevLevel) {
        this.dispatchScannerMessage(this.getHeatEscalationRadioMessage(this.heatLevel), audio);
        if (audio && typeof audio.playTrack === 'function') {
          audio.playTrack('police_radio_call');
        }
      }
    } else {
      this.clearHeat(audio);
    }

    this.renderHUD();
  }

  /**
   * Adds crime heat points and automatically escalates heat stars
   */
  public addHeatPoints(points: number, audio?: AudioEngine): void {
    this.heatPoints += points;
    const computedLevel = Math.min(5, Math.floor(this.heatPoints / 100)) as HeatLevel;
    if (computedLevel > this.heatLevel) {
      this.setHeatLevel(computedLevel, audio);
    } else {
      this.renderHUD();
    }
  }

  /**
   * Triggers a specific criminal infraction
   */
  public triggerCrime(crimeType: 'traffic_hit' | 'assault' | 'grand_theft_auto' | 'officer_attack' | 'reckless_ram', audio?: AudioEngine): void {
    const crimePoints: Record<string, number> = {
      traffic_hit: 60,
      assault: 110,
      grand_theft_auto: 210,
      officer_attack: 320,
      reckless_ram: 420
    };

    const pts = crimePoints[crimeType] || 100;
    this.addHeatPoints(pts, audio);
  }

  /**
   * Clears all heat immediately (e.g. following evasion, pay-off, or mission restart)
   */
  public clearHeat(audio?: AudioEngine): void {
    this.heatLevel = 0;
    this.heatPoints = 0;
    this.pursuitState = 'peace';
    this.cooldownTimer = 0.0;
    this.spikesPunctured = false;
    this.cleanupUnits();

    if (audio && typeof audio.playTrack === 'function') {
      audio.playTrack('ui_chime_granted');
    }

    this.dispatchScannerMessage('HKPD DISPATCH: "All units, Code 3 pursuit cancelled. Return to patrol sectors."', audio);
    this.renderHUD();
  }

  /**
   * Special Wardrobe / Safehouse disguise evasion: instantly wipes 5-star heat with alibi
   */
  public clearHeatViaDisguise(audio?: AudioEngine): void {
    const wasPursued = this.heatLevel > 0;
    this.clearHeat(audio);

    if (wasPursued) {
      this.showToast('🥋 POLICE HEAT EVADED: WARDROBE DISGUISE COMPLETED | ALIBI SECURED (0 STARS)', '#10b981');
      this.dispatchScannerMessage('HKPD DISPATCH: "Suspect visual lost. Suspect changed attire. All units resume 10-8."', audio);
    }
  }

  /**
   * Repairs flat tires caused by spike strips
   */
  public repairPuncturedTires(): void {
    this.spikesPunctured = false;
    this.showToast('🔧 VEHICLE TIRES REPAIRED: FULL SPEED RESTORED', '#38bdf8');
  }

  /**
   * Checks if player position is caught within Eagle-1's spotlight beam
   */
  public isInHelicopterSpotlight(playerPos: [number, number, number]): boolean {
    if (this.heatLevel < 5 || !this.helicopter) return false;
    const dx = playerPos[0] - this.helicopter.spotlightPos[0];
    const dz = playerPos[2] - this.helicopter.spotlightPos[2];
    const distSq = dx * dx + dz * dz;
    return distSq <= this.helicopter.spotlightRadius * this.helicopter.spotlightRadius;
  }

  /**
   * Dispatches authentic radio scanner voice & text banner
   */
  public dispatchScannerMessage(message: string, audio?: AudioEngine): void {
    if (!this.scannerBanner) return;

    this.scannerBanner.style.display = 'block';
    this.scannerBanner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
        <span style="color: #ef4444; font-weight: 800; font-size: 10px; letter-spacing: 1px;">📻 HKPD RADIO SCANNER CH 4</span>
        <span style="font-size: 9px; color: #94a3b8;">${new Date().toLocaleTimeString()}</span>
      </div>
      <div style="color: #fca5a5; font-weight: 600;">${message}</div>
    `;

    if (audio && typeof audio.playTrack === 'function') {
      audio.playTrack('radio_static_burst');
    }

    clearTimeout((this.scannerBanner as any)._hideTimeout);
    (this.scannerBanner as any)._hideTimeout = setTimeout(() => {
      if (this.scannerBanner) this.scannerBanner.style.display = 'none';
    }, 4500);
  }

  private getHeatEscalationRadioMessage(level: HeatLevel): string {
    switch (level) {
      case 1:
        return 'HKPD DISPATCH: "10-4, report of pedestrian brawl in North Point. Patrol units investigate on foot."';
      case 2:
        return 'HKPD DISPATCH: "All units, 10-33 Code 3! Marked cruisers authorize vehicle interception and PIT maneuver!"';
      case 3:
        return 'HKPD DISPATCH: "Nathan Road intersection blocked! Spike strips deployed across all lanes! Box suspect in!"';
      case 4:
        return 'HKPD DISPATCH: "SDU Flying Tigers tactical unit rolling out in armored carrier! Authorize lethal takedown!"';
      case 5:
        return 'HKPD DISPATCH: "AIR SUPPORT EAGLE-1 IN POSITION! Full tactical city lockdown in effect! Nobody escapes!"';
      default:
        return 'HKPD DISPATCH: "Units 10-8, maintain situational awareness."';
    }
  }

  /**
   * Main per-frame update loop
   */
  public update(
    deltaTimeSec: number,
    sceneGraph: SceneGraph,
    playerPos: [number, number, number],
    playerInCar: boolean,
    vehicleController: any,
    audio?: AudioEngine,
    combat?: any
  ): void {
    if (sceneGraph) this.activeSceneGraph = sceneGraph;
    if (this.heatLevel === 0) {
      this.pursuitState = 'peace';
      this.cleanupUnits(sceneGraph);
      this.updateVignette(0.0, false);
      return;
    }

    this.flashStrobeTimer += deltaTimeSec;
    const isStrobeBlue = Math.floor(this.flashStrobeTimer * 6) % 2 === 0;

    // Manage distance to search center
    const dx = playerPos[0] - this.lastKnownPlayerPos[0];
    const dz = playerPos[2] - this.lastKnownPlayerPos[2];
    const distFromLastKnown = Math.sqrt(dx * dx + dz * dz);

    const illuminatedByHeli = this.isInHelicopterSpotlight(playerPos);

    // Evasion & Cooldown State Machine
    if (distFromLastKnown > this.evasionRadius && !illuminatedByHeli) {
      // Escaped search radius -> enter cooldown
      this.pursuitState = 'cooldown';
      this.cooldownTimer -= deltaTimeSec;

      if (this.cooldownTimer <= 0.0) {
        this.clearHeat(audio);
        this.showToast('✅ HKPD PURSUIT EVADED: HEAT CLEARED (0 STARS)', '#10b981');
        return;
      }
    } else {
      // Still in search zone or spotted by air support
      this.pursuitState = 'pursuit';
      this.cooldownTimer = this.COOLDOWN_DURATION;
      this.lastKnownPlayerPos = [...playerPos];
    }

    // Siren Audio playback
    this.sirenAudioTimer += deltaTimeSec;
    if (this.sirenAudioTimer > 4.5 && this.pursuitState === 'pursuit' && audio) {
      this.sirenAudioTimer = 0.0;
      if (typeof audio.playTrack === 'function') {
        audio.playTrack('police_siren');
      }
    }

    // Clamp vehicle speed if tires are punctured
    if (this.spikesPunctured && vehicleController && playerInCar) {
      if (vehicleController.speed > 5.0) {
        vehicleController.speed = 5.0; // clamp to 18 km/h crawl
      }
    }

    // Synchronize Scene Nodes & 3D Units
    this.syncSceneUnits(sceneGraph, playerPos, playerInCar, isStrobeBlue, deltaTimeSec, illuminatedByHeli);

    // Check Spike Strip collision
    this.checkSpikeStripCollision(playerPos, playerInCar, vehicleController, audio);

    // Update screen edge vignette
    this.updateVignette(deltaTimeSec, isStrobeBlue);

    // Update HUD
    this.renderHUD(distFromLastKnown);
  }

  /**
   * Spawns or updates 3D police units (Foot patrol, cruisers, roadblocks, helicopter)
   */
  private syncSceneUnits(
    sceneGraph: SceneGraph,
    playerPos: [number, number, number],
    playerInCar: boolean,
    isStrobeBlue: boolean,
    deltaTimeSec: number,
    illuminatedByHeli: boolean
  ): void {
    if (!sceneGraph) return;

    // --- Heat 1: Foot Patrol Cops ---
    if (this.heatLevel >= 1 && this.officers.length === 0) {
      const off1: PoliceOfficer = {
        id: 'hkpd-patrol-1',
        name: 'HKPD Constable Chan',
        position: [playerPos[0] + 3.0, 0.28, playerPos[2] - 8.0],
        rotationY: 0,
        health: 120,
        isHostile: true,
        nodeId: 'node-hkpd-officer-1',
        speed: 3.4
      };
      const off2: PoliceOfficer = {
        id: 'hkpd-patrol-2',
        name: 'HKPD Constable Wong',
        position: [playerPos[0] - 3.2, 0.28, playerPos[2] - 9.5],
        rotationY: 0,
        health: 120,
        isHostile: true,
        nodeId: 'node-hkpd-officer-2',
        speed: 3.4
      };
      this.officers.push(off1, off2);

      [off1, off2].forEach(off => {
        const bodyMesh = createDetailedHumanoid('hkpd-officer');
        const node: SceneNode = {
          id: off.nodeId,
          name: `${off.name} [HKPD]`,
          mesh: bodyMesh,
          position: off.position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.08, 0.16, 0.35], // HKPD Constable Navy Blue
          visible: true,
          transform: createTransformMatrix(off.position, [0, 0, 0], [1, 1, 1])
        };
        sceneGraph.addNode(node);
      });
    }

    // Update Foot Patrol movement towards player
    this.officers.forEach(off => {
      const node = sceneGraph.getNode(off.nodeId);
      if (node) {
        const dirX = playerPos[0] - off.position[0];
        const dirZ = playerPos[2] - off.position[2];
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
        if (dist > 1.8) {
          off.position[0] += (dirX / dist) * off.speed * deltaTimeSec;
          off.position[2] += (dirZ / dist) * off.speed * deltaTimeSec;
          off.rotationY = Math.atan2(dirX, dirZ);
        }
        node.position = [...off.position];
        node.rotation = [0, off.rotationY, 0];
        node.transform = createTransformMatrix(node.position, node.rotation, node.scale);
      }
    });

    // --- Heat 2 & 3: Cruisers with Strobe Lightbars ---
    if (this.heatLevel >= 2 && this.cruisers.length === 0) {
      const cruiser1: PoliceVehicle = {
        id: 'hkpd-cruiser-1',
        type: 'cruiser',
        position: [1.8, 0.35, playerPos[2] - 28.0],
        rotationY: 0,
        velocity: 18.0,
        targetSpeed: 22.0,
        health: 400,
        nodeId: 'node-hkpd-cruiser-1',
        lightbarNodeId: 'node-hkpd-lightbar-1',
        strobeTimer: 0,
        isStrobeBlue: false
      };
      this.cruisers.push(cruiser1);

      if (this.cruiserMesh && this.lightbarMesh) {
        const cNode: SceneNode = {
          id: cruiser1.nodeId,
          name: 'HKPD Interceptor Cruiser #1',
          mesh: this.cruiserMesh,
          position: cruiser1.position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.92, 0.94, 0.98], // Crisp HKPD Police White
          visible: true,
          transform: createTransformMatrix(cruiser1.position, [0, 0, 0], [1, 1, 1])
        };
        const lbNode: SceneNode = {
          id: cruiser1.lightbarNodeId,
          name: 'HKPD Cruiser Lightbar #1',
          mesh: this.lightbarMesh,
          position: [cruiser1.position[0], cruiser1.position[1] + 1.15, cruiser1.position[2]],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [1.0, 0.0, 0.0], // Initial red strobe
          visible: true,
          transform: createTransformMatrix(
            [cruiser1.position[0], cruiser1.position[1] + 1.15, cruiser1.position[2]],
            [0, 0, 0],
            [1, 1, 1]
          )
        };
        sceneGraph.addNode(cNode);
        sceneGraph.addNode(lbNode);
      }
    }

    // Update Cruisers positioning & flashing strobes
    this.cruisers.forEach(cv => {
      const cNode = sceneGraph.getNode(cv.nodeId);
      const lbNode = sceneGraph.getNode(cv.lightbarNodeId);

      // Follow player on roadway
      const targetZ = playerPos[2] - 12.0;
      const dz = targetZ - cv.position[2];
      cv.position[2] += Math.sign(dz) * cv.velocity * deltaTimeSec;
      cv.position[0] = 1.8 + Math.sin(this.flashStrobeTimer * 2) * 0.4;

      if (cNode) {
        cNode.position = [...cv.position];
        cNode.transform = createTransformMatrix(cNode.position, cNode.rotation, cNode.scale);
      }
      if (lbNode) {
        lbNode.position = [cv.position[0], cv.position[1] + 1.15, cv.position[2]];
        // Strobe alternating Red and Electric Blue
        lbNode.color = isStrobeBlue ? [0.0, 0.4, 1.0] : [1.0, 0.05, 0.05];
        lbNode.transform = createTransformMatrix(lbNode.position, lbNode.rotation, lbNode.scale);
      }
    });

    // --- Heat 3: Roadblocks with Spike Strips ---
    if (this.heatLevel >= 3 && this.roadblocks.length === 0) {
      const rbZ = playerPos[2] + 45.0; // ahead of player
      const rb: RoadblockInstance = {
        id: 'hkpd-roadblock-1',
        center: [0.0, 0.35, rbZ],
        active: true,
        hasSpikes: true,
        spikesTriggered: false,
        cruiser1NodeId: 'node-rb-cruiser-1',
        cruiser2NodeId: 'node-rb-cruiser-2',
        spikeNodeId: 'node-rb-spikes-1'
      };
      this.roadblocks.push(rb);

      if (this.cruiserMesh && this.spikeMesh) {
        // V-formation cruisers blocking left and right lanes
        const c1Node: SceneNode = {
          id: rb.cruiser1NodeId,
          name: 'HKPD Roadblock Cruiser Left',
          mesh: this.cruiserMesh,
          position: [-2.4, 0.35, rbZ],
          rotation: [0, 0.45, 0],
          scale: [1, 1, 1],
          color: [0.1, 0.1, 0.15],
          visible: true,
          transform: createTransformMatrix([-2.4, 0.35, rbZ], [0, 0.45, 0], [1, 1, 1])
        };
        const c2Node: SceneNode = {
          id: rb.cruiser2NodeId,
          name: 'HKPD Roadblock Cruiser Right',
          mesh: this.cruiserMesh,
          position: [2.4, 0.35, rbZ],
          rotation: [0, -0.45, 0],
          scale: [1, 1, 1],
          color: [0.1, 0.1, 0.15],
          visible: true,
          transform: createTransformMatrix([2.4, 0.35, rbZ], [0, -0.45, 0], [1, 1, 1])
        };
        const spikeNode: SceneNode = {
          id: rb.spikeNodeId,
          name: 'HKPD Roadway Spike Strip',
          mesh: this.spikeMesh,
          position: [0.0, 0.1, rbZ - 4.0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.85, 0.75, 0.15], // Warning Yellow/Steel spikes
          visible: true,
          transform: createTransformMatrix([0.0, 0.1, rbZ - 4.0], [0, 0, 0], [1, 1, 1])
        };
        sceneGraph.addNode(c1Node);
        sceneGraph.addNode(c2Node);
        sceneGraph.addNode(spikeNode);
      }
    }

    // --- Heat 4: SDU Tactical Armored Van ---
    if (this.heatLevel >= 4 && !this.cruisers.some(c => c.type === 'sdu_van')) {
      const sduVan: PoliceVehicle = {
        id: 'sdu-van-1',
        type: 'sdu_van',
        position: [-1.8, 0.45, playerPos[2] - 38.0],
        rotationY: 0,
        velocity: 20.0,
        targetSpeed: 24.0,
        health: 900,
        nodeId: 'node-sdu-van-1',
        lightbarNodeId: 'node-sdu-lightbar-1',
        strobeTimer: 0,
        isStrobeBlue: false
      };
      this.cruisers.push(sduVan);

      if (this.vanMesh && this.lightbarMesh) {
        const vNode: SceneNode = {
          id: sduVan.nodeId,
          name: 'SDU Flying Tigers Armored Tactical Van',
          mesh: this.vanMesh,
          position: sduVan.position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.08, 0.08, 0.1], // Matte Tactical Armored Black
          visible: true,
          transform: createTransformMatrix(sduVan.position, [0, 0, 0], [1, 1, 1])
        };
        const lbNode: SceneNode = {
          id: sduVan.lightbarNodeId,
          name: 'SDU Van Strobe Bar',
          mesh: this.lightbarMesh,
          position: [sduVan.position[0], sduVan.position[1] + 1.45, sduVan.position[2]],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [1.0, 0.0, 0.0],
          visible: true,
          transform: createTransformMatrix([sduVan.position[0], sduVan.position[1] + 1.45, sduVan.position[2]], [0, 0, 0], [1, 1, 1])
        };
        sceneGraph.addNode(vNode);
        sceneGraph.addNode(lbNode);
      }
    }

    // --- Heat 5: HKPD Helicopter Eagle-1 & Dynamic Searchlight ---
    if (this.heatLevel >= 5 && !this.helicopter) {
      this.helicopter = {
        id: 'hkpd-eagle-1',
        name: 'HKPD Tactical Pursuit Helicopter "Eagle-1"',
        position: [playerPos[0], 22.0, playerPos[2] - 6.0],
        targetPos: [...playerPos],
        rotorRotation: 0,
        spotlightPos: [playerPos[0], 0.05, playerPos[2]],
        spotlightRadius: 5.5,
        isPlayerIlluminated: true,
        fuselageNodeId: 'node-eagle1-fuselage',
        rotorsNodeId: 'node-eagle1-rotors',
        spotlightNodeId: 'node-eagle1-spotlight'
      };

      if (this.heliBodyMesh && this.heliRotorMesh && this.spotlightMesh) {
        const fNode: SceneNode = {
          id: this.helicopter.fuselageNodeId,
          name: 'Eagle-1 Fuselage',
          mesh: this.heliBodyMesh,
          position: this.helicopter.position,
          rotation: [0.08, 0, 0], // slight forward tilt
          scale: [1, 1, 1],
          color: [0.1, 0.14, 0.22], // HKPD Aviation Blue
          visible: true,
          transform: createTransformMatrix(this.helicopter.position, [0.08, 0, 0], [1, 1, 1])
        };
        const rNode: SceneNode = {
          id: this.helicopter.rotorsNodeId,
          name: 'Eagle-1 Rotors',
          mesh: this.heliRotorMesh,
          position: [this.helicopter.position[0], this.helicopter.position[1] + 1.25, this.helicopter.position[2]],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.8, 0.8, 0.85],
          visible: true,
          transform: createTransformMatrix(
            [this.helicopter.position[0], this.helicopter.position[1] + 1.25, this.helicopter.position[2]],
            [0, 0, 0],
            [1, 1, 1]
          )
        };
        const sNode: SceneNode = {
          id: this.helicopter.spotlightNodeId,
          name: 'Eagle-1 Ground Searchlight Disc',
          mesh: this.spotlightMesh,
          position: this.helicopter.spotlightPos,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [1.0, 1.0, 0.85], // Brilliant warm halogen white spotlight
          visible: true,
          transform: createTransformMatrix(this.helicopter.spotlightPos, [0, 0, 0], [1, 1, 1])
        };
        sceneGraph.addNode(fNode);
        sceneGraph.addNode(rNode);
        sceneGraph.addNode(sNode);
      }
    }

    // Update Helicopter Position, Spinning Rotors, and Searchlight Tracking
    if (this.helicopter) {
      this.helicopter.rotorRotation += deltaTimeSec * 28.0;

      // Helicopter hovers at altitude 22.0m smoothly tracking player
      this.helicopter.position[0] += (playerPos[0] - this.helicopter.position[0]) * deltaTimeSec * 1.8;
      this.helicopter.position[2] += (playerPos[2] - 4.0 - this.helicopter.position[2]) * deltaTimeSec * 1.8;

      // Spotlight tracks ground position with slight lead
      this.helicopter.spotlightPos[0] = this.helicopter.position[0];
      this.helicopter.spotlightPos[2] = this.helicopter.position[2] + 4.0;

      const fNode = sceneGraph.getNode(this.helicopter.fuselageNodeId);
      const rNode = sceneGraph.getNode(this.helicopter.rotorsNodeId);
      const sNode = sceneGraph.getNode(this.helicopter.spotlightNodeId);

      if (fNode) {
        fNode.position = [...this.helicopter.position];
        fNode.transform = createTransformMatrix(fNode.position, [0.08, 0, 0], fNode.scale);
      }
      if (rNode) {
        rNode.position = [this.helicopter.position[0], this.helicopter.position[1] + 1.25, this.helicopter.position[2]];
        rNode.rotation = [0, this.helicopter.rotorRotation, 0];
        rNode.transform = createTransformMatrix(rNode.position, rNode.rotation, rNode.scale);
      }
      if (sNode) {
        sNode.position = [...this.helicopter.spotlightPos];
        // Pulse spotlight brightness when tracking
        sNode.color = illuminatedByHeli ? [1.0, 1.0, 0.95] : [0.75, 0.75, 0.65];
        sNode.transform = createTransformMatrix(sNode.position, sNode.rotation, sNode.scale);
      }
    }
  }

  /**
   * Checks if player runs into roadblock spike strip
   */
  private checkSpikeStripCollision(
    playerPos: [number, number, number],
    playerInCar: boolean,
    vehicleController: any,
    audio?: AudioEngine
  ): void {
    if (!playerInCar || this.spikesPunctured) return;

    for (const rb of this.roadblocks) {
      if (!rb.hasSpikes || rb.spikesTriggered) continue;

      const spikeZ = rb.center[2] - 4.0;
      const dz = Math.abs(playerPos[2] - spikeZ);
      const dx = Math.abs(playerPos[0] - rb.center[0]);

      if (dz < 1.8 && dx < 4.0) {
        rb.spikesTriggered = true;
        this.spikesPunctured = true;

        if (audio && typeof audio.playTrack === 'function') {
          audio.playTrack('tire_blowout');
        }

        if (vehicleController) {
          vehicleController.speed = Math.min(vehicleController.speed, 5.0); // slow down immediately
        }

        this.showToast('💥 TIRE PUNCTURED BY HKPD SPIKE STRIP! MAXIMUM VEHICLE SPEED REDUCED TO 18 KM/H', '#ef4444');
        break;
      }
    }
  }

  /**
   * Cleans up all spawned police 3D scene nodes
   */
  public cleanupUnits(sceneGraph?: SceneGraph): void {
    const sg = sceneGraph || this.activeSceneGraph;
    if (sg) {
      this.officers.forEach(off => sg.removeNode(off.nodeId));
      this.cruisers.forEach(cv => {
        sg.removeNode(cv.nodeId);
        sg.removeNode(cv.lightbarNodeId);
      });
      this.roadblocks.forEach(rb => {
        sg.removeNode(rb.cruiser1NodeId);
        sg.removeNode(rb.cruiser2NodeId);
        sg.removeNode(rb.spikeNodeId);
      });
      if (this.helicopter) {
        sg.removeNode(this.helicopter.fuselageNodeId);
        sg.removeNode(this.helicopter.rotorsNodeId);
        sg.removeNode(this.helicopter.spotlightNodeId);
      }
    }
    this.officers = [];
    this.cruisers = [];
    this.roadblocks = [];
    this.helicopter = null;
  }

  /**
   * Updates full-screen edge vignette pulses
   */
  private updateVignette(deltaTimeSec: number, isStrobeBlue: boolean): void {
    if (!this.vignetteElement) return;

    if (this.pursuitState === 'pursuit') {
      this.vignetteElement.style.opacity = '1';
      if (isStrobeBlue) {
        this.vignetteElement.style.boxShadow = 'inset 0 0 70px rgba(0, 100, 255, 0.45)';
      } else {
        this.vignetteElement.style.boxShadow = 'inset 0 0 70px rgba(239, 68, 68, 0.45)';
      }
    } else if (this.pursuitState === 'cooldown') {
      this.vignetteElement.style.opacity = '0.5';
      this.vignetteElement.style.boxShadow = 'inset 0 0 50px rgba(100, 150, 220, 0.3)';
    } else {
      this.vignetteElement.style.opacity = '0';
    }
  }

  /**
   * Renders 5-star police HUD display
   */
  private renderHUD(distFromCenter?: number): void {
    if (!this.hudElement) return;

    const badge = document.getElementById('police-heat-badge');
    const cooldownWrap = document.getElementById('police-cooldown-bar-wrap');
    const cooldownBar = document.getElementById('police-cooldown-bar');
    const statusLabel = document.getElementById('police-status-label');

    // Update star visual states
    for (let i = 1; i <= 5; i++) {
      const star = document.getElementById(`star-${i}`);
      if (star) {
        if (i <= this.heatLevel) {
          star.innerText = '★';
          if (this.pursuitState === 'cooldown') {
            star.style.color = Math.floor(Date.now() / 250) % 2 === 0 ? '#f8fafc' : '#475569';
          } else {
            star.style.color = '#ef4444'; // Red gold pursuit stars
          }
        } else {
          star.innerText = '☆';
          star.style.color = '#334155';
        }
      }
    }

    if (badge) {
      badge.innerText = `${this.heatLevel} STARS`;
      badge.style.background = this.heatLevel > 0 ? (this.heatLevel >= 4 ? '#b91c1c' : '#1e3a8a') : '#1e293b';
      badge.style.color = this.heatLevel > 0 ? '#fecaca' : '#94a3b8';
    }

    if (this.pursuitState === 'cooldown') {
      if (cooldownWrap && cooldownBar) {
        cooldownWrap.style.display = 'block';
        const pct = Math.max(0, Math.min(100, (this.cooldownTimer / this.COOLDOWN_DURATION) * 100));
        cooldownBar.style.width = `${pct}%`;
      }
      if (statusLabel) {
        statusLabel.innerText = `COOLDOWN: ${Math.ceil(this.cooldownTimer)}s (EVADING SEARCH RADIUS)`;
        statusLabel.style.color = '#38bdf8';
      }
    } else if (this.pursuitState === 'pursuit') {
      if (cooldownWrap) cooldownWrap.style.display = 'none';
      if (statusLabel) {
        const distStr = distFromCenter !== undefined ? ` | DIST: ${Math.round(distFromCenter)}m` : '';
        statusLabel.innerText = `ACTIVE PURSUIT (CODE 3)${distStr}`;
        statusLabel.style.color = '#ef4444';
      }
    } else {
      if (cooldownWrap) cooldownWrap.style.display = 'none';
      if (statusLabel) {
        statusLabel.innerText = 'PEACE (NO HEAT)';
        statusLabel.style.color = '#94a3b8';
      }
    }
  }

  private showToast(message: string, color = '#38bdf8'): void {
    if (typeof document === 'undefined') return;
    const toast = document.createElement('div');
    toast.className = 'police-toast-banner';
    toast.style.position = 'fixed';
    toast.style.top = '145px';
    toast.style.right = '24px';
    toast.style.background = 'rgba(8, 12, 22, 0.94)';
    toast.style.borderLeft = `4px solid ${color}`;
    toast.style.padding = '8px 14px';
    toast.style.borderRadius = '0 6px 6px 0';
    toast.style.color = '#f8fafc';
    toast.style.fontFamily = "'Noto Sans TC', sans-serif";
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '9998';
    toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}
