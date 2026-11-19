// Regatta: the racing yacht, built in code — the JPK 1050, a 34-foot offshore racer, to JPK's drawings (the
// half-breadth plan, the deck plan and the brochure's sail plan): lofted hull (scow-inspired, a wide transom with twin
// lifting rudders, the windward one kicked up when she heels), deck and fittings, a tiller, a carbon mast near
// amidships with one set of wide swept spreaders and twin backstays, square-top main with battens and a sail number,
// a 106% genoa, asymmetric gennaker on a fixed bowsprit.
// Local frame: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rigidSkin } from './skin.js';
import { fineLibrary, fineFigure, fineMotion } from './sailor-hi.js';
import { sponsor } from './sponsor.js';
import { D2R, NO_GO, clamp, lerp, waveHeight } from './sim.js';
import { VENUE } from './venues.js';
import { SWELL_GLSL } from './ocean.js';
// a file next to this module, by the address the page's import map gives it: its content's hash after a deploy
// (scripts/stamp-game.mjs), so it is cached for good; the plain address where there is none (npm run dev)
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);

export const L = 10.45, B = 3.54, MAST_Z = -0.45; // the mast's foot 5.65 m forward of the transom (the sail plan)
const BOW_Z = -L / 2, STERN_Z = L / 2;

// ---------- the lines ----------
// t = 0 at the transom, 1 at the stem
// a smooth curve through the points [t, v]: cubic Hermite, the slopes from the neighbours (blender/yacht.py's spline)
function spline(P, t) {
  t = clamp(t, P[0][0], P[P.length - 1][0]);
  let i = 0; while (i < P.length - 2 && t > P[i + 1][0]) i++;
  const [t0, v0] = P[i], [t1, v1] = P[i + 1], h = t1 - t0, u = (t - t0) / h;
  const sl = (k) => { const a = P[Math.max(k - 1, 0)], b = P[Math.min(k + 1, P.length - 1)]; return (b[1] - a[1]) / (b[0] - a[0]); };
  const m0 = sl(i) * h, m1 = sl(i + 1) * h;
  return (2 * u ** 3 - 3 * u * u + 1) * v0 + (u ** 3 - 2 * u * u + u) * m0 + (-2 * u ** 3 + 3 * u * u) * v1 + (u ** 3 - u * u) * m1;
}
// the deck's half-breadth, a share of the widest, read off JPK's half-breadth plan (blender/yacht.py's HB): the widest
// a quarter of the way forward, the transom 95% of it, the bow full to a rounded nose
const HB = [[0, 0.95], [0.05, 0.96], [0.1, 0.976], [0.15, 0.988], [0.2, 0.996], [0.25, 1], [0.3, 1], [0.35, 0.992], [0.4, 0.98],
  [0.45, 0.96], [0.5, 0.929], [0.55, 0.893], [0.6, 0.842], [0.65, 0.787], [0.7, 0.719], [0.75, 0.644], [0.8, 0.557],
  [0.85, 0.455], [0.9, 0.344], [0.95, 0.213], [0.98, 0.12], [1, 0]];
const halfBeam = (t) => (B / 2) * Math.max(0, spline(HB, t));
export const sheerAt = (t) => 1.04 + 0.17 * t ** 1.6;
// the keel line, metres below the water (− above), off the brochure's profile (blender/yacht.py's CANOE): the
// transom's bottom clear of the water, 0.4 deep amidships, the forefoot 0.32 up at the stem
const CANOE = [[0, -0.24], [0.1, -0.07], [0.2, 0.04], [0.3, 0.17], [0.4, 0.33], [0.5, 0.4], [0.6, 0.38], [0.7, 0.31],
  [0.8, 0.21], [0.9, 0], [0.95, -0.13], [1, -0.32]];
const canoe = (t) => spline(CANOE, t);
const zAt = (t) => STERN_Z - t * L;
const tAt = (z) => clamp((STERN_Z - z) / L, 0, 1);
const deckY = (z) => sheerAt(tAt(z));
const hbAt = (z) => halfBeam(tAt(z));
// the coachroof (blender/yacht.py's): from its aft face (z = 1.96) to where it runs out on the foredeck (z = −3.15);
// roofHalf its half-width at the foot, roofTop its top at the middle — 1.71 above the water aft, level to the mast,
// then ramping down into the deck. The cockpit (COCKPIT, its outline to starboard) and its floor
const CR_ZA = 1.96, CR_ZF = -3.15, CR_W = [[0, 1.09], [1.96, 0.85], [3.91, 0.6], [4.61, 0.52], [5.11, 0.3]];
const roofHalf = (z) => spline(CR_W, CR_ZA - z);
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const roofTop = (z) => 0.03 + (z > -0.34 ? lerp(1.71, 1.65, (CR_ZA - z) / 2.3) : lerp(1.65, deckY(z) + 0.04, smoothstep(-0.34, CR_ZF, z)));
// the hatch garage moulded into the roof aft of the mast (blender/yacht.py's GARAGE): a rounded hump the sliding hatch
// runs on, x its half-width, z0 … z1 its forward and aft ends, h its height above the roof
const GARAGE = { x: 0.405, z0: 0.18, z1: 1.66, h: 0.12 };
const COCKPIT = [[0.66, CR_ZA], [1.0, 2.9], [1.0, 3.95], [1.3, STERN_Z - 0.17]], FLOOR = 0.62;
const cockpitHalf = (z) => { // the cockpit's half-width at z, straight between the outline's corners
  let i = 0; while (i < COCKPIT.length - 2 && z > COCKPIT[i + 1][1]) i++;
  const [x0, z0] = COCKPIT[i], [x1, z1] = COCKPIT[i + 1];
  return lerp(x0, x1, clamp((z - z0) / (z1 - z0), 0, 1));
};
// a foil lofted between two NACA 00xx sections: the root at y = 0, the tip `span` below; c0, c1 the chords, th the
// thickness as a share of the chord, the axis a quarter of the chord back from the leading edge (−z). A rudder blade
export function foilGeo(span, c0, c1, th, n = 12) {
  const naca = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const sec = [];
  for (let i = 0; i <= n; i++) sec.push([(1 + Math.cos((Math.PI * i) / n)) / 2, 1]);
  for (let i = 1; i < n; i++) sec.push([(1 - Math.cos((Math.PI * i) / n)) / 2, -1]);
  const m = sec.length, pos = [], idx = [], ring = [[0, c0], [-span, c1]];
  for (const [y, c] of ring) for (const [x, sd] of sec) pos.push(sd * naca(x) * th * c, y, (x - 0.25) * c);
  for (let i = 0; i < m; i++) { const a = i, b = (i + 1) % m; idx.push(a, a + m, b, b, a + m, b + m); }
  ring.forEach(([y, c], r) => {
    const base = pos.length / 3;
    for (const [x, sd] of sec) pos.push(sd * naca(x) * th * c, y, (x - 0.25) * c);
    const ci = pos.length / 3; pos.push(0, y, 0);
    for (let i = 0; i < m; i++) r ? idx.push(ci, base + (i + 1) % m, base + i) : idx.push(ci, base + i, base + (i + 1) % m);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// the topsides' flare, as blender/yacht.py's FLARE: at the waterline the hull is this much narrower than at the deck
const FLARE = 0.09;
// one point of a section: s = 0 at the deck edge … 1 at the keel; a superellipse, boxy aft and still full forward
function section(t, s) {
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 2.0, clamp((t - 0.45) / 0.55, 0, 1));
  const phi = (s * Math.PI) / 2, c = Math.cos(phi), sn = Math.sin(phi), yr = sn ** (2 / n);
  const x = hb * c ** (2 / n) * (1 - FLARE * sn); // flare in the topsides: the waterline narrower than the deck
  let dz = 0;
  if (t > 0.88) dz = 0.38 * yr ** 1.6 * ((t - 0.88) / 0.12) ** 2; // the spoon bow: its foot curving back under it
  if (t < 0.03) dz -= 0.1 * yr * (1 - t / 0.03); // the transom raked: its bottom 10 cm forward of its top
  return [x, sy - (sy + d) * yr, dz];
}

// hull paint: gloss gelcoat with a boot-top, antifouling below it and a cove stripe under the sheer, drawn crisp in the shader.
// The topsides are lacquered: a clear coat over the colour, so a hull (a dark one most of all) shows its shape by what
// it mirrors — a band of sky along the topsides, the sea below it, the sun's highlight. The antifouling is matt.
//
// Where the hull meets the sea it is wet: the long swell (the same wave trains the boats ride, SEA, which world.js
// points at its water's) runs up and down the topsides and leaves them dark and glossy for a hand's width above it;
// under way the bow wave and its spray wet her higher forward, the faster she goes the higher, and the quarter wave
// a little aft. The white water itself is the sea's (world.js's wake field and hull contact), not painted on her.
// uSpd (0–1) and uHalfL (half her drawn length) are each boat's own (hullSea, set in world.js's settle).
// The sea's light on her, moving as the sea does (the environment map has the sea's mean, held still):
// - seaShimmer: what her clear coat mirrors of the water — the point of the sea her mirror ray meets — broken into
//   ripples drifting across it (streaks lying across the line of sight, as on the water itself), and where that
//   point is in the sun's glitter path, into sparkles that flash and go. Both have a mean of 1, so the map's
//   average stays; past where a sparkle would be under a pixel, they fade to it.
// - seaBounce: the sun reflected up off the water onto the faces turned to it and down (a stern, the topsides on the
//   sun's side, a flare): as much as the water reflects at the sun's height, gathered by the ripples into the bright
//   lines that run over a hull near the water, sharpest just over it.
// (World-space directions; vWP, uTime from the hull's own. A cheap value noise, steady at the course's sizes.)
const HULL_LIGHT_GLSL = /* glsl */ `
float hl_h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hl_n(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hl_h(i), hl_h(i + vec2(1.0, 0.0)), f.x), mix(hl_h(i + vec2(0.0, 1.0)), hl_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 seaShimmer(vec3 R, vec3 S, float hgt) {
  float seaK = smoothstep(-0.01, -0.08, R.y);
  if (seaK <= 0.0) return vec3(1.0);
  float dn = hgt / max(-R.y, 0.03); // how far off the water she mirrors here is
  vec2 Q = vWP.xz + R.xz * dn;
  // the ripples, as her curved side (a convex mirror, squeezing the sea up her side) shows them: thin bands along her,
  // wavering and running aft, laid on her own surface (vLP: along her, up her side); under a pixel, their mean
  vec2 hp = vec2(vLP.z / 1.4 + uTime * 0.35, vLP.y / 0.07);
  hp.y += 0.6 * sin(vLP.z * 2.3 - uTime * 1.6);
  float ripH = hl_n(hp) + hl_n(hp * vec2(1.7, 1.9) + vec2(0.41, -uTime * 0.5)); // mean 1
  float m = mix(1.0, ripH, seaK * 0.4 * (1.0 - smoothstep(0.15, 0.4, length(fwidth(hp * 1.9)))));
  // the glitter: how near this look is to the facets the sun glints in (the environment map's lobe), broken into
  // sparkles — the sea's facets, or squeezed so, points of light on her own skin — that flash and go
  vec3 h = normalize(S - R);
  float gl = S.y > 0.0 ? exp(-dot(h.xz, h.xz) / (h.y * h.y) / 0.03) : 0.0;
  if (gl > 0.01) {
    vec2 g = Q * 7.0, gH = vec2(vLP.z, vLP.y) * vec2(9.0, 30.0);
    float wq = 1.0 - smoothstep(0.15, 0.45, length(fwidth(g * 1.37))), wh = 1.0 - smoothstep(0.2, 0.5, length(fwidth(gH * 1.37)));
    vec2 gg = wq > 0.5 ? g : gH;
    float a = hl_n(gg + vec2(uTime * 2.1, -uTime * 1.4)), b = hl_n(gg * 1.37 + vec2(-uTime * 1.7, uTime * 2.3));
    float sp = pow(a * b, 3.0) * 27.0; // mean about 1: most of the time dark, now and then a flash many times over
    m *= mix(1.0, sp, gl * seaK * (wq > 0.5 ? wq : wh));
  }
  return vec3(m);
}
float seaBounce(vec3 N, vec3 S, float hgt) {
  if (S.y <= 0.0 || hgt < -0.02) return 0.0;
  vec3 Ld = vec3(S.x, -S.y, S.z); // the sun's image in the water, where the light comes up from
  float c = max(dot(N, Ld), 0.0);
  if (c <= 0.0) return 0.0;
  float Fs = 0.02 + 0.98 * pow(1.0 - S.y, 5.0), hg = max(hgt, 0.0);
  vec2 Q = vWP.xz + S.xz / max(S.y, 0.08) * hg; // the water that sends it here
  vec2 w1 = vec2(uTime * 0.55, uTime * 0.31), w2 = vec2(-uTime * 0.42, uTime * 0.6);
  float r1 = 1.0 - abs(hl_n(Q * 1.6 + w1) * 2.0 - 1.0), r2 = 1.0 - abs(hl_n(Q * 2.3 + w2) * 2.0 - 1.0);
  float caus = pow(r1 * r2, 5.0) * 15.0; // mean about 1, in bright threads
  float sharp = exp(-hg / 1.1) * (1.0 - smoothstep(0.5, 2.0, length(fwidth(Q * 2.0))));
  return c * Fs * mix(1.0, caus, sharp) * exp(-hg / 3.0) * smoothstep(-0.02, 0.04, hgt);
}`;

export const SEA = { uTime: { value: 0 }, uW: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uWs: { value: new Array(8).fill(0) } };
export function hullMaterial(hull, stripe, bottom = '#5b1f24') { // bottom: the antifouling, the player's choice (dark red on the others)
  const m = new THREE.MeshPhysicalMaterial({ color: hull, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const sea = (m.userData.sea = { uSpd: { value: 0 }, uHalfL: { value: L / 2 } });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStripe = { value: new THREE.Color(stripe) }; sh.uniforms.uBottom = { value: new THREE.Color(bottom) };
    Object.assign(sh.uniforms, SEA, sea);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float band; varying float vBand; varying float vY; varying vec3 vWP, vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = band; vY = position.y; vLP = position; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uStripe, uBottom; uniform float uTime, uSpd, uHalfL; uniform vec4 uW[8]; uniform float uWs[8];
      varying float vBand; varying float vY; varying vec3 vWP, vLP;
      ${SWELL_GLSL}
      float hullSea(vec2 xz) { float h = 0.0; for (int i = 0; i < 5; i++) h += uW[i].w * swellG(i, xz) * sin(uW[i].z * dot(uW[i].xy, xz) - uWs[i] * uTime + float(i) * 1.7); return h; }
      ${HULL_LIGHT_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float aa = fwidth(vY) * 1.2, ab = fwidth(vBand) * 1.2;
        float boot = smoothstep(0.07 - aa, 0.07 + aa, vY) * (1.0 - smoothstep(0.19 - aa, 0.19 + aa, vY));
        float under = 1.0 - smoothstep(0.07 - aa, 0.07 + aa, vY);
        float cove = smoothstep(0.1 - ab, 0.1 + ab, vBand) * (1.0 - smoothstep(0.135 - ab, 0.135 + ab, vBand));
        diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, max(boot, cove));
        diffuseColor.rgb = mix(diffuseColor.rgb, uBottom, under);
        // the sea against her: s runs −1 at the transom to 1 at the stem; the bow wave and the quarter wave raise the
        // water's line along her, the wet band reaches above it, and the white water fills up to it, broken in streaks
        float hS = -vLP.z / uHalfL, hK = uHalfL / 5.2;
        float bowW = uSpd * hK * (0.26 * smoothstep(0.3, 0.9, hS) * (1.0 - smoothstep(0.97, 1.08, hS)) + 0.08 * smoothstep(-0.55, -0.95, hS));
        float dh = vWP.y - hullSea(vWP.xz) - bowW; // height above the wetted line
        float wet = 1.0 - smoothstep(-0.04, 0.12 + 0.2 * uSpd * hK, dh);
        diffuseColor.rgb *= 1.0 - 0.22 * wet * (1.0 - under * 0.5);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= max(1.0 - under, wet); material.roughness = mix(mix(material.roughness, 0.75, under), 0.12, wet * 0.8);`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( USE_CLEARCOAT ) && NUM_DIR_LIGHTS > 0
        clearcoatRadiance *= seaShimmer(reflect(-geometryViewDir, geometryClearcoatNormal), (vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz, max(dh, 0.02));
        #endif`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        reflectedLight.directDiffuse += directionalLights[0].color * BRDF_Lambert(material.diffuseColor) * (1.0 - under)
          * seaBounce((vec4(geometryNormal, 0.0) * viewMatrix).xyz, (vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz, dh);
        #endif`);
  };
  m.customProgramCacheKey = () => 'hull';
  return m;
}
// each hull's wet-line uniforms, found once on a built boat (world.js sets their speed every frame)
export function hullSea(view, halfL) {
  const list = [];
  view.root.traverse((o) => { const s = o.material?.userData?.sea; if (s && !list.includes(s)) { s.uHalfL.value = halfL; list.push(s); } });
  return list;
}

export function hullGeometry() {
  const N = 56, K = 16, W = 2 * K + 1, pos = [], band = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) ** 0.85, sy = sheerAt(t), z = zAt(t);
    for (let k = -K; k <= K; k++) {
      const [x, y, dz] = section(t, 1 - Math.abs(k) / K); // k = ±K: the deck edges, k = 0: the keel
      pos.push(Math.sign(k) * x, y, z + dz); band.push(sy - y);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < W - 1; k++) {
    const a = i * W + k, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // the transom: its own vertices (so its light isn't bent round the corner), a fan from its middle
  const base = pos.length / 3;
  for (let k = 0; k < W; k++) { pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); band.push(1); }
  // its centre is the middle of its own outline, so the transom is flat (an inset centre bowed it into a crease)
  let cx = 0, cy = 0, cz = 0; for (let k = 0; k < W; k++) { cy += pos[k * 3 + 1]; cz += pos[k * 3 + 2]; } cy /= W; cz /= W;
  const ci = pos.length / 3;
  pos.push(cx, cy, cz); band.push(1);
  for (let k = 0; k < W - 1; k++) idx.push(ci, base + k + 1, base + k);
  idx.push(ci, base, base + W - 1); // and across the top, deck edge to deck edge (left out, it cut a V into the transom)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('band', new THREE.Float32BufferAttribute(band, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// the deck: the sheer outline with the cockpit cut out of it
function deckGeometry() {
  const sh = new THREE.Shape(), n = 40;
  for (let i = 0; i <= n; i++) { const t = i / n; sh[i ? 'lineTo' : 'moveTo'](halfBeam(t) - 0.02, -zAt(t)); }
  for (let i = n; i >= 0; i--) { const t = i / n; sh.lineTo(-(halfBeam(t) - 0.02), -zAt(t)); }
  const hole = new THREE.Path(), out = [...COCKPIT, ...COCKPIT.slice().reverse().map(([x, z]) => [-x, z])];
  out.forEach(([x, z], i) => hole[i ? 'lineTo' : 'moveTo'](x, -z));
  sh.holes.push(hole);
  const g = new THREE.ShapeGeometry(sh, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = -p.getY(i); p.setXYZ(i, x, deckY(z) + 0.05 * (1 - (x / Math.max(hbAt(z), 0.3)) ** 2), z); }
  g.computeVertexNormals();
  return g;
}

// the coachroof: its footprint raised off the deck (the Blender model's ramps down into the foredeck)
function coachroofGeometry() {
  const s = new THREE.Shape(), n = 16;
  for (let i = 0; i <= n; i++) { const z = lerp(CR_ZA, CR_ZF, i / n); s[i ? 'lineTo' : 'moveTo'](roofHalf(z), -z); }
  for (let i = n; i >= 0; i--) { const z = lerp(CR_ZA, CR_ZF, i / n); s.lineTo(-roofHalf(z), -z); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

// the hull with its keel, the deck, the cockpit and the coachroof, modelled in Blender (blender/yacht.py) on the lines
// above: a hard chine with a knuckle above it, the long coachroof ramping into the foredeck with a long smoked window a
// side and the hatch garage on its top, the cockpit behind a closed transom. Its parts come by material name; if the
// file doesn't load in 8 s, the boat is built from the lines above instead.
const MODEL = await new Promise((res) => {
  const done = (v) => { clearTimeout(timer); res(v); }, timer = setTimeout(() => res(null), 8000);
  new GLTFLoader().load(fileAt('yacht.glb'), (g) => {
    const parts = {};
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) { const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); parts[o.material.name] = geo; } });
    const p = parts.hull?.attributes.position;
    if (!p || !parts.deck) return done(null);
    // the hull's paint bands, as hullGeometry gives them: the depth under the sheer
    const band = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) band[i] = sheerAt(tAt(p.getZ(i))) - p.getY(i);
    parts.hull.setAttribute('band', new THREE.BufferAttribute(band, 1));
    // the deck's UVs are its plan in metres (x, −z), as deckGeometry's; the teak's run its planks fore and aft
    for (const [k, s] of [['deck', 1], ['teak', 1 / 0.8]]) {
      const g2 = parts[k]; if (!g2) continue;
      const q = g2.attributes.position, uv = new Float32Array(q.count * 2);
      for (let i = 0; i < q.count; i++) { uv[2 * i] = q.getX(i) * s; uv[2 * i + 1] = -q.getZ(i) * s; }
      g2.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    // the cockpit's front wall from the floor up to the deck: the model has it facing forward, so from the cockpit it
    // isn't drawn and the inside of the hull shows either side of the companionway. White gelcoat facing aft, over it
    if (parts.gel) {
      const wall = new THREE.PlaneGeometry(1.324, 0.6).translate(0, 0.9, 1.955); wall.deleteAttribute('uv');
      parts.gel = mergeGeometries([parts.gel, wall]) || parts.gel;
    }
    done(parts);
  }, undefined, () => done(null));
});
const SHARED = new Set(MODEL ? Object.values(MODEL) : []); // every boat's hull and deck: never disposed by one of them

// ---------- textures ----------
export function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// moulded non-skid: a fine diamond pattern, one tile every 35 cm (the deck's UVs are in metres)
export const NONSKID = canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#e3e0d7'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.07)';
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.save(); x.translate(i * 8 + (j % 2) * 4 + 2, j * 8 + 2); x.rotate(Math.PI / 4); x.fillRect(-1.5, -1.5, 3, 3); x.restore(); }
}, 1 / 0.35, 1 / 0.35);
// teak: planks with black caulking and a little grain
const TEAK = canvasTex(256, 256, (x, w, h) => {
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 8; i++) {
    const k = 0.9 + rnd() * 0.2; x.fillStyle = `rgb(${154 * k | 0},${106 * k | 0},${60 * k | 0})`; x.fillRect(i * 32, 0, 32, h);
    x.strokeStyle = 'rgba(60,35,15,.25)'; x.lineWidth = 1;
    for (let g = 0; g < 6; g++) { const gx = i * 32 + 3 + rnd() * 26; x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.7, gx + 1, h); x.stroke(); }
    x.fillStyle = '#1b1612'; x.fillRect(i * 32, 0, 3, h);
  }
});

// shade baked into the deck: soft and dark where it meets the coachroof and the toe rails, so the deck reads as a surface with things standing on it. Drawn in plan, metres to pixels; each shape
// is drawn off the canvas and only its blurred shadow lands on it.
const AO_W = 3.6, AO_L = 10.8, AO_S = 40;
const DECK_AO = (() => {
  const c = document.createElement('canvas'); c.width = AO_W * AO_S; c.height = AO_L * AO_S;
  const x = c.getContext('2d'), X = (v) => (v + AO_W / 2) * AO_S, Y = (z) => (z + AO_L / 2) * AO_S;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const soft = (path, blur, alpha, stroke = 0) => {
    x.save(); x.shadowColor = `rgba(0,0,0,${alpha})`; x.shadowBlur = blur * AO_S; x.shadowOffsetX = 4000; x.translate(-4000, 0);
    x.beginPath(); path(); if (stroke) { x.lineWidth = stroke * AO_S; x.strokeStyle = '#000'; x.stroke(); } else { x.fillStyle = '#000'; x.fill(); }
    x.restore();
  };
  // the coachroof's footprint, a little wider (where it ramps out on the foredeck, a lighter shade)
  soft(() => { for (let i = 0; i <= 24; i++) { const z = lerp(CR_ZA, CR_ZF + 0.6, i / 24); x[i ? 'lineTo' : 'moveTo'](X(roofHalf(z) + 0.03), Y(z)); }
    for (let i = 24; i >= 0; i--) { const z = lerp(CR_ZA, CR_ZF + 0.6, i / 24); x.lineTo(X(-roofHalf(z) - 0.03), Y(z)); } x.closePath(); }, 0.3, 0.55);
  soft(() => { for (let i = 0; i <= 40; i++) { const t = i / 40; x[i ? 'lineTo' : 'moveTo'](X(halfBeam(t) - 0.02), Y(zAt(t))); }
    for (let i = 40; i >= 0; i--) { const t = i / 40; x.lineTo(X(-(halfBeam(t) - 0.02)), Y(zAt(t))); } }, 0.1, 0.45, 0.05); // toe rails
  const t = new THREE.CanvasTexture(c);
  t.repeat.set(1 / AO_W, 1 / AO_L); t.offset.set(0.5, 0.5); // the deck's UVs are its plan in metres (x, −z)
  return t;
})();
function deckMaterial(map = NONSKID, color = '#ffffff', roughness = 0.85) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness, aoMap: DECK_AO, aoMapIntensity: 1 });
  // the baked shade also dims the sunlit deck a little, not only the sky's light
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, 0.45);'); };
  return m;
}
// the deck the player chose (look.deck): base, the class's own moulded non-skid, for 'nonskid' (and for every other
// boat); teak planks laid fore and aft; or the non-skid in the hull's colour. shaded: with the club boat's baked shade
// (her deck's UVs fit it), else plain. One material a finish and colour, kept for every boat that asks for it again.
const TEAK_DECK = TEAK.clone(); TEAK_DECK.repeat.set(1 / 0.8, 1 / 0.8); TEAK_DECK.needsUpdate = true; // the deck's UVs are metres: a plank 10 cm wide
const DECKS = new Map();
export function deckFinish(look, base, shaded = false) {
  const d = look && look.deck;
  if (d !== 'teak' && d !== 'hull') return base;
  const k = `${d}:${d === 'hull' ? look.hull : ''}:${shaded}`;
  if (!DECKS.has(k)) {
    const [map, color, rough] = d === 'teak' ? [TEAK_DECK, '#ffffff', 0.7] : [NONSKID, look.hull, 0.8];
    DECKS.set(k, shaded ? deckMaterial(map, color, rough) : new THREE.MeshStandardMaterial({ map, color, roughness: rough }));
  }
  return DECKS.get(k);
}
// carbon spars under a clear lacquer, so a mast reads as round: a long sheen down it and the sky in it
const carbon = () => new THREE.MeshPhysicalMaterial({ color: '#2d3238', roughness: 0.42, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1 });

// ---------- materials ----------
export const M = {
  deck: deckMaterial(),
  gel: new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.3, envMapIntensity: 0.8 }),
  teak: new THREE.MeshStandardMaterial({ map: TEAK, roughness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: '#d9dde1', roughness: 0.25, metalness: 1, envMapIntensity: 1 }),
  carbon: carbon(),
  // smoked acrylic: dark, but with the sky in it
  glass: new THREE.MeshStandardMaterial({ color: '#2a3540', roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4 }),
  alu: new THREE.MeshStandardMaterial({ color: '#c3c8cd', roughness: 0.35, metalness: 0.85, envMapIntensity: 1 }), // hatch frames
  // the companionway's washboards and the sliding hatch over them: painted solid, a shade under the gelcoat round them
  // and lit by the sky as it is (the aft face is often out of the sun), so they read as a closed hatch, not a hole
  board: new THREE.MeshStandardMaterial({ color: '#e4e2da', roughness: 0.45, envMapIntensity: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.6 }),
  // an instrument's screen: a reading in big lit figures over its label, behind glass; four readings, one a quarter of
  // the picture (display() picks one)
  screen: new THREE.MeshStandardMaterial({ color: '#05080b', roughness: 0.12, metalness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.55,
    emissiveMap: canvasTex(256, 192, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8e6ef'; x.textAlign = 'center';
      [['7.4', 'BSP KTS'], ['14.2', 'TWS KTS'], ['41°', 'TWA'], ['318°', 'HDG']].forEach(([v, k], i) => {
        const cx = (i % 2) * 128 + 64, cy = Math.floor(i / 2) * 96;
        x.font = '700 50px Arial, sans-serif'; x.fillText(v, cx, cy + 60); x.font = '700 16px Arial, sans-serif'; x.fillText(k, cx, cy + 86);
      });
    }) }),
  well: [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial(i === 3 ? { map: TEAK, roughness: 0.75, side: THREE.BackSide } : { color: '#e4e1d8', roughness: 0.8, side: THREE.BackSide })),
};
// Most of a boat's fittings are plain: painted, anodised, polished or lacquered, a colour, a roughness, a metalness
// and how much of the sky they mirror, with no picture on them. Folded into one material that takes all of those (and
// a clear coat's) from each vertex, the ones that stand still on her cost a draw or two in every pass instead of one a
// material, and look as they did (bake). BAKE.fold false builds them as before, a draw a material, to compare.
export const BAKE = { fold: true };
const PLAIN = new WeakMap(); // material → may it be folded (judged when first seen, before the world adds its own shading)
const NO_MAPS = ['map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap',
  'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap', 'iridescenceMap', 'iridescenceThicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'specularIntensityMap', 'specularColorMap', 'anisotropyMap'];
function plain(m) {
  if (PLAIN.has(m)) return PLAIN.get(m);
  const ok = !!m?.isMeshStandardMaterial && m.visible && !m.transparent && m.opacity === 1 && m.side === THREE.FrontSide && m.shadowSide == null && !m.vertexColors
    && !m.flatShading && !m.wireframe && m.alphaTest === 0 && m.blending === THREE.NormalBlending && m.depthTest && m.depthWrite && m.colorWrite && !m.polygonOffset
    && !m.stencilWrite && !m.clippingPlanes && m.toneMapped && m.fog && m.emissive.getHex() === 0 && NO_MAPS.every((k) => !m[k])
    && !Object.hasOwn(m, 'onBeforeCompile') && !Object.hasOwn(m, 'customProgramCacheKey') && !Object.keys(m.userData).length && Object.keys(m.defines || {}).every((k) => k === 'STANDARD' || k === 'PHYSICAL')
    && (!m.isMeshPhysicalMaterial || (m.sheen === 0 && m.transmission === 0 && m.iridescence === 0 && (m.anisotropy ?? 0) === 0 && m.ior === 1.5
      && m.specularIntensity === 1 && m.specularColor.getHex() === 0xffffff));
  PLAIN.set(m, ok);
  return ok;
}
// the one material for a boat's folded fittings: cc, with a clear coat (some of them are lacquered carbon)
function foldMaterial(cc) {
  const m = cc ? new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1 }) : new THREE.MeshStandardMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = `attribute vec3 fitRME; varying vec3 vFitRME;${cc ? ' attribute vec2 fitCC; varying vec2 vFitCC;' : ''}\n`
      + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vFitRME = fitRME;${cc ? ' vFitCC = fitCC;' : ''}`);
    let f = sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vFitRME.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vFitRME.y;')
      .replace('#include <envmap_common_pars_fragment>', '#include <envmap_common_pars_fragment>\n#define envMapIntensity vFitRME.z'); // (the uniform's declared, then each vertex's used)
    if (cc) f = f.replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment
      .replace('material.clearcoat = clearcoat;', 'material.clearcoat = vFitCC.x;').replace('material.clearcoatRoughness = clearcoatRoughness;', 'material.clearcoatRoughness = vFitCC.y;'));
    sh.fragmentShader = `varying vec3 vFitRME;${cc ? ' varying vec2 vFitCC;' : ''}\n` + f;
  };
  m.customProgramCacheKey = () => (cc ? 'fold-cc' : 'fold');
  return m;
}
// a part's geometry, in her frame, with its material's colour and finish on each vertex
function foldGeometry(g, m, cc) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.morphAttributes = {}; g.clearGroups();
  const n = g.attributes.position.count, col = new Float32Array(n * 3), rme = new Float32Array(n * 3), ccA = cc ? new Float32Array(n * 2) : null;
  for (let i = 0; i < n; i++) {
    col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b;
    rme[i * 3] = m.roughness; rme[i * 3 + 1] = m.metalness; rme[i * 3 + 2] = m.envMapIntensity;
    if (cc) { ccA[i * 2] = m.clearcoat || 0; ccA[i * 2 + 1] = m.clearcoatRoughness || 0; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('fitRME', new THREE.BufferAttribute(rme, 3));
  if (cc) g.setAttribute('fitCC', new THREE.BufferAttribute(ccA, 2));
  return g;
}
// a mirrored part's triangles turned the other way round, so they face out once the mirroring is in the vertices
function unmirror(g) {
  if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  const a = g.index.array;
  for (let i = 0; i + 2 < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  g.index.needsUpdate = true;
  return g;
}
// the plain parts straight under root (a committee boat's), folded into one mesh per shadow and draw order; skip: what
// else may move or come and go. A material with a part that reaches down to the water (y below dry, root as built) is
// left as it is (world.js underParts draws each in its own colour there)
export function foldStill(root, skip = new Set(), dry = 0.35) {
  if (!BAKE.fold) return root;
  root.updateMatrixWorld(true);
  const parts = root.children.filter((o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.children.length && !skip.has(o) && o.visible && !Array.isArray(o.material)
    && !Object.keys(o.userData).length && !Object.hasOwn(o, 'onBeforeRender') && plain(o.material) && !!o.geometry.attributes.normal);
  const wet = new Set(), box = new THREE.Box3();
  for (const o of parts) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); if (box.copy(o.geometry.boundingBox).applyMatrix4(o.matrix).min.y < dry) wet.add(o.material); }
  const sets = new Map();
  for (const o of parts) if (!wet.has(o.material)) { const k = o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder; if (!sets.has(k)) sets.set(k, []); sets.get(k).push(o); }
  for (const list of sets.values()) {
    if (list.length < 2) continue;
    const cc = list.some((o) => o.material.isMeshPhysicalMaterial);
    const geos = list.map((o) => { o.updateMatrix(); const g = foldGeometry(o.geometry.clone().applyMatrix4(o.matrix), o.material, cc); if (o.matrix.determinant() < 0) unmirror(g); return g.index ? g : g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i)); });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, foldMaterial(cc));
    m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder;
    for (const o of list) o.removeFromParent(); // (their geometry may be shared: a model's)
    root.add(m);
  }
  return root;
}
const WIRE = new THREE.MeshStandardMaterial({ color: '#3b4148', roughness: 0.35, metalness: 0.6 }); // the rigging as wire, up close
const wireMat = new THREE.LineBasicMaterial({ color: 0x4d555e, transparent: true, opacity: 0.8 }); // grey and a touch see-through, so the thin lines don't crawl dark against the sky
export const line = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), wireMat);
export const tube = (pts, r, mat, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed), Math.max(8, pts.length * 6), r, 6, closed), mat);
export const cyl = (r0, r1, h, mat, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

// ---------- fittings ----------
// The deck hardware and rig fittings every class shares (boats3d.js builds the others' with them). Each is a list of
// [geometry, material] parts in its own frame; fit() adds them as plain meshes straight onto the boat, where bake()
// folds each into the boat's one mesh of its material — detail that costs triangles, not draws.
// a carbon mast from its foot to the masthead: an oval section, deeper fore and aft than it is wide (d, w at the foot),
// parallel up to the upper spreaders (taper0, a share of its height) and tapering above them to d1, w1 at the head
export function mastGeo(len, d0, w0, d1, w1, taper0 = 0.68, seg = 18) {
  const g = new THREE.CylinderGeometry(0.5, 0.5, len, seg, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = (p.getY(i) + len / 2) / len, k = clamp((f - taper0) / (1 - taper0), 0, 1), e = k * k * (3 - 2 * k);
    p.setX(i, p.getX(i) * lerp(w0, w1, e)); p.setZ(i, p.getZ(i) * lerp(d0, d1, e));
  }
  g.computeVertexNormals();
  return g;
}
// a spreader: an aerofoil strut (a flat ellipse: chord fore and aft, thin up and down), tapering to its tip. Lying
// along +x from its middle when the mesh is turned rotation.z = −sx·π/2 for side sx
export function spreaderGeo(len, r0, r1) {
  return new THREE.CylinderGeometry(r1, r0, len, 12).scale(0.42, 1, 1.7);
}
export function fit(add, parts, x = 0, y = 0, z = 0, ry = 0, rx = 0) {
  for (const [g, m] of parts) { const o = add(new THREE.Mesh(g, m), x, y, z); o.rotation.set(rx, ry, 0, 'YXZ'); }
}
const V2 = (p) => p.map(([x, y]) => new THREE.Vector2(x, y));
// a round bar from a to b (a strut, a rail), r0 its radius at a and r1 at b
export function bar(a, b, r0, r1, mat, seg = 8) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
// a self-tailing winch, r its drum's radius and h its height: the chromed base and drum, ribbed for grip, under the
// black self-tailer and its cap
export function winch(r, h) {
  const drum = [[0, 0], [r * 1.32, 0], [r * 1.3, h * 0.05], [r * 1.12, h * 0.1], [r * 0.93, h * 0.17]];
  for (let i = 0; i < 3; i++) { const y = h * (0.22 + i * 0.12); drum.push([r * 0.9, y], [r * 0.95, y + h * 0.035], [r * 0.9, y + h * 0.07]); }
  drum.push([r * 0.9, h * 0.6], [0.001, h * 0.6]);
  const tailer = [[0.001, h * 0.6], [r * 0.95, h * 0.6], [r * 1.1, h * 0.64], [r * 1.12, h * 0.73], [r * 0.96, h * 0.77], [r * 1.06, h * 0.81], [r * 1.0, h * 0.88], [r * 0.6, h * 0.95], [r * 0.32, h], [r * 0.14, h * 0.97], [0.001, h * 0.97]];
  return [[new THREE.LatheGeometry(V2(drum), 14), M.steel], [new THREE.LatheGeometry(V2(tailer), 14), M.dark]];
}
// a block, r its sheave's radius: the sheave between two cheeks, turning about x, and the shackle over it
export function block(r) {
  const cheek = (sx) => new THREE.CylinderGeometry(r * 1.15, r * 1.15, r * 0.16, 14).rotateZ(Math.PI / 2).translate(sx * r * 0.33, 0, 0);
  return [
    [mergeGeometries([cheek(-1), cheek(1)]), M.dark],
    [new THREE.CylinderGeometry(r * 0.85, r * 0.85, r * 0.5, 14).rotateZ(Math.PI / 2), M.alu],
    [new THREE.TorusGeometry(r * 0.42, r * 0.1, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(0, r * 1.05, 0), M.steel],
  ];
}
// a bank of n rope clutches side by side, their levers up; the lines run through them along z
export function clutches(n, pitch = 0.075) {
  const base = [], lever = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    base.push(new THREE.BoxGeometry(pitch * 0.78, 0.04, 0.17).translate(x, 0.02, 0));
    lever.push(new THREE.BoxGeometry(pitch * 0.66, 0.018, 0.12).rotateX(0.22).translate(x, 0.056, -0.01));
  }
  return [[mergeGeometries(base), M.dark], [mergeGeometries(lever), M.alu]];
}
// a mooring cleat, len long along z: two tapering horns on a pair of waisted feet
export function cleat(len = 0.2) {
  const foot = (z) => new THREE.CylinderGeometry(0.016, 0.024, 0.04, 8).translate(0, 0.02, z);
  return [[mergeGeometries([
    new THREE.CapsuleGeometry(0.014, len - 0.028, 3, 8).rotateX(Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.046, 0),
    foot(-len * 0.2), foot(len * 0.2),
  ]), M.alu]];
}
// a racing wheel, R its radius: the leather-gripped rim, n carbon spokes tapering out from the hub and its chromed
// cap; in the wheel's plane (x, y), turning about z. One mesh a material, to turn as one
export function wheel(R, n = 6, rim = M.dark, spokes = M.carbon) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.05, 8, 48), rim));
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.024, R * 0.045, R * 0.9, 6).translate(0, R * 0.52, 0), spokes);
    s.rotation.z = (i / n) * Math.PI * 2; g.add(s);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.15, R * 0.2, 16).rotateX(Math.PI / 2), M.steel));
  return mergeGroup(g);
}
// a stay's foot: the chainplate on the deck at a, and the rigging screw on it, len long up the stay towards b
export function chainplate(a, b, len = 0.3, r = 0.016) {
  const A = new THREE.Vector3(...a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...b).sub(A).normalize());
  const screw = mergeGeometries([
    new THREE.CylinderGeometry(r * 0.5, r * 0.5, len, 6).translate(0, len / 2, 0), // the threaded studs and the toggle
    new THREE.CylinderGeometry(r, r, len * 0.45, 8).translate(0, len * 0.52, 0), // the body
  ]).applyQuaternion(q).translate(A.x, A.y, A.z);
  return [[mergeGeometries([screw, new THREE.BoxGeometry(r * 2.2, r * 3, r * 6).translate(A.x, A.y + r * 1.2, A.z)]), M.steel]];
}
// an instrument display, w × h: its case and the lit screen on its face, towards +z, showing reading k (0 boat speed,
// 1 wind speed, 2 wind angle, 3 heading)
export function display(w, h, k = 0) {
  const s = new THREE.PlaneGeometry(w * 0.86, h * 0.78).translate(0, 0, 0.0185), uv = s.attributes.uv;
  const u0 = (k % 2) / 2, v0 = k < 2 ? 0.5 : 0; // its quarter of the picture (the picture's top row is v 0.5 … 1)
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 2, v0 + uv.getY(i) / 2);
  return [[new THREE.BoxGeometry(w, h, 0.035), M.dark], [s, M.screen]];
}
// a tackle's falls between its two blocks, a and b: the line (n + 1 points) runs a → b → a …, the parts a little apart
export function purchase(l, a, b, spread = 0.035) {
  const p = l.geometry.attributes.position, n = p.count - 1;
  for (let i = 0; i <= n; i++) { const e = i % 2 ? b : a, dx = (i / n - 0.5) * spread; p.setXYZ(i, e[0] + dx, e[1], e[2]); }
  p.needsUpdate = true;
}
// a moving assembly (a foil arm, the rudder, a wheel, the boom and its fittings) as one mesh a material, so it costs
// a draw or two, not a dozen
export function mergeGroup(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), by = new Map();
  g.traverse((o) => { if (o.isMesh) { if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); } });
  for (const c of [...g.children]) g.remove(c);
  const plain = (x) => { x = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; }; // the same attributes, so they merge
  for (const [mat, geos] of by) g.add(new THREE.Mesh(mergeGeometries(geos.map(plain)), mat));
  return g;
}
// the sail number on both bows, as racing boats carry it, in white on a dark hull and black on a light one: its
// material, for a decal wrapped onto the topsides
export function bowNumberMaterial(look) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d'), text = `${look.nat && !look.logo ? look.nat + ' ' : ''}${look.num || ''}`.trim();
  const dark = new THREE.Color(look.hull).getHSL({}).l < 0.45;
  x.fillStyle = dark ? '#f4f4f0' : '#15181c'; x.font = '900 110px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 68, 500);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
}

// her name on both quarters, upright, white on a dark hull and black on a light one:
// its material, for a decal 8 times as wide as it's high
export function nameMaterial(look) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d'), dark = new THREE.Color(look.hull).getHSL({}).l < 0.45;
  x.fillStyle = dark ? '#f4f4f0' : '#15181c'; x.font = '800 92px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(look.name, 512, 66, 1000);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
}

// ---------- the logo ----------
// a picture for the cloth or the hull, drawn as it is: a flag, or the club's logo (the white RYC pennant on a red
// square, public/images/ryc-badge.svg)
const RYC_BADGE = '/images/ryc-badge.svg';
const logoCache = {};
export function logoImage(logo) {
  const src = typeof logo === 'string' ? logo : RYC_BADGE;
  if (!logoCache[src]) logoCache[src] = new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; }).catch(() => null);
  return logoCache[src];
}
// draws a picture as large as fits in a w × h box centred on (cx, cy), keeping its shape
export function drawContain(x, img, cx, cy, w, h) {
  const s = Math.min(w / (img.naturalWidth || img.width), h / (img.naturalHeight || img.height)), dw = (img.naturalWidth || img.width) * s, dh = (img.naturalHeight || img.height) * s;
  x.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

// the pictures on every boat's sails, as the site's admin sets them (/admin, which /sponsor serves): 'jib' the ad on the
// jib, 'main' the logo on the mainsail. Asked for once a page, then the picture itself (from Supabase Storage, so loaded
// for CORS: a tainted canvas can't go to the GPU). None, nothing on the sail.
const adPromises = {};
function sailAd(slot) {
  if (!adPromises[slot]) adPromises[slot] = sponsor()
    .then((d) => (d && typeof d[slot] === 'string' ? new Promise((res, rej) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => res(img); img.onerror = rej; img.src = d[slot]; }) : null))
    .catch(() => null);
  return adPromises[slot];
}

// a logo decal on the bow, wrapped onto the hull's own surface (side: +1 starboard, −1 port)
function sectionX(t, y) { // the section's half-breadth at station t, height y
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 2.0, clamp((t - 0.45) / 0.55, 0, 1));
  const sn = clamp((sy - y) / (sy + d), 0, 1) ** (n / 2), c = Math.sqrt(Math.max(0, 1 - sn * sn));
  return hb * c ** (2 / n) * (1 - FLARE * sn);
}
// the topsides' knuckle and the hard chine under it, metres above the water (blender/yacht.py's knuckle_y, chine_y):
// the knuckle 0.76 aft to 0.79 at the stem, the chine half a metre up aft dropping to 0.3 at the stem (kept 6 cm
// above the forefoot, where they meet); between them the topsides run straight, a flat panel turned in from the
// section above
const knuckleY = (t) => 0.76 + 0.03 * t, chineY = (t) => Math.max(0.5 - 0.2 * t * t, 0.06 - canoe(t));
function hullX(t, y) { // the hull's half-breadth at station t, height y
  const yk = knuckleY(t), yc = chineY(t);
  if (y >= yk || y <= yc) return sectionX(t, y);
  return lerp(sectionX(t, yc), sectionX(t, yk), (y - yc) / (yk - yc));
}
function hullDecal(side, z0, y0, W, H, material) {
  const nu = 12, nv = 4, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, z = z0 - side * (u - 0.5) * W, y = y0 + (v - 0.5) * H; // reads left to right from either side
    pos.push(side * (hullX(tAt(z), y) + 0.012), y, z); uv.push(u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.userData.flat = true; // decals lie on the hull: no shadow of their own
  return m;
}
function logoDecal(side, logo, z0 = -2.55, y0 = 0.64, W = 1.36, H = 0.52) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  logoImage(logo).then((img) => { if (img) { drawContain(c.getContext('2d'), img, 256, 128, 496, 248); tex.needsUpdate = true; } });
  return hullDecal(side, z0, y0, W, H, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.25, envMapIntensity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// ---------- sails ----------
// how a kite is cut, on its cloth (x from the luff to the leech, y from the head down to the foot): a band's edge, v of
// the way down the luff at the luff and arching up towards the middle; and its seams, the panels fanning out of the three
// corners, where the load is, and running across the sail between them
const kiteArc = (v, u) => v * (1 - 0.06 * Math.sin(Math.PI * u));
function kiteSeams(W, H) {
  const at = (v, u) => [u * W, kiteArc(v, u) * H], seams = [];
  for (let i = 3; i <= 10; i++) seams.push(Array.from({ length: 17 }, (_, k) => at(i / 16 + 0.1875, k / 16))); // across the middle
  for (let k = 1; k < 8; k++) seams.push([[(k / 8) * W, 0], at(0.375, k / 8)]); // out of the head
  for (let k = 1; k < 6; k++) { const u = (k / 6) * 0.5; seams.push([[0, H], at(0.8125, u)], [[W, H], at(0.8125, 1 - u)]); } // out of the tack and the clew
  return seams;
}
// a picture drawn at w × h on a canvas of its own, to be cut into rows or strips: an SVG cut straight from the image would
// be drawn at its own small size
function sharpPicture(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  return c;
}
// a canvas texture for a sail; u runs luff → leech, v foot → head
// rig: another class's sails (boats3d.js) — the main's luff (span, m) and its chord up it, where the flag goes on it
// (m up the luff) and how wide, where the number goes (0 the foot … 1 the head), and the jib's head and clew from its
// tack (noAd: a headsail that carries no ad); this boat's own when left out
export function sailTexture(kind, look, rig = null) {
  const R = rig || RIG();
  const W = 512, H = kind === 'main' ? 1024 : kind === 'jib' ? 1536 : 512; // the jib tall enough for the ad on it to read
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let sideB = null; // the back face of the jib or the main, when it needs a canvas of its own
  if (kind === 'kite') {
    // the boat's colours in bands across the sail, each arching up from the luff to the leech as the foot does
    const cols = look.kite;
    for (let i = 0; i < 8; i++) {
      x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(W, H); x.lineTo(0, H);
      for (let k = 0; k <= 24; k++) x.lineTo((k / 24) * W, kiteArc(i / 8, k / 24) * H);
      x.closePath(); x.fill();
    }
    // the cloth over the colours: its seams, the tapes round its edge, and the patches of extra cloth at its corners
    x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 1.5;
    for (const seam of kiteSeams(W, H)) { x.beginPath(); seam.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); }
    x.fillStyle = 'rgba(128,128,128,.28)'; x.fillRect(0, 0, W, H * 0.05);
    for (const cx of [0, W]) for (const r of [0.2, 0.12]) { x.beginPath(); x.moveTo(cx, H); x.arc(cx, H, W * r, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, 5, H); x.fillRect(W - 5, 0, 5, H); x.fillRect(0, H - 5, W, 5);
  } else {
    x.fillStyle = look.cloth; x.fillRect(0, 0, W, H);
    // where a point of the cloth (f up the luff, u along the chord) lies on the flat sail, in metres: [aft, up]. A sail
    // whose rows don't run level from the luff (the Optimist's climb to her sprit's peak) brings a map of its own (rig.at)
    const clothPoint = R.at || ((f, u) => [u * R.chord(f), f * R.span]);
    // a picture (its ImageData) level and upright on the sail, its middle at (zc, yc) in clothPoint's metres, w × h m in
    // size: each pixel of the canvas looks up what lies at its point of the sail, so nothing leans however the cloth
    // narrows or its rows run. s: 1 the front face, −1 the back, whose canvas is read mirrored and seen from the other side
    const markOn = (ctx, s, pic, zc, yc, w, h) => {
      const N = 64, padZ = (2 * R.chord(0)) / N, padY = (2 * R.span) / N;
      let u0 = 1, u1 = 0, f0 = 1, f1 = 0;
      for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
        const [z, y] = clothPoint(b / N, a / N);
        if (Math.abs(z - zc) > w / 2 + padZ || Math.abs(y - yc) > h / 2 + padY) continue;
        u0 = Math.min(u0, a / N); u1 = Math.max(u1, a / N); f0 = Math.min(f0, b / N); f1 = Math.max(f1, b / N);
      }
      if (u1 < u0) return;
      const i0 = Math.max(0, Math.floor(W * (s > 0 ? u0 : 1 - u1)) - 8), i1 = Math.min(W, Math.ceil(W * (s > 0 ? u1 : 1 - u0)) + 8);
      const j0 = Math.max(0, Math.floor(H * (1 - f1)) - 16), j1 = Math.min(H, Math.ceil(H * (1 - f0)) + 16), bw = i1 - i0, bh = j1 - j0;
      const out = new ImageData(bw, bh), o = out.data, { data: d, width: pw, height: ph } = pic;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const u = (i0 + i + 0.5) / W, [z, y] = clothPoint(1 - (j0 + j + 0.5) / H, s > 0 ? u : 1 - u);
        const px = ((s * (z - zc)) / w + 0.5) * pw - 0.5, py = ((yc - y) / h + 0.5) * ph - 0.5;
        if (px < -0.5 || py < -0.5 || px > pw - 0.5 || py > ph - 0.5) continue;
        const x0 = clamp(Math.floor(px), 0, pw - 1), y0 = clamp(Math.floor(py), 0, ph - 1), x1 = Math.min(x0 + 1, pw - 1), y1 = Math.min(y0 + 1, ph - 1), fx = clamp(px - x0, 0, 1), fy = clamp(py - y0, 0, 1);
        let al = 0, r = 0, g = 0, b = 0;
        for (let k = 0; k < 4; k++) { // weighed by their alpha, so a soft edge takes no colour from the clear pixels beside it
          const q = ((k & 2 ? y1 : y0) * pw + (k & 1 ? x1 : x0)) * 4, e = (d[q + 3] * (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy));
          al += e; r += d[q] * e; g += d[q + 1] * e; b += d[q + 2] * e;
        }
        if (al > 0) { const q = (j * bw + i) * 4; o[q] = r / al; o[q + 1] = g / al; o[q + 2] = b / al; o[q + 3] = al; }
      }
      const oc = document.createElement('canvas'); oc.width = bw; oc.height = bh; oc.getContext('2d').putImageData(out, 0, 0);
      ctx.drawImage(oc, i0, j0);
    };
    // the country flag, its full SAIL_MARK m wide and 3:2, centred m metres up the luff and z metres aft of it: drawn a
    // row of the canvas at a time, each row scaled by the chord there, so it comes out an upright rectangle on the sail
    // (not narrowing as the sail does), with an edge for a white flag on white cloth. back: the back face's canvas, which
    // is read mirrored (u → 1 − u), so there each row is laid out from the far side to keep it square to the luff
    const flagAt = (m, z, back) => logoImage(look.flag).then((img) => {
      if (!img) return;
      const w = R.mark, h = w / 1.5, iw = 300, ih = 200;
      const fc = document.createElement('canvas'); fc.width = iw; fc.height = ih; // the flag at a size to slice (an SVG may have none)
      const fx = fc.getContext('2d'); fx.drawImage(img, 0, 0, iw, ih);
      if (R.at) { // rows that don't run level: laid on the sail by its own map
        fx.strokeStyle = 'rgba(0,0,0,.22)'; fx.lineWidth = 3; fx.strokeRect(1.5, 1.5, iw - 3, ih - 3);
        const [zc, yc] = clothPoint(m / R.span, z / R.chord(m / R.span)), pic = fx.getImageData(0, 0, iw, ih);
        for (const [ctx, s] of [[x, 1], [back, -1]]) markOn(ctx, s, pic, zc, yc, w, h);
        t.needsUpdate = true; t.back.needsUpdate = true;
        return;
      }
      const j0 = Math.round(H * (1 - (m + h / 2) / R.span)), j1 = Math.round(H * (1 - (m - h / 2) / R.span));
      for (const [ctx, s] of [[x, 1], [back, -1]]) for (let j = j0 - 1; j <= j1; j++) {
        const f = 1 - (j + 0.5) / H, k = W / R.chord(f), dw = w * k, x0 = s > 0 ? (z - w / 2) * k : W - (z + w / 2) * k, edge = j < j0 || j === j1;
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0 - 1, j, dw + 2, 1);
        if (!edge) ctx.drawImage(fc, 0, ((j - j0) / (j1 - j0)) * ih, iw, ih / (j1 - j0), x0, j, dw, 1);
      }
      t.needsUpdate = true; t.back.needsUpdate = true;
    });
    // where the flag goes: the highest it can, up to m metres up the luff, with its whole width on the cloth (clear of
    // the luff and leech tapes) — a narrow head would otherwise cut it off. Gives [m, z], z its middle aft of the luff
    const flagPlace = (m) => {
      const w = R.mark, h = w / 1.5, MARGIN = 0.06, room = (mm) => R.chord(Math.min(1, (mm + h / 2) / R.span)) * (1 - 2 * MARGIN);
      for (; m > h && room(m) < w; m -= 0.02);
      const ct = R.chord(Math.min(1, (m + h / 2) / R.span)), z = clamp(0.47 * R.chord(m / R.span), ct * MARGIN + w / 2, ct * (1 - MARGIN) - w / 2);
      return [m, z];
    };
    // laminate: fine fibres; cloth: panel seams
    if (look.laminate) {
      x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1;
      for (let i = -H; i < W; i += 9) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H * 0.7, 0); x.stroke(); }
      for (let i = 0; i < W + H; i += 14) { x.beginPath(); x.moveTo(W, i); x.lineTo(0, i - W * 0.5); x.stroke(); }
    }
    // the panels: each cut from its own run of cloth, so each a shade lighter or darker than the next (seen at any
    // distance, it is what keeps a sail from looking like one flat sheet), and the load-bearing laminate's darker
    // fibres fanning from the clew and the head
    let ps = 7 + kind.length; const prnd = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 10; i++) {
      const d = (prnd() - 0.5) * (look.laminate ? 0.09 : 0.06);
      x.fillStyle = d > 0 ? `rgba(255,255,255,${d})` : `rgba(0,0,0,${-d})`;
      x.beginPath(); x.moveTo(0, (i * H) / 10 + 20); x.lineTo(W, (i * H) / 10 - 30); x.lineTo(W, ((i + 1) * H) / 10 - 30); x.lineTo(0, ((i + 1) * H) / 10 + 20); x.closePath(); x.fill();
    }
    if (look.laminate) {
      x.strokeStyle = 'rgba(0,0,0,.05)'; x.lineWidth = 3;
      for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(W, H); x.quadraticCurveTo(W * (0.55 - i * 0.05), H * (0.7 - i * 0.04), W * (0.05 + i * 0.02), H * (0.1 + i * 0.09)); x.stroke(); }
      for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(W * 0.04, 0); x.quadraticCurveTo(W * (0.3 + i * 0.05), H * (0.2 + i * 0.03), W * (0.9 - i * 0.04), H * (0.35 + i * 0.07)); x.stroke(); }
    }
    x.strokeStyle = look.laminate ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'; x.lineWidth = 2;
    for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(0, (i * H) / 10 + 20); x.lineTo(W, (i * H) / 10 - 30); x.stroke(); }
    // creases: faint wrinkles fanning from the clew (bottom right) and from the head, each a shadow with a highlight
    const crease = (x0, y0, x1, y1) => {
      for (const [d, s] of [[0, 'rgba(0,0,0,.07)'], [2.5, 'rgba(255,255,255,.08)']]) { x.strokeStyle = s; x.lineWidth = 1.6; x.beginPath(); x.moveTo(x0 + d, y0); x.lineTo(x1 + d, y1); x.stroke(); }
    };
    for (let i = 0; i < 6; i++) crease(W - 6, H - 6, W * (0.62 - i * 0.05), H * (0.86 - i * 0.05));
    for (let i = 0; i < 4; i++) crease(W * 0.06, 6, W * (0.22 + i * 0.06), H * (0.1 + i * 0.025));
    // tapes along the luff and foot, the leech line
    x.fillStyle = look.tape; x.fillRect(0, 0, 10, H); x.fillRect(0, H - 10, W, 10); x.fillRect(W - 6, 0, 6, H);
    if (kind === 'main') {
      // battens: the top two full length, the rest from the leech (or the class's own: rig.battens)
      x.fillStyle = look.batten;
      (R.battens || MAIN_BATTENS).forEach(([v, len]) => x.fillRect(W * (1 - len), H * (1 - v) - 5, W * len, 10));
      // from the head down: the country flag (where the head is too narrow for it, it comes down to where it fits), the
      // number right under it, and the admin's logo as large as the cloth below them allows
      // The back face gets a canvas of its own (t.back, the cloth as drawn so far), for the flag and the logo
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
      const xb = cb.getContext('2d'); xb.drawImage(c, 0, 0);
      sideB = new THREE.CanvasTexture(cb);
      const [fm, fz] = flagPlace(R.flagM);
      // where the logo stands between lo and hi metres up the luff, its whole width on the cloth at its top edge, where the
      // sail is narrowest: the largest it can be goes right down by the boom for a wide logo, so it stands as high as it can
      // at nearly that size. Gives its middle (m up the luff, z aft of it) and its size in metres
      const logoPlace = (aspect, lo, hi) => {
        const MARGIN = 0.05, step = R.span / 200, chordAt = (m) => R.chord(Math.min(1, m / R.span));
        const fit = (top) => Math.min(chordAt(top) * (1 - 2 * MARGIN), (top - lo) * aspect);
        let most = 0, top = hi;
        for (let m = hi; m > lo; m -= step) most = Math.max(most, fit(m));
        while (top > lo && fit(top) < 0.94 * most) top -= step;
        const w = fit(top), h = w / aspect, m = top - h / 2, ct = chordAt(top);
        return { w, h, m, z: clamp(0.47 * chordAt(m), ct * MARGIN + w / 2, ct * (1 - MARGIN) - w / 2) };
      };
      // the logo, laid out as the flag is: a row of the canvas at a time, each scaled by the chord there, so it comes out
      // an upright rectangle on the sail however much the sail narrows across its height, on both faces
      const logoAt = (img, { m, z, w, h }) => {
        const j0 = Math.round(H * (1 - (m + h / 2) / R.span)), j1 = Math.round(H * (1 - (m - h / 2) / R.span));
        const pic = sharpPicture(img, 1024, j1 - j0);
        if (R.at) { // rows that don't run level: laid on the sail by its own map
          const [zc, yc] = clothPoint(m / R.span, z / R.chord(m / R.span)), data = pic.getContext('2d').getImageData(0, 0, pic.width, pic.height);
          for (const [ctx, s] of [[x, 1], [xb, -1]]) markOn(ctx, s, data, zc, yc, w, h);
          return;
        }
        for (const [ctx, s] of [[x, 1], [xb, -1]]) for (let j = j0; j < j1; j++) {
          const k = W / R.chord(1 - (j + 0.5) / H);
          ctx.drawImage(pic, 0, j - j0, 1024, 1, s > 0 ? (z - w / 2) * k : W - (z + w / 2) * k, j, w * k, 1);
        }
      };
      // the admin's logo, on every boat: the number waits for it, as with a logo it stands alone, under the flag, and
      // without one under her letters; set on a canvas of their own and laid on the sail level and upright (markOn), as
      // wide on the cloth wherever they go, and kept on the cloth where the sail is narrow
      sailAd('main').then((img) => {
        const numHalf = 0.022 * R.numK * R.span, gap = R.mark / 6, numM = fm - R.mark / 3 - gap - numHalf;
        const numF = img ? numM / R.span : R.numAt, wide = R.chord(R.numAt) / R.chord(numF);
        const spot = img && logoPlace((img.naturalWidth || 1) / (img.naturalHeight || 1), 0.16 * R.span, numM - numHalf - gap);
        const numU = img ? fz / R.chord(numF) : 0.47;
        const lines = img ? [[look.num, 0]] : [[look.nat, -82], [look.num, 70]], K = 0.44 * R.numK, top = lines[0][1] - 80, bottom = lines[lines.length - 1][1] + 80;
        const tc = document.createElement('canvas'), tx = tc.getContext('2d', { willReadFrequently: true }), FONT = '900 128px Carlito, Lato, Arial, sans-serif';
        tx.font = FONT;
        const widest = Math.max(...lines.map(([s]) => tx.measureText(s).width)), tw = Math.ceil(img ? Math.min(widest, (W * 0.84) / wide) : widest) + 8;
        tc.width = tw; tc.height = Math.ceil((bottom - top) * K);
        tx.scale(1, K); tx.translate(tw / 2, -top); tx.fillStyle = look.ink; tx.font = FONT; tx.textAlign = 'center'; tx.textBaseline = 'middle';
        for (const [s, ly] of lines) tx.fillText(s, 0, ly, tw - 8);
        const mx = R.chord(R.numAt) / W, my = (R.span / H) * K, [z0, y0] = clothPoint(numF, numU), pic = tx.getImageData(0, 0, tc.width, tc.height);
        for (const [ctx, s] of [[x, 1], [xb, -1]]) markOn(ctx, s, pic, z0, y0 - ((top + bottom) / 2) * my, tw * mx, (bottom - top) * my);
        if (img) logoAt(img, spot);
        t.needsUpdate = true; t.back.needsUpdate = true;
      });
      if (look.flag) flagAt(fm, fz, xb);
    } else {
      x.fillStyle = look.batten; x.fillRect(W * 0.7, H * 0.35, W * 0.3, 16); x.fillRect(W * 0.6, H * 0.6, W * 0.4, 16);
      // the ad, as large as the jib allows between a little above the foot and just over half way up the luff, its top
      // corners clear of the luff and the leech. The cloth maps (u along the chord, f up the luff) to
      // P = head·f + clew·(1 − f)·u in the sail's plane, a grid sheared by the raked luff and tapering to the head: the ad
      // is drawn in level strips, the canvas set to that map's inverse at each strip's middle, so it stands upright, level
      // with the deck, and comes out its own shape on the sail however much the jib narrows across its height.
      // The back face reads the canvas mirrored (u → 1 − u), which would turn the shear the wrong way and lean the ad: it
      // gets a canvas of its own (t.back, the cloth as drawn so far), the ad on it drawn with the shear the other way round.
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H; cb.getContext('2d').drawImage(c, 0, 0);
      const tb = new THREE.CanvasTexture(cb);
      sailAd('jib').then((img) => {
        if (!img || R.noAd) return;
        const hd = R.hd, CL = R.clew, aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1), clear = 0.035 * CL.z, y0 = 0.09 * hd.y;
        const luffZ = (y) => (hd.z * y) / hd.y, leechZ = (y) => CL.z + ((hd.z - CL.z) * (y - CL.y)) / (hd.y - CL.y);
        let w = 0, h = 0, zc = 0, yc = 0;
        for (let top = y0; top < 0.6 * hd.y; top += hd.y / 200) {
          const fit = Math.min(leechZ(top) - luffZ(top) - 2 * clear, (top - y0) * aspect);
          if (fit > w) { w = fit; h = w / aspect; zc = (luffZ(top) + leechZ(top)) / 2; yc = top - h / 2; }
        }
        const STRIPS = 40, PW = 1024, PH = Math.round(PW / aspect), pic = sharpPicture(img, PW, PH), det0 = hd.z * CL.y - hd.y * CL.z;
        for (const [ctx, s] of [[x, 1], [cb.getContext('2d'), -1]]) for (let k = 0; k < STRIPS; k++) {
          const y = yc + h / 2 - ((k + 0.5) * h) / STRIPS, f = (zc * CL.y - CL.z * y) / det0, u = (hd.z * y - hd.y * zc) / det0 / (1 - f);
          const a = CL.z * (1 - f), b = CL.y * (1 - f), cc = hd.z - CL.z * u, d = hd.y - CL.y * u, det = a * d - b * cc, dh = h / STRIPS;
          ctx.save(); ctx.translate(W * (s > 0 ? u : 1 - u), H * (1 - f)); ctx.transform((W * d) / det, (s * H * b) / det, (s * W * cc) / det, (H * a) / det, 0, 0);
          ctx.drawImage(pic, 0, (k * PH) / STRIPS, PW, PH / STRIPS, -w / 2, -dh * 0.56, w, dh * 1.12); // (a hair over, so no seam shows between strips)
          ctx.restore();
        }
        t.needsUpdate = true; tb.needsUpdate = true;
      });
      sideB = tb;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  if (sideB) { sideB.colorSpace = t.colorSpace; sideB.anisotropy = t.anisotropy; sideB.wrapS = t.wrapS; t.back = sideB; }
  if (kind === 'main' && R.battens) t.battens = R.battens; // for its relief (sailMesh)
  return t;
}
// the cloth's relief, as a normal map: the panel seams (raised where two panels overlap and are stitched), the
// batten pockets, and soft wrinkles fanning from the clew and the head; a spinnaker's seams run out from its head.
// Drawn as a height field with the sail texture's own layout, then turned into normals.
const RELIEF = {};
// the main's battens: [how far up the luff, how much of the chord in from the leech]
const MAIN_BATTENS = [[0.9, 1], [0.76, 1], [0.6, 0.45], [0.42, 0.4], [0.24, 0.35]];
function sailRelief(kind, battens = MAIN_BATTENS) {
  const key = battens === MAIN_BATTENS ? kind : kind + JSON.stringify(battens);
  if (RELIEF[key]) return RELIEF[key];
  const W = 256, H = kind === 'main' ? 512 : kind === 'jib' ? 384 : 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  const line = (x0, y0, x1, y1, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  if (kind === 'kite') {
    for (const seam of kiteSeams(W, H)) for (let k = 1; k < seam.length; k++) line(seam[k - 1][0], seam[k - 1][1], seam[k][0], seam[k][1], 2.5, 'rgba(255,255,255,.55)');
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2;
    for (const cx of [0, W]) for (const r of [0.2, 0.12]) { x.beginPath(); x.arc(cx, H, W * r, 0, Math.PI * 2); x.stroke(); } // the corner patches' edges
    line(0, H * 0.05, W, H * 0.05, 2, 'rgba(255,255,255,.5)');
    x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H); x.fillRect(0, H - 3, W, 3); // the tapes
    for (let i = 0; i < 9; i++) line(W * (0.15 + i * 0.09), H, W * (0.05 + i * 0.1), H * 0.55, 7, 'rgba(0,0,0,.08)'); // the foot's soft folds
  } else {
    for (let i = 1; i < 10; i++) line(0, (i * H) / 10 + 10, W, (i * H) / 10 - 15, 3, 'rgba(255,255,255,.6)');
    for (let i = 0; i < 7; i++) line(W - 3, H - 3, W * (0.6 - i * 0.06), H * (0.84 - i * 0.06), 6, `rgba(0,0,0,${0.1 - i * 0.008})`); // from the clew
    for (let i = 0; i < 5; i++) line(W * 0.04, 3, W * (0.2 + i * 0.06), H * (0.1 + i * 0.025), 4, 'rgba(0,0,0,.08)'); // from the head
    x.fillStyle = 'rgba(255,255,255,.7)';
    if (kind === 'main') battens.forEach(([v, len]) => x.fillRect(W * (1 - len), H * (1 - v) - 3, W * len, 6));
    else { x.fillRect(W * 0.7, H * 0.35, W * 0.3, 4); x.fillRect(W * 0.6, H * 0.6, W * 0.4, 4); }
    x.fillRect(0, 0, 5, H); x.fillRect(0, H - 5, W, 5); // the tapes along the luff and the foot
  }
  const src = x.getImageData(0, 0, W, H).data, out = x.createImageData(W, H), d = out.data;
  const h = (i, j) => src[((Math.min(H - 1, Math.max(0, j)) * W) + Math.min(W - 1, Math.max(0, i))) * 4] / 255;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = 2.2, nx = (h(i - 1, j) - h(i + 1, j)) * k, ny = (h(i, j + 1) - h(i, j - 1)) * k, l = Math.hypot(nx, ny, 1), o = (j * W + i) * 4;
    d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  return (RELIEF[key] = t);
}
// the sun through the cloth: lit from behind as you look at it, a sail glows with the light it lets through, tinted
// by the cloth and darker where the seams, battens and number are (the colour squared: light crossing a dye). The
// cloth scatters it forward, so the glow is brightest round where the sun stands behind it. And only where the sun
// reaches the far side: whatever stands between shows through as its shadow — the mast and the boom dark bands, the
// other sail's outline a dimmer shape (its cloth lets a little through). The shadow map's own test, made from this
// side of the cloth, would find the cloth itself in the way, so it is made again a hand's width towards the sun
// (along the light, which in the sun's orthographic shadow map is its depth alone: the camera's 1–140 m, world.js).
function translucent(m, amount) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
      {
        vec3 Ls = directionalLights[0].direction;
        float through = max(-dot(normal, Ls), 0.0);
        float lit = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        if (through > 0.0 && receiveShadow) {
          vec4 sc = vDirectionalShadowCoord[0]; sc.z -= 0.15 / 139.0;
          DirectionalLightShadow ds = directionalLightShadows[0];
          lit = mix(0.3, 1.0, getShadow(directionalShadowMap[0], ds.shadowMapSize, ds.shadowBias, ds.shadowRadius, sc));
        }
  #endif
        float fwd = pow(max(dot(-geometryViewDir, Ls), 0.0), 6.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * diffuseColor.rgb * directionalLights[0].color * (through + 0.6 * fwd * through) * lit * ${amount.toFixed(2)};
      }
#endif`);
  };
  m.customProgramCacheKey = () => `sail${amount}`;
  return m;
}
// a sail: one grid geometry, drawn twice so the number reads the right way round from both sides. rows × cols is how it
// is drawn from afar; close to the camera (fine, kept by the sail as it is drawn) it has twice as many of each, the
// curves and creases that a coarse grid can't hold
const SAIL_NEAR = /android|iphone|ipad/i.test(globalThis.navigator?.userAgent ?? '') ? 3.5 : 5; // a phone keeps the finer grid for the closest boats
export function sailMesh(rows0, cols0, tex, shiny = false, kind = 'main') {
  const tiers = rows0 > 2, rows = tiers ? rows0 * 2 : rows0, cols = tiers ? cols0 * 2 : cols0;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((rows + 1) * (cols + 1) * 3), uv = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) uv.push(j / cols, i / rows);
  const cells = (st) => {
    const out = [];
    for (let i = 0; i < rows; i += st) for (let j = 0; j < cols; j += st) {
      const a = i * (cols + 1) + j, b = a + st, c = a + st * (cols + 1), d = c + st;
      out.push(a, b, c, b, d, c);
    }
    return new THREE.BufferAttribute(new Uint16Array(out), 1);
  };
  const fineI = cells(1), coarseI = tiers ? cells(2) : fineI;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(fineI);
  const back = tex.back || tex.clone(); back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
  const relief = sailRelief(kind, tex.battens), reliefBack = relief.clone(); reliefBack.repeat.x = -1; reliefBack.offset.x = 1; reliefBack.needsUpdate = true;
  // laminate (shiny) sails catch a soft sheen and let less light through than woven cloth; a spinnaker's thin nylon
  // the most. A little emissive stands for the light bounced off the sea into the cloth's shaded side.
  const mat = (map, nmap, side) => translucent(new THREE.MeshStandardMaterial({
    map, side, normalMap: nmap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: shiny ? 0.45 : kind === 'kite' ? 0.55 : 0.72, metalness: shiny ? 0.12 : 0,
    emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.1,
  }), kind === 'kite' ? 0.6 : shiny ? 0.28 : 0.45);
  const grp = new THREE.Group(), front = new THREE.Mesh(g, mat(tex, relief, THREE.FrontSide)), rear = new THREE.Mesh(g, mat(back, reliefBack, THREE.BackSide));
  // one face casts the cloth's shadow, both sides of it (the shadow map's and the sea's), so it costs one draw there, not two
  if (BAKE.fold) { front.material.shadowSide = THREE.DoubleSide; rear.userData.flat = true; }
  grp.add(front, rear);
  grp.userData = { rows, cols, g, tiers, fine: true, step: 1, fineI, coarseI };
  // near enough to see the finer grid: within a few times the sail's own size, a little further to let it go again
  if (tiers) grp.children[0].onBeforeRender = (r, s, cam) => {
    const e = grp.matrixWorld.elements, size = (g.boundingSphere?.radius ?? 5) * Math.hypot(e[0], e[1], e[2]), p = cam.position;
    grp.userData.fine = Math.hypot(p.x - e[12], p.y - e[13], p.z - e[14]) < size * SAIL_NEAR * (grp.userData.fine ? 1.15 : 1);
  };
  return grp;
}
// the leech never stands quite still: the cloth's free edge flutters in the apparent wind a few centimetres either
// way, more the harder it blows, up to about 25 knots of it; the sideways offset at (f up the luff, u along the chord),
// from the sail's cloth state c (clothState: its flutter's own clock, the wind, how much this boat's sails flutter)
// and off, a phase of its own for another sail
export function leechFlutter(f, u, c, off = 0) {
  const w = THREE.MathUtils.smoothstep(u, 0.72, 1);
  return w * w * (0.01 + 0.0025 * Math.min(c.aws, 25)) * c.flutter * Math.sin(c.lf + off + f * 13) * (0.6 + 0.4 * Math.sin(c.t * 3.1 + f * 5));
}
// How a boat's sails set this frame, from the sim (b), kept on the view: depth, fuller in light air and off the wind
// and flatter as it blows up (the backstay and the outhaul on); twist, the head falling off more in a breeze and
// eased; back, upwind and overpowered, the main eased to keep her on her feet lifts behind its luff in the jib's
// wash; flogM, flogJ, how hard the main and the jib flap, built and let die over a fraction of a second, so a tack's
// luffing grows as the bow comes up to the wind and stops as the new side fills; curl, the gennaker's luff, which a
// good trimmer keeps on the edge of curling and which folds right in when it's over-eased or collapses in a gybe
export function clothState(view, b, t) {
  const c = view.cloth || (view.cloth = { t, flogM: 0, flogJ: 0, ph: Math.random() * 20 });
  const dt = clamp(t - c.t, 0, 0.25); c.t = t;
  const aws = b.aws || 0, a = Math.abs(b.twa || 0) / D2R, off = smoothstep(70, 150, a), ease = b.depower || 0;
  c.depth = lerp(1.18, 0.82, smoothstep(5, 20, aws)) * (1 + 0.18 * off);
  c.twist = lerp(0.75, 1.35, smoothstep(6, 22, aws)) * (1 + 0.35 * off);
  c.twist *= 1 + 0.5 * clamp(ease / 10, 0, 1); // eased to depower, the boom rises and the head falls off
  // a gust, against the wind of the last few seconds: it flattens the sails, blows their fullness aft and opens the leech
  c.slow = (c.slow ?? aws) + (aws - (c.slow ?? aws)) * (1 - Math.exp(-dt * 0.4));
  const gust = clamp((aws - c.slow) / Math.max(c.slow, 4) / 0.6, -1, 1), hard = Math.max(0, gust);
  c.depth *= 1 - 0.18 * hard + 0.08 * Math.max(0, -gust); c.twist *= 1 + 0.55 * hard;
  c.mainP = Math.log(0.5) / Math.log(lerp(0.47, 0.42, smoothstep(6, 20, aws)) + 0.04 * hard); // the power that puts the main's deepest point there
  c.jibP = Math.log(0.5) / Math.log(0.37 + 0.04 * hard);
  c.hook = (1 - off) * (1 - 0.7 * hard) * smoothstep(3, 10, aws); // sheeted in, the leech turns a little to windward
  // the boat rolling and pitching swings the rig through the air: how fast the masthead goes, against the wind
  const tilt = view.tilt, rz = tilt.rotation.z, rx = tilt.rotation.x, tall = view.drawnL ?? 10.45, air = Math.max(aws * 0.514, 1);
  if (dt > 0) {
    const k = 1 - Math.exp(-dt * 7);
    c.rollV = (c.rollV ?? 0) + (clamp((rz - (c.rz ?? rz)) / dt, -1.2, 1.2) - (c.rollV ?? 0)) * k;
    c.pitchV = (c.pitchV ?? 0) + (clamp((rx - (c.rx ?? rx)) / dt, -1.2, 1.2) - (c.pitchV ?? 0)) * k;
    c.rz = rz; c.rx = rx;
  }
  const rock = clamp((c.rollV ?? 0) * tall / air, -1, 1);
  c.slat = rock * smoothstep(12, 3, aws); // in a light air and a sea, the cloth slats from side to side
  // the kite is never still: it breathes with the air, fills in a gust and softens as the rig swings away from the wind
  c.breath = (c.breath ?? 0) + dt * (0.8 + 0.03 * aws);
  c.pulse = clamp(0.3 * Math.sin(c.breath + c.ph) + 0.16 * Math.sin(2.7 * c.breath + 1.3 * c.ph) + 0.7 * gust + 0.45 * rock - 0.3 * clamp((c.pitchV ?? 0) * tall / air, -1, 1), -1, 1);
  c.back = (1 - off) * clamp((ease - 3) / 10, 0, 1);
  const mainLuff = a < NO_GO ? 1 : b.trimErr === undefined ? b.luff || 0 : clamp((b.trimErr - ease - 5) / 18, 0, 1);
  const to = (x, want) => x + (want - x) * (1 - Math.exp(-dt * (want > x ? 7 : 2.5)));
  c.flogM = to(c.flogM, mainLuff); c.flogJ = to(c.flogJ, b.luff || 0);
  c.curl = clamp(0.1 + 0.22 * Math.max(0, Math.sin(t * 0.8 + c.ph)) ** 3 + 0.75 * (b.kiteCollapse || 0) + 0.6 * smoothstep(0.2, 0.8, b.luff || 0) + 0.22 * Math.max(0, -c.pulse), 0, 1);
  c.aws = aws;
  // the flutter's and the flog's own clocks, each run on at its rate for this wind: the wind changing changes how
  // fast the cloth goes, never where it is (a rate times the race's time would throw it about at the smallest change
  // in the wind, the further into the race the wilder: a shiver all over the sail)
  c.lf = (c.lf ?? c.ph) + dt * (19 + 0.4 * Math.min(aws, 25));
  c.fp = (c.fp ?? c.ph) + dt * 2 * Math.PI * (1.5 + 0.07 * Math.min(aws, 30));
  c.flutter = view.flutter ?? 1; // a foiler's sails, sheeted hard, hardly flutter
  c.wp = (c.wp ?? c.ph) + dt * (0.25 + 0.02 * Math.min(aws, 25)); // the creases' slow drift
  c.fine = view.main?.userData.fine !== false;
  // the cloth's creases: pulled out of a sail loaded up and drawing, standing out in light air and in one luffing or
  // flogging; a gennaker's the more its luff curls
  const light = smoothstep(9, 3, aws), crease = (grp, k) => { if (grp) for (const m of grp.children) m.material.normalScale?.setScalar(k); };
  crease(view.main, 0.4 + 0.9 * c.flogM + 0.3 * light); crease(view.main2, 0.4 + 0.9 * c.flogM + 0.3 * light);
  crease(view.jib, 0.4 + 0.9 * c.flogJ + 0.3 * light); crease(view.kite, 0.45 + 0.7 * c.curl + 0.3 * light);
  c.wr = 0.35 + 0.9 * light + 0.7 * Math.max(c.flogM, c.flogJ); // and the same creases in the cloth's shape, seen close to
  return c;
}
// the forestay sags to leeward and aft under load, a little over half a percent of its length and more as it blows:
// how far at its middle (len its length, aws the apparent wind, knots); sin(π f) of that at f up it
export const staySag = (len, aws) => len * (0.005 + 0.0006 * Math.min(aws, 25));
// the kite's hoist and the jib put away under it (it would only be in the kite's way), one after the other so they
// never cross: of the time a hoist takes (b.kiteFill, 0–1) the crew spend the first KITE_LEAD furling or lowering the
// jib and the rest sending the kite up; a drop goes the other way, the kite down and then the jib set again
const KITE_LEAD = 0.3, kiteFillOf = (b) => b.kiteFill ?? (b.kite ? 1 : 0);
// how far the kite is up, 0–1, for the picture
export const kiteHoist = (b) => clamp((kiteFillOf(b) - KITE_LEAD) / (1 - KITE_LEAD), 0, 1);
// how far the jib is put away, 0–1
export const jibStow = (b) => smoothstep(0, KITE_LEAD, kiteFillOf(b));
// a point v of the jib (in its pivot's frame, the tack at 0) put away by s: furled, drawn in onto the luff at its
// height (lx, ly, lz) to a roll of a few per cent of the chord; lowered (a hanked jib), down the stay to a heap on
// the foredeck at the tack
export function stowJib(v, s, lower, lx = 0, ly = 0, lz = 0) {
  if (s <= 0) return v;
  if (lower) return v.set(v.x * (1 - 0.8 * s), v.y * (1 - 0.97 * s), v.z * (1 - 0.8 * s));
  const k = 1 - 0.96 * s;
  return v.set(lx + (v.x - lx) * k, ly + (v.y - ly) * k, lz + (v.z - lz) * k);
}
// the telltales on a jib that's put away: gone with it (scaled, as setDetail owns their visibility)
export function stowTells(tells, s) {
  for (const tt of tells) { const k = (tt.userData.k ??= tt.scale.x); tt.scale.setScalar(k * Math.max(1e-4, 1 - smoothstep(0, 0.4, s))); }
}
// a rope between a and b (from point i0 of a line's n points, a and b included), sagging sag at its middle (in the
// boat's frame, down) and, flogging, whipped side to side by whip
export function drape(attr, i0, n, a, b, sag, whip = 0, t = 0) {
  for (let k = 0; k < n; k++) {
    const s = k / (n - 1), d = 4 * s * (1 - s);
    attr.setXYZ(i0 + k, lerp(a[0], b[0], s) + whip * d * Math.sin(t * 19 + s * 5), lerp(a[1], b[1], s) - sag * d, lerp(a[2], b[2], s));
  }
}
// water on deck: heeled far enough that her leeward rail dips (and further as the waves roll her down), the sea
// comes over it and runs aft along the side deck in a sheet, streaked white, reaching further inboard the deeper she
// goes. A strip either side, w wide inboard of the deck's edge, from z0 to z1; set(roll, t, v) each frame
const WASH_VS = `attribute float aSide; varying vec2 vUv; varying float vSide;
void main() { vUv = uv; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WASH_FS = `uniform vec2 uAmt; uniform float uTime; varying vec2 vUv; varying float vSide;
void main() {
  float a = vSide < 0.0 ? uAmt.x : uAmt.y;
  if (a < 0.01) discard;
  float edge = 1.0 - smoothstep(a * 1.1 - 0.3, a * 1.1, vUv.y); // how far inboard it runs
  float s = vUv.x * 16.0 - uTime;
  float streak = 0.5 + 0.5 * sin(s * 1.7 + sin(vUv.y * 9.0 + s * 0.6) * 2.0);
  float foam = smoothstep(0.62, 0.95, streak) * (0.4 + 0.6 * (1.0 - vUv.y));
  float alpha = edge * a * (0.5 + 0.45 * foam) * smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
  gl_FragColor = vec4(mix(vec3(0.3, 0.52, 0.56), vec3(0.95, 0.97, 1.0), foam), alpha); // green water, streaked white
}`;
export function deckWash(hbAt, deckY, z0, z1, w = 0.45) {
  const N = 28, pos = [], uv = [], side = [], idx = [];
  for (const sx of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const z = lerp(z0, z1, i / N), hb = hbAt(z);
      for (const v of [0, 1]) { const x = Math.max(0.12, hb - 0.04 - v * w); pos.push(sx * x, deckY(z) + 0.02 + v * 0.03, z); uv.push(i / N, v); side.push(sx); }
    }
    for (let i = 0; i < N; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setIndex(idx);
  const u = { uAmt: { value: new THREE.Vector2() }, uTime: { value: 0 } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: WASH_VS, fragmentShader: WASH_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.userData.flat = true; mesh.renderOrder = 3; mesh.frustumCulled = false;
  let flow = 0, last = null;
  // roll: her roll now (+ lifts the starboard side, so the port deck goes down), heel and the seas together
  mesh.userData.set = (roll, t, v) => {
    const deg = Math.abs(roll) / D2R, a = smoothstep(21, 33, deg), down = roll > 0 ? -1 : 1;
    u.uAmt.value.set(down < 0 ? a : 0, down > 0 ? a : 0);
    flow += clamp(t - (last ?? t), 0, 0.1) * (1.5 + Math.max(0, v) * 0.8); last = t; u.uTime.value = flow;
    mesh.visible = a > 0.01;
  };
  return mesh;
}
// the cloth's sideways offset at (f up the luff, u aft along the chord) when it isn't drawing: k how hard it flaps
// (0–1), chord the sail's width there, s the side the boom is on, p the flog's clock (clothState's fp). A sail just
// luffing lifts — a bubble backed behind the luff; with the wind right along it, it flogs: waves run aft from the
// luff, growing to the leech, quicker (the clock) and harder the more it blows
export function flog(f, u, p, k, chord, aws, s, ph = 0) {
  if (k < 0.005) return 0;
  const bubble = s * Math.min(k * 3, 1) * (1 - smoothstep(0.35, 0.95, k)) * chord * 0.05 * Math.sin(Math.PI * Math.min(u / 0.45, 1));
  const q = smoothstep(0.25, 0.85, k);
  const amp = chord * (0.07 + 0.004 * Math.min(aws, 25)) * q * u ** 1.15 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(f * 1.15, 1)));
  return bubble + amp * (Math.sin(p - 6.5 * u - 2.2 * f + ph) + 0.45 * Math.sin(1.7 * p - 11 * u + 3.1 * f + 2 * ph));
}
// a main's cloth beyond its cut: flogging, and backed behind the luff when she's overpowered (s: the boom's side)
export const mainCloth = (c, f, u, chord, s) => flog(f, u, c.fp, c.flogM, chord, c.aws, s, c.ph) + s * c.back * chord * 0.045 * Math.sin(Math.PI * Math.min(u / 0.35, 1)) * Math.sin(Math.PI * (0.15 + 0.7 * f)) + slat(c, f, u, chord) + wrinkle(c, f, u, chord);
// the cloth slatting as the rig rolls, most at the leech and halfway up
const slat = (c, f, u, chord) => c.slat * c.flutter * chord * 0.035 * u * u * Math.sin(Math.PI * Math.min(1, f * 1.05));
// the creases the load puts in the cloth, seen close to: fanning out of the clew and running down from the head
export function wrinkle(c, f, u, chord) {
  if (!c.fine) return 0;
  let w = 0;
  const r = Math.hypot(1 - u, f * 1.2);
  if (r < 0.55) w += smoothstep(0.55, 0.22, r) * smoothstep(0.03, 0.12, r) * Math.sin(Math.atan2(f * 1.2, 1 - u) * 14 + r * 5 + c.wp);
  if (f > 0.7) w += 0.7 * smoothstep(0.7, 0.92, f) * Math.sin(u * 16 + f * 6 - c.wp * 0.7);
  return w * chord * 0.009 * c.wr * c.flutter;
}
// A main at (f up the luff, u aft along its chord ch), sideways (x) and aft of the luff (z); s the boom's side, k its depth
// as a share of the chord, tw how far its head twists off, battens whether it has any. Deepest a little forward of
// halfway, flat along the boom, its leech turned a little to windward when sheeted in and, with battens, hollow between them.
const MAIN_AT = { x: 0, z: 0 }, BATTEN_F = [0, 0.24, 0.42, 0.6, 0.76, 0.9, 1];
const betweenBattens = (f) => { let i = 1; while (i < 6 && f > BATTEN_F[i]) i++; return Math.sin(Math.PI * clamp((f - BATTEN_F[i - 1]) / (BATTEN_F[i] - BATTEN_F[i - 1]), 0, 1)); };
export function mainShape(c, f, u, ch, s, k, tw, battens = true) {
  const aft = smoothstep(0.7, 1, u), shelf = lerp(0.6, 1, smoothstep(0, 0.14, f));
  MAIN_AT.x = -s * (1 - c.flogM * 0.85) * Math.sin(Math.PI * u ** c.mainP) * ch * k * c.depth * (1 - 0.4 * f) * shelf - s * f * f * tw * u * c.twist
    + s * c.hook * aft * aft * ch * 0.028 * Math.sin(Math.PI * Math.min(1, f * 1.1)) + mainCloth(c, f, u, ch, s) + leechFlutter(f, u, c);
  MAIN_AT.z = u * ch * (1 - (battens ? 0.02 * aft * betweenBattens(f) : 0));
  return MAIN_AT;
}
// The shrouds stop an eased main: the boom comes up against them, and above it the cloth lies along them, each height of
// the sail turned aft about the mast as far as it takes to pass behind every wire there. Only what's drawn: the race goes
// on sailing the angle it was trimmed to.
// shroudsOf: the wires on one side, up the mast's frame [x, y, z of the lower end, x, y, z of the upper], the standing
// rigging abeam of the mast and not the backstays, halyards or lifelines
const WIRE_A = new THREE.Vector3(), WIRE_B = new THREE.Vector3(), SHROUD_EASED = 25 * D2R, SHROUD_GAP = 2 * D2R, SHROUD_FLAT = 0.4, ROW_TURN = 2.5 * D2R;
function shroudsOf(v) {
  v.root.updateMatrixWorld(true);
  const to = new THREE.Matrix4().copy(v.mainPivot.matrixWorld).invert(), out = [];
  for (const o of v.tilt.children) {
    if (!o.isLine || !o.frustumCulled) continue;
    const p = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(to, o.matrixWorld);
    for (let i = 0; i < p.count - 1; i++) {
      const a = WIRE_A.fromBufferAttribute(p, i).applyMatrix4(m), b = WIRE_B.fromBufferAttribute(p, i + 1).applyMatrix4(m);
      const [lo, hi] = a.y < b.y ? [a, b] : [b, a], end = a.x > b.x ? a : b;
      if (Math.min(a.x, b.x) < -0.01 || end.x < 0.15 || hi.y - lo.y < 0.5 * a.distanceTo(b) || Math.atan2(end.x, end.z) < 35 * D2R) continue;
      out.push(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z);
    }
  }
  return new Float32Array(out);
}
// Sets the boom's angle for a main trimmed to sa, and how far each row of the cloth turns aft of it (turnMain). shape: the
// sail as it's about to be cut, y(f) its height, chord(f), x(f, u) its cloth off the boom's line, z0 how far aft of the
// pivot its luff starts, axis(y) how far aft the mast has raked at that height
export function clearShrouds(v, sa, ss, shape) {
  const rows = v.main.userData.rows, d = (v.mainTurn ??= new Float32Array(rows + 1)), W = v.shrouds, L = ss < 0 ? 1 : -1, a = Math.abs(ss) * sa;
  d.fill(0);
  let drawn = a;
  const flat = v.mainFlat = W?.length ? lerp(1, SHROUD_FLAT, smoothstep(35 * D2R, 60 * D2R, a)) : 1; // pressed on the rig, the cloth loses its belly
  if (a > SHROUD_EASED && W?.length) {
    const z0 = shape.z0 ?? 0;
    for (let i = 0; i <= rows; i++) {
      const f = i / rows, y = shape.y(f), ch = shape.chord(f), ax = shape.axis ? shape.axis(y) : 0;
      for (let k = 0; k < W.length; k += 6) {
        if (y < W[k + 1] || y > W[k + 4]) continue;
        const t = (y - W[k + 1]) / (W[k + 4] - W[k + 1]), wx = lerp(W[k], W[k + 3], t), wz = lerp(W[k + 2], W[k + 5], t) - ax, R = Math.hypot(wx, wz);
        if (R < 0.01 || R > ch + z0) continue; // past the leech, the wire is clear of this height of the sail
        const off = L * flat * shape.x(f, clamp((R - z0) / ch, 0, 1)); // the cloth's lee side where the wire would meet it
        d[i] = Math.max(d[i], a + Math.asin(clamp(off / R, -1, 1)) + SHROUD_GAP - Math.atan2(wx, wz));
      }
    }
    // the cloth bends round the wires in a smooth curve, and no part of it turns forward of the boom
    for (let i = 1; i <= rows; i++) d[i] = Math.max(d[i], d[i - 1] - ROW_TURN);
    for (let i = rows - 1; i >= 0; i--) d[i] = Math.max(d[i], d[i + 1] - ROW_TURN);
    drawn = a - d[0];
    for (let i = rows; i >= 0; i--) d[i] = Math.max(0, d[i] - d[0]);
  }
  v.mainLee = L;
  v.mainPivot.rotation.y = L * drawn;
}
// a point of the main, at f up its luff, turned aft about the mast with its row (clearShrouds)
export function turnMain(v, f, p) {
  p.x *= v.mainFlat;
  const d = v.mainTurn[Math.round(f * (v.mainTurn.length - 1))];
  if (!d) return;
  const c = Math.cos(d), s = Math.sin(d), x = p.x, z = p.z;
  p.x = x * c - v.mainLee * z * s; p.z = v.mainLee * x * s + z * c;
}
// A jib's offset from the flat between its luff and leech: deepest well forward, flatter up high, twisting off at the
// head, its leech turned in a little; len its chord there, k its depth, ph its flog's own phase
export function jibShape(c, f, u, len, s, k, ph) {
  const aft = smoothstep(0.78, 1, u);
  return -s * (1 - c.flogJ * 0.85) * Math.sin(Math.PI * u ** c.jibP) * len * k * c.depth * (1 - 0.22 * f) * lerp(0.72, 1, smoothstep(0, 0.16, f)) - s * f * u * len * 0.14 * c.twist
    + s * c.hook * aft * aft * len * 0.018 + flog(f, u, c.fp, c.flogJ, len, c.aws, s, c.ph + ph) + leechFlutter(f, u, c, 7.6) + 0.7 * slat(c, f, u, len) + wrinkle(c, f, u, len);
}
// a jib's leech is cut hollow: how far along its chord a point u of the way aft comes
export const jibAlong = (f, u) => u * (1 - 0.035 * Math.sin(Math.PI * f) * smoothstep(0.55, 1, u));
// the gennaker's luff folding in (0–1 of its curl, at f up the luff and u aft): times the sail's size, towards the boat
export const kiteCurl = (c, f, u) => c.curl * (1 - smoothstep(0, 0.3, u)) ** 2 * Math.sin(Math.PI * Math.min(1, f * 1.1));
// The kite's whole surface, from its three corners (tack, head and clew, [x, y, z], the guard's clew already set): wide
// at the shoulders, well up the sail, with a round luff and leech, an arched foot and its belly carried down to the foot.
// sd the side it flies on; wd for a spinnaker, the pole's side, whose two luffs curve out alike (0 for a gennaker, its
// luff forward and its leech out along the clew's line); R its depth in metres; k how far it has filled
export function setKite(view, tk, hd, cl, sd, wd, R, k, guard) {
  const c = view.cloth, sym = wd !== 0, cx = cl[0] - hd[0], cz = cl[2] - hd[2], cd = Math.hypot(cx, cz) || 1, rx = cx / cd, rz = cz / cd;
  setSail(view.kite, (f, u, v) => {
    const sh = Math.sin(Math.PI * f ** (sym ? 1.25 : 1.3)) * R * k;
    const env = (0.42 + 0.58 * Math.sin(Math.PI * Math.min(1, f * 1.08))) * smoothstep(1, 0.84, f);
    const bul = Math.sin(Math.PI * u ** 0.9) * env * R * k * (1 + 0.1 * c.pulse), cu = kiteCurl(c, f, u) * 0.55 * R * k;
    const arch = (1 - smoothstep(0, 0.2, f)) * Math.sin(Math.PI * u) * (sym ? 0.2 : 0.12) * R * k;
    const edge = c.curl * (1 - smoothstep(0, 0.16, u)) * Math.sin(f * 22 - c.fp + c.ph) * 0.05 * R * k; // the luff's edge rippling as it curls
    const skin = leechFlutter(f, u, c, 3.1) * R * 0.5 + wrinkle(c, f, u, R * 2) + wrinkle(c, f, 1 - u, R * 2);
    const ly = lerp(lerp(tk[1], hd[1], f), lerp(cl[1], hd[1], f), u) + arch;
    if (sym) {
      const lx = wd * 0.83 * sh, lz = -0.83 * sh;
      v.set(lerp(lerp(tk[0], hd[0], f) + lx, lerp(cl[0], hd[0], f) - lx, u) + sd * (cu * 0.4 + edge), ly, lerp(lerp(tk[2], hd[2], f), lerp(cl[2], hd[2], f), u) + lz - bul + cu * 0.6 - skin);
    } else {
      const round = 0.4 * Math.sin(Math.PI * f ** 1.15) * R * k;
      v.set(lerp(lerp(tk[0], hd[0], f) + sd * 0.86 * sh, lerp(cl[0], hd[0], f) + rx * round, u) + sd * (bul - cu + edge) + skin, ly, lerp(lerp(tk[2], hd[2], f) - 0.93 * sh, lerp(cl[2], hd[2], f) + rz * round, u) - bul * 0.9 + cu * 0.6 - skin * 0.6);
    }
    guard.keep(v);
  });
}
// A sail far off is cut anew one frame in three, each on a beat of its own (so the fleet's don't all fall on one frame): the
// shaping of the sails is the race's largest source of garbage, and from there no one can see its cloth move.
const SAIL_V = new THREE.Vector3();
let sailBeats = 0;
export function setSail(m, fn) {
  const d = m.userData;
  if (d.tiers && !d.fine && d.cut) { d.beat = ((d.beat ?? sailBeats++) + 1) % 3; if (d.beat) return; }
  d.cut = true;
  const { rows, cols, g } = d, a = g.attributes.position, v = SAIL_V, st = d.tiers && !d.fine ? 2 : 1;
  if (st !== d.step) { d.step = st; g.setIndex(st > 1 ? d.coarseI : d.fineI); }
  for (let i = 0; i <= rows; i += st) for (let j = 0; j <= cols; j += st) { fn(i / rows, j / cols, v); a.setXYZ(i * (cols + 1) + j, v.x, v.y, v.z); }
  a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
}

// The kite flies ahead of the main. Its clew is set for a main sheeted in, and a main eased square swings forward past
// it, so the cloth went through the main: asked of the main as it is drawn this frame (set before the kite, its belly,
// twist, reef and all). clew(c, lead) swings the clew round the mast until it lies ahead of the main, and lowers it as far
// as its sheet, running aft to the lead, needs to pass under the boom; keep(v) lifts any of the kite still behind the
// main's forward face off it, by a gap that grows with her size, and a spinnaker's windward shoulder forward of the mast.
const KITE_GAP = 0.045, CLEW_AHEAD = 12 * D2R; // of the main's foot; how far ahead of the main the clew flies
const toBoat = new THREE.Matrix4(), toMain = new THREE.Matrix4(), onMain = new THREE.Vector3();
export function kiteGuard(view) {
  toBoat.identity();
  for (let o = view.main; o !== view.kite.parent; o = o.parent) { o.updateMatrix(); toBoat.premultiply(o.matrix); }
  toMain.copy(toBoat).invert();
  const { rows: fullRows, cols: fullCols, g, step: st } = view.main.userData, a = g.attributes.position.array, w = fullCols + 1, rows = fullRows / st, cols = fullCols / st;
  const lee = view.sailSide < 0 ? 1 : -1, ahead = CLEW_AHEAD * Math.min(1, Math.abs(view.sailSide));
  const y0 = a[1], y1 = a[fullRows * w * 3 + 1], gap = KITE_GAP * Math.abs(a[fullCols * 3 + 2] - a[2]), e = toBoat.elements;
  // across a row of the main, at z: where its cloth lies, and how far aft along the row that is (0 the luff, 1 the leech)
  let rowU = 0;
  const across = (i, z) => {
    const o = i * st * w * 3, zl = a[o + 2], u = (z - zl) / (a[o + fullCols * 3 + 2] - zl), c = clamp(u, 0, 1) * cols, j = Math.min(cols - 1, Math.floor(c));
    rowU = u;
    return lerp(a[o + j * st * 3], a[o + (j + 1) * st * 3], c - j);
  };
  return {
    clew(c, lead) {
      onMain.set(lead[0], lead[1], lead[2]).applyMatrix4(toMain);
      const lx = onMain.x, ly = onMain.y, lz = onMain.z;
      onMain.set(c[0], c[1], c[2]).applyMatrix4(toMain);
      if (Math.atan2(lee * onMain.x, onMain.z) < ahead) {
        const r = Math.hypot(onMain.x, onMain.z);
        onMain.x = lee * r * Math.sin(ahead); onMain.z = r * Math.cos(ahead);
      }
      // where the sheet crosses the main's plane: over the boom, the clew comes down until it passes under; past the
      // leech it's clear, and in between the one eases into the other
      const t = onMain.x / (onMain.x - lx);
      if (t > 0 && t < 1) {
        const foot = a[fullCols * 3 + 2], at = lerp(onMain.z, lz, t) / foot, under = (y0 - gap - t * ly) / (1 - t);
        onMain.y = lerp(onMain.y, Math.min(onMain.y, under), smoothstep(1.15, 1, at));
      }
      onMain.applyMatrix4(toBoat); c[0] = onMain.x; c[1] = onMain.y; c[2] = onMain.z;
    },
    keep(v) {
      onMain.copy(v).applyMatrix4(toMain);
      const r = clamp((onMain.y - y0) / (y1 - y0), 0, 1) * rows, i = Math.min(rows - 1, Math.floor(r));
      const x0 = across(i, onMain.z), u0 = rowU, x = lerp(x0, across(i + 1, onMain.z), r - i), u = lerp(u0, rowU, r - i);
      // to windward, just aft of the mast: round ahead of it, the further the further out it lies; right on the main it
      // only lifts, so a point that wavers from one side of the cloth to the other moves no further than it does
      const side = lee * (onMain.x - x), round = u > 0 && side < 0 ? smoothstep(0, 1.5 * gap, -side) * smoothstep(0.5, 0.35, u) : 0;
      if (round > 0) {
        const back = (onMain.z - a[Math.round(r) * st * w * 3 + 2] + gap + 1.5 * Math.abs(onMain.x - x)) * round;
        v.x -= e[8] * back; v.y -= e[9] * back; v.z -= e[10] * back;
      }
      const d = side - gap;
      if (d >= gap || u <= 0) return;
      const lift = lee * (gap * gap / (2 * gap - d) - d) * smoothstep(0, 0.12, u) * (1 - round); // eased, so the cloth never creases where it starts to lift
      v.x += e[0] * lift; v.y += e[1] * lift; v.z += e[2] * lift;
    },
  };
}

// ---------- labels ----------
export function labelSprite(color) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, toneMapped: false }));
  s.scale.set(0.2, 0.04, 1); s.renderOrder = 10;
  s.userData.set = (text, warn) => {
    if (s.userData.text === text + warn) return;
    s.userData.text = text + warn;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 320, 64);
    x.font = '700 30px Carlito, Lato, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(text).width + 34;
    x.fillStyle = warn ? 'rgba(190,30,20,0.8)' : 'rgba(0,0,0,0.45)'; x.beginPath(); x.roundRect((320 - w) / 2, 12, w, 40, 20); x.fill();
    x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.beginPath(); x.arc((320 - w) / 2 + 18, 32, 7, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.fillText(text, 160 + 8, 33);
    tex.needsUpdate = true;
  };
  return s;
}
// the looks: hull paint, sail cloth and number, gennaker panels
export const LOOKS = {
  player: { hull: '#1c1f24', stripe: '#1c1f24', cloth: '#2a2c30', laminate: true, tape: '#1e1f22', batten: '#1d1f22', ink: '#ffffff', nat: 'RYC', num: '1', logo: false, kite: ['#1c1f24', '#f4f3ef'], bottom: '#1c1f24', crew: '#1c1f24', pants: '#1c1f24' }, // all black, a black and white gennaker, no logo, RYC 1 in white (lib/boat.ts DEFAULT_BOAT)
  Aurora: { hull: '#a8202a', stripe: '#f4f2ec', cloth: '#7f858c', laminate: true, tape: '#5f646b', batten: '#5a5f66', ink: '#ffffff', nat: 'GBR', flag: '/flags/gb.svg', num: '52', kite: ['#e63946', '#ffffff'] },
  Kestrel: { hull: '#14503c', stripe: '#e9e3cf', cloth: '#2a2c30', laminate: true, tape: '#18191c', batten: '#1c1d20', ink: '#f2c230', nat: 'FRA', flag: '/flags/fr.svg', num: '7', kite: ['#2a9d8f', '#f2c230'] },
  Nomad: { hull: '#2b2f36', stripe: '#e8c547', cloth: '#ebe3cd', tape: '#cfc5aa', batten: '#d2c9b0', ink: '#b3262b', nat: 'ITA', flag: '/flags/it.svg', num: '33', kite: ['#f4a261', '#1d1d1d'] },
  Halcyon: { hull: '#1f4e8c', stripe: '#ffffff', cloth: '#f2f0e8', tape: '#d6d1c2', batten: '#d0ccbe', ink: '#1f4e8c', nat: 'NED', flag: '/flags/nl.svg', num: '14', kite: ['#3a86ff', '#ffbe0b'] },
  Mistral: { hull: '#f3f1ec', stripe: '#6c3483', cloth: '#3a3d42', laminate: true, tape: '#23252a', batten: '#26282d', ink: '#ffffff', nat: 'ESP', flag: '/flags/es.svg', num: '88', kite: ['#8e44ad', '#ffffff'] },
  Selkie: { hull: '#0f6b5f', stripe: '#f1ece0', cloth: '#efeadd', tape: '#d3ccb8', batten: '#cfc8b4', ink: '#0f6b5f', nat: 'IRL', flag: '/flags/ie.svg', num: '21', kite: ['#16a085', '#f1c40f'] },
  Tern: { hull: '#f5f4f0', stripe: '#e67e22', cloth: '#868c93', laminate: true, tape: '#62676e', batten: '#5d6269', ink: '#1d1d1d', nat: 'GER', flag: '/flags/de.svg', num: '9', kite: ['#e67e22', '#2d3436'] },
  Vela: { hull: '#7a1f3d', stripe: '#f6e6ea', cloth: '#f3f0e8', tape: '#d8d2c3', batten: '#d2ccbd', ink: '#7a1f3d', nat: 'CRO', flag: '/flags/hr.svg', num: '40', kite: ['#e84393', '#ffffff'] },
  Zephyr: { hull: '#b9bec4', stripe: '#1d1f22', cloth: '#2b2d31', laminate: true, tape: '#1a1b1e', batten: '#1d1e21', ink: '#e8e8e8', nat: 'SWE', flag: '/flags/se.svg', num: '63', kite: ['#0984e3', '#fdcb6e'] },
};

// the player's own boat, as the boat page (/boat) saves it in localStorage 'regatta-boat': the colours of the hull, the
// sails, the gennaker (up to three) and the crew, the bottom paint, the deck, her name, the sail number and the flag. lookFrom turns it into a look; anything missing or
// malformed keeps the default boat's (all black, a black and white gennaker). A logo saved on a boat is not read: the
// logo on the mainsail is the admin's alone (sailAd).
export const BOAT_KEY = 'regatta-boat';
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const darker = (hex, f) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#000000'), f).getHexString();
export function lookFrom(b) {
  const L = { ...LOOKS.player };
  if (!b || typeof b !== 'object') return L;
  for (const k of ['hull', 'cloth', 'ink', 'crew', 'pants']) if (isHex(b[k])) L[k] = b[k];
  L.stripe = L.hull; // no stripe of its own: the sheer stripe and the boot-top are the hull's colour
  const kite = Array.isArray(b.kite) ? b.kite[0] : b.kite; // the gennaker's first colour (older saves kept three panels: the top one)
  if (isHex(kite)) L.kite = [kite];
  L.kite = [L.kite[0], ...[b.kite2, b.kite3].filter(isHex)]; // then its second and third, in bands
  if (isHex(b.bottom)) L.bottom = b.bottom;
  if (b.deck === 'teak' || b.deck === 'hull') L.deck = b.deck;
  if (typeof b.name === 'string') { const n = b.name.replace(/[^\p{L}\p{N} .'’&-]/gu, '').trim().slice(0, 16); if (n) L.name = n; } // as lib/boat.ts cleanName
  if (typeof b.laminate === 'boolean') L.laminate = b.laminate;
  L.tape = darker(L.cloth, L.laminate ? 0.28 : 0.12); L.batten = darker(L.cloth, L.laminate ? 0.3 : 0.14); // the luff tape and battens: a shade darker than the cloth
  if (typeof b.num === 'string' && b.num.trim()) L.num = b.num.trim().slice(0, 4);
  if (typeof b.nat === 'string' && b.nat.trim()) L.nat = b.nat.trim().toUpperCase().slice(0, 3);
  if (typeof b.flag === 'string' && /^[a-z]{2}$/.test(b.flag)) L.flag = `/flags/${b.flag}.svg`; // public/flags, lib/flags.ts
  return L;
}
export function playerLook() {
  try { return lookFrom(JSON.parse(localStorage.getItem(BOAT_KEY) || 'null')); } catch (e) { return lookFrom(null); }
}

// ---------- the crew ----------
// a sailor, built at the hips and facing +x: legs that bend at the hip and the knee, a body that leans, arms bent at
// the elbow. Each part is lofted through real cross-sections — a chest deeper than the waist, a seat behind the hips,
// thighs and calves that taper to the knee and the ankle, a head with a jaw, a nose and ears — and dressed: a jacket,
// an inflatable lifejacket over the shoulders with its belt, sailing gloves, sea boots with white soles, a knitted ski
// mask that leaves only the eyes, sunglasses and a cap (or a helmet). The boat turns each one about y and mirrors those on the port side.
const THIGH = 0.44, SHIN = 0.44;
export { THIGH, SHIN };
// the sections of her body, as loft takes them
const R = {
  thigh: [[0.06, 0, 0, 0, -0.01], [0.04, 0.078, 0.076, 0.088], [-0.02, 0.096, 0.095, 0.1], [-0.14, 0.092, 0.097, 0.088], [-0.27, 0.078, 0.085, 0.074], [-0.38, 0.063, 0.068, 0.06], [-0.45, 0.057, 0.06, 0.053], [-0.48, 0, 0, 0]],
  shin: [[0.02, 0, 0, 0], [0, 0.053, 0.055, 0.052], [-0.08, 0.057, 0.052, 0.076], [-0.16, 0.055, 0.048, 0.072], [-0.27, 0.045, 0.042, 0.05], [-0.38, 0.036, 0.037, 0.038], [-0.45, 0.036, 0.037, 0.038], [-0.47, 0, 0, 0]],
  foot: [[-0.075, 0, 0, 0], [-0.065, 0.036, 0.03, 0.05], [-0.035, 0.046, 0.034, 0.064], [0.03, 0.05, 0.034, 0.054], [0.11, 0.054, 0.034, 0.036], [0.18, 0.048, 0.032, 0.025], [0.21, 0.034, 0.028, 0.016], [0.222, 0, 0, 0, -0.008]],
  pelvis: [[-0.03, 0, 0, 0, -0.01], [-0.01, 0.12, 0.06, 0.09], [0.03, 0.165, 0.085, 0.115], [0.09, 0.168, 0.095, 0.11], [0.15, 0.16, 0.1, 0.105]],
  torso: [[0.03, 0, 0, 0], [0.04, 0.155, 0.1, 0.105], [0.08, 0.172, 0.112, 0.118], [0.17, 0.164, 0.112, 0.11], [0.27, 0.172, 0.124, 0.112], [0.36, 0.186, 0.134, 0.114], [0.42, 0.194, 0.126, 0.112], [0.465, 0.2, 0.11, 0.1], [0.5, 0.17, 0.088, 0.084], [0.525, 0.115, 0.074, 0.07], [0.545, 0.08, 0.068, 0.066], [0.6, 0.067, 0.064, 0.062], [0.6, 0, 0, 0]],
  upperArm: [[0.04, 0, 0, 0, -0.004], [0.028, 0.04, 0.042, 0.044], [0.004, 0.056, 0.056, 0.056], [-0.06, 0.054, 0.056, 0.052], [-0.16, 0.047, 0.051, 0.045], [-0.25, 0.043, 0.045, 0.043], [-0.29, 0, 0, 0]],
  forearm: [[0.02, 0, 0, 0], [0, 0.044, 0.046, 0.044], [-0.07, 0.046, 0.05, 0.046], [-0.16, 0.038, 0.04, 0.036], [-0.2, 0.04, 0.042, 0.04], [-0.225, 0.042, 0.044, 0.042], [-0.23, 0, 0, 0]],
  neck: [[0.5, 0.054, 0.054, 0.054], [0.58, 0.052, 0.05, 0.055, -0.005], [0.635, 0.054, 0.05, 0.056, -0.008]],
  head: [[0.592, 0, 0, 0, 0.055], [0.598, 0.036, 0.028, 0.022, 0.05], [0.614, 0.064, 0.055, 0.054, 0.028], [0.64, 0.073, 0.072, 0.074, 0.012], [0.67, 0.075, 0.087, 0.09, 0.004], [0.705, 0.078, 0.09, 0.095], [0.745, 0.075, 0.084, 0.094, -0.004], [0.773, 0.062, 0.066, 0.08, -0.008], [0.792, 0.036, 0.036, 0.048, -0.01], [0.798, 0, 0, 0, -0.012]],
};
// the lifejacket's lobes, down the chest, over the shoulders and round the back of the neck
const YOKE = [[0.12, 0.22, 0.07], [0.14, 0.34, 0.082], [0.112, 0.45, 0.1], [0.035, 0.515, 0.112], [-0.055, 0.52, 0.094], [-0.082, 0.54, 0.04], [-0.082, 0.54, -0.04], [-0.055, 0.52, -0.094], [0.035, 0.515, -0.112], [0.112, 0.45, -0.1], [0.14, 0.34, -0.082], [0.12, 0.22, -0.07]];
// where the hair ends, by how far round from the face (a): the sideburn, over the ear, down to the nape
const hairLine = (a) => {
  const d = Math.min(a, Math.PI * 2 - a);
  if (d < 1.46) return 0.672;
  if (d < 1.78) return 0.703;
  return THREE.MathUtils.lerp(0.69, 0.646, THREE.MathUtils.smoothstep(d, 1.78, Math.PI));
};
// a cap's bill: curved down at the sides and sloping down in front (a top and an underside joined at the edge)
function capBrim(NA, NR) {
  const pos = [], uv = [], idx = [], T = 0.005, SPAN = 1.2;
  for (const side of [0, 1]) for (let i = 0; i <= NA; i++) for (let j = 0; j <= NR; j++) {
    const th = (i / NA * 2 - 1) * SPAN, c = Math.cos(th), sn = Math.sin(th), r = j / NR, z = 0.09 * sn * (1 + 0.04 * r);
    const len = ((c - Math.cos(SPAN)) / (1 - Math.cos(SPAN))) ** 0.7; // the bill: longest in front, gone at its ends
    const x = -0.008 + 0.104 * c + 0.078 * len * c * r, y = 0.725 - 0.016 * len * r - 1.4 * z * z * r - side * T;
    pos.push(x, y, z); uv.push(i / NA, r);
  }
  const at = (side, i, j) => side * (NA + 1) * (NR + 1) + i * (NR + 1) + j;
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) {
    const a = at(0, i, j), b = at(0, i + 1, j), c = at(0, i, j + 1), d = at(0, i + 1, j + 1);
    idx.push(a, b, c, b, d, c); // the top
    const a2 = at(1, i, j), b2 = at(1, i + 1, j), c2 = at(1, i, j + 1), d2 = at(1, i + 1, j + 1);
    idx.push(a2, c2, b2, b2, c2, d2); // the underside
  }
  for (let i = 0; i < NA; i++) { const a = at(0, i, NR), b = at(0, i + 1, NR), a2 = at(1, i, NR), b2 = at(1, i + 1, NR); idx.push(a, a2, b, b, a2, b2); } // the edge
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a body part lofted up y through rings [y, half width (z), depth forward (+x), depth back (−x), x offset]; a ring with
// no width closes that end at a point. Sections are superellipses (p > 2 squarer than an ellipse); the rings may run
// up or down.
function loft(rings, seg = 12, p = 2.3) {
  const pos = [], uv = [], idx = [], at = [], n = rings.length;
  rings.forEach(([y, w, f, b, x0 = 0], i) => {
    at.push(pos.length / 3);
    if (!w) { pos.push(x0, y, 0); uv.push(0.5, i / (n - 1)); return; }
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(x0 + Math.sign(c) * Math.abs(c) ** (2 / p) * (c > 0 ? f : b), y, Math.sign(s) * Math.abs(s) ** (2 / p) * w);
      uv.push(j / seg, i / (n - 1));
    }
  });
  const flip = rings[n - 1][0] < rings[0][0];
  const tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let i = 0; i < n - 1; i++) {
    const pa = !rings[i][1], pb = !rings[i + 1][1];
    const va = (j) => at[i] + (pa ? 0 : j % seg), vb = (j) => at[i + 1] + (pb ? 0 : j % seg);
    for (let j = 0; j < seg; j++) {
      if (!pa) tri(va(j), vb(j), va(j + 1));
      if (!pb) tri(va(j + 1), vb(j), vb(j + 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a flat strap swept along a curve: an elliptical section th thick (out from the body, away from centre) and wd wide,
// closing to a point at both ends
function sweep(curve, steps, wd, th, centre, seg = 8) {
  const pos = [], uv = [], idx = [], T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, P = curve.getPointAt(t), k = Math.min(1, t / 0.07, (1 - t) / 0.07) ** 0.5;
    curve.getTangentAt(t, T); N.subVectors(P, centre); N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a) * th * k, sn = Math.sin(a) * wd * k;
      pos.push(P.x + N.x * c + B.x * sn, P.y + N.y * c + B.y * sn, P.z + N.z * c + B.z * sn); uv.push(j / seg, t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a patch of skin over a lofted part (see loft): out beyond its surface, round the angles a0 → a1 (0 forward, π
// behind), from low(a) up to high. The hair is one, over the back and the sides of the head
function shell(rings, p, a0, a1, low, high, out, nA = 28, nY = 6) {
  const ring = (y) => {
    let i = 0; while (i < rings.length - 2 && rings[i + 1][0] < y) i++;
    const A = rings[i], B = rings[i + 1], t = THREE.MathUtils.clamp((y - A[0]) / (B[0] - A[0]), 0, 1);
    return [1, 2, 3, 4].map((k) => THREE.MathUtils.lerp(A[k] ?? 0, B[k] ?? 0, t));
  };
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nA; i++) for (let j = 0; j <= nY; j++) {
    const a = a0 + (a1 - a0) * (i / nA), y = THREE.MathUtils.lerp(low(a), high, j / nY), [w, f, b, x0] = ring(y), c = Math.cos(a), s = Math.sin(a);
    const ec = Math.sign(c) * Math.abs(c) ** (2 / p), es = Math.sign(s) * Math.abs(s) ** (2 / p);
    pos.push(x0 + ec * ((c > 0 ? f : b) + out), y, es * (w + out)); uv.push(i / nA, j / nY);
  }
  for (let i = 0; i < nA; i++) for (let j = 0; j < nY; j++) {
    const a = i * (nY + 1) + j, b = a + nY + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const ELBOW = 1.15; // the forearm bent forward, at rest
const UPPER_ARM = 0.27, FOREARM = 0.27; // the shoulder's joint to the elbow's, the elbow's to the middle of the fist
const WRIST = 0.215; // the elbow's joint to the wrist's
const SPINE = 0.24; // how high over her hips the back bends, the second of its two bends (the first: at the hips)
const SHOULDER_Y = 0.47;
// lo: the plain figure for far off (fewer sides to every part, and no ears, frames, knuckles or button)
function crewParts(lo) {
  const S = (n) => (lo ? Math.max(4, Math.round(n / 2)) : n), hi = (g) => (lo ? null : g);
  // the legs hang from the hip joint: the thigh broad at the top and lean at the knee, the shin with its calf behind,
  // and a sea boot to mid-calf (a low deck shoe under shorts) on a sole with a heel and a rounded toe
  const thigh = loft(R.thigh, S(12));
  const knee = new THREE.SphereGeometry(0.056, S(10), S(7)).scale(1.08, 1, 0.98);
  const shin = loft(R.shin, S(10));
  // the foot and its sole turn at the ankle (drawn from its joint); the boot's shaft goes with the shin
  const foot = loft(R.foot, S(10)).rotateZ(-Math.PI / 2).translate(0, -0.035, 0);
  const boot = loft([[-SHIN - 0.04, 0.046, 0.046, 0.05], [-SHIN + 0.04, 0.043, 0.044, 0.048], [-0.28, 0.05, 0.05, 0.06], [-0.268, 0.052, 0.052, 0.062]], S(10));
  const shoe = loft([[-SHIN - 0.04, 0.044, 0.044, 0.048], [-SHIN, 0.04, 0.042, 0.044], [-SHIN + 0.012, 0.039, 0.04, 0.042]], S(10));
  const sole = new THREE.BoxGeometry(0.3, 0.022, 0.1).translate(0.07, -0.064, 0);
  // the pelvis on the body (it stays as the body leans): the seat behind, the hips either side
  const pelvis = loft(R.pelvis, S(16));
  // the torso in its jacket: hem, waist, the chest deeper and broader, the shoulders sloping in to a high collar
  const torso = loft(R.torso, S(16), 2.3);
  // the lifejacket: an inflatable's two lobes down the chest, over the shoulders and round the back of the neck, and
  // its waist belt with the buckle in front
  const yoke = new THREE.CatmullRomCurve3(YOKE.map((v) => new THREE.Vector3(...v)));
  const vest = mergeGeometries([
    sweep(yoke, S(40), 0.033, 0.017, new THREE.Vector3(0, 0.34, 0), S(8)),
    loft([[0.118, 0.17, 0.116, 0.118], [0.146, 0.172, 0.118, 0.12]], S(18), 2.3),
    new THREE.BoxGeometry(0.03, 0.045, 0.06).translate(0.122, 0.132, 0),
  ]);
  // arms from the shoulder joint: the deltoid, the upper arm to the elbow; the forearm and the hand from the elbow's
  // joint, drawn straight down from it (the elbow's bone bends them)
  const upperArm = loft(R.upperArm, S(10));
  const elbowJ = new THREE.SphereGeometry(0.045, S(8), S(6)).translate(0, -UPPER_ARM, 0);
  const forearm = loft(R.forearm, S(10));
  // a gloved hand gripping: flat across (the palm faces in), the fingers curled into a fist, the thumb forward
  const hand = (mergeGeometries([
    loft([[-0.2, 0.026, 0.028, 0.028], [-0.24, 0.024, 0.042, 0.036], [-0.28, 0.024, 0.046, 0.032, 0.004], [-0.31, 0.02, 0.036, 0.026, 0.008], [-0.325, 0, 0, 0, 0.012]], S(10)),
    ...(lo ? [] : [
      new THREE.CapsuleGeometry(0.012, 0.03, 2, 6).rotateZ(0.9).translate(0.04, -0.255, 0),
      ...[-0.016, 0.002, 0.019, 0.034].map((x, i) => new THREE.SphereGeometry(0.0125, 6, 4).translate(x, -0.304 + Math.abs(i - 1.5) * 0.004, 0)), // the knuckles of the fingers curled round
    ]),
  ])).translate(0, WRIST, 0); // (it turns at the wrist)
  // the neck and the head: jaw and chin, cheekbones, brow, the back of the skull; a nose, ears
  const neck = loft(R.neck, S(10));
  const head = mergeGeometries([
    loft(R.head, S(14), 2.15),
    loft([[0.703, 0.008, 0.004, 0.006, 0.088], [0.688, 0.01, 0.009, 0.008, 0.088], [0.672, 0.013, 0.015, 0.008, 0.087], [0.661, 0.016, 0.017, 0.01, 0.087], [0.655, 0.012, 0.01, 0.01, 0.088], [0.652, 0, 0, 0, 0.088]], S(8)), // the nose
    ...(lo ? [] : [1, -1]).map((sz) => new THREE.SphereGeometry(1, 8, 6).scale(0.012, 0.022, 0.0065).rotateX(sz * 0.22).rotateZ(0.12).translate(-0.006, 0.682, sz * 0.077)), // the ears
  ]);
  // the hair hugs the skull: down to the nape behind, up and over the ears, a sideburn in front of each, and the
  // hairline at the temples; above it all goes under the cap
  const hair = shell(R.head, 2.15, 1.34, Math.PI * 2 - 1.34, hairLine, 0.762, 0.0035, S(32), S(6));
  // the ski mask's opening: a band of skin round the eyes, the rest of the head being knitted
  const opening = shell(R.head, 2.15, -0.72, 0.72, () => 0.689, 0.717, 0.0016, S(20), S(3));
  // the eyes of those who wear no sunglasses: the white, and the iris on it, each bringing its colour
  const painted = (g, c) => { const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const eyes = hi(mergeGeometries([1, -1].flatMap((sz) => [
    painted(new THREE.SphereGeometry(1, 10, 6).scale(0.0028, 0.0042, 0.0085).translate(0.0848, 0.703, sz * 0.032), '#d9d4c8'),
    painted(new THREE.SphereGeometry(1, 8, 6).scale(0.0014, 0.0035, 0.0035).translate(0.0871, 0.703, sz * 0.032), '#2b2f33'),
  ])));
  // sport sunglasses: two lenses wrapped round the face (a rounded-square outline, deeper at the outer edge), each on a
  // thin frame, a bridge over the nose and the arms back to the ears. The lenses bring their own colours: a mirror
  // that is darker at the top, where it shows the sky's deep blue, than at the bottom
  const onFace = (phi, y, out = 0) => new THREE.Vector3(Math.cos(phi) * (0.097 + out), y, Math.sin(phi) * (0.084 + out));
  const outline = (sz, k = 1) => Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), u = Math.sign(c) * Math.abs(c) ** 0.55, v = Math.sign(sn) * Math.abs(sn) ** 0.55;
    const phi = 0.47 + u * 0.36 * k, y = 0.698 + v * (0.0155 + 0.003 * u) * k - (v < 0 ? 0.003 * (1 - u * u) : 0); // the bottom edge dips under the eye
    return [sz * phi, y];
  });
  const lens = (top, bottom) => mergeGeometries([1, -1].map((sz) => {
    const ring = outline(sz).map(([phi, y]) => onFace(phi, y)), c = onFace(sz * 0.47, 0.698, 0.002), pos = [c.x, c.y, c.z], col = [], idx = [];
    for (const v of ring) pos.push(v.x, v.y, v.z);
    for (let i = 0; i < pos.length / 3; i++) { const t = THREE.MathUtils.clamp((pos[i * 3 + 1] - 0.68) / 0.036, 0, 1); col.push(...new THREE.Color(bottom).lerp(new THREE.Color(top), t).toArray()); }
    for (let i = 0; i < 20; i++) { const a = 1 + i, b = 1 + ((i + 1) % 20); sz > 0 ? idx.push(0, b, a) : idx.push(0, a, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }));
  const LENSES = [lens('#10151c', '#3b4654'), lens('#14284a', '#4f86b8'), lens('#3a1a0c', '#c0602a')]; // smoke, blue mirror, fire mirror
  const tube = (pts, r, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 24 : 12, r, 4, closed);
  const frame = hi(mergeGeometries([
    ...[1, -1].map((sz) => tube(outline(sz, 1.04).map(([phi, y]) => onFace(phi, y, 0.001)), 0.0024, true)),
    tube([onFace(0.11, 0.706, 0.001), onFace(0, 0.703, 0.003), onFace(-0.11, 0.706, 0.001)], 0.0028), // the bridge
    ...[1, -1].map((sz) => tube([onFace(sz * 0.83, 0.705, 0.002), onFace(sz * 1.05, 0.705, 0.003), onFace(sz * 1.35, 0.702, 0.0), onFace(sz * 1.62, 0.69, -0.008)], 0.0026)), // the arms
  ]));
  // a cap: the crown, its bill, and the button on top
  const brim = capBrim(S(20), lo ? 2 : 3);
  const cap = mergeGeometries([
    new THREE.SphereGeometry(1, S(16), S(7), 0, Math.PI * 2, 0, Math.PI / 2).scale(0.104, 0.082, 0.09).translate(-0.008, 0.724, 0),
    brim,
    ...(lo ? [] : [
      new THREE.CylinderGeometry(1, 1, 0.006, 16, 1, true).scale(0.105, 1, 0.091).translate(-0.008, 0.727, 0), // the sweatband's seam
      new THREE.SphereGeometry(0.011, 8, 4).scale(1, 0.5, 1).translate(-0.01, 0.806, 0), // the button
    ]),
  ]);
  const helmet = mergeGeometries([
    new THREE.SphereGeometry(1, S(16), S(9), 0, Math.PI * 2, 0, Math.PI * 0.6).scale(0.12, 0.12, 0.104).rotateZ(0.4).translate(-0.012, 0.708, 0),
    new THREE.CylinderGeometry(0.09, 0.09, 0.01, S(14), 1, false, 0, Math.PI).scale(0.7, 1, 0.95).rotateY(-Math.PI / 2).rotateZ(-0.2).translate(0.09, 0.742, 0),
  ]);
  // a ponytail out of the back of the cap
  const ponytail = loft([[0.722, 0, 0, 0, -0.102], [0.712, 0.021, 0.021, 0.021, -0.106], [0.62, 0.025, 0.025, 0.025, -0.112], [0.5, 0.012, 0.012, 0.012, -0.118], [0.44, 0, 0, 0, -0.12]], S(8), 2);
  return { thigh, knee, shin, foot, boot, shoe, sole, pelvis, torso, vest, upperArm, elbowJ, forearm, hand, neck, head, hair, opening, eyes, LENSES, frame, cap, helmet, ponytail };
}
const SAILOR = crewParts(false), SAILOR_LO = crewParts(true);
// A sailor is one draw (skin.js): the joints (body, the two bends of the back, head, hips, knees, ankles, shoulders, elbows,
// wrists) are bones. The parts' colours ride on the vertices, each from the material it was given, so all the sailors in the race share this one.
const CREW_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const SAILOR_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0.4, 0), 1.6); // round every pose, seated to standing
// no two sailors alike, even in team kit: the jacket a little more or less faded, a white cap or a dark one, the
// lifejacket's colour, the shade of the ski mask, gloves or bare hands, a broader or a slighter build, and where it is
// warm (within 42° of the equator) some of them in shorts and deck shoes; sunglasses on most, a ponytail on some
const HAIR = ['#2a1d15', '#5b3b24', '#1b1714', '#8d6a3f', '#7d7870', '#3d2a1c', '#b48a52'].map((c) => ({ color: new THREE.Color(c) }));
const GLOVE = { color: new THREE.Color('#2a2c31') }, BOOT = { color: new THREE.Color('#25272c') }, SOLE = { color: new THREE.Color('#dedbd3') };
let SAILORS = 0;
const WARM = Math.abs(VENUE.lat) < 42;
// Audio & graphics › People on board: every figure in every scene shown or not. A figure not shown is no draw and no
// shadow, and its bones leave the scene, so they cost nothing either.
let FIGURES = true;
export function showFigures(on, root) {
  FIGURES = !!on;
  root?.traverse((o) => o.userData.figure?.show());
}
const MASKS = ['#15171b', '#1e2229', '#272b31']; // everyone's face is under a knitted ski mask, in one of these
const IRIS = ['#4f7692', '#5c452f', '#47704f', '#3a2a1c', '#6f7f88'], BADGE = ['#d4252b', '#f2c230', '#2a9d8f', '#efeee9'];
export function sailor(m) {
  const n = SAILORS++, col = (mat) => mat.color;
  const jacket = { color: m.jacket.color.clone().offsetHSL(0, 0, (((n * 37) % 7) - 3) * 0.014) };
  const shorts = WARM && n % 3 === 1, shins = shorts ? m.skin : m.trousers;
  const vest = n % 2 ? { color: new THREE.Color('#2f3a48') } : m.vest;
  const cap = !m.helmet && n % 4 === 2 ? { color: new THREE.Color(m.cap.color.getHSL({}).l > 0.5 ? '#22262c' : '#efeee9') } : m.cap;
  const frameCol = [M.dark.color, new THREE.Color('#e9e8e4'), m.cap.color][(n * 7) % 3], hair = HAIR[(n * 3) % HAIR.length], hands = n % 5 === 3 ? m.skin : GLOVE, build = 1 + ((((n * 53) % 5) - 2) * 0.035);
  const bareEyes = n % 3 === 1, tail = n % 4 === 3 && !m.helmet, knit = new THREE.Color(MASKS[n % MASKS.length]);
  m = { ...m, jacket, vest, cap };
  const g = new THREE.Group(), body = new THREE.Bone(), waist = new THREE.Bone(), upper = new THREE.Bone(), head = new THREE.Bone();
  body.rotation.order = 'YXZ'; body.add(waist); waist.add(upper); // the back bends twice: at the hips (waist) and halfway up it (upper)
  head.position.y = neckY(); head.rotation.order = 'YXZ'; upper.add(head); // the head turns and nods on the neck
  const legs = [-1, 1].map((sz) => {
    const hip = new THREE.Bone(), knee = new THREE.Bone(), ankle = new THREE.Bone();
    hip.position.set(0, 0.07, sz * 0.095 * build); knee.position.y = -THIGH; ankle.position.y = -SHIN; knee.add(ankle); hip.add(knee); body.add(hip);
    return { hip, knee, ankle };
  });
  const arms = [-1, 1].map((sz) => {
    const a = new THREE.Bone(); a.position.set(0, SHOULDER_Y, sz * 0.2 * build); a.rotation.x = -sz * 0.12; upper.add(a);
    return a;
  });
  const elbows = arms.map((a) => { const e = new THREE.Bone(); e.position.y = -UPPER_ARM; e.rotation.z = ELBOW; a.add(e); return e; });
  const wrists = elbows.map((e) => { const w = new THREE.Bone(); w.position.y = -WRIST; e.add(w); return w; });
  const bones = [body, waist, upper, head, ...legs.flatMap((l) => [l.hip, l.knee, l.ankle]), ...arms, ...elbows, ...wrists];
  // the joints bend as one surface: near a joint a part follows the bone across it too, half at the joint itself and
  // all of it d beyond (t: how far past the joint, along the part). The back bends along its length as
  // she leans, and the top of the arm stays with the shoulder as the arm swings. The top of the thigh, inside the
  // pelvis, goes with the pelvis (blended below the joint it would dent the front of the hip); the knees stay rigid,
  // their round caps already filling the bend however far it goes
  const joint = (t, d) => 0.5 + 0.5 * Math.sign(t) * THREE.MathUtils.smoothstep(Math.abs(t), 0, d);
  const spine = () => (x, y) => { const low = joint(0.12 - y, 0.12), high = THREE.MathUtils.smoothstep(y, SPINE - 0.1, SPINE + 0.1); return [[body, low], [waist, Math.max(0, 1 - low - high)]]; };
  const thighBlend = () => (x, y) => [[body, y > 0 ? THREE.MathUtils.smoothstep(y, 0, 0.05) : 0]];
  const shoulder = () => (x, y) => [[upper, joint(y + 0.02, 0.14)]];
  const wide = (geo) => geo.clone().scale(1, 1, build); // a broader or a slighter build: wider across, not taller
  // the parts of a figure: [geometry, its bone, the material it would have had (or a colour), how it bends]
  const dress = (P) => [
    [wide(P.pelvis), body, m.trousers],
    ...legs.flatMap((l) => [[P.thigh, l.hip, m.trousers, thighBlend()], [P.knee, l.knee, m.trousers], [P.shin, l.knee, shins], [shorts ? P.shoe : P.boot, l.knee, BOOT], [P.foot, l.ankle, BOOT], [P.sole, l.ankle, SOLE]]),
    [wide(P.torso), upper, m.jacket, spine()], [wide(P.vest), upper, m.vest, spine()], [P.neck, upper, knit], [onHead(P.head), head, knit], [onHead(P.hair), head, knit], [onHead(P.opening), head, m.skin],
    [onHead(m.helmet ? P.helmet : P.cap), head, m.cap],
    ...(bareEyes ? [[onHead(P.eyes), head, null]] : [[onHead(P.LENSES[(n * 5) % 3]), head, null], [onHead(P.frame), head, frameCol]]),
    ...(tail ? [[onHead(P.ponytail), head, hair]] : []),
    ...arms.flatMap((a, j) => [[P.upperArm, a, m.jacket, shoulder()], [P.elbowJ, a, m.jacket], [P.forearm, elbows[j], m.jacket], [P.hand, wrists[j], hands]]),
  ].filter(([geo]) => geo).map(([geo, bone, mat, blend]) => [geo, bone, mat && (mat.isColor ? mat : col(mat)), blend]);
  // the figures ride the same bones; level() shows one: 3 the finest (built when she first comes close, the full one till
  // then), 2 the full figure, 1 the plain one, 0 none
  const rest = bones.map((b) => [b, b.position.clone(), b.quaternion.clone()]);
  const mesh = rigidSkin(dress(SAILOR), bones, body, CREW_MAT, SAILOR_SPHERE), lo = rigidSkin(dress(SAILOR_LO), bones, body, CREW_MAT, SAILOR_SPHERE);
  for (const x of [mesh, lo]) x.userData.detail = false; // the boat hides them far off itself (crewLevel), not with the fittings
  lo.visible = false;
  g.add(mesh, lo, body); // (the bones and what's held in the hands belong to neither figure)
  let lv = 2;
  const s = { g, body, waist, upper, head, legs, arms, elbows, wrists, mesh, lo, hi: null, fine: null,
    level: (l) => { lv = l; s.show(); },
    show() {
      const l = FIGURES ? lv : 0, fine = l === 3 && s.hi;
      mesh.visible = l === 2 || (l === 3 && !fine); lo.visible = l === 1;
      if (s.hi) s.hi.visible = !!fine;
      if (l === 3 && !s.hi) FINE.queue.add(s);
      if (l === 0) body.removeFromParent(); else if (!body.parent) g.add(body);
    },
    wanted: () => FIGURES && lv === 3,
    // her finest figure: its parts dressed in her colours, bound to her bones as they stand at rest
    build(F) {
      const C = { jacket: jacket.color, trousers: m.trousers.color, vest: vest.color, vestAlt: n % 2 ? '#c8342b' : '#f0b429', cap: cap.color, skin: m.skin.color, hair: hair.color, mask: knit,
        hands: hands.color, boot: BOOT.color, sole: SOLE.color, shorts, helmet: !!m.helmet, helmetGeo: SAILOR.helmet, tail, bareEyes, iris: IRIS[n % IRIS.length],
        lens: SAILOR.LENSES[(n * 5) % 3], frameGeo: SAILOR.frame, frame: frameCol, badge: BADGE[n % BADGE.length], bareHands: hands === m.skin, watch: n % 3 === 0 };
      const posed = bones.map((b) => [b, b.position.clone(), b.quaternion.clone()]), had = !!body.parent;
      for (const [b, p, q] of rest) { b.position.copy(p); b.quaternion.copy(q); }
      s.fine ??= fineFigure(F, { body, waist, upper, head, legs, arms, elbows, wrists, joint, spine, shoulder, wide, onHead, neckY: neckY(), UPPER_ARM }, C);
      for (const b of s.fine.bones) b.quaternion.identity();
      body.removeFromParent();
      const hi = s.hi = rigidSkin(s.fine.parts, [...bones, ...s.fine.bones], body, CREW_MAT, SAILOR_SPHERE);
      if (had) g.add(body); else body.removeFromParent();
      for (const [b, p, q] of posed) { b.position.copy(p); b.quaternion.copy(q); }
      hi.userData.detail = false; hi.layers.mask = mesh.layers.mask; hi.castShadow = mesh.castShadow; hi.receiveShadow = mesh.receiveShadow; hi.visible = false;
      g.add(hi);
    },
    unbuild() { const h = s.hi; s.hi = null; h.removeFromParent(); h.geometry.dispose(); h.skeleton.dispose(); s.show(); },
  };
  g.userData.figure = s;
  s.show();
  return s;
}
// The finest figures are built as they're wanted, one a frame, and no more than a dozen are kept
const FINE = { queue: new Set(), live: [], lib: null };
const fineLib = () => (FINE.lib ??= fineLibrary({ loft, sweep, shell, R, SHIN, THIGH, UPPER_ARM, hairLine, brim: capBrim, yokePts: YOKE }));
const afloat = (s) => { let o = s.g; while (o.parent) o = o.parent; return !!o.isScene; }; // (a boat of the last race is no longer in the scene)
// once a frame (world.js frame)
export function crewFrame() {
  for (const s of FINE.queue) {
    FINE.queue.delete(s);
    if (s.hi || !s.wanted() || !afloat(s)) continue;
    s.build(fineLib()); s.show();
    FINE.live.push(s);
    const old = FINE.live.length > 12 ? FINE.live.findIndex((x) => !x.hi?.visible || !afloat(x)) : -1;
    if (old >= 0) FINE.live.splice(old, 1)[0].unbuild();
    return;
  }
}
// the head's parts are drawn in the chest's frame: moved down by the neck's height, they sit on the head's own joint
let NECK_Y = null;
const HEADED = new Map();
function neckY() {
  if (NECK_Y === null) { const b = new THREE.Box3().setFromBufferAttribute(SAILOR.neck.attributes.position); NECK_Y = (b.min.y + b.max.y) / 2; }
  return NECK_Y;
}
function onHead(geo) {
  if (!geo) return geo;
  if (!HEADED.has(geo)) HEADED.set(geo, geo.clone().translate(0, -neckY(), 0));
  return HEADED.get(geo);
}
// where a sailor looks: want, the way (0 outboard, π/2 forward, π inboard, as her yaw) and up (+ above the horizon);
// her head turns there from her body, as far as a neck turns, and eases round
export function lookAt(c, want, up, k) {
  const hy = clamp(want - (c.yawShown ?? c.yaw), -1.35, 1.35);
  c.hy = (c.hy ?? 0) + (hy - (c.hy ?? 0)) * k; c.hp = (c.hp ?? 0) + (up - (c.hp ?? 0)) * k;
  c.s.head.rotation.set(c.hr ?? 0, c.hy, c.hp + (c.hn ?? 0));
}
// a sailor's glances: mostly where her job has her look, now and then up at the sails or round to windward for the
// next gust — each on her own clock (i)
export const glance = (t, i, every = 0.37) => Math.sin(t * every + i * 1.9) > 0.78 ? 1 : Math.sin(t * every * 0.71 + i * 4.3 + 1) > 0.85 ? 2 : 0;

// ---------- the crew in motion ----------
// What the boat does to them: her acceleration where they sit (a metre over her deck), in her own frame (x to
// starboard, y up, z aft), smoothed a little. A slam into a wave, the way she loses in a tack, a turn at speed or a
// collision throws their bodies about (drive). Called once a frame, after the hull is placed.
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _ma = new THREE.Matrix4(), _mb = new THREE.Matrix4();
const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const A1 = new THREE.Vector3(), A2 = new THREE.Vector3(), A3 = new THREE.Vector3(), B1 = new THREE.Vector3(), B2 = new THREE.Vector3(), B3 = new THREE.Vector3();
export function feel(v, dt) {
  v.root.updateMatrix(); v.tilt.updateMatrix();
  const p = _p.set(0, 1, 0).applyMatrix4(_m.multiplyMatrices(v.root.matrix, v.tilt.matrix));
  v.acc ??= new THREE.Vector3(); v.fa ??= new THREE.Vector3();
  if (!(dt > 0)) return;
  if (!v.fp || p.distanceTo(v.fp) > 10) { v.fp = p.clone(); v.fv = null; v.fa.set(0, 0, 0); v.acc.set(0, 0, 0); return; } // a new race, or put back
  const vel = _v.subVectors(p, v.fp).divideScalar(dt); v.fp.copy(p);
  if (!v.fv) { v.fv = vel.clone(); return; }
  const acc = _d.subVectors(vel, v.fv).divideScalar(dt).clampLength(0, 15); v.fv.copy(vel);
  v.fa.lerp(acc, 1 - Math.exp(-dt * 12));
  _q.multiplyQuaternions(v.root.quaternion, v.tilt.quaternion).invert();
  v.acc.copy(v.fa).applyQuaternion(_q).clampLength(0, 7);
}

// an arm reaching for a point (in her chest's frame, the upper body's bone): the elbow bends so that shoulder to fist
// spans the distance, and the shoulder turns the arm at it, the elbow out towards the pole (down, out to her side and
// a little back, as an elbow goes). q: the shoulder's turn; returns the elbow's bend
const POLE = new THREE.Vector3(-0.35, -0.8, 0.5);
function reach(S, T, sz, q) {
  _d.subVectors(T, S);
  const d = clamp(_d.length(), 0.08, UPPER_ARM + FOREARM - 0.003);
  const bend = clamp(Math.acos(clamp((d * d - UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2 * UPPER_ARM * FOREARM), -1, 1)), 0.05, 2.55);
  A1.set(FOREARM * Math.sin(bend), -UPPER_ARM - FOREARM * Math.cos(bend), 0).normalize(); // the fist from the shoulder, in the arm's own frame
  A2.set(0, -UPPER_ARM, 0); A2.addScaledVector(A1, -A2.dot(A1)).normalize(); // and the elbow, square to it
  A3.crossVectors(A1, A2);
  B1.copy(_d).normalize();
  B2.set(POLE.x, POLE.y, POLE.z * sz); B2.addScaledVector(B1, -B2.dot(B1));
  if (B2.lengthSq() < 1e-6) B2.set(0, 0, sz).addScaledVector(B1, -B1.z * sz);
  B2.normalize(); B3.crossVectors(B1, B2);
  _mb.makeBasis(B1, B2, B3).multiply(_ma.makeBasis(A1, A2, A3).transpose());
  q.setFromRotationMatrix(_mb);
  return bend;
}

// A sailor posed: c carries where the boat wants her, eased (x, y, z, yaw, lean, stand, knee, reach: see the JPK's
// update); drive turns that into her bones, and adds what she does on the way and with her hands:
// - crossing the middle of the boat (where the figure is mirrored, so +x is always outboard) she keeps facing the way
//   she was, rather than flipping round;
// - moving over the deck she steps: she turns towards where she's going, her legs swing and her knees lift by turns,
//   the heel coming up behind her, her hips turn with the stride and her shoulders against it, her arms swing against
//   her legs and she bobs a little with each step, the quicker she goes the more;
// - at rest she is never quite still: she breathes (faster after work), shifts her weight from foot to foot, and her back
//   curves along its length rather than hinging at the hips. Her feet stay flat on the deck whatever her legs do, and
//   her head keeps nearer the horizon than the boat does;
// - her body gives to the boat's motion (feel): it sways forward as the boat slows, back as she drives off a wave, to
//   the side in a hard turn, and sags at a slam; on a spring, so it overshoots once and settles;
// - hands: up to two points in the boat's frame (or a function of her, given her chest's frame, that returns them),
//   which her nearest free hand reaches for — a tiller extension, a wheel's rim, a winch handle, the mast. A hand
//   comes to its hold and lets go over a few tenths of a second. c.hand, when asked for (c.trackHands), is where
//   her fists are, in the boat's frame.
const STEP = 0.34; // a step, crouched on a moving deck
const _e = new THREE.Vector3();
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function drive(v, c, dt, hands) {
  const s = c.s, sd = c.x >= 0 ? 1 : -1;
  if (c.sd !== undefined && sd !== c.sd) { c.yaw = Math.PI - c.yaw; c.hy = -(c.hy ?? 0); c.is = -(c.is ?? 0); c.vs = -(c.vs ?? 0); }
  c.sd = sd;
  // walking
  const moved = c.px === undefined ? 0 : Math.hypot(c.x - c.px, c.z - c.pz), mx = c.x - (c.px ?? c.x), mz = c.z - (c.pz ?? c.z);
  c.px = c.x; c.pz = c.z;
  const spd = dt > 0 && moved < 1.5 ? moved / dt : 0;
  c.spd = (c.spd ?? 0) + (Math.min(spd, 3) - (c.spd ?? 0)) * (1 - Math.exp(-dt * 8));
  const w = smoothstep(0.2, 0.7, c.spd);
  c.gp = (c.gp ?? (c.i ?? 0) * 1.7) + (moved < 1.5 ? moved / STEP : 0) * Math.PI;
  if (w > 0.01 && moved > 1e-4) c.wy = Math.atan2(-mz, mx * sd); // the way she's going, as a yaw
  const yaw = c.yaw + (c.wy === undefined ? 0 : wrapPi(c.wy - c.yaw) * w * 0.8);
  c.yawShown = yaw;
  // the boat's motion on her body: the push she feels (against the acceleration) along and across her facing
  const a = v.acc, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const fx = a ? -a.x * sd : 0, fz = a ? -a.z : 0;
  const tf = clamp(0.055 * (fx * cy - fz * sy), -0.4, 0.4), ts = clamp(0.05 * (fx * sy + fz * cy), -0.3, 0.3), tu = clamp(0.035 * (a ? a.y : 0), -0.18, 0.18);
  const om = 7 + ((c.i ?? 0) % 3), ze = 0.42;
  for (let n = 0, h = dt / 2; n < 2 && dt > 0; n++) {
    c.vf = (c.vf ?? 0) + (om * om * (tf - (c.if ?? 0)) - 2 * ze * om * (c.vf ?? 0)) * h; c.if = (c.if ?? 0) + c.vf * h;
    c.vs = (c.vs ?? 0) + (om * om * (ts - (c.is ?? 0)) - 2 * ze * om * (c.vs ?? 0)) * h; c.is = (c.is ?? 0) + c.vs * h;
    c.vu = (c.vu ?? 0) + (om * om * (tu - (c.iu ?? 0)) - 2 * ze * om * (c.vu ?? 0)) * h; c.iu = (c.iu ?? 0) + c.vu * h;
  }
  const sag = clamp(c.iu ?? 0, -0.2, 0.2);
  // the bones
  const st0 = c.stand + (Math.max(c.stand, 0.45) - c.stand) * w, st = st0 - (st0 > 0.4 ? sag * 0.8 : 0), bob = -0.025 * w * Math.cos(2 * c.gp);
  // her breath, quicker for a while after she's been moving or working a line; her weight, slowly from foot to foot
  const clock = c.bt = (c.bt ?? (c.i ?? 0) * 2.3) + dt, busy = Math.max(w, Math.min(1, (c.hw?.[0] ?? 0) * Math.abs(c.vf ?? 0) * 0.6));
  c.ex = (c.ex ?? 0) + (busy - (c.ex ?? 0)) * (1 - Math.exp(-dt * (busy > (c.ex ?? 0) ? 1.2 : 0.14)));
  c.bp = (c.bp ?? 0) + dt * (1.5 + 1.9 * c.ex);
  const br = Math.sin(c.bp) * (0.7 + 0.5 * c.ex), still = 1 - w, sh = still * (Math.sin(clock * 0.37 + (c.i ?? 0) * 1.9) + 0.45 * Math.sin(clock * 0.83 + (c.i ?? 0) * 3.1)) / 1.45;
  const L = c.lean + clamp(c.if ?? 0, -0.45, 0.45) + sag * 0.6 + 0.012 * br, S = clamp(c.is ?? 0, -0.35, 0.35) + 0.022 * sh, turn = 0.13 * w * Math.sin(c.gp);
  c.g.position.set(c.x, c.y, c.z); c.g.scale.x = sd; c.g.rotation.z = -(v.sway || 0);
  s.body.rotation.y = yaw + turn; s.body.rotation.x = 0.055 * w * Math.cos(c.gp) + 0.016 * sh * st; s.body.position.y = st * (THIGH + SHIN + 0.02) + bob;
  s.waist.rotation.set(S * 0.45, -turn * 0.9, -L * 0.5);
  s.upper.rotation.set(S * 0.55, -turn * 0.9 + 0.05 * still * Math.sin(clock * 0.29 + (c.i ?? 0) * 1.3), -L * 0.5);
  _e.set(0, SPINE, 0); s.upper.position.set(0, SPINE, 0).sub(_e.applyEuler(s.upper.rotation)); // it bends halfway up her back, not at the bone's origin
  s.legs.forEach((l, j) => {
    const ph = c.gp + j * Math.PI, rest = (j * 2 - 1) * sh * st; // the leg she's resting on is straighter
    const hip = (1 - st) * Math.PI / 2 + 0.52 * w * Math.sin(ph) + 0.03 * rest, knee = (1 - st) * c.knee - w * (0.95 * Math.max(0, Math.cos(ph)) + 0.12) - 0.075 * st * Math.max(0, -rest);
    l.hip.rotation.z = hip; l.knee.rotation.z = knee;
    l.ankle.rotation.z = clamp(-(hip + knee), -0.75, 0.75) * (1 - 0.45 * w) + w * 0.42 * smoothstep(0.1, 0.9, Math.max(0, -Math.sin(ph) * Math.cos(ph) * 2)); // flat on the deck; the heel lifting as she steps off
  });
  const elbowAt = (j) => ELBOW * (1 - 0.32 * w) + 0.42 * w * Math.max(0, -Math.sin(c.gp + j * Math.PI));
  s.arms.forEach((arm, j) => { arm.position.y = SHOULDER_Y + 0.005 * br; arm.rotation.set(-(j * 2 - 1) * (0.12 + 0.015 * br), 0, c.reach - 0.42 * w * Math.sin(c.gp + j * Math.PI)); s.elbows[j].rotation.z = elbowAt(j); });
  // the hands
  const shown = s.mesh.visible || s.lo.visible || !!s.hi?.visible;
  c.g.updateMatrix(); s.body.updateMatrix(); s.waist.updateMatrix(); s.upper.updateMatrix();
  const M = (c.M ??= new THREE.Matrix4()).copy(c.g.matrix);
  if (s.g !== c.g) { s.g.updateMatrix(); M.multiply(s.g.matrix); } // a child, her figure scaled down in a group of its own
  M.multiply(s.body.matrix).multiply(s.waist.matrix).multiply(s.upper.matrix);
  // her head held nearer level than her back and the boat: which way is up, seen from her neck as her head is turned
  if (shown) {
    _v.set(0, 1, 0).applyQuaternion(_q.multiplyQuaternions(v.root.quaternion, v.tilt.quaternion).invert()).transformDirection(_mi.copy(M).invert());
    const hy = c.hy ?? 0, cy = Math.cos(hy), sy = Math.sin(hy), hk = c.first ? 1 : 1 - Math.exp(-dt * 5);
    c.hr = (c.hr ?? 0) + (clamp(0.6 * (sy * _v.x + cy * _v.z), -0.5, 0.5) - (c.hr ?? 0)) * hk;
    c.hn = (c.hn ?? 0) + (clamp(-0.6 * (cy * _v.x - sy * _v.z), -0.5, 0.5) - 0.01 * br - (c.hn ?? 0)) * hk;
  }
  const T = typeof hands === 'function' ? hands(c, M) : hands;
  c.hw ??= [0, 0]; c.ht ??= [new THREE.Vector3(), new THREE.Vector3()];
  const got = [false, false];
  if (T) {
    _mi.copy(M).invert();
    const pts = T.filter(Boolean).slice(0, 2).map((p) => p.clone().applyMatrix4(_mi));
    if (pts.length === 2) { const lo = pts[0].z <= pts[1].z ? 0 : 1; c.ht[0].copy(pts[lo]); c.ht[1].copy(pts[1 - lo]); got[0] = got[1] = true; }
    else if (pts.length === 1) { // the hand it asks for (arm: 0 or 1), or the nearer, the one already on it unless the other is clearly nearer
      const p0 = T.find(Boolean), d = [0, 1].map((j) => pts[0].distanceTo(s.arms[j].position) - 0.12 * c.hw[j]);
      const j = p0.arm ?? (d[0] <= d[1] ? 0 : 1); c.ht[j].copy(pts[0]); got[j] = true;
    }
  }
  const kh = c.first ? 1 : 1 - Math.exp(-dt * 7);
  s.arms.forEach((arm, j) => {
    c.hw[j] += ((got[j] ? 1 : 0) - c.hw[j]) * kh;
    s.wrists[j].rotation.z = -0.2 * (1 - c.hw[j]) * (1 - w * 0.5); // a free hand hangs a little from the wrist
    if (c.hw[j] < 0.002 || (!shown && !c.trackHands)) return; // (a dinghy's mainsheet ends in her hand, seen or not)
    _qa.copy(arm.quaternion);
    const bend = reach(arm.position, c.ht[j], j * 2 - 1, _q);
    arm.quaternion.slerpQuaternions(_qa, _q, c.hw[j]);
    s.elbows[j].rotation.z = lerp(elbowAt(j), bend, c.hw[j]);
  });
  if (s.hi?.visible) fineMotion(s.fine, c, dt, c.hw, L * 0.45 - (c.hp ?? 0) - (c.hn ?? 0) * 0.2);
  if (c.trackHands) {
    c.hand ??= [new THREE.Vector3(), new THREE.Vector3()];
    s.arms.forEach((arm, j) => { arm.updateMatrix(); s.elbows[j].updateMatrix(); c.hand[j].set(0, -FOREARM, 0).applyMatrix4(s.elbows[j].matrix).applyMatrix4(arm.matrix).applyMatrix4(M); });
  }
}
// in the boat's frame, a point given in a sailor's chest frame (M from drive): where her shoulder is, or a hand at rest
export const chestPoint = (M, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M);
// a tiller's extension, hinged at the tiller's end (pivot: a group whose +y runs along it, len long), swung to where
// the helm's hand is (at rest, in front of her at her middle, on the aft arm's side) and held there: the grip is as far along it
// as her hand, short of its end
const _ax = new THREE.Vector3(0, 1, 0);
export function holdExtension(pivot, len, c, M) {
  const aft = chestPoint(M, 0, 0.47, -0.2).z > chestPoint(M, 0, 0.47, 0.2).z ? -1 : 1; // which of her shoulders is aft
  const want = chestPoint(M, 0.34, 0.3, aft * 0.24);
  // the pivot's frame in the boat's: up through its parents to the one the crew stand in
  _mb.identity(); for (let o = pivot.parent; o && o !== c.g.parent; o = o.parent) { o.updateMatrix(); _mb.premultiply(o.matrix); }
  const base = _p.copy(pivot.position).applyMatrix4(_mb);
  const dir = _v.subVectors(want, base), dist = dir.length();
  _ma.copy(_mb).invert(); // the direction into the pivot's parent's frame (rotation only)
  const local = dir.clone().transformDirection(_ma);
  pivot.quaternion.setFromUnitVectors(_ax, local);
  const grip = base.clone().addScaledVector(dir.normalize(), Math.min(len - 0.06, Math.max(0.2, dist)));
  grip.arm = aft < 0 ? 0 : 1; // in her aft hand (arm 0 is on her −z side)
  return grip;
}

// someone on watch, who isn't sailing the boat (a committee boat's officers): breathing, the weight going from foot to
// foot, the back and the head turning slowly as they look along the line. i: her own clock. Arms stay as they were posed
export function onWatch(s, t, i, steady) {
  const br = Math.sin(t * 1.5 + i * 2.1), a = Math.sin(t * 0.31 + i * 1.7), b = Math.sin(t * 0.17 + i * 3.1);
  s.waist.rotation.set(0.018 * a, 0.2 * b, -0.008 * br);
  s.upper.rotation.set(0.012 * a, 0.05 * b, -0.01 * br);
  for (const [j, l] of s.legs.entries()) { const r = (j * 2 - 1) * a; l.knee.rotation.z = -0.06 * Math.max(0, -r); l.hip.rotation.z = 0.03 * Math.max(0, -r); l.ankle.rotation.z = -l.hip.rotation.z - l.knee.rotation.z; }
  s.head.rotation.set(0, steady ? 0 : 0.55 * Math.sin(t * 0.23 + i * 1.1), steady ? 0 : 0.07 * Math.sin(t * 0.41 + i));
}

// which figure a boat's crew show: none far off (with the small fittings), the plain ones beyond near, the full ones
// close, the finest right by the camera (not the J Class's thirty, nor a ghost's, which is see-through)
function crewLevel(v) {
  const l = v.detailOn === false ? 0 : v.crewNear === false ? 1 : v.crewClose && v.crew?.length <= 8 ? 3 : 2;
  for (const c of v.crew || []) c.s.level(l);
}

// ---------- the boat ----------
// The mast is raked 4° aft, as JPK's profile draws it: the rig's heights (MASTHEAD, HOUNDS, SPREADER, BOOM_Y) are
// measured up its axis, and raked() turns a point drawn on an upright mast about the foot onto the raked one, the
// masthead coming a metre aft of the foot
const RAKE = 4 * D2R, RAKE_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), RAKE);
const MAST_FOOT = roofTop(MAST_Z);
const raked = (x, y, z) => {
  const dy = y - MAST_FOOT, dz = z - MAST_Z, c = Math.cos(RAKE), s = Math.sin(RAKE);
  return [x, MAST_FOOT + dy * c - dz * s, MAST_Z + dy * s + dz * c];
};
const onMast = (o) => { o.position.set(...raked(o.position.x, o.position.y, o.position.z)); o.quaternion.premultiply(RAKE_Q); return o; };
// a 9/10 fractional rig, the masthead 16.2 m above the water and the hounds 15 m up the mast
const MASTHEAD = MAST_FOOT + (16.2 - MAST_FOOT) / Math.cos(RAKE), BOOM_Y = 2.4, HOUNDS = 15.0;
const SPREADER = 7.6, SPR_L = 1.6; // her one set of spreaders: 6.5 m above the deck, 1.6 m out each side (the sail plan)
const BOOM_L = 4.85, SHEET_Z = 4.35; // the boom, and the traveller across the aft cockpit its mainsheet comes down to
const SHEET_B = BOOM_L - 0.2; // the mainsheet's block, this far along the boom: over the traveller, the boom drooping with the rake
// the square-top main: its chord at fraction f of the luff (narrowing to a wide head, with roach), the luff's length
// (the cloth runs from BOOM_Y + 0.08 to MASTHEAD − 0.3), and the width of the flag on it, in metres
const mainChord = (f) => lerp(4.75, 1.4, f) + 0.45 * Math.sin(Math.PI * f);
const MAIN_SPAN = MASTHEAD - 0.3 - BOOM_Y, SAIL_MARK = 1.5;
// the forestay comes down to the deck 0.6 m aft of the stem, at the inboard end of the bowsprit's plate (the deck plan)
const TACK_Z = BOW_Z + 0.6, TACK = new THREE.Vector3(0, deckY(TACK_Z) + 0.05 + 0.06, TACK_Z);
const HEAD = new THREE.Vector3(...raked(0, HOUNDS - 0.3, MAST_Z - 0.12));
// the jib's clew from the tack (the foot), in metres
// (a 106% genoa of 31 m²: its clew 0.6 m aft of the mast)
const JIB_CLEW = new THREE.Vector3(0, 0.42, 4.75);
const SPRIT = new THREE.Vector3(0, sheerAt(1) + 0.12, BOW_Z - 1.1); // the fixed bowsprit's end, 1.1 m out (the deck plan)
const KITE_HEAD = raked(0, MASTHEAD - 0.4, MAST_Z - 0.15); // the gennaker's halyard, just under the masthead
const GTRACK = [[1.0, 0.75], [1.45, 0.5]]; // the transverse genoa tracks on the side decks, inboard end to outboard, just aft of the clew
const GCAR = 0.55; // where the car sits along its track
const gcar = (sx) => { const [[x0, z0], [x1, z1]] = GTRACK; return [sx * lerp(x0, x1, GCAR), lerp(z0, z1, GCAR)]; };
const PRIMARY = [1.22, 2.82]; // the jib sheets' winches (ST46), on the side decks abreast the front of the cockpit
const HANDLE_R = 0.25; // a winch handle's reach, the socket to the grip
const BACKSTAY_W = [1.4, 3.74]; // the backstays' winches (ST40), aft of the primaries at the helm's hand
// this boat's sails, as sailTexture lays out the marks on them (numAt, numK: the number's height up the main and its size)
const RIG = () => ({ span: MAIN_SPAN, chord: mainChord, flagM: 11.56, mark: SAIL_MARK, numAt: 0.64, numK: 1, hd: HEAD.clone().sub(TACK), clew: JIB_CLEW });
// The twin backstays of a square-top main: its wide head has to get past them, so only the windward one is set up, straight
// from the crane to its quarter. The lee one is let go: it hangs in a bow, and where the main comes up against it the cloth
// carries it out, the wire lying taut over the sail's lee side from the crane down and passing under the boom to its quarter.
// Worked out in the main's own frame, where the sail's height is its height up the luff. Points closer together at the ends,
// where the wire clears the head and the boom.
const STAY_N = 24, STAY_CLEAR = 0.06, STAY_SLACK = 0.28;
const STAY_S = Float32Array.from({ length: STAY_N + 1 }, (_, k) => 0.5 - 0.5 * Math.cos(Math.PI * k / STAY_N));
const STAY_OFF = new Float32Array(STAY_N + 1), STAY_HULL = new Uint8Array(STAY_N + 1);
function setBackstays(v, cl, t, reefDrop) {
  const ma = v.mainPivot.rotation.y, ca = Math.cos(ma), sa = Math.sin(ma), cr = Math.cos(RAKE), sr = Math.sin(RAKE), ss = v.sailSide;
  const y0 = BOOM_Y + 0.08, span = MASTHEAD - 0.3 - BOOM_Y - reefDrop;
  for (const l of v.backstays) {
    const { sx, top, end } = l.userData, p = l.geometry.attributes.position;
    // the wire's two ends in the main's frame: off the mast's rake, then round with the boom
    const tu = -(top[1] - MAST_FOOT) * sr + (top[2] - MAST_Z) * cr, eu = -(end[1] - MAST_FOOT) * sr + (end[2] - MAST_Z) * cr;
    const ax = top[0] * ca - tu * sa, ay = MAST_FOOT + (top[1] - MAST_FOOT) * cr + (top[2] - MAST_Z) * sr, az = top[0] * sa + tu * ca;
    const bx = end[0] * ca - eu * sa, by = MAST_FOOT + (end[1] - MAST_FOOT) * cr + (end[2] - MAST_Z) * sr, bz = end[0] * sa + eu * ca;
    // how far the cloth pushes each point of the straight wire out on the wire's own side
    for (let k = 0; k <= STAY_N; k++) {
      const s = STAY_S[k], x = lerp(ax, bx, s), y = lerp(ay, by, s), z = lerp(az, bz, s), f = (y - y0) / span;
      let push = 0;
      if (k > 0 && k < STAY_N && y >= BOOM_Y - 0.3) { // (above the head too, reefed or not: it passes the head on its own side)
        const ff = clamp(f, 0, 1), ch = mainChord(ff);
        if (z > -0.1 && z < ch * 1.02) push = Math.max(0, sx * mainShape(cl, ff, clamp(z / ch, 0, 1), ch, ss, 0.11, 0.5).x + STAY_CLEAR - sx * x);
      }
      STAY_OFF[k] = push;
    }
    // a taut wire: straight between the points where the cloth bears on it (the pushes' upper hull)
    let n = 0;
    for (let k = 0; k <= STAY_N; k++) {
      while (n >= 2) {
        const i = STAY_HULL[n - 2], j = STAY_HULL[n - 1];
        if ((STAY_S[j] - STAY_S[i]) * (STAY_OFF[k] - STAY_OFF[i]) - (STAY_OFF[j] - STAY_OFF[i]) * (STAY_S[k] - STAY_S[i]) < 0) break;
        n--;
      }
      STAY_HULL[n++] = k;
    }
    const lee = clamp(-sx * ss, 0, 1), blow = clamp(cl.aws / 12, 0.3, 1);
    for (let h = 0; h < n - 1; h++) {
      const i = STAY_HULL[h], j = STAY_HULL[h + 1];
      for (let k = i; k <= j; k++) {
        const s = STAY_S[k], off = lerp(STAY_OFF[i], STAY_OFF[j], (s - STAY_S[i]) / (STAY_S[j] - STAY_S[i])), bow = 4 * s * (1 - s);
        // let go, it bows out and shakes in the breeze, except where it lies on the sail
        const slack = lee * bow * (STAY_SLACK + 0.05 * blow * Math.sin(t * 5.5 + s * 8 + sx)) * (1 - smoothstep(0, 0.15, off));
        const xs = lerp(ax, bx, s) + sx * (off + slack), ys = lerp(ay, by, s) - MAST_FOOT, zs = lerp(az, bz, s), uz = -xs * sa + zs * ca;
        p.setXYZ(k, xs * ca + zs * sa, MAST_FOOT + ys * cr - uz * sr, MAST_Z + ys * sr + uz * cr);
      }
    }
    p.needsUpdate = true;
  }
}

export class BoatView {
  constructor({ look = LOOKS.player, label = null, player = false }) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    const T = this.tilt, add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); T.add(o); return o; };

    // hull, deck, cockpit, coachroof: the Blender model, or built here from the lines
    const cr = { position: new THREE.Vector3(0, deckY(-0.3) - 0.02, 0) }; // the fallback coachroof's base
    if (MODEL) {
      const mats = { hull: hullMaterial(look.hull, look.stripe, look.bottom), deck: deckFinish(look, M.deck, true), gel: M.gel, teak: M.teak, glass: M.glass };
      for (const [k, g] of Object.entries(MODEL)) if (mats[k]) add(new THREE.Mesh(g, mats[k]));
    } else {
      add(new THREE.Mesh(hullGeometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
      add(new THREE.Mesh(deckGeometry(), deckFinish(look, M.deck, true)));
      add(new THREE.Mesh(new THREE.BoxGeometry(2.0, deckY(3.5) - FLOOR, 3.1), M.well), 0, (deckY(3.5) + FLOOR) / 2, 3.5);
      add(new THREE.Mesh(coachroofGeometry(), M.gel), 0, cr.position.y, 0);
    }
    // the companionway in the coachroof's aft face: the washboards in their alloy frame down to the cockpit floor, and
    // the sliding hatch over it on its rails, on top of the hatch garage moulded into the roof (GARAGE, the Blender
    // model's); a hatch on the roof forward of the mast and the forehatch where the roof ramps down (the deck plan)
    const top = roofTop(MAST_Z); // the coachroof's top at the mast
    const slope = (z) => Math.atan2(roofTop(z - 0.25) - roofTop(z + 0.25), 0.5); // the roof's rise forward there
    const gy = (z) => roofTop(z) + GARAGE.h; // the garage's top
    // three washboards stacked in the frame, dark seams between them
    for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.276, 0.04), M.board), 0, FLOOR + 0.07 + 0.144 + i * 0.286, CR_ZA + 0.01);
    for (const i of [1, 2]) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.034), M.dark), 0, FLOOR + 0.07 + i * 0.286, CR_ZA + 0.008);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.96, 0.03), M.alu), 0, FLOOR + 0.5, CR_ZA + 0.002);
    // the top board's pull, a steel bar on a dark backing plate
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.008), M.dark), 0, FLOOR + 0.79, CR_ZA + 0.033);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.018), M.steel), 0, FLOOR + 0.79, CR_ZA + 0.044);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.7), M.board), 0, gy(1.62) + 0.035, 1.62);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.84), M.alu), sx * 0.3, gy(1.58) + 0.025, 1.58);
    for (const [z, w] of [[-1.15, 0.5], [-2.25, 0.6]]) {
      const h = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, w), M.glass), 0, roofTop(z) + 0.02, z); h.rotation.x = slope(z);
      const f = add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.045, w + 0.1), M.alu), 0, roofTop(z) + 0.015, z); f.rotation.x = slope(z);
    }
    // the black grab rails along the coachroof's top
    for (const sx of [-1, 1]) {
      const rx = (z) => sx * (roofHalf(z) - 0.26), pts = [1.75, 1.6, 0.2, -1.2, -1.55].map((z, i, a) => [rx(z), roofTop(z) - 0.02 + (i && i < a.length - 1 ? 0.07 : 0), z]);
      T.add(tube(pts, 0.018, M.dark));
    }
    // winches, six as JPK fits them: the ST46 primaries on the side decks abreast the front of the cockpit, for the jib
    // sheets; the ST40 backstay winches aft of them at the helm's hand; the ST40 halyard winches on the coachroof's
    // aft end, the clutches ahead of them either side of the hatch garage
    for (const sx of [-1, 1]) {
      fit(add, winch(0.09, 0.2), sx * PRIMARY[0], deckY(PRIMARY[1]) + 0.04, PRIMARY[1]);
      fit(add, winch(0.075, 0.17), sx * BACKSTAY_W[0], deckY(BACKSTAY_W[1]) + 0.04, BACKSTAY_W[1]);
      fit(add, winch(0.075, 0.17), sx * 0.62, roofTop(1.78) - 0.03, 1.78);
      fit(add, clutches(3), sx * 0.56, roofTop(1.45) - 0.02, 1.45);
    }
    // the traveller across the aft cockpit, its track on the floor with its end stops and the mainsheet's car on it,
    // a block on the car
    const TW = cockpitHalf(SHEET_Z) - 0.06;
    add(new THREE.Mesh(new THREE.BoxGeometry(TW * 2, 0.04, 0.07), M.alu), 0, FLOOR + 0.02, SHEET_Z);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.09), M.dark), sx * TW, FLOOR + 0.04, SHEET_Z);
    const car = new THREE.Group(); car.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.12), M.dark));
    for (const [g, mm] of block(0.04)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.085; car.add(o); }
    this.travCar = add(mergeGroup(car), 0, FLOOR + 0.07, SHEET_Z);
    this.travW = TW - 0.1;
    // the twin rudders, hung on the transom in their carbon lifting cassettes and toed out 15° at the tips: high-aspect
    // blades 1.2 m deep, the windward one kicked up aft when she heels (update()). A carbon bar joins their heads across
    // the stern, and the tiller pivots on its middle: forward over the cockpit, rising a little, its extension hinged at
    // the end and swung up and out to the helm on the windward side deck (update()); the tiller turns with the rudder
    const TZ = STERN_Z + 0.14, BAR_Y = 1.14, TL = 1.6, RX = 1.0; // the rudders' heads, the bar's height, the tiller's length
    this.rudders = [-1, 1].map((sx) => {
      const g = add(new THREE.Group(), sx * RX, 0.9, TZ); g.rotation.z = sx * 0.26;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.3), M.carbon).translateY(0.02));
      const kick = new THREE.Group(); g.add(kick);
      const blade = new THREE.Mesh(foilGeo(2.15, 0.34, 0.24, 0.11), M.dark); kick.add(blade);
      add(cyl(0.035, 0.035, 0.1, M.dark, 10), sx * RX, BAR_Y, TZ);
      return { sx, kick, lift: 0 };
    });
    add(cyl(0.025, 0.025, 2 * RX, M.carbon, 8), 0, BAR_Y + 0.05, TZ).rotation.z = Math.PI / 2;
    this.wheel = add(new THREE.Group(), 0, BAR_Y + 0.08, TZ - 0.05);
    const tl = cyl(0.026, 0.04, TL, M.carbon, 8); tl.rotation.x = -(Math.PI / 2 - 0.1); tl.position.set(0, (TL / 2) * 0.1, -TL / 2); this.wheel.add(tl);
    const grip = cyl(0.03, 0.03, 0.3, M.dark, 8); grip.rotation.x = -(Math.PI / 2 - 0.1); grip.position.set(0, (TL - 0.2) * 0.1, -(TL - 0.2)); this.wheel.add(grip);
    this.ext = new THREE.Group(); this.ext.position.set(0, TL * 0.1, -TL); this.wheel.add(this.ext);
    const ext = cyl(0.012, 0.012, 1.3, M.dark, 6); ext.position.y = 0.65; this.ext.add(ext);
    // a winch handle, shipped in the leeward primary while the jib's sheet is ground in (update()): a 25 cm arm and its
    // grip, turning
    this.handle = add(new THREE.Group()); this.handle.visible = false;
    { const arm = new THREE.Mesh(new THREE.BoxGeometry(HANDLE_R + 0.03, 0.018, 0.035), M.alu); arm.position.x = HANDLE_R / 2; this.handle.add(arm);
      const gp = cyl(0.017, 0.017, 0.11, M.dark, 8); gp.position.set(HANDLE_R, 0.065, 0); this.handle.add(gp); }
    this.spin = [this.handle];
    // a low moulded toe rail, pulpit, pushpits, stanchions, lifelines
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.01 + (i / 24) * 0.96; pts.push([sx * (halfBeam(t) - 0.02), sheerAt(t) + 0.01, zAt(t)]); } // on the rounded deck edge
      T.add(tube(pts, 0.014, M.gel));
    }
    // the pulpit (open at the front, as on a racer, so the jib's tack and the gennaker's sit clear of it) and the
    // pushpits on the stern quarters, open between them: black rails on legs, each with a lower rail. The lifelines run
    // between them through the black stanchions.
    const RIN = 0.08, RH = 0.62, at = (t, h = 0, inset = RIN) => [Math.max(0.12, halfBeam(t) - inset), sheerAt(t) + h, zAt(t)];
    const PA = 0.86, PF = 0.965, QF = 0.11, QA = 0.012; // the pulpit's legs (aft, forward) and the pushpit's (forward, aft)
    for (const sx of [-1, 1]) {
      const m = (p) => [sx * p[0], p[1], p[2]];
      T.add(tube([at(PA), at(PA, RH - 0.1), at(PA + 0.02, RH), at(0.92, RH + 0.02), at(PF - 0.012, RH), at(PF, RH - 0.1), at(PF)].map(m), 0.019, M.dark));
      T.add(tube([at(PA, 0.3), at(0.92, 0.31), at(PF, 0.3)].map(m), 0.014, M.dark));
      const sq = [Math.max(1.05, cockpitHalf(STERN_Z - 0.2) + 0.12), sheerAt(QA), zAt(QA) - 0.04]; // the pushpit's aft leg, just outboard of the cockpit
      T.add(tube([at(QF), at(QF, RH - 0.1), at(QF - 0.02, RH), at(0.05, RH + 0.02), at(0.018, RH, 0.14), [sq[0] + 0.12, sq[1] + RH, sq[2] + 0.02], [sq[0], sq[1] + RH - 0.1, sq[2]], sq].map(m), 0.019, M.dark));
      T.add(tube([at(QF, 0.3), at(0.05, 0.31), at(0.02, 0.3, 0.14)].map(m), 0.014, M.dark));
      for (const p of [at(PA), at(PF), at(QF), at(0.03, 0, 0.12), sq]) add(cyl(0.03, 0.036, 0.04, M.dark, 8), sx * p[0], p[1] + 0.02, p[2]); // their feet
      add(cyl(0.014, 0.014, RH, M.dark, 6), sx * at(0.03, 0, 0.12)[0], sheerAt(0.03) + RH / 2, zAt(0.03)); // the pushpit's middle leg
    }
    // three stanchions a side, each braced by a leg slanting down inboard to the deck (the specification's
    // "jambes de force")
    const st = [0.3, 0.49, 0.68];
    for (const sx of [-1, 1]) {
      for (const t of st) {
        const x = halfBeam(t) - RIN, z = zAt(t), xl = x - 0.24, yl = sheerAt(t) + 0.05 * (1 - (xl / halfBeam(t)) ** 2);
        add(cyl(0.013, 0.016, RH, M.dark, 6), sx * x, sheerAt(t) + RH / 2, z);
        add(cyl(0.028, 0.034, 0.04, M.dark, 8), sx * x, sheerAt(t) + 0.02, z); // the stanchion's base
        T.add(bar([sx * x, sheerAt(t) + 0.3, z], [sx * xl, yl, z], 0.011, 0.012, M.dark)); // its leg
        add(cyl(0.022, 0.026, 0.03, M.dark, 8), sx * xl, yl + 0.01, z); // and the leg's foot
      }
      for (const h of [RH - 0.03, 0.3]) T.add(line([PA, ...st.slice().reverse(), QF].map((t) => { const p = at(t, h); return [sx * p[0], p[1], p[2]]; })));
    }
    // deck hardware: the transverse genoa tracks across the side decks abreast the mast, with their cars (the jib
    // sheets lead through them) and end stops, and mooring cleats at the bow and the quarters
    for (const sx of [-1, 1]) {
      const [[x0, z0], [x1, z1]] = GTRACK, len = Math.hypot(x1 - x0, z1 - z0), [cx, cz] = gcar(sx);
      const tr = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.04), M.dark), sx * (x0 + x1) / 2, deckY((z0 + z1) / 2) + 0.06, (z0 + z1) / 2);
      tr.rotation.y = -sx * Math.atan2(z1 - z0, x1 - x0);
      for (const [x, z] of GTRACK) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), M.dark), sx * x, deckY(z) + 0.07, z); // the track's end stops
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), M.dark), cx, deckY(cz) + 0.09, cz);
      fit(add, block(0.035), cx, deckY(cz) + 0.15, cz);
      for (const t of [0.9, 0.04]) { const [x, y, z] = at(t, 0, t > 0.5 ? 0.22 : 0.3); fit(add, cleat(0.22), sx * x, y + 0.01, z); }
    }
    // the halyards' leads: from the front of the mast down to the turning blocks at its foot, out and aft along the
    // coachroof either side of the hatch garage, through the clutches to the halyard winches, three a side
    for (const sx of [-1, 1]) {
      fit(add, block(0.028), sx * 0.13, top + 0.01, MAST_Z + 0.02, sx * 0.5);
      for (let k = 0; k < 3; k++) {
        const x = sx * (0.485 + k * 0.075), y = (z) => roofTop(z) + 0.02;
        T.add(line([[sx * 0.12, y(MAST_Z), MAST_Z + 0.05], [x, y(0), 0], [x, y(1.3), 1.3], [x, y(1.55), 1.55], [sx * 0.56, y(1.72) + 0.02, 1.72]]));
      }
    }
    // the hull-to-deck joint's aluminium rubbing strake, just under the sheer
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = 0.006 + (i / 14) * 0.97, y = sheerAt(t) - 0.025; pts.push([sx * (hullX(t, y) + 0.006), y, zAt(t)]); }
      T.add(tube(pts, 0.012, M.alu));
    }
    // the sail number on both bows, forward of the logo, and the instrument displays either side of the companionway
    { const mat = bowNumberMaterial(look); for (const sx of [-1, 1]) T.add(hullDecal(sx, BOW_Z + 1.1, 0.74, 0.8, 0.22, mat)); }
    if (look.name) { const mat = nameMaterial(look); for (const sx of [-1, 1]) T.add(hullDecal(sx, STERN_Z - 1.65, 0.7, 2.24, 0.28, mat)); } // her name on the quarters
    for (const sx of [-1, 1]) fit(add, display(0.22, 0.16, sx < 0 ? 1 : 2), sx * 0.62, roofTop(CR_ZA) - 0.28, CR_ZA + 0.01);
    // the fixed carbon bowsprit for the gennaker, and its bobstay down to the stem's foot
    this.sprit = add(cyl(0.04, 0.055, 1.55, M.carbon, 10), 0, SPRIT.y, BOW_Z - 0.33);
    this.sprit.rotation.x = Math.PI / 2;
    T.add(line([[0, SPRIT.y - 0.02, SPRIT.z + 0.05], [0, 0.45, BOW_Z + 0.25]]));

    // rig: carbon mast, one set of swept spreaders, standing rigging; each part drawn on an upright mast and turned onto
    // the raked one about its foot (onMast, raked)
    onMast(add(new THREE.Mesh(mastGeo(MASTHEAD - MAST_FOOT, 0.2, 0.13, 0.11, 0.07, (11.8 - MAST_FOOT) / (MASTHEAD - MAST_FOOT)), M.carbon), 0, (MAST_FOOT + MASTHEAD) / 2, MAST_Z));
    const spr = [[SPREADER, SPR_L]];
    for (const [y, l] of spr) for (const sx of [-1, 1]) {
      const s = add(new THREE.Mesh(spreaderGeo(l, 0.03, 0.017), M.carbon), sx * l / 2 * 0.95, y, MAST_Z + l * 0.16);
      s.rotation.z = -sx * Math.PI / 2; s.rotation.y = -sx * 0.32; onMast(s);
    }
    // the mast's collar where it goes through the coachroof, the spreaders' tips, the masthead crane carrying the
    // backstays aft of the mast, the tricolour and the VHF aerial on top, and a display under the gooseneck
    add(cyl(0.13, 0.15, 0.06, M.dark, 16), 0, top + 0.03, MAST_Z).rotation.x = RAKE;
    for (const sx of [-1, 1]) for (const p of [[sx * SPR_L * 0.95, SPREADER, MAST_Z + SPR_L * 0.32]]) onMast(add(new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 3, 8), M.dark), ...p));
    onMast(add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.52), M.carbon), 0, MASTHEAD - 0.04, MAST_Z + 0.24));
    onMast(add(cyl(0.03, 0.035, 0.08, M.dark, 10), 0, MASTHEAD + 0.04, MAST_Z));
    T.add(line([raked(0.03, MASTHEAD, MAST_Z - 0.02), raked(0.03, MASTHEAD + 0.95, MAST_Z - 0.02)]));
    fit(add, display(0.3, 0.17), ...raked(0, MAST_FOOT + 0.5, MAST_Z + 0.12), 0, RAKE);
    const hounds = raked(0, HOUNDS, MAST_Z - 0.06), crane = raked(0, MASTHEAD - 0.06, MAST_Z + 0.48);
    this.forestay = line(Array.from({ length: 9 }, () => [0, 0, 0])); this.forestay.frustumCulled = false; T.add(this.forestay); this.hounds = hounds; // it sags (update())
    // twin backstays from the crane to the quarters, the lee one let go (setBackstays), each led forward from a block on
    // the deck to its own winch by the helm
    this.backstays = [];
    for (const sx of [-1, 1]) {
      const bs = [sx * (halfBeam(0.02) - 0.14), sheerAt(0.02) + 0.05, STERN_Z - 0.25];
      const stay = line(Array.from({ length: STAY_N + 1 }, () => [0, 0, 0])); stay.frustumCulled = false;
      stay.userData = { sx, top: crane, end: bs }; T.add(stay); this.backstays.push(stay);
      fit(add, chainplate(bs, crane, 0.2));
      const bk = [sx * (halfBeam(0.04) - 0.2), sheerAt(0.04) + 0.04, zAt(0.04)];
      fit(add, block(0.03), ...bk, sx * 0.2);
      T.add(line([bk, [sx * (BACKSTAY_W[0] + 0.07), deckY(BACKSTAY_W[1]) + 0.12, BACKSTAY_W[1] + 0.03]]));
    }
    for (const sx of [-1, 1]) {
      // the shrouds (the sail plan): the caps from the hounds over the spreader tips and straight down to the deck edge,
      // the intermediates from 11 m up the mast to the tips, the lowers from under the spreaders to the deck; their
      // chainplates 0.65–0.85 m aft of the mast's foot, for the swept spreaders
      const tip = raked(sx * SPR_L * 0.95, SPREADER, MAST_Z + SPR_L * 0.32), ze = 0.4, zl = 0.2;
      const cap = [sx * (hbAt(ze) - 0.1), deckY(ze) + 0.02, ze], low = [sx * (hbAt(zl) - 0.14), deckY(zl) + 0.02, zl];
      const lowTop = raked(0, SPREADER - 0.1, MAST_Z);
      T.add(line([raked(0, HOUNDS, MAST_Z), tip, cap]));
      T.add(line([raked(0, 11.1, MAST_Z), tip]));
      T.add(line([lowTop, low]));
      fit(add, chainplate(cap, tip));
      fit(add, chainplate(low, lowTop));
    }
    // the forestay's deck fitting, at the inboard end of the bowsprit's plate: the forestay and the jib's tack come down to it
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), M.steel), 0, TACK.y - 0.06, TACK.z + 0.04);
    fit(add, chainplate([0, TACK.y - 0.02, TACK.z - 0.02], hounds, 0.14, 0.014));
    // the mainsheet: a four-part tackle from the traveller's car up to the block under the boom
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);

    // boom and mainsail swing on a pivot about the mast's raked axis (mainRake tilts it, about the foot): the boom with
    // its gooseneck, its end fitting, the mainsheet's block under it and the rigid vang from the foot of the mast, one
    // mesh a material. In the pivot's frame the mast is upright, y up its axis
    this.mainRake = add(new THREE.Group(), 0, MAST_FOOT, MAST_Z); this.mainRake.rotation.x = RAKE;
    this.mainPivot = new THREE.Group(); this.mainPivot.position.y = -MAST_FOOT; this.mainRake.add(this.mainPivot);
    const boom = new THREE.Group();
    const spar = cyl(0.065, 0.05, BOOM_L, M.carbon, 12); spar.rotation.x = Math.PI / 2; spar.position.set(0, BOOM_Y, BOOM_L / 2); boom.add(spar);
    const gn = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.16), M.alu); gn.position.set(0, BOOM_Y, 0.08); boom.add(gn);
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), M.alu); end.position.set(0, BOOM_Y, BOOM_L); boom.add(end);
    for (const [g, mm] of block(0.045)) { const o = new THREE.Mesh(g, mm); o.position.set(0, BOOM_Y - 0.115, SHEET_B); boom.add(o); }
    const VA = [0, MAST_FOOT + 0.27, 0.1], VB = [0, BOOM_Y - 0.06, 1.2], VM = VA.map((v, i) => lerp(v, VB[i], 0.42));
    boom.add(bar(VA, VM, 0.018, 0.018, M.alu), bar(VM, VB, 0.032, 0.028, M.carbon));
    this.mainPivot.add(mergeGroup(boom));
    this.main = sailMesh(20, 12, sailTexture('main', look), look.laminate, 'main'); this.mainPivot.add(this.main);
    // jib on the forestay, swung about the stay itself
    this.jibPivot = add(new THREE.Group(), TACK.x, TACK.y, TACK.z);
    this.jibAxis = HEAD.clone().sub(TACK).normalize();
    this.jib = sailMesh(16, 9, sailTexture('jib', look), look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.kite = sailMesh(16, 10, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);

    // telltales on the jib luff (they matter at the helm)
    this.tells = [];
    if (player) for (const [f, sx] of [[0.3, 1], [0.3, -1], [0.52, 1], [0.52, -1]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      t.userData = { f, sx }; this.jibPivot.add(t); this.tells.push(t);
    }
    if (label) { this.label = labelSprite(label.color); this.labelText = label.text; this.label.position.set(0, 18.4, 0); this.root.add(this.label); }
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(sx, look.logo)); // the logo on both bows
    // the running rigging: jib sheets (the working one taut to the leeward winch, the lazy one slack), the gennaker
    // sheet, halyards down the front of the mast, and a wind vane at the masthead
    const pts = (n) => Array.from({ length: n }, () => [0, 0, 0]); // ropes that hang: points enough for the curve
    this.jibSheet = line(pts(10)); this.lazySheet = line(pts(9)); this.kiteSheet = line(pts(9)); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false; // their points move every frame
    for (const dx of [-0.05, 0.05]) T.add(line([raked(dx, MASTHEAD - 0.25, MAST_Z - 0.09), raked(dx, MAST_FOOT + 0.35, MAST_Z - 0.11)]));
    this.windex = add(new THREE.Group(), ...raked(0, MASTHEAD + 0.02, MAST_Z)); this.windex.userData.flat = true;
    const rod = cyl(0.008, 0.008, 0.5, M.dark, 4); rod.position.set(0, 0.1, -0.1); rod.rotation.x = Math.PI / 2; this.windex.add(rod);
    const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.dark); vane.rotation.x = -Math.PI / 2; vane.position.set(0, 0.1, -0.38); this.windex.add(vane);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide })); tail.rotation.y = Math.PI / 2; tail.position.set(0, 0.12, 0.12); this.windex.add(tail);
    this.sailSide = 1;
    // the crew: four sailors — the helm (at the tiller), the main trimmer, the jib (and kite) trimmer, and the bow (see sailor()); where
    // they sit, which way they face and how far they lean out is set in update()
    const jacket = new THREE.MeshStandardMaterial({ color: look.crew || look.stripe, roughness: 0.8 });
    const trousers = new THREE.MeshStandardMaterial({ color: look.pants || '#262a31', roughness: 0.85 });
    const vest = new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.55 });
    const cap = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.crew || look.stripe).getHSL({}).l < 0.3 ? '#efeee9' : '#22262c', roughness: 0.75 });
    const skins = ['#c99272', '#e2b291', '#a36d4c', '#d8a27e'];
    this.roofY = top + 0.03; // where the bow stands to reef, at the mast
    this.crew = [4.25, 2.95, 2.1, 1.1].map((z0, i) => {
      const s = sailor({ jacket, trousers, vest, cap, skin: new THREE.MeshStandardMaterial({ color: skins[i], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, x: 0, y: deckY(z0), z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 };
    });

    // everything solid casts and catches the sun's shadow (sails on the deck and on each other)
    this.wash = deckWash(hbAt, deckY, BOW_Z + 1.2, STERN_Z - 0.3); T.add(this.wash);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.hullSea = hullSea(this, L / 2);
    this.bake();
  }

  // The fittings that never move (hull, deck gear, rails, stanchions, rig, standing rigging) are ~150 small parts, each
  // its own draw — in the view, the sea's reflection and the sun's shadow. Merged per material (and per detail level,
  // so setDetail still hides the small ones far off), a boat costs a dozen draws instead.
  bake() {
    this.shrouds = shroudsOf(this); // (read while they're still lines of their own)
    const moving = new Set([this.travCar, this.wheel, ...(this.rudders || []).map((r) => r.kick), this.sprit, this.mainRake, this.mainPivot, this.jibPivot, this.kite, this.windex,
      this.mainsheet, this.jibSheet, this.lazySheet, this.kiteSheet, this.forestay, ...(this.backstays || []), this.wash, ...this.crew.map((c) => c.g), ...(this.spin || [])]);
    if (this.tells?.length) this.wire(moving); // your own boat: her rigging as wire when you're close (setCrewNear)
    const sets = new Map(), fold = BAKE.fold, parts = [];
    for (const o of this.tilt.children) {
      if (moving.has(o) || o.children.length || !(o.isMesh || o.isLine) || Array.isArray(o.material)) continue;
      if (o.isLine && !o.frustumCulled) continue; // a line that moves isn't culled: its points change every frame
      o.updateMatrix();
      // mirrored: its faces would turn inside out (folding, they're turned back: unmirror)
      if (o.matrix.determinant() < 0 && !(fold && o.isMesh)) continue;
      parts.push(o);
    }
    // what moves (the boom, the traveller's car, the wheel, the windex…) moves as a whole: the plain parts of each are
    // folded too, into a mesh that moves with them; and those in a group of their own that stands still, into hers.
    // Not a part anything else reaches for by name (it may move on its own, or come and go), nor the crew's
    const rel = new Map(); // a part in a group that stands still → where it is in her frame
    if (fold) {
      const named = new Set(), note = (x, d = 0) => {
        if (x?.isObject3D) named.add(x);
        else if (d < 2 && x && typeof x === 'object' && (Array.isArray(x) || Object.getPrototypeOf(x) === Object.prototype)) for (const y of Object.values(x)) note(y, d + 1);
      };
      for (const x of Object.values(this)) note(x);
      const skip = new Set([...this.crew.map((c) => c.g), this.wash]);
      const loose = (o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.children.length && !named.has(o) && o.visible && !Array.isArray(o.material)
        && !Object.keys(o.userData).length && !Object.hasOwn(o, 'onBeforeRender') && plain(o.material);
      const walk = (n, still) => { // still: n and all between it and her stand still
        if (skip.has(n) || n.isMesh || n.isLine) return;
        const moves = n !== this.tilt && (moving.has(n) || named.has(n) || !still);
        if (n !== this.tilt) for (const o of n.children) if (loose(o)) {
          o.updateMatrix();
          if (!moves) { const m = o.matrix.clone(); for (let p = n; p !== this.tilt; p = p.parent) { p.updateMatrix(); m.premultiply(p.matrix); } rel.set(o, m); }
          parts.push(o);
        }
        for (const c of n.children) if (c.children.length) walk(c, !moves && n.visible);
      };
      walk(this.tilt, true);
    }
    // what reaches down to the water stays as it is: the hulls under it (world.js underParts) are drawn in each part's
    // own colour, which a folded part no longer has. A material with such a part among those that stand still keeps
    // all of them merged on their own, as before; a moving one's part that does stays on its own
    const wet = new Set(), box = new THREE.Box3(), dry = 0.35 * (this.drawnL || 10.45) / (this.cls?.loa ?? 10.45);
    const isWet = (o) => { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); return box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).min.y < dry; };
    if (fold) {
      this.root.updateMatrixWorld(true); // (the boat as built: her frame is the world's)
      for (const o of parts) if (o.parent === this.tilt && o.isMesh && plain(o.material) && isWet(o)) wet.add(o.material);
    }
    for (const o of parts) {
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const small = o.isLine || g.boundingSphere.radius * Math.max(...o.scale.toArray().map(Math.abs)) < 0.9; // as setDetail
      const folds = fold && o.isMesh && plain(o.material) && !!g.attributes.normal && (o.parent === this.tilt ? !wet.has(o.material) : !isWet(o));
      if (o.parent !== this.tilt && !folds) continue;
      const parent = rel.has(o) ? this.tilt : o.parent;
      const attrs = Object.keys(g.attributes).sort().join();
      const key = folds ? [parent.uuid, 'F', small, o.castShadow, o.renderOrder].join('|')
        : [o.isLine ? 'L' : 'M', o.material.uuid, small, o.castShadow, o.renderOrder, attrs, o.isLine || !fold ? !!g.index : true].join('|');
      if (!sets.has(key)) sets.set(key, { list: [], small, line: o.isLine, mat: o.material, cast: o.castShadow, order: o.renderOrder, folds, parent });
      sets.get(key).list.push(o);
    }
    const indexed = (g) => (g.index ? g : g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i)));
    for (const s of sets.values()) {
      if (s.list.length < 2) continue; // (one part alone is drawn as it was)
      const cc = s.folds && s.list.some((o) => o.material.isMeshPhysicalMaterial);
      const geos = s.list.map((o) => {
        const at = rel.get(o) || o.matrix, g = o.geometry.clone().applyMatrix4(at);
        if (at.determinant() < 0) unmirror(g);
        if (s.folds) foldGeometry(g, o.material, cc);
        if (s.line) { // a strip of points → its segments, so many lines can be one LineSegments
          const p = g.attributes.position, idx = [];
          for (let i = 0; i < p.count - 1; i++) idx.push(i, i + 1);
          g.setIndex(idx);
        } else if (fold) indexed(g);
        return g;
      });
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      const m = s.line ? new THREE.LineSegments(merged, s.mat) : new THREE.Mesh(merged, s.folds ? foldMaterial(cc) : s.mat);
      m.castShadow = s.cast; m.receiveShadow = true; m.renderOrder = s.order; m.userData.detail = s.small;
      for (const o of s.list) { const own = o.parent === this.tilt; o.removeFromParent(); if (own && !SHARED.has(o.geometry)) o.geometry.dispose(); } // (a group's may be shared)
      s.parent.add(m);
    }
    if (fold) BoatView.prototype.lines.call(this); // (the classes' views share this bake, not the class)
  }

  // Her lines (standing rigging, sheets, stays, runners, lifelines), each its own draw and the moving ones never culled
  // (their points change every frame): drawn instead as one set of segments a material, filled each frame from the
  // lines as they are then, after everything on her has moved and before anything is drawn, and culled as the boat is.
  // The lines themselves stay where they are, in no layer: what moves them, shows or hides them, still does.
  lines() {
    const by = new Map();
    this.tilt.traverse((o) => {
      if (!o.isLine || o.material?.type !== 'LineBasicMaterial' || o.material.vertexColors || o.geometry.morphAttributes.position) return;
      const chain = []; for (let p = o; p !== this.tilt; p = p.parent) chain.push(p);
      const k = o.material.uuid + '|' + o.renderOrder;
      if (!by.has(k)) by.set(k, { mat: o.material, order: o.renderOrder, src: [] });
      by.get(k).src.push({ o, chain });
    });
    if (!by.size) return;
    // as far as anything on her reaches, and then some (a kite's sheet, a backstay let go)
    this.root.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(this.tilt).getBoundingSphere(new THREE.Sphere());
    sphere.applyMatrix4(new THREE.Matrix4().copy(this.tilt.matrixWorld).invert()); sphere.radius *= 1.3;
    const segs = (o) => { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count, c = Math.min(n - g.drawRange.start, g.drawRange.count); return o.isLineSegments ? c : Math.max(0, c - 1) * 2 + (o.isLineLoop && c > 2 ? 2 : 0); };
    const M = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const { mat, order, src } of by.values()) {
      const geo = new THREE.BufferGeometry();
      const grow = (n) => { const a = new THREE.BufferAttribute(new Float32Array(n * 3), 3); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('position', a); return a; };
      let attr = grow(src.reduce((a, s) => a + segs(s.o), 0));
      geo.boundingSphere = sphere.clone();
      const all = new THREE.LineSegments(geo, mat);
      all.renderOrder = order; all.userData.detail = true; // (far off, hidden with the small fittings: setDetail)
      for (const s of src) s.o.layers.disableAll();
      all.updateMatrixWorld = function (force) {
        THREE.LineSegments.prototype.updateMatrixWorld.call(this, force);
        if (!this.visible) return;
        const need = src.reduce((a, s) => a + segs(s.o), 0);
        if (need > attr.count) attr = grow(need * 2);
        const out = attr.array;
        let n = 0;
        for (const { o, chain } of src) {
          if (chain.some((p) => !p.visible)) continue;
          M.identity();
          for (const p of chain) { if (p.matrixAutoUpdate) p.updateMatrix(); M.premultiply(p.matrix); }
          const g = o.geometry, P = g.attributes.position, I = g.index, s0 = g.drawRange.start, c = Math.min((I ? I.count : P.count) - s0, g.drawRange.count);
          const at = (i) => { const j = I ? I.getX(s0 + i) : s0 + i; v.fromBufferAttribute(P, j).applyMatrix4(M); out[n * 3] = v.x; out[n * 3 + 1] = v.y; out[n * 3 + 2] = v.z; n++; };
          if (o.isLineSegments) for (let i = 0; i + 1 < c; i += 2) { at(i); at(i + 1); }
          else { for (let i = 0; i + 1 < c; i++) { at(i); at(i + 1); } if (o.isLineLoop && c > 2) { at(c - 1); at(0); } }
        }
        geo.setDrawRange(0, n);
        attr.needsUpdate = true;
      };
      this.tilt.add(all); // (last: the lines it gathers have moved by the time it's reached)
    }
  }

  // Seen from a few metres, a line one pixel wide is no wire. Your own boat gets her standing rigging and lifelines a
  // second time as thin dark wire (rod and Dyneema, 4–5 mm across), shown only when the camera is close (setCrewNear);
  // further off the lines are what reads
  wire(moving) {
    const geos = [];
    for (const o of this.tilt.children) {
      if (!o.isLine || moving.has(o) || !o.frustumCulled) continue; // (a line that moves isn't culled: its points change)
      o.updateMatrix();
      const p = o.geometry.attributes.position, v = (i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(o.matrix);
      for (let i = 0; i < p.count - 1; i++) {
        const a = v(i), b = v(i + 1), len = a.distanceTo(b);
        if (len < 0.02) continue;
        const g = new THREE.CylinderGeometry(0.0045, 0.0045, len, 5, 1, true);
        g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
        geos.push(g);
      }
    }
    if (!geos.length) return;
    this.wireMesh = new THREE.Mesh(mergeGeometries(geos), WIRE); this.wireMesh.visible = false; this.wireMesh.userData.flat = true;
    this.tilt.add(this.wireMesh);
  }

  // what a sailor stands on at (x, z): the coachroof's top (and the hatch garage on it), the cockpit's floor, or the deck
  surfaceAt(x, z) {
    const ax = Math.abs(x);
    if (z < CR_ZA && z > CR_ZF && ax < roofHalf(z)) return roofTop(z) + (ax < GARAGE.x && z > GARAGE.z0 && z < GARAGE.z1 ? GARAGE.h : 0);
    if (z >= CR_ZA && ax < cockpitHalf(z)) return FLOOR;
    return deckY(z);
  }

  // far away, the small fittings (winches, hatches, lines, blocks) aren't worth their draw calls
  setDetail(on) {
    if (this.detailOn === on) return;
    if (!this.small) {
      this.small = [];
      const keep = new Set(); // the sails (each a group of two faces) and the kite gear: never hidden here
      for (const k of [this.main, this.jib, this.kite, this.sprit, this.kiteSheet]) if (k) k.traverse((o) => keep.add(o));
      this.tilt.traverse((o) => {
        if (!(o.isMesh || o.isLine) || !o.geometry || keep.has(o)) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const r = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
        if (o.userData.detail ?? (r < 0.9 || o.isLine)) this.small.push(o); // merged parts (bake) say which they are
      });
    }
    for (const o of this.small) o.visible = on;
    this.detailOn = on;
    crewLevel(this);
  }
  // the crew within a few tens of metres of the camera get their full figures; further off the plain ones, where a
  // nose or a lens would be a pixel
  setCrewNear(near, close = false) {
    if (this.wireMesh) this.wireMesh.visible = near;
    if (this.crewNear === near && this.crewClose === close) return;
    this.crewNear = near; this.crewClose = close;
    crewLevel(this);
  }
  // the grip of the winch handle, dy above its middle, in her frame
  handleGrip(dy) { const h = this.handle, a = h.rotation.y; return new THREE.Vector3(h.position.x + HANDLE_R * Math.cos(a), h.position.y + 0.065 + dy, h.position.z - HANDLE_R * Math.sin(a)); }
  update(b, t, W, showLabel) {
    const y = waveHeight(W, b.x, b.z, t), fx = Math.sin(b.h), fz = -Math.cos(b.h);
    const pitch = Math.atan2(waveHeight(W, b.x + fx * 4, b.z + fz * 4, t) - waveHeight(W, b.x - fx * 4, b.z - fz * 4, t), 8);
    const roll = Math.atan2(waveHeight(W, b.x - fz * 1.5, b.z + fx * 1.5, t) - waveHeight(W, b.x + fz * 1.5, b.z - fx * 1.5, t), 3) * 0.5;
    const side = b.boom || (b.twa >= 0 ? 1 : -1); // the boom's side: by the lee it stays put until she gybes
    this.sailSide = lerp(this.sailSide, side, Math.abs(b.twa) > 2.1 ? 0.2 : 0.06); // a gybe slams the boom across
    this.root.position.set(b.x, y * 0.85 - 0.05, b.z);
    this.root.rotation.y = -b.h;
    this.tilt.rotation.x = pitch;
    this.tilt.rotation.z = (this.heelZ = side * b.heel * D2R) + roll;
    this.wheel.rotation.y = b.rudder * 0.5;
    if (this.crewT === undefined) this.ext.rotation.set(0.35, 0, -side * 1.05); // the tiller extension, up and out to the helm's side (then where her hand holds it)
    this.wash.userData.set(this.sea?.rz ?? this.tilt.rotation.z, t, b.v);

    const sa = b.sail * D2R, cl = clothState(this, b, t), ss = this.sailSide;
    const reefDrop = (b.reefFill || 0) * 2.4; // a reef: the head comes 2.4 m down the mast, the sail is that much smaller
    clearShrouds(this, sa, ss, { y: (f) => BOOM_Y + 0.08 + f * (MASTHEAD - 0.3 - BOOM_Y - reefDrop), chord: mainChord, x: (f, u) => mainShape(cl, f, u, mainChord(f), ss, 0.11, 0.5).x });
    // square-top main: the chord narrows up the mast to a wide head, with roach on the leech; twist opens the top
    setSail(this.main, (f, u, v) => {
      const m = mainShape(cl, f, u, mainChord(f), ss, 0.11, 0.5);
      v.set(m.x, BOOM_Y + 0.08 + f * (MASTHEAD - 0.3 - BOOM_Y - reefDrop), m.z);
      turnMain(this, f, v);
    });
    if (this.detailOn !== false) setBackstays(this, cl, t, reefDrop); // (far off the lines are hidden: setDetail)
    // the mainsheet, from the block on the traveller's car to the one under the boom
    const ma = this.mainPivot.rotation.y, bz = SHEET_B;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.6 + Math.sign(Math.sin(ma)) * clamp((b.depower || 0) / 10, 0, 1) * 0.35, -this.travW, this.travW); // dropped to leeward in a gust
    purchase(this.mainsheet, [this.travCar.position.x, FLOOR + 0.155, SHEET_Z], raked(Math.sin(ma) * bz, BOOM_Y - 0.115, MAST_Z + Math.cos(ma) * bz));
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, 30 * D2R); // on its own sheet when the jib has one
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = HEAD.clone().sub(TACK), clew = JIB_CLEW, sag = staySag(head.length(), cl.aws), st = jibStow(b); // st: furled under the kite
    setSail(this.jib, (f, u, v) => {
      const sg = sag * Math.sin(Math.PI * f), lx = head.x * f - ss * sg, ly = head.y * f, lz = head.z * f + sg * 0.5; // the luff on the sagging stay
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const dx = ex - lx, dy = ey - ly, dz = ez - lz, len = Math.sqrt(dx * dx + dy * dy + dz * dz), al = jibAlong(f, u);
      v.set(lerp(lx, ex, al) + jibShape(cl, f, u, len, ss, 0.125, 1.3), lerp(ly, ey, al), lerp(lz, ez, al));
      stowJib(v, st, false, lx, ly, lz);
    });
    stowTells(this.tells, st);
    // the jib sheets: from the clew to the car on the leeward side deck and on to the winch; the lazy one slack
    const cw = stowJib(clew.clone(), st, false).applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1;
    const js = this.jibSheet.geometry.attributes.position, lz = this.lazySheet.geometry.attributes.position;
    const [gx, gz] = gcar(ls), [lx] = gcar(-ls), wy = deckY(PRIMARY[1]) + 0.2; // through the car on the leeward track to the primary
    // the working sheet hangs between the clew and the car as it's eased, and whips about while the jib flogs; the lazy
    // one lies slack across the coachroof forward of the mast to the windward car
    const C = [cw.x, cw.y, cw.z], car = [gx, deckY(gz) + 0.16, gz], slack = 0.03 + 0.15 * smoothstep(12, 30, (b.jibSail ?? b.sail) || 0) + 0.4 * cl.flogJ;
    drape(js, 0, 9, C, car, slack, 0.35 * cl.flogJ, t); js.setXYZ(9, ls * (PRIMARY[0] - 0.05), wy, PRIMARY[1]); js.needsUpdate = true;
    const land = [ls * 0.25, roofTop(MAST_Z - 0.6) + 0.03, MAST_Z - 0.6];
    drape(lz, 0, 5, C, land, 0.35 + 0.3 * cl.flogJ, 0.3 * cl.flogJ, t + 1);
    lz.setXYZ(5, -ls * 0.3, roofTop(MAST_Z - 0.3) + 0.03, MAST_Z - 0.3); lz.setXYZ(6, -ls * (roofHalf(0) - 0.05), roofTop(0) + 0.02, 0);
    lz.setXYZ(7, lx, deckY(gz) + 0.16, gz); lz.setXYZ(8, -ls * (PRIMARY[0] - 0.05), wy, PRIMARY[1]); lz.needsUpdate = true;
    // the forestay, from the bow to the hounds, sagging with the jib's luff on it
    { const fp = this.forestay.geometry.attributes.position, hd = this.hounds, fs = staySag(Math.hypot(hd[0] - TACK.x, hd[1] - TACK.y, hd[2] - TACK.z), cl.aws);
      for (let k = 0; k < 9; k++) { const f = k / 8, sg = fs * Math.sin(Math.PI * f); fp.setXYZ(k, lerp(TACK.x, hd[0], f) - ss * sg, lerp(TACK.y, hd[1], f), lerp(TACK.z, hd[2], f) + sg * 0.5); }
      fp.needsUpdate = true; }
    // the wind vane points into the apparent wind
    this.windex.rotation.y = -b.awa;
    // the crew: upwind on the windward rail, leaning out the more she heels; downwind in the cockpit, the kite trimmer
    // to leeward watching the kite; the bow goes forward for a hoist, a drop or a jib change. They cross the boat in a
    // tack or gybe over a second or two.
    const first = this.crewT === undefined, dt = clamp(t - (this.crewT ?? t), 0, 0.1); this.crewT = t; // the first time, straight to their places
    const up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!(b.kiteJob || b.jibJob || b.reefJob);
    if (this.tackSide !== side) { if (this.tackSide !== undefined) this.tackT = t; this.tackSide = side; } // when she last tacked or gybed
    const sinceTack = t - (this.tackT ?? -99);
    // in light air upwind the crew sit to leeward and forward (to give her heel and keep her stern out of the water);
    // reaching and running fast they go aft (to keep her bow up); in a gybe the main trimmer takes the mainsheet's
    // falls across by hand and the others duck under the boom
    const light = up && cl.aws < 7.5 && b.heel < 9, fn = Math.max(0, b.v) / Math.sqrt(9.81 * L), aft = up ? 0 : smoothstep(0.36, 0.55, fn) * 0.7 + (b.surf > 0 ? 0.2 : 0);
    const gybing = !up && (sinceTack < 2.4 || (!!b.auto && Math.abs(b.twa) > 165 * D2R)); // from just before the boom comes across
    this.grinding = up && sinceTack < 3.8;
    const grind = this.grinding;
    // the winch handle, in the leeward primary while the jib's sheet is ground in, its arm going round
    this.handle.visible = grind && this.detailOn !== false;
    this.handle.position.set(-side * PRIMARY[0], deckY(PRIMARY[1]) + 0.25, PRIMARY[1]); this.handle.rotation.y = -t * 8.5 * side;
    const kh = first ? 1 : 1 - Math.exp(-dt * 4);
    // the sea's own roll, which the crew's bodies take out (a sailor sits up straight while the boat rolls under her)
    const sway = this.sway = first ? 0 : clamp((this.sea?.rz ?? this.tilt.rotation.z) - (this.heelZ ?? 0), -0.35, 0.35) * 0.6;
    feel(this, dt);
    for (const c of this.crew) {
      // each crosses in her own time in a tack: the helm with the tiller, the bow and the main trimmer, the jib
      // trimmer last, once she has the new sheet made
      if (first || c.side === undefined) c.side = c.goal = side;
      if (side !== c.goal) { c.goal = side; c.at = t + [0.25, 0.45, 0.85, 0.35][c.i]; }
      if (c.side !== c.goal && t >= c.at) c.side = c.goal;
      const cs = c.side;
      // yaw turns a sailor (0 faces outboard, π/2 forward, π inboard); lean tips the body forward, out over the
      // lifelines when she faces outboard; knee bends the knees (the thighs lie level when seated); reach swings the arms
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      if (c.i === 0) { x = cs * (hbAt(z) - 0.22); y = deckY(z) + 0.06; yaw = 2.3; lean = up ? 0.05 - 0.2 * hike : 0.12; knee = -1.3; reach = 0.9 + clamp(b.rudder * 0.4, -0.3, 0.3) * cs; } // the helm: on the windward side deck, the tiller extension in hand, her arm moving with it
      else if (c.i === 3 && bowBusy) { x = 0.12; z = b.reefJob ? MAST_Z + 0.55 : -3.4; y = b.reefJob ? this.roofY : deckY(z) + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.15; reach = 0.7; } // forward to work
      else if (c.i === 2 && up && sinceTack < 3.8) { z = PRIMARY[1] + 0.45; x = -side * (PRIMARY[0] - 0.12); y = deckY(z) + 0.06; yaw = 2.0; lean = 0.5; knee = -1.2; reach = 1.0 + 0.45 * Math.sin(t * 8.5); } // after a tack: grinding the new sheet in on the leeward primary
      else if (up && light) { z = c.z0 - 0.5; x = -cs * (hbAt(z) - 0.32); y = deckY(z) + 0.06; yaw = Math.PI - 0.3; lean = 0.15; knee = -1.2; reach = 0.45; } // light air: to leeward, forward, sitting in
      else if (up) { x = cs * (hbAt(z) - 0.12); y = deckY(z) + 0.09; yaw = 0; lean = 0.12 + 0.45 * hike; knee = -1.85; reach = 0.3; } // on the rail, legs over the side, hiking out
      else if (gybing && c.i === 1) { x = cs * 0.3; z = c.z0 + 0.2; y = FLOOR; yaw = Math.PI / 2 + 0.5; stand = 0.75; lean = 0.25; reach = 1.55 + 0.2 * Math.sin(t * 6); } // the gybe: the mainsheet's falls in hand, the boom across
      else { x = (c.i === 3 || (c.i === 2 && b.kite) ? -cs : cs) * 0.72; z = (c.i === 3 ? 3.3 : c.z0) + aft; y = FLOOR + 0.2; if (gybing) lean = 0.75; } // in the cockpit on its foot braces, the kite trimmer to leeward; ducking in a gybe
      const k = first ? 1 : 1 - Math.exp(-dt * (gybing ? 5 : 2.2)); // quick about it in a gybe
      // on the move she goes crouched over what's in the way — up across the coachroof's top, down through the
      // cockpit — not through it, her feet on what's under her and a step ahead of her
      const mx = x - c.x, mz = z - c.z, md = Math.hypot(mx, mz), moving = !first && md > 0.3;
      if (moving) {
        const under = Math.max(this.surfaceAt(c.x, c.z), this.surfaceAt(c.x + (mx / md) * 0.4, c.z + (mz / md) * 0.4));
        y = under + 0.02; stand = 0.45; lean = 0.55; knee = -1.5; reach = 0.75;
      }
      c.x += mx * k; c.z += mz * k; c.yaw += (yaw - c.yaw) * k;
      c.y += (y - c.y) * (moving ? 1 - Math.exp(-dt * 14) : k);
      if (moving) c.y = Math.max(c.y, this.surfaceAt(c.x, c.z));
      c.lean += (lean - c.lean) * k; c.stand += (stand - c.stand) * k; c.knee += (knee - c.knee) * k; c.reach += (reach - c.reach) * (c.i === 2 && sinceTack < 3.8 ? 1 - Math.exp(-dt * 12) : k);
      // her hands: the helm's on the tiller's extension; grinding, both on the winch handle; reefing at the mast, the
      // bow hauls the luff down hand over hand
      let hands = null;
      if (c.i === 0) hands = (c, M) => [holdExtension(this.ext, 1.3, c, M)];
      else if (c.i === 2 && grind) hands = [this.handleGrip(0.05), this.handleGrip(-0.04)];
      else if (c.i === 3 && bowBusy && b.reefJob) hands = [0, 1].map((j) => new THREE.Vector3(...raked(0, this.roofY + 1.3 + j * 0.32 + 0.14 * Math.sin(t * 4.5 + j * Math.PI), MAST_Z + 0.09)));
      c.first = first;
      drive(this, c, dt, hands);
      // where she looks: the helm at the telltales, now and then to windward for the next gust; on the rail ahead and
      // up the course; the jib trimmer at the jib while she grinds; the kite trimmer at the gennaker's luff; the bow at
      // her work; and each now and then up at the sails
      const gl = glance(t, c.i);
      let lw = 1.0, lu = 0.05;
      if (c.i === 0) { lw = gl === 2 ? 0.4 : 2.0; lu = gl === 2 ? 0.05 : 0.3; }
      else if (c.i === 3 && bowBusy) { lw = Math.PI / 2; lu = -0.45; }
      else if (c.i === 2 && this.grinding) { lw = 2.3; lu = 0.5; }
      else if (c.i === 2 && b.kite) { lw = 1.0; lu = 0.4; }
      else if (!up) { lw = gl === 2 ? 0.6 : 1.7; lu = 0.1; }
      if (gl === 1 && !(c.i === 3 && bowBusy)) { lw = 2.4; lu = 0.6; } // up at the sails
      lookAt(c, lw, lu, kh);
    }
    this.crewAft = this.crew.reduce((a, c) => a + (c.z - c.z0), 0) / this.crew.length; // how far aft her crew are, for her trim (world.js)
    // the twin rudders: heeled, the windward one is kicked up aft, clear of the water (it would only drag); upright,
    // both are down
    for (const r of this.rudders || []) { // (the classes in boats3d.js borrow this view's methods and have none)
      const want = r.sx === side ? clamp((b.heel - 9) / 6, 0, 1) : 0;
      r.lift = first ? want : r.lift + (want - r.lift) * (1 - Math.exp(-dt * 1.5));
      r.kick.rotation.x = -1.5 * r.lift;
    }
    // gennaker on the bowsprit
    // kf: how far the gennaker is up — it climbs the mast furled during a hoist and fills only at the top, and comes
    // down collapsing during a drop
    const kf = kiteHoist(b), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)); // half collapsed while it's gybed
    this.kite.visible = this.kiteSheet.visible = kf > 0.02; // the bowsprit is fixed: it stays
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6.2, 3.4, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [SPRIT.x, SPRIT.y + 0.1, SPRIT.z], hd = [0, lerp(SPRIT.y + 1, KITE_HEAD[1], kf), lerp(SPRIT.z, KITE_HEAD[2], kf)], kl = [sd * out, lerp(SPRIT.y + 0.4, 2.9, kf), lerp(SPRIT.z + 0.8, 1.8, kf)];
      const lead = [sd * 1.3, deckY(4.6) + 0.1, 4.6], guard = kiteGuard(this); guard.clew(kl, lead);
      setKite(this, tk, hd, kl, sd, 0, 2.8, kfill, guard);
      const kp = this.kiteSheet.geometry.attributes.position;
      drape(kp, 0, 9, kl, lead, 0.25 + 1.2 * (b.kiteCollapse || 0) + 0.4 * (1 - kfill), 0.25 * (b.kiteCollapse || 0), t); kp.needsUpdate = true;
    }
    // telltales: streaming aft when the trim is right, lifting or drooping when it isn't
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side;
      tt.position.set(head.x * f + sx * 0.04, head.y * f, head.z * f + 0.35);
      let rot = Math.PI / 2 + Math.sin(t * 9 + f * 10) * 0.12, ok = true;
      if (b.trim === 'in' && windward) { rot = Math.PI / 2 + 1.0 + Math.sin(t * 13) * 0.5; ok = false; }
      if (b.trim === 'out' && !windward) { rot = 0.25 + Math.sin(t * 5 + f) * 0.2; ok = false; }
      if (b.trim === 'irons') { rot = Math.sin(t * 15 + f * 3) * 1.4; ok = false; }
      tt.rotation.x = -rot;
      tt.material.color.set(ok ? '#2ecc71' : '#ff4d3d');
    }
    if (this.label) { // no names over the boats: a tag only while she's on a penalty, over early or disqualified
      const status = b.pen ? '⟳' : b.ocs ? 'OCS' : b.dsq ? 'DSQ' : '';
      this.label.visible = showLabel && !!status;
      if (status) this.label.userData.set(status, true);
    }
  }
}
