// Core helpers: math, easing, deterministic randomness, noise, canvas & text utilities.
// Every animation in the film is a pure function of absolute time, so any frame
// can be rendered independently (chunked / parallel / retryable rendering).

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const PAL = {
  ink: '#0d0b09',
  ink2: '#1b1612',
  ink3: '#2a231c',
  gold: '#c9a45c',
  goldLight: '#e8cf94',
  goldDeep: '#8a6a35',
  red: '#b3261e',
  redLight: '#d4483a',
  redDeep: '#6e1510',
  paper: '#efe6d2',
  paper2: '#e3d6ba',
  paperDark: '#c9b791',
  jade: '#3d6b5e',
  slate: '#43546a',
  imperial: '#d9a62e',
};

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = lerp;
export const fract = (x) => x - Math.floor(x);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const remap = (x, a, b) => clamp((x - a) / (b - a));
export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outQuad: (t) => 1 - (1 - t) * (1 - t),
};
// eased progress of x within [a,b]
export const prog = (x, a, b, e = ease.inOut) => e(remap(x, a, b));
// fade in over [a, a+fi], hold, fade out over [b-fo, b]
export const envelope = (x, a, b, fi = 0.5, fo = 0.5) =>
  Math.min(smoothstep(a, a + fi, x), 1 - smoothstep(b - fo, b, x));

// ---------------------------------------------------------------- random
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------- simplex noise
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
  [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
function buildPerm(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return { perm, permMod12 };
}
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3, G3 = 1 / 6;
export function makeNoise(seed = 1) {
  const { perm, permMod12 } = buildPerm(seed);
  function n2(xin, yin) {
    let n0 = 0, n1 = 0, n2v = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const g = grad3[permMod12[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const g = grad3[permMod12[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const g = grad3[permMod12[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2v = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2v);
  }
  function n3(xin, yin, zin) {
    let n0, n1, n2v, n3v;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const g0 = grad3[permMod12[ii + perm[jj + perm[kk]]]];
    const g1 = grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]];
    const g2 = grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]];
    const g3 = grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]];
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    n0 = t0 < 0 ? 0 : ((t0 *= t0), t0 * t0 * (g0[0] * x0 + g0[1] * y0 + g0[2] * z0));
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    n1 = t1 < 0 ? 0 : ((t1 *= t1), t1 * t1 * (g1[0] * x1 + g1[1] * y1 + g1[2] * z1));
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    n2v = t2 < 0 ? 0 : ((t2 *= t2), t2 * t2 * (g2[0] * x2 + g2[1] * y2 + g2[2] * z2));
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    n3v = t3 < 0 ? 0 : ((t3 *= t3), t3 * t3 * (g3[0] * x3 + g3[1] * y3 + g3[2] * z3));
    return 32 * (n0 + n1 + n2v + n3v);
  }
  function fbm2(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
  return { n2, n3, fbm2 };
}
export const noise = makeNoise(1898);

// ---------------------------------------------------------------- canvas helpers
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  return { c, g };
}

export function rgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixColor(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const FONTS = {
  brush: 'MaShan',
  xing: 'ZhiMang',
  cao: 'CaoShu',
  serif: 'SerifSC',
  sans: 'SansSC',
  kaiTC: 'KaiTC',
  serifTC: 'SerifTC',
};

export function font(size, family = FONTS.serif, weight = 400) {
  return `${weight} ${size}px "${family}"`;
}

// Draw a single line of text. opts: size, family, weight, color, align, baseline, alpha,
// spacing (px), shadow {color, blur, x, y}, stroke {color, width}
export function text(g, str, x, y, o = {}) {
  g.save();
  g.font = font(o.size || 40, o.family || FONTS.serif, o.weight || 400);
  g.textAlign = o.align || 'left';
  g.textBaseline = o.baseline || 'alphabetic';
  g.globalAlpha *= o.alpha ?? 1;
  if (o.spacing) g.letterSpacing = `${o.spacing}px`;
  if (o.shadow) {
    g.shadowColor = o.shadow.color || 'rgba(0,0,0,0.6)';
    g.shadowBlur = o.shadow.blur ?? 8;
    g.shadowOffsetX = o.shadow.x || 0;
    g.shadowOffsetY = o.shadow.y || 0;
  }
  if (o.stroke) {
    g.lineJoin = 'round';
    g.strokeStyle = o.stroke.color;
    g.lineWidth = o.stroke.width;
    g.strokeText(str, x, y);
  }
  g.fillStyle = o.color || PAL.paper;
  g.fillText(str, x, y);
  g.restore();
}

export function measure(g, str, o = {}) {
  g.save();
  g.font = font(o.size || 40, o.family || FONTS.serif, o.weight || 400);
  if (o.spacing) g.letterSpacing = `${o.spacing}px`;
  const w = g.measureText(str).width;
  g.restore();
  return w;
}

// Per-character reveal (fade + rise + slight blur-like glow). p in [0,1].
export function revealText(g, str, x, y, p, o = {}) {
  const chars = [...str];
  const size = o.size || 40;
  g.save();
  g.font = font(size, o.family || FONTS.serif, o.weight || 400);
  if (o.spacing) g.letterSpacing = `${o.spacing}px`;
  const total = g.measureText(str).width;
  let cx = x;
  if ((o.align || 'left') === 'center') cx = x - total / 2;
  else if (o.align === 'right') cx = x - total;
  g.textAlign = 'left';
  g.textBaseline = o.baseline || 'alphabetic';
  const n = chars.length;
  const spread = o.spread ?? 0.6; // fraction of p over which chars start
  const base = g.globalAlpha * (o.alpha ?? 1);
  for (let i = 0; i < n; i++) {
    const st = n > 1 ? (i / (n - 1)) * spread : 0;
    const a = clamp((p - st) / Math.max(1e-4, 1 - spread));
    const cw = g.measureText(chars[i]).width + (o.spacing || 0);
    if (a > 0) {
      const e = ease.out(a);
      g.globalAlpha = base * e;
      if (o.shadow) {
        g.shadowColor = o.shadow.color;
        g.shadowBlur = o.shadow.blur;
      }
      if (o.stroke) {
        g.strokeStyle = o.stroke.color;
        g.lineWidth = o.stroke.width;
        g.lineJoin = 'round';
        g.strokeText(chars[i], cx, y + (1 - e) * size * 0.25);
      }
      g.fillStyle = o.color || PAL.paper;
      g.fillText(chars[i], cx, y + (1 - e) * size * 0.25);
    }
    cx += cw;
  }
  g.restore();
  return total;
}

// Vertical text (top to bottom). Returns height.
export function vtext(g, str, x, y, o = {}) {
  const size = o.size || 40;
  const lh = o.lineHeight || size * 1.08;
  const chars = [...str];
  const p = o.progress ?? 1;
  const n = chars.length;
  g.save();
  g.font = font(size, o.family || FONTS.serif, o.weight || 400);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const base = g.globalAlpha * (o.alpha ?? 1);
  if (o.shadow) {
    g.shadowColor = o.shadow.color;
    g.shadowBlur = o.shadow.blur;
  }
  for (let i = 0; i < n; i++) {
    const a = clamp(p * n - i);
    if (a <= 0) break;
    g.globalAlpha = base * ease.out(a);
    const ch = chars[i];
    const cy = y + i * lh + lh / 2;
    if ('，。、；：'.includes(ch)) {
      g.fillStyle = o.color || PAL.ink;
      g.fillText(ch, x + size * 0.3, cy - size * 0.3);
    } else {
      g.fillStyle = o.color || PAL.ink;
      g.fillText(ch, x, cy);
    }
  }
  g.restore();
  return n * lh;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function radialGlow(g, x, y, r, color, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(0.4, rgba(color, a * 0.35));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function vignette(g, strength = 0.6, color = '#000') {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, rgba(color, 0));
  gr.addColorStop(1, rgba(color, strength));
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

// Draw an image (canvas) with a 2D camera: scale about the frame centre plus offset & rotation.
export function drawCam(g, img, { scale = 1, x = 0, y = 0, rot = 0, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(W / 2 + x, H / 2 + y);
  g.rotate(rot);
  g.scale(scale, scale);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  g.restore();
}

// Cue helpers: cues are scene-relative {start,end,text,line}
export function lineStart(scene, line, fallback = 0) {
  const c = scene.cues.find((q) => q.line === line);
  return c ? c.start : fallback;
}
export function lineEnd(scene, line, fallback = 0) {
  const cs = scene.cues.filter((q) => q.line === line);
  return cs.length ? cs[cs.length - 1].end : fallback;
}
