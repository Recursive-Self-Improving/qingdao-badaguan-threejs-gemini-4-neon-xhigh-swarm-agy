import * as THREE from 'three';
import type { Collider, WorldContext } from '../types';
import {
  ROAD_LAYOUT,
  getRoadDistance,
  getShorelineZ,
  isOnBeach,
} from '../terrainMath';
import type { LandscapeTextureSet } from './landscapeTextures';

export interface TerrainBuildResult {
  group: THREE.Group;
  colliders: Collider[];
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 1. High-resolution Badaguan terrain mesh (224x224 segments across [-150..150, -150..140])
 *    sculpted strictly via ctx.getTerrainHeight(x, z) with multi-biome blended textures
 *    (autumn turf, golden beach sand, craggy Qingdao granite cliffs, wet shoreline, seafloor).
 */
function buildTerrainMesh(ctx: WorldContext, textures: LandscapeTextureSet): THREE.Mesh {
  const minX = -150;
  const maxX = 150;
  const minZ = -150;
  const maxZ = 140;
  const segX = 224;
  const segZ = 224;

  const vertCount = (segX + 1) * (segZ + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  let ptr = 0;
  for (let iz = 0; iz <= segZ; iz++) {
    const vz = iz / segZ;
    const z = minZ + (maxZ - minZ) * vz;
    for (let ix = 0; ix <= segX; ix++) {
      const ux = ix / segX;
      const x = minX + (maxX - minX) * ux;
      const y = ctx.getTerrainHeight(x, z);

      positions[ptr * 3] = x;
      positions[ptr * 3 + 1] = y;
      positions[ptr * 3 + 2] = z;

      uvs[ptr * 2] = ux * 28;
      uvs[ptr * 2 + 1] = vz * 28;
      ptr++;
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = a + (segX + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(vertCount * 3);
  const biomes = new Float32Array(vertCount * 4); // x: turf, y: sand, z: granite rock, w: seafloor

  const huashilou = ROAD_LAYOUT.HUASHILOU_CENTER;

  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const ny = normals.getY(i);

    const macroNoise =
      0.5 +
      0.28 * Math.sin(x * 0.065 + z * 0.048) +
      0.22 * Math.cos(x * 0.13 - z * 0.11);

    const dCape = Math.hypot(x - huashilou.x, z - huashilou.z);
    const shoreZ = getShorelineZ(x);

    // Cove mask matches No. 2 Bathing Beach cove
    const coveMask = smoothstep(-86, -64, x) * (1 - smoothstep(8, 22, x));

    // Underwater seafloor weight
    let wSeafloor = smoothstep(0.05, -1.25, y);

    // Golden beach sand weight
    const beachZoneZ = smoothstep(37.2, 41.2, z) * (1 - smoothstep(shoreZ + 2.5, shoreZ + 12.0, z));
    const beachElev = smoothstep(4.65, 3.35, y) * smoothstep(-1.1, -0.1, y);
    let wSand = coveMask * beachZoneZ * beachElev;
    if (isOnBeach(x, z)) {
      wSand = Math.max(wSand, 0.82 * (1 - wSeafloor));
    }

    // Craggy coastal granite rock weight (steep cliffs, Huashilou cape rim, rocky shores)
    const slopeRock = smoothstep(0.93, 0.74, ny);
    const capeRimRock =
      smoothstep(10.2, 14.5, dCape) *
      (1 - smoothstep(26.5, 34.5, dCape)) *
      smoothstep(8.22, 7.35, y);
    const nonCoveCoastRock =
      (1 - coveMask) * smoothstep(34.8, 39.5, z) * smoothstep(6.35, 5.2, y) * smoothstep(-2.4, -0.4, y);
    const seawallBankRock = smoothstep(35.0, 36.2, z) * (1 - smoothstep(39.5, 42.2, z)) * smoothstep(0.94, 0.78, ny);
    let wRock = Math.min(1, Math.max(slopeRock * 1.18, capeRimRock * 1.05, nonCoveCoastRock * 0.92, seawallBankRock));
    // Keep flat sandy beach free of rock, while letting rocky cape slopes show bold granite
    wRock *= 1 - wSand * (1 - capeRimRock * 0.65) * 0.85;

    // Autumn turf inland, on Huashilou top garden plateau, and on background hills
    let wTurf = Math.max(0, 1 - Math.max(wSand, wRock, wSeafloor));
    if (z <= 34.8 && y > 5.0) {
      wTurf = Math.max(wTurf, 0.88 - slopeRock * 0.55);
    }

    const sum = Math.max(0.0001, wTurf + wSand + wRock + wSeafloor);
    wTurf /= sum;
    wSand /= sum;
    wRock /= sum;
    wSeafloor /= sum;

    biomes[i * 4] = wTurf;
    biomes[i * 4 + 1] = wSand;
    biomes[i * 4 + 2] = wRock;
    biomes[i * 4 + 3] = wSeafloor;

    // Subtle multiplicative vertex color tint (kept bright ~0.82-1.08 so textures stay rich & vibrant)
    let cr = 0.96 + (macroNoise - 0.5) * 0.12;
    let cg = 0.96 + (macroNoise - 0.5) * 0.10;
    let cb = 0.94 + (macroNoise - 0.5) * 0.08;

    // Lush deep green-autumn hillside richness on distant Taiping Mountain slopes
    const hillTint = Math.max(smoothstep(-76, -128, z), smoothstep(84, 134, Math.abs(x)) * (1 - smoothstep(10, 38, z)));
    if (hillTint > 0) {
      cr = THREE.MathUtils.lerp(cr, 0.84 + macroNoise * 0.14, hillTint * 0.55);
      cg = THREE.MathUtils.lerp(cg, 0.94 + macroNoise * 0.10, hillTint * 0.55);
      cb = THREE.MathUtils.lerp(cb, 0.78, hillTint * 0.55);
    }

    // Warm golden sunlit glow on dry beach sand, subtle damp ochre closer to waterline
    if (wSand > 0.05) {
      const dryBoost = smoothstep(0.6, 2.2, y);
      cr = THREE.MathUtils.lerp(cr, 0.98 + dryBoost * 0.08, wSand * 0.75);
      cg = THREE.MathUtils.lerp(cg, 0.95 + dryBoost * 0.06, wSand * 0.75);
      cb = THREE.MathUtils.lerp(cb, 0.88 + dryBoost * 0.03, wSand * 0.75);
    }

    // Subtle pale-ochre weathering on granite cape cliffs
    if (wRock > 0.05) {
      cr = THREE.MathUtils.lerp(cr, 1.02 + (macroNoise - 0.5) * 0.16, wRock * 0.6);
      cg = THREE.MathUtils.lerp(cg, 0.97 + (macroNoise - 0.5) * 0.12, wRock * 0.6);
      cb = THREE.MathUtils.lerp(cb, 0.90 + (macroNoise - 0.5) * 0.10, wRock * 0.6);
    }

    // Soft earthy darkening right next to road/sidewalk edges for grounded integration
    const roadD = getRoadDistance(x, z);
    if (roadD > 0 && roadD < 3.6 && z < 34) {
      const edgeAO = 1 - (1 - smoothstep(0.5, 3.6, roadD)) * 0.14;
      cr *= edgeAO;
      cg *= edgeAO;
      cb *= edgeAO;
    }

    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aBiome', new THREE.BufferAttribute(biomes, 4));

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.91,
    metalness: 0.02,
    bumpMap: textures.turfBump,
    bumpScale: 0.16,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTurfTex = { value: textures.turfMap };
    shader.uniforms.uSandTex = { value: textures.sandMap };
    shader.uniforms.uRockTex = { value: textures.cliffRockMap };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aBiome;
varying vec4 vBiome;
varying vec2 vTerrainXZ;
varying float vTerrainY;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBiome = aBiome;
vTerrainXZ = position.xz;
vTerrainY = position.y;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uTurfTex;
uniform sampler2D uSandTex;
uniform sampler2D uRockTex;
varying vec4 vBiome;
varying vec2 vTerrainXZ;
varying float vTerrainY;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 cTurfFine = texture2D(uTurfTex, vTerrainXZ * 0.095).rgb;
vec3 cTurfMacro = texture2D(uTurfTex, vTerrainXZ * 0.022 + vec2(0.37, 0.19)).rgb;
vec3 cTurf = mix(cTurfFine, cTurfMacro, 0.28);

vec3 cSandFine = texture2D(uSandTex, vTerrainXZ * 0.125).rgb;
vec3 cSandMacro = texture2D(uSandTex, vTerrainXZ * 0.03 + vec2(0.13, 0.61)).rgb;
vec3 cSand = mix(cSandFine, cSandMacro, 0.22);

vec3 cRockTop = texture2D(uRockTex, vTerrainXZ * 0.16).rgb;
vec3 cRockCliff = texture2D(uRockTex, vec2((vTerrainXZ.x + vTerrainXZ.y) * 0.12, vTerrainY * 0.24)).rgb;
vec3 cRockMacro = texture2D(uRockTex, vTerrainXZ * 0.042 + vec2(0.51, 0.27)).rgb;
vec3 cRock = mix(mix(cRockTop, cRockCliff, 0.45), cRockMacro, 0.22);

vec3 cSeafloor = mix(cSand * vec3(0.40, 0.48, 0.54), cRock * vec3(0.34, 0.42, 0.48), 0.45);

vec4 bw = vBiome;
float bSum = max(bw.x + bw.y + bw.z + bw.w, 0.0001);
bw /= bSum;
vec3 terrainAlbedo = cTurf * bw.x + cSand * bw.y + cRock * bw.z + cSeafloor * bw.w;

// Wet dark-gold sand & damp granite tidal band near sea level (y in [-0.35, 0.92])
float wetBand = smoothstep(0.95, 0.08, vTerrainY) * smoothstep(-0.65, 0.02, vTerrainY) * (bw.y + bw.z * 0.65);
terrainAlbedo = mix(terrainAlbedo, terrainAlbedo * vec3(0.62, 0.56, 0.48), wetBand * 0.68);

diffuseColor.rgb *= terrainAlbedo;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float wetRough = smoothstep(0.88, 0.06, vTerrainY) * smoothstep(-0.55, 0.02, vTerrainY) * (vBiome.y + vBiome.z * 0.6);
roughnessFactor = mix(roughnessFactor, 0.24, wetRough * 0.72);`,
      );
  };
  material.customProgramCacheKey = () => 'badaguan-terrain-biome-v1';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'BadaguanTerrain';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/**
 * Helper to create a clean terrain-conforming ribbon mesh along an axis or arbitrary path.
 * Supports optional vertical curb skirts on left/right edges so raised sidewalks never float.
 */
function buildPathRibbonGeometry(
  points: { x: number; z: number; nx: number; nz: number; dist: number }[],
  leftOffset: number,
  rightOffset: number,
  crossSegs: number,
  yOffset: number,
  getH: (x: number, z: number) => number,
  uvScaleU: number,
  uvScaleV: number,
  skirtLeftDepth = 0,
  skirtRightDepth = 0,
): THREE.BufferGeometry {
  const nLen = points.length;
  const cols = crossSegs + 1;
  const topVertCount = nLen * cols;
  const hasLeftSkirt = skirtLeftDepth > 0;
  const hasRightSkirt = skirtRightDepth > 0;
  const totalVerts =
    topVertCount + (hasLeftSkirt ? nLen * 2 : 0) + (hasRightSkirt ? nLen * 2 : 0);

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  const width = rightOffset - leftOffset;

  // Top surface vertices
  for (let i = 0; i < nLen; i++) {
    const p = points[i];
    for (let j = 0; j <= crossSegs; j++) {
      const f = j / crossSegs;
      const lat = leftOffset + width * f;
      const vx = p.x + p.nx * lat;
      const vz = p.z + p.nz * lat;
      // Subtle road crown (+0.015m at center) when wide ribbon without skirts
      const crown = !hasLeftSkirt && !hasRightSkirt && width > 5 ? Math.sin(f * Math.PI) * 0.018 : 0;
      const vy = getH(vx, vz) + yOffset + crown;

      const idx = i * cols + j;
      positions[idx * 3] = vx;
      positions[idx * 3 + 1] = vy;
      positions[idx * 3 + 2] = vz;

      uvs[idx * 2] = lat * uvScaleU;
      uvs[idx * 2 + 1] = p.dist * uvScaleV;
    }
  }

  for (let i = 0; i < nLen - 1; i++) {
    for (let j = 0; j < crossSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
      const d = c + 1;
      // N x T = +Y (upward facing)
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  let cursor = topVertCount;

  // Left vertical curb skirt (outward normal = -N = T x (-Y))
  if (hasLeftSkirt) {
    const baseIdx = cursor;
    for (let i = 0; i < nLen; i++) {
      const p = points[i];
      const vx = p.x + p.nx * leftOffset;
      const vz = p.z + p.nz * leftOffset;
      const vyTop = getH(vx, vz) + yOffset;
      const vyBot = vyTop - skirtLeftDepth;

      const topI = baseIdx + i * 2;
      const botI = topI + 1;

      positions[topI * 3] = vx;
      positions[topI * 3 + 1] = vyTop;
      positions[topI * 3 + 2] = vz;
      uvs[topI * 2] = 0;
      uvs[topI * 2 + 1] = p.dist * uvScaleV;

      positions[botI * 3] = vx;
      positions[botI * 3 + 1] = vyBot;
      positions[botI * 3 + 2] = vz;
      uvs[botI * 2] = skirtLeftDepth * uvScaleU;
      uvs[botI * 2 + 1] = p.dist * uvScaleV;
    }
    for (let i = 0; i < nLen - 1; i++) {
      const t0 = baseIdx + i * 2;
      const b0 = t0 + 1;
      const t1 = baseIdx + (i + 1) * 2;
      const b1 = t1 + 1;
      indices.push(t0, t1, b0);
      indices.push(b0, t1, b1);
    }
    cursor += nLen * 2;
  }

  // Right vertical curb skirt (outward normal = +N = (-Y) x T)
  if (hasRightSkirt) {
    const baseIdx = cursor;
    for (let i = 0; i < nLen; i++) {
      const p = points[i];
      const vx = p.x + p.nx * rightOffset;
      const vz = p.z + p.nz * rightOffset;
      const vyTop = getH(vx, vz) + yOffset;
      const vyBot = vyTop - skirtRightDepth;

      const topI = baseIdx + i * 2;
      const botI = topI + 1;

      positions[topI * 3] = vx;
      positions[topI * 3 + 1] = vyTop;
      positions[topI * 3 + 2] = vz;
      uvs[topI * 2] = 0;
      uvs[topI * 2 + 1] = p.dist * uvScaleV;

      positions[botI * 3] = vx;
      positions[botI * 3 + 1] = vyBot;
      positions[botI * 3 + 2] = vz;
      uvs[botI * 2] = skirtRightDepth * uvScaleU;
      uvs[botI * 2 + 1] = p.dist * uvScaleV;
    }
    for (let i = 0; i < nLen - 1; i++) {
      const t0 = baseIdx + i * 2;
      const b0 = t0 + 1;
      const t1 = baseIdx + (i + 1) * 2;
      const b1 = t1 + 1;
      indices.push(t0, b0, t1);
      indices.push(b0, b1, t1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sampleLinePoints(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  stepMeters = 1.6,
): { x: number; z: number; nx: number; nz: number; dist: number }[] {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const totalLen = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.ceil(totalLen / stepMeters));
  const tx = dx / totalLen;
  const tz = dz / totalLen;
  // Right-hand lateral normal in XZ plane so (tx, tz) x (nx, nz) points up (+Y)
  const nx = -tz;
  const nz = tx;

  const out: { x: number; z: number; nx: number; nz: number; dist: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    out.push({
      x: x0 + dx * f,
      z: z0 + dz * f,
      nx,
      nz,
      dist: totalLen * f,
    });
  }
  return out;
}

/** Rounded quarter-circle intersection fillet wedge to soften 90-degree curb turns */
function buildCornerFilletGeometry(
  cx: number,
  cz: number,
  dirX: number,
  dirZ: number,
  radius: number,
  yOffset: number,
  getH: (x: number, z: number) => number,
): THREE.BufferGeometry {
  // Corner apex is at (cx, cz); circle center sits at (cx + dirX * radius, cz + dirZ * radius)
  const ox = cx + dirX * radius;
  const oz = cz + dirZ * radius;
  const segs = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Vertex 0: sharp outer apex tucked between road edges
  positions.push(cx, getH(cx, cz) + yOffset, cz);
  uvs.push(cx * 0.25, cz * 0.25);

  const aStart = Math.atan2(-dirZ, 0);
  const aEnd = Math.atan2(0, -dirX);
  let delta = aEnd - aStart;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  for (let i = 0; i <= segs; i++) {
    const ang = aStart + delta * (i / segs);
    const px = ox + Math.cos(ang) * radius;
    const pz = oz + Math.sin(ang) * radius;
    positions.push(px, getH(px, pz) + yOffset, pz);
    uvs.push(px * 0.25, pz * 0.25);
  }

  for (let i = 1; i <= segs; i++) {
    // Ensure upward-facing winding regardless of quadrant
    const ax = positions[0];
    const az = positions[2];
    const bx = positions[i * 3];
    const bz = positions[i * 3 + 2];
    const cxp = positions[(i + 1) * 3];
    const czp = positions[(i + 1) * 3 + 2];
    const crossY = (bx - ax) * (czp - az) - (bz - az) * (cxp - ax);
    if (crossY < 0) {
      indices.push(0, i, i + 1);
    } else {
      indices.push(0, i + 1, i);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 2. Roads, raised Qingdao granite sidewalks & curbs, crosswalk stripes, centerlines,
 *    and the cobblestone approach from Huanghai Rd up to Huashilou gate.
 */
function buildRoadsAndSidewalks(ctx: WorldContext, textures: LandscapeTextureSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BadaguanRoadsAndSidewalks';
  const getH = ctx.getTerrainHeight;

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.045,
    roughness: 0.86,
    metalness: 0.04,
  });

  const filletMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.04,
    roughness: 0.86,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.06,
    roughness: 0.84,
    metalness: 0.03,
  });

  const cobbleMat = new THREE.MeshStandardMaterial({
    map: textures.cobbleMap,
    bumpMap: textures.cobbleBump,
    bumpScale: 0.09,
    roughness: 0.82,
    metalness: 0.04,
  });

  const curbStoneMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    bumpMap: textures.sidewalkBump,
    bumpScale: 0.05,
    color: new THREE.Color(0xd8d1c5),
    roughness: 0.78,
    metalness: 0.03,
  });

  const markingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe2d8c3),
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
    opacity: 0.74,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const addRibbon = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    leftOff: number,
    rightOff: number,
    crossSegs: number,
    yOff: number,
    mat: THREE.Material,
    uvU: number,
    uvV: number,
    skirtL = 0,
    skirtR = 0,
    castShadow = false,
  ) => {
    const pts = sampleLinePoints(x0, z0, x1, z1, 1.5);
    const geo = buildPathRibbonGeometry(pts, leftOff, rightOff, crossSegs, yOff, getH, uvU, uvV, skirtL, skirtR);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = castShadow;
    group.add(mesh);
  };

  const L = ROAD_LAYOUT;
  const ASPHALT_Y = 0.055;
  const SIDEWALK_Y = 0.165;
  const SKIRT = 0.28;

  // --- A. Asphalt Roadways (split cleanly at intersections so ZERO coplanar z-fighting) ---
  // 1. 居庸關路 (E-W continuous)
  addRibbon(
    L.JUYONGGUAN_X_MIN,
    L.JUYONGGUAN_Z,
    L.JUYONGGUAN_X_MAX,
    L.JUYONGGUAN_Z,
    -L.JUYONGGUAN_HALF_WIDTH,
    L.JUYONGGUAN_HALF_WIDTH,
    6,
    ASPHALT_Y,
    asphaltMat,
    0.25,
    0.25,
    0.14,
    0.14,
  );

  // 2. 山海關路 (E-W continuous)
  addRibbon(
    L.SHANHAIGUAN_X_MIN,
    L.SHANHAIGUAN_Z,
    L.SHANHAIGUAN_X_MAX,
    L.SHANHAIGUAN_Z,
    -L.SHANHAIGUAN_HALF_WIDTH,
    L.SHANHAIGUAN_HALF_WIDTH,
    6,
    ASPHALT_Y,
    asphaltMat,
    0.25,
    0.25,
    0.14,
    0.14,
  );

  // 3. 嘉峪關路 (N-S split tightly around Juyongguan & Shanhaiguan edges)
  const jiayuSegments: [number, number][] = [
    [L.JIAYUGUAN_Z_MIN, L.JUYONGGUAN_Z - L.JUYONGGUAN_HALF_WIDTH],
    [L.JUYONGGUAN_Z + L.JUYONGGUAN_HALF_WIDTH, L.SHANHAIGUAN_Z - L.SHANHAIGUAN_HALF_WIDTH],
    [L.SHANHAIGUAN_Z + L.SHANHAIGUAN_HALF_WIDTH, L.JIAYUGUAN_Z_MAX],
  ];
  for (const [zStart, zEnd] of jiayuSegments) {
    addRibbon(
      L.JIAYUGUAN_X,
      zStart,
      L.JIAYUGUAN_X,
      zEnd,
      -L.JIAYUGUAN_HALF_WIDTH,
      L.JIAYUGUAN_HALF_WIDTH,
      6,
      ASPHALT_Y,
      asphaltMat,
      0.25,
      0.25,
      0.14,
      0.14,
    );
  }

  // 4. 黃海路 (N-S split tightly around Juyongguan & Shanhaiguan edges, extending to Huashilou start)
  const huanghaiSegments: [number, number][] = [
    [L.HUANGHAI_Z_MIN, L.JUYONGGUAN_Z - L.JUYONGGUAN_HALF_WIDTH],
    [L.JUYONGGUAN_Z + L.JUYONGGUAN_HALF_WIDTH, L.SHANHAIGUAN_Z - L.SHANHAIGUAN_HALF_WIDTH],
    [L.SHANHAIGUAN_Z + L.SHANHAIGUAN_HALF_WIDTH, 35.0],
  ];
  for (const [zStart, zEnd] of huanghaiSegments) {
    addRibbon(
      L.HUANGHAI_X,
      zStart,
      L.HUANGHAI_X,
      zEnd,
      -L.HUANGHAI_HALF_WIDTH,
      L.HUANGHAI_HALF_WIDTH,
      6,
      ASPHALT_Y,
      asphaltMat,
      0.25,
      0.25,
      0.14,
      0.14,
    );
  }

  // --- B. Rounded Intersection Fillet Aprons ---
  const intersections = [
    { x: L.JIAYUGUAN_X, z: L.JUYONGGUAN_Z, hwx: L.JIAYUGUAN_HALF_WIDTH, hwz: L.JUYONGGUAN_HALF_WIDTH },
    { x: L.HUANGHAI_X, z: L.JUYONGGUAN_Z, hwx: L.HUANGHAI_HALF_WIDTH, hwz: L.JUYONGGUAN_HALF_WIDTH },
    { x: L.JIAYUGUAN_X, z: L.SHANHAIGUAN_Z, hwx: L.JIAYUGUAN_HALF_WIDTH, hwz: L.SHANHAIGUAN_HALF_WIDTH },
    { x: L.HUANGHAI_X, z: L.SHANHAIGUAN_Z, hwx: L.HUANGHAI_HALF_WIDTH, hwz: L.SHANHAIGUAN_HALF_WIDTH },
  ];
  for (const inter of intersections) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = inter.x + sx * inter.hwx;
        const cz = inter.z + sz * inter.hwz;
        const geo = buildCornerFilletGeometry(cx, cz, sx, sz, 2.2, ASPHALT_Y - 0.002, getH);
        const mesh = new THREE.Mesh(geo, filletMat);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  }

  // --- C. Raised Qingdao Granite Flagstone Sidewalks & Solid Curbs ---
  // Helper for E-W sidewalk spans broken at N-S road crossings
  const addEWSidewalk = (
    zCenter: number,
    innerOff: number,
    outerOff: number,
    xMin: number,
    xMax: number,
    skipJiayu: boolean,
    skipHuanghai: boolean,
  ) => {
    const breaks: [number, number][] = [];
    if (skipJiayu) breaks.push([L.JIAYUGUAN_X - L.JIAYUGUAN_SIDEWALK, L.JIAYUGUAN_X + L.JIAYUGUAN_SIDEWALK]);
    if (skipHuanghai) breaks.push([L.HUANGHAI_X - L.HUANGHAI_SIDEWALK, L.HUANGHAI_X + L.HUANGHAI_SIDEWALK]);
    breaks.sort((a, b) => a[0] - b[0]);

    let cur = xMin;
    const spans: [number, number][] = [];
    for (const [b0, b1] of breaks) {
      if (b0 > cur + 0.5) spans.push([cur, Math.min(b0, xMax)]);
      cur = Math.max(cur, b1);
    }
    if (cur < xMax - 0.5) spans.push([cur, xMax]);

    for (const [s0, s1] of spans) {
      // Because along +X, right-hand normal (nx, nz) = (0, 1) (+Z)
      const left = Math.min(innerOff, outerOff);
      const right = Math.max(innerOff, outerOff);
      addRibbon(
        s0,
        zCenter,
        s1,
        zCenter,
        left,
        right,
        2,
        SIDEWALK_Y,
        sidewalkMat,
        0.42,
        0.42,
        SKIRT,
        SKIRT,
        true,
      );
    }
  };

  // Juyongguan North & South sidewalks
  addEWSidewalk(
    L.JUYONGGUAN_Z,
    -L.JUYONGGUAN_SIDEWALK,
    -L.JUYONGGUAN_HALF_WIDTH,
    L.JUYONGGUAN_X_MIN,
    L.JUYONGGUAN_X_MAX,
    true,
    true,
  );
  addEWSidewalk(
    L.JUYONGGUAN_Z,
    L.JUYONGGUAN_HALF_WIDTH,
    L.JUYONGGUAN_SIDEWALK,
    L.JUYONGGUAN_X_MIN,
    L.JUYONGGUAN_X_MAX,
    true,
    true,
  );

  // Shanhaiguan North & South sidewalks
  addEWSidewalk(
    L.SHANHAIGUAN_Z,
    -L.SHANHAIGUAN_SIDEWALK,
    -L.SHANHAIGUAN_HALF_WIDTH,
    L.SHANHAIGUAN_X_MIN,
    L.SHANHAIGUAN_X_MAX,
    true,
    true,
  );
  addEWSidewalk(
    L.SHANHAIGUAN_Z,
    L.SHANHAIGUAN_HALF_WIDTH,
    L.SHANHAIGUAN_SIDEWALK,
    L.SHANHAIGUAN_X_MIN,
    L.SHANHAIGUAN_X_MAX,
    true,
    true,
  );

  // Helper for N-S sidewalk spans broken at E-W road crossings
  const addNSSidewalk = (
    xCenter: number,
    hw: number,
    sw: number,
    zMin: number,
    zMax: number,
  ) => {
    const zSpans: [number, number][] = [
      [zMin, L.JUYONGGUAN_Z - L.JUYONGGUAN_SIDEWALK],
      [L.JUYONGGUAN_Z + L.JUYONGGUAN_SIDEWALK, L.SHANHAIGUAN_Z - L.SHANHAIGUAN_SIDEWALK],
    ];
    if (zMax > L.SHANHAIGUAN_Z + L.SHANHAIGUAN_SIDEWALK + 0.5) {
      zSpans.push([L.SHANHAIGUAN_Z + L.SHANHAIGUAN_SIDEWALK, zMax]);
    }

    for (const [z0, z1] of zSpans) {
      // Going from z0 -> z1 (+Z), normal (nx, nz) = (-1, 0) (-X)
      addRibbon(xCenter, z0, xCenter, z1, hw, sw, 2, SIDEWALK_Y, sidewalkMat, 0.42, 0.42, SKIRT, SKIRT, true);
      addRibbon(xCenter, z0, xCenter, z1, -sw, -hw, 2, SIDEWALK_Y, sidewalkMat, 0.42, 0.42, SKIRT, SKIRT, true);
    }
  };

  addNSSidewalk(
    L.JIAYUGUAN_X,
    L.JIAYUGUAN_HALF_WIDTH,
    L.JIAYUGUAN_SIDEWALK,
    L.JIAYUGUAN_Z_MIN,
    L.JIAYUGUAN_Z_MAX,
  );
  addNSSidewalk(
    L.HUANGHAI_X,
    L.HUANGHAI_HALF_WIDTH,
    L.HUANGHAI_SIDEWALK,
    L.HUANGHAI_Z_MIN,
    34.8,
  );

  // Intersection corner sidewalk landing squares (connecting E-W & N-S sidewalks cleanly)
  for (const inter of intersections) {
    const swX = inter.x === L.JIAYUGUAN_X ? L.JIAYUGUAN_SIDEWALK : L.HUANGHAI_SIDEWALK;
    const swZ = inter.z === L.JUYONGGUAN_Z ? L.JUYONGGUAN_SIDEWALK : L.SHANHAIGUAN_SIDEWALK;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const xA = inter.x + sx * inter.hwx;
        const xB = inter.x + sx * swX;
        const zA = inter.z + sz * inter.hwz;
        const zB = inter.z + sz * swZ;
        const minX = Math.min(xA, xB);
        const maxX = Math.max(xA, xB);
        const minZ = Math.min(zA, zB);
        const maxZ = Math.max(zA, zB);
        const midZ = (minZ + maxZ) * 0.5;
        const halfDZ = (maxZ - minZ) * 0.5;
        addRibbon(minX, midZ, maxX, midZ, -halfDZ, halfDZ, 2, SIDEWALK_Y, sidewalkMat, 0.42, 0.42, SKIRT, SKIRT);
      }
    }
  }

  // --- D. Historic Granite Cobblestone Approach from Huanghai Rd (24, 34) to Huashilou Gate (31.5, 45) ---
  const approachCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(24.0, 0, 33.4),
      new THREE.Vector3(25.2, 0, 36.8),
      new THREE.Vector3(27.8, 0, 40.4),
      new THREE.Vector3(31.5, 0, 45.2),
      new THREE.Vector3(32.3, 0, 46.6),
    ],
    false,
    'centripetal',
    0.5,
  );
  const sampledApproach = approachCurve.getPoints(28);
  const approachPts: { x: number; z: number; nx: number; nz: number; dist: number }[] = [];
  let accumDist = 0;
  for (let i = 0; i < sampledApproach.length; i++) {
    const p = sampledApproach[i];
    if (i > 0) {
      accumDist += Math.hypot(p.x - sampledApproach[i - 1].x, p.z - sampledApproach[i - 1].z);
    }
    const prev = sampledApproach[Math.max(0, i - 1)];
    const next = sampledApproach[Math.min(sampledApproach.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.max(1e-5, Math.hypot(tx, tz));
    approachPts.push({
      x: p.x,
      z: p.z,
      nx: -tz / len,
      nz: tx / len,
      dist: accumDist,
    });
  }

  const approachGeo = buildPathRibbonGeometry(
    approachPts,
    -2.55,
    2.55,
    5,
    0.085,
    getH,
    0.45,
    0.45,
    0.26,
    0.26,
  );
  const approachMesh = new THREE.Mesh(approachGeo, cobbleMat);
  approachMesh.name = 'HuashilouCobblestoneApproach';
  approachMesh.receiveShadow = true;
  approachMesh.castShadow = true;
  group.add(approachMesh);

  // Raised dressed granite border kerbs flanking the Huashilou cobblestone lane
  for (const [kL, kR] of [
    [-2.92, -2.52],
    [2.52, 2.92],
  ] as [number, number][]) {
    const kerbGeo = buildPathRibbonGeometry(
      approachPts,
      kL,
      kR,
      1,
      0.19,
      getH,
      0.5,
      0.45,
      0.34,
      0.34,
    );
    const kerbMesh = new THREE.Mesh(kerbGeo, curbStoneMat);
    kerbMesh.receiveShadow = true;
    kerbMesh.castShadow = true;
    group.add(kerbMesh);
  }

  // --- E. Subtle Weathered Crosswalks & Dashed Road Centerlines ---
  const addCrosswalk = (cx: number, cz: number, acrossX: boolean, roadHalfW: number) => {
    const stripeCount = 6;
    const stripeW = 0.44;
    const stripeLen = 2.6;
    const span = roadHalfW * 1.62;
    for (let i = 0; i < stripeCount; i++) {
      const f = stripeCount > 1 ? i / (stripeCount - 1) - 0.5 : 0;
      const offset = f * span;
      if (acrossX) {
        addRibbon(
          cx + offset,
          cz - stripeLen * 0.5,
          cx + offset,
          cz + stripeLen * 0.5,
          -stripeW * 0.5,
          stripeW * 0.5,
          1,
          ASPHALT_Y + 0.02,
          markingMat,
          1,
          1,
        );
      } else {
        addRibbon(
          cx - stripeLen * 0.5,
          cz + offset,
          cx + stripeLen * 0.5,
          cz + offset,
          -stripeW * 0.5,
          stripeW * 0.5,
          1,
          ASPHALT_Y + 0.02,
          markingMat,
          1,
          1,
        );
      }
    }
  };

  for (const inter of intersections) {
    // East & West crosswalks across E-W avenue
    addCrosswalk(inter.x - inter.hwx - 2.3, inter.z, false, inter.hwz);
    addCrosswalk(inter.x + inter.hwx + 2.3, inter.z, false, inter.hwz);
    // North & South crosswalks across N-S avenue (skip south of Shanhaiguan if short stub)
    addCrosswalk(inter.x, inter.z - inter.hwz - 2.3, true, inter.hwx);
    if (inter.z < 20) {
      addCrosswalk(inter.x, inter.z + inter.hwz + 2.3, true, inter.hwx);
    }
  }

  // Subtle faded dashed centerlines along straight avenue blocks
  const addDashedCenterEW = (z: number, xStart: number, xEnd: number) => {
    const dashLen = 3.2;
    const gapLen = 4.4;
    for (let x = xStart; x + dashLen <= xEnd; x += dashLen + gapLen) {
      addRibbon(x, z, x + dashLen, z, -0.075, 0.075, 1, ASPHALT_Y + 0.018, markingMat, 1, 1);
    }
  };
  const addDashedCenterNS = (x: number, zStart: number, zEnd: number) => {
    const dashLen = 3.2;
    const gapLen = 4.4;
    for (let z = zStart; z + dashLen <= zEnd; z += dashLen + gapLen) {
      addRibbon(x, z, x, z + dashLen, -0.075, 0.075, 1, ASPHALT_Y + 0.018, markingMat, 1, 1);
    }
  };

  // Juyongguan center dashes
  addDashedCenterEW(L.JUYONGGUAN_Z, -82, L.JIAYUGUAN_X - 9);
  addDashedCenterEW(L.JUYONGGUAN_Z, L.JIAYUGUAN_X + 9, L.HUANGHAI_X - 9);
  addDashedCenterEW(L.JUYONGGUAN_Z, L.HUANGHAI_X + 9, 82);
  // Shanhaiguan center dashes
  addDashedCenterEW(L.SHANHAIGUAN_Z, -82, L.JIAYUGUAN_X - 9);
  addDashedCenterEW(L.SHANHAIGUAN_Z, L.JIAYUGUAN_X + 9, L.HUANGHAI_X - 9);
  addDashedCenterEW(L.SHANHAIGUAN_Z, L.HUANGHAI_X + 9, 75);
  // Jiayuguan & Huanghai center dashes
  addDashedCenterNS(L.JIAYUGUAN_X, -78, L.JUYONGGUAN_Z - 9.5);
  addDashedCenterNS(L.JIAYUGUAN_X, L.JUYONGGUAN_Z + 9.5, L.SHANHAIGUAN_Z - 9.5);
  addDashedCenterNS(L.HUANGHAI_X, -78, L.JUYONGGUAN_Z - 9.5);
  addDashedCenterNS(L.HUANGHAI_X, L.JUYONGGUAN_Z + 9.5, L.SHANHAIGUAN_Z - 9.5);

  return group;
}

/**
 * Faceted weathered coastal granite boulder geometry (angular granite cleavage planes,
 * NEVER smooth spheres!) with guaranteed outward-facing normals, triplanar UVs
 * (zero polar stretching), and deep bedrock roots so boulders never appear perched on cliffs.
 */
function createGraniteBoulderGeometry(
  seed: number,
  rx: number,
  ry: number,
  rz: number,
  detail = 2,
): THREE.BufferGeometry {
  const rng = createRng(seed);
  const geo = new THREE.IcosahedronGeometry(1, detail);

  // 4 gentle angular cleavage planes (kept mild so every triangle stays strictly convex/outward)
  const planes: { nx: number; ny: number; nz: number; d: number }[] = [];
  for (let p = 0; p < 4; p++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    planes.push({
      nx: Math.sin(phi) * Math.cos(theta),
      ny: Math.cos(phi),
      nz: Math.sin(phi) * Math.sin(theta),
      d: 0.78 + rng() * 0.20,
    });
  }

  const ph1 = rng() * 10;
  const ph2 = rng() * 10;
  const ph3 = rng() * 10;

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Smooth star-shaped radial crag displacement (bounded strictly > 0.65 so zero self-intersection)
    const n1 = Math.sin(ux * 2.4 + ph1) * Math.cos(uy * 2.2 + ph2) * Math.sin(uz * 2.4 + ph3);
    const n2 = Math.cos(ux * 4.6 - uz * 4.2 + ph2) * 0.45 + Math.sin(uy * 5.0 + ux * 3.5 + ph1) * 0.35;
    let rad = Math.max(0.68, Math.min(1.24, 1.0 + n1 * 0.17 + n2 * 0.065));

    let x = ux * rad;
    let y = uy * rad;
    let z = uz * rad;

    // Gentle granite cleavage flattening (soft 0.32 blend preserves strictly positive triangle winding)
    for (const pl of planes) {
      const proj = x * pl.nx + y * pl.ny + z * pl.nz;
      if (proj > pl.d) {
        const excess = (proj - pl.d) * 0.32;
        x -= pl.nx * excess;
        y -= pl.ny * excess;
        z -= pl.nz * excess;
      }
    }

    // Extend & broaden lower rock root deep downward so outcrops anchor solidly into steep cliff slopes
    if (y < -0.1) {
      const t = Math.min(1, (-y - 0.1) / 0.9);
      y -= t * 0.42;
      x *= 1 + t * 0.16;
      z *= 1 + t * 0.16;
    }

    pos.setXYZ(i, x * rx, y * ry, z * rz);

    // Vertex shading: sunlit warm pale-ochre granite crown, damp weathered tidal base
    const topT = smoothstep(-0.75, 0.75, y);
    const shade = 0.72 + 0.32 * topT;
    colors[i * 3] = shade * (0.98 + n1 * 0.06);
    colors[i * 3 + 1] = shade * (0.95 + n1 * 0.05);
    colors[i * 3 + 2] = shade * (0.89 + n2 * 0.04);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Verify outward winding for every triangle on non-indexed IcosahedronGeometry & compute box-projected UVs
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const triN = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    vA.fromBufferAttribute(pos, i);
    vB.fromBufferAttribute(pos, i + 1);
    vC.fromBufferAttribute(pos, i + 2);
    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    triN.crossVectors(e1, e2);
    centroid.addVectors(vA, vB).add(vC).multiplyScalar(1 / 3);

    // Swap winding if any triangle ever inverted inward (guarantees zero pitch-black facets)
    if (triN.dot(centroid) < 0) {
      pos.setXYZ(i + 1, vC.x, vC.y, vC.z);
      pos.setXYZ(i + 2, vB.x, vB.y, vB.z);
      triN.negate();
    }

    // Box-projected triplanar UVs per triangle so granite grain never streaks horizontally
    const ax = Math.abs(triN.x);
    const ay = Math.abs(triN.y);
    const az = Math.abs(triN.z);
    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const px = pos.getX(vi);
      const py = pos.getY(vi);
      const pz = pos.getZ(vi);
      if (ay >= ax && ay >= az) {
        uv.setXY(vi, px * 0.42, pz * 0.42);
      } else if (ax >= az) {
        uv.setXY(vi, pz * 0.42, py * 0.42);
      } else {
        uv.setXY(vi, px * 0.42, py * 0.42);
      }
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * 3. Sculpted coastal granite boulders & reef outcrops around Huashilou cape,
 *    eastern rocky shore, western beach headland, and breakwater base armor stones.
 */
function buildCoastalBoulders(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): { group: THREE.Group; colliders: Collider[] } {
  const group = new THREE.Group();
  group.name = 'CoastalGraniteBoulders';
  const colliders: Collider[] = [];
  const rng = createRng(9091);

  const rockTex = textures.cliffRockMap.clone();
  rockTex.repeat.set(1.6, 1.6);
  rockTex.needsUpdate = true;
  const rockBump = textures.cliffRockBump.clone();
  rockBump.repeat.set(1.6, 1.6);
  rockBump.needsUpdate = true;

  const boulderMat = new THREE.MeshStandardMaterial({
    map: rockTex,
    bumpMap: rockBump,
    bumpScale: 0.16,
    vertexColors: true,
    roughness: 0.87,
    metalness: 0.04,
  });

  // 7 distinct sculpted granite boulder archetype geometries (reused with varied scale & orientation)
  const archetypes: THREE.BufferGeometry[] = [
    createGraniteBoulderGeometry(9101, 1.0, 0.78, 0.88, 2),
    createGraniteBoulderGeometry(9102, 1.12, 0.68, 0.85, 2),
    createGraniteBoulderGeometry(9103, 0.90, 0.92, 0.94, 2),
    createGraniteBoulderGeometry(9104, 1.24, 0.64, 0.95, 2),
    createGraniteBoulderGeometry(9105, 0.96, 0.80, 1.12, 2),
    createGraniteBoulderGeometry(9106, 1.08, 0.72, 0.80, 2),
    createGraniteBoulderGeometry(9107, 1.02, 0.86, 0.90, 2),
  ];

  const placeBoulder = (
    x: number,
    z: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    yEmbedOffset = -0.75,
    addCollider = true,
  ) => {
    const h = ctx.getTerrainHeight(x, z);
    // Sample lowest nearby terrain point across footprint so boulder anchors deeply on steep slopes
    const sampleR = Math.max(scaleX, scaleZ) * 0.55;
    const hMin = Math.min(
      h,
      ctx.getTerrainHeight(x + sampleR, z),
      ctx.getTerrainHeight(x - sampleR, z),
      ctx.getTerrainHeight(x, z + sampleR),
      ctx.getTerrainHeight(x, z - sampleR),
    );
    const anchorY = THREE.MathUtils.lerp(h, hMin, 0.58);
    const geo = archetypes[Math.floor(rng() * archetypes.length)];
    const mesh = new THREE.Mesh(geo, boulderMat);
    mesh.position.set(x, anchorY + scaleY * 0.30 + yEmbedOffset, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.rotation.set((rng() - 0.5) * 0.22, rng() * Math.PI * 2, (rng() - 0.5) * 0.22);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const approxRadius = Math.max(scaleX, scaleZ) * 0.82;
    const topY = mesh.position.y + scaleY * 0.72;
    if (addCollider && approxRadius >= 1.1 && topY > 0.35 && h > -0.5) {
      colliders.push({
        type: 'cylinder',
        x,
        z,
        radius: approxRadius,
        maxY: topY,
      });
    }
  };

  // A. Dramatic granite cliffs & tidal reef outcrops ringing Huashilou cape (34, 56)
  const hc = ROAD_LAYOUT.HUASHILOU_CENTER;
  for (let i = 0; i < 44; i++) {
    // Sweep around seaward, west, and east flanks; skip north-west causeway entry around angle -2.1..-1.55 rad
    const angle = -1.35 + (i / 43) * (Math.PI * 1.78) + (rng() - 0.5) * 0.09;
    const ring = i % 3; // 0: upper cliff ledge, 1: mid-slope crag, 2: tidal surf reef
    const r = ring === 0 ? 16.4 + rng() * 3.4 : ring === 1 ? 20.2 + rng() * 4.4 : 24.2 + rng() * 5.8;
    const bx = hc.x + Math.cos(angle) * r;
    const bz = hc.z + Math.sin(angle) * r;

    // Keep cobblestone approach completely clear
    if (bx < 33 && bz < 47) continue;

    // Inside VP4 sightline corridor (west-southwest foreground x in [4, 23], z in [52, 66]):
    // keep rocks as low rugged tidal outcrops so Huashilou's stone terrace & cliff read cleanly!
    const inVp4Corridor = bx >= 4 && bx <= 23.5 && bz >= 52 && bz <= 66.5;
    if (inVp4Corridor && ring === 0) continue;

    let sx = (ring === 2 ? 2.2 : 1.65) + rng() * 2.1;
    let sy = (ring === 0 ? 1.25 : 1.05) + rng() * 1.45;
    let sz = (ring === 2 ? 2.0 : 1.55) + rng() * 1.9;
    let embed = -0.72;

    if (inVp4Corridor) {
      sx = Math.min(sx, 2.3);
      sy = Math.min(sy, 1.08);
      sz = Math.min(sz, 2.1);
      embed = -0.68;
    }

    placeBoulder(bx, bz, sx, sy, sz, embed, ring < 2);
  }

  // Hero iconic coastal granite monoliths framing Huashilou's seaward & tidal surf edge
  const heroCapeRocks: [number, number, number, number, number, number][] = [
    // Low tidal outcrops on west-southwest edge (frame VP4 water & cliff without hiding terrace)
    [13.5, 53.5, 2.3, 1.05, 2.0, -0.65],
    [14.2, 63.8, 2.5, 1.12, 2.2, -0.68],
    [18.8, 69.8, 3.2, 1.75, 2.7, -0.78],
    // Dramatic crashing-surf reefs along south & southeast cape cliffs
    [26.5, 76.8, 3.9, 2.15, 3.2, -0.82],
    [36.2, 79.2, 4.3, 2.45, 3.3, -0.85],
    [47.5, 73.5, 3.9, 2.35, 3.4, -0.82],
    [54.5, 63.0, 3.6, 2.15, 3.1, -0.78],
  ];
  for (const [rx, rz, sx, sy, sz, embed] of heroCapeRocks) {
    placeBoulder(rx, rz, sx, sy, sz, embed, true);
  }

  // B. Eastern rocky granite shoreline (x in [54, 96], z in [37, 62])
  for (let i = 0; i < 24; i++) {
    const bx = 54 + (i / 23) * 44 + (rng() - 0.5) * 4.5;
    const bz = 38.5 + rng() * 20;
    const sx = 1.6 + rng() * 2.4;
    const sy = 1.05 + rng() * 1.55;
    const sz = 1.5 + rng() * 2.2;
    placeBoulder(bx, bz, sx, sy, sz, -0.68, bz < 50);
  }

  // C. Western cove rocky flank bounding No. 2 Bathing Beach (x in [-88, -68], z in [43, 72])
  for (let i = 0; i < 18; i++) {
    const bx = -88 + rng() * 20;
    const bz = 44 + (i / 17) * 26 + (rng() - 0.5) * 3.5;
    const sx = 1.8 + rng() * 2.5;
    const sy = 1.05 + rng() * 1.55;
    const sz = 1.6 + rng() * 2.2;
    placeBoulder(bx, bz, sx, sy, sz, -0.68, bz < 62);
  }

  // D. Breakwater base granite armor rocks (拋石護岸) hugging the pier root & outer wave-facing flank
  const armorCoords: [number, number, number][] = [
    [-47.6, 56.5, 1.45],
    [-46.8, 59.8, 1.65],
    [-40.4, 59.4, 1.35],
    [-44.5, 65.5, 1.8],
    [-42.0, 71.2, 1.95],
    [-36.5, 80.0, 1.85],
    [-29.2, 88.2, 1.95],
    [-19.8, 96.4, 2.0],
  ];
  for (const [ax, az, s] of armorCoords) {
    placeBoulder(ax, az, s * (0.9 + rng() * 0.3), s * 0.72, s * (0.85 + rng() * 0.3), -0.58, false);
  }

  return { group, colliders };
}

export function buildTerrainAndRoads(
  ctx: WorldContext,
  textures: LandscapeTextureSet,
): TerrainBuildResult {
  const group = new THREE.Group();
  group.name = 'TerrainAndRoads';

  const terrainMesh = buildTerrainMesh(ctx, textures);
  group.add(terrainMesh);

  const roadsGroup = buildRoadsAndSidewalks(ctx, textures);
  group.add(roadsGroup);

  const { group: bouldersGroup, colliders } = buildCoastalBoulders(ctx, textures);
  group.add(bouldersGroup);

  return { group, colliders };
}
