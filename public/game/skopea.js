// Skopea: Göcek bay drawn round the course — the real hills (pine forest low down, bare limestone up high), the town
// at the head of the bay, its marinas' pontoons with the yachts moored stern-to along them, and gulets on the quays.
// From the numbers land.js loads; everything here is in the bay's own frame (x east, z south from Göcek), and the
// world moves the whole group so the race's start sits where land.js laid it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SKOPEA, roomAt } from './land.js';

const META = SKOPEA.meta, T = META.terrain, AX = Float32Array.from(T.x), AZ = Float32Array.from(T.z);

// a steady random for the scattering, and a smooth noise for the colour of the forest
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const hash = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (hash(i, j) * (1 - su) + hash(i + 1, j) * su) * (1 - sv) + (hash(i, j + 1) * (1 - su) + hash(i + 1, j + 1) * su) * sv;
}
const fbm = (x, z) => 0.55 * vnoise(x / 220, z / 220) + 0.3 * vnoise(x / 70, z / 70) + 0.15 * vnoise(x / 22, z / 22);

// the ground's height anywhere, metres (between the grid's points, bilinear)
function seek(A, v) { let lo = 0, hi = A.length - 1; if (v <= A[0]) return 0; if (v >= A[hi]) return hi - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= v) lo = m; else hi = m; } return lo; }
export function groundAt(x, z) {
  const i = seek(AX, x), j = seek(AZ, z), u = Math.min(1, Math.max(0, (x - AX[i]) / (AX[i + 1] - AX[i]))), v = Math.min(1, Math.max(0, (z - AZ[j]) / (AZ[j + 1] - AZ[j])));
  const H = SKOPEA.heights, n = T.nx;
  return 0.1 * ((H[j * n + i] * (1 - u) + H[j * n + i + 1] * u) * (1 - v) + (H[(j + 1) * n + i] * (1 - u) + H[(j + 1) * n + i + 1] * u) * v);
}
const slopeAt = (x, z) => { const e = 6; return Math.hypot(groundAt(x + e, z) - groundAt(x - e, z), groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e); };

// the town: Göcek round its quay, from Skopea Marina up the valley behind it
const MARINA = (META.marinas.find((m) => /skopea/i.test(m.name)) || { at: [-60, -156] }).at;
const TOWN = { x: MARINA[0] + 120, z: MARINA[1] - 280, r: 650 };
const townness = (x, z) => Math.max(0, 1 - Math.hypot((x - TOWN.x) / 1.1, z - TOWN.z) / TOWN.r);

// the land is far bigger than the course, so its haze reaches further than the sea's: the hills across the bay stay
// green in the haze instead of fading straight into the sky, and the far mountains are a pale outline
function farFog(m, k = 0.5) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>',
      '#ifdef USE_FOG\n  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth * ' + k.toFixed(2) + ' );\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif');
  };
  return m;
}

const C = (h) => new THREE.Color(h);
const COL = {
  stone: C('#a39a86'), pine: C('#3c5530'), pineDark: C('#2c4224'), pineLight: C('#566d3a'), scrub: C('#7b7d55'),
  rock: C('#9a917c'), rockDark: C('#7b7465'), town: C('#a19a84'),
};

// ---------- the hills ----------
function terrain() {
  const nx = T.nx, nz = T.nz, H = SKOPEA.heights;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; pos[k * 3] = AX[i]; pos[k * 3 + 1] = H[k] * 0.1; pos[k * 3 + 2] = AZ[j];
  }
  const used = new Uint8Array(nx * nz);
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (H[a] <= 0 && H[b] <= 0 && H[c] <= 0 && H[d] <= 0) continue; // all under the sea: nothing to see
    idx.push(a, c, b, b, c, d); used[a] = used[b] = used[c] = used[d] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal.array, c = new THREE.Color();
  for (let k = 0; k < nx * nz; k++) {
    if (!used[k]) continue;
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], ny = N[k * 3 + 1];
    if (y < 0.5) { col[k * 3] = COL.stone.r; col[k * 3 + 1] = COL.stone.g; col[k * 3 + 2] = COL.stone.b; continue; } // under the water
    const n = fbm(x, z), steep = THREE.MathUtils.smoothstep(1 - ny, 0.32, 0.6), high = THREE.MathUtils.smoothstep(y, 420, 820);
    // the forest, mottled; thinner and scrubby where it's steep or high; bare limestone on crags and the tops
    c.copy(COL.pineDark).lerp(COL.pine, n).lerp(COL.pineLight, Math.max(0, n - 0.62) * 1.6);
    c.lerp(COL.scrub, Math.max(steep * 0.55, high * 0.5) * (0.6 + 0.4 * n));
    c.lerp(n > 0.5 ? COL.rock : COL.rockDark, Math.max(THREE.MathUtils.smoothstep(1 - ny, 0.5, 0.75), high * 0.7) * (0.55 + 0.45 * vnoise(x / 40, z / 40)));
    c.lerp(COL.town, townness(x, z) * 0.7 * THREE.MathUtils.smoothstep(ny, 0.9, 0.97));
    c.lerp(COL.stone, 0.85 * (1 - THREE.MathUtils.smoothstep(y, 1.3, 2.3))); // the rocky shoreline, a narrow band
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, farFog(new THREE.MeshLambertMaterial({ vertexColors: true })));
}

// ---------- the pines: Turkish red pine, a round dark crown on a bare trunk ----------
function tint(geo, color) {
  const c = C(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const strip = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
function pineGeo() {
  // some 26 triangles: there are thousands of them
  const trunk = tint(new THREE.CylinderGeometry(0.22, 0.32, 7, 3, 1, true).translate(0, 3.5, 0), '#5a4636');
  const crown = tint(new THREE.IcosahedronGeometry(1, 0).scale(3.3, 2.6, 3.3).translate(0, 8, 0), '#ffffff');
  return mergeGeometries([trunk, crown].map(strip));
}
// They are in 1.5 km tiles, one instanced mesh each, so a tile behind the camera isn't drawn at all; each tile's
// instances are in no order, so the lower graphics levels draw the first part of every tile.
const TILE = 1500;
function pines(count) {
  const r = rng(91), o = new THREE.Object3D(), c = new THREE.Color(), tiles = new Map();
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 20) {
    // most of them near the bay, where they're seen close; thinning out up to 4.5 km off
    const a = r() * Math.PI * 2, d = 4500 * Math.pow(r(), 1.6), x = -300 + Math.cos(a) * d, z = 700 + Math.sin(a) * d * 1.1;
    const y = groundAt(x, z);
    if (y < 2.2 || y > 650) continue;
    if (fbm(x * 1.7, z * 1.7) < 0.38 + 0.25 * r()) continue; // in stands, with clearings between
    if (r() < townness(x, z) * 1.6 || slopeAt(x, z) > 1.1) continue; // few in the town, none on the crags
    o.position.set(x, y - 0.6, z); o.rotation.set(0, r() * 6.28, 0);
    const s = 0.75 + r() * 0.65 - Math.min(0.3, y / 2000); o.scale.set(s, s * (0.85 + r() * 0.35), s);
    o.updateMatrix();
    const k = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push([o.matrix.clone(), c.copy(COL.pineDark).lerp(COL.pineLight, r() * 0.7).multiplyScalar(0.9 + r() * 0.2).clone()]);
    n++;
  }
  const geo = pineGeo(), mat = farFog(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.6), g = new THREE.Group();
  for (const list of tiles.values()) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mx, col], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, col); });
    m.computeBoundingSphere(); // round all of the tile's pines, before setQuality draws fewer
    m.userData.max = list.length;
    g.add(m);
  }
  return g;
}

// ---------- the town ----------
// the mapped buildings as they are on the map, and the many houses the map lacks round them: white or cream walls,
// mostly terracotta roofs
const WALLS = ['#f3eee4', '#efe6d2', '#f6f2ea', '#e9dcc0', '#f1e3c8', '#ffffff'], ROOFS = ['#b4603e', '#a5543a', '#c0704a', '#9c4f37'];
function town() {
  const r = rng(17), parts = [], taken = new Set(), key = (x, z) => `${Math.round(x / 9)},${Math.round(z / 9)}`;
  const mark = (x, z, rad) => { for (let dx = -rad; dx <= rad; dx += 9) for (let dz = -rad; dz <= rad; dz += 9) taken.add(key(x + dx, z + dz)); };
  for (const b of META.buildings) {
    let cx = 0, cz = 0; for (const [x, z] of b.r) { cx += x; cz += z; } cx /= b.r.length; cz /= b.r.length;
    const sh = new THREE.Shape(b.r.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))));
    let area = 0; for (let i = 0; i < b.r.length; i++) { const [x0, z0] = b.r[i], [x1, z1] = b.r[(i + 1) % b.r.length]; area += x0 * z1 - x1 * z0; }
    area = Math.abs(area) / 2;
    const h = b.h || (area > 500 ? 8 : area > 150 ? 6.5 : 4.5 + r() * 2.5);
    let y0 = Infinity; for (const [x, z] of b.r) y0 = Math.min(y0, groundAt(x, z));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h + 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(cx, Math.max(0.6, y0) - 1.5, cz);
    parts.push(paint(g, WALLS[Math.floor(r() * WALLS.length)], r() < 0.55 ? ROOFS[Math.floor(r() * ROOFS.length)] : '#ddd6c8'));
    mark(cx, cz, Math.sqrt(area) / 2 + 4);
  }
  // the houses the map hasn't got: thick in the town, scattered as villas up the slopes round the bay
  const box = strip(paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), '#fff')), roof = strip(paint(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), '#fff'));
  const houses = new Batch(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
  let n = 0;
  for (let t = 0; t < 30000 && n < 900; t++) {
    const inTown = t % 3 !== 0;
    const x = inTown ? TOWN.x + (r() - 0.5) * TOWN.r * 2.6 : -300 + (r() - 0.5) * 6000, z = inTown ? TOWN.z + (r() - 0.5) * TOWN.r * 2.2 : 700 + (r() - 0.5) * 6000;
    const tn = townness(x, z), sea = roomAt(x, z);
    if (sea > -12) continue; // ashore, a little back from the water
    if (inTown ? r() > tn * 1.4 : sea < -350 || r() > 0.18) continue;
    const y = groundAt(x, z);
    if (y < 1.5 || y > (inTown ? 90 : 160) || slopeAt(x, z) > 0.45) continue;
    if (taken.has(key(x, z))) continue;
    const w = 6 + r() * 5, d = 6 + r() * 4, h = r() < 0.6 ? 3.2 : 6.2, a = r() * Math.PI;
    q.setFromAxisAngle(up, a);
    houses.add(box, m4.compose(P.set(x, y - 1.2, z), q, S.set(w, h + 1.2, d)), C(WALLS[Math.floor(r() * WALLS.length)]));
    if (r() < 0.8) houses.add(roof, m4.compose(P.set(x, y + h, z), q, S.set(w * 1.08, 1.6 + r() * 0.6, d * 1.08)), C(ROOFS[Math.floor(r() * ROOFS.length)]));
    mark(x, z, Math.max(w, d) / 2 + 3); n++;
  }
  const g = mergeGeometries([...parts.map(strip), houses.geometry()]);
  return new THREE.Mesh(g, farFog(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.6));
}
// many copies of small shapes, each placed by a matrix and given one colour, written into one geometry
class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.nm = new THREE.Matrix3(); this.v = new THREE.Vector3(); }
  add(geo, m, col) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, v = this.v;
    this.nm.getNormalMatrix(m);
    for (let i = 0; i < P.length; i += 3) {
      v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(this.nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.c.push(col.r, col.g, col.b);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}
// walls one colour, the faces looking up (a flat roof) another
function paint(geo, wall, top = wall) {
  geo.computeVertexNormals();
  const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
  const N = g.attributes.normal.array, n = g.attributes.position.count, a = new Float32Array(n * 3), cw = C(wall), ct = C(top);
  for (let i = 0; i < n; i++) { const c = N[i * 3 + 1] > 0.7 ? ct : cw; a.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ---------- the marinas ----------
// the boats, drawn bow towards −z with the stern at the origin, a waterline at y = 0
function hullShape(L, B, bow = 0.62) {
  const s = new THREE.Shape();
  s.moveTo(-B * 0.42, 0); s.lineTo(B * 0.42, 0); s.quadraticCurveTo(B * 0.52, L * 0.25, B / 2, L * 0.45);
  s.quadraticCurveTo(B * 0.46, L * bow + L * 0.12, 0, L); s.quadraticCurveTo(-B * 0.46, L * bow + L * 0.12, -B / 2, L * 0.45);
  s.quadraticCurveTo(-B * 0.52, L * 0.25, -B * 0.42, 0);
  return s;
}
const hull = (L, B, F, color, deck) => paint(new THREE.ExtrudeGeometry(hullShape(L, B), { depth: F, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, -0.4, 0), color, deck);
const at = (g, x, y, z) => g.translate(x, y, z);
function sailboatGeo() {
  const L = 13, B = 4.1;
  return mergeGeometries([
    hull(L, B, 1.45, '#f7f7f4', '#d9d2c2'),
    paint(at(new THREE.BoxGeometry(2.5, 0.75, 4.2), 0, 1.4, -5.2), '#f4f4f0'),
    paint(at(new THREE.BoxGeometry(2.3, 0.18, 1.6), 0, 1.86, -4.2), '#2a3540'), // the coachroof's windows
    tint(at(new THREE.CylinderGeometry(0.08, 0.12, 17, 5), 0, 9.5, -7.4), '#cfd3d6'),
    tint(at(new THREE.BoxGeometry(0.42, 0.42, 4.6), 0, 2.75, -5.2), '#22355a'), // the main furled on the boom under its cover
  ].map(strip));
}
function motorGeo() {
  const L = 15, B = 4.6;
  return mergeGeometries([
    hull(L, B, 2.0, '#fbfbf9', '#e6e1d6'),
    paint(at(new THREE.BoxGeometry(3.6, 1.5, 7.2), 0, 2.3, -6.2), '#f6f6f3'),
    tint(at(new THREE.BoxGeometry(3.66, 0.55, 6.6), 0, 2.4, -6.3), '#1d2730'), // the saloon's dark glass
    paint(at(new THREE.BoxGeometry(3.0, 0.9, 3.6), 0, 3.5, -5.2), '#f2f2ee'),
    tint(at(new THREE.BoxGeometry(3.06, 0.32, 3.2), 0, 3.55, -5.3), '#1d2730'),
    tint(at(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), 0, 5.0, -5.6), '#dddddd'),
  ].map(strip));
}
function guletGeo() {
  const L = 25, B = 6.4;
  return mergeGeometries([
    hull(L, B, 2.3, '#6e4024', '#b88c5c'),
    tint(at(new THREE.BoxGeometry(B * 0.9, 0.35, 0.3), 0, 1.75, -0.2), '#f2ede2'), // the transom's rail
    paint(at(new THREE.BoxGeometry(4.6, 1.1, 11), 0, 2.2, -9), '#f1ead9', '#a8774a'),
    tint(at(new THREE.BoxGeometry(4.0, 0.12, 6), 0, 3.4, -3.4), '#f4efe4'), // the aft deck's awning
    tint(at(new THREE.CylinderGeometry(0.14, 0.2, 19, 5), 0, 11, -15.5), '#8a6440'),
    tint(at(new THREE.CylinderGeometry(0.11, 0.16, 14, 5), 0, 8.5, -6.5), '#8a6440'),
    tint(at(new THREE.CylinderGeometry(0.1, 0.12, 6, 4).rotateX(Math.PI / 2 - 0.15), 0, 2.4, -L - 1.8), '#8a6440'), // the bowsprit
  ].map(strip));
}
const TINTS = ['#ffffff', '#f4f6f8', '#fbf6ec', '#e8ecef']; // the whole boat is tinted, so only a shade either way

function marinas() {
  const r = rng(5), group = new THREE.Group();
  const segs = []; // every pontoon's sides, for keeping the boats off the next one
  for (const p of META.piers) for (let i = 0; i + 1 < p.pts.length; i++) segs.push({ a: p.pts[i], b: p.pts[i + 1], p });
  const width = (p) => p.w || (p.kind === 'pier' ? 2.6 : p.kind === 'breakwater' ? 6 : 3);
  const segDist = (x, z, s) => { const [ax, az] = s.a, [bx, bz] = s.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - ax - t * dx, z - az - t * dz); };
  // the pontoons: a box along each length of them, floating ones low, piers and breakwaters higher
  const deck = new THREE.BoxGeometry(1, 1, 1), boxes = [];
  for (const s of segs) {
    const [ax, az] = s.a, [bx, bz] = s.b, l = Math.hypot(bx - ax, bz - az); if (l < 0.5) continue;
    const w = width(s.p), h = s.p.kind === 'breakwater' ? 2.4 : s.p.kind === 'pier' ? 0.8 : 1.4; // above the chop
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, h / 2 - 0.6 + 0.3, (az + bz) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(bz - az, bx - ax)), new THREE.Vector3(l + w * 0.5, h + 0.6, w));
    boxes.push(paint(deck.clone().applyMatrix4(m4), s.p.kind === 'breakwater' ? '#8f8a7f' : '#9c9a94', s.p.kind === 'breakwater' ? '#a8a294' : '#d7cfbf'));
  }
  if (boxes.length) group.add(new THREE.Mesh(mergeGeometries(boxes.map(strip)), farFog(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.6)));
  // the yachts, stern-to along both sides: sailing yachts mostly, motor yachts, and gulets where a long one fits
  const kinds = [
    { geo: sailboatGeo(), L: 13, B: 4.1, gap: 4.7, list: [] },
    { geo: motorGeo(), L: 15, B: 4.6, gap: 5.2, list: [] },
    { geo: guletGeo(), L: 27, B: 6.4, gap: 7.4, list: [] },
  ];
  // what's near a point, from grids of cells rather than everything: the pontoon lengths passing within 12 m of a
  // 40 m cell, and the points of the boats already moored, by 20 m cell (no check reaches further than either)
  const cell = (x, z, G) => Math.floor(x / G) + ',' + Math.floor(z / G), segGrid = new Map(), boatGrid = new Map();
  for (const sg of segs) {
    const [ax, az] = sg.a, [bx, bz] = sg.b;
    for (let gx = Math.floor((Math.min(ax, bx) - 12) / 40); gx <= Math.floor((Math.max(ax, bx) + 12) / 40); gx++)
      for (let gz = Math.floor((Math.min(az, bz) - 12) / 40); gz <= Math.floor((Math.max(az, bz) + 12) / 40); gz++) {
        const k = gx + ',' + gz; if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push(sg);
      }
  }
  const segsNear = (x, z) => segGrid.get(cell(x, z, 40)) || [];
  const place = (x, z) => { const k = cell(x, z, 20); if (!boatGrid.has(k)) boatGrid.set(k, []); boatGrid.get(k).push([x, z]); };
  const near = (x, z, d) => {
    const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of boatGrid.get((gx + i) + ',' + (gz + j)) || []) if (Math.hypot(q[0] - x, q[1] - z) < d) return true;
    return false;
  };
  for (const s of segs) {
    if (s.p.kind !== 'pier' && s.p.kind !== 'quay') continue;
    const [ax, az] = s.a, [bx, bz] = s.b, l = Math.hypot(bx - ax, bz - az); if (l < 8) continue;
    const tx = (bx - ax) / l, tz = (bz - az) / l, w = width(s.p);
    for (const side of [-1, 1]) {
      const nx = -tz * side, nz = tx * side;
      for (let u = 3; u < l - 3;) {
        const k = s.p.kind === 'quay' ? (r() < 0.6 ? kinds[2] : kinds[1]) : r() < 0.07 ? kinds[2] : r() < 0.28 ? kinds[1] : kinds[0];
        const sc = k === kinds[2] ? 0.85 + r() * 0.3 : 0.85 + r() * 0.35, L = k.L * sc, gap = k.gap * sc;
        const sx = ax + tx * (u + gap / 2) + nx * (w / 2 + 1.2), sz = az + tz * (u + gap / 2) + nz * (w / 2 + 1.2);
        const mx = sx + nx * L * 0.5, mz = sz + nz * L * 0.5, bwx = sx + nx * L, bwz = sz + nz * L;
        let ok = r() < 0.92 && u + gap < l - 1 // a berth or two empty
          && groundAt(sx, sz) < 0.5 && groundAt(bwx, bwz) < -1.5 && groundAt(mx, mz) < -1.5; // afloat, stern to bow
        if (ok) for (const o of [...segsNear(mx, mz), ...segsNear(bwx, bwz)]) if (o !== s && (segDist(mx, mz, o) < width(o.p) / 2 + k.B * sc / 2 + 0.5 || segDist(bwx, bwz, o) < width(o.p) / 2 + 1)) { ok = false; break; }
        if (ok && (near(mx, mz, gap * 0.9) || near(bwx, bwz, gap * 0.9))) ok = false;
        if (ok) {
          k.list.push([sx, sz, Math.atan2(-nx, -nz) + (r() - 0.5) * 0.05, sc]);
          place(mx, mz); place(bwx, bwz); place(sx + nx * L * 0.2, sz + nz * L * 0.2);
        }
        u += gap;
      }
    }
  }
  const o = new THREE.Object3D(), c = new THREE.Color();
  kinds.forEach((k, ki) => {
    if (!k.list.length) return;
    const m = new THREE.InstancedMesh(k.geo, farFog(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }), 0.6), k.list.length);
    k.list.forEach(([x, z, a, sc], i) => {
      o.position.set(x, 0, z); o.rotation.set(0, a, 0); o.scale.setScalar(sc); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(TINTS[Math.floor(r() * TINTS.length)]));
    });
    group.add(m);
  });
  return group;
}

// ---------- all of it ----------
export class Skopea {
  constructor() {
    this.group = new THREE.Group();
    this.land = terrain(); this.trees = pines(12000); this.town = town(); this.boats = marinas();
    this.group.add(this.land, this.trees, this.town, this.boats);
    this.group.traverse((o) => { if (o.isMesh) o.matrixAutoUpdate = false; });
  }
  // the race's start at its place in the bay
  place(at) { this.group.position.set(-at.x, 0, -at.z); this.group.updateMatrixWorld(true); }
  // fewer pines for the lower graphics levels
  setQuality(q) {
    const f = q === 'high' ? 1 : q === 'medium' ? 0.45 : 0.25;
    for (const m of this.trees.children) m.count = Math.round(m.userData.max * f);
  }
}
