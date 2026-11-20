import * as THREE from 'three';
import type { Collider, MoodConfig, WorldContext, WorldModuleResult } from '../types';
import { buildButterflyHouse } from './ButterflyHouseBuilder';
import { buildDistrictVillas } from './DistrictVillasBuilder';
import { buildHuashilou } from './HuashilouBuilder';
import { buildPrincessHouse } from './PrincessHouseBuilder';
import { createVillaMaterials } from './villaTextures';

/**
 * Builds the complete Qingdao Badaguan architectural heritage ensemble:
 * - 花石樓 (Huashilou) coastal granite castle & 5-story watchtower on the southern cape
 * - 公主樓 (Princess House) Danish powder-blue & steep red-tiled fairy-tale villa
 * - 蝴蝶樓 (Butterfly House) warm ochre cinema villa with curved sunroom & green shutters
 * - 4 distinct neighboring historic Badaguan block villas (NW, NE, SW, SE)
 * - 22 stylized red-roofed hillside backdrop villas ("紅瓦綠樹" skyline)
 */
export function buildBadaguanArchitecture(ctx: WorldContext): WorldModuleResult {
  const group = new THREE.Group();
  group.name = 'BadaguanArchitecture';

  const mats = createVillaMaterials();
  const colliders: Collider[] = [];

  const modules = [
    buildHuashilou(ctx, mats),
    buildPrincessHouse(ctx, mats),
    buildButterflyHouse(ctx, mats),
    buildDistrictVillas(ctx, mats),
  ];

  for (const mod of modules) {
    group.add(mod.group);
    for (const c of mod.colliders) {
      colliders.push(c);
    }
  }

  let currentLampDrive = 0;

  const setMood = (mood: MoodConfig): void => {
    mats.applyMood(mood);
    currentLampDrive = Math.max(mood.lampIntensity, mood.windowGlow * 0.85);
  };

  // Apply default afternoon mood immediately so materials match initial lighting
  setMood(ctx.getMoodConfig('autumn_afternoon'));

  const update = (_dt: number, elapsed: number): void => {
    if (currentLampDrive <= 0.05) return;
    // Gentle organic warm tungsten shimmer on porch & gate lanterns at dusk/night
    for (let i = 0; i < mats.lanternLights.length; i++) {
      const entry = mats.lanternLights[i];
      const shimmer = 0.96 + 0.04 * Math.sin(elapsed * 2.1 + i * 1.7);
      entry.light.intensity = entry.baseIntensity * currentLampDrive * shimmer;
    }
  };

  return {
    group,
    colliders,
    update,
    setMood,
  };
}
