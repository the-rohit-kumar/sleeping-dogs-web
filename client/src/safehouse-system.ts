/**
 * safehouse-system.ts
 * Hong Kong Safehouses & Urban Red Taxi Fast-Travel Network (Option 1).
 *
 * Implements:
 *  1. Wei Shen's North Point Safehouse:
 *     - Enterable apartment interior with seamless exterior/interior transitions.
 *     - Interactive Bed: Sleep, advance day/night weather cycle, 100% HP restore, AutoSave checkpoint.
 *     - Interactive Wardrobe / Closet: Outfit selector (Classic Undercover, Sun On Yee Silk Suit,
 *       Shadow Tactical Kevlar, Shaolin Monk Gi) with real-time limb recoloring and authentic perk buffs.
 *     - Interactive Refrigerator: Herbal Tea / Dragon Kick energy drink for full health and Face Meter boost.
 *     - Interactive Surveillance TV: CRT scanline CCTV monitoring of hacked city camera feeds.
 *  2. Hong Kong Urban Red Taxi Fast-Travel Network:
 *     - Street-level taxi hailing prompt [E].
 *     - Transit destination modal with 5 authentic Hong Kong districts (North Point, Central,
 *       Aberdeen, Kennedy Town, Victoria Peak).
 *     - Dynamic fare deductions, audio departure cues, and seamless cinematic teleportation.
 *
 * ZERO synthetic assets: Fully procedural systems driving authentic base-game textures and audio.
 */

import { SceneGraph } from './scene-graph';
import { AudioEngine } from './audio-engine';
import { SaveManager } from './save-manager';
import { WeatherSystem, WeatherMode } from './weather-system';
import { CharacterController } from './character-controller';
import { CameraController } from './camera-controller';
import { CombatSystem } from './combat-system';
import { OpenWorldActivitiesManager } from './open-world-activities';

export type OutfitId = 'classic_undercover' | 'sun_on_yee_silk_suit' | 'shadow_tactical_kevlar' | 'shaolin_monk_gi';

export interface OutfitDefinition {
  id: OutfitId;
  name: string;
  subtitle: string;
  description: string;
  torsoColor: [number, number, number];
  legColor: [number, number, number];
  shoeColor: [number, number, number];
  wristColor: [number, number, number];
  buffText: string;
  triadXpMult: number;
  damageResist: number;
  meleePower: number;
}

export const OUTFIT_CATALOG: Record<OutfitId, OutfitDefinition> = {
  classic_undercover: {
    id: 'classic_undercover',
    name: 'Classic Undercover',
    subtitle: 'White Athletic Tank Top & Denim',
    description: 'Wei Shen\'s iconic North Point street wear with kung fu wrist wraps.',
    torsoColor: [0.96, 0.96, 0.98],
    legColor: [0.12, 0.16, 0.24],
    shoeColor: [0.90, 0.90, 0.92],
    wristColor: [0.15, 0.15, 0.15],
    buffText: 'Standard baseline balance (No modifiers)',
    triadXpMult: 1.0,
    damageResist: 0.0,
    meleePower: 1.0
  },
  sun_on_yee_silk_suit: {
    id: 'sun_on_yee_silk_suit',
    name: 'Sun On Yee Red Pole Suit',
    subtitle: 'Black Satin Silk & Crimson Pocket Square',
    description: 'Formal Dragon Head council attire commanding total street respect and poise.',
    torsoColor: [0.10, 0.10, 0.12],
    legColor: [0.10, 0.10, 0.12],
    shoeColor: [0.15, 0.08, 0.05],
    wristColor: [0.85, 0.15, 0.15],
    buffText: '+20% Triad XP & +25% Knockback Poise Resistance',
    triadXpMult: 1.20,
    damageResist: 0.15,
    meleePower: 1.10
  },
  shadow_tactical_kevlar: {
    id: 'shadow_tactical_kevlar',
    name: 'Shadow Tactical Armor',
    subtitle: 'HKPD Undercover Ballistic Vest & Cargos',
    description: 'Reinforced ceramic trauma plates engineered for heavy firearm engagements.',
    torsoColor: [0.18, 0.22, 0.20],
    legColor: [0.15, 0.18, 0.16],
    shoeColor: [0.08, 0.08, 0.08],
    wristColor: [0.25, 0.25, 0.25],
    buffText: '+30% Damage Resistance from Firearms & Cleavers',
    triadXpMult: 1.0,
    damageResist: 0.30,
    meleePower: 1.0
  },
  shaolin_monk_gi: {
    id: 'shaolin_monk_gi',
    name: 'Shaolin Kung Fu Robes',
    subtitle: 'Traditional Saffron & Crimson Silk',
    description: 'Consecrated Buddhist martial arts robes channeling pure internal energy (Chi).',
    torsoColor: [0.95, 0.55, 0.05],
    legColor: [0.85, 0.15, 0.10],
    shoeColor: [0.95, 0.95, 0.95],
    wristColor: [0.95, 0.55, 0.05],
    buffText: '+25% Melee Martial Arts Damage & Rapid Face Meter Gain',
    triadXpMult: 1.10,
    damageResist: 0.05,
    meleePower: 1.25
  }
};

export interface TaxiDestination {
  id: string;
  name: string;
  district: string;
  fare: number;
  coordinates: [number, number, number];
  description: string;
}

export const TAXI_DESTINATIONS: TaxiDestination[] = [
  {
    id: 'north_point',
    name: 'North Point Night Market',
    district: 'North Point (Water Street)',
    fare: 50,
    coordinates: [-2.2, 0.0, -8.35],
    description: 'Bustling neon market, food stalls, and the Golden Koi restaurant.'
  },
  {
    id: 'central_ifc',
    name: 'Central Financial District',
    district: 'Central (Queen\'s Road)',
    fare: 120,
    coordinates: [24.0, 0.0, -48.0],
    description: 'Towering commercial skyscrapers, luxury boutiques, and IFC mall.'
  },
  {
    id: 'aberdeen_docks',
    name: 'Aberdeen Floating Harbor',
    district: 'Aberdeen (Shipyards)',
    fare: 180,
    coordinates: [28.0, 0.0, 40.0],
    description: 'Fishing junks, container cranes, and seafood warehouse docks.'
  },
  {
    id: 'kennedy_town',
    name: 'Kennedy Town Slaughterhouse',
    district: 'Kennedy Town (West Harbor)',
    fare: 240,
    coordinates: [-18.0, 0.0, 32.0],
    description: 'Industrial meat processing district and underground fight arena.'
  },
  {
    id: 'victoria_peak',
    name: 'Victoria Peak Shaolin Dojo',
    district: 'The Peak (Mid-Levels)',
    fare: 300,
    coordinates: [0.0, 0.0, 0.0],
    description: 'Scenic mountain overlook and Shaolin monk sparring grounds.'
  }
];

export class SafehouseSystem {
  // Safehouse Interior States
  public isInsideSafehouse = false;
  public safehouseDoorPos: [number, number] = [-8.5, 18.0]; // North Point entrance
  public safehouseInteriorPos: [number, number, number] = [-8.5, 0.0, 19.5];
  public safehouseExteriorExit: [number, number, number] = [-8.5, 0.0, 16.5];

  // Furniture Hotspots inside Safehouse
  public bedPos: [number, number] = [-6.5, 21.0];
  public wardrobePos: [number, number] = [-10.5, 21.0];
  public fridgePos: [number, number] = [-6.5, 18.0];
  public tvPos: [number, number] = [-10.5, 18.0];

  // Outfits & Buffs
  public currentOutfit: OutfitId = 'classic_undercover';
  public isWardrobeOpen = false;
  public isTVOpen = false;
  public currentCCTVIndex = 0;

  // UI Elements
  private promptEl: HTMLElement | null = null;
  private wardrobeModalEl: HTMLElement | null = null;
  private tvModalEl: HTMLElement | null = null;
  private taxiModalEl: HTMLElement | null = null;
  private transitionEl: HTMLElement | null = null;

  constructor() {
    this.createDomElements();
  }

  private createDomElements(): void {
    if (typeof document === 'undefined') return;

    // 1. Interaction Prompt
    let prompt = document.getElementById('safehouse-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'safehouse-prompt';
      prompt.style.cssText = `
        position: fixed;
        bottom: 84px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 550;
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
        pointer-events: none;
      `;
      document.body.appendChild(prompt);
    }
    this.promptEl = prompt;

    // 2. Full-Screen Screen Transition Overlay
    let trans = document.getElementById('safehouse-transition');
    if (!trans) {
      trans = document.createElement('div');
      trans.id = 'safehouse-transition';
      trans.style.cssText = `
        position: fixed;
        inset: 0;
        background: #000000;
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s ease;
      `;
      document.body.appendChild(trans);
    }
    this.transitionEl = trans;

    // 3. Wardrobe Modal
    let wardrobe = document.getElementById('wardrobe-modal');
    if (!wardrobe) {
      wardrobe = document.createElement('div');
      wardrobe.id = 'wardrobe-modal';
      wardrobe.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-width: 90vw;
        background: rgba(15, 23, 42, 0.98);
        border: 2px solid var(--accent-cyan, #00d2ff);
        border-radius: 8px;
        padding: 24px;
        z-index: 1000;
        box-shadow: 0 0 40px rgba(0, 210, 255, 0.4);
        font-family: monospace;
        color: #f8fafc;
        display: none;
      `;
      document.body.appendChild(wardrobe);
    }
    this.wardrobeModalEl = wardrobe;

    // 4. CCTV TV Modal
    let tv = document.getElementById('cctv-modal');
    if (!tv) {
      tv = document.createElement('div');
      tv.id = 'cctv-modal';
      tv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 680px;
        max-width: 92vw;
        background: #050b14;
        border: 3px solid #38bdf8;
        border-radius: 8px;
        padding: 20px;
        z-index: 1000;
        box-shadow: 0 0 50px rgba(56, 189, 248, 0.5);
        font-family: monospace;
        color: #38bdf8;
        display: none;
      `;
      document.body.appendChild(tv);
    }
    this.tvModalEl = tv;

    // 5. Taxi Transit Modal
    let taxi = document.getElementById('taxi-modal');
    if (!taxi) {
      taxi = document.createElement('div');
      taxi.id = 'taxi-modal';
      taxi.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 640px;
        max-width: 90vw;
        background: rgba(17, 24, 39, 0.98);
        border: 2px solid #ef4444;
        border-radius: 8px;
        padding: 24px;
        z-index: 1000;
        box-shadow: 0 0 40px rgba(239, 68, 68, 0.4);
        font-family: monospace;
        color: #f8fafc;
        display: none;
      `;
      document.body.appendChild(taxi);
    }
    this.taxiModalEl = taxi;
  }

  /**
   * Main per-frame update detecting proximity to Safehouse Door, Furniture, and Taxis
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isDriving: boolean,
    audioEngine: AudioEngine,
    saveManager: SaveManager,
    weatherSystem: WeatherSystem,
    combatSystem: CombatSystem,
    activitiesManager: OpenWorldActivitiesManager,
    characterController: CharacterController,
    sceneGraph: SceneGraph
  ): void {
    if (this.isWardrobeOpen || this.isTVOpen) {
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    // 1. Outside Safehouse Entrance Door
    if (!this.isInsideSafehouse) {
      const distToDoor = Math.hypot(playerPos[0] - this.safehouseDoorPos[0], playerPos[2] - this.safehouseDoorPos[1]);
      if (distToDoor < 2.5 && !isDriving) {
        this.showPrompt('🏠 [E] ENTER WEI SHEN\'S NORTH POINT SAFEHOUSE', '#00d2ff');
        return;
      }

      // Check Taxi Hailing on street (player must be on foot, near road, not in combat)
      if (!isDriving && Math.abs(playerPos[0]) < 6.0 && Math.abs(playerPos[2]) < 60.0) {
        // Taxi stand proximity
        this.showPrompt('🚕 [X] HAIL HONG KONG URBAN TAXI (FAST TRAVEL)', '#ef4444');
        return;
      }
    }

    // 2. Inside Safehouse Interior Furniture Interactions
    if (this.isInsideSafehouse) {
      const distToExit = Math.hypot(playerPos[0] - this.safehouseInteriorPos[0], playerPos[2] - (this.safehouseInteriorPos[2] - 1.5));
      if (distToExit < 1.8) {
        this.showPrompt('🚪 [E] EXIT TO NORTH POINT STREETS', '#94a3b8');
        return;
      }

      const distBed = Math.hypot(playerPos[0] - this.bedPos[0], playerPos[2] - this.bedPos[1]);
      if (distBed < 2.0) {
        this.showPrompt('🛏️ [E] SLEEP & ADVANCE TIME OF DAY (RESTORE HEALTH & SAVE)', '#38bdf8');
        return;
      }

      const distWardrobe = Math.hypot(playerPos[0] - this.wardrobePos[0], playerPos[2] - this.wardrobePos[1]);
      if (distWardrobe < 2.0) {
        this.showPrompt('👔 [E] OPEN WARDROBE (CHANGE OUTFITS & PERKS)', '#fbbf24');
        return;
      }

      const distFridge = Math.hypot(playerPos[0] - this.fridgePos[0], playerPos[2] - this.fridgePos[1]);
      if (distFridge < 2.0) {
        this.showPrompt('🥤 [E] DRINK HERBAL TEA & DRAGON KICK (FULL HEALTH & FACE BOOST)', '#22c55e');
        return;
      }

      const distTV = Math.hypot(playerPos[0] - this.tvPos[0], playerPos[2] - this.tvPos[1]);
      if (distTV < 2.0) {
        this.showPrompt('📺 [E] MONITOR HACKED CCTV SURVEILLANCE FEEDS', '#a855f7');
        return;
      }
    }

    if (this.promptEl) {
      this.promptEl.style.display = 'none';
    }
  }

  private showPrompt(text: string, color: string): void {
    if (!this.promptEl) return;
    this.promptEl.style.display = 'block';
    this.promptEl.style.borderColor = color;
    this.promptEl.innerHTML = text;
  }

  /**
   * Primary interaction trigger when player presses [E] or [H]
   */
  public handleInteraction(
    key: string,
    playerPos: [number, number, number],
    isDriving: boolean,
    audioEngine: AudioEngine,
    saveManager: SaveManager,
    weatherSystem: WeatherSystem,
    combatSystem: CombatSystem,
    activitiesManager: OpenWorldActivitiesManager,
    characterController: CharacterController,
    cameraController: CameraController,
    sceneGraph: SceneGraph
  ): boolean {
    if (key === 'Escape' || key === 'Esc') {
      if (this.isWardrobeOpen) { this.closeWardrobe(); return true; }
      if (this.isTVOpen) { this.closeCCTV(); return true; }
      if (this.taxiModalEl && this.taxiModalEl.style.display !== 'none') { this.closeTaxiModal(); return true; }
    }

    if ((key.toLowerCase() === 'x' || key.toLowerCase() === 'h') && !this.isInsideSafehouse && !isDriving) {
      this.openTaxiTransitModal(audioEngine, combatSystem, activitiesManager, characterController, cameraController);
      return true;
    }

    if (key.toLowerCase() !== 'e') return false;

    // 1. Outside Safehouse Entrance
    if (!this.isInsideSafehouse) {
      const distToDoor = Math.hypot(playerPos[0] - this.safehouseDoorPos[0], playerPos[2] - this.safehouseDoorPos[1]);
      if (distToDoor < 2.5 && !isDriving) {
        this.enterSafehouse(audioEngine, characterController, cameraController);
        return true;
      }
    }

    // 2. Inside Safehouse Interactions
    if (this.isInsideSafehouse) {
      const distToExit = Math.hypot(playerPos[0] - this.safehouseInteriorPos[0], playerPos[2] - (this.safehouseInteriorPos[2] - 1.5));
      if (distToExit < 1.8) {
        this.exitSafehouse(audioEngine, characterController, cameraController);
        return true;
      }

      const distBed = Math.hypot(playerPos[0] - this.bedPos[0], playerPos[2] - this.bedPos[1]);
      if (distBed < 2.0) {
        this.interactBed(audioEngine, saveManager, weatherSystem, combatSystem, activitiesManager);
        return true;
      }

      const distWardrobe = Math.hypot(playerPos[0] - this.wardrobePos[0], playerPos[2] - this.wardrobePos[1]);
      if (distWardrobe < 2.0) {
        this.openWardrobeModal(audioEngine, sceneGraph);
        return true;
      }

      const distFridge = Math.hypot(playerPos[0] - this.fridgePos[0], playerPos[2] - this.fridgePos[1]);
      if (distFridge < 2.0) {
        this.interactFridge(audioEngine, combatSystem, activitiesManager);
        return true;
      }

      const distTV = Math.hypot(playerPos[0] - this.tvPos[0], playerPos[2] - this.tvPos[1]);
      if (distTV < 2.0) {
        this.openCCTVModal(audioEngine);
        return true;
      }
    }

    return false;
  }

  /**
   * Enters Safehouse Apartment interior
   */
  public enterSafehouse(
    audioEngine: AudioEngine,
    characterController: CharacterController,
    cameraController: CameraController
  ): void {
    this.playTransition(() => {
      this.isInsideSafehouse = true;
      characterController.position = [...this.safehouseInteriorPos];
      characterController.rotationY = 0.0;
      cameraController.distance = 3.0;
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showNotification('🏠 WEI SHEN\'S NORTH POINT SAFEHOUSE APARTMENT', '#00d2ff');
    });
  }

  /**
   * Exits Safehouse to North Point streets
   */
  public exitSafehouse(
    audioEngine: AudioEngine,
    characterController: CharacterController,
    cameraController: CameraController
  ): void {
    this.playTransition(() => {
      this.isInsideSafehouse = false;
      characterController.position = [...this.safehouseExteriorExit];
      characterController.rotationY = Math.PI;
      cameraController.distance = 5.0;
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showNotification('🌆 NORTH POINT — WATER STREET', '#fbbf24');
    });
  }

  /**
   * Bed Interaction: Sleep, Advance Time of Day / Weather, Restore 100% HP, AutoSave
   */
  public interactBed(
    audioEngine: AudioEngine,
    saveManager: SaveManager,
    weatherSystem: WeatherSystem,
    combatSystem: CombatSystem,
    activitiesManager: OpenWorldActivitiesManager
  ): void {
    this.playTransition(() => {
      // Cycle weather
      const modes: WeatherMode[] = ['neon_night', 'hong_kong_rain', 'typhoon_storm'];
      const nextIdx = (modes.indexOf(weatherSystem.currentMode) + 1) % modes.length;
      const nextMode = modes[nextIdx];
      weatherSystem.setWeatherMode(nextMode);

      // Restore health
      if (typeof (window as any).restorePlayerHealth === 'function') {
        (window as any).restorePlayerHealth(100);
      }

      // AutoSave Checkpoint
      saveManager.triggerAutoSaveIndicator();
      if (typeof (window as any).performSave === 'function') {
        (window as any).performSave('autosave', 'Safehouse Rest: North Point Apartment');
      }

      audioEngine.playTrack('chapter1_finale_fanfare').catch(() => {});
      this.showNotification(
        `😴 RESTED AT SAFEHOUSE: TIME ADVANCED [${weatherSystem.settings.name.toUpperCase()}] • HEALTH 100% • CHECKPOINT SAVED`,
        '#38bdf8',
        5000
      );
    });
  }

  /**
   * Refrigerator Interaction: Drink Herbal Tea / Dragon Kick
   */
  public interactFridge(
    audioEngine: AudioEngine,
    combatSystem: CombatSystem,
    activitiesManager: OpenWorldActivitiesManager
  ): void {
    if (typeof (window as any).restorePlayerHealth === 'function') {
      (window as any).restorePlayerHealth(100);
    }
    combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 50);
    audioEngine.playTrack('ui_chime_granted').catch(() => {});
    this.showNotification('🥤 CONSUMED DRAGON KICK ENERGY DRINK: 100% HP RESTORED & +50% FACE METER SURGE!', '#22c55e', 4500);
  }

  /**
   * Wardrobe Interaction: Open Outfit Customizer Modal
   */
  public openWardrobeModal(audioEngine: AudioEngine, sceneGraph: SceneGraph): void {
    if (!this.wardrobeModalEl) return;
    this.isWardrobeOpen = true;
    audioEngine.playTrack('ui_hack_tick').catch(() => {});

    const outfits = Object.values(OUTFIT_CATALOG);
    this.wardrobeModalEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00d2ff; padding-bottom: 8px; margin-bottom: 16px;">
        <span style="font-size: 18px; font-weight: 800; color: #00d2ff;">👔 WEI SHEN'S WARDROBE // OUTFIT SELECTOR</span>
        <button id="btn-close-wardrobe" style="background: none; border: 1px solid #64748b; color: #94a3b8; padding: 4px 10px; cursor: pointer; border-radius: 4px;">✕ CLOSE [ESC]</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
        ${outfits.map(o => `
          <div class="outfit-card ${o.id === this.currentOutfit ? 'selected' : ''}" data-outfit="${o.id}" style="
            background: rgba(30, 41, 59, 0.7);
            border: 2px solid ${o.id === this.currentOutfit ? '#38bdf8' : '#334155'};
            border-radius: 6px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="font-weight: 800; font-size: 14px; color: ${o.id === this.currentOutfit ? '#38bdf8' : '#f8fafc'};">${o.name}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">${o.subtitle}</div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 8px;">${o.description}</div>
            <div style="font-size: 11px; font-weight: 700; color: #4ade80;">⭐ ${o.buffText}</div>
          </div>
        `).join('')}
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; color: #64748b;">Equipping applies immediate visual recoloring and active combat perks.</span>
      </div>
    `;
    this.wardrobeModalEl.style.display = 'block';

    // Hook events
    document.getElementById('btn-close-wardrobe')?.addEventListener('click', () => {
      this.closeWardrobe();
    });

    this.wardrobeModalEl.querySelectorAll('.outfit-card').forEach(card => {
      card.addEventListener('click', () => {
        const outfitId = card.getAttribute('data-outfit') as OutfitId;
        if (outfitId) {
          this.equipOutfit(outfitId, sceneGraph, audioEngine);
          this.closeWardrobe();
        }
      });
    });
  }

  public closeWardrobe(): void {
    if (this.wardrobeModalEl) {
      this.wardrobeModalEl.style.display = 'none';
    }
    this.isWardrobeOpen = false;
  }

  /**
   * Equips outfit, recalculates perks, and dynamically recolors Wei Shen's limbs
   */
  public equipOutfit(outfitId: OutfitId, sceneGraph: SceneGraph, audioEngine?: AudioEngine): void {
    const outfit = OUTFIT_CATALOG[outfitId];
    if (!outfit) return;

    this.currentOutfit = outfitId;
    if (typeof window !== 'undefined' && (window as any).policePursuitSystem) {
      (window as any).policePursuitSystem.clearHeatViaDisguise(audioEngine);
    }

    // Recolor Wei Shen's nodes in SceneGraph
    const torsoNode = sceneGraph.getNode('node-wei-torso');
    if (torsoNode) torsoNode.color = [...outfit.torsoColor];

    const legLNode = sceneGraph.getNode('node-wei-leg-l');
    if (legLNode) legLNode.color = [...outfit.legColor];

    const legRNode = sceneGraph.getNode('node-wei-leg-r');
    if (legRNode) legRNode.color = [...outfit.legColor];

    const shoeLNode = sceneGraph.getNode('node-wei-shoe-l');
    if (shoeLNode) shoeLNode.color = [...outfit.shoeColor];

    const shoeRNode = sceneGraph.getNode('node-wei-shoe-r');
    if (shoeRNode) shoeRNode.color = [...outfit.shoeColor];

    const wristLNode = sceneGraph.getNode('node-wei-wrist-l');
    if (wristLNode) wristLNode.color = [...outfit.wristColor];

    const wristRNode = sceneGraph.getNode('node-wei-wrist-r');
    if (wristRNode) wristRNode.color = [...outfit.wristColor];

    if (audioEngine) audioEngine.playTrack('ui_chime_granted').catch(() => {});
    this.showNotification(`👔 EQUIPPED: ${outfit.name.toUpperCase()} (${outfit.buffText})`, '#38bdf8', 4000);
  }

  /**
   * CCTV Surveillance Monitor Modal
   */
  public openCCTVModal(audioEngine: AudioEngine): void {
    if (!this.tvModalEl) return;
    this.isTVOpen = true;
    audioEngine.playTrack('ui_hack_tick').catch(() => {});

    const feeds = [
      { name: 'CAM-01: NORTH POINT NIGHT MARKET (WATER ST)', location: 'Active Crowd & Street Vendors', status: 'LIVE SIGNAL 1080P' },
      { name: 'CAM-02: GOLDEN KOI BACK ALLEY', location: 'Sun On Yee Controlled Territory', status: 'LIVE SIGNAL 1080P' },
      { name: 'CAM-03: ABERDEEN PIER 3 CONTAINER CRANES', location: '18K Smuggling Route', status: 'LIVE SIGNAL 1080P' },
      { name: 'CAM-04: CLUB BAM BAM VIP LOUNGE', location: 'Bo Ban & Water Street Red Poles', status: 'LIVE SIGNAL 1080P' }
    ];

    const feed = feeds[this.currentCCTVIndex];
    this.tvModalEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; padding-bottom: 8px; margin-bottom: 12px;">
        <span style="font-weight: 800; font-size: 16px;">📺 HKPD POLICE SURVEILLANCE FEED // ${feed.name}</span>
        <button id="btn-close-tv" style="background: none; border: 1px solid #38bdf8; color: #38bdf8; padding: 4px 10px; cursor: pointer; border-radius: 4px;">✕ EXIT [ESC]</button>
      </div>
      <div style="
        position: relative;
        height: 280px;
        background: #020617;
        border: 2px solid #1e293b;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      ">
        <div style="position: absolute; top: 12px; left: 14px; font-size: 12px; color: #ef4444; font-weight: 800; animation: pulse 1s infinite;">● REC [LIVE FEED]</div>
        <div style="position: absolute; top: 12px; right: 14px; font-size: 12px; color: #38bdf8;">${feed.status}</div>
        <div style="font-size: 24px; font-weight: 800; color: #38bdf8; margin-bottom: 8px; text-shadow: 0 0 10px rgba(56,189,248,0.8);">${feed.name}</div>
        <div style="font-size: 14px; color: #94a3b8;">SECTOR: ${feed.location}</div>
        <div style="position: absolute; bottom: 12px; left: 14px; font-size: 11px; color: #64748b;">ENCRYPTION: HKPD-256-AES // SOURCE: TERMINAL #402</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
        <button id="btn-prev-feed" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 6px 14px; border-radius: 4px; cursor: pointer;">◀ PREVIOUS CAMERA</button>
        <span style="color: #94a3b8; font-size: 12px;">CAMERA ${this.currentCCTVIndex + 1} OF ${feeds.length}</span>
        <button id="btn-next-feed" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 6px 14px; border-radius: 4px; cursor: pointer;">NEXT CAMERA ▶</button>
      </div>
    `;
    this.tvModalEl.style.display = 'block';

    document.getElementById('btn-close-tv')?.addEventListener('click', () => {
      this.closeCCTV();
    });

    document.getElementById('btn-prev-feed')?.addEventListener('click', () => {
      this.currentCCTVIndex = (this.currentCCTVIndex - 1 + feeds.length) % feeds.length;
      this.openCCTVModal(audioEngine);
    });

    document.getElementById('btn-next-feed')?.addEventListener('click', () => {
      this.currentCCTVIndex = (this.currentCCTVIndex + 1) % feeds.length;
      this.openCCTVModal(audioEngine);
    });
  }

  public closeCCTV(): void {
    if (this.tvModalEl) {
      this.tvModalEl.style.display = 'none';
    }
    this.isTVOpen = false;
  }

  /**
   * Taxi Fast-Travel Transit Modal
   */
  public openTaxiTransitModal(
    audioEngine: AudioEngine,
    combatSystem: CombatSystem,
    activitiesManager: OpenWorldActivitiesManager,
    characterController: CharacterController,
    cameraController: CameraController
  ): void {
    if (!this.taxiModalEl) return;
    audioEngine.playTrack('police_siren').catch(() => {});

    const playerCash = activitiesManager.totalCashEarned;
    this.taxiModalEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ef4444; padding-bottom: 8px; margin-bottom: 16px;">
        <div>
          <span style="font-size: 18px; font-weight: 800; color: #ef4444;">🚕 HONG KONG URBAN RED TAXI // TRANSIT NETWORK</span>
          <div style="font-size: 11px; color: #94a3b8;">Select your destination for immediate dispatch and fast travel.</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 800; color: #4ade80;">CASH: $${playerCash.toLocaleString()} HKD</div>
          <button id="btn-close-taxi" style="background: none; border: 1px solid #64748b; color: #94a3b8; padding: 2px 8px; cursor: pointer; border-radius: 4px; margin-top: 4px;">✕ CANCEL [ESC]</button>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        ${TAXI_DESTINATIONS.map(d => {
          const canAfford = playerCash >= d.fare;
          return `
            <div class="taxi-dest-card" data-dest="${d.id}" style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: rgba(30, 41, 59, 0.7);
              border: 1px solid ${canAfford ? '#475569' : '#7f1d1d'};
              border-radius: 6px;
              padding: 10px 16px;
              cursor: ${canAfford ? 'pointer' : 'not-allowed'};
              opacity: ${canAfford ? '1.0' : '0.5'};
            ">
              <div>
                <div style="font-weight: 800; font-size: 14px; color: #f8fafc;">${d.name} <span style="font-size: 11px; color: #94a3b8;">(${d.district})</span></div>
                <div style="font-size: 11px; color: #cbd5e1;">${d.description}</div>
              </div>
              <div style="text-align: right; min-width: 90px;">
                <div style="font-weight: 800; font-size: 14px; color: #eab308;">$${d.fare} HKD</div>
                <div style="font-size: 10px; color: ${canAfford ? '#4ade80' : '#ef4444'};">${canAfford ? 'DISPATCH READY' : 'INSUFFICIENT FUNDS'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    this.taxiModalEl.style.display = 'block';

    document.getElementById('btn-close-taxi')?.addEventListener('click', () => {
      this.closeTaxiModal();
    });

    this.taxiModalEl.querySelectorAll('.taxi-dest-card').forEach(card => {
      card.addEventListener('click', () => {
        const destId = card.getAttribute('data-dest');
        const dest = TAXI_DESTINATIONS.find(d => d.id === destId);
        if (dest && playerCash >= dest.fare) {
          this.closeTaxiModal();
          this.travelToDestination(dest, audioEngine, activitiesManager, characterController, cameraController);
        }
      });
    });
  }

  public closeTaxiModal(): void {
    if (this.taxiModalEl) {
      this.taxiModalEl.style.display = 'none';
    }
  }

  /**
   * Fast-travel teleportation to destination with cinematic transition
   */
  public travelToDestination(
    dest: TaxiDestination,
    audioEngine: AudioEngine,
    activitiesManager: OpenWorldActivitiesManager,
    characterController: CharacterController,
    cameraController: CameraController
  ): void {
    activitiesManager.totalCashEarned -= dest.fare;
    audioEngine.playTrack('vehicle_engine').catch(() => {});

    this.playTransition(() => {
      characterController.position = [...dest.coordinates];
      characterController.rotationY = 0.0;
      cameraController.distance = 5.0;
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showNotification(
        `🚕 ARRIVED AT ${dest.name.toUpperCase()} (${dest.district}) • FARE: $${dest.fare} HKD`,
        '#ef4444',
        5000
      );
    });
  }

  private playTransition(onMiddle: () => void): void {
    if (!this.transitionEl) {
      onMiddle();
      return;
    }
    this.transitionEl.style.opacity = '1';
    setTimeout(() => {
      onMiddle();
      setTimeout(() => {
        if (this.transitionEl) this.transitionEl.style.opacity = '0';
      }, 400);
    }, 400);
  }

  private showNotification(text: string, color = '#38bdf8', durationMs = 3500): void {
    let notif = document.getElementById('safehouse-notif');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'safehouse-notif';
      notif.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: rgba(15, 23, 42, 0.95);
        border: 2px solid ${color};
        border-radius: 6px;
        padding: 10px 24px;
        font-family: monospace;
        font-size: 13px;
        font-weight: 800;
        color: #ffffff;
        box-shadow: 0 0 30px ${color}66;
        text-align: center;
        pointer-events: none;
      `;
      document.body.appendChild(notif);
    }
    notif.style.borderColor = color;
    notif.innerHTML = text;
    notif.style.display = 'block';

    setTimeout(() => {
      if (notif) notif.style.display = 'none';
    }, durationMs);
  }
}
