/**
 * open-world-activities.ts
 * Sleeping Dogs Browser Reconstruction - Authentic Open-World Side Activities Engine.
 *
 * Implements:
 *  1. Martial Arts Fight Clubs:
 *     - Multi-wave survival combat tournament (Novice, Heavy Bruisers, Champion "Bamboo Tiger")
 *     - Face Meter scaling, crowd cheering, and cash/Face XP purse rewards
 *  2. Illegal Hong Kong Street Racing:
 *     - Circuit sprint with glowing 3D checkpoint gates and dynamic Mini-Map radar pathing
 *     - 3-2-1 countdown, real-time speedometer, lap/checkpoint tracking, finish line fanfare
 *  3. Tran Luxury Exotic Car Thefts:
 *     - Cell phone dispatch from Tran, vehicle locating, hotwire ignition
 *     - 2-Star HKPD Police pursuit heat with siren/radio chatter, high-speed evasion mechanic
 *     - Aberdeen container dock drop-off with cash and Face level rewards
 *  4. HKPD Undercover Police Investigation Cases:
 *     - Radio intelligence from Inspector Jane Teng, terminal security hack
 *     - Drug syndicate bust, armed supplier takedowns, case closed Police XP reward
 */

import { SceneGraph, SceneNode } from './scene-graph';
import { CameraController } from './camera-controller';
import { AudioEngine } from './audio-engine';
import { CrowdSystem } from './crowd-system';
import { CombatSystem } from './combat-system';
import { VehicleController } from './vehicle-controller';
import { HackingMinigame } from './hacking-minigame';

export type ActivityType = 'fight_club' | 'street_race' | 'tran_theft' | 'police_case';

export interface ActivityHotspot {
  id: ActivityType;
  title: string;
  subtitle: string;
  position: [number, number]; // [X, Z]
  radius: number;
  requiresVehicle: boolean;
  color: string;
  icon: string;
}

export const ACTIVITY_HOTSPOTS: ActivityHotspot[] = [
  {
    id: 'fight_club',
    title: 'NORTH POINT MARTIAL ARTS FIGHT CLUB',
    subtitle: '3-Round Underground Combat Tournament [Purse: $5,000 HKD]',
    position: [-18.0, 32.0],
    radius: 5.5,
    requiresVehicle: false,
    color: '#ef4444',
    icon: '🥊'
  },
  {
    id: 'street_race',
    title: 'HONG KONG MIDNIGHT STREET RACE',
    subtitle: 'High-Speed North Point Circuit Sprint [Purse: $10,000 HKD]',
    position: [-2.2, 0.0],
    radius: 6.0,
    requiresVehicle: true,
    color: '#eab308',
    icon: '🏁'
  },
  {
    id: 'tran_theft',
    title: 'TRAN EXOTIC CAR THEFT CONTRACT',
    subtitle: 'Hotwire Luxury CS-750 Coupe & Evade HKPD Pursuit [Reward: $15,000 HKD]',
    position: [6.8, 15.0],
    radius: 5.5,
    requiresVehicle: false,
    color: '#22c55e',
    icon: '🚗'
  },
  {
    id: 'police_case',
    title: 'HKPD NARCOTICS INVESTIGATION: CASE #402',
    subtitle: 'Breach CCTV Feed & Dismantle Docks Drug Ring [Reward: +1,200 Police XP]',
    position: [24.0, -48.0],
    radius: 6.5,
    requiresVehicle: false,
    color: '#00d2ff',
    icon: '🛡️'
  }
];

export interface RaceCheckpoint {
  position: [number, number];
  radius: number;
}

export const STREET_RACE_CHECKPOINTS: RaceCheckpoint[] = [
  { position: [0.0, 20.0], radius: 6.0 },
  { position: [25.0, 40.0], radius: 6.5 },
  { position: [35.0, -10.0], radius: 6.5 },
  { position: [10.0, -35.0], radius: 6.0 },
  { position: [-2.2, 0.0], radius: 6.0 }
];

export class OpenWorldActivitiesManager {
  public activeActivity: ActivityType | null = null;
  public activityStage = '';
  public activityTimer = 0.0;
  public totalCashEarned = 0;

  // Fight Club state
  public fightClubRound = 0;
  public fightClubTotalRounds = 3;
  public enemiesRemaining = 0;
  public totalEnemiesInRound = 0;

  // Street Race state
  public currentCheckpointIndex = 0;
  public raceStartTime = 0;
  public raceElapsedTime = 0;
  public isCountdownActive = false;
  public countdownVal = 3;
  private countdownTimer = 0;

  // Tran Car Theft state
  public tranVehicleSpawned = false;
  public tranVehicleHotwired = false;
  public policeHeatLevel = 0; // 0 to 2
  public evasionSpeedTimer = 0.0; // Must sustain speed > 55 km/h for 8s
  public evasionTargetSeconds = 8.0;

  // Police Case state
  public policeHacked = false;
  public policeDealersRemaining = 0;

  private bannerEl: HTMLElement | null = null;
  private promptEl: HTMLElement | null = null;

  constructor() {
    this.initHUD();
  }

  private initHUD(): void {
    let b = document.getElementById('activity-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'activity-banner';
      b.className = 'activity-banner';
      b.style.cssText = `
        position: fixed;
        top: 68px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 500;
        background: rgba(15, 19, 26, 0.94);
        border: 2px solid #eab308;
        border-radius: 6px;
        padding: 10px 24px;
        font-family: monospace;
        text-align: center;
        box-shadow: 0 0 30px rgba(234, 179, 8, 0.5);
        display: none;
        pointer-events: none;
      `;
      document.body.appendChild(b);
    }
    this.bannerEl = b;

    let p = document.getElementById('activity-prompt');
    if (!p) {
      p = document.createElement('div');
      p.id = 'activity-prompt';
      p.className = 'activity-prompt';
      p.style.cssText = `
        position: fixed;
        bottom: 84px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 500;
        background: rgba(17, 24, 39, 0.95);
        border: 2px solid #00d2ff;
        border-radius: 4px;
        padding: 8px 20px;
        font-family: monospace;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #ffffff;
        box-shadow: 0 0 20px rgba(0, 210, 255, 0.6);
        display: none;
        text-align: center;
      `;
      document.body.appendChild(p);
    }
    this.promptEl = p;
  }

  /**
   * Main per-frame update loop for open-world side activities
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isDriving: boolean,
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    combatSystem: CombatSystem,
    vehicleController: VehicleController
  ): void {
    // 1. If an activity is active, update its state machine
    if (this.activeActivity) {
      this.updateActiveActivity(
        deltaTimeSec,
        playerPos,
        isDriving,
        cameraController,
        audioEngine,
        sceneGraph,
        crowdSystem,
        combatSystem,
        vehicleController
      );
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    // 2. Otherwise, check proximity to hotspots for interaction prompt
    let nearbyHotspot: ActivityHotspot | null = null;
    for (const h of ACTIVITY_HOTSPOTS) {
      const dist = Math.hypot(playerPos[0] - h.position[0], playerPos[2] - h.position[1]);
      if (dist <= h.radius) {
        if (!h.requiresVehicle || isDriving) {
          nearbyHotspot = h;
          break;
        }
      }
    }

    if (nearbyHotspot && this.promptEl) {
      this.promptEl.style.display = 'block';
      this.promptEl.style.borderColor = nearbyHotspot.color;
      this.promptEl.innerHTML = `<span style="color:${nearbyHotspot.color}">${nearbyHotspot.icon} [T] START ${nearbyHotspot.title}</span><br><span style="font-size:11px;color:#94a3b8">${nearbyHotspot.subtitle}</span>`;
    } else if (this.promptEl) {
      this.promptEl.style.display = 'none';
    }
  }

  /**
   * Triggered when player presses [T] to initiate a nearby activity
   */
  public triggerNearbyActivity(
    playerPos: [number, number, number],
    isDriving: boolean,
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    combatSystem: CombatSystem,
    vehicleController: VehicleController,
    hackingMinigame?: HackingMinigame
  ): boolean {
    if (this.activeActivity) return false;

    for (const h of ACTIVITY_HOTSPOTS) {
      const dist = Math.hypot(playerPos[0] - h.position[0], playerPos[2] - h.position[1]);
      if (dist <= h.radius) {
        if (h.requiresVehicle && !isDriving) continue;

        if (h.id === 'fight_club') {
          this.startFightClub(sceneGraph, crowdSystem, audioEngine);
          return true;
        } else if (h.id === 'street_race') {
          this.startStreetRace(audioEngine, vehicleController);
          return true;
        } else if (h.id === 'tran_theft') {
          this.startTranCarTheft(audioEngine, vehicleController);
          return true;
        } else if (h.id === 'police_case') {
          this.startPoliceCase(audioEngine, sceneGraph, crowdSystem, hackingMinigame);
          return true;
        }
      }
    }
    return false;
  }

  // =========================================================================
  // 1. MARTIAL ARTS FIGHT CLUB
  // =========================================================================

  public startFightClub(sceneGraph: SceneGraph, crowdSystem: CrowdSystem, audioEngine: AudioEngine): void {
    this.activeActivity = 'fight_club';
    this.activityStage = 'round_1';
    this.fightClubRound = 1;
    this.totalEnemiesInRound = 3;
    this.enemiesRemaining = 3;

    audioEngine.playTrack('ui_chime_granted').catch(() => {});
    this.showBanner('🥊 NORTH POINT FIGHT CLUB — ROUND 1/3: NOVICE STREET FIGHTERS', '#ef4444');

    // Spawn Round 1 Novice Brawlers
    crowdSystem.spawnFightClubRound(sceneGraph, 1);
  }

  private advanceFightClubRound(sceneGraph: SceneGraph, crowdSystem: CrowdSystem, audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.fightClubRound++;
    if (this.fightClubRound === 2) {
      this.activityStage = 'round_2';
      this.totalEnemiesInRound = 4;
      this.enemiesRemaining = 4;
      this.showBanner('🥊 FIGHT CLUB — ROUND 2/3: HEAVYWEIGHT GRAPPLERS', '#f59e0b');
      audioEngine.playTrack('counter_impact').catch(() => {});
      crowdSystem.spawnFightClubRound(sceneGraph, 2);
    } else if (this.fightClubRound === 3) {
      this.activityStage = 'round_3';
      this.totalEnemiesInRound = 3;
      this.enemiesRemaining = 3;
      this.showBanner('🥊 FIGHT CLUB — CHAMPIONSHIP: BAMBOO TIGER & ENFORCERS', '#dc2626');
      audioEngine.playTrack('knife_stab').catch(() => {});
      crowdSystem.spawnFightClubRound(sceneGraph, 3);
    } else {
      // Victory
      this.completeFightClub(audioEngine, combatSystem);
    }
  }

  public completeFightClub(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.activeActivity = null;
    this.activityStage = 'completed';
    this.totalCashEarned += 5000;
    combatSystem.faceMeter = 100;
    combatSystem.triadScore += 800;

    audioEngine.playTrack('chapter2_finale_fanfare').catch(() => {});
    this.showBanner('🏆 FIGHT CLUB CHAMPION! PURSE WON: $5,000 HKD • +800 TRIAD XP 🏆', '#22c55e', 4500);
  }

  // =========================================================================
  // 2. ILLEGAL HONG KONG STREET RACE
  // =========================================================================

  public startStreetRace(audioEngine: AudioEngine, vehicleController: VehicleController): void {
    this.activeActivity = 'street_race';
    this.activityStage = 'countdown';
    this.currentCheckpointIndex = 0;
    this.raceElapsedTime = 0;
    this.isCountdownActive = true;
    this.countdownVal = 3;
    this.countdownTimer = 1.0;

    audioEngine.playTrack('sports_car_engine_rev').catch(() => {});
    this.showBanner(`🏁 STREET RACE STARTING IN 3... [REV ENGINE] 🏁`, '#eab308');
  }

  private advanceRaceCheckpoint(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.currentCheckpointIndex++;
    audioEngine.playTrack('ui_chime_granted').catch(() => {});

    if (this.currentCheckpointIndex >= STREET_RACE_CHECKPOINTS.length) {
      // Race Completed
      this.completeStreetRace(audioEngine, combatSystem);
    } else {
      const remaining = STREET_RACE_CHECKPOINTS.length - this.currentCheckpointIndex;
      this.showBanner(`🏁 CHECKPOINT ${this.currentCheckpointIndex}/${STREET_RACE_CHECKPOINTS.length} CLEARED! (${remaining} TO GO) 🏁`, '#38bdf8');
    }
  }

  public completeStreetRace(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.activeActivity = null;
    this.activityStage = 'completed';
    this.totalCashEarned += 10000;
    combatSystem.triadScore += 1000;
    combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 50);

    audioEngine.playTrack('chapter2_finale_fanfare').catch(() => {});
    this.showBanner(`🥇 1ST PLACE VICTORY! PRIZE: $10,000 HKD • TIME: ${this.raceElapsedTime.toFixed(1)}s • +1000 TRIAD XP 🥇`, '#4ade80', 5000);
  }

  // =========================================================================
  // 3. TRAN EXOTIC CAR THEFT CONTRACT
  // =========================================================================

  public startTranCarTheft(audioEngine: AudioEngine, vehicleController: VehicleController): void {
    this.activeActivity = 'tran_theft';
    this.activityStage = 'locate_vehicle';
    this.tranVehicleSpawned = true;
    this.tranVehicleHotwired = false;
    this.policeHeatLevel = 0;
    this.evasionSpeedTimer = 0.0;

    audioEngine.playTrack('police_radio_call').catch(() => {});
    this.showBanner('📱 TRAN DISPATCH: Locate & hotwire target CS-750 Luxury Coupe in Central alleyway', '#22c55e', 4000);
  }

  public hotwireTranVehicle(audioEngine: AudioEngine): void {
    this.tranVehicleHotwired = true;
    this.activityStage = 'evade_police';
    this.policeHeatLevel = 2; // 2-star heat
    this.evasionSpeedTimer = 0.0;

    audioEngine.playTrack('vehicle_horn').catch(() => {});
    audioEngine.playTrack('police_radio_call').catch(() => {});
    this.showBanner('🚨 2-STAR POLICE HEAT! SUSTAIN SPEED > 55 KM/H TO EVADE HKPD PATROLS 🚨', '#ef4444');
  }

  public deliverTranVehicle(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.activeActivity = null;
    this.activityStage = 'completed';
    this.totalCashEarned += 15000;
    combatSystem.triadScore += 1200;
    combatSystem.faceMeter = 100;

    audioEngine.playTrack('chapter2_finale_fanfare').catch(() => {});
    this.showBanner('🚢 VEHICLE DELIVERED TO ABERDEEN DOCKS! TRAN PAYOUT: $15,000 HKD • +1200 TRIAD XP 🚢', '#4ade80', 5000);
  }

  // =========================================================================
  // 4. HKPD POLICE INVESTIGATION CASE WORK
  // =========================================================================

  public startPoliceCase(
    audioEngine: AudioEngine,
    sceneGraph?: SceneGraph,
    crowdSystem?: CrowdSystem,
    hackingMinigame?: HackingMinigame
  ): void {
    this.activeActivity = 'police_case';
    this.activityStage = 'hack_terminal';
    this.policeHacked = false;
    this.policeDealersRemaining = 3;

    audioEngine.playTrack('police_radio_call').catch(() => {});
    this.showBanner('🛡️ HKPD CASE #402: Infiltrate Terminal & Hack Camera Feed to identify drug suppliers', '#00d2ff', 4000);

    if (hackingMinigame) {
      hackingMinigame.startMinigame([4, 1, 9, 2], () => {
        this.onPoliceTerminalHacked(audioEngine, sceneGraph, crowdSystem);
      });
    } else {
      setTimeout(() => this.onPoliceTerminalHacked(audioEngine, sceneGraph, crowdSystem), 2000);
    }
  }

  public onPoliceTerminalHacked(
    audioEngine: AudioEngine,
    sceneGraph?: SceneGraph,
    crowdSystem?: CrowdSystem
  ): void {
    this.policeHacked = true;
    this.activityStage = 'bust_dealers';
    if (sceneGraph && crowdSystem) {
      crowdSystem.spawnPoliceCaseDealers(sceneGraph);
    }
    audioEngine.playTrack('ui_chime_granted').catch(() => {});
    this.showBanner('🎯 SURVEILLANCE FEED ACTIVE: Target suppliers located! Bust the 18K distributors (0/3)', '#38bdf8');
  }

  public onPoliceDealerDefeated(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.policeDealersRemaining = Math.max(0, this.policeDealersRemaining - 1);
    audioEngine.playTrack('combat_strike').catch(() => {});

    if (this.policeDealersRemaining <= 0) {
      this.completePoliceCase(audioEngine, combatSystem);
    } else {
      this.showBanner(`🛡️ 18K DRUG SUPPLIER ARRESTED! (${3 - this.policeDealersRemaining}/3 Defeated)`, '#00d2ff');
    }
  }

  public completePoliceCase(audioEngine: AudioEngine, combatSystem: CombatSystem): void {
    this.activeActivity = null;
    this.activityStage = 'completed';
    combatSystem.policeScore += 1200;
    combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 40);

    audioEngine.playTrack('chapter2_finale_fanfare').catch(() => {});
    this.showBanner('⭐ HKPD CASE #402 CLOSED: NARCOTICS SYNDICATE BUSTED! +1,200 POLICE XP ⭐', '#38bdf8', 5000);
  }

  // =========================================================================
  // Per-Frame State Machine
  // =========================================================================

  private updateActiveActivity(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isDriving: boolean,
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    combatSystem: CombatSystem,
    vehicleController: VehicleController
  ): void {
    this.activityTimer += deltaTimeSec;

    // 1. Street Race State Machine
    if (this.activeActivity === 'street_race') {
      if (this.isCountdownActive) {
        this.countdownTimer -= deltaTimeSec;
        if (this.countdownTimer <= 0) {
          this.countdownVal--;
          this.countdownTimer = 1.0;
          if (this.countdownVal > 0) {
            audioEngine.playTrack('ui_hack_tick').catch(() => {});
            this.showBanner(`🏁 STREET RACE STARTING IN ${this.countdownVal}... 🏁`, '#eab308');
          } else {
            this.isCountdownActive = false;
            this.activityStage = 'racing';
            this.raceStartTime = performance.now();
            audioEngine.playTrack('ui_chime_granted').catch(() => {});
            this.showBanner('🏁 GREEN FLAG! GO! GO! GO! 🏁', '#22c55e', 1500);
          }
        }
        return;
      }

      this.raceElapsedTime += deltaTimeSec;
      const targetCP = STREET_RACE_CHECKPOINTS[this.currentCheckpointIndex];
      const distToCP = Math.hypot(playerPos[0] - targetCP.position[0], playerPos[2] - targetCP.position[1]);
      const speedKmh = Math.abs(vehicleController.speed * 3.6).toFixed(0);

      this.showBanner(
        `🏁 CHECKPOINT ${this.currentCheckpointIndex + 1}/${STREET_RACE_CHECKPOINTS.length} • TIME: ${this.raceElapsedTime.toFixed(1)}s • SPEED: ${speedKmh} KM/H 🏁`,
        '#eab308'
      );

      if (distToCP <= targetCP.radius) {
        this.advanceRaceCheckpoint(audioEngine, combatSystem);
      }
    }

    // 2. Fight Club State Machine
    else if (this.activeActivity === 'fight_club') {
      const activeHostiles = crowdSystem.npcs.filter(n => n.isHostile && !n.defeated).length;
      this.enemiesRemaining = activeHostiles;

      if (activeHostiles === 0) {
        this.advanceFightClubRound(sceneGraph, crowdSystem, audioEngine, combatSystem);
      } else {
        const roundTitle = this.fightClubRound === 3 ? 'CHAMPIONSHIP (BAMBOO TIGER)' : `ROUND ${this.fightClubRound}/3`;
        this.showBanner(
          `🥊 FIGHT CLUB — ${roundTitle}: ${activeHostiles} ENEMY REMAINING! [L-CLICK: STRIKE, R-CLICK: COUNTER]`,
          '#ef4444'
        );
      }
    }

    // 3. Tran Car Theft State Machine
    else if (this.activeActivity === 'tran_theft') {
      if (this.activityStage === 'locate_vehicle') {
        const distToCar = Math.hypot(playerPos[0] - 6.8, playerPos[2] - 15.0);
        if (distToCar <= 4.5 && !isDriving) {
          if (this.promptEl) {
            this.promptEl.style.display = 'block';
            this.promptEl.style.borderColor = '#22c55e';
            this.promptEl.innerHTML = `<span style="color:#22c55e">⚡ [F] HOTWIRE CS-750 COUPE ⚡</span>`;
          }
        }
      } else if (this.activityStage === 'evade_police') {
        const kmh = Math.abs(vehicleController.speed * 3.6);
        if (kmh >= 50) {
          this.evasionSpeedTimer += deltaTimeSec;
        } else {
          this.evasionSpeedTimer = Math.max(0, this.evasionSpeedTimer - deltaTimeSec * 0.5);
        }

        const pct = Math.min(100, Math.round((this.evasionSpeedTimer / this.evasionTargetSeconds) * 100));
        this.showBanner(`🚨 2-STAR POLICE PURSUIT • EVASION PROGRESS: ${pct}% (MAINTAIN > 50 KM/H) 🚨`, '#ef4444');

        if (this.evasionSpeedTimer >= this.evasionTargetSeconds) {
          this.activityStage = 'deliver_docks';
          this.policeHeatLevel = 0;
          audioEngine.playTrack('ui_chime_granted').catch(() => {});
          this.showBanner('✓ POLICE PURSUIT EVADED! Deliver luxury coupe to Tran\'s Aberdeen shipping garage [28.0, 42.0]', '#4ade80');
        }
      } else if (this.activityStage === 'deliver_docks') {
        const distToDocks = Math.hypot(playerPos[0] - 28.0, playerPos[2] - 42.0);
        this.showBanner(`🚢 DELIVER VEHICLE: ABERDEEN SHIPPING DOCKS (${distToDocks.toFixed(0)}m)`, '#4ade80');
        if (distToDocks <= 6.5) {
          this.deliverTranVehicle(audioEngine, combatSystem);
        }
      }
    }

    // 4. Police Case State Machine
    else if (this.activeActivity === 'police_case') {
      if (this.activityStage === 'bust_dealers') {
        this.showBanner(
          `🛡️ HKPD CASE #402: Subdue 18K Drug Dealers (${3 - this.policeDealersRemaining}/3 Apprehended)`,
          '#00d2ff'
        );
      }
    }
  }

  /**
   * Displays the authentic Sleeping Dogs activity banner
   */
  public showBanner(text: string, color = '#eab308', durationMs?: number): void {
    if (!this.bannerEl) this.initHUD();
    if (!this.bannerEl) return;

    this.bannerEl.style.display = 'block';
    this.bannerEl.style.borderColor = color;
    this.bannerEl.style.boxShadow = `0 0 25px ${color}`;
    this.bannerEl.innerHTML = `<span style="color:${color};font-weight:800;letter-spacing:1px;">${text}</span>`;

    if (durationMs) {
      setTimeout(() => {
        if (this.bannerEl && !this.activeActivity) {
          this.bannerEl.style.display = 'none';
        }
      }, durationMs);
    }
  }

  public hideBanner(): void {
    if (this.bannerEl) this.bannerEl.style.display = 'none';
  }
}
