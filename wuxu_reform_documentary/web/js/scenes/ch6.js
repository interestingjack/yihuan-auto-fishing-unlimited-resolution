// 第六章 戊戌政变
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, darkGround, plaster, noiseField } from '../textures.js';
import { MapCam, camPath, PLACES, marker, callout, placeLabel, linePath, dashedRoute, smoothGeo } from '../mapkit.js';
import { brushWrite, seal, hanzi, inkRing } from '../brush.js';
import { dust, smoke, candle, ash, glowSprite } from '../fx.js';
import { panel, tagLabel } from '../ui.js';
import { Yingtai } from '../three/scenes3d.js';
import { darkMap, mapClouds } from './ch1.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };
const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

// ================================================================ S25 coup + Yingtai
const S25 = {
  trans: 'black',
  transDur: 1.4,
  tag: '艺术重现 · 非历史影像',
  grain: 0.06,
  init() { Yingtai.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const s0 = cue(sc, 0), s1 = cue(sc, 1), s2 = cue(sc, 2);
    const mix3d = prog(t, s1.start - 0.4, s1.start + 0.8, ease.inOut);
    if (mix3d > 0) {
      const img = Yingtai.render(Math.max(0, t - s1.start + 1));
      g.globalAlpha = mix3d;
      g.drawImage(img, 0, 0);
      g.globalAlpha = 1;
      smoke(g, t, { count: 8, alpha: 0.14 * mix3d, color: '#9aa6b8', size: 1000, vx: 14, seed: 61, y0: 500, h: 500 });
    }
    if (mix3d < 1) {
      g.save();
      g.globalAlpha = 1 - mix3d;
      g.fillStyle = '#060404';
      g.fillRect(0, 0, W, H);
      const pd = prog(t, s0.start - 0.1, s0.start + 0.35, ease.out);
      const sc2 = lerp(1.35, 1, pd);
      g.translate(W / 2, H / 2 - 40);
      g.scale(sc2, sc2);
      text(g, '1898年9月21日', 0, 0, { size: 120, align: 'center', color: '#c8281c', weight: 900, alpha: pd, family: FONTS.serif, shadow: { color: 'rgba(200,40,28,0.5)', blur: 40 } });
      g.restore();
      inkRing(g, W / 2, H / 2 - 80, 900, prog(t, s0.start + 0.2, s0.start + 1.4), '#c8281c');
      g.save();
      g.globalAlpha = 1 - mix3d;
      text(g, '变法第103天', W / 2, H / 2 + 80, { size: 40, align: 'center', color: PAL.paper2, alpha: prog(t, s0.start + 0.4, s0.start + 1.0), spacing: 10 });
      g.restore();
    }
    // captions over Yingtai
    const pc = prog(t, s1.start + 0.4, s1.start + 1.2, ease.out);
    if (pc > 0) {
      g.save();
      g.globalAlpha = pc;
      const gr = g.createLinearGradient(0, 0, 800, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 230, 900, 330);
      text(g, '慈禧太后宣布重新“训政”', 110, 320, { size: 44, color: PAL.paper, weight: 900, shadow: { color: '#000', blur: 10 } });
      g.restore();
      const p2 = prog(t, s2.start, s2.start + 0.8, ease.out);
      revealText(g, '光绪帝被幽禁于中南海瀛台', 110, 390, p2, { size: 38, color: '#cfd8ea', weight: 700, shadow: { color: '#000', blur: 10 } });
      const p3 = prog(t, s2.start + 1.4, s2.start + 2.4, (u) => u);
      brushWrite(g, '戊戌政变', 110, 430, 110, p3, { gap: 1.02, color: '#e8dcc4', bleed: 0.2 });
    }
  },
};

// ================================================================ S26 exile routes
const S26 = {
  trans: 'fade',
  transDur: 0.9,
  draw(g, t, sc) {
    const D = sc.dur;
    const cam = new MapCam(camPath([
      { t: 0, lon: 124, lat: 31.5, dist: 46, tilt: 24, heading: 0, fov: 40 },
      { t: D + 1, lon: 126, lat: 31.5, dist: 42, tilt: 28, heading: 3, fov: 40 },
    ], t));
    darkMap(g, cam, t, { qingFill: '#241b14' });
    const P = PLACES;
    const kang = smoothGeo([P.北京, P.天津, [122.6, 37.6], [123.2, 33.5], P.上海, [121.5, 27.0], [117.5, 23.2], P.香港, [118.5, 21.6], [126.5, 27.5], [132.5, 32.2], [136.5, 34.2], P.东京], 6);
    const liang = smoothGeo([P.北京, P.天津, [122.2, 38.6], [126.0, 35.2], [129.8, 33.6], [133.5, 34.0], P.东京], 6);
    const c0 = cue(sc, 0);
    dashedRoute(g, linePath(cam, kang), prog(t, 0.2, D - 0.6, ease.inOut), { color: PAL.goldLight, width: 4, t });
    dashedRoute(g, linePath(cam, liang), prog(t, 0.6, D - 0.8, ease.inOut), { color: PAL.redLight, width: 4, t });
    for (const k of ['北京', '天津', '上海', '香港', '东京']) {
      const [x, y] = cam.p(...P[k]);
      marker(g, x, y, prog(t, 0.2, 0.8), { color: k === '北京' ? PAL.red : PAL.gold, r: 7, pulse: false });
      placeLabel(g, x, y, k === '东京' ? '日本东京' : k, prog(t, 0.2, 0.9), { size: 24 });
    }
    const pa = prog(t, 0.4, 1.2, ease.out);
    panel(g, 90, 760, 760, 150, 0.55 * pa, { border: false });
    tagLabel(g, '康有为：经上海、香港，转赴日本', 120, 818, pa, { size: 30, accent: PAL.goldLight });
    tagLabel(g, '梁启超：经天津，乘日本军舰赴日本', 120, 874, prog(t, 0.8, 1.6), { size: 30, accent: PAL.redLight });
  },
};

// ================================================================ S27 the six gentlemen
const SIX = [
  ['谭嗣同', '1865—1898'], ['林旭', '1875—1898'], ['杨锐', '1857—1898'],
  ['刘光第', '1859—1898'], ['杨深秀', '1849—1898'], ['康广仁', '1867—1898'],
];
const S27 = {
  trans: 'black',
  transDur: 1.2,
  grain: 0.08,
  vignette: 0.65,
  draw(g, t, sc) {
    const D = sc.dur;
    const s0 = cue(sc, 0), s1 = cue(sc, 1), s2 = cue(sc, 2);
    g.drawImage(darkGround({ base: '#0b0908', seed: 191 }), 0, 0);
    smoke(g, t, { count: 6, alpha: 0.06, color: '#8a8070', size: 1000, vx: 8, seed: 71 });
    const pd = prog(t, 0.2, 1.0, ease.out);
    text(g, '1898年9月28日 · 北京菜市口', 110, 150, { size: 34, color: PAL.paper2, weight: 600, alpha: pd, spacing: 4 });
    // names lit one by one, synced to narration
    const starts = [0, 1, 2, 3, 4].map((i) => s0.start + 0.6 + i * ((s0.end - s0.start - 0.6) / 5));
    starts.push(s1.start + 0.1);
    SIX.forEach(([n, y], i) => {
      const x = 330 + i * 252;
      const p = prog(t, starts[i], starts[i] + 0.9, (u) => u);
      const lit = prog(t, starts[i], starts[i] + 0.5);
      candle(g, x, 760, t, 0.75, { height: 170, lit });
      const chars = [...n];
      const size = 92;
      brushWrite(g, n, x - size / 2, 250 + (3 - chars.length) * size * 0.5, size, p, { dir: 'v', gap: 1.0, color: '#ece0c6', bleed: 0.25 });
      text(g, y, x, 640, { size: 22, align: 'center', color: rgba(PAL.gold, 0.85), alpha: clamp(p * 2), spacing: 2 });
    });
    const pt = prog(t, s2.start - 0.2, s2.start + 1.6, (u) => u);
    if (pt > 0) {
      g.save();
      g.globalAlpha = clamp(pt * 3);
      g.restore();
      brushWrite(g, '戊戌六君子', W - 560, 120, 92, pt, { gap: 1.0, color: '#b8291d', bleed: 0.25 });
    }
    ash(g, t, { count: 60, alpha: 0.4, color: '#b0a698' });
  },
};

// ================================================================ S28 poem on the prison wall
const S28 = {
  trans: 'fade',
  transDur: 1.2,
  grain: 0.08,
  vignette: 0.7,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1);
    const push = lerp(1.0, 1.05, t / (D + 1));
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(push, push);
    g.translate(-W / 2, -H / 2);
    g.drawImage(plaster({ base: '#bdb4a4', seed: 23 }), 0, 0);
    // candle light from lower left
    g.save();
    g.globalCompositeOperation = 'multiply';
    const gr = g.createRadialGradient(300, 900, 100, 300, 900, 1500);
    gr.addColorStop(0, 'rgba(255,214,160,1)');
    gr.addColorStop(0.55, 'rgba(200,170,135,1)');
    gr.addColorStop(1, 'rgba(70,58,48,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.restore();
    radialGlow(g, 300, 900, 600, '#ff9d45', 0.12 + 0.02 * Math.sin(t * 9));
    // poem: right column first
    const size = 100;
    const pw = prog(t, l1.start - 0.4, Math.min(D - 0.4, l1.end + 1.2), (u) => u);
    brushWrite(g, '我自横刀向天笑', 1260, 110, size, clamp(pw * 2), { dir: 'v', gap: 1.04, color: '#1a1410', bleed: 0.5 });
    brushWrite(g, '去留肝胆两昆仑', 1080, 110, size, clamp(pw * 2 - 1), { dir: 'v', gap: 1.04, color: '#1a1410', bleed: 0.5 });
    g.restore();
    const pa = prog(t, l0.start + 0.4, l0.start + 1.4, ease.out);
    panel(g, 90, 620, 760, 250, 0.5 * pa, { border: false });
    text(g, '谭嗣同《狱中题壁》', 120, 690, { size: 40, color: PAL.goldLight, weight: 900, alpha: pa, spacing: 4 });
    text(g, '望门投止思张俭，忍死须臾待杜根。', 122, 750, { size: 28, color: PAL.paper, alpha: pa });
    text(g, '我自横刀向天笑，去留肝胆两昆仑。', 122, 795, { size: 28, color: '#ffd9c8', alpha: pa, weight: 700 });
    text(g, '据梁启超《戊戌政变记》所载；诗句文字流传中存在异文', 122, 842, { size: 20, color: PAL.paper2, alpha: pa * 0.85 });
  },
};

// ================================================================ S29 aftermath: reforms abolished
const ITEMS = [
  ['政治', ['裁撤闲散衙门', '准许上书言事']],
  ['教育', ['废八股 改策论', '书院改学堂', '京师大学堂']],
  ['经济', ['农工商总局', '奖励实业']],
  ['军事', ['改练洋操']],
];
const S29 = {
  trans: 'fade',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const c0 = cue(sc, 0);
    g.drawImage(darkGround({ base: '#15110d', seed: 201 }), 0, 0);
    const pin = prog(t, 0.0, 0.8, ease.out);
    const nf = noiseField(64, 64, 7, 0.08);
    ITEMS.forEach(([cat, its], ci) => {
      const x = 260 + ci * 400;
      text(g, cat, x + 120, 260, { size: 44, align: 'center', color: PAL.goldLight, weight: 900, alpha: pin, spacing: 8 });
      its.forEach((it, k) => {
        const y = 340 + k * 130;
        const keep = it === '京师大学堂';
        const st = c0.start + 0.6 + (ci * 3 + k) * 0.18;
        const fade = keep ? 0 : prog(t, st, st + 1.2);
        g.save();
        g.globalAlpha = pin * (1 - fade * 0.82);
        if (keep) {
          const glow = prog(t, c0.start + 1.5, c0.start + 2.5);
          g.drawImage(glowSprite('#e8c070', 128, 0.1), x - 80, y - 80, 400, 240);
          g.globalAlpha = pin;
          g.fillStyle = `rgba(201,164,92,${0.25 + 0.35 * glow})`;
        } else g.fillStyle = 'rgba(239,227,198,0.12)';
        roundRect(g, x, y, 240, 90, 6);
        g.fill();
        g.strokeStyle = keep ? PAL.goldLight : 'rgba(239,227,198,0.4)';
        g.lineWidth = 2;
        g.stroke();
        text(g, it, x + 120, y + 58, { size: 32, align: 'center', color: keep ? '#fff3d6' : fade > 0.5 ? '#6a6058' : PAL.paper, weight: 800 });
        g.restore();
        // ink stain spreading over abolished items
        if (fade > 0) {
          g.save();
          g.globalAlpha = 0.55 * fade;
          g.fillStyle = '#0b0908';
          for (let q = 0; q < 6; q++) {
            const v = nf[(k * 9 + ci * 13 + q * 7) % nf.length];
            g.beginPath();
            g.arc(x + 30 + q * 38, y + 45 + (v - 0.5) * 40, 30 * fade * (0.5 + v), 0, Math.PI * 2);
            g.fill();
          }
          g.restore();
        }
      });
    });
    revealText(g, '新政几乎全部被废止', W / 2, 930, prog(t, c0.start + 1.0, c0.start + 2.4), { size: 46, align: 'center', color: '#e9dcc0', weight: 900, spacing: 10 });
    text(g, '京师大学堂得以保留', 1080, 790, { size: 28, color: PAL.goldLight, weight: 700, alpha: prog(t, c0.start + 2.0, c0.start + 2.8) });
  },
};

export default { S25_coup: S25, S26_exile: S26, S27_six: S27, S28_poem: S28, S29_aftermath: S29 };
