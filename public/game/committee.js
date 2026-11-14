// Regatta: the committee boat — a 13 m motor cruiser lying to her anchor, head to wind, at the starboard end of the
// line. The race officers run the start from her: the signal flags go up and down halyards on the yardarm of her
// signal mast, the orange flag on a staff marks her end of the line, and an officer on the side deck sights along the
// line to the pin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './sim.js';
import { sailor } from './yacht.js';

const L = 13, B = 4.3, DRAFT = 0.85;
const FLY = 3.3; // the flybridge floor
const Y0 = -1.2, Y1 = 2.2; // the hull's paint is a strip of colour by height, from Y0 to Y1

// code flags drawn on a canvas
export function flagTexture(k) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const x = c.getContext('2d');
  if (k === 'P') { x.fillStyle = '#1f4fa8'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#fff'; x.fillRect(30, 20, 36, 24); }
  else if (k === 'U') { x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 64); x.fillStyle = '#d22'; x.fillRect(0, 0, 48, 32); x.fillRect(48, 32, 48, 32); }
  else if (k === 'B') { x.fillStyle = '#111'; x.fillRect(0, 0, 96, 64); }
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

function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 88;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 88);
  x.fillStyle = '#1d3557'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 78, 512, 10);
  x.font = '900 46px Carlito, Lato, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('RACE COMMITTEE', 256, 46);
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

const tube = (pts, r, closed = false, seg = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.3), Math.max(8, pts.length * 4), r, seg, closed);
const rod = (a, b, r, seg = 6) => { // a cylinder from point a to point b
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), len = A.distanceTo(Bv);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()));
  return g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
};

// ---------- a flag ----------
// a cloth hoisted by its luff, flying downwind and rippling: the waves run from the hoist to the fly and grow there
const FLAG_SEG = 10;
class Flag {
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
function officer(i, jacketColor, pose) {
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
    bino.position.set(0.36, 0.66, 0); s.upper.add(bino);
  } else if (pose === 'halyard') { // one hand up on a halyard, the other pulling down
    aR.rotation.set(-0.2, 0, 2.7); aL.rotation.set(0.15, 0, 0.5);
  } else if (pose === 'horn') { // a horn held up, ready for the next signal
    aR.rotation.set(-0.3, 0, 1.3);
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.32, 10).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d4252b', roughness: 0.4 }));
    horn.position.set(0.42, 0.5, 0.12); s.upper.add(horn);
  } else if (pose === 'board') { // a clipboard: the times and the sail numbers
    aL.rotation.set(0.35, 0, 0.9); aR.rotation.set(-0.35, 0, 0.9);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.8 }));
    board.position.set(0.3, 0.32, 0); board.rotation.z = -0.7; s.upper.add(board);
  }
  return s;
}

// ---------- the boat ----------
export class CommitteeBoat {
  // side: +1 if the pin lies off her starboard side, −1 to port; lineZ: where along her the line meets her (local z)
  constructor(side = 1, lineZ = 0) {
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
      banner: new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.8, side: THREE.DoubleSide }),
    };
    const bin = {}; // static parts, merged per material
    const put = (k, g) => (bin[k] ||= []).push(g);
    const lines = [];

    const H = hullGeometry();
    put('hull', H.hull); put('deck', H.deck);
    // the rubbing strake round the sheer, and the swim platform at the transom
    const strake = [];
    for (let i = 0; i <= 20; i++) { const s = station(i / 20); strake.push([s.hb + 0.04, s.sy - 0.07, s.z]); }
    for (let i = 19; i >= 0; i--) { const s = station(i / 20); strake.push([-s.hb - 0.04, s.sy - 0.07, s.z]); }
    put('navy', tube(strake, 0.06, true, 5));
    put('teak', new THREE.BoxGeometry(B * 0.84, 0.08, 0.9).translate(0, 0.38, L / 2 + 0.42));
    put('steel', rod([0.9, 0.42, L / 2 + 0.85], [0.9, -0.4, L / 2 + 0.95], 0.02)); put('steel', rod([1.2, 0.42, L / 2 + 0.85], [1.2, -0.4, L / 2 + 0.95], 0.02)); // the boarding ladder

    // the deckhouse: windows all round, the windscreen raked aft, a glass door into the aft deck
    const lo = { f: -1.7, a: 2.4, wf: 1.42, wa: 1.55 }, hi = { f: -0.75, a: 2.3, wf: 1.22, wa: 1.42 };
    const at = (y) => { const u = (y - 1.0) / (3.15 - 1.0); return { f: lerp(lo.f, hi.f, u), a: lerp(lo.a, hi.a, u), wf: lerp(lo.wf, hi.wf, u), wa: lerp(lo.wa, hi.wa, u) }; };
    put('gel', block(lo, hi, 1.0, 3.15));
    put('glass', block(at(2.15), at(2.95), 2.15, 2.95, 0.02));
    put('glass', new THREE.BoxGeometry(0.95, 1.6, 0.14).translate(0, deckY(lo.a) + 0.8, lo.a - 0.03));
    // the hardtop, roofing the deckhouse and the aft deck, on two posts; the flybridge is on it
    const topF = hi.f - 0.2, topA = 4.6, topW = 1.62;
    const shape = new THREE.Shape(), r = 0.55;
    shape.moveTo(-topW + r, topF); shape.lineTo(topW - r, topF); shape.quadraticCurveTo(topW, topF, topW, topF + r);
    shape.lineTo(topW, topA); shape.lineTo(-topW, topA); shape.lineTo(-topW, topF + r); shape.quadraticCurveTo(-topW, topF, -topW + r, topF);
    put('gel', new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, FLY, 0));
    for (const sx of [-1, 1]) put('gel', rod([sx * 1.42, deckY(4.4), 4.4], [sx * 1.42, FLY - 0.15, 4.4], 0.07, 8));
    // on the flybridge: the helm console with its little screen and the seat behind it
    const conZ = topF + 0.75;
    put('gel', new THREE.BoxGeometry(1.4, 0.85, 0.6).translate(0, FLY + 0.42, conZ));
    put('glass', new THREE.BoxGeometry(1.3, 0.28, 0.04).rotateX(-0.45).translate(0, FLY + 0.98, conZ - 0.22));
    put('dark', new THREE.BoxGeometry(1.2, 0.45, 0.55).translate(0, FLY + 0.22, conZ + 1.0));
    // the flybridge rail, round her but open at the ladder, and the ladder down to the aft deck
    const railPts = [], rH = FLY + 0.85;
    const perim = [[-topW + 0.12, topA - 0.12], [-topW + 0.12, topF + r], [-topW + r, topF + 0.12], [topW - r, topF + 0.12], [topW - 0.12, topF + r], [topW - 0.12, topA - 0.12], [-0.6, topA - 0.12]]
      .map(([x, z]) => [x * side, z]); // the gap is over the ladder, on the far side from the line
    for (const [x, z] of perim) railPts.push([x, rH, z]);
    put('steel', tube(railPts, 0.022, false, 5));
    for (const [x, z] of perim) put('steel', rod([x, FLY, z], [x, rH, z], 0.018, 5));
    const ladX = -side * 1.0;
    for (const dx of [-0.25, 0.25]) put('steel', rod([ladX + dx, deckY(5.6), 5.7], [ladX + dx, FLY + 0.9, topA - 0.1], 0.022, 5));
    for (let k = 1; k <= 6; k++) { const u = k / 7, y = lerp(deckY(5.6), FLY, u), z = lerp(5.7, topA - 0.1, u); put('teak', new THREE.BoxGeometry(0.5, 0.04, 0.12).translate(ladX, y, z)); }

    // the guardrail round the main deck, open at the transom; a lifebuoy on it aft
    const gr = [], posts = [];
    for (let i = 1; i <= 24; i++) { const t = i / 24, s = station(t); const x = Math.max(s.hb - 0.08, 0); gr.push([x, s.sy + 0.72 - 0.08 * t, s.z]); if (i % 3 === 1) posts.push([x, s.sy, s.z, s.sy + 0.72 - 0.08 * t]); }
    for (let i = 23; i >= 1; i--) gr.push([-gr[i - 1][0], gr[i - 1][1], gr[i - 1][2]]);
    put('steel', tube(gr, 0.025, false, 5));
    put('steel', tube(gr.map(([x, y, z]) => [x * 1.005, y - 0.36, z]), 0.012, false, 4));
    for (const [x, y0, z, y1] of posts) for (const sx of [-1, 1]) put('steel', rod([sx * x, y0, z], [sx * x, y1, z], 0.02, 5));
    const rz = 5.2;
    put('orange', new THREE.TorusGeometry(0.3, 0.07, 6, 16).rotateY(Math.PI / 2).translate(side * (halfB(rz) - 0.02), deckY(rz) + 0.42, rz));
    // fenders out on her other side, for the mark boats coming alongside
    for (const z of [-0.5, 2.6]) put('navy', new THREE.CylinderGeometry(0.12, 0.12, 0.62, 10).translate(-side * (halfB(z) + 0.14), deckY(z) - 0.55, z));

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
    put('dark', new THREE.SphereGeometry(0.28, 12, 9).translate(0, 6.9, mz - 0.4));
    lines.push(0, 6.9 + 0.28, mz - 0.4, 0, yardY - 0.1, mz - 0.05);
    put('dark', new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4).translate(0.5, FLY + 0.85, topA - 0.25)); // VHF whips
    put('dark', new THREE.CylinderGeometry(0.012, 0.012, 1.8, 4).translate(-0.5, FLY + 1.05, topA - 0.25));
    // stays from the masthead to the flybridge corners
    for (const [x, z] of [[-1.45, topF + 0.6], [1.45, topF + 0.6], [-1.45, mz + 1.6], [1.45, mz + 1.6]]) lines.push(0, mTop - 0.1, mz, x, FLY + 0.02, z);

    // the four signal halyards: from a block on the yardarm down to a cleat on the flybridge rail. Starboard outer: the
    // class flag; port outer: P (or U, or black); starboard inner: X; port inner: the first substitute
    this.flags = {};
    const hal = { cls: [1.85, 1.4], P: [-1.85, -1.4], X: [1.15, 0.95], sub: [-1.15, -0.95] };
    for (const [k, [xt, xb]] of Object.entries(hal)) {
      const top = new THREE.Vector3(xt, yardY - 0.08, mz), bot = new THREE.Vector3(xb, rH, mz);
      lines.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
      const f = new Flag(flagTexture(k), k === 'sub' ? 1.3 : 1.2, 0.85, k === 'sub');
      f.top = top; f.bot = bot.clone().setY(rH + 0.9); f.h = 0;
      root.add(f.pivot); this.flags[k] = f;
    }
    this.prepTex = { P: this.flags.P.mat.map, U: flagTexture('U'), B: flagTexture('B') };
    this.burgee = new Flag(flagTexture('burgee'), 0.75, 0.45, true);
    this.burgee.pivot.position.set(0, mTop + 0.05, mz); root.add(this.burgee.pivot);
    put('dark', new THREE.CylinderGeometry(0.01, 0.01, 0.55, 4).translate(0, mTop + 0.25 - 0.27, mz));

    // the orange flag on its staff, where the line meets her: her end of the starting line
    const oz = clamp(lineZ, 2.8, 3.9), ox = side * (halfB(oz) - 0.1), oy = deckY(oz);
    put('steel', rod([ox, oy, oz], [ox, oy + 3.6, oz], 0.03, 6));
    put('steel', new THREE.SphereGeometry(0.05, 8, 6).translate(ox, oy + 3.62, oz));
    this.orange = new Flag(flagTexture('orange'), 1.3, 0.9);
    this.orange.pivot.position.set(ox, oy + 3.55, oz); root.add(this.orange.pivot);

    // the anchor rode from the bow roller down into the sea ahead
    const bow = station(1);
    put('steel', new THREE.BoxGeometry(0.14, 0.12, 0.55).translate(0, bow.sy - 0.02, bow.z - 0.1));
    const rode = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; rode.push([0, lerp(bow.sy - 0.05, -0.6, u) - 0.5 * Math.sin(Math.PI * u) * 0.6, bow.z - 0.3 - u * 11]); }
    put('dark', tube(rode, 0.025, false, 4));

    // the officers: the race officer on the flybridge with binoculars, a hand on the halyards at the mast, the line
    // sighter by the orange flag, the timekeeper with the horn on the aft deck, the recorder with the sheet
    const face = side > 0 ? 0 : Math.PI; // they face the line
    const crew = [
      { at: [side * 0.9, FLY, mz + 1.6], jacket: '#1d3557', pose: 'glasses', yaw: face },
      { at: [side * 0.45, FLY, mz + 0.45], jacket: '#c8342b', pose: 'halyard', yaw: face },
      { at: [side * (halfB(oz) - 0.5), deckY(oz), oz + 0.55], jacket: '#ff7a1a', pose: 'glasses', yaw: face - side * 0.35 },
      { at: [side * 0.6, deckY(4.2), 4.3], jacket: '#1d3557', pose: 'horn', yaw: face + side * 0.25 },
      { at: [-side * 0.5, FLY, mz + 2.0], jacket: '#f2f1ec', pose: 'board', yaw: face + side * 0.5 },
    ];
    crew.forEach((c, i) => {
      const s = officer(i, c.jacket, c.pose);
      s.g.position.set(c.at[0], c.at[1] + 0.94 * 1.1, c.at[2]); s.g.rotation.y = c.yaw;
      root.add(s.g);
    });

    // put it together
    for (const [k, gs] of Object.entries(bin)) {
      const g = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => { for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n); if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }));
      root.add(new THREE.Mesh(g, M[k]));
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a3f46' })));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // a finish line's boat: she runs no start, and the class flag's halyard flies the blue flag instead
  finishing() { const f = this.flags.cls; f.mat.map = flagTexture('blue'); f.mat.needsUpdate = true; return this; }

  // flags: { cls, P, X, sub } as the race flies them; prepFlag: P, U or B; downwind: the wind's direction in the
  // boat (0 = straight aft); wind in m/s. A flag is hoisted or lowered along its halyard, not switched.
  update(t, dt, flags, prepFlag, downwind, wind) {
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
