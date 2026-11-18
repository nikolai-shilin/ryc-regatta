// Regatta: the airliners themselves, built from their published dimensions: the Boeing 737-800 and 777-300ER, the Airbus
// A320-200 and A350-900. Each has her own nose, tail, wing tips, engines and undercarriage, so you can tell them apart as
// you can the real ones, and flies clean or with her flaps, slats and wheels down. Only geometry: airliners.js flies them.
import * as THREE from 'three';

const RAD = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- the types, in metres from the nose ----------
// L length; R half the fuselage's width; q its height over its width; nose, tail the lengths that taper; semi half the
// span; root the wing's leading edge at the fuselage; chords at the root, the kink and the tip; sweep of the leading edge
// and dihedral (degrees); y the wing's height on the fuselage; flex how far the tips bend up in flight; flaps how many
// slotted elements; doors, exits along her; winY the height of the windows
export const TYPES = {
  b738: {
    id: 'b738', maker: 'boeing', wide: false, L: 39.47, R: 1.88, q: 1.066, nose: 6.1, tail: 12.6, semi: 17.9, root: 13.7, chords: [7.5, 4.25, 1.25], sweep: 28, dihedral: 6, y: -1.2, flex: 0.45, tip: 'blended', flaps: 3,
    fin: { z: 30.9, c: 6.5, ct: 1.75, h: 7.25, sweep: 37, fillet: 4.2 }, stab: { z: 33.65, semi: 7.17, c: 3.9, ct: 1.15, sweep: 33, y: 0.72, dihedral: 7 },
    eng: { R: 1.02, len: 4.2, x: 4.83, y: -2.02, ahead: 2.05, flat: 0.8, strake: true }, gear: { axles: 1, x: 2.86, h: 0.95, z: 20.3, nose: 4.7, r: 0.56, doors: false },
    doors: [6.05, 32.4], exits: [16.6, 17.6], door: [0.86, 1.83], winY: 0.42, pitch: 0.508, canoes: [0.25, 0.46, 0.67],
  },
  a320: {
    id: 'a320', maker: 'airbus', wide: false, L: 37.57, R: 1.975, q: 1.048, nose: 6.3, tail: 11.8, semi: 17.9, root: 12.6, chords: [7.2, 4.05, 1.5], sweep: 27.5, dihedral: 5.1, y: -1.25, flex: 0.45, tip: 'sharklet', flaps: 1,
    fin: { z: 29.4, c: 6.1, ct: 2.25, h: 5.75, sweep: 35, fillet: 1.6 }, stab: { z: 32.3, semi: 6.22, c: 3.6, ct: 1.3, sweep: 31, y: 0.86, dihedral: 6 },
    eng: { R: 1.1, len: 4.45, x: 5.75, y: -2.6, ahead: 2.45, flat: 1 }, gear: { axles: 1, x: 3.8, h: 1.5, z: 17.75, nose: 5.07, r: 0.58, doors: true },
    doors: [6.45, 31.2], exits: [15.8, 16.8], door: [0.81, 1.85], winY: 0.46, pitch: 0.533, canoes: [0.26, 0.47, 0.68],
  },
  b77w: {
    id: 'b77w', maker: 'boeing', wide: true, L: 73.86, R: 3.1, q: 1, nose: 10.2, tail: 19.5, semi: 32.4, root: 27.2, chords: [14.4, 7.3, 2.4], sweep: 34, dihedral: 6, y: -2.1, flex: 1.5, tip: 'raked', flaps: 2,
    fin: { z: 59.5, c: 10.9, ct: 3.3, h: 9.6, sweep: 39, fillet: 3.6 }, stab: { z: 63.95, semi: 10.75, c: 6.9, ct: 2.1, sweep: 36, y: 1.25, dihedral: 7.5 },
    eng: { R: 2.2, len: 7.4, x: 9.65, y: -3.75, ahead: 3.6, flat: 1 }, gear: { axles: 3, x: 5.48, h: 2.25, z: 39, nose: 7.8, r: 0.66, doors: true },
    doors: [9.4, 22.6, 44.5, 54.6, 65.2], exits: [], door: [1.07, 1.88], winY: 0.75, pitch: 0.533, canoes: [0.2, 0.36, 0.53, 0.69],
  },
  a359: {
    id: 'a359', maker: 'airbus', wide: true, L: 66.8, R: 2.98, q: 1.02, nose: 9.6, tail: 17.5, semi: 32.37, root: 24.4, chords: [13.4, 7.2, 2], sweep: 35, dihedral: 5.6, y: -2, flex: 2, tip: 'curved', flaps: 1,
    fin: { z: 53.2, c: 10.5, ct: 3.2, h: 8.59, sweep: 38, fillet: 2.4 }, stab: { z: 58.2, semi: 9.75, c: 6.1, ct: 1.9, sweep: 34, y: 1.15, dihedral: 6 },
    eng: { R: 1.88, len: 6.6, x: 9.55, y: -3.4, ahead: 3.2, flat: 1 }, gear: { axles: 2, x: 5.3, h: 2.05, z: 35.9, nose: 7.2, r: 0.68, doors: true },
    doors: [9.4, 23.2, 45.2, 59.2], exits: [], door: [1.07, 1.88], winY: 0.78, pitch: 0.53, canoes: [0.24, 0.45, 0.67], mask: true,
  },
};

// her lines, seen from the side and from above, as [along the taper, top, bottom, half width], in units of R. The nose
// is what you know a type by first: the 737's long, drooping and pointed, the A320's short and round, the 777's full,
// the A350's sharp with its raked windscreen. The tail: the Boeings' a long wedge, the Airbuses' ending in a blunt cone
const LINES = {
  b738: {
    nose: [[0, -0.42, -0.42, 0], [0.012, -0.24, -0.58, 0.15], [0.05, -0.08, -0.74, 0.33], [0.13, 0.08, -0.9, 0.55], [0.26, 0.26, -1.0, 0.74], [0.42, 0.54, -1.05, 0.89], [0.6, 0.86, -1.066, 0.97], [0.8, 1.03, -1.066, 1], [1, 1.066, -1.066, 1]],
    tail: [[0, 1.066, -1.066, 1], [0.2, 1.066, -0.86, 0.96], [0.4, 1.03, -0.52, 0.84], [0.6, 0.97, -0.1, 0.63], [0.8, 0.87, 0.34, 0.35], [0.94, 0.77, 0.6, 0.13], [1, 0.72, 0.66, 0.05]],
  },
  a320: {
    nose: [[0, -0.22, -0.22, 0], [0.012, -0.02, -0.46, 0.22], [0.05, 0.16, -0.66, 0.45], [0.13, 0.34, -0.84, 0.68], [0.26, 0.54, -0.96, 0.85], [0.42, 0.78, -1.02, 0.95], [0.6, 0.97, -1.048, 0.99], [0.8, 1.04, -1.048, 1], [1, 1.048, -1.048, 1]],
    tail: [[0, 1.048, -1.048, 1], [0.2, 1.048, -0.84, 0.96], [0.4, 1.02, -0.5, 0.84], [0.6, 0.98, -0.08, 0.66], [0.8, 0.9, 0.3, 0.42], [0.95, 0.8, 0.54, 0.17], [1, 0.76, 0.6, 0.1]],
  },
  b77w: {
    nose: [[0, -0.26, -0.26, 0], [0.012, -0.06, -0.46, 0.2], [0.05, 0.1, -0.66, 0.43], [0.13, 0.3, -0.84, 0.67], [0.26, 0.5, -0.95, 0.84], [0.42, 0.72, -0.99, 0.94], [0.6, 0.91, -1, 0.985], [0.8, 0.99, -1, 1], [1, 1, -1, 1]],
    tail: [[0, 1, -1, 1], [0.2, 1, -0.84, 0.95], [0.4, 0.98, -0.5, 0.8], [0.6, 0.94, -0.12, 0.57], [0.8, 0.86, 0.22, 0.29], [0.95, 0.78, 0.44, 0.08], [1, 0.76, 0.48, 0.03]],
  },
  a359: {
    nose: [[0, -0.3, -0.3, 0], [0.012, -0.12, -0.46, 0.17], [0.05, 0.03, -0.64, 0.38], [0.13, 0.2, -0.82, 0.61], [0.26, 0.38, -0.94, 0.79], [0.42, 0.64, -1.0, 0.91], [0.6, 0.93, -1.02, 0.98], [0.8, 1.01, -1.02, 1], [1, 1.02, -1.02, 1]],
    tail: [[0, 1.02, -1.02, 1], [0.2, 1.02, -0.84, 0.96], [0.4, 1, -0.5, 0.82], [0.6, 0.96, -0.1, 0.6], [0.8, 0.88, 0.26, 0.34], [0.95, 0.8, 0.48, 0.14], [1, 0.78, 0.53, 0.08]],
  },
};

// the flight deck's windows. screen: the windscreen as you see it from dead ahead, in units of R: the height of its bottom
// and top at the centre post, then the outer corners [out, up] at its bottom and top. rear: the back edge of each side
// window behind it, [along the nose, height] at its bottom and top. tip: where the A350's dark mask sweeps back to
const DECK = {
  b738: { screen: [0.3, 0.62, [0.82, 0.22], [0.66, 0.6]], rear: [[0.7, 0.22, 0.73, 0.6], [0.84, 0.22, 0.79, 0.5]] },
  a320: { screen: [0.38, 0.72, [0.84, 0.28], [0.68, 0.68]], rear: [[0.68, 0.28, 0.7, 0.68], [0.77, 0.28, 0.785, 0.66], [0.855, 0.28, 0.825, 0.52]] },
  b77w: { screen: [0.3, 0.62, [0.82, 0.22], [0.66, 0.58]], rear: [[0.69, 0.22, 0.72, 0.58], [0.83, 0.22, 0.785, 0.48]] },
  a359: { screen: [0.32, 0.66, [0.84, 0.24], [0.68, 0.62]], rear: [[0.7, 0.24, 0.73, 0.6], [0.84, 0.23, 0.8, 0.5]], tip: [0.9, 0.36] },
};

// no real airline's: only colours and a mark on the fin. body above, belly under, a stripe where they meet (none: no
// stripe), the fin, its mark and the mark's colour, the engines; rise: how far the belly's colour sweeps up her tail
export const LIVERIES = [
  { body: '#f4f5f5', belly: '#f4f5f5', stripe: '#14375e', fin: '#14375e', mark: 'band', tint: '#d6392e', eng: '#14375e', rise: 0.5 },
  { body: '#f4f5f5', belly: '#c3c9cd', stripe: null, fin: '#0e7f86', mark: 'disc', tint: '#f2b431', eng: '#0e7f86', rise: 0 },
  { body: '#f5f3ee', belly: '#b3342b', stripe: '#f4c04a', fin: '#b3342b', mark: 'bars', tint: '#f4c04a', eng: '#f5f3ee', rise: 0.62 },
  { body: '#f4f5f5', belly: '#2c2a6b', stripe: '#d83a7c', fin: '#2c2a6b', mark: 'band', tint: '#d83a7c', eng: '#2c2a6b', rise: 0.62 },
  { body: '#1d5fa6', belly: '#eef1f3', stripe: '#eef1f3', fin: '#1d5fa6', mark: 'disc', tint: '#eef1f3', eng: '#1d5fa6', rise: 0.35 },
  { body: '#f4f5f5', belly: '#1f7a52', stripe: '#9fcb3b', fin: '#1f7a52', mark: 'bars', tint: '#9fcb3b', eng: '#f4f5f5', rise: 0.55 },
];

const GLASS = '#1a2630', LINE = '#9aa1a7', GREY = '#c9ced2', UNDER = '#a6adb3', STEEL = '#c6ccd1', DARK = '#17191b';

// ---------- building: every cell its own colour, the normals smooth across them ----------
const colours = new Map();
const colour = (hex) => { let c = colours.get(hex); if (!c) colours.set(hex, c = new THREE.Color(hex)); return c; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
class Kit {
  constructor() { this.p = []; this.n = []; this.c = []; }
  // a grid of cells: at(i, j) → a point, for i 0…nu, j 0…nv; col(i, j) → the colour of the cell from there; wrap: i goes
  // round; worn: each panel a shade off the next, as real paint is. Faces outward by the volume it encloses, or, for a
  // piece of skin, away from the point `from`
  patch(nu, nv, at, col, { wrap = false, from = null, worn = 0, facing = null } = {}) {
    const W = nu + 1, P = [], N = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(at(wrap ? i % nu : i, j));
    const id = (i, j) => (wrap ? ((i % nu) + nu) % nu : clamp(i, 0, nu)) + clamp(j, 0, nv) * W;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const n = cross(sub(P[id(i + 1, j)], P[id(i - 1, j)]), sub(P[id(i, j + 1)], P[id(i, j - 1)])), l = Math.sqrt(dot(n, n));
      N.push(l > 1e-9 ? [n[0] / l, n[1] / l, n[2] / l] : null);
    }
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) if (!N[i + j * W]) N[i + j * W] = N[i + clamp(j + (j < nv / 2 ? 1 : -1), 0, nv) * W] || [0, 1, 0]; // where the cells close to a point
    let volume = 0; const c0 = P[0];
    const each = (fn) => { for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) fn(i, j, i + j * W, i + 1 + j * W, i + 1 + (j + 1) * W, i + (j + 1) * W); };
    each((i, j, a, b, c, d) => { volume += dot(sub(P[a], c0), cross(sub(P[b], c0), sub(P[c], c0))) + dot(sub(P[a], c0), cross(sub(P[c], c0), sub(P[d], c0))); });
    let flip = volume < 0;
    if (from) { const m = Math.floor(nv / 2) * W + Math.floor(nu / 2); flip = dot(N[m], sub(P[m], from)) < 0; }
    each((i, j, a, b, c, d) => {
      const k = colour(col(i, j)), t = worn ? 1 + worn * (hash(i, j) - 0.5) : 1;
      for (const v of flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]) {
        const q = P[v], s = flip ? -1 : 1, n = facing ? facing(v % W % (wrap ? nu : W), Math.floor(v / W)).map((x) => x * s) : N[v]; // (facing: lit as told, not by the cells' own slope)
        this.p.push(q[0], q[1], q[2]); this.n.push(n[0] * s, n[1] * s, n[2] * s); this.c.push(k.r * t, k.g * t, k.b * t);
      }
    });
  }
  // a three.js shape, all one colour
  add(g, hex) {
    if (g.index) g = g.toNonIndexed();
    const P = g.attributes.position, N = g.attributes.normal, k = colour(hex);
    for (let i = 0; i < P.count; i++) { this.p.push(P.getX(i), P.getY(i), P.getZ(i)); this.n.push(N.getX(i), N.getY(i), N.getZ(i)); this.c.push(k.r, k.g, k.b); }
    g.dispose();
  }
  geometry(dz) {
    const p = Float32Array.from(this.p); for (let i = 2; i < p.length; i += 3) p[i] += dz;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(this.n), 3));
    g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(this.c), 3));
    return g;
  }
}
const rod = (k, a, b, r, hex, segs = 8) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  const g = new THREE.CylinderGeometry(r, r, l, segs).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  k.add(g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), hex);
};

// ---------- the fuselage ----------
// a table of her lines, read smoothly; along the nose by the square root, as a round nose grows fastest at its very tip
function lines(rows, root) {
  const T = rows.map((r) => (root ? Math.sqrt(r[0]) : r[0])), n = rows.length;
  return (u) => {
    const t = root ? Math.sqrt(clamp(u, 0, 1)) : clamp(u, 0, 1);
    let i = 0; while (i < n - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i], s = (t - T[i]) / h, s2 = s * s, s3 = s2 * s;
    return [1, 2, 3].map((c) => {
      const a = rows[i][c], b = rows[i + 1][c];
      const m0 = i ? (b - rows[i - 1][c]) / (T[i + 1] - T[i - 1]) : (b - a) / h, m1 = i < n - 2 ? (rows[i + 2][c] - a) / (T[i + 2] - T[i]) : (b - a) / h;
      return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * h * m1;
    });
  };
}
// the shape of her at z: half width, the height of the middle, half height
function bodyOf(T) {
  const L = LINES[T.id], nose = lines(L.nose, true), tail = lines(L.tail, false), start = T.L - T.tail;
  return (z) => {
    const [top, bot, w] = z < T.nose ? nose(z / T.nose) : z > start ? tail((z - start) / T.tail) : [T.q, -T.q, 1];
    return { w: Math.max(0, w) * T.R, c: (top + bot) / 2 * T.R, ry: Math.max(0, top - bot) / 2 * T.R };
  };
}
const skin = (P, z, a, o = 0) => { const s = P(z); return [(s.w + o) * Math.cos(a), s.c + (s.ry + o) * Math.sin(a), z]; };

// The flight deck's glass. A real windscreen is flat panes set in flat facets of the nose, so each pane here is a plane
// through its four corners, and the nose is cut back to that plane (faceted, in fuselage) to take it
function deckOf(T, P) {
  const ahead = (x, y) => { // the station and angle of the point of her skin seen from ahead at (x, y)
    const out = (z) => { const b = P(z); return (x / Math.max(b.w, 1e-3)) ** 2 + ((y - b.c) / Math.max(b.ry, 1e-3)) ** 2 > 1; };
    let lo = 0.01, hi = T.nose;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (out(m)) lo = m; else hi = m; }
    const b = P(hi);
    return [hi, Math.atan2((y - b.c) / b.ry, x / b.w)];
  };
  const abeam = (z, y) => { const b = P(z); return skin(P, z, Math.asin(clamp((y - b.c) / b.ry, -1, 1))); };
  const height = ([z, a]) => { const b = P(z); return b.c + b.ry * Math.sin(a); };
  const { screen: [y0, y1, low, high], rear, tip } = DECK[T.id], R = T.R, POST = 0.1 * R / 1.9;
  const at = [ahead(0.055, y0 * R), ahead(low[0] * R, low[1] * R), ahead(high[0] * R, high[1] * R), ahead(0.055, y1 * R)];
  const side = [];
  let fb = [at[1][0] + POST, height(at[1])], ft = [at[2][0] + POST, height(at[2])];
  for (const [ub, hb, ut, ht] of rear) {
    const rb = [ub * T.nose, hb * R], rt = [ut * T.nose, ht * R];
    side.push([fb, rb, rt, ft]);
    fb = [rb[0] + POST, rb[1]]; ft = [rt[0] + POST, rt[1]];
  }
  const plane = (c) => {
    const n = c.length, mid = c.reduce((a, q) => a.map((v, k) => v + q[k] / n), [0, 0, 0]);
    let N = [0, 0, 0];
    c.forEach((q, i) => { const r = c[(i + 1) % n], m = cross(sub(q, mid), sub(r, mid)); N = N.map((v, k) => v + m[k]); });
    const l = Math.sqrt(dot(N, N)); N = N.map((v) => v / l);
    if (dot(N, [mid[0], mid[1] - P(mid[2]).c, 0]) < 0) N = N.map((v) => -v);
    const zs = c.map((q) => q[2]);
    return { mid, N, z0: Math.min(...zs), z1: Math.max(...zs), c: c.map((q) => { const d = dot(sub(q, mid), N); return q.map((v, k) => v - N[k] * d); }) };
  };
  const panes = [plane(at.map(([z, a]) => skin(P, z, a))), ...side.map((q) => plane(q.map(([z, y]) => abeam(z, y))))];
  return { panes, side, tip };
}
// a point of her skin, cut back to the facets of the flight deck's panes (on either side of her)
const facetsOf = (panes) => (q) => {
  const sx = q[0] < 0 ? -1 : 1; let p = [q[0] * sx, q[1], q[2]];
  for (const f of panes) {
    const d = dot(sub(p, f.mid), f.N); if (d <= 0) continue;
    const w = smooth(f.z0 - 0.16, f.z0 - 0.01, p[2]) * (1 - smooth(f.z1 + 0.02, f.z1 + 0.35, p[2]));
    p = p.map((v, k) => v - f.N[k] * d * w);
  }
  return [p[0] * sx, p[1], p[2]];
};

function fuselage(K, T, liv, P) {
  const start = T.L - T.tail, deck = deckOf(T, P), cut = facetsOf(deck.panes), sk = (z, a, o = 0) => cut(skin(P, z, a, o));
  const joint = T.nose * 0.215; // the radome ends here
  const nose = [joint]; for (let i = 0; i <= 34; i++) nose.push(T.nose * (i / 34) ** 1.6);
  nose.sort((a, b) => a - b);
  const body = []; for (let i = 0; i < 12; i++) body.push(lerp(T.nose, start, i / 12));
  for (let i = 0; i <= 20; i++) body.push(lerp(start, T.L, i / 20));
  // round her, with a break at each edge of the stripe, the two edges sweeping up her tail; finer round the nose
  const BELLY = -0.56, TOP = -0.38, aB = Math.asin((BELLY + TOP) / 2);
  const sweep = (a, z) => {
    const up = liv.rise * smooth(start - T.tail * 0.15, T.L - T.tail * 0.2, z), side = a < Math.PI / 2, m = side ? a : Math.PI - a;
    const out = m + up * Math.max(0, 1 - Math.abs(m - aB) / (50 * RAD));
    return side ? out : Math.PI - out;
  };
  const coat = (zs, step) => {
    const breaks = new Set();
    for (let d = -90; d < 270; d += step) breaks.add(d);
    for (const s of [BELLY, TOP]) { const d = Math.asin(s) / RAD; breaks.add(d); breaks.add(180 - d); }
    const as = [...breaks].sort((a, b) => a - b).map((d) => d * RAD), nu = as.length;
    K.paint.patch(nu, zs.length - 1, (i, j) => sk(zs[j], sweep(as[i], zs[j])), (i, j) => {
      if (zs[j] < joint) return liv.body;
      const m = Math.sin((as[i] + (i + 1 < nu ? as[i + 1] : as[0] + 2 * Math.PI)) / 2);
      return m < BELLY ? liv.belly : m < TOP ? (liv.stripe || liv.belly) : liv.body;
    }, { wrap: true, worn: 0.018 });
  };
  coat(nose, 6); coat(body, 12);
  // the APU's exhaust, in the very end of her tail
  const e = P(T.L - 0.001), end = (k, hex, dz) => K.decal.add(new THREE.CircleGeometry(1, 16).scale(Math.max(e.w, 0.05) * k, Math.max(e.ry, 0.05) * k, 1).translate(0, e.c, T.L + dz), hex);
  end(1.02, '#b9bec2', 0); end(0.62, DARK, 0.01);

  // painted and cut into her skin. a: round her; the port side is the mirror of the starboard
  const angle = (z, y) => { const s = P(z); return Math.asin(clamp((y - s.c) / s.ry, -1, 1)); };
  const decal = (z0, z1, a0, a1, hex, us = 1, vs = 1) => K.decal.patch(us, vs, (i, j) => sk(lerp(z0, z1, i / us), lerp(a0, a1, j / vs), 0.004), () => hex, { from: [0, P((z0 + z1) / 2).c, (z0 + z1) / 2] });
  const sides = (fn) => { fn((a) => a); fn((a) => Math.PI - a); };
  const outline = (z0, z1, y0, y1, mir, hex = LINE, w = 0.016) => {
    const a0 = angle((z0 + z1) / 2, y0), a1 = angle((z0 + z1) / 2, y1), da = w / T.R;
    decal(z0, z1, mir(a0 - da), mir(a0 + da), hex, 2); decal(z0, z1, mir(a1 - da), mir(a1 + da), hex, 2);
    decal(z0 - w, z0 + w, mir(a0), mir(a1), hex, 1, 10); decal(z1 - w, z1 + w, mir(a0), mir(a1), hex, 1, 10); // (in short pieces, or they'd sink into her curve)
  };
  // the cabin's windows, with the gaps at the doors
  const [dw, dh] = T.door, floor = T.winY - 1.15, h = 0.165, w = 0.1, last = T.doors[T.doors.length - 1];
  sides((mir) => {
    for (let z = T.doors[0] + 1.1; z < last - 0.7; z += T.pitch) {
      if (T.doors.some((d) => Math.abs(z - d) < dw * 0.5 + 0.42)) continue;
      const a = angle(z, T.winY);
      decal(z - w, z + w, mir(a - h / T.R), mir(a + h / T.R), GLASS);
    }
    for (const d of T.doors) {
      outline(d - dw / 2, d + dw / 2, floor, floor + dh, mir);
      const a = angle(d, T.winY); decal(d - 0.1, d + 0.1, mir(a - 0.13 / T.R), mir(a + 0.13 / T.R), GLASS);
    }
    for (const d of T.exits) outline(d - 0.26, d + 0.26, floor + 0.38, floor + 1.38, mir);
  });
  // the holds' doors, on her right side
  const hold = T.wide ? [1.8, -1.75, -0.2] : [1.25, -1.5, -0.68];
  for (const z of [T.root - T.L * 0.11, T.root + T.chords[0] + T.L * 0.1]) outline(z - hold[0] / 2, z + hold[0] / 2, hold[1], hold[2], (a) => a);
  // the joints round her: the radome, and where the tail cone comes off
  for (const z of [joint, T.L - T.tail * 0.2]) decal(z - 0.008, z + 0.008, -Math.PI / 2, Math.PI * 1.5, '#b4babf', 1, 32);

  // the flight deck's windows: flat glass in a black seal, its corners rounded
  const pane = (f, grow, r, lift, hex) => {
    const c = f.c, n = c.length, len = (a, b) => Math.sqrt(dot(sub(a, b), sub(a, b))), loop = [];
    c.forEach((q, i) => {
      const a = c[(i + n - 1) % n], b = c[(i + 1) % n], la = len(a, q), lb = len(b, q), d = Math.min(r, la * 0.45, lb * 0.45);
      const p0 = q.map((v, k) => v + (a[k] - v) * d / la), p1 = q.map((v, k) => v + (b[k] - v) * d / lb);
      for (let e = 0; e < 5; e++) { const t = e / 5, u = 1 - t, o = q.map((v, k) => u * u * p0[k] + 2 * u * t * v + t * t * p1[k]), g = len(o, f.mid); loop.push(o.map((v, k) => v + (v - f.mid[k]) * grow / g + f.N[k] * lift)); }
    });
    const M = loop.length, centre = f.mid.map((v, k) => v + f.N[k] * lift);
    for (const sx of [-1, 1]) K.decal.patch(M, 1, (i, j) => { const q = j ? loop[i % M] : centre; return [sx * q[0], q[1], q[2]]; }, () => hex, { wrap: true, from: [0, P(f.mid[2]).c, f.mid[2]] });
  };
  if (deck.tip) { // the A350's dark mask, painted on: round the windscreen and on back past the side windows to a point
    const m = 0.2 * T.R / 1.9, W = deck.panes[0].c, b = deck.side[deck.side.length - 1], tip = [deck.tip[0] * T.nose, deck.tip[1] * T.R];
    const under = [[W[0][2] - m, W[0][1]], [W[1][2], W[1][1] - m], [b[1][0] + m, b[1][1] - m], tip], over = [[W[3][2] + m, W[3][1]], [W[2][2], W[2][1] + m], [b[2][0] + m, b[2][1] + m], tip];
    const along = (l, z) => { let i = 0; while (i < l.length - 2 && z > l[i + 1][0]) i++; return lerp(l[i][1], l[i + 1][1], clamp((z - l[i][0]) / (l[i + 1][0] - l[i][0]), 0, 1)); };
    const round = (z, y) => { const s = P(z); return Math.asin(clamp((y - s.c) / s.ry, -1, 1)); };
    const z0 = under[0][0], NZ = 48, NA = 8, spot = (i, j) => { const z = lerp(z0, tip[0], i / NZ), lo = round(z, along(under, z)), hi = z < over[0][0] ? Math.PI / 2 - 0.002 : round(z, along(over, z)); return [z, lerp(lo, Math.max(lo, hi), j / NA)]; };
    for (const mir of [(a) => a, (a) => Math.PI - a]) K.decal.patch(NZ, NA, (i, j) => {
      const [z, a] = spot(i, j); return sk(z, mir(a), 0.016);
    }, () => '#1c2126', { from: [0, P(z0 + 2).c, z0 + 2], facing: (i, j) => { const a = mir(spot(i, j)[1]); return [Math.cos(a), Math.sin(a), 0]; } }); // (lit as the smooth nose, so the facets' edges don't glint through it)
  }
  for (const f of deck.panes) { pane(f, 0.03, 0.09, 0.02, '#07090b'); pane(f, 0, 0.08, 0.026, GLASS); }
  // the probes by her nose, and the aerials along her back and belly
  for (const sx of [-1, 1]) { const p = sk(T.nose * 0.46, sx > 0 ? 8 * RAD : 172 * RAD); rod(K.metal, p, [p[0] + sx * 0.14, p[1] - 0.02, p[2] - 0.12], 0.012, STEEL, 5); }
  const blade = (z, y, s) => { K.paint.patch(1, 1, (i, j) => [0, y + s * j * 0.34, z + i * s * 0.34 + j * s * 0.2], () => '#e6e8ea', { from: [-1, y, z] }); K.paint.patch(1, 1, (i, j) => [0, y + s * j * 0.34, z + i * s * 0.34 + j * s * 0.2], () => '#e6e8ea', { from: [1, y, z] }); };
  blade(T.L * 0.3, T.q * T.R, 1); blade(T.L * 0.48, T.q * T.R, 1); blade(T.L * 0.34, -T.q * T.R, -1);

  // the fairing under the wing's root, flat along the bottom and drawn out aft
  const c0 = T.chords[0], z0 = T.root - c0 * 0.28, z1 = T.root + c0 * 1.16, N = 12, paint = liv.belly === liv.body ? '#d7dadd' : liv.belly;
  K.paint.patch(16, N, (i, j) => {
    const u = j / N, a = 2 * Math.PI * i / 16, g = Math.sin(Math.PI * Math.pow(u, 0.72)) ** 0.55, s = Math.sin(a);
    return [T.R * 0.97 * g * Math.cos(a), -T.R * T.q * 0.56 + T.R * (s < 0 ? 0.56 : 0.5) * g * s, lerp(z0, z1, u)];
  }, () => paint, { wrap: true });
}

// ---------- the lifting surfaces ----------
const thick = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
// lofted through its sections: { x, y, z the leading edge, c chord, t thickness, r how far it's rolled from flat up to
// upright, p its nose-up pitch }; sx: which side; col(xc, upper, j) → the colour of a cell
function surface(k, sections, sx, col, worn = 0) {
  const NU = 18, xc = (i) => (1 - Math.cos(2 * Math.PI * i / NU)) / 2;
  k.patch(NU, sections.length - 1, (i, j) => {
    const s = sections[j], x = xc(i), h = s.c * s.t * thick(x) * (i < NU / 2 ? 1 : -1), r = s.r || 0, p = s.p || 0;
    return [sx * (s.x - Math.sin(r) * h), s.y - Math.sin(p) * s.c * x + Math.cos(r) * Math.cos(p) * h, s.z + Math.cos(p) * s.c * x + Math.cos(r) * Math.sin(p) * h];
  }, (i, j) => col((xc(i) + xc(i + 1)) / 2, i < NU / 2, j), { wrap: true, worn });
}
const between = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], i / n); return o; });

// the wing's planform, for everything hung on it
function planform(T) {
  const x0 = T.R * 0.78, [cr, ck, ct] = T.chords, inset = { blended: 0.83, sharklet: 0.55, raked: 4.35, curved: 2.82 }[T.tip], xt = T.semi - inset, xk = x0 + (xt - x0) * 0.36;
  const tan = Math.tan(T.sweep * RAD), dih = Math.tan(T.dihedral * RAD);
  return {
    x0, xk, xt, zLE: (x) => T.root + (x - x0) * tan,
    yAt: (x) => T.y + (x - x0) * dih + T.flex * ((x - x0) / (xt - x0)) ** 2,
    chord: (x) => (x < xk ? lerp(cr, ck, (x - x0) / (xk - x0)) : lerp(ck, ct, (x - xk) / (xt - xk))),
  };
}

function wings(K, T, liv, W) {
  const { x0, xk, xt, zLE, yAt, chord } = W;
  const sec = (x, t) => { const u = (x - x0) / (xt - x0); return { x, y: yAt(x), z: zLE(x), c: chord(x), t, r: 0, p: lerp(3.2, 0, u) * RAD }; };
  const X = xt, Y = yAt(xt), Z = zLE(xt), C = chord(xt);
  const tip = (dx, dy, dz, c, r) => ({ x: X + dx, y: Y + dy, z: Z + dz, c: C * c, t: 0.09, r, p: 0 });
  const TIPS = {
    blended: [tip(0.35, 0.18, 0.35, 0.86, 0.35), tip(0.62, 0.7, 0.75, 0.66, 1), tip(0.75, 1.6, 1.3, 0.44, 1.3), tip(0.82, 2.45, 1.9, 0.24, 1.38), tip(0.83, 2.5, 2.05, 0.02, 1.38)],
    sharklet: [tip(0.18, 0.1, 0.22, 0.9, 0.5), tip(0.34, 0.5, 0.55, 0.7, 1.15), tip(0.46, 1.4, 1.1, 0.47, 1.3), tip(0.54, 2.35, 1.7, 0.26, 1.32), tip(0.55, 2.42, 1.85, 0.02, 1.32)],
    raked: [tip(1.6, 0.1, 1.6, 0.72, 0), tip(3.2, 0.2, 3.6, 0.4, 0), tip(4.3, 0.28, 5.4, 0.12, 0), tip(4.35, 0.29, 5.6, 0.02, 0)],
    curved: [tip(1.2, 0.28, 1.4, 0.76, 0.18), tip(2.1, 0.95, 2.7, 0.56, 0.55), tip(2.6, 1.9, 4, 0.34, 1), tip(2.8, 2.9, 5.3, 0.14, 1.25), tip(2.82, 3, 5.5, 0.02, 1.28)],
  };
  const inner = [sec(x0, 0.15), sec(lerp(x0, xk, 0.5), 0.135), sec(xk, 0.118), ...[0.3, 0.55, 0.8, 1].map((u) => sec(lerp(xk, xt, u), lerp(0.112, 0.092, u)))], n = inner.length;
  const painted = T.tip !== 'raked';
  const paint = (x, up, j) => {
    if (painted && j >= n - 1) return liv.fin;
    if (x < 0.045) return STEEL; // the leading edge, bare
    if (!up) return x > 0.72 ? '#a3a9ae' : UNDER;
    return x > 0.76 ? '#bcc2c7' : x > 0.62 ? '#b3b9be' : GREY; // the flaps and the spoilers ahead of them
  };
  for (const sx of [-1, 1]) surface(K.paint, [...inner, ...TIPS[T.tip]], sx, paint, 0.03);
  return { tipX: T.semi - 0.1, tipY: Y + (painted ? 2.4 : 0.25), tipZ: Z + C * (T.tip === 'raked' ? 4.4 : 1.2) };
}

// an engine, front at z, hung under the wing: the bright lip of the intake, the cowling, the fan's nozzle, the core
// showing behind it and the cone in the end of that
function engines(K, T, liv, W) {
  const E = T.eng, front = W.zLE(E.x) - E.ahead;
  const S = [[0.17, 0.79], [0.07, 0.85], [0.012, 0.915], [0, 0.95], [0.018, 0.99], [0.08, 1.02], [0.22, 1.04], [0.42, 1.03], [0.6, 0.96], [0.72, 0.82], [0.725, 0.66], [0.84, 0.58], [0.98, 0.46], [0.985, 0.34], [1.1, 0.2], [1.25, 0.03]];
  const paint = (j) => (j < 5 ? STEEL : j < 9 ? liv.eng : j < 10 ? '#5d6368' : j < 12 ? '#8f959a' : j < 13 ? '#3e4347' : '#6a7075');
  for (const sx of [-1, 1]) {
    const x = sx * E.x, y = E.y;
    const ring = (i, j) => { const a = 2 * Math.PI * i / 24, r = E.R * S[j][1], s = Math.sin(a); return [x + r * Math.cos(a), y + r * s * (s < 0 ? E.flat : 1), front + E.len * S[j][0]]; };
    K.metal.patch(24, 4, ring, () => '#e6e9ec', { wrap: true, from: [x, y, front + E.len * 0.6] }); // the intake's polished lip
    K.paint.patch(24, S.length - 5, (i, j) => ring(i, j + 4), (i, j) => paint(j + 4), { wrap: true });
    K.paint.add(new THREE.CircleGeometry(E.R * 0.8, 20).rotateY(Math.PI).translate(x, y, front + E.len * 0.17), '#0d0f11'); // behind the fan
    // the pylon, from the top of the cowling up to the wing
    const y0 = y + E.R * 0.82, y1 = W.yAt(E.x) + 0.08;
    surface(K.paint, [{ x: E.x, y: y0, z: front + E.len * 0.2, c: E.len * 0.86, t: 0.1, r: Math.PI / 2 }, { x: E.x, y: lerp(y0, y1, 0.55), z: W.zLE(E.x) - 0.9 * (E.R / 1), c: E.len * 0.74, t: 0.1, r: Math.PI / 2 }, { x: E.x, y: y1, z: W.zLE(E.x) + 0.05, c: W.chord(E.x) * 0.58, t: 0.1, r: Math.PI / 2 }], sx, () => '#d4d8db');
    // the 737's strake, on the inboard side of the cowling
    if (E.strake) K.paint.add(new THREE.BoxGeometry(0.03, 0.34, 0.95).rotateZ(sx * 0.7).translate(x - sx * E.R * 0.8, y + E.R * 0.62, front + E.len * 0.24), liv.eng);
  }
  return [[E.x, E.y, front + E.len * 0.15], [-E.x, E.y, front + E.len * 0.15]];
}

// a fan, turning about z, its tips at radius r: the blades and the spinner with its painted spiral
function fanOf(T) {
  const k = new Kit(), r = T.eng.R * 0.79, N = T.wide ? 22 : 24;
  for (let b = 0; b < N; b++) {
    const a = 2 * Math.PI * b / N, tw = 0.9, w = (2 * Math.PI * r / N) * 0.62;
    k.patch(1, 3, (i, j) => {
      const v = j / 3, R0 = lerp(0.24 * r, r, v), t = a + (i - 0.5) * w / R0 * (0.7 + 0.3 * v), z = (i - 0.5) * 0.42 * lerp(tw, 0.28, v) * r * 0.5;
      return [R0 * Math.cos(t), R0 * Math.sin(t), z];
    }, () => '#6d747a', { from: [0, 0, 1] });
  }
  const S = [[-0.38, 0.005], [-0.33, 0.075], [-0.22, 0.17], [-0.08, 0.26], [0.04, 0.3]];
  k.patch(16, S.length - 1, (i, j) => { const a = 2 * Math.PI * i / 16; return [r * S[j][1] * Math.cos(a), r * S[j][1] * Math.sin(a), r * S[j][0]]; }, (i, j) => (((i + j * 2) % 16) < 3 ? '#20262c' : '#e9ecee'), { wrap: true });
  return k.geometry(0);
}

function tailplane(K, T, liv, P) {
  const S = T.stab, tan = Math.tan(S.sweep * RAD), dih = Math.tan(S.dihedral * RAD), sec = (x, c, t) => ({ x, y: S.y + x * dih, z: S.z + x * tan, c, t, r: 0 });
  const stab = (x, up) => (x < 0.05 ? STEEL : x > 0.7 ? '#bcc2c7' : up ? '#d3d7da' : '#c0c5c9');
  for (const sx of [-1, 1]) surface(K.paint, [sec(0.25, S.c, 0.11), sec(S.semi * 0.5, lerp(S.c, S.ct, 0.5), 0.1), sec(S.semi, S.ct, 0.085), sec(S.semi + 0.03, S.ct * 0.04, 0.085)], sx, stab, 0.02);

  const F = T.fin, mid = P(F.z + F.c * 0.5), y0 = mid.c + mid.ry * 0.86, sweep = Math.tan(F.sweep * RAD), t = 0.105, N = 12;
  const zAt = (y) => F.z + (y - y0) * sweep, cAt = (y) => lerp(F.c, F.ct, (y - y0) / F.h);
  const secs = between({ x: 0, y: y0 - 0.5, z: zAt(y0 - 0.5), c: cAt(y0 - 0.5), t, r: Math.PI / 2 }, { x: 0, y: y0 + F.h, z: zAt(y0 + F.h), c: F.ct, t: 0.09, r: Math.PI / 2 }, N);
  secs.push({ ...secs[N], y: secs[N].y + 0.03, c: F.ct * 0.04 });
  surface(K.paint, secs, 1, (x) => (x > 0.68 ? shade(liv.fin, 0.9) : liv.fin), 0.015);
  // the fillet running forward along her back into the fin
  const f = F.fillet;
  surface(K.paint, [{ x: 0, y: y0 - 0.5, z: F.z - f, c: f + F.c * 0.32, t: 0.09, r: Math.PI / 2 }, { x: 0, y: y0 + f * 0.12, z: F.z - f * 0.42, c: f * 0.42 + F.c * 0.3, t: 0.09, r: Math.PI / 2 }, { x: 0, y: y0 + f * 0.34, z: F.z + f * 0.1, c: F.c * 0.3, t: 0.09, r: Math.PI / 2 }, { x: 0, y: y0 + f * 0.36, z: F.z + f * 0.2, c: 0.08, t: 0.09, r: Math.PI / 2 }], 1, () => liv.fin);

  // the mark on the fin, on both faces: v up it, s along its chord at that height
  const point = (y, z, sd) => {
    const c = cAt(y), x = clamp((z - zAt(y)) / c, 0.015, 0.97);
    return [sd * (c * t * thick(x) + 0.006), y, zAt(y) + x * c];
  };
  const grid = (nu, nv, at) => { for (const sd of [-1, 1]) K.decal.patch(nu, nv, (i, j) => { const [y, z] = at(i / nu, j / nv); return point(y, z, sd); }, () => liv.tint, { from: [0, y0 + F.h / 2, F.z + F.c * 0.7] }); };
  const band = (v0, w) => grid(14, 3, (s, j) => { const v = clamp(lerp(v0 + 0.32 * s, v0 + w + 0.32 * s, j), 0, 1), y = y0 + F.h * v; return [y, zAt(y) + cAt(y) * s]; });
  if (liv.mark === 'band') band(0.22, 0.22);
  else if (liv.mark === 'bars') { band(0.12, 0.1); band(0.34, 0.1); }
  else {
    const yc = y0 + F.h * 0.52, r = Math.min(F.h, cAt(yc)) * 0.3, zc = zAt(yc) + cAt(yc) * 0.54;
    grid(36, 4, (a, j) => [yc + r * j * Math.sin(2 * Math.PI * a), zc + r * j * Math.cos(2 * Math.PI * a)]);
  }
}
const shade = (hex, k) => `#${colour(hex).clone().multiplyScalar(k).getHexString()}`;

// ---------- flaps, slats, wheels ----------
// the fairings of the flap tracks, under the wing's trailing edge; with the flaps out they swing down with them
const canoe = (k, T, W, sx, u, drop) => {
  const x = lerp(W.x0, W.xt, u), c = W.chord(x), len = c * 0.44, s = T.R / 1.9;
  k.add(new THREE.SphereGeometry(1, 10, 6).scale(0.17 * s, 0.26 * s, len).translate(0, 0, len).rotateX(drop).translate(sx * x, W.yAt(x) - 0.22 * s, W.zLE(x) + c * 0.42), '#a7adb2');
};

function clean(T, W) {
  const k = new Kit();
  for (const sx of [-1, 1]) for (const u of T.canoes) canoe(k, T, W, sx, u, 0);
  return k;
}

function wheel(k, x, y, z, r, w) {
  k.add(new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2).translate(x, y, z), DARK);
  k.add(new THREE.CylinderGeometry(r * 0.52, r * 0.52, w + 0.03, 12).rotateZ(Math.PI / 2).translate(x, y, z), '#8f959a');
}

function landing(T, W, liv) {
  const k = new Kit(), G = T.gear, s = T.R / 1.9, { x0, xk, xt, zLE, yAt, chord } = W, bellyY = -T.R * T.q;
  for (const sx of [-1, 1]) {
    for (const u of T.canoes) canoe(k, T, W, sx, u, 0.24);
    // the flaps, run out aft and turned down, in two spans either side of the kink
    for (const [a, b] of [[x0 + 0.2, xk], [xk + 0.22, lerp(x0, xt, 0.72)]]) for (let e = 0; e < T.flaps; e++) {
      const n = T.flaps, ang = (18 + 26 * (e + 1) / n) * RAD;
      // (ahead of the kink the wing's chord is mostly the root's extension: the flap is no deeper than it is at the kink)
      const sec = (x, t = 0.11) => { const c = chord(x), d = Math.min(c, chord(xk) * 1.12); return { x, y: yAt(x) - d * (0.03 + e * 0.07), z: zLE(x) + c - d * (0.14 - e * 0.15), c: d * (0.34 / n + 0.07), t, r: 0, p: ang }; };
      surface(k, [sec(a, 0.004), sec(a), sec((a + b) / 2), sec(b), sec(b, 0.004)], sx, (x, up) => (up ? '#c3c8cc' : '#a9afb4'));
    }
    // the slats, out ahead of the wing and drooped, either side of the engine
    for (const [a, b] of [[x0 + 0.4, T.eng.x - T.eng.R * 0.5], [T.eng.x + T.eng.R * 0.5, xt - 0.2]]) {
      const sec = (x, t = 0.12) => { const c = Math.min(chord(x), chord(xk) * 1.1); return { x, y: yAt(x) - c * 0.045, z: zLE(x) - c * 0.1, c: c * 0.17, t, r: 0, p: -20 * RAD }; };
      surface(k, [sec(a, 0.004), sec(a), sec((a + b) / 2), sec(b), sec(b, 0.004)], sx, (x, up) => (up ? '#ccd1d5' : STEEL));
    }
    // the main leg: strut, oleo, the stays that lock it, the door on it
    const lx = sx * G.x, y1 = bellyY - G.h, top = yAt(G.x) + 0.05, t = 0.13 * s, r = G.r, w = r * 0.72, sp = r * 2.35;
    rod(k, [lx, top, G.z + 0.1], [lx, lerp(top, y1, 0.62), G.z], t, '#a7adb2');
    rod(k, [lx, lerp(top, y1, 0.62), G.z], [lx, y1, G.z], t * 0.68, '#dfe3e6');
    rod(k, [sx * G.x * 0.42, bellyY * 0.7, G.z + 0.1], [lx, lerp(top, y1, 0.5), G.z], t * 0.42, '#878d92');
    rod(k, [lx, top - 0.1, G.z + 1.0 * s], [lx, lerp(top, y1, 0.55), G.z], t * 0.42, '#878d92');
    if (G.doors) k.add(new THREE.BoxGeometry(0.05, Math.abs(top - y1) * 0.62, r * 2.1).rotateZ(sx * 0.1).translate(lx + sx * (t + 0.22), lerp(top, y1, 0.42), G.z), liv.belly);
    // the wheels: two on a narrow-body, a bogie of four or six on the big ones
    if (G.axles > 1) k.add(new THREE.BoxGeometry(0.2 * s, 0.2 * s, sp * (G.axles - 1) + 0.3).translate(lx, y1, G.z), '#878d92');
    for (let a = 0; a < G.axles; a++) {
      const z = G.z + (a - (G.axles - 1) / 2) * sp;
      wheel(k, lx - w * 0.72, y1, z, r, w); wheel(k, lx + w * 0.72, y1, z, r, w);
    }
    // the 737 has no doors over her wheels: the bay they fold into stays open
    if (!G.doors) k.add(new THREE.BoxGeometry(G.x * 0.7, 0.02, r * 2.3).translate(sx * G.x * 0.42, bellyY * 0.97, G.z), '#0c0e10');
  }
  // the nose leg, its taxi light, its two doors
  const ny = bellyY - G.h * 0.94, nr = G.r * 0.78;
  rod(k, [0, bellyY * 0.95, G.nose], [0, lerp(bellyY, ny, 0.55), G.nose], 0.1 * s, '#a7adb2');
  rod(k, [0, lerp(bellyY, ny, 0.55), G.nose], [0, ny, G.nose], 0.07 * s, '#dfe3e6');
  rod(k, [0, bellyY * 0.98, G.nose - 1.1 * s], [0, lerp(bellyY, ny, 0.5), G.nose], 0.035 * s, '#878d92');
  wheel(k, -nr * 0.62, ny, G.nose, nr, nr * 0.62); wheel(k, nr * 0.62, ny, G.nose, nr, nr * 0.62);
  for (const sx of [-1, 1]) k.add(new THREE.BoxGeometry(0.03, 0.5 * s, 1.05 * s).rotateZ(sx * 0.3).translate(sx * 0.34 * s, bellyY - 0.2 * s, G.nose - 0.1 * s), liv.belly);
  return k;
}

// everything she's made of, as separate geometries for the materials airliners.js gives them: paint, metal (the
// intakes' lips and such), decal (windows, door lines, the mark on the fin), up and down (clean, or flaps and wheels
// out), fan; and where her lights and fans go
export function airframe(T, liv) {
  const K = { paint: new Kit(), metal: new Kit(), decal: new Kit() }, P = bodyOf(T), W = planform(T), dz = -T.L / 2;
  fuselage(K, T, liv, P);
  const tips = wings(K, T, liv, W), fans = engines(K, T, liv, W);
  tailplane(K, T, liv, P);
  const at = (x, y, z) => [x, y, z + dz], lampX = W.x0 + 0.7;
  return {
    paint: K.paint.geometry(dz), metal: K.metal.geometry(dz), decal: K.decal.geometry(dz),
    up: clean(T, W).geometry(dz), down: landing(T, W, liv).geometry(dz), fan: fanOf(T),
    fans: fans.map(([x, y, z]) => at(x, y, z)),
    lights: {
      lamps: [at(lampX, W.yAt(lampX) - 0.1, W.zLE(lampX) + 0.1), at(-lampX, W.yAt(lampX) - 0.1, W.zLE(lampX) + 0.1)],
      beacon: at(0, T.R * T.q + 0.12, T.L * 0.42),
      tips: [at(tips.tipX, tips.tipY, tips.tipZ), at(-tips.tipX, tips.tipY, tips.tipZ)],
    },
  };
}
