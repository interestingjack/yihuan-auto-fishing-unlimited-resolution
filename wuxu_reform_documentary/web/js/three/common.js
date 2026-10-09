// Shared WebGL infrastructure: renderer, film post-process (grade, DOF, bloom,
// vignette, sepia), sky dome, procedural textures, deterministic particles.
import * as THREE from 'three';
import { W, H, makeCanvas, makeNoise, mulberry32, clamp, lerp, ease } from '../engine.js';

export { THREE };
let renderer = null;
let rt = null;
let post = null;

export function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const depthTexture = new THREE.DepthTexture(W, H);
  depthTexture.type = THREE.UnsignedIntType;
  rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType, depthTexture });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  post = makePost();
  return renderer;
}

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float near, far;
uniform float focus, aperture, maxBlur;
uniform float exposure, contrast, saturation, sepia;
uniform vec3 lift, gamma, gain, tint;
uniform float bloom, bloomThreshold, vig, time;
uniform sampler2D tBloom;
varying vec2 vUv;

float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
const int TAPS = 24;
float ign;
vec2 disk(int i) {
  float fi = float(i);
  float r = sqrt((fi + 0.5) / float(TAPS));
  float a = fi * 2.39996323 + ign * 6.2831853;
  return vec2(cos(a), sin(a)) * r;
}
void main() {
  ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float d = linDepth(texture2D(tDepth, vUv).r);
  float coc = clamp(abs(d - focus) / max(d, 0.001) * aperture, 0.0, 1.0);
  vec2 px = 1.0 / res;
  vec3 base = texture2D(tColor, vUv).rgb;
  vec3 col = base;
  float rad = coc * maxBlur;
  if (rad > 0.6) {
    vec3 acc = base; float wsum = 1.0;
    for (int i = 0; i < TAPS; i++) {
      vec2 o = disk(i) * rad * px;
      vec2 uv2 = vUv + o;
      float d2 = linDepth(texture2D(tDepth, uv2).r);
      float c2 = clamp(abs(d2 - focus) / max(d2, 0.001) * aperture, 0.0, 1.0);
      float w = (d2 < d) ? c2 : 1.0; // avoid sharp foreground bleeding
      acc += texture2D(tColor, uv2).rgb * w;
      wsum += w;
    }
    col = acc / wsum;
  }
  if (bloom > 0.0) col += texture2D(tBloom, vUv).rgb * bloom;
  col *= exposure;
  col = aces(col);
  // lift / gamma / gain grade
  col = pow(max(col * gain + lift * (1.0 - col), 0.0), 1.0 / gamma);
  col *= tint;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, saturation);
  col = (col - 0.5) * contrast + 0.5;
  vec3 sep = vec3(l) * vec3(1.07, 0.88, 0.66) + vec3(0.04, 0.02, 0.0);
  col = mix(col, sep, sepia);
  vec2 q = vUv - 0.5;
  col *= 1.0 - vig * dot(q, q) * 2.2;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}`;

function makePost() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(W, H) },
      near: { value: 0.5 }, far: { value: 2000 }, focus: { value: 30 }, aperture: { value: 0 }, maxBlur: { value: 10 },
      exposure: { value: 1 }, contrast: { value: 1.05 }, saturation: { value: 1 }, sepia: { value: 0 },
      lift: { value: new THREE.Vector3(0, 0, 0) }, gamma: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      tint: { value: new THREE.Vector3(1, 1, 1) }, bloom: { value: 0.0 }, tBloom: { value: null }, bloomThreshold: { value: 0.85 }, vig: { value: 0.35 }, time: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // bloom chain at quarter resolution
  const bw = W / 4, bh = H / 4;
  const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const rtA = new THREE.WebGLRenderTarget(bw, bh, opts);
  const rtB = new THREE.WebGLRenderTarget(bw, bh, opts);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, th: { value: 0.8 }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D t; uniform float th; uniform vec2 px; varying vec2 vUv;
      void main(){ vec3 c = vec3(0.0);
        for (int x = -1; x <= 2; x++) for (int y = -1; y <= 2; y++) c += texture2D(t, vUv + vec2(float(x)-0.5, float(y)-0.5) * px).rgb;
        c /= 16.0; gl_FragColor = vec4(max(c - th, 0.0), 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, dir: { value: new THREE.Vector2(1 / bw, 0) } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 0.1964825501511404;
        c += (texture2D(t, vUv + dir * 1.411764705882353 * 2.0).rgb + texture2D(t, vUv - dir * 1.411764705882353 * 2.0).rgb) * 0.2969069646728344;
        c += (texture2D(t, vUv + dir * 3.2941176470588234 * 2.0).rgb + texture2D(t, vUv - dir * 3.2941176470588234 * 2.0).rgb) * 0.09447039785044732;
        c += (texture2D(t, vUv + dir * 5.176470588235294 * 2.0).rgb + texture2D(t, vUv - dir * 5.176470588235294 * 2.0).rgb) * 0.010381362401148057;
        gl_FragColor = vec4(c, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const fsScene = new THREE.Scene();
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright);
  fsScene.add(fsQuad);
  return { mat, scene, cam, rtA, rtB, bright, blur, fsScene, fsQuad, bw, bh };
}

function bloomPass(r, src, threshold) {
  const P = post;
  P.fsQuad.material = P.bright;
  P.bright.uniforms.t.value = src;
  P.bright.uniforms.th.value = threshold;
  r.setRenderTarget(P.rtA);
  r.render(P.fsScene, P.cam);
  P.fsQuad.material = P.blur;
  for (let k = 0; k < 2; k++) {
    P.blur.uniforms.t.value = P.rtA.texture;
    P.blur.uniforms.dir.value.set((1 + k) / P.bw, 0);
    r.setRenderTarget(P.rtB);
    r.render(P.fsScene, P.cam);
    P.blur.uniforms.t.value = P.rtB.texture;
    P.blur.uniforms.dir.value.set(0, (1 + k) / P.bh);
    r.setRenderTarget(P.rtA);
    r.render(P.fsScene, P.cam);
  }
  r.setRenderTarget(null);
  return P.rtA.texture;
}

// Render a scene through the post chain to the renderer canvas, then return the canvas.
export function renderFilm(scene, camera, grade = {}) {
  const r = getRenderer();
  r.setRenderTarget(rt);
  r.clear();
  r.render(scene, camera);
  r.setRenderTarget(null);
  const u = post.mat.uniforms;
  const gb = grade.bloom ?? 0;
  if (gb > 0) u.tBloom.value = bloomPass(r, rt.texture, grade.bloomThreshold ?? 0.85);
  u.tColor.value = rt.texture;
  u.tDepth.value = rt.depthTexture;
  u.near.value = camera.near;
  u.far.value = camera.far;
  const g = { focus: 30, aperture: 0, maxBlur: 9, exposure: 1, contrast: 1.05, saturation: 1, sepia: 0, bloom: 0, bloomThreshold: 0.85, vig: 0.35, ...grade };
  for (const k of ['focus', 'aperture', 'maxBlur', 'exposure', 'contrast', 'saturation', 'sepia', 'bloom', 'bloomThreshold', 'vig']) u[k].value = g[k];
  u.lift.value.set(...(g.lift || [0, 0, 0]));
  u.gamma.value.set(...(g.gamma || [1, 1, 1]));
  u.gain.value.set(...(g.gain || [1, 1, 1]));
  u.tint.value.set(...(g.tint || [1, 1, 1]));
  r.render(post.scene, post.cam);
  return r.domElement;
}

// ---------------------------------------------------------------- sky
export function skyDome(o = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(o.top || '#2b3a55') },
      horizon: { value: new THREE.Color(o.horizon || '#e8b878') },
      bottom: { value: new THREE.Color(o.bottom || '#3a3430') },
      sunDir: { value: new THREE.Vector3(...(o.sunDir || [0.3, 0.15, -1])).normalize() },
      sunColor: { value: new THREE.Color(o.sunColor || '#ffd9a0') },
      sunSize: { value: o.sunSize ?? 0.9985 },
      glow: { value: o.glow ?? 0.6 },
      cloud: { value: o.cloud ?? 0.5 },
      cloudColor: { value: new THREE.Color(o.cloudColor || '#f2d6b0') },
      time: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top, horizon, bottom, sunDir, sunColor, cloudColor; uniform float sunSize, glow, cloud, time;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h*3.0,0.0,1.0),0.6));
        float sd = max(dot(d, sunDir), 0.0);
        col += sunColor * pow(sd, 8.0) * glow * 0.6 + sunColor * pow(sd, 64.0) * glow;
        col = mix(col, sunColor * 1.6, smoothstep(sunSize, sunSize + 0.0008, sd));
        if (cloud > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(time * 0.01, 0.0);
          float c = smoothstep(0.45, 0.85, fbm(uv * 1.3));
          float fade = smoothstep(0.0, 0.25, h);
          vec3 cc = cloudColor * (0.75 + 0.5 * pow(sd, 4.0));
          col = mix(col, cc, c * cloud * fade);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius || 1500, 48, 24), mat);
  mesh.renderOrder = -1;
  return mesh;
}

// ---------------------------------------------------------------- particles (deterministic)
export function dustPoints(o = {}) {
  const n = o.count || 600;
  const rnd = mulberry32(o.seed || 3);
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rnd() - 0.5) * (o.sx || 60);
    pos[i * 3 + 1] = rnd() * (o.sy || 20);
    pos[i * 3 + 2] = (rnd() - 0.5) * (o.sz || 60);
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(o.color || '#ffe0a0') }, size: { value: o.size || 0.12 }, opacity: { value: o.opacity ?? 0.6 }, drift: { value: new THREE.Vector3(...(o.drift || [0.15, 0.05, 0.05])) }, box: { value: new THREE.Vector3(o.sx || 60, o.sy || 20, o.sz || 60) } },
    vertexShader: `
      attribute float seed; uniform float time, size; uniform vec3 drift, box; varying float vA;
      void main(){
        vec3 p = position + drift * time * (0.5 + seed) + vec3(sin(time*0.3+seed*30.0), sin(time*0.23+seed*17.0), cos(time*0.27+seed*11.0)) * 0.4;
        p = mod(p + box * 0.5, box) - box * 0.5; p.y += box.y * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * 900.0 / -mv.z;
        vA = 0.5 + 0.5 * sin(time * 1.7 + seed * 40.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(color, a * opacity * vA); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------- procedural textures
const texCache = new Map();
function canvasTex(key, w, h, draw, o = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const { c, g } = makeCanvas(w, h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}

function noiseFill(g, w, h, seed, amp, freq = 0.02, oct = 4) {
  const n = makeNoise(seed);
  const rnd = mulberry32(seed * 7 + 1);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = n.fbm2(x * freq, y * freq, oct) * amp + (rnd() - 0.5) * amp * 0.25;
    const i = (y * w + x) * 4;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
}

// Glazed roof tiles: columns of round tiles (筒瓦) running down the slope (v axis)
export function tileTex(kind = 'yellow') {
  const cols = { yellow: ['#d9a12a', '#8a5a0e', '#f2c85a'], gray: ['#5f625f', '#2c2e2d', '#7f827e'], green: ['#3f7a58', '#1c3a2a', '#6aa07c'], dark: ['#3a3b3d', '#161718', '#505255'] }[kind];
  return canvasTex('tile' + kind, 256, 256, (g, w, h) => {
    g.fillStyle = cols[1];
    g.fillRect(0, 0, w, h);
    const n = 8; // tile columns per texture
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * cw;
      const gr = g.createLinearGradient(x, 0, x + cw, 0);
      gr.addColorStop(0, cols[1]);
      gr.addColorStop(0.2, cols[0]);
      gr.addColorStop(0.45, cols[2]);
      gr.addColorStop(0.7, cols[0]);
      gr.addColorStop(1, cols[1]);
      g.fillStyle = gr;
      g.fillRect(x + cw * 0.12, 0, cw * 0.76, h);
    }
    // overlap rows
    for (let r = 0; r < 8; r++) {
      const y = (r * h) / 8;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(0, y + 3, w, 2);
    }
    noiseFill(g, w, h, kind.length * 7, 22, 0.05, 3);
  });
}

export function redWallTex() {
  return canvasTex('redwall', 512, 512, (g, w, h) => {
    g.fillStyle = '#8e2a1f';
    g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, 4, 26, 0.012, 5);
    const gr = g.createLinearGradient(0, h, 0, h * 0.6);
    gr.addColorStop(0, 'rgba(40,20,10,0.45)');
    gr.addColorStop(1, 'rgba(40,20,10,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(9);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(30,15,10,${0.04 + rnd() * 0.06})`;
      const x = rnd() * w;
      g.fillRect(x, rnd() * h * 0.3 + h * 0.6, 1 + rnd() * 3, h);
    }
  });
}

export function stoneTex(base = '#cfccc3', key = 'stone') {
  return canvasTex(key + base, 512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, 12, 18, 0.02, 5);
  });
}

export function pavingTex(base = '#9c978c') {
  return canvasTex('paving' + base, 512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, 33, 22, 0.015, 5);
    const rnd = mulberry32(5);
    const n = 4;
    for (let r = 0; r < n; r++) {
      const off = (r % 2) * (w / n / 2);
      for (let c = 0; c <= n; c++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`;
        g.fillRect(c * (w / n) + off, r * (h / n), w / n, h / n);
      }
      g.fillStyle = 'rgba(40,36,30,0.45)';
      g.fillRect(0, r * (h / n), w, 3);
      for (let c = 0; c <= n; c++) g.fillRect(c * (w / n) + off, r * (h / n), 3, h / n);
    }
  });
}

export function brickTex(base = '#6f6d68') {
  return canvasTex('brick' + base, 512, 512, (g, w, h) => {
    g.fillStyle = '#4b4945';
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(17);
    const bh = h / 16, bw = w / 6;
    for (let r = 0; r < 16; r++) {
      for (let c = -1; c < 7; c++) {
        const x = c * bw + (r % 2) * bw * 0.5;
        const v = Math.round(rnd() * 22 - 11);
        const [R, G, B] = [0x6f + v, 0x6d + v, 0x68 + v];
        g.fillStyle = `rgb(${R},${G},${B})`;
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    noiseFill(g, w, h, 18, 16, 0.03, 4);
  });
}

// Lattice door/window panel (菱花格)
export function latticeTex() {
  return canvasTex('lattice', 256, 512, (g, w, h) => {
    g.fillStyle = '#7d1f16';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a120c';
    g.fillRect(18, 18, w - 36, h * 0.62);
    g.strokeStyle = '#c08a3a';
    g.lineWidth = 3;
    for (let i = -20; i < 40; i++) {
      g.beginPath();
      g.moveTo(18 + i * 16, 18);
      g.lineTo(18 + i * 16 + h * 0.62, 18 + h * 0.62);
      g.moveTo(18 + i * 16, 18 + h * 0.62);
      g.lineTo(18 + i * 16 + h * 0.62, 18);
      g.stroke();
    }
    g.fillStyle = '#7d1f16';
    g.fillRect(0, 0, 18, h);
    g.fillRect(w - 18, 0, 18, h);
    g.fillRect(0, 0, w, 18);
    g.fillRect(0, h * 0.62 + 18, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(30, h * 0.7, w - 60, h * 0.22);
    noiseFill(g, w, h, 41, 14, 0.03, 3);
  });
}

// Painted beam band (旋子彩画 impression): blue/green with gold motifs
export function beamTex() {
  return canvasTex('beam', 512, 128, (g, w, h) => {
    g.fillStyle = '#1f4f5c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f6f5a';
    g.fillRect(0, h * 0.5, w, h * 0.5);
    g.strokeStyle = '#d8b25a';
    g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const cx = (i + 0.5) * (w / 8);
      g.beginPath();
      g.ellipse(cx, h / 2, w / 22, h * 0.32, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx, h / 2, h * 0.12, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#d8b25a';
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, h - 5, w, 5);
    noiseFill(g, w, h, 23, 14, 0.04, 3);
  });
}

// Plaque with characters (vertical board)
export function plaqueTex(str, o = {}) {
  if (o.horizontal) {
    return canvasTex('plaqueH' + str + JSON.stringify(o), 128 * [...str].length + 96, 200, (g, w, h) => {
      g.fillStyle = o.border || '#8a6a2e';
      g.fillRect(0, 0, w, h);
      g.fillStyle = o.bg || '#1e1a16';
      g.fillRect(20, 20, w - 40, h - 40);
      g.fillStyle = o.color || '#d9b25a';
      g.font = `${o.size || 112}px "${o.font || 'KaiTC'}"`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      [...str].forEach((ch, i) => g.fillText(ch, 48 + 64 + i * 128, h / 2 + 4));
    });
  }
  return canvasTex('plaque' + str + JSON.stringify(o), 256, 128 * [...str].length + 64, (g, w, h) => {
    g.fillStyle = o.border || '#b8892e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = o.bg || '#1c2c48';
    g.fillRect(22, 22, w - 44, h - 44);
    g.fillStyle = o.color || '#e2bf63';
    g.font = `${o.size || 112}px "${o.font || 'SerifTC'}"`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    [...str].forEach((ch, i) => g.fillText(ch, w / 2, 32 + 64 + i * 128));
  });
}

export function bracketTex() {
  return canvasTex('bracket', 512, 128, (g, w, h) => {
    g.fillStyle = '#16282c';
    g.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n);
      // stacked bracket arms (斗拱 impression)
      for (let k = 0; k < 3; k++) {
        const bw = 22 + k * 16, y = h - 26 - k * 30;
        g.fillStyle = k % 2 ? '#2f6f5a' : '#245a6a';
        g.fillRect(x - bw, y, bw * 2, 18);
        g.fillStyle = '#d8b25a';
        g.fillRect(x - bw, y, bw * 2, 2);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x - bw, y + 16, bw * 2, 4);
      }
      g.fillStyle = '#3a2a1a';
      g.fillRect(x - 12, h - 12, 24, 12);
    }
    noiseFill(g, w, h, 29, 12, 0.05, 3);
  });
}

export function woodTex(base = '#3b2016') {
  return canvasTex('wood' + base, 256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.2})`;
      g.fillRect(i * (w / 16), 0, 3, h);
    }
    noiseFill(g, w, h, 8, 16, 0.03, 3);
  });
}

export function windowTex(seed = 1) {
  // modern facade: glass grid with random lit windows (night/dusk)
  return canvasTex('facade' + seed, 256, 512, (g, w, h) => {
    g.fillStyle = '#1d2530';
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(seed);
    const cols = 8, rows = 24;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = rnd() < 0.45;
      const v = rnd();
      g.fillStyle = lit ? `rgba(255,${200 + v * 40},${130 + v * 60},${0.55 + v * 0.45})` : `rgba(${60 + v * 40},${80 + v * 40},${100 + v * 50},0.9)`;
      g.fillRect(c * (w / cols) + 4, r * (h / rows) + 4, w / cols - 8, h / rows - 6);
    }
  }, {});
}

// helper: interpolate camera along keyframes [{t, pos:[x,y,z], look:[x,y,z], fov}]
export function camKeys(keys, t, e = ease.inOutSine) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const k = e((t - keys[i - 1].t) / (keys[i].t - keys[i - 1].t));
      const a = keys[i - 1], b = keys[i];
      return { pos: a.pos.map((v, j) => lerp(v, b.pos[j], k)), look: a.look.map((v, j) => lerp(v, b.look[j], k)), fov: lerp(a.fov ?? 40, b.fov ?? 40, k) };
    }
  }
  return keys[keys.length - 1];
}

export function applyCam(cam, s) {
  cam.position.set(...s.pos);
  cam.fov = s.fov ?? cam.fov;
  cam.updateProjectionMatrix();
  cam.lookAt(...s.look);
}
