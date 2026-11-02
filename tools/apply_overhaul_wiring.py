"""
apply_overhaul_wiring.py
Wires procedural-models.ts into:
  - client/src/asset-loader.ts (Articulated Wei Shen & Player Sedan with 3D Wheels)
  - client/src/crowd-system.ts (Detailed Humanoid NPCs & Brawlers)
  - client/src/traffic-system.ts (Detailed Aerodynamic Vehicles: HK Taxi, SUV, SWAT, Sedan)
  - client/src/world-streamer.ts (Hong Kong Tenement Buildings with Awnings & Balconies, Hydrants, Lampposts)
  - client/src/police-pursuit-system.ts (HKPD Cruiser, SDU Carrier, HKPD Uniformed Officers)
  - client/src/nightmare-north-point-system.ts (Authentic Qing Dynasty Jiangshi)
"""

import os
import sys

def update_asset_loader():
    path = os.path.join('client', 'src', 'asset-loader.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add imports
    old_import = "import {\n  decodeAuthenticVehicleMesh,\n  decodeAuthenticCharacterMesh,\n  decodeAuthenticWorldMesh,\n  decodeNativeIllusionModel,\n  DecodedMesh,\n  createBoxMesh\n} from './mesh-decoder';"
    new_import = """import {
  decodeAuthenticVehicleMesh,
  decodeAuthenticCharacterMesh,
  decodeAuthenticWorldMesh,
  decodeNativeIllusionModel,
  DecodedMesh,
  createBoxMesh
} from './mesh-decoder';
import {
  createDetailedWeiShenHead,
  createDetailedWeiShenHair,
  createDetailedWeiShenTorso,
  createDetailedWeiShenBelt,
  createDetailedWeiShenArm,
  createDetailedWeiShenWrist,
  createDetailedWeiShenLeg,
  createDetailedWeiShenShoe,
  createDetailedVehicle,
  createDetailedWheel
} from './procedural-models';"""

    if old_import not in content:
        # Check CRLF
        old_import = old_import.replace('\n', '\r\n')
        new_import = new_import.replace('\n', '\r\n')

    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print("Updated imports in asset-loader.ts")
    else:
        print("Warning: could not find old_import in asset-loader.ts")

    # 2. Update vehicleNode & add wheels in loadCompositeStreetScene
    old_veh = """  // 2. Authentic Vehicle Node (Placed on the street lane)
  const vehicleNode: SceneNode = {
    id: 'node-vehicle',
    name: 'Authentic Vehicle Chassis (Vehicles.big 0x008c038c)',
    mesh: vehicleMesh,
    texture: vehicleTexture,
    normalMap: vehicleNormal,
    position: [1.8, 0.35, 0.0],
    rotation: [0, 0.4, 0],
    scale: [1.0, 1.0, 1.0],
    color: [0.92, 0.22, 0.24], // Crimson red sedan
    visible: true,
    transform: createTransformMatrix([1.8, 0.35, 0.0], [0, 0.4, 0], [1.0, 1.0, 1.0])
  };
  sceneGraph.addNode(vehicleNode);"""

    new_veh = """  // 2. High-Fidelity Detailed Vehicle Node (Aerodynamic Sedan with 3D Wheels)
  const detailedSedanMesh = createDetailedVehicle('sedan');
  const vehicleNode: SceneNode = {
    id: 'node-vehicle',
    name: 'Detailed Aerodynamic Sedan',
    mesh: detailedSedanMesh,
    texture: vehicleTexture,
    normalMap: vehicleNormal,
    position: [1.8, 0.15, 0.0],
    rotation: [0, 0.4, 0],
    scale: [1.0, 1.0, 1.0],
    color: [0.92, 0.22, 0.24], // Crimson red sedan
    visible: true,
    transform: createTransformMatrix([1.8, 0.15, 0.0], [0, 0.4, 0], [1.0, 1.0, 1.0])
  };
  sceneGraph.addNode(vehicleNode);

  // Add 4 Detailed 3D Multi-Spoke Wheels to player sedan
  const wheelMesh = createDetailedWheel();
  const wheelOffsets: [number, number, number][] = [
    [-0.86, 0.33,  1.35],
    [ 0.86, 0.33,  1.35],
    [-0.86, 0.33, -1.35],
    [ 0.86, 0.33, -1.35],
  ];
  wheelOffsets.forEach((off, wIdx) => {
    const isRight = off[0] > 0;
    const wRotY = 0.4 + (isRight ? Math.PI : 0);
    const cosR = Math.cos(0.4);
    const sinR = Math.sin(0.4);
    const worldX = 1.8 + off[0] * cosR + off[2] * sinR;
    const worldZ = 0.0 - off[0] * sinR + off[2] * cosR;
    sceneGraph.addNode({
      id: `node-player-wheel-${wIdx}`,
      name: `Player Sedan Wheel ${wIdx + 1}`,
      mesh: wheelMesh,
      texture: vehicleTexture,
      position: [worldX, off[1], worldZ],
      rotation: [0, wRotY, 0],
      scale: [1, 1, 1],
      color: [0.15, 0.15, 0.17],
      visible: true,
      transform: createTransformMatrix([worldX, off[1], worldZ], [0, wRotY, 0], [1, 1, 1])
    });
  });"""

    if old_veh not in content:
        old_veh = old_veh.replace('\n', '\r\n')
        new_veh = new_veh.replace('\n', '\r\n')

    if old_veh in content:
        content = content.replace(old_veh, new_veh, 1)
        print("Updated vehicleNode and wheels in asset-loader.ts")
    else:
        print("Warning: could not find old_veh in asset-loader.ts")

    # 3. Update buildWeiShenMultiPart
    old_wei = """export function buildWeiShenMultiPart(
  sceneGraph: SceneGraph,
  textures: AuthenticTextures,
  basePos: [number, number, number],
  rotY: number
): void {
  // Shared meshes
  const headMesh = createBoxMesh(0.20, 0.22, 0.20, 'WeiShen_Head');
  const hairMesh = createBoxMesh(0.21, 0.08, 0.21, 'WeiShen_Hair');
  const torsoMesh = createBoxMesh(0.42, 0.54, 0.24, 'WeiShen_Torso');
  const beltMesh = createBoxMesh(0.43, 0.06, 0.25, 'WeiShen_Belt');
  const armMesh = createBoxMesh(0.11, 0.46, 0.11, 'WeiShen_Arm');
  const wristMesh = createBoxMesh(0.12, 0.08, 0.12, 'WeiShen_WristWrap');
  const legMesh = createBoxMesh(0.15, 0.64, 0.16, 'WeiShen_Leg');
  const shoeMesh = createBoxMesh(0.13, 0.09, 0.25, 'WeiShen_Shoe');

  // Head
  sceneGraph.addNode({
    id: 'node-wei-head',
    name: 'Wei Shen Head',
    mesh: headMesh,
    position: [basePos[0], basePos[1] + 1.55, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62], // Skin tone
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.55, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Hair
  sceneGraph.addNode({
    id: 'node-wei-hair',
    name: 'Wei Shen Slicked Hair',
    mesh: hairMesh,
    position: [basePos[0], basePos[1] + 1.66, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.08, 0.08, 0.10], // Jet black hair
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.66, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Torso (White ribbed athletic tank top)
  sceneGraph.addNode({
    id: 'node-wei-torso',
    name: 'Wei Shen Torso (White Tank Top)',
    mesh: torsoMesh,
    position: [basePos[0], basePos[1] + 1.18, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.96, 0.96, 0.98], // White undershirt
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.18, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Belt
  sceneGraph.addNode({
    id: 'node-wei-belt',
    name: 'Wei Shen Leather Belt',
    mesh: beltMesh,
    position: [basePos[0], basePos[1] + 0.91, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.18, 0.12, 0.08], // Dark leather
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 0.91, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-l',
    name: 'Wei Shen Left Arm',
    mesh: armMesh,
    position: [basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-l',
    name: 'Wei Shen Left Wrist Wrap',
    mesh: wristMesh,
    position: [basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-r',
    name: 'Wei Shen Right Arm',
    mesh: armMesh,
    position: [basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-r',
    name: 'Wei Shen Right Wrist Wrap',
    mesh: wristMesh,
    position: [basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-l',
    name: 'Wei Shen Left Leg (Denim Jeans)',
    mesh: legMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52], // Denim indigo blue
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-r',
    name: 'Wei Shen Right Leg (Denim Jeans)',
    mesh: legMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-l',
    name: 'Wei Shen Left Sneaker',
    mesh: shoeMesh,
    position: [basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14], // Dark running shoes
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });

  // Right Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-r',
    name: 'Wei Shen Right Sneaker',
    mesh: shoeMesh,
    position: [basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });
}"""

    new_wei = """export function buildWeiShenMultiPart(
  sceneGraph: SceneGraph,
  textures: AuthenticTextures,
  basePos: [number, number, number],
  rotY: number
): void {
  // High-fidelity sculpted anatomical meshes for protagonist Wei Shen
  const headMesh = createDetailedWeiShenHead();
  const hairMesh = createDetailedWeiShenHair();
  const torsoMesh = createDetailedWeiShenTorso();
  const beltMesh = createDetailedWeiShenBelt();
  const armLMesh = createDetailedWeiShenArm(true);
  const armRMesh = createDetailedWeiShenArm(false);
  const wristLMesh = createDetailedWeiShenWrist(true);
  const wristRMesh = createDetailedWeiShenWrist(false);
  const legLMesh = createDetailedWeiShenLeg(true);
  const legRMesh = createDetailedWeiShenLeg(false);
  const shoeLMesh = createDetailedWeiShenShoe(true);
  const shoeRMesh = createDetailedWeiShenShoe(false);

  // Head
  sceneGraph.addNode({
    id: 'node-wei-head',
    name: 'Wei Shen Head',
    mesh: headMesh,
    position: [basePos[0], basePos[1] + 1.55, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62], // Skin tone
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.55, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Hair
  sceneGraph.addNode({
    id: 'node-wei-hair',
    name: 'Wei Shen Slicked Hair',
    mesh: hairMesh,
    position: [basePos[0], basePos[1] + 1.62, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.08, 0.08, 0.10], // Jet black hair
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.62, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Torso (White ribbed athletic tank top)
  sceneGraph.addNode({
    id: 'node-wei-torso',
    name: 'Wei Shen Torso (White Tank Top)',
    mesh: torsoMesh,
    position: [basePos[0], basePos[1] + 1.18, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.96, 0.96, 0.98], // White undershirt
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 1.18, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Belt
  sceneGraph.addNode({
    id: 'node-wei-belt',
    name: 'Wei Shen Leather Belt',
    mesh: beltMesh,
    position: [basePos[0], basePos[1] + 0.91, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.18, 0.12, 0.08], // Dark leather
    visible: true,
    transform: createTransformMatrix([basePos[0], basePos[1] + 0.91, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-l',
    name: 'Wei Shen Left Arm',
    mesh: armLMesh,
    position: [basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-l',
    name: 'Wei Shen Left Wrist Wrap',
    mesh: wristLMesh,
    position: [basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Arm & Wristband
  sceneGraph.addNode({
    id: 'node-wei-arm-r',
    name: 'Wei Shen Right Arm',
    mesh: armRMesh,
    position: [basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.92, 0.74, 0.62],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 1.16, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  sceneGraph.addNode({
    id: 'node-wei-wrist-r',
    name: 'Wei Shen Right Wrist Wrap',
    mesh: wristRMesh,
    position: [basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.15, 0.15, 0.15],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.27, basePos[1] + 0.95, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-l',
    name: 'Wei Shen Left Leg (Denim Jeans)',
    mesh: legLMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52], // Denim indigo blue
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Right Leg (Denim jeans)
  sceneGraph.addNode({
    id: 'node-wei-leg-r',
    name: 'Wei Shen Right Leg (Denim Jeans)',
    mesh: legRMesh,
    texture: textures.clothing,
    normalMap: textures.characterNormal,
    position: [basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.20, 0.32, 0.52],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.56, basePos[2]], [0, rotY, 0], [1, 1, 1])
  });

  // Left Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-l',
    name: 'Wei Shen Left Sneaker',
    mesh: shoeLMesh,
    position: [basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14], // Dark running shoes
    visible: true,
    transform: createTransformMatrix([basePos[0] - 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });

  // Right Shoe
  sceneGraph.addNode({
    id: 'node-wei-shoe-r',
    name: 'Wei Shen Right Sneaker',
    mesh: shoeRMesh,
    position: [basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04],
    rotation: [0, rotY, 0],
    scale: [1, 1, 1],
    color: [0.12, 0.12, 0.14],
    visible: true,
    transform: createTransformMatrix([basePos[0] + 0.12, basePos[1] + 0.08, basePos[2] + 0.04], [0, rotY, 0], [1, 1, 1])
  });
}"""

    if old_wei not in content:
        old_wei = old_wei.replace('\n', '\r\n')
        new_wei = new_wei.replace('\n', '\r\n')

    if old_wei in content:
        content = content.replace(old_wei, new_wei, 1)
        print("Updated buildWeiShenMultiPart in asset-loader.ts")
    else:
        print("Warning: could not find old_wei in asset-loader.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("asset-loader.ts updated successfully!")


def update_crowd_system():
    path = os.path.join('client', 'src', 'crowd-system.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import
    old_imp = "import { DecodedMesh, parseIllusionBuffer, createHumanoidBrawlerMesh } from './mesh-decoder';"
    new_imp = """import { DecodedMesh, parseIllusionBuffer, createHumanoidBrawlerMesh } from './mesh-decoder';
import { createDetailedHumanoid, HumanoidVariant } from './procedural-models';"""

    if old_imp not in content:
        old_imp = old_imp.replace('\n', '\r\n')
        new_imp = new_imp.replace('\n', '\r\n')

    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Updated imports in crowd-system.ts")
    else:
        print("Warning: could not find old_imp in crowd-system.ts")

    # 2. Update mesh creation in init
    old_init = """    // 1. Preload authentic character meshes from Characters.big
    for (const cType of AUTHENTIC_CROWD_CATALOG) {
      try {
        const raw = await fetchRange('Characters', cType.offset, cType.span);
        const rawMesh = parseIllusionBuffer(raw, cType.name);
        // Clean humanoid brawler topology for proper human proportions and combat stances
        const mesh = createHumanoidBrawlerMesh(cType.height, cType.role === 'triad', cType.name);
        this.characterMeshes.set(cType.id, mesh);
      } catch (err) {
        const mesh = createHumanoidBrawlerMesh(cType.height, cType.role === 'triad', cType.name);
        this.characterMeshes.set(cType.id, mesh);
      }
    }"""

    new_init = """    // 1. Preload high-fidelity organic humanoid meshes with distinct clothes and stances
    for (const cType of AUTHENTIC_CROWD_CATALOG) {
      let variant: HumanoidVariant = 'triad-brawler';
      if (cType.id === 'triad-enforcer') {
        variant = 'triad-enforcer';
      } else if (cType.id === 'sun-on-yee') {
        variant = 'triad-brawler';
      } else if (cType.id === 'night-vendor') {
        variant = 'night-vendor';
      } else if (cType.id === 'hk-citizen') {
        variant = 'jackie-ma';
      }
      const mesh = createDetailedHumanoid(variant);
      this.characterMeshes.set(cType.id, mesh);
    }"""

    if old_init not in content:
        old_init = old_init.replace('\n', '\r\n')
        new_init = new_init.replace('\n', '\r\n')

    if old_init in content:
        content = content.replace(old_init, new_init, 1)
        print("Updated character mesh creation in crowd-system.ts")
    else:
        print("Warning: could not find old_init in crowd-system.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("crowd-system.ts updated successfully!")


def update_traffic_system():
    path = os.path.join('client', 'src', 'traffic-system.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import
    old_imp = "import { DecodedMesh, parseIllusionBuffer } from './mesh-decoder';"
    new_imp = """import { DecodedMesh, parseIllusionBuffer } from './mesh-decoder';
import { createDetailedVehicle, VehicleVariant } from './procedural-models';"""

    if old_imp not in content:
        old_imp = old_imp.replace('\n', '\r\n')
        new_imp = new_imp.replace('\n', '\r\n')

    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Updated imports in traffic-system.ts")
    else:
        print("Warning: could not find old_imp in traffic-system.ts")

    # 2. Update mesh loading in initTraffic
    old_traffic = """    // 1. Preload authentic vehicle models from Vehicles.big
    for (const vType of AUTHENTIC_VEHICLE_CATALOG) {
      try {
        const raw = await fetchRange('Vehicles', vType.offset, vType.span);
        const mesh = parseIllusionBuffer(raw, vType.name);
        if (mesh) {
          this.vehicleMeshes.set(vType.id, mesh);
        }
      } catch (err) {
        console.warn(`[TrafficSystem] Failed to load vehicle ${vType.id}:`, err);
      }
    }"""

    new_traffic = """    // 1. Preload high-fidelity aerodynamic 3D vehicle models
    const variantMap: Record<string, VehicleVariant> = {
      'hk-taxi': 'hk-taxi',
      'delivery-van': 'swat-van',
      'luxury-suv': 'luxury-suv',
      'compact-car': 'sedan'
    };
    for (const vType of AUTHENTIC_VEHICLE_CATALOG) {
      const variant = variantMap[vType.id] || 'sedan';
      const mesh = createDetailedVehicle(variant);
      this.vehicleMeshes.set(vType.id, mesh);
    }"""

    if old_traffic not in content:
        old_traffic = old_traffic.replace('\n', '\r\n')
        new_traffic = new_traffic.replace('\n', '\r\n')

    if old_traffic in content:
        content = content.replace(old_traffic, new_traffic, 1)
        print("Updated vehicle mesh creation in traffic-system.ts")
    else:
        print("Warning: could not find old_traffic in traffic-system.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("traffic-system.ts updated successfully!")


def update_world_streamer():
    path = os.path.join('client', 'src', 'world-streamer.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import
    old_imp = "import { DecodedTexture } from './texture-decoder';"
    new_imp = """import { DecodedTexture } from './texture-decoder';
import {
  createDetailedTenementBuilding,
  createDetailedFireHydrant,
  createDetailedStreetLamppost
} from './procedural-models';"""

    if old_imp not in content:
        old_imp = old_imp.replace('\n', '\r\n')
        new_imp = new_imp.replace('\n', '\r\n')

    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Updated imports in world-streamer.ts")
    else:
        print("Warning: could not find old_imp in world-streamer.ts")

    # 2. Update West and East building generation
    old_bld = """    // West Side Buildings (x = -15m)
    zPositions.forEach((z, idx) => {
      const height = 28.0 + (idx % 3) * 8.0;
      const bMesh = this.generateBoxMesh(12.0, height, 20.0);
      const bNode: SceneNode = {
        id: `node-building-w-${idx}`,
        name: `North Point Building Facade W${idx + 1}`,
        mesh: bMesh,
        texture: this.buildingTexture,
        position: [-14.5, height / 2, z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: buildingColors[idx % buildingColors.length],
        visible: true,
        transform: createTransformMatrix([-14.5, height / 2, z], [0, 0, 0], [1, 1, 1])
      };
      sceneGraph.addNode(bNode);
    });

    // East Side Buildings (x = +15m)
    zPositions.forEach((z, idx) => {
      const height = 32.0 + ((idx + 1) % 3) * 7.0;
      const bMesh = this.generateBoxMesh(12.0, height, 20.0);
      const bNode: SceneNode = {
        id: `node-building-e-${idx}`,
        name: `North Point Building Facade E${idx + 1}`,
        mesh: bMesh,
        texture: this.buildingTexture,
        position: [14.5, height / 2, z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: buildingColors[(idx + 2) % buildingColors.length],
        visible: true,
        transform: createTransformMatrix([14.5, height / 2, z], [0, 0, 0], [1, 1, 1])
      };
      sceneGraph.addNode(bNode);
    });"""

    new_bld = """    // West Side Hong Kong Tenement Buildings (Tong Lau with Awnings & Balconies)
    zPositions.forEach((z, idx) => {
      const height = 28.0 + (idx % 3) * 8.0;
      const bMesh = createDetailedTenementBuilding(20.0, height, 12.0);
      const bNode: SceneNode = {
        id: `node-building-w-${idx}`,
        name: `North Point Tenement Building W${idx + 1}`,
        mesh: bMesh,
        texture: this.buildingTexture,
        position: [-14.5, 0.0, z],
        rotation: [0, Math.PI / 2, 0],
        scale: [1, 1, 1],
        color: buildingColors[idx % buildingColors.length],
        visible: true,
        transform: createTransformMatrix([-14.5, 0.0, z], [0, Math.PI / 2, 0], [1, 1, 1])
      };
      sceneGraph.addNode(bNode);
    });

    // East Side Hong Kong Tenement Buildings (Tong Lau with Awnings & Balconies)
    zPositions.forEach((z, idx) => {
      const height = 32.0 + ((idx + 1) % 3) * 7.0;
      const bMesh = createDetailedTenementBuilding(20.0, height, 12.0);
      const bNode: SceneNode = {
        id: `node-building-e-${idx}`,
        name: `North Point Tenement Building E${idx + 1}`,
        mesh: bMesh,
        texture: this.buildingTexture,
        position: [14.5, 0.0, z],
        rotation: [0, -Math.PI / 2, 0],
        scale: [1, 1, 1],
        color: buildingColors[(idx + 2) % buildingColors.length],
        visible: true,
        transform: createTransformMatrix([14.5, 0.0, z], [0, -Math.PI / 2, 0], [1, 1, 1])
      };
      sceneGraph.addNode(bNode);
    });

    // Detailed Hong Kong Street Props (Fire Hydrants & Lampposts)
    const hydrantMesh = createDetailedFireHydrant();
    const lamppostMesh = createDetailedStreetLamppost();

    [
      { x: -5.8, z: -8.0 },
      { x:  5.8, z: 16.0 },
      { x: -5.8, z: 32.0 }
    ].forEach((pos, idx) => {
      sceneGraph.addNode({
        id: `node-hydrant-${idx}`,
        name: `Hong Kong Fire Hydrant ${idx + 1}`,
        mesh: hydrantMesh,
        position: [pos.x, 0.14, pos.z],
        rotation: [0, idx % 2 === 0 ? 0 : Math.PI, 0],
        scale: [1, 1, 1],
        color: [0.95, 0.15, 0.15],
        visible: true,
        transform: createTransformMatrix([pos.x, 0.14, pos.z], [0, idx % 2 === 0 ? 0 : Math.PI, 0], [1, 1, 1])
      });
    });

    [
      { x: -6.0, z: -25.0, rotY: Math.PI / 2 },
      { x: -6.0, z:   5.0, rotY: Math.PI / 2 },
      { x: -6.0, z:  35.0, rotY: Math.PI / 2 },
      { x:  6.0, z: -10.0, rotY: -Math.PI / 2 },
      { x:  6.0, z:  20.0, rotY: -Math.PI / 2 },
      { x:  6.0, z:  50.0, rotY: -Math.PI / 2 },
    ].forEach((pos, idx) => {
      sceneGraph.addNode({
        id: `node-lamppost-${idx}`,
        name: `Hong Kong Street Lamppost ${idx + 1}`,
        mesh: lamppostMesh,
        position: [pos.x, 0.14, pos.z],
        rotation: [0, pos.rotY, 0],
        scale: [1, 1, 1],
        color: [0.25, 0.28, 0.32],
        visible: true,
        transform: createTransformMatrix([pos.x, 0.14, pos.z], [0, pos.rotY, 0], [1, 1, 1])
      });
    });"""

    if old_bld not in content:
        old_bld = old_bld.replace('\n', '\r\n')
        new_bld = new_bld.replace('\n', '\r\n')

    if old_bld in content:
        content = content.replace(old_bld, new_bld, 1)
        print("Updated tenement buildings and street props in world-streamer.ts")
    else:
        print("Warning: could not find old_bld in world-streamer.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("world-streamer.ts updated successfully!")


def update_police_pursuit_system():
    path = os.path.join('client', 'src', 'police-pursuit-system.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import
    old_imp = "import { DecodedMesh, createBoxMesh } from './mesh-decoder';"
    new_imp = """import { DecodedMesh, createBoxMesh } from './mesh-decoder';
import { createDetailedVehicle, createDetailedHumanoid } from './procedural-models';"""

    if old_imp not in content:
        old_imp = old_imp.replace('\n', '\r\n')
        new_imp = new_imp.replace('\n', '\r\n')

    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Updated imports in police-pursuit-system.ts")
    else:
        print("Warning: could not find old_imp in police-pursuit-system.ts")

    # 2. Update cruiser & van mesh creation
    old_init = """    // Cruisers & Lightbars
    this.cruiserMesh = createBoxMesh(1.9, 1.4, 4.4, 'HKPD_CruiserChassis');
    this.vanMesh = createBoxMesh(2.2, 2.0, 5.2, 'SDU_TacticalVanChassis');"""

    new_init = """    // Cruisers & Lightbars
    this.cruiserMesh = createDetailedVehicle('police-cruiser');
    this.vanMesh = createDetailedVehicle('swat-van');"""

    if old_init not in content:
        old_init = old_init.replace('\n', '\r\n')
        new_init = new_init.replace('\n', '\r\n')

    if old_init in content:
        content = content.replace(old_init, new_init, 1)
        print("Updated cruiser/van meshes in police-pursuit-system.ts")
    else:
        print("Warning: could not find old_init in police-pursuit-system.ts")

    # 3. Update officer mesh creation
    old_off = "const bodyMesh = createBoxMesh(0.42, 1.4, 0.25, off.name);"
    new_off = "const bodyMesh = createDetailedHumanoid('hkpd-officer');"

    if old_off in content:
        content = content.replace(old_off, new_off)
        print("Updated officer body mesh in police-pursuit-system.ts")
    else:
        print("Warning: could not find old_off in police-pursuit-system.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("police-pursuit-system.ts updated successfully!")


def update_nightmare_north_point_system():
    path = os.path.join('client', 'src', 'nightmare-north-point-system.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add import
    old_imp = "import { DecodedMesh, createBoxMesh } from './mesh-decoder';"
    new_imp = """import { DecodedMesh, createBoxMesh } from './mesh-decoder';
import { createDetailedHumanoid } from './procedural-models';"""

    if old_imp not in content:
        old_imp = old_imp.replace('\n', '\r\n')
        new_imp = new_imp.replace('\n', '\r\n')

    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print("Updated imports in nightmare-north-point-system.ts")
    else:
        print("Warning: could not find old_imp in nightmare-north-point-system.ts")

    # 2. Update jiangshi mesh
    old_j = "this.jiangshiBodyMesh = createBoxMesh(0.44, 1.45, 0.26, 'Jiangshi_QingBody');"
    new_j = "this.jiangshiBodyMesh = createDetailedHumanoid('jiangshi');"

    if old_j in content:
        content = content.replace(old_j, new_j)
        print("Updated jiangshi mesh in nightmare-north-point-system.ts")
    else:
        print("Warning: could not find old_j in nightmare-north-point-system.ts")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("nightmare-north-point-system.ts updated successfully!")


if __name__ == '__main__':
    update_asset_loader()
    update_crowd_system()
    update_traffic_system()
    update_world_streamer()
    update_police_pursuit_system()
    update_nightmare_north_point_system()
    print("ALL FILES OVERHAULED SUCCESSFULLY!")

