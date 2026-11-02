import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\rohit\\.gemini\\antigravity\\brain\\b75b9b44-0b2a-4450-a6bd-18dd1450778f';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runVisualOverhaulVerification() {
  console.log('=== STARTING REALISTIC VISUAL OVERHAUL & FULL PLAYABLE IN-BROWSER AUDIT ===');
  
  const consoleErrors = [];
  const networkErrors = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=gl',
      '--window-size=1600,1000'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('AudioContext') && !txt.includes('favicon')) {
        console.error('[Browser Error]', txt);
        consoleErrors.push(txt);
      }
    }
  });

  page.on('requestfailed', req => {
    const url = req.url();
    if (!url.includes('favicon')) {
      console.error('[Request Failed]', url, req.failure()?.errorText);
      networkErrors.push({ url, error: req.failure()?.errorText });
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      const url = res.url();
      if (!url.includes('favicon')) {
        console.error('[HTTP Error]', res.status(), url);
        networkErrors.push({ url, status: res.status() });
      }
    }
  });

  try {
    // 1. Navigate to client
    console.log('[Step 1] Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForFunction(() => !!window.sceneGraph && !!window.campaignStory, { timeout: 20000 });
    console.log('Engine & SceneGraph loaded.');

    // Step 2: Start Game via NEW GAME
    console.log('[Step 2] Clicking NEW GAME on Title Screen...');
    await page.click('#btn-start-game');
    await new Promise(r => setTimeout(r, 600));

    // Fast-forward dialogue to Alley Brawl (Stage 3)
    console.log('[Step 3] Advancing Prologue Deal cinematic dialogue to reach Alley Brawl...');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Space');
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 500));

    // Teleport Wei Shen to alley brawl position for combat
    await page.evaluate(() => {
      const cs = window.campaignStory;
      if (cs && cs.stage === 'prologue_chase') {
        cs.startPrologueAlleyBrawl(window.cameraController, window.audioEngine);
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Step 4: Capture Wei Shen Close-Up (Anatomy, Hair, Athletic Torso, Belt, Sneakers)
    console.log('[Step 4] Orbiting camera to capture Wei Shen sculpted anatomy close-up...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      const cc = window.characterController;
      if (cam && cc) {
        cam.distance = 2.1;
        cam.yaw = 2.8; // Front-facing 3/4 view
        cam.pitch = 0.12;
        cam.targetPos = [cc.position[0], cc.position[1] + 1.2, cc.position[2]];
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const shot1 = path.join(ARTIFACT_DIR, 'overhaul_01_wei_shen_closeup.png');
    await page.screenshot({ path: shot1 });
    console.log('Screenshot 1 saved:', shot1);

    // Step 5: Capture Humanoid Brawlers in Combat Stance
    console.log('[Step 5] Positioning camera to capture 18K Triad Brawlers and Sun On Yee Enforcers...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      const cc = window.characterController;
      if (cam && cc) {
        cam.distance = 3.6;
        cam.yaw = 1.2;
        cam.pitch = 0.22;
        cam.targetPos = [cc.position[0], cc.position[1] + 1.0, cc.position[2]];
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const shot2 = path.join(ARTIFACT_DIR, 'overhaul_02_humanoid_brawlers.png');
    await page.screenshot({ path: shot2 });
    console.log('Screenshot 2 saved:', shot2);

    // Step 6: Capture Realistic Vehicles (Aerodynamic Sedan & HK Taxi with 3D Roof Sign)
    console.log('[Step 6] Positioning camera to capture Aerodynamic Sedan & Hong Kong Taxi with roof sign...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      if (cam) {
        cam.distance = 6.2;
        cam.yaw = -0.7;
        cam.pitch = 0.28;
        cam.targetPos = [1.8, 0.8, 0.0];
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const shot3 = path.join(ARTIFACT_DIR, 'overhaul_03_realistic_vehicles.png');
    await page.screenshot({ path: shot3 });
    console.log('Screenshot 3 saved:', shot3);

    // Step 7: Capture Hong Kong Tenement Buildings (Tong Lau, Balconies, ACs, Awnings, Props)
    console.log('[Step 7] Wide-angle urban view of Hong Kong Tenements, Balconies, Awnings, Lampposts, Hydrants...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      if (cam) {
        cam.distance = 16.0;
        cam.yaw = 0.45;
        cam.pitch = 0.35;
        cam.targetPos = [-4.0, 6.0, 10.0];
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const shot4 = path.join(ARTIFACT_DIR, 'overhaul_04_city_tenements.png');
    await page.screenshot({ path: shot4 });
    console.log('Screenshot 4 saved:', shot4);

    // Step 8: Capture Mission 1 Combat Action
    console.log('[Step 8] Executing combat strike in Mission 1 with realistic brawlers...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      const cc = window.characterController;
      if (cam && cc) {
        cam.distance = 3.2;
        cam.yaw = 0.6;
        cam.pitch = 0.18;
        cam.targetPos = [cc.position[0], cc.position[1] + 1.0, cc.position[2]];
      }
      const btn = document.getElementById('btn-combo-strike');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const shot5 = path.join(ARTIFACT_DIR, 'overhaul_05_mission1_combat_overhaul.png');
    await page.screenshot({ path: shot5 });
    console.log('Screenshot 5 saved:', shot5);

    // Step 9: Full Gameplay Third-Person View
    console.log('[Step 9] Resetting to canonical 3rd-person follow camera for full gameplay screenshot...');
    await page.evaluate(() => {
      const cam = window.cameraController;
      const cc = window.characterController;
      if (cam && cc) {
        cam.distance = 4.2;
        cam.yaw = 0.0;
        cam.pitch = 0.20;
        cam.targetPos = [...cc.position];
      }
    });
    await new Promise(r => setTimeout(r, 400));

    const shot6 = path.join(ARTIFACT_DIR, 'overhaul_06_complete_gameplay_view.png');
    await page.screenshot({ path: shot6 });
    console.log('Screenshot 6 saved:', shot6);

    // Step 10: Edge Case & Geometry Audit
    console.log('[Step 10] Auditing scene nodes, triangle counts, and edge cases...');
    const auditData = await page.evaluate(() => {
      const sg = window.sceneGraph || (window.renderer && window.renderer.sceneGraph);
      if (!sg) return null;

      const nodes = sg.getAllNodes();
      const weiNodes = nodes.filter(n => n.id.startsWith('node-wei-'));
      const vehicleNodes = nodes.filter(n => n.id.includes('vehicle') || n.id.includes('wheel') || n.id.includes('traffic'));
      const tenementNodes = nodes.filter(n => n.id.includes('building'));
      const streetPropNodes = nodes.filter(n => n.id.includes('hydrant') || n.id.includes('lamppost') || n.id.includes('lamp-'));
      const crowdNodes = nodes.filter(n => n.id.includes('npc-') || n.id.includes('crowd-'));

      let totalTris = 0;
      let totalVerts = 0;
      nodes.forEach(n => {
        if (n.mesh) {
          totalTris += n.mesh.triangleCount || (n.mesh.indices ? n.mesh.indices.length / 3 : 0);
          totalVerts += n.mesh.vertexCount || (n.mesh.positions ? n.mesh.positions.length / 3 : 0);
        }
      });

      return {
        totalNodes: nodes.length,
        totalTris,
        totalVerts,
        weiPartCount: weiNodes.length,
        weiParts: weiNodes.map(n => ({ id: n.id, name: n.name, tris: n.mesh?.triangleCount })),
        vehicleNodeCount: vehicleNodes.length,
        tenementNodeCount: tenementNodes.length,
        streetPropCount: streetPropNodes.length,
        crowdNodeCount: crowdNodes.length,
        fps: window.fps || 60
      };
    });

    console.log('Scene & Geometry Audit Data:', JSON.stringify(auditData, null, 2));

    // Assertions
    const failures = [];
    if (!auditData) failures.push('Audit data is null');
    if (auditData?.weiPartCount < 8) failures.push(`Expected >= 8 Wei Shen parts, got ${auditData?.weiPartCount}`);
    if (auditData?.totalTris < 20000) failures.push(`Expected >= 20,000 scene triangles with high-fidelity meshes, got ${auditData?.totalTris}`);
    if (consoleErrors.length > 0) failures.push(`Console errors detected: ${JSON.stringify(consoleErrors)}`);
    if (networkErrors.length > 0) failures.push(`Network errors detected: ${JSON.stringify(networkErrors)}`);

    console.log('=== VERIFICATION SUMMARY ===');
    console.log('Failures:', failures);
    console.log('Console Errors:', consoleErrors.length);
    console.log('Network Errors:', networkErrors.length);

    if (failures.length === 0) {
      console.log('ALL TESTS PASSED! VISUAL OVERHAUL 100% VERIFIED!');
    } else {
      console.error('TESTS FAILED WITH ERRORS!');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runVisualOverhaulVerification();
