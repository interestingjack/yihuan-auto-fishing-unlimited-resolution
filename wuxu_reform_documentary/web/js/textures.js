// Procedural textures (generated once, deterministic): rice paper, aged paper,
// ink-wash mountains, clouds/smoke sprites, film grain, plaster wall.
import { W, H, makeCanvas, makeNoise, mulberry32, clamp, lerp, hexToRgb, smoothstep } from './engine.js';

const cache = new Map();
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// low-frequency field computed at reduced resolution and upscaled
function lowField(w, h, seed, freq, oct = 4) {
  const n = makeNoise(seed);
  const { c, g } = makeCanvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = n.fbm2(x * freq, y * freq, oct) * 0.5 + 0.5;
      const i = (y * w + x) * 4;
      const b = Math.round(clamp(v) * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Rice paper (宣纸). opts: base hex, w, h, seed, mottle, fibers, edge darkening
export function paper(opts = {}) {
  const o = { base: '#ece2cb', w: W, h: H, seed: 7, mottle: 0.10, fibers: 900, edge: 0.18, speck: 0.05, ...opts };
  return memo('paper' + JSON.stringify(o), () => {
    const { c, g } = makeCanvas(o.w, o.h);
    const [r, gg, b] = hexToRgb(o.base);
    g.fillStyle = o.base;
    g.fillRect(0, 0, o.w, o.h);
    // mottling
    const lf = lowField(Math.ceil(o.w / 6), Math.ceil(o.h / 6), o.seed, 0.025, 5);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = o.mottle * 2.2;
    g.imageSmoothingQuality = 'high';
    g.drawImage(lf, 0, 0, o.w, o.h);
    g.restore();
    // re-tint (multiply darkens to grey; push back toward base hue)
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = o.base;
    g.globalAlpha = 0.6;
    g.fillRect(0, 0, o.w, o.h);
    g.restore();
    // fibres
    const rnd = mulberry32(o.seed * 31 + 5);
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < o.fibers; i++) {
      const x = rnd() * o.w, y = rnd() * o.h;
      const len = 6 + rnd() * 40;
      const a = rnd() * Math.PI * 2;
      const dark = rnd() < 0.5;
      g.strokeStyle = dark ? `rgba(${r * 0.55},${gg * 0.5},${b * 0.45},${0.05 + rnd() * 0.08})` : `rgba(255,252,240,${0.08 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 1.1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    g.restore();
    // fine speckle
    const img = g.getImageData(0, 0, o.w, o.h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() - 0.5) * 255 * o.speck;
      d[i] += v; d[i + 1] += v; d[i + 2] += v;
    }
    g.putImageData(img, 0, 0);
    // edge darkening
    if (o.edge > 0) {
      const gr = g.createRadialGradient(o.w / 2, o.h / 2, Math.min(o.w, o.h) * 0.3, o.w / 2, o.h / 2, Math.max(o.w, o.h) * 0.75);
      gr.addColorStop(0, 'rgba(90,60,30,0)');
      gr.addColorStop(1, `rgba(90,60,30,${o.edge})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, o.w, o.h);
    }
    return c;
  });
}

// Aged paper with stains, foxing and darker burnt edges (for documents / maps)
export function agedPaper(opts = {}) {
  const o = { base: '#e2d1a8', w: W, h: H, seed: 11, stains: 14, ...opts };
  return memo('aged' + JSON.stringify(o), () => {
    const base = paper({ base: o.base, w: o.w, h: o.h, seed: o.seed, mottle: 0.16, fibers: 700, edge: 0.0 });
    const { c, g } = makeCanvas(o.w, o.h);
    g.drawImage(base, 0, 0);
    const rnd = mulberry32(o.seed * 13);
    for (let i = 0; i < o.stains; i++) {
      const x = rnd() * o.w, y = rnd() * o.h, rr = 20 + rnd() * Math.min(o.w, o.h) * 0.18;
      const gr = g.createRadialGradient(x, y, rr * 0.6, x, y, rr);
      const a = 0.04 + rnd() * 0.07;
      gr.addColorStop(0, `rgba(150,105,50,${a * 0.4})`);
      gr.addColorStop(0.92, `rgba(130,85,35,${a})`);
      gr.addColorStop(1, 'rgba(130,85,35,0)');
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 220; i++) {
      const x = rnd() * o.w, y = rnd() * o.h, rr = 0.6 + rnd() * 2.6;
      g.fillStyle = `rgba(120,75,30,${0.12 + rnd() * 0.25})`;
      g.beginPath();
      g.arc(x, y, rr, 0, Math.PI * 2);
      g.fill();
    }
    // burnt edges
    const e = Math.min(o.w, o.h) * 0.12;
    const sides = [
      [0, 0, o.w, e, 0, 0, 0, e],
      [0, o.h - e, o.w, e, 0, o.h, 0, o.h - e],
      [0, 0, e, o.h, 0, 0, e, 0],
      [o.w - e, 0, e, o.h, o.w, 0, o.w - e, 0],
    ];
    for (const [x, y, w, h, x0, y0, x1, y1] of sides) {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(95,60,25,0.45)');
      gr.addColorStop(1, 'rgba(95,60,25,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, w, h);
    }
    return c;
  });
}

// Dark lacquer / ink background with subtle texture
export function darkGround(opts = {}) {
  const o = { base: '#14110e', w: W, h: H, seed: 3, ...opts };
  return memo('dark' + JSON.stringify(o), () => {
    const { c, g } = makeCanvas(o.w, o.h);
    g.fillStyle = o.base;
    g.fillRect(0, 0, o.w, o.h);
    const lf = lowField(Math.ceil(o.w / 8), Math.ceil(o.h / 8), o.seed, 0.03, 5);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.35;
    g.drawImage(lf, 0, 0, o.w, o.h);
    g.restore();
    const rnd = mulberry32(o.seed + 99);
    const img = g.getImageData(0, 0, o.w, o.h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() - 0.5) * 10;
      d[i] += v; d[i + 1] += v; d[i + 2] += v;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

// Ink-wash mountain range layer: returns a canvas (transparent) with one ridge band.
export function inkRidge(opts = {}) {
  const o = { w: 2600, h: 700, seed: 1, color: '#1d1a17', amp: 0.55, base: 0.55, freq: 0.0022, rough: 0.5, mist: 0.65, ...opts };
  return memo('ridge' + JSON.stringify(o), () => {
    const n = makeNoise(o.seed);
    const { c, g } = makeCanvas(o.w, o.h);
    const [r, gg, b] = hexToRgb(o.color);
    const img = g.createImageData(o.w, o.h);
    const d = img.data;
    const ridge = new Float32Array(o.w);
    for (let x = 0; x < o.w; x++) {
      const v = n.fbm2(x * o.freq, 0.5, 6, 2.1, o.rough);
      const peaks = Math.pow(Math.abs(n.n2(x * o.freq * 0.5, 9.3)), 0.7);
      ridge[x] = o.h * (1 - o.base - o.amp * (0.55 * (v * 0.5 + 0.5) + 0.45 * peaks));
    }
    for (let y = 0; y < o.h; y++) {
      for (let x = 0; x < o.w; x++) {
        const top = ridge[x];
        if (y < top - 2) continue;
        const depth = (y - top) / (o.h - top + 1);
        // ink density: strong at ridge line, fading into mist downward, with texture
        const tex = n.fbm2(x * 0.012, y * 0.02, 3) * 0.5 + 0.5;
        let a = clamp(1 - depth / o.mist) * (0.55 + 0.45 * tex);
        a *= smoothstep(top - 2, top + 3, y);
        const i = (y * o.w + x) * 4;
        d[i] = r; d[i + 1] = gg; d[i + 2] = b;
        d[i + 3] = Math.round(clamp(a) * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

// Soft cloud / smoke puff sprite
export function puff(size = 256, seed = 1, opts = {}) {
  const o = { color: '#ffffff', density: 1, ...opts };
  return memo(`puff${size}_${seed}_${JSON.stringify(o)}`, () => {
    const n = makeNoise(seed);
    const { c, g } = makeCanvas(size, size);
    const img = g.createImageData(size, size);
    const [r, gg, b] = hexToRgb(o.color);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x / size - 0.5, dy = y / size - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy) * 2;
        const v = n.fbm2(x / size * 3, y / size * 3, 5) * 0.5 + 0.5;
        const a = clamp((1 - dist) * 1.4) * clamp(v * 1.6 - 0.35) * o.density;
        const i = (y * size + x) * 4;
        d4(img.data, i, r, gg, b, a);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}
function d4(d, i, r, g, b, a) {
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(clamp(a) * 255);
}

// Wide cloud band (for skies / map clouds)
export function cloudBand(w = 1024, h = 512, seed = 5, opts = {}) {
  const o = { color: '#ffffff', cover: 0.45, sharp: 2.2, ...opts };
  return memo(`cloud${w}_${h}_${seed}_${JSON.stringify(o)}`, () => {
    const n = makeNoise(seed);
    const { c, g } = makeCanvas(w, h);
    const img = g.createImageData(w, h);
    const [r, gg, b] = hexToRgb(o.color);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = n.fbm2(x * 0.006, y * 0.012, 6) * 0.5 + 0.5;
        const ey = Math.sin((y / h) * Math.PI);
        const ex = Math.min(1, Math.min(x, w - x) / (w * 0.15));
        const a = clamp((v - (1 - o.cover)) * o.sharp) * ey * ex;
        d4(img.data, (y * w + x) * 4, r, gg, b, a);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

// Film grain tiles (4 variants); drawn with 'overlay' at low alpha.
export function grainTiles() {
  return memo('grain', () => {
    const tiles = [];
    for (let k = 0; k < 4; k++) {
      const rnd = mulberry32(500 + k);
      const { c, g } = makeCanvas(640, 360);
      const img = g.createImageData(640, 360);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rnd() + rnd() - 1) * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      tiles.push(c);
    }
    return tiles;
  });
}

// Plaster / prison wall texture
export function plaster(opts = {}) {
  const o = { base: '#8f877a', w: W, h: H, seed: 21, ...opts };
  return memo('plaster' + JSON.stringify(o), () => {
    const { c, g } = makeCanvas(o.w, o.h);
    g.fillStyle = o.base;
    g.fillRect(0, 0, o.w, o.h);
    const lf = lowField(Math.ceil(o.w / 4), Math.ceil(o.h / 4), o.seed, 0.04, 6);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.7;
    g.drawImage(lf, 0, 0, o.w, o.h);
    g.restore();
    const lf2 = lowField(Math.ceil(o.w / 10), Math.ceil(o.h / 10), o.seed + 1, 0.05, 3);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.35;
    g.drawImage(lf2, 0, 0, o.w, o.h);
    g.restore();
    const rnd = mulberry32(o.seed);
    // cracks
    g.strokeStyle = 'rgba(40,35,30,0.25)';
    for (let k = 0; k < 18; k++) {
      let x = rnd() * o.w, y = rnd() * o.h;
      g.lineWidth = 0.6 + rnd();
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 14; s++) {
        x += (rnd() - 0.5) * 30;
        y += rnd() * 18;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const img = g.getImageData(0, 0, o.w, o.h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (rnd() - 0.5) * 22;
      img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

// Noise field (Float32) used for ink-spread transitions and masks
export function noiseField(w, h, seed = 9, freq = 0.02) {
  return memo(`nf${w}_${h}_${seed}_${freq}`, () => {
    const n = makeNoise(seed);
    const f = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f[y * w + x] = n.fbm2(x * freq, y * freq, 5) * 0.5 + 0.5;
    return f;
  });
}

// Ink splash blot (for seals, transitions)
export function inkBlot(size = 512, seed = 3, color = '#0d0b09') {
  return memo(`blot${size}_${seed}_${color}`, () => {
    const n = makeNoise(seed);
    const { c, g } = makeCanvas(size, size);
    const img = g.createImageData(size, size);
    const [r, gg, b] = hexToRgb(color);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x / size - 0.5, dy = y / size - 0.5;
        const ang = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy) * 2;
        const edge = 0.62 + 0.22 * n.fbm2(Math.cos(ang) * 2 + 5, Math.sin(ang) * 2 + 5, 4) + 0.06 * n.n2(x * 0.05, y * 0.05);
        const a = smoothstep(edge + 0.02, edge - 0.04, dist) * (0.8 + 0.2 * (n.fbm2(x * 0.02, y * 0.02, 3) * 0.5 + 0.5));
        d4(img.data, (y * size + x) * 4, r, gg, b, a);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

export function lerpColorArr(a, b, t) {
  return a.map((v, i) => lerp(v, b[i], t));
}
