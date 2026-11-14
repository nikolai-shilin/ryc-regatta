// The land round the course, drawn from what land.js loads for the race's venue (venues.js): the real hills, with
// what the map says is on them (woods, scrub, fields, towns, beaches, bare rock) and the venue's own look where it
// says nothing, shaded by the sky each point sees and by the hills between it and the sun; the mountains beyond, out
// to 64 km; the towns, with their real buildings and roofs; the marinas' pontoons with the yachts moored stern-to
// along them; and the landmarks (a bridge, a tower, a lighthouse). Named for Göcek bay, the first of them: its pine
// forest, Skopea Marina and the gulets on its quays. Everything here is in the venue's own frame (land.js), and the
// world moves the whole group so the race's start sits where land.js laid it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SKOPEA, roomAt, VENUE, MESH, TREE, groundAt } from './land.js';
export { groundAt };
import { SKY_GLSL } from './light.js';

const META = SKOPEA.meta, P = SKOPEA.parts, LOOK = VENUE.look;
const TE = META.terrain.ext;
const GN = META.grid.n, GC = META.grid.cell; // the 20 m grid of the cover, the open sky and the depth
const CLS = Object.fromEntries(META.classes.map((c, i) => [c, i]));
// a file baked before the roads, the surf's distance from the shore and the calm water were in it: those parts empty
// (no roads, no surf) on a one-cell grid out of the way
const NEAR = META.near || { x0: 1e6, cell: 1, n: 1 }, NONE = new Uint8Array(1);
for (const k of ['roads', 'shore', 'calm']) if (!P[k]) P[k] = NONE;

// a steady random for the scattering, and a smooth noise for the woods: GROUND_GLSL's lhash, lnoise and lfbm, so the
// stands the trees are scattered in are the ones the ground is coloured as
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const fr = (v) => v - Math.floor(v);
function hash(x, z) {
  let a = fr(x * 0.1031), b = fr(z * 0.1031), c = a;
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d;
  return fr((a + b) * c);
}
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (hash(i, j) * (1 - su) + hash(i + 1, j) * su) * (1 - sv) + (hash(i, j + 1) * (1 - su) + hash(i + 1, j + 1) * su) * sv;
}
const fbm = (x, z) => 0.55 * vnoise(x / 220, z / 220) + 0.3 * vnoise(x / 70, z / 70) + 0.15 * vnoise(x / 22, z / 22);

const slopeAt = (x, z) => { const e = 6; return Math.hypot(groundAt(x + e, z) - groundAt(x - e, z), groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e); };
// what is on the ground there (venues.py's classes; 0 where the map says nothing)
// (its class: the low four bits of the cover; the high four, a variant of it: for a wood, its trees, 1 needle-leaved,
// 2 broad-leaved, 3 mixed)
const coverCell = (x, z) => { const j = Math.floor((x + TE) / GC), i = Math.floor((z + TE) / GC); return i >= 0 && j >= 0 && i < GN && j < GN ? P.cover[i * GN + j] : 0; };
const coverAt = (x, z) => coverCell(x, z) & 15;

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
// The shadows on the land: of the hills, the far mountains, the towns and the woods. From straight above, the
// terrain, the buildings and the trees are drawn into a map of how high each point is; then, for each point of it,
// a walk towards the sun over that map (and on over the land beyond, lowered by the earth's curve, out to 40 km)
// finds whether anything stands above the sun's line. Both on the GPU, whenever the sun moves (setLight).
const SH_N = /android|iphone|ipad/i.test(globalThis.navigator?.userAgent || '') ? 1024 : 2048, SHADOW_LAYER = 7;
const HEIGHTS = new THREE.WebGLRenderTarget(SH_N, SH_N, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const SHADE = new THREE.WebGLRenderTarget(SH_N, SH_N, { format: THREE.RedFormat, depthBuffer: false });
const SH_TEX = SHADE.texture;
const HEIGHT_MAT = new THREE.ShaderMaterial({
  vertexShader: 'varying float vY;\nvoid main() {\n  vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n  p = instanceMatrix * p;\n#endif\n  p = modelMatrix * p; vY = p.y;\n  gl_Position = projectionMatrix * viewMatrix * p;\n}',
  fragmentShader: 'varying float vY;\nvoid main() { gl_FragColor = vec4(max(vY, 0.0), 0.0, 0.0, 1.0); }',
});
const FAR_TEX = (() => {
  const F = META.far, a = new Float32Array(F.n * F.n);
  for (let k = 0; k < a.length; k++) a[k] = Math.max(0, P.far[k] * F.k);
  const t = new THREE.DataTexture(a, F.n, F.n, THREE.RedFormat, THREE.FloatType); t.needsUpdate = true;
  return t;
})();
const SHADE_MAT = new THREE.ShaderMaterial({
  uniforms: { uH: { value: HEIGHTS.texture }, uFar: { value: FAR_TEX }, uSunD: { value: new THREE.Vector3(0, 1, 0) }, uTE: { value: TE }, uFE: { value: META.far.ext } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D uH, uFar; uniform vec3 uSunD; uniform float uTE, uFE; varying vec2 vUv;
    float hAt(vec2 p) {
      vec2 u = (p + uTE) / (2.0 * uTE);
      if (u.x >= 0.0 && u.y >= 0.0 && u.x <= 1.0 && u.y <= 1.0) return texture2D(uH, vec2(u.x, 1.0 - u.y)).r;
      return texture2D(uFar, (p + uFE) / (2.0 * uFE)).r;
    }
    void main() {
      vec2 p = -uTE + vUv * 2.0 * uTE, d = normalize(uSunD.xz + vec2(1e-5));
      float h0 = hAt(p) + 1.5, te = uSunD.y / max(length(uSunD.xz), 1e-4), top = -1.0, t = 10.0;
      for (int i = 0; i < 128; i++) {
        top = max(top, (hAt(p + d * t) - t * t / 1.48e7 - h0) / t);
        t *= 1.07;
        if (t > 40000.0 || top > te + 0.05) break;
      }
      float k = clamp((te - top + 0.03) / 0.06, 0.0, 1.0);
      gl_FragColor = vec4(k * k * (3.0 - 2.0 * k), 0.0, 0.0, 1.0);
    }`,
});
const QUAD = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), SHADE_MAT); QUAD.frustumCulled = false;
const QSCENE = new THREE.Scene().add(QUAD), QCAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const HCAM = new THREE.OrthographicCamera(-TE, TE, TE, -TE, 1, 20000); HCAM.up.set(0, 0, -1); HCAM.layers.set(SHADOW_LAYER);
function shadows(renderer, group, sun) {
  const parent = group.parent, tmp = new THREE.Scene(), was = renderer.getRenderTarget(), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  tmp.overrideMaterial = HEIGHT_MAT; tmp.add(group);
  HCAM.position.set(group.position.x, 10000, group.position.z); HCAM.lookAt(group.position.x, 0, group.position.z); HCAM.updateMatrixWorld();
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(HEIGHTS); renderer.clear(); renderer.render(tmp, HCAM);
  SHADE_MAT.uniforms.uSunD.value.copy(sun);
  renderer.setRenderTarget(SHADE); renderer.render(QSCENE, QCAM);
  renderer.setRenderTarget(was); renderer.setClearColor(clear, alpha);
  if (parent) parent.add(group);
}
// what every land material shares (the world sets the haze and the place; setLight the shadows)
const LAND_U = {
  uAt: { value: new THREE.Vector3() },
  uGridXf: { value: new THREE.Vector3(-TE, -TE, 1 / (GN * GC)) }, uShadeXf: { value: new THREE.Vector3(-TE, -TE, 1 / (2 * TE)) },
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
    let fs = LAND_FS + (o.fsHead || '') + '\n' + sh.fragmentShader;
    if (o.colour) fs = fs.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( ${o.colour}, opacity );`);
    if (o.after) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + o.after);
    if (o.emis) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + o.emis);
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
// What the map says is there, read from the cover with its cells' edges frayed by a little noise: each field its own
// crop, sown in rows, each town and wood its own shade; the roads round the race area; the lakes in the hills and the
// tidal mud. Where it says nothing, the venue's look: the woods in stands (the same stands the trees are scattered in),
// mottled, with clearings, thinning to scrub and bare rock on the crags and the tops.
const share = (() => { // what the venue's land is mostly, for the land beyond: woods, open country, town
  const h = new Float32Array(16); let n = 0;
  for (let k = 0; k < P.cover.length; k += 7) { const c = P.cover[k] & 15; if (c) { h[c]++; n++; } }
  const f = (...cs) => cs.reduce((a, c) => a + h[CLS[c]], 0) / Math.max(n, 1);
  return n < 200 ? new THREE.Vector3(LOOK.woods ?? 1, FIELDS.length ? 0.3 : 0.05, 0.05) : new THREE.Vector3(f('forest', 'scrub'), f('farmland', 'grass', 'orchard'), f('town', 'industry'));
})();
const GROUND_U = {
  uCover: { value: gridTex(P.cover, GN, false) },
  uRoads: { value: gridTex(P.roads, NEAR.n, true) }, uNearXf: { value: new THREE.Vector3(NEAR.x0, NEAR.x0, 1 / (NEAR.n * NEAR.cell)) },
  uCol: { value: PALETTE }, uFields: { value: Array.from({ length: 6 }, (_, i) => FIELDS.length ? FIELDS[i % FIELDS.length] : GRASS) }, uNF: { value: FIELDS.length },
  uTowns: { value: Array.from({ length: 8 }, (_, i) => TOWNS[i] ? new THREE.Vector3(TOWNS[i].x, TOWNS[i].z, TOWNS[i].r) : new THREE.Vector3(0, 0, -1)) },
  uTreeTop: { value: TOP }, uSnow: { value: LOOK.snow || 2900 }, uNear: { value: TE }, uWood: { value: WOOD }, uShare: { value: share },
  uLake: { value: new THREE.Color('#2f5566') },
};
const GROUND_GLSL = /* glsl */ `
uniform sampler2D uCover, uRoads; uniform vec3 uCol[11], uFields[6], uTowns[8], uNearXf, uShare, uLake; uniform float uNF, uTreeTop, uSnow, uNear, uWood;
varying vec3 vLN;
float gLake; // 1 where groundColour() found a lake's still water
float lhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lnoise(vec2 x) { vec2 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lhash(i), lhash(i + vec2(1.0, 0.0)), u.x), mix(lhash(i + vec2(0.0, 1.0)), lhash(i + vec2(1.0, 1.0)), u.x), u.y); }
float lfbm(vec2 p) { return 0.55 * lnoise(p / 220.0) + 0.3 * lnoise(p / 70.0) + 0.15 * lnoise(p / 22.0); }
vec3 crop(int k) { vec3 c = uFields[0]; for (int i = 1; i < 6; i++) if (i == k) c = uFields[i]; return c; }
// fields where the map has none: parcels some 140 by 95 m, their lines turning slowly across the country
vec3 parcels(vec2 p) {
  float a = lnoise(p / 2400.0 + 7.0) * 1.6, ca = cos(a), sa = sin(a);
  vec2 q = floor(vec2((p.x * ca + p.y * sa) / 140.0, (p.y * ca - p.x * sa) / 95.0));
  return crop(int(floor(lhash(q + 0.5) * max(uNF, 1.0)))) * (0.9 + 0.12 * lnoise(p / 11.0));
}
// one of the map's fields: its crop, and its rows, each field's its own way
vec3 sown(vec2 p, float v) {
  vec3 c = crop(int(mod(v, max(uNF, 1.0)))) * (0.9 + 0.12 * lnoise(p / 11.0));
  float a = v * 0.83, row = fract((p.x * cos(a) + p.y * sin(a)) / 4.0);
  return c * (0.94 + 0.08 * smoothstep(0.3, 0.5, row) * smoothstep(0.9, 0.7, row));
}
vec3 groundColour() {
  vec3 p = vLand; float y = p.y, ny = normalize(vLN).y;
  vec2 g = (p.xz - uGridXf.xy) * uGridXf.z + (vec2(lnoise(p.xz / 7.0), lnoise(p.zx / 7.0 + 3.1)) - 0.5) * uGridXf.z * 24.0;
  float cv = floor(texture2D(uCover, g).r * 255.0 + 0.5), v = floor(cv / 16.0);
  int cls = int(cv - v * 16.0);
  // on steep faces the noise is read from the side too (triplanar), so a cliff isn't streaked straight down
  vec3 an = abs(normalize(vLN)); float n = lfbm(p.xz);
  if (an.y < 0.85) { vec3 tw = pow(an, vec3(4.0)); tw /= tw.x + tw.y + tw.z; n = tw.y * n + tw.x * lfbm(p.zy) + tw.z * lfbm(p.xy); }
  float steep = smoothstep(0.32, 0.6, 1.0 - ny), high = smoothstep(uTreeTop * 0.65, uTreeTop * 1.26, y);
  gLake = 0.0;
  vec3 forest = mix(mix(uCol[0], uCol[1], n), uCol[2], max(0.0, n - 0.62) * 1.6);
  vec3 c = forest; float wild = 1.0; // how far the slope and the height turn it to scrub and rock
  if (cls == 1) c = forest * (v == 1.0 ? vec3(0.86, 0.93, 0.92) : v == 2.0 ? vec3(1.05, 1.06, 0.98) : vec3(1.0));
  else if (cls == 2) c = mix(uCol[3], forest, 0.3 * n);
  else if (cls == 3) c = uCol[9] * (0.88 + 0.2 * lnoise(p.xz / 40.0));
  else if (cls == 4) { c = uNF > 0.0 ? sown(p.xz, v) : uCol[9] * (0.9 + 0.03 * v); wild = 0.6; }
  else if (cls == 5) c = mix(uCol[9], uCol[0], 0.3 + 0.35 * step(0.55, fract((p.x * 0.6 + p.z * 0.8) / 6.0)));
  else if (cls == 6) { c = uCol[6] * (0.8 + 0.35 * lnoise(p.xz / 9.0)) * (0.94 + 0.008 * v); wild = 0.25; }
  else if (cls == 7) { c = mix(uCol[6], vec3(0.33), 0.45) * (0.8 + 0.3 * lnoise(p.xz / 22.0)); wild = 0.25; }
  else if (cls == 8) { c = uCol[8] * (0.93 + 0.12 * lnoise(p.xz / 9.0)); wild = 0.0; }
  else if (cls == 9) { // bare rock and scree: never quite bare, streaked, with scrub in its gullies
    float st = lnoise(vec2(p.x / 14.0, p.z / 14.0) + lnoise(p.xz / 60.0) * 3.0);
    c = mix(mix(uCol[5], uCol[4], 0.35 + 0.5 * st), mix(uCol[3], forest, 0.5), smoothstep(0.55, 0.8, lnoise(p.xz / 45.0)) * 0.6);
  }
  else if (cls == 10) c = uCol[10];
  else if (cls == 11 && ny > 0.97) { c = uLake; wild = 0.0; gLake = 1.0; } // a lake, a reservoir: its surface mirrors the sky (lakeLight)
  else if (cls == 12) { c = mix(uCol[7], vec3(0.16, 0.15, 0.12), 0.45) * (0.85 + 0.25 * lnoise(p.xz / 6.0)); wild = 0.0; } // the tidal mud, wet
  else if (cls == 0) {
    // the woods in stands, as the trees are (pines(): woodAt), with grass or fields in the clearings
    float open = (1.0 - smoothstep(uWood - 0.04, uWood + 0.06, lfbm(p.xz * 1.7))) * smoothstep(0.9, 0.97, ny);
    c = mix(c, uNF > 0.0 ? parcels(p.xz) : mix(uCol[9], uCol[3], 0.4), open * (y < 160.0 ? 0.9 : 0.5));
    // where the map has no town, the venue's towns tint the ground
    float t = 0.0;
    for (int i = 0; i < 8; i++) if (uTowns[i].z > 0.0) t = max(t, 1.0 - length(vec2((p.x - uTowns[i].x) / 1.1, p.z - uTowns[i].y)) / uTowns[i].z);
    c = mix(c, uCol[6], clamp(t, 0.0, 1.0) * 0.7 * smoothstep(0.9, 0.97, ny));
  }
  c = mix(c, uCol[3], max(steep * 0.55, high * 0.5) * (0.6 + 0.4 * n) * wild);
  // bare rock on the crags, in layers (the strata, a little wavy) where it's steep
  float strata = 0.86 + 0.14 * smoothstep(0.35, 0.65, fract(y / 6.5 + lnoise(p.xz / 55.0) * 1.5));
  c = mix(c, (n > 0.5 ? uCol[4] : uCol[5]) * mix(1.0, strata, steep), max(smoothstep(0.5, 0.75, 1.0 - ny), high * 0.7) * (0.55 + 0.45 * lnoise(p.xz / 40.0)) * (wild > 0.0 ? max(wild, 0.5) : 0.0));
  // the roads round the race area: asphalt, paler in town
  vec2 rg = (p.xz - uNearXf.xy) * uNearXf.z;
  if (rg.x > 0.0 && rg.y > 0.0 && rg.x < 1.0 && rg.y < 1.0) c = mix(c, cls == 6 ? vec3(0.36, 0.36, 0.35) : vec3(0.27, 0.28, 0.28), smoothstep(0.35, 0.75, texture2D(uRoads, rg).r) * 0.9);
  // the shore: a narrow band of the beach's sand, the mud, or rock, down into the water
  c = mix(c, cls == 8 ? uCol[8] : cls == 12 ? c : uCol[7], 0.85 * (1.0 - smoothstep(1.3, 2.3, y)));
  return c;
}
`;

const FAR_GLSL = /* glsl */ `
// The land beyond the terrain, as the venue's own land mostly is (uShare: wooded, open, built): the flat low land
// fields and towns, with woods on the slopes and the higher ground; scrub and rock higher still, and snow on the tops
// above the venue's snow line.
varying float vFarZ;
vec3 farColour() {
  if (abs(vLand.x) < uNear && abs(vLand.z) < uNear && vFarZ < 8850.0) discard; // the terrain is drawn there
  if (vLand.y < 0.0) discard; // the sea, past the terrain: the sky's haze
  vec2 q = vLand.xz;
  float y = vLand.y, ny = normalize(vLN).y, n = lnoise(q / 900.0) * 0.6 + lnoise(q / 260.0) * 0.4, m = lnoise(q / 1500.0 + 4.0);
  vec3 c = mix(mix(uCol[0], uCol[1], n), uCol[3], smoothstep(uTreeTop * 0.4, uTreeTop * 1.2, y) * 0.75 + 0.15 * n);
  float flat_ = smoothstep(0.96, 0.99, ny) * (1.0 - smoothstep(120.0, 400.0, y));
  vec3 open = uNF > 0.0 ? parcels(q * 0.6) : uCol[9];
  c = mix(c, open, flat_ * (1.0 - smoothstep(0.2, 0.6, m * (1.0 - uShare.y) + 0.25)));
  c = mix(c, uCol[6] * (0.85 + 0.3 * lnoise(q / 120.0)), flat_ * step(1.0 - uShare.z * 3.0, lnoise(q / 700.0 + 9.0)) * (1.0 - smoothstep(30.0, 120.0, y)));
  c = mix(c, mix(uCol[4], uCol[5], n), max(smoothstep(uTreeTop * 1.0, uTreeTop * 1.8, y + (n - 0.5) * 200.0), smoothstep(0.4, 0.7, 1.0 - ny)) * 0.85);
  return mix(c, vec3(0.9, 0.93, 0.97), smoothstep(uSnow - 120.0, uSnow + 120.0, y + (n - 0.5) * 400.0) * smoothstep(0.2, 0.45, ny));
}
`;

// ---------- the hills ----------
// a lake's still water: the sky it mirrors (more of it the flatter it's seen) and the sun's glint, little of its own
const LAKE_LIGHT = /* glsl */ `
if (gLake > 0.5) {
  vec3 vd = normalize(vHz), rd = reflect(vd, vec3(0.0, 1.0, 0.0));
  float fr = 0.04 + 0.96 * pow(1.0 - max(-vd.y, 0.0), 5.0);
  totalEmissiveRadiance += mix(uLake * 0.6, skyBase(rd), fr) + uSunCol * pow(max(dot(rd, uSun), 0.0), 300.0) * 3.0;
  diffuseColor.rgb *= 0.12;
}`;
// in 64 tiles of some 2 km (the quadtree's squares three levels down), so the ones out of view aren't drawn; they
// share the corners and their normals
function terrain() {
  const all = new THREE.BufferGeometry(), pos = new THREE.BufferAttribute(MESH.pos, 3);
  all.setAttribute('position', pos); all.setIndex(new THREE.BufferAttribute(MESH.idx, 1)); all.computeVertexNormals();
  const nrm = all.attributes.normal, { L, I, J, D } = TREE, tiles = new Map();
  for (let k = 0; k < L.length; k++) {
    if (!D[k]) continue;
    const sh = Math.max(0, L[k] - 3), key = (I[k] >> sh) * 8 + (J[k] >> sh);
    if (!tiles.has(key)) tiles.set(key, []);
    const list = tiles.get(key), t0 = MESH.tri0[k];
    for (let t = t0; t < t0 + MESH.triN[k]; t++) list.push(MESH.idx[t * 3], MESH.idx[t * 3 + 1], MESH.idx[t * 3 + 2]);
  }
  const mat = landMat(new THREE.MeshLambertMaterial(), 1, { key: 'ground', colour: 'groundColour()', uniforms: GROUND_U, fsHead: GROUND_GLSL, vsHead: 'varying vec3 vLN;', vs: 'vLN = objectNormal;', emis: LAKE_LIGHT });
  const group = new THREE.Group(), box = new THREE.Box3(), v = new THREE.Vector3();
  for (const list of tiles.values()) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', pos); g.setAttribute('normal', nrm); g.setIndex(list);
    box.makeEmpty(); for (const i of list) box.expandByPoint(v.fromBufferAttribute(pos, i));
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); g.boundingBox = box.clone();
    group.add(new THREE.Mesh(g, mat));
  }
  return group;
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
  const idx = cells(1), coarse = cells(2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // the normals of both grids: a corner of the coarse one where the fine one has only sea round it has none of the
  // fine one's, and a normal of nothing turns the light on it to NaN (black, on the lower graphics levels)
  g.setIndex(coarse); g.computeVertexNormals(); const nc = g.attributes.normal.array.slice();
  g.setIndex(idx); g.computeVertexNormals(); const nf = g.attributes.normal.array;
  for (let i = 0; i < nf.length; i += 3) if (!nf[i] && !nf[i + 1] && !nf[i + 2]) nf.set(nc.subarray(i, i + 3), i);
  const m = new THREE.Mesh(g, landMat(new THREE.MeshLambertMaterial({ depthTest: false, depthWrite: false }), 1, {
    key: 'far', colour: 'farColour()', unlit: true, uniforms: GROUND_U, fsHead: GROUND_GLSL + FAR_GLSL, project: FAR_PROJECT,
    vsHead: 'varying vec3 vLN; varying float vFarZ;', vs: 'vLN = objectNormal; vFarZ = -(viewMatrix * lwp).z;',
  }));
  m.frustumCulled = false; m.renderOrder = -1; m.userData.full = idx; m.userData.coarse = coarse;
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
const TREE_P = { forest: 1, scrub: 0.3, grass: 0.05, farmland: 0.025, orchard: 0.5, town: 0.08, industry: 0.01, sand: 0.015, rock: 0.02, wetland: 0.15, water: 0, mud: 0 };
const TREE_K = META.classes.map((c) => TREE_P[c] ?? -1);
// They are in 1.5 km tiles, one instanced mesh each, so a tile behind the camera isn't drawn at all; each tile's
// instances are in no order, so the lower graphics levels draw the first part of every tile.
const TILE = 1500;
function pines(count, far = false) {
  const r = rng(far ? 93 : 91), o = new THREE.Object3D(), c = new THREE.Color(), tiles = new Map();
  const kinds = LOOK.trees.map(([kind, share, dark, light]) => ({ kind, share, dark: C(dark), light: C(light) }));
  const lone = FIELDS.length ? 0.05 : 0, shrub = kinds.find((k) => k.kind === 'shrub');
  const palm = kinds.find((k) => k.kind === 'palm');
  const farKind = { kind: 'far', dark: C(GR.forest[0]), light: C(GR.forest[1]) };
  // a wood the map says is needle-leaved or broad-leaved gets the venue's trees of that sort (or a plain one of it)
  const NEEDLE = new Set(['pine', 'stone', 'conifer', 'cypress']);
  const sorts = [null, kinds.filter((k) => NEEDLE.has(k.kind)), kinds.filter((k) => !NEEDLE.has(k.kind) && k.kind !== 'shrub' && k.kind !== 'palm')];
  if (!sorts[1].length) sorts[1] = [{ kind: 'conifer', share: 1, dark: C(GR.forest[0]), light: C(GR.forest[1]) }];
  if (!sorts[2].length) sorts[2] = [{ kind: 'broad', share: 1, dark: C(GR.forest[0]), light: C(GR.forest[2]) }];
  const pickFrom = (list) => { let pick = r() * list.reduce((a, k) => a + k.share, 0), k = list[0]; for (const q of list) { k = q; if ((pick -= q.share) <= 0) break; } return k; };
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
    else if (cl === CLS.forest && (coverCell(x, z) >> 4) === 1) k = pickFrom(sorts[1]);
    else if (cl === CLS.forest && (coverCell(x, z) >> 4) === 2) k = pickFrom(sorts[2]);
    else k = pickFrom(kinds);
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
    // and the same trees as plain crowns, a few triangles each, drawn instead when the tile is far off (update())
    if (!far && k.kind !== 'far') {
      const lod = new THREE.InstancedMesh(geos.far || (geos.far = treeGeo('far')), mat, list.length);
      list.forEach(([mx, col], i) => { lod.setMatrixAt(i, mx); lod.setColorAt(i, col); });
      lod.boundingSphere = m.boundingSphere; lod.visible = false; lod.userData.max = list.length;
      m.userData.lod = lod; g.add(lod);
    }
  }
  return g;
}

// ---------- the town ----------
// the mapped buildings as they are on the map, and the many houses the map lacks round them: white or cream walls,
// mostly terracotta roofs
const WALLS = LOOK.walls, ROOFS = LOOK.roofs, FLAT = LOOK.flat ?? 0.45;
// the tall ones (20 m and up): concrete, stone and glass, flat on top; or the venue's own, where they are blocks of
// flats in the town's colours
const TOWERS = LOOK.towers || ['#9aa6b0', '#b8c0c6', '#7f8c96', '#d4d6d2', '#c9c2b4', '#6f7d88'];
const TALL = LOOK.tall || 20; // from how high a building is a tower (where the old town's palaces stand 20 to 30 m, higher)
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
// the piers, pontoons, quays and breakwaters: from the .bin (or, in a file baked before they moved there, the json)
const PIERS = META.piers || (() => {
  const out = [];
  for (let k = 0, o = 0; k < P.pn.length; k++) {
    const pts = []; for (let i = 0; i < P.pn[k]; i++, o += 2) pts.push([P.pxz[o] / 2, P.pxz[o + 1] / 2]);
    out.push({ kind: META.pierKinds[P.pk[k] & 7], area: !!(P.pk[k] & 8), floating: !!(P.pk[k] & 16), w: P.pw[k] / 10, pts });
  }
  return out;
})();
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
// in 1.5 km tiles, so the ones out of view aren't drawn; the walls with rows of windows (TOWN_GLSL)
const TOWN_GLSL = /* glsl */ `
varying vec3 vLN; varying float vBK;
void windows(inout vec4 dc) {
  vec3 nn = normalize(vLN);
  if (abs(nn.y) > 0.3) return;
  float kind = floor(vBK), seed = fract(vBK);
  if (kind > 2.5) return; // a rampart: bare stone
  vec2 tg = normalize(vec2(-nn.z, nn.x) + 1e-5);
  float s = dot(vLand.xz, tg) + seed * 17.0, far_ = smoothstep(150.0, 450.0, length(vHz));
  if (kind > 0.5 && kind < 1.5) { // a tower: glass between thin mullions, floor after floor, tinted
    float u = fract(s / 1.6), w = fract(vLand.y / 3.6), glass = step(0.12, u) * step(0.18, w);
    dc.rgb = mix(dc.rgb, mix(dc.rgb * 0.5 + vec3(0.03, 0.05, 0.07), dc.rgb * 0.8, far_), glass * 0.85);
    return;
  }
  if (kind > 1.5) { // a church, a mosque: a few tall windows
    float u = fract(s / 4.5), w = fract(vLand.y / 9.0), win = step(0.42, u) * step(u, 0.58) * step(0.3, w) * step(w, 0.8);
    dc.rgb *= mix(mix(1.0, 0.5, win), 0.94, far_);
    return;
  }
  float sp = 2.4 + seed * 1.2, fl = 2.9 + seed * 0.5, ww = 0.22 + seed * 0.14;
  float u = fract(s / sp), w = fract(vLand.y / fl);
  float win = step(0.5 - ww, u) * step(u, 0.5 + ww) * step(0.4, w) * step(w, 0.78);
  dc.rgb *= mix(mix(1.0, 0.6, win), 0.92, far_);
}`;
// the kind of building each vertex is part of, for its windows (TOWN_GLSL): 0 a house or a block, 1 a tower, 2 a church
// or a mosque, 3 a rampart (none); its fraction, a number of its own, for its windows' spacing
function kinded(g, k) {
  g = strip(g);
  g.setAttribute('bk', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1));
  return g;
}
const hullArea = (r) => { // the area of a footprint's convex hull
  const pts = r.map(([x, z]) => [x, z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)); let a = 0;
  for (let i = 0; i < h.length; i++) { const [x0, z0] = h[i], [x1, z1] = h[(i + 1) % h.length]; a += x0 * z1 - x1 * z0; }
  return Math.abs(a) / 2;
};
// a roof up to a point over a footprint's middle, H high, the eaves 0.3 m out
function pyramidRoof(r, y, H, col) {
  let cx = 0, cz = 0; for (const [x, z] of r) { cx += x; cz += z; } cx /= r.length; cz /= r.length;
  const out = ([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + (dx / l) * 0.3, y, z + (dz / l) * 0.3]; };
  const pos = [], top = [cx, y + H, cz];
  for (let i = 0; i < r.length; i++) {
    const a = out(r[i]), b = out(r[(i + 1) % r.length]), ny = (b[2] - a[2]) * (top[0] - a[0]) - (b[0] - a[0]) * (top[2] - a[2]);
    pos.push(...(ny > 0 ? [a, b, top] : [a, top, b]).flat());
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return tint(g, col);
}
// a church: stone, a steep roof on its rectangle and a bell tower with its spire at one end; a mosque: pale stone,
// a dome on a drum and a minaret at a corner
function worship(b, g, yb, h, area, mosque, seed) {
  const R = rect(b.r), out = [], stone = mosque ? '#e6dfcf' : '#d3c8b2', roof = mosque ? '#8a9298' : '#6e5a4e';
  out.push(kinded(paint(g, stone, stone), 2 + seed));
  if (!R) return out;
  const top = yb + h;
  if (mosque) {
    const rr = Math.min(R.b, R.a) * 0.7;
    out.push(kinded(tint(new THREE.CylinderGeometry(rr, rr, rr * 0.5, 16).translate(R.cx, top + rr * 0.25, R.cz), stone), 2 + seed));
    out.push(kinded(tint(new THREE.SphereGeometry(rr, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(R.cx, top + rr * 0.5, R.cz), roof), 2 + seed));
    const mx = R.cx + R.ux * (R.a + 3) + R.uz * (R.b + 1), mz = R.cz + R.uz * (R.a + 3) - R.ux * (R.b + 1), mh = h * 2.6 + 8;
    out.push(kinded(tint(new THREE.CylinderGeometry(1.3, 1.6, mh, 10).translate(mx, yb + mh / 2 - 1, mz), stone), 2 + seed), kinded(tint(new THREE.ConeGeometry(1.5, mh * 0.16, 10).translate(mx, yb + mh * 1.06, mz), roof), 2 + seed));
  } else {
    out.push(kinded(hipRoof({ ...R, b: R.b * 1.9 }, top, roof), 2 + seed));
    const tw = Math.min(6, R.b * 0.9), th = h * 2.1 + 8, tx = R.cx + R.ux * (R.a - tw / 2), tz = R.cz + R.uz * (R.a - tw / 2);
    out.push(kinded(tint(new THREE.BoxGeometry(tw, th, tw).rotateY(-Math.atan2(R.uz, R.ux)).translate(tx, yb + th / 2 - 1, tz), stone), 2 + seed));
    out.push(kinded(tint(new THREE.ConeGeometry(tw * 0.75, th * 0.55, 4).rotateY(Math.PI / 4 - Math.atan2(R.uz, R.ux)).translate(tx, yb + th - 1 + th * 0.275, tz), roof), 2 + seed));
  }
  return out;
}
function town() {
  const r = rng(17), taken = new Set(), key = (x, z) => `${Math.round(x / 9)},${Math.round(z / 9)}`;
  const tiles = new Map(), tile = (x, z) => { const k = Math.floor(x / TILE) + ',' + Math.floor(z / TILE); if (!tiles.has(k)) tiles.set(k, { parts: [], houses: new Batch() }); return tiles.get(k); };
  let parts = null;
  const mark = (x, z, rad) => { for (let dx = -rad; dx <= rad; dx += 9) for (let dz = -rad; dz <= rad; dz += 9) taken.add(key(x + dx, z + dz)); };
  for (const b of buildings()) {
    let cx = 0, cz = 0; for (const [x, z] of b.r) { cx += x; cz += z; } cx /= b.r.length; cz /= b.r.length;
    parts = tile(cx, cz).parts;
    const sh = new THREE.Shape(b.r.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))));
    let area = 0; for (let i = 0; i < b.r.length; i++) { const [x0, z0] = b.r[i], [x1, z1] = b.r[(i + 1) % b.r.length]; area += x0 * z1 - x1 * z0; }
    area = Math.abs(area) / 2;
    const h = b.h || (area > 500 ? 8 : area > 150 ? 6.5 : 4.5 + r() * 2.5);
    let y0 = Infinity; for (const [x, z] of b.r) y0 = Math.min(y0, groundAt(x, z));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h + 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(cx, Math.max(0.6, y0) - 1.5, cz);
    const yb = Math.max(0.6, y0), seed = r() * 0.98;
    mark(cx, cz, Math.sqrt(area) / 2 + 4);
    if (b.roof === 3 || b.roof === 4) { parts.push(...worship(b, g, yb, h, area, b.roof === 4, seed)); continue; }
    if (b.roof === 5) { parts.push(kinded(paint(g, '#b3a497', '#7c8a5e'), 3)); continue; } // a fortress's ramparts: granite, no windows, grass on top
    if (h >= TALL) { parts.push(kinded(paint(g, TOWERS[Math.floor(r() * TOWERS.length)], '#8a8e90'), 1 + seed)); continue; }
    const wall = WALLS[Math.floor(r() * WALLS.length)], roof = ROOFS[Math.floor(r() * ROOFS.length)];
    // a pitched roof where the map says so, or on a house-sized one most of the venue's are pitched on: hipped on the
    // footprint's rectangle, where it fills most of it; else up to a point over the footprint, where it's near enough
    // convex; else flat
    const pitched = b.roof !== 1 && h < 16 && area < 900 && (b.roof === 2 || r() >= FLAT);
    const R = pitched ? rect(b.r) : null;
    if (R && area > R.area * 0.78) parts.push(kinded(paint(g, wall, roof), seed), kinded(hipRoof(R, yb + h, roof), seed));
    else if (pitched && b.r.length <= 12 && area < 600 && area > hullArea(b.r) * 0.92) parts.push(kinded(paint(g, wall, roof), seed), kinded(pyramidRoof(b.r, yb + h, Math.min(4, 0.28 * Math.sqrt(area)), roof), seed));
    else parts.push(kinded(paint(g, wall, pitched || r() >= FLAT ? roof : '#ddd6c8'), seed));
  }
  // the houses the map hasn't got: thick where the map has a town (or the venue lists one), scattered as villas up
  // the slopes round the bay
  const box = strip(paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), '#fff')), roof = strip(paint(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), '#fff'));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), Pv = new THREE.Vector3(), S = new THREE.Vector3();
  const VILLA = new Set([CLS.unknown, CLS.grass, CLS.scrub, CLS.town]);
  let n = 0;
  const most = LOOK.fill === 0 ? 0 : Math.min(2600, 900 * TOWNS.reduce((a, t) => a + (t.r / 650) ** 2, 0) ** 0.5 + 600);
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
    const houses = tile(x, z).houses;
    const hs = r() * 0.98;
    houses.add(box, m4.compose(Pv.set(x, y - 1.2, z), q, S.set(w, h + 1.2, d)), C(WALLS[Math.floor(r() * WALLS.length)]), hs);
    if (r() >= FLAT * 0.45) houses.add(roof, m4.compose(Pv.set(x, y + h, z), q, S.set(w * 1.08, 1.6 + r() * 0.6, d * 1.08)), C(ROOFS[Math.floor(r() * ROOFS.length)]), hs);
    mark(x, z, Math.max(w, d) / 2 + 3); n++;
  }
  const mat = landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 1, { key: 'town', fsHead: TOWN_GLSL, vsHead: 'varying vec3 vLN; attribute float bk; varying float vBK;', vs: 'vLN = objectNormal; vBK = bk;', after: 'windows(diffuseColor);' });
  const group = new THREE.Group();
  for (const t of tiles.values()) {
    const geos = t.parts.slice(); if (t.houses.p.length) geos.push(t.houses.geometry());
    if (!geos.length) continue;
    const g = mergeGeometries(geos); g.computeBoundingSphere();
    group.add(new THREE.Mesh(g, mat));
  }
  return group;
}
// many copies of small shapes, each placed by a matrix and given one colour, written into one geometry
class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.k = []; this.nm = new THREE.Matrix3(); this.v = new THREE.Vector3(); }
  add(geo, m, col, k = 0) {
    const Pa = geo.attributes.position.array, N = geo.attributes.normal.array, v = this.v;
    this.nm.getNormalMatrix(m);
    for (let i = 0; i < Pa.length; i += 3) {
      v.set(Pa[i], Pa[i + 1], Pa[i + 2]).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(this.nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.c.push(col.r, col.g, col.b); this.k.push(k);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('bk', new THREE.Float32BufferAttribute(this.k, 1));
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
  for (const p of PIERS) for (let i = 0; i + 1 < p.pts.length; i++) segs.push({ a: p.pts[i], b: p.pts[i + 1], p });
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
// Tower, Laboe's naval memorial, Galata), a lighthouse, a mosque (Istanbul's), a gilded spire (St Petersburg's), a rostral
// column, a drawbridge with its spans raised. Each in one colour a part, merged into one mesh.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), XA = V3(1, 0, 0);
// a beam from a to b, w wide and h deep
function beam(a, b, w, h, col) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(XA, d.normalize()), V3(len + Math.min(w, h) * 0.5, h, w));
  return tint(new THREE.BoxGeometry(1, 1, 1).applyMatrix4(m), col);
}
const post = (x, z, y0, r0, r1, h, col, n = 12) => tint(new THREE.CylinderGeometry(r1, r0, h, n).translate(x, y0 + h / 2, z), col);
// a block w along `ang` (radians from +x towards +z), d across it, from y0 up h
const blk = (x, z, y0, h, w, d, ang, col) => tint(new THREE.BoxGeometry(w, h, d).rotateY(-ang).translate(x, y0 + h / 2, z), col);
const GOLD = '#d6a43a';
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
      } else if (L.style === 'galata') { // Galata's round stone tower over the Golden Horn: the gallery, the lead cone
        const stone = '#b9ad96';
        parts.push(post(x, z, y - 2, 8.6, 8, L.h * 0.74 + 2, stone, 16), post(x, z, y + L.h * 0.7, 9.6, 9.6, 2, '#a89c86', 16), post(x, z, y + L.h * 0.74, 7.8, 7.8, L.h * 0.06, stone, 16));
        parts.push(tint(new THREE.ConeGeometry(8.6, L.h * 0.2, 16).translate(x, y + L.h * 0.9, z), '#6f777c'));
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
    } else if (L.kind === 'spire') {
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z));
      if (L.style === 'peter-paul') {
        // the Peter and Paul Cathedral: the belfry at its west end, three tiers of ochre and white, the gilded lantern
        // and the needle with its angel; the nave beyond it to the east, the green dome over the apse
        const [bx, bz] = L.b, len = Math.hypot(bx - x, bz - z), ux = (bx - x) / len, uz = (bz - z) / len, ang = Math.atan2(uz, ux);
        const ochre = '#e6cf98', white = '#efe9dc', roof = '#7d8c86', at = (u) => [x + ux * u, z + uz * u];
        const [nx, nz] = at(38), [ax, az] = at(60);
        parts.push(blk(nx, nz, y - 1, 23, 58, 30, ang, ochre), blk(nx, nz, y + 22, 3, 58, 26, ang, roof), blk(nx, nz, y + 24.5, 2, 56, 14, ang, roof));
        parts.push(post(ax, az, y + 22, 6, 6, 8, ochre, 12), tint(new THREE.SphereGeometry(6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(ax, y + 30, az), '#5f7a6c'), post(ax, az, y + 35.5, 1.6, 0.3, 9, GOLD, 8));
        parts.push(blk(x, z, y - 1, 33, 19, 19, ang, ochre), blk(x, z, y + 30, 2.5, 20, 20, ang, white), blk(x, z, y + 32, 13, 15, 15, ang, ochre), blk(x, z, y + 44, 2, 16, 16, ang, white));
        parts.push(blk(x, z, y + 46, 11, 11, 11, ang, ochre), post(x, z, y + 57, 5.6, 5.2, 8, white, 8), post(x, z, y + 65, 4.4, 2.6, 15, GOLD, 8));
        parts.push(tint(new THREE.ConeGeometry(2.4, L.h - 84, 8).translate(x, y + 80 + (L.h - 84) / 2, z), GOLD), post(x, z, y + L.h - 4.5, 0.25, 0.25, 4.5, GOLD, 6), blk(x, z, y + L.h - 2.5, 0.5, 3.2, 0.5, ang + Math.PI / 2, GOLD));
      } else {
        // the Admiralty's tower over its arch: the ochre cube, the white colonnade, the gilded dome, lantern and needle
        const ochre = '#e8c46e', white = '#efe9dc';
        parts.push(blk(x, z, y - 1, 31, 24, 24, 0, ochre), blk(x, z, y + 30, 10, 18, 18, 0, white), blk(x, z, y + 40, 4, 14, 14, 0, ochre));
        parts.push(tint(new THREE.SphereGeometry(6.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 44, z), GOLD), post(x, z, y + 49, 2.6, 2.2, 5, GOLD, 8));
        parts.push(tint(new THREE.ConeGeometry(1.8, L.h - 54, 8).translate(x, y + 54 + (L.h - 54) / 2, z), GOLD));
      }
    } else if (L.kind === 'column') {
      // a rostral column: the granite plinth, the brick-red shaft with the ships' bronze prows, the bowls at the top
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), red = '#8a3c2e', bronze = '#6d5a36';
      parts.push(blk(x, z, y - 1, 7, 11, 11, 0, '#9d948a'), post(x, z, y + 6, 2.7, 2.2, L.h - 12, red, 12), post(x, z, y + L.h - 6, 3.4, 3.4, 1.4, '#a49a8c', 12), post(x, z, y + L.h - 4.6, 1.4, 2.4, 4.6, bronze, 10));
      for (let k = 0; k < 8; k++) { const a = (k % 4) * Math.PI / 2 + (k > 3 ? Math.PI / 4 : 0); parts.push(blk(x + Math.cos(a) * 3, z + Math.sin(a) * 3, y + 9 + Math.floor(k / 2) * 4.2, 1.2, 3.4, 1.4, a, bronze)); }
    } else if (L.kind === 'drawbridge') {
      // a bridge on granite piers, n spans of steel arches under the deck; the spans in `open` raised for the yachts,
      // on one leaf hinged at its far pier or two leaves hinged at both
      const [ax, az] = L.a, [bx, bz] = L.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, ang = Math.atan2(uz, ux);
      const D = L.deck, W = L.w, steel = L.color || '#5a6863', stone = '#9a9088', n = L.n, S = len / n;
      const P = (u, yy, v = 0) => V3(ax + ux * u - uz * v, yy, az + uz * u + ux * v);
      for (let i = 1; i < n; i++) { const p = P(i * S, 0); parts.push(blk(p.x, p.z, -3, D + 2, 9, W + 5, ang, stone)); }
      for (let i = 0; i < n; i++) {
        const u0 = i * S + 4.5, u1 = (i + 1) * S - 4.5;
        if ((L.open || []).includes(i)) {
          const up = 74 * Math.PI / 180, leaf = (u1 - u0) / (L.leaves === 2 ? 2 : 1);
          for (const [h0, sd] of L.leaves === 2 ? [[u0, 1], [u1, -1]] : [[u1, -1]]) {
            parts.push(beam(P(h0, D), P(h0 + sd * leaf * Math.cos(up), D + leaf * Math.sin(up)), W - 2, 2.2, steel));
            parts.push(beam(P(h0 - sd * 3, D - 4), P(h0 - sd * 3, D + 3), W - 2, 7, steel)); // the counterweight's housing
          }
          continue;
        }
        parts.push(beam(P(u0 - 4.5, D), P(u1 + 4.5, D), W, 1.6, '#4b4f50'));
        for (const sd of [-1, 1]) parts.push(beam(P(u0 - 4.5, D + 1.4, sd * (W / 2 - 0.3)), P(u1 + 4.5, D + 1.4, sd * (W / 2 - 0.3)), 0.4, 1.2, steel)); // the railings
        const rib = (t) => 1.5 + (D - 2.8) * (1 - (2 * t - 1) ** 2), N = 8;
        for (const v of [-W * 0.35, 0, W * 0.35]) for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N;
          parts.push(beam(P(u0 + (u1 - u0) * t0, rib(t0), v), P(u0 + (u1 - u0) * t1, rib(t1), v), 1.2, 1.4, steel));
        }
      }
    } else if (L.kind === 'mosque') {
      // Istanbul's imperial mosques on their hills: the square prayer hall, the great dome on its drum (its top L.h up),
      // the half-domes and the corner domes stepping down from it, the pencil minarets with their balconies and lead
      // cones (L.minarets of them, L.mh high: four at the hall's corners, the Blue Mosque's other two at its courtyard's)
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), stone = L.wall || '#d4cdbf', lead = '#8a9298', H = L.h;
      const r = H * 0.27, w = r * 5, hb = H * 0.42, yd = H - r;
      const dome = (dx, dz, y0, rr) => parts.push(tint(new THREE.SphereGeometry(rr, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x + dx, y0, z + dz), lead));
      parts.push(tint(new THREE.BoxGeometry(w, hb + 2, w).translate(x, y + hb / 2 - 1, z), stone), post(x, z, y + hb, r * 1.08, r * 1.02, yd - hb, stone, 16));
      dome(0, 0, y + yd, r);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]].slice(0, L.semis || 4)) dome(dx * r, dz * r, y + hb, r * 0.8);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const dx = sx * w * 0.34, dz = sz * w * 0.34; parts.push(post(x + dx, z + dz, y + hb, r * 0.34, r * 0.32, r * 0.25, stone, 10)); dome(dx, dz, y + hb + r * 0.25, r * 0.32); }
      const at = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * (w / 2 + 3), b * (w / 2 + 3)]);
      if (L.minarets > 4) { at.push([-(w / 2 + 3), w * 1.5 + 3], [w / 2 + 3, w * 1.5 + 3]); parts.push(tint(new THREE.BoxGeometry(w, 9, w).translate(x, y + 3.5, z + w), stone)); }
      for (const [dx, dz] of at.slice(0, L.minarets)) {
        const mx = x + dx, mz = z + dz, mh = L.mh;
        parts.push(post(mx, mz, y - 2, 2.5, 1.9, mh * 0.86 + 2, stone, 10));
        for (const f of L.minarets > 4 ? [0.46, 0.6, 0.74] : [0.55, 0.72]) parts.push(post(mx, mz, y + mh * f, 3.2, 3.2, 1.3, stone, 10));
        parts.push(tint(new THREE.ConeGeometry(2.1, mh * 0.14, 10).translate(mx, y + mh * 0.93, mz), lead));
      }
    }
  }
  if (!parts.length) return null;
  // less haze on them than on the hills: they are what the venue is known by, seen from the course 4 or 5 km off
  return new THREE.Mesh(mergeGeometries(parts.map(strip)), landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.3));
}

// ---------- the land's shadows on everything else ----------
// The yachts, the marks and the committee boat: their lit materials dimmed where the land's shadow falls (shadows()),
// as the land and the sea are, so a boat sailing under a cliff at sunset goes into its shade.
export function inLandShadow(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.userData.landShade || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      m.userData.landShade = true;
      const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        Object.assign(sh.uniforms, { uShadeTex: LAND_U.uShadeTex, uShadeXf: LAND_U.uShadeXf, uLandShadeAt: LAND_U.uAt });
        sh.vertexShader = 'uniform vec3 uLandShadeAt; varying vec2 vSunXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          { vec4 sw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
          #endif
            sw = modelMatrix * sw; vSunXZ = sw.xz + uLandShadeAt.xz; }`);
        sh.fragmentShader = 'uniform sampler2D uShadeTex; uniform vec3 uShadeXf; varying vec2 vSunXZ;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec2 g = (vSunXZ - uShadeXf.xy) * uShadeXf.z; float sun = g.x > 0.0 && g.y > 0.0 && g.x < 1.0 && g.y < 1.0 ? texture2D(uShadeTex, g).r : 1.0;
            reflectedLight.directDiffuse *= sun; reflectedLight.directSpecular *= sun; }`);
      };
      m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|landshade'; };
      m.needsUpdate = true;
    }
  });
  return root;
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
    // what casts the shadows on the land (shadows()): the terrain, the buildings and the trees, not the land beyond
    for (const g of [this.land, this.town, this.trees]) g.traverse((o) => o.layers.enable(SHADOW_LAYER));
    // what the sea needs of the land: the depth (lighter over the shallows), the shadows, how far from the shore (the surf)
    const W = LOOK.water || {};
    this.waterU = {
      uSeabed: { value: gridTex(P.depth, GN, true) }, uShallow: { value: C(W.shallow || '#4aa79a') }, uShallowK: { value: W.clear ?? 0.45 },
      uLandAt: LAND_U.uAt, uGridXf: LAND_U.uGridXf, uShadeXf: LAND_U.uShadeXf, uShadeTex: LAND_U.uShadeTex,
      uShore: { value: gridTex(P.shore, NEAR.n, true) }, uCalm: { value: gridTex(P.calm, NEAR.n, true) }, uNearXf: GROUND_U.uNearXf,
    };
  }
  // the race's start at its place in the bay
  place(at) { this.group.position.set(-at.x, 0, -at.z); this.group.updateMatrixWorld(true); LAND_U.uAt.value.set(at.x, 0, at.z); }
  // the light of the race (light.js): the haze as thick as the sea's, the lakes' colour, the shadows from where the sun is
  setLight(L, renderer) {
    LAND_U.uHazeL.value = L.fogFar * 2.4 * (LOOK.haze ?? 1); // (how clear the venue's air is: venues.js)
    GROUND_U.uLake.value.copy(L.deep).lerp(L.horizon, 0.35);
    if (renderer) shadows(renderer, this.group, L.sunDir);
  }
  // each frame: the near trees' tiles far from the camera drawn as plain crowns
  update(cam) {
    const gp = this.group.position;
    for (const m of this.trees.children) {
      const lod = m.userData.lod; if (!lod) continue;
      const c = m.boundingSphere.center, near = Math.hypot(c.x + gp.x - cam.x, c.z + gp.z - cam.z) - m.boundingSphere.radius < 1200;
      m.visible = near; lod.visible = !near;
    }
  }
  // fewer trees for the lower graphics levels, and none of the far ones on the lowest; the land beyond coarser
  setQuality(q) {
    const f = q === 'high' ? 1 : q === 'medium' ? 0.45 : 0.25, ff = q === 'high' ? 1 : q === 'medium' ? 0.4 : 0;
    for (const m of this.trees.children) m.count = Math.round(m.userData.max * f);
    for (const m of this.farTrees.children) m.count = Math.round(m.userData.max * ff);
    this.far.geometry.setIndex(q === 'high' ? this.far.userData.full : this.far.userData.coarse);
  }
}
