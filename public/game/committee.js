// Regatta: the committee boat — a 13 m motor cruiser lying to her anchor, head to wind, at the starboard end of the
// line. The race officers run the start from her: the signal flags go up and down halyards on the yardarm of her
// signal mast, the orange flag on a staff marks her end of the line, and an officer on the side deck sights along the
// line to the pin.
//
// She is finished as the yachts are (yacht.js): her hull, deckhouse, hardtop and console moulded in Blender
// (blender/committee.py → committee.glb), the hull under yacht.js's lacquer with its boot-top, antifouling and the
// sea's wet line on it, the gelcoat clear-coated, the decks moulded non-skid with the shade baked in where the
// deckhouse stands on them, the aft deck and the swim platform teak, and her fittings in stainless.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './sim.js';
import { sailor, onWatch, hullMaterial, NONSKID, deckFinish, cleat, wheel, foldStill, M as YM } from './yacht.js';

const L = 13, B = 4.3, DRAFT = 0.85;
export const COMMITTEE_L = L;
const BOTTOM = '#7d2b28'; // her antifouling
export const COMMITTEE_BOTTOM = BOTTOM;
const FLY = 3.3; // the flybridge floor
const Y0 = -1.2, Y1 = 2.2; // the hull's paint is a strip of colour by height, from Y0 to Y1

// code flags drawn on a canvas
export function flagTexture(k) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const x = c.getContext('2d');
  if (k === 'P') { x.fillStyle = '#1f4fa8'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#fff'; x.fillRect(30, 20, 36, 24); }
  else if (k === 'U') { x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#d22'; x.fillRect(0, 0, 48, 32); x.fillRect(48, 32, 48, 32); }
  else if (k === 'B') { x.fillStyle = '#111'; x.fillRect(0, 0, 96, 64); }
  else if (k === 'I') { x.fillStyle = '#f2c230'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#111'; x.beginPath(); x.arc(48, 32, 17, 0, Math.PI * 2); x.fill(); } // India: a black disc on yellow
  else if (k === 'sub') { x.fillStyle = '#1f4fa8'; x.beginPath(); x.moveTo(0, 0); x.lineTo(96, 32); x.lineTo(0, 64); x.fill(); x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(8, 12); x.lineTo(70, 32); x.lineTo(8, 52); x.fill(); } // the first substitute
  else if (k === 'X') { x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#1f4fa8'; x.fillRect(40, 0, 16, 64); x.fillRect(0, 24, 96, 16); }
  else if (k === 'blue') { x.fillStyle = '#1f4fa8'; x.fillRect(0, 0, 96, 64); } // the finish boat's: on station at the finish
  else if (k === 'orange') { x.fillStyle = '#ff6a10'; x.fillRect(0, 0, 96, 64); }
  else if (k === 'burgee') { x.fillStyle = '#1d3557'; x.beginPath(); x.moveTo(0, 0); x.lineTo(96, 32); x.lineTo(0, 64); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 24); x.lineTo(72, 32); x.lineTo(0, 40); x.fill(); }
  else { x.fillStyle = '#f2c230'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#111'; x.font = '900 40px Carlito, Lato, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('R', 48, 34); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the hull's paint by height: antifouling, a navy boot stripe at the waterline, white topsides
function paintTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const x = c.getContext('2d'), py = (y) => 512 - ((y - Y0) / (Y1 - Y0)) * 512;
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 4, 512);
  x.fillStyle = '#1d3557'; x.fillRect(0, py(0.16), 4, py(-0.02) - py(0.16));
  x.fillStyle = '#7d2b28'; x.fillRect(0, py(-0.02), 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function bannerTexture(text = 'RACE COMMITTEE') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 88;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 88);
  x.fillStyle = '#1d3557'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 78, 512, 10);
  x.font = '900 46px Carlito, Lato, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- the hull ----------
// stations from the transom (t = 0) to the stem (t = 1): the sheer rising forward, a hard chine that lifts and pulls in
// towards a flared bow, a deep-vee bottom and a raked stem
function station(t) {
  const hb = (B / 2) * (t < 0.5 ? 0.88 + 0.12 * Math.sin((t / 0.5) * Math.PI / 2) : Math.cos(((t - 0.5) / 0.5) * Math.PI / 2) ** 0.7);
  const d = DRAFT * (t < 0.55 ? 0.72 + 0.28 * Math.sin((t / 0.55) * Math.PI / 2) : Math.cos(((t - 0.55) / 0.45) * Math.PI / 2) ** 0.8);
  return { hb, sy: 1.2 + 0.62 * t ** 2.2, d, hc: hb * (0.95 - 0.25 * t), yc: lerp(-0.1, 0.5, t ** 1.6), z: L / 2 - t * L, rake: 1.7 * clamp((t - 0.7) / 0.3, 0, 1) ** 2 };
}
const deckY = (z) => station((L / 2 - z) / L).sy;
const halfB = (z) => station((L / 2 - z) / L).hb;

function hullGeometry() {
  const N = 40, KT = 5, KB = 7, parts = [];
  // a section's points on one side, from the deck edge down to the chine (topsides) or the chine to the keel (bottom)
  const pt = (s, side, part, j) => {
    let x, y;
    if (part === 0) { const u = j / KT; x = lerp(s.hb, s.hc, u) + 0.05 * Math.sin(Math.PI * u) * (s.hb / (B / 2)); y = lerp(s.sy, s.yc, u); }
    else { const u = j / KB; x = lerp(s.hc, 0, u); y = lerp(s.yc, -s.d, u) - 0.06 * Math.sin(Math.PI * u) * (s.hc / (B / 2)); }
    return [side * x, y, s.z + s.rake * (s.sy - y) / (s.sy + s.d + 1e-3)];
  };
  for (const side of [-1, 1]) for (const part of [0, 1]) {
    const K = part ? KB : KT, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const s = station(i / N);
      for (let j = 0; j <= K; j++) { const p = pt(s, side, part, j); pos.push(...p); uv.push(i / N, (p[1] - Y0) / (Y1 - Y0)); }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < K; j++) { const a = i * (K + 1) + j, b = a + 1, c = a + K + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); parts.push(g);
  }
  // the transom: a fan across the stern section
  const s0 = station(0), ring = [];
  for (let j = 0; j <= KT; j++) ring.push(pt(s0, 1, 0, j));
  for (let j = 1; j <= KB; j++) ring.push(pt(s0, 1, 1, j));
  for (let j = KB - 1; j >= 0; j--) ring.push(pt(s0, -1, 1, j));
  for (let j = KT - 1; j >= 0; j--) ring.push(pt(s0, -1, 0, j));
  const tp = [0, (s0.sy - s0.d) / 2, s0.z], tpos = [...tp], tuv = [0, (tp[1] - Y0) / (Y1 - Y0)], tidx = [];
  ring.forEach((p, i) => { tpos.push(...p); tuv.push(0, (p[1] - Y0) / (Y1 - Y0)); if (i) tidx.push(0, i, i + 1); });
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
  tg.setIndex(tidx); tg.computeVertexNormals(); parts.push(tg);
  const hull = mergeGeometries(parts);
  // the deck, across the sheer
  const dp = [], di = [];
  for (let i = 0; i <= N; i++) { const s = station(i / N); dp.push(-s.hb, s.sy, s.z, s.hb, s.sy, s.z); }
  for (let i = 0; i < N; i++) { const a = i * 2; di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); deck.setIndex(di); deck.computeVertexNormals();
  return { hull, deck };
}

// her moulded parts, by material name (blender/committee.py), by the address the import map gives the file (its hash
// after a deploy, as yacht.js's yacht.glb); the hull's paint bands (its depth under the sheer) and the plan-in-metres
// UVs of what takes a texture. If it doesn't come in 8 s she is built from the lines above in code instead.
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
const MODEL = await new Promise((res) => {
  const done = (v) => { clearTimeout(timer); res(v); }, timer = setTimeout(() => res(null), 8000);
  new GLTFLoader().load(fileAt('committee.glb'), (g) => {
    const parts = {};
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) parts[o.material.name] = o.geometry.clone().applyMatrix4(o.matrixWorld); });
    const p = parts.hull?.attributes.position;
    if (!p || !parts.deck) return done(null);
    const band = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) band[i] = deckY(p.getZ(i)) - p.getY(i);
    parts.hull.setAttribute('band', new THREE.BufferAttribute(band, 1));
    for (const k of ['deck', 'teak', 'roof']) {
      const q = parts[k]?.attributes.position; if (!q) continue;
      const uv = new Float32Array(q.count * 2);
      for (let i = 0; i < q.count; i++) { uv[2 * i] = q.getX(i); uv[2 * i + 1] = -q.getZ(i); }
      parts[k].setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    done(parts);
  }, undefined, () => done(null));
});

// the shade baked into her decks, in plan: soft and dark round the deckhouse's foot and in along the rail, as
// yacht.js's deck has it. Metres to pixels; each shape is drawn off the canvas and only its blurred shadow lands on it
const AO_W = 4.6, AO_L = 15, AO_S = 32;
let deckAO = null;
function deckShade() {
  if (deckAO) return deckAO;
  const c = document.createElement('canvas'); c.width = AO_W * AO_S; c.height = AO_L * AO_S;
  const x = c.getContext('2d'), X = (v) => (v + AO_W / 2) * AO_S, Y = (z) => (z + AO_L / 2) * AO_S;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const soft = (path, blur, alpha, stroke = 0) => {
    x.save(); x.shadowColor = `rgba(0,0,0,${alpha})`; x.shadowBlur = blur * AO_S; x.shadowOffsetX = 4000; x.translate(-4000, 0);
    x.beginPath(); path(); if (stroke) { x.lineWidth = stroke * AO_S; x.strokeStyle = '#000'; x.stroke(); } else { x.fillStyle = '#000'; x.fill(); }
    x.restore();
  };
  // the deckhouse's foot (blender/committee.py's dh_outline at its foot): the nose rounded, the sides out to the aft face
  const foot = [];
  for (let i = 0; i <= 12; i++) { const ph = (Math.PI / 2) * (1 - i / 12); foot.push([1.42 * Math.cos(ph) ** (2 / 2.6), -1.7 + (1 - Math.sin(ph) ** (2 / 2.6))]); }
  foot.push([1.55, 2.4]);
  soft(() => { foot.forEach(([fx, fz], i) => x[i ? 'lineTo' : 'moveTo'](X(fx + 0.03), Y(fz - 0.03))); for (let i = foot.length - 1; i >= 0; i--) x.lineTo(X(-foot[i][0] - 0.03), Y(foot[i][1] - 0.03)); x.closePath(); }, 0.32, 0.6);
  soft(() => { for (let i = 0; i <= 40; i++) { const t = i / 40, s = station(t); x[i ? 'lineTo' : 'moveTo'](X(s.hb - 0.02), Y(s.z)); }
    for (let i = 40; i >= 0; i--) { const t = i / 40, s = station(t); x.lineTo(X(-(s.hb - 0.02)), Y(s.z)); } }, 0.12, 0.4, 0.05);
  soft(() => { for (const sx of [-1, 1]) { x.moveTo(X(sx * 1.42 + 0.07), Y(4.4)); x.arc(X(sx * 1.42), Y(4.4), 0.07 * AO_S, 0, Math.PI * 2); } }, 0.12, 0.6); // the hardtop's posts
  const t = new THREE.CanvasTexture(c);
  t.repeat.set(1 / AO_W, 1 / AO_L); t.offset.set(0.5, 0.5); // the deck's UVs are its plan in metres (x, −z)
  return (deckAO = t);
}
function shaded(m) { // the baked shade dims the sunlit deck a little too, not only the sky's light
  m.aoMap = deckShade(); m.aoMapIntensity = 1;
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, 0.45);'); };
  m.customProgramCacheKey = () => 'cbDeck';
  return m;
}
// one set of her finishes for every committee boat (and the jury's): her hull's paint is made per boat (its wet line's
// speed is hers)
let FIN = null;
export function finishes() {
  return FIN ||= {
    deck: shaded(new THREE.MeshStandardMaterial({ map: NONSKID, color: '#ffffff', roughness: 0.85 })),
    teak: shaded(deckFinish({ deck: 'teak' }, null).clone()),
    roof: new THREE.MeshStandardMaterial({ map: NONSKID, color: '#ffffff', roughness: 0.85 }),
    // gelcoat under a clear coat: the deckhouse and the hardtop show their curves by the sky they mirror
    gel: new THREE.MeshPhysicalMaterial({ color: '#f3f3ef', roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.9 }),
    // tinted glass, the sky in it
    glass: new THREE.MeshPhysicalMaterial({ color: '#1c252d', roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 }),
    steel: YM.steel, bronze: new THREE.MeshStandardMaterial({ color: '#b08a4e', roughness: 0.3, metalness: 1 }),
    fender: new THREE.MeshPhysicalMaterial({ color: '#1d3557', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    cushion: new THREE.MeshStandardMaterial({ color: '#eceae3', roughness: 0.75 }),
    rope: new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.9 }),
  };
}

// a box with its edges and corners rounded to r, centred on the origin: a rounded rectangle extruded, bevelled round
export function RoundedBoxGeometry(w, h, d, seg = 3, r = 0.05) {
  const e = 0.002, a = w / 2 - r - e, b = d / 2 - r - e, s = new THREE.Shape(); // the bevel rounds its corners in plan too
  s.absarc(a, -b, e, -Math.PI / 2, 0); s.absarc(a, b, e, 0, Math.PI / 2); s.absarc(-a, b, e, Math.PI / 2, Math.PI); s.absarc(-a, -b, e, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: seg, curveSegments: 4 });
  return g.rotateX(-Math.PI / 2).translate(0, -(h - 2 * r) / 2, 0);
}

// a six-sided block whose plan (front and aft z, half-breadths) changes linearly from its foot to its top: the
// deckhouse with its raked windscreen and tumblehome sides
function block(lo, hi, yLo, yHi, out = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = p.getY(i) > 0 ? hi : lo, front = p.getZ(i) < 0;
    p.setXYZ(i, Math.sign(p.getX(i)) * ((front ? f.wf : f.wa) + out), p.getY(i) > 0 ? yHi : yLo, (front ? f.f - out : f.a + out));
  }
  g.computeVertexNormals();
  return g;
}

export const tube = (pts, r, closed = false, seg = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.3), Math.max(8, pts.length * 4), r, seg, closed);
export const rod = (a, b, r, seg = 6) => { // a cylinder from point a to point b
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), len = A.distanceTo(Bv);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()));
  return g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
};

// ---------- a flag ----------
// a cloth hoisted by its luff, flying downwind and rippling: the waves run from the hoist to the fly and grow there
const FLAG_SEG = 10;
export class Flag {
  constructor(tex, w, h, pennant = false) {
    this.w = w; this.h = h;
    const g = new THREE.PlaneGeometry(w, h, FLAG_SEG, 3).rotateY(-Math.PI / 2).translate(0, -h / 2, w / 2);
    this.base = Float32Array.from(g.attributes.position.array);
    this.mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, alphaTest: pennant ? 0.5 : 0, transparent: false });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.pivot = new THREE.Group(); this.pivot.add(this.mesh);
    this.phase = Math.random() * 6;
  }
  update(t, yaw, wind) { // yaw: which way downwind is, in the boat; wind: m/s
    if (!this.pivot.visible) return;
    this.pivot.rotation.y = yaw + Math.sin(t * 1.3 + this.phase) * 0.12;
    const p = this.mesh.geometry.attributes.position, b = this.base, w = this.w;
    const amp = clamp(0.05 + wind * 0.012, 0.05, 0.16) * w, k = 7 / w, om = 4 + wind * 0.6;
    for (let i = 0; i < p.count; i++) {
      const z = Math.max(0, b[i * 3 + 2]), y = b[i * 3 + 1], f = (z / w) ** 1.3;
      p.setX(i, amp * f * Math.sin(k * z - om * t + this.phase + y * 1.5));
      p.setZ(i, z * (1 - 0.05 * f));
    }
    p.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
}

// ---------- the race officers ----------
const SKINS = ['#c99272', '#e2b291', '#a36d4c', '#d8a27e', '#b98063'];
export function officer(i, jacketColor, pose) {
  const m = {
    jacket: new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.8 }),
    trousers: new THREE.MeshStandardMaterial({ color: i % 2 ? '#d8cfb8' : '#2b2f38', roughness: 0.85 }),
    vest: new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.55 }),
    cap: new THREE.MeshStandardMaterial({ color: i % 3 ? '#f0efe9' : '#1d3557', roughness: 0.75 }),
    skin: new THREE.MeshStandardMaterial({ color: SKINS[i % SKINS.length], roughness: 0.65 }),
  };
  const s = sailor(m);
  s.g.scale.setScalar(1.1);
  const [aL, aR] = s.arms; // aL on the -z side, aR on the +z side (the sailor faces +x)
  if (pose === 'glasses') { // binoculars to the eyes
    aL.rotation.set(0.62, 0, 1.6); aR.rotation.set(-0.62, 0, 1.6);
    const bino = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.15), new THREE.MeshStandardMaterial({ color: '#1b1d21', roughness: 0.5 }));
    bino.position.set(0.36, 0.69, 0); s.upper.add(bino);
  } else if (pose === 'halyard') { // one hand up on a halyard, the other pulling down
    aR.rotation.set(-0.2, 0, 2.7); aL.rotation.set(0.15, 0, 0.5);
  } else if (pose === 'horn') { // a horn held up, ready for the next signal
    aR.rotation.set(-0.3, 0, 1.3);
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.32, 10).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d4252b', roughness: 0.4 }));
    horn.position.set(0.42, 0.5, 0.12); s.upper.add(horn);
  } else if (pose === 'wheel') { // both hands on the wheel in front of him
    aL.rotation.set(0.3, 0, 1.15); aR.rotation.set(-0.3, 0, 1.15);
  } else if (pose === 'board') { // a clipboard: the times and the sail numbers
    aL.rotation.set(0.35, 0, 0.9); aR.rotation.set(-0.35, 0, 0.9);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.8 }));
    board.position.set(0.3, 0.32, 0); board.rotation.z = -0.7; s.upper.add(board);
  }
  return s;
}

// ---------- the boat ----------
export class CommitteeBoat {
  // side: +1 if the pin lies off her starboard side, −1 to port; lineZ: where along her the line meets her (local z).
  // underway: a sister ship out on the water instead (the jury's, say), with her own banner: no anchor, no signals,
  // no orange flag, and a helmsman at the wheel on the flybridge
  constructor(side = 1, lineZ = 0, { underway = false, banner } = {}) {
    const root = this.root = new THREE.Group();
    this.fresh = true; // the first update shows the flags as they are, without hoisting them
    root.rotation.order = 'YXZ'; // heading, then pitch and roll on the swell
    const M = {
      hull: new THREE.MeshStandardMaterial({ map: paintTexture(), roughness: 0.3, envMapIntensity: 0.8, side: THREE.DoubleSide }),
      gel: new THREE.MeshStandardMaterial({ color: '#f3f3ef', roughness: 0.32, envMapIntensity: 0.8 }),
      deck: new THREE.MeshStandardMaterial({ color: '#dcd5c2', roughness: 0.85, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ color: '#25303a', roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4 }),
      steel: new THREE.MeshStandardMaterial({ color: '#d9dde1', roughness: 0.25, metalness: 1, envMapIntensity: 1 }),
      navy: new THREE.MeshStandardMaterial({ color: '#1d3557', roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: '#23272d', roughness: 0.6 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ff6a10', roughness: 0.55 }),
      teak: new THREE.MeshStandardMaterial({ color: '#a8804f', roughness: 0.75 }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTexture(banner), roughness: 0.8, side: THREE.DoubleSide }),
    };
    const F = finishes();
    Object.assign(M, { wood: YM.teak, deck: F.deck, teak: F.teak, roof: F.roof, gel: F.gel, glass: F.glass, bronze: F.bronze, fender: F.fender, cushion: F.cushion, rope: F.rope });
    const bin = {}; // static parts, merged per material
    const put = (k, g) => (bin[k] ||= []).push(g);
    const lines = [];

    const lo = { f: -1.7, a: 2.4, wf: 1.42, wa: 1.55 }, hi = { f: -0.75, a: 2.3, wf: 1.22, wa: 1.42 };
    const topF = hi.f - 0.2, topA = 4.6, topW = 1.62, r = 0.55;
    const conZ = topF + 0.75;
    if (MODEL) {
      // the moulded hull, deck, deckhouse, hardtop, console and swim platform; the hull in yacht.js's paint, her wet
      // line her own (this.sea: the jury's boat runs)
      const hm = hullMaterial('#f4f4f0', '#1d3557', BOTTOM);
      this.sea = hm.userData.sea; this.sea.uHalfL.value = L / 2;
      root.add(new THREE.Mesh(MODEL.hull, hm));
      for (const k of ['deck', 'teak', 'roof', 'gel', 'glass']) if (MODEL[k]) root.add(new THREE.Mesh(MODEL[k], M[k]));
      // the glass door into the deckhouse from the aft deck, in its stainless frame
      put('glass', new THREE.BoxGeometry(0.9, 1.62, 0.05).translate(0, deckY(lo.a) + 0.84, lo.a - 0.04));
      put('steel', new THREE.BoxGeometry(0.98, 1.7, 0.03).translate(0, deckY(lo.a) + 0.85, lo.a - 0.05));
      put('steel', rod([0.36, deckY(lo.a) + 0.8, lo.a + 0.01], [0.36, deckY(lo.a) + 1.1, lo.a + 0.01], 0.012, 6)); // its handle
      // on the flybridge console: its screens set into the dash, a small wheel, the throttles and a smoked windscreen
      const dash = (z) => FLY + 0.78 + 0.22 * clamp((conZ + 0.3 - z) / 0.6, 0, 1), slope = Math.atan2(0.22, 0.6);
      put('glass', new THREE.BoxGeometry(0.95, 0.02, 0.3).rotateX(slope).translate(-0.1, dash(conZ) + 0.012, conZ));
      put('glass', new THREE.BoxGeometry(1.32, 0.3, 0.02).rotateX(-0.35).translate(0, dash(conZ - 0.3) + 0.13, conZ - 0.32));
      const w = wheel(0.22, 5, YM.dark, F.steel);
      w.rotation.x = -slope - 0.25; w.position.set(0.32, dash(conZ + 0.2) + 0.12, conZ + 0.33); root.add(w);
      for (const dx of [0.42, 0.49]) put('steel', rod([dx, dash(conZ + 0.1), conZ + 0.1], [dx, dash(conZ + 0.1) + 0.14, conZ + 0.14], 0.01, 6));
      // the helm seat, cushioned, on its moulded box
      put('gel', new RoundedBoxGeometry(1.3, 0.42, 0.55, 3, 0.06).translate(0, FLY + 0.21, conZ + 1.0));
      put('cushion', new RoundedBoxGeometry(1.24, 0.1, 0.5, 3, 0.045).translate(0, FLY + 0.46, conZ + 1.0));
      put('cushion', new RoundedBoxGeometry(1.24, 0.42, 0.1, 3, 0.045).rotateX(-0.2).translate(0, FLY + 0.7, conZ + 1.27));
      // the swim platform's boarding ladder, folded up on it, and the stern's running gear under the water: two
      // shafts, their bronze propellers, two rudders
      for (const sx of [-1, 1]) {
        put('steel', rod([sx * 0.8, -0.28, 4.0], [sx * 0.8, -0.62, 5.0], 0.035, 8));
        const prop = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const blade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.12, 0.5).translate(0.17, 0, 0), F.bronze);
          blade.rotation.set(0.35 * sx, 0, (k * Math.PI * 2) / 3); prop.add(blade);
        }
        prop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 10).rotateX(Math.PI / 2), F.bronze));
        prop.position.set(sx * 0.8, -0.64, 5.05); root.add(prop);
        put('steel', new THREE.BoxGeometry(0.04, 0.5, 0.42).translate(sx * 0.8, -0.58, 5.6));
      }
    } else {
      const H = hullGeometry();
      put('hull', H.hull); put('deck', H.deck);
      put('teak', new THREE.BoxGeometry(B * 0.84, 0.08, 0.9).translate(0, 0.38, L / 2 + 0.42));
      // the deckhouse: windows all round, the windscreen raked aft, a glass door into the aft deck
      const at = (y) => { const u = (y - 1.0) / (3.15 - 1.0); return { f: lerp(lo.f, hi.f, u), a: lerp(lo.a, hi.a, u), wf: lerp(lo.wf, hi.wf, u), wa: lerp(lo.wa, hi.wa, u) }; };
      put('gel', block(lo, hi, 1.0, 3.15));
      put('glass', block(at(2.15), at(2.95), 2.15, 2.95, 0.02));
      put('glass', new THREE.BoxGeometry(0.95, 1.6, 0.14).translate(0, deckY(lo.a) + 0.8, lo.a - 0.03));
      // the hardtop, roofing the deckhouse and the aft deck; the flybridge is on it
      const shape = new THREE.Shape();
      shape.moveTo(-topW + r, topF); shape.lineTo(topW - r, topF); shape.quadraticCurveTo(topW, topF, topW, topF + r);
      shape.lineTo(topW, topA); shape.lineTo(-topW, topA); shape.lineTo(-topW, topF + r); shape.quadraticCurveTo(-topW, topF, -topW + r, topF);
      put('gel', new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, FLY, 0));
      // on the flybridge: the helm console with its little screen and the seat behind it
      put('gel', new THREE.BoxGeometry(1.4, 0.85, 0.6).translate(0, FLY + 0.42, conZ));
      put('glass', new THREE.BoxGeometry(1.3, 0.28, 0.04).rotateX(-0.45).translate(0, FLY + 0.98, conZ - 0.22));
      put('dark', new THREE.BoxGeometry(1.2, 0.45, 0.55).translate(0, FLY + 0.22, conZ + 1.0));
    }
    // the rubbing strake round the sheer, and the boarding ladder off the swim platform
    const strake = [];
    for (let i = 0; i <= 40; i++) { const s = station(i / 40); strake.push([s.hb + 0.035, s.sy - 0.075, s.z]); }
    for (let i = 39; i >= 0; i--) { const s = station(i / 40); strake.push([-s.hb - 0.035, s.sy - 0.075, s.z]); }
    put('navy', tube(strake, 0.055, true, 10));
    for (const x of [0.9, 1.2]) put('steel', rod([x, 0.42, L / 2 + 0.85], [x, -0.4, L / 2 + 0.95], 0.02, 8));
    for (let k = 0; k < 3; k++) put('steel', rod([0.9, 0.2 - k * 0.26, L / 2 + 0.87 + k * 0.03], [1.2, 0.2 - k * 0.26, L / 2 + 0.87 + k * 0.03], 0.016, 6));
    // the hardtop's two posts
    for (const sx of [-1, 1]) put('gel', rod([sx * 1.42, deckY(4.4), 4.4], [sx * 1.42, FLY - 0.15, 4.4], 0.07, 16));
    // the flybridge rail, round her but open at the ladder, and the ladder down to the aft deck
    const railPts = [], rH = FLY + 0.85;
    const perim = [[-topW + 0.12, topA - 0.12], [-topW + 0.12, topF + r], [-topW + r, topF + 0.12], [topW - r, topF + 0.12], [topW - 0.12, topF + r], [topW - 0.12, topA - 0.12], [-0.6, topA - 0.12]]
      .map(([x, z]) => [x * side, z]); // the gap is over the ladder, on the far side from the line
    for (const [x, z] of perim) railPts.push([x, rH, z]);
    put('steel', tube(railPts, 0.022, false, 8));
    for (const [x, z] of perim) put('steel', rod([x, FLY, z], [x, rH, z], 0.018, 8));
    const ladX = -side * 1.0;
    for (const dx of [-0.25, 0.25]) put('steel', rod([ladX + dx, deckY(5.6), 5.7], [ladX + dx, FLY + 0.9, topA - 0.1], 0.022, 8));
    for (let k = 1; k <= 6; k++) { const u = k / 7, y = lerp(deckY(5.6), FLY, u), z = lerp(5.7, topA - 0.1, u); put('wood', new THREE.BoxGeometry(0.5, 0.04, 0.12).translate(ladX, y, z)); }

    // the guardrail round the main deck, open at the transom; a lifebuoy on it aft
    const gr = [], posts = [];
    for (let i = 1; i <= 24; i++) { const t = i / 24, s = station(t); const x = Math.max(s.hb - 0.08, 0); gr.push([x, s.sy + 0.72 - 0.08 * t, s.z]); if (i % 3 === 1) posts.push([x, s.sy, s.z, s.sy + 0.72 - 0.08 * t]); }
    for (let i = 23; i >= 1; i--) gr.push([-gr[i - 1][0], gr[i - 1][1], gr[i - 1][2]]);
    put('steel', tube(gr, 0.025, false, 8));
    put('steel', tube(gr.map(([x, y, z]) => [x * 1.005, y - 0.36, z]), 0.012, false, 6));
    for (const [x, y0, z, y1] of posts) for (const sx of [-1, 1]) {
      put('steel', rod([sx * x, y0, z], [sx * x, y1, z], 0.02, 8));
      put('steel', new THREE.CylinderGeometry(0.035, 0.045, 0.03, 10).translate(sx * x, y0 + 0.015, z)); // its base
    }
    const rz = 5.2;
    put('orange', new THREE.TorusGeometry(0.3, 0.07, 10, 28).rotateY(Math.PI / 2).translate(side * (halfB(rz) - 0.02), deckY(rz) + 0.42, rz));
    for (let k = 0; k < 4; k++) { // its four white reflective bands
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      put('cushion', new THREE.TorusGeometry(0.068, 0.014, 6, 14).translate(0, 0.3, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(a)).translate(side * (halfB(rz) - 0.02), deckY(rz) + 0.42, rz));
    }
    // fenders out on her other side, for the mark boats coming alongside: each hung on its line from the rail (under
    // way, they're in)
    const fenderGeo = new THREE.LatheGeometry([[0, -0.36], [0.06, -0.35], [0.11, -0.3], [0.125, -0.2], [0.125, 0.2], [0.11, 0.3], [0.06, 0.35], [0, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    for (const z of underway ? [] : [-0.5, 1.2, 2.9]) {
      const fx = -side * (halfB(z) + 0.15), fy = deckY(z) - 0.58;
      put('fender', fenderGeo.clone().translate(fx, fy, z));
      put('rope', rod([fx, fy + 0.36, z], [-side * (halfB(z) - 0.08), deckY(z) + 0.36, z], 0.008, 4));
    }
    // cleats: at the bow, at the shoulders, amidships and on the quarters
    for (const [cx, cz, ry] of [[0.45, -4.7, 0], [-0.45, -4.7, 0], [1, 0.4, 0], [-1, 0.4, 0], [1, 5.8, 0], [-1, 5.8, 0]]) {
      const x = cx === Math.sign(cx) ? cx * (halfB(cz) - 0.18) : cx, gx = new THREE.Group();
      cleat(0.26).forEach(([g, m]) => gx.add(new THREE.Mesh(g, m)));
      gx.position.set(x, deckY(cz) + 0.02, cz); gx.rotation.y = ry; root.add(gx);
    }
    // the hatch on the foredeck: its alloy frame, the smoked acrylic in it
    put('steel', new RoundedBoxGeometry(0.7, 0.05, 0.7, 2, 0.02).translate(0, deckY(-3.0) + 0.04, -3.0));
    put('glass', new THREE.BoxGeometry(0.6, 0.02, 0.6).translate(0, deckY(-3.0) + 0.065, -3.0));

    // "RACE COMMITTEE" on banners lashed to the guardrails, both sides
    for (const sx of [-1, 1]) {
      const z0 = -0.2, z1 = 3.3, zm = (z0 + z1) / 2, x = sx * (Math.max(halfB(z0), halfB(z1)) - 0.06);
      put('banner', new THREE.PlaneGeometry(z1 - z0, 0.55).rotateY(sx * Math.PI / 2).translate(x, deckY(zm) + 0.42, zm));
    }

    // the signal mast on the flybridge: a yardarm with two halyards each side for the signals, the club burgee at the
    // masthead, the radar dome and a black ball forward (the day shape of a vessel at anchor)
    const mz = conZ + 1.55, mTop = 8.8, yardY = 7.7;
    put('gel', new THREE.CylinderGeometry(0.05, 0.08, mTop - FLY, 10).translate(0, (mTop + FLY) / 2, mz));
    put('gel', new THREE.CylinderGeometry(0.035, 0.035, 3.9, 6).rotateZ(Math.PI / 2).translate(0, yardY, mz));
    put('gel', new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16).translate(0, 6.15, mz - 0.45));
    put('gel', new THREE.BoxGeometry(0.06, 0.06, 0.4).translate(0, 6.0, mz - 0.25));
    if (!underway) { // the ball comes down when she weighs anchor
      put('dark', new THREE.SphereGeometry(0.28, 12, 9).translate(0, 6.9, mz - 0.4));
      lines.push(0, 6.9 + 0.28, mz - 0.4, 0, yardY - 0.1, mz - 0.05);
    }
    put('dark', new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4).translate(0.5, FLY + 0.85, topA - 0.25)); // VHF whips
    put('dark', new THREE.CylinderGeometry(0.012, 0.012, 1.8, 4).translate(-0.5, FLY + 1.05, topA - 0.25));
    // stays from the masthead to the flybridge corners
    for (const [x, z] of [[-1.45, topF + 0.6], [1.45, topF + 0.6], [-1.45, mz + 1.6], [1.45, mz + 1.6]]) lines.push(0, mTop - 0.1, mz, x, FLY + 0.02, z);

    // the four signal halyards: from a block on the yardarm down to a cleat on the flybridge rail. Starboard outer: the
    // class flag; port outer: P (or U, or black); starboard inner: X; port inner: the first substitute
    this.flags = {};
    const hal = { cls: [1.85, 1.4], P: [-1.85, -1.4], X: [1.15, 0.95], sub: [-1.15, -0.95] };
    for (const [k, [xt, xb]] of Object.entries(hal)) {
      if (underway) continue;
      const top = new THREE.Vector3(xt, yardY - 0.08, mz), bot = new THREE.Vector3(xb, rH, mz);
      lines.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
      const f = new Flag(flagTexture(k), k === 'sub' ? 1.3 : 1.2, 0.85, k === 'sub');
      f.top = top; f.bot = bot.clone().setY(rH + 0.9); f.h = 0;
      root.add(f.pivot); this.flags[k] = f;
    }
    this.prepTex = { P: this.flags.P?.mat.map, I: flagTexture('I'), U: flagTexture('U'), B: flagTexture('B') };
    this.burgee = new Flag(flagTexture('burgee'), 0.75, 0.45, true);
    this.burgee.pivot.position.set(0, mTop + 0.05, mz); root.add(this.burgee.pivot);
    put('dark', new THREE.CylinderGeometry(0.01, 0.01, 0.55, 4).translate(0, mTop + 0.25 - 0.27, mz));

    // the orange flag on its staff, where the line meets her: her end of the starting line
    const oz = clamp(lineZ, 2.8, 3.9), ox = side * (halfB(oz) - 0.1), oy = deckY(oz);
    if (!underway) {
      put('steel', rod([ox, oy, oz], [ox, oy + 3.6, oz], 0.03, 6));
      put('steel', new THREE.SphereGeometry(0.05, 8, 6).translate(ox, oy + 3.62, oz));
      this.orange = new Flag(flagTexture('orange'), 1.3, 0.9);
      this.orange.pivot.position.set(ox, oy + 3.55, oz); root.add(this.orange.pivot);
    }

    // the anchor rode from the bow roller down into the sea ahead
    const bow = station(1);
    put('steel', new THREE.BoxGeometry(0.16, 0.1, 0.62).translate(0, bow.sy + 0.02, bow.z + 0.05)); // the bow roller's cheeks
    put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12).rotateZ(Math.PI / 2).translate(0, bow.sy + 0.03, bow.z - 0.24)); // the roller
    // the windlass on the foredeck, the chain from it to the roller, and the anchor home on the roller
    put('steel', new THREE.CylinderGeometry(0.11, 0.13, 0.2, 16).translate(0, deckY(-5.3) + 0.1, -5.3));
    put('steel', new THREE.CylinderGeometry(0.07, 0.07, 0.24, 16).rotateZ(Math.PI / 2).translate(0, deckY(-5.3) + 0.2, -5.3));
    put('dark', rod([0, deckY(-5.3) + 0.12, -5.42], [0, bow.sy + 0.07, bow.z - 0.1], 0.02, 5));
    const fluke = new THREE.ConeGeometry(0.16, 0.34, 3).scale(1, 1, 0.35).rotateX(Math.PI / 2).rotateZ(Math.PI);
    put('steel', fluke.translate(0, bow.sy - 0.12, bow.z - 0.42));
    put('steel', rod([0, bow.sy + 0.06, bow.z - 0.05], [0, bow.sy - 0.08, bow.z - 0.32], 0.025, 8)); // its shank
    if (!underway) {
      const rode = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8; rode.push([0, lerp(bow.sy - 0.05, -0.6, u) - 0.5 * Math.sin(Math.PI * u) * 0.6, bow.z - 0.3 - u * 11]); }
      put('dark', tube(rode, 0.025, false, 4));
    }

    // the officers: the race officer on the flybridge with binoculars, a hand on the halyards at the mast, the line
    // sighter by the orange flag, the timekeeper with the horn on the aft deck, the recorder with the sheet
    const face = side > 0 ? 0 : Math.PI; // they face the line
    const ahead = Math.PI / 2; // a sailor faces +x: this turns him to look over the bow
    const crew = underway ? [
      { at: [0, FLY, conZ + 0.6], jacket: '#1d3557', pose: 'wheel', yaw: ahead },
      { at: [0.7, FLY, mz + 1.4], jacket: '#f2f1ec', pose: 'glasses', yaw: ahead - 0.9 },
      { at: [-0.6, deckY(4.2), 4.6], jacket: '#c8342b', pose: 'board', yaw: ahead + 2.4 },
    ] : [
      { at: [side * 0.9, FLY, mz + 1.6], jacket: '#1d3557', pose: 'glasses', yaw: face },
      { at: [side * 0.45, FLY, mz + 0.45], jacket: '#c8342b', pose: 'halyard', yaw: face },
      { at: [side * (halfB(oz) - 0.5), deckY(oz), oz + 0.55], jacket: '#ff7a1a', pose: 'glasses', yaw: face - side * 0.35 },
      { at: [side * 0.6, deckY(4.2), 4.3], jacket: '#1d3557', pose: 'horn', yaw: face + side * 0.25 },
      { at: [-side * 0.5, FLY, mz + 2.0], jacket: '#f2f1ec', pose: 'board', yaw: face + side * 0.5 },
    ];
    this.officers = crew.map((c, i) => {
      const s = officer(i, c.jacket, c.pose);
      s.g.position.set(c.at[0], c.at[1] + 0.94 * 1.1, c.at[2]); s.g.rotation.y = c.yaw;
      root.add(s.g);
      return { s, steady: c.pose === 'glasses' || c.pose === 'wheel' };
    });

    // put it together
    for (const [k, gs] of Object.entries(bin)) {
      const g = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => { for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n); if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }));
      root.add(new THREE.Mesh(g, M[k]));
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a3f46' })));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    foldStill(root); // her plain parts, a draw a material, into one (yacht.js)
  }

  // a finish line's boat: she runs no start, and the class flag's halyard flies the blue flag instead
  finishing() { const f = this.flags.cls; f.mat.map = flagTexture('blue'); f.mat.needsUpdate = true; return this; }

  // flags: { cls, P, X, sub } as the race flies them; prepFlag: P, U or B; downwind: the wind's direction in the
  // boat (0 = straight aft); wind in m/s. A flag is hoisted or lowered along its halyard, not switched.
  update(t, dt, flags, prepFlag, downwind, wind) {
    this.officers.forEach((o, i) => onWatch(o.s, t, i, o.steady));
    if (!this.orange) { this.burgee.update(t, downwind, wind); return; } // underway: the burgee is all she flies
    const pt = this.prepTex[prepFlag || 'P'];
    if (this.flags.P.mat.map !== pt) { this.flags.P.mat.map = pt; this.flags.P.mat.needsUpdate = true; }
    for (const [k, f] of Object.entries(this.flags)) {
      const want = flags[k] ? 1 : 0;
      if (dt > 1 || this.fresh) f.h = want; else f.h += clamp(want - f.h, -dt / 1.4, dt / 1.4);
      f.pivot.visible = f.h > 0.02;
      f.pivot.position.lerpVectors(f.bot, f.top, f.h);
      f.update(t, downwind, wind);
    }
    this.fresh = false;
    this.orange.update(t, downwind, wind); this.burgee.update(t, downwind, wind);
  }
}
