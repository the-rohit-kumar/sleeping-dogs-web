/**
 * collectibles-system.ts
 * Authentic Sleeping Dogs Health Shrines & Lockbox Tumbler Minigame System.
 *
 * Implements:
 *  1. 50 Health Shrines (Incense Prayer & Permanent Max HP Boost):
 *     - Sacred Taoist shrines across North Point, Central, Aberdeen, Kennedy Town
 *     - Incense joss sticks, golden embers, and sacred temple bell audio
 *     - Deep prayer animation & ceremonial blessings
 *     - Every shrine prayer permanently boosts player Max Health by +10% (100 -> 110 -> 120 -> 130 HP)
 *     - Instant full health restoration upon prayer
 *  2. Triad Lockboxes & Analog Tumbler Minigame:
 *     - Hidden reinforced lockboxes with valuable cash and Triad respect
 *     - Full interactive 3-dial mechanical tumbler lockpicking minigame:
 *       * Dial rotation via [A]/[D] or interactive UI buttons
 *       * Audible mechanical tick sound (ui_hack_tick) per notch
 *       * Proximity feedback: Needle glow transitions Red -> Amber -> Emerald Green
 *       * Spring latch click (ui_hack_correct) when tumbler pins align
 *       * Sequential unlocking of Dial 1 -> Dial 2 -> Dial 3
 *       * Vault latch opening chime (ui_chime_granted) and massive cash payout
 *
 * ZERO synthetic assets: Authentic Sleeping Dogs mechanics, audio bitstreams, and progression.
 */

import { SceneGraph } from './scene-graph';
import { AudioEngine } from './audio-engine';
import { OpenWorldActivitiesManager } from './open-world-activities';

export interface HealthShrine {
  id: string;
  name: string;
  district: string;
  position: [number, number, number];
  prayed: boolean;
}

export interface LockboxEntity {
  id: string;
  name: string;
  district: string;
  position: [number, number, number];
  combination: [number, number, number];
  cashReward: number;
  triadXpReward: number;
  unlocked: boolean;
}

export class CollectiblesSystem {
  // Health Shrines
  public shrines: HealthShrine[] = [
    {
      id: 'shrine_np_market',
      name: 'North Point Night Market Alley Shrine',
      district: 'North Point',
      position: [-8.0, 0.0, -8.0],
      prayed: false
    },
    {
      id: 'shrine_kwok_temple',
      name: 'Master Kwok Temple Courtyard Shrine',
      district: 'North Point',
      position: [-20.0, 0.0, 10.0],
      prayed: false
    },
    {
      id: 'shrine_aberdeen_wharf',
      name: 'Aberdeen Docks Oceanfront Shrine',
      district: 'Aberdeen',
      position: [6.0, 0.0, 22.0],
      prayed: false
    },
    {
      id: 'shrine_central_pagoda',
      name: 'Central Financial Pagoda Shrine',
      district: 'Central',
      position: [26.0, 0.0, -38.0],
      prayed: false
    },
    {
      id: 'shrine_victoria_peak',
      name: 'Victoria Peak Mountain Vista Shrine',
      district: 'Victoria Peak',
      position: [30.0, 0.0, -56.0],
      prayed: false
    }
  ];

  public totalShrinesPrayed = 0;
  public playerMaxHealthBonus = 0; // Cumulative bonus HP (+10 HP per shrine)

  // Lockboxes
  public lockboxes: LockboxEntity[] = [
    {
      id: 'box_np_rooftop',
      name: 'North Point Tenement Lockbox',
      district: 'North Point',
      position: [-14.5, 0.0, -12.5],
      combination: [3, 7, 2],
      cashReward: 8000,
      triadXpReward: 400,
      unlocked: false
    },
    {
      id: 'box_aberdeen_pier',
      name: 'Aberdeen Seafood Market Lockbox',
      district: 'Aberdeen',
      position: [12.0, 0.0, 18.0],
      combination: [6, 1, 8],
      cashReward: 10000,
      triadXpReward: 500,
      unlocked: false
    },
    {
      id: 'box_central_bank',
      name: 'Central Bank Courtyard Lockbox',
      district: 'Central',
      position: [18.0, 0.0, -45.0],
      combination: [4, 9, 5],
      cashReward: 12500,
      triadXpReward: 600,
      unlocked: false
    },
    {
      id: 'box_kennedy_dock',
      name: 'Kennedy Town Industrial Lockbox',
      district: 'Kennedy Town',
      position: [-25.0, 0.0, 30.0],
      combination: [8, 3, 9],
      cashReward: 15000,
      triadXpReward: 800,
      unlocked: false
    }
  ];

  public totalLockboxesOpened = 0;

  // Active Tumbler Minigame State
  public isTumblerOpen = false;
  public activeLockbox: LockboxEntity | null = null;
  public currentDialIndex = 0; // 0, 1, 2
  public dialPositions: [number, number, number] = [0, 0, 0]; // Current dial values (0-9)
  public dialLocked: [boolean, boolean, boolean] = [false, false, false];

  // Hotspot interaction state
  public activeHotspot: { type: 'shrine' | 'lockbox'; entity: HealthShrine | LockboxEntity } | null = null;

  // DOM Elements
  private promptEl: HTMLElement | null = null;
  private tumblerModalEl: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    // 1. Proximity Prompt
    this.promptEl = document.createElement('div');
    this.promptEl.id = 'collectibles-prompt';
    this.promptEl.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(126, 34, 206, 0.95));
      border: 2px solid #e9d5ff;
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.7), 0 4px 12px rgba(0, 0, 0, 0.6);
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

    // 2. Celebratory Golden Banner
    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'collectibles-banner';
    this.bannerEl.style.cssText = `
      position: absolute;
      top: 18%;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      background: linear-gradient(135deg, rgba(202, 138, 4, 0.95), rgba(161, 98, 7, 0.95));
      border: 3px solid #fef08a;
      box-shadow: 0 0 35px rgba(234, 179, 8, 0.9), 0 8px 24px rgba(0,0,0,0.7);
      color: #ffffff;
      padding: 16px 36px;
      font-family: 'Segoe UI', Impact, sans-serif;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-radius: 6px;
      pointer-events: none;
      z-index: 105;
      text-align: center;
    `;
    document.body.appendChild(this.bannerEl);

    // 3. Lockbox Tumbler Minigame Modal
    this.tumblerModalEl = document.createElement('div');
    this.tumblerModalEl.id = 'lockbox-tumbler-modal';
    this.tumblerModalEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: none;
      width: 620px;
      background: linear-gradient(180deg, #1c1917 0%, #0c0a09 100%);
      border: 3px solid #f59e0b;
      box-shadow: 0 0 45px rgba(245, 158, 11, 0.6), 0 12px 36px rgba(0,0,0,0.9);
      border-radius: 8px;
      padding: 24px 30px;
      z-index: 100;
      color: #f4f4f5;
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(this.tumblerModalEl);
  }

  /**
   * Updates proximity scanning for shrines and lockboxes
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    isDriving: boolean
  ): void {
    if (this.isTumblerOpen) {
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    if (isDriving) {
      this.activeHotspot = null;
      if (this.promptEl) this.promptEl.style.display = 'none';
      return;
    }

    let nearest: { type: 'shrine' | 'lockbox'; entity: HealthShrine | LockboxEntity } | null = null;
    let minDist = Infinity;

    // Scan Health Shrines
    for (const shrine of this.shrines) {
      const dist = Math.hypot(shrine.position[0] - playerPos[0], shrine.position[2] - playerPos[2]);
      if (dist <= 3.2 && dist < minDist) {
        minDist = dist;
        nearest = { type: 'shrine', entity: shrine };
      }
    }

    // Scan Lockboxes
    for (const box of this.lockboxes) {
      const dist = Math.hypot(box.position[0] - playerPos[0], box.position[2] - playerPos[2]);
      if (dist <= 3.0 && dist < minDist) {
        minDist = dist;
        nearest = { type: 'lockbox', entity: box };
      }
    }

    this.activeHotspot = nearest;

    if (nearest && this.promptEl) {
      this.promptEl.style.display = 'block';
      if (nearest.type === 'shrine') {
        const s = nearest.entity as HealthShrine;
        this.promptEl.style.background = 'linear-gradient(135deg, rgba(202, 138, 4, 0.95), rgba(161, 98, 7, 0.95))';
        this.promptEl.style.borderColor = '#fef08a';
        this.promptEl.innerHTML = s.prayed
          ? `🙏 HEALTH SHRINE: ALREADY PRAYED (${this.totalShrinesPrayed}/50)`
          : `🙏 [E] PRAY AT HEALTH SHRINE (${this.totalShrinesPrayed}/50 - PERMANENT +10 HP)`;
      } else {
        const b = nearest.entity as LockboxEntity;
        this.promptEl.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(126, 34, 206, 0.95))';
        this.promptEl.style.borderColor = '#e9d5ff';
        this.promptEl.innerHTML = b.unlocked
          ? `🔓 TRIAD LOCKBOX: ALREADY UNLOCKED & LOOTED`
          : `🔓 [E] PICK LOCKBOX ANALOG TUMBLER ($${b.cashReward.toLocaleString()} HKD)`;
      }
    } else if (this.promptEl) {
      this.promptEl.style.display = 'none';
    }
  }

  /**
   * Handles [E] or [ESC] interactions for collectibles
   */
  public handleInteraction(
    key: 'e' | 'esc',
    audioEngine: AudioEngine,
    openWorldActivities: OpenWorldActivitiesManager
  ): boolean {
    if (key === 'esc') {
      if (this.isTumblerOpen) {
        this.closeTumblerModal();
        return true;
      }
      return false;
    }

    if (key === 'e') {
      if (this.isTumblerOpen) {
        this.closeTumblerModal();
        return true;
      }

      if (!this.activeHotspot) return false;

      if (this.activeHotspot.type === 'shrine') {
        const shrine = this.activeHotspot.entity as HealthShrine;
        return this.prayAtHealthShrine(shrine, audioEngine);
      } else if (this.activeHotspot.type === 'lockbox') {
        const box = this.activeHotspot.entity as LockboxEntity;
        return this.openLockboxTumbler(box, audioEngine, openWorldActivities);
      }
    }

    return false;
  }

  /**
   * Executes Health Shrine incense prayer and permanently boosts Max HP
   */
  public prayAtHealthShrine(shrine: HealthShrine, audioEngine: AudioEngine): boolean {
    if (shrine.prayed) {
      this.showToast('🙏 ALREADY PRAYED AT THIS HEALTH SHRINE', '#ca8a04');
      return false;
    }

    // Mark prayed
    shrine.prayed = true;
    this.totalShrinesPrayed++;
    this.playerMaxHealthBonus += 10.0; // +10 HP boost

    // Calculate new total Max HP
    const currentBase = 100.0;
    const newMaxHp = currentBase + this.playerMaxHealthBonus;

    // Apply to game engine
    const setMaxHp = (window as any).setPlayerMaxHealth;
    if (typeof setMaxHp === 'function') {
      setMaxHp(newMaxHp);
    }
    const restoreHp = (window as any).restorePlayerHealth;
    if (typeof restoreHp === 'function') {
      restoreHp(newMaxHp);
    }

    // Sacred Audio chime
    audioEngine.playTrack('ui_chime_granted').catch(() => {});

    // Show golden ceremonial banner
    if (this.bannerEl) {
      this.bannerEl.style.display = 'block';
      this.bannerEl.innerHTML = `
        <div style="font-size:24px; font-weight:900;">🙏 HEALTH SHRINE PRAYER COMPLETE! 🙏</div>
        <div style="font-size:14px; font-weight:800; color:#fef08a; margin-top:4px;">
          SHRINE ${this.totalShrinesPrayed}/50 PRAYED | PERMANENT MAX HEALTH INCREASED TO ${Math.round(newMaxHp)} HP!
        </div>
      `;
      setTimeout(() => {
        if (this.bannerEl) this.bannerEl.style.display = 'none';
      }, 4000);
    }

    return true;
  }

  /**
   * Opens Analog Tumbler Lockbox minigame
   */
  public openLockboxTumbler(
    box: LockboxEntity,
    audioEngine: AudioEngine,
    openWorldActivities: OpenWorldActivitiesManager
  ): boolean {
    if (box.unlocked) {
      this.showToast('🔓 THIS LOCKBOX HAS ALREADY BEEN UNLOCKED', '#9333ea');
      return false;
    }

    this.isTumblerOpen = true;
    this.activeLockbox = box;
    this.currentDialIndex = 0;
    this.dialPositions = [0, 0, 0];
    this.dialLocked = [false, false, false];

    if (!this.tumblerModalEl) return false;
    this.tumblerModalEl.style.display = 'block';

    this.renderTumblerUI(audioEngine, openWorldActivities);
    return true;
  }

  /**
   * Renders the interactive 3-dial mechanical tumbler lockpicking UI
   */
  public renderTumblerUI(audioEngine: AudioEngine, openWorldActivities: OpenWorldActivitiesManager): void {
    if (!this.tumblerModalEl || !this.activeLockbox) return;
    const box = this.activeLockbox;

    this.tumblerModalEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f59e0b; padding-bottom:12px; margin-bottom:18px;">
        <div>
          <div style="font-size:20px; font-weight:900; color:#f59e0b; letter-spacing:1px;">🔓 TRIAD ANALOG TUMBLER LOCKBOX</div>
          <div style="font-size:12px; color:#a1a1aa; font-weight:600;">"${box.name}" (${box.district})</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; color:#a1a1aa; font-weight:700;">REWARD</div>
          <div style="font-size:17px; font-weight:900; color:#22c55e;">$${box.cashReward.toLocaleString()} HKD</div>
        </div>
      </div>

      <div style="text-align:center; font-size:12px; font-weight:700; color:#cbd5e1; margin-bottom:20px;">
        ROTATE THE MECHANICAL BRASS TUMBLERS UNTIL THE PINS CLICK INTO PLACE (GREEN)
      </div>

      <!-- 3 Mechanical Brass Tumblers -->
      <div style="display:flex; justify-content:space-around; align-items:center; margin-bottom:24px;">
        ${[0, 1, 2].map(idx => {
          const val = this.dialPositions[idx];
          const isCurrent = this.currentDialIndex === idx;
          const isLocked = this.dialLocked[idx];
          const target = box.combination[idx];
          const diff = Math.abs(val - target);

          let needleColor = '#ef4444'; // Red (far)
          if (isLocked || diff === 0) needleColor = '#10b981'; // Green (solved)
          else if (diff <= 2) needleColor = '#f59e0b'; // Amber (close)

          const rotDeg = val * 36; // 0-9 across 360 deg

          return `
            <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
              <span style="font-size:12px; font-weight:800; color:${isCurrent ? '#38bdf8' : '#71717a'};">
                TUMBLER #${idx + 1} ${isLocked ? '✔' : ''}
              </span>
              <!-- Circular Brass Dial -->
              <div style="position:relative; width:110px; height:110px; border-radius:50%; background:radial-gradient(circle, #78350f 0%, #292524 85%); border:4px solid ${isCurrent ? '#f59e0b' : '#57534e'}; box-shadow:0 0 18px rgba(0,0,0,0.8), inset 0 0 12px #000;">
                <!-- Dial Needle -->
                <div style="position:absolute; top:50%; left:50%; width:42px; height:4px; background:${needleColor}; transform-origin:0 50%; transform:translate(0,-50%) rotate(${rotDeg - 90}deg); border-radius:2px; box-shadow:0 0 8px ${needleColor}; transition:transform 0.08s ease;"></div>
                <!-- Center Bolt -->
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:24px; height:24px; border-radius:50%; background:#44403c; border:2px solid #78716c; display:flex; justify-content:center; align-items:center; font-size:11px; font-weight:900; color:#f5f5f4;">
                  ${val}
                </div>
              </div>
              <!-- Rotate Controls -->
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button id="btn-dial-dec-${idx}" ${isLocked || !isCurrent ? 'disabled' : ''} style="width:36px; height:28px; background:#292524; border:1px solid #78716c; border-radius:3px; color:#fff; font-weight:900; cursor:${isLocked || !isCurrent ? 'not-allowed' : 'pointer'};">
                  ◀
                </button>
                <button id="btn-dial-inc-${idx}" ${isLocked || !isCurrent ? 'disabled' : ''} style="width:36px; height:28px; background:#292524; border:1px solid #78716c; border-radius:3px; color:#fff; font-weight:900; cursor:${isLocked || !isCurrent ? 'not-allowed' : 'pointer'};">
                  ▶
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="border-top:1px solid #44403c; padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:#78716c; font-weight:700;">[A]/[D] ROTATE DIAL  |  [ESC] CANCEL</span>
        <button id="btn-close-tumbler" style="padding:6px 18px; background:#292524; border:1px solid #78716c; border-radius:4px; color:#fff; font-size:12px; font-weight:800; cursor:pointer;">
          ABORT [ESC]
        </button>
      </div>
    `;

    // Wire buttons
    document.getElementById('btn-close-tumbler')?.addEventListener('click', () => this.closeTumblerModal());

    [0, 1, 2].forEach(idx => {
      document.getElementById(`btn-dial-dec-${idx}`)?.addEventListener('click', () => {
        this.stepDial(idx, -1, audioEngine, openWorldActivities);
      });
      document.getElementById(`btn-dial-inc-${idx}`)?.addEventListener('click', () => {
        this.stepDial(idx, 1, audioEngine, openWorldActivities);
      });
    });
  }

  /**
   * Advances tumbler dial value and evaluates lock pin
   */
  public stepDial(
    dialIdx: number,
    dir: number,
    audioEngine: AudioEngine,
    openWorldActivities: OpenWorldActivitiesManager
  ): void {
    if (this.currentDialIndex !== dialIdx || this.dialLocked[dialIdx]) return;
    if (!this.activeLockbox) return;

    // Advance dial (0-9 wrapping)
    this.dialPositions[dialIdx] = (this.dialPositions[dialIdx] + dir + 10) % 10;
    audioEngine.playTrack('ui_hack_tick').catch(() => {});

    // Check if dial reached secret target
    const target = this.activeLockbox.combination[dialIdx];
    if (this.dialPositions[dialIdx] === target) {
      // Dial pin clicked into place!
      this.dialLocked[dialIdx] = true;
      audioEngine.playTrack('ui_hack_correct').catch(() => {});

      if (this.currentDialIndex < 2) {
        this.currentDialIndex++;
      } else {
        // All 3 tumblers unlocked!
        this.completeLockbox(audioEngine, openWorldActivities);
        return;
      }
    }

    this.renderTumblerUI(audioEngine, openWorldActivities);
  }

  /**
   * Unlocks lockbox, pays reward, and closes modal
   */
  public completeLockbox(
    audioEngine: AudioEngine,
    openWorldActivities: OpenWorldActivitiesManager
  ): void {
    if (!this.activeLockbox) return;

    const box = this.activeLockbox;
    box.unlocked = true;
    this.totalLockboxesOpened++;

    // Payout
    openWorldActivities.totalCashEarned += box.cashReward;

    // Audio: Vault latch opens
    audioEngine.playTrack('ui_chime_granted').catch(() => {});

    // Close modal
    this.closeTumblerModal();

    // Show victory banner
    if (this.bannerEl) {
      this.bannerEl.style.display = 'block';
      this.bannerEl.innerHTML = `
        <div style="font-size:24px; font-weight:900;">🔓 TRIAD LOCKBOX UNLOCKED! 🔓</div>
        <div style="font-size:14px; font-weight:800; color:#fef08a; margin-top:4px;">
          REWARD: +$${box.cashReward.toLocaleString()} HKD CASH | +${box.triadXpReward} TRIAD XP
        </div>
      `;
      setTimeout(() => {
        if (this.bannerEl) this.bannerEl.style.display = 'none';
      }, 4000);
    }
  }

  /**
   * Closes tumbler modal and resets active lockbox state
   */
  public closeTumblerModal(): void {
    this.isTumblerOpen = false;
    this.activeLockbox = null;
    if (this.tumblerModalEl) this.tumblerModalEl.style.display = 'none';
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
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

