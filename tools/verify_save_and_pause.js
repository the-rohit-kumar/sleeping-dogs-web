import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('OPTION A VERIFICATION: GAME STATE PERSISTENCE & IN-GAME PAUSE MENU');
  console.log('======================================================================\n');

  const pageErrors = [];
  const failedRequests = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--enable-accelerated-2d-canvas'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('pageerror', err => {
    console.error('  [PAGE ERROR]:', err.message);
    pageErrors.push(err.message);
  });

  page.on('requestfailed', req => {
    console.error('  [REQUEST FAILED]:', req.url(), req.failure()?.errorText);
    failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
  });

  console.log('[Step 1] Navigating to http://127.0.0.1:5173/...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('[Step 2] Asserting Initial Title Screen & Zero-Setup Overlay...');
  const titleScreenCheck = await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    const btnPlay = document.getElementById('btn-start-game');
    const isVisible = overlay && !overlay.classList.contains('hidden');
    return { hasOverlay: !!overlay, isVisible, hasPlayBtn: !!btnPlay };
  });
  console.log('  Title Screen state:', titleScreenCheck);
  if (!titleScreenCheck.isVisible) throw new Error('Start screen overlay is not visible on launch');

  console.log('[Step 3] Launching Game via Play Button & Triggering Checkpoint AutoSave...');
  await page.evaluate(() => {
    if (typeof window.startGame === 'function') {
      window.startGame();
    }
  });

  await new Promise(r => setTimeout(r, 2200));

  console.log('[Step 4] Verifying AutoSave Persistence...');
  const autoSaveCheck = await page.evaluate(() => {
    const sm = window.saveManager;
    if (!sm) return { error: 'window.saveManager not found' };
    const autoSlot = sm.loadSlot('autosave');
    const hasBadge = !!document.getElementById('autosave-indicator');
    return {
      hasAutoSave: !!autoSlot,
      slotName: autoSlot?.slotName,
      stage: autoSlot?.progression?.stage,
      position: autoSlot?.player?.position,
      health: autoSlot?.player?.health,
      hasBadge
    };
  });
  console.log('  AutoSave Slot Check:', autoSaveCheck);
  if (!autoSaveCheck.hasAutoSave) throw new Error('AutoSave checkpoint was not persisted');

  console.log('[Step 5] Triggering [ESC] Hotkey to Open Authentic Pause Menu...');
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  });

  await new Promise(r => setTimeout(r, 600));

  const pauseMenuCheck = await page.evaluate(() => {
    const pm = window.pauseMenu;
    const overlay = document.getElementById('pause-menu-overlay');
    const isVisible = overlay && !overlay.classList.contains('hidden');
    return {
      isPaused: pm?.isPaused,
      isOverlayVisible: isVisible
    };
  });
  console.log('  Pause Menu State:', pauseMenuCheck);
  if (!pauseMenuCheck.isPaused || !pauseMenuCheck.isOverlayVisible) {
    throw new Error('Pause menu failed to open on [ESC]');
  }

  console.log('[Step 6] Capturing Artifact: In-Game Pause Menu Full-Screen Overlay...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_01_menu_open.png') });
  console.log('  Saved artifact: save_pause_01_menu_open.png');

  console.log('[Step 7] Navigating to "SAVE GAME" Tab & Executing Manual Save to Slot 1...');
  await page.evaluate(() => {
    const btnSaveTab = document.querySelector('.pause-tab-btn[data-tab="save"]');
    if (btnSaveTab) btnSaveTab.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const btnSlot1 = document.querySelector('.btn-slot-save[data-slot="slot1"]');
    if (btnSlot1) btnSlot1.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const manualSaveCheck = await page.evaluate(() => {
    const sm = window.saveManager;
    const s1 = sm.loadSlot('slot1');
    return {
      hasSlot1: !!s1,
      slotName: s1?.slotName,
      health: s1?.player?.health,
      pos: s1?.player?.position,
      dateFormatted: s1?.dateFormatted
    };
  });
  console.log('  Manual Save Slot 1 Check:', manualSaveCheck);
  if (!manualSaveCheck.hasSlot1) throw new Error('Slot 1 manual save failed');

  console.log('[Step 8] Capturing Artifact: Manual Save Game Tab...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_02_manual_save.png') });
  console.log('  Saved artifact: save_pause_02_manual_save.png');

  console.log('[Step 9] Navigating to "AUDIO SETTINGS" & Modifying Mixer Sliders...');
  await page.evaluate(() => {
    const btnAudioTab = document.querySelector('.pause-tab-btn[data-tab="audio"]');
    if (btnAudioTab) btnAudioTab.click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const sfxSlider = document.getElementById('slider-vol-sfx');
    const musicSlider = document.getElementById('slider-vol-music');
    if (sfxSlider) {
      sfxSlider.value = '75';
      sfxSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (musicSlider) {
      musicSlider.value = '60';
      musicSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const audioLevels = await page.evaluate(() => {
    const ae = window.audioEngine;
    const sm = window.saveManager;
    const saved = sm.loadSettings();
    return {
      engineSfx: ae.sfxVolume,
      engineMusic: ae.musicVolume,
      savedSfx: saved.sfxVolume,
      savedMusic: saved.musicVolume
    };
  });
  console.log('  Audio Sub-Bus Mixer Verification:', audioLevels);
  if (Math.abs(audioLevels.engineSfx - 0.75) > 0.02 || Math.abs(audioLevels.engineMusic - 0.60) > 0.02) {
    throw new Error('Audio mixer slider failed to modulate audioEngine bus volumes');
  }

  console.log('[Step 10] Capturing Artifact: Audio Settings & Real-time Mixer...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_03_settings_mixer.png') });
  console.log('  Saved artifact: save_pause_03_settings_mixer.png');

  console.log('[Step 11] Navigating to "LOAD GAME" Tab...');
  await page.evaluate(() => {
    const btnLoadTab = document.querySelector('.pause-tab-btn[data-tab="load"]');
    if (btnLoadTab) btnLoadTab.click();
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('[Step 12] Capturing Artifact: Load Game Tab with Slot List...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_04_load_menu.png') });
  console.log('  Saved artifact: save_pause_04_load_menu.png');

  console.log('[Step 13] Mutating Player Position and Testing Game State Restoration...');
  await page.evaluate(() => {
    // Intentionally offset player position
    window.characterController.position = [15.5, 0.0, -22.0];
    window.playerHealth = 42;
  });

  // Click Load Slot 1
  await page.evaluate(() => {
    const btnLoadSlot1 = document.querySelector('.btn-slot-load[data-slot="slot1"]');
    if (btnLoadSlot1) btnLoadSlot1.click();
  });

  await new Promise(r => setTimeout(r, 800));

  const restoreCheck = await page.evaluate(() => {
    const pm = window.pauseMenu;
    const char = window.characterController;
    const sm = window.saveManager;
    const s1 = sm.loadSlot('slot1');
    const posMatches = Math.abs(char.position[0] - s1.player.position[0]) < 0.01 &&
                       Math.abs(char.position[2] - s1.player.position[2]) < 0.01;
    return {
      isPaused: pm.isPaused,
      currentPos: char.position,
      savedPos: s1.player.position,
      posMatches
    };
  });
  console.log('  Load Restoration Check:', restoreCheck);
  if (!restoreCheck.posMatches || restoreCheck.isPaused) {
    throw new Error('Load game failed to restore player position or resume gameplay');
  }

  console.log('[Step 14] Capturing Artifact: Resumed Gameplay Post-Restore...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_05_resumed_gameplay.png') });
  console.log('  Saved artifact: save_pause_05_resumed_gameplay.png');

  console.log('[Step 15] Testing Title Screen "CONTINUE GAME" Button Integration...');
  await page.evaluate(() => {
    window.pauseMenu.open();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const btnQuitTab = document.querySelector('.pause-tab-btn[data-tab="quit"]');
    if (btnQuitTab) btnQuitTab.click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const btnConfirmQuit = document.getElementById('btn-pause-quit');
    if (btnConfirmQuit) btnConfirmQuit.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const titleContinueCheck = await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    const btnContinue = document.getElementById('btn-continue-game');
    const isVisible = overlay && !overlay.classList.contains('hidden');
    const continueVisible = btnContinue && btnContinue.style.display !== 'none';
    return {
      titleVisible: isVisible,
      continueVisible,
      continueText: btnContinue?.textContent
    };
  });
  console.log('  Title Screen Return & Continue Button Check:', titleContinueCheck);
  if (!titleContinueCheck.titleVisible || !titleContinueCheck.continueVisible) {
    throw new Error('Title screen return or CONTINUE GAME button failed');
  }

  console.log('[Step 16] Capturing Artifact: Title Screen with Active CONTINUE Button...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'save_pause_06_continue_title.png') });
  console.log('  Saved artifact: save_pause_06_continue_title.png');

  console.log('\n======================================================================');
  console.log('VERIFICATION AUDIT SUMMARY:');
  console.log(`  Page Errors:      ${pageErrors.length}`);
  console.log(`  Failed Requests:  ${failedRequests.length}`);
  console.log('======================================================================');

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Uncaught page errors detected:', pageErrors);
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Network requests failed:', failedRequests);
    process.exit(1);
  }

  console.log('\n>>> OPTION A: SAVE/LOAD & PAUSE MENU VERIFICATION SUCCESSFUL (0 ERRORS) <<<\n');
}

run().catch(err => {
  console.error('\nVerification run threw fatal exception:', err);
  process.exit(1);
});

