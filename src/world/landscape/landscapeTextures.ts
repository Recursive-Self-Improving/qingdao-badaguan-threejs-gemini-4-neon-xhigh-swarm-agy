import * as THREE from 'three';

export interface LandscapeTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  sidewalkBump: THREE.CanvasTexture;
  cobbleMap: THREE.CanvasTexture;
  cobbleBump: THREE.CanvasTexture;
  sandMap: THREE.CanvasTexture;
  sandBump: THREE.CanvasTexture;
  seawallMap: THREE.CanvasTexture;
  seawallBump: THREE.CanvasTexture;
  cliffRockMap: THREE.CanvasTexture;
  cliffRockBump: THREE.CanvasTexture;
  turfMap: THREE.CanvasTexture;
  turfBump: THREE.CanvasTexture;
  cabanaWoodMap: THREE.CanvasTexture;
  cabanaWoodBump: THREE.CanvasTexture;
  beaconGlowMap: THREE.CanvasTexture;
}

/** Deterministic fast PRNG (Mulberry32) so procedural textures look consistent across runs */
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth seamless tileable 2D value noise in [0, 1] */
function makeTileNoise(period: number, seed: number): (u: number, v: number) => number {
  const rng = createRng(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const at = (ix: number, iy: number): number => {
    const x = ((ix % period) + period) % period;
    const y = ((iy % period) + period) % period;
    return grid[y * period + x];
  };

  return (u: number, v: number): number => {
    const fx = u * period;
    const fy = v * period;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D context unavailable');
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 1. Aged dark coastal asphalt with basalt/granite aggregate grain & hairline cracks */
function buildAsphaltTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(1041);
  const nLow = makeTileNoise(8, 1042);
  const nMid = makeTileNoise(24, 1043);
  const nHi = makeTileNoise(64, 1044);

  const imgC = ctxC.createImageData(S, S);
  const imgB = ctxB.createImageData(S, S);
  const dC = imgC.data;
  const dB = imgB.data;

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const macro = nLow(u, v) * 0.55 + nMid(u, v) * 0.3 + nHi(u, v) * 0.15;
      const grit = (rng() - 0.5) * 24;
      const speck = rng() > 0.965 ? 24 : rng() < 0.04 ? -18 : 0;

      const base = 54 + macro * 20 + grit * 0.65 + speck * 0.7;
      const idx = (y * S + x) * 4;
      dC[idx] = Math.max(24, Math.min(125, Math.round(base + 1)));
      dC[idx + 1] = Math.max(26, Math.min(128, Math.round(base + 2)));
      dC[idx + 2] = Math.max(28, Math.min(134, Math.round(base + 5)));
      dC[idx + 3] = 255;

      const h = Math.max(0, Math.min(255, Math.round(118 + macro * 42 + grit * 1.4 + speck * 1.2)));
      dB[idx] = h;
      dB[idx + 1] = h;
      dB[idx + 2] = h;
      dB[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  // Subtle sealed hairline cracks
  ctxC.strokeStyle = 'rgba(26, 28, 32, 0.42)';
  ctxB.strokeStyle = 'rgba(22, 22, 22, 0.7)';
  for (let c = 0; c < 6; c++) {
    let cx = rng() * S;
    let cy = rng() * S;
    let ang = rng() * Math.PI * 2;
    ctxC.lineWidth = 1.0 + rng() * 0.9;
    ctxB.lineWidth = ctxC.lineWidth + 0.4;
    ctxC.beginPath();
    ctxB.beginPath();
    ctxC.moveTo(cx, cy);
    ctxB.moveTo(cx, cy);
    for (let step = 0; step < 18; step++) {
      ang += (rng() - 0.5) * 0.7;
      cx += Math.cos(ang) * 14;
      cy += Math.sin(ang) * 14;
      ctxC.lineTo(cx, cy);
      ctxB.lineTo(cx, cy);
    }
    ctxC.stroke();
    ctxB.stroke();
  }

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 2. Classic Qingdao granite flagstone sidewalk slabs */
function buildSidewalkTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(2081);
  const nGrain = makeTileNoise(48, 2082);

  ctxC.fillStyle = '#5a564e';
  ctxC.fillRect(0, 0, S, S);
  ctxB.fillStyle = '#282828';
  ctxB.fillRect(0, 0, S, S);

  const rows = 8;
  const cols = 4;
  const rowH = S / rows;
  const colW = S / cols;
  const gap = 3;

  const palette: [number, number, number][] = [
    [194, 186, 174],
    [182, 176, 168],
    [203, 191, 176],
    [172, 166, 158],
    [198, 188, 171],
  ];

  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + stagger;
      const y = r * rowH;
      const [pr, pg, pb] = palette[Math.floor(rng() * palette.length)];
      const shade = 0.92 + rng() * 0.14;
      const cr = Math.min(245, Math.round(pr * shade));
      const cg = Math.min(242, Math.round(pg * shade));
      const cb = Math.min(238, Math.round(pb * shade));

      ctxC.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctxC.fillRect(x + gap, y + gap, colW - gap * 2, rowH - gap * 2);

      ctxC.fillStyle = 'rgba(255,250,240,0.16)';
      ctxC.fillRect(x + gap, y + gap, colW - gap * 2, 3);
      ctxC.fillStyle = 'rgba(40,36,30,0.16)';
      ctxC.fillRect(x + gap, y + rowH - gap - 3, colW - gap * 2, 3);

      const bh = Math.round(182 + rng() * 42);
      ctxB.fillStyle = `rgb(${bh},${bh},${bh})`;
      ctxB.fillRect(x + gap + 1, y + gap + 1, colW - gap * 2 - 2, rowH - gap * 2 - 2);
    }
  }

  const imgC = ctxC.getImageData(0, 0, S, S);
  const imgB = ctxB.getImageData(0, 0, S, S);
  const dC = imgC.data;
  const dB = imgB.data;
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const gVal = (nGrain(u, v) - 0.5) * 18;
      const crystal = rng() > 0.92 ? 14 : rng() < 0.08 ? -16 : (rng() - 0.5) * 10;
      const idx = (y * S + x) * 4;
      dC[idx] = Math.max(0, Math.min(255, Math.round(dC[idx] + gVal + crystal)));
      dC[idx + 1] = Math.max(0, Math.min(255, Math.round(dC[idx + 1] + gVal + crystal)));
      dC[idx + 2] = Math.max(0, Math.min(255, Math.round(dC[idx + 2] + gVal + crystal * 0.9)));
      const bv = Math.max(0, Math.min(255, Math.round(dB[idx] + gVal * 0.8 + crystal)));
      dB[idx] = bv;
      dB[idx + 1] = bv;
      dB[idx + 2] = bv;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 3. Historic Qingdao granite cobblestones (for Huashilou approach & accents) */
function buildCobbleTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(3091);

  ctxC.fillStyle = '#4f4a40';
  ctxC.fillRect(0, 0, S, S);
  ctxB.fillStyle = '#202020';
  ctxB.fillRect(0, 0, S, S);

  const rows = 14;
  const cols = 8;
  const rh = S / rows;
  const cw = S / cols;

  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    pw: number,
    ph: number,
    rad: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(px + rad, py);
    ctx.lineTo(px + pw - rad, py);
    ctx.quadraticCurveTo(px + pw, py, px + pw, py + rad);
    ctx.lineTo(px + pw, py + ph - rad);
    ctx.quadraticCurveTo(px + pw, py + ph, px + pw - rad, py + ph);
    ctx.lineTo(px + rad, py + ph);
    ctx.quadraticCurveTo(px, py + ph, px, py + ph - rad);
    ctx.lineTo(px, py + rad);
    ctx.quadraticCurveTo(px, py, px + rad, py);
    ctx.closePath();
  };

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offset + (rng() - 0.5) * 3.0;
      const y = r * rh + (rng() - 0.5) * 1.8;
      const w = cw - 5.5;
      const h = rh - 4.5;

      const tone = rng();
      let cr = 165;
      let cg = 158;
      let cb = 148;
      if (tone < 0.3) {
        cr = 184;
        cg = 166;
        cb = 148;
      } else if (tone < 0.6) {
        cr = 148;
        cg = 146;
        cb = 142;
      } else if (tone < 0.85) {
        cr = 176;
        cg = 171;
        cb = 161;
      } else {
        cr = 162;
        cg = 144;
        cb = 132;
      }
      const mult = 0.88 + rng() * 0.22;
      cr = Math.min(235, Math.round(cr * mult));
      cg = Math.min(230, Math.round(cg * mult));
      cb = Math.min(225, Math.round(cb * mult));

      drawRoundRect(ctxC, x + 2.5, y + 2, w, h, 5);
      ctxC.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctxC.fill();

      const grad = ctxB.createRadialGradient(
        x + 2.5 + w * 0.5,
        y + 2 + h * 0.5,
        2,
        x + 2.5 + w * 0.5,
        y + 2 + h * 0.5,
        Math.max(w, h) * 0.65,
      );
      const peak = Math.round(205 + rng() * 40);
      grad.addColorStop(0, `rgb(${peak},${peak},${peak})`);
      grad.addColorStop(1, 'rgb(90,90,90)');
      drawRoundRect(ctxB, x + 2.5, y + 2, w, h, 5);
      ctxB.fillStyle = grad;
      ctxB.fill();
    }
  }

  const imgC = ctxC.getImageData(0, 0, S, S);
  const dC = imgC.data;
  for (let i = 0; i < dC.length; i += 4) {
    const s = (rng() - 0.5) * 18;
    dC[i] = Math.max(0, Math.min(255, Math.round(dC[i] + s)));
    dC[i + 1] = Math.max(0, Math.min(255, Math.round(dC[i + 1] + s)));
    dC[i + 2] = Math.max(0, Math.min(255, Math.round(dC[i + 2] + s)));
  }
  ctxC.putImageData(imgC, 0, 0);

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 4. Fine warm Qingdao golden beach sand with subtle wind/wave ripples */
function buildSandTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(4111);
  const nLow = makeTileNoise(6, 4112);
  const nMid = makeTileNoise(18, 4113);
  const nFine = makeTileNoise(64, 4114);

  const imgC = ctxC.createImageData(S, S);
  const imgB = ctxB.createImageData(S, S);
  const dC = imgC.data;
  const dB = imgB.data;

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const warp = (nLow(u, v) - 0.5) * 0.22 + (nMid(u, v) - 0.5) * 0.06;
      const ripple = Math.sin((v * 10 + warp * 5) * Math.PI * 2) * 0.5 + 0.5;
      const ripple2 = Math.sin((v * 20 - u * 2 + warp * 8) * Math.PI * 2) * 0.5 + 0.5;
      const macro = nLow(u, v);
      const fine = nFine(u, v);
      const quartz = rng() > 0.96 ? 18 : rng() < 0.03 ? -16 : (rng() - 0.5) * 10;

      const shade = ripple * 0.05 + ripple2 * 0.025 + (macro - 0.5) * 0.08 + (fine - 0.5) * 0.04;
      const idx = (y * S + x) * 4;
      dC[idx] = Math.max(0, Math.min(255, Math.round(226 * (1 + shade) + quartz)));
      dC[idx + 1] = Math.max(0, Math.min(255, Math.round(202 * (1 + shade) + quartz * 0.9)));
      dC[idx + 2] = Math.max(0, Math.min(255, Math.round(154 * (1 + shade) + quartz * 0.8)));
      dC[idx + 3] = 255;

      const h = Math.max(
        0,
        Math.min(255, Math.round(90 + ripple * 92 + ripple2 * 26 + fine * 34 + quartz * 0.7)),
      );
      dB[idx] = h;
      dB[idx + 1] = h;
      dB[idx + 2] = h;
      dB[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 5. Weathered Qingdao granite seawall ashlar masonry (條石砌體) */
function buildSeawallTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(5191);
  const nStone = makeTileNoise(32, 5192);
  const nWeather = makeTileNoise(10, 5193);

  ctxC.fillStyle = '#3d3b34';
  ctxC.fillRect(0, 0, S, S);
  ctxB.fillStyle = '#181818';
  ctxB.fillRect(0, 0, S, S);

  const courseHeights = [62, 68, 60, 66, 64, 62, 66, 64];
  let yCursor = 0;

  for (let r = 0; r < courseHeights.length; r++) {
    const ch = courseHeights[r];
    const blocksInRow = 4 + (r % 2);
    const stagger = (r % 2) * 52;
    let xCursor = -stagger;
    while (xCursor < S + 20) {
      const bw = Math.round((S / blocksInRow) * (0.82 + rng() * 0.36));
      const pad = 4;

      const tint = rng();
      let cr = 158;
      let cg = 152;
      let cb = 140;
      if (tint < 0.33) {
        cr = 176;
        cg = 160;
        cb = 138;
      } else if (tint < 0.66) {
        cr = 148;
        cg = 146;
        cb = 141;
      } else {
        cr = 166;
        cg = 154;
        cb = 144;
      }
      const mult = 0.86 + rng() * 0.24;
      cr = Math.min(220, Math.round(cr * mult));
      cg = Math.min(215, Math.round(cg * mult));
      cb = Math.min(205, Math.round(cb * mult));

      for (const wrapOff of [0, -S, S]) {
        const bx = xCursor + wrapOff;
        if (bx + bw < 0 || bx > S) continue;

        ctxC.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctxC.fillRect(bx + pad, yCursor + pad, bw - pad * 2, ch - pad * 2);

        ctxC.fillStyle = 'rgba(255,248,232,0.14)';
        ctxC.fillRect(bx + pad, yCursor + pad, bw - pad * 2, 5);
        ctxC.fillStyle = 'rgba(25,24,20,0.22)';
        ctxC.fillRect(bx + pad, yCursor + ch - pad - 5, bw - pad * 2, 5);

        const bh = Math.round(170 + rng() * 65);
        ctxB.fillStyle = `rgb(${bh},${bh},${bh})`;
        ctxB.fillRect(bx + pad + 1, yCursor + pad + 1, bw - pad * 2 - 2, ch - pad * 2 - 2);
      }
      xCursor += bw;
    }
    yCursor += ch;
  }

  const imgC = ctxC.getImageData(0, 0, S, S);
  const imgB = ctxB.getImageData(0, 0, S, S);
  const dC = imgC.data;
  const dB = imgB.data;
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const rough = (nStone(u, v) - 0.5) * 32;
      const weather = nWeather(u, v);
      const speck = (rng() - 0.5) * 16;
      const idx = (y * S + x) * 4;

      const isDark = dB[idx] < 60;
      const moss = isDark && weather > 0.52 ? (weather - 0.52) * 45 : 0;

      dC[idx] = Math.max(0, Math.min(255, Math.round(dC[idx] + rough + speck - moss * 0.4)));
      dC[idx + 1] = Math.max(0, Math.min(255, Math.round(dC[idx + 1] + rough + speck + moss * 0.45)));
      dC[idx + 2] = Math.max(0, Math.min(255, Math.round(dC[idx + 2] + rough + speck - moss * 0.55)));
      const bv = Math.max(0, Math.min(255, Math.round(dB[idx] + rough * 1.15 + speck * 0.7)));
      dB[idx] = bv;
      dB[idx + 1] = bv;
      dB[idx + 2] = bv;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 6. Craggy Qingdao pale-ochre / warm-grey coastal granite cliff rock */
function buildCliffRockTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(6271);
  const n1 = makeTileNoise(6, 6272);
  const n2 = makeTileNoise(16, 6273);
  const n3 = makeTileNoise(40, 6274);
  const n4 = makeTileNoise(96, 6275);

  const imgC = ctxC.createImageData(S, S);
  const imgB = ctxB.createImageData(S, S);
  const dC = imgC.data;
  const dB = imgB.data;

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const w = n1(u, v);
      const m = n2(u + w * 0.08, v + w * 0.06);
      const hi = n3(u, v);
      const micro = n4(u, v);

      const ridge1 = 1 - Math.abs(n2(u + m * 0.14, v * 2.0) * 2 - 1);
      const crevice = Math.pow(Math.max(0, 1 - ridge1), 3.2);
      const strata = Math.sin((v * 7 + w * 2.4 + m * 0.6) * Math.PI * 2) * 0.5 + 0.5;

      const ochreMix = Math.max(0, Math.min(1, w * 0.7 + strata * 0.35));
      let r = 138 + ochreMix * 48 + (hi - 0.5) * 26 - crevice * 75;
      let g = 128 + ochreMix * 34 + (hi - 0.5) * 22 - crevice * 72;
      let b = 114 + ochreMix * 16 + (hi - 0.5) * 18 - crevice * 66;

      const speck = (rng() - 0.5) * 16;
      r += speck;
      g += speck;
      b += speck;

      if (m > 0.76 && hi > 0.58) {
        r = r * 0.8 + 150 * 0.2;
        g = g * 0.8 + 156 * 0.2;
        b = b * 0.8 + 128 * 0.2;
      }

      const idx = (y * S + x) * 4;
      dC[idx] = Math.max(24, Math.min(238, Math.round(r)));
      dC[idx + 1] = Math.max(22, Math.min(228, Math.round(g)));
      dC[idx + 2] = Math.max(20, Math.min(214, Math.round(b)));
      dC[idx + 3] = 255;

      const bh = Math.max(
        0,
        Math.min(
          255,
          Math.round(138 + (m - 0.5) * 70 + (hi - 0.5) * 52 + (micro - 0.5) * 32 - crevice * 115),
        ),
      );
      dB[idx] = bh;
      dB[idx + 1] = bh;
      dB[idx + 2] = bh;
      dB[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 7. Rich autumn coastal grass, moss & fallen golden/rust leaf ground cover */
function buildTurfTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 512;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(7321);
  const nLow = makeTileNoise(6, 7322);
  const nMid = makeTileNoise(20, 7323);
  const nBlade = makeTileNoise(80, 7324);

  const imgC = ctxC.createImageData(S, S);
  const imgB = ctxB.createImageData(S, S);
  const dC = imgC.data;
  const dB = imgB.data;

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const macro = nLow(u, v);
      const mid = nMid(u, v);
      const blade = nBlade(u, v);
      const jitter = (rng() - 0.5) * 14;

      const dryPatch = Math.max(0, Math.min(1, (macro - 0.45) * 1.4));
      const r = 74 + dryPatch * 38 + (mid - 0.5) * 20 + (blade - 0.5) * 18 + jitter * 0.7;
      const g = 104 + dryPatch * 14 + (mid - 0.5) * 24 + (blade - 0.5) * 22 + jitter * 0.8;
      const b = 52 + dryPatch * 6 + (mid - 0.5) * 12 + (blade - 0.5) * 10 + jitter * 0.5;

      const idx = (y * S + x) * 4;
      dC[idx] = Math.max(24, Math.min(200, Math.round(r)));
      dC[idx + 1] = Math.max(36, Math.min(210, Math.round(g)));
      dC[idx + 2] = Math.max(20, Math.min(140, Math.round(b)));
      dC[idx + 3] = 255;

      const h = Math.max(
        0,
        Math.min(255, Math.round(115 + (mid - 0.5) * 46 + (blade - 0.5) * 65 + jitter)),
      );
      dB[idx] = h;
      dB[idx + 1] = h;
      dB[idx + 2] = h;
      dB[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  const leafPalette = ['#d8a934', '#e3ba47', '#c57229', '#b84b26', '#cfa03c'];
  for (let i = 0; i < 420; i++) {
    const lx = rng() * S;
    const ly = rng() * S;
    const lr = 1.6 + rng() * 2.8;
    const ang = rng() * Math.PI * 2;
    ctxC.save();
    ctxC.translate(lx, ly);
    ctxC.rotate(ang);
    ctxC.fillStyle = leafPalette[Math.floor(rng() * leafPalette.length)];
    ctxC.globalAlpha = 0.55 + rng() * 0.35;
    ctxC.beginPath();
    ctxC.ellipse(0, 0, lr * 1.25, lr * 0.72, 0, 0, Math.PI * 2);
    ctxC.fill();
    ctxC.restore();
  }
  ctxC.globalAlpha = 1;

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** 8. Painted coastal vertical tongue-and-groove timber siding for beach cabanas */
function buildCabanaWoodTextures(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const S = 256;
  const [cCol, ctxC] = makeCanvas(S);
  const [cBmp, ctxB] = makeCanvas(S);
  const rng = createRng(8411);

  ctxC.fillStyle = '#f2eadc';
  ctxC.fillRect(0, 0, S, S);
  ctxB.fillStyle = '#c8c8c8';
  ctxB.fillRect(0, 0, S, S);

  const planks = 12;
  const pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const tone = 236 + Math.round((rng() - 0.5) * 14);
    ctxC.fillStyle = `rgb(${tone},${tone - 5},${tone - 15})`;
    ctxC.fillRect(x + 1.5, 0, pw - 2.5, S);

    ctxC.fillStyle = 'rgba(110, 98, 82, 0.45)';
    ctxC.fillRect(x, 0, 2, S);
    ctxB.fillStyle = '#383838';
    ctxB.fillRect(x, 0, 2, S);

    ctxC.strokeStyle = 'rgba(165, 148, 124, 0.14)';
    ctxC.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const gx = x + 3 + rng() * (pw - 6);
      ctxC.beginPath();
      ctxC.moveTo(gx, 0);
      ctxC.lineTo(gx + (rng() - 0.5) * 2, S);
      ctxC.stroke();
    }
  }

  return [
    finalizeTexture(cCol, true, anisotropy),
    finalizeTexture(cBmp, false, anisotropy),
  ];
}

/** Soft radial glow sprite for the breakwater lighthouse beacon */
function buildBeaconGlowTexture(): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = makeCanvas(S);
  const grad = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255, 245, 220, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 128, 72, 0.85)');
  grad.addColorStop(0.55, 'rgba(235, 58, 42, 0.28)');
  grad.addColorStop(1.0, 'rgba(220, 30, 20, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createLandscapeTextures(renderer: THREE.WebGLRenderer): LandscapeTextureSet {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [asphaltMap, asphaltBump] = buildAsphaltTextures(anisotropy);
  const [sidewalkMap, sidewalkBump] = buildSidewalkTextures(anisotropy);
  const [cobbleMap, cobbleBump] = buildCobbleTextures(anisotropy);
  const [sandMap, sandBump] = buildSandTextures(anisotropy);
  const [seawallMap, seawallBump] = buildSeawallTextures(anisotropy);
  const [cliffRockMap, cliffRockBump] = buildCliffRockTextures(anisotropy);
  const [turfMap, turfBump] = buildTurfTextures(anisotropy);
  const [cabanaWoodMap, cabanaWoodBump] = buildCabanaWoodTextures(anisotropy);
  const beaconGlowMap = buildBeaconGlowTexture();

  return {
    asphaltMap,
    asphaltBump,
    sidewalkMap,
    sidewalkBump,
    cobbleMap,
    cobbleBump,
    sandMap,
    sandBump,
    seawallMap,
    seawallBump,
    cliffRockMap,
    cliffRockBump,
    turfMap,
    turfBump,
    cabanaWoodMap,
    cabanaWoodBump,
    beaconGlowMap,
  };
}
