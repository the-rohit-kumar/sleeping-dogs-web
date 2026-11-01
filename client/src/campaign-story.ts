/**
 * campaign-story.ts
 * Authentic Story Campaign & In-Engine Cutscene Director for Sleeping Dogs: Definitive Edition.
 *
 * Faithfully reconstructs the canonical story campaign:
 *  - Prologue: Aberdeen Docks Deal, Foot Chase & HKPD Arrest (Naz, Ming, Raymond Mak)
 *  - Chapter 1: "Going Under" - HKPD Interrogation & Holding Cells Brawl (Raymond Mak, Pendrew, Jackie Ma)
 *  - Chapter 1: "Vendor Extortion" - Golden Koi & North Point Night Market (Winston Chu, Vendors, 18K Ambush)
 *  - Free Roam / Water Street Enforcer Mode
 *
 * Implements:
 *  - 2.39:1 Letterbox widescreen cinematic cutscenes with dramatic camera framing
 *  - Authentic Sleeping Dogs gold/white subtitles with character speaker headers
 *  - Authentic spoken English voice dialogue streamed directly from English(US).pck via AudioEngine
 *  - Interactive dialogue skip ([Space] / [E])
 *  - Seamless transitions directly into authentic gameplay, parkour, and combat
 *
 * Hybrid reconstruction: authentic base-game voice audio and character models with authored campaign state machines.
 */

import { AudioEngine } from './audio-engine';
import { CameraController } from './camera-controller';
import { CharacterController } from './character-controller';
import { CombatSystem } from './combat-system';
import { CrowdSystem } from './crowd-system';
import { SceneGraph } from './scene-graph';
import { VehicleController } from './vehicle-controller';

export type StoryStage =
  | 'prologue_cinematic'
  | 'prologue_chase'
  | 'prologue_alley_fight'
  | 'prologue_arrest_cinematic'
  | 'ch1_interrogation_cinematic'
  | 'ch1_holding_cells_brawl'
  | 'ch1_bailout_cinematic'
  | 'ch1_extortion_golden_koi_cinematic'
  | 'ch1_extortion_watch_vendor'
  | 'ch1_extortion_drink_vendor'
  | 'ch1_extortion_18k_ambush'
  | 'ch1_extortion_return_golden_koi'
  | 'ch1_extortion_completed'
  | 'ch1_nmc_find_ming_cinematic'
  | 'ch1_nmc_market_chase'
  | 'ch1_nmc_rooftop_parkour'
  | 'ch1_nmc_rooftop_knife_brawl'
  | 'ch1_nmc_arrest_cinematic'
  | 'ch1_amanda_drive_dojo'
  | 'ch1_amanda_dojo_training'
  | 'ch1_amanda_completed'
  | 'ch1_bambam_briefing_cinematic'
  | 'ch1_bambam_drive'
  | 'ch1_bambam_entrance_cinematic'
  | 'ch1_bambam_dancefloor_brawl'
  | 'ch1_bambam_vip_lounge_brawl'
  | 'ch1_bambam_bathroom_climax'
  | 'ch1_bambam_completed'
  | 'ch1_popstar_phone_call'
  | 'ch1_popstar_drive_terminal'
  | 'ch1_popstar_camera_hacking'
  | 'ch1_popstar_surveillance_feed'
  | 'ch1_popstar_ambush_brawl'
  | 'ch1_popstar_bust_completed'
  | 'free_roam';

export interface DialogueLine {
  speaker: string;
  speakerColor?: string;
  text: string;
  audioKey?: string;
  durationSec: number;
  cameraEye: [number, number, number];
  cameraTarget: [number, number, number];
}

export class CampaignStoryEngine {
  public stage: StoryStage = 'prologue_cinematic';
  public isCutscene = false;
  public thugsDefeated = 0;
  public thugsTotal = 0;

  // Active dialogue timeline
  private activeDialogueScript: DialogueLine[] = [];
  private currentLineIndex = 0;
  private lineTimer = 0.0;
  private onCutsceneEndCallback: (() => void) | null = null;

  // UI Elements
  private cinematicTopBar: HTMLElement | null = null;
  private cinematicBottomBar: HTMLElement | null = null;
  private cinematicOverlay: HTMLElement | null = null;
  private cinematicSpeaker: HTMLElement | null = null;
  private cinematicSubtitles: HTMLElement | null = null;
  private cinematicSkip: HTMLElement | null = null;
  private missionBanner: HTMLElement | null = null;
  private missionTitle: HTMLElement | null = null;
  private missionObjective: HTMLElement | null = null;
  private actionPrompt: HTMLElement | null = null;

  constructor() {
    this.cinematicTopBar = document.getElementById('cinematic-bar-top');
    this.cinematicBottomBar = document.getElementById('cinematic-bar-bottom');
    this.cinematicOverlay = document.getElementById('cinematic-overlay');
    this.cinematicSpeaker = document.getElementById('cinematic-speaker');
    this.cinematicSubtitles = document.getElementById('cinematic-subtitles');
    this.cinematicSkip = document.getElementById('cinematic-skip');
    this.missionBanner = document.getElementById('mission-banner');
    this.missionTitle = document.getElementById('mission-title');
    this.missionObjective = document.getElementById('mission-objective');
    this.actionPrompt = document.getElementById('action-prompt');

    // Register Space / Enter to advance/skip cutscene lines
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.code === 'KeyE') && this.isCutscene) {
        this.advanceDialogueLine();
      }
    });
  }

  /**
   * Initializes the canonical Sleeping Dogs campaign starting with Prologue: Aberdeen Docks Deal
   */
  public startCampaign(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.startPrologueCinematic(sceneGraph, crowdSystem, cameraController, audioEngine);
  }

  /**
   * Scene 1: Prologue — Aberdeen Fish Docks Deal & Police Raid
   */
  public startPrologueCinematic(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'prologue_cinematic';
    crowdSystem.spawnPrologueDocksNPCs(sceneGraph);

    const script: DialogueLine[] = [
      {
        speaker: 'NAZ SINGH',
        speakerColor: '#facc15',
        text: "You got the shipment, Wei? Cops have been crawling all over Aberdeen since sunrise.",
        durationSec: 3.5,
        cameraEye: [31.5, 2.2, 38.0],
        cameraTarget: [27.5, 1.2, 34.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "It's all here, uncut. Count it fast so we can get off this dock.",
        durationSec: 3.2,
        cameraEye: [26.0, 1.8, 32.5],
        cameraTarget: [28.5, 1.3, 34.5]
      },
      {
        speaker: 'MING',
        speakerColor: '#fb923c',
        text: "Wait... you hear that?! Sirens on the perimeter!",
        audioKey: 'police_siren',
        durationSec: 3.0,
        cameraEye: [28.0, 3.5, 42.0],
        cameraTarget: [27.0, 1.0, 34.0]
      },
      {
        speaker: 'INSPECTOR RAYMOND MAK',
        speakerColor: '#f87171',
        text: "HKPD! Freeze! Nobody move! Drop the bags and get your hands in the air!",
        audioKey: 'raymond_interrogate',
        durationSec: 4.0,
        cameraEye: [24.0, 2.0, 39.0],
        cameraTarget: [27.0, 1.2, 34.0]
      },
      {
        speaker: 'MING',
        speakerColor: '#fb923c',
        text: "It's Mak and the tactical unit! Run, Wei, run!",
        durationSec: 2.5,
        cameraEye: [27.0, 1.6, 33.0],
        cameraTarget: [25.0, 1.2, 37.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startPrologueChase(cameraController, audioEngine);
    });
  }

  /**
   * Scene 2: Prologue — Aberdeen Market Foot Chase
   */
  public startPrologueChase(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'prologue_chase';
    this.endCutscene(cameraController);
    audioEngine.playTrack('police_siren').catch(() => {});

    this.updateHUD(
      'PROLOGUE: ABERDEEN FOOT CHASE',
      '🏃 Evade the HKPD tactical blockade! Sprint [Shift] & vault crates [Space] to reach the warehouse alley!'
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⚡ SPRINT [SHIFT] • VAULT [SPACE] ⚡';
      this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Scene 3: Prologue — Dead-End Alley Brawl
   */
  public startPrologueAlleyFight(audioEngine: AudioEngine): void {
    this.stage = 'prologue_alley_fight';
    this.thugsDefeated = 0;
    this.thugsTotal = 3;
    audioEngine.playTrack('triad_brawl_shout').catch(() => {});

    this.updateHUD(
      'PROLOGUE: ALLEY CONFRONTATION',
      `👊 Cornered! Defeat corrupt dock brawlers (${this.thugsDefeated}/${this.thugsTotal}) [L-Click: Strike, E: Counter, F: Env Takedown]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⚠️ CORNERED! ELIMINATE DOCK THUGS! ⚠️';
      this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 3500);
    }
  }

  /**
   * Scene 4: Prologue — Raymond Mak Arrest Cinematic
   */
  public startPrologueArrestCinematic(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'prologue_arrest_cinematic';

    const script: DialogueLine[] = [
      {
        speaker: 'INSPECTOR RAYMOND MAK',
        speakerColor: '#f87171',
        text: "Down on the ground, Shen! Down! You're done. Put the cuffs on him!",
        audioKey: 'raymond_interrogate',
        durationSec: 3.5,
        cameraEye: [26.0, 1.4, 38.5],
        cameraTarget: [27.0, 0.3, 40.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "Get your damn hands off me, Mak.",
        durationSec: 2.4,
        cameraEye: [27.5, 0.8, 40.5],
        cameraTarget: [26.5, 1.2, 39.0]
      },
      {
        speaker: 'INSPECTOR RAYMOND MAK',
        speakerColor: '#f87171',
        text: "Save it for Central Station. You're going away for a very long time.",
        durationSec: 3.2,
        cameraEye: [25.5, 2.2, 42.0],
        cameraTarget: [27.0, 0.5, 39.5]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startInterrogationCinematic(sceneGraph, crowdSystem, cameraController, audioEngine);
    });
  }

  /**
   * Chapter 1, Scene 1: Interrogation Room & Superintendent Pendrew Briefing
   */
  public startInterrogationCinematic(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_interrogation_cinematic';
    crowdSystem.spawnHoldingCellsNPCs(sceneGraph);

    const script: DialogueLine[] = [
      {
        speaker: 'INSPECTOR RAYMOND MAK',
        speakerColor: '#f87171',
        text: "Wei Shen. Born in Hong Kong. Moved to San Francisco. Joined the SFPD. Now you're back here dealing on the Aberdeen docks.",
        audioKey: 'raymond_interrogate',
        durationSec: 4.2,
        cameraEye: [-1.2, 1.7, 4.0],
        cameraTarget: [-2.2, 1.2, 1.2]
      },
      {
        speaker: 'SUPERINTENDENT THOMAS PENDREW',
        speakerColor: '#34d399',
        text: "Leave us, Raymond. Officer Shen answers to me.",
        audioKey: 'pendrew_briefing',
        durationSec: 3.0,
        cameraEye: [-3.8, 1.8, 1.0],
        cameraTarget: [-2.0, 1.5, 2.5]
      },
      {
        speaker: 'SUPERINTENDENT THOMAS PENDREW',
        speakerColor: '#34d399',
        text: "The Sun On Yee is tearing this city apart, Wei. Jackie Ma, your childhood friend from Old Temple Street, is in the holding cells right now.",
        audioKey: 'pendrew_briefing',
        durationSec: 4.5,
        cameraEye: [-2.5, 1.6, 2.8],
        cameraTarget: [-2.2, 1.2, 1.2]
      },
      {
        speaker: 'SUPERINTENDENT THOMAS PENDREW',
        speakerColor: '#34d399',
        text: "Go inside the cells. Protect Jackie. He's your ticket into Winston Chu's Water Street Boys.",
        durationSec: 3.5,
        cameraEye: [-1.5, 1.9, 0.5],
        cameraTarget: [-2.2, 1.4, 1.2]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startHoldingCellsBrawl(cameraController, audioEngine);
    });
  }

  /**
   * Chapter 1, Scene 2: Holding Cells Brawl with Jackie Ma
   */
  public startHoldingCellsBrawl(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_holding_cells_brawl';
    this.thugsDefeated = 0;
    this.thugsTotal = 3;
    this.endCutscene(cameraController);

    audioEngine.playTrack('jackie_reunion').catch(() => {});
    audioEngine.playTrack('triad_brawl_shout').catch(() => {});

    this.updateHUD(
      'CHAPTER 1: GOING UNDER — HOLDING CELLS',
      `🛡️ Defend Jackie Ma! Eliminate rival triad inmates (${this.thugsDefeated}/${this.thugsTotal}) [Fight alongside Jackie Ma]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '👥 DEFEND JACKIE MA! BRAWL INMATES! 👥';
      this.actionPrompt.style.background = 'rgba(59, 130, 246, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 3500);
    }
  }

  /**
   * Chapter 1, Scene 3: Bailout & Golden Koi Departure Cinematic
   */
  public startBailoutCinematic(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_bailout_cinematic';

    const script: DialogueLine[] = [
      {
        speaker: 'JACKIE MA',
        speakerColor: '#fbbf24',
        text: "Wei! Holy shit, man! You took down three 18K heavies with your bare hands! You haven't lost a step!",
        audioKey: 'jackie_reunion',
        durationSec: 3.6,
        cameraEye: [-1.0, 1.6, 3.2],
        cameraTarget: [-2.2, 1.3, 1.5]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "Just like back on Old Temple Street. How'd you get mixed up with the Water Street Boys, Jackie?",
        durationSec: 3.2,
        cameraEye: [-3.0, 1.5, 1.2],
        cameraTarget: [-2.0, 1.4, 2.2]
      },
      {
        speaker: 'JACKIE MA',
        speakerColor: '#fbbf24',
        text: "Winston Chu is running North Point now. He needs real fighters. Come on, I gotta introduce you to him at the Golden Koi!",
        durationSec: 3.8,
        cameraEye: [-2.5, 2.4, 4.8],
        cameraTarget: [-2.2, 1.2, 1.8]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startVendorExtortionGoldenKoi(sceneGraph, crowdSystem, cameraController, audioEngine);
    });
  }

  /**
   * Chapter 1, Scene 4: Winston Chu's Golden Koi Shakedown Briefing
   */
  public startVendorExtortionGoldenKoi(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_extortion_golden_koi_cinematic';
    crowdSystem.spawnVendorExtortionCast(sceneGraph);

    const script: DialogueLine[] = [
      {
        speaker: 'WINSTON CHU',
        speakerColor: '#ef4444',
        text: "Jackie says you can fight, Shen. But talk is cheap in North Point. Can you earn for Water Street?",
        audioKey: 'winston_shakedown',
        durationSec: 4.0,
        cameraEye: [-3.8, 1.8, 26.5],
        cameraTarget: [-2.2, 1.4, 24.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "Try me, Winston.",
        durationSec: 2.0,
        cameraEye: [-1.2, 1.6, 22.5],
        cameraTarget: [-2.2, 1.4, 24.0]
      },
      {
        speaker: 'WINSTON CHU',
        speakerColor: '#ef4444',
        text: "The night market vendors think they don't have to pay protection. Go collect from the Watch Vendor and Drink Vendor. Remind them who owns these streets.",
        audioKey: 'winston_shakedown',
        durationSec: 4.5,
        cameraEye: [-3.0, 2.2, 27.0],
        cameraTarget: [-2.2, 1.3, 24.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'ch1_extortion_watch_vendor';
      this.endCutscene(cameraController);
      this.updateHUD(
        'MISSION: VENDOR EXTORTION — WATCH STALL',
        '⏱️ Head to the Night Market Watch Vendor stall and collect Water Street protection tribute! [Press F]'
      );
    });
  }

  /**
   * Called when player collects extortion from Watch Vendor
   */
  public collectWatchVendorTribute(audioEngine: AudioEngine): void {
    this.stage = 'ch1_extortion_drink_vendor';
    audioEngine.playTrack('hk_dialogue').catch(() => {});

    this.updateHUD(
      'MISSION: VENDOR EXTORTION — DRINK STALL',
      '🥤 +HK$ 1,500 Collected! Proceed to the Defiant Drink Vendor on the east concourse!'
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '💰 +HK$ 1,500 COLLECTED! HEAD TO DRINK VENDOR! 💰';
      this.actionPrompt.style.background = 'rgba(34, 197, 94, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Called when player confronts Drink Vendor, triggering 18K Thugs Ambush
   */
  public triggerDrinkVendorAmbush(audioEngine: AudioEngine): void {
    this.stage = 'ch1_extortion_18k_ambush';
    this.thugsDefeated = 0;
    this.thugsTotal = 4;

    audioEngine.playTrack('vendor_argument').catch(() => {});
    setTimeout(() => {
      audioEngine.playTrack('triad_threat').catch(() => {});
      audioEngine.playTrack('triad_brawl_shout').catch(() => {});
    }, 1200);

    this.updateHUD(
      'MISSION: VENDOR EXTORTION — 18K AMBUSH',
      `⚔️ Ambushed by Dogeyes' 18K Thugs (${this.thugsDefeated}/${this.thugsTotal})! [Use Telephone Booth, Dumpster & Fuse Box Environmental Finishers!]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⚠️ 18K TRIAD AMBUSH! USE ENVIRONMENTAL TAKEDOWNS! ⚠️';
      this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 3500);
    }
  }

  /**
   * Called when all 18K ambush thugs are defeated
   */
  public onAmbushThugsDefeated(audioEngine: AudioEngine): void {
    this.stage = 'ch1_extortion_return_golden_koi';
    audioEngine.playTrack('police_siren').catch(() => {});

    this.updateHUD(
      'MISSION: RETURN TO GOLDEN KOI',
      '🏆 18K Ambush Destroyed! Return to Winston Chu at the Golden Koi to deliver extortion envelopes!'
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⭐ 18K CLEARED! DELIVER TRIBUTE TO WINSTON CHU! ⭐';
      this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Completion of Vendor Extortion mission
   */
  public completeVendorExtortion(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_extortion_completed';

    const script: DialogueLine[] = [
      {
        speaker: 'WINSTON CHU',
        speakerColor: '#ef4444',
        text: "You stood your ground against Dogeyes' boys and brought back every dollar. Not bad, Shen. You got balls.",
        audioKey: 'winston_shakedown',
        durationSec: 3.8,
        cameraEye: [-3.5, 1.8, 26.0],
        cameraTarget: [-2.2, 1.4, 24.0]
      },
      {
        speaker: 'WINSTON CHU',
        speakerColor: '#ef4444',
        text: "From now on, you're Water Street. Here's keys to an apartment down the alley. Get some rest. We've got big work ahead.",
        audioKey: 'mission_fanfare',
        durationSec: 4.5,
        cameraEye: [-2.0, 2.2, 27.5],
        cameraTarget: [-2.2, 1.3, 24.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'ch1_extortion_completed';
      this.endCutscene(cameraController);

      this.updateHUD(
        'MISSION: VENDOR EXTORTION COMPLETED',
        '⭐ Winston Chu is impressed! Triad XP +500. Now go locate Dirty Ming near the food stalls!'
      );

      const sceneGraph = (window as any).renderer?.sceneGraph as SceneGraph;
      const crowdSystem = (window as any).crowdSystem as CrowdSystem;
      if (sceneGraph && crowdSystem) {
        setTimeout(() => {
          this.startNightMarketChaseFindMing(sceneGraph, crowdSystem, cameraController, audioEngine);
        }, 2500);
      }
    });
  }

  /**
   * Mission 3: "Night Market Chase" — Confront Food Stand Contact & Spot Dirty Ming
   */
  public startNightMarketChaseFindMing(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_nmc_find_ming_cinematic';
    crowdSystem.spawnMingChaseCast(sceneGraph);

    const script: DialogueLine[] = [
      {
        speaker: 'FOOD STAND CONTACT',
        speakerColor: '#facc15',
        text: "You looking for Dirty Ming? He's just past the fish crates around the corner. He's armed, watch yourself.",
        durationSec: 3.2,
        cameraEye: [3.2, 1.8, -6.5],
        cameraTarget: [4.5, 1.4, -8.0]
      },
      {
        speaker: 'DIRTY MING',
        speakerColor: '#ef4444',
        text: "What the fuck?! Wei Shen! Out of my way! Brothers, help me!",
        audioKey: 'ming_flee',
        durationSec: 3.2,
        cameraEye: [8.8, 1.7, -9.0],
        cameraTarget: [7.2, 1.4, -10.5]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startNightMarketRooftopChase(cameraController, audioEngine);
    });
  }

  /**
   * Mission 3 Stage 2: Night Market Street Chase & Scaffolding Climb
   */
  public startNightMarketRooftopChase(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_nmc_market_chase';
    this.endCutscene(cameraController);
    audioEngine.playTrack('wei_pursuit').catch(() => {});

    this.updateHUD(
      'MISSION 3: NIGHT MARKET CHASE',
      '🏃 SPRINT [Shift] & VAULT [Space]! Pursue Dirty Ming across the market stalls to the rooftop fire escape!'
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⚡ PURSUE MING! SPRINT [SHIFT] • VAULT [SPACE] ⚡';
      this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Mission 3 Stage 3: Rooftop Terrace Parkour & Knife Combat Climax
   */
  public startRooftopKnifeBrawl(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_nmc_rooftop_knife_brawl';
    this.thugsDefeated = 0;
    this.thugsTotal = 3; // Ming + 2 Blade Thugs
    this.endCutscene(cameraController);
    audioEngine.playTrack('ming_rooftop_threat').catch(() => {});

    this.updateHUD(
      'MISSION 3: ROOFTOP KNIFE CLIMAX',
      `⚔️ Cornered! Defeat Ming & 18K Blade Thugs (${this.thugsDefeated}/${this.thugsTotal})! [E: Counter Knife Disarm, F: Balcony Takedown]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '⚠️ KNIFE ATTACK! TIMED COUNTER [E] TO DISARM! ⚠️';
      this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Mission 3 Stage 4: Rooftop Arrest by Inspector Raymond Mak
   */
  public startMingArrestCinematic(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_nmc_arrest_cinematic';
    audioEngine.playTrack('police_siren').catch(() => {});

    const script: DialogueLine[] = [
      {
        speaker: 'INSPECTOR RAYMOND MAK',
        speakerColor: '#f87171',
        text: "HKPD! Freeze! Nobody move! Down on your knees, Ming! You're under arrest for extortion and assault!",
        audioKey: 'raymond_interrogate',
        durationSec: 4.2,
        cameraEye: [12.8, 5.8, -20.5],
        cameraTarget: [14.5, 4.5, -22.0]
      },
      {
        speaker: 'SUPERINTENDENT THOMAS PENDREW',
        speakerColor: '#60a5fa',
        text: "Good work, Shen. Get off this roof before Mak's tactical officers see your face. Meet your contact.",
        audioKey: 'pendrew_briefing',
        durationSec: 3.5,
        cameraEye: [15.2, 5.2, -23.0],
        cameraTarget: [14.0, 4.6, -21.5]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      audioEngine.playTrack('mission_fanfare').catch(() => {});
      this.updateHUD(
        'MISSION 3 ACCOMPLISHED: DIRTY MING APPREHENDED',
        '⭐ TRIAD RESPECT +750 • POLICE RESPECT +500 • DOJO INVITATION UNLOCKED!'
      );

      setTimeout(() => {
        this.startAmandaTour(sceneGraph, crowdSystem, cameraController, audioEngine);
      }, 2500);
    });
  }

  /**
   * Mission 4: "Amanda Tour" — Drive Amanda Cartwright to Master Kwok's Martial Arts Kung Fu Dojo
   */
  public startAmandaTour(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_amanda_drive_dojo';
    this.endCutscene(cameraController);
    crowdSystem.spawnAmandaDojoCast(sceneGraph);

    this.updateHUD(
      'MISSION 4: AMANDA TOUR & KUNG FU DOJO',
      "🚗 Drive Amanda Cartwright in the Sedan to Master Kwok's Martial Arts Dojo in the North Point Temple District!"
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '🚗 ENTER VEHICLE [F] • DRIVE TO KUNG FU DOJO 🚗';
      this.actionPrompt.style.background = 'rgba(56, 189, 248, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4500);
    }
  }

  /**
   * Mission 4 Stage 2: Master Kwok's Martial Arts School Sparring
   */
  public startDojoTraining(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_amanda_dojo_training';
    this.thugsDefeated = 0;
    this.thugsTotal = 2; // 2 Dojo Disciples
    this.endCutscene(cameraController);

    this.updateHUD(
      "MISSION 4: MASTER KWOK'S DOJO — SHAOLIN SPARRING",
      `🥋 Spar with Kung Fu Disciples (${this.thugsDefeated}/${this.thugsTotal})! [L-Click: Light Strikes, Q: Sweep Kick, E: Counter Reversal]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '🥋 DEMONSTRATE KUNG FU MASTERY TO SIFU KWOK 🥋';
      this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Mission 4 Completion: Master Kwok's Blessing & Free Roam
   */
  public completeAmandaTour(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_amanda_completed';
    audioEngine.playTrack('mission_fanfare').catch(() => {});

    const script: DialogueLine[] = [
      {
        speaker: 'SIFU KWOK (MARTIAL ARTS MASTER)',
        speakerColor: '#facc15',
        text: "Your kung fu remains pure, Wei Shen. Balance, focus, and power. You have earned the Jade Dragon blessing.",
        durationSec: 4.0,
        cameraEye: [-19.5, 1.8, 34.0],
        cameraTarget: [-18.0, 1.4, 32.0]
      },
      {
        speaker: 'AMANDA CARTWRIGHT',
        speakerColor: '#38bdf8',
        text: "That was unbelievable, Wei! You didn't tell me you were a martial arts master! I'll call you later.",
        durationSec: 3.5,
        cameraEye: [-16.8, 1.7, 31.0],
        cameraTarget: [-18.0, 1.4, 32.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'free_roam';
      this.endCutscene(cameraController);

      this.updateHUD(
        'CHAPTER 1 FULLY COMPLETED: DRAGON ENFORCER',
        '🏆 CHAPTER 1 MASTERED! • JADE DRAGON COMBOS UNLOCKED • HONG KONG CITIZEN RESPECT MAX • FREE ROAM'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🐉 DRAGON ENFORCER MASTERED • FREE ROAM UNLOCKED 🐉';
        this.actionPrompt.style.background = 'rgba(34, 197, 94, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 5500);
      }
    });
  }

  /**
   * Mission 5: "Club Bam Bam" — Winston Chu Golden Koi Briefing
   */
  public startMission5ClubBamBam(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_bambam_briefing_cinematic';
    crowdSystem.spawnClubBamBamCast(sceneGraph);

    const script: DialogueLine[] = [
      {
        speaker: 'WINSTON CHU (RED POLE LEADER)',
        speakerColor: '#ef4444',
        text: "Wei! Dogeyes' boy Benny is throwing money around at Club Bam Bam like he owns North Point. Take some boys, head over there, and show him who really controls this district!",
        audioKey: 'winston_bambam_order',
        durationSec: 5.5,
        cameraEye: [-1.2, 1.8, 25.5],
        cameraTarget: [-2.2, 1.4, 24.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "Consider it done, Winston. Benny won't be running his mouth after tonight.",
        durationSec: 3.5,
        cameraEye: [-3.0, 1.7, 23.0],
        cameraTarget: [-2.2, 1.4, 24.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'ch1_bambam_drive';
      this.endCutscene(cameraController);

      this.updateHUD(
        'MISSION 5: CLUB BAM BAM',
        '🚗 Drive across North Point to Club Bam Bam to track down Benny!'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🚗 DRIVE TO CLUB BAM BAM [WAYPOINT: 12.0, -35.0] 🚗';
        this.actionPrompt.style.background = 'rgba(56, 189, 248, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 4500);
      }
    });
  }

  /**
   * Mission 5 Stage 2: Arrival at Club Bam Bam & Bouncer Confrontation
   */
  public arriveAtClubBamBam(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_bambam_entrance_cinematic';

    const script: DialogueLine[] = [
      {
        speaker: 'CLUB BAM BAM BOUNCER',
        speakerColor: '#eab308',
        text: "Hold it right there! Private VIP event tonight. Turn around, punk.",
        durationSec: 3.5,
        cameraEye: [11.0, 1.9, -33.5],
        cameraTarget: [12.0, 1.6, -35.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "I'm here for Benny. Step aside before you get hurt.",
        durationSec: 3.0,
        cameraEye: [12.5, 1.8, -36.0],
        cameraTarget: [11.5, 1.5, -34.5]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.startClubDanceFloorBrawl(cameraController, audioEngine, sceneGraph, crowdSystem);
    });
  }

  /**
   * Mission 5 Stage 3: Dance Floor Bouncer Melee
   */
  public startClubDanceFloorBrawl(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_bambam_dancefloor_brawl';
    this.thugsDefeated = 0;
    this.thugsTotal = 2; // 2 Club Bouncers
    this.endCutscene(cameraController);

    // Start authentic electronic club dance music
    audioEngine.playTrack('bambam_club_music').catch(() => {});

    this.updateHUD(
      'MISSION 5: CLUB BAM BAM — DANCE FLOOR BRAWL',
      `👊 Eliminate Club Bam Bam Bouncers & Clear the Floor (${this.thugsDefeated}/${this.thugsTotal})! [Counters Active: R-Click / E]`
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '🔊 CLUB BAM BAM DANCE FLOOR BRAWL • DEFEAT BOUNCERS 🔊';
      this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
      setTimeout(() => {
        if (this.actionPrompt) this.actionPrompt.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Mission 5 Stage 4: VIP Lounge & Bottle/Table Smash
   */
  public advanceToVIPLounge(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_bambam_vip_lounge_brawl';
    this.thugsDefeated = 0;
    this.thugsTotal = 2; // 2 VIP Bodyguards

    const script: DialogueLine[] = [
      {
        speaker: 'BENNY (DOGEYES ASSOCIATE)',
        speakerColor: '#f97316',
        text: "Wei Shen?! How did you get up here?! Kill this bastard, now!",
        audioKey: 'benny_threat',
        durationSec: 4.5,
        cameraEye: [15.5, 2.2, -37.5],
        cameraTarget: [18.0, 1.6, -41.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.endCutscene(cameraController);
      audioEngine.playTrack('glass_shatter').catch(() => {});

      this.updateHUD(
        'MISSION 5: CLUB BAM BAM — VIP LOUNGE',
        `🍾 Defeat Elite VIP Bodyguards (${this.thugsDefeated}/${this.thugsTotal})! [Smash Bottles & VIP Tables!]`
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🍾 VIP LOUNGE SHOWDOWN • SMASH BOTTLES & TABLES 🍾';
        this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 4000);
      }
    });
  }

  /**
   * Mission 5 Stage 5: Bathroom Restroom Showdown & Urinal Finisher
   */
  public triggerBathroomRestroomShowdown(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_bambam_bathroom_climax';
    this.thugsDefeated = 0;
    this.thugsTotal = 1; // Benny himself

    const script: DialogueLine[] = [
      {
        speaker: 'BENNY',
        speakerColor: '#f97316',
        text: "Stay back, Wei! Dogeyes will skin you alive for this!",
        durationSec: 3.5,
        cameraEye: [18.0, 1.9, -40.5],
        cameraTarget: [19.5, 1.5, -42.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.endCutscene(cameraController);

      this.updateHUD(
        'MISSION 5: CLUB BAM BAM — RESTROOM SHOWDOWN',
        '🚽 Corner Benny! Execute Porcelain Urinal Environmental Finisher [F]!'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🚽 [F] PORCELAIN URINAL & MIRROR ENVIRONMENTAL TAKEDOWN 🚽';
        this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
      }
    });
  }

  /**
   * Mission 5 Completion: Benny Interrogation & Intel Secured
   */
  public completeClubBamBam(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_bambam_completed';
    audioEngine.playTrack('urinal_smash').catch(() => {});
    audioEngine.playTrack('mission_fanfare').catch(() => {});

    if (this.actionPrompt) this.actionPrompt.style.display = 'none';

    const script: DialogueLine[] = [
      {
        speaker: 'BENNY',
        speakerColor: '#f97316',
        text: "Wait! Don't! I'll tell you whatever you want! Dogeyes is meeting the jade smugglers at Aberdeen Docks tomorrow night!",
        durationSec: 4.5,
        cameraEye: [18.8, 1.6, -41.2],
        cameraTarget: [19.5, 1.2, -42.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#38bdf8',
        text: "If you're lying to me, Benny, I won't just break your club. I'll break your legs.",
        durationSec: 3.8,
        cameraEye: [20.2, 1.7, -42.5],
        cameraTarget: [19.5, 1.2, -42.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'free_roam';
      this.endCutscene(cameraController);

      this.updateHUD(
        'MISSION 5 COMPLETED: CLUB BAM BAM',
        '🏆 BENNY INTERROGATED • JADE SMUGGLING INTEL SECURED • TRIAD SCORE +450 • POLICE SCORE +300'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🏆 MISSION 5 COMPLETED • CASE LEAD: POPSTAR UNLOCKED 🏆';
        this.actionPrompt.style.background = 'rgba(34, 197, 94, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 5500);
      }
    });
  }

  /**
   * Chapter 1 Mission 6: "Popstar Lead 1 / Drug Bust"
   * Stage 1: Police Phone Briefing with Inspector Jane Teng
   */
  public startMission6PopstarDrugBust(
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_popstar_phone_call';
    this.thugsDefeated = 0;
    this.thugsTotal = 3;

    audioEngine.playTrack('radio_static_burst').catch(() => {});
    audioEngine.playTrack('police_radio_call').catch(() => {});

    const script: DialogueLine[] = [
      {
        speaker: 'INSPECTOR JANE TENG (HKPD)',
        speakerColor: '#38bdf8',
        text: "Wei, it's Teng. We have a confirmed location on Popstar's drug supply hub in the North Point housing projects.",
        audioKey: 'teng_popstar_lead',
        durationSec: 5.5,
        cameraEye: [-1.2, 1.8, -7.0],
        cameraTarget: [-2.2, 1.4, -8.3]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#facc15',
        text: "I'll head over to the tenements, hack the CCTV camera terminal, and identify the supplier with the stash.",
        audioKey: 'wei_teng_response',
        durationSec: 4.8,
        cameraEye: [-3.0, 1.7, -9.5],
        cameraTarget: [-2.2, 1.4, -8.3]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'ch1_popstar_drive_terminal';
      this.endCutscene(cameraController);

      this.updateHUD(
        'CASE: POPSTAR LEAD 1 — DRUG BUST',
        '📍 Travel to North Point Housing Project & Access Security Camera [24.0, -48.0]'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '📞 CASE UPDATE: POPSTAR DRUG OPERATION • HEAD TO SURVEILLANCE JUNCTION 📞';
        this.actionPrompt.style.background = 'rgba(56, 189, 248, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 4500);
      }
    });
  }

  /**
   * Mission 6 Stage 2: CCTV Camera Hacking Minigame
   */
  public startPopstarCameraHacking(
    hackingMinigame: any,
    cameraController: CameraController,
    audioEngine: AudioEngine
  ): void {
    this.stage = 'ch1_popstar_camera_hacking';

    if (this.actionPrompt) this.actionPrompt.style.display = 'none';

    this.updateHUD(
      'CASE: POPSTAR LEAD 1 — CAMERA BREACH PROTOCOL',
      '🔐 Hack CCTV Terminal: Enter 4-Digit Security Code [Green: Exact, Yellow: Wrong Slot, Red: Denied]'
    );

    if (hackingMinigame) {
      hackingMinigame.startMinigame([3, 8, 1, 5], (result: any) => {
        if (result.success) {
          const sceneGraph = (window as any).renderer?.sceneGraph;
          const crowdSystem = (window as any).crowdSystem;
          if (sceneGraph && crowdSystem) {
            this.startPopstarSurveillanceFeed(cameraController, audioEngine, sceneGraph, crowdSystem);
          }
        }
      });
    }
  }

  /**
   * Mission 6 Stage 3: Surveillance Camera Feed & Supplier Tagging
   */
  public startPopstarSurveillanceFeed(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_popstar_surveillance_feed';

    // Spawn the drug ring in the alley
    crowdSystem.spawnPopstarDrugRingCast(sceneGraph);

    // Switch camera to elevated security camera perspective overlooking alley
    cameraController.setCinematicShot([28.0, 6.5, -42.0], [24.0, 0.5, -48.0], true);

    this.updateHUD(
      'CASE: POPSTAR LEAD 1 — SURVEILLANCE FEED ONLINE',
      '📹 [CCTV CAM 04 - NORTH POINT] Drug deal in progress! Identify supplier carrying the briefcase [F]!'
    );

    if (this.actionPrompt) {
      this.actionPrompt.style.display = 'block';
      this.actionPrompt.textContent = '🔴 REC • CAM 04 • [F] MARK POPSTAR SUPPLIER & DROP IN TO BUST 🔴';
      this.actionPrompt.style.background = 'rgba(239, 68, 68, 0.95)';
    }
  }

  /**
   * Mission 6 Stage 4: Alley Ambush Brawl & Handgun Gunplay
   */
  public startPopstarAmbushBrawl(
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem
  ): void {
    this.stage = 'ch1_popstar_ambush_brawl';
    this.thugsDefeated = 0;
    this.thugsTotal = 3;

    if (this.actionPrompt) this.actionPrompt.style.display = 'none';

    const script: DialogueLine[] = [
      {
        speaker: 'POPSTAR DRUG SUPPLIER',
        speakerColor: '#ef4444',
        text: "What the hell?! Who is this guy?! He's a cop! Don't let him leave this alley alive!",
        audioKey: 'drug_dealer_threat',
        durationSec: 4.5,
        cameraEye: [26.0, 1.8, -45.5],
        cameraTarget: [24.0, 1.4, -48.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.endCutscene(cameraController);

      this.updateHUD(
        'CASE: POPSTAR LEAD 1 — ALLEY AMBUSH',
        `⚔️ Defeat Popstar's Supplier & Enforcers (${this.thugsDefeated}/${this.thugsTotal})! [Press G for Handgun / Melee Combos]`
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '⚔️ POPSTAR AMBUSH • PRESS [G] TO DRAW 9MM HANDGUN OR USE MELEE ⚔️';
        this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 4500);
      }
    });
  }

  /**
   * Mission 6 Completion: Jane Teng Confirmation & XP Rewards
   */
  public completePopstarDrugBust(cameraController: CameraController, audioEngine: AudioEngine): void {
    this.stage = 'ch1_popstar_bust_completed';

    audioEngine.playTrack('teng_bust_complete').catch(() => {});
    audioEngine.playTrack('police_siren').catch(() => {});
    audioEngine.playTrack('mission_fanfare').catch(() => {});

    if (this.actionPrompt) this.actionPrompt.style.display = 'none';

    const script: DialogueLine[] = [
      {
        speaker: 'INSPECTOR JANE TENG (HKPD)',
        speakerColor: '#38bdf8',
        text: "Outstanding work, Wei. Tactical units are moving in to sweep the stash and take them down to Central. Popstar is feeling the heat.",
        audioKey: 'teng_bust_complete',
        durationSec: 5.2,
        cameraEye: [25.5, 2.0, -46.5],
        cameraTarget: [24.0, 1.2, -48.0]
      },
      {
        speaker: 'WEI SHEN',
        speakerColor: '#facc15',
        text: "Copy that, Teng. Sun On Yee won't be happy about losing their top dealer. I'm moving on to Dogeyes next.",
        durationSec: 4.0,
        cameraEye: [23.0, 1.8, -49.0],
        cameraTarget: [24.0, 1.2, -48.0]
      }
    ];

    this.playCutscene(script, cameraController, audioEngine, () => {
      this.stage = 'free_roam';
      this.endCutscene(cameraController);

      this.updateHUD(
        'CASE COMPLETED: POPSTAR LEAD 1',
        '🏆 POPSTAR DRUG RING BUSTED • COP SCORE +500 • TRIAD SCORE +350 • FIREARMS PROFICIENCY UNLOCKED'
      );

      if (this.actionPrompt) {
        this.actionPrompt.style.display = 'block';
        this.actionPrompt.textContent = '🏆 CASE 1 COMPLETED: POPSTAR BUSTED • COP LEVEL UP • POLICE SCORE +500 🏆';
        this.actionPrompt.style.background = 'rgba(34, 197, 94, 0.95)';
        setTimeout(() => {
          if (this.actionPrompt) this.actionPrompt.style.display = 'none';
        }, 5500);
      }
    });
  }

  /**
   * Cutscene Player & Timeline Engine
   */
  public playCutscene(
    script: DialogueLine[],
    cameraController: CameraController,
    audioEngine: AudioEngine,
    onComplete?: () => void
  ): void {
    this.isCutscene = true;
    this.activeDialogueScript = script;
    this.currentLineIndex = 0;
    this.lineTimer = 0.0;
    this.onCutsceneEndCallback = onComplete || null;

    document.body.classList.add('cinematic-active');

    // Show initial line
    this.displayCurrentLine(cameraController, audioEngine);
  }

  private displayCurrentLine(cameraController: CameraController, audioEngine: AudioEngine): void {
    if (this.currentLineIndex >= this.activeDialogueScript.length) {
      this.finishActiveCutscene();
      return;
    }

    const line = this.activeDialogueScript[this.currentLineIndex];
    this.lineTimer = line.durationSec;

    if (this.cinematicSpeaker) {
      this.cinematicSpeaker.textContent = line.speaker;
      this.cinematicSpeaker.style.color = line.speakerColor || '#facc15';
    }

    if (this.cinematicSubtitles) {
      this.cinematicSubtitles.textContent = line.text;
    }

    // Direct cinematic camera angle
    cameraController.setCinematicShot(line.cameraEye, line.cameraTarget, true);

    // Play dialogue audio clip if bound
    if (line.audioKey) {
      audioEngine.playTrack(line.audioKey).catch(() => {});
    }
  }

  public advanceDialogueLine(): void {
    if (!this.isCutscene) return;
    this.currentLineIndex++;
    if (this.currentLineIndex >= this.activeDialogueScript.length) {
      this.finishActiveCutscene();
    } else {
      this.lineTimer = this.activeDialogueScript[this.currentLineIndex].durationSec;
      const cameraController = (window as any).cameraController as CameraController;
      const audioEngine = (window as any).audioEngine as AudioEngine;
      if (cameraController && audioEngine) {
        this.displayCurrentLine(cameraController, audioEngine);
      }
    }
  }

  private finishActiveCutscene(): void {
    this.isCutscene = false;
    document.body.classList.remove('cinematic-active');

    const cameraController = (window as any).cameraController as CameraController;
    if (cameraController) {
      cameraController.endCinematic();
    }

    if (this.onCutsceneEndCallback) {
      const cb = this.onCutsceneEndCallback;
      this.onCutsceneEndCallback = null;
      cb();
    }
  }

  public endCutscene(cameraController: CameraController): void {
    this.isCutscene = false;
    document.body.classList.remove('cinematic-active');
    cameraController.endCinematic();
  }

  /**
   * Per-frame story state update
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isPlayerDriving: boolean,
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    combatSystem: CombatSystem
  ): void {
    // 1. Cutscene dialogue timer advance
    if (this.isCutscene) {
      this.lineTimer -= deltaTimeSec;
      if (this.lineTimer <= 0) {
        this.currentLineIndex++;
        if (this.currentLineIndex >= this.activeDialogueScript.length) {
          this.finishActiveCutscene();
        } else {
          this.displayCurrentLine(cameraController, audioEngine);
        }
      }
      return;
    }

    // 2. Mission Stage Checks
    if (this.stage === 'prologue_chase') {
      const distToAlley = Math.hypot(playerPos[0] - 26.0, playerPos[2] - 36.0);
      if (distToAlley <= 5.5) {
        this.startPrologueAlleyFight(audioEngine);
      }
    } else if (this.stage === 'ch1_extortion_watch_vendor') {
      const distToWatch = Math.hypot(playerPos[0] - (-9.5), playerPos[2] - (-12.0));
      if (distToWatch <= 4.0) {
        if (this.actionPrompt) {
          this.actionPrompt.style.display = 'block';
          this.actionPrompt.textContent = '[F] INTIMIDATE WATCH VENDOR';
          this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
        }
      }
    } else if (this.stage === 'ch1_extortion_drink_vendor') {
      const distToDrink = Math.hypot(playerPos[0] - 6.8, playerPos[2] - 15.0);
      if (distToDrink <= 4.5) {
        this.triggerDrinkVendorAmbush(audioEngine);
      }
    } else if (this.stage === 'ch1_extortion_return_golden_koi') {
      const distToGoldenKoi = Math.hypot(playerPos[0] - (-2.2), playerPos[2] - 24.0);
      if (distToGoldenKoi <= 5.0) {
        this.completeVendorExtortion(cameraController, audioEngine);
      }
    } else if (this.stage === 'ch1_nmc_market_chase') {
      const distToRooftop = Math.hypot(playerPos[0] - 14.5, playerPos[2] - (-22.0));
      if (distToRooftop <= 5.5) {
        this.startRooftopKnifeBrawl(cameraController, audioEngine);
      }
    } else if (this.stage === 'ch1_amanda_drive_dojo') {
      const distToDojo = Math.hypot(playerPos[0] - (-18.0), playerPos[2] - 32.0);
      if (distToDojo <= 7.0) {
        this.startDojoTraining(cameraController, audioEngine);
      }
    } else if (this.stage === 'ch1_bambam_drive') {
      const distToClub = Math.hypot(playerPos[0] - 12.0, playerPos[2] - (-35.0));
      if (distToClub <= 6.5) {
        this.arriveAtClubBamBam(cameraController, audioEngine, sceneGraph, crowdSystem);
      }
    } else if (this.stage === 'ch1_popstar_drive_terminal') {
      const distToTerminal = Math.hypot(playerPos[0] - 24.0, playerPos[2] - (-48.0));
      if (distToTerminal <= 6.5) {
        if (this.actionPrompt) {
          this.actionPrompt.style.display = 'block';
          this.actionPrompt.textContent = '🔐 [F] HACK CCTV SURVEILLANCE TERMINAL 🔐';
          this.actionPrompt.style.background = 'rgba(234, 179, 8, 0.95)';
        }
      }
    }
  }

  /**
   * Called when an enemy NPC is defeated during combat
   */
  public onEnemyDefeated(
    npcId: string,
    cameraController: CameraController,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph,
    crowdSystem: CrowdSystem,
    combatSystem: CombatSystem
  ): void {
    if (this.stage === 'prologue_alley_fight') {
      this.thugsDefeated++;
      combatSystem.triadScore += 150;
      this.updateHUD(
        'PROLOGUE: ALLEY CONFRONTATION',
        `👊 Cornered! Defeat corrupt dock brawlers (${this.thugsDefeated}/${this.thugsTotal})`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.startPrologueArrestCinematic(cameraController, audioEngine, sceneGraph, crowdSystem);
        }, 1200);
      }
    } else if (this.stage === 'ch1_holding_cells_brawl') {
      this.thugsDefeated++;
      combatSystem.triadScore += 200;
      this.updateHUD(
        'CHAPTER 1: GOING UNDER — HOLDING CELLS',
        `🛡️ Defend Jackie Ma! Eliminate rival triad inmates (${this.thugsDefeated}/${this.thugsTotal})`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.startBailoutCinematic(cameraController, audioEngine, sceneGraph, crowdSystem);
        }, 1200);
      }
    } else if (this.stage === 'ch1_extortion_18k_ambush') {
      this.thugsDefeated++;
      combatSystem.triadScore += 250;
      this.updateHUD(
        'MISSION: VENDOR EXTORTION — 18K AMBUSH',
        `⚔️ Defeat Dogeyes' 18K Thugs (${this.thugsDefeated}/${this.thugsTotal})! [Use Telephone Booth, Dumpster & Fuse Box Finishers!]`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.onAmbushThugsDefeated(audioEngine);
        }, 1200);
      }
    } else if (this.stage === 'ch1_nmc_rooftop_knife_brawl') {
      this.thugsDefeated++;
      combatSystem.triadScore += 300;
      this.updateHUD(
        'MISSION 3: ROOFTOP KNIFE CLIMAX',
        `⚔️ Cornered! Defeat Ming & 18K Blade Thugs (${this.thugsDefeated}/${this.thugsTotal})!`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.startMingArrestCinematic(cameraController, audioEngine, sceneGraph, crowdSystem);
        }, 1200);
      }
    } else if (this.stage === 'ch1_amanda_dojo_training') {
      this.thugsDefeated++;
      combatSystem.policeScore += 250;
      this.updateHUD(
        "MISSION 4: MASTER KWOK'S DOJO — SHAOLIN SPARRING",
        `🥋 Spar with Kung Fu Disciples (${this.thugsDefeated}/${this.thugsTotal})!`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.completeAmandaTour(cameraController, audioEngine);
        }, 1200);
      }
    } else if (this.stage === 'ch1_bambam_dancefloor_brawl') {
      this.thugsDefeated++;
      combatSystem.triadScore += 300;
      this.updateHUD(
        'MISSION 5: CLUB BAM BAM — DANCE FLOOR BRAWL',
        `👊 Eliminate 18K Bouncers & Clear the Floor (${this.thugsDefeated}/${this.thugsTotal})!`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.advanceToVIPLounge(cameraController, audioEngine, sceneGraph, crowdSystem);
        }, 1200);
      }
    } else if (this.stage === 'ch1_bambam_vip_lounge_brawl') {
      this.thugsDefeated++;
      combatSystem.triadScore += 350;
      this.updateHUD(
        'MISSION 5: CLUB BAM BAM — VIP LOUNGE',
        `🍾 Defeat Elite Bodyguards (${this.thugsDefeated}/${this.thugsTotal})! [Smash Bottles & Tables]`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.triggerBathroomRestroomShowdown(cameraController, audioEngine, sceneGraph, crowdSystem);
        }, 1200);
      }
    } else if (this.stage === 'ch1_bambam_bathroom_climax') {
      this.thugsDefeated++;
      combatSystem.policeScore += 400;
      combatSystem.triadScore += 400;
      this.updateHUD(
        'MISSION 5: CLUB BAM BAM — RESTROOM TAKEDOWN',
        `🚽 Interrogate Benny & Secure Intel (${this.thugsDefeated}/${this.thugsTotal})!`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.completeClubBamBam(cameraController, audioEngine);
        }, 1200);
      }
    } else if (this.stage === 'ch1_popstar_ambush_brawl') {
      this.thugsDefeated++;
      combatSystem.policeScore += 250;
      combatSystem.triadScore += 200;
      this.updateHUD(
        'CASE: POPSTAR LEAD 1 — ALLEY AMBUSH',
        `⚔️ Defeat Popstar's Supplier & Enforcers (${this.thugsDefeated}/${this.thugsTotal})! [Press G for Handgun / Melee Combos]`
      );

      if (this.thugsDefeated >= this.thugsTotal) {
        setTimeout(() => {
          this.completePopstarDrugBust(cameraController, audioEngine);
        }, 1200);
      }
    }
  }

  /**
   * Returns current active mission waypoint coordinates for radar & GPS pathing
   */
  public getActiveObjectivePos(): [number, number] | null {
    if (this.stage === 'prologue_chase') return [26.0, 36.0];
    if (this.stage === 'prologue_alley_fight') return [26.0, 38.0];
    if (this.stage === 'ch1_holding_cells_brawl') return [-2.2, 2.5];
    if (this.stage === 'ch1_extortion_watch_vendor') return [-9.5, -12.0];
    if (this.stage === 'ch1_extortion_drink_vendor') return [6.8, 15.0];
    if (this.stage === 'ch1_extortion_18k_ambush') return [-4.0, 0.0];
    if (this.stage === 'ch1_extortion_return_golden_koi') return [-2.2, 24.0];
    if (this.stage === 'ch1_nmc_find_ming_cinematic') return [4.5, -8.0];
    if (this.stage === 'ch1_nmc_market_chase' || this.stage === 'ch1_nmc_rooftop_parkour') return [14.5, -22.0];
    if (this.stage === 'ch1_nmc_rooftop_knife_brawl') return [14.5, -22.0];
    if (this.stage === 'ch1_amanda_drive_dojo') return [-18.0, 32.0];
    if (this.stage === 'ch1_amanda_dojo_training') return [-18.0, 32.0];
    if (this.stage === 'ch1_bambam_drive') return [12.0, -35.0];
    if (this.stage === 'ch1_bambam_dancefloor_brawl') return [12.0, -35.0];
    if (this.stage === 'ch1_bambam_vip_lounge_brawl') return [16.5, -39.0];
    if (this.stage === 'ch1_bambam_bathroom_climax') return [19.5, -42.0];
    if (
      this.stage === 'ch1_popstar_drive_terminal' ||
      this.stage === 'ch1_popstar_camera_hacking' ||
      this.stage === 'ch1_popstar_surveillance_feed' ||
      this.stage === 'ch1_popstar_ambush_brawl'
    ) return [24.0, -48.0];
    return null;
  }

  private updateHUD(title: string, objective: string): void {
    if (this.missionTitle) this.missionTitle.textContent = title;
    if (this.missionObjective) this.missionObjective.textContent = objective;
  }
}
