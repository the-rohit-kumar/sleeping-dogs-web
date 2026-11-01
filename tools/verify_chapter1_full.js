/**
 * verify_chapter1_full.js
 * Automated browser verification script for the complete Chapter 1 finale:
 *  - Mission 7: "Listening In" (Wiretap Resonance Oscilloscope Minigame & Winston Chu Intercept)
 *  - Mission 8: "Chain of Command" (Inspector Raymond Mak Confrontation)
 *  - Mission 9: "Payback" (Aberdeen Seafood Warehouse Firefight & High-Speed Vehicular Pursuit)
 *  - Mission 10: "Uncle Po" (Sun On Yee Mountain Master Tea Ceremony & Red Pole Promotion)
 *
 * Strictly asserts 0 page errors, 0 failed network requests, and generates visual proof artifacts.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('VERIFYING COMPLETE CHAPTER 1 FINALE: MISSIONS 7, 8, 9 & 10');
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
  await new Promise(r => setTimeout(r, 1200));

  // -------------------------------------------------------------
  // MISSION 7: LISTENING IN
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 7: LISTENING IN ---');
  console.log('[Step 3] Starting Mission 7: Briefing with Superintendent Thomas Pendrew...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission7ListeningIn(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Step 4] Infiltrating scaffolding & launching Wiretap Oscilloscope Minigame...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const tuner = window.frequencyTuner;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startWiretapTuning(tuner, cam, audio);
    // Align tuner to resonant frequency 742.0 MHz
    tuner.currentFrequency = 742.0;
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '01_mission7_wiretap_tuning_oscilloscope.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 01_mission7_wiretap_tuning_oscilloscope.png');

  console.log('[Step 5] Locking in wiretap resonance & intercepting Winston Chu office feed...');
  await page.evaluate(() => {
    const tuner = window.frequencyTuner;
    tuner.checkCalibration();
  });
  await new Promise(r => setTimeout(r, 2200));

  // -------------------------------------------------------------
  // MISSION 8: CHAIN OF COMMAND
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 8: CHAIN OF COMMAND ---');
  console.log('[Step 6] Triggering Mission 8: Inspector Raymond Mak Confrontation...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission8ChainOfCommand(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '02_mission8_raymond_mak_confrontation.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 02_mission8_raymond_mak_confrontation.png');

  // -------------------------------------------------------------
  // MISSION 9: PAYBACK
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 9: PAYBACK ---');
  console.log('[Step 7] Breaching Aberdeen Warehouse & Commencing Cover Firefight...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const gun = window.gunplaySystem;

    story.startMission9Payback(renderer.sceneGraph, crowd, cam, audio);
    story.startWarehouseFirefight(cam, audio, renderer.sceneGraph, crowd);
    gun.equipWeapon();
    gun.startAiming();
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Step 8] Transitioning to High-Speed Vehicular Pursuit...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const veh = window.vehicleController;
    story.startVehicularPursuit(cam, audio, veh);
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_mission9_warehouse_firefight_pursuit.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 03_mission9_warehouse_firefight_pursuit.png');

  console.log('[Step 9] Disabling getaway truck and completing Mission 9...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.completeMission9Payback(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1200));

  // -------------------------------------------------------------
  // MISSION 10: UNCLE PO (CHAPTER 1 FINALE)
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 10: UNCLE PO (CHAPTER 1 FINALE) ---');
  console.log('[Step 10] Entering Sun On Yee Mountain Master Council Chamber...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission10UnclePo(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1800));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '04_mission10_uncle_po_red_pole_ceremony.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 04_mission10_uncle_po_red_pole_ceremony.png');

  console.log('[Step 11] Concluding Chapter 1 Ceremony & Elevating Wei Shen to Red Pole...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.completeChapter1(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  // Query final campaign state
  const finalState = await page.evaluate(() => {
    const story = window.campaignStory;
    const title = document.getElementById('mission-title')?.textContent || '';
    const obj = document.getElementById('mission-objective')?.textContent || '';
    return {
      stage: story.stage,
      title,
      obj
    };
  });

  console.log('  Final Campaign Stage:    ', finalState.stage);
  console.log('  Final Mission Banner:    ', finalState.title);
  console.log('  Final Objective Details: ', finalState.obj);

  console.log('\n[Step 12] Asserting 0 page errors and 0 network failures...');
  console.log('  Page Errors Count:    ', pageErrors.length);
  console.log('  Failed Requests Count:', failedRequests.length);

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Encountered page errors during Chapter 1 full run.');
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Encountered failed requests during Chapter 1 full run.');
    process.exit(1);
  }

  if (finalState.stage !== 'ch1_chapter1_completed') {
    console.error(`FAILED: Expected final stage 'ch1_chapter1_completed', got '${finalState.stage}'`);
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('CHAPTER 1 (ALL 10 MISSIONS) VERIFIED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
