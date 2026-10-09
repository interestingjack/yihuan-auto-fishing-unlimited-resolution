// Procedural Chinese timber architecture: curved hip (庑殿) / hip-gable (歇山) /
// gable (硬山) roofs with upturned eaves, halls with columns, brackets, lattice doors,
// marble terraces with balustrades, palace walls, city gate towers, courtyard houses.
// Artistic reconstruction only - proportions are simplified, not survey-accurate.
import { THREE, tileTex, redWallTex, stoneTex, latticeTex, beamTex, bracketTex, woodTex, brickTex, plaqueTex, pavingTex } from './common.js';

const matCache = new Map();
export function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
export const M = {
  tile: (kind) => mat('tile' + kind, () => new THREE.MeshStandardMaterial({ map: tileTex(kind), roughness: kind === 'gray' || kind === 'dark' ? 0.85 : 0.45, metalness: kind === 'yellow' ? 0.15 : 0.05 })),
  ridge: (kind) => mat('ridge' + kind, () => new THREE.MeshStandardMaterial({ color: { yellow: '#c58e22', gray: '#4a4c4b', green: '#2f5f45', dark: '#2a2b2c' }[kind], roughness: 0.5, metalness: 0.1 })),
  soffit: () => mat('soffit', () => new THREE.MeshStandardMaterial({ color: '#2a3b3a', roughness: 0.9 })),
  fascia: () => mat('fascia', () => new THREE.MeshStandardMaterial({ color: '#6a1c14', roughness: 0.8 })),
  column: () => mat('column', () => new THREE.MeshStandardMaterial({ color: '#8f2218', roughness: 0.6 })),
  wall: () => mat('wall', () => new THREE.MeshStandardMaterial({ map: redWallTex(), roughness: 0.92 })),
  marble: () => mat('marble', () => new THREE.MeshStandardMaterial({ map: stoneTex('#d7d4cb', 'marble'), roughness: 0.75 })),
  stone: () => mat('stone', () => new THREE.MeshStandardMaterial({ map: stoneTex('#a29d92', 'stone'), roughness: 0.9 })),
  lattice: () => mat('lattice', () => new THREE.MeshStandardMaterial({ map: latticeTex(), roughness: 0.7 })),
  beam: () => mat('beam', () => new THREE.MeshStandardMaterial({ map: beamTex(), roughness: 0.7 })),
  bracket: () => mat('bracket', () => new THREE.MeshStandardMaterial({ map: bracketTex(), roughness: 0.75 })),
  wood: () => mat('wood', () => new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.85 })),
  brick: () => mat('brick', () => {
    const m = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.95 });
    return m;
  }),
  grayWall: () => mat('graywall', () => new THREE.MeshStandardMaterial({ map: brickTex('#77736c'), roughness: 0.95 })),
  paving: () => mat('paving', () => new THREE.MeshStandardMaterial({ map: pavingTex(), roughness: 0.95 })),
  dark: () => mat('dark', () => new THREE.MeshStandardMaterial({ color: '#141010', roughness: 1 })),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: '#c99a3a', roughness: 0.35, metalness: 0.6 })),
};

function setUVRepeat(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}
export function box(w, h, d, material, x = 0, y = 0, z = 0, uvScale = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uvScale) {
    // world-scaled UVs per face group
    const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
      const px = pos.getX(i) + x, py = pos.getY(i) + y, pz = pos.getZ(i) + z;
      if (ny > 0.5) uv.setXY(i, px / uvScale, pz / uvScale);
      else if (nx > 0.5) uv.setXY(i, pz / uvScale, py / uvScale);
      else uv.setXY(i, px / uvScale, py / uvScale);
    }
  }
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ roofs
// Parametric roof surface.  Footprint half-sizes hw (x) >= hd (z). Height h.
// type: 'hip' (庑殿), 'xieshan' (歇山, gable above s1), 'gable' (硬山/悬山)
// sTop < 1 builds only the lower skirt (for the lower eave of double roofs).
export function roof(o) {
  const { hw, hd, h } = o;
  const type = o.type || 'hip';
  const s1 = o.s1 ?? 0.5;
  const sTop = o.sTop ?? 1;
  const L = o.lift ?? Math.min(hd * 0.18, 1.6); // corner upturn height
  const E = o.ext ?? L * 0.9;                   // corner outward extension
  const P = o.pow ?? 5;
  const kind = o.tile || 'yellow';
  const tileScale = o.tileScale ?? 2.2;
  const segA = o.segA || 28, segS = o.segS || 14;
  const th = o.thick ?? Math.max(0.25, hd * 0.035);
  const prof = (s) => h * (0.28 * s + 0.72 * s * s);
  const capS = type === 'hip' ? 1 : type === 'xieshan' ? s1 : 0;
  const half = (s) => hw - Math.min(s, capS) * hd;
  const group = new THREE.Group();

  // generic face builder: f(a,s) -> [x,y,z]; u along eave, v along slope
  function face(f, sMax, aLen) {
    const geo = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    const nA = segA, nS = Math.max(2, Math.round(segS * sMax));
    const vAcc = new Float32Array(nA + 1);
    let prevRow = null;
    for (let j = 0; j <= nS; j++) {
      const s = (j / nS) * sMax;
      const row = [];
      for (let i = 0; i <= nA; i++) {
        const a = -1 + (2 * i) / nA;
        const p = f(a, s);
        row.push(p);
        if (prevRow) vAcc[i] += Math.hypot(p[0] - prevRow[i][0], p[1] - prevRow[i][1], p[2] - prevRow[i][2]);
        pos.push(...p);
        uv.push((a * aLen(s)) / tileScale, vAcc[i] / tileScale);
      }
      prevRow = row;
    }
    for (let j = 0; j < nS; j++) for (let i = 0; i < nA; i++) {
      const a = j * (nA + 1) + i, b = a + 1, c = a + nA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  const lift = (a, s) => L * Math.pow(Math.abs(a), P) * (1 - s) * (1 - s);
  const ext = (a, s) => E * Math.pow(Math.abs(a), P) * (1 - s) * (1 - s);
  const front = (sgn) => (a, s) => {
    const e = ext(a, s);
    return [a * half(s) + Math.sign(a) * e, prof(s) + lift(a, s), sgn * (hd * (1 - s) + e)];
  };
  const side = (sgn) => (b, s) => {
    const e = ext(b, s);
    return [sgn * (hw - s * hd + e), prof(s) + lift(b, s), b * hd * (1 - s) + Math.sign(b) * e];
  };
  const tileMat = M.tile(kind);
  const faces = [];
  const fFront = front(1), fBack = front(-1);
  faces.push(face(fFront, sTop, half));
  faces.push(face(fBack, sTop, half));
  const sSide = type === 'hip' ? sTop : type === 'xieshan' ? Math.min(s1, sTop) : 0;
  if (sSide > 0) {
    faces.push(face(side(1), sSide, (s) => hd * (1 - s)));
    faces.push(face(side(-1), sSide, (s) => hd * (1 - s)));
  }
  for (const geo of faces) {
    // fix winding so normals point up/outward
    geo.computeVertexNormals();
    const n = geo.attributes.normal;
    if (n.getY(Math.floor(n.count / 2)) < 0) {
      const ix = geo.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, tileMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    // underside (soffit) slightly below, back-facing
    const under = new THREE.Mesh(geo, M.soffit());
    under.position.y = -th;
    under.material.side = THREE.BackSide;
    group.add(under);
  }
  // eave fascia boards: strip under eave edge s=0 for front/back/sides
  const fasciaStrip = (fn, n = 40) => {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const a = -1 + (2 * i) / n;
      const p = fn(a, 0);
      pos.push(p[0], p[1], p[2], p[0], p[1] - th * 1.6, p[2]);
    }
    for (let i = 0; i < n; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.fascia());
    m.material.side = THREE.DoubleSide;
    return m;
  };
  group.add(fasciaStrip(fFront), fasciaStrip(fBack));
  if (sSide > 0) group.add(fasciaStrip(side(1)), fasciaStrip(side(-1)));

  const rMat = M.ridge(kind);
  const tube = (pts, r) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), rMat);
    m.castShadow = true;
    return m;
  };
  const rr = o.ridgeR ?? Math.max(0.16, hd * 0.03);
  if (sTop >= 1) {
    // main ridge
    const rl = type === 'hip' ? hw - hd : type === 'xieshan' ? hw - s1 * hd : hw;
    const ridge = box(rl * 2 + rr * 2, rr * 4, rr * 2.2, rMat, 0, h + rr * 1.4, 0);
    group.add(ridge);
    // ridge-end ornaments (正吻), simplified
    for (const sx of (o.ornaments === false ? [] : [-1, 1])) {
      const orn = new THREE.Group();
      orn.add(box(rr * 2.4, rr * 9, rr * 2.4, rMat, 0, rr * 4.5, 0));
      orn.add(box(rr * 4, rr * 2.2, rr * 2.4, rMat, -sx * rr * 1.2, rr * 8.6, 0));
      orn.position.set(sx * rl, h, 0);
      group.add(orn);
    }
  }
  // hip ridges (along shared edges)
  const sR = type === 'hip' ? sTop : type === 'xieshan' ? Math.min(s1, sTop) : 0;
  if (sR > 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const s = (k / 10) * sR;
        const p = (sz > 0 ? fFront : fBack)(sx, s);
        pts.push([p[0], p[1] + rr * 0.8, p[2]]);
      }
      group.add(tube(pts, rr));
    }
  }
  // gable walls (xieshan / gable) + vertical ridges
  if ((type === 'xieshan' || type === 'gable') && sTop >= 1) {
    const sStart = type === 'xieshan' ? s1 : 0;
    for (const sx of [-1, 1]) {
      const pos = [], idx = [];
      const n = 12;
      for (let k = 0; k <= n; k++) {
        const s = sStart + ((1 - sStart) * k) / n;
        const pf = fFront(sx, s), pb = fBack(sx, s);
        const inset = type === 'xieshan' ? 0.35 : 0.0;
        pos.push(pf[0] - sx * inset, pf[1] - 0.05, pf[2], pb[0] - sx * inset, pb[1] - 0.05, pb[2]);
      }
      // bottom edge to close the triangle (horizontal at sStart)
      for (let k = 0; k < n; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      group.add(gableTriangle(fFront, fBack, sx, sStart, type === 'xieshan' ? 0.35 : 0, type === 'xieshan' ? M.wall() : M.grayWall()));
      for (const sz of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const s = sStart + ((1 - sStart) * k) / 8;
          const p = (sz > 0 ? fFront : fBack)(sx, s);
          pts.push([p[0], p[1] + rr * 0.8, p[2]]);
        }
        group.add(tube(pts, rr * 0.9));
      }
    }
  }
  return group;
}

function gableTriangle(fFront, fBack, sx, sStart, inset, material) {
  const pos = [];
  const n = 12;
  // polygon: front edge from sStart..1, then back edge 1..sStart
  const poly = [];
  for (let k = 0; k <= n; k++) { const s = sStart + ((1 - sStart) * k) / n; const p = fFront(sx, s); poly.push([p[1], p[2]]); }
  for (let k = n; k >= 0; k--) { const s = sStart + ((1 - sStart) * k) / n; const p = fBack(sx, s); poly.push([p[1], p[2]]); }
  const x = fFront(sx, 1)[0] - sx * inset;
  const shape = new THREE.Shape(poly.map(([y, z]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ShapeGeometry(shape);
  // shape is in (z, y) plane -> map to (x const, y, z)
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const zz = p.getX(i), yy = p.getY(i);
    pos.push(x, yy - 0.05, zz);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g2.setIndex(geo.index);
  g2.computeVertexNormals();
  const m = new THREE.Mesh(g2, material.clone());
  m.material.side = THREE.DoubleSide;
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------------ hall
// o: { w, d, colH, bays (x), baysD (z), roof: 'hip2'|'hip'|'xieshan'|'xieshan2'|'gable', tile, ov, roofH, plaque }
export function hall(o) {
  const g = new THREE.Group();
  const w = o.w, d = o.d, H = o.colH ?? 6;
  const bays = o.bays ?? 9, baysD = o.baysD ?? 5;
  const colR = o.colR ?? Math.min(w / bays, d / baysD) * 0.09;
  const colGeo = new THREE.CylinderGeometry(colR, colR * 1.05, H, 14);
  const colMat = M.column();
  const xs = [], zs = [];
  for (let i = 0; i <= bays; i++) xs.push(-w / 2 + (w * i) / bays);
  for (let j = 0; j <= baysD; j++) zs.push(-d / 2 + (d * j) / baysD);
  const cols = [];
  for (const x of xs) { cols.push([x, d / 2]); cols.push([x, -d / 2]); }
  for (const z of zs.slice(1, -1)) { cols.push([-w / 2, z]); cols.push([w / 2, z]); }
  const inst = new THREE.InstancedMesh(colGeo, colMat, cols.length);
  const m4 = new THREE.Matrix4();
  cols.forEach(([x, z], i) => { m4.makeTranslation(x, H / 2, z); inst.setMatrixAt(i, m4); });
  inst.castShadow = true;
  inst.receiveShadow = true;
  g.add(inst);
  // walls set back one step (porch) on the front; lattice doors in front bays
  const inset = o.porch ?? (d / baysD) * 0.6;
  const wallMat = M.wall();
  g.add(box(w - colR * 2, H * 0.98, 0.4, wallMat, 0, H * 0.49, -d / 2 + 0.25, 3));
  g.add(box(0.4, H * 0.98, d - colR * 2, wallMat, -w / 2 + 0.25, H * 0.49, 0, 3));
  g.add(box(0.4, H * 0.98, d - colR * 2, wallMat, w / 2 - 0.25, H * 0.49, 0, 3));
  // front lattice panels
  const latMat = M.lattice();
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.92, H * 0.86), latMat);
    setUVRepeat(panel.geometry, 1, 1);
    panel.position.set(x, H * 0.43, d / 2 - inset);
    panel.receiveShadow = true;
    g.add(panel);
  }
  // dark interior behind lattice
  g.add(box(w - 0.5, H, 0.2, M.dark(), 0, H / 2, d / 2 - inset - 0.15));
  // beam + bracket bands
  const beamH = H * 0.1;
  const ring = (ww, dd, hh, y, material, t = 0.5) => {
    const r = new THREE.Group();
    const bx1 = box(ww + t, hh, t, material, 0, y, dd / 2);
    const bx2 = box(ww + t, hh, t, material, 0, y, -dd / 2);
    const bz1 = box(t, hh, dd + t, material, ww / 2, y, 0);
    const bz2 = box(t, hh, dd + t, material, -ww / 2, y, 0);
    [bx1, bx2].forEach((b) => setUVRepeat(b.geometry, ww / 6, 1));
    [bz1, bz2].forEach((b) => setUVRepeat(b.geometry, dd / 6, 1));
    r.add(bx1, bx2, bz1, bz2);
    return r;
  };
  g.add(ring(w, d, beamH, H + beamH / 2, M.beam(), colR * 2.2));
  const brH = o.bracketH ?? H * 0.22;
  const brRing = ring(w + colR * 2, d + colR * 2, brH, H + beamH + brH / 2, M.bracket(), colR * 3.5);
  g.add(brRing);
  const top = H + beamH + brH;
  // roof
  const ov = o.ov ?? Math.max(1.5, d * 0.16);
  const hw = w / 2 + ov, hd = d / 2 + ov;
  const kind = o.tile || 'yellow';
  const rh = o.roofH ?? hd * 0.62;
  if (o.roof === 'hip2' || o.roof === 'xieshan2') {
    // lower skirt
    const lowH = rh * 0.42;
    const sLow = 0.36;
    const lower = roof({ hw, hd, h: lowH / (0.28 * sLow + 0.72 * sLow * sLow) * 1.0, type: 'hip', sTop: sLow, tile: kind, lift: o.lift });
    lower.position.y = top - 0.2;
    g.add(lower);
    // upper storey band
    const uw = w * 0.86, ud = d * 0.78;
    const yb = top + lowH - 0.4;
    const ubH = H * 0.42;
    g.add(box(uw, ubH, ud, M.wall(), 0, yb + ubH / 2, 0, 3));
    g.add(ring(uw, ud, brH, yb + ubH + brH / 2, M.bracket(), colR * 3));
    const uov = ov * 0.95;
    const upper = roof({ hw: uw / 2 + uov, hd: ud / 2 + uov, h: rh, type: o.roof === 'hip2' ? 'hip' : 'xieshan', s1: 0.5, tile: kind, lift: o.lift });
    upper.position.y = yb + ubH + brH - 0.2;
    g.add(upper);
    g.userData.top = upper.position.y + rh;
  } else {
    const r = roof({ hw, hd, h: rh, type: o.roof || 'hip', s1: o.s1 ?? 0.5, tile: kind, lift: o.lift });
    r.position.y = top - 0.2;
    g.add(r);
    g.userData.top = top + rh;
  }
  if (o.plaque) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.plaqueW || 1.6, (o.plaqueW || 1.6) * ((128 * [...o.plaque].length + 64) / 256)), new THREE.MeshStandardMaterial({ map: plaqueTex(o.plaque, o.plaqueStyle || {}), roughness: 0.6 }));
    pl.position.set(0, top + (o.plaqueY ?? 0.2), d / 2 + colR * 3 + 0.25);
    g.add(pl);
  }
  return g;
}

// ------------------------------------------------------------------ terrace (须弥座 + balustrade)
export function terrace(o) {
  const g = new THREE.Group();
  const tiers = o.tiers ?? 3;
  let y = 0;
  let w = o.w, d = o.d;
  const th = o.h ?? 2;
  for (let i = 0; i < tiers; i++) {
    g.add(box(w, th * 0.7, d, M.marble(), 0, y + th * 0.35, 0, 2));
    g.add(box(w - 0.4, th * 0.3, d - 0.4, M.marble(), 0, y + th * 0.85, 0, 2));
    if (o.balustrade !== false) g.add(balustrade(w, d, y + th, o.stairW ?? 6));
    y += th;
    if (i < tiers - 1) { w -= o.step ?? 4; d -= o.step ?? 4; }
  }
  // stairs in front: steps + central imperial way (御路)
  const sw = o.stairW ?? 6;
  const totalH = th * tiers;
  const depth = totalH * 1.8;
  const steps = Math.round(totalH / 0.3);
  for (let k = 0; k < steps; k++) {
    const h = totalH * (1 - k / steps);
    for (const sx of [-1, 1]) {
      const st = box(sw * 0.35, h, depth / steps, M.marble(), sx * sw * 0.32, h / 2, o.d / 2 + (k + 0.5) * (depth / steps), 2);
      g.add(st);
    }
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.28, 0.3, Math.hypot(depth, totalH)), M.marble());
  ramp.position.set(0, totalH / 2, o.d / 2 + depth / 2);
  ramp.rotation.x = Math.atan2(totalH, depth);
  ramp.castShadow = ramp.receiveShadow = true;
  g.add(ramp);
  g.userData.top = y;
  return g;
}

export function balustrade(w, d, y, gap = 6) {
  const posts = [];
  const step = 1.4;
  const addLine = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(L / step));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (Math.abs(x) < gap / 2 + 0.2 && z > 0) continue;
      posts.push([x, z]);
    }
  };
  const hw = w / 2 - 0.25, hd = d / 2 - 0.25;
  addLine(-hw, hd, hw, hd);
  addLine(-hw, -hd, hw, -hd);
  addLine(-hw, -hd, -hw, hd);
  addLine(hw, -hd, hw, hd);
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.22, 1.1, 0.22);
  const inst = new THREE.InstancedMesh(geo, M.marble(), posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach(([x, z], i) => { m4.makeTranslation(x, y + 0.55, z); inst.setMatrixAt(i, m4); });
  inst.castShadow = true;
  g.add(inst);
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const b = box(L, 0.5, 0.12, M.marble(), (x0 + x1) / 2, y + 0.45, (z0 + z1) / 2);
    b.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(b);
  };
  rail(-hw, -hd, hw, -hd);
  rail(-hw, -hd, -hw, hd);
  rail(hw, -hd, hw, hd);
  rail(-hw, hd, -gap / 2 - 0.2, hd);
  rail(gap / 2 + 0.2, hd, hw, hd);
  return g;
}

// ------------------------------------------------------------------ walls
// palace wall with tiled coping, from (x0,z0) to (x1,z1)
export function palaceWall(x0, z0, x1, z1, h = 8, t = 1.6, tile = 'yellow') {
  const g = new THREE.Group();
  const L = Math.hypot(x1 - x0, z1 - z0);
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  const body = box(L, h, t, M.wall(), 0, h / 2, 0, 4);
  g.add(body);
  g.add(box(L + 0.2, 0.8, t + 0.3, M.stone(), 0, 0.4, 0, 2));
  const cap = roof({ hw: L / 2 + 0.3, hd: t / 2 + 0.7, h: 0.9, type: 'gable', tile, lift: 0.0, ext: 0, segA: Math.max(8, Math.round(L / 2)), segS: 4, thick: 0.15, ridgeR: 0.12, ornaments: false });
  cap.position.y = h;
  g.add(cap);
  g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.rotation.y = ang;
  return g;
}

// city wall section with gate opening (arched) and a gate tower on top
export function cityGate(o = {}) {
  const g = new THREE.Group();
  const L = o.len ?? 140, h = o.h ?? 13, t = o.t ?? 16;
  const archW = o.archW ?? 7, archH = o.archH ?? 9;
  // wall front shape with arch hole, extruded
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, 0);
  shape.lineTo(L / 2, 0);
  shape.lineTo(L / 2, h);
  shape.lineTo(-L / 2, h);
  shape.lineTo(-L / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-archW / 2, 0);
  hole.lineTo(-archW / 2, archH - archW / 2);
  hole.absarc(0, archH - archW / 2, archW / 2, Math.PI, 0, true);
  hole.lineTo(archW / 2, 0);
  hole.lineTo(-archW / 2, 0);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -t / 2);
  // world-scaled UV
  const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    if (ay > 0.5) uv.setXY(i, pos.getX(i) / 6, pos.getZ(i) / 6);
    else if (ax > 0.5) uv.setXY(i, pos.getZ(i) / 6, pos.getY(i) / 6);
    else uv.setXY(i, pos.getX(i) / 6, pos.getY(i) / 6);
  }
  const wall = new THREE.Mesh(geo, M.brick());
  wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  // dark tunnel interior
  g.add(box(archW * 0.98, archH - 0.2, t * 0.98, M.dark(), 0, (archH - 0.2) / 2, 0));
  // crenellations
  const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.2, 0.8), M.brick(), Math.floor(L / 2.4));
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < cren.count; i++) { m4.makeTranslation(-L / 2 + 1.2 + i * 2.4, h + 0.6, t / 2 - 0.4); cren.setMatrixAt(i, m4); }
  cren.castShadow = true;
  g.add(cren);
  // tower
  const tower = new THREE.Group();
  tower.add(box(o.towerBaseW ?? 34, 1.2, o.towerBaseD ?? 14, M.stone(), 0, 0.6, 0, 2));
  const hl = hall({ w: o.towerW ?? 30, d: o.towerD ?? 11, colH: 5.5, bays: 7, baysD: 3, roof: 'xieshan2', tile: o.tile || 'gray', roofH: 5.2, ov: 2.2 });
  hl.position.y = 1.2;
  tower.add(hl);
  tower.position.y = h;
  g.add(tower);
  return g;
}

// simple courtyard house with gable roof (gray tiles)
export function house(w = 10, d = 6, h = 3.2, rot = 0, kind = 'gray') {
  const g = new THREE.Group();
  g.add(box(w, h, d, M.grayWall(), 0, h / 2, 0, 3));
  // front: red lattice strip
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.7), M.lattice());
  p.position.set(0, h * 0.42, d / 2 + 0.02);
  g.add(p);
  const r = roof({ hw: w / 2 + 0.5, hd: d / 2 + 0.9, h: d * 0.38, type: 'gable', tile: kind, lift: 0.08, ext: 0.0, segA: 10, segS: 6, thick: 0.18, tileScale: 1.6, ornaments: false });
  r.position.y = h;
  g.add(r);
  g.rotation.y = rot;
  return g;
}

// stylised tree (old pine / locust)
export function tree(seedV = 1, scale = 1, color = '#2f3f2a') {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 5 * scale, 7), M.wood());
  trunk.position.y = 2.5 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = mat('leaf' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  let s = seedV * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry((1.4 + rnd() * 1.2) * scale, 0), leafMat);
    m.position.set((rnd() - 0.5) * 3 * scale, (4.5 + rnd() * 2.5) * scale, (rnd() - 0.5) * 3 * scale);
    m.scale.y = 0.7;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// palace lantern (glowing)
export function lantern(scale = 1, glow = '#ffb45a') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.42 * scale, 1.0 * scale, 6), new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: glow, emissiveIntensity: 2.2, roughness: 0.6 }));
  g.add(body);
  const capMat = M.dark();
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 0.2 * scale, 6), capMat);
  c1.position.y = 0.6 * scale;
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.3 * scale, 0.2 * scale, 6), capMat);
  c2.position.y = -0.6 * scale;
  g.add(c1, c2);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.6 * scale, 4), new THREE.MeshStandardMaterial({ color: '#b3261e' }));
  tassel.position.y = -1.0 * scale;
  g.add(tassel);
  return g;
}
