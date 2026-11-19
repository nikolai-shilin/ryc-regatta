// Regatta: big ships passing far out — tankers, container ships, bulk carriers, now and then a cruise ship, a navy
// corvette or a submarine on the surface — on a straight track across the offing 1.5–5 km from the course at a steady
// 10–24 kn, as they pass any coast near a port.
// Only through open water: a track is laid where the land (land.js) has none and never near the course, so a
// venue shut in by its hills (or a lake) gets none. Seen through the haze as the far hills are, a little clearer (they
// are what the eye goes to out there), and lost in it at the far ends of their tracks. All picture.
//
// Each is built as she is: a lofted hull with its sheer, the flare and rake of its bow and the overhang of its stern,
// riding deep when laden and showing her red bottom in ballast, rust running down from her deck edge; her deckhouse in
// decks of cabins, a window each, the bridge on top with its wings out to her sides; the funnel in her company's
// colours; her cargo gear. And the water she moves: the bow wave climbing her stem, the wash along her sides, her wake.
import * as THREE from 'three';
import { SKY_GLSL } from './light.js';
import { VENUE } from './venues.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KN = 0.5144;
const NEAR = 1600, FAR = 5000; // metres: how far off the course a track passes
const REACH = 8800; // metres from the course where a track starts and ends (the far plane is 9 km)
const FADE = [7200, 8600]; // metres from the camera over which a ship is lost in the haze
const CLEAR = 1400; // metres: no closer than this to a mark
const SEA = -5; // the ground under a track, metres: below this, sea (land.js gives the open sea as −10 or −20)
const ROOM = 400; // metres of open water either side of a track: off the shore, as a shipping lane is
const MAX = 3; // out there at once
// where big ships never go: a lake
const NONE = new Set(['garda']);

const C = (h) => new THREE.Color(h);
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const RED = '#7e2a22'; // the antifouling
const WHITE = '#eeece5', GLASS = '#26313a';
// the companies' funnels: colour, band (or none), top
const FUNNELS = [['#c9b48c', '#1f3f5c', '#1a1b1d'], ['#e4e2dc', '#b3302a', '#1a1b1d'], ['#1f3a58', '#e4e2dc', '#1a1b1d'], ['#d4a23a', null, '#1a1b1d'],
  ['#b3302a', null, '#1a1b1d'], ['#2c5f45', '#e4e2dc', '#1a1b1d'], ['#e4e2dc', '#2a6fa8', '#2a6fa8'], ['#4a5258', '#d4a23a', '#1a1b1d']];

// ---------- building: every triangle its own colour (and whether it's glass), so bands and windows stay crisp ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
class Kit {
  constructor() { this.p = []; this.c = []; this.s = []; }
  tri(a, b, c, col, s = 0) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) { this.c.push(col.r, col.g, col.b); this.s.push(s); }
  }
  // a quad, its corners in order round it, turned to face `out`
  quad(a, b, c, d, col, out, s = 0) {
    if (out) { const n = cross(sub(b, a), sub(c, a)); if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) [b, d] = [d, b]; }
    this.tri(a, b, c, col, s); this.tri(a, c, d, col, s);
  }
  // a three.js shape; paint: a colour, or fn(x, y, z, ny, nz) → a colour or [colour, glass] for each triangle
  add(g, paint) {
    if (g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i += 3) {
      const r = paint.isColor ? paint : paint((P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3, (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3, N.getY(i), N.getZ(i));
      const [col, s] = r.isColor ? [r, 0] : r;
      this.tri([P.getX(i), P.getY(i), P.getZ(i)], [P.getX(i + 1), P.getY(i + 1), P.getZ(i + 1)], [P.getX(i + 2), P.getY(i + 2), P.getZ(i + 2)], col, s);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aShine', new THREE.Float32BufferAttribute(this.s, 1));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}
const box = (k, w, h, d, x, y, z, col) => k.add(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), col.isColor ? col : C(col));

// a flat face from o along du (breaks us, metres) and dv (vs), facing out; fn(u, v) → the colour of each cell
function face(k, o, du, dv, us, vs, out, fn) {
  const P = (u, v) => [o[0] + du[0] * u + dv[0] * v, o[1] + du[1] * u + dv[1] * v, o[2] + du[2] * u + dv[2] * v];
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
    const r = fn((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2), [col, s] = r.isColor ? [r, 0] : r;
    k.quad(P(us[i], vs[j]), P(us[i + 1], vs[j]), P(us[i + 1], vs[j + 1]), P(us[i], vs[j + 1]), col, out, s);
  }
}
// windows side by side along a wall `len` long, `open` wide at a `pitch`: the breaks between wall and glass, and
// whether a point is in one
const winN = (len, pitch) => Math.max(0, Math.floor(len / pitch)), winM = (len, pitch) => (len - winN(len, pitch) * pitch) / 2;
function breaks(len, pitch, open) {
  const b = [0, len];
  if (pitch) for (let i = 0, n = winN(len, pitch), m = winM(len, pitch); i < n; i++) { const s = m + i * pitch; b.push(s + (pitch - open) / 2, s + (pitch + open) / 2); }
  return [...new Set(b.map((x) => +x.toFixed(3)))].sort((a, b) => a - b);
}
function inWin(u, len, pitch, open) {
  if (!pitch) return false;
  const n = winN(len, pitch), r = u - winM(len, pitch);
  if (r < 0 || r > n * pitch) return false;
  const q = r % pitch;
  return q > (pitch - open) / 2 && q < (pitch + open) / 2;
}

// a block of the deckhouse: w across (centred on x), from zf (its front, towards the bow) back to zb, from y up h;
// windows in rows (their heights above y), side by side at a pitch, on the front (fpitch), the sides and the back
function block(k, o) {
  const { x = 0, w, y, h, zf, zb, wall, rows = [], pitch = 0, open = 0, fpitch = pitch, fopen = open, sides = true, back = true } = o;
  const W = C(wall), G = C(o.glass || GLASS), R = o.roof ? C(o.roof) : W.clone().multiplyScalar(0.8);
  const vs = [...new Set([0, h, ...rows.flat()])].sort((a, b) => a - b);
  const cell = (len, p, op, on) => (u, v) => on && rows.some(([a, b]) => v > a && v < b) && inWin(u, len, p, op) ? [G, 1] : W.clone().multiplyScalar(0.9 + 0.1 * smooth(0, 2.5, v));
  const x0 = x - w / 2, x1 = x + w / 2, d = zb - zf;
  face(k, [x0, y, zf], [1, 0, 0], [0, 1, 0], breaks(w, fpitch, fopen), vs, [0, 0, -1], cell(w, fpitch, fopen, true));
  face(k, [x0, y, zb], [1, 0, 0], [0, 1, 0], breaks(w, back ? pitch : 0, open), vs, [0, 0, 1], cell(w, pitch, open, back));
  for (const sx of [-1, 1]) face(k, [sx > 0 ? x1 : x0, y, zf], [0, 0, 1], [0, 1, 0], breaks(d, sides ? pitch : 0, open), vs, [sx, 0, 0], cell(d, pitch, open, sides));
  k.quad([x0, y + h, zf], [x1, y + h, zf], [x1, y + h, zb], [x0, y + h, zb], R, [0, 1, 0]);
}

// ---------- the hull: nose at −z, the waterline at y 0 ----------
// Lofted: stations from the transom (u 0) to the stem (u 1), each a section from below the water up to the deck edge.
// L, B, F: length, beam, the deck's height above the water amidships (low when laden); boot: how high the red bottom
// shows; entry, run: the fine ends, as fractions of the length; rake: how far the stem leans forward at the deck;
// flare: how much fuller the bow is at the deck than at the water (0–1); overhang: the stern's, at the deck;
// fc, poop: [where the forecastle starts / the poop ends, its height]; rows: [from, to] heights of portholes;
// rust: how much runs down her side
function hull(k, o) {
  const { L, B, F, boot, entry, run, rake = 0, flare = 0, overhang = 0, sheer = 0 } = o;
  const fc = o.fc || [2, 0], poop = o.poop || [-1, 0], rows = o.rows || [];
  const H = C(o.hull), Bt = C(o.bootCol || RED), D = C(o.deck), Rust = C('#5a3222'), Dark = C('#141617'), G = C(GLASS);
  const breadth = (u, pw, ent) => {
    if (u > 1 - ent) { const t = (u - (1 - ent)) / ent; return (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(t, pw)), 0.55); }
    if (u < run) { const t = 1 - u / run; return (B / 2) * (1 - 0.32 * t * t); }
    return B / 2;
  };
  const hw = (u) => breadth(u, 1.7, entry), hd = (u) => lerp(hw(u), breadth(u, 2.6, entry * 0.8), flare);
  const deckY = (u) => F + (u > fc[0] ? fc[1] : 0) + (u < poop[0] ? poop[1] : 0) + sheer * Math.pow(smooth(0.6, 1, u), 2);
  const Z = (u) => L / 2 - u * L;
  const us = [];
  for (let i = 0; i <= 120; i++) us.push(i / 120);
  for (const e of [fc[0], poop[0]]) if (e > 0 && e < 1) us.push(e - 0.002, e + 0.002);
  us.sort((a, b) => a - b);
  const rowY = rows.flat(), base = Math.max(boot, ...rowY), M = 5;
  // a station: its points from below the water to the deck edge (starboard; port is the mirror)
  // her side's point at a station, y up: [half-breadth, y, z]
  const at = (u, y) => {
    const dy = deckY(u), f = y <= 0 ? 0 : Math.min(1, y / dy), b = y < 0 ? hw(u) * 0.97 : lerp(hw(u), hd(u), Math.pow(f, 1.4));
    return [b, y, Z(u) - rake * Math.pow(f, 1.2) * smooth(1 - entry, 1, u) + overhang * f * (1 - smooth(0, run, u))];
  };
  const station = (u) => {
    const dy = deckY(u), ys = [-7, 0, boot, ...rowY];
    for (let m = 1; m <= M; m++) ys.push(base + ((dy - base) * m) / M);
    return { dy, ys, pts: ys.map((y) => at(u, y)) };
  };
  const S = us.map(station), last = S[0].ys.length - 1;
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1], u = (us[i] + us[i + 1]) / 2;
    const streak = hash(i, 3) > 0.86 ? (o.rust ?? 0.3) : 0, anchor = u > 0.952 && u < 0.97;
    for (let j = 0; j < last; j++) {
      const y = (a.ys[j] + a.ys[j + 1]) / 2;
      let col;
      if (y < boot) col = Bt;
      else if (rows.some(([r0, r1]) => y > r0 && y < r1)) col = i % 2 ? G : H;
      else if (anchor && j === last - 1) col = Dark; // the anchor in its pocket
      else {
        const up = (y - boot) / (a.dy - boot);
        col = H.clone().multiplyScalar(0.93 + 0.07 * hash(i >> 1, j));
        const r = anchor ? 0.6 * Math.min(1, 3 * (o.rust ?? 0.3)) : streak * up; // rust from the hawse pipe
        if (r > 0) col.lerp(Rust, r);
      }
      for (const sx of [1, -1]) {
        const P = (p) => [sx * p[0], p[1], p[2]];
        k.quad(P(a.pts[j]), P(b.pts[j]), P(b.pts[j + 1]), P(a.pts[j + 1]), col, [sx, 0, 0], col === G ? 1 : 0);
      }
    }
    // the deck, and where it steps up (the forecastle's and the poop's fronts) her side's colour
    const pa = a.pts[last], pb = b.pts[last], step = Math.abs(a.dy - b.dy) > 0.3;
    k.quad([-pa[0], pa[1], pa[2]], [pa[0], pa[1], pa[2]], [pb[0], pb[1], pb[2]], [-pb[0], pb[1], pb[2]], step ? H : D, step ? [0, 0, a.dy > b.dy ? -1 : 1] : [0, 1, 0]);
  }
  // the transom
  const t = S[0];
  for (let j = 0; j < last; j++) {
    const p = t.pts[j], q = t.pts[j + 1];
    k.quad([-p[0], p[1], p[2]], [p[0], p[1], p[2]], [q[0], q[1], q[2]], [-q[0], q[1], q[2]], t.ys[j] < boot ? Bt : H, [0, 0, 1]);
  }
  return { L, B, hw, hd, deckY, Z, at };
}

// ---------- the gear on her ----------
// a funnel, rounded and tapering, raked aft: the company's colour, its band, its top; two exhausts out of it
function funnel(k, o) {
  const [base, band, top] = o.colours, Cb = C(base), Cn = band ? C(band) : Cb, Ct = C(top), n = 20, lv = [0, 0.5, 0.58, 0.72, 0.8, 0.88, 1];
  const ring = (t) => {
    const a = 1 - 0.1 * t, r = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
      r.push([o.x + (o.w / 2) * a * Math.sign(c) * Math.sqrt(Math.abs(c)), o.y + t * o.h, o.z + o.rake * t + (o.d / 2) * a * Math.sign(s) * Math.sqrt(Math.abs(s))]);
    }
    return r;
  };
  const R = lv.map(ring);
  for (let j = 0; j < lv.length - 1; j++) {
    const t = (lv[j] + lv[j + 1]) / 2, col = t > 0.88 ? Ct : t > 0.58 && t < 0.72 ? Cn : Cb;
    for (let i = 0; i < n; i++) {
      const a = R[j][i], b = R[j][(i + 1) % n], c = R[j + 1][(i + 1) % n], d = R[j + 1][i];
      k.quad(a, b, c, d, col, [a[0] - o.x, 0, a[2] - o.z - o.rake * t]);
    }
  }
  const T = R[lv.length - 1], cx = o.x, cy = o.y + o.h, cz = o.z + o.rake;
  for (let i = 0; i < n; i++) k.tri([cx, cy, cz], T[(i + 1) % n], T[i], Ct.clone().multiplyScalar(0.6));
  for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.45, 0.45, 3, 8).translate(cx + sx * o.w * 0.15, cy + 1.2, cz + 0.5), C('#2b2c2e'));
}
// a mast: a tapering pole, a yard, the radar scanners and a dome or two
function mast(k, x, y, z, h, col = '#e6e4de') {
  const M = C(col), R = C('#d4d2cc');
  k.add(new THREE.CylinderGeometry(0.22, 0.45, h, 6).translate(x, y + h / 2, z), M);
  k.add(new THREE.BoxGeometry(6, 0.28, 0.28).translate(x, y + h * 0.72, z), M);
  k.add(new THREE.BoxGeometry(5, 0.35, 0.5).translate(x, y + h * 0.48, z - 1.4), R);
  k.add(new THREE.BoxGeometry(3.8, 0.35, 0.5).translate(x, y + h + 0.3, z), R);
  k.add(new THREE.SphereGeometry(0.6, 8, 6).translate(x + 1.8, y + h * 0.72 + 0.6, z), C('#f2f1ec'));
}
// the house: decks of cabins (a window each), the bridge on top with its windows all round and its wings out to the
// ship's sides, a sun visor over the front windows, the mast on its roof. Returns the height of the roof.
function house(k, o) {
  const dh = 2.8;
  let y = o.y;
  for (let i = 0; i < o.n; i++) {
    const set = i >= o.n - 2 ? (o.zb - o.zf) * 0.08 * (i - o.n + 3) : 0; // the upper decks a little shorter at the back
    block(k, { w: o.w, y, h: dh, zf: o.zf, zb: o.zb - set, wall: o.wall, rows: [[1.0, 1.9]], pitch: 2.6, open: 1.1 });
    y += dh;
  }
  const bz = o.zf + (o.zb - o.zf) * 0.6;
  block(k, { w: o.w, y, h: 3.2, zf: o.zf, zb: bz, wall: o.wall, rows: [[1.0, 2.7]], pitch: 1.7, open: 1.45, back: false });
  const ww = o.B / 2 - o.w / 2;
  if (ww > 0.5) for (const sx of [-1, 1]) block(k, { x: sx * (o.w / 2 + ww / 2), w: ww, y: y + 0.4, h: 2.8, zf: o.zf, zb: o.zf + 4, wall: o.wall, rows: [[0.7, 2.3]], fpitch: 1.7, fopen: 1.45, pitch: 0, back: false });
  box(k, o.w + 2 * Math.max(0, ww), 0.25, 1.4, 0, y + 3.0, o.zf - 0.7, C(o.wall)); // the sun visor
  mast(k, 0, y + 3.2, o.zf + 4.5, 9);
  return y + 3.2;
}
// the free-fall lifeboat on its ramp at the after end of the house, nose down over the stern
function freefall(k, y, z) {
  const O = C('#e2672a');
  k.add(new THREE.CapsuleGeometry(1.6, 6.5, 4, 10).rotateX(Math.PI / 2).rotateX(0.55).translate(0, y + 1.9, z + 4), O);
  k.add(new THREE.BoxGeometry(4.2, 0.4, 10).rotateX(0.55).translate(0, y + 0.3, z + 4), C('#8b8f92'));
  for (const sx of [-1, 1]) box(k, 0.4, 5, 0.4, sx * 2.2, y, z + 0.5, '#8b8f92');
}
// a deck crane: pedestal, cab and jib, the jib stowed low along the deck towards the bow on its rest
function crane(k, y, z, col, jib = 24) {
  const K = C(col);
  k.add(new THREE.CylinderGeometry(1.5, 1.8, 9, 10).translate(0, y + 4.5, z), K);
  box(k, 4.2, 4, 4.6, 1.6, y + 9, z + 0.8, K);
  k.add(new THREE.BoxGeometry(1.1, 1.3, jib).translate(0, 0, -jib / 2).rotateX(-0.12).translate(0, y + 10, z - 1.5), K);
  k.add(new THREE.BoxGeometry(0.3, 0.3, jib * 0.8).translate(0, 0, -jib * 0.4).rotateX(0.05).translate(0, y + 12.5, z - 1.5), K); // its stay
  box(k, 0.6, 7.5 - jib * Math.sin(0.12), 0.6, 0, y + 1.5, z - 1.5 - jib * 0.97, K); // the rest
}

// ---------- the ships ----------
// a crude oil or product tanker, 250 m: long low deck with the pipework along its middle and the manifold amidships,
// the house and funnel right aft
function tanker() {
  const k = new Kit(), L = 250, B = 44, laden = Math.random() < 0.6, F = laden ? 8.5 : 14, boot = laden ? 0.7 : 4.8;
  const hc = pick(['#2a2d30', '#6e2420', '#1e3149', '#2d3d33', '#7e2c22', '#23384a']), deck = pick(['#6a3426', '#4f5e48', '#7d3326']);
  const h = hull(k, { L, B, F, boot, entry: 0.15, run: 0.17, rake: 6, flare: 0.35, overhang: 3, fc: [0.91, 3], poop: [0.15, 3], sheer: 1, hull: hc, deck, rust: 0.35 });
  const Z = h.Z, wall = pick([WHITE, '#ece6d6']), P = F + 3;
  const top = house(k, { w: B * 0.7, B, y: P, n: 5, zf: Z(0.135), zb: Z(0.045), wall });
  funnel(k, { x: 0, y: P + 2.8 * 3, z: Z(0.065), w: 8, d: 10, h: top - P - 2.8 * 3 + 6, rake: 2.5, colours: pick(FUNNELS) });
  freefall(k, P + 2.8, Z(0.045));
  const grey = C('#8a8d8f'), zA = Z(0.9), zB = Z(0.16);
  box(k, 4, 1.2, zB - zA, 0, F + 0.9, (zA + zB) / 2, grey); // the pipes along her middle
  box(k, 1.4, 0.3, zB - zA, B * 0.18, F + 2.4, (zA + zB) / 2, '#c9c6bd'); // the catwalk
  for (let z = zA + 6; z < zB; z += 12) box(k, 0.4, 2.4, 0.4, B * 0.18, F, z, grey);
  box(k, B * 0.75, 2.2, 3.5, 0, F, Z(0.5), '#7f8386'); // the manifold
  for (const sx of [-1, 1]) {
    box(k, 0.9, 9, 0.9, sx * B * 0.32, F, Z(0.5) + 4, '#e6e4de'); // the hose cranes
    k.add(new THREE.BoxGeometry(0.5, 0.5, 13).translate(0, 0, -6.5).rotateX(0.5).translate(sx * B * 0.32, F + 8.5, Z(0.5) + 4), C('#e6e4de'));
  }
  for (let i = 0; i < 3; i++) box(k, 2.5, 1.6, 2.5, (i - 1) * 7, F + 3, Z(0.94), '#4a4d50'); // the windlasses
  mast(k, 0, F + 3, Z(0.965), 9);
  return { k, h, kn: [11, 15] };
}

// a container ship, 300 m: the boxes up to eight high, each its line's colour, between lashing bridges; the house
// well aft, the funnel abaft it, a breakwater behind the high flared bow
function container() {
  const k = new Kit(), L = 300, B = 48, F = 13, boot = rnd(0.8, 2.2);
  const hc = pick(['#1c2836', '#2a2d30', '#7a2822', '#2b4f6e', '#3c4652']);
  const h = hull(k, { L, B, F, boot, entry: 0.24, run: 0.22, rake: 9, flare: 0.7, overhang: 4, fc: [0.905, 4], sheer: 1.5, hull: hc, deck: '#555856', rust: 0.2 });
  const Z = h.Z;
  const top = house(k, { w: B * 0.5, B, y: F, n: 9, zf: Z(0.305), zb: Z(0.265), wall: WHITE });
  funnel(k, { x: 0, y: F, z: Z(0.12), w: 9, d: 13, h: top - F + 3, rake: 2, colours: pick(FUNNELS) });
  for (const sx of [-1, 1]) k.add(new THREE.BoxGeometry(B * 0.56, 3.5, 0.5).rotateY(sx * 0.32).translate(sx * B * 0.24, F + 4 + 1.75, Z(0.885)), C(hc)); // the breakwater
  mast(k, 0, F + 4, Z(0.95), 10);
  // the boxes: a line's own colour on half of them, another's on some more, the rest anyone's; each a little faded
  const PAL = ['#2f6f9f', '#9e2b25', '#c49a2c', '#2e6b45', '#d9d6cc', '#7d8288', '#b5552a', '#6b2f57', '#1f3d5c', '#6e3a2a', '#8fa9b8', '#c7c2b4'].map(C);
  const main = pick(PAL), second = pick(PAL);
  const boxCol = (a, b, c) => { const r = hash(a, b, c), col = (r < 0.45 ? main : r < 0.6 ? second : PAL[Math.floor(hash(c, a, b) * PAL.length)]).clone(); return col.multiplyScalar(0.8 + 0.25 * hash(b, c, a)); };
  const runs = [[Z(0.865) + 7, Z(0.305) - 1], [Z(0.265) + 7, Z(0.12) - 13], [Z(0.12) + 13, Z(0.03)]], pitch = 13.4;
  let bi = 0;
  for (const [z0, z1] of runs) {
    for (let z = z0; z + pitch / 2 <= z1 + 0.1; z += pitch, bi++) {
      const u = (L / 2 - z) / L, half = h.hd(Math.min(u + 0.02, 1)) - 0.8;
      const T = Math.round((u > 0.78 ? 4.5 : u > 0.68 ? 6 : u < 0.12 ? 5.5 : 7) + rnd(-0.6, 1.2));
      const empty = hash(bi, 9) < 0.06;
      const nc = Math.floor((2 * half) / 2.5);
      box(k, nc * 2.5 + 0.6, 1.6, 12.8, 0, F, z, '#3f4244'); // the hatch cover
      for (let c = 0; c < nc; c++) {
        const x = (c - (nc - 1) / 2) * 2.5;
        let t = empty ? 2 : T - (hash(bi, c) < 0.18 ? 1 : 0) - (hash(c, bi) < 0.06 ? 2 : 0) - (c === 0 || c === nc - 1 ? (hash(bi, c, 5) < 0.4 ? 1 : 0) : 0);
        if (t < 1) continue;
        k.add(new THREE.BoxGeometry(2.42, t * 2.59, 12.1, 1, t, 1).translate(x, F + 1.6 + (t * 2.59) / 2, z), (cx, cy, cz, ny) => {
          const col = boxCol(bi, c, Math.min(t - 1, Math.floor((cy - F - 1.6) / 2.59)));
          return ny > 0.9 ? col.multiplyScalar(1.12) : col;
        });
      }
      if (bi % 2 === 0 && z + pitch <= z1) box(k, nc * 2.5, 5.2, 0.7, 0, F + 1.6, z + pitch / 2, '#8d9194'); // a lashing bridge
    }
  }
  return { k, h, kn: [15, 21] };
}

// a bulk carrier, 200 m: five holds under their covers and four cranes between them, the house aft
function bulk() {
  const k = new Kit(), L = 200, B = 32, laden = Math.random() < 0.5, F = laden ? 7 : 12, boot = laden ? 0.6 : 5;
  const hc = pick(['#2a2d30', '#6e2420', '#1e3149', '#2d3d33', '#7e2c22', '#3a4b5c']);
  const h = hull(k, { L, B, F, boot, entry: 0.12, run: 0.15, rake: 4, flare: 0.3, overhang: 2.5, fc: [0.925, 2.5], poop: [0.13, 2.5], hull: hc, deck: '#7b3328', rust: 0.45 });
  const Z = h.Z, P = F + 2.5;
  const top = house(k, { w: B * 0.78, B, y: P, n: 4, zf: Z(0.12), zb: Z(0.04), wall: WHITE });
  funnel(k, { x: 0, y: P + 2.8 * 2, z: Z(0.055), w: 6.5, d: 8, h: top - P - 5.6 + 5, rake: 2, colours: pick(FUNNELS) });
  freefall(k, P + 2.8, Z(0.04));
  const cover = pick(['#6c7176', '#7b3328', '#2f4a63', hc]), zA = Z(0.905), zB = Z(0.16), n = 5, len = (zB - zA) / n;
  for (let i = 0; i < n; i++) {
    const z = zA + len * (i + 0.5);
    box(k, B * 0.6, 1.8, len - 5, 0, F, z, '#6a2c24'); // the coaming
    box(k, B * 0.63, 1.1, len - 4.6, 0, F + 1.8, z, cover); // the cover
    box(k, B * 0.3, 0.4, len - 5, 0, F + 2.9, z, C(cover).multiplyScalar(0.85));
  }
  const crn = pick(['#d8b13a', '#e8e6df', '#c45a2a']);
  for (let i = 1; i <= 4; i++) crane(k, F, zA + len * i, crn, len * 0.8);
  mast(k, 0, F + 2.5, Z(0.965), 8);
  return { k, h, kn: [11, 14.5] };
}

// a cruise ship, 290 m: a white hull with her portholes, the lifeboats in a row along her sides under the decks of
// balconies, the decks terraced at the front and the back, the bridge's wings, the funnel aft on the top deck
function cruise() {
  const k = new Kit(), L = 290, B = 36, F = 13, acc = pick([['#1f4f8f', null, '#1f4f8f'], ['#b8322a', '#e4e2dc', '#1a1b1d'], ['#e4e2dc', '#1f4f8f', '#1a1b1d'], ['#14324f', '#d4a23a', '#14324f']]);
  const h = hull(k, { L, B, F, boot: 1.2, bootCol: '#1c2a44', entry: 0.2, run: 0.14, rake: 8, flare: 0.5, overhang: 3, sheer: 0.5, hull: '#f2f1ec', deck: '#d9d4c8', rust: 0, rows: [[5.4, 6.2], [8.4, 9.2]] });
  const Z = h.Z, balc = '#34495c';
  block(k, { w: B - 7, y: F, h: 6, zf: Z(0.85), zb: Z(0.08), wall: WHITE, rows: [[1.0, 2.6], [3.9, 5.4]], pitch: 3, open: 2.4 });
  for (let z = Z(0.72); z < Z(0.25); z += 11) for (const sx of [-1, 1]) {
    k.add(new THREE.CapsuleGeometry(1.7, 7, 4, 10).rotateX(Math.PI / 2).translate(sx * (B / 2 - 2.2), F + 3.2, z), (x, y) => C(y > F + 3.6 ? '#f2f1ec' : '#e8742c'));
  }
  const uf = (d) => 0.865 - 0.004 * d - 0.0025 * d * d, ub = (d) => 0.05 + (d > 4 ? 0.022 * (d - 4) : 0);
  for (let d = 0; d < 8; d++) {
    const y = F + 6 + d * 2.9;
    block(k, { w: B, y, h: 2.9, zf: Z(uf(d)), zb: Z(ub(d)), wall: WHITE, glass: balc, rows: [[0.35, 2.4]], pitch: 3.6, open: 3.0, fpitch: 2, fopen: 1.6 });
  }
  const by = F + 6 + 5 * 2.9;
  for (const sx of [-1, 1]) block(k, { x: sx * (B / 2 + 1.25), w: 2.5, y: by, h: 2.9, zf: Z(uf(5)), zb: Z(uf(5)) + 6, wall: WHITE, rows: [[0.6, 2.4]], fpitch: 1.6, fopen: 1.3, pitch: 0, back: false });
  const y8 = F + 6 + 8 * 2.9;
  block(k, { w: B * 0.7, y: y8, h: 2.9, zf: Z(0.68), zb: Z(0.22), wall: WHITE, rows: [[0.5, 2.4]], pitch: 4, open: 3 });
  funnel(k, { x: 0, y: y8, z: Z(0.18), w: 8, d: 20, h: 12, rake: 4, colours: acc });
  mast(k, 0, y8, Z(uf(7)) + 9, 8);
  return { k, h, kn: [16, 21] };
}

// a hull number in white, seven-segment style, on both bows: u, y where its middle is, h its height
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function number(k, h, str, u, y, ht) {
  const W = C('#eeeeea'), w = ht * 0.55, t = ht * 0.12, gap = ht * 0.85, n = str.length;
  // each segment: [along (0 left … 1 right), up (0 bottom … 1 top), horizontal?]
  const at = { a: [0.5, 1, 1], b: [1, 0.75, 0], c: [1, 0.25, 0], d: [0.5, 0, 1], e: [0, 0.25, 0], f: [0, 0.75, 0], g: [0.5, 0.5, 1] };
  for (const sx of [-1, 1]) {
    const right = sx > 0 ? -1 : 1; // reading left to right along her side, as seen from that side
    [...str].forEach((ch, i) => {
      const zc = h.Z(u) + right * (i - (n - 1) / 2) * gap;
      for (const sg of SEG[ch] || '') {
        const [a0, b, hor] = at[sg], a = ch === '1' ? 0.5 : a0, z = zc + right * (a - 0.5) * w, yy = y + (b - 0.5) * ht;
        const uu = (h.L / 2 - z) / h.L, x = Math.max(h.at(uu, yy - ht / 4)[0], h.at(uu, yy + ht / 4)[0], h.at(Math.min(1, uu + 0.02), yy + ht / 4)[0]) + 0.3; // clear of her faceted, flaring side
        k.add(new THREE.BoxGeometry(0.08, hor ? t : ht / 2, hor ? w : t).translate(sx * x, yy, z), W);
      }
    });
  }
}

// a colour that varies a little from panel to panel (cells of `cell` metres), as painted steel does
const panels = (hex, cell = 2.2, spread = 0.08) => { const c = C(hex); return (x, y, z) => c.clone().multiplyScalar(1 - spread / 2 + spread * hash(Math.round(x / cell), Math.round(y / cell), Math.round(z / cell))); };
// a box whose sides lean in towards the top and whose front leans back, cut into panels, as a stealthy ship's are;
// glass(c): whether a panel is a window — c: its column across (ix of nx), row up (iy of ny), cell aft (iz of nz),
// and the way it faces (fz: −1 the front, 1 the back, 0 a side or the roof; up: the roof)
function stealth(k, o) {
  const { w, h, d, x = 0, y, z, lean = 0.12, rake = 0, col, glass } = o;
  const nx = Math.max(1, Math.round(w / 1.1)), ny = Math.max(1, Math.round(h / 0.9)), nz = Math.max(1, Math.round(d / 2.2));
  const g = new THREE.BoxGeometry(w, h, d, nx, ny, nz), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const t = (P.getY(i) + h / 2) / h;
    P.setX(i, P.getX(i) * (1 - lean * t));
    if (P.getZ(i) < 0) P.setZ(i, P.getZ(i) + rake * t);
  }
  const paint = panels(col), G = C(GLASS);
  const cl = (v, n) => Math.min(n - 1, Math.max(0, Math.floor(v * n)));
  k.add(g.translate(x, y + h / 2, z), (cx, cy, cz, Ny, Nz) => {
    if (glass) { // which panel the triangle is in, undoing the lean and the rake
      const t = (cy - y) / h, zl = cz - z, zu = zl < 0 ? zl - rake * t : zl;
      const c = { ix: cl(((cx - x) / (1 - lean * t)) / w + 0.5, nx), iy: cl(t, ny), iz: cl(zu / d + 0.5, nz), nx, ny, nz, fz: Nz < -0.5 ? -1 : Nz > 0.5 ? 1 : 0, up: Ny > 0.9 };
      if (!c.up && glass(c)) return [G, 1];
    }
    return paint(cx, cy, cz);
  });
}
// a little figure standing: dark clothes, a face
function figure(k, x, y, z, coat = '#1d2430') {
  k.add(new THREE.CapsuleGeometry(0.24, 1.0, 3, 8).translate(x, y + 0.75, z), C(coat));
  k.add(new THREE.SphereGeometry(0.15, 8, 6).translate(x, y + 1.55, z), C('#c9a184'));
}

// a navy corvette, 90 m: haze grey, panel by panel. Her foredeck closed in by bulwarks round the gun and its stealthy
// turret; the missile cells behind it; the bridge with its raked windows and wings, the fire-control director on its
// roof; the pyramid mast with a radar panel on each face, the search radar and the domes on top; the satcom radomes,
// the raked funnel, the crossed anti-ship missiles amidships, the torpedo tubes, the boat bays and the life rafts; the
// hangar with its door, the close-in gun on its roof and the second mast; the flight deck aft with its markings; her
// number on her bows and staffs at both ends
function corvette() {
  const k = new Kit(), L = 90, B = 13, F = 5, grey = pick(['#7b8288', '#858c92', '#727a80']), dark = '#3a3f43', lite = '#9ea5aa';
  const h = hull(k, { L, B, F, boot: 0.6, bootCol: '#26282a', entry: 0.32, run: 0.2, rake: 5, flare: 0.55, overhang: 1.5, sheer: 1.8, hull: grey, deck: '#4a4f52', rust: 0.04 });
  const Z = h.Z, D = (u) => h.deckY(u), S = C(grey).multiplyScalar(1.04);
  // the bulwarks round the foredeck, leaning in as her sides flare out
  const Bw = C(grey);
  for (let i = 0; i < 24; i++) {
    const u0 = 0.66 + (0.31 * i) / 24, u1 = 0.66 + (0.31 * (i + 1)) / 24;
    const a = h.at(u0, D(u0)), b = h.at(u1, D(u1)), ht = (u) => 1.1 * (1 - smooth(0.9, 0.97, u) * 0.5);
    for (const sx of [-1, 1]) k.quad([sx * a[0], a[1], a[2]], [sx * b[0], b[1], b[2]], [sx * (b[0] - 0.25), b[1] + ht(u1), b[2]], [sx * (a[0] - 0.25), a[1] + ht(u0), a[2]], Bw, [sx, 0.2, 0]);
  }
  // the gun: a faceted turret, a sloping front, the barrel and its muzzle, on a ring
  const gu = 0.79, gz = Z(gu), gy = D(gu);
  const prof = new THREE.Shape([[-2.4, 0], [2.2, 0], [2.2, 0.5], [0.6, 2.0], [-2.4, 2.15]].map(([a, b]) => new THREE.Vector2(a, b)));
  const tur = new THREE.ExtrudeGeometry(prof, { depth: 3.4, bevelEnabled: false }).translate(0, 0, -1.7).rotateY(Math.PI / 2), TP = tur.attributes.position;
  for (let i = 0; i < TP.count; i++) TP.setX(i, TP.getX(i) * (1 - 0.16 * (TP.getY(i) / 2.15)));
  k.add(new THREE.CylinderGeometry(2.0, 2.2, 0.7, 16).translate(0, gy + 0.35, gz), C(grey));
  k.add(tur.translate(0, gy + 0.7, gz), panels(grey, 0.8, 0.05));
  k.add(new THREE.CylinderGeometry(0.11, 0.15, 6.4, 10).rotateX(Math.PI / 2).translate(0, 0, -3.2).rotateX(0.07).translate(0, gy + 1.5, gz - 2.0), C(dark));
  k.add(new THREE.CylinderGeometry(0.19, 0.19, 0.6, 10).rotateX(Math.PI / 2).translate(0, 0, -6.5).rotateX(0.07).translate(0, gy + 1.5, gz - 2.0), C(dark));
  // the missile cells: a low block with its hatches
  const vu = 0.69, vz = Z(vu), vy = D(vu);
  stealth(k, { w: 5.2, h: 1.1, d: 4.4, y: vy, z: vz, lean: 0.15, col: grey });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) box(k, 1.0, 0.06, 0.9, (j - 1.5) * 1.15, vy + 1.1, vz + (i - 0.5) * 1.6, dark);
  // the forward superstructure and, on it, the bridge: windows raked back all along the front, smaller ones down her sides
  const sf = Z(0.64), sb = Z(0.45), sy = F; // (between it and the hangar: the missiles and the torpedo tubes)
  stealth(k, { w: B * 0.8, h: 5.4, d: sb - sf, y: sy, z: (sf + sb) / 2, rake: 0.6, col: grey });
  const by = sy + 5.4, bf = Z(0.625), bb = Z(0.5);
  stealth(k, { w: B * 0.66, h: 2.8, d: bb - bf, y: by, z: (bf + bb) / 2, rake: 1.1, lean: 0.14, col: grey,
    glass: (c) => c.iy === 1 && (c.fz === -1 ? c.ix > 0 && c.ix < c.nx - 1 : c.fz === 0 && c.iz === 0) });
  for (const sx of [-1, 1]) stealth(k, { w: 2.2, h: 2.4, d: 3, x: sx * (B * 0.33 + 1.0), y: by + 0.2, z: bf + 1.8, rake: 0.8, lean: 0.1, col: grey,
    glass: (c) => c.iy === 1 && c.fz === -1 }); // the wings
  // the fire-control director on the bridge roof, forward
  k.add(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 10).translate(0, by + 2.8 + 0.7, bf + 3), S);
  k.add(new THREE.SphereGeometry(0.95, 14, 10).translate(0, by + 2.8 + 2.0, bf + 3), C('#e2e3df'));
  // the mast: a tapering pyramid, a radar panel on each face, a platform with the search radar, domes and whips on top
  const mz = Z(0.53), my = by + 2.8;
  k.add(new THREE.CylinderGeometry(1.0, 3.2, 10, 4, 4).rotateY(Math.PI / 4).translate(0, my + 5, mz), panels(grey, 1.5, 0.06));
  for (const [dx, dz, ry] of [[1, 0, Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, 0], [0, -1, 0]]) {
    k.add(new THREE.BoxGeometry(2.2, 2.2, 0.18).rotateX(dz ? -dz * 0.2 : 0).rotateZ(dx ? dx * 0.2 : 0).rotateY(ry).translate(dx * 2.15, my + 4.3, mz + dz * 2.15), C('#555c61'));
  }
  box(k, 3.2, 0.25, 3.2, 0, my + 10, mz, grey); // the platform
  k.add(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8).translate(0, my + 10.65, mz), C(dark));
  box(k, 4.6, 0.9, 0.35, 0, my + 11.0, mz, lite); // the search radar's antenna
  k.add(new THREE.SphereGeometry(0.55, 10, 8).translate(1.2, my + 10.8, mz + 1.1), C('#e2e3df'));
  k.add(new THREE.SphereGeometry(0.45, 10, 8).translate(-1.2, my + 10.7, mz + 1.1), C('#e2e3df'));
  box(k, 0.12, 4, 0.12, 0, my + 11.9, mz, dark); // the top mast
  box(k, 2.4, 0.1, 0.1, 0, my + 14.5, mz, dark); // its yard
  for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.04, 0.06, 6, 5).rotateZ(sx * 0.25).translate(sx * (B * 0.33 + 0.4), by + 3, bb - 1), C(dark)); // whips
  // the satcom radomes on their pedestals, either side on the hangar roof
  for (const sx of [-1, 1]) {
    k.add(new THREE.CylinderGeometry(0.5, 0.6, 1.6, 8).translate(sx * 2.6, F + 5.2 + 0.8, Z(0.34)), S);
    k.add(new THREE.SphereGeometry(1.1, 14, 10).translate(sx * 2.6, F + 5.2 + 2.5, Z(0.34)), C('#eceeea'));
  }
  // the funnel: raked, faceted, its exhaust grille dark
  const fz = Z(0.475);
  k.add(new THREE.CylinderGeometry(1.5, 2.1, 3.4, 6).rotateY(Math.PI / 6).scale(1, 1, 1.6).applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0, 0.35)).translate(0, sy + 5.4 + 1.7, fz), panels(grey, 1, 0.05));
  box(k, 2.2, 0.15, 3.0, 0, sy + 5.4 + 3.4, fz + 0.6, '#1e2124');
  // the boat bays, a door each side, and the life-raft canisters along the deck edge
  for (const sx of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.1, 2.6, 7.5).rotateZ(sx * 0.12).translate(sx * (B * 0.4 - 0.05), sy + 1.8, Z(0.56)), C('#666d72'));
    for (let i = 0; i < 4; i++) k.add(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 10).rotateZ(Math.PI / 2).translate(sx * (B / 2 - 0.6), F + 0.4, Z(0.3) + i * 1.3 - 2), C('#efefea'));
  }
  // the anti-ship missiles amidships: two launchers of four canisters, on stands, crossed and angled up
  for (const sx of [-1, 1]) {
    const lz = Z(0.405) + sx * 1.6;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      k.add(new THREE.BoxGeometry(0.75, 0.75, 6.2).rotateX(-0.2).rotateY(sx * 0.55).translate(sx * (0.9 + i * 0.8), F + 1.5 + j * 0.8, lz), C('#6a7176'));
    }
    box(k, 2.4, 1.1, 1.2, sx * 1.3, F, lz + 1.2, dark);
  }
  // the torpedo tubes: three in a mount, each side, by the hangar
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.add(new THREE.CylinderGeometry(0.28, 0.28, 3.6, 10).rotateX(Math.PI / 2).rotateY(sx * 0.5).translate(sx * (B / 2 - 2.2), F + 0.6 + i * 0.6, Z(0.37)), C('#5d6469'));
  // the hangar: its door aft, the close-in gun on its roof, the second mast
  const hf = Z(0.355), hb = Z(0.2), hy = F;
  stealth(k, { w: B * 0.82, h: 5.2, d: hb - hf, y: hy, z: (hf + hb) / 2, lean: 0.1, col: grey });
  box(k, B * 0.55, 4.3, 0.12, 0, hy, hb + 0.02, '#8b9297');
  for (let i = 1; i < 6; i++) box(k, B * 0.55, 0.05, 0.14, 0, hy + i * 0.72, hb + 0.04, '#6c7378'); // its slats
  const cz = Z(0.27), cy = hy + 5.2;
  k.add(new THREE.CylinderGeometry(1.0, 1.2, 1.2, 10).translate(0, cy + 0.6, cz), S);
  box(k, 1.6, 1.0, 2.0, 0, cy + 1.2, cz, grey);
  k.add(new THREE.SphereGeometry(0.85, 14, 10, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, 1.5, 1).translate(0, cy + 2.2, cz + 0.2), C('#e6e7e3'));
  k.add(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8).rotateX(Math.PI / 2).translate(0, cy + 1.6, cz - 1.8), C(dark));
  k.add(new THREE.CylinderGeometry(0.15, 0.3, 6, 6).translate(0, cy + 3, Z(0.31)), S);
  box(k, 2.2, 0.12, 0.12, 0, cy + 4.6, Z(0.31), dark);
  box(k, 1.8, 0.4, 0.3, 0, cy + 5.3, Z(0.31), lite);
  // the flight deck: the landing circle, the line to it, the deck edges
  const W = C('#e6e6e1');
  k.add(new THREE.RingGeometry(3.6, 3.85, 40).rotateX(-Math.PI / 2).translate(0, F + 0.05, Z(0.1)), W);
  box(k, 0.25, 0.04, 16, 0, F, Z(0.12), W);
  box(k, 7, 0.04, 0.25, 0, F, Z(0.035), W);
  for (const sx of [-1, 1]) box(k, 0.2, 0.04, Z(0.02) - Z(0.2), sx * (B / 2 - 1.1), F, (Z(0.02) + Z(0.2)) / 2, '#d4c25a');
  // the staffs at bow and stern
  box(k, 0.1, 3.2, 0.1, 0, D(0.985), Z(0.985), dark);
  box(k, 0.12, 4.5, 0.12, 0, F, Z(0.012), dark);
  number(k, h, String(100 + Math.floor(Math.random() * 900)), 0.885, F * 0.55 + 0.6, 2.4);
  return { k, h, kn: [15, 24] };
}

// a submarine on the surface, 100 m: a round hull nearly all under water and only her back awash, its rubber tiles
// each a slightly different black, a few gone; the casing along her back with its hatches and bollards; the fin
// standing up forward, tapering aft, with its planes, the bridge on top and two of her crew in it, and the masts —
// periscope, snorkel, radar — raised behind them; the upper rudder showing astern; the sea breaking over her nose
function submarine() {
  const k = new Kit(), L = 100, R = 5.2, cy = -3.9, Z = (u) => L / 2 - u * L;
  const tile = (x, y, z) => {
    const a = Math.round(Math.atan2(y - cy, x) * 9), b = Math.round(z / 1.4), r = hash(a, b);
    return C(r > 0.985 ? '#3a3f3c' : '#202326').multiplyScalar(0.85 + 0.25 * hash(b, a, 3));
  };
  const nose = 13, tail = 22, len = L - nose - tail, z0 = -L / 2 + nose;
  k.add(new THREE.CylinderGeometry(R, R, len, 40, Math.round(len / 1.4), true).rotateX(Math.PI / 2).translate(0, cy, z0 + len / 2), tile);
  k.add(new THREE.SphereGeometry(R, 40, 20).scale(1, 1, nose / R).translate(0, cy, z0), tile);
  k.add(new THREE.ConeGeometry(R, tail, 40, 14, true).rotateX(Math.PI / 2).translate(0, cy, z0 + len + tail / 2), tile);
  // the casing: a flat deck along her back, its hatches, the bollards fore and aft
  const top = cy + R, cs = C('#24272a');
  box(k, 3.4, 0.35, len + nose * 0.55, 0, top - 0.25, z0 + len / 2 - nose * 0.22, cs);
  for (const z of [z0 + 4, z0 + 40, z0 + len - 6]) box(k, 1.4, 0.12, 1.8, 0, top + 0.1, z, C('#26292b'));
  for (const z of [z0 + 1, z0 + len - 2]) for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).translate(sx * 1.2, top + 0.4, z), C('#2a2d2f'));
  // the fin: rounded in front, tapering aft, its top rounded off
  const s = new THREE.Shape(), fl = 15, fw = 1.5, ft = top + 8.2, fz = -L / 2 + 26, black = C('#1c1f22');
  s.moveTo(0, fl);
  s.bezierCurveTo(fw * 1.05, fl, fw, fl * 0.8, fw, fl * 0.62);
  s.bezierCurveTo(fw, fl * 0.35, fw * 0.6, fl * 0.1, fw * 0.3, 0);
  s.lineTo(-fw * 0.3, 0);
  s.bezierCurveTo(-fw * 0.6, fl * 0.1, -fw, fl * 0.35, -fw, fl * 0.62);
  s.bezierCurveTo(-fw, fl * 0.8, -fw * 1.05, fl, 0, fl);
  k.add(new THREE.ExtrudeGeometry(s, { depth: ft - 0.3, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 2, curveSegments: 8 }).rotateX(-Math.PI / 2).translate(0, 0, fz + fl / 2), panels('#1e2124', 1.4, 0.1));
  const ff = fz - fl / 2; // its front
  // the fairwater planes, either side, a little below the top
  for (const sx of [-1, 1]) {
    const p = new THREE.Shape([[0, 0], [3.6, 0.5], [3.6, 2.0], [0, 2.9]].map(([a, b]) => new THREE.Vector2(a, b)));
    k.add(new THREE.ExtrudeGeometry(p, { depth: 0.3, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, ft - 2.6, 0).scale(sx, 1, 1).translate(sx * fw * 0.9, 0, ff + 3), black);
  }
  // the bridge: its windscreen, two of the crew; then the masts
  box(k, 1.6, 0.6, 0.1, 0, ft, ff + 1.3, C('#2a3640'));
  figure(k, -0.35, ft - 0.9, ff + 2.2); figure(k, 0.4, ft - 0.9, ff + 2.6, '#29313b');
  const masts = [[3.4, 4.2, 0.16, 'peri'], [4.6, 3.0, 0.2, 'peri'], [6.0, 2.4, 0.42, 'snort'], [7.6, 3.4, 0.14, 'radar'], [9.0, 1.6, 0.12, 'whip']];
  for (const [dz, ht, r, kind] of masts) {
    if (Math.random() < 0.25 && kind !== 'peri') continue; // not every mast is up
    const mz = ff + dz, mc = C('#25282b');
    k.add(new THREE.CylinderGeometry(r, r * 1.1, ht, 10).translate(0, ft + ht / 2, mz), mc);
    if (kind === 'peri') k.add(new THREE.CylinderGeometry(r * 1.5, r * 1.3, 0.7, 10).translate(0, ft + ht + 0.35, mz), mc);
    if (kind === 'snort') box(k, 1.0, 0.8, 0.6, 0, ft + ht, mz, mc);
    if (kind === 'radar') box(k, 1.4, 0.35, 0.3, 0, ft + ht, mz, mc);
  }
  // the upper rudder: leading edge raked, trailing edge upright
  const rp = new THREE.Shape([[0, 0], [7.5, 0], [6.8, 6.6], [3.6, 6.6]].map(([a, b]) => new THREE.Vector2(a, b)));
  k.add(new THREE.ExtrudeGeometry(rp, { depth: 0.6, bevelEnabled: false }).translate(0, 0, -0.3).rotateY(-Math.PI / 2).translate(0, -3.4, L / 2 - 9.5), black);
  // what the wake needs: her breadth at the water, and her side's points; the sea washing over her nose and casing
  const bw = Math.sqrt(R * R - cy * cy), hw = (u) => bw * Math.min(1, Math.sqrt(Math.max(0, (1 - u) * L / nose)), Math.sqrt(Math.max(0, u * L / tail)));
  return { k, h: { L, B: 2 * bw, hw, hd: hw, Z, deckY: () => top, at: (u, y) => [hw(u), y, Z(u)], over: { z0: -L / 2, z1: ff - 2, y: top + 0.05, w: 3.6 } }, kn: [10, 15] };
}

const KINDS = [[tanker, 0.3], [container, 0.27], [bulk, 0.17], [cruise, 0.1], [corvette, 0.1], [submarine, 0.06]];
// at anchor in a port's roads, waiting for a berth: the cargo ships, never a navy's
const ANCHORED = [[tanker, 0.4], [container, 0.25], [bulk, 0.35]];
function build(kinds = KINDS) {
  let r = Math.random() * kinds.reduce((a, k) => a + k[1], 0);
  for (const [f, w] of kinds) { if ((r -= w) <= 0) return f(); }
  return tanker();
}

// ---------- the water she moves: per vertex an alpha, broken up into foam in the shader ----------
function foam(h, v) {
  const p = [], a = [], { L, B, hw, Z } = h, k = Math.min(1, v / 7);
  const q = (A, Bv, Cv, Dv, aa, ab, ac, ad) => { p.push(...A, ...Bv, ...Cv, ...A, ...Cv, ...Dv); a.push(aa, ab, ac, aa, ac, ad); };
  for (const sx of [-1, 1]) {
    // the wash along her sides, whiter forward
    for (let i = 0; i < 60; i++) {
      const u0 = i / 60, u1 = (i + 1) / 60, w0 = hw(u0) + 0.2, w1 = hw(u1) + 0.2;
      const a0 = (0.3 + 0.5 * smooth(0.6, 1, u0)) * k, a1 = (0.3 + 0.5 * smooth(0.6, 1, u1)) * k;
      q([sx * w0, 0.25, Z(u0)], [sx * w1, 0.25, Z(u1)], [sx * (w1 + 3), 0.25, Z(u1)], [sx * (w0 + 3), 0.25, Z(u0)], a0, a1, 0, 0);
    }
    // the bow wave climbing her stem, standing just off her flaring side
    const up = (u, y) => { const [b, yy, z] = h.at(u, y); return [sx * (b + 0.4), yy, z]; };
    for (let i = 0; i < 16; i++) {
      const u0 = 0.84 + (0.16 * i) / 16, u1 = 0.84 + (0.16 * (i + 1)) / 16;
      const t0 = 0.4 * v * Math.pow(smooth(0.84, 1, u0), 1.5), t1 = 0.4 * v * Math.pow(smooth(0.84, 1, u1), 1.5);
      for (let j = 0; j < 3; j++) { // in three bands up, so it hugs the flare
        const a = j / 3, b = (j + 1) / 3, al = (f) => 0.95 * k * (1 - f);
        q(up(u0, t0 * a), up(u1, t1 * a), up(u1, t1 * b), up(u0, t0 * b), al(a), al(a), al(b), al(b));
      }
    }
    // the waves spreading from her bow, 19.5° off her track
    const len = 0.45 * L, s = Math.sin(0.34), c = Math.cos(0.34);
    for (let i = 0; i < 20; i++) {
      const t0 = i / 20, t1 = (i + 1) / 20, P = (t, out) => [sx * (t * len * s + out), 0.2, Z(1) + t * len * c];
      q(P(t0, 0), P(t1, 0), P(t1, 2 + 5 * t1), P(t0, 2 + 5 * t0), 0.6 * k * (1 - t0) ** 1.5, 0.6 * k * (1 - t1) ** 1.5, 0, 0);
    }
  }
  // a submarine's: the sea washing over her nose and along her casing, white in front, thinning aft
  if (h.over) {
    const { z0, z1, y, w } = h.over, n = 20;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, za = lerp(z0, z1, t0), zb = lerp(z0, z1, t1), al = (t) => 0.95 * k * (1 - t) ** 1.2;
      const wa = w * (0.6 + 0.8 * t0), wb = w * (0.6 + 0.8 * t1);
      q([-wa, y, za], [wa, y, za], [wb, y, zb], [-wb, y, zb], al(t0), al(t0), al(t1), al(t1));
    }
  }
  // her wake: white close astern, spreading and dying away over a few lengths
  for (let i = 0; i < 40; i++) {
    const t0 = i / 40, t1 = (i + 1) / 40, z0 = L / 2 + t0 * 5 * L, z1 = L / 2 + t1 * 5 * L;
    const w0 = B * 0.35 + t0 * B * 0.9, w1 = B * 0.35 + t1 * B * 0.9, a0 = 0.75 * k * (1 - t0) ** 1.6, a1 = 0.75 * k * (1 - t1) ** 1.6;
    for (const sx of [-1, 1]) q([0, 0.2, z0], [0, 0.2, z1], [sx * w1, 0.2, z1], [sx * w0, 0.2, z0], a0, a1, a1 * 0.3, a0 * 0.3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(a, 1));
  g.computeBoundingSphere();
  return g;
}

// ---------- how they're drawn ----------
// lit by the sky and the sun, the glass reflecting the sky and glinting; hazed as the far hills are (skopea.js): the
// sky's colour at the horizon that way, thicker with the distance; at the far end of her track, lost in it altogether
const HAZE = /* glsl */ `
float keepAt(float dist) { return 1.0 - smoothstep(${FADE[0].toFixed(1)}, ${FADE[1].toFixed(1)}, dist); }
vec3 hazed(vec3 col, vec3 rel, float dist) {
  float hf = 0.92 * (1.0 - exp(-dist * 0.6 / uHazeL));
  return mix(col, skyBase(normalize(vec3(rel.x, 0.0, rel.z) + vec3(0.0, 1e-4, 0.0))), hf);
}`;
const VS = /* glsl */ `
attribute vec3 color; attribute float aShine; varying vec3 vCol, vN, vRel; varying float vShine;
void main() {
  vCol = color; vShine = aShine; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vRel = w.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */ `
uniform float uHazeL; varying vec3 vCol, vN, vRel; varying float vShine;
${SKY_GLSL}
${HAZE}
void main() {
  float dist = length(vRel);
  if (keepAt(dist) < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = vRel / dist, r = reflect(v, n);
  vec3 amb = mix(uHorizon, uTop, 0.5 + 0.5 * n.y) * 0.62;
  vec3 col = vCol * (amb + uSunCol * max(dot(n, uSun), 0.0) * 0.95);
  if (vShine > 0.5) {
    float fr = 0.1 + 0.6 * pow(1.0 - max(dot(-v, n), 0.0), 4.0);
    col = mix(col, skyBase(vec3(r.x, abs(r.y), r.z)) * 0.8, fr);
    col += uSunCol * pow(max(dot(r, uSun), 0.0), 300.0) * 5.0;
  } else {
    col += uSunCol * pow(max(dot(r, uSun), 0.0), 24.0) * 0.06;
  }
  gl_FragColor = vec4(hazed(col, vRel, dist), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FOAM_VS = /* glsl */ `
attribute float aA; varying float vA; varying vec3 vW, vRel;
void main() {
  vA = aA; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vRel = w.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FOAM_FS = /* glsl */ `
uniform float uHazeL, uTime; uniform vec3 uFoamCol; varying float vA; varying vec3 vW, vRel;
${SKY_GLSL}
${HAZE}
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float dist = length(vRel);
  vec2 p = vW.xz + vec2(0.0, vW.y * 4.0);
  float n = 0.6 * vn(p * 0.22 + vec2(uTime * 0.15, 0.0)) + 0.4 * vn(p * 0.8 - uTime * 0.4);
  float a = min(1.0, vA * 1.2) * smoothstep(0.2, 0.6, n + vA * 0.45) * keepAt(dist);
  vec3 col = uFoamCol * mix(vec3(0.95), uSunCol, 0.2);
  gl_FragColor = vec4(hazed(col, vRel, dist), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Ships {
  // skyU: the sky's uniforms (light.js), for the light and the haze
  constructor(skyU) {
    this.group = new THREE.Group();
    const haze = { value: 7700 };
    this.time = { value: 0 };
    this.mat = new THREE.ShaderMaterial({ uniforms: { ...skyU, uHazeL: haze }, vertexShader: VS, fragmentShader: FS, fog: false, side: THREE.DoubleSide });
    this.foamMat = new THREE.ShaderMaterial({ uniforms: { ...skyU, uHazeL: haze, uTime: this.time }, vertexShader: FOAM_VS, fragmentShader: FOAM_FS, fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.list = []; this.timer = Infinity; this.marks = [];
    this.on = !NONE.has(VENUE.id);
  }
  // the haze as thick as the land's (skopea.js)
  setLight(L) { this.mat.uniforms.uHazeL.value = L.fogFar * 2.4 * (VENUE.look.haze ?? 1); }

  // ground(x, z): the land's height in the race's coordinates (below 0, the sea's floor)
  reset(race, ground) {
    for (const s of this.list) this.drop(s);
    this.list = [];
    this.ground = ground || (() => -20);
    this.marks = [{ x: 0, z: 0 }, ...Object.values(race?.course?.marks || {})];
    this.timer = rnd(90, 240);
    if (!this.on) return;
    // the ships at anchor in the roads off a port (venues.js anchored: how many), most of them upwind, where the beat looks
    for (let i = 0; i < (VENUE.anchored || 0); i++) this.moor();
    // the offing isn't empty when you get there: one or two already on their way across it
    for (let i = 0, n = Math.random() < 0.5 ? 1 : 2; i < n; i++) this.spawn(rnd(0.25, 0.75));
  }

  // a track across the offing, in open water all the way and clear of the course and of the others; along: how far
  // along it she is
  spawn(along = 0) {
    const mx = this.marks.reduce((a, m) => a + m.x, 0) / this.marks.length, mz = this.marks.reduce((a, m) => a + m.z, 0) / this.marks.length;
    const ship = build(), speed = rnd(ship.kn[0], ship.kn[1]) * KN;
    for (let tries = 0; tries < 40; tries++) {
      const h = rnd(0, 2 * Math.PI), D = rnd(NEAR, FAR) * (Math.random() < 0.5 ? -1 : 1), half = Math.sqrt(REACH * REACH - D * D);
      const fx = Math.sin(h), fz = -Math.cos(h), nx = Math.cos(h), nz = Math.sin(h);
      const cx = mx + nx * D, cz = mz + nz * D, x0 = cx - fx * half, z0 = cz - fz * half;
      // clear of every mark
      if (this.marks.some((m) => Math.abs((m.x - cx) * nx + (m.z - cz) * nz) < CLEAR)) continue;
      // open water under her and either side, all the way
      let ok = true;
      for (let s = 0; s <= 2 * half && ok; s += 90) {
        const x = x0 + fx * s, z = z0 + fz * s;
        ok = this.ground(x, z) < SEA && this.ground(x + nx * ROOM, z + nz * ROOM) < SEA && this.ground(x - nx * ROOM, z - nz * ROOM) < SEA;
      }
      if (!ok) continue;
      // no nearer than 600 m to another while both are out there
      const me = { x0, z0, f: { x: fx, z: fz }, s: along * 2 * half, len: 2 * half, v: speed };
      if (this.list.some((o) => closest(me, o) < 600)) continue;
      // the ship rolls a little in the swell; her wake, on the water, doesn't
      const g = new THREE.Group(), mesh = new THREE.Mesh(ship.k.geometry(), this.mat), wake = new THREE.Mesh(foam(ship.h, speed), this.foamMat);
      mesh.rotation.order = 'YXZ'; wake.renderOrder = 1;
      g.add(mesh, wake); g.rotation.y = -h;
      this.group.add(g);
      Object.assign(me, { g, mesh, wake, h, k: Math.random() * 10 });
      this.place(me, 0);
      this.list.push(me);
      return me;
    }
    return null;
  }
  // a ship lying at anchor, 1.6 to 4.5 km off the course, head to the wind (the game's north) give or take a little as she
  // swings to it; in open water with room round her for her swing, and clear of the course and of the others
  moor() {
    const mx = this.marks.reduce((a, m) => a + m.x, 0) / this.marks.length, mz = this.marks.reduce((a, m) => a + m.z, 0) / this.marks.length;
    const ship = build(ANCHORED);
    for (let tries = 0; tries < 60; tries++) {
      const b = rnd(-1.4, 1.4) + (Math.random() < 0.25 ? Math.PI : 0), d = rnd(1600, 4500); // (a bearing from upwind, radians)
      const x = mx + Math.sin(b) * d, z = mz - Math.cos(b) * d;
      if (this.marks.some((m) => Math.hypot(m.x - x, m.z - z) < CLEAR)) continue;
      if ([[0, 0], [300, 0], [-300, 0], [0, 300], [0, -300]].some(([ox, oz]) => this.ground(x + ox, z + oz) >= SEA)) continue;
      if (this.list.some((o) => Math.hypot(o.x0 + o.f.x * o.s - x, o.z0 + o.f.z * o.s - z) < 500)) continue;
      const h = rnd(-0.35, 0.35), g = new THREE.Group(), mesh = new THREE.Mesh(ship.k.geometry(), this.mat), wake = new THREE.Mesh(foam(ship.h, 0.3), this.foamMat);
      mesh.rotation.order = 'YXZ'; wake.renderOrder = 1;
      g.add(mesh, wake); g.rotation.y = -h;
      this.group.add(g);
      const me = { x0: x, z0: z, f: { x: Math.sin(h), z: -Math.cos(h) }, s: 0, len: Infinity, v: 0, g, mesh, wake, h, k: Math.random() * 10, anchored: true };
      this.place(me, 0);
      this.list.push(me);
      return me;
    }
    return null;
  }
  drop(s) { this.group.remove(s.g); s.mesh.geometry.dispose(); s.wake.geometry.dispose(); }
  place(s, t) {
    s.g.position.set(s.x0 + s.f.x * s.s, 0, s.z0 + s.f.z * s.s);
    s.mesh.rotation.x = 0.002 * Math.sin(t * 0.21 + s.k); s.mesh.rotation.z = 0.004 * Math.sin(t * 0.17 + s.k);
  }

  update(dt) {
    if (!this.on || !this.ground) return;
    this.t = (this.t || 0) + dt; this.time.value = this.t;
    this.timer -= dt;
    if (this.timer <= 0 && dt > 0) { this.timer = rnd(150, 360); if (this.list.filter((o) => !o.anchored).length < MAX) this.spawn(0); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.s += s.v * dt;
      if (s.s > s.len) { this.drop(s); this.list.splice(i, 1); continue; }
      this.place(s, this.t);
    }
  }
}

// how close two ships on their tracks come while both are still on them, metres
function closest(a, b) {
  const px = a.x0 + a.f.x * a.s - (b.x0 + b.f.x * b.s), pz = a.z0 + a.f.z * a.s - (b.z0 + b.f.z * b.s);
  const vx = a.f.x * a.v - b.f.x * b.v, vz = a.f.z * a.v - b.f.z * b.v, vv = vx * vx + vz * vz;
  const T = Math.min((a.len - a.s) / a.v, (b.len - b.s) / b.v), t = vv > 1e-9 ? Math.min(T, Math.max(0, -(px * vx + pz * vz) / vv)) : 0;
  return Math.hypot(px + vx * t, pz + vz * t);
}
