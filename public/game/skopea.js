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
const TE = META.terrain.ext, TN_ = META.terrain.n;
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
// how far a point stands out from its slope, + on a ridge, − in a hollow (CONVEX_GLSL's convexity(), from the same
// open sky, here read from the bake's grid as the shader reads its texture)
function convexAt(x, z) {
  const A = P.ao, n = META.ao.n, fx = (x + TE) / META.ao.cell - 0.5, fz = (z + TE) / META.ao.cell - 0.5;
  const j = Math.max(0, Math.min(n - 2, Math.floor(fx))), i = Math.max(0, Math.min(n - 2, Math.floor(fz))), u = Math.min(Math.max(fx - j, 0), 1), v = Math.min(Math.max(fz - i, 0), 1);
  const sky = Math.min(((A[i * n + j] * (1 - u) + A[i * n + j + 1] * u) * (1 - v) + (A[(i + 1) * n + j] * (1 - u) + A[(i + 1) * n + j + 1] * u) * v) / 63, 1);
  const t = slopeAt(x, z);
  return sky - (1 - (t / Math.sqrt(1 + t * t) + 1.414 * t / Math.sqrt(1 + 0.5 * t * t)) / 8);
}
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
  // (the terrain with its woods as high as their canopy, so a wood's edge shades the field beside it; the rest as it is)
  const mats = []; group.traverse((o) => { if (o.material) { mats.push([o, o.material]); o.material = o.userData.heightMat || HEIGHT_MAT; } });
  tmp.add(group);
  HCAM.position.set(group.position.x, 10000, group.position.z); HCAM.lookAt(group.position.x, 0, group.position.z); HCAM.updateMatrixWorld();
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(HEIGHTS); renderer.clear(); renderer.render(tmp, HCAM);
  SHADE_MAT.uniforms.uSunD.value.copy(sun);
  renderer.setRenderTarget(SHADE); renderer.render(QSCENE, QCAM);
  renderer.setRenderTarget(was); renderer.setClearColor(clear, alpha);
  for (const [o, m] of mats) o.material = m;
  if (parent) parent.add(group);
}
// what every land material shares (the world sets the haze and the place; setLight the shadows)
const LAND_U = {
  uAt: { value: new THREE.Vector3() },
  uGridXf: { value: new THREE.Vector3(-TE, -TE, 1 / (GN * GC)) }, uShadeXf: { value: new THREE.Vector3(-TE, -TE, 1 / (2 * TE)) },
  uAO: { value: gridTex(P.ao, META.ao.n, true) }, uAOXf: { value: new THREE.Vector3(-TE, -TE, 1 / (META.ao.n * META.ao.cell)) }, uShadeTex: { value: SH_TEX },
  uHazeL: { value: 7700 }, uHazeCap: { value: 0.92 }, uMist: { value: 0 },
};
let SKY_U = {}; // the sky's uniforms (light.js), from the world
// The clouds' shadows: the sky's fair-weather cumulus (light.js cloudDen: the same noise, as thick as the sky's) as a
// layer 1500 m up, drifting as the sky's do, about 8 m a second, but fixed to the venue — the sky draws its clouds
// round the camera, and a shadow fixed to it would sail along with a fast boat. Where one is between a point and the
// sun, the sun's light there is dimmed: on the land, the sea (world.js) and the boats and marks (inLandShadow). The
// sky's noise, thickness and sun (uCs…) are the sky's own uniforms, handed over by the Skopea (its constructor); uCsT
// is the race's clock (update()).
export const CLOUD_U = { uCsT: { value: 0 }, uCsRipple: { value: null }, uCsCloud: { value: 0 }, uCsSun: { value: new THREE.Vector3(0, 1, 0) } };
export const CLOUD_GLSL = /* glsl */ `
uniform sampler2D uCsRipple; uniform float uCsT, uCsCloud; uniform vec3 uCsSun;
float cloudShade(vec3 p) { // p: in the venue's frame; 1 in the sun, 0.3 under the thickest cloud
  if (uCsSun.y < 0.03) return 1.0;
  vec2 q = (p.xz + uCsSun.xz * ((1500.0 - p.y) / uCsSun.y)) * 0.0002 + vec2(uCsT * 0.0016, uCsT * 0.0007);
  float n = texture2D(uCsRipple, q).w * 0.62 + texture2D(uCsRipple, q * 2.3 + 0.31).w * 0.28 + 0.05; // (the finest octave as its mean: a shadow is soft)
  return 1.0 - 0.7 * smoothstep(0.52 - uCsCloud, 0.74 - uCsCloud * 0.5, n);
}`;
// Each land material is three.js's own, with the venue's point (vLand) and the view's (vHz) handed on to the pixel:
// the light there is dimmed by the hills' shadow (the sun's) and by how much of the sky is hidden (the sky's), and
// its haze is the sea's own: the sky's colour at the horizon that way, thicker with the distance, so the far hills
// fade into it as the sea does and the mountains out to 64 km are a pale outline. k: how fast it thickens.
const LAND_FS = /* glsl */ `
uniform vec3 uGridXf, uShadeXf, uAOXf; uniform sampler2D uAO, uShadeTex; uniform float uHazeL, uHazeCap, uHazeK, uMist;
// how much air there is along a line of sight from a height a to a height b, against the same length at the sea: the
// haze thins upwards (exponentially, over H metres), so a hilltop is seen through less of it than the shore below it
float hazeAir(float a, float b, float H) { float d = b - a; return abs(d) < 1.0 ? exp(-a / H) : H * (exp(-a / H) - exp(-b / H)) / d; }
varying vec3 vLand; varying vec3 vHz;
${SKY_GLSL}
${CLOUD_GLSL}
float landSun(vec2 p) { vec2 g = (p - uShadeXf.xy) * uShadeXf.z; return g.x > 0.0 && g.y > 0.0 && g.x < 1.0 && g.y < 1.0 ? texture2D(uShadeTex, g).r : 1.0; }
// how much of the sky is open there, 0 to 1 (the bake's grid holds it in 64 steps: 63, all of it)
float landSky(vec2 p) { return min(texture2D(uAO, (p - uAOXf.xy) * uAOXf.z).r * (255.0 / 63.0), 1.0); }
`;
// How far a point stands out from the slope it is on: + on a ridge or a spur, − in a hollow or a gully. Its open sky
// (the bake's: 1 less the sine of how high the land stands, the average of eight ways) against a plain slope's as
// steep, which has its uphill way and the two beside it hidden that much. On Göcek's hills a quarter of the ground is
// above −0.025 and a quarter below −0.115 (the mountains round the bay hide a little sky from everything).
const CONVEX_GLSL = /* glsl */ `
float convexity(float sky, float ny) {
  float t = sqrt(max(1.0 - ny * ny, 0.0)) / max(ny, 0.05);
  return sky - (1.0 - (t / sqrt(1.0 + t * t) + 1.414 * t / sqrt(1.0 + 0.5 * t * t)) / 8.0);
}
// the woods thin out over the ridges and the spurs, where the soil is thin and dry: crowns apart, scrub and rock
// between them, and in the end single trees over the rock
float ridgeThin(float sky, float ny) { return smoothstep(-0.04, 0.06, convexity(sky, ny)); }`;
function landMat(m, k = 1, o = {}) {
  m.fog = false;
  const hk = { value: k };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LAND_U, SKY_U, CLOUD_U, { uHazeK: hk }, o.uniforms || {});
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
    if (o.nrm) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + o.nrm);
    if (!o.unlit) fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float sun = landSun(vLand.xz) * cloudShade(vLand)${o.sun ? ' * ' + o.sun : ''}, sky = landSky(vLand.xz);
        // (the open ground as bright as the land's colours were set by, when the grid was read as a quarter of
        // itself; the valleys, the gullies and the hollows as much darker as the sky they miss)
        reflectedLight.directDiffuse *= sun; reflectedLight.directSpecular *= sun; reflectedLight.indirectDiffuse *= 0.475 * (0.3 + 0.7 * sky); }`);
    sh.fragmentShader = fs.replace('#include <tonemapping_fragment>', `{
        // (as thick as the sea's at the sea, thinner up the hills: over 700 m, or 140 m in a morning's mist (uMist,
        // light.js), when the hills rise out of it; a quarter of it is high and thin, all the way up)
        float air = 0.25 + 0.75 * hazeAir(max(cameraPosition.y, 0.0), max(vLand.y, 0.0), mix(700.0, 140.0, uMist));
        float hf = uHazeCap * (1.0 - exp(-length(vHz) * uHazeK / uHazeL * air));
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
  uCanopy: { value: 1 }, // the canopy's crowns drawn one by one (0 on the lowest graphics level: only their average)
  uClear: { value: { scrub: 0, grass: 1, rock: 2 }[LOOK.clearing] ?? 0 }, // what the clearings are (venues.js look.clearing)
  uCoast: { value: LOOK.coast === 'rock' || LOOK.clearing === 'rock' ? 1 : 0 }, // a rocky coast (venues.js look.coast)
  uLiftMask: { value: null }, uLiftOn: { value: 1 }, // the canopy's height (LIFT_VS): where the houses keep it off, and whether it's drawn
  // how far from the shore (land.js roomAt: + at sea, − ashore, in steps of 4 m, on its 20 m grid round the race area)
  uRoom: { value: (() => {
    const R = SKOPEA.room, a = new Uint8Array(R.length); for (let k = 0; k < R.length; k++) a[k] = R[k] + 128;
    const t = new THREE.DataTexture(a, META.room.nx, META.room.nz, THREE.RedFormat, THREE.UnsignedByteType);
    t.unpackAlignment = 1; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  })() },
  uRoomXf: { value: new THREE.Vector4(META.room.x0, META.room.z0, 1 / META.room.cell, 0) }, uRoomN: { value: new THREE.Vector2(META.room.nx, META.room.nz) },
};
// shoreDist() (GROUND_GLSL and LIFT_VS): metres from the shore there, + at sea and − ashore; 999 off the grid
const ROOM_GLSL = /* glsl */ `
uniform sampler2D uRoom; uniform vec4 uRoomXf; uniform vec2 uRoomN;
float shoreDist(vec2 p) {
  vec2 g = ((p - uRoomXf.xy) * uRoomXf.z + 0.5) / uRoomN;
  if (g.x < 0.5 / uRoomN.x || g.y < 0.5 / uRoomN.y || g.x > 1.0 - 0.5 / uRoomN.x || g.y > 1.0 - 0.5 / uRoomN.y) return 999.0;
  return (texture2D(uRoom, g).r * 255.0 - 128.0) * 4.0;
}`;
const GROUND_GLSL = /* glsl */ `
#ifndef GROUND_Y
#define GROUND_Y vLand.y
#endif
${ROOM_GLSL}
${CONVEX_GLSL}
uniform sampler2D uCover, uRoads; uniform vec3 uCol[11], uFields[6], uTowns[8], uNearXf, uShare, uLake; uniform float uNF, uTreeTop, uSnow, uNear, uWood, uCanopy, uClear, uCoast;
varying vec3 vLN;
float gLake; // 1 where groundColour() found a lake's still water
float gWet; // how wet the shore is here (groundColour()): darker, and glossy (LAKE_LIGHT)
float lhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lnoise(vec2 x) { vec2 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lhash(i), lhash(i + vec2(1.0, 0.0)), u.x), mix(lhash(i + vec2(0.0, 1.0)), lhash(i + vec2(1.0, 1.0)), u.x), u.y); }
// the relief a mesh too coarse to carry it leaves out — gullies and spurs down the slopes, a few hundred metres apart,
// the farther the broader — as a tilt of the slope's normal, faded in with the distance (near, the mesh has them)
float gully(vec2 q, float s) { return (1.0 - abs(2.0 * lnoise(q / s) - 1.0)) * 0.18 * s + (1.0 - abs(2.0 * lnoise(q / (s * 0.37) + 3.1) - 1.0)) * 0.06 * s; }
vec3 slopeRelief(vec3 wn, vec2 q, float d, float near) {
  float k = smoothstep(0.06, 0.3, 1.0 - wn.y) * smoothstep(near, near * 3.0, d);
  if (k <= 0.0) return wn;
  float s = 220.0 + d * 0.035, e = s * 0.2, h = gully(q, s);
  vec3 t = vec3(gully(q + vec2(e, 0.0), s) - h, 0.0, gully(q + vec2(0.0, e), s) - h) / e;
  return normalize(wn - t * 0.55 * k);
}
// bare rock up close: slabs each a shade of their own, the cracks between them, and lichen in patches — as a tint on
// the rock's colour, fading to its average where it's finer than a few pixels (so the cracks don't shimmer)
vec3 rockMod(vec2 q) {
  float k = 1.0 - smoothstep(0.6, 3.0, length(fwidth(q)));
  if (k <= 0.0) return vec3(1.0);
  float slab = lnoise(q / 6.0 + lnoise(q / 21.0) * 1.6);
  // (its joints: two sets of near-straight cracks across each other, some 7 and 11 m apart, each broken into lengths)
  float wa = dot(q, vec2(0.8, 0.6)) / 7.0 + lnoise(q / 17.0) * 0.6, wb = dot(q, vec2(-0.6, 0.8)) / 11.0 + lnoise(q / 23.0 + 4.0) * 0.6;
  float crack = smoothstep(0.035, 0.0, abs(fract(wa) - 0.5)) * smoothstep(0.35, 0.5, lnoise(q / 9.0 + 1.3))
    + smoothstep(0.025, 0.0, abs(fract(wb) - 0.5)) * smoothstep(0.4, 0.55, lnoise(q / 12.0 + 7.7));
  crack = min(crack, 1.0);
  float lich = smoothstep(0.6, 0.7, lnoise(q / 1.4 + 2.0)) * smoothstep(0.35, 0.65, lnoise(q / 11.0 + 5.0));
  vec3 m = vec3(0.86 + 0.28 * slab) * mix(vec3(1.0), vec3(1.12, 1.05, 0.72), lich * 0.7) * (1.0 - 0.45 * crack);
  return mix(vec3(1.0), m, k);
}
float lfbm(vec2 p) { return 0.55 * lnoise(p / 220.0) + 0.3 * lnoise(p / 70.0) + 0.15 * lnoise(p / 22.0); }
// The canopy: a wood seen from off the water is a roof of crowns, not a green lawn, and the instanced trees are far too
// few to make it. So the ground under a wood is drawn as one: crowns a cell apart (7 m in a wood, 3.5 m in scrub),
// packed but each placed and sized its own way, each its own shade, with the dark ground between them; each a dome
// whose tilt goes to the light (gCrownK, gCrownO, gCrownH: the terrain's normal hook), so the side away from the sun is
// in shade and a wooded slope is bumpy against the light. Where a crown shrinks to a pixel or two the detail gives way
// to its average, so it doesn't shimmer. And each crown shades the ones beside it and the ground between, away from the
// sun, the longer the lower it is (gCrownSh, on the sunlight; on average, from far off, a wood darker in a low sun).
// The crowns are laid out on the slope, not as seen from above: a steep one's are read from the side too (as the rock's
// noise is, triplanar), so they keep their shape there rather than drawn out down it.
float gCrownK, gCrownSh = 1.0, gCrownH = 1.0; vec3 gCrownO;
// how far the wood here thins (over a ridge, a spur: groundColour()'s ridgeThin), and what is between its crowns there
float gThin = 0.0; vec3 gGapCol = vec3(0.0);
vec4 crowns(vec2 q, float cell) { // xy: from the crown's middle to here, over its radius; z: how far out (1, its edge); w: its own shade
  vec2 s = q / cell, i = floor(s), f = fract(s);
  vec4 best = vec4(0.0, 0.0, 9.0, 0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), id = i + g;
    if (lhash(id + 3.3) < 0.12 + 0.3 * gThin) continue; // a gap in the wood (more of them where it thins)
    vec2 d = f - g - 0.1 - 0.8 * vec2(lhash(id), lhash(id + 17.31));
    float r = 0.58 + 0.38 * lhash(id + 41.7), e = length(d) / r;
    if (e < best.z) best = vec4(d / r, e, lhash(id + 7.7));
  }
  best.z *= 0.86 + 0.28 * lnoise(s * 3.1); // ragged, not round
  return best;
}
// the crowns on one plane: their colour; how much of here is a crown (on); its bump, in the plane's own two axes, and
// how high it stands there (h); cr, the crown itself
vec3 crownLook(vec3 c, vec2 q, float cell, float kc, out float on, out vec2 bump, out float h, out vec4 cr) {
  cr = crowns(q, cell);
  on = 1.0 - smoothstep(0.8, 1.0, cr.z);
  // inside a crown, its clumps of leaves, each lit on its top and shaded under it (only while they are bigger than a
  // pixel): a little relief of its own for the light, and darker in the hollows between them
  float f = 5.5 / cell, e = 0.35 / f;
  vec2 cq = q * f + cr.w * 40.0;
  float n0 = lnoise(cq), nx = lnoise(cq + vec2(0.35, 0.0)), nz = lnoise(cq + vec2(0.0, 0.35));
  vec3 tone = mix(vec3(1.0), vec3(1.07, 1.05, 0.84), cr.w) * (0.78 + 0.4 * lhash(vec2(cr.w * 91.0, 3.0))); // each tree its own green
  h = sqrt(max(1.0 - min(cr.z * cr.z, 1.0), 0.0));
  bump = vec2(cr.x - (nx - n0) / e * 0.9 * kc, cr.y - (nz - n0) / e * 0.9 * kc);
  return mix(mix(c * 0.46, gGapCol, 0.75 * gThin), c * tone * (1.0 - 0.18 * cr.z * cr.z) * mix(1.0, 0.68 + 0.6 * n0, kc), on);
}
vec3 canopy(vec3 c, vec3 p, vec3 nrm, float w, float cell) {
  gCrownK = 0.0; gCrownSh = 1.0; gCrownH = 1.0; gCrownO = vec3(0.0);
  if (w <= 0.0) return c;
  float px = length(fwidth(p)), kd = (1.0 - smoothstep(cell * 0.18, cell * 0.5, px)) * uCanopy;
  vec3 avg = mix(c * 0.82, mix(c, gGapCol, 0.5), gThin * 0.5); // the crowns and the shade between them, as they average out
  float lowSun = 1.0 - smoothstep(0.15, 0.9, uSun.y), shAvg = 1.0 - w * (0.1 + 0.35 * lowSun);
  if (kd <= 0.0) { gCrownSh = shAvg; return mix(c, avg, w); }
  float kc = 1.0 - smoothstep(cell * 0.05, cell * 0.14, px);
  vec3 tw = pow(abs(nrm), vec3(12.0)); tw *= step(0.06, tw / (tw.x + tw.y + tw.z)); tw /= tw.x + tw.y + tw.z; // (how much each plane: from above, from the east, from the south; none that's only a trace)
  vec3 det = vec3(0.0), off = vec3(0.0); float on = 0.0, hg = 0.0, shd = 0.0, o, h; vec2 b; vec4 cr;
  if (tw.y > 0.0) {
    det += crownLook(c, p.xz, cell, kc, o, b, h, cr) * tw.y; on += o * tw.y; hg += h * tw.y; off += vec3(b.x, 0.0, b.y) * tw.y;
    // the sun's line from here, risen a third of a cell (the crowns stand some half a cell above the ground between
    // them): if another crown is higher than that there, it shades this point
    vec4 c2 = crowns(p.xz + uSun.xz / max(uSun.y, 0.12) * cell * 0.33, cell);
    float h0 = o * h - 0.25 * (1.0 - o);
    float h1 = (1.0 - smoothstep(0.8, 1.0, c2.z)) * sqrt(max(1.0 - min(c2.z * c2.z, 1.0), 0.0));
    shd = smoothstep(0.3, 0.75, h1 - h0) * step(0.001, abs(c2.w - cr.w)) * tw.y;
  }
  if (tw.x > 0.0) { det += crownLook(c, p.zy, cell, kc, o, b, h, cr) * tw.x; on += o * tw.x; hg += h * tw.x; off += vec3(0.0, b.y, b.x) * tw.x; }
  if (tw.z > 0.0) { det += crownLook(c, p.xy, cell, kc, o, b, h, cr) * tw.z; on += o * tw.z; hg += h * tw.z; off += vec3(b.x, b.y, 0.0) * tw.z; }
  gCrownSh = mix(shAvg, 1.0 - 0.7 * w * shd, kd); // (not all of it: the leaves let some through)
  gCrownK = kd * w * on; gCrownO = off; gCrownH = 1.5 * hg;
  return mix(c, mix(avg, det, kd), w);
}
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
  vec3 p = vLand; float y = GROUND_Y, ny = normalize(vLN).y;
  vec2 g = (p.xz - uGridXf.xy) * uGridXf.z + (vec2(lnoise(p.xz / 7.0), lnoise(p.zx / 7.0 + 3.1)) - 0.5) * uGridXf.z * 24.0;
  float cv = floor(texture2D(uCover, g).r * 255.0 + 0.5), v = floor(cv / 16.0);
  int cls = int(cv - v * 16.0);
  // on steep faces the noise is read from the side too (triplanar), so a cliff isn't streaked straight down
  vec3 an = abs(normalize(vLN)); float n = lfbm(p.xz);
  if (an.y < 0.85) { vec3 tw = pow(an, vec3(4.0)); tw /= tw.x + tw.y + tw.z; n = tw.y * n + tw.x * lfbm(p.zy) + tw.z * lfbm(p.xy); }
  vec2 rq = an.y > 0.6 ? p.xz : an.x > an.z ? p.zy : p.xy; // (the rock's detail read on its face, not down a cliff)
  vec3 rm = rockMod(rq); // (once: the bare rock, the crags and the shore's rock all take it)
  float steep = smoothstep(0.32, 0.6, 1.0 - ny), high = smoothstep(uTreeTop * 0.65, uTreeTop * 1.26, y);
  gLake = 0.0; gWet = 0.0;
  vec3 forest = mix(mix(uCol[0], uCol[1], n), uCol[2], max(0.0, n - 0.62) * 1.6);
  vec3 c = forest; float wild = 1.0; // how far the slope and the height turn it to scrub and rock
  float wood = 0.0, cell = 7.0; // how much of it is under the canopy, and the crowns' spacing (canopy())
  if (cls == 1) { c = forest * (v == 1.0 ? vec3(0.86, 0.93, 0.92) : v == 2.0 ? vec3(1.05, 1.06, 0.98) : vec3(1.0)); wood = 1.0; }
  else if (cls == 2) { c = mix(uCol[3], forest, 0.3 * n); wood = 0.7; cell = 3.5; }
  else if (cls == 3) c = uCol[9] * (0.88 + 0.2 * lnoise(p.xz / 40.0));
  else if (cls == 4) { c = uNF > 0.0 ? sown(p.xz, v) : uCol[9] * (0.9 + 0.03 * v); wild = 0.6; }
  else if (cls == 5) c = mix(uCol[9], uCol[0], 0.3 + 0.35 * step(0.55, fract((p.x * 0.6 + p.z * 0.8) / 6.0)));
  else if (cls == 6) { c = uCol[6] * (0.8 + 0.35 * lnoise(p.xz / 9.0)) * (0.94 + 0.008 * v); wild = 0.25; }
  else if (cls == 7) { c = mix(uCol[6], vec3(0.33), 0.45) * (0.8 + 0.3 * lnoise(p.xz / 22.0)); wild = 0.25; }
  else if (cls == 8) { c = uCol[8] * (0.93 + 0.12 * lnoise(p.xz / 9.0)); wild = 0.0; }
  else if (cls == 9) { // bare rock and scree: never quite bare, streaked, with scrub in its gullies
    float st = lnoise(vec2(p.x / 14.0, p.z / 14.0) + lnoise(p.xz / 60.0) * 3.0);
    c = mix(mix(uCol[5], uCol[4], 0.35 + 0.5 * st) * rm, mix(uCol[3], forest, 0.5), smoothstep(0.55, 0.8, lnoise(p.xz / 45.0)) * 0.6);
  }
  else if (cls == 10) c = uCol[10];
  else if (cls == 11 && ny > 0.97) { c = uLake; wild = 0.0; gLake = 1.0; } // a lake, a reservoir: its surface mirrors the sky (lakeLight)
  else if (cls == 12) { c = mix(uCol[7], vec3(0.16, 0.15, 0.12), 0.45) * (0.85 + 0.25 * lnoise(p.xz / 6.0)); wild = 0.0; } // the tidal mud, wet
  else if (cls == 13) { c = mix(uCol[6], vec3(0.74, 0.72, 0.68), 0.6) * (0.9 + 0.12 * lnoise(p.xz / 3.0)); wild = 0.0; } // a paved square, a promenade: pale stone, a little of the town's
  else if (cls == 0) {
    // the woods in stands, as the trees are (pines(): woodAt), with grass or fields in the clearings
    float open = (1.0 - smoothstep(uWood - 0.04, uWood + 0.06, lfbm(p.xz * 1.7))) * smoothstep(0.9, 0.97, ny);
    // where the venue has no fields, what its clearings are (uClear, venues.js look.clearing): the low scrub that grows
    // back — the maquis, the garrigue, the fynbos — by default; grass in a city's parks and a northern meadow; bare
    // rock, glacier-smoothed, with heath in its hollows, on a skerry coast
    float hollow = smoothstep(0.45, 0.7, lnoise(p.xz / 18.0 + lnoise(p.xz / 70.0) * 2.0));
    vec3 clearing = uClear > 1.5 ? mix(mix(uCol[5], uCol[4], 0.3 + 0.5 * n) * rm, mix(uCol[3], uCol[0], 0.3), hollow) : uClear > 0.5 ? uCol[9] * (0.9 + 0.15 * lnoise(p.xz / 30.0)) : mix(uCol[9], uCol[3], 0.7);
    c = mix(c, uNF > 0.0 ? parcels(p.xz) : clearing, open * (y < 160.0 ? 0.9 : 0.5));
    // where the map has no town, the venue's towns tint the ground
    float t = 0.0;
    for (int i = 0; i < 8; i++) if (uTowns[i].z > 0.0) t = max(t, 1.0 - length(vec2((p.x - uTowns[i].x) / 1.1, p.z - uTowns[i].y)) / uTowns[i].z);
    t = clamp(t, 0.0, 1.0) * 0.7 * smoothstep(0.9, 0.97, ny);
    c = mix(c, uCol[6], t);
    float cleared = open * (y < 160.0 ? 0.9 : 0.5);
    // (the scrub as bushes, 3.5 m apart; on the rock, a little heath in its hollows; grass and fields: nothing)
    if (uNF > 0.0 || uClear > 0.5) wood = 1.0 - cleared; else if (cleared > 0.45) { wood = 0.75; cell = 3.5; } else wood = 1.0;
    if (uNF <= 0.0 && uClear > 1.5 && cleared > 0.45) { wood = 0.6 * hollow; cell = 3.5; }
    wood *= 1.0 - t * 1.4;
  }
  float scrubby = max(steep * 0.55, high * 0.5) * (0.6 + 0.4 * n) * wild;
  c = mix(c, uCol[3], scrubby);
  // bare rock on the crags, in layers (the strata, a little wavy) where it's steep
  float strata = 0.86 + 0.14 * smoothstep(0.35, 0.65, fract(y / 6.5 + lnoise(p.xz / 55.0) * 1.5));
  float bare = max(smoothstep(0.5, 0.75, 1.0 - ny), high * 0.7) * (0.55 + 0.45 * lnoise(p.xz / 40.0)) * (wild > 0.0 ? max(wild, 0.5) : 0.0);
  c = mix(c, (n > 0.5 ? uCol[4] : uCol[5]) * mix(1.0, strata, steep) * rm, bare);
  wood *= (1.0 - 0.5 * scrubby) * (1.0 - bare);
  // the roads round the race area: asphalt, paler in town
  vec2 rg = (p.xz - uNearXf.xy) * uNearXf.z;
  if (rg.x > 0.0 && rg.y > 0.0 && rg.x < 1.0 && rg.y < 1.0) {
    float road = smoothstep(0.35, 0.75, texture2D(uRoads, rg).r) * 0.9;
    c = mix(c, cls == 6 ? vec3(0.36, 0.36, 0.35) : vec3(0.27, 0.28, 0.28), road);
    wood *= 1.0 - road;
  }
  // the shore: the sea's mark on it, a band of bare stone (or the beach's sand, or the mud) up from the water —
  // higher where the coast is steep and the waves run up it, ragged along its top, the stone in blocks — dark and wet
  // at the waterline
  // (on a low, flat shore, where a few centimetres of height are metres of ground, it is shingle: plain, and even, and
  // measured from the shore — the waterline, and a strip some 4 to 7 m wide inland of it (shoreDist) — not by the
  // height, which on flat land would band the low ground far back from the water too)
  float rocky = smoothstep(0.1, 0.35, 1.0 - ny), bn = lnoise(p.xz / 6.0 + lnoise(p.xz / 23.0) * 2.0);
  // (its stone read on its face where the shore is steep, as the rock's is (rq), not squeezed into a strip as seen
  // from above; its top higher and lower along the shore, as the exposure to the waves is)
  vec2 sq = rocky > 0.5 ? rq : p.xz;
  float top = 1.4 + 1.7 * steep + 0.9 * (bn - 0.5) * rocky + 1.1 * (lnoise(p.xz / 38.0 + 5.0) - 0.5) * rocky, shH = 1.0 - smoothstep(top - 0.25, top + 0.25, y), sd = shoreDist(p.xz);
  float shF = max(1.0 - smoothstep(0.35, 0.8, y), sd > 900.0 ? shH : (1.0 - smoothstep(3.0 + 3.0 * bn, 5.0 + 3.0 * bn, -sd)) * (1.0 - smoothstep(1.5, 3.0, y)));
  float sh = mix(shF, shH, rocky);
  float blocks = lnoise(sq / 1.8 + bn * 3.0), cracks = smoothstep(0.08, 0.0, abs(lnoise(sq / 3.5 + 9.0) - 0.5));
  // the boulders in it, each its own shade, dark in the gaps between them (only while they are bigger than a few pixels)
  float spx = length(fwidth(p)), kb = 1.0 - smoothstep(0.12, 0.4, spx);
  vec4 bo = crowns(sq, 1.3); float bon = 1.0 - smoothstep(0.6, 0.95, bo.z);
  float boulder = mix(0.8, mix(0.42, 0.72 + 0.5 * bo.w - 0.25 * bo.z * bo.z, bon), kb);
  // the shingle's pebbles, where it isn't rock
  float peb = mix(0.5, lhash(floor(p.xz / 0.35)), 1.0 - smoothstep(0.05, 0.25, spx));
  // (on a rocky coast, uCoast, the low shore is the bare, wave-washed rock, not shingle)
  float rk = uCoast > 0.5 ? max(rocky, 0.85) : rocky;
  vec3 sc = cls == 8 ? uCol[8] : cls == 12 ? c : mix(uCol[7] * (0.9 + 0.15 * lnoise(p.xz / 1.2)) * (0.86 + 0.28 * peb), mix(uCol[7], uCol[4], 0.35) * (0.72 + 0.45 * blocks) * (1.0 - 0.45 * cracks) * rm * boulder, rk);
  // the rock's bands up from the sea: dark with the weed and the film the sea leaves, as high as it washes over it, then
  // pale and bare in the splash, up to the band's top
  float dark = (1.0 - smoothstep(0.35 + 0.4 * rocky, 0.6 + 0.6 * rocky, y + 0.35 * (bn - 0.5))) * rk * (cls == 8 || cls == 12 ? 0.0 : 1.0);
  sc = mix(sc * mix(1.0, 0.82, rk), vec3(0.17, 0.165, 0.13) * (0.8 + 0.4 * blocks), dark * 0.8);
  c = mix(c, sc, 0.9 * sh);
  // and wet just above the water: as high as the waves run up it, each in its turn along the shore, every few seconds
  // (higher on a steep rocky shore, where they break against it and splash), darker and with a sheen — not on the low
  // flat land further back from the water, nor on the tidal mud, which is wet all over already
  float run = 0.22 + 0.3 * (0.5 + 0.5 * sin(uCsT * 0.75 + dot(p.xz, vec2(0.011, 0.016)) + lnoise(p.xz / 40.0) * 9.0)) + 0.5 * rocky;
  gWet = (1.0 - smoothstep(run - 0.12, run + 0.08, y)) * (sd > 900.0 ? 1.0 : 1.0 - smoothstep(5.0, 16.0, -sd)) * (cls == 12 || cls == 11 ? 0.0 : 1.0);
  c *= 1.0 - 0.45 * gWet;
  wood *= 1.0 - sh;
  // over the ridges and the spurs the wild wood thins (ridgeThin): scrub and the grey rock between its crowns
  gThin = ridgeThin(landSky(p.xz), ny) * smoothstep(0.5, 1.0, wild);
  gGapCol = mix(mix(uCol[3], c, 0.5) * 0.62, mix(uCol[5], uCol[4], n) * rm * 0.62, 0.15 + 0.3 * gThin);
  return canopy(c, p, normalize(vLN), wood, cell);
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
if (gWet > 0.01) { // the wet shore: the sky in it, a little, and the sun's glint
  vec3 vd = normalize(vHz), rd = reflect(vd, normalize(vLN));
  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(-vd, normalize(vLN)), 0.0), 5.0);
  totalEmissiveRadiance += gWet * (skyBase(rd) * fr * 0.4 + uSunCol * pow(max(dot(rd, uSun), 0.0), 80.0) * 0.8 * landSun(vLand.xz));
}
if (gLake > 0.5) {
  vec3 vd = normalize(vHz), rd = reflect(vd, vec3(0.0, 1.0, 0.0));
  float fr = 0.04 + 0.96 * pow(1.0 - max(-vd.y, 0.0), 5.0);
  totalEmissiveRadiance += mix(uLake * 0.6, skyBase(rd), fr) + uSunCol * pow(max(dot(rd, uSun), 0.0), 300.0) * 3.0;
  diffuseColor.rgb *= 0.12;
}`;
// in 64 tiles of some 2 km (the quadtree's squares three levels down), so the ones out of view aren't drawn; they
// share the corners and their normals
// the slopes' relief (GROUND_GLSL's slopeRelief), on the terrain and the land beyond
const RELIEF = '{ normal = normalize((viewMatrix * vec4(slopeRelief(normalize(vLN), vLand.xz, length(vHz), 600.0), 0.0)).xyz); }';
// The canopy's height: in a wood the ground is drawn as the roof of its crowns (canopy()), so it is drawn that high
// too, some 8 m up (a little more or less crown by crown), and a ridge's outline and a wood's edge stand up as they do
// — only drawn so: the race, the trees and the houses keep to the ground itself (groundAt). As in groundColour(), as
// near as a corner can tell: the map's woods, scrub a little; the stands where it says nothing, not their clearings
// (but low scrub); none in the towns, on the roads, round the houses (uLiftMask, Skopea), on the crags and the bare
// tops, nor on the shore, rising from the rocks; only round the race area (where the roads are), fading at its edge.
const FINE = Math.round(Math.log2(2 * TE / 17)); // the quadtree's level of the 17 m squares (terrain(), pines())
// how much of the canopy's height a square of the mesh carries, by its level: all on the 8 and 17 m ones, most on the
// 33 m, a little on the 66 m, none on coarser
const liftShare = (lv) => (lv >= FINE ? 1 : lv === FINE - 1 ? 0.7 : lv === FINE - 2 ? 0.3 : 0);
// the quadtree's level of the square the point is in (as groundAt finds it): the bigger, the finer
function levelAt(x, z) {
  const fc = (x + TE) / (2 * TE / TN_), fr = (z + TE) / (2 * TE / TN_), { kids, leafOf } = TREE;
  if (!(fc >= 0 && fr >= 0 && fc <= TN_ && fr <= TN_)) return 0;
  let node = 0, lv = 0, i = 0, j = 0;
  while (leafOf[node] < 0) {
    const s = TN_ >> (lv + 1), a = fr >= (2 * i + 1) * s ? 1 : 0, b = fc >= (2 * j + 1) * s ? 1 : 0;
    node = kids[node * 4 + a * 2 + b]; i = 2 * i + a; j = 2 * j + b; lv++;
  }
  return lv;
}
const LIFT_VS = /* glsl */ `
uniform sampler2D uCover, uRoads, uLiftMask, uAO; uniform vec3 uGridXf, uNearXf, uTowns[8], uAOXf; uniform float uWood, uNF, uClear, uTreeTop, uLiftOn;
attribute float aFine; // how far this corner may carry it (terrain(): none where the mesh is coarse)
varying float vGroundY;
${ROOM_GLSL}
${CONVEX_GLSL}
float vhash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 x) { vec2 i = floor(x), f = fract(x), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), u.x), mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), u.x), u.y); }
float canopyLift(vec3 p, vec3 n) {
  vec2 rg = (p.xz - uNearXf.xy) * uNearXf.z;
  if (uLiftOn < 0.5 || aFine <= 0.0 || rg.x <= 0.0 || rg.y <= 0.0 || rg.x >= 1.0 || rg.y >= 1.0) return 0.0;
  float cv = floor(texture2D(uCover, (p.xz - uGridXf.xy) * uGridXf.z).r * 255.0 + 0.5);
  int cls = int(cv - floor(cv / 16.0) * 16.0);
  float y = p.y, h = 0.0;
  if (cls == 1) h = 1.0;
  else if (cls == 2) h = 0.25;
  else if (cls == 0) {
    // (the stands' outline smoothed: without the finest of the noise, and eased in over a wider margin, so a strip of
    // wood a corner or two wide isn't raised as a fin among the clearings)
    vec2 q = p.xz * 1.7;
    float f = 0.55 * vnoise(q / 220.0) + 0.3 * vnoise(q / 70.0) + 0.075;
    float cleared = (1.0 - smoothstep(uWood - 0.08, uWood + 0.12, f)) * smoothstep(0.9, 0.97, n.y) * (y < 160.0 ? 0.9 : 0.5);
    h = uNF > 0.0 || uClear > 0.5 ? 1.0 - cleared : mix(1.0, 0.25, smoothstep(0.3, 0.6, cleared));
    float t = 0.0;
    for (int i = 0; i < 8; i++) if (uTowns[i].z > 0.0) t = max(t, 1.0 - length(vec2((p.x - uTowns[i].x) / 1.1, p.z - uTowns[i].y)) / uTowns[i].z);
    h *= 1.0 - clamp(t * 1.4, 0.0, 1.0);
  }
  h *= (1.0 - smoothstep(0.5, 0.75, 1.0 - n.y)) * (1.0 - 0.7 * smoothstep(uTreeTop * 0.65, uTreeTop * 1.26, y));
  h *= (1.0 - smoothstep(0.2, 0.6, texture2D(uRoads, rg).r)) * (1.0 - texture2D(uLiftMask, rg).r);
  float sd = shoreDist(p.xz); // (rising from the shore's rocks over the first 40 m ashore, whatever the ground's height)
  h *= (sd > 900.0 ? smoothstep(2.5, 9.0, y) : smoothstep(-4.0, -40.0, sd)) * smoothstep(1.2, 3.0, y) * smoothstep(0.0, 0.06, min(min(rg.x, rg.y), min(1.0 - rg.x, 1.0 - rg.y)));
#ifdef LIFT_EVEN
  return h * aFine * 8.5; // (for the shadows' height map: a roof's outline, not each crown's, which its cells are too big for)
#else
  // (and crown by crown, so a wooded skyline is ragged, not a smooth line: stands of an age taller or lower than the
  // ones beside them, each crown its own height, a gap now and then — more of them over a ridge, where the wood thins)
  vec2 cc = floor(p.xz / 7.0) + 0.5;
  float thin = ridgeThin(min(texture2D(uAO, (p.xz - uAOXf.xy) * uAOXf.z).r * (255.0 / 63.0), 1.0), n.y);
  float crown = vhash(cc) < 0.08 + 0.25 * thin ? 0.3 : 0.6 + 0.8 * vhash(cc + 9.5);
  return h * aFine * 8.5 * (0.7 + 0.6 * vnoise(p.xz / 45.0)) * crown;
#endif
}`;
// …and on the terrain the canopy's crowns too (GROUND_GLSL's canopy(): each a dome on the slope, tilted to the light)
const RELIEF_CROWNS = `{ vec3 wn = slopeRelief(normalize(vLN), vLand.xz, length(vHz), 600.0);
  if (gCrownK > 0.0) wn = normalize(mix(wn, normalize(wn * gCrownH + gCrownO - wn * dot(gCrownO, wn)), gCrownK * 0.75)); // (its bump along the slope)
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz); }`;
function terrain() {
  const all = new THREE.BufferGeometry(), pos = new THREE.BufferAttribute(MESH.pos, 3);
  all.setAttribute('position', pos); all.setIndex(new THREE.BufferAttribute(MESH.idx, 1)); all.computeVertexNormals();
  const nrm = all.attributes.normal, { L, I, J, D } = TREE, tiles = new Map();
  // how far each corner may carry the canopy's height (LIFT_VS): the least share (liftShare) of the squares it is a
  // corner of — a single corner raised 8 m among the far-apart corners of the flat low land would stand up as a tent
  const fine = new Float32Array(MESH.corners).fill(1);
  for (let k = 0; k < L.length; k++) {
    if (!D[k]) continue;
    const f = liftShare(L[k]);
    for (let t = MESH.tri0[k]; t < MESH.tri0[k] + MESH.triN[k]; t++) for (let e = 0; e < 3; e++) { const v = MESH.idx[t * 3 + e]; fine[v] = Math.min(fine[v], f); }
  }
  // (twice over, each corner no more than the least of its neighbours': a fine pocket among coarse squares isn't raised)
  for (let pass = 0; pass < 2; pass++) {
    const g = fine.slice();
    for (let t = 0; t < MESH.idx.length; t += 3) {
      const a = MESH.idx[t], b = MESH.idx[t + 1], c = MESH.idx[t + 2], m = Math.min(fine[a], fine[b], fine[c]);
      g[a] = Math.min(g[a], m); g[b] = Math.min(g[b], m); g[c] = Math.min(g[c], m);
    }
    fine.set(g);
  }
  const fineA = new THREE.BufferAttribute(fine, 1);
  for (let k = 0; k < L.length; k++) {
    if (!D[k]) continue;
    const sh = Math.max(0, L[k] - 3), key = (I[k] >> sh) * 8 + (J[k] >> sh);
    if (!tiles.has(key)) tiles.set(key, []);
    const list = tiles.get(key), t0 = MESH.tri0[k];
    for (let t = t0; t < t0 + MESH.triN[k]; t++) list.push(MESH.idx[t * 3], MESH.idx[t * 3 + 1], MESH.idx[t * 3 + 2]);
  }
  const mat = landMat(new THREE.MeshLambertMaterial(), 1, {
    key: 'ground', colour: 'groundColour()', uniforms: GROUND_U, fsHead: '#define GROUND_Y vGroundY\nvarying float vGroundY;\n' + GROUND_GLSL,
    vsHead: 'varying vec3 vLN;\n' + LIFT_VS, vs: 'vLN = objectNormal;', emis: LAKE_LIGHT, nrm: RELIEF_CROWNS, sun: 'gCrownSh',
    project: 'vGroundY = transformed.y; transformed.y += canopyLift(transformed, normalize(objectNormal));\n#include <project_vertex>', // (the ground's own height, for its colour)
  });
  // its height for the shadows (shadows()): with the canopy's, as it is drawn
  const heightMat = new THREE.ShaderMaterial({
    uniforms: { ...LAND_U, ...GROUND_U }, defines: { LIFT_EVEN: 1 }, fragmentShader: HEIGHT_MAT.fragmentShader,
    vertexShader: LIFT_VS + '\nvarying float vY;\nvoid main() {\n  vec3 tp = position; tp.y += canopyLift(tp, normalize(normal));\n  vec4 p = modelMatrix * vec4(tp, 1.0); vY = p.y;\n  gl_Position = projectionMatrix * viewMatrix * p;\n}',
  });
  const group = new THREE.Group(), box = new THREE.Box3(), v = new THREE.Vector3();
  for (const list of tiles.values()) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', pos); g.setAttribute('normal', nrm); g.setAttribute('aFine', fineA); g.setIndex(list);
    box.makeEmpty(); for (const i of list) box.expandByPoint(v.fromBufferAttribute(pos, i));
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); g.boundingBox = box.clone();
    const m = new THREE.Mesh(g, mat); m.userData.heightMat = heightMat; group.add(m);
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
    vsHead: 'varying vec3 vLN; varying float vFarZ;', vs: 'vLN = objectNormal; vFarZ = -(viewMatrix * lwp).z;', nrm: RELIEF,
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
// a crown: lumpy, not a smooth ball; its normals round (shaded soft, not in facets) and tipped up a little, as the
// leaves on top catch the sky; darker underneath and inside, where the leaves shade each other
const lumpH = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return v - Math.floor(v); };
function leafy(g, lump = 0.28) {
  g = g.index ? g.toNonIndexed() : g;
  g.computeBoundingBox();
  const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const P = g.attributes.position, nrm = new Float32Array(P.count * 3), col = new Float32Array(P.count * 3), v = new THREE.Vector3(), u = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).sub(c); u.copy(v).divide(s);
    const k = 1 + (lumpH(Math.round(u.x * 50), Math.round(u.y * 50), Math.round(u.z * 50)) - 0.5) * lump; // the same for a corner every face shares
    P.setXYZ(i, c.x + v.x * k, c.y + v.y * k, c.z + v.z * k);
    const n = new THREE.Vector3(u.x / s.x, u.y / s.y, u.z / s.z).normalize(); n.y += 0.35; n.normalize();
    nrm.set([n.x, n.y, n.z], i * 3);
    const ao = 0.62 + 0.5 * THREE.MathUtils.smoothstep(u.y, -1, 0.9); // about as bright as the plain crown was, on the whole
    col.set([ao, ao, ao], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const blob = (sx, sy, sz, x, y, z) => leafy(new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).translate(x, y, z));
const trunk = (r0, r1, h, col = '#5a4636', y = 0) => tint(new THREE.CylinderGeometry(r0, r1, h, 3, 1, true).translate(0, y + h / 2, 0), col);
// Each kind in three shapes (treeGeo's v), so a wood isn't one tree over and over; R: a steady random for the shape
const TREES = {
  // the Turkish red pine, Göcek's: a crown of flattish clumps in tiers, wider than it is tall and lopsided, high on a
  // bare trunk
  pine: (R) => {
    const g = [trunk(0.22, 0.32, 7.2)], a0 = R() * 6.28;
    for (let i = 0; i < 3; i++) {
      const a = a0 + i * 2.1 + R(), r = 0.5 + R() * 1.4;
      g.push(blob(2.3 + R() * 1.1, 1.0 + R() * 0.6, 2.1 + R() * 1.1, Math.cos(a) * r, 7.0 + i * 1.0 + R() * 0.5, Math.sin(a) * r));
    }
    return g;
  },
  stone: (R) => [trunk(0.28, 0.4, 9), blob(5.1 + R(), 1.5 + R() * 0.4, 5.1 + R(), 0, 9.6, 0), blob(2.6 + R(), 1.1, 2.6 + R(), -2.2 + R(), 10.3, 1.2 - R() * 2)], // the umbrella pine: a flat crown up high
  broad: (R) => [trunk(0.35, 0.5, 4), blob(3.8 + R() * 0.9, 3.2 + R() * 0.8, 3.8 + R() * 0.9, 0, 6.6, 0), blob(2.6 + R(), 2.2 + R() * 0.8, 2.6 + R(), 1.8 - R() * 3.6, 8 + R(), R() * 2 - 1)],
  conifer: (R) => { const h = 9.5 + R() * 3, w = 2.2 + R() * 0.8; return [trunk(0.2, 0.3, 2.5), leafy(new THREE.ConeGeometry(w, h, 7).translate(0, 2 + h / 2, 0), 0.18)]; },
  cypress: (R) => { const h = 10.5 + R() * 3; return [trunk(0.15, 0.25, 1.5), leafy(new THREE.ConeGeometry(1.15 + R() * 0.3, h, 6).translate(0, 1 + h / 2, 0), 0.12), blob(1.25, 2.4, 1.25, 0, 3.8, 0)]; },
  eucalypt: (R) => [trunk(0.3, 0.45, 11 + R() * 2, '#cfc6b4'), blob(3 + R(), 2.1 + R() * 0.5, 3 + R(), R() - 0.5, 12.5, 0), blob(2.5, 1.8, 2.5, 2.2, 9.8 + R(), 1), blob(2.6, 2, 2.6, -1.8, 10.8, -1.2 + R())],
  olive: (R) => [trunk(0.35, 0.45, 2.2 + R() * 0.6, '#6b5a48'), blob(2.3 + R() * 0.7, 1.7 + R() * 0.4, 2.3 + R() * 0.7, 0, 3.4, 0), blob(1.6, 1.2, 1.6, 1.3 - R() * 2.6, 4.3, -0.6)],
  shrub: (R) => [blob(1.6 + R() * 0.6, 1 + R() * 0.3, 1.6 + R() * 0.6, 0, 0.7, 0), blob(1.3, 0.8, 1.3, 1.3 - R() * 2.6, 0.5, 0.7)],
  palm: (R) => {
    const lean = 0.04 + R() * 0.1, top = 8 + R() * 2.5, g = [tint(new THREE.CylinderGeometry(0.2, 0.32, top, 4, 1, true).translate(0, top / 2, 0).rotateZ(-lean), '#8a7a5e')];
    const tx = Math.sin(lean) * top, ty = Math.cos(lean) * top;
    for (let k = 0; k < 7; k++) g.push(tint(new THREE.BoxGeometry(4.6, 0.12, 0.9).translate(2.3, 0, 0).rotateZ(-0.38 - 0.12 * (k % 2)).rotateY(k * Math.PI * 2 / 7).translate(tx, ty, 0), '#ffffff'));
    return g;
  },
  far: () => [blob(3.6, 4.2, 3.6, 0, 5, 0)], // past 4 km: a crown, no trunk
};
const treeGeo = (kind, v = 0) => mergeGeometries((TREES[kind] || TREES.pine)(rng(31 + v * 101 + kind.length * 7)).map(strip));
// the trees sway a little in the wind, the crown more than the trunk, each on its own beat (uCsT: the race's clock)
const SWAY = `
#ifdef USE_INSTANCING
  { vec3 ip = instanceMatrix[3].xyz; float k = max(transformed.y - 2.5, 0.0) / 8.0, ph = ip.x * 0.071 + ip.z * 0.053;
    transformed.xz += vec2(sin(uCsT * 1.6 + ph), cos(uCsT * 1.3 + ph * 1.7)) * 0.16 * k * k * (0.6 + 0.4 * sin(uCsT * 0.37 + ph * 0.3)); }
#endif
#include <project_vertex>`;
// how likely a tree is to stand, by what the map says is there (where it says nothing, the venue's woods decide)
const TREE_P = { forest: 1, scrub: 0.3, grass: 0.05, farmland: 0.025, orchard: 0.5, town: 0.08, industry: 0.01, sand: 0.015, rock: 0.02, wetland: 0.15, water: 0, mud: 0, paved: 0 };
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
  // In a wood the trees stand shoulder to shoulder and their trunks are hidden: round the race area the canopy's
  // roof is drawn at its height (LIFT_VS) and hides them; past it, where the roof is drawn on the ground itself
  // (GROUND_GLSL's canopy()), a tree in a wood is sunk to where its crown meets that roof, a bump in it (and in a
  // ridge's outline) rather than a lollipop on a bare stalk. By how much, metres, for each kind:
  const SINK = { pine: 5.4, stone: 7.6, broad: 3, conifer: 2.2, eucalypt: 7.5, olive: 1.2 };
  const put = (k, x, y, z, s, sink = 0) => {
    o.position.set(x, y - 0.6 - sink * s, z); o.rotation.set(0, r() * 6.28, 0); o.scale.set(s, s * (0.85 + r() * 0.35), s); o.updateMatrix();
    const v = Math.floor(r() * 3), key = k.kind + ':' + v + ':' + Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    if (!tiles.has(key)) tiles.set(key, { k, v, list: [] });
    tiles.get(key).list.push([o.matrix.clone(), c.copy(k.dark).lerp(k.light, r() * 0.7).multiplyScalar(0.9 + r() * 0.2).clone()]);
  };
  // first the trees the map has one by one (blender/venues.py, `trees`): its rows along the streets and promenades
  // and its single trees, each a palm, a conifer or a broad-leaved one as it says; they come first in their tiles, so
  // the lower graphics levels keep them
  if (!far && P.tk) {
    const palmK = palm || { kind: 'palm', share: 1, dark: C(GR.forest[0]), light: C(GR.forest[1]) };
    for (let i = 0; i < P.tk.length; i++) {
      const x = P.txz[i * 2] / 2, z = P.txz[i * 2 + 1] / 2, y = groundAt(x, z);
      if (y < 0.3) continue;
      put(P.tk[i] === 1 ? palmK : pickFrom(sorts[P.tk[i] === 2 ? 1 : 2]), x, y, z, 0.8 + r() * 0.35);
    }
  }
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
    // (fewer in the hollows, where the canopy's roof hides them, and so more over the ridges and the spurs, where they
    // stand against the sky one by one, as the wood thins there: GROUND_GLSL's ridgeThin)
    if (!far && convexAt(x, z) < -0.06 && r() < 0.4) continue;
    let k = kinds[0];
    if (far) k = farKind;
    else if (cl === CLS.scrub && shrub) k = shrub;
    else if (cl === CLS.sand) { if (!palm) continue; k = palm; }
    else if (cl === CLS.forest && (coverCell(x, z) >> 4) === 1) k = pickFrom(sorts[1]);
    else if (cl === CLS.forest && (coverCell(x, z) >> 4) === 2) k = pickFrom(sorts[2]);
    else k = pickFrom(kinds);
    // (sunk as far as the canopy isn't drawn raised there: terrain()'s share for the mesh's squares, round the race area)
    const lv = levelAt(x, z), inNear = Math.max(Math.abs(x - NEAR.x0 - NEAR.n * NEAR.cell / 2), Math.abs(z - NEAR.x0 - NEAR.n * NEAR.cell / 2)) < NEAR.n * NEAR.cell * 0.44;
    const lifted = inNear ? liftShare(lv) : 0;
    const inWood = !far && (cl === CLS.forest || (p < 0 && woodAt(x, z) >= WOOD + 0.02 && townness(x, z) <= 0));
    // (a stand's trees of an age: some stands taller than others, as well as each tree its own height)
    put(k, x, y, z, (0.75 + r() * 0.65 - Math.min(0.3, y / (TOP * 3))) * (0.8 + 0.4 * vnoise(x / 160, z / 160)) * (cl === CLS.scrub && !shrub ? 0.6 : 1), inWood ? (SINK[k.kind] || 0) * (0.75 + 0.35 * r()) * (1 - lifted) : 0);
    n++;
  }
  const geos = {}, mat = landMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 1, { key: 'trees', vsHead: 'uniform float uCsT;', project: SWAY }), g = new THREE.Group();
  for (const { k, v, list } of tiles.values()) {
    const gk = k.kind === 'far' ? 'far' : k.kind + v;
    const m = new THREE.InstancedMesh(geos[gk] || (geos[gk] = treeGeo(k.kind, v)), mat, list.length);
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
    out.push({ r, h: P.bh[b] / 10, roof: P.broof[b], wc: mapColour(P.bwall, b, 0.45), rc: mapColour(P.broofc, b, 0.35) });
  }
  return out;
}
// a building's colour as the map has it (a file baked before it had them: none), toned down to paint: the map's
// colours are names ("aquamarine" for the Winter Palace's green), brighter than any stucco or iron
const HSL = {};
function mapColour(a, b, sat) {
  if (!a || !(a[b * 3] | a[b * 3 + 1] | a[b * 3 + 2])) return null;
  const c = new THREE.Color().setRGB(a[b * 3] / 255, a[b * 3 + 1] / 255, a[b * 3 + 2] / 255, THREE.SRGBColorSpace).getHSL(HSL, THREE.SRGBColorSpace);
  return '#' + new THREE.Color().setHSL(c.h, Math.min(c.s, sat), Math.min(Math.max(c.l, 0.3), 0.82), THREE.SRGBColorSpace).getHexString();
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
  const R = rect(b.r), out = [], stone = b.wc || (mosque ? '#e6dfcf' : '#d3c8b2'), roof = b.rc || (mosque ? '#8a9298' : '#6e5a4e'); // (the map's, where it has them)
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
const TAKEN = new Set(); // the ground the town's buildings stand on, and round them, in 9 m cells (town(), liftMask())
function town() {
  const r = rng(17), taken = TAKEN, key = (x, z) => `${Math.round(x / 9)},${Math.round(z / 9)}`;
  const tiles = new Map(), tile = (x, z) => { const k = Math.floor(x / TILE) + ',' + Math.floor(z / TILE); if (!tiles.has(k)) tiles.set(k, { parts: [], houses: new Batch() }); return tiles.get(k); };
  let parts = null;
  const mark = (x, z, rad) => { for (let dx = -rad; dx <= rad; dx += 9) for (let dz = -rad; dz <= rad; dz += 9) taken.add(key(x + dx, z + dz)); };
  // the landmarks' ground (their `clear`, 30 m round them when not given): no house made up on it
  for (const L of META.landmarks || []) for (const [x, z, rad] of Array.isArray(L.clear) ? L.clear : L.at ? [[L.at[0], L.at[1], L.clear || 30]] : []) mark(x, z, rad);
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
    if (h >= TALL) { const t0 = TOWERS[Math.floor(r() * TOWERS.length)]; parts.push(kinded(paint(g, b.wc || t0, b.rc || '#8a8e90'), 1 + seed)); continue; }
    // its colours: the map's, where it has them, else the venue's (drawn either way, so the others keep theirs)
    const w0 = WALLS[Math.floor(r() * WALLS.length)], r0 = ROOFS[Math.floor(r() * ROOFS.length)], wall = b.wc || w0, roof = b.rc || r0;
    // a pitched roof where the map says so, or on a house-sized one most of the venue's are pitched on: hipped on the
    // footprint's rectangle, where it fills most of it; else up to a point over the footprint, where it's near enough
    // convex; else flat
    const pitched = b.roof !== 1 && h < 16 && area < 900 && (b.roof === 2 || r() >= FLAT);
    const R = pitched ? rect(b.r) : null;
    if (R && area > R.area * 0.78) parts.push(kinded(paint(g, wall, roof), seed), kinded(hipRoof(R, yb + h, roof), seed));
    else if (pitched && b.r.length <= 12 && area < 600 && area > hullArea(b.r) * 0.92) parts.push(kinded(paint(g, wall, roof), seed), kinded(pyramidRoof(b.r, yb + h, Math.min(4, 0.28 * Math.sqrt(area)), roof), seed));
    else parts.push(kinded(paint(g, wall, pitched || r() >= FLAT || b.rc ? roof : '#ddd6c8'), seed));
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

// ---------- the boats ----------
// Each drawn as a builder draws her: bow towards −z, the transom at the origin, the waterline at y = 0. The hull is
// lofted: stations from the transom (t = 0) to the stem (t = 1), each a section from the deck edge down the topsides,
// flaring out a little above the water, and round the bilge (or over a hard chine) to the keel; the deck edge rising
// forward with the sheer; the bottom sweeping up into a raked stem forward and into the transom aft. Its faces take
// their colours by height (the topsides, the boot stripe along the waterline, the antifouling under it) and by what
// they are: the deck, the bulwark's inside and its rail, the transom. What stands on deck is built of frustums (a cabin
// is its plan at its foot and a smaller one at its top, so its sides lean in and its windscreen rakes), spars, and the
// rigging as lines. Each kind comes twice: as she is, for near the camera, and as a handful of faces for further off.
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// faces with their colours, each turned outwards from a point inside the solid (ref); the normals given, or flat
function shell() {
  const pos = [], nrm = [], col = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), cache = new Map();
  const colour = (h) => { if (!cache.has(h)) cache.set(h, C(h)); return cache.get(h); };
  return {
    tri(a, b, c, h, ref, na, nb, nc) {
      e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); n.crossVectors(e1, e2);
      if (n.lengthSq() < 1e-10) return;
      const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
      if (n.x * mx + n.y * my + n.z * mz < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; n.negate(); }
      n.normalize(); const k = colour(h);
      for (const [p, q] of [[a, na], [b, nb], [c, nc]]) { pos.push(p[0], p[1], p[2]); if (q) nrm.push(q[0], q[1], q[2]); else nrm.push(n.x, n.y, n.z); col.push(k.r, k.g, k.b); }
    },
    quad(a, b, c, d, h, ref) { this.tri(a, b, c, h, ref); this.tri(a, c, d, h, ref); },
    add(g, h) { // a three.js geometry, in one colour
      g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
      const P = g.attributes.position.array, N = g.attributes.normal.array, k = colour(h);
      for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nrm.push(N[i], N[i + 1], N[i + 2]); col.push(k.r, k.g, k.b); }
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return g;
    },
  };
}
// The hull, into the shell s. L on deck, B her beam, F the deck's height at the transom; sheer how much higher it is at
// the stem (aft: how much it rises again aft, a gulet's); D how deep her body is under the water; tr the transom's width
// over the beam, full how full the bow is; stemLen of her length the stem sweeps up over, stemExp how plumb it is (high,
// plumb; low, a long raked curve); tb the transom's foot over the water; rake how far its foot is forward of its top
// for each metre of it (less than 0, a modern reverse transom); flare how much wider the deck is than the waterline;
// hard a motor boat's hard chine; bulwark how high the topsides stand above the deck; bands the heights a colour changes
// at along the topsides (paint: [y0, y1, t0, t1, colour], a hull's windows, a stripe). Returns her lines, for what
// stands on her: half(t), deck(t) (where the deck is, under any bulwark) and z(t).
function loftHull(s, h) {
  const { L, B, F, sheer = 0.4, aft = 0, D = 0.5, tr = 0.8, full = 0.85, stemLen = 0.15, stemExp = 2.5, tb = 0.05, rake = 0, flare = 0.06,
    hard = false, N = 16, bulwark = 0, paint: pnt = [], col } = h;
  const K = h.K ?? (hard ? 1 : 5), BOOT = 0.14, CH = -0.06; // the boot stripe's top; the topsides' foot, just under the water
  const half = (t) => (B / 2) * (t < 0.42 ? tr + (1 - tr) * Math.sin((t / 0.42) * Math.PI / 2) : Math.pow(Math.max(0, Math.cos(((t - 0.42) / 0.58) * Math.PI / 2)), full));
  const yd = (t) => F + sheer * t * t + aft * (1 - t) * (1 - t);
  const yb = (t) => (t > 1 - stemLen ? -D + (yd(1) + D) * Math.pow((t - 1 + stemLen) / stemLen, stemExp) : tb + (-D - tb) * smooth01(0, 0.28, t));
  const z = (t) => -t * L;
  const bands = [...new Set([...(h.bands || []), ...pnt.flatMap((p) => [p[0], p[1]]), BOOT])].sort((a, b) => b - a);
  const T = (i) => 1 - Math.pow(1 - i / N, 1.5); // (the stations closer together forward, where the bottom sweeps up into the stem)
  // the stations, and each one's section as a ring from the port deck edge round under the keel to the starboard one
  const rows = [];
  for (let i = 0; i <= N; i++) {
    const t = T(i), hd = half(t), d = yd(t), b = Math.min(yb(t), d), hc = hd * (1 - flare), yc = Math.min(d, Math.max(b, CH));
    const pts = [[hd, d]];
    for (const y of bands) { const yy = Math.min(d, Math.max(yc, y)); pts.push([hd + (hc - hd) * ((d - yy) / Math.max(1e-6, d - yc)), yy]); }
    pts.push([hc, yc]);
    for (let k = 1; k <= K; k++) { const a = (k / K) * Math.PI / 2; pts.push([hc * Math.cos(a), yc - (yc - b) * (hard ? k / K : Math.sin(a))]); }
    const zz = (y) => z(t) + (i === 0 ? -rake * (d - y) : 0);
    rows.push([...pts.map(([x, y]) => [-x, y, zz(y)]), ...pts.slice(0, -1).reverse().map(([x, y]) => [x, y, zz(y)])]);
  }
  const R = rows[0].length, inside = (p) => [0, Math.min(F * 0.4, (yd(-p[2] / L) + yb(-p[2] / L)) / 2), p[2]];
  const face = (p) => { // a face's colour by where it is
    const t = -p[2] / L;
    for (const [y0, y1, t0, t1, c] of pnt) if (p[1] > y0 && p[1] < y1 && t > t0 && t < t1) return c;
    return p[1] < CH + 0.01 ? col.bottom : p[1] < BOOT ? col.boot : col.top;
  };
  const mid = (a, b, c) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  // the topsides and the bottom, shaded round (each corner's normal the average of its faces')
  const acc = rows.map((r) => r.map(() => [0, 0, 0])), quads = [];
  const nrm = (a, b, c, ref) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], m = mid(a, b, c);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * (m[0] - ref[0]) + n[1] * (m[1] - ref[1]) + n[2] * (m[2] - ref[2]) < 0) n = n.map((q) => -q);
    return n; };
  for (let i = 0; i < N; i++) for (let j = 0; j < R - 1; j++) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][j + 1], d = rows[i][j + 1], ref = inside(mid(a, b, c));
    const n1 = nrm(a, b, c, ref), n2 = nrm(a, c, d, ref);
    for (const [ii, jj, n] of [[i, j, n1], [i + 1, j, n1], [i + 1, j + 1, n1], [i, j, n2], [i + 1, j + 1, n2], [i, j + 1, n2]]) { const q = acc[ii][jj]; q[0] += n[0]; q[1] += n[1]; q[2] += n[2]; }
    quads.push([i, j, ref]);
  }
  const unit = (q) => { const l = Math.hypot(q[0], q[1], q[2]) || 1; return [q[0] / l, q[1] / l, q[2] / l]; };
  // a face cut along the waterline's colours (the antifouling's top and the boot stripe's), each piece in its own: where
  // the bottom sweeps up into the stem a face may run from under the water to well above it
  const cuts = [CH, BOOT], lerp = (p, q, f) => p && q ? p.map((v, k) => v + (q[k] - v) * f) : null;
  const banded = (a, b, c, na, nb, nc, ref, k = 0) => {
    if (k === cuts.length) { s.tri(a, b, c, face(mid(a, b, c)), ref, na, nb, nc); return; }
    const y = cuts[k], v = [[a, na], [b, nb], [c, nc]], up = v.filter(([p]) => p[1] > y), dn = v.filter(([p]) => p[1] <= y);
    if (!up.length || !dn.length) { banded(a, b, c, na, nb, nc, ref, k + 1); return; }
    const [one, two] = up.length === 1 ? [up, dn] : [dn, up], [[p, np]] = one, [[q, nq], [r, nr]] = two;
    const fq = (y - p[1]) / (q[1] - p[1]), fr = (y - p[1]) / (r[1] - p[1]), pq = lerp(p, q, fq), pr = lerp(p, r, fr), npq = lerp(np, nq, fq), npr = lerp(np, nr, fr);
    banded(p, pq, pr, np, npq, npr, ref, k + 1); banded(pq, q, r, npq, nq, nr, ref, k + 1); banded(pq, r, pr, npq, nr, npr, ref, k + 1);
  };
  for (const [i, j, ref] of quads) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][j + 1], d = rows[i][j + 1];
    banded(a, b, c, unit(acc[i][j]), unit(acc[i + 1][j]), unit(acc[i + 1][j + 1]), ref);
    banded(a, c, d, unit(acc[i][j]), unit(acc[i + 1][j + 1]), unit(acc[i][j + 1]), ref);
  }
  // the transom: its ring, across
  const r0 = rows[0], cT = r0.reduce((m, p) => [m[0] + p[0] / R, m[1] + p[1] / R, m[2] + p[2] / R], [0, 0, 0]);
  for (let j = 0; j < R - 1; j++) banded(cT, r0[j], r0[j + 1], null, null, null, [0, cT[1], cT[2] - 1]);
  // the deck, inside the bulwark (its inner face and its rail) or along the deck edge
  const th = bulwark ? 0.14 : 0, deck = (t) => yd(t) - bulwark;
  for (let i = 0; i < N; i++) {
    const t0 = T(i), t1 = T(i + 1), w0 = Math.max(0, half(t0) - th), w1 = Math.max(0, half(t1) - th);
    const P0 = [-w0, deck(t0), z(t0)], S0 = [w0, deck(t0), z(t0)], P1 = [-w1, deck(t1), z(t1)], S1 = [w1, deck(t1), z(t1)];
    s.quad(P0, S0, S1, P1, col.deck, [0, deck(t0) - 1, z(t0)]);
    if (!bulwark) continue;
    for (const sd of [-1, 1]) {
      const o0 = [sd * half(t0), yd(t0), z(t0)], o1 = [sd * half(t1), yd(t1), z(t1)], i0 = [sd * w0, yd(t0), z(t0)], i1 = [sd * w1, yd(t1), z(t1)];
      s.quad(o0, o1, i1, i0, col.rail, [sd * w0, yd(t0) - 1, z(t0)]);
      s.quad(i0, i1, [sd * w1, deck(t1), z(t1)], [sd * w0, deck(t0), z(t0)], col.inside, [sd * (w0 + 1), deck(t0), z(t0)]);
    }
  }
  return { half, deck, z, yd, yb };
}
// a frustum: a plan [[x, z], …] at y0 and a smaller one (as many corners) at y1, its sides in a colour, its top in another
function frustum(s, base, top, y0, y1, h, cap) {
  const n = base.length, cx = base.reduce((m, p) => m + p[0] / n, 0), cz = base.reduce((m, p) => m + p[1] / n, 0), ref = [cx, (y0 + y1) / 2, cz];
  for (let k = 0; k < n; k++) { const a = base[k], b = base[(k + 1) % n], c = top[(k + 1) % n], d = top[k]; s.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y1, c[1]], [d[0], y1, d[1]], h, ref); }
  if (!cap) return;
  const tx = top.reduce((m, p) => m + p[0] / n, 0), tz = top.reduce((m, p) => m + p[1] / n, 0);
  for (let k = 0; k < n; k++) { const a = top[k], b = top[(k + 1) % n]; s.tri([tx, y1, tz], [a[0], y1, a[1]], [b[0], y1, b[1]], cap, [tx, y1 - 1, tz]); }
}
// a cabin's plan, from z0 aft to z1 forward (z1 < z0), half as wide as w0 aft and w1 forward, its forward corners
// rounded over r
function plan(z0, z1, w0, w1, r = 0) {
  const p = [[w0, z0]];
  if (r > 0) for (let k = 0; k <= 3; k++) { const a = (k / 3) * Math.PI / 2; p.push([w1 - r + r * Math.cos(a), z1 + r - r * Math.sin(a)]); }
  else p.push([w1, z1]);
  return [...p, ...p.map(([x, zz]) => [-x, zz]).reverse()];
}
// a spar from p to q, r0 thick at p, r1 at q
function spar(s, p, q, r0, r1, h, seg = 6) {
  const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), l = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, l, seg, 1, true).translate(0, l / 2, 0); // (open ended: its ends are never seen)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(p[0], p[1], p[2]);
  s.add(g, h);
}
const box = (s, x, y, z, w, hh, l, h) => s.add(new THREE.BoxGeometry(w, hh, l).translate(x, y, z), h);
// a keel, a rudder: a foil from its root (zAft, zFwd at y0) to its tip (at y1), th thick
function foil(s, ra, rf, y0, ta, tf, y1, th, h) {
  const g = new THREE.BoxGeometry(1, 1, 1), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const top = P.getY(i) > 0, aftEnd = P.getZ(i) > 0, x = P.getX(i) * th * (top ? 1 : 0.6);
    P.setXYZ(i, x, top ? y0 : y1, top ? (aftEnd ? ra : rf) : aftEnd ? ta : tf);
  }
  s.add(g, h);
}
// the lines along a path (a polyline), into a list of segments
const path = (out, ...pts) => { for (let i = 0; i + 1 < pts.length; i++) out.push(...pts[i], ...pts[i + 1]); };
// the guardrails: stanchions at the given stations, a wire at their tops and one halfway, a pulpit round the bow
function rails(out, H, ts, ht, inset = 0.08) {
  for (const sd of [-1, 1]) {
    const at = ts.map((t) => [sd * (H.half(t) - inset), H.deck(t), H.z(t)]);
    for (const p of at) path(out, p, [p[0], p[1] + ht, p[2]]);
    path(out, ...at.map((p) => [p[0], p[1] + ht, p[2]])); path(out, ...at.map((p) => [p[0], p[1] + ht / 2, p[2]]));
  }
  const tb = ts[ts.length - 1], tp = 0.985; // the pulpit
  path(out, [-(H.half(tb) - inset), H.deck(tb) + ht, H.z(tb)], [0, H.deck(tp) + ht, H.z(tp)], [H.half(tb) - inset, H.deck(tb) + ht, H.z(tb)]);
}
// her lines to the quay astern (stern-to) and her lazy line forward, down into the water
function moored(out, H, L, sternW) {
  for (const sd of [-1, 1]) path(out, [sd * sternW, H.deck(0) + 0.15, 0.05], [sd * (sternW + 0.4), 0.75, 1.35]);
  path(out, [0, H.deck(1) + 0.1, -L], [0, -0.5, -L - 5]);
}

// a sailing yacht of some 13 m, as a charter fleet's are: a wide transom, a plumb bow, the coachroof and its windows,
// the sprayhood and the bimini, a fin keel and a spade rudder; her mast deck-stepped, two spreaders, the main furled on
// the boom under its cover and the genoa rolled on the forestay
function sailYacht(top = '#f7f7f4', far = false) {
  const L = 13, B = 4.1, s = shell(), lines = [];
  const H = loftHull(s, { L, B, F: 1.15, sheer: 0.32, D: 0.6, tr: 0.86, full: 0.78, stemLen: 0.08, stemExp: 3.5, tb: 0.1, rake: -0.12, flare: 0.05,
    N: far ? 6 : 12, K: far ? 1 : 3, col: { top, boot: '#22344a', bottom: '#2a2f38', deck: '#ebe5d7' } });
  const z = H.z, cr = H.deck(0.46), roof = cr + 0.55, mz = z(0.6);
  // the coachroof: its foot, its band of windows, its roof
  const p0 = plan(z(0.3), z(0.64), 1.32, 1.0, 0.55), inset = (p, dx, dzf) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz < z(0.47) ? zz + dzf : zz]);
  if (far) frustum(s, p0, inset(p0, 0.2, 0.5), cr, roof, '#f3f1ea', '#f1eee6');
  else {
    frustum(s, p0, inset(p0, 0.04, 0.12), cr, cr + 0.16, '#f3f1ea');
    frustum(s, inset(p0, 0.04, 0.12), inset(p0, 0.16, 0.4), cr + 0.16, cr + 0.42, '#1e2a34');
    frustum(s, inset(p0, 0.16, 0.4), inset(p0, 0.2, 0.5), cr + 0.42, roof, '#f3f1ea', '#f1eee6');
    // the cockpit: its teak, its coamings, the wheel; the sprayhood over the companionway and the bimini over the helm
    frustum(s, plan(z(0.03), z(0.3), 1.25, 1.3), plan(z(0.03), z(0.3), 1.25, 1.3), H.deck(0.15), H.deck(0.15) + 0.03, '#a97c4f', '#a97c4f');
    for (const sd of [-1, 1]) box(s, sd * 1.3, H.deck(0.17) + 0.18, (z(0.06) + z(0.3)) / 2, 0.08, 0.36, z(0.06) - z(0.3), '#f3f1ea');
    const wy = H.deck(0.06) + 0.75; s.add(new THREE.TorusGeometry(0.52, 0.03, 3, 10).translate(0, wy, z(0.07)), '#2b2f33');
    spar(s, [0, wy - 0.7, z(0.075)], [0, wy, z(0.075)], 0.06, 0.05, '#c9ced2', 5);
    frustum(s, plan(z(0.25), z(0.31), 1.15, 1.15), plan(z(0.26), z(0.295), 1.0, 1.0), roof - 0.05, roof + 0.62, '#2a3b52', '#2a3b52');
    box(s, 0, roof + 0.58, (z(0.07) + z(0.24)) / 2, 2.5, 0.06, z(0.07) - z(0.24), '#2f3e52');
    for (const sd of [-1, 1]) for (const t of [0.07, 0.24]) path(lines, [sd * 1.2, H.deck(t), z(t)], [sd * 1.2, roof + 0.56, z(t)]);
    // under the water: the fin keel with its bulb, and the rudder
    foil(s, z(0.42), z(0.55), H.yb(0.48) + 0.1, z(0.45), z(0.53), -2.05, 0.2, '#2a2f38');
    box(s, 0, -2.05, z(0.49), 0.42, 0.32, 1.9, '#2a2f38');
    foil(s, z(0.07), z(0.115), H.yb(0.09) + 0.1, z(0.075), z(0.105), -1.55, 0.09, '#2a2f38');
    // the swim platform let down off the transom
    box(s, 0, 0.42, 0.45, 1.9, 0.07, 0.85, '#a97c4f');
  }
  // the rig: the mast, the spreaders, the boom with the main under its cover, the genoa furled on the forestay
  const mh = 18.6, sw = 0.28;
  spar(s, [0, roof, mz], [0, mh, mz], far ? 0.12 : 0.11, 0.06, '#d3d7da', far ? 4 : 6);
  spar(s, [0, roof + 1.05, mz + 0.15], [0, roof + 1.15, z(0.24)], 0.08, 0.07, '#d3d7da', far ? 4 : 6);
  box(s, 0, roof + 1.42, (mz + z(0.25)) / 2 + 0.1, 0.36, 0.5, mz - z(0.25) - 0.3, '#2a3b52');
  if (!far) {
    for (const [y, w] of [[7.6, 1.32], [13.2, 0.95]]) for (const sd of [-1, 1]) spar(s, [0, y, mz], [sd * w, y + 0.05, mz + sw], 0.045, 0.03, '#d3d7da', 4);
    spar(s, [0, H.deck(1) + 0.35, z(0.985)], [0, mh - 0.9, mz - 0.05], 0.085, 0.035, '#34475f', 5);
    // the standing rigging: forestay, the split backstay, the cap shrouds over the spreaders, the lowers
    path(lines, [0, mh, mz], [0, H.deck(1) + 0.12, z(0.995)]);
    for (const sd of [-1, 1]) {
      path(lines, [0, mh, mz], [0, 6.5, -0.4], [sd * 0.75, H.deck(0) + 0.1, 0.0]);
      const cp = [sd * (H.half(0.6) - 0.12), H.deck(0.6), mz + 0.25];
      path(lines, [0, mh - 0.6, mz], [sd * 0.95, 13.25, mz + sw], [sd * 1.32, 7.65, mz + sw], cp);
      path(lines, [0, 7.6, mz], [sd * (H.half(0.62) - 0.12), H.deck(0.62), z(0.66)]);
      path(lines, [0, 7.6, mz], [sd * (H.half(0.56) - 0.12), H.deck(0.56), z(0.53)]);
    }
    rails(lines, H, [0.04, 0.17, 0.3, 0.44, 0.58, 0.72, 0.86], 0.62);
    for (const sd of [-1, 1]) path(lines, [sd * (H.half(0.04) - 0.08), H.deck(0.04) + 0.62, z(0.04)], [sd * 0.6, H.deck(0) + 0.7, z(0.01)]);
    moored(lines, H, L, 1.6);
  }
  return { geo: strip(s.geo()), lines };
}
// a flybridge motor yacht of some 15 m: a deep V with a hard chine and a raked, flared bow, her hull windows, the swim
// platform, the saloon with its raked windscreen, the flybridge under its hardtop
function motorYacht(top = '#fbfbf9', far = false) {
  const L = 15, B = 4.6, s = shell(), lines = [];
  const H = loftHull(s, { L, B, F: 1.75, sheer: 0.55, D: 0.85, tr: 0.93, full: 0.72, stemLen: 0.24, stemExp: 1.7, tb: 0.12, flare: 0.1, hard: true, bulwark: far ? 0 : 0.25,
    N: far ? 6 : 12, paint: far ? [] : [[0.95, 1.28, 0.42, 0.68, '#1b2731']], col: { top, boot: '#1c2630', bottom: '#2c3a46', deck: '#e8e2d4', inside: '#f4f2ec', rail: '#f4f2ec' } });
  const z = H.z, d0 = H.deck(0.38), white = '#f6f6f3', glass = '#1b2731';
  const sal = plan(z(0.08), z(0.66), 1.95, 1.55, 0.7), ins = (p, dx, front, back = 0) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz < z(0.4) ? zz + front : zz - back]);
  if (far) { frustum(s, sal, ins(sal, 0.15, 1.6), d0, d0 + 1.5, white, white); frustum(s, ins(sal, 0.35, 2.5, 1.2), ins(sal, 0.45, 2.8, 1.2), d0 + 1.5, d0 + 2.1, white, white); }
  else {
    frustum(s, sal, ins(sal, 0.03, 0.25), d0, d0 + 0.42, white);
    frustum(s, ins(sal, 0.03, 0.25), ins(sal, 0.12, 1.55), d0 + 0.42, d0 + 1.38, glass); // the saloon's glass, its windscreen raked
    frustum(s, ins(sal, 0.12, 1.55), ins(sal, 0.1, 1.6), d0 + 1.38, d0 + 1.52, white, white);
    // the flybridge: its coaming, its helm, the hardtop on its posts, the radar on its arch
    const fb = plan(z(0.14), z(0.52), 1.55, 1.35, 0.6), fy = d0 + 1.52;
    frustum(s, fb, ins(fb, 0.06, 0.1), fy, fy + 0.62, white, '#e4ded2');
    box(s, 0, fy + 0.95, z(0.47), 1.3, 0.7, 0.8, white);
    box(s, 0, fy + 1.2, z(0.475), 1.2, 0.25, 0.4, glass);
    box(s, 0, fy + 2.25, (z(0.18) + z(0.44)) / 2, 2.9, 0.1, z(0.18) - z(0.44), white);
    for (const sd of [-1, 1]) for (const t of [0.19, 0.43]) box(s, sd * 1.32, fy + 1.4, z(t), 0.07, 1.6, 0.07, '#d9dcdf');
    spar(s, [0, fy + 2.3, z(0.36)], [0, fy + 3.3, z(0.38)], 0.05, 0.04, '#d9dcdf', 4);
    s.add(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10).translate(0, fy + 2.45, z(0.25)), white); // the radome
    // the foredeck's sunpad, the swim platform, the bow rail
    box(s, 0, H.deck(0.76) + 0.12, z(0.76), 2.0, 0.22, 1.9, '#e9e1cf');
    box(s, 0, 0.38, 0.6, B * 0.86, 0.12, 1.2, '#a97c4f');
    rails(lines, H, [0.68, 0.78, 0.88, 0.95], 0.55, 0.12);
    foil(s, z(0.12), z(0.2), -0.6, z(0.13), z(0.19), -1.05, 0.06, '#2c3a46');
    moored(lines, H, L, 1.8);
  }
  return { geo: strip(s.geo()), lines };
}
// a Turkish gulet of some 25 m: a varnished (or white) wooden hull with a strong sheer, its counter stern and its long
// raked stem with the bowsprit off it, high bulwarks with a varnished rail; the deckhouse and the wheelhouse, the aft
// deck under its awning; two masts, their sails furled on the booms
function gulet(varnish = true, far = false, flag = false) {
  const L = 25, B = 6.4, s = shell(), lines = [], wood = '#7a4a2a', spars = '#8a6440', cream = '#ece4d2';
  const H = loftHull(s, { L, B, F: 1.75, sheer: 1.1, aft: 0.25, D: 1.4, tr: 0.62, full: 0.95, stemLen: 0.3, stemExp: 1.8, tb: 0.7, rake: 0.42, flare: 0.04,
    bulwark: far ? 0 : 0.7, N: far ? 6 : 14, K: far ? 1 : 3,
    col: { top: varnish ? '#5e3520' : '#f3f0e8', boot: varnish ? '#f2ede2' : '#2a4d7a', bottom: '#7d2b22', deck: '#b58958', inside: '#f1ece2', rail: wood } });
  const z = H.z, dh = H.deck(0.5), house = varnish ? wood : '#f4efe4';
  const p0 = plan(z(0.34), z(0.64), 1.95, 1.7, 0.6), ins = (p, dx, front) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz < z(0.5) ? zz + front : zz]);
  frustum(s, p0, ins(p0, 0.03, 0.03), dh, dh + 0.5, house);
  frustum(s, ins(p0, 0.03, 0.03), ins(p0, 0.05, 0.05), dh + 0.5, dh + 0.9, far ? house : '#1e2a34');
  frustum(s, ins(p0, 0.05, 0.05), ins(p0, 0.02, 0), dh + 0.9, dh + 1.05, house, cream);
  const wh = plan(z(0.35), z(0.43), 1.15, 1.1, 0.2);
  frustum(s, wh, ins(wh, 0.04, 0.05), dh + 1.05, dh + 1.5, house);
  frustum(s, ins(wh, 0.04, 0.05), ins(wh, 0.06, 0.08), dh + 1.5, dh + 1.95, far ? house : '#1e2a34');
  frustum(s, ins(wh, 0.06, 0.08), ins(wh, 0.02, 0), dh + 1.95, dh + 2.08, house, cream);
  // the awning over the aft deck, on its posts
  const aw = H.deck(0.1) + 2.25;
  box(s, 0, aw, (z(0.01) + z(0.32)) / 2, B * 0.86, 0.08, z(0.01) - z(0.32), cream);
  // the masts, the booms with the sails furled on them under their covers, the bowsprit
  const mm = z(0.74), mi = z(0.5), mt = dh + 17.5, it = dh + 12.5, bow = [0, H.yd(1) - 0.15, z(1)], bs = [0, H.yd(1) + 0.75, z(1) - 4.4];
  spar(s, [0, H.deck(0.74), mm], [0, mt, mm], 0.2, 0.1, spars, far ? 4 : 7);
  spar(s, [0, dh + 1.05, mi], [0, it, mi], 0.16, 0.08, spars, far ? 4 : 7);
  spar(s, bow, bs, 0.15, 0.09, spars, far ? 4 : 6);
  box(s, 0, H.deck(0.74) + 2.3, (mm + z(0.47)) / 2, 0.5, 0.55, mm - z(0.47), cream);
  box(s, 0, aw + 0.75, (mi + z(0.2)) / 2, 0.42, 0.45, mi - z(0.2), cream);
  if (!far) {
    spar(s, [0, H.deck(0.74) + 1.9, mm + 0.2], [0, H.deck(0.74) + 1.95, z(0.47)], 0.1, 0.09, spars, 6);
    spar(s, [0, aw + 0.4, mi + 0.2], [0, aw + 0.45, z(0.2)], 0.09, 0.08, spars, 6);
    for (const sd of [-1, 1]) for (const t of [0.02, 0.17, 0.31]) path(lines, [sd * (H.half(t) - 0.3), H.deck(t), z(t)], [sd * (H.half(t) - 0.3), aw, z(t)]);
    // the rigging: the forestays to the bowsprit and the stem, its bobstay, the triatic between the mastheads, the
    // mizzen's backstay, the shrouds
    path(lines, [0, mt, mm], bs); path(lines, [0, mt - 3, mm], [0, H.yd(1), z(0.99)]); path(lines, bs, [0, 0.4, z(0.97)]);
    path(lines, [0, mt - 0.5, mm], [0, it, mi]); path(lines, [0, it, mi], [0, H.yd(0) + 0.3, -0.3]);
    for (const sd of [-1, 1]) {
      path(lines, [0, mt - 0.8, mm], [sd * (H.half(0.72) - 0.05), H.yd(0.72), mm + 0.6]); path(lines, [0, mt - 6, mm], [sd * (H.half(0.76) - 0.05), H.yd(0.76), mm - 0.6]);
      path(lines, [0, it - 0.6, mi], [sd * (H.half(0.5) - 0.05), H.yd(0.5), mi + 0.5]);
      for (let k = 0; k < 5; k++) { const t = 0.42 + k * 0.06; path(lines, [sd * (H.half(t) - 0.05), H.yd(t), z(t)], [sd * (H.half(t + 0.06) - 0.05), H.yd(t + 0.06), z(t + 0.06)]); }
    }
    foil(s, z(0.0) - 0.4, z(0.06), H.yb(0.03) + 0.2, z(0.0) - 0.3, z(0.06), -1.3, 0.14, '#7d2b22');
    if (flag) { spar(s, [0, H.yd(0), 0.2], [0, H.yd(0) + 2.0, 0.8], 0.03, 0.02, '#d9d4c8', 4); box(s, 0.0, H.yd(0) + 1.6, 1.25, 0.04, 0.75, 1.1, '#d6201e'); }
    moored(lines, H, L, 2.0);
  }
  return { geo: strip(s.geo()), lines };
}
// a superyacht: some 40 m, three decks of white and dark glass over a sharp, raked hull, her hull windows in a row
function superYacht(far = false) {
  const L = 40, B = 8.4, s = shell(), lines = [], white = '#f6f6f3', glass = '#1b2731';
  const H = loftHull(s, { L, B, F: 2.6, sheer: 0.9, D: 1.7, tr: 0.9, full: 0.68, stemLen: 0.2, stemExp: 1.5, tb: 0.2, rake: -0.18, flare: 0.08, hard: true, bulwark: far ? 0 : 0.9,
    N: far ? 7 : 14, paint: far ? [] : [[1.2, 1.65, 0.36, 0.62, glass]], col: { top: '#fbfbf9', boot: '#1c2630', bottom: '#2c3a46', deck: '#c9a77c', inside: white, rail: '#c9a77c' } });
  const z = H.z, ins = (p, dx, front) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz < z(0.4) ? zz + front : zz]);
  let y = H.deck(0.4);
  for (const [t0, t1, w, rk] of [[0.05, 0.68, 3.6, 2.4], [0.12, 0.6, 3.3, 2.6], [0.24, 0.52, 2.8, 2.2]]) {
    const p = plan(z(t0), z(t1), w, w * 0.84, 1.4);
    if (far) frustum(s, p, ins(p, 0.2, rk), y, y + 2.2, white, white);
    else {
      frustum(s, p, ins(p, 0.02, 0.3), y, y + 0.35, white);
      frustum(s, ins(p, 0.02, 0.3), ins(p, 0.12, rk), y + 0.35, y + 1.95, glass);
      frustum(s, ins(p, 0.12, rk), ins(p, 0.1, rk + 0.1), y + 1.95, y + 2.2, white, white);
    }
    y += 2.2;
  }
  spar(s, [0, y, z(0.4)], [0, y + 3.5, z(0.41)], 0.14, 0.08, '#d9dcdf', far ? 4 : 6);
  if (!far) {
    for (const k of [-1, 1]) s.add(new THREE.SphereGeometry(0.55, 10, 6).translate(k * 1.2, y + 1.4, z(0.36)), white); // her domes
    box(s, 0, 0.45, 0.9, B * 0.8, 0.14, 1.8, '#c9a77c');
    moored(lines, H, L, 2.4);
  }
  return { geo: strip(s.geo()), lines };
}
// what the boatyard and the rest take: the yachts as they are
const sailboatGeo = () => sailYacht().geo, motorGeo = () => motorYacht().geo;
const TINTS = ['#ffffff', '#f4f6f8', '#fbf6ec', '#e8ecef']; // the whole boat is tinted, so only a shade either way
// each kind as she is near and far, in her colours: the yachts mostly white, some dark blue or grey; a gulet varnished
// or white
function variants(kind) {
  const both = (f, ...a) => { const n = f(...a, false), fr = f(...a, true); return { geo: n.geo, far: fr.geo, lines: n.lines.length ? new Float32Array(n.lines) : null }; };
  const turk = ['gocek', 'marmaris', 'fethiye'].includes(VENUE.id);
  if (kind === 'sail') return [[0.78, both(sailYacht, '#f7f7f4')], [0.13, both(sailYacht, '#1f3550')], [0.09, both(sailYacht, '#8d969c')]];
  if (kind === 'motor') return [[0.82, both(motorYacht, '#fbfbf9')], [0.12, both(motorYacht, '#23344c')], [0.06, both(motorYacht, '#5f6a72')]];
  if (kind === 'gulet') return [[0.55, both((f) => gulet(true, f, turk))], [0.45, both((f) => gulet(false, f, turk))]];
  return [[1, both(superYacht)]];
}

// ---------- the marinas ----------

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
    { v: variants('sail'), L: 13, B: 4.1, gap: 4.7, list: [] },
    { v: variants('motor'), L: 15, B: 4.6, gap: 5.2, list: [] },
    superBig ? { v: variants('super'), L: 40, B: 8.4, gap: 10, list: [] } : { v: variants('gulet'), L: 27, B: 6.4, gap: 7.4, list: [] },
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
        let ok = r() < (s.p.kind === 'quay' && VENUE.id !== 'gocek' ? 0.45 : 0.92) && u + gap < l - 1 // a berth or two empty (and half of a quay away from Göcek's, a working one)
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
  // the town quays where the gulets lie stern-to (venues.py `gulets`, the json's moor): one every berth along the shore
  // there, its bow out over the water; a motor yacht now and then, a berth empty here and there
  const gk = superBig ? (kinds[3] = { v: variants('gulet'), L: 27, B: 6.4, gap: 7.4, list: [] }) : kinds[2];
  for (const run of META.moor || []) {
    let u = 0;
    for (let i = 0; i + 1 < run.length; i++) {
      const [ax, az] = run[i], [bx, bz] = run[i + 1], l = Math.hypot(bx - ax, bz - az); if (l < 0.5) continue;
      const tx = (bx - ax) / l, tz = (bz - az) / l;
      for (; u < l; ) {
        const k = r() < 0.85 ? gk : kinds[1], sc = 0.85 + r() * 0.3, L = k.L * sc, gap = k.gap * sc, x = ax + tx * u, z = az + tz * u;
        u += gap;
        if (r() > 0.85) continue;
        for (const side of [1, -1]) { // the side the water is
          const nx = -tz * side, nz = tx * side, sx = x + nx * 2, sz = z + nz * 2, mx = sx + nx * L * 0.5, mz = sz + nz * L * 0.5, bwx = sx + nx * L, bwz = sz + nz * L;
          if (!(groundAt(mx, mz) < -1.5 && groundAt(bwx, bwz) < -1.5) || near(mx, mz, gap * 0.9) || near(bwx, bwz, gap * 0.9)) continue;
          if (segsNear(mx, mz).some((o2) => segDist(mx, mz, o2) < width(o2.p) / 2 + k.B * sc / 2)) continue;
          k.list.push([sx, sz, Math.atan2(-nx, -nz) + (r() - 0.5) * 0.06, sc]); place(mx, mz); place(bwx, bwz); place(sx + nx * L * 0.2, sz + nz * L * 0.2);
          break;
        }
      }
      u -= l;
    }
  }
  // Each kind's boats drawn as a handful of faces each, all of one colour in one batch; and in tiles of 400 m as they are,
  // with their rigging, near the camera (update(): within BOATS_NEAR of the tile's edge), when they leave the batch.
  const o = new THREE.Object3D(), c = new THREE.Color(), v = new THREE.Vector3(), tiles = new Map(), TILE = 400;
  const mat = landMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }), 1);
  const rig = landMat(new THREE.LineBasicMaterial({ color: '#45494d', transparent: true, opacity: 0.6 }), 1, { key: 'rig', unlit: true });
  const tileOf = (x, z) => {
    const key = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
    if (!tiles.has(key)) tiles.set(key, { near: [], far: [], pts: [], isNear: false });
    return tiles.get(key);
  };
  for (const k of kinds) {
    const byVariant = k.v.map(() => []);
    for (const e of k.list) { let u = r() * k.v.reduce((m, q) => m + q[0], 0), vi = 0; while (vi < k.v.length - 1 && (u -= k.v[vi][0]) > 0) vi++; byVariant[vi].push(e); }
    k.v.forEach(([, va], vi) => {
      const its = byVariant[vi]; if (!its.length) return;
      const fm = new THREE.InstancedMesh(va.far, mat, its.length), byTile = new Map();
      its.forEach(([x, z, a, sc], i) => {
        o.position.set(x, 0, z); o.rotation.set(0, a, 0); o.scale.setScalar(sc); o.updateMatrix(); c.set(TINTS[Math.floor(r() * TINTS.length)]);
        fm.setMatrixAt(i, o.matrix); fm.setColorAt(i, c);
        const t = tileOf(x, z); t.far.push([fm, i, o.matrix.clone()]); t.pts.push([x, z]);
        if (!byTile.has(t)) byTile.set(t, []); byTile.get(t).push([o.matrix.clone(), c.clone()]);
      });
      fm.computeBoundingSphere(); group.add(fm);
      for (const [t, list] of byTile) {
        const dm = new THREE.InstancedMesh(va.geo, mat, list.length), n = va.lines ? va.lines.length : 0, seg = n ? new Float32Array(list.length * n) : null;
        list.forEach(([m4, col], i) => {
          dm.setMatrixAt(i, m4); dm.setColorAt(i, col);
          for (let q = 0; q < n; q += 3) { v.set(va.lines[q], va.lines[q + 1], va.lines[q + 2]).applyMatrix4(m4); seg[i * n + q] = v.x; seg[i * n + q + 1] = v.y; seg[i * n + q + 2] = v.z; }
        });
        dm.computeBoundingSphere(); dm.visible = false; t.near.push(dm); group.add(dm);
        if (seg) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(seg, 3)); const ls = new THREE.LineSegments(lg, rig); ls.userData.rig = true; ls.visible = false; t.near.push(ls); group.add(ls); }
      }
    });
  }
  for (const t of tiles.values()) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of t.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    Object.assign(t, { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 + 45 }); delete t.pts;
  }
  group.userData.tiles = [...tiles.values()];
  return group;
}
const BOATS_NEAR = 320; // metres from a tile of moored boats within which they are drawn as they are
const NOWHERE = new THREE.Matrix4().makeScale(0, 0, 0); // (a boat out of her batch)

// ---------- the rocks along the shore ----------
// Where the land meets the sea it is rarely the ground's smooth edge: boulders and rocks lie along it, fallen from the
// cliffs and rolled by the waves, half in the water and half out. Along every cell of the shore (the bake's 8 m grid of
// how far out from it: venues.py `shore`) that isn't a beach, mud, a town's or a port's built edge, a few of them where
// the ground is between 1.5 m under the water and 2.5 m over it; many more on a steep or rocky coast. One rock, lumpy
// and faceted, each its own stretch and turn and its own shade of the venue's rock; darkened by the sea and the weed
// on it up to where the waves run. In tiles of 250 m, drawn only within ROCKS_NEAR of the camera (half of them on the
// middle graphics level, none on the lowest): further off they are
// a few pixels, and the shore's own colours carry them.
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position, v = new THREE.Vector3();
  const lump = (x, y, z) => 1 + 0.22 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - x * 1.1) + 0.12 * Math.sin(y * 5.3 + z * 4.1);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const k = lump(v.x, v.y, v.z); P.setXYZ(i, v.x * k, (v.y < 0 ? v.y * 0.45 : v.y * 0.75) * k, v.z * k); }
  g.computeVertexNormals(); // (each face flat: the icosahedron's corners aren't shared)
  return tint(g, '#ffffff');
}
function shoreRocks() {
  const group = new THREE.Group(), tiles = new Map(), TILE = 250;
  if (!P.shore) { group.userData.tiles = []; return group; }
  const n = NEAR.n, cell = NEAR.cell, x0 = NEAR.x0, S = P.shore, K = P.calm, r = rng(31), rock = (GR.rock || ['#9a917c', '#7b7465']).map(C);
  const skip = new Set([CLS.sand, CLS.town, CLS.paved, CLS.industry, CLS.mud].filter((x) => x !== undefined));
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 1; i < n - 1; i++) for (let j = 1; j < n - 1; j++) {
    const k = i * n + j;
    if (S[k] !== 0 || (S[k + 1] === 0 && S[k - 1] === 0 && S[k + n] === 0 && S[k - n] === 0)) continue; // (ashore, with the sea beside it)
    if (K && K[k] > 128) continue; // a quay, a port's or a town's built shore
    const cx = x0 + (j + 0.5) * cell, cz = x0 + (i + 0.5) * cell;
    if (skip.has(coverAt(cx, cz))) continue;
    // (how rocky: by how steeply the land rises behind the shore, 20 m in; the bake lays the shore itself as a low bank)
    const gc = groundAt(cx, cz), behind = Math.max(groundAt(cx + 20, cz), groundAt(cx - 20, cz), groundAt(cx, cz + 20), groundAt(cx, cz - 20)) - gc;
    const rocky = Math.max(LOOK.coast === 'rock' ? 0.55 : 0.12, Math.min(1, behind / 14)), m = Math.floor(rocky * 12 * r() + rocky * 4);
    for (let q = 0, put = 0; q < m * 2 && put < m; q++) { // (another try where one falls too deep or too high)
      const x = cx + (r() - 0.5) * cell * 1.8, z = cz + (r() - 0.5) * cell * 1.8, gy = groundAt(x, z);
      if (gy < -1.5 || gy > 2.5) continue;
      const big = r(), sz = (0.35 + big * big * 2.6) * (0.6 + 0.7 * rocky);
      o.position.set(x, gy - sz * (0.15 + 0.3 * r()), z); o.rotation.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5);
      o.scale.set(sz * (0.8 + 0.5 * r()), sz * (0.6 + 0.5 * r()), sz * (0.8 + 0.5 * r())); o.updateMatrix();
      c.copy(rock[0]).lerp(rock[1], r()).multiplyScalar(0.62 + 0.32 * r());
      const key = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
      if (!tiles.has(key)) tiles.set(key, { list: [], x: (Math.floor(x / TILE) + 0.5) * TILE, z: (Math.floor(z / TILE) + 0.5) * TILE, r: TILE * 0.71 });
      tiles.get(key).list.push([o.matrix.clone(), c.clone()]); put++;
    }
  }
  const geo = rockGeo(), mat = landMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), 1, {
    key: 'rocks', after: '{ float wy = vLand.y; diffuseColor.rgb *= mix(vec3(0.3, 0.3, 0.24), vec3(1.0), smoothstep(0.0, 0.9, wy)); }', // (wet, and the weed on it, up to where the waves run)
  });
  for (const t of tiles.values()) {
    const m = new THREE.InstancedMesh(geo, mat, t.list.length);
    t.list.forEach(([m4, col], i) => { m.setMatrixAt(i, m4); m.setColorAt(i, col); });
    m.computeBoundingSphere(); m.visible = false; m.userData.max = t.list.length; group.add(m); t.mesh = m; delete t.list;
  }
  group.userData.tiles = [...tiles.values()];
  return group;
}
const ROCKS_NEAR = 400; // metres from a tile of the shore's rocks within which they are drawn

// ---------- the boats that come and go ----------
// The ferries and the water taxis on their ways across the bay (venues.py `routes`, found on the water there, round the
// race area) and the kitesurfers off a beach (`kites`), moved on the race's clock: each boat out and back along its way,
// waiting a while at each end; each kitesurfer across the breeze and back, the kite high downwind of them, swinging.
// All picture: the race knows nothing of them.
function fastFerryGeo() { // a fast catamaran of some 40 m, white, two slim hard-chined hulls under her body, bow towards −z
  const L = 40, B = 11, parts = [];
  for (const sd of [-1, 1]) {
    const s = shell();
    loftHull(s, { L, B: 2.8, F: 2.4, sheer: 0.5, D: 1.2, tr: 0.92, full: 0.55, stemLen: 0.1, stemExp: 3, tb: 0.35, hard: true, N: 12, col: { top: '#f4f4f1', boot: '#1e5a9c', bottom: '#2c3a46', deck: '#e2ded4' } });
    parts.push(s.geo().translate(sd * (B / 2 - 1.4), 0, 0));
  }
  const s = shell(), white = '#f6f6f3', glass = '#1f3346', ins = (p, dx, front) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz < -L * 0.5 ? zz + front : zz]);
  const body = plan(0.2, -L * 0.9, B / 2, B / 2 * 0.86, 3);
  frustum(s, body, body, 1.6, 2.6, white); // her body over the tunnel between the hulls
  box(s, 0, 2.15, -L * 0.45, B + 0.08, 0.45, L * 0.82, '#1e5a9c'); // her company's stripe
  frustum(s, body, ins(body, 0.05, 0.4), 2.6, 3.0, white);
  frustum(s, ins(body, 0.05, 0.4), ins(body, 0.15, 2.4), 3.0, 4.0, glass);
  frustum(s, ins(body, 0.15, 2.4), ins(body, 0.15, 2.5), 4.0, 4.3, white, '#dcd8cf');
  const top = plan(-L * 0.42, -L * 0.8, B * 0.35, B * 0.3, 1.5);
  frustum(s, top, ins(top, 0.05, 0.2), 4.3, 4.7, white);
  frustum(s, ins(top, 0.05, 0.2), ins(top, 0.12, 1.4), 4.7, 5.6, glass);
  frustum(s, ins(top, 0.12, 1.4), ins(top, 0.12, 1.5), 5.6, 5.85, white, white);
  spar(s, [0, 5.85, -L * 0.6], [0, 8.2, -L * 0.62], 0.08, 0.05, '#d9dcdf', 4);
  parts.push(s.geo());
  return mergeGeometries(parts.map(strip));
}
function taxiGeo() { // a bay's wooden passenger boat, some 14 m: her blue topsides, its canopy over the benches, the wheelhouse forward
  const L = 14, B = 4.2, s = shell();
  const H = loftHull(s, { L, B, F: 1.25, sheer: 0.6, aft: 0.15, D: 0.8, tr: 0.62, full: 0.95, stemLen: 0.25, stemExp: 1.8, tb: 0.45, rake: 0.3, bulwark: 0.45, N: 12,
    col: { top: '#3f6f8f', boot: '#f2ede2', bottom: '#7d2b22', deck: '#b88c5c', inside: '#f2ede2', rail: '#7a4a2a' } });
  const ay = H.deck(0.3) + 2.05;
  box(s, 0, ay, -L * 0.36, B * 0.88, 0.1, L * 0.62, '#f2ede2'); // the canopy
  for (const sd of [-1, 1]) for (const t of [0.07, 0.36, 0.64]) box(s, sd * B * 0.4, ay - 1.0, -L * t, 0.07, 2.0, 0.07, '#d9d4c8');
  const wh = plan(-L * 0.7, -L * 0.85, 0.95, 0.85, 0.3), ins = (p, dx) => p.map(([x, zz]) => [x - Math.sign(x) * dx, zz]);
  frustum(s, wh, wh, H.deck(0.77), H.deck(0.77) + 0.9, '#f4efe4');
  frustum(s, wh, ins(wh, 0.06), H.deck(0.77) + 0.9, H.deck(0.77) + 1.45, '#1e2a34');
  frustum(s, ins(wh, 0.06), ins(wh, 0.02), H.deck(0.77) + 1.45, H.deck(0.77) + 1.55, '#f4efe4', '#f4efe4');
  return strip(s.geo());
}
function movers() {
  const group = new THREE.Group(), list = [], mat = landMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }), 1); // (as the moored boats')
  const geo = { ferry: fastFerryGeo(), taxi: taxiGeo() }, SPEED = { ferry: 9, taxi: 4.5 }, WAIT = { ferry: 240, taxi: 90 };
  (META.routes || []).forEach((r, ri) => {
    const pts = r.pts, cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1], n = r.kind === 'ferry' ? 1 : 2; if (len < 50) return;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo[r.kind], mat); m.matrixAutoUpdate = false; group.add(m);
      list.push({ m, pts, cum, len, v: SPEED[r.kind], wait: WAIT[r.kind], phase: (k / n + ri * 0.37) % 1 });
    }
  });
  const posAt = (b, d) => { // the point d along a way, and its heading
    let i = 1; while (i < b.cum.length - 1 && b.cum[i] < d) i++;
    const [ax, az] = b.pts[i - 1], [bx, bz] = b.pts[i], f = (d - b.cum[i - 1]) / Math.max(1e-6, b.cum[i] - b.cum[i - 1]);
    return [ax + (bx - ax) * f, az + (bz - az) * f];
  };
  // the kitesurfers: each along the line off the beach and back, some way out from it, the kite downwind (+z) and up
  const kites = [], K = META.kites;
  if (K) {
    const KC = ['#e8402c', '#f2b51d', '#1f8fd6', '#38b46a', '#d13a8c', '#ff7a1a', '#7a4fd8'];
    for (let i = 0; i < K.n; i++) {
      const g = new THREE.Group(), c = KC[i % KC.length];
      const rider = new THREE.Mesh(mergeGeometries([tint(new THREE.BoxGeometry(1.5, 0.08, 0.45).translate(0, 0.05, 0), '#f4f4f0'), tint(new THREE.BoxGeometry(0.45, 1.5, 0.35).translate(0, 0.9, 0), '#20252a'), tint(new THREE.SphereGeometry(0.16, 8, 6).translate(0, 1.8, 0), '#d9b08c')].map(strip)), mat);
      const kite = new THREE.Mesh(strip(tint(new THREE.TorusGeometry(5, 0.9, 4, 12, Math.PI).scale(1, 1, 0.35), c)), mat);
      const lines = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#3a3a3a', transparent: true, opacity: 0.6 }));
      g.add(rider, kite, lines); group.add(g);
      kites.push({ g, rider, kite, lines, off: 40 + (i * 53) % 220, ph: i * 1.7, sp: 6 + (i % 3) });
    }
  }
  const lineLen = K ? Math.hypot(K.b[0] - K.a[0], K.b[1] - K.a[1]) : 0;
  group.userData.update = (t) => {
    for (const b of list) {
      const cycle = 2 * (b.len / b.v + b.wait), u = ((t / cycle + b.phase) % 1) * cycle, run = b.len / b.v;
      // out (moving), waiting at the far end, back, waiting at home
      let d, dir;
      if (u < run) { d = u * b.v; dir = 1; } else if (u < run + b.wait) { d = b.len; dir = 0; } else if (u < 2 * run + b.wait) { d = b.len - (u - run - b.wait) * b.v; dir = -1; } else { d = 0; dir = 0; }
      const [x, z] = posAt(b, d), ahead = posAt(b, Math.min(b.len, Math.max(0, d + (dir >= 0 ? 12 : -12)))), back = posAt(b, Math.min(b.len, Math.max(0, d - (dir >= 0 ? 12 : -12))));
      const hx = dir === 0 ? x - back[0] || 1 : ahead[0] - x, hz = dir === 0 ? z - back[1] : ahead[1] - z;
      b.m.position.set(x, Math.sin(t * 1.3 + b.phase * 9) * 0.08 - 0.05, z); b.m.rotation.set(Math.sin(t * 0.9 + b.phase * 5) * 0.012, Math.atan2(-hx, -hz), 0); b.m.updateMatrix();
    }
    for (const k of kites) {
      const f = 0.5 + 0.48 * Math.sin((t * k.sp) / Math.max(200, lineLen) + k.ph), dx = (K.b[0] - K.a[0]) / lineLen, dz = (K.b[1] - K.a[1]) / lineLen;
      const going = Math.cos((t * k.sp) / Math.max(200, lineLen) + k.ph) > 0 ? 1 : -1;
      // out from the beach: the line's normal on the sea's side (the one away from the land)
      let nx = -dz, nz = dx; const mx = K.a[0] + dx * lineLen * 0.5, mz = K.a[1] + dz * lineLen * 0.5; if (groundAt(mx + nx * 300, mz + nz * 300) > groundAt(mx - nx * 300, mz - nz * 300)) { nx = -nx; nz = -nz; }
      const x = K.a[0] + dx * lineLen * f + nx * k.off, z = K.a[1] + dz * lineLen * f + nz * k.off;
      k.g.position.set(x, 0, z);
      k.rider.rotation.set(0, Math.atan2(-dx * going, -dz * going) + Math.PI / 2, 0.25 * going);
      const sw = Math.sin(t * 0.7 + k.ph) * 0.5, kx = Math.sin(sw) * 18, ky = 16 + Math.cos(sw) * 6, kz = 14;
      k.kite.position.set(kx, ky, kz); k.kite.rotation.set(-0.3, 0, sw);
      const pa = k.lines.geometry.attributes.position; pa.setXYZ(0, 0, 1.2, 0); pa.setXYZ(1, kx, ky, kz); pa.needsUpdate = true;
    }
  };
  return group;
}

// ---------- the landmarks ----------
// what the json lists: a steel arch bridge (Sydney Harbour), a suspension bridge (Newport's, the Golden Gate), a tower
// (Auckland's Sky Tower, Laboe's naval memorial, Galata, the Transamerica Pyramid, Torre Glòries), a lighthouse (Trieste's
// Victory, the Maiden's Tower), a mosque (Istanbul's), a gilded spire (St Petersburg's), a rostral column, a drawbridge
// with its spans raised, a hilltop castle (Marmaris's, Fethiye's ruin), Fethiye's rock tombs, theatre and sarcophagi, a
// statue on its pedestal, the Opera House, the Sagrada Família, Christ the Redeemer, La Seu, Notre-Dame de la Garde,
// Carlsten. The famous ones drawn after the real ones, from aerial photographs and their plans, to be known at a glance
// from the course. Each in one colour a part, merged into one mesh.
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
// a wedge along the ground from p0 to p1 (x, z), w wide: its top from y0 down to y1, its foot at yb (a bridge's approach)
function wedge(p0, p1, y0, y1, yb, w, col) {
  const g = new THREE.BoxGeometry(1, 1, 1), a = g.attributes.position, dx = p1.x - p0.x, dz = p1.z - p0.z, len = Math.hypot(dx, dz);
  for (let i = 0; i < a.count; i++) { const t = a.getX(i) + 0.5; a.setXYZ(i, t * len, a.getY(i) > 0 ? y0 + (y1 - y0) * t : yb, a.getZ(i) * w); }
  g.rotateY(-Math.atan2(dz, dx)).translate(p0.x, 0, p0.z); g.computeVertexNormals();
  return tint(g, col);
}
// A landmark's own frame: metres `a` along its bearing (L.dir, compass degrees; north when not given), `b` to the right
// of it and `y` up from y0, into the venue's frame (venues.py to_xz, turned by META.turn); `ang` that bearing there, in
// radians from +x towards +z as blk() takes it
function frameOf(L, y0, dir = L.dir || 0) {
  const t = ((META.turn || 0) * Math.PI) / 180, d = (dir * Math.PI) / 180, CO = Math.cos(t), SI = Math.sin(t), [x0, z0] = L.at;
  const xz = (a, b) => { const E = a * Math.sin(d) + b * Math.cos(d), N = a * Math.cos(d) - b * Math.sin(d); return [x0 + E * CO - N * SI, z0 - E * SI - N * CO]; };
  const [x1, z1] = xz(1, 0), ang = Math.atan2(z1 - z0, x1 - x0);
  return { y0, xz, ang, P: (a, b, y) => { const [x, z] = xz(a, b); return V3(x, y0 + y, z); },
    box: (a, b, y, h, la, lb, col, turn = 0) => { const [x, z] = xz(a, b); return blk(x, z, y0 + y, h, la, lb, ang + turn, col); } };
}
const fromTris = (pos) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
// each vertex coloured by where it is: fn(x, y, z) → a colour
function paintBy(g, fn) {
  const p = g.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.set(fn(p.getX(i), p.getY(i), p.getZ(i))); a.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// a surface through f(s, t) → a point (s and t from 0 to 1), nu by nv quads, seen from both sides; col a colour, or
// fn(s, t) → the colour of the quad there (a pattern with sharp edges)
function sheet(f, nu, nv, col) {
  const pos = [], cols = [], c = new THREE.Color();
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const p = f(i / nu, j / nv), q = f((i + 1) / nu, j / nv), r = f((i + 1) / nu, (j + 1) / nv), s = f(i / nu, (j + 1) / nv);
    for (const v of [p, q, r, p, r, s, p, r, q, p, s, r]) pos.push(v.x, v.y, v.z);
    if (typeof col === 'function') { c.set(col((i + 0.5) / nu, (j + 0.5) / nv)); for (let k = 0; k < 12; k++) cols.push(c.r, c.g, c.b); }
  }
  const g = fromTris(pos);
  if (typeof col === 'function') { g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return g; }
  return tint(g, col);
}
// a block on an outline (pts: [a, b] in the frame F) from ya up to yb, seen from all sides
function slab(F, pts, ya, yb, col) {
  const v = pts.map(([a, b]) => F.xz(a, b)), pos = [], put = (i, y) => pos.push(v[i][0], F.y0 + y, v[i][1]);
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts.map(([a, b]) => new THREE.Vector2(a, b)), [])) for (const y of [ya, yb]) { put(i, y); put(j, y); put(k, y); put(i, y); put(k, y); put(j, y); }
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    put(i, ya); put(j, ya); put(j, yb); put(i, ya); put(j, yb); put(i, yb);
    put(i, ya); put(j, yb); put(j, ya); put(i, ya); put(i, yb); put(j, yb);
  }
  return tint(fromTris(pos), col);
}
// turned on a profile ([r, y] from the bottom up) round x, z from y0, n sides; col a colour or fn(x, y, z) → one
const lathe = (x, z, y0, prof, col, n = 16) => {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n);
  return (typeof col === 'function' ? paintBy(g, col) : tint(g, col)).translate(x, y0, z);
};
// a block whose section changes as it rises: sec(t) → [a0, a1, b0, b1, y] in the frame F for t from 0 to 1, n rows;
// its four sides and its top
function loft(F, sec, n, col) {
  const at = (t, i) => { const [a0, a1, b0, b1, y] = sec(t); return F.P([a0, a1, a1, a0, a0][i], [b0, b0, b1, b1, b0][i], y); };
  const top = [0, 1, 2, 3].map((i) => at(1, i)), mix = (p, q, f) => p.clone().lerp(q, f);
  return [sheet((s, t) => { const i = Math.min(3, Math.floor(s * 4 + 1e-6)), f = s * 4 - i; return mix(at(t, i), at(t, i + 1), f); }, 4, n, col),
    sheet((s, t) => mix(mix(top[0], top[1], s), mix(top[3], top[2], s), t), 1, 1, col)];
}
// a pitched roof along `a` from a0 to a1, w wide, its eaves at y0 and its ridge `rise` over them, with its gable ends
const gable = (F, a0, a1, w, y0, rise, col, b = 0) => [-1, 1].map((sd) => sheet((s, t) => F.P(a0 + (a1 - a0) * s, b + sd * (w / 2) * (1 - t), y0 + rise * t), 2, 1, col))
  .concat([a0, a1].map((a) => sheet((s, t) => F.P(a, b + (2 * s - 1) * (w / 2) * (1 - t), y0 + rise * t), 2, 1, col)));
const bez = (p0, p1, p2, t) => p0 * (1 - t) * (1 - t) + 2 * p1 * t * (1 - t) + p2 * t * t;

// The Sydney Opera House on Bennelong Point: the broadwalk round it, the granite podium, the monumental steps down to
// the forecourt to the south, and on the podium the shells: the Concert Hall's to the west and the Joan Sutherland
// Theatre's to the east, splayed a little, each hall three shells nested one behind the other, each taller than the one
// in front of it, their mouths glazed to the harbour, and a small one at the back over the steps; the restaurant's pair
// by the steps. Metres east and north of `at`, from the aerial.
function operaHouse(L, parts) {
  const F = frameOf(L, 0, 0), EN = (pts) => pts.map(([e, n]) => [n, e]), PD = 18, tile = '#f3f0e8', glass = '#6a5c50', granite = '#d4bba3';
  parts.push(slab(F, EN([[-50, 130], [45, 133], [68, 112], [76, 84], [60, 0], [40, -70], [-40, -96], [-92, -80], [-86, 0], [-62, 122]]), -3, 3.5, '#cbbba6'));
  const pod = EN([[-52, 106], [-20, 113], [30, 104], [70, 93], [44, -40], [28, -60], [-64, -58], [-60, 40]]);
  parts.push(slab(F, pod, 2, PD - 4.5, granite), slab(F, pod, PD - 4.5, PD - 2.6, '#74655b'), slab(F, pod, PD - 2.6, PD, granite));
  parts.push(wedge(F.P(-57, -16, 0), F.P(-92, -16, 0), PD, 3.6, 0, 74, '#c2a991'));
  // a hall from its south end (e0, n0) to its north (e1, n1); each shell: its mouth's feet at uf (wf either side of the
  // middle), its tip at ua, h over the podium, its ridge down to its back foot at ub (behind the mouth: south of it for
  // the shells facing the harbour, north for the one facing the steps)
  const hall = (e0, n0, e1, n1, shells) => {
    const len = Math.hypot(e1 - e0, n1 - n0), ae = (e1 - e0) / len, an = (n1 - n0) / len;
    const Q = (u, v, y) => F.P(n0 + an * u - ae * v, e0 + ae * u + an * v, PD + y);
    for (const s of shells) {
      const back = Math.sign(s.ub - s.uf);
      const edge = (t) => [bez(s.uf, s.uf + 0.15 * (s.ua - s.uf), s.ua, t), bez(s.wf, 0.97 * s.wf, 0, t), bez(0, 0.62 * s.h, s.h, t)];
      for (const sd of [-1, 1]) parts.push(sheet((sv, t) => {
        const ru = bez(s.ub, s.ub + 0.3 * (s.ua - s.ub), s.ua, t), ry = bez(0, 0.85 * s.h, s.h, t), [eu, ev, ey] = edge(t);
        const k = Math.sin(Math.PI * sv) * Math.sin(Math.PI * Math.min(1, t * 1.25)) * 0.08 * s.wf; // its belly: a piece of a sphere
        return Q(ru + (eu - ru) * sv, sd * (ev * sv + k * 0.5), ry + (ey - ry) * sv + k);
      }, 9, 12, tile));
      // the glass hung in its mouth, set back under the arch and stopping short of its top, the shell's ribbed underside
      // showing over it
      parts.push(sheet((sv, t) => { const [eu, ev, ey] = edge(t * 0.72); return Q(eu + back * (2 + 3 * t), (2 * sv - 1) * ev * 0.96, ey); }, 4, 8, glass));
    }
  };
  hall(-16, -24, -13, 99, [{ uf: 123, wf: 28, ua: 120, h: 26, ub: 86 }, { uf: 104, wf: 22, ua: 100, h: 36, ub: 62 }, { uf: 84, wf: 17, ua: 79, h: 49, ub: 36 }, { uf: 7, wf: 17, ua: 12, h: 24, ub: 44 }]);
  hall(17, -14, 49, 84, [{ uf: 103, wf: 25, ua: 100, h: 22, ub: 72 }, { uf: 88, wf: 20, ua: 84, h: 30, ub: 52 }, { uf: 71, wf: 15, ua: 66, h: 42, ub: 30 }, { uf: 6, wf: 15, ua: 10, h: 20, ub: 36 }]);
  hall(-41, -50, -43, -10, [{ uf: 40, wf: 11, ua: 37, h: 14, ub: 13 }, { uf: 3, wf: 9, ua: 6, h: 9, ub: 22 }]);
}

// The Sagrada Família: the nave to the Glory façade (along L.dir), the transept to the Nativity façade (to the left) and
// the Passion façade (to the right), the apse behind; the eight apostles' bell towers in fours over the two façades,
// slender paraboloids with their mosaic pinnacles; round the crossing the four Evangelists' towers, Mary's over the apse
// with its star, and Jesus Christ's in the middle, L.h to the top of its cross
function sagrada(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), stone = '#d3c4a6', old = '#c2aa85', pale = '#ebe5d8', white = '#faf8f2';
  parts.push(F.box(25, 0, -1, 46, 72, 44, stone), F.box(0, 0, -1, 46, 32, 70, stone), F.box(62, 0, -1, 34, 6, 46, pale));
  const [ax, az] = F.xz(-16, 0); parts.push(lathe(ax, az, y - 1, [[18, 0], [18, 44], [10, 56], [0, 60]], stone, 14));
  // the roofs' ridges: steep, as Gaudí's are
  parts.push(...gable(F, -10, 60, 44, 45, 18, '#c7b697'), ...gable(frameOf(L, y, (L.dir || 0) + 90), -35, 35, 30, 45, 16, '#c7b697'));
  // an apostle's bell tower: square at its foot, then round, drawing in to its point, and its pinnacle, the bishop's
  // mitre in red, gold and white mosaic
  const bell = (a, b, h, col) => {
    const [x, z] = F.xz(a, b), r0 = 4.3;
    parts.push(F.box(a, b, -1, h * 0.28, 2 * r0, 2 * r0, col));
    parts.push(lathe(x, z, y - 1, [[r0 * 1.02, 0], [r0, h * 0.3], [r0 * 0.94, h * 0.5], [r0 * 0.8, h * 0.64], [r0 * 0.6, h * 0.75], [r0 * 0.38, h * 0.83], [r0 * 0.2, h * 0.88], [0, h * 0.9]], col, 12));
    parts.push(lathe(x, z, y - 1, [[0, h * 0.875], [r0 * 0.38, h * 0.89], [r0 * 0.55, h * 0.925], [r0 * 0.42, h * 0.96], [0.4, h * 0.985], [0, h]], (px, py) => (py > h * 0.94 ? '#e9e4d6' : py > h * 0.91 ? '#d8a93a' : '#c4452f'), 10));
    for (let k = 0; k < 4; k++) { const q = (k * Math.PI) / 2, [bx, bz] = F.xz(a + Math.cos(q) * r0 * 0.55, b + Math.sin(q) * r0 * 0.55); parts.push(tint(new THREE.SphereGeometry(0.75, 8, 6).translate(bx, y + h * 0.955, bz), '#f2efe6')); }
  };
  for (const [u, h] of [[-17, 98], [-7.5, 107], [7.5, 107], [17, 98]]) bell(u, -36, h, old); // the Nativity façade
  for (const [u, h] of [[-17, 107], [-7.5, 112], [7.5, 112], [17, 107]]) bell(u, 36, h, '#d4c3a3'); // the Passion façade
  parts.push(F.box(0, -36, -1, 52, 30, 7, old), F.box(0, 36, -1, 44, 30, 7, '#d4c3a3'));
  { const [cx, cz] = F.xz(0, -38); parts.push(tint(new THREE.ConeGeometry(3.6, 15, 10).translate(cx, y + 58, cz), '#557a4c')); } // the Nativity's cypress
  // the crossing's towers
  const tower = (a, b, prof, top, col) => { const [x, z] = F.xz(a, b); parts.push(lathe(x, z, y - 1, prof, (px, py) => (py > top ? white : col), 12)); return [x, z]; };
  for (const [a, b] of [[-13, -13], [-13, 13], [13, -13], [13, 13]]) {
    const [x, z] = tower(a, b, [[5.4, 0], [5.4, 60], [5.1, 92], [4.3, 110], [3.1, 123], [1.7, 130], [0.6, 131.5]], 108, pale);
    parts.push(tint(new THREE.SphereGeometry(2.6, 10, 8).translate(x, y + 132.5, z), white)); // the Evangelists' symbols
  }
  { const [x, z] = tower(-30, 0, [[6.4, 0], [6.4, 62], [6, 96], [4.8, 116], [3.2, 128], [1.6, 134], [0.6, 135]], 112, pale); parts.push(tint(new THREE.IcosahedronGeometry(3.6, 0).translate(x, y + 136, z), '#fbfaf4')); }
  const H = L.h, [jx, jz] = tower(0, 0, [[9, 0], [9, 62], [8.5, 92], [7.6, 112], [6.4, 130], [4.8, 143], [3.1, 151], [1.9, 156], [1.2, 158]], 126, pale);
  parts.push(post(jx, jz, y + H - 17, 1.25, 1.25, 17, white, 8)); // the cross: four arms, one to each side
  for (const turn of [0, Math.PI / 2]) parts.push(blk(jx, jz, y + H - 7.4, 2.4, 13.5, 2.4, F.ang + turn, white));
}

// Christ the Redeemer on Corcovado's summit, facing L.dir: the pedestal, the robe falling to the feet, the arms out
// 28 m with the sleeves hanging from them, the head bowed a little
function redeemer(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), soap = '#dedbd1', S = 8;
  parts.push(F.box(0, 0, -2, S + 2, 10, 10, '#c3bcb0'), F.box(0, 0, S - 0.6, 0.6, 11, 11, '#b2ab9e'));
  const [x, z] = F.xz(0, 0);
  const robe = new THREE.LatheGeometry([[3.1, 0], [2.95, 3], [2.65, 9], [2.5, 14], [2.65, 19], [3.0, 22.5], [3.3, 24.1], [2.6, 25.2], [1.1, 25.7], [0, 25.8]].map(([r, h]) => new THREE.Vector2(r, h)), 18);
  parts.push(tint(robe.scale(0.6, 1, 1).rotateY(-F.ang).translate(x, y + S, z), soap));
  for (const sd of [-1, 1]) {
    const arm = (b0, b1, y0, y1, w, h) => parts.push(beam(F.P(0, sd * b0, y0), F.P(0, sd * b1, y1), w, h, soap));
    arm(2.4, 8.4, S + 24.6, S + 24.45, 2.3, 2.5); arm(8.4, 12.7, S + 24.45, S + 24.2, 1.7, 1.75); arm(12.7, 14, S + 24.2, S + 24.05, 0.7, 1.5);
    // the sleeve hanging from it in a curve, from the elbow down to the hip
    for (const a of [-0.5, 0.5]) parts.push(sheet((s, t) => F.P(a, sd * (2.4 + 6.6 * s), S + (18.8 + 5.4 * s ** 0.7) * (1 - t) + (24.6 - 0.4 * s) * t), 6, 1, soap));
  }
  parts.push(post(x, z, y + S + 25.4, 0.9, 1.0, 1.3, soap, 8));
  const [hx, hz] = F.xz(0.35, 0); parts.push(tint(new THREE.SphereGeometry(1.75, 12, 10).scale(1, 1.15, 0.95).translate(hx, y + S + 28.1, hz), soap));
}
// a tower on the Golden Gate's plan (the bridge's towers, L.style 'golden-gate'): two legs stepping in as they rise, the
// four portal struts above the roadway, the openings between them shorter the higher they are, the X-bracing below it;
// each on its concrete pier. P(u, y, v) the bridge's frame, ang its direction
function goldenGateTower(P, ang, u, D, H, col, parts) {
  const at = (y, v = 0) => P(u, y, v), put = (y0, y1, w, d, v, c = col) => { const p = at(0, v); parts.push(blk(p.x, p.z, y0, y1 - y0, w, d, ang, c)); };
  put(-3, 13, 36, 52, 0, '#a5a199');
  for (const v of [-14, 14]) for (const [y0, y1, w, d] of [[13, D, 17, 10.5], [D, D + 46, 14.5, 9], [D + 46, D + 88, 12.5, 7.8], [D + 88, D + 126, 11, 6.8], [D + 126, H + 2, 9.5, 6]]) put(y0, y1, w, d, v);
  for (const [y0, d] of [[D + 37, 9], [D + 79, 8.5], [D + 116, 8], [H - 12, 9]]) put(y0, y0 + d, 7, 28, 0);
  for (const sd of [-1, 1]) parts.push(beam(at(14, -13 * sd), at(D - 9, 13 * sd), 3, 3, col));
  put(D - 9, D - 4, 7, 28, 0); put(12, 16, 9, 28, 0);
}
// The Transamerica Pyramid: the white quartz pyramid on its trussed base, the two wings (the lifts' to the east, the
// stairs' to the west) rising out of its sides to its shoulders, the spire
function pyramid(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), white = '#dedbd3', APEX = 276, B = 53;
  const half = (h) => (B / 2) * (1 - h / APEX), [x, z] = F.xz(0, 0);
  parts.push(F.box(0, 0, -1, 17, 38, 38, '#4c5257'));
  parts.push(tint(new THREE.CylinderGeometry(half(212) * Math.SQRT2, half(16) * Math.SQRT2, 196, 4).rotateY(Math.PI / 4 - F.ang).translate(x, y + 114, z), white));
  parts.push(tint(new THREE.CylinderGeometry(0.4, half(212) * Math.SQRT2, L.h - 212, 4).rotateY(Math.PI / 4 - F.ang).translate(x, y + 212 + (L.h - 212) / 2, z), '#e9e8e4'));
  for (const sd of [-1, 1]) parts.push(...loft(F, (t) => { const h = 96 + 124 * t, b0 = sd * (half(h) - 3), b1 = sd * (half(h) + 5.5); return [-6.5, 6.5, Math.min(b0, b1), Math.max(b0, b1), h]; }, 4, white));
  for (const sd of [-1, 1]) for (const k of [-1, 0, 1]) parts.push(beam(F.P(k * 17 - 8, sd * 25, 0), F.P(k * 17 + 8, sd * 25, 16), 1.6, 1.6, '#e8e5de'), beam(F.P(k * 17 + 8, sd * 25, 0), F.P(k * 17 - 8, sd * 25, 16), 1.6, 1.6, '#e8e5de'));
}
// Torre Glòries: the bullet of glass louvres over its mosaic of coloured panels, reds and oranges low down, blues higher,
// pale greys towards the dome, scattered as the façade's are
function glories(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), [x, z] = L.at, H = L.h, NU = 36, NV = 40;
  const prof = [[19, 0], [19, 0.66], [18.4, 0.73], [16.8, 0.8], [14.3, 0.87], [10.6, 0.93], [5.6, 0.98], [0, 1.006]];
  const rAt = (t) => { for (let k = 1; k < prof.length; k++) if (t <= prof[k][1]) { const [r0, t0] = prof[k - 1], [r1, t1] = prof[k]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); } return 0; };
  const warm = ['#b8402f', '#cf6a3a', '#c4503a', '#9b3a2e', '#d98a4a'], cool = ['#4d6e96', '#6b8db2', '#8aa2bb', '#3e5b7f', '#5f7f9c'], pale = ['#c3ccd5', '#dde3e8', '#aab6c2'];
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  parts.push(sheet((s, t) => { const q = s * Math.PI * 2, r = rAt(t * 1.006); return V3(x + Math.cos(q) * r, y - 1 + t * (H + 1), z + Math.sin(q) * r); }, NU, NV, (s, t) => {
    const i = Math.floor(s * NU), j = Math.floor(t * NV), h = hash(i, j), k = hash(j, i);
    const set = h < 1.15 - t * 1.9 ? warm : k < 1.55 - t * 1.25 ? cool : pale;
    return set[Math.floor(hash(i + 7, j + 3) * set.length)];
  }));
}
// Notre-Dame de la Garde on its hilltop: the old fort's walls under the terrace, the striped Romano-Byzantine basilica,
// its dome, and at its north-west end the belfry carrying the gilded Virgin and Child, L.h to her head
function garde(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), white = '#eee8da', green = '#a3b2a0', gold = '#d9a62e', H = L.h;
  // the church's walls in courses of white Calissanne limestone with thinner ones of green Golfolina sandstone, the
  // domes too (rows of 0.7 m: two white, one green)
  const band = (k) => (k % 3 === 2 ? green : white);
  const striped = (a, b, y0, h, la, lb) => loft(F, (t) => [a - la / 2, a + la / 2, b - lb / 2, b + lb / 2, y0 + h * t], Math.round(h / 0.7), (s, t) => band(Math.floor(t * Math.round(h / 0.7))));
  const dome = (a, r, y0) => {
    const [dx, dz] = F.xz(a, 0), n = 12;
    parts.push(...loft(frameOf({ at: [dx, dz] }, y, 0), (t) => [-r * 0.89, r * 0.89, -r * 0.89, r * 0.89, y0 + 5 * t], 7, (s, t) => band(Math.floor(t * 7))));
    parts.push(sheet((s, t) => { const q = s * Math.PI * 2, e = (t * Math.PI) / 2; return V3(dx + Math.cos(q) * Math.cos(e) * r, y + y0 + 5 + Math.sin(e) * r, dz + Math.sin(q) * Math.cos(e) * r); }, 16, n, (s, t) => band(Math.floor(t * n))));
    parts.push(post(dx, dz, y + y0 + 4.6 + r, 1, 0.7, 2.6, white, 8), post(dx, dz, y + y0 + 6.9 + r, 0.4, 0.1, 1.8, gold, 6));
  };
  parts.push(slab(F, [[-46, -20], [40, -26], [48, 0], [40, 24], [-40, 22], [-50, 4]], -16, 0.5, '#b2a891'));
  parts.push(...striped(4, 0, 0.5, 17, 30, 16), ...striped(-3, 0, 0.5, 14, 8, 26));
  dome(10, 6.8, 17); dome(0, 3.8, 14.5);
  { const [px, pz] = F.xz(19, 0); parts.push(lathe(px, pz, y + 0.5, [[8, 0], [8, 15], [0, 15.5]], white, 14)); }
  // the belfry: its square tower, the bell stage with its arches, the drum, the statue's pedestal, the Virgin and Child
  parts.push(F.box(-16, 0, 0.5, H * 0.55, 10.5, 10.5, white), F.box(-16, 0, 0.5 + H * 0.55, H * 0.13, 9.6, 9.6, white), F.box(-16, 0, 0.5 + H * 0.55, 1, 11.2, 11.2, white));
  for (const k of [0.18, 0.36]) parts.push(F.box(-16, 0, 0.5 + H * k, 0.7, 11, 11, green));
  for (const [a, b, la, lb] of [[-16, -4.9, 6, 0.6], [-16, 4.9, 6, 0.6], [-20.9, 0, 0.6, 6], [-11.1, 0, 0.6, 6]]) parts.push(F.box(a, b, 0.5 + H * 0.565, H * 0.1, la, lb, '#3f3a35'));
  const [tx, tz] = F.xz(-16, 0);
  parts.push(F.box(-16, 0, 0.5 + H * 0.68, 1, 10.6, 10.6, white), post(tx, tz, y + 1.5 + H * 0.68, 4.2, 3.9, H * 0.07, white, 12), post(tx, tz, y + 1.5 + H * 0.75, 3.1, 2.7, H * 0.065, white, 12));
  parts.push(lathe(tx, tz, y + 0.5 + H * 0.815, [[2.3, 0], [2.0, H * 0.05], [1.5, H * 0.11], [1.75, H * 0.125], [1.0, H * 0.145], [0.95, H * 0.16], [0, H * 0.185]], gold, 12));
  { const [cx, cz] = F.xz(-15, 0); parts.push(tint(new THREE.SphereGeometry(0.9, 8, 6).translate(cx, y + 0.5 + H * 0.92, cz), gold)); } // the Child in her arms
}
// La Seu, Palma's cathedral on the sea wall: the nave and its aisles along L.dir to the apse, the rows of buttresses
// down both sides with their pinnacles and the flying arches up to the nave, the Royal Chapel and the great rose window
// at the east end, the west front's corner turrets, the square bell tower on the north side
function laSeu(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), stone = '#d7bf8e', shade = '#c2a979', H = L.h;
  parts.push(F.box(-3, 0, -1, H + 1, 110, 20, stone), F.box(-3, 0, -1, 31, 106, 38, stone), F.box(-3, 0, -1, 21, 104, 50, shade));
  parts.push(...gable(F, -58, 52, 20, H, 4, '#c9ae7c'));
  for (let k = 0; k < 10; k++) {
    const a = -52 + k * 11;
    for (const sd of [-1, 1]) {
      parts.push(F.box(a, sd * 23, -1, 30, 3.2, 9, stone), F.box(a, sd * 27, -1, 37, 2.6, 2.6, stone));
      const [px, pz] = F.xz(a, sd * 27); parts.push(tint(new THREE.ConeGeometry(1.9, 9, 4).rotateY(Math.PI / 4 - F.ang).translate(px, y + 40.5, pz), stone));
      const [qx, qz] = F.xz(a, sd * 19); parts.push(post(qx, qz, y + 30, 1.1, 1.1, 5, stone, 4), tint(new THREE.ConeGeometry(1.2, 6, 4).translate(qx, y + 38, qz), stone));
      parts.push(beam(F.P(a, sd * 26, 34), F.P(a, sd * 10.5, H - 3), 1.4, 1.6, stone), beam(F.P(a, sd * 25, 27), F.P(a, sd * 18, 30), 1.2, 1.3, stone));
    }
  }
  parts.push(F.box(57.5, 0, -1, 33, 11, 18, stone), F.box(65, 0, -1, 21, 6, 10, stone));
  for (const sd of [-1, 1]) { const [px, pz] = F.xz(62, sd * 9); parts.push(post(px, pz, y, 1.3, 1.3, 36, stone, 6), tint(new THREE.ConeGeometry(1.5, 7, 6).translate(px, y + 39.5, pz), stone)); }
  { const [rx, rz] = F.xz(52.3, 0); parts.push(tint(new THREE.CylinderGeometry(6, 6, 0.6, 20).rotateZ(Math.PI / 2).rotateY(-F.ang).translate(rx, y + H - 8, rz), '#4b4e55')); } // the rose window
  for (const sd of [-1, 1]) { const [px, pz] = F.xz(-57, sd * 11.5); parts.push(post(px, pz, y - 1, 2.6, 2.4, H + 7, stone, 8), tint(new THREE.ConeGeometry(2.6, 8, 8).translate(px, y + H + 10, pz), stone)); }
  parts.push(F.box(3, -25, -1, 48, 9.5, 9.5, shade), F.box(3, -25, 46.5, 1.6, 10.4, 10.4, stone));
}
// The Faro della Vittoria on Gretta's hill: the fort's round bastion, the pedestal, the fluted shaft of white Istrian
// stone, the gallery, the lantern, the copper cupola and the bronze winged Victory, L.h to her raised arm
function vittoria(L, parts) {
  const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), white = '#ecebe5', H = L.h;
  parts.push(post(x, z, y - 3, 15, 14, 9, '#bdb4a3', 20), post(x, z, y + 6, 7.4, 7.4, 9, white, 8));
  parts.push(lathe(x, z, y + 15, [[7.6, 0], [7.2, 1.5], [5.5, 3], [4.6, 5.5], [4.4, 7]], white, 24));
  const shaft = new THREE.CylinderGeometry(3.7, 4.3, 27, 32, 1), p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) if ((i % 33) % 2) { p.setX(i, p.getX(i) * 0.88); p.setZ(i, p.getZ(i) * 0.88); }
  shaft.computeVertexNormals(); parts.push(tint(shaft.translate(x, y + 22 + 13.5, z), white));
  parts.push(lathe(x, z, y + 49, [[3.7, 0], [4.4, 1.2], [5.4, 2.6], [5.4, 3.4], [4.2, 3.6]], white, 24), post(x, z, y + 52.6, 3.2, 3.2, 1.2, white, 16));
  parts.push(post(x, z, y + 53.8, 2.9, 2.9, 4, '#3d4a54', 16), post(x, z, y + 57.8, 3.3, 3.3, 0.8, white, 16));
  parts.push(tint(new THREE.SphereGeometry(3.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 58.6, z), '#6f9a86'), post(x, z, y + 61.5, 0.9, 0.9, 0.8, '#6f9a86', 8));
  const bronze = '#57513f', F = frameOf(L, y, 225);
  parts.push(lathe(x, z, y + 62.3, [[0.9, 0], [0.75, 2.2], [0.55, 3.6], [0.7, 4.1], [0.4, 4.5], [0.45, 4.9], [0, 5.3]], bronze, 8));
  for (const sd of [-1, 1]) parts.push(sheet((s, t) => F.P(-0.5 - 0.5 * s, sd * (0.4 + (2.6 + 0.2 * t) * s), 64.8 + 1.4 * s + (1.8 + 0.5 * s) * t), 3, 2, bronze)); // her wings, raised
  parts.push(beam(F.P(0, 0.5, 66.4), F.P(0.3, 0.9, H), 0.35, 0.35, bronze));
}
// the Maiden's Tower on its rock off Üsküdar: the islet's quay, the little white house with its red roof, the stone
// wall, and the tower: the square stone base, the white storey with its balcony, the lead cupola, the flag
function maiden(L, parts) {
  const F = frameOf(L, 0, 85), white = '#efe9de', stone = '#b8ac98', H = L.h;
  parts.push(F.box(-10, 3, -3, 4.6, 44, 26, '#d2cbbe'));
  parts.push(F.box(-19, 3, 1.6, 4.2, 15, 18, white), ...gable(F, -26.5, -11.5, 19, 5.8, 2.4, '#a7472f', 3));
  parts.push(F.box(8, 3, 1.6, 5.6, 3, 22, stone), F.box(-5, 14, 1.6, 5.6, 26, 2.6, stone));
  const [x, z] = L.at;
  parts.push(F.box(0, 0, 1.6, 10.6, 8.6, 8.6, stone), post(x, z, 12, 4.6, 4.6, 0.5, white, 8), post(x, z, 12.5, 4, 4, 5, white, 8), post(x, z, 17.5, 4.4, 4.4, 0.6, white, 8));
  for (let k = 0; k < 8; k++) { const q = ((k + 0.5) * Math.PI) / 4; parts.push(blk(x + Math.cos(q) * 3.75, z + Math.sin(q) * 3.75, 13.6, 2.2, 0.6, 1.2, q, '#3a4148')); } // its windows
  parts.push(lathe(x, z, 18.1, [[4.1, 0], [3.8, 1.2], [2.6, 2.9], [1.1, (H - 18.1) * 0.85], [0.5, H - 18.1]], '#7b8288', 12), post(x, z, H - 0.2, 0.7, 0.5, 1.4, white, 8));
  parts.push(post(x, z, H + 1.2, 0.12, 0.08, 9, '#d8d4c8', 6), F.box(0, 1.4, H + 7.2, 1.8, 0.12, 2.8, '#d42a26'));
}
// the naval memorial at Laboe: the brick tower like a ship's stem, its back upright, its front sweeping down and out
// towards the fjord (L.dir), the viewing deck on top; the round forecourt behind it
function laboe(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y), brick = '#7e5040', H = L.h;
  const front = (t) => -4.5 + 9 + 17 * Math.max(0, 1 - (t * H) / 62) ** 2.1, wid = (t) => 5 - 1.4 * t;
  parts.push(...loft(F, (t) => [-4.5, front(t), -wid(t), wid(t), t * (H - 6)], 18, brick));
  parts.push(F.box(0.2, 0, H - 6, 6, 9.8, 7.8, brick), F.box(0.2, 0, H - 4.6, 2.6, 10, 8, '#3f3a38'));
  const [hx, hz] = F.xz(-42, 13); parts.push(post(hx, hz, y - 2, 42, 42, 3.5, '#93776a', 32));
}
// Carlsten on Marstrand's top: the round keep with its pale dome at the fortress's corner, its square bastion, the
// long slate-roofed wings running out from it, the ramparts round all of it, the red house in the courtyard
function carlsten(L, parts) {
  const y = Math.max(0, groundAt(L.at[0], L.at[1])), F = frameOf(L, y, 0), stone = '#958b80', slate = '#4b5157', wall = '#b1a99c';
  const at = (brg, d) => { const q = (brg * Math.PI) / 180; return [d * Math.cos(q), d * Math.sin(q)]; }; // [a north, b east]
  const [x, z] = L.at;
  parts.push(slab(F, [at(225, 30), at(315, 28), at(45, 32), at(135, 30)], -3, 9, stone));
  parts.push(post(x, z, y - 2, 12.6, 12, L.h + 2, stone, 24), post(x, z, y + L.h, 12.8, 12.8, 1.2, '#a59b8f', 24), tint(new THREE.SphereGeometry(10, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1).translate(x, y + L.h + 1.2, z), '#e2e0d8'));
  const wing = (b0, b1, d0, d1) => {
    const [a0, e0] = at(b0, d0), [a1, e1] = at(b1, d1), len = Math.hypot(a1 - a0, e1 - e0);
    const f = frameOf({ at: F.xz((a0 + a1) / 2, (e0 + e1) / 2) }, y, (Math.atan2(e1 - e0, a1 - a0) * 180) / Math.PI);
    parts.push(f.box(0, 0, -2, 12, len, 13, wall), ...gable(f, -len / 2, len / 2, 13.6, 10, 4.5, slate));
  };
  wing(55, 55, 26, 128); wing(117, 117, 26, 122); wing(55, 117, 128, 122);
  const ring = [at(240, 40), at(10, 40), at(52, 150), at(85, 150), at(120, 145), at(160, 45)];
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; parts.push(beam(F.P(p[0], p[1], 3), F.P(q[0], q[1], 3), 9, 10, stone)); }
  const [ra, re] = at(85, 72), R = frameOf({ at: F.xz(ra, re) }, y, 85); parts.push(R.box(0, 0, -1, 9, 24, 13, '#a3432f'), ...gable(R, -12, 12, 13.6, 8, 4, '#3e3c3c'));
}
// Green Point's lighthouse: the square tower in its red and white diagonal stripes, the gallery and the lantern
function greenPoint(L, parts) {
  const [x, z] = L.at, y = L.ground === 0 ? 0 : Math.max(0, groundAt(x, z)), F = frameOf(L, y, 0), H = L.h, w = 5.2, T = H - 3.4;
  for (let k = 0; k < 4; k++) {
    const q = (k * Math.PI) / 2, ca = Math.cos(q), sa = Math.sin(q);
    parts.push(sheet((s, t) => { const u = (s - 0.5) * w; return F.P(ca * w / 2 - sa * u, sa * w / 2 + ca * u, t * T); }, 16, 40, (s, t) => (((s * w + t * T) / 2.2) % 2 < 1 ? '#c8352c' : '#f3f1ea')));
  }
  parts.push(F.box(0, 0, T, 0.5, w + 1.4, w + 1.4, '#f3f1ea'), F.box(0, 0, T + 0.5, 0.9, w + 1.2, w + 1.2, '#3a3f43'));
  parts.push(post(x, z, y + T + 0.5, 1.7, 1.7, 2.3, '#2c3338', 12), tint(new THREE.ConeGeometry(2, 1.3, 12).translate(x, y + T + 3.45, z), '#c8352c'));
}
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
        // (the Golden Gate's own: its side spans 343 m, its deep stiffening trusses, its towers, cables in its orange too)
        const gg = L.style === 'golden-gate', D = L.deck, H = L.h, side = gg ? 343 : S * 0.42, grey = L.color || '#7d8a8f', cable = gg ? '#b3382c' : L.color ? '#8a2a22' : '#3a4144';
        const deckY = (u) => { const a = Math.abs(u); return a <= S / 2 + side ? D : Math.max(12, D - (a - S / 2 - side) * ((D - 12) / Math.max(1, half - S / 2 - side))); };
        for (let u = -half; u < half; u += 50) parts.push(beam(P(u, deckY(u)), P(u + 50, deckY(u + 50)), gg ? 27 : 22, gg ? 7.6 : 3, L.color || '#6a7276'));
        for (let u = -half + 25; u < half; u += 75) if (Math.abs(u) > S / 2 + side + 20) parts.push(beam(P(u, -2), P(u, deckY(u) - 1.5), 6, 6, grey)); // under the approaches only: the spans hang from the cables
        const cv = gg ? 14 : 12, cw = gg ? 1.5 : 0.9;
        for (const sd of [-1, 1]) {
          if (gg) { goldenGateTower(P, Math.atan2(du.z, du.x), (sd * S) / 2, D, H, L.color, parts); continue; }
          for (const v of [-12, 12]) parts.push(beam(P(sd * S / 2, -2, v), P(sd * S / 2, H, v), 5, 5, grey));
          for (const y of [D - 4, H * 0.62, H - 3]) parts.push(beam(P(sd * S / 2, y, -12), P(sd * S / 2, y, 12), 3, 4, grey));
        }
        for (const v of [-cv, cv]) {
          const main = (u) => D + 4 + (H - D - 4) * (2 * u / S) ** 2, sideY = (u) => { const t = (Math.abs(u) - S / 2) / side; return H - (H - D - 2) * t ** 0.8; };
          for (let u = -S / 2; u < S / 2; u += 20) {
            parts.push(beam(P(u, main(u), v), P(u + 20, main(u + 20), v), cw, cw, cable));
            if (u > -S / 2) parts.push(beam(P(u, main(u), v), P(u, D, v), 0.25, 0.25, cable));
          }
          for (const sd of [-1, 1]) for (let t = 0; t < side; t += 20) {
            const u0 = sd * (S / 2 + t), u1 = sd * (S / 2 + Math.min(side, t + 20));
            parts.push(beam(P(u0, sideY(u0), v), P(u1, sideY(u1), v), cw, cw, cable));
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
      } else if (L.style === 'boc') {
        // the Bank of China Tower: a square of glass split corner to corner into four triangular shafts, each stopping
        // higher than the last, its top sloping down from the middle to its corners; the two white masts on the highest. `b` a corner
        const [bx, bz] = L.b, cx = bx - x, cz = bz - z, glass = '#4c5f70', top = (L.h - 52) / 315;
        const corner = (k) => { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [x + cx * c - cz * s, z + cx * s + cz * c]; };
        const H = [198, 231, 270, 315].map((h) => h * top);
        for (let k = 0; k < 4; k++) {
          const [ax, az] = corner(k), [qx, qz] = corner(k + 1), h = H[k];
          const t0 = [x, y + h, z], t1 = [ax, y + h - 30, az], t2 = [qx, y + h - 30, qz], b0 = [x, y - 2, z], b1 = [ax, y - 2, az], b2 = [qx, y - 2, qz];
          const pos = [], tri = (a, b, c) => pos.push(...a, ...b, ...c, ...a, ...c, ...b); // both ways round: seen from either side
          tri(t0, t1, t2); for (const [a, b, ta, tb] of [[b0, b1, t0, t1], [b1, b2, t1, t2], [b2, b0, t2, t0]]) { tri(a, ta, tb); tri(a, tb, b); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
          parts.push(tint(g, glass));
        }
        for (const k of [3, 4]) { const [mx, mz] = corner(k); parts.push(post(x + (mx - x) * 0.3, z + (mz - z) * 0.3, y + H[3] - 12, 1.1, 0.4, L.h - H[3] + 12, '#e8e8e4', 8)); }
      } else if (L.style === 'alphabet') { // Batumi's Alphabetic Tower: the core, the double helix of the letters round it, the glass ball, the mast
        const steel = '#c9cdd0', H = L.h, top = H * 0.78, N = 44;
        parts.push(post(x, z, y, 3.4, 2.6, top, '#e4e6e6', 10));
        for (const a0 of [0, Math.PI]) for (let i = 0; i < N; i++) {
          const p = (k) => { const a = a0 + k * 0.42; return V3(x + Math.cos(a) * 6.5, y + (top - 6) * k / N, z + Math.sin(a) * 6.5); };
          parts.push(beam(p(i), p(i + 1), 1.6, 2.4, steel));
        }
        parts.push(tint(new THREE.SphereGeometry(8, 16, 10).translate(x, y + top + 4, z), '#3b4a55'), post(x, z, y + top + 11, 1.4, 0.4, H - top - 11, steel, 8));
      } else if (L.style === 'pyramid') pyramid(L, parts);
      else if (L.style === 'glories') glories(L, parts);
      else if (L.style === 'laboe') laboe(L, parts);
    } else if (L.kind === 'lighthouse') {
      const [x, z] = L.at, y = L.ground === 0 ? 0 : Math.max(0, groundAt(x, z)), h = L.h;
      if (y <= 0.5 && L.style !== 'maiden') parts.push(post(x, z, -3, 7, 7, 5, '#9a958a'));
      if (L.style === 'vittoria') vittoria(L, parts);
      else if (L.style === 'maiden') maiden(L, parts);
      else if (L.style === 'green-point') greenPoint(L, parts);
      else if (L.style === 'candle') { // Enoshima's Sea Candle: a slim shaft, an open lattice flaring out to the lantern deck
        parts.push(post(x, z, y, 3, 2.4, h - 10, '#e8e6e0'), post(x, z, y + h - 22, 4, 9, 12, '#d8d6d0', 16), post(x, z, y + h - 10, 7, 7, 6, '#3b4a55', 16), post(x, z, y + h - 4, 7.5, 3, 4, '#e8e6e0', 16));
      } else parts.push(post(x, z, y, 3.6, 2.3, h - 6, '#f2efe8'), post(x, z, y + h - 6, 2.6, 2.6, 3.5, '#2a3238'), tint(new THREE.ConeGeometry(2.9, 2.6, 12).translate(x, y + h - 1.3, z), '#a8322a'));
    } else if (L.kind === 'spires') sagrada(L, parts);
    else if (L.kind === 'cathedral') laSeu(L, parts);
    else if (L.kind === 'fort') carlsten(L, parts);
    else if (L.kind === 'basilica') garde(L, parts);
    else if (L.kind === 'statue') redeemer(L, parts);
    else if (L.kind === 'opera') operaHouse(L, parts);
    else if (L.kind === 'spire') {
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
      // its ends: on each bank a granite abutment from the last span out to where the land is (the map's ends can stop
      // short of it), then the roadway down from the deck to the street
      for (const [u, sd] of [[0, -1], [len, 1]]) {
        let reach = 60; for (let t = 0; t <= 60; t += 1.5) { const q = P(u + sd * t, 0); if (groundAt(q.x, q.z) > 1) { reach = t; break; } }
        const e0 = u - sd * 4.5, e1 = u + sd * (reach + 6), c = P((e0 + e1) / 2, 0);
        parts.push(blk(c.x, c.z, -3, D + 3 - 0.8, Math.abs(e1 - e0), W + 5, ang, stone));
        const f = P(e1, 0), g0 = Math.max(0.6, groundAt(f.x, f.z)), run = Math.max(12, (D - g0) * 7), f1 = P(e1 + sd * run, 0);
        parts.push(wedge(f, f1, D + 0.8, g0 + 0.15, g0 - 1, W, '#4b4f50'), wedge(f, f1, D + 0.6, g0 + 0.05, g0 - 1.5, W + 4, stone));
        parts.push(beam(P(e0, D), P(e1, D), W, 1.6, '#4b4f50'));
      }
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
    } else if (L.kind === 'wheel') {
      // a big wheel on the shore, L.h to its top, turning in the plane through `at` and `b`: the two rims and their
      // spokes, the legs splayed down to the ground on each side, the gondolas hanging from the rim
      const [x, z] = L.at, [bx, bz] = L.b, len = Math.hypot(bx - x, bz - z), ux = (bx - x) / len, uz = (bz - z) / len;
      const y = Math.max(0, groundAt(x, z)) + (L.base || 0), R = L.h / 2 - 2, cy = y + L.h - R - 1.5, white = '#eeeeea', N = 32; // (base: on a pier's deck)
      const P = (a, r, v) => V3(x + ux * Math.cos(a) * r - uz * v, cy + Math.sin(a) * r, z + uz * Math.cos(a) * r + ux * v);
      for (const v of [-2.2, 2.2]) for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        parts.push(beam(P(a0, R, v), P(a1, R, v), 0.7, 0.9, white));
        if (i % 2 === 0) parts.push(beam(P(0, 0, v), P(a0, R, v), 0.25, 0.25, white));
      }
      parts.push(beam(P(0, 0, -3), P(0, 0, 3), 1.6, 1.6, '#9a9c9e'));
      for (const v of [-4.5, 4.5]) for (const s of [-1, 1]) parts.push(beam(P(0, 0, v * 0.6), V3(x + ux * s * R * 0.55 - uz * v, y - 1, z + uz * s * R * 0.55 + ux * v), 1.1, 1.1, white));
      const cab = ['#d8443a', '#e8a43a', '#3a8ad8', '#4fb06a'];
      for (let i = 0; i < 16; i++) { const p = P((i / 16) * Math.PI * 2, R, 0); parts.push(tint(new THREE.BoxGeometry(2.4, 2.6, 2.4).translate(p.x, p.y - 2.2, p.z), cab[i % 4])); }
    } else if (L.kind === 'temple') {
      // the Parthenon on the Acropolis: the stepped base, the peristyle of marble columns (8 at each end, 17 down each
      // side), the entablature over them; its long axis from `at` towards `b`
      const [x, z] = L.at, [bx, bz] = L.b, y = Math.max(0, groundAt(x, z)), marble = '#dccfb2';
      const len = Math.hypot(bx - x, bz - z), ux = (bx - x) / len, uz = (bz - z) / len, ang = Math.atan2(uz, ux);
      const W = 69.5, D = 30.9, at = (u, v) => [x + ux * u - uz * v, z + uz * u + ux * v];
      for (let s = 0; s < 3; s++) parts.push(blk(x, z, y - 2 + s * 0.55, 2.55, W + 4 - s * 1.4, D + 4 - s * 1.4, ang, s ? marble : '#b8ab92'));
      const cols = [];
      for (let i = 0; i < 17; i++) for (const sd of [-1, 1]) cols.push([-W / 2 + 1.8 + i * (W - 3.6) / 16, sd * (D / 2 - 1.8)]);
      for (let i = 1; i < 7; i++) for (const sd of [-1, 1]) cols.push([sd * (W / 2 - 1.8), -D / 2 + 1.8 + i * (D - 3.6) / 7]);
      for (const [u, v] of cols) { const [cx, cz] = at(u, v); parts.push(post(cx, cz, y + 1.6, 1, 0.8, 10.4, marble, 8)); }
      parts.push(blk(x, z, y + 12, 3.3, W - 0.6, D - 0.6, ang, marble));
    } else if (L.kind === 'castle') {
      // a hilltop castle of the Turkish coast (Marmaris's, Suleiman's of 1522; Fethiye's, the Knights'): its curtain wall
      // round the summit, L.h high, square towers at its corners, the merlons along the top; `ruin`, broken down in
      // stretches, its keep's stump (`keep`) standing taller than the rest. The walls' corners traced from the air (`ring`;
      // without one, a summit's ring of some 70 by 50 m). Each piece of wall on the hill's own ground
      const [x, z] = L.at, stone = L.ruin ? '#a8987c' : '#c2b296', dark = L.ruin ? '#8e806a' : '#a89a80', H = L.h;
      const ring = L.ring ? L.ring.map(([px, pz]) => [px - x, pz - z]) : [[-34, -16], [-18, -27], [12, -25], [33, -12], [36, 10], [18, 24], [-10, 26], [-31, 12]];
      const gy = (px, pz) => Math.max(0, groundAt(px, pz));
      ring.forEach(([ax, az], i) => {
        const [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
        const n = Math.max(1, Math.round(len / 8));
        for (let k = 0; k < n; k++) {
          const u0 = k / n, u1 = (k + 1) / n, cx = x + ax + (bx - ax) * (u0 + u1) / 2, cz = z + az + (bz - az) * (u0 + u1) / 2;
          const broken = L.ruin && ((i * 7 + k * 3) % 5 === 0), h = broken ? H * 0.3 : L.ruin ? H * (0.65 + 0.35 * (((i + k) * 5) % 3) / 2) : H;
          const y0 = gy(cx, cz) - 3; parts.push(blk(cx, cz, y0, h + 3, len / n + 0.6, 2.6, ang, stone));
          if (!L.ruin) for (const s of [0.25, 0.75]) { const u = u0 + (u1 - u0) * s; parts.push(blk(x + ax + (bx - ax) * u, z + az + (bz - az) * u, y0 + h + 3, 1.2, 1.4, 2.6, ang, stone)); }
        }
        // a tower at a corner between two long walls (not at every jog of a traced outline); a ruin's at every other one
        const [px, pz] = ring[(i + ring.length - 1) % ring.length], long = len >= 7 && Math.hypot(ax - px, az - pz) >= 7;
        if (long && (i % 2 === 0 || !L.ruin)) { const tx = x + ax, tz = z + az, th = L.ruin ? H * 0.9 : H + 3.5, tw = L.ring && !L.ruin ? 5.5 : 7.5; parts.push(blk(tx, tz, gy(tx, tz) - 3, th + 3, tw, tw, ang, dark)); }
      });
      if (L.keep) { const [kx, kz] = L.keep; parts.push(blk(kx, kz, gy(kx, kz) - 3, H * 1.7 + 3, 9, 9, 0.2, dark)); }
      if (!L.ruin) { const y = gy(x, z); parts.push(blk(x - 4, z + 2, y - 2, 7, 18, 10, 0.3, '#d8ccb4'), blk(x - 4, z + 2, y + 5, 0.6, 19, 11, 0.3, '#b4603e')); } // the museum's house inside
    } else if (L.kind === 'tombs') {
      // Fethiye's Lycian rock tombs: temple fronts cut into the face of the cliff above the town, the Tomb of Amyntas
      // (L.h high, two Ionic columns between its pilasters under the pediment, the doorway dark behind) and its smaller
      // neighbours along the face, each in its cut of the hill's rock, facing down the hill
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), rock = '#bcb09a', face = '#d4c8ae', dark = '#4a4238', H = L.h;
      const e = 12, gx = groundAt(x + e, z) - groundAt(x - e, z), gz = groundAt(x, z + e) - groundAt(x, z - e), gl = Math.hypot(gx, gz) || 1;
      const nx = -gx / gl, nz = -gz / gl, ang = Math.atan2(nx, -nz); // outwards, down the slope; the front's length across it
      const at = (u, v) => [x + nz * -u + nx * v, z + nx * u + nz * v]; // u along the cliff, v out from it
      const front = (u, w, h, y0, cols) => {
        const [cx, cz] = at(u, 0), [dx, dz] = at(u, 0.6), [rx, rz] = at(u, -3);
        parts.push(blk(rx, rz, y0 - 4, h + 7, w + 7, 6, ang, rock)); // the rock it is cut in, its back in the slope
        parts.push(blk(cx, cz, y0, h * 0.12, w + 1, 2.4, ang, face)); // the steps
        for (const s of [-1, 1]) { const [px, pz] = at(u + s * (w / 2 - 0.6), 0.9); parts.push(blk(px, pz, y0 + h * 0.12, h * 0.6, 1.2, 1.2, ang, face)); }
        for (let k = 0; k < cols; k++) { const [px, pz] = at(u + (k + 1) * w / (cols + 1) - w / 2, 1.2); parts.push(post(px, pz, y0 + h * 0.12, w * 0.05, w * 0.045, h * 0.6, face, 10)); }
        parts.push(blk(dx, dz, y0 + h * 0.12, h * 0.6, w - 1.4, 0.4, ang, dark)); // the porch's shade, the doorway
        parts.push(blk(cx, cz, y0 + h * 0.72, h * 0.1, w + 0.6, 2.8, ang, face));
        const p0 = V3(-w / 2 - 0.3, 0, 0), p1 = V3(w / 2 + 0.3, 0, 0), p2 = V3(0, h * 0.18, 0);
        const g = new THREE.BufferGeometry().setFromPoints([p0, p1, p2, p0, p2, p1]); // (both faces)
        const [qx, qz] = at(u, 1.4); g.rotateY(-ang).translate(qx, y0 + h * 0.82, qz); g.computeVertexNormals(); parts.push(tint(g, face)); // the pediment
      };
      front(0, H * 0.85, H, y, 2);
      for (const [u, s, dy] of [[-17, 0.6, 3], [-29, 0.5, 1], [15, 0.55, 0], [26, 0.45, 4]]) front(u, H * 0.85 * s, H * s, Math.max(0, groundAt(...at(u, 0))) + dy, 0); // (each on its own ground, some up the face)
    } else if (L.kind === 'theatre') {
      // an ancient theatre (Telmessos's, on Fethiye's harbour front): the half round of its seats, L.r across, rising in
      // tiers up the slope from the orchestra at `at` towards `b`, the stage's foundations across its open side
      const [x, z] = L.at, [bx, bz] = L.b, y = Math.max(0, groundAt(x, z)), stone = '#cfc3a6', R = L.r, n = 9;
      const ang = Math.atan2(bz - z, bx - x); // towards the seats
      for (let k = 0; k < n; k++) {
        const r0 = R * (0.3 + 0.7 * k / n), r1 = R * (0.3 + 0.7 * (k + 1) / n), sh = new THREE.Shape();
        sh.absarc(0, 0, r1, -Math.PI / 2, Math.PI / 2, false); sh.absarc(0, 0, r0, Math.PI / 2, -Math.PI / 2, true);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.9 * (k + 1) + 3, bevelEnabled: false, curveSegments: 16 });
        g.rotateX(-Math.PI / 2).translate(0, y - 3, 0).rotateY(-ang).translate(x, 0, z); // (the shape's +x, its middle, towards the seats)
        parts.push(tint(g, k % 2 ? stone : '#c4b89b'));
      }
      parts.push(blk(x - Math.cos(ang) * 4, z - Math.sin(ang) * 4, y - 1, 2.2, 5, R * 1.7, ang, '#b8ab90')); // the stage
    } else if (L.kind === 'sarcophagus') {
      // a Lycian sarcophagus (Fethiye's, in its streets and under the rock tombs): the stepped plinth, the chest, and its
      // pointed lid like an upturned boat's hull, its ridge along L.dir
      const y = Math.max(0, groundAt(...L.at)), F = frameOf(L, y), stone = '#c9bda4';
      parts.push(F.box(0, 0, -1, 2.6, 4.2, 3, '#b3a68c'), F.box(0, 0, 1.6, 2.2, 3.2, 2, stone), F.box(0, 0, 3.8, 0.35, 3.6, 2.4, stone));
      const arch = new THREE.Shape().moveTo(-1.25, 0).quadraticCurveTo(-1.15, 1.2, 0, 1.9).quadraticCurveTo(1.15, 1.2, 1.25, 0).lineTo(-1.25, 0);
      const lid = new THREE.ExtrudeGeometry(arch, { depth: 3.5, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -1.75).rotateY(Math.PI / 2);
      const [lx, lz] = F.xz(0, 0); lid.rotateY(-F.ang).translate(lx, y + 4.15, lz); parts.push(tint(lid, stone)); // (its ridge along L.dir)
    } else if (L.kind === 'monument') {
      // a statue on its square (Atatürk's, on Marmaris's and Fethiye's seafronts): the stone pedestal, the bronze figure, L.h tall
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), bronze = '#4f4a3e';
      parts.push(blk(x, z, y - 1, 1.6, 6, 6, 0, '#c8c0b0'), blk(x, z, y + 0.6, 3.4, 2.6, 2.6, 0, '#ddd6c8'));
      const F = frameOf(L, y + 4), H = L.h; // the figure standing, facing L.dir: legs, the coat over the body, the shoulders, the head
      for (const b of [-0.22, 0.22]) parts.push(F.box(0, b, 0, H * 0.47, 0.34, 0.3, bronze));
      parts.push(F.box(0, 0, H * 0.3, H * 0.5, 0.5, 0.95, bronze), F.box(0, 0, H * 0.72, H * 0.08, 0.5, 1.25, bronze));
      { const [hx, hz] = F.xz(0, 0); parts.push(tint(new THREE.SphereGeometry(H * 0.065, 10, 8).translate(hx, y + 4 + H * 0.88, hz), bronze)); }
    } else if (L.kind === 'flag') {
      // a Turkish flag on its pole (the great ones over Marmaris's and Fethiye's castles): red, the white crescent and
      // star near the hoist, L.w long, flying out downwind (the race's wind is from −z) in a gentle ripple
      const [x, z] = L.at, y = Math.max(0, groundAt(x, z)), H = L.h, w = L.w, fh = w * 2 / 3;
      parts.push(post(x, z, y - 1, 0.06 * H ** 0.5, 0.035 * H ** 0.5, H + 1, '#d8d8d4', 8), tint(new THREE.SphereGeometry(0.05 * H ** 0.5 + 0.08, 8, 6).translate(x, y + H + 0.1, z), '#d6a43a'));
      const wave = (u) => Math.sin(u * Math.PI * 2.2) * 0.07 * w * u; // across the cloth, more towards the fly
      const cloth = new THREE.BoxGeometry(w, fh, 0.06, 16, 1, 1).translate(w / 2, 0, 0), q = cloth.attributes.position;
      for (let i = 0; i < q.count; i++) q.setZ(i, q.getZ(i) + wave(q.getX(i) / w));
      const put = (g, u, yy) => g.translate(0, yy, wave(u)).rotateY(-Math.PI / 2).translate(x, y + H - fh / 2 - 0.2, z);
      parts.push(tint(put(cloth, 0, 0), '#d6201e'));
      const disc = (r0, cx, cy, th, col) => parts.push(tint(put(new THREE.CylinderGeometry(r0, r0, th, 20).rotateX(Math.PI / 2).translate(cx, 0, 0), cx / w, cy), col));
      disc(fh * 0.25, fh * 0.5, 0, 0.1, '#f6f2ea'); disc(fh * 0.2, fh * 0.5625, 0, 0.14, '#d6201e'); // the crescent: a white disc, a red one over it
      disc(fh * 0.07, fh * 0.86, 0, 0.12, '#f6f2ea'); // (the star, round at this size)
    } else if (L.kind === 'boatyard') {
      // a yard's yachts ashore on their cradles, in rows across its ground (`ring`), masts up: sailing yachts mostly
      const ring = L.ring, ins = (px, pz) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) c = !c; } return c; };
      const [ax, az] = ring[0], [bx, bz] = ring[1], ang = Math.atan2(bz - az, bx - ax), ux = Math.cos(ang), uz = Math.sin(ang); // the rows along its first side
      const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]), R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      const [cx, cz] = L.at, rr = rng(77), sail = sailboatGeo(), motor = motorGeo(), cradle = '#4c5258';
      for (let a = -R; a < R; a += 16) for (let b = -R; b < R; b += 6) {
        const px = cx + ux * a - uz * b, pz = cz + uz * a + ux * b;
        if (!ins(px, pz) || !ins(px + ux * 7, pz + uz * 7) || !ins(px - ux * 7, pz - uz * 7) || rr() < 0.22) continue;
        const gy = groundAt(px, pz), isSail = rr() < 0.75, sc = 0.8 + rr() * 0.3, len = (isSail ? 13 : 15) * sc;
        // (a sailing yacht stands on her keel on its block, a motor yacht on her cradle; her cradle's pads up to her bilges)
        const lift = isSail ? 0.3 + 2.37 * sc : 1.4 + 0.85 * sc;
        const g = (isSail ? sail : motor).clone().scale(sc, sc, sc).translate(0, 0, len / 2).rotateY(-ang - Math.PI / 2 + (rr() < 0.5 ? 0 : Math.PI)).translate(px, gy + lift, pz);
        parts.push(g);
        for (const s2 of [-1, 1]) parts.push(blk(px + ux * s2 * len * 0.25, pz + uz * s2 * len * 0.25, gy - 0.5, lift + 0.5 - 0.45 * sc, 0.4, 2.8, ang + Math.PI / 2, cradle));
        if (isSail) parts.push(blk(px, pz, gy, 0.3, 2.6 * sc, 0.4, ang, '#3a3f44')); // the keel on its block
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
// as the land and the sea are, so a boat sailing under a cliff at sunset goes into its shade; and under a cloud's.
// And their sky light (the environment map's and the hemisphere's) cut as the land's is (LAND_FS: 0.475), so the
// side away from the sun is the shade it is: the sky map is drawn as bright as the eye sees the sky, which as light
// is far too much against the sun's, and a white hull seen against the sun stayed nearly as white as in it. Under a
// clear sky the shade is about a fifth of the sunlit side; under a cloud deck the sky is all the light there is, and
// keeps more of it (setLight).
const FILL_U = { uSkyFill: { value: 1 } };
export function inLandShadow(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.userData.landShade || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      m.userData.landShade = true;
      const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        Object.assign(sh.uniforms, { uShadeTex: LAND_U.uShadeTex, uShadeXf: LAND_U.uShadeXf, uLandShadeAt: LAND_U.uAt }, CLOUD_U, FILL_U);
        sh.vertexShader = 'uniform vec3 uLandShadeAt; varying vec2 vSunXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          { vec4 sw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
          #endif
            sw = modelMatrix * sw; vSunXZ = sw.xz + uLandShadeAt.xz; }`);
        sh.fragmentShader = 'uniform sampler2D uShadeTex; uniform vec3 uShadeXf; uniform float uSkyFill; varying vec2 vSunXZ;\n' + CLOUD_GLSL + '\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec2 g = (vSunXZ - uShadeXf.xy) * uShadeXf.z; float sun = (g.x > 0.0 && g.y > 0.0 && g.x < 1.0 && g.y < 1.0 ? texture2D(uShadeTex, g).r : 1.0) * cloudShade(vec3(vSunXZ.x, 0.0, vSunXZ.y));
            reflectedLight.directDiffuse *= sun; reflectedLight.directSpecular *= sun;
          #ifdef STANDARD
            reflectedLight.indirectDiffuse *= uSkyFill;
          #endif
          }`);
      };
      m.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|landshade'; };
      m.needsUpdate = true;
    }
  });
  return root;
}

// Where the canopy's height (LIFT_VS) is kept off: round every building (the ground town() took for them) and every
// landmark, a cell wider, on the roads' grid, so a house or a lighthouse in the woods stands in its own clearing
function liftMask() {
  const n = NEAR.n, a = new Uint8Array(n * n);
  const put = (x, z) => {
    const i = Math.floor((x - NEAR.x0) / NEAR.cell), j = Math.floor((z - NEAR.x0) / NEAR.cell);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < n && jj < n) a[jj * n + ii] = 255; }
  };
  for (const k of TAKEN) { const c = k.indexOf(','); put(+k.slice(0, c) * 9, +k.slice(c + 1) * 9); }
  for (const L of META.landmarks || []) {
    if (L.at) for (let dx = -36; dx <= 36; dx += 9) for (let dz = -36; dz <= 36; dz += 9) put(L.at[0] + dx, L.at[1] + dz);
    if (L.a && L.b) { // a bridge: along its approaches
      const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]) || 1, ux = (L.b[0] - L.a[0]) / len, uz = (L.b[1] - L.a[1]) / len;
      for (let d = -200; d <= len + 200; d += 8) for (const o of [-24, -12, 0, 12, 24]) put(L.a[0] + ux * d - uz * o, L.a[1] + uz * d + ux * o);
    }
  }
  return gridTex(a, n, true);
}

// ---------- all of it ----------
export class Skopea {
  // skyU: the sky's uniforms (light.js), for the haze
  constructor(skyU) {
    SKY_U = skyU;
    Object.assign(CLOUD_U, { uCsRipple: skyU.uRipple, uCsCloud: skyU.uCloud, uCsSun: skyU.uSun }); // the sky's own, shared
    this.group = new THREE.Group();
    this.land = terrain(); this.far = far(); this.trees = pines(16000); this.farTrees = pines(9000, true); this.town = town(); this.boats = marinas();
    this.rocks = shoreRocks(); this.boats.add(this.rocks); // (with the boats: what the sea mirrors along its edge)
    this.landmarks = landmarks(); if (this.landmarks) this.town.add(this.landmarks);
    GROUND_U.uLiftMask.value = liftMask();
    this.group.add(this.far, this.land, this.trees, this.farTrees, this.town, this.boats);
    this.group.traverse((o) => { if (o.isMesh) o.matrixAutoUpdate = false; });
    this.movers = movers(); this.group.add(this.movers); // (after: the boats moved each frame keep their own matrices)
    // what casts the shadows on the land (shadows()): the terrain, the buildings and the trees, not the land beyond
    for (const g of [this.land, this.town, this.trees]) g.traverse((o) => o.layers.enable(SHADOW_LAYER));
    // what the sea needs of the land: the depth (lighter over the shallows), the shadows, how far from the shore (the surf)
    const W = LOOK.water || {};
    this.waterU = {
      uSeabed: { value: gridTex(P.depth, GN, true) }, uShallow: { value: C(W.shallow || '#4aa79a') }, uShallowK: { value: W.clear ?? 0.45 },
      uLandAt: LAND_U.uAt, uGridXf: LAND_U.uGridXf, uShadeXf: LAND_U.uShadeXf, uShadeTex: LAND_U.uShadeTex,
      uShore: { value: gridTex(P.shore, NEAR.n, true) }, uCalm: { value: gridTex(P.calm, NEAR.n, true) }, uNearXf: GROUND_U.uNearXf,
      ...CLOUD_U,
    };
  }
  // the race's start at its place in the bay
  place(at) { this.group.position.set(-at.x, 0, -at.z); this.group.updateMatrixWorld(true); LAND_U.uAt.value.set(at.x, 0, at.z); }
  // the light of the race (light.js): the haze as thick as the sea's, the lakes' colour, the shadows from where the sun is
  setLight(L, renderer) {
    LAND_U.uHazeL.value = L.fogFar * 2.4 * (LOOK.haze ?? 1); // (how clear the venue's air is: venues.js)
    LAND_U.uMist.value = L.mist || 0;
    FILL_U.uSkyFill.value = 1 - 0.65 * (L.shade ?? 1); // the boats' sky light (inLandShadow): 0.35 under a clear sky, most of it under cloud
    GROUND_U.uLake.value.copy(L.deep).lerp(L.horizon, 0.35);
    if (renderer) shadows(renderer, this.group, L.sunDir);
  }
  // each frame: the near trees' tiles far from the camera drawn as plain crowns; the clouds' shadows on the race's clock
  update(cam, t = 0) {
    CLOUD_U.uCsT.value = t;
    this.movers.userData.update(t);
    const gp = this.group.position;
    for (const t of this.rocks.userData.tiles) t.mesh.visible = this.rocksOn !== false && Math.hypot(t.x + gp.x - cam.x, t.z + gp.z - cam.z) - t.r < ROCKS_NEAR;
    for (const b of this.boats.userData.tiles) { // (a tile's boats near: drawn as they are, and out of their batch)
      const near = Math.hypot(b.x + gp.x - cam.x, b.z + gp.z - cam.z) - b.r < BOATS_NEAR;
      for (const m of b.near) m.visible = near && (!m.userData.rig || this.rigging !== false);
      if (near === b.isNear) continue;
      b.isNear = near;
      for (const [fm, i, m4] of b.far) { fm.setMatrixAt(i, near ? NOWHERE : m4); fm.instanceMatrix.needsUpdate = true; }
    }
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
    GROUND_U.uCanopy.value = q === 'low' ? 0 : 1;
    this.rigging = q !== 'low'; // (the moored boats' rigging: not on the lowest)
    this.rocksOn = q !== 'low'; // (nor the rocks along the shore; half of them on the middle one)
    for (const t of this.rocks.userData.tiles) t.mesh.count = Math.round(t.mesh.userData.max * (q === 'high' ? 1 : 0.5));
  }
}
