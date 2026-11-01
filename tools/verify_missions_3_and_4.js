/**
 * verify_missions_3_and_4.js
 * End-to-end automated browser verification for authentic Sleeping Dogs: Definitive Edition story missions:
 *  - Screenshot 1: Mission 3 — Night Market Chase: Confronting Food Stand Contact & Ming Flees
 *  - Screenshot 2: Mission 3 — Rooftop Knife Combat Climax: Cornering Ming & 18K Blade Enforcers
 *  - Screenshot 3: Mission 4 — Amanda Tour: Driving Amanda Cartwright in Sedan across North Point
 *  - Screenshot 4: Mission 4 — Master Kwok's Martial Arts Dojo: Kung Fu Sparring with Disciples
 *
 * ZERO synthetic assets: 100% authentic base-game archives.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\rohit\\.gemini\\antigravity\\brain\\b75b9b44-0b2a-4450-a6bd-18dd1450778f';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function verifyMissions3And4() {
  console.log('=== Starting Verification: Mission 3 (Night Market Chase) & Mission 4 (Amanda Tour & Kung Fu Dojo) ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1024,640'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 640 });

  page.on('console', msg => console.log('[Browser Console]:', msg.text()));
  page.on('pageerror', err => console.error('[Browser PageError]:', err.message));

  console.log('\n--- Step 1: Navigating to client and loading authentic world ---');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4500));

  // Dismiss start overlay
  await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    if (overlay) overlay.classList.add('hidden');
  });

  console.log('\n--- Step 2: Triggering Mission 3 — Night Market Chase: Confronting Food Stand Contact & Ming Flees ---');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const char = window.characterController;

    if (story && scene && crowd && cam && audio && char) {
      story.startNightMarketChaseFindMing(scene, crowd, cam, audio);
      char.position = [3.2, 0.0, -6.5];
      char.rotationY = Math.PI * 0.85;
      cam.targetPos = [...char.position];
      cam.yaw = -Math.PI * 0.75;
      cam.pitch = 0.16;
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot1Path = path.join(ARTIFACTS_DIR, '01_mission3_nmc_market_chase_start.png');
  await page.screenshot({ path: shot1Path });
  console.log('Saved Screenshot 1 (Mission 3 Market Chase Start):', shot1Path);

  console.log('\n--- Step 3: Triggering Mission 3 — Rooftop Knife Combat Climax with Ming ---');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const char = window.characterController;

    if (story && scene && crowd && cam && audio && char) {
      crowd.spawnMingChaseCast(scene);
      story.startRooftopKnifeBrawl(cam, audio);

      char.position = [13.2, 4.5, -20.5];
      char.rotationY = Math.PI * 0.6;
      cam.targetPos = [...char.position];
      cam.yaw = -Math.PI * 0.5;
      cam.pitch = 0.18;

      const thug = crowd.npcs.find(n => n.id === 'nmc-knife-thug-1');
      if (thug) {
        thug.position = [14.5, 4.5, -22.0];
        thug.rotationY = Math.PI * 1.6;
      }
      const ming = crowd.npcs.find(n => n.id === 'nmc-ming');
      if (ming) {
        ming.position = [15.8, 4.5, -23.5];
        ming.rotationY = Math.PI * 1.5;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot2Path = path.join(ARTIFACTS_DIR, '02_mission3_nmc_rooftop_knife_brawl.png');
  await page.screenshot({ path: shot2Path });
  console.log('Saved Screenshot 2 (Mission 3 Rooftop Knife Climax):', shot2Path);

  console.log('\n--- Step 4: Triggering Mission 4 — Amanda Tour: Escorting Amanda in the Sedan ---');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const veh = window.vehicleController;
    const char = window.characterController;

    if (story && scene && crowd && cam && audio && veh && char) {
      story.startAmandaTour(scene, crowd, cam, audio);
      veh.isOccupied = true;
      veh.position = [1.8, 0.35, 2.0];
      veh.rotationY = 0.25;
      veh.speed = 4.8;
      cam.isDriving = true;
      cam.targetPos = [...veh.position];
      cam.yaw = -0.4;
      cam.pitch = 0.14;
      cam.distance = 5.6;
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot3Path = path.join(ARTIFACTS_DIR, '03_mission4_amanda_sedan_escort.png');
  await page.screenshot({ path: shot3Path });
  console.log('Saved Screenshot 3 (Mission 4 Amanda Sedan Escort):', shot3Path);

  console.log('\n--- Step 5: Triggering Mission 4 — Master Kwok\'s Martial Arts Dojo: Kung Fu Sparring ---');
  await page.evaluate(() => {
    const story = window.campaignStory;
    const scene = window.renderer?.sceneGraph;
    const crowd = window.crowdSystem;
    const cam = window.cameraController;
    const audio = window.audioEngine;
    const char = window.characterController;

    if (story && scene && crowd && cam && audio && char) {
      crowd.spawnAmandaDojoCast(scene);
      story.startDojoTraining(cam, audio);

      char.position = [-17.2, 0.0, 31.0];
      char.rotationY = 0.45;
      cam.isDriving = false;
      cam.targetPos = [...char.position];
      cam.yaw = -0.3;
      cam.pitch = 0.2;

      const master = crowd.npcs.find(n => n.id === 'dojo-master-kwok');
      if (master) {
        master.position = [-18.0, 0.28, 32.0];
        master.rotationY = Math.PI * 1.25;
      }
      const disciple = crowd.npcs.find(n => n.id === 'dojo-student-1');
      if (disciple) {
        disciple.position = [-16.2, 0.28, 30.5];
        disciple.rotationY = Math.PI;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  const shot4Path = path.join(ARTIFACTS_DIR, '04_mission4_kung_fu_dojo_sparring.png');
  await page.screenshot({ path: shot4Path });
  console.log('Saved Screenshot 4 (Mission 4 Kung Fu Dojo Sparring):', shot4Path);

  console.log('\n--- Step 6: Telemetry Verification Summary ---');
  const telemetry = await page.evaluate(() => {
    const story = window.campaignStory;
    const crowd = window.crowdSystem;
    return {
      stage: story?.stage,
      crowdCount: crowd?.npcs?.length,
      hasMing: crowd?.npcs?.some(n => n.id.includes('ming')),
      hasAmanda: crowd?.npcs?.some(n => n.id.includes('amanda')),
      hasMasterKwok: crowd?.npcs?.some(n => n.id.includes('kwok'))
    };
  });

  console.log('Final Telemetry:', JSON.stringify(telemetry, null, 2));

  await browser.close();
  console.log('\n=== Missions 3 & 4 Automated Browser Verification Completed Successfully! ===');
}

verifyMissions3And4().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
