// 第四章 百日新政
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, agedPaper, darkGround, puff } from '../textures.js';
import { brushWrite, hanzi, seal, brushLine, brushArrow, inkRing } from '../brush.js';
import { dust, smoke, rays, glowSprite } from '../fx.js';
import { card, panel, tagLabel, gear, factory, soldier, rails, strike, bust } from '../ui.js';
import { University } from '../three/scenes3d.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };
const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

const CATS = [
  { k: '政治', c: '#7a160f' },
  { k: '教育', c: '#2f5d50' },
  { k: '经济', c: '#8a6a35' },
  { k: '军事', c: '#3d4f6a' },
];

// header used by every reform section
function sectionHead(g, t, idx, title, sub, o = {}) {
  const p = prog(t, 0.1, 0.9, ease.out);
  const cat = CATS[idx];
  seal(g, cat.k, 100, 92, 104, prog(t, 0.0, 0.5), { color: cat.c });
  text(g, title, 232, 158, { size: 54, weight: 900, color: o.color || PAL.ink, alpha: p, spacing: 6 });
  if (sub) revealText(g, sub, 234, 202, prog(t, 0.3, 1.3), { size: 26, color: o.subColor || '#5a4630', spacing: 3 });
  // progress dots of the four sections
  CATS.forEach((c, i) => {
    g.fillStyle = i === idx ? c.c : 'rgba(90,70,50,0.25)';
    g.beginPath();
    g.arc(W - 220 + i * 46, 140, i === idx ? 12 : 8, 0, Math.PI * 2);
    g.fill();
  });
  text(g, '百日新政', W - 152, 186, { size: 22, align: 'center', color: o.subColor || '#5a4630', alpha: p, spacing: 6 });
}

function paperBG(g, seed = 101, base = '#ebe0c6') {
  g.drawImage(paper({ base, seed, edge: 0.28 }), 0, 0);
}

// ================================================================ S15 edicts flood
const S15 = {
  trans: 'ink',
  transDur: 1.1,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(darkGround({ base: '#22180c', seed: 111 }), 0, 0);
    radialGlow(g, W / 2, H / 2 - 40, 1000, '#d9a62e', 0.2);
    // falling edict slips with depth
    const rnd = mulberry32(5);
    const slips = [];
    for (let i = 0; i < 110; i++) slips.push({ x: rnd() * W * 1.2 - W * 0.1, z: 0.3 + rnd() * 0.9, t0: rnd() * 4.5, rot: (rnd() - 0.5) * 0.8, sp: 0.6 + rnd() * 0.6 });
    slips.sort((a, b) => a.z - b.z);
    for (const s of slips) {
      const lt = t - s.t0 * 0.9;
      if (lt < 0) continue;
      const y = -200 + lt * 520 * s.sp * s.z;
      if (y > H + 200) continue;
      const w = 70 * s.z, h = 190 * s.z;
      g.save();
      g.globalAlpha = 0.35 + 0.65 * s.z;
      g.translate(s.x, y);
      g.rotate(s.rot + Math.sin(lt * 2 + s.x) * 0.2);
      g.fillStyle = s.z > 0.8 ? '#e9c875' : '#c9a85a';
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = 'rgba(60,35,10,0.5)';
      for (let k = 0; k < 3; k++) g.fillRect(-w / 2 + w * (0.2 + k * 0.25), -h / 2 + h * 0.1, w * 0.06, h * 0.75);
      g.restore();
    }
    // counter
    const c0 = cue(sc, 0);
    const pc = prog(t, c0.start, c0.end - 0.4, ease.inOut);
    const n = Math.round(lerp(1, 103, pc));
    g.save();
    g.fillStyle = 'rgba(10,6,2,0.55)';
    roundRect(g, W / 2 - 360, 330, 720, 330, 10);
    g.fill();
    g.restore();
    text(g, '变法第', W / 2 - 250, 440, { size: 40, color: PAL.paper2, weight: 600, alpha: prog(t, 0.2, 0.8) });
    text(g, String(n), W / 2 + 40, 470, { size: 120, align: 'right', color: PAL.goldLight, family: FONTS.brush, alpha: prog(t, 0.2, 0.8) });
    text(g, '天', W / 2 + 60, 440, { size: 40, color: PAL.paper2, weight: 600, alpha: prog(t, 0.2, 0.8) });
    const pd = prog(t, c0.start + 1.5, c0.start + 2.5, ease.out);
    revealText(g, '新政诏令  百余道', W / 2, 590, pd, { size: 52, align: 'center', color: '#fff0c8', weight: 900, spacing: 8 });
    // four category seals
    CATS.forEach((c, i) => {
      seal(g, c.k, W / 2 - 330 + i * 180, 770, 120, prog(t, c0.end - 0.6 + i * 0.25, c0.end - 0.1 + i * 0.25), { color: c.c, rot: (i - 1.5) * 0.02 });
    });
  },
};

// ================================================================ S16 politics
const OFFICES = ['詹事府', '通政司', '光禄寺', '鸿胪寺', '太常寺', '太仆寺', '大理寺'];
const S16 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1);
    paperBG(g, 121);
    sectionHead(g, t, 0, '政治：精简机构 · 广开言路', '1898年夏秋间陆续颁布的相关诏令');
    // left: offices struck out
    const bx = 120, by = 300, bw = 210, bh = 92;
    OFFICES.forEach((o, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = bx + col * (bw + 26), y = by + row * (bh + 30);
      const pa = prog(t, 0.4 + i * 0.12, 0.9 + i * 0.12, ease.out);
      const ps = prog(t, l0.start + 0.8 + i * 0.25, l0.start + 1.2 + i * 0.25);
      g.save();
      g.globalAlpha = pa * (1 - ps * 0.45);
      g.fillStyle = 'rgba(250,244,230,0.9)';
      g.fillRect(x, y, bw, bh);
      g.strokeStyle = '#4a3826';
      g.lineWidth = 2;
      g.strokeRect(x, y, bw, bh);
      text(g, o, x + bw / 2, y + 60, { size: 40, align: 'center', color: PAL.ink, weight: 800, spacing: 4 });
      g.restore();
      strike(g, x - 10, y + bh * 0.75, x + bw + 10, y + bh * 0.25, ps, PAL.red, 9);
    });
    const pl = prog(t, l0.start + 2.6, l0.start + 3.4, ease.out);
    revealText(g, '裁撤闲散衙门 · 裁汰冗员', bx, by + 3 * (bh + 30) + 40, pl, { size: 38, color: '#7a160f', weight: 900, spacing: 3 });
    revealText(g, '另裁撤与总督同城的湖北、广东、云南三省巡抚等', bx, by + 3 * (bh + 30) + 92, pl, { size: 24, color: '#5a4630' });
    // right: memorials flowing up
    const p1 = prog(t, l1.start - 0.3, l1.start + 0.6, ease.out);
    if (p1 > 0) {
      const rx = 1380;
      g.save();
      g.globalAlpha = p1;
      // top: emperor
      g.fillStyle = '#7a160f';
      roundRect(g, rx - 130, 280, 260, 84, 6);
      g.fill();
      text(g, '皇  帝', rx, 336, { size: 40, align: 'center', color: '#fff3d6', weight: 900, spacing: 6 });
      const boxes = [[rx - 240, 560, '各衙门堂官代递'], [rx + 240, 560, '都察院代递']];
      boxes.forEach(([x, y, s]) => {
        g.fillStyle = 'rgba(250,244,230,0.95)';
        g.fillRect(x - 150, y, 300, 70);
        g.strokeStyle = '#4a3826';
        g.strokeRect(x - 150, y, 300, 70);
        text(g, s, x, y + 46, { size: 30, align: 'center', color: PAL.ink, weight: 700 });
      });
      const bottoms = [[rx - 240, 800, '部院司员'], [rx + 240, 800, '士  民']];
      bottoms.forEach(([x, y, s]) => {
        text(g, s, x, y + 46, { size: 34, align: 'center', color: '#2f5d50', weight: 900, spacing: 4 });
      });
      g.restore();
      // moving memorial icons
      for (let k = 0; k < 10; k++) {
        const side = k % 2 ? 1 : -1;
        const ph = ((t - l1.start) * 0.45 + k / 10) % 1;
        if (t < l1.start) continue;
        const sx = rx + side * 240, sy = 790;
        const mx = sx, my = 640;
        const ex = rx + side * 40, ey = 380;
        let x, y;
        if (ph < 0.45) { const u = ph / 0.45; x = sx; y = lerp(sy, my, u); }
        else { const u = (ph - 0.45) / 0.55; x = lerp(mx, ex, u); y = lerp(my - 80, ey, u); }
        g.save();
        g.globalAlpha = p1 * Math.sin(ph * Math.PI);
        g.fillStyle = '#e9c875';
        g.fillRect(x - 12, y - 26, 24, 52);
        g.strokeStyle = 'rgba(90,60,20,0.8)';
        g.strokeRect(x - 12, y - 26, 24, 52);
        g.restore();
      }
      revealText(g, '准许上书言事，不得阻格', rx, 935, prog(t, l1.start + 0.8, l1.start + 2.0), { size: 34, align: 'center', color: '#7a160f', weight: 900, spacing: 3 });
    }
  },
};

// ================================================================ S17 education
const BAGU = ['破题', '承题', '起讲', '入题', '起股', '中股', '后股', '束股'];
const S17 = {
  trans: 'fade',
  transDur: 0.9,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1), l2 = lineCue(sc, 2);
    paperBG(g, 131);
    sectionHead(g, t, 1, '教育：废八股 · 改策论 · 兴学堂', '1898年6月23日诏：乡试、会试等改试策论');
    const ph0 = 1 - prog(t, l1.start - 0.4, l1.start + 0.2);
    const ph1 = prog(t, l1.start - 0.2, l1.start + 0.4) * (1 - prog(t, l2.start - 0.4, l2.start + 0.2));
    const ph2 = prog(t, l2.start - 0.2, l2.start + 0.4);
    // phase 0: eight-legged essay structure crumbles -> 策论
    if (ph0 > 0) {
      g.save();
      g.globalAlpha = ph0;
      text(g, '八股文的固定格式', 300, 330, { size: 34, align: 'center', color: PAL.ink, weight: 900 });
      BAGU.forEach((b, i) => {
        const pa = prog(t, 0.3 + i * 0.1, 0.7 + i * 0.1, ease.out);
        const crumble = prog(t, l0.start + 1.2 + i * 0.08, l0.start + 2.2 + i * 0.08, ease.in);
        const x = 160 + (i % 2) * 150, y = 370 + Math.floor(i / 2) * 110 + crumble * 300;
        g.save();
        g.globalAlpha *= pa * (1 - crumble);
        g.translate(x + 65, y + 40);
        g.rotate(crumble * (i % 2 ? 0.6 : -0.5));
        g.fillStyle = i >= 4 ? 'rgba(122,22,15,0.15)' : 'rgba(60,45,30,0.1)';
        g.fillRect(-65, -40, 130, 80);
        g.strokeStyle = '#4a3826';
        g.lineWidth = 2;
        g.strokeRect(-65, -40, 130, 80);
        text(g, b, 0, 12, { size: 32, align: 'center', color: PAL.ink, weight: 800 });
        g.restore();
      });
      // arrow and 策论 card
      const pc = prog(t, l0.start + 1.8, l0.start + 2.8, ease.out);
      brushArrow(g, [[560, 560], [760, 560]], 18, pc, '#7a160f', { seed: 4 });
      if (pc > 0) {
        card(g, 840, 330, 900, 470, { alpha: pc, seed: 17 });
        brushWrite(g, '策论', 900, 380, 160, prog(t, l0.start + 2.2, l0.start + 3.6, (u) => u), { gap: 1.0, color: '#7a160f', bleed: 0.3 });
        const lines = ['就时事政务、经世致用之学立论', '适用于：乡试 · 会试 · 生童岁科考试', '“自下科为始”实行'];
        lines.forEach((ln, j) => revealText(g, ln, 1260, 440 + j * 72, prog(t, l0.start + 2.6 + j * 0.3, l0.start + 3.3 + j * 0.3), { size: 32, color: PAL.ink, weight: j === 0 ? 800 : 500 }));
      }
      g.restore();
    }
    // phase 1: emphasis — not abolition of the exam system
    if (ph1 > 0) {
      g.save();
      g.globalAlpha = ph1;
      const pe = prog(t, l1.start, l1.start + 0.8, ease.out);
      text(g, '废八股', W / 2 - 330, 470, { size: 110, align: 'center', color: '#7a160f', weight: 900, alpha: pe });
      text(g, '≠', W / 2, 470, { size: 130, align: 'center', color: PAL.ink, weight: 900, alpha: pe });
      text(g, '废科举', W / 2 + 330, 470, { size: 110, align: 'center', color: PAL.ink, weight: 900, alpha: pe });
      const items = [
        ['1898年6月', '废八股，改试策论', '#7a160f'],
        ['1898年10月', '政变后恢复八股取士', '#5a4630'],
        ['1905年', '科举制度正式废止（清末新政时期）', '#2f5d50'],
      ];
      const ax0 = 260, ax1 = W - 260, ay = 700;
      const pa = prog(t, l1.start + 1.2, l1.start + 2.6, ease.inOut);
      g.strokeStyle = '#4a3826';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(ax0, ay);
      g.lineTo(lerp(ax0, ax1, pa), ay);
      g.stroke();
      items.forEach(([d, s, c], i) => {
        const x = lerp(ax0 + 120, ax1 - 160, i / 2);
        const pi = prog(t, l1.start + 1.4 + i * 0.7, l1.start + 2.0 + i * 0.7, ease.out);
        if (pi <= 0) return;
        g.fillStyle = c;
        g.beginPath();
        g.arc(x, ay, 13, 0, Math.PI * 2);
        g.fill();
        text(g, d, x, ay - 36, { size: 34, align: 'center', color: c, weight: 900, alpha: pi });
        text(g, s, x, ay + 62, { size: 28, align: 'center', color: PAL.ink, weight: 700, alpha: pi });
      });
      g.restore();
    }
    // phase 2: academies -> schools
    if (ph2 > 0) {
      g.save();
      g.globalAlpha = ph2;
      const cols = 8, rows = 3;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = 250 + c * 190, y = 360 + r * 170;
        const pf = prog(t, l2.start + 0.6 + i * 0.05, l2.start + 1.1 + i * 0.05, ease.out);
        // building icon: roof + body
        g.fillStyle = pf > 0.5 ? '#2f5d50' : '#6a5a48';
        g.beginPath();
        g.moveTo(x - 70, y);
        g.quadraticCurveTo(x, y - 30, x + 70, y);
        g.lineTo(x + 50, y - 10);
        g.lineTo(x - 50, y - 10);
        g.closePath();
        g.fill();
        g.fillRect(x - 50, y, 100, 60);
        g.fillStyle = 'rgba(250,244,230,0.9)';
        g.fillRect(x - 15, y + 22, 30, 38);
        if (pf > 0.5) {
          text(g, '中', x - 30, y + 48, { size: 22, align: 'center', color: '#fff3d6', weight: 900 });
          text(g, '西', x + 30, y + 48, { size: 22, align: 'center', color: '#fff3d6', weight: 900 });
        }
      }
      revealText(g, '书院  →  兼习中学、西学的学堂', W / 2, 920, prog(t, l2.start + 0.4, l2.start + 1.6), { size: 42, align: 'center', color: '#2f5d50', weight: 900, spacing: 4 });
      g.restore();
    }
  },
};

// ================================================================ S18 university (3D + info)
const S18 = {
  trans: 'fade',
  transDur: 1.0,
  tag: '艺术重现 · 非历史影像',
  grain: 0.05,
  init() { University.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = lineCue(sc, 0), l1 = lineCue(sc, 1);
    const img = University.render(t, { keys: [
      { t: 0, pos: [5, 1.6, 40], look: [0, 4.6, 0], fov: 38 },
      { t: D * 0.6, pos: [1.5, 2.2, 22], look: [0, 5.0, 0], fov: 36 },
      { t: D + 0.5, pos: [-2.5, 3.0, 15], look: [0, 5.4, 0], fov: 34 },
    ] });
    g.drawImage(img, 0, 0);
    // info panel (right)
    const pi = prog(t, l0.start, l0.start + 0.8, ease.out) * (1 - prog(t, l1.start - 0.3, l1.start + 0.3));
    if (pi > 0) {
      const x = W - 760, y = 250;
      g.save();
      g.globalAlpha = pi;
      panel(g, x, y, 680, 420, 0.62);
      brushWrite(g, '京师大学堂', x + 40, y + 40, 100, prog(t, l0.start + 0.2, l0.start + 2.2, (u) => u), { gap: 1.02, color: '#f3e3bd', bleed: 0.2 });
      const lines = ['1898年创办', '近代中国第一所国立综合性大学', '亦为全国最高教育行政机关，统辖各省学堂'];
      lines.forEach((ln, j) => revealText(g, ln, x + 44, y + 220 + j * 62, prog(t, l0.start + 1.2 + j * 0.6, l0.start + 1.9 + j * 0.6), { size: j === 0 ? 34 : 30, color: j === 0 ? PAL.goldLight : PAL.paper, weight: j === 0 ? 800 : 500 }));
      g.restore();
    }
    // timeline (bottom)
    const pt = prog(t, l1.start - 0.2, l1.start + 0.6, ease.out);
    if (pt > 0) {
      const y = 760;
      g.save();
      g.globalAlpha = pt;
      const gr = g.createLinearGradient(0, y - 180, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0.65)');
      g.fillStyle = gr;
      g.fillRect(0, y - 180, W, H - y + 180);
      const nodes = [['1898', '京师大学堂创办'], ['1898.9', '政变后得以保留'], ['1912', '改称北京大学']];
      const x0 = 330, x1 = W - 330;
      const pa = prog(t, l1.start, l1.start + 2.4, ease.inOut);
      g.strokeStyle = rgba(PAL.gold, 0.8);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(lerp(x0, x1, pa), y);
      g.stroke();
      nodes.forEach(([a, b], i) => {
        const x = lerp(x0, x1, i / 2);
        const pn = prog(t, l1.start + i * 0.9, l1.start + 0.6 + i * 0.9, ease.out);
        if (pn <= 0) return;
        g.fillStyle = i === 2 ? PAL.redLight : PAL.goldLight;
        g.beginPath();
        g.arc(x, y, 12, 0, Math.PI * 2);
        g.fill();
        text(g, a, x, y - 32, { size: 40, align: 'center', color: PAL.goldLight, weight: 900, alpha: pn });
        text(g, b, x, y + 56, { size: 30, align: 'center', color: PAL.paper, weight: 700, alpha: pn });
      });
      g.restore();
    }
  },
};

// ================================================================ S19 economy
const S19 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const c0 = cue(sc, 0);
    paperBG(g, 141, '#ece2c8');
    sectionHead(g, t, 2, '经济：振兴实业', '设局、修路、开矿、奖励创新');
    // two bureaus
    const bs = [['农工商总局', 1898, 470], ['矿务铁路总局', 1898, 1100]];
    bs.forEach(([s, y, x], i) => {
      const p = prog(t, c0.start + 0.4 + i * 0.8, c0.start + 1.2 + i * 0.8, ease.out);
      if (p <= 0) return;
      card(g, x - 230, 280, 460, 150, { alpha: p, seed: 30 + i });
      text(g, s, x, 372, { size: 50, align: 'center', color: '#8a3a12', weight: 900, alpha: p, spacing: 6 });
    });
    // icons: gears, factory, rails
    const pi = prog(t, c0.start + 1.6, c0.start + 2.6, ease.out);
    g.save();
    g.globalAlpha = pi;
    gear(g, 360, 640, 70, t * 0.8, '#5a4630', 12);
    gear(g, 470, 720, 46, -t * 1.2 + 0.2, '#8a6a35', 9);
    factory(g, 760, 820, 1.4, t, '#3a2c20');
    g.restore();
    rails(g, [[1000, 820], [1200, 760], [1420, 720], [1700, 700]], prog(t, c0.start + 1.8, c0.start + 3.6, ease.inOut), '#3a2c20');
    // train head
    const pr = prog(t, c0.start + 1.8, c0.start + 3.6, ease.inOut);
    if (pr > 0.05) {
      const pts = [[1000, 820], [1200, 760], [1420, 720], [1700, 700]];
      const seg = Math.min(2, Math.floor(pr * 3));
      const u = pr * 3 - seg;
      const x = lerp(pts[seg][0], pts[seg + 1][0], u), y = lerp(pts[seg][1], pts[seg + 1][1], u);
      g.save();
      g.fillStyle = '#2a1d12';
      g.translate(x, y - 30);
      g.fillRect(-50, -30, 80, 44);
      g.fillRect(14, -54, 18, 26);
      g.beginPath();
      g.arc(-30, 18, 12, 0, 7);
      g.arc(10, 18, 12, 0, 7);
      g.fill();
      g.restore();
    }
    const pl = prog(t, c0.end - 1.6, c0.end - 0.6, ease.out);
    revealText(g, '提倡实业 · 奖励发明创造', W / 2, 905, pl, { size: 44, align: 'center', color: '#7a3a12', weight: 900, spacing: 4 });
    text(g, '（如颁布《振兴工艺给奖章程》）', W / 2, 946, { size: 24, align: 'center', color: '#5a4630', alpha: pl * 0.9 });
  },
};

// ================================================================ S20 military
const S20 = {
  trans: 'ink',
  transDur: 1.0,
  draw(g, t, sc) {
    const D = sc.dur;
    const c0 = cue(sc, 0);
    paperBG(g, 151, '#e9e0cc');
    sectionHead(g, t, 3, '军事：改革兵制', '裁汰旧军 · 改练洋操');
    // left: old troops fading
    const pf = prog(t, c0.start + 0.8, c0.start + 2.4);
    for (let i = 0; i < 6; i++) {
      const x = 180 + (i % 3) * 120, y = 610 + Math.floor(i / 3) * 160;
      g.save();
      g.globalAlpha = (1 - pf * 0.8) * prog(t, 0.2 + i * 0.05, 0.6 + i * 0.05);
      soldier(g, x, y, 0.75, i % 2 ? 'bow' : 'spear', '#6a5a48', 0);
      g.restore();
    }
    strike(g, 120, 520, 560, 900, prog(t, c0.start + 1.0, c0.start + 1.6), PAL.red, 12);
    text(g, '旧式军队（绿营等）', 360, 470, { size: 34, align: 'center', color: '#5a4630', weight: 900, alpha: prog(t, 0.3, 1.0) });
    // right: new drill marching in formation
    const pm = prog(t, c0.start + 1.4, c0.start + 2.2, ease.out);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = 900 + c * 140 + r * 40 + (t - c0.start) * 18, y = 570 + r * 130;
      g.save();
      g.globalAlpha = pm;
      soldier(g, x, y, 0.62, 'rifle', '#2a2f3a', t * 6 + c * 0.5);
      g.restore();
    }
    text(g, '新式操练', 1300, 470, { size: 34, align: 'center', color: '#3d4f6a', weight: 900, alpha: pm });
    revealText(g, '改练洋操 · 以西法训练新式军队', W / 2, 930, prog(t, c0.start + 2.0, c0.start + 3.2), { size: 42, align: 'center', color: '#3d4f6a', weight: 900, spacing: 4 });
  },
};

export default { S15_edicts: S15, S16_politics: S16, S17_education: S17, S18_university: S18, S19_economy: S19, S20_military: S20 };
