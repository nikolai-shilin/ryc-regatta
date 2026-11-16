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
import { sponsor } from './sponsor.js';
import { D2R, NO_GO, clamp, lerp, waveHeight } from './sim.js';
import { VENUE } from './venues.js';
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
      float hullSea(vec2 xz) { float h = 0.0; for (int i = 0; i < 5; i++) h += uW[i].w * sin(uW[i].z * dot(uW[i].xy, xz) - uWs[i] * uTime + float(i) * 1.7); return h; }`)
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
        material.clearcoat *= max(1.0 - under, wet); material.roughness = mix(mix(material.roughness, 0.75, under), 0.12, wet * 0.8);`);
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

// her name on both quarters, in italics as a yacht's name is lettered, white on a dark hull and black on a light one:
// its material, for a decal 8 times as wide as it's high
export function nameMaterial(look) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d'), dark = new THREE.Color(look.hull).getHSL({}).l < 0.45;
  x.fillStyle = dark ? '#f4f4f0' : '#15181c'; x.font = 'italic 800 92px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(look.name, 512, 66, 1000);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
}

// ---------- the logo ----------
// the club's logo (the white RYC pennant on a red square, public/images/ryc-badge.svg) or the player's own picture
// (a data: URL from the boat page), each drawn as it is
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

// the ad on every boat's jib, as the site's admin sets it (/admin, which /sponsor serves): asked for once a page, then
// the picture itself (from Supabase Storage, so loaded for CORS: a tainted canvas can't go to the GPU). None, no ad.
let adPromise = null;
function jibAd() {
  if (!adPromise) adPromise = sponsor()
    .then((d) => (d && typeof d.jib === 'string' ? new Promise((res, rej) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => res(img); img.onerror = rej; img.src = d.jib; }) : null))
    .catch(() => null);
  return adPromise;
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
// a canvas texture for a sail; u runs luff → leech, v foot → head
// rig: another class's sails (boats3d.js) — the main's luff (span, m) and its chord up it, where the logo and the flag
// go on it (m up the luff) and how wide, where the number goes (0 the foot … 1 the head), and the jib's head and clew
// from its tack with the ad's box; this boat's own when left out
export function sailTexture(kind, look, rig = null) {
  const R = rig || RIG();
  const W = 512, H = kind === 'main' ? 1024 : kind === 'jib' ? 1536 : 512; // the jib tall enough for the ad on it to read
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let sideB = null; // the jib's back face, when it needs a canvas of its own
  if (kind === 'kite') {
    const cols = look.kite; // horizontal panels in the boat's colours
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(0, (i * H) / 8, W, H / 8 + 1); }
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2;
    for (let i = 1; i < 12; i++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(W, (i * H) / 12); x.stroke(); } // radial seams from the head
  } else {
    x.fillStyle = look.cloth; x.fillRect(0, 0, W, H);
    // draws in metres on the cloth: clothAt(luff length, chord at f, where across the chord) gives onCloth(m, draw),
    // draw() centred m metres up the luff with the canvas scaled by the chord there, so a mark keeps its shape however
    // much the sail has narrowed
    const clothAt = (span, chordAt, u) => (m, draw) => {
      const f = m / span;
      x.save(); x.translate(W * u, H * (1 - f)); x.scale(W / chordAt(f), H / span); draw(); x.restore();
      t.needsUpdate = true; // the clone on the other side shares the canvas
    };
    // the country flag, its full SAIL_MARK m wide and 3:2, centred m metres up the luff and z metres aft of it: drawn a
    // row of the canvas at a time, each row scaled by the chord there, so it comes out an upright rectangle on the sail
    // (not narrowing as the sail does), with an edge for a white flag on white cloth
    const flagAt = (m, z) => logoImage(look.flag).then((img) => {
      if (!img) return;
      const w = R.mark, h = w / 1.5, iw = 300, ih = 200;
      const fc = document.createElement('canvas'); fc.width = iw; fc.height = ih; // the flag at a size to slice (an SVG may have none)
      fc.getContext('2d').drawImage(img, 0, 0, iw, ih);
      const j0 = Math.round(H * (1 - (m + h / 2) / R.span)), j1 = Math.round(H * (1 - (m - h / 2) / R.span));
      for (let j = j0 - 1; j <= j1; j++) {
        const f = 1 - (j + 0.5) / H, k = W / R.chord(f), x0 = (z - w / 2) * k, x1 = (z + w / 2) * k, edge = j < j0 || j === j1;
        x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(x0 - 1, j, x1 - x0 + 2, 1);
        if (!edge) x.drawImage(fc, 0, ((j - j0) / (j1 - j0)) * ih, iw, ih / (j1 - j0), x0, j, x1 - x0, 1);
      }
      t.needsUpdate = true;
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
      // battens: the top two full length, the rest from the leech
      x.fillStyle = look.batten;
      [[0.9, 1], [0.76, 1], [0.6, 0.45], [0.42, 0.4], [0.24, 0.35]].forEach(([v, len]) => x.fillRect(W * (1 - len), H * (1 - v) - 5, W * len, 10));
      // the sail number (and on our boat the RYC logo above it), squashed to come out the right shape on the sail
      x.save(); x.translate(W * 0.47, H * (1 - R.numAt)); x.scale(1, 0.44 * R.numK);
      x.fillStyle = look.ink; x.font = '900 128px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (look.logo) x.fillText(look.num, 0, 120);
      else { x.fillText(look.nat, 0, -82); x.fillText(look.num, 0, 70); }
      x.restore();
      // the logo and the country flag above it, the same width on the cloth (SAIL_MARK m), evenly spaced between the
      // number and the top batten. Where the head is too narrow for the flag it comes down to where it fits, and the
      // logo with it, kept a third of the flag's width below it
      const onCloth = clothAt(R.span, R.chord, 0.47);
      const [fm, fz] = flagPlace(R.flagM), logoM = look.flag ? Math.min(R.logoM, fm - R.mark / 3 - R.mark * (0.5 + 1 / 3)) : R.logoM;
      if (look.logo) logoImage(look.logo).then((img) => img && onCloth(logoM, () => drawContain(x, img, 0, 0, R.mark, R.mark))); // a wide logo fills the width, a square one is SAIL_MARK square
      if (look.flag) flagAt(fm, fz);
    } else {
      x.fillStyle = look.batten; x.fillRect(W * 0.7, H * 0.35, W * 0.3, 16); x.fillRect(W * 0.6, H * 0.6, W * 0.4, 16);
      // the ad, low on the jib under the battens, at most JIB_AD wide and JIB_AD_H tall. The cloth maps (u along the
      // chord, f up the luff) to P = head·f + clew·(1 − f)·u in the sail's plane, a grid sheared by the raked luff and
      // tapering to the head: the canvas is set to that map's inverse at the ad's middle (f0 up, about halfway along), so the
      // logo stands upright, level with the deck, and comes out its own shape on the sail.
      // The back face reads the canvas mirrored (u → 1 − u), which would turn the shear the wrong way and lean the ad: it
      // gets a canvas of its own (t.back, the cloth as drawn so far), the ad on it drawn with the shear the other way round.
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H; cb.getContext('2d').drawImage(c, 0, 0);
      const tb = new THREE.CanvasTexture(cb);
      jibAd().then((img) => {
        if (!img) return;
        const f0 = 0.25, u0 = 0.52, hd = R.hd, CL = R.clew;
        const a = CL.z * (1 - f0), b = CL.y * (1 - f0), cc = hd.z - CL.z * u0, d = hd.y - CL.y * u0, det = a * d - b * cc;
        for (const [ctx, s] of [[x, 1], [cb.getContext('2d'), -1]]) {
          ctx.save(); ctx.translate(W * (s > 0 ? u0 : 1 - u0), H * (1 - f0)); ctx.transform((W * d) / det, (s * H * b) / det, (s * W * cc) / det, (H * a) / det, 0, 0);
          drawContain(ctx, img, 0, 0, R.ad, R.adH);
          ctx.restore();
        }
        t.needsUpdate = true; tb.needsUpdate = true;
      });
      sideB = tb;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  if (sideB) { sideB.colorSpace = t.colorSpace; sideB.anisotropy = t.anisotropy; sideB.wrapS = t.wrapS; t.back = sideB; }
  return t;
}
// the cloth's relief, as a normal map: the panel seams (raised where two panels overlap and are stitched), the
// batten pockets, and soft wrinkles fanning from the clew and the head; a spinnaker's seams run out from its head.
// Drawn as a height field with the sail texture's own layout, then turned into normals.
const RELIEF = {};
function sailRelief(kind) {
  if (RELIEF[kind]) return RELIEF[kind];
  const W = 256, H = kind === 'main' ? 512 : kind === 'jib' ? 384 : 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  const line = (x0, y0, x1, y1, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  if (kind === 'kite') {
    for (let i = 1; i < 8; i++) line(0, (i * H) / 8, W, (i * H) / 8, 2.5, 'rgba(255,255,255,.55)');
    for (let i = 1; i < 12; i++) line(0, 0, W, (i * H) / 12, 2, 'rgba(255,255,255,.45)');
    for (let i = 0; i < 9; i++) line(W * (0.15 + i * 0.09), H, W * (0.05 + i * 0.1), H * 0.55, 7, 'rgba(0,0,0,.08)'); // the foot's soft folds
  } else {
    for (let i = 1; i < 10; i++) line(0, (i * H) / 10 + 10, W, (i * H) / 10 - 15, 3, 'rgba(255,255,255,.6)');
    for (let i = 0; i < 7; i++) line(W - 3, H - 3, W * (0.6 - i * 0.06), H * (0.84 - i * 0.06), 6, `rgba(0,0,0,${0.1 - i * 0.008})`); // from the clew
    for (let i = 0; i < 5; i++) line(W * 0.04, 3, W * (0.2 + i * 0.06), H * (0.1 + i * 0.025), 4, 'rgba(0,0,0,.08)'); // from the head
    x.fillStyle = 'rgba(255,255,255,.7)';
    if (kind === 'main') [[0.9, 1], [0.76, 1], [0.6, 0.45], [0.42, 0.4], [0.24, 0.35]].forEach(([v, len]) => x.fillRect(W * (1 - len), H * (1 - v) - 3, W * len, 6));
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
  return (RELIEF[kind] = t);
}
// the sun through the cloth: lit from behind as you look at it, a sail glows with the light it lets through, tinted
// by the cloth and darker where the seams, battens and number are (the colour squared: light crossing a dye)
function translucent(m, amount) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
      reflectedLight.directDiffuse += diffuseColor.rgb * diffuseColor.rgb * directionalLights[0].color * max(-dot(normal, directionalLights[0].direction), 0.0) * ${amount.toFixed(2)};
#endif`);
  };
  m.customProgramCacheKey = () => `sail${amount}`;
  return m;
}
// a sail: one grid geometry, drawn twice so the number reads the right way round from both sides
export function sailMesh(rows, cols, tex, shiny = false, kind = 'main') {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((rows + 1) * (cols + 1) * 3), uv = [], idx = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) uv.push(j / cols, i / rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const back = tex.back || tex.clone(); back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
  const relief = sailRelief(kind), reliefBack = relief.clone(); reliefBack.repeat.x = -1; reliefBack.offset.x = 1; reliefBack.needsUpdate = true;
  // laminate (shiny) sails catch a soft sheen and let less light through than woven cloth; a spinnaker's thin nylon
  // the most. A little emissive stands for the light bounced off the sea into the cloth's shaded side.
  const mat = (map, nmap, side) => translucent(new THREE.MeshStandardMaterial({
    map, side, normalMap: nmap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: shiny ? 0.45 : 0.72, metalness: shiny ? 0.12 : 0,
    emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.1,
  }), kind === 'kite' ? 0.6 : shiny ? 0.28 : 0.45);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, mat(tex, relief, THREE.FrontSide)), new THREE.Mesh(g, mat(back, reliefBack, THREE.BackSide)));
  grp.userData = { rows, cols, g };
  return grp;
}
// the leech never stands quite still: the cloth's free edge flutters in the apparent wind (aws, knots) a few
// centimetres either way, more the harder it blows; the sideways offset at (f up the luff, u along the chord)
export function leechFlutter(f, u, t, aws) {
  const w = THREE.MathUtils.smoothstep(u, 0.72, 1);
  return w * w * (0.01 + 0.0025 * aws) * Math.sin(t * (19 + aws * 0.4) + f * 13) * (0.6 + 0.4 * Math.sin(t * 3.1 + f * 5));
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
  c.back = (1 - off) * clamp((ease - 3) / 10, 0, 1);
  const mainLuff = a < NO_GO ? 1 : b.trimErr === undefined ? b.luff || 0 : clamp((b.trimErr - ease - 5) / 18, 0, 1);
  const to = (x, want) => x + (want - x) * (1 - Math.exp(-dt * (want > x ? 7 : 2.5)));
  c.flogM = to(c.flogM, mainLuff); c.flogJ = to(c.flogJ, b.luff || 0);
  c.curl = clamp(0.1 + 0.22 * Math.max(0, Math.sin(t * 0.8 + c.ph)) ** 3 + 0.75 * (b.kiteCollapse || 0) + 0.6 * smoothstep(0.2, 0.8, b.luff || 0), 0, 1);
  c.aws = aws;
  return c;
}
// the cloth's sideways offset at (f up the luff, u aft along the chord) when it isn't drawing: k how hard it flaps
// (0–1), chord the sail's width there, s the side the boom is on. A sail just luffing lifts — a bubble backed behind
// the luff; with the wind right along it, it flogs: waves run aft from the luff, growing to the leech, quicker and
// harder the more it blows
export function flog(f, u, t, k, chord, aws, s, ph = 0) {
  if (k < 0.005) return 0;
  const bubble = s * Math.min(k * 3, 1) * (1 - smoothstep(0.35, 0.95, k)) * chord * 0.05 * Math.sin(Math.PI * Math.min(u / 0.45, 1));
  const w = 2 * Math.PI * (1.5 + 0.07 * Math.min(aws, 30)), q = smoothstep(0.25, 0.85, k);
  const amp = chord * (0.07 + 0.004 * Math.min(aws, 25)) * q * u ** 1.15 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(f * 1.15, 1)));
  return bubble + amp * (Math.sin(w * t - 6.5 * u - 2.2 * f + ph) + 0.45 * Math.sin(1.7 * w * t - 11 * u + 3.1 * f + 2 * ph));
}
// a main's cloth beyond its cut: flogging, and backed behind the luff when she's overpowered (s: the boom's side)
export const mainCloth = (c, f, u, t, chord, s) => flog(f, u, t, c.flogM, chord, c.aws, s, c.ph) + s * c.back * chord * 0.045 * Math.sin(Math.PI * Math.min(u / 0.35, 1)) * Math.sin(Math.PI * (0.15 + 0.7 * f));
// the gennaker's luff folding in (0–1 of its curl, at f up the luff and u aft): times the sail's size, towards the boat
export const kiteCurl = (c, f, u) => c.curl * (1 - smoothstep(0, 0.3, u)) ** 2 * Math.sin(Math.PI * Math.min(1, f * 1.1));
export function setSail(m, fn) {
  const { rows, cols, g } = m.userData, a = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { fn(i / rows, j / cols, v); a.setXYZ(i * (cols + 1) + j, v.x, v.y, v.z); }
  a.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
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
  player: { hull: '#1c1f24', stripe: '#1c1f24', cloth: '#2a2c30', laminate: true, tape: '#1e1f22', batten: '#1d1f22', ink: '#ffffff', nat: 'RYC', num: '1', logo: true, kite: ['#1c1f24'], crew: '#1c1f24', pants: '#1c1f24' }, // all black, the sail number white (lib/boat.ts DEFAULT_BOAT)
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
// sails, the gennaker (up to three) and the crew, the bottom paint, the deck, her name, the sail number, the logo and the flag. lookFrom turns it into a look; anything missing or
// malformed keeps the default boat's (all black).
export const BOAT_KEY = 'regatta-boat';
const DEFAULT_LOGO = '/images/ryc-rentals-bot.png';
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
  if (typeof b.num === 'string' && b.num.trim()) L.num = b.num.trim().slice(0, 3);
  if (typeof b.nat === 'string' && b.nat.trim()) L.nat = b.nat.trim().toUpperCase().slice(0, 3);
  const own = typeof b.logoImg === 'string' && b.logoImg.startsWith('data:image/') ? b.logoImg : DEFAULT_LOGO; // 'Yours' before an upload: the RYC Rentals Bot badge
  L.logo = b.logo === 'none' ? false : b.logo === 'custom' ? own : true;
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
// an inflatable lifejacket over the shoulders with its belt, sailing gloves, sea boots with white soles, sunglasses and
// a cap (or a helmet). The boat turns each one about y and mirrors those on the port side.
const THIGH = 0.44, SHIN = 0.44;
export { THIGH, SHIN };
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
const ELBOW = 1.15; // the forearm bent forward
// lo: the plain figure for far off (fewer sides to every part, and no ears, lips, brows, frames, knuckles or button)
function crewParts(lo) {
  const S = (n) => (lo ? Math.max(4, Math.round(n / 2)) : n), hi = (g) => (lo ? null : g);
  // the legs hang from the hip joint: the thigh broad at the top and lean at the knee, the shin with its calf behind,
  // and a sea boot to mid-calf (a low deck shoe under shorts) on a sole with a heel and a rounded toe
  const thigh = loft([[0.06, 0, 0, 0, -0.01], [0.04, 0.078, 0.076, 0.088], [-0.02, 0.096, 0.095, 0.1], [-0.14, 0.092, 0.097, 0.088], [-0.27, 0.078, 0.085, 0.074], [-0.38, 0.063, 0.068, 0.06], [-0.45, 0.057, 0.06, 0.053], [-0.48, 0, 0, 0]], S(12));
  const knee = new THREE.SphereGeometry(0.056, S(10), S(7)).scale(1.08, 1, 0.98);
  const shin = loft([[0.02, 0, 0, 0], [0, 0.053, 0.055, 0.052], [-0.08, 0.057, 0.052, 0.076], [-0.16, 0.055, 0.048, 0.072], [-0.27, 0.045, 0.042, 0.05], [-0.38, 0.036, 0.037, 0.038], [-0.45, 0.036, 0.037, 0.038], [-0.47, 0, 0, 0]], S(10));
  const footGeo = loft([[-0.075, 0, 0, 0], [-0.065, 0.036, 0.03, 0.05], [-0.035, 0.046, 0.034, 0.064], [0.03, 0.05, 0.034, 0.054], [0.11, 0.054, 0.034, 0.036], [0.18, 0.048, 0.032, 0.025], [0.21, 0.034, 0.028, 0.016], [0.222, 0, 0, 0, -0.008]], S(10))
    .rotateZ(-Math.PI / 2).translate(0, -SHIN - 0.035, 0);
  const boot = mergeGeometries([footGeo, loft([[-SHIN - 0.04, 0.046, 0.046, 0.05], [-SHIN + 0.04, 0.043, 0.044, 0.048], [-0.28, 0.05, 0.05, 0.06], [-0.268, 0.052, 0.052, 0.062]], S(10))]);
  const shoe = mergeGeometries([footGeo, loft([[-SHIN - 0.04, 0.044, 0.044, 0.048], [-SHIN, 0.04, 0.042, 0.044], [-SHIN + 0.012, 0.039, 0.04, 0.042]], S(10))]);
  const sole = new THREE.BoxGeometry(0.3, 0.022, 0.1).translate(0.07, -SHIN - 0.064, 0);
  // the pelvis on the body (it stays as the body leans): the seat behind, the hips either side
  const pelvis = loft([[-0.03, 0, 0, 0, -0.01], [-0.01, 0.12, 0.06, 0.09], [0.03, 0.165, 0.085, 0.115], [0.09, 0.168, 0.095, 0.11], [0.15, 0.16, 0.1, 0.105]], S(16));
  // the torso in its jacket: hem, waist, the chest deeper and broader, the shoulders sloping in to a high collar
  const torso = loft([[0.03, 0, 0, 0], [0.04, 0.155, 0.1, 0.105], [0.08, 0.172, 0.112, 0.118], [0.17, 0.164, 0.112, 0.11], [0.27, 0.172, 0.124, 0.112], [0.36, 0.186, 0.134, 0.114], [0.42, 0.194, 0.126, 0.112], [0.465, 0.2, 0.11, 0.1], [0.5, 0.17, 0.088, 0.084], [0.525, 0.115, 0.074, 0.07], [0.545, 0.08, 0.068, 0.066], [0.6, 0.067, 0.064, 0.062], [0.6, 0, 0, 0]], S(16), 2.3);
  // the lifejacket: an inflatable's two lobes down the chest, over the shoulders and round the back of the neck, and
  // its waist belt with the buckle in front
  const yoke = new THREE.CatmullRomCurve3([[0.12, 0.22, 0.07], [0.14, 0.34, 0.082], [0.112, 0.45, 0.1], [0.035, 0.515, 0.112], [-0.055, 0.52, 0.094], [-0.082, 0.54, 0.04], [-0.082, 0.54, -0.04], [-0.055, 0.52, -0.094], [0.035, 0.515, -0.112], [0.112, 0.45, -0.1], [0.14, 0.34, -0.082], [0.12, 0.22, -0.07]].map((v) => new THREE.Vector3(...v)));
  const vest = mergeGeometries([
    sweep(yoke, S(40), 0.033, 0.017, new THREE.Vector3(0, 0.34, 0), S(8)),
    loft([[0.118, 0.17, 0.116, 0.118], [0.146, 0.172, 0.118, 0.12]], S(18), 2.3),
    new THREE.BoxGeometry(0.03, 0.045, 0.06).translate(0.122, 0.132, 0),
  ]);
  // arms from the shoulder joint: the deltoid, the upper arm to the elbow, the forearm bent forward to the cuff
  const upperArm = loft([[0.04, 0, 0, 0, -0.004], [0.028, 0.04, 0.042, 0.044], [0.004, 0.056, 0.056, 0.056], [-0.06, 0.054, 0.056, 0.052], [-0.16, 0.047, 0.051, 0.045], [-0.25, 0.043, 0.045, 0.043], [-0.29, 0, 0, 0]], S(10));
  const elbowJ = new THREE.SphereGeometry(0.045, S(8), S(6)).translate(0, -0.27, 0);
  const bend = (g) => g.rotateZ(ELBOW).translate(0, -0.27, 0);
  const forearm = bend(loft([[0.02, 0, 0, 0], [0, 0.044, 0.046, 0.044], [-0.07, 0.046, 0.05, 0.046], [-0.16, 0.038, 0.04, 0.036], [-0.2, 0.04, 0.042, 0.04], [-0.225, 0.042, 0.044, 0.042], [-0.23, 0, 0, 0]], S(10)));
  // a gloved hand gripping: flat across (the palm faces in), the fingers curled into a fist, the thumb forward
  const hand = bend(mergeGeometries([
    loft([[-0.2, 0.026, 0.028, 0.028], [-0.24, 0.024, 0.042, 0.036], [-0.28, 0.024, 0.046, 0.032, 0.004], [-0.31, 0.02, 0.036, 0.026, 0.008], [-0.325, 0, 0, 0, 0.012]], S(10)),
    ...(lo ? [] : [
      new THREE.CapsuleGeometry(0.012, 0.03, 2, 6).rotateZ(0.9).translate(0.04, -0.255, 0),
      ...[-0.016, 0.002, 0.019, 0.034].map((x, i) => new THREE.SphereGeometry(0.0125, 6, 4).translate(x, -0.304 + Math.abs(i - 1.5) * 0.004, 0)), // the knuckles of the fingers curled round
    ]),
  ]));
  // the neck and the head: jaw and chin, cheekbones, brow, the back of the skull; a nose, ears
  const neck = loft([[0.5, 0.054, 0.054, 0.054], [0.58, 0.052, 0.05, 0.055, -0.005], [0.635, 0.054, 0.05, 0.056, -0.008]], S(10));
  const HEAD_RINGS = [[0.592, 0, 0, 0, 0.055], [0.598, 0.036, 0.028, 0.022, 0.05], [0.614, 0.064, 0.055, 0.054, 0.028], [0.64, 0.073, 0.072, 0.074, 0.012], [0.67, 0.075, 0.087, 0.09, 0.004], [0.705, 0.078, 0.09, 0.095], [0.745, 0.075, 0.084, 0.094, -0.004], [0.773, 0.062, 0.066, 0.08, -0.008], [0.792, 0.036, 0.036, 0.048, -0.01], [0.798, 0, 0, 0, -0.012]];
  const head = mergeGeometries([
    loft(HEAD_RINGS, S(14), 2.15),
    loft([[0.703, 0.008, 0.004, 0.006, 0.088], [0.688, 0.01, 0.009, 0.008, 0.088], [0.672, 0.013, 0.015, 0.008, 0.087], [0.661, 0.016, 0.017, 0.01, 0.087], [0.655, 0.012, 0.01, 0.01, 0.088], [0.652, 0, 0, 0, 0.088]], S(8)), // the nose
    ...(lo ? [] : [1, -1]).map((sz) => new THREE.SphereGeometry(1, 8, 6).scale(0.012, 0.022, 0.0065).rotateX(sz * 0.22).rotateZ(0.12).translate(-0.006, 0.682, sz * 0.077)), // the ears
  ]);
  // the hair hugs the skull: down to the nape behind, up and over the ears, a sideburn in front of each, and the
  // hairline at the temples; above it all goes under the cap
  const hair = shell(HEAD_RINGS, 2.15, 1.34, Math.PI * 2 - 1.34, (a) => {
    const d = Math.min(a, Math.PI * 2 - a); // how far round from the face
    if (d < 1.46) return 0.672; // the sideburn
    if (d < 1.78) return 0.703; // over the ear
    return THREE.MathUtils.lerp(0.69, 0.646, THREE.MathUtils.smoothstep(d, 1.78, Math.PI)); // down to the nape
  }, 0.762, 0.0035, S(32), S(6));
  // a short, trimmed beard on the jaw and the chin (its back inside the neck), and the mouth
  const beard = loft([[0.59, 0, 0, 0, 0.055], [0.596, 0.038, 0.03, 0.022, 0.05], [0.613, 0.066, 0.058, 0.03, 0.029], [0.632, 0.075, 0.074, 0.03, 0.013], [0.645, 0.076, 0.08, 0.03, 0.009]], S(14), 2.15);
  const mouth = hi(new THREE.SphereGeometry(1, 10, 4).scale(0.004, 0.0028, 0.016).translate(0.0828, 0.637, 0));
  // the eyebrows, just showing between the glasses and the cap
  const brows = hi(mergeGeometries([1, -1].map((sz) => new THREE.CapsuleGeometry(0.0035, 0.024, 2, 4).rotateX(Math.PI / 2 + sz * 0.15).translate(0.0875, 0.72, sz * 0.031))));
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
  // a cap: the crown, its brim curved down at the sides and sloping down in front (a top and an underside joined at
  // the edge), and the button on top
  const brim = (() => {
    const pos = [], uv = [], idx = [], NA = S(20), NR = lo ? 2 : 3, T = 0.005, SPAN = 1.2;
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
  })();
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
  return { thigh, knee, shin, boot, shoe, sole, pelvis, torso, vest, upperArm, elbowJ, forearm, hand, neck, head, hair, beard, mouth, brows, LENSES, frame, cap, helmet };
}
const SAILOR = crewParts(false), SAILOR_LO = crewParts(true);
// A sailor is one draw (skin.js): the joints (body, upper body, hips, knees, arms) are bones. The parts' colours ride
// on the vertices, each from the material it was given, so all the sailors in the race share this one.
const CREW_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const SAILOR_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0.4, 0), 1.6); // round every pose, seated to standing
// no two sailors alike, even in team kit: the jacket a little more or less faded, a white cap or a dark one, the
// lifejacket's colour, the hair (a beard on some), gloves or bare hands, a broader or a slighter build, and where it is
// warm (within 42° of the equator) some of them in shorts and deck shoes
const HAIR = ['#2a1d15', '#5b3b24', '#1b1714', '#8d6a3f', '#7d7870', '#3d2a1c', '#b48a52'].map((c) => ({ color: new THREE.Color(c) }));
const GLOVE = { color: new THREE.Color('#2a2c31') }, BOOT = { color: new THREE.Color('#25272c') }, SOLE = { color: new THREE.Color('#dedbd3') };
let SAILORS = 0;
const WARM = Math.abs(VENUE.lat) < 42;
export function sailor(m) {
  const n = SAILORS++, col = (mat) => mat.color;
  const jacket = { color: m.jacket.color.clone().offsetHSL(0, 0, (((n * 37) % 7) - 3) * 0.014) };
  const shorts = WARM && n % 3 === 1, shins = shorts ? m.skin : m.trousers;
  const vest = n % 2 ? { color: new THREE.Color('#2f3a48') } : m.vest;
  const cap = !m.helmet && n % 4 === 2 ? { color: new THREE.Color(m.cap.color.getHSL({}).l > 0.5 ? '#22262c' : '#efeee9') } : m.cap;
  const frameCol = [M.dark.color, new THREE.Color('#e9e8e4'), m.cap.color][(n * 7) % 3], hair = HAIR[(n * 3) % HAIR.length], hands = n % 5 === 3 ? m.skin : GLOVE, build = 1 + ((((n * 53) % 5) - 2) * 0.035);
  m = { ...m, jacket, vest, cap };
  const g = new THREE.Group(), body = new THREE.Bone(), upper = new THREE.Bone();
  body.add(upper);
  const legs = [-1, 1].map((sz) => {
    const hip = new THREE.Bone(), knee = new THREE.Bone();
    hip.position.set(0, 0.07, sz * 0.095 * build); knee.position.y = -THIGH; hip.add(knee); body.add(hip);
    return { hip, knee };
  });
  const arms = [-1, 1].map((sz) => {
    const a = new THREE.Bone(); a.position.set(0, 0.47, sz * 0.2 * build); a.rotation.x = -sz * 0.12; upper.add(a);
    return a;
  });
  const bones = [body, upper, ...legs.flatMap((l) => [l.hip, l.knee]), ...arms];
  // the joints bend as one surface: near a joint a part follows the bone across it too, half at the joint itself and
  // all of it d beyond (t: how far past the joint, along the part). The waist bends between the hips and the chest as
  // she leans, and the top of the arm stays with the shoulder as the arm swings. The top of the thigh, inside the
  // pelvis, goes with the pelvis (blended below the joint it would dent the front of the hip); the knees stay rigid,
  // their round caps already filling the bend however far it goes
  const joint = (t, d) => 0.5 + 0.5 * Math.sign(t) * THREE.MathUtils.smoothstep(Math.abs(t), 0, d);
  const waist = () => (x, y) => [[body, joint(0.12 - y, 0.12)]];
  const thighBlend = () => (x, y) => [[body, y > 0 ? THREE.MathUtils.smoothstep(y, 0, 0.05) : 0]];
  const shoulder = () => (x, y) => [[upper, joint(y + 0.02, 0.14)]];
  const wide = (geo) => geo.clone().scale(1, 1, build); // a broader or a slighter build: wider across, not taller
  const mouth = m.skin.color.clone().offsetHSL(-0.02, 0.08, -0.26);
  // the parts of a figure: [geometry, its bone, the material it would have had (or a colour), how it bends]
  const dress = (P) => [
    [wide(P.pelvis), body, m.trousers],
    ...legs.flatMap((l) => [[P.thigh, l.hip, m.trousers, thighBlend()], [P.knee, l.knee, m.trousers], [P.shin, l.knee, shins], [shorts ? P.shoe : P.boot, l.knee, BOOT], [P.sole, l.knee, SOLE]]),
    [wide(P.torso), upper, m.jacket, waist()], [wide(P.vest), upper, m.vest, waist()], [P.neck, upper, m.skin], [P.head, upper, m.skin], [P.hair, upper, hair],
    [P.brows, upper, hair], [P.mouth, upper, mouth], [m.helmet ? P.helmet : P.cap, upper, m.cap], [P.LENSES[(n * 5) % 3], upper, null], [P.frame, upper, frameCol],
    ...(n % 5 === 1 ? [[P.beard, upper, hair]] : []),
    ...arms.flatMap((a) => [[P.upperArm, a, m.jacket, shoulder()], [P.elbowJ, a, m.jacket], [P.forearm, a, m.jacket], [P.hand, a, hands]]),
  ].filter(([geo]) => geo).map(([geo, bone, mat, blend]) => [geo, bone, mat && (mat.isColor ? mat : col(mat)), blend]);
  // both figures ride the same bones; level() shows one: 2 the full figure, 1 the plain one, 0 neither
  const mesh = rigidSkin(dress(SAILOR), bones, body, CREW_MAT, SAILOR_SPHERE), lo = rigidSkin(dress(SAILOR_LO), bones, body, CREW_MAT, SAILOR_SPHERE);
  for (const x of [mesh, lo]) x.userData.detail = false; // the boat hides them far off itself (crewLevel), not with the fittings
  lo.visible = false;
  g.add(mesh, lo);
  const level = (l) => { mesh.visible = l === 2; lo.visible = l === 1; };
  return { g, body, upper, legs, arms, mesh, lo, level };
}

// which figure a boat's crew show: none far off (with the small fittings), the plain ones beyond near, the full ones close
function crewLevel(v) {
  const l = v.detailOn === false ? 0 : v.crewNear === false ? 1 : 2;
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
// (the cloth runs from BOOM_Y + 0.08 to MASTHEAD − 0.3), and the width of the logo and the flag on it, in metres
const mainChord = (f) => lerp(4.75, 1.4, f) + 0.45 * Math.sin(Math.PI * f);
const MAIN_SPAN = MASTHEAD - 0.3 - BOOM_Y, SAIL_MARK = 1.5;
// the forestay comes down to the deck 0.6 m aft of the stem, at the inboard end of the bowsprit's plate (the deck plan)
const TACK_Z = BOW_Z + 0.6, TACK = new THREE.Vector3(0, deckY(TACK_Z) + 0.05 + 0.06, TACK_Z);
const HEAD = new THREE.Vector3(...raked(0, HOUNDS - 0.3, MAST_Z - 0.12));
// the jib's clew from the tack (the foot), and the box the ad on the jib fits in, in metres
// (a 106% genoa of 31 m²: its clew 0.6 m aft of the mast)
const JIB_CLEW = new THREE.Vector3(0, 0.42, 4.75), JIB_AD = 2, JIB_AD_H = 1;
const SPRIT = new THREE.Vector3(0, sheerAt(1) + 0.12, BOW_Z - 1.1); // the fixed bowsprit's end, 1.1 m out (the deck plan)
const KITE_HEAD = raked(0, MASTHEAD - 0.4, MAST_Z - 0.15); // the gennaker's halyard, just under the masthead
const GTRACK = [[1.0, 0.75], [1.45, 0.5]]; // the transverse genoa tracks on the side decks, inboard end to outboard, just aft of the clew
const GCAR = 0.55; // where the car sits along its track
const gcar = (sx) => { const [[x0, z0], [x1, z1]] = GTRACK; return [sx * lerp(x0, x1, GCAR), lerp(z0, z1, GCAR)]; };
const PRIMARY = [1.22, 2.82]; // the jib sheets' winches (ST46), on the side decks abreast the front of the cockpit
const BACKSTAY_W = [1.4, 3.74]; // the backstays' winches (ST40), aft of the primaries at the helm's hand
// this boat's sails, as sailTexture lays out the marks on them (numAt, numK: the number's height up the main and its size)
const RIG = () => ({ span: MAIN_SPAN, chord: mainChord, logoM: 9.8, flagM: 11.56, mark: SAIL_MARK, numAt: 0.64, numK: 1, hd: HEAD.clone().sub(TACK), clew: JIB_CLEW, ad: JIB_AD, adH: JIB_AD_H });

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
    add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.86, 0.04), M.glass), 0, FLOOR + 0.5, CR_ZA + 0.01);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.96, 0.03), M.alu), 0, FLOOR + 0.5, CR_ZA + 0.002);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.7), M.glass), 0, gy(1.62) + 0.035, 1.62);
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
    T.add(line([hounds, [TACK.x, TACK.y, TACK.z]]));
    // twin backstays from the crane to the quarters, each led forward from a block on the deck to its own winch by the helm
    for (const sx of [-1, 1]) {
      const bs = [sx * (halfBeam(0.02) - 0.14), sheerAt(0.02) + 0.05, STERN_Z - 0.25];
      T.add(line([crane, bs]));
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
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
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
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.hullSea = hullSea(this, L / 2);
    this.bake();
  }

  // The fittings that never move (hull, deck gear, rails, stanchions, rig, standing rigging) are ~150 small parts, each
  // its own draw — in the view, the sea's reflection and the sun's shadow. Merged per material (and per detail level,
  // so setDetail still hides the small ones far off), a boat costs a dozen draws instead.
  bake() {
    const moving = new Set([this.travCar, this.wheel, ...(this.rudders || []).map((r) => r.kick), this.sprit, this.mainRake, this.mainPivot, this.jibPivot, this.kite, this.windex,
      this.mainsheet, this.jibSheet, this.lazySheet, this.kiteSheet, ...this.crew.map((c) => c.g)]);
    const sets = new Map();
    for (const o of this.tilt.children) {
      if (moving.has(o) || o.children.length || !(o.isMesh || o.isLine) || Array.isArray(o.material)) continue;
      o.updateMatrix();
      if (o.matrix.determinant() < 0) continue; // mirrored: its faces would turn inside out
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const small = o.isLine || g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < 0.9; // as setDetail
      const attrs = Object.keys(g.attributes).sort().join();
      const key = [o.isLine ? 'L' : 'M', o.material.uuid, small, o.castShadow, o.renderOrder, attrs, !!g.index].join('|');
      if (!sets.has(key)) sets.set(key, { list: [], small, line: o.isLine, mat: o.material, cast: o.castShadow, order: o.renderOrder });
      sets.get(key).list.push(o);
    }
    for (const s of sets.values()) {
      if (s.list.length < 2) continue;
      const geos = s.list.map((o) => {
        let g = o.geometry.clone().applyMatrix4(o.matrix);
        if (s.line) { // a strip of points → its segments, so many lines can be one LineSegments
          const p = g.attributes.position, idx = [];
          for (let i = 0; i < p.count - 1; i++) idx.push(i, i + 1);
          g.setIndex(idx);
        }
        return g;
      });
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      const m = s.line ? new THREE.LineSegments(merged, s.mat) : new THREE.Mesh(merged, s.mat);
      m.castShadow = s.cast; m.receiveShadow = true; m.renderOrder = s.order; m.userData.detail = s.small;
      for (const o of s.list) { this.tilt.remove(o); if (!SHARED.has(o.geometry)) o.geometry.dispose(); }
      this.tilt.add(m);
    }
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
  setCrewNear(near) {
    if (this.crewNear === near) return;
    this.crewNear = near;
    crewLevel(this);
  }
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
    this.ext.rotation.set(0.35, 0, -side * 1.05); // the tiller extension, up and out to the helm's side

    const sa = b.sail * D2R, cl = clothState(this, b, t), ss = this.sailSide;
    this.mainPivot.rotation.y = -ss * sa;
    const belly = -ss * (1 - cl.flogM * 0.85), jBelly = -ss * (1 - cl.flogJ * 0.85);
    const reefDrop = (b.reefFill || 0) * 2.4; // a reef: the head comes 2.4 m down the mast, the sail is that much smaller
    // square-top main: the chord narrows up the mast to a wide head, with roach on the leech; twist opens the top
    setSail(this.main, (f, u, v) => {
      const chord = mainChord(f), tw = -ss * f * f * 0.5 * u * cl.twist;
      v.set(belly * Math.sin(Math.PI * u ** 0.78) * chord * 0.11 * cl.depth * (1 - 0.4 * f) + tw + mainCloth(cl, f, u, t, chord, ss) + leechFlutter(f, u, t, cl.aws), BOOM_Y + 0.08 + f * (MASTHEAD - 0.3 - BOOM_Y - reefDrop), u * chord);
    });
    // the mainsheet, from the block on the traveller's car to the one under the boom
    const ma = this.mainPivot.rotation.y, bz = SHEET_B;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.6, -this.travW, this.travW);
    purchase(this.mainsheet, [this.travCar.position.x, FLOOR + 0.155, SHEET_Z], raked(Math.sin(ma) * bz, BOOM_Y - 0.115, MAST_Z + Math.cos(ma) * bz));
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, 30 * D2R); // on its own sheet when the jib has one
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = HEAD.clone().sub(TACK), clew = JIB_CLEW;
    setSail(this.jib, (f, u, v) => {
      const lx = head.x * f, ly = head.y * f, lz = head.z * f;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz);
      v.set(lerp(lx, ex, u) + jBelly * Math.sin(Math.PI * u ** 0.72) * len * 0.125 * cl.depth + flog(f, u, t, cl.flogJ, len, cl.aws, ss, cl.ph + 1.3) + leechFlutter(f, u, t + 0.4, cl.aws), lerp(ly, ey, u), lerp(lz, ez, u));
    });
    // the jib sheets: from the clew to the car on the leeward side deck and on to the winch; the lazy one slack
    const cw = clew.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1;
    const js = this.jibSheet.geometry.attributes.position, lz = this.lazySheet.geometry.attributes.position;
    const [gx, gz] = gcar(ls), [lx] = gcar(-ls), wy = deckY(PRIMARY[1]) + 0.2; // through the car on the leeward track to the primary
    js.setXYZ(0, cw.x, cw.y, cw.z); js.setXYZ(1, gx, deckY(gz) + 0.16, gz); js.setXYZ(2, ls * (PRIMARY[0] - 0.05), wy, PRIMARY[1]); js.needsUpdate = true;
    lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, roofTop(0.2) + 0.15, 0.2); lz.setXYZ(2, lx, deckY(gz) + 0.16, gz); lz.setXYZ(3, -ls * (PRIMARY[0] - 0.05), wy, PRIMARY[1]); lz.needsUpdate = true;
    // the wind vane points into the apparent wind
    this.windex.rotation.y = -b.awa;
    // the crew: upwind on the windward rail, leaning out the more she heels; downwind in the cockpit, the kite trimmer
    // to leeward watching the kite; the bow goes forward for a hoist, a drop or a jib change. They cross the boat in a
    // tack or gybe over a second or two.
    const first = this.crewT === undefined, dt = clamp(t - (this.crewT ?? t), 0, 0.1); this.crewT = t; // the first time, straight to their places
    const up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!(b.kiteJob || b.jibJob || b.reefJob);
    if (this.tackSide !== side) { if (this.tackSide !== undefined) this.tackT = t; this.tackSide = side; } // when she last tacked or gybed
    const sinceTack = t - (this.tackT ?? -99);
    // the sea's own roll, which the crew's bodies take out (a sailor sits up straight while the boat rolls under her)
    const sway = first ? 0 : clamp((this.sea?.rz ?? this.tilt.rotation.z) - (this.heelZ ?? 0), -0.35, 0.35) * 0.6;
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
      else if (up) { x = cs * (hbAt(z) - 0.12); y = deckY(z) + 0.09; yaw = 0; lean = 0.12 + 0.45 * hike; knee = -1.85; reach = 0.3; } // on the rail, legs over the side, hiking out
      else { x = (c.i === 3 || (c.i === 2 && b.kite) ? -cs : cs) * 0.72; z = c.i === 3 ? 3.3 : c.z0; y = FLOOR + 0.2; } // in the cockpit on its foot braces, the kite trimmer to leeward
      const k = first ? 1 : 1 - Math.exp(-dt * 2.2);
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
      const sd = c.x >= 0 ? 1 : -1, s = c.s; // the side she's on: the port side's sailors are mirrored, so +x is always outboard
      c.g.position.set(c.x, c.y, c.z); c.g.scale.x = sd; c.g.rotation.z = -sway;
      s.body.rotation.y = c.yaw; s.body.position.y = c.stand * (THIGH + SHIN + 0.02);
      s.upper.rotation.z = -c.lean;
      for (const l of s.legs) { l.hip.rotation.z = (1 - c.stand) * Math.PI / 2; l.knee.rotation.z = (1 - c.stand) * c.knee; }
      for (const a of s.arms) a.rotation.z = c.reach;
    }
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
    const kf = b.kiteFill ?? (b.kite ? 1 : 0), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)); // half collapsed while it's gybed
    this.kite.visible = this.kiteSheet.visible = kf > 0.02; // the bowsprit is fixed: it stays
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6.2, 3.4, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [SPRIT.x, SPRIT.y + 0.1, SPRIT.z], hd = [0, lerp(SPRIT.y + 1, KITE_HEAD[1], kf), lerp(SPRIT.z, KITE_HEAD[2], kf)], cl = [sd * out, lerp(SPRIT.y + 0.4, 2.9, kf), lerp(SPRIT.z + 0.8, 1.8, kf)];
      setSail(this.kite, (f, u, v) => {
        const lx = sd * Math.sin(Math.PI * f) * 2.4 * kfill, lz = -Math.sin(Math.PI * f) * 2.6 * kfill;
        const p = [lerp(tk[0], hd[0], f) + lx, lerp(tk[1], hd[1], f), lerp(tk[2], hd[2], f) + lz];
        const q = [lerp(cl[0], hd[0], f), lerp(cl[1], hd[1], f), lerp(cl[2], hd[2], f)];
        const bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, f * 1.08)) * 2.8 * kfill;
        const cu = kiteCurl(cl, f, u) * 1.5 * kfill; // the luff folding in, aft and into the sail's hollow
        v.set(lerp(p[0], q[0], u) + sd * (bul - cu), lerp(p[1], q[1], u), lerp(p[2], q[2], u) - bul * 0.9 + cu * 0.6);
      });
      const kp = this.kiteSheet.geometry.attributes.position;
      kp.setXYZ(0, cl[0], cl[1], cl[2]); kp.setXYZ(1, sd * 1.3, deckY(4.6) + 0.1, 4.6); kp.needsUpdate = true;
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
