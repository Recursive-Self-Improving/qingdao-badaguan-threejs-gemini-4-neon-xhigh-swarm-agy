import type { MoodId } from '../world/types';

/**
 * Pure procedural Web Audio ambient soundscape for Qingdao Badaguan:
 * - Yellow Sea surf waves (filtered stereo pink noise with rhythmic swell envelopes)
 * - Autumn coastal wind rustling through ginkgo, maple & black pine canopies
 * - Occasional distant synthesized seagull calls (daytime / sunset / morning mist)
 */
export class CoastalAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private surfGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private enabled = false;
  private initialized = false;
  private currentMood: MoodId = 'autumn_afternoon';
  private nextGullTime = 8;
  private elapsed = 0;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setMood(mood: MoodId): void {
    this.currentMood = mood;
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public setEnabled(enable: boolean): void {
    this.enabled = enable;
    if (enable) {
      this.ensureInitialized();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.ctx && this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.42, this.ctx.currentTime, 0.55);
      }
    } else if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.35);
    }
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      this.masterGain = master;

      const noiseBuffer = this.createPinkNoiseBuffer(ctx, 6);

      // 1. Yellow Sea Surf layer
      const surfSource = ctx.createBufferSource();
      surfSource.buffer = noiseBuffer;
      surfSource.loop = true;

      const surfFilter = ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 360;
      surfFilter.Q.value = 0.85;
      this.surfFilter = surfFilter;

      const surfGain = ctx.createGain();
      surfGain.gain.value = 0.45;
      this.surfGain = surfGain;

      surfSource.connect(surfFilter);
      surfFilter.connect(surfGain);
      surfGain.connect(master);
      surfSource.start();

      // 2. Coastal Breeze through Leaves layer
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      windSource.playbackRate.value = 1.12;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 540;
      windFilter.Q.value = 1.3;
      this.windFilter = windFilter;

      const windGain = ctx.createGain();
      windGain.gain.value = 0.16;
      this.windGain = windGain;

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();

      this.initialized = true;
    } catch {
      // Gracefully stay silent if AudioContext creation is unavailable
    }
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }
      // Smooth loop crossfade at ends
      const fadeSamples = Math.floor(ctx.sampleRate * 0.15);
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        out[length - 1 - i] = out[length - 1 - i] * t + out[i] * (1 - t);
      }
    }
    return buffer;
  }

  /**
   * Modulates surf swell & leaf breeze based on player's distance to the Yellow Sea.
   */
  public update(dt: number, playerZ: number, playerY: number): void {
    if (!this.enabled || !this.ctx || !this.surfGain || !this.surfFilter || !this.windGain || !this.windFilter) {
      return;
    }

    this.elapsed += dt;
    const now = this.ctx.currentTime;

    // Proximity to coast (z > 20 is coastal promenade, beach, cape, pier)
    const coastFactor = Math.max(0.22, Math.min(1.0, (playerZ + 45) / 95));
    const altitudeFade = Math.max(0.3, 1 - Math.max(0, playerY - 18) / 85);

    // Dual-frequency organic wave swell
    const swell =
      0.5 +
      0.34 * Math.sin(this.elapsed * 0.68) +
      0.16 * Math.sin(this.elapsed * 0.27 + 1.4);

    const targetSurfFreq = 180 + swell * 460 * coastFactor;
    const targetSurfGain = (0.18 + swell * 0.42) * coastFactor * altitudeFade;

    this.surfFilter.frequency.setTargetAtTime(targetSurfFreq, now, 0.2);
    this.surfGain.gain.setTargetAtTime(targetSurfGain, now, 0.2);

    // Gentle breeze through ginkgo & pine canopies (stronger inland & at height)
    const breeze = 0.5 + 0.5 * Math.sin(this.elapsed * 0.44 + 0.9);
    const inlandBoost = 1.15 - coastFactor * 0.45;
    this.windFilter.frequency.setTargetAtTime(420 + breeze * 380, now, 0.25);
    this.windGain.gain.setTargetAtTime(
      (0.08 + breeze * 0.11) * inlandBoost,
      now,
      0.25
    );

    // Occasional distant seagull call during daytime / mist / sunset
    if (
      this.currentMood !== 'coastal_night' &&
      this.elapsed >= this.nextGullTime
    ) {
      this.nextGullTime = this.elapsed + 14 + Math.random() * 16;
      this.playSeagullCall(coastFactor);
    }
  }

  private playSeagullCall(coastFactor: number): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const pulses = Math.random() > 0.45 ? 2 : 1;
    for (let i = 0; i < pulses; i++) {
      const start = now + i * 0.42;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      const baseFreq = 1650 + Math.random() * 380;
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, start + 0.09);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, start + 0.34);

      filter.type = 'bandpass';
      filter.frequency.value = baseFreq * 1.05;
      filter.Q.value = 3.2;

      const peak = 0.032 * (0.45 + 0.55 * coastFactor);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + 0.38);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
