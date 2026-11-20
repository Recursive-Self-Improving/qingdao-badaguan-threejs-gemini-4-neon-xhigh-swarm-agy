import * as THREE from 'three';
import type { Collider, MoodConfig, WorldContext } from '../types';
import { ROAD_LAYOUT } from '../terrainMath';
import type { LandscapeTextureSet } from './landscapeTextures';

export interface CoastalStructuresResult {
  group: THREE.Group;
  colliders: Collider[];
  update: (elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 1. Seawall Promenade (海濱石牆步道):
 *    Coursed Qingdao granite retaining wall along z = 35.5, paved flagstone promenade,
 *    carved granite bollards every ~4.8m, and gracefully sagging dark iron catenary chains.
 */
function buildSeawallPromenade(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): { group: THREE.Group; colliders: Collider[] } {
  const group = new THREE.Group();
  group.name = 'SeawallPromenade';
  const colliders: Collider[] = [];
  const getH = ctx.getTerrainHeight;
  const wallZ = ROAD_LAYOUT.SEAWALL_Z; // 35.5

  const masonryTex = textures.seawallMap.clone();
  masonryTex.repeat.set(1, 1);
  masonryTex.needsUpdate = true;
  const masonryBump = textures.seawallBump.clone();
  masonryBump.repeat.set(1, 1);
  masonryBump.needsUpdate = true;

  const seawallMat = new THREE.MeshStandardMaterial({
    map: masonryTex,
    bumpMap: masonryBump,
    bumpScale: 0.14,
    roughness: 0.88,
    metalness: 0.04,
  });

  const promenadeMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.06,
    roughness: 0.84,
    metalness: 0.03,
  });

  const copingMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.05,
    color: new THREE.Color(0xdcd5c8),
    roughness: 0.78,
    metalness: 0.03,
  });

  const bollardMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.055,
    color: new THREE.Color(0xd2cbc0),
    roughness: 0.76,
    metalness: 0.04,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x26292d),
    roughness: 0.56,
    metalness: 0.72,
  });

  // Three seawall runs leaving clean openings for the Beach Stairs ([-30.2, -21.8])
  // and the Huanghai Rd / Huashilou approach ([19.2, 30.2])
  const runs: [number, number][] = [
    [-76.0, -30.2],
    [-21.8, 19.2],
    [30.2, 70.0],
  ];

  // Shared carved granite bollard prototype geometry pieces
  const bollardBaseGeo = new THREE.BoxGeometry(0.42, 0.22, 0.42);
  const bollardShaftGeo = new THREE.BoxGeometry(0.32, 0.78, 0.32);
  const bollardCapGeo = new THREE.ConeGeometry(0.24, 0.14, 4);
  bollardCapGeo.rotateY(Math.PI / 4);
  const ringGeo = new THREE.TorusGeometry(0.055, 0.015, 6, 12);

  for (const [xStart, xEnd] of runs) {
    const segLen = xEnd - xStart;
    const steps = Math.max(4, Math.ceil(segLen / 2.0));

    // A. Paved granite promenade deck (z = 32.35 .. 35.65)
    {
      const cols = 3;
      const vertCount = (steps + 1) * cols;
      const positions = new Float32Array(vertCount * 3);
      const uvs = new Float32Array(vertCount * 2);
      const indices: number[] = [];
      const zVals = [32.35, 34.0, 35.65];

      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = xStart + segLen * f;
        for (let j = 0; j < cols; j++) {
          const z = zVals[j];
          const y = getH(x, Math.min(z, 35.0)) + 0.165;
          const idx = i * cols + j;
          positions[idx * 3] = x;
          positions[idx * 3 + 1] = y;
          positions[idx * 3 + 2] = z;
          uvs[idx * 2] = (x - xStart) * 0.38;
          uvs[idx * 2 + 1] = (z - 32.35) * 0.38;
        }
      }
      for (let i = 0; i < steps; i++) {
        for (let j = 0; j < cols - 1; j++) {
          const a = i * cols + j;
          const b = a + 1;
          const c = (i + 1) * cols + j;
          const d = c + 1;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }
      const deckGeo = new THREE.BufferGeometry();
      deckGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      deckGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      deckGeo.setIndex(indices);
      deckGeo.computeVertexNormals();
      const deckMesh = new THREE.Mesh(deckGeo, promenadeMat);
      deckMesh.receiveShadow = true;
      group.add(deckMesh);
    }

    // B. Solid battered granite retaining seawall plunging from promenade edge down to y = -2.0m
    {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const botY = -2.2;

      for (let i = 0; i <= steps; i++) {
        const x = xStart + (segLen * i) / steps;
        const topY = getH(x, 35.0) + 0.165;
        const u = (x - xStart) * 0.24;
        const hSpan = topY - botY;

        // 0: top back, 1: top seaward front, 2: bottom seaward battered toe
        positions.push(x, topY, wallZ - 0.15);
        uvs.push(u, 0);

        positions.push(x, topY, wallZ + 0.85);
        uvs.push(u, 0.28);

        positions.push(x, botY, wallZ + 2.05);
        uvs.push(u, 0.28 + hSpan * 0.24);
      }

      for (let i = 0; i < steps; i++) {
        const p0 = i * 3;
        const p1 = (i + 1) * 3;
        // Top face
        indices.push(p0, p0 + 1, p1);
        indices.push(p0 + 1, p1 + 1, p1);
        // Battered seaward masonry wall face
        indices.push(p0 + 1, p0 + 2, p1 + 1);
        indices.push(p0 + 2, p1 + 2, p1 + 1);
      }

      // End caps at xStart and xEnd so masonry wall ends are solid stone blocks
      const capStartIdx = positions.length / 3;
      const yS = getH(xStart, 35.0) + 0.165;
      positions.push(
        xStart, yS, wallZ - 0.15,
        xStart, yS, wallZ + 0.85,
        xStart, botY, wallZ + 2.05,
        xStart, botY, wallZ - 0.15,
      );
      uvs.push(0, 0, 0.3, 0, 0.6, 1.5, 0, 1.5);
      indices.push(capStartIdx, capStartIdx + 3, capStartIdx + 1);
      indices.push(capStartIdx + 1, capStartIdx + 3, capStartIdx + 2);

      const capEndIdx = positions.length / 3;
      const yE = getH(xEnd, 35.0) + 0.165;
      positions.push(
        xEnd, yE, wallZ - 0.15,
        xEnd, yE, wallZ + 0.85,
        xEnd, botY, wallZ + 2.05,
        xEnd, botY, wallZ - 0.15,
      );
      uvs.push(0, 0, 0.3, 0, 0.6, 1.5, 0, 1.5);
      indices.push(capEndIdx, capEndIdx + 1, capEndIdx + 3);
      indices.push(capEndIdx + 1, capEndIdx + 2, capEndIdx + 3);

      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      wallGeo.setIndex(indices);
      wallGeo.computeVertexNormals();
      const wallMesh = new THREE.Mesh(wallGeo, seawallMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    }

    // C. Dressed granite coping curb running along the seawall top edge
    const midX = (xStart + xEnd) * 0.5;
    const avgTopY = getH(midX, 35.0) + 0.165;
    const copingMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.12, 0.22, 0.96), copingMat);
    copingMesh.position.set(midX, avgTopY + 0.11, wallZ + 0.42);
    copingMesh.castShadow = true;
    copingMesh.receiveShadow = true;
    group.add(copingMesh);

    // D. Carved granite bollards spaced every ~4.8m + sagging iron chains
    const bollardCount = Math.max(2, Math.round(segLen / 4.8) + 1);
    const bollardPositions: THREE.Vector3[] = [];
    for (let b = 0; b < bollardCount; b++) {
      const bx = xStart + 0.35 + ((segLen - 0.7) * b) / (bollardCount - 1);
      const by = getH(bx, 35.0) + 0.165 + 0.22;
      const bz = wallZ + 0.42;
      bollardPositions.push(new THREE.Vector3(bx, by + 0.72, bz));

      const postGroup = new THREE.Group();
      postGroup.position.set(bx, by, bz);

      const base = new THREE.Mesh(bollardBaseGeo, bollardMat);
      base.position.y = 0.11;
      base.castShadow = true;
      base.receiveShadow = true;
      postGroup.add(base);

      const shaft = new THREE.Mesh(bollardShaftGeo, bollardMat);
      shaft.position.y = 0.55;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      postGroup.add(shaft);

      const cap = new THREE.Mesh(bollardCapGeo, copingMat);
      cap.position.y = 1.01;
      cap.castShadow = true;
      postGroup.add(cap);

      // Iron eye-rings on east/west sides of bollard
      if (b > 0) {
        const ringL = new THREE.Mesh(ringGeo, ironMat);
        ringL.position.set(-0.17, 0.72, 0);
        ringL.rotation.y = Math.PI / 2;
        postGroup.add(ringL);
      }
      if (b < bollardCount - 1) {
        const ringR = new THREE.Mesh(ringGeo, ironMat);
        ringR.position.set(0.17, 0.72, 0);
        ringR.rotation.y = Math.PI / 2;
        postGroup.add(ringR);
      }

      group.add(postGroup);
    }

    // Sagging iron catenary chains between adjacent bollards
    for (let b = 0; b < bollardPositions.length - 1; b++) {
      const pA = bollardPositions[b].clone();
      const pB = bollardPositions[b + 1].clone();
      pA.x += 0.17;
      pB.x -= 0.17;
      const spanDist = pA.distanceTo(pB);
      const sag = Math.min(0.42, spanDist * 0.088);

      const chainPts: THREE.Vector3[] = [];
      const chainSegs = 10;
      for (let s = 0; s <= chainSegs; s++) {
        const t = s / chainSegs;
        const px = THREE.MathUtils.lerp(pA.x, pB.x, t);
        const py = THREE.MathUtils.lerp(pA.y, pB.y, t) - 4 * sag * t * (1 - t);
        const pz = THREE.MathUtils.lerp(pA.z, pB.z, t);
        chainPts.push(new THREE.Vector3(px, py, pz));
      }
      const curve = new THREE.CatmullRomCurve3(chainPts);
      const chainGeo = new THREE.TubeGeometry(curve, 12, 0.024, 5, false);
      const chainMesh = new THREE.Mesh(chainGeo, ironMat);
      chainMesh.castShadow = true;
      group.add(chainMesh);
    }

    // Seawall balustrade collider (keeps walkers safely on promenade while allowing full view)
    colliders.push({
      type: 'box',
      minX: xStart,
      maxX: xEnd,
      minZ: wallZ + 0.05,
      maxZ: wallZ + 1.05,
      maxY: avgTopY + 1.35,
    });
  }

  // Granite plaza landing directly north of the Beach Stairs connecting Jiayuguan Rd to the steps
  const stairTopY = getH(-26, 35.0) + 0.16;
  const landing = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.45, 5.2), promenadeMat);
  landing.position.set(-26, stairTopY - 0.22, 33.1);
  landing.receiveShadow = true;
  group.add(landing);

  return { group, colliders };
}

/**
 * 2. Wide Granite Beach Stone Staircase at x in [-30, -22], z in [35.5, 44.0]
 *    matching getWalkableHeight smoothly from promenade down to No. 2 Bathing Beach sand.
 */
function buildBeachStaircase(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): { group: THREE.Group; colliders: Collider[] } {
  const group = new THREE.Group();
  group.name = 'BeachStoneStaircase';
  const colliders: Collider[] = [];

  const s = ROAD_LAYOUT.BEACH_STAIRS;
  const centerX = (s.minX + s.maxX) * 0.5; // -26
  const totalWidth = s.maxX - s.minX; // 8.0
  const innerWidth = totalWidth - 1.1; // 6.9m walkable stairs
  const topY = ctx.getTerrainHeight(centerX, s.topZ);
  const bottomY = ctx.getTerrainHeight(centerX, s.bottomZ);
  const totalRun = s.bottomZ - s.topZ; // 8.5m
  const stepCount = 18;
  const stepDepth = totalRun / stepCount;
  const stepRise = (topY - bottomY) / stepCount;

  const stepMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.06,
    color: new THREE.Color(0xd5cec2),
    roughness: 0.82,
    metalness: 0.03,
  });

  const cheekMat = new THREE.MeshStandardMaterial({
    map: textures.seawallMap,
    bumpMap: textures.seawallBump,
    bumpScale: 0.12,
    roughness: 0.86,
    metalness: 0.04,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2b3036),
    roughness: 0.48,
    metalness: 0.78,
  });

  // Solid carved granite steps extending deep into embankment so zero underneath gaps
  for (let i = 0; i < stepCount; i++) {
    const zStart = s.topZ + i * stepDepth;
    const treadY = topY - (i + 0.5) * stepRise;
    const blockH = Math.max(0.9, treadY - bottomY + 1.4);

    const stepMesh = new THREE.Mesh(
      new THREE.BoxGeometry(innerWidth, blockH, stepDepth + 0.06),
      stepMat,
    );
    stepMesh.position.set(centerX, treadY - blockH * 0.5, zStart + stepDepth * 0.5);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    group.add(stepMesh);
  }

  // Bottom granite threshold slab smoothly embedded into the golden sand
  const bottomPad = new THREE.Mesh(new THREE.BoxGeometry(innerWidth + 0.8, 0.5, 1.4), stepMat);
  bottomPad.position.set(centerX, bottomY - 0.22, s.bottomZ + 0.55);
  bottomPad.receiveShadow = true;
  group.add(bottomPad);

  // Flanking sloped granite cheek-walls & dark iron handrails
  const cheekW = 0.65;
  const sideOffsets = [-(innerWidth * 0.5 + cheekW * 0.5), innerWidth * 0.5 + cheekW * 0.5];
  const slopeAngle = Math.atan2(topY - bottomY, totalRun);
  const slopeLen = Math.hypot(totalRun, topY - bottomY);

  for (const offX of sideOffsets) {
    const wx = centerX + offX;
    // Sloped masonry cheek-wall built as solid extruded shape in ZY
    const shape = new THREE.Shape();
    shape.moveTo(s.topZ - 0.3, bottomY - 1.5);
    shape.lineTo(s.bottomZ + 0.5, bottomY - 1.5);
    shape.lineTo(s.bottomZ + 0.5, bottomY + 0.72);
    shape.lineTo(s.topZ - 0.3, topY + 0.92);
    shape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: cheekW, bevelEnabled: false });
    // ExtrudeGeometry builds in XY extruded along +Z; rotate so shape X->+Z, shape Y->+Y, extrude depth->X
    extrudeGeo.translate(0, 0, -cheekW * 0.5);
    extrudeGeo.rotateY(-Math.PI / 2);
    // After rotateY(-PI/2): original X becomes +Z, original Z becomes -X! Check: (x,y,z) -> (-z, y, x).
    const cheekMesh = new THREE.Mesh(extrudeGeo, cheekMat);
    cheekMesh.position.x = wx;
    cheekMesh.castShadow = true;
    cheekMesh.receiveShadow = true;
    group.add(cheekMesh);

    // Granite newel pillars at top & bottom of each cheek wall
    const topNewel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.25, 0.76), stepMat);
    topNewel.position.set(wx, topY + 0.55, s.topZ - 0.1);
    topNewel.castShadow = true;
    topNewel.receiveShadow = true;
    group.add(topNewel);

    const botNewel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.05, 0.76), stepMat);
    botNewel.position.set(wx, bottomY + 0.42, s.bottomZ + 0.35);
    botNewel.castShadow = true;
    botNewel.receiveShadow = true;
    group.add(botNewel);

    // Collider ONLY for the cheek-wall, keeping the 6.9m stairs wide open
    colliders.push({
      type: 'box',
      minX: wx - cheekW * 0.55,
      maxX: wx + cheekW * 0.55,
      minZ: s.topZ - 0.4,
      maxZ: s.bottomZ + 0.6,
      maxY: topY + 1.4,
    });
  }

  // Center iron divider handrail along the wide granite beach staircase
  const railGeo = new THREE.CylinderGeometry(0.032, 0.032, slopeLen + 0.4, 8);
  railGeo.rotateX(Math.PI / 2 + slopeAngle);
  const centerRail = new THREE.Mesh(railGeo, railMat);
  centerRail.position.set(centerX, (topY + bottomY) * 0.5 + 0.92, (s.topZ + s.bottomZ) * 0.5);
  centerRail.castShadow = true;
  group.add(centerRail);

  for (let p = 0; p <= 4; p++) {
    const f = p / 4;
    const pz = THREE.MathUtils.lerp(s.topZ + 0.25, s.bottomZ - 0.25, f);
    const py = THREE.MathUtils.lerp(topY, bottomY, f);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.96, 8), railMat);
    post.position.set(centerX, py + 0.46, pz);
    post.castShadow = true;
    group.add(post);
  }

  return { group, colliders };
}

/**
 * 3. Walkable Curved Stone Breakwater Pier (第二海水浴場防波堤)
 *    + Iconic Red-and-White Striped Maritime Beacon Lighthouse at tip (-10, 98).
 */
function buildBreakwaterPier(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): {
  group: THREE.Group;
  colliders: Collider[];
  update: (elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
} {
  const group = new THREE.Group();
  group.name = 'BreakwaterPierAndBeacon';
  const colliders: Collider[] = [];

  const deckY = ROAD_LAYOUT.PIER_DECK_Y; // 1.65m
  const halfW = ROAD_LAYOUT.PIER_WIDTH * 0.5; // 2.2m
  const baseY = -4.5;

  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.07,
    color: new THREE.Color(0xd2cabd),
    roughness: 0.84,
    metalness: 0.04,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.seawallMap,
    bumpMap: textures.seawallBump,
    bumpScale: 0.16,
    roughness: 0.88,
    metalness: 0.04,
  });

  const kerbMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.05,
    color: new THREE.Color(0xdfd7ca),
    roughness: 0.78,
    metalness: 0.03,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x23272c),
    roughness: 0.52,
    metalness: 0.76,
  });

  // Low-tension smooth curve hugging ROAD_LAYOUT.PIER_POINTS closely so player walkable collision matches visual edges
  const rawPts = ROAD_LAYOUT.PIER_POINTS.map(([x, z]) => new THREE.Vector3(x, deckY, z));
  const pierCurve = new THREE.CatmullRomCurve3(rawPts, false, 'centripetal', 0.25);
  const segCount = 44;
  const sampled = pierCurve.getPoints(segCount);

  // Compute lateral normals along curve
  const frames: { pos: THREE.Vector3; tx: number; tz: number; nx: number; nz: number; dist: number }[] = [];
  let accum = 0;
  for (let i = 0; i < sampled.length; i++) {
    const p = sampled[i];
    if (i > 0) accum += p.distanceTo(sampled[i - 1]);
    const prev = sampled[Math.max(0, i - 1)];
    const next = sampled[Math.min(sampled.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(1e-5, Math.hypot(dx, dz));
    const tx = dx / len;
    const tz = dz / len;
    frames.push({ pos: p, tx, tz, nx: -tz, nz: tx, dist: accum });
  }

  // A. Granite Flagstone Deck Top (at exact y = 1.65m)
  {
    const vertCount = frames.length * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const lx = f.pos.x - f.nx * halfW;
      const lz = f.pos.z - f.nz * halfW;
      const rx = f.pos.x + f.nx * halfW;
      const rz = f.pos.z + f.nz * halfW;

      positions[i * 6] = lx;
      positions[i * 6 + 1] = deckY;
      positions[i * 6 + 2] = lz;
      uvs[i * 4] = 0;
      uvs[i * 4 + 1] = f.dist * 0.36;

      positions[i * 6 + 3] = rx;
      positions[i * 6 + 4] = deckY;
      positions[i * 6 + 5] = rz;
      uvs[i * 4 + 2] = halfW * 2 * 0.36;
      uvs[i * 4 + 3] = f.dist * 0.36;
    }

    for (let i = 0; i < frames.length - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // N x T = +Y (upward facing)
      indices.push(a, b, c);
      indices.push(b, d, c);
    }

    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    deckGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    deckGeo.setIndex(indices);
    deckGeo.computeVertexNormals();
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.receiveShadow = true;
    group.add(deckMesh);
  }

  // B. Battered Coursed Granite Side Walls plunging down to y = -4.5m
  const buildPierWallSide = (sideSign: -1 | 1) => {
    const vertCount = frames.length * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];
    const batterFlare = 0.95;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const topOff = sideSign * halfW;
      const botOff = sideSign * (halfW + batterFlare);

      const iTop = i * 2;
      const iBot = iTop + 1;
      positions[iTop * 3] = f.pos.x + f.nx * topOff;
      positions[iTop * 3 + 1] = deckY;
      positions[iTop * 3 + 2] = f.pos.z + f.nz * topOff;
      uvs[iTop * 2] = f.dist * 0.22;
      uvs[iTop * 2 + 1] = 0;

      positions[iBot * 3] = f.pos.x + f.nx * botOff;
      positions[iBot * 3 + 1] = baseY;
      positions[iBot * 3 + 2] = f.pos.z + f.nz * botOff;
      uvs[iBot * 2] = f.dist * 0.22;
      uvs[iBot * 2 + 1] = (deckY - baseY) * 0.22;
    }

    for (let i = 0; i < frames.length - 1; i++) {
      const t0 = i * 2;
      const b0 = t0 + 1;
      const t1 = t0 + 2;
      const b1 = t0 + 3;
      if (sideSign > 0) {
        // Outward normal = +N = (-Y) x T
        indices.push(t0, b0, t1);
        indices.push(b0, b1, t1);
      } else {
        // Outward normal = -N = T x (-Y)
        indices.push(t0, t1, b0);
        indices.push(b0, t1, b1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  buildPierWallSide(-1);
  buildPierWallSide(1);

  // C. Low Granite Coping Kerbs along both edges + Cast-Iron Mooring Bollards
  const buildEdgeKerb = (sideSign: -1 | 1) => {
    const kerbPts = frames.map(
      (f) =>
        new THREE.Vector3(
          f.pos.x + f.nx * sideSign * (halfW - 0.18),
          deckY + 0.11,
          f.pos.z + f.nz * sideSign * (halfW - 0.18),
        ),
    );
    // Extrude rectangular kerb profile smoothly along the curve using custom quad strip
    const kW = 0.17;
    const kH = 0.11;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    // 4 cross-section points around kerb: inner-bot, inner-top, outer-top, outer-bot
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const c = kerbPts[i];
      const inOff = -sideSign * kW;
      const outOff = sideSign * kW;
      const v = f.dist * 0.4;
      positions.push(
        c.x + f.nx * inOff, c.y - kH, c.z + f.nz * inOff,
        c.x + f.nx * inOff, c.y + kH, c.z + f.nz * inOff,
        c.x + f.nx * outOff, c.y + kH, c.z + f.nz * outOff,
        c.x + f.nx * outOff, c.y - kH, c.z + f.nz * outOff,
      );
      uvs.push(0, v, 0.25, v, 0.55, v, 0.8, v);
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      for (let e = 0; e < 3; e++) {
        const a = r0 + e;
        const b = r0 + e + 1;
        const c = r1 + e;
        const d = r1 + e + 1;
        if (sideSign > 0) {
          indices.push(a, b, c);
          indices.push(b, d, c);
        } else {
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, kerbMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  buildEdgeKerb(-1);
  buildEdgeKerb(1);

  // Cast-iron mooring cleats / maritime bollards spaced along the pier
  const cleatBaseGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.34, 10);
  const cleatCapGeo = new THREE.CylinderGeometry(0.20, 0.14, 0.08, 10);
  for (let i = 5; i < frames.length - 4; i += 8) {
    const f = frames[i];
    const side = i % 16 === 5 ? 1 : -1;
    const bx = f.pos.x + f.nx * side * (halfW - 0.32);
    const bz = f.pos.z + f.nz * side * (halfW - 0.32);

    const cleat = new THREE.Group();
    cleat.position.set(bx, deckY + 0.22, bz);
    const stem = new THREE.Mesh(cleatBaseGeo, ironMat);
    stem.position.y = 0.17;
    stem.castShadow = true;
    cleat.add(stem);
    const cap = new THREE.Mesh(cleatCapGeo, ironMat);
    cap.position.y = 0.36;
    cap.castShadow = true;
    cleat.add(cap);
    group.add(cleat);
  }

  // D. Smooth Granite Beach-to-Pier Approach Ramp matching getWalkableHeight (-46, 52.5) -> (-44, 58)
  {
    const startX = -46.0;
    const startZ = 52.5;
    const endX = -44.0;
    const endZ = 58.0;
    const startY = ctx.getTerrainHeight(startX, startZ);
    const dx = endX - startX;
    const dz = endZ - startZ;
    const rLen = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const pitch = Math.atan2(deckY - startY, rLen);

    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.1, 1.8, rLen + 0.8), deckMat);
    rampMesh.position.set((startX + endX) * 0.5, (startY + deckY) * 0.5 - 0.9, (startZ + endZ) * 0.5);
    rampMesh.rotation.order = 'YXZ';
    rampMesh.rotation.y = ang;
    rampMesh.rotation.x = -pitch;
    rampMesh.receiveShadow = true;
    rampMesh.castShadow = true;
    group.add(rampMesh);
  }

  // E. Circular Granite Pier-Head Bastion at (-10, 98)
  const tipFrame = frames[frames.length - 1];
  const tipX = tipFrame.pos.x;
  const tipZ = tipFrame.pos.z;
  const bastionH = deckY - baseY;

  const bastionBody = new THREE.Mesh(
    new THREE.CylinderGeometry(3.45, 4.35, bastionH, 24),
    wallMat,
  );
  bastionBody.position.set(tipX, baseY + bastionH * 0.5, tipZ);
  bastionBody.castShadow = true;
  bastionBody.receiveShadow = true;
  group.add(bastionBody);

  const bastionDeck = new THREE.Mesh(new THREE.CylinderGeometry(3.52, 3.52, 0.14, 24), deckMat);
  bastionDeck.position.set(tipX, deckY - 0.065, tipZ);
  bastionDeck.receiveShadow = true;
  group.add(bastionDeck);

  // Curved granite parapet rim around seaward half of bastion
  const bastionRim = new THREE.Mesh(
    new THREE.TorusGeometry(3.32, 0.16, 8, 24, Math.PI * 1.3),
    kerbMat,
  );
  bastionRim.rotation.x = Math.PI / 2;
  bastionRim.rotation.z = Math.atan2(tipFrame.tz, tipFrame.tx) - Math.PI * 0.65;
  bastionRim.position.set(tipX, deckY + 0.12, tipZ);
  bastionRim.castShadow = true;
  group.add(bastionRim);

  // F. Classic Qingdao Red-and-White Striped Cylindrical Maritime Beacon Lighthouse
  // Positioned slightly seaward on the bastion so players can stroll onto the bastion platform
  const lhX = tipX + tipFrame.tx * 1.15;
  const lhZ = tipZ + tipFrame.tz * 1.15;
  const lighthouse = new THREE.Group();
  lighthouse.name = 'PierMaritimeBeacon';
  lighthouse.position.set(lhX, deckY, lhZ);

  const redPaintMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xc4322a),
    roughness: 0.62,
    metalness: 0.08,
  });
  const whitePaintMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf2ede4),
    roughness: 0.65,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xfff1dc),
    emissive: new THREE.Color(0xff4a32),
    emissiveIntensity: 1.6,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  });

  // Octagonal granite pedestal
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.56, 1.15, 8), kerbMat);
  plinth.position.y = 0.575;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  lighthouse.add(plinth);

  // 5 alternating red & white tapered tower drums (total height 6.5m above plinth)
  const bandH = 1.3;
  let rBottom = 1.18;
  for (let b = 0; b < 5; b++) {
    const rTop = rBottom - 0.085;
    const bandMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, bandH + 0.01, 20),
      b % 2 === 0 ? whitePaintMat : redPaintMat,
    );
    bandMesh.position.y = 1.15 + b * bandH + bandH * 0.5;
    bandMesh.castShadow = true;
    bandMesh.receiveShadow = true;
    lighthouse.add(bandMesh);
    rBottom = rTop;
  }

  // Corbeled observation gallery deck & dark iron safety railing
  const galleryY = 1.15 + 5 * bandH; // 7.65m
  const galleryCorbel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.24, 0.84, 0.34, 20),
    whitePaintMat,
  );
  galleryCorbel.position.y = galleryY + 0.17;
  galleryCorbel.castShadow = true;
  lighthouse.add(galleryCorbel);

  const galleryTopRail = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.032, 6, 24), ironMat);
  galleryTopRail.rotation.x = Math.PI / 2;
  galleryTopRail.position.y = galleryY + 1.08;
  lighthouse.add(galleryTopRail);

  const galleryMidRail = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.022, 6, 24), ironMat);
  galleryMidRail.rotation.x = Math.PI / 2;
  galleryMidRail.position.y = galleryY + 0.72;
  lighthouse.add(galleryMidRail);

  for (let p = 0; p < 12; p++) {
    const a = (p / 12) * Math.PI * 2;
    const railPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.78, 6), ironMat);
    railPost.position.set(Math.cos(a) * 1.18, galleryY + 0.70, Math.sin(a) * 1.18);
    lighthouse.add(railPost);
  }

  // Lantern room glass cylinder & red mullions
  const lanternY = galleryY + 0.34;
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.15, 16), glassMat);
  lanternGlass.position.y = lanternY + 0.575;
  lighthouse.add(lanternGlass);

  for (let m = 0; m < 8; m++) {
    const a = (m / 8) * Math.PI * 2;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.18, 0.05), redPaintMat);
    mullion.position.set(Math.cos(a) * 0.68, lanternY + 0.58, Math.sin(a) * 0.68);
    lighthouse.add(mullion);
  }

  // Conical red maritime dome cap & brass lightning finial
  const dome = new THREE.Mesh(new THREE.ConeGeometry(0.84, 0.92, 18), redPaintMat);
  dome.position.y = lanternY + 1.15 + 0.46;
  dome.castShadow = true;
  lighthouse.add(dome);

  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.75, 8), ironMat);
  finial.position.y = lanternY + 1.15 + 1.15;
  lighthouse.add(finial);

  // Softly pulsing maritime beacon light + additive halo sprite
  const beaconLight = new THREE.PointLight(0xff5e42, 4.0, 28, 1.6);
  beaconLight.position.set(0, lanternY + 0.62, 0);
  lighthouse.add(beaconLight);

  const glowSpriteMat = new THREE.SpriteMaterial({
    map: textures.beaconGlowMap,
    color: new THREE.Color(0xff6b4a),
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSprite = new THREE.Sprite(glowSpriteMat);
  glowSprite.position.set(0, lanternY + 0.62, 0);
  glowSprite.scale.set(3.2, 3.2, 1);
  lighthouse.add(glowSprite);

  group.add(lighthouse);

  colliders.push({
    type: 'cylinder',
    x: lhX,
    z: lhZ,
    radius: 1.55,
    maxY: deckY + 10.5,
  });

  let moodBeaconScale = 0.55;

  const setMood = (mood: MoodConfig): void => {
    // Subtle warm maritime blink in sunny afternoon; rich luminous beacon in mist, sunset & night
    moodBeaconScale = Math.max(0.35, 0.35 + mood.lampIntensity * 1.15);
  };

  const update = (elapsed: number): void => {
    // Classic coastal maritime lighthouse double-flash rhythm every 4.2s
    const phase = (elapsed % 4.2) / 4.2;
    const flash1 = Math.exp(-Math.pow((phase - 0.16) / 0.055, 2));
    const flash2 = Math.exp(-Math.pow((phase - 0.32) / 0.055, 2));
    const pulse = 0.24 + 0.76 * Math.max(flash1, flash2);

    glassMat.emissiveIntensity = (0.75 + 2.4 * pulse) * moodBeaconScale;
    beaconLight.intensity = (1.6 + 8.5 * pulse) * moodBeaconScale;
    glowSpriteMat.opacity = Math.min(0.95, (0.28 + 0.62 * pulse) * Math.min(1.25, moodBeaconScale));
    const s = 2.0 + 2.2 * pulse * Math.min(1.3, moodBeaconScale);
    glowSprite.scale.set(s, s, 1);
  };

  return { group, colliders, update, setMood };
}

/**
 * 4. Classic Qingdao Wooden Beach Cabanas (第二海水浴場木質更衣室小屋):
 *    5 iconic cream-white painted timber changing huts with colorful slate-blue,
 *    terracotta-red, and coastal-teal pitched roofs tucked along the upper beach cove.
 */
function buildBeachCabanas(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): { group: THREE.Group; colliders: Collider[] } {
  const group = new THREE.Group();
  group.name = 'QingdaoBeachCabanas';
  const colliders: Collider[] = [];

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.cabanaWoodMap,
    bumpMap: textures.cabanaWoodBump,
    bumpScale: 0.04,
    roughness: 0.78,
    metalness: 0.02,
  });

  const trimWhiteMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf6f2ea),
    roughness: 0.72,
    metalness: 0.02,
  });

  const deckWoodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x9a7b5c),
    roughness: 0.86,
    metalness: 0.02,
  });

  const roofColors = [
    0xb64b3a, // classic Qingdao terracotta-red
    0x3a6782, // classic Qingdao slate-blue
    0x3b7870, // coastal jade-teal
    0xc0563c, // warm rust-terracotta
    0x345c76, // deep harbor slate-blue
  ];

  const doorColors = [0x3d667c, 0xb24a38, 0xc99642, 0x3b726a, 0xa84b3a];

  const placements: { x: number; z: number; rotY: number }[] = [
    { x: -63.8, z: 45.4, rotY: 0.14 },
    { x: -59.5, z: 44.7, rotY: 0.08 },
    { x: -55.2, z: 44.3, rotY: 0.02 },
    { x: -50.9, z: 44.6, rotY: -0.04 },
    { x: -46.7, z: 45.3, rotY: -0.10 },
  ];

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const groundY = ctx.getTerrainHeight(p.x, p.z);
    const cabana = new THREE.Group();
    cabana.position.set(p.x, groundY, p.z);
    cabana.rotation.y = p.rotY;

    const w = 2.95;
    const d = 2.55;
    const h = 2.38;
    const floorY = 0.28;

    // Grounded timber stilt posts & skirt extending 1.4m underground (NEVER floats on beach slope)
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1.65, d + 0.1), deckWoodMat);
    skirt.position.set(0, floorY - 0.825, 0);
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    cabana.add(skirt);

    // Front wooden boardwalk step extending seaward (+Z)
    const porch = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.16, 0.72), deckWoodMat);
    porch.position.set(0, floorY - 0.04, d * 0.5 + 0.34);
    porch.castShadow = true;
    porch.receiveShadow = true;
    cabana.add(porch);

    // Main cream-white tongue-and-groove timber cabin body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.set(0, floorY + h * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    cabana.add(body);

    // Corner white timber trim posts
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.14, h + 0.04, 0.14), trimWhiteMat);
        corner.position.set(sx * (w * 0.5), floorY + h * 0.5, sz * (d * 0.5));
        cabana.add(corner);
      }
    }

    // Slatted painted wooden door on seaward face (+Z)
    const doorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(doorColors[i]),
      roughness: 0.72,
      metalness: 0.04,
    });
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 2.02, 0.09), trimWhiteMat);
    doorFrame.position.set(0, floorY + 1.01, d * 0.5 + 0.02);
    cabana.add(doorFrame);

    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.88, 0.08), doorMat);
    doorPanel.position.set(0, floorY + 0.98, d * 0.5 + 0.04);
    doorPanel.castShadow = true;
    cabana.add(doorPanel);

    // Horizontal louvered ventilation slats on upper door
    for (let sl = 0; sl < 5; sl++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.04), trimWhiteMat);
      slat.position.set(0, floorY + 1.24 + sl * 0.11, d * 0.5 + 0.085);
      slat.rotation.x = 0.28;
      cabana.add(slat);
    }

    // Pitched triangular gable roof (extruded triangle with generous eaves overhang)
    const roofMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(roofColors[i]),
      roughness: 0.72,
      metalness: 0.06,
    });
    const roofPeak = 1.18;
    const roofHalfW = w * 0.5 + 0.34;
    const roofLen = d + 0.68;

    // Gable wall triangles under the roof
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-w * 0.5, 0);
    gableShape.lineTo(w * 0.5, 0);
    gableShape.lineTo(0, roofPeak - 0.12);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: d, bevelEnabled: false });
    gableGeo.translate(0, 0, -d * 0.5);
    const gableMesh = new THREE.Mesh(gableGeo, wallMat);
    gableMesh.position.set(0, floorY + h, 0);
    gableMesh.castShadow = true;
    cabana.add(gableMesh);

    // Two sloped roof planes with crisp white fascia trim
    const slopeLen = Math.hypot(roofHalfW, roofPeak);
    const slopeAng = Math.atan2(roofPeak, roofHalfW);

    for (const side of [-1, 1]) {
      const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.08, 0.11, roofLen), roofMat);
      roofSlab.position.set(
        side * roofHalfW * 0.5,
        floorY + h + roofPeak * 0.5 + 0.04,
        0,
      );
      roofSlab.rotation.z = -side * slopeAng;
      roofSlab.castShadow = true;
      roofSlab.receiveShadow = true;
      cabana.add(roofSlab);
    }

    // White ridge cap beam
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, roofLen + 0.06), trimWhiteMat);
    ridge.position.set(0, floorY + h + roofPeak + 0.04, 0);
    cabana.add(ridge);

    group.add(cabana);

    colliders.push({
      type: 'box',
      minX: p.x - 1.7,
      maxX: p.x + 1.7,
      minZ: p.z - 1.5,
      maxZ: p.z + 1.85,
      maxY: groundY + 4.0,
    });
  }

  return { group, colliders };
}

/**
 * 5. Distant Yellow Sea Headlands & Sailboats:
 *    - 太平角 (Taipingjiao) pine-and-granite peninsula to the East-Southeast
 *    - 匯泉角 & 小青島 (Huiquan Cape & Xiaoqingdao Islet + iconic white lighthouse) to the West-Southwest
 *    - 7 graceful distant white-sailed boats gently bobbing on Huiquan Bay
 */
function buildDistantCoastAndBoats(): {
  group: THREE.Group;
  update: (elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
} {
  const group = new THREE.Group();
  group.name = 'DistantYellowSeaHorizon';
  const rng = createRng(7741);

  const buildHeadland = (
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    maxH: number,
    seed: number,
    rotY = 0,
  ): THREE.Mesh => {
    const r = createRng(seed);
    const geo = new THREE.PlaneGeometry(rx * 2, rz * 2, 26, 18);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const p1 = r() * 6;
    const p2 = r() * 6;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const nx = lx / rx;
      const nz = lz / rz;
      const radial = Math.hypot(nx, nz);
      const ridge =
        0.72 +
        0.24 * Math.sin(nx * 3.4 + p1) * Math.cos(nz * 2.8 + p2) +
        0.12 * Math.cos(nx * 6.5 - nz * 5.2);
      const falloff = Math.max(0, 1 - radial * radial);
      const y = radial < 1.0 ? Math.pow(falloff, 1.35) * maxH * ridge - 2.2 : -3.5;
      pos.setY(i, y);

      // Coastal granite base blending into deep Qingdao coastal pine green crown
      const greenT = THREE.MathUtils.smoothstep(y, 2.5, 11.0);
      colors[i * 3] = THREE.MathUtils.lerp(0.56, 0.20, greenT);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.52, 0.34, greenT);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(0.46, 0.24, greenT);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0, cz);
    mesh.rotation.y = rotY;
    return mesh;
  };

  // A. 太平角 (Taipingjiao Headland) to the East-Southeast across the outer cove
  const taiping = buildHeadland(355, 175, 195, 105, 34, 7801, -0.28);
  group.add(taiping);

  // Subtle distant red-roofed villas nestled into Taipingjiao headland
  const distantRoofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb64a38),
    roughness: 0.85,
  });
  const distantWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdfd5c5),
    roughness: 0.9,
  });
  for (let v = 0; v < 8; v++) {
    const vx = 265 + rng() * 145;
    const vz = 138 + rng() * 62;
    const vy = 8 + rng() * 12;
    const villa = new THREE.Group();
    villa.position.set(vx, vy, vz);
    villa.rotation.y = rng() * Math.PI;
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), distantWallMat);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.6, 4), distantRoofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.2;
    villa.add(body, roof);
    group.add(villa);
  }

  // B. 匯泉角 (Huiquan Cape) & 小青島 (Xiaoqingdao Islet) far across Huiquan Bay to WSW
  const huiquan = buildHeadland(-470, 260, 175, 115, 38, 7802, 0.35);
  group.add(huiquan);

  const xiaoqingdao = buildHeadland(-375, 345, 72, 52, 16, 7803, 0.15);
  group.add(xiaoqingdao);

  // Iconic distant white octagonal Xiaoqingdao Lighthouse on the islet crest
  const xqdLh = new THREE.Group();
  xqdLh.position.set(-372, 12.2, 344);
  const whiteStoneMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.72 });
  const xqdTower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.5, 15.5, 8), whiteStoneMat);
  xqdTower.position.y = 7.75;
  const xqdLanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d6,
    emissive: new THREE.Color(0xffc864),
    emissiveIntensity: 1.0,
  });
  const xqdLantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 8), xqdLanternMat);
  xqdLantern.position.y = 16.5;
  const xqdCap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.2, 8), distantRoofMat);
  xqdCap.position.y = 18.8;
  xqdLh.add(xqdTower, xqdLantern, xqdCap);
  group.add(xqdLh);

  // C. Distant Yellow Sea Sailboats gently bobbing in Huiquan Bay
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xedeae2, roughness: 0.6 });
  const hullTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e4363, roughness: 0.65 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xfbf7ef,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });

  const boats: { obj: THREE.Group; baseY: number; phase: number; speed: number }[] = [];
  const boatCoords: [number, number, number, number][] = [
    [-145, 195, 0.7, 1.0],
    [-210, 265, 1.2, 1.25],
    [-65, 245, -0.5, 1.1],
    [42, 220, -1.1, 0.95],
    [135, 275, 0.4, 1.2],
    [-110, 340, 2.1, 1.35],
    [85, 355, -0.3, 1.3],
  ];

  const mainSailShape = new THREE.Shape();
  mainSailShape.moveTo(0, 0);
  mainSailShape.lineTo(0, 7.2);
  mainSailShape.lineTo(-3.4, 0.4);
  mainSailShape.closePath();
  const mainSailGeo = new THREE.ShapeGeometry(mainSailShape);

  const jibSailShape = new THREE.Shape();
  jibSailShape.moveTo(0.15, 0.4);
  jibSailShape.lineTo(0.15, 6.2);
  jibSailShape.lineTo(2.4, 0.5);
  jibSailShape.closePath();
  const jibSailGeo = new THREE.ShapeGeometry(jibSailShape);

  for (let i = 0; i < boatCoords.length; i++) {
    const [bx, bz, rotY, sc] = boatCoords[i];
    const boat = new THREE.Group();
    boat.position.set(bx, 0.15, bz);
    boat.rotation.y = rotY;
    boat.scale.setScalar(sc);

    const hull = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.1, 2.1), hullMat);
    hull.position.y = 0.25;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.95, 0.28, 2.15), hullTrimMat);
    stripe.position.y = 0.62;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 8.2, 6), hullTrimMat);
    mast.position.y = 4.6;
    const mainSail = new THREE.Mesh(mainSailGeo, sailMat);
    mainSail.position.set(0, 1.2, 0);
    const jibSail = new THREE.Mesh(jibSailGeo, sailMat);
    jibSail.position.set(0, 1.2, 0);

    boat.add(hull, stripe, mast, mainSail, jibSail);
    group.add(boat);
    boats.push({ obj: boat, baseY: 0.15, phase: i * 1.37, speed: 0.85 + (i % 3) * 0.18 });
  }

  const update = (elapsed: number): void => {
    for (const b of boats) {
      b.obj.position.y = b.baseY + Math.sin(elapsed * b.speed + b.phase) * 0.22;
      b.obj.rotation.z = Math.sin(elapsed * b.speed * 0.8 + b.phase) * 0.055;
      b.obj.rotation.x = Math.cos(elapsed * b.speed * 0.65 + b.phase * 1.4) * 0.035;
    }
  };

  const setMood = (mood: MoodConfig): void => {
    xqdLanternMat.emissiveIntensity = 0.5 + mood.lampIntensity * 2.8;
  };

  return { group, update, setMood };
}

export function buildCoastalStructures(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): CoastalStructuresResult {
  const group = new THREE.Group();
  group.name = 'BadaguanCoastalStructures';
  const colliders: Collider[] = [];

  const seawall = buildSeawallPromenade(ctx, textures);
  group.add(seawall.group);
  colliders.push(...seawall.colliders);

  const stairs = buildBeachStaircase(ctx, textures);
  group.add(stairs.group);
  colliders.push(...stairs.colliders);

  const pier = buildBreakwaterPier(ctx, textures);
  group.add(pier.group);
  colliders.push(...pier.colliders);

  const cabanas = buildBeachCabanas(ctx, textures);
  group.add(cabanas.group);
  colliders.push(...cabanas.colliders);

  const horizon = buildDistantCoastAndBoats();
  group.add(horizon.group);

  const update = (elapsed: number): void => {
    pier.update(elapsed);
    horizon.update(elapsed);
  };

  const setMood = (mood: MoodConfig): void => {
    pier.setMood(mood);
    horizon.setMood(mood);
  };

  return { group, colliders, update, setMood };
}
