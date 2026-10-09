// 3D set pieces (artistic reconstructions). Each exports build() + render(t, opts) -> canvas.
import { THREE, getRenderer, renderFilm, skyDome, dustPoints, camKeys, applyCam, pavingTex, windowTex, plaqueTex, stoneTex } from './common.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { hall, terrace, palaceWall, cityGate, house, tree, lantern, box, M, roof, mat } from './arch.js';
import { mulberry32, lerp, clamp, ease, smoothstep } from '../engine.js';

function ground(size, material, rep) {
  const geo = new THREE.PlaneGeometry(size, size);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * rep);
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function sunLight(scene, dir, color, intensity, range = 150, mapSize = 2048) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(dir[0] * 300, dir[1] * 300, dir[2] * 300);
  l.castShadow = true;
  l.shadow.mapSize.set(mapSize, mapSize);
  const c = l.shadow.camera;
  c.left = -range; c.right = range; c.top = range; c.bottom = -range;
  c.near = 10; c.far = 900;
  l.shadow.bias = -0.0004;
  l.shadow.normalBias = 0.6;
  scene.add(l);
  scene.add(l.target);
  return l;
}

// ================================================================== Palace courtyard (dawn)
export const Palace = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#c9a988', 0.0019);
    const sky = skyDome({ top: '#22406e', horizon: '#e9c39a', bottom: '#5a4636', sunDir: [-0.5, 0.2, 0.8], sunColor: '#ffd49a', glow: 0.5, cloud: 0.6, cloudColor: '#f3d3b0' });
    s.add(sky);
    this.sky = sky;
    s.add(new THREE.HemisphereLight('#9fb2d4', '#5a4330', 0.75));
    this.sun = sunLight(s, [-0.55, 0.36, 0.75], '#ffd2a0', 3.4, 170);
    s.add(ground(900, new THREE.MeshStandardMaterial({ map: pavingTex('#a39c8e'), roughness: 0.95 }), 70));
    // main hall on triple terrace
    const ter = terrace({ w: 74, d: 50, h: 2.3, tiers: 3, step: 5, stairW: 9 });
    s.add(ter);
    const main = hall({ w: 54, d: 26, colH: 9.5, bays: 11, baysD: 5, roof: 'hip2', tile: 'yellow', roofH: 11, ov: 3.2 });
    main.position.y = ter.userData.top;
    s.add(main);
    // flanking galleries and gate pavilions
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const gl = hall({ w: 36, d: 10, colH: 5, bays: 7, baysD: 2, roof: k === 1 ? 'xieshan' : 'gable', tile: 'yellow', roofH: 4.2, ov: 1.6, bracketH: 0.8 });
        gl.rotation.y = sx * Math.PI / 2;
        gl.position.set(sx * 82, 0, 80 - k * 46);
        s.add(gl);
      }
      const pav = hall({ w: 16, d: 12, colH: 6.5, bays: 3, baysD: 3, roof: 'xieshan2', tile: 'yellow', roofH: 5, ov: 2 });
      pav.position.set(sx * 60, 1.2, -10);
      s.add(box(20, 1.2, 16, M.marble(), sx * 60, 0.6, -10, 2));
      s.add(pav);
    }
    // halls behind (depth layering)
    const h2 = hall({ w: 34, d: 20, colH: 7, bays: 7, baysD: 4, roof: 'hip', tile: 'yellow', roofH: 8, ov: 2.6 });
    h2.position.set(0, 6.9, -62);
    s.add(h2);
    const h3 = hall({ w: 50, d: 22, colH: 9, bays: 9, baysD: 4, roof: 'hip2', tile: 'yellow', roofH: 10, ov: 3 });
    h3.position.set(0, 6.9, -118);
    s.add(h3);
    s.add(box(70, 6.9, 110, M.marble(), 0, 3.45, -90, 2));
    // perimeter walls
    s.add(palaceWall(-100, 120, -100, -170, 10));
    s.add(palaceWall(100, 120, 100, -170, 10));
    s.add(palaceWall(-100, -170, 100, -170, 10));
    // distant roofs silhouettes
    const rnd = mulberry32(5);
    for (let i = 0; i < 22; i++) {
      const sx = rnd() < 0.5 ? -1 : 1;
      const hx = hall({ w: 14 + rnd() * 14, d: 8 + rnd() * 6, colH: 4.5, bays: 5, baysD: 2, roof: rnd() < 0.5 ? 'xieshan' : 'hip', tile: 'yellow', roofH: 4 + rnd() * 2, ov: 1.5 });
      hx.position.set(sx * (125 + rnd() * 120), 0, -60 - rnd() * 260);
      hx.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2;
      s.add(hx);
    }
    this.dust = dustPoints({ count: 700, sx: 160, sy: 40, sz: 200, color: '#ffe2a8', size: 0.22, opacity: 0.55 });
    this.dust.position.z = 40;
    s.add(this.dust);
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(36, 1920 / 1080, 0.5, 2000);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const keys = o.keys || [
      { t: 0, pos: [6, 2.2, 150], look: [0, 16, 0], fov: 30 },
      { t: 8, pos: [-14, 16, 92], look: [0, 18, 0], fov: 36 },
    ];
    const st = camKeys(keys, t);
    applyCam(this.cam, st);
    this.dust.material.uniforms.time.value = t;
    this.sky.material.uniforms.time.value = t;
    const focus = this.cam.position.distanceTo(new THREE.Vector3(0, 15, 0));
    return renderFilm(this.scene, this.cam, { focus, aperture: o.aperture ?? 0.9, maxBlur: 7, exposure: o.exposure ?? 1.0, contrast: 1.08, saturation: 0.86, gain: [1.04, 0.99, 0.9], lift: [0.02, 0.012, 0.0], bloom: 0.3, bloomThreshold: 0.8, vig: 0.45, sepia: o.sepia ?? 0, ...(o.grade || {}) });
  },
};

// distant mountains ring (low poly, fogged)
function mountains(radius = 700, color = '#5d6670', seed = 3, height = 60) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 160, 8, true);
  const pos = geo.attributes.position;
  const rnd = mulberry32(seed);
  const amps = Array.from({ length: 6 }, () => [rnd() * 6.28, 1 + Math.floor(rnd() * 9)]);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const a = Math.atan2(z, x);
    let hgt = 0;
    amps.forEach(([ph, f], k) => { hgt += Math.sin(a * f * 2 + ph) / (k + 1); });
    hgt = (0.5 + 0.35 * hgt) * height;
    pos.setY(i, y > 0 ? Math.max(5, hgt) : -5);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true }));
  return m;
}

// custom water reflector shader with gentle ripples + manual fog
const WaterShader = {
  name: 'WaterShader',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    time: { value: 0 }, deep: { value: new THREE.Color('#0b1622') }, strength: { value: 0.75 },
    fogColor: { value: new THREE.Color('#1a2533') }, fogDensity: { value: 0.003 }, ripple: { value: 1.0 },
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
    void main(){ vUv = textureMatrix * vec4(position,1.0); vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float time, strength, fogDensity, ripple; uniform vec3 deep, fogColor;
    varying vec4 vUv; varying vec3 vWorld;
    void main(){
      vec2 w = vec2(sin(vWorld.x*0.21 + time*0.9) + 0.6*sin(vWorld.z*0.37 - time*0.7) + 0.3*sin((vWorld.x+vWorld.z)*0.9 + time*1.7),
                    cos(vWorld.z*0.19 + time*0.8) + 0.5*sin(vWorld.x*0.33 + time*0.6) + 0.3*cos((vWorld.x-vWorld.z)*1.1 - time*1.5));
      vec4 uv = vUv; uv.xy += w * 0.0045 * ripple * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb * color;
      vec3 col = mix(deep, refl, strength);
      float d = length(vWorld - cameraPosition);
      float f = 1.0 - exp(-fogDensity * fogDensity * d * d);
      col = mix(col, fogColor, clamp(f, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};
function water(size, o = {}) {
  const w = new Reflector(new THREE.PlaneGeometry(size, size), { textureWidth: 960, textureHeight: 540, color: o.color || '#8090a0', shader: WaterShader, multisample: 0 });
  w.rotation.x = -Math.PI / 2;
  const u = w.material.uniforms;
  if (o.deep) u.deep.value.set(o.deep);
  if (o.fogColor) u.fogColor.value.set(o.fogColor);
  if (o.fogDensity) u.fogDensity.value = o.fogDensity;
  if (o.strength) u.strength.value = o.strength;
  return w;
}

// ================================================================== Old Beijing: city gate & street (overcast)
export const OldCity = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#b9b4aa', 0.0038);
    this.sky = skyDome({ top: '#8a8d92', horizon: '#c9c3b6', bottom: '#77736b', sunDir: [0.4, 0.5, -0.6], sunColor: '#e8e0d0', glow: 0.25, cloud: 0.9, cloudColor: '#d8d3c8' });
    s.add(this.sky);
    s.add(new THREE.HemisphereLight('#d8d6d0', '#5d564c', 1.4));
    sunLight(s, [0.45, 0.6, 0.55], '#efe6d6', 1.2, 140);
    s.add(ground(900, new THREE.MeshStandardMaterial({ map: stoneTex('#8b8172', 'dirt'), roughness: 1 }), 80));
    const gate = cityGate({ len: 260, h: 14, t: 18, tile: 'gray', towerW: 32, towerD: 12 });
    gate.position.z = -120;
    s.add(gate);
    // street houses both sides, receding toward the gate
    const rnd = mulberry32(12);
    for (const sx of [-1, 1]) {
      let z = 60;
      while (z > -95) {
        const w = 8 + rnd() * 6;
        const h = house(w, 7 + rnd() * 2, 3.4 + rnd() * 1.2, sx * Math.PI / 2, 'gray');
        h.position.set(sx * (13 + rnd() * 1.5), 0, z - w / 2);
        s.add(h);
        // shop sign boards (blank)
        if (rnd() < 0.6) {
          const b = box(0.2, 3.2, 0.9, M.wood(), sx * 10.6, 2.6, z - w * 0.3);
          s.add(b);
        }
        // poles
        if (rnd() < 0.4) s.add(box(0.25, 7, 0.25, M.wood(), sx * 10.2, 3.5, z - w * 0.8));
        z -= w + 0.4;
      }
    }
    // second row of roofs behind
    for (let i = 0; i < 40; i++) {
      const sx = rnd() < 0.5 ? -1 : 1;
      const h = house(9 + rnd() * 6, 7, 3.6, rnd() < 0.5 ? 0 : Math.PI / 2, 'gray');
      h.position.set(sx * (28 + rnd() * 60), 0, 50 - rnd() * 160);
      s.add(h);
    }
    // a few trees
    for (let i = 0; i < 10; i++) {
      const tr = tree(i + 3, 1.1 + rnd() * 0.5, '#3e4436');
      tr.position.set((rnd() < 0.5 ? -1 : 1) * (22 + rnd() * 30), 0, 30 - rnd() * 120);
      s.add(tr);
    }
    this.dust = dustPoints({ count: 500, sx: 60, sy: 18, sz: 140, color: '#f0e6d0', size: 0.14, opacity: 0.35 });
    s.add(this.dust);
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(42, 1920 / 1080, 0.5, 2000);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const keys = o.keys || [
      { t: 0, pos: [-2.5, 2.4, 70], look: [0, 9, -120], fov: 40 },
      { t: 10, pos: [-0.5, 3.4, 40], look: [0, 12, -120], fov: 36 },
    ];
    applyCam(this.cam, camKeys(keys, t));
    this.dust.material.uniforms.time.value = t;
    const focus = this.cam.position.distanceTo(new THREE.Vector3(0, 12, -120));
    return renderFilm(this.scene, this.cam, { focus, aperture: 0.3, maxBlur: 5, exposure: 1.0, contrast: 1.2, saturation: 0.6, sepia: o.sepia ?? 0.85, vig: 0.6, bloom: 0.15, bloomThreshold: 0.8, ...(o.grade || {}) });
  },
};

// ================================================================== Jingshi University gate (morning)
export const University = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#d8c7a8', 0.0045);
    this.sky = skyDome({ top: '#4a6f9e', horizon: '#ecd3a8', bottom: '#6a5a46', sunDir: [0.6, 0.3, 0.7], sunColor: '#ffe2b0', glow: 0.5, cloud: 0.5, cloudColor: '#f5e6cc' });
    s.add(this.sky);
    s.add(new THREE.HemisphereLight('#c4d2e6', '#6a5440', 0.9));
    sunLight(s, [0.55, 0.45, 0.7], '#ffe0b0', 2.6, 90);
    s.add(ground(600, new THREE.MeshStandardMaterial({ map: pavingTex('#9a958a'), roughness: 0.95 }), 60));
    // gate building
    const gate = hall({ w: 12, d: 7, colH: 4.6, bays: 3, baysD: 2, roof: 'xieshan', tile: 'gray', roofH: 3.6, ov: 1.4, porch: 1.6, bracketH: 0.7 });
    s.add(box(14, 0.8, 9, M.stone(), 0, 0.4, 0, 2));
    gate.position.y = 0.8;
    s.add(gate);
    // central doors (red) - replace lattice in middle bay with solid doors
    const doors = box(3.4, 3.6, 0.3, M.column(), 0, 0.8 + 1.8, 7 / 2 - 1.6 + 0.2);
    s.add(doors);
    // studs on doors
    const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), M.gold(), 81);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { m4.makeTranslation(-1.5 + i * 0.375 * (i < 9 ? 1 : 0), 1.2 + j * 0.34, 7 / 2 - 1.6 + 0.37); studs.setMatrixAt(k++, m4); }
    s.add(studs);
    // horizontal plaque
    const pw = 3.6;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * (200 / (128 * 5 + 96))), new THREE.MeshStandardMaterial({ map: plaqueTex('京師大學堂', { horizontal: true, font: 'KaiTC', color: '#d9b25a', bg: '#1c2433', border: '#8a6a2e', size: 104 }), roughness: 0.6 }));
    pl.position.set(0, 0.8 + 4.6 * 0.86, 7 / 2 + 0.45);
    s.add(pl);
    // flanking walls with tile caps
    s.add(wallGray(-7, 2, -60, 2, 5.2));
    s.add(wallGray(7, 2, 60, 2, 5.2));
    // courtyard buildings behind the wall + trees
    const rnd = mulberry32(31);
    for (let i = 0; i < 9; i++) {
      const h = hall({ w: 14 + rnd() * 8, d: 8, colH: 4, bays: 5, baysD: 2, roof: rnd() < 0.5 ? 'gable' : 'xieshan', tile: 'gray', roofH: 3.4, ov: 1.4, bracketH: 0.6 });
      h.position.set((rnd() - 0.5) * 80, 0, -14 - rnd() * 50);
      s.add(h);
    }
    for (let i = 0; i < 16; i++) {
      const tr = tree(i + 7, 1.3 + rnd() * 0.6, i % 3 ? '#3d4a30' : '#4a5634');
      tr.position.set((rnd() - 0.5) * 90, 0, -6 - rnd() * 40);
      s.add(tr);
    }
    // two old trees in front
    this.dust = dustPoints({ count: 400, sx: 40, sy: 14, sz: 60, color: '#fff0c8', size: 0.12, opacity: 0.5 });
    this.dust.position.z = 20;
    s.add(this.dust);
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(38, 1920 / 1080, 0.3, 1500);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const keys = o.keys || [
      { t: 0, pos: [3, 1.7, 34], look: [0, 4.5, 0], fov: 38 },
      { t: 12, pos: [0.6, 2.4, 17], look: [0, 5.2, 0], fov: 36 },
    ];
    applyCam(this.cam, camKeys(keys, t));
    this.dust.material.uniforms.time.value = t;
    const focus = this.cam.position.distanceTo(new THREE.Vector3(0, 5, 3.5));
    return renderFilm(this.scene, this.cam, { focus, aperture: 1.2, maxBlur: 8, exposure: 1.02, contrast: 1.08, saturation: 0.8, sepia: o.sepia ?? 0.25, gain: [1.05, 1.0, 0.9], vig: 0.45, bloom: 0.25, bloomThreshold: 0.8, ...(o.grade || {}) });
  },
};
function wallGray(x0, z0, x1, z1, h) {
  const g = new THREE.Group();
  const L = Math.hypot(x1 - x0, z1 - z0);
  g.add(box(L, h, 1.0, M.grayWall(), 0, h / 2, 0, 3));
  const cap = roof({ hw: L / 2 + 0.2, hd: 1.0, h: 0.6, type: 'gable', tile: 'gray', lift: 0, ext: 0, segA: Math.max(8, Math.round(L / 2)), segS: 4, thick: 0.12, ridgeR: 0.1, ornaments: false });
  cap.position.y = h;
  g.add(cap);
  g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  return g;
}

// ================================================================== Palace corridor at night (长街)
export const Corridor = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#0d1320', 0.012);
    this.sky = skyDome({ top: '#05080f', horizon: '#1b2638', bottom: '#05070b', sunDir: [0.2, 0.55, -0.8], sunColor: '#c8d6ff', sunSize: 0.9992, glow: 0.35, cloud: 0.35, cloudColor: '#2a3448' });
    s.add(this.sky);
    s.add(new THREE.HemisphereLight('#3a4a6a', '#120c08', 0.35));
    const moon = sunLight(s, [0.25, 0.65, -0.7], '#9fb4e0', 0.9, 120);
    s.add(ground(800, new THREE.MeshStandardMaterial({ map: pavingTex('#6f6a62'), roughness: 0.85 }), 60));
    const len = 340;
    s.add(palaceWall(-6, 30, -6, -len, 9.5, 1.6, 'yellow'));
    s.add(palaceWall(6, 30, 6, -len, 9.5, 1.6, 'yellow'));
    const endGate = hall({ w: 16, d: 8, colH: 5, bays: 3, baysD: 2, roof: 'xieshan', tile: 'yellow', roofH: 4, ov: 1.6 });
    endGate.position.set(0, 0, -250);
    s.add(endGate);
    // gates/openings implied by darker recesses
    for (let z = -40; z > -len; z -= 70) {
      for (const sx of [-1, 1]) s.add(box(0.3, 5.5, 4, M.dark(), sx * 5.15, 2.75, z));
    }
    // standing lanterns along the walls
    this.lights = [];
    for (let i = 0; i < 16; i++) {
      const z = 18 - i * 22;
      for (const sx of [-1, 1]) {
        const post = box(0.18, 3.2, 0.18, M.dark(), sx * 4.3, 1.6, z + sx * 5);
        s.add(post);
        const ln = lantern(0.7);
        ln.position.set(sx * 4.3, 3.6, z + sx * 5);
        s.add(ln);
      }
    }
    for (let i = 0; i < 5; i++) {
      const pl = new THREE.PointLight('#ffae5c', 40, 26, 1.6);
      pl.position.set(i % 2 ? 3.6 : -3.6, 3.6, 18 - i * 22 + (i % 2 ? 5 : -5));
      s.add(pl);
      this.lights.push(pl);
    }
    this.dust = dustPoints({ count: 300, sx: 12, sy: 9, sz: 80, color: '#ffcf9a', size: 0.08, opacity: 0.45 });
    this.dust.position.z = -20;
    s.add(this.dust);
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(44, 1920 / 1080, 0.3, 1500);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const keys = o.keys || [
      { t: 0, pos: [0.3, 1.75, 26], look: [0, 2.6, -60], fov: 44 },
      { t: 12, pos: [-0.4, 1.8, -8], look: [0.6, 2.4, -90], fov: 40 },
    ];
    const st = camKeys(keys, t, (x) => x);
    // handheld sway
    st.pos = [st.pos[0] + Math.sin(t * 0.7) * 0.05, st.pos[1] + Math.sin(t * 1.1) * 0.03, st.pos[2]];
    applyCam(this.cam, st);
    this.lights.forEach((l, i) => { l.intensity = 40 * (0.85 + 0.15 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i)); });
    this.dust.material.uniforms.time.value = t;
    return renderFilm(this.scene, this.cam, { focus: 30, aperture: 0.25, maxBlur: 5, exposure: 1.2, contrast: 1.1, saturation: 0.8, gain: [0.95, 0.98, 1.08], lift: [0.0, 0.01, 0.03], vig: 0.65, bloom: 1.1, bloomThreshold: 0.6, ...(o.grade || {}) });
  },
};

// ================================================================== Yingtai island at dusk/night
export const Yingtai = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#2a3444', 0.0045);
    this.sky = skyDome({ top: '#0c121c', horizon: '#56627a', bottom: '#141a22', sunDir: [-0.35, 0.3, -0.88], sunColor: '#eef2ff', sunSize: 0.99955, glow: 0.6, cloud: 0.55, cloudColor: '#59647a' });
    s.add(this.sky);
    s.add(new THREE.HemisphereLight('#7f8fb0', '#1a1612', 0.9));
    sunLight(s, [0.55, 0.55, 0.62], '#b8c8ee', 1.6, 120);
    this.water = water(1600, { deep: '#141d2a', fogColor: '#2a3444', fogDensity: 0.0045, strength: 0.75 });
    s.add(this.water);
    // island rock base
    const rnd = mulberry32(8);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#4e4c48', roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rnd() * 6, 0), rockMat);
      const a = rnd() * 6.28, d = 16 + rnd() * 26;
      r.position.set(Math.cos(a) * d * 1.3, -1 + rnd() * 2, Math.sin(a) * d);
      r.scale.y = 0.45;
      r.castShadow = r.receiveShadow = true;
      s.add(r);
    }
    s.add(box(70, 3, 48, M.stone(), 0, 1.0, 0, 3));
    s.add(terraceSimple(50, 30, 1.6, 2.5));
    const main = hall({ w: 26, d: 14, colH: 6, bays: 7, baysD: 3, roof: 'xieshan', tile: 'yellow', roofH: 6, ov: 2.2 });
    main.position.y = 4.1;
    s.add(main);
    for (const sx of [-1, 1]) {
      const side = hall({ w: 14, d: 9, colH: 4.6, bays: 5, baysD: 2, roof: 'xieshan', tile: 'yellow', roofH: 4.2, ov: 1.6 });
      side.position.set(sx * 25, 2.5, 8);
      side.rotation.y = -sx * 0.2;
      s.add(side);
    }
    const pav = hall({ w: 10, d: 10, colH: 5, bays: 3, baysD: 3, roof: 'xieshan2', tile: 'yellow', roofH: 4.4, ov: 1.8 });
    pav.position.set(0, 2.5, 22);
    s.add(pav);
    // bridge to the north shore
    const br = box(6, 1.2, 80, M.marble(), 0, 1.4, -60, 3);
    s.add(br);
    for (let i = 0; i < 40; i++) for (const sx of [-1, 1]) s.add(box(0.25, 1.0, 0.25, M.marble(), sx * 2.8, 2.5, -22 - i * 2));
    for (let i = 0; i < 14; i++) {
      const tr = tree(i + 40, 1.1 + rnd() * 0.5, '#1f2a22');
      const a = rnd() * 6.28;
      tr.position.set(Math.cos(a) * 30, 1.5, Math.sin(a) * 18);
      s.add(tr);
    }
    // far shore + mountains
    s.add(mountains(900, '#1c2433', 4, 45));
    const shore = box(1600, 3, 40, new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 1 }), 0, 0.5, -320);
    s.add(shore);
    for (let i = 0; i < 18; i++) {
      const hx = hall({ w: 16 + rnd() * 10, d: 9, colH: 4.5, bays: 5, baysD: 2, roof: 'xieshan', tile: 'dark', roofH: 4, ov: 1.4 });
      hx.position.set(-300 + i * 36 + rnd() * 10, 2, -330 - rnd() * 30);
      s.add(hx);
    }
    // one dim lantern
    const ln = lantern(0.8, '#ffb060');
    ln.position.set(4, 7.5, 7.6);
    s.add(ln);
    const pl = new THREE.PointLight('#ffa050', 30, 22, 1.5);
    pl.position.set(4, 7.0, 9);
    s.add(pl);
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(36, 1920 / 1080, 0.5, 3000);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const a = -0.5 + t * 0.022;
    const R = 115 - t * 1.2;
    const st = { pos: [Math.sin(a) * R, 9 + t * 0.15, Math.cos(a) * R], look: [0, 8, 0], fov: 34 };
    applyCam(this.cam, st);
    this.water.material.uniforms.time.value = t;
    return renderFilm(this.scene, this.cam, { focus: R, aperture: 0.3, maxBlur: 5, exposure: 1.45, contrast: 1.08, saturation: 0.55, gain: [0.95, 0.99, 1.08], lift: [0.01, 0.015, 0.03], vig: 0.55, bloom: 0.9, bloomThreshold: 0.55, ...(o.grade || {}) });
  },
};
function terraceSimple(w, d, h, y) {
  const g = new THREE.Group();
  g.add(box(w, h, d, M.marble(), 0, y + h / 2, 0, 2));
  g.add(balustrade_(w, d, y + h));
  return g;
}
import { balustrade as balustrade_ } from './arch.js';

// ================================================================== Modern city at dawn
export const Modern = {
  built: false,
  build() {
    const s = new THREE.Scene();
    s.fog = new THREE.FogExp2('#d6c2aa', 0.00062);
    this.sky = skyDome({ top: '#2f5590', horizon: '#f2c497', bottom: '#4a4a50', sunDir: [0.1, 0.06, -1], sunColor: '#ffd9a0', glow: 1.0, cloud: 0.45, cloudColor: '#f7d2ac', radius: 3000 });
    s.add(this.sky);
    s.add(new THREE.HemisphereLight('#bcd0ee', '#4a4038', 0.9));
    sunLight(s, [0.15, 0.25, -1], '#ffd6a0', 2.6, 500, 2048);
    s.add(ground(4000, new THREE.MeshStandardMaterial({ color: '#4b4d50', roughness: 0.95 }), 1));
    this.water = water(4000, { deep: '#1d2a38', fogColor: '#d6c2aa', fogDensity: 0.00062, strength: 0.8 });
    this.water.material.uniforms.ripple.value = 0.25;
    this.water.position.set(0, 0.2, 0);
    this.water.scale.set(0.06, 1, 1);
    s.add(this.water);
    const rnd = mulberry32(77);
    const facades = [1, 2, 3, 4].map((k) => {
      const t = windowTex(k);
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.4 });
    });
    for (let i = 0; i < 260; i++) {
      const sx = rnd() < 0.5 ? -1 : 1;
      const x = sx * (130 + rnd() * 700);
      const z = -100 - rnd() * 1500;
      const near = Math.abs(x) < 400 && z > -900;
      const h = (near ? 30 : 60) + Math.pow(rnd(), 2) * (near ? 120 : 260);
      const w = 25 + rnd() * 35, d = 25 + rnd() * 35;
      const geo = rnd() < 0.15 ? new THREE.CylinderGeometry(w / 2, w / 2, h, 20) : new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * (w / 30), uv.getY(j) * (h / 60));
      const m = new THREE.Mesh(geo, facades[i % 4]);
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      s.add(m);
    }
    // landmark towers
    for (const [x, z, h] of [[-260, -900, 420], [300, -1100, 360], [-80, -1350, 300]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(14, 30, h, 24), facades[0]);
      m.position.set(x, h / 2, z);
      s.add(m);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(10, 60, 12), facades[1]);
      sp.position.set(x, h + 30, z);
      s.add(sp);
    }
    // bridges across the river
    for (const z of [-250, -700]) s.add(box(300, 6, 18, new THREE.MeshStandardMaterial({ color: '#8a8a88', roughness: 0.7 }), 0, 14, z));
    this.scene = s;
    this.cam = new THREE.PerspectiveCamera(42, 1920 / 1080, 1, 6000);
    this.built = true;
  },
  render(t, o = {}) {
    if (!this.built) this.build();
    const keys = o.keys || [
      { t: 0, pos: [0, 70, 300], look: [0, 60, -800], fov: 42 },
      { t: 14, pos: [10, 95, 60], look: [-20, 80, -900], fov: 40 },
    ];
    applyCam(this.cam, camKeys(keys, t));
    this.water.material.uniforms.time.value = t;
    return renderFilm(this.scene, this.cam, { focus: 900, aperture: 0.0, exposure: 1.0, contrast: 1.12, saturation: 1.0, gain: [1.04, 1.0, 0.95], vig: 0.4, bloom: 0.45, bloomThreshold: 0.75, ...(o.grade || {}) });
  },
};
