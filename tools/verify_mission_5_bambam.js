/**
 * verify_mission_5_bambam.js
 * Scene Fixture & Visual Artifact Verification Script:
 * Verifies Chapter 1 Mission 5: "Club Bam Bam"
 *  - Screenshot 1: Winston Chu Golden Koi Briefing (Targeting Benny at Club Bam Bam)
 *  - Screenshot 2: Club Bam Bam Entrance & Dance Floor Melee (Bouncer confrontation & club music)
 *  - Screenshot 3: VIP Lounge Showdown (Benny, elite bodyguards & glass/bottle smash)
 *  - Screenshot 4: Restroom Urinal Environmental Finisher & Benny Interrogation
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import fs from 'fs';
import assert from 'node:assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\rohit\\.gemini\\antigravity\\brain\\b75b9b44-0b2a-4450-a6bd-18dd1450778f';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function verifyMission5ClubBamBam() {
  console.log('======================================================================');
  console.log('STARTING MISSION 5: CLUB BAM BAM VERIFICATION');
  console.log('======================================================================\n');

  const pageErrors = [];
  const failedRequests = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1024,640'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 640 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[Browser Error]: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[Browser PageError]: ${err.message}`);
    pageErrors.push(err.message);
  });

  page.on('requestfailed', req => {
    const f = req.failure();
    if (f && f.errorText !== 'net::ERR_ABORTED') {
      const msg = `${req.url()} failed: ${f.errorText}`;
      console.error(`[Request Failed]: ${msg}`);
      failedRequests.push(msg);
    }
  });

  console.log('[Step 1] Navigating to http://127.0.0.1:5173/...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  // Dismiss start overlay
  await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    if (overlay) overlay.classList.add('hidden');
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Trigger Mission 5 — Winston Chu Golden Koi Briefing
  console.log('\n[Step 2] Triggering Stage 1: Winston Chu Golden Koi Briefing...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    story.startMission5ClubBamBam(scene, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 2000));

  const screenshot1Path = path.join(ARTIFACTS_DIR, '01_mission5_winston_golden_koi_briefing.png');
  await page.screenshot({ path: screenshot1Path });
  console.log(`  Saved: ${screenshot1Path}`);

  // Step 3: Trigger Stage 2 — Club Bam Bam Entrance & Dance Floor Melee
  console.log('\n[Step 3] Triggering Stage 2: Club Bam Bam Entrance & Dance Floor Bouncer Melee...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    // Arrive at Club Bam Bam
    story.arriveAtClubBamBam(cam, audio, scene, crowd);
  });
  await new Promise(r => setTimeout(r, 2500));

  const screenshot2Path = path.join(ARTIFACTS_DIR, '02_mission5_club_bambam_entrance.png');
  await page.screenshot({ path: screenshot2Path });
  console.log(`  Saved: ${screenshot2Path}`);

  // Step 4: Advance to Stage 3 — VIP Lounge Showdown & Bottle Smash
  console.log('\n[Step 4] Triggering Stage 3: VIP Lounge Showdown & Benny Confrontation...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    story.advanceToVIPLounge(cam, audio, scene, crowd);
  });
  await new Promise(r => setTimeout(r, 2500));

  const screenshot3Path = path.join(ARTIFACTS_DIR, '03_mission5_vip_lounge_table_smash.png');
  await page.screenshot({ path: screenshot3Path });
  console.log(`  Saved: ${screenshot3Path}`);

  // Step 5: Advance to Stage 4 — Restroom Urinal Environmental Finisher & Interrogation
  console.log('\n[Step 5] Triggering Stage 4: Restroom Urinal Finisher & Intel Interrogation...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    story.triggerBathroomRestroomShowdown(cam, audio, scene, crowd);
  });
  await new Promise(r => setTimeout(r, 2500));

  const screenshot4Path = path.join(ARTIFACTS_DIR, '04_mission5_bathroom_urinal_finisher.png');
  await page.screenshot({ path: screenshot4Path });
  console.log(`  Saved: ${screenshot4Path}`);

  // Step 6: Complete Mission 5
  console.log('\n[Step 6] Completing Mission 5: Benny Interrogated & Score Awarded...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;

    story.completeClubBamBam(cam, audio);
  });
  await new Promise(r => setTimeout(r, 2000));

  // Step 7: Telemetry & Error Assertions
  const telemetry = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    return {
      stage: story?.stage,
      isCutscene: story?.isCutscene,
      npcCount: crowd?.npcs?.length || 0,
      activeObjective: story?.getActiveObjectivePos()
    };
  });

  console.log(`\nFinal Mission Telemetry: ${JSON.stringify(telemetry, null, 2)}`);
  console.log(`Page Errors: ${pageErrors.length}, Failed Requests: ${failedRequests.length}`);

  await browser.close();

  assert.strictEqual(pageErrors.length, 0, `Encountered unhandled page errors: ${pageErrors.join('; ')}`);
  assert.strictEqual(failedRequests.length, 0, `Encountered failed network requests: ${failedRequests.join('; ')}`);

  console.log('\n======================================================================');
  console.log('MISSION 5: CLUB BAM BAM VERIFICATION COMPLETED CLEANLY (Code 0)');
  console.log('======================================================================\n');
}

verifyMission5ClubBamBam().catch(err => {
  console.error('\nMISSION 5 VERIFICATION FAILED:');
  console.error(err);
  process.exit(1);
});
