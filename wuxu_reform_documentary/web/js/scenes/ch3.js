// 第三章 维新登场
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, agedPaper, darkGround, inkRidge, puff } from '../textures.js';
import { brushWrite, hanzi, seal, brushLine } from '../brush.js';
import { dust, smoke, rays } from '../fx.js';
import { Palace } from '../three/scenes3d.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };

const S12 = {
  trans: 'fade',
  transDur: 1.0,
  tag: '艺术重现 · 非历史影像',
  grain: 0.04,
  init() { Palace.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const img = Palace.render(t, { keys: [
      { t: 0, pos: [6, 2.2, 150], look: [0, 16, 0], fov: 30 },
      { t: D + 0.5, pos: [-16, 15, 96], look: [0, 18, 0], fov: 36 },
    ] });
    g.drawImage(img, 0, 0);
    const c0 = cue(sc, 0), c1 = cue(sc, 1);
    // date title
    const p = prog(t, c0.start - 0.2, c0.start + 1.0, ease.out);
    const fade = 1 - smoothstep(D - 0.6, D, t);
    g.save();
    g.globalAlpha = p * fade;
    const gr = g.createLinearGradient(0, 0, 900, 0);
    gr.addColorStop(0, 'rgba(10,6,3,0.55)');
    gr.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = gr;
    g.fillRect(0, 640, 900, 260);
    text(g, '1898年6月11日', 110, 740, { size: 76, family: FONTS.serif, weight: 900, color: PAL.goldLight, spacing: 4, shadow: { color: 'rgba(0,0,0,0.7)', blur: 14 } });
    text(g, '光绪二十四年四月二十三日', 114, 796, { size: 30, color: PAL.paper2, spacing: 8, weight: 500 });
    g.restore();
    const p2 = prog(t, c1.start, c1.start + 1.0, ease.out);
    revealText(g, '颁布《明定国是诏》 · 宣布变法', 114, 856, p2 * fade, { size: 36, color: '#fff3d6', weight: 700, spacing: 3, shadow: { color: 'rgba(0,0,0,0.8)', blur: 10 } });
  },
};

const ch3Scenes = { S12_palace: S12 };
export default ch3Scenes;

// ================================================================ shared imports for ch3 profiles
import { card, panel, bust, tagLabel, dayAxis } from '../ui.js';

const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

const PEOPLE = [
  { name: '康有为', kind: 'skullcap', seal: '南海', years: '1858—1927', place: '广东南海人', lines: ['著《新学伪经考》（1891）', '著《孔子改制考》', '托古改制，为变法提供理论依据'] },
  { name: '梁启超', kind: 'bare', seal: '任公', years: '1873—1929', place: '广东新会人 · 康有为弟子', lines: ['主笔上海《时务报》', '撰《变法通议》', '文字通俗而富于感染力'] },
  { name: '谭嗣同', kind: 'skullcap', seal: '复生', years: '1865—1898', place: '湖南浏阳人', lines: ['著《仁学》', '抨击纲常名教', '主张“冲决网罗”'] },
];

function inkBackdrop(g, t, tint = '#1a1410') {
  g.drawImage(darkGround({ base: tint, seed: 81 }), 0, 0);
  g.save();
  g.globalAlpha = 0.5;
  g.drawImage(inkRidge({ w: 2400, h: 600, seed: 9, color: '#3a3128', base: 0.3, amp: 0.45, mist: 0.8 }), -200 - t * 6, 520);
  g.globalAlpha = 0.6;
  g.drawImage(inkRidge({ w: 2400, h: 500, seed: 10, color: '#0c0a08', base: 0.25, amp: 0.4, mist: 0.9 }), -120 - t * 14, 660);
  g.restore();
  smoke(g, t, { count: 6, alpha: 0.08, color: '#c8bca8', size: 900, vx: 12, seed: 33 });
}

// ================================================================ S10 reformers
const S10 = {
  trans: 'ink',
  transDur: 1.1,
  draw(g, t, sc) {
    const D = sc.dur;
    const L = [0, 1, 2, 3].map((i) => lineCue(sc, i));
    inkBackdrop(g, t);
    // focus weights: phase 0 = group, phase k = person k-1
    const f = [1, 0, 0, 0];
    for (let k = 1; k <= 3; k++) {
      const a = prog(t, L[k].start - 0.5, L[k].start + 0.3, ease.inOut);
      const b = k < 3 ? prog(t, L[k + 1].start - 0.5, L[k + 1].start + 0.3, ease.inOut) : 0;
      f[k] = a * (1 - b);
    }
    f[0] = 1 - prog(t, L[1].start - 0.5, L[1].start + 0.3, ease.inOut);
    PEOPLE.forEach((pp, i) => {
      // group layout position vs focus layout
      const gx = 560 + i * 400, gy = 430, gs = 1.0;
      const fx = 470, fy = 430, fs = 1.45;
      const w = f[i + 1];
      const x = lerp(gx, fx, w), y = lerp(gy, fy, w), s = lerp(gs, fs, w);
      const others = 1 - f[0] - w; // another person is focused
      const a = clamp(1 - others * 1.3) * prog(t, 0.2 + i * 0.3, 1.0 + i * 0.3);
      if (a <= 0.01) return;
      g.save();
      g.globalAlpha = a;
      bust(g, x, y, s * 0.95, pp.kind, { color: '#0d0a08', rim: '#d9b26a' });
      g.restore();
      // group-phase names under busts
      const pn = prog(t, L[0].start + 1.2 + i * 0.6, L[0].start + 2.0 + i * 0.6, (u) => u);
      if (f[0] > 0.01) {
        g.save();
        g.globalAlpha = f[0];
        brushWrite(g, pp.name, gx - 135, 780, 90, pn, { gap: 1.0, color: '#efe2c2', bleed: 0.2 });
        text(g, pp.years, gx, 912, { size: 26, align: 'center', color: PAL.gold, alpha: clamp(pn * 2), spacing: 3 });
        g.restore();
      }
      // focus-phase info card
      if (w > 0.01) {
        const k = i + 1;
        const lp = prog(t, L[k].start, L[k].start + 2.2, (u) => u);
        g.save();
        g.globalAlpha = w;
        const cx = 860;
        brushWrite(g, pp.name, cx, 190, 150, lp * 1.4, { gap: 1.02, color: '#f1e5c6', bleed: 0.25 });
        seal(g, pp.seal, cx + 480, 205, 84, prog(t, L[k].start + 1.0, L[k].start + 1.5));
        text(g, `${pp.years} · ${pp.place}`, cx + 4, 410, { size: 34, color: PAL.goldLight, weight: 700, alpha: clamp(lp * 3), spacing: 2 });
        g.fillStyle = rgba(PAL.gold, 0.6);
        g.fillRect(cx + 4, 438, 520 * ease.out(clamp(lp * 2)), 2);
        pp.lines.forEach((ln, j) => {
          const pj = prog(t, L[k].start + 0.6 + j * 0.5, L[k].start + 1.2 + j * 0.5, ease.out);
          g.fillStyle = PAL.red;
          if (pj > 0) g.fillRect(cx + 4, 492 + j * 70, 10, 10);
          revealText(g, ln, cx + 30, 506 + j * 70, pj, { size: 36, color: PAL.paper, weight: 600 });
        });
        g.restore();
      }
    });
    text(g, '人物剪影为示意，非肖像', 110, H - 150, { size: 20, color: PAL.paper2, alpha: 0.5 * prog(t, 0.5, 1.5) });
  },
};

// ================================================================ S11 Guangxu
const S11 = {
  trans: 'fade',
  transDur: 0.9,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(darkGround({ base: '#2a1d0c', seed: 88 }), 0, 0);
    radialGlow(g, 520, 420, 900, '#d9a62e', 0.22);
    rays(g, 520, -100, t, { angle: Math.PI / 2, spread: 0.12, count: 7, alpha: 0.07, color: '#ffd889', len: 1300, width: 80 });
    dust(g, t, { count: 60, alpha: 0.5, color: '#f4d58a' });
    const p = prog(t, 0.0, 1.2, ease.out);
    g.save();
    g.globalAlpha = p;
    bust(g, 520, 470 + (1 - p) * 30, 1.35, 'imperial', { color: '#120c06', rim: '#f0c86a', accent: '#b3261e' });
    g.restore();
    const cx = 900;
    const c0 = cue(sc, 0);
    brushWrite(g, '光绪帝', cx, 200, 150, prog(t, c0.start + 0.6, c0.start + 2.6, (u) => u), { gap: 1.02, color: '#f6e7bf', bleed: 0.25 });
    seal(g, '光绪', cx + 500, 215, 84, prog(t, c0.start + 2.2, c0.start + 2.7));
    const info = ['爱新觉罗·载湉（1871—1908）', '1875年即位，年号“光绪”', '1889年亲政，然朝政大权仍多受慈禧太后制约'];
    info.forEach((ln, j) => {
      const pj = prog(t, c0.start + 1.0 + j * 0.45, c0.start + 1.6 + j * 0.45, ease.out);
      revealText(g, ln, cx + 4, 430 + j * 66, pj, { size: j === 0 ? 38 : 32, color: j === 0 ? PAL.goldLight : PAL.paper, weight: j === 0 ? 800 : 500 });
    });
    text(g, '人物剪影为示意，非肖像', 110, H - 150, { size: 20, color: PAL.paper2, alpha: 0.5 * p });
  },
};

// ================================================================ S13 edict excerpt
const EDICT = [
  '數年以來中外臣工', '講求時務多主變法自強', '……', '嗣後中外大小諸臣', '自王公以及士庶',
  '各宜努力向上發憤為雄', '以聖賢義理之學植其根本', '又須博採西學之切於時務者', '實力講求以救空疏迂謬之弊', '……',
  '京師大學堂為各行省之倡', '尤應首先舉辦',
];
const S13 = {
  trans: 'fade',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(darkGround({ base: '#1b130b', seed: 92 }), 0, 0);
    const pw = 1500, ph = 700;
    const doc = agedPaper({ w: pw, h: ph, seed: 95, base: '#e6cf98', stains: 10 });
    // slow pan right -> left across the columns, slight push
    const pan = lerp(170, -170, ease.inOutSine(clamp(t / (D + 0.4))));
    const sc2 = lerp(1.0, 1.06, t / D);
    g.save();
    g.translate(W / 2 + pan, H / 2 - 80);
    g.scale(sc2, sc2);
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 50;
    g.drawImage(doc, -pw / 2, -ph / 2);
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(120,70,20,0.55)';
    g.lineWidth = 3;
    g.strokeRect(-pw / 2 + 30, -ph / 2 + 30, pw - 60, ph - 60);
    const colW = 100, size = 45;
    const x0 = pw / 2 - 110;
    const c0 = cue(sc, 0);
    const hlStart = c0.start + 1.6;
    EDICT.forEach((col, i) => {
      const x = x0 - i * colW;
      const pa = prog(t, 0.2 + i * 0.12, 0.8 + i * 0.12);
      const isKey = i === 7;
      vtext(g, col, x, -ph / 2 + 70, { size, color: '#22150c', family: FONTS.kaiTC, alpha: pa, lineHeight: size * 1.12 });
      if (isKey) {
        const n = [...col].length;
        for (let k = 2; k < n; k++) {
          const pk = prog(t, hlStart + k * 0.12, hlStart + k * 0.12 + 0.2);
          if (pk <= 0) continue;
          g.fillStyle = rgba('#b3261e', 0.85 * pk);
          g.beginPath();
          g.arc(x + size * 0.68, -ph / 2 + 70 + k * size * 1.12 + size * 0.56, 7, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
    g.restore();
    const pc = prog(t, 0.6, 1.4, ease.out);
    panel(g, 90, 840, 860, 116, 0.6 * pc, { border: false });
    text(g, '《明定国是诏》（节录）', 120, 890, { size: 36, color: PAL.goldLight, weight: 800, alpha: pc });
    text(g, '光绪二十四年四月二十三日（1898年6月11日）颁布', 122, 934, { size: 24, color: PAL.paper2, alpha: pc });
    const pk = prog(t, hlStart + 0.6, hlStart + 1.6, ease.out);
    if (pk > 0) {
      panel(g, W - 760, 840, 680, 116, 0.6 * pk, { border: false });
      text(g, '博采西学之切于时务者', W - 730, 890, { size: 34, color: '#ffd9c8', weight: 800, alpha: pk });
      text(g, '意为：广泛吸收切合时务的西方学问', W - 728, 934, { size: 24, color: PAL.paper2, alpha: pk });
    }
  },
};

// ================================================================ S14 timeline: the 103 days begin
const S14 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1);
    g.drawImage(paper({ base: '#e7dbbf', seed: 97, edge: 0.3 }), 0, 0);
    const x0 = 180, x1 = W - 180, y = 600;
    const pa = prog(t, 0.0, 1.6, ease.inOut);
    const X = dayAxis(g, x0, x1, y, pa, { color: '#2a1d12' });
    text(g, '1898', x0 - 10, y - 260, { size: 72, family: FONTS.brush, color: '#2a1d12', alpha: pa });
    // progress band ("the curtain rises")
    const pb = prog(t, l1.start, l1.start + 2.0, ease.inOut);
    g.save();
    g.fillStyle = rgba(PAL.red, 0.75);
    g.fillRect(X(1), y - 6, (X(6) - X(1)) + (X(18) - X(6)) * pb, 12);
    g.restore();
    const events = [
      { d: 1, t: l0.start - 0.6, a: '6月11日', b: '颁布《明定国是诏》', up: true },
      { d: 6, t: l0.start + 0.2, a: '6月16日', b: '颐和园仁寿殿召见康有为', up: false },
    ];
    for (const e of events) {
      const p = prog(t, e.t, e.t + 0.8, ease.out);
      if (p <= 0) continue;
      const x = X(e.d);
      g.save();
      g.globalAlpha = p;
      g.fillStyle = PAL.red;
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2a1d12';
      g.lineWidth = 2;
      const yy = e.up ? y - 170 : y + 120;
      g.beginPath();
      g.moveTo(x, y + (e.up ? -14 : 14));
      g.lineTo(x, yy + (e.up ? 30 : -40));
      g.stroke();
      text(g, e.a, x + 12, yy, { size: 36, color: '#7a160f', weight: 900 });
      text(g, e.b, x + 12, yy + 44, { size: 30, color: '#2a1d12', weight: 700 });
      g.restore();
    }
    // end marker hidden: question of how long it will last
    const pe = prog(t, l1.start + 0.8, l1.start + 1.8, ease.out);
    if (pe > 0) {
      const x = X(103);
      g.save();
      g.globalAlpha = pe * 0.8;
      g.setLineDash([8, 8]);
      g.strokeStyle = '#7a160f';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y - 120);
      g.lineTo(x, y + 30);
      g.stroke();
      g.restore();
      text(g, '9月21日', x, y - 140, { size: 32, align: 'center', color: '#7a160f', weight: 900, alpha: pe });
      text(g, '第103天', x, y - 186, { size: 26, align: 'center', color: '#2a1d12', alpha: pe });
    }
    const pt = prog(t, l1.start, l1.start + 1.2, ease.out);
    brushWrite(g, '自上而下', W / 2 - 300, 230, 130, prog(t, l1.start + 0.2, l1.start + 2.6, (u) => u), { gap: 1.08, color: '#1a120c', bleed: 0.3 });
    text(g, '百日维新 · 开启', W / 2, 860, { size: 40, align: 'center', color: '#2a1d12', weight: 800, alpha: pt, spacing: 10 });
  },
};

Object.assign(ch3Scenes, { S10_reformers: S10, S11_guangxu: S11, S13_edict: S13, S14_timeline: S14 });
