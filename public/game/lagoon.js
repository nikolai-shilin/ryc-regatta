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
import { hullMaterial, NONSKID, cleat, wheel, display, M as YM } from './yacht.js';
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
const HELM = { x: 2.67, y: 2.12, z: 2.4 }; // where the helmsman stands, on the raised station
const BEAM_Z = -5.45, LONG_F = -6.2; // the crossbeam; the longeron's tip, where the forestay comes down
const TD = { y: 1.22, z: 6.12, L: 2.9 }; // the tender on the davits
const MZ = -1.5, MTOP = 21.0; // the mast's step on the saloon's roof; the masthead
const SPR1 = { y: 10.0, w: 1.6, aft: 0.3 }, SPR2 = { y: 15.6, w: 1.1, aft: 0.22 }; // the spreaders: height, half-span, sweep

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
    // the stack pack's canvas, and the furled jib's sacrificial strip
    bag: new THREE.MeshStandardMaterial({ color: '#2b3a52', roughness: 0.9 }),
    strip: new THREE.MeshStandardMaterial({ color: '#33465f', roughness: 0.85 }),
    // the solar panels on the hardtop: dark cells under glass, the sky in it
    solar: new THREE.MeshPhysicalMaterial({ color: '#141c2a', roughness: 0.1, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }),
    rail: new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.5 }), // the rubbing strakes
  };
}

// a surface lofted through sections of n points each, closed round; the ends capped
function loftGeometry(secs, capped = true) {
  const n = secs[0].length, pos = [], idx = [];
  for (const s of secs) for (const p of s) pos.push(...p);
  for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + ((k + 1) % n), c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  if (capped) for (const [i, flip] of [[0, true], [secs.length - 1, false]]) {
    const ctr = secs[i].reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n, m[2] + p[2] / n], [0, 0, 0]);
    const ci = pos.length / 3; pos.push(...ctr);
    for (let k = 0; k < n; k++) { const a = i * n + k, b = i * n + ((k + 1) % n); idx.push(...(flip ? [ci, b, a] : [ci, a, b])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
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
      ...G, gel: F.gel, glass: F.glass, steel: YM.steel, cushion: F.cushion, rope: F.rope, fender: F.fender, wood: YM.teak,
      orange: new THREE.MeshStandardMaterial({ color: '#ff6a10', roughness: 0.55 }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.8, side: THREE.DoubleSide }),
    };
    const bin = {}; // static parts, merged per material
    const put = (k, g) => (bin[k] ||= []).push(g);
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
    // ---- on the hardtop: four solar panels, the mainsheet's traveller ----
    for (const px of [-2.25, -0.75, 0.75, 2.25]) {
      put('steel', new THREE.BoxGeometry(1.38, 0.03, 1.55).translate(px, HT1 + 0.025, 4.0));
      put('solar', new THREE.BoxGeometry(1.32, 0.02, 1.49).translate(px, HT1 + 0.045, 4.0));
    }
    put('steel', new THREE.BoxGeometry(2.6, 0.04, 0.08).translate(0, HT1 + 0.03, 2.75));
    put('dark', new THREE.BoxGeometry(0.16, 0.08, 0.12).translate(0, HT1 + 0.08, 2.75));
    // ---- the helm: its wheel, the screen and the throttles on the console ----
    const w = wheel(0.34, 6, YM.dark, YM.steel);
    w.rotation.x = -0.35; w.position.set(2.69, 2.72, 2.27); root.add(w);
    const disp = new THREE.Group(); display(0.32, 0.22, 3).forEach(([g, m]) => disp.add(new THREE.Mesh(g, m)));
    disp.rotation.x = -0.9; disp.position.set(2.5, 2.92, 2.05); root.add(disp);
    for (const dx of [2.95, 3.02]) put('steel', rod([dx, 2.86, 2.1], [dx, 2.98, 2.15], 0.01, 6));
    // ---- the davits: an arm from each side of the aft beam, the tender hung on them ----
    for (const dx of [-1.05, 1.05]) {
      const a = [dx, floorY(5.5) + 0.5, 5.48], b = [dx, 2.32, 5.9], c = [dx, 2.36, 6.18];
      put('steel', tube([a, [dx, 2.05, 5.6], b, c], 0.035, false, 8));
      put('steel', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateZ(Math.PI / 2).translate(dx, 2.32, 6.18));
      lines.push(dx, 2.3, 6.18, dx * 0.9, TD.y + 0.18, TD.z);
    }

    // ---- the rig ----
    // the mast: a pear section, deeper fore and aft than wide, tapering to the masthead
    const mastSecs = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, y = lerp(ROOF1, MTOP, u), k = 1 - 0.38 * Math.max(0, (u - 0.55) / 0.45) ** 1.5;
      const ring = [];
      for (let j = 0; j < 14; j++) { const a = (j / 14) * Math.PI * 2; ring.push([Math.sin(a) * 0.09 * k, y, MZ - Math.cos(a) * 0.16 * k * (Math.cos(a) > 0 ? 1 : 0.8)]); }
      mastSecs.push(ring);
    }
    put('spar', loftGeometry(mastSecs));
    put('steel', new THREE.BoxGeometry(0.3, 0.1, 0.42).translate(0, ROOF1 + 0.05, MZ)); // its step
    // two pairs of spreaders, swept aft; the shrouds over their tips to the chainplates on the hulls' decks
    const tip = (S, sx) => [sx * S.w, S.y, MZ + S.aft];
    for (const S of [SPR1, SPR2]) for (const sx of [-1, 1]) {
      put('spar', taper([sx * 0.08, S.y, MZ], tip(S, sx), 0.04, 0.02, 8));
    }
    const chain = (sx) => [sx * 3.25, deckY(-0.9) + 0.03, -0.9];
    for (const sx of [-1, 1]) {
      const c = chain(sx), a = tip(SPR1, sx), b = tip(SPR2, sx);
      lines.push(...c, ...a, ...a, ...b, ...b, 0, MTOP - 1.6, MZ); // the cap shroud
      lines.push(...c, ...a, ...a, 0, SPR2.y - 0.1, MZ); // the intermediate
      lines.push(sx * 2.9, deckY(-1.6) + 0.03, -1.7, 0, SPR1.y - 0.15, MZ); // the lower
      put('steel', rod(c, [c[0] - sx * 0.02, c[1] + 0.32, c[2]], 0.016, 6));
    }
    // the forestay to the longeron's tip, the jib furled round it, its drum
    const tack = [0, ty + 0.2, LONG_F + 0.12], head = [0, MTOP - 1.4, MZ - 0.12];
    lines.push(...tack, ...head);
    put('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.2, 14).translate(...tack).translate(0, 0.1, 0));
    const dir = new THREE.Vector3(...head).sub(new THREE.Vector3(...tack)), fl = dir.length(); dir.normalize();
    const along = (u) => [tack[0] + dir.x * fl * u, tack[1] + dir.y * fl * u, tack[2] + dir.z * fl * u];
    put('strip', taper(along(0.05), along(0.42), 0.12, 0.09, 12));
    put('strip', taper(along(0.42), along(0.86), 0.09, 0.05, 12));
    for (let k = 1; k <= 7; k++) put('strip', taper(along(0.05 + k * 0.1), along(0.05 + k * 0.1 + 0.012), 0.125 - k * 0.008, 0.125 - k * 0.008, 12)); // the wraps' edges
    // the boom, the mainsail stowed in its bag along the top of it, the lazy jacks that hold the bag up
    const bz0 = MZ + 0.2, bz1 = 4.55, by0 = 4.6, by1 = 4.78;
    const boomY = (z) => lerp(by0, by1, (z - bz0) / (bz1 - bz0));
    put('spar', new RoundedBoxGeometry(0.14, 0.26, bz1 - bz0, 2, 0.05).rotateX(-Math.atan2(by1 - by0, bz1 - bz0)).translate(0, (by0 + by1) / 2, (bz0 + bz1) / 2));
    put('spar', rod([0, ROOF1 + 1.0, MZ + 0.15], [0, by0 - 0.05, bz0 + 0.6], 0.03, 8)); // the vang
    const bag = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, z = lerp(bz0 + 0.05, bz1 - 0.15, u), hw = lerp(0.3, 0.2, u), hh = lerp(0.62, 0.32, u) * (1 - 0.6 * (1 - Math.min(1, (u + 0.08) * 6)) ** 2);
      const yb = boomY(z) + 0.12, ring = [];
      for (let j = 0; j < 16; j++) {
        const a = (j / 16) * Math.PI * 2, cx = Math.sin(a), cy = Math.cos(a);
        const sq = Math.sign(cx) * Math.abs(cx) ** 0.6, h = cy > 0 ? yb + hh * cy ** 0.8 : yb + 0.03 * cy;
        ring.push([sq * hw * (cy > 0 ? 1 - 0.35 * cy ** 3 : 1), h, z]);
      }
      bag.push(ring);
    }
    put('bag', loftGeometry(bag));
    put('dark', new THREE.BoxGeometry(0.04, 0.02, bz1 - bz0 - 0.3).translate(0, boomY((bz0 + bz1) / 2) + 0.12 + 0.62 * 0.8, (bz0 + bz1) / 2 - 0.1)); // its zip
    for (const sx of [-1, 1]) for (const z of [0.6, 2.4]) {
      const hh = lerp(0.62, 0.32, (z - bz0) / (bz1 - bz0));
      lines.push(sx * 0.25, boomY(z) + 0.12 + hh * 0.5, z, sx * 0.3, 8.0, MZ + 0.15);
    }
    // the mainsheet from the boom down to its traveller, and the topping lift
    lines.push(0, by0 + 0.02, 2.75, 0, HT1 + 0.1, 2.75);
    lines.push(0, by1, bz1 - 0.05, 0, MTOP - 0.1, MZ + 0.05);
    // at the masthead: the wind vane, the VHF aerial, the light
    put('dark', new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4).translate(0.05, MTOP + 0.5, MZ));
    put('steel', rod([0, MTOP + 0.05, MZ], [0, MTOP + 0.05, MZ + 0.45], 0.008, 4));
    put('dark', new THREE.BoxGeometry(0.01, 0.14, 0.22).translate(0, MTOP + 0.12, MZ + 0.5));

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
    const ballY = 7.6, ballZ = MZ - 1.2;
    put('dark', new THREE.SphereGeometry(0.3, 12, 9).translate(0, ballY, ballZ));
    lines.push(0, ballY + 0.3, ballZ, 0, SPR1.y - 0.2, MZ - 0.1, 0, ballY - 0.3, ballZ, 0, floorY(-2.8) + 0.05, -2.8);
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
      { at: [-side * 1.1, ROOF1, 0.6], jacket: '#f2f1ec', pose: 'board', yaw: face + side * 0.5 },
    ];
    crew.forEach((c, i) => {
      const s = officer(i, c.jacket, c.pose);
      s.g.position.set(c.at[0], c.at[1] + 0.94 * 1.1, c.at[2]); s.g.rotation.y = c.yaw;
      root.add(s.g);
    });

    // put it together
    for (const [k, gs] of Object.entries(bin)) {
      const g = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => { for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n); if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }));
      root.add(new THREE.Mesh(g, M[k]));
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a3f46' })));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.material.alphaTest; } });
  }
}
// her signals are run as the motor cruiser's are: hoisted and lowered along their halyards, the blue flag in the
// class flag's place on a finish line
LagoonCommittee.prototype.update = CommitteeBoat.prototype.update;
LagoonCommittee.prototype.finishing = CommitteeBoat.prototype.finishing;
