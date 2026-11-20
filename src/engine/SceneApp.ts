import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CoastalAudio } from '../audio/CoastalAudio';
import { HudController } from '../ui/HudController';
import {
  getLandmarkAt,
  getTerrainHeight,
  isOnBeach,
  isOnRoad,
} from '../world/terrainMath';
import type {
  Collider,
  MoodId,
  WorldContext,
  WorldModuleResult,
} from '../world/types';
import { AtmosphereSystem, getMoodConfig } from './AtmosphereSystem';
import {
  PlayerController,
  VIEWPOINTS,
  type ControlMode,
} from './PlayerController';

export interface BadaguanDebugHandle {
  setViewpoint: (indexOrId: number | string, immediate?: boolean) => void;
  setMood: (id: MoodId, immediate?: boolean) => void;
  setMode: (mode: ControlMode) => void;
  setHudVisible: (visible: boolean) => void;
  setCamera: (
    pos: [number, number, number],
    lookAt: [number, number, number]
  ) => void;
  getCameraState: () => {
    position: [number, number, number];
    rotation: [number, number, number];
    yaw: number;
    pitch: number;
    fov: number;
    mode: ControlMode;
    mood: MoodId;
    viewpointIndex: number;
    landmark: string;
  };
  getSceneStats: () => {
    ready: boolean;
    fps: number;
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
    modulesLoaded: string[];
    colliderCount: number;
    viewpoints: typeof VIEWPOINTS;
  };
}

declare global {
  interface Window {
    __BADAGUAN_APP__?: BadaguanDebugHandle;
  }
}

export class SceneApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly atmosphere: AtmosphereSystem;
  private readonly player: PlayerController;
  private readonly audio: CoastalAudio;
  private readonly hud: HudController;

  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private readonly modules: WorldModuleResult[] = [];
  private readonly loadedModuleNames: string[] = [];
  private allColliders: Collider[] = [];

  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private fps = 60;
  private ready = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 1. WebGLRenderer with ACESFilmicToneMapping and crisp PCF soft shadows
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.2,
      1400
    );

    // 3. Atmosphere (Sky Dome, Lighting Rig, Fog, 4 Badaguan Moods)
    this.atmosphere = new AtmosphereSystem(
      this.scene,
      this.renderer,
      'autumn_afternoon'
    );

    // 4. Audio
    this.audio = new CoastalAudio();

    // 5. Post-processing (subtle high-threshold Bloom + OutputPass)
    this.initPostProcessing();

    // 6. HUD Controller
    this.hud = new HudController({
      onSelectMood: (mood) => this.setMood(mood, false),
      onSelectViewpoint: (idx) => this.player.goToViewpoint(idx, false),
      onToggleMode: () => this.player.toggleMode(),
      onToggleAudio: () => {
        const enabled = this.audio.toggle();
        this.hud.setAudioEnabled(enabled);
      },
      onTogglePointerLock: () => {
        if (this.player.isPointerLocked()) {
          this.player.exitPointerLock();
        } else {
          this.player.requestPointerLock();
        }
      },
    });

    // 7. Player Controller
    this.player = new PlayerController(this.camera, this.canvas, {
      onModeChange: (mode) => this.hud.setMode(mode),
      onViewpointChange: (idx) => this.hud.setActiveViewpoint(idx),
      onPointerLockChange: (locked) => this.hud.setPointerLocked(locked),
      onLandmarkChange: (landmark) => this.hud.setLandmark(landmark),
    });

    this.hud.setActiveMood('autumn_afternoon');
    this.hud.setActiveViewpoint(0);
    this.hud.setMode(this.player.getMode());
    this.hud.setAudioEnabled(false);

    window.addEventListener('resize', this.onResize);
    this.exposeDebugHandle();
    void this.loadWorldModules();
  }

  private initPostProcessing(): void {
    try {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);

      let composer: EffectComposer;
      const canMsaaHalfFloat =
        this.renderer.capabilities.isWebGL2 &&
        this.renderer.extensions.has('EXT_color_buffer_float') &&
        this.renderer.capabilities.maxSamples >= 4;

      if (canMsaaHalfFloat) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rt = new THREE.WebGLRenderTarget(
          Math.floor(width * dpr),
          Math.floor(height * dpr),
          {
            type: THREE.HalfFloatType,
            samples: 4,
          }
        );
        composer = new EffectComposer(this.renderer, rt);
      } else {
        composer = new EffectComposer(this.renderer);
      }

      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(width, height);

      const renderPass = new RenderPass(this.scene, this.camera);
      composer.addPass(renderPass);

      // Subtle high-threshold bloom: catches sun glints, warm villa windows, streetlamps & beacon
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.24,
        0.45,
        0.93
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);

      this.composer = composer;
      this.bloomPass = bloomPass;
      this.syncBloomForMood();
    } catch {
      this.composer = null;
      this.bloomPass = null;
    }
  }

  private syncBloomForMood(): void {
    if (!this.bloomPass) return;
    const m = this.atmosphere.getCurrentMood();
    const glowFactor = THREE.MathUtils.clamp(
      Math.max(m.lampIntensity * 0.5, m.windowGlow * 0.55),
      0,
      1
    );
    this.bloomPass.threshold = THREE.MathUtils.lerp(0.94, 0.76, glowFactor);
    this.bloomPass.strength = THREE.MathUtils.lerp(0.22, 0.42, glowFactor);
    this.bloomPass.radius = THREE.MathUtils.lerp(0.42, 0.58, glowFactor);
  }

  private async loadWorldModules(): Promise<void> {
    const ctx: WorldContext = {
      scene: this.scene,
      renderer: this.renderer,
      camera: this.camera,
      getTerrainHeight,
      isOnRoad,
      isOnBeach,
      getMoodConfig,
    };

    const currentMood = this.atmosphere.getCurrentMood();

    // 1. Landscape, Terrain, Seawall, Pier & Yellow Sea Ocean Shader
    this.hud.setLoadingProgress(25, '正在鋪設山海地形、花崗岩海堤與黃海波濤…');
    try {
      const mod = await import('../world/landscape/index');
      const res = mod.buildLandscapeAndSea(ctx);
      this.registerWorldModule('landscape-sea', res, currentMood);
    } catch (err) {
      console.error('[SceneApp] Failed loading landscape-sea module:', err);
    }

    // 2. Historic Badaguan Villas (Huashilou, Princess House, Butterfly House, District Villas)
    this.hud.setLoadingProgress(55, '正在構築花石樓、公主樓、蝴蝶樓與紅瓦洋樓群…');
    try {
      const mod = await import('../world/villas/index');
      const res = mod.buildBadaguanArchitecture(ctx);
      this.registerWorldModule('architecture', res, currentMood);
    } catch (err) {
      console.error('[SceneApp] Failed loading architecture module:', err);
    }

    // 3. One-Pass-One-Tree Foliage, Street Props & Living Coastal Atmosphere
    this.hud.setLoadingProgress(82, '正在栽植銀杏、五角楓、海濱黑松與街景燈火…');
    try {
      const mod = await import('../world/foliage/index');
      const res = mod.buildFoliageAndProps(ctx);
      this.registerWorldModule('foliage-props', res, currentMood);
    } catch (err) {
      console.error('[SceneApp] Failed loading foliage-props module:', err);
    }

    // Apply aggregated colliders and snap cleanly to initial Ginkgo Avenue viewpoint
    this.player.setColliders(this.allColliders);
    this.player.goToViewpoint(0, true);

    // Start render loop and fade out splash screen after first rendered frame
    this.lastTime = performance.now();
    this.renderFrame(0.016);
    this.ready = true;
    this.hud.hideLoading();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private registerWorldModule(
    name: string,
    result: WorldModuleResult,
    mood: ReturnType<AtmosphereSystem['getCurrentMood']>
  ): void {
    this.scene.add(result.group);
    if (result.colliders?.length) {
      this.allColliders = this.allColliders.concat(result.colliders);
    }
    result.setMood?.(mood);
    this.modules.push(result);
    this.loadedModuleNames.push(name);
  }

  public setMood(id: MoodId, immediate = false): void {
    this.atmosphere.setMood(id, immediate);
    this.audio.setMood(id);
    this.hud.setActiveMood(id);
    if (immediate) {
      const cur = this.atmosphere.getCurrentMood();
      for (const m of this.modules) {
        m.setMood?.(cur);
      }
      this.syncBloomForMood();
    }
  }

  private readonly loop = (now: number): void => {
    if (this.disposed) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (rawDt > 0.0005) {
      const instFps = 1 / rawDt;
      this.fps = this.fps * 0.9 + Math.min(instFps, 240) * 0.1;
    }

    this.renderFrame(dt);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderFrame(dt: number): void {
    this.elapsed += dt;

    // 1. Player controls & camera movement
    this.player.update(dt);

    // 2. Atmosphere sky & smooth mood transition
    const moodUpdated = this.atmosphere.update(dt, this.elapsed, this.camera);
    if (moodUpdated) {
      const curMood = this.atmosphere.getCurrentMood();
      for (let i = 0; i < this.modules.length; i++) {
        this.modules[i].setMood?.(curMood);
      }
      this.syncBloomForMood();
    }

    // 3. World module animations (ocean swells, swaying trees, falling leaves, gulls, lights)
    for (let i = 0; i < this.modules.length; i++) {
      this.modules[i].update?.(dt, this.elapsed, this.camera);
    }

    // 4. Procedural coastal audio spatial modulation
    this.audio.update(dt, this.camera.position.z, this.camera.position.y);

    // 5. Render frame
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private readonly onResize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private exposeDebugHandle(): void {
    window.__BADAGUAN_APP__ = {
      setViewpoint: (indexOrId, immediate = true) => {
        this.player.goToViewpoint(indexOrId, immediate);
        this.renderFrame(0.016);
      },
      setMood: (id, immediate = true) => {
        this.setMood(id, immediate);
        this.renderFrame(0.016);
      },
      setMode: (mode) => {
        this.player.setMode(mode);
      },
      setHudVisible: (visible) => {
        this.hud.setHudVisible(visible);
      },
      setCamera: (pos, lookAt) => {
        this.player.setCameraPose(pos, lookAt);
        this.renderFrame(0.016);
      },
      getCameraState: () => {
        const p = this.camera.position;
        const r = this.camera.rotation;
        return {
          position: [
            Number(p.x.toFixed(3)),
            Number(p.y.toFixed(3)),
            Number(p.z.toFixed(3)),
          ],
          rotation: [
            Number(r.x.toFixed(4)),
            Number(r.y.toFixed(4)),
            Number(r.z.toFixed(4)),
          ],
          yaw: Number(this.player.getYaw().toFixed(4)),
          pitch: Number(this.player.getPitch().toFixed(4)),
          fov: Number(this.camera.fov.toFixed(2)),
          mode: this.player.getMode(),
          mood: this.atmosphere.getTargetMoodId(),
          viewpointIndex: this.player.getActiveViewpointIndex(),
          landmark: getLandmarkAt(p.x, p.z).name,
        };
      },
      getSceneStats: () => ({
        ready: this.ready,
        fps: Math.round(this.fps),
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        modulesLoaded: [...this.loadedModuleNames],
        colliderCount: this.allColliders.length,
        viewpoints: VIEWPOINTS,
      }),
    };
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.player.dispose();
    this.hud.dispose();
    this.audio.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
