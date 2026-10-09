// 第一章 山河危局
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure } from '../engine.js';
import { darkGround, agedPaper, puff, paper } from '../textures.js';
import { MapCam, camPath, featPath, graticule, territory, QING, WORLD, LAND, PLACES, marker, callout, placeLabel, coastRipples, country, linePath, mercY, dashedRoute, smoothGeo } from '../mapkit.js';
import { brushArrow, brushLine, brushWrite, hanzi, seal, inkRing } from '../brush.js';
import { embers, smoke, flash, glowSprite, candle, dust } from '../fx.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };

// ---------------------------------------------------------------- shared: dark map base
export function darkMap(g, cam, t, o = {}) {
  g.drawImage(darkGround({ base: '#0a0e13', seed: 4 }), 0, 0);
  graticule(g, cam, { step: 5, alpha: 0.07 });
  const others = WORLD.features.filter((f) => !['China', 'Taiwan', 'Mongolia', 'Hong Kong', 'Macao'].includes(f.properties.name));
  const qing = QING().filter((f) => !(o.noTaiwan && f.properties.name === 'Taiwan'));
  const pOthers = featPath(cam, others, 1.5);
  const pQing = featPath(cam, qing, 1.5);
  const pLand = featPath(cam, LAND.features, 1.5);
  coastRipples(g, pLand, { color: '#7fa0b8', alpha: 0.05, widths: [6, 16, 30] });
  territory(g, pOthers, { fill: '#1d1a16', border: 'rgba(201,164,92,0.25)', borderW: 2 });
  territory(g, pQing, { fill: o.qingFill || '#2e2319', border: o.qingBorder || 'rgba(190,70,45,0.75)', borderW: 7 });
  g.save();
  g.strokeStyle = rgba(PAL.gold, 0.6);
  g.lineWidth = 1.3;
  g.stroke(pLand);
  g.restore();
  return { pQing, pLand };
}

// clouds floating above the map at altitude -> natural parallax
export function mapClouds(g, cam, t, o = {}) {
  const rnd = mulberry32(o.seed ?? 21);
  const n = o.count ?? 14;
  g.save();
  for (let i = 0; i < n; i++) {
    const lon = (o.lon0 ?? 100) + rnd() * (o.lonSpan ?? 45) + t * (o.drift ?? 0.25);
    const lat = (o.lat0 ?? 22) + rnd() * (o.latSpan ?? 28);
    const alt = (o.alt ?? 6) + rnd() * (o.altSpan ?? 8);
    const [x, y, z] = cam.pm(lon, mercY(lat), alt);
    if (isNaN(x) || z < 2) continue;
    const s = (cam.F * (o.size ?? 7) * (0.6 + rnd() * 0.8)) / z;
    if (x < -s || x > W + s || y < -s || y > H + s) continue;
    g.globalAlpha = (o.alpha ?? 0.22) * clamp((z - 2) / 6);
    g.drawImage(puff(256, 30 + (i % 4), { color: o.color || '#9aa3ad' }), x - s / 2, y - s / 2, s, s * 0.6);
  }
  g.restore();
}

function yearTitle(g, year, sub, x, y, p, o = {}) {
  if (p <= 0) return;
  g.save();
  const a = clamp(p * 2);
  g.globalAlpha *= a;
  text(g, year, x, y, { size: o.size || 120, family: FONTS.brush, color: o.color || PAL.goldLight, shadow: { color: 'rgba(0,0,0,0.8)', blur: 18 }, spacing: 4 });
  g.fillStyle = PAL.red;
  g.fillRect(x + 6, y + 26, 240 * ease.out(clamp(p * 1.5)), 4);
  if (sub) revealText(g, sub, x + 6, y + 78, clamp(p * 1.4 - 0.2), { size: 40, color: PAL.paper, weight: 700, spacing: 6, shadow: { color: 'rgba(0,0,0,0.8)', blur: 10 } });
  g.restore();
}

// ================================================================ S01 war map
const S01 = {
  trans: 'cut',
  draw(g, t, sc) {
    const c0 = cue(sc, 0), c1 = cue(sc, 1), c2 = cue(sc, 2);
    const D = sc.dur;
    const cam = new MapCam(camPath([
      { t: 0, lon: 117, lat: 34, dist: 72, tilt: 6, heading: -4, fov: 40 },
      { t: c0.start + 1.2, lon: 121.5, lat: 37.2, dist: 40, tilt: 28, heading: 0, fov: 40 },
      { t: c2.start, lon: 124.5, lat: 36.4, dist: 30, tilt: 34, heading: 4, fov: 40 },
      { t: D + 1, lon: 126.5, lat: 35.6, dist: 28, tilt: 36, heading: 6, fov: 40 },
    ], t));
    // camera shake on flashes
    const shakeT = [c0.start + 1.4, c0.start + 1.9, c1.start + 0.6, c1.start + 1.0];
    let sh = 0;
    for (const s of shakeT) if (t > s && t < s + 0.5) sh += (1 - (t - s) / 0.5) * 4;
    cam.set({ ox: noise.n2(t * 30, 1) * sh, oy: noise.n2(1, t * 30) * sh });

    darkMap(g, cam, t);
    // country labels
    const lab = (name, ll, p, o = {}) => {
      const [x, y] = cam.p(...ll);
      placeLabel(g, x, y, name, p, { size: o.size || 34, color: o.color || 'rgba(232,207,148,0.75)', align: 'center', dx: 0, dy: 0, spacing: o.spacing ?? 18, family: FONTS.serif, weight: 700 });
    };
    const la = smoothstep(1.0, 2.5, t);
    lab('大  清', [109, 35.5], la, { size: 52, spacing: 30, color: 'rgba(232,207,148,0.55)' });
    lab('日本', [137.5, 36.2], la);
    lab('朝鲜', [127.2, 40.2], la, { size: 28, spacing: 8 });
    lab('俄国', [128, 49.5], la, { size: 30 });
    lab('渤海', [119.6, 38.8], la * 0.8, { size: 24, spacing: 6, color: 'rgba(160,180,200,0.6)' });
    lab('黄海', [123.2, 35.5], la * 0.8, { size: 24, spacing: 6, color: 'rgba(160,180,200,0.6)' });

    const P = (k) => cam.p(...PLACES[k]);
    // ---- 1894: land campaign arrow through Korea into Liaodong
    const a1 = prog(t, c0.start + 0.3, c0.start + 3.6, ease.inOut);
    brushArrow(g, linePath(cam, smoothGeo([[126.9, 37.2], [126.3, 38.3], PLACES.平壤, [124.9, 39.8], PLACES.鸭绿江, [123.6, 40.5], PLACES.海城], 6)), 13, a1, 'rgba(196,44,32,0.92)', { seed: 3 });
    // naval: Hiroshima -> Huayuankou -> Lüshun
    const a2 = prog(t, c0.start + 1.0, c1.start + 0.4, ease.inOut);
    dashedRoute(g, linePath(cam, smoothGeo([PLACES.广岛, [129.0, 34.2], [125.6, 35.4], [124.2, 37.9], PLACES.花园口, [121.9, 39.1], PLACES.旅顺])), a2, { color: 'rgba(214,72,58,0.85)', width: 4, t });
    // Yellow Sea battle flashes (1894.9.17)
    const [hx, hy] = P('黄海');
    const tb = c0.start + 1.3;
    for (let k = 0; k < 7; k++) {
      const r = mulberry32(k + 3);
      flash(g, hx + (r() - 0.5) * 70, hy + (r() - 0.5) * 40, t, tb + k * 0.33 + r() * 0.2, { size: 70 + r() * 70 });
    }
    callout(g, hx, hy, 40, -190, '1894.9  黄海海战', '北洋舰队遭受重创', prog(t, tb + 0.4, tb + 1.2, ease.out), { size: 30 });
    // ---- 1895: Weihaiwei
    const a3 = prog(t, c1.start - 0.2, c1.start + 1.6, ease.inOut);
    dashedRoute(g, linePath(cam, smoothGeo([PLACES.广岛, [128.6, 33.6], [125.2, 35.4], [123.4, 36.6], PLACES.荣成, [122.3, 37.4]])), a3, { color: 'rgba(214,72,58,0.85)', width: 4, t });
    const [wx, wy] = P('威海卫');
    for (let k = 0; k < 6; k++) {
      const r = mulberry32(k + 40);
      flash(g, wx + (r() - 0.5) * 60, wy + (r() - 0.5) * 40, t, c1.start + 0.5 + k * 0.28, { size: 80 + r() * 60 });
    }
    marker(g, wx, wy, prog(t, c1.start + 0.5, c1.start + 1.0), { color: PAL.red, t });
    callout(g, wx, wy, -330, 120, '1895.2  威海卫之战', '北洋舰队全军覆没', prog(t, c1.start + 0.7, c1.start + 1.5, ease.out), { size: 30 });
    // ---- Shimonoseki
    const [mx, my] = P('马关');
    marker(g, mx, my, prog(t, c2.start, c2.start + 0.6), { color: PAL.gold, t });
    callout(g, mx, my, 60, 150, '1895.4.17  签订《马关条约》', '日本马关（今下关）', prog(t, c2.start + 0.2, c2.start + 1.2, ease.out), { size: 30, accent: PAL.gold });

    mapClouds(g, cam, t, { lon0: 105, lonSpan: 40, lat0: 25, latSpan: 25, alt: 5, altSpan: 9, alpha: 0.2 });
    embers(g, t, { count: 40, alpha: 0.5 * smoothstep(c0.start, c0.start + 1.5, t) });
    yearTitle(g, '1894', '甲午中日战争', 130, 820, prog(t, c0.start - 0.3, c0.start + 1.3, ease.out) * (1 - smoothstep(c1.start + 0.3, c1.start + 0.9, t)));
    yearTitle(g, '1895', '甲午战败', 130, 820, prog(t, c1.start + 0.5, c1.start + 1.6, ease.out));
  },
};

// ================================================================ S02 treaty
const S02 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const c0 = cue(sc, 0);
    const D = sc.dur;
    // desk
    g.drawImage(darkGround({ base: '#1a120c', seed: 8 }), 0, 0);
    radialGlow(g, 260, 760, 900, '#ff9d45', 0.18 + 0.02 * Math.sin(t * 9));
    // card with slow push-in
    const sc2 = lerp(0.97, 1.04, ease.inOutSine(t / (D + 1)));
    g.save();
    g.translate(W / 2 + 40, H / 2 - 30);
    g.scale(sc2, sc2);
    g.rotate(-0.012);
    const cw = 1380, ch = 760;
    const card = agedPaper({ w: cw, h: ch, seed: 15, base: '#e4d3ac' });
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 50;
    g.shadowOffsetY = 20;
    g.globalAlpha = clamp(t * 3);
    g.drawImage(card, -cw / 2, -ch / 2);
    g.shadowColor = 'transparent';
    const L = -cw / 2 + 80, T = -ch / 2 + 110;
    text(g, '《马关条约》主要内容', L, T, { size: 54, family: FONTS.serif, weight: 900, color: PAL.ink, spacing: 4 });
    text(g, '1895年4月17日 · 中日两国代表签订于日本马关（今下关）', L, T + 50, { size: 26, color: '#5a4630', weight: 500 });
    g.fillStyle = PAL.redDeep;
    g.fillRect(L, T + 72, 760, 3);
    const items = [
      ['一', '清政府承认朝鲜“独立自主”'],
      ['二', '割让辽东半岛、台湾全岛及所有附属各岛屿、|澎湖列岛'],
      ['三', '赔偿日本军费库平银二亿两'],
      ['四', '开放沙市、重庆、苏州、杭州为商埠；|允许日本在通商口岸开设工厂'],
    ];
    items.forEach(([n, s], i) => {
      const p = prog(t, 0.25 + i * 0.35, 0.85 + i * 0.35, ease.out);
      const y = T + 150 + i * 92;
      const hl = (i === 1 || i === 2) ? smoothstep(c0.start + (i === 1 ? 0.0 : 1.4), c0.start + (i === 1 ? 0.6 : 2.0), t) : 0;
      if (hl > 0) {
        g.save();
        g.globalAlpha = hl * 0.28;
        g.fillStyle = PAL.red;
        g.fillRect(L - 14, y - 40, (i === 1 ? 740 : 470) * ease.out(hl), 56);
        g.restore();
      }
      text(g, n, L, y, { size: 34, family: FONTS.brush, color: PAL.redDeep, alpha: p });
      const lines = s.includes('|') ? s.split('|') : [s];
      lines.forEach((ln, k) => revealText(g, ln, L + 52, y + k * 42, p, { size: 33, color: PAL.ink, weight: 600, spread: 0.5 }));
    });
    text(g, '注：辽东半岛后经俄、德、法三国干涉，清政府以白银三千万两“赎回”。', L, ch / 2 - 46, { size: 22, color: '#6a5538', alpha: prog(t, 2.0, 2.8) });
    // mini map inset (right): Taiwan & Penghu ceded
    const mx = cw / 2 - 470, my = -ch / 2 + 120, mw = 400, mh = 540;
    g.save();
    g.beginPath();
    g.rect(mx, my, mw, mh);
    g.clip();
    g.fillStyle = 'rgba(120,95,60,0.12)';
    g.fillRect(mx, my, mw, mh);
    g.translate(mx + mw / 2 - W / 2, my + mh / 2 - H / 2);
    const cam = new MapCam({ lon: 121.5, lat: 31.0, dist: 46, tilt: 0, fov: 26 });
    const land = featPath(cam, WORLD.features);
    g.fillStyle = 'rgba(160,130,90,0.35)';
    g.fill(land);
    g.strokeStyle = 'rgba(60,40,20,0.6)';
    g.lineWidth = 1.2;
    g.stroke(land);
    const pc = prog(t, c0.start, c0.start + 0.8);
    const tw = featPath(cam, [country('Taiwan')]);
    g.fillStyle = rgba(PAL.red, 0.75 * pc);
    g.fill(tw);
    const [px, py] = cam.p(...PLACES.澎湖);
    g.fillStyle = rgba(PAL.red, pc);
    g.beginPath();
    g.arc(px, py, 6, 0, 7);
    g.fill();
    // Liaodong hatch
    const [lx, ly] = cam.p(122.3, 40.0);
    g.strokeStyle = rgba(PAL.red, 0.5 * pc);
    g.setLineDash([6, 5]);
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(lx, ly, 40, 30, 0.6, 0, 7);
    g.stroke();
    g.setLineDash([]);
    g.restore();
    g.strokeStyle = 'rgba(70,50,30,0.5)';
    g.lineWidth = 2;
    g.strokeRect(mx, my, mw, mh);
    text(g, '割让地区示意', mx + 14, my + 34, { size: 22, color: '#4a3826', weight: 700 });
    g.restore();
    {
      const off = (ll) => { const q = cam.p(...ll); return [q[0] + mx + mw / 2 - W / 2, q[1] + my + mh / 2 - H / 2]; };
      const [tx, ty] = off([122.6, 23.6]);
      text(g, '台湾', tx, ty, { size: 26, color: PAL.redDeep, weight: 800, alpha: pc });
      const [qx, qy] = off([117.6, 23.2]);
      text(g, '澎湖', qx, qy, { size: 20, color: PAL.redDeep, weight: 700, alpha: pc });
      const [lx2, ly2] = off([123.6, 40.6]);
      text(g, '辽东半岛', lx2, ly2, { size: 20, color: PAL.redDeep, weight: 700, alpha: pc * 0.85 });
    }
    // big indemnity figure
    const pm = prog(t, c0.start + 1.3, c0.start + 2.6, ease.out);
    if (pm > 0) {
      const v = Math.round(200000000 * ease.out(pm));
      g.save();
      g.globalAlpha = clamp(pm * 3);
      const num = v.toLocaleString('en-US');
      const nw = measure(g, num, { size: 72, family: FONTS.serif, weight: 900 });
      const xr = W - 110;
      text(g, '两', xr, 104, { size: 40, family: FONTS.serif, weight: 900, color: PAL.paper, align: 'right', shadow: { color: '#000', blur: 10 } });
      text(g, num, xr - 52, 104, { size: 72, family: FONTS.serif, weight: 900, color: PAL.redLight, align: 'right', shadow: { color: '#000', blur: 16 } });
      text(g, '赔款', xr - 52 - nw - 16, 94, { size: 40, family: FONTS.serif, weight: 900, color: PAL.paper, align: 'right', shadow: { color: '#000', blur: 10 } });
      g.restore();
    }
    candle(g, 150, 690, t, 1.1, { height: 300 });
  },
};

// ================================================================ S03 hook
const S03 = {
  trans: 'black',
  transDur: 1.0,
  draw(g, t, sc) {
    const c0 = cue(sc, 0), c1 = cue(sc, sc.cues.length - 1);
    g.fillStyle = '#080706';
    g.fillRect(0, 0, W, H);
    smoke(g, t, { count: 9, alpha: 0.12, color: '#8c8478', size: 900, vx: 14, seed: 4 });
    // 1898 big
    const p1 = prog(t, 0.2, 1.6, ease.out);
    const up = prog(t, c1.start - 0.4, c1.start + 0.6, ease.inOut);
    g.save();
    const s = lerp(1, 0.42, up);
    g.translate(W / 2, lerp(H / 2 + 60, 210, up));
    g.scale(s, s);
    // brush sweep reveal mask
    g.beginPath();
    g.rect(-700, -300, 1400 * p1, 420);
    g.clip();
    text(g, '1898', 0, 80, { size: 330, family: FONTS.brush, color: PAL.goldLight, align: 'center', spacing: 10, shadow: { color: 'rgba(201,164,92,0.35)', blur: 40 } });
    g.restore();
    revealText(g, '光绪二十四年 · 戊戌', W / 2, lerp(H / 2 + 170, 300, up), prog(t, 1.0, 2.2) * (1 - up * 0.3), { size: 36, align: 'center', color: PAL.paper2, spacing: 10, weight: 500 });
    // calendar flip: 6.11 -> 9.21 (103 days, inclusive)
    const pf = prog(t, c1.start + 0.2, c1.end - 0.2, (x) => ease.inOut(x));
    if (up > 0.2) {
      const day = Math.max(1, Math.min(103, Math.round(1 + pf * 102)));
      const date = new Date(Date.UTC(1898, 5, 11 + day - 1));
      const m = date.getUTCMonth() + 1, d = date.getUTCDate();
      const ca = clamp((up - 0.2) * 2);
      const cx = W / 2 - 330, cy = 430, cw = 300, chh = 380;
      g.save();
      g.globalAlpha = ca;
      // calendar body
      g.fillStyle = '#6e1510';
      roundRect(g, cx - 10, cy - 40, cw + 20, 60, 8);
      g.fill();
      g.drawImage(paper({ w: cw, h: chh, seed: 2, base: '#efe4cb', edge: 0.1 }), cx, cy);
      text(g, `${m}月`, cx + cw / 2, cy + 70, { size: 46, align: 'center', color: PAL.redDeep, weight: 800 });
      text(g, String(d), cx + cw / 2, cy + 250, { size: 170, align: 'center', color: PAL.ink, weight: 900, family: FONTS.serif });
      text(g, '1898', cx + cw / 2, cy + 330, { size: 28, align: 'center', color: '#6a5538', weight: 600, spacing: 6 });
      // flipping page
      const ph = fractFlip(pf * 102);
      if (pf > 0 && pf < 1) {
        g.save();
        g.translate(cx, cy);
        g.transform(1, 0, 0, Math.max(0.02, 1 - ph), 0, 0);
        g.globalAlpha = ca * (1 - ph) * 0.9;
        g.fillStyle = '#e6d9bc';
        g.fillRect(0, 0, cw, chh);
        g.restore();
      }
      g.restore();
      // day counter
      const big = day === 103 ? prog(t, c1.end - 0.4, c1.end + 0.2, ease.outBack) : 0;
      g.save();
      g.globalAlpha = ca;
      const nx = W / 2 - 40;
      text(g, '变法第', nx, 500, { size: 44, color: PAL.paper2, weight: 600, spacing: 6 });
      const ns = 230 + big * 30;
      const numW = measure(g, '103', { size: ns, family: FONTS.brush });
      text(g, String(day), nx, 720, { size: ns, family: FONTS.brush, color: day === 103 ? PAL.redLight : PAL.goldLight, shadow: { color: 'rgba(0,0,0,0.6)', blur: 20 } });
      hanzi(g, '天', nx + numW + 30, 570, 150, prog(t, c1.end - 0.6, c1.end + 0.6), { color: '#e9dcc0', bleed: 0.2 });
      text(g, `公历 1898年${m}月${d}日`, nx + 4, 790, { size: 30, color: rgba(PAL.gold, 0.85), spacing: 4 });
      g.restore();
    }
    // question mark finish
    const pq = prog(t, c1.end + 0.1, c1.end + 0.9, ease.out);
    if (pq > 0) revealText(g, '为何只持续了一百零三天？', W / 2, 900, pq, { size: 44, align: 'center', color: PAL.paper, spacing: 10, weight: 700, alpha: 0.95 });
    dust(g, t, { count: 40, alpha: 0.3 });
  },
};
function fractFlip(x) {
  return x - Math.floor(x);
}

// ================================================================ S04 title
const S04 = {
  trans: 'ink',
  transDur: 1.2,
  noHud: true,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(darkGround({ base: '#0d0b09', seed: 12 }), 0, 0);
    radialGlow(g, W / 2, H / 2, 1100, '#7a5a2a', 0.18);
    dust(g, t, { count: 90, alpha: 0.5, color: '#e0c27e' });
    // scroll unroll
    const pu = prog(t, 0.0, 1.4, ease.inOut);
    const sw = 1560 * pu, sh = 470;
    const cx = W / 2, cy = H / 2 - 20;
    const push = lerp(1, 1.035, t / D);
    g.save();
    g.translate(cx, cy);
    g.scale(push, push);
    g.translate(-cx, -cy);
    if (sw > 4) {
      const pp = paper({ w: 1560, h: sh, seed: 33, base: '#efe5cf', edge: 0.12 });
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.7)';
      g.shadowBlur = 40;
      g.shadowOffsetY = 16;
      g.drawImage(pp, (1560 - sw) / 2, 0, sw, sh, cx - sw / 2, cy - sh / 2, sw, sh);
      g.restore();
      // silk border
      g.strokeStyle = 'rgba(140,100,50,0.45)';
      g.lineWidth = 3;
      g.strokeRect(cx - sw / 2 + 22, cy - sh / 2 + 22, Math.max(0, sw - 44), sh - 44);
    }
    // rollers
    for (const sgn of [-1, 1]) {
      const rx = cx + sgn * (sw / 2 + 12);
      const gr = g.createLinearGradient(rx - 18, 0, rx + 18, 0);
      gr.addColorStop(0, '#2a160c');
      gr.addColorStop(0.5, '#6b3d1f');
      gr.addColorStop(1, '#1d0f08');
      g.fillStyle = gr;
      roundRect(g, rx - 18, cy - sh / 2 - 34, 36, sh + 68, 10);
      g.fill();
      g.fillStyle = PAL.gold;
      g.fillRect(rx - 20, cy - sh / 2 - 46, 40, 16);
      g.fillRect(rx - 20, cy + sh / 2 + 30, 40, 16);
    }
    // title brush writing
    const size = 205;
    const tw = size * 1.06 * 3 + size;
    brushWrite(g, '戊戌变法', cx - tw / 2 - 30, cy - size / 2 - 60, size, prog(t, 1.2, 4.0, (x) => x), { gap: 1.06, color: '#16110d', bleed: 0.4 });
    // subtitle
    const ps = prog(t, 3.7, 4.8);
    if (ps > 0) {
      g.save();
      g.globalAlpha = ps;
      g.fillStyle = PAL.redDeep;
      g.fillRect(cx - 420, cy + 132, 120 * ps, 2);
      g.fillRect(cx + 260 + 120 * (1 - ps), cy + 132, 120 * ps, 2);
      g.restore();
      revealText(g, '改变中国的103天', cx - 30, cy + 146, ps, { size: 50, align: 'center', color: PAL.redDeep, spacing: 16, weight: 700, family: FONTS.serif });
    }
    seal(g, '百日维新', cx + tw / 2 - 40, cy - 140, 120, prog(t, 4.5, 5.1, (x) => x), { rot: 0.02 });
    g.restore();
    // producer credit (discreet)
    const pc = prog(t, 4.9, 5.8);
    text(g, '制作  hqy', W - 90, H - 70, { size: 24, align: 'right', color: PAL.goldLight, alpha: pc * 0.55, spacing: 4 });
  },
};

export default { S01_war_map: S01, S02_treaty: S02, S03_hook: S03, S04_title: S04 };
