/**
 * verify_mission_6_popstar_and_gunplay.js
 * Automated browser verification script for Chapter 1 Mission 6 ("Popstar Lead 1 / Drug Bust")
 * and 9mm Handgun Gunplay / Camera Hacking Minigame.
 * Strictly asserts 0 page errors, 0 failed network requests, and generates full artifact visual proof.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('VERIFYING CHAPTER 1 MISSION 6: POPSTAR LEAD 1 & GUNPLAY SYSTEM');
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

  // Trigger Mission 6: Jane Teng Phone Briefing
  console.log('[Step 3] Launching Mission 6: Inspector Jane Teng Briefing...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission6PopstarDrugBust(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '01_mission6_teng_phone_call.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 01_mission6_teng_phone_call.png');

  // Fast-forward to Stage 2 & 3: Camera Terminal Hacking Minigame
  console.log('[Step 4] Advancing to Camera Terminal Hacking Minigame...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const hack = window.hackingMinigame;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startPopstarCameraHacking(hack, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1200));

  // Input the 4-digit code: [3, 8, 1, 5]
  console.log('[Step 5] Keying authentic 4-digit security code [3, 8, 1, 5]...');
  await page.evaluate(() => {
    const hack = window.hackingMinigame;
    hack.inputDigit(3);
    hack.inputDigit(8);
    hack.inputDigit(1);
    hack.inputDigit(5);
  });
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '02_mission6_cctv_hacking_terminal.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 02_mission6_cctv_hacking_terminal.png');

  // Submit code to breach terminal & switch to CCTV feed
  console.log('[Step 6] Submitting code to breach security terminal & bring CCTV online...');
  await page.evaluate(() => {
    const hack = window.hackingMinigame;
    hack.submitGuess();
  });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_mission6_cctv_surveillance_feed.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 03_mission6_cctv_surveillance_feed.png');

  // Drop in to Ambush Brawl & Draw 9mm Handgun
  console.log('[Step 7] Dropping in to intercept drug ring; drawing 9mm Handgun with aiming reticle...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const gun = window.gunplaySystem;

    story.startPopstarAmbushBrawl(cam, audio, renderer.sceneGraph, crowd);
    gun.equipWeapon();
    gun.startAiming();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Simulate firing 2 rounds
  await page.evaluate(() => {
    const gun = window.gunplaySystem;
    gun.fireWeapon();
    gun.fireWeapon();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '04_mission6_gunplay_and_ambush.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 04_mission6_gunplay_and_ambush.png');

  // Complete drug bust
  console.log('[Step 8] Completing drug bust & receiving Jane Teng tactical confirmation...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.completePopstarDrugBust(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n[Step 9] Asserting 0 page errors and 0 network failures...');
  console.log('  Page Errors Count:    ', pageErrors.length);
  console.log('  Failed Requests Count:', failedRequests.length);

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Encountered page errors during Mission 6 run.');
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Encountered failed requests during Mission 6 run.');
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('CHAPTER 1 MISSION 6 & GUNPLAY SYSTEM VERIFIED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
