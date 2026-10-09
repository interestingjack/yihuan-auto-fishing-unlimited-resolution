// Brush & ink: stroke-order calligraphy (Make Me a Hanzi stroke data), seals,
// tapered brush lines and arrows.
import { makeCanvas, clamp, ease, mulberry32, noise, FONTS, font, PAL, rgba } from './engine.js';

let HANZI = {};
export async function loadHanzi() {
  HANZI = await (await fetch('assets/data/hanzi.json')).json();
}
export const hasHanzi = (c) => !!HANZI[c];

const pathCache = new Map();
function charData(ch) {
  if (pathCache.has(ch)) return pathCache.get(ch);
  const d = HANZI[ch];
  if (!d) return null;
  const strokes = d.s.map((s) => new Path2D(s));
  const meds = d.m;
  const lens = meds.map((m) => {
    let L = 0;
    for (let i = 1; i < m.length; i++) L += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]);
    return Math.max(L, 30);
  });
  const PAUSE = 90; // brush lift between strokes (in glyph units)
  const total = lens.reduce((a, b) => a + b + PAUSE, 0);
  const res = { strokes, meds, lens, total, PAUSE };
  pathCache.set(ch, res);
  return res;
}

// draw partial median polyline of length `len`
function medianTo(g, m, len) {
  g.beginPath();
  g.moveTo(m[0][0], m[0][1]);
  let acc = 0;
  for (let i = 1; i < m.length; i++) {
    const seg = Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]);
    if (acc + seg >= len) {
      const t = (len - acc) / seg;
      g.lineTo(m[i - 1][0] + (m[i][0] - m[i - 1][0]) * t, m[i - 1][1] + (m[i][1] - m[i - 1][1]) * t);
      return;
    }
    acc += seg;
    g.lineTo(m[i][0], m[i][1]);
  }
}

const inkTexCache = new Map();
function inkTexture(size, color) {
  const key = size + color;
  if (inkTexCache.has(key)) return inkTexCache.get(key);
  const { c, g } = makeCanvas(size, size);
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  // subtle density variation: lighter streaks (dry brush) and darker pooling
  const rnd = mulberry32(size * 7 + color.length);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 60; i++) {
    const y = rnd() * size;
    g.strokeStyle = `rgba(255,255,255,${0.025 + rnd() * 0.045})`;
    g.lineWidth = 0.5 + rnd() * 2.5;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(size * 0.3, y + (rnd() - 0.5) * 30, size * 0.7, y + (rnd() - 0.5) * 30, size, y + (rnd() - 0.5) * 20);
    g.stroke();
  }
  inkTexCache.set(key, c);
  return c;
}

// Render one glyph into an offscreen canvas at the given progress (0..1).
function renderGlyph(ch, size, p, color) {
  const cd = charData(ch);
  const pad = Math.ceil(size * 0.08);
  const { c, g } = makeCanvas(size + pad * 2, size + pad * 2);
  if (!cd) {
    // fallback: font glyph faded in
    g.globalAlpha = clamp(p * 1.5);
    g.font = font(size * 0.92, FONTS.brush);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(ch, pad + size / 2, pad + size / 2 + size * 0.04);
    return c;
  }
  const s = size / 1024;
  g.save();
  g.translate(pad, pad + 900 * s);
  g.scale(s, -s);
  let cur = p * cd.total;
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < cd.strokes.length; i++) {
    const L = cd.lens[i];
    if (cur <= 0) break;
    if (cur >= L) {
      g.fill(cd.strokes[i]);
    } else {
      g.save();
      g.clip(cd.strokes[i]);
      g.lineWidth = 170;
      medianTo(g, cd.meds[i], cur);
      g.stroke();
      g.restore();
    }
    cur -= L + cd.PAUSE;
  }
  g.restore();
  // ink texture
  g.globalCompositeOperation = 'source-atop';
  g.drawImage(inkTexture(Math.max(64, Math.round(size + pad * 2)), color), 0, 0);
  return c;
}

const glyphCache = new Map();
// Draw a brush-written character with its top-left at (x,y), box size `size`.
// p: stroke-order progress 0..1. opts.color, opts.bleed (soft ink halo), opts.alpha
export function hanzi(g, ch, x, y, size, p, o = {}) {
  if (p <= 0) return;
  const color = o.color || PAL.ink;
  p = clamp(p);
  let img;
  const key = `${ch}|${Math.round(size)}|${color}`;
  if (p >= 1) {
    if (!glyphCache.has(key)) glyphCache.set(key, renderGlyph(ch, Math.round(size), 1, color));
    img = glyphCache.get(key);
  } else {
    img = renderGlyph(ch, Math.round(size), p, color);
  }
  const pad = (img.width - Math.round(size)) / 2;
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  if (o.bleed !== 0) {
    g.save();
    g.globalAlpha *= (o.bleed ?? 0.35);
    g.filter = `blur(${Math.max(1.5, size * 0.012)}px)`;
    g.drawImage(img, x - pad - size * 0.004, y - pad + size * 0.006, img.width * 1.01, img.height * 1.01);
    g.restore();
  }
  if (o.glow) {
    g.shadowColor = o.glow.color;
    g.shadowBlur = o.glow.blur;
  }
  g.drawImage(img, x - pad, y - pad);
  g.restore();
}

// Write a string with the brush. dir 'h' | 'v'. p: 0..1 across whole string.
// opts.gap: spacing factor; opts.overlap: how much consecutive chars overlap in time
export function brushWrite(g, str, x, y, size, p, o = {}) {
  const chars = [...str];
  const n = chars.length;
  const gap = o.gap ?? 1.05;
  const ov = o.overlap ?? 0.15;
  const span = 1 / (n - (n - 1) * ov);
  for (let i = 0; i < n; i++) {
    const st = i * span * (1 - ov);
    const lp = clamp((p - st) / span);
    const cx = o.dir === 'v' ? x : x + i * size * gap;
    const cy = o.dir === 'v' ? y + i * size * gap : y;
    if (chars[i] !== ' ') hanzi(g, chars[i], cx, cy, size, lp, o);
  }
}
export function brushWidth(str, size, gap = 1.05) {
  const n = [...str].length;
  return size * gap * (n - 1) + size;
}

// Red seal stamp (阳文/阴文). text up to 4 chars. Cached.
const sealCache = new Map();
export function sealImage(textStr, size, o = {}) {
  const key = textStr + size + JSON.stringify(o);
  if (sealCache.has(key)) return sealCache.get(key);
  const { c, g } = makeCanvas(size, size);
  const red = o.color || '#b8241b';
  const inv = o.yang ?? false; // yang: red chars on transparent with border
  const rnd = mulberry32(textStr.length * 131 + size);
  const m = size * 0.04;
  // rough square
  g.beginPath();
  const pts = [];
  const N = 40;
  for (let i = 0; i < N * 4; i++) {
    const side = Math.floor(i / N), t = (i % N) / N;
    let px, py;
    if (side === 0) { px = m + t * (size - 2 * m); py = m; }
    else if (side === 1) { px = size - m; py = m + t * (size - 2 * m); }
    else if (side === 2) { px = size - m - t * (size - 2 * m); py = size - m; }
    else { px = m; py = size - m - t * (size - 2 * m); }
    px += (rnd() - 0.5) * size * 0.012;
    py += (rnd() - 0.5) * size * 0.012;
    pts.push([px, py]);
  }
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  const chars = [...textStr];
  const grid = chars.length === 4 ? [[1, 0], [1, 1], [0, 0], [0, 1]] : chars.length === 2 ? [[0.5, 0], [0.5, 1]] : chars.length === 3 ? [[1, 0], [0, 0], [0, 1]] : [[0.5, 0.5]];
  const cs = chars.length === 1 ? size * 0.7 : size * 0.4;
  if (!inv) {
    g.fillStyle = red;
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
  } else {
    g.strokeStyle = red;
    g.lineWidth = size * 0.06;
    g.stroke();
    g.fillStyle = red;
  }
  g.font = font(cs, o.family || FONTS.brush);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const [gx, gy] = grid[i];
    let cx, cy;
    if (chars.length === 4) { cx = size * (0.3 + gx * 0.4); cy = size * (0.3 + gy * 0.4); }
    else if (chars.length === 2) { cx = size * 0.5; cy = size * (0.3 + gy * 0.4); }
    else if (chars.length === 3) {
      if (i === 0) { cx = size * 0.7; cy = size * 0.5; g.save(); g.translate(cx, cy); g.scale(1, 2); g.fillText(ch, 0, size * 0.015); g.restore(); return; }
      cx = size * 0.3; cy = size * (0.3 + gy * 0.4);
    } else { cx = size * 0.5; cy = size * 0.52; }
    g.fillText(ch, cx, cy + size * 0.02);
  });
  // weathering specks
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < size * 0.6; i++) {
    g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.7})`;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, rnd() * size * 0.012, 0, Math.PI * 2);
    g.fill();
  }
  sealCache.set(key, c);
  return c;
}

// Stamp animation: p 0..1 (drop in with scale overshoot)
export function seal(g, textStr, x, y, size, p, o = {}) {
  if (p <= 0) return;
  const img = sealImage(textStr, Math.round(size), o);
  const e = clamp(p * 1.6);
  const sc = 1 + (1 - ease.out(e)) * 0.9;
  g.save();
  g.globalAlpha *= clamp(p * 4) * (o.alpha ?? 0.92);
  g.translate(x + size / 2, y + size / 2);
  g.rotate(o.rot ?? -0.03);
  g.scale(sc, sc);
  g.globalCompositeOperation = o.blend || 'source-over';
  g.drawImage(img, -size / 2, -size / 2);
  g.restore();
}

// Tapered brush line along a polyline (screen space). p: drawn fraction.
export function brushLine(g, pts, width, p, color = PAL.ink, o = {}) {
  if (p <= 0 || pts.length < 2) return null;
  // resample by arc length
  const segs = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d);
    L += d;
  }
  const target = L * clamp(p);
  const step = Math.max(2, width * 0.25);
  const samples = [];
  let acc = 0, si = 0, segAcc = 0;
  for (let d = 0; d <= target; d += step) {
    while (si < segs.length - 1 && segAcc + segs[si] < d) { segAcc += segs[si]; si++; }
    const t = segs[si] ? (d - segAcc) / segs[si] : 0;
    samples.push([pts[si][0] + (pts[si + 1][0] - pts[si][0]) * t, pts[si][1] + (pts[si + 1][1] - pts[si][1]) * t, d]);
  }
  if (samples.length < 2) return null;
  const left = [], right = [];
  const seed = o.seed || 1;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const u = samples[i][2] / L; // position along full line
    const head = (target - samples[i][2]) / (width * 2);
    const taperIn = clamp(u * L / (width * 1.2));
    const taperOut = o.taperEnd === false ? 1 : clamp(head + 0.25);
    const wob = 1 + 0.12 * noise.n2(samples[i][2] * 0.02, seed);
    const w = width * 0.5 * Math.max(0.15, Math.min(taperIn * 0.7 + 0.3, 1) * Math.min(1, taperOut)) * wob * (o.profile ? o.profile(u) : 1);
    left.push([samples[i][0] + nx * w, samples[i][1] + ny * w]);
    right.push([samples[i][0] - nx * w, samples[i][1] - ny * w]);
  }
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.fillStyle = color;
  g.beginPath();
  left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fill();
  // dry-brush streaks near the tail
  if (o.dry !== false) {
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = Math.max(0.7, width * 0.04);
    const rnd = mulberry32(seed * 97);
    for (let k = 0; k < 5; k++) {
      const off = (rnd() - 0.5) * 0.8;
      const st = Math.floor(samples.length * (0.35 + rnd() * 0.5));
      g.beginPath();
      for (let i = st; i < samples.length; i++) {
        const lx = left[i][0] * (0.5 + off) + right[i][0] * (0.5 - off);
        const ly = left[i][1] * (0.5 + off) + right[i][1] * (0.5 - off);
        i === st ? g.moveTo(lx, ly) : g.lineTo(lx, ly);
      }
      g.stroke();
    }
  }
  g.restore();
  const last = samples[samples.length - 1];
  const prev = samples[Math.max(0, samples.length - 3)];
  return { x: last[0], y: last[1], ang: Math.atan2(last[1] - prev[1], last[0] - prev[0]) };
}

// Arrow: brush body + head
export function brushArrow(g, pts, width, p, color = PAL.red, o = {}) {
  const head = brushLine(g, pts, width, p, color, { ...o, taperEnd: false, dry: o.dry ?? true });
  if (!head) return;
  const hs = width * 2.2;
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.translate(head.x, head.y);
  g.rotate(head.ang);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(hs * 0.9, 0);
  g.lineTo(-hs * 0.45, hs * 0.62);
  g.quadraticCurveTo(-hs * 0.1, 0, -hs * 0.45, -hs * 0.62);
  g.closePath();
  g.fill();
  g.restore();
}

// Ink splash ring that expands (impact)
export function inkRing(g, x, y, r, p, color = PAL.red) {
  if (p <= 0 || p >= 1) return;
  g.save();
  g.globalAlpha *= (1 - p) * 0.6;
  g.strokeStyle = color;
  g.lineWidth = 3 + 10 * (1 - p);
  g.beginPath();
  g.arc(x, y, r * ease.out(p), 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

export { rgba };
