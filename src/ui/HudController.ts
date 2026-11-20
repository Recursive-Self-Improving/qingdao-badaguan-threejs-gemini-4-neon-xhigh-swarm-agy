import { MOOD_CONFIGS, MOOD_ORDER } from '../engine/AtmosphereSystem';
import { VIEWPOINTS, type ControlMode } from '../engine/PlayerController';
import type { LandmarkInfo } from '../world/terrainMath';
import type { MoodId } from '../world/types';

export interface HudCallbacks {
  onSelectMood: (mood: MoodId) => void;
  onSelectViewpoint: (index: number) => void;
  onToggleMode: () => void;
  onToggleAudio: () => void;
  onTogglePointerLock: () => void;
}

export class HudController {
  private readonly callbacks: HudCallbacks;

  private readonly loadingScreen: HTMLElement | null;
  private readonly loadingBarFill: HTMLElement | null;
  private readonly loadingStatus: HTMLElement | null;
  private readonly hudRoot: HTMLElement | null;
  private readonly restoreBtn: HTMLElement | null;
  private readonly locationName: HTMLElement | null;
  private readonly locationSubtitle: HTMLElement | null;
  private readonly moodBar: HTMLElement | null;
  private readonly viewpointBar: HTMLElement | null;
  private readonly btnMode: HTMLButtonElement | null;
  private readonly btnModeLabel: HTMLElement | null;
  private readonly btnAudio: HTMLButtonElement | null;
  private readonly btnAudioLabel: HTMLElement | null;
  private readonly btnLock: HTMLButtonElement | null;
  private readonly btnHideHud: HTMLButtonElement | null;
  private readonly reticle: HTMLElement | null;

  private readonly moodButtons = new Map<MoodId, HTMLButtonElement>();
  private readonly vpButtons: HTMLButtonElement[] = [];
  private hudVisible = true;

  constructor(callbacks: HudCallbacks) {
    this.callbacks = callbacks;

    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBarFill = document.getElementById('loading-bar-fill');
    this.loadingStatus = document.getElementById('loading-status');
    this.hudRoot = document.getElementById('hud-root');
    this.restoreBtn = document.getElementById('hud-restore-btn');
    this.locationName = document.getElementById('hud-location-name');
    this.locationSubtitle = document.getElementById('hud-location-subtitle');
    this.moodBar = document.getElementById('mood-bar');
    this.viewpointBar = document.getElementById('viewpoint-bar');
    this.btnMode = document.getElementById('btn-mode') as HTMLButtonElement | null;
    this.btnModeLabel = document.getElementById('btn-mode-label');
    this.btnAudio = document.getElementById('btn-audio') as HTMLButtonElement | null;
    this.btnAudioLabel = document.getElementById('btn-audio-label');
    this.btnLock = document.getElementById('btn-lock') as HTMLButtonElement | null;
    this.btnHideHud = document.getElementById(
      'btn-hide-hud'
    ) as HTMLButtonElement | null;
    this.reticle = document.getElementById('fps-reticle');

    this.buildMoodButtons();
    this.buildViewpointButtons();
    this.bindEvents();
  }

  private buildMoodButtons(): void {
    if (!this.moodBar) return;
    this.moodBar.innerHTML = '';

    for (const id of MOOD_ORDER) {
      const cfg = MOOD_CONFIGS[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-btn';
      btn.textContent = cfg.label;
      btn.title = cfg.subtitle;
      btn.dataset.mood = id;
      btn.addEventListener('click', () => this.callbacks.onSelectMood(id));
      this.moodBar.appendChild(btn);
      this.moodButtons.set(id, btn);
    }
  }

  private buildViewpointButtons(): void {
    if (!this.viewpointBar) return;
    this.viewpointBar.innerHTML = '';
    this.vpButtons.length = 0;

    VIEWPOINTS.forEach((vp, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vp-btn';
      btn.title = vp.subtitle;
      btn.innerHTML = `<span class="vp-key">${vp.key}</span><span>${vp.name}</span>`;
      btn.addEventListener('click', () => this.callbacks.onSelectViewpoint(idx));
      this.viewpointBar!.appendChild(btn);
      this.vpButtons.push(btn);
    });
  }

  private bindEvents(): void {
    this.btnMode?.addEventListener('click', () => this.callbacks.onToggleMode());
    this.btnAudio?.addEventListener('click', () =>
      this.callbacks.onToggleAudio()
    );
    this.btnLock?.addEventListener('click', () =>
      this.callbacks.onTogglePointerLock()
    );
    this.btnHideHud?.addEventListener('click', () =>
      this.setHudVisible(!this.hudVisible)
    );
    this.restoreBtn?.addEventListener('click', () => this.setHudVisible(true));

    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (e.code === 'KeyH') {
      this.setHudVisible(!this.hudVisible);
    } else if (e.code === 'KeyM') {
      this.callbacks.onToggleAudio();
    }
  };

  public setLoadingProgress(percent: number, status?: string): void {
    if (this.loadingBarFill) {
      this.loadingBarFill.style.width = `${Math.max(4, Math.min(100, percent))}%`;
    }
    if (status && this.loadingStatus) {
      this.loadingStatus.textContent = status;
    }
  }

  public hideLoading(): void {
    this.setLoadingProgress(100, '青島八大關已就緒');
    this.loadingScreen?.classList.add('fade-out');
  }

  public setActiveMood(mood: MoodId): void {
    this.moodButtons.forEach((btn, id) => {
      btn.classList.toggle('active', id === mood);
    });
  }

  public setActiveViewpoint(index: number): void {
    this.vpButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });
  }

  public setMode(mode: ControlMode): void {
    if (this.btnModeLabel) {
      this.btnModeLabel.textContent = mode === 'walk' ? '漫步' : '飛翔';
    }
    this.btnMode?.classList.toggle('fly-active', mode === 'fly');
  }

  public setAudioEnabled(enabled: boolean): void {
    if (this.btnAudioLabel) {
      this.btnAudioLabel.textContent = enabled ? '海風濤聲' : '海風靜音';
    }
    this.btnAudio?.classList.toggle('active', enabled);
  }

  public setPointerLocked(locked: boolean): void {
    this.btnLock?.classList.toggle('active', locked);
    this.reticle?.classList.toggle('visible', locked);
  }

  public setLandmark(landmark: LandmarkInfo): void {
    if (this.locationName) {
      this.locationName.textContent = landmark.name;
    }
    if (this.locationSubtitle) {
      this.locationSubtitle.textContent = landmark.subtitle;
    }
  }

  public setHudVisible(visible: boolean): void {
    this.hudVisible = visible;
    this.hudRoot?.classList.toggle('hud-hidden', !visible);
    this.restoreBtn?.classList.toggle('visible', !visible);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
