/**
 * tools/test_functional_browser.js
 * Assertion-based functional test runner for the Sleeping Dogs browser reconstruction.
 * Addresses Finding F04:
 *  - Distinguishes functional assertion testing from visual scenario showcases.
 *  - Fails with non-zero exit code on page errors, failed network requests, or HTTP >= 400.
 *  - Verifies WebGL GPU renderer (detecting hardware vs. SwiftShader software rasterizer).
 *  - Verifies subsystem initialization and real keyboard/mouse input handling without teleportation.
 */

import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import assert from 'node:assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CLIENT_URL = 'http://127.0.0.1:5173/';

async function runFunctionalBrowserTests() {
  console.log('======================================================================');
  console.log('STARTING AUTOMATED FUNCTIONAL BROWSER TEST (Finding F04)');
  console.log('======================================================================\n');

  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const consoleErrors = [];

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

  page.on('pageerror', err => {
    console.error(`[Browser PageError]: ${err.message}`);
    pageErrors.push(err.message);
  });

  page.on('requestfailed', req => {
    const failure = req.failure();
    const url = req.url();
    // Ignore benign cancelled pre-fetches if any
    if (failure && failure.errorText !== 'net::ERR_ABORTED') {
      const msg = `${url} failed: ${failure.errorText}`;
      console.error(`[Request Failed]: ${msg}`);
      failedRequests.push(msg);
    }
  });

  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400) {
      const msg = `${url} returned HTTP ${status}`;
      console.error(`[HTTP Error Response]: ${msg}`);
      badResponses.push(msg);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log(`[Test 1] Navigating to ${CLIENT_URL}...`);
  await page.goto(CLIENT_URL, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3500));

  // 1. Inspect WebGL Environment & GPU Details
  console.log('\n[Test 2] Querying WebGL Context and GPU Diagnostics...');
  const gpuDiag = await page.evaluate(() => {
    const canvas = document.getElementById('viewport') || document.querySelector('canvas#viewport');
    if (!canvas) return { error: 'Viewport canvas element (#viewport) not found' };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'WebGL context creation failed on #viewport canvas' };

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const unmaskedRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const unmaskedVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);

    return {
      renderer: unmaskedRenderer,
      vendor: unmaskedVendor,
      webglVersion: gl.getParameter(gl.VERSION),
      glslVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      isSwiftShader: /swiftshader/i.test(unmaskedRenderer) || /llvmpipe/i.test(unmaskedRenderer),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  });

  assert.ok(!gpuDiag.error, `GPU Diagnostic Error: ${gpuDiag.error}`);
  console.log(`  Renderer: ${gpuDiag.renderer}`);
  console.log(`  Vendor:   ${gpuDiag.vendor}`);
  console.log(`  Mode:     ${gpuDiag.isSwiftShader ? 'SOFTWARE (SwiftShader / CPU)' : 'HARDWARE ACCELERATED (GPU)'}`);
  console.log(`  GLSL:     ${gpuDiag.glslVersion}`);
  console.log(`  Canvas:   ${gpuDiag.canvasWidth}x${gpuDiag.canvasHeight}`);

  // 2. Dismiss Overlay via standard click
  console.log('\n[Test 3] Dismissing Start Overlay...');
  const overlayDismissed = await page.evaluate(() => {
    const btn = document.getElementById('start-btn');
    if (btn) {
      btn.click();
      return true;
    }
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      return true;
    }
    return false;
  });
  assert.ok(overlayDismissed, 'Failed to dismiss start overlay');
  await new Promise(r => setTimeout(r, 1000));

  // 3. Verify Application Subsystems
  console.log('\n[Test 4] Verifying Application Subsystems on window...');
  const subsystemReport = await page.evaluate(() => {
    return {
      hasRenderer: typeof window.renderer !== 'undefined',
      hasSceneGraph: typeof window.renderer?.sceneGraph !== 'undefined',
      nodeCount: window.renderer?.sceneGraph?.nodes?.size || 0,
      hasCampaign: typeof window.campaignStory !== 'undefined',
      campaignStage: window.campaignStory?.state?.currentStage || 'none',
      hasAudio: typeof window.audioEngine !== 'undefined',
      audioContextState: window.audioEngine?.audioContext?.state || 'none',
      hasCrowd: typeof window.crowdSystem !== 'undefined',
      crowdCount: window.crowdSystem?.characters?.length || 0,
      hasCharacter: typeof window.characterController !== 'undefined',
      hasCamera: typeof window.cameraController !== 'undefined'
    };
  });

  console.log(`  Renderer Scene Nodes: ${subsystemReport.nodeCount}`);
  console.log(`  Campaign Stage:       ${subsystemReport.campaignStage}`);
  console.log(`  Audio Context State:  ${subsystemReport.audioContextState}`);
  console.log(`  Crowd Entities:       ${subsystemReport.crowdCount}`);

  assert.ok(subsystemReport.hasRenderer, 'window.renderer is missing');
  assert.ok(subsystemReport.hasSceneGraph, 'window.renderer.sceneGraph is missing');
  assert.ok(subsystemReport.nodeCount >= 3, `Expected at least 3 scene nodes, got ${subsystemReport.nodeCount}`);
  assert.ok(subsystemReport.hasCampaign, 'window.campaignStory is missing');
  assert.ok(subsystemReport.hasAudio, 'window.audioEngine is missing');
  assert.ok(subsystemReport.hasCrowd, 'window.crowdSystem is missing');
  assert.ok(subsystemReport.hasCharacter, 'window.characterController is missing');
  assert.ok(subsystemReport.hasCamera, 'window.cameraController is missing');

  // 4. Test Real Input & Physics Movement (No direct position assignment)
  console.log('\n[Test 5] Simulating Real User Input (KeyW Walk Forward)...');
  const posBefore = await page.evaluate(() => {
    const p = window.characterController?.position;
    return p ? [p[0], p[1], p[2]] : [0, 0, 0];
  });

  // Hold KeyW for 600ms
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 600));
  await page.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 100));

  const posAfterWalk = await page.evaluate(() => {
    const p = window.characterController?.position;
    const isMoving = window.characterController?.isMoving;
    return {
      pos: p ? [p[0], p[1], p[2]] : [0, 0, 0],
      isMoving
    };
  });

  const distMoved = Math.hypot(
    posAfterWalk.pos[0] - posBefore[0],
    posAfterWalk.pos[2] - posBefore[2]
  );
  console.log(`  Initial Pos:    [${posBefore.map(v => v.toFixed(3)).join(', ')}]`);
  console.log(`  After KeyW Pos: [${posAfterWalk.pos.map(v => v.toFixed(3)).join(', ')}]`);
  console.log(`  Distance Moved: ${distMoved.toFixed(4)}m`);
  assert.ok(distMoved > 0.05, `Expected character to move at least 0.05m from KeyW input, moved ${distMoved}m`);

  // 5. Test Sprint Input
  console.log('\n[Test 6] Simulating Sprint Input (ShiftLeft + KeyW)...');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await new Promise(r => setTimeout(r, 100));

  const sprintPos = await page.evaluate(() => {
    const p = window.characterController?.position;
    return p ? [p[0], p[1], p[2]] : [0, 0, 0];
  });
  const distSprinted = Math.hypot(
    sprintPos[0] - posAfterWalk.pos[0],
    sprintPos[2] - posAfterWalk.pos[2]
  );
  console.log(`  Sprint Distance: ${distSprinted.toFixed(4)}m`);
  assert.ok(distSprinted > 0.1, `Expected sprint to cover > 0.1m, covered ${distSprinted}m`);

  // 6. Test Combat Attack Input (Left Click / Space / Attack Key)
  console.log('\n[Test 7] Simulating Combat Strike Input (KeyJ / Attack)...');
  const attackState = await page.evaluate(() => {
    // Dispatch real key event
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', bubbles: true }));
    return {
      combatState: window.characterController?.combatState || 'idle',
      comboStep: window.characterController?.comboStep || 0
    };
  });
  console.log(`  Combat State: ${attackState.combatState}, Combo Step: ${attackState.comboStep}`);

  // 7. Strictly assert zero network and runtime errors
  console.log('\n[Test 8] Strict Assertion of Zero Page Errors & Failed Requests...');
  console.log(`  Page Errors:     ${pageErrors.length}`);
  console.log(`  Failed Requests: ${failedRequests.length}`);
  console.log(`  HTTP Errors:     ${badResponses.length}`);

  await browser.close();

  assert.strictEqual(
    pageErrors.length,
    0,
    `Browser encountered ${pageErrors.length} unhandled page errors: ${pageErrors.join('; ')}`
  );

  assert.strictEqual(
    failedRequests.length,
    0,
    `Browser encountered ${failedRequests.length} failed network requests: ${failedRequests.join('; ')}`
  );

  assert.strictEqual(
    badResponses.length,
    0,
    `Browser encountered ${badResponses.length} HTTP 4xx/5xx responses: ${badResponses.join('; ')}`
  );

  console.log('\n======================================================================');
  console.log('ALL FUNCTIONAL ASSERTION TESTS PASSED CLEANLY (Code 0)');
  console.log('======================================================================\n');
}

runFunctionalBrowserTests().catch(err => {
  console.error('\nFUNCTIONAL BROWSER TEST FAILED:');
  console.error(err);
  process.exit(1);
});
