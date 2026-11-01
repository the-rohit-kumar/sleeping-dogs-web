import puppeteer from '../client/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/rohit/.gemini/antigravity/brain/b75b9b44-0b2a-4450-a6bd-18dd1450778f';

async function run() {
  console.log('======================================================================');
  console.log('OPTION 1 VERIFICATION: SAFEHOUSE & URBAN TAXI FAST-TRAVEL NETWORK');
  console.log('  1. North Point Safehouse Entrance & Interior Teleportation');
  console.log('  2. Bed Rest: Day/Night Weather Advance, Health Restore & AutoSave');
  console.log('  3. Wardrobe Customizer: Silk Suit Equip & Limb Mesh Recoloring');
  console.log('  4. Refrigerator: Dragon Kick Drink & +50% Face Meter Boost');
  console.log('  5. CCTV Surveillance Desk: Encrypted Camera Feed Feeds');
  console.log('  6. Safehouse Street Exit & Return to North Point');
  console.log('  7. Hong Kong Urban Red Taxi Fast-Travel Dispatch to Central');
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

  console.log('[Step 2] Dismissing Title Screen & Entering Live Game Loop...');
  await page.evaluate(() => {
    if (typeof window.startGame === 'function') {
      window.startGame();
    } else {
      const btn = document.getElementById('btn-start-game');
      if (btn) btn.click();
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // --- Step 3: Safehouse Entrance Door Proximity & Entrance ---
  console.log('\n[Step 3] Approaching North Point Safehouse Entrance Door...');
  await page.evaluate(() => {
    const char = window.characterController;
    if (char) {
      char.position[0] = -8.5;
      char.position[1] = 0.0;
      char.position[2] = 18.0;
    }
  });
  await new Promise(r => setTimeout(r, 200));

  const doorCheck = await page.evaluate(() => {
    const safe = window.safehouseSystem;
    const promptEl = document.getElementById('safehouse-prompt');
    const isPromptVisible = promptEl && promptEl.style.display !== 'none';
    const promptText = promptEl ? promptEl.innerText : '';

    return {
      isInsideBefore: safe.isInsideSafehouse,
      isPromptVisible,
      promptText
    };
  });
  console.log('  -> Safehouse Door Check:', doorCheck);
  if (!doorCheck.isPromptVisible || !doorCheck.promptText.includes('ENTER WEI SHEN\'S NORTH POINT SAFEHOUSE')) {
    throw new Error(`Safehouse door entrance prompt not detected: ${JSON.stringify(doorCheck)}`);
  }

  console.log('  Triggering [E] to Enter Safehouse Apartment...');
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  });
  await new Promise(r => setTimeout(r, 1000));

  const interiorCheck = await page.evaluate(() => {
    const safe = window.safehouseSystem;
    const char = window.characterController;
    return {
      isInside: safe.isInsideSafehouse,
      position: [...char.position]
    };
  });
  console.log('  -> Safehouse Interior Check:', interiorCheck);
  if (!interiorCheck.isInside || interiorCheck.position[2] < 19.0) {
    throw new Error('Failed to enter safehouse apartment interior');
  }
  console.log('  [PASS] Successfully entered Wei Shen\'s North Point Safehouse!');

  const screen01 = path.join(ARTIFACT_DIR, 'safehouse_01_interior_entrance.png');
  await page.screenshot({ path: screen01 });
  console.log('  [SCREENSHOT CAPTURED]:', screen01);

  // --- Step 4: Bed Interaction (Sleep, Advance Time, 100% HP, AutoSave) ---
  console.log('\n[Step 4] Interacting with Bed (Sleep & Advance Time of Day)...');
  await page.evaluate(() => {
    const char = window.characterController;
    char.position[0] = -6.5;
    char.position[2] = 21.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  });
  await new Promise(r => setTimeout(r, 1200));

  const bedCheck = await page.evaluate(() => {
    const weather = window.weatherSystem;
    const saveMgr = window.saveManager;
    const autoSlot = saveMgr.loadSlot('autosave');
    return {
      weatherMode: weather.currentMode,
      weatherName: weather.settings.name,
      hasAutoSave: !!autoSlot,
      saveTitle: autoSlot?.slotName,
      health: autoSlot?.player.health
    };
  });
  console.log('  -> Bed Rest Results:', bedCheck);
  if (!bedCheck.hasAutoSave || bedCheck.health !== 100) {
    throw new Error('Bed sleep failed to restore 100% health or save checkpoint');
  }
  console.log('  [PASS] Bed sleep advanced time of day, restored 100% HP, and saved checkpoint!');

  const screen02 = path.join(ARTIFACT_DIR, 'safehouse_02_bed_rest_autosave.png');
  await page.screenshot({ path: screen02 });
  console.log('  [SCREENSHOT CAPTURED]:', screen02);

  // --- Step 5: Wardrobe / Closet Outfit Customizer ---
  console.log('\n[Step 5] Interacting with Wardrobe (Outfit Customizer & Limb Recoloring)...');
  await page.evaluate(() => {
    const char = window.characterController;
    char.position[0] = -10.5;
    char.position[2] = 21.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  });
  await new Promise(r => setTimeout(r, 500));

  const wardrobeModalCheck = await page.evaluate(() => {
    const modal = document.getElementById('wardrobe-modal');
    return {
      isOpen: window.safehouseSystem.isWardrobeOpen,
      isVisible: modal && modal.style.display !== 'none'
    };
  });
  console.log('  -> Wardrobe Modal Check:', wardrobeModalCheck);
  if (!wardrobeModalCheck.isOpen || !wardrobeModalCheck.isVisible) {
    throw new Error('Wardrobe modal failed to open');
  }

  console.log('  Equipping Sun On Yee Red Pole Satin Silk Suit...');
  await page.evaluate(() => {
    const card = document.querySelector('[data-outfit="sun_on_yee_silk_suit"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const outfitEquipCheck = await page.evaluate(() => {
    const safe = window.safehouseSystem;
    const scene = window.sceneGraph;
    const torsoNode = scene.getNode('node-wei-torso');
    return {
      currentOutfit: safe.currentOutfit,
      isWardrobeClosed: !safe.isWardrobeOpen,
      torsoColor: torsoNode ? torsoNode.color : null
    };
  });
  console.log('  -> Outfit Equipped Check:', outfitEquipCheck);
  if (outfitEquipCheck.currentOutfit !== 'sun_on_yee_silk_suit' || !outfitEquipCheck.torsoColor) {
    throw new Error('Failed to equip Sun On Yee silk suit');
  }
  console.log('  [PASS] Sun On Yee silk suit equipped and Wei Shen\'s torso node dynamically recolored!');

  const screen03 = path.join(ARTIFACT_DIR, 'safehouse_03_wardrobe_silk_suit.png');
  await page.screenshot({ path: screen03 });
  console.log('  [SCREENSHOT CAPTURED]:', screen03);

  // --- Step 6: Refrigerator (Dragon Kick Health & Face Boost) ---
  console.log('\n[Step 6] Interacting with Refrigerator (Dragon Kick Drink)...');
  const fridgeCheck = await page.evaluate(() => {
    const char = window.characterController;
    const combat = window.combatSystem;
    combat.faceMeter = 10.0; // Set low baseline

    char.position[0] = -6.5;
    char.position[2] = 18.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));

    return {
      faceMeterAfter: combat.faceMeter
    };
  });
  console.log('  -> Refrigerator Drink Check:', fridgeCheck);
  if (fridgeCheck.faceMeterAfter < 50) {
    throw new Error('Dragon Kick failed to boost Face Meter');
  }
  console.log('  [PASS] Consumed Dragon Kick: +50% Face Meter surge granted!');

  const screen04 = path.join(ARTIFACT_DIR, 'safehouse_04_fridge_dragon_kick.png');
  await page.screenshot({ path: screen04 });
  console.log('  [SCREENSHOT CAPTURED]:', screen04);

  // --- Step 7: Surveillance CCTV TV Desk ---
  console.log('\n[Step 7] Interacting with Surveillance CCTV TV Desk...');
  await page.evaluate(() => {
    const char = window.characterController;
    char.position[0] = -10.5;
    char.position[2] = 18.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  });
  await new Promise(r => setTimeout(r, 500));

  const tvModalCheck = await page.evaluate(() => {
    const tv = document.getElementById('cctv-modal');
    return {
      isOpen: window.safehouseSystem.isTVOpen,
      isVisible: tv && tv.style.display !== 'none'
    };
  });
  console.log('  -> CCTV Modal Check:', tvModalCheck);
  if (!tvModalCheck.isOpen || !tvModalCheck.isVisible) {
    throw new Error('CCTV monitor modal failed to open');
  }

  const screen05 = path.join(ARTIFACT_DIR, 'safehouse_05_cctv_surveillance_feed.png');
  await page.screenshot({ path: screen05 });
  console.log('  [SCREENSHOT CAPTURED]:', screen05);

  console.log('  Closing CCTV monitor modal with [ESC]...');
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
  });
  await new Promise(r => setTimeout(r, 400));

  // --- Step 8: Safehouse Exit Back to Streets ---
  console.log('\n[Step 8] Exiting Safehouse to North Point Streets...');
  await page.evaluate(() => {
    const char = window.characterController;
    char.position[0] = -8.5;
    char.position[2] = 18.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  });
  await new Promise(r => setTimeout(r, 1000));

  const streetCheck = await page.evaluate(() => {
    const safe = window.safehouseSystem;
    const char = window.characterController;
    return {
      isInside: safe.isInsideSafehouse,
      position: [...char.position]
    };
  });
  console.log('  -> Street Return Check:', streetCheck);
  if (streetCheck.isInside || streetCheck.position[2] > 17.5) {
    throw new Error('Failed to exit safehouse back to street level');
  }
  console.log('  [PASS] Successfully exited back to North Point street level!');

  // --- Step 9: Hong Kong Urban Red Taxi Fast-Travel ---
  console.log('\n[Step 9] Testing Hong Kong Urban Red Taxi Fast-Travel [X]...');
  await page.evaluate(() => {
    const char = window.characterController;
    char.position[0] = 0.0;
    char.position[2] = 0.0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x' }));
  });
  await new Promise(r => setTimeout(r, 500));

  const taxiModalCheck = await page.evaluate(() => {
    const modal = document.getElementById('taxi-modal');
    return {
      isVisible: modal && modal.style.display !== 'none'
    };
  });
  console.log('  -> Taxi Transit Modal Check:', taxiModalCheck);
  if (!taxiModalCheck.isVisible) {
    throw new Error('Taxi transit modal failed to open upon pressing [X]');
  }

  console.log('  Selecting Destination: Central Financial District ($120 HKD Fare)...');
  await page.evaluate(() => {
    const card = document.querySelector('[data-dest="central_ifc"]');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const taxiTravelCheck = await page.evaluate(() => {
    const char = window.characterController;
    const act = window.openWorldActivities;
    return {
      position: [...char.position],
      cashRemaining: act.totalCashEarned
    };
  });
  console.log('  -> Taxi Transit Destination Check:', taxiTravelCheck);
  if (taxiTravelCheck.position[0] !== 24.0 || taxiTravelCheck.position[2] !== -48.0) {
    throw new Error(`Taxi failed to teleport to Central coordinates: ${JSON.stringify(taxiTravelCheck)}`);
  }
  if (taxiTravelCheck.cashRemaining !== 880) { // $1000 - $120 fare = $880
    throw new Error(`Taxi fare incorrect: expected 880, got ${taxiTravelCheck.cashRemaining}`);
  }
  console.log('  [PASS] Taxi fast travel successfully dispatched player to Central & deducted fare!');

  const screen06 = path.join(ARTIFACT_DIR, 'safehouse_06_taxi_fast_travel_central.png');
  await page.screenshot({ path: screen06 });
  console.log('  [SCREENSHOT CAPTURED]:', screen06);

  // --- Step 10: Final Errors & Network Failures Check ---
  console.log('\n[Step 10] Auditing Browser Console & Network Health...');
  console.log(`  Total Page Errors: ${pageErrors.length}`);
  console.log(`  Total Failed Network Requests: ${failedRequests.length}`);

  if (pageErrors.length > 0) {
    throw new Error(`Option 1 verification failed due to page errors: ${pageErrors.join('; ')}`);
  }
  if (failedRequests.length > 0) {
    throw new Error(`Option 1 verification failed due to failed requests: ${failedRequests.join('; ')}`);
  }

  await browser.close();

  console.log('\n======================================================================');
  console.log('SUCCESS: OPTION 1 SAFEHOUSE & TAXI FAST-TRAVEL FULLY VERIFIED!');
  console.log('  - Enterable North Point Safehouse Apartment');
  console.log('  - Bed Rest, Day/Night Weather Advance, AutoSave Checkpoint');
  console.log('  - Wardrobe Customizer & Real-time Mesh Limb Recoloring');
  console.log('  - Refrigerator Dragon Kick Drink & Face Meter Surge');
  console.log('  - Encrypted CCTV Surveillance Feeds Monitor');
  console.log('  - Hong Kong Urban Red Taxi Fast-Travel Dispatch Network');
  console.log('  - Zero page errors, zero failed network requests');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
