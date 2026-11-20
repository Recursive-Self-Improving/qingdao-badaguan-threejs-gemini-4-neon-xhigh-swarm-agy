export const ROAD_LAYOUT = {
  JUYONGGUAN_Z: -24,
  JUYONGGUAN_HALF_WIDTH: 4.6,
  JUYONGGUAN_SIDEWALK: 6.8,
  JUYONGGUAN_X_MIN: -88,
  JUYONGGUAN_X_MAX: 88,

  SHANHAIGUAN_Z: 26,
  SHANHAIGUAN_HALF_WIDTH: 4.5,
  SHANHAIGUAN_SIDEWALK: 6.8,
  SHANHAIGUAN_X_MIN: -88,
  SHANHAIGUAN_X_MAX: 80,

  JIAYUGUAN_X: -26,
  JIAYUGUAN_HALF_WIDTH: 4.2,
  JIAYUGUAN_SIDEWALK: 6.2,
  JIAYUGUAN_Z_MIN: -84,
  JIAYUGUAN_Z_MAX: 31,

  HUANGHAI_X: 24,
  HUANGHAI_HALF_WIDTH: 4.2,
  HUANGHAI_SIDEWALK: 6.2,
  HUANGHAI_Z_MIN: -84,
  HUANGHAI_Z_MAX: 38,

  HUASHILOU_CENTER: { x: 34, z: 56, y: 8.2 },
  PRINCESS_CENTER: { x: -1, z: -49 },
  BUTTERFLY_CENTER: { x: -1, z: 1 },

  PIER_POINTS: [
    [-44, 58],
    [-38, 72],
    [-30, 84],
    [-20, 93],
    [-10, 98],
  ] as [number, number][],
  PIER_WIDTH: 4.4,
  PIER_DECK_Y: 1.65,
  SEAWALL_Z: 35.5,

  BEACH_STAIRS: {
    minX: -30,
    maxX: -22,
    topZ: 35.5,
    bottomZ: 44.0,
  },
} as const;

export interface LandmarkInfo {
  id: string;
  name: string;
  subtitle: string;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function distToSegmentWithT(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): { dist: number; t: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-8) {
    return { dist: Math.hypot(px - ax, pz - az), t: 0 };
  }
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / lenSq, 0, 1);
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return { dist: Math.hypot(px - cx, pz - cz), t };
}

function distToRect(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): number {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
  if (dx === 0 && dz === 0) {
    const insideX = Math.min(x - minX, maxX - x);
    const insideZ = Math.min(z - minZ, maxZ - z);
    return -Math.min(insideX, insideZ);
  }
  return Math.hypot(dx, dz);
}

/**
 * Signed distance from (x, z) to the nearest road asphalt surface:
 *   <= 0  means inside road asphalt
 *   > 0   means distance in meters outside the nearest road asphalt edge
 */
export function getRoadDistance(x: number, z: number): number {
  const dJuyong = distToRect(
    x,
    z,
    ROAD_LAYOUT.JUYONGGUAN_X_MIN,
    ROAD_LAYOUT.JUYONGGUAN_X_MAX,
    ROAD_LAYOUT.JUYONGGUAN_Z - ROAD_LAYOUT.JUYONGGUAN_HALF_WIDTH,
    ROAD_LAYOUT.JUYONGGUAN_Z + ROAD_LAYOUT.JUYONGGUAN_HALF_WIDTH
  );

  const dShanhai = distToRect(
    x,
    z,
    ROAD_LAYOUT.SHANHAIGUAN_X_MIN,
    ROAD_LAYOUT.SHANHAIGUAN_X_MAX,
    ROAD_LAYOUT.SHANHAIGUAN_Z - ROAD_LAYOUT.SHANHAIGUAN_HALF_WIDTH,
    ROAD_LAYOUT.SHANHAIGUAN_Z + ROAD_LAYOUT.SHANHAIGUAN_HALF_WIDTH
  );

  const dJiayu = distToRect(
    x,
    z,
    ROAD_LAYOUT.JIAYUGUAN_X - ROAD_LAYOUT.JIAYUGUAN_HALF_WIDTH,
    ROAD_LAYOUT.JIAYUGUAN_X + ROAD_LAYOUT.JIAYUGUAN_HALF_WIDTH,
    ROAD_LAYOUT.JIAYUGUAN_Z_MIN,
    ROAD_LAYOUT.JIAYUGUAN_Z_MAX
  );

  const dHuanghai = distToRect(
    x,
    z,
    ROAD_LAYOUT.HUANGHAI_X - ROAD_LAYOUT.HUANGHAI_HALF_WIDTH,
    ROAD_LAYOUT.HUANGHAI_X + ROAD_LAYOUT.HUANGHAI_HALF_WIDTH,
    ROAD_LAYOUT.HUANGHAI_Z_MIN,
    ROAD_LAYOUT.HUANGHAI_Z_MAX
  );

  // Cobblestone approach path from Huanghai Rd (24, 34) to Huashilou gate (31.5, 45)
  const approach = distToSegmentWithT(x, z, 24, 34, 31.5, 45);
  const dApproach = approach.dist - 2.4;

  return Math.min(dJuyong, dShanhai, dJiayu, dHuanghai, dApproach);
}

export function isOnRoad(x: number, z: number): boolean {
  return getRoadDistance(x, z) <= 0;
}

export function isOnSidewalk(x: number, z: number): boolean {
  if (isOnRoad(x, z)) return false;

  const onJuyongWalk =
    x >= ROAD_LAYOUT.JUYONGGUAN_X_MIN &&
    x <= ROAD_LAYOUT.JUYONGGUAN_X_MAX &&
    Math.abs(z - ROAD_LAYOUT.JUYONGGUAN_Z) <= ROAD_LAYOUT.JUYONGGUAN_SIDEWALK;

  const onShanhaiWalk =
    x >= ROAD_LAYOUT.SHANHAIGUAN_X_MIN &&
    x <= ROAD_LAYOUT.SHANHAIGUAN_X_MAX &&
    Math.abs(z - ROAD_LAYOUT.SHANHAIGUAN_Z) <= ROAD_LAYOUT.SHANHAIGUAN_SIDEWALK;

  const onJiayuWalk =
    z >= ROAD_LAYOUT.JIAYUGUAN_Z_MIN &&
    z <= ROAD_LAYOUT.JIAYUGUAN_Z_MAX &&
    Math.abs(x - ROAD_LAYOUT.JIAYUGUAN_X) <= ROAD_LAYOUT.JIAYUGUAN_SIDEWALK;

  const onHuanghaiWalk =
    z >= ROAD_LAYOUT.HUANGHAI_Z_MIN &&
    z <= ROAD_LAYOUT.HUANGHAI_Z_MAX &&
    Math.abs(x - ROAD_LAYOUT.HUANGHAI_X) <= ROAD_LAYOUT.HUANGHAI_SIDEWALK;

  // Seawall coastal promenade strip
  const onPromenade =
    x >= -76 && x <= 70 && z >= 31.5 && z <= ROAD_LAYOUT.SEAWALL_Z + 0.5;

  return (
    onJuyongWalk ||
    onShanhaiWalk ||
    onJiayuWalk ||
    onHuanghaiWalk ||
    onPromenade
  );
}

/**
 * Curved shoreline Z coordinate along No. 2 Bathing Beach cove (where Y = 0).
 */
export function getShorelineZ(x: number): number {
  return 64 + 8 * Math.sin((x + 45) * 0.055);
}

const VILLA_FLAT_BOXES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-17, 15, -64, -34], // Princess House courtyard
  [-17, 15, -14, 16], // Butterfly House courtyard
  [-73, -36, -64, -34], // NW historic villa
  [33, 70, -64, -34], // NE historic villa
  [-73, -36, -14, 16], // SW historic villa
  [33, 70, -14, 16], // SE historic villa
];

function getFlatnessFactor(x: number, z: number): number {
  // 0 = completely flat (no undulation), 1 = full gentle undulation
  const roadDist = getRoadDistance(x, z);
  let factor = smoothstep(1.8, 5.5, roadDist);

  // Flatten along seawall promenade
  if (x >= -84 && x <= 76) {
    const promDist = Math.abs(z - 33.8);
    factor = Math.min(factor, smoothstep(2.4, 6.0, promDist));
  }

  // Flatten inside villa footprints so buildings & courtyards sit cleanly
  for (let i = 0; i < VILLA_FLAT_BOXES.length; i++) {
    const b = VILLA_FLAT_BOXES[i];
    const d = distToRect(x, z, b[0], b[1], b[2], b[3]);
    if (d <= 4.0) {
      factor = Math.min(factor, smoothstep(0.0, 4.0, d));
    }
  }

  return factor;
}

/**
 * Exact elevation Y (meters, Y = 0 sea level) for Qingdao Badaguan.
 */
export function getTerrainHeight(x: number, z: number): number {
  // 1. Inland plateau & gentle coastal slope
  const baseInland = 6.2 + Math.max(0, 33 - z) * 0.045;
  const rawUndulation =
    0.14 * Math.sin(x * 0.045 + 0.7) * Math.cos(z * 0.052 - 0.3) +
    0.09 * Math.sin(x * 0.09 - z * 0.07);
  const flatFactor = getFlatnessFactor(x, z);
  const inlandY = baseInland + rawUndulation * flatFactor;

  // 2. Distant lush Taiping Mountain backdrop hills (z < -85 or |x| > 92 inland)
  let hillAdd = 0;
  if (z < -80 || Math.abs(x) > 86) {
    const northT = smoothstep(-82, -146, z);
    const sideCoastFade = 1 - smoothstep(12, 42, z);
    const westT = smoothstep(-88, -148, x) * sideCoastFade;
    const eastT = smoothstep(88, 148, x) * sideCoastFade;
    const hillEnv = Math.max(northT, Math.max(westT, eastT) * 0.82);
    if (hillEnv > 0) {
      const ridge =
        0.68 +
        0.22 * Math.sin(x * 0.032 + 1.1) * Math.cos(z * 0.028) +
        0.14 * Math.sin(x * 0.068 - z * 0.055);
      hillAdd = hillEnv * 22.0 * ridge;
    }
  }

  const fullInlandY = inlandY + hillAdd;

  // Fast path well inland
  if (z <= 33.0) {
    return fullInlandY;
  }

  // 3. Coastal drop-off south of seawall (z > 33) -> No. 2 Bathing Beach cove & seafloor
  const shoreZ = getShorelineZ(x);

  // Sandy cove spans mainly x in [-74, 16]; outside that, coastline is rockier/steeper
  const coveMaskWest = smoothstep(-86, -64, x);
  const coveMaskEast = 1 - smoothstep(10, 26, x);
  const coveMask = coveMaskWest * coveMaskEast;

  // Beach elevation profile for z >= 41.5
  let beachProfileY: number;
  if (z <= shoreZ) {
    const span = Math.max(12, shoreZ - 41.5);
    const beachT = clamp((z - 41.5) / span, 0, 1);
    beachProfileY = 3.55 * Math.pow(1 - beachT, 1.18);
  } else {
    const seaDepthT = smoothstep(shoreZ, shoreZ + 28, z);
    beachProfileY = -3.8 * seaDepthT;
  }

  // Steeper rocky shore outside the sandy cove
  const rockyDropT = smoothstep(35.5, 54.0, z);
  const rockyCoastY = lerp(6.2, -3.5, rockyDropT);

  // Seawall drop between z = 35.5 (promenade top 6.2m) and z = 41.5 (upper beach 3.55m)
  const wallDropT = smoothstep(35.4, 41.5, z);
  const coveSurfaceY =
    z < 41.5 ? lerp(fullInlandY, 3.55, wallDropT) : beachProfileY;

  let coastY = lerp(rockyCoastY, coveSurfaceY, coveMask);
  // Keep promenade solid up to SEAWALL_Z
  if (z <= 35.5) {
    coastY = lerp(fullInlandY, coastY, smoothstep(33.5, 35.5, z));
  }

  // 4. Huashilou granite promontory around (34, 56) & approach causeway from (24, 33)
  const dx = x - ROAD_LAYOUT.HUASHILOU_CENTER.x;
  const dz = z - ROAD_LAYOUT.HUASHILOU_CENTER.z;
  const distCape = Math.hypot(dx, dz);

  let promontoryY = -4.0;
  if (distCape < 34) {
    if (distCape <= 14.5) {
      promontoryY = ROAD_LAYOUT.HUASHILOU_CENTER.y;
    } else {
      const angle = Math.atan2(dz, dx);
      const crag =
        2.1 * Math.sin(angle * 3 + 0.5) +
        1.1 * Math.cos(angle * 5 - 0.9) +
        0.55 * Math.sin(angle * 7 + 1.8);
      const outerEdge = 25.5 + crag;
      const cliffT = smoothstep(14.5, outerEdge, distCape);
      const rockNoise =
        0.35 * Math.sin(x * 0.42 + z * 0.31) * Math.sin(cliffT * Math.PI);
      promontoryY =
        lerp(ROAD_LAYOUT.HUASHILOU_CENTER.y, -3.2, cliffT) + rockNoise;
    }
  }

  // Causeway ridge connecting Huanghai Rd (24, 33.5) -> Huashilou cape (34, 50)
  const neck = distToSegmentWithT(x, z, 24, 33.5, 34, 50);
  if (neck.dist < 16) {
    const neckTargetY = lerp(
      6.2,
      ROAD_LAYOUT.HUASHILOU_CENTER.y,
      smoothstep(0.0, 0.95, neck.t)
    );
    const neckDropT = smoothstep(5.6, 14.5, neck.dist);
    const neckY = lerp(neckTargetY, -3.2, neckDropT);
    if (neckY > promontoryY) {
      promontoryY = neckY;
    }
  }

  // Smooth max between coastal cove/seafloor and Huashilou promontory
  if (promontoryY > coastY) {
    const diff = promontoryY - coastY;
    const blend = smoothstep(0, 1.4, diff);
    return lerp(coastY, promontoryY, blend);
  }
  return coastY;
}

/**
 * Minimum distance from (x, z) to the curved breakwater pier centerline.
 */
export function getPierDistance(x: number, z: number): number {
  const pts = ROAD_LAYOUT.PIER_POINTS;
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const res = distToSegmentWithT(
      x,
      z,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1]
    );
    if (res.dist < minD) minD = res.dist;
  }
  return minD;
}

export function isOnPier(x: number, z: number): boolean {
  return getPierDistance(x, z) <= ROAD_LAYOUT.PIER_WIDTH * 0.5 + 0.15;
}

export function isOnBeachStairs(x: number, z: number): boolean {
  const s = ROAD_LAYOUT.BEACH_STAIRS;
  return x >= s.minX && x <= s.maxX && z >= s.topZ && z <= s.bottomZ;
}

export function isOnBeach(x: number, z: number): boolean {
  if (x < -78 || x > 15 || z < 39.5) return false;
  const shoreZ = getShorelineZ(x);
  if (z > shoreZ + 1.5) return false;
  const h = getTerrainHeight(x, z);
  return h >= -0.25 && h <= 4.3;
}

/**
 * Walkable elevation Y (meters) accounting for:
 *  - Curved stone breakwater pier (y = 1.65m + smooth sandy ramp onto pier start)
 *  - Granite staircase down from seawall promenade to No. 2 Bathing Beach
 *  - Terrain elevation everywhere else
 */
export function getWalkableHeight(x: number, z: number): number {
  const terrainY = getTerrainHeight(x, z);

  // 1. Curved stone breakwater pier
  const pierD = getPierDistance(x, z);
  if (pierD <= ROAD_LAYOUT.PIER_WIDTH * 0.5 + 0.15) {
    return Math.max(terrainY, ROAD_LAYOUT.PIER_DECK_Y);
  }

  // Smooth sandy ramp connecting upper beach (-46, 52.5) to pier start (-44, 58)
  const ramp = distToSegmentWithT(x, z, -46.0, 52.5, -44.0, 58.0);
  if (ramp.dist <= ROAD_LAYOUT.PIER_WIDTH * 0.5 + 0.25) {
    const startY = getTerrainHeight(-46.0, 52.5);
    const rampY = lerp(startY, ROAD_LAYOUT.PIER_DECK_Y, ramp.t);
    return Math.max(terrainY, rampY);
  }

  // 2. Beach stone staircase at x in [-30, -22], z in [35.5, 44.0]
  const s = ROAD_LAYOUT.BEACH_STAIRS;
  if (x >= s.minX && x <= s.maxX && z >= s.topZ - 0.5 && z <= s.bottomZ + 0.5) {
    const t = clamp((z - s.topZ) / (s.bottomZ - s.topZ), 0, 1);
    const topY = getTerrainHeight(-26, s.topZ);
    const bottomY = getTerrainHeight(-26, s.bottomZ);
    return lerp(topY, bottomY, t);
  }

  return terrainY;
}

/**
 * Returns poetic Chinese landmark name & subtitle for the player's current position.
 */
export function getLandmarkAt(x: number, z: number): LandmarkInfo {
  if (isOnPier(x, z)) {
    return {
      id: 'pier',
      name: '第二海水浴場 · 防波堤',
      subtitle: '伸向黃海的石築長堤與紅白航標燈塔',
    };
  }

  if (
    Math.hypot(
      x - ROAD_LAYOUT.HUASHILOU_CENTER.x,
      z - ROAD_LAYOUT.HUASHILOU_CENTER.z
    ) < 23
  ) {
    return {
      id: 'huashilou',
      name: '花石樓 · 黃海路18號',
      subtitle: '臨海岬角上的哥德式花崗岩城堡',
    };
  }

  if (isOnBeach(x, z)) {
    return {
      id: 'beach',
      name: '第二海水浴場 · 金色沙灘',
      subtitle: '山海相擁的月牙海灣與彩頂木屋',
    };
  }

  if (
    Math.hypot(
      x - ROAD_LAYOUT.PRINCESS_CENTER.x,
      z - ROAD_LAYOUT.PRINCESS_CENTER.z
    ) < 19
  ) {
    return {
      id: 'princess',
      name: '公主樓 · 居庸關路10號',
      subtitle: '丹麥童話風格的藍牆紅瓦洋樓',
    };
  }

  if (
    Math.hypot(
      x - ROAD_LAYOUT.BUTTERFLY_CENTER.x,
      z - ROAD_LAYOUT.BUTTERFLY_CENTER.z
    ) < 19
  ) {
    return {
      id: 'butterfly',
      name: '蝴蝶樓 · 山海關路21號',
      subtitle: '明黃折衷主義洋樓與老電影歲月',
    };
  }

  if (Math.abs(z - ROAD_LAYOUT.JUYONGGUAN_Z) < 8.5) {
    return {
      id: 'juyongguan',
      name: '居庸關路 · 銀杏大道',
      subtitle: '深秋金色拱廊與落葉鋪地的長街',
    };
  }

  if (Math.abs(x - ROAD_LAYOUT.JIAYUGUAN_X) < 8.0 && z < 33) {
    return {
      id: 'jiayuguan',
      name: '嘉峪關路 · 五角楓大道',
      subtitle: '霜染丹楓映照青島花崗岩石牆',
    };
  }

  if (Math.abs(z - ROAD_LAYOUT.SHANHAIGUAN_Z) < 8.5) {
    return {
      id: 'shanhaiguan',
      name: '山海關路 · 海濱林蔭道',
      subtitle: '法國梧桐、海濱黑松與鹹潤海風',
    };
  }

  if (Math.abs(x - ROAD_LAYOUT.HUANGHAI_X) < 8.0 && z < 44) {
    return {
      id: 'huanghai',
      name: '黃海路 · 岬角通幽徑',
      subtitle: '綠蔭深處通往花石樓的海岸石徑',
    };
  }

  if (z >= 31.5 && z <= 39.5) {
    return {
      id: 'seawall',
      name: '海濱石牆觀海步道',
      subtitle: '花崗岩石柱鐵鍊與匯泉灣陣陣濤聲',
    };
  }

  return {
    id: 'badaguan',
    name: '青島 · 八大關歷史街區',
    subtitle: '紅瓦綠樹 · 碧海藍天',
  };
}
