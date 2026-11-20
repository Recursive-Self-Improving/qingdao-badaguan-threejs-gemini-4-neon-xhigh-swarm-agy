import * as THREE from 'three';
import type { MoodConfig, WorldContext } from '../types';
import { ROAD_LAYOUT, getPierDistance } from '../terrainMath';

export interface YellowSeaSystem {
  mesh: THREE.Mesh;
  update: (elapsed: number) => void;
  setMood: (mood: MoodConfig) => void;
}

const OCEAN_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec3 aCoastData; // x: waterDepth (-seabedY), y: distToPier, z: rockyCoastFactor

uniform float uTime;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vCoastData;
varying float vWaveCrest;
varying float vFogDepth;

vec3 gerstnerWave(
  vec2 pos,
  vec2 dir,
  float steepness,
  float wavelength,
  float speed,
  float t,
  inout vec3 tangent,
  inout vec3 binormal
) {
  float k = 6.28318530718 / wavelength;
  float c = sqrt(9.81 / k) * speed;
  vec2 d = normalize(dir);
  float f = k * (dot(d, pos) - c * t);
  float a = steepness / k;

  float sf = sin(f);
  float cf = cos(f);

  tangent += vec3(
    -d.x * d.x * (steepness * sf),
    d.x * (steepness * cf),
    -d.x * d.y * (steepness * sf)
  );
  binormal += vec3(
    -d.x * d.y * (steepness * sf),
    d.y * (steepness * cf),
    -d.y * d.y * (steepness * sf)
  );

  return vec3(d.x * (a * cf), a * sf, d.y * (a * cf));
}

void main() {
  vec3 pos = position;
  vCoastData = aCoastData;

  // Attenuate vertical swell smoothly in very shallow cove water and right at the pier
  float depthAtten = smoothstep(-0.35, 2.2, aCoastData.x);
  float pierAtten = smoothstep(0.0, 2.4, aCoastData.y);
  float farAtten = 1.0 - smoothstep(420.0, 1080.0, length(pos.xz));
  float ampScale = depthAtten * mix(0.32, 1.0, pierAtten) * mix(0.45, 1.0, farAtten);

  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 disp = vec3(0.0);

  // Five Yellow Sea swell components rolling gently toward Qingdao's coastline (-Z)
  disp += gerstnerWave(pos.xz, vec2(0.18, -0.98), 0.11 * ampScale, 26.0, 0.72, uTime, tangent, binormal);
  disp += gerstnerWave(pos.xz, vec2(-0.32, -0.95), 0.085 * ampScale, 15.5, 0.84, uTime, tangent, binormal);
  disp += gerstnerWave(pos.xz, vec2(0.55, -0.83), 0.065 * ampScale, 9.2, 0.96, uTime, tangent, binormal);
  disp += gerstnerWave(pos.xz, vec2(-0.68, -0.73), 0.048 * ampScale, 5.4, 1.08, uTime, tangent, binormal);
  disp += gerstnerWave(pos.xz, vec2(0.12, -0.99), 0.035 * ampScale, 3.3, 1.15, uTime, tangent, binormal);

  // Subtle vertical lift for gentle shore swash right at the waterline
  float swashLift = sin(uTime * 1.15 - pos.z * 0.22 + pos.x * 0.04) * 0.035
    * smoothstep(-0.2, 0.3, aCoastData.x)
    * (1.0 - smoothstep(0.6, 2.2, aCoastData.x));
  pos += disp;
  pos.y += swashLift;

  vec3 normal = normalize(cross(binormal, tangent));
  vNormal = normal;
  vWaveCrest = clamp(disp.y * 2.4 + 0.5, 0.0, 1.0);

  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPosition.xyz;

  vec4 mvPosition = viewMatrix * worldPosition;
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const OCEAN_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uSkyTopColor;
uniform vec3 uSkyHorizonColor;
uniform vec3 uSeaDeepColor;
uniform vec3 uSeaShallowColor;
uniform vec3 uAmbientColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNightFactor;
uniform float uSunsetFactor;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vCoastData;
varying float vWaveCrest;
varying float vFogDepth;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = rot * p * 2.05 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

float rippleHeight(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2(0.42, -0.91)) * 1.15 - t * 1.55) * 0.022;
  h += sin(dot(p, vec2(-0.58, -0.81)) * 1.95 - t * 2.05) * 0.015;
  h += (valueNoise(p * 0.52 + vec2(t * 0.24, t * 0.58)) - 0.5) * 0.042;
  h += (valueNoise(p * 1.35 + vec2(-t * 0.42, t * 0.88)) - 0.5) * 0.024;
  h += (valueNoise(p * 3.10 + vec2(t * 0.65, -t * 0.72)) - 0.5) * 0.011;
  return h;
}

void main() {
  float waterDepth = vCoastData.x;
  float pierDist = vCoastData.y;
  float rockyCoast = vCoastData.z;

  if (waterDepth < -0.18) {
    discard;
  }

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunDirection);
  float distCam = length(cameraPosition - vWorldPos);

  // Normalize Three.js PBR sunIntensity (~0.66..2.55) so foam & body stay balanced under ACES + Bloom
  float sunNorm = clamp(uSunIntensity / 2.55, 0.14, 1.15);

  float detailFade = 1.0 - smoothstep(85.0, 520.0, distCam);
  float eps = mix(0.28, 0.09, detailFade);
  float hC = rippleHeight(vWorldPos.xz, uTime);
  float hX = rippleHeight(vWorldPos.xz + vec2(eps, 0.0), uTime);
  float hZ = rippleHeight(vWorldPos.xz + vec2(0.0, eps), uTime);

  vec3 ripplePerturb = vec3(-(hX - hC) / eps, 0.0, -(hZ - hC) / eps) * mix(0.22, 1.0, detailFade);
  vec3 N = normalize(vNormal + ripplePerturb);

  // Schlick Fresnel sky reflection
  float NdotV = max(dot(N, V), 0.001);
  float fresnel = 0.028 + 0.972 * pow(1.0 - NdotV, 4.6);
  fresnel = clamp(fresnel * 0.86, 0.03, 0.90);

  // Coastal shallow-to-deep Yellow Sea gradient (jade-turquoise -> Prussian deep blue)
  float depthClamped = max(0.0, waterDepth);
  float shallowFactor = exp(-depthClamped * 0.48);
  float coveClear = (1.0 - rockyCoast * 0.45) * smoothstep(5.5, 0.2, depthClamped);
  vec3 bodyColor = mix(uSeaDeepColor, uSeaShallowColor, clamp(shallowFactor * 0.88 + coveClear * 0.22, 0.0, 1.0));

  // Sunlit emerald-cyan subsurface scattering through wave crests
  vec3 sssDir = normalize(L + N * 0.42);
  float sssView = pow(clamp(dot(V, -sssDir), 0.0, 1.0), 3.5);
  float sssCrest = smoothstep(0.42, 0.95, vWaveCrest) * (0.45 + 0.55 * shallowFactor);
  vec3 sssTint = mix(uSeaShallowColor, vec3(0.18, 0.72, 0.66), 0.45);
  bodyColor += sssTint * sssView * sssCrest * sunNorm * 0.42 * (1.0 - uNightFactor * 0.85);

  // Sky reflection gradient with solar azimuth halo
  vec3 R = reflect(-V, N);
  float skyElev = clamp(R.y, 0.0, 1.0);
  vec3 skyReflect = mix(uSkyHorizonColor, uSkyTopColor, pow(skyElev, 0.58));
  float sunReflAlign = max(dot(R, L), 0.0);
  skyReflect += uSunColor * pow(sunReflAlign, 8.0) * (0.28 + 0.34 * uSunsetFactor) * max(sunNorm, 0.25);

  vec3 waterColor = mix(bodyColor, skyReflect, fresnel);

  // Sculptural wave-slope diffuse shading
  float NdotL = max(dot(N, L), 0.0);
  waterColor *= (0.78 + 0.26 * NdotL + 0.06 * clamp(uAmbientColor.g, 0.0, 1.2));

  // Dual-lobe crisp sparkling sun/moon specular glints (波光粼粼)
  // Broad sheen stays clean; pinpoint facets cross bloom threshold for gentle diamond sparkle
  vec3 H = normalize(L + V);
  float NdotH = max(dot(N, H), 0.0);
  float broadSpec = pow(NdotH, mix(56.0, 28.0, uSunsetFactor)) * mix(0.38, 0.68, uSunsetFactor);
  float crispGlint = pow(NdotH, 380.0) * (1.85 + 1.05 * detailFade);
  float sparkleNoise = valueNoise(vWorldPos.xz * 2.4 + vec2(uTime * 0.9, -uTime * 1.1));
  float sparkleBoost = mix(0.55, 1.72, smoothstep(0.46, 0.85, sparkleNoise));
  float specPower = mix(sunNorm, 0.72, uNightFactor);
  vec3 specular = uSunColor * (broadSpec + crispGlint * sparkleBoost) * specPower;
  waterColor += specular;

  // === Animated Shoreline Surf, Lacy Beach Swash & Rocky Cape Whitewater ===
  float foamTex = fbm(vWorldPos.xz * 0.42 + vec2(uTime * 0.14, uTime * 0.32));
  float foamFine = valueNoise(vWorldPos.xz * 1.45 - vec2(uTime * 0.25, uTime * 0.55));
  float lace = smoothstep(0.30, 0.72, foamTex * 0.72 + foamFine * 0.34);

  // 1. Rhythmic rolling beach surf lines washing gently onto No. 2 Bathing Beach sand
  float swashWave = sin(uTime * 1.15 + vWorldPos.x * 0.065) * 0.12;
  float adjDepth = waterDepth + swashWave;
  float edgeFoam = (1.0 - smoothstep(-0.04, 0.34, adjDepth)) * smoothstep(-0.14, 0.02, adjDepth);
  edgeFoam *= (0.55 + 0.45 * lace);

  float surfBandMask = smoothstep(0.04, 0.24, waterDepth) * (1.0 - smoothstep(1.15, 2.05, waterDepth));
  float waveCycle = fract(waterDepth * 0.62 + uTime * 0.21 + foamTex * 0.32);
  float surfCrest = smoothstep(0.70, 0.89, waveCycle) * (1.0 - smoothstep(0.91, 0.99, waveCycle));
  float beachSurf = surfCrest * surfBandMask * smoothstep(0.28, 0.68, foamTex + 0.15) * 0.82;

  // 2. Crashing whitewater foam around Huashilou granite rocks & reefs
  float rockZone = rockyCoast * (1.0 - smoothstep(0.15, 2.45, waterDepth)) * smoothstep(-0.15, 0.06, waterDepth);
  float rockPulse = 0.58 + 0.42 * sin(uTime * 1.85 - waterDepth * 2.2 + foamTex * 5.0);
  float rockFoam = rockZone * rockPulse * smoothstep(0.26, 0.64, foamTex * 0.8 + foamFine * 0.3);

  // 3. Swirling foam collar along the curved stone breakwater pier & bastion
  float pierCollar = (1.0 - smoothstep(0.0, 2.35, pierDist)) * smoothstep(-0.08, 0.20, waterDepth);
  float pierPulse = 0.52 + 0.48 * sin(uTime * 1.65 + vWorldPos.z * 0.22 + foamTex * 4.2);
  float pierFoam = pierCollar * pierPulse * smoothstep(0.28, 0.66, foamTex * 0.78 + foamFine * 0.32) * 0.86;

  // 4. Subtle distant offshore whitecap flecks on higher crests
  float offshoreCap = smoothstep(0.74, 0.96, vWaveCrest)
    * smoothstep(0.58, 0.80, foamTex)
    * smoothstep(3.0, 9.0, waterDepth) * 0.28;

  float totalFoam = clamp(edgeFoam + beachSurf + rockFoam + pierFoam + offshoreCap, 0.0, 0.94);

  // Keep foam naturally illuminated below bloom threshold across all 4 moods
  vec3 foamBase = mix(vec3(0.76, 0.82, 0.86), vec3(0.95, 0.94, 0.91), sunNorm);
  vec3 foamLit = foamBase * (uAmbientColor * 0.36 + uSunColor * sunNorm * 0.48 + vec3(0.06));
  foamLit = mix(foamLit, vec3(0.20, 0.26, 0.35), uNightFactor * 0.72);
  waterColor = mix(waterColor, foamLit, totalFoam);

  // Seamless THREE.FogExp2 coastal haze & horizon melt into sky dome
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
  float horizonMelt = smoothstep(620.0, 910.0, distCam);
  fogFactor = clamp(max(fogFactor, horizonMelt), 0.0, 1.0);
  waterColor = mix(waterColor, uFogColor, fogFactor);

  float shoreAlpha = smoothstep(-0.14, 0.20, adjDepth);
  float alpha = clamp(max(shoreAlpha, totalFoam * 0.85), 0.0, 0.98);
  alpha = mix(alpha, 1.0, smoothstep(0.35, 1.45, waterDepth));

  gl_FragColor = vec4(waterColor, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildOceanGeometry(ctx: WorldContext): THREE.BufferGeometry {
  const segX = 188;
  const segZ = 164;

  const mapX = (s: number): number => {
    const sign = s < 0 ? -1 : 1;
    const a = Math.abs(s);
    return sign * (130 * a + 810 * Math.pow(a, 3.0));
  };

  const mapZ = (t: number): number => {
    return 28 + 135 * t + 820 * Math.pow(t, 2.9);
  };

  const rawPier = ROAD_LAYOUT.PIER_POINTS;
  const pierHalfW = ROAD_LAYOUT.PIER_WIDTH * 0.5 + 0.15;
  const pierTip = rawPier[rawPier.length - 1];
  const huashilou = ROAD_LAYOUT.HUASHILOU_CENTER;

  const vertCount = (segX + 1) * (segZ + 1);
  const positions = new Float32Array(vertCount * 3);
  const coastData = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  let ptr = 0;
  for (let iz = 0; iz <= segZ; iz++) {
    const tz = iz / segZ;
    const z = mapZ(tz);
    for (let ix = 0; ix <= segX; ix++) {
      const sx = (ix / segX) * 2 - 1;
      const x = mapX(sx);

      positions[ptr * 3] = x;
      positions[ptr * 3 + 1] = 0.0;
      positions[ptr * 3 + 2] = z;

      let seabedY: number;
      if (x >= -150 && x <= 150 && z <= 140) {
        seabedY = ctx.getTerrainHeight(x, z);
      } else {
        const edgeX = Math.max(-150, Math.min(150, x));
        const edgeZ = Math.min(140, z);
        const edgeH = ctx.getTerrainHeight(edgeX, edgeZ);
        const extraDist = Math.hypot(x - edgeX, z - edgeZ);
        seabedY = Math.min(edgeH, -1.8) - Math.min(14.0, extraDist * 0.045);
      }

      const waterDepth = -seabedY;

      const dCenter = getPierDistance(x, z);
      const dTip = Math.hypot(x - pierTip[0], z - pierTip[1]) - 3.6;
      const pierDist = Math.max(0, Math.min(dCenter - pierHalfW, dTip));

      const dCape = Math.hypot(x - huashilou.x, z - huashilou.z);
      const capeMask = 1.0 - THREE.MathUtils.smoothstep(dCape, 17, 36);
      const eastShoreMask =
        THREE.MathUtils.smoothstep(x, 8, 22) * (1.0 - THREE.MathUtils.smoothstep(z, 65, 92));
      const westRocksMask =
        (1.0 - THREE.MathUtils.smoothstep(x, -82, -62)) *
        (1.0 - THREE.MathUtils.smoothstep(z, 55, 82));
      const rockyCoast = Math.min(1.0, Math.max(capeMask, eastShoreMask * 0.85, westRocksMask * 0.72));

      coastData[ptr * 3] = waterDepth;
      coastData[ptr * 3 + 1] = pierDist;
      coastData[ptr * 3 + 2] = rockyCoast;
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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aCoastData', new THREE.BufferAttribute(coastData, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function buildYellowSea(ctx: WorldContext): YellowSeaSystem {
  const geometry = buildOceanGeometry(ctx);

  const uniforms = {
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0.45, 0.42, 0.78).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d2) },
    uSunIntensity: { value: 1.5 },
    uSkyTopColor: { value: new THREE.Color(0x2867a8) },
    uSkyHorizonColor: { value: new THREE.Color(0xcde2f2) },
    uSeaDeepColor: { value: new THREE.Color(0x0b3a5c) },
    uSeaShallowColor: { value: new THREE.Color(0x1f8e8c) },
    uAmbientColor: { value: new THREE.Color(0x9ab8d4) },
    uFogColor: { value: new THREE.Color(0xd0dfea) },
    uFogDensity: { value: 0.0022 },
    uNightFactor: { value: 0.0 },
    uSunsetFactor: { value: 0.0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: OCEAN_VERTEX_SHADER,
    fragmentShader: OCEAN_FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'YellowSeaOcean';
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  const setMood = (mood: MoodConfig): void => {
    uniforms.uSunDirection.value.copy(mood.sunDirection).normalize();
    uniforms.uSunColor.value.copy(mood.sunColor);
    uniforms.uSunIntensity.value = mood.sunIntensity;
    uniforms.uSkyTopColor.value.copy(mood.skyTopColor);
    uniforms.uSkyHorizonColor.value.copy(mood.skyHorizonColor);
    uniforms.uSeaDeepColor.value.copy(mood.seaDeepColor);
    uniforms.uSeaShallowColor.value.copy(mood.seaShallowColor);
    uniforms.uAmbientColor.value.copy(mood.ambientSkyColor).multiplyScalar(mood.ambientIntensity);
    uniforms.uFogColor.value.copy(mood.fogColor);
    uniforms.uFogDensity.value = mood.fogDensity;
    // THREE.Color stores linear RGB: coastal_night horizon linear lum ≈ 0.028 vs sunset ≈ 0.466 & day ≈ 0.74
    const horizLum =
      mood.skyHorizonColor.r * 0.2126 +
      mood.skyHorizonColor.g * 0.7152 +
      mood.skyHorizonColor.b * 0.0722;
    const nightFactor = THREE.MathUtils.clamp((0.12 - horizLum) / 0.075, 0, 1);
    const sunsetFactor =
      THREE.MathUtils.clamp((mood.skyHorizonColor.r - mood.skyHorizonColor.b) * 1.45, 0, 1) *
      (1 - nightFactor);
    uniforms.uNightFactor.value = nightFactor;
    uniforms.uSunsetFactor.value = sunsetFactor;
  };

  const update = (elapsed: number): void => {
    uniforms.uTime.value = elapsed;
  };

  return { mesh, update, setMood };
}
