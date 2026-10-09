// 第二章 救亡图存
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, agedPaper, darkGround, inkRidge, puff } from '../textures.js';
import { MapCam, camPath, featPath, graticule, territory, QING, WORLD, LAND, CHINA, PLACES, RIVERS, marker, callout, placeLabel, coastRipples, country, province, linePath, mercY, dashedRoute, smoothGeo } from '../mapkit.js';
import { brushWrite, hanzi, seal, brushLine, inkRing } from '../brush.js';
import { dust, smoke, filmDamage, candle, glowSprite } from '../fx.js';
import { card, panel, masthead, bookCover, tagLabel } from '../ui.js';
import { OldCity } from '../three/scenes3d.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };
const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

// ---------------------------------------------------------------- paper map base
export function paperMap(g, cam, o = {}) {
  g.drawImage(paper({ base: o.base || '#e9dcc0', seed: 41, mottle: 0.12, edge: 0.25 }), 0, 0);
  graticule(g, cam, { step: 5, color: '#6b5236', alpha: 0.12 });
  const pLand = featPath(cam, LAND.features, 1.5);
  coastRipples(g, pLand, { color: '#3a5a6a', alpha: 0.10, widths: [5, 12, 22] });
  g.save();
  g.fillStyle = 'rgba(245,236,214,0.85)';
  g.fill(pLand);
  g.restore();
  const qing = QING();
  const pQing = featPath(cam, qing, 1.5);
  g.save();
  g.fillStyle = o.qingFill || 'rgba(214,190,140,0.35)';
  g.fill(pQing);
  g.restore();
  if (o.provinces !== false) {
    const pProv = featPath(cam, CHINA.features, 2);
    g.save();
    g.strokeStyle = 'rgba(90,65,40,0.22)';
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    g.stroke(pProv);
    g.restore();
  }
  // rivers
  for (const k of ['长江', '黄河']) {
    const pts = linePath(cam, smoothGeo(RIVERS[k], 4));
    g.save();
    g.strokeStyle = 'rgba(60,90,110,0.45)';
    g.lineWidth = 2.2;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();
  }
  g.save();
  g.strokeStyle = 'rgba(40,30,20,0.75)';
  g.lineWidth = 1.4;
  g.stroke(pLand);
  g.restore();
  return { pLand, pQing };
}

// ================================================================ S05 old city (photo comes alive)
const S05 = {
  trans: 'ink',
  transDur: 1.2,
  tag: '艺术重现 · 非历史影像',
  grain: 0.1,
  init() { OldCity.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const img = OldCity.render(t * 0.9, { keys: [
      { t: 0, pos: [-2.5, 2.4, 72], look: [0, 9, -120], fov: 40 },
      { t: D, pos: [-0.6, 3.4, 44], look: [0, 12, -120], fov: 36 },
    ] });
    // photo print phase
    const pp = prog(t, 0.4, 2.2, ease.inOut);
    g.drawImage(darkGround({ base: '#17110c', seed: 19 }), 0, 0);
    const sc2 = lerp(0.6, 1.0, pp);
    const rot = lerp(-0.035, 0, pp);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(rot);
    g.scale(sc2, sc2);
    const bw = lerp(36, 0, pp);
    if (bw > 0.5) {
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 40;
      g.fillStyle = '#e8dfcc';
      g.fillRect(-W / 2 - bw, -H / 2 - bw, W + bw * 2, H + bw * 2.6);
      g.shadowColor = 'transparent';
    }
    g.drawImage(img, -W / 2, -H / 2);
    g.restore();
    filmDamage(g, t, { alpha: 0.5 });
    // crows crossing the sky
    for (let i = 0; i < 5; i++) {
      const r = mulberry32(i + 70);
      const x = -100 + ((t * (60 + r() * 30) + r() * 600) % (W + 200));
      const y = 150 + r() * 160 + Math.sin(t * 1.5 + i) * 10;
      const flap = Math.sin(t * 12 + i * 2) * 8;
      g.save();
      g.strokeStyle = 'rgba(25,20,15,0.85)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - 14, y - flap);
      g.quadraticCurveTo(x - 6, y - 4, x, y);
      g.quadraticCurveTo(x + 6, y - 4, x + 14, y - flap);
      g.stroke();
      g.restore();
    }
    const c0 = cue(sc, 0);
    tagLabel(g, '1895 · 北京', 110, 900, prog(t, c0.start, c0.start + 1) * (1 - smoothstep(D - 0.8, D, t)), { size: 32, shadow: { color: '#000', blur: 10 } });
  },
};

// ================================================================ S06 partition map
const SPHERES = [
  { name: '俄国', color: '#3d5a80', provs: ['黑龙江', '吉林', '辽宁', '内蒙古'], extra: ['Mongolia'], label: [113, 45.5] },
  { name: '德国', color: '#556b2f', provs: ['山东'], label: [118.2, 36.0] },
  { name: '英国', color: '#a33a2c', provs: ['江苏', '上海', '浙江', '安徽', '江西', '湖北', '湖南', '四川', '重庆'], label: [112.2, 30.2] },
  { name: '法国', color: '#4b3f7a', provs: ['云南', '广西', '广东', '海南'], label: [106.5, 23.6] },
  { name: '日本', color: '#b07a2a', provs: ['福建'], label: [118.2, 26.0] },
];
const S06 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1), l2 = lineCue(sc, 2);
    const cam = new MapCam(camPath([
      { t: 0, lon: 112, lat: 34, dist: 60, tilt: 22, heading: 0, fov: 40 },
      { t: l1.start + 0.3, lon: 119.5, lat: 35.2, dist: 26, tilt: 34, heading: 4, fov: 40 },
      { t: l2.start + 1.5, lon: 116.5, lat: 31, dist: 50, tilt: 26, heading: 0, fov: 40 },
      { t: D + 1, lon: 114.5, lat: 32, dist: 58, tilt: 22, heading: -2, fov: 40 },
    ], t));
    paperMap(g, cam);
    // spheres of influence (ink washes)
    const order = { 德国: l1.start + 0.2, 俄国: l2.start + 0.2, 英国: l2.start + 1.2, 法国: l2.start + 1.9, 日本: l2.start + 2.5 };
    for (const sp of SPHERES) {
      const st = Math.min(order[sp.name], l0.start + 0.5 + SPHERES.indexOf(sp) * 0.25 + 99);
      const p = prog(t, order[sp.name], order[sp.name] + 1.2, ease.out);
      if (p <= 0) continue;
      const feats = sp.provs.map(province).concat((sp.extra || []).map(country)).filter(Boolean);
      const path = featPath(cam, feats, 2);
      g.save();
      g.globalAlpha = 0.42 * p;
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = sp.color;
      g.fill(path);
      g.globalAlpha = 0.25 * p;
      g.lineWidth = 10;
      g.strokeStyle = sp.color;
      g.stroke(path);
      g.restore();
      const [lx, ly] = cam.p(...sp.label);
      placeLabel(g, lx, ly, sp.name, p, { size: 30, color: '#fffaf0', align: 'center', dx: 0, dy: 0, weight: 900, shadow: { color: rgba(sp.color, 0.9), blur: 10 } });
    }
    // leased ports
    const ports = [
      { k: '胶州湾', who: '德', title: '胶州湾', sub: '1897.11 德国强占，次年强租', t: l1.start + 0.5, dx: 60, dy: 80, c: '#556b2f' },
      { k: '旅顺', who: '俄', title: '旅顺 · 大连', sub: '1898.3 俄国强租', t: l2.start + 0.4, dx: -330, dy: -60, c: '#3d5a80' },
      { k: '威海卫', who: '英', title: '威海卫', sub: '1898.7 英国强租', t: l2.start + 1.4, dx: 90, dy: -70, c: '#a33a2c' },
      { k: '九龙', who: '英', title: '新界', sub: '1898.6 英国强租', t: l2.start + 2.0, dx: 70, dy: 70, c: '#a33a2c' },
      { k: '广州湾', who: '法', title: '广州湾', sub: '1898.4 法国强占，次年强租', t: l2.start + 2.4, dx: -360, dy: 60, c: '#4b3f7a' },
    ];
    for (const pt of ports) {
      const [x, y] = cam.p(...PLACES[pt.k]);
      const p = prog(t, pt.t, pt.t + 0.8, ease.out);
      marker(g, x, y, p, { color: pt.c, r: 8, t });
      callout(g, x, y, pt.dx, pt.dy, pt.title, pt.sub, p, { dark: false, size: 28, accent: pt.c });
    }
    {
      const [tx, ty] = cam.p(121.2, 23.2);
      placeLabel(g, tx, ty, '台湾（1895年割让日本）', prog(t, l2.start + 2.5, l2.start + 3.3), { size: 22, color: '#6b4a1a', weight: 800, shadow: { color: 'rgba(255,250,235,0.9)', blur: 6 } });
    }
    const [bx, by] = cam.p(...PLACES.北京);
    marker(g, bx, by, prog(t, 0.6, 1.2), { color: PAL.ink, r: 7, pulse: false });
    placeLabel(g, bx, by, '北京', prog(t, 0.6, 1.2), { size: 26, color: PAL.ink, shadow: { color: 'rgba(255,250,235,0.9)', blur: 6 } });
    // title + legend
    const pt0 = prog(t, 0.2, 1.2, ease.out);
    panel(g, 70, 110, 640, 118, 0.0, { border: false });
    text(g, '列强在华势力范围示意', 100, 170, { size: 46, weight: 900, color: PAL.ink, alpha: pt0, spacing: 4 });
    text(g, '1897—1899 · 示意图，省界采用今日轮廓，仅供参考', 102, 210, { size: 22, color: '#5a4630', alpha: pt0 });
    const lg = prog(t, l2.start + 2.6, l2.start + 3.4);
    if (lg > 0) {
      g.save();
      g.globalAlpha = lg;
      g.fillStyle = 'rgba(245,236,214,0.85)';
      roundRect(g, W - 330, 120, 250, 250, 8);
      g.fill();
      g.strokeStyle = 'rgba(80,60,40,0.4)';
      g.stroke();
      SPHERES.forEach((sp, i) => {
        g.fillStyle = rgba(sp.color, 0.7);
        g.fillRect(W - 300, 148 + i * 44, 30, 26);
        text(g, `${sp.name}势力范围`, W - 255, 170 + i * 44, { size: 24, color: PAL.ink, weight: 700 });
      });
      g.restore();
    }
  },
};

// ================================================================ S07 救亡图存
const S07 = {
  trans: 'fade',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(paper({ base: '#e8dcc2', seed: 52, edge: 0.3 }), 0, 0);
    const push = lerp(1, 1.06, t / (D + 1));
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(push, push);
    g.translate(-W / 2, -H / 2);
    const layers = [
      { seed: 5, color: '#8a8478', y: 300, par: 10, base: 0.35, amp: 0.5 },
      { seed: 6, color: '#55504a', y: 420, par: 22, base: 0.3, amp: 0.45 },
      { seed: 7, color: '#2b2724', y: 560, par: 40, base: 0.25, amp: 0.4 },
    ];
    for (const L of layers) {
      const img = inkRidge({ w: 2400, h: 640, seed: L.seed, color: L.color, base: L.base, amp: L.amp, mist: 0.75 });
      g.drawImage(img, -240 - t * L.par, L.y);
    }
    smoke(g, t, { count: 7, alpha: 0.35, color: '#f4ecdc', size: 900, vx: 25, seed: 12, y0: 380, h: 500 });
    g.restore();
    const c0 = cue(sc, 0);
    const pw = prog(t, c0.start + 0.2, Math.min(c0.start + 3.6, D - 0.6), (x) => x);
    brushWrite(g, '救亡图存', W / 2 - 95, 110, 190, pw, { dir: 'v', gap: 1.04, color: '#16110d', bleed: 0.45 });
    seal(g, '图存', W / 2 + 130, 700, 86, prog(t, c0.end - 0.6, c0.end), { rot: 0.03 });
    revealText(g, '民族危机空前深重', W / 2 - 430, 470, prog(t, c0.start + 0.4, c0.start + 1.8), { size: 34, color: '#3a2a1c', weight: 700, spacing: 8, align: 'center' });
  },
};

// ================================================================ S08 公车上书
const S08 = {
  trans: 'fade',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1), l2 = lineCue(sc, 2);
    g.drawImage(darkGround({ base: '#1d140d', seed: 61 }), 0, 0);
    radialGlow(g, 300, 700, 1000, '#ff9d45', 0.2 + 0.02 * Math.sin(t * 8));
    // memorial (accordion) unfolding right -> left
    const panels = 7, pw = 210, ph = 600;
    const unfold = prog(t, 0.2, 2.6, ease.inOut);
    const x0 = W / 2 + (panels * pw) / 2 - 80, y0 = 230;
    const push = lerp(1, 1.04, t / D);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(push, push);
    g.translate(-W / 2, -H / 2);
    for (let i = 0; i < panels; i++) {
      const open = clamp(unfold * panels - i);
      if (open <= 0) continue;
      const w = pw * open;
      const x = x0 - (i + 1) * pw + (pw - w) * 0;
      const shade = i % 2 ? 0.86 : 1;
      g.save();
      g.globalAlpha = clamp(open * 3);
      const tex = paper({ w: pw, h: ph, seed: 70 + i, base: '#efe3c6', edge: 0.06 });
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 20;
      g.drawImage(tex, x0 - i * pw - w, y0, w, ph);
      g.shadowColor = 'transparent';
      g.fillStyle = `rgba(60,40,20,${(1 - shade) * 0.9})`;
      g.fillRect(x0 - i * pw - w, y0, w, ph);
      // abstract calligraphy columns (illustrative strokes, not a real text)
      const rnd = mulberry32(i * 13 + 2);
      g.strokeStyle = 'rgba(30,20,12,0.55)';
      g.lineCap = 'round';
      for (let c = 0; c < 4; c++) {
        const cx = x0 - i * pw - w + (w * (c + 0.7)) / 4.4;
        let cy = y0 + 150;
        while (cy < y0 + ph - 50) {
          const len = 8 + rnd() * 18;
          g.lineWidth = 3 + rnd() * 3;
          g.beginPath();
          g.moveTo(cx - 6 + rnd() * 12, cy);
          g.lineTo(cx - 6 + rnd() * 12, cy + len);
          g.stroke();
          cy += len + 10 + rnd() * 10;
        }
      }
      g.restore();
    }
    // four proposals stamped on the memorial top
    const props = ['拒和', '迁都', '练兵', '变法'];
    const segs = sc.cues.filter((c) => c.line === 1);
    const ps = segs.length ? segs[0].start : l1.start;
    props.forEach((s, i) => {
      const p = prog(t, ps + 0.5 + i * 0.42, ps + 1.1 + i * 0.42, (x) => x);
      const x = x0 - (i * 1.6 + 0.9) * pw;
      if (p > 0) {
        g.save();
        g.globalAlpha = clamp(p * 3);
        g.fillStyle = 'rgba(239,227,198,0.92)';
        g.fillRect(x - 6, y0 + 20, 120, 230);
        g.restore();
      }
      brushWrite(g, s, x, y0 + 26, 108, p, { dir: 'v', gap: 1.0, color: i === 3 ? '#9e1f16' : '#17110c', bleed: 0.3 });
    });
    g.restore();
    candle(g, 150, 700, t, 1.1, { height: 300 });
    // header
    const ph0 = prog(t, l0.start, l0.start + 1.0, ease.out);
    tagLabel(g, '1895年春 · 北京', 110, 150, ph0, { size: 34 });
    revealText(g, '康有为联合在京会试举人上书', 126, 200, ph0, { size: 28, color: PAL.paper2, weight: 500 });
    const pg = prog(t, l1.end - 0.8, l1.end + 0.2, ease.out);
    if (pg > 0) {
      text(g, '史称“公车上书”', W - 120, 150, { size: 38, align: 'right', color: PAL.goldLight, weight: 800, alpha: pg, spacing: 4 });
      text(g, '“公车”代指入京应试的举人', W - 120, 192, { size: 22, align: 'right', color: PAL.paper2, alpha: pg * 0.8 });
    }
    // historiography note
    const pn = prog(t, l2.start, l2.start + 0.8, ease.out) * (1 - smoothstep(D - 0.5, D, t));
    if (pn > 0) {
      g.save();
      g.globalAlpha = pn;
      g.fillStyle = 'rgba(8,6,4,0.55)';
      g.fillRect(0, 0, W, H);
      panel(g, W / 2 - 520, 250, 1040, 470, 0.82, { borderA: 0.7 });
      text(g, '史 学 辨 析', W / 2, 330, { size: 44, align: 'center', color: PAL.goldLight, weight: 900, spacing: 8 });
      g.fillStyle = rgba(PAL.gold, 0.6);
      g.fillRect(W / 2 - 160, 352, 320, 2);
      const items = [
        ['参与人数？', '各家记载不一，具体数字存疑'],
        ['是否递交？', '有研究认为，上书并未正式递交至都察院'],
        ['史料来源', '主要记述多出自当事人的事后追述'],
      ];
      items.forEach(([a, b], i) => {
        const pi = prog(t, l2.start + 0.4 + i * 0.6, l2.start + 1.0 + i * 0.6, ease.out);
        text(g, a, W / 2 - 440, 430 + i * 92, { size: 34, color: PAL.redLight, weight: 900, alpha: pi });
        text(g, b, W / 2 - 230, 430 + i * 92, { size: 32, color: PAL.paper, weight: 500, alpha: pi });
      });
      g.restore();
    }
  },
};

// ================================================================ S09 press network
const S09 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l2 = lineCue(sc, 2);
    const segs1 = sc.cues.filter((c) => c.line === 1);
    const s1a = segs1[0] || l0, s1b = segs1[1] || s1a;
    const cam = new MapCam(camPath([
      { t: 0, lon: 117, lat: 33.5, dist: 34, tilt: 30, heading: 0, fov: 40 },
      { t: s1a.start + 0.5, lon: 119.5, lat: 32.2, dist: 26, tilt: 34, heading: 6, fov: 40 },
      { t: s1b.start + 0.8, lon: 117.8, lat: 37.0, dist: 26, tilt: 34, heading: -4, fov: 40 },
      { t: l2.start + 1.2, lon: 116, lat: 33.5, dist: 40, tilt: 26, heading: 0, fov: 40 },
      { t: D + 1, lon: 116, lat: 33.5, dist: 44, tilt: 24, heading: 0, fov: 40 },
    ], t));
    paperMap(g, cam);
    const cities = [
      { k: '北京', t: l0.start + 0.3, txt: '强学会（1895）', dx: -300, dy: -80 },
      { k: '上海', t: s1a.start + 0.2, txt: '《时务报》（1896）', dx: 80, dy: -90 },
      { k: '天津', t: s1b.start + 0.2, txt: '《国闻报》（1897）', dx: 90, dy: 40 },
      { k: '长沙', t: l0.start + 1.2, txt: '时务学堂 · 南学会', dx: -340, dy: 60 },
    ];
    // ink network lines
    const P = (k) => cam.p(...PLACES[k]);
    const links = [['北京', '天津', l0.start + 0.6], ['北京', '上海', l0.start + 1.0], ['上海', '长沙', l0.start + 1.5], ['天津', '上海', s1b.start + 0.4]];
    for (const [a, b, st] of links) {
      const A = P(a), B = P(b);
      const mid = [(A[0] + B[0]) / 2 + (B[1] - A[1]) * 0.15, (A[1] + B[1]) / 2 - (B[0] - A[0]) * 0.15];
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        pts.push([(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * mid[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * mid[1] + u * u * B[1]]);
      }
      brushLine(g, pts, 5, prog(t, st, st + 1.2), 'rgba(140,40,28,0.7)', { seed: a.length + b.length, dry: false });
    }
    for (const c of cities) {
      const [x, y] = P(c.k);
      const p = prog(t, c.t, c.t + 0.8, ease.out);
      marker(g, x, y, p, { color: PAL.red, r: 8, t });
      for (let k = 0; k < 3; k++) inkRing(g, x, y, 160, ((t - c.t) / 2.4 - k / 3 + 3) % 1 * (t > c.t ? 1 : 0), PAL.red);
      placeLabel(g, x, y, c.k, p, { size: 28, color: PAL.ink, weight: 900, shadow: { color: 'rgba(255,250,235,0.9)', blur: 6 } });
      callout(g, x, y, c.dx, c.dy, c.txt, null, p, { dark: false, size: 26 });
    }
    // mastheads (schematic, titles only)
    masthead(g, 1400, 520, 300, 360, '時務報', '梁启超主笔', prog(t, s1a.start + 0.3, s1a.start + 1.1), { seed: 12, rot: 0.03 });
    masthead(g, 140, 470, 300, 360, '國聞報', '严复等创办于天津', prog(t, s1b.start + 0.1, s1b.start + 0.9), { seed: 14, rot: -0.03 });
    bookCover(g, 480, 560, 190, 280, '天演論', prog(t, s1b.start + 1.2, s1b.start + 2.0), { color: '#3a4a5c' });
    if (prog(t, s1b.start + 1.2, s1b.start + 2.0) > 0) text(g, '严复译述 · 1898年刊行', 575, 880, { size: 22, align: 'center', color: PAL.ink, weight: 700, alpha: prog(t, s1b.start + 1.6, s1b.start + 2.2) });
    // "变法" spreading
    const pb = prog(t, l2.start + 0.2, l2.start + 2.0, (x) => x);
    if (pb > 0) {
      g.save();
      g.globalAlpha = clamp(pb * 3) * 0.85;
      g.fillStyle = 'rgba(240,230,205,0.6)';
      g.fillRect(0, 0, W, H);
      g.restore();
      brushWrite(g, '变法', W / 2 - 230, H / 2 - 230, 230, pb, { gap: 1.0, color: '#7a160f', bleed: 0.5 });
      const pr = prog(t, l2.start + 1.0, D);
      for (let k = 0; k < 4; k++) inkRing(g, W / 2, H / 2 - 115, 900, (pr * 1.6 - k * 0.25), '#7a160f');
    }
    const pt0 = prog(t, 0.2, 1.0, ease.out) * (1 - prog(t, l2.start, l2.start + 0.5));
    text(g, '维新思想的传播', 100, 170, { size: 46, weight: 900, color: PAL.ink, alpha: pt0, spacing: 4 });
    text(g, '学会 · 报刊 · 学堂', 102, 214, { size: 26, color: '#5a4630', alpha: pt0, spacing: 6 });
  },
};

export default { S05_old_city: S05, S06_partition: S06, S07_jiuwang: S07, S08_gongche: S08, S09_press: S09 };
