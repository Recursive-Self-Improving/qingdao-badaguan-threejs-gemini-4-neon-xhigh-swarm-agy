import * as THREE from 'three';
import type { Collider, WorldContext } from '../types';
import type { VillaBuildOutput } from './HuashilouBuilder';
import {
  type VillaMaterialLibrary,
  createDormerUnit,
  createGableRoof,
  createGraniteWallRun,
  createHippedRoof,
  createLantern,
  createPlaqueMesh,
  createScaledBox,
  createTerrainConformingPath,
  createTurretRoof,
  createWindowUnit,
  setShadows,
} from './villaTextures';

/**
 * 蝴蝶樓 (Butterfly House) — Iconic 1930s Qingdao Cinema Villa (山海關路21號)
 * Center (-1, 1), courtyard x: [-18, 16], z: [-15.5, 18], facing South (+Z)
 * toward Shanhaiguan Road & the Yellow Sea.
 */
export function buildButterflyHouse(
  ctx: WorldContext,
  mats: VillaMaterialLibrary
): VillaBuildOutput {
  const root = new THREE.Group();
  root.name = 'ButterflyHouse';
  const colliders: Collider[] = [];

  const cx = -1;
  const cz = 1;
  const baseY = ctx.getTerrainHeight(cx, cz);

  const villa = new THREE.Group();
  villa.position.set(cx, baseY, cz);
  root.add(villa);

  const plinthEmbed = 2.2;
  const plinthAbove = 1.5;
  const plinthH = plinthAbove + plinthEmbed;

  // --------------------------------------------------------------------------
  // 1. Grounded Qingdao Rusticated Granite Base & Warm Ochre-Yellow Stucco Body
  // --------------------------------------------------------------------------
  const mainW = 14.0;
  const mainD = 9.8;
  const wallH = 6.0;
  const eaveY = plinthAbove + wallH;

  const mainPlinth = new THREE.Mesh(
    createScaledBox(mainW + 0.55, plinthH, mainD + 0.55, 2.8, 2.2),
    mats.granite
  );
  mainPlinth.position.set(0, -plinthEmbed + plinthH * 0.5, 0);
  villa.add(mainPlinth);

  const waterTable = new THREE.Mesh(
    new THREE.BoxGeometry(mainW + 0.72, 0.16, mainD + 0.72),
    mats.carvedLimestone
  );
  waterTable.position.y = plinthAbove + 0.04;
  villa.add(waterTable);

  // Main 2-story warm ochre-yellow / butter-cream stucco mass
  const mainBody = new THREE.Mesh(
    createScaledBox(mainW, wallH, mainD, 3.6, 3.4),
    mats.butterflyOchre
  );
  mainBody.position.set(0, plinthAbove + wallH * 0.5, 0);
  villa.add(mainBody);

  // Subtle cream plaster corner pilasters & horizontal story belt molding
  const pilasterCoords: [number, number][] = [
    [-mainW * 0.5, -mainD * 0.5],
    [mainW * 0.5, -mainD * 0.5],
    [mainW * 0.5, mainD * 0.5],
    [-mainW * 0.5, mainD * 0.5],
  ];
  for (const [px, pz] of pilasterCoords) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.32, wallH + 0.06, 0.32), mats.creamStucco);
    pil.position.set(px, plinthAbove + wallH * 0.5, pz);
    villa.add(pil);
  }

  for (const by of [plinthAbove + 3.05, eaveY - 0.12]) {
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(mainW + 0.24, 0.18, mainD + 0.24),
      mats.creamStucco
    );
    belt.position.y = by;
    villa.add(belt);
  }

  // Projecting SE front gable bay (framing the front entrance)
  const bayW = 4.8;
  const bayD = 2.4;
  const bayX = 3.4;
  const bayZ = mainD * 0.5 + bayD * 0.5 - 0.3;

  const bayPlinth = new THREE.Mesh(
    createScaledBox(bayW + 0.4, plinthH, bayD + 0.4, 2.6, 2.2),
    mats.granite
  );
  bayPlinth.position.set(bayX, -plinthEmbed + plinthH * 0.5, bayZ);
  villa.add(bayPlinth);

  const bayBody = new THREE.Mesh(
    createScaledBox(bayW, wallH, bayD, 3.4, 3.4),
    mats.butterflyOchre
  );
  bayBody.position.set(bayX, plinthAbove + wallH * 0.5, bayZ);
  villa.add(bayBody);

  // --------------------------------------------------------------------------
  // 2. Deep Red-Terracotta Hipped & Cross-Gabled Roof + Carved Wooden Eave Brackets
  // --------------------------------------------------------------------------
  const mainRoof = createHippedRoof({
    width: mainW,
    depth: mainD,
    height: 4.35,
    overhang: 0.82,
    roofMat: mats.deepRedRoof,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  mainRoof.position.y = eaveY;
  villa.add(mainRoof);

  // Projecting cross-gabled roof over the SE front bay
  const bayRoof = createGableRoof({
    width: bayW + 0.08,
    depth: bayD + 2.8,
    ridgeHeight: 2.95,
    overhangEave: 0.55,
    overhangGable: 0.55,
    ridgeAlong: 'z',
    roofMat: mats.deepRedRoof,
    gableWallMat: mats.butterflyOchre,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.4,
  });
  bayRoof.position.set(bayX, eaveY - 0.04, bayZ - 1.25);
  villa.add(bayRoof);

  // Carved dark walnut wooden eave brackets supporting the overhanging eaves
  const bracketGeom = new THREE.BoxGeometry(0.14, 0.34, 0.62);
  for (let bx = -mainW * 0.5 + 0.8; bx <= mainW * 0.5 - 0.6; bx += 1.6) {
    for (const side of [-1, 1]) {
      const br = new THREE.Mesh(bracketGeom, mats.walnutTimber);
      br.position.set(bx, eaveY - 0.24, side * (mainD * 0.5 + 0.32));
      villa.add(br);
    }
  }
  const bracketGeomX = new THREE.BoxGeometry(0.62, 0.34, 0.14);
  for (let bz = -mainD * 0.5 + 0.8; bz <= mainD * 0.5 - 0.8; bz += 1.6) {
    for (const side of [-1, 1]) {
      const br = new THREE.Mesh(bracketGeomX, mats.walnutTimber);
      br.position.set(side * (mainW * 0.5 + 0.32), eaveY - 0.24, bz);
      villa.add(br);
    }
  }

  // Two charming roof dormers (south & west slopes) + sturdy ochre-and-brick chimney
  const southDormer = createDormerUnit({
    width: 1.85,
    height: 1.65,
    depth: 2.2,
    wallMat: mats.butterflyOchre,
    roofMat: mats.deepRedRoof,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    glassMat: mats.windowDarkWarm,
  });
  southDormer.position.set(-0.6, eaveY + 0.85, 3.85);
  villa.add(southDormer);

  const northDormer = southDormer.clone();
  northDormer.rotation.y = Math.PI;
  northDormer.position.set(-0.6, eaveY + 0.85, -3.85);
  villa.add(northDormer);

  const chimney = new THREE.Mesh(
    createScaledBox(1.2, 4.4, 1.2, 2.2, 2.2),
    mats.redBrick
  );
  chimney.position.set(-2.4, eaveY + 3.25, -1.6);
  const cCap = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.22, 1.46), mats.carvedLimestone);
  cCap.position.set(-2.4, eaveY + 5.5, -1.6);
  villa.add(chimney, cCap);

  // --------------------------------------------------------------------------
  // 3. Signature Curved / Semicircular Corner Sunroom & Second-Floor Balcony
  //    Hero focal feature on the SW corner (facing Jiayuguan/Shanhaiguan crossroads & sea!)
  // --------------------------------------------------------------------------
  const sunX = -5.75;
  const sunZ = 4.0;
  const sunR = 3.05;
  const sunGroup = new THREE.Group();
  sunGroup.position.set(sunX, 0, sunZ);
  villa.add(sunGroup);

  // Curved granite foundation base plunging deep into terrain
  const sunPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(sunR + 0.16, sunR + 0.26, plinthH, 16),
    mats.granite
  );
  sunPlinth.position.y = -plinthEmbed + plinthH * 0.5;
  sunGroup.add(sunPlinth);

  const sunBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(sunR + 0.24, sunR + 0.22, 0.16, 16),
    mats.carvedLimestone
  );
  sunBelt.position.y = plinthAbove + 0.05;
  sunGroup.add(sunBelt);

  // Ground-floor sunroom curved ochre lower dado wall + recessed glass drum
  const dadoH = 0.78;
  const sunDado = new THREE.Mesh(
    new THREE.CylinderGeometry(sunR, sunR, dadoH, 16),
    mats.butterflyOchre
  );
  sunDado.position.y = plinthAbove + dadoH * 0.5;
  sunGroup.add(sunDado);

  // Inner curved warm-lit glass sunroom cylinder
  const sunWindowH = 2.28;
  const sunCore = new THREE.Mesh(
    new THREE.CylinderGeometry(sunR - 0.16, sunR - 0.16, sunWindowH, 16),
    mats.butterflyOchre
  );
  sunCore.position.y = plinthAbove + dadoH + sunWindowH * 0.5;
  sunGroup.add(sunCore);

  // Tall arched multi-pane sunroom windows wrapping around the curved SW arc!
  const sunAngles = [-2.55, -2.02, -1.48, -0.94, -0.4, 0.14, 0.68];
  for (const ang of sunAngles) {
    const swin = createWindowUnit({
      width: 1.15,
      height: 2.15,
      glassMat: mats.windowDarkWarm,
      frameMat: mats.creamStucco,
      archedTop: true,
    });
    swin.position.set(
      Math.sin(ang) * (sunR - 0.08),
      plinthAbove + dadoH + sunWindowH * 0.5,
      Math.cos(ang) * (sunR - 0.08)
    );
    swin.rotation.y = ang;
    sunGroup.add(swin);

    // Separating cream classical sunroom pilaster between windows
    const pilAng = ang + 0.27;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.12, sunWindowH + 0.12, 8),
      mats.creamStucco
    );
    col.position.set(
      Math.sin(pilAng) * (sunR - 0.02),
      plinthAbove + dadoH + sunWindowH * 0.5,
      Math.cos(pilAng) * (sunR - 0.02)
    );
    sunGroup.add(col);
  }

  // Second-floor curved balcony deck slab crowning the ground-floor sunroom
  const balcFloorY = plinthAbove + dadoH + sunWindowH + 0.16;
  const balcDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(sunR + 0.22, sunR + 0.16, 0.26, 16),
    mats.carvedLimestone
  );
  balcDeck.position.y = balcFloorY;
  sunGroup.add(balcDeck);

  // Second-floor recessed curved stucco turret pavilion + French windows opening onto balcony
  const upperR = sunR - 0.92;
  const upperSunH = eaveY - balcFloorY + 0.35;
  const upperDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(upperR, upperR, upperSunH, 12),
    mats.butterflyOchre
  );
  upperDrum.position.y = balcFloorY + upperSunH * 0.5;
  sunGroup.add(upperDrum);

  for (const ang of [-1.75, -0.78, 0.22]) {
    const frenchDoor = createWindowUnit({
      width: 1.12,
      height: 2.1,
      glassMat: mats.windowDarkWarm,
      frameMat: mats.whiteTrim,
      shutterMat: mats.greenShutter,
    });
    frenchDoor.position.set(
      Math.sin(ang) * (upperR - 0.04),
      balcFloorY + 1.25,
      Math.cos(ang) * (upperR - 0.04)
    );
    frenchDoor.rotation.y = ang;
    sunGroup.add(frenchDoor);
  }

  // Ornate black wrought-iron curved balcony railing around the second-floor terrace!
  const railR = sunR + 0.06;
  const railH = 0.96;
  const railArcSegs = 18;
  for (let i = 0; i < railArcSegs; i++) {
    const a0 = -2.65 + (i / railArcSegs) * 3.85;
    const a1 = -2.65 + ((i + 1) / railArcSegs) * 3.85;
    const am = (a0 + a1) * 0.5;
    const chord = Math.hypot(
      (Math.sin(a1) - Math.sin(a0)) * railR,
      (Math.cos(a1) - Math.cos(a0)) * railR
    );

    // Top & bottom curved iron rail chords
    for (const ry of [balcFloorY + 0.2, balcFloorY + railH]) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(chord + 0.03, 0.045, 0.045), mats.wroughtIron);
      seg.position.set(Math.sin(am) * railR, ry, Math.cos(am) * railR);
      seg.rotation.y = am;
      sunGroup.add(seg);
    }
    // Slender vertical iron balusters + decorative ring every 3rd bay
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, railH - 0.08, 6),
      mats.wroughtIron
    );
    post.position.set(Math.sin(a0) * railR, balcFloorY + railH * 0.5 + 0.08, Math.cos(a0) * railR);
    sunGroup.add(post);

    if (i % 3 === 0) {
      const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 5, 10), mats.wroughtIron);
      scroll.position.set(Math.sin(am) * railR, balcFloorY + 0.58, Math.cos(am) * railR);
      scroll.rotation.y = am;
      sunGroup.add(scroll);
    }
  }

  // Slender corner wooden columns & sweeping red terracotta conical turret roof cap
  for (const ang of [-2.35, -1.35, -0.35, 0.65]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, upperSunH, 8),
      mats.walnutTimber
    );
    col.position.set(
      Math.sin(ang) * (sunR - 0.05),
      balcFloorY + upperSunH * 0.5,
      Math.cos(ang) * (sunR - 0.05)
    );
    sunGroup.add(col);
  }

  const sunRoof = createTurretRoof({
    radius: sunR + 0.45,
    height: 3.15,
    segments: 12,
    roofMat: mats.deepRedRoof,
    trimMat: mats.walnutTimber,
    finialMat: mats.weatheredCopper,
  });
  sunRoof.position.y = balcFloorY + upperSunH;
  sunGroup.add(sunRoof);

  // Subtle warm accent lantern on the sunroom balcony
  const sunLantern = createLantern(mats, 'hex', true, 2.8, 13);
  sunLantern.position.set(-sunR * 0.72, balcFloorY + upperSunH - 0.55, sunR * 0.72);
  sunGroup.add(sunLantern);

  // --------------------------------------------------------------------------
  // 4. Front Arched Veranda Porch, Second-Floor Juliette Balcony & Green-Shuttered Windows
  // --------------------------------------------------------------------------
  const porchX = -0.3;
  const porchZ = mainD * 0.5 + 1.25;

  const porchPlinth = new THREE.Mesh(
    createScaledBox(3.5, plinthH, 2.5, 2.4, 2.0),
    mats.granite
  );
  porchPlinth.position.set(porchX, -plinthEmbed + plinthH * 0.5, porchZ);
  villa.add(porchPlinth);

  // Wide welcoming granite entrance steps facing Shanhaiguan Road
  for (let s = 0; s < 5; s++) {
    const sy = (s + 1) * (plinthAbove / 5);
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.7, sy + 0.5, 0.36), mats.granite);
    step.position.set(porchX, (sy - 0.5) * 0.5, porchZ + 1.28 + (4 - s) * 0.34);
    villa.add(step);
  }

  // Twin cream porch columns supporting upper small balcony overhang
  for (const ox of [-1.42, 1.42]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.95, 10), mats.creamStucco);
    col.position.set(porchX + ox, plinthAbove + 1.48, porchZ + 1.0);
    villa.add(col);
  }
  const porchSlab = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.24, 2.55), mats.carvedLimestone);
  porchSlab.position.set(porchX, plinthAbove + 3.05, porchZ);
  villa.add(porchSlab);

  // Wrought-iron balcony railing above front porch
  const addIronBalconyRail = (x0: number, z0: number, x1: number, z1: number, yBase: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const rg = new THREE.Group();
    rg.position.set((x0 + x1) * 0.5, yBase, (z0 + z1) * 0.5);
    rg.rotation.y = ang;
    const tRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), mats.wroughtIron);
    tRail.position.y = 0.92;
    const bRail = tRail.clone();
    bRail.position.y = 0.16;
    rg.add(tRail, bRail);
    const cnt = Math.max(3, Math.floor(len / 0.2));
    for (let i = 0; i < cnt; i++) {
      const bz = -len * 0.5 + 0.1 + (i / Math.max(1, cnt - 1)) * (len - 0.2);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.85, 5), mats.wroughtIron);
      bar.position.set(0, 0.52, bz);
      rg.add(bar);
    }
    villa.add(rg);
  };
  const pBalY = plinthAbove + 3.17;
  addIronBalconyRail(porchX - 1.72, porchZ + 1.18, porchX + 1.72, porchZ + 1.18, pBalY);
  addIronBalconyRail(porchX - 1.72, porchZ - 1.05, porchX - 1.72, porchZ + 1.18, pBalY);
  addIronBalconyRail(porchX + 1.72, porchZ - 1.05, porchX + 1.72, porchZ + 1.18, pBalY);

  // Carved double timber door + hanging porch lantern
  const doorSurround = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.7, 0.22), mats.creamStucco);
  doorSurround.position.set(porchX, plinthAbove + 1.38, mainD * 0.5 + 0.05);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.48, 0.12), mats.timberDoor);
  doorMesh.position.set(porchX, plinthAbove + 1.28, mainD * 0.5 + 0.12);
  villa.add(doorSurround, doorMesh);

  const porchLamp = createLantern(mats, 'hex', false);
  porchLamp.position.set(porchX, plinthAbove + 2.52, porchZ + 0.55);
  villa.add(porchLamp);

  // Dark forest-green louvered shutter windows across all 4 facades
  const addButterflyWindow = (
    lx: number,
    ly: number,
    lz: number,
    ry: number,
    w = 1.28,
    h = 1.78,
    soft = false
  ) => {
    const win = createWindowUnit({
      width: w,
      height: h,
      glassMat: soft ? mats.windowWhiteSoft : mats.windowDarkWarm,
      frameMat: mats.creamStucco,
      shutterMat: mats.greenShutter,
      archedTop: true,
    });
    win.position.set(lx, ly, lz);
    win.rotation.y = ry;
    villa.add(win);
  };

  // South front windows (SE bay + balcony French doors)
  addButterflyWindow(bayX, plinthAbove + 1.55, bayZ + bayD * 0.5 + 0.02, 0, 1.65, 1.88);
  addButterflyWindow(bayX, plinthAbove + 4.45, bayZ + bayD * 0.5 + 0.02, 0, 1.55, 1.82);
  addButterflyWindow(porchX, plinthAbove + 4.45, mainD * 0.5 + 0.02, 0, 1.42, 1.95);

  // West facade (visible prominently from Jiayuguan Maple Avenue & Viewpoint 3!)
  addButterflyWindow(-mainW * 0.5 - 0.02, plinthAbove + 1.55, -2.0, -Math.PI / 2, 1.32, 1.82);
  addButterflyWindow(-mainW * 0.5 - 0.02, plinthAbove + 4.45, -2.0, -Math.PI / 2, 1.32, 1.82, true);

  // East facade
  for (const ez of [-2.2, 2.2]) {
    addButterflyWindow(mainW * 0.5 + 0.02, plinthAbove + 1.55, ez, Math.PI / 2, 1.26, 1.78, ez < 0);
    addButterflyWindow(mainW * 0.5 + 0.02, plinthAbove + 4.45, ez, Math.PI / 2, 1.26, 1.78);
  }

  // North facade (visible from Juyongguan Ginkgo Avenue!)
  for (const nx of [-4.2, -0.4, 3.6]) {
    addButterflyWindow(nx, plinthAbove + 1.55, -mainD * 0.5 - 0.02, Math.PI, 1.28, 1.78, nx > 0);
    addButterflyWindow(nx, plinthAbove + 4.45, -mainD * 0.5 - 0.02, Math.PI, 1.28, 1.78, nx < -2);
  }

  // --------------------------------------------------------------------------
  // 5. Qingdao Granite Mushroom-Stone Walls (~1.4m) + Black Wrought-Iron Grilles
  //    Open Front Gate along Shanhaiguan Rd (z = 18) & Side Gate along Juyongguan Rd (z = -15.5)
  // --------------------------------------------------------------------------
  const minX = -18;
  const maxX = 16;
  const minZ = -15.5;
  const maxZ = 18;
  const gateX = -1;

  const wallOpts = {
    stoneHeight: 1.2,
    thickness: 0.44,
    topFence: 'iron' as const,
    fenceHeight: 0.72,
    pierSpacing: 5.6,
    colliders,
  };

  // South front wall along Shanhaiguan Rd with classic Qingdao chamfered SW street corner
  // so Viewpoint 3 looks cleanly over the stone wall & iron grille at the curved sunroom!
  const frontGateHalf = 2.0;
  const cornerChamfer = 2.4;
  root.add(
    createGraniteWallRun(ctx, mats, minX, maxZ - cornerChamfer, minX + cornerChamfer, maxZ, {
      ...wallOpts,
      endPiers: false,
    })
  );
  root.add(
    createGraniteWallRun(ctx, mats, minX + cornerChamfer, maxZ, gateX - frontGateHalf, maxZ, wallOpts)
  );
  root.add(createGraniteWallRun(ctx, mats, gateX + frontGateHalf, maxZ, maxX, maxZ, wallOpts));

  // North side wall along Juyongguan Rd (open side gate width = 3.4m centered at x = -1)
  const sideGateHalf = 1.7;
  root.add(createGraniteWallRun(ctx, mats, minX, minZ, gateX - sideGateHalf, minZ, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, gateX + sideGateHalf, minZ, maxX, minZ, wallOpts));

  // West (Jiayuguan Maple Ave) & East (Huanghai Rd) granite + iron walls
  root.add(createGraniteWallRun(ctx, mats, minX, minZ, minX, maxZ - cornerChamfer, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, maxX, minZ, maxX, maxZ, wallOpts));

  // Helper to build grand twin stone gate pillars with glowing frosted globe lamps & swung-open iron gates
  const buildGateAssembly = (
    gx: number,
    gz: number,
    halfW: number,
    facingSign: 1 | -1,
    withPlaque: boolean,
    withPointLight: boolean
  ) => {
    const gy = ctx.getTerrainHeight(gx, gz);
    const gg = new THREE.Group();
    gg.position.set(gx, gy, gz);
    if (facingSign === -1) gg.rotation.y = Math.PI;
    root.add(gg);

    for (const side of [-1, 1]) {
      const px = side * (halfW + 0.42);
      const pierH = 2.65 + 1.9;
      const pier = new THREE.Mesh(
        createScaledBox(0.84, pierH, 0.84, 2.2, 2.2),
        mats.granite
      );
      pier.position.set(px, -1.9 + pierH * 0.5, 0);
      const cap1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 1.0), mats.carvedLimestone);
      cap1.position.set(px, 2.72, 0);
      const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.76), mats.carvedLimestone);
      cap2.position.set(px, 2.86, 0);
      gg.add(pier, cap1, cap2);

      // Iconic glowing warm globe lamp crowning each gate pillar!
      const globeLamp = createLantern(mats, 'globe', withPointLight && side === -1, 2.8, 13);
      globeLamp.position.set(px, 2.94, 0);
      gg.add(globeLamp);

      // Swung-open ornate black wrought-iron double gate leaf (swung inward into garden)
      const leaf = new THREE.Group();
      leaf.position.set(side * halfW, 0, -0.08);
      leaf.rotation.y = side * -1.3;
      const leafW = halfW - 0.14;
      for (const ry of [0.25, 1.1, 1.95]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.055, 0.055), mats.wroughtIron);
        rail.position.set(-side * leafW * 0.5, ry, 0);
        leaf.add(rail);
      }
      const bCnt = 7;
      for (let bi = 0; bi < bCnt; bi++) {
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.017, 0.017, 1.95, 5),
          mats.wroughtIron
        );
        bar.position.set(-side * (0.14 + (bi / (bCnt - 1)) * (leafW - 0.24)), 1.12, 0);
        leaf.add(bar);
      }
      gg.add(leaf);
    }

    if (withPlaque) {
      const plaque = createPlaqueMesh('蝴蝶樓', '山海關路21號 · 1934', 1.18, 0.44, 'bronze');
      plaque.position.set(halfW + 0.42, 1.55, 0.45);
      gg.add(plaque);
    }
  };

  buildGateAssembly(gateX, maxZ, frontGateHalf, 1, true, true);
  buildGateAssembly(gateX, minZ, sideGateHalf, -1, false, false);

  // --------------------------------------------------------------------------
  // 6. Courtyard Flagstone Garden Walk & Decorative Granite Urn Planters
  // --------------------------------------------------------------------------
  const frontWalk = createTerrainConformingPath(
    ctx,
    [
      [-1.0, 18.2],
      [-1.1, 15.2],
      [-1.2, 12.2],
      [-1.3, 9.2],
    ],
    2.45,
    mats.flagstonePath,
    0.045,
    2.2
  );
  const backWalk = createTerrainConformingPath(
    ctx,
    [
      [-1.0, -15.6],
      [-1.0, -12.0],
      [-1.0, -8.0],
      [6.5, -6.5],
      [8.2, 1.0],
      [6.5, 9.8],
      [-1.2, 12.2],
    ],
    1.85,
    mats.flagstonePath,
    0.042,
    2.2
  );
  root.add(frontWalk, backWalk);

  // Twin decorative stone urn planters flanking the front lawn walk
  for (const ux of [-5.2, 3.8]) {
    const uz = 12.6;
    const uy = ctx.getTerrainHeight(ux, uz);
    const urn = new THREE.Group();
    urn.position.set(ux, uy, uz);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mats.granite);
    ped.position.y = 0.22;
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.28, 0.45, 10),
      mats.carvedLimestone
    );
    bowl.position.y = 0.68;
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mats.foliageBoxGreen);
    bush.scale.set(1.15, 0.78, 1.15);
    bush.position.y = 1.02;
    const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mats.flowerRed);
    bloom.position.set(0.1, 1.24, 0.12);
    urn.add(ped, bowl, bush, bloom);
    root.add(urn);
  }

  // --------------------------------------------------------------------------
  // 7. Accurate Colliders (Villa keep, SE bay, SW Sunroom, Front Porch)
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
      minX: cx + bayX - bayW * 0.5 - 0.35,
      maxX: cx + bayX + bayW * 0.5 + 0.35,
      minZ: cz + bayZ - bayD * 0.5 - 0.35,
      maxZ: cz + bayZ + bayD * 0.5 + 0.35,
    },
    {
      type: 'box',
      minX: cx + porchX - 1.9,
      maxX: cx + porchX + 1.9,
      minZ: cz + mainD * 0.5,
      maxZ: cz + porchZ + 2.4,
    },
    { type: 'cylinder', x: cx + sunX, z: cz + sunZ, radius: sunR + 0.38 }
  );

  setShadows(root, true, true);
  frontWalk.castShadow = false;
  backWalk.castShadow = false;

  return { group: root, colliders };
}
