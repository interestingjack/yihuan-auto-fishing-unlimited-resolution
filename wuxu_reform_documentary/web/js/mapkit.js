// Perspective map renderer: Mercator plane viewed through a 3D camera (tilt/heading/
// distance), drawn with Canvas2D so linework stays crisp at any zoom.
// Map data: Natural Earth 1:50m (world-atlas) + modern provincial outlines (schematic).
import { W, H, PAL, rgba, clamp, lerp, text, FONTS, ease, measure } from './engine.js';

export let WORLD = null;
export let CHINA = null;
export let LAND = null;
export async function loadMaps() {
  WORLD = await (await fetch('assets/data/world.json')).json();
  CHINA = await (await fetch('assets/data/china.json')).json();
  LAND = await (await fetch('assets/data/land.json')).json();
  // split land into one feature per polygon so off-screen parts are culled
  LAND.features = LAND.features.flatMap((f) => f.geometry.coordinates.map((poly) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [poly] } })));
  for (const f of [...WORLD.features, ...CHINA.features, ...LAND.features]) {
    // precompute mercator coords + bbox
    f.merc = f.geometry.coordinates.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => [lon, mercY(lat)])));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const poly of f.merc) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    f.bbox = [x0, y0, x1, y1];
  }
}
export const mercY = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

export function country(name) {
  return WORLD.features.find((f) => f.properties.name === name);
}
export function province(name) {
  return CHINA.features.find((f) => f.properties.name === name);
}
export const QING = () => ['China', 'Taiwan', 'Mongolia', 'Hong Kong', 'Macao'].map(country).filter(Boolean);

export const PLACES = {
  北京: [116.4, 39.9], 天津: [117.2, 39.13], 上海: [121.47, 31.23], 长沙: [112.97, 28.2],
  广州: [113.26, 23.13], 香港: [114.17, 22.3], 胶州湾: [120.3, 36.1], 旅顺: [121.25, 38.81],
  大连: [121.62, 38.92], 威海卫: [122.12, 37.5], 广州湾: [110.4, 21.2], 九龙: [114.17, 22.42],
  台湾: [120.96, 23.7], 澎湖: [119.58, 23.57], 马关: [130.94, 33.96], 东京: [139.69, 35.69],
  汉城: [126.98, 37.57], 平壤: [125.75, 39.03], 鸭绿江: [124.35, 40.1], 黄海: [123.4, 38.9],
  花园口: [122.6, 39.55], 广岛: [132.46, 34.4], 荣成: [122.48, 37.16], 海城: [122.75, 40.85],
  南京: [118.8, 32.06], 武汉: [114.3, 30.6], 杭州: [120.15, 30.27], 苏州: [120.6, 31.3],
  重庆: [106.55, 29.56], 沙市: [112.25, 30.3], 福州: [119.3, 26.08], 辽东: [122.6, 40.4],
  成都: [104.06, 30.66], 昆明: [102.7, 25.04], 西安: [108.94, 34.34], 济南: [117.0, 36.67],
  神户: [135.19, 34.69], 牙山: [126.9, 36.85], 南海: [113.15, 23.03], 浏阳: [113.63, 28.15],
};

export const RIVERS = {
  长江: [[121.8, 31.4], [120.3, 32.0], [118.8, 32.1], [117.6, 31.0], [116.4, 29.8], [115.0, 30.0], [114.3, 30.6], [113.0, 29.6], [112.2, 30.3], [111.3, 30.7], [110.0, 31.0], [108.5, 30.6], [107.0, 29.9], [106.5, 29.6], [105.4, 28.8], [104.6, 28.8], [103.0, 28.0], [101.8, 26.7], [100.2, 27.0], [99.5, 28.5], [98.5, 31.5], [97.0, 33.0], [94.0, 34.0], [91.5, 33.6]],
  黄河: [[119.2, 37.7], [117.0, 36.7], [115.4, 35.8], [114.0, 34.9], [112.5, 34.8], [110.4, 34.6], [110.5, 36.0], [110.6, 38.0], [111.0, 39.5], [110.0, 40.6], [108.0, 40.8], [106.6, 40.3], [106.3, 39.0], [105.4, 37.5], [104.2, 36.5], [103.6, 35.9], [102.0, 35.4], [100.5, 35.0], [98.5, 34.8], [96.0, 34.9]],
};

export class MapCam {
  constructor(o = {}) {
    this.set({ lon: 115, lat: 35, dist: 40, tilt: 0, heading: 0, fov: 40, ox: 0, oy: 0, ...o });
  }
  set(o) {
    Object.assign(this, o);
    const X0 = this.lon, Y0 = mercY(this.lat);
    const t = (this.tilt * Math.PI) / 180, h = (this.heading * Math.PI) / 180;
    this.C = [X0 - this.dist * Math.sin(t) * Math.sin(h), Y0 - this.dist * Math.sin(t) * Math.cos(h), this.dist * Math.cos(t)];
    const f = [X0 - this.C[0], Y0 - this.C[1], -this.C[2]];
    const fl = Math.hypot(...f);
    this.f = f.map((v) => v / fl);
    this.r = [Math.cos(h), -Math.sin(h), 0];
    const r = this.r, ff = this.f;
    this.u = [r[1] * ff[2] - r[2] * ff[1], r[2] * ff[0] - r[0] * ff[2], r[0] * ff[1] - r[1] * ff[0]];
    this.F = H / 2 / Math.tan(((this.fov * Math.PI) / 180) / 2);
    return this;
  }
  // project mercator plane coords (x=lon, y=mercY) with altitude z (degree units)
  pm(x, y, z = 0) {
    const vx = x - this.C[0], vy = y - this.C[1], vz = z - this.C[2];
    const zc = vx * this.f[0] + vy * this.f[1] + vz * this.f[2];
    const xc = vx * this.r[0] + vy * this.r[1] + vz * this.r[2];
    const yc = vx * this.u[0] + vy * this.u[1] + vz * this.u[2];
    if (zc < 0.01) return [NaN, NaN, zc];
    return [W / 2 + this.ox + (this.F * xc) / zc, H / 2 + this.oy - (this.F * yc) / zc, zc];
  }
  p(lon, lat, alt = 0) {
    return this.pm(lon, mercY(lat), alt);
  }
  // screen-space scale (px per degree) at a location — for sizing things on the map
  scaleAt(lon, lat) {
    const a = this.p(lon, lat), b = this.p(lon + 1, lat);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  // interpolate between two camera states
  static lerp(a, b, t) {
    const o = {};
    for (const k of ['lon', 'lat', 'dist', 'tilt', 'heading', 'fov', 'ox', 'oy']) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
    // distance interpolates geometrically for a natural dolly
    o.dist = Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t));
    return o;
  }
}

// Interpolate along a list of keyframes [{t, ...cam}] with easing
export function camPath(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const k = (t - keys[i - 1].t) / (keys[i].t - keys[i - 1].t);
      return MapCam.lerp(keys[i - 1], keys[i], ease.inOutSine(k));
    }
  }
  return keys[keys.length - 1];
}

function visible(cam, f) {
  const [x0, y0, x1, y1] = f.bbox;
  const pts = [cam.pm(x0, y0), cam.pm(x1, y0), cam.pm(x0, y1), cam.pm(x1, y1), cam.pm((x0 + x1) / 2, (y0 + y1) / 2)];
  if (pts.some((p) => isNaN(p[0]))) return true;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return !(Math.max(...xs) < -200 || Math.min(...xs) > W + 200 || Math.max(...ys) < -200 || Math.min(...ys) > H + 200);
}

// Build a Path2D for a list of features
export function featPath(cam, feats, minPx = 0.8) {
  const path = new Path2D();
  for (const f of feats) {
    if (!f || !visible(cam, f)) continue;
    for (const poly of f.merc) {
      for (const ring of poly) {
        let lx = -1e9, ly = -1e9, started = false;
        for (let i = 0; i < ring.length; i++) {
          const [sx, sy] = cam.pm(ring[i][0], ring[i][1]);
          if (isNaN(sx)) continue;
          if (started && Math.abs(sx - lx) < minPx && Math.abs(sy - ly) < minPx && i < ring.length - 1) continue;
          if (!started) { path.moveTo(sx, sy); started = true; } else path.lineTo(sx, sy);
          lx = sx; ly = sy;
        }
        if (started) path.closePath();
      }
    }
  }
  return path;
}

export function linePath(cam, pts) {
  return pts.map(([lon, lat]) => cam.p(lon, lat)).filter((p) => !isNaN(p[0]));
}

export function graticule(g, cam, { step = 5, color = PAL.gold, alpha = 0.12, lw = 1, lon0 = 60, lon1 = 160, lat0 = 0, lat1 = 60 } = {}) {
  g.save();
  g.strokeStyle = rgba(color, alpha);
  g.lineWidth = lw;
  g.beginPath();
  for (let lon = lon0; lon <= lon1; lon += step) {
    let first = true;
    for (let lat = lat0; lat <= lat1; lat += 1) {
      const [x, y] = cam.p(lon, lat);
      if (isNaN(x)) continue;
      first ? g.moveTo(x, y) : g.lineTo(x, y);
      first = false;
    }
  }
  for (let lat = lat0; lat <= lat1; lat += step) {
    let first = true;
    for (let lon = lon0; lon <= lon1; lon += 1) {
      const [x, y] = cam.p(lon, lat);
      if (isNaN(x)) continue;
      first ? g.moveTo(x, y) : g.lineTo(x, y);
      first = false;
    }
  }
  g.stroke();
  g.restore();
}

// Old-map coastline hachure: concentric strokes on the sea side of land
export function coastRipples(g, path, { color = PAL.ink, alpha = 0.12, widths = [5, 12, 22, 34] } = {}) {
  g.save();
  g.lineJoin = 'round';
  for (let i = widths.length - 1; i >= 0; i--) {
    g.strokeStyle = rgba(color, alpha * (1 - i / widths.length) + 0.02);
    g.lineWidth = widths[i];
    g.stroke(path);
    g.strokeStyle = 'rgba(0,0,0,0)';
  }
  g.restore();
}

// Fill with an outer-border trick: thick stroke first, then fill on top (hides internal borders)
export function territory(g, path, { fill, border, borderW = 6, alpha = 1 }) {
  g.save();
  g.globalAlpha *= alpha;
  g.lineJoin = 'round';
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = borderW;
    g.stroke(path);
  }
  g.fillStyle = fill;
  g.fill(path, 'nonzero');
  g.restore();
}

// Pulsing marker
export function marker(g, x, y, p, { color = PAL.red, r = 9, pulse = true, t = 0 } = {}) {
  if (p <= 0 || isNaN(x)) return;
  g.save();
  g.globalAlpha *= clamp(p * 3);
  if (pulse) {
    const ph = (t * 0.9) % 1;
    g.strokeStyle = rgba(color, (1 - ph) * 0.8);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r + ph * r * 3, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r * ease.outBack(clamp(p * 2)), 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,240,210,0.9)';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

// Callout label with leader line: anchor (x,y) -> box at (x+dx, y+dy)
export function callout(g, x, y, dx, dy, title, sub, p, o = {}) {
  if (p <= 0 || isNaN(x)) return;
  const dark = o.dark ?? true;
  const col = o.color || (dark ? PAL.goldLight : PAL.ink);
  const e = ease.out(clamp(p * 1.4));
  const tx = x + dx, ty = y + dy;
  g.save();
  g.globalAlpha *= clamp(p * 2);
  g.strokeStyle = rgba(o.line || col, 0.8);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(lerp(x, tx, e), lerp(y, ty, e));
  g.stroke();
  const ts = o.size || 30;
  const align = dx < 0 ? 'right' : 'left';
  const ox = dx < 0 ? -10 : 10;
  if (o.box !== false) {
    const tw = Math.max(measure(g, title, { size: ts, family: o.family || FONTS.serif, weight: 700 }), sub ? measure(g, sub, { size: ts * 0.62, family: FONTS.serif }) : 0);
    const bx = align === 'right' ? tx + ox - tw - 16 : tx + ox - 12;
    const bh = sub ? ts * 1.9 : ts * 1.25;
    g.fillStyle = dark ? 'rgba(12,10,8,0.62)' : 'rgba(245,236,215,0.78)';
    g.fillRect(bx, ty - ts * 0.98, tw + 28, bh);
    g.fillStyle = o.accent || PAL.red;
    g.fillRect(align === 'right' ? bx + tw + 24 : bx, ty - ts * 0.98, 4, bh);
  }
  text(g, title, tx + ox, ty, { size: ts, color: col, weight: 700, align, alpha: e, family: o.family || FONTS.serif });
  if (sub) text(g, sub, tx + ox, ty + ts * 0.78, { size: ts * 0.62, color: rgba(col, 0.85), align, alpha: e, family: FONTS.serif });
  g.restore();
}

// Place-name label on the map (no box)
export function placeLabel(g, x, y, str, p, o = {}) {
  if (p <= 0 || isNaN(x)) return;
  text(g, str, x + (o.dx ?? 14), y + (o.dy ?? 8), {
    size: o.size || 26, color: o.color || PAL.paper, family: o.family || FONTS.serif, weight: o.weight || 600,
    alpha: clamp(p * 2), align: o.align || 'left', spacing: o.spacing || 2,
    shadow: o.shadow ?? { color: 'rgba(0,0,0,0.7)', blur: 6 },
  });
}

// Dashed route with arrowhead (fleet movements, exile journeys). pts in screen space.
export function dashedRoute(g, pts, p, o = {}) {
  if (p <= 0 || pts.length < 2) return;
  const segs = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
  const target = L * clamp(p);
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.strokeStyle = o.color || PAL.red;
  g.lineWidth = o.width || 4;
  g.lineCap = 'round';
  g.setLineDash(o.dash || [14, 10]);
  g.lineDashOffset = -(o.t || 0) * 30;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  let acc = 0, hx = pts[0][0], hy = pts[0][1], ang = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = segs[i - 1];
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    if (acc + d >= target) {
      const k = (target - acc) / d;
      hx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k;
      hy = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
      ang = a;
      g.lineTo(hx, hy);
      break;
    }
    acc += d;
    hx = pts[i][0]; hy = pts[i][1]; ang = a;
    g.lineTo(hx, hy);
  }
  g.stroke();
  g.setLineDash([]);
  const hs = (o.width || 4) * 3.4;
  g.translate(hx, hy);
  g.rotate(ang);
  g.fillStyle = o.color || PAL.red;
  g.beginPath();
  g.moveTo(hs, 0);
  g.lineTo(-hs * 0.6, hs * 0.6);
  g.lineTo(-hs * 0.3, 0);
  g.lineTo(-hs * 0.6, -hs * 0.6);
  g.closePath();
  g.fill();
  g.restore();
}

// smooth a geo polyline with Catmull-Rom (returns lon/lat points)
export function smoothGeo(pts, n = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
