import * as THREE from 'three';
import { MoodConfig, WorldContext } from '../types';
import { FoliageTextureSet } from './foliageTextures';

export interface LivingAtmosphereResult {
  group: THREE.Group;
  update: (dt: number, elapsed: number, camera: THREE.Camera) => void;
  setMood: (mood: MoodConfig) => void;
}

interface LeafParticle {
  x: number;
  y: number;
  z: number;
  originX: number;
  originZ: number;
  spawnHeight: number;
  groundY: number;
  fallSpeed: number;
  driftX: number;
  driftZ: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  scale: number;
  restTimer: number;
}

interface SeagullAgent {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  baseY: number;
  bobAmp: number;
  speed: number;
  phase: number;
  figureEight: boolean;
  flapSpeed: number;
  prevPos: THREE.Vector3;
}

interface MistRibbon {
  sprite: THREE.Sprite;
  baseX: number;
  baseY: number;
  baseZ: number;
  driftSpeed: number;
  driftRange: number;
  phase: number;
  opacityMul: number;
  baseScaleX: number;
  baseScaleY: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a gently folded 3D leaf quad so drifting leaves catch light cleanly as they tumble. */
function createFoldedLeafGeometry(size: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(size, size, 2, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // Gentle V-fold along center midrib
    pos.setZ(i, Math.abs(x) * 0.24);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Builds a graceful articulated 3D Qingdao seagull (海鷗) with hinged wings. */
function createSeagullModel(
  whiteMat: THREE.MeshStandardMaterial,
  slateMat: THREE.MeshStandardMaterial,
  tipMat: THREE.MeshStandardMaterial,
  beakMat: THREE.MeshStandardMaterial
): { root: THREE.Group; leftWing: THREE.Group; rightWing: THREE.Group } {
  const root = new THREE.Group();

  // Sleek streamlined body (+Z forward)
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.72, 6), whiteMat);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.0, 1.0, 0.85);
  root.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), whiteMat);
  head.position.set(0, 0.03, 0.34);
  root.add(head);

  // Golden beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 5), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.015, 0.45);
  root.add(beak);

  // Fan tail
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.24), whiteMat);
  tail.position.set(0, 0.01, -0.38);
  root.add(tail);

  // Articulated left & right gull wings (inner pale slate + outer dark-tipped primaries)
  const makeWing = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.07, 0.03, 0.06);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.022, 0.21), slateMat);
    inner.position.set(side * 0.23, 0.03, -0.02);
    inner.rotation.z = side * 0.14;
    inner.rotation.y = side * -0.12;
    pivot.add(inner);

    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.016, 0.15), tipMat);
    outer.position.set(side * 0.62, 0.02, -0.09);
    outer.rotation.z = side * -0.16;
    outer.rotation.y = side * -0.32;
    pivot.add(outer);

    return pivot;
  };

  const leftWing = makeWing(-1);
  const rightWing = makeWing(1);
  root.add(leftWing, rightWing);

  // Slightly larger than real-life (~1.55m wingspan) so they read gracefully from promenade & cliffs
  root.scale.setScalar(1.38);

  return { root, leftWing, rightWing };
}

export function buildLivingAtmosphere(
  ctx: WorldContext,
  textures: FoliageTextureSet
): LivingAtmosphereResult {
  const group = new THREE.Group();
  group.name = 'BadaguanLivingAtmosphere';
  const rand = mulberry32(8082026);

  // =========================================================================
  // 1. Drifting & Tumbling Autumn Leaves (640 Ginkgo + 340 Maple = 980 leaves)
  // =========================================================================
  const ginkgoCount = 640;
  const mapleCount = 340;

  const ginkgoLeafGeo = createFoldedLeafGeometry(0.19);
  const mapleLeafGeo = createFoldedLeafGeometry(0.21);

  const ginkgoLeafMat = new THREE.MeshStandardMaterial({
    map: textures.singleGinkgoLeaf,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.68,
    metalness: 0.0,
    emissive: new THREE.Color(0x523406),
    emissiveIntensity: 0.15,
  });
  const mapleLeafMat = new THREE.MeshStandardMaterial({
    map: textures.singleMapleLeaf,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.0,
    emissive: new THREE.Color(0x4a1208),
    emissiveIntensity: 0.12,
  });

  const ginkgoMesh = new THREE.InstancedMesh(ginkgoLeafGeo, ginkgoLeafMat, ginkgoCount);
  const mapleMesh = new THREE.InstancedMesh(mapleLeafGeo, mapleLeafMat, mapleCount);
  ginkgoMesh.castShadow = false;
  ginkgoMesh.receiveShadow = false;
  mapleMesh.castShadow = false;
  mapleMesh.receiveShadow = false;
  ginkgoMesh.frustumCulled = false;
  mapleMesh.frustumCulled = false;

  const ginkgoParticles: LeafParticle[] = [];
  const mapleParticles: LeafParticle[] = [];

  const ginkgoTints = [0xfff099, 0xffe066, 0xffcd42, 0xf7be32];
  const mapleTints = [0xff8c7a, 0xff6b54, 0xffa65c, 0xeb5e52];
  const tmpColor = new THREE.Color();

  for (let i = 0; i < ginkgoCount; i++) {
    // 82% concentrated along 居庸關路 golden cathedral tunnel, 18% drifting through Princess/Butterfly gardens
    const alongAvenue = rand() < 0.82;
    const ox = alongAvenue ? -76 + rand() * 152 : -28 + rand() * 56;
    const oz = alongAvenue ? -24 + (rand() - 0.5) * 16.5 : -54 + rand() * 68;
    const groundY = ctx.getTerrainHeight(ox, oz) + 0.12;
    const spawnHeight = 6.5 + rand() * 5.8;

    ginkgoParticles.push({
      x: ox,
      y: groundY + rand() * spawnHeight,
      z: oz,
      originX: ox,
      originZ: oz,
      spawnHeight,
      groundY,
      fallSpeed: 0.55 + rand() * 0.65,
      driftX: 0.35 + rand() * 0.55,
      driftZ: -0.22 + (rand() - 0.5) * 0.35,
      swayFreq: 1.2 + rand() * 1.4,
      swayAmp: 0.55 + rand() * 0.85,
      phase: rand() * Math.PI * 2,
      rotX: rand() * Math.PI * 2,
      rotY: rand() * Math.PI * 2,
      rotZ: rand() * Math.PI * 2,
      spinX: (rand() - 0.5) * 3.0,
      spinY: (rand() - 0.5) * 2.8,
      spinZ: (rand() - 0.5) * 3.0,
      scale: 0.72 + rand() * 0.65,
      restTimer: 0,
    });

    tmpColor.setHex(ginkgoTints[Math.floor(rand() * ginkgoTints.length)]);
    ginkgoMesh.setColorAt(i, tmpColor);
  }
  if (ginkgoMesh.instanceColor) ginkgoMesh.instanceColor.needsUpdate = true;

  for (let i = 0; i < mapleCount; i++) {
    // Concentrated along 嘉峪關路 five-pointed maple avenue & Butterfly corner
    const ox = -26 + (rand() - 0.5) * 16.0;
    const oz = -74 + rand() * 94;
    const groundY = ctx.getTerrainHeight(ox, oz) + 0.12;
    const spawnHeight = 5.5 + rand() * 4.8;

    mapleParticles.push({
      x: ox,
      y: groundY + rand() * spawnHeight,
      z: oz,
      originX: ox,
      originZ: oz,
      spawnHeight,
      groundY,
      fallSpeed: 0.62 + rand() * 0.68,
      driftX: 0.3 + rand() * 0.5,
      driftZ: -0.18 + (rand() - 0.5) * 0.4,
      swayFreq: 1.1 + rand() * 1.5,
      swayAmp: 0.5 + rand() * 0.85,
      phase: rand() * Math.PI * 2,
      rotX: rand() * Math.PI * 2,
      rotY: rand() * Math.PI * 2,
      rotZ: rand() * Math.PI * 2,
      spinX: (rand() - 0.5) * 3.2,
      spinY: (rand() - 0.5) * 2.6,
      spinZ: (rand() - 0.5) * 3.2,
      scale: 0.74 + rand() * 0.62,
      restTimer: 0,
    });

    tmpColor.setHex(mapleTints[Math.floor(rand() * mapleTints.length)]);
    mapleMesh.setColorAt(i, tmpColor);
  }
  if (mapleMesh.instanceColor) mapleMesh.instanceColor.needsUpdate = true;

  group.add(ginkgoMesh, mapleMesh);

  // =========================================================================
  // 2. Gliding Qingdao Seagulls (16 articulated 3D birds above sea, beach & Huashilou)
  // =========================================================================
  const gullWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.6 });
  const gullSlateMat = new THREE.MeshStandardMaterial({ color: 0xc2ccd6, roughness: 0.65 });
  const gullTipMat = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.7 });
  const gullBeakMat = new THREE.MeshStandardMaterial({ color: 0xe69828, roughness: 0.45 });

  const seagulls: SeagullAgent[] = [];
  const gullOrbits: {
    cx: number;
    cz: number;
    rx: number;
    rz: number;
    y: number;
    speed: number;
    fig8: boolean;
  }[] = [
    // Soaring above Huashilou coastal cape (34, 56)
    { cx: 36, cz: 58, rx: 24, rz: 19, y: 24.5, speed: 0.24, fig8: false },
    { cx: 40, cz: 64, rx: 28, rz: 22, y: 28.0, speed: -0.2, fig8: false },
    { cx: 28, cz: 54, rx: 19, rz: 16, y: 21.5, speed: 0.28, fig8: true },
    { cx: 46, cz: 52, rx: 22, rz: 26, y: 31.0, speed: 0.18, fig8: false },
    { cx: 32, cz: 72, rx: 26, rz: 18, y: 18.5, speed: -0.26, fig8: false },
    // Gliding above No. 2 Bathing Beach cove & breakwater pier
    { cx: -24, cz: 68, rx: 30, rz: 22, y: 17.5, speed: 0.25, fig8: false },
    { cx: -18, cz: 82, rx: 26, rz: 20, y: 15.2, speed: -0.29, fig8: true },
    { cx: -36, cz: 74, rx: 24, rz: 18, y: 20.5, speed: 0.22, fig8: false },
    { cx: -10, cz: 90, rx: 28, rz: 19, y: 14.5, speed: 0.27, fig8: false },
    { cx: -48, cz: 62, rx: 22, rz: 18, y: 23.0, speed: -0.21, fig8: false },
    // Sweeping wide arcs across Huiquan Bay & seawall promenade
    { cx: 2, cz: 66, rx: 42, rz: 24, y: 26.5, speed: 0.17, fig8: false },
    { cx: -4, cz: 56, rx: 38, rz: 20, y: 29.5, speed: -0.16, fig8: true },
    { cx: 14, cz: 78, rx: 32, rz: 22, y: 19.0, speed: 0.23, fig8: false },
    { cx: -28, cz: 94, rx: 34, rz: 20, y: 22.0, speed: -0.19, fig8: false },
    { cx: 6, cz: 42, rx: 36, rz: 16, y: 32.5, speed: 0.18, fig8: false },
    { cx: -14, cz: 46, rx: 28, rz: 18, y: 25.0, speed: -0.22, fig8: false },
  ];

  for (let i = 0; i < gullOrbits.length; i++) {
    const o = gullOrbits[i];
    const model = createSeagullModel(gullWhiteMat, gullSlateMat, gullTipMat, gullBeakMat);
    group.add(model.root);
    seagulls.push({
      root: model.root,
      leftWing: model.leftWing,
      rightWing: model.rightWing,
      centerX: o.cx,
      centerZ: o.cz,
      radiusX: o.rx,
      radiusZ: o.rz,
      baseY: o.y,
      bobAmp: 1.2 + rand() * 1.4,
      speed: o.speed,
      phase: rand() * Math.PI * 2,
      figureEight: o.fig8,
      flapSpeed: 4.8 + rand() * 1.5,
      prevPos: new THREE.Vector3(o.cx, o.y, o.cz),
    });
  }

  // =========================================================================
  // 3. Coastal Sea Mist Ribbons (青島平流霧 — reactive to mood.mistOpacity!)
  // =========================================================================
  const mistRibbons: MistRibbon[] = [];
  const mistMaterials: THREE.SpriteMaterial[] = [];

  const mistZones: [number, number, number, number, number, number][] = [
    // [x, y, z, scaleX, scaleY, opacityMultiplier]
    // Drifting low across the Yellow Sea cove & breakwater pier
    [-55, 5.2, 72, 48, 16, 1.0],
    [-34, 4.5, 86, 54, 17, 1.05],
    [-12, 5.4, 96, 58, 18, 1.0],
    [16, 5.0, 88, 52, 16, 0.95],
    [48, 6.2, 80, 56, 18, 1.0],
    [-68, 5.8, 56, 44, 15, 0.95],
    [-22, 4.8, 58, 46, 15, 0.95],
    [8, 5.2, 62, 48, 16, 0.95],
    // Curling poetically around Huashilou granite cape cliffs
    [22, 8.8, 52, 34, 13, 0.85],
    [48, 9.2, 58, 38, 14, 0.88],
    [35, 7.6, 74, 42, 14, 0.95],
    [58, 7.2, 46, 42, 14, 0.88],
    // Skimming seawall promenade & lower Shanhaiguan Rd
    [-50, 9.2, 38, 40, 13, 0.82],
    [-18, 8.8, 39, 38, 12, 0.8],
    [12, 9.0, 38, 38, 13, 0.82],
    [42, 9.4, 37, 38, 13, 0.8],
    // Gentle wispy mist drifting inland into Badaguan avenues (strongest in morning_mist)
    [-42, 10.6, 16, 36, 12, 0.62],
    [0, 10.8, 18, 36, 12, 0.6],
    [38, 10.6, 14, 36, 12, 0.62],
    [-30, 11.4, -18, 38, 13, 0.55],
    [2, 11.6, -24, 38, 12, 0.55],
    [34, 11.4, -22, 38, 12, 0.55],
    [-10, 12.6, -48, 42, 13, 0.52],
    [24, 12.2, -52, 42, 13, 0.52],
    // Far bay horizon veil
    [-75, 7.5, 108, 76, 22, 1.1],
    [-20, 7.8, 118, 84, 24, 1.15],
    [40, 8.0, 112, 80, 24, 1.1],
    [82, 7.5, 92, 68, 22, 1.05],
  ];

  for (let i = 0; i < mistZones.length; i++) {
    const [mx, my, mz, sx, sy, opMul] = mistZones[i];
    const mat = new THREE.SpriteMaterial({
      map: textures.mistPuff,
      color: new THREE.Color(0xeef4fa),
      transparent: true,
      opacity: 0.1 * opMul,
      depthWrite: false,
      fog: true,
    });
    mistMaterials.push(mat);

    const sprite = new THREE.Sprite(mat);
    sprite.position.set(mx, my, mz);
    sprite.scale.set(sx, sy, 1);
    sprite.renderOrder = 3;
    group.add(sprite);

    mistRibbons.push({
      sprite,
      baseX: mx,
      baseY: my,
      baseZ: mz,
      driftSpeed: 0.12 + rand() * 0.14,
      driftRange: 6.0 + rand() * 9.0,
      phase: rand() * Math.PI * 2,
      opacityMul: opMul,
      baseScaleX: sx,
      baseScaleY: sy,
    });
  }

  // =========================================================================
  // 4. Warm Sunlit Dust & Coastal Sea-Spray Motes (480 glowing floating motes)
  // =========================================================================
  const moteCount = 480;
  const motePositions = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount * 3);

  for (let i = 0; i < moteCount; i++) {
    // Cluster around Ginkgo Ave, Princess/Butterfly gardens, and seawall promenade
    const zone = rand();
    let x: number;
    let z: number;
    if (zone < 0.45) {
      x = -68 + rand() * 136;
      z = -34 + rand() * 22;
    } else if (zone < 0.78) {
      x = -52 + rand() * 104;
      z = -12 + rand() * 54;
    } else {
      x = 12 + rand() * 44;
      z = 36 + rand() * 36;
    }
    const y = ctx.getTerrainHeight(x, z) + 0.9 + rand() * 7.5;
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = y;
    motePositions[i * 3 + 2] = z;

    moteSeeds[i * 3] = rand() * Math.PI * 2;
    moteSeeds[i * 3 + 1] = 0.5 + rand() * 1.1;
    moteSeeds[i * 3 + 2] = 0.7 + rand() * 1.1;
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeeds, 3));

  const moteUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xffe6a8) },
    uOpacity: { value: 0.48 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };

  const moteMat = new THREE.ShaderMaterial({
    uniforms: moteUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      varying float vDistFade;

      void main() {
        vec3 p = position;
        float t = uTime * aSeed.y + aSeed.x;
        p.x += sin(t * 0.75) * 1.15;
        p.y += sin(t * 0.55 + 1.3) * 0.55;
        p.z += cos(t * 0.65) * 1.15;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float dist = max(1.0, -mvPosition.z);
        vDistFade = smoothstep(85.0, 12.0, dist) * smoothstep(1.2, 4.5, dist);
        vTwinkle = 0.45 + 0.55 * sin(uTime * (1.8 + aSeed.y) + aSeed.x * 3.0);

        gl_PointSize = clamp((24.0 * aSeed.z * uPixelRatio) / dist, 1.5, 9.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      varying float vDistFade;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float r2 = dot(uv, uv);
        if (r2 > 0.25) discard;
        float soft = pow(1.0 - r2 * 4.0, 2.0);
        float alpha = soft * vTwinkle * vDistFade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  group.add(motes);

  // Reusable temporaries for 60fps zero-GC per-frame updates
  const leafDummy = new THREE.Object3D();
  const nextGullPos = new THREE.Vector3();
  const gullVel = new THREE.Vector3();
  let currentMistOpacity = 0.14;

  const updateLeafBatch = (
    particles: LeafParticle[],
    mesh: THREE.InstancedMesh,
    dt: number,
    elapsed: number
  ) => {
    const safeDt = Math.min(dt, 0.05);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (p.restTimer > 0) {
        p.restTimer -= safeDt;
        if (p.restTimer <= 0) {
          // Respawn up in the canopy with gentle horizontal jitter
          p.x = p.originX + Math.sin(elapsed * 0.3 + p.phase) * 2.2;
          p.z = p.originZ + Math.cos(elapsed * 0.25 + p.phase) * 2.2;
          p.groundY = ctx.getTerrainHeight(p.x, p.z) + 0.12;
          p.y = p.groundY + p.spawnHeight;
          p.rotX = p.phase;
          p.rotZ = p.phase * 0.5;
        }
      } else {
        const gust = 0.65 + 0.45 * Math.sin(elapsed * 0.75 + p.phase * 0.5);
        p.y -= p.fallSpeed * safeDt;
        p.x += (p.driftX * gust + Math.sin(elapsed * p.swayFreq + p.phase) * p.swayAmp) * safeDt;
        p.z += (p.driftZ * gust + Math.cos(elapsed * p.swayFreq * 0.85 + p.phase) * p.swayAmp * 0.75) * safeDt;

        p.rotX += p.spinX * safeDt;
        p.rotY += p.spinY * safeDt;
        p.rotZ += p.spinZ * safeDt;

        if (p.y <= p.groundY) {
          p.y = p.groundY;
          p.rotX = Math.PI * 0.5;
          p.rotZ = 0;
          p.restTimer = 1.6 + (i % 7) * 0.45;
        }
      }

      // Smooth fade-in scale right when detaching from canopy or resting
      const topDist = p.groundY + p.spawnHeight - p.y;
      const topFade = THREE.MathUtils.clamp(topDist / 1.2, 0.05, 1.0);
      const restFade = p.restTimer > 0 ? THREE.MathUtils.clamp(p.restTimer / 0.8, 0.01, 1.0) : 1.0;
      const sc = p.scale * topFade * restFade;

      leafDummy.position.set(p.x, p.y, p.z);
      leafDummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      leafDummy.scale.setScalar(sc);
      leafDummy.updateMatrix();
      mesh.setMatrixAt(i, leafDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const updateAll = (dt: number, elapsed: number) => {
    moteUniforms.uTime.value = elapsed;

    // 1. Update drifting & tumbling autumn leaves
    updateLeafBatch(ginkgoParticles, ginkgoMesh, dt, elapsed);
    updateLeafBatch(mapleParticles, mapleMesh, dt, elapsed);

    // 2. Update gliding & flapping Qingdao seagulls
    for (let i = 0; i < seagulls.length; i++) {
      const g = seagulls[i];
      const t = elapsed * g.speed + g.phase;

      const nx = g.centerX + Math.cos(t) * g.radiusX;
      const nz = g.figureEight
        ? g.centerZ + Math.sin(t * 2.0) * g.radiusZ * 0.65
        : g.centerZ + Math.sin(t) * g.radiusZ;
      const ny = g.baseY + Math.sin(t * 1.6 + i) * g.bobAmp;

      nextGullPos.set(nx, ny, nz);
      gullVel.subVectors(nextGullPos, g.prevPos);

      if (gullVel.lengthSq() > 1e-6) {
        const heading = Math.atan2(gullVel.x, gullVel.z);
        // Graceful coastal banking into turns
        const bank = Math.sin(t + (g.speed > 0 ? 0.4 : -0.4)) * 0.28 * Math.sign(g.speed);
        const pitch = THREE.MathUtils.clamp(-gullVel.y * 1.4, -0.22, 0.22);
        g.root.rotation.order = 'YXZ';
        g.root.rotation.set(pitch, heading, bank);
      }

      g.root.position.copy(nextGullPos);
      g.prevPos.copy(nextGullPos);

      // Alternating natural flap-and-glide wing cycle
      const cycle = (elapsed * 0.45 + g.phase) % 1.0;
      const flapEnvelope = cycle < 0.36 ? Math.sin((cycle / 0.36) * Math.PI) : 0.0;
      const wingAngle =
        flapEnvelope * Math.sin(elapsed * g.flapSpeed + g.phase) * 0.62 +
        (1 - flapEnvelope) * 0.08;
      g.leftWing.rotation.z = -wingAngle;
      g.rightWing.rotation.z = wingAngle;
    }

    // 3. Gently drift coastal sea mist ribbons
    for (let i = 0; i < mistRibbons.length; i++) {
      const m = mistRibbons[i];
      const wave = Math.sin(elapsed * m.driftSpeed + m.phase);
      const wave2 = Math.cos(elapsed * m.driftSpeed * 0.72 + m.phase * 1.3);
      m.sprite.position.set(
        m.baseX + wave * m.driftRange,
        m.baseY + wave2 * 0.75,
        m.baseZ + wave2 * (m.driftRange * 0.42)
      );
      const breath = 0.86 + 0.14 * Math.sin(elapsed * 0.35 + m.phase);
      mistMaterials[i].opacity = THREE.MathUtils.clamp(
        currentMistOpacity * m.opacityMul * breath,
        0.0,
        0.85
      );
    }
  };

  // Seed initial transforms immediately so frame 0 renders all leaves & seagulls in place
  updateAll(0.016, 0.0);

  return {
    group,
    update: (dt, elapsed, _camera) => {
      updateAll(dt, elapsed);
    },
    setMood: (mood) => {
      currentMistOpacity = THREE.MathUtils.clamp(mood.mistOpacity, 0.04, 0.82);

      // Tint mist softly toward sky horizon & coastal fog
      const mistTint = mood.fogColor.clone().lerp(mood.skyHorizonColor, 0.38);
      for (let i = 0; i < mistMaterials.length; i++) {
        mistMaterials[i].color.copy(mistTint);
        mistMaterials[i].opacity = THREE.MathUtils.clamp(
          currentMistOpacity * mistRibbons[i].opacityMul,
          0.0,
          0.85
        );
      }

      // Adapt backlit dust/sea-spray motes & falling leaves to the lighting mood
      if (mood.id === 'autumn_afternoon') {
        moteUniforms.uColor.value.setHex(0xffe7a6);
        moteUniforms.uOpacity.value = 0.48;
        ginkgoLeafMat.emissiveIntensity = 0.16;
        mapleLeafMat.emissiveIntensity = 0.12;
        gullWhiteMat.color.setHex(0xf8f9fb);
      } else if (mood.id === 'morning_mist') {
        moteUniforms.uColor.value.setHex(0xdce8f2);
        moteUniforms.uOpacity.value = 0.32;
        ginkgoLeafMat.emissiveIntensity = 0.08;
        mapleLeafMat.emissiveIntensity = 0.08;
        gullWhiteMat.color.setHex(0xeaf0f5);
      } else if (mood.id === 'golden_sunset') {
        moteUniforms.uColor.value.setHex(0xffb56b);
        moteUniforms.uOpacity.value = 0.62;
        ginkgoLeafMat.emissiveIntensity = 0.24;
        mapleLeafMat.emissiveIntensity = 0.2;
        gullWhiteMat.color.setHex(0xffeedd);
      } else {
        // coastal_night
        moteUniforms.uColor.value.setHex(0xffcf82);
        moteUniforms.uOpacity.value = 0.28;
        ginkgoLeafMat.emissiveIntensity = 0.04;
        mapleLeafMat.emissiveIntensity = 0.04;
        gullWhiteMat.color.setHex(0x9fb2c9);
      }
    },
  };
}
