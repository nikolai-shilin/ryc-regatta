// Regatta: the racing yacht, built in code — a 34-foot racer-cruiser: lofted hull, deck and fittings, carbon rig,
// square-top main with battens and a sail number, jib, asymmetric gennaker on a bowsprit.
// Local frame: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D2R, clamp, lerp, waveHeight } from './sim.js';

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

// one point of a section: s = 0 at the deck edge … 1 at the keel; a superellipse, boxy aft and V-shaped forward
function section(t, s) {
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 1.6, clamp((t - 0.45) / 0.55, 0, 1));
  const phi = (s * Math.PI) / 2, c = Math.cos(phi), sn = Math.sin(phi), yr = sn ** (2 / n);
  const x = hb * c ** (2 / n) * (1 - 0.05 * sn); // a little flare in the topsides
  let dz = 0;
  if (t > 0.88) dz = 0.4 * yr * ((t - 0.88) / 0.12) ** 2; // the stem rakes: the forefoot sits aft of the stem head
  // the transom stays vertical, as on a modern racer
  return [x, sy - (sy + d) * yr, dz];
}

// hull paint: gloss gelcoat with a boot-top, antifouling below it and a cove stripe under the sheer, drawn crisp in the shader
function hullMaterial(hull, stripe) {
  const m = new THREE.MeshStandardMaterial({ color: hull, roughness: 0.22, metalness: 0, envMapIntensity: 0.9, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStripe = { value: new THREE.Color(stripe) }; sh.uniforms.uBottom = { value: new THREE.Color('#5b1f24') };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float band; varying float vBand; varying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = band; vY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uStripe, uBottom; varying float vBand; varying float vY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float aa = fwidth(vY) * 1.2, ab = fwidth(vBand) * 1.2;
        float boot = smoothstep(0.07 - aa, 0.07 + aa, vY) * (1.0 - smoothstep(0.19 - aa, 0.19 + aa, vY));
        float under = 1.0 - smoothstep(0.07 - aa, 0.07 + aa, vY);
        float cove = smoothstep(0.1 - ab, 0.1 + ab, vBand) * (1.0 - smoothstep(0.135 - ab, 0.135 + ab, vBand));
        diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, max(boot, cove));
        diffuseColor.rgb = mix(diffuseColor.rgb, uBottom, under);`);
  };
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
  new GLTFLoader().load(new URL('./yacht.glb', import.meta.url).href, (g) => {
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

// ---------- textures ----------
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// moulded non-skid: a fine diamond pattern, one tile every 35 cm (the deck's UVs are in metres)
const NONSKID = canvasTex(64, 64, (x, w, h) => {
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
function deckMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: NONSKID, roughness: 0.85, aoMap: DECK_AO, aoMapIntensity: 1 });
  // the baked shade also dims the sunlit deck a little, not only the sky's light
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, 0.45);'); };
  return m;
}
// carbon spars under a clear lacquer, so a mast reads as round: a long sheen down it and the sky in it
const carbon = () => new THREE.MeshPhysicalMaterial({ color: '#2d3238', roughness: 0.42, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1 });

// ---------- materials ----------
const M = {
  deck: deckMaterial(),
  gel: new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.3, envMapIntensity: 0.8 }),
  teak: new THREE.MeshStandardMaterial({ map: TEAK, roughness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: '#d9dde1', roughness: 0.25, metalness: 1, envMapIntensity: 1 }),
  carbon: carbon(),
  // smoked acrylic: dark, but with the sky in it
  glass: new THREE.MeshStandardMaterial({ color: '#2a3540', roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4 }),
  alu: new THREE.MeshStandardMaterial({ color: '#c3c8cd', roughness: 0.35, metalness: 0.85, envMapIntensity: 1 }), // hatch frames
  dark: new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.6 }),
  well: [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial(i === 3 ? { map: TEAK, roughness: 0.75, side: THREE.BackSide } : { color: '#e4e1d8', roughness: 0.8, side: THREE.BackSide })),
};
const wireMat = new THREE.LineBasicMaterial({ color: 0x4d555e, transparent: true, opacity: 0.8 }); // grey and a touch see-through, so the thin lines don't crawl dark against the sky
const line = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), wireMat);
const tube = (pts, r, mat, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed), Math.max(8, pts.length * 6), r, 6, closed), mat);
const cyl = (r0, r1, h, mat, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

// ---------- the logo ----------
// the club's logo (the white RYC pennant on a red square, public/images/ryc-badge.svg) or the player's own picture
// (a data: URL from the boat page), each drawn as it is
const RYC_BADGE = '/images/ryc-badge.svg';
const logoCache = {};
function logoImage(logo) {
  const src = typeof logo === 'string' ? logo : RYC_BADGE;
  if (!logoCache[src]) logoCache[src] = new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; }).catch(() => null);
  return logoCache[src];
}
// draws a picture as large as fits in a w × h box centred on (cx, cy), keeping its shape
function drawContain(x, img, cx, cy, w, h) {
  const s = Math.min(w / (img.naturalWidth || img.width), h / (img.naturalHeight || img.height)), dw = (img.naturalWidth || img.width) * s, dh = (img.naturalHeight || img.height) * s;
  x.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

// a logo decal on the bow, wrapped onto the hull's own surface (side: +1 starboard, −1 port)
function hullX(t, y) { // the hull's half-breadth at station t, height y
  const hb = halfBeam(t), sy = sheerAt(t), d = canoe(t), n = lerp(2.9, 1.6, clamp((t - 0.45) / 0.55, 0, 1));
  const sn = clamp((sy - y) / (sy + d), 0, 1) ** (n / 2), c = Math.sqrt(Math.max(0, 1 - sn * sn));
  return hb * c ** (2 / n) * (1 - 0.05 * sn);
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
function sailTexture(kind, look) {
  const W = 512, H = kind === 'main' ? 1024 : kind === 'jib' ? 768 : 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  if (kind === 'kite') {
    const cols = look.kite; // horizontal panels in the boat's colours
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(0, (i * H) / 8, W, H / 8 + 1); }
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2;
    for (let i = 1; i < 12; i++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(W, (i * H) / 12); x.stroke(); } // radial seams from the head
  } else {
    x.fillStyle = look.cloth; x.fillRect(0, 0, W, H);
    // laminate: fine fibres; cloth: panel seams
    if (look.laminate) {
      x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1;
      for (let i = -H; i < W; i += 9) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H * 0.7, 0); x.stroke(); }
      for (let i = 0; i < W + H; i += 14) { x.beginPath(); x.moveTo(W, i); x.lineTo(0, i - W * 0.5); x.stroke(); }
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
      x.save(); x.translate(W * 0.47, H * 0.36); x.scale(1, 0.44);
      x.fillStyle = look.ink; x.font = '900 128px Carlito, Lato, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (look.logo) x.fillText(look.num, 0, 120);
      else { x.fillText(look.nat, 0, -82); x.fillText(look.num, 0, 70); }
      x.restore();
      if (look.logo) logoImage(look.logo).then((img) => {
        if (!img) return;
        x.save(); x.translate(W * 0.47, H * 0.255); x.scale(1, 0.44); drawContain(x, img, 0, 0, 340, 300); x.restore(); // a wide logo fills the width, a square one the height
        t.needsUpdate = true; // the clone on the other side shares the canvas
      });
    } else {
      x.fillStyle = look.batten; x.fillRect(W * 0.7, H * 0.35, W * 0.3, 8); x.fillRect(W * 0.6, H * 0.6, W * 0.4, 8);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  return t;
}
// a sail: one grid geometry, drawn twice so the number reads the right way round from both sides
function sailMesh(rows, cols, tex, shiny = false) {
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
  const back = tex.clone(); back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
  // laminate (shiny) sails catch a soft sheen; the emissive part is the light the cloth lets through (see backlight)
  const mat = (map, side) => new THREE.MeshStandardMaterial({ map, side, roughness: shiny ? 0.45 : 0.72, metalness: shiny ? 0.12 : 0, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.22 });
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, mat(tex, THREE.FrontSide)), new THREE.Mesh(g, mat(back, THREE.BackSide)));
  grp.userData = { rows, cols, g };
  return grp;
}
// the sun through the cloth: when the sun is behind a sail as you look at it, the sail glows warm and its seams,
// battens and number show darker against the light; lit from your side it shows plain
const _n = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
function backlight(grp, cam, sun) {
  const m = grp.children[0], g = grp.userData.g, N = g.attributes.normal;
  if (!N) return;
  const i = Math.floor(N.count / 2);
  _n.fromBufferAttribute(N, i).transformDirection(m.matrixWorld);
  _p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(m.matrixWorld);
  const s = _n.dot(sun), c = _n.dot(_c.copy(cam).sub(_p));
  const k = s * c < 0 ? Math.min(1, Math.abs(s) * 1.5) : 0;
  for (const ch of grp.children) { ch.material.emissiveIntensity = 0.18 + 0.5 * k; ch.material.emissive.setRGB(1, 1 - 0.06 * k, 1 - 0.16 * k); }
}
function setSail(m, fn) {
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
  Aurora: { hull: '#a8202a', stripe: '#f4f2ec', cloth: '#7f858c', laminate: true, tape: '#5f646b', batten: '#5a5f66', ink: '#ffffff', nat: 'GBR', num: '52', kite: ['#e63946', '#ffffff'] },
  Kestrel: { hull: '#14503c', stripe: '#e9e3cf', cloth: '#2a2c30', laminate: true, tape: '#18191c', batten: '#1c1d20', ink: '#f2c230', nat: 'FRA', num: '7', kite: ['#2a9d8f', '#f2c230'] },
  Nomad: { hull: '#2b2f36', stripe: '#e8c547', cloth: '#ebe3cd', tape: '#cfc5aa', batten: '#d2c9b0', ink: '#b3262b', nat: 'ITA', num: '33', kite: ['#f4a261', '#1d1d1d'] },
  Halcyon: { hull: '#1f4e8c', stripe: '#ffffff', cloth: '#f2f0e8', tape: '#d6d1c2', batten: '#d0ccbe', ink: '#1f4e8c', nat: 'NED', num: '14', kite: ['#3a86ff', '#ffbe0b'] },
  Mistral: { hull: '#f3f1ec', stripe: '#6c3483', cloth: '#3a3d42', laminate: true, tape: '#23252a', batten: '#26282d', ink: '#ffffff', nat: 'ESP', num: '88', kite: ['#8e44ad', '#ffffff'] },
  Selkie: { hull: '#0f6b5f', stripe: '#f1ece0', cloth: '#efeadd', tape: '#d3ccb8', batten: '#cfc8b4', ink: '#0f6b5f', nat: 'IRL', num: '21', kite: ['#16a085', '#f1c40f'] },
  Tern: { hull: '#f5f4f0', stripe: '#e67e22', cloth: '#868c93', laminate: true, tape: '#62676e', batten: '#5d6269', ink: '#1d1d1d', nat: 'GER', num: '9', kite: ['#e67e22', '#2d3436'] },
  Vela: { hull: '#7a1f3d', stripe: '#f6e6ea', cloth: '#f3f0e8', tape: '#d8d2c3', batten: '#d2ccbd', ink: '#7a1f3d', nat: 'CRO', num: '40', kite: ['#e84393', '#ffffff'] },
  Zephyr: { hull: '#b9bec4', stripe: '#1d1f22', cloth: '#2b2d31', laminate: true, tape: '#1a1b1e', batten: '#1d1e21', ink: '#e8e8e8', nat: 'SWE', num: '63', kite: ['#0984e3', '#fdcb6e'] },
};

// the player's own boat, as the boat page (/boat) saves it in localStorage 'regatta-boat': the colours of the hull, the
// sails, the gennaker and the crew, the sail number and the logo. lookFrom turns it into a look; anything missing or
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
  const kite = Array.isArray(b.kite) ? b.kite[0] : b.kite; // the player's gennaker is one colour (older saves kept three panels: the top one)
  if (isHex(kite)) L.kite = [kite];
  if (typeof b.laminate === 'boolean') L.laminate = b.laminate;
  L.tape = darker(L.cloth, L.laminate ? 0.28 : 0.12); L.batten = darker(L.cloth, L.laminate ? 0.3 : 0.14); // the luff tape and battens: a shade darker than the cloth
  if (typeof b.num === 'string' && b.num.trim()) L.num = b.num.trim().slice(0, 3);
  if (typeof b.nat === 'string' && b.nat.trim()) L.nat = b.nat.trim().toUpperCase().slice(0, 3);
  const own = typeof b.logoImg === 'string' && b.logoImg.startsWith('data:image/') ? b.logoImg : DEFAULT_LOGO; // 'Yours' before an upload: the RYC Rentals Bot badge
  L.logo = b.logo === 'none' ? false : b.logo === 'custom' ? own : true;
  return L;
}
export function playerLook() {
  try { return lookFrom(JSON.parse(localStorage.getItem(BOAT_KEY) || 'null')); } catch (e) { return lookFrom(null); }
}

// ---------- the crew ----------
// a sailor, built at the hips and facing +x: legs that bend at the hip and the knee (sea boots on), a body that leans,
// arms bent at the elbow with gloved hands, an inflatable lifejacket's collar and a cap with a peak. The boat turns
// each one about y and mirrors those on the port side.
const THIGH = 0.44, SHIN = 0.44;
const SAILOR = (() => {
  const thigh = new THREE.CapsuleGeometry(0.075, THIGH - 0.1, 3, 8).translate(0, -THIGH / 2, 0);
  const shin = mergeGeometries([
    new THREE.CapsuleGeometry(0.06, SHIN - 0.1, 3, 8).translate(0, -SHIN / 2, 0),
    new THREE.BoxGeometry(0.24, 0.09, 0.11).translate(0.06, -SHIN - 0.02, 0), // the boot
  ]);
  const elbow = 1.15; // the forearm bent forward
  const arm = mergeGeometries([
    new THREE.CapsuleGeometry(0.052, 0.2, 3, 6).translate(0, -0.14, 0),
    new THREE.CapsuleGeometry(0.046, 0.18, 3, 6).translate(0, -0.12, 0).rotateZ(elbow).translate(0, -0.27, 0),
    new THREE.SphereGeometry(0.052, 6, 5).scale(1.1, 0.8, 0.7).translate(0, -0.27, 0).rotateZ(elbow).translate(0, -0.27, 0), // glove
  ]);
  const torso = new THREE.CapsuleGeometry(0.15, 0.24, 4, 10).scale(0.82, 1, 1.12).translate(0, 0.3, 0); // deeper across the shoulders than front to back
  const collar = new THREE.TorusGeometry(0.115, 0.05, 6, 14).rotateX(Math.PI / 2).scale(0.85, 1, 1.05).translate(0.01, 0.5, 0);
  const head = new THREE.SphereGeometry(0.1, 12, 9).scale(0.95, 1.08, 0.9).translate(0, 0.66, 0);
  const cap = mergeGeometries([
    new THREE.SphereGeometry(0.104, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.97, 0.75, 0.92).translate(0, 0.69, 0),
    new THREE.CylinderGeometry(0.09, 0.09, 0.012, 12, 1, false, 0, Math.PI).scale(1.1, 1, 0.95).rotateY(-Math.PI / 2).translate(0.07, 0.69, 0), // the peak, forward
  ]);
  const glasses = new THREE.BoxGeometry(0.03, 0.035, 0.15).translate(0.085, 0.665, 0);
  return { thigh, shin, arm, torso, collar, head, cap, glasses };
})();
export function sailor(m) {
  const g = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group();
  g.add(body); body.add(upper);
  const legs = [-1, 1].map((sz) => {
    const hip = new THREE.Group(), knee = new THREE.Group();
    hip.position.set(0, 0.07, sz * 0.1); hip.add(new THREE.Mesh(SAILOR.thigh, m.trousers));
    knee.position.y = -THIGH; knee.add(new THREE.Mesh(SAILOR.shin, m.trousers)); hip.add(knee);
    body.add(hip);
    return { hip, knee };
  });
  upper.add(new THREE.Mesh(SAILOR.torso, m.jacket), new THREE.Mesh(SAILOR.collar, m.vest), new THREE.Mesh(SAILOR.head, m.skin), new THREE.Mesh(SAILOR.cap, m.cap), new THREE.Mesh(SAILOR.glasses, M.dark));
  const arms = [-1, 1].map((sz) => { const a = new THREE.Mesh(SAILOR.arm, m.jacket); a.position.set(0, 0.47, sz * 0.2); a.rotation.x = -sz * 0.12; upper.add(a); return a; });
  return { g, body, upper, legs, arms };
}

// ---------- the boat ----------
const MAST_FOOT = 1.48, MASTHEAD = 16.6, BOOM_Y = 2.25, HOUNDS = 14.9;
const TACK = new THREE.Vector3(0, sheerAt(1) + 0.08, BOW_Z + 0.08);
const HEAD = new THREE.Vector3(0, HOUNDS - 0.3, MAST_Z - 0.12);
const SPRIT = new THREE.Vector3(0, sheerAt(1) + 0.12, BOW_Z - 1.4);

export class BoatView {
  constructor({ look = LOOKS.player, label = null, player = false }) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    const T = this.tilt, add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); T.add(o); return o; };

    // hull, deck, cockpit, coachroof: the Blender model, or built here from the lines
    const cr = { position: new THREE.Vector3(0, deckY(-0.3) - 0.02, 0) }; // the coachroof's base (its top is 0.46 above)
    if (MODEL) {
      const mats = { hull: hullMaterial(look.hull, look.stripe), deck: M.deck, gel: M.gel, teak: M.teak, glass: M.glass };
      for (const [k, g] of Object.entries(MODEL)) if (mats[k]) add(new THREE.Mesh(g, mats[k]));
    } else {
      add(new THREE.Mesh(hullGeometry(), hullMaterial(look.hull, look.stripe)));
      add(new THREE.Mesh(deckGeometry(), M.deck));
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
    // winches: primaries on the coamings, halyard winches on the coachroof
    for (const sx of [-1, 1]) {
      add(cyl(0.1, 0.12, 0.17, M.steel, 16), sx * 1.02, deckY(2.0) + 0.24, 2.0);
      add(cyl(0.075, 0.09, 0.13, M.steel, 14), sx * 0.55, cr.position.y + 0.52, 1.25);
    }
    // traveller across the forward end of the cockpit; wheel on a pedestal aft
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.07), M.steel), 0, deckY(1.7) - 0.04, 1.62);
    this.travCar = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.12), M.dark), 0, deckY(1.7) + 0.01, 1.62); // the mainsheet's car on it
    add(cyl(0.055, 0.08, 0.8, M.dark), 0, deckY(4) - 0.1, 4.05);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.dark), 0, deckY(4) + 0.32, 4.05); // binnacle
    this.wheel = add(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 8, 36), M.steel), 0, deckY(4) + 0.32, 4.15);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.02, 0.02), M.steel); sp.rotation.z = (i * Math.PI) / 3; this.wheel.add(sp); }
    // toe rails, pulpit, pushpit, stanchions, lifelines
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.01 + (i / 24) * 0.96; pts.push([sx * (halfBeam(t) - 0.02), sheerAt(t) + 0.03, zAt(t)]); }
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
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.15), M.dark), sx * TRK, deckY(0.4) + 0.07, 0.4);
      for (let k = 0; k < 3; k++) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.15), M.dark), sx * (0.28 + k * 0.075), top + 0.06, 0.98);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.08), M.alu), sx * (0.28 + k * 0.075), top + 0.095, 0.96);
      }
      for (const t of [0.9, 0.04]) {
        const [x, y, z] = at(t, 0, t > 0.5 ? 0.22 : 0.3);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.07), M.alu), sx * x, y + 0.045, z);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.028, 0.22), M.alu), sx * x, y + 0.08, z);
      }
    }
    // bowsprit for the gennaker
    this.sprit = add(cyl(0.035, 0.045, 1.5, M.carbon, 8), 0, SPRIT.y, BOW_Z - 0.65);
    this.sprit.rotation.x = Math.PI / 2;

    // rig: carbon mast, two sets of swept spreaders, standing rigging
    add(cyl(0.055, 0.1, MASTHEAD - MAST_FOOT, M.carbon), 0, (MAST_FOOT + MASTHEAD) / 2, MAST_Z);
    const spr = [[7.2, 1.0], [11.8, 0.72]];
    for (const [y, l] of spr) for (const sx of [-1, 1]) {
      const s = add(cyl(0.02, 0.03, l, M.carbon, 6), sx * l / 2 * 0.95, y, MAST_Z + l * 0.16);
      s.rotation.z = Math.PI / 2; s.rotation.y = -sx * 0.32;
    }
    T.add(line([[0, HOUNDS, MAST_Z], [TACK.x, TACK.y, TACK.z]]));
    T.add(line([[0, MASTHEAD - 0.1, MAST_Z], [0, sheerAt(0) + 0.05, STERN_Z - 0.15]]));
    for (const sx of [-1, 1]) {
      T.add(line([[0, HOUNDS, MAST_Z], [sx * 0.68, 11.8, MAST_Z + 0.23], [sx * 0.95, 7.2, MAST_Z + 0.32], [sx * 1.5, deckY(MAST_Z + 0.5) + 0.02, MAST_Z + 0.5]]));
      T.add(line([[0, 7.1, MAST_Z], [sx * 1.5, deckY(MAST_Z - 0.1) + 0.02, MAST_Z - 0.1]]));
    }
    this.mainsheet = line([[0, 0, 0], [0, 1, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);

    // boom and mainsail swing on a pivot at the mast
    this.mainPivot = add(new THREE.Group(), 0, 0, MAST_Z);
    const boom = cyl(0.065, 0.05, 4.9, M.carbon, 8); boom.rotation.x = Math.PI / 2; boom.position.set(0, BOOM_Y, 2.45); this.mainPivot.add(boom);
    this.mainPivot.add(line([[0, MAST_FOOT + 0.25, 0.1], [0, BOOM_Y - 0.05, 1.2]])); // vang
    this.main = sailMesh(14, 8, sailTexture('main', look), look.laminate); this.mainPivot.add(this.main);
    // jib on the forestay, swung about the stay itself
    this.jibPivot = add(new THREE.Group(), TACK.x, TACK.y, TACK.z);
    this.jibAxis = HEAD.clone().sub(TACK).normalize();
    this.jib = sailMesh(12, 6, sailTexture('jib', look), look.laminate); this.jibPivot.add(this.jib);
    this.kite = sailMesh(12, 8, sailTexture('kite', look)); this.kite.visible = false; T.add(this.kite);

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
        if (r < 0.9 || o.isLine) this.small.push(o);
      });
    }
    for (const o of this.small) o.visible = on;
    this.detailOn = on;
  }
  update(b, t, W, showLabel, light = null) { // light: { cam, sun } for the sun through the sails
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
      const chord = lerp(4.75, 1.4, f) + 0.45 * Math.sin(Math.PI * f), tw = -this.sailSide * f * f * 0.5 * u;
      v.set(belly * Math.sin(Math.PI * u ** 0.78) * chord * 0.11 * (1 - 0.4 * f) + tw + luff * 0.22 * Math.sin(ph + f * 6 + u * 5) * u, BOOM_Y + 0.08 + f * (MASTHEAD - 0.3 - BOOM_Y - reefDrop), u * chord);
    });
    // the mainsheet, from the traveller to the end of the boom
    const ma = this.mainPivot.rotation.y, bz = 2.52, ms = this.mainsheet.geometry.attributes.position;
    ms.setXYZ(0, clamp(Math.sin(ma) * bz * 0.6, -0.75, 0.75), deckY(1.7) + 0.04, 1.62);
    this.travCar.position.x = ms.getX(0);
    ms.setXYZ(1, Math.sin(ma) * bz, BOOM_Y - 0.05, MAST_Z + Math.cos(ma) * bz); ms.needsUpdate = true;
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, 30 * D2R); // on its own sheet when the jib has one
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = HEAD.clone().sub(TACK), clew = new THREE.Vector3(0, 0.42, 3.75);
    setSail(this.jib, (f, u, v) => {
      const lx = head.x * f, ly = head.y * f, lz = head.z * f;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz);
      v.set(lerp(lx, ex, u) + belly * Math.sin(Math.PI * u ** 0.72) * len * 0.125 + luff * 0.25 * Math.sin(ph * 1.2 + f * 7 + u * 4) * u, lerp(ly, ey, u), lerp(lz, ez, u));
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
    if (light) for (const s of b.kite ? [this.main, this.jib, this.kite] : [this.main, this.jib]) backlight(s, light.cam, light.sun);
    if (this.label) {
      this.label.visible = showLabel;
      this.label.userData.set(this.labelText + (b.pen ? ' ⟳' : b.ocs ? ' OCS' : b.dsq ? ' DSQ' : ''), !!(b.pen || b.ocs));
    }
  }
}
