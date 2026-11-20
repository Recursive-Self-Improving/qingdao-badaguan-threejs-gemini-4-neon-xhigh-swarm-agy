import * as THREE from 'three';
import { Collider, MoodConfig, WorldContext, WorldModuleResult } from '../types';
import { createFoliageTextureSet } from './foliageTextures';
import { buildTreesAndGroundCover } from './TreeFactory';
import { buildStreetProps } from './StreetProps';
import { buildLivingAtmosphere } from './LivingAtmosphere';

export function buildFoliageAndProps(ctx: WorldContext): WorldModuleResult {
  const group = new THREE.Group();
  group.name = 'BadaguanFoliageAndProps';

  const textures = createFoliageTextureSet();

  const trees = buildTreesAndGroundCover(ctx, textures);
  const props = buildStreetProps(ctx, textures);
  const atmosphere = buildLivingAtmosphere(ctx, textures);

  group.add(trees.group, props.group, atmosphere.group);

  const colliders: Collider[] = [...trees.colliders, ...props.colliders];

  const setMood = (mood: MoodConfig) => {
    trees.setMood(mood);
    props.setMood(mood);
    atmosphere.setMood(mood);
  };

  // Apply default autumn afternoon mood immediately so initial frame is calibrated
  setMood(ctx.getMoodConfig('autumn_afternoon'));

  return {
    group,
    colliders,
    update: (dt, elapsed, camera) => {
      trees.update(dt, elapsed);
      props.update(dt, elapsed);
      atmosphere.update(dt, elapsed, camera);
    },
    setMood,
  };
}
