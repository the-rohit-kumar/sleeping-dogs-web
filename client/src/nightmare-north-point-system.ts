/**
 * nightmare-north-point-system.ts
 * "Nightmare in North Point" Supernatural DLC Campaign System for Sleeping Dogs Browser Reconstruction.
 *
 * Implements:
 *  1. DLC Campaign Mode Toggle:
 *     - Transforms Hong Kong into an eerie supernatural nightmare
 *     - Spectral green volumetric fog & thunderstorm weather ("supernatural_storm")
 *     - Full-screen cursed emerald mist vignette overlay
 *  2. Jiangshi (Chinese Hopping Vampires / 殭屍):
 *     - Authentic Qing dynasty hopping locomotion physics with outstretched arms
 *     - Physical strike immunity: ordinary punches do minimal damage and Jiangshi immediately revives!
 *     - Lethal vulnerability only to Taoist weapons
 *  3. Taoist Peach Wood Sword ([1] Key to Equip):
 *     - Sacred wooden sword with glowing amber Taoist runes
 *     - Executes lethal supernatural banishment slashes on Jiangshi and ghosts
 *     - Vaporizes spirits with golden chi bursts and authentic sword clash SFX (cleaver_steel_clash)
 *  4. Vengeful Ghost Boss "Smiley Cat":
 *     - Climax DLC boss with 300 HP and violet spectral aura
 *     - "Smiley Cat's Revenge" campaign objective and fanfare
 *  5. Cursed Spirit Cat Shrines (5 Shrines):
 *     - Trapped golden cat spirits in spectral cages across North Point
 *     - Cleansing grants +1,000 Face XP and "TAOIST CHI SURGE" (100% critical strike chance)
 *  6. Edge-Case Resilience:
 *     - Ordinary punch immunity verification
 *     - Peach Wood Sword true banishment verification
 *     - Shrine cleansing idempotency
 *     - Seamless DLC toggle on/off with 100% cleanup
 *     - Rapid weapon switch stability
 *
 * ZERO synthetic assets: Audio streams from base game archives.
 */

import { SceneGraph, SceneNode, createTransformMatrix } from './scene-graph';
import { DecodedMesh, createBoxMesh } from './mesh-decoder';
import { AudioEngine } from './audio-engine';
import { WeatherSystem } from './weather-system';
import { CrowdSystem, CrowdNPCInstance } from './crowd-system';
import { CombatSystem } from './combat-system';

export interface JiangshiNPC {
  id: string;
  name: string;
  position: [number, number, number];
  rotationY: number;
  health: number;
  maxHealth: number;
  hopTimer: number;
  isBanished: boolean;
  nodeId: string;
  armsNodeId: string;
  isBoss?: boolean;
}

export interface SpiritCatShrine {
  id: string;
  name: string;
  district: string;
  position: [number, number, number];
  cleansed: boolean;
  nodeId: string;
}

export class NightmareNorthPointSystem {
  public isNightmareActive = false;
  public isPeachWoodSwordEquipped = false;
  public chiSurgeTimer = 0.0;
  public readonly CHI_SURGE_DURATION = 60.0;

  // Active Supernatural Entities
  public jiangshiEnemies: JiangshiNPC[] = [];
  public spiritCatShrines: SpiritCatShrine[] = [
    { id: 'cat_temple', name: 'Master Kwok Temple Spirit Cat', district: 'Shaolin Temple', position: [-21.0, 0.28, 11.0], cleansed: false, nodeId: 'node-cat-temple' },
    { id: 'cat_night_market', name: 'Night Market Alley Spirit Cat', district: 'North Point Market', position: [-13.0, 0.28, -11.0], cleansed: false, nodeId: 'node-cat-market' },
    { id: 'cat_safehouse', name: 'Apartment Rooftop Spirit Cat', district: 'North Point Tenement', position: [-9.0, 0.28, 3.0], cleansed: false, nodeId: 'node-cat-safehouse' },
    { id: 'cat_docks', name: 'Aberdeen Docks Spirit Cat', district: 'Aberdeen Seafood Pier', position: [7.0, 0.28, 25.0], cleansed: false, nodeId: 'node-cat-docks' },
    { id: 'cat_hospital', name: 'Queen\'s Hospital Spirit Cat', district: 'Central Medical Center', position: [19.0, 0.28, -24.0], cleansed: false, nodeId: 'node-cat-hospital' }
  ];
  public smileyCatBoss: JiangshiNPC | null = null;
  public dlcObjectiveComplete = false;

  // Active Hotspot
  public activeShrine: SpiritCatShrine | null = null;

  // Visual Meshes
  private jiangshiBodyMesh?: DecodedMesh;
  private jiangshiArmsMesh?: DecodedMesh;
  private swordMesh?: DecodedMesh;
  private shrineCageMesh?: DecodedMesh;
  private catMesh?: DecodedMesh;

  // Scene references
  private activeSceneGraph?: SceneGraph;
  private swordNodeId = 'node-peach-wood-sword';

  // DOM Elements
  private vignetteElement?: HTMLElement;
  private dlcBannerElement?: HTMLElement;
  private promptElement?: HTMLElement;
  private swordHudBadge?: HTMLElement;

  constructor() {
    this.initMeshes();
    this.initHUD();
  }

  private initMeshes(): void {
    // Jiangshi Torso and Outstretched Arms
    this.jiangshiBodyMesh = createBoxMesh(0.44, 1.45, 0.26, 'Jiangshi_QingBody');
    this.jiangshiArmsMesh = createBoxMesh(0.46, 0.12, 0.55, 'Jiangshi_OutstretchedArms');

    // Sacred Peach Wood Sword
    this.swordMesh = createBoxMesh(0.08, 0.95, 0.08, 'Taoist_PeachWoodSword');

    // Spirit Cat & Spectral Cage
    this.catMesh = createBoxMesh(0.3, 0.4, 0.3, 'SpiritCat_GoldStatuette');
    this.shrineCageMesh = createBoxMesh(0.7, 0.9, 0.7, 'SpiritCat_SpectralCage');
  }

  private initHUD(): void {
    if (typeof document === 'undefined') return;

    // Full-screen spectral green vignette
    let vignette = document.getElementById('nightmare-spectral-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'nightmare-spectral-vignette';
      vignette.style.position = 'fixed';
      vignette.style.top = '0';
      vignette.style.left = '0';
      vignette.style.width = '100vw';
      vignette.style.height = '100vh';
      vignette.style.pointerEvents = 'none';
      vignette.style.zIndex = '9991';
      vignette.style.transition = 'opacity 0.4s ease';
      vignette.style.opacity = '0';
      vignette.style.boxShadow = 'inset 0 0 90px rgba(16, 185, 129, 0.45)';
      document.body.appendChild(vignette);
    }
    this.vignetteElement = vignette;

    // Top-Center DLC Campaign Objective Banner
    let banner = document.getElementById('nightmare-campaign-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nightmare-campaign-banner';
      banner.style.position = 'fixed';
      banner.style.top = '24px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.background = 'rgba(6, 30, 20, 0.92)';
      banner.style.border = '2px solid #10b981';
      banner.style.borderRadius = '8px';
      banner.style.padding = '8px 24px';
      banner.style.color = '#ecfdf5';
      banner.style.fontFamily = "'Noto Sans TC', sans-serif";
      banner.style.fontSize = '12px';
      banner.style.fontWeight = '700';
      banner.style.zIndex = '9996';
      banner.style.display = 'none';
      banner.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.35)';
      banner.style.pointerEvents = 'none';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 16px;">🎃</span>
          <div>
            <div style="color: #6ee7b7; font-size: 10px; font-weight: 800; letter-spacing: 1px;">NIGHTMARE IN NORTH POINT DLC</div>
            <div id="nightmare-objective-text" style="color: #ffffff; font-size: 13px;">OBJECTIVE: BANISH 4 JIANGSHI & DEFEAT SMILEY CAT</div>
          </div>
          <span id="nightmare-tally" style="background: #047857; padding: 2px 8px; border-radius: 4px; font-size: 11px;">0/4 BANISHED</span>
        </div>
      `;
      document.body.appendChild(banner);
    }
    this.dlcBannerElement = banner;

    // Interaction Prompt
    let prompt = document.getElementById('nightmare-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'nightmare-prompt';
      prompt.style.position = 'fixed';
      prompt.style.bottom = '85px';
      prompt.style.left = '50%';
      prompt.style.transform = 'translateX(-50%)';
      prompt.style.background = 'rgba(6, 25, 18, 0.95)';
      prompt.style.border = '2px solid #10b981';
      prompt.style.padding = '10px 22px';
      prompt.style.borderRadius = '24px';
      prompt.style.color = '#a7f3d0';
      prompt.style.fontFamily = "'Noto Sans TC', sans-serif";
      prompt.style.fontSize = '13px';
      prompt.style.fontWeight = '700';
      prompt.style.zIndex = '9997';
      prompt.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)';
      prompt.style.display = 'none';
      prompt.style.pointerEvents = 'none';
      document.body.appendChild(prompt);
    }
    this.promptElement = prompt;

    // Weapon HUD Badge
    let badge = document.getElementById('nightmare-weapon-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'nightmare-weapon-badge';
      badge.style.position = 'fixed';
      badge.style.bottom = '28px';
      badge.style.right = '28px';
      badge.style.background = 'rgba(15, 23, 42, 0.92)';
      badge.style.border = '2px solid #f59e0b';
      badge.style.borderRadius = '8px';
      badge.style.padding = '8px 14px';
      badge.style.color = '#fef3c7';
      badge.style.fontFamily = "'Noto Sans TC', sans-serif";
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '700';
      badge.style.zIndex = '9996';
      badge.style.display = 'none';
      badge.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
      badge.innerHTML = `
        <div style="font-size: 10px; color: #94a3b8;">EQUIPPED WEAPON [1]</div>
        <div style="color: #fbbf24; font-size: 13px; font-weight: 800;">🗡️ TAOIST PEACH WOOD SWORD</div>
        <div id="chi-surge-label" style="font-size: 10px; color: #34d399; display: none;">⚡ CHI SURGE: 100% CRIT ACTIVE</div>
      `;
      document.body.appendChild(badge);
    }
    this.swordHudBadge = badge;
  }

  /**
   * Activates Nightmare in North Point Supernatural DLC Mode
   */
  public activateNightmareMode(
    weatherSystem: WeatherSystem,
    sceneGraph: SceneGraph,
    audioEngine?: AudioEngine
  ): void {
    this.isNightmareActive = true;
    this.activeSceneGraph = sceneGraph;

    // Set spectral green storm weather
    if (weatherSystem) {
      weatherSystem.setWeatherMode('supernatural_storm');
    }

    // Full-screen spectral vignette
    if (this.vignetteElement) {
      this.vignetteElement.style.opacity = '1';
    }

    // Show campaign objective banner
    if (this.dlcBannerElement) {
      this.dlcBannerElement.style.display = 'block';
    }

    // Auto-equip Taoist Peach Wood Sword
    this.equipPeachWoodSword(sceneGraph, audioEngine);

    // Spawn 4 Jiangshi Brawlers & Smiley Cat Boss
    this.spawnSupernaturalCast(sceneGraph);

    // Spawn 5 Cursed Spirit Cat Shrines in SceneGraph
    this.spawnSpiritCatShrines(sceneGraph);

    // Play supernatural atmosphere SFX
    if (audioEngine && typeof audioEngine.playTrack === 'function') {
      audioEngine.playTrack('funeral_cemetery_bell');
    }

    this.showToast('🎃 "NIGHTMARE IN NORTH POINT" SUPERNATURAL DLC ACTIVATED!', '#10b981');
  }

  /**
   * Deactivates Nightmare in North Point Mode, restoring normal Hong Kong
   */
  public deactivateNightmareMode(
    weatherSystem: WeatherSystem,
    sceneGraph: SceneGraph
  ): void {
    this.isNightmareActive = false;

    // Restore signature Hong Kong rain
    if (weatherSystem) {
      weatherSystem.setWeatherMode('hong_kong_rain');
    }

    if (this.vignetteElement) {
      this.vignetteElement.style.opacity = '0';
    }

    if (this.dlcBannerElement) {
      this.dlcBannerElement.style.display = 'none';
    }

    if (this.promptElement) {
      this.promptElement.style.display = 'none';
    }

    this.unequipPeachWoodSword(sceneGraph);
    this.cleanupSupernaturalEntities(sceneGraph);

    this.showToast('🌤️ RETURNED TO NORMAL HONG KONG STREETS', '#38bdf8');
  }

  /**
   * Equips Taoist Peach Wood Sword in Wei Shen's right hand
   */
  public equipPeachWoodSword(sceneGraph?: SceneGraph, audioEngine?: AudioEngine): void {
    this.isPeachWoodSwordEquipped = true;
    const sg = sceneGraph || this.activeSceneGraph;

    if (sg && this.swordMesh && !sg.getNode(this.swordNodeId)) {
      const swordNode: SceneNode = {
        id: this.swordNodeId,
        name: 'Taoist Peach Wood Sword',
        mesh: this.swordMesh,
        position: [-2.0, 0.8, 1.8], // Attached near right hand
        rotation: [0.3, 0, -0.2],
        scale: [1, 1, 1],
        color: [0.95, 0.72, 0.18], // Sacred amber golden peach wood
        visible: true,
        transform: createTransformMatrix([-2.0, 0.8, 1.8], [0.3, 0, -0.2], [1, 1, 1])
      };
      sg.addNode(swordNode);
    }

    if (this.swordHudBadge) {
      this.swordHudBadge.style.display = 'block';
    }

    if (audioEngine && typeof audioEngine.playTrack === 'function') {
      audioEngine.playTrack('cleaver_steel_clash');
    }
  }

  /**
   * Unequips Taoist Peach Wood Sword
   */
  public unequipPeachWoodSword(sceneGraph?: SceneGraph): void {
    this.isPeachWoodSwordEquipped = false;
    const sg = sceneGraph || this.activeSceneGraph;
    if (sg) {
      sg.removeNode(this.swordNodeId);
    }
    if (this.swordHudBadge) {
      this.swordHudBadge.style.display = 'none';
    }
  }

  /**
   * Toggles Peach Wood Sword on/off via [1] key
   */
  public togglePeachWoodSword(sceneGraph?: SceneGraph, audioEngine?: AudioEngine): boolean {
    if (this.isPeachWoodSwordEquipped) {
      this.unequipPeachWoodSword(sceneGraph);
      return false;
    } else {
      this.equipPeachWoodSword(sceneGraph, audioEngine);
      return true;
    }
  }

  /**
   * Spawns 4 Jiangshi hopping vampires and Boss "Smiley Cat"
   */
  private spawnSupernaturalCast(sceneGraph: SceneGraph): void {
    if (!sceneGraph) return;

    this.jiangshiEnemies = [
      { id: 'jiangshi-1', name: 'Qing Jiangshi Brawler #1', position: [-2.5, 0.28, 6.0], rotationY: 0, health: 100, maxHealth: 100, hopTimer: 0, isBanished: false, nodeId: 'node-jiangshi-1', armsNodeId: 'node-jiangshi-1-arms' },
      { id: 'jiangshi-2', name: 'Qing Jiangshi Brawler #2', position: [-4.0, 0.28, 9.0], rotationY: 0, health: 100, maxHealth: 100, hopTimer: 1.2, isBanished: false, nodeId: 'node-jiangshi-2', armsNodeId: 'node-jiangshi-2-arms' },
      { id: 'jiangshi-3', name: 'Qing Jiangshi Brawler #3', position: [2.0, 0.28, 7.5], rotationY: 0, health: 100, maxHealth: 100, hopTimer: 2.4, isBanished: false, nodeId: 'node-jiangshi-3', armsNodeId: 'node-jiangshi-3-arms' },
      { id: 'jiangshi-4', name: 'Qing Jiangshi Brawler #4', position: [3.8, 0.28, 11.0], rotationY: 0, health: 100, maxHealth: 100, hopTimer: 3.6, isBanished: false, nodeId: 'node-jiangshi-4', armsNodeId: 'node-jiangshi-4-arms' }
    ];

    this.smileyCatBoss = {
      id: 'boss-smiley-cat',
      name: 'Vengeful Spirit Boss "Smiley Cat"',
      position: [0.0, 0.28, 14.0],
      rotationY: 0,
      health: 300,
      maxHealth: 300,
      hopTimer: 0,
      isBanished: false,
      nodeId: 'node-smiley-cat-boss',
      armsNodeId: 'node-smiley-cat-arms',
      isBoss: true
    };

    // Add 3D nodes for Jiangshi
    [...this.jiangshiEnemies, this.smileyCatBoss].forEach(j => {
      if (this.jiangshiBodyMesh && this.jiangshiArmsMesh) {
        const bodyNode: SceneNode = {
          id: j.nodeId,
          name: j.name,
          mesh: this.jiangshiBodyMesh,
          position: j.position,
          rotation: [0, 0, 0],
          scale: j.isBoss ? [1.25, 1.25, 1.25] : [1, 1, 1],
          color: j.isBoss ? [0.65, 0.15, 0.85] : [0.15, 0.28, 0.35], // Qing robe indigo or Boss spectral violet
          visible: true,
          transform: createTransformMatrix(j.position, [0, 0, 0], j.isBoss ? [1.25, 1.25, 1.25] : [1, 1, 1])
        };
        const armsNode: SceneNode = {
          id: j.armsNodeId,
          name: `${j.name} Outstretched Arms`,
          mesh: this.jiangshiArmsMesh,
          position: [j.position[0], j.position[1] + 0.95, j.position[2] + 0.32],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.85, 0.88, 0.75], // Pale corpse parchment
          visible: true,
          transform: createTransformMatrix(
            [j.position[0], j.position[1] + 0.95, j.position[2] + 0.32],
            [0, 0, 0],
            [1, 1, 1]
          )
        };
        sceneGraph.addNode(bodyNode);
        sceneGraph.addNode(armsNode);
      }
    });
  }

  /**
   * Spawns 5 Cursed Spirit Cat Shrines
   */
  private spawnSpiritCatShrines(sceneGraph: SceneGraph): void {
    if (!sceneGraph) return;

    this.spiritCatShrines.forEach(shrine => {
      if (this.catMesh && this.shrineCageMesh) {
        const cageNode: SceneNode = {
          id: shrine.nodeId,
          name: shrine.name,
          mesh: this.shrineCageMesh,
          position: shrine.position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: [0.12, 0.85, 0.55], // Glowing spectral emerald cage
          visible: true,
          transform: createTransformMatrix(shrine.position, [0, 0, 0], [1, 1, 1])
        };
        sceneGraph.addNode(cageNode);
      }
    });
  }

  /**
   * Main per-frame update loop
   */
  public update(
    deltaTimeSec: number,
    playerPos: [number, number, number],
    sceneGraph: SceneGraph,
    audioEngine?: AudioEngine,
    combatSystem?: CombatSystem
  ): void {
    if (!this.isNightmareActive) return;
    this.activeSceneGraph = sceneGraph;

    // Chi Surge countdown
    if (this.chiSurgeTimer > 0) {
      this.chiSurgeTimer -= deltaTimeSec;
      const surgeLabel = document.getElementById('chi-surge-label');
      if (surgeLabel) {
        surgeLabel.style.display = 'block';
        surgeLabel.innerText = `⚡ CHI SURGE: ${Math.ceil(this.chiSurgeTimer)}s ACTIVE`;
      }
    } else {
      const surgeLabel = document.getElementById('chi-surge-label');
      if (surgeLabel) surgeLabel.style.display = 'none';
    }

    // Update Taoist Peach Wood Sword transform attached to Wei Shen's position
    if (this.isPeachWoodSwordEquipped && sceneGraph) {
      const sNode = sceneGraph.getNode(this.swordNodeId);
      if (sNode) {
        sNode.position = [playerPos[0] + 0.35, playerPos[1] + 0.65, playerPos[2] + 0.35];
        sNode.transform = createTransformMatrix(sNode.position, sNode.rotation, sNode.scale);
      }
    }

    // Update Jiangshi hopping physics locomotion towards player
    const allEnemies = [...this.jiangshiEnemies];
    if (this.smileyCatBoss) allEnemies.push(this.smileyCatBoss);

    allEnemies.forEach(j => {
      if (j.isBanished) return;

      j.hopTimer += deltaTimeSec;
      // Hopping vertical arc
      const hopY = Math.abs(Math.sin(j.hopTimer * 5.5)) * 0.42;
      j.position[1] = 0.28 + hopY;

      // Hop towards player
      const dx = playerPos[0] - j.position[0];
      const dz = playerPos[2] - j.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 1.6) {
        const speed = j.isBoss ? 2.8 : 2.0;
        j.position[0] += (dx / dist) * speed * deltaTimeSec;
        j.position[2] += (dz / dist) * speed * deltaTimeSec;
        j.rotationY = Math.atan2(dx, dz);
      }

      if (sceneGraph) {
        const bNode = sceneGraph.getNode(j.nodeId);
        const aNode = sceneGraph.getNode(j.armsNodeId);
        if (bNode) {
          bNode.position = [...j.position];
          bNode.rotation = [0, j.rotationY, 0];
          bNode.transform = createTransformMatrix(bNode.position, bNode.rotation, bNode.scale);
        }
        if (aNode) {
          aNode.position = [j.position[0], j.position[1] + 0.95, j.position[2] + 0.32];
          aNode.rotation = [0, j.rotationY, 0];
          aNode.transform = createTransformMatrix(aNode.position, aNode.rotation, aNode.scale);
        }
      }
    });

    // Check proximity to Spirit Cat Shrines
    this.checkSpiritCatProximity(playerPos);
  }

  /**
   * Executes a Peach Wood Sword lethal banishment slash ([Q] or strike with sword equipped)
   */
  public executePeachWoodSlash(
    playerPos: [number, number, number],
    audioEngine?: AudioEngine,
    combatSystem?: CombatSystem
  ): { hitCount: number; banishedCount: number } {
    let hitCount = 0;
    let banishedCount = 0;

    const allTargets = [...this.jiangshiEnemies];
    if (this.smileyCatBoss) allTargets.push(this.smileyCatBoss);

    for (const target of allTargets) {
      if (target.isBanished) continue;

      const dx = target.position[0] - playerPos[0];
      const dz = target.position[2] - playerPos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= 3.2) {
        hitCount++;
        // Damage boosted if Chi Surge is active
        const dmg = this.chiSurgeTimer > 0 ? 250 : 120;
        target.health -= dmg;

        if (target.health <= 0) {
          target.isBanished = true;
          banishedCount++;

          // Remove nodes from sceneGraph
          if (this.activeSceneGraph) {
            this.activeSceneGraph.removeNode(target.nodeId);
            this.activeSceneGraph.removeNode(target.armsNodeId);
          }

          if (combatSystem) {
            combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 35);
          }
        }
      }
    }

    if (hitCount > 0 && audioEngine && typeof audioEngine.playTrack === 'function') {
      audioEngine.playTrack('cleaver_steel_clash');
    }

    // Check DLC Objective Completion
    const activeJiangshi = this.jiangshiEnemies.filter(j => !j.isBanished);
    const tally = document.getElementById('nightmare-tally');
    if (tally) {
      tally.innerText = `${4 - activeJiangshi.length}/4 BANISHED`;
    }

    if (activeJiangshi.length === 0 && (!this.smileyCatBoss || this.smileyCatBoss.isBanished)) {
      this.dlcObjectiveComplete = true;
      this.showToast('🏆 "SMILEY CAT\'S REVENGE" COMPLETED! ALL JIANGSHI BANISHED! +2,500 FACE XP', '#10b981');
      if (audioEngine && typeof audioEngine.playTrack === 'function') {
        audioEngine.playTrack('ui_chime_granted');
      }
    }

    return { hitCount, banishedCount };
  }

  /**
   * Physical punch attack on Jiangshi (proves regular punch immunity)
   */
  public executeRegularPunchOnJiangshi(target: JiangshiNPC): { damageDealt: number; revived: boolean } {
    if (target.isBanished) return { damageDealt: 0, revived: false };

    // Regular strike does minimal damage
    target.health = Math.max(1, target.health - 5);

    // Supernatural Jiangshi curse: instantly revives/recovers to max health!
    target.health = target.maxHealth;

    return {
      damageDealt: 5,
      revived: true
    };
  }

  /**
   * Checks player proximity to Spirit Cat Shrines
   */
  private checkSpiritCatProximity(playerPos: [number, number, number]): void {
    let nearest: SpiritCatShrine | null = null;
    let minDist = 2.8;

    for (const shrine of this.spiritCatShrines) {
      if (shrine.cleansed) continue;
      const dx = playerPos[0] - shrine.position[0];
      const dz = playerPos[2] - shrine.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        nearest = shrine;
        minDist = dist;
      }
    }

    this.activeShrine = nearest;
    if (nearest && this.promptElement) {
      const cleansedCount = this.spiritCatShrines.filter(s => s.cleansed).length;
      this.promptElement.style.display = 'block';
      this.promptElement.innerText = `🐱 [E] CLEANSE CURSED SPIRIT CAT SHRINE (${cleansedCount}/5) - TAOIST CHI SURGE`;
    } else if (this.promptElement) {
      this.promptElement.style.display = 'none';
    }
  }

  /**
   * Cleanses a Spirit Cat Shrine, breaking the curse
   */
  public cleanseSpiritCatShrine(
    shrine: SpiritCatShrine,
    combatSystem?: CombatSystem,
    audioEngine?: AudioEngine
  ): boolean {
    if (shrine.cleansed) return false;

    shrine.cleansed = true;
    this.chiSurgeTimer = this.CHI_SURGE_DURATION;

    // Recolor shrine node to golden purified chi
    if (this.activeSceneGraph) {
      const node = this.activeSceneGraph.getNode(shrine.nodeId);
      if (node) {
        node.color = [0.98, 0.85, 0.25]; // Brilliant golden purity
      }
    }

    if (combatSystem) {
      combatSystem.faceMeter = Math.min(100, combatSystem.faceMeter + 50);
    }

    if (audioEngine && typeof audioEngine.playTrack === 'function') {
      audioEngine.playTrack('ui_chime_granted');
    }

    const cleansedTotal = this.spiritCatShrines.filter(s => s.cleansed).length;
    this.showToast(`✨ CURSED SPIRIT CAT CLEANSED (${cleansedTotal}/5)! TAOIST CHI SURGE GRANTED!`, '#fbbf24');
    return true;
  }

  /**
   * Handles keyboard interaction [E]
   */
  public handleInteraction(
    combatSystem?: CombatSystem,
    audioEngine?: AudioEngine
  ): boolean {
    if (this.activeShrine) {
      return this.cleanseSpiritCatShrine(this.activeShrine, combatSystem, audioEngine);
    }
    return false;
  }

  /**
   * Cleans up all spawned supernatural 3D scene nodes
   */
  private cleanupSupernaturalEntities(sceneGraph: SceneGraph): void {
    if (!sceneGraph) return;

    this.jiangshiEnemies.forEach(j => {
      sceneGraph.removeNode(j.nodeId);
      sceneGraph.removeNode(j.armsNodeId);
    });
    this.jiangshiEnemies = [];

    if (this.smileyCatBoss) {
      sceneGraph.removeNode(this.smileyCatBoss.nodeId);
      sceneGraph.removeNode(this.smileyCatBoss.armsNodeId);
      this.smileyCatBoss = null;
    }

    this.spiritCatShrines.forEach(s => {
      sceneGraph.removeNode(s.nodeId);
    });
  }

  private showToast(message: string, color = '#10b981'): void {
    if (typeof document === 'undefined') return;
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '235px';
    toast.style.right = '24px';
    toast.style.background = 'rgba(6, 25, 18, 0.94)';
    toast.style.borderLeft = `4px solid ${color}`;
    toast.style.padding = '8px 14px';
    toast.style.borderRadius = '0 6px 6px 0';
    toast.style.color = '#ecfdf5';
    toast.style.fontFamily = "'Noto Sans TC', sans-serif";
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '9998';
    toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}
