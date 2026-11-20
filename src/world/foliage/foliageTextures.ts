import * as THREE from 'three';

export interface FoliageTextureSet {
  ginkgoCluster: THREE.CanvasTexture;
  mapleCluster: THREE.CanvasTexture;
  planeCluster: THREE.CanvasTexture;
  pineBough: THREE.CanvasTexture;
  ivyCluster: THREE.CanvasTexture;
  shrubCluster: THREE.CanvasTexture;

  barkGinkgo: THREE.CanvasTexture;
  barkMaple: THREE.CanvasTexture;
  barkPlane: THREE.CanvasTexture;
  barkPine: THREE.CanvasTexture;

  fallenGinkgoCarpet: THREE.CanvasTexture;
  fallenMapleCarpet: THREE.CanvasTexture;

  singleGinkgoLeaf: THREE.CanvasTexture;
  singleMapleLeaf: THREE.CanvasTexture;

  lampGlow: THREE.CanvasTexture;
  mistPuff: THREE.CanvasTexture;
  woodSlat: THREE.CanvasTexture;
  postboxBody: THREE.CanvasTexture;
}

/** Deterministic PRNG (mulberry32) so procedural textures are crisp and reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dilates RGB from opaque pixels into adjacent transparent pixels so mipmaps on
 * alphaTest foliage never develop dark black-fringe outlines.
 */
function bleedAlphaEdges(ctx: CanvasRenderingContext2D, w: number, h: number, passes = 5): void {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const copy = new Uint8ClampedArray(data);

  for (let p = 0; p < passes; p++) {
    copy.set(data);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx + 3] > 10) continue;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w || (dx === 0 && dy === 0)) continue;
            const nIdx = (ny * w + nx) * 4;
            if (
              copy[nIdx + 3] > 20 ||
              (p > 0 && (copy[nIdx] | copy[nIdx + 1] | copy[nIdx + 2]) !== 0)
            ) {
              r += copy[nIdx];
              g += copy[nIdx + 1];
              b += copy[nIdx + 2];
              count++;
            }
          }
        }

        if (count > 0) {
          data[idx] = Math.round(r / count);
          data[idx + 1] = Math.round(g / count);
          data[idx + 2] = Math.round(b / count);
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
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
  options: { srgb?: boolean; repeat?: boolean; repeatX?: number; repeatY?: number } = {}
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (options.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Draws a single botanical fan-shaped Ginkgo biloba leaf centered at its stem base. */
function drawGinkgoLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  baseHex: string,
  tipHex: string,
  veinHex: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.strokeStyle = '#997a26';
  ctx.lineWidth = Math.max(1.2, size * 0.055);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.24);
  ctx.lineTo(0, 0);
  ctx.stroke();

  const grad = ctx.createRadialGradient(0, 0, size * 0.08, 0, -size * 0.55, size * 1.05);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.76, tipHex);
  grad.addColorStop(1, '#fff3a8');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.45, -size * 0.36, -size * 0.78, -size * 0.76);
  ctx.bezierCurveTo(-size * 0.65, -size * 1.06, -size * 0.25, -size * 1.08, -size * 0.06, -size * 0.88);
  ctx.lineTo(0, -size * 0.68);
  ctx.lineTo(size * 0.06, -size * 0.88);
  ctx.bezierCurveTo(size * 0.25, -size * 1.08, size * 0.65, -size * 1.06, size * 0.78, -size * 0.76);
  ctx.quadraticCurveTo(size * 0.45, -size * 0.36, 0, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = veinHex;
  ctx.lineWidth = Math.max(0.7, size * 0.022);
  ctx.globalAlpha = 0.42;
  for (let i = -4; i <= 4; i++) {
    const a = (i / 4.8) * 0.92;
    const len = size * (0.82 - Math.abs(i) * 0.025);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.04);
    ctx.lineTo(Math.sin(a) * len, -Math.cos(a) * len);
    ctx.stroke();
  }

  ctx.restore();
}

/** Draws a crisp 5-pointed star-shaped Maple leaf (五角楓). */
function drawMapleLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  innerHex: string,
  outerHex: string,
  veinHex: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.strokeStyle = '#6c2a1b';
  ctx.lineWidth = Math.max(1.2, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.28);
  ctx.lineTo(0, 0);
  ctx.stroke();

  const grad = ctx.createRadialGradient(0, -size * 0.2, size * 0.05, 0, -size * 0.3, size * 1.05);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.75, outerHex);
  grad.addColorStop(1, outerHex);

  const lobes = [
    { a: -1.95, r: 0.56 },
    { a: -1.02, r: 0.88 },
    { a: 0.0, r: 1.05 },
    { a: 1.02, r: 0.88 },
    { a: 1.95, r: 0.56 },
  ];

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.04);

  for (let i = 0; i < lobes.length; i++) {
    const l = lobes[i];
    const tipX = Math.sin(l.a) * size * l.r;
    const tipY = -Math.cos(l.a) * size * l.r;
    const prevA = l.a - 0.34;
    const nextA = l.a + 0.34;
    const midR = size * l.r * 0.62;

    if (i === 0) {
      ctx.lineTo(Math.sin(prevA) * size * 0.28, -Math.cos(prevA) * size * 0.28);
    }
    ctx.quadraticCurveTo(
      Math.sin(l.a - 0.22) * midR,
      -Math.cos(l.a - 0.22) * midR,
      tipX,
      tipY
    );
    const sinusA = i < lobes.length - 1 ? (l.a + lobes[i + 1].a) * 0.5 : l.a + 0.42;
    const sinusR = i < lobes.length - 1 ? size * 0.36 : size * 0.22;
    ctx.quadraticCurveTo(
      Math.sin(nextA) * midR * 0.92,
      -Math.cos(nextA) * midR * 0.92,
      Math.sin(sinusA) * sinusR,
      -Math.cos(sinusA) * sinusR
    );
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = veinHex;
  ctx.lineWidth = Math.max(0.8, size * 0.025);
  ctx.globalAlpha = 0.52;
  for (const l of lobes) {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.02);
    ctx.lineTo(Math.sin(l.a) * size * l.r * 0.85, -Math.cos(l.a) * size * l.r * 0.85);
    ctx.stroke();
  }

  ctx.restore();
}

/** Draws a broad palmate London Plane / Sycamore autumn leaf (法國梧桐). */
function drawPlaneLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  c1: string,
  c2: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const grad = ctx.createRadialGradient(0, -size * 0.15, size * 0.06, 0, -size * 0.25, size * 1.0);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;

  const pts: [number, number][] = [
    [-0.18, 0.06],
    [-0.74, -0.05],
    [-0.58, -0.32],
    [-0.96, -0.58],
    [-0.48, -0.68],
    [-0.46, -0.92],
    [-0.18, -0.82],
    [0.0, -1.08],
    [0.18, -0.82],
    [0.46, -0.92],
    [0.48, -0.68],
    [0.96, -0.58],
    [0.58, -0.32],
    [0.74, -0.05],
    [0.18, 0.06],
  ];

  ctx.beginPath();
  ctx.moveTo(pts[0][0] * size, pts[0][1] * size);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0] * size, pts[i][1] * size);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#5e4a22';
  ctx.lineWidth = Math.max(0.9, size * 0.025);
  ctx.globalAlpha = 0.42;
  const veinAngles = [-1.45, -0.78, 0, 0.78, 1.45];
  for (const va of veinAngles) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(va) * size * 0.8, -Math.cos(va) * size * 0.8);
    ctx.stroke();
  }

  ctx.restore();
}

function createGinkgoClusterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(1017);

  ctx.strokeStyle = '#6f5939';
  ctx.lineCap = 'round';
  const branches: [number, number, number, number, number][] = [
    [256, 468, 256, 250, 7],
    [256, 360, 148, 232, 4.5],
    [256, 340, 368, 224, 4.5],
    [256, 260, 178, 134, 3.8],
    [256, 255, 340, 140, 3.8],
    [256, 250, 252, 92, 3.5],
  ];
  for (const [x1, y1, x2, y2, w] of branches) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) * 0.5 + (rand() - 0.5) * 24, (y1 + y2) * 0.5, x2, y2);
    ctx.stroke();
  }

  const palettes: [string, string, string][] = [
    ['#d99316', '#f7c52e', '#b3710d'],
    ['#e0a41a', '#ffd94a', '#b88212'],
    ['#cc8212', '#f0b126', '#9e5d0c'],
    ['#e6b622', '#ffe66e', '#ba8a16'],
    ['#c99c26', '#ebd14d', '#9e7816'],
  ];

  for (let i = 0; i < 54; i++) {
    const r = Math.pow(rand(), 0.62) * 168;
    const theta = rand() * Math.PI * 2;
    const cx = 256 + Math.cos(theta) * r * 1.04;
    const cy = 248 + Math.sin(theta) * r * 0.96;
    const size = 58 + rand() * 38;
    const angle = theta + Math.PI * 0.5 + (rand() - 0.5) * 1.1;
    const pal = palettes[Math.floor(rand() * palettes.length)];
    drawGinkgoLeaf(ctx, cx, cy, size, angle, pal[0], pal[1], pal[2]);
  }

  bleedAlphaEdges(ctx, 512, 512, 6);
  return finalizeTexture(canvas);
}

function createMapleClusterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(2049);

  ctx.strokeStyle = '#53352b';
  ctx.lineCap = 'round';
  const twigs: [number, number, number, number, number][] = [
    [256, 465, 256, 245, 6],
    [256, 355, 138, 228, 4],
    [256, 345, 376, 224, 4],
    [256, 260, 165, 136, 3.2],
    [256, 255, 348, 136, 3.2],
  ];
  for (const [x1, y1, x2, y2, w] of twigs) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const palettes: [string, string, string][] = [
    ['#9a1614', '#d8291c', '#6e0d0c'],
    ['#b82214', '#ea431d', '#7a120a'],
    ['#c93516', '#f26a22', '#8f240c'],
    ['#861214', '#bf1e1c', '#570a0c'],
    ['#d9581a', '#f7952a', '#993a0d'],
  ];

  for (let i = 0; i < 46; i++) {
    const r = Math.pow(rand(), 0.62) * 164;
    const theta = rand() * Math.PI * 2;
    const cx = 256 + Math.cos(theta) * r * 1.03;
    const cy = 248 + Math.sin(theta) * r * 0.96;
    const size = 62 + rand() * 40;
    const angle = theta + Math.PI * 0.5 + (rand() - 0.5) * 1.25;
    const pal = palettes[Math.floor(rand() * palettes.length)];
    drawMapleLeaf(ctx, cx, cy, size, angle, pal[0], pal[1], pal[2]);
  }

  bleedAlphaEdges(ctx, 512, 512, 6);
  return finalizeTexture(canvas);
}

function createPlaneClusterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(3097);

  ctx.strokeStyle = '#63533d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(256, 460);
  ctx.lineTo(256, 175);
  ctx.moveTo(256, 340);
  ctx.lineTo(148, 225);
  ctx.moveTo(256, 330);
  ctx.lineTo(362, 220);
  ctx.stroke();

  const palettes: [string, string][] = [
    ['#8d8734', '#c9b442'],
    ['#a6832c', '#d8a63c'],
    ['#9c6426', '#c88032'],
    ['#6f7b35', '#a9a444'],
    ['#b39434', '#e0be4e'],
  ];

  for (let i = 0; i < 38; i++) {
    const r = Math.pow(rand(), 0.63) * 160;
    const theta = rand() * Math.PI * 2;
    const cx = 256 + Math.cos(theta) * r;
    const cy = 248 + Math.sin(theta) * r * 0.95;
    const size = 72 + rand() * 42;
    const angle = theta + Math.PI * 0.5 + (rand() - 0.5) * 1.2;
    const pal = palettes[Math.floor(rand() * palettes.length)];
    drawPlaneLeaf(ctx, cx, cy, size, angle, pal[0], pal[1]);
  }

  bleedAlphaEdges(ctx, 512, 512, 6);
  return finalizeTexture(canvas);
}

function createPineBoughTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(4123);

  ctx.strokeStyle = '#4f3527';
  ctx.lineCap = 'round';
  const stems: [number, number, number, number, number][] = [
    [256, 420, 256, 130, 8],
    [256, 320, 128, 210, 5],
    [256, 315, 386, 205, 5],
    [256, 235, 152, 135, 4],
    [256, 235, 362, 135, 4],
  ];
  for (const [x1, y1, x2, y2, w] of stems) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const needleColors = [
    '#143322',
    '#1b432b',
    '#225234',
    '#2b633e',
    '#347247',
    '#193b27',
  ];

  for (let c = 0; c < 38; c++) {
    const rad = Math.pow(rand(), 0.6) * 160;
    const ang = rand() * Math.PI * 2;
    const cx = 256 + Math.cos(ang) * rad * 1.05;
    const cy = 248 + Math.sin(ang) * rad * 0.92;
    const needleCount = 36 + Math.floor(rand() * 18);
    const tuftRadius = 44 + rand() * 34;

    ctx.fillStyle = '#163724';
    ctx.beginPath();
    ctx.arc(cx, cy, tuftRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    for (let n = 0; n < needleCount; n++) {
      const na = (n / needleCount) * Math.PI * 2 + (rand() - 0.5) * 0.16;
      const len = tuftRadius * (0.68 + rand() * 0.42);
      ctx.strokeStyle = needleColors[Math.floor(rand() * needleColors.length)];
      ctx.lineWidth = 2.1 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(na) * 4, cy + Math.sin(na) * 4);
      ctx.lineTo(cx + Math.cos(na) * len, cy + Math.sin(na) * len);
      ctx.stroke();
    }
  }

  bleedAlphaEdges(ctx, 512, 512, 6);
  return finalizeTexture(canvas);
}

function createIvyClusterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(5177);

  ctx.strokeStyle = '#4e3528';
  for (let v = 0; v < 7; v++) {
    const startX = 76 + v * 60 + (rand() - 0.5) * 20;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(startX, 18);
    ctx.bezierCurveTo(
      startX + (rand() - 0.5) * 40,
      160,
      startX + (rand() - 0.5) * 48,
      320,
      startX + (rand() - 0.5) * 35,
      460 - rand() * 90
    );
    ctx.stroke();
  }

  const ivyColors: [string, string][] = [
    ['#2a5428', '#3c6e32'],
    ['#546b28', '#83872e'],
    ['#9e2e1d', '#cf4824'],
    ['#871a1c', '#bf2826'],
    ['#b8481d', '#df762a'],
    ['#6c1b22', '#9e282b'],
  ];

  for (let i = 0; i < 115; i++) {
    const x = 44 + rand() * 424;
    const y = 28 + rand() * 432;
    const edgeFade = Math.abs(x - 256) / 230;
    if (y > 460 - edgeFade * 150) continue;

    const colorBias = Math.min(0.99, (y / 480) * 0.55 + rand() * 0.55);
    const pal = ivyColors[Math.floor(colorBias * ivyColors.length)];
    const size = 28 + rand() * 24;
    const angle = Math.PI + (rand() - 0.5) * 1.4;
    drawMapleLeaf(ctx, x, y, size, angle, pal[0], pal[1], '#4d1914');
  }

  bleedAlphaEdges(ctx, 512, 512, 6);
  return finalizeTexture(canvas);
}

function createShrubClusterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(6011);

  const greens = ['#224d29', '#2c5e31', '#387039', '#457e40', '#1c4023'];
  const hydrangeaBlossoms = ['#d8c4a8', '#b8c8d8', '#c9a6b0', '#e5d4b8'];

  for (let i = 0; i < 150; i++) {
    const r = Math.pow(rand(), 0.58) * 185;
    const a = rand() * Math.PI * 2;
    const x = 256 + Math.cos(a) * r;
    const y = 256 + Math.sin(a) * r;
    const w = 18 + rand() * 18;
    const h = 30 + rand() * 22;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + (rand() - 0.5) * 1.0);
    ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let b = 0; b < 5; b++) {
    const br = 45 + rand() * 95;
    const ba = rand() * Math.PI * 2;
    const bx = 256 + Math.cos(ba) * br;
    const by = 256 + Math.sin(ba) * br;
    const col = hydrangeaBlossoms[Math.floor(rand() * hydrangeaBlossoms.length)];
    for (let f = 0; f < 14; f++) {
      const fx = bx + (rand() - 0.5) * 32;
      const fy = by + (rand() - 0.5) * 32;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(fx, fy, 4 + rand() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  bleedAlphaEdges(ctx, 512, 512, 5);
  return finalizeTexture(canvas);
}

function createBarkTexture(species: 'ginkgo' | 'maple' | 'plane' | 'pine'): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  const rand = mulberry32(
    species === 'ginkgo' ? 71 : species === 'maple' ? 83 : species === 'plane' ? 97 : 113
  );

  if (species === 'plane') {
    ctx.fillStyle = '#8b836b';
    ctx.fillRect(0, 0, 256, 512);
    const patchColors = ['#b9b092', '#9b9678', '#6e6a56', '#7a7e64', '#5c5848', '#c7be9e'];
    for (let i = 0; i < 65; i++) {
      const px = rand() * 256;
      const py = rand() * 512;
      const rx = 18 + rand() * 44;
      const ry = 28 + rand() * 76;
      ctx.fillStyle = patchColors[Math.floor(rand() * patchColors.length)];
      for (const ox of [-256, 0, 256]) {
        for (const oy of [-512, 0, 512]) {
          ctx.beginPath();
          ctx.ellipse(px + ox, py + oy, rx, ry, (rand() - 0.5) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    const baseColor =
      species === 'ginkgo' ? '#5b4e42' : species === 'maple' ? '#5e5854' : '#3d302a';
    const ridgeDark =
      species === 'ginkgo' ? '#392f26' : species === 'maple' ? '#403b38' : '#231a16';
    const ridgeLight =
      species === 'ginkgo' ? '#776858' : species === 'maple' ? '#7c756e' : '#5a4438';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 512);

    const furrowCount = species === 'pine' ? 95 : 130;
    for (let i = 0; i < furrowCount; i++) {
      const x = rand() * 256;
      const y = rand() * 512;
      const h = 45 + rand() * 140;
      const w = species === 'pine' ? 4 + rand() * 9 : 2 + rand() * 5;
      ctx.fillStyle = rand() > 0.45 ? ridgeDark : ridgeLight;
      ctx.globalAlpha = 0.52;
      ctx.fillRect(x, y, w, h);
      if (y + h > 512) ctx.fillRect(x, y - 512, w, h);
    }
    ctx.globalAlpha = 1;

    if (species === 'pine') {
      ctx.strokeStyle = '#1c1410';
      ctx.lineWidth = 2;
      for (let i = 0; i < 42; i++) {
        const x = rand() * 256;
        const y = rand() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12 + rand() * 22, y + (rand() - 0.5) * 6);
        ctx.stroke();
      }
    }
  }

  return finalizeTexture(canvas, { repeat: true, repeatX: 1, repeatY: 2 });
}

function createFallenLeafCarpetTexture(type: 'ginkgo' | 'maple'): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const rand = mulberry32(type === 'ginkgo' ? 881 : 991);

  const ginkgoPals: [string, string, string][] = [
    ['#d49014', '#f7c834', '#9e620c'],
    ['#c98112', '#edb224', '#8f520a'],
    ['#e0aa20', '#ffe056', '#aa7712'],
    ['#b87314', '#d99622', '#7e480a'],
  ];
  const maplePals: [string, string, string][] = [
    ['#981814', '#d82e1e', '#660c0a'],
    ['#b22a16', '#ea5222', '#7d180a'],
    ['#7f1414', '#b8221e', '#520a0a'],
    ['#c9541a', '#ef8428', '#8a340e'],
  ];

  const count = 230;
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rand(), 0.72) * 218;
    const theta = rand() * Math.PI * 2;
    const x = 256 + Math.cos(theta) * r;
    const y = 256 + Math.sin(theta) * r;
    const size = (type === 'ginkgo' ? 20 : 22) + rand() * 18;
    const angle = rand() * Math.PI * 2;

    ctx.save();
    ctx.fillStyle = 'rgba(42, 24, 10, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, size * 0.52, size * 0.42, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (type === 'ginkgo') {
      const pal = ginkgoPals[Math.floor(rand() * ginkgoPals.length)];
      drawGinkgoLeaf(ctx, x, y, size, angle, pal[0], pal[1], pal[2]);
    } else {
      const pal = maplePals[Math.floor(rand() * maplePals.length)];
      drawMapleLeaf(ctx, x, y, size, angle, pal[0], pal[1], pal[2]);
    }
  }

  bleedAlphaEdges(ctx, 512, 512, 4);
  return finalizeTexture(canvas);
}

function createSingleLeafTexture(type: 'ginkgo' | 'maple'): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  if (type === 'ginkgo') {
    drawGinkgoLeaf(ctx, 64, 108, 86, 0, '#db9b18', '#ffd94a', '#a86e0c');
  } else {
    drawMapleLeaf(ctx, 64, 98, 78, 0, '#aa1e16', '#ef4b20', '#70100a');
  }
  bleedAlphaEdges(ctx, 128, 128, 4);
  return finalizeTexture(canvas);
}

function createGlowSpriteTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 2, 128, 128, 126);
  grad.addColorStop(0.0, 'rgba(255, 248, 224, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 214, 138, 0.78)');
  grad.addColorStop(0.45, 'rgba(255, 174, 84, 0.28)');
  grad.addColorStop(0.75, 'rgba(255, 146, 56, 0.06)');
  grad.addColorStop(1.0, 'rgba(255, 130, 40, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return finalizeTexture(canvas);
}

function createMistPuffTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rand = mulberry32(404);

  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 52;
    const cx = 128 + Math.cos(a) * d;
    const cy = 128 + Math.sin(a) * d * 0.72;
    const r = 46 + rand() * 52;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    g.addColorStop(0.55, 'rgba(245, 250, 255, 0.10)');
    g.addColorStop(1, 'rgba(240, 248, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(128, 128, 24, 128, 128, 124);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.62, 'rgba(255,255,255,0.68)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 256, 256);

  return finalizeTexture(canvas);
}

function createWoodSlatTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  const rand = mulberry32(733);
  ctx.fillStyle = '#8b5732';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 90; i++) {
    const y = rand() * 128;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(62, 34, 16, 0.35)' : 'rgba(176, 120, 74, 0.28)';
    ctx.lineWidth = 1 + rand() * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y + (rand() - 0.5) * 6, 170, y + (rand() - 0.5) * 6, 256, y);
    ctx.stroke();
  }
  return finalizeTexture(canvas, { repeat: true });
}

function createPostboxTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#154e33';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#d9b54a';
  ctx.fillRect(0, 96, 512, 10);
  ctx.fillRect(0, 412, 512, 10);

  ctx.fillStyle = '#f2f5ee';
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.fillText('中國郵政', 256, 232);
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('CHINA POST', 256, 272);

  ctx.strokeStyle = '#d9b54a';
  ctx.lineWidth = 3;
  ctx.strokeRect(156, 172, 200, 122);

  ctx.font = '20px "PingFang SC", sans-serif';
  ctx.fillStyle = '#d8e3da';
  ctx.fillText('八大關郵局', 256, 355);

  return finalizeTexture(canvas);
}

/** Authentic Qingdao blue-and-white enameled street sign texture. */
export function createStreetSignTexture(zhName: string, enName: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 192);

  ctx.fillStyle = '#11447a';
  ctx.fillRect(0, 0, 512, 192);

  const sheen = ctx.createLinearGradient(0, 0, 0, 192);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 192);

  ctx.strokeStyle = '#f6f8fa';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 472, 152);

  ctx.fillStyle = '#dce8f6';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillText('青島 · 八大關歷史文化街區', 256, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px "Noto Serif SC", "Songti SC", "PingFang SC", serif';
  ctx.fillText(zhName, 256, 118);

  ctx.fillStyle = '#e5eef8';
  ctx.font = '600 24px "Segoe UI", Arial, sans-serif';
  ctx.fillText(enName, 256, 156);

  return finalizeTexture(canvas);
}

/** Dark bronze-and-gold scenic heritage plaque texture for iconic Badaguan villas. */
export function createHeritagePlaqueTexture(
  title: string,
  address: string,
  description: string
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 320);

  const bg = ctx.createLinearGradient(0, 0, 512, 320);
  bg.addColorStop(0, '#2a241f');
  bg.addColorStop(0.5, '#352e27');
  bg.addColorStop(1, '#231e1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = '#cfa963';
  ctx.lineWidth = 7;
  ctx.strokeRect(14, 14, 484, 292);
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 460, 268);

  ctx.fillStyle = '#cfa963';
  for (const [cx, cy] of [
    [32, 32],
    [480, 32],
    [32, 288],
    [480, 288],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d7b575';
  ctx.font = '600 20px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillText('青島市重點文物保護單位 · 八大關建築群', 256, 66);

  ctx.fillStyle = '#f8e6bd';
  ctx.font = 'bold 58px "Noto Serif SC", "Songti SC", serif';
  ctx.fillText(title, 256, 142);

  ctx.strokeStyle = 'rgba(207, 169, 99, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, 168);
  ctx.lineTo(412, 168);
  ctx.stroke();

  ctx.fillStyle = '#e5cf9f';
  ctx.font = '600 26px "Noto Serif SC", "PingFang SC", serif';
  ctx.fillText(address, 256, 212);

  ctx.fillStyle = '#cbb997';
  ctx.font = '22px "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.fillText(description, 256, 256);

  return finalizeTexture(canvas);
}

/** Wooden carved scenic directional blade texture. */
export function createDirectionalBoardTexture(
  zhLabel: string,
  enLabel: string,
  arrowDir: 'left' | 'right'
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);

  ctx.fillStyle = '#4e331f';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = 'rgba(28, 16, 8, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 10; y < 120; y += 11) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (y % 22 === 0 ? 3 : -3));
    ctx.stroke();
  }

  ctx.strokeStyle = '#c8a364';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);

  const arrow = arrowDir === 'right' ? '→' : '←';
  ctx.fillStyle = '#f8ecd0';
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px "Noto Serif SC", "PingFang SC", serif';
  ctx.fillText(arrowDir === 'right' ? `${zhLabel}  ${arrow}` : `${arrow}  ${zhLabel}`, 256, 66);

  ctx.fillStyle = '#dcc598';
  ctx.font = '600 21px "Segoe UI", Arial, sans-serif';
  ctx.fillText(enLabel, 256, 102);

  return finalizeTexture(canvas);
}

export function createFoliageTextureSet(): FoliageTextureSet {
  return {
    ginkgoCluster: createGinkgoClusterTexture(),
    mapleCluster: createMapleClusterTexture(),
    planeCluster: createPlaneClusterTexture(),
    pineBough: createPineBoughTexture(),
    ivyCluster: createIvyClusterTexture(),
    shrubCluster: createShrubClusterTexture(),

    barkGinkgo: createBarkTexture('ginkgo'),
    barkMaple: createBarkTexture('maple'),
    barkPlane: createBarkTexture('plane'),
    barkPine: createBarkTexture('pine'),

    fallenGinkgoCarpet: createFallenLeafCarpetTexture('ginkgo'),
    fallenMapleCarpet: createFallenLeafCarpetTexture('maple'),

    singleGinkgoLeaf: createSingleLeafTexture('ginkgo'),
    singleMapleLeaf: createSingleLeafTexture('maple'),

    lampGlow: createGlowSpriteTexture(),
    mistPuff: createMistPuffTexture(),
    woodSlat: createWoodSlatTexture(),
    postboxBody: createPostboxTexture(),
  };
}
