/**
 * frequency-tuner.ts
 * Authentic Wiretap Frequency Tuner Minigame for Sleeping Dogs: Definitive Edition.
 *
 * Reconstructs the canonical audio bugging calibration tool:
 *  - Real-time Canvas 2D oscilloscope waveform rendering
 *  - Target frequency vs. tuned frequency sine waves
 *  - Interactive dial / slider to align phase and frequency
 *  - Static hiss noise when mistuned, resonant hum when matched
 *  - On lock-in: triggers wiretap audio capture of Winston Chu & Conny in Golden Koi office.
 */

import { AudioEngine } from './audio-engine';

export interface TunerResult {
  success: boolean;
  tunedFrequency: number;
}

export class FrequencyTunerMinigame {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private freqSlider: HTMLInputElement | null = null;
  private lockMeterFill: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;

  private targetFrequency = 742.0; // MHz
  private currentFrequency = 600.0;
  private lockProgress = 0.0;
  private isActive = false;
  private animFrameId: number | null = null;
  private onCompleteCallback: ((result: TunerResult) => void) | null = null;

  constructor(private audioEngine: AudioEngine) {
    this.createDom();
  }

  private createDom(): void {
    let existing = document.getElementById('wiretap-tuner-container');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'wiretap-tuner-container';
    host.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      background: rgba(10, 14, 20, 0.96);
      border: 2px solid #38bdf8;
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.4), inset 0 0 15px rgba(0,0,0,0.85);
      border-radius: 8px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #fff;
      display: none;
      z-index: 5000;
      user-select: none;
    `;

    host.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(56, 189, 248, 0.3); padding-bottom: 8px; margin-bottom: 14px;">
        <div style="font-weight: 800; font-size: 14px; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">
          HKPD Surveillance // Wiretap Frequency Tuner
        </div>
        <div style="display:flex; align-items:center; gap: 10px;">
          <div id="tuner-freq-display" style="font-size: 14px; font-weight: 800; font-family: monospace; color: #facc15;">
            600.0 MHz
          </div>
          <button id="tuner-btn-close" title="Close / Cancel [Esc]" style="
            background: rgba(255,255,255,0.08);
            border: 1px solid #475569;
            color: #94a3b8;
            border-radius: 4px;
            padding: 2px 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
          ">✕</button>
        </div>
      </div>

      <!-- Oscilloscope Canvas -->
      <div style="background: #020b14; border: 1px solid #1e293b; border-radius: 6px; padding: 6px; margin-bottom: 14px; text-align: center;">
        <canvas id="tuner-oscilloscope" width="480" height="130" style="width: 100%; height: 130px; display: block; border-radius: 4px;"></canvas>
      </div>

      <!-- Lock meter -->
      <div style="margin-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; font-size: 11px; font-weight: 700; color: #888; margin-bottom: 4px;">
          <span>SIGNAL RESONANCE LOCK</span>
          <span id="tuner-lock-percent">0%</span>
        </div>
        <div style="height: 10px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; border: 1px solid #334155;">
          <div id="tuner-lock-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #eab308, #22c55e); transition: width 0.1s linear;"></div>
        </div>
      </div>

      <!-- Interactive frequency dial / slider -->
      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; font-size: 11px; color: #aaa; margin-bottom: 6px;">
          <span>500.0 MHz</span>
          <span style="color: #38bdf8; font-weight: 700;">[← / → OR DRAG TO TUNE RESONANCE]</span>
          <span>900.0 MHz</span>
        </div>
        <input id="tuner-slider" type="range" min="500" max="900" step="0.5" value="600" style="width: 100%; cursor: pointer;">
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div id="tuner-status-msg" style="font-size: 13px; font-weight: 600; color: #f59e0b;">
          TUNE SLIDER TO ELIMINATE STATIC NOISE
        </div>
        <button id="tuner-btn-calibrate" style="
          background: #38bdf8;
          border: none;
          border-radius: 4px;
          color: #0b1120;
          font-weight: 800;
          padding: 8px 18px;
          cursor: pointer;
          font-size: 13px;
          letter-spacing: 1px;
        ">CALIBRATE BUG</button>
      </div>
    `;

    document.body.appendChild(host);
    this.container = host;
    this.canvas = host.querySelector('#tuner-oscilloscope') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.freqSlider = host.querySelector('#tuner-slider') as HTMLInputElement;
    this.lockMeterFill = host.querySelector('#tuner-lock-fill');
    this.statusText = host.querySelector('#tuner-status-msg');

    this.freqSlider.addEventListener('input', () => {
      this.currentFrequency = parseFloat(this.freqSlider!.value);
      const display = document.getElementById('tuner-freq-display');
      if (display) display.textContent = `${this.currentFrequency.toFixed(1)} MHz`;
    });

    const btnCalibrate = host.querySelector('#tuner-btn-calibrate');
    if (btnCalibrate) {
      btnCalibrate.addEventListener('click', () => {
        this.checkCalibration();
      });
    }

    const btnClose = host.querySelector('#tuner-btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.cancelTuner();
      });
    }

    // Keyboard controls (Left/Right arrow, Enter, Escape)
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.key === 'ArrowLeft') {
        this.currentFrequency = Math.max(500, this.currentFrequency - 4.0);
        if (this.freqSlider) this.freqSlider.value = this.currentFrequency.toString();
        this.updateFreqDisplay();
      } else if (e.key === 'ArrowRight') {
        this.currentFrequency = Math.min(900, this.currentFrequency + 4.0);
        if (this.freqSlider) this.freqSlider.value = this.currentFrequency.toString();
        this.updateFreqDisplay();
      } else if (e.key === 'Enter') {
        this.checkCalibration();
      } else if (e.key === 'Escape') {
        this.cancelTuner();
      }
    });
  }

  private updateFreqDisplay(): void {
    const display = document.getElementById('tuner-freq-display');
    if (display) display.textContent = `${this.currentFrequency.toFixed(1)} MHz`;
  }

  public startTuner(
    targetFreq = 742.0,
    onComplete?: (result: TunerResult) => void
  ): void {
    this.targetFrequency = targetFreq;
    this.currentFrequency = 580.0;
    this.lockProgress = 0.0;
    this.isActive = true;
    this.onCompleteCallback = onComplete || null;

    if (this.freqSlider) this.freqSlider.value = this.currentFrequency.toString();
    this.updateFreqDisplay();

    if (this.container) this.container.style.display = 'block';

    this.audioEngine.playTrack('radio_static_burst').catch(() => {});
    this.audioEngine.playTrack('wiretap_tuner_hum').catch(() => {});

    this.renderLoop();
  }

  private renderLoop = (): void => {
    if (!this.isActive || !this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const time = performance.now() / 1000.0;

    // Clear background grid
    this.ctx.fillStyle = '#020b14';
    this.ctx.fillRect(0, 0, w, h);

    // Draw oscilloscope grid lines
    this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    const diff = Math.abs(this.currentFrequency - this.targetFrequency);
    const resonance = Math.max(0.0, 1.0 - diff / 60.0);

    // Draw Target Reference Wave (Cyan/Blue reference)
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * 0.06 + time * 6.0) * 32.0;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Draw Tuned Wave (Green when locked, Amber when tuning, with noise)
    const noiseAmp = Math.max(0.0, (1.0 - resonance) * 16.0);
    const tunedColor = resonance > 0.85 ? '#22c55e' : (resonance > 0.4 ? '#eab308' : '#ef4444');
    this.ctx.strokeStyle = tunedColor;
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = tunedColor;
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();

    const freqScale = 0.03 + (this.currentFrequency / this.targetFrequency) * 0.03;
    for (let x = 0; x < w; x++) {
      const noise = (Math.random() - 0.5) * noiseAmp;
      const y = h / 2 + Math.sin(x * freqScale + time * 6.0) * (32.0 * resonance + 12.0) + noise;
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Update lock progress
    if (diff < 8.0) {
      this.lockProgress = Math.min(1.0, this.lockProgress + 0.025);
    } else {
      this.lockProgress = Math.max(0.0, this.lockProgress - 0.02);
    }

    if (this.lockMeterFill) {
      this.lockMeterFill.style.width = `${Math.round(this.lockProgress * 100)}%`;
    }
    const percentLabel = document.getElementById('tuner-lock-percent');
    if (percentLabel) percentLabel.textContent = `${Math.round(this.lockProgress * 100)}%`;

    if (this.statusText) {
      if (this.lockProgress >= 0.98) {
        this.statusText.textContent = 'RESONANCE LOCKED // READY TO CALIBRATE';
        this.statusText.style.color = '#22c55e';
      } else if (diff < 15.0) {
        this.statusText.textContent = 'SIGNAL APPROACHING RESONANCE... HOLD';
        this.statusText.style.color = '#eab308';
      } else {
        this.statusText.textContent = 'ADJUST FREQUENCY SLIDER TO MATCH SINE WAVE';
        this.statusText.style.color = '#f59e0b';
      }
    }

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  public checkCalibration(): void {
    if (!this.isActive) return;
    const diff = Math.abs(this.currentFrequency - this.targetFrequency);
    if (diff < 12.0 || this.lockProgress >= 0.8) {
      // SUCCESS!
      this.isActive = false;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.audioEngine.playTrack('ui_chime_granted').catch(() => {});
      if (this.statusText) {
        this.statusText.textContent = 'WIRETAP ACTIVE // AUDIO FEED TRANSMITTING';
        this.statusText.style.color = '#22c55e';
      }
      setTimeout(() => {
        this.closeTuner();
        if (this.onCompleteCallback) {
          this.onCompleteCallback({ success: true, tunedFrequency: this.currentFrequency });
        }
      }, 1400);
    } else {
      this.audioEngine.playTrack('ui_click_denied').catch(() => {});
      if (this.statusText) {
        this.statusText.textContent = 'CALIBRATION FAILED: FREQUENCY MISMATCH';
        this.statusText.style.color = '#ef4444';
      }
    }
  }

  public closeTuner(): void {
    this.isActive = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.container) this.container.style.display = 'none';
  }

  public cancelTuner(): void {
    if (!this.isActive) return;
    this.closeTuner();
    this.audioEngine.playTrack('ui_click_denied').catch(() => {});
    if (this.onCompleteCallback) {
      this.onCompleteCallback({ success: false, tunedFrequency: this.currentFrequency });
    }
  }

  public isRunning(): boolean {
    return this.isActive;
  }
}

