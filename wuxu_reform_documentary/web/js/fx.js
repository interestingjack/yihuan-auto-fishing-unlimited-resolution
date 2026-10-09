// Deterministic particle & atmosphere effects for the 2D layers (time -> state).
import { W, H, makeCanvas, mulberry32, clamp, rgba, fract, noise, PAL, ease, lerp } from './engine.js';
import { puff } from './textures.js';

const spriteCache = new Map();
export function glowSprite(color = '#ffb060', size = 64, hard = 0.15) {
  const key = color + size + hard;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const { c, g } = makeCanvas(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(hard, rgba(color, 0.8));
  gr.addColorStop(0.45, rgba(color, 0.18));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

// Rising embers / sparks
export function embers(g, t, o = {}) {
  const n = o.count ?? 60;
  const rnd = mulberry32(o.seed ?? 11);
  const spr = glowSprite(o.color || '#ff9a3c');
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = rnd() * W, sp = 30 + rnd() * 90, ph = rnd() * 10, sz = 3 + rnd() * 7, sw = rnd() * 6.28;
    const life = (t * sp + ph * 200) % (H + 200);
    const y = H + 100 - life;
    const x = x0 + Math.sin(t * 0.8 + sw) * 30 + noise.n2(i, t * 0.2) * 40;
    const fl = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.7);
    g.globalAlpha = (o.alpha ?? 0.7) * fl * clamp(life / 300) * clamp((H + 200 - life) / 300);
    g.drawImage(spr, x - sz * 2, y - sz * 2, sz * 4, sz * 4);
  }
  g.restore();
}

// Floating dust motes in light (slow drift)
export function dust(g, t, o = {}) {
  const n = o.count ?? 80;
  const rnd = mulberry32(o.seed ?? 5);
  const spr = glowSprite(o.color || '#f3dfb0', 32, 0.3);
  g.save();
  g.globalCompositeOperation = o.blend || 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = rnd() * W, y0 = rnd() * H, z = 0.3 + rnd() * 0.7, ph = rnd() * 100;
    const x = (x0 + t * 12 * z + noise.n2(i * 0.3, t * 0.08 + ph) * 60 + W * 2) % W;
    const y = (y0 - t * 6 * z + noise.n2(t * 0.07 + ph, i * 0.3) * 50 + H * 2) % H;
    const sz = 2 + z * 5;
    g.globalAlpha = (o.alpha ?? 0.45) * z * (0.6 + 0.4 * Math.sin(t * 1.3 + ph));
    g.drawImage(spr, x - sz, y - sz, sz * 2, sz * 2);
  }
  g.restore();
}

// Falling ash (dark flakes) - solemn scenes
export function ash(g, t, o = {}) {
  const n = o.count ?? 50;
  const rnd = mulberry32(o.seed ?? 77);
  g.save();
  for (let i = 0; i < n; i++) {
    const x0 = rnd() * W, sp = 20 + rnd() * 35, ph = rnd() * 1000, sz = 1.5 + rnd() * 3.5;
    const y = ((t * sp + ph) % (H + 60)) - 30;
    const x = x0 + Math.sin(t * 0.7 + ph) * 40;
    g.globalAlpha = (o.alpha ?? 0.5) * (0.5 + 0.5 * rnd());
    g.fillStyle = o.color || '#b8ae9c';
    g.save();
    g.translate(x, y);
    g.rotate(t * (rnd() - 0.5) * 2 + ph);
    g.fillRect(-sz, -sz * 0.4, sz * 2, sz * 0.8);
    g.restore();
  }
  g.restore();
}

// Drifting smoke/mist puffs across the frame
export function smoke(g, t, o = {}) {
  const n = o.count ?? 8;
  const rnd = mulberry32(o.seed ?? 3);
  const spr = puff(256, o.seed ?? 3, { color: o.color || '#cfc6b8' });
  g.save();
  g.globalCompositeOperation = o.blend || 'source-over';
  for (let i = 0; i < n; i++) {
    const x0 = rnd() * W * 1.4 - W * 0.2, y0 = (o.y0 ?? 0) + rnd() * (o.h ?? H), s = (o.size ?? 700) * (0.6 + rnd() * 0.8);
    const vx = (o.vx ?? 18) * (0.5 + rnd()), rot = rnd() * 6.28;
    const x = ((x0 + t * vx + W * 0.6) % (W * 1.6)) - W * 0.3;
    g.globalAlpha = (o.alpha ?? 0.25) * (0.6 + 0.4 * rnd());
    g.save();
    g.translate(x, y0 + Math.sin(t * 0.2 + i) * 20);
    g.rotate(rot + t * 0.02 * (rnd() - 0.5));
    g.drawImage(spr, -s / 2, -s / 2, s, s);
    g.restore();
  }
  g.restore();
}

// Candle: flame + glow at (x,y) (base of flame). t time, s scale
export function candle(g, x, y, t, s = 1, o = {}) {
  const fl = 1 + 0.08 * Math.sin(t * 13 + x) + 0.05 * Math.sin(t * 23 + y) + 0.06 * noise.n2(t * 3, x * 0.01);
  const lit = o.lit ?? 1;
  g.save();
  // body
  if (o.body !== false) {
    const bw = 34 * s, bh = (o.height ?? 150) * s;
    const gr = g.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
    gr.addColorStop(0, '#6e1712');
    gr.addColorStop(0.45, '#b3332a');
    gr.addColorStop(1, '#4a0f0b');
    g.fillStyle = gr;
    g.fillRect(x - bw / 2, y + 6 * s, bw, bh);
    g.fillStyle = 'rgba(255,200,150,0.18)';
    g.fillRect(x - bw / 2, y + 6 * s, bw, 6 * s);
    g.strokeStyle = '#1a1210';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(x, y + 8 * s);
    g.lineTo(x, y - 2 * s);
    g.stroke();
  }
  if (lit > 0) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = lit * 0.55;
    const R = 260 * s * fl;
    g.drawImage(glowSprite('#ff9d45', 128, 0.05), x - R, y - 30 * s - R, R * 2, R * 2);
    g.globalAlpha = lit;
    // flame shape
    const fh = 46 * s * fl, fw = 13 * s;
    const sway = Math.sin(t * 4 + x) * 2.5 * s;
    const grd = g.createRadialGradient(x, y - fh * 0.25, 1, x, y - fh * 0.35, fh * 0.8);
    grd.addColorStop(0, 'rgba(255,250,225,1)');
    grd.addColorStop(0.35, 'rgba(255,205,110,0.95)');
    grd.addColorStop(0.75, 'rgba(240,120,40,0.5)');
    grd.addColorStop(1, 'rgba(200,60,20,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x - fw, y - fh * 0.2, x - fw * 0.6 + sway, y - fh * 0.7, x + sway * 1.6, y - fh);
    g.bezierCurveTo(x + fw * 0.6 + sway, y - fh * 0.7, x + fw, y - fh * 0.2, x, y);
    g.fill();
  }
  g.restore();
}

// Film damage: occasional scratches + dust specks (old-photo look)
export function filmDamage(g, t, o = {}) {
  const f = Math.floor(t * 12);
  const rnd = mulberry32(f * 7919 + (o.seed ?? 1));
  g.save();
  g.globalAlpha = o.alpha ?? 0.5;
  const ns = rnd() < 0.5 ? 1 : rnd() < 0.5 ? 2 : 0;
  for (let i = 0; i < ns; i++) {
    const x = rnd() * W;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,245,220,0.35)' : 'rgba(20,15,10,0.35)';
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (rnd() - 0.5) * 30, H);
    g.stroke();
  }
  for (let i = 0; i < 12; i++) {
    g.fillStyle = rnd() < 0.6 ? 'rgba(20,15,10,0.5)' : 'rgba(255,245,220,0.5)';
    g.beginPath();
    g.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// Light rays from a point (god rays, additive)
export function rays(g, x, y, t, o = {}) {
  const n = o.count ?? 9;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? Math.PI / 2) + (i - n / 2) * (o.spread ?? 0.09) + Math.sin(t * 0.3 + i) * 0.015;
    const len = o.len ?? 1400;
    const w = (o.width ?? 60) * (0.6 + 0.4 * Math.sin(i * 2.3));
    const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    gr.addColorStop(0, rgba(o.color || '#ffe2a8', (o.alpha ?? 0.12) * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 1.3))));
    gr.addColorStop(1, rgba(o.color || '#ffe2a8', 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a - 0.02) * len - Math.sin(a) * w, y + Math.sin(a - 0.02) * len + Math.cos(a) * w);
    g.lineTo(x + Math.cos(a + 0.02) * len + Math.sin(a) * w, y + Math.sin(a + 0.02) * len - Math.cos(a) * w);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// Muzzle/cannon flash burst
export function flash(g, x, y, t, t0, o = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.4 || isNaN(x)) return 0;
  const a = Math.exp(-dt * 4.5);
  const R = (o.size ?? 140) * (0.5 + dt);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.drawImage(glowSprite('#ffb35a', 128, 0.08), x - R, y - R, R * 2, R * 2);
  g.globalAlpha = a * 0.8;
  const r2 = R * 0.35;
  g.drawImage(glowSprite('#fff1cf', 64, 0.2), x - r2, y - r2, r2 * 2, r2 * 2);
  g.restore();
  return a;
}
