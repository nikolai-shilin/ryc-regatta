// Regatta: life on the water — gulls wheeling over the boats and sitting on the sea, a pod of dolphins that comes to
// ride your bow, and whales out on the course that blow, breach and sound with their flukes up. All picture: nothing
// here touches the race.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { waveHeight, clamp, lerp, wrap, KN } from './sim.js';
import { rigidSkin } from './skin.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const fwdX = (h) => Math.sin(h), fwdZ = (h) => -Math.cos(h); // a heading's way forward (as the boats steer)

// how many of each at each graphics level
const LEVEL = {
  high: { fly: 8, rest: 5, dolphins: 5, mist: 1 },
  medium: { fly: 6, rest: 4, dolphins: 4, mist: 0.7 },
  low: { fly: 4, rest: 3, dolphins: 3, mist: 0.4 },
};

// ---------- shapes ----------
// every part is painted with vertex colours and merged into one mesh per animal (and one per moving part of a gull)
function paint(g, fn) {
  if (!g.attributes.normal) g.computeVertexNormals(); // before unsharing the vertices, so a body stays smooth
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i), N.getY(i)); c.toArray(col, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const solid = (g, hex) => { const k = new THREE.Color(hex); return paint(g, (c) => c.copy(k)); };

// a body of revolution along z, nose at −z: keys are [s (0 nose … 1 tail), half-width, half-height, centre's lift],
// joined with a Catmull-Rom curve so the outline flows; the seam runs along the belly
function body(L, keys, NS, NA) {
  const at = (s) => {
    let i = 0; while (i < keys.length - 2 && keys[i + 1][0] < s) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, keys.length - 1)];
    const u = clamp((s - k1[0]) / (k2[0] - k1[0]), 0, 1), u2 = u * u, u3 = u2 * u;
    return [1, 2, 3].map((j) => 0.5 * (2 * k1[j] + (-k0[j] + k2[j]) * u + (2 * k0[j] - 5 * k1[j] + 4 * k2[j] - k3[j]) * u2 + (-k0[j] + 3 * k1[j] - 3 * k2[j] + k3[j]) * u3));
  };
  const pos = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, [rx, ry, yo] = at(s), z = -L / 2 + s * L;
    for (let j = 0; j <= NA; j++) { const a = -Math.PI / 2 + (j / NA) * 2 * Math.PI; pos.push(Math.cos(a) * Math.max(rx, 0.005), yo + Math.sin(a) * Math.max(ry, 0.005), z); }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return { g, at };
}
// a flat shape given some thickness, centred on its plane
function slab(pts, depth) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2);
}
const scalePts = (pts, k, sx = 1) => pts.map((p) => p.map((v, i) => v * k * (i % 2 === 0 ? sx : 1)));
// a dorsal fin in (along, up): drawn swept back, its trailing edge hollowed (falcate)
const DORSAL = [[0, 0], [0.12, 0.22, 0.3, 0.3], [0.26, 0.14, 0.38, 0]];
// flukes in (across, back), the notch in the middle
const FLUKES = [[0, -0.04], [0.18, -0.02, 0.3, 0.17], [0.16, 0.1, 0.03, 0.13], [0, 0.1], [-0.03, 0.13], [-0.16, 0.1, -0.3, 0.17], [-0.18, -0.02, 0, -0.04]];
const fin = (pts, k, depth) => slab(scalePts(pts, k), depth).rotateY(-Math.PI / 2); // along the body: drawing x → z
const flukes = (k, depth) => slab(scalePts(FLUKES, k), depth).rotateX(Math.PI / 2); // flat: drawing y → z (back)
// a flipper on side sx: drawn flat in (out, back), then drooped and swept back
function flipper(pts, k, depth, sx, droop, sweep) {
  return slab(scalePts(pts, k, sx), depth).rotateX(Math.PI / 2).rotateZ(-sx * droop).rotateY(-sx * sweep);
}

// a bottlenose dolphin, 2.5 m: dark grey back, paler flanks, a white belly
const DOLPHIN_L = 2.5;
function dolphinGeometry() {
  const L = DOLPHIN_L;
  const { g, at } = body(L, [[0, 0.02, 0.02, 0], [0.04, 0.04, 0.035, -0.015], [0.09, 0.065, 0.06, -0.02], [0.13, 0.13, 0.14, 0.02], [0.22, 0.19, 0.21, 0.02], [0.4, 0.22, 0.25, 0], [0.6, 0.17, 0.2, 0], [0.78, 0.09, 0.13, 0.01], [0.9, 0.04, 0.075, 0.01], [1, 0.015, 0.02, 0]], 36, 14);
  const top = new THREE.Color('#3c4752'), flank = new THREE.Color('#7a8692'), belly = new THREE.Color('#dde2e5');
  const parts = [paint(g, (c, x, y, z, ny) => (ny > 0.15 ? c.copy(flank).lerp(top, smooth(0.15, 0.65, ny)) : c.copy(flank).lerp(belly, smooth(0.15, -0.55, ny))))];
  const zAt = (s) => -L / 2 + s * L, topAt = (s) => { const [, ry, yo] = at(s); return ry + yo; };
  parts.push(solid(fin(DORSAL, 1, 0.035).translate(0, topAt(0.42) - 0.03, zAt(0.4)), '#3c4752'));
  parts.push(solid(flukes(1, 0.03).translate(0, 0, L / 2 - 0.1), '#424d58'));
  const PEC = [[0, 0], [0.12, 0.02, 0.26, 0.16], [0.1, 0.12, 0, 0.12]];
  for (const sx of [-1, 1]) parts.push(solid(flipper(PEC, 1, 0.025, sx, 0.6, 0.5).translate(sx * 0.15, -0.12, zAt(0.25)), '#4a5560'));
  return mergeGeometries(parts);
}

// a humpback, 13 m: near black above, grey below, long white flippers, flukes white underneath
const WHALE_L = 13;
const BLOWHOLE = new THREE.Vector3(0, 0.95, -WHALE_L / 2 + 0.2 * WHALE_L);
function whaleGeometry() {
  const L = WHALE_L;
  const { g, at } = body(L, [[0, 0.1, 0.08, 0.05], [0.04, 0.55, 0.32, 0], [0.12, 1.0, 0.72, -0.05], [0.28, 1.3, 1.2, -0.15], [0.45, 1.15, 1.1, 0], [0.62, 0.75, 0.82, 0.1], [0.78, 0.35, 0.5, 0.1], [0.9, 0.15, 0.3, 0.05], [1, 0.08, 0.1, 0]], 44, 18);
  const top = new THREE.Color('#1f2429'), belly = new THREE.Color('#8f969c');
  const parts = [paint(g, (c, x, y, z, ny) => c.copy(top).lerp(belly, smooth(-0.1, -0.75, ny)))];
  const zAt = (s) => -L / 2 + s * L, topAt = (s) => { const [, ry, yo] = at(s); return ry + yo; };
  parts.push(solid(fin([[0, 0], [0.5, 0.15, 0.75, 0.42], [0.8, 0.2, 1.15, 0]], 1, 0.18).translate(0, topAt(0.64) - 0.1, zAt(0.62)), '#1f2429'));
  const dark = new THREE.Color('#22272c'), white = new THREE.Color('#e4e6e3');
  parts.push(paint(flukes(7.3, 0.2).translate(0, 0.05, L / 2 - 0.35), (c, x, y, z, ny) => c.copy(ny < -0.5 ? white : dark)));
  const PEC = [[0, -0.2], [2, 0, 4, 0.9], [2, 0.75, 0, 0.7]];
  for (const sx of [-1, 1]) parts.push(paint(flipper(PEC, 1, 0.16, sx, 0.55, 0.5).translate(sx * 1.05, -0.55, zAt(0.27)), (c, x, y, z, ny) => c.copy(white).lerp(dark, ny > 0.5 ? 0.35 : 0)));
  return mergeGeometries(parts);
}

// a herring gull, 1.45 m across the wings: white, grey wings with black tips, a yellow bill. Each wing is two
// pieces (arm and hand) so it can flap with the hand lagging, glide in the gull's shallow M, and fold away
function gullGeometry() {
  const body = mergeGeometries([
    solid(new THREE.SphereGeometry(1, 10, 7).scale(0.085, 0.08, 0.25), '#f3f4f2'),
    solid(new THREE.SphereGeometry(0.058, 8, 6).translate(0, 0.045, -0.25), '#f6f7f5'),
    solid(new THREE.ConeGeometry(0.014, 0.075, 5).rotateX(-Math.PI / 2).translate(0, 0.035, -0.33), '#e3b23c'),
    solid(plane([[-0.05, 0.18], [0.05, 0.18], [0.07, 0.34], [-0.07, 0.34]]), '#eceeed'),
  ]);
  const grey = '#a9b2ba', black = '#1d2024';
  const arm = (sx) => solid(plane([[0, -0.07], [0, 0.11], [0.3, 0.08], [0.3, -0.065]], sx), grey);
  const hand = (sx) => mergeGeometries([solid(plane([[0, -0.065], [0, 0.08], [0.2, 0.05], [0.2, -0.05]], sx), grey), solid(plane([[0.2, -0.05], [0.2, 0.05], [0.38, 0.03]], sx), black)]);
  return { body, arm: [arm(-1), arm(1)], hand: [hand(-1), hand(1)] };
}
// a flat polygon in the x–z plane (x out to side sx, z back), as a fan
function plane(pts, sx = 1) {
  const pos = [];
  for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) pos.push(p[0] * sx, 0, p[1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// the tail end of a body flexes up and down: each vertex aft of s0 is lifted by `amount` × L × its share of the tail
function flex(m, base, L, s0, amount) {
  if (Math.abs(amount - (m.userData.flex ?? 1e9)) < 1e-4) return;
  m.userData.flex = amount;
  const P = m.geometry.attributes.position, A = P.array;
  for (let i = 0; i < A.length; i += 3) { const s = (base[i + 2] + L / 2) / L, w = s > s0 ? ((s - s0) / (1 - s0)) ** 2 : 0; A[i + 1] = base[i + 1] + amount * L * w; }
  P.needsUpdate = true;
}

// ---------- the whale's blow: a bushy column of mist that drifts off downwind ----------
const MIST_VS = /* glsl */ `
attribute float aA, aS; uniform float uScale; varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aA; gl_PointSize = aS * uScale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`;
const MIST_FS = /* glsl */ `
uniform sampler2D uMap; varying float vA;
void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(0.92, 0.94, 0.96, a); }`;
class Mist {
  constructor(scene, N = 240) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(N), 1));
    this.u = { uMap: { value: new THREE.CanvasTexture(c) }, uScale: { value: 400 } };
    this.pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 4;
    scene.add(this.pts);
    this.p = Array.from({ length: N }, () => ({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, age: 99, life: 1 }));
    this.i = 0;
  }
  puff(at, n) { // a blow from the blowhole at `at`
    for (let k = 0; k < n; k++) {
      const q = this.p[this.i]; this.i = (this.i + 1) % this.p.length;
      const a = Math.random() * 2 * Math.PI, r = Math.random() * 0.25;
      Object.assign(q, { x: at.x + Math.cos(a) * r, y: at.y, z: at.z + Math.sin(a) * r, vx: Math.cos(a) * rnd(0.3, 1.6), vz: Math.sin(a) * rnd(0.3, 1.6), vy: rnd(4.5, 9), age: -Math.random() * 0.35, life: rnd(2.6, 4.2) });
    }
  }
  update(dt, scale, wx, wz) {
    const g = this.pts.geometry.attributes, P = g.position, A = g.aA, S = g.aS, drag = Math.exp(-dt * 1.5);
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= 0 && q.age < q.life) {
        q.vx = q.vx * drag + wx * (1 - drag); q.vz = q.vz * drag + wz * (1 - drag); q.vy = q.vy * drag - 0.6 * dt; // the wind takes it
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      const live = q.age >= 0 && q.age < q.life, k = live ? q.age / q.life : 1;
      P.setXYZ(i, q.x, live ? q.y : -50, q.z);
      A.setX(i, live ? 0.75 * (1 - k) ** 1.3 * Math.min(1, q.age * 5) : 0);
      S.setX(i, lerp(0.9, 5, Math.sqrt(k)));
    }
    P.needsUpdate = A.needsUpdate = S.needsUpdate = true;
    this.u.uScale.value = scale;
  }
}

// ---------- a whale's dives: each a stretch of a few seconds with the body's depth, pitch, roll and tail flex ----------
// glide: just under, unseen. breath: the head breaks the surface, she blows, the back rolls through and she sinks.
// dive: one last breath, then she arches, tips her head down and her flukes rise clear and slide in.
// breach: she bursts up almost upright from deep and falls back on her side.
// Each one starts and ends at the glide's depth, so they chain without a jump.
const GLIDE = -3.4;
function whalePose(kind, u) {
  switch (kind) {
    case 'breath': return { d: GLIDE + 2.8 * Math.sin(Math.PI * u), p: 0.14 * Math.sin(2 * Math.PI * u), r: 0, b: -0.012 * Math.sin(Math.PI * u), s: 1.6 };
    case 'dive': {
      if (u < 0.4) { const q = u / 0.4; return { d: GLIDE + 2.8 * Math.sin((Math.PI / 2) * q), p: 0.12 * Math.sin(Math.PI * q), r: 0, b: 0, s: 1.8 }; }
      const v = (u - 0.4) / 0.6;
      return { d: -0.6 - 9 * smooth(0.08, 1, v) ** 1.3, p: -1.25 * smooth(0, 0.5, v), r: 0, b: 0.05 * Math.sin(Math.PI * Math.min(1, v * 1.4)), s: 2 };
    }
    case 'breach': {
      if (u < 0.35) { const q = u / 0.35; return { d: -12 + 14.2 * Math.sin((Math.PI / 2) * q), p: 1.3, r: 0, b: -0.02, s: 3 }; }
      if (u < 0.65) { const q = (u - 0.35) / 0.3, k = smooth(0, 1, q); return { d: lerp(2.2, -1.5, q * q), p: lerp(1.3, 0.15, k), r: 1.7 * k, b: 0.02, s: 2.5 }; }
      const q = (u - 0.65) / 0.35, k = smooth(0, 1, q);
      return { d: lerp(-1.5, GLIDE, k), p: lerp(0.15, 0, q), r: lerp(1.7, 0, k), b: 0, s: 2 };
    }
    default: return { d: GLIDE, p: 0, r: 0, b: 0, s: 1.6 };
  }
}
const SEG = { breath: 6, dive: 10, breach: 5 };

// ---------- all of them ----------
export class Wildlife {
  constructor(scene, splash) {
    this.scene = scene; this.splash = splash; // splash(x, z, n, up, size): foam on the sea (World)
    this.clock = 0; this.level = LEVEL.high;
    this.mist = new Mist(scene);
    const wet = (color) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, color }); // wet skin catches the sky

    // gulls
    const GULL_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0.8); // wings up, down or folded
    const G = gullGeometry(), gm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.gulls = Array.from({ length: LEVEL.high.fly + LEVEL.high.rest }, () => {
      // one draw a gull (skin.js): the body is the root bone, each wing a shoulder and a wrist bone
      const g = new THREE.Group(); g.rotation.order = 'YXZ';
      const body = new THREE.Bone(), bones = [body], parts = [[G.body, body]];
      const wings = [-1, 1].map((sx, i) => {
        const sh = new THREE.Bone(); sh.position.set(sx * 0.06, 0.02, -0.04); body.add(sh);
        const tip = new THREE.Bone(); tip.position.x = sx * 0.3; sh.add(tip);
        bones.push(sh, tip); parts.push([G.arm[i], sh], [G.hand[i], tip]);
        return { sx, sh, tip };
      });
      g.add(rigidSkin(parts, bones, body, gm, GULL_SPHERE));
      scene.add(g);
      return { g, wings, p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), roll: 0, fp: Math.random() * 6, flap: 0, flapT: 0, glide: 3, mode: 'fly' };
    });

    // dolphins: each its own copy of the shape, since each flexes its tail in its own time
    const dg = dolphinGeometry(), dm = wet('#ffffff');
    this.dolphins = Array.from({ length: LEVEL.high.dolphins }, () => {
      const m = new THREE.Mesh(dg.clone(), dm), g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(m);
      g.visible = false; scene.add(g);
      return { g, m, base: dg.attributes.position.array.slice(), x: 0, z: 0, h: 0, cyc: 0, T: 4, leap: false, above: false, k: Math.random() * 10 };
    });
    // whales: two, each keeping her own time
    const wg = whaleGeometry(), wmat = wet('#ffffff');
    this.whales = [0, 1].map(() => {
      const m = new THREE.Mesh(wg.clone(), wmat), g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(m);
      g.visible = false; scene.add(g);
      return { g, m, base: wg.attributes.position.array.slice(), x: 0, z: 0, h: 0, k: Math.random() * 10 };
    });
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3();
    // what the gulls do that can be heard, for the game to read and clear each frame (main.js, asides):
    // { type: 'call', p, n, alarm } a gull calling, n notes; { type: 'up', p, player } one put up off the water by a boat
    this.events = [];
  }
  emit(e) { if (this.events.length < 12) this.events.push(e); }

  // a lower level mid-race (Auto steps down) sends the spare gulls away; the pod comes smaller next time
  setLevel(q) {
    this.level = LEVEL[q] || LEVEL.high;
    const n = this.level.fly + this.level.rest;
    this.gulls.forEach((b, i) => { if (i >= n) { b.on = false; b.g.visible = false; } });
  }

  reset(race) {
    this.race = race; this.clock = 0; this.events.length = 0;
    const P = race.player, c = race.course, L = this.level;
    this.cx = P.x; this.cz = P.z;
    // gulls: some wheeling round you, a few sitting on the sea by the windward mark and the gate
    this.gulls.forEach((b, i) => {
      b.on = i < L.fly + L.rest;
      b.g.visible = b.on; b.callT = rnd(4, 30);
      if (i < L.fly) { this.orbit(b, i); const t = this.orbitAt(b); b.p.set(t.x, t.y, t.z); b.v.set(-Math.sin(b.ph), 0, Math.cos(b.ph)).multiplyScalar(b.spd * Math.sign(b.om)); b.mode = 'fly'; b.landT = rnd(30, 120); }
      else if (i < L.fly + L.rest) {
        const m = (i - L.fly) % 3 === 2 ? c.gate[0] : c.windward, a = rnd(0, 2 * Math.PI), r = rnd(25, 60);
        b.p.set(m.x + Math.cos(a) * r, 0, m.z + Math.sin(a) * r); b.v.set(0, 0, 0); b.mode = 'rest'; b.stay = true; b.yaw = race.wind.dir() + rnd(-0.4, 0.4);
      }
    });
    // they're rare: the pod turns up a few minutes in, if at all in a short race, and a whale later still
    this.pod = { state: 'away', timer: rnd(180, 480), n: L.dolphins, side: 1 };
    for (const d of this.dolphins) d.g.visible = false;
    this.whales.forEach((w, i) => { w.state = 'deep'; w.timer = i ? rnd(900, 1800) : rnd(240, 600); w.seq = []; w.g.visible = false; });
  }

  // a gull's circle round the boats: most close by and low, some wide and high
  orbit(b, i) {
    const far = i % 4 === 3;
    b.r = far ? rnd(60, 110) : rnd(14, 45); b.alt = far ? rnd(25, 45) : rnd(7, 22);
    b.spd = rnd(9, 12); b.om = (Math.random() < 0.5 ? -1 : 1) * (b.spd / b.r) * rnd(0.75, 1); b.ph = rnd(0, 2 * Math.PI); b.k = Math.random() * 10;
  }
  orbitAt(b) {
    const r = b.r * (1 + 0.25 * Math.sin(this.clock * 0.1 + b.k));
    return { x: this.cx + Math.cos(b.ph) * r, y: b.alt + 3 * Math.sin(this.clock * 0.21 + b.k * 5), z: this.cz + Math.sin(b.ph) * r };
  }
  nearestBoat(x, z) { let d = 1e9; for (const o of this.race.boats) d = Math.min(d, Math.hypot(o.x - x, o.z - z)); return d; }

  update(dt, t, W, cam, scale) {
    const race = this.race; if (!race) return;
    this.clock += dt;
    const P = race.player, windFrom = race.wind.dir(), tws = race.wind.p.tws * KN;
    // the flock's centre trails a little ahead of you
    const k = 1 - Math.exp(-dt * 0.6);
    this.cx += (P.x + fwdX(P.h) * 12 - this.cx) * k; this.cz += (P.z + fwdZ(P.h) * 12 - this.cz) * k;
    for (const b of this.gulls) if (b.on) this.gull(b, dt, t, W, P, windFrom, cam);
    this.updatePod(dt, t, W, P);
    for (const w of this.whales) this.whale(w, dt, t, W, P);
    this.mist.update(dt, scale, -fwdX(windFrom) * tws * 0.7, -fwdZ(windFrom) * tws * 0.7);
  }

  // ---------- gulls ----------
  gull(b, dt, t, W, P, windFrom, cam) {
    const { p, v, a } = b, sea = waveHeight(W, p.x, p.z, t);
    if (b.mode === 'rest') {
      p.y = sea + 0.02;
      b.yaw += wrap(windFrom - b.yaw) * (1 - Math.exp(-dt * 0.4)); // she sits head to wind
      b.g.position.copy(p); b.g.rotation.set(Math.sin(this.clock * 1.3 + b.fp) * 0.06, -b.yaw, Math.sin(this.clock * 1.1 + b.fp) * 0.05);
      this.wings(b, 0, 0, 1);
      // a boat coming close puts her up; one of the flock left far behind goes after you again
      const near = this.nearestBoat(p.x, p.z) < 28;
      if (near || (!b.stay && Math.hypot(P.x - p.x, P.z - p.z) > 300)) {
        if (near) { this.emit({ type: 'up', p, player: Math.hypot(P.x - p.x, P.z - p.z) < 28 }); this.emit({ type: 'call', p, n: 3, alarm: true }); } // up with a cry
        b.mode = 'fly'; b.stay = false; this.orbit(b, Math.floor(Math.random() * 4)); b.landT = rnd(50, 140);
        v.set(fwdX(b.yaw) * 4, 3.2, fwdZ(b.yaw) * 4); b.flapT = 2.5;
      }
      b.g.visible = p.distanceTo(cam.position) < 900;
      return;
    }
    // now and then she calls: a long cry, or a few laughing notes
    b.callT -= dt;
    if (b.callT <= 0) { b.callT = rnd(10, 40); this.emit({ type: 'call', p, n: 1 + Math.floor(Math.random() * 4), alarm: false }); }
    let tx, ty, tz, spd;
    if (b.mode === 'fly') {
      b.ph += b.om * dt;
      const o = this.orbitAt(b); tx = o.x; ty = o.y; tz = o.z; spd = b.spd;
      b.landT -= dt;
      if (b.landT <= 0 && P.v > 1) { // now and then one goes down on the water ahead of you
        const s = Math.random() < 0.5 ? -1 : 1, D = rnd(80, 140), S = s * rnd(15, 40);
        b.lx = P.x + fwdX(P.h) * D + Math.cos(P.h) * S; b.lz = P.z + fwdZ(P.h) * D + Math.sin(P.h) * S; b.mode = 'land';
      }
    } else { // landing
      tx = b.lx; tz = b.lz; ty = waveHeight(W, tx, tz, t) + 0.2;
      spd = clamp(Math.hypot(tx - p.x, tz - p.z) * 0.3, 2.5, b.spd);
      if (this.nearestBoat(tx, tz) < 30) { b.mode = 'fly'; b.landT = rnd(30, 90); } // the boats got there first
    }
    const d = this._d.set(tx - p.x, ty - p.y, tz - p.z), dist = d.length();
    d.multiplyScalar(spd / Math.max(dist, 1e-3));
    a.subVectors(d, v).multiplyScalar(1.3); if (a.length() > 7) a.setLength(7);
    v.addScaledVector(a, dt);
    const sp = v.length(); if (b.mode === 'fly' && sp < 5) v.setLength(5); if (sp > 15) v.setLength(15);
    p.addScaledVector(v, dt);
    if (b.mode === 'fly' && p.y < sea + 1.5) { p.y = sea + 1.5; v.y = Math.max(v.y, 0); }
    // touching down
    const hd = Math.hypot(b.mode === 'land' ? b.lx - p.x : 1e3, b.mode === 'land' ? b.lz - p.z : 1e3);
    if (b.mode === 'land' && hd < 1.5 && p.y - sea < 0.7) { b.mode = 'rest'; b.yaw = Math.atan2(v.x, -v.z); v.set(0, 0, 0); return; }
    // she leans into her turns and climbs nose up
    const hs = Math.hypot(v.x, v.z), h = Math.atan2(v.x, -v.z), lat = a.x * Math.cos(h) + a.z * Math.sin(h);
    b.roll += (clamp(-Math.atan(lat / 9.81) * 1.6, -1, 1) - b.roll) * (1 - Math.exp(-dt * 3));
    const flare = b.mode === 'land' && hd < 8;
    b.g.position.copy(p);
    b.g.rotation.set(Math.atan2(v.y, hs) * 0.8 + (flare ? 0.45 : 0), -h, b.roll);
    // flapping in bouts, gliding between; always when climbing hard or slow
    b.flapT -= dt;
    if (b.flapT < -b.glide) { b.flapT = rnd(0.8, 2.8); b.glide = rnd(2, 8); }
    const want = v.y > 0.8 || hs < 7 || b.flapT > 0 ? 1 : 0;
    b.flap += (want - b.flap) * (1 - Math.exp(-dt * 5));
    b.fp += dt * 2 * Math.PI * (flare ? 4.5 : 2.9);
    if (flare) this.wings(b, 0.75 + 0.2 * Math.sin(b.fp), 0.15 * Math.sin(b.fp - 0.9), 0);
    else this.wings(b, lerp(0.1, 0.12 + 0.6 * Math.sin(b.fp), b.flap), lerp(-0.18, 0.3 * Math.sin(b.fp - 0.9), b.flap), 0);
    b.g.visible = p.distanceTo(cam.position) < 900;
  }
  // arm angle (up), hand angle relative to the arm, and how far the wings are folded away (0 … 1)
  wings(b, arm, hand, fold) {
    for (const { sx, sh, tip } of b.wings) {
      sh.rotation.set(0, -sx * 1.4 * fold, sx * lerp(arm, 0.3, fold));
      tip.rotation.set(0, sx * 0.3 * fold, sx * hand * (1 - fold));
      tip.scale.x = 1 - 0.4 * fold;
    }
  }

  // ---------- the dolphins ----------
  // They come in from one side, take station at your bow and either side of it — surfacing to breathe in short
  // arcs, now and then leaping clear — then drop astern and go. Each swims at most 8.5 m/s, so when you turn they
  // swing round with you rather than being dragged.
  updatePod(dt, t, W, P) {
    const pod = this.pod, SLOTS = [[8, -1.2], [7, 1.7], [4, -3.3], [2.5, 3.5], [10.5, 0.4]];
    pod.timer -= dt;
    if (pod.state === 'away') {
      if (pod.timer > 0) return;
      pod.state = 'come'; pod.side = Math.random() < 0.5 ? -1 : 1; pod.n = this.level.dolphins;
      this.dolphins.forEach((d, i) => {
        const a = 30 + i * 3, c = pod.side * (80 + i * 4);
        d.x = P.x + fwdX(P.h) * a + Math.cos(P.h) * c; d.z = P.z + fwdZ(P.h) * a + Math.sin(P.h) * c;
        d.h = Math.atan2(P.x - d.x, -(P.z - d.z)); d.cyc = Math.random(); d.T = rnd(2.5, 4); d.above = false;
        d.slot = SLOTS[i % SLOTS.length]; d.g.visible = i < pod.n;
      });
    }
    if (pod.state === 'ride' && pod.timer <= 0) pod.state = 'go';
    const fx = fwdX(P.h), fz = fwdZ(P.h), rx = Math.cos(P.h), rz = Math.sin(P.h);
    let arrived = 0, gone = 0;
    for (let i = 0; i < pod.n; i++) {
      const d = this.dolphins[i];
      let a, c;
      if (pod.state === 'go') { a = -70; c = pod.side * 90 + d.slot[1] * 3; }
      else { a = d.slot[0] + Math.sin(this.clock * 0.27 + d.k) * 1.2; c = d.slot[1] + Math.sin(this.clock * 0.19 + d.k * 3) * 0.8; }
      const tx = P.x + fx * a + rx * c, tz = P.z + fz * a + rz * c;
      let vx = fx * P.v + (tx - d.x) * 0.6, vz = fz * P.v + (tz - d.z) * 0.6;
      const sp = Math.hypot(vx, vz); if (sp > 8.5) { vx *= 8.5 / sp; vz *= 8.5 / sp; }
      d.x += vx * dt; d.z += vz * dt;
      if (sp > 0.3) d.h += wrap(Math.atan2(vx, -vz) - d.h) * (1 - Math.exp(-dt * 4));
      if (Math.hypot(tx - d.x, tz - d.z) < 6) arrived++;
      // breathing: most of each cycle just under the surface, then a short arc up through it
      d.cyc += dt / d.T;
      if (d.cyc >= 1) { d.cyc -= 1; d.T = pod.state === 'ride' ? rnd(3, 5.5) : rnd(2, 3.2); d.leap = Math.random() < (pod.state === 'ride' ? 0.08 : 0.22); }
      const ARC = 0.26, u = d.cyc;
      let depth = -1.7, dd = 0;
      if (u > 1 - ARC) {
        const q = (u - (1 - ARC)) / ARC, pk = d.leap ? 1.1 : 0.03;
        depth = -1.7 + (1.7 + pk) * Math.sin(Math.PI * q); dd = ((1.7 + pk) * Math.PI * Math.cos(Math.PI * q)) / (ARC * d.T);
      }
      const above = depth > -0.2;
      if (above !== d.above && d.g.visible) this.splash(d.x + fwdX(d.h) * (above ? -0.9 : 0.6), d.z + fwdZ(d.h) * (above ? -0.9 : 0.6), d.leap ? 12 : 4, d.leap ? 3 : 0, d.leap ? 0.8 : 0.55);
      d.above = above;
      if (pod.state === 'go' && Math.hypot(P.x - d.x, P.z - d.z) > 90 && depth < -1.2) gone++;
      const spd = Math.max(Math.hypot(vx, vz), 1.5);
      d.g.position.set(d.x, waveHeight(W, d.x, d.z, t) + depth, d.z);
      d.g.rotation.set(clamp(Math.atan2(dd, spd), -1, 1), -d.h, Math.sin(this.clock * 0.7 + d.k) * 0.1);
      if (d.g.visible) flex(d.m, d.base, DOLPHIN_L, 0.45, 0.035 * Math.sin(this.clock * 2 * Math.PI * (1.2 + spd * 0.25) + d.k)); // the tail stroke
    }
    if (pod.state === 'come' && arrived === pod.n) { pod.state = 'ride'; pod.timer = rnd(40, 70); }
    if (pod.state === 'come' && pod.timer < -60) pod.state = 'go'; // couldn't catch you
    if (pod.state === 'go' && gone === pod.n) { pod.state = 'away'; pod.timer = rnd(480, 900); for (const d of this.dolphins) d.g.visible = false; }
  }

  // ---------- the whales ----------
  whale(w, dt, t, W, P) {
    if (w.state === 'deep') {
      w.timer -= dt;
      if (w.timer > 0 || !this.place(w, P)) return;
      w.state = 'up'; w.g.visible = true;
      // a breach, sometimes, to start; then three to five breaths, and down she goes
      w.seq = Math.random() < 0.15 ? ['breach', ['glide', rnd(6, 9)]] : [['glide', 3]];
      for (let n = Math.floor(rnd(3, 6)), i = 0; i < n; i++) w.seq.push('breath', ['glide', rnd(7, 12)]);
      w.seq.push('dive');
      w.seq = w.seq.map((s) => (Array.isArray(s) ? { kind: s[0], dur: s[1] } : { kind: s, dur: SEG[s] }));
      w.u = 0;
    }
    const seg = w.seq[0], u0 = w.u;
    w.u += dt / seg.dur;
    // a boat closing on her sends her down after this breath
    if (seg.kind !== 'breach' && seg.kind !== 'dive' && w.seq[w.seq.length - 1].kind === 'dive' && w.seq.length > 2 && this.nearestBoat(w.x, w.z) < 70) w.seq = [seg, { kind: 'dive', dur: SEG.dive }];
    const pose = whalePose(seg.kind, Math.min(w.u, 1));
    w.h += Math.sin(this.clock * 0.05 + w.k) * 0.03 * dt;
    w.x += fwdX(w.h) * pose.s * dt; w.z += fwdZ(w.h) * pose.s * dt;
    w.g.position.set(w.x, waveHeight(W, w.x, w.z, t) * 0.5 + pose.d, w.z);
    w.g.rotation.set(pose.p, -w.h, pose.r);
    flex(w.m, w.base, WHALE_L, 0.5, pose.b + 0.006 * Math.sin(this.clock * 0.9 + w.k));
    // what happens on the way: the blow, the wash as she breaks the surface, the splash as she falls back
    const at = (x) => u0 < x && w.u >= x;
    const fx = fwdX(w.h), fz = fwdZ(w.h);
    if ((seg.kind === 'breath' && at(0.3)) || (seg.kind === 'dive' && at(0.22))) {
      w.g.updateMatrixWorld(true);
      this.mist.puff(this._v.copy(BLOWHOLE).applyMatrix4(w.g.matrixWorld), Math.round(70 * this.level.mist));
      this.splash(w.x + fx * -3.5, w.z + fz * -3.5, 8, 0, 2);
    }
    if (seg.kind === 'dive' && at(0.86)) this.splash(w.x + fx * 4, w.z + fz * 4, 18, 1.5, 1.6); // the flukes slip in
    if (seg.kind === 'breach' && at(0.17)) this.splash(w.x, w.z, 30, 6, 2.2);
    if (seg.kind === 'breach' && at(0.6)) { this.splash(w.x, w.z, 90, 0, 3.6); this.splash(w.x, w.z, 60, 7, 2.6); }
    if (w.u >= 1) {
      w.seq.shift(); w.u = 0;
      if (!w.seq.length) { w.state = 'deep'; w.timer = rnd(600, 1200); w.g.visible = false; }
    }
  }
  // somewhere ahead of you and off to one side, 150–380 m away and well clear of every boat, swimming across
  place(w, P) {
    for (let i = 0; i < 12; i++) {
      const b = P.h + rnd(-1.2, 1.2), r = rnd(150, 380), x = P.x + fwdX(b) * r, z = P.z + fwdZ(b) * r;
      if (this.nearestBoat(x, z) < 120) continue;
      w.x = x; w.z = z; w.h = b + (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2 + rnd(-0.5, 0.5);
      return true;
    }
    w.timer = 10; return false;
  }
}
