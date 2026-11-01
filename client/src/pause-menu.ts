/**
 * pause-menu.ts
 * Sleeping Dogs Browser Reconstruction - Authentic In-Game Pause Menu & Settings Controller.
 *
 * Implements:
 *  - Full-screen modal overlay with authentic Sleeping Dogs red/gold/slate styling
 *  - Interactive tabs: Resume, Save Game, Load Game, Graphics, Audio, Controls, Restart, Quit
 *  - Save & Load slot inspectors with timestamps, mission preview, and delete capability
 *  - Real-time Graphics settings: Shadows (Off/Med/High), Rain Density, Neon Bloom, Grid, Dev HUD
 *  - Real-time Audio volume sliders: Master, SFX, Radio Music, Spoken Dialogue
 *  - Full visual controls reference map
 *  - Audio feedback cues on tab navigation and action triggers
 */

import { SaveManager, SaveGameSlot, GameSettingsState } from './save-manager';
import { AudioEngine } from './audio-engine';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onSaveSlot: (slotId: string, slotName: string) => void;
  onLoadSlot: (slot: SaveGameSlot) => void;
  onRestartCheckpoint: () => void;
  onQuitToTitle: () => void;
  onGraphicsChange: (key: keyof GameSettingsState, val: any) => void;
  onAudioChange: (bus: 'master' | 'sfx' | 'music' | 'dialogue', val: number) => void;
}

export class PauseMenuController {
  public isPaused = false;
  private overlay: HTMLElement | null = null;
  private activeTab = 'resume';
  private callbacks: PauseMenuCallbacks;
  private saveManager: SaveManager;
  private audioEngine?: AudioEngine;

  constructor(saveManager: SaveManager, callbacks: PauseMenuCallbacks, audioEngine?: AudioEngine) {
    this.saveManager = saveManager;
    this.callbacks = callbacks;
    this.audioEngine = audioEngine;
    this.initDOM();
  }

  private initDOM(): void {
    let el = document.getElementById('pause-menu-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pause-menu-overlay';
      el.className = 'pause-menu-overlay hidden';
      document.body.appendChild(el);
    }
    this.overlay = el;
    this.renderMenu();
  }

  public open(defaultTab = 'resume'): void {
    if (!this.overlay) this.initDOM();
    if (!this.overlay) return;

    this.isPaused = true;
    this.activeTab = defaultTab;
    this.overlay.classList.remove('hidden');
    this.renderMenu();
    this.playAudioCue('ui_menu_open');
  }

  public close(): void {
    if (!this.overlay) return;
    this.isPaused = false;
    this.overlay.classList.add('hidden');
    this.playAudioCue('ui_menu_close');
    this.callbacks.onResume();
  }

  public toggle(): void {
    if (this.isPaused) {
      this.close();
    } else {
      this.open();
    }
  }

  private playAudioCue(name: string): void {
    if (this.audioEngine) {
      this.audioEngine.playTrack('ui_click_confirm').catch(() => {});
    }
  }

  public renderMenu(): void {
    if (!this.overlay) return;

    const currentSettings = this.saveManager.loadSettings();
    const allSlots = this.saveManager.getAllSlots();

    this.overlay.innerHTML = `
      <div class="pause-container">
        <!-- Header Banner -->
        <div class="pause-header">
          <div class="pause-brand">
            <span class="pause-badge">SLEEPING DOGS</span>
            <span class="pause-title">GAME PAUSED</span>
          </div>
          <div class="pause-hint">[ESC] RESUME GAME</div>
        </div>

        <!-- Main Body -->
        <div class="pause-body">
          <!-- Left Sidebar Menu Tabs -->
          <div class="pause-sidebar">
            <button class="pause-tab-btn ${this.activeTab === 'resume' ? 'active' : ''}" data-tab="resume">RESUME</button>
            <button class="pause-tab-btn ${this.activeTab === 'save' ? 'active' : ''}" data-tab="save">SAVE GAME</button>
            <button class="pause-tab-btn ${this.activeTab === 'load' ? 'active' : ''}" data-tab="load">LOAD GAME</button>
            <button class="pause-tab-btn ${this.activeTab === 'graphics' ? 'active' : ''}" data-tab="graphics">GRAPHICS SETTINGS</button>
            <button class="pause-tab-btn ${this.activeTab === 'audio' ? 'active' : ''}" data-tab="audio">AUDIO SETTINGS</button>
            <button class="pause-tab-btn ${this.activeTab === 'controls' ? 'active' : ''}" data-tab="controls">CONTROLS REFERENCE</button>
            <button class="pause-tab-btn ${this.activeTab === 'restart' ? 'active' : ''}" data-tab="restart">RESTART CHECKPOINT</button>
            <button class="pause-tab-btn ${this.activeTab === 'quit' ? 'active' : ''}" data-tab="quit">QUIT TO TITLE</button>
          </div>

          <!-- Right Content Panel -->
          <div class="pause-content">
            ${this.renderActiveTabContent(currentSettings, allSlots)}
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderActiveTabContent(
    settings: GameSettingsState,
    slots: Record<string, SaveGameSlot | null>
  ): string {
    switch (this.activeTab) {
      case 'resume':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">RESUME GAMEPLAY</h2>
            <p class="pane-desc">Return immediately to the undercover streets of Hong Kong.</p>
            <div class="pane-actions">
              <button class="btn-action-primary" id="btn-pause-resume">CONTINUE PLAYING [ESC]</button>
            </div>
          </div>
        `;

      case 'save':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">MANUAL SAVE GAME</h2>
            <p class="pane-desc">Select a manual save slot to record your current mission progress, health, XP, and position.</p>
            <div class="slots-list">
              ${this.renderSaveSlotCard('slot1', 'Manual Save Slot 1', slots.slot1)}
              ${this.renderSaveSlotCard('slot2', 'Manual Save Slot 2', slots.slot2)}
              ${this.renderSaveSlotCard('slot3', 'Manual Save Slot 3', slots.slot3)}
            </div>
          </div>
        `;

      case 'load':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">LOAD GAME</h2>
            <p class="pane-desc">Restore a previously saved checkpoint, auto-save, or manual slot.</p>
            <div class="slots-list">
              ${this.renderLoadSlotCard('autosave', 'Auto-Save Checkpoint', slots.autosave, true)}
              ${this.renderLoadSlotCard('slot1', 'Manual Save Slot 1', slots.slot1, false)}
              ${this.renderLoadSlotCard('slot2', 'Manual Save Slot 2', slots.slot2, false)}
              ${this.renderLoadSlotCard('slot3', 'Manual Save Slot 3', slots.slot3, false)}
            </div>
          </div>
        `;

      case 'graphics':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">GRAPHICS & DISPLAY SETTINGS</h2>
            <p class="pane-desc">Fine-tune visual fidelity, shadow mapping, weather rain density, and tone mapping.</p>
            
            <div class="setting-group">
              <label class="setting-label">Shadow Quality (FBO Depth Pass & PCF Filtering)</label>
              <div class="radio-pill-group" data-setting="shadowQuality">
                <button class="btn-pill ${settings.shadowQuality === 'off' ? 'active' : ''}" data-val="off">OFF</button>
                <button class="btn-pill ${settings.shadowQuality === 'medium' ? 'active' : ''}" data-val="medium">MEDIUM (1024)</button>
                <button class="btn-pill ${settings.shadowQuality === 'high' ? 'active' : ''}" data-val="high">HIGH (2048 PCF)</button>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">Rain Density & Atmospheric Hong Kong Mist</label>
              <div class="radio-pill-group" data-setting="rainDensity">
                <button class="btn-pill ${settings.rainDensity === 'off' ? 'active' : ''}" data-val="off">CLEAR</button>
                <button class="btn-pill ${settings.rainDensity === 'low' ? 'active' : ''}" data-val="low">LIGHT DRIZZLE</button>
                <button class="btn-pill ${settings.rainDensity === 'medium' ? 'active' : ''}" data-val="medium">HONG KONG RAIN</button>
                <button class="btn-pill ${settings.rainDensity === 'torrential' ? 'active' : ''}" data-val="torrential">TYPHOON STORM</button>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">Filmic Post-Processing</label>
              <div class="checkbox-row">
                <label class="custom-checkbox">
                  <input type="checkbox" id="chk-opt-bloom" ${settings.bloomEnabled ? 'checked' : ''}>
                  <span>ACES Filmic Tone Mapping & Neon Light Bloom</span>
                </label>
              </div>
            </div>

            <div class="setting-group">
              <label class="setting-label">Developer Overlays</label>
              <div class="checkbox-row">
                <label class="custom-checkbox">
                  <input type="checkbox" id="chk-opt-grid" ${settings.showGrid ? 'checked' : ''}>
                  <span>3D Viewport Editor Wireframe Grid</span>
                </label>
                <label class="custom-checkbox" style="margin-top: 6px;">
                  <input type="checkbox" id="chk-opt-devhud" ${settings.showDevHud ? 'checked' : ''}>
                  <span>Engine Pipeline Telemetry Metrics HUD</span>
                </label>
              </div>
            </div>
          </div>
        `;

      case 'audio':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">AUDIO & SOUND MIXER</h2>
            <p class="pane-desc">Adjust independent volume attenuation levels for master, SFX, radio, and spoken dialogue.</p>

            <div class="slider-group">
              <div class="slider-header">
                <span>MASTER VOLUME</span>
                <span class="slider-val" id="val-vol-master">${Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input type="range" class="vol-slider" id="slider-vol-master" min="0" max="100" value="${Math.round(settings.masterVolume * 100)}">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>SFX & COMBAT HITS</span>
                <span class="slider-val" id="val-vol-sfx">${Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input type="range" class="vol-slider" id="slider-vol-sfx" min="0" max="100" value="${Math.round(settings.sfxVolume * 100)}">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>IN-CAR RADIO MUSIC</span>
                <span class="slider-val" id="val-vol-music">${Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input type="range" class="vol-slider" id="slider-vol-music" min="0" max="100" value="${Math.round(settings.musicVolume * 100)}">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>SPOKEN DIALOGUE & CUTSCENES</span>
                <span class="slider-val" id="val-vol-dialogue">${Math.round(settings.dialogueVolume * 100)}%</span>
              </div>
              <input type="range" class="vol-slider" id="slider-vol-dialogue" min="0" max="100" value="${Math.round(settings.dialogueVolume * 100)}">
            </div>
          </div>
        `;

      case 'controls':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">CONTROLS & ACTION MAPPING</h2>
            <p class="pane-desc">Authentic PC keyboard and mouse action layout for locomotion, driving, martial arts, and minigames.</p>

            <div class="controls-table">
              <div class="ctrl-row"><span class="ctrl-key">[W][A][S][D]</span><span class="ctrl-action">Move Wei Shen / Drive & Steer Vehicle</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[Shift]</span><span class="ctrl-action">Sprint (Foot) / Handbrake Drift (Vehicle)</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[Space]</span><span class="ctrl-action">Parkour Vault / Jump Impulse</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[Left Click]</span><span class="ctrl-action">Light Martial Arts Strike / Fire 9mm Weapon</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[Right Click] / [E]</span><span class="ctrl-action">Deflect & Reverse Attack (Red Flash Counter)</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[F]</span><span class="ctrl-action">Enter/Exit Vehicle / Grapple Thug / Environmental Finisher</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[R]</span><span class="ctrl-action">Cycle In-Car Radio Station / Reload Weapon</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[H]</span><span class="ctrl-action">Honk Vehicle Horn</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[~] / [F1]</span><span class="ctrl-action">Toggle Developer Telemetry HUD & Wireframe Grid</span></div>
              <div class="ctrl-row"><span class="ctrl-key">[ESC]</span><span class="ctrl-action">Open / Close In-Game Pause Menu</span></div>
            </div>
          </div>
        `;

      case 'restart':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">RESTART CURRENT CHECKPOINT</h2>
            <p class="pane-desc">Reset Wei Shen to the current mission checkpoint with restored health.</p>
            <div class="pane-actions">
              <button class="btn-action-danger" id="btn-pause-restart">CONFIRM RESTART CHECKPOINT</button>
            </div>
          </div>
        `;

      case 'quit':
        return `
          <div class="pause-pane">
            <h2 class="pane-title">QUIT TO TITLE SCREEN</h2>
            <p class="pane-desc">Exit active gameplay and return to the main title screen overlay. (Progress is auto-saved).</p>
            <div class="pane-actions">
              <button class="btn-action-danger" id="btn-pause-quit">QUIT TO TITLE SCREEN</button>
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  private renderSaveSlotCard(slotId: string, title: string, slot: SaveGameSlot | null): string {
    if (!slot) {
      return `
        <div class="slot-card empty">
          <div class="slot-info">
            <div class="slot-title">${title}</div>
            <div class="slot-sub">[EMPTY SAVE SLOT]</div>
          </div>
          <button class="btn-slot-save" data-slot="${slotId}">SAVE TO SLOT</button>
        </div>
      `;
    }

    return `
      <div class="slot-card filled">
        <div class="slot-info">
          <div class="slot-title">${title} — <span style="color: #4ade80;">${slot.progression.missionTitle || 'Hong Kong Free Roam'}</span></div>
          <div class="slot-meta">Saved: ${slot.dateFormatted} • Health: ${slot.player.health}% • Face: ${slot.progression.faceLevel || 1}</div>
          <div class="slot-sub">${slot.progression.missionObjective || 'Active Checkpoint'}</div>
        </div>
        <button class="btn-slot-save" data-slot="${slotId}">OVERWRITE</button>
      </div>
    `;
  }

  private renderLoadSlotCard(slotId: string, title: string, slot: SaveGameSlot | null, isAuto: boolean): string {
    if (!slot) {
      return `
        <div class="slot-card empty">
          <div class="slot-info">
            <div class="slot-title">${title}</div>
            <div class="slot-sub">[NO SAVE DATA AVAILABLE]</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="slot-card filled">
        <div class="slot-info">
          <div class="slot-title">${title} — <span style="color: #00d2ff;">${slot.progression.missionTitle || 'Active Mission'}</span></div>
          <div class="slot-meta">Saved: ${slot.dateFormatted} • Police: ${slot.progression.policeXP} • Triad: ${slot.progression.triadXP}</div>
          <div class="slot-sub">${slot.progression.missionObjective || 'Checkpoint Restored'}</div>
        </div>
        <div class="slot-actions">
          <button class="btn-slot-load" data-slot="${slotId}">LOAD SAVE</button>
          ${!isAuto ? `<button class="btn-slot-delete" data-slot="${slotId}">DELETE</button>` : ''}
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    if (!this.overlay) return;

    // Sidebar Tab Navigation
    this.overlay.querySelectorAll('.pause-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab || 'resume';
        if (tab === 'resume') {
          this.close();
          return;
        }
        this.activeTab = tab;
        this.renderMenu();
        this.playAudioCue('ui_click_confirm');
      });
    });

    // Resume button
    const btnResume = this.overlay.querySelector('#btn-pause-resume');
    if (btnResume) {
      btnResume.addEventListener('click', () => this.close());
    }

    // Save slot buttons
    this.overlay.querySelectorAll('.btn-slot-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot || 'slot1';
        this.callbacks.onSaveSlot(slotId, `Manual Save (${slotId.toUpperCase()})`);
        this.renderMenu();
      });
    });

    // Load slot buttons
    this.overlay.querySelectorAll('.btn-slot-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot || 'autosave';
        const s = this.saveManager.loadSlot(slotId);
        if (s) {
          this.close();
          this.callbacks.onLoadSlot(s);
        }
      });
    });

    // Delete slot buttons
    this.overlay.querySelectorAll('.btn-slot-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId = (btn as HTMLElement).dataset.slot || 'slot1';
        this.saveManager.deleteSlot(slotId);
        this.renderMenu();
      });
    });

    // Graphics radio pills
    this.overlay.querySelectorAll('.radio-pill-group').forEach(group => {
      const setting = (group as HTMLElement).dataset.setting as keyof GameSettingsState;
      group.querySelectorAll('.btn-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = (btn as HTMLElement).dataset.val;
          group.querySelectorAll('.btn-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.saveManager.saveSettings({ [setting]: val });
          this.callbacks.onGraphicsChange(setting, val);
        });
      });
    });

    // Graphics checkboxes
    const chkBloom = this.overlay.querySelector('#chk-opt-bloom') as HTMLInputElement;
    if (chkBloom) {
      chkBloom.addEventListener('change', () => {
        this.saveManager.saveSettings({ bloomEnabled: chkBloom.checked });
        this.callbacks.onGraphicsChange('bloomEnabled', chkBloom.checked);
      });
    }

    const chkGrid = this.overlay.querySelector('#chk-opt-grid') as HTMLInputElement;
    if (chkGrid) {
      chkGrid.addEventListener('change', () => {
        this.saveManager.saveSettings({ showGrid: chkGrid.checked });
        this.callbacks.onGraphicsChange('showGrid', chkGrid.checked);
      });
    }

    const chkDevHud = this.overlay.querySelector('#chk-opt-devhud') as HTMLInputElement;
    if (chkDevHud) {
      chkDevHud.addEventListener('change', () => {
        this.saveManager.saveSettings({ showDevHud: chkDevHud.checked });
        this.callbacks.onGraphicsChange('showDevHud', chkDevHud.checked);
      });
    }

    // Audio Sliders
    const bindSlider = (id: string, labelId: string, bus: 'master' | 'sfx' | 'music' | 'dialogue') => {
      const slider = this.overlay?.querySelector(id) as HTMLInputElement;
      const label = this.overlay?.querySelector(labelId);
      if (slider && label) {
        slider.addEventListener('input', () => {
          const pct = parseInt(slider.value, 10);
          label.textContent = `${pct}%`;
          const factor = pct / 100.0;
          this.saveManager.saveSettings({ [`${bus}Volume` as keyof GameSettingsState]: factor });
          this.callbacks.onAudioChange(bus, factor);
        });
      }
    };

    bindSlider('#slider-vol-master', '#val-vol-master', 'master');
    bindSlider('#slider-vol-sfx', '#val-vol-sfx', 'sfx');
    bindSlider('#slider-vol-music', '#val-vol-music', 'music');
    bindSlider('#slider-vol-dialogue', '#val-vol-dialogue', 'dialogue');

    // Restart Checkpoint
    const btnRestart = this.overlay.querySelector('#btn-pause-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.close();
        this.callbacks.onRestartCheckpoint();
      });
    }

    // Quit to Title
    const btnQuit = this.overlay.querySelector('#btn-pause-quit');
    if (btnQuit) {
      btnQuit.addEventListener('click', () => {
        this.close();
        this.callbacks.onQuitToTitle();
      });
    }
  }
}

