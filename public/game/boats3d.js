// Regatta: the other classes' yachts, built in code like the club's 40-footer (yacht.js) and dressed the same way —
// your colours, sail number, logo and flag, the sponsor's ad on the jib. Each is drawn at her real size (drawnL in
// classes.js): the sportboats — the J/70 (tiller, cuddy, retractable sprit and asymmetric kite, four hiking on the
// rail) and the RS21 (the same idea with a wide open cockpit, no cuddy, three aboard) — and
// the AC75 foiling monohull (a scow-bowed hull flying on canting T-foil arms, a deck-sweeping double-skin main on a
// D-section mast, a self-tacking jib and eight in their pods). makeBoatView gives the page's class (classes.js CLS), or
// the one asked for (the fleet page, /fleet-view, has one of each afloat together).
// Local frame as yacht.js: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { BoatView, M, NONSKID, canvasTex, line, tube, cyl, hullMaterial, logoImage, drawContain, sailTexture, sailMesh, setSail, leechFlutter, sailor, labelSprite, THIGH, SHIN, LOOKS,
  fit, bar, winch, block, clutches, wheel, chainplate, display, purchase, mergeGroup, bowNumberMaterial } from './yacht.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLS } from './classes.js';
import { D2R, clamp, lerp, waveHeight } from './sim.js';

export function makeBoatView(o, cls = CLS) {
  if (cls.id === 'j70' || cls.id === 'rs21') return new SportView({ ...o, cls });
  if (cls.id === 'ac75') return new AC75View({ ...o, cls });
  return new BoatView(o);
}

// ---------- a lofted hull ----------
// H: L (m), hb(t) half-beam, sheer(t), depth(t) of the canoe body under the waterline, n(t) the sections' squareness
// (a superellipse: 2 round … 3 boxy), with t = 0 at the transom and 1 at the stem. H.chine, if given, is a hard chine
// as the club's boat has (blender/yacht.py hull_point): y(t) its height, w(t) how hard it is (1 hard … 0 the round
// section), dead(t) the bottom's deadrise there in degrees, flat the bottom's depth as a share of the canoe's
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function hullOf(H) {
  const STERN = H.L / 2, zAt = (t) => STERN - t * H.L, tAt = (z) => clamp((STERN - z) / H.L, 0, 1);
  const round = (t, s) => {
    const hb = H.hb(t), sy = H.sheer(t), d = H.depth(t), n = H.n(t);
    const phi = (s * Math.PI) / 2, c = Math.cos(phi), sn = Math.sin(phi), yr = sn ** (2 / n);
    return [hb * c ** (2 / n) * (1 - (H.flare ?? 0.04) * sn), sy - (sy + d) * yr];
  };
  // s = 0 at the deck edge … 1 at the keel; with a chine, the topsides run down to it (the first half of s) and the
  // bottom is a curve from the chine, out at its deadrise, to the flat of the keel line
  const SPLIT = 0.5;
  const section = (t, s) => {
    const C = H.chine, w = C ? C.w(t) : 0;
    if (!C) return round(t, s);
    const sy = H.sheer(t), d = H.depth(t), n = H.n(t), yc = C.y(t);
    const sc = (Math.asin(clamp((sy - yc) / (sy + d), 0, 1) ** (n / 2)) * 2) / Math.PI; // where the round section reaches the chine
    const sf = s <= SPLIT ? (s / SPLIT) * sc : sc + ((s - SPLIT) / (1 - SPLIT)) * (1 - sc);
    const [fx, fy] = round(t, sf);
    if (s <= SPLIT || w <= 0) return [fx, fy];
    const [xc, ycc] = round(t, sc), u = (s - SPLIT) / (1 - SPLIT), d2 = d * (C.flat ?? 0.86), dr = (C.dead(t) * Math.PI) / 180, k = xc * 0.42;
    const P = [[xc, ycc], [xc - k * Math.cos(dr), ycc - k * Math.sin(dr)], [xc * 0.38, -d2], [0, -d2]];
    const B = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3];
    const bx = B.reduce((a, b, i) => a + b * P[i][0], 0), by = B.reduce((a, b, i) => a + b * P[i][1], 0);
    return [lerp(fx, bx, w), lerp(fy, by, w)];
  };
  // the half-breadth at station t and height y, on the topsides: the round section solved for y
  const xAt = (t, y) => {
    const hb = H.hb(t), sy = H.sheer(t), d = H.depth(t), n = H.n(t);
    const sn = clamp((sy - y) / (sy + d), 0, 1) ** (n / 2), c = Math.sqrt(Math.max(0, 1 - sn * sn));
    return hb * c ** (2 / n) * (1 - (H.flare ?? 0.04) * sn);
  };
  function geometry() {
    const N = 80, K = 24, W = 2 * K + 1, pos = [], band = [], idx = [];
    // the samples crowd towards the chine, so its edge stays crisp
    const sOf = (k) => { const s = 1 - Math.abs(k) / K; return !H.chine || s <= SPLIT ? s : SPLIT + (1 - SPLIT) * ((s - SPLIT) / (1 - SPLIT)) ** 1.15; };
    for (let i = 0; i <= N; i++) {
      const t = Math.min(0.997, (i / N) ** 0.85), sy = H.sheer(t), z = zAt(t);
      for (let k = -K; k <= K; k++) { const [x, y] = section(t, sOf(k)); pos.push(Math.sign(k) * x, y, z); band.push(sy - y); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < W - 1; k++) { const a = i * W + k, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
    // the transom, flat: a fan from the middle of its outline; and the stem, closed the same way
    for (const [r, flip] of [[0, false], [N, true]]) {
      const base = pos.length / 3, o = r * W;
      for (let k = 0; k < W; k++) { pos.push(pos[(o + k) * 3], pos[(o + k) * 3 + 1], pos[(o + k) * 3 + 2]); band.push(1); }
      let cy = 0; for (let k = 0; k < W; k++) cy += pos[(o + k) * 3 + 1]; cy /= W;
      const ci = pos.length / 3; pos.push(0, cy, pos[o * 3 + 2]); band.push(1);
      for (let k = 0; k < W - 1; k++) flip ? idx.push(ci, base + k, base + k + 1) : idx.push(ci, base + k + 1, base + k);
      flip ? idx.push(ci, base + W - 1, base) : idx.push(ci, base, base + W - 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('band', new THREE.Float32BufferAttribute(band, 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // the deck: the sheer outline, a little crowned, with holes cut in it: each [x0, z0, x1, z1] (a box) or a list of
  // [x, z] points (an outline, as tub() gives)
  const crownY = (x, z, crown) => H.sheer(tAt(z)) + crown * (1 - (x / Math.max(H.hb(tAt(z)), 0.2)) ** 2);
  // notch: an open-aft tub's outline (tub(…, { openAft })), cut into the deck's own edge at the transom
  function deck(holes = [], crown = 0.04, notch = null) {
    const sh = new THREE.Shape(), n = 64;
    for (let i = 0; i <= n; i++) { const t = i / n; sh[i ? 'lineTo' : 'moveTo'](H.hb(t) - 0.015, -zAt(t)); }
    for (let i = n; i >= 0; i--) { const t = i / n; sh.lineTo(-(H.hb(t) - 0.015), -zAt(t)); }
    if (notch) { // from the port corner of the transom in along it, round the well, and out to the starboard corner
      const k = notch.findIndex(([x, z]) => x < 0 && z >= STERN - 1e-6);
      for (let i = 0; i < notch.length; i++) { const [x, z] = notch[(k + i) % notch.length]; sh.lineTo(x, -z); }
    }
    for (const h of holes) {
      const pts = typeof h[0] === 'number' ? [[h[0], h[1]], [h[0], h[3]], [h[2], h[3]], [h[2], h[1]]] : h;
      const p = new THREE.Path(); pts.forEach(([x, z], i) => (i ? p.lineTo(x, -z) : p.moveTo(x, -z))); p.closePath(); sh.holes.push(p);
    }
    const g = new THREE.ShapeGeometry(sh, 6), q = g.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = -q.getY(i); q.setXYZ(i, x, crownY(x, z, crown), z); }
    g.computeVertexNormals();
    const uv = new Float32Array(q.count * 2); for (let i = 0; i < q.count; i++) { uv[2 * i] = q.getX(i); uv[2 * i + 1] = -q.getZ(i); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }
  // a well sunk into the deck — a cockpit, a crew pod: a rounded outline [x0, z0]–[x1, z1] at the deck (corner radius
  // r), its walls sloping in by `slope` to a floor at y = floorY. openAft leaves the aft end open (an open transom).
  // Gives the outline (for deck()'s hole), the walls and the floor
  function tub(x0, z0, x1, z1, r, floorY, { slope = 0.06, crown = 0.04, openAft = false } = {}) {
    const ring = (a0, b0, a1, b1, rr) => {
      const pts = [], seg = 5, cs = [[a1 - rr, b0 + rr, -Math.PI / 2], [a1 - rr, b1 - rr, 0], [a0 + rr, b1 - rr, Math.PI / 2], [a0 + rr, b0 + rr, Math.PI]];
      cs.forEach(([cx, cz, a], k) => {
        const sharp = openAft && (k === 1 || k === 2);
        if (sharp) { pts.push([k === 1 ? a1 : a0, b1]); return; }
        for (let i = 0; i <= seg; i++) { const th = a + (Math.PI / 2) * (i / seg); pts.push([cx + rr * Math.cos(th), cz + rr * Math.sin(th)]); }
      });
      return pts;
    };
    const top = ring(x0, z0, x1, z1, r), bot = ring(x0 + slope, z0 + slope, x1 - slope, openAft ? z1 : z1 - slope, Math.max(0.02, r - slope));
    const pos = [], idx = [], m = top.length;
    for (const [x, z] of top) pos.push(x, crownY(x, z, crown) - 0.005, z);
    for (const [x, z] of bot) pos.push(x, floorY, z);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      if (openAft && top[i][1] >= z1 - 1e-6 && top[j][1] >= z1 - 1e-6) continue; // the open transom: no wall there
      idx.push(i, j, m + i, j, m + j, m + i);
    }
    const walls = new THREE.BufferGeometry(); walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); walls.setIndex(idx); walls.computeVertexNormals();
    const fs = new THREE.Shape(); bot.forEach(([x, z], i) => (i ? fs.lineTo(x, -z) : fs.moveTo(x, -z))); fs.closePath();
    const floor = new THREE.ShapeGeometry(fs, 4).rotateX(-Math.PI / 2).translate(0, floorY, 0);
    const fq = floor.attributes.position, fuv = new Float32Array(fq.count * 2); for (let i = 0; i < fq.count; i++) { fuv[2 * i] = fq.getX(i); fuv[2 * i + 1] = -fq.getZ(i); }
    floor.setAttribute('uv', new THREE.BufferAttribute(fuv, 2));
    return { outline: top, walls, floor };
  }
  // a picture wrapped onto the topsides (side +1 starboard), centred z0 aft of amidships and y0 up, W × H metres
  function decal(side, z0, y0, Wd, Hd, material) {
    const nu = 12, nv = 4, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, z = z0 - side * (u - 0.5) * Wd, y = y0 + (v - 0.5) * Hd;
      pos.push(side * (xAt(tAt(z), y) + 0.012), y, z); uv.push(u, v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.userData.flat = true;
    return m;
  }
  // the deck's smooth gelcoat border along the sheer, inside which the non-skid lies
  function border(width, mat, crown = 0.04) {
    const pos = [], idx = [], n = 64;
    for (const sd of [-1, 1]) {
      const b0 = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = 0.003 + (i / n) * 0.99, z = zAt(t), hb = H.hb(t) - 0.015, wi = Math.min(width, hb * 0.6);
        pos.push(sd * hb, crownY(hb, z, crown) + 0.004, z, sd * (hb - wi), crownY(hb - wi, z, crown) + 0.004, z);
      }
      for (let i = 0; i < n; i++) { const a = b0 + i * 2; sd > 0 ? idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) : idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.userData.flat = true;
    return m;
  }
  const deckY = (z) => H.sheer(tAt(z)), hbAt = (z) => H.hb(tAt(z));
  return { zAt, tAt, xAt, geometry, deck, tub, decal, border, deckY, hbAt, BOW: -STERN, STERN };
}

// the sail number on both bows, as racing boats carry it (yacht.js bowNumberMaterial)
function bowNumber(hull, look, z0, y0, W, H) {
  const mat = bowNumberMaterial(look);
  return [-1, 1].map((sd) => hull.decal(sd, z0, y0, W, H, mat));
}

function logoDecal(hull, side, logo, z0, y0, W, H) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  logoImage(logo).then((img) => { if (img) { drawContain(c.getContext('2d'), img, 256, 128, 496, 248); tex.needsUpdate = true; } });
  return hull.decal(side, z0, y0, W, H, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.25, envMapIntensity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// a foiler's hull paint: one gloss colour, its underside (seen when she flies) a shade darker
function foilerMaterial(hull) {
  const m = new THREE.MeshStandardMaterial({ color: hull, roughness: 0.2, metalness: 0.05, envMapIntensity: 1, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float aa = fwidth(vY) * 1.2; diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.12 - aa, 0.12 + aa, vY));');
  };
  m.customProgramCacheKey = () => 'foiler';
  return m;
}

// ---------- foils, bulbs and fittings ----------
// a foil section's half-thickness at x (0 its leading edge … 1 its trailing edge), as a share of the chord: NACA 00xx
const naca = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
// a fin lofted between two foil sections: the root at y = 0, the tip `span` below it; c0 and c1 the chords there, th
// the thickness as a share of the chord, the tip `sweep` m aft of the root. The leading edge forward (−z), the axis a
// quarter of the chord back from it. A keel, a rudder, a foil arm; turned on its side, a wing.
function finGeo(span, c0, c1, th, sweep = 0, n = 12) {
  const sec = [];
  for (let i = 0; i <= n; i++) sec.push([(1 + Math.cos((Math.PI * i) / n)) / 2, 1]); // trailing edge → leading edge, one face
  for (let i = 1; i < n; i++) sec.push([(1 - Math.cos((Math.PI * i) / n)) / 2, -1]); // and back along the other
  const m = sec.length, pos = [], idx = [], ring = [[0, c0, 0], [-span, c1, sweep]];
  for (const [y, c, dz] of ring) for (const [x, sd] of sec) pos.push(sd * naca(x) * th * c, y, dz + (x - 0.25) * c);
  for (let i = 0; i < m; i++) { const a = i, b = (i + 1) % m; idx.push(a, a + m, b, b, a + m, b + m); }
  // the ends, flat, on vertices of their own so the sides' shading doesn't bend round them
  ring.forEach(([y, c, dz], r) => {
    const base = pos.length / 3;
    for (const [x, sd] of sec) pos.push(sd * naca(x) * th * c, y, dz + (x - 0.25) * c);
    const ci = pos.length / 3; pos.push(0, y, dz + 0.25 * c);
    for (let i = 0; i < m; i++) r ? idx.push(ci, base + (i + 1) % m, base + i) : idx.push(ci, base + i, base + (i + 1) % m);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a torpedo along z, its nose forward: a keel's lead bulb, a foil's ballast pod
function bulbGeo(len, r, seg = 14) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16, rr = s < 0.32 ? Math.sin((s / 0.32) * Math.PI / 2) ** 0.55 : Math.max(0, 1 - ((s - 0.32) / 0.68) ** 2) ** 0.75;
    pts.push(new THREE.Vector2(Math.max(0.001, r * rr), s * len));
  }
  return new THREE.LatheGeometry(pts, seg).rotateX(Math.PI / 2).translate(0, 0, -len * 0.42);
}
// (the winches, blocks, clutches, wheels and the like are yacht.js's fittings, shared with the club's boat)
// a cam cleat: two jaws on a base
const camGeo = () => mergeGeometries([new THREE.BoxGeometry(0.06, 0.012, 0.09), new THREE.BoxGeometry(0.014, 0.03, 0.06).translate(-0.018, 0.02, 0), new THREE.BoxGeometry(0.014, 0.03, 0.06).translate(0.018, 0.02, 0)]);
// the deck's moulded non-skid (in metres, as the club boat's, without her baked shade) and its smooth gelcoat
const SKID = new THREE.MeshStandardMaterial({ map: NONSKID, roughness: 0.85 });
const GEL2 = new THREE.MeshStandardMaterial({ color: '#f1f0eb', roughness: 0.28, envMapIntensity: 0.8, side: THREE.DoubleSide });
// carbon spars under clear lacquer, the 2×2 twill of the cloth faintly showing through
const WEAVE = canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#2b3036'; x.fillRect(0, 0, w, h);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + j) % 4 < 2 ? '#353b42' : '#24292e'; x.fillRect(i * 8, j * 8, 8, 8); }
}, 10, 60);
const CARBON = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: WEAVE, roughness: 0.4, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1 });
const MAT = {
  fin: new THREE.MeshStandardMaterial({ color: '#202429', roughness: 0.45, metalness: 0.1 }), // faired, painted foils
  lead: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.5, metalness: 0.3 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: '#d0202a', emissive: '#5a0006', roughness: 0.4 }),
  green: new THREE.MeshStandardMaterial({ color: '#13a24a', emissive: '#003a14', roughness: 0.4 }),
};

// the sail's layout for sailTexture: where the number, the logo and the flag sit on this class's main
function rigOf({ span, chord, numAt, logoAt, flagAt, mark, head, tack, clew, ad, adH }) {
  return { span, chord, numAt, numK: (2 * chord(numAt)) / span / 0.43, logoM: logoAt * span, flagM: flagAt * span, mark,
    hd: head.clone().sub(tack), clew, ad, adH };
}

const SKINS = ['#c99272', '#e2b291', '#a36d4c', '#d8a27e', '#b98262', '#e8bd9c', '#8d5a3b', '#d39c78'];
function crewMats(look) {
  return {
    jacket: new THREE.MeshStandardMaterial({ color: look.crew || look.stripe, roughness: 0.8 }),
    trousers: new THREE.MeshStandardMaterial({ color: look.pants || '#262a31', roughness: 0.85 }),
    vest: new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.55 }),
    cap: new THREE.MeshStandardMaterial({ color: new THREE.Color(look.crew || look.stripe).getHSL({}).l < 0.3 ? '#efeee9' : '#22262c', roughness: 0.75 }),
  };
}
function windex(add, y, z) {
  const w = add(new THREE.Group(), 0, y, z); w.userData.flat = true;
  const rod = cyl(0.008, 0.008, 0.5, M.dark, 4); rod.position.set(0, 0.1, -0.1); rod.rotation.x = Math.PI / 2; w.add(rod);
  const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.dark); vane.rotation.x = -Math.PI / 2; vane.position.set(0, 0.1, -0.38); w.add(vane);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide })); tail.rotation.y = Math.PI / 2; tail.position.set(0, 0.12, 0.12); w.add(tail);
  return w;
}

// ---------- what both share with the club's boat ----------
class ClassView {
  start() {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    this.drawnL = this.cls.drawnL;
    this.sailSide = 1;
    this.tells = [];
    const T = this.tilt;
    return (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); T.add(o); return o; };
  }
  finish(label, labelY) {
    if (label) { this.label = labelSprite(label.color); this.labelText = label.text; this.label.position.set(0, labelY, 0); this.root.add(this.label); }
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.bake();
  }
  bake() { BoatView.prototype.bake.call(this); }
  setDetail(on) { BoatView.prototype.setDetail.call(this, on); }
  // afloat (or flying), heeled and pitched by the sea; side: the boom's side
  place(b, t, W, ride = 0) {
    const y = waveHeight(W, b.x, b.z, t), fx = Math.sin(b.h), fz = -Math.cos(b.h), L = this.drawnL * 0.4;
    const sea = 1 - 0.85 * ride; // flying, she skims over the waves
    const pitch = Math.atan2(waveHeight(W, b.x + fx * L, b.z + fz * L, t) - waveHeight(W, b.x - fx * L, b.z - fz * L, t), 2 * L) * sea;
    const roll = Math.atan2(waveHeight(W, b.x - fz * 1.5, b.z + fx * 1.5, t) - waveHeight(W, b.x + fz * 1.5, b.z - fx * 1.5, t), 3) * 0.5 * sea;
    const side = b.boom || (b.twa >= 0 ? 1 : -1);
    this.sailSide = lerp(this.sailSide, side, Math.abs(b.twa) > 2.1 ? 0.2 : 0.06);
    this.root.position.set(b.x, (y * 0.85 - 0.05) * sea + ride * this.flyY, b.z);
    this.root.rotation.y = -b.h;
    this.tilt.rotation.x = pitch - ride * 0.02; // flying: the bow a touch up
    this.tilt.rotation.z = side * b.heel * this.cls.heelShow * D2R + roll;
    return side;
  }
  // the jib on its stay, its sheets, the telltales and the masthead vane: as on the club's boat
  jibAndTells(b, t, side, belly, luff, ph, sheetTo) {
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, (this.jibMax ?? 30) * D2R);
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = this.HEAD.clone().sub(this.TACK), clew = this.CLEW, k = this.jibBelly ?? 0.125;
    setSail(this.jib, (f, u, v) => {
      const lx = head.x * f, ly = head.y * f, lz = head.z * f;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz);
      v.set(lerp(lx, ex, u) + belly * Math.sin(Math.PI * u ** 0.72) * len * k + luff * 0.25 * Math.sin(ph * 1.2 + f * 7 + u * 4) * u + leechFlutter(f, u, t + 0.4, b.aws || 0), lerp(ly, ey, u), lerp(lz, ez, u));
    });
    if (sheetTo) {
      const cw = clew.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1;
      const js = this.jibSheet.geometry.attributes.position, [p1, p2] = sheetTo(ls);
      js.setXYZ(0, cw.x, cw.y, cw.z); js.setXYZ(1, ...p1); js.setXYZ(2, ...p2); js.needsUpdate = true;
    }
    this.windex.rotation.y = -b.awa;
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side;
      tt.position.set(head.x * f + sx * 0.04, head.y * f, head.z * f + 0.3);
      let rot = Math.PI / 2 + Math.sin(t * 9 + f * 10) * 0.12, ok = true;
      if (b.trim === 'in' && windward) { rot = Math.PI / 2 + 1.0 + Math.sin(t * 13) * 0.5; ok = false; }
      if (b.trim === 'out' && !windward) { rot = 0.25 + Math.sin(t * 5 + f) * 0.2; ok = false; }
      if (b.trim === 'irons') { rot = Math.sin(t * 15 + f * 3) * 1.4; ok = false; }
      tt.rotation.x = -rot;
      tt.material.color.set(ok ? '#2ecc71' : '#ff4d3d');
    }
  }
  makeTells(player) {
    if (player) for (const [f, sx] of [[0.3, 1], [0.3, -1], [0.52, 1], [0.52, -1]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      t.userData = { f, sx }; this.jibPivot.add(t); this.tells.push(t);
    }
  }
  showLabel(b, showLabel) {
    if (!this.label) return;
    const status = b.pen ? '⟳' : b.ocs ? 'OCS' : b.dsq ? 'DSQ' : '';
    this.label.visible = showLabel && !!status;
    if (status) this.label.userData.set(status, true);
  }
  // a sailor eased towards where she should be: x, y, z, yaw (0 outboard … π inboard), lean, stand, knee, reach
  pose(c, want, k) {
    for (const key of ['x', 'y', 'z', 'yaw', 'lean', 'stand', 'knee', 'reach']) c[key] += (want[key] - c[key]) * k;
    const sd = c.x >= 0 ? 1 : -1, s = c.s;
    c.g.position.set(c.x, c.y, c.z); c.g.scale.x = sd;
    s.body.rotation.y = c.yaw; s.body.position.y = c.stand * (THIGH + SHIN + 0.02);
    s.upper.rotation.z = -c.lean;
    for (const l of s.legs) { l.hip.rotation.z = (1 - c.stand) * Math.PI / 2; l.knee.rotation.z = (1 - c.stand) * c.knee; }
    for (const a of s.arms) a.rotation.z = c.reach;
  }
  crewDt(t) { const first = this.crewT === undefined, dt = clamp(t - (this.crewT ?? t), 0, 0.1); this.crewT = t; return first ? 1 : 1 - Math.exp(-dt * 2.2); }
}

// ---------- the sportboats: the J/70 and the RS21 ----------
// RS: the RS21 — shorter and narrower, lower and flatter-sheered, a wide-open cockpit from the mast to the open
// transom with no cuddy and no lifelines, a slightly smaller rig and a lifting bulb keel. Each is worked out once, the
// first time a boat of hers is built.
const SPORT = {};
const sportOf = (RS) => (SPORT[RS] ??= sport(RS));
const sport = (RS) => {
  const L = RS ? 6.67 : 6.93, B = RS ? 2.2 : 2.25;
  const hull = hullOf({
    L, flare: RS ? 0.05 : 0.03,
    hb: (t) => (B / 2) * (t < 0.42 ? (RS ? 0.8 : 0.76) + (RS ? 0.2 : 0.24) * Math.sin((t / 0.42) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.42) / 0.58) * Math.PI / 2)) ** (RS ? 0.7 : 0.8)),
    sheer: (t) => (RS ? 0.55 + 0.09 * t ** 1.8 : 0.6 + 0.13 * t ** 1.6),
    depth: (t) => (RS ? 0.26 : 0.3) * Math.sin(Math.PI * Math.min(1, t * 0.93 + 0.05)) ** 0.75,
    n: (t) => lerp(RS ? 2.9 : 2.7, 1.7, clamp((t - 0.45) / 0.55, 0, 1)),
    // a chine aft, just clear of the water at the transom, fading out forward (the RS21's harder and longer)
    chine: { y: (t) => (RS ? 0.13 : 0.1) - 0.22 * t, w: (t) => 1 - smooth(RS ? 0.4 : 0.28, RS ? 0.8 : 0.64, t),
      dead: (t) => lerp(RS ? 12 : 16, RS ? 7 : 10, clamp(t / 0.35, 0, 1)), flat: 0.85 },
  });
  const MAST_Z = RS ? -0.95 : -1.05, MAST_FOOT = RS ? 0.66 : 0.78, MASTHEAD = RS ? 9.7 : 10.2, HOUNDS = RS ? 8.0 : 8.4, BOOM_Y = RS ? 1.32 : 1.45;
  const chord = RS ? (f) => lerp(2.9, 0.45, f) + 0.3 * Math.sin(Math.PI * f) : (f) => lerp(3.05, 0.42, f) + 0.32 * Math.sin(Math.PI * f);
  const TACK = new THREE.Vector3(0, hull.deckY(hull.BOW) + 0.06, hull.BOW + 0.06);
  const HEAD = new THREE.Vector3(0, HOUNDS - 0.2, MAST_Z - 0.07);
  const CLEW = new THREE.Vector3(0, 0.3, RS ? 2.15 : 2.3);
  const SPRIT = new THREE.Vector3(0, TACK.y + 0.04, hull.BOW - (RS ? 1.6 : 1.5));
  const rig = rigOf({ span: MASTHEAD - 0.2 - BOOM_Y, chord, numAt: 0.62, logoAt: 0.78, flagAt: 0.9, mark: 0.85, head: HEAD, tack: TACK, clew: CLEW, ad: 1.1, adH: 0.55 });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, HOUNDS, BOOM_Y, chord, TACK, HEAD, CLEW, SPRIT, rig };
};

class SportView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const RS = this.RS = cls.id === 'rs21', J = this.J = sportOf(RS);
    const add = this.start(), T = this.tilt, H = J.hull;
    this.flyY = 0;
    add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe)));
    // the deck, the open cockpit cut out of it from the cuddy (on the RS21, from just aft of the mast) to the open
    // transom, and its floor and sides
    const cz0 = RS ? -0.5 : -0.35, cx = RS ? 0.8 : 0.74, floorY = RS ? 0.26 : 0.3;
    // the cockpit: a moulded well, its walls sloping in to a non-skid floor and open to the transom, notched out of
    // the deck; the deck non-skid inside a smooth gelcoat border along the sheer
    const ck = H.tub(-cx, cz0, cx, H.STERN, 0.2, floorY, { slope: 0.09, crown: 0.03, openAft: true });
    add(new THREE.Mesh(H.deck([], 0.03, ck.outline), SKID));
    const walls = add(new THREE.Mesh(ck.walls, GEL2)); walls.userData.detail = false;
    add(new THREE.Mesh(ck.floor, SKID));
    T.add(H.border(0.08, GEL2, 0.03));
    // the cuddy: a low, rounded coachroof forward of the cockpit, with a small hatch, and the mast through it
    const cud = new THREE.Shape(), a = 0.62, f = 0.4, za = -0.35, zf = -2.0, r = 0.18;
    cud.moveTo(-a + r, -za); cud.lineTo(a - r, -za); cud.quadraticCurveTo(a, -za, a, -za - r); cud.lineTo(f, -zf - r); cud.quadraticCurveTo(f, -zf, f - r, -zf);
    cud.lineTo(-f + r, -zf); cud.quadraticCurveTo(-f, -zf, -f, -zf - r); cud.lineTo(-a, -za - r); cud.quadraticCurveTo(-a, -za, -a + r, -za);
    const cg = new THREE.ExtrudeGeometry(cud, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 6 });
    cg.rotateX(-Math.PI / 2);
    const cudY = H.deckY(-1.2) - 0.02;
    if (!RS) {
      add(new THREE.Mesh(cg, M.gel), 0, cudY, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.42), M.glass), 0, cudY + 0.21, -1.55);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.alu), 0, cudY + 0.205, -1.55);
    } else {
      // the RS21 has none: a flush foredeck with a hatch for the kite, and the electric outboard's pod under the transom
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.dark), 0, H.deckY(-1.9) + 0.03, -1.9);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10).rotateX(Math.PI / 2), M.dark), 0, -0.12, H.STERN - 0.55);
    }
    // foot chocks across the cockpit floor, and the sprit's housing at the stem with its launcher line
    for (const fz of [0.6, 1.3, 2.0]) add(new THREE.Mesh(new THREE.BoxGeometry(cx * 1.7, 0.03, 0.05), M.dark), 0, floorY + 0.035, fz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12).rotateX(Math.PI / 2), M.dark), 0, J.SPRIT.y, H.BOW + 0.03);
    // the keel: a tapered fin of a proper foil section with a lead torpedo on its tip (the RS21's lifts: its trunk's
    // cap shows on the cockpit floor); the spade rudder under the cockpit, its stock up through the floor
    const finSpan = RS ? 1.1 : 1.18;
    add(new THREE.Mesh(finGeo(finSpan, 0.58, 0.44, 0.11, 0.1), MAT.fin), 0, -0.2, -0.18);
    add(new THREE.Mesh(bulbGeo(RS ? 1.25 : 1.4, 0.16), MAT.lead), 0, -0.24 - finSpan, -0.02);
    for (const sx of [-1, 1]) { const w = add(new THREE.Mesh(finGeo(0.16, 0.18, 0.1, 0.1, 0.05), MAT.lead), sx * 0.05, -0.24 - finSpan, 0.58); w.rotation.z = sx * Math.PI / 2; } // the bulb's tail fins
    if (RS) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.7), M.dark), 0, 0.29, -0.15);
    add(new THREE.Mesh(finGeo(0.98, 0.38, 0.25, 0.12, 0.07), MAT.fin), 0, -0.1, 2.88);
    add(cyl(0.035, 0.035, 0.12, M.steel, 10), 0, H.deckY(2.85) + 0.02, 2.85); // the rudder stock's head
    // the tiller on the rudder stock, its extension forward; it swings with the helm
    this.wheel = add(new THREE.Group(), 0, H.deckY(2.85) + 0.05, 2.85);
    const tl = cyl(0.025, 0.035, 1.15, M.teak, 8); tl.rotation.x = Math.PI / 2 - 0.12; tl.position.set(0, 0.07, -0.55); this.wheel.add(tl);
    const ext = cyl(0.012, 0.012, 0.9, M.dark, 6); ext.rotation.z = Math.PI / 2; ext.position.set(0.45, 0.14, -1.1); this.wheel.add(ext);
    // toe rails along the sheer; no lifelines but the bow's short pulpit and the stern's
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 20; i++) { const t = 0.02 + (i / 20) * 0.95; pts.push([sx * (J.hull.hbAt(H.zAt(t)) - 0.015), H.deckY(H.zAt(t)) + 0.02, H.zAt(t)]); }
      T.add(tube(pts, 0.015, M.dark));
      // and the vinyl rubbing strake round the hull-to-deck joint, just under them
      const rub = []; for (let i = 0; i <= 12; i++) { const t = 0.01 + (i / 12) * 0.97, y = H.deckY(H.zAt(t)) - 0.02; rub.push([sx * (H.xAt(t, y) + 0.005), y, H.zAt(t)]); }
      T.add(tube(rub, 0.01, M.dark));
    }
    const SPR = RS ? 4.9 : 5.1; // the spreaders' height
    for (const sx of [-1, 1]) {
      const z0 = H.BOW + 0.6, z1 = H.BOW + 0.1, hb = (z) => Math.max(0.08, H.hbAt(z) - 0.06);
      // the jib tracks, on the cuddy's sides (on the RS21's foredeck), with their cars and blocks; the winches by the
      // cockpit and the cam cleats beside them; the chainplates for the shrouds; and a bow light on the pulpit
      const ty = RS ? H.deckY(-0.7) + 0.01 : cudY + 0.18;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.6), M.alu), sx * 0.55, ty, -0.7);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), M.dark), sx * 0.55, ty + 0.02, -0.62);
      fit(add, block(0.028), sx * 0.55, ty + 0.065, -0.62);
      fit(add, winch(0.05, 0.13), sx * 0.82, H.deckY(0.2) + 0.005, 0.2);
      for (const dz of [0.42, 0.62]) { const c = add(new THREE.Mesh(camGeo(), M.dark), sx * 0.8, H.deckY(dz) + 0.01, dz); c.rotation.y = sx * 0.3; }
      // the shrouds' chainplates and rigging screws: the caps' up to the spreader's tip, the lowers' to the mast
      const foot = (dz) => [sx * (H.hbAt(dz) - 0.05), H.deckY(dz) + 0.02, dz];
      fit(add, chainplate(foot(J.MAST_Z + 0.4), [sx * 0.62, SPR, J.MAST_Z + 0.22], 0.2, 0.011));
      fit(add, chainplate(foot(J.MAST_Z - 0.1), [0, SPR - 0.1, J.MAST_Z], 0.2, 0.011));
      if (!RS) add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.05), sx > 0 ? MAT.green : MAT.red), sx * 0.11, H.deckY(H.BOW + 0.1) + 0.55, H.BOW + 0.1);
      if (RS) continue; // no pulpit, stanchions or lifelines on the RS21
      T.add(tube([[sx * hb(z0), H.deckY(z0), z0], [sx * hb(z0), H.deckY(z0) + 0.5, z0], [sx * 0.12, H.deckY(z1) + 0.52, z1], [sx * 0.08, H.deckY(z1), z1]], 0.014, M.steel));
      for (const t of [0.22, 0.45, 0.68]) add(cyl(0.01, 0.012, 0.5, M.steel, 6), sx * (H.hbAt(H.zAt(t)) - 0.06), H.deckY(H.zAt(t)) + 0.25, H.zAt(t));
      T.add(line([[sx * hb(z0), H.deckY(z0) + 0.48, z0], ...[0.68, 0.45, 0.22].map((t) => [sx * (H.hbAt(H.zAt(t)) - 0.06), H.deckY(H.zAt(t)) + 0.48, H.zAt(t)])]));
    }
    // the bowsprit, run out for the kite
    this.sprit = add(cyl(0.025, 0.03, 1.6, CARBON, 8), 0, J.SPRIT.y, H.BOW - 0.7); this.sprit.rotation.x = Math.PI / 2;
    // the rig: a carbon mast through the cuddy, one set of swept spreaders, no backstay
    add(cyl(0.04, 0.065, J.MASTHEAD - J.MAST_FOOT, CARBON, 14), 0, (J.MAST_FOOT + J.MASTHEAD) / 2, J.MAST_Z);
    // the tactical compass on the back of the mast, under the gooseneck; the halyards' turning blocks at the mast's
    // foot and, on the J/70, their clutches at the aft end of the cuddy, the tails led on into the cockpit
    fit(add, display(0.15, 0.12, 3), 0, J.BOOM_Y - 0.27, J.MAST_Z + 0.08);
    const MF = H.deckY(J.MAST_Z) + (RS ? 0.03 : 0.2);
    for (const sx of [-1, 1]) {
      fit(add, block(0.022), sx * 0.09, MF + 0.03, J.MAST_Z + 0.02, sx * 0.5);
      if (RS) continue;
      fit(add, clutches(2, 0.06), sx * 0.3, cudY + 0.195, -0.5);
      for (const k of [0, 1]) { const x = sx * (0.27 + k * 0.06); T.add(line([[sx * 0.08, MF + 0.04, J.MAST_Z + 0.05], [x, cudY + 0.22, -0.6], [x, cudY + 0.22, -0.4], [x * 0.9, floorY + 0.05, 0.1]])); }
    }
    // the mast's collar at the deck, the gooseneck, the halyards down its front (jib, kite) and back (main), the spreaders' tips
    add(cyl(0.085, 0.095, 0.06, M.dark, 14), 0, H.deckY(J.MAST_Z) + (RS ? 0.03 : 0.2), J.MAST_Z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.1), M.alu), 0, J.BOOM_Y, J.MAST_Z + 0.06);
    for (const dx of [-0.03, 0.03]) T.add(line([[dx, J.HOUNDS + (dx > 0 ? 0.6 : 0), J.MAST_Z - 0.06], [dx, J.MAST_FOOT + 0.3, J.MAST_Z - 0.07]]));
    T.add(line([[0, J.MASTHEAD - 0.1, J.MAST_Z + 0.06], [0, J.BOOM_Y + 0.3, J.MAST_Z + 0.06]]));
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), M.dark), sx * 0.62, SPR, J.MAST_Z + 0.22);
    for (const sx of [-1, 1]) { const s = add(cyl(0.015, 0.022, 0.66, M.carbon, 6), sx * 0.31, SPR, J.MAST_Z + 0.12); s.rotation.z = Math.PI / 2; s.rotation.y = -sx * 0.35; }
    T.add(line([[0, J.HOUNDS, J.MAST_Z], [J.TACK.x, J.TACK.y, J.TACK.z]]));
    for (const sx of [-1, 1]) {
      T.add(line([[0, J.HOUNDS, J.MAST_Z], [sx * 0.62, SPR, J.MAST_Z + 0.22], [sx * (H.hbAt(J.MAST_Z + 0.4) - 0.05), H.deckY(J.MAST_Z + 0.4) + 0.02, J.MAST_Z + 0.4]]));
      T.add(line([[0, SPR - 0.1, J.MAST_Z], [sx * (H.hbAt(J.MAST_Z - 0.1) - 0.05), H.deckY(J.MAST_Z - 0.1) + 0.02, J.MAST_Z - 0.1]]));
    }
    // the mainsheet: a four-part tackle from the ratchet block on the cockpit floor up to the block under the boom
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    const rat = new THREE.Group(); rat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), M.dark));
    for (const [g, mm] of block(0.035)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.065; rat.add(o); }
    this.travCar = add(mergeGroup(rat), 0, floorY + 0.04, 0.9); // the mainsheet's ratchet block on its swivel base
    this.mainPivot = add(new THREE.Group(), 0, 0, J.MAST_Z);
    const BL = RS ? 3.0 : 3.15, boom = cyl(0.04, 0.032, BL, CARBON, 10); boom.rotation.x = Math.PI / 2; boom.position.set(0, J.BOOM_Y, BL / 2 - 0.02); this.mainPivot.add(boom);
    // a rigid kicker from the mast's foot to the boom (its alloy ram in a carbon tube), the outhaul's end fitting and
    // the mainsheet's block under the boom, one mesh a material
    const gear = new THREE.Group(), VA = [0, J.MAST_FOOT + 0.3, 0.07], VB = [0, J.BOOM_Y - 0.05, 0.78], VM = VA.map((v, i) => lerp(v, VB[i], 0.4));
    gear.add(bar(VA, VM, 0.012, 0.012, M.alu), bar(VM, VB, 0.02, 0.018, M.carbon));
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.1), M.alu); end.position.set(0, J.BOOM_Y, BL - 0.05); gear.add(end);
    for (const [g, mm] of block(0.035)) { const o = new THREE.Mesh(g, mm); o.position.set(0, J.BOOM_Y - 0.085, 2.9); gear.add(o); }
    this.mainPivot.add(mergeGroup(gear));
    this.main = sailMesh(20, 10, sailTexture('main', look, J.rig), look.laminate, 'main'); this.mainPivot.add(this.main);
    this.TACK = J.TACK; this.HEAD = J.HEAD; this.CLEW = J.CLEW; this.jibMax = 26;
    this.jibPivot = add(new THREE.Group(), J.TACK.x, J.TACK.y, J.TACK.z);
    this.jibAxis = J.HEAD.clone().sub(J.TACK).normalize();
    this.jib = sailMesh(16, 8, sailTexture('jib', look, J.rig), look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.kite = sailMesh(16, 10, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);
    this.makeTells(player);
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 1.3, 0.5, 0.8, 0.3));
    T.add(...bowNumber(H, look, H.BOW + 0.62, 0.48, 0.62, 0.17));
    // the jib sheets, the working one taut and the lazy one slack; the kite's sheet and its tack line to the sprit
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false;
    this.windex = windex(add, J.MASTHEAD + 0.02, J.MAST_Z);
    // four: the helm, the main trimmer, the jib and kite trimmer, and the bow; on the RS21 three, the trimmer forward
    // for a hoist or a drop
    const m = crewMats(look);
    this.crew = (RS ? [2.1, 1.25, 0.4] : [2.25, 1.45, 0.75, 0.0]).map((z0, i) => {
      const s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[i], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, x: 0, y: H.deckY(z0), z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 };
    });
    this.floorY = floorY;
    this.finish(label, 12);
  }
  update(b, t, W, showLabel) {
    const { RS, J } = this, H = J.hull, side = this.place(b, t, W);
    this.wheel.rotation.y = b.rudder * 0.5;
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    const belly = -this.sailSide * (1 - luff * 0.85), span = J.rig.span;
    setSail(this.main, (f, u, v) => {
      const ch = J.chord(f), tw = -this.sailSide * f * f * 0.35 * u;
      v.set(belly * Math.sin(Math.PI * u ** 0.78) * ch * 0.11 * (1 - 0.4 * f) + tw + luff * 0.15 * Math.sin(ph + f * 6 + u * 5) * u + leechFlutter(f, u, t, b.aws || 0), J.BOOM_Y + 0.06 + f * span, u * ch);
    });
    const ma = this.mainPivot.rotation.y, bz = 2.9;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.4, -0.6, 0.6);
    purchase(this.mainsheet, [this.travCar.position.x, this.floorY + 0.105, 0.9], [Math.sin(ma) * bz, J.BOOM_Y - 0.085, J.MAST_Z + Math.cos(ma) * bz], 0.03);
    const ty = RS ? H.deckY(-0.7) + 0.07 : 0.95;
    this.jibAndTells(b, t, side, belly, luff, ph, (ls) => [[ls * 0.55, ty, -0.62], [ls * 0.82, H.deckY(0.2) + 0.12, 0.2]]);
    { const cw = J.CLEW.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position;
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, cw.y - 0.25, cw.z + 0.15); lz.setXYZ(2, -ls * 0.55, ty, -0.62); lz.setXYZ(3, -ls * 0.82, H.deckY(0.2) + 0.12, 0.2); lz.needsUpdate = true; }
    // the crew: hiking on the windward rail upwind, legs over the side; downwind sitting in on the side deck, the
    // trimmer to leeward under the kite; the bow forward to the mast for a hoist or a drop
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      if (c.i === 0) { x = side * (H.hbAt(z) - 0.12); y = H.deckY(z) + 0.06; yaw = up ? 0.35 : 1.2; lean = up ? 0.2 + 0.35 * hike : 0.1; knee = up ? -1.7 : -1.2; reach = 0.9; }
      else if (c.i === (RS ? 2 : 3) && bowBusy) { x = 0.1; z = J.MAST_Z + 0.45; y = H.deckY(z) + 0.2; yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; }
      else if (up) { x = side * (H.hbAt(z) - 0.1); y = H.deckY(z) + 0.07; yaw = 0; lean = 0.15 + 0.5 * hike; knee = -1.85; reach = 0.3; }
      else { const lee = c.i === 2 && b.kite; x = (lee ? -side : side) * (H.hbAt(z) - 0.25); y = H.deckY(z) + 0.05; yaw = lee ? 0.6 : Math.PI - 0.4; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach }, k);
    }
    // the kite, off the sprit, hoisted to the hounds
    const kf = b.kiteFill ?? (b.kite ? 1 : 0), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)), S = J.SPRIT;
    this.kite.visible = this.kiteSheet.visible = kf > 0.02; this.sprit.visible = kf > 0.02 || !!b.kiteJob;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(3.6, 2.0, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [S.x, S.y + 0.06, S.z], hd = [0, lerp(S.y + 0.6, J.HOUNDS + 0.25, kf), lerp(S.z, J.MAST_Z - 0.1, kf)], cl = [sd * out, lerp(S.y + 0.3, 1.7, kf), lerp(S.z + 0.5, 1.0, kf)];
      setSail(this.kite, (f, u, v) => {
        const lx = sd * Math.sin(Math.PI * f) * 1.4 * kfill, lz = -Math.sin(Math.PI * f) * 1.5 * kfill;
        const p = [lerp(tk[0], hd[0], f) + lx, lerp(tk[1], hd[1], f), lerp(tk[2], hd[2], f) + lz];
        const q = [lerp(cl[0], hd[0], f), lerp(cl[1], hd[1], f), lerp(cl[2], hd[2], f)];
        const bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, f * 1.08)) * 1.65 * kfill;
        v.set(lerp(p[0], q[0], u) + sd * bul, lerp(p[1], q[1], u), lerp(p[2], q[2], u) - bul * 0.9);
      });
      const kp = this.kiteSheet.geometry.attributes.position;
      kp.setXYZ(0, cl[0], cl[1], cl[2]); kp.setXYZ(1, sd * 0.9, H.deckY(2.6) + 0.08, 2.6); kp.setXYZ(2, sd * 0.82, H.deckY(0.2) + 0.12, 0.2); kp.needsUpdate = true;
    }
    this.showLabel(b, showLabel);
  }
}

// ---------- the AC75 ----------
const A = (() => {
  const L = 22.86, B = 5.0;
  const hull = hullOf({
    L, flare: 0.02,
    // full aft, a long fine bow that rounds up to a narrow, raked stem
    hb: (t) => (B / 2) * (t < 0.5 ? 0.86 + 0.14 * Math.sin((t / 0.5) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.5) / 0.5) * Math.PI / 2)) ** 0.62),
    sheer: (t) => 1.05 + 0.32 * t ** 2.2,
    depth: (t) => 0.62 * Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.1)) ** 0.6,
    n: (t) => lerp(3.4, 2.1, clamp((t - 0.4) / 0.6, 0, 1)), // a flat-bottomed scow aft
    // a hard chine high on the topsides aft, the flat, nearly deadrise-less bottom of a skimming hull below it
    chine: { y: (t) => 0.42 - 0.45 * t, w: (t) => 1 - smooth(0.5, 0.88, t), dead: (t) => lerp(7, 3, clamp(t / 0.4, 0, 1)), flat: 0.92 },
  });
  const MAST_Z = -2.2, MAST_FOOT = 1.2, MASTHEAD = 27.6, DECK = hull.deckY(MAST_Z);
  const FOOT_Y = DECK + 0.15; // the main sweeps the deck: no boom
  const chord = (f) => lerp(8.6, 2.4, f) + 0.7 * Math.sin(Math.PI * f);
  const TACK = new THREE.Vector3(0, hull.deckY(hull.BOW + 1.6) + 0.12, hull.BOW + 1.6);
  const HEAD = new THREE.Vector3(0, 21.5, MAST_Z - 0.35);
  const CLEW = new THREE.Vector3(0, 0.25, 6.2);
  const ARM = { x: 2.35, y: 0.85, z: -0.6, len: 5.6 }; // the foil arms' pivots on the topsides, and their length
  const rig = rigOf({ span: MASTHEAD - 0.4 - FOOT_Y, chord, numAt: 0.5, logoAt: 0.7, flagAt: 0.84, mark: 2.6, head: HEAD, tack: TACK, clew: CLEW, ad: 3.6, adH: 1.6 });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, FOOT_Y, chord, TACK, HEAD, CLEW, ARM, rig };
})();

class AC75View extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const add = this.start(), T = this.tilt, H = A.hull;
    this.flyY = 1.7;
    const paint = foilerMaterial(look.hull);
    add(new THREE.Mesh(H.geometry(), paint));
    // the bustle: a long fin down the centreline of the bottom, sealing the main's foot to the water
    const bus = new THREE.Shape(); bus.moveTo(-5.5, 0); bus.quadraticCurveTo(0, -0.75, 6.5, -0.1); bus.lineTo(6.5, 0.2); bus.lineTo(-5.5, 0.2); bus.closePath();
    const bg = new THREE.ExtrudeGeometry(bus, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    bg.translate(0, 0, -0.18); bg.rotateY(Math.PI / 2);
    add(new THREE.Mesh(bg, paint), 0, -0.48, 0.5);
    // the deck, flat and dark, with eight crew pods cut into it, four a side: the cyclors forward, the trimmers, the
    // helms aft. Each pod has a rubber rim, a floor and its seat or wheel
    // each a moulded well with rounded corners, its rim in rubber
    const pods = [], podWall = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.6, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-0.6, 0.8], [1.6, 3.0], [3.8, 5.2], [7.4, 9.2]]) {
      const [x0, x1] = sx < 0 ? [-2.05, -1.05] : [1.05, 2.05], tb = H.tub(x0, z0, x1, z1, 0.22, H.deckY((z0 + z1) / 2) - 0.9, { slope: 0.05, crown: 0.08 });
      pods.push(tb.outline);
      const w = add(new THREE.Mesh(tb.walls, podWall)); w.userData.detail = false;
      add(new THREE.Mesh(tb.floor, MAT.rubber));
      T.add(tube(tb.outline.map(([x, z]) => [x, H.deckY(z) + 0.1, z]), 0.03, MAT.rubber, true));
    }
    add(new THREE.Mesh(H.deck(pods, 0.08), new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.55, metalness: 0.15 })));
    // the cyclors' bikes in the two forward pods each side: a saddle on its post, the crank housing and the bars
    this.bikes = [];
    for (const sx of [-1, 1]) for (const z of [0.1, 2.3]) {
      const fy = H.deckY(z) - 0.88;
      add(cyl(0.03, 0.03, 0.6, M.dark, 8), sx * 1.55, fy + 0.3, z + 0.25);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.26), MAT.rubber), sx * 1.55, fy + 0.62, z + 0.22);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12).rotateZ(Math.PI / 2), M.alu), sx * 1.55, fy + 0.3, z - 0.25);
      add(cyl(0.025, 0.025, 0.7, M.dark, 8), sx * 1.55, fy + 0.62, z - 0.45);
      const bars = add(cyl(0.02, 0.02, 0.42, M.dark, 6), sx * 1.55, fy + 0.95, z - 0.45); bars.rotation.z = Math.PI / 2;
    }
    // the hatches and the instrument displays at the foot of the mast
    for (const sx of [-1, 1]) {
      fit(add, display(0.5, 0.3, sx < 0 ? 0 : 2), sx * 0.62, H.deckY(A.MAST_Z) + 0.45, A.MAST_Z + 0.45, 0, -0.25);
      add(cyl(0.03, 0.04, 0.34, M.dark, 8), sx * 0.62, H.deckY(A.MAST_Z + 0.42) + 0.17, A.MAST_Z + 0.42); // on its post
    }
    for (const z of [-6.5, 5.9]) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), M.dark), 0, H.deckY(z) + 0.09, z);
    // the foil arms: one each side, pivoting in a faired bearing on the topsides; the leeward one down in the water,
    // the windward one canted up and out. Each is a foil section, ending in a T-wing: two anhedral halves, their flaps
    // and the ballast pod where they meet
    const foilMat = new THREE.MeshPhysicalMaterial({ color: '#23272d', roughness: 0.35, metalness: 0.2, clearcoat: 0.8 });
    const flapMat = new THREE.MeshPhysicalMaterial({ color: look.hull, roughness: 0.3, clearcoat: 0.8 });
    this.arms = [-1, 1].map((sx) => {
      const bear = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 18).rotateX(Math.PI / 2), paint), sx * (A.ARM.x - 0.05), A.ARM.y, A.ARM.z);
      bear.scale.set(0.55, 1, 1);
      const g = add(new THREE.Group(), sx * A.ARM.x, A.ARM.y, A.ARM.z);
      g.add(new THREE.Mesh(finGeo(A.ARM.len, 0.78, 0.6, 0.2, 0.12), foilMat));
      const tip = new THREE.Group(); tip.position.set(0, -A.ARM.len, 0.1); g.add(tip);
      for (const wx of [-1, 1]) {
        const half = new THREE.Mesh(finGeo(2.05, 0.72, 0.38, 0.13, 0.28), foilMat); half.rotation.z = wx * (Math.PI / 2 - 0.12); tip.add(half);
        const flap = new THREE.Mesh(finGeo(1.85, 0.2, 0.12, 0.09, 0.22), flapMat); flap.position.z = 0.52; flap.rotation.z = wx * (Math.PI / 2 - 0.12); tip.add(flap);
      }
      tip.add(new THREE.Mesh(bulbGeo(2.6, 0.24), foilMat));
      mergeGroup(g);
      g.userData.sx = sx; g.userData.cant = sx > 0 ? -0.1 : 0.1;
      return g;
    });
    // the rudder: a deep T-foil off the transom on its stock, turning with the helm, its elevator flapped
    this.rudder = add(new THREE.Group(), 0, 0.5, H.STERN - 0.35);
    this.rudder.add(new THREE.Mesh(finGeo(4.1, 0.66, 0.46, 0.12, 0.25), foilMat));
    for (const wx of [-1, 1]) { const e = new THREE.Mesh(finGeo(1.2, 0.5, 0.3, 0.12, 0.12), foilMat); e.position.set(0, -3.95, 0.25); e.rotation.z = wx * Math.PI / 2; this.rudder.add(e); }
    this.rudder.add(new THREE.Mesh(bulbGeo(0.9, 0.09), foilMat).translateY(-3.95).translateZ(0.3));
    mergeGroup(this.rudder);
    // the helms' wheels, in the aft pods (they turn with the helm)
    this.wheel = add(new THREE.Group(), 0, 0, 0);
    for (const sx of [-1, 1]) {
      const w = wheel(0.3, 5); w.position.set(sx * 1.55, H.deckY(7.4) - 0.1, 7.6); this.wheel.add(w);
      add(cyl(0.05, 0.07, 0.75, M.dark, 8), sx * 1.55, H.deckY(7.4) - 0.5, 7.75);
    }
    // the mast: a tall D-section stepped on a ball, rotating with the main; the shrouds and the jumpers, the forestay
    this.mast = new THREE.Group(); this.mast.position.set(0, 0, -0.35);
    const mast = cyl(0.2, 0.36, A.MASTHEAD - A.MAST_FOOT, CARBON, 20); mast.position.y = (A.MAST_FOOT + A.MASTHEAD) / 2; mast.scale.set(0.75, 1, 1.55); this.mast.add(mast);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1.4), M.dark), 0, H.deckY(A.MAST_Z), A.MAST_Z);
    for (const sx of [-1, 1]) {
      T.add(line([[0, 22.5, A.MAST_Z], [sx * 1.4, 13, A.MAST_Z + 0.4], [sx * (H.hbAt(A.MAST_Z + 1) - 0.2), H.deckY(A.MAST_Z + 1) + 0.05, A.MAST_Z + 1]]));
      T.add(line([[0, 13, A.MAST_Z], [sx * (H.hbAt(A.MAST_Z + 0.5) - 0.25), H.deckY(A.MAST_Z + 0.5) + 0.05, A.MAST_Z + 0.5]]));
      const s = add(cyl(0.03, 0.05, 1.4, CARBON, 6), sx * 0.7, 13, A.MAST_Z + 0.2); s.rotation.z = Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), M.steel), sx * (H.hbAt(A.MAST_Z + 1) - 0.2), H.deckY(A.MAST_Z + 1) + 0.04, A.MAST_Z + 1);
    }
    T.add(line([[0, A.HEAD.y + 0.1, A.MAST_Z], [A.TACK.x, A.TACK.y, A.TACK.z]]));
    // the main: two skins round the mast, meeting at the leech; the clew sheeted to a traveller near the stern, no boom
    this.mainsheet = line([[0, 0, 0], [0, 1, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    this.travCar = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.24), M.dark), 0, H.deckY(6.6) + 0.07, 6.6);
    add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.12), M.steel), 0, H.deckY(6.6) + 0.02, 6.6);
    this.mainPivot = add(new THREE.Group(), 0, 0, A.MAST_Z + 0.35);
    this.mainPivot.add(this.mast);
    const mtex = sailTexture('main', look, A.rig);
    this.main = sailMesh(24, 12, mtex, true, 'main'); this.mainPivot.add(this.main);
    this.main2 = sailMesh(24, 12, mtex, true, 'main'); this.mainPivot.add(this.main2);
    this.clewBoard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), M.carbon); this.mainPivot.add(this.clewBoard);
    // the self-tacking jib: its car runs on a curved track across the foredeck
    this.TACK = A.TACK; this.HEAD = A.HEAD; this.CLEW = A.CLEW; this.jibMax = 18; this.jibBelly = 0.09;
    const trk = []; for (let i = 0; i <= 16; i++) { const a = (i / 16 - 0.5) * 1.1; trk.push([Math.sin(a) * 6.2, H.deckY(A.TACK.z + 6.2 * Math.cos(a)) + 0.04, A.TACK.z + 6.2 * Math.cos(a)]); }
    T.add(tube(trk, 0.03, M.steel));
    for (const p of [trk[0], trk[16]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), M.dark), p[0], p[1] + 0.02, p[2]); // its end stops
    fit(add, chainplate([0, A.TACK.y - 0.08, A.TACK.z + 0.05], [0, A.HEAD.y, A.MAST_Z], 0.4, 0.03)); // the jib's tack fitting on the deck
    this.jibPivot = add(new THREE.Group(), A.TACK.x, A.TACK.y, A.TACK.z);
    this.jibAxis = A.HEAD.clone().sub(A.TACK).normalize();
    this.jib = sailMesh(18, 8, sailTexture('jib', look, A.rig), true, 'jib'); this.jibPivot.add(this.jib);
    this.jibCar = add(new THREE.Group()); this.jibCar.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.18), M.dark)); // a group: bake() leaves it to move
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.jibSheet.frustumCulled = false; T.add(this.jibSheet);
    // no kite on a foiler: the parts the game asks for, never shown
    this.kite = sailMesh(2, 2, sailTexture('kite', look), false, 'kite'); this.kite.visible = false;
    this.sprit = new THREE.Group(); this.kiteSheet = new THREE.Group(); this.lazySheet = new THREE.Group();
    this.makeTells(player);
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 4.6, 0.75, 2.6, 0.95));
    T.add(...bowNumber(H, look, H.BOW + 2.3, 0.95, 2.0, 0.5));
    this.windex = windex(add, A.MASTHEAD + 0.05, A.MAST_Z);
    // the broadcast's camera pods: one on a short post on the aft deck looking forward, one high on the mast
    add(cyl(0.04, 0.05, 0.5, M.dark, 8), 0, H.deckY(10.2) + 0.25, 10.2);
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10).rotateX(Math.PI / 2), M.dark), 0, H.deckY(10.2) + 0.55, 10.15);
    const cam = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 10).rotateX(Math.PI / 2), M.dark); cam.position.set(0, 18.5, -0.4); this.mast.add(cam);
    // eight: the two helms aft at their wheels, the two trimmers, and the four cyclors on their bikes forward
    const m = { ...crewMats(look), helmet: true }, spots = []; // America's Cup crews race in helmets
    for (const [z, i] of [[8.0, 0], [4.5, 1], [2.3, 3], [0.1, 3]]) for (const sx of [-1, 1]) spots.push([sx, z, i]);
    this.crew = spots.map(([sx, z0, i], n) => {
      const s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[n % SKINS.length], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, sx, ph: n * 1.7, x: sx * 1.55, y: H.deckY(z0) - 0.95, z: z0, yaw: Math.PI / 2, lean: 0.2, stand: 1, knee: -0.4, reach: 0.9 };
    });
    this.finish(label, 31);
  }
  update(b, t, W, showLabel) {
    const H = A.hull, ride = b.ride ?? (b.v > 6 ? 1 : 0), side = this.place(b, t, W, ride);
    this.wheel.children.forEach((w) => { w.rotation.z = -b.rudder * 1.2; });
    this.rudder.rotation.y = b.rudder * 0.3;
    // the foils: the leeward arm down, the windward one canted up out of the water (both down when she stops)
    for (const g of this.arms) {
      const lee = g.userData.sx === -side, want = lee || b.v < 1.5 ? (g.userData.sx > 0 ? -0.08 : 0.08) : g.userData.sx * 2.15;
      g.userData.cant = lerp(g.userData.cant, want, 0.05);
      g.rotation.z = g.userData.cant;
    }
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    this.mast.rotation.y = -this.sailSide * Math.min(sa, 0.5) * 0.3; // the mast turns a little further than the sail's foot to line up with it
    const belly = -this.sailSide * (1 - luff * 0.85), span = A.rig.span;
    // the double skin: a deep, even camber all the way up, a little twist off at the head; the two skins stand apart
    // round the mast (its width) and close to the leech
    for (const [mesh, sk] of [[this.main, 1], [this.main2, -1]]) setSail(mesh, (f, u, v) => {
      const ch = A.chord(f), tw = -this.sailSide * f * f * 0.9 * u, gap = 0.24 * (1 - 0.5 * f) * (1 - u) ** 1.6;
      v.set(belly * Math.sin(Math.PI * u ** 0.7) * ch * 0.1 + tw + sk * gap + luff * 0.3 * Math.sin(ph + f * 6 + u * 5) * u, A.FOOT_Y + f * span, u * ch);
    });
    const ch0 = A.chord(0), ma = this.mainPivot.rotation.y, ms = this.mainsheet.geometry.attributes.position;
    this.clewBoard.position.set(0, A.FOOT_Y + 0.25, ch0 - 0.3);
    ms.setXYZ(0, clamp(Math.sin(ma) * ch0 * 0.45, -1.5, 1.5), H.deckY(6.6) + 0.1, 6.6); this.travCar.position.x = ms.getX(0);
    ms.setXYZ(1, Math.sin(ma) * ch0, A.FOOT_Y + 0.1, A.MAST_Z + 0.35 + Math.cos(ma) * ch0); ms.needsUpdate = true;
    this.jibAndTells(b, t, side, belly, luff, ph, null);
    // the jib's car follows the clew round its track
    const cw = A.CLEW.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position);
    const ang = clamp(Math.atan2(cw.x, cw.z - A.TACK.z), -0.55, 0.55), car = [Math.sin(ang) * 6.2, 0, A.TACK.z + 6.2 * Math.cos(ang)];
    car[1] = H.deckY(car[2]) + 0.1; this.jibCar.position.set(...car);
    const js = this.jibSheet.geometry.attributes.position; js.setXYZ(0, cw.x, cw.y, cw.z); js.setXYZ(1, car[0], car[1] + 0.05, car[2]); js.setXYZ(2, car[0], car[1], car[2]); js.needsUpdate = true;
    // the crew in their pods: the helms at their wheels, the windward trimmer working, the cyclors pedalling (harder
    // when the crew is busy trimming, tacking or flying)
    const k = this.crewDt(t), cad = 7 + (b.auto ? 4 : 0) + 2 * ride;
    for (const c of this.crew) {
      const wind = c.sx === side, fy = H.deckY(c.z0) - 0.88;
      if (c.i === 3) {
        this.pose(c, { x: c.sx * 1.55, y: fy + 0.62, z: c.z0 + 0.18, yaw: Math.PI / 2, stand: 0, knee: -1.4, lean: 0.75, reach: 1.35 }, k);
        c.cyc = (c.cyc || 0) + cad * (t - (c.ct ?? t)); c.ct = t;
        c.s.legs.forEach((l, j) => { const a = c.cyc + c.ph + j * Math.PI; l.hip.rotation.z = Math.PI / 2 * 0.72 + 0.32 * Math.sin(a); l.knee.rotation.z = -1.25 + 0.5 * Math.sin(a + 0.9); });
      } else {
        this.pose(c, { x: c.sx * 1.55, y: fy - 0.05, z: c.z0, yaw: c.i === 0 ? Math.PI / 2 + 0.35 : wind ? 0.9 : Math.PI / 2, stand: 1, knee: -0.4,
          lean: c.i === 1 && wind ? 0.35 + 0.1 * Math.sin(t * 3 + c.ph) : 0.2, reach: c.i === 0 ? 1.0 : wind ? 1.1 + 0.25 * Math.sin(t * 2.5 + c.ph) : 0.7 }, k);
      }
    }
    this.showLabel(b, showLabel);
  }
}
