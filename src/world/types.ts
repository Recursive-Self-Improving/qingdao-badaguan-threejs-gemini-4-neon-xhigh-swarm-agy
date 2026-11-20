import * as THREE from 'three';

export type MoodId =
  | 'autumn_afternoon'
  | 'morning_mist'
  | 'golden_sunset'
  | 'coastal_night';

export interface MoodConfig {
  id: MoodId;
  label: string;
  subtitle: string;
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  skyTopColor: THREE.Color;
  skyHorizonColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  ambientSkyColor: THREE.Color;
  ambientGroundColor: THREE.Color;
  ambientIntensity: number;
  exposure: number;
  lampIntensity: number;
  windowGlow: number;
  mistOpacity: number;
  seaDeepColor: THREE.Color;
  seaShallowColor: THREE.Color;
}

export interface BoxCollider {
  type: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY?: number;
}

export interface CylinderCollider {
  type: 'cylinder';
  x: number;
  z: number;
  radius: number;
  maxY?: number;
}

export type Collider = BoxCollider | CylinderCollider;

export interface Viewpoint {
  id: string;
  key: string;
  name: string;
  subtitle: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface WorldContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  getTerrainHeight: (x: number, z: number) => number;
  isOnRoad: (x: number, z: number) => boolean;
  isOnBeach: (x: number, z: number) => boolean;
  getMoodConfig: (mood: MoodId) => MoodConfig;
}

export interface WorldModuleResult {
  group: THREE.Group;
  colliders: Collider[];
  update?: (dt: number, elapsed: number, camera: THREE.Camera) => void;
  setMood?: (mood: MoodConfig) => void;
}
