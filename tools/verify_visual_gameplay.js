import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('CAPTURING GAMEPLAY VISUAL FIDELITY ARTIFACTS');
  console.log('======================================================================\n');

  const pageErrors = [];
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

  console.log('[Step 1] Navigating to http://127.0.0.1:5173/...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('[Step 2] Dismissing Title Screen Overlay & Entering Game-First Mode...');
  await page.evaluate(() => {
    const overlay = document.getElementById('start-overlay');
    if (overlay) overlay.style.display = 'none';
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) btnAudio.click();
    if (typeof window.startGame === 'function') {
      window.startGame();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('[Step 3] Capturing Screenshot: Clean Game-First Street Presentation...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'visual_01_game_first_street.png') });
  console.log('  Saved artifact: visual_01_game_first_street.png');

  console.log('[Step 4] Wei Shen Walking Forward (WASD movement)...');
  await page.evaluate(() => {
    const char = window.characterController;
    if (char) {
      char.velocity = [0, 0, -2.5];
      char.rotationY = Math.PI;
    }
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'visual_02_wei_shen_locomotion.png') });
  console.log('  Saved artifact: visual_02_wei_shen_locomotion.png');

  console.log('[Step 5] Wei Shen Combat Strike against 18K Ambush...');
  await page.evaluate(() => {
    const char = window.characterController;
    if (char) {
      char.triggerAttack();
    }
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'visual_03_combat_brawl_action.png') });
  console.log('  Saved artifact: visual_03_combat_brawl_action.png');

  console.log('[Step 6] Toggling Developer HUD Overlay with [~] hotkey for comparison...');
  await page.keyboard.press('Backquote');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'visual_04_dev_hud_inspection_toggle.png') });
  console.log('  Saved artifact: visual_04_dev_hud_inspection_toggle.png');

  await browser.close();
  console.log(`\nFinished visual capture suite with ${pageErrors.length} page errors.`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
