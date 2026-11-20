import * as THREE from 'three';
import { Collider, MoodConfig, WorldContext } from '../types';
import {
  ROAD_LAYOUT,
  getRoadDistance,
  isOnBeach,
  isOnRoad,
  isOnSidewalk,
} from '../terrainMath';
import { FoliageTextureSet } from './foliageTextures';

export interface TreesSystemResult {
  group: THREE.Group;
  colliders: Collider[];
  update: (dt: number, elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
}

interface TreePlacement {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  color: THREE.Color;
  hasTreePit?: boolean;
  colliderRadius?: number;
  castShadow?: boolean;
}

interface TreePrototype {
  trunkGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
}

interface WindUniforms {
  uTime: { value: number };
  uWindStrength: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uBacklightColor: { value: THREE.Color };
  uBacklightStrength: { value: number };
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

/**
 * Self-contained BufferGeometry merger preserving position, normal, uv, and optional color.
 */
function mergeGeometries(geos: THREE.BufferGeometry[], includeColor = false): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position');
    totalVerts += pos.count;
    totalIndices += g.index ? g.index.count : pos.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = includeColor ? new Float32Array(totalVerts * 3) : null;
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const col = includeColor ? g.getAttribute('color') : null;
    const count = pos.count;

    positions.set(pos.array as Float32Array, vOffset * 3);
    if (norm) {
      normals.set(norm.array as Float32Array, vOffset * 3);
    }
    if (uv) {
      uvs.set(uv.array as Float32Array, vOffset * 2);
    }
    if (colors) {
      if (col) {
        colors.set(col.array as Float32Array, vOffset * 3);
      } else {
        for (let i = 0; i < count; i++) {
          const base = (vOffset + i) * 3;
          colors[base] = 1;
          colors[base + 1] = 1;
          colors[base + 2] = 1;
        }
      }
    }

    if (g.index) {
      const idxArr = g.index.array;
      for (let i = 0; i < idxArr.length; i++) {
        indices[iOffset + i] = idxArr[i] + vOffset;
      }
      iOffset += idxArr.length;
    } else {
      for (let i = 0; i < count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += count;
    }

    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) {
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Sweeps a smoothly tapered tubular limb along a CatmullRomCurve3 with root flare option.
 */
function buildTaperedBranch(
  controlPoints: THREE.Vector3[],
  rBottom: number,
  rTop: number,
  lengthSegments: number,
  radialSegments: number,
  rootFlare = false
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(controlPoints);
  const frames = curve.computeFrenetFrames(lengthSegments, false);
  const ringStride = radialSegments + 1;

  const positions = new Float32Array((lengthSegments + 1) * ringStride * 3);
  const normals = new Float32Array((lengthSegments + 1) * ringStride * 3);
  const uvs = new Float32Array((lengthSegments + 1) * ringStride * 2);
  const indices: number[] = [];

  const pt = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments;
    curve.getPointAt(t, pt);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    let radius = THREE.MathUtils.lerp(rBottom, rTop, Math.pow(t, 0.85));
    if (rootFlare && t < 0.16) {
      const f = 1 - t / 0.16;
      radius *= 1 + f * f * 0.42;
    }

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Subtle organic bark fluting at the root flare
      const flute = rootFlare && t < 0.2 ? 1 + (1 - t / 0.2) * 0.1 * Math.cos(theta * 5) : 1;
      const r = radius * flute;

      nrm
        .set(
          N.x * cosT + B.x * sinT,
          N.y * cosT + B.y * sinT,
          N.z * cosT + B.z * sinT
        )
        .normalize();

      const vIdx = i * ringStride + j;
      positions[vIdx * 3] = pt.x + nrm.x * r;
      positions[vIdx * 3 + 1] = pt.y + nrm.y * r;
      positions[vIdx * 3 + 2] = pt.z + nrm.z * r;

      normals[vIdx * 3] = nrm.x;
      normals[vIdx * 3 + 1] = nrm.y;
      normals[vIdx * 3 + 2] = nrm.z;

      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = t * 2.5;
    }
  }

  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a slightly cupped 4-triangle foliage card (5 vertices) with custom painter normals
 * pointing radially outward/upward from crownCenter and baked AO/sunlight vertex color.
 */
function buildCuppedLeafCard(
  center: THREE.Vector3,
  size: number,
  rotEuler: THREE.Euler,
  crownCenter: THREE.Vector3,
  crownRadius: number,
  shadeBias: number
): THREE.BufferGeometry {
  const half = size * 0.5;
  const cup = size * 0.14;
  // 5 verts: 4 corners + slightly cupped center so cards never look paper-thin edge-on
  const localPos = [
    new THREE.Vector3(-half, -half, 0),
    new THREE.Vector3(half, -half, 0),
    new THREE.Vector3(half, half, 0),
    new THREE.Vector3(-half, half, 0),
    new THREE.Vector3(0, 0, cup),
  ];
  const localUv: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.5, 0.5],
  ];

  const quat = new THREE.Quaternion().setFromEuler(rotEuler);
  const positions = new Float32Array(5 * 3);
  const normals = new Float32Array(5 * 3);
  const uvs = new Float32Array(5 * 2);
  const colors = new Float32Array(5 * 3);

  const worldPt = new THREE.Vector3();
  const radialN = new THREE.Vector3();

  for (let i = 0; i < 5; i++) {
    worldPt.copy(localPos[i]).applyQuaternion(quat).add(center);
    positions[i * 3] = worldPt.x;
    positions[i * 3 + 1] = worldPt.y;
    positions[i * 3 + 2] = worldPt.z;

    uvs[i * 2] = localUv[i][0];
    uvs[i * 2 + 1] = localUv[i][1];

    // Smooth painterly crown-normal for lush soft shading across intersecting cards
    radialN.subVectors(worldPt, crownCenter);
    const dist = radialN.length();
    if (dist > 0.001) radialN.divideScalar(dist);
    else radialN.set(0, 1, 0);
    radialN.y += 0.35;
    radialN.normalize();

    normals[i * 3] = radialN.x;
    normals[i * 3 + 1] = radialN.y;
    normals[i * 3 + 2] = radialN.z;

    // Height + radial outer sunlight gradient with warm AO shade underneath/inside
    const outerT = THREE.MathUtils.clamp(dist / Math.max(0.5, crownRadius), 0, 1.15);
    const heightT = THREE.MathUtils.clamp(
      (worldPt.y - (crownCenter.y - crownRadius * 0.7)) / (crownRadius * 1.55),
      0,
      1
    );
    const lit = THREE.MathUtils.clamp(0.46 + outerT * 0.28 + heightT * 0.34 + shadeBias, 0.42, 1.14);

    // Subtle warm sunlit lift at tips, richer warm shadow inside
    colors[i * 3] = lit * 1.02;
    colors[i * 3 + 1] = lit * (0.94 + heightT * 0.08);
    colors[i * 3 + 2] = lit * (0.86 + heightT * 0.1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
  return geo;
}

/** Spawns a dense painterly cloud of tilted cupped foliage cards around a branch node. */
function appendFoliageCloud(
  cardsOut: THREE.BufferGeometry[],
  nodeCenter: THREE.Vector3,
  cloudRadiusX: number,
  cloudRadiusY: number,
  cardCount: number,
  cardSize: number,
  crownCenter: THREE.Vector3,
  crownRadius: number,
  rand: () => number
): void {
  const pos = new THREE.Vector3();
  const euler = new THREE.Euler();

  for (let i = 0; i < cardCount; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / cardCount));
    const theta = i * 2.399963 + rand() * 0.7; // Golden angle distribution
    const r = 0.22 + 0.78 * Math.pow(rand(), 0.55);

    pos.set(
      nodeCenter.x + Math.sin(phi) * Math.cos(theta) * cloudRadiusX * r,
      nodeCenter.y + Math.cos(phi) * cloudRadiusY * r,
      nodeCenter.z + Math.sin(phi) * Math.sin(theta) * cloudRadiusX * r
    );

    euler.set(
      (rand() - 0.5) * 1.65,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 1.45
    );

    const sz = cardSize * (0.78 + rand() * 0.44);
    const bias = (rand() - 0.5) * 0.14;
    cardsOut.push(buildCuppedLeafCard(pos, sz, euler, crownCenter, crownRadius, bias));
  }
}

/**
 * Builds a towering arching Qingdao Ginkgo tree (銀杏) designed to form
 * a cathedral-like golden tunnel over 居庸關路 while leaving ~4.2m walkable headroom.
 */
function createGinkgoPrototype(seed: number, dense = true): TreePrototype {
  const rand = mulberry32(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];

  const totalH = 11.8 + rand() * 1.6;
  const forkY = 4.2 + rand() * 0.5;
  const leanX = (rand() - 0.5) * 0.45;
  const leanZ = (rand() - 0.5) * 0.45;

  // Main trunk buried -0.45m into earth so it never floats on slopes
  trunkParts.push(
    buildTaperedBranch(
      [
        new THREE.Vector3(0, -0.45, 0),
        new THREE.Vector3(leanX * 0.3, forkY * 0.48, leanZ * 0.3),
        new THREE.Vector3(leanX * 0.8, forkY, leanZ * 0.8),
        new THREE.Vector3(leanX * 1.0, totalH * 0.78, leanZ * 1.0),
        new THREE.Vector3(leanX * 0.7, totalH * 0.94, leanZ * 0.7),
      ],
      0.34,
      0.06,
      10,
      7,
      true
    )
  );

  const crownCenter = new THREE.Vector3(leanX, forkY + (totalH - forkY) * 0.52, leanZ);
  const crownRadius = 5.4;
  const boughNodes: { pos: THREE.Vector3; rx: number; ry: number; count: number; sz: number }[] = [];

  // 6 sweeping ascending & arching primary limbs
  const limbCount = 6;
  for (let i = 0; i < limbCount; i++) {
    const ang = (i / limbCount) * Math.PI * 2 + (rand() - 0.5) * 0.38;
    const startY = forkY + (i % 3) * 0.95 + rand() * 0.5;
    const reach = 3.8 + rand() * 1.6;
    const endY = startY + 3.2 + rand() * 2.1;

    const p0 = new THREE.Vector3(leanX * 0.8, startY, leanZ * 0.8);
    const p1 = new THREE.Vector3(
      p0.x + Math.cos(ang) * reach * 0.48,
      startY + (endY - startY) * 0.58,
      p0.z + Math.sin(ang) * reach * 0.48
    );
    const p2 = new THREE.Vector3(
      p0.x + Math.cos(ang) * reach,
      endY,
      p0.z + Math.sin(ang) * reach
    );

    trunkParts.push(buildTaperedBranch([p0, p1, p2], 0.16, 0.04, 6, 5, false));

    boughNodes.push({
      pos: p2.clone().add(new THREE.Vector3(0, 0.3, 0)),
      rx: 2.35,
      ry: 1.75,
      count: dense ? 14 : 7,
      sz: dense ? 2.15 : 2.55,
    });
    boughNodes.push({
      pos: p1.clone().add(new THREE.Vector3(0, 0.55, 0)),
      rx: 1.9,
      ry: 1.45,
      count: dense ? 9 : 5,
      sz: dense ? 1.95 : 2.3,
    });

    // Secondary spreading bough reaching further to arch across the street
    const subAng = ang + (i % 2 === 0 ? 0.55 : -0.55);
    const subReach = 2.0 + rand() * 1.1;
    const sEnd = new THREE.Vector3(
      p1.x + Math.cos(subAng) * subReach,
      p1.y + 1.5 + rand() * 1.1,
      p1.z + Math.sin(subAng) * subReach
    );
    trunkParts.push(buildTaperedBranch([p1, sEnd], 0.09, 0.03, 4, 4, false));

    boughNodes.push({
      pos: sEnd,
      rx: 2.0,
      ry: 1.45,
      count: dense ? 10 : 5,
      sz: dense ? 2.0 : 2.4,
    });
  }

  // Luminous rounded spire crown top
  boughNodes.push({
    pos: new THREE.Vector3(leanX * 0.7, totalH * 0.94, leanZ * 0.7),
    rx: 2.55,
    ry: 2.0,
    count: dense ? 16 : 8,
    sz: dense ? 2.1 : 2.5,
  });

  for (const node of boughNodes) {
    appendFoliageCloud(
      canopyParts,
      node.pos,
      node.rx,
      node.ry,
      node.count,
      node.sz,
      crownCenter,
      crownRadius,
      rand
    );
  }

  return {
    trunkGeo: mergeGeometries(trunkParts, false),
    canopyGeo: mergeGeometries(canopyParts, true),
  };
}

/**
 * Builds a sculptural spreading Five-Pointed Maple tree (五角楓) for 嘉峪關路.
 */
function createMaplePrototype(seed: number, dense = true): TreePrototype {
  const rand = mulberry32(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];

  const forkY = 3.1 + rand() * 0.4;
  const totalH = 9.2 + rand() * 1.3;
  const leanX = (rand() - 0.5) * 0.4;
  const leanZ = (rand() - 0.5) * 0.4;

  trunkParts.push(
    buildTaperedBranch(
      [
        new THREE.Vector3(0, -0.45, 0),
        new THREE.Vector3(leanX * 0.4, forkY * 0.55, leanZ * 0.4),
        new THREE.Vector3(leanX, forkY + 0.4, leanZ),
      ],
      0.3,
      0.16,
      6,
      7,
      true
    )
  );

  const crownCenter = new THREE.Vector3(leanX, forkY + 3.4, leanZ);
  const crownRadius = 5.0;

  const limbCount = 5;
  for (let i = 0; i < limbCount; i++) {
    const ang = (i / limbCount) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const reach = 3.6 + rand() * 1.3;
    const midY = forkY + 2.0 + rand() * 0.7;
    const tipY = forkY + 3.5 + rand() * 1.6;

    const p0 = new THREE.Vector3(leanX, forkY + 0.25, leanZ);
    const p1 = new THREE.Vector3(
      p0.x + Math.cos(ang) * reach * 0.52,
      midY,
      p0.z + Math.sin(ang) * reach * 0.52
    );
    const p2 = new THREE.Vector3(
      p0.x + Math.cos(ang) * reach,
      tipY,
      p0.z + Math.sin(ang) * reach
    );

    trunkParts.push(buildTaperedBranch([p0, p1, p2], 0.14, 0.035, 6, 5, false));

    appendFoliageCloud(
      canopyParts,
      p2,
      2.3,
      1.35,
      dense ? 14 : 7,
      dense ? 2.0 : 2.4,
      crownCenter,
      crownRadius,
      rand
    );
    appendFoliageCloud(
      canopyParts,
      p1.clone().add(new THREE.Vector3(0, 0.55, 0)),
      1.8,
      1.15,
      dense ? 8 : 4,
      dense ? 1.85 : 2.2,
      crownCenter,
      crownRadius,
      rand
    );

    // Wide graceful horizontal lateral bough
    const subA = ang + (i % 2 === 0 ? 0.62 : -0.62);
    const sTip = new THREE.Vector3(
      p1.x + Math.cos(subA) * 2.1,
      p1.y + 0.95 + rand() * 0.6,
      p1.z + Math.sin(subA) * 2.1
    );
    trunkParts.push(buildTaperedBranch([p1, sTip], 0.08, 0.025, 4, 4, false));
    appendFoliageCloud(
      canopyParts,
      sTip,
      1.95,
      1.15,
      dense ? 10 : 5,
      dense ? 1.9 : 2.3,
      crownCenter,
      crownRadius,
      rand
    );
  }

  // Broad dome crown top
  appendFoliageCloud(
    canopyParts,
    new THREE.Vector3(leanX, totalH - 1.3, leanZ),
    2.65,
    1.55,
    dense ? 16 : 8,
    dense ? 2.05 : 2.45,
    crownCenter,
    crownRadius,
    rand
  );

  return {
    trunkGeo: mergeGeometries(trunkParts, false),
    canopyGeo: mergeGeometries(canopyParts, true),
  };
}

/**
 * Builds a stately tall mottled-bark French Plane tree (法國梧桐) for 山海關路 & 黃海路.
 */
function createPlanePrototype(seed: number, dense = true): TreePrototype {
  const rand = mulberry32(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];

  const forkY = 4.6 + rand() * 0.6;
  const totalH = 13.0 + rand() * 1.4;

  trunkParts.push(
    buildTaperedBranch(
      [
        new THREE.Vector3(0, -0.45, 0),
        new THREE.Vector3(0.15, forkY * 0.5, -0.1),
        new THREE.Vector3(-0.08, forkY, 0.12),
        new THREE.Vector3(0.05, totalH * 0.78, 0.04),
      ],
      0.38,
      0.11,
      8,
      7,
      true
    )
  );

  const crownCenter = new THREE.Vector3(0, forkY + 4.4, 0);
  const crownRadius = 5.9;

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const startY = forkY + (i % 2) * 1.15;
    const reach = 4.2 + rand() * 1.3;
    const endY = startY + 3.6 + rand() * 1.8;

    const p0 = new THREE.Vector3(0, startY, 0);
    const p1 = new THREE.Vector3(
      Math.cos(ang) * reach * 0.52,
      startY + (endY - startY) * 0.55,
      Math.sin(ang) * reach * 0.52
    );
    const p2 = new THREE.Vector3(Math.cos(ang) * reach, endY, Math.sin(ang) * reach);

    trunkParts.push(buildTaperedBranch([p0, p1, p2], 0.17, 0.045, 6, 5, false));

    appendFoliageCloud(
      canopyParts,
      p2,
      2.6,
      1.8,
      dense ? 14 : 7,
      dense ? 2.3 : 2.7,
      crownCenter,
      crownRadius,
      rand
    );
    appendFoliageCloud(
      canopyParts,
      p1.clone().add(new THREE.Vector3(0, 0.6, 0)),
      2.0,
      1.4,
      dense ? 8 : 4,
      dense ? 2.1 : 2.5,
      crownCenter,
      crownRadius,
      rand
    );
  }

  appendFoliageCloud(
    canopyParts,
    new THREE.Vector3(0, totalH - 1.2, 0),
    2.9,
    2.0,
    dense ? 16 : 8,
    dense ? 2.3 : 2.65,
    crownCenter,
    crownRadius,
    rand
  );

  return {
    trunkGeo: mergeGeometries(trunkParts, false),
    canopyGeo: mergeGeometries(canopyParts, true),
  };
}

/**
 * Builds a sculptural gnarled Qingdao Coastal Black Pine (青島黑松) with
 * wind-sculpted sinuous trunk and flat-topped emerald cloud needle tiers.
 */
function createBlackPinePrototype(seed: number, windswept: boolean, dense = true): TreePrototype {
  const rand = mulberry32(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];

  const totalH = windswept ? 7.6 + rand() * 1.5 : 10.6 + rand() * 1.8;
  const bendX = windswept ? -1.4 - rand() * 0.8 : (rand() - 0.5) * 0.7;
  const bendZ = windswept ? -1.8 - rand() * 0.9 : (rand() - 0.5) * 0.7; // Leans gently inland away from Yellow Sea winds

  const trunkPts = [
    new THREE.Vector3(0, -0.55, 0),
    new THREE.Vector3(bendX * 0.25 + 0.35, totalH * 0.25, bendZ * 0.2),
    new THREE.Vector3(bendX * 0.58 - 0.22, totalH * 0.54, bendZ * 0.55),
    new THREE.Vector3(bendX * 0.88, totalH * 0.82, bendZ * 0.88),
    new THREE.Vector3(bendX, totalH, bendZ),
  ];

  trunkParts.push(buildTaperedBranch(trunkPts, 0.34, 0.08, 10, 7, true));
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);

  const crownCenter = new THREE.Vector3(bendX * 0.75, totalH * 0.74, bendZ * 0.75);
  const crownRadius = 4.6;

  // Tiered horizontal cloud pads characteristic of coastal Pinus thunbergii
  const tiers = windswept ? 5 : 6;
  for (let i = 0; i < tiers; i++) {
    const t = 0.44 + (i / (tiers - 1)) * 0.5;
    const origin = trunkCurve.getPointAt(t);
    const boughsOnTier = i === tiers - 1 ? 3 : 2;

    for (let b = 0; b < boughsOnTier; b++) {
      const ang = i * 2.25 + b * 2.8 + (rand() - 0.5) * 0.5;
      const reach = (1.15 - t * 0.48) * (windswept ? 4.4 : 4.0) + rand() * 0.8;
      // Bias branches subtly inland on windswept coastal pines
      const dirX = Math.cos(ang) * reach + (windswept ? bendX * 0.28 : 0);
      const dirZ = Math.sin(ang) * reach + (windswept ? bendZ * 0.28 : 0);

      const mid = new THREE.Vector3(
        origin.x + dirX * 0.55,
        origin.y - 0.25 + rand() * 0.35,
        origin.z + dirZ * 0.55
      );
      const tip = new THREE.Vector3(
        origin.x + dirX,
        origin.y + 0.22 + rand() * 0.42,
        origin.z + dirZ
      );

      trunkParts.push(buildTaperedBranch([origin, mid, tip], 0.12, 0.035, 5, 5, false));

      // Flat, layered coastal pine needle pad
      appendFoliageCloud(
        canopyParts,
        tip.clone().add(new THREE.Vector3(0, 0.22, 0)),
        2.15,
        0.76,
        dense ? 12 : 6,
        dense ? 1.85 : 2.25,
        crownCenter,
        crownRadius,
        rand
      );
    }
  }

  // Sculpted umbrella pine crown cap
  appendFoliageCloud(
    canopyParts,
    new THREE.Vector3(bendX, totalH + 0.15, bendZ),
    2.6,
    0.95,
    dense ? 16 : 8,
    dense ? 1.95 : 2.35,
    crownCenter,
    crownRadius,
    rand
  );

  return {
    trunkGeo: mergeGeometries(trunkParts, false),
    canopyGeo: mergeGeometries(canopyParts, true),
  };
}

/** Builds a lush multi-card garden shrub / hydrangea bush prototype (never a bare sphere). */
function createShrubPrototype(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const cards: THREE.BufferGeometry[] = [];
  const crownCenter = new THREE.Vector3(0, 0.55, 0);
  appendFoliageCloud(cards, crownCenter, 0.92, 0.62, 22, 0.88, crownCenter, 1.0, rand);
  return mergeGeometries(cards, true);
}

/**
 * Attaches gentle GPU wind sway + backlit sun translucency to foliage MeshStandardMaterial.
 */
function createWindFoliageMaterial(
  map: THREE.Texture,
  windUniforms: WindUniforms,
  roughness = 0.78
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness,
    metalness: 0.0,
  });

  mat.customProgramCacheKey = () => 'badaguan-foliage-wind-v1';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uSunDir = windUniforms.uSunDir;
    shader.uniforms.uBacklightColor = windUniforms.uBacklightColor;
    shader.uniforms.uBacklightStrength = windUniforms.uBacklightStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;
        varying float vCanopyHeight;
        varying vec3 vWorldPosCustom;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vCanopyHeight = smoothstep(0.6, 10.5, transformed.y);
        vec4 localInstPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          localInstPos = instanceMatrix * localInstPos;
        #endif
        vec3 wpCustom = (modelMatrix * localInstPos).xyz;
        float swayPhase = wpCustom.x * 0.15 + wpCustom.z * 0.13;
        float gust = sin(uTime * 1.15 + swayPhase) + 0.42 * sin(uTime * 2.35 + swayPhase * 1.8 + transformed.y * 0.6);
        float flutter = sin(uTime * 4.1 + wpCustom.x * 1.6 + wpCustom.z * 1.4 + transformed.y * 2.2) * 0.04;
        float swayAmp = vCanopyHeight * uWindStrength;
        transformed.x += (gust * 0.15 + flutter) * swayAmp;
        transformed.z += (cos(uTime * 0.9 + swayPhase * 1.1) * 0.11 + flutter * 0.7) * swayAmp;
        transformed.y += sin(uTime * 3.0 + swayPhase * 2.0 + transformed.x * 1.3) * 0.024 * swayAmp;
        vWorldPosCustom = wpCustom;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uBacklightColor;
        uniform float uBacklightStrength;
        varying float vCanopyHeight;
        varying vec3 vWorldPosCustom;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 vDirW = normalize(cameraPosition - vWorldPosCustom);
        float backGlow = pow(max(0.0, dot(-vDirW, normalize(uSunDir))), 2.6);
        float canopySun = 0.32 + 0.68 * vCanopyHeight;
        totalEmissiveRadiance += diffuseColor.rgb * uBacklightColor * (0.12 + 0.88 * backGlow) * canopySun * uBacklightStrength;`
      );
  };

  return mat;
}

/** Checks whether (x, z) falls inside any hero villa building footprint or approach corridor. */
function isInsideBuildingExclusion(x: number, z: number): boolean {
  // Huashilou granite castle + terrace + entrance court
  if (Math.hypot(x - ROAD_LAYOUT.HUASHILOU_CENTER.x, z - ROAD_LAYOUT.HUASHILOU_CENTER.z) < 12.8) {
    return true;
  }
  // Approach path from Huanghai Rd to Huashilou gate
  const vx = 34 - 24;
  const vz = 50 - 33.5;
  const t = THREE.MathUtils.clamp(((x - 24) * vx + (z - 33.5) * vz) / (vx * vx + vz * vz), 0, 1);
  if (Math.hypot(x - (24 + vx * t), z - (33.5 + vz * t)) < 5.6) {
    return true;
  }
  // Princess House main villa + front gravel walk
  if (x > -11.5 && x < 9.5 && z > -59.5 && z < -39.5) return true;
  if (x > -4.8 && x < 2.8 && z > -42.0 && z < -30.0) return true;

  // Butterfly House main villa + front/back walks
  if (x > -11.5 && x < 9.5 && z > -9.5 && z < 11.5) return true;
  if (x > -4.8 && x < 2.8 && z > -18.0 && z < 20.5) return true;

  // 4 surrounding historic villas
  if (x > -68 && x < -44 && z > -60 && z < -38) return true; // NW
  if (x > 40 && x < 64 && z > -60 && z < -38) return true; // NE
  if (x > -68 && x < -44 && z > -10 && z < 12) return true; // SW
  if (x > 40 && x < 64 && z > -10 && z < 12) return true; // SE

  // Beach changing cabanas area
  if (x > -67 && x < -44 && z > 40 && z < 53) return true;

  // Beach staircase corridor
  if (x > -32.5 && x < -19.5 && z > 30.5 && z < 47) return true;

  return false;
}

/** Builds a terrain-conforming fallen autumn leaf carpet mesh without z-fighting. */
function buildFallenLeafCarpetMesh(
  cx: number,
  cz: number,
  width: number,
  length: number,
  rotY: number,
  ctx: WorldContext,
  material: THREE.MeshStandardMaterial
): THREE.Mesh {
  const segX = 6;
  const segZ = 6;
  const geo = new THREE.PlaneGeometry(width, length, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.getAttribute('position');
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = cx + lx * cosR - lz * sinR;
    const wz = cz + lx * sinR + lz * cosR;

    const baseH = ctx.getTerrainHeight(wx, wz);
    let lift = 0.055;
    if (isOnSidewalk(wx, wz)) {
      lift = 0.205;
    } else if (isOnRoad(wx, wz)) {
      lift = 0.092;
    }

    pos.setXYZ(i, wx, baseH + lift, wz);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = 2;
  return mesh;
}

/** Adds autumn climbing ivy (爬山虎) panels draping cleanly over garden stone walls. */
function buildClimbingIvy(
  group: THREE.Group,
  ctx: WorldContext,
  textures: FoliageTextureSet,
  windUniforms: WindUniforms
): void {
  const ivyMat = createWindFoliageMaterial(textures.ivyCluster, windUniforms, 0.85);
  const ivyGeo = new THREE.PlaneGeometry(3.4, 1.85, 3, 2);

  // Add subtle outward drape curvature + vertical sunlit vertex color gradient (required for vertexColors: true!)
  const pos = ivyGeo.getAttribute('position');
  const ivyColors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / 3.4;
    const v = pos.getY(i) / 1.85;
    pos.setZ(i, Math.cos(u * Math.PI) * 0.08 + (v > 0 ? 0.04 : 0));
    const tY = THREE.MathUtils.clamp(v + 0.5, 0, 1);
    const lum = 0.72 + tY * 0.34;
    ivyColors[i * 3] = lum * 1.02;
    ivyColors[i * 3 + 1] = lum * 0.96;
    ivyColors[i * 3 + 2] = lum * 0.9;
  }
  ivyGeo.setAttribute('color', new THREE.BufferAttribute(ivyColors, 3));
  ivyGeo.computeVertexNormals();

  // Wall segments along Princess, Butterfly, and surrounding courtyard granite walls (skipping gates!)
  const wallPatches: { x: number; z: number; rotY: number; scaleX: number; scaleY: number; h: number }[] = [
    // Butterfly House north wall (outer face z = -15.72 facing north -Z toward Juyongguan Rd)
    { x: -14.5, z: -15.78, rotY: Math.PI, scaleX: 1.05, scaleY: 0.92, h: 0.95 },
    { x: -9.2, z: -15.78, rotY: Math.PI, scaleX: 0.95, scaleY: 0.88, h: 0.95 },
    { x: 7.4, z: -15.78, rotY: Math.PI, scaleX: 1.1, scaleY: 0.96, h: 0.95 },
    { x: 12.8, z: -15.78, rotY: Math.PI, scaleX: 1.0, scaleY: 0.85, h: 0.95 },
    // Butterfly House south wall (outer face z = 18.22 facing south +Z toward Shanhaiguan Rd)
    { x: -13.8, z: 18.28, rotY: 0, scaleX: 1.1, scaleY: 0.95, h: 0.95 },
    { x: -8.5, z: 18.28, rotY: 0, scaleX: 0.9, scaleY: 0.82, h: 0.95 },
    { x: 8.2, z: 18.28, rotY: 0, scaleX: 1.05, scaleY: 0.92, h: 0.95 },
    { x: 13.4, z: 18.28, rotY: 0, scaleX: 0.95, scaleY: 0.88, h: 0.95 },
    // Butterfly House west wall facing Jiayuguan Rd (outer face x = -18.22 facing -X)
    { x: -18.28, z: -9.5, rotY: -Math.PI / 2, scaleX: 1.15, scaleY: 0.95, h: 0.95 },
    { x: -18.28, z: -2.0, rotY: -Math.PI / 2, scaleX: 1.25, scaleY: 1.0, h: 0.95 },
    { x: -18.28, z: 6.5, rotY: -Math.PI / 2, scaleX: 1.1, scaleY: 0.9, h: 0.95 },
    { x: -18.28, z: 13.0, rotY: -Math.PI / 2, scaleX: 1.0, scaleY: 0.88, h: 0.95 },
    // Butterfly House east wall facing Huanghai Rd (outer face x = 16.22 facing +X)
    { x: 16.28, z: -8.0, rotY: Math.PI / 2, scaleX: 1.1, scaleY: 0.92, h: 0.95 },
    { x: 16.28, z: 2.0, rotY: Math.PI / 2, scaleX: 1.2, scaleY: 0.95, h: 0.95 },
    { x: 16.28, z: 11.0, rotY: Math.PI / 2, scaleX: 1.0, scaleY: 0.85, h: 0.95 },
    // Princess House low granite front wall (outer face z = -32.31, height 0.85m under white pickets)
    { x: -14.2, z: -32.25, rotY: 0, scaleX: 1.0, scaleY: 0.56, h: 0.56 },
    { x: -9.0, z: -32.25, rotY: 0, scaleX: 0.85, scaleY: 0.54, h: 0.56 },
    { x: 7.5, z: -32.25, rotY: 0, scaleX: 0.95, scaleY: 0.56, h: 0.56 },
    { x: 12.6, z: -32.25, rotY: 0, scaleX: 1.0, scaleY: 0.55, h: 0.56 },
    // NW / SW / NE / SE villa stone garden wall accents facing the avenues
    { x: -33.72, z: -54, rotY: Math.PI / 2, scaleX: 1.2, scaleY: 0.95, h: 1.0 },
    { x: -33.72, z: -42, rotY: Math.PI / 2, scaleX: 1.15, scaleY: 0.9, h: 1.0 },
    { x: -33.72, z: -6, rotY: Math.PI / 2, scaleX: 1.25, scaleY: 0.95, h: 1.0 },
    { x: -33.72, z: 8, rotY: Math.PI / 2, scaleX: 1.15, scaleY: 0.9, h: 1.0 },
    { x: -45, z: -32.25, rotY: 0, scaleX: 1.25, scaleY: 0.92, h: 1.0 },
    { x: -62, z: -32.25, rotY: 0, scaleX: 1.2, scaleY: 0.88, h: 1.0 },
    { x: 44, z: -32.25, rotY: 0, scaleX: 1.25, scaleY: 0.95, h: 1.0 },
    { x: 60, z: -32.25, rotY: 0, scaleX: 1.15, scaleY: 0.9, h: 1.0 },
    { x: 44, z: -15.78, rotY: Math.PI, scaleX: 1.2, scaleY: 0.92, h: 1.0 },
    { x: 44, z: 18.28, rotY: 0, scaleX: 1.25, scaleY: 0.95, h: 1.0 },
    { x: -46, z: 18.28, rotY: 0, scaleX: 1.25, scaleY: 0.95, h: 1.0 },
  ];

  const ivyInst = new THREE.InstancedMesh(ivyGeo, ivyMat, wallPatches.length);
  ivyInst.receiveShadow = true;
  ivyInst.castShadow = false;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const rand = mulberry32(9241);

  for (let i = 0; i < wallPatches.length; i++) {
    const p = wallPatches[i];
    const y = ctx.getTerrainHeight(p.x, p.z) + p.h;
    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.scale.set(p.scaleX, p.scaleY, 1);
    dummy.updateMatrix();
    ivyInst.setMatrixAt(i, dummy.matrix);

    col.setRGB(0.92 + rand() * 0.14, 0.86 + rand() * 0.14, 0.82 + rand() * 0.14);
    ivyInst.setColorAt(i, col);
  }
  ivyInst.instanceMatrix.needsUpdate = true;
  if (ivyInst.instanceColor) ivyInst.instanceColor.needsUpdate = true;
  group.add(ivyInst);
}

/** Instantiates a species group (trunks + foliage canopies) from placement list. */
function instantiateTreeSpecies(
  group: THREE.Group,
  ctx: WorldContext,
  proto: TreePrototype,
  trunkMat: THREE.Material,
  canopyMat: THREE.Material,
  placements: TreePlacement[],
  castShadow: boolean
): void {
  if (placements.length === 0) return;

  const trunkMesh = new THREE.InstancedMesh(proto.trunkGeo, trunkMat, placements.length);
  const canopyMesh = new THREE.InstancedMesh(proto.canopyGeo, canopyMat, placements.length);

  trunkMesh.castShadow = castShadow;
  trunkMesh.receiveShadow = true;
  canopyMesh.castShadow = castShadow;
  canopyMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const groundY = ctx.getTerrainHeight(p.x, p.z);
    dummy.position.set(p.x, groundY, p.z);
    dummy.rotation.set(p.tiltX, p.rotY, p.tiltZ);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();

    trunkMesh.setMatrixAt(i, dummy.matrix);
    canopyMesh.setMatrixAt(i, dummy.matrix);
    canopyMesh.setColorAt(i, p.color);
  }

  trunkMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;

  group.add(trunkMesh, canopyMesh);
}

export function buildTreesAndGroundCover(
  ctx: WorldContext,
  textures: FoliageTextureSet
): TreesSystemResult {
  const group = new THREE.Group();
  group.name = 'BadaguanFoliage';
  const colliders: Collider[] = [];
  const rand = mulberry32(20261028);

  const windUniforms: WindUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.58, 0.6).normalize() },
    uBacklightColor: { value: new THREE.Color(0xffd27a) },
    uBacklightStrength: { value: 0.24 },
  };

  // Materials
  const barkGinkgoMat = new THREE.MeshStandardMaterial({
    map: textures.barkGinkgo,
    roughness: 0.92,
    metalness: 0.0,
  });
  const barkMapleMat = new THREE.MeshStandardMaterial({
    map: textures.barkMaple,
    roughness: 0.88,
    metalness: 0.0,
  });
  const barkPlaneMat = new THREE.MeshStandardMaterial({
    map: textures.barkPlane,
    roughness: 0.84,
    metalness: 0.0,
  });
  const barkPineMat = new THREE.MeshStandardMaterial({
    map: textures.barkPine,
    roughness: 0.94,
    metalness: 0.0,
  });

  const ginkgoCanopyMat = createWindFoliageMaterial(textures.ginkgoCluster, windUniforms, 0.74);
  const mapleCanopyMat = createWindFoliageMaterial(textures.mapleCluster, windUniforms, 0.76);
  const planeCanopyMat = createWindFoliageMaterial(textures.planeCluster, windUniforms, 0.8);
  const pineCanopyMat = createWindFoliageMaterial(textures.pineBough, windUniforms, 0.84);
  const shrubMat = createWindFoliageMaterial(textures.shrubCluster, windUniforms, 0.84);

  // Build sculptural prototypes (2 structural variants per hero species + lighter hill LODs)
  const ginkgoA = createGinkgoPrototype(101, true);
  const ginkgoB = createGinkgoPrototype(202, true);
  const mapleA = createMaplePrototype(303, true);
  const mapleB = createMaplePrototype(404, true);
  const planeA = createPlanePrototype(505, true);
  const pineUpright = createBlackPinePrototype(606, false, true);
  const pineWindswept = createBlackPinePrototype(707, true, true);

  // Lighter prototypes for far distant "紅瓦綠樹" backdrop hills
  const bgPine = createBlackPinePrototype(808, false, false);
  const bgGinkgo = createGinkgoPrototype(909, false);
  const bgMaple = createMaplePrototype(1010, false);

  const ginkgoListA: TreePlacement[] = [];
  const ginkgoListB: TreePlacement[] = [];
  const mapleListA: TreePlacement[] = [];
  const mapleListB: TreePlacement[] = [];
  const planeList: TreePlacement[] = [];
  const pineListUpright: TreePlacement[] = [];
  const pineListWindswept: TreePlacement[] = [];

  const bgPineList: TreePlacement[] = [];
  const bgGinkgoList: TreePlacement[] = [];
  const bgMapleList: TreePlacement[] = [];

  const treePitLocations: [number, number][] = [];

  const pickGinkgoColor = (): THREE.Color => {
    const palette = [0xfff6b8, 0xffe88c, 0xffd76e, 0xf7e699, 0xffe27a];
    return new THREE.Color(palette[Math.floor(rand() * palette.length)]);
  };
  const pickMapleColor = (): THREE.Color => {
    const palette = [0xffb4a8, 0xff9e8a, 0xffc694, 0xf28d88, 0xffad7d];
    return new THREE.Color(palette[Math.floor(rand() * palette.length)]);
  };
  const pickPlaneColor = (): THREE.Color => {
    const palette = [0xf2e4a8, 0xe8d08e, 0xd8d694, 0xf0ca86];
    return new THREE.Color(palette[Math.floor(rand() * palette.length)]);
  };
  const pickPineColor = (): THREE.Color => {
    const palette = [0xd8f0dc, 0xc4e4cc, 0xe2f4df, 0xbadac2];
    return new THREE.Color(palette[Math.floor(rand() * palette.length)]);
  };

  const addHeroTree = (
    target: TreePlacement[],
    x: number,
    z: number,
    scale: number,
    color: THREE.Color,
    options: { rotY?: number; pit?: boolean; collider?: number; leanToward?: [number, number] } = {}
  ) => {
    if (getRoadDistance(x, z) < 0.8) return;
    if (isOnBeach(x, z)) return;
    const h = ctx.getTerrainHeight(x, z);
    if (h < 3.6) return;

    let tiltX = (rand() - 0.5) * 0.045;
    let tiltZ = (rand() - 0.5) * 0.045;
    if (options.leanToward) {
      tiltZ = options.leanToward[0];
      tiltX = options.leanToward[1];
    }

    target.push({
      x,
      z,
      scale,
      rotY: options.rotY ?? rand() * Math.PI * 2,
      tiltX,
      tiltZ,
      color,
      hasTreePit: options.pit,
      colliderRadius: options.collider,
    });

    if (options.pit) {
      treePitLocations.push([x, z]);
    }
    if (options.collider && options.collider > 0) {
      colliders.push({
        type: 'cylinder',
        x,
        z,
        radius: options.collider,
        maxY: h + 8.0,
      });
    }
  };

  // =========================================================================
  // 1. 居庸關路 (Juyongguan Rd — Ginkgo Avenue 銀杏大道, z = -24)
  //    Towering golden Ginkgos arching into a golden cathedral tunnel!
  // =========================================================================
  const juyongXs = [
    -82, -73, -64, -55, -46, -37,
    // Skip Jiayuguan intersection (-26 ± 9)
    -15.5, -7.5,
    // Skip Princess & Butterfly garden gates (-1 ± 4.5)
    5.5, 13.5,
    // Skip Huanghai intersection (24 ± 9)
    35, 44, 53, 62, 71, 80,
  ];
  for (let i = 0; i < juyongXs.length; i++) {
    const x = juyongXs[i];
    // North sidewalk strip (z = -30.2), subtly leaning south (+Z) over the avenue
    const listN = i % 2 === 0 ? ginkgoListA : ginkgoListB;
    addHeroTree(listN, x + (rand() - 0.5) * 0.5, -30.2, 0.98 + rand() * 0.22, pickGinkgoColor(), {
      pit: true,
      collider: 0.45,
      leanToward: [(rand() - 0.5) * 0.03, 0.055 + rand() * 0.035],
    });
    // South sidewalk strip (z = -17.8), subtly leaning north (-Z) over the avenue
    const listS = i % 2 === 0 ? ginkgoListB : ginkgoListA;
    addHeroTree(listS, x + (rand() - 0.5) * 0.5, -17.8, 0.98 + rand() * 0.22, pickGinkgoColor(), {
      pit: true,
      collider: 0.45,
      leanToward: [(rand() - 0.5) * 0.03, -(0.055 + rand() * 0.035)],
    });
  }

  // =========================================================================
  // 2. 嘉峪關路 (Jiayuguan Rd — Five-Pointed Maple Avenue 五角楓大道, x = -26)
  //    Vibrant scarlet, crimson & burnt-amber five-pointed maples!
  // =========================================================================
  const jiayuZs = [
    -80, -71, -62, -53, -44, -35,
    // Skip Juyongguan intersection (-24 ± 9)
    -13, -4, 5, 14,
  ];
  for (let i = 0; i < jiayuZs.length; i++) {
    const z = jiayuZs[i];
    const listW = i % 2 === 0 ? mapleListA : mapleListB;
    addHeroTree(listW, -31.6, z + (rand() - 0.5) * 0.5, 0.92 + rand() * 0.24, pickMapleColor(), {
      pit: true,
      collider: 0.42,
      leanToward: [-(0.04 + rand() * 0.03), (rand() - 0.5) * 0.03],
    });
    const listE = i % 2 === 0 ? mapleListB : mapleListA;
    addHeroTree(listE, -20.4, z + (rand() - 0.5) * 0.5, 0.92 + rand() * 0.24, pickMapleColor(), {
      pit: true,
      collider: 0.42,
      leanToward: [0.04 + rand() * 0.03, (rand() - 0.5) * 0.03],
    });
  }

  // =========================================================================
  // 3. 山海關路 (Shanhaiguan Rd — French Plane north, Coastal Pines south)
  // =========================================================================
  const shanhaiNorthXs = [
    -80, -70, -60, -50, -40,
    // Skip Jiayuguan intersection (-26 ± 9)
    -14.5, -7.0,
    // Skip Butterfly House main south gate (-1 ± 4.5)
    5.5, 13.5,
    // Skip Huanghai intersection (24 ± 9)
    36, 46, 56, 66, 76,
  ];
  for (const x of shanhaiNorthXs) {
    addHeroTree(planeList, x + (rand() - 0.5) * 0.6, 19.6, 0.92 + rand() * 0.2, pickPlaneColor(), {
      pit: true,
      collider: 0.48,
    });
  }

  // South coastal strip (z = 32.5): windswept Qingdao Black Pines framing Yellow Sea views
  // Skips beach staircase corridor [-32, -19] and Huanghai Rd intersection [15, 33]
  const coastalPineXs = [-76, -63, -49, -37, -15, -2, 11, 41, 55, 69];
  for (let i = 0; i < coastalPineXs.length; i++) {
    const x = coastalPineXs[i];
    const target = i % 3 === 0 ? pineListUpright : pineListWindswept;
    addHeroTree(target, x, 32.4, 0.88 + rand() * 0.24, pickPineColor(), {
      rotY: (rand() - 0.5) * 0.7, // Keeps windswept lean oriented inland (-Z)
      pit: true,
      collider: 0.45,
    });
  }

  // =========================================================================
  // 4. 黃海路 (Huanghai Rd, x = 24) & 花石樓 Granite Promontory Cape
  // =========================================================================
  const huanghaiZs = [-76, -66, -56, -46, -36, -12, -2, 8, 16];
  for (let i = 0; i < huanghaiZs.length; i++) {
    const z = huanghaiZs[i];
    const usePine = i % 2 === 1;
    addHeroTree(
      usePine ? pineListUpright : planeList,
      18.4,
      z,
      0.88 + rand() * 0.22,
      usePine ? pickPineColor() : pickPlaneColor(),
      { pit: true, collider: 0.44 }
    );
    addHeroTree(
      usePine ? planeList : pineListUpright,
      29.6,
      z,
      0.88 + rand() * 0.22,
      usePine ? pickPlaneColor() : pickPineColor(),
      { pit: true, collider: 0.44 }
    );
  }

  // Dramatic gnarled Qingdao Black Pines perched around the Huashilou granite headland (34, 56)
  // Carefully positioned on the north/south/east flanks so the seaward Viewpoint 4 view of the castle stays dramatic & clear!
  const capePines: [number, number, number, number][] = [
    [20.2, 46.8, 0.92, -0.3],
    [22.8, 66.8, 0.95, 0.4],
    [32.0, 71.2, 0.82, 0.05],
    [45.8, 67.5, 0.94, -0.2],
    [49.5, 57.5, 1.02, -0.45],
    [48.2, 46.5, 0.96, -0.1],
    [42.0, 41.0, 0.88, 0.25],
    [21.2, 39.2, 0.9, 0.1],
    [35.2, 39.5, 0.84, -0.25],
  ];
  for (const [px, pz, sc, ry] of capePines) {
    if (ctx.getTerrainHeight(px, pz) > 4.2 && !isInsideBuildingExclusion(px, pz)) {
      addHeroTree(pineListWindswept, px, pz, sc, pickPineColor(), {
        rotY: ry,
        collider: 0.45,
      });
    }
  }

  // =========================================================================
  // 5. Hero Villa Courtyard Gardens (Princess, Butterfly, NW, NE, SW, SE)
  // =========================================================================
  const courtyardTrees: { species: 'pine' | 'ginkgo' | 'maple' | 'plane'; x: number; z: number; s: number }[] = [
    // Princess House Courtyard (iconic coastal pines + golden ginkgo framing the blue villa!)
    { species: 'pine', x: -13.5, z: -37.2, s: 0.88 },
    { species: 'pine', x: 11.5, z: -37.5, s: 0.92 },
    { species: 'ginkgo', x: -14.2, z: -51.5, s: 0.85 },
    { species: 'maple', x: 12.2, z: -50.8, s: 0.84 },
    { species: 'pine', x: -12.8, z: -61.8, s: 1.04 },
    { species: 'pine', x: 11.0, z: -61.5, s: 1.0 },
    { species: 'ginkgo', x: -1.5, z: -63.2, s: 0.95 },

    // Butterfly House Courtyard (ochre villa framed by crimson maples & coastal pines, clear of Viewpoint 3 ray)
    { species: 'maple', x: -14.8, z: 8.2, s: 0.84 },
    { species: 'pine', x: 11.8, z: 12.8, s: 0.9 },
    { species: 'ginkgo', x: -13.5, z: -11.2, s: 0.84 },
    { species: 'maple', x: 11.5, z: -11.5, s: 0.88 },
    { species: 'pine', x: -14.4, z: -1.2, s: 0.92 },
    { species: 'pine', x: 12.4, z: 1.8, s: 0.92 },

    // NW Block Courtyard (-56, -49)
    { species: 'pine', x: -70, z: -38, s: 1.0 },
    { species: 'ginkgo', x: -39, z: -38, s: 0.94 },
    { species: 'maple', x: -70, z: -58, s: 0.95 },
    { species: 'pine', x: -39, z: -61, s: 1.05 },
    { species: 'pine', x: -56, z: -64, s: 1.08 },

    // NE Block Courtyard (52, -49)
    { species: 'ginkgo', x: 37, z: -37, s: 0.92 },
    { species: 'pine', x: 67, z: -38, s: 1.02 },
    { species: 'maple', x: 37, z: -60, s: 0.96 },
    { species: 'pine', x: 67, z: -61, s: 1.08 },
    { species: 'ginkgo', x: 52, z: -64, s: 1.0 },

    // SW Block Courtyard (-56, 1)
    { species: 'maple', x: -70, z: -11, s: 0.94 },
    { species: 'pine', x: -39, z: 13, s: 0.96 },
    { species: 'pine', x: -70, z: 13, s: 1.04 },
    { species: 'ginkgo', x: -39, z: -11, s: 0.88 },

    // SE Block Courtyard (52, 1)
    { species: 'pine', x: 37, z: 13, s: 0.96 },
    { species: 'maple', x: 67, z: -11, s: 0.94 },
    { species: 'pine', x: 67, z: 13, s: 1.04 },
    { species: 'ginkgo', x: 37, z: -11, s: 0.9 },
  ];

  for (let i = 0; i < courtyardTrees.length; i++) {
    const ct = courtyardTrees[i];
    if (isInsideBuildingExclusion(ct.x, ct.z)) continue;
    if (ct.species === 'pine') {
      addHeroTree(pineListUpright, ct.x, ct.z, ct.s, pickPineColor(), { collider: 0.44 });
    } else if (ct.species === 'ginkgo') {
      addHeroTree(i % 2 === 0 ? ginkgoListA : ginkgoListB, ct.x, ct.z, ct.s, pickGinkgoColor(), {
        collider: 0.42,
      });
    } else if (ct.species === 'maple') {
      addHeroTree(i % 2 === 0 ? mapleListA : mapleListB, ct.x, ct.z, ct.s, pickMapleColor(), {
        collider: 0.4,
      });
    } else {
      addHeroTree(planeList, ct.x, ct.z, ct.s, pickPlaneColor(), { collider: 0.45 });
    }
  }

  // =========================================================================
  // 6. Distant Northern & Flanking Hills ("紅瓦綠樹" Qingdao Forest Backdrop)
  // =========================================================================
  // Exact footprint exclusion for the 22 distant hillside villas in DistrictVillasBuilder.ts
  // so no background trees clip into hillside red-roofed villas on Viewpoint 6 aerials!
  const hillsideVillaExclusions: readonly [number, number, number][] = [
    // [centerX, centerZ, clearanceRadius]
    [-94, -86, 10.8],
    [-66, -88, 11.4],
    [-38, -86, 10.8],
    [-10, -88, 11.2],
    [18, -90, 11.0],
    [48, -88, 11.6],
    [78, -86, 10.8],
    [-82, -114, 11.8],
    [-46, -116, 11.4],
    [-12, -118, 12.0],
    [24, -116, 11.4],
    [60, -115, 11.8],
    [96, -112, 11.2],
    [-94, -52, 11.0],
    [-96, -10, 10.8],
    [-108, -32, 11.6],
    [-114, 6, 11.0],
    [94, -52, 11.2],
    [94, -6, 11.0],
    [108, -34, 11.6],
    [112, 12, 10.8],
    [96, 16, 10.6],
  ];

  const isInsideHillsideVilla = (x: number, z: number): boolean => {
    for (let i = 0; i < hillsideVillaExclusions.length; i++) {
      const [vx, vz, r] = hillsideVillaExclusions[i];
      const dx = x - vx;
      const dz = z - vz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  const addBgTree = (x: number, z: number) => {
    if (getRoadDistance(x, z) < 3.5) return;
    if (isOnBeach(x, z)) return;
    if (isInsideHillsideVilla(x, z)) return;
    const h = ctx.getTerrainHeight(x, z);
    if (h < 5.2) return;

    const r = rand();
    const scale = 1.02 + rand() * 0.58;
    const item: TreePlacement = {
      x,
      z,
      scale,
      rotY: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.06,
      tiltZ: (rand() - 0.5) * 0.06,
      color: r < 0.56 ? pickPineColor() : r < 0.8 ? pickGinkgoColor() : pickMapleColor(),
    };

    if (r < 0.56) bgPineList.push(item);
    else if (r < 0.8) bgGinkgoList.push(item);
    else bgMapleList.push(item);
  };

  // Northern Taiping Mountain hills (z in [-142, -72], x in [-136, 136])
  for (let z = -74; z >= -140; z -= 10.5) {
    for (let x = -132; x <= 132; x += 11.5) {
      if (rand() > 0.72) continue;
      const jx = x + (rand() - 0.5) * 7.5;
      const jz = z + (rand() - 0.5) * 6.5;
      // Leave small clear pockets so distant red-roofed villas peek out cleanly ("紅瓦綠樹")
      addBgTree(jx, jz);
    }
  }

  // Western & Eastern coastal wooded edges (|x| > 78, z in [-72, 32])
  for (let z = -70; z <= 28; z += 11.0) {
    for (const side of [-1, 1]) {
      for (let dist = 80; dist <= 134; dist += 12.5) {
        if (rand() > 0.7) continue;
        const jx = side * (dist + (rand() - 0.5) * 6.5);
        const jz = z + (rand() - 0.5) * 6.5;
        addBgTree(jx, jz);
      }
    }
  }

  // Instantiate all tree species batches
  instantiateTreeSpecies(group, ctx, ginkgoA, barkGinkgoMat, ginkgoCanopyMat, ginkgoListA, true);
  instantiateTreeSpecies(group, ctx, ginkgoB, barkGinkgoMat, ginkgoCanopyMat, ginkgoListB, true);
  instantiateTreeSpecies(group, ctx, mapleA, barkMapleMat, mapleCanopyMat, mapleListA, true);
  instantiateTreeSpecies(group, ctx, mapleB, barkMapleMat, mapleCanopyMat, mapleListB, true);
  instantiateTreeSpecies(group, ctx, planeA, barkPlaneMat, planeCanopyMat, planeList, true);
  instantiateTreeSpecies(group, ctx, pineUpright, barkPineMat, pineCanopyMat, pineListUpright, true);
  instantiateTreeSpecies(group, ctx, pineWindswept, barkPineMat, pineCanopyMat, pineListWindswept, true);

  // Far hill backdrop trees (castShadow = false to keep 60fps & crisp close-range shadow map)
  instantiateTreeSpecies(group, ctx, bgPine, barkPineMat, pineCanopyMat, bgPineList, false);
  instantiateTreeSpecies(group, ctx, bgGinkgo, barkGinkgoMat, ginkgoCanopyMat, bgGinkgoList, false);
  instantiateTreeSpecies(group, ctx, bgMaple, barkMapleMat, mapleCanopyMat, bgMapleList, false);

  // =========================================================================
  // 7. Granite Sidewalk Tree-Pit Kerbs (樹池) around avenue trees
  // =========================================================================
  if (treePitLocations.length > 0) {
    const kerbGeo = new THREE.BoxGeometry(1.38, 0.24, 1.38);
    const soilGeo = new THREE.BoxGeometry(1.16, 0.26, 1.16);
    const kerbMat = new THREE.MeshStandardMaterial({
      color: 0x9b9488,
      roughness: 0.9,
      metalness: 0.02,
    });
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x3b2c20,
      roughness: 0.98,
      metalness: 0.0,
    });

    const kerbInst = new THREE.InstancedMesh(kerbGeo, kerbMat, treePitLocations.length);
    const soilInst = new THREE.InstancedMesh(soilGeo, soilMat, treePitLocations.length);
    kerbInst.receiveShadow = true;
    soilInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < treePitLocations.length; i++) {
      const [tx, tz] = treePitLocations[i];
      const y = ctx.getTerrainHeight(tx, tz) + 0.1;
      dummy.position.set(tx, y, tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      kerbInst.setMatrixAt(i, dummy.matrix);
      soilInst.setMatrixAt(i, dummy.matrix);
    }
    kerbInst.instanceMatrix.needsUpdate = true;
    soilInst.instanceMatrix.needsUpdate = true;
    group.add(kerbInst, soilInst);
  }

  // =========================================================================
  // 8. Fallen Autumn Leaf Carpets (居庸關路 golden ginkgo + 嘉峪關路 crimson maple)
  // =========================================================================
  const ginkgoCarpetMat = new THREE.MeshStandardMaterial({
    map: textures.fallenGinkgoCarpet,
    transparent: true,
    depthWrite: false,
    roughness: 0.85,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mapleCarpetMat = new THREE.MeshStandardMaterial({
    map: textures.fallenMapleCarpet,
    transparent: true,
    depthWrite: false,
    roughness: 0.86,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // Golden ginkgo leaf carpets hugging both curbs, sidewalks & lawn edges of 居庸關路
  for (let x = -78; x <= 78; x += 6.2) {
    if (Math.abs(x - ROAD_LAYOUT.JIAYUGUAN_X) < 5.5) continue;
    if (Math.abs(x - ROAD_LAYOUT.HUANGHAI_X) < 5.5) continue;

    // North sidewalk & curb drift
    group.add(
      buildFallenLeafCarpetMesh(
        x + (rand() - 0.5) * 1.2,
        -29.8 + (rand() - 0.5) * 0.8,
        5.8 + rand() * 2.0,
        3.6 + rand() * 1.4,
        (rand() - 0.5) * 0.5,
        ctx,
        ginkgoCarpetMat
      )
    );
    // South sidewalk & curb drift
    group.add(
      buildFallenLeafCarpetMesh(
        x + (rand() - 0.5) * 1.2,
        -18.2 + (rand() - 0.5) * 0.8,
        5.8 + rand() * 2.0,
        3.6 + rand() * 1.4,
        (rand() - 0.5) * 0.5,
        ctx,
        ginkgoCarpetMat
      )
    );
    // Occasional wind-blown golden drift creeping onto the road gutter edge
    if (rand() > 0.35) {
      const side = rand() > 0.5 ? -27.8 : -20.2;
      group.add(
        buildFallenLeafCarpetMesh(
          x + (rand() - 0.5) * 2.0,
          side,
          4.8 + rand() * 1.8,
          2.6 + rand() * 1.0,
          (rand() - 0.5) * 0.8,
          ctx,
          ginkgoCarpetMat
        )
      );
    }
  }

  // Crimson maple leaf drifts along 嘉峪關路 curbs & sidewalks
  for (let z = -76; z <= 16; z += 6.8) {
    if (Math.abs(z - ROAD_LAYOUT.JUYONGGUAN_Z) < 6.0) continue;
    group.add(
      buildFallenLeafCarpetMesh(
        -31.3 + (rand() - 0.5) * 0.7,
        z + (rand() - 0.5) * 1.2,
        3.4 + rand() * 1.2,
        5.6 + rand() * 1.8,
        (rand() - 0.5) * 0.4,
        ctx,
        mapleCarpetMat
      )
    );
    group.add(
      buildFallenLeafCarpetMesh(
        -20.7 + (rand() - 0.5) * 0.7,
        z + (rand() - 0.5) * 1.2,
        3.4 + rand() * 1.2,
        5.6 + rand() * 1.8,
        (rand() - 0.5) * 0.4,
        ctx,
        mapleCarpetMat
      )
    );
  }

  // Extra golden leaf pools inside Princess House & Butterfly House front gardens
  for (const [lx, lz, mat] of [
    [-11.5, -36.5, ginkgoCarpetMat],
    [9.5, -36.5, ginkgoCarpetMat],
    [-11.5, 13.5, mapleCarpetMat],
    [9.5, 13.5, ginkgoCarpetMat],
  ] as [number, number, THREE.MeshStandardMaterial][]) {
    group.add(buildFallenLeafCarpetMesh(lx, lz, 5.2, 4.6, rand() * Math.PI, ctx, mat));
  }

  // =========================================================================
  // 9. Autumn Climbing Ivy (爬山虎) & Courtyard Boxwood/Hydrangea Shrubs
  // =========================================================================
  buildClimbingIvy(group, ctx, textures, windUniforms);

  const shrubGeo = createShrubPrototype(777);
  const shrubCoords: [number, number, number][] = [
    // Princess House garden gate flanks & courtyard corners (clear of fountain & white bench)
    [-5.8, -34.2, 1.0],
    [3.8, -34.2, 1.0],
    [-15.2, -34.5, 1.18],
    [13.2, -34.5, 1.15],
    [-14.8, -44.0, 1.05],
    [12.8, -44.0, 1.08],
    [-10.8, -35.8, 0.85],
    [10.5, -35.8, 0.88],

    // Butterfly House garden gate flanks & sunlit borders
    [-5.8, 16.0, 1.05],
    [3.8, 16.0, 1.05],
    [-15.4, 15.6, 1.2],
    [13.4, 15.6, 1.15],
    [-5.8, -13.6, 0.95],
    [3.8, -13.6, 0.95],
    [-15.2, -13.5, 1.1],
    [13.2, -13.5, 1.12],
    [-15.4, 7.5, 1.0],
    [13.6, 7.2, 1.02],

    // Huashilou coastal cape scrub & hardy sea-bushes
    [22.0, 44.5, 1.1],
    [39.8, 43.2, 1.15],
    [45.5, 51.0, 1.22],
    [24.8, 64.0, 1.18],
    [43.0, 65.0, 1.12],

    // Surrounding villa garden corner hedges
    [-36.5, -35.5, 1.25],
    [-36.5, -12.5, 1.2],
    [-36.5, 15.2, 1.25],
    [34.5, -35.5, 1.22],
    [34.5, -12.5, 1.18],
    [34.5, 15.2, 1.24],
    [-46.0, -34.5, 1.15],
    [46.0, -34.5, 1.15],
  ];

  const validShrubs = shrubCoords.filter(([sx, sz]) => ctx.getTerrainHeight(sx, sz) > 3.6);
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, validShrubs.length);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;

  const sDummy = new THREE.Object3D();
  const sColor = new THREE.Color();
  for (let i = 0; i < validShrubs.length; i++) {
    const [sx, sz, sc] = validShrubs[i];
    const sy = ctx.getTerrainHeight(sx, sz) - 0.05;
    sDummy.position.set(sx, sy, sz);
    sDummy.rotation.set(0, rand() * Math.PI * 2, 0);
    sDummy.scale.set(sc * (0.9 + rand() * 0.25), sc * (0.85 + rand() * 0.2), sc * (0.9 + rand() * 0.25));
    sDummy.updateMatrix();
    shrubInst.setMatrixAt(i, sDummy.matrix);
    sColor.setRGB(0.86 + rand() * 0.18, 0.9 + rand() * 0.14, 0.82 + rand() * 0.16);
    shrubInst.setColorAt(i, sColor);
  }
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  group.add(shrubInst);

  return {
    group,
    colliders,
    update: (_dt, elapsed) => {
      windUniforms.uTime.value = elapsed;
    },
    setMood: (mood) => {
      windUniforms.uSunDir.value.copy(mood.sunDirection).normalize();
      windUniforms.uBacklightColor.value.copy(mood.sunColor);
      // Smoothly scales with sunIntensity and low-sun golden hour glow
      const lowSunBoost = 1.0 - THREE.MathUtils.clamp(mood.sunDirection.y / 0.55, 0, 1);
      const mistDamp = 1.0 - THREE.MathUtils.clamp(mood.mistOpacity * 0.55, 0, 0.45);
      windUniforms.uBacklightStrength.value = THREE.MathUtils.clamp(
        (0.08 + mood.sunIntensity * 0.085 + lowSunBoost * mood.sunIntensity * 0.07) * mistDamp,
        0.04,
        0.46
      );
      windUniforms.uWindStrength.value =
        mood.id === 'morning_mist' ? 0.68 : mood.id === 'golden_sunset' ? 1.12 : 0.96;
    },
  };
}
