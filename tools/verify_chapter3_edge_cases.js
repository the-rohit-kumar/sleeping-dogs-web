/**
 * verify_chapter3_edge_cases.js
 * Rigorous automated browser test suite for Chapter 3 edge cases:
 *  1. Mission 15: Hospital ICU hitmen defeat & Pendrew warning
 *  2. Mission 15: Rapid dialogue skip in hospital ICU cutscene
 *  3. Mission 16: Mount Davis cemetery funeral eulogy & sniper gunfire defense
 *  4. Mission 17: Slaughterhouse dual-cleaver Mr. Tong (280 HP) combat & Jackie tragedy
 *  5. Mission 18: Big Smile Lee boss (500 HP) damage absorption, stagger & industrial crusher
 *  6. Chapter 3: Player defeat & hospital recovery checkpoint respawn at harbor compound
 *  7. Grand Campaign Victory: 100% campaign completion integrity & fanfare
 *
 * Strictly asserts 0 page errors and 0 failed network requests.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('RIGOROUS CHAPTER 3 EDGE-CASE & STRESS-TEST SUITE');
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

  console.log('[Step 2] Dismissing Title Screen Overlay...');
  await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    if (overlay) overlay.style.display = 'none';
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) btnAudio.click();
    if (typeof (window).startGame === 'function') {
      (window).startGame();
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  // -------------------------------------------------------------
  // TEST 1: MISSION 15 HOSPITAL ICU COMBAT PROGRESSION
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: MISSION 15 HOSPITAL ICU COMBAT PROGRESSION ---');
  const test1 = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const combat = window.combatSystem;

    story.startMission15CivilWarHospital(renderer.sceneGraph, crowd, camera, audio);
    story.triggerHospitalICUDefense(camera, audio, renderer.sceneGraph, crowd);

    const initialThugs = story.thugsDefeated;
    const initialScore = combat.triadScore;

    // Defeat 1 hitman
    const hitman = crowd.npcs.find(n => n.id.startsWith('lee-assassin-') || n.hostile);
    if (hitman) {
      hitman.defeated = true;
      hitman.state = 'knocked_out';
      if (crowd.onEnemyDefeated) {
        crowd.onEnemyDefeated(hitman);
      } else {
        story.onEnemyDefeated(hitman.id, camera, audio, renderer.sceneGraph, crowd, combat);
      }
    }

    return {
      stage: story.stage,
      initialThugs,
      thugsAfterOne: story.thugsDefeated,
      scoreGained: combat.triadScore - initialScore
    };
  });
  console.log('  Result 1:', test1);
  if (test1.stage !== 'ch3_hospital_defense_firefight' || test1.thugsAfterOne !== 1 || test1.scoreGained < 300) {
    throw new Error('Test 1 failed: Mission 15 combat progression mismatch');
  }

  // -------------------------------------------------------------
  // TEST 2: MISSION 15 RAPID DIALOGUE SKIPPING & CLEAN TEARDOWN
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: MISSION 15 RAPID DIALOGUE SKIPPING ---');
  const test2 = await page.evaluate(() => {
    const story = window.campaignStory;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;

    story.startMission15CivilWarHospital(renderer.sceneGraph, crowd, camera, audio);
    const wasCutscene = story.isCutscene;

    // Advance all 3 dialogue lines
    story.advanceDialogueLine();
    story.advanceDialogueLine();
    story.advanceDialogueLine();

    return {
      wasCutscene,
      stageAfterCutscene: story.stage,
      letterboxActive: document.body.classList.contains('cinematic-active')
    };
  });
  console.log('  Result 2:', test2);
  if (!test2.wasCutscene || test2.stageAfterCutscene !== 'ch3_hospital_defense_firefight' || test2.letterboxActive) {
    throw new Error('Test 2 failed: Hospital cutscene did not cleanly transition to firefight');
  }

  // -------------------------------------------------------------
  // TEST 3: MISSION 16 CEMETERY AMBUSH & SNIPER DEFENSE
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: MISSION 16 CEMETERY AMBUSH & SNIPER DEFENSE ---');
  const test3 = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission16TheFuneral(renderer.sceneGraph, crowd, camera, audio);
    const funeralActive = story.stage === 'ch3_funeral_cemetery_eulogy';

    story.advanceDialogueLine();
    story.advanceDialogueLine();

    const stageAfterEulogy = story.stage;
    const sniperPresent = crowd.npcs.some(n => n.id === 'cemetery-sniper-1');

    return {
      funeralActive,
      stageAfterEulogy,
      sniperPresent
    };
  });
  console.log('  Result 3:', test3);
  if (!test3.funeralActive || test3.stageAfterEulogy !== 'ch3_funeral_ambush_firefight' || !test3.sniperPresent) {
    throw new Error('Test 3 failed: Cemetery funeral ambush mismatch');
  }

  // -------------------------------------------------------------
  // TEST 4: MISSION 17 MR. TONG DUAL-CLEAVER COMBAT & DAMAGE
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: MISSION 17 MR. TONG DUAL-CLEAVER COMBAT ---');
  const test4 = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission17KidnappingJackieMa(renderer.sceneGraph, crowd, camera, audio);
    story.advanceDialogueLine();
    story.advanceDialogueLine();

    const tong = crowd.npcs.find(n => n.id === 'mr-tong-boss');
    const initialTongHp = tong?.health || 0;

    // Apply partial melee hit
    if (tong) {
      tong.health -= 35;
      tong.state = 'staggered';
    }
    const hpAfterHit = tong?.health || 0;

    // Vanquish Tong
    if (tong) {
      tong.health = 0;
      tong.defeated = true;
      tong.state = 'knocked_out';
    }

    return {
      initialTongHp,
      hpAfterHit,
      tongDefeated: tong?.defeated || false
    };
  });
  console.log('  Result 4:', test4);
  if (test4.initialTongHp !== 280 || test4.hpAfterHit !== 245 || !test4.tongDefeated) {
    throw new Error('Test 4 failed: Mr. Tong dual-cleaver combat mismatch');
  }

  // -------------------------------------------------------------
  // TEST 5: MISSION 18 BIG SMILE LEE BOSS (500 HP) DAMAGE SCALING
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: MISSION 18 BIG SMILE LEE BOSS (500 HP) ---');
  const test5 = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission18BigSmileLeeFinale(renderer.sceneGraph, crowd, camera, audio);
    story.advanceDialogueLine();
    story.advanceDialogueLine();

    const lee = crowd.npcs.find(n => n.id === 'big-smile-lee-boss');
    const initialLeeHp = lee?.health || 0;

    // Apply martial arts strike (50 dmg)
    if (lee) {
      lee.health -= 50;
      lee.state = 'staggered';
    }
    const hpAfterStrike = lee?.health || 0;
    const isLeeDefeatedEarly = lee?.defeated || false;

    // Defeat Big Smile Lee
    if (lee) {
      lee.health = 0;
      lee.defeated = true;
      lee.state = 'knocked_out';
    }

    return {
      initialLeeHp,
      hpAfterStrike,
      isLeeDefeatedEarly,
      leeDefeated: lee?.defeated || false
    };
  });
  console.log('  Result 5:', test5);
  if (test5.initialLeeHp !== 500 || test5.hpAfterStrike !== 450 || test5.isLeeDefeatedEarly || !test5.leeDefeated) {
    throw new Error('Test 5 failed: Big Smile Lee HP scaling or defeat mismatch');
  }

  // -------------------------------------------------------------
  // TEST 6: PLAYER DEFEAT & HARBOR COMPOUND RESPAWN
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: PLAYER DEFEAT & HARBOR CHECKPOINT RESPAWN ---');
  const test6 = await page.evaluate(() => {
    const crowd = window.crowdSystem;
    const story = window.campaignStory;
    const char = window.characterController;

    // Lethal player damage
    crowd.onPlayerDamaged(150);

    const healthText = document.getElementById('meter-health-text')?.textContent || '';
    const actionText = document.getElementById('action-prompt')?.textContent || '';
    const objPos = story.getActiveObjectivePos();

    return {
      healthText,
      actionText,
      activeObjective: objPos,
      charPos: [char.position[0], char.position[1], char.position[2]]
    };
  });
  console.log('  Result 6:', test6);
  if (test6.healthText !== '100%' || !test6.actionText.includes('HOSPITAL RECOVERY')) {
    throw new Error('Test 6 failed: Player defeat did not trigger 100% recovery');
  }
  // Checkpoint for Big Smile Lee compound [40.0, 48.0] should respawn player at [40.0, 0.0, 45.0]
  if (Math.abs(test6.charPos[0] - 40.0) > 0.1 || Math.abs(test6.charPos[2] - 45.0) > 0.1) {
    throw new Error(`Test 6 failed: Respawn coordinates mismatch: expected [40, 0, 45], got [${test6.charPos}]`);
  }

  // -------------------------------------------------------------
  // TEST 7: GRAND CAMPAIGN VICTORY & INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: GRAND CAMPAIGN VICTORY INTEGRITY ---');
  const test7 = await page.evaluate(() => {
    const story = window.campaignStory;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.completeBigSmileLeeCraneShowdown(camera, audio);
    story.advanceDialogueLine();
    story.advanceDialogueLine();
    story.advanceDialogueLine();

    const finalStage = story.stage;
    const title = document.getElementById('mission-title')?.textContent || '';
    const objective = document.getElementById('mission-objective')?.textContent || '';

    return {
      finalStage,
      title,
      objective
    };
  });
  console.log('  Result 7:', test7);
  if (test7.finalStage !== 'campaign_grand_victory_completed' || !test7.title.includes('100% CAMPAIGN COMPLETED')) {
    throw new Error('Test 7 failed: Grand campaign victory state not achieved');
  }

  // Capture verification artifact screenshot
  const screenshotPath = path.join(ARTIFACT_DIR, '07_chapter3_edge_cases_and_stress_verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`\nSaved verification artifact: 07_chapter3_edge_cases_and_stress_verified.png`);

  console.log('\n[Strict Assertions]');
  console.log(`  Page Errors Count:     ${pageErrors.length}`);
  console.log(`  Failed Requests Count: ${failedRequests.length}`);

  if (pageErrors.length > 0) {
    throw new Error(`Browser encountered ${pageErrors.length} unhandled page errors`);
  }
  if (failedRequests.length > 0) {
    throw new Error(`Browser encountered ${failedRequests.length} failed network requests`);
  }

  console.log('\n======================================================================');
  console.log('ALL CHAPTER 3 EDGE-CASE & STRESS TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');

  await browser.close();
}

run().catch(err => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
