// Regatta: the other committee boat — a Lagoon 42 cruising catamaran lying to her anchor, head to wind, at the
// starboard end of the line, her mainsail stowed in its bag on the boom and her jib furled on the forestay. The race
// officers run the start from her as from the motor cruiser (committee.js), the two taking turns from race to race:
// the signal flags go up and down halyards from her lower spreaders' tips, the orange flag on a staff at the stern of
// the hull nearer the line marks her end of it, and an officer by it sights along the line to the pin.
//
// She is finished as the yachts are (yacht.js): her hulls, bridgedeck, saloon, hardtop, helm station, cockpit,
// trampoline and tender moulded in Blender (blender/lagoon42.py → lagoon42.glb), the hulls under yacht.js's lacquer
// with the boot-top, antifouling and the sea's wet line on it, the decks moulded non-skid with the shade baked in
// where the saloon and the hardtop's posts stand on them, the cockpit and the transom steps teak. Here: the rig and
// the stowed sails, the rails, the flags and the officers, her fittings.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp } from './sim.js';
import { hullMaterial, NONSKID, canvasTex, cleat, wheel, display, winch, block, clutches, chainplate, mastGeo, spreaderGeo, M as YM } from './yacht.js';
import { CommitteeBoat, flagTexture, bannerTexture, finishes, RoundedBoxGeometry, tube, rod, Flag, officer } from './committee.js';

// ---------- her lines (blender/lagoon42.py's) ----------
const L = 12.8, ZS = 6.4, XC = 2.9;
export const LAGOON_WL = 12.3; // her hulls' waterline length
const BOTTOM = '#22324a'; // her antifouling
const tAt = (z) => clamp((ZS - z) / L, 0, 1);
const hbD = (t) => (t < 0.55 ? 0.86 + 0.08 * Math.sin((t / 0.55) * Math.PI / 2) : 0.94 * Math.max(0, Math.cos(((t - 0.55) / 0.45) * Math.PI / 2)) ** 0.85 + 0.015);
const sheer = (t) => 1.5 + 0.28 * t * t;
const deckY = (z) => sheer(tAt(z));
const halfB = (z) => hbD(tAt(z)); // a hull's half-breadth at the deck, about its own centreline
const floorY = (z) => deckY(z) + 0.03; // the bridgedeck's top: the cockpit's sole, the deck forward of the saloon
const CR_F = -2.42, CR_A = 1.85, ROOF1 = 3.26; // the saloon's front and aft faces, its roof's top
const HT_A = 5.55, HT1 = 3.7; // the hardtop's aft edge, its top
const NOTCH = { x: 1.95, z: 2.88 }; // the hatch in the hardtop over the helm: its inboard edge, its aft edge
// the hulls' tops aft: the deck, then the transom's steps down to the swim platform
const cutAt = (z) => (z <= 5.45 ? deckY(z) : z <= 5.7 ? 1.18 : z <= 5.93 ? 0.92 : z <= 6.15 ? 0.7 : 0.52);
const HELM = { x: 2.67, y: 2.12, z: 2.4 }; // where the helmsman stands, on the raised station
const BEAM_Z = -5.45, LONG_F = -6.2; // the crossbeam; the longeron's tip, where the forestay comes down
const TD = { y: 1.22, z: 6.12, L: 2.9 }; // the tender on the davits
const MZ = -0.55, MTOP = 21.0; // the mast's step on the saloon's roof, near its middle; the masthead
const SPR1 = { y: 9.6, w: 1.55, aft: 0.32 }, SPR2 = { y: 15.0, w: 1.05, aft: 0.24 }; // the spreaders: height, half-span, sweep
const bz0 = MZ + 0.2, bz1 = 5.2, by0 = 4.55, by1 = 4.72; // the boom: from the gooseneck to its end over the hardtop's aft edge
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
    const band = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) band[i] = deckY(p.getZ(i)) - p.getY(i);
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
// station and the benches and round the hardtop's posts. Metres to pixels; each shape drawn off the canvas and only
// its blurred shadow lands on it
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
  // the saloon's foot: its front bowed, its corners rounded (blender/lagoon42.py's cr_outline at its foot)
  soft(() => {
    const w = 3.04, pts = [];
    for (let i = 0; i <= 16; i++) { const xx = -w + (2 * w * i) / 16; pts.push([xx, CR_F - 0.02 + 0.34 * (xx / 3.02) ** 2]); }
    pts.forEach(([px, pz], i) => x[i ? 'lineTo' : 'moveTo'](X(px), Y(pz)));
    x.lineTo(X(w), Y(CR_A + 0.02)); x.lineTo(X(-w), Y(CR_A + 0.02)); x.closePath();
  }, 0.3, 0.6);
  for (const sx of [-1, 1]) { // along each hull's rails
    soft(() => { for (let i = 0; i <= 40; i++) { const z = lerp(-6.3, 5.4, i / 40); x[i ? 'lineTo' : 'moveTo'](X(sx * (XC + halfB(z) - 0.03)), Y(z)); } }, 0.1, 0.4, 0.05);
    soft(() => { x.moveTo(X(sx * 2.72 + 0.1), Y(5.28)); x.arc(X(sx * 2.72), Y(5.28), 0.1 * AO_S, 0, Math.PI * 2); }, 0.14, 0.6); // the hardtop's posts
  }
  soft(rect(2.1, 3.24, 1.84, 3.14), 0.22, 0.55); // the helm station
  soft(rect(-2.84, 1.52, 4.9, 5.46), 0.2, 0.55); // the aft bench
  soft(rect(-2.84, -2.28, 2.68, 4.96), 0.2, 0.55); // the port bench
  soft(rect(-1.6, -1.3, 3.65, 4.0), 0.25, 0.55); // the table's pedestal
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
// the jib rolled on its foil: the sacrificial strip's navy round it, a seam and a darker band spiralling up it
const JIB = canvasTex(64, 128, (x, w, h) => {
  x.fillStyle = '#2d4262'; x.fillRect(0, 0, w, h);
  for (let k = -2; k < 4; k++) {
    x.fillStyle = 'rgba(15,25,40,.35)'; x.beginPath(); x.moveTo(0, k * 48); x.lineTo(w, k * 48 + 40); x.lineTo(w, k * 48 + 52); x.lineTo(0, k * 48 + 12); x.fill();
    x.fillStyle = 'rgba(210,220,235,.22)'; x.beginPath(); x.moveTo(0, k * 48 + 24); x.lineTo(w, k * 48 + 64); x.lineTo(w, k * 48 + 66); x.lineTo(0, k * 48 + 26); x.fill();
  }
}, 1, 14);
// the stack pack's canvas: its zip down the top, the seams where the lazy jacks are sewn in
const BAG = canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = '#2b3a52'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.07)'; for (let v = 0; v < h; v += 32) x.fillRect(0, v, w, 2);
  x.fillStyle = 'rgba(0,0,0,.25)'; for (let u = 18; u < w; u += 28) x.fillRect(u, 0, 1, h);
  x.fillStyle = '#15191f'; x.fillRect(0, 0, 4, h); x.fillRect(w - 4, 0, 4, h);
  x.fillStyle = '#9aa3ad'; x.fillRect(0, 0, 1, h); x.fillRect(w - 1, 0, 1, h);
});

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
    // the stack pack's canvas, the furled jib, the bimini over the helm
    bag: new THREE.MeshStandardMaterial({ map: BAG, roughness: 0.92 }),
    jib: new THREE.MeshStandardMaterial({ map: JIB, roughness: 0.85 }),
    canvas: new THREE.MeshStandardMaterial({ color: '#3a4554', roughness: 0.9, side: THREE.DoubleSide }),
    // her cushions: a grey-taupe outdoor fabric
    cushion: new THREE.MeshStandardMaterial({ color: '#a69e8e', roughness: 0.95 }),
    // the lights: the masthead's and the spreaders' white lenses, the bow lights' red and green
    lamp: new THREE.MeshPhysicalMaterial({ color: '#f4f2ea', roughness: 0.15, clearcoat: 1, emissive: '#ffffff', emissiveIntensity: 0.05 }),
    port: new THREE.MeshStandardMaterial({ color: '#c0161a', roughness: 0.2, emissive: '#c0161a', emissiveIntensity: 0.25 }),
    starboard: new THREE.MeshStandardMaterial({ color: '#0e9a3a', roughness: 0.2, emissive: '#0e9a3a', emissiveIntensity: 0.25 }),
    // the solar panels on the hardtop: dark cells under glass, the sky in it
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

    // the moulded parts; the hulls in yacht.js's paint, a charcoal boot-top and cove line, her own wet line
    const hm = hullMaterial('#f5f5f2', '#2b3440', BOTTOM);
    this.sea = hm.userData.sea; this.sea.uHalfL.value = L / 2;
    root.add(new THREE.Mesh(MODEL.hull, hm));
    for (const k of ['deck', 'teak', 'roof', 'gel', 'glass', 'net', 'cushion', 'tube', 'dark']) if (MODEL[k]) root.add(new THREE.Mesh(MODEL[k], M[k]));

    // ---- the hulls' fittings ----
    for (const sx of [-1, 1]) {
      const X = sx * XC;
      // the rubbing strake round each hull's sheer, outside, round the stem and in along the trampoline
      const rub = [];
      for (let i = 0; i <= 36; i++) { const z = lerp(5.42, -6.33, i / 36); rub.push([X + sx * (halfB(z) + 0.025), deckY(z) - 0.07, z]); }
      for (let i = 0; i <= 10; i++) { const z = lerp(-6.33, -3.3, i / 10); rub.push([X - sx * (halfB(z) + 0.025), deckY(z) - 0.07, z]); }
      put('rail', tube(rub, 0.04, false, 8));
      // the lifelines: stanchions down the outer deck edge from the bow to the cockpit, the bow pulpit round the stem
      // and back along the trampoline's edge; two wires
      const top = [], posts = [];
      const zs = [-3.3, -4.3, -5.3, -5.95, -6.2];
      for (const z of zs) { const x = X - sx * (halfB(z) - 0.08); top.push([x, deckY(z) + 0.66, z]); posts.push([x, deckY(z), z]); }
      top.push([X, deckY(-6.28) + 0.66, -6.3]); posts.push([X, deckY(-6.28), -6.28]);
      for (const z of [-6.2, -5.7, -4.6, -3.4, -2.2, -1.0, 0.2, 1.4, 2.6, 3.8, 4.9]) { const x = X + sx * (halfB(z) - 0.08); top.push([x, deckY(z) + 0.66, z]); posts.push([x, deckY(z), z]); }
      put('steel', tube(top, 0.022, false, 8));
      put('steel', tube(top.slice(6).map(([x, y, z]) => [x, y - 0.33, z]), 0.008, false, 4));
      put('steel', tube(top.slice(0, 5).map(([x, y, z]) => [x, y - 0.33, z]), 0.008, false, 4));
      posts.forEach(([x, y, z], i) => {
        put('steel', rod([x, y, z], [x, y + 0.66, z], 0.018, 8));
        put('steel', new THREE.CylinderGeometry(0.032, 0.042, 0.03, 10).translate(x, y + 0.015, z)); // its base
      });
      // cleats: at the bow, amidships and on the quarter, on the outer deck edge
      for (const cz of [-5.75, -0.5, 4.95]) {
        const gx = new THREE.Group(); cleat(0.28).forEach(([g, m]) => gx.add(new THREE.Mesh(g, m)));
        gx.position.set(X + sx * (halfB(cz) - 0.2), deckY(cz) + 0.01, cz); root.add(gx);
      }
      // the deck hatches forward: their alloy frames, the smoked acrylic in them
      for (const [hz, hs] of [[-4.55, 0.5], [-2.9, 0.55], [0.6, 0.45]]) {
        put('steel', new RoundedBoxGeometry(hs + 0.08, 0.05, hs + 0.08, 2, 0.02).translate(X, deckY(hz) + 0.035, hz));
        put('glass', new THREE.BoxGeometry(hs, 0.02, hs).translate(X, deckY(hz) + 0.06, hz));
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
    for (const z of [-2.4, -0.4, 1.6, 3.5]) {
      const ex = -side * (XC + halfB(z)), fx = ex - side * 0.15, fy = deckY(z) - 0.62;
      put('fender', fenderGeo.clone().translate(fx, fy, z));
      put('rope', rod([fx, fy + 0.36, z], [ex + side * 0.08, deckY(z) + 0.34, z], 0.008, 4));
    }
    // "RACE COMMITTEE" on banners lashed to the lifelines, down each side
    for (const sx of [-1, 1]) {
      const z0 = -2.0, z1 = 1.2, zm = (z0 + z1) / 2, x = sx * (XC + Math.max(halfB(z0), halfB(z1)) - 0.06);
      put('banner', new THREE.PlaneGeometry(z1 - z0, 0.5).rotateY(sx * Math.PI / 2).translate(x, deckY(zm) + 0.4, zm));
    }

    // ---- forward: the bow roller on the longeron's tip, the anchor home on it, its rode down into the sea ahead ----
    const ty = sheer(tAt(LONG_F)) - 0.12;
    put('steel', new THREE.BoxGeometry(0.16, 0.12, 0.5).translate(0, ty + 0.06, LONG_F + 0.05));
    put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12).rotateZ(Math.PI / 2).translate(0, ty + 0.06, LONG_F - 0.18));
    put('steel', new THREE.ConeGeometry(0.16, 0.34, 3).scale(1, 1, 0.35).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, ty - 0.14, LONG_F - 0.35));
    put('steel', rod([0, ty + 0.08, LONG_F], [0, ty - 0.06, LONG_F - 0.28], 0.025, 8));
    const rode = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; rode.push([0, lerp(ty - 0.05, -3.2, u ** 0.8) - 0.4 * Math.sin(Math.PI * u), LONG_F - 0.25 - u * 8]); } // steeply down from her bridle
    put('dark', tube(rode, 0.025, false, 4));
    // the bridle's two legs from the longeron to each bow, and the windlass where the chain comes aboard
    for (const sx of [-1, 1]) lines.push(0, ty, LONG_F + 0.1, sx * (XC - 0.15), deckY(-6.0) - 0.05, -6.0);
    put('steel', new THREE.CylinderGeometry(0.1, 0.12, 0.18, 14).translate(0, floorY(-3.1) + 0.09, -2.95));

    // ---- the saloon: its sliding door, its roof's hatches, the grab rails ----
    put('glass', new THREE.BoxGeometry(1.4, 1.36, 0.04).translate(0.55, floorY(CR_A) + 0.7, CR_A + 0.05));
    put('steel', new THREE.BoxGeometry(1.48, 1.42, 0.02).translate(0.55, floorY(CR_A) + 0.71, CR_A + 0.035));
    put('steel', rod([-0.08, floorY(CR_A) + 0.6, CR_A + 0.08], [-0.08, floorY(CR_A) + 1.0, CR_A + 0.08], 0.012, 6)); // its handle
    for (const hx of [-1.6, 1.6]) {
      put('steel', new RoundedBoxGeometry(0.62, 0.05, 0.62, 2, 0.02).translate(hx, ROOF1 + 0.02, -0.2));
      put('glass', new THREE.BoxGeometry(0.54, 0.02, 0.54).translate(hx, ROOF1 + 0.045, -0.2));
      const gr = [[hx * 1.65, ROOF1, -1.6], [hx * 1.65, ROOF1 + 0.08, -1.5], [hx * 1.65, ROOF1 + 0.08, 0.9], [hx * 1.65, ROOF1, 1.0]];
      put('steel', tube(gr, 0.016, false, 6));
    }
    // ---- on the hardtop: four solar panels ----
    for (const px of [-2.25, -0.75, 0.75, 2.25]) {
      put('steel', new THREE.BoxGeometry(1.38, 0.03, 1.55).translate(px, HT1 + 0.025, 4.0));
      put('solar', new THREE.BoxGeometry(1.32, 0.02, 1.49).translate(px, HT1 + 0.045, 4.0));
    }
    // ---- the helm: its wheel, the plotter and the throttles on the console; the winches and the clutches on the
    // saloon roof's aft edge beside it, where every line from the mast comes; the bimini over the helm's hatch ----
    const w = wheel(0.34, 6, YM.dark, YM.steel);
    w.rotation.x = -0.35; w.position.set(2.7, 2.7, 2.22); root.add(w);
    bake(display(0.34, 0.24, 3), 2.52, 2.88, 2.0, 0, -0.85);
    bake(display(0.2, 0.14, 0), 2.92, 2.9, 1.98, 0, -0.85);
    for (const dx of [2.9, 2.97]) put('steel', rod([dx, 2.82, 2.08], [dx, 2.95, 2.12], 0.01, 6));
    for (const wx of [1.62, 2.02]) bake(winch(0.07, 0.17), wx, ROOF1 + 0.005, 1.62);
    bake(clutches(5), 1.0, ROOF1 + 0.005, 1.45);
    for (let k = 0; k < 5; k++) { // the halyards and reefing lines from the mast's foot aft over the roof to the clutches
      const x0 = 0.12 + k * 0.04, x1 = 1.0 + (k - 2) * 0.075;
      lines.push(x0 * 0.6, ROOF1 + 0.35, MZ + 0.15, x0, ROOF1 + 0.03, MZ + 0.5, x0, ROOF1 + 0.03, MZ + 0.5, x1, ROOF1 + 0.03, 1.25);
    }
    { // the bimini: its canvas over two stainless bows, a little domed
      const x0 = NOTCH.x - 0.02, x1 = 3.2, z0 = 1.6, z1 = NOTCH.z + 0.04, yb = HT1 + 0.52, pos = [], idx = [], NX = 8, NZ = 6;
      for (let i = 0; i <= NZ; i++) for (let j = 0; j <= NX; j++) {
        const u = j / NX, v = i / NZ;
        pos.push(lerp(x0, x1, u), yb + 0.08 * Math.sin(Math.PI * u) - 0.05 * Math.abs(2 * v - 1) ** 3, lerp(z0, z1, v));
      }
      for (let i = 0; i < NZ; i++) for (let j = 0; j < NX; j++) { const a0 = i * (NX + 1) + j; idx.push(a0, a0 + NX + 1, a0 + 1, a0 + 1, a0 + NX + 1, a0 + NX + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      put('canvas', g);
      for (const z of [z0 + 0.06, z1 - 0.06]) {
        const bow = [];
        for (let j = 0; j <= 8; j++) { const u = j / 8; bow.push([lerp(x0 + 0.02, x1 - 0.02, u), yb - 0.02 + 0.08 * Math.sin(Math.PI * u) - 0.05, z]); }
        put('steel', tube([[x0 + 0.02, HT1, z], ...bow, [x1 - 0.02, HT1, z]], 0.014, false, 6));
      }
    }
    // ---- the davits: an arm from each side of the aft beam, the tender hung on them ----
    for (const dx of [-1.05, 1.05]) {
      const a = [dx, floorY(5.5) + 0.5, 5.48], b = [dx, 2.32, 5.9], c = [dx, 2.36, 6.18];
      put('steel', tube([a, [dx, 2.05, 5.6], b, c], 0.035, false, 8));
      put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateZ(Math.PI / 2).translate(dx, 2.32, 6.18));
      lines.push(dx, 2.3, 6.18, dx * 0.9, TD.y + 0.18, TD.z);
    }
    // ---- the rails down the transom steps, inboard, and the navigation lights on the bow pulpits ----
    for (const sx of [-1, 1]) {
      const xi = (z) => sx * (XC - halfB(z) + 0.14);
      const rail = [[xi(5.2), deckY(5.2) + 0.78, 5.2], [xi(5.5), 1.18 + 0.8, 5.6], [xi(5.85), 0.92 + 0.8, 5.85], [xi(6.1), 0.7 + 0.8, 6.08], [xi(6.25), 0.52 + 0.75, 6.25]];
      put('steel', tube(rail, 0.017, false, 8));
      for (const [x, y, z] of [rail[0], rail[2], rail[4]]) put('steel', rod([x, y, z], [x, cutAt(z), z], 0.016, 6));
      const nz = -6.08, nx = sx * (XC + halfB(nz) * 0.4), ny = deckY(nz) + 0.68;
      put(sx > 0 ? 'starboard' : 'port', new RoundedBoxGeometry(0.07, 0.06, 0.1, 1, 0.01).translate(nx + sx * 0.03, ny + 0.04, nz));
      put('dark', new THREE.BoxGeometry(0.05, 0.075, 0.12).translate(nx + sx * 0.005, ny + 0.04, nz));
      // the trampoline laced to the hull along its inner edge
      const lace = [];
      for (let i = 0; i <= 24; i++) {
        const z = lerp(-5.33, -3.3, i / 24), xe = sx * (XC - halfB(z));
        lace.push(xe + sx * (i % 2 ? 0.0 : 0.05), deckY(z) - (i % 2 ? 0.06 : 0.09), z);
      }
      for (let i = 0; i < lace.length - 3; i += 3) lines.push(lace[i], lace[i + 1], lace[i + 2], lace[i + 3], lace[i + 4], lace[i + 5]);
      put('dark', tube(Array.from({ length: 9 }, (_, i) => { const z = lerp(-5.33, -3.3, i / 8); return [sx * (XC - halfB(z) + 0.05), deckY(z) - 0.09, z]; }), 0.013, false, 5));
    }

    // ---- the rig ----
    // the mast: a pear section, deeper fore and aft than wide, tapering above the upper spreaders; stepped on the
    // saloon's roof near its middle, further aft than most cruising cats, as the 42's is
    put('spar', mastGeo(MTOP - ROOF1, 0.3, 0.17, 0.17, 0.11, 0.72).translate(0, (ROOF1 + MTOP) / 2, MZ));
    put('steel', new RoundedBoxGeometry(0.34, 0.12, 0.46, 2, 0.03).translate(0, ROOF1 + 0.06, MZ)); // its step
    put('dark', new THREE.BoxGeometry(0.2, 0.14, 0.12).translate(0, by0 + 0.02, MZ + 0.2)); // the gooseneck
    // two pairs of spreaders, swept aft, aerofoil struts; their lights under the lower pair
    const tip = (S, sx) => [sx * S.w, S.y, MZ + S.aft];
    for (const S of [SPR1, SPR2]) for (const sx of [-1, 1]) {
      const r0 = [sx * 0.08, S.y, MZ], t1 = tip(S, sx), len = Math.hypot(t1[0] - r0[0], t1[2] - r0[2]);
      put('spar', spreaderGeo(len, 0.03, 0.018).rotateZ(-sx * Math.PI / 2).rotateY(-sx * Math.atan2(S.aft, S.w - 0.08)).translate((r0[0] + t1[0]) / 2, S.y, (r0[2] + t1[2]) / 2));
    }
    for (const sx of [-1, 1]) put('lamp', new THREE.BoxGeometry(0.06, 0.03, 0.08).translate(sx * 0.35, SPR1.y - 0.04, MZ + 0.07));
    put('lamp', new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(0, 11.2, MZ - 0.17)); // the steaming light
    // the shrouds: the caps over both spreaders' tips to the hounds, the intermediates over the lower ones, the lowers;
    // all to chainplates on the hulls' decks a little aft of the mast
    const hounds = 18.4, chain = (sx) => [sx * 3.3, deckY(MZ + 0.7) + 0.03, MZ + 0.7], chainL = (sx) => [sx * 3.08, deckY(MZ + 0.25) + 0.03, MZ + 0.25];
    for (const sx of [-1, 1]) {
      const c = chain(sx), cl = chainL(sx), a = tip(SPR1, sx), b = tip(SPR2, sx);
      lines.push(...c, ...a, ...a, ...b, ...b, 0, hounds, MZ); // the cap shroud
      lines.push(...c, ...a, ...a, 0, SPR2.y - 0.1, MZ); // the intermediate
      lines.push(...cl, 0, SPR1.y - 0.15, MZ); // the lower
      bake(chainplate(c, a), 0, 0, 0); bake(chainplate(cl, [0, SPR1.y, MZ]), 0, 0, 0);
    }
    // the forestay from the hounds to the longeron's tip, the jib furled round it over its drum; its sheet from the
    // furled clew to the car on the self-tacking track across the roof ahead of the mast, and on to the mast's foot
    const tack = [0, ty + 0.2, LONG_F + 0.12], head = [0, hounds, MZ - 0.14];
    lines.push(...tack, ...head);
    put('dark', new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16).translate(...tack).translate(0, 0.1, 0));
    const dir = new THREE.Vector3(...head).sub(new THREE.Vector3(...tack)), fl = dir.length(); dir.normalize();
    const along = (u) => [tack[0] + dir.x * fl * u, tack[1] + dir.y * fl * u, tack[2] + dir.z * fl * u];
    put('jib', taper(along(0.03), along(0.3), 0.1, 0.125, 16));
    put('jib', taper(along(0.3), along(0.75), 0.125, 0.075, 16));
    put('jib', taper(along(0.75), along(0.93), 0.075, 0.03, 16));
    const trackR = 4.6, track = [];
    for (let i = 0; i <= 12; i++) { const x = lerp(-1.4, 1.4, i / 12); track.push([x, ROOF1 + 0.025, tack[2] + Math.sqrt(trackR * trackR - x * x)]); }
    put('steel', tube(track, 0.022, false, 6));
    const car = [0, ROOF1 + 0.06, tack[2] + trackR];
    put('dark', new RoundedBoxGeometry(0.12, 0.06, 0.1, 1, 0.015).translate(...car));
    const clew = along(0.07);
    lines.push(clew[0] + 0.05, clew[1], clew[2] + 0.1, ...car, ...car, 0.1, ROOF1 + 0.3, MZ - 0.15);
    // the boom, high over the hardtop; the mainsail stowed in its bag on it, held up by the lazy jacks; the mainsheet's
    // tackle down to its traveller on the hardtop's aft end, and the topping lift
    put('spar', new RoundedBoxGeometry(0.15, 0.27, bz1 - bz0, 2, 0.05).rotateX(-Math.atan2(by1 - by0, bz1 - bz0)).translate(0, (by0 + by1) / 2, (bz0 + bz1) / 2));
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
      const legs = [0.5, 1.9, 3.4].map((z) => [sx * 0.19, bagTop(z) - 0.06, z]), j1 = [sx * 0.42, 6.6, 0.9], j2 = [sx * 0.3, 7.6, 2.2], top = [sx * 0.12, 8.6, MZ + 0.12];
      lines.push(...legs[0], ...j1, ...legs[1], ...j1, ...j1, ...top, ...legs[1], ...j2, ...legs[2], ...j2, ...j2, ...top);
    }
    const ms = [0, HT1 + 0.08, 5.05], mb = [0, boomY(5.05) - 0.16, 5.05];
    put('steel', new THREE.BoxGeometry(2.8, 0.035, 0.07).translate(0, HT1 + 0.02, 5.05)); // the traveller
    put('dark', new RoundedBoxGeometry(0.16, 0.05, 0.1, 1, 0.015).translate(0, HT1 + 0.055, 5.05));
    bake(block(0.05), ...mb); bake(block(0.05), ...ms);
    for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 0.022; lines.push(dx, mb[1] - 0.04, 5.05, dx, ms[1] + 0.05, 5.05); }
    lines.push(0, by1, bz1, 0, MTOP - 0.1, MZ + 0.05);
    // at the masthead: its crane, the tricolour and anchor light, the wind vane on its stalk, the wind sensor, the VHF whip
    put('spar', new RoundedBoxGeometry(0.14, 0.12, 0.42, 2, 0.03).translate(0, MTOP + 0.04, MZ + 0.08));
    put('lamp', new THREE.CylinderGeometry(0.04, 0.045, 0.12, 10).translate(0, MTOP + 0.16, MZ - 0.02));
    put('steel', rod([0, MTOP + 0.06, MZ + 0.25], [0, MTOP + 0.4, MZ + 0.42], 0.008, 4));
    put('dark', new THREE.BoxGeometry(0.008, 0.02, 0.36).translate(0, MTOP + 0.42, MZ + 0.42)); // the vane's arrow
    for (const sx of [-1, 1]) put('dark', new THREE.BoxGeometry(0.006, 0.12, 0.1).translate(sx * 0.03, MTOP + 0.42, MZ + 0.58));
    put('steel', rod([0.05, MTOP + 0.06, MZ + 0.2], [0.05, MTOP + 0.35, MZ + 0.2], 0.008, 4));
    put('dark', new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10).translate(0.05, MTOP + 0.38, MZ + 0.2));
    put('dark', new THREE.CylinderGeometry(0.006, 0.008, 1.0, 4).translate(-0.06, MTOP + 0.55, MZ + 0.1));

    // ---- the signals ----
    // the four signal halyards from blocks on the lower spreaders down to the saloon's roof. Starboard outer: the
    // class flag; port outer: P (or U, or black); starboard inner: X; port inner: the first substitute
    this.flags = {};
    const rH = ROOF1 + 0.9;
    const hal = { cls: [SPR1.w - 0.05, 1.95], P: [-(SPR1.w - 0.05), -1.95], X: [0.8, 1.05], sub: [-0.8, -1.05] };
    for (const [k, [xt, xb]] of Object.entries(hal)) {
      const zt = MZ + SPR1.aft * Math.abs(xt) / SPR1.w + 0.02;
      const topP = new THREE.Vector3(xt, SPR1.y - 0.12, zt), bot = new THREE.Vector3(xb, ROOF1 + 0.02, MZ + 0.9);
      lines.push(topP.x, topP.y, topP.z, bot.x, bot.y, bot.z);
      put('dark', new THREE.SphereGeometry(0.035, 6, 4).translate(topP.x, topP.y + 0.04, topP.z)); // its block
      const f = new Flag(flagTexture(k), k === 'sub' ? 1.3 : 1.2, 0.85, k === 'sub');
      f.top = topP; f.bot = new THREE.Vector3().lerpVectors(bot, topP, (rH + 0.9 - bot.y) / (topP.y - bot.y)); f.h = 0;
      root.add(f.pivot); this.flags[k] = f;
    }
    this.prepTex = { P: this.flags.P.mat.map, U: flagTexture('U'), B: flagTexture('B') };
    this.burgee = new Flag(flagTexture('burgee'), 0.75, 0.45, true);
    this.burgee.pivot.position.set(0, MTOP + 0.95, MZ); root.add(this.burgee.pivot);
    put('dark', new THREE.CylinderGeometry(0.01, 0.01, 0.95, 4).translate(0, MTOP + 0.48, MZ));
    // the black ball forward of the mast, the day shape of a vessel at anchor
    const ballY = 7.4, ballZ = MZ - 1.45;
    put('dark', new THREE.SphereGeometry(0.3, 12, 9).translate(0, ballY, ballZ));
    lines.push(0, ballY + 0.3, ballZ, 0, SPR1.y - 0.2, MZ - 0.12, 0, ballY - 0.3, ballZ, 0, ROOF1 + 0.02, -2.1);
    // the orange flag on its staff at the stern of the hull nearer the line: her end of the starting line
    const oz = clamp(lineZ, 3.6, 4.6), ox = side * (XC + halfB(oz) - 0.12), oy = deckY(oz);
    put('steel', rod([ox, oy, oz], [ox, oy + 3.6, oz], 0.03, 6));
    put('steel', new THREE.SphereGeometry(0.05, 8, 6).translate(ox, oy + 3.62, oz));
    this.orange = new Flag(flagTexture('orange'), 1.3, 0.9);
    this.orange.pivot.position.set(ox, oy + 3.55, oz); root.add(this.orange.pivot);

    // ---- the officers: the race officer at the helm station with binoculars, a hand on the halyards by the mast, the
    // line sighter by the orange flag, the timekeeper with the horn in the cockpit, the recorder on the saloon's roof ----
    const face = side > 0 ? 0 : Math.PI; // they face the line
    const crew = [
      { at: [HELM.x - 0.15, HELM.y, HELM.z], jacket: '#1d3557', pose: 'glasses', yaw: face },
      { at: [side * 0.75, ROOF1, MZ + 0.75], jacket: '#c8342b', pose: 'halyard', yaw: face },
      { at: [side * (XC + halfB(oz) - 0.55), oy, oz + 0.5], jacket: '#ff7a1a', pose: 'glasses', yaw: face - side * 0.35 },
      { at: [side > 0 ? 1.0 : -0.3, floorY(4.6), 4.6], jacket: '#1d3557', pose: 'horn', yaw: face + side * 0.25 },
      { at: [-side * 1.45, ROOF1, 1.2], jacket: '#f2f1ec', pose: 'board', yaw: face + side * 0.5 },
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
