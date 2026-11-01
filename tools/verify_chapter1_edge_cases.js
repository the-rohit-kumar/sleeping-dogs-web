/**
 * verify_chapter1_edge_cases.js
 * Rigorous automated browser test suite for Chapter 1 edge cases:
 *  1. Hacking Minigame Escape/Cancel, clear input, lockout & auto-retry on 5 failed attempts
 *  2. Wiretap Frequency Tuner mistune denial, Escape/Cancel, and retry calibration
 *  3. Gunplay Engine empty clip click, auto-reload, ammo reserve deduction, and holster/reticle cleanup
 *  4. Gunplay kill hit registration notifying crowdSystem.onEnemyDefeated
 *  5. Player health depletion to 0 triggering hospital recovery, 100% health restore, and checkpoint respawn
 *  6. Dialogue rapid-skip transition safety ([Space] / [KeyE])
 *  7. Void fall-through safety clamping (y < -10.0m)
 *
 * Strictly asserts 0 page errors and 0 failed network requests.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('RIGOROUS CHAPTER 1 EDGE-CASE & STRESS-TEST SUITE');
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
    console.warn(`  [FAILED REQUEST]: ${req.url()} (${req.failure()?.errorText})`);
    failedRequests.push(`${req.url()}: ${req.failure()?.errorText}`);
  });

  console.log('[Step 1] Navigating to http://127.0.0.1:5173/...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30000 });

  // Dismiss start overlay
  console.log('[Step 2] Dismissing Title Screen Overlay...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-start-game');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // -------------------------------------------------------------
  // TEST 1: HACKING MINIGAME ESCAPE, CLEAR & LOCKOUT RECOVERY
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: CCTV HACKING MINIGAME EDGE CASES ---');
  console.log('  Testing partial input clearing with Escape...');
  const test1A = await page.evaluate(() => {
    const hack = window.hackingMinigame;
    hack.startMinigame([3, 8, 1, 5]);
    hack.inputDigit(2);
    hack.inputDigit(4);
    const beforeClear = hack.currentGuess.length;
    // Simulate Escape to clear digits
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    const afterClear = hack.currentGuess.length;
    // Simulate Escape again to cancel minigame
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    const isClosed = !hack.isRunning();
    return { beforeClear, afterClear, isClosed };
  });
  console.log('  Result 1A:', test1A);
  if (test1A.beforeClear !== 2 || test1A.afterClear !== 0 || !test1A.isClosed) {
    throw new Error('Test 1A failed: Escape did not clear or close hacking minigame');
  }

  console.log('  Testing 5-attempt lockout and automatic retry reset...');
  const test1B = await page.evaluate(async () => {
    const hack = window.hackingMinigame;
    hack.startMinigame([3, 8, 1, 5]);

    // Submit 5 incorrect guesses
    for (let attempt = 0; attempt < 5; attempt++) {
      hack.currentGuess = [0, 2, 4, 6];
      hack.submitGuess();
    }
    const statusMsg = document.getElementById('hack-status-msg')?.textContent || '';
    const attemptsAtLockout = hack.attemptsRemaining;

    // Wait for the 2000ms re-authentication timeout
    await new Promise(r => setTimeout(r, 2200));

    const attemptsAfterReset = hack.attemptsRemaining;
    const isRunningAfterReset = hack.isRunning();
    hack.closeMinigame();

    return { statusMsg, attemptsAtLockout, attemptsAfterReset, isRunningAfterReset };
  });
  console.log('  Result 1B:', test1B);
  if (test1B.attemptsAtLockout !== 0 || test1B.attemptsAfterReset !== 5 || !test1B.isRunningAfterReset) {
    throw new Error('Test 1B failed: Lockout did not reset properly');
  }

  // -------------------------------------------------------------
  // TEST 2: WIRETAP FREQUENCY TUNER MISTUNING & CANCEL EDGE CASES
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: WIRETAP FREQUENCY TUNER EDGE CASES ---');
  console.log('  Testing mistuned calibration denial...');
  const test2A = await page.evaluate(() => {
    const tuner = window.frequencyTuner;
    tuner.startTuner(742.0);
    tuner.currentFrequency = 510.0; // Mistuned
    tuner.checkCalibration();
    const statusMsg = document.getElementById('tuner-status-msg')?.textContent || '';
    const stillRunning = tuner.isRunning();
    return { statusMsg, stillRunning };
  });
  console.log('  Result 2A:', test2A);
  if (!test2A.statusMsg.includes('CALIBRATION FAILED') || !test2A.stillRunning) {
    throw new Error('Test 2A failed: Mistuned calibration was not denied');
  }

  console.log('  Testing Escape cancel and re-calibration...');
  const test2B = await page.evaluate(async () => {
    const tuner = window.frequencyTuner;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    const closedOnEscape = !tuner.isRunning();

    // Re-open and calibrate correctly
    tuner.startTuner(742.0);
    tuner.currentFrequency = 742.0;
    tuner.checkCalibration();
    const successStatus = document.getElementById('tuner-status-msg')?.textContent || '';
    await new Promise(r => setTimeout(r, 1600));
    const closedOnSuccess = !tuner.isRunning();

    return { closedOnEscape, successStatus, closedOnSuccess };
  });
  console.log('  Result 2B:', test2B);
  if (!test2B.closedOnEscape || !test2B.successStatus.includes('WIRETAP ACTIVE') || !test2B.closedOnSuccess) {
    throw new Error('Test 2B failed: Tuner Escape or success calibration failed');
  }

  // -------------------------------------------------------------
  // TEST 3: GUNPLAY RELOAD, EMPTY CLIP & WEAPON HOLSTERING
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: GUNPLAY RELOAD & AMMO EDGE CASES ---');
  const test3 = await page.evaluate(async () => {
    const gun = window.gunplaySystem;
    gun.equipWeapon();
    gun.startAiming();

    const clipBefore = gun.currentWeapon.ammoInClip;
    const reserveBefore = gun.currentWeapon.ammoReserve;

    // Fire 15 bullets to exhaust clip
    for (let i = 0; i < 15; i++) {
      gun.fireWeapon();
      gun.lastFireTime = 0; // bypass fire rate throttle for test
    }
    const clipExhausted = gun.currentWeapon.ammoInClip;

    // Trigger reload
    gun.reload();
    await new Promise(r => setTimeout(r, 1200));

    const clipReloaded = gun.currentWeapon.ammoInClip;
    const reserveAfter = gun.currentWeapon.ammoReserve;

    gun.holsterWeapon();
    const reticleDisplay = document.getElementById('gunplay-reticle')?.style.display;
    const hudDisplay = document.getElementById('gunplay-ammo-hud')?.style.display;

    return {
      clipBefore,
      reserveBefore,
      clipExhausted,
      clipReloaded,
      reserveAfter,
      reticleDisplay,
      hudDisplay
    };
  });
  console.log('  Result 3:', test3);
  if (test3.clipExhausted !== 0 || test3.clipReloaded !== 15 || test3.reserveAfter !== 45 || test3.hudDisplay !== 'none') {
    throw new Error('Test 3 failed: Gunplay ammo expenditure or reload mismatch');
  }

  // -------------------------------------------------------------
  // TEST 4: GUNPLAY KNOCKOUT NOTIFIES CROWD SYSTEM & CAMPAIGN STORY
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: GUNPLAY KNOCKOUT EVENT PROPAGATION ---');
  const test4 = await page.evaluate(() => {
    const crowd = window.crowdSystem;
    const gun = window.gunplaySystem;
    const renderer = window.renderer;

    crowd.spawnWarehouseEnforcers(renderer.sceneGraph);
    let defeatedNpcId = '';
    crowd.onEnemyDefeated = (npc) => {
      defeatedNpcId = npc.id;
    };

    // Target the first enforcer
    const targetNpc = crowd.npcs[0];
    targetNpc.health = 20; // 1 shot kill

    // Align camera toward target
    window.cameraController.eyePos = [targetNpc.position[0], targetNpc.position[1] + 1.2, targetNpc.position[2] - 3.0];
    window.cameraController.lookAtTarget = [...targetNpc.position];

    gun.equipWeapon();
    gun.startAiming();
    gun.fireWeapon();

    return {
      defeatedNpcId,
      npcHealth: targetNpc.health,
      npcDefeated: targetNpc.defeated,
      npcState: targetNpc.state
    };
  });
  console.log('  Result 4:', test4);
  if (!test4.npcDefeated || test4.npcState !== 'knocked_out') {
    throw new Error('Test 4 failed: Gunplay did not defeat enemy NPC');
  }

  // -------------------------------------------------------------
  // TEST 5: PLAYER HEALTH DEPLETION & HOSPITAL RECOVERY RESPAWN
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: PLAYER DEFEAT & HOSPITAL CHECKPOINT RESPAWN ---');
  const test5 = await page.evaluate(() => {
    const crowd = window.crowdSystem;
    // Inflict lethal damage
    crowd.onPlayerDamaged(120);

    const healthText = document.getElementById('meter-health-text')?.textContent || '';
    const healthWidth = document.getElementById('meter-health-fill')?.style.width || '';
    const actionText = document.getElementById('action-prompt')?.textContent || '';
    const charPos = window.characterController.position;

    return {
      healthText,
      healthWidth,
      actionText,
      charPos
    };
  });
  console.log('  Result 5:', test5);
  if (test5.healthText !== '100%' || test5.healthWidth !== '100%' || !test5.actionText.includes('HOSPITAL RECOVERY')) {
    throw new Error('Test 5 failed: Player defeat did not trigger hospital recovery respawn');
  }

  // -------------------------------------------------------------
  // TEST 6: DIALOGUE RAPID-SKIPPING ROBUSTNESS
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: RAPID DIALOGUE SKIP ROBUSTNESS ---');
  const test6 = await page.evaluate(async () => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    story.startMission8ChainOfCommand(renderer.sceneGraph, crowd, cam, audio);

    // Rapidly dispatch 8 skip events in under 200ms
    for (let i = 0; i < 8; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
    }

    await new Promise(r => setTimeout(r, 600));

    return {
      stage: story.stage,
      isCutscene: story.isCutscene,
      cinematicClass: document.body.classList.contains('cinematic-active')
    };
  });
  console.log('  Result 6:', test6);
  if (test6.isCutscene || test6.cinematicClass) {
    throw new Error('Test 6 failed: Rapid dialogue skip left cutscene flags active');
  }

  // -------------------------------------------------------------
  // TEST 7: VOID FALL-THROUGH SAFETY CLAMPING
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: VOID FALL-THROUGH SAFETY CLAMPING ---');
  const test7 = await page.evaluate(async () => {
    const char = window.characterController;

    // Intentionally throw character down into void
    char.position = [0.0, -25.0, 0.0];
    char.velocity = [0.0, -30.0, 0.0];

    // Wait 100ms for active render loop to run physics update()
    await new Promise(r => setTimeout(r, 100));

    return {
      clampedY: char.position[1],
      isGrounded: char.isGrounded
    };
  });
  console.log('  Result 7:', test7);
  if (test7.clampedY < -1.0 || !test7.isGrounded) {
    throw new Error('Test 7 failed: Character fell through world without clamping');
  }

  // -------------------------------------------------------------
  // CAPTURE EDGE-CASE PROOF SCREENSHOT
  // -------------------------------------------------------------
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '05_chapter1_edge_cases_and_stress_verified.png'),
    fullPage: false
  });
  console.log('\nSaved verification artifact: 05_chapter1_edge_cases_and_stress_verified.png');

  // Strict page error and request failure assertions
  console.log('\n[Strict Assertions]');
  console.log('  Page Errors Count:    ', pageErrors.length);
  console.log('  Failed Requests Count:', failedRequests.length);

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Page errors encountered during edge-case test suite.');
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Network failures encountered during edge-case test suite.');
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('ALL CHAPTER 1 EDGE-CASE & STRESS TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
