/**
 * verify_chapter2_full.js
 * Automated browser verification script for the complete Chapter 2:
 *  - Mission 11: "The Wedding" (Winston & Peggy Banquet Toast, 18K Massacre & Winston Dying Scene)
 *  - Mission 12: "Mrs. Chu's Revenge" (Golden Koi Kitchen Mandate & Johnny Ratface Interrogation)
 *  - Mission 13: "Meet the New Boss" (Central District Council: Broken Nose Jiang & Two-Chin Tsao)
 *  - Mission 14: "The Election / Final Kill" (Aberdeen Docks Yacht Boss Fight & Dogeyes Vanquished)
 *
 * Strictly asserts 0 page errors, 0 failed network requests, and generates visual proof artifacts.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('VERIFYING COMPLETE CHAPTER 2: CENTRAL DISTRICT & DRAGON HEAD POLITICS');
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
  // MISSION 11: THE WEDDING
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 11: THE WEDDING ---');
  console.log('[Step 3] Launching Mission 11: Winston Chu & Peggy Li Banquet Toast...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission11TheWedding(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '01_mission11_wedding_banquet_toast.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 01_mission11_wedding_banquet_toast.png');

  console.log('[Step 4] Triggering 18K banquet ambush and defending wedding hall...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.triggerWeddingAmbush(cam, audio, renderer.sceneGraph, crowd);
  });
  await new Promise(r => setTimeout(r, 1200));

  console.log('[Step 5] Triggering Winston Chu tragic death scene...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.triggerWinstonDeathScene(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '02_mission11_winston_chu_dying_words.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 02_mission11_winston_chu_dying_words.png');

  // -------------------------------------------------------------
  // MISSION 12: MRS. CHU'S REVENGE
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 12: MRS. CHU\'S REVENGE ---');
  console.log('[Step 6] Mrs. Chu kitchen mandate & tracking Johnny Ratface...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission12MrsChusRevenge(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Step 7] Cornering Johnny Ratface in tenement alley and extracting confession...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.cornerJohnnyRatface(cam, audio, renderer.sceneGraph, crowd);
    story.interrogateRatface(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_mission12_mrs_chu_ratface_interrogation.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 03_mission12_mrs_chu_ratface_interrogation.png');

  // -------------------------------------------------------------
  // MISSION 13: MEET THE NEW BOSS
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 13: MEET THE NEW BOSS ---');
  console.log('[Step 8] Central District Council Meeting: Broken Nose Jiang & Two-Chin Tsao...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission13MeetTheNewBoss(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '04_mission13_central_council_meeting.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 04_mission13_central_council_meeting.png');

  console.log('[Step 9] Concluding Central council meeting & securing leadership...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.concludeCentralMeeting(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1200));

  // -------------------------------------------------------------
  // MISSION 14: THE ELECTION / FINAL KILL (CHAPTER 2 CLIMAX)
  // -------------------------------------------------------------
  console.log('\n--- VERIFYING MISSION 14: THE ELECTION / FINAL KILL ---');
  console.log('[Step 10] Sports car pursuit & Dogeyes Aberdeen yacht showdown...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const renderer = window.renderer;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.startMission14TheElection(renderer.sceneGraph, crowd, cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Step 11] Vanquishing Dogeyes & extracting confession...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.completeDogeyesYachtShowdown(cam, audio);
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '05_mission14_dogeyes_yacht_showdown_victory.png'),
    fullPage: false
  });
  console.log('  Saved artifact: 05_mission14_dogeyes_yacht_showdown_victory.png');

  console.log('[Step 12] Elevating Wei Shen to Water Street Red Pole Boss & Concluding Chapter 2...');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    story.completeChapter2(cam, audio);
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

  console.log('\n[Step 13] Asserting 0 page errors and 0 network failures...');
  console.log('  Page Errors Count:    ', pageErrors.length);
  console.log('  Failed Requests Count:', failedRequests.length);

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Encountered page errors during Chapter 2 full run.');
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Encountered failed requests during Chapter 2 full run.');
    process.exit(1);
  }

  if (finalState.stage !== 'ch2_chapter2_completed') {
    console.error(`FAILED: Expected final stage 'ch2_chapter2_completed', got '${finalState.stage}'`);
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('CHAPTER 2 (ALL 4 MISSIONS: 11, 12, 13 & 14) VERIFIED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});

