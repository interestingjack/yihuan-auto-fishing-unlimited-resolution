// Prepare compact data assets for the renderer:
//   web/assets/data/world.json   - countries around East Asia (GeoJSON, Natural Earth 1:50m via world-atlas)
//   web/assets/data/china.json   - Chinese provincial outlines (decoded from echarts 4 map, modern outlines, schematic use only)
//   web/assets/data/hanzi.json   - stroke paths + medians (Make Me a Hanzi via hanzi-writer-data) for brush-writing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'web', 'assets', 'data');
fs.mkdirSync(OUT, { recursive: true });
const nm = (p) => path.join(ROOT, 'node_modules', p);

// ---------- world countries (East Asia window) ----------
const topo = JSON.parse(fs.readFileSync(nm('world-atlas/countries-50m.json'), 'utf8'));
const countries = topojson.feature(topo, topo.objects.countries);
const inWindow = (ring) => ring.some(([x, y]) => x > 55 && x < 165 && y > -5 && y < 65);
const round = (v) => Math.round(v * 1000) / 1000;
const feats = [];
for (const f of countries.features) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const keep = polys.filter((p) => inWindow(p[0]));
  if (!keep.length) continue;
  feats.push({
    type: 'Feature',
    properties: { name: f.properties.name },
    geometry: { type: 'MultiPolygon', coordinates: keep.map((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)]))) },
  });
}
fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify({ type: 'FeatureCollection', features: feats }));
console.log('world.json', feats.length, 'features:', feats.map((f) => f.properties.name).join(', '));

// ---------- land outline (for coastlines) ----------
const ltopo = JSON.parse(fs.readFileSync(nm('world-atlas/land-50m.json'), 'utf8'));
const land = topojson.feature(ltopo, ltopo.objects.land);
const lfeats = [];
for (const f of land.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const keep = polys.filter((p) => inWindow(p[0]));
  if (keep.length) lfeats.push({ type: 'Feature', properties: { name: 'land' }, geometry: { type: 'MultiPolygon', coordinates: keep.map((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)]))) } });
}
fs.writeFileSync(path.join(OUT, 'land.json'), JSON.stringify({ type: 'FeatureCollection', features: lfeats }));
console.log('land.json', lfeats.length);

// ---------- China provinces (echarts 4 encoded geojson) ----------
function decodePolygon(coordinate, encodeOffsets, encodeScale) {
  const result = [];
  let prevX = encodeOffsets[0];
  let prevY = encodeOffsets[1];
  for (let i = 0; i < coordinate.length; i += 2) {
    let x = coordinate.charCodeAt(i) - 64;
    let y = coordinate.charCodeAt(i + 1) - 64;
    x = (x >> 1) ^ -(x & 1);
    y = (y >> 1) ^ -(y & 1);
    x += prevX;
    y += prevY;
    prevX = x;
    prevY = y;
    result.push([round(x / encodeScale), round(y / encodeScale)]);
  }
  return result;
}
const cj = JSON.parse(fs.readFileSync(nm('echarts/map/json/china.json'), 'utf8'));
const scale = cj.UTF8Scale || 1024;
const prov = [];
for (const f of cj.features) {
  const g = f.geometry;
  let coords;
  if (g.type === 'Polygon') coords = [g.coordinates.map((r, i) => decodePolygon(r, g.encodeOffsets[i], scale))];
  else coords = g.coordinates.map((poly, i) => poly.map((r, j) => decodePolygon(r, g.encodeOffsets[i][j], scale)));
  prov.push({ type: 'Feature', properties: { name: f.properties.name, cp: f.properties.cp }, geometry: { type: 'MultiPolygon', coordinates: coords } });
}
fs.writeFileSync(path.join(OUT, 'china.json'), JSON.stringify({ type: 'FeatureCollection', features: prov }));
console.log('china.json', prov.length, 'provinces');

// ---------- hanzi stroke data subset ----------
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script', 'script.json'), 'utf8'));
let text = script.scenes.flatMap((s) => s.lines).join('');
// strings written with the brush on screen (titles, names, poem, seals, chapter titles)
const extra = fs.readFileSync(path.join(ROOT, 'web', 'js', 'brush_strings.txt'), 'utf8');
text += extra + script.chapters.map((c) => c.title + c.name).join('');
const chars = [...new Set([...text].filter((c) => /[一-鿿]/.test(c)))];
const hanzi = {};
const missing = [];
for (const c of chars) {
  const p = nm(`hanzi-writer-data/${c}.json`);
  if (fs.existsSync(p)) {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    hanzi[c] = { s: d.strokes, m: d.medians };
  } else missing.push(c);
}
fs.writeFileSync(path.join(OUT, 'hanzi.json'), JSON.stringify(hanzi));
console.log('hanzi.json', Object.keys(hanzi).length, 'chars; missing:', missing.join(''));
