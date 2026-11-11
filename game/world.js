// Regatta: the 3D picture — sea, sky, boats, marks, wake and the two cameras (drone and helm).
import * as THREE from 'three';
import { D2R, wrap, clamp, lerp } from './sim.js';

const SKY_TOP = new THREE.Color('#4f8fcb'), SKY_HORIZON = new THREE.Color('#d6e7f0');
const SUN = new THREE.Vector3(-0.41, 0.57, 0.71).normalize(); // from the south-west, behind a boat beating north
const FOG_NEAR = 150, FOG_FAR = 3200;

// ---------- waves: the same sum of sines in JS (boats, buoys) and in the water shader ----------
export function makeWaves(amp, windFrom) {
  const b = windFrom + Math.PI; // they run downwind
  const parts = [[0, 40, 0.5], [0.45, 24, 0.3], [-0.6, 15, 0.16], [1.0, 9, 0.07]];
  return parts.map(([off, len, f], i) => {
    const a = b + off, k = (2 * Math.PI) / len;
    return { dx: Math.sin(a), dz: -Math.cos(a), k, A: amp * f, w: Math.sqrt(9.81 * k), ph: i * 1.7 };
  });
}
export function waveHeight(W, x, z, t) {
  let h = 0;
  for (const p of W) h += p.A * Math.sin(p.k * (p.dx * x + p.dz * z) - p.w * t + p.ph);
  return h;
}

const WATER_VS = /* glsl */ `
uniform float uTime; uniform vec4 uW[4]; uniform float uWs[4];
varying vec3 vWorld; varying vec3 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h = 0.0; vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 d = uW[i].xy; float k = uW[i].z, A = uW[i].w;
    float ph = k * dot(d, wp.xz) - uWs[i] * uTime + float(i) * 1.7;
    h += A * sin(ph); g += A * k * d * cos(ph);
  }
  wp.y += h; vWorld = wp.xyz; vN = normalize(vec3(-g.x, 1.0, -g.y));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FS = /* glsl */ `
uniform float uTime; uniform vec3 uCam, uSun, uDeep, uShallow, uTop, uHorizon, uFog; uniform float uFogNear, uFogFar, uChop;
uniform vec4 uGust[12]; uniform vec2 uWind;
varying vec3 vWorld; varying vec3 vN;
void main() {
  vec2 p = vWorld.xz;
  float gust = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = clamp(1.0 - length(p - uGust[i].xy) / max(uGust[i].z, 1.0), 0.0, 1.0);
    gust += f * f * (3.0 - 2.0 * f) * uGust[i].w;
  }
  gust = clamp(gust, 0.0, 1.0);
  // fine ripples across the wind; rougher in the gusts
  vec2 wd = uWind, wq = vec2(-wd.y, wd.x);
  float rs = uChop * (0.6 + 1.2 * gust);
  float r1 = sin(dot(p, wd) * 2.1 - uTime * 3.0 + sin(dot(p, wq) * 0.7) * 2.0);
  float r2 = sin(dot(p, normalize(wd + wq * 0.6)) * 3.3 - uTime * 4.1);
  float r3 = sin(dot(p, normalize(wd - wq * 0.5)) * 4.7 - uTime * 5.3 + 1.3);
  vec3 n = normalize(vN + vec3(wd.x, 0.0, wd.y) * (r1 * 0.5 + r2 * 0.3 + r3 * 0.2) * rs + vec3(wq.x, 0.0, wq.y) * (r2 - r3) * rs * 0.4);
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uHorizon, uTop, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 base = mix(uDeep, uShallow, clamp(n.y * 0.5 + (vWorld.y + 0.3) * 0.25, 0.0, 1.0));
  vec3 col = mix(base, sky, fres * 0.8);
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(R, uSun), 0.0), 160.0) * 1.6;
  col *= 1.0 - 0.42 * gust; // cat's paws: a gust reads as a dark patch on the water
  col.b += 0.02 * gust;
  float dist = length(uCam - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

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
  #include <colorspace_fragment>
}`;

// ---------- boats ----------
// hull: stations from the stern (t = 0) to the bow (t = 1), each a rounded section from the deck edge to the keel
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

// a sail as a grid; fill(i, j, out) sets each vertex every frame
function sailMesh(rows, cols, color) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((rows + 1) * (cols + 1) * 3), idx = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(0.38) }));
  m.userData = { rows, cols };
  return m;
}
function setSail(m, fn) {
  const { rows, cols } = m.userData, a = m.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { fn(i / rows, j / cols, v); a.setXYZ(i * (cols + 1) + j, v.x, v.y, v.z); }
  a.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
}

const MAST_Z = -0.9;
const lineMat = new THREE.LineBasicMaterial({ color: 0x39424a });
function rigLine(pts) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.Line(g, lineMat);
}

function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '700 30px Carlito, Lato, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = x.measureText(text).width + 34;
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.roundRect((256 - w) / 2, 12, w, 40, 20); x.fill();
  x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.beginPath(); x.arc((256 - w) / 2 + 18, 32, 7, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.fillText(text, 128 + 8, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
  s.scale.set(0.16, 0.04, 1); s.renderOrder = 10;
  return s;
}

class BoatView {
  constructor({ hull = '#f4f2ec', stripe = '#1d3557', sail = '#f7f5ef', kite = '#e63946', label = null, player = false }) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    const H = hullGeometry(10, 3.3, 0.95, 0.75, { hull, stripe });
    const hullMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.tilt.add(new THREE.Mesh(H.hull, hullMat));
    this.tilt.add(new THREE.Mesh(H.deck, new THREE.MeshLambertMaterial({ color: '#e7e1d3', side: THREE.DoubleSide })));
    const white = new THREE.MeshLambertMaterial({ color: '#f6f6f2' }), dark = new THREE.MeshLambertMaterial({ color: '#2b3137' });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 2.8), white); cabin.position.set(0, 1.3, -0.4); this.tilt.add(cabin);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 1.6), dark); w.position.set(sx * 1.01, 1.35, -0.4); this.tilt.add(w); }
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 2.6), new THREE.MeshLambertMaterial({ color: '#b89a6a' })); cockpit.position.set(0, 1.0, 2.9); this.tilt.add(cockpit);
    // wheel
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), dark); ped.position.set(0, 1.4, 3.7); this.tilt.add(ped);
    this.wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 28), dark); this.wheel.position.set(0, 1.85, 3.75); this.tilt.add(this.wheel);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.03), dark); sp.rotation.z = (i * Math.PI) / 3; this.wheel.add(sp); }
    // rig
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 14.6, 8), new THREE.MeshLambertMaterial({ color: '#c9ced3' }));
    mast.position.set(0, 0.95 + 7.3, MAST_Z); this.tilt.add(mast);
    const spr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.08), dark); spr.position.set(0, 9.2, MAST_Z); this.tilt.add(spr);
    this.tilt.add(rigLine([[0, 12.6, MAST_Z], [0, 1.15, -4.9]]));
    this.tilt.add(rigLine([[0, 15.4, MAST_Z], [0, 1.25, 4.9]]));
    for (const sx of [-1, 1]) this.tilt.add(rigLine([[0, 13.5, MAST_Z], [sx * 1.1, 9.2, MAST_Z], [sx * 1.45, 1.0, MAST_Z + 0.4]]));
    // lifelines
    for (const sx of [-1, 1]) this.tilt.add(rigLine([[0, 1.75, -4.6], [sx * 1.25, 1.7, -2.8], [sx * 1.6, 1.65, 0], [sx * 1.6, 1.65, 3], [sx * 1.35, 1.7, 4.8]]));
    // mainsail on the boom
    this.mainPivot = new THREE.Group(); this.mainPivot.position.set(0, 0, MAST_Z); this.tilt.add(this.mainPivot);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), new THREE.MeshLambertMaterial({ color: '#c9ced3' }));
    boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.95, 2.25); this.mainPivot.add(boom);
    this.main = sailMesh(12, 6, sail); this.mainPivot.add(this.main);
    // jib on the forestay
    this.jibPivot = new THREE.Group(); this.jibPivot.position.set(0, 1.15, -4.9); this.tilt.add(this.jibPivot);
    this.jibAxis = new THREE.Vector3(0, 12.6 - 1.15, MAST_Z + 4.9).normalize();
    this.jib = sailMesh(10, 5, sail); this.jibPivot.add(this.jib);
    // gennaker, drawn in the boat's frame
    this.kite = sailMesh(10, 6, kite); this.kite.visible = false; this.tilt.add(this.kite);
    // telltales on the jib luff (they matter at the helm)
    this.tells = [];
    if (player) for (const [f, sx] of [[0.32, 1], [0.32, -1], [0.55, 1], [0.55, -1]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      t.userData = { f, sx }; this.jibPivot.add(t); this.tells.push(t);
    }
    if (label) { this.label = labelSprite(label.text, label.color); this.label.position.set(0, 17.5, 0); this.root.add(this.label); }
    this.sailSide = 1;
  }
  update(b, t, W, showLabel) {
    const y = waveHeight(W, b.x, b.z, t), fx = Math.sin(b.h), fz = -Math.cos(b.h);
    const pitch = Math.atan2(waveHeight(W, b.x + fx * 4, b.z + fz * 4, t) - waveHeight(W, b.x - fx * 4, b.z - fz * 4, t), 8);
    const roll = Math.atan2(waveHeight(W, b.x - fz * 1.5, b.z + fx * 1.5, t) - waveHeight(W, b.x + fz * 1.5, b.z - fx * 1.5, t), 3) * 0.5;
    const side = b.twa >= 0 ? 1 : -1;
    // the boom swings across smoothly in a tack or gybe
    this.sailSide = lerp(this.sailSide, side, 0.06);
    this.root.position.set(b.x, y * 0.85 - 0.05, b.z);
    this.root.rotation.y = -b.h;
    this.tilt.rotation.x = pitch;
    this.tilt.rotation.z = side * b.heel * D2R + roll;
    this.wheel.rotation.z = -b.rudder * 1.6;
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    const belly = -this.sailSide * (1 - luff * 0.85);
    setSail(this.main, (f, u, v) => {
      const chord = 4.4 * (1 - f) ** 0.9 + 0.3;
      v.set(belly * Math.sin(Math.PI * u) * chord * 0.11 + luff * 0.22 * Math.sin(ph + f * 6 + u * 5) * u, 2.0 + f * 13, u * chord);
    });
    const ja = Math.min(sa * 0.8 + 3 * D2R, 32 * D2R);
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = new THREE.Vector3(0, 12.6 - 1.15, MAST_Z + 4.9), clew = new THREE.Vector3(0, 0.25, 3.6);
    setSail(this.jib, (f, u, v) => {
      const lx = head.x * f, ly = head.y * f, lz = head.z * f;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz);
      v.set(lerp(lx, ex, u) + belly * Math.sin(Math.PI * u) * len * 0.13 + luff * 0.25 * Math.sin(ph * 1.2 + f * 7 + u * 4) * u, lerp(ly, ey, u), lerp(lz, ez, u));
    });
    this.kite.visible = b.kite;
    if (b.kite) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6, 3.2, clamp((a - 95) / 80, 0, 1)), sd = -this.sailSide;
      const tk = [0, 1.3, -6.2], hd = [0, 15.2, MAST_Z], cl = [sd * out, 2.4, 1.2];
      setSail(this.kite, (f, u, v) => {
        const lx = sd * Math.sin(Math.PI * f) * 2.2, lz = -Math.sin(Math.PI * f) * 2.2;
        const p = [lerp(tk[0], hd[0], f) + lx, lerp(tk[1], hd[1], f), lerp(tk[2], hd[2], f) + lz];
        const q = [lerp(cl[0], hd[0], f), lerp(cl[1], hd[1], f), lerp(cl[2], hd[2], f)];
        const bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, f * 1.1)) * 2.4;
        v.set(lerp(p[0], q[0], u) + sd * bul, lerp(p[1], q[1], u), lerp(p[2], q[2], u) - bul * 0.8);
      });
    }
    // telltales: streaming aft when the trim is right, lifting or drooping when it isn't
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side;
      const lx = 0, ly = (12.6 - 1.15) * f, lz = (MAST_Z + 4.9) * f;
      tt.position.set(lx + sx * 0.04, ly, lz + 0.35);
      let rot = Math.PI / 2 + Math.sin(t * 9 + f * 10) * 0.12, ok = true;
      if (b.trim === 'in' && windward) { rot = Math.PI / 2 + 1.0 + Math.sin(t * 13) * 0.5; ok = false; }
      if (b.trim === 'out' && !windward) { rot = 0.25 + Math.sin(t * 5 + f) * 0.2; ok = false; }
      if (b.trim === 'irons') { rot = Math.sin(t * 15 + f * 3) * 1.4; ok = false; }
      tt.rotation.x = -rot;
      tt.material.color.set(ok ? '#2ecc71' : '#ff4d3d');
    }
    if (this.label) this.label.visible = showLabel;
  }
}

function buoy(color = '#ff7a1a', h = 2.4) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, h, 16), m); c.position.y = h / 2 - 0.4; g.add(c);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 16), m); top.position.y = h - 0.4 + 0.45; g.add(top);
  return g;
}

function committeeBoat() {
  const g = new THREE.Group();
  const H = hullGeometry(12, 4, 1.3, 0.8, { hull: '#ffffff', stripe: '#1d3557' });
  g.add(new THREE.Mesh(H.hull, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(H.deck, new THREE.MeshLambertMaterial({ color: '#dcd8cc', side: THREE.DoubleSide })));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 4.2), new THREE.MeshLambertMaterial({ color: '#f2f2ee' })); cab.position.set(0, 2.2, 0.2); g.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.5, 3.6), new THREE.MeshLambertMaterial({ color: '#1f2a33' })); win.position.set(0, 2.5, 0.2); g.add(win);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), new THREE.MeshLambertMaterial({ color: '#ccc' })); mast.position.set(0, 5.4, 0.2); g.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshLambertMaterial({ color: '#ff7a1a', side: THREE.DoubleSide })); flag.position.set(0, 7.3, 0.95); flag.rotation.y = Math.PI / 2; g.add(flag);
  g.userData.flag = flag;
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

// ---------- the world ----------
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight('#dbeaff', '#2c4a5c', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e2', 2.4); sun.position.copy(SUN).multiplyScalar(100); this.scene.add(sun);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSun: { value: SUN } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FS,
    }));
    this.scene.add(this.sky);

    this.waterU = {
      uTime: { value: 0 }, uW: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uWs: { value: [0, 0, 0, 0] },
      uCam: { value: new THREE.Vector3() }, uSun: { value: SUN },
      uDeep: { value: new THREE.Color('#0b3550') }, uShallow: { value: new THREE.Color('#1d6d8c') },
      uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uFog: { value: SKY_HORIZON },
      uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR }, uChop: { value: 0.15 },
      uGust: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) }, uWind: { value: new THREE.Vector2(0, 1) },
    };
    this.water = new THREE.Mesh(waterGeometry(), new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS }));
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
    this.foamN = 700; this.foam = [];
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.foamN * 3), 3));
    fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.foamN * 3), 3));
    const ft = document.createElement('canvas'); ft.width = ft.height = 64;
    const fx = ft.getContext('2d'), gr = fx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64);
    this.foamPts = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1.9, map: new THREE.CanvasTexture(ft), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.foamPts.frustumCulled = false;
    this.scene.add(this.foamPts);
    this.foamI = 0;
    for (let i = 0; i < this.foamN; i++) this.foam.push({ x: 0, z: 0, age: 99, life: 1, vx: 0, vz: 0 });

    this.mode = 'drone';
    this.orbit = 0; this.dist = 26; this.look = 0; this.lookHold = 0;
    this.camH = 0;
    this.boatViews = [];
    this.marks = null;
  }

  setRace(race) {
    for (const v of this.boatViews) this.scene.remove(v.root);
    if (this.marks) this.scene.remove(this.marks);
    this.race = race;
    const W0 = race.wind.dir();
    this.W = makeWaves(race.wind.p.waves, W0);
    this.W.forEach((p, i) => { this.waterU.uW.value[i].set(p.dx, p.dz, p.k, p.A); this.waterU.uWs.value[i] = p.w; });
    this.waterU.uChop.value = 0.08 + race.wind.p.tws / 80;
    const kites = ['#e63946', '#f4a261', '#2a9d8f', '#8e44ad'];
    this.boatViews = race.boats.map((b, i) => {
      const hex = b.color ? '#' + b.color.toString(16).padStart(6, '0') : null;
      const v = b.ai
        ? new BoatView({ hull: hex, stripe: '#f4f2ec', sail: '#f3efe3', kite: kites[i % 4], label: { text: b.name, color: b.color } })
        : new BoatView({ player: true, kite: '#1d6fd1' });
      this.scene.add(v.root);
      return v;
    });
    const c = race.course, g = new THREE.Group();
    this.buoys = [];
    const add = (obj, p) => { obj.position.set(p.x, 0, p.z); g.add(obj); this.buoys.push({ obj, p }); };
    add(buoy(), c.windward); add(buoy(), c.gate[0]); add(buoy(), c.gate[1]); add(buoy('#ffb000', 2), c.pin);
    this.committee = committeeBoat(); add(this.committee, { x: c.committee.x + 4, z: c.committee.z });
    // the line, as a row of floating dashes
    const dash = document.createElement('canvas'); dash.width = 64; dash.height = 4;
    const dx = dash.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 40, 4);
    const tex = new THREE.CanvasTexture(dash); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(28, 1);
    const len = c.committee.x - c.pin.x;
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, depthWrite: false, fog: true }));
    this.line.rotation.x = -Math.PI / 2; this.line.position.set((c.pin.x + c.committee.x) / 2, 0.7, 0);
    g.add(this.line);
    // the arrows over the next mark
    const cone = () => { const m = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4), new THREE.MeshBasicMaterial({ color: '#ffd400', fog: false })); m.rotation.x = Math.PI; return m; };
    this.pointers = [cone(), cone()]; for (const p of this.pointers) g.add(p);
    this.marks = g; this.scene.add(g);
    this.camH = race.player.h;
    for (const f of this.foam) f.age = 99;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  spawnFoam(b, dt) {
    if (b.v < 0.5) return;
    b._foam = (b._foam || 0) + dt * (4 + b.v * 4);
    while (b._foam > 1) {
      b._foam -= 1;
      const f = this.foam[this.foamI]; this.foamI = (this.foamI + 1) % this.foamN;
      const fx = Math.sin(b.h), fz = -Math.cos(b.h), side = Math.random() < 0.5 ? -1 : 1, bow = Math.random() < 0.35;
      const along = bow ? -3.6 : 4.6, across = bow ? side * 1.0 : side * (0.5 + Math.random() * 0.8);
      f.x = b.x - fx * along + -fz * across; f.z = b.z - fz * along + fx * across;
      f.vx = -fz * side * (bow ? 0.9 : 0.4); f.vz = fx * side * (bow ? 0.9 : 0.4);
      f.age = 0; f.life = 3 + Math.random() * 4 + b.v;
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
    this.committee.userData.flag.visible = race.clock < 0;
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
    for (const b of race.boats) this.spawnFoam(b, dt);
    const fp = this.foamPts.geometry.attributes.position, fc = this.foamPts.geometry.attributes.color;
    for (let i = 0; i < this.foamN; i++) {
      const f = this.foam[i];
      f.age += dt; f.x += f.vx * dt; f.z += f.vz * dt; f.vx *= 0.98; f.vz *= 0.98;
      const live = f.age < f.life, a = live ? (1 - f.age / f.life) ** 1.5 * 0.32 : 0;
      fp.setXYZ(i, f.x, live ? waveHeight(this.W, f.x, f.z, t) + 0.15 : -50, f.z);
      fc.setXYZ(i, a, a, a);
    }
    fp.needsUpdate = fc.needsUpdate = true;

    // cameras
    this.camH += wrap(P.h - this.camH) * (1 - Math.exp(-dt * 1.6));
    const cam = this.camera;
    if (this.mode === 'drone') {
      const ph = this.camH + this.orbit, el = 22 * D2R, d = this.dist * (cam.aspect < 1 ? 1.75 : 1); // a tall screen needs the drone further back
      const tx = P.x + Math.sin(P.h) * 5, tz = P.z - Math.cos(P.h) * 5;
      const want = new THREE.Vector3(tx - Math.sin(ph) * d * Math.cos(el), 3 + d * Math.sin(el), tz + Math.cos(ph) * d * Math.cos(el));
      cam.position.lerp(want, 1 - Math.exp(-dt * 6));
      cam.lookAt(tx, 3.5, tz);
      cam.fov = 55;
    } else {
      if (this.lookHold <= 0) this.look *= Math.exp(-dt * 1.5); else this.lookHold -= dt;
      const v = this.boatViews[0], side = P.twa >= 0 ? 1 : -1;
      v.tilt.updateMatrixWorld(true);
      const eye = new THREE.Vector3(side * 1.35, 2.95, 3.6).applyMatrix4(v.tilt.matrixWorld);
      cam.position.copy(eye);
      cam.rotation.set(-0.1, -P.h + this.look - side * 0.22, side * P.heel * D2R * 0.4);
      cam.fov = 68;
    }
    cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position);
    // the water disc follows what the camera looks at
    this.water.position.set(Math.round(P.x / 4) * 4, 0, Math.round(P.z / 4) * 4);
    const u = this.waterU;
    u.uTime.value = t; u.uCam.value.copy(cam.position);
    const bw = wind.dir() + Math.PI; u.uWind.value.set(Math.sin(bw), -Math.cos(bw));
    wind.gusts.forEach((g, i) => { if (i < 12) u.uGust.value[i].set(g.x, g.z, g.r, (g.s / wind.p.gustStr) * Math.min(1, g.life / 6)); });
    this.renderer.render(this.scene, cam);
  }

  // camera gestures
  drag(dx) { if (this.mode === 'drone') this.orbit -= dx * 0.006; else { this.look = clamp(this.look - dx * 0.005, -2.6, 2.6); this.lookHold = 1.2; } }
  zoom(f) { if (this.mode === 'drone') this.dist = clamp(this.dist * f, 12, 90); }
  resetView() { this.orbit = 0; this.look = 0; this.dist = 26; }
}
