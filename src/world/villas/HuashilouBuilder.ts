import * as THREE from 'three';
import type { Collider, WorldContext } from '../types';
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
  localToWorldXZ,
  setShadows,
} from './villaTextures';

export interface VillaBuildOutput {
  group: THREE.Group;
  colliders: Collider[];
}

/**
 * 花石樓 (Huashilou) — Crown Jewel of Qingdao Badaguan (黃海路18號)
 * 1930s Gothic + Romanesque + Greek coastal granite castle perched on the promontory
 * at (34, 56), rotated rotY = -0.35 facing No. 2 Bathing Beach & the Yellow Sea.
 */
export function buildHuashilou(
  ctx: WorldContext,
  mats: VillaMaterialLibrary
): VillaBuildOutput {
  const root = new THREE.Group();
  root.name = 'Huashilou';
  const colliders: Collider[] = [];

  const cx = 34;
  const cz = 56;
  const rotY = -0.35;
  const baseY = ctx.getTerrainHeight(cx, cz);

  // Main castle rotated local group
  const castle = new THREE.Group();
  castle.position.set(cx, baseY, cz);
  castle.rotation.y = rotY;
  root.add(castle);

  const plinthEmbed = 4.2;

  // --------------------------------------------------------------------------
  // 1. Main 3-Story Rusticated Granite & Multicolored "花石" Castle Keep
  // --------------------------------------------------------------------------
  const keepW = 12.8;
  const keepD = 9.8;
  const keepH = 10.6;

  // Heavy cliff-hugging granite rusticated basement plinth (extends 4.2m below plateau)
  const plinthH = 2.2 + plinthEmbed;
  const plinth = new THREE.Mesh(
    createScaledBox(keepW + 0.6, plinthH, keepD + 0.6, 2.8, 2.4),
    mats.granite
  );
  plinth.position.set(0, -plinthEmbed + plinthH * 0.5, 0);
  castle.add(plinth);

  // Main upper masonry body in multicolored "花石" pebble-and-granite ashlar
  const upperH = keepH - 2.1;
  const mainBody = new THREE.Mesh(
    createScaledBox(keepW, upperH, keepD, 3.0, 2.8),
    mats.huashilouStone
  );
  mainBody.position.set(0, 2.1 + upperH * 0.5, 0);
  castle.add(mainBody);

  // Horizontal dressed limestone stringcourses & cornice bands
  for (const bandY of [2.15, 5.65, 9.15, 10.55]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(keepW + 0.36, bandY === 10.55 ? 0.28 : 0.18, keepD + 0.36),
      mats.carvedLimestone
    );
    band.position.y = bandY;
    castle.add(band);
  }

  // Alternating corner dressed granite quoins on all 4 corners of the keep
  const quoinCorners: [number, number][] = [
    [-keepW * 0.5, -keepD * 0.5],
    [keepW * 0.5, -keepD * 0.5],
    [-keepW * 0.5, keepD * 0.5],
    [keepW * 0.5, keepD * 0.5],
  ];
  for (const [qx, qz] of quoinCorners) {
    for (let qi = 0; qi < 13; qi++) {
      const longX = qi % 2 === 0;
      const qw = longX ? 0.66 : 0.42;
      const qd = longX ? 0.42 : 0.66;
      const quoin = new THREE.Mesh(
        new THREE.BoxGeometry(qw, 0.52, qd),
        mats.carvedLimestone
      );
      quoin.position.set(
        qx + (qx > 0 ? -qw * 0.35 : qw * 0.35),
        2.55 + qi * 0.62,
        qz + (qz > 0 ? -qd * 0.35 : qd * 0.35)
      );
      castle.add(quoin);
    }
  }

  // Main steep terracotta red tiled gable roof + crow-stepped granite gable ends
  const mainRoof = createGableRoof({
    width: keepW - 0.15,
    depth: keepD + 0.2,
    ridgeHeight: 4.85,
    overhangEave: 0.55,
    overhangGable: 0.32,
    ridgeAlong: 'x',
    roofMat: mats.redRoof,
    gableWallMat: mats.huashilouStone,
    trimMat: mats.carvedLimestone,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  mainRoof.position.y = keepH - 0.05;
  castle.add(mainRoof);

  // Authentic Gothic crow-stepped granite parapets crowning east & west gable ends
  for (const gx of [-keepW * 0.5 - 0.04, keepW * 0.5 + 0.04]) {
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const frac = s / (steps - 1);
      const stepSpan = (keepD + 0.5) * (1 - frac * 0.86);
      const stepY = keepH + 0.35 + frac * 4.55;
      const merlon = new THREE.Mesh(
        createScaledBox(0.46, 0.92, stepSpan, 2.2, 2.0),
        mats.granite
      );
      merlon.position.set(gx, stepY, 0);
      castle.add(merlon);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.12, stepSpan + 0.08),
        mats.carvedLimestone
      );
      cap.position.set(gx, stepY + 0.48, 0);
      castle.add(cap);
    }
  }

  // Projecting seaward cross-gable bay wing (SE side of castle)
  const wingW = 5.4;
  const wingD = 3.6;
  const wingX = 3.1;
  const wingZ = keepD * 0.5 + wingD * 0.5 - 0.4;
  const wingPlinth = new THREE.Mesh(
    createScaledBox(wingW + 0.4, plinthH, wingD + 0.4, 2.6, 2.4),
    mats.granite
  );
  wingPlinth.position.set(wingX, -plinthEmbed + plinthH * 0.5, wingZ);
  castle.add(wingPlinth);

  const wingBody = new THREE.Mesh(
    createScaledBox(wingW, 7.6, wingD, 2.8, 2.6),
    mats.huashilouStone
  );
  wingBody.position.set(wingX, 2.1 + 3.8, wingZ);
  castle.add(wingBody);

  const wingRoof = createGableRoof({
    width: wingW + 0.1,
    depth: wingD + 1.8,
    ridgeHeight: 3.3,
    overhangEave: 0.48,
    overhangGable: 0.4,
    ridgeAlong: 'z',
    roofMat: mats.redRoof,
    gableWallMat: mats.huashilouStone,
    trimMat: mats.carvedLimestone,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.4,
  });
  wingRoof.position.set(wingX, 9.65, wingZ - 0.65);
  castle.add(wingRoof);

  // Dormer windows projecting from north & south roof slopes
  const southDormer = createDormerUnit({
    width: 1.9,
    height: 1.85,
    depth: 2.0,
    wallMat: mats.huashilouStone,
    roofMat: mats.redRoof,
    trimMat: mats.carvedLimestone,
    ridgeMat: mats.terracottaRidge,
    glassMat: mats.windowGothic,
  });
  southDormer.position.set(-1.3, 11.1, 3.6);
  castle.add(southDormer);

  const northDormer = southDormer.clone();
  northDormer.rotation.y = Math.PI;
  northDormer.position.set(2.4, 11.1, -3.6);
  castle.add(northDormer);

  // Tall rusticated granite chimney stack with terracotta pots
  const chimney = new THREE.Mesh(
    createScaledBox(1.35, 6.2, 1.35, 2.0, 2.2),
    mats.granite
  );
  chimney.position.set(3.4, 13.0, -1.6);
  castle.add(chimney);
  const chimneyCrown = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.28, 1.62),
    mats.carvedLimestone
  );
  chimneyCrown.position.set(3.4, 16.15, -1.6);
  castle.add(chimneyCrown);
  for (const ox of [-0.34, 0.34]) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8),
      mats.terracottaRidge
    );
    pot.position.set(3.4 + ox, 16.6, -1.6);
    castle.add(pot);
  }

  // --------------------------------------------------------------------------
  // 2. Iconic 5-Story Circular/Octagonal Corner Watchtower (圓形/八角塔樓)
  //    Perched dramatically on the seaward SW corner (~17m parapet, ~20.5m finial)
  // --------------------------------------------------------------------------
  const towerX = -5.45;
  const towerZ = 4.05;
  const towerR = 2.48;
  const towerParapetY = 16.6;
  const towerGroup = new THREE.Group();
  towerGroup.position.set(towerX, 0, towerZ);
  castle.add(towerGroup);

  // Flared granite batter foundation plunging into the coastal cliff
  const batterH = 2.6 + plinthEmbed;
  const towerBatter = new THREE.Mesh(
    new THREE.CylinderGeometry(towerR + 0.14, towerR + 0.72, batterH, 12),
    mats.granite
  );
  towerBatter.position.y = -plinthEmbed + batterH * 0.5;
  towerGroup.add(towerBatter);

  // 5-story cylindrical/12-faceted multicolored granite tower shaft
  const shaftH = 13.2;
  const shaftGeom = new THREE.CylinderGeometry(towerR * 0.96, towerR + 0.06, shaftH, 12);
  const sUv = shaftGeom.attributes.uv;
  for (let i = 0; i < sUv.count; i++) {
    sUv.setXY(i, sUv.getX(i) * 4.5, sUv.getY(i) * 4.4);
  }
  const towerShaft = new THREE.Mesh(shaftGeom, mats.huashilouStone);
  towerShaft.position.y = 2.5 + shaftH * 0.5;
  towerGroup.add(towerShaft);

  // Carved stone stringcourse rings dividing the 5 stories
  for (const ringY of [2.55, 5.75, 8.95, 12.15, 14.95]) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(towerR + 0.16, towerR + 0.14, 0.24, 12),
      mats.carvedLimestone
    );
    ring.position.y = ringY;
    towerGroup.add(ring);
  }

  // Gothic corbel brackets (machicolations) supporting the upper battlement crown
  const corbelCount = 16;
  for (let i = 0; i < corbelCount; i++) {
    const ang = (i / corbelCount) * Math.PI * 2;
    const corbel = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.52, 0.44),
      mats.carvedLimestone
    );
    corbel.position.set(
      Math.sin(ang) * (towerR + 0.08),
      15.25,
      Math.cos(ang) * (towerR + 0.08)
    );
    corbel.rotation.y = ang;
    towerGroup.add(corbel);
  }

  // Overhanging battlement walkway collar
  const battlementCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(towerR + 0.34, towerR + 0.16, 0.55, 12),
    mats.granite
  );
  battlementCollar.position.y = 15.72;
  towerGroup.add(battlementCollar);

  // Crenellated parapet merlons circling the tower top (y = 16.0..16.95)
  const merlonCount = 12;
  for (let i = 0; i < merlonCount; i++) {
    const ang = (i / merlonCount) * Math.PI * 2;
    const merlon = new THREE.Mesh(
      createScaledBox(0.76, 0.95, 0.38, 2.0, 2.0),
      mats.granite
    );
    merlon.position.set(
      Math.sin(ang) * (towerR + 0.14),
      16.45,
      Math.cos(ang) * (towerR + 0.14)
    );
    merlon.rotation.y = ang;
    towerGroup.add(merlon);

    const mCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.12, 0.46),
      mats.carvedLimestone
    );
    mCap.position.set(
      Math.sin(ang) * (towerR + 0.14),
      16.96,
      Math.cos(ang) * (towerR + 0.14)
    );
    mCap.rotation.y = ang;
    towerGroup.add(mCap);
  }

  // Octagonal stone turret lantern drum rising inside the battlement + steep red spire cap
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.62, 1.9, 8),
    mats.huashilouStone
  );
  drum.position.y = towerParapetY + 0.45;
  towerGroup.add(drum);

  // Tiny glowing watchtower lantern windows around the upper octagonal drum
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const lw = createWindowUnit({
      width: 0.62,
      height: 1.05,
      glassMat: mats.windowGothic,
      frameMat: mats.carvedLimestone,
      archedTop: true,
    });
    lw.position.set(Math.sin(ang) * 1.54, towerParapetY + 0.55, Math.cos(ang) * 1.54);
    lw.rotation.y = ang;
    towerGroup.add(lw);
  }

  const spireRoof = createTurretRoof({
    radius: 1.92,
    height: 3.1,
    segments: 8,
    roofMat: mats.redRoof,
    trimMat: mats.carvedLimestone,
    finialMat: mats.weatheredCopper,
  });
  spireRoof.position.y = towerParapetY + 1.45;
  towerGroup.add(spireRoof);

  // Narrow stacked Gothic arched windows around the 5-story watchtower shaft
  const towerStoryYs = [4.1, 7.3, 10.5, 13.55];
  const towerAngles = [0.25, 1.35, -0.85, -2.05, 2.55];
  for (let si = 0; si < towerStoryYs.length; si++) {
    const ty = towerStoryYs[si];
    for (let ai = 0; ai < towerAngles.length; ai++) {
      // Skip interior-facing side on lower stories
      const ang = towerAngles[ai];
      if (si < 3 && Math.sin(ang) > 0.45 && Math.cos(ang) < -0.35) continue;
      const win = createWindowUnit({
        width: 0.82,
        height: 1.68,
        glassMat: mats.windowGothic,
        frameMat: mats.carvedLimestone,
        archedTop: true,
      });
      win.position.set(Math.sin(ang) * (towerR - 0.02), ty, Math.cos(ang) * (towerR - 0.02));
      win.rotation.y = ang;
      towerGroup.add(win);
    }
  }

  // Subtle warm accent PointLight near the tower crown so Huashilou's turret glows romantically at dusk/night
  const towerCrownLantern = createLantern(mats, 'hex', true, 3.2, 16);
  towerCrownLantern.position.set(0, 16.3, towerR + 0.35);
  towerGroup.add(towerCrownLantern);

  // --------------------------------------------------------------------------
  // 3. Gothic Arched Mullioned Windows across All Main Castle Facades
  // --------------------------------------------------------------------------
  const addCastleWindow = (
    lx: number,
    ly: number,
    lz: number,
    ry: number,
    w = 1.25,
    h = 2.05
  ) => {
    const win = createWindowUnit({
      width: w,
      height: h,
      glassMat: mats.windowGothic,
      frameMat: mats.carvedLimestone,
      archedTop: true,
    });
    win.position.set(lx, ly, lz);
    win.rotation.y = ry;
    castle.add(win);
  };

  // South seaward facade (facing bay)
  addCastleWindow(-1.1, 3.85, keepD * 0.5 + 0.02, 0, 1.35, 2.15);
  addCastleWindow(-1.1, 7.4, keepD * 0.5 + 0.02, 0, 1.35, 2.15);
  // Projecting SE wing front & side windows
  addCastleWindow(wingX - 1.15, 3.85, wingZ + wingD * 0.5 + 0.02, 0, 1.2, 2.05);
  addCastleWindow(wingX + 1.15, 3.85, wingZ + wingD * 0.5 + 0.02, 0, 1.2, 2.05);
  addCastleWindow(wingX - 1.15, 7.4, wingZ + wingD * 0.5 + 0.02, 0, 1.2, 2.05);
  addCastleWindow(wingX + 1.15, 7.4, wingZ + wingD * 0.5 + 0.02, 0, 1.2, 2.05);
  addCastleWindow(wingX, 10.75, wingZ + wingD * 0.5 + 0.02, 0, 1.0, 1.45);
  addCastleWindow(wingX + wingW * 0.5 + 0.02, 7.4, wingZ, Math.PI / 2, 1.15, 1.95);

  // North landward facade (flanking entrance portico)
  for (const nx of [-4.2, 4.2]) {
    addCastleWindow(nx, 3.85, -keepD * 0.5 - 0.02, Math.PI, 1.25, 2.05);
    addCastleWindow(nx, 7.4, -keepD * 0.5 - 0.02, Math.PI, 1.25, 2.05);
  }
  addCastleWindow(0, 7.55, -keepD * 0.5 - 0.02, Math.PI, 1.65, 2.2);

  // East & West gable walls
  for (const ez of [-2.4, 2.1]) {
    addCastleWindow(keepW * 0.5 + 0.02, 3.85, ez, Math.PI / 2, 1.2, 2.0);
    addCastleWindow(keepW * 0.5 + 0.02, 7.4, ez, Math.PI / 2, 1.2, 2.0);
  }
  addCastleWindow(keepW * 0.5 + 0.02, 11.9, 0, Math.PI / 2, 1.1, 1.65);

  addCastleWindow(-keepW * 0.5 - 0.02, 3.85, -1.8, -Math.PI / 2, 1.25, 2.0);
  addCastleWindow(-keepW * 0.5 - 0.02, 7.4, -1.8, -Math.PI / 2, 1.25, 2.0);
  addCastleWindow(-keepW * 0.5 - 0.02, 11.9, 0, -Math.PI / 2, 1.1, 1.65);

  // --------------------------------------------------------------------------
  // 4. Grand Arched Stone Entrance Portico & Double Stone Staircase (North side)
  // --------------------------------------------------------------------------
  const porticoZ = -keepD * 0.5 - 1.5;
  const porticoDeckY = 1.8;

  // Grounded granite portico podium
  const podiumH = porticoDeckY + 2.2;
  const porticoPodium = new THREE.Mesh(
    createScaledBox(5.2, podiumH, 3.2, 2.4, 2.2),
    mats.granite
  );
  porticoPodium.position.set(0, -2.2 + podiumH * 0.5, porticoZ);
  castle.add(porticoPodium);

  // Portico flagstone floor slab
  const porticoFloor = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.16, 3.4),
    mats.carvedLimestone
  );
  porticoFloor.position.set(0, porticoDeckY + 0.05, porticoZ);
  castle.add(porticoFloor);

  // Four classical Greek/Romanesque stone columns supporting portico canopy
  const colPositions: [number, number][] = [
    [-2.15, porticoZ - 1.25],
    [-1.45, porticoZ - 1.25],
    [1.45, porticoZ - 1.25],
    [2.15, porticoZ - 1.25],
  ];
  for (const [colX, colZ] of colPositions) {
    const colBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.35, 0.46),
      mats.carvedLimestone
    );
    colBase.position.set(colX, porticoDeckY + 0.28, colZ);
    const colShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 2.85, 10),
      mats.carvedLimestone
    );
    colShaft.position.set(colX, porticoDeckY + 1.85, colZ);
    const colCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.24, 0.44),
      mats.carvedLimestone
    );
    colCap.position.set(colX, porticoDeckY + 3.35, colZ);
    castle.add(colBase, colShaft, colCap);
  }

  // Portico stone architrave, balcony deck & carved balustrade above
  const porticoRoof = new THREE.Mesh(
    createScaledBox(5.4, 0.52, 3.3, 2.4, 1.5),
    mats.carvedLimestone
  );
  porticoRoof.position.set(0, porticoDeckY + 3.7, porticoZ);
  castle.add(porticoRoof);

  // Semicircular decorative stone voussoir arch between inner columns
  const archSpan = 2.9;
  const archSegs = 9;
  for (let i = 0; i < archSegs; i++) {
    const ang = (i / (archSegs - 1)) * Math.PI;
    const voussoir = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.4, 0.42),
      mats.granite
    );
    voussoir.position.set(
      Math.cos(ang) * (archSpan * 0.48),
      porticoDeckY + 2.55 + Math.sin(ang) * 0.92,
      porticoZ - 1.25
    );
    voussoir.rotation.z = ang - Math.PI / 2;
    castle.add(voussoir);
  }

  // Upper portico terrace stone balustrade
  const addBalustradeRun = (
    parent: THREE.Object3D,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    yFloor: number
  ) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const run = new THREE.Group();
    run.position.set((ax + bx) * 0.5, yFloor, (az + bz) * 0.5);
    run.rotation.y = ang;

    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, len), mats.carvedLimestone);
    botRail.position.y = 0.08;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, len), mats.carvedLimestone);
    topRail.position.y = 0.96;
    run.add(botRail, topRail);

    const bCount = Math.max(2, Math.floor(len / 0.46));
    const balGeom = new THREE.CylinderGeometry(0.065, 0.085, 0.78, 7);
    for (let i = 0; i < bCount; i++) {
      const bzOff = -len * 0.5 + 0.25 + (i / Math.max(1, bCount - 1)) * (len - 0.5);
      const bal = new THREE.Mesh(balGeom, mats.carvedLimestone);
      bal.position.set(0, 0.52, bzOff);
      run.add(bal);
    }
    parent.add(run);
  };

  const upperBalY = porticoDeckY + 3.96;
  addBalustradeRun(castle, -2.55, porticoZ - 1.45, 2.55, porticoZ - 1.45, upperBalY);
  addBalustradeRun(castle, -2.55, porticoZ - 1.45, -2.55, porticoZ + 1.45, upperBalY);
  addBalustradeRun(castle, 2.55, porticoZ - 1.45, 2.55, porticoZ + 1.45, upperBalY);

  // Double symmetrical stone entrance staircase ascending east & west into portico
  const stepCount = 9;
  for (const side of [-1, 1]) {
    for (let s = 0; s < stepCount; s++) {
      const frac = s / stepCount;
      const sy = (s + 1) * (porticoDeckY / stepCount);
      const sx = side * (2.6 + (stepCount - 1 - s) * 0.34);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, sy + 0.6, 2.2),
        mats.granite
      );
      step.position.set(sx, (sy - 0.6) * 0.5, porticoZ - 0.15);
      castle.add(step);

      // Sloped stone stair cheek handrail block
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.72, 0.28),
        mats.carvedLimestone
      );
      cheek.position.set(sx, sy + 0.32, porticoZ - 1.22);
      castle.add(cheek);
      void frac;
    }
  }

  // Grand arched carved oak entrance door + twin warm wall lanterns
  const doorArch = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 3.2, 0.32),
    mats.carvedLimestone
  );
  doorArch.position.set(0, porticoDeckY + 1.65, -keepD * 0.5 - 0.08);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.85, 0.14), mats.timberDoor);
  doorPanel.position.set(0, porticoDeckY + 1.5, -keepD * 0.5 - 0.22);
  castle.add(doorArch, doorPanel);

  for (const lx of [-1.55, 1.55]) {
    const lantern = createLantern(mats, 'hex', lx < 0, 2.8, 12);
    lantern.position.set(lx, porticoDeckY + 2.35, -keepD * 0.5 - 0.36);
    castle.add(lantern);
  }

  // --------------------------------------------------------------------------
  // 5. Seaward Stone Balustrade Observation Terrace (觀海露台)
  // --------------------------------------------------------------------------
  const terrMinX = -3.1;
  const terrMaxX = 7.2;
  const terrMinZ = 4.5;
  const terrMaxZ = 9.0;
  const terrDeckY = 1.65;
  const terrW = terrMaxX - terrMinX;
  const terrD = terrMaxZ - terrMinZ;
  const terrCX = (terrMinX + terrMaxX) * 0.5;
  const terrCZ = (terrMinZ + terrMaxZ) * 0.5;

  // Heavy vaulted granite terrace retaining podium embedded deep into the sea cliff
  const terrPodiumH = terrDeckY + plinthEmbed + 0.5;
  const terrBase = new THREE.Mesh(
    createScaledBox(terrW, terrPodiumH, terrD, 2.8, 2.4),
    mats.granite
  );
  terrBase.position.set(terrCX, -plinthEmbed - 0.5 + terrPodiumH * 0.5, terrCZ);
  castle.add(terrBase);

  // Flagstone terrace walking surface
  const terrFloor = new THREE.Mesh(
    createScaledBox(terrW + 0.24, 0.18, terrD + 0.24, 2.2, 2.2),
    mats.flagstonePath
  );
  terrFloor.position.set(terrCX, terrDeckY + 0.06, terrCZ);
  castle.add(terrFloor);

  // Buttress stone pilasters down the seaward cliff face
  for (let bx = terrMinX + 0.5; bx <= terrMaxX - 0.4; bx += 2.35) {
    const buttress = new THREE.Mesh(
      createScaledBox(0.58, terrPodiumH, 0.62, 2.0, 2.4),
      mats.granite
    );
    buttress.position.set(bx, -plinthEmbed - 0.5 + terrPodiumH * 0.5, terrMaxZ + 0.2);
    castle.add(buttress);
  }

  // Classical carved stone balustrade overlooking the Yellow Sea & No. 2 Beach
  addBalustradeRun(castle, terrMinX + 0.2, terrMaxZ - 0.15, terrMaxX - 0.2, terrMaxZ - 0.15, terrDeckY + 0.14);
  addBalustradeRun(castle, terrMaxX - 0.15, terrMinZ + 0.4, terrMaxX - 0.15, terrMaxZ - 0.15, terrDeckY + 0.14);
  addBalustradeRun(castle, terrMinX + 0.15, terrMinZ + 1.4, terrMinX + 0.15, terrMaxZ - 0.15, terrDeckY + 0.14);

  // Corner stone pedestals with carved stone spheres & warm terrace pedestal lanterns
  const terracePedestals: [number, number, boolean][] = [
    [terrMinX + 0.2, terrMaxZ - 0.15, true],
    [terrCX, terrMaxZ - 0.15, false],
    [terrMaxX - 0.15, terrMaxZ - 0.15, true],
    [terrMaxX - 0.15, terrMinZ + 0.4, false],
  ];
  for (const [px, pz, withLantern] of terracePedestals) {
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.18, 0.56), mats.carvedLimestone);
    ped.position.set(px, terrDeckY + 0.72, pz);
    castle.add(ped);
    if (withLantern) {
      const lamp = createLantern(mats, 'globe', false);
      lamp.position.set(px, terrDeckY + 1.32, pz);
      castle.add(lamp);
    } else {
      const urn = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.carvedLimestone);
      urn.position.set(px, terrDeckY + 1.5, pz);
      castle.add(urn);
    }
  }

  // --------------------------------------------------------------------------
  // 6. Stone Courtyard Boundary Wall & Gothic Arched Entrance Gate
  //    Aligned cleanly to meet the cobblestone approach road at (31.5, 45) / (28, 44)
  // --------------------------------------------------------------------------
  const gateCenterX = 30.2;
  const gateCenterZ = 44.6;
  const gateFacingAngle = Math.atan2(24 - gateCenterX, 34 - gateCenterZ); // points toward Huanghai Rd approach
  const gateY = ctx.getTerrainHeight(gateCenterX, gateCenterZ);

  const gateGroup = new THREE.Group();
  gateGroup.position.set(gateCenterX, gateY, gateCenterZ);
  gateGroup.rotation.y = gateFacingAngle;
  root.add(gateGroup);

  const gateClearHalfW = 1.95; // 3.9m clear walkable gate width!
  for (const side of [-1, 1]) {
    const pierH = 4.2 + 2.2;
    const pier = new THREE.Mesh(
      createScaledBox(1.15, pierH, 1.15, 2.2, 2.2),
      mats.granite
    );
    pier.position.set(side * (gateClearHalfW + 0.58), -2.2 + pierH * 0.5, 0);
    gateGroup.add(pier);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.24, 1.38), mats.carvedLimestone);
    cap.position.set(side * (gateClearHalfW + 0.58), 4.26, 0);
    gateGroup.add(cap);

    // Gothic pyramid finial on gate pier
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), mats.carvedLimestone);
    finial.rotation.y = Math.PI / 4;
    finial.position.set(side * (gateClearHalfW + 0.58), 4.82, 0);
    gateGroup.add(finial);

    // Warm wrought-iron gate lantern
    const gl = createLantern(mats, 'hex', side === -1, 2.6, 12);
    gl.position.set(side * (gateClearHalfW + 0.58), 3.35, 0.68);
    gateGroup.add(gl);

    // Swung-open ornate wrought-iron gate leaf (tucked inward so walk path is 100% open)
    const leaf = new THREE.Group();
    leaf.position.set(side * gateClearHalfW, 0, -0.1);
    leaf.rotation.y = side * -1.32;
    const leafFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.35, 0.06), mats.wroughtIron);
    leafFrame.visible = false;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.07), mats.wroughtIron);
    topBar.position.set(-side * 0.82, 2.35, 0);
    const botBar = topBar.clone();
    botBar.position.y = 0.28;
    leaf.add(leafFrame, topBar, botBar);
    for (let bi = 0; bi < 7; bi++) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 2.25, 5),
        mats.wroughtIron
      );
      bar.position.set(-side * (0.14 + bi * 0.23), 1.32, 0);
      leaf.add(bar);
    }
    gateGroup.add(leaf);
  }

  // Pointed Gothic stone arch lintel spanning above the entrance gate (4.0m+ headroom)
  for (const side of [-1, 1]) {
    const archLeg = new THREE.Mesh(
      createScaledBox(2.55, 0.68, 0.92, 2.2, 1.8),
      mats.granite
    );
    archLeg.position.set(side * 1.15, 4.48, 0);
    archLeg.rotation.z = -side * 0.34;
    gateGroup.add(archLeg);
  }
  const archKeystone = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.9, 1.05),
    mats.carvedLimestone
  );
  archKeystone.position.set(0, 4.86, 0);
  gateGroup.add(archKeystone);

  // Classic heritage bronze plaque mounted on the front pier facing the approach road
  const plaque = createPlaqueMesh('花石樓', '黃海路18號 · 1930', 1.25, 0.48, 'bronze');
  plaque.position.set(gateClearHalfW + 0.58, 1.95, 0.62);
  gateGroup.add(plaque);

  // Compute world endpoints of left & right gate piers to attach stone courtyard walls seamlessly
  const gxL = gateCenterX - Math.cos(gateFacingAngle) * (gateClearHalfW + 0.8);
  const gzL = gateCenterZ + Math.sin(gateFacingAngle) * (gateClearHalfW + 0.8);
  const gxR = gateCenterX + Math.cos(gateFacingAngle) * (gateClearHalfW + 0.8);
  const gzR = gateCenterZ - Math.sin(gateFacingAngle) * (gateClearHalfW + 0.8);

  // Scenic curved perimeter stone boundary wall along the north/east/west plateau rim
  const westWallPts: [number, number][] = [
    [gxR, gzR],
    [22.5, 48.2],
    [20.6, 55.2],
    [22.4, 62.0],
  ];
  const eastWallPts: [number, number][] = [
    [gxL, gzL],
    [39.8, 43.8],
    [45.8, 49.4],
    [46.8, 57.2],
    [43.8, 63.6],
  ];
  for (const poly of [westWallPts, eastWallPts]) {
    const isWestSeaward = poly === westWallPts;
    for (let i = 0; i < poly.length - 1; i++) {
      root.add(
        createGraniteWallRun(ctx, mats, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1], {
          stoneHeight: isWestSeaward ? 1.15 : 1.5,
          thickness: 0.48,
          topFence: 'none',
          pierSpacing: 5.5,
          endPiers: i === poly.length - 2,
          embedDepth: 2.8,
          wallMat: mats.granite,
          colliders,
        })
      );
    }
  }

  // Flagstone approach apron inside the Gothic gate leading to the entrance portico
  const porticoApproachWorld = localToWorldXZ(cx, cz, rotY, 0, -7.8);
  const courtyardPath = createTerrainConformingPath(
    ctx,
    [
      [gateCenterX, gateCenterZ],
      [(gateCenterX + porticoApproachWorld[0]) * 0.5, (gateCenterZ + porticoApproachWorld[1]) * 0.5],
      porticoApproachWorld,
    ],
    3.4,
    mats.flagstonePath,
    0.055,
    2.4
  );
  root.add(courtyardPath);

  // --------------------------------------------------------------------------
  // 7. Accurate Colliders for Main Castle, Watchtower, Terrace & Gate Piers
  //    (Leaving gate opening & courtyard walkway freely explorable)
  // --------------------------------------------------------------------------
  const addLocalCylinderCollider = (lx: number, lz: number, radius: number) => {
    const [wx, wz] = localToWorldXZ(cx, cz, rotY, lx, lz);
    colliders.push({ type: 'cylinder', x: wx, z: wz, radius });
  };

  // Tight overlapping cylinder coverage for the rotated castle keep + wing + terrace
  addLocalCylinderCollider(-3.2, -1.6, 3.6);
  addLocalCylinderCollider(0.2, -1.6, 3.6);
  addLocalCylinderCollider(3.4, -1.6, 3.6);
  addLocalCylinderCollider(-2.2, 2.2, 3.6);
  addLocalCylinderCollider(1.8, 2.6, 3.8);
  addLocalCylinderCollider(3.8, 4.2, 3.4);
  // Watchtower seaward corner
  addLocalCylinderCollider(towerX, towerZ, towerR + 0.55);
  // Seaward terrace outer edge
  addLocalCylinderCollider(-1.2, 7.2, 2.3);
  addLocalCylinderCollider(2.2, 7.2, 2.4);
  addLocalCylinderCollider(5.4, 7.0, 2.4);
  // Portico columns
  addLocalCylinderCollider(0, porticoZ, 2.5);
  // Left & right gate piers (leaving 3.9m center gate completely open)
  colliders.push({ type: 'cylinder', x: gxL, z: gzL, radius: 0.78 });
  colliders.push({ type: 'cylinder', x: gxR, z: gzR, radius: 0.78 });

  setShadows(root, true, true);
  // Keep flat ground path from self-shadow acne
  courtyardPath.castShadow = false;

  return { group: root, colliders };
}
