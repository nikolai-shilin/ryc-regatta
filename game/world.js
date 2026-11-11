// Regatta: the 3D picture — sea, sky, boats, marks, wake and the two cameras (drone and helm).
import * as THREE from 'three';
import { D2R, wrap, clamp, lerp, waveHeight, beatAngle, runAngle } from './sim.js';
import { BoatView, LOOKS } from './yacht.js';

const SKY_TOP = new THREE.Color('#4f8fcb'), SKY_HORIZON = new THREE.Color('#d6e7f0');
const SUN = new THREE.Vector3(-0.41, 0.57, 0.71).normalize(); // from the south-west, behind a boat beating north
const FOG_NEAR = 150, FOG_FAR = 3200;

// the waves (sim.js) drive the water shader, the boats and the buoys alike
const NW = 8, NV = 5; // wave trains shaded / wave trains that move the surface (the short ones would alias on the mesh)
const WATER_VS = /* glsl */ `
uniform float uTime; uniform vec4 uW[8]; uniform float uWs[8], uQ[8];
varying vec3 vWorld; varying vec2 vXZ; varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 xz = wp.xz; vec3 off = vec3(0.0);
  for (int i = 0; i < ${NV}; i++) {
    vec2 d = uW[i].xy; float k = uW[i].z, A = uW[i].w;
    float ph = k * dot(d, xz) - uWs[i] * uTime + float(i) * 1.7;
    off.xz += uQ[i] * A * d * cos(ph); off.y += A * sin(ph); // Gerstner: crests pinch, troughs flatten
  }
  wp.xyz += off; vWorld = wp.xyz; vXZ = xz; vH = off.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FS = /* glsl */ `
uniform float uTime, uFogNear, uFogFar, uChop, uAmp, uWhite; uniform vec4 uW[8]; uniform float uWs[8], uQ[8];
uniform vec3 uCam, uSun, uDeep, uScatter, uTop, uHorizon, uFog; uniform vec4 uGust[12]; uniform vec2 uWind;
uniform sampler2D uRipple;
varying vec3 vWorld; varying vec2 vXZ; varying float vH;
vec3 skyAt(vec3 d) {
  d.y = abs(d.y);
  vec3 c = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), 0.5));
  return c + vec3(1.0, 0.9, 0.7) * pow(max(dot(d, uSun), 0.0), 10.0) * 0.25;
}
void main() {
  vec2 p = vXZ;
  // the wave trains' normal, all eight
  vec3 n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < WAVES; i++) {
    vec2 d = uW[i].xy; float k = uW[i].z, A = uW[i].w;
    float ph = k * dot(d, p) - uWs[i] * uTime + float(i) * 1.7, c = cos(ph), s = sin(ph);
    n.xz -= d * k * A * c; n.y -= uQ[i] * k * A * s;
  }
  // gusts: rougher water
  float gust = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = clamp(1.0 - length(p - uGust[i].xy) / max(uGust[i].z, 1.0), 0.0, 1.0);
    gust += f * f * (3.0 - 2.0 * f) * uGust[i].w;
  }
  gust = clamp(gust, 0.0, 1.0);
  // wind ripples: two layers of a noise normal map drifting downwind, fading with distance
  float dist = length(uCam - vWorld);
  vec2 wq = vec2(-uWind.y, uWind.x);
  vec2 q1 = vec2(dot(p, wq), dot(p, uWind)) / 19.0 - vec2(0.0, uTime * 0.035);
  vec2 q2 = vec2(dot(p, wq) * 0.8 + dot(p, uWind) * 0.6, dot(p, uWind) * 0.8 - dot(p, wq) * 0.6) / 6.5 - vec2(0.0, uTime * 0.07);
  vec4 t1 = texture2D(uRipple, q1);
#ifdef LOW_Q
  vec2 r = (t1.xy * 2.0 - 1.0) * 1.3;
#else
  vec4 t2 = texture2D(uRipple, q2);
  vec2 r = (t1.xy * 2.0 - 1.0) + (t2.xy * 2.0 - 1.0) * 0.7;
#endif
  float rs = uChop * (1.0 + 1.6 * gust) / (1.0 + dist / 140.0);
  vec2 rw = r.x * wq + r.y * uWind; // ripple slope in world x/z
  n = normalize(vec3(n.x + rw.x * rs, n.y, n.z + rw.y * rs));
  vec3 V = normalize(uCam - vWorld);
  float cosT = max(dot(n, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, n);
  vec3 refl = skyAt(R);
  // the water body: deep blue, lit turquoise where the crests let the sun through
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
  float crest = smoothstep(-0.2, 1.0, vH / max(uAmp, 0.08));
  float sss = crest * (0.35 + 0.65 * max(0.0, dot(-V, sunFlat))) * (1.0 - cosT * 0.5);
  vec3 body = uDeep * (0.75 + 0.25 * max(dot(n, uSun), 0.0)) + uScatter * sss * 0.55;
  vec3 col = mix(body, refl, F);
  // the sun: a sharp glint and a broader glitter
  vec3 Hh = normalize(uSun + V);
  float nh = max(dot(n, Hh), 0.0);
  col += vec3(1.0, 0.93, 0.8) * (pow(nh, 1400.0) * 9.0 + pow(nh, 160.0) * 0.5);
  // whitecaps on the crests in a breeze, broken up by the ripple noise
  // (streaks stretched downwind, on the crests, more in the gusts)
#ifdef LOW_Q
  float streak = t1.w;
#else
  vec2 q3 = vec2(dot(p, wq) / 2.2, dot(p, uWind) / 7.5 - uTime * 0.05);
  float streak = texture2D(uRipple, q3).w;
#endif
  float cap = smoothstep(0.8, 0.97, 0.5 * crest + 0.6 * streak + 0.12 * gust) * uWhite;
  float wisp = smoothstep(0.62, 0.8, 0.35 * crest + 0.7 * streak) * uWhite * 0.18; // old foam lying on the water
  col = mix(col, vec3(0.9, 0.94, 0.96), clamp(cap * 0.9 + wisp, 0.0, 1.0));
  col *= 1.0 - 0.22 * gust; // a gust reads as a darker patch
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// a tileable noise height field → normal map (rgb) with the height kept in alpha, for the wind ripples
function rippleTexture(N = 256) {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const h = new Float32Array(N * N);
  for (const [f, a] of [[4, 1], [8, 0.55], [16, 0.32], [32, 0.18], [64, 0.1]]) {
    const g = Array.from({ length: f * f }, rnd);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * f, fy = (y / N) * f, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const sx = fx - x0, sy = fy - y0, ux = sx * sx * (3 - 2 * sx), uy = sy * sy * (3 - 2 * sy);
      const at = (i, j) => g[((j % f) * f) + (i % f)];
      const v = lerp(lerp(at(x0, y0), at(x0 + 1, y0), ux), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), ux), uy);
      h[y * N + x] += v * a;
    }
  }
  let lo = 1e9, hi = -1e9; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const data = new Uint8Array(N * N * 4), H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 6, dy = (H(x, y + 1) - H(x, y - 1)) * 6, l = Math.hypot(dx, dy, 1);
    const o = (y * N + x) * 4;
    data[o] = (-dx / l * 0.5 + 0.5) * 255; data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; data[o + 2] = (1 / l * 0.5 + 0.5) * 255;
    data[o + 3] = ((H(x, y) - lo) / (hi - lo)) * 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

// ---------- the wake ----------
// Ribbons laid along each boat's real track (sampled as she sails, so the wake curves when she turns):
// the wash — churned, aerated water with broken foam straight behind the stern, widening and fading — and the two
// arms of the Kelvin wake, thin broken foam lines spreading at about 19.5° either side from the bow.
const WAKE_N = 64, WAKE_DT = 0.3, WAKE_AGE = WAKE_N * WAKE_DT; // samples, seconds apart, seconds of wake
const WAKE_VS = /* glsl */ `
attribute float aAge, aSide, aKind, aStr; varying float vAge, vSide, vKind, vStr; varying vec2 vXZ;
void main() { vAge = aAge; vSide = aSide; vKind = aKind; vStr = aStr; vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WAKE_FS = /* glsl */ `
uniform sampler2D uRipple; uniform float uTime, uMax;
varying float vAge, vSide, vKind, vStr; varying vec2 vXZ;
void main() {
  float k = clamp(vAge / uMax, 0.0, 1.0), edge = 1.0 - abs(vSide);
  float n1 = texture2D(uRipple, vXZ / 3.2 + vec2(0.0, uTime * 0.01)).w, n2 = texture2D(uRipple, vXZ / 1.1 - vec2(uTime * 0.02, 0.0)).w;
  float a; vec3 col;
  if (vKind < 0.5) {
    // the wash: aerated turquoise water under foam that breaks up and thins as it ages and spreads
    float foam = smoothstep(0.42, 0.78, n1 * 0.55 + n2 * 0.45 + (1.0 - k) * 0.42 - (1.0 - edge) * 0.55);
    float aer = edge * edge * (1.0 - k) * (1.0 - k) * 0.1 * smoothstep(1.0, 0.0, k * 2.0);
    col = mix(vec3(0.22, 0.45, 0.52), vec3(0.93, 0.96, 0.98), foam);
    a = max(foam * (1.0 - k) * 0.95, aer) * smoothstep(0.0, 0.25, edge);
  } else {
    // a Kelvin arm: a thin crest line, broken by the noise
    float line = pow(edge, 2.2) * smoothstep(0.3, 0.7, n2 * 0.7 + n1 * 0.4);
    col = vec3(0.9, 0.94, 0.97);
    a = line * (1.0 - k) * (1.0 - k) * 0.55;
  }
  a *= vStr * min(1.0, vAge * 3.0 + 0.4);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
class Wake {
  constructor(scene, uniforms) {
    this.trail = []; this.acc = 0;
    const n = 3 * WAKE_N * 2, g = new THREE.BufferGeometry(); // 3 ribbons, two edges each
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const a of ['aAge', 'aSide', 'aKind', 'aStr']) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n), 1));
    const idx = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < WAKE_N - 1; i++) { const a = (r * WAKE_N + i) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: WAKE_VS, fragmentShader: WAKE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); }
  update(b, dt, t, W) {
    // a new sample every WAKE_DT seconds; the newest point always rides with the boat
    this.acc += dt;
    const here = { x: b.x, z: b.z, h: b.h, v: b.v, born: t };
    if (!this.trail.length || this.acc >= WAKE_DT) { this.acc = 0; this.trail.unshift(here); if (this.trail.length > WAKE_N) this.trail.pop(); }
    else this.trail[0] = here;
    const g = this.mesh.geometry, P = g.attributes.position, AG = g.attributes.aAge, SD = g.attributes.aSide, KD = g.attributes.aKind, ST = g.attributes.aStr;
    for (let r = 0; r < 3; r++) for (let i = 0; i < WAKE_N; i++) {
      const s = this.trail[Math.min(i, this.trail.length - 1)], age = Math.max(0, t - s.born);
      const fx = Math.sin(s.h), fz = -Math.cos(s.h), rx = Math.cos(s.h), rz = Math.sin(s.h);
      const str = clamp((s.v - 0.6) / 3.5, 0, 1) * (i < this.trail.length ? 1 : 0);
      let cx, cz, half;
      if (r === 0) { cx = s.x - fx * 5.0; cz = s.z - fz * 5.0; half = 0.7 + age * 0.12; } // wash, from the transom
      else {
        const side = r === 1 ? 1 : -1, out = 1.0 + 0.354 * s.v * age; // tan 19.5° ≈ 0.354: the arms spread as the waves travel
        cx = s.x + fx * 4.2 + rx * side * out; cz = s.z + fz * 4.2 + rz * side * out; half = 0.28 + age * 0.04;
      }
      for (let e = 0; e < 2; e++) {
        const o = (r * WAKE_N + i) * 2 + e, sd = e ? 1 : -1, x = cx + rx * sd * half, z = cz + rz * sd * half;
        P.setXYZ(o, x, waveHeight(W, x, z, t) + 0.07, z);
        AG.setX(o, age); SD.setX(o, sd); KD.setX(o, r ? 1 : 0); ST.setX(o, str);
      }
    }
    P.needsUpdate = AG.needsUpdate = SD.needsUpdate = KD.needsUpdate = ST.needsUpdate = true;
  }
}

// foam and spray as soft points, each with its own size and fade
const FOAM_VS = /* glsl */ `
attribute float aAlpha, aSize; uniform float uScale; varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha; gl_PointSize = aSize * uScale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`;
const FOAM_FS = /* glsl */ `
uniform sampler2D uMap; varying float vA;
void main() { vec4 t = texture2D(uMap, gl_PointCoord); if (t.a * vA < 0.01) discard; gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), t.a * vA); }`;
function foamSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) { // a cluster of bubbles, thicker in the middle
    const r = rnd() * 22, a = rnd() * 7, cx = 32 + Math.cos(a) * r, cy = 32 + Math.sin(a) * r, s = 3 + rnd() * 7;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, s);
    g.addColorStop(0, `rgba(255,255,255,${0.5 - r / 60})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(cx - s, cy - s, s * 2, s * 2);
  }
  return new THREE.CanvasTexture(c);
}

// A disc of water, dense in the middle and sparse at the edge; it follows the camera.
function waterGeometry(R = 3000, rings = 200, segs = 256) {
  const pos = [0, 0, 0], idx = [];
  for (let i = 1; i <= rings; i++) {
    const r = R * (i / rings) ** 2.6;
    for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs, a1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const SKY_FS = /* glsl */ `
uniform vec3 uTop, uHorizon, uSun; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), 0.5));
  float s = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.92, 0.75) * (pow(s, 800.0) * 4.0 + pow(s, 12.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- the committee boat's hull ----------
// stations from the stern (t = 0) to the bow (t = 1), each a rounded section from the deck edge to the keel
function hullGeometry(L, B, sheer, draft, colors) {
  const N = 30, K = 9, pos = [], col = [], idx = [];
  const hull = new THREE.Color(colors.hull), stripe = new THREE.Color(colors.stripe), bottom = new THREE.Color('#7a2e2e');
  const st = (t) => ({
    hb: (B / 2) * (t < 0.55 ? 0.8 + 0.2 * Math.sin((t / 0.55) * Math.PI / 2) : Math.cos(((t - 0.55) / 0.45) * Math.PI / 2) ** 0.8),
    sy: sheer + 0.32 * t * t,
    d: draft * (t < 0.5 ? 0.6 + 0.4 * Math.sin((t / 0.5) * Math.PI / 2) : 0.15 + 0.85 * Math.cos(((t - 0.5) / 0.5) * Math.PI / 2)),
    z: L / 2 - t * L,
  });
  const W = 2 * K + 1;
  for (let i = 0; i <= N; i++) {
    const s = st(i / N);
    for (let k = -K; k <= K; k++) {
      const th = (Math.abs(k) / K) * Math.PI / 2;
      const x = Math.sign(k) * s.hb * Math.cos(th) ** 0.5, y = lerp(s.sy, -s.d, Math.sin(th) ** 1.3);
      pos.push(x, y, s.z);
      const c = y < 0.02 ? bottom : y < 0.2 ? stripe : hull;
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < W - 1; k++) {
    const a = i * W + k, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // transom
  const s0 = st(0), ci = pos.length / 3;
  pos.push(0, (s0.sy - s0.d) / 2, s0.z); col.push(hull.r, hull.g, hull.b);
  for (let k = 0; k < W - 1; k++) idx.push(ci, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // the deck, along the sheer
  const dp = [], di = [];
  for (let i = 0; i <= N; i++) { const s = st(i / N); dp.push(-s.hb, s.sy, s.z, s.hb, s.sy, s.z); }
  for (let i = 0; i < N; i++) { const a = i * 2; di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setIndex(di); dg.computeVertexNormals();
  return { hull: g, deck: dg, sheerAt: (t) => st(t).sy };
}

function buoy(color = '#ff7a1a', h = 2.4) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, h, 16), m); c.position.y = h / 2 - 0.4; g.add(c);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 16), m); top.position.y = h - 0.4 + 0.45; g.add(top);
  return g;
}

// code flags drawn on a canvas
export function flagTexture(k) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const x = c.getContext('2d');
  if (k === 'P') { x.fillStyle = '#1f4fa8'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#fff'; x.fillRect(30, 20, 36, 24); }
  else if (k === 'X') { x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#1f4fa8'; x.fillRect(40, 0, 16, 64); x.fillRect(0, 24, 96, 16); }
  else { x.fillStyle = '#f2c230'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#111'; x.font = '900 40px Carlito, Lato, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('R', 48, 34); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function committeeBoat() {
  const g = new THREE.Group();
  const H = hullGeometry(12, 4, 1.3, 0.8, { hull: '#ffffff', stripe: '#1d3557' });
  g.add(new THREE.Mesh(H.hull, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(H.deck, new THREE.MeshLambertMaterial({ color: '#dcd8cc', side: THREE.DoubleSide })));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 4.2), new THREE.MeshLambertMaterial({ color: '#f2f2ee' })); cab.position.set(0, 2.2, 0.2); g.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.5, 3.6), new THREE.MeshLambertMaterial({ color: '#1f2a33' })); win.position.set(0, 2.5, 0.2); g.add(win);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), new THREE.MeshLambertMaterial({ color: '#ccc' })); mast.position.set(0, 5.4, 0.2); g.add(mast);
  const yard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: '#ccc' })); yard.position.set(0, 7.6, 0.2); g.add(yard);
  // the class flag (warning signal), P (preparatory), X (individual recall)
  const flags = {};
  [['cls', -1.3], ['P', 0], ['X', 1.3]].forEach(([k, x]) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: flagTexture(k), side: THREE.DoubleSide, fog: true }));
    f.position.set(x, 7.15, 0.2); g.add(f); flags[k] = f;
  });
  g.userData.flags = flags;
  return g;
}

function island(rand, R, H, color) {
  const geo = new THREE.ConeGeometry(R, H, 11, 4, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < H / 2 - 0.01) { const k = 0.75 + rand() * 0.5; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (0.6 + rand() * 0.6)); p.setY(i, y + (rand() - 0.5) * H * 0.15); }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.y = H / 2 - 8;
  return m;
}

// ---------- guides around your boat ----------
// Built with the wind from the north and turned to the wind each frame: a half-transparent 3D arrow upwind of the
// boat, pointing the way the wind blows; and a ring: red where she can't sail (too close to the wind), green marks
// at the best angle upwind on each tack, blue marks at the best angle downwind on each gybe; a white pointer for
// your heading. Compass c in this frame sits at ring angle π/2 − c.
const R_IN = 9, R_OUT = 10.6;
const glass = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
const sector = (r0, r1, c0, c1, mat) => new THREE.Mesh(new THREE.RingGeometry(r0, r1, Math.max(6, Math.ceil(Math.abs(c1 - c0) / (2 * D2R))), 1, Math.PI / 2 - c1, c1 - c0).rotateX(-Math.PI / 2), mat);
function windArrow() {
  const s = new THREE.Shape(); // pointing −y in the drawing: towards the boat once laid on the water
  s.moveTo(0, -3.4); s.lineTo(1.7, -0.6); s.lineTo(0.6, -0.6); s.lineTo(0.6, 3.2); s.lineTo(-0.6, 3.2); s.lineTo(-0.6, -0.6); s.lineTo(-1.7, -0.6); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.25, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#dff3ff', emissive: '#7cc8f0', emissiveIntensity: 0.35, roughness: 0.3, transparent: true, opacity: 0.5, depthWrite: false }));
  m.renderOrder = 3;
  return m;
}
function guides(tws) {
  const g = new THREE.Group(), turn = new THREE.Group(); g.add(turn); // turn: rotated to the wind
  const beat = beatAngle(tws) * D2R, run = runAngle(tws) * D2R;
  turn.add(sector(R_IN + 0.55, R_IN + 0.75, 0, 2 * Math.PI, glass('#ffffff', 0.22))); // the dial
  turn.add(sector(R_IN, R_OUT, -beat, beat, glass('#ff4d3d', 0.3))); // no-go: too close to the wind
  for (const sd of [-1, 1]) {
    turn.add(sector(R_IN - 0.5, R_OUT + 0.9, sd * beat - 2.2 * D2R, sd * beat + 2.2 * D2R, glass('#2ee6a0', 0.75))); // best upwind
    turn.add(sector(R_IN - 0.5, R_OUT + 0.9, sd * run - 2.2 * D2R, sd * run + 2.2 * D2R, glass('#3aa8ff', 0.75))); // best downwind
  }
  turn.add(sector(R_IN, R_OUT, Math.PI - (Math.PI - run), Math.PI + (Math.PI - run), glass('#3aa8ff', 0.12))); // the slow dead run between the gybes
  const arrow = windArrow(); arrow.position.set(0, 0, -(R_OUT + 6)); turn.add(arrow);
  const tick = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 3).rotateX(-Math.PI / 2), glass('#ffffff', 0.85)); // your heading
  g.add(tick);
  g.userData = { turn, arrow, tick };
  for (const o of [turn, tick]) o.traverse((m) => { if (m.isMesh) m.renderOrder = Math.max(m.renderOrder, 2); });
  return g;
}

// ---------- graphics levels ----------
// High for computers, Medium to start on phones; Auto (main.js) steps down when the frame rate drops.
const PHONE = /android|iphone|ipad/i.test(navigator.userAgent);
export const QUALITY = {
  high:   { ratio: 1.75, shadow: PHONE ? 1024 : 2048, rings: 200, segs: 256, foam: 1600 },
  medium: { ratio: 1.3,  shadow: 1024, rings: 140, segs: 192, foam: 900 },
  low:    { ratio: 1.0,  shadow: 0,    rings: 100, segs: 128, foam: 450, low: true }, // no shadows, simpler water
};
export const defaultQuality = () => (PHONE ? 'medium' : 'high');

// ---------- the world ----------
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const phone = /android|iphone|ipad/i.test(navigator.userAgent);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight('#dbeaff', '#2c4a5c', 0.9));
    // the sun casts shadows in a box that follows your boat: sails on the deck and on each other
    const sun = this.sun = new THREE.DirectionalLight('#fff1dc', 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 140 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSun: { value: SUN } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FS,
    }));
    this.scene.add(this.sky);
    // the sky (and a sea below the horizon) as an environment map, so gelcoat, steel and glass reflect it
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.sky.material.clone()));
    const seaDisc = new THREE.Mesh(new THREE.CircleGeometry(10, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b5676' }));
    seaDisc.position.y = -0.4; env.add(seaDisc);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();

    this.waterU = {
      uTime: { value: 0 }, uW: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uWs: { value: new Array(NW).fill(0) }, uQ: { value: new Array(NW).fill(0) },
      uCam: { value: new THREE.Vector3() }, uSun: { value: SUN },
      uDeep: { value: new THREE.Color('#062a40') }, uScatter: { value: new THREE.Color('#1aa3a0') },
      uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uFog: { value: SKY_HORIZON },
      uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR }, uChop: { value: 0.15 }, uAmp: { value: 0.4 }, uWhite: { value: 0 },
      uGust: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) }, uWind: { value: new THREE.Vector2(0, 1) },
      uRipple: { value: rippleTexture() },
    };
    this.water = new THREE.Mesh(waterGeometry(), new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, defines: { WAVES: NW } }));
    this.water.frustumCulled = false;
    this.scene.add(this.water);

    // islands on the horizon, to steer by
    let s = 7; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.4, r = 1900 + rand() * 900;
      const isl = island(rand, 220 + rand() * 420, 70 + rand() * 170, i % 3 ? '#6e8467' : '#8b8f7a');
      isl.position.x = Math.sin(a) * r; isl.position.z = -Math.cos(a) * r;
      this.scene.add(isl);
    }

    // wake: foam points
    this.foamN = 1600; this.foam = [];
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.foamN * 3), 3));
    fg.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(this.foamN), 1));
    fg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.foamN), 1));
    this.foamU = { uMap: { value: foamSprite() }, uScale: { value: 400 } };
    this.foamPts = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: this.foamU, vertexShader: FOAM_VS, fragmentShader: FOAM_FS, transparent: true, depthWrite: false }));
    this.foamPts.frustumCulled = false;
    this.scene.add(this.foamPts);
    this.foamI = 0; this.foamMax = this.foamN;
    for (let i = 0; i < this.foamN; i++) this.foam.push({ x: 0, z: 0, age: 99, life: 1, vx: 0, vz: 0, s0: 1, s1: 2 });

    this.wakeU = { uRipple: this.waterU.uRipple, uTime: this.waterU.uTime, uMax: { value: WAKE_AGE } };
    this.wakes = [];
    this.showGuides = true; this.guides = null;
    this.mode = 'drone';
    this.orbit = 0; this.dist = 26; this.look = 0; this.lookHold = 0; this.helmFov = 68;
    this.camH = 0;
    this.boatViews = [];
    this.marks = null;
  }

  setRace(race) {
    for (const v of this.boatViews) this.scene.remove(v.root);
    if (this.marks) this.scene.remove(this.marks);
    this.race = race;
    const W0 = race.wind.dir();
    this.W = race.waves;
    this.W.forEach((p, i) => { this.waterU.uW.value[i].set(p.dx, p.dz, p.k, p.A); this.waterU.uWs.value[i] = p.w; this.waterU.uQ.value[i] = p.Q; });
    this.waterU.uChop.value = 0.1 + race.wind.p.tws / 60;
    this.waterU.uAmp.value = race.wind.p.waves;
    this.waterU.uWhite.value = clamp((race.wind.p.tws - 10) / 9, 0, 1); // whitecaps from about force 4
    this.boatViews = race.boats.map((b, i) => {
      const v = b.ai
        ? new BoatView({ look: LOOKS[b.name] || LOOKS.Aurora, label: { text: b.name, color: b.color } })
        : new BoatView({ look: LOOKS.player, player: true });
      this.scene.add(v.root);
      return v;
    });
    const c = race.course, g = new THREE.Group();
    this.buoys = [];
    const add = (obj, p) => { obj.position.set(p.x, 0, p.z); g.add(obj); this.buoys.push({ obj, p }); };
    add(buoy(), c.windward); add(buoy(), c.gate[0]); add(buoy(), c.gate[1]); add(buoy('#ffb000', 2), c.pin);
    this.committee = committeeBoat(); add(this.committee, { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 });
    this.committee.rotation.y = -W0; // lying head to wind
    // the line, as a row of floating dashes
    const dash = document.createElement('canvas'); dash.width = 64; dash.height = 4;
    const dx = dash.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 40, 4);
    const tex = new THREE.CanvasTexture(dash); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(28, 1);
    const len = Math.hypot(c.committee.x - c.pin.x, c.committee.z - c.pin.z);
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, depthWrite: false, fog: true }));
    this.line.rotation.y = -Math.atan2(c.dir.z, c.dir.x); this.line.position.set((c.pin.x + c.committee.x) / 2, 0.7, (c.pin.z + c.committee.z) / 2);
    g.add(this.line);
    // the arrows over the next mark
    const cone = () => { const m = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4), new THREE.MeshBasicMaterial({ color: '#ffd400', fog: false })); m.rotation.x = Math.PI; return m; };
    this.pointers = [cone(), cone()]; for (const p of this.pointers) g.add(p);
    this.marks = g; this.scene.add(g);
    this.camH = race.player.h;
    if (this.guides) this.scene.remove(this.guides);
    this.guides = guides(race.wind.p.tws); this.scene.add(this.guides);
    for (const f of this.foam) f.age = 99;
    for (const w of this.wakes) w.dispose(this.scene);
    this.wakes = race.boats.map(() => new Wake(this.scene, this.wakeU));
  }

  // switch the graphics level: resolution, sun shadows, water mesh and shading, foam
  setQuality(q) {
    if (!QUALITY[q] || this.quality === q) return;
    const Q = QUALITY[q], hadShadow = this.quality ? QUALITY[this.quality].shadow > 0 : true;
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio));
    if (this.w) this.renderer.setSize(this.w, this.h, false);
    const sh = Q.shadow > 0;
    this.renderer.shadowMap.enabled = sh; this.sun.castShadow = sh;
    if (sh && this.sun.shadow.mapSize.x !== Q.shadow) { this.sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.water.geometry.dispose(); this.water.geometry = waterGeometry(3000, Q.rings, Q.segs);
    this.water.material.defines = Q.low ? { WAVES: 5, LOW_Q: 1 } : { WAVES: NW };
    this.water.material.needsUpdate = true;
    this.foamMax = Q.foam; this.foamI %= Q.foam; this.foamPts.geometry.setDrawRange(0, Q.foam);
    if (hadShadow !== sh) this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); // shadows on/off: recompile
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  spawnFoam(b, dt) {
    if (b.v < 0.5) return;
    if (b.v < 1.2) return;
    b._foam = (b._foam || 0) + dt * b.v * 3; // the wake itself is drawn by Wake; these are splashes at the bow
    while (b._foam > 1) {
      b._foam -= 1;
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const fx = Math.sin(b.h), fz = -Math.cos(b.h), side = Math.random() < 0.5 ? -1 : 1, r = Math.random();
      const kind = 'bow';
      const along = kind === 'bow' ? -3.2 - Math.random() * 1.5 : kind === 'wash' ? 5.3 + Math.random() : 4.2;
      const across = kind === 'bow' ? side * 1.2 : kind === 'wash' ? (Math.random() - 0.5) * 1.6 : side * 1.45;
      f.x = b.x - fx * along + -fz * across; f.z = b.z - fz * along + fx * across;
      const spread = kind === 'bow' ? 1.1 : kind === 'wash' ? 0.1 : 0.55;
      f.vx = -fz * side * spread * (0.6 + b.v * 0.12) + fx * 0.15; f.vz = fx * side * spread * (0.6 + b.v * 0.12) + fz * 0.15;
      f.age = 0; f.life = (kind === 'wash' ? 6 : 3.5) + Math.random() * 3 + b.v * 0.8; f.spray = false;
      f.life = 1.5 + Math.random() * 1.5; f.s0 = 0.6; f.s1 = 1.6; f.a = Math.min(0.55, 0.1 + b.v * 0.07);
    }
  }

  // spray over the bow when she slams into a wave upwind in a breeze
  spawnSpray(b, dt, race) {
    if (b.v < 2.5 || b.tws < 12 || Math.abs(b.twa) > 75 * D2R || b.slope < 0.035) return;
    if (Math.random() > dt * 18 * (b.slope - 0.03) * 20) return;
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), n = 6 + Math.floor(Math.random() * 8);
    for (let k = 0; k < n; k++) {
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const side = Math.random() < 0.5 ? -1 : 1, wind = race.wind.dir();
      f.x = b.x + fx * 4.4 + -fz * side * 0.8; f.z = b.z + fz * 4.4 + fx * side * 0.8; f.y = 0.8;
      f.vx = fx * b.v * 0.6 - fz * side * (0.5 + Math.random()) - Math.sin(wind) * 2.5;
      f.vz = fz * b.v * 0.6 + fx * side * (0.5 + Math.random()) + Math.cos(wind) * 2.5;
      f.vy = 2 + Math.random() * 2.5; f.age = 0; f.life = 0.9 + Math.random() * 0.5; f.spray = true; f.s0 = 0.25; f.s1 = 0.6; f.a = 0.8;
    }
  }

  frame(dt, t) {
    const race = this.race, P = race.player, wind = race.wind;
    // boats
    race.boats.forEach((b, i) => this.boatViews[i].update(b, t, this.W, this.mode === 'drone'));
    // buoys bob
    for (const { obj, p } of this.buoys) {
      obj.position.y = waveHeight(this.W, p.x, p.z, t) * (obj === this.committee ? 0.7 : 0.9);
      if (obj !== this.committee) { obj.rotation.z = Math.sin(t * 1.3 + p.x) * 0.08; obj.rotation.x = Math.cos(t * 1.1 + p.z) * 0.08; }
    }
    const fl = this.committee.userData.flags;
    for (const k of ['cls', 'P', 'X']) { fl[k].visible = !!race.flags[k]; fl[k].rotation.y = Math.sin(t * 6 + k.length) * 0.25 - race.wind.dir(); }
    // the line shows before the start and on the way to the finish
    const k = race.course.legs[P.leg];
    this.line.visible = k === 'start' || k === 'finish';
    // pointers over the next mark(s)
    const c = race.course;
    const targets = k === 'mark' ? [c.windward] : k === 'gate' ? c.gate : [c.pin, { x: c.committee.x, z: c.committee.z }];
    this.pointers.forEach((p, i) => {
      const m = targets[i];
      p.visible = !!m && !P.done;
      if (!m) return;
      const d = Math.hypot(m.x - P.x, m.z - P.z), sc = clamp(d / 70, 1, 5);
      p.scale.setScalar(sc);
      p.position.set(m.x, 5 + sc * 2 + Math.sin(t * 3) * 0.6 * sc, m.z);
      p.rotation.y = t;
    });
    // foam
    race.boats.forEach((b, i) => { this.spawnFoam(b, dt); this.spawnSpray(b, dt, race); if (this.wakes[i]) this.wakes[i].update(b, dt, t, this.W); });
    const ga = this.foamPts.geometry.attributes, fp = ga.position, fa = ga.aAlpha, fs = ga.aSize;
    for (let i = 0; i < this.foamMax; i++) {
      const f = this.foam[i];
      f.age += dt; f.x += f.vx * dt; f.z += f.vz * dt; if (!f.spray) { f.vx *= 0.985; f.vz *= 0.985; }
      const live = f.age < f.life, k = live ? f.age / f.life : 1;
      if (f.spray) { f.vy -= 9.81 * dt; f.y += f.vy * dt; }
      fp.setXYZ(i, f.x, live ? (f.spray ? f.y : waveHeight(this.W, f.x, f.z, t) + 0.12) : -50, f.z);
      fa.setX(i, live ? (f.a || 0.5) * (1 - k) ** 1.6 * Math.min(1, f.age * 6) : 0);
      fs.setX(i, lerp(f.s0, f.s1, Math.sqrt(k)));
    }
    fp.needsUpdate = fa.needsUpdate = fs.needsUpdate = true;
    this.foamU.uScale.value = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * D2R) / 2));

    // guides: around your boat, turned to the wind she feels; off in the helm view
    if (this.guides) {
      const G = this.guides, U = G.userData;
      G.visible = this.showGuides && this.mode !== 'helm' && !P.done;
      G.position.set(P.x, 0.45 + race.wind.p.waves * 0.9, P.z);
      U.turn.rotation.y = -P.wdir;
      U.arrow.position.z = -(R_OUT + 6) + ((t * 1.6) % 2.4); // drifting gently downwind
      U.arrow.material.opacity = 0.5 * Math.min(1, (2.4 - ((t * 1.6) % 2.4)) * 2); // and fading as it slides in
      U.tick.position.set(Math.sin(P.h) * (R_OUT + 0.9), 0, -Math.cos(P.h) * (R_OUT + 0.9)); U.tick.rotation.y = -P.h;
    }
    // cameras
    this.camH += wrap(P.h - this.camH) * (1 - Math.exp(-dt * 1.6));
    const cam = this.camera;
    cam.up.set(0, 1, 0);
    if (this.mode === 'top') {
      // straight down, your heading up the screen, so steering left turns her left on screen too
      const hgt = 20 + this.dist * 1.6 * (cam.aspect < 1 ? 1.5 : 1);
      cam.position.lerp(new THREE.Vector3(P.x, hgt, P.z), 1 - Math.exp(-dt * 8));
      cam.up.set(Math.sin(this.camH), 0, -Math.cos(this.camH));
      cam.lookAt(P.x, 0, P.z);
      cam.fov = 50;
    } else if (this.mode === 'drone') {
      const ph = this.camH + this.orbit, el = 22 * D2R, d = this.dist * (cam.aspect < 1 ? 1.75 : 1); // a tall screen needs the drone further back
      const tx = P.x + Math.sin(P.h) * 5, tz = P.z - Math.cos(P.h) * 5;
      const want = new THREE.Vector3(tx - Math.sin(ph) * d * Math.cos(el), 3 + d * Math.sin(el), tz + Math.cos(ph) * d * Math.cos(el));
      cam.position.lerp(want, 1 - Math.exp(-dt * 6));
      cam.lookAt(tx, 3.5, tz);
      cam.fov = 55;
    } else if (this.mode === 'helm') {
      if (this.lookHold <= 0) this.look *= Math.exp(-dt * 1.5); else this.lookHold -= dt;
      const v = this.boatViews[0], side = P.twa >= 0 ? 1 : -1;
      v.tilt.updateMatrixWorld(true);
      const eye = new THREE.Vector3(side * 1.0, 2.75, 4.45).applyMatrix4(v.tilt.matrixWorld);
      cam.position.copy(eye);
      cam.rotation.set(-0.1, -P.h + this.look - side * 0.22, side * P.heel * D2R * 0.4);
      cam.fov = this.helmFov;
    }
    cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position);
    this.sun.target.position.set(P.x, 2, P.z); this.sun.position.set(P.x + SUN.x * 70, 2 + SUN.y * 70, P.z + SUN.z * 70);
    // the water disc follows what the camera looks at
    this.water.position.set(Math.round(P.x / 4) * 4, 0, Math.round(P.z / 4) * 4);
    const u = this.waterU;
    u.uTime.value = t; u.uCam.value.copy(cam.position);
    const bw = wind.dir() + Math.PI; u.uWind.value.set(Math.sin(bw), -Math.cos(bw));
    wind.gusts.forEach((g, i) => { if (i < 12) u.uGust.value[i].set(g.x, g.z, g.r, (g.s / wind.p.gustStr) * Math.min(1, g.life / 6)); });
    this.renderer.render(this.scene, cam);
  }

  // camera gestures
  drag(dx) { if (this.mode === 'top') return; if (this.mode === 'drone') this.orbit -= dx * 0.006; else { this.look = clamp(this.look - dx * 0.005, -2.6, 2.6); this.lookHold = 1.2; } }
  // zoom: f < 1 in, f > 1 out — the drone comes closer, the top view lower, the helm view through a longer lens
  zoom(f) {
    if (this.mode === 'helm') this.helmFov = clamp(this.helmFov * f, 30, 80);
    else this.dist = clamp(this.dist * f, 8, 110);
  }
  resetView() { this.orbit = 0; this.look = 0; this.dist = 26; this.helmFov = 68; }
}
