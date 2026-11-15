// Regatta: the racing yacht, built in code — a 34-foot racer-cruiser: lofted hull, deck and fittings, carbon rig,
// square-top main with battens and a sail number, jib, asymmetric gennaker on a bowsprit.
// Local frame: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rigidSkin } from './skin.js';
import { sponsor } from './sponsor.js';
import { D2R, clamp, lerp, waveHeight } from './sim.js';
import { VENUE } from './venues.js';
// a file next to this module, by the address the page's import map gives it: its content's hash after a deploy
// (scripts/stamp-game.mjs), so it is cached for good; the plain address where there is none (npm run dev)
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);

export const L = 10.4, B = 3.35, MAST_Z = -0.9;
const BOW_Z = -L / 2, STERN_Z = L / 2;

// ---------- the lines ----------
// t = 0 at the transom, 1 at the stem
const halfBeam = (t) => (B / 2) * (t < 0.42 ? 0.84 + 0.16 * Math.sin((t / 0.42) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.42) / 0.58) * Math.PI / 2)) ** 0.85);
export const sheerAt = (t) => 1.0 + 0.22 * t ** 1.6;
const canoe = (t) => 0.62 * Math.sin(Math.PI * Math.min(1, t * 0.93 + 0.05)) ** 0.75; // the canoe body's depth
const zAt = (t) => STERN_Z - t * L;
const tAt = (z) => clamp((STERN_Z - z) / L, 0, 1);
const deckY = (z) => sheerAt(tAt(z));
const hbAt = (z) => halfBeam(tAt(z));

// the topsides' flare, as blender/yacht.py's FLARE: at the waterline the hull is this much narrower than at the deck
const FLARE = 0.09;
// one point of a section: s = 0 at the deck edge … 1 at the keel; a superellipse, boxy aft and V-shaped forward
function section(t, s) {
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 1.6, clamp((t - 0.45) / 0.55, 0, 1));
  const phi = (s * Math.PI) / 2, c = Math.cos(phi), sn = Math.sin(phi), yr = sn ** (2 / n);
  const x = hb * c ** (2 / n) * (1 - FLARE * sn); // flare in the topsides: the waterline narrower than the deck
  let dz = 0;
  if (t > 0.88) dz = 0.4 * yr * ((t - 0.88) / 0.12) ** 2; // the stem rakes: the forefoot sits aft of the stem head
  // the transom stays vertical, as on a modern racer
  return [x, sy - (sy + d) * yr, dz];
}

// hull paint: gloss gelcoat with a boot-top, antifouling below it and a cove stripe under the sheer, drawn crisp in the shader.
// The topsides are lacquered: a clear coat over the colour, so a hull (a dark one most of all) shows its shape by what
// it mirrors — a band of sky along the topsides, the sea below it, the sun's highlight. The antifouling is matt.
export function hullMaterial(hull, stripe, bottom = '#5b1f24') { // bottom: the antifouling, the player's choice (dark red on the others)
  const m = new THREE.MeshPhysicalMaterial({ color: hull, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStripe = { value: new THREE.Color(stripe) }; sh.uniforms.uBottom = { value: new THREE.Color(bottom) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float band; varying float vBand; varying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = band; vY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uStripe, uBottom; varying float vBand; varying float vY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float aa = fwidth(vY) * 1.2, ab = fwidth(vBand) * 1.2;
        float boot = smoothstep(0.07 - aa, 0.07 + aa, vY) * (1.0 - smoothstep(0.19 - aa, 0.19 + aa, vY));
        float under = 1.0 - smoothstep(0.07 - aa, 0.07 + aa, vY);
        float cove = smoothstep(0.1 - ab, 0.1 + ab, vBand) * (1.0 - smoothstep(0.135 - ab, 0.135 + ab, vBand));
        diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, max(boot, cove));
        diffuseColor.rgb = mix(diffuseColor.rgb, uBottom, under);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= 1.0 - under; material.roughness = mix(material.roughness, 0.75, under);`);
  };
  m.customProgramCacheKey = () => 'hull';
  return m;
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
  const hole = new THREE.Path(), x0 = 0.95, z0 = 1.5, z1 = 4.75, r = 0.25;
  hole.moveTo(-x0 + r, -z0); hole.lineTo(x0 - r, -z0); hole.quadraticCurveTo(x0, -z0, x0, -z0 - r);
  hole.lineTo(x0, -z1 + r); hole.quadraticCurveTo(x0, -z1, x0 - r, -z1); hole.lineTo(-x0 + r, -z1);
  hole.quadraticCurveTo(-x0, -z1, -x0, -z1 + r); hole.lineTo(-x0, -z0 - r); hole.quadraticCurveTo(-x0, -z0, -x0 + r, -z0);
  sh.holes.push(hole);
  const g = new THREE.ShapeGeometry(sh, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = -p.getY(i); p.setXYZ(i, x, deckY(z) + 0.05 * (1 - (x / Math.max(hbAt(z), 0.3)) ** 2), z); }
  g.computeVertexNormals();
  return g;
}

// the coachroof: a rounded trapezoid, raised off the deck
function coachroofGeometry() {
  const s = new THREE.Shape(), a = 1.12, f = 0.72, za = 1.45, zf = -2.0, r = 0.3;
  s.moveTo(-a + r, -za); s.lineTo(a - r, -za); s.quadraticCurveTo(a, -za, a - 0.02, -za - r);
  s.lineTo(f, -zf - r); s.quadraticCurveTo(f - 0.02, -zf, f - r, -zf); s.lineTo(-f + r, -zf);
  s.quadraticCurveTo(-f + 0.02, -zf, -f, -zf - r); s.lineTo(-a + 0.02, -za - r); s.quadraticCurveTo(-a, -za, -a + r, -za);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// the hull with its keel and rudder, the deck, the cockpit and the coachroof, modelled in Blender
// (docs/design/blender/game_yacht.py) on the lines above: a chine aft, a raked coachroof front with a window band, seats
// and an open transom. Its parts come by material name; if the file doesn't load in 8 s, the boat is built from the
// lines above instead.
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

// shade baked into the deck: soft and dark where it meets the coachroof, the coamings, the toe rails and the
// forehatch, so the deck reads as a surface with things standing on it. Drawn in plan, metres to pixels; each shape
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
  // the coachroof's footprint (see coachroofGeometry), a little wider for its bevel
  const a = 1.18, f = 0.78, za = 1.51, zf = -2.06;
  soft(() => { x.moveTo(X(-a), Y(za)); x.lineTo(X(a), Y(za)); x.lineTo(X(f), Y(zf)); x.lineTo(X(-f), Y(zf)); x.closePath(); }, 0.35, 0.6);
  for (const sx of [-1, 1]) soft(() => { x.moveTo(X(sx * 0.98), Y(1.5)); x.lineTo(X(sx * 0.98), Y(3.7)); }, 0.16, 0.5, 0.06); // coamings
  soft(() => { for (let i = 0; i <= 40; i++) { const t = i / 40; x[i ? 'lineTo' : 'moveTo'](X(halfBeam(t) - 0.02), Y(zAt(t))); }
    for (let i = 40; i >= 0; i--) { const t = i / 40; x.lineTo(X(-(halfBeam(t) - 0.02)), Y(zAt(t))); } }, 0.1, 0.45, 0.05); // toe rails
  soft(() => x.rect(X(-0.4), Y(-3.3), 0.8 * AO_S, 0.8 * AO_S), 0.12, 0.4); // forehatch
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
function hullX(t, y) { // the hull's half-breadth at station t, height y
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 1.6, clamp((t - 0.45) / 0.55, 0, 1));
  const sn = clamp((sy - y) / (sy + d), 0, 1) ** (n / 2), c = Math.sqrt(Math.max(0, 1 - sn * sn));
  return hb * c ** (2 / n) * (1 - FLARE * sn);
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
// long dark hull windows, as on a modern racer-cruiser
const PORTLIGHT = new THREE.MeshStandardMaterial({
  color: '#0b1116', roughness: 0.05, metalness: 0.3, envMapIntensity: 1.5, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
  alphaMap: canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 12); x.fill(); }),
});
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
    // the country flag, SAIL_MARK m wide and 3:2, m metres up the luff
    const flagAt = (onCloth, m) => logoImage(look.flag).then((img) => img && onCloth(m, () => {
      const w = R.mark, h = w / 1.5;
      x.drawImage(img, -w / 2, -h / 2, w, h);
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 0.008; x.strokeRect(-w / 2, -h / 2, w, h); // an edge, for a white flag on white cloth
    }));
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
      // number and the top batten
      const onCloth = clothAt(R.span, R.chord, 0.47);
      if (look.logo) logoImage(look.logo).then((img) => img && onCloth(R.logoM, () => drawContain(x, img, 0, 0, R.mark, R.mark))); // a wide logo fills the width, a square one is SAIL_MARK square
      if (look.flag) flagAt(onCloth, R.flagM);
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
const MAST_FOOT = 1.48, MASTHEAD = 16.6, BOOM_Y = 2.25, HOUNDS = 14.9;
// the square-top main: its chord at fraction f of the luff (narrowing to a wide head, with roach), the luff's length
// (the cloth runs from BOOM_Y + 0.08 to MASTHEAD − 0.3), and the width of the logo and the flag on it, in metres
const mainChord = (f) => lerp(4.75, 1.4, f) + 0.45 * Math.sin(Math.PI * f);
const MAIN_SPAN = MASTHEAD - 0.3 - BOOM_Y, SAIL_MARK = 1.5;
const TACK = new THREE.Vector3(0, sheerAt(1) + 0.08, BOW_Z + 0.08);
const HEAD = new THREE.Vector3(0, HOUNDS - 0.3, MAST_Z - 0.12);
// the jib's clew from the tack (the foot), and the box the ad on the jib fits in, in metres
const JIB_CLEW = new THREE.Vector3(0, 0.42, 3.75), JIB_AD = 2, JIB_AD_H = 1;
const SPRIT = new THREE.Vector3(0, sheerAt(1) + 0.12, BOW_Z - 1.4);
// this boat's sails, as sailTexture lays out the marks on them (numAt, numK: the number's height up the main and its size)
const RIG = () => ({ span: MAIN_SPAN, chord: mainChord, logoM: 9.8, flagM: 11.56, mark: SAIL_MARK, numAt: 0.64, numK: 1, hd: HEAD.clone().sub(TACK), clew: JIB_CLEW, ad: JIB_AD, adH: JIB_AD_H });

export class BoatView {
  constructor({ look = LOOKS.player, label = null, player = false }) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    const T = this.tilt, add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); T.add(o); return o; };

    // hull, deck, cockpit, coachroof: the Blender model, or built here from the lines
    const cr = { position: new THREE.Vector3(0, deckY(-0.3) - 0.02, 0) }; // the coachroof's base (its top is 0.46 above)
    if (MODEL) {
      const mats = { hull: hullMaterial(look.hull, look.stripe, look.bottom), deck: deckFinish(look, M.deck, true), gel: M.gel, teak: M.teak, glass: M.glass };
      for (const [k, g] of Object.entries(MODEL)) if (mats[k]) add(new THREE.Mesh(g, mats[k]));
    } else {
      add(new THREE.Mesh(hullGeometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
      add(new THREE.Mesh(deckGeometry(), deckFinish(look, M.deck, true)));
      add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 3.25), M.well), 0, deckY(3.1) - 0.25, 3.12);
      for (const sx of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 2.3), M.teak), sx * 0.72, deckY(3) - 0.3, 2.65); // benches
        add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 2.2), M.gel), sx * 0.98, deckY(2.6) + 0.08, 2.6); // coamings
      }
      add(new THREE.Mesh(coachroofGeometry(), M.gel), 0, cr.position.y, 0);
      // windows along the coachroof sides
      for (const sx of [-1, 1]) {
        const a = [sx * 1.15, 1.2], f = [sx * 0.77, -1.6], len = Math.hypot(a[0] - f[0], a[1] - f[1]);
        const w = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, len * 0.8), M.glass), (a[0] + f[0]) / 2, cr.position.y + 0.26, (a[1] + f[1]) / 2);
        w.rotation.y = Math.atan2(a[0] - f[0], a[1] - f[1]);
      }
    }
    // the companionway: washboard in an alloy frame, and the sliding hatch over it on its rails
    const top = cr.position.y + 0.46; // the coachroof's top
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.04), M.glass), 0, cr.position.y + 0.22, 1.53);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.03), M.alu), 0, cr.position.y + 0.22, 1.522);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.72), M.glass), 0, top + 0.035, 1.1);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.86), M.alu), sx * 0.35, top + 0.025, 1.08);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), M.glass), 0, cr.position.y + 0.47, -0.4); // hatch on the coachroof
    add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.72), M.alu), 0, cr.position.y + 0.465, -0.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), M.glass), 0, deckY(-2.9) + 0.06, -2.9); // forehatch
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.055, 0.8), M.alu), 0, deckY(-2.9) + 0.055, -2.9);
    // teak handrails along the coachroof top
    for (const sx of [-1, 1]) T.add(tube([[sx * 0.62, top, 1.3], [sx * 0.62, top + 0.07, 1.15], [sx * 0.6, top + 0.07, -1.2], [sx * 0.58, top, -1.35]], 0.02, M.teak));
    // winches: self-tailing primaries on the coamings for the jib sheets, the secondaries aft of them for the gennaker,
    // halyard winches on the coachroof
    for (const sx of [-1, 1]) {
      fit(add, winch(0.09, 0.2), sx * 1.02, deckY(2.0) + 0.155, 2.0);
      fit(add, winch(0.075, 0.17), sx * 1.02, deckY(3.2) + 0.155, 3.2);
      fit(add, winch(0.062, 0.15), sx * 0.55, top - 0.005, 1.25);
    }
    // the traveller across the forward end of the cockpit, its track with its end stops and the mainsheet's car on it,
    // a block on the car
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.07), M.steel), 0, deckY(1.7) - 0.04, 1.62);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.09), M.dark), sx * 0.8, deckY(1.7) - 0.02, 1.62);
    const car = new THREE.Group(); car.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.12), M.dark));
    for (const [g, mm] of block(0.04)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.085; car.add(o); }
    this.travCar = add(mergeGroup(car), 0, deckY(1.7) + 0.01, 1.62);
    // the wheel on its pedestal aft: the binnacle on the column, the compass under its dome on top and the helm's
    // display tilted towards her, the guard rail round it forward
    const fl = deckY(4) - 0.5, bin = deckY(4) + 0.32; // the cockpit floor there, and the wheel's axle
    add(cyl(0.055, 0.08, bin - 0.1 - fl, M.dark), 0, (fl + bin - 0.1) / 2, 4.05);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.2), M.dark), 0, bin, 4.04);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass), 0, bin + 0.1, 4.0);
    fit(add, display(0.22, 0.15, 3), 0, bin + 0.08, 4.12, 0, -0.75);
    add(cyl(0.02, 0.02, 0.12, M.steel, 8), 0, bin, 4.12).rotation.x = Math.PI / 2; // the axle
    T.add(tube([[-0.22, fl, 3.86], [-0.22, bin + 0.18, 3.86], [-0.18, bin + 0.27, 3.9], [0.18, bin + 0.27, 3.9], [0.22, bin + 0.18, 3.86], [0.22, fl, 3.86]], 0.016, M.steel));
    this.wheel = add(wheel(0.47, 6), 0, bin, 4.18);
    // toe rails, pulpit, pushpit, stanchions, lifelines
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.01 + (i / 24) * 0.96; pts.push([sx * (halfBeam(t) - 0.02), sheerAt(t) + 0.018, zAt(t)]); } // on the rounded deck edge
      T.add(tube(pts, 0.025, M.teak));
    }
    // the pulpit (open at the front, as on a racer, so the jib's tack and the gennaker's sit clear of it) and the
    // pushpit round the stern quarters: stainless rails on legs, each with a lower rail. The lifelines run between
    // them through the stanchions.
    const RIN = 0.08, RH = 0.62, at = (t, h = 0, inset = RIN) => [Math.max(0.12, halfBeam(t) - inset), sheerAt(t) + h, zAt(t)];
    const PA = 0.86, PF = 0.965, QF = 0.11, QA = 0.012; // the pulpit's legs (aft, forward) and the pushpit's (forward, aft)
    for (const sx of [-1, 1]) {
      const m = (p) => [sx * p[0], p[1], p[2]];
      T.add(tube([at(PA), at(PA, RH - 0.1), at(PA + 0.02, RH), at(0.92, RH + 0.02), at(PF - 0.012, RH), at(PF, RH - 0.1), at(PF)].map(m), 0.019, M.steel));
      T.add(tube([at(PA, 0.3), at(0.92, 0.31), at(PF, 0.3)].map(m), 0.014, M.steel));
      const sq = [Math.max(1.05, halfBeam(QA) - 0.32), sheerAt(QA), zAt(QA) - 0.04]; // the pushpit's aft leg, just outboard of the open transom
      T.add(tube([at(QF), at(QF, RH - 0.1), at(QF - 0.02, RH), at(0.05, RH + 0.02), at(0.018, RH, 0.14), [sq[0] + 0.12, sq[1] + RH, sq[2] + 0.02], [sq[0], sq[1] + RH - 0.1, sq[2]], sq].map(m), 0.019, M.steel));
      T.add(tube([at(QF, 0.3), at(0.05, 0.31), at(0.02, 0.3, 0.14)].map(m), 0.014, M.steel));
      for (const p of [at(PA), at(PF), at(QF), at(0.03, 0, 0.12), sq]) add(cyl(0.03, 0.036, 0.04, M.steel, 8), sx * p[0], p[1] + 0.02, p[2]); // their feet
      add(cyl(0.014, 0.014, RH, M.steel, 6), sx * at(0.03, 0, 0.12)[0], sheerAt(0.03) + RH / 2, zAt(0.03)); // the pushpit's middle leg
    }
    const st = [0.24, 0.42, 0.6, 0.77];
    for (const sx of [-1, 1]) {
      for (const t of st) {
        add(cyl(0.012, 0.014, RH, M.steel, 6), sx * (halfBeam(t) - RIN), sheerAt(t) + RH / 2, zAt(t));
        add(cyl(0.028, 0.034, 0.04, M.steel, 8), sx * (halfBeam(t) - RIN), sheerAt(t) + 0.02, zAt(t)); // the stanchion's base
      }
      for (const h of [RH - 0.03, 0.3]) T.add(line([PA, ...st.slice().reverse(), QF].map((t) => { const p = at(t, h); return [sx * p[0], p[1], p[2]]; })));
    }
    // deck hardware: the genoa tracks with their cars (the jib sheets lead through them), clutches ahead of the
    // halyard winches, mooring cleats at the bow and the quarters
    const TRK = 1.28, trackRise = Math.atan2(deckY(-0.5) - deckY(1.0), 1.5);
    for (const sx of [-1, 1]) {
      const tr = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.5), M.alu), sx * TRK, deckY(0.25) + 0.035, 0.25); tr.rotation.x = trackRise;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), M.dark), sx * TRK, deckY(0.4) + 0.065, 0.4);
      fit(add, block(0.035), sx * TRK, deckY(0.4) + 0.13, 0.4);
      for (const dz of [-0.5, 1.0]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), M.dark), sx * TRK, deckY(dz) + 0.045, dz); // the track's end stops
      fit(add, clutches(3), sx * 0.355, top + 0.03, 0.98);
      for (const t of [0.9, 0.04]) { const [x, y, z] = at(t, 0, t > 0.5 ? 0.22 : 0.3); fit(add, cleat(0.22), sx * x, y + 0.01, z); }
    }
    // the halyards' leads: from the front of the mast down to the turning blocks at its foot, aft along the coachroof
    // through the clutches to the halyard winches, three a side
    for (const sx of [-1, 1]) {
      fit(add, block(0.028), sx * 0.13, top + 0.04, MAST_Z + 0.02, sx * 0.5);
      for (let k = 0; k < 3; k++) {
        const x = sx * (0.28 + k * 0.075);
        T.add(line([[sx * 0.12, top + 0.04, MAST_Z + 0.05], [x, top + 0.05, 0.88], [x, top + 0.05, 1.07], [sx * 0.55 - sx * 0.07, top + 0.06, 1.22]]));
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
    for (const sx of [-1, 1]) fit(add, display(0.22, 0.16, sx < 0 ? 1 : 2), sx * 0.6, cr.position.y + 0.25, 1.53);
    // bowsprit for the gennaker
    this.sprit = add(cyl(0.035, 0.045, 1.5, M.carbon, 8), 0, SPRIT.y, BOW_Z - 0.65);
    this.sprit.rotation.x = Math.PI / 2;

    // rig: carbon mast, two sets of swept spreaders, standing rigging
    add(new THREE.Mesh(mastGeo(MASTHEAD - MAST_FOOT, 0.2, 0.13, 0.11, 0.07, (11.8 - MAST_FOOT) / (MASTHEAD - MAST_FOOT)), M.carbon), 0, (MAST_FOOT + MASTHEAD) / 2, MAST_Z);
    const spr = [[7.2, 1.0], [11.8, 0.72]];
    for (const [y, l] of spr) for (const sx of [-1, 1]) {
      const s = add(new THREE.Mesh(spreaderGeo(l, 0.03, 0.017), M.carbon), sx * l / 2 * 0.95, y, MAST_Z + l * 0.16);
      s.rotation.z = -sx * Math.PI / 2; s.rotation.y = -sx * 0.32;
    }
    // the mast's collar where it goes through the coachroof, the spreaders' tips, the masthead crane carrying the
    // backstay aft of the mast, the tricolour and the VHF aerial on top, and a display under the gooseneck
    add(cyl(0.13, 0.15, 0.06, M.dark, 16), 0, top + 0.03, MAST_Z);
    for (const sx of [-1, 1]) for (const p of [[sx * 0.95, 7.2, MAST_Z + 0.32], [sx * 0.68, 11.8, MAST_Z + 0.23]]) add(new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 3, 8), M.dark), ...p);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.52), M.carbon), 0, MASTHEAD - 0.04, MAST_Z + 0.24);
    add(cyl(0.03, 0.035, 0.08, M.dark, 10), 0, MASTHEAD + 0.04, MAST_Z);
    T.add(line([[0.03, MASTHEAD, MAST_Z - 0.02], [0.03, MASTHEAD + 0.95, MAST_Z - 0.02]]));
    fit(add, display(0.3, 0.17), 0, 1.98, MAST_Z + 0.12);
    T.add(line([[0, HOUNDS, MAST_Z], [TACK.x, TACK.y, TACK.z]]));
    const BACKSTAY = [0, sheerAt(0) + 0.05, STERN_Z - 0.15];
    T.add(line([[0, MASTHEAD - 0.06, MAST_Z + 0.48], BACKSTAY]));
    fit(add, chainplate(BACKSTAY, [0, MASTHEAD, MAST_Z + 0.48], 0.32));
    for (const sx of [-1, 1]) {
      const cap = [sx * 1.5, deckY(MAST_Z + 0.5) + 0.02, MAST_Z + 0.5], low = [sx * 1.5, deckY(MAST_Z - 0.1) + 0.02, MAST_Z - 0.1];
      T.add(line([[0, HOUNDS, MAST_Z], [sx * 0.68, 11.8, MAST_Z + 0.23], [sx * 0.95, 7.2, MAST_Z + 0.32], cap]));
      T.add(line([[0, 7.1, MAST_Z], low]));
      fit(add, chainplate(cap, [sx * 0.95, 7.2, MAST_Z + 0.32]));
      fit(add, chainplate(low, [0, 7.1, MAST_Z]));
    }
    // the stemhead: the fitting the forestay and the jib's tack come down to
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.34), M.steel), 0, sheerAt(1) + 0.02, BOW_Z + 0.2);
    fit(add, chainplate([0, sheerAt(1) + 0.06, BOW_Z + 0.1], [0, HOUNDS, MAST_Z], 0.14, 0.014));
    // the mainsheet: a four-part tackle from the traveller's car up to the block under the boom
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);

    // boom and mainsail swing on a pivot at the mast: the boom with its gooseneck, its end fitting, the mainsheet's
    // block under it and the rigid vang from the foot of the mast, one mesh a material
    this.mainPivot = add(new THREE.Group(), 0, 0, MAST_Z);
    const boom = new THREE.Group();
    const spar = cyl(0.065, 0.05, 4.9, M.carbon, 12); spar.rotation.x = Math.PI / 2; spar.position.set(0, BOOM_Y, 2.45); boom.add(spar);
    const gn = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.16), M.alu); gn.position.set(0, BOOM_Y, 0.08); boom.add(gn);
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), M.alu); end.position.set(0, BOOM_Y, 4.9); boom.add(end);
    for (const [g, mm] of block(0.045)) { const o = new THREE.Mesh(g, mm); o.position.set(0, BOOM_Y - 0.115, 2.52); boom.add(o); }
    const VA = [0, MAST_FOOT + 0.27, 0.1], VB = [0, BOOM_Y - 0.06, 1.2], VM = VA.map((v, i) => lerp(v, VB[i], 0.42));
    boom.add(bar(VA, VM, 0.018, 0.018, M.alu), bar(VM, VB, 0.032, 0.028, M.carbon));
    this.mainPivot.add(mergeGroup(boom));
    this.main = sailMesh(14, 8, sailTexture('main', look), look.laminate, 'main'); this.mainPivot.add(this.main);
    // jib on the forestay, swung about the stay itself
    this.jibPivot = add(new THREE.Group(), TACK.x, TACK.y, TACK.z);
    this.jibAxis = HEAD.clone().sub(TACK).normalize();
    this.jib = sailMesh(12, 6, sailTexture('jib', look), look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.kite = sailMesh(12, 8, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);

    // telltales on the jib luff (they matter at the helm)
    this.tells = [];
    if (player) for (const [f, sx] of [[0.3, 1], [0.3, -1], [0.52, 1], [0.52, -1]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      t.userData = { f, sx }; this.jibPivot.add(t); this.tells.push(t);
    }
    if (label) { this.label = labelSprite(label.color); this.labelText = label.text; this.label.position.set(0, 18.4, 0); this.root.add(this.label); }
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(sx, look.logo)); // the logo on both bows
    for (const sx of [-1, 1]) { T.add(hullDecal(sx, -0.55, 0.78, 1.5, 0.15, PORTLIGHT)); T.add(hullDecal(sx, 1.05, 0.79, 0.75, 0.13, PORTLIGHT)); } // hull windows
    // the running rigging: jib sheets (the working one taut to the leeward winch, the lazy one slack), the gennaker
    // sheet, halyards down the front of the mast, and a wind vane at the masthead
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false; // their points move every frame
    for (const dx of [-0.05, 0.05]) T.add(line([[dx, MASTHEAD - 0.25, MAST_Z - 0.09], [dx, MAST_FOOT + 0.35, MAST_Z - 0.11]]));
    this.windex = add(new THREE.Group(), 0, MASTHEAD + 0.02, MAST_Z); this.windex.userData.flat = true;
    const rod = cyl(0.008, 0.008, 0.5, M.dark, 4); rod.position.set(0, 0.1, -0.1); rod.rotation.x = Math.PI / 2; this.windex.add(rod);
    const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.dark); vane.rotation.x = -Math.PI / 2; vane.position.set(0, 0.1, -0.38); this.windex.add(vane);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide })); tail.rotation.y = Math.PI / 2; tail.position.set(0, 0.12, 0.12); this.windex.add(tail);
    this.sailSide = 1;
    // the crew: four sailors — the helm, the main trimmer, the jib (and kite) trimmer, and the bow (see sailor()); where
    // they sit, which way they face and how far they lean out is set in update()
    const jacket = new THREE.MeshStandardMaterial({ color: look.crew || look.stripe, roughness: 0.8 });
    const trousers = new THREE.MeshStandardMaterial({ color: look.pants || '#262a31', roughness: 0.85 });
    const vest = new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.55 });
    const cap = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.crew || look.stripe).getHSL({}).l < 0.3 ? '#efeee9' : '#22262c', roughness: 0.75 });
    const skins = ['#c99272', '#e2b291', '#a36d4c', '#d8a27e'];
    this.roofY = top + 0.03; // where the bow stands to reef, at the mast
    this.crew = [4.35, 2.7, 1.7, 0.7].map((z0, i) => {
      const s = sailor({ jacket, trousers, vest, cap, skin: new THREE.MeshStandardMaterial({ color: skins[i], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, x: 0, y: deckY(z0), z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 };
    });

    // everything solid casts and catches the sun's shadow (sails on the deck and on each other)
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.bake();
  }

  // The fittings that never move (hull, deck gear, rails, stanchions, rig, standing rigging) are ~150 small parts, each
  // its own draw — in the view, the sea's reflection and the sun's shadow. Merged per material (and per detail level,
  // so setDetail still hides the small ones far off), a boat costs a dozen draws instead.
  bake() {
    const moving = new Set([this.travCar, this.wheel, this.sprit, this.mainPivot, this.jibPivot, this.kite, this.windex,
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
    this.tilt.rotation.z = side * b.heel * D2R + roll;
    this.wheel.rotation.z = -b.rudder * 1.6;

    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    const belly = -this.sailSide * (1 - luff * 0.85);
    const reefDrop = (b.reefFill || 0) * 2.4; // a reef: the head comes 2.4 m down the mast, the sail is that much smaller
    // square-top main: the chord narrows up the mast to a wide head, with roach on the leech; twist opens the top
    setSail(this.main, (f, u, v) => {
      const chord = mainChord(f), tw = -this.sailSide * f * f * 0.5 * u;
      v.set(belly * Math.sin(Math.PI * u ** 0.78) * chord * 0.11 * (1 - 0.4 * f) + tw + luff * 0.22 * Math.sin(ph + f * 6 + u * 5) * u + leechFlutter(f, u, t, b.aws || 0), BOOM_Y + 0.08 + f * (MASTHEAD - 0.3 - BOOM_Y - reefDrop), u * chord);
    });
    // the mainsheet, from the block on the traveller's car to the one under the boom
    const ma = this.mainPivot.rotation.y, bz = 2.52;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.6, -0.75, 0.75);
    purchase(this.mainsheet, [this.travCar.position.x, deckY(1.7) + 0.095, 1.62], [Math.sin(ma) * bz, BOOM_Y - 0.115, MAST_Z + Math.cos(ma) * bz]);
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, 30 * D2R); // on its own sheet when the jib has one
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = HEAD.clone().sub(TACK), clew = JIB_CLEW;
    setSail(this.jib, (f, u, v) => {
      const lx = head.x * f, ly = head.y * f, lz = head.z * f;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz);
      v.set(lerp(lx, ex, u) + belly * Math.sin(Math.PI * u ** 0.72) * len * 0.125 + luff * 0.25 * Math.sin(ph * 1.2 + f * 7 + u * 4) * u + leechFlutter(f, u, t + 0.4, b.aws || 0), lerp(ly, ey, u), lerp(lz, ez, u));
    });
    // the jib sheets: from the clew to the car on the leeward side deck and on to the winch; the lazy one slack
    const cw = clew.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1;
    const js = this.jibSheet.geometry.attributes.position, lz = this.lazySheet.geometry.attributes.position;
    js.setXYZ(0, cw.x, cw.y, cw.z); js.setXYZ(1, ls * 1.28, deckY(0.4) + 0.1, 0.4); js.setXYZ(2, ls * 1.02, deckY(2) + 0.3, 2.0); js.needsUpdate = true;
    lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, deckY(0) + 0.5, 0.1); lz.setXYZ(2, -ls * 1.28, deckY(0.4) + 0.1, 0.4); lz.setXYZ(3, -ls * 1.02, deckY(2) + 0.3, 2.0); lz.needsUpdate = true;
    // the wind vane points into the apparent wind
    this.windex.rotation.y = -b.awa;
    // the crew: upwind on the windward rail, leaning out the more she heels; downwind in the cockpit, the kite trimmer
    // to leeward watching the kite; the bow goes forward for a hoist, a drop or a jib change. They cross the boat in a
    // tack or gybe over a second or two.
    const first = this.crewT === undefined, dt = clamp(t - (this.crewT ?? t), 0, 0.1); this.crewT = t; // the first time, straight to their places
    const up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!(b.kiteJob || b.jibJob || b.reefJob);
    for (const c of this.crew) {
      // yaw turns a sailor (0 faces outboard, π/2 forward, π inboard); lean tips the body forward, out over the
      // lifelines when she faces outboard; knee bends the knees (the thighs lie level when seated); reach swings the arms
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      if (c.i === 0) { x = side * 1.12; y = deckY(z) + 0.05; yaw = 2.2; lean = up ? 0.05 - 0.15 * hike : 0.12; knee = -1.3; reach = 1.0; } // the helm: to windward, aft of the wheel, hands on its rim
      else if (c.i === 3 && bowBusy) { x = 0.12; z = b.reefJob ? MAST_Z + 0.55 : -3.4; y = b.reefJob ? this.roofY : deckY(z) + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.15; reach = 0.7; } // forward to work
      else if (up) { x = side * (hbAt(z) - 0.12); y = deckY(z) + 0.09; yaw = 0; lean = 0.12 + 0.45 * hike; knee = -1.85; reach = 0.3; } // on the rail, legs over the side, hiking out
      else { x = (c.i === 3 || (c.i === 2 && b.kite) ? -side : side) * 0.72; z = c.i === 3 ? 2.85 : c.z0; y = 0.8; } // on the cockpit seats, the kite trimmer to leeward
      const k = first ? 1 : 1 - Math.exp(-dt * 2.2);
      c.x += (x - c.x) * k; c.y += (y - c.y) * k; c.z += (z - c.z) * k; c.yaw += (yaw - c.yaw) * k;
      c.lean += (lean - c.lean) * k; c.stand += (stand - c.stand) * k; c.knee += (knee - c.knee) * k; c.reach += (reach - c.reach) * k;
      const sd = c.x >= 0 ? 1 : -1, s = c.s; // the side she's on: the port side's sailors are mirrored, so +x is always outboard
      c.g.position.set(c.x, c.y, c.z); c.g.scale.x = sd;
      s.body.rotation.y = c.yaw; s.body.position.y = c.stand * (THIGH + SHIN + 0.02);
      s.upper.rotation.z = -c.lean;
      for (const l of s.legs) { l.hip.rotation.z = (1 - c.stand) * Math.PI / 2; l.knee.rotation.z = (1 - c.stand) * c.knee; }
      for (const a of s.arms) a.rotation.z = c.reach;
    }
    // gennaker on the bowsprit
    // kf: how far the gennaker is up — it climbs the mast furled during a hoist and fills only at the top, and comes
    // down collapsing during a drop
    const kf = b.kiteFill ?? (b.kite ? 1 : 0), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)); // half collapsed while it's gybed
    this.kite.visible = this.sprit.visible = this.kiteSheet.visible = kf > 0.02;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6.2, 3.4, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [SPRIT.x, SPRIT.y + 0.1, SPRIT.z], hd = [0, lerp(SPRIT.y + 1, MASTHEAD - 0.4, kf), lerp(SPRIT.z, MAST_Z - 0.15, kf)], cl = [sd * out, lerp(SPRIT.y + 0.4, 2.9, kf), lerp(SPRIT.z + 0.8, 1.8, kf)];
      setSail(this.kite, (f, u, v) => {
        const lx = sd * Math.sin(Math.PI * f) * 2.4 * kfill, lz = -Math.sin(Math.PI * f) * 2.6 * kfill;
        const p = [lerp(tk[0], hd[0], f) + lx, lerp(tk[1], hd[1], f), lerp(tk[2], hd[2], f) + lz];
        const q = [lerp(cl[0], hd[0], f), lerp(cl[1], hd[1], f), lerp(cl[2], hd[2], f)];
        const bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, f * 1.08)) * 2.8 * kfill;
        v.set(lerp(p[0], q[0], u) + sd * bul, lerp(p[1], q[1], u), lerp(p[2], q[2], u) - bul * 0.9);
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
