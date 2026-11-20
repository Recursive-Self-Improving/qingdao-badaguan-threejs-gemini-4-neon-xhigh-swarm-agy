import * as THREE from 'three';
import type { MoodConfig, MoodId } from '../world/types';

function createMoodConfig(
  id: MoodId,
  label: string,
  subtitle: string,
  sunDir: [number, number, number],
  params: {
    sunColor: number;
    sunIntensity: number;
    skyTopColor: number;
    skyHorizonColor: number;
    fogColor: number;
    fogDensity: number;
    ambientSkyColor: number;
    ambientGroundColor: number;
    ambientIntensity: number;
    exposure: number;
    lampIntensity: number;
    windowGlow: number;
    mistOpacity: number;
    seaDeepColor: number;
    seaShallowColor: number;
  }
): MoodConfig {
  return {
    id,
    label,
    subtitle,
    sunDirection: new THREE.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize(),
    sunColor: new THREE.Color(params.sunColor),
    sunIntensity: params.sunIntensity,
    skyTopColor: new THREE.Color(params.skyTopColor),
    skyHorizonColor: new THREE.Color(params.skyHorizonColor),
    fogColor: new THREE.Color(params.fogColor),
    fogDensity: params.fogDensity,
    ambientSkyColor: new THREE.Color(params.ambientSkyColor),
    ambientGroundColor: new THREE.Color(params.ambientGroundColor),
    ambientIntensity: params.ambientIntensity,
    exposure: params.exposure,
    lampIntensity: params.lampIntensity,
    windowGlow: params.windowGlow,
    mistOpacity: params.mistOpacity,
    seaDeepColor: new THREE.Color(params.seaDeepColor),
    seaShallowColor: new THREE.Color(params.seaShallowColor),
  };
}

export const MOOD_CONFIGS: Record<MoodId, MoodConfig> = {
  autumn_afternoon: createMoodConfig(
    'autumn_afternoon',
    '深秋午後',
    '十月末暖陽傾灑，銀杏金黃、紅瓦碧海相映',
    [-0.56, 0.5, 0.66],
    {
      sunColor: 0xfff0d4,
      sunIntensity: 2.55,
      skyTopColor: 0x2a68a8,
      skyHorizonColor: 0xcfe3f0,
      fogColor: 0xc8dce8,
      fogDensity: 0.00175,
      ambientSkyColor: 0x90c2eb,
      ambientGroundColor: 0x7b6349,
      ambientIntensity: 0.88,
      exposure: 1.06,
      lampIntensity: 0.0,
      windowGlow: 0.08,
      mistOpacity: 0.1,
      seaDeepColor: 0x10466c,
      seaShallowColor: 0x2b9698,
    }
  ),
  morning_mist: createMoodConfig(
    'morning_mist',
    '海濱晨霧',
    '青島標誌性平流霧輕籠岬角，銀白海天一色',
    [0.64, 0.34, 0.69],
    {
      sunColor: 0xffe8ce,
      sunIntensity: 1.44,
      skyTopColor: 0x8ea6b8,
      skyHorizonColor: 0xdce4e8,
      fogColor: 0xd5dfe4,
      fogDensity: 0.0052,
      ambientSkyColor: 0xc4d4e0,
      ambientGroundColor: 0x70746e,
      ambientIntensity: 1.08,
      exposure: 1.02,
      lampIntensity: 0.48,
      windowGlow: 0.38,
      mistOpacity: 0.6,
      seaDeepColor: 0x3b6073,
      seaShallowColor: 0x6a999f,
    }
  ),
  golden_sunset: createMoodConfig(
    'golden_sunset',
    '落日餘暉',
    '匯泉灣晚霞熔金，路燈初上與花石樓剪影交輝',
    [-0.82, 0.17, 0.55],
    {
      sunColor: 0xff8e47,
      sunIntensity: 2.45,
      skyTopColor: 0x27335c,
      skyHorizonColor: 0xf49762,
      fogColor: 0xcf8767,
      fogDensity: 0.0028,
      ambientSkyColor: 0xa66f7f,
      ambientGroundColor: 0x52372c,
      ambientIntensity: 0.72,
      exposure: 1.08,
      lampIntensity: 1.3,
      windowGlow: 0.98,
      mistOpacity: 0.25,
      seaDeepColor: 0x1b2d4f,
      seaShallowColor: 0x5e6f7d,
    }
  ),
  coastal_night: createMoodConfig(
    'coastal_night',
    '靜謐夜色',
    '普魯士深藍夜空與黃海月色，洋樓暖窗與路燈溫柔亮起',
    [0.42, 0.58, 0.7],
    {
      sunColor: 0x93b9ec,
      sunIntensity: 0.66,
      skyTopColor: 0x071124,
      skyHorizonColor: 0x1a2f4d,
      fogColor: 0x13243c,
      fogDensity: 0.0031,
      ambientSkyColor: 0x2b4973,
      ambientGroundColor: 0x1e1b1d,
      ambientIntensity: 0.58,
      exposure: 1.14,
      lampIntensity: 1.9,
      windowGlow: 1.48,
      mistOpacity: 0.2,
      seaDeepColor: 0x07182d,
      seaShallowColor: 0x153c56,
    }
  ),
};

export const MOOD_ORDER: MoodId[] = [
  'autumn_afternoon',
  'morning_mist',
  'golden_sunset',
  'coastal_night',
];

export function cloneMoodConfig(src: MoodConfig): MoodConfig {
  return {
    id: src.id,
    label: src.label,
    subtitle: src.subtitle,
    sunDirection: src.sunDirection.clone(),
    sunColor: src.sunColor.clone(),
    sunIntensity: src.sunIntensity,
    skyTopColor: src.skyTopColor.clone(),
    skyHorizonColor: src.skyHorizonColor.clone(),
    fogColor: src.fogColor.clone(),
    fogDensity: src.fogDensity,
    ambientSkyColor: src.ambientSkyColor.clone(),
    ambientGroundColor: src.ambientGroundColor.clone(),
    ambientIntensity: src.ambientIntensity,
    exposure: src.exposure,
    lampIntensity: src.lampIntensity,
    windowGlow: src.windowGlow,
    mistOpacity: src.mistOpacity,
    seaDeepColor: src.seaDeepColor.clone(),
    seaShallowColor: src.seaShallowColor.clone(),
  };
}

export function getMoodConfig(id: MoodId): MoodConfig {
  return cloneMoodConfig(MOOD_CONFIGS[id] ?? MOOD_CONFIGS.autumn_afternoon);
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uSkyTopColor;
uniform vec3 uSkyHorizonColor;
uniform vec3 uFogColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloudOpacity;
uniform float uNightFactor;
uniform float uSunsetFactor;

varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += amp * noise2D(p);
    p = rot * p * 2.03 + vec2(11.3, 7.1);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  vec3 sunDir = normalize(uSunDirection);
  float y = dir.y;
  float up = clamp(y, 0.0, 1.0);

  // Rayleigh-inspired vertical gradient
  float zenithCurve = pow(up, 0.56);
  vec3 sky = mix(uSkyHorizonColor, uSkyTopColor, zenithCurve);

  // Warm sunset horizon band along sun azimuth
  float sunAlign = max(dot(dir, sunDir), 0.0);
  float horizonBand = exp(-abs(y) * 6.5);
  vec3 sunsetTint = mix(uSunColor, vec3(1.0, 0.48, 0.32), 0.45);
  sky += sunsetTint * horizonBand * pow(sunAlign, 2.2) * (0.35 + 0.65 * uSunsetFactor) * (1.0 - uNightFactor * 0.85);

  // Mie scattering halo + crisp solar/lunar disc
  float haloWide = pow(sunAlign, 8.0) * (0.28 + 0.22 * uSunsetFactor);
  float haloTight = pow(sunAlign, 96.0) * 0.72;
  float discEdge = mix(0.99905, 0.99935, uNightFactor);
  float disc = smoothstep(discEdge - 0.00055, discEdge + 0.0002, sunAlign);
  vec3 discColor = mix(uSunColor * 2.2, vec3(0.92, 0.96, 1.0) * 1.45, uNightFactor);
  sky += uSunColor * (haloWide + haloTight) * mix(1.0, 0.42, uNightFactor);
  sky += discColor * disc * smoothstep(-0.02, 0.04, y);

  // Drifting procedural coastal clouds on upper hemisphere
  if (y > 0.015) {
    vec2 cloudUV = dir.xz / (y + 0.22);
    vec2 drift = vec2(uTime * 0.0065, uTime * 0.0032);
    float c1 = fbm(cloudUV * 0.55 + drift);
    float c2 = fbm(cloudUV * 1.25 - drift * 0.7 + vec2(3.7, 1.9));
    float cloudMask = smoothstep(0.46, 0.78, c1 * 0.7 + c2 * 0.35);
    float horizonFade = smoothstep(0.02, 0.24, y) * (1.0 - smoothstep(0.86, 1.0, y) * 0.3);
    float cloudAlpha = cloudMask * horizonFade * uCloudOpacity;

    // Cloud shading from sun direction
    float cloudSun = pow(sunAlign, 3.0);
    vec3 cloudLit = mix(vec3(0.98, 0.97, 0.95), uSunColor * 1.22, 0.45 + 0.45 * uSunsetFactor);
    vec3 cloudShadow = mix(uSkyHorizonColor * 0.86, uSkyTopColor * 0.72, 0.45);
    vec3 cloudCol = mix(cloudShadow, cloudLit, clamp(0.42 + cloudSun * 0.65 + (1.0 - c2) * 0.25, 0.0, 1.0));
    cloudCol = mix(cloudCol, vec3(0.18, 0.25, 0.36), uNightFactor * 0.85);
    sky = mix(sky, cloudCol, cloudAlpha);
  }

  // Crisp circular pinpoint starfield strictly in coastal_night
  if (uNightFactor > 0.02 && y > 0.06) {
    vec2 starUV = (dir.xz / (y + 0.36)) * 105.0;
    vec2 starCell = floor(starUV);
    vec2 starLocal = fract(starUV);
    float rnd = hash21(starCell);
    if (rnd > 0.982) {
      vec2 starCenter = vec2(
        0.22 + 0.56 * hash21(starCell + vec2(17.3, 31.7)),
        0.22 + 0.56 * hash21(starCell + vec2(43.9, 11.1))
      );
      float dist = length(starLocal - starCenter);
      float radius = mix(0.055, 0.11, smoothstep(0.982, 0.999, rnd));
      float core = smoothstep(radius, 0.0, dist);
      float twinkle = 0.72 + 0.28 * sin(uTime * (1.8 + fract(rnd * 73.1) * 3.6) + rnd * 62.0);
      float elevFade = smoothstep(0.07, 0.30, y);
      vec3 starTint = mix(vec3(0.82, 0.90, 1.0), vec3(1.0, 0.94, 0.84), hash21(starCell + vec2(91.1, 5.4)));
      sky += starTint * core * core * twinkle * elevFade * uNightFactor * 1.35;
    }
  }

  // Seamless coastal horizon haze matching FogExp2
  float fogBlend = smoothstep(0.24, -0.02, y);
  sky = mix(sky, uFogColor, fogBlend * 0.94);

  // Below horizon fill (hidden behind ocean, matches deep fog/sea horizon)
  if (y < 0.0) {
    sky = mix(uFogColor, uFogColor * 0.78, smoothstep(0.0, -0.35, y));
  }

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class AtmosphereSystem {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;

  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly fillLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly fog: THREE.FogExp2;

  private readonly skyMesh: THREE.Mesh;
  private readonly skyMaterial: THREE.ShaderMaterial;

  private currentMood: MoodConfig;
  private targetMood: MoodConfig;
  private nightFactor = 0;
  private targetNightFactor = 0;
  private sunsetFactor = 0;
  private targetSunsetFactor = 0;
  private transitioning = false;
  private transitionProgress = 1;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    initialMood: MoodId = 'autumn_afternoon'
  ) {
    this.scene = scene;
    this.renderer = renderer;

    this.currentMood = getMoodConfig(initialMood);
    this.targetMood = getMoodConfig(initialMood);
    this.nightFactor = initialMood === 'coastal_night' ? 1 : 0;
    this.targetNightFactor = this.nightFactor;
    this.sunsetFactor = initialMood === 'golden_sunset' ? 1 : 0;
    this.targetSunsetFactor = this.sunsetFactor;

    // Fog
    this.fog = new THREE.FogExp2(
      this.currentMood.fogColor.getHex(),
      this.currentMood.fogDensity
    );
    this.scene.fog = this.fog;

    // Physical Sky Dome
    const skyGeo = new THREE.SphereGeometry(920, 48, 32);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSkyTopColor: { value: this.currentMood.skyTopColor.clone() },
        uSkyHorizonColor: { value: this.currentMood.skyHorizonColor.clone() },
        uFogColor: { value: this.currentMood.fogColor.clone() },
        uSunDirection: { value: this.currentMood.sunDirection.clone() },
        uSunColor: { value: this.currentMood.sunColor.clone() },
        uTime: { value: 0 },
        uCloudOpacity: { value: 0.42 },
        uNightFactor: { value: 0 },
        uSunsetFactor: { value: 0 },
      },
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.name = 'BadaguanSkyDome';
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -100;
    this.scene.add(this.skyMesh);

    // Primary Sun / Moon Directional Light with crisp 2048px shadows covering Badaguan
    this.sunLight = new THREE.DirectionalLight(
      this.currentMood.sunColor,
      this.currentMood.sunIntensity
    );
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 15;
    this.sunLight.shadow.camera.far = 310;
    const frustum = 108;
    this.sunLight.shadow.camera.left = -frustum;
    this.sunLight.shadow.camera.right = frustum;
    this.sunLight.shadow.camera.top = frustum;
    this.sunLight.shadow.camera.bottom = -frustum;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.04;
    this.sunLight.target.position.set(0, 7, 8);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Hemisphere ambient sky/ground bounce
    this.hemiLight = new THREE.HemisphereLight(
      this.currentMood.ambientSkyColor,
      this.currentMood.ambientGroundColor,
      this.currentMood.ambientIntensity
    );
    this.scene.add(this.hemiLight);

    // Soft cool/warm bounce fill light from opposite azimuth (no shadow)
    this.fillLight = new THREE.DirectionalLight(0x9bc4e8, 0.32);
    this.fillLight.position.set(60, 42, -55);
    this.scene.add(this.fillLight);

    // Subtle sunset / coastal rim light for roofs & foliage separation
    this.rimLight = new THREE.DirectionalLight(0xffb580, 0.25);
    this.rimLight.position.set(-70, 28, 70);
    this.scene.add(this.rimLight);

    this.applyCurrentMood();
  }

  public getCurrentMood(): MoodConfig {
    return this.currentMood;
  }

  public getTargetMoodId(): MoodId {
    return this.targetMood.id;
  }

  public setMood(id: MoodId, immediate = false): void {
    this.targetMood = getMoodConfig(id);
    this.targetNightFactor = id === 'coastal_night' ? 1 : 0;
    this.targetSunsetFactor = id === 'golden_sunset' ? 1 : 0;
    if (immediate) {
      this.currentMood = cloneMoodConfig(this.targetMood);
      this.nightFactor = this.targetNightFactor;
      this.sunsetFactor = this.targetSunsetFactor;
      this.transitioning = false;
      this.transitionProgress = 1;
      this.applyCurrentMood();
    } else {
      this.transitioning = true;
      this.transitionProgress = 0;
    }
  }

  /**
   * Advances sky shader clouds and smooth mood transition.
   * Returns true if mood values changed this frame (so world modules can update).
   */
  public update(dt: number, elapsed: number, camera: THREE.Camera): boolean {
    this.skyMesh.position.copy(camera.position);
    this.skyMaterial.uniforms.uTime.value = elapsed;

    if (!this.transitioning) {
      return false;
    }

    const alpha = 1 - Math.exp(-Math.min(dt, 0.1) * 3.6);
    this.transitionProgress = Math.min(1, this.transitionProgress + dt * 0.9);

    const cur = this.currentMood;
    const tgt = this.targetMood;

    cur.id = tgt.id;
    cur.label = tgt.label;
    cur.subtitle = tgt.subtitle;

    cur.sunDirection.lerp(tgt.sunDirection, alpha).normalize();
    cur.sunColor.lerp(tgt.sunColor, alpha);
    cur.sunIntensity += (tgt.sunIntensity - cur.sunIntensity) * alpha;
    cur.skyTopColor.lerp(tgt.skyTopColor, alpha);
    cur.skyHorizonColor.lerp(tgt.skyHorizonColor, alpha);
    cur.fogColor.lerp(tgt.fogColor, alpha);
    cur.fogDensity += (tgt.fogDensity - cur.fogDensity) * alpha;
    cur.ambientSkyColor.lerp(tgt.ambientSkyColor, alpha);
    cur.ambientGroundColor.lerp(tgt.ambientGroundColor, alpha);
    cur.ambientIntensity +=
      (tgt.ambientIntensity - cur.ambientIntensity) * alpha;
    cur.exposure += (tgt.exposure - cur.exposure) * alpha;
    cur.lampIntensity += (tgt.lampIntensity - cur.lampIntensity) * alpha;
    cur.windowGlow += (tgt.windowGlow - cur.windowGlow) * alpha;
    cur.mistOpacity += (tgt.mistOpacity - cur.mistOpacity) * alpha;
    cur.seaDeepColor.lerp(tgt.seaDeepColor, alpha);
    cur.seaShallowColor.lerp(tgt.seaShallowColor, alpha);
    this.nightFactor += (this.targetNightFactor - this.nightFactor) * alpha;
    this.sunsetFactor += (this.targetSunsetFactor - this.sunsetFactor) * alpha;

    if (this.transitionProgress >= 0.995) {
      this.currentMood = cloneMoodConfig(tgt);
      this.nightFactor = this.targetNightFactor;
      this.sunsetFactor = this.targetSunsetFactor;
      this.transitioning = false;
    }

    this.applyCurrentMood();
    return true;
  }

  private applyCurrentMood(): void {
    const m = this.currentMood;

    // Position primary directional light around Badaguan center
    this.sunLight.position
      .copy(m.sunDirection)
      .multiplyScalar(145)
      .add(this.sunLight.target.position);
    this.sunLight.color.copy(m.sunColor);
    this.sunLight.intensity = m.sunIntensity;

    // Hemisphere
    this.hemiLight.color.copy(m.ambientSkyColor);
    this.hemiLight.groundColor.copy(m.ambientGroundColor);
    this.hemiLight.intensity = m.ambientIntensity;

    // Fill & Rim lights derived smoothly from mood
    const isNight = this.nightFactor;
    const isSunset = this.sunsetFactor;
    const isMist = m.id === 'morning_mist' ? 1 : 0;

    this.fillLight.color.copy(m.ambientSkyColor);
    this.fillLight.intensity =
      isNight > 0.5 ? 0.22 : isMist > 0.5 ? 0.42 : 0.34;
    this.fillLight.position.set(
      -m.sunDirection.x * 80,
      46,
      -m.sunDirection.z * 80
    );

    this.rimLight.color.copy(m.sunColor);
    this.rimLight.intensity =
      isSunset > 0.5 ? 0.56 : isNight > 0.5 ? 0.18 : 0.22;
    this.rimLight.position.set(
      m.sunDirection.x * 85,
      24,
      m.sunDirection.z * 85
    );

    // Fog & tone mapping exposure
    this.fog.color.copy(m.fogColor);
    this.fog.density = m.fogDensity;
    this.renderer.toneMappingExposure = m.exposure;

    // Sky shader uniforms
    const u = this.skyMaterial.uniforms;
    u.uSkyTopColor.value.copy(m.skyTopColor);
    u.uSkyHorizonColor.value.copy(m.skyHorizonColor);
    u.uFogColor.value.copy(m.fogColor);
    u.uSunDirection.value.copy(m.sunDirection);
    u.uSunColor.value.copy(m.sunColor);

    const cloudOpacity = THREE.MathUtils.lerp(
      0.44,
      0.62,
      THREE.MathUtils.clamp(m.mistOpacity, 0, 1)
    );

    u.uNightFactor.value = this.nightFactor;
    u.uSunsetFactor.value = this.sunsetFactor;
    u.uCloudOpacity.value = cloudOpacity * (1 - this.nightFactor * 0.45);
  }
}
