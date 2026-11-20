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
  createScaledBox,
  createTerrainConformingPath,
  createTurretRoof,
  createWindowUnit,
  setShadows,
} from './villaTextures';

/**
 * Builds the 4 neighboring historic Badaguan block villas (NW, NE, SW, SE)
 * plus 22 lighter-weight stylized red-roofed villas nestled into the distant
 * northern & east/west coastal hills to complete Qingdao's "紅瓦綠樹" skyline!
 */
export function buildDistrictVillas(
  ctx: WorldContext,
  mats: VillaMaterialLibrary
): VillaBuildOutput {
  const root = new THREE.Group();
  root.name = 'DistrictVillas';
  const colliders: Collider[] = [];

  // --------------------------------------------------------------------------
  // 1. NW Block (-56, -49), courtyard x: [-74, -34], z: [-66, -32.5]
  //    German-Japanese Eclectic Timber-and-Stucco Villa (Cream + Walnut Half-Timber)
  // --------------------------------------------------------------------------
  buildNWBlockVilla(ctx, mats, root, colliders);

  // --------------------------------------------------------------------------
  // 2. NE Block (52, -49), courtyard x: [32, 72], z: [-66, -32.5]
  //    German Red-Brick & Stone Manor Villa (Octagonal Turret + Stepped Gable)
  // --------------------------------------------------------------------------
  buildNEBlockVilla(ctx, mats, root, colliders);

  // --------------------------------------------------------------------------
  // 3. SW Block (-56, 1), courtyard x: [-74, -34], z: [-15.5, 18]
  //    Coastal Mediterranean-German Sunroom Villa (Peach Stucco + Arched Loggia)
  // --------------------------------------------------------------------------
  buildSWBlockVilla(ctx, mats, root, colliders);

  // --------------------------------------------------------------------------
  // 4. SE Block (52, 1), courtyard x: [32, 72], z: [-15.5, 18]
  //    Stone & Olive-Shutter Villa (Granite Lower + Ivory Upper + Iron Balcony)
  // --------------------------------------------------------------------------
  buildSEBlockVilla(ctx, mats, root, colliders);

  // --------------------------------------------------------------------------
  // 5. Distant Badaguan Red-Roofed Backdrop ("紅瓦綠樹" Hillside Sea of Villas)
  // --------------------------------------------------------------------------
  buildDistantHillsideVillas(ctx, mats, root);

  return { group: root, colliders };
}

function buildNWBlockVilla(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  root: THREE.Group,
  colliders: Collider[]
): void {
  const cx = -56;
  const cz = -49;
  const baseY = ctx.getTerrainHeight(cx, cz);
  const g = new THREE.Group();
  g.position.set(cx, baseY, cz);
  root.add(g);

  const plinthEmbed = 2.4;
  const plinthAbove = 1.4;
  const plinthH = plinthAbove + plinthEmbed;
  const w = 15.2;
  const d = 10.6;
  const wallH = 6.2;
  const eaveY = plinthAbove + wallH;

  // Grounded granite mushroom-stone plinth
  const plinth = new THREE.Mesh(
    createScaledBox(w + 0.55, plinthH, d + 0.55, 2.8, 2.2),
    mats.granite
  );
  plinth.position.y = -plinthEmbed + plinthH * 0.5;
  g.add(plinth);

  // Cream stucco 2-story body
  const body = new THREE.Mesh(createScaledBox(w, wallH, d, 3.6, 3.4), mats.creamStucco);
  body.position.y = plinthAbove + wallH * 0.5;
  g.add(body);

  // Classic German-Japanese dark walnut half-timber beams on upper story & corners
  const midY = plinthAbove + 3.05;
  for (const ty of [midY, eaveY - 0.14]) {
    const girt = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.18, 0.18, d + 0.18),
      mats.walnutTimber
    );
    girt.position.y = ty;
    g.add(girt);
  }
  for (const vx of [-w * 0.5, -3.8, 0, 3.8, w * 0.5]) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, wallH - 2.9, 0.16),
        mats.walnutTimber
      );
      post.position.set(vx, midY + (wallH - 3.05) * 0.5, side * (d * 0.5 + 0.04));
      g.add(post);
    }
  }
  // Diagonal half-timber X braces along the upper south facade
  for (const bx of [-5.7, 5.7]) {
    for (const tilt of [-0.55, 0.55]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.13, 3.2, 0.12), mats.walnutTimber);
      brace.position.set(bx, midY + 1.55, d * 0.5 + 0.05);
      brace.rotation.z = tilt;
      g.add(brace);
    }
  }

  // Sweeping red terracotta hipped roof + projecting front half-timbered cross-gable
  const hipRoof = createHippedRoof({
    width: w,
    depth: d,
    height: 4.75,
    overhang: 0.95,
    roofMat: mats.deepRedRoof,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  hipRoof.position.y = eaveY;
  g.add(hipRoof);

  const crossGable = createGableRoof({
    width: 6.0,
    depth: 5.2,
    ridgeHeight: 3.4,
    overhangEave: 0.55,
    overhangGable: 0.55,
    ridgeAlong: 'z',
    roofMat: mats.deepRedRoof,
    gableWallMat: mats.creamStucco,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.3,
  });
  crossGable.position.set(0, eaveY - 0.05, 3.4);
  g.add(crossGable);

  // Stone chimney
  const chim = new THREE.Mesh(createScaledBox(1.15, 4.6, 1.15, 2.0, 2.0), mats.granite);
  chim.position.set(-3.2, eaveY + 3.4, -1.5);
  g.add(chim);

  // Covered stone & walnut timber veranda facing SE toward Ginkgo/Maple intersection
  const verX = 4.6;
  const verZ = d * 0.5 + 1.7;
  const verPlinth = new THREE.Mesh(
    createScaledBox(5.6, plinthH, 3.4, 2.4, 2.0),
    mats.granite
  );
  verPlinth.position.set(verX, -plinthEmbed + plinthH * 0.5, verZ);
  g.add(verPlinth);
  for (const px of [-2.45, 0, 2.45]) {
    const vp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), mats.walnutTimber);
    vp.position.set(verX + px, plinthAbove + 1.45, verZ + 1.42);
    g.add(vp);
  }
  const verRoof = new THREE.Mesh(
    createScaledBox(6.4, 0.16, 3.9, 2.2, 2.2),
    mats.deepRedRoof
  );
  verRoof.position.set(verX, plinthAbove + 3.15, verZ + 0.15);
  verRoof.rotation.x = 0.26;
  g.add(verRoof);

  const verLamp = createLantern(mats, 'hex', false);
  verLamp.position.set(verX, plinthAbove + 2.55, verZ + 1.1);
  g.add(verLamp);

  // Mullioned warm windows on all 4 facades
  for (const wx of [-4.6, -1.6, 1.6, 4.6]) {
    const w1 = createWindowUnit({
      width: 1.35,
      height: 1.75,
      glassMat: wx < 0 ? mats.windowDarkWarm : mats.windowWhiteSoft,
      frameMat: mats.walnutTimber,
    });
    w1.position.set(wx, plinthAbove + 1.5, d * 0.5 + 0.02);
    const w2 = w1.clone();
    w2.position.y = plinthAbove + 4.55;
    g.add(w1, w2);

    const wBack = w1.clone();
    wBack.rotation.y = Math.PI;
    wBack.position.set(wx, plinthAbove + 4.55, -d * 0.5 - 0.02);
    g.add(wBack);
  }
  for (const side of [-1, 1]) {
    for (const wz of [-2.3, 2.3]) {
      const ws = createWindowUnit({
        width: 1.25,
        height: 1.75,
        glassMat: mats.windowDarkWarm,
        frameMat: mats.walnutTimber,
      });
      ws.position.set(side * (w * 0.5 + 0.02), plinthAbove + 4.55, wz);
      ws.rotation.y = side * (Math.PI / 2);
      g.add(ws);
    }
  }

  // Courtyard granite wall with open front gate along z = -32.5 (facing Juyongguan Rd)
  const wallOpts = {
    stoneHeight: 1.45,
    thickness: 0.42,
    topFence: 'none' as const,
    pierSpacing: 6.4,
    colliders,
  };
  root.add(createGraniteWallRun(ctx, mats, -74, -32.5, -58, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -54, -32.5, -34, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -34, -66, -34, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -74, -66, -74, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -74, -66, -34, -66, wallOpts));

  const path = createTerrainConformingPath(
    ctx,
    [
      [-56, -32.4],
      [-54.5, -36.5],
      [-51.8, -41.5],
    ],
    2.2,
    mats.gravelPath,
    0.045,
    2.2
  );
  root.add(path);

  colliders.push({
    type: 'box',
    minX: cx - w * 0.5 - 0.5,
    maxX: cx + w * 0.5 + 0.5,
    minZ: cz - d * 0.5 - 0.5,
    maxZ: cz + d * 0.5 + 3.4,
  });

  setShadows(g, true, true);
}

function buildNEBlockVilla(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  root: THREE.Group,
  colliders: Collider[]
): void {
  const cx = 52;
  const cz = -49;
  const baseY = ctx.getTerrainHeight(cx, cz);
  const g = new THREE.Group();
  g.position.set(cx, baseY, cz);
  root.add(g);

  const plinthEmbed = 2.4;
  const plinthAbove = 1.65;
  const plinthH = plinthAbove + plinthEmbed;
  const w = 14.4;
  const d = 10.4;
  const wallH = 6.6;
  const eaveY = plinthAbove + wallH;

  // Heavy granite basement + warm German terracotta red-brick manor walls
  const plinth = new THREE.Mesh(
    createScaledBox(w + 0.6, plinthH, d + 0.6, 2.8, 2.2),
    mats.granite
  );
  plinth.position.y = -plinthEmbed + plinthH * 0.5;
  g.add(plinth);

  const body = new THREE.Mesh(createScaledBox(w, wallH, d, 3.0, 2.8), mats.redBrick);
  body.position.y = plinthAbove + wallH * 0.5;
  g.add(body);

  // Limestone stringcourses & corner stone quoins
  for (const sy of [plinthAbove + 0.05, plinthAbove + 3.35, eaveY - 0.1]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.28, 0.2, d + 0.28),
      mats.carvedLimestone
    );
    band.position.y = sy;
    g.add(band);
  }

  // Steep terracotta red roof + projecting south stepped brick gable
  const mainRoof = createGableRoof({
    width: w,
    depth: d,
    ridgeHeight: 5.2,
    overhangEave: 0.55,
    overhangGable: 0.35,
    ridgeAlong: 'x',
    roofMat: mats.redRoof,
    gableWallMat: mats.redBrick,
    trimMat: mats.carvedLimestone,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  mainRoof.position.y = eaveY - 0.05;
  g.add(mainRoof);

  // Projecting south stepped German gable wing
  const wingW = 5.4;
  const wingD = 2.8;
  const wingZ = d * 0.5 + wingD * 0.5 - 0.3;
  const wingPlinth = new THREE.Mesh(
    createScaledBox(wingW + 0.4, plinthH, wingD + 0.4, 2.4, 2.0),
    mats.granite
  );
  wingPlinth.position.set(2.0, -plinthEmbed + plinthH * 0.5, wingZ);
  const wingBody = new THREE.Mesh(
    createScaledBox(wingW, wallH, wingD, 3.0, 2.8),
    mats.redBrick
  );
  wingBody.position.set(2.0, plinthAbove + wallH * 0.5, wingZ);
  g.add(wingPlinth, wingBody);

  const wingRoof = createGableRoof({
    width: wingW,
    depth: wingD + 2.6,
    ridgeHeight: 3.85,
    overhangEave: 0.45,
    overhangGable: 0.25,
    ridgeAlong: 'z',
    roofMat: mats.redRoof,
    gableWallMat: mats.redBrick,
    trimMat: mats.carvedLimestone,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.4,
  });
  wingRoof.position.set(2.0, eaveY - 0.05, wingZ - 1.2);
  g.add(wingRoof);

  // Stepped brick parapet crowning the front gable face
  for (let s = 0; s < 5; s++) {
    const frac = s / 4;
    const sw = (wingW + 0.3) * (1 - frac * 0.8);
    const sy = eaveY + 0.3 + frac * 3.65;
    const step = new THREE.Mesh(createScaledBox(sw, 0.82, 0.38, 2.2, 2.0), mats.redBrick);
    step.position.set(2.0, sy, wingZ + wingD * 0.5 + 0.04);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.1, 0.12, 0.46), mats.carvedLimestone);
    cap.position.set(2.0, sy + 0.45, wingZ + wingD * 0.5 + 0.04);
    g.add(step, cap);
  }

  // Corner octagonal dormer turret on SW corner (facing Juyongguan & Huanghai intersection!)
  const turX = -w * 0.5 + 0.45;
  const turZ = d * 0.5 - 0.45;
  const turR = 2.15;
  const turBase = new THREE.Mesh(
    new THREE.CylinderGeometry(turR + 0.16, turR + 0.24, plinthH, 8),
    mats.granite
  );
  turBase.position.set(turX, -plinthEmbed + plinthH * 0.5, turZ);
  const turShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(turR, turR, wallH + 2.2, 8),
    mats.redBrick
  );
  turShaft.position.set(turX, plinthAbove + (wallH + 2.2) * 0.5, turZ);
  const turRoof = createTurretRoof({
    radius: turR + 0.4,
    height: 4.8,
    segments: 8,
    roofMat: mats.deepRedRoof,
    trimMat: mats.carvedLimestone,
    finialMat: mats.weatheredCopper,
  });
  turRoof.position.set(turX, eaveY + 2.15, turZ);
  g.add(turBase, turShaft, turRoof);

  // Glowing turret & manor windows
  for (const ang of [0.35, -0.5, -1.35, -2.2]) {
    for (const wy of [plinthAbove + 1.65, plinthAbove + 4.95, eaveY + 1.0]) {
      const tw = createWindowUnit({
        width: 0.85,
        height: 1.55,
        glassMat: mats.windowWhiteWarm,
        frameMat: mats.carvedLimestone,
      });
      tw.position.set(
        turX + Math.sin(ang) * (turR - 0.04),
        wy,
        turZ + Math.cos(ang) * (turR - 0.04)
      );
      tw.rotation.y = ang;
      g.add(tw);
    }
  }
  for (const wx of [0.7, 3.3]) {
    for (const wy of [plinthAbove + 1.65, plinthAbove + 4.95]) {
      const mw = createWindowUnit({
        width: 1.25,
        height: 1.85,
        glassMat: mats.windowWhiteWarm,
        frameMat: mats.carvedLimestone,
        archedTop: true,
      });
      mw.position.set(wx, wy, wingZ + wingD * 0.5 + 0.02);
      g.add(mw);
    }
  }
  for (const wz of [-2.2, 1.5]) {
    const ww = createWindowUnit({
      width: 1.25,
      height: 1.85,
      glassMat: mats.windowWhiteSoft,
      frameMat: mats.carvedLimestone,
    });
    ww.position.set(-w * 0.5 - 0.02, plinthAbove + 4.95, wz);
    ww.rotation.y = -Math.PI / 2;
    g.add(ww);
  }

  // Stone courtyard wall with wrought-iron top & open front gate along z = -32.5
  const wallOpts = {
    stoneHeight: 1.35,
    thickness: 0.44,
    topFence: 'iron' as const,
    fenceHeight: 0.72,
    pierSpacing: 6.4,
    colliders,
  };
  root.add(createGraniteWallRun(ctx, mats, 32, -32.5, 50, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 54, -32.5, 72, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 32, -66, 32, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 72, -66, 72, -32.5, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 32, -66, 72, -66, wallOpts));

  colliders.push(
    {
      type: 'box',
      minX: cx - w * 0.5 - 0.5,
      maxX: cx + w * 0.5 + 0.5,
      minZ: cz - d * 0.5 - 0.5,
      maxZ: cz + d * 0.5 + 2.8,
    },
    { type: 'cylinder', x: cx + turX, z: cz + turZ, radius: turR + 0.4 }
  );

  setShadows(g, true, true);
}

function buildSWBlockVilla(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  root: THREE.Group,
  colliders: Collider[]
): void {
  const cx = -56;
  const cz = 1;
  const baseY = ctx.getTerrainHeight(cx, cz);
  const g = new THREE.Group();
  g.position.set(cx, baseY, cz);
  root.add(g);

  const plinthEmbed = 2.4;
  const plinthAbove = 1.45;
  const plinthH = plinthAbove + plinthEmbed;
  const w = 15.6;
  const d = 10.0;
  const wallH = 6.1;
  const eaveY = plinthAbove + wallH;

  // Grounded granite coastal terrace plinth
  const plinth = new THREE.Mesh(
    createScaledBox(w + 0.6, plinthH, d + 3.4, 2.8, 2.2),
    mats.granite
  );
  plinth.position.set(0, -plinthEmbed + plinthH * 0.5, 1.35);
  g.add(plinth);

  // Warm peach-apricot Mediterranean stucco main body
  const body = new THREE.Mesh(createScaledBox(w, wallH, d, 3.6, 3.4), mats.peachStucco);
  body.position.y = plinthAbove + wallH * 0.5;
  g.add(body);

  // Graceful 4-bay arched seaward loggia colonnade along the south facade overlooking No. 2 Beach!
  const loggiaZ = d * 0.5 + 2.55;
  const colXs = [-6.2, -3.1, 0, 3.1, 6.2];
  for (const lx of colXs) {
    const colBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), mats.carvedLimestone);
    colBase.position.set(lx, plinthAbove + 0.15, loggiaZ);
    const colShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.19, 2.75, 10),
      mats.creamStucco
    );
    colShaft.position.set(lx, plinthAbove + 1.65, loggiaZ);
    const colCap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42), mats.carvedLimestone);
    colCap.position.set(lx, plinthAbove + 3.05, loggiaZ);
    g.add(colBase, colShaft, colCap);
  }

  // Arched spandrel lintel beam & second-floor sunny terrace balustrade above the loggia
  const loggiaDeck = new THREE.Mesh(
    createScaledBox(w - 1.6, 0.48, 3.1, 3.0, 1.5),
    mats.peachStucco
  );
  loggiaDeck.position.set(0, plinthAbove + 3.38, d * 0.5 + 1.35);
  g.add(loggiaDeck);

  // Subtle decorative arch spandrel caps between columns
  for (let i = 0; i < colXs.length - 1; i++) {
    const mx = (colXs[i] + colXs[i + 1]) * 0.5;
    const archCap = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.15, 6, 12, Math.PI),
      mats.creamStucco
    );
    archCap.position.set(mx, plinthAbove + 2.35, loggiaZ);
    g.add(archCap);
  }

  // Wrought-iron railing on the sunny second-floor sea-view terrace
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(w - 2.4, 0.055, 0.055), mats.wroughtIron);
  railTop.position.set(0, plinthAbove + 4.48, loggiaZ + 0.15);
  g.add(railTop);
  for (let bx = -6.2; bx <= 6.2; bx += 0.35) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.88, 5), mats.wroughtIron);
    bar.position.set(bx, plinthAbove + 4.02, loggiaZ + 0.15);
    g.add(bar);
  }

  // Medium-pitched red barrel-tile hipped roof + dormers + chimney
  const roof = createHippedRoof({
    width: w,
    depth: d,
    height: 3.9,
    overhang: 0.88,
    roofMat: mats.redRoof,
    trimMat: mats.walnutTimber,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  roof.position.y = eaveY;
  g.add(roof);

  const dorm = createDormerUnit({
    width: 1.9,
    height: 1.55,
    depth: 2.1,
    wallMat: mats.peachStucco,
    roofMat: mats.redRoof,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    glassMat: mats.windowWhiteWarm,
  });
  dorm.position.set(0, eaveY + 0.75, 3.85);
  g.add(dorm);

  // Shuttered coastal windows facing South & East (Jiayuguan Ave + Beach)
  for (const wx of [-4.6, -1.55, 1.55, 4.6]) {
    const wLow = createWindowUnit({
      width: 1.35,
      height: 2.05,
      glassMat: mats.windowDarkWarm,
      frameMat: mats.creamStucco,
      shutterMat: mats.greenShutter,
      archedTop: true,
    });
    wLow.position.set(wx, plinthAbove + 1.55, d * 0.5 + 0.02);
    const wHi = createWindowUnit({
      width: 1.32,
      height: 1.85,
      glassMat: wx > 0 ? mats.windowDarkWarm : mats.windowWhiteSoft,
      frameMat: mats.creamStucco,
      shutterMat: mats.greenShutter,
      archedTop: true,
    });
    wHi.position.set(wx, plinthAbove + 4.6, d * 0.5 + 0.02);
    g.add(wLow, wHi);
  }
  for (const wz of [-2.3, 2.3]) {
    const we = createWindowUnit({
      width: 1.28,
      height: 1.8,
      glassMat: mats.windowDarkWarm,
      frameMat: mats.creamStucco,
      shutterMat: mats.greenShutter,
    });
    we.position.set(w * 0.5 + 0.02, plinthAbove + 4.6, wz);
    we.rotation.y = Math.PI / 2;
    g.add(we);
  }

  // Granite terrace courtyard wall around x: [-74, -34], z: [-15.5, 18]
  const wallOpts = {
    stoneHeight: 1.35,
    thickness: 0.42,
    topFence: 'none' as const,
    pierSpacing: 6.4,
    colliders,
  };
  root.add(createGraniteWallRun(ctx, mats, -74, 18, -58, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -54, 18, -34, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -34, -15.5, -34, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -74, -15.5, -74, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, -74, -15.5, -34, -15.5, wallOpts));

  colliders.push({
    type: 'box',
    minX: cx - w * 0.5 - 0.5,
    maxX: cx + w * 0.5 + 0.5,
    minZ: cz - d * 0.5 - 0.5,
    maxZ: cz + loggiaZ + 0.6,
  });

  setShadows(g, true, true);
}

function buildSEBlockVilla(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  root: THREE.Group,
  colliders: Collider[]
): void {
  const cx = 52;
  const cz = 1;
  const baseY = ctx.getTerrainHeight(cx, cz);
  const g = new THREE.Group();
  g.position.set(cx, baseY, cz);
  root.add(g);

  const plinthEmbed = 2.4;
  const lowerH = 3.6;
  const upperH = 3.4;
  const eaveY = lowerH + upperH;
  const w = 13.8;
  const d = 10.2;

  // Heavy rusticated granite lower story (grounded 2.4m below terrain!)
  const lowerStory = new THREE.Mesh(
    createScaledBox(w + 0.35, lowerH + plinthEmbed, d + 0.35, 2.8, 2.4),
    mats.granite
  );
  lowerStory.position.y = -plinthEmbed + (lowerH + plinthEmbed) * 0.5;
  g.add(lowerStory);

  // Carved stone belt dividing stone ground story from pale ivory upper story
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.55, 0.24, d + 0.55),
    mats.carvedLimestone
  );
  belt.position.y = lowerH;
  g.add(belt);

  // Pale ivory stucco upper story
  const upperStory = new THREE.Mesh(
    createScaledBox(w, upperH, d, 3.6, 3.4),
    mats.ivoryStucco
  );
  upperStory.position.y = lowerH + upperH * 0.5;
  g.add(upperStory);

  // Steeply pitched terracotta-red cross-gable roof
  const mainRoof = createGableRoof({
    width: w,
    depth: d,
    ridgeHeight: 5.15,
    overhangEave: 0.62,
    overhangGable: 0.45,
    ridgeAlong: 'x',
    roofMat: mats.redRoof,
    gableWallMat: mats.ivoryStucco,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  mainRoof.position.y = eaveY - 0.04;
  g.add(mainRoof);

  const crossRoof = createGableRoof({
    width: 6.4,
    depth: d + 1.8,
    ridgeHeight: 4.55,
    overhangEave: 0.55,
    overhangGable: 0.45,
    ridgeAlong: 'z',
    roofMat: mats.redRoof,
    gableWallMat: mats.ivoryStucco,
    trimMat: mats.whiteTrim,
    ridgeMat: mats.terracottaRidge,
    tileScale: 2.5,
  });
  crossRoof.position.set(-1.2, eaveY - 0.04, 0.2);
  g.add(crossRoof);

  // Tall granite chimney stack
  const chim = new THREE.Mesh(createScaledBox(1.2, 5.2, 1.2, 2.2, 2.2), mats.granite);
  chim.position.set(3.6, eaveY + 3.4, -1.2);
  g.add(chim);

  // Wrought-iron second-floor balcony facing west toward Huanghai Rd & Huashilou approach
  const balSlab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 4.6), mats.carvedLimestone);
  balSlab.position.set(-w * 0.5 - 0.72, lowerH + 0.08, 0);
  g.add(balSlab);
  const railW = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 4.5), mats.wroughtIron);
  railW.position.set(-w * 0.5 - 1.44, lowerH + 1.06, 0);
  g.add(railW);
  for (let bz = -2.15; bz <= 2.15; bz += 0.32) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.88, 5), mats.wroughtIron);
    bar.position.set(-w * 0.5 - 1.44, lowerH + 0.62, bz);
    g.add(bar);
  }

  // Olive-shuttered warm windows across facades
  const addOliveWin = (lx: number, ly: number, lz: number, ry: number, soft = false) => {
    const wUnit = createWindowUnit({
      width: 1.28,
      height: 1.78,
      glassMat: soft ? mats.windowWhiteSoft : mats.windowWhiteWarm,
      frameMat: mats.whiteTrim,
      shutterMat: mats.oliveShutter,
    });
    wUnit.position.set(lx, ly, lz);
    wUnit.rotation.y = ry;
    g.add(wUnit);
  };

  for (const wx of [-4.2, -1.2, 2.4, 4.8]) {
    addOliveWin(wx, 2.1, d * 0.5 + 0.18, 0, wx > 0);
    addOliveWin(wx, lowerH + 1.75, d * 0.5 + 0.02, 0, wx < -2);
    addOliveWin(wx, lowerH + 1.75, -d * 0.5 - 0.02, Math.PI, true);
  }
  for (const wz of [-2.4, 0, 2.4]) {
    addOliveWin(-w * 0.5 - 0.02, lowerH + 1.75, wz, -Math.PI / 2, wz < 0);
  }
  addOliveWin(-1.2, eaveY + 1.75, d * 0.5 + 0.85, 0, false);

  // Rusticated stone & iron courtyard boundary wall around x: [32, 72], z: [-15.5, 18]
  const wallOpts = {
    stoneHeight: 1.4,
    thickness: 0.44,
    topFence: 'iron' as const,
    fenceHeight: 0.72,
    pierSpacing: 6.4,
    colliders,
  };
  root.add(createGraniteWallRun(ctx, mats, 32, 18, 50, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 54, 18, 72, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 32, -15.5, 32, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 72, -15.5, 72, 18, wallOpts));
  root.add(createGraniteWallRun(ctx, mats, 32, -15.5, 72, -15.5, wallOpts));

  colliders.push({
    type: 'box',
    minX: cx - w * 0.5 - 1.5,
    maxX: cx + w * 0.5 + 0.5,
    minZ: cz - d * 0.5 - 0.5,
    maxZ: cz + d * 0.5 + 0.5,
  });

  setShadows(g, true, true);
}

/**
 * 22 Stylized Red-Roofed Backdrop Villas terraced into the northern & east/west
 * green Taiping Mountain hills (z < -76 or |x| > 82) for Qingdao's iconic "紅瓦綠樹" skyline!
 */
function buildDistantHillsideVillas(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  root: THREE.Group
): void {
  const backdropGroup = new THREE.Group();
  backdropGroup.name = 'DistantRedRoofSkyline';
  root.add(backdropGroup);

  const wallPalette = [
    mats.creamStucco,
    mats.butterflyOchre,
    mats.ivoryStucco,
    mats.peachStucco,
    mats.redBrick,
    mats.princessBlue,
  ];
  const roofPalette = [mats.redRoof, mats.deepRedRoof];

  // Curated placements well outside avenues & courtyards, nestled into the green hills
  const specs: {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    rotY: number;
    wallIdx: number;
    roofIdx: number;
    hipped: boolean;
    turret?: boolean;
  }[] = [
    // Northern green hillside tiers (z < -78)
    { x: -94, z: -86, w: 12, d: 9, h: 6.2, rotY: 0.22, wallIdx: 0, roofIdx: 0, hipped: false },
    { x: -66, z: -88, w: 13.5, d: 9.5, h: 6.6, rotY: -0.15, wallIdx: 1, roofIdx: 1, hipped: true },
    { x: -38, z: -86, w: 11.5, d: 8.8, h: 6.4, rotY: 0.1, wallIdx: 4, roofIdx: 0, hipped: false, turret: true },
    { x: -10, z: -88, w: 13, d: 9.2, h: 6.8, rotY: -0.08, wallIdx: 2, roofIdx: 0, hipped: false },
    { x: 18, z: -90, w: 12.5, d: 9.0, h: 6.5, rotY: 0.18, wallIdx: 3, roofIdx: 1, hipped: true },
    { x: 48, z: -88, w: 13.8, d: 9.4, h: 6.8, rotY: -0.14, wallIdx: 0, roofIdx: 0, hipped: false, turret: true },
    { x: 78, z: -86, w: 12, d: 8.8, h: 6.3, rotY: -0.25, wallIdx: 1, roofIdx: 1, hipped: true },
    { x: -82, z: -114, w: 14, d: 10, h: 7.2, rotY: 0.3, wallIdx: 2, roofIdx: 0, hipped: true },
    { x: -46, z: -116, w: 13, d: 9.5, h: 7.0, rotY: -0.12, wallIdx: 5, roofIdx: 0, hipped: false },
    { x: -12, z: -118, w: 14.5, d: 10, h: 7.4, rotY: 0.06, wallIdx: 4, roofIdx: 1, hipped: false, turret: true },
    { x: 24, z: -116, w: 13.2, d: 9.4, h: 7.0, rotY: -0.2, wallIdx: 1, roofIdx: 0, hipped: true },
    { x: 60, z: -115, w: 14, d: 9.8, h: 7.2, rotY: 0.14, wallIdx: 3, roofIdx: 1, hipped: false },
    { x: 96, z: -112, w: 12.8, d: 9.2, h: 6.8, rotY: -0.32, wallIdx: 0, roofIdx: 0, hipped: true },
    // Far Western hills (x < -86, staying clear of roads & sea)
    { x: -94, z: -52, w: 12.5, d: 9.2, h: 6.4, rotY: 0.18, wallIdx: 3, roofIdx: 0, hipped: true },
    { x: -96, z: -10, w: 12.2, d: 8.8, h: 6.2, rotY: -0.12, wallIdx: 0, roofIdx: 1, hipped: false },
    { x: -108, z: -32, w: 13.5, d: 9.5, h: 6.8, rotY: 0.28, wallIdx: 1, roofIdx: 0, hipped: false, turret: true },
    { x: -114, z: 6, w: 12.6, d: 9.0, h: 6.4, rotY: -0.22, wallIdx: 2, roofIdx: 1, hipped: true },
    // Far Eastern hills (x > 86, staying clear of roads & sea)
    { x: 94, z: -52, w: 13.0, d: 9.2, h: 6.6, rotY: -0.2, wallIdx: 4, roofIdx: 0, hipped: false },
    { x: 94, z: -6, w: 12.8, d: 9.0, h: 6.4, rotY: 0.15, wallIdx: 2, roofIdx: 1, hipped: true },
    { x: 108, z: -34, w: 13.6, d: 9.6, h: 7.0, rotY: -0.28, wallIdx: 1, roofIdx: 0, hipped: false, turret: true },
    { x: 112, z: 12, w: 12.2, d: 8.8, h: 6.2, rotY: 0.24, wallIdx: 3, roofIdx: 0, hipped: true },
    { x: 96, z: 16, w: 11.8, d: 8.6, h: 6.0, rotY: -0.16, wallIdx: 0, roofIdx: 1, hipped: false },
  ];

  const deepEmbed = 6.2; // Terraced deep into steep backdrop hillsides so ZERO floating!

  for (const s of specs) {
    const ty = ctx.getTerrainHeight(s.x, s.z);
    if (ty < 5.2) continue;

    const vg = new THREE.Group();
    vg.position.set(s.x, ty, s.z);
    vg.rotation.y = s.rotY;
    backdropGroup.add(vg);

    const wallMat = wallPalette[s.wallIdx % wallPalette.length];
    const roofMat = roofPalette[s.roofIdx % roofPalette.length];

    // Deep granite terrace foundation
    const baseH = 1.6 + deepEmbed;
    const base = new THREE.Mesh(
      createScaledBox(s.w + 0.5, baseH, s.d + 0.5, 3.2, 2.8),
      mats.granite
    );
    base.position.y = -deepEmbed + baseH * 0.5;
    vg.add(base);

    // Main villa mass
    const body = new THREE.Mesh(createScaledBox(s.w, s.h, s.d, 3.8, 3.6), wallMat);
    body.position.y = 1.5 + s.h * 0.5;
    vg.add(body);

    const eaveY = 1.5 + s.h;

    // Red terracotta roof (either hipped or steep cross-gabled)
    if (s.hipped) {
      const roof = createHippedRoof({
        width: s.w,
        depth: s.d,
        height: 4.1,
        overhang: 0.72,
        roofMat,
        trimMat: mats.whiteTrim,
        ridgeMat: mats.terracottaRidge,
        tileScale: 2.8,
      });
      roof.position.y = eaveY;
      vg.add(roof);
    } else {
      const roof = createGableRoof({
        width: s.w,
        depth: s.d,
        ridgeHeight: 4.5,
        overhangEave: 0.55,
        overhangGable: 0.45,
        ridgeAlong: 'x',
        roofMat,
        gableWallMat: wallMat,
        trimMat: mats.whiteTrim,
        ridgeMat: mats.terracottaRidge,
        tileScale: 2.8,
      });
      roof.position.y = eaveY - 0.04;
      vg.add(roof);
    }

    // Occasional corner turret for authentic Qingdao hillside skyline silhouettes
    if (s.turret) {
      const tur = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.85, s.h + 2.8, 8),
        wallMat
      );
      tur.position.set(-s.w * 0.45, 1.5 + (s.h + 2.8) * 0.5, s.d * 0.42);
      const tCap = createTurretRoof({
        radius: 2.15,
        height: 3.8,
        segments: 8,
        roofMat,
        trimMat: mats.whiteTrim,
        finialMat: mats.weatheredCopper,
      });
      tCap.position.set(-s.w * 0.45, eaveY + 2.75, s.d * 0.42);
      vg.add(tur, tCap);
    }

    // Chimney
    const chim = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.6, 1.0), mats.redBrick);
    chim.position.set(s.w * 0.22, eaveY + 2.6, -s.d * 0.14);
    vg.add(chim);

    // Lightweight glowing window panels on south & front-facing walls (for night/dusk ambiance!)
    const winGeom = new THREE.PlaneGeometry(1.3, 1.7);
    for (const wx of [-s.w * 0.28, 0, s.w * 0.28]) {
      for (const wy of [3.2, 5.8]) {
        const wf = new THREE.Mesh(
          winGeom,
          wx === 0 ? mats.windowWhiteWarm : mats.windowWhiteSoft
        );
        wf.position.set(wx, wy, s.d * 0.5 + 0.05);
        vg.add(wf);
      }
    }
    const sideW = new THREE.Mesh(winGeom, mats.windowWhiteWarm);
    sideW.position.set((s.x < 0 ? 1 : -1) * (s.w * 0.5 + 0.05), 5.6, 0);
    sideW.rotation.y = (s.x < 0 ? 1 : -1) * (Math.PI / 2);
    vg.add(sideW);
  }

  // Optimize shadow map performance on distant hillside backdrop villas
  setShadows(backdropGroup, false, true);
}
