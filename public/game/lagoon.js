// Regatta: the other committee boat — a Lagoon 42 cruising catamaran lying to her anchor, head to wind, at the
// starboard end of the line, her mainsail stowed in its bag on the boom and her jib furled on the forestay. The race
// officers run the start from her as from the motor cruiser (committee.js), the two taking turns from race to race:
// the signal flags go up and down halyards from her lower spreaders' tips, the orange flag on a staff at the stern of
// the hull nearer the line marks her end of it, and an officer by it sights along the line to the pin.
//
// She is finished as the yachts are (yacht.js): her hulls, bridgedeck, saloon, roof, helm station, cockpit,
// trampolines and tender moulded in Blender (blender/lagoon42.py → lagoon42.glb, drawn from Lagoon's deck plan, side
// profile and photographs), the hulls under yacht.js's lacquer with the black boot-top, antifouling and the sea's wet
// line on it and the dark pinstripe along the chine, the decks moulded non-skid with the shade baked in where the
// saloon, the helm and the seats stand on them, the cockpit, the aft decks and the transom steps teak. Here: the rig
// and the stowed sails, the rails, the flags and the officers, her fittings.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './sim.js';
import { hullMaterial, NONSKID, canvasTex, cleat, wheel, display, winch, block, clutches, chainplate, mastGeo, spreaderGeo, M as YM } from './yacht.js';
import { CommitteeBoat, flagTexture, bannerTexture, finishes, RoundedBoxGeometry, tube, rod, Flag, officer } from './committee.js';

// ---------- her lines (blender/lagoon42.py's) ----------
const L = 12.8, ZS = 6.4, XC = 2.95;
export const LAGOON_WL = 12.3; // her hulls' waterline length
const BOTTOM = '#1e2126'; // her antifouling, black
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const tAt = (z) => clamp((ZS - z) / L, 0, 1);
const BOW0 = tAt(-2.0);
const hbD = (t) => (t <= BOW0 ? 0.84 + 0.02 * sstep(0, 0.2, t) : 0.86 * Math.max(0, 1 - ((t - BOW0) / (1 - BOW0)) ** 2.1) ** 0.5 + 0.006);
const sheer = (t) => 1.6 + 0.04 * t * t;
const knuckle = (t) => 0.72 + 0.16 * t; // the chine, with the dark pinstripe along it
const deckY = (z) => sheer(tAt(z));
const topsidesX = (t, y) => { // the topsides' half-breadth at height y, over the chine (blender/lagoon42.py's topsides_x)
  const v = clamp((y - knuckle(t)) / (sheer(t) - knuckle(t)), 0, 1), hb = hbD(t);
  return lerp(hb * 0.92, hb, v) + 0.02 * Math.sin(Math.PI * v) * (hb / 0.86);
};
const halfB = (z) => hbD(tAt(z)); // a hull's half-breadth at the deck, about its own centreline
const floorY = (z) => deckY(z) + 0.03; // the bridgedeck's top: the cockpit's sole, the forward deck
// the transoms: their walls raked down from the deck to the swim platform, the steps let in between them
const RAKE0 = 5.3, RAKE1 = 6.25, PLAT = 0.5;
const wallTop = (z) => (z <= RAKE0 ? deckY(z) : PLAT + (deckY(RAKE0) - PLAT) * (1 - clamp((z - RAKE0) / (RAKE1 - RAKE0), 0, 1) ** 1.6));
const stepTop = (z) => (z <= 5.34 ? deckY(z) : z <= 5.63 ? 1.24 : z <= 5.93 ? 0.88 : PLAT);
// the roof over the saloon and the cockpit: its top, sloping down forward; its plan; the gap in it over the helm
const RF_F = -2.27, RF_A = 4.9, RF_W = 2.92, RF_T = 0.2;
const roofTop = (z) => (z < 2.6 ? 3.58 - 0.53 * clamp((2.6 - z) / 4.5, 0, 1) ** 1.35 : 3.58 - 0.08 * ((z - 2.6) / 2.3) ** 2);
const CR_F = -2.0, CR_A = 1.65, CR_W = 2.62; // the saloon: its front, its aft face, its half-width
const HELM = { x0: -2.76, x1: -1.38, z0: 1.66, z1: 2.96, y: 2.5 }; // the helm station, raised to port
const HT = { x0: -3.02, x1: -1.18, z0: 1.36, z1: 3.2, y1: 4.63 }; // its hard top, clear of a helmsman standing
const BEAM_Z = -5.8, LONG_F = -6.5; // the crossbeam under the forestay; the longeron's bowsprit tip
const TD = { y: 1.2, z: 6.0, L: 2.9 }; // the tender on the davits
// the rig, from the yard's profile: the mast stepped on the roof near her middle, the forestay to the crossbeam a
// little aft of the bows, the boom over the roof to its aft end
const MZ = 0.2, MFOOT = roofTop(MZ), MTOP = 19.85, HOUNDS = 17.3;
const SPR1 = { y: 9.2, w: 1.5, aft: 0.3 }, SPR2 = { y: 13.9, w: 1.0, aft: 0.22 }; // the spreaders: height, half-span, sweep
const bz0 = MZ + 0.2, bz1 = 4.95, by0 = 4.6, by1 = 5.1; // the boom: from the gooseneck to its end over the roof's aft edge
const boomY = (z) => lerp(by0, by1, (z - bz0) / (bz1 - bz0));

// her moulded parts, by material name, by the address the import map gives the file; the hulls' paint bands and the
// plan-in-metres UVs of what takes a texture. If it doesn't come in 8 s she isn't sent out (lagoonReady false) and
// the motor cruiser runs every race.
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
const MODEL = await new Promise((res) => {
  const done = (v) => { clearTimeout(timer); res(v); }, timer = setTimeout(() => res(null), 8000);
  new GLTFLoader().load(fileAt('lagoon42.glb'), (g) => {
    const parts = {};
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) parts[o.material.name] = o.geometry.clone().applyMatrix4(o.matrixWorld); });
    const p = parts.hull?.attributes.position;
    if (!p || !parts.deck) return done(null);
    // yacht.js's hull paint draws a cove line where `band` is 0.1 - 0.135: here, along her chine, as her pinstripe
    const band = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) band[i] = 0.1175 + knuckle(tAt(p.getZ(i))) - 0.012 - p.getY(i);
    parts.hull.setAttribute('band', new THREE.BufferAttribute(band, 1));
    for (const k of ['deck', 'teak', 'roof', 'net']) {
      const q = parts[k]?.attributes.position; if (!q) continue;
      const uv = new Float32Array(q.count * 2);
      for (let i = 0; i < q.count; i++) { uv[2 * i] = q.getX(i); uv[2 * i + 1] = -q.getZ(i); }
      parts[k].setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    done(parts);
  }, undefined, () => done(null));
});
export const lagoonReady = !!MODEL;

// the shade baked into her decks, in plan: soft and dark round the saloon's foot, along the rails, under the helm
// station, the seats and the lockers, round the roof's posts. Metres to pixels; each shape drawn off the canvas and
// only its blurred shadow lands on it
const AO_W = 8.2, AO_L = 13.6, AO_S = 24;
let deckAO = null;
function deckShade() {
  if (deckAO) return deckAO;
  const c = document.createElement('canvas'); c.width = AO_W * AO_S; c.height = AO_L * AO_S;
  const x = c.getContext('2d'), X = (v) => (v + AO_W / 2) * AO_S, Y = (z) => (z + AO_L / 2) * AO_S;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const soft = (path, blur, alpha, stroke = 0) => {
    x.save(); x.shadowColor = `rgba(0,0,0,${alpha})`; x.shadowBlur = blur * AO_S; x.shadowOffsetX = 4000; x.translate(-4000, 0);
    x.beginPath(); path(); if (stroke) { x.lineWidth = stroke * AO_S; x.strokeStyle = '#000'; x.stroke(); } else { x.fillStyle = '#000'; x.fill(); }
    x.restore();
  };
  const rect = (x0, x1, z0, z1) => () => { x.rect(X(x0), Y(z0), (x1 - x0) * AO_S, (z1 - z0) * AO_S); };
  // the saloon's foot: its front straight, its front corners rounded (blender/lagoon42.py's cr_outline)
  soft(() => {
    const w = CR_W + 0.02, r = 0.5;
    x.moveTo(X(-w + r), Y(CR_F - 0.02)); x.lineTo(X(w - r), Y(CR_F - 0.02)); x.quadraticCurveTo(X(w), Y(CR_F - 0.02), X(w), Y(CR_F + r));
    x.lineTo(X(w), Y(CR_A + 0.02)); x.lineTo(X(-w), Y(CR_A + 0.02)); x.lineTo(X(-w), Y(CR_F + r)); x.quadraticCurveTo(X(-w), Y(CR_F - 0.02), X(-w + r), Y(CR_F - 0.02));
  }, 0.3, 0.6);
  for (const sx of [-1, 1]) { // along each hull's rails; round the roof's posts
    soft(() => { for (let i = 0; i <= 40; i++) { const z = lerp(-6.3, 5.3, i / 40); x[i ? 'lineTo' : 'moveTo'](X(sx * (XC + halfB(z) - 0.03)), Y(z)); } }, 0.1, 0.4, 0.05);
    soft(() => { x.moveTo(X(sx * 2.2 + 0.1), Y(4.62)); x.arc(X(sx * 2.2), Y(4.62), 0.1 * AO_S, 0, Math.PI * 2); }, 0.14, 0.6);
    soft(rect(Math.min(sx * 2.12, sx * 2.76), Math.max(sx * 2.12, sx * 2.76), 3.1, 3.92), 0.2, 0.55); // the lockers
  }
  soft(rect(HELM.x0, -0.82, HELM.z0, HELM.z1), 0.22, 0.55); // the helm station and its steps
  soft(rect(0.42, 2.04, 2.32, 4.36), 0.2, 0.5); // the seats round the table
  soft(rect(-2.02, -1.4, 3.02, 4.14), 0.2, 0.5); // the seat to port
  soft(rect(-2.0, 2.0, 4.66, 5.18), 0.2, 0.55); // the aft bench
  soft(rect(-1.55, 1.55, -3.12, -2.12), 0.2, 0.5); // the forward lounge
  const t = new THREE.CanvasTexture(c);
  t.repeat.set(1 / AO_W, 1 / AO_L); t.offset.set(0.5, 0.5); // the decks' UVs are their plan in metres (x, −z)
  return (deckAO = t);
}
function shaded(m) { // the baked shade dims the sunlit deck a little too, not only the sky's light
  m.aoMap = deckShade(); m.aoMapIntensity = 1;
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, 0.45);'); };
  m.customProgramCacheKey = () => 'lagoonDeck';
  return m;
}
// the trampoline's net: dark strands with the sea through the holes
function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64); x.fillStyle = '#2a2e33';
  for (let i = 0; i < 4; i++) { x.fillRect(i * 16, 0, 7, 64); x.fillRect(0, i * 16, 64, 7); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.24, 1 / 0.24); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// the jib rolled on its foil: its dark sacrificial strip round it, the white cloth showing in a spiral between the turns
const JIB = canvasTex(64, 128, (x, w, h) => {
  x.fillStyle = '#26292e'; x.fillRect(0, 0, w, h);
  for (let k = -2; k < 4; k++) {
    x.fillStyle = 'rgba(232,232,228,.9)'; x.beginPath(); x.moveTo(0, k * 48 + 20); x.lineTo(w, k * 48 + 60); x.lineTo(w, k * 48 + 68); x.lineTo(0, k * 48 + 28); x.fill();
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(0, k * 48); x.lineTo(w, k * 48 + 40); x.lineTo(w, k * 48 + 44); x.lineTo(0, k * 48 + 4); x.fill();
  }
}, 1, 14);
// the stack pack's white canvas: its zip down the top, the seams where the lazy jacks are sewn in
const BAG = canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = '#e6e7e3'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.05)'; for (let v = 0; v < h; v += 32) x.fillRect(0, v, w, 2);
  x.fillStyle = 'rgba(0,0,0,.08)'; for (let u = 18; u < w; u += 28) x.fillRect(u, 0, 1, h);
  x.fillStyle = '#5b6168'; x.fillRect(0, 0, 3, h); x.fillRect(w - 3, 0, 3, h);
});
// the model's number on each aft quarter, in dark grey
const DECAL = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const x = c.getContext('2d'); x.fillStyle = '#4a5057'; x.font = '300 66px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('42', 64, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();

let LF = null;
function lagoonFinishes() {
  const F = finishes();
  return LF ||= {
    deck: shaded(new THREE.MeshStandardMaterial({ map: NONSKID, color: '#ffffff', roughness: 0.85 })),
    teak: shaded(F.teak.clone()),
    roof: new THREE.MeshStandardMaterial({ map: NONSKID, color: '#ffffff', roughness: 0.85 }),
    net: new THREE.MeshStandardMaterial({ map: netTexture(), color: '#ffffff', roughness: 0.9, alphaTest: 0.4, side: THREE.DoubleSide }),
    tube: new THREE.MeshStandardMaterial({ color: '#6c7379', roughness: 0.7 }), // the tender's grey hypalon
    dark: new THREE.MeshStandardMaterial({ color: '#202429', roughness: 0.5 }),
    // her mast and boom in white paint, a clear coat over it
    spar: new THREE.MeshPhysicalMaterial({ color: '#eceeee', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }),
    // the stack pack's canvas, the furled jib
    bag: new THREE.MeshStandardMaterial({ map: BAG, roughness: 0.9 }),
    decal: new THREE.MeshStandardMaterial({ map: DECAL, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    jib: new THREE.MeshStandardMaterial({ map: JIB, roughness: 0.85 }),
    // her cushions: a grey-taupe outdoor fabric
    cushion: new THREE.MeshStandardMaterial({ color: '#a69e8e', roughness: 0.95 }),
    // the lights: the masthead's and the spreaders' white lenses, the bow lights' red and green
    lamp: new THREE.MeshPhysicalMaterial({ color: '#f4f2ea', roughness: 0.15, clearcoat: 1, emissive: '#ffffff', emissiveIntensity: 0.05 }),
    port: new THREE.MeshStandardMaterial({ color: '#c0161a', roughness: 0.2, emissive: '#c0161a', emissiveIntensity: 0.25 }),
    starboard: new THREE.MeshStandardMaterial({ color: '#0e9a3a', roughness: 0.2, emissive: '#0e9a3a', emissiveIntensity: 0.25 }),
    // the solar panels on the roof: dark cells under glass, the sky in it
    solar: new THREE.MeshPhysicalMaterial({ color: '#141c2a', roughness: 0.1, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }),
    rail: new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.5 }), // the rubbing strakes
  };
}

// a surface lofted through sections of n points each, closed round; the ends capped
function loftGeometry(secs, capped = true, uvs = false) { // uvs: u round each section (its seam at its first point), v along
  const m = uvs ? secs[0].length + 1 : secs[0].length, n = secs[0].length, pos = [], uv = [], idx = [];
  secs.forEach((s, i) => { for (let k = 0; k < m; k++) { pos.push(...s[k % n]); uv.push(k / n, i / (secs.length - 1)); } });
  for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < n; k++) {
    const a = i * m + k, b = i * m + (uvs ? k + 1 : (k + 1) % n), c = a + m, d = b + m;
    idx.push(a, c, b, b, c, d);
  }
  if (capped) for (const [i, flip] of [[0, true], [secs.length - 1, false]]) {
    const ctr = secs[i].reduce((q, p) => [q[0] + p[0] / n, q[1] + p[1] / n, q[2] + p[2] / n], [0, 0, 0]);
    const ci = pos.length / 3; pos.push(...ctr); uv.push(0.5, i ? 1 : 0);
    for (let k = 0; k < n; k++) { const a = i * m + k, b = i * m + (uvs ? k + 1 : (k + 1) % n); idx.push(...(flip ? [ci, b, a] : [ci, a, b])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a cone from a (radius ra) to b (radius rb)
const taper = (a, b, ra, rb, seg = 10) => {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), len = A.distanceTo(Bv);
  const g = new THREE.CylinderGeometry(rb, ra, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()));
  return g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
};

// ---------- the boat ----------
export class LagoonCommittee {
  // side: +1 if the pin lies off her starboard side, −1 to port; lineZ: where along her the line meets her (local z)
  constructor(side = 1, lineZ = 0) {
    const root = this.root = new THREE.Group();
    this.fresh = true;
    root.rotation.order = 'YXZ';
    // her two hulls in the water, for the white water round each (world.js's HullContact); she rolls less than the
    // motor cruiser, being so beamy
    this.hulls = [-XC, XC].map((x) => ({ x, loa: LAGOON_WL, wlb: 1.35 }));
    this.bottom = BOTTOM; this.roll = 0.16; this.pitch = 0.3;
    const F = finishes(), G = lagoonFinishes();
    const M = {
      ...G, gel: F.gel, glass: F.glass, steel: YM.steel, rope: F.rope, fender: F.fender, wood: YM.teak,
      orange: new THREE.MeshStandardMaterial({ color: '#ff6a10', roughness: 0.55 }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.8, side: THREE.DoubleSide }),
    };
    const bin = {}; // static parts, merged per material
    const put = (k, g) => (bin[k] ||= []).push(g);
    // yacht.js's fittings ([geometry, material] parts in their own frame), placed and folded in by material
    const mbin = new Map();
    const bake = (parts, x, y, z, ry = 0, rx = 0) => {
      const mx = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      for (const [g, mat] of parts) { if (!mbin.has(mat)) mbin.set(mat, []); mbin.get(mat).push(g.clone().applyMatrix4(mx)); }
    };
    const lines = [];

    // the moulded parts; the hulls white in yacht.js's lacquer over a black boot-top and antifouling, her own wet line
    const hm = hullMaterial('#f3f4f3', '#16191d', BOTTOM);
    this.sea = hm.userData.sea; this.sea.uHalfL.value = L / 2;
    root.add(new THREE.Mesh(MODEL.hull, hm));
    for (const k of ['deck', 'teak', 'roof', 'gel', 'glass', 'net', 'cushion', 'tube', 'dark', 'steel']) if (MODEL[k]) root.add(new THREE.Mesh(MODEL[k], M[k]));

    // ---- the hulls' fittings ----
    for (const sx of [-1, 1]) {
      const X = sx * XC, edge = (z, k = 0.08) => X + sx * (halfB(z) - k), inner = (z, k = 0.08) => X - sx * (halfB(z) - k);
      // the rubbing strake: a fine grey moulding round each hull's sheer, outside, round the bow and in along the net
      const rub = [];
      for (let i = 0; i <= 30; i++) { const z = lerp(RAKE0 - 0.05, -5.6, i / 30); rub.push([X + sx * (halfB(z) + 0.012), deckY(z) - 0.035, z]); }
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI, z = -5.6 - (ZS - 5.6) * Math.sin(a) * 0.999; rub.push([X + sx * Math.cos(a) * (halfB(z) + 0.012), deckY(z) - 0.035, z]); }
      for (let i = 1; i <= 8; i++) { const z = lerp(-5.6, -3.2, i / 8); rub.push([X - sx * (halfB(z) + 0.012), deckY(z) - 0.035, z]); }
      put('rail', tube(rub, 0.022, false, 6));
      // the lifelines: stanchions down the outer deck edge from the bow to the aft deck; the bow pulpit round the
      // blunt bow and back along the net's edge; two wires
      const top = [], posts = [];
      for (const z of [-3.4, -4.4, -5.3]) { const x = inner(z); top.push([x, deckY(z) + 0.66, z]); posts.push([x, deckY(z), z]); }
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI, z = -5.75 - 0.45 * Math.sin(a); top.push([X - sx * Math.cos(a) * (halfB(z) - 0.1), deckY(z) + 0.66, z]); }
      posts.push([X, deckY(-6.2), -6.2]);
      for (const z of [-5.3, -4.3, -3.1, -1.9, -0.7, 0.5, 1.7, 2.9, 4.0, 5.05]) { const x = edge(z); top.push([x, deckY(z) + 0.66, z]); posts.push([x, deckY(z), z]); }
      put('steel', tube(top, 0.022, false, 8));
      put('steel', tube(top.slice(10).map(([x, y, z]) => [x, y - 0.33, z]), 0.008, false, 4));
      put('steel', tube(top.slice(0, 3).map(([x, y, z]) => [x, y - 0.33, z]), 0.008, false, 4));
      for (const [x, y, z] of posts) {
        put('steel', rod([x, y, z], [x, y + 0.66, z], 0.018, 8));
        put('steel', new THREE.CylinderGeometry(0.032, 0.042, 0.03, 10).translate(x, y + 0.015, z)); // its base
      }
      // the navigation lights on the pulpit's sides, red to port and green to starboard
      const nz = -5.95, nx = X + sx * (halfB(nz) - 0.1), ny = deckY(nz) + 0.62;
      put(sx > 0 ? 'starboard' : 'port', new RoundedBoxGeometry(0.07, 0.06, 0.1, 1, 0.01).translate(nx + sx * 0.03, ny, nz));
      put('dark', new THREE.BoxGeometry(0.05, 0.075, 0.12).translate(nx, ny, nz));
      // cleats: at the bow, amidships and on the quarter, on the outer deck edge
      for (const cz of [-5.6, -0.2, 4.95]) {
        const gx = new THREE.Group(); cleat(0.28).forEach(([g, m]) => gx.add(new THREE.Mesh(g, m)));
        gx.position.set(X + sx * (halfB(cz) - 0.2), deckY(cz) + 0.01, cz); root.add(gx);
      }
      // the deck hatches down the hull, as the plan has them, outboard of its middle: alloy frames, smoked acrylic
      for (const [hz, hs] of [[2.64, 0.55], [1.0, 0.36], [-0.83, 0.36], [-2.58, 0.55], [-4.44, 0.5]]) {
        const hx = X + sx * 0.28;
        put('steel', new RoundedBoxGeometry(hs + 0.08, 0.05, hs + 0.08, 2, 0.02).translate(hx, deckY(hz) + 0.04, hz));
        put('glass', new THREE.BoxGeometry(hs, 0.02, hs).translate(hx, deckY(hz) + 0.065, hz));
      }
      // '42' on the aft quarter
      { const dz = 4.45, dy = 1.24; put('decal', new THREE.PlaneGeometry(0.42, 0.26).rotateY(sx * Math.PI / 2).translate(X + sx * (topsidesX(tAt(dz), dy) + 0.008), dy, dz)); }
      // the rails down the transom's steps, on the inner wall
      const xi = (z) => X - sx * (halfB(z) - 0.08);
      const rail = [[xi(5.15), deckY(5.15) + 0.75, 5.15], [xi(5.5), 1.24 + 0.8, 5.5], [xi(5.8), 0.88 + 0.8, 5.8], [xi(6.1), PLAT + 0.8, 6.1]];
      put('steel', tube(rail, 0.017, false, 8));
      for (const [x, y, z] of rail) put('steel', rod([x, y, z], [x, wallTop(z), z], 0.016, 6));
      // the trampolines laced to the hull along their inner edge
      put('dark', tube(Array.from({ length: 9 }, (_, i) => { const z = lerp(BEAM_Z + 0.12, -3.25, i / 8); return [X - sx * (halfB(z) - 0.03), deckY(z) - 0.08, z]; }), 0.013, false, 5));
      for (let i = 0; i < 14; i++) {
        const z = lerp(BEAM_Z + 0.2, -3.3, (i + 0.5) / 14), xe = X - sx * halfB(z);
        lines.push(xe + sx * 0.02, deckY(z) - 0.04, z - 0.06, xe - sx * 0.03, deckY(z) - 0.085, z + 0.06);
      }
      // her running gear under the water: a saildrive leg and its folding propeller behind each keel
      put('dark', new RoundedBoxGeometry(0.12, 0.5, 0.42, 2, 0.04).translate(X, -0.62, 4.15));
      put('dark', new THREE.CylinderGeometry(0.06, 0.05, 0.36, 10).rotateX(Math.PI / 2).translate(X, -0.82, 4.25));
      const prop = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const blade = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.14, 0.45).translate(0.15, 0, 0), F.bronze);
        blade.rotation.set(0.3 * sx, 0, k * Math.PI); prop.add(blade);
      }
      prop.position.set(X, -0.82, 4.46); root.add(prop);
    }
    // fenders out on the hull away from the line, for the mark boats coming alongside
    const fenderGeo = new THREE.LatheGeometry([[0, -0.36], [0.06, -0.35], [0.11, -0.3], [0.125, -0.2], [0.125, 0.2], [0.11, 0.3], [0.06, 0.35], [0, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    for (const z of [-2.4, -0.4, 1.4, 3.4]) {
      const ex = -side * (XC + halfB(z)), fx = ex - side * 0.15, fy = deckY(z) - 0.66;
      put('fender', fenderGeo.clone().translate(fx, fy, z));
      put('rope', rod([fx, fy + 0.36, z], [ex + side * 0.08, deckY(z) + 0.34, z], 0.008, 4));
    }
    // "RACE COMMITTEE" on banners lashed to the lifelines, down each side
    for (const sx of [-1, 1]) {
      const z0 = -1.8, z1 = 1.4, zm = (z0 + z1) / 2, x = sx * (XC + halfB(zm) - 0.07);
      put('banner', new THREE.PlaneGeometry(z1 - z0, 0.5).rotateY(sx * Math.PI / 2).translate(x, deckY(zm) + 0.38, zm));
    }

    // ---- forward: the bow roller on the bowsprit's tip, the anchor home on it, its chain steeply down; the bridle ----
    const ty = sheer(1) - 0.12;
    put('steel', new THREE.BoxGeometry(0.16, 0.12, 0.5).translate(0, ty + 0.06, LONG_F + 0.12));
    put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12).rotateZ(Math.PI / 2).translate(0, ty + 0.06, LONG_F - 0.1));
    put('steel', new THREE.ConeGeometry(0.16, 0.34, 3).scale(1, 1, 0.35).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, ty - 0.14, LONG_F - 0.27));
    put('steel', rod([0, ty + 0.08, LONG_F + 0.08], [0, ty - 0.06, LONG_F - 0.2], 0.025, 8));
    const rode = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; rode.push([0, lerp(ty - 0.05, -3.2, u ** 0.8) - 0.4 * Math.sin(Math.PI * u), LONG_F - 0.17 - u * 8]); }
    put('dark', tube(rode, 0.025, false, 4));
    for (const sx of [-1, 1]) lines.push(0, ty, LONG_F + 0.2, sx * (XC - 0.3), deckY(-6.0) - 0.05, -6.0);

    // ---- the saloon: its sliding door aft, the roof's hatches and grab rails, the sunpad and the solar panels ----
    put('glass', new THREE.BoxGeometry(0.95, 2.32 - floorY(CR_A), 0.04).translate(0.675, (2.32 + floorY(CR_A)) / 2, CR_A + 0.03));
    put('steel', new THREE.BoxGeometry(1.0, 0.03, 0.03).translate(0.675, floorY(CR_A) + 0.02, CR_A + 0.05));
    put('steel', rod([0.24, floorY(CR_A) + 0.75, CR_A + 0.07], [0.24, floorY(CR_A) + 1.15, CR_A + 0.07], 0.012, 6)); // its handle
    for (const [hx, hz] of [[-1.3, -1.25], [1.3, -1.25], [1.3, 0.75]]) {
      put('steel', new RoundedBoxGeometry(0.62, 0.05, 0.62, 2, 0.02).translate(hx, roofTop(hz) + 0.02, hz));
      put('glass', new THREE.BoxGeometry(0.54, 0.02, 0.54).translate(hx, roofTop(hz) + 0.045, hz));
    }
    for (const sx of [-1, 1]) put('steel', tube([[sx * 2.6, roofTop(-1.8), -1.8], [sx * 2.6, roofTop(-1.7) + 0.08, -1.7], [sx * 2.6, roofTop(0.9) + 0.08, 0.9], [sx * 2.6, roofTop(1.0), 1.0]], 0.016, false, 6));
    // the sunpad on the roof just aft of the mast, and two solar panels side by side to starboard aft of it
    const slope = (z) => Math.atan((roofTop(z + 0.1) - roofTop(z - 0.1)) / 0.2);
    put('cushion', new RoundedBoxGeometry(1.7, 0.08, 1.1, 2, 0.035).rotateX(-slope(1.1)).translate(0, roofTop(1.1) + 0.05, 1.1));
    for (const px of [1.24, 1.76]) {
      put('steel', new THREE.BoxGeometry(0.5, 0.03, 1.02).rotateX(-slope(1.75)).translate(px, roofTop(1.75) + 0.025, 1.75));
      put('solar', new THREE.BoxGeometry(0.46, 0.02, 0.98).rotateX(-slope(1.75)).translate(px, roofTop(1.75) + 0.045, 1.75));
    }
    // ---- the helm: its wheel and screens on the console, the throttles; the two winches and the clutches on the roof's
    // edge beside it, where every line from the mast comes; the hatches in its hard top ----
    const w = wheel(0.38, 6, YM.dark, YM.steel);
    w.rotation.x = -0.3; w.position.set(-2.06, 3.05, 2.14); root.add(w);
    bake(display(0.36, 0.25, 3), -2.06, 3.2, 1.86, 0, -0.95);
    bake(display(0.2, 0.14, 0), -1.66, 3.18, 1.88, 0, -0.95);
    for (const dx of [-2.48, -2.41]) put('steel', rod([dx, 3.12, 1.9], [dx, 3.26, 1.95], 0.01, 6));
    for (const wz of [1.72, 2.2]) bake(winch(0.07, 0.17), -1.08, roofTop(wz) + 0.005, wz);
    bake(clutches(5), -0.7, roofTop(1.4) + 0.005, 1.4, 0.0);
    for (let k = 0; k < 5; k++) { // the halyards and reefing lines from the mast's foot aft over the roof to the clutches
      const x0 = -0.12 - k * 0.035, x1 = -0.7 + (k - 2) * 0.075;
      lines.push(x0 * 0.6, MFOOT + 0.35, MZ + 0.15, x0, roofTop(MZ + 0.5) + 0.03, MZ + 0.5, x0, roofTop(MZ + 0.5) + 0.03, MZ + 0.5, x1, roofTop(1.25) + 0.03, 1.25);
    }
    for (const hz of [1.85, 2.7]) {
      put('steel', new RoundedBoxGeometry(0.62, 0.04, 0.5, 2, 0.02).translate(-2.1, HT.y1 + 0.015, hz));
      put('glass', new THREE.BoxGeometry(0.55, 0.02, 0.43).translate(-2.1, HT.y1 + 0.035, hz));
    }
    // ---- the davits: an arm from each end of the aft bench, the tender hung on them ----
    for (const dx of [-1.05, 1.05]) {
      const a = [dx, floorY(5.2) + 0.4, 5.15], b = [dx, 2.22, 5.55], c = [dx, 2.28, 6.02];
      put('steel', tube([a, [dx, 1.98, 5.25], b, c], 0.035, false, 8));
      put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateZ(Math.PI / 2).translate(dx, 2.26, 6.02));
      lines.push(dx, 2.24, 6.02, dx * 0.9, TD.y + 0.18, TD.z);
    }

    // ---- the rig ----
    // the mast: a pear section, deeper fore and aft than wide, tapering above the upper spreaders; stepped on the roof
    // near her middle, further aft than on most cruising cats, as the 42's is
    put('spar', mastGeo(MTOP - MFOOT, 0.3, 0.17, 0.17, 0.11, 0.72).translate(0, (MFOOT + MTOP) / 2, MZ));
    put('steel', new RoundedBoxGeometry(0.34, 0.12, 0.46, 2, 0.03).translate(0, MFOOT + 0.06, MZ)); // its step
    put('dark', new THREE.BoxGeometry(0.2, 0.14, 0.12).translate(0, by0 + 0.02, MZ + 0.2)); // the gooseneck
    // two pairs of spreaders, swept aft, aerofoil struts; their lights under the lower pair, the steaming light
    const tip = (S, sx) => [sx * S.w, S.y, MZ + S.aft];
    for (const S of [SPR1, SPR2]) for (const sx of [-1, 1]) {
      const r0 = [sx * 0.08, S.y, MZ], t1 = tip(S, sx), len = Math.hypot(t1[0] - r0[0], t1[2] - r0[2]);
      put('spar', spreaderGeo(len, 0.03, 0.018).rotateZ(-sx * Math.PI / 2).rotateY(-sx * Math.atan2(S.aft, S.w - 0.08)).translate((r0[0] + t1[0]) / 2, S.y, (r0[2] + t1[2]) / 2));
    }
    for (const sx of [-1, 1]) put('lamp', new THREE.BoxGeometry(0.06, 0.03, 0.08).translate(sx * 0.35, SPR1.y - 0.04, MZ + 0.07));
    put('lamp', new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(0, 10.8, MZ - 0.17));
    // the shrouds: the caps over both spreaders' tips to the hounds, the intermediates over the lower ones, the lowers;
    // all to chainplates on the hulls' decks a little aft of the mast
    const chain = (sx) => [sx * (XC + 0.4), deckY(MZ + 0.7) + 0.03, MZ + 0.7], chainL = (sx) => [sx * (XC + 0.1), deckY(MZ + 0.25) + 0.03, MZ + 0.25];
    for (const sx of [-1, 1]) {
      const c = chain(sx), cl = chainL(sx), a = tip(SPR1, sx), b = tip(SPR2, sx);
      lines.push(...c, ...a, ...a, ...b, ...b, 0, HOUNDS, MZ); // the cap shroud
      lines.push(...c, ...a, ...a, 0, SPR2.y - 0.1, MZ); // the intermediate
      lines.push(...cl, 0, SPR1.y - 0.15, MZ); // the lower
      bake(chainplate(c, a), 0, 0, 0); bake(chainplate(cl, [0, SPR1.y, MZ]), 0, 0, 0);
    }
    // the forestay from the hounds down to the crossbeam's middle, the jib furled round it over its drum; its sheet from
    // the furled clew to the car on the self-tacking track across the roof just ahead of the mast, and on to the mast
    const tack = [0, sheer(tAt(BEAM_Z)) - 0.02, BEAM_Z], head = [0, HOUNDS, MZ - 0.14];
    lines.push(...tack, ...head);
    put('steel', new THREE.BoxGeometry(0.08, 0.1, 0.12).translate(tack[0], tack[1] - 0.02, tack[2]));
    put('dark', new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16).translate(tack[0], tack[1] + 0.2, tack[2]));
    const dir = new THREE.Vector3(...head).sub(new THREE.Vector3(...tack)), fl = dir.length(); dir.normalize();
    const along = (u) => [tack[0] + dir.x * fl * u, tack[1] + dir.y * fl * u, tack[2] + dir.z * fl * u];
    put('jib', taper(along(0.02), along(0.3), 0.1, 0.13, 16));
    put('jib', taper(along(0.3), along(0.75), 0.13, 0.075, 16));
    put('jib', taper(along(0.75), along(0.93), 0.075, 0.03, 16));
    const trackR = MZ - 0.95 - BEAM_Z, track = [];
    for (let i = 0; i <= 12; i++) { const x = lerp(-1.3, 1.3, i / 12), z = BEAM_Z + Math.sqrt(trackR * trackR - x * x); track.push([x, roofTop(z) + 0.025, z]); }
    put('steel', tube(track, 0.022, false, 6));
    const car = [0, roofTop(BEAM_Z + trackR) + 0.06, BEAM_Z + trackR];
    put('dark', new RoundedBoxGeometry(0.12, 0.06, 0.1, 1, 0.015).translate(...car));
    const clew = along(0.07);
    lines.push(clew[0] + 0.05, clew[1], clew[2] + 0.1, ...car, ...car, 0.1, MFOOT + 0.3, MZ - 0.15);
    // the boom, over the roof; the mainsail stowed in its bag on it, held up by the lazy jacks; the mainsheet's tackle
    // down to the traveller right across the roof's aft end, and the topping lift
    put('spar', new RoundedBoxGeometry(0.15, 0.28, bz1 - bz0, 2, 0.05).rotateX(-Math.atan2(by1 - by0, bz1 - bz0)).translate(0, (by0 + by1) / 2, (bz0 + bz1) / 2));
    put('dark', new RoundedBoxGeometry(0.17, 0.25, 0.12, 2, 0.03).translate(0, by1, bz1 + 0.02)); // its end fitting
    const bagTop = (z) => { const u = clamp((z - bz0) / (bz1 - bz0), 0, 1); return boomY(z) + 0.1 + lerp(0.78, 0.36, u) * (1 - 0.65 * (1 - Math.min(1, (u + 0.05) * 7)) ** 2); };
    const bag = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, z = lerp(bz0 + 0.04, bz1 - 0.08, u), y0 = boomY(z) + 0.1, h = bagTop(z) - y0, hw = lerp(0.22, 0.16, u) * (1 - 0.5 * (1 - Math.min(1, u * 9)) ** 2), ring = [];
      for (let j = 0; j < 20; j++) {
        const a = (j / 20) * Math.PI * 2, cx = Math.sin(a), cy = Math.cos(a); // a = 0 at the top, along its zip
        const yy = y0 + h * (0.5 + 0.5 * Math.sign(cy) * Math.abs(cy) ** 0.55), f = (yy - y0) / Math.max(h, 0.01);
        ring.push([Math.sign(cx) * Math.abs(cx) ** 0.5 * hw * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.15 + 0.1))), yy, z]);
      }
      bag.push(ring);
    }
    put('bag', loftGeometry(bag, true, true));
    for (const sx of [-1, 1]) {
      const legs = [1.0, 2.4, 3.8].map((z) => [sx * 0.19, bagTop(z) - 0.06, z]), j1 = [sx * 0.42, 7.2, 1.5], j2 = [sx * 0.3, 8.2, 2.8], top = [sx * 0.12, 9.0, MZ + 0.12];
      lines.push(...legs[0], ...j1, ...legs[1], ...j1, ...j1, ...top, ...legs[1], ...j2, ...legs[2], ...j2, ...j2, ...top);
    }
    const TZ = 4.62, ms = [0, roofTop(TZ) + 0.08, TZ], mb = [0, boomY(TZ) - 0.16, TZ];
    put('steel', new THREE.BoxGeometry(4.6, 0.035, 0.07).translate(0, roofTop(TZ) + 0.02, TZ)); // the traveller
    put('dark', new RoundedBoxGeometry(0.16, 0.05, 0.1, 1, 0.015).translate(0, roofTop(TZ) + 0.055, TZ));
    bake(block(0.05), ...mb); bake(block(0.05), ...ms);
    for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 0.022; lines.push(dx, mb[1] - 0.04, TZ, dx, ms[1] + 0.05, TZ); }
    lines.push(0, by1, bz1, 0, MTOP - 0.1, MZ + 0.05);
    // at the masthead: its crane, the tricolour and anchor light, the wind vane on its stalk, the wind sensor, the VHF whip
    put('spar', new RoundedBoxGeometry(0.14, 0.12, 0.42, 2, 0.03).translate(0, MTOP + 0.04, MZ + 0.08));
    put('lamp', new THREE.CylinderGeometry(0.04, 0.045, 0.12, 10).translate(0, MTOP + 0.16, MZ - 0.02));
    put('steel', rod([0, MTOP + 0.06, MZ + 0.25], [0, MTOP + 0.4, MZ + 0.42], 0.008, 4));
    put('dark', new THREE.BoxGeometry(0.008, 0.02, 0.36).translate(0, MTOP + 0.42, MZ + 0.42)); // the vane's arrow
    for (const sx of [-1, 1]) put('dark', new THREE.BoxGeometry(0.006, 0.12, 0.1).translate(sx * 0.03, MTOP + 0.42, MZ + 0.58));
    put('steel', rod([0.05, MTOP + 0.06, MZ + 0.2], [0.05, MTOP + 0.35, MZ + 0.2], 0.008, 4));
    put('dark', new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10).translate(0.05, MTOP + 0.38, MZ + 0.2));
    put('dark', new THREE.CylinderGeometry(0.006, 0.008, 0.8, 4).translate(-0.06, MTOP + 0.45, MZ + 0.1));

    // ---- the signals ----
    // the four signal halyards from blocks on the lower spreaders down to the roof just forward of the mast. Starboard outer: the
    // class flag; port outer: P (or U, or black); starboard inner: X; port inner: the first substitute
    this.flags = {};
    const hal = { cls: [SPR1.w - 0.05, 1.9], P: [-(SPR1.w - 0.05), -1.9], X: [0.8, 1.0], sub: [-0.8, -1.0] };
    const hz = MZ - 0.5, hy = roofTop(hz) + 0.02;
    for (const [k, [xt, xb]] of Object.entries(hal)) {
      const zt = MZ + SPR1.aft * Math.abs(xt) / SPR1.w + 0.02;
      const topP = new THREE.Vector3(xt, SPR1.y - 0.12, zt), bot = new THREE.Vector3(xb, hy, hz);
      lines.push(topP.x, topP.y, topP.z, bot.x, bot.y, bot.z);
      put('dark', new THREE.SphereGeometry(0.035, 6, 4).translate(topP.x, topP.y + 0.04, topP.z)); // its block
      const f = new Flag(flagTexture(k), k === 'sub' ? 1.3 : 1.2, 0.85, k === 'sub');
      f.top = topP; f.bot = new THREE.Vector3().lerpVectors(bot, topP, 1.8 / (topP.y - bot.y)); f.h = 0;
      root.add(f.pivot); this.flags[k] = f;
    }
    this.prepTex = { P: this.flags.P.mat.map, U: flagTexture('U'), B: flagTexture('B') };
    this.burgee = new Flag(flagTexture('burgee'), 0.75, 0.45, true);
    this.burgee.pivot.position.set(0, MTOP + 0.95, MZ); root.add(this.burgee.pivot);
    put('dark', new THREE.CylinderGeometry(0.01, 0.01, 0.95, 4).translate(0, MTOP + 0.48, MZ));
    // the black ball forward of the mast, the day shape of a vessel at anchor
    const ballY = 7.2, ballZ = MZ - 1.5;
    put('dark', new THREE.SphereGeometry(0.3, 12, 9).translate(0, ballY, ballZ));
    lines.push(0, ballY + 0.3, ballZ, 0, SPR1.y - 0.2, MZ - 0.12, 0, ballY - 0.3, ballZ, 0, roofTop(-1.9) + 0.02, -1.9);
    // the orange flag on its staff on the aft deck of the hull nearer the line: her end of the starting line
    const oz = clamp(lineZ, 4.2, 4.9), ox = side * (XC + halfB(oz) - 0.12), oy = deckY(oz);
    put('steel', rod([ox, oy, oz], [ox, oy + 3.6, oz], 0.03, 6));
    put('steel', new THREE.SphereGeometry(0.05, 8, 6).translate(ox, oy + 3.62, oz));
    this.orange = new Flag(flagTexture('orange'), 1.3, 0.9);
    this.orange.pivot.position.set(ox, oy + 3.55, oz); root.add(this.orange.pivot);

    // ---- the officers: the race officer at the helm with binoculars, a hand on the halyards by the mast, the line
    // sighter by the orange flag, the timekeeper with the horn in the cockpit, the recorder on the roof ----
    const face = side > 0 ? 0 : Math.PI; // they face the line
    const crew = [
      { at: [-2.06, HELM.y, 2.45], jacket: '#1d3557', pose: 'glasses', yaw: face },
      { at: [side * 0.55, roofTop(MZ - 0.45), MZ - 0.45], jacket: '#c8342b', pose: 'halyard', yaw: face },
      { at: [side * (XC + halfB(oz) - 0.55), oy, oz - 0.4], jacket: '#ff7a1a', pose: 'glasses', yaw: face - side * 0.35 },
      { at: [side > 0 ? 0.1 : -1.0, floorY(4.45), 4.45], jacket: '#1d3557', pose: 'horn', yaw: face + side * 0.25 },
      { at: [side > 0 ? -0.9 : 1.2, roofTop(2.3), 2.3], jacket: '#f2f1ec', pose: 'board', yaw: face + side * 0.5 },
    ];
    crew.forEach((c, i) => {
      const s = officer(i, c.jacket, c.pose);
      s.g.position.set(c.at[0], c.at[1] + 0.94 * 1.1, c.at[2]); s.g.rotation.y = c.yaw;
      root.add(s.g);
    });

    // put it together
    const plain = (x) => { x = x.index ? x.toNonIndexed() : x; for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n); if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; };
    for (const [k, gs] of Object.entries(bin)) root.add(new THREE.Mesh(mergeGeometries(gs.map(plain)), M[k]));
    for (const [mat, gs] of mbin) root.add(new THREE.Mesh(mergeGeometries(gs.map(plain)), mat));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a3f46' })));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.material.alphaTest; } });
  }
}
// her signals are run as the motor cruiser's are: hoisted and lowered along their halyards, the blue flag in the
// class flag's place on a finish line
LagoonCommittee.prototype.update = CommitteeBoat.prototype.update;
LagoonCommittee.prototype.finishing = CommitteeBoat.prototype.finishing;
