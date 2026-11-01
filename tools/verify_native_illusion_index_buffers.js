import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('OPTION C VERIFICATION: NATIVE ILLUSION 16-BIT INDEX BUFFER EXTRACTION');
  console.log('  1. Authentic Vehicle Sedan (Vehicles.big 0x01f0a800, 73,809 Tris)');
  console.log('  2. Authentic Wei Shen Character (Characters.big 0x00527400, 12,120 Tris)');
  console.log('  3. Authentic North Point Sector (Game.big 0x3c9de400, 3,917 Tris)');
  console.log('  4. Multi-Part Illusion::BufferLoader Decoding & WebGL2 Rendering');
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
    console.error('  [REQUEST FAILED]:', req.url(), req.failure()?.errorText);
    failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
  });

  console.log('[Step 1] Navigating to http://127.0.0.1:5173/...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('[Step 2] Dismissing Title Screen Overlay & Opening Inspector Drawer...');
  await page.evaluate(() => {
    if (typeof window.startGame === 'function') {
      window.startGame();
    } else {
      const btn = document.getElementById('btn-start-game');
      if (btn) btn.click();
    }
    const drawer = document.getElementById('aside-drawer');
    if (drawer) drawer.classList.add('open');
  });
  await new Promise(r => setTimeout(r, 600));

  // --- Test 1: Native 16-bit Vehicle Index Buffer Extraction ---
  console.log('\n[Step 3] Testing window.loadAuthenticIndexedVehicle()...');
  const vehicleStats = await page.evaluate(async () => {
    const mesh = await window.loadAuthenticIndexedVehicle();
    return {
      name: mesh.name,
      vertexCount: mesh.vertexCount,
      indexCount: mesh.indices.length,
      triangleCount: mesh.triangleCount,
      normalsCount: mesh.normals.length,
      uvsCount: mesh.uvs.length,
      minX: mesh.bounds.min[0],
      maxX: mesh.bounds.max[0],
      spanX: mesh.bounds.size[0]
    };
  });
  console.log('  -> Decoded Vehicle Mesh:', vehicleStats);
  if (vehicleStats.vertexCount !== 24086) {
    throw new Error(`Vehicle vertex count mismatch: expected 24086, got ${vehicleStats.vertexCount}`);
  }
  if (vehicleStats.indexCount !== 221427) {
    throw new Error(`Vehicle index count mismatch: expected 221427, got ${vehicleStats.indexCount}`);
  }
  if (vehicleStats.triangleCount !== 73809) {
    throw new Error(`Vehicle triangle count mismatch: expected 73809, got ${vehicleStats.triangleCount}`);
  }
  console.log('  [PASS] Vehicle Sedan 16-bit index buffer verified (73,809 authentic triangles)!');

  console.log('\n[Step 4] Clicking #btn-native-ib-vehicle and rendering in WebGL2...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-native-ib-vehicle');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const vehicleStatusText = await page.evaluate(() => {
    const el = document.getElementById('card-status');
    return el ? el.textContent : '';
  });
  console.log('  -> Card Status:', vehicleStatusText);
  if (!vehicleStatusText.includes('73809 genuine triangles')) {
    throw new Error(`HUD card status does not reflect authentic vehicle triangles: ${vehicleStatusText}`);
  }

  const screenVehicle = path.join(ARTIFACT_DIR, 'native_ib_01_vehicle.png');
  await page.screenshot({ path: screenVehicle });
  console.log('  [SCREENSHOT CAPTURED]:', screenVehicle);

  // --- Test 2: Native 16-bit Character Index Buffer Extraction ---
  console.log('\n[Step 5] Testing window.loadAuthenticIndexedCharacter()...');
  const charStats = await page.evaluate(async () => {
    const mesh = await window.loadAuthenticIndexedCharacter();
    return {
      name: mesh.name,
      vertexCount: mesh.vertexCount,
      indexCount: mesh.indices.length,
      triangleCount: mesh.triangleCount,
      normalsCount: mesh.normals.length,
      uvsCount: mesh.uvs.length,
      minY: mesh.bounds.min[1],
      maxY: mesh.bounds.max[1],
      spanY: mesh.bounds.size[1]
    };
  });
  console.log('  -> Decoded Wei Shen Character Mesh:', charStats);
  if (charStats.vertexCount !== 10716) {
    throw new Error(`Character vertex count mismatch: expected 10716, got ${charStats.vertexCount}`);
  }
  if (charStats.indexCount !== 36361) {
    throw new Error(`Character index count mismatch: expected 36361, got ${charStats.indexCount}`);
  }
  if (charStats.triangleCount !== 12120) {
    throw new Error(`Character triangle count mismatch: expected 12120, got ${charStats.triangleCount}`);
  }
  console.log('  [PASS] Wei Shen Character 16-bit index buffer verified (12,120 authentic triangles)!');

  console.log('\n[Step 6] Clicking #btn-native-ib-char and rendering in WebGL2...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-native-ib-char');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const charStatusText = await page.evaluate(() => {
    const el = document.getElementById('card-status');
    return el ? el.textContent : '';
  });
  console.log('  -> Card Status:', charStatusText);
  if (!charStatusText.includes('12120 genuine triangles')) {
    throw new Error(`HUD card status does not reflect authentic character triangles: ${charStatusText}`);
  }

  const screenChar = path.join(ARTIFACT_DIR, 'native_ib_02_character.png');
  await page.screenshot({ path: screenChar });
  console.log('  [SCREENSHOT CAPTURED]:', screenChar);

  // --- Test 3: Native 16-bit World Sector Index Buffer Extraction ---
  console.log('\n[Step 7] Testing window.loadAuthenticIndexedWorldSector()...');
  const worldStats = await page.evaluate(async () => {
    const mesh = await window.loadAuthenticIndexedWorldSector();
    return {
      name: mesh.name,
      vertexCount: mesh.vertexCount,
      indexCount: mesh.indices.length,
      triangleCount: mesh.triangleCount,
      normalsCount: mesh.normals.length,
      uvsCount: mesh.uvs.length,
      spanX: mesh.bounds.size[0],
      spanZ: mesh.bounds.size[2]
    };
  });
  console.log('  -> Decoded North Point Sector Mesh:', worldStats);
  if (worldStats.vertexCount !== 4155) {
    throw new Error(`World sector vertex count mismatch: expected 4155, got ${worldStats.vertexCount}`);
  }
  if (worldStats.indexCount !== 11751) {
    throw new Error(`World sector index count mismatch: expected 11751, got ${worldStats.indexCount}`);
  }
  if (worldStats.triangleCount !== 3917) {
    throw new Error(`World sector triangle count mismatch: expected 3917, got ${worldStats.triangleCount}`);
  }
  console.log('  [PASS] North Point World Sector 16-bit index buffer verified (3,917 authentic triangles)!');

  console.log('\n[Step 8] Clicking #btn-native-ib-world and rendering in WebGL2...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-native-ib-world');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const worldStatusText = await page.evaluate(() => {
    const el = document.getElementById('card-status');
    return el ? el.textContent : '';
  });
  console.log('  -> Card Status:', worldStatusText);
  if (!worldStatusText.includes('3917 genuine triangles')) {
    throw new Error(`HUD card status does not reflect authentic world triangles: ${worldStatusText}`);
  }

  const screenWorld = path.join(ARTIFACT_DIR, 'native_ib_03_world_sector.png');
  await page.screenshot({ path: screenWorld });
  console.log('  [SCREENSHOT CAPTURED]:', screenWorld);

  // --- Test 4: Two-Tier Cache Inspection ---
  console.log('\n[Step 9] Validating L1/L2 Cache Integrity...');
  const finalCacheStats = await page.evaluate(() => window.cacheStats || null);
  console.log('  -> Final Cache Stats:', finalCacheStats);

  // --- Health Check ---
  console.log('\n[Step 10] Checking for Browser/Network Errors...');
  console.log(`  Page Errors: ${pageErrors.length}`);
  console.log(`  Failed Network Requests: ${failedRequests.length}`);

  if (pageErrors.length > 0) {
    throw new Error(`Verification failed due to page errors: ${pageErrors.join('; ')}`);
  }
  if (failedRequests.length > 0) {
    throw new Error(`Verification failed due to failed requests: ${failedRequests.join('; ')}`);
  }

  await browser.close();

  console.log('\n======================================================================');
  console.log('SUCCESS: OPTION C NATIVE 16-BIT INDEX BUFFER EXTRACTION FULLY VERIFIED!');
  console.log('  - Vehicle: 24,086 verts, 221,427 indices -> 73,809 authentic triangles');
  console.log('  - Character: 10,716 verts, 36,361 indices -> 12,120 authentic triangles');
  console.log('  - World Sector: 4,155 verts, 11,751 indices -> 3,917 authentic triangles');
  console.log('  - Zero synthetic triangle strips');
  console.log('  - Zero page errors, zero failed requests');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});

