// 第七章 历史回响 + 片尾
import { W, H, PAL, clamp, lerp, ease, prog, remap, smoothstep, envelope, text, revealText, rgba, FONTS, makeCanvas, roundRect, mulberry32, noise, radialGlow, measure, vtext } from '../engine.js';
import { paper, darkGround, agedPaper } from '../textures.js';
import { brushWrite, seal, hanzi } from '../brush.js';
import { dust, smoke, candle, filmDamage, rays } from '../fx.js';
import { panel, tagLabel } from '../ui.js';
import { OldCity, Modern } from '../three/scenes3d.js';

const cue = (sc, i) => sc.cues[Math.min(i, sc.cues.length - 1)] || { start: 0, end: 1 };
const lineCue = (sc, l) => sc.cues.find((c) => c.line === l) || cue(sc, 0);

// ================================================================ S30 echoes: old photo -> modern city
const S30 = {
  trans: 'ink',
  transDur: 1.4,
  tag: '当代城市（示意） · 程序化场景',
  grain: 0.05,
  init() { Modern.build(); OldCity.build(); },
  draw(g, t, sc) {
    const D = sc.dur;
    const segs = sc.cues;
    const mix = prog(t, 1.2, 3.4, ease.inOut);
    if (mix < 1) {
      const old = OldCity.render(9 + t * 0.3, { keys: [{ t: 0, pos: [-0.6, 3.4, 44], look: [0, 12, -120], fov: 36 }, { t: 30, pos: [-0.4, 3.6, 30], look: [0, 12, -120], fov: 34 }] });
      g.drawImage(old, 0, 0);
      filmDamage(g, t, { alpha: 0.5 });
    }
    if (mix > 0) {
      const img = Modern.render(t, { keys: [
        { t: 0, pos: [0, 60, 360], look: [0, 55, -800], fov: 42 },
        { t: D + 1, pos: [12, 100, 80], look: [-20, 80, -900], fov: 40 },
      ] });
      g.save();
      g.globalAlpha = mix;
      // reveal with a soft horizontal wipe
      g.drawImage(img, 0, 0);
      g.restore();
    }
    // three legacies
    const legacies = [
      ['思想启蒙', '民权、变法观念广泛传播'],
      ['政治改革', '成为公开讨论的议题'],
      ['近代教育', '京师大学堂等新式教育的种子'],
    ];
    const starts = [segs[1] ? segs[1].start : 3, segs[2] ? segs[2].start : 5, segs[3] ? segs[3].start : 7];
    legacies.forEach(([a, b], i) => {
      const p = prog(t, starts[i], starts[i] + 0.9, ease.out) * (1 - smoothstep(D - 0.7, D, t));
      if (p <= 0) return;
      const x = 300 + i * 660, y = 300;
      g.save();
      g.globalAlpha = p;
      g.drawImage(makeShade(), x - 260, y - 110, 520, 260);
      text(g, a, x, y + (1 - p) * 20, { size: 64, align: 'center', color: '#fff2cf', weight: 900, spacing: 10, shadow: { color: 'rgba(0,0,0,0.6)', blur: 18 } });
      text(g, b, x, y + 64, { size: 28, align: 'center', color: '#fbe8c8', weight: 600, shadow: { color: 'rgba(0,0,0,0.8)', blur: 10 } });
      g.restore();
    });
  },
};
let shadeC = null;
function makeShade() {
  if (shadeC) return shadeC;
  const { c, g } = makeCanvas(520, 260);
  const gr = g.createRadialGradient(260, 130, 10, 260, 130, 260);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 520, 260);
  shadeC = c;
  return c;
}

// ================================================================ S31 final words: the book of history
const S31 = {
  trans: 'black',
  transDur: 1.4,
  noHud: true,
  draw(g, t, sc) {
    const D = sc.dur;
    const l0 = cue(sc, 0), l1 = cue(sc, 1);
    g.drawImage(darkGround({ base: '#120d09', seed: 211 }), 0, 0);
    radialGlow(g, W / 2, H / 2, 1100, '#c9a45c', 0.12);
    const pull = lerp(1.18, 0.96, ease.inOutSine(clamp(t / (D + 0.5))));
    g.save();
    g.translate(W / 2, H / 2 + 30);
    g.scale(pull, pull);
    // open thread-bound book: two pages
    const pw = 640, ph = 820;
    for (const side of [-1, 1]) {
      const pg = agedPaper({ w: pw, h: ph, seed: side > 0 ? 221 : 222, base: '#e6d6b0', stains: 6 });
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 40;
      g.drawImage(pg, side > 0 ? 0 : -pw, -ph / 2);
      g.restore();
      // gutter shading
      const gr = g.createLinearGradient(0, 0, side * 120, 0);
      gr.addColorStop(0, 'rgba(60,40,20,0.45)');
      gr.addColorStop(1, 'rgba(60,40,20,0)');
      g.fillStyle = gr;
      g.fillRect(side > 0 ? 0 : -120, -ph / 2, 120, ph);
      // ruled columns
      g.strokeStyle = 'rgba(140,40,30,0.25)';
      g.lineWidth = 1.5;
      for (let i = 1; i < 9; i++) {
        const x = side > 0 ? i * (pw / 9) : -i * (pw / 9);
        g.beginPath();
        g.moveTo(x, -ph / 2 + 50);
        g.lineTo(x, ph / 2 - 50);
        g.stroke();
      }
    }
    // right page: 1898 戊戌 ; left page: 103天
    brushWrite(g, '戊戌', pw / 2 - 90, -ph / 2 + 90, 180, prog(t, l0.start - 0.4, l0.start + 1.8, (u) => u), { dir: 'v', gap: 1.05, color: '#1a120c', bleed: 0.4 });
    text(g, '1898', pw / 2 - 260, ph / 2 - 110, { size: 70, family: FONTS.brush, color: '#5a1a12', alpha: prog(t, l0.start + 0.8, l0.start + 1.6) });
    const p103 = prog(t, l0.start + 0.4, l0.start + 1.6, ease.out);
    text(g, '103', -pw / 2, 30, { size: 230, align: 'center', family: FONTS.brush, color: '#8e1b12', alpha: p103 });
    hanzi(g, '天', -pw / 2 - 75, 90, 150, prog(t, l0.start + 1.0, l0.start + 2.2), { color: '#1a120c', bleed: 0.3 });
    seal(g, '百日维新', -140, ph / 2 - 200, 110, prog(t, l1.end - 0.2, l1.end + 0.5));
    g.restore();
    candle(g, 180, 760, t, 1.0, { height: 280 });
    dust(g, t, { count: 50, alpha: 0.35 });
    const pe = prog(t, l1.end + 0.2, l1.end + 1.4) * 0.7;
    if (pe > 0) {
      g.fillStyle = `rgba(0,0,0,${pe})`;
      g.fillRect(0, 0, W, H);
    }
  },
};

// ================================================================ S32 credits
const REFS = [
  '茅海建：《戊戌变法史事考》，生活·读书·新知三联书店，2005',
  '茅海建：《从甲午到戊戌：康有为〈我史〉鉴注》，三联书店，2009',
  '汤志钧：《戊戌变法史》，人民出版社，1984',
  '中国史学会主编：《戊戌变法》（中国近代史资料丛刊），神州国光社，1953',
  '梁启超：《戊戌政变记》（1898）',
  '《清德宗实录》《光绪朝东华录》相关上谕',
  '北京大学校史馆：京师大学堂相关史料',
];
const S32 = {
  trans: 'black',
  transDur: 1.6,
  noHud: true,
  draw(g, t, sc) {
    const D = sc.dur;
    g.drawImage(darkGround({ base: '#0c0a08', seed: 231 }), 0, 0);
    dust(g, t, { count: 60, alpha: 0.4, color: '#e0c27e' });
    const pt = prog(t, 0.2, 1.6, ease.out);
    brushWrite(g, '戊戌变法', W / 2 - 330, 110, 150, prog(t, 0.0, 2.0, (u) => u), { gap: 1.06, color: '#efe2c2', bleed: 0.2 });
    text(g, '—— 改变中国的103天 ——', W / 2, 340, { size: 40, align: 'center', color: PAL.goldLight, alpha: pt, spacing: 10, weight: 600 });
    const pr = prog(t, 2.0, 3.0, ease.out);
    g.save();
    g.globalAlpha = pr;
    text(g, '主要参考资料', 240, 440, { size: 32, color: PAL.goldLight, weight: 900, spacing: 4 });
    REFS.forEach((r, i) => text(g, r, 242, 494 + i * 44, { size: 24, color: PAL.paper2 }));
    text(g, '画面说明', 1260, 440, { size: 32, color: PAL.goldLight, weight: 900, spacing: 4 });
    const notes = [
      '片中宫殿、城市、人物剪影等画面',
      '均为程序化生成的艺术重现，',
      '并非历史照片或现场影像。',
      '地图为示意图，边界为近似。',
      '配乐为程序化合成。',
    ];
    notes.forEach((r, i) => text(g, r, 1262, 494 + i * 44, { size: 24, color: PAL.paper2 }));
    g.restore();
    const pc = prog(t, 3.2, 4.2, ease.out);
    text(g, '制作  hqy', W / 2, 900, { size: 30, align: 'center', color: PAL.goldLight, alpha: pc * 0.75, spacing: 8 });
    text(g, '大学历史课程课堂展示用', W / 2, 946, { size: 20, align: 'center', color: PAL.paper2, alpha: pc * 0.5, spacing: 4 });
  },
};

export default { S30_echo: S30, S31_final: S31, S32_credits: S32 };
