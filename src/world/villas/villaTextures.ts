import * as THREE from 'three';
import type { Collider, MoodConfig, WorldContext } from '../types';

// Deterministic PRNG for procedural textures and architectural micro-variation
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
  wrap = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// Procedural Canvas2D Architectural Textures
// ============================================================================

/**
 * Qingdao Rusticated Granite "蘑菇石" (Mushroom Stone) Masonry
 * Pillow-faced dressed granite blocks in warm grey, silver, ochre & Laoshan pink-granite.
 */
function createGraniteTextures(
  seed: number,
  huashilouMulticolor: boolean
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 512;
  const [cDiff, d] = makeCanvas(size, size);
  const [cBump, b] = makeCanvas(size, size);
  const [cRough, r] = makeCanvas(size, size);
  const rng = createRng(seed);

  // Deep recessed mortar bed
  d.fillStyle = huashilouMulticolor ? '#696259' : '#716c64';
  d.fillRect(0, 0, size, size);
  b.fillStyle = '#181818';
  b.fillRect(0, 0, size, size);
  r.fillStyle = '#e8e8e8';
  r.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  const mortar = 5;

  const basePalette: [number, number, number][] = huashilouMulticolor
    ? [
        [168, 159, 146], // warm grey granite
        [186, 152, 134], // Qingdao pink granite
        [150, 147, 142], // cool silver granite
        [194, 170, 136], // warm ochre stone
        [138, 144, 152], // coastal slate-grey
        [176, 134, 118], // rose-rust stone
        [198, 186, 166], // pale limestone
      ]
    : [
        [166, 160, 151], // warm granite grey
        [180, 161, 146], // subtle Laoshan pink granite
        [154, 150, 144], // weathered granite
        [183, 172, 155], // ochre-tinted granite
        [145, 142, 138], // dark coastal granite
      ];

  for (let row = 0; row < rows; row++) {
    const y0 = row * rowH;
    const cols = 4 + (row % 2);
    const offset = (row % 2) * (size / cols) * 0.5;
    let xCursor = -offset;

    while (xCursor < size) {
      const colW = (size / cols) * (0.82 + rng() * 0.36);
      const x1 = xCursor;
      const x2 = xCursor + colW;
      xCursor = x2;

      const col = basePalette[Math.floor(rng() * basePalette.length)];
      const shade = 0.88 + rng() * 0.24;
      const cr = Math.min(255, Math.round(col[0] * shade));
      const cg = Math.min(255, Math.round(col[1] * shade));
      const cb = Math.min(255, Math.round(col[2] * shade));

      const offsets = [0];
      if (x1 < 0) offsets.push(size);
      if (x2 > size) offsets.push(-size);

      for (const ox of offsets) {
        const bx = x1 + ox + mortar * 0.5;
        const by = y0 + mortar * 0.5;
        const bw = colW - mortar;
        const bh = rowH - mortar;
        if (bw <= 4) continue;

        // Chiseled beveled pillow-face gradient ("蘑菇石")
        const grad = d.createLinearGradient(bx, by, bx + bw * 0.2, by + bh);
        grad.addColorStop(
          0,
          `rgb(${Math.min(255, cr + 24)},${Math.min(255, cg + 22)},${Math.min(255, cb + 20)})`
        );
        grad.addColorStop(0.5, `rgb(${cr},${cg},${cb})`);
        grad.addColorStop(
          1,
          `rgb(${Math.max(0, cr - 28)},${Math.max(0, cg - 28)},${Math.max(0, cb - 26)})`
        );
        d.fillStyle = grad;
        d.fillRect(bx, by, bw, bh);

        // Chiseled border edge highlight
        d.strokeStyle = 'rgba(255,250,240,0.22)';
        d.lineWidth = 2;
        d.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

        // Rusticated raised center bump (mushroom stone relief)
        const bGrad = b.createRadialGradient(
          bx + bw * 0.5,
          by + bh * 0.45,
          Math.min(bw, bh) * 0.1,
          bx + bw * 0.5,
          by + bh * 0.5,
          Math.max(bw, bh) * 0.62
        );
        bGrad.addColorStop(0, '#f4f4f4');
        bGrad.addColorStop(0.65, '#c4c4c4');
        bGrad.addColorStop(1, '#585858');
        b.fillStyle = bGrad;
        b.fillRect(bx + 1, by + 1, bw - 2, bh - 2);

        const roughVal = Math.round(170 + rng() * 55);
        r.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
        r.fillRect(bx, by, bw, bh);

        // Huashilou multicolored coastal pebble/stone inlays ("花石")
        if (huashilouMulticolor && rng() < 0.38) {
          const pCount = 2 + Math.floor(rng() * 4);
          for (let p = 0; p < pCount; p++) {
            const px = bx + 8 + rng() * Math.max(4, bw - 16);
            const py = by + 7 + rng() * Math.max(4, bh - 14);
            const pr = 3 + rng() * 5.5;
            const pCol = basePalette[Math.floor(rng() * basePalette.length)];
            d.fillStyle = `rgb(${Math.round(pCol[0] * 0.92)},${Math.round(pCol[1] * 0.9)},${Math.round(pCol[2] * 0.88)})`;
            d.beginPath();
            d.ellipse(px, py, pr * 1.25, pr * 0.85, rng() * Math.PI, 0, Math.PI * 2);
            d.fill();
            b.fillStyle = '#ffffff';
            b.beginPath();
            b.ellipse(px, py, pr * 1.1, pr * 0.75, 0, 0, Math.PI * 2);
            b.fill();
          }
        }
      }
    }
  }

  // Mineral granite grain speckles
  for (let i = 0; i < 6200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const light = rng() > 0.5;
    d.fillStyle = light ? 'rgba(255,250,242,0.16)' : 'rgba(35,32,28,0.18)';
    d.fillRect(x, y, 2, 2);
    if (i % 3 === 0) {
      b.fillStyle = light ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
      b.fillRect(x, y, 2, 2);
    }
  }

  return {
    map: finalizeTexture(cDiff, true),
    bumpMap: finalizeTexture(cBump, false),
    roughnessMap: finalizeTexture(cRough, false),
  };
}

/**
 * Qingdao Red Terracotta Barrel / Interlocking Roof Tiles (紅瓦)
 */
function createRedRoofTileTextures(
  seed: number,
  variant: 'classic' | 'deep'
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 512;
  const [cDiff, d] = makeCanvas(size, size);
  const [cBump, b] = makeCanvas(size, size);
  const [cRough, r] = makeCanvas(size, size);
  const rng = createRng(seed);

  const cols = 16;
  const rows = 12;
  const tileW = size / cols;
  const tileH = size / rows;

  const baseR = variant === 'classic' ? 190 : 162;
  const baseG = variant === 'classic' ? 76 : 59;
  const baseB = variant === 'classic' ? 49 : 43;

  d.fillStyle = `rgb(${baseR - 42},${baseG - 22},${baseB - 16})`;
  d.fillRect(0, 0, size, size);
  b.fillStyle = '#303030';
  b.fillRect(0, 0, size, size);
  r.fillStyle = '#b8b8b8';
  r.fillRect(0, 0, size, size);

  for (let row = 0; row < rows; row++) {
    const y = row * tileH;
    for (let col = 0; col < cols; col++) {
      const x = col * tileW;
      const jitter = (rng() - 0.5) * 28;
      const warm = (rng() - 0.5) * 14;
      const tr = Math.max(85, Math.min(230, Math.round(baseR + jitter + warm * 0.5)));
      const tg = Math.max(34, Math.min(120, Math.round(baseG + jitter * 0.55)));
      const tb = Math.max(24, Math.min(86, Math.round(baseB + jitter * 0.42)));

      // Barrel tile cylindrical rib shading
      const hGrad = d.createLinearGradient(x, y, x + tileW, y);
      hGrad.addColorStop(
        0,
        `rgb(${Math.max(0, tr - 48)},${Math.max(0, tg - 26)},${Math.max(0, tb - 18)})`
      );
      hGrad.addColorStop(
        0.28,
        `rgb(${Math.min(255, tr + 16)},${Math.min(255, tg + 10)},${Math.min(255, tb + 7)})`
      );
      hGrad.addColorStop(0.55, `rgb(${tr},${tg},${tb})`);
      hGrad.addColorStop(
        0.88,
        `rgb(${Math.max(0, tr - 26)},${Math.max(0, tg - 16)},${Math.max(0, tb - 12)})`
      );
      hGrad.addColorStop(
        1,
        `rgb(${Math.max(0, tr - 56)},${Math.max(0, tg - 30)},${Math.max(0, tb - 22)})`
      );
      d.fillStyle = hGrad;
      d.fillRect(x, y, tileW, tileH);

      // Overlap drop shadow along tile course seam
      const vGrad = d.createLinearGradient(x, y, x, y + tileH);
      vGrad.addColorStop(0, 'rgba(26,10,6,0.42)');
      vGrad.addColorStop(0.16, 'rgba(26,10,6,0.0)');
      vGrad.addColorStop(0.86, 'rgba(255,210,185,0.08)');
      vGrad.addColorStop(1, 'rgba(20,8,5,0.52)');
      d.fillStyle = vGrad;
      d.fillRect(x, y, tileW, tileH);

      // Subtle coastal weathering / moss speck
      if (rng() < 0.14) {
        d.fillStyle = 'rgba(72,78,44,0.22)';
        d.beginPath();
        d.arc(
          x + tileW * (0.2 + rng() * 0.6),
          y + tileH * (0.15 + rng() * 0.45),
          4 + rng() * 6,
          0,
          Math.PI * 2
        );
        d.fill();
      }

      const bGrad = b.createLinearGradient(x, y, x + tileW, y);
      bGrad.addColorStop(0, '#282828');
      bGrad.addColorStop(0.35, '#efefef');
      bGrad.addColorStop(0.65, '#dcdcdc');
      bGrad.addColorStop(1, '#222222');
      b.fillStyle = bGrad;
      b.fillRect(x, y + 2, tileW, tileH - 3);
      b.fillStyle = '#141414';
      b.fillRect(x, y, tileW, 3);

      const rv = Math.round(145 + rng() * 65);
      r.fillStyle = `rgb(${rv},${rv},${rv})`;
      r.fillRect(x, y, tileW, tileH);
    }
  }

  for (let i = 0; i < 2400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    d.fillStyle = rng() > 0.5 ? 'rgba(255,220,190,0.07)' : 'rgba(30,12,8,0.1)';
    d.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTexture(cDiff, true),
    bumpMap: finalizeTexture(cBump, false),
    roughnessMap: finalizeTexture(cRough, false),
  };
}

function parseHexSRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Aged Qingdao Coastal Stucco Plaster
 */
function createStuccoDiffuse(baseHex: string, seed: number, warmth = 0.08): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const rng = createRng(seed);
  const [br, bg, bb] = parseHexSRGB(baseHex);

  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 28 + rng() * 85;
    const lighter = rng() > 0.45;
    const delta = lighter ? 17 : -19;
    const g = ctx.createRadialGradient(x, y, 4, x, y, rad);
    g.addColorStop(
      0,
      `rgba(${Math.max(0, Math.min(255, br + delta))},${Math.max(
        0,
        Math.min(255, bg + delta - Math.round(warmth * 12))
      )},${Math.max(0, Math.min(255, bb + delta - Math.round(warmth * 22)))},0.16)`
    );
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  for (let i = 0; i < 50; i++) {
    const x = rng() * size;
    const w = 2 + rng() * 8;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(60,52,42,0.035)' : 'rgba(255,252,244,0.04)';
    ctx.fillRect(x, 0, w, size);
  }

  for (let i = 0; i < 5200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(40,32,24,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  return finalizeTexture(canvas, true);
}

function createStuccoBump(seed: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const rng = createRng(seed);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 14 + rng() * 36;
    const v = Math.round(108 + rng() * 44);
    const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  for (let i = 0; i < 3600; i++) {
    const v = Math.round(92 + rng() * 72);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }
  return finalizeTexture(canvas, false);
}

/**
 * Historic German Terracotta Red Brick
 */
function createRedBrickTextures(seed: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const [cDiff, d] = makeCanvas(size, size);
  const [cBump, b] = makeCanvas(size, size);
  const rng = createRng(seed);

  d.fillStyle = '#bfb4a2';
  d.fillRect(0, 0, size, size);
  b.fillStyle = '#242424';
  b.fillRect(0, 0, size, size);

  const rows = 16;
  const cols = 8;
  const rowH = size / rows;
  const colW = size / cols;
  const m = 3;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const off = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + off;
      const shade = 0.8 + rng() * 0.34;
      const br = Math.min(215, Math.round(166 * shade + (rng() - 0.5) * 18));
      const bg = Math.min(120, Math.round(76 * shade + (rng() - 0.5) * 10));
      const bb = Math.min(95, Math.round(54 * shade + (rng() - 0.5) * 8));
      d.fillStyle = `rgb(${br},${bg},${bb})`;
      d.fillRect(x + m * 0.5, y + m * 0.5, colW - m, rowH - m);

      const bv = Math.round(170 + rng() * 55);
      b.fillStyle = `rgb(${bv},${bv},${bv})`;
      b.fillRect(x + m * 0.5, y + m * 0.5, colW - m, rowH - m);
    }
  }

  for (let i = 0; i < 3000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    d.fillStyle = rng() > 0.5 ? 'rgba(255,235,210,0.08)' : 'rgba(32,18,12,0.12)';
    d.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTexture(cDiff, true),
    bumpMap: finalizeTexture(cBump, false),
  };
}

/**
 * Warm Mullioned Glass Windows — Reflective Coastal Glass by Day + Cozy Golden Glow at Dusk/Night
 */
function createMullionedWindowTextures(
  mullionHex: string,
  panesX: number,
  panesY: number,
  gothicArch: boolean
): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 384;
  const [cDiff, d] = makeCanvas(w, h);
  const [cEmis, e] = makeCanvas(w, h);
  const [cRough, r] = makeCanvas(w, h);

  const dayGrad = d.createLinearGradient(0, 0, w * 0.3, h);
  dayGrad.addColorStop(0, '#3e5c72');
  dayGrad.addColorStop(0.35, '#263b4d');
  dayGrad.addColorStop(0.75, '#192836');
  dayGrad.addColorStop(1, '#263640');
  d.fillStyle = dayGrad;
  d.fillRect(0, 0, w, h);

  // Diagonal sky reflection highlight on glass
  d.fillStyle = 'rgba(190,224,245,0.18)';
  d.beginPath();
  d.moveTo(0, h * 0.12);
  d.lineTo(w * 0.72, 0);
  d.lineTo(w, 0);
  d.lineTo(0, h * 0.42);
  d.closePath();
  d.fill();

  // Warm lamp-lit interior emissive map
  const emisGrad = e.createRadialGradient(w * 0.5, h * 0.58, 12, w * 0.5, h * 0.52, h * 0.65);
  emisGrad.addColorStop(0, '#fff2c8');
  emisGrad.addColorStop(0.45, '#ffc064');
  emisGrad.addColorStop(0.85, '#cf7a2a');
  emisGrad.addColorStop(1, '#7a3e12');
  e.fillStyle = emisGrad;
  e.fillRect(0, 0, w, h);

  // Soft interior curtains along sides
  const drawCurtains = (ctx: CanvasRenderingContext2D, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.34, 0);
    ctx.quadraticCurveTo(w * 0.24, h * 0.45, w * 0.14, h * 0.62);
    ctx.quadraticCurveTo(w * 0.22, h * 0.84, w * 0.24, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.66, 0);
    ctx.quadraticCurveTo(w * 0.76, h * 0.45, w * 0.86, h * 0.62);
    ctx.quadraticCurveTo(w * 0.78, h * 0.84, w * 0.76, h);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  drawCurtains(d, 'rgba(225,212,188,0.18)');
  drawCurtains(e, 'rgba(65,28,8,0.48)');

  r.fillStyle = '#222222';
  r.fillRect(0, 0, w, h);

  const drawMullions = (ctx: CanvasRenderingContext2D, color: string) => {
    ctx.fillStyle = color;
    const border = 14;
    ctx.fillRect(0, 0, w, border);
    ctx.fillRect(0, h - border, w, border);
    ctx.fillRect(0, 0, border, h);
    ctx.fillRect(w - border, 0, border, h);

    const barW = 8;
    for (let i = 1; i < panesX; i++) {
      const x = Math.round((w / panesX) * i - barW * 0.5);
      ctx.fillRect(x, 0, i === panesX / 2 ? barW + 4 : barW, h);
    }
    for (let j = 1; j < panesY; j++) {
      const y = Math.round((h / panesY) * j - barW * 0.5);
      ctx.fillRect(0, y, w, j === 1 ? barW + 3 : barW);
    }

    if (gothicArch) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h * 0.34);
      ctx.quadraticCurveTo(w * 0.9, h * 0.1, w * 0.5, border + 4);
      ctx.quadraticCurveTo(w * 0.1, h * 0.1, 0, h * 0.34);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      for (let k = -h; k < w + h; k += 44) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + h * 0.65, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(k + h * 0.65, 0);
        ctx.lineTo(k, h);
        ctx.stroke();
      }
    }
  };

  drawMullions(d, mullionHex);
  drawMullions(e, '#000000');
  drawMullions(r, '#d6d6d6');

  return {
    map: finalizeTexture(cDiff, true, 1, 1, false),
    emissiveMap: finalizeTexture(cEmis, true, 1, 1, false),
    roughnessMap: finalizeTexture(cRough, false, 1, 1, false),
  };
}

/**
 * Carved Timber Door & Louvered Wooden Shutters
 */
function createTimberDoorTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const w = 256;
  const h = 512;
  const [cDiff, d] = makeCanvas(w, h);
  const [cBump, b] = makeCanvas(w, h);
  const rng = createRng(8811);

  d.fillStyle = '#5a361e';
  d.fillRect(0, 0, w, h);
  b.fillStyle = '#909090';
  b.fillRect(0, 0, w, h);

  for (let i = 0; i < 420; i++) {
    const x = rng() * w;
    d.fillStyle = rng() > 0.5 ? 'rgba(120,76,42,0.18)' : 'rgba(30,16,8,0.22)';
    d.fillRect(x, 0, 1 + rng() * 2, h);
  }

  const panels = [
    [28, 36, 92, 185],
    [136, 36, 92, 185],
    [28, 250, 92, 215],
    [136, 250, 92, 215],
  ];
  for (const [px, py, pw, ph] of panels) {
    d.fillStyle = '#472814';
    d.fillRect(px, py, pw, ph);
    d.strokeStyle = '#794d2c';
    d.lineWidth = 4;
    d.strokeRect(px + 3, py + 3, pw - 6, ph - 6);
    d.fillStyle = '#633c22';
    d.fillRect(px + 12, py + 12, pw - 24, ph - 24);

    b.fillStyle = '#383838';
    b.fillRect(px, py, pw, ph);
    b.fillStyle = '#cfcfcf';
    b.fillRect(px + 10, py + 10, pw - 20, ph - 20);
  }

  d.fillStyle = '#d4a64a';
  d.beginPath();
  d.arc(112, 270, 6, 0, Math.PI * 2);
  d.arc(144, 270, 6, 0, Math.PI * 2);
  d.fill();

  return {
    map: finalizeTexture(cDiff, true, 1, 1, false),
    bumpMap: finalizeTexture(cBump, false, 1, 1, false),
  };
}

function createLouveredShutterTexture(hex: string): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 128;
  const h = 256;
  const [cDiff, d] = makeCanvas(w, h);
  const [cBump, b] = makeCanvas(w, h);
  const [cr, cg, cb] = parseHexSRGB(hex);

  d.fillStyle = `rgb(${cr},${cg},${cb})`;
  d.fillRect(0, 0, w, h);
  b.fillStyle = '#b4b4b4';
  b.fillRect(0, 0, w, h);

  d.strokeStyle = `rgb(${Math.max(0, cr - 25)},${Math.max(0, cg - 25)},${Math.max(0, cb - 25)})`;
  d.lineWidth = 10;
  d.strokeRect(5, 5, w - 10, h - 10);

  for (let y = 20; y < h - 20; y += 10) {
    if (Math.abs(y - h * 0.5) < 10) continue;
    d.fillStyle = `rgb(${Math.max(0, cr - 42)},${Math.max(0, cg - 42)},${Math.max(0, cb - 40)})`;
    d.fillRect(18, y, w - 36, 4);
    d.fillStyle = `rgb(${Math.min(255, cr + 18)},${Math.min(255, cg + 18)},${Math.min(255, cb + 16)})`;
    d.fillRect(18, y + 4, w - 36, 3);

    b.fillStyle = '#303030';
    b.fillRect(18, y, w - 36, 4);
    b.fillStyle = '#f0f0f0';
    b.fillRect(18, y + 4, w - 36, 4);
  }

  return {
    map: finalizeTexture(cDiff, true, 1, 1, false),
    bumpMap: finalizeTexture(cBump, false, 1, 1, false),
  };
}

/**
 * Courtyard Gravel / Flagstone Path Texture
 */
function createCourtyardPavingTexture(flagstone: boolean): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const rng = createRng(flagstone ? 4421 : 9912);

  if (!flagstone) {
    ctx.fillStyle = '#d3c5ad';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4500; i++) {
      const shade = 155 + Math.floor(rng() * 75);
      ctx.fillStyle = `rgb(${shade},${Math.round(shade * 0.94)},${Math.round(shade * 0.84)})`;
      ctx.fillRect(rng() * size, rng() * size, 2 + rng() * 2, 2 + rng() * 2);
    }
  } else {
    ctx.fillStyle = '#868075';
    ctx.fillRect(0, 0, size, size);
    const grid = 4;
    const step = size / grid;
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const v = 158 + Math.floor(rng() * 34);
        ctx.fillStyle = `rgb(${v},${v - 5},${v - 13})`;
        ctx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
      }
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,250,240,0.1)' : 'rgba(40,35,30,0.1)';
      ctx.fillRect(rng() * size, rng() * size, 2, 2);
    }
  }
  return finalizeTexture(canvas, true);
}

/**
 * Soft Radial Lantern Glow Sprite Texture
 */
function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,244,205,1.0)');
  g.addColorStop(0.28, 'rgba(255,198,108,0.65)');
  g.addColorStop(0.65, 'rgba(255,148,58,0.18)');
  g.addColorStop(1, 'rgba(255,120,30,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(canvas, true, 1, 1, false);
}

/**
 * Heritage Villa Enamel / Bronze Plaque Texture (with crisp Chinese typography)
 */
export function createPlaqueTexture(
  title: string,
  subtitle: string,
  style: 'bronze' | 'enamel' = 'bronze'
): THREE.CanvasTexture {
  const w = 512;
  const h = 192;
  const [canvas, ctx] = makeCanvas(w, h);

  if (style === 'bronze') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3d2f20');
    g.addColorStop(0.5, '#2b2016');
    g.addColorStop(1, '#1e160f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#d8b46e';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.fillStyle = '#f4d68f';
  } else {
    ctx.fillStyle = '#1d4473';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#f4f6fa';
    ctx.lineWidth = 7;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#ffffff';
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 54px "Noto Serif SC", "Songti SC", Georgia, serif';
  ctx.fillText(title, w / 2, h * 0.41);

  ctx.font = '500 28px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillStyle = style === 'bronze' ? '#dfca9d' : '#dbe8f6';
  ctx.fillText(subtitle, w / 2, h * 0.74);

  return finalizeTexture(canvas, true, 1, 1, false);
}

// ============================================================================
// Shared Villa Material Library & Mood Reactivity
// ============================================================================

export interface VillaMaterialLibrary {
  granite: THREE.MeshStandardMaterial;
  huashilouStone: THREE.MeshStandardMaterial;
  carvedLimestone: THREE.MeshStandardMaterial;
  redRoof: THREE.MeshStandardMaterial;
  deepRedRoof: THREE.MeshStandardMaterial;
  terracottaRidge: THREE.MeshStandardMaterial;
  princessBlue: THREE.MeshStandardMaterial;
  butterflyOchre: THREE.MeshStandardMaterial;
  creamStucco: THREE.MeshStandardMaterial;
  peachStucco: THREE.MeshStandardMaterial;
  ivoryStucco: THREE.MeshStandardMaterial;
  redBrick: THREE.MeshStandardMaterial;
  whiteTrim: THREE.MeshStandardMaterial;
  walnutTimber: THREE.MeshStandardMaterial;
  wroughtIron: THREE.MeshStandardMaterial;
  weatheredCopper: THREE.MeshStandardMaterial;
  timberDoor: THREE.MeshStandardMaterial;
  greenShutter: THREE.MeshStandardMaterial;
  whiteShutter: THREE.MeshStandardMaterial;
  oliveShutter: THREE.MeshStandardMaterial;
  gravelPath: THREE.MeshStandardMaterial;
  flagstonePath: THREE.MeshStandardMaterial;
  foliageBoxGreen: THREE.MeshStandardMaterial;
  flowerRed: THREE.MeshStandardMaterial;
  flowerGold: THREE.MeshStandardMaterial;
  flowerPink: THREE.MeshStandardMaterial;
  fountainWater: THREE.MeshStandardMaterial;
  windowWhiteWarm: THREE.MeshStandardMaterial;
  windowWhiteSoft: THREE.MeshStandardMaterial;
  windowDarkWarm: THREE.MeshStandardMaterial;
  windowGothic: THREE.MeshStandardMaterial;
  lanternGlass: THREE.MeshStandardMaterial;
  glowSpriteTex: THREE.CanvasTexture;
  lanternSprites: THREE.Sprite[];
  lanternLights: { light: THREE.PointLight; baseIntensity: number }[];
  applyMood: (mood: MoodConfig) => void;
}

export function createVillaMaterials(): VillaMaterialLibrary {
  const graniteTex = createGraniteTextures(101, false);
  const huashilouTex = createGraniteTextures(307, true);
  const redRoofTex = createRedRoofTileTextures(509, 'classic');
  const deepRedRoofTex = createRedRoofTileTextures(733, 'deep');
  const stuccoBump = createStuccoBump(911);
  const redBrickTex = createRedBrickTextures(1213);
  const doorTex = createTimberDoorTextures();
  const greenShutterTex = createLouveredShutterTexture('#2b5037');
  const whiteShutterTex = createLouveredShutterTexture('#eceae2');
  const oliveShutterTex = createLouveredShutterTexture('#556642');

  const winWhiteTex = createMullionedWindowTextures('#f2efe6', 2, 3, false);
  const winDarkTex = createMullionedWindowTextures('#3b2b20', 2, 3, false);
  const winGothicTex = createMullionedWindowTextures('#4a453e', 2, 3, true);

  const windowWhiteWarm = new THREE.MeshStandardMaterial({
    map: winWhiteTex.map,
    emissive: new THREE.Color(0xffb858),
    emissiveMap: winWhiteTex.emissiveMap,
    emissiveIntensity: 0.08,
    roughnessMap: winWhiteTex.roughnessMap,
    roughness: 0.35,
    metalness: 0.15,
  });

  const windowWhiteSoft = new THREE.MeshStandardMaterial({
    map: winWhiteTex.map,
    emissive: new THREE.Color(0xffa94a),
    emissiveMap: winWhiteTex.emissiveMap,
    emissiveIntensity: 0.05,
    roughnessMap: winWhiteTex.roughnessMap,
    roughness: 0.35,
    metalness: 0.15,
  });

  const windowDarkWarm = new THREE.MeshStandardMaterial({
    map: winDarkTex.map,
    emissive: new THREE.Color(0xffb552),
    emissiveMap: winDarkTex.emissiveMap,
    emissiveIntensity: 0.08,
    roughnessMap: winDarkTex.roughnessMap,
    roughness: 0.32,
    metalness: 0.18,
  });

  const windowGothic = new THREE.MeshStandardMaterial({
    map: winGothicTex.map,
    emissive: new THREE.Color(0xffaa44),
    emissiveMap: winGothicTex.emissiveMap,
    emissiveIntensity: 0.1,
    roughnessMap: winGothicTex.roughnessMap,
    roughness: 0.36,
    metalness: 0.16,
  });

  const lanternGlass = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: new THREE.Color(0xffb44c),
    emissiveIntensity: 0.3,
    roughness: 0.25,
    metalness: 0.0,
  });

  const lanternSprites: THREE.Sprite[] = [];
  const lanternLights: { light: THREE.PointLight; baseIntensity: number }[] = [];

  return {
    granite: new THREE.MeshStandardMaterial({
      map: graniteTex.map,
      bumpMap: graniteTex.bumpMap,
      bumpScale: 0.09,
      roughnessMap: graniteTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.04,
    }),
    huashilouStone: new THREE.MeshStandardMaterial({
      map: huashilouTex.map,
      bumpMap: huashilouTex.bumpMap,
      bumpScale: 0.1,
      roughnessMap: huashilouTex.roughnessMap,
      roughness: 0.86,
      metalness: 0.04,
    }),
    carvedLimestone: new THREE.MeshStandardMaterial({
      color: 0xd5ccb8,
      bumpMap: stuccoBump,
      bumpScale: 0.025,
      roughness: 0.78,
      metalness: 0.03,
    }),
    redRoof: new THREE.MeshStandardMaterial({
      map: redRoofTex.map,
      bumpMap: redRoofTex.bumpMap,
      bumpScale: 0.085,
      roughnessMap: redRoofTex.roughnessMap,
      roughness: 0.72,
      metalness: 0.04,
    }),
    deepRedRoof: new THREE.MeshStandardMaterial({
      map: deepRedRoofTex.map,
      bumpMap: deepRedRoofTex.bumpMap,
      bumpScale: 0.085,
      roughnessMap: deepRedRoofTex.roughnessMap,
      roughness: 0.74,
      metalness: 0.04,
    }),
    terracottaRidge: new THREE.MeshStandardMaterial({
      color: 0xa63f2b,
      roughness: 0.72,
      metalness: 0.04,
    }),
    princessBlue: new THREE.MeshStandardMaterial({
      map: createStuccoDiffuse('#82b0cf', 2101, 0.02),
      bumpMap: stuccoBump,
      bumpScale: 0.025,
      roughness: 0.84,
      metalness: 0.02,
    }),
    butterflyOchre: new THREE.MeshStandardMaterial({
      map: createStuccoDiffuse('#dfc28a', 2203, 0.09),
      bumpMap: stuccoBump,
      bumpScale: 0.028,
      roughness: 0.82,
      metalness: 0.02,
    }),
    creamStucco: new THREE.MeshStandardMaterial({
      map: createStuccoDiffuse('#ede3cf', 2309, 0.06),
      bumpMap: stuccoBump,
      bumpScale: 0.025,
      roughness: 0.84,
      metalness: 0.02,
    }),
    peachStucco: new THREE.MeshStandardMaterial({
      map: createStuccoDiffuse('#e4b894', 2411, 0.1),
      bumpMap: stuccoBump,
      bumpScale: 0.026,
      roughness: 0.84,
      metalness: 0.02,
    }),
    ivoryStucco: new THREE.MeshStandardMaterial({
      map: createStuccoDiffuse('#f0e9da', 2503, 0.04),
      bumpMap: stuccoBump,
      bumpScale: 0.024,
      roughness: 0.84,
      metalness: 0.02,
    }),
    redBrick: new THREE.MeshStandardMaterial({
      map: redBrickTex.map,
      bumpMap: redBrickTex.bumpMap,
      bumpScale: 0.065,
      roughness: 0.86,
      metalness: 0.03,
    }),
    whiteTrim: new THREE.MeshStandardMaterial({
      color: 0xf4f1e8,
      roughness: 0.62,
      metalness: 0.02,
    }),
    walnutTimber: new THREE.MeshStandardMaterial({
      color: 0x4b3322,
      roughness: 0.76,
      metalness: 0.04,
    }),
    wroughtIron: new THREE.MeshStandardMaterial({
      color: 0x202426,
      roughness: 0.48,
      metalness: 0.72,
    }),
    weatheredCopper: new THREE.MeshStandardMaterial({
      color: 0x4f786b,
      roughness: 0.52,
      metalness: 0.55,
    }),
    timberDoor: new THREE.MeshStandardMaterial({
      map: doorTex.map,
      bumpMap: doorTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.68,
      metalness: 0.05,
    }),
    greenShutter: new THREE.MeshStandardMaterial({
      map: greenShutterTex.map,
      bumpMap: greenShutterTex.bumpMap,
      bumpScale: 0.035,
      roughness: 0.72,
    }),
    whiteShutter: new THREE.MeshStandardMaterial({
      map: whiteShutterTex.map,
      bumpMap: whiteShutterTex.bumpMap,
      bumpScale: 0.035,
      roughness: 0.68,
    }),
    oliveShutter: new THREE.MeshStandardMaterial({
      map: oliveShutterTex.map,
      bumpMap: oliveShutterTex.bumpMap,
      bumpScale: 0.035,
      roughness: 0.72,
    }),
    gravelPath: new THREE.MeshStandardMaterial({
      map: createCourtyardPavingTexture(false),
      roughness: 0.94,
      metalness: 0.0,
    }),
    flagstonePath: new THREE.MeshStandardMaterial({
      map: createCourtyardPavingTexture(true),
      roughness: 0.88,
      metalness: 0.03,
    }),
    foliageBoxGreen: new THREE.MeshStandardMaterial({
      color: 0x3b6334,
      roughness: 0.85,
    }),
    flowerRed: new THREE.MeshStandardMaterial({
      color: 0xd44038,
      roughness: 0.7,
    }),
    flowerGold: new THREE.MeshStandardMaterial({
      color: 0xeba934,
      roughness: 0.7,
    }),
    flowerPink: new THREE.MeshStandardMaterial({
      color: 0xe67c8c,
      roughness: 0.7,
    }),
    fountainWater: new THREE.MeshStandardMaterial({
      color: 0x4b8799,
      roughness: 0.16,
      metalness: 0.25,
    }),
    windowWhiteWarm,
    windowWhiteSoft,
    windowDarkWarm,
    windowGothic,
    lanternGlass,
    glowSpriteTex: createGlowSpriteTexture(),
    lanternSprites,
    lanternLights,
    applyMood(mood: MoodConfig) {
      const wg = Math.max(0, mood.windowGlow);
      const li = Math.max(0, mood.lampIntensity);

      // Keep windows crisp sky-reflecting dark glass in bright daylight (wg <= 0.10),
      // then ramp warmly through morning_mist (0.38), golden_sunset (0.98), and coastal_night (1.48).
      const winDrive = Math.max(0, (wg - 0.1) / 0.9);
      windowWhiteWarm.emissiveIntensity = winDrive * 1.48;
      windowWhiteSoft.emissiveIntensity = winDrive * 0.86;
      windowDarkWarm.emissiveIntensity = winDrive * 1.42;
      windowGothic.emissiveIntensity = winDrive * 1.65;

      const lanternDrive = Math.max(li, Math.max(0, wg - 0.15) * 0.85);
      lanternGlass.emissiveIntensity = 0.08 + lanternDrive * 2.2;

      const spriteAlpha = Math.min(0.88, lanternDrive * 0.72);
      for (const sp of lanternSprites) {
        sp.visible = spriteAlpha > 0.04;
        (sp.material as THREE.SpriteMaterial).opacity = spriteAlpha;
      }

      for (const entry of lanternLights) {
        entry.light.intensity = entry.baseIntensity * lanternDrive;
        entry.light.visible = entry.light.intensity > 0.05;
      }
    },
  };
}

// ============================================================================
// Reusable High-Craft Architectural Geometry Helpers
// ============================================================================

export function setShadows(obj: THREE.Object3D, cast = true, receive = true): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

/**
 * BoxGeometry with world-scale UV tiling so granite blocks, brick, and stucco
 * never look stretched regardless of wall aspect ratio.
 */
export function createScaledBox(
  w: number,
  h: number,
  d: number,
  tileSizeU = 3.2,
  tileSizeV = 3.2
): THREE.BoxGeometry {
  const geom = new THREE.BoxGeometry(w, h, d);
  const uv = geom.attributes.uv;
  const faceDims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = faceDims[f];
    const su = Math.max(0.15, fw / tileSizeU);
    const sv = Math.max(0.15, fh / tileSizeV);
    for (let v = 0; v < 4; v++) {
      const idx = f * 4 + v;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
  return geom;
}

/**
 * Extruded Gable Roof with solid gable wall triangles, overhanging tiled decks,
 * fascia/bargeboard trims, and terracotta ridge cap.
 */
export function createGableRoof(opts: {
  width: number;
  depth: number;
  ridgeHeight: number;
  overhangEave?: number;
  overhangGable?: number;
  ridgeAlong?: 'x' | 'z';
  roofMat: THREE.Material;
  gableWallMat: THREE.Material;
  trimMat: THREE.Material;
  ridgeMat: THREE.Material;
  tileScale?: number;
}): THREE.Group {
  const {
    width,
    depth,
    ridgeHeight,
    overhangEave = 0.55,
    overhangGable = 0.45,
    ridgeAlong = 'x',
    roofMat,
    gableWallMat,
    trimMat,
    ridgeMat,
    tileScale = 2.6,
  } = opts;

  const group = new THREE.Group();
  const length = ridgeAlong === 'x' ? width : depth;
  const span = ridgeAlong === 'x' ? depth : width;
  const inner = new THREE.Group();
  if (ridgeAlong === 'z') inner.rotation.y = Math.PI / 2;
  group.add(inner);

  const halfSpan = span * 0.5;
  const halfLen = length * 0.5;
  const fullLen = length + overhangGable * 2;
  const slopeRun = halfSpan + overhangEave;
  const slopeRise = ridgeHeight * (slopeRun / halfSpan);
  const slopeLen = Math.hypot(slopeRun, slopeRise);
  const pitchAngle = Math.atan2(ridgeHeight, halfSpan);
  const roofThick = 0.16;

  for (const side of [-1, 1]) {
    const slabGeom = createScaledBox(fullLen, roofThick, slopeLen, tileScale, tileScale);
    const slab = new THREE.Mesh(slabGeom, roofMat);
    const midZ = side * (slopeRun * 0.5);
    const midY = ridgeHeight - slopeRise * 0.5 + roofThick * 0.35;
    slab.position.set(0, midY, midZ);
    slab.rotation.x = side * pitchAngle;
    inner.add(slab);

    const fascia = new THREE.Mesh(new THREE.BoxGeometry(fullLen + 0.04, 0.2, 0.08), trimMat);
    fascia.position.set(0, ridgeHeight - slopeRise + 0.04, side * (slopeRun + 0.03));
    inner.add(fascia);
  }

  // Closed gable triangles
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfSpan, 0);
  gableShape.lineTo(halfSpan, 0);
  gableShape.lineTo(0, ridgeHeight);
  gableShape.closePath();

  const gableGeom = new THREE.ExtrudeGeometry(gableShape, {
    depth: Math.max(0.1, length - 0.04),
    bevelEnabled: false,
  });
  const uv = gableGeom.attributes.uv;
  const pos = gableGeom.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / 3.4, pos.getY(i) / 3.4);
  }
  uv.needsUpdate = true;
  gableGeom.rotateY(Math.PI / 2);
  gableGeom.translate(-halfLen + 0.02, 0, 0);
  inner.add(new THREE.Mesh(gableGeom, gableWallMat));

  // Decorative gable bargeboards
  for (const endX of [-fullLen * 0.5 + 0.05, fullLen * 0.5 - 0.05]) {
    for (const side of [-1, 1]) {
      const barge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, slopeLen + 0.1), trimMat);
      barge.position.set(endX, ridgeHeight - slopeRise * 0.5 + 0.04, side * (slopeRun * 0.5));
      barge.rotation.x = side * pitchAngle;
      inner.add(barge);
    }
  }

  // Terracotta ridge cap beam
  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, fullLen + 0.14, 6),
    ridgeMat
  );
  ridge.rotation.z = Math.PI / 2;
  ridge.position.set(0, ridgeHeight + 0.12, 0);
  inner.add(ridge);

  return group;
}

/**
 * True 4-sided Hipped Roof with clean sloped world-space tile UVs, fascia skirt, and ridge cap.
 */
export function createHippedRoof(opts: {
  width: number;
  depth: number;
  height: number;
  overhang?: number;
  roofMat: THREE.Material;
  trimMat: THREE.Material;
  ridgeMat: THREE.Material;
  tileScale?: number;
}): THREE.Group {
  const { width, depth, height, overhang = 0.65, roofMat, trimMat, ridgeMat, tileScale = 2.6 } =
    opts;
  const group = new THREE.Group();

  const w = width + overhang * 2;
  const d = depth + overhang * 2;
  const hw = w * 0.5;
  const hd = d * 0.5;

  const pFL = new THREE.Vector3(-hw, 0, hd);
  const pFR = new THREE.Vector3(hw, 0, hd);
  const pBR = new THREE.Vector3(hw, 0, -hd);
  const pBL = new THREE.Vector3(-hw, 0, -hd);

  const positions: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    eaveDir: THREE.Vector3
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    const upSlope = new THREE.Vector3().crossVectors(normal, eaveDir).normalize();
    for (const v of [a, b, c]) {
      uvs.push(v.dot(eaveDir) / tileScale, v.dot(upSlope) / tileScale);
    }
  };

  if (w >= d) {
    const ridgeHalfX = Math.max(0.2, (w - d) * 0.5);
    const rL = new THREE.Vector3(-ridgeHalfX, height, 0);
    const rR = new THREE.Vector3(ridgeHalfX, height, 0);
    pushTri(pFL, pFR, rR, new THREE.Vector3(1, 0, 0));
    pushTri(pFL, rR, rL, new THREE.Vector3(1, 0, 0));
    pushTri(pBR, pBL, rL, new THREE.Vector3(-1, 0, 0));
    pushTri(pBR, rL, rR, new THREE.Vector3(-1, 0, 0));
    pushTri(pFR, pBR, rR, new THREE.Vector3(0, 0, -1));
    pushTri(pBL, pFL, rL, new THREE.Vector3(0, 0, 1));

    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, ridgeHalfX * 2 + 0.14, 6),
      ridgeMat
    );
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set(0, height + 0.05, 0);
    group.add(ridge);
  } else {
    const ridgeHalfZ = Math.max(0.2, (d - w) * 0.5);
    const rN = new THREE.Vector3(0, height, -ridgeHalfZ);
    const rS = new THREE.Vector3(0, height, ridgeHalfZ);
    pushTri(pFR, pBR, rN, new THREE.Vector3(0, 0, -1));
    pushTri(pFR, rN, rS, new THREE.Vector3(0, 0, -1));
    pushTri(pBL, pFL, rS, new THREE.Vector3(0, 0, 1));
    pushTri(pBL, rS, rN, new THREE.Vector3(0, 0, 1));
    pushTri(pFL, pFR, rS, new THREE.Vector3(1, 0, 0));
    pushTri(pBR, pBL, rN, new THREE.Vector3(-1, 0, 0));

    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, ridgeHalfZ * 2 + 0.14, 6),
      ridgeMat
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, height + 0.05, 0);
    group.add(ridge);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  group.add(new THREE.Mesh(geom, roofMat));

  const soffit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.18, d + 0.04), trimMat);
  soffit.position.y = -0.07;
  group.add(soffit);

  return group;
}

/**
 * Conical / Octagonal Turret Roof with flared bell skirt & decorative spire finial.
 */
export function createTurretRoof(opts: {
  radius: number;
  height: number;
  segments?: number;
  roofMat: THREE.Material;
  trimMat: THREE.Material;
  finialMat: THREE.Material;
}): THREE.Group {
  const { radius, height, segments = 8, roofMat, trimMat, finialMat } = opts;
  const group = new THREE.Group();

  const skirtH = height * 0.24;
  const midR = radius * 0.72;
  const skirtGeom = new THREE.CylinderGeometry(midR, radius, skirtH, segments);
  const sUv = skirtGeom.attributes.uv;
  for (let i = 0; i < sUv.count; i++) {
    sUv.setXY(i, sUv.getX(i) * (segments * 0.75), sUv.getY(i) * (skirtH / 1.8));
  }
  const skirt = new THREE.Mesh(skirtGeom, roofMat);
  skirt.position.y = skirtH * 0.5;
  group.add(skirt);

  const coneH = height * 0.76;
  const coneGeom = new THREE.ConeGeometry(midR * 1.02, coneH, segments);
  const cUv = coneGeom.attributes.uv;
  for (let i = 0; i < cUv.count; i++) {
    cUv.setXY(i, cUv.getX(i) * (segments * 0.65), cUv.getY(i) * (coneH / 2.2));
  }
  const cone = new THREE.Mesh(coneGeom, roofMat);
  cone.position.y = skirtH + coneH * 0.5 - 0.05;
  group.add(cone);

  const eaveRing = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.99, radius * 0.95, 0.18, segments),
    trimMat
  );
  eaveRing.position.y = -0.06;
  group.add(eaveRing);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 6), finialMat);
  rod.position.y = height + 0.35;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), finialMat);
  orb.position.y = height + 0.22;
  group.add(rod, orb);

  return group;
}

/**
 * Detailed 3D Recessed Architectural Window Assembly
 */
export function createWindowUnit(opts: {
  width: number;
  height: number;
  glassMat: THREE.Material;
  frameMat: THREE.Material;
  shutterMat?: THREE.Material;
  flowerBox?: {
    boxMat: THREE.Material;
    foliageMat: THREE.Material;
    flowerMats: THREE.Material[];
  };
  archedTop?: boolean;
}): THREE.Group {
  const { width, height, glassMat, frameMat, shutterMat, flowerBox, archedTop = false } = opts;
  const g = new THREE.Group();

  const frameT = 0.09;
  const depth = 0.14;

  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.08, height - 0.08), glassMat);
  pane.position.z = 0.035;
  g.add(pane);

  const left = new THREE.Mesh(new THREE.BoxGeometry(frameT, height + 0.06, depth), frameMat);
  left.position.set(-width * 0.5, 0, depth * 0.35);
  const right = left.clone();
  right.position.x = width * 0.5;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(width + frameT * 2 + 0.08, frameT * 1.35, depth * 1.25),
    frameMat
  );
  top.position.set(0, height * 0.5 + 0.03, depth * 0.45);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 0.11, depth * 1.65), frameMat);
  sill.position.set(0, -height * 0.5 - 0.04, depth * 0.6);
  g.add(left, right, top, sill);

  if (archedTop) {
    const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, depth * 1.55), frameMat);
    keystone.position.set(0, height * 0.5 + 0.08, depth * 0.55);
    g.add(keystone);
  }

  if (shutterMat) {
    const sw = width * 0.46;
    const sh = height - 0.02;
    const shutterGeom = new THREE.BoxGeometry(sw, sh, 0.05);
    const sL = new THREE.Mesh(shutterGeom, shutterMat);
    sL.position.set(-width * 0.5 - sw * 0.52, 0, 0.09);
    sL.rotation.y = 0.14;
    const sR = new THREE.Mesh(shutterGeom, shutterMat);
    sR.position.set(width * 0.5 + sw * 0.52, 0, 0.09);
    sR.rotation.y = -0.14;
    g.add(sL, sR);
  }

  if (flowerBox) {
    const bxW = width + 0.14;
    const box = new THREE.Mesh(new THREE.BoxGeometry(bxW, 0.2, 0.24), flowerBox.boxMat);
    box.position.set(0, -height * 0.5 - 0.18, 0.15);
    g.add(box);

    const moundCount = Math.max(3, Math.round(width * 3));
    for (let i = 0; i < moundCount; i++) {
      const t = (i + 0.5) / moundCount - 0.5;
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), flowerBox.foliageMat);
      leaf.scale.set(1.2, 0.8, 0.9);
      leaf.position.set(t * (bxW - 0.14), -height * 0.5 - 0.05, 0.17 + (i % 2) * 0.03);
      g.add(leaf);

      const fMat = flowerBox.flowerMats[i % flowerBox.flowerMats.length];
      const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 0), fMat);
      blossom.position.set(
        t * (bxW - 0.16) + ((i % 2) - 0.5) * 0.04,
        -height * 0.5 + 0.02,
        0.21
      );
      g.add(blossom);
    }
  }

  return g;
}

/**
 * Charming Roof Dormer Window with miniature red-tiled pitched gable roof.
 */
export function createDormerUnit(opts: {
  width: number;
  height: number;
  depth: number;
  wallMat: THREE.Material;
  roofMat: THREE.Material;
  trimMat: THREE.Material;
  ridgeMat: THREE.Material;
  glassMat: THREE.Material;
}): THREE.Group {
  const { width, height, depth, wallMat, roofMat, trimMat, ridgeMat, glassMat } = opts;
  const g = new THREE.Group();

  const body = new THREE.Mesh(createScaledBox(width, height, depth, 2.5, 2.5), wallMat);
  body.position.set(0, height * 0.5, -depth * 0.5);
  g.add(body);

  const roof = createGableRoof({
    width: width + 0.04,
    depth: depth + 0.35,
    ridgeHeight: width * 0.52,
    overhangEave: 0.22,
    overhangGable: 0.22,
    ridgeAlong: 'z',
    roofMat,
    gableWallMat: wallMat,
    trimMat,
    ridgeMat,
    tileScale: 2.0,
  });
  roof.position.set(0, height - 0.04, -depth * 0.5 + 0.1);
  g.add(roof);

  const win = createWindowUnit({
    width: width * 0.64,
    height: height * 0.68,
    glassMat,
    frameMat: trimMat,
  });
  win.position.set(0, height * 0.5, 0.01);
  g.add(win);

  return g;
}

/**
 * Vintage Porch / Gate Lantern with glowing frosted globe, halo sprite, and optional PointLight.
 */
export function createLantern(
  mats: VillaMaterialLibrary,
  style: 'globe' | 'hex' = 'hex',
  addLight = false,
  lightIntensity = 2.8,
  lightDistance = 13
): THREE.Group {
  const g = new THREE.Group();

  if (style === 'globe') {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.14, 8),
      mats.wroughtIron
    );
    collar.position.y = 0.07;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.lanternGlass);
    globe.position.y = 0.3;
    g.add(collar, globe);
  } else {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6), mats.wroughtIron);
    cap.position.y = 0.36;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.11, 0.28, 6),
      mats.lanternGlass
    );
    glass.position.y = 0.18;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.06, 0.09, 6),
      mats.wroughtIron
    );
    base.position.y = 0.02;
    g.add(cap, glass, base);
  }

  const spriteMat = new THREE.SpriteMaterial({
    map: mats.glowSpriteTex,
    color: 0xffc66e,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 0.25;
  sprite.scale.set(1.5, 1.5, 1);
  sprite.visible = false;
  g.add(sprite);
  mats.lanternSprites.push(sprite);

  if (addLight) {
    const light = new THREE.PointLight(0xffb75c, 0, lightDistance, 1.8);
    light.position.y = 0.25;
    light.visible = false;
    g.add(light);
    mats.lanternLights.push({ light, baseIntensity: lightIntensity });
  }

  return g;
}

/**
 * Framed Heritage Enamel / Bronze Plaque Mesh
 */
export function createPlaqueMesh(
  title: string,
  subtitle: string,
  width = 1.15,
  height = 0.44,
  style: 'bronze' | 'enamel' = 'bronze'
): THREE.Group {
  const g = new THREE.Group();
  const tex = createPlaqueTexture(title, subtitle, style);
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.05),
    new THREE.MeshStandardMaterial({
      color: style === 'bronze' ? 0x3b2c1d : 0x1a2634,
      roughness: 0.55,
      metalness: 0.45,
    })
  );
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.25 })
  );
  face.position.z = 0.028;
  g.add(backing, face);
  return g;
}

/**
 * Terrain-conforming curved courtyard garden path (flagstone or gravel ribbon)
 * built from smooth world-height-sampled quad strips so it NEVER floats or z-fights on slopes.
 */
export function createTerrainConformingPath(
  ctx: WorldContext,
  points: [number, number][],
  width: number,
  mat: THREE.Material,
  yOffset = 0.045,
  tileScale = 2.0
): THREE.Mesh {
  const halfW = width * 0.5;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let accumLen = 0;

  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    if (i > 0) {
      accumLen += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    }
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // Perpendicular vector
    const nx = -tz;
    const nz = tx;

    const lx = x + nx * halfW;
    const lz = z + nz * halfW;
    const rx = x - nx * halfW;
    const rz = z - nz * halfW;

    const ly = ctx.getTerrainHeight(lx, lz) + yOffset;
    const ry = ctx.getTerrainHeight(rx, rz) + yOffset;

    positions.push(lx, ly, lz, rx, ry, rz);
    uvs.push(0, accumLen / tileScale, width / tileScale, accumLen / tileScale);

    if (i > 0) {
      const a = (i - 1) * 2;
      const b = a + 1;
      const c = i * 2;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

/**
 * Grounded Qingdao Granite Courtyard Wall Run with Coping, Optional Picket or Iron Grille,
 * Rhythmic Piers, and Automatic Colliders.
 */
export function createGraniteWallRun(
  ctx: WorldContext,
  mats: VillaMaterialLibrary,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  opts: {
    stoneHeight: number;
    thickness?: number;
    topFence?: 'none' | 'picket' | 'iron';
    fenceHeight?: number;
    pierSpacing?: number;
    endPiers?: boolean;
    embedDepth?: number;
    wallMat?: THREE.Material;
    colliders?: Collider[];
  }
): THREE.Group {
  const {
    stoneHeight,
    thickness = 0.42,
    topFence = 'none',
    fenceHeight = 0.82,
    pierSpacing = 6.5,
    endPiers = true,
    embedDepth = 1.9,
    wallMat = mats.granite,
    colliders,
  } = opts;

  const group = new THREE.Group();
  const dx = x2 - x1;
  const dz = z2 - z1;
  const totalLen = Math.hypot(dx, dz);
  if (totalLen < 0.2) return group;

  const angle = Math.atan2(dx, dz);
  const segCount = Math.max(1, Math.round(totalLen / pierSpacing));
  const segLen = totalLen / segCount;

  for (let i = 0; i < segCount; i++) {
    const t0 = i / segCount;
    const t1 = (i + 1) / segCount;
    const tm = (t0 + t1) * 0.5;
    const sx = x1 + dx * tm;
    const sz = z1 + dz * tm;
    const h0 = ctx.getTerrainHeight(x1 + dx * t0, z1 + dz * t0);
    const h1 = ctx.getTerrainHeight(x1 + dx * t1, z1 + dz * t1);
    const hm = ctx.getTerrainHeight(sx, sz);
    const topY = Math.max(h0, h1, hm) + stoneHeight;
    const botY = Math.min(h0, h1, hm) - embedDepth;
    const actualH = topY - botY;

    const bayGroup = new THREE.Group();
    bayGroup.position.set(sx, 0, sz);
    bayGroup.rotation.y = angle;

    const wallMesh = new THREE.Mesh(
      createScaledBox(thickness, actualH, segLen, 2.6, 2.2),
      wallMat
    );
    wallMesh.position.y = botY + actualH * 0.5;
    bayGroup.add(wallMesh);

    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(thickness + 0.12, 0.12, segLen + 0.04),
      mats.carvedLimestone
    );
    coping.position.y = topY + 0.05;
    bayGroup.add(coping);

    if (topFence === 'picket') {
      const railTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, segLen - 0.1),
        mats.whiteTrim
      );
      railTop.position.y = topY + fenceHeight - 0.14;
      const railBot = railTop.clone();
      railBot.position.y = topY + 0.2;
      bayGroup.add(railTop, railBot);

      const picketSpacing = 0.24;
      const pCount = Math.max(2, Math.floor((segLen - 0.35) / picketSpacing));
      const picketGeom = new THREE.BoxGeometry(0.04, fenceHeight, 0.11);
      for (let p = 0; p < pCount; p++) {
        const pz = -segLen * 0.5 + 0.25 + (p / Math.max(1, pCount - 1)) * (segLen - 0.5);
        const picket = new THREE.Mesh(picketGeom, mats.whiteTrim);
        picket.position.set(0, topY + fenceHeight * 0.5 + 0.04, pz);
        bayGroup.add(picket);
      }
    } else if (topFence === 'iron') {
      const railTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.045, segLen - 0.1),
        mats.wroughtIron
      );
      railTop.position.y = topY + fenceHeight - 0.1;
      const railBot = railTop.clone();
      railBot.position.y = topY + 0.16;
      bayGroup.add(railTop, railBot);

      const barSpacing = 0.24;
      const bCount = Math.max(2, Math.floor((segLen - 0.35) / barSpacing));
      const barGeom = new THREE.CylinderGeometry(0.016, 0.016, fenceHeight, 5);
      for (let p = 0; p < bCount; p++) {
        const bz = -segLen * 0.5 + 0.25 + (p / Math.max(1, bCount - 1)) * (segLen - 0.5);
        const bar = new THREE.Mesh(barGeom, mats.wroughtIron);
        bar.position.set(0, topY + fenceHeight * 0.5 + 0.05, bz);
        bayGroup.add(bar);
      }
    }

    group.add(bayGroup);
  }

  const pierStart = endPiers ? 0 : 1;
  const pierEnd = endPiers ? segCount : segCount - 1;
  const pierExtraH = topFence === 'none' ? 0.22 : fenceHeight + 0.18;
  for (let i = pierStart; i <= pierEnd; i++) {
    const t = i / segCount;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    const py = ctx.getTerrainHeight(px, pz);
    const pTop = py + stoneHeight + pierExtraH;
    const pBot = py - embedDepth;
    const pH = pTop - pBot;

    const pier = new THREE.Mesh(
      createScaledBox(thickness + 0.24, pH, thickness + 0.24, 2.2, 2.2),
      wallMat
    );
    pier.position.set(px, pBot + pH * 0.5, pz);
    pier.rotation.y = angle;
    group.add(pier);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(thickness + 0.36, 0.14, thickness + 0.36),
      mats.carvedLimestone
    );
    cap.position.set(px, pTop + 0.06, pz);
    cap.rotation.y = angle;
    group.add(cap);
  }

  if (colliders) {
    const isAxisAligned = Math.abs(dx) < 0.05 || Math.abs(dz) < 0.05;
    const pad = thickness * 0.5 + 0.15;
    if (isAxisAligned) {
      colliders.push({
        type: 'box',
        minX: Math.min(x1, x2) - pad,
        maxX: Math.max(x1, x2) + pad,
        minZ: Math.min(z1, z2) - pad,
        maxZ: Math.max(z1, z2) + pad,
      });
    } else {
      const steps = Math.max(2, Math.ceil(totalLen / 1.4));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        colliders.push({
          type: 'cylinder',
          x: x1 + dx * t,
          z: z1 + dz * t,
          radius: pad + 0.15,
        });
      }
    }
  }

  setShadows(group, true, true);
  return group;
}

/**
 * Transform local (lx, lz) in a Y-rotated building group to world (x, z).
 */
export function localToWorldXZ(
  cx: number,
  cz: number,
  rotY: number,
  lx: number,
  lz: number
): [number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}
