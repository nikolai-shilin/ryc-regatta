// Regatta: the 3D picture — sea, sky, boats, marks, wake and the two cameras (drone and helm).
import * as THREE from 'three';
import { D2R, wrap, clamp, lerp, waveHeight, waveSlope, beatAngle, runAngle, HULL, ZONE } from './sim.js';
const SC = HULL / 10.4; // the model is drawn 10.4 m long; a First 40.7 is 12.2 m
import { BoatView, LOOKS, playerLook } from './yacht.js';
import { CommitteeBoat } from './committee.js';
import { Wildlife } from './wildlife.js';
export { flagTexture } from './committee.js';

const SKY_TOP = new THREE.Color('#4f8fcb'), SKY_HORIZON = new THREE.Color('#d6e7f0');
const SUN = new THREE.Vector3(-0.41, 0.57, 0.71).normalize(); // from the south-west, behind a boat beating north
const FOG_NEAR = 150, FOG_FAR = 3200;
// fair-weather cumulus on a layer overhead, made from the ripple noise (uRipple): the sky draws them lit from the sun's
// side (shaded where the cloud thickens towards the sun, a bright rim near it); the sea reflects a cheaper version
const CLOUDS = /* glsl */ `
float cloudDen(vec3 d, float t) {
  vec2 p = d.xz / (max(d.y, 0.0) + 0.1) * 0.3 + vec2(t * 0.0016, t * 0.0007);
  float n = texture2D(uRipple, p).w * 0.62 + texture2D(uRipple, p * 2.3 + 0.31).w * 0.28 + texture2D(uRipple, p * 6.1 + 0.67).w * 0.1;
  return smoothstep(0.52, 0.74, n) * smoothstep(0.02, 0.16, d.y);
}
vec4 withClouds(vec3 col, vec3 d, vec3 sun, float t, bool cheap) {
  if (d.y <= 0.0) return vec4(col, 0.0);
  float c = cloudDen(d, t);
  if (c <= 0.0) return vec4(col, 0.0);
  float lit = 0.8;
  if (!cheap) lit = clamp(0.62 + (c - cloudDen(normalize(d + sun * 0.035), t)) * 1.6, 0.35, 1.0);
  vec3 cc = mix(vec3(0.6, 0.66, 0.74), vec3(1.0, 0.98, 0.95), lit);
  cc += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, sun), 0.0), 8.0) * (1.0 - c) * 0.6;
  return vec4(mix(col, cc, c * 0.92), c);
}`;

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
uniform vec3 uCam, uSun, uDeep, uScatter, uTop, uHorizon, uFog; uniform vec4 uGust[12]; uniform vec2 uWind, uPivot;
uniform sampler2D uRipple;
varying vec3 vWorld; varying vec2 vXZ; varying float vH;
${CLOUDS}
vec3 skyAt(vec3 d) {
  d.y = abs(d.y);
  vec3 c = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), 0.5));
#ifndef LOW_Q
  c = withClouds(c, d, uSun, uTime, true).rgb; // the clouds in the reflection
#endif
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
    vec2 gd = p - uGust[i].xy; // a gust is longer down the wind than it is wide (uWind: the way it blows)
    float f = clamp(1.0 - length(vec2(dot(gd, uWind) / 1.35, dot(gd, vec2(-uWind.y, uWind.x)))) / max(uGust[i].z, 1.0), 0.0, 1.0);
    gust += f * f * (3.0 - 2.0 * f) * uGust[i].w;
  }
  gust = clamp(gust, 0.0, 1.0);
  // wind ripples: two layers of a noise normal map drifting downwind, fading with distance
  float dist = length(uCam - vWorld);
  vec2 wq = vec2(-uWind.y, uWind.x);
  // wind lanes: long streaks of rougher, brighter water lying along the wind, so a shift shows as the lanes swinging
  // round. They are laid out about the middle of the course (uPivot), so near the boats they turn in place.
  // A slow noise bends each lane from side to side and another breaks it into lengths, with soft edges, so from
  // above they read as ruffled water and not as ruled stripes.
  vec2 pc = p - uPivot, lq = vec2(dot(pc, wq), dot(pc, uWind));
  float bend = texture2D(uRipple, lq / vec2(260.0, 420.0) + vec2(0.37, -uTime * 0.0009)).w - 0.5;
  float lane = smoothstep(0.4, 0.72, texture2D(uRipple, vec2((lq.x + bend * 70.0) / 70.0, lq.y / 800.0 - uTime * 0.0013)).w);
  lane *= 0.3 + 0.7 * smoothstep(0.3, 0.62, texture2D(uRipple, vec2(lq.x / 210.0 + 0.53, lq.y / 230.0 - uTime * 0.0021)).w);
  lane *= 1.0 - smoothstep(250.0, 700.0, dist);
  // two layers of ripples, both drifting downwind (1 and 0.8 m/s); the finer one is laid at an angle so the two never
  // line up, and each layer's slopes are turned back into the world from its own axes
  vec2 a2 = wq * 0.8 + uWind * 0.6, b2 = uWind * 0.8 - wq * 0.6; // the second layer's axes
  vec2 q1 = vec2(dot(p, wq), dot(p, uWind) - uTime * 1.0) / 19.0;
  vec2 q2 = (vec2(dot(p, a2), dot(p, b2)) - uTime * 0.8 * vec2(0.6, 0.8)) / 6.5;
  vec4 t1 = texture2D(uRipple, q1);
  vec2 rw = (t1.x * 2.0 - 1.0) * wq + (t1.y * 2.0 - 1.0) * uWind; // ripple slope in world x/z
#ifdef LOW_Q
  rw *= 1.3;
#else
  vec4 t2 = texture2D(uRipple, q2);
  rw += ((t2.x * 2.0 - 1.0) * a2 + (t2.y * 2.0 - 1.0) * b2) * 0.7;
#endif
  // big, slow patches of rougher and smoother water, so the chop never reads as one repeating tile; they drift downwind
  vec2 pr = vec2(dot(p, vec2(0.83, 0.56)), dot(p, vec2(-0.56, 0.83)));
  vec2 prw = vec2(dot(uWind, vec2(0.83, 0.56)), dot(uWind, vec2(-0.56, 0.83))); // the wind in the same axes
  float patchy = texture2D(uRipple, (pr - prw * uTime * 0.17) / 83.0).w;
  float rs = uChop * (1.0 + 1.6 * gust) * (0.55 + 0.9 * patchy) * (0.7 + 0.8 * lane) / (1.0 + dist / 140.0);
  n = normalize(vec3(n.x + rw.x * rs, n.y, n.z + rw.y * rs));
  vec3 V = normalize(uCam - vWorld);
  float cosT = max(dot(n, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, n);
  vec3 refl = skyAt(R);
  // the water body: deep blue, lit turquoise where the crests let the sun through
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
  float crest = smoothstep(-0.2, 1.0, vH / max(uAmp, 0.08));
  float sss = crest * (0.35 + 0.65 * max(0.0, dot(-V, sunFlat))) * (1.0 - cosT * 0.5) * (0.6 + 0.8 * patchy);
  vec3 body = uDeep * (0.75 + 0.25 * max(dot(n, uSun), 0.0)) + uScatter * sss * 0.45;
  vec3 col = mix(body, refl, F);
  // the sun: a sharp glint and a broader glitter
  vec3 Hh = normalize(uSun + V);
  float nh = max(dot(n, Hh), 0.0);
  col += vec3(1.0, 0.93, 0.8) * (pow(nh, 1400.0) * 9.0 + pow(nh, 160.0) * 0.5);
  // whitecaps: a few waves break here and there — on a crest, where a slow patch of the noise says so — with a
  // ragged edge, and leave fading foam behind them. Nothing stretched or small-tiled, so no rows of dashes.
  // the noise is read across and along the wind (pa), so a breaker is a short ragged line along the crest, not a blob
  vec2 pa = vec2(dot(p, wq), dot(p, uWind));
#ifdef LOW_Q
  float edge = t1.w;
#else
  float edge = texture2D(uRipple, vec2(pa.x / 9.0, pa.y / 3.2) - vec2(0.0, uTime * 0.03)).w;
#endif
  float brk = texture2D(uRipple, vec2(pa.x / 46.0, pa.y / 20.0) - vec2(0.0, uTime * 0.012)).w; // where a wave is breaking now
  float wv = 1.3 * crest + 3.0 * brk + 2.0 * edge + 0.4 * gust;
  float cap = smoothstep(4.45, 4.95, wv) * uWhite * (0.4 + 0.45 * t1.w); // a soft edge; foam isn't flat white
  float halo = smoothstep(4.2, 4.6, wv) * uWhite; // the aerated, paler water just round a breaking crest
  col = mix(col, col * 0.7 + uScatter * 0.45, halo * 0.3);
  // old foam: thin streaks lying downwind of the breakers
  float streak = texture2D(uRipple, vec2(pa.x / 4.5, pa.y / 45.0 - uTime * 0.005)).w;
  float wisp = smoothstep(0.66, 0.86, 0.6 * brk + 0.4 * streak) * smoothstep(0.5, 0.7, patchy) * uWhite * 0.12 * (1.0 - smoothstep(60.0, 350.0, dist));
  col = mix(col, vec3(0.86, 0.91, 0.94), clamp(cap * 0.7 + wisp, 0.0, 1.0));
  col = mix(col, col * 1.2 + vec3(0.03, 0.045, 0.06), lane * 0.55); // the lanes catch a little more light
  col *= 1.0 - 0.22 * gust; // a gust reads as a darker patch
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// distance lines across the beat: from the windward mark down to the start line, every 50 m (100 m on a long course),
// each a row of faint dashes with its distance to the mark written at both ends. They widen with the distance, as the laylines do.
export const ladderStep = (beat) => (beat > 600 ? 100 : 50);
function ladder(c) {
  const g = new THREE.Group(), beat = -c.windward.z, step = ladderStep(beat);
  const dash = document.createElement('canvas'); dash.width = 64; dash.height = 4;
  const dx = dash.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 32, 4);
  for (let d = step; d < beat - 15; d += step) {
    const z = c.windward.z + d, half = Math.min(260, 30 + d * 0.95);
    const tex = new THREE.CanvasTexture(dash); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set((2 * half) / 8, 1);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 0.35).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false, fog: true }));
    line.position.set(c.windward.x, 0.65, z); line.renderOrder = 1; g.add(line);
    // the distance, just past each end of the line
    const lc = document.createElement('canvas'); lc.width = 160; lc.height = 56;
    const x = lc.getContext('2d'), text = `${d} m`;
    x.font = '700 30px Carlito, Lato, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(text).width + 26;
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.beginPath(); x.roundRect((160 - w) / 2, 8, w, 40, 20); x.fill();
    x.fillStyle = '#fff'; x.fillText(text, 80, 29);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false, fog: true, toneMapped: false });
    for (const sd of [-1, 1]) { const s = new THREE.Sprite(mat); s.scale.set(13, 4.55, 1); s.position.set(c.windward.x + sd * (half + 7), 3.2, z); g.add(s); }
  }
  return g;
}

// the laylines to the windward mark: two yellow rows of dashes from the edge of its zone down each side of the beat,
// far enough to reach below the start line. Each is a long strip, laid on the waves and turned to the wind every frame.
class Laylines {
  constructor(c, tws) {
    this.m = c.windward; this.up = beatAngle(tws) * D2R;
    const L = (-c.windward.z + 80) / Math.cos(this.up), N = Math.ceil(L / 4), HW = 0.6; // 4 m pieces, 1.2 m wide
    const dash = document.createElement('canvas'); dash.width = 64; dash.height = 4;
    const dx = dash.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 40, 4);
    const tex = new THREE.CanvasTexture(dash); tex.wrapS = THREE.RepeatWrapping;
    this.v = []; // per vertex: distance from the mark, offset across
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const d = ZONE + (i / N) * L;
      for (const o of [-HW, HW]) { this.v.push(d, o); pos.push(0, 0, 0); uv.push(d / 10, o < 0 ? 0 : 1); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd400', map: tex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: true });
    this.group = new THREE.Group();
    this.lines = [-1, 1].map((sd) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.userData.sd = sd;
      this.group.add(mesh); return mesh;
    });
  }
  // W: where the wind blows from now. A boat close-hauled heading hd lays the mark from anywhere on the line that runs
  // from the mark back the way she came: (−sin hd, cos hd)
  update(Wv, W, t) {
    for (const mesh of this.lines) {
      const hd = W + mesh.userData.sd * this.up, ux = -Math.sin(hd), uz = Math.cos(hd), P = mesh.geometry.attributes.position;
      for (let i = 0; i < this.v.length / 2; i++) {
        const d = this.v[i * 2], o = this.v[i * 2 + 1], x = this.m.x + ux * d - uz * o, z = this.m.z + uz * d + ux * o;
        P.setXYZ(i, x, waveHeight(Wv, x, z, t) + 0.15, z);
      }
      P.needsUpdate = true;
    }
  }
}

// the zone round each rounding mark — three hull lengths — as a ring of dashes riding the waves: one mesh for all
// of them; the rings of the mark you sail for now are brighter
class ZoneRings {
  constructor(marks) {
    const N = 72, pos = [], col = [], idx = [];
    this.marks = marks; this.v = [];
    marks.forEach((m, k) => {
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * 2 * Math.PI, a1 = ((i + 0.5) / N) * 2 * Math.PI, o = pos.length / 3;
        for (const [a, r] of [[a0, ZONE - 0.3], [a0, ZONE + 0.3], [a1, ZONE - 0.3], [a1, ZONE + 0.3]]) { this.v.push(k, Math.sin(a) * r, -Math.cos(a) * r); pos.push(0, 0, 0); col.push(1, 1, 1, 0.3); }
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.next = -1;
  }
  update(W, t, next) { // next: the indexes of the marks you sail for now
    const g = this.mesh.geometry, P = g.attributes.position, C = g.attributes.color, key = next.join();
    for (let i = 0; i < this.v.length / 3; i++) {
      const m = this.marks[this.v[i * 3]], x = m.x + this.v[i * 3 + 1], z = m.z + this.v[i * 3 + 2];
      P.setXYZ(i, x, waveHeight(W, x, z, t) + 0.12, z);
      if (key !== this.next) C.setW(i, next.includes(this.v[i * 3]) ? 0.8 : 0.28);
    }
    P.needsUpdate = true; if (key !== this.next) { C.needsUpdate = true; this.next = key; }
  }
}

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
uniform sampler2D uRipple; uniform float uTime, uMax; uniform vec2 uWind;
varying float vAge, vSide, vKind, vStr; varying vec2 vXZ;
void main() {
  float k = clamp(vAge / uMax, 0.0, 1.0), edge = 1.0 - abs(vSide);
  // the foam's texture drifts slowly downwind with the surface water
  float n1 = texture2D(uRipple, (vXZ - uWind * uTime * 0.25) / 3.2).w, n2 = texture2D(uRipple, (vXZ - uWind * uTime * 0.35) / 1.1).w;
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
      if (r === 0) { cx = s.x - fx * 5.0 * SC; cz = s.z - fz * 5.0 * SC; half = 0.7 + age * 0.12; } // wash, from the transom
      else {
        const side = r === 1 ? 1 : -1, out = 1.0 + 0.354 * s.v * age; // tan 19.5° ≈ 0.354: the arms spread as the waves travel
        cx = s.x + fx * 4.2 * SC + rx * side * out; cz = s.z + fz * 4.2 * SC + rz * side * out; half = 0.28 + age * 0.04;
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

// where the hull meets the sea: a patch of water riding the waves round each hull, with the water darkened against
// the topsides, a band of foam along the waterline that breaks up in the noise, and the bow wave — the band widens
// at the bow and with speed. Local coordinates aL: metres along (+ towards the bow) and across.
const CONTACT_VS = /* glsl */ `
attribute vec2 aL; varying vec2 vL, vXZ;
void main() { vL = aL; vXZ = position.xz; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const CONTACT_FS = /* glsl */ `
uniform sampler2D uRipple; uniform float uTime, uSpd; uniform vec2 uWind; varying vec2 vL, vXZ;
const float HL = 5.6, HB = 1.75; // half the waterline's length and beam
void main() {
  float s = vL.x / HL, ay = abs(vL.y), d;
  if (s > 1.0) d = length(vec2(vL.x - HL, vL.y)); // ahead of the stem
  else if (s < -1.0) d = max(ay - HB * 0.88, -vL.x - HL); // behind the transom
  else d = ay - (s > 0.0 ? HB * sqrt(max(0.0, 1.0 - s * s)) : HB * (1.0 - 0.12 * s * s)); // metres outside the hull
  if (d < -0.15) discard;
  float bow = smoothstep(-0.1, 0.9, s);
  float n = texture2D(uRipple, (vXZ - uWind * uTime * 0.25) / 1.6).w * 0.6 + texture2D(uRipple, (vXZ - uWind * uTime * 0.4) / 0.6).w * 0.4; // drifting downwind
  float w = 0.35 + uSpd * (0.5 + 2.6 * bow); // the foam band: wider at the bow and with speed
  float band = exp(-max(d, 0.0) / w);
  float crest = exp(-pow((d - w * 0.9) / (0.25 + 0.3 * w), 2.0)) * bow * uSpd; // the bow wave's crest, pushed out from the stem
  float foam = smoothstep(0.42, 0.72, band * (0.6 + 0.4 * uSpd) + crest * 0.7 + n * 0.55 - 0.25) * (0.4 + 0.6 * uSpd);
  float shade = (1.0 - smoothstep(-0.2, 2.0, d)) * 0.38;
  float a = max(foam * 0.9, shade);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.02, 0.08, 0.11), vec3(0.93, 0.96, 0.98), foam / max(foam + shade, 0.001)), a);
}`;
class HullContact {
  constructor(scene, uniforms) {
    const NA = 28, NC = 10, A0 = -7.8, A1 = 8.4, C = 4.0, aL = [], idx = [];
    for (let i = 0; i <= NA; i++) for (let j = 0; j <= NC; j++) aL.push(lerp(A0, A1, i / NA), lerp(-C, C, j / NC));
    for (let i = 0; i < NA; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aL.length * 1.5), 3));
    g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 2));
    g.setIndex(idx);
    this.u = { uRipple: uniforms.uRipple, uTime: uniforms.uTime, uWind: uniforms.uWind, uSpd: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: CONTACT_VS, fragmentShader: CONTACT_FS, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  update(b, t, W) {
    const g = this.mesh.geometry, P = g.attributes.position, L = g.attributes.aL;
    const fx = Math.sin(b.h), fz = -Math.cos(b.h), rx = Math.cos(b.h), rz = Math.sin(b.h);
    for (let i = 0; i < P.count; i++) {
      const a = L.getX(i), c = L.getY(i), x = b.x + fx * a + rx * c, z = b.z + fz * a + rz * c;
      P.setXYZ(i, x, waveHeight(W, x, z, t) + 0.05, z);
    }
    P.needsUpdate = true;
    this.u.uSpd.value = clamp(b.v / 4.5, 0, 1);
  }
}

// the sails' shadow on the sea: each sail's own cloth, cast along the sun onto the waves (the water takes no shadow
// map). It is laid on the same wave trains that move the water mesh, a little above them; the stencil darkens each
// pixel once, so where main and jib (and both faces of a sail) overlap the shade doesn't double.
const SEASHADE_VS = /* glsl */ `
uniform float uTime; uniform vec4 uW[8]; uniform float uWs[8]; uniform vec3 uSun;
varying float vUp; varying vec3 vPos;
float seaY(vec2 xz) {
  float h = 0.0;
  for (int i = 0; i < ${NV}; i++) h += uW[i].w * sin(uW[i].z * dot(uW[i].xy, xz) - uWs[i] * uTime + float(i) * 1.7);
  return h;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 xz = wp.xz - uSun.xz * wp.y / uSun.y; // onto the level sea
  float h = seaY(xz);
  xz = wp.xz - uSun.xz * (wp.y - h) / uSun.y; // and again onto the wave there
  vUp = wp.y - h; vPos = vec3(xz.x, seaY(xz) + 0.15, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}`;
// the shade: what a shadow dims is the light from under the surface, not the sky the sea reflects — so it is faint
// seen low across the water and plainest from above; and it fades towards the head of the sail, where the
// penumbra spreads it thin
const SEASHADE_FS = /* glsl */ `
varying float vUp; varying vec3 vPos;
void main() {
  float down = abs(normalize(cameraPosition - vPos).y);
  float a = 0.38 * mix(0.2, 1.0, smoothstep(0.05, 0.55, down)) * (1.0 - 0.75 * smoothstep(6.0, 19.0, vUp));
  gl_FragColor = vec4(0.0, 0.03, 0.06, a);
}`;
class SeaShadows {
  constructor(scene, view, mat) {
    this.list = [view.main, view.jib, view.kite].map((grp) => {
      const m = new THREE.Mesh(grp.userData.g, mat); // the sail's own geometry, so it follows the trim and the flogging
      m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 1; // placed by hand: see update
      scene.add(m);
      return { m, grp };
    });
  }
  update(on) {
    for (const { m, grp } of this.list) {
      m.visible = on && grp.visible;
      if (m.visible) { grp.updateWorldMatrix(true, false); m.matrix.copy(grp.matrixWorld); } // the scene is the parent, so this is its place in the world
    }
  }
  dispose(scene) { for (const { m } of this.list) scene.remove(m); }
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
uniform vec3 uTop, uHorizon, uSun; uniform sampler2D uRipple; uniform float uTime; varying vec3 vDir;
${CLOUDS}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), 0.5));
  vec4 cl = withClouds(col, d, uSun, uTime, false);
  col = cl.rgb;
  float s = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.92, 0.75) * (pow(s, 800.0) * 4.0 * (1.0 - cl.a) + pow(s, 12.0) * 0.25); // the disc hides behind a cloud
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function buoy(color = '#ff7a1a', h = 2.4) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, h, 16), m); c.position.y = h / 2 - 0.4; g.add(c);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 16), m); top.position.y = h - 0.4 + 0.45; g.add(top);
  return g;
}

// an island: a ridge of hills whose height rises and falls round it in a few smooth waves, green low down and bare
// rock higher up; the haze (the fog) pales the far ones towards the sky
function island(rand, R, H, color) {
  const NA = 48, NR = 7, pos = [], col = [], idx = [];
  const ph = [rand() * 6, rand() * 6, rand() * 6, rand() * 6], sx = 1 + rand() * 0.8; // longer one way than the other
  const ridge = (a) => 0.7 + 0.22 * Math.sin(a * 2 + ph[0]) + 0.12 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(a * 9 + ph[2]);
  const green = new THREE.Color(color), rock = new THREE.Color('#9c9784'), c = new THREE.Color();
  pos.push(0, H * 0.72, 0); col.push(rock.r, rock.g, rock.b);
  for (let j = 1; j <= NR; j++) {
    const q = j / NR; // the summit … the shore
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2, r = R * q * (0.85 + 0.3 * Math.sin(a * 3 + ph[3]));
      const y = j === NR ? -6 : H * ridge(a) * (1 - q ** 1.5) + (rand() - 0.5) * H * 0.04;
      pos.push(Math.cos(a) * r * sx, y, Math.sin(a) * r);
      c.copy(green).lerp(rock, clamp((y / H - 0.35) * 1.6, 0, 1)); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NA; i++) idx.push(0, 1 + ((i + 1) % NA), 1 + i);
  for (let j = 1; j < NR; j++) {
    const a0 = 1 + (j - 1) * NA, a1 = 1 + j * NA;
    for (let i = 0; i < NA; i++) { const i1 = (i + 1) % NA; idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// ---------- guides around your boat ----------
// Built with the wind from the north and turned to the wind each frame: a half-transparent 3D arrow upwind of the
// boat, pointing the way the wind blows; and a ring: red where she can't sail (too close to the wind), green marks
// at the best angle upwind on each tack, blue marks at the best angle downwind on each gybe; a white pointer for
// your heading. Compass c in this frame sits at ring angle π/2 − c.
const R_IN = 10.5, R_OUT = 12.4;
const glass = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
const sector = (r0, r1, c0, c1, mat) => new THREE.Mesh(new THREE.RingGeometry(r0, r1, Math.max(6, Math.ceil(Math.abs(c1 - c0) / (2 * D2R))), 1, Math.PI / 2 - c1, c1 - c0).rotateX(-Math.PI / 2), mat);
function windArrow() {
  const s = new THREE.Shape(); // pointing −y in the drawing: towards the boat once laid on the water
  s.moveTo(0, -3.4); s.lineTo(1.7, -0.6); s.lineTo(0.6, -0.6); s.lineTo(0.6, 3.2); s.lineTo(-0.6, 3.2); s.lineTo(-0.6, -0.6); s.lineTo(-1.7, -0.6); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.1, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
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
  // every piece is draped on the sea each frame (see drapeGuides), so the dial lies on the water as one layer: it
  // rides the waves instead of floating flat above the troughs and being cut by the crests
  const drape = [];
  for (const o of [turn, tick]) o.traverse((m) => {
    if (!m.isMesh) return;
    m.renderOrder = Math.max(m.renderOrder, 2); m.frustumCulled = false;
    m.userData.base = m.geometry.attributes.position.array.slice(); drape.push(m);
  });
  g.userData = { turn, arrow, tick, drape };
  return g;
}

// lay the guides on the waves: each vertex at the sea's height under it, a hand's breadth up (the guides group sits
// at y = 0 and only turns about the vertical, so a vertex's local height is its height in the world)
const GUIDE_LIFT = 0.18;
function drapeGuides(G, W, t) {
  G.updateMatrixWorld(true);
  for (const m of G.userData.drape) {
    const P = m.geometry.attributes.position, B = m.userData.base, e = m.matrixWorld.elements;
    for (let i = 0, j = 0; i < P.count; i++, j += 3) {
      const x = B[j], y = B[j + 1], z = B[j + 2];
      P.array[j + 1] = y + waveHeight(W, e[0] * x + e[4] * y + e[8] * z + e[12], e[2] * x + e[6] * y + e[10] * z + e[14], t) + GUIDE_LIFT;
    }
    P.needsUpdate = true;
  }
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
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' }); // the stencil: for the sails' shadow on the sea
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

    const ripple = rippleTexture(); // the noise for the ripples, the clouds and the foam
    const skyMat = () => new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSun: { value: SUN }, uRipple: { value: ripple }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FS,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), skyMat());
    this.scene.add(this.sky);
    // the sky with its clouds (and a sea below the horizon) as an environment map, so gelcoat, steel and glass reflect it
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat()));
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
      uGust: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) }, uWind: { value: new THREE.Vector2(0, 1) }, uPivot: { value: new THREE.Vector2() },
      uRipple: { value: ripple },
    };
    this.water = new THREE.Mesh(waterGeometry(), new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, defines: { WAVES: NW } }));
    this.water.frustumCulled = false;
    this.scene.add(this.water);
    this.shadeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.waterU.uTime, uW: this.waterU.uW, uWs: this.waterU.uWs, uSun: this.waterU.uSun },
      vertexShader: SEASHADE_VS, fragmentShader: SEASHADE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    });
    this.seaShadows = [];

    // islands on the horizon, to steer by
    let s = 7; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.4, r = 1900 + rand() * 900;
      const isl = island(rand, 220 + rand() * 420, 70 + rand() * 170, i % 3 ? '#5f7a58' : '#7d8a6a');
      isl.position.x = Math.sin(a) * r; isl.position.z = -Math.cos(a) * r;
      this.scene.add(isl);
    }
    // and a farther range behind them, pale in the haze
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3 + rand() * 0.5, r = 2900 + rand() * 250;
      const isl = island(rand, 500 + rand() * 500, 220 + rand() * 260, '#6a7d6a');
      isl.position.x = Math.sin(a) * r; isl.position.z = -Math.cos(a) * r;
      this.scene.add(isl);
    }

    // glare: a soft bloom round the sun when you look towards it (behind a sail or an island it hides)
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gx = gc.getContext('2d'), gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,248,232,1)'); gr.addColorStop(0.12, 'rgba(255,240,214,0.5)'); gr.addColorStop(0.45, 'rgba(255,236,206,0.12)'); gr.addColorStop(1, 'rgba(255,236,206,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
    this.glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    this.glare.scale.setScalar(1500); this.glare.renderOrder = 5;
    this.scene.add(this.glare);

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

    // gulls, dolphins and whales; their splashes go into the foam above
    this.wild = new Wildlife(this.scene, (x, z, n, up, size) => this.splash(x, z, n, up, size));

    this.wakeU = { uRipple: this.waterU.uRipple, uTime: this.waterU.uTime, uWind: this.waterU.uWind, uMax: { value: WAKE_AGE } };
    this.wakes = []; this.contacts = [];
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
    this.waterU.uPivot.value.set(race.course.windward.x, race.course.windward.z / 2); // the wind lanes turn about the middle of the course
    this.waterU.uWhite.value = clamp((race.wind.p.tws - 10) / 9, 0, 1); // whitecaps from about force 4
    this.boatViews = race.boats.map((b, i) => {
      const v = b.ai
        ? new BoatView({ look: LOOKS[b.name] || LOOKS.Aurora, label: { text: b.name, color: b.color } })
        : new BoatView({ look: playerLook(), player: true }); // your boat in the colours you chose on /boat
      v.root.scale.setScalar(SC);
      this.scene.add(v.root);
      return v;
    });
    for (const s of this.seaShadows) s.dispose(this.scene);
    this.seaShadows = this.boatViews.map((v) => new SeaShadows(this.scene, v, this.shadeMat));
    const c = race.course, g = new THREE.Group();
    this.buoys = [];
    const add = (obj, p) => { obj.position.set(p.x, 0, p.z); g.add(obj); this.buoys.push({ obj, p }); };
    add(buoy(), c.windward); add(buoy(), c.gate[0]); add(buoy(), c.gate[1]); add(buoy('#ffb000', 2), c.pin);
    // the committee boat lies to her anchor head to wind, 5 m beyond the line's end: which side of her the pin is,
    // and where along her the line meets her, place her orange flag and her officers
    const cbx = Math.cos(W0), cbz = Math.sin(W0), ex = -c.dir.x * 5, ez = -c.dir.z * 5;
    this.cb = new CommitteeBoat(ex * cbx + ez * cbz >= 0 ? 1 : -1, -ex * cbz + ez * cbx);
    this.committee = this.cb.root; this.cbW0 = W0;
    add(this.committee, { x: c.committee.x + c.dir.x * 5, z: c.committee.z + c.dir.z * 5 });
    this.committee.rotation.y = -W0;
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
    this.zones = new ZoneRings([c.windward, c.gate[0], c.gate[1]]); g.add(this.zones.mesh);
    this.ladder = ladder(c); g.add(this.ladder);
    this.lay = new Laylines(c, race.wind.p.tws); g.add(this.lay.group);
    this.marks = g; this.scene.add(g);
    this.camH = race.player.h;
    if (this.guides) this.scene.remove(this.guides);
    this.guides = guides(race.wind.p.tws); this.scene.add(this.guides);
    for (const f of this.foam) f.age = 99;
    for (const w of this.wakes) w.dispose(this.scene);
    this.wakes = race.boats.map(() => new Wake(this.scene, this.wakeU));
    for (const h of this.contacts || []) h.dispose(this.scene);
    this.contacts = race.boats.map(() => new HullContact(this.scene, this.wakeU));
    this.wild.reset(race);
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
    this.wild.setLevel(q); // fewer gulls and dolphins lower down
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
      const along = kind === 'bow' ? (-3.2 - Math.random() * 1.5) * SC : kind === 'wash' ? 5.3 + Math.random() : 4.2;
      const across = kind === 'bow' ? side * 1.2 * SC : kind === 'wash' ? (Math.random() - 0.5) * 1.6 : side * 1.45;
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
      f.x = b.x + fx * 4.4 * SC + -fz * side * 0.8; f.z = b.z + fz * 4.4 * SC + fx * side * 0.8; f.y = 0.8;
      f.vx = fx * b.v * 0.6 - fz * side * (0.5 + Math.random()) - Math.sin(wind) * 2.5;
      f.vz = fz * b.v * 0.6 + fx * side * (0.5 + Math.random()) + Math.cos(wind) * 2.5;
      f.vy = 2 + Math.random() * 2.5; f.age = 0; f.life = 0.9 + Math.random() * 0.5; f.spray = true; f.s0 = 0.25; f.s1 = 0.6; f.a = 0.8;
    }
  }

  // a splash where an animal breaks the water: foam spreading on the surface and, with up > 0, spray thrown up
  splash(x, z, n, up = 0, size = 1) {
    n = Math.round(n * (this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : 1));
    const t = this.race ? this.race.t : 0;
    for (let k = 0; k < n; k++) {
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
      const a = Math.random() * 2 * Math.PI, r = Math.random() * size * 0.7, sp = (0.3 + Math.random()) * size * 0.8;
      f.x = x + Math.cos(a) * r; f.z = z + Math.sin(a) * r; f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp; f.age = 0;
      f.spray = up > 0 && k % 2 === 0;
      if (f.spray) { f.y = waveHeight(this.W, f.x, f.z, t) + 0.2; f.vy = up * (0.5 + Math.random() * 0.6); f.life = 0.7 + Math.random() * 0.6; f.s0 = 0.3 * size; f.s1 = 0.8 * size; f.a = 0.8; }
      else { f.life = 1.5 + Math.random() * 2.5; f.s0 = 0.6 * size; f.s1 = 1.8 * size; f.a = 0.55; }
    }
  }

  frame(dt, t) {
    const race = this.race, P = race.player, wind = race.wind;
    // boats
    const cp = this.camera.position, farD = this.mode === 'top' ? 1e9 : 85;
    race.boats.forEach((b, i) => {
      const v = this.boatViews[i];
      v.setDetail(b === P || Math.hypot(b.x - cp.x, b.z - cp.z) < farD * (this.quality === 'low' ? 0.6 : 1) && this.mode !== 'top');
      v.update(b, t, this.W, this.mode === 'drone', { cam: cp, sun: SUN });
      if (v.crew) v.crew[0].g.visible = !(b === P && this.mode === 'helm'); // at the helm, you are the helmsman
      this.settle(v, dt);
      this.seaShadows[i]?.update(this.quality !== 'low'); // Low: no shadows anywhere
    });
    // buoys bob and tilt with the sea under them; in a current a mark leans downstream on its mooring and trails a
    // little foam
    for (const { obj, p } of this.buoys) {
      obj.position.y = waveHeight(this.W, p.x, p.z, t) * (obj === this.committee ? 0.7 : 0.9);
      if (obj === this.committee) { // she pitches and rolls a little on the swell, being long and heavy
        const W0 = this.cbW0, fx = Math.sin(W0), fz = -Math.cos(W0);
        obj.rotation.x = waveSlope(this.W, p.x, p.z, t, fx, fz) * 0.35;
        obj.rotation.z = waveSlope(this.W, p.x, p.z, t, -fz, fx) * 0.35;
        continue;
      }
      const cur = race.currentAt(p.x, p.z), cs = Math.hypot(cur.x, cur.z); // the stream where this mark lies
      const sx = waveSlope(this.W, p.x, p.z, t, 1, 0), sz = waveSlope(this.W, p.x, p.z, t, 0, 1);
      obj.rotation.z = sx * 0.8 - cur.x * 0.5; obj.rotation.x = -sz * 0.8 + cur.z * 0.5;
      if (cs > 0.05 && Math.random() < dt * 7) {
        const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamMax;
        const ux = cur.x / cs, uz = cur.z / cs, side = (Math.random() - 0.5) * 1.6;
        f.x = p.x + ux * 1.1 - uz * side; f.z = p.z + uz * 1.1 + ux * side;
        f.vx = cur.x * 0.9 - uz * side * 0.12; f.vz = cur.z * 0.9 + ux * side * 0.12;
        f.age = 0; f.life = 2.5 + Math.random() * 2; f.spray = false; f.s0 = 0.5; f.s1 = 1.4; f.a = 0.32;
      }
    }
    const lg = race.course.legs[P.leg];
    this.zones.update(this.W, t, P.done ? [] : lg === 'mark' ? [0] : lg === 'gate' ? [1, 2] : []);
    this.cb.update(t, dt, race.flags, race.prepFlag, this.cbW0 - race.wind.dir(), race.wind.p.tws * 0.514); // flags fly downwind
    const k = race.course.legs[P.leg]; // the start line stays drawn for the whole race
    this.ladder.visible = this.showGuides && !P.done; // the distance lines go with the other guides
    this.lay.group.visible = this.showGuides && (k === 'start' || k === 'mark') && !P.done; // laylines before the start and on the beat
    if (this.lay.group.visible) this.lay.update(this.W, race.wind.dir(), t);
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
    race.boats.forEach((b, i) => {
      this.spawnFoam(b, dt); this.spawnSpray(b, dt, race);
      if (this.wakes[i]) this.wakes[i].update(b, dt, t, this.W);
      if (this.contacts[i]) this.contacts[i].update(b, t, this.W);
    });
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
      G.position.set(P.x, 0, P.z);
      U.turn.rotation.y = -P.wdir;
      U.arrow.position.z = -(R_OUT + 6) + ((t * 1.6) % 2.4); // drifting gently downwind
      U.arrow.material.opacity = 0.5 * Math.min(1, (2.4 - ((t * 1.6) % 2.4)) * 2); // and fading as it slides in
      U.tick.position.set(Math.sin(P.h) * (R_OUT + 0.9), 0, -Math.cos(P.h) * (R_OUT + 0.9)); U.tick.rotation.y = -P.h;
      if (G.visible) drapeGuides(G, this.W, t);
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
      const ph = this.camH + this.orbit, el = 24 * D2R, d = this.dist * (cam.aspect < 1 ? 1.75 : 1); // a tall screen needs the drone further back
      const tx = P.x + Math.sin(P.h) * 5, tz = P.z - Math.cos(P.h) * 5;
      const want = new THREE.Vector3(tx - Math.sin(ph) * d * Math.cos(el), 3 + d * Math.sin(el), tz + Math.cos(ph) * d * Math.cos(el));
      // a drone in the wind never hangs quite still: a slow sway and a little bob
      const sw = 0.02 * d;
      want.x += Math.sin(t * 0.37) * sw; want.z += Math.cos(t * 0.29) * sw; want.y += Math.sin(t * 0.53) * sw * 0.7 + Math.sin(t * 1.7) * 0.06;
      cam.position.lerp(want, 1 - Math.exp(-dt * 6));
      cam.lookAt(tx + Math.sin(t * 0.41) * 0.25, 3.5 + Math.sin(t * 0.61) * 0.15, tz);
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
    this.wild.update(dt, t, this.W, cam, this.foamU.uScale.value);
    this.sky.position.copy(cam.position); this.sky.material.uniforms.uTime.value = t; // the clouds drift
    // the glare: brightest looking straight at the sun, gone when you look away
    const look = cam.getWorldDirection(this._dir || (this._dir = new THREE.Vector3()));
    this.glare.position.copy(cam.position).addScaledVector(SUN, 3000);
    this.glare.material.opacity = 0.55 * Math.max(0, look.dot(SUN)) ** 6;
    this.glare.visible = this.glare.material.opacity > 0.01;
    this.sun.target.position.set(P.x, 2, P.z); this.sun.position.set(P.x + SUN.x * 70, 2 + SUN.y * 70, P.z + SUN.z * 70);
    // the water disc follows what the camera looks at
    this.water.position.set(Math.round(P.x / 4) * 4, 0, Math.round(P.z / 4) * 4);
    const u = this.waterU;
    u.uTime.value = t; u.uCam.value.copy(cam.position);
    const bw = wind.dir() + Math.PI; u.uWind.value.set(Math.sin(bw), -Math.cos(bw));
    for (let i = 0; i < this.W.length; i++) u.uW.value[i].w = this.W[i].A; // the chop builds and dies with the wind (sim.js)
    // the sea shows twelve gusts: the nearest to you (a long course has more)
    const gs = wind.gusts.length <= 12 ? wind.gusts : [...wind.gusts].sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 12);
    for (let i = 0; i < 12; i++) { const g = gs[i]; if (g) u.uGust.value[i].set(g.x, g.z, g.r, (g.s / wind.p.gustStr) * (g.k ?? Math.min(1, g.life / 6))); else u.uGust.value[i].set(0, 0, 1, 0); } // k: a gust filling in or dying away
    this.renderer.render(this.scene, cam);
  }

  // a 12-metre boat has weight: she doesn't follow every wave at once but lags the sea a little and overshoots it,
  // heaving, pitching and rolling on springs (the model puts her where the sea would; she gets there here)
  settle(v, dt) {
    const R = v.root, T = v.tilt;
    let s = v.sea;
    if (!s || dt > 0.1) s = v.sea = { y: R.position.y, vy: 0, px: T.rotation.x, vp: 0, rz: T.rotation.z, vr: 0 }; // first frame, or after a pause
    const h = Math.min(dt, 1 / 30), spring = (x, vx, to, k, c) => { vx += (k * (to - x) - c * vx) * h; return [x + vx * h, vx]; };
    [s.y, s.vy] = spring(s.y, s.vy, R.position.y, 7, 2.9); // about a 2.4 s heave, damped to ~0.55 of critical
    [s.px, s.vp] = spring(s.px, s.vp, T.rotation.x, 9, 3.3);
    [s.rz, s.vr] = spring(s.rz, s.vr, T.rotation.z, 6, 2.7);
    R.position.y = s.y; T.rotation.x = s.px; T.rotation.z = s.rz;
  }

  // camera gestures
  drag(dx) { if (this.mode === 'top') return; if (this.mode === 'drone') this.orbit -= dx * 0.006; else { this.look = clamp(this.look - dx * 0.005, -2.6, 2.6); this.lookHold = 1.2; } }
  // zoom: f < 1 in, f > 1 out — the drone comes closer, the top view lower, the helm view through a longer lens
  zoom(f) {
    if (this.mode === 'helm') this.helmFov = clamp(this.helmFov * f, 30, 80);
    else this.dist = clamp(this.dist * f, 8, 110);
  }
  resetView() { this.orbit = 0; this.look = 0; this.dist = 34; this.helmFov = 68; } // far enough back that the whole rig fits under the readouts
}
