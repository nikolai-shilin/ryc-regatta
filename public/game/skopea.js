// The land round the course, drawn from the numbers land.js loads for the race's venue (venues.js): the real hills
// with the venue's own woods, scrub, farmland and bare rock, its towns, its marinas' pontoons with the yachts moored
// stern-to along them, and its landmarks (a bridge, a tower, a lighthouse). Named for Göcek bay, the first of them:
// its pine forest, Skopea Marina and the gulets on its quays. Everything here is in the venue's own frame (land.js),
// and the world moves the whole group so the race's start sits where land.js laid it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SKOPEA, roomAt, VENUE } from './land.js';

const META = SKOPEA.meta, T = META.terrain, AX = Float32Array.from(T.x), AZ = Float32Array.from(T.z);
const LOOK = VENUE.look;

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

// the towns: in Göcek, the town round its quay, from Skopea Marina up the valley behind it; elsewhere as the venue's
// json lists them
const MARINA = (META.marinas.find((m) => /skopea/i.test(m.name)) || { at: [-60, -156] }).at;
const TOWNS = META.towns ? META.towns.map((t) => ({ x: t.at[0], z: t.at[1], r: t.r })) : [{ x: MARINA[0] + 120, z: MARINA[1] - 280, r: 650 }];
const townness = (x, z) => { let k = 0; for (const t of TOWNS) k = Math.max(k, 1 - Math.hypot((x - t.x) / 1.1, z - t.z) / t.r); return k; };
// the middle of what is seen: Göcek's inner bay, or the race area
const MID = META.home ? { x: META.home[0], z: META.home[1] } : { x: -300, z: 700 };
// the woods: in stands with clearings between, more of them where the venue is more wooded
const WOOD = 0.38 + (1 - (LOOK.woods ?? 1)) * 0.35;
const woodAt = (x, z) => fbm(x * 1.7, z * 1.7);

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
const GR = LOOK.ground;
const COL = {
  stone: C(GR.shore), pine: C(GR.forest[1]), pineDark: C(GR.forest[0]), pineLight: C(GR.forest[2]), scrub: C(GR.scrub),
  rock: C(GR.rock[0]), rockDark: C(GR.rock[1]), town: C(GR.town),
};
const FIELDS = (LOOK.fields || []).map(C);
// farmland: parcels some 140 by 95 m, their lines turning slowly across the country, each its own crop
function fieldAt(x, z) {
  const a = vnoise(x / 2400 + 7, z / 2400) * 1.6, ca = Math.cos(a), sa = Math.sin(a);
  const u = Math.floor((x * ca + z * sa) / 140), v = Math.floor((z * ca - x * sa) / 95);
  return FIELDS[Math.floor(hash(u + 0.5, v + 0.5) * FIELDS.length) % FIELDS.length];
}

// ---------- the hills ----------
const TOP = LOOK.treeTop || 650; // the trees' height limit; the bare tops start a little under it
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
    const n = fbm(x, z), steep = THREE.MathUtils.smoothstep(1 - ny, 0.32, 0.6), high = THREE.MathUtils.smoothstep(y, TOP * 0.65, TOP * 1.26);
    // the forest, mottled; thinner and scrubby where it's steep or high; bare limestone on crags and the tops
    c.copy(COL.pineDark).lerp(COL.pine, n).lerp(COL.pineLight, Math.max(0, n - 0.62) * 1.6);
    // farmland on the low, gentle land outside the woods, where the venue has it
    if (FIELDS.length) {
      const open = THREE.MathUtils.smoothstep(WOOD + 0.1 - woodAt(x, z), 0, 0.08) * THREE.MathUtils.smoothstep(ny, 0.94, 0.985) * (1 - THREE.MathUtils.smoothstep(y, 90, 160));
      if (open > 0) c.lerp(fieldAt(x, z), open * (0.85 + 0.15 * vnoise(x / 30, z / 30)));
    }
    c.lerp(COL.scrub, Math.max(steep * 0.55, high * 0.5) * (0.6 + 0.4 * n));
    c.lerp(n > 0.5 ? COL.rock : COL.rockDark, Math.max(THREE.MathUtils.smoothstep(1 - ny, 0.5, 0.75), high * 0.7) * (0.55 + 0.45 * vnoise(x / 40, z / 40)));
    c.lerp(COL.town, townness(x, z) * 0.7 * THREE.MathUtils.smoothstep(ny, 0.9, 0.97));
    c.lerp(COL.stone, 0.85 * (1 - THREE.MathUtils.smoothstep(y, 1.3, 2.3))); // the rocky shoreline, a narrow band
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, farFog(new THREE.MeshLambertMaterial({ vertexColors: true })));
}

// ---------- the trees: in Göcek Turkish red pine, a round dark crown on a bare trunk; elsewhere the venue's own ----------
function tint(geo, color) {
  const c = C(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const strip = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
// each a few dozen triangles: there are thousands of them. The crowns are white, tinted by each tree's own colour.
const blob = (sx, sy, sz, x, y, z) => tint(new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).translate(x, y, z), '#ffffff');
const trunk = (r0, r1, h, col = '#5a4636', y = 0) => tint(new THREE.CylinderGeometry(r0, r1, h, 3, 1, true).translate(0, y + h / 2, 0), col);
const TREES = {
  pine: () => [trunk(0.22, 0.32, 7), blob(3.3, 2.6, 3.3, 0, 8, 0)],
  stone: () => [trunk(0.28, 0.4, 9), blob(5.6, 1.7, 5.6, 0, 9.6, 0)], // the umbrella pine: a flat crown up high
  broad: () => [trunk(0.35, 0.5, 4), blob(4.2, 3.6, 4.2, 0, 6.6, 0), blob(3, 2.6, 3, 1.8, 8.2, -1)],
  conifer: () => [trunk(0.2, 0.3, 2.5), tint(new THREE.ConeGeometry(2.6, 11, 6).translate(0, 7.5, 0), '#ffffff')],
  cypress: () => [trunk(0.15, 0.25, 1.5), tint(new THREE.ConeGeometry(1.25, 12, 6).translate(0, 7, 0), '#ffffff'), blob(1.25, 2.4, 1.25, 0, 3.8, 0)],
  eucalypt: () => [trunk(0.3, 0.45, 12, '#cfc6b4'), blob(3.4, 2.3, 3.4, 0, 12.5, 0), blob(2.5, 1.8, 2.5, 2.2, 9.8, 1), blob(2.6, 2, 2.6, -1.8, 10.8, -1.2)],
  olive: () => [trunk(0.35, 0.45, 2.4, '#6b5a48'), blob(2.6, 1.9, 2.6, 0, 3.4, 0)],
  shrub: () => [blob(1.9, 1.1, 1.9, 0, 0.7, 0), blob(1.3, 0.8, 1.3, 1.3, 0.5, 0.7)],
  palm: () => {
    const lean = 0.09, top = 9, g = [tint(new THREE.CylinderGeometry(0.2, 0.32, top, 4, 1, true).translate(0, top / 2, 0).rotateZ(-lean), '#8a7a5e')];
    const tx = Math.sin(lean) * top, ty = Math.cos(lean) * top;
    for (let k = 0; k < 7; k++) g.push(tint(new THREE.BoxGeometry(4.6, 0.12, 0.9).translate(2.3, 0, 0).rotateZ(-0.38 - 0.12 * (k % 2)).rotateY(k * Math.PI * 2 / 7).translate(tx, ty, 0), '#ffffff'));
    return g;
  },
};
const treeGeo = (kind) => mergeGeometries((TREES[kind] || TREES.pine)().map(strip));
// They are in 1.5 km tiles, one instanced mesh each, so a tile behind the camera isn't drawn at all; each tile's
// instances are in no order, so the lower graphics levels draw the first part of every tile.
const TILE = 1500;
function pines(count) {
  const r = rng(91), o = new THREE.Object3D(), c = new THREE.Color(), tiles = new Map();
  const kinds = LOOK.trees.map(([kind, share, dark, light]) => ({ kind, share, dark: C(dark), light: C(light) }));
  const total = kinds.reduce((a, k) => a + k.share, 0), lone = FIELDS.length ? 0.05 : 0;
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 20) {
    // most of them near the race area, where they're seen close; thinning out up to 4.5 km off
    const a = r() * Math.PI * 2, d = 4500 * Math.pow(r(), 1.6), x = MID.x + Math.cos(a) * d, z = MID.z + Math.sin(a) * d * 1.1;
    const y = groundAt(x, z);
    if (y < 2.2 || y > TOP) continue;
    if (woodAt(x, z) < WOOD + 0.25 * r() && r() >= lone) continue; // in stands, with clearings between (and in farmland, a lone tree now and then)
    if (r() < townness(x, z) * 1.6 || slopeAt(x, z) > 1.1) continue; // few in the town, none on the crags
    let pick = r() * total, k = kinds[0];
    for (const q of kinds) { k = q; if ((pick -= q.share) <= 0) break; }
    o.position.set(x, y - 0.6, z); o.rotation.set(0, r() * 6.28, 0);
    const s = 0.75 + r() * 0.65 - Math.min(0.3, y / (TOP * 3)); o.scale.set(s, s * (0.85 + r() * 0.35), s);
    o.updateMatrix();
    const key = k.kind + ':' + Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    if (!tiles.has(key)) tiles.set(key, { k, list: [] });
    tiles.get(key).list.push([o.matrix.clone(), c.copy(k.dark).lerp(k.light, r() * 0.7).multiplyScalar(0.9 + r() * 0.2).clone()]);
    n++;
  }
  const geos = {}, mat = farFog(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.6), g = new THREE.Group();
  for (const { k, list } of tiles.values()) {
    const m = new THREE.InstancedMesh(geos[k.kind] || (geos[k.kind] = treeGeo(k.kind)), mat, list.length);
    list.forEach(([mx, col], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, col); });
    m.computeBoundingSphere(); // round all of the tile's trees, before setQuality draws fewer
    m.userData.max = list.length;
    g.add(m);
  }
  return g;
}

// ---------- the town ----------
// the mapped buildings as they are on the map, and the many houses the map lacks round them: white or cream walls,
// mostly terracotta roofs
const WALLS = LOOK.walls, ROOFS = LOOK.roofs, FLAT = LOOK.flat ?? 0.45;
// the tall ones: concrete, stone and glass, flat on top
const TOWERS = ['#9aa6b0', '#b8c0c6', '#7f8c96', '#d4d6d2', '#c9c2b4', '#6f7d88'];
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
    if (h >= 20) parts.push(paint(g, TOWERS[Math.floor(r() * TOWERS.length)], '#8a8e90'));
    else parts.push(paint(g, WALLS[Math.floor(r() * WALLS.length)], r() >= FLAT ? ROOFS[Math.floor(r() * ROOFS.length)] : '#ddd6c8'));
    mark(cx, cz, Math.sqrt(area) / 2 + 4);
  }
  // the houses the map hasn't got: thick in the town, scattered as villas up the slopes round the bay
  const box = strip(paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), '#fff')), roof = strip(paint(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), '#fff'));
  const houses = new Batch(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
  let n = 0;
  const most = Math.min(2400, 900 * TOWNS.reduce((a, t) => a + (t.r / 650) ** 2, 0) ** 0.5);
  for (let t = 0; t < 40000 && n < most; t++) {
    const inTown = t % 3 !== 0, T0 = TOWNS[Math.floor(r() * TOWNS.length)];
    const x = inTown ? T0.x + (r() - 0.5) * T0.r * 2.6 : MID.x + (r() - 0.5) * 6000, z = inTown ? T0.z + (r() - 0.5) * T0.r * 2.2 : MID.z + (r() - 0.5) * 6000;
    const tn = townness(x, z), sea = roomAt(x, z);
    if (sea > -12) continue; // ashore, a little back from the water
    if (inTown ? r() > tn * 1.4 : sea < -350 || r() > 0.18) continue;
    const y = groundAt(x, z);
    if (y < 1.5 || y > (inTown ? 90 : 160) || slopeAt(x, z) > 0.45) continue;
    if (taken.has(key(x, z))) continue;
    const w = 6 + r() * 5, d = 6 + r() * 4, h = r() < 0.6 ? 3.2 : 6.2, a = r() * Math.PI;
    q.setFromAxisAngle(up, a);
    houses.add(box, m4.compose(P.set(x, y - 1.2, z), q, S.set(w, h + 1.2, d)), C(WALLS[Math.floor(r() * WALLS.length)]));
    if (r() >= FLAT * 0.45) houses.add(roof, m4.compose(P.set(x, y + h, z), q, S.set(w * 1.08, 1.6 + r() * 0.6, d * 1.08)), C(ROOFS[Math.floor(r() * ROOFS.length)]));
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
// a superyacht: some 40 m, three decks of white and dark glass
function superGeo() {
  const L = 40, B = 8.4;
  return mergeGeometries([
    hull(L, B, 3.2, '#fbfbf9', '#c9a77c'),
    paint(at(new THREE.BoxGeometry(6.8, 2.6, 22), 0, 4.1, -15), '#f6f6f3'),
    tint(at(new THREE.BoxGeometry(6.9, 1.0, 20), 0, 4.2, -15.5), '#1d2730'),
    paint(at(new THREE.BoxGeometry(5.8, 2.4, 14), 0, 6.6, -16), '#f6f6f3'),
    tint(at(new THREE.BoxGeometry(5.9, 0.9, 12.5), 0, 6.7, -16.5), '#1d2730'),
    paint(at(new THREE.BoxGeometry(4.6, 2.2, 7), 0, 8.9, -17), '#f2f2ee'),
    tint(at(new THREE.BoxGeometry(4.66, 0.8, 6), 0, 9.0, -17.4), '#1d2730'),
    tint(at(new THREE.CylinderGeometry(0.12, 0.18, 4, 5), 0, 11.8, -18), '#dddddd'),
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
  const BO = LOOK.boats, superBig = BO.bigKind === 'super';
  const kinds = [
    { geo: sailboatGeo(), L: 13, B: 4.1, gap: 4.7, list: [] },
    { geo: motorGeo(), L: 15, B: 4.6, gap: 5.2, list: [] },
    superBig ? { geo: superGeo(), L: 40, B: 8.4, gap: 10, list: [] } : { geo: guletGeo(), L: 27, B: 6.4, gap: 7.4, list: [] },
  ];
  // which boat a berth gets: on a quay mostly the big ones; on a pontoon the venue's mix
  const pickKind = (quay) => {
    if (quay) return BO.big && r() < 0.6 ? kinds[2] : kinds[1];
    const u = r(); return u < BO.big ? kinds[2] : u < BO.big + BO.motor ? kinds[1] : kinds[0];
  };
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
        const k = pickKind(s.p.kind === 'quay');
        const sc = k === kinds[2] ? 0.85 + r() * 0.3 : 0.85 + r() * 0.35, L = k.L * sc, gap = k.gap * sc;
        const sx = ax + tx * (u + gap / 2) + nx * (w / 2 + 1.2), sz = az + tz * (u + gap / 2) + nz * (w / 2 + 1.2);
        const mx = sx + nx * L * 0.5, mz = sz + nz * L * 0.5, bwx = sx + nx * L, bwz = sz + nz * L;
        let ok = r() < (s.p.kind === 'quay' && META.home ? 0.45 : 0.92) && u + gap < l - 1 // a berth or two empty (and half of a quay away from Göcek's, a working one)
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

// ---------- the landmarks ----------
// what the json lists: a steel arch bridge (Sydney Harbour), a suspension bridge (Newport), a tower (Auckland's Sky
// Tower, Laboe's naval memorial), a lighthouse. Each in one colour a part, merged into one mesh.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), XA = V3(1, 0, 0);
// a beam from a to b, w wide and h deep
function beam(a, b, w, h, col) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(XA, d.normalize()), V3(len + Math.min(w, h) * 0.5, h, w));
  return tint(new THREE.BoxGeometry(1, 1, 1).applyMatrix4(m), col);
}
const post = (x, z, y0, r0, r1, h, col, n = 12) => tint(new THREE.CylinderGeometry(r1, r0, h, n).translate(x, y0 + h / 2, z), col);
function landmarks() {
  const parts = [];
  for (const L of META.landmarks || []) {
    if (L.kind === 'arch' || L.kind === 'suspension') {
      // the bridge's own axes: u along it from a to b, v across, round the middle of its main span
      const [ax, az] = L.a, [bx, bz] = L.b, len = Math.hypot(bx - ax, bz - az), du = { x: (bx - ax) / len, z: (bz - az) / len };
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, S = L.span;
      const P = (u, y, v = 0) => V3(mx + du.x * u - du.z * v, y, mz + du.z * u + du.x * v);
      const half = Math.max(len / 2, S / 2 + 150) + 60;
      if (L.kind === 'arch') {
        const steel = '#6c7377', stone = '#c9b99a', D = L.deck;
        // the deck, right across, on piers over the approaches; the granite pylons at each end of the arch
        parts.push(beam(P(-half, D), P(half, D), 46, 3, '#5f6669'));
        for (let u = S / 2 + 70; u < half; u += 60) for (const sd of [-1, 1]) parts.push(beam(P(sd * u, -2), P(sd * u, D - 1.5), 10, 30, stone));
        for (const sd of [-1, 1]) for (const v of [-19, 19]) parts.push(beam(P(sd * (S / 2 + 14), -2, v), P(sd * (S / 2 + 14), 89, v), 14, 26, stone));
        // the two trusses: the bottom chord springing from the water, the top one from the deck, verticals and diagonals between
        const N = 24, yb = (u) => 4 + (L.h - 16 - 4) * (1 - (2 * u / S) ** 2), yt = (u) => D + 3 + (L.h - D - 3) * (1 - (2 * u / S) ** 2);
        for (const v of [-15, 15]) {
          for (let i = 0; i < N; i++) {
            const u0 = -S / 2 + (S * i) / N, u1 = u0 + S / N;
            parts.push(beam(P(u0, yb(u0), v), P(u1, yb(u1), v), 3.5, 4.5, steel), beam(P(u0, yt(u0), v), P(u1, yt(u1), v), 3, 3.5, steel));
            parts.push(beam(P(u0, yb(u0), v), P(u0, yt(u0), v), 1.6, 1.6, steel), beam(P(i % 2 ? u0 : u1, yb(i % 2 ? u0 : u1), v), P(i % 2 ? u1 : u0, yt(i % 2 ? u1 : u0), v), 1.2, 1.2, steel));
            if (yb(u0) > D + 2) parts.push(beam(P(u0, yb(u0), v), P(u0, D, v), 0.7, 0.7, steel)); // the hangers down to the deck
          }
        }
        for (let i = 0; i <= N; i += 2) { const u = -S / 2 + (S * i) / N; parts.push(beam(P(u, yt(u), -15), P(u, yt(u), 15), 1.4, 1.4, steel)); }
      } else {
        // the towers, the deck rising to them, the main cables and the hangers
        const D = L.deck, H = L.h, side = S * 0.42, grey = '#7d8a8f', cable = '#3a4144';
        const deckY = (u) => { const a = Math.abs(u); return a <= S / 2 + side ? D : Math.max(12, D - (a - S / 2 - side) * ((D - 12) / Math.max(1, half - S / 2 - side))); };
        for (let u = -half; u < half; u += 50) parts.push(beam(P(u, deckY(u)), P(u + 50, deckY(u + 50)), 22, 3, '#6a7276'));
        for (let u = -half + 25; u < half; u += 75) if (Math.abs(Math.abs(u) - S / 2) > 30) parts.push(beam(P(u, -2), P(u, deckY(u) - 1.5), 6, 6, grey));
        for (const sd of [-1, 1]) {
          for (const v of [-12, 12]) parts.push(beam(P(sd * S / 2, -2, v), P(sd * S / 2, H, v), 5, 5, grey));
          for (const y of [D - 4, H * 0.62, H - 3]) parts.push(beam(P(sd * S / 2, y, -12), P(sd * S / 2, y, 12), 3, 4, grey));
        }
        for (const v of [-12, 12]) {
          const main = (u) => D + 4 + (H - D - 4) * (2 * u / S) ** 2, sideY = (u) => { const t = (Math.abs(u) - S / 2) / side; return H - (H - D - 2) * t ** 0.8; };
          for (let u = -S / 2; u < S / 2; u += 20) {
            parts.push(beam(P(u, main(u), v), P(u + 20, main(u + 20), v), 0.9, 0.9, cable));
            if (u > -S / 2) parts.push(beam(P(u, main(u), v), P(u, D, v), 0.25, 0.25, cable));
          }
          for (const sd of [-1, 1]) for (let t = 0; t < side; t += 20) {
            const u0 = sd * (S / 2 + t), u1 = sd * (S / 2 + Math.min(side, t + 20));
            parts.push(beam(P(u0, sideY(u0), v), P(u1, sideY(u1), v), 0.9, 0.9, cable));
            if (t > 0) parts.push(beam(P(u0, sideY(u0), v), P(u0, D, v), 0.25, 0.25, cable));
          }
        }
      }
    } else if (L.kind === 'tower') {
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z));
      if (L.style === 'sky') { // a concrete shaft, the pod of decks and glass, the mast
        parts.push(post(x, z, y, 7, 6, 190, '#d9d9d4'), post(x, z, y + 186, 15, 18, 10, '#cfcfca'), post(x, z, y + 196, 19, 19, 14, '#3b4a55'),
          post(x, z, y + 210, 18, 15, 8, '#d9d9d4'), post(x, z, y + 218, 5, 4.5, 30, '#d9d9d4'), post(x, z, y + 248, 2.5, 0.5, L.h - 248, '#c8c8c4', 8));
      } else { // a tapering brick tower, like a ship's stern
        parts.push(tint(new THREE.CylinderGeometry(4.5, 9, L.h, 4).rotateY(Math.PI / 4).translate(x, y + L.h / 2, z), '#7a5246'), tint(new THREE.BoxGeometry(40, 9, 26).translate(x, y + 4.5, z + 18), '#8a6a5c'));
      }
    } else if (L.kind === 'lighthouse') {
      const [x, z] = L.at, y = L.ground === 0 ? 0 : Math.max(0, groundAt(x, z)), h = L.h;
      if (y <= 0.5) parts.push(post(x, z, -3, 7, 7, 5, '#9a958a'));
      parts.push(post(x, z, y, 3.6, 2.3, h - 6, '#f2efe8'), post(x, z, y + h - 6, 2.6, 2.6, 3.5, '#2a3238'), tint(new THREE.ConeGeometry(2.9, 2.6, 12).translate(x, y + h - 1.3, z), '#a8322a'));
    }
  }
  if (!parts.length) return null;
  // less haze on them than on the hills: they are what the venue is known by, seen from the course 4 or 5 km off
  return new THREE.Mesh(mergeGeometries(parts.map(strip)), farFog(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.22));
}

// ---------- all of it ----------
export class Skopea {
  constructor() {
    this.group = new THREE.Group();
    this.land = terrain(); this.trees = pines(12000); this.town = town(); this.boats = marinas();
    this.landmarks = landmarks(); if (this.landmarks) this.town.add(this.landmarks);
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
