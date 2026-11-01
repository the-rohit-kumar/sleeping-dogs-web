/**
 * hacking-minigame.ts
 * Authentic CCTV Surveillance Camera Hacking Minigame for Sleeping Dogs: Definitive Edition.
 *
 * Faithfully reconstructs the canonical 4-digit security code hacking terminal:
 *  - 4 numeric positions [ _ _ _ _ ]
 *  - Numeric keypad (0-9)
 *  - 5 maximum attempts before lockout
 *  - Status evaluations:
 *      * GREEN (Correct digit & correct slot)
 *      * YELLOW (Correct digit, wrong slot)
 *      * RED (Digit not present in target code)
 *  - Authentic SFX:
 *      * ui_hack_tick (Digit button press)
 *      * ui_click_denied (Incorrect guess buzzer)
 *      * ui_chime_granted (Access granted terminal breach)
 *  - On success: triggers CCTV surveillance camera feed switch.
 */

import { AudioEngine } from './audio-engine';

export interface HackingResult {
  success: boolean;
  attemptsUsed: number;
  secretCode: number[];
}

export class HackingMinigame {
  private container: HTMLElement | null = null;
  private codeSlots: HTMLElement[] = [];
  private numpadButtons: HTMLElement[] = [];
  private attemptIndicators: HTMLElement[] = [];
  private historyList: HTMLElement | null = null;
  private statusMessage: HTMLElement | null = null;

  private secretCode: number[] = [3, 8, 1, 5];
  private currentGuess: number[] = [];
  private attemptsRemaining = 5;
  private maxAttempts = 5;
  private isActive = false;
  private onCompleteCallback: ((result: HackingResult) => void) | null = null;

  constructor(private audioEngine: AudioEngine) {
    this.createDomElements();
  }

  private createDomElements(): void {
    let existing = document.getElementById('hacking-minigame-container');
    if (existing) {
      existing.remove();
    }

    const host = document.createElement('div');
    host.id = 'hacking-minigame-container';
    host.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      background: rgba(12, 16, 22, 0.95);
      border: 2px solid #e5a93c;
      box-shadow: 0 0 35px rgba(229, 169, 60, 0.4), inset 0 0 15px rgba(0,0,0,0.8);
      border-radius: 8px;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #fff;
      display: none;
      z-index: 5000;
      user-select: none;
    `;

    host.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(229, 169, 60, 0.4); padding-bottom: 10px; margin-bottom: 16px;">
        <div style="font-weight: 800; font-size: 15px; letter-spacing: 2px; color: #e5a93c; text-transform: uppercase;">
          HKPD Surveillance Terminal // Breach Protocol
        </div>
        <div style="display:flex; align-items:center; gap: 10px;">
          <div id="hack-attempts-left" style="font-size: 13px; font-weight: 700; color: #ff5252; letter-spacing: 1px;">
            ATTEMPTS: 5/5
          </div>
          <button id="hack-btn-close" title="Close / Cancel [Esc]" style="
            background: rgba(255,255,255,0.08);
            border: 1px solid #666;
            color: #aaa;
            border-radius: 4px;
            padding: 2px 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
          ">✕</button>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 12px; color: #aaa; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
          Identify 4-Digit Security Key
        </div>
        <div style="display: flex; justify-content: center; gap: 14px; margin-bottom: 14px;">
          <div class="hack-slot" data-idx="0" style="width: 58px; height: 68px; background: rgba(255,255,255,0.06); border: 2px solid #444; border-radius: 6px; font-size: 36px; font-weight: 800; display:flex; align-items:center; justify-content:center; color: #fff;">_</div>
          <div class="hack-slot" data-idx="1" style="width: 58px; height: 68px; background: rgba(255,255,255,0.06); border: 2px solid #444; border-radius: 6px; font-size: 36px; font-weight: 800; display:flex; align-items:center; justify-content:center; color: #fff;">_</div>
          <div class="hack-slot" data-idx="2" style="width: 58px; height: 68px; background: rgba(255,255,255,0.06); border: 2px solid #444; border-radius: 6px; font-size: 36px; font-weight: 800; display:flex; align-items:center; justify-content:center; color: #fff;">_</div>
          <div class="hack-slot" data-idx="3" style="width: 58px; height: 68px; background: rgba(255,255,255,0.06); border: 2px solid #444; border-radius: 6px; font-size: 36px; font-weight: 800; display:flex; align-items:center; justify-content:center; color: #fff;">_</div>
        </div>
        <div id="hack-status-msg" style="font-size: 13px; font-weight: 600; min-height: 20px; color: #e5a93c;">
          SELECT 4 UNIQUE NUMBERS
        </div>
      </div>

      <!-- Numpad Grid -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
        ${[0,1,2,3,4,5,6,7,8,9].map(n => `
          <button class="hack-numpad-btn" data-num="${n}" style="
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            color: #fff;
            font-size: 20px;
            font-weight: 700;
            padding: 10px 0;
            cursor: pointer;
            transition: all 0.15s ease;
          ">${n}</button>
        `).join('')}
      </div>

      <!-- Action buttons -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <button id="hack-btn-clear" style="
          flex: 1;
          background: rgba(255,255,255,0.08);
          border: 1px solid #666;
          border-radius: 4px;
          color: #ccc;
          padding: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          letter-spacing: 1px;
        ">CLEAR</button>
        <button id="hack-btn-submit" style="
          flex: 2;
          background: #e5a93c;
          border: none;
          border-radius: 4px;
          color: #111;
          padding: 8px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          letter-spacing: 1.5px;
        ">SUBMIT CODE</button>
      </div>

      <!-- History log -->
      <div style="background: rgba(0,0,0,0.4); border-radius: 4px; padding: 10px; font-size: 12px;">
        <div style="color: #888; font-weight: 700; margin-bottom: 4px; letter-spacing: 1px;">PREVIOUS ATTEMPTS:</div>
        <div id="hack-history-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 80px; overflow-y: auto;">
          <div style="color: #555; font-style: italic;">No attempts logged yet.</div>
        </div>
      </div>
    `;

    document.body.appendChild(host);
    this.container = host;

    this.codeSlots = Array.from(host.querySelectorAll('.hack-slot'));
    this.numpadButtons = Array.from(host.querySelectorAll('.hack-numpad-btn'));
    this.historyList = host.querySelector('#hack-history-list');
    this.statusMessage = host.querySelector('#hack-status-msg');

    // Attach listeners
    this.numpadButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.getAttribute('data-num') || '0', 10);
        this.inputDigit(num);
      });
    });

    const clearBtn = host.querySelector('#hack-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.audioEngine.playTrack('ui_hack_tick');
        this.clearInput();
      });
    }

    const closeBtn = host.querySelector('#hack-btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.cancelMinigame();
      });
    }

    const submitBtn = host.querySelector('#hack-btn-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submitGuess();
      });
    }

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.key >= '0' && e.key <= '9') {
        this.inputDigit(parseInt(e.key, 10));
      } else if (e.key === 'Backspace') {
        this.deleteLastDigit();
      } else if (e.key === 'Enter') {
        this.submitGuess();
      } else if (e.key === 'Escape') {
        if (this.currentGuess.length > 0) {
          this.clearInput();
        } else {
          this.cancelMinigame();
        }
      }
    });
  }

  public startMinigame(
    secretCode: number[] = [3, 8, 1, 5],
    onComplete?: (result: HackingResult) => void
  ): void {
    this.secretCode = [...secretCode];
    this.currentGuess = [];
    this.attemptsRemaining = this.maxAttempts;
    this.isActive = true;
    this.onCompleteCallback = onComplete || null;

    if (this.container) {
      this.container.style.display = 'block';
    }

    if (this.historyList) {
      this.historyList.innerHTML = '<div style="color: #555; font-style: italic;">No attempts logged yet.</div>';
    }

    this.numpadButtons.forEach(b => {
      b.style.background = 'rgba(255,255,255,0.1)';
      b.style.border = '1px solid rgba(255,255,255,0.2)';
      b.style.color = '#fff';
      (b as HTMLButtonElement).disabled = false;
    });

    this.updateDisplay();
    this.audioEngine.playTrack('radio_static_burst');
  }

  private inputDigit(num: number): void {
    if (!this.isActive) return;
    if (this.currentGuess.length >= 4) return;
    if (this.currentGuess.includes(num)) {
      if (this.statusMessage) {
        this.statusMessage.textContent = 'DIGITS MUST BE UNIQUE';
        this.statusMessage.style.color = '#ff9800';
      }
      this.audioEngine.playTrack('ui_click_denied');
      return;
    }

    this.currentGuess.push(num);
    this.audioEngine.playTrack('ui_hack_tick');
    this.updateDisplay();
  }

  private deleteLastDigit(): void {
    if (!this.isActive || this.currentGuess.length === 0) return;
    this.currentGuess.pop();
    this.audioEngine.playTrack('ui_hack_tick');
    this.updateDisplay();
  }

  private clearInput(): void {
    this.currentGuess = [];
    this.updateDisplay();
  }

  private updateDisplay(): void {
    this.codeSlots.forEach((slot, idx) => {
      if (idx < this.currentGuess.length) {
        slot.textContent = this.currentGuess[idx].toString();
        slot.style.borderColor = '#e5a93c';
        slot.style.color = '#fff';
      } else {
        slot.textContent = '_';
        slot.style.borderColor = '#444';
        slot.style.color = '#666';
      }
    });

    const attemptsLabel = document.getElementById('hack-attempts-left');
    if (attemptsLabel) {
      attemptsLabel.textContent = `ATTEMPTS: ${this.attemptsRemaining}/${this.maxAttempts}`;
    }

    if (this.statusMessage && this.isActive) {
      if (this.currentGuess.length === 4) {
        this.statusMessage.textContent = 'PRESS [SUBMIT CODE] OR [ENTER]';
        this.statusMessage.style.color = '#4caf50';
      } else {
        this.statusMessage.textContent = `ENTER ${4 - this.currentGuess.length} MORE DIGIT(S)`;
        this.statusMessage.style.color = '#e5a93c';
      }
    }
  }

  public submitGuess(): void {
    if (!this.isActive || this.currentGuess.length !== 4) {
      if (this.statusMessage) {
        this.statusMessage.textContent = 'PLEASE ENTER ALL 4 DIGITS';
        this.statusMessage.style.color = '#ff5252';
      }
      this.audioEngine.playTrack('ui_click_denied');
      return;
    }

    const guess = [...this.currentGuess];
    const results: ('green' | 'yellow' | 'red')[] = [];

    // Evaluate each slot
    for (let i = 0; i < 4; i++) {
      const g = guess[i];
      if (g === this.secretCode[i]) {
        results.push('green'); // exact match
      } else if (this.secretCode.includes(g)) {
        results.push('yellow'); // wrong slot
      } else {
        results.push('red'); // not in code
      }
    }

    // Add to history log
    this.addHistoryRow(guess, results);

    // Disable confirmed red digits from numpad
    guess.forEach((d, i) => {
      if (results[i] === 'red') {
        const btn = this.numpadButtons.find(b => b.getAttribute('data-num') === d.toString());
        if (btn) {
          btn.style.background = 'rgba(255, 82, 82, 0.2)';
          btn.style.color = '#ff5252';
          btn.style.borderColor = '#ff5252';
          (btn as HTMLButtonElement).disabled = true;
        }
      } else if (results[i] === 'green') {
        const btn = this.numpadButtons.find(b => b.getAttribute('data-num') === d.toString());
        if (btn) {
          btn.style.background = 'rgba(76, 175, 80, 0.3)';
          btn.style.color = '#4caf50';
          btn.style.borderColor = '#4caf50';
        }
      }
    });

    const isAllGreen = results.every(r => r === 'green');
    if (isAllGreen) {
      // SUCCESS!
      this.isActive = false;
      this.audioEngine.playTrack('ui_chime_granted');
      if (this.statusMessage) {
        this.statusMessage.textContent = 'ACCESS GRANTED // SURVEILLANCE FEED ONLINE';
        this.statusMessage.style.color = '#4caf50';
      }
      this.codeSlots.forEach(slot => {
        slot.style.background = 'rgba(76, 175, 80, 0.3)';
        slot.style.borderColor = '#4caf50';
        slot.style.color = '#4caf50';
      });

      setTimeout(() => {
        this.closeMinigame();
        if (this.onCompleteCallback) {
          this.onCompleteCallback({
            success: true,
            attemptsUsed: this.maxAttempts - this.attemptsRemaining + 1,
            secretCode: this.secretCode
          });
        }
      }, 1500);
      return;
    }

    // Incorrect guess
    this.attemptsRemaining--;
    this.audioEngine.playTrack('ui_click_denied');

    if (this.attemptsRemaining <= 0) {
      // Failed attempts
      this.isActive = false;
      if (this.statusMessage) {
        this.statusMessage.textContent = 'TERMINAL LOCKOUT // RE-AUTHENTICATING...';
        this.statusMessage.style.color = '#ff5252';
      }
      setTimeout(() => {
        // Reset and retry
        this.startMinigame(this.secretCode, this.onCompleteCallback || undefined);
      }, 2000);
      return;
    }

    // Keep green slots filled, clear incorrect ones
    const newGuess: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (results[i] === 'green') {
        newGuess.push(guess[i]);
      }
    }
    this.currentGuess = [];
    this.updateDisplay();
  }

  private addHistoryRow(guess: number[], results: ('green' | 'yellow' | 'red')[]): void {
    if (!this.historyList) return;

    if (this.historyList.children.length === 1 && this.historyList.children[0].textContent?.includes('No attempts')) {
      this.historyList.innerHTML = '';
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 2px 6px; background: rgba(255,255,255,0.03); border-radius: 3px;';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; gap: 8px; font-weight: 700; font-family: monospace; font-size: 14px;';
    guess.forEach((d, i) => {
      const span = document.createElement('span');
      span.textContent = d.toString();
      if (results[i] === 'green') {
        span.style.color = '#4caf50';
      } else if (results[i] === 'yellow') {
        span.style.color = '#ffeb3b';
      } else {
        span.style.color = '#ff5252';
      }
      left.appendChild(span);
    });

    const right = document.createElement('div');
    right.style.cssText = 'font-size: 11px; font-weight: 700;';
    const greenCount = results.filter(r => r === 'green').length;
    const yellowCount = results.filter(r => r === 'yellow').length;
    right.innerHTML = `<span style="color:#4caf50;">${greenCount} EXACT</span> / <span style="color:#ffeb3b;">${yellowCount} SLOTS</span>`;

    row.appendChild(left);
    row.appendChild(right);
    this.historyList.prepend(row);
  }

  public closeMinigame(): void {
    this.isActive = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public cancelMinigame(): void {
    if (!this.isActive) return;
    this.closeMinigame();
    this.audioEngine.playTrack('ui_click_denied');
    if (this.onCompleteCallback) {
      this.onCompleteCallback({
        success: false,
        attemptsUsed: this.maxAttempts - this.attemptsRemaining,
        secretCode: this.secretCode
      });
    }
  }

  public isRunning(): boolean {
    return this.isActive;
  }
}

