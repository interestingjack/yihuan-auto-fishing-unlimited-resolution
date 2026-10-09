// 第五章 风暴将至
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, darkGround } from '../textures.js';
import { MapCam, camPath, featPath, CHINA, PLACES, marker, callout, placeLabel, province, linePath } from '../mapkit.js';
import { brushWrite, seal, brushLine, brushArrow, inkRing } from '../brush.js';
import { dust, smoke, candle, ash } from '../fx.js';
import { card, panel, bust, tagLabel } from '../ui.js';
import { Corridor } from '../three/scenes3d.js';
import { paperMap } from './ch2.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };
const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

// provincial capitals (approximate) for edict flights
const CAPS = [
  ['直隶', [115.5, 38.9]], ['山东', [117.0, 36.67]], ['河南', [113.65, 34.76]], ['山西', [112.55, 37.87]], ['陕西', [108.94, 34.34]],
  ['甘肃', [103.8, 36.06]], ['四川', [104.06, 30.66]], ['湖北', [114.3, 30.6]], ['湖南', [112.97, 28.2]], ['江西', [115.89, 28.68]],
  ['安徽', [117.28, 31.86]], ['江苏', [118.8, 32.06]], ['浙江', [120.15, 30.27]], ['福建', [119.3, 26.08]], ['广东', [113.26, 23.13]],
  ['广西', [110.3, 25.27]], ['云南', [102.7, 25.04]], ['贵州', [106.7, 26.58]],
];

// ================================================================ S22 resistance
const S22 = {
  trans: 'black',
  transDur: 1.2,
  draw(g, t, sc) {
    const D = sc.dur;
    const L = [0, 1, 2, 3].map((i) => lineCue(sc, i));
    const cam = new MapCam(camPath([
      { t: 0, lon: 112, lat: 33, dist: 46, tilt: 26, heading: 0, fov: 40 },
      { t: L[2].start, lon: 112, lat: 32, dist: 40, tilt: 30, heading: 3, fov: 40 },
      { t: D + 1, lon: 112, lat: 32, dist: 36, tilt: 32, heading: 5, fov: 40 },
    ], t));
    paperMap(g, cam, { base: '#ddd0b2' });
    // darkening mood as tension rises
    const dark = 0.15 + 0.45 * prog(t, 0, D);
    g.save();
    g.fillStyle = `rgba(20,14,10,${dark})`;
    g.fillRect(0, 0, W, H);
    g.restore();
    const [bx, by] = cam.p(...PLACES.北京);
    marker(g, bx, by, prog(t, 0.3, 1.0), { color: PAL.red, r: 10, t });
    placeLabel(g, bx, by, '北京', prog(t, 0.3, 1.0), { size: 30, color: '#fff3d6', weight: 900 });
    // edicts fly from Beijing to provinces; most stall ("观望"), Hunan responds
    const t0 = L[1].start - 0.2;
    CAPS.forEach(([name, ll], i) => {
      const [x, y] = cam.p(...ll);
      if (isNaN(x)) return;
      const st = t0 + (i % 6) * 0.25 + Math.floor(i / 6) * 0.15;
      const hunan = name === '湖南';
      const reach = hunan ? 1 : 0.55 + 0.25 * ((i * 37) % 10) / 10;
      const pf = prog(t, st, st + 1.6, ease.out) * reach;
      if (pf <= 0) return;
      const ex = lerp(bx, x, pf), ey = lerp(by, y, pf) - Math.sin(pf * Math.PI) * 40;
      g.save();
      g.strokeStyle = hunan ? 'rgba(201,164,92,0.9)' : 'rgba(230,220,200,0.35)';
      g.setLineDash([6, 8]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo((bx + ex) / 2, (by + ey) / 2 - 50, ex, ey);
      g.stroke();
      g.setLineDash([]);
      const fade = hunan ? 1 : 1 - 0.6 * prog(t, st + 1.6, st + 2.4);
      g.globalAlpha = fade;
      g.fillStyle = hunan ? '#f2cf7a' : '#cfc2a6';
      g.fillRect(ex - 8, ey - 16, 16, 32);
      g.restore();
      if (!hunan && t > st + 1.8) placeLabel(g, ex, ey, '观望', prog(t, st + 1.8, st + 2.4) * 0.8, { size: 20, color: 'rgba(240,230,210,0.85)', dx: 10, dy: 6, weight: 600 });
      if (hunan) {
        marker(g, x, y, prog(t, st + 1.4, st + 1.9), { color: PAL.gold, r: 10, t });
        callout(g, x, y, -360, 90, '湖南', '巡抚陈宝箴等推行新政较为积极', prog(t, st + 1.6, st + 2.4, ease.out), { size: 28, accent: PAL.gold });
      }
    });
    tagLabel(g, '诏令雪片般下达', 110, 170, prog(t, L[1].start, L[1].start + 0.8) * (1 - prog(t, L[2].start - 0.3, L[2].start + 0.2)), { size: 40, color: '#fff3d6', shadow: { color: '#000', blur: 10 } });
    // interests hurt: two groups
    const pi = prog(t, L[2].start, L[2].start + 0.8, ease.out) * (1 - prog(t, L[3].start - 0.3, L[3].start + 0.3));
    if (pi > 0) {
      g.save();
      g.globalAlpha = pi;
      g.fillStyle = 'rgba(10,7,5,0.6)';
      g.fillRect(0, 0, W, H);
      const groups = [
        { x: 600, kind: 'official', who: '冗员与旧官僚', why: '裁撤衙门 · 失去职位', t: L[2].start + 0.2 },
        { x: 1320, kind: 'skullcap', who: '众多读书人', why: '废八股 · 多年所学受冲击', t: L[2].start + 1.0 },
      ];
      groups.forEach((gp) => {
        const p = prog(t, gp.t, gp.t + 0.8, ease.out);
        g.save();
        g.globalAlpha *= p;
        for (let k = -1; k <= 1; k++) bust(g, gp.x + k * 150, 470 + Math.abs(k) * 30, 0.55 - Math.abs(k) * 0.06, gp.kind, { color: '#0b0806', rim: '#c9a45c' });
        text(g, gp.who, gp.x, 740, { size: 44, align: 'center', color: PAL.goldLight, weight: 900, spacing: 4 });
        text(g, gp.why, gp.x, 800, { size: 30, align: 'center', color: PAL.paper, weight: 600 });
        g.restore();
      });
      revealText(g, '切身利益受到触动', W / 2, 220, prog(t, L[2].start + 1.4, L[2].start + 2.4), { size: 50, align: 'center', color: PAL.redLight, weight: 900, spacing: 10 });
      g.restore();
    }
    // papers piling: "stays on paper"
    const pp = prog(t, L[3].start - 0.2, L[3].start + 0.6, ease.out);
    if (pp > 0) {
      g.save();
      g.globalAlpha = pp;
      g.fillStyle = 'rgba(10,7,5,0.65)';
      g.fillRect(0, 0, W, H);
      const rnd = mulberry32(9);
      const n = Math.floor(lerp(0, 28, prog(t, L[3].start, L[3].end, ease.out)));
      for (let i = 0; i < n; i++) {
        const x = W / 2 + (rnd() - 0.5) * 120, y = 840 - i * 15;
        g.save();
        g.translate(x, y);
        g.rotate((rnd() - 0.5) * 0.12);
        g.transform(1, 0, -0.35, 1, 0, 0);
        g.fillStyle = i % 2 ? '#e2cf9c' : '#d8c38e';
        g.fillRect(-220, -60, 440, 60);
        g.fillStyle = 'rgba(90,60,25,0.55)';
        g.fillRect(-220, 0, 440, 6);
        g.strokeStyle = 'rgba(90,60,25,0.35)';
        g.strokeRect(-220, -60, 440, 60);
        g.restore();
      }
      revealText(g, '仓促 · 执行乏力 · 停留在纸面', W / 2, 220, prog(t, L[3].start + 0.4, L[3].start + 1.6), { size: 48, align: 'center', color: '#e9dcc0', weight: 900, spacing: 8 });
      ash(g, t, { count: 40, alpha: 0.35, color: '#9a8f80' });
      g.restore();
    }
  },
};

// ================================================================ S23 power structure
const S23 = {
  trans: 'fade',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1);
    const segs = sc.cues.filter((c) => c.line === 1);
    g.drawImage(darkGround({ base: '#120e0b', seed: 171 }), 0, 0);
    radialGlow(g, W / 2, 280, 700, '#7a160f', 0.18 + 0.05 * Math.sin(t * 1.5));
    smoke(g, t, { count: 6, alpha: 0.07, color: '#a09080', size: 900, vx: 10, seed: 51 });
    // nodes
    const pC = prog(t, 0.2, 1.2, ease.out);
    const pG = prog(t, 0.6, 1.6, ease.out);
    const shrink = prog(t, l0.start + 0.5, l0.start + 2.0, ease.inOut);
    // Cixi (top)
    g.save();
    g.globalAlpha = pC;
    bust(g, W / 2, 300, 0.75 + shrink * 0.12, 'lady', { color: '#0a0705', rim: '#c9a45c' });
    g.restore();
    text(g, '慈禧太后', W / 2, 590, { size: 46, align: 'center', color: PAL.goldLight, weight: 900, alpha: pC, spacing: 6 });
    text(g, '常驻颐和园 · 仍掌握最高权力', W / 2, 636, { size: 24, align: 'center', color: PAL.paper2, alpha: pC });
    // Guangxu (lower left)
    const gx = 420, gy = 640;
    g.save();
    g.globalAlpha = pG;
    bust(g, gx, gy, 0.6 - shrink * 0.12, 'imperial', { color: '#0a0705', rim: '#d9b26a' });
    g.restore();
    text(g, '光绪帝', gx, gy + 250, { size: 40, align: 'center', color: PAL.paper, weight: 900, alpha: pG, spacing: 4 });
    text(g, '名义上亲政 · 实权有限', gx, gy + 292, { size: 24, align: 'center', color: PAL.paper2, alpha: pG });
    // authority line from Cixi over Guangxu
    brushArrow(g, [[W / 2 - 140, 470], [gx + 200, gy - 60]], 10, prog(t, l0.start + 0.6, l0.start + 1.6), 'rgba(179,38,30,0.85)', { seed: 2 });
    // June 15 events
    const s0 = segs[0] || l1;
    const pd = prog(t, s0.start, s0.start + 0.6, ease.out);
    if (pd > 0) {
      seal(g, '六月', W - 560, 150, 90, pd);
      text(g, '1898年6月15日', W - 450, 210, { size: 40, color: PAL.goldLight, weight: 900, alpha: pd });
      text(g, '变法开始后第四天', W - 448, 252, { size: 24, color: PAL.paper2, alpha: pd });
    }
    const evs = [
      { t: (segs[1] || l1).start, a: '翁同龢', b: '帝师、军机大臣 · 被开缺回籍', c: '#8a8a8a', y: 400 },
      { t: (segs[2] || l1).start, a: '荣  禄', b: '太后亲信 · 署理直隶总督', c: PAL.redLight, y: 560 },
      { t: (segs[3] || l1).start, a: '兵  权', b: '统辖北洋各军，掌握京畿军事', c: PAL.redLight, y: 720 },
    ];
    evs.forEach((e, i) => {
      const p = prog(t, e.t, e.t + 0.7, ease.out);
      if (p <= 0) return;
      const x = W - 700;
      g.save();
      g.globalAlpha = p;
      panel(g, x, e.y - 60, 640, 120, 0.55, { borderColor: e.c, borderA: 0.6 });
      text(g, e.a, x + 30, e.y + 14, { size: 44, color: e.c, weight: 900 });
      text(g, e.b, x + 190, e.y + 10, { size: 28, color: PAL.paper, weight: 600 });
      g.restore();
      // links
      if (i === 0) {
        const pb = prog(t, e.t + 0.4, e.t + 1.2);
        g.save();
        g.globalAlpha = p * 0.8;
        g.strokeStyle = 'rgba(200,200,200,0.6)';
        g.setLineDash([10, 10]);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(gx + 160, gy - 40);
        g.lineTo(lerp(gx + 160, x, 0.45), lerp(gy - 40, e.y, 0.45));
        g.moveTo(lerp(gx + 160, x, 0.55), lerp(gy - 40, e.y, 0.55));
        g.lineTo(x, e.y);
        g.stroke();
        g.restore();
        text(g, '✕', lerp(gx + 160, x, 0.5), lerp(gy - 40, e.y, 0.5) + 14, { size: 40, align: 'center', color: PAL.redLight, weight: 900, alpha: pb });
      } else {
        brushLine(g, [[W / 2 + 120, 420], [x - 10, e.y]], 6, prog(t, e.t + 0.2, e.t + 1.0), 'rgba(179,38,30,0.8)', { seed: i * 7, dry: false });
      }
    });
    text(g, '人物剪影为示意，非肖像', W - 110, H - 150, { size: 20, align: 'right', color: PAL.paper2, alpha: 0.45 * pC });
  },
};

// ================================================================ S24 corridor at night
const S24 = {
  trans: 'black',
  transDur: 1.2,
  tag: '艺术重现 · 非历史影像',
  grain: 0.06,
  vignette: 0.6,
  init() { Corridor.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const img = Corridor.render(t, { keys: [
      { t: 0, pos: [0.3, 1.75, 26], look: [0, 2.6, -60], fov: 44 },
      { t: D + 1, pos: [-0.3, 1.8, -4], look: [0.5, 2.4, -90], fov: 40 },
    ] });
    g.drawImage(img, 0, 0);
    const segs = sc.cues;
    const s0 = segs[0] || { start: 0 }, s1 = segs[1] || s0, s2 = segs[2] || s1;
    const items = [
      { t: s0.start + 0.2, d: '9月4日', s: '罢免阻挠上书的礼部六堂官' },
      { t: s1.start + 0.1, d: '9月5日', s: '谭嗣同、杨锐、林旭、刘光第', s2: '以四品卿衔任军机章京，参与新政' },
    ];
    items.forEach((it, i) => {
      const p = prog(t, it.t, it.t + 0.8, ease.out) * (1 - smoothstep(D - 0.6, D, t));
      if (p <= 0) return;
      const y = 300 + i * 220;
      g.save();
      g.globalAlpha = p;
      const gr = g.createLinearGradient(80, 0, 900, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.6)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(80, y - 70, 820, it.s2 ? 180 : 130);
      g.fillStyle = PAL.red;
      g.fillRect(100, y - 50, 6, it.s2 ? 140 : 90);
      text(g, it.d, 126, y, { size: 50, color: PAL.goldLight, weight: 900, shadow: { color: '#000', blur: 10 } });
      text(g, it.s, 128, y + 48, { size: 32, color: PAL.paper, weight: 700, shadow: { color: '#000', blur: 8 } });
      if (it.s2) text(g, it.s2, 128, y + 92, { size: 28, color: PAL.paper2, weight: 500, shadow: { color: '#000', blur: 8 } });
      g.restore();
    });
    const pk = prog(t, s2.start, s2.start + 1.0, ease.out) * (1 - smoothstep(D - 0.6, D, t));
    if (pk > 0) {
      text(g, '帝后矛盾  迅速激化', W - 140, 420, { size: 56, align: 'right', color: '#ffcfb0', weight: 900, alpha: pk, spacing: 8, shadow: { color: 'rgba(179,38,30,0.9)', blur: 24 } });
    }
  },
};

export default { S22_resistance: S22, S23_power: S23, S24_corridor: S24 };
