// The land round the course, drawn from what land.js loads for the race's venue (venues.js): the real hills, with
// what the map says is on them (woods, scrub, fields, towns, beaches, bare rock) and the venue's own look where it
// says nothing, shaded by the sky each point sees and by the hills between it and the sun; the mountains beyond, out
// to 64 km; the towns, with their real buildings and roofs; the marinas' pontoons with the yachts moored stern-to
// along them; and the landmarks (a bridge, a tower, a lighthouse). Named for Göcek bay, the first of them: its pine
// forest, Skopea Marina and the gulets on its quays. Everything here is in the venue's own frame (land.js), and the
// world moves the whole group so the race's start sits where land.js laid it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SKOPEA, roomAt, VENUE } from './land.js';
import { SKY_GLSL } from './light.js';

const META = SKOPEA.meta, P = SKOPEA.parts, LOOK = VENUE.look;
const TN = META.terrain.n, TE = META.terrain.ext, TC = (2 * TE) / TN, W1 = TN + 1;
const GN = META.grid.n, GC = META.grid.cell; // the 20 m grid of the cover, the open sky and the depth
const CLS = Object.fromEntries(META.classes.map((c, i) => [c, i]));

// a steady random for the scattering, and a smooth noise for the woods
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const hash = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (hash(i, j) * (1 - su) + hash(i + 1, j) * su) * (1 - sv) + (hash(i, j + 1) * (1 - su) + hash(i + 1, j + 1) * su) * sv;
}
const fbm = (x, z) => 0.55 * vnoise(x / 220, z / 220) + 0.3 * vnoise(x / 70, z / 70) + 0.15 * vnoise(x / 22, z / 22);

// ---------- the terrain: the leaves of the quadtree (blender/venues.py), two triangles each, or a fan round the
// middle where a neighbour is finer and has a corner on its edge ----------
const bit = (a, k) => (a[k >> 3] >> (7 - (k & 7))) & 1;
const KIDS = [[0, 0], [0, 1], [1, 0], [1, 1]];
const TREE = (() => {
  const n = P.treeLen, kids = new Int32Array(n * 4).fill(-1), leafOf = new Int32Array(n).fill(-1);
  const L = [], I = [], J = [], D = [];
  let tb = 0, lb = 0;
  const walk = (lv, i, j) => {
    const me = tb, sp = bit(P.tree, tb++);
    if (sp) for (let c = 0; c < 4; c++) kids[me * 4 + c] = walk(lv + 1, 2 * i + KIDS[c][0], 2 * j + KIDS[c][1]);
    else { leafOf[me] = L.length; L.push(lv); I.push(i); J.push(j); D.push(bit(P.drawn, lb++)); }
    return me;
  };
  walk(0, 0, 0);
  return { kids, leafOf, L, I, J, D };
})();
const MESH = (() => {
  const { L, I, J, D } = TREE, nl = L.length, key = (r, c) => r * W1 + c;
  const corner = new Uint8Array(W1 * W1), used = new Uint8Array(W1 * W1), fan = new Uint8Array(nl);
  for (let k = 0; k < nl; k++) { const s = TN >> L[k], r = I[k] * s, c = J[k] * s; corner[key(r, c)] = corner[key(r, c + s)] = corner[key(r + s, c)] = corner[key(r + s, c + s)] = 1; }
  for (let k = 0; k < nl; k++) {
    if (!D[k]) continue;
    const s = TN >> L[k], r = I[k] * s, c = J[k] * s, h = s >> 1;
    used[key(r, c)] = used[key(r, c + s)] = used[key(r + s, c)] = used[key(r + s, c + s)] = 1;
    if (s < 2) continue;
    for (const [mr, mc] of [[0, 1], [2, 1], [1, 0], [1, 2]]) { const q = key(r + mr * h, c + mc * h); if (corner[q]) { used[q] = 1; fan[k] = 1; } }
    if (fan[k]) used[key(r + h, c + h)] = 1;
  }
  const index = new Int32Array(W1 * W1).fill(-1);
  let nv = 0;
  for (let q = 0; q < used.length; q++) if (used[q]) index[q] = nv++;
  if (nv !== P.heights.length) console.error(`the terrain has ${nv} corners, its file ${P.heights.length}`);
  const pos = new Float32Array(nv * 3);
  for (let q = 0, v = 0; q < used.length; q++) if (used[q]) { pos[v * 3] = -TE + (q % W1) * TC; pos[v * 3 + 1] = P.heights[v] * 0.1; pos[v * 3 + 2] = -TE + Math.floor(q / W1) * TC; v++; }
  const idx = [], tri0 = new Int32Array(nl), triN = new Uint8Array(nl), Y = (v) => pos[v * 3 + 1];
  for (let k = 0; k < nl; k++) {
    if (!D[k]) continue;
    tri0[k] = idx.length / 3;
    const s = TN >> L[k], r = I[k] * s, c = J[k] * s, h = s >> 1;
    const A = index[key(r, c)], B = index[key(r, c + s)], C = index[key(r + s, c)], E = index[key(r + s, c + s)];
    if (!fan[k]) { // split along the diagonal whose ends are nearer the same height: a ridge stays a ridge
      if (Math.abs(Y(A) - Y(E)) < Math.abs(Y(B) - Y(C))) idx.push(A, C, E, A, E, B); else idx.push(A, C, B, B, C, E);
    } else {
      const M = index[key(r + h, c + h)], ring = [];
      for (const [q, has] of [[A, 1], [key(r, c + h), 0], [B, 1], [key(r + h, c + s), 0], [E, 1], [key(r + s, c + h), 0], [C, 1], [key(r + h, c), 0]]) {
        if (has) ring.push(q); else if (corner[q]) ring.push(index[q]);
      }
      for (let e = 0; e < ring.length; e++) idx.push(M, ring[(e + 1) % ring.length], ring[e]);
    }
    triN[k] = idx.length / 3 - tri0[k];
  }
  return { pos, idx: Uint32Array.from(idx), tri0, triN };
})();

// the ground's height anywhere, metres: on the triangle drawn there (under the sea, where nothing is drawn, −10)
export function groundAt(x, z) {
  const fc = (x + TE) / TC, fr = (z + TE) / TC;
  if (!(fc >= 0 && fr >= 0 && fc <= TN && fr <= TN)) return -20;
  const { kids, leafOf, D } = TREE;
  let node = 0, lv = 0, i = 0, j = 0;
  while (leafOf[node] < 0) {
    const s = TN >> (lv + 1), a = fr >= (2 * i + 1) * s ? 1 : 0, b = fc >= (2 * j + 1) * s ? 1 : 0;
    node = kids[node * 4 + a * 2 + b]; i = 2 * i + a; j = 2 * j + b; lv++;
  }
  const k = leafOf[node];
  if (!D[k]) return -10;
  const { pos, idx, tri0, triN } = MESH;
  let best = -10, bestE = Infinity;
  for (let t = tri0[k]; t < tri0[k] + triN[k]; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const x0 = pos[a], z0 = pos[a + 2], x1 = pos[b], z1 = pos[b + 2], x2 = pos[c], z2 = pos[c + 2];
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d, l2 = 1 - l0 - l1;
    const e = -Math.min(l0, l1, l2);
    if (e < bestE) { bestE = e; best = l0 * pos[a + 1] + l1 * pos[b + 1] + l2 * pos[c + 1]; }
    if (e <= 1e-6) break;
  }
  return best;
}
const slopeAt = (x, z) => { const e = 6; return Math.hypot(groundAt(x + e, z) - groundAt(x - e, z), groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e); };
// what is on the ground there (venues.py's classes; 0 where the map says nothing)
const coverAt = (x, z) => { const j = Math.floor((x + TE) / GC), i = Math.floor((z + TE) / GC); return i >= 0 && j >= 0 && i < GN && j < GN ? P.cover[i * GN + j] : 0; };

// the towns the venue lists, where the houses the map lacks are filled in (and, where the map has no town, the
// ground tinted as one)
const TOWNS = (META.towns || []).map((t) => ({ x: t.at[0], z: t.at[1], r: t.r }));
const townness = (x, z) => { let k = 0; for (const t of TOWNS) k = Math.max(k, 1 - Math.hypot((x - t.x) / 1.1, z - t.z) / t.r); return k; };
// the middle of what is seen: Göcek's inner bay, or the race area
const MID = { x: META.mid[0], z: META.mid[1] };
// the woods where the map has nothing: in stands with clearings between, more of them where the venue is more wooded
const WOOD = 0.38 + (1 - (LOOK.woods ?? 1)) * 0.35;
const woodAt = (x, z) => fbm(x * 1.7, z * 1.7);
const TOP = LOOK.treeTop || 650; // the trees' height limit; the bare tops start a little under it

const C = (h) => new THREE.Color(h);
const GR = LOOK.ground;
const FIELDS = (LOOK.fields || []).map(C);
const SAND = C(GR.sand || '#d8c8a0'), GRASS = GR.grass ? C(GR.grass) : FIELDS.length ? FIELDS[0].clone().lerp(C(GR.scrub), 0.35) : C(GR.scrub).lerp(C(GR.forest[2]), 0.5);
// the ground's colours, in the order GROUND_GLSL reads them
const PALETTE = [GR.forest[0], GR.forest[1], GR.forest[2], GR.scrub, GR.rock[0], GR.rock[1], GR.town, GR.shore].map(C).concat([SAND, GRASS, C(GR.scrub).lerp(C(GR.forest[0]), 0.5)]);

// ---------- the light on the land: the open sky, the hills' shadow and the haze ----------
// textures of one channel over the terrain's square: the cover (as it is), the open sky and the depth (smoothed)
function gridTex(data, n, smooth) {
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  t.unpackAlignment = 1; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = t.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
// the hills' shadow: from each point of a 40 m grid, whether the sun clears the land between it and the sun (made
// again whenever the sun moves: setLight)
const SH_N = Math.round((2 * TE) / 40), SH_C = (2 * TE) / SH_N, SH = new Uint8Array(SH_N * SH_N).fill(255);
const SH_TEX = gridTex(SH, SH_N, true);
let SH_H = null, SH_MAX = 0;
function shadows(sun) {
  if (!SH_H) {
    SH_H = new Float32Array(SH_N * SH_N);
    for (let i = 0; i < SH_N; i++) for (let j = 0; j < SH_N; j++) { const h = Math.max(0, groundAt(-TE + (j + 0.5) * SH_C, -TE + (i + 0.5) * SH_C)); SH_H[i * SH_N + j] = h; SH_MAX = Math.max(SH_MAX, h); }
  }
  const hl = Math.max(Math.hypot(sun.x, sun.z), 1e-4), ux = sun.x / hl, uz = sun.z / hl, te = sun.y / hl, n = SH_N, H = SH_H;
  const at = (fx, fz) => { const i = Math.floor(fz), j = Math.floor(fx), u = fx - j, v = fz - i, k = i * n + j; return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n] * (1 - u) + H[k + n + 1] * u) * v; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const h0 = H[i * n + j] + 2, reach = te > 0 ? (SH_MAX - h0) / te : 1e9;
    let top = -1;
    for (let t = 30; t < 9000 && t < reach; t *= 1.1) {
      const fx = j + (ux * t) / SH_C, fz = i + (uz * t) / SH_C;
      if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) break;
      top = Math.max(top, (at(fx, fz) - h0) / t);
      if (top > te + 0.04) break;
    }
    const d = Math.min(1, Math.max(0, (te - top + 0.035) / 0.07));
    SH[i * n + j] = Math.round(255 * d * d * (3 - 2 * d));
  }
  SH_TEX.needsUpdate = true;
}
// what every land material shares (the world sets the haze and the place; setLight the shadows)
const LAND_U = {
  uAt: { value: new THREE.Vector3() },
  uGridXf: { value: new THREE.Vector3(-TE, -TE, 1 / (GN * GC)) }, uShadeXf: { value: new THREE.Vector3(-TE, -TE, 1 / (SH_N * SH_C)) },
  uAO: { value: gridTex(P.ao, META.ao.n, true) }, uAOXf: { value: new THREE.Vector3(-TE, -TE, 1 / (META.ao.n * META.ao.cell)) }, uShadeTex: { value: SH_TEX },
  uHazeL: { value: 7700 }, uHazeCap: { value: 0.92 },
};
let SKY_U = {}; // the sky's uniforms (light.js), from the world
// Each land material is three.js's own, with the venue's point (vLand) and the view's (vHz) handed on to the pixel:
// the light there is dimmed by the hills' shadow (the sun's) and by how much of the sky is hidden (the sky's), and
// its haze is the sea's own: the sky's colour at the horizon that way, thicker with the distance, so the far hills
// fade into it as the sea does and the mountains out to 64 km are a pale outline. k: how fast it thickens.
const LAND_FS = /* glsl */ `
uniform vec3 uGridXf, uShadeXf, uAOXf; uniform sampler2D uAO, uShadeTex; uniform float uHazeL, uHazeCap, uHazeK;
varying vec3 vLand; varying vec3 vHz;
${SKY_GLSL}
float landSun(vec2 p) { vec2 g = (p - uShadeXf.xy) * uShadeXf.z; return g.x > 0.0 && g.y > 0.0 && g.x < 1.0 && g.y < 1.0 ? texture2D(uShadeTex, g).r : 1.0; }
`;
function landMat(m, k = 1, o = {}) {
  m.fog = false;
  const hk = { value: k };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LAND_U, SKY_U, { uHazeK: hk }, o.uniforms || {});
    sh.vertexShader = 'uniform vec3 uAt; varying vec3 vLand; varying vec3 vHz;\n' + (o.vsHead || '') + '\n' + sh.vertexShader.replace('#include <project_vertex>', (o.project || '#include <project_vertex>') + `
      vec4 lwp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        lwp = instanceMatrix * lwp;
      #endif
      lwp = modelMatrix * lwp; vLand = lwp.xyz + uAt; vHz = lwp.xyz - cameraPosition;
      ${o.vs || ''}`);
    let fs = LAND_FS + (o.fsHead || '') + sh.fragmentShader;
    if (o.colour) fs = fs.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( ${o.colour}, opacity );`);
    if (!o.unlit) fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float sun = landSun(vLand.xz), sky = texture2D(uAO, (vLand.xz - uAOXf.xy) * uAOXf.z).r * (255.0 / 252.0);
        reflectedLight.directDiffuse *= sun; reflectedLight.directSpecular *= sun; reflectedLight.indirectDiffuse *= 0.3 + 0.7 * sky; }`);
    sh.fragmentShader = fs.replace('#include <tonemapping_fragment>', `{
        float hf = uHazeCap * (1.0 - exp(-length(vHz) * uHazeK / uHazeL));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, skyBase(normalize(vec3(vHz.x, 0.0, vHz.z) + vec3(0.0, 1e-4, 0.0))), hf);
      }
      #include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => 'land-' + (o.key || 'plain');
  return m;
}

// ---------- the ground's colour, worked out for each pixel ----------
// What the map says is there, read from the cover with its cells' edges frayed by a little noise; where it says
// nothing, the venue's look: the woods mottled, thinning to scrub and bare rock on the crags and the tops. Fields in
// parcels some 140 by 95 m, their lines turning slowly across the country, each its own crop.
const GROUND_U = {
  uCover: { value: gridTex(P.cover, GN, false) },
  uCol: { value: PALETTE }, uFields: { value: Array.from({ length: 6 }, (_, i) => FIELDS.length ? FIELDS[i % FIELDS.length] : GRASS) }, uNF: { value: FIELDS.length },
  uTowns: { value: Array.from({ length: 8 }, (_, i) => TOWNS[i] ? new THREE.Vector3(TOWNS[i].x, TOWNS[i].z, TOWNS[i].r) : new THREE.Vector3(0, 0, -1)) },
  uTreeTop: { value: TOP }, uSnow: { value: LOOK.snow || 2900 }, uNear: { value: TE },
};
const GROUND_GLSL = /* glsl */ `
uniform sampler2D uCover; uniform vec3 uCol[11], uFields[6], uTowns[8]; uniform float uNF, uTreeTop, uSnow, uNear;
varying vec3 vLN;
float lhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lnoise(vec2 x) { vec2 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lhash(i), lhash(i + vec2(1.0, 0.0)), u.x), mix(lhash(i + vec2(0.0, 1.0)), lhash(i + vec2(1.0, 1.0)), u.x), u.y); }
float lfbm(vec2 p) { return 0.55 * lnoise(p / 220.0) + 0.3 * lnoise(p / 70.0) + 0.15 * lnoise(p / 22.0); }
vec3 field(vec2 p) {
  float a = lnoise(p / 2400.0 + 7.0) * 1.6, ca = cos(a), sa = sin(a);
  vec2 q = floor(vec2((p.x * ca + p.y * sa) / 140.0, (p.y * ca - p.x * sa) / 95.0));
  int k = int(floor(lhash(q + 0.5) * max(uNF, 1.0)));
  vec3 c = uFields[0];
  for (int i = 1; i < 6; i++) if (i == k) c = uFields[i];
  return c * (0.9 + 0.12 * lnoise(p / 11.0));
}
vec3 groundColour() {
  vec3 p = vLand; float y = p.y, ny = normalize(vLN).y;
  vec2 g = (p.xz - uGridXf.xy) * uGridXf.z + (vec2(lnoise(p.xz / 7.0), lnoise(p.zx / 7.0 + 3.1)) - 0.5) * uGridXf.z * 24.0;
  int cls = int(texture2D(uCover, g).r * 255.0 + 0.5);
  float n = lfbm(p.xz), steep = smoothstep(0.32, 0.6, 1.0 - ny), high = smoothstep(uTreeTop * 0.65, uTreeTop * 1.26, y);
  vec3 forest = mix(mix(uCol[0], uCol[1], n), uCol[2], max(0.0, n - 0.62) * 1.6);
  vec3 c = forest; float wild = 1.0; // how far the slope and the height turn it to scrub and rock
  if (cls == 2) c = mix(uCol[3], forest, 0.3 * n);
  else if (cls == 3) c = uCol[9] * (0.88 + 0.2 * lnoise(p.xz / 40.0));
  else if (cls == 4) { c = uNF > 0.0 ? field(p.xz) : uCol[9]; wild = 0.6; }
  else if (cls == 5) c = mix(uCol[9], uCol[0], 0.3 + 0.35 * step(0.55, fract((p.x * 0.6 + p.z * 0.8) / 6.0)));
  else if (cls == 6) { c = uCol[6] * (0.8 + 0.35 * lnoise(p.xz / 9.0)); wild = 0.25; }
  else if (cls == 7) { c = mix(uCol[6], vec3(0.33), 0.45) * (0.8 + 0.3 * lnoise(p.xz / 22.0)); wild = 0.25; }
  else if (cls == 8) { c = uCol[8] * (0.93 + 0.12 * lnoise(p.xz / 9.0)); wild = 0.0; }
  else if (cls == 9) { // bare rock and scree: never quite bare, streaked, with scrub in its gullies
    float st = lnoise(vec2(p.x / 14.0, p.z / 14.0) + lnoise(p.xz / 60.0) * 3.0);
    c = mix(mix(uCol[5], uCol[4], 0.35 + 0.5 * st), mix(uCol[3], forest, 0.5), smoothstep(0.55, 0.8, lnoise(p.xz / 45.0)) * 0.6);
  }
  else if (cls == 10) c = uCol[10];
  else if (cls == 0) { // where the map has no town, the venue's towns tint the ground
    float t = 0.0;
    for (int i = 0; i < 8; i++) if (uTowns[i].z > 0.0) t = max(t, 1.0 - length(vec2((p.x - uTowns[i].x) / 1.1, p.z - uTowns[i].y)) / uTowns[i].z);
    c = mix(c, uCol[6], clamp(t, 0.0, 1.0) * 0.7 * smoothstep(0.9, 0.97, ny));
  }
  c = mix(c, uCol[3], max(steep * 0.55, high * 0.5) * (0.6 + 0.4 * n) * wild);
  c = mix(c, n > 0.5 ? uCol[4] : uCol[5], max(smoothstep(0.5, 0.75, 1.0 - ny), high * 0.7) * (0.55 + 0.45 * lnoise(p.xz / 40.0)) * max(wild, 0.5));
  // the shore: a narrow band of the beach's sand, or of rock, down into the water
  c = mix(c, cls == 8 ? uCol[8] : uCol[7], 0.85 * (1.0 - smoothstep(1.3, 2.3, y)));
  return c;
}
`;

const FAR_GLSL = /* glsl */ `
// the land beyond the terrain: wooded low down, scrub and rock higher, snow on the tops above the venue's snow line
varying float vFarZ;
vec3 farColour() {
  if (abs(vLand.x) < uNear && abs(vLand.z) < uNear && vFarZ < 8850.0) discard; // the terrain is drawn there
  if (vLand.y < 0.0) discard; // the sea, past the terrain: the sky's haze
  float y = vLand.y, ny = normalize(vLN).y, n = lnoise(vLand.xz / 900.0) * 0.6 + lnoise(vLand.xz / 260.0) * 0.4;
  vec3 c = mix(mix(uCol[0], uCol[1], n), uCol[3], smoothstep(uTreeTop * 0.4, uTreeTop * 1.2, y) * 0.75 + 0.15 * n);
  c = mix(c, mix(uCol[4], uCol[5], n), max(smoothstep(uTreeTop * 1.0, uTreeTop * 1.8, y + (n - 0.5) * 200.0), smoothstep(0.4, 0.7, 1.0 - ny)) * 0.85);
  return mix(c, vec3(0.9, 0.93, 0.97), smoothstep(uSnow - 120.0, uSnow + 120.0, y + (n - 0.5) * 400.0) * smoothstep(0.2, 0.45, ny));
}
`;

// ---------- the hills ----------
function terrain() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(MESH.pos, 3));
  g.setIndex(new THREE.BufferAttribute(MESH.idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return new THREE.Mesh(g, landMat(new THREE.MeshLambertMaterial(), 1, { key: 'ground', colour: 'groundColour()', uniforms: GROUND_U, fsHead: GROUND_GLSL, vsHead: 'varying vec3 vLN;', vs: 'vLN = objectNormal;' }));
}

// ---------- the land beyond: out to 64 km, past where the camera's view ends ----------
// Each point is drawn where it is seen from (its direction), but pulled in to just inside the far end of the view,
// further ones a little further, so the camera's 9 km reaches them; the earth's curve (with the air bending the
// light round it a little) lowers them, so a mountain 50 km off stands 170 m lower and its foot is under the
// horizon. They are drawn behind everything, the farthest first, so a nearer ridge covers a farther one without
// a depth to compare.
const FAR_PROJECT = /* glsl */ `
  vec4 fw = modelMatrix * vec4(transformed, 1.0);
  vec3 fv = fw.xyz - cameraPosition; float fd = length(fv.xz);
  fw.y -= fd * fd / 1.48e7;
  fv = fw.xyz - cameraPosition; float fl = length(fv);
  if (fl > 8500.0) fw.xyz = cameraPosition + fv * ((8500.0 + 460.0 * (1.0 - exp(-(fl - 8500.0) / 16000.0))) / fl);
  vec4 mvPosition = viewMatrix * fw;
  gl_Position = projectionMatrix * mvPosition;`;
function far() {
  const F = META.far, n = F.n, H = P.far, pos = new Float32Array(n * n * 3);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = r * n + c; pos[k * 3] = -F.ext + c * F.cell; pos[k * 3 + 1] = Math.max(H[k] * F.k, -30); pos[k * 3 + 2] = -F.ext + r * F.cell; }
  // the cells, farthest first: on the 400 m grid, and (for the lower graphics levels) on one of 800 m
  const cells = (st) => {
    const list = [];
    for (let r = 0; r + st < n; r += st) for (let c = 0; c + st < n; c += st) {
      const a = r * n + c, b = a + st, d = a + st * n, e = d + st;
      if (Math.max(H[a], H[b], H[d], H[e]) * F.k <= 1) continue;
      const cx = -F.ext + (c + st / 2) * F.cell, cz = -F.ext + (r + st / 2) * F.cell, rad = Math.hypot(cx, cz);
      if (Math.max(Math.abs(cx), Math.abs(cz)) < TE - 900 || rad > F.ext - F.cell) continue;
      list.push([rad, a, b, d, e]);
    }
    list.sort((p, q) => q[0] - p[0]);
    const idx = new Uint32Array(list.length * 6);
    list.forEach(([, a, b, d, e], i) => idx.set([a, d, b, b, d, e], i * 6));
    return new THREE.BufferAttribute(idx, 1);
  };
  const idx = cells(1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, landMat(new THREE.MeshLambertMaterial({ depthTest: false, depthWrite: false }), 1, {
    key: 'far', colour: 'farColour()', unlit: true, uniforms: GROUND_U, fsHead: GROUND_GLSL + FAR_GLSL, project: FAR_PROJECT,
    vsHead: 'varying vec3 vLN; varying float vFarZ;', vs: 'vLN = objectNormal; vFarZ = -(viewMatrix * lwp).z;',
  }));
  m.frustumCulled = false; m.renderOrder = -1; m.userData.full = idx; m.userData.coarse = cells(2);
  return m;
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
  far: () => [blob(3.6, 4.2, 3.6, 0, 5, 0)], // past 4 km: a crown, no trunk
};
const treeGeo = (kind) => mergeGeometries((TREES[kind] || TREES.pine)().map(strip));
// how likely a tree is to stand, by what the map says is there (where it says nothing, the venue's woods decide)
const TREE_P = { forest: 1, scrub: 0.3, grass: 0.05, farmland: 0.025, orchard: 0.5, town: 0.08, industry: 0.01, sand: 0.015, rock: 0.02, wetland: 0.15 };
const TREE_K = META.classes.map((c) => TREE_P[c] ?? -1);
// They are in 1.5 km tiles, one instanced mesh each, so a tile behind the camera isn't drawn at all; each tile's
// instances are in no order, so the lower graphics levels draw the first part of every tile.
const TILE = 1500;
function pines(count, far = false) {
  const r = rng(far ? 93 : 91), o = new THREE.Object3D(), c = new THREE.Color(), tiles = new Map();
  const kinds = LOOK.trees.map(([kind, share, dark, light]) => ({ kind, share, dark: C(dark), light: C(light) }));
  const total = kinds.reduce((a, k) => a + k.share, 0), lone = FIELDS.length ? 0.05 : 0, shrub = kinds.find((k) => k.kind === 'shrub');
  const palm = kinds.find((k) => k.kind === 'palm');
  const farKind = { kind: 'far', dark: C(GR.forest[0]), light: C(GR.forest[1]) };
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 30) {
    // the near ones mostly near the race area, where they're seen close, thinning out up to 4.5 km off; the far
    // ones from 4 km out to the terrain's edge
    const a = r() * Math.PI * 2, d = far ? 4000 + 4600 * r() : 4500 * Math.pow(r(), 1.6), x = MID.x + Math.cos(a) * d, z = MID.z + Math.sin(a) * d * 1.1;
    const y = groundAt(x, z);
    if (y < 2.2 || y > TOP) continue;
    const cl = coverAt(x, z), p = TREE_K[cl];
    if (p < 0) { if (woodAt(x, z) < WOOD + 0.25 * r() && r() >= lone) continue; } // in stands, with clearings between (and in farmland, a lone tree now and then)
    else if (r() >= (far ? (cl === CLS.forest ? 1 : 0) : p)) continue;
    if ((p < 0 && r() < townness(x, z) * 1.6) || slopeAt(x, z) > 1.1) continue; // few in the town, none on the crags
    let k = kinds[0];
    if (far) k = farKind;
    else if (cl === CLS.scrub && shrub) k = shrub;
    else if (cl === CLS.sand) { if (!palm) continue; k = palm; }
    else { let pick = r() * total; for (const q of kinds) { k = q; if ((pick -= q.share) <= 0) break; } }
    o.position.set(x, y - 0.6, z); o.rotation.set(0, r() * 6.28, 0);
    const s = (0.75 + r() * 0.65 - Math.min(0.3, y / (TOP * 3))) * (cl === CLS.scrub && !shrub ? 0.6 : 1); o.scale.set(s, s * (0.85 + r() * 0.35), s);
    o.updateMatrix();
    const key = k.kind + ':' + Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    if (!tiles.has(key)) tiles.set(key, { k, list: [] });
    tiles.get(key).list.push([o.matrix.clone(), c.copy(k.dark).lerp(k.light, r() * 0.7).multiplyScalar(0.9 + r() * 0.2).clone()]);
    n++;
  }
  const geos = {}, mat = landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 1, { key: 'trees' }), g = new THREE.Group();
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
// the buildings, from the .bin: each one's corners (metres), its height and its roof
function buildings() {
  const out = [];
  for (let b = 0, o = 0; b < P.bn.length; b++) {
    const n = P.bn[b], r = [];
    for (let k = 0; k < n; k++, o += 2) r.push([P.bxz[o], P.bxz[o + 1]]);
    out.push({ r, h: P.bh[b] / 10, roof: P.broof[b] });
  }
  return out;
}
// the smallest rectangle round a footprint (one of its sides along one of the footprint's): its middle, its long
// axis, its half length and half width
function rect(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % r.length], l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 0.5) continue;
    const ux = (x1 - x0) / l, uz = (z1 - z0) / l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of r) { const a = x * ux + z * uz, b = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) {
      const am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
      best = { area, cx: am * ux - bm * uz, cz: am * uz + bm * ux, ux, uz, a: (a1 - a0) / 2, b: (b1 - b0) / 2 };
    }
  }
  if (best && best.a < best.b) Object.assign(best, { ux: -best.uz, uz: best.ux, a: best.b, b: best.a });
  return best;
}
// a hipped roof over a rectangle: the ridge along its length, the ends sloping in; the eaves 0.4 m out
function hipRoof(R, y, col) {
  const a = R.a + 0.4, b = R.b + 0.4, H = Math.min(5, Math.max(1.2, R.b * 0.75)), rl = Math.max(0, a - b);
  const P3 = (u, v, h) => [R.cx + R.ux * u - R.uz * v, y + h, R.cz + R.uz * u + R.ux * v];
  const e1 = P3(a, b, 0), e2 = P3(-a, b, 0), e3 = P3(-a, -b, 0), e4 = P3(a, -b, 0), r1 = P3(rl, 0, H), r2 = P3(-rl, 0, H);
  const tris = [[e1, e2, r2], [e1, r2, r1], [e3, e4, r1], [e3, r1, r2], [e4, e1, r1], [e2, e3, r2]], pos = [];
  for (const [p, q, s] of tris) {
    const ny = (q[2] - p[2]) * (s[0] - p[0]) - (q[0] - p[0]) * (s[2] - p[2]); // the face's normal, up or down
    pos.push(...(ny > 0 ? [p, q, s] : [p, s, q]).flat());
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return tint(g, col);
}
function town() {
  const r = rng(17), parts = [], taken = new Set(), key = (x, z) => `${Math.round(x / 9)},${Math.round(z / 9)}`;
  const mark = (x, z, rad) => { for (let dx = -rad; dx <= rad; dx += 9) for (let dz = -rad; dz <= rad; dz += 9) taken.add(key(x + dx, z + dz)); };
  for (const b of buildings()) {
    let cx = 0, cz = 0; for (const [x, z] of b.r) { cx += x; cz += z; } cx /= b.r.length; cz /= b.r.length;
    const sh = new THREE.Shape(b.r.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))));
    let area = 0; for (let i = 0; i < b.r.length; i++) { const [x0, z0] = b.r[i], [x1, z1] = b.r[(i + 1) % b.r.length]; area += x0 * z1 - x1 * z0; }
    area = Math.abs(area) / 2;
    const h = b.h || (area > 500 ? 8 : area > 150 ? 6.5 : 4.5 + r() * 2.5);
    let y0 = Infinity; for (const [x, z] of b.r) y0 = Math.min(y0, groundAt(x, z));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h + 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(cx, Math.max(0.6, y0) - 1.5, cz);
    if (h >= 20) { parts.push(paint(g, TOWERS[Math.floor(r() * TOWERS.length)], '#8a8e90')); mark(cx, cz, Math.sqrt(area) / 2 + 4); continue; }
    const wall = WALLS[Math.floor(r() * WALLS.length)], roof = ROOFS[Math.floor(r() * ROOFS.length)];
    // a pitched roof where the map says so, or on a house-sized one most of the venue's are pitched on; on the
    // footprint's rectangle, where it fills most of it
    const R = b.roof !== 1 && h < 16 && area < 900 && (b.roof === 2 || r() >= FLAT) ? rect(b.r) : null;
    if (R && area > R.area * 0.78) { parts.push(paint(g, wall, roof), hipRoof(R, Math.max(0.6, y0) + h, roof)); }
    else parts.push(paint(g, wall, R || r() >= FLAT ? roof : '#ddd6c8'));
    mark(cx, cz, Math.sqrt(area) / 2 + 4);
  }
  // the houses the map hasn't got: thick where the map has a town (or the venue lists one), scattered as villas up
  // the slopes round the bay
  const box = strip(paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), '#fff')), roof = strip(paint(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), '#fff'));
  const houses = new Batch(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), Pv = new THREE.Vector3(), S = new THREE.Vector3();
  const VILLA = new Set([CLS.unknown, CLS.grass, CLS.scrub, CLS.town]);
  let n = 0;
  const most = Math.min(2600, 900 * TOWNS.reduce((a, t) => a + (t.r / 650) ** 2, 0) ** 0.5 + 600);
  for (let t = 0; t < 60000 && n < most; t++) {
    const kind = t % 3, T0 = TOWNS[Math.floor(r() * TOWNS.length)];
    const inTown = kind === 1 && T0;
    const x = inTown ? T0.x + (r() - 0.5) * T0.r * 2.6 : MID.x + (r() - 0.5) * 7000, z = inTown ? T0.z + (r() - 0.5) * T0.r * 2.2 : MID.z + (r() - 0.5) * 7000;
    const sea = roomAt(x, z), cl = coverAt(x, z);
    if (sea > -12) continue; // ashore, a little back from the water
    if (kind === 2) { if (cl !== CLS.town || r() > 0.9) continue; } // in the map's towns
    else if (inTown) { if (r() > townness(x, z) * 1.4 || (cl && cl !== CLS.town && cl !== CLS.grass)) continue; }
    else if (sea < -350 || r() > 0.18 || !VILLA.has(cl)) continue;
    const y = groundAt(x, z);
    if (y < 1.5 || y > (kind ? 120 : 160) || slopeAt(x, z) > 0.45) continue;
    if (taken.has(key(x, z))) continue;
    const w = 6 + r() * 5, d = 6 + r() * 4, h = r() < 0.6 ? 3.2 : 6.2, a = r() * Math.PI;
    q.setFromAxisAngle(up, a);
    houses.add(box, m4.compose(Pv.set(x, y - 1.2, z), q, S.set(w, h + 1.2, d)), C(WALLS[Math.floor(r() * WALLS.length)]));
    if (r() >= FLAT * 0.45) houses.add(roof, m4.compose(Pv.set(x, y + h, z), q, S.set(w * 1.08, 1.6 + r() * 0.6, d * 1.08)), C(ROOFS[Math.floor(r() * ROOFS.length)]));
    mark(x, z, Math.max(w, d) / 2 + 3); n++;
  }
  const g = mergeGeometries([...parts.map(strip), houses.geometry()]);
  return new THREE.Mesh(g, landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 1, { key: 'town' }));
}
// many copies of small shapes, each placed by a matrix and given one colour, written into one geometry
class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.nm = new THREE.Matrix3(); this.v = new THREE.Vector3(); }
  add(geo, m, col) {
    const Pa = geo.attributes.position.array, N = geo.attributes.normal.array, v = this.v;
    this.nm.getNormalMatrix(m);
    for (let i = 0; i < Pa.length; i += 3) {
      v.set(Pa[i], Pa[i + 1], Pa[i + 2]).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
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
  if (boxes.length) group.add(new THREE.Mesh(mergeGeometries(boxes.map(strip)), landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 1)));
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
    const m = new THREE.InstancedMesh(k.geo, landMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }), 1), k.list.length);
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
        const D = L.deck, H = L.h, side = S * 0.42, grey = L.color || '#7d8a8f', cable = L.color ? '#8a2a22' : '#3a4144';
        const deckY = (u) => { const a = Math.abs(u); return a <= S / 2 + side ? D : Math.max(12, D - (a - S / 2 - side) * ((D - 12) / Math.max(1, half - S / 2 - side))); };
        for (let u = -half; u < half; u += 50) parts.push(beam(P(u, deckY(u)), P(u + 50, deckY(u + 50)), 22, 3, L.color || '#6a7276'));
        for (let u = -half + 25; u < half; u += 75) if (Math.abs(u) > S / 2 + side + 20) parts.push(beam(P(u, -2), P(u, deckY(u) - 1.5), 6, 6, grey)); // under the approaches only: the spans hang from the cables
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
      if (L.style === 'candle') { // Enoshima's Sea Candle: a slim shaft, an open lattice flaring out to the lantern deck
        parts.push(post(x, z, y, 3, 2.4, h - 10, '#e8e6e0'), post(x, z, y + h - 22, 4, 9, 12, '#d8d6d0', 16), post(x, z, y + h - 10, 7, 7, 6, '#3b4a55', 16), post(x, z, y + h - 4, 7.5, 3, 4, '#e8e6e0', 16));
      } else parts.push(post(x, z, y, 3.6, 2.3, h - 6, '#f2efe8'), post(x, z, y + h - 6, 2.6, 2.6, 3.5, '#2a3238'), tint(new THREE.ConeGeometry(2.9, 2.6, 12).translate(x, y + h - 1.3, z), '#a8322a'));
    } else if (L.kind === 'spires') {
      // the Sagrada Família: a nave, and its spires, the tallest in the middle
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = '#ad9670';
      parts.push(tint(new THREE.BoxGeometry(90, 45, 60).translate(x, y + 22.5, z), stone));
      const spire = (dx, dz, r, h) => parts.push(post(x + dx, z + dz, y, r, r * 0.8, h * 0.72, stone, 8), tint(new THREE.ConeGeometry(r * 0.8, h * 0.28, 8).translate(x + dx, y + h * 0.86, z + dz), '#c2a878'));
      spire(0, 0, 11, L.h); spire(0, 32, 8, 138); for (const dx of [-24, 24]) spire(dx, -22, 7, 125);
      for (const [dx, dz] of [[-40, -30], [-30, -30], [30, -30], [40, -30], [-40, 30], [-30, 30], [30, 30], [40, 30]]) spire(dx, dz, 3.4, 105);
    } else if (L.kind === 'cathedral') {
      // Palma's La Seu: a long gothic nave on the sea wall, buttressed, a square belfry at one end
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = '#d6c49c';
      parts.push(tint(new THREE.BoxGeometry(110, L.h, 36).translate(x, y + L.h / 2, z), stone), tint(new THREE.BoxGeometry(100, 6, 46).translate(x, y + 18, z), stone));
      for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) parts.push(tint(new THREE.BoxGeometry(3, L.h + 6, 4).translate(x + k * 12, y + (L.h + 6) / 2, z + sd * 20), stone));
      parts.push(tint(new THREE.BoxGeometry(12, 52, 12).translate(x + 52, y + 26, z - 24), stone));
    } else if (L.kind === 'fort') {
      // Marstrand's Carlsten: a round stone keep on the island's top, inside its low walls
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = '#9a9086';
      parts.push(post(x, z, y - 2, 13, 12, L.h + 2, stone, 16), post(x, z, y + L.h, 9, 9, 4, '#7d756c', 16));
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, b = a + Math.PI / 3; parts.push(beam(V3(x + Math.cos(a) * 55, y + 3, z + Math.sin(a) * 55), V3(x + Math.cos(b) * 55, y + 3, z + Math.sin(b) * 55), 8, 8, stone)); }
    } else if (L.kind === 'basilica') {
      // Notre-Dame de la Garde on its hilltop: the striped basilica, the bell tower, and the gilded Virgin on top
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = '#e2d8c4';
      parts.push(tint(new THREE.BoxGeometry(50, 16, 20).translate(x - 25, y + 8, z), stone), post(x - 28, z, y + 16, 7, 7, 8, '#a89a80', 12));
      parts.push(tint(new THREE.BoxGeometry(12, L.h - 11, 12).translate(x, y + (L.h - 11) / 2, z), stone), post(x, z, y + L.h - 11, 4, 3, 3, stone, 8), post(x, z, y + L.h - 8, 1.6, 1.2, 8, '#d9a62e', 8));
    } else if (L.kind === 'statue') {
      // Christ the Redeemer on Corcovado's summit: the pedestal, the robed figure, the arms out 28 m
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = '#e8e4da';
      parts.push(tint(new THREE.BoxGeometry(12, 8, 12).translate(x, y + 4, z), '#bdb6a8'), post(x, z, y + 8, 4.5, 2.6, 22, stone, 10));
      parts.push(tint(new THREE.BoxGeometry(28, 2.4, 2.6).translate(x, y + 27.5, z), stone), post(x, z, y + 30, 1.6, 1.6, 3.5, stone, 8));
    }
  }
  if (!parts.length) return null;
  // less haze on them than on the hills: they are what the venue is known by, seen from the course 4 or 5 km off
  return new THREE.Mesh(mergeGeometries(parts.map(strip)), landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.3));
}

// ---------- all of it ----------
export class Skopea {
  // skyU: the sky's uniforms (light.js), for the haze
  constructor(skyU) {
    SKY_U = skyU;
    this.group = new THREE.Group();
    this.land = terrain(); this.far = far(); this.trees = pines(12000); this.farTrees = pines(9000, true); this.town = town(); this.boats = marinas();
    this.landmarks = landmarks(); if (this.landmarks) this.town.add(this.landmarks);
    this.group.add(this.far, this.land, this.trees, this.farTrees, this.town, this.boats);
    this.group.traverse((o) => { if (o.isMesh) o.matrixAutoUpdate = false; });
    // what the sea needs of the land: the depth (lighter over the shallows) and the hills' shadow
    const W = LOOK.water || {};
    this.waterU = {
      uSeabed: { value: gridTex(P.depth, GN, true) }, uShallow: { value: C(W.shallow || '#4aa79a') }, uShallowK: { value: W.clear ?? 0.45 },
      uLandAt: LAND_U.uAt, uGridXf: LAND_U.uGridXf, uShadeXf: LAND_U.uShadeXf, uShadeTex: LAND_U.uShadeTex,
    };
  }
  // the race's start at its place in the bay
  place(at) { this.group.position.set(-at.x, 0, -at.z); this.group.updateMatrixWorld(true); LAND_U.uAt.value.set(at.x, 0, at.z); }
  // the light of the race (light.js): the haze as thick as the sea's, the hills' shadows from where the sun is
  setLight(L) {
    LAND_U.uHazeL.value = L.fogFar * 2.4;
    shadows(L.sunDir);
  }
  // fewer trees for the lower graphics levels, and none of the far ones on the lowest; the land beyond coarser
  setQuality(q) {
    const f = q === 'high' ? 1 : q === 'medium' ? 0.45 : 0.25, ff = q === 'high' ? 1 : q === 'medium' ? 0.4 : 0;
    for (const m of this.trees.children) m.count = Math.round(m.userData.max * f);
    for (const m of this.farTrees.children) m.count = Math.round(m.userData.max * ff);
    this.far.geometry.setIndex(q === 'high' ? this.far.userData.full : this.far.userData.coarse);
  }
}
