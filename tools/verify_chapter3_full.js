/**
 * verify_chapter3_full.js
 * End-to-end automated browser verification suite for complete Chapter 3:
 *  - Mission 15: "Civil War / Hospital Defense" (Queen Mary Hospital ICU, Uncle Po protection, hitmen assault)
 *  - Mission 16: "The Funeral" (Mount Davis cemetery, Broken Nose Jiang eulogy, cemetery ambush firefight)
 *  - Mission 17: "The Kidnapping of Jackie Ma" (Kennedy Town slaughterhouse, meat hooks, dual-cleaver Mr. Tong duel)
 *  - Mission 18: "Big Smile Lee (Grand Campaign Finale)" (Harbor compound, crane showdown, Big Smile Lee 500 HP boss fight, industrial crusher)
 *  - Grand Campaign Victory: Sun On Yee Dragon Head ascension, Jane Teng case closure, 100% completion fanfare
 *
 * Strictly asserts 0 page errors and 0 failed network requests.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('VERIFYING COMPLETE CHAPTER 3: KENNEDY TOWN / TRIAD WAR & GRAND FINALE');
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
  // MISSION 15: CIVIL WAR / HOSPITAL DEFENSE
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 15: CIVIL WAR / HOSPITAL DEFENSE ---');
  console.log('[Step 3] Launching Mission 15: Queen Mary Hospital ICU & Uncle Po Defense...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission15CivilWarHospital(renderer.sceneGraph, crowd, camera, audio);
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_mission15_hospital_icu_defense.png') });
  console.log('  Saved artifact: 01_mission15_hospital_icu_defense.png');

  console.log('[Step 4] Defending Uncle Po ICU from Big Smile Lee hitmen...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const combat = window.combatSystem;

    // Trigger hospital corridor firefight
    story.triggerHospitalICUDefense(camera, audio, renderer.sceneGraph, crowd);

    // Defeat 3 hitmen
    for (let i = 0; i < 3; i++) {
      story.onEnemyDefeated(`lee-assassin-${i+1}`, camera, audio, renderer.sceneGraph, crowd, combat);
    }
    story.completeHospitalDefense(camera, audio);
  });

  // -------------------------------------------------------------
  // MISSION 16: THE FUNERAL
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 16: THE FUNERAL ---');
  console.log('[Step 5] Mount Davis Cemetery Funeral Eulogy & Ambush...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission16TheFuneral(renderer.sceneGraph, crowd, camera, audio);
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_mission16_cemetery_funeral_ambush.png') });
  console.log('  Saved artifact: 02_mission16_cemetery_funeral_ambush.png');

  console.log('[Step 6] Repelling Cemetery Ambush & Gunfire...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const combat = window.combatSystem;

    story.triggerCemeteryAmbushFirefight(camera, audio, renderer.sceneGraph, crowd);

    // Defeat 3 snipers/gunmen
    for (let i = 0; i < 3; i++) {
      story.onEnemyDefeated(`cemetery-gunman-${i+1}`, camera, audio, renderer.sceneGraph, crowd, combat);
    }
    story.completeFuneralAmbush(camera, audio);
  });

  // -------------------------------------------------------------
  // MISSION 17: THE KIDNAPPING OF JACKIE MA
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 17: THE KIDNAPPING OF JACKIE MA ---');
  console.log('[Step 7] Infiltrating Kennedy Town Slaughterhouse & Dual-Cleaver Duel...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission17KidnappingJackieMa(renderer.sceneGraph, crowd, camera, audio);
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_mission17_slaughterhouse_cleaver_duel.png') });
  console.log('  Saved artifact: 03_mission17_slaughterhouse_cleaver_duel.png');

  console.log('[Step 8] Vanquishing Mr. Tong & Discovering Jackie Ma...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const combat = window.combatSystem;

    story.triggerSlaughterhouseCleaverBrawl(camera, audio, renderer.sceneGraph, crowd);

    // Defeat butchers & Mr. Tong
    story.onEnemyDefeated('butcher-1', camera, audio, renderer.sceneGraph, crowd, combat);
    story.onEnemyDefeated('butcher-2', camera, audio, renderer.sceneGraph, crowd, combat);
    story.onEnemyDefeated('mr-tong-boss', camera, audio, renderer.sceneGraph, crowd, combat);

    story.discoverJackieMaMeatLocker(camera, audio);
    story.advanceDialogueLine();
    story.advanceDialogueLine();
  });

  // -------------------------------------------------------------
  // MISSION 18: BIG SMILE LEE (GRAND FINALE)
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 18: BIG SMILE LEE (GRAND FINALE) ---');
  console.log('[Step 9] Harbor Compound Breach & Container Crane Showdown...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.startMission18BigSmileLeeFinale(renderer.sceneGraph, crowd, camera, audio);
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_mission18_big_smile_lee_crane_showdown.png') });
  console.log('  Saved artifact: 04_mission18_big_smile_lee_crane_showdown.png');

  console.log('[Step 10] Defeating Big Smile Lee & Industrial Crusher Climax...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    const renderer = window.renderer;
    const camera = window.cameraController;
    const audio = window.audioEngine;
    const combat = window.combatSystem;

    story.triggerContainerCraneClimax(camera, audio, renderer.sceneGraph, crowd);

    // Defeat 2 guards and Big Smile Lee (500 HP)
    story.onEnemyDefeated('lee-elite-guard-1', camera, audio, renderer.sceneGraph, crowd, combat);
    story.onEnemyDefeated('lee-elite-guard-2', camera, audio, renderer.sceneGraph, crowd, combat);
    story.onEnemyDefeated('big-smile-lee-boss', camera, audio, renderer.sceneGraph, crowd, combat);

    story.completeBigSmileLeeCraneShowdown(camera, audio);
    story.advanceDialogueLine();
    story.advanceDialogueLine();
    story.advanceDialogueLine();
  });

  console.log('[Step 11] Concluding Grand Campaign Victory...');
  const finalTelemetry = await page.evaluate(() => {
    const story = window.campaignStory;
    const camera = window.cameraController;
    const audio = window.audioEngine;

    story.completeGrandCampaignVictory(camera, audio);

    return {
      stage: story.stage,
      title: document.getElementById('mission-title')?.textContent || '',
      objective: document.getElementById('mission-objective')?.textContent || ''
    };
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_campaign_grand_victory_completed.png') });
  console.log('  Saved artifact: 05_campaign_grand_victory_completed.png');

  console.log(`  Final Campaign Stage:     ${finalTelemetry.stage}`);
  console.log(`  Final Mission Banner:     ${finalTelemetry.title}`);
  console.log(`  Final Objective Details:  ${finalTelemetry.objective}`);

  if (finalTelemetry.stage !== 'campaign_grand_victory_completed') {
    throw new Error(`Expected stage campaign_grand_victory_completed, got ${finalTelemetry.stage}`);
  }

  console.log('\n[Step 12] Asserting 0 page errors and 0 network failures...');
  console.log(`  Page Errors Count:     ${pageErrors.length}`);
  console.log(`  Failed Requests Count: ${failedRequests.length}`);

  if (pageErrors.length > 0) {
    throw new Error(`Encountered ${pageErrors.length} unhandled page errors: ${pageErrors.join('; ')}`);
  }
  if (failedRequests.length > 0) {
    throw new Error(`Encountered ${failedRequests.length} failed network requests: ${failedRequests.join('; ')}`);
  }

  console.log('\n======================================================================');
  console.log('CHAPTER 3 & GRAND CAMPAIGN FINALE (MISSIONS 15-18) VERIFIED WITH 100% SUCCESS!');
  console.log('======================================================================');

  await browser.close();
}

run().catch(err => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
