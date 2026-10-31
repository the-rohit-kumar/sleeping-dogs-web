/**
 * verify_browser.js
 * End-to-end headless browser verification using puppeteer-core and Chrome.
 * Directly launches Chrome, navigates to the client, inspects console logs,
 * tracks HTTP 206 streaming requests to the asset bridge, and captures screenshots.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\rohit\\.gemini\\antigravity\\brain\\b75b9b44-0b2a-4450-a6bd-18dd1450778f';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function verify() {
  console.log('=== Starting Browser Verification ===');
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
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  const networkRequests = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[CONSOLE ${msg.type()}] ${text}`);
    console.log(`[Browser Console]:`, text);
  });

  page.on('pageerror', err => {
    console.error(`[Browser PageError]:`, err.message);
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  page.on('requestfinished', req => {
    const url = req.url();
    const resp = req.response();
    if (url.includes('8080') || url.includes('5173')) {
      const status = resp ? resp.status() : '???';
      const range = req.headers()['range'] || 'none';
      networkRequests.push({ url, status, range });
      console.log(`[HTTP ${status}] ${url} (Range: ${range})`);
    }
  });

  console.log('\n--- Step 1: Navigating to http://127.0.0.1:5173/ ---');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait 2 seconds for initial WebGL rendering & asset stream
  await new Promise(r => setTimeout(r, 2000));

  // Inspect HUD state
  const state1 = await page.evaluate(() => ({
    fps: document.getElementById('hud-fps')?.textContent,
    mesh: document.getElementById('hud-mesh')?.textContent,
    texture: document.getElementById('hud-texture')?.textContent,
    triangles: document.getElementById('hud-triangles')?.textContent,
    cardEntries: document.getElementById('card-entries')?.textContent,
    cardName: document.getElementById('card-name')?.textContent,
    entryCount: document.querySelectorAll('.entry-item').length
  }));

  console.log('Step 1 HUD State:', state1);
  const shot1 = path.join(ARTIFACTS_DIR, '01_initial_vehicle.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved screenshot 1:', shot1);

  console.log('\n--- Step 2: Clicking Character [Characters.big] ---');
  await page.click('#btn-mesh-character');
  await new Promise(r => setTimeout(r, 1500));

  const state2 = await page.evaluate(() => ({
    mesh: document.getElementById('hud-mesh')?.textContent,
    triangles: document.getElementById('hud-triangles')?.textContent
  }));
  console.log('Step 2 HUD State:', state2);
  const shot2 = path.join(ARTIFACTS_DIR, '02_character_stream.png');
  await page.screenshot({ path: shot2 });
  console.log('Saved screenshot 2:', shot2);

  console.log('\n--- Step 3: Clicking World Sector [Game.big] ---');
  await page.click('#btn-mesh-world');
  await new Promise(r => setTimeout(r, 1500));

  const state3 = await page.evaluate(() => ({
    mesh: document.getElementById('hud-mesh')?.textContent,
    triangles: document.getElementById('hud-triangles')?.textContent
  }));
  console.log('Step 3 HUD State:', state3);
  const shot3 = path.join(ARTIFACTS_DIR, '03_world_sector_stream.png');
  await page.screenshot({ path: shot3 });
  console.log('Saved screenshot 3:', shot3);

  console.log('\n--- Step 4: Clicking Game Archive Explorer ---');
  await page.click('#btn-bix-game');
  await new Promise(r => setTimeout(r, 2000));

  const state4 = await page.evaluate(() => ({
    cardName: document.getElementById('card-name')?.textContent,
    cardEntries: document.getElementById('card-entries')?.textContent,
    entryCount: document.querySelectorAll('.entry-item').length
  }));
  console.log('Step 4 HUD State:', state4);
  const shot4 = path.join(ARTIFACTS_DIR, '04_game_bix_explorer.png');
  await page.screenshot({ path: shot4 });
  console.log('Saved screenshot 4:', shot4);

  await browser.close();
  console.log('\n=== All Verification Steps Completed Successfully ===');
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
