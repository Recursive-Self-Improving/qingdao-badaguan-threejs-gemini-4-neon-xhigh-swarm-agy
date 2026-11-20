import * as THREE from 'three';
import { Collider, MoodConfig, WorldContext } from '../types';
import { getRoadDistance, isOnSidewalk } from '../terrainMath';
import {
  FoliageTextureSet,
  createDirectionalBoardTexture,
  createHeritagePlaqueTexture,
  createStreetSignTexture,
} from './foliageTextures';

export interface StreetPropsResult {
  group: THREE.Group;
  colliders: Collider[];
  update: (dt: number, elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
}

interface LampPlacement {
  x: number;
  z: number;
  rotY: number;
  heroLight?: boolean;
}

interface BenchPlacement {
  x: number;
  z: number;
  rotY: number; // Direction the bench faces (+Z in local space)
  withGinkgoLeaves?: boolean;
}

/** Builds a single ornate Qingdao vintage cast-iron streetlamp prototype group. */
function createStreetlampAssembly(
  ironMat: THREE.MeshStandardMaterial,
  brassMat: THREE.MeshStandardMaterial,
  glassMat: THREE.MeshStandardMaterial,
  glowSpriteMat: THREE.SpriteMaterial
): { root: THREE.Group; halo: THREE.Sprite } {
  const root = new THREE.Group();

  // Buried octagonal plinth footing (y = -0.35..0.52) so lamp never floats on slopes
  const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.88, 8), ironMat);
  baseFoot.position.y = 0.09;
  baseFoot.castShadow = true;
  baseFoot.receiveShadow = true;
  root.add(baseFoot);

  // Decorative stepped base collar
  const collar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.24, 8), ironMat);
  collar1.position.y = 0.62;
  collar1.castShadow = true;
  root.add(collar1);

  // Tapered cast-iron post shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.1, 3.35, 10), ironMat);
  shaft.position.y = 2.38;
  shaft.castShadow = true;
  root.add(shaft);

  // Decorative cast-iron rings along shaft
  for (const ry of [1.15, 2.45, 3.85]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ry > 3 ? 0.075 : 0.095, 0.02, 6, 12), ironMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    root.add(ring);
  }

  // Twin wrought-iron ornamental scroll brackets under lantern
  const bracketBar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), ironMat);
  bracketBar.position.y = 3.92;
  root.add(bracketBar);

  for (const side of [-1, 1]) {
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 6, 12, Math.PI * 1.45), ironMat);
    scroll.position.set(side * 0.17, 3.8, 0);
    scroll.rotation.z = side > 0 ? -0.4 : Math.PI + 0.4;
    root.add(scroll);
  }

  // Hexagonal vintage lantern housing
  const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.09, 0.12, 6), brassMat);
  lanternBase.position.y = 4.04;
  root.add(lanternBase);

  // Glowing frosted vintage glass core
  const glassCore = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.42, 6), glassMat);
  glassCore.position.y = 4.3;
  root.add(glassCore);

  // Corner iron mullions around glass lantern
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 5), ironMat);
    rib.position.set(Math.cos(a) * 0.19, 4.3, Math.sin(a) * 0.19);
    root.add(rib);
  }

  // Domed hexagonal lantern cap & finial spire
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.24, 6), ironMat);
  cap.position.y = 4.62;
  cap.castShadow = true;
  root.add(cap);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.22, 6), brassMat);
  finial.position.y = 4.82;
  root.add(finial);

  // Soft warm additive glow halo sprite
  const halo = new THREE.Sprite(glowSpriteMat);
  halo.position.y = 4.32;
  halo.scale.set(2.4, 2.4, 1);
  root.add(halo);

  return { root, halo };
}

/** Builds a classic Qingdao wooden-slat & cast-iron scrolled park bench. */
function createParkBench(
  ironMat: THREE.MeshStandardMaterial,
  woodMat: THREE.MeshStandardMaterial,
  leafMat: THREE.MeshStandardMaterial,
  withLeaves: boolean
): THREE.Group {
  const bench = new THREE.Group();

  // Cast-iron side frames & scrolled legs (extended -0.24m below y=0 so benches never float even on sloped turf)
  for (const sx of [-0.76, 0.76]) {
    const frontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), ironMat);
    frontLeg.position.set(sx, 0.11, 0.22);
    frontLeg.castShadow = true;
    bench.add(frontLeg);

    const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), ironMat);
    backLeg.position.set(sx, 0.31, -0.22);
    backLeg.rotation.x = -0.14;
    backLeg.castShadow = true;
    bench.add(backLeg);

    const seatRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.52), ironMat);
    seatRail.position.set(sx, 0.44, 0.0);
    bench.add(seatRail);

    // Graceful armrest curve
    const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.44), ironMat);
    armrest.position.set(sx, 0.64, 0.03);
    bench.add(armrest);

    const armFront = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), ironMat);
    armFront.position.set(sx, 0.54, 0.22);
    bench.add(armFront);
  }

  // Cross brace under seat
  const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6), ironMat);
  brace.rotation.z = Math.PI / 2;
  brace.position.set(0, 0.22, 0);
  bench.add(brace);

  // 4 warm cedar wood seat slats
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.036, 0.105), woodMat);
    slat.position.set(0, 0.475, -0.18 + i * 0.125);
    slat.castShadow = true;
    slat.receiveShadow = true;
    bench.add(slat);
  }

  // 3 gently reclined backrest wood slats
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.11, 0.034), woodMat);
    slat.position.set(0, 0.64 + i * 0.135, -0.24 - i * 0.022);
    slat.rotation.x = -0.18;
    slat.castShadow = true;
    slat.receiveShadow = true;
    bench.add(slat);
  }

  // Delicate autumn detail: a few golden fallen ginkgo leaves resting on the wooden slats
  if (withLeaves) {
    const leafGeo = new THREE.PlaneGeometry(0.11, 0.11);
    leafGeo.rotateX(-Math.PI / 2);
    const leafOffsets: [number, number, number][] = [
      [-0.48, 0.08, 0.4],
      [-0.36, -0.06, 1.8],
      [0.24, 0.12, 2.7],
      [0.52, -0.02, 0.9],
      [0.62, 0.09, 4.1],
    ];
    for (const [lx, lz, ry] of leafOffsets) {
      const l = new THREE.Mesh(leafGeo, leafMat);
      l.position.set(lx, 0.498, lz);
      l.rotation.y = ry;
      bench.add(l);
    }
  }

  return bench;
}

/** Builds an authentic Badaguan blue-and-white enameled intersection street signpost. */
function createIntersectionSignpost(
  ironMat: THREE.MeshStandardMaterial,
  ewName: [string, string],
  nsName: [string, string]
): THREE.Group {
  const post = new THREE.Group();

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.056, 3.25, 10), ironMat);
  pole.position.y = 1.45;
  pole.castShadow = true;
  post.add(pole);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 8), ironMat);
  plinth.position.y = 0.08;
  post.add(plinth);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), ironMat);
  finial.position.y = 3.12;
  post.add(finial);

  const ewTex = createStreetSignTexture(ewName[0], ewName[1]);
  const nsTex = createStreetSignTexture(nsName[0], nsName[1]);

  const signEdgeMat = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.4, metalness: 0.35 });
  const ewFaceMat = new THREE.MeshStandardMaterial({ map: ewTex, roughness: 0.28, metalness: 0.12 });
  const nsFaceMat = new THREE.MeshStandardMaterial({ map: nsTex, roughness: 0.28, metalness: 0.12 });

  // E-W blade (aligned with X axis, readable from N and S)
  const ewBlade = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.4, 0.036), [
    signEdgeMat,
    signEdgeMat,
    signEdgeMat,
    signEdgeMat,
    ewFaceMat,
    ewFaceMat,
  ]);
  ewBlade.position.set(0.36, 2.8, 0);
  ewBlade.castShadow = true;
  post.add(ewBlade);

  // N-S blade (aligned with Z axis, readable from E and W)
  const nsBlade = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.4, 1.06), [
    nsFaceMat,
    nsFaceMat,
    signEdgeMat,
    signEdgeMat,
    signEdgeMat,
    signEdgeMat,
  ]);
  nsBlade.position.set(0, 2.34, 0.36);
  nsBlade.castShadow = true;
  post.add(nsBlade);

  return post;
}

/** Builds a stone-mounted Badaguan heritage scenic plaque pedestal. */
function createHeritagePlaque(
  graniteMat: THREE.MeshStandardMaterial,
  bronzeMat: THREE.MeshStandardMaterial,
  title: string,
  address: string,
  description: string
): THREE.Group {
  const g = new THREE.Group();

  // Carved granite stone stele base (buried -0.25m)
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.36, 0.64), graniteMat);
  base.position.y = 0.04;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  const column = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.88, 0.44), graniteMat);
  column.position.y = 0.62;
  column.castShadow = true;
  column.receiveShadow = true;
  g.add(column);

  // Slanted lectern frame + bronze heritage plaque
  const lectern = new THREE.Group();
  lectern.position.set(0, 1.12, 0.04);
  lectern.rotation.x = -0.58;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.66, 0.08), bronzeMat);
  frame.castShadow = true;
  lectern.add(frame);

  const plaqueTex = createHeritagePlaqueTexture(title, address, description);
  const faceMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    roughness: 0.34,
    metalness: 0.45,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.58), faceMat);
  face.position.z = 0.044;
  lectern.add(face);

  g.add(lectern);
  return g;
}

/** Builds a classic dark-green Qingdao vintage cylindrical postbox (復古郵筒). */
function createVintagePostbox(
  postboxTex: THREE.CanvasTexture,
  brassMat: THREE.MeshStandardMaterial
): THREE.Group {
  const g = new THREE.Group();
  const darkGreenMat = new THREE.MeshStandardMaterial({
    color: 0x13422b,
    roughness: 0.42,
    metalness: 0.38,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    map: postboxTex,
    roughness: 0.38,
    metalness: 0.25,
  });

  // Heavy granite + iron base
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.32, 16), darkGreenMat);
  footing.position.y = 0.02;
  footing.castShadow = true;
  g.add(footing);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 1.18, 20), bodyMat);
  body.position.y = 0.74;
  body.rotation.y = -Math.PI / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Brass mail slot hood
  const slotHood = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.08), brassMat);
  slotHood.position.set(0, 1.06, 0.27);
  g.add(slotHood);

  // Domed rain cap & crown finial
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 20), darkGreenMat);
  rim.position.y = 1.35;
  rim.castShadow = true;
  g.add(rim);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    darkGreenMat
  );
  dome.position.y = 1.38;
  dome.castShadow = true;
  g.add(dome);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), brassMat);
  knob.position.y = 1.68;
  g.add(knob);

  return g;
}

/** Builds a wooden scenic directional signpost pointing to Badaguan landmarks. */
function createWoodenDirectionalSignpost(
  woodMat: THREE.MeshStandardMaterial,
  ironMat: THREE.MeshStandardMaterial,
  boards: { zh: string; en: string; dir: 'left' | 'right'; rotY: number; height: number }[]
): THREE.Group {
  const g = new THREE.Group();

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.85, 0.14), woodMat);
  post.position.y = 1.25;
  post.castShadow = true;
  g.add(post);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.14, 4), ironMat);
  cap.position.y = 2.74;
  cap.rotation.y = Math.PI / 4;
  g.add(cap);

  for (const b of boards) {
    const tex = createDirectionalBoardTexture(b.zh, b.en, b.dir);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0.04 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 0.045), [
      woodMat,
      woodMat,
      woodMat,
      woodMat,
      faceMat,
      faceMat,
    ]);
    board.position.set(0, b.height, 0);
    board.rotation.y = b.rotY;
    board.castShadow = true;
    g.add(board);
  }

  return g;
}

export function buildStreetProps(
  ctx: WorldContext,
  textures: FoliageTextureSet
): StreetPropsResult {
  const group = new THREE.Group();
  group.name = 'BadaguanStreetProps';
  const colliders: Collider[] = [];

  // Shared materials
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1a2621,
    roughness: 0.38,
    metalness: 0.68,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0x9b7a42,
    roughness: 0.36,
    metalness: 0.72,
  });
  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0xa4998c,
    roughness: 0.88,
    metalness: 0.02,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodSlat,
    roughness: 0.76,
    metalness: 0.02,
  });
  const benchLeafMat = new THREE.MeshStandardMaterial({
    map: textures.singleGinkgoLeaf,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.75,
  });

  // Dynamic lamp materials controlled by setMood(mood)
  const lampGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d8,
    emissive: new THREE.Color(0xffb454),
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.05,
  });
  const lampGlowSpriteMat = new THREE.SpriteMaterial({
    map: textures.lampGlow,
    color: new THREE.Color(0xffc778),
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // =========================================================================
  // 1. Vintage Qingdao Cast-Iron Streetlamps (~30 lamps, interleaved with trees)
  // =========================================================================
  const lampPlacements: LampPlacement[] = [
    // 居庸關路 (Juyongguan Ginkgo Avenue)
    { x: -60.0, z: -29.6, rotY: 0 },
    { x: -41.5, z: -29.6, rotY: 0 },
    { x: -19.2, z: -29.6, rotY: 0, heroLight: true }, // NW crossroads glow
    { x: -11.5, z: -29.6, rotY: 0 },
    { x: 9.5, z: -29.6, rotY: 0, heroLight: true }, // Princess House gate glow
    { x: 39.5, z: -29.6, rotY: 0 },
    { x: 57.5, z: -29.6, rotY: 0 },
    { x: -50.5, z: -18.4, rotY: Math.PI },
    { x: -11.5, z: -18.4, rotY: Math.PI, heroLight: true }, // Mid Ginkgo tunnel glow
    { x: 9.5, z: -18.4, rotY: Math.PI },
    { x: 17.6, z: -18.4, rotY: Math.PI, heroLight: true }, // NE crossroads glow
    { x: 48.5, z: -18.4, rotY: Math.PI },

    // 嘉峪關路 (Jiayuguan Maple Avenue)
    { x: -31.1, z: -57.5, rotY: Math.PI / 2 },
    { x: -20.9, z: -39.5, rotY: -Math.PI / 2 },
    { x: -31.1, z: -8.5, rotY: Math.PI / 2 },
    { x: -20.9, z: 9.5, rotY: -Math.PI / 2, heroLight: true }, // Butterfly House maple corner

    // 山海關路 & Seawall Coastal Promenade
    { x: -69.0, z: 33.4, rotY: 0 },
    { x: -55.0, z: 33.4, rotY: 0 },
    { x: -42.0, z: 33.4, rotY: 0 },
    { x: -31.5, z: 33.4, rotY: 0, heroLight: true }, // West flank of beach stairs
    { x: -20.5, z: 33.4, rotY: 0 }, // East flank of beach stairs
    { x: -8.5, z: 33.4, rotY: 0, heroLight: true }, // Promenade facing sea
    { x: 4.5, z: 33.4, rotY: 0 },
    { x: 16.5, z: 33.4, rotY: 0, heroLight: true }, // SE crossroads & promenade
    { x: 34.5, z: 33.4, rotY: 0 },
    { x: 48.0, z: 33.4, rotY: 0 },
    { x: 62.0, z: 33.4, rotY: 0 },

    // 黃海路 & Cobblestone Approach to 花石樓 (offset well outside ±2.92m granite kerbs on high causeway shoulder)
    { x: 18.9, z: -7.0, rotY: -Math.PI / 2 },
    { x: 29.1, z: 3.0, rotY: Math.PI / 2 },
    { x: 31.2, z: 38.2, rotY: 0.6, heroLight: true }, // East shoulder of Huashilou cobblestone approach
    { x: 26.8, z: 45.4, rotY: -0.6, heroLight: true }, // West shoulder outside Huashilou Gothic stone gate
  ];

  const heroPointLights: THREE.PointLight[] = [];
  const halos: THREE.Sprite[] = [];

  for (const lp of lampPlacements) {
    if (getRoadDistance(lp.x, lp.z) < 0.35) continue;
    const groundY = ctx.getTerrainHeight(lp.x, lp.z);
    if (groundY < 4.5) continue;
    const surfaceLift = isOnSidewalk(lp.x, lp.z) ? 0.14 : 0.0;

    const { root, halo } = createStreetlampAssembly(
      ironMat,
      brassMat,
      lampGlassMat,
      lampGlowSpriteMat
    );
    root.position.set(lp.x, groundY + surfaceLift, lp.z);
    root.rotation.y = lp.rotY;
    group.add(root);
    halos.push(halo);

    colliders.push({
      type: 'cylinder',
      x: lp.x,
      z: lp.z,
      radius: 0.32,
      maxY: groundY + surfaceLift + 4.8,
    });

    if (lp.heroLight) {
      const ptLight = new THREE.PointLight(0xffb45a, 0.0, 26, 1.7);
      ptLight.position.set(lp.x, groundY + surfaceLift + 4.45, lp.z);
      ptLight.castShadow = false;
      group.add(ptLight);
      heroPointLights.push(ptLight);
    }
  }

  // =========================================================================
  // 2. Classic Wooden & Cast-Iron Park Benches
  // =========================================================================
  const benchPlacements: BenchPlacement[] = [
    // Coastal seawall promenade benches facing +Z toward the Yellow Sea & No. 2 Beach!
    { x: -58.5, z: 33.7, rotY: 0 },
    { x: -45.0, z: 33.7, rotY: 0 },
    { x: -12.0, z: 33.7, rotY: 0 },
    { x: 1.5, z: 33.7, rotY: 0 },
    { x: 13.0, z: 33.7, rotY: 0 },
    { x: 31.4, z: 33.7, rotY: 0 }, // Promenade overlook facing Huashilou & eastern sea rocks
    { x: 44.5, z: 33.7, rotY: 0 },
    { x: 58.5, z: 33.7, rotY: 0 },

    // Ginkgo Avenue benches dusted with fallen golden leaves
    { x: -41.0, z: -17.3, rotY: Math.PI, withGinkgoLeaves: true },
    { x: -11.5, z: -30.7, rotY: 0, withGinkgoLeaves: true },
    { x: 9.5, z: -30.7, rotY: 0, withGinkgoLeaves: true },
    { x: -11.5, z: -17.3, rotY: Math.PI, withGinkgoLeaves: true },
    { x: 9.5, z: -17.3, rotY: Math.PI, withGinkgoLeaves: true },
    { x: 40.0, z: -30.7, rotY: 0, withGinkgoLeaves: true },

    // Maple Avenue bench facing Butterfly House & crimson foliage
    { x: -31.5, z: 9.5, rotY: Math.PI / 2 },
  ];

  for (const bp of benchPlacements) {
    if (getRoadDistance(bp.x, bp.z) < 0.35) continue;
    const groundY = ctx.getTerrainHeight(bp.x, bp.z);
    if (groundY < 4.5) continue;
    const surfaceLift = isOnSidewalk(bp.x, bp.z) ? 0.14 : 0.0;

    const bench = createParkBench(ironMat, woodMat, benchLeafMat, Boolean(bp.withGinkgoLeaves));
    bench.position.set(bp.x, groundY + surfaceLift, bp.z);
    bench.rotation.y = bp.rotY;
    group.add(bench);

    const cosR = Math.abs(Math.cos(bp.rotY));
    const sinR = Math.abs(Math.sin(bp.rotY));
    const halfX = 0.92 * cosR + 0.38 * sinR;
    const halfZ = 0.92 * sinR + 0.38 * cosR;
    colliders.push({
      type: 'box',
      minX: bp.x - halfX,
      maxX: bp.x + halfX,
      minZ: bp.z - halfZ,
      maxZ: bp.z + halfZ,
      maxY: groundY + surfaceLift + 1.1,
    });
  }

  // =========================================================================
  // 3. Authentic Qingdao Blue-and-White Enameled Street Signposts (4 Intersections)
  // =========================================================================
  const signposts: { x: number; z: number; ew: [string, string]; ns: [string, string]; rotY: number }[] = [
    {
      x: -19.8,
      z: -17.8,
      ew: ['居庸關路', 'JUYONGGUAN RD'],
      ns: ['嘉峪關路', 'JIAYUGUAN RD'],
      rotY: 0,
    },
    {
      x: 18.0,
      z: -17.8,
      ew: ['居庸關路', 'JUYONGGUAN RD'],
      ns: ['黃海路', 'HUANGHAI RD'],
      rotY: Math.PI / 2,
    },
    {
      x: -32.2,
      z: 19.8,
      ew: ['山海關路', 'SHANHAIGUAN RD'],
      ns: ['嘉峪關路', 'JIAYUGUAN RD'],
      rotY: 0,
    },
    {
      x: 18.0,
      z: 19.8,
      ew: ['山海關路', 'SHANHAIGUAN RD'],
      ns: ['黃海路', 'HUANGHAI RD'],
      rotY: Math.PI,
    },
  ];

  for (const sp of signposts) {
    const y = ctx.getTerrainHeight(sp.x, sp.z);
    const mesh = createIntersectionSignpost(ironMat, sp.ew, sp.ns);
    mesh.position.set(sp.x, y + 0.14, sp.z);
    mesh.rotation.y = sp.rotY;
    group.add(mesh);

    colliders.push({
      type: 'cylinder',
      x: sp.x,
      z: sp.z,
      radius: 0.25,
      maxY: y + 3.2,
    });
  }

  // =========================================================================
  // 4. Stone-Mounted Heritage Plaques at Iconic Badaguan Landmarks
  // =========================================================================
  const plaques: {
    x: number;
    z: number;
    rotY: number;
    title: string;
    address: string;
    desc: string;
  }[] = [
    {
      x: -5.4,
      z: -31.2,
      rotY: 0,
      title: '公主樓',
      address: '居庸關路 10 號 · 1930s',
      desc: '丹麥童話風格藍牆紅瓦歷史洋樓',
    },
    {
      x: -5.4,
      z: 18.8,
      rotY: 0,
      title: '蝴蝶樓',
      address: '山海關路 21 號 · 1934',
      desc: '折衷主義明黃建築 · 電影《劫後桃花》取景地',
    },
    {
      x: 24.4,
      z: 42.2,
      rotY: -0.55,
      title: '花石樓',
      address: '黃海路 18 號 · 1930–1932',
      desc: '臨海岬角花崗岩哥德式古堡建築',
    },
    {
      x: -18.6,
      z: -30.5,
      rotY: 0.35,
      title: '八大關景區',
      address: '一關一樹 · 居庸關銀杏大道',
      desc: '萬國建築博覽館 · 紅瓦綠樹碧海藍天',
    },
  ];

  for (const pl of plaques) {
    const y = ctx.getTerrainHeight(pl.x, pl.z);
    const lift = isOnSidewalk(pl.x, pl.z) ? 0.14 : 0.0;
    const plaque = createHeritagePlaque(graniteMat, brassMat, pl.title, pl.address, pl.desc);
    plaque.position.set(pl.x, y + lift, pl.z);
    plaque.rotation.y = pl.rotY;
    group.add(plaque);

    colliders.push({
      type: 'cylinder',
      x: pl.x,
      z: pl.z,
      radius: 0.58,
      maxY: y + lift + 1.5,
    });
  }

  // =========================================================================
  // 5. Charming Local Qingdao Details: Vintage Green Postbox, Wooden Signpost & Bollards
  // =========================================================================
  {
    const px = -18.3;
    const pz = -17.3;
    const py = ctx.getTerrainHeight(px, pz);
    const postbox = createVintagePostbox(textures.postboxBody, brassMat);
    postbox.position.set(px, py + 0.15, pz);
    postbox.rotation.y = -0.65;
    group.add(postbox);

    colliders.push({
      type: 'cylinder',
      x: px,
      z: pz,
      radius: 0.38,
      maxY: py + 1.75,
    });
  }

  // Wooden scenic directional signpost near Huanghai / Promenade crossroads
  {
    const sx = 18.8;
    const sz = 32.6;
    const sy = ctx.getTerrainHeight(sx, sz);
    const dirSign = createWoodenDirectionalSignpost(woodMat, ironMat, [
      { zh: '花石樓', en: 'HUASHILOU CASTLE', dir: 'right', rotY: -0.45, height: 2.32 },
      { zh: '第二海水浴場', en: 'NO.2 BATHING BEACH', dir: 'left', rotY: 0.08, height: 1.96 },
      { zh: '公主樓 · 銀杏大道', en: 'PRINCESS HOUSE', dir: 'left', rotY: Math.PI / 2, height: 1.6 },
    ]);
    dirSign.position.set(sx, sy + 0.14, sz);
    group.add(dirSign);

    colliders.push({
      type: 'cylinder',
      x: sx,
      z: sz,
      radius: 0.25,
      maxY: sy + 2.8,
    });
  }

  // Second wooden directional signpost near the beach staircase top
  {
    const sx = -19.2;
    const sz = 32.6;
    const sy = ctx.getTerrainHeight(sx, sz);
    const dirSign2 = createWoodenDirectionalSignpost(woodMat, ironMat, [
      { zh: '第二海水浴場沙灘', en: 'SANDY BEACH & PIER', dir: 'left', rotY: 0.25, height: 2.26 },
      { zh: '蝴蝶樓 · 五角楓大道', en: 'BUTTERFLY HOUSE', dir: 'right', rotY: Math.PI / 2, height: 1.88 },
    ]);
    dirSign2.position.set(sx, sy + 0.14, sz);
    group.add(dirSign2);

    colliders.push({
      type: 'cylinder',
      x: sx,
      z: sz,
      radius: 0.25,
      maxY: sy + 2.7,
    });
  }

  // Carved Qingdao stone garden bollards framing courtyard entrance sidewalks & Huashilou promenade entry
  const bollardCoords: [number, number][] = [
    [-4.3, -31.0],
    [2.3, -31.0],
    [-4.3, -16.8],
    [2.3, -16.8],
    [-4.3, 19.0],
    [2.3, 19.0],
    [19.2, 34.6], // West sidewalk flank outside Huanghai Rd asphalt (x < 19.8)
    [29.0, 34.6], // East sidewalk flank outside Huanghai Rd asphalt (x > 28.2) & cobblestone kerbs
  ];
  const bollardGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.88, 10);
  const bollardInst = new THREE.InstancedMesh(bollardGeo, graniteMat, bollardCoords.length);
  bollardInst.castShadow = true;
  bollardInst.receiveShadow = true;
  const bDummy = new THREE.Object3D();
  for (let i = 0; i < bollardCoords.length; i++) {
    const [bx, bz] = bollardCoords[i];
    const by = ctx.getTerrainHeight(bx, bz);
    const lift = isOnSidewalk(bx, bz) ? 0.44 : 0.34;
    bDummy.position.set(bx, by + lift, bz);
    bDummy.updateMatrix();
    bollardInst.setMatrixAt(i, bDummy.matrix);
  }
  bollardInst.instanceMatrix.needsUpdate = true;
  group.add(bollardInst);

  let targetLampStrength = 0.15;

  return {
    group,
    colliders,
    update: (_dt, elapsed) => {
      // Subtle organic warm tungsten breathe on glowing lamp halos at dusk/night
      if (targetLampStrength > 0.2) {
        const pulse = 1.0 + Math.sin(elapsed * 2.1) * 0.035;
        const baseScale = 1.8 + targetLampStrength * 1.45;
        for (let i = 0; i < halos.length; i++) {
          const s = baseScale * (pulse + Math.sin(elapsed * 1.7 + i * 1.3) * 0.025);
          halos[i].scale.set(s, s, 1);
        }
      }
    },
    setMood: (mood) => {
      const li = THREE.MathUtils.clamp(mood.lampIntensity, 0, 2.5);
      targetLampStrength = li;

      // Glass globe brightness (subtle cream glass by day, cozy warm bloom at sunset/night)
      lampGlassMat.emissiveIntensity = 0.18 + li * 2.8;
      if (mood.id === 'coastal_night') {
        lampGlassMat.emissive.setHex(0xffb14e);
        lampGlowSpriteMat.color.setHex(0xffb85c);
      } else if (mood.id === 'golden_sunset') {
        lampGlassMat.emissive.setHex(0xffa448);
        lampGlowSpriteMat.color.setHex(0xffba66);
      } else {
        lampGlassMat.emissive.setHex(0xffcf82);
        lampGlowSpriteMat.color.setHex(0xffe0a6);
      }

      // Additive halo visibility
      const haloOpacity = li < 0.08 ? 0.0 : THREE.MathUtils.clamp(0.12 + li * 0.46, 0, 0.85);
      lampGlowSpriteMat.opacity = haloOpacity;
      const haloScale = 1.6 + li * 1.5;
      for (const h of halos) {
        h.visible = haloOpacity > 0.01;
        h.scale.set(haloScale, haloScale, 1);
      }

      // Real warm pools of tungsten light on leaves, roads & stone walls
      const ptIntensity = li < 0.08 ? 0.0 : li * 11.5;
      for (const pl of heroPointLights) {
        pl.intensity = ptIntensity;
        pl.visible = ptIntensity > 0.05;
      }
    },
  };
}
