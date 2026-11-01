/**
 * street-economy-system.ts
 * Authentic Sleeping Dogs Hong Kong Street Economy, Food Vendors & Clothing Boutiques.
 *
 * Implements:
 *  1. Hong Kong Street Food Vendors:
 *     - Pork Bun Vendor ("A man who never eats pork buns is never a whole man!")
 *       * Buff: WHOLE MAN RECOVERY (+25% Melee Damage + 100% HP restore)
 *     - Herbal Tea Stall
 *       * Buff: CHI RESILIENCE (-50% Damage Taken + Double Health Regen)
 *     - Dim Sum Teahouse Cart
 *       * Buff: FACE ADRENALINE (3x Face Meter Gain Rate)
 *     - Dragon Kick Can Stall
 *       * Buff: DRAGON KICK (+50% Instant Face Adrenaline Surge)
 *  2. Clothing Boutiques with Prestige Tiers & Stat Perks:
 *     - Hang + Deng (North Point Night Market, Face Level 1)
 *     - J. Jigger (Central Financial District, Face Level 2)
 *     - Aspirazole (Victoria Peak Luxury Avenue, Face Level 3)
 *     - Dynamic 3D character mesh limb recoloring upon purchase & equipping
 *  3. Interactive Storefront & Food Cart Modals ([E] to browse, [ESC] to exit)
 *  4. HUD Status Badges with countdown timers for active buffs
 *
 * ZERO synthetic assets: All branding, audio chimes, and dialogues directly authentic.
 */

import { SceneGraph } from './scene-graph';
import { AudioEngine } from './audio-engine';
import { CombatSystem } from './combat-system';
import { OpenWorldActivitiesManager } from './open-world-activities';

export interface FoodItem {
  id: string;
  name: string;
  vendorName: string;
  price: number;
  icon: string;
  quote: string;
  buffName: string;
  buffDurationSec: number;
  description: string;
  statEffect: string;
}

export const FOOD_MENU: FoodItem[] = [
  {
    id: 'hot_pork_bun',
    name: 'Steaming Char Siu Pork Bun',
    vendorName: 'Uncle Chow Pork Buns',
    price: 40,
    icon: '🥟',
    quote: 'A man who never eats pork buns is never a whole man!',
    buffName: 'WHOLE MAN',
    buffDurationSec: 180,
    description: 'Freshly steamed roasted char siu pork in fluffy white bao dough.',
    statEffect: '+25% Melee Damage & Full HP Restore'
  },
  {
    id: 'herbal_tea',
    name: 'Wong Lo Kat Herbal Tea',
    vendorName: 'Grandma Lin Herbal Medicine',
    price: 30,
    icon: '🍵',
    quote: 'Cleanses the liver, calms the blood, strengthens the bones.',
    buffName: 'CHI RESILIENCE',
    buffDurationSec: 180,
    description: 'Traditional slow-brewed medicinal herbal cooling tea.',
    statEffect: '50% Damage Reduction & Rapid HP Regen'
  },
  {
    id: 'steamed_dim_sum',
    name: 'Har Gow & Siu Mai Dim Sum',
    vendorName: 'Golden Dragon Teahouse',
    price: 65,
    icon: '🥢',
    quote: 'Authentic Cantonese bamboo basket delicacies.',
    buffName: 'FACE ADRENALINE',
    buffDurationSec: 180,
    description: 'Translucent shrimp dumplings and seasoned pork siu mai.',
    statEffect: '3x Face Meter Gain Rate'
  },
  {
    id: 'dragon_kick_can',
    name: 'Dragon Kick Energy Drink',
    vendorName: 'Street Vending Kiosk',
    price: 25,
    icon: '⚡',
    quote: 'Unleash the Dragon within!',
    buffName: 'DRAGON KICK',
    buffDurationSec: 120,
    description: 'High-caffeine carbonated taurine drink in an icy aluminum can.',
    statEffect: '+50% Instant Face Surge & Agility'
  }
];

export interface ClothingItem {
  id: string;
  name: string;
  boutiqueId: 'hang_deng' | 'j_jigger' | 'aspirazole';
  boutiqueName: string;
  category: 'torso' | 'legs' | 'shoes';
  price: number;
  requiredFaceLevel: number;
  color: [number, number, number];
  perkDescription: string;
  equipped: boolean;
}

export const CLOTHING_CATALOG: ClothingItem[] = [
  // Hang + Deng (Face Level 1)
  {
    id: 'hd_dragon_tee',
    name: 'Hang + Deng Graphic Dragon Tee',
    boutiqueId: 'hang_deng',
    boutiqueName: 'Hang + Deng',
    category: 'torso',
    price: 350,
    requiredFaceLevel: 1,
    color: [0.82, 0.22, 0.18], // Crimson Graphic Red
    perkDescription: '+10% Triad XP Bonus',
    equipped: false
  },
  {
    id: 'hd_track_pants',
    name: 'Hang + Deng Street Track Pants',
    boutiqueId: 'hang_deng',
    boutiqueName: 'Hang + Deng',
    category: 'legs',
    price: 280,
    requiredFaceLevel: 1,
    color: [0.15, 0.15, 0.18], // Charcoal Track Dark
    perkDescription: '+5% Sprint Speed',
    equipped: false
  },
  {
    id: 'hd_retro_sneakers',
    name: 'Hang + Deng High-Top Sneakers',
    boutiqueId: 'hang_deng',
    boutiqueName: 'Hang + Deng',
    category: 'shoes',
    price: 220,
    requiredFaceLevel: 1,
    color: [0.92, 0.15, 0.15], // Red & White Canvas
    perkDescription: '+5% Kick Damage',
    equipped: false
  },

  // J. Jigger (Face Level 2)
  {
    id: 'jj_moto_jacket',
    name: 'J. Jigger Distressed Moto Leather Jacket',
    boutiqueId: 'j_jigger',
    boutiqueName: 'J. Jigger',
    category: 'torso',
    price: 1800,
    requiredFaceLevel: 2,
    color: [0.12, 0.1, 0.08], // Distressed Cowhide Brown/Black
    perkDescription: '+15% Melee Damage & Striking Poise',
    equipped: false
  },
  {
    id: 'jj_raw_denim',
    name: 'J. Jigger Selvedge Indigo Jeans',
    boutiqueId: 'j_jigger',
    boutiqueName: 'J. Jigger',
    category: 'legs',
    price: 1200,
    requiredFaceLevel: 2,
    color: [0.08, 0.12, 0.28], // Deep Indigo Denim
    perkDescription: '+10% Grapple Resistance',
    equipped: false
  },
  {
    id: 'jj_urban_boots',
    name: 'J. Jigger Combat Leather Boots',
    boutiqueId: 'j_jigger',
    boutiqueName: 'J. Jigger',
    category: 'shoes',
    price: 950,
    requiredFaceLevel: 2,
    color: [0.08, 0.08, 0.08], // Matte Black Leather
    perkDescription: '+15% Heavy Kick Stun',
    equipped: false
  },

  // Aspirazole (Face Level 3)
  {
    id: 'asp_silk_tuxedo',
    name: 'Aspirazole Midnight Silk Tuxedo',
    boutiqueId: 'aspirazole',
    boutiqueName: 'Aspirazole Luxury',
    category: 'torso',
    price: 4500,
    requiredFaceLevel: 3,
    color: [0.04, 0.04, 0.08], // Midnight Blue Satin
    perkDescription: '+25% Police & Triad XP Gain & Respect',
    equipped: false
  },
  {
    id: 'asp_silk_trousers',
    name: 'Aspirazole Tailored Silk Trousers',
    boutiqueId: 'aspirazole',
    boutiqueName: 'Aspirazole Luxury',
    category: 'legs',
    price: 2800,
    requiredFaceLevel: 3,
    color: [0.04, 0.04, 0.08], // Matching Midnight Silk
    perkDescription: '+15% Face Meter Duration',
    equipped: false
  },
  {
    id: 'asp_oxford_shoes',
    name: 'Aspirazole Italian Bespoke Oxfords',
    boutiqueId: 'aspirazole',
    boutiqueName: 'Aspirazole Luxury',
    category: 'shoes',
    price: 1900,
    requiredFaceLevel: 3,
    color: [0.1, 0.05, 0.02], // Gloss Polished Mahogany
    perkDescription: 'Unstoppable Heavy Attacks',
    equipped: false
  }
];

export interface ActiveFoodBuff {
  item: FoodItem;
  remainingSec: number;
}

export interface HotspotEntity {
  id: string;
  name: string;
  type: 'food' | 'boutique';
  subId: string;
  position: [number, number, number];
  radius: number;
  promptText: string;
}

export class StreetEconomySystem {
  // Active Food Buffs
  public activeBuffs: Map<string, ActiveFoodBuff> = new Map();
  public purchasedItems: Set<string> = new Set();

  // Face Level & Progression
  public faceLevel = 1;

  // Modals & UI
  public isFoodModalOpen = false;
  public isBoutiqueModalOpen = false;
  public currentFoodMenu: FoodItem[] = [];
  public currentBoutiqueId: string | null = null;
  public activeHotspot: HotspotEntity | null = null;

  // DOM Elements
  private promptEl: HTMLElement | null = null;
  private foodModalEl: HTMLElement | null = null;
  private boutiqueModalEl: HTMLElement | null = null;
  private buffHudEl: HTMLElement | null = null;

  // World Hotspots
  public readonly HOTSPOTS: HotspotEntity[] = [
    {
      id: 'food_pork_bun',
      name: 'Uncle Chow Pork Buns',
      type: 'food',
      subId: 'hot_pork_bun',
      position: [-10.5, 0.0, -14.0],
      radius: 3.2,
      promptText: '🥟 [E] BUY PORK BUN: "A MAN WHO NEVER EATS PORK BUNS IS NEVER A WHOLE MAN!"'
    },
    {
      id: 'food_herbal_tea',
      name: 'Grandma Lin Herbal Medicine',
      type: 'food',
      subId: 'herbal_tea',
      position: [-14.0, 0.0, -8.0],
      radius: 3.2,
      promptText: '🍵 [E] BUY HERBAL TEA: CHI RESILIENCE & DAMAGE REDUCTION'
    },
    {
      id: 'food_dim_sum',
      name: 'Golden Dragon Teahouse',
      type: 'food',
      subId: 'steamed_dim_sum',
      position: [-6.5, 0.0, -18.5],
      radius: 3.2,
      promptText: '🥢 [E] BUY DIM SUM: TRIPLE FACE METER ADRENALINE'
    },
    {
      id: 'boutique_hang_deng',
      name: 'Hang + Deng Streetwear',
      type: 'boutique',
      subId: 'hang_deng',
      position: [-16.0, 0.0, -16.0],
      radius: 3.5,
      promptText: '👔 [E] ENTER HANG + DENG CLOTHING BOUTIQUE (FACE LVL 1)'
    },
    {
      id: 'boutique_j_jigger',
      name: 'J. Jigger Designer Apparel',
      type: 'boutique',
      subId: 'j_jigger',
      position: [22.0, 0.0, -42.0],
      radius: 3.5,
      promptText: '👔 [E] ENTER J. JIGGER BOUTIQUE (FACE LVL 2)'
    },
    {
      id: 'boutique_aspirazole',
      name: 'Aspirazole Haute Couture',
      type: 'boutique',
      subId: 'aspirazole',
      position: [28.0, 0.0, -52.0],
      radius: 3.5,
      promptText: '👔 [E] ENTER ASPIRAZOLE LUXURY SUIT BOUTIQUE (FACE LVL 3)'
    }
  ];

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    // 1. Proximity Prompt
    this.promptEl = document.createElement('div');
    this.promptEl.id = 'economy-prompt';
    this.promptEl.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      background: linear-gradient(135deg, rgba(20, 83, 45, 0.95), rgba(15, 60, 35, 0.95));
      border: 2px solid #86efac;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.7), 0 4px 12px rgba(0, 0, 0, 0.6);
      color: #ffffff;
      padding: 10px 24px;
      font-family: 'Segoe UI', Impact, sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-radius: 4px;
      pointer-events: none;
      z-index: 90;
      text-align: center;
    `;
    document.body.appendChild(this.promptEl);

    // 2. Active Food Buffs HUD Bar (Top-left)
    this.buffHudEl = document.createElement('div');
    this.buffHudEl.id = 'economy-buff-hud';
    this.buffHudEl.style.cssText = `
      position: absolute;
      top: 105px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
      z-index: 85;
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(this.buffHudEl);

    // 3. Food Vendor Menu Modal
    this.foodModalEl = document.createElement('div');
    this.foodModalEl.id = 'food-vendor-modal';
    this.foodModalEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: none;
      width: 580px;
      background: linear-gradient(180deg, rgba(24, 24, 27, 0.98) 0%, rgba(15, 15, 18, 0.99) 100%);
      border: 2px solid #e11d48;
      box-shadow: 0 0 35px rgba(225, 29, 72, 0.5), 0 10px 30px rgba(0,0,0,0.85);
      border-radius: 8px;
      padding: 24px 28px;
      z-index: 100;
      color: #f4f4f5;
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(this.foodModalEl);

    // 4. Boutique Clothing Store Modal
    this.boutiqueModalEl = document.createElement('div');
    this.boutiqueModalEl.id = 'boutique-store-modal';
    this.boutiqueModalEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: none;
      width: 660px;
      background: linear-gradient(180deg, rgba(20, 20, 24, 0.98) 0%, rgba(10, 10, 14, 0.99) 100%);
      border: 2px solid #38bdf8;
      box-shadow: 0 0 40px rgba(56, 189, 248, 0.5), 0 10px 30px rgba(0,0,0,0.85);
      border-radius: 8px;
      padding: 24px 28px;
      z-index: 100;
      color: #f4f4f5;
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(this.boutiqueModalEl);
  }

  /**
   * Evaluates proximity to food stalls and boutiques
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isDriving: boolean,
    combatSystem: CombatSystem
  ): void {
    // 1. Update countdown of active food buffs
    for (const [buffId, buff] of this.activeBuffs.entries()) {
      buff.remainingSec -= deltaTimeSec;
      if (buff.remainingSec <= 0) {
        this.activeBuffs.delete(buffId);
      }
    }
    this.renderBuffHUD();

    // 2. Compute Face Level based on combat face meter and unlocks
    this.faceLevel = Math.max(1, Math.min(10, Math.floor(combatSystem.faceMeter / 25) + 1));

    // 3. Proximity hotspot scanning
    if (this.isFoodModalOpen || this.isBoutiqueModalOpen) {
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    if (isDriving) {
      this.activeHotspot = null;
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    let nearest: HotspotEntity | null = null;
    let minDist = Infinity;

    for (const spot of this.HOTSPOTS) {
      const dist = Math.hypot(spot.position[0] - playerPos[0], spot.position[2] - playerPos[2]);
      if (dist <= spot.radius && dist < minDist) {
        minDist = dist;
        nearest = spot;
      }
    }

    this.activeHotspot = nearest;

    if (nearest && this.promptEl) {
      this.promptEl.style.display = 'block';
      this.promptEl.innerHTML = nearest.promptText;
    } else if (this.promptEl) {
      this.promptEl.style.display = 'none';
    }
  }

  /**
   * Handles [E] or [ESC] interactions for street economy
   */
  public handleInteraction(
    key: 'e' | 'esc',
    playerPos: [number, number, number],
    openWorldActivities: OpenWorldActivitiesManager,
    combatSystem: CombatSystem,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph
  ): boolean {
    if (key === 'esc') {
      if (this.isFoodModalOpen || this.isBoutiqueModalOpen) {
        this.closeModals();
        return true;
      }
      return false;
    }

    if (key === 'e') {
      if (this.isFoodModalOpen || this.isBoutiqueModalOpen) {
        this.closeModals();
        return true;
      }

      if (!this.activeHotspot) return false;

      if (this.activeHotspot.type === 'food') {
        this.openFoodMenu(this.activeHotspot, openWorldActivities, combatSystem, audioEngine);
        return true;
      } else if (this.activeHotspot.type === 'boutique') {
        this.openBoutiqueStore(this.activeHotspot.subId, openWorldActivities, audioEngine, sceneGraph);
        return true;
      }
    }

    return false;
  }

  /**
   * Opens Food Cart menu
   */
  public openFoodMenu(
    hotspot: HotspotEntity,
    openWorldActivities: OpenWorldActivitiesManager,
    combatSystem: CombatSystem,
    audioEngine: AudioEngine
  ): void {
    this.isFoodModalOpen = true;
    this.currentFoodMenu = FOOD_MENU;

    if (!this.foodModalEl) return;
    this.foodModalEl.style.display = 'block';

    const render = () => {
      if (!this.foodModalEl) return;
      this.foodModalEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e11d48; padding-bottom:12px; margin-bottom:16px;">
          <div>
            <div style="font-size:20px; font-weight:900; color:#fb7185; letter-spacing:1px;">🍜 HONG KONG STREET FOOD VENDOR</div>
            <div style="font-size:12px; color:#a1a1aa; font-weight:600;">"${hotspot.name}" - Authentic Street Delicacies</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:#a1a1aa; font-weight:700;">WALLET CASH</div>
            <div style="font-size:18px; font-weight:900; color:#22c55e;">$${openWorldActivities.totalCashEarned.toLocaleString()} HKD</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto; padding-right:6px;">
          ${FOOD_MENU.map(item => {
            const hasBuff = this.activeBuffs.has(item.buffName);
            const canAfford = openWorldActivities.totalCashEarned >= item.price;
            return `
              <div style="background:rgba(39,39,42,0.65); border:1px solid ${hasBuff ? '#10b981' : '#3f3f46'}; border-radius:6px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:14px;">
                  <div style="font-size:32px;">${item.icon}</div>
                  <div>
                    <div style="font-size:15px; font-weight:800; color:#f4f4f5;">${item.name}</div>
                    <div style="font-size:11px; font-weight:700; color:#f59e0b; font-style:italic;">"${item.quote}"</div>
                    <div style="font-size:11px; color:#38bdf8; font-weight:700; margin-top:2px;">BUFF: ${item.statEffect} (${item.buffDurationSec}s)</div>
                  </div>
                </div>
                <div style="text-align:right; min-width:110px;">
                  <div style="font-size:15px; font-weight:900; color:#fbbf24;">$${item.price} HKD</div>
                  <button id="btn-buy-food-${item.id}" style="margin-top:4px; width:100%; padding:6px 12px; background:${hasBuff ? '#059669' : canAfford ? '#e11d48' : '#3f3f46'}; border:none; border-radius:4px; color:#fff; font-weight:800; font-size:12px; cursor:${canAfford ? 'pointer' : 'not-allowed'}; letter-spacing:1px;">
                    ${hasBuff ? 'ACTIVE ⚡' : canAfford ? 'EAT [BUY]' : 'NO CASH'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top:16px; border-top:1px solid #3f3f46; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:#71717a; font-weight:700;">[ESC] CLOSE MENU</span>
          <button id="btn-close-food" style="padding:6px 18px; background:#27272a; border:1px solid #52525b; border-radius:4px; color:#fff; font-size:12px; font-weight:800; cursor:pointer;">
            EXIT [ESC]
          </button>
        </div>
      `;

      // Wire buttons
      document.getElementById('btn-close-food')?.addEventListener('click', () => this.closeModals());
      FOOD_MENU.forEach(item => {
        document.getElementById(`btn-buy-food-${item.id}`)?.addEventListener('click', () => {
          this.purchaseFood(item, openWorldActivities, combatSystem, audioEngine);
          render();
        });
      });
    };

    render();
  }

  /**
   * Purchases and eats food item
   */
  public purchaseFood(
    item: FoodItem,
    openWorldActivities: OpenWorldActivitiesManager,
    combatSystem: CombatSystem,
    audioEngine: AudioEngine
  ): boolean {
    if (openWorldActivities.totalCashEarned < item.price) {
      this.showToast('⚠️ INSUFFICIENT HKD CASH TO BUY FOOD', '#ef4444');
      return false;
    }

    // Deduct cash
    openWorldActivities.totalCashEarned -= item.price;

    // Apply food buff
    this.activeBuffs.set(item.buffName, {
      item,
      remainingSec: item.buffDurationSec
    });

    // Special effects
    if (item.id === 'hot_pork_bun') {
      (window as any).restorePlayerHealth?.(100);
      audioEngine.playTrack('vendor_argument').catch(() => {});
      this.showToast(`🥟 EATEN PORK BUN: "WHOLE MAN" BUFF ACTIVE! (+25% MELEE DAMAGE)`, '#10b981');
    } else if (item.id === 'herbal_tea') {
      (window as any).restorePlayerHealth?.(100);
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showToast(`🍵 DRANK HERBAL TEA: "CHI RESILIENCE" ACTIVE! (50% DAMAGE REDUCTION)`, '#06b6d4');
    } else if (item.id === 'steamed_dim_sum') {
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showToast(`🥢 EATEN DIM SUM: "FACE ADRENALINE" ACTIVE! (3x FACE METER GAIN)`, '#8b5cf6');
    } else if (item.id === 'dragon_kick_can') {
      combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 50);
      audioEngine.playTrack('ui_chime_granted').catch(() => {});
      this.showToast(`⚡ DRANK DRAGON KICK: +50% FACE METER SURGE!`, '#f59e0b');
    }

    return true;
  }

  /**
   * Opens Clothing Boutique Store modal
   */
  public openBoutiqueStore(
    boutiqueId: string,
    openWorldActivities: OpenWorldActivitiesManager,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph
  ): void {
    this.isBoutiqueModalOpen = true;
    this.currentBoutiqueId = boutiqueId;

    if (!this.boutiqueModalEl) return;
    this.boutiqueModalEl.style.display = 'block';

    const boutiqueItems = CLOTHING_CATALOG.filter(c => c.boutiqueId === boutiqueId);
    const boutiqueTitle = boutiqueItems[0]?.boutiqueName || 'Hong Kong Boutique';

    const render = () => {
      if (!this.boutiqueModalEl) return;
      this.boutiqueModalEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #38bdf8; padding-bottom:12px; margin-bottom:16px;">
          <div>
            <div style="font-size:21px; font-weight:900; color:#38bdf8; letter-spacing:1px;">👔 ${boutiqueTitle.toUpperCase()}</div>
            <div style="font-size:12px; color:#a1a1aa; font-weight:600;">Authentic Hong Kong Designer Streetwear & Suits</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:#a1a1aa; font-weight:700;">WALLET | FACE LEVEL</div>
            <div style="font-size:17px; font-weight:900; color:#22c55e;">
              $${openWorldActivities.totalCashEarned.toLocaleString()} HKD <span style="color:#f59e0b; margin-left:8px;">★ LVL ${this.faceLevel}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto; padding-right:6px;">
          ${boutiqueItems.map(item => {
            const isOwned = this.purchasedItems.has(item.id);
            const isEquipped = item.equipped;
            const meetsFaceLevel = this.faceLevel >= item.requiredFaceLevel;
            const canAfford = openWorldActivities.totalCashEarned >= item.price;

            let btnText = 'BUY ITEM';
            let btnBg = '#0284c7';
            let disabled = false;

            if (isEquipped) {
              btnText = 'EQUIPPED ✔';
              btnBg = '#059669';
              disabled = true;
            } else if (isOwned) {
              btnText = 'EQUIP';
              btnBg = '#10b981';
            } else if (!meetsFaceLevel) {
              btnText = `LOCKED (FACE LVL ${item.requiredFaceLevel})`;
              btnBg = '#4b5563';
              disabled = true;
            } else if (!canAfford) {
              btnText = 'INSUFFICIENT HKD';
              btnBg = '#374151';
              disabled = true;
            }

            return `
              <div style="background:rgba(30,41,59,0.7); border:1px solid ${isEquipped ? '#10b981' : '#475569'}; border-radius:6px; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:15px; font-weight:800; color:#f8fafc;">${item.name}</div>
                  <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Category: ${item.category} | Face Req: Level ${item.requiredFaceLevel}</div>
                  <div style="font-size:12px; color:#38bdf8; font-weight:700; margin-top:2px;">PERK: ${item.perkDescription}</div>
                </div>
                <div style="text-align:right; min-width:140px;">
                  <div style="font-size:16px; font-weight:900; color:#fbbf24;">$${item.price.toLocaleString()} HKD</div>
                  <button id="btn-boutique-${item.id}" style="margin-top:4px; width:100%; padding:6px 12px; background:${btnBg}; border:none; border-radius:4px; color:#fff; font-weight:800; font-size:11px; cursor:${disabled ? 'default' : 'pointer'}; letter-spacing:1px;">
                    ${btnText}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top:16px; border-top:1px solid #334155; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:#64748b; font-weight:700;">[ESC] EXIT STORE</span>
          <button id="btn-close-boutique" style="padding:6px 18px; background:#1e293b; border:1px solid #475569; border-radius:4px; color:#fff; font-size:12px; font-weight:800; cursor:pointer;">
            EXIT [ESC]
          </button>
        </div>
      `;

      // Wire buttons
      document.getElementById('btn-close-boutique')?.addEventListener('click', () => this.closeModals());
      boutiqueItems.forEach(item => {
        document.getElementById(`btn-boutique-${item.id}`)?.addEventListener('click', () => {
          this.buyOrEquipClothing(item, openWorldActivities, audioEngine, sceneGraph);
          render();
        });
      });
    };

    render();
  }

  /**
   * Buys or equips boutique clothing item and dynamically recolors 3D character mesh
   */
  public buyOrEquipClothing(
    item: ClothingItem,
    openWorldActivities: OpenWorldActivitiesManager,
    audioEngine: AudioEngine,
    sceneGraph: SceneGraph
  ): boolean {
    const isOwned = this.purchasedItems.has(item.id);

    if (!isOwned) {
      if (this.faceLevel < item.requiredFaceLevel) {
        this.showToast(`⚠️ FACE LEVEL ${item.requiredFaceLevel} REQUIRED TO BUY THIS ITEM!`, '#ef4444');
        return false;
      }
      if (openWorldActivities.totalCashEarned < item.price) {
        this.showToast(`⚠️ INSUFFICIENT HKD CASH!`, '#ef4444');
        return false;
      }

      // Deduct cash and add to inventory
      openWorldActivities.totalCashEarned -= item.price;
      this.purchasedItems.add(item.id);
    }

    // Unequip items in same category
    CLOTHING_CATALOG.forEach(c => {
      if (c.category === item.category) {
        c.equipped = false;
      }
    });

    item.equipped = true;
    if (typeof window !== 'undefined' && (window as any).policePursuitSystem) {
      (window as any).policePursuitSystem.clearHeatViaDisguise(audioEngine);
    }

    // Dynamically recolor Wei Shen's 3D mesh limb nodes in sceneGraph!
    if (sceneGraph) {
      if (item.category === 'torso') {
        const torsoNode = sceneGraph.getNode('node-wei-torso');
        if (torsoNode) torsoNode.color = [...item.color];
      } else if (item.category === 'legs') {
        const legL = sceneGraph.getNode('node-wei-leg-l');
        const legR = sceneGraph.getNode('node-wei-leg-r');
        if (legL) legL.color = [...item.color];
        if (legR) legR.color = [...item.color];
      } else if (item.category === 'shoes') {
        const shoeL = sceneGraph.getNode('node-wei-shoe-l');
        const shoeR = sceneGraph.getNode('node-wei-shoe-r');
        if (shoeL) shoeL.color = [...item.color];
        if (shoeR) shoeR.color = [...item.color];
      }
    }

    audioEngine.playTrack('ui_chime_granted').catch(() => {});
    this.showToast(`👔 EQUIPPED ${item.name.toUpperCase()}! (${item.perkDescription})`, '#10b981');
    return true;
  }

  /**
   * Closes all active modals
   */
  public closeModals(): void {
    this.isFoodModalOpen = false;
    this.isBoutiqueModalOpen = false;
    if (this.foodModalEl) this.foodModalEl.style.display = 'none';
    if (this.boutiqueModalEl) this.boutiqueModalEl.style.display = 'none';
  }

  /**
   * Renders active food buff HUD badges
   */
  private renderBuffHUD(): void {
    if (!this.buffHudEl) return;

    if (this.activeBuffs.size === 0) {
      this.buffHudEl.innerHTML = '';
      return;
    }

    this.buffHudEl.innerHTML = Array.from(this.activeBuffs.values()).map(buff => {
      const mins = Math.floor(buff.remainingSec / 60);
      const secs = Math.floor(buff.remainingSec % 60);
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      return `
        <div style="background:rgba(20,20,24,0.85); border-left:3px solid #10b981; padding:4px 10px; border-radius:3px; display:flex; align-items:center; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.5);">
          <span style="font-size:16px;">${buff.item.icon}</span>
          <div>
            <div style="font-size:11px; font-weight:800; color:#34d399; letter-spacing:0.5px;">${buff.item.buffName} (${timeStr})</div>
            <div style="font-size:9px; font-weight:700; color:#9ca3af;">${buff.item.statEffect}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Displays temporary notification toast
   */
  private showToast(msg: string, bg: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute;
      top: 140px;
      left: 50%;
      transform: translateX(-50%);
      background: ${bg};
      color: #fff;
      padding: 10px 22px;
      border-radius: 4px;
      font-family: 'Segoe UI', Impact, sans-serif;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      z-index: 110;
      pointer-events: none;
      animation: fadeInOut 2.5s forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

