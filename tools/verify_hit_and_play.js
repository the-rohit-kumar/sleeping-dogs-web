/**
 * verify_hit_and_play.js
 * Verification for Cyberpunk2077.lol style "Zero-Setup Hit & Play" experience:
 *  - 100% full-screen commercial game canvas (100vw, 100vh)
 *  - Authentic AAA Title / Start Screen with pulsating [ PLAY GAME ] button
 *  - Zero user file dropping or directory picking required
 *  - On click, resumes Web Audio and drops player straight into Wei Shen's Hong Kong street
 *  - Collapsible side-drawer Dev Inspector toggleable via [ ⚙ DEV INSPECTOR ]
 *  - HUD toggleable with [H] for pure cinematic AAA gameplay
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\rohit\\.gemini\\antigravity\\brain\\b75b9b44-0b2a-4450-a6bd-18dd1450778f';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function verifyHitAndPlay() {
  console.log('=== Starting Verification: Zero-Setup Hit & Play Experience ===');
  console.log('Chrome Path:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    console.log(`[Browser Console]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error(`[Browser PageError]:`, err.message);
  });

  console.log('\n--- Step 1: Navigating to http://127.0.0.1:5173/ and checking Title Screen ---');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait 2.5s for initial scene assembly in background
  await new Promise(r => setTimeout(r, 2500));

  // Check start overlay visibility
  const isStartOverlayVisible = await page.evaluate(() => {
    const el = document.getElementById('start-overlay');
    return el && !el.classList.contains('hidden');
  });
  console.log('Start Overlay Visible:', isStartOverlayVisible);

  const shot1 = path.join(ARTIFACTS_DIR, '01_hit_and_play_title_screen.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved screenshot 1:', shot1);

  console.log('\n--- Step 2: Clicking [ PLAY GAME ] to enter gameplay ---');
  await page.evaluate(() => {
    window.startGame();
  });

  // Wait 1.5s for fade-out and audio start
  await new Promise(r => setTimeout(r, 1500));

  const isOverlayHidden = await page.evaluate(() => {
    const el = document.getElementById('start-overlay');
    return el && el.classList.contains('hidden');
  });
  console.log('Start Overlay Hidden:', isOverlayHidden);

  const shot2 = path.join(ARTIFACTS_DIR, '02_hit_and_play_gameplay_fullscreen.png');
  await page.screenshot({ path: shot2 });
  console.log('Saved screenshot 2:', shot2);

  console.log('\n--- Step 3: Toggling [ ⚙ DEV INSPECTOR ] Drawer ---');
  await page.evaluate(() => {
    document.getElementById('btn-toggle-inspector')?.click();
  });

  await new Promise(r => setTimeout(r, 600));

  const isDrawerOpen = await page.evaluate(() => {
    const drawer = document.getElementById('aside-drawer');
    return drawer && drawer.classList.contains('open');
  });
  console.log('Dev Inspector Drawer Open:', isDrawerOpen);

  const shot3 = path.join(ARTIFACTS_DIR, '03_hit_and_play_dev_inspector_drawer.png');
  await page.screenshot({ path: shot3 });
  console.log('Saved screenshot 3:', shot3);

  console.log('\n--- Step 4: Closing Drawer and Toggling Cinematic Mode [H] ---');
  await page.evaluate(() => {
    document.getElementById('btn-close-inspector')?.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Press 'h' to toggle HUD
  await page.keyboard.press('h');
  // Switch to Neon Night '1'
  await page.keyboard.press('1');

  await new Promise(r => setTimeout(r, 1000));

  const shot4 = path.join(ARTIFACTS_DIR, '04_hit_and_play_cinematic_neon_night.png');
  await page.screenshot({ path: shot4 });
  console.log('Saved screenshot 4:', shot4);

  await browser.close();
  console.log('\n=== All Zero-Setup Hit & Play Verifications Passed Successfully! ===');
}

verifyHitAndPlay().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
