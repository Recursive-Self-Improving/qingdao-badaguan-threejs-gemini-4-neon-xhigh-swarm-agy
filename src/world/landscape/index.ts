import * as THREE from 'three';
import type { Collider, MoodConfig, WorldContext, WorldModuleResult } from '../types';
import { createLandscapeTextures } from './landscapeTextures';
import { buildTerrainAndRoads } from './TerrainBuilder';
import { buildCoastalStructures } from './CoastalStructures';
import { buildYellowSea } from './OceanShader';

export function buildLandscapeAndSea(ctx: WorldContext): WorldModuleResult {
  const group = new THREE.Group();
  group.name = 'BadaguanLandscapeAndSea';
  const colliders: Collider[] = [];

  const textures = createLandscapeTextures(ctx.renderer);

  // 1. High-resolution Badaguan terrain, roads, raised granite sidewalks & coastal boulders
  const terrain = buildTerrainAndRoads(ctx, textures);
  group.add(terrain.group);
  colliders.push(...terrain.colliders);

  // 2. Seawall promenade, beach granite staircase, curved breakwater pier + beacon, cabanas & bay horizon
  const coastal = buildCoastalStructures(ctx, textures);
  group.add(coastal.group);
  colliders.push(...coastal.colliders);

  // 3. Custom GLSL Yellow Sea ocean shader with Gerstner swells, Fresnel sky, jade cove & animated surf
  const yellowSea = buildYellowSea(ctx);
  group.add(yellowSea.mesh);

  const setMood = (mood: MoodConfig): void => {
    yellowSea.setMood(mood);
    coastal.setMood(mood);
  };

  const update = (_dt: number, elapsed: number, _camera: THREE.Camera): void => {
    yellowSea.update(elapsed);
    coastal.update(elapsed);
  };

  // Initialize cleanly to the default Qingdao autumn afternoon mood
  setMood(ctx.getMoodConfig('autumn_afternoon'));

  return { group, colliders, update, setMood };
}
