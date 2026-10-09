// Shared graphic components: paper cards, silhouettes (illustrative, not portraits),
// newspaper mastheads, icons, info panels.
import { W, H, PAL, clamp, lerp, ease, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, measure, vtext, noise } from './engine.js';
import { paper, agedPaper } from './textures.js';
import { seal, brushWrite, hanzi } from './brush.js';

// paper card with drop shadow; returns nothing (draws at x,y top-left)
export function card(g, x, y, w, h, o = {}) {
  const tex = o.aged ? agedPaper({ w: Math.round(w), h: Math.round(h), seed: o.seed || 3, base: o.base || '#e4d4ae' }) : paper({ w: Math.round(w), h: Math.round(h), seed: o.seed || 3, base: o.base || '#ece2cb', edge: 0.12 });
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = o.shadow ?? 30;
  g.shadowOffsetY = (o.shadow ?? 30) * 0.4;
  g.drawImage(tex, x, y, w, h);
  g.restore();
  if (o.border !== false) {
    g.save();
    g.globalAlpha *= o.alpha ?? 1;
    g.strokeStyle = o.borderColor || 'rgba(120,85,40,0.45)';
    g.lineWidth = 2;
    g.strokeRect(x + 14, y + 14, w - 28, h - 28);
    g.restore();
  }
}

// dark translucent panel
export function panel(g, x, y, w, h, a = 0.6, o = {}) {
  g.save();
  g.fillStyle = `rgba(10,8,6,${a})`;
  roundRect(g, x, y, w, h, o.r ?? 6);
  g.fill();
  if (o.border !== false) {
    g.strokeStyle = rgba(o.borderColor || PAL.gold, o.borderA ?? 0.5);
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

// Bust silhouette, front view. kind: 'skullcap' | 'bare' | 'official' | 'imperial' | 'lady'
// (x,y) = centre of head; s = scale (head height ~ 120*s)
const bustCache = new Map();
export function bust(g0, x, y, s, kind = 'skullcap', o = {}) {
  // draw into an offscreen canvas so the rim light only touches the silhouette
  const key = kind + JSON.stringify(o);
  let off = bustCache.get(key);
  if (!off) {
    off = makeCanvas(520, 560);
    drawBust(off.g, 260, 220, 1, kind, o);
    bustCache.set(key, off);
  }
  g0.save();
  g0.translate(x - 260 * s, y - 220 * s);
  g0.scale(s, s);
  g0.drawImage(off.c, 0, 0);
  g0.restore();
}
function drawBust(g, x, y, s, kind, o) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const col = o.color || '#120e0b';
  const gr = g.createLinearGradient(-200, -120, 200, 300);
  gr.addColorStop(0, o.rim ? rgba(o.rim, 0.9) : col);
  gr.addColorStop(0.18, col);
  gr.addColorStop(1, col);
  g.fillStyle = gr;
  // shoulders & robe
  g.beginPath();
  g.moveTo(-34, 50);
  g.bezierCurveTo(-40, 85, -120, 95, -175, 130);
  g.bezierCurveTo(-215, 160, -230, 260, -235, 330);
  g.lineTo(235, 330);
  g.bezierCurveTo(230, 260, 215, 160, 175, 130);
  g.bezierCurveTo(120, 95, 40, 85, 34, 50);
  g.closePath();
  g.fill();
  // neck
  g.fillRect(-30, 30, 60, 50);
  // head
  g.beginPath();
  g.ellipse(0, -10, 54, 70, 0, 0, Math.PI * 2);
  g.fill();
  // ears
  g.beginPath();
  g.ellipse(-55, 0, 9, 18, 0, 0, Math.PI * 2);
  g.ellipse(55, 0, 9, 18, 0, 0, Math.PI * 2);
  g.fill();
  if (kind === 'skullcap') {
    g.beginPath();
    g.ellipse(0, -48, 60, 40, 0, Math.PI, 0);
    g.fill();
    g.fillRect(-60, -50, 120, 10);
    g.beginPath();
    g.arc(0, -90, 9, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'official') {
    // winter official hat with upturned brim and finial
    g.beginPath();
    g.moveTo(-78, -40);
    g.quadraticCurveTo(-80, -62, -60, -66);
    g.lineTo(60, -66);
    g.quadraticCurveTo(80, -62, 78, -40);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(0, -66, 56, 34, 0, Math.PI, 0);
    g.fill();
    g.fillRect(-4, -122, 8, 20);
    g.beginPath();
    g.arc(0, -126, 10, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'imperial') {
    // conical summer hat (凉帽) with finial and fringe
    g.beginPath();
    g.moveTo(-105, -30);
    g.quadraticCurveTo(0, -150, 105, -30);
    g.quadraticCurveTo(0, -48, -105, -30);
    g.fill();
    g.fillRect(-5, -140, 10, 26);
    g.beginPath();
    g.arc(0, -146, 11, 0, Math.PI * 2);
    g.fill();
    if (o.accent) {
      g.strokeStyle = rgba(o.accent, 0.55);
      g.lineWidth = 2;
      for (let i = -8; i <= 8; i++) {
        g.beginPath();
        g.moveTo(i * 5, -118);
        g.lineTo(i * 11, -42);
        g.stroke();
      }
    }
  } else if (kind === 'lady') {
    // 大拉翅 headdress: wide flat board above the head
    g.beginPath();
    g.moveTo(-150, -95);
    g.lineTo(150, -95);
    g.quadraticCurveTo(160, -130, 120, -150);
    g.lineTo(-120, -150);
    g.quadraticCurveTo(-160, -130, -150, -95);
    g.fill();
    g.fillRect(-55, -100, 110, 50);
    // tassel on the side
    g.fillRect(118, -95, 10, 70);
    g.beginPath();
    g.arc(-90, -110, 16, 0, Math.PI * 2);
    g.arc(-50, -118, 12, 0, Math.PI * 2);
    g.fill();
  }
  // robe collar line + rim light
  if (o.rim) {
    g.globalCompositeOperation = 'source-atop';
    const rg = g.createLinearGradient(-240, 0, -120, 0);
    rg.addColorStop(0, rgba(o.rim, 0.45));
    rg.addColorStop(1, rgba(o.rim, 0));
    g.fillStyle = rg;
    g.fillRect(-260, -220, 160, 560);
    const rg2 = g.createLinearGradient(0, -160, 0, -40);
    rg2.addColorStop(0, rgba(o.rim, 0.35));
    rg2.addColorStop(1, rgba(o.rim, 0));
    g.fillStyle = rg2;
    g.fillRect(-260, -220, 520, 200);
  }
  g.restore();
}

// Old newspaper masthead block (vertical title in frame) — schematic, no fabricated content
export function masthead(g, x, y, w, h, title, sub, p, o = {}) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha *= clamp(p * 2);
  const sc = lerp(0.9, 1, ease.out(clamp(p * 1.5)));
  g.translate(x + w / 2, y + h / 2);
  g.rotate(o.rot ?? 0);
  g.scale(sc, sc);
  g.translate(-w / 2, -h / 2);
  card(g, 0, 0, w, h, { aged: true, seed: o.seed || 9, shadow: 24, border: false });
  // page columns (abstract text lines, not real text)
  const rnd = mulberry32(o.seed || 9);
  g.strokeStyle = 'rgba(40,30,20,0.28)';
  g.lineWidth = 3;
  const tw = w * 0.32;
  for (let cx = 22; cx < w - tw - 20; cx += 16) {
    let cy = 24;
    while (cy < h - 30) {
      const len = 10 + rnd() * 40;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, Math.min(h - 26, cy + len));
      g.stroke();
      cy += len + 6 + rnd() * 6;
    }
  }
  // title box at right
  g.strokeStyle = 'rgba(60,30,20,0.85)';
  g.lineWidth = 3;
  g.strokeRect(w - tw - 12, 16, tw, h - 32);
  vtext(g, title, w - tw / 2 - 12, 26, { size: Math.min(tw * 0.62, (h - 60) / [...title].length), color: '#2a160e', family: FONTS.serifTC, weight: 900 });
  g.restore();
  if (sub) text(g, sub, x + w / 2, y + h + 38, { size: 24, align: 'center', color: o.subColor || PAL.ink, weight: 700, alpha: clamp(p * 2 - 0.5) });
}

// Book cover (thread-bound)
export function bookCover(g, x, y, w, h, title, p, o = {}) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha *= clamp(p * 2);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 20;
  g.shadowOffsetY = 8;
  g.fillStyle = o.color || '#2d3b52';
  g.fillRect(x, y, w, h);
  g.shadowColor = 'transparent';
  // binding threads
  g.strokeStyle = 'rgba(230,220,200,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const yy = y + h * (0.15 + i * 0.23);
    g.beginPath();
    g.moveTo(x + w - 14, yy);
    g.lineTo(x + w, yy);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x + w - 14, y);
  g.lineTo(x + w - 14, y + h);
  g.stroke();
  // title slip
  const sw = w * 0.32, sh = h * 0.62;
  g.fillStyle = '#efe4c8';
  g.fillRect(x + w * 0.12, y + h * 0.08, sw, sh);
  vtext(g, title, x + w * 0.12 + sw / 2, y + h * 0.08 + 10, { size: Math.min(sw * 0.7, (sh - 20) / [...title].length), color: '#1a120c', family: FONTS.serifTC, weight: 800 });
  g.restore();
}

// ---------------------------------------------------------------- icons (line-art, ink style)
export function gear(g, x, y, r, rot, color = PAL.ink, teeth = 10) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.18;
    g.arc(0, 0, rr, a0, a1);
  }
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function factory(g, x, y, s, t, color = PAL.ink, smokeOn = true) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  // saw-tooth roof building
  g.beginPath();
  g.moveTo(-120, 0);
  g.lineTo(-120, -60);
  for (let i = 0; i < 4; i++) { g.lineTo(-120 + i * 50 + 50, -90); g.lineTo(-120 + i * 50 + 50, -60); }
  g.lineTo(100, -60);
  g.lineTo(100, 0);
  g.closePath();
  g.fill();
  g.fillRect(60, -150, 22, 90);
  g.fillRect(20, -125, 16, 65);
  g.restore();
  if (smokeOn) {
    for (let k = 0; k < 6; k++) {
      const ph = (t * 0.5 + k / 6) % 1;
      g.save();
      g.globalAlpha *= (1 - ph) * 0.35;
      g.fillStyle = '#6b6158';
      g.beginPath();
      g.arc(x + (71 + ph * 60 + Math.sin(ph * 6 + k) * 8) * s, y + (-155 - ph * 140) * s, (10 + ph * 34) * s, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}

export function soldier(g, x, y, s, kind = 'rifle', color = PAL.ink, step = 0) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  // head + hat
  g.beginPath();
  g.arc(0, -150, 13, 0, Math.PI * 2);
  g.fill();
  if (kind === 'rifle') {
    g.fillRect(-15, -170, 30, 8);
  } else {
    g.beginPath();
    g.moveTo(-22, -158);
    g.quadraticCurveTo(0, -190, 22, -158);
    g.fill();
  }
  // body
  g.beginPath();
  g.moveTo(-18, -135);
  g.lineTo(18, -135);
  g.lineTo(22, -70);
  g.lineTo(-22, -70);
  g.closePath();
  g.fill();
  // legs (walking)
  g.lineWidth = 12;
  const a = Math.sin(step) * 0.35;
  g.beginPath();
  g.moveTo(-8, -72);
  g.lineTo(-8 + Math.sin(a) * 70, 0);
  g.moveTo(8, -72);
  g.lineTo(8 - Math.sin(a) * 70, 0);
  g.stroke();
  g.lineWidth = 9;
  if (kind === 'rifle') {
    g.beginPath();
    g.moveTo(18, -130);
    g.lineTo(30, -95);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(32, -200);
    g.lineTo(26, -60);
    g.stroke();
  } else if (kind === 'spear') {
    g.beginPath();
    g.moveTo(18, -130);
    g.lineTo(32, -100);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(40, -230);
    g.lineTo(34, -10);
    g.stroke();
    g.beginPath();
    g.moveTo(40, -250);
    g.lineTo(46, -225);
    g.lineTo(34, -225);
    g.closePath();
    g.fill();
  } else if (kind === 'bow') {
    g.lineWidth = 4;
    g.beginPath();
    g.arc(-30, -110, 50, -1.2, 1.2);
    g.stroke();
  }
  g.restore();
}

// Train / railway
export function rails(g, pts, p, color = PAL.ink) {
  if (p <= 0) return;
  let L = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
  const target = L * clamp(p);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 3;
  // sleepers
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = segs[i - 1];
    const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    for (let u = 0; u < d; u += 18) {
      if (acc + u > target) break;
      const x = pts[i - 1][0] + Math.cos(ang) * u, y = pts[i - 1][1] + Math.sin(ang) * u;
      g.beginPath();
      g.moveTo(x - Math.sin(ang) * 12, y + Math.cos(ang) * 12);
      g.lineTo(x + Math.sin(ang) * 12, y - Math.cos(ang) * 12);
      g.stroke();
    }
    acc += d;
  }
  // rails
  for (const off of [-7, 7]) {
    g.beginPath();
    let a2 = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = segs[i - 1];
      const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      const nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off;
      if (i === 1) g.moveTo(pts[0][0] + nx, pts[0][1] + ny);
      if (a2 + d >= target) {
        const k = (target - a2) / d;
        g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k + nx, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k + ny);
        break;
      }
      g.lineTo(pts[i][0] + nx, pts[i][1] + ny);
      a2 += d;
    }
    g.stroke();
  }
  g.restore();
}

// red brush strike-through across a text box
export function strike(g, x0, y0, x1, y1, p, color = PAL.red, w = 10) {
  if (p <= 0) return;
  const e = ease.out(clamp(p));
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = w;
  g.globalAlpha *= 0.9;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 8, lerp(x0, x1, e), lerp(y0, y1, e));
  g.stroke();
  g.restore();
}

// Tag line: small label with accent bar
export function tagLabel(g, str, x, y, p, o = {}) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha *= clamp(p * 2);
  g.fillStyle = o.accent || PAL.red;
  g.fillRect(x, y - (o.size || 28) * 0.85, 5, (o.size || 28) * 1.05);
  text(g, str, x + 16, y, { size: o.size || 28, color: o.color || PAL.paper, weight: o.weight || 700, spacing: o.spacing ?? 2, family: o.family || FONTS.serif, shadow: o.shadow });
  g.restore();
}

// Horizontal timeline axis with ticks; returns x(date) mapping
export function dayAxis(g, x0, x1, y, p, o = {}) {
  const start = Date.UTC(1898, 5, 11);
  const days = 103;
  const X = (d) => lerp(x0, x1, (d - 1) / (days - 1));
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.strokeStyle = o.color || PAL.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(lerp(x0, x1, ease.inOut(clamp(p))), y);
  g.stroke();
  for (let d = 1; d <= days; d++) {
    const x = X(d);
    if ((x - x0) / (x1 - x0) > p) break;
    const date = new Date(start + (d - 1) * 864e5);
    const first = date.getUTCDate() === 1;
    g.lineWidth = first ? 2.5 : 1;
    g.beginPath();
    g.moveTo(x, y - (first ? 18 : 7));
    g.lineTo(x, y + (first ? 18 : 7));
    g.stroke();
    if (first || d === 1) text(g, `${date.getUTCMonth() + 1}月`, x, y + 50, { size: 24, align: 'center', color: o.color || PAL.ink, weight: 700 });
  }
  g.restore();
  return X;
}
