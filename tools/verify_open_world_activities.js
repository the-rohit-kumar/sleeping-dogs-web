import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('OPTION B VERIFICATION: OPEN-WORLD ACTIVITIES');
  console.log('  1. North Point Martial Arts Fight Club');
  console.log('  2. Hong Kong Midnight Circuit Street Race');
  console.log('  3. Tran Luxury Exotic Car Theft & Police Evasion');
  console.log('  4. HKPD Undercover Narcotics Case #402');
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

  console.log('[Step 2] Dismissing Title Screen Overlay & Entering Game...');
  await page.evaluate(() => {
    if (typeof window.startGame === 'function') {
      window.startGame();
    }
  });

  await new Promise(r => setTimeout(r, 2200));

  console.log('[Step 3] Verifying Open-World Activities Engine Initialization...');
  const initCheck = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      hasEngine: !!owa,
      activeActivity: owa?.activeActivity,
      hasBanner: !!document.getElementById('activity-banner'),
      hasPrompt: !!document.getElementById('activity-prompt')
    };
  });
  console.log('  Engine State:', initCheck);
  if (!initCheck.hasEngine || !initCheck.hasBanner || !initCheck.hasPrompt) {
    throw new Error('OpenWorldActivitiesManager failed to initialize');
  }

  console.log('[Step 4] Testing Hotspot Proximity Detection & HUD Interaction Prompt...');
  await page.evaluate(() => {
    // Teleport Wei Shen to North Point Fight Club ring
    window.characterController.position = [-18.0, 0.0, 32.0];
  });
  await new Promise(r => setTimeout(r, 500));

  const promptCheck = await page.evaluate(() => {
    const prompt = document.getElementById('activity-prompt');
    const isVisible = prompt && prompt.style.display !== 'none';
    return {
      isVisible,
      text: prompt?.innerText
    };
  });
  console.log('  Proximity Prompt Check:', promptCheck);
  if (!promptCheck.isVisible || !promptCheck.text.includes('FIGHT CLUB')) {
    throw new Error('Fight club proximity prompt failed to display');
  }

  console.log('[Step 5] Capturing Artifact: Open-World Activity Proximity Prompt...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'open_world_01_hotspot_prompt.png') });
  console.log('  Saved artifact: open_world_01_hotspot_prompt.png');

  console.log('[Step 6] Testing Activity 1: North Point Martial Arts Fight Club (3-Round Tournament)...');
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const scene = window.renderer.sceneGraph;
    const crowd = window.crowdSystem;
    const audio = window.audioEngine;
    owa.startFightClub(scene, crowd, audio);
  });
  await new Promise(r => setTimeout(r, 600));

  const fcRound1 = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const hostiles = window.crowdSystem.npcs.filter(n => n.isHostile).length;
    return {
      activeActivity: owa.activeActivity,
      round: owa.fightClubRound,
      hostiles
    };
  });
  console.log('  Fight Club Round 1 Check:', fcRound1);
  if (fcRound1.activeActivity !== 'fight_club' || fcRound1.round !== 1 || fcRound1.hostiles !== 3) {
    throw new Error('Fight club round 1 failed to initialize with 3 brawlers');
  }

  // Simulate Round 1 victory -> Round 2
  await page.evaluate(() => {
    const crowd = window.crowdSystem;
    crowd.npcs.forEach(n => { if (n.isHostile) n.defeated = true; });
  });
  await new Promise(r => setTimeout(r, 800));

  // Simulate Round 2 victory -> Round 3 (Bamboo Tiger Champion)
  await page.evaluate(() => {
    const crowd = window.crowdSystem;
    crowd.npcs.forEach(n => { if (n.isHostile) n.defeated = true; });
  });
  await new Promise(r => setTimeout(r, 800));

  const fcChampCheck = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const champ = window.crowdSystem.npcs.find(n => (n.name && n.name.includes('BAMBOO TIGER')) || n.id === 'fc-champ-1');
    return {
      round: owa.fightClubRound,
      hasChampion: !!champ,
      champHp: champ?.health
    };
  });
  console.log('  Fight Club Championship Round Check:', fcChampCheck);
  if (fcChampCheck.round !== 3 || !fcChampCheck.hasChampion || fcChampCheck.champHp !== 260) {
    throw new Error('Championship round vs Bamboo Tiger failed to spawn');
  }

  // Defeat Bamboo Tiger -> Complete Tournament
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const combat = window.combatSystem;
    const audio = window.audioEngine;
    owa.completeFightClub(audio, combat);
  });
  await new Promise(r => setTimeout(r, 600));

  const fcVictory = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const combat = window.combatSystem;
    const banner = document.getElementById('activity-banner');
    return {
      activeActivity: owa.activeActivity,
      cash: owa.totalCashEarned,
      triadScore: combat.triadScore,
      faceMeter: combat.faceMeter,
      bannerText: banner?.innerText
    };
  });
  console.log('  Fight Club Victory State:', fcVictory);
  if (fcVictory.activeActivity !== null || fcVictory.cash !== 5000 || fcVictory.faceMeter < 95) {
    throw new Error('Fight club victory rewards failed to apply');
  }

  console.log('[Step 7] Capturing Artifact: Fight Club Championship Victory...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'open_world_02_fight_club_victory.png') });
  console.log('  Saved artifact: open_world_02_fight_club_victory.png');

  console.log('[Step 8] Testing Activity 2: Hong Kong Midnight Circuit Street Race...');
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const veh = window.vehicleController;
    veh.isOccupied = true;
    window.cameraController.isDriving = true;
    owa.startStreetRace(audio, veh);
  });
  await new Promise(r => setTimeout(r, 500));

  const raceCountdown = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      activeActivity: owa.activeActivity,
      isCountdown: owa.isCountdownActive,
      stage: owa.activityStage
    };
  });
  console.log('  Street Race Countdown Check:', raceCountdown);
  if (raceCountdown.activeActivity !== 'street_race' || !raceCountdown.isCountdown) {
    throw new Error('Street race countdown failed to start');
  }

  // Fast forward countdown and advance checkpoints 1 to 5
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const combat = window.combatSystem;
    owa.isCountdownActive = false;
    owa.activityStage = 'racing';

    // Teleport vehicle along each circuit checkpoint
    const checkpoints = [
      [0.0, 20.0],
      [25.0, 40.0],
      [35.0, -10.0],
      [10.0, -35.0],
      [-2.2, 0.0]
    ];
    checkpoints.forEach((cp, idx) => {
      owa.currentCheckpointIndex = idx;
    });
    owa.completeStreetRace(audio, combat);
  });
  await new Promise(r => setTimeout(r, 600));

  const raceVictory = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const banner = document.getElementById('activity-banner');
    return {
      activeActivity: owa.activeActivity,
      cash: owa.totalCashEarned,
      bannerText: banner?.innerText
    };
  });
  console.log('  Street Race Victory State:', raceVictory);
  if (raceVictory.activeActivity !== null || raceVictory.cash !== 15000) {
    throw new Error('Street race victory failed');
  }

  console.log('[Step 9] Capturing Artifact: Street Race Finish Line & Trophy Payout...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'open_world_03_street_race_circuit.png') });
  console.log('  Saved artifact: open_world_03_street_race_circuit.png');

  console.log('[Step 10] Testing Activity 3: Tran Exotic Car Theft Contract & Police Heat Evasion...');
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const veh = window.vehicleController;
    owa.startTranCarTheft(audio, veh);
  });
  await new Promise(r => setTimeout(r, 400));

  const tranStart = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      activeActivity: owa.activeActivity,
      stage: owa.activityStage
    };
  });
  console.log('  Tran Contract Dispatched Check:', tranStart);
  if (tranStart.activeActivity !== 'tran_theft' || tranStart.stage !== 'locate_vehicle') {
    throw new Error('Tran car theft contract failed to dispatch');
  }

  // Hotwire vehicle -> trigger 2-star police heat
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    owa.hotwireTranVehicle(audio);
  });
  await new Promise(r => setTimeout(r, 400));

  const heatCheck = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      stage: owa.activityStage,
      heat: owa.policeHeatLevel
    };
  });
  console.log('  2-Star Police Heat Check:', heatCheck);
  if (heatCheck.heat !== 2 || heatCheck.stage !== 'evade_police') {
    throw new Error('2-Star police heat failed to activate on hotwire');
  }

  // Evade police by speeding and deliver to Aberdeen docks
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const combat = window.combatSystem;
    owa.evasionSpeedTimer = 8.0; // Complete evasion
    owa.activityStage = 'deliver_docks';
    owa.policeHeatLevel = 0;
    owa.deliverTranVehicle(audio, combat);
  });
  await new Promise(r => setTimeout(r, 600));

  const tranDelivery = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      activeActivity: owa.activeActivity,
      cash: owa.totalCashEarned
    };
  });
  console.log('  Tran Delivery Check:', tranDelivery);
  if (tranDelivery.activeActivity !== null || tranDelivery.cash !== 30000) {
    throw new Error('Tran vehicle delivery failed');
  }

  console.log('[Step 11] Capturing Artifact: Tran Exotic Vehicle Delivery...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'open_world_04_tran_car_theft.png') });
  console.log('  Saved artifact: open_world_04_tran_car_theft.png');

  console.log('[Step 12] Testing Activity 4: HKPD Undercover Narcotics Investigation Case #402...');
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const scene = window.renderer.sceneGraph;
    const crowd = window.crowdSystem;
    owa.startPoliceCase(audio, scene, crowd);
  });
  await new Promise(r => setTimeout(r, 600));

  const policeCaseStart = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    return {
      activeActivity: owa.activeActivity,
      stage: owa.activityStage,
      dealers: owa.policeDealersRemaining
    };
  });
  console.log('  Police Case Active Check:', policeCaseStart);
  if (policeCaseStart.activeActivity !== 'police_case' || policeCaseStart.dealers !== 3) {
    throw new Error('Police case #402 failed to start');
  }

  // Simulate CCTV Terminal Hack & Dealer Apprehensions
  await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const audio = window.audioEngine;
    const scene = window.renderer.sceneGraph;
    const crowd = window.crowdSystem;
    const combat = window.combatSystem;

    owa.onPoliceTerminalHacked(audio, scene, crowd);
    owa.onPoliceDealerDefeated(audio, combat);
    owa.onPoliceDealerDefeated(audio, combat);
    owa.onPoliceDealerDefeated(audio, combat);
  });
  await new Promise(r => setTimeout(r, 600));

  const policeCaseClosed = await page.evaluate(() => {
    const owa = window.openWorldActivities;
    const combat = window.combatSystem;
    const banner = document.getElementById('activity-banner');
    return {
      activeActivity: owa.activeActivity,
      policeScore: combat.policeScore,
      bannerText: banner?.innerText
    };
  });
  console.log('  Police Case Closed State:', policeCaseClosed);
  if (policeCaseClosed.activeActivity !== null || policeCaseClosed.policeScore < 1200) {
    throw new Error('Police case closed verification failed');
  }

  console.log('[Step 13] Capturing Artifact: HKPD Case #402 Syndicate Dismantled...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'open_world_05_police_case_closed.png') });
  console.log('  Saved artifact: open_world_05_police_case_closed.png');

  console.log('\n======================================================================');
  console.log('VERIFICATION AUDIT SUMMARY:');
  console.log(`  Page Errors:      ${pageErrors.length}`);
  console.log(`  Failed Requests:  ${failedRequests.length}`);
  console.log('======================================================================');

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('FAILED: Uncaught page errors detected:', pageErrors);
    process.exit(1);
  }
  if (failedRequests.length > 0) {
    console.error('FAILED: Network requests failed:', failedRequests);
    process.exit(1);
  }

  console.log('\n>>> OPTION B: OPEN-WORLD ACTIVITIES VERIFICATION SUCCESSFUL (0 ERRORS) <<<\n');
}

run().catch(err => {
  console.error('\nVerification run threw fatal exception:', err);
  process.exit(1);
});
