import * as THREE from 'three';
import type { Collider, WorldContext } from '../types';
import type { VillaBuildOutput } from './HuashilouBuilder';
import {
  type VillaMaterialLibrary,
  createDormerUnit,
  createGableRoof,
  createGraniteWallRun,
  createLantern,
  createPlaqueMesh,
  createScaledBox,
  createTerrainConformingPath,
  createTurretRoof,
  createWindowUnit,
  setShadows,
} from './villaTextures';

/**
 * 公主樓 (Princess House) — Iconic 1930s Danish Fairy-Tale Villa (居庸關路10號)
 * Center (-1, -49), courtyard x: [-18, 16], z: [-66, -32.5], facing South (+Z)
 * toward Juyongguan Ginkgo Avenue.
 */
export function buildPrincessHouse(
  ctx: WorldContext,
  mats: VillaMaterialLibrary
): VillaBuildOutput {
  const root = new THREE.Group();
  root.name = 'PrincessHouse';
  const colliders: Collider[] = [];

  const cx = -1;
  const cz = -49;
  const baseY = ctx.getTerrainHeight(cx, cz);

  const villa = new THREE.Group();
  villa.position.set(cx, baseY, cz);
  root.add(villa);

  const plinthEmbed = 2.2;
  const plinthAbove = 1.65;

  // --------------------------------------------------------------------------
  // 1. Stepped Rusticated Granite Mushroom-Stone Basement Plinth
  // --------------------------------------------------------------------------
  const mainW = 13.6;
  const mainD = 9.4;
  const plinthH = plinthAbove + plinthEmbed;

  const mainPlinth = new THREE.Mesh(
    createScaledBox(mainW + 0.55, plinthH, mainD + 0.55, 2.8, 2.2),
    mats.granite
  );
  mainPlinth.position.set(0, -plinthEmbed + plinthH * 0.5, 0);
  villa.add(mainPlinth);

  // Projecting SE front gable wing plinth
  const wingW = 5.1;
  const wingD = 3.2;
  const wingX = 3.85;
  const wingZ = mainD * 0.5 + wingD * 0.5 - 0.35;
  const wingPlinth = new THREE.Mesh(
    createScaledBox(wingW + 0.45, plinthH, wingD + 0.45, 2.6, 2.2),
    mats.granite
  );
  wingPlinth.position.set(wingX, -plinthEmbed + plinthH * 0.5, wingZ);
  villa.add(wingPlinth);

  // Crisp white stone/timber water-table belt capping the granite basement
  const waterTable = new THREE.Mesh(
    new THREE.BoxGeometry(mainW + 0.72, 0.16, mainD + 0.72),
    mats.carvedLimestone
  );
  waterTable.position.y = plinthAbove + 0.04;
  villa.add(waterTable);

  const wingTable = new THREE.Mesh(
    new THREE.BoxGeometry(wingW + 0.6, 0.16, wingD + 0.6),
    mats.carvedLimestone
  );
  wingTable.position.set(wingX, plinthAbove + 0.04, wingZ);
  villa.add(wingTable);

  // Small recessed cellar windows along the granite basement south & west walls
  for (const bx of [-3.4, 0.6]) {
    const cellarWin = createWindowUnit({
      width: 1.05,
      height: 0.68,
      glassMat: mats.windowWhiteSoft,
      frameMat: mats.whiteTrim,
    });
    cellarWin.position.set(bx, 0.92, mainD * 0.5 + 0.29);
    villa.add(cellarWin);
  }
  const wingCellar = createWindowUnit({
    width: 1.1,
    height: 0.68,
    glassMat: mats.windowWhiteSoft,
    frameMat: mats.whiteTrim,
  });
  wingCellar.position.set(wingX, 0.92, wingZ + wingD * 0.5 + 0.24);
  villa.add(wingCellar);

  // --------------------------------------------------------------------------
  // 2. Iconic Powder-Blue Stucco Walls & Crisp White Danish Timber Trim
  // --------------------------------------------------------------------------
  const wallH = 5.25;
  const eaveY = plinthAbove + wallH;

  const mainWall = new THREE.Mesh(
    createScaledBox(mainW, wallH, mainD, 3.6, 3.4),
    mats.princessBlue
  );
  mainWall.position.set(0, plinthAbove + wallH * 0.5, 0);
  villa.add(mainWall);

  const wingWall = new THREE.Mesh(
    createScaledBox(wingW, wallH, wingD, 3.4, 3.4),
    mats.princessBlue
  );
  wingWall.position.set(wingX, plinthAbove + wallH * 0.5, wingZ);
  villa.add(wingWall);

  // Crisp white corner timber pilasters & horizontal story fascia trim
  const cornerTrimCoords: [number, number][] = [
    [-mainW * 0.5, -mainD * 0.5],
    [mainW * 0.5, -mainD * 0.5],
    [-mainW * 0.5, mainD * 0.5],
    [mainW * 0.5, mainD * 0.5],
    [wingX - wingW * 0.5, wingZ + wingD * 0.5],
    [wingX + wingW * 0.5, wingZ + wingD * 0.5],
  ];
  for (const [tx, tz] of cornerTrimCoords) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, wallH + 0.1, 0.24), mats.whiteTrim);
    post.position.set(tx, plinthAbove + wallH * 0.5, tz);
    villa.add(post);
  }

  // Horizontal white belt course & upper eave frieze
  for (const ty of [plinthAbove + 2.85, eaveY - 0.1]) {
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(mainW + 0.16, 0.14, mainD + 0.16),
      mats.whiteTrim
    );
    belt.position.y = ty;
    villa.add(belt);
    const wBelt = new THREE.Mesh(
      new THREE.BoxGeometry(wingW + 0.16, 0.14, wingD + 0.16),
      mats.whiteTrim
    );
    wBelt.position.set(wingX, ty, wingZ);
    villa.add(wBelt);
  }

  // --------------------------------------------------------------------------
  // 3. Steeply Pitched Terracotta-Red Tiled Roof (~52° pitch!) & Half-Timbered Gables
  // --------------------------------------------------------------------------
  const mainRidgeH = 5.95; // atan(5.95 / 4.7) = 51.7° authentic steep Danish roof!
  const mainRoof = createGableRoof({
    width: mainW,
    depth: mainD,
    ridgeHeight: mainRidgeH,
    overhangEave: 0.68,
    overhangGable: 0.52,
    ridgeAlong: 'x',
    roofMat: mats.redRoof,
    gableWallMat: mats.princessBlue,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.4,
  });
  mainRoof.position.y = eaveY - 0.04;
  villa.add(mainRoof);

  // Steep projecting front-right cross-gable wing roof (~54° pitch)
  const wingRidgeH = 4.15;
  const wingRoof = createGableRoof({
    width: wingW + 0.06,
    depth: wingD + 2.6,
    ridgeHeight: wingRidgeH,
    overhangEave: 0.54,
    overhangGable: 0.5,
    ridgeAlong: 'z',
    roofMat: mats.redRoof,
    gableWallMat: mats.princessBlue,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.3,
  });
  wingRoof.position.set(wingX, eaveY - 0.04, wingZ - 1.25);
  villa.add(wingRoof);

  // Danish half-timbered white wood accent beams on the projecting front gable & east/west gables
  const wingFrontZ = wingZ + wingD * 0.5 + 0.05;
  const hBeam1 = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.88, 0.14, 0.1), mats.whiteTrim);
  hBeam1.position.set(wingX, eaveY + 1.0, wingFrontZ);
  const hBeam2 = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.5, 0.14, 0.1), mats.whiteTrim);
  hBeam2.position.set(wingX, eaveY + 2.25, wingFrontZ);
  villa.add(hBeam1, hBeam2);
  for (const bx of [-1.2, 0, 1.2]) {
    const vBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, bx === 0 ? 3.5 : 2.1, 0.1),
      mats.whiteTrim
    );
    vBeam.position.set(wingX + bx, eaveY + (bx === 0 ? 1.85 : 1.05), wingFrontZ);
    villa.add(vBeam);
  }
  for (const side of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.5, 0.1), mats.whiteTrim);
    brace.position.set(wingX + side * 1.4, eaveY + 0.65, wingFrontZ);
    brace.rotation.z = side * 0.62;
    villa.add(brace);
  }

  // Half-timbered accents on East & West main gables
  for (const side of [-1, 1]) {
    const gx = side * (mainW * 0.5 + 0.05);
    const gHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, mainD * 0.68), mats.whiteTrim);
    gHoriz.position.set(gx, eaveY + 1.9, 0);
    const gHoriz2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, mainD * 0.34), mats.whiteTrim);
    gHoriz2.position.set(gx, eaveY + 3.85, 0);
    villa.add(gHoriz, gHoriz2);
    for (const gz of [-1.6, 0, 1.6]) {
      const gv = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, gz === 0 ? 5.2 : 3.4, 0.14),
        mats.whiteTrim
      );
      gv.position.set(gx, eaveY + (gz === 0 ? 2.6 : 1.7), gz);
      villa.add(gv);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Fairy-Tale Corner Bay Turret (SW front-left corner)
  // --------------------------------------------------------------------------
  const turretX = -6.1;
  const turretZ = 3.9;
  const turretR = 2.02;
  const turretGroup = new THREE.Group();
  turretGroup.position.set(turretX, 0, turretZ);
  villa.add(turretGroup);

  const tPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(turretR + 0.16, turretR + 0.24, plinthH, 8),
    mats.granite
  );
  tPlinth.position.y = -plinthEmbed + plinthH * 0.5;
  turretGroup.add(tPlinth);

  const tBodyH = wallH + 1.15;
  const tBody = new THREE.Mesh(
    new THREE.CylinderGeometry(turretR, turretR, tBodyH, 8),
    mats.princessBlue
  );
  tBody.position.y = plinthAbove + tBodyH * 0.5;
  turretGroup.add(tBody);

  // White cornice & vertical ribs on the octagonal turret
  for (const ry of [plinthAbove + 0.04, plinthAbove + 2.85, plinthAbove + tBodyH - 0.06]) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(turretR + 0.12, turretR + 0.12, 0.16, 8),
      mats.whiteTrim
    );
    ring.position.y = ry;
    turretGroup.add(ring);
  }

  // Steep witch-hat / fairy-tale bell red conical turret roof
  const tRoof = createTurretRoof({
    radius: turretR + 0.42,
    height: 4.5,
    segments: 8,
    roofMat: mats.redRoof,
    trimMat: mats.whiteTrim,
    finialMat: mats.whiteTrim,
  });
  tRoof.position.y = plinthAbove + tBodyH;
  turretGroup.add(tRoof);

  // Wrap-around glowing windows on the corner turret
  const turretWinAngles = [0.2, -0.58, -1.36, -2.14, 0.98];
  for (const ang of turretWinAngles) {
    for (const wy of [plinthAbove + 1.45, plinthAbove + 4.35]) {
      const tw = createWindowUnit({
        width: 0.92,
        height: 1.5,
        glassMat: wy > 4.5 ? mats.windowWhiteWarm : mats.windowWhiteSoft,
        frameMat: mats.whiteTrim,
      });
      tw.position.set(Math.sin(ang) * (turretR - 0.06), wy, Math.cos(ang) * (turretR - 0.06));
      tw.rotation.y = ang;
      turretGroup.add(tw);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Three Charming Dormer Windows + Tall Weathered Red-Brick Chimney
  // --------------------------------------------------------------------------
  const dormerOpts = {
    width: 1.75,
    height: 1.75,
    depth: 2.1,
    wallMat: mats.princessBlue,
    roofMat: mats.redRoof,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    glassMat: mats.windowWhiteWarm,
  };
  const d1 = createDormerUnit(dormerOpts);
  d1.position.set(-2.3, eaveY + 1.4, 3.6);
  const d2 = createDormerUnit(dormerOpts);
  d2.position.set(0.55, eaveY + 1.4, 3.6);
  const d3 = createDormerUnit(dormerOpts);
  d3.rotation.y = Math.PI;
  d3.position.set(-1.5, eaveY + 1.4, -3.6);
  villa.add(d1, d2, d3);

  // Tall brick chimney with stepped brick crown & terracotta pots
  const chimney = new THREE.Mesh(
    createScaledBox(1.15, 5.2, 1.15, 2.0, 2.0),
    mats.redBrick
  );
  chimney.position.set(-1.8, eaveY + 4.35, -1.4);
  villa.add(chimney);
  const cCap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 1.4), mats.carvedLimestone);
  cCap.position.set(-1.8, eaveY + 7.0, -1.4);
  villa.add(cCap);
  for (const oz of [-0.26, 0.26]) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.55, 8),
      mats.terracottaRidge
    );
    pot.position.set(-1.8, eaveY + 7.36, -1.4 + oz);
    villa.add(pot);
  }

  // --------------------------------------------------------------------------
  // 6. Arched Danish Porch Entrance & White Shuttered Windows with Flower Boxes
  // --------------------------------------------------------------------------
  const porchX = -1.15;
  const porchZ = mainD * 0.5 + 1.35;

  // Grounded granite porch platform & front steps
  const porchPlinthH = plinthAbove + plinthEmbed;
  const porchBase = new THREE.Mesh(
    createScaledBox(3.4, porchPlinthH, 2.6, 2.4, 2.0),
    mats.granite
  );
  porchBase.position.set(porchX, -plinthEmbed + porchPlinthH * 0.5, porchZ);
  villa.add(porchBase);

  for (let s = 0; s < 6; s++) {
    const sy = (s + 1) * (plinthAbove / 6);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, sy + 0.5, 0.36),
      mats.granite
    );
    step.position.set(porchX, (sy - 0.5) * 0.5, porchZ + 1.35 + (5 - s) * 0.34);
    villa.add(step);
  }

  // White timber porch posts, curved arch trim & pitched red tiled canopy roof
  for (const px of [-1.42, 1.42]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.75, 0.22), mats.whiteTrim);
    post.position.set(porchX + px, plinthAbove + 1.38, porchZ + 1.05);
    villa.add(post);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 2.2), mats.whiteTrim);
    rail.position.set(porchX + px, plinthAbove + 0.45, porchZ);
    villa.add(rail);
  }

  // Graceful white arch header across the porch opening
  const archLeft = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.16), mats.whiteTrim);
  archLeft.position.set(porchX - 0.88, plinthAbove + 2.45, porchZ + 1.05);
  archLeft.rotation.z = 0.46;
  const archRight = archLeft.clone();
  archRight.position.x = porchX + 0.88;
  archRight.rotation.z = -0.46;
  villa.add(archLeft, archRight);

  const porchRoof = createGableRoof({
    width: 3.3,
    depth: 2.7,
    ridgeHeight: 1.55,
    overhangEave: 0.32,
    overhangGable: 0.32,
    ridgeAlong: 'z',
    roofMat: mats.redRoof,
    gableWallMat: mats.princessBlue,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.0,
  });
  porchRoof.position.set(porchX, plinthAbove + 2.68, porchZ - 0.05);
  villa.add(porchRoof);

  // Carved timber entrance door + hanging porch lantern + plaque
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.55, 0.22), mats.whiteTrim);
  doorFrame.position.set(porchX, plinthAbove + 1.3, mainD * 0.5 + 0.04);
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.35, 0.12), mats.timberDoor);
  doorLeaf.position.set(porchX, plinthAbove + 1.22, mainD * 0.5 + 0.12);
  villa.add(doorFrame, doorLeaf);

  const porchLantern = createLantern(mats, 'hex', true, 3.0, 13);
  porchLantern.position.set(porchX, plinthAbove + 2.35, porchZ + 0.5);
  villa.add(porchLantern);

  const flowerBoxCfg = {
    boxMat: mats.whiteTrim,
    foliageMat: mats.foliageBoxGreen,
    flowerMats: [mats.flowerRed, mats.flowerPink, mats.flowerGold],
  };

  const addPrincessWindow = (
    lx: number,
    ly: number,
    lz: number,
    ry: number,
    w = 1.25,
    h = 1.65,
    withFlowers = true,
    soft = false
  ) => {
    const win = createWindowUnit({
      width: w,
      height: h,
      glassMat: soft ? mats.windowWhiteSoft : mats.windowWhiteWarm,
      frameMat: mats.whiteTrim,
      shutterMat: mats.whiteShutter,
      flowerBox: withFlowers ? flowerBoxCfg : undefined,
    });
    win.position.set(lx, ly, lz);
    win.rotation.y = ry;
    villa.add(win);
  };

  // South front facade windows (wing & upper story)
  addPrincessWindow(wingX, plinthAbove + 1.5, wingZ + wingD * 0.5 + 0.02, 0, 1.85, 1.85, true);
  addPrincessWindow(wingX, plinthAbove + 4.1, wingZ + wingD * 0.5 + 0.02, 0, 1.65, 1.72, true);
  addPrincessWindow(wingX, eaveY + 1.55, wingZ + wingD * 0.5 + 0.06, 0, 1.05, 1.25, false, true);
  addPrincessWindow(porchX, plinthAbove + 4.2, mainD * 0.5 + 0.02, 0, 1.35, 1.65, true);
  addPrincessWindow(-3.4, plinthAbove + 1.5, mainD * 0.5 + 0.02, 0, 1.15, 1.65, true, true);
  addPrincessWindow(-3.4, plinthAbove + 4.2, mainD * 0.5 + 0.02, 0, 1.15, 1.65, false);

  // East & West facade windows
  for (const ez of [-2.2, 2.2]) {
    addPrincessWindow(mainW * 0.5 + 0.02, plinthAbove + 1.5, ez, Math.PI / 2, 1.2, 1.65, true);
    addPrincessWindow(mainW * 0.5 + 0.02, plinthAbove + 4.1, ez, Math.PI / 2, 1.2, 1.65, false, true);
  }
  addPrincessWindow(mainW * 0.5 + 0.02, eaveY + 2.5, 0, Math.PI / 2, 1.1, 1.4, false);
  addPrincessWindow(-mainW * 0.5 - 0.02, plinthAbove + 1.5, -2.0, -Math.PI / 2, 1.25, 1.65, true);
  addPrincessWindow(-mainW * 0.5 - 0.02, plinthAbove + 4.1, -2.0, -Math.PI / 2, 1.25, 1.65, false);
  addPrincessWindow(-mainW * 0.5 - 0.02, eaveY + 2.5, 0, -Math.PI / 2, 1.1, 1.4, false, true);

  // North rear windows
  for (const nx of [-3.8, 0, 3.8]) {
    addPrincessWindow(nx, plinthAbove + 1.5, -mainD * 0.5 - 0.02, Math.PI, 1.25, 1.65, false, true);
    addPrincessWindow(nx, plinthAbove + 4.1, -mainD * 0.5 - 0.02, Math.PI, 1.25, 1.65, false);
  }

  // --------------------------------------------------------------------------
  // 7. Courtyard Low Granite Wall + Crisp White Wooden Picket Fence + Open Gate
  //    Courtyard bounds: x: [-18, 16], z: [-66, -32.5]
  // --------------------------------------------------------------------------
  const minX = -18;
  const maxX = 16;
  const minZ = -66;
  const maxZ = -32.5;
  const gateX = -0.6;
  const gateHalfW = 2.45; // Generous 4.9m open garden gate framing Viewpoint 2 cleanly!

  const fenceOpts = {
    stoneHeight: 0.85,
    thickness: 0.38,
    topFence: 'picket' as const,
    fenceHeight: 0.86,
    pierSpacing: 5.5,
    colliders,
  };

  // Front south fence split cleanly around the open garden gate at x = -1
  root.add(createGraniteWallRun(ctx, mats, minX, maxZ, gateX - gateHalfW, maxZ, fenceOpts));
  root.add(createGraniteWallRun(ctx, mats, gateX + gateHalfW, maxZ, maxX, maxZ, fenceOpts));
  // West, East, and North courtyard fences
  root.add(createGraniteWallRun(ctx, mats, minX, minZ, minX, maxZ, fenceOpts));
  root.add(createGraniteWallRun(ctx, mats, maxX, minZ, maxX, maxZ, fenceOpts));
  root.add(
    createGraniteWallRun(ctx, mats, minX, minZ, maxX, minZ, {
      ...fenceOpts,
      topFence: 'none',
      stoneHeight: 1.5,
    })
  );

  // Open Danish white arched garden gate + granite piers + lanterns + heritage plaque
  const gateY = ctx.getTerrainHeight(gateX, maxZ);
  const gateGroup = new THREE.Group();
  gateGroup.position.set(gateX, gateY, maxZ);
  root.add(gateGroup);

  for (const side of [-1, 1]) {
    const px = side * (gateHalfW + 0.32);
    const pier = new THREE.Mesh(createScaledBox(0.68, 3.7, 0.68, 2.0, 2.0), mats.granite);
    pier.position.set(px, 0.25, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.82), mats.carvedLimestone);
    cap.position.set(px, 2.15, 0);
    gateGroup.add(pier, cap);

    const lamp = createLantern(mats, 'globe', side === 1, 2.2, 11);
    lamp.position.set(px, 2.24, 0);
    gateGroup.add(lamp);

    // Swung-open white picket double gate leaf (swung inward into garden courtyard)
    const leaf = new THREE.Group();
    leaf.position.set(side * gateHalfW, 0, -0.05);
    leaf.rotation.y = side * -1.3;
    const topR = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.06), mats.whiteTrim);
    topR.position.set(-side * 0.88, 1.48, 0);
    const botR = topR.clone();
    botR.position.y = 0.34;
    leaf.add(topR, botR);
    for (let p = 0; p < 8; p++) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.48, 0.045), mats.whiteTrim);
      pk.position.set(-side * (0.14 + p * 0.22), 0.9, 0);
      leaf.add(pk);
    }
    gateGroup.add(leaf);
  }

  // Classic heritage plaque facing Ginkgo Avenue
  const gatePlaque = createPlaqueMesh('公主樓', '居庸關路10號 · 丹麥風格別墅', 1.18, 0.44, 'enamel');
  gatePlaque.position.set(gateHalfW + 0.32, 1.38, 0.37);
  gateGroup.add(gatePlaque);

  // --------------------------------------------------------------------------
  // 8. Curved Gravel Garden Path, Stone Courtyard Fountain & White Garden Bench
  // --------------------------------------------------------------------------
  const pathPoints: [number, number][] = [
    [-1.0, -32.2],
    [-1.1, -34.2],
    [-2.0, -36.5],
    [-2.8, -38.8],
    [-2.5, -40.8],
    [-2.15, -42.5],
  ];
  const gravelPath = createTerrainConformingPath(ctx, pathPoints, 2.35, mats.gravelPath, 0.045, 2.2);
  root.add(gravelPath);

  // Circular stone courtyard fountain / flower planter in the sunny SE lawn
  const fX = 6.2;
  const fZ = -38.2;
  const fY = ctx.getTerrainHeight(fX, fZ);
  const fountain = new THREE.Group();
  fountain.position.set(fX, fY, fZ);
  root.add(fountain);

  const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.88, 0.95, 16), mats.granite);
  basinOuter.position.y = 0.18;
  const basinRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.14, 8, 20),
    mats.carvedLimestone
  );
  basinRim.rotation.x = Math.PI / 2;
  basinRim.position.y = 0.65;
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.56, 0.08, 16), mats.fountainWater);
  waterDisc.position.y = 0.56;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.42, 1.15, 10),
    mats.carvedLimestone
  );
  pedestal.position.y = 0.95;
  const upperBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.35, 0.32, 14),
    mats.carvedLimestone
  );
  upperBowl.position.y = 1.52;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mats.carvedLimestone);
  finial.position.y = 1.82;
  fountain.add(basinOuter, basinRim, waterDisc, pedestal, upperBowl, finial);

  // Small flower ring nestled around fountain base
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mats.foliageBoxGreen);
    bush.scale.set(1.2, 0.72, 1.2);
    bush.position.set(Math.cos(a) * 2.02, 0.15, Math.sin(a) * 2.02);
    fountain.add(bush);
    const fl = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.11, 0),
      i % 2 === 0 ? mats.flowerPink : mats.flowerGold
    );
    fl.position.set(Math.cos(a) * 2.05, 0.34, Math.sin(a) * 2.05);
    fountain.add(fl);
  }

  // White wooden garden bench overlooking the fountain
  const benchX = -6.8;
  const benchZ = -37.8;
  const benchY = ctx.getTerrainHeight(benchX, benchZ);
  const bench = new THREE.Group();
  bench.position.set(benchX, benchY, benchZ);
  bench.rotation.y = 0.55;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.54), mats.whiteTrim);
  seat.position.y = 0.46;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 0.07), mats.whiteTrim);
  back.position.set(0, 0.78, -0.24);
  back.rotation.x = -0.15;
  for (const lx of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.52), mats.whiteTrim);
    leg.position.set(lx, 0.25, 0);
    bench.add(leg);
  }
  bench.add(seat, back);
  root.add(bench);

  // --------------------------------------------------------------------------
  // 9. Accurate Colliders (Villa footprint, Turret, Porch, Fountain)
  // --------------------------------------------------------------------------
  colliders.push(
    {
      type: 'box',
      minX: cx - mainW * 0.5 - 0.45,
      maxX: cx + mainW * 0.5 + 0.45,
      minZ: cz - mainD * 0.5 - 0.45,
      maxZ: cz + mainD * 0.5 + 0.45,
    },
    {
      type: 'box',
      minX: cx + wingX - wingW * 0.5 - 0.35,
      maxX: cx + wingX + wingW * 0.5 + 0.35,
      minZ: cz + wingZ - wingD * 0.5 - 0.35,
      maxZ: cz + wingZ + wingD * 0.5 + 0.35,
    },
    {
      type: 'box',
      minX: cx + porchX - 1.85,
      maxX: cx + porchX + 1.85,
      minZ: cz + mainD * 0.5,
      maxZ: cz + porchZ + 2.5,
    },
    { type: 'cylinder', x: cx + turretX, z: cz + turretZ, radius: turretR + 0.35 },
    { type: 'cylinder', x: fX, z: fZ, radius: 2.1 }
  );

  setShadows(root, true, true);
  gravelPath.castShadow = false;

  return { group: root, colliders };
}
