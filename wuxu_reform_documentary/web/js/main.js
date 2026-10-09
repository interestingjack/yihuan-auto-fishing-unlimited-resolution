// Film runtime: loads assets, maps absolute time -> scene(s), composes transitions
// and global overlays, and exposes renderFrame/renderFrameJPEG for the headless driver.
import { W, H, FPS, PAL, makeCanvas, clamp, smoothstep, ease, text, rgba, FONTS, vignette, remap, envelope } from './engine.js';
import { grainTiles, noiseField } from './textures.js';
import { loadHanzi, brushWrite, seal } from './brush.js';
import { loadMaps } from './mapkit.js';
import TL from '../timeline.js';
import { SCENES } from './scenes/index.js';

const main = document.getElementById('main');
const G = main.getContext('2d');
const layerA = makeCanvas(W, H);
const layerB = makeCanvas(W, H);
const maskC = makeCanvas(480, 270);
const maskBig = makeCanvas(W, H);

const CH_NUM = ['', '一', '二', '三', '四', '五', '六', '七'];

function sceneAt(T) {
  const S = TL.scenes;
  let i = S.findIndex((s) => T >= s.start && T < s.start + s.dur);
  if (i < 0) i = T < 0 ? 0 : S.length - 1;
  return i;
}

function drawScene(idx, lt, g) {
  const sc = TL.scenes[idx];
  const def = SCENES[sc.id];
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  if (def) def.draw(g, lt, sc);
  else {
    text(g, sc.id, W / 2, H / 2, { size: 60, align: 'center', color: '#fff' });
  }
  g.restore();
}

function inkMask(p, seed = 1) {
  const w = 480, h = 270;
  const nf = noiseField(w, h, 40 + seed, 0.018);
  const img = maskC.g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
      const rad = Math.sqrt(dx * dx * 0.8 + dy * dy) / 1.25;
      const v = rad * 0.62 + nf[y * w + x] * 0.38;
      const thr = p * 1.25 - 0.1;
      const a = smoothstep(thr + 0.05, thr - 0.05, v);
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = a * 255;
    }
  }
  maskC.g.putImageData(img, 0, 0);
  maskBig.g.clearRect(0, 0, W, H);
  maskBig.g.imageSmoothingQuality = 'high';
  maskBig.g.drawImage(maskC.c, 0, 0, W, H);
  return maskBig.c;
}

function composite(T) {
  const S = TL.scenes;
  const i = sceneAt(T);
  const sc = S[i];
  // transition window around the boundary with the next / previous scene
  const next = S[i + 1];
  const def = SCENES[sc.id] || {};
  const defN = next ? SCENES[next.id] || {} : {};
  let pair = null;
  if (next) {
    const d = defN.transDur ?? 0.9;
    const b = next.start;
    if (T >= b - d / 2) pair = { a: i, b: i + 1, p: (T - (b - d / 2)) / d, type: defN.trans || 'fade' };
  }
  if (!pair && i > 0) {
    const d = def.transDur ?? 0.9;
    const b = sc.start;
    if (T < b + d / 2) pair = { a: i - 1, b: i, p: (T - (b - d / 2)) / d, type: def.trans || 'fade' };
  }
  if (!pair || pair.type === 'cut') {
    drawScene(i, T - sc.start, G);
    return;
  }
  const A = S[pair.a], B = S[pair.b];
  const p = clamp(pair.p);
  drawScene(pair.a, T - A.start, layerA.g);
  drawScene(pair.b, Math.max(0, T - B.start), layerB.g);
  G.save();
  G.globalAlpha = 1;
  G.globalCompositeOperation = 'source-over';
  if (pair.type === 'black') {
    G.fillStyle = '#000';
    G.fillRect(0, 0, W, H);
    if (p < 0.5) { G.globalAlpha = ease.inOut(1 - p * 2); G.drawImage(layerA.c, 0, 0); }
    else { G.globalAlpha = ease.inOut(p * 2 - 1); G.drawImage(layerB.c, 0, 0); }
  } else if (pair.type === 'ink') {
    G.drawImage(layerA.c, 0, 0);
    const m = inkMask(ease.inOut(p), pair.b);
    layerB.g.save();
    layerB.g.globalCompositeOperation = 'destination-in';
    layerB.g.drawImage(m, 0, 0);
    layerB.g.restore();
    G.drawImage(layerB.c, 0, 0);
  } else if (pair.type === 'white') {
    G.drawImage(p < 0.5 ? layerA.c : layerB.c, 0, 0);
    G.globalAlpha = 1 - Math.abs(p - 0.5) * 2;
    G.fillStyle = '#f4ead2';
    G.fillRect(0, 0, W, H);
  } else {
    G.drawImage(layerA.c, 0, 0);
    G.globalAlpha = ease.inOutSine(p);
    G.drawImage(layerB.c, 0, 0);
  }
  G.restore();
}

// ---------------------------------------------------------------- overlays
function chapterOverlay(T) {
  for (const ch of TL.chapters) {
    const lt = T - ch.start - (ch.id === 1 ? 0.6 : 0.15);
    if (lt < 0 || lt > 3.6) continue;
    const a = envelope(lt, 0, 3.6, 0.35, 0.7);
    const g = G;
    g.save();
    g.globalAlpha = a;
    // soft dark band on the right
    const gr = g.createLinearGradient(W - 420, 0, W, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr;
    g.fillRect(W - 420, 0, 420, H);
    text(g, `第${CH_NUM[ch.id]}章`, W - 150, 150, { size: 30, color: PAL.goldLight, family: FONTS.serif, weight: 600, align: 'center', spacing: 6 });
    g.fillStyle = rgba(PAL.gold, 0.7);
    g.fillRect(W - 175, 172, 50, 2);
    brushWrite(g, ch.title, W - 220, 205, 132, clamp((lt - 0.1) / 1.7), { dir: 'v', color: '#efe3c4', gap: 1.0, bleed: 0.25 });
    seal(g, CH_NUM[ch.id] , W - 112, 205 + 132 * 4 - 40, 48, clamp((lt - 1.6) / 0.6), { family: FONTS.serif });
    g.restore();
  }
}

function hud(T, idx) {
  const sc = TL.scenes[idx];
  const def = SCENES[sc.id] || {};
  const lt = T - sc.start;
  const ch = TL.chapters.find((c) => c.id === sc.chapter);
  // small chapter indicator (top-left), hidden on title/credits & during intertitle
  if (!def.noHud) {
    const since = T - ch.start;
    const a = smoothstep(3.6, 4.4, since) * 0.62 * Math.min(smoothstep(0, 0.6, lt + 0.6), 1);
    if (a > 0.01) {
      G.save();
      G.globalAlpha = a;
      G.fillStyle = PAL.red;
      G.fillRect(64, 54, 4, 30);
      text(G, `第${CH_NUM[ch.id]}章 · ${ch.title}`, 80, 79, { size: 24, color: PAL.goldLight, family: FONTS.serif, weight: 600, spacing: 3, shadow: { color: 'rgba(0,0,0,0.8)', blur: 6 } });
      G.restore();
    }
  }
  // reconstruction disclosure tag
  if (def.tag) {
    const a = envelope(lt, 0.3, sc.dur - 0.2, 0.6, 0.4) * 0.75;
    if (a > 0.01) {
      G.save();
      G.globalAlpha = a;
      const w = 18 + 22 * [...def.tag].length * 0.95;
      G.fillStyle = 'rgba(0,0,0,0.35)';
      G.fillRect(W - 64 - w, 50, w, 38);
      G.strokeStyle = rgba(PAL.gold, 0.6);
      G.lineWidth = 1;
      G.strokeRect(W - 64 - w + 0.5, 50.5, w - 1, 37);
      text(G, def.tag, W - 64 - w / 2, 77, { size: 21, color: PAL.goldLight, family: FONTS.serif, align: 'center', spacing: 1 });
      G.restore();
    }
  }
}

function post(f, idx) {
  const def = SCENES[TL.scenes[idx].id] || {};
  vignette(G, def.vignette ?? 0.45);
  const tiles = grainTiles();
  G.save();
  G.globalCompositeOperation = 'overlay';
  G.globalAlpha = def.grain ?? 0.07;
  G.drawImage(tiles[Math.floor(f / 3) % 4], 0, 0, W, H);
  G.restore();
}

export function renderFrame(f) {
  const T = f / FPS;
  const idx = sceneAt(T);
  composite(T);
  G.save();
  hud(T, idx);
  chapterOverlay(T);
  post(f, idx);
  G.restore();
  // global fade-in / fade-out of the film
  const fa = Math.min(smoothstep(0, 0.8, T), 1 - smoothstep(TL.total - 1.5, TL.total, T));
  if (fa < 1) {
    G.save();
    G.globalAlpha = 1 - fa;
    G.fillStyle = '#000';
    G.fillRect(0, 0, W, H);
    G.restore();
  }
}

window.renderFrame = renderFrame;
window.renderFrameJPEG = (f, q = 0.93) => {
  renderFrame(f);
  return main.toDataURL('image/jpeg', q);
};
window.TL = TL;
window.debug3d = async (name, t) => {
  const m = await import('./three/scenes3d.js');
  const c = m[name].render(t);
  G.drawImage(c, 0, 0);
  return main.toDataURL('image/jpeg', 0.9);
};

async function boot() {
  const fams = ['MaShan', 'ZhiMang', 'SerifSC', 'SansSC', 'KaiTC', 'SerifTC', 'CaoShu'];
  await Promise.all(fams.flatMap((f) => [document.fonts.load(`400 40px "${f}"`, '戊戌变法1898'), document.fonts.load(`700 40px "${f}"`, '戊戌变法1898')]));
  await loadHanzi();
  await loadMaps();
  for (const id in SCENES) if (SCENES[id].init) await SCENES[id].init();
  window.__ready = true;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) renderFrame(Math.round(parseFloat(q.get('t')) * FPS));
}
boot().catch((e) => {
  window.__error = String(e && e.stack ? e.stack : e);
  console.error(e);
});
