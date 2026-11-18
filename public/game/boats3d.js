// Regatta: the other classes' yachts, built in code like the JPK 1050 (yacht.js) and dressed the same way —
// your colours, sail number, logo and flag, the sponsor's ad on the jib. Each is drawn at her real size (drawnL in
// classes.js): the sportboats — the J/70 (tiller, cuddy, retractable sprit and asymmetric kite, four hiking on the
// rail) and the RS21 (the same idea with a wide open cockpit, no cuddy, three aboard) — the Laser (ILCA) dinghy (one
// sail on an unstayed mast, one sailor hiking), the Optimist pram (an open shell, a spritsail, a child hiking), the Dragon (a classic three-man keelboat: long overhangs, a keel moulded into her, a varnished cabin and coaming, a spinnaker on a pole), the J Class (the 1930s America's Cup cutter: 39 m, a laid teak deck, a 45 m mast with a jib topsail and a staysail, twelve of her crew), the Bavaria 46 cruiser (a long coachroof, twin wheels, a furling
// genoa and a cruising gennaker, five aboard) and the AC75 foiling monohull (a scow-bowed hull flying on canting T-foil arms, a deck-sweeping double-skin main on a
// D-section mast, a self-tacking jib and eight in their pods). makeBoatView gives the page's class (classes.js CLS), or
// the one asked for (the fleet page, /fleet-view, has one of each afloat together).
// Local frame as yacht.js: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { BoatView, clearShrouds, turnMain, M, NONSKID, canvasTex, line, tube, cyl, hullMaterial, logoImage, drawContain, sailTexture, sailMesh, setSail, leechFlutter, clothState, flog, mainCloth, mainShape, jibShape, jibAlong, setKite, kiteGuard, hullSea, staySag, deckWash, lookAt, glance, sailor, drive, feel, holdExtension, labelSprite, THIGH, SHIN, LOOKS, jibStow, stowJib, stowTells, kiteHoist,
  fit, bar, winch, block, clutches, cleat, wheel, chainplate, display, purchase, mergeGroup, bowNumberMaterial, nameMaterial, deckFinish, mastGeo, spreaderGeo } from './yacht.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CLS } from './classes.js';
import { D2R, clamp, lerp, waveHeight } from './sim.js';

export function makeBoatView(o, cls = CLS) {
  if (cls.id === 'j70' || cls.id === 'rs21') return new SportView({ ...o, cls });
  if (cls.id === 'ac75') return new AC75View({ ...o, cls });
  if (cls.id === 'laser') return new LaserView({ ...o, cls });
  if (cls.id === 'optimist') return new OptimistView({ ...o, cls });
  if (cls.id === 'dragon') return new DragonView({ ...o, cls });
  if (cls.id === 'jclass') return new JClassView({ ...o, cls });
  if (cls.id === 'bavaria46') return new CruiserView({ ...o, cls });
  return new BoatView(o);
}

// ---------- a lofted hull ----------
// H: L (m), hb(t) half-beam, sheer(t), depth(t) of the canoe body under the waterline, n(t) the sections' squareness
// (a superellipse: 2 round … 3 boxy), with t = 0 at the transom and 1 at the stem. H.chine, if given, is a hard chine
// as the JPK 1050 has (blender/yacht.py hull_point): y(t) its height, w(t) how hard it is (1 hard … 0 the round
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

// her name on both quarters (yacht.js nameMaterial), W × W/8, centred z0 and y0
function nameDecal(hull, look, z0, y0, W) {
  if (!look.name) return [];
  const mat = nameMaterial(look);
  return [-1, 1].map((sd) => hull.decal(sd, z0, y0, W, W / 8, mat));
}

function logoDecal(hull, side, logo, z0, y0, W, H) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  logoImage(logo).then((img) => { if (img) { drawContain(c.getContext('2d'), img, 256, 128, 496, 248); tex.needsUpdate = true; } });
  return hull.decal(side, z0, y0, W, H, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.25, envMapIntensity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// a foiler's hull paint: one gloss colour, its underside (seen when she flies) a shade darker
function foilerMaterial(hull) {
  const m = new THREE.MeshPhysicalMaterial({ color: hull, roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1, side: THREE.DoubleSide }); // lacquered, as yacht.js's hullMaterial
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
// a rudder hung by its leading edge: span m down from y = 0, its chord chord(u) aft from the stock at each share u of
// the span, th thick as a share of it; both ends closed
function rudderGeo(span, chord, th, n = 10, rings = 14) {
  const sec = [];
  for (let i = 0; i <= n; i++) sec.push([(1 + Math.cos((Math.PI * i) / n)) / 2, 1]);
  for (let i = 1; i < n; i++) sec.push([(1 - Math.cos((Math.PI * i) / n)) / 2, -1]);
  const m = sec.length, pos = [], idx = [];
  for (let r = 0; r <= rings; r++) { const u = r / rings, c = chord(u); for (const [x, sd] of sec) pos.push(sd * naca(x) * th * c, -u * span, x * c); }
  for (let r = 0; r < rings; r++) for (let i = 0; i < m; i++) { const a = r * m + i, b = r * m + (i + 1) % m; idx.push(a, a + m, b, b, a + m, b + m); }
  for (const r of [0, rings]) { const ci = pos.length / 3, c = chord(r / rings); pos.push(0, -(r / rings) * span, c / 2); for (let i = 0; i < m; i++) r ? idx.push(ci, r * m + (i + 1) % m, r * m + i) : idx.push(ci, i, (i + 1) % m); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a wing lofted along a curving span: stations { x, y } (the span's line, across and up), c (the chord), s (the quarter
// chord's distance aft), each a foil section square to the span, th thick. part: the share of the chord it is — a
// wing's main element (0 … 0.72), its flap behind (0.74 … 1) — each its own foil section; deflect turns the part's
// trailing edge down (rad). side −1 builds it to port, the mirror of the starboard one.
function wingGeo(st, th, part = [0, 1], deflect = 0, side = 1, n = 10) {
  const sec = [];
  for (let i = 0; i <= n; i++) sec.push([(1 + Math.cos((Math.PI * i) / n)) / 2, 1]);
  for (let i = 1; i < n; i++) sec.push([(1 - Math.cos((Math.PI * i) / n)) / 2, -1]);
  const m = sec.length, pos = [], idx = [], k = part[1] - part[0];
  const up = (i) => { const a = st[Math.max(0, i - 1)], b = st[Math.min(st.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y); return [-(b.y - a.y) / l, (b.x - a.x) / l]; };
  const ring = (w, i) => {
    const [nx, ny] = up(i), cc = w.c * k;
    for (const [x, sd] of sec) {
      const h = sd * naca(x) * th * cc - x * cc * Math.sin(deflect); // up the section's normal
      pos.push(side * (w.x + nx * h), w.y + ny * h, w.s + (part[0] + x * k - 0.25) * w.c);
    }
  };
  st.forEach(ring);
  const tri = (a, b, c) => (side > 0 ? idx.push(a, b, c) : idx.push(a, c, b));
  for (let r = 0; r < st.length - 1; r++) for (let i = 0; i < m; i++) {
    const a = r * m + i, b = r * m + (i + 1) % m; tri(a, a + m, b); tri(b, a + m, b + m);
  }
  // the root and the tip closed flat, on vertices of their own
  [0, st.length - 1].forEach((j, r) => {
    const base = pos.length / 3; ring(st[j], j);
    const w = st[j], ci = pos.length / 3; pos.push(side * w.x, w.y, w.s + (part[0] + k / 2 - 0.25) * w.c);
    for (let i = 0; i < m; i++) r ? tri(ci, base + (i + 1) % m, base + i) : tri(ci, base + i, base + (i + 1) % m);
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
// (the winches, blocks, clutches, wheels and the like are yacht.js's fittings, shared with the JPK 1050)
// a cam cleat: two jaws on a base
const camGeo = () => mergeGeometries([new THREE.BoxGeometry(0.06, 0.012, 0.09), new THREE.BoxGeometry(0.014, 0.03, 0.06).translate(-0.018, 0.02, 0), new THREE.BoxGeometry(0.014, 0.03, 0.06).translate(0.018, 0.02, 0)]);
// the deck's moulded non-skid (in metres, as the club boat's, without her baked shade) and its smooth gelcoat
const SKID = new THREE.MeshStandardMaterial({ map: NONSKID, roughness: 0.85 });
const AC_DECK = new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.55, metalness: 0.15 }); // the AC75's: flat and dark
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
  // the cruiser's and the dinghy's own, shared by every boat of theirs: smoked windows, the buoy,
  // the dinghy's gunwale and strap
  pane: new THREE.MeshPhysicalMaterial({ color: '#10151b', roughness: 0.06, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
  buoy: new THREE.MeshStandardMaterial({ color: '#ef6a1f', roughness: 0.7 }),
  lip: new THREE.MeshStandardMaterial({ color: '#d4d6d3', roughness: 0.45 }),
  strap: new THREE.MeshStandardMaterial({ color: '#1d2a44', roughness: 0.8 }),
};

// the sail's layout for sailTexture: where the number and the flag sit on this class's main (the logo takes the cloth between them)
function rigOf({ span, chord, numAt, flagAt, mark, head, tack, clew, noAd = false }) {
  return { span, chord, numAt, numK: (2 * chord(numAt)) / span / 0.43, flagM: flagAt * span, mark,
    hd: head.clone().sub(tack), clew, noAd };
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
// paint more on a sail's cloth once it is drawn (sailTexture): draw(ctx, w, h) on its canvas, and on its back face's
// when it has one of its own (the jib's, for the ad; the main's, for the flag), x along the chord from the luff, y down from the head. The back
// face reads its canvas mirrored: X(u) gives where u falls on whichever canvas is being drawn
function onCloth(tex, draw) {
  for (const t of [tex, tex.back]) if (t && t.image) { const w = t.image.width, X = t === tex ? (u) => w * u : (u) => w * (1 - u); draw(t.image.getContext('2d'), w, t.image.height, X); t.needsUpdate = true; }
  return tex;
}
function windex(add, y, z) {
  const w = add(new THREE.Group(), 0, y, z); w.userData.flat = true;
  const rod = cyl(0.008, 0.008, 0.5, M.dark, 4); rod.position.set(0, 0.1, -0.1); rod.rotation.x = Math.PI / 2; w.add(rod);
  const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.dark); vane.rotation.x = -Math.PI / 2; vane.position.set(0, 0.1, -0.38); w.add(vane);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide })); tail.rotation.y = Math.PI / 2; tail.position.set(0, 0.12, 0.12); w.add(tail);
  return w;
}

// ---------- a dry lid ----------
// Where a boat's inside lies low (the Optimist's floor under the waterline, the Laser's cockpit 13 cm above it, which
// the drawn chop's crests overtop: the boats feel only the swell), the sea's surface would be drawn across it and she'd
// look swamped. A lid over the opening, unseen, writes only depth, after the boats are drawn (order 0) and before the
// sea (world.js draws the water after it), so the sea stops at her rim and her inside stays dry. No shadow, and not
// among the parts seen through the water (world.js underParts)
export const DRY_ORDER = 0.5;
const DRY = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
function dryLid(pos, idx) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const lid = new THREE.Mesh(g, DRY);
  lid.renderOrder = DRY_ORDER; lid.userData.flat = true; lid.userData.dry = true;
  return lid;
}
// a lid over a closed rim of [x, y, z] points, a fan from its middle
function rimLid(rim) {
  const n = rim.length, c = [0, 0, 0], pos = [], idx = [];
  for (const p of rim) { pos.push(...p); for (let k = 0; k < 3; k++) c[k] += p[k] / n; }
  pos.push(...c);
  for (let i = 0; i < n; i++) idx.push(n, i, (i + 1) % n);
  return dryLid(pos, idx);
}

// ---------- what both share with the JPK 1050 ----------
// A running backstay from the mast to the deck: q 1 set up straight, a0 to its quarter a1; q 0 let go, b0 down the front of
// the mast to b1, between the main and the headsails whatever their trim, hanging in a bow of bow metres
function setRunner(l, a0, a1, b0, b1, q, bow) {
  const p = l.geometry.attributes.position, n = p.count - 1, out = Math.sign(a1[0]);
  for (let k = 0; k <= n; k++) {
    const s = k / n, d = 4 * s * (1 - s) * (1 - q) * bow;
    p.setXYZ(k, lerp(lerp(b0[0], b1[0], s), lerp(a0[0], a1[0], s), q) + out * d * 0.4, lerp(lerp(b0[1], b1[1], s), lerp(a0[1], a1[1], s), q) - d, lerp(lerp(b0[2], b1[2], s), lerp(a0[2], a1[2], s), q));
  }
  p.needsUpdate = true;
}

class ClassView {
  start() {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); this.tilt.rotation.order = 'YXZ';
    this.root.add(this.tilt);
    this.drawnL = this.cls.drawnL;
    this.sailSide = 1;
    this.tells = [];
    this.rudders = []; // the JPK 1050's kick-up rudders turn on their own (yacht.js); bake(), shared with her, asks for them
    const T = this.tilt;
    return (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); T.add(o); return o; };
  }
  finish(label, labelY) {
    if (label) { this.label = labelSprite(label.color); this.labelText = label.text; this.label.position.set(0, labelY, 0); this.root.add(this.label); }
    const WH = this.washH; // her hull, where she can take water over the rail
    if (WH) { this.wash = deckWash(WH.hbAt, WH.deckY, WH.BOW + this.drawnL * 0.12, WH.STERN - 0.25, Math.min(0.45, this.cls.beam * 0.13)); this.tilt.add(this.wash); }
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.hullSea = hullSea(this, this.drawnL / 2);
    this.bake();
  }
  bake() { BoatView.prototype.bake.call(this); }
  wire(moving) { BoatView.prototype.wire.call(this, moving); }
  setDetail(on) { BoatView.prototype.setDetail.call(this, on); }
  setCrewNear(near, close) { BoatView.prototype.setCrewNear.call(this, near, close); }
  // afloat (or flying), heeled and pitched by the sea; side: the boom's side
  place(b, t, W, ride = 0) {
    const y = waveHeight(W, b.x, b.z, t), fx = Math.sin(b.h), fz = -Math.cos(b.h), L = this.drawnL * 0.4;
    const sea = 1 - 0.85 * ride; // flying, she skims over the waves
    const pitch = Math.atan2(waveHeight(W, b.x + fx * L, b.z + fz * L, t) - waveHeight(W, b.x - fx * L, b.z - fz * L, t), 2 * L) * sea;
    const RW = this.rollW ?? 1.5; // the sea's slope across her, taken over her beam (a wide, heavy hull rolls the less)
    const roll = Math.atan2(waveHeight(W, b.x - fz * RW, b.z + fx * RW, t) - waveHeight(W, b.x + fz * RW, b.z - fx * RW, t), 2 * RW) * 0.5 * sea;
    const side = b.boom || (b.twa >= 0 ? 1 : -1);
    this.sailSide = lerp(this.sailSide, side, Math.abs(b.twa) > 2.1 ? 0.2 : 0.06);
    // lift: a light dinghy floated higher than the rest
    this.root.position.set(b.x, (y * 0.85 - 0.05 + (this.lift || 0)) * sea + ride * this.flyY, b.z);
    this.root.rotation.y = -b.h;
    this.tilt.rotation.x = pitch - ride * 0.02; // flying: the bow a touch up
    // the sea's own roll, which the crew's bodies take out (pose); the heel alone, for the next frame's
    this.sway = this.sea ? clamp(this.sea.rz - (this.heelZ ?? 0), -0.35, 0.35) * 0.6 : 0;
    this.wash?.userData.set(this.sea?.rz ?? 0, t, b.v);
    this.tilt.rotation.z = (this.heelZ = side * b.heel * this.cls.heelShow * D2R) + roll;
    clothState(this, b, t); // how her sails set this frame (yacht.js): this.cloth
    return side;
  }
  // the jib on its stay, its sheets, the telltales and the masthead vane: as on the JPK 1050
  jibAndTells(b, t, side, belly, luff, ph, sheetTo) {
    // under the kite the jib is put away: furled on its stay, or (jibLowers: a hanked one) lowered to the foredeck,
    // where it lies along her middle
    const st = this.jibStowed = jibStow(b), lower = !!this.jibLowers;
    const ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.8 + 3 * D2R, (this.jibMax ?? 30) * D2R) * (lower ? 1 - st : 1);
    this.jibPivot.quaternion.setFromAxisAngle(this.jibAxis, -this.sailSide * ja);
    const head = this.HEAD.clone().sub(this.TACK), clew = this.CLEW, sc = this.cloth, ss = this.sailSide, k = this.jibBelly ?? 0.125, sag = staySag(head.length(), sc.aws);
    setSail(this.jib, (f, u, v) => {
      const sg = sag * Math.sin(Math.PI * f), lx = head.x * f - ss * sg, ly = head.y * f, lz = head.z * f + sg * 0.5;
      const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f);
      const len = Math.hypot(ex - lx, ey - ly, ez - lz), al = jibAlong(f, u);
      v.set(lerp(lx, ex, al) + jibShape(sc, f, u, len, ss, k, 1.3), lerp(ly, ey, al), lerp(lz, ez, al));
      stowJib(v, st, lower, lx, ly, lz);
    });
    stowTells(this.tells, st);
    if (sheetTo) {
      const cw = this.jibClew(), ls = cw.x < 0 ? -1 : 1;
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
  // the jib's clew in her frame, as it's set or put away
  jibClew() { return stowJib(this.CLEW.clone(), this.jibStowed || 0, !!this.jibLowers).applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position); }
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
  // a sailor eased towards where she should be: x, y, z, yaw (0 outboard … π inboard), lean, stand, knee, reach; and
  // posed (yacht.js drive), stepping if she moves, giving to the boat's motion, her hands on what want.hands holds
  pose(c, want, k) {
    for (const key of ['x', 'y', 'z', 'yaw', 'lean', 'stand', 'knee', 'reach']) c[key] += (want[key] - c[key]) * k;
    c.first = k === 1;
    drive(this, c, this.crewStep ?? 0, want.hands);
    const gl = glance(this.crewT ?? 0, c.i ?? 0);
    let lw = want.look ?? (c.yaw < 0.8 ? 1.0 : 1.7), lu = want.up ?? 0.1;
    if (gl === 1) { lw = 2.4; lu = 0.6; } else if (gl === 2) lw -= 0.9;
    if (c.s.head) lookAt(c, lw, lu, k);
  }
  crewDt(t) {
    const first = this.crewT === undefined, dt = clamp(t - (this.crewT ?? t), 0, 0.1); this.crewT = t; this.crewStep = dt;
    feel(this, dt);
    return first ? 1 : 1 - Math.exp(-dt * 2.2);
  }
  // when she last tacked or gybed (the boom's side changing), and how long since
  sinceTack(t, side) { if (this.tackSide !== side) { if (this.tackSide !== undefined) this.tackT = t; this.tackSide = side; } return t - (this.tackT ?? -99); }
  // two hands on a wheel's rim (R its radius; at: the wheel's position, in her frame; spin: the wheel itself, turning
  // about its z), at angles a (from its +x, sx mirroring them to her other side); the hands go some way round with it
  rim(at, spin, R, sx, a) {
    const turn = clamp(spin.rotation.z, -0.6, 0.6) * 0.7, p = at.position;
    return a.map((ai) => { const an = sx > 0 ? ai + turn : Math.PI - ai + turn; return new THREE.Vector3(p.x + R * Math.cos(an), p.y + R * Math.sin(an), p.z + 0.03); });
  }
  // a hand on the mast at height y, hauling hand over hand (a halyard, a reef): the two hands by turns
  haul(x, y, z, t) { return [0, 1].map((j) => new THREE.Vector3(x, y + j * 0.3 + 0.15 * Math.sin(t * 5 + j * Math.PI), z)); }
}

// ---------- the sportboats: the J/70 and the RS21 ----------
// RS: the RS21 — shorter and narrower, lower and flatter-sheered, a wide-open cockpit from the mast to the open
// transom with no cuddy and no lifelines, a slightly smaller rig and a lifting bulb keel. Each is worked out once, the
// first time a boat of hers is built.
const SPORT = {};
const PED_Z = 0.75; // the RS21's cockpit pedestal
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
  // the rigs to the class rules: the J/70's I 8.16 m above the sheer, her main's luff 7.97 m and foot 2.88 m; the
  // RS21's jib luff 6.8 m
  const MAST_Z = RS ? -0.95 : -1.05, MAST_FOOT = RS ? 0.66 : 0.78, MASTHEAD = RS ? 9.7 : 9.95, HOUNDS = RS ? 7.4 : 8.8, BOOM_Y = RS ? 1.32 : 1.75;
  const chord = RS ? (f) => lerp(2.9, 0.45, f) + 0.3 * Math.sin(Math.PI * f) : (f) => lerp(2.88, 0.42, f) + 0.32 * Math.sin(Math.PI * f);
  const TACK = new THREE.Vector3(0, hull.deckY(hull.BOW) + 0.06, hull.BOW + 0.06);
  const HEAD = new THREE.Vector3(0, HOUNDS - 0.2, MAST_Z - 0.07);
  const CLEW = new THREE.Vector3(0, 0.3, RS ? 2.15 : 2.3);
  const SPRIT = new THREE.Vector3(0, TACK.y + 0.04, hull.BOW - 1.5); // at the sprit's end
  const rig = rigOf({ span: MASTHEAD - 0.2 - BOOM_Y, chord, numAt: 0.62, flagAt: 0.9, mark: 0.85, head: HEAD, tack: TACK, clew: CLEW });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, HOUNDS, BOOM_Y, chord, TACK, HEAD, CLEW, SPRIT, rig };
};

class SportView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const RS = this.RS = cls.id === 'rs21', J = this.J = sportOf(RS);
    const add = this.start(), T = this.tilt, H = J.hull, MOD = RS ? RS21_MODEL : J70_MODEL;
    this.washH = H;
    this.flyY = 0;
    if (RS) this.lift = 0.15; // light and flat-bottomed, she rides high on the water
    const skid = deckFinish(look, SKID); // the player's deck: the non-skid, teak or the hull's colour
    if (MOD) {
      // the hull, deck, cockpit and (on the J/70) the cuddy, moulded (blender/sportboats.py), in a group of their own so
      // the boat's merging of her small parts (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMaterial(look.hull, look.stripe, look.bottom)], ['deck', skid], ['gel', M.gel]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
    // the deck, the open cockpit cut out of it from the cuddy (on the RS21, from just aft of the mast) to the open
    // transom, and its floor and sides
    const cz0 = RS ? -0.5 : -0.35, cx = RS ? 0.8 : 0.74, floorY = RS ? 0.26 : 0.3;
    // the cockpit: a moulded well, its walls sloping in to a non-skid floor and open to the transom, notched out of
    // the deck; the deck non-skid inside a smooth gelcoat border along the sheer
    if (!MOD) {
      const ck = H.tub(-cx, cz0, cx, H.STERN, 0.2, floorY, { slope: 0.09, crown: 0.03, openAft: true });
      add(new THREE.Mesh(H.deck([], 0.03, ck.outline), skid));
      const walls = add(new THREE.Mesh(ck.walls, GEL2)); walls.userData.detail = false;
      add(new THREE.Mesh(ck.floor, skid));
      T.add(H.border(0.08, GEL2, 0.03));
    }
    // the cuddy: a low, rounded coachroof forward of the cockpit, with a small hatch, and the mast through it
    const cud = new THREE.Shape(), a = 0.62, f = 0.4, za = -0.35, zf = -2.0, r = 0.18;
    cud.moveTo(-a + r, -za); cud.lineTo(a - r, -za); cud.quadraticCurveTo(a, -za, a, -za - r); cud.lineTo(f, -zf - r); cud.quadraticCurveTo(f, -zf, f - r, -zf);
    cud.lineTo(-f + r, -zf); cud.quadraticCurveTo(-f, -zf, -f, -zf - r); cud.lineTo(-a, -za - r); cud.quadraticCurveTo(-a, -za, -a + r, -za);
    const cg = new THREE.ExtrudeGeometry(cud, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 6 });
    cg.rotateX(-Math.PI / 2);
    const cudY = H.deckY(-1.2) - 0.02;
    if (!RS) {
      if (!MOD) add(new THREE.Mesh(cg, M.gel), 0, cudY, 0); // (moulded, in the model)
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.42), M.glass), 0, cudY + 0.21, -1.55);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.alu), 0, cudY + 0.205, -1.55);
    } else {
      // the RS21 has none: a flush foredeck with a hatch for the kite; the electric outboard's pod under the hull just
      // aft of the keel, and the pedestal in the middle of the cockpit that carries the mainsheet and the motor's controls
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.dark), 0, H.deckY(-1.9) + 0.03, -1.9);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10).rotateX(Math.PI / 2), M.dark), 0, -0.3, 0.75);
      add(cyl(0.02, 0.02, 0.22, M.dark, 6), 0, -0.17, 0.75);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.32), M.gel), 0, floorY + 0.2, PED_Z);
      fit(add, display(0.12, 0.09, 1), 0, floorY + 0.36, PED_Z + 0.17, 0, -0.6);
    }
    // foot chocks across the cockpit floor, and the sprit's housing at the stem with its launcher line
    for (const fz of [0.6, 1.3, 2.0]) add(new THREE.Mesh(new THREE.BoxGeometry(cx * 1.7, 0.03, 0.05), M.dark), 0, floorY + 0.035, fz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12).rotateX(Math.PI / 2), M.dark), 0, J.SPRIT.y, H.BOW + 0.03);
    // the keel: a tapered fin of a proper foil section with a lead torpedo on its tip, 1.45 m down on the J/70, 1.38 m
    // on the RS21 (hers lifts: its trunk's cap shows on the cockpit floor)
    const finSpan = RS ? 0.98 : 1.08;
    add(new THREE.Mesh(finGeo(finSpan, 0.58, 0.44, 0.11, 0.1), MAT.fin), 0, -0.2, -0.18);
    add(new THREE.Mesh(bulbGeo(RS ? 1.25 : 1.4, 0.16), MAT.lead), 0, -0.24 - finSpan, -0.02);
    if (RS) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.7), M.dark), 0, 0.29, -0.15);
    // the rudder, hung on the transom on its gudgeons, the tiller over the transom's top and its extension forward;
    // they swing with the helm
    const RY = H.deckY(H.STERN) + 0.04, RZ = H.STERN + 0.07;
    for (const y of [RY - 0.12, -0.02]) add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.08), M.steel), 0, y, H.STERN + 0.02); // the gudgeons
    this.wheel = add(new THREE.Group(), 0, RY, RZ);
    this.wheel.add(new THREE.Mesh(finGeo(RY + 0.95, 0.34, 0.24, 0.12, 0.05).translate(0, 0.02, 0.085), MAT.fin));
    this.wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.36), M.dark).translateY(-0.02).translateZ(0.08)); // the rudder head
    const tl = cyl(0.025, 0.035, 1.15, M.teak, 8); tl.rotation.x = Math.PI / 2 - 0.12; tl.position.set(0, 0.1, -0.55); this.wheel.add(tl);
    this.ext = new THREE.Group(); this.ext.position.set(0, 0.05, -1.1); this.ext.rotation.set(0.3, 0, -1.2); this.wheel.add(this.ext); // swung to the helm's hand (yacht.js holdExtension)
    { const e = cyl(0.012, 0.012, 0.9, M.dark, 6); e.position.y = 0.45; this.ext.add(e); }
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
      add(new THREE.Mesh(RS ? new THREE.BoxGeometry(0.4, 0.02, 0.03) : new THREE.BoxGeometry(0.03, 0.02, 0.6), M.alu), sx * 0.55, ty, RS ? -0.62 : -0.7); // the RS21's athwartships
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
    // the rig: a carbon mast through the cuddy, one set of swept spreaders; the backstay from the masthead to its
    // bridle, the two legs down to the transom's corners
    add(new THREE.Mesh(mastGeo(J.MASTHEAD - J.MAST_FOOT, 0.13, 0.085, 0.075, 0.05, (J.HOUNDS - 0.8 - J.MAST_FOOT) / (J.MASTHEAD - J.MAST_FOOT)), CARBON), 0, (J.MAST_FOOT + J.MASTHEAD) / 2, J.MAST_Z);
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
    for (const sx of [-1, 1]) { const s = add(new THREE.Mesh(spreaderGeo(0.66, 0.022, 0.013), M.carbon), sx * 0.31, SPR, J.MAST_Z + 0.12); s.rotation.z = -sx * Math.PI / 2; s.rotation.y = -sx * 0.35; }
    T.add(line([[0, J.HOUNDS, J.MAST_Z], [J.TACK.x, J.TACK.y, J.TACK.z]]));
    { const by = H.deckY(H.STERN) + 2.0, bz = H.STERN - 0.35, hx = H.hbAt(H.STERN) - 0.08;
      T.add(line([[0, J.MASTHEAD - 0.05, J.MAST_Z + 0.06], [0, by, bz]]));
      for (const sx of [-1, 1]) T.add(line([[0, by, bz], [sx * hx, H.deckY(H.STERN - 0.05) + 0.02, H.STERN - 0.05]])); }
    for (const sx of [-1, 1]) {
      T.add(line([[0, J.HOUNDS, J.MAST_Z], [sx * 0.62, SPR, J.MAST_Z + 0.22], [sx * (H.hbAt(J.MAST_Z + 0.4) - 0.05), H.deckY(J.MAST_Z + 0.4) + 0.02, J.MAST_Z + 0.4]]));
      T.add(line([[0, SPR - 0.1, J.MAST_Z], [sx * (H.hbAt(J.MAST_Z - 0.1) - 0.05), H.deckY(J.MAST_Z - 0.1) + 0.02, J.MAST_Z - 0.1]]));
    }
    // the mainsheet: a four-part tackle from the ratchet block (on the RS21, fixed on top of the pedestal) up to the
    // block under the boom
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    const rat = new THREE.Group(); rat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), M.dark));
    for (const [g, mm] of block(0.035)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.065; rat.add(o); }
    this.sheetFoot = RS ? [floorY + 0.44, PED_Z] : [floorY + 0.04, 0.9];
    this.travCar = add(mergeGroup(rat), 0, this.sheetFoot[0], this.sheetFoot[1]); // the mainsheet's ratchet block on its swivel base
    this.mainPivot = add(new THREE.Group(), 0, 0, J.MAST_Z);
    const BL = RS ? 3.0 : 3.0, boom = cyl(0.04, 0.032, BL, RS ? M.alu : CARBON, 10); // the RS21's boom aluminium boom.rotation.x = Math.PI / 2; boom.position.set(0, J.BOOM_Y, BL / 2 - 0.02); this.mainPivot.add(boom);
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
    { const z = H.STERN - 0.85; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.15, 1.0)) T.add(d); }
    // the jib sheets, the working one taut and the lazy one slack; the kite's sheet and its tack line to the sprit
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false;
    this.windex = windex(add, J.MASTHEAD + 0.02, J.MAST_Z);
    // the helm, the main trimmer, the jib and kite trimmer, and on the J/70 the bow, who goes forward for a hoist or a drop
    // (the RS21 races with three: classes.js)
    const m = crewMats(look);
    this.crew = (RS ? [2.1, 1.4, 0.7] : [2.25, 1.45, 0.75, 0.0]).map((z0, i) => {
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
    const sc = this.cloth, ss = this.sailSide, belly = -ss * (1 - sc.flogM * 0.85), span = J.rig.span;
    clearShrouds(this, sa, ss, { y: (f) => J.BOOM_Y + 0.06 + f * span, chord: J.chord, x: (f, u) => mainShape(sc, f, u, J.chord(f), ss, 0.11, 0.35).x });
    setSail(this.main, (f, u, v) => {
      const m = mainShape(sc, f, u, J.chord(f), ss, 0.11, 0.35);
      v.set(m.x, J.BOOM_Y + 0.06 + f * span, m.z);
      turnMain(this, f, v);
    });
    const ma = this.mainPivot.rotation.y, bz = 2.9;
    this.travCar.position.x = RS ? 0 : clamp(Math.sin(ma) * bz * 0.4 + Math.sign(Math.sin(ma)) * clamp((b.depower || 0) / 10, 0, 1) * 0.2, -0.6, 0.6);
    purchase(this.mainsheet, [this.travCar.position.x, this.sheetFoot[0] + 0.065, this.sheetFoot[1]], [Math.sin(ma) * bz, J.BOOM_Y - 0.085, J.MAST_Z + Math.cos(ma) * bz], 0.03);
    const ty = RS ? H.deckY(-0.7) + 0.07 : 0.95;
    this.jibAndTells(b, t, side, belly, luff, ph, (ls) => [[ls * 0.55, ty, -0.62], [ls * 0.82, H.deckY(0.2) + 0.12, 0.2]]);
    { const cw = this.jibClew(), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position;
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, cw.y - 0.25, cw.z + 0.15); lz.setXYZ(2, -ls * 0.55, ty, -0.62); lz.setXYZ(3, -ls * 0.82, H.deckY(0.2) + 0.12, 0.2); lz.needsUpdate = true; }
    // the crew: upwind on the windward side deck, the J/70's two forward hiking with their legs over the side (her
    // class allows two; the RS21's none, so hers sit in, feet in the cockpit); downwind sitting in, the trimmer to
    // leeward under the kite; the bow forward to the mast for a hoist or a drop
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      let hands = null;
      if (c.i === 0) { x = side * (H.hbAt(z) - 0.2); y = H.deckY(z) + 0.05; yaw = 1.2; lean = up ? 0.15 + 0.15 * hike : 0.1; knee = -1.2; reach = 0.9; hands = (c, M) => [holdExtension(this.ext, 0.9, c, M)]; }
      else if (c.i === 3 && bowBusy) { x = 0.1; z = J.MAST_Z + 0.45; y = H.deckY(z) + (RS ? 0.05 : 0.2); yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; hands = this.haul(0, y + 1.0, J.MAST_Z + 0.085, t); } // jumping the halyard at the mast
      else if (up && !RS && c.i >= 2) { x = side * (H.hbAt(z) - 0.1); y = H.deckY(z) + 0.07; yaw = 0; lean = 0.15 + 0.5 * hike; knee = -1.85; reach = 0.3; }
      else if (up) { x = side * (H.hbAt(z) - 0.22); y = H.deckY(z) + 0.05; yaw = Math.PI - 0.35; lean = 0.1; knee = -1.2; }
      else { const lee = c.i === 2 && b.kite; x = (lee ? -side : side) * (H.hbAt(z) - 0.25); y = H.deckY(z) + 0.05; yaw = lee ? 0.6 : Math.PI - 0.4; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach, hands }, k);
    }
    // the kite, off the sprit, hoisted nearly to the masthead
    const kf = kiteHoist(b), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)), S = J.SPRIT;
    this.kite.visible = this.kiteSheet.visible = kf > 0.02; this.sprit.visible = kf > 0.02 || !!b.kiteJob;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(3.6, 2.0, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [S.x, S.y + 0.06, S.z], hd = [0, lerp(S.y + 0.6, J.MASTHEAD - 0.3, kf), lerp(S.z, J.MAST_Z - 0.1, kf)], cl = [sd * out, lerp(S.y + 0.3, 1.7, kf), lerp(S.z + 0.5, 1.0, kf)];
      const lead = [sd * 0.9, H.deckY(2.6) + 0.08, 2.6], guard = kiteGuard(this); guard.clew(cl, lead);
      setKite(this, tk, hd, cl, sd, 0, 1.65, kfill, guard);
      const kp = this.kiteSheet.geometry.attributes.position;
      kp.setXYZ(0, cl[0], cl[1], cl[2]); kp.setXYZ(1, ...lead); kp.setXYZ(2, sd * 0.82, H.deckY(0.2) + 0.12, 0.2); kp.needsUpdate = true;
    }
    this.showLabel(b, showLabel);
  }
}

const CRANK = 0.26; // the J Class's grinders' cranks, the axle to the grip
// ---------- the Dragon ----------
// Johan Anker's 1929 three-man keelboat, to the International Dragon class rules: 8.90 m over all on 5.66 m of
// waterline, 1.96 m wide, 1.20 m draught and some 1,700 kg, a tonne of it the iron keel. Long overhangs, a spoon bow
// and a counter ending in a small raked transom; a low freeboard under a sweeping sheer; wine-glass sections, the
// keel moulded into the hull with the rudder hung on its raked trailing edge and the tiller over the aft deck. A
// small cabin forward, its varnished mahogany sides running on aft as the cockpit's coaming; the mast stepped through
// the foredeck just ahead of it. The rig to the rules: a keel-stepped alloy mast, the main's luff 9.2 m and foot 3.45 m
// between its bands, the forestay and shrouds 6.2 m up the luff, one set of spreaders, jumper struts and a diamond to
// the masthead, running backstays and a permanent backstay; an overlapping genoa (luff 6.5 m, foot 3.5 m) on a stay
// 1.88 m forward of the mast; a 24 m² symmetric spinnaker set from a 2.24 m pole. Three crew, hiking on the side decks.
// Her lines are blender/dragon.py's (the same functions there); she is moulded there too (dragon.glb).
// a smooth curve through [x, y] points, x rising: Catmull-Rom tangents on a cubic Hermite (blender/dragon.py spline)
function spline(P) {
  const n = P.length, m = P.map((_, i) => (P[Math.min(n - 1, i + 1)][1] - P[Math.max(0, i - 1)][1]) / (P[Math.min(n - 1, i + 1)][0] - P[Math.max(0, i - 1)][0]));
  return (x) => {
    if (x <= P[0][0]) return P[0][1];
    if (x >= P[n - 1][0]) return P[n - 1][1];
    let i = 0; while (P[i + 1][0] < x) i++;
    const h = P[i + 1][0] - P[i][0], u = (x - P[i][0]) / h;
    return (2 * u ** 3 - 3 * u * u + 1) * P[i][1] + (u ** 3 - 2 * u * u + u) * h * m[i] + (-2 * u ** 3 + 3 * u * u) * P[i + 1][1] + (u ** 3 - u * u) * h * m[i + 1];
  };
}
const DZ = (() => {
  const L = 8.9, B = 1.96;
  const YC = spline([[0, 0.32], [0.1, 0.18], [0.155, 0.065], [0.2, -0.035], [0.243, -0.13], [0.3, -0.2], [0.4, -0.27], [0.5, -0.3], [0.6, -0.29], [0.687, -0.25], [0.74, -0.16], [0.814, 0.0], [0.915, 0.23], [0.968, 0.45], [1.0, 0.725]]);
  const hull = hullOf({
    L, flare: 0.04,
    hb: (t) => (B / 2) * (t < 0.44 ? 0.27 + 0.73 * Math.sin((t / 0.44) * Math.PI / 2) ** 0.9 : Math.max(0, Math.cos(Math.min(1, (t - 0.44) / 0.56) * Math.PI / 2)) ** 0.75),
    sheer: (t) => (t < 0.35 ? 0.545 + 0.015 * ((0.35 - t) / 0.35) ** 2 : 0.545 + 0.18 * ((t - 0.35) / 0.65) ** 2),
    depth: (t) => -YC(t),
    n: (t) => lerp(2.3, 1.9, clamp((t - 0.3) / 0.7, 0, 1)),
  });
  // the deck's camber, 9.5 mm in every 305 mm of her width: its height at (x, z)
  const deckAt = (x, z) => { const h = Math.max(hull.hbAt(z), 0.05); return hull.deckY(z) + 0.0311 * 2 * h * (1 - Math.min(1, Math.abs(x) / h) ** 2); };
  // the cabin, the cockpit and the band of mahogany round them (blender/dragon.py band_half, band_h)
  const CAB_F = -0.82, CAB_A = 0.45, CK_A = 2.55, FLOOR = 0.12, WOOD_T = 0.024;
  const bandHalf = (z) => {
    if (z < CAB_F || z > CK_A) return 0;
    const n = clamp((z - CAB_F) / 0.3, 0, 1), t = clamp((CK_A - z) / 0.32, 0, 1);
    return lerp(0.36, 0.64, smooth(CAB_F, 0.35, z) ** 0.8) * Math.sqrt(Math.max(0, 1 - (1 - n) ** 2)) * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
  };
  const bandH = (z) => lerp(0.2, 0.13, smooth(CAB_A - 0.05, CAB_A + 0.45, z));
  const coamY = (z) => deckAt(bandHalf(z), z) + bandH(z); // the band's top
  const roofY = (x, z) => coamY(z) + 0.03 + 0.1 * (1 - Math.min(1, (x / Math.max(bandHalf(z), 0.05)) ** 2)); // the cabin top
  // the keel's trailing edge, raked 43° along the rudder's stock: from its foot's aft corner (z 1.25, 1.22 m down) aft
  // and up to the counter
  const TE0 = 1.25, KEEL_Y = -1.22, STOCK = new THREE.Vector3(0, 1.09, 1.04).normalize();
  // the rig (the rules' measurements from the mast's lower band, 0.8 m above the deck, where the boom is)
  // the mast 5.35 m aft of the stem, at the cabin's front, as the class's plan and photographs of her have it
  const MAST_Z = -0.9, BAND = deckAt(0, MAST_Z) + 0.8;
  const BOOM_Y = BAND + 0.03, MASTHEAD = BAND + 9.35, HOUNDS = BAND + 6.15, SPR = BAND + 3.4, JUMP = BAND + 6.3, KITE_H = BAND + 6.25, BL = 3.5;
  const chord = (f) => lerp(3.45, 0.12, f) + 0.275 * Math.sin(Math.PI * f); // the rules' widths: 2.06 m half way up, 1.15 m three quarters
  const STAY_Z = MAST_Z - 1.9; // the forestay's foot
  const TACK = new THREE.Vector3(0, deckAt(0, STAY_Z) + 0.05, STAY_Z);
  const top = new THREE.Vector3(0, HOUNDS, MAST_Z - 0.06), HEAD = TACK.clone().lerp(top, 6.45 / top.distanceTo(TACK)); // a 6.5 m luff
  const CLEW = new THREE.Vector3(0, 0.22, 3.42); // from the tack: the foot 3.5 m, the clew aft of the mast by the cabin's end
  const rig = rigOf({ span: MASTHEAD - 0.15 - BOOM_Y, chord, numAt: 0.6, flagAt: 0.9, mark: 0.8, head: HEAD, tack: TACK, clew: CLEW });
  return { L, B, hull, deckAt, CAB_F, CAB_A, CK_A, FLOOR, WOOD_T, bandHalf, bandH, coamY, roofY, TE0, KEEL_Y, STOCK, MAST_Z, BAND, BOOM_Y, MASTHEAD, HOUNDS, SPR, JUMP, KITE_H, BL, chord, STAY_Z, TACK, HEAD, CLEW, rig,
    SHEET_Z: MAST_Z + 2.3, TRAV_Z: MAST_Z + 2.3, POLE: 2.24, WINCH_Z: 1.4, TRACK: [0.15, 1.05], CAR_Z: 0.68, RUNNER_Z: 3.85 };
})();
// varnished mahogany: a warm grain under a deep gloss, laid along the length (the plan's v, as boats3d.js lays its UVs)
const MAHOG = canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#6b2c12'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const u = Math.random() * w, a = 0.05 + Math.random() * 0.12;
    x.strokeStyle = Math.random() < 0.5 ? `rgba(40,12,3,${a})` : `rgba(160,80,40,${a})`; x.lineWidth = 0.6 + Math.random() * 1.8;
    x.beginPath(); x.moveTo(u, 0); for (let y = 0; y <= h; y += 16) x.lineTo(u + Math.sin(y * 0.03 + i) * 2.5, y); x.stroke();
  }
});
MAT.varnish = new THREE.MeshPhysicalMaterial({ map: MAHOG, color: '#ffffff', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 });
MAT.cabin = new THREE.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.55 }); // the cabin top's painted canvas
const ALLOY = new THREE.MeshStandardMaterial({ color: '#c3c7cb', roughness: 0.35, metalness: 0.6 }); // the anodised spars

class DragonView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const D = DZ, add = this.start(), T = this.tilt, H = D.hull, MOD = DRAGON_MODEL, dk = D.deckAt;
    this.washH = H;
    this.flyY = 0;
    const skid = deckFinish(look, SKID);
    if (MOD) {
      // the hull and keel, deck, cabin, coaming and cockpit, moulded (blender/dragon.py), in a group of their own so the
      // boat's merging of her small parts (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMaterial(look.hull, look.stripe, look.bottom)], ['deck', skid], ['wood', MAT.varnish], ['gel', MAT.cabin], ['teak', M.teak]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else {
      // from the lines in code: the canoe body, the keel as a fin under it, the deck with the cockpit sunk into it and
      // the cabin a box over the deck
      add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
      add(new THREE.Mesh(finGeo(0.95, 2.4, 1.7, 0.06, 0.25), hullMaterial(look.hull, look.stripe, look.bottom)), 0, -0.25, 0.45);
      const ck = H.tub(-0.6, D.CAB_A, 0.6, D.CK_A, 0.28, D.FLOOR, { slope: 0.02, crown: 0.06 });
      add(new THREE.Mesh(H.deck([ck.outline], 0.06), skid));
      add(new THREE.Mesh(ck.walls, GEL2)); add(new THREE.Mesh(ck.floor, M.teak));
      add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, D.CAB_A - D.CAB_F), MAT.varnish), 0, dk(0, -0.3) + 0.12, (D.CAB_A + D.CAB_F) / 2);
    }
    const coam = (z) => D.coamY(z), bh = D.bandHalf;
    // the toe rails, mahogany, along the sheer
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.012 + (i / 24) * 0.975, z = H.zAt(t), x = H.hbAt(z) - 0.025; pts.push([sx * x, dk(x, z) + 0.012, z]); }
      T.add(tube(pts, 0.014, MAT.varnish));
    }
    // the cabin's aft face: the companionway and its sill, the compass on its bulkhead to either side; the hatch
    // forward of the mast (the spinnaker's chute under it), the forestay's fitting and the bow fairlead
    const ca = D.CAB_A + 0.002;
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), M.dark), 0, D.FLOOR + 0.48, ca).rotation.y = Math.PI;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.03), MAT.varnish), 0, D.FLOOR + 0.27, ca + 0.012);
    for (const sx of [-1, 1]) fit(add, display(0.13, 0.11, 3), sx * 0.38, coam(D.CAB_A) - 0.05, ca + 0.02);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.5), M.gel), 0, dk(0, -1.85) + 0.01, -1.85);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.4), M.glass), 0, dk(0, -1.85) + 0.03, -1.85);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.12), M.steel), 0, D.TACK.y - 0.02, D.STAY_Z);
    fit(add, cleat(0.16), 0, dk(0, H.BOW + 0.55), H.BOW + 0.55);
    // the keel and the rudder: hung on the keel's trailing edge, 1.45 m along its raked stock, a crescent as the class's
    // plan draws it (narrow where it leaves the counter, 0.48 m across a little below half way, fining into the keel's
    // foot), the stock up through the counter to the tiller over the aft deck and its extension forward
    const sy = -0.12, sz = D.TE0 + (sy - D.KEEL_Y) * (D.STOCK.z / D.STOCK.y); // where the stock leaves the hull
    const deckS = (() => { let y = sy, z = sz; for (let i = 0; i < 40 && y < dk(0, z); i++) { y += D.STOCK.y * 0.025; z += D.STOCK.z * 0.025; } return [y, z]; })();
    this.wheel = add(new THREE.Group(), 0, deckS[0], deckS[1]);
    this.rudderAxis = D.STOCK;
    const blade = new THREE.Group(); blade.position.set(0, sy - deckS[0], sz - deckS[1]); blade.rotation.x = Math.atan2(D.STOCK.z, D.STOCK.y);
    blade.add(new THREE.Mesh(rudderGeo(1.45, (u) => 0.06 + 0.42 * Math.sin(Math.PI * u ** 1.1) ** 0.75, 0.1).translate(0, 0, 0.03), MAT.fin));
    this.wheel.add(blade);
    this.wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), M.steel)); // the stock's head on deck
    // the tiller rises from the stock's head over the coaming's aft end, its extension off its end
    const TA = 0.32, TL = 1.25, tl = cyl(0.022, 0.034, TL, MAT.varnish, 8); tl.rotation.x = Math.PI / 2 + TA; tl.position.set(0, 0.07 + (TL / 2) * Math.sin(TA), -(TL / 2) * Math.cos(TA)); this.wheel.add(tl);
    this.ext = new THREE.Group(); this.ext.position.set(0, 0.07 + TL * Math.sin(TA), -TL * Math.cos(TA)); this.ext.rotation.set(0.3, 0, -1.2); this.wheel.add(this.ext); // swung to the helm's hand
    { const e = cyl(0.011, 0.011, 0.85, M.dark, 6); e.position.y = 0.425; this.ext.add(e); }
    // the genoa's tracks on the side decks with their cars and blocks, the sheet winches abreast of the cockpit and the
    // cam cleats on the coaming; the shrouds' chainplates 0.72 m out from the centreline, the runners' on the quarters
    for (const sx of [-1, 1]) {
      const tx = sx * 0.82, [t0, t1] = D.TRACK;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, t1 - t0), M.alu), tx, dk(0.82, (t0 + t1) / 2) + 0.01, (t0 + t1) / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), M.dark), tx, dk(0.82, D.CAR_Z) + 0.025, D.CAR_Z);
      fit(add, block(0.026), tx, dk(0.82, D.CAR_Z) + 0.065, D.CAR_Z);
      fit(add, winch(0.045, 0.11), sx * 0.86, dk(0.86, D.WINCH_Z) + 0.005, D.WINCH_Z);
      for (const z of [1.45, 1.75]) { const c = add(new THREE.Mesh(camGeo(), M.dark), sx * (bh(z) + 0.005), coam(z) + 0.002, z); c.rotation.y = sx * 0.2; }
      const foot = (z, x = 0.74) => [sx * x, dk(x, z) + 0.02, z];
      fit(add, chainplate(foot(D.MAST_Z + 0.08), [sx * 0.55, D.SPR, D.MAST_Z], 0.22, 0.011));
      fit(add, chainplate(foot(D.MAST_Z + 0.42), [0, D.SPR - 0.1, D.MAST_Z], 0.2, 0.01));
      fit(add, chainplate(foot(D.RUNNER_Z, H.hbAt(D.RUNNER_Z) - 0.08), [0, D.HOUNDS, D.MAST_Z], 0.16, 0.01));
    }
    // the mast through the deck, its collar and wedges; the gooseneck at the lower band, the halyards down its front
    // and back, the spreaders, the jumper struts and their diamond, the masthead's crane for the backstay
    const MF = dk(0, D.MAST_Z);
    add(new THREE.Mesh(mastGeo(D.MASTHEAD - MF + 0.05, 0.11, 0.072, 0.065, 0.048, (D.BAND + 6.7 - MF) / (D.MASTHEAD - MF)), ALLOY), 0, (MF + D.MASTHEAD) / 2, D.MAST_Z);
    add(cyl(0.085, 0.1, 0.06, M.dark, 14), 0, MF + 0.03, D.MAST_Z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.1), M.alu), 0, D.BOOM_Y, D.MAST_Z + 0.06);
    for (const dx of [-0.025, 0.025]) T.add(line([[dx, D.HOUNDS, D.MAST_Z - 0.06], [dx, MF + 0.25, D.MAST_Z - 0.065]]));
    T.add(line([[0, D.MASTHEAD - 0.1, D.MAST_Z + 0.06], [0, D.BOOM_Y + 0.3, D.MAST_Z + 0.06]]));
    for (const sx of [-1, 1]) {
      const s = add(new THREE.Mesh(spreaderGeo(0.5, 0.02, 0.012), ALLOY), sx * 0.27, D.SPR, D.MAST_Z + 0.01); s.rotation.z = -sx * Math.PI / 2;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.dark), sx * 0.53, D.SPR, D.MAST_Z);
      // the jumper struts: out and forward from the mast, the diamond wire over their ends from near the masthead down
      // to the mast under the spreaders
      const jt = [sx * 0.24, D.JUMP, D.MAST_Z - 0.26];
      T.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5).rotateX(Math.PI / 2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(sx * 0.24, 0, -0.26).normalize())).translate(sx * 0.12, D.JUMP, D.MAST_Z - 0.13), ALLOY));
      T.add(line([[0, D.BAND + 9.0, D.MAST_Z - 0.03], jt, [0, D.BAND + 3.7, D.MAST_Z - 0.04]]));
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), M.alu), 0, D.MASTHEAD - 0.02, D.MAST_Z + 0.1);
    // the standing rigging: the forestay; the shrouds over the spreaders' ends and the lowers; the permanent backstay
    // from the masthead's crane to the transom; the running backstays, the windward one set up hard, the lee one let
    // go forward to the shrouds (drawn each frame)
    T.add(line([[0, D.HOUNDS, D.MAST_Z - 0.05], [D.TACK.x, D.TACK.y, D.TACK.z]]));
    for (const sx of [-1, 1]) {
      T.add(line([[sx * 0.04, D.HOUNDS, D.MAST_Z], [sx * 0.53, D.SPR, D.MAST_Z], [sx * 0.74, dk(0.74, D.MAST_Z + 0.08) + 0.2, D.MAST_Z + 0.08]]));
      T.add(line([[sx * 0.04, D.SPR - 0.12, D.MAST_Z], [sx * 0.74, dk(0.74, D.MAST_Z + 0.42) + 0.18, D.MAST_Z + 0.42]]));
    }
    { const z = H.STERN - 0.12; T.add(line([[0, D.MASTHEAD - 0.02, D.MAST_Z + 0.16], [0, dk(0, z) + 0.05, z]])); }
    this.runners = [-1, 1].map((sx) => { const l = line(Array.from({ length: 9 }, () => [0, 0, 0])); l.frustumCulled = false; l.userData.sx = sx; T.add(l); return l; });
    // the boom: alloy, its gooseneck at the lower band; the kicker's tackle from the mast's foot, the outhaul's end
    // fitting, and the mainsheet's block under it 2.3 m aft of the mast, to the traveller across the cockpit floor
    this.mainPivot = add(new THREE.Group(), 0, 0, D.MAST_Z);
    const boom = cyl(0.045, 0.04, D.BL, ALLOY, 10); boom.rotation.x = Math.PI / 2; boom.position.set(0, D.BOOM_Y, D.BL / 2 - 0.02); this.mainPivot.add(boom);
    const gear = new THREE.Group(), VA = [0, MF + 0.25, 0.08], VB = [0, D.BOOM_Y - 0.05, 0.85], VM = VA.map((v, i) => lerp(v, VB[i], 0.45));
    gear.add(bar(VA, VM, 0.011, 0.011, M.alu), bar(VM, VB, 0.018, 0.016, ALLOY));
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.1), M.alu); end.position.set(0, D.BOOM_Y, D.BL - 0.05); gear.add(end);
    for (const [g, mm] of block(0.032)) { const o = new THREE.Mesh(g, mm); o.position.set(0, D.BOOM_Y - 0.08, D.SHEET_Z - D.MAST_Z); gear.add(o); }
    this.mainPivot.add(mergeGroup(gear));
    this.main = sailMesh(20, 10, sailTexture('main', look, D.rig), look.laminate, 'main'); this.mainPivot.add(this.main);
    const TRY = D.FLOOR + 0.12;
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.05), M.alu), 0, TRY, D.TRAV_Z);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), M.dark), sx * 0.5, TRY - 0.06, D.TRAV_Z);
    const car = new THREE.Group(); car.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.07), M.dark));
    for (const [g, mm] of block(0.032)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.06; car.add(o); }
    this.travCar = add(mergeGroup(car), 0, TRY + 0.02, D.TRAV_Z);
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    // the genoa on the forestay, its sheets to the cars and on to the winches
    this.TACK = D.TACK; this.HEAD = D.HEAD; this.CLEW = D.CLEW; this.jibMax = 24; this.jibBelly = 0.12; this.jibLowers = true; // hanked on: down to the foredeck under the spinnaker
    this.jibPivot = add(new THREE.Group(), D.TACK.x, D.TACK.y, D.TACK.z);
    this.jibAxis = D.HEAD.clone().sub(D.TACK).normalize();
    this.jib = sailMesh(16, 8, sailTexture('jib', look, D.rig), look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.makeTells(player);
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    // the spinnaker, its pole off the mast to windward, the guy to the pole's end and the sheet to the lee quarter
    this.kite = sailMesh(16, 10, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);
    this.pole = add(cyl(0.022, 0.022, D.POLE, ALLOY, 8)); this.pole.visible = false;
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.guy = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    T.add(this.jibSheet, this.lazySheet, this.kiteSheet, this.guy);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet, this.guy]) l.frustumCulled = false;
    this.windex = windex(add, D.MASTHEAD + 0.02, D.MAST_Z);
    // her number on both bows, the logo forward of the cabin, the name on the quarters
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, -2.0, H.deckY(-2.0) - 0.17, 0.72, 0.24));
    { const z = H.BOW + 1.15; T.add(...bowNumber(H, look, z, H.deckY(z) - 0.12, 0.56, 0.15)); }
    { const z = H.STERN - 1.25; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.13, 0.95)) T.add(d); }
    // her cockpit's floorboards 14 cm above the water, which the chop's crests overtop: a dry lid over it at the
    // coaming's top
    { const rim = []; for (let i = 0; i <= 24; i++) { const z = lerp(D.CAB_A, D.CK_A - 0.001, i / 24); rim.push([bh(z) - D.WOOD_T, coam(z) - 0.01, z]); }
      for (let i = 24; i >= 0; i--) { const z = lerp(D.CAB_A, D.CK_A - 0.001, i / 24); rim.push([-(bh(z) - D.WOOD_T), coam(z) - 0.01, z]); }
      add(rimLid(rim)); }
    // three: the helm, the middle man on the main and the runners, and the bow on the genoa and the spinnaker
    const m = crewMats(look);
    this.crew = [2.15, 1.45, 0.8].map((z0, i) => {
      const s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[i], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, x: 0, y: dk(0.8, z0), z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 };
    });
    this.finish(label, 13);
  }
  update(b, t, W, showLabel) {
    const D = DZ, H = D.hull, dk = D.deckAt, side = this.place(b, t, W);
    this.wheel.quaternion.setFromAxisAngle(this.rudderAxis, b.rudder * 0.5);
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    const sc = this.cloth, ss = this.sailSide, belly = -ss * (1 - sc.flogM * 0.85), span = D.rig.span;
    clearShrouds(this, sa, ss, { y: (f) => D.BOOM_Y + 0.06 + f * span, chord: D.chord, x: (f, u) => mainShape(sc, f, u, D.chord(f), ss, 0.11, 0.35).x });
    setSail(this.main, (f, u, v) => {
      const m = mainShape(sc, f, u, D.chord(f), ss, 0.11, 0.35);
      v.set(m.x, D.BOOM_Y + 0.06 + f * span, m.z);
      turnMain(this, f, v);
    });
    // the mainsheet from the boom's block down to the car, which the traveller lets down to leeward
    const ma = this.mainPivot.rotation.y, bz = D.SHEET_Z - D.MAST_Z, TRY = D.FLOOR + 0.12;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.5 + Math.sign(Math.sin(ma)) * clamp((b.depower || 0) / 10, 0, 1) * 0.15, -0.46, 0.46);
    purchase(this.mainsheet, [this.travCar.position.x, TRY + 0.08, D.TRAV_Z], [Math.sin(ma) * bz, D.BOOM_Y - 0.08, D.MAST_Z + Math.cos(ma) * bz], 0.03);
    // the genoa: its sheet through the car on the lee track to the winch
    const car = (ls) => [[ls * 0.82, dk(0.82, D.CAR_Z) + 0.07, D.CAR_Z], [ls * 0.86, dk(0.86, D.WINCH_Z) + 0.1, D.WINCH_Z]];
    this.jibAndTells(b, t, side, belly, luff, ph, car);
    { const cw = this.jibClew(), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position, [a, w] = car(-ls);
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, D.roofY(0, 0.2) + 0.02, 0.25); lz.setXYZ(2, ...a); lz.setXYZ(3, ...w); lz.needsUpdate = true; }
    // the runners: the windward one set up from the hounds to its quarter, almost at the transom, the lee one let go,
    // slack forward and tied off at the mast; they change over as the boom comes across
    if (this.detailOn !== false) for (const r of this.runners) {
      const sx = r.userData.sx, rz = D.RUNNER_Z, x = sx * (H.hbAt(rz) - 0.08);
      setRunner(r, [sx * 0.04, D.HOUNDS, D.MAST_Z + 0.04], [x, dk(Math.abs(x), rz) + 0.12, rz], [sx * 0.02, D.HOUNDS, D.MAST_Z - 0.03], [sx * 0.1, D.BOOM_Y - 0.1, D.MAST_Z - 0.08], smooth(-0.3, 0.3, sx * ss), 0.05);
    }
    // the crew: upwind on the windward side deck facing in, their feet under the straps in the cockpit, leaning back out
    // over the water as it blows; downwind sitting in, the middle man to leeward on the spinnaker's sheet; the bow at the
    // mast for a hoist, a drop or a gybe of the pole
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      let hands = null;
      if (c.i === 0) { x = side * (H.hbAt(z) - 0.2); y = dk(H.hbAt(z) - 0.2, z) + 0.05; yaw = 1.2; lean = up ? 0.15 + 0.2 * hike : 0.1; knee = -1.2; reach = 0.9; hands = (c, M) => [holdExtension(this.ext, 0.85, c, M)]; }
      else if (c.i === 2 && bowBusy) { x = 0.15; z = D.MAST_Z + 0.5; y = dk(0.15, z) + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; hands = this.haul(0, y + 1.0, D.MAST_Z + 0.075, t); } // the spinnaker's halyard at the mast
      else if (up) { x = side * (H.hbAt(z) - 0.14); y = dk(H.hbAt(z) - 0.14, z) + 0.05; yaw = Math.PI - 0.2; lean = -(0.1 + 0.55 * hike); knee = -1.45; reach = 0.4; }
      else { const lee = c.i === 1 && b.kite; x = (lee ? -side : side) * (H.hbAt(z) - 0.25); y = dk(H.hbAt(z) - 0.25, z) + 0.05; yaw = lee ? 0.6 : Math.PI - 0.4; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach, hands }, k);
    }
    // the spinnaker: its tack at the pole's end, the pole squared aft to the wind as she bears away; its head at the
    // halyard's sheave, its clew out to leeward
    const kf = kiteHoist(b), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0));
    this.kite.visible = this.kiteSheet.visible = this.guy.visible = this.pole.visible = kf > 0.02;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, sq = clamp((a - 80) / 100, 0, 1), pa = lerp(0.35, 1.45, sq) * lerp(0.4, 1, kf), wd = this.sailSide, sd = -wd;
      const P0 = [0, dk(0, D.MAST_Z) + 1.45, D.MAST_Z - 0.06], PE = [P0[0] + wd * Math.sin(pa) * D.POLE, P0[1] + 0.15, P0[2] - Math.cos(pa) * D.POLE];
      this.pole.position.set((P0[0] + PE[0]) / 2, (P0[1] + PE[1]) / 2, (P0[2] + PE[2]) / 2);
      this.pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(PE[0] - P0[0], PE[1] - P0[1], PE[2] - P0[2]).normalize());
      const out = lerp(2.4, 1.6, sq) * lerp(0.2, 1, kfill);
      const tk = [lerp(0, PE[0], kf), lerp(D.TACK.y + 0.2, PE[1], kf), lerp(D.TACK.z, PE[2], kf)], hd = [0, lerp(D.TACK.y + 0.8, D.KITE_H, kf), lerp(D.TACK.z, D.MAST_Z - 0.12, kf)];
      const cl = [sd * out, lerp(D.TACK.y + 0.5, 1.4, kf), lerp(D.TACK.z + 0.5, lerp(-0.6, 0.2, sq), kf)];
      const qz = H.STERN - 0.5, qx = (s) => s * (H.hbAt(qz) - 0.06), lead = [qx(sd), dk(Math.abs(qx(sd)), qz) + 0.06, qz], guard = kiteGuard(this); guard.clew(cl, lead);
      setKite(this, tk, hd, cl, sd, wd, 1.45, kfill, guard); // the luffs curving out to its shoulders, 5 m across
      const kp = this.kiteSheet.geometry.attributes.position, gp = this.guy.geometry.attributes.position;
      kp.setXYZ(0, ...cl); kp.setXYZ(1, ...lead); kp.setXYZ(2, sd * 0.86, dk(0.86, D.WINCH_Z) + 0.1, D.WINCH_Z); kp.needsUpdate = true;
      gp.setXYZ(0, ...PE); gp.setXYZ(1, wd * (H.hbAt(0.3) - 0.03), dk(H.hbAt(0.3) - 0.03, 0.3) + 0.05, 0.3); gp.setXYZ(2, wd * 0.86, dk(0.86, D.WINCH_Z) + 0.1, D.WINCH_Z); gp.needsUpdate = true;
    }
    this.showLabel(b, showLabel);
  }
}

// ---------- the J Class ----------
// A generic America's Cup J of the 1930s (the Universal Rule's 76-foot rating), between Velsheda, Endeavour and Ranger:
// 39.3 m over all on 27.0 m of waterline, 6.55 m wide, drawing 4.55 m, some 175 tonnes, near half of it the lead at
// her keel's foot. Long, nearly equal overhangs, a spoon bow and a counter ending in a small raked transom, a low
// freeboard under a long sheer; a deep wine-glass hull with her long keel moulded into it, the rudder hung on its raked
// after edge. A laid teak deck inside a low bulwark under a varnished cap rail: a glazed skylight forward of the mast, the doghouse aft of it with
// its windows, the grinders' pedestals and the primary winches abreast of it, and aft the helm's well round a wheel
// 1.9 m across. The rig a cutter's, as the boats raced the Cup: a 45.5 m alloy mast stepped 43% of her length from the
// bow with four sets of spreaders, a jib topsail (yankee) to the masthead from the stem head, high in the clew, and a
// staysail on an inner forestay, the runners and checkstays set up to windward and a permanent backstay to the
// transom; the main on an 18.2 m boom. Some 860 m² upwind (the main 440, the yankee 280, the staysail 140), a
// symmetric spinnaker from a 15 m pole downwind. Sixteen of her thirty crew drawn: the helm, the tactician, the
// mainsheet trimmer, two grinders and two trimmers, the pit, the mast, the bow, the navigator, the runners' trimmer and four on the rail.
// Her lines are blender/jclass.py's (the same functions there); she is moulded there too (jclass.glb).
const JZ = (() => {
  const L = 39.3, B = 6.55, TMAX = 0.45, LOW = 0.38;
  const YC = spline([[0, 0.95], [0.06, 0.6], [0.11, 0.29], [0.158, 0.0], [0.22, -0.5], [0.3, -1.08], [0.4, -1.62], [0.5, -1.82], [0.6, -1.7],
    [0.7, -1.25], [0.78, -0.66], [0.845, 0.0], [0.9, 0.55], [0.95, 1.2], [1.0, 2.35]]);
  const hull = hullOf({
    L, flare: 0.03,
    hb: (t) => (B / 2) * (t < TMAX ? 0.26 + 0.74 * Math.sin((t / TMAX) * Math.PI / 2) ** 0.85 : Math.max(0, Math.cos(Math.min(1, (t - TMAX) / (1 - TMAX)) * Math.PI / 2)) ** 0.7),
    sheer: (t) => (t < LOW ? 1.3 + 0.45 * ((LOW - t) / LOW) ** 2 : 1.3 + 1.05 * ((t - LOW) / (1 - LOW)) ** 2),
    depth: (t) => -YC(t),
    n: (t) => lerp(2.4, 2.0, clamp((t - 0.3) / 0.7, 0, 1)),
  });
  // the deck's camber, 0.14 m at her widest: its height at (x, z)
  const deckAt = (x, z) => { const h = Math.max(hull.hbAt(z), 0.05); return hull.deckY(z) + 0.022 * 2 * h * (1 - Math.min(1, Math.abs(x) / h) ** 2); };
  // the doghouse (blender/jclass.py dh_half), the skylight and the helm's well
  const DH_F = -1.6, DH_A = 4.6, DH_H = 0.62;
  const dhHalf = (z) => (z < DH_F || z > DH_A ? 0 : lerp(1.05, 1.35, smooth(DH_F, DH_F + 2.5, z)) * Math.sqrt(Math.max(0, 1 - (1 - clamp((z - DH_F) / 0.9, 0, 1)) ** 2) ** 0.5));
  const WELL = { f: 9.4, a: 13.4, w: 1.25, d: 0.75 }, SKY = { f: -7.6, a: -5.6, w: 0.62, h: 0.42, ridge: 0.24 };
  // the doghouse's top: its arch over its sides, 6 cm thick (blender/jclass.py build_house)
  const dhTop = (x, z) => { const w = dhHalf(z) + 0.03; return deckAt(w, z) + DH_H + 0.06 + 0.1 * (1 - Math.min(1, (x / Math.max(w, 0.05)) ** 2)); };
  // the keel's after edge, the rudder's post, raked 37°: from the heel (10 m aft of amidships, 3.85 m down) up to the counter
  const TE0 = 10.0, HEEL_Y = -3.85, STOCK = new THREE.Vector3(0, 1, 0.76).normalize();
  // the rig: the mast 43% of her length from the bow, 45.5 m over the deck; the boom 2.4 m over it
  const MAST_Z = -2.75, MF = deckAt(0, MAST_Z), MASTHEAD = MF + 45.5, BOOM_Y = MF + 2.4, BL = 18.2;
  const HOUNDS = MF + 30.5; // the inner forestay's and the runners' hounds
  const SPR = [[MF + 9.8, 2.6], [MF + 19.3, 2.2], [MF + 28.6, 1.8], [MF + 37.4, 1.35]]; // four sets: height, half-span
  const chord = (f) => lerp(17.9, 1.0, f) + 1.7 * Math.sin(Math.PI * f); // the main's width up its luff: some 440 m²
  // the jib topsail: tacked at the stem head's fitting over the bulwark, its luff on the forestay to 1.5 m under the masthead, its clew high and
  // 12.2 m off the luff (some 280 m²)
  const TACK = new THREE.Vector3(0, deckAt(0, -19.3) + 0.5, -19.3), FTOP = new THREE.Vector3(0, MASTHEAD - 0.7, MAST_Z - 0.35);
  const lu = FTOP.clone().sub(TACK), luL = lu.length(); lu.normalize();
  const HEAD = TACK.clone().addScaledVector(lu, luL - 1.5), perp = new THREE.Vector3(0, -lu.z, lu.y);
  const CLEW = lu.clone().multiplyScalar(0.2 * luL).addScaledVector(perp, 12.2); // from the tack
  // the staysail on the inner forestay, from 11.5 m forward of amidships to the hounds (some 140 m²)
  const STACK = new THREE.Vector3(0, deckAt(0, -11.5) + 0.3, -11.5), STOP = new THREE.Vector3(0, HOUNDS, MAST_Z - 0.3);
  const su = STOP.clone().sub(STACK), suL = su.length(); su.normalize();
  const SHEAD = STACK.clone().addScaledVector(su, suL - 1.0), SCLEW = su.clone().multiplyScalar(0.1 * suL).addScaledVector(new THREE.Vector3(0, -su.z, su.y), 8.6);
  const rig = rigOf({ span: MASTHEAD - 0.9 - BOOM_Y, chord, numAt: 0.62, flagAt: 0.9, mark: 4.2, head: HEAD, tack: TACK, clew: CLEW });
  const stayRig = rigOf({ span: MASTHEAD - 0.9 - BOOM_Y, chord, numAt: 0.62, flagAt: 0.9, mark: 4.2, head: SHEAD, tack: STACK, clew: SCLEW, noAd: true });
  return { L, B, hull, deckAt, DH_F, DH_A, DH_H, dhHalf, dhTop, WELL, SKY, BUL: 0.26, TE0, HEEL_Y, STOCK, MAST_Z, MF, MASTHEAD, BOOM_Y, BL, HOUNDS, SPR, chord, TACK, FTOP, HEAD, CLEW,
    STACK, STOP, SHEAD, SCLEW, rig, stayRig, POLE: 15, WHEEL_Z: 11.3, TRAV_Z: 14.6, SHEET_Z: 13.4 + 0.0, PRIM_Z: 5.6, GRIND_Z: 6.6, LEAD_Z: 2.6, SLEAD_Z: 0.4, RUNNER_Z: 9.2 };
})();

// a sailor sitting on a flat deck (JClassView sitDown): how far the figure's origin stands over the planking, the
// hips 12 cm up with the stand of −0.25 lowering them 0.225 m and the hip joint 7 cm over the origin
const SIT_Y = 0.12 + 0.25 * (THIGH + SHIN + 0.02) - 0.07;
MAT.bronze = new THREE.MeshStandardMaterial({ color: '#b48a52', roughness: 0.32, metalness: 1, envMapIntensity: 1 }); // the J's deck bronze
MAT.buoyRed = new THREE.MeshStandardMaterial({ color: '#c8202a', roughness: 0.6 });

const STAY_GAP = 0.3; // how far outside the staysail the yankee lies at the closest, in metres
// One sail flying outside another, each flogging to its own time, would go through it. Lays the outer cloth over the
// inner, gap metres to leeward of it, as cloth pressed against cloth does: outer and inner are their grids as they lie in
// the boat ({ a: x, y, z of each point, rows, cols }, a row running luff to leech), lee how far the sails have gone to
// that side (+ starboard, 0 on the centreline in a tack, where they change over and neither is outside). The outer luff
// stays on its stay, and past the inner sail's edges the cloth falls back to its own shape within reach metres. Gives
// how many points it moved.
export function drapeOver(outer, inner, lee, gap, reach = 2.5) {
  const side = Math.sign(lee), k = smooth(0.15, 0.6, Math.abs(lee));
  if (!k) return 0;
  const A = inner.a, n = inner.rows, m = inner.cols, w = m + 1, O = outer.a, ow = outer.cols + 1;
  const at = (i, j, c) => A[(i * w + j) * 3 + c];
  let moved = 0, L = [0, 0], E = [0, 0];
  const row = (f) => { // the inner sail's row f of the way up (in rows): its luff and leech, y and z
    const i = Math.min(Math.floor(f), n - 1), v = f - i;
    L = [lerp(at(i, 0, 1), at(i + 1, 0, 1), v), lerp(at(i, 0, 2), at(i + 1, 0, 2), v)];
    E = [lerp(at(i, m, 1), at(i + 1, m, 1), v), lerp(at(i, m, 2), at(i + 1, m, 2), v)];
  };
  row(0);
  const y0 = L[0], z0 = L[1], ey = E[0] - y0, ez = E[1] - z0, up = Math.sign(ey * (at(n, 0, 2) - z0) - ez * (at(n, 0, 1) - y0)); // which way the rows climb
  for (let r = 0; r <= outer.rows; r++) for (let c = 1; c <= outer.cols; c++) {
    const q = (r * ow + c) * 3, y = O[q + 1], z = O[q + 2];
    let lo = 0, hi = n; // the rows fan up from the foot without crossing: halve the way to the one this point lies on
    for (let s = 0; s < 12; s++) { const f = (lo + hi) / 2; row(f); if (up * ((E[0] - L[0]) * (z - L[1]) - (E[1] - L[1]) * (y - L[0])) >= 0) lo = f; else hi = f; }
    row(lo);
    const dy = E[0] - L[0], dz = E[1] - L[1], t = clamp(((y - L[0]) * dy + (z - L[1]) * dz) / Math.max(dy * dy + dz * dz, 1e-6), 0, 1);
    const off = Math.hypot(y - lerp(L[0], E[0], t), z - lerp(L[1], E[1], t)), fade = 1 - smooth(0, reach, off);
    if (fade <= 0) continue;
    const i = Math.min(Math.floor(lo), n - 1), v = lo - i, b = t * m, j = Math.min(Math.floor(b), m - 1), h = b - j;
    const x = lerp(lerp(at(i, j, 0), at(i, j + 1, 0), h), lerp(at(i + 1, j, 0), at(i + 1, j + 1, 0), h), v);
    const short = gap - side * (O[q] - x);
    if (short <= 0) continue;
    O[q] += side * short * fade * k;
    moved++;
  }
  return moved;
}

class JClassView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const D = JZ, add = this.start(), T = this.tilt, H = D.hull, MOD = JCLASS_MODEL, dk = D.deckAt;
    this.washH = H;
    this.flyY = 0;
    this.rollW = 3.2; // the sea's roll taken across her 6.5 m beam
    const deckM = deckFinish(look, M.teak);
    if (MOD) {
      // the hull and keel, the laid deck, the doghouse, the skylight and the helm's well, moulded (blender/jclass.py)
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMaterial(look.hull, look.stripe, look.bottom)], ['deck', deckM], ['wood', MAT.varnish], ['gel', MAT.cabin], ['teak', M.teak], ['glass', M.glass]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else {
      // from the lines in code: the canoe body, the keel as a long fin under it, the deck with the well sunk into it,
      // a varnished rail along the sheer where the model has its bulwark
      add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
      add(new THREE.Mesh(finGeo(3.0, 18, 11, 0.7, 0.3), hullMaterial(look.hull, look.stripe, look.bottom)), 0, -1.5, 2.0);
      const wl = H.tub(-D.WELL.w, D.WELL.f, D.WELL.w, D.WELL.a, 0.45, dk(0, D.WELL.f) - D.WELL.d, { slope: 0.04, crown: 0.14 });
      add(new THREE.Mesh(H.deck([wl.outline], 0.14), deckM)); add(new THREE.Mesh(wl.walls, GEL2)); add(new THREE.Mesh(wl.floor, M.teak));
      add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, D.DH_A - D.DH_F), MAT.varnish), 0, dk(0, 1.5) + 0.3, (D.DH_A + D.DH_F) / 2);
    }
    if (!MOD) for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 40; i++) { const t = 0.01 + (i / 40) * 0.978, z = H.zAt(t), x = H.hbAt(z) - 0.06; pts.push([sx * x, dk(x, z) + 0.13, z]); }
      T.add(tube(pts, 0.07, MAT.varnish));
    }
    // the doghouse's windows, four a side, oblong with rounded ends as the Js' are, and two in its front; the bronze
    // bars over the skylight's glass, five down each slope of its pitched top (blender/jclass.py build_skylight)
    const winG = new THREE.CapsuleGeometry(0.11, 0.38, 3, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.02);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      const z = lerp(-0.3, 3.8, i / 3), x = D.dhHalf(z) + 0.004, p = add(new THREE.Mesh(winG, MAT.pane), sx * x, dk(x, z) + D.DH_H * 0.55, z);
      p.rotation.y = sx * Math.PI / 2;
    }
    for (const sx of [-0.45, 0.45]) add(new THREE.Mesh(winG, MAT.pane), sx, dk(0, D.DH_F) + D.DH_H * 0.55, D.DH_F + 0.02).rotation.y = Math.PI;
    { const SK = D.SKY, top = dk(SK.w, (SK.f + SK.a) / 2) + SK.h;
      for (const sx of [-1, 1]) for (let i = 1; i <= 5; i++) { const z = lerp(SK.f, SK.a, i / 6); T.add(bar([sx * (SK.w - 0.02), top + 0.025, z], [0, top + SK.ridge + 0.02, z], 0.012, 0.012, MAT.bronze, 6)); } }
    // the doghouse's top: a varnished handrail down each side on its posts, the sliding companionway hatch over its
    // aft end in its garage, and the companionway's doors in its aft face
    for (const sx of [-1, 1]) {
      const x = sx * 0.85, pts = [];
      for (let i = 0; i <= 10; i++) { const z = lerp(-0.5, 2.6, i / 10); pts.push([x, D.dhTop(x, z) + 0.075, z]); }
      T.add(tube(pts, 0.022, MAT.varnish));
      for (let i = 0; i <= 4; i++) { const z = lerp(-0.5, 2.6, i / 4); add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.06), MAT.varnish), x, D.dhTop(x, z) + 0.035, z); }
    }
    { const z = 3.85, y = D.dhTop(0, z);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.3), MAT.varnish), 0, y + 0.05, z);           // the hatch, slid shut
      add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.1, 0.5), MAT.varnish), 0, y + 0.03, z - 0.85);    // its garage
      for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.3), MAT.bronze), sx * 0.42, y + 0.135, z);
      const za = D.DH_A + 0.004, yb = dk(0, za);
      for (const sx of [-0.21, 0.21]) add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.62), MAT.varnish), sx, yb + 0.34, za).rotation.y = 0;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.04), MAT.bronze), 0, yb + 0.66, za + 0.02); }
    // cowl ventilators on their varnished dorade boxes: a pair forward of the doghouse and a pair before the well, their
    // cowls white outside and red in the mouth, turned to face forward
    const cowl = (x, z) => {
      const y = dk(Math.abs(x), z);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.62), MAT.varnish), x, y + 0.11, z);
      add(cyl(0.1, 0.1, 0.34, MAT.cabin, 14), x, y + 0.39, z + 0.12);
      // the bend: a quarter torus from the pipe's top, curving up and over to face forward
      const bend = add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.1, 10, 14, Math.PI / 2), MAT.cabin), x, y + 0.56, z - 0.03); bend.rotation.y = -Math.PI / 2;
      const mouth = add(cyl(0.16, 0.11, 0.1, MAT.cabin, 14), x, y + 0.71, z - 0.08); mouth.rotation.x = -Math.PI / 2;
      const inside = add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), MAT.buoyRed), x, y + 0.71, z - 0.132); inside.rotation.y = Math.PI;
    };
    for (const sx of [-1, 1]) { cowl(sx * 1.2, -4.6); cowl(sx * 0.75, 8.5); }
    // the deck prisms, glass set flush in the planking to light the saloon and the cabins
    for (const sx of [-1, 1]) for (const z of [-11, -9, -3.4, 5.4, 7.6]) add(new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), M.glass), sx * 1.6, dk(1.6, z) + 0.006, z).rotation.x = -Math.PI / 2;
    // the bulwark's freeing ports along both sides at the deck, the fairleads on the cap rail at the bow and the
    // quarters, and a lifebuoy on each quarter, white with red bands
    const capY = (z) => H.deckY(z) + D.BUL + 0.06;
    for (const sx of [-1, 1]) {
      for (let z = -12; z <= 12; z += 3) {
        const x = H.hbAt(z), slope = (H.hbAt(z + 0.5) - H.hbAt(z - 0.5)) / 1.0;
        const p = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.42), M.dark), sx * (x + 0.006), H.deckY(z) + 0.04, z); p.rotation.y = -sx * Math.atan(slope);
      }
      for (const z of [-17.6, -15.8, 15.6, 17.4]) {
        const x = H.hbAt(z) - 0.05, slope = (H.hbAt(z + 0.5) - H.hbAt(z - 0.5)) / 1.0;
        const fl = new THREE.Group(); fl.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.36), MAT.bronze));
        for (const dz of [-0.13, 0.13]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), MAT.bronze); h.position.set(0, 0.06, dz); fl.add(h); }
        const o = add(mergeGroup(fl), sx * x, capY(z) + 0.03, z); o.rotation.y = -sx * Math.atan(slope);
      }
      const bz = 16.4, bx = sx * (H.hbAt(bz) - 0.16), ring = new THREE.Group();
      ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24), MAT.cabin));
      for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.064, 8, 6, Math.PI / 8), MAT.buoyRed); r.rotation.z = k * Math.PI / 2 - Math.PI / 16; ring.add(r); }
      const o = add(mergeGroup(ring), bx, H.deckY(bz) + 0.44, bz); o.rotation.y = Math.PI / 2; // hung on the bulwark, over its cap
    }
    // the helm's well: teak benches down its sides on their legs, for the afterguard
    { const W = D.WELL, fy = dk(0, W.f) - W.d;
      for (const sx of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, W.a - W.f - 1.0), M.teak), sx * (W.w - 0.3), fy + 0.44, (W.f + W.a) / 2 + 0.2);
        for (const z of [W.f + 0.9, (W.f + W.a) / 2 + 0.2, W.a - 0.6]) add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.05), MAT.varnish), sx * (W.w - 0.3), fy + 0.21, z);
      } }
    // the fore hatch, the forestay's and the inner forestay's fittings, the bow fairleads and cleats
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 1.0), MAT.varnish), 0, dk(0, -13.5) + 0.08, -13.5);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.8), M.glass), 0, dk(0, -13.5) + 0.18, -13.5);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.4), M.steel), 0, D.TACK.y - 0.25, D.TACK.z); // the stem head's fitting, up through the bulwark
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.3), M.steel), 0, D.STACK.y - 0.2, D.STACK.z);
    for (const sx of [-1, 1]) for (const z of [-17, 17]) fit(add, cleat(0.4), sx * (H.hbAt(z) - 0.35), dk(H.hbAt(z) - 0.35, z), z);
    // the rudder: hung on the keel's raked after edge from the heel up to the counter, 4.7 m along its stock and 1.6 m
    // across at its widest, turning about the stock
    const sy = -0.1, sz = D.TE0 + (sy - D.HEEL_Y) * (D.STOCK.z / D.STOCK.y);
    this.wheel = add(new THREE.Group(), 0, sy, sz);
    this.rudderAxis = D.STOCK;
    const blade = new THREE.Group(); blade.rotation.x = Math.atan2(D.STOCK.z, D.STOCK.y);
    blade.add(new THREE.Mesh(rudderGeo(4.6, (u) => 0.35 + 1.25 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) ** 0.6, 0.12).translate(0, 0, 0.1), hullMaterial(look.hull, look.stripe, look.bottom))); // some 18 cm thick at its widest, as the keel's after edge it hangs on
    this.wheel.add(blade);
    // the helm: the wheel on its pedestal at the well's forward end, the binnacle before it; the stock's head on deck
    const wy = dk(0, D.WELL.f) - D.WELL.d, hw = this.hw = add(new THREE.Group(), 0, wy + 1.15, D.WHEEL_Z);
    add(cyl(0.16, 0.22, 1.1, MAT.varnish, 12), 0, wy + 0.55, D.WHEEL_Z - 0.25);
    add(cyl(0.18, 0.2, 0.22, MAT.bronze, 16), 0, wy + 1.25, D.WHEEL_Z - 0.55);                   // the binnacle
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass), 0, wy + 1.36, D.WHEEL_Z - 0.55); // its compass's dome
    this.helmWheel = wheel(0.95, 10, MAT.varnish, M.steel); hw.add(this.helmWheel);
    add(cyl(0.12, 0.12, 0.08, M.steel, 12), 0, dk(0, 14.1) + 0.04, 14.1);
    // on deck: the grinders' pedestals with their handles, the primaries abreast of the doghouse's aft end, the staysail's
    // winches by the mast, the runners' and the mainsheet's aft; the yankee's sheet leads on the rail, the staysail's
    // on the deck; the shrouds' chainplates on the rail abreast of the mast, the runners' on the quarters
    for (const sx of [-1, 1]) {
      const px = sx * 2.35, py = dk(2.35, D.PRIM_Z);
      fit(add, winch(0.2, 0.42), px, py, D.PRIM_Z);
      fit(add, winch(0.16, 0.36), sx * 2.2, dk(2.2, 1.4), 1.4);
      fit(add, winch(0.18, 0.4), sx * 2.3, dk(2.3, 10.4), 10.4);
      fit(add, winch(0.14, 0.32), sx * 1.6, dk(1.6, D.TRAV_Z - 1.2), D.TRAV_Z - 1.2);
      const gx = sx * 0.9, gy = dk(0.9, D.GRIND_Z);
      add(cyl(0.12, 0.18, 0.95, M.dark, 12), gx, gy + 0.47, D.GRIND_Z);
      add(cyl(0.05, 0.05, 0.62, M.steel, 10), gx, gy + 1.0, D.GRIND_Z).rotation.z = Math.PI / 2; // the crank's axle athwartships
      const crank = add(new THREE.Group(), gx, gy + 1.0, D.GRIND_Z); // turning on it when they grind (update())
      for (const hx of [-1, 1]) { // a crank each side, half a turn apart, its grip turned out
        crank.add(bar([hx * 0.31, 0, 0], [hx * 0.31, hx * CRANK, 0], 0.022, 0.022, M.steel, 6));
        crank.add(bar([hx * 0.31, hx * CRANK, 0], [hx * 0.47, hx * CRANK, 0], 0.03, 0.03, M.dark, 8));
      }
      (this.spin ??= []).push(crank); (this.cranks ??= []).push(crank);
      const lx = sx * (H.hbAt(D.LEAD_Z) - 0.3);
      fit(add, block(0.09), lx, dk(Math.abs(lx), D.LEAD_Z) + 0.18, D.LEAD_Z);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 4.0), M.alu), lx, dk(Math.abs(lx), D.LEAD_Z) + 0.05, D.LEAD_Z);
      fit(add, block(0.07), sx * 1.9, dk(1.9, D.SLEAD_Z) + 0.12, D.SLEAD_Z);
      const cx = H.hbAt(D.MAST_Z) - 0.15;
      for (const dz of [-0.3, 0.3, 0.9, 1.5]) fit(add, chainplate([sx * cx, dk(cx, D.MAST_Z + dz) + 0.1, D.MAST_Z + dz], [sx * 2.6, D.SPR[0][0], D.MAST_Z], 0.6, 0.04));
      const rx = H.hbAt(D.RUNNER_Z) - 0.2;
      fit(add, chainplate([sx * rx, dk(rx, D.RUNNER_Z) + 0.1, D.RUNNER_Z], [0, D.HOUNDS, D.MAST_Z], 0.5, 0.035));
      fit(add, block(0.1), sx * rx, dk(rx, D.RUNNER_Z) + 0.68, D.RUNNER_Z); // the runner's tackle, its tail to the winch
      T.add(line([[sx * rx, dk(rx, D.RUNNER_Z) + 0.6, D.RUNNER_Z], [sx * 2.3, dk(2.3, 10.4) + 0.3, 10.4]]));
    }
    // the mast through the deck, its partners and wedges; the gooseneck; the halyards down its front and back; four
    // sets of spreaders, swept a little aft; the masthead's crane for the backstay and its light
    add(new THREE.Mesh(mastGeo(D.MASTHEAD - D.MF + 0.3, 0.62, 0.42, 0.32, 0.22, 0.7), ALLOY), 0, (D.MF + D.MASTHEAD) / 2, D.MAST_Z);
    add(cyl(0.42, 0.5, 0.18, MAT.varnish, 18), 0, D.MF + 0.09, D.MAST_Z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.45), M.alu), 0, D.BOOM_Y, D.MAST_Z + 0.4);
    // the mainsail's track up the mast's after face; at its foot the halyard winches, the turning blocks round the
    // partners and the halyards led aft through their clutches on deck to the doghouse's front
    add(new THREE.Mesh(new THREE.BoxGeometry(0.07, D.MASTHEAD - D.BOOM_Y - 0.6, 0.05), M.dark), 0, (D.BOOM_Y + D.MASTHEAD - 0.6) / 2, D.MAST_Z + 0.33);
    for (const sx of [-1, 1]) {
      fit(add, winch(0.13, 0.32), sx * 0.55, D.MF + 0.9, D.MAST_Z + 0.05, sx * Math.PI / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), M.alu), sx * 0.42, D.MF + 0.45, D.MAST_Z + 0.05); // its pad on the mast
      for (let i = 0; i < 3; i++) fit(add, block(0.07), sx * (0.38 + 0.13 * i), D.MF + 0.07, D.MAST_Z + 0.42);
      fit(add, clutches(4, 0.1), sx * 0.6, dk(0.6, D.DH_F - 0.6), D.DH_F - 0.6);
    }
    for (const [y, hs] of D.SPR) for (const sx of [-1, 1]) { const bt = add(cyl(0.06, 0.06, 0.3, MAT.cabin, 10), sx * hs, y, D.MAST_Z + 0.08); bt.rotation.z = Math.PI / 2; } // the spreaders' boots
    for (const dx of [-0.08, 0.08]) T.add(line([[dx, D.MASTHEAD - 1, D.MAST_Z - 0.32], [dx, D.MF + 1.2, D.MAST_Z - 0.33]]));
    T.add(line([[0, D.MASTHEAD - 0.6, D.MAST_Z + 0.32], [0, D.BOOM_Y + 1.5, D.MAST_Z + 0.32]]));
    for (const [y, hs] of D.SPR) for (const sx of [-1, 1]) {
      const s = add(new THREE.Mesh(spreaderGeo(hs, 0.07, 0.04), ALLOY), sx * hs / 2, y, D.MAST_Z + 0.08); s.rotation.z = -sx * Math.PI / 2; s.rotation.y = sx * 0.08;
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), M.alu), 0, D.MASTHEAD - 0.06, D.MAST_Z + 0.5);
    // the standing rigging: the forestay and the inner forestay; the cap shrouds over every spreader's end, the
    // intermediates over the lower three, the lowers to the first; the permanent backstay to the transom
    T.add(line([[0, D.FTOP.y, D.FTOP.z], [0, D.TACK.y, D.TACK.z]]), line([[0, D.STOP.y, D.STOP.z], [0, D.STACK.y, D.STACK.z]]));
    for (const sx of [-1, 1]) {
      const cx = H.hbAt(D.MAST_Z) - 0.15, foot = (dz) => [sx * cx, dk(cx, D.MAST_Z + dz) + 0.35, D.MAST_Z + dz];
      const tips = D.SPR.map(([y, hs]) => [sx * hs, y, D.MAST_Z + 0.08]);
      T.add(line([[sx * 0.2, D.MASTHEAD - 1.2, D.MAST_Z], tips[3], tips[2], tips[1], tips[0], foot(0.9)]));
      T.add(line([[sx * 0.25, D.SPR[3][0] - 0.3, D.MAST_Z], tips[2], tips[1], tips[0], foot(0.3)]));
      T.add(line([[sx * 0.28, D.SPR[1][0] - 0.3, D.MAST_Z], tips[0], foot(1.5)]));
      T.add(line([[sx * 0.3, D.SPR[0][0] - 0.3, D.MAST_Z], foot(-0.3)]));
    }
    { const z = H.STERN - 0.3; T.add(line([[0, D.MASTHEAD - 0.1, D.MAST_Z + 0.9], [0, dk(0, z) + 0.2, z]])); }
    // what moves every frame, in a group of its own so bake() leaves it be: the runners and checkstays, the sheets, the
    // staysail, the spinnaker and its pole
    const dyn = this.dyn = add(new THREE.Group());
    const ln = (n) => { const l = line(Array.from({ length: n }, () => [0, 0, 0])); l.frustumCulled = false; dyn.add(l); return l; };
    this.runners = [-1, 1].map((sx) => { const l = ln(9); l.userData.sx = sx; return l; });
    this.checks = [-1, 1].map((sx) => { const l = ln(2); l.userData.sx = sx; return l; });
    // the boom: alloy, deep and a little flat-topped, its gooseneck on the mast; the vang from the mast's foot; the
    // mainsheet's blocks under its end to the traveller across the deck aft of the helm
    this.mainPivot = add(new THREE.Group(), 0, 0, D.MAST_Z);
    const boomG = new THREE.BoxGeometry(0.42, 0.62, D.BL, 2, 2, 12), bp = boomG.attributes.position;
    for (let i = 0; i < bp.count; i++) { const f = (bp.getZ(i) + D.BL / 2) / D.BL, k = 1 - 0.35 * Math.abs(f - 0.45) ** 1.5; bp.setY(i, bp.getY(i) * k); }
    boomG.computeVertexNormals();
    const boom = new THREE.Mesh(boomG, ALLOY); boom.position.set(0, D.BOOM_Y, D.BL / 2 + 0.3); this.mainPivot.add(boom);
    const gear = new THREE.Group(), VA = [0, D.MF + 0.6, 0.45], VB = [0, D.BOOM_Y - 0.3, 4.2], VM = VA.map((v, i) => lerp(v, VB[i], 0.5));
    gear.add(bar(VA, VM, 0.07, 0.07, M.alu), bar(VM, VB, 0.1, 0.09, ALLOY));
    for (const [g, mm] of block(0.12)) { const o = new THREE.Mesh(g, mm); o.position.set(0, D.BOOM_Y - 0.45, D.SHEET_Z + 1.2 - D.MAST_Z); gear.add(o); }
    // the outhaul's car on the boom's top at the clew, the end fitting and its sheave box, and the reefing hooks at the
    // gooseneck
    const BE = D.BL + 0.3;
    const part = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); gear.add(o); };
    part(new THREE.BoxGeometry(0.34, 0.12, 0.5), M.dark, 0, D.BOOM_Y + 0.36, BE - 0.9);
    part(new THREE.BoxGeometry(0.46, 0.5, 0.3), M.alu, 0, D.BOOM_Y, BE + 0.1);
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.04, 0.16, 0.06), M.steel, sx * 0.17, D.BOOM_Y + 0.38, 0.9);
    this.mainPivot.add(mergeGroup(gear));
    // the topping lift from the boom's end to the masthead, slack while she sails
    this.mainPivot.add(line([[0, D.BOOM_Y + 0.3, BE], [0, (D.BOOM_Y + D.MASTHEAD) / 2, BE * 0.62 + 0.4], [0, D.MASTHEAD - 0.3, 0.5]]));
    this.main = sailMesh(26, 12, sailTexture('main', look, D.rig), look.laminate, 'main'); this.mainPivot.add(this.main);
    const TRY = dk(0, D.TRAV_Z) + 0.12;
    add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.14), M.alu), 0, TRY, D.TRAV_Z);
    const car = new THREE.Group(); car.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), M.dark));
    for (const [g, mm] of block(0.12)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.2; car.add(o); }
    this.travCar = add(mergeGroup(car), 0, TRY + 0.06, D.TRAV_Z);
    this.mainsheet = line(Array.from({ length: 7 }, () => [0, 0, 0])); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    // the jib topsail on the forestay, its sheet to the lead on the rail and on to the primary
    this.TACK = D.TACK; this.HEAD = D.HEAD; this.CLEW = D.CLEW; this.jibMax = 20; this.jibBelly = 0.11; this.jibLowers = true; // the yankee comes down under the spinnaker
    this.jibPivot = add(new THREE.Group(), D.TACK.x, D.TACK.y, D.TACK.z);
    this.jibAxis = D.HEAD.clone().sub(D.TACK).normalize();
    this.jib = sailMesh(22, 10, sailTexture('jib', look, D.rig), look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.makeTells(player);
    for (const t of this.tells) t.scale.setScalar(2.5);
    this.jibSheet = ln(3); this.lazySheet = ln(3);
    // the staysail on the inner forestay, sheeted to the deck abreast of the mast
    this.stayPivot = new THREE.Group(); this.stayPivot.position.copy(D.STACK); dyn.add(this.stayPivot);
    this.stayAxis = D.SHEAD.clone().sub(D.STACK).normalize();
    this.stay = sailMesh(16, 8, sailTexture('jib', look, D.stayRig), look.laminate, 'jib'); this.stayPivot.add(this.stay);
    this.staySheet = ln(3);
    // the spinnaker, its pole off the mast to windward, the guy to the pole's end and the sheet to the lee quarter
    this.kite = sailMesh(18, 12, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);
    this.pole = cyl(0.13, 0.13, D.POLE, ALLOY, 10); this.pole.visible = false; dyn.add(this.pole);
    this.kiteSheet = ln(3); this.guy = ln(3);
    this.windex = windex(add, D.MASTHEAD + 0.05, D.MAST_Z);
    this.windex.scale.setScalar(3);
    // her number on both bows, the logo amidships, the name on the quarters
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, -6.5, H.deckY(-6.5) - 0.5, 3.2, 1.05));
    { const z = H.BOW + 4.6; T.add(...bowNumber(H, look, z, H.deckY(z) - 0.55, 2.4, 0.65)); }
    { const z = H.STERN - 5.0; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.5, 3.6)) T.add(d); }
    // the helm's well, its floor 0.75 m under the deck and 0.6 m over the water, which the sea's crests overtop: a dry
    // lid over it at the deck
    { const rim = [], W = D.WELL; for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2, z = (W.f + W.a) / 2 + Math.cos(a) * (W.a - W.f) / 2, x = Math.sin(a) * W.w; rim.push([x, dk(x, z) - 0.02, z]); } add(rimLid(rim)); }
    // sixteen of her crew: the helm at the wheel, the tactician and the mainsheet trimmer by him, two grinders at the
    // pedestals, two trimmers at the primaries, the pit by the mast, the mast, the bow, the navigator at the
    // companionway, the runners' trimmer aft and four on the rail
    const m = crewMats(look);
    this.crew = [
      ['helm', 0, 12.3], ['tac', 0.55, 12.7], ['mainT', 0.8, 13.8], ['grind', 0.9, 6.98], ['grind', -0.9, 6.98], ['trim', 2.2, 6.4], ['trim', -2.2, 6.4],
      ['pit', 0.6, 0.0], ['mast', 0.5, -2.0], ['bow', 0.4, -12], ['rail', 2.6, -5.5], ['rail', 2.6, -8.5], ['rail', 2.6, -2.0], ['rail', 2.6, 1.0],
      ['nav', 0.45, 5.0], ['runner', 2.0, 10.2],
    ].map(([role, x0, z0], i) => {
      const s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[i % SKINS.length], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, role, x0, z0, i, x: x0, y: dk(Math.abs(x0), z0), z: z0, yaw: Math.PI, lean: 0, stand: 1, knee: -0.4, reach: 0.5 };
    });
    this.finish(label, 52);
  }
  // the yankee lies over the staysail, for as long as both are set and she is near enough for it to be seen
  yankeeOverStaysail() {
    const d = this.jib.userData;
    d.draped = 0;
    if (this.jibStowed > 0 || !d.fine) return;
    const v = new THREE.Vector3(), grid = (sail, pivot) => { // a sail's cloth as it lies in the boat
      const { rows, cols, g, step } = sail.userData, p = g.attributes.position, R = rows / step, C = cols / step, a = new Float32Array((R + 1) * (C + 1) * 3);
      for (let i = 0, q = 0; i <= R; i++) for (let j = 0; j <= C; j++, q += 3) v.fromBufferAttribute(p, i * step * (cols + 1) + j * step).applyQuaternion(pivot.quaternion).add(pivot.position).toArray(a, q);
      return { a, rows: R, cols: C };
    };
    const outer = grid(this.jib, this.jibPivot);
    d.draped = drapeOver(outer, grid(this.stay, this.stayPivot), -this.sailSide, STAY_GAP);
    if (!d.draped) return;
    const { rows, cols, g, step } = d, p = g.attributes.position, back = this.jibPivot.quaternion.clone().invert();
    for (let i = 0, q = 0; i <= outer.rows; i++) for (let j = 0; j <= outer.cols; j++, q += 3) {
      v.fromArray(outer.a, q).sub(this.jibPivot.position).applyQuaternion(back);
      p.setXYZ(i * step * (cols + 1) + j * step, v.x, v.y, v.z);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    // her sheets go with the clew
    const q = outer.cols * 3, [x, y, z] = [outer.a[q], outer.a[q + 1], outer.a[q + 2]];
    for (const s of [this.jibSheet, this.lazySheet]) { const a = s.geometry.attributes.position; a.setXYZ(0, x, y, z); a.needsUpdate = true; }
  }
  update(b, t, W, showLabel) {
    const D = JZ, H = D.hull, dk = D.deckAt, side = this.place(b, t, W);
    this.wheel.quaternion.setFromAxisAngle(this.rudderAxis, b.rudder * 0.5);
    this.helmWheel.rotation.z = -b.rudder * 4;
    const sa = b.sail * D2R, luff = b.luff, ph = t * 9;
    const sc = this.cloth, ss = this.sailSide, belly = -ss * (1 - sc.flogM * 0.85), span = D.rig.span;
    clearShrouds(this, sa, ss, { y: (f) => D.BOOM_Y + 0.35 + f * span, chord: D.chord, z0: 0.3, x: (f, u) => mainShape(sc, f, u, D.chord(f), ss, 0.1, 1.4).x });
    setSail(this.main, (f, u, v) => {
      const m = mainShape(sc, f, u, D.chord(f), ss, 0.1, 1.4);
      v.set(m.x, D.BOOM_Y + 0.35 + f * span, 0.3 + m.z);
      turnMain(this, f, v);
    });
    // the mainsheet from the blocks under the boom's end down to the car, which the traveller lets down to leeward
    const ma = this.mainPivot.rotation.y, bz = D.SHEET_Z + 1.2 - D.MAST_Z, TRY = dk(0, D.TRAV_Z) + 0.12;
    this.travCar.position.x = clamp(Math.sin(ma) * bz * 0.4 + Math.sign(Math.sin(ma)) * clamp((b.depower || 0) / 10, 0, 1) * 0.5, -1.6, 1.6);
    purchase(this.mainsheet, [this.travCar.position.x, TRY + 0.25, D.TRAV_Z], [Math.sin(ma) * bz, D.BOOM_Y - 0.5, D.MAST_Z + Math.cos(ma) * bz], 0.12);
    // the jib topsail: its sheet through the lead on the lee rail to the primary
    const lead = (ls) => { const x = ls * (H.hbAt(D.LEAD_Z) - 0.3); return [[x, dk(Math.abs(x), D.LEAD_Z) + 0.25, D.LEAD_Z], [ls * 2.35, dk(2.35, D.PRIM_Z) + 0.35, D.PRIM_Z]]; };
    this.jibAndTells(b, t, side, belly, luff, ph, lead);
    { const cw = this.jibClew(), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position, [a, w] = lead(-ls);
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, ...a); lz.setXYZ(2, ...w); lz.needsUpdate = true; }
    // the staysail on its own stay, trimmed with the yankee, and lowered with it under the spinnaker
    {
      const st = this.jibStowed, ja = Math.min((b.jibSail ?? b.sail) * D2R * 0.75 + 4 * D2R, 22 * D2R) * (1 - st);
      this.stayPivot.quaternion.setFromAxisAngle(this.stayAxis, -ss * ja);
      const head = D.SHEAD.clone().sub(D.STACK), clew = D.SCLEW, sag = staySag(head.length(), sc.aws);
      setSail(this.stay, (f, u, v) => {
        const sg = sag * Math.sin(Math.PI * f), lx = -ss * sg, ly = head.y * f, lz = head.z * f + sg * 0.5;
        const ex = lerp(clew.x, head.x, f), ey = lerp(clew.y, head.y, f), ez = lerp(clew.z, head.z, f), len = Math.hypot(ex - lx, ey - ly, ez - lz), al = jibAlong(f, u);
        v.set(lerp(lx, ex, al) + jibShape(sc, f, u, len, ss, 0.11, 0.7), lerp(ly, ey, al), lerp(lz, ez, al));
        stowJib(v, st, true);
      });
      const cw = stowJib(D.SCLEW.clone(), st, true).applyQuaternion(this.stayPivot.quaternion).add(this.stayPivot.position), ls = cw.x < 0 ? -1 : 1, p = this.staySheet.geometry.attributes.position;
      p.setXYZ(0, cw.x, cw.y, cw.z); p.setXYZ(1, ls * 1.9, dk(1.9, D.SLEAD_Z) + 0.2, D.SLEAD_Z); p.setXYZ(2, ls * 2.2, dk(2.2, 1.4) + 0.3, 1.4); p.needsUpdate = true;
      this.yankeeOverStaysail();
    }
    // the runners: the windward one set up from the hounds to its quarter, its checkstay to the masthead's third; the
    // lee one let go forward and tied off at the mast, its checkstay with it; they change over as the boom comes across
    if (this.detailOn !== false) this.runners.forEach((r, i) => {
      const sx = r.userData.sx, c = this.checks[i].geometry.attributes.position, rz = D.RUNNER_Z, x = sx * (H.hbAt(rz) - 0.2), y = dk(Math.abs(x), rz) + 0.3, set = smooth(-0.3, 0.3, sx * ss);
      setRunner(r, [sx * 0.25, D.HOUNDS, D.MAST_Z + 0.25], [x, y, rz], [sx * 0.38, D.HOUNDS, D.MAST_Z - 0.12], [sx * 0.46, D.BOOM_Y - 0.4, D.MAST_Z - 0.16], set, 0.15);
      const m = r.geometry.attributes.position; // the checkstay comes down onto the let-go runner, halfway along it
      c.setXYZ(0, sx * lerp(0.38, 0.2, set), D.MF + 38, D.MAST_Z + lerp(-0.12, 0.3, set));
      c.setXYZ(1, lerp(m.getX(4), x, set), lerp(m.getY(4), y, set), lerp(m.getZ(4), rz, set));
      c.needsUpdate = true;
    });
    // the crew: the helm behind the wheel, the tactician and the mainsheet's trimmer by him; upwind the grinders at their
    // handles and the windward trimmer at his primary, everyone else sitting on the windward rail facing in, legs over
    // the deck; downwind the trimmers on the spinnaker's sheet and guy, the rest down the middle; the bow on the
    // foredeck and the mast man at the mast for a hoist, a drop or a gybe of the pole
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, busy = !!b.kiteJob;
    // the grinders wind the cranks after a tack or a gybe and for a hoist or a drop; otherwise their hands rest on them
    const winding = this.sinceTack(t, side) < 7 || busy;
    for (const cr of this.cranks) cr.rotation.x += (winding ? 6.5 : 0) * (this.crewStep ?? 0);
    let rail = 0;
    for (const c of this.crew) {
      let x = c.x0, z = c.z0, yaw = Math.PI / 2, lean = 0.05, stand = 1, knee = -0.3, reach = 0.5;
      // sitting on her flush deck: on the planking, the thighs raised a little and the shins sloping down to the feet
      // on the deck (stand below 0 turns the hips past level and lowers them; the figure is raised to match, SIT_Y),
      // where a cockpit's sailor has his shins hanging into the footwell
      const sitDown = () => { stand = -0.25; knee = -0.71; };
      // the rail crew sit on deck, their backs to the bulwark, facing in
      const sitRail = (sd = side) => { const zz = lerp(-10, 5.5, (rail++) / 9); z = zz; x = sd * (H.hbAt(zz) - 0.42); yaw = Math.PI - 0.1; lean = -0.12; sitDown(); reach = 0.3; };
      let hands = null;
      if (c.role === 'helm') { x = side * 0.75; z = D.WHEEL_Z + 0.42; yaw = Math.PI / 2 + 0.25; lean = 0.15; reach = 1.0; hands = this.rim(this.hw, this.helmWheel, 0.95, side, [-0.05, 0.6]); } // to windward of the wheel, to see the jib's luff
      else if (c.role === 'tac') { x = side * 0.55; yaw = Math.PI / 2 + 0.3; }
      else if (c.role === 'nav') { x = 0.45; yaw = Math.PI / 2 - 0.3; reach = 0.2; }
      else if (c.role === 'runner') { x = side * 2.0; yaw = Math.PI - 0.5; lean = 0.15; reach = 0.8; }
      else if (c.role === 'mainT') { x = side * 0.9; yaw = Math.PI / 2 + 0.6; reach = 0.8; }
      else if (c.role === 'grind') { x = c.x0; yaw = Math.PI / 2; lean = 0.45; reach = 1.2; const cr = this.cranks[c.x0 < 0 ? 0 : 1]; hands = [-1, 1].map((hx) => { const a = cr.rotation.x + (hx > 0 ? 0 : Math.PI); return new THREE.Vector3(cr.position.x + hx * 0.4, cr.position.y + CRANK * Math.cos(a), cr.position.z + CRANK * Math.sin(a)); }); }
      else if (c.role === 'trim') { const mine = up ? c.x0 * side < 0 : true; if (mine) { x = (up ? -side : Math.sign(c.x0)) * 2.0; yaw = 0.4; lean = 0.2; reach = 0.9; } else sitRail(); }
      else if ((c.role === 'bow' || c.role === 'mast') && busy) { x = 0.4; z = c.role === 'bow' ? -12 : D.MAST_Z + 0.9; yaw = Math.PI / 2; lean = 0.3; reach = 0.9; if (c.role === 'mast') hands = this.haul(0.12, dk(0.4, z) + 1.0, D.MAST_Z + 0.36, t); } // the mast man sweats the halyard
      else if (up) sitRail();
      else { sitRail(c.i % 2 ? side : -side); lean = -0.05; } // downwind: along both side decks, clear of the doghouse
      // standing on the deck; sitting on it (SIT_Y: the hips 12 cm up, the figure raised by what sitDown lowers it); the
      // afterguard standing on the helm's well's floor, which is flat (the deck over it rises aft)
      const inWell = (c.role === 'helm' || c.role === 'tac') && z >= D.WELL.f && z <= D.WELL.a;
      const y = inWell ? dk(0, D.WELL.f) - D.WELL.d + 0.01 : dk(Math.abs(x), z) + (stand < 0.5 ? SIT_Y : 0.02);
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach, hands }, k);
    }
    // the spinnaker: its tack at the pole's end, the pole squared aft to the wind as she bears away; its head at the
    // masthead, its clew out to leeward
    const kf = kiteHoist(b), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0));
    this.kite.visible = this.kiteSheet.visible = this.guy.visible = this.pole.visible = kf > 0.02;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, sq = clamp((a - 80) / 100, 0, 1), pa = lerp(0.35, 1.45, sq) * lerp(0.4, 1, kf), wd = this.sailSide, sd = -wd;
      const P0 = [0, D.MF + 3.2, D.MAST_Z - 0.4], PE = [P0[0] + wd * Math.sin(pa) * D.POLE, P0[1] + 0.8, P0[2] - Math.cos(pa) * D.POLE];
      this.pole.position.set((P0[0] + PE[0]) / 2, (P0[1] + PE[1]) / 2, (P0[2] + PE[2]) / 2);
      this.pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(PE[0] - P0[0], PE[1] - P0[1], PE[2] - P0[2]).normalize());
      const out = lerp(15, 10, sq) * lerp(0.2, 1, kfill);
      const tk = [lerp(0, PE[0], kf), lerp(D.TACK.y + 1, PE[1], kf), lerp(D.TACK.z, PE[2], kf)], hd = [0, lerp(D.TACK.y + 4, D.MASTHEAD - 0.8, kf), lerp(D.TACK.z, D.MAST_Z - 0.6, kf)];
      const cl = [sd * out, lerp(D.TACK.y + 2, 4.5, kf), lerp(D.TACK.z + 2, lerp(-2, 2, sq), kf)];
      const qz = H.STERN - 3, qx = (s) => s * (H.hbAt(qz) - 0.2), lead = [qx(sd), dk(Math.abs(qx(sd)), qz) + 0.2, qz], guard = kiteGuard(this); guard.clew(cl, lead);
      setKite(this, tk, hd, cl, sd, wd, 6.5, kfill, guard);
      const kp = this.kiteSheet.geometry.attributes.position, gp = this.guy.geometry.attributes.position;
      kp.setXYZ(0, ...cl); kp.setXYZ(1, ...lead); kp.setXYZ(2, sd * 2.3, dk(2.3, 10.4) + 0.3, 10.4); kp.needsUpdate = true;
      gp.setXYZ(0, ...PE); gp.setXYZ(1, wd * (H.hbAt(1.0) - 0.15), dk(H.hbAt(1.0) - 0.15, 1.0) + 0.2, 1.0); gp.setXYZ(2, wd * 2.35, dk(2.35, D.PRIM_Z) + 0.35, D.PRIM_Z); gp.needsUpdate = true;
    }
    this.showLabel(b, showLabel);
  }
}

// ---------- the Laser (ILCA) ----------
// a 4.19 m single-hander: a shallow, flat-floored hull with a crowned deck and a small self-draining cockpit aft, the
// daggerboard through the deck just forward of it, a kick-up rudder on the transom with a tiller and its extension;
// one sail sleeved over an unstayed aluminium mast, a low boom with its kicker, the mainsheet from the boom's end to a
// rope traveller across the aft deck and forward along the boom to the ratchet block at the front of the cockpit. No
// jib and no kite (the parts the game asks for are there, never shown). One sailor, hiking.
const LZ = (() => {
  const L = 4.19, B = 1.39;
  const hull = hullOf({
    L, flare: 0.06,
    // the widest a little aft of the middle; the forefoot raked up clear of the water (3.81 m on the waterline)
    hb: (t) => (B / 2) * (t < 0.42 ? 0.72 + 0.28 * Math.sin((t / 0.42) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.42) / 0.58) * Math.PI / 2)) ** 0.72),
    sheer: (t) => 0.3 + 0.07 * t ** 1.6,
    depth: (t) => 0.13 * Math.sin(Math.PI * Math.min(1, t * 0.93 + 0.05)) ** 0.7 - 0.22 * Math.max(0, (t - 0.88) / 0.12) ** 1.5,
    n: (t) => lerp(2.6, 1.9, clamp((t - 0.4) / 0.6, 0, 1)),
  });
  // to the ILCA rules: the two-piece mast 6.16 m long, some 0.36 m of it down in its step, the joint 2.5 m above the
  // deck; the gooseneck 0.945 m up from the mast's foot, so the luff 5.13 m; the boom 2.74 m
  const MAST_Z = hull.BOW + 1.0, MAST_FOOT = hull.deckY(MAST_Z) + 0.07, MASTHEAD = MAST_FOOT + 5.78, BOOM_Y = MAST_FOOT + 0.57, BL = 2.7, JOINT = MAST_FOOT + 2.5; // the mast's foot on the deck's 5 cm crown
  const chord = (f) => lerp(2.45, 0.15, f) + 0.12 * Math.sin(Math.PI * f);
  const span = MASTHEAD - 0.08 - BOOM_Y;
  const rig = rigOf({ span, chord, numAt: 0.5, flagAt: 0.86, mark: 0.5, head: new THREE.Vector3(0, MASTHEAD, MAST_Z), tack: new THREE.Vector3(0, BOOM_Y, MAST_Z), clew: new THREE.Vector3(0, 0, BL) });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, JOINT, BOOM_Y, BL, chord, span, rig, CK: [0.05, 1.36], FLOOR: 0.13, TRAV_Z: hull.STERN - 0.26, MID_Z: 1.09 }; // the boom's middle block 1.09 m from the gooseneck
})();

class LaserView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const add = this.start(), T = this.tilt, H = LZ.hull, [cz0, cz1] = LZ.CK;
    this.washH = H;
    this.flyY = 0;
    this.lift = 0.16; // high on the water, her topsides well clear of it
    const MOD = LZ_MODEL, skid = deckFinish(look, SKID);
    // the deck's surface at (x, z): the sheer and the crown on it, which the fittings stand on
    const deckAt = (x, z) => H.deckY(z) + 0.05 * (1 - Math.min(1, Math.abs(x) / Math.max(H.hbAt(z), 0.2)) ** 2);
    if (MOD) {
      // the hull, deck, cockpit, flange and daggerboard slot, moulded (blender/laser.py), in a group of their own so the
      // boat's merging of her small parts (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMaterial(look.hull, look.stripe, look.bottom)], ['deck', skid], ['gel', MAT.lip]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else {
      add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
      // the deck, crowned, and the cockpit sunk into it: a small well with a non-skid floor, its walls sloping in
      const ck = H.tub(-0.3, cz0, 0.3, cz1, 0.14, LZ.FLOOR, { slope: 0.05, crown: 0.05 });
      add(new THREE.Mesh(H.deck([ck.outline], 0.05), skid));
      const walls = add(new THREE.Mesh(ck.walls, GEL2)); walls.userData.detail = false;
      add(new THREE.Mesh(ck.floor, skid));
      T.add(H.border(0.06, GEL2, 0.05));
      // the gunwale: the hull-to-deck joint's rolled lip, a pale grey line round the boat just under the deck edge
      for (const sx of [-1, 1]) {
        const pts = []; for (let i = 0; i <= 18; i++) { const t = 0.004 + (i / 18) * 0.985, y = H.deckY(H.zAt(t)) - 0.012; pts.push([sx * (H.xAt(t, y) + 0.004), y, H.zAt(t)]); }
        T.add(tube(pts, 0.011, MAT.lip));
      }
    }
    // her cockpit's floor 13 cm above the water, which the chop's crests overtop: a dry lid over it, at its rim
    add(rimLid(H.tub(-0.3, cz0, 0.3, cz1, 0.14, LZ.FLOOR).outline.map(([x, z]) => [x * 1.01, deckAt(x, z) - 0.005, z])));
    // the bow's handle and eye, the drain bung in the transom
    const bz = H.BOW + 0.32;
    T.add(tube([[-0.07, deckAt(0.07, bz) - 0.01, bz], [-0.06, deckAt(0, bz) + 0.05, bz], [0.06, deckAt(0, bz) + 0.05, bz], [0.07, deckAt(0.07, bz) - 0.01, bz]], 0.009, M.steel));
    add(cyl(0.022, 0.022, 0.02, M.dark, 10), 0.18, 0.2, H.STERN + 0.005).rotation.x = Math.PI / 2;
    // the hiking strap down the middle of the cockpit floor, from its front to the shock cord at the back
    const strap = MAT.strap;
    T.add(tube([[0, LZ.FLOOR + 0.02, cz0 + 0.1], [0, LZ.FLOOR + 0.07, cz0 + 0.5], [0, LZ.FLOOR + 0.07, cz1 - 0.35], [0, LZ.FLOOR + 0.03, cz1 - 0.05]], 0.02, strap));
    // the daggerboard: a parallel-chord foil down through its case in the deck, 0.79 m below the water, its head and
    // handle standing proud
    const DBZ = cz0 - 0.2;
    add(new THREE.Mesh(finGeo(0.7, 0.34, 0.34, 0.08, 0), MAT.fin), 0, -0.08, DBZ);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.31), MAT.fin), 0, deckAt(0, DBZ) + 0.06, DBZ);
    if (!MOD) add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.36), GEL2), 0, deckAt(0, DBZ) + 0.005, DBZ); // the case's lip in the deck (moulded, in the model)
    T.add(tube([[0, deckAt(0, DBZ) + 0.14, DBZ - 0.12], [0, deckAt(0, DBZ) + 0.21, DBZ - 0.06], [0, deckAt(0, DBZ) + 0.21, DBZ + 0.08], [0, deckAt(0, DBZ) + 0.14, DBZ + 0.13]], 0.012, M.dark)); // its handle
    T.add(line([[0, deckAt(0, DBZ) + 0.15, DBZ - 0.13], [0, LZ.MAST_FOOT + 0.06, LZ.MAST_Z + 0.06]])); // the shock cord that holds it down
    // the control lines, the cunningham and the outhaul: from their fairleads at the mast's foot aft along the deck
    // through the cam cleats either side of the daggerboard case, the tails into the cockpit
    for (const sx of [-1, 1]) {
      fit(add, block(0.016), sx * 0.07, LZ.MAST_FOOT + 0.03, LZ.MAST_Z + 0.08, sx * 0.5);
      const cz = DBZ + 0.06, cx = sx * 0.2, c = add(new THREE.Mesh(camGeo(), M.dark), cx, deckAt(cx, cz) + 0.006, cz); c.rotation.y = sx * 0.15;
      T.add(line([[sx * 0.075, LZ.MAST_FOOT + 0.04, LZ.MAST_Z + 0.1], [cx * 0.8, deckAt(cx * 0.8, cz - 0.4) + 0.015, cz - 0.4], [cx, deckAt(cx, cz) + 0.03, cz], [cx * 0.85, deckAt(cx * 0.85, cz + 0.2) + 0.01, cz + 0.2], [sx * 0.18, LZ.FLOOR + 0.03, cz + 0.45]]));
    }
    // the kick-up rudder on its gudgeons on the transom: the alloy stock, the blade down under the hull
    const RZ = H.STERN + 0.06;
    const head = new THREE.Shape(); head.moveTo(0, 0); head.lineTo(0.22, 0); head.quadraticCurveTo(0.25, 0.2, 0.18, 0.36); head.lineTo(0.02, 0.36); head.lineTo(0, 0);
    const hg = new THREE.ExtrudeGeometry(head, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }).translate(0, 0, -0.035).rotateY(-Math.PI / 2);
    add(new THREE.Mesh(hg, M.dark), 0, 0.02, RZ - 0.02); // the rudder head: a black alloy stock, the blade pinned in its jaws
    add(new THREE.Mesh(finGeo(0.6, 0.205, 0.2, 0.09, 0.05), MAT.fin), 0, 0.02, RZ + 0.08); // the blade 0.55 m below the water
    for (const y of [0.1, 0.3]) { add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.06), M.steel), 0, y, H.STERN + 0.02); add(cyl(0.008, 0.008, 0.07, M.steel, 6), 0, y - 0.02, H.STERN + 0.05); } // gudgeons and pintles
    // the tiller over the aft deck and its extension, swinging with the helm
    this.wheel = add(new THREE.Group(), 0, deckAt(0, H.STERN) + 0.04, RZ);
    const tl = cyl(0.016, 0.02, 0.95, M.alu, 8); tl.rotation.x = Math.PI / 2 + 0.05; tl.position.set(0, 0.04, -0.47); this.wheel.add(tl);
    const uj = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), M.dark); uj.position.set(0, 0.06, -0.94); this.wheel.add(uj); // the extension's universal joint
    const grip = cyl(0.022, 0.022, 0.13, M.dark, 8); grip.rotation.x = Math.PI / 2; grip.position.set(0, 0.04, -0.12); this.wheel.add(grip);
    this.ext = new THREE.Group(); this.ext.position.set(0, 0.06, -0.94); this.ext.rotation.set(0.3, 0, -1.2); this.wheel.add(this.ext); // from its joint to her aft hand, to the side she sits
    { const e = cyl(0.01, 0.01, 1.1, M.dark, 6); e.position.y = 0.55; this.ext.add(e); }
    // the rope traveller across the aft deck between its fairleads, its block riding it
    const TZ = LZ.TRAV_Z, ty = deckAt(0.42, TZ), ty0 = deckAt(0, TZ);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.05), M.dark), sx * 0.42, ty + 0.015, TZ);
    { const c = add(new THREE.Mesh(camGeo(), M.dark), 0.26, deckAt(0.26, TZ - 0.18) + 0.006, TZ - 0.18); c.rotation.y = Math.PI / 2; } // the traveller's cleat
    T.add(line([[0.42, ty + 0.03, TZ], [0.34, deckAt(0.34, TZ - 0.1) + 0.02, TZ - 0.1], [0.26, deckAt(0.26, TZ - 0.18) + 0.03, TZ - 0.18], [0.2, deckAt(0.2, TZ - 0.3) + 0.01, TZ - 0.3]]));
    T.add(line([[-0.42, ty + 0.03, TZ], [0, ty0 + 0.11, TZ], [0.42, ty + 0.03, TZ]]));
    const tb = new THREE.Group(); for (const [g, mm] of block(0.022)) tb.add(new THREE.Mesh(g, mm));
    this.travCar = add(mergeGroup(tb), 0, ty0 + 0.13, TZ);
    // the mainsheet's ratchet block at the front of the cockpit, and the bow's eye and drain
    const rat = new THREE.Group(); rat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 12), M.dark));
    for (const [g, mm] of block(0.028)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.07; rat.add(o); }
    add(mergeGroup(rat), 0, LZ.FLOOR + 0.03, cz0 + 0.12);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), M.steel), 0, deckAt(0, H.BOW + 0.15) + 0.01, H.BOW + 0.15);
    // the mast: two alloy sections, unstayed, the top one thinner and tapering, sleeved into the bottom one at the
    // joint; its step a collar in the deck
    add(cyl(0.032, 0.032, LZ.JOINT - LZ.MAST_FOOT, M.alu, 12), 0, (LZ.MAST_FOOT + LZ.JOINT) / 2, LZ.MAST_Z);
    add(cyl(0.019, 0.026, LZ.MASTHEAD - LZ.JOINT, M.alu, 12), 0, (LZ.JOINT + LZ.MASTHEAD) / 2, LZ.MAST_Z);
    add(cyl(0.045, 0.05, 0.04, M.dark, 12), 0, LZ.MAST_FOOT, LZ.MAST_Z);
    add(cyl(0.034, 0.034, 0.05, M.dark, 10), 0, LZ.JOINT, LZ.MAST_Z); // the joint
    // the boom, its kicker (a tackle from the mast's foot) and its outhaul, turning with the sail
    this.mainPivot = add(new THREE.Group(), 0, 0, LZ.MAST_Z);
    const gear = new THREE.Group();
    const boom = cyl(0.025, 0.025, LZ.BL, M.alu, 10); boom.rotation.x = Math.PI / 2; boom.position.set(0, LZ.BOOM_Y, LZ.BL / 2 + 0.03); gear.add(boom);
    // the kicker: a tackle from a block at the mast's foot to its strop on the boom, the falls between them
    for (const [g, mm] of block(0.018)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.MAST_FOOT + 0.1, 0.06); gear.add(o); }
    for (const [g, mm] of block(0.018)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.08, 0.46); gear.add(o); }
    const VA = [0, LZ.MAST_FOOT + 0.12, 0.07], VB = [0, LZ.BOOM_Y - 0.1, 0.45]; // its key 0.45 m along the boom
    this.mainPivot.add(line([0, 1, 2, 3, 4, 5].map((i) => { const e = i % 2 ? VB : VA, dx = (i / 5 - 0.5) * 0.03; return [e[0] + dx, e[1], e[2]]; })));
    // the outhaul along the boom from the clew to its turning block at the gooseneck
    this.mainPivot.add(line([[0.02, LZ.BOOM_Y + 0.04, LZ.BL - 0.05], [0.02, LZ.BOOM_Y + 0.02, 0.1], [0.06, LZ.MAST_FOOT + 0.05, 0.06]]));
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.06), M.dark).translateY(LZ.BOOM_Y + 0.04).translateZ(LZ.BL - 0.04)); // the clew's strap
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.09), M.dark).translateY(LZ.BOOM_Y).translateZ(0.04)); // the gooseneck
    for (const [g, mm] of block(0.02)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.05, LZ.BL - 0.06); gear.add(o); }
    for (const [g, mm] of block(0.02)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.05, LZ.MID_Z); gear.add(o); }
    this.mainPivot.add(mergeGroup(gear));
    // the window low in the sail, 0.2–0.4 m above the foot, clear plastic sewn in to see to leeward under the boom
    const wtex = onCloth(sailTexture('main', look, LZ.rig), (x, w, h, X) => {
      const y0 = h * (1 - 0.4 / LZ.span), y1 = h * (1 - 0.19 / LZ.span), x0 = Math.min(X(0.36), X(0.64)), x1 = Math.max(X(0.36), X(0.64));
      x.fillStyle = 'rgba(96, 118, 132, 0.7)'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
    });
    this.main = sailMesh(20, 10, wtex, look.laminate, 'main'); this.mainPivot.add(this.main);
    // the telltales near the sail's luff
    if (player) for (const [f, sx] of [[0.35, 1], [0.35, -1], [0.6, 1], [0.6, -1]]) {
      const tt = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.25).translate(0, -0.12, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      tt.userData = { f, sx }; this.mainPivot.add(tt); this.tells.push(tt);
    }
    // the mainsheet: from the traveller up to the boom's end, along it to the middle block and down to the ratchet
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    // no jib and no kite: the parts the game asks for, never shown
    const none = sailTexture('kite', look);
    this.jib = sailMesh(2, 2, none, false, 'jib'); this.jib.visible = false;
    this.kite = sailMesh(2, 2, none, false, 'kite'); this.kite.visible = false;
    this.sprit = new THREE.Group(); this.kiteSheet = new THREE.Group(); this.lazySheet = new THREE.Group(); this.jibSheet = new THREE.Group();
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 0.95, 0.19, 0.42, 0.15));
    { const z = H.STERN - 0.55; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.09, 0.5)) T.add(d); }
    this.windex = windex(add, LZ.MASTHEAD + 0.02, LZ.MAST_Z);
    // her one sailor
    const m = crewMats(look), s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[0], roughness: 0.65 }) });
    T.add(s.g);
    this.crew = [{ g: s.g, s, z0: 1.05, i: 0, x: 0, y: H.deckY(1.05), z: 1.05, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5, trackHands: true }];
    this.eye = [0.85, 1.2, 1.15]; // the helm view: her head as she hikes
    this.finish(label, 8);
  }
  update(b, t, W, showLabel) {
    const H = LZ.hull, side = this.place(b, t, W);
    this.wheel.rotation.y = b.rudder * 0.5;
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    // the sleeve round the mast gives the luff an even entry; the full sail sets deep low down and flattens up high
    const sc = this.cloth, ss = this.sailSide, span = LZ.span, shape = (f, u) => mainShape(sc, f, u, LZ.chord(f), ss, 0.12, 0.3);
    setSail(this.main, (f, u, v) => {
      const m = shape(f, u);
      v.set(m.x, LZ.BOOM_Y + 0.06 + f * span, m.z + 0.03);
    });
    // the sheet: traveller → boom end → middle block → ratchet, the block on the traveller riding to leeward
    const ma = this.mainPivot.rotation.y, at = (z, dy) => [Math.sin(ma) * z, LZ.BOOM_Y - dy, LZ.MAST_Z + Math.cos(ma) * z];
    this.travCar.position.x = clamp(Math.sin(ma) * 1.6, -0.36, 0.36);
    const ms = this.mainsheet.geometry.attributes.position, ty = H.deckY(LZ.TRAV_Z) + 0.13;
    [[this.travCar.position.x, ty, LZ.TRAV_Z], at(LZ.BL - 0.06, 0.07), at(LZ.BL - 0.06, 0.05), at(LZ.MID_Z, 0.07), [0, LZ.FLOOR + 0.12, LZ.CK[0] + 0.12]].forEach((p, i) => ms.setXYZ(i, ...p));
    ms.needsUpdate = true;
    this.windex.rotation.y = -b.awa;
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side, u = 0.35 / LZ.chord(f);
      tt.position.set(shape(f, u).x + sx * 0.02, LZ.BOOM_Y + 0.06 + f * span, 0.38);
      let rot = Math.PI / 2 + Math.sin(t * 9 + f * 10) * 0.12, ok = true;
      if (b.trim === 'in' && windward) { rot = Math.PI / 2 + 1.0 + Math.sin(t * 13) * 0.5; ok = false; }
      if (b.trim === 'out' && !windward) { rot = 0.25 + Math.sin(t * 5 + f) * 0.2; ok = false; }
      if (b.trim === 'irons') { rot = Math.sin(t * 15 + f * 3) * 1.4; ok = false; }
      tt.rotation.x = -rot;
      tt.material.color.set(ok ? '#2ecc71' : '#ff4d3d');
    }
    // the sailor: upwind sat out on the windward deck edge, feet under the strap, leaning back out over the water the
    // harder it blows; off the wind sat in on the windward side of the cockpit, ducking under the boom in a gybe
    // In light air she sits in on the side deck, leaning in to keep the boat heeled a little; as the breeze builds she
    // slides out until she's hanging off the strap, flat out at the top of her range. She works the boat through the
    // waves: leaning back as the bow rises, forward as it drops, and sliding aft a little off the wind to keep the bow up
    const k = this.crewDt(t), up = Math.abs(b.twa) < 100 * D2R, c = this.crew[0];
    const out = clamp(((b.aws || 8) - 6) / 9, 0, 1) * clamp(b.heel / 8, 0.3, 1), pitch = this.tilt.rotation.x;
    const z = c.z0 + (up ? 0 : 0.25), hb = H.hbAt(z), work = clamp(pitch * 2.5, -0.15, 0.15);
    const want = up
      ? { x: side * lerp(hb - 0.18, hb + 0.03, out), y: H.deckY(z) + 0.06, z, yaw: Math.PI - lerp(0.75, 0.5, out), lean: lerp(0.25, -0.95, out) - work, stand: 0, knee: lerp(-1.2, -0.5, out), reach: lerp(0.7, 0.35, out) }
      : { x: side * 0.4, y: H.deckY(z) + 0.04, z, yaw: Math.PI - 0.7, lean: 0.12 - work, stand: 0, knee: -1.25, reach: 0.6 };
    want.hands = (c, M) => [holdExtension(this.ext, 1.1, c, M)]; // the extension in her aft hand
    this.pose(c, want, k);
    // the sheet's tail, from the ratchet block to her other hand
    { const j = c.hw[0] < c.hw[1] ? 0 : 1, ms = this.mainsheet.geometry.attributes.position; ms.setXYZ(5, c.hand[j].x, c.hand[j].y, c.hand[j].z); ms.needsUpdate = true; }
    this.showLabel(b, showLabel);
  }
}

// ---------- the Optimist ----------
// a 2.31 m pram for one child: a floor flat across with a little rocker, hard chines, topsides flaring a little, an
// upright transom at the stern and a raked one at the bow; no deck, an open GRP shell with its gunwale turned in as an
// inwale and a rubbing strake round it, the mast thwart and its bulkhead across the bow, the midship frame across her
// middle and the daggerboard case in front of it. Three buoyancy bags of 45 litres strapped in, as the class rules have
// them (one across the stern transom, one down each side between the midship frame and the mast thwart), the hiking
// straps along the floor, a bailer on its line. One spritsail laced to an unstayed alloy mast and a low boom, its peak
// spread high above the masthead by the sprit; the kicker, the outhaul, the sprit's snotter; the mainsheet from the
// boom's end down to a block on the floor, up to the boom again, along it and down to the ratchet block (the rules
// allow no traveller or horse). A rudder hung on the transom, its tiller and extension. No jib and no kite (the parts
// the game asks for are there, never shown). One sailor, a child, hiking from the gunwale.
// Her lines are blender/optimist.py's (the same functions there): t = 0 at the stern's gunwale … 1 at the bow's.
const OZ = (() => {
  const L = 2.31, STERN = L / 2, BOW = -STERN;
  const zAt = (t) => STERN - t * L, tAt = (z) => clamp((STERN - z) / L, 0, 1);
  // the gunwale's half-breadth: 0.965 m across the stern, 1.13 m at the midship frame 0.96 m from it, 0.58 m across the
  // bow; the sheer rising 4 cm to the bow; the floor's rocker, 7 cm under the water at its lowest with 90 kg aboard,
  // its foot at the stern just touching the water. The floor flat across (DEAD), the topsides flaring 9° (FLARE), the
  // chine round 10 mm, the stern transom upright and the bow's raked 0.12 m (blender/optimist.py has the sources)
  const TB = 0.42, hb = (t) => (t < TB ? 0.4825 + 0.0825 * Math.sin((t / TB) * Math.PI / 2) : 0.292 + 0.273 * Math.max(0, Math.cos(Math.min(1, (t - TB) / (1 - TB)) * Math.PI / 2)) ** 0.9);
  const sheer = (t) => 0.267 + 0.04 * t ** 2.2 + 0.007 * Math.sin(Math.PI * t);
  const keel = (t) => (t < 0.4 ? -0.072 + 0.06 * ((0.4 - t) / 0.4) ** 2 : -0.072 + 0.115 * ((t - 0.4) / 0.6) ** 1.8);
  const DEAD = 0.003, FLARE = 0.16, CHINE_R = 0.010, K_STERN = STERN, K_BOW = BOW + 0.12;
  const chineY = (t) => keel(t) + DEAD, hc = (t) => hb(t) - FLARE * (sheer(t) - chineY(t));
  // each section leans between its gunwale and its keel: the transoms raked, the rocker one curve into the bow
  const zp = (t, y) => lerp(zAt(t), lerp(K_STERN, K_BOW, t), (sheer(t) - y) / (sheer(t) - keel(t)));
  // the topsides' half-breadth at height y; under the chine, the floor's
  const xAt = (t, y) => (y >= chineY(t) ? hb(t) - FLARE * (sheer(t) - y) : hc(t) * clamp((y - keel(t)) / DEAD, 0, 1));
  // the corner C between the lines from P0 and to P1, turned round radius r: the arc's points
  const fillet = (P0, C, P1, r, n = 4) => {
    let [ax, ay] = [P0[0] - C[0], P0[1] - C[1]], la = Math.hypot(ax, ay); ax /= la; ay /= la;
    let [bx, by] = [P1[0] - C[0], P1[1] - C[1]], lb = Math.hypot(bx, by); bx /= lb; by /= lb;
    const th = Math.acos(clamp(ax * bx + ay * by, -1, 1)), d = r / Math.tan(th / 2), mx = ax + bx, my = ay + by, lm = Math.hypot(mx, my), k = r / Math.sin(th / 2);
    const O = [C[0] + (mx / lm) * k, C[1] + (my / lm) * k];
    let a0 = Math.atan2(C[1] + ay * d - O[1], C[0] + ax * d - O[0]), a1 = Math.atan2(C[1] + by * d - O[1], C[0] + bx * d - O[0]);
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    return Array.from({ length: n + 1 }, (_, i) => [O[0] + r * Math.cos(lerp(a0, a1, i / n)), O[1] + r * Math.sin(lerp(a0, a1, i / n))]);
  };
  // the starboard half of the section at t, gunwale to centreline (the Blender script's section(); inset: the inside
  // skin that much in, floor: and the floor that much up, top: cut off at that height)
  const section = (t, inset = 0, floor = 0, top = null) => {
    const sy = sheer(t), yc = chineY(t) + floor, lean = Math.hypot(1, FLARE);
    let G0 = [hb(t) - inset * lean, sy]; const C0 = [hc(t) - inset * lean, yc + inset * 0.3], K = [0, keel(t) + floor];
    if (top !== null) G0 = [G0[0] + FLARE * (top - sy), top];
    const pts = [G0, ...[1, 2, 3].map((i) => [lerp(G0[0], C0[0], i / 4), lerp(G0[1], C0[1], i / 4)])];
    pts.push(...fillet(G0, C0, K, inset ? CHINE_R * 0.6 : CHINE_R));
    for (let i = 1; i <= 5; i++) pts.push([lerp(C0[0], K[0], i / 5), lerp(C0[1], K[1], i / 5)]);
    return pts;
  };
  // a skin lofted through sections, both halves (band: the depth under the gunwale, for the hull's paint); ends: cap
  // the transoms, flat fans from the middle of each outline
  const loft = (sec, t0 = 0, t1 = 1, ends = false, N = 48) => {
    const pos = [], band = [], idx = [];
    let W = 0;
    for (let i = 0; i <= N; i++) {
      const t = lerp(t0, t1, 0.5 - 0.5 * Math.cos((Math.PI * i) / N)), half = sec(t), ring = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
      W = ring.length;
      for (const [x, y] of ring) { pos.push(x, y, zp(t, y)); band.push(sheer(t) - y); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < W - 1; k++) { const a = i * W + k, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
    if (ends) for (const [r, flip] of [[0, true], [N, false]]) {
      const o = r * W; let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < W; k++) { cx += pos[(o + k) * 3]; cy += pos[(o + k) * 3 + 1]; cz += pos[(o + k) * 3 + 2]; }
      const base = pos.length / 3;
      for (let k = 0; k < W; k++) { pos.push(pos[(o + k) * 3], pos[(o + k) * 3 + 1], pos[(o + k) * 3 + 2]); band.push(1); }
      const ci = pos.length / 3; pos.push(cx / W, cy / W, cz / W); band.push(1);
      for (let k = 0; k < W - 1; k++) flip ? idx.push(ci, base + k + 1, base + k) : idx.push(ci, base + k, base + k + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('band', new THREE.Float32BufferAttribute(band, 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  // a picture on the topsides (side +1 starboard), centred z0 and y0, W × H metres
  const decal = (side, z0, y0, Wd, Hd, material) => {
    const nu = 12, nv = 4, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, z = z0 - side * (u - 0.5) * Wd, y = y0 + (v - 0.5) * Hd;
      pos.push(side * (xAt(tAt(z), y) + 0.006), y, z); uv.push(u, v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.userData.flat = true;
    return m;
  };
  const deckY = (z) => sheer(tAt(z)), hbAt = (z) => hb(tAt(z));
  const hull = { zAt, tAt, xAt, decal, deckY, hbAt, BOW, STERN, geometry: () => loft((t) => section(t), 0, 1, true) };
  const SKIN = 0.012, FLOOR_T = 0.016, FLANGE = 0.045, LIP = 0.022;
  // inside: the floor's height and the topsides' half-breadth at height y, on the inside of the skin
  // (the floor's stations by where its keel is, the sections leaning)
  const floorAt = (z, x = 0) => { const t = clamp((K_STERN - z) / (K_STERN - K_BOW), 0, 1); return keel(t) + FLOOR_T + DEAD * Math.min(1, Math.abs(x) / Math.max(hc(t), 0.1)); };
  const innerX = (z, y) => { const t = tAt(z); return hb(t) - SKIN * Math.hypot(1, FLARE) - FLARE * (sheer(t) - y); };
  // the rig, to the class rules: the mast a 45 mm alloy tube 2.35 m long, stepped 3 cm off the floor 0.29 m aft of the
  // bow's gunwale (11 in, the plans'), raked aft 4° — the 2.83 m from its top to the stern transom's lip the
  // sailmakers' guides give; the boom 2.0 m long, 0.61 m above the water. The sail (3.3 m²): its throat 6 cm under the
  // masthead, lashed there, the luff 1.70 m down the mast to the tack, the foot 1.87 m along the boom, the head 1.25 m
  // up from the throat at 46° to the peak and the leech 2.78 m (the rules: luff 1.73 at most, head 1.24 at least, leech
  // 2.80 at most, throat to clew 2.45–2.58: here 2.50); the sprit, 2.28 m (2.286 at most), from its heel 0.5 m up the
  // luff to the peak, 0.84 m above the masthead
  const MAST_Z = BOW + 0.29, MAST_FOOT = floorAt(MAST_Z) + 0.03, MASTHEAD = MAST_FOOT + 2.35, RAKE = 4 * D2R, BL = 2.0;
  const LUFF = 1.70, LUFF0 = MASTHEAD - 0.06 - LUFF, BOOM_Y = LUFF0 - 0.04, FOOT = 1.87, PEAK = [0.9, LUFF0 + 2.604], SPRIT_Y = LUFF0 + 0.5;
  const THWART_Y = sheer(tAt(MAST_Z + 0.095)) - 0.002; // the mast thwart's top (blender/optimist.py)
  // the daggerboard case's middle and top; the midship frame's aft face and its height over the floor; the mast
  // thwart's bulkhead; the two blocks on the floor, 786 and 894 mm forward of the stern transom's inside face
  const DBZ = -0.015, CASE_TOP = 0.24, MID_Z = STERN - 0.96, MID_H = 0.17, BH_Z = MAST_Z + 0.095 - 0.012;
  const SHEET_Z = STERN - 0.018 - 0.786, RAT_Z = STERN - 0.018 - 0.894;
  // the sail's point at f up its luff (0 at the foot … 1 at the head, the throat to the peak) and u across from the luff
  const luffAt = (f) => [LUFF0 + f * LUFF, 0.035], leechAt = (f) => [lerp(LUFF0, PEAK[1], f), lerp(FOOT, PEAK[0], f)];
  const chord = (f) => { const a = luffAt(f), b = leechAt(f); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  const span = (LUFF + PEAK[1] - LUFF0) / 2; // its height about where its number is, halfway between luff and leech
  const rig = rigOf({ span, chord, numAt: 0.42, flagAt: 0.84, mark: 0.36, head: new THREE.Vector3(0, PEAK[1], MAST_Z + PEAK[0]), tack: new THREE.Vector3(0, LUFF0, MAST_Z), clew: new THREE.Vector3(0, 0, FOOT) });
  rig.numK *= 0.7; // her number some 0.3 m tall, as the class has it: the wide sail would draw it half as tall again
  rig.battens = [[0.68, 0.2], [0.32, 0.2]]; // her two short battens in the leech, the lower 1.9 m down it from the peak
  rig.at = (f, u) => { const a = luffAt(f), b = leechAt(f); return [lerp(a[1], b[1], u), lerp(a[0], b[0], u)]; }; // her cloth's rows climb to the peak: where each point of it lies, [aft, up]
  return { L, hull, section, loft, sheer, keel, hb, zp, SKIN, FLOOR_T, FLANGE, LIP, FLARE, floorAt, innerX, MAST_Z, MAST_FOOT, MASTHEAD, RAKE, BOOM_Y, BL, LUFF0, LUFF, FOOT, PEAK, SPRIT_Y, THWART_Y, DBZ, CASE_TOP, MID_Z, MID_H, BH_Z, SHEET_Z, RAT_Z, luffAt, leechAt, chord, span, rig, K_STERN, K_BOW };
})();
// a soft, blown-up bag: a box of w × h × l, its faces bulging and its edges and corners rounded off
function pillowGeo(w, h, l, puff = 0.55) {
  const g = new THREE.BoxGeometry(2, 2, 2, 8, 6, 10), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = v.clone().normalize().multiplyScalar(Math.sqrt(3) * 0.62);
    v.lerp(s, puff * Math.min(1, s.length() / v.length()));
    p.setXYZ(i, (v.x * w) / 2, (v.y * h) / 2, (v.z * l) / 2);
  }
  g.computeVertexNormals();
  return g;
}
const BAG = new THREE.MeshPhysicalMaterial({ color: '#efeee8', roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.9 }); // PVC
const RUB = new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.7, side: THREE.DoubleSide });

class OptimistView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const add = this.start(), T = this.tilt, H = OZ.hull, O = OZ;
    this.flyY = 0; // no deck to take water over: no wash
    this.lift = 0.1; // high on the water, the lowest of her floor about level with it
    // one colour all over: a dinghy kept ashore on her trolley has no boot-top and no antifouling
    const MOD = OZ_MODEL, hullMat = hullMaterial(look.hull, look.hull, look.hull), skid = deckFinish(look, SKID);
    if (MOD) {
      // the shell, inwale, strake, thwart and case, moulded (blender/optimist.py), in a group of their own so the
      // boat's merging of her small parts (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMat], ['deck', skid], ['gel', GEL2], ['rub', RUB]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else {
      // from her lines in code: the outside, the inside skin (its floor the non-skid's), the inwale's top between them,
      // the thwart and the case as plain boxes, the strake a tube
      add(new THREE.Mesh(H.geometry(), hullMat));
      const t0 = 0.018 / O.L, inSec = (t) => O.section(t, O.SKIN, O.FLOOR_T, O.sheer(t) - 0.004);
      add(new THREE.Mesh(O.loft(inSec, t0, 1 - t0, false), GEL2));
      const floor = O.loft((t) => O.section(t, O.SKIN, O.FLOOR_T + 0.002).slice(8), t0, 1 - t0, false);
      const fp = floor.attributes.position, fuv = new Float32Array(fp.count * 2);
      for (let i = 0; i < fp.count; i++) { fuv[2 * i] = fp.getX(i); fuv[2 * i + 1] = -fp.getZ(i); }
      floor.setAttribute('uv', new THREE.BufferAttribute(fuv, 2)); add(new THREE.Mesh(floor, skid));
      for (const sx of [-1, 1]) {
        const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.004 + (i / 24) * 0.992, y = O.sheer(t) - 0.018; pts.push([sx * (O.hb(t) - O.FLARE * 0.018 + 0.006), y, H.zAt(t)]); }
        T.add(tube(pts, 0.012, RUB));
      }
      const tw = O.innerX(O.MAST_Z, O.THWART_Y);
      add(new THREE.Mesh(new THREE.BoxGeometry(2 * tw, 0.035, 0.19), GEL2), 0, O.THWART_Y - 0.0175, O.MAST_Z);
      const bf = O.floorAt(O.BH_Z), bw = O.innerX(O.BH_Z, (bf + O.THWART_Y) / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(2 * bw, O.THWART_Y - 0.035 - bf, 0.012), GEL2), 0, (bf + O.THWART_Y - 0.035) / 2, O.BH_Z + 0.006);
      const cb = O.floorAt(O.DBZ);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.075, O.CASE_TOP - cb, 0.4), GEL2), 0, (O.CASE_TOP + cb) / 2, O.DBZ);
      const mf = O.floorAt(O.MID_Z), mw = O.innerX(O.MID_Z, mf + O.MID_H / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(2 * mw, O.MID_H, 0.03), GEL2), 0, mf + O.MID_H / 2, O.MID_Z - 0.015);
    }
    // her floor lies under the waterline: a dry lid across her gunwale keeps the sea out of her
    {
      const N = 40, pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const t = i / N, y = O.sheer(t), z = H.zAt(t), x = O.hb(t) + 0.004; pos.push(-x, y, z, x, y, z); }
      for (let i = 0; i < N; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      add(dryLid(pos, idx));
    }
    // the bow's towing eye and the painter's bight on the bow transom's top; the transom's drain bung
    add(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), M.steel), 0, O.sheer(1) - 0.05, O.zp(1, O.sheer(1) - 0.05) - 0.008).rotation.y = Math.PI / 2;
    add(cyl(0.016, 0.016, 0.015, M.dark, 10), 0.22, 0.05, O.zp(0, 0.05) + 0.004).rotation.x = Math.PI / 2 - 0.3;
    // the buoyancy bags, three of 45 litres as the class rules have them, each held down by three webbing straps: one
    // across the whole width of the stern transom, and one high down each side between the midship frame and the mast
    // thwart's bulkhead, lying along the topside as it narrows to the bow
    const strapM = MAT.strap, TS = H.STERN - 0.018; // the stern transom's inside face
    {
      const h = 0.23, l = 0.28, z = TS - l / 2 - 0.004, f0 = O.floorAt(z + l / 2), f1 = O.floorAt(z - l / 2), y = (f0 + f1) / 2 + h / 2 + 0.004;
      const w = 2 * O.innerX(z, y) - 0.03, bag = add(new THREE.Group(), 0, y, z); bag.rotation.x = Math.atan2(f1 - f0, l);
      bag.add(new THREE.Mesh(pillowGeo(w, h, l), BAG));
      for (const sx of [-0.3, 0, 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.045, h * 1.03, l * 0.97), strapM); s.position.x = sx * w / 0.82; s.scale.y = 1; bag.add(s); }
    }
    for (const sx of [-1, 1]) {
      const z0 = O.MID_Z - 0.035, z1 = O.BH_Z - 0.004, l = 0.84, h = 0.26, w = 0.25, z = (z0 + z1) / 2;
      const y = O.sheer(H.tAt(z)) - O.LIP - 0.012 - h / 2, xa = O.innerX(z + l / 2, y) - w / 2 - 0.006, xf = O.innerX(z - l / 2, y) - w / 2 - 0.006;
      const bag = add(new THREE.Group(), sx * (xa + xf) / 2, y, z); bag.rotation.order = 'YXZ';
      bag.rotation.set(0, -sx * Math.atan2(xa - xf, l), -sx * Math.atan(O.FLARE));
      bag.add(new THREE.Mesh(pillowGeo(w, h, l), BAG));
      for (const sz of [-0.3, 0, 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 1.02, 0.045), strapM); s.position.set(-sx * 0.012, 0, sz); bag.add(s); }
    }
    // the painter, 8 m of floating line made fast to the mast's foot, coiled on the floor behind the bulkhead
    { const z = O.BH_Z + 0.16, top = O.floorAt(z, 0.18) + 0.006, rope = new THREE.MeshStandardMaterial({ color: '#e8a33a', roughness: 0.8 });
      for (let i = 0; i < 4; i++) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(0.075 - i * 0.004, 0.006, 5, 18), rope), -0.18 + i * 0.006, top + i * 0.012, z + 0.01 * i); r.rotation.set(Math.PI / 2 + 0.05 * (i - 1.5), 0.1 * i, 0); }
      T.add(tube([[-0.12, top + 0.03, z - 0.04], [-0.06, O.floorAt(O.BH_Z) + 0.08, O.BH_Z], [-0.02, O.MAST_FOOT + 0.04, O.MAST_Z]], 0.006, rope)); }
    // the hiking straps: from the midship frame, either side of the case, aft along the floor to the middle of the
    // stern bag's strap, held up a little by their shock cord
    for (const sx of [-1, 1]) {
      const z0 = O.MID_Z + 0.01, z1 = TS - 0.29;
      // webbing 5 cm wide, a tube flattened to it (laid out about y = 0, then squashed and set down)
      const F = 0.3, y0 = O.floorAt(z0), pts = [[sx * 0.07, 0.06, z0], [sx * 0.13, 0.1, z0 + 0.22], [sx * 0.1, 0.09 + O.floorAt(z1 - 0.22) - y0, z1 - 0.22], [sx * 0.03, 0.06 + O.floorAt(z1) - y0, z1]];
      const st = add(tube(pts.map(([x, y, z]) => [x, y / F, z]), 0.025, strapM), 0, y0, 0); st.scale.y = F;
    }
    // the daggerboard, as the rules have it: a flat board 1067 × 285 × 15 mm, its edges bevelled, down through its case
    // with the stop battens across its head resting on the case's top (some 0.73 m of it under the hull); the shock
    // cord that keeps it down, to the thwart
    const DBZ = O.DBZ, DBT = O.CASE_TOP + 0.035, KB = O.floorAt(DBZ) - O.FLOOR_T, DB0 = KB - 0.01;
    add(new THREE.Mesh(finGeo(DB0 - (DBT - 1.067), 0.285, 0.285, 0.055, 0), MAT.fin), 0, DB0, DBZ - 0.0713); // its quarter chord a quarter forward of the middle
    add(new THREE.Mesh(new THREE.BoxGeometry(0.015, DBT - DB0, 0.285), MAT.fin), 0, (DB0 + DBT) / 2, DBZ);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.285), M.dark), 0, DBT - 0.0175, DBZ); // its stop battens on the case
    T.add(tube([[0, DBT - 0.01, DBZ - 0.1], [0, DBT + 0.05, DBZ - 0.05], [0, DBT + 0.05, DBZ + 0.05], [0, DBT - 0.01, DBZ + 0.1]], 0.007, M.dark)); // its lanyard's loop
    T.add(line([[0, DBT, DBZ - 0.13], [0, O.THWART_Y - 0.01, O.MAST_Z + 0.1]]));
    // the bailer on its line, on the floor behind the bulkhead
    { const z = O.BH_Z + 0.22, x = 0.24, y = O.floorAt(z, x);
      const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.12, 14, 1, true, 0, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: '#3a7bd5', roughness: 0.5, side: THREE.DoubleSide })), x, y + 0.07, z);
      b.rotation.set(Math.PI / 2 - 0.25, -0.6, 0);
      T.add(line([[x - 0.03, y + 0.08, z - 0.05], [0.15, O.floorAt(O.BH_Z + 0.02) + 0.03, O.BH_Z + 0.02], [0.12, O.THWART_Y - 0.03, O.MAST_Z + 0.09]])); }
    // the paddle the class rules have her carry, tied in along the floor to port of the case, forward of the frame
    { const za = O.BH_Z + 0.06, zb = O.MID_Z - 0.06, x = -0.2, ya = O.floorAt(za, x) + 0.02, yb = O.floorAt(zb, x) + 0.02;
      const pm = new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.55 }), pd = add(new THREE.Group(), x, (ya + yb) / 2, (za + zb) / 2);
      pd.rotation.x = Math.atan2(ya - yb, zb - za);
      const L = zb - za, shaft = cyl(0.014, 0.014, L * 0.62, pm, 8); shaft.rotation.x = Math.PI / 2; shaft.position.z = L * 0.19; pd.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, L * 0.36), pm); blade.position.set(0, -0.004, -L * 0.3); pd.add(blade);
      const grip = cyl(0.012, 0.012, 0.1, pm, 8); grip.rotation.z = Math.PI / 2; grip.position.z = L / 2; pd.add(grip);
      T.add(line([[x, ya + 0.02, za + 0.1], [x + 0.03, O.floorAt(za, x) + 0.08, za - 0.02], [-0.03, O.THWART_Y - 0.04, O.MAST_Z + 0.09]])); } // its lanyard
    // the rudder hung on the upright stern transom, its blade 0.5 m below the floor and its head up to the tiller;
    // tiller and blade turning together on the pintles. The tiller 0.7 m and its extension 0.5 m (the rules: each
    // 0.75 m at most, the two 1.2 m)
    const RZ = H.STERN + 0.035, RY = O.sheer(0) + 0.05;
    for (const y of [0.025, 0.235]) { // the gudgeons, standing out from the transom to the rudder's pintles, 0.21 m apart
      const zt = O.zp(0, y), len = RZ - 0.02 - zt;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, len), M.steel), 0, y, zt + len / 2);
    }
    this.wheel = add(new THREE.Group(), 0, 0, RZ);
    const blade = new THREE.Mesh(finGeo(0.62, 0.24, 0.2, 0.09, 0.06), MAT.fin); blade.position.set(0, -0.02, 0.04); this.wheel.add(blade);
    const head = new THREE.Shape(); head.moveTo(-0.02, -0.02); head.lineTo(0.2, -0.02); head.quadraticCurveTo(0.17, 0.2, 0.08, RY + 0.02); head.lineTo(-0.02, RY + 0.02); head.lineTo(-0.02, -0.02);
    const hg = new THREE.ExtrudeGeometry(head, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }).translate(0, 0, -0.012).rotateY(-Math.PI / 2);
    this.wheel.add(new THREE.Mesh(hg, MAT.fin));
    for (const y of [0.025, 0.235]) { const p = cyl(0.006, 0.006, 0.06, M.steel, 6); p.position.set(0, y - 0.02, -0.02); this.wheel.add(p); } // the pintles
    const tl = cyl(0.014, 0.017, 0.7, M.alu, 8); tl.rotation.x = Math.PI / 2 + 0.06; tl.position.set(0, RY + 0.01, -0.37); this.wheel.add(tl);
    const grip = cyl(0.018, 0.018, 0.12, M.dark, 8); grip.rotation.x = Math.PI / 2; grip.position.set(0, RY + 0.01, -0.12); this.wheel.add(grip);
    const uj = cyl(0.012, 0.012, 0.05, M.dark, 8); uj.position.set(0, RY - 0.01, -0.7); this.wheel.add(uj); // the extension's joint
    this.ext = new THREE.Group(); this.ext.position.set(0, RY - 0.01, -0.7); this.ext.rotation.set(0.3, 0, -1.2); this.wheel.add(this.ext); // from its joint to her aft hand
    { const e = cyl(0.009, 0.009, 0.5, M.dark, 6); e.position.y = 0.25; this.ext.add(e); }
    // the mainsheet's two blocks on the floor behind the midship frame, where the rules fix them: the plain block aft,
    // the ratchet block forward, in front of the sailor
    { const fb = new THREE.Group(); fb.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), M.dark));
      for (const [g, mm] of block(0.022)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.035; fb.add(o); }
      this.travCar = add(mergeGroup(fb), 0, O.floorAt(O.SHEET_Z) + 0.006, O.SHEET_Z); }
    this.blockY = O.floorAt(O.SHEET_Z) + 0.05;
    const RAT_Z = O.RAT_Z, rat = new THREE.Group(); rat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 12), M.dark));
    for (const [g, mm] of block(0.026)) { const o = new THREE.Mesh(g, mm); o.position.y = 0.06; rat.add(o); }
    add(mergeGroup(rat), 0, O.floorAt(RAT_Z) + 0.025, RAT_Z);
    this.ratY = O.floorAt(RAT_Z) + 0.1; this.ratZ = RAT_Z;
    // the mast: one alloy tube, unstayed, its heel in the step on the floor and held in the thwart by its clamp
    // (all of it raked aft about the mast's foot: drawn upright in the boat's frame, in a group that leans it)
    const rake = add(new THREE.Group(), 0, O.MAST_FOOT, O.MAST_Z); rake.rotation.x = O.RAKE;
    const rig = new THREE.Group(); rig.position.set(0, -O.MAST_FOOT, -O.MAST_Z); rake.add(rig);
    rake.updateMatrix(); rig.updateMatrix(); this.rigM = new THREE.Matrix4().multiplyMatrices(rake.matrix, rig.matrix);
    const radd = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); rig.add(o); return o; };
    radd(cyl(0.0225, 0.0225, O.MASTHEAD - O.MAST_FOOT, M.alu, 12), 0, (O.MAST_FOOT + O.MASTHEAD) / 2, O.MAST_Z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.034, 0.08), M.dark), 0, O.MAST_FOOT - 0.015, O.MAST_Z); // the step
    radd(cyl(0.032, 0.032, 0.03, M.dark, 12), 0, O.THWART_Y + 0.015, O.MAST_Z); // the clamp
    radd(cyl(0.026, 0.02, 0.03, M.dark, 12), 0, O.MASTHEAD + 0.01, O.MAST_Z); // its cap
    // the boom, the sprit, the kicker, the outhaul, the snotter and the sail's ties, turning with the sail
    this.mainPivot = radd(new THREE.Group(), 0, 0, O.MAST_Z);
    const gear = new THREE.Group();
    const boom = cyl(0.017, 0.017, O.BL, M.alu, 10); boom.rotation.x = Math.PI / 2; boom.position.set(0, O.BOOM_Y, O.BL / 2 + 0.03); gear.add(boom);
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), M.dark).translateY(O.BOOM_Y).translateZ(0.03)); // the jaws round the mast
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.06), M.dark).translateY(O.BOOM_Y + 0.035).translateZ(O.FOOT)); // the clew's strap
    const VB = [0, O.BOOM_Y - 0.03, 0.42], VA = [0, O.THWART_Y + 0.07, 0.04]; // the kicker, mast to boom, its blocks and falls
    for (const p of [VA, VB]) for (const [g, mm] of block(0.015)) { const o = new THREE.Mesh(g, mm); o.position.set(...p); gear.add(o); }
    this.mainPivot.add(line([0, 1, 2, 3].map((i) => { const e = i % 2 ? VB : VA, dx = (i / 3 - 0.5) * 0.025; return [e[0] + dx, e[1], e[2]]; })));
    this.mainPivot.add(line([[0.02, O.BOOM_Y + 0.03, O.FOOT], [0.02, O.BOOM_Y + 0.02, O.BL], [0.02, O.BOOM_Y + 0.02, O.BL - 0.35]])); // the outhaul round the boom's end
    for (const z of [O.BL - 0.06, 0.9]) for (const [g, mm] of block(0.018)) { const o = new THREE.Mesh(g, mm); o.position.set(0, O.BOOM_Y - 0.045, z); gear.add(o); }
    // the sprit from its heel in the snotter on the mast to the peak, a little to port of the sail
    const SX = -0.03, heel = new THREE.Vector3(SX, O.SPRIT_Y, 0.03), peak = new THREE.Vector3(SX, O.PEAK[1], O.PEAK[0]);
    const sp = cyl(0.011, 0.014, heel.distanceTo(peak), M.alu, 8); sp.position.copy(heel).add(peak).multiplyScalar(0.5);
    sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), peak.clone().sub(heel).normalize()); gear.add(sp);
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.04), M.dark).translateX(SX * 0.5).translateY(O.SPRIT_Y).translateZ(0.02)); // the snotter's fitting
    this.mainPivot.add(line([[SX * 0.5, O.SPRIT_Y - 0.01, 0.03], [0.02, O.SPRIT_Y - 0.25, 0.025], [0.025, O.SPRIT_Y - 0.4, 0.025]])); // its line down to the cleat
    // the ties lacing the luff to the mast and the foot to the boom
    const tie = new THREE.TorusGeometry(0.03, 0.0035, 4, 10);
    for (let i = 0; i <= 7; i++) { const o = new THREE.Mesh(tie, M.dark); o.rotation.x = Math.PI / 2; o.scale.set(1, 1.25, 1); o.position.set(0, O.LUFF0 + 0.03 + (i / 7) * (O.LUFF - 0.06), 0.012); gear.add(o); } // its 8 eyelets
    for (let i = 1; i <= 6; i++) { const o = new THREE.Mesh(tie, M.dark); o.rotation.y = Math.PI / 2; o.scale.set(0.9, 1.15, 1); o.position.set(0, O.BOOM_Y + 0.012, (i / 7) * O.FOOT); gear.add(o); }
    this.mainPivot.add(mergeGroup(gear));
    // the sail: the number and the marks above it
    this.main = sailMesh(24, 16, sailTexture('main', look, OZ.rig), look.laminate, 'main'); this.mainPivot.add(this.main);
    this.spritX = SX;
    // the telltales near the luff
    if (player) for (const [f, sx] of [[0.35, 1], [0.35, -1], [0.65, 1], [0.65, -1]]) {
      const tt = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.2).translate(0, -0.1, 0), new THREE.MeshBasicMaterial({ color: '#2ecc71', side: THREE.DoubleSide }));
      tt.userData = { f, sx }; this.mainPivot.add(tt); this.tells.push(tt);
    }
    // the mainsheet: made fast at the boom's end, down to the block on the floor, up to the block at the boom's end,
    // along the boom to its middle block and down to the ratchet
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    // no jib and no kite: the parts the game asks for, never shown
    const none = sailTexture('kite', look);
    this.jib = sailMesh(2, 2, none, false, 'jib'); this.jib.visible = false;
    this.kite = sailMesh(2, 2, none, false, 'kite'); this.kite.visible = false;
    this.sprit = new THREE.Group(); this.kiteSheet = new THREE.Group(); this.lazySheet = new THREE.Group(); this.jibSheet = new THREE.Group();
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 0.55, O.sheer(0.76) - 0.1, 0.3, 0.11));
    { const z = H.STERN - 0.4; for (const d of nameDecal(H, look, z, O.sheer(H.tAt(z)) - 0.07, 0.34)) T.add(d); }
    this.windex = windex(add, O.MASTHEAD + 0.02, O.MAST_Z);
    this.windex.scale.setScalar(0.6); rig.add(this.windex); // on the raked masthead
    // her one sailor, a child: drawn at the crew's figure, four-fifths their size
    const m = crewMats(look), s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[1], roughness: 0.65 }) });
    const kid = new THREE.Group(); s.g.scale.setScalar(0.78); kid.add(s.g); T.add(kid);
    const z0 = 0.62;
    this.crew = [{ g: kid, s, z0, i: 0, x: 0, y: O.sheer(H.tAt(z0)), z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5, trackHands: true }];
    this.eye = [0.62, 0.8, 0.62]; // the helm view: her head as she hikes
    this.finish(label, 4.2);
  }
  // the sail's surface at (f, u): between luff and leech, bellied to leeward; the sprit, on the sail's port side, holds
  // the cloth back where the sail fills to port, the crease it makes along it
  sailPoint(f, u, t, v) {
    const O = OZ, sc = this.cloth, ss = this.sailSide, a = O.luffAt(f), b = O.leechAt(f), ch = O.chord(f);
    const y = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
    const belly = -ss * (1 - sc.flogM * 0.85) * Math.sin(Math.PI * u ** 0.75) * ch * 0.12 * sc.depth * (1 - 0.3 * f);
    let x = belly - ss * f * f * 0.25 * u * sc.twist + mainCloth(sc, f, u, ch, ss) + leechFlutter(f, u, sc);
    // the sprit's tension shows as a soft wrinkle from the throat towards the clew, as the sailmakers set it
    { const ty = O.LUFF0 + O.LUFF, tz = 0.035, ey = O.LUFF0 - ty, ez = O.FOOT - tz, q = clamp(((y - ty) * ey + (z - tz) * ez) / (ey * ey + ez * ez), 0, 1);
      const dw = Math.hypot(y - ty - q * ey, z - tz - q * ez); x += ss * 0.014 * sc.depth * Math.exp(-((dw / 0.045) ** 2)) * Math.sin(Math.PI * Math.min(1, q * 1.4)); }
    const hy = O.SPRIT_Y, hz = 0.03, dy = O.PEAK[1] - hy, dz = O.PEAK[0] - hz, k = clamp(((y - hy) * dy + (z - hz) * dz) / (dy * dy + dz * dz), 0, 1);
    const d = Math.hypot(y - hy - k * dy, z - hz - k * dz), w = Math.exp(-((d / 0.2) ** 2));
    x += w * Math.max(0, this.spritX + 0.03 - x); // pressed out to the sprit's side of it, the cloth easing back either side
    return v.set(x, y, z);
  }
  update(b, t, W, showLabel) {
    const O = OZ, H = O.hull, side = this.place(b, t, W);
    this.wheel.rotation.y = b.rudder * 0.5;
    this.mainPivot.rotation.y = -this.sailSide * b.sail * D2R;
    setSail(this.main, (f, u, v) => this.sailPoint(f, u, t, v));
    // the sheet: boom end → the block on the floor → the boom end's block → the middle block → the ratchet
    this.mainPivot.updateMatrix();
    const pv = new THREE.Vector3(), at = (z, dy) => pv.set(0, O.BOOM_Y - dy, z).applyMatrix4(this.mainPivot.matrix).applyMatrix4(this.rigM).toArray(); // a point on the boom, in the boat's frame
    const ms = this.mainsheet.geometry.attributes.position;
    [at(O.BL - 0.03, 0.03), [0, this.blockY, O.SHEET_Z], at(O.BL - 0.06, 0.06), at(0.9, 0.06), [0, this.ratY, this.ratZ]].forEach((p, i) => ms.setXYZ(i, ...p));
    ms.needsUpdate = true;
    this.windex.rotation.y = -b.awa;
    const v = new THREE.Vector3();
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side;
      this.sailPoint(f, 0.3 / O.chord(f), t, v); tt.position.set(v.x + sx * 0.015, v.y, v.z);
      let rot = Math.PI / 2 + Math.sin(t * 9 + f * 10) * 0.12, ok = true;
      if (b.trim === 'in' && windward) { rot = Math.PI / 2 + 1.0 + Math.sin(t * 13) * 0.5; ok = false; }
      if (b.trim === 'out' && !windward) { rot = 0.25 + Math.sin(t * 5 + f) * 0.2; ok = false; }
      if (b.trim === 'irons') { rot = Math.sin(t * 15 + f * 3) * 1.4; ok = false; }
      tt.rotation.x = -rot;
      tt.material.color.set(ok ? '#2ecc71' : '#ff4d3d');
    }
    // the sailor: upwind sat on the windward gunwale, feet under the strap, leaning out over the water the harder it
    // blows; in light air and off the wind sat further in on it, leaning in, ducking under the boom in a gybe; working
    // the boat through the waves, back as the bow rises and forward as it drops
    const k = this.crewDt(t), up = Math.abs(b.twa) < 100 * D2R, c = this.crew[0];
    const out = clamp(((b.aws || 8) - 5) / 8, 0, 1) * clamp(b.heel / 8, 0.3, 1), pitch = this.tilt.rotation.x;
    const z = c.z0 + (up ? 0 : 0.12), hb = H.hbAt(z), y = O.sheer(H.tAt(z)) + 0.02, work = clamp(pitch * 2.5, -0.15, 0.15);
    const want = up
      ? { x: side * lerp(hb - 0.07, hb + 0.04, out), y, z, yaw: Math.PI - lerp(0.75, 0.5, out), lean: lerp(0.3, -0.9, out) - work, stand: 0, knee: lerp(-1.25, -0.55, out), reach: lerp(0.7, 0.35, out) }
      : { x: side * (hb - 0.08), y, z, yaw: Math.PI - 0.7, lean: 0.2 - work, stand: 0, knee: -1.3, reach: 0.6 };
    want.hands = (c, M) => [holdExtension(this.ext, 0.5, c, M)]; // the extension in her aft hand
    this.pose(c, want, k);
    // the sheet's tail, from the ratchet block to her other hand
    { const j = c.hw[0] < c.hw[1] ? 0 : 1, ms = this.mainsheet.geometry.attributes.position; ms.setXYZ(5, c.hand[j].x, c.hand[j].y, c.hand[j].z); ms.needsUpdate = true; }
    this.showLabel(b, showLabel);
  }
}

// ---------- the Bavaria 46 ----------
// the Farr-designed Cruiser 46 (2014), to Bavaria's figures: a 13.60 m hull (14.27 m over her bow roller and sprit),
// 4.35 m beam. High topsides with a chine aft, a dark stripe along them and four small hull windows a side; a long
// coachroof from 2.4 m aft of the stem, its nose sloping down into the foredeck, a long window down each side and
// hatches on top, its sides running on aft as the high coamings round a short cockpit with a table between two wheels,
// the bathing platform closing the transom. A deck-stepped alloy mast (I 18.0, J 5.51, P 17.19, E 5.55 m) with two
// sets of swept spreaders and a split backstay, a main furled inside it, a furling genoa and a cruising gennaker
// tacked to a short sprit at the bow. Five crew: the helm, two trimmers and two on the windward side deck.
const BV = (() => {
  const L = 13.6, B = 4.35;
  const hull = hullOf({
    L, flare: 0.05,
    hb: (t) => (B / 2) * (t < 0.42 ? 0.9 + 0.1 * Math.sin((t / 0.42) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.42) / 0.58) * Math.PI / 2)) ** 0.72),
    sheer: (t) => 1.26 + 0.26 * t ** 1.5,
    depth: (t) => 0.74 * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)) ** 0.7,
    n: (t) => lerp(2.7, 1.9, clamp((t - 0.4) / 0.6, 0, 1)),
    chine: { y: (t) => 0.42 - 0.55 * t, w: (t) => 1 - smooth(0.3, 0.7, t), dead: (t) => lerp(16, 12, clamp(t / 0.35, 0, 1)), flat: 0.85 },
  });
  // the coachroof (blender/bavaria46.py): its nose on the deck, its aft end at the companionway (the cockpit's front),
  // its half-width and height, the length of its rounded nose; the coamings' height above the deck and where they end
  const COACH = { zf: -4.4, za: 3.1, w: 1.55, h: 0.5, nose: 2.3, coam: 0.32, end: 5.8 };
  const MAST_Z = hull.BOW + 5.65;
  const coachY = hull.deckY(MAST_Z) - 0.03, ROOF = coachY + COACH.h + 0.04;
  const MAST_FOOT = ROOF, MASTHEAD = 21.1, HOUNDS = hull.deckY(MAST_Z) + 18.0, BOOM_Y = MASTHEAD - 0.45 - 17.19, BL = 5.75, SHEET_Z = 3.0; // a 7/8 rig; the mainsheet's tackles on the boom this far aft of the mast
  const SPR = [[7.9, 1.05], [14.1, 0.72]]; // the spreaders: height, and how far out to their tips
  const chord = (f) => lerp(5.3, 0.45, f) - 0.15 * Math.sin(Math.PI * f); // furled into the mast: no battens, so no roach, the leech a little hollow (47 m²)
  const TACK = new THREE.Vector3(0, hull.deckY(hull.BOW) + 0.25, MAST_Z - 0.16 - 5.51); // J: from the mast's front to the forestay at the stem
  const HEAD = new THREE.Vector3(0, HOUNDS - 0.35, MAST_Z - 0.12);
  const CLEW = new THREE.Vector3(0, 0.6, 5.8); // from the tack: a 106% genoa, its clew just aft of the mast
  const SPRIT = new THREE.Vector3(0, hull.deckY(hull.BOW) + 0.2, hull.BOW - 0.45);
  const FLOOR = hull.deckY(4.5) - 0.49, CK = [COACH.za, 1.13], HELM = [5.35, 1.42], PLAT = 1.0; // the cockpit: its sole, where it starts and its half-width; where it widens for the wheels, and to what; the bathing platform's half-width
  // the logo and the flag 1.2 m wide: the furling main's head is narrow (1.5 m across where the logo goes), and her
  // number is small on it
  const rig = rigOf({ span: MASTHEAD - 0.45 - BOOM_Y, chord, numAt: 0.6, flagAt: 0.88, mark: 1.2, head: HEAD, tack: TACK, clew: CLEW });
  return { L, B, hull, COACH, coachY, ROOF, SHEET_Z, MAST_Z, MAST_FOOT, MASTHEAD, HOUNDS, BOOM_Y, BL, SPR, chord, TACK, HEAD, CLEW, SPRIT, FLOOR, CK, HELM, PLAT, rig, WHEEL_Z: 5.95, WHEEL_X: 0.88, WINCH_Z: 4.9, WINCH_X: 1.34, FEET_Z: MAST_Z + 2.95 };
})();
const coamY = (z) => BV.hull.deckY(z) + BV.COACH.coam + 0.035; // the coamings' top, where the primary winches stand
// her moulded parts, modelled in Blender on the lines above (blender/bavaria46.py → bavaria46.glb): the hull with its
// rounded deck edge, the deck, the coachroof with its windows, the cockpit cut through the transom, its benches and
// coamings; by material name. Asked for only on a page that will build her (her races, her boat page, the fleet), by
// the address the import map gives it (its hash after a deploy, as yacht.js's yacht.glb); if it doesn't come in 8 s,
// she is built from the lines in code instead.
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
const ON_FLEET = /fleet-view/.test(globalThis.location?.pathname || ''); // the fleet page: every yacht's moulded parts are loaded
// a class's moulded parts from its file: the meshes by material name, the hull's paint bands (its depth under the
// sheer, on the class's own lines) and the plan-in-metres UVs of the parts that take a texture; null if the file doesn't
// come in 8 s, and the class is built from its lines in code instead
function loadModel(file, hull, uvs) {
  return new Promise((res) => {
    const done = (v) => { clearTimeout(timer); res(v); }, timer = setTimeout(() => res(null), 8000);
    new GLTFLoader().load(fileAt(file), (g) => {
      const parts = {};
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => { if (o.isMesh) parts[o.material.name] = o.geometry.clone().applyMatrix4(o.matrixWorld); });
      const p = parts.hull?.attributes.position;
      if (!p || !parts.deck) return done(null);
      const band = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) band[i] = hull.deckY(p.getZ(i)) - p.getY(i);
      parts.hull.setAttribute('band', new THREE.BufferAttribute(band, 1));
      for (const [k, sc] of uvs) {
        const g2 = parts[k]; if (!g2) continue;
        const q = g2.attributes.position, uv = new Float32Array(q.count * 2);
        for (let i = 0; i < q.count; i++) { uv[2 * i] = q.getX(i) * sc; uv[2 * i + 1] = -q.getZ(i) * sc; }
        g2.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      done(parts);
    }, undefined, () => done(null));
  });
}

class CruiserView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const add = this.start(), T = this.tilt, H = BV.hull, C = BV.COACH, [ckz, ckx] = BV.CK;
    this.washH = H;
    this.flyY = 0;
    // her side decks and foredeck teak, as the real boat's are, the coachroof's and the coamings' tops white non-skid;
    // a player who asked for the deck in the hull's colour has it on both
    const MOD = BV_MODEL, own = look.deck === 'hull', skid = deckFinish(own ? look : { deck: 'teak' }, SKID), roof = own ? skid : SKID;
    if (MOD) {
      // the moulded parts, from the Blender model: in a group of their own, so the boat's merging of her small parts
      // (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', hullMaterial(look.hull, look.stripe, look.bottom)], ['deck', skid], ['roof', roof], ['gel', M.gel], ['teak', M.teak], ['glass', MAT.pane]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else add(new THREE.Mesh(H.geometry(), hullMaterial(look.hull, look.stripe, look.bottom)));
    // the hull windows, small, flush and dark, four a side: one forward, a pair amidships and one aft; the dark stripe
    // along the topsides over them
    const pane = MAT.pane;
    for (const sx of [-1, 1]) for (const z of [-3.2, 0.2, 1.08, 3.75]) T.add(H.decal(sx, z, H.deckY(z) - 0.5, 0.62, 0.16, pane));
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 20; i++) { const z = lerp(H.STERN - 0.12, H.BOW + 3.15, i / 20), y = H.deckY(z) - 0.4; pts.push([sx * (H.xAt(H.tAt(z), y) + 0.004), y, z]); }
      T.add(tube(pts, 0.012, M.dark));
    }
    // the deck with the cockpit cut out of it, open to the transom: a teak sole, the walls its seats' fronts
    if (!MOD) {
      const sole = deckFinish({ deck: 'teak' }, SKID), ck = H.tub(-ckx, ckz, ckx, H.STERN, 0.3, BV.FLOOR, { slope: 0.05, crown: 0.06, openAft: true });
      add(new THREE.Mesh(H.deck([], 0.06, ck.outline), skid));
      const walls = add(new THREE.Mesh(ck.walls, GEL2)); walls.userData.detail = false;
      add(new THREE.Mesh(ck.floor, sole));
      T.add(H.border(0.12, GEL2, 0.06));
    }
    // the bathing platform, folded up: it closes the transom between the helms' seats, teak on its face, its hinge
    // and the swimming ladder stowed on it
    const PH = H.deckY(H.STERN) - BV.FLOOR + 0.02, PY = (H.deckY(H.STERN) + BV.FLOOR) / 2, px = BV.PLAT;
    add(new THREE.Mesh(new THREE.BoxGeometry(px * 2, PH, 0.06), GEL2), 0, PY, H.STERN - 0.04);
    add(new THREE.Mesh(new THREE.BoxGeometry(px * 2 - 0.24, PH - 0.12, 0.02), M.teak), 0, PY, H.STERN - 0.08);
    add(cyl(0.025, 0.025, px * 2 - 0.14, M.steel, 8), 0, BV.FLOOR + 0.02, H.STERN - 0.04).rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) T.add(tube([[sx * 0.2, BV.FLOOR + 0.1, H.STERN - 0.12], [sx * 0.2, BV.FLOOR + 0.55, H.STERN - 0.12], [sx * 0.17, BV.FLOOR + 0.6, H.STERN - 0.12]], 0.014, M.steel));
    for (const y of [0.22, 0.38]) add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.06), M.steel), 0, BV.FLOOR + y, H.STERN - 0.12);
    // outside, the platform's outline in the transom, its hinges at the foot and the grab handle at its top
    { const zo = H.STERN + 0.004, x0 = px - 0.03, y0 = BV.FLOOR - 0.02, y1 = H.deckY(H.STERN) - 0.03;
      T.add(line([[-x0, y0, zo], [x0, y0, zo], [x0, y1, zo], [-x0, y1, zo], [-x0, y0, zo]]));
      for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), M.steel), sx * (x0 - 0.35), y0 + 0.02, zo);
      T.add(tube([[-0.25, y1 - 0.05, zo], [-0.22, y1 - 0.05, zo + 0.05], [0.22, y1 - 0.05, zo + 0.05], [0.25, y1 - 0.05, zo]], 0.012, M.steel)); }
    // the seats down both sides, bare teak on gelcoat as hers are, the coamings outboard of them with the primary winches on top; the
    // helms' seats outboard aft, either side of the bathing platform; the table between the seats, its leaves folded,
    // its grab rail over it
    const [hz, hx] = BV.HELM, benchZ = (ckz + 0.2 + hz - 0.15) / 2, benchL = hz - 0.15 - ckz - 0.2;
    if (!MOD) for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.39, benchL), GEL2), sx * (ckx - 0.24), BV.FLOOR + 0.195, benchZ);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, benchL), M.teak), sx * (ckx - 0.24), BV.FLOOR + 0.405, benchZ);
      add(new THREE.Mesh(new THREE.BoxGeometry(hx - 1.0, 0.47, 0.56), GEL2), sx * (hx + 1.0) / 2, BV.FLOOR + 0.235, H.STERN - 0.34);
      add(new THREE.Mesh(new THREE.BoxGeometry(hx - 0.98, 0.035, 0.58), M.teak), sx * (hx + 1.0) / 2, BV.FLOOR + 0.485, H.STERN - 0.34);
      add(new THREE.Mesh(new THREE.BoxGeometry(BV.COACH.w - ckx, BV.COACH.coam, BV.COACH.end - ckz), GEL2), sx * (BV.COACH.w + ckx) / 2, H.deckY(4.5) + BV.COACH.coam / 2 + 0.03, (ckz + BV.COACH.end) / 2);
    }
    const tz = ckz + 1.05;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 1.1), GEL2), 0, BV.FLOOR + 0.33, tz);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 1.3), M.teak), 0, BV.FLOOR + 0.69, tz);
    for (const sx of [-1, 1]) { const leaf = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 1.26), M.teak), sx * 0.33, BV.FLOOR + 0.5, tz); leaf.rotation.z = sx * 0.06; }
    T.add(tube([[0, BV.FLOOR + 0.7, tz - 0.65], [0, BV.FLOOR + 1.02, tz - 0.55], [0, BV.FLOOR + 1.02, tz + 0.55], [0, BV.FLOOR + 0.7, tz + 0.65]], 0.018, M.steel));
    // the two wheels on their pedestals: each with its binnacle, a compass under its dome and a display tilted to
    // the helm, the guard rail round it; they turn with the helm
    this.wheel = add(new THREE.Group(), 0, 0, 0);
    for (const sx of [-1, 1]) {
      const wx = sx * BV.WHEEL_X, ax = BV.FLOOR + 0.88, pz = BV.WHEEL_Z - 0.2;
      const w = wheel(0.52, 6, M.dark, M.steel); w.position.set(wx, ax, BV.WHEEL_Z); this.wheel.add(w);
      add(cyl(0.055, 0.08, ax - 0.1 - BV.FLOOR, M.dark, 10), wx, (BV.FLOOR + ax - 0.1) / 2, pz);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.2), M.dark), wx, ax, pz);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass), wx, ax + 0.1, pz - 0.03);
      fit(add, display(0.2, 0.14, sx < 0 ? 1 : 3), wx, ax + 0.07, pz + 0.1, 0, -0.75);
      add(cyl(0.02, 0.02, 0.2, M.steel, 8), wx, ax, pz + 0.12).rotation.x = Math.PI / 2; // the axle
      T.add(tube([[wx - 0.2, BV.FLOOR, pz - 0.16], [wx - 0.2, ax + 0.16, pz - 0.16], [wx - 0.16, ax + 0.25, pz - 0.12], [wx + 0.16, ax + 0.25, pz - 0.12], [wx + 0.2, ax + 0.16, pz - 0.16], [wx + 0.2, BV.FLOOR, pz - 0.16]], 0.015, M.steel));
    }
    // the coachroof: a long deckhouse, its nose sloping down into the foredeck, its sides leaning in, its top in
    // non-skid; a long dark window down each side; hatches along the top, teak handrails either side of them, the
    // companionway's sliding hatch aft
    const za = C.za;
    const quad = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); const m = new THREE.Mesh(g, pane); m.userData.flat = true; return m; };
    if (!MOD) { // without the model: its plan, a rounded nose and straight sides, extruded and leaning in
      const halfW = (z) => Math.min(C.w * (1 - (1 - clamp((z - C.zf) / C.nose, 0, 1)) ** 2) ** 0.4, H.hbAt(z) - 0.48);
      const cs = new THREE.Shape(), n = 16;
      for (let i = 0; i <= n; i++) { const z = lerp(za, C.zf, i / n); cs[i ? 'lineTo' : 'moveTo'](halfW(z), -z); }
      for (let i = n; i >= 0; i--) { const z = lerp(za, C.zf, i / n); cs.lineTo(-halfW(z), -z); }
      const cg = new THREE.ExtrudeGeometry(cs, { depth: C.h, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8 });
      cg.rotateX(-Math.PI / 2);
      { const q = cg.attributes.position; for (let i = 0; i < q.count; i++) q.setX(i, q.getX(i) * (1 - 0.08 * clamp(q.getY(i) / C.h, 0, 1.1))); cg.computeVertexNormals(); }
      add(new THREE.Mesh(cg, M.gel), 0, BV.coachY, 0);
      const top = new THREE.ShapeGeometry(cs, 8).rotateX(-Math.PI / 2).scale(0.88, 1, 0.97);
      add(new THREE.Mesh(top, roof), 0, BV.ROOF + 0.005, 0.03);
      for (const sx of [-1, 1]) { const P = (z, y) => [sx * (halfW(z) * (1 - 0.08 * y / C.h) + 0.06), BV.coachY + y, z]; T.add(quad([P(1.6, 0.16), P(-2.3, 0.16), P(-2.3, 0.38), P(1.6, 0.38)])); }
    }
    for (const [z, s] of [[-2.55, 0.68], [-1.85, 0.5], [-0.45, 0.42], [0.05, 0.42], [0.55, 0.42]]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(s - 0.1, 0.035, s - 0.1), M.glass), 0, BV.ROOF + 0.035, z);
      add(new THREE.Mesh(new THREE.BoxGeometry(s, 0.03, s), M.alu), 0, BV.ROOF + 0.025, z);
    }
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), M.glass), sx * 0.9, BV.ROOF + 0.025, 1.35);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.42), M.alu), sx * 0.9, BV.ROOF + 0.015, 1.35);
    }
    for (const sx of [-1, 1]) T.add(tube([[sx * 0.62, BV.ROOF, 1.75], [sx * 0.62, BV.ROOF + 0.07, 1.6], [sx * 0.6, BV.ROOF + 0.07, -1.9], [sx * 0.58, BV.ROOF, -2.05]], 0.02, M.teak));
    add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.8), M.glass), 0, BV.ROOF + 0.04, za - 0.45);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.95), M.alu), sx * 0.39, BV.ROOF + 0.025, za - 0.47);
    { const y0 = BV.FLOOR + 0.5, y1 = BV.ROOF - 0.04; // the washboard, in the companionway at the cockpit's front
      add(new THREE.Mesh(new THREE.BoxGeometry(0.66, y1 - y0 - 0.1, 0.04), M.glass), 0, (y0 + y1) / 2, za + 0.06);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.76, y1 - y0, 0.03), M.alu), 0, (y0 + y1) / 2, za + 0.052); }
    // the halyards and reefing lines: down the front of the mast to the turning blocks at its foot, aft along the
    // coachroof through the clutches to the winches beside the companionway
    for (const sx of [-1, 1]) {
      fit(add, block(0.03), sx * 0.15, BV.ROOF + 0.04, BV.MAST_Z + 0.02, sx * 0.5);
      for (let k = 0; k < 3; k++) { const x = sx * (0.48 + k * 0.07); T.add(line([[sx * 0.14, BV.ROOF + 0.05, BV.MAST_Z + 0.05], [x, BV.ROOF + 0.05, 1.75], [x, BV.ROOF + 0.05, 2.0], [sx * 0.85, BV.ROOF + 0.06, 2.45]])); }
    }
    // two mushroom vents on the foredeck
    for (const sx of [-1, 1]) { const z = BV.COACH.zf - 0.45; add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 16), M.steel), sx * 0.45, H.deckY(z) + 0.03, z); }
    // the stemhead: the anchor in its roller, the genoa's furling drum, the sprit for the gennaker
    // the bow roller's fitting over the stem, the anchor's shank in it and its plough hanging under the roller, the
    // windlass on the foredeck with the chain going down into it, and the anchor locker's lid
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.75), M.steel), 0, H.deckY(H.BOW) + 0.05, H.BOW + 0.08);
    add(cyl(0.05, 0.05, 0.12, M.dark, 10), 0, H.deckY(H.BOW) + 0.06, H.BOW - 0.25).rotation.z = Math.PI / 2;
    { const sy = H.deckY(H.BOW) + 0.11, sh = add(cyl(0.022, 0.022, 0.6, M.steel, 6), 0, sy, H.BOW + 0.02); sh.rotation.x = Math.PI / 2 - 0.15; // the shank over the roller
      const fluke = mergeGeometries([new THREE.ConeGeometry(0.14, 0.3, 4).scale(1, 1, 0.3).rotateY(Math.PI / 4), new THREE.ConeGeometry(0.14, 0.3, 4).scale(0.3, 1, 1).rotateY(Math.PI / 4)]);
      const f = add(new THREE.Mesh(fluke, M.steel), 0, sy - 0.2, H.BOW - 0.3); f.rotation.x = Math.PI - 0.5; } // the plough, hanging under it
    const wz = H.BOW + 0.95;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), M.steel), 0, H.deckY(wz) + 0.08, wz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 14).rotateZ(Math.PI / 2), M.steel), 0, H.deckY(wz) + 0.12, wz);
    T.add(line([[0, H.deckY(H.BOW) + 0.1, H.BOW - 0.1], [0, H.deckY(wz) + 0.14, wz - 0.06]]));
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.03, 0.7), GEL2), 0, H.deckY(wz + 0.75) + 0.02, wz + 0.75);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), M.steel), 0, H.deckY(wz + 1.08) + 0.04, wz + 1.08);
    add(cyl(0.12, 0.12, 0.2, M.alu, 14), BV.TACK.x, BV.TACK.y - 0.12, BV.TACK.z);
    this.sprit = add(cyl(0.03, 0.04, 0.8, M.steel, 8), 0, BV.SPRIT.y, H.BOW - 0.22); this.sprit.rotation.x = Math.PI / 2;
    // the keel, a fin with a bulb at its foot (2.18 m down), its leading edge 5.6 m aft of the stem; the spade rudder
    // well aft, under the cockpit
    add(new THREE.Mesh(finGeo(1.5, 1.55, 0.95, 0.12, 0.3), MAT.fin), 0, -0.5, H.BOW + 6.15);
    add(new THREE.Mesh(bulbGeo(2.4, 0.27), MAT.lead), 0, -1.92, H.BOW + 6.45);
    add(new THREE.Mesh(finGeo(1.3, 0.62, 0.42, 0.12, 0.12), MAT.fin), 0, -0.12, H.STERN - 0.85);
    // toe rails, the pulpit, the pushpit, the stanchions and two lifelines a side
    const rail = M.alu;
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = 0.02 + (i / 24) * 0.95; pts.push([sx * (H.hbAt(H.zAt(t)) - 0.02), H.deckY(H.zAt(t)) + 0.03, H.zAt(t)]); }
      T.add(tube(pts, 0.025, rail));
      const hb = (z) => Math.max(0.1, H.hbAt(z) - 0.08), zp = H.BOW + 1.0, zs = H.STERN - 0.25;
      T.add(tube([[sx * hb(zp), H.deckY(zp), zp], [sx * hb(zp), H.deckY(zp) + 0.72, zp], [sx * 0.2, H.deckY(H.BOW + 0.3) + 0.72, H.BOW + 0.3], [sx * 0.1, H.deckY(H.BOW + 0.3), H.BOW + 0.3]], 0.016, M.steel));
      T.add(tube([[sx * hb(zs - 1.2), H.deckY(zs - 1.2), zs - 1.2], [sx * hb(zs - 1.2), H.deckY(zs - 1.2) + 0.72, zs - 1.2], [sx * hb(zs), H.deckY(zs) + 0.72, zs], [sx * (hx + 0.14), H.deckY(zs) + 0.72, zs], [sx * (hx + 0.14), H.deckY(zs), zs]], 0.016, M.steel));
      const posts = [0.24, 0.36, 0.48, 0.6, 0.72].map((t) => H.zAt(t));
      for (const z of posts) add(cyl(0.012, 0.014, 0.7, M.steel, 6), sx * hb(z), H.deckY(z) + 0.35, z);
      for (const y of [0.4, 0.7]) T.add(line([[sx * hb(zp), H.deckY(zp) + y, zp], ...posts.slice().reverse().map((z) => [sx * hb(z), H.deckY(z) + y, z]), [sx * hb(zs - 1.2), H.deckY(zs - 1.2) + y, zs - 1.2]]));
      // the genoa's track and car on the side deck, the primary winch on the coaming by the wheel, the halyard winch
      // and the clutches on the coachroof beside the companionway
      const gz = BV.MAST_Z + 1.4, gx = H.hbAt(gz) - 0.4;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.6), M.alu), sx * gx, H.deckY(gz) + 0.01, gz);
      fit(add, block(0.04), sx * gx, H.deckY(gz) + 0.07, gz);
      fit(add, winch(0.09, 0.22), sx * BV.WINCH_X, coamY(BV.WINCH_Z), BV.WINCH_Z); // on the coaming
      fit(add, winch(0.07, 0.18), sx * 0.85, BV.ROOF, 2.5);
      fit(add, clutches(3, 0.07), sx * 0.55, BV.ROOF + 0.005, 2.1);
      // the shrouds' chainplates on the side deck
      fit(add, chainplate([sx * (H.hbAt(BV.MAST_Z + 0.4) - 0.3), H.deckY(BV.MAST_Z + 0.4) + 0.02, BV.MAST_Z + 0.4], [sx * BV.SPR[0][1], BV.SPR[0][0], BV.MAST_Z + 0.35], 0.3, 0.016));
      // the navigation lights on the pulpit
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), sx > 0 ? MAT.green : MAT.red), sx * 0.2, H.deckY(H.BOW + 0.3) + 0.76, H.BOW + 0.3);
      // mooring cleats at the bow, amidships and on the quarters, on the deck's edge inside the toe rail
      for (const z of [H.BOW + 0.7, -0.6, H.STERN - 0.5]) fit(add, cleat(0.26), sx * (H.hbAt(z) - 0.2), H.deckY(z) + 0.01, z);
    }
    // the genoa's furling line, from the drum aft along the stanchions' feet to a clutch by the starboard winch
    { const fz = BV.WINCH_Z - 0.6, fy = coamY(fz);
      T.add(line([[0.1, BV.TACK.y - 0.12, BV.TACK.z], [H.hbAt(H.zAt(0.72)) - 0.16, H.deckY(H.zAt(0.72)) + 0.05, H.zAt(0.72)], ...[0.6, 0.48, 0.36].map((t) => [H.hbAt(H.zAt(t)) - 0.16, H.deckY(H.zAt(t)) + 0.05, H.zAt(t)]), [BV.WINCH_X, fy + 0.01, fz]]));
      fit(add, clutches(1, 0.07), BV.WINCH_X, fy, fz); }
    // on the pushpit: a horseshoe buoy in its holder to port, the GPS and VHF antennas to starboard
    { const zs = H.STERN - 0.25, y = H.deckY(zs) + 0.72, x = 1.25;
      const buoy = MAT.buoy;
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 20, Math.PI * 1.6), buoy), -x - 0.25, y - 0.12, zs + 0.06); ring.rotation.z = Math.PI / 2 + 0.95;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), M.gel), x + 0.25, y + 0.1, zs);
      add(cyl(0.012, 0.012, 0.12, M.steel, 6), x + 0.25, y + 0.03, zs);
      add(cyl(0.006, 0.01, 1.2, M.dark, 6), x + 0.45, y + 0.6, zs); }
    // the rig: the alloy mast on the coachroof, two sets of swept spreaders, the shrouds, the forestay to the furler
    // and the split backstay round the bathing platform
    add(new THREE.Mesh(mastGeo(BV.MASTHEAD - BV.MAST_FOOT, 0.32, 0.17, 0.2, 0.11, 0.7), M.alu), 0, (BV.MAST_FOOT + BV.MASTHEAD) / 2, BV.MAST_Z); // deep, for the main rolled inside it
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, BV.MASTHEAD - BV.BOOM_Y - 0.6, 0.02), M.dark), 0, (BV.BOOM_Y + BV.MASTHEAD - 0.6) / 2, BV.MAST_Z + 0.155); // the slot the luff comes out of
    for (const [g, mm] of winch(0.05, 0.12)) { const o = add(new THREE.Mesh(g, mm), 0, BV.BOOM_Y - 0.45, BV.MAST_Z + 0.16); o.rotation.x = Math.PI / 2; } // the furling gear's drive
    add(cyl(0.18, 0.2, 0.08, M.dark, 14), 0, BV.MAST_FOOT + 0.04, BV.MAST_Z);
    for (const [y, w] of BV.SPR) for (const sx of [-1, 1]) {
      const s = add(new THREE.Mesh(spreaderGeo(w, 0.04, 0.022), M.alu), sx * w / 2, y, BV.MAST_Z + 0.2); s.rotation.z = -sx * Math.PI / 2; s.rotation.y = -sx * 0.32;
    }
    for (const sx of [-1, 1]) {
      const foot = [sx * (H.hbAt(BV.MAST_Z + 0.4) - 0.3), H.deckY(BV.MAST_Z + 0.4) + 0.04, BV.MAST_Z + 0.4];
      T.add(line([[0, BV.HOUNDS, BV.MAST_Z], [sx * BV.SPR[1][1], BV.SPR[1][0], BV.MAST_Z + 0.4], [sx * BV.SPR[0][1], BV.SPR[0][0], BV.MAST_Z + 0.42], foot]));
      T.add(line([[0, BV.SPR[1][0] - 0.1, BV.MAST_Z], [sx * BV.SPR[0][1], BV.SPR[0][0], BV.MAST_Z + 0.42]]));
      T.add(line([[0, BV.SPR[0][0] - 0.1, BV.MAST_Z], [sx * (H.hbAt(BV.MAST_Z + 0.9) - 0.32), H.deckY(BV.MAST_Z + 0.9) + 0.04, BV.MAST_Z + 0.9]]));
      T.add(line([[0, 7.2, H.STERN - 1.0], [sx * 1.62, H.deckY(H.STERN - 0.15) + 0.05, H.STERN - 0.15]]));
    }
    T.add(line([[0, BV.HOUNDS + 0.05, BV.MAST_Z], [BV.TACK.x, BV.TACK.y, BV.TACK.z]]));
    T.add(line([[0, BV.MASTHEAD - 0.05, BV.MAST_Z + 0.2], [0, 7.2, H.STERN - 1.0]]));
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.4), M.alu), 0, BV.MASTHEAD - 0.02, BV.MAST_Z + 0.12);
    add(cyl(0.005, 0.008, 1.0, M.dark, 6), 0.05, BV.MASTHEAD + 0.5, BV.MAST_Z + 0.25); // the VHF antenna
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.07), M.gel), 0, 8.8, BV.MAST_Z - 0.16); // the steaming light and the deck light under it
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), M.gel), 0, 8.62, BV.MAST_Z - 0.16);
    for (const dx of [-0.05, 0.05]) T.add(line([[dx, BV.HOUNDS + 0.2, BV.MAST_Z - 0.12], [dx, BV.MAST_FOOT + 0.4, BV.MAST_Z - 0.14]]));
    // the mainsheet: no traveller, but two tackles, one each side, from a bail under the boom down to blocks on the
    // coachroof either side of the companionway, the tails on to the winches beside it
    const feet = new THREE.Group();
    for (const sx of [-1, 1]) for (const [g, mm] of block(0.045)) { const o = new THREE.Mesh(g, mm); o.position.set(sx * 0.62, 0.06, 0); feet.add(o); }
    for (const sx of [-1, 1]) feet.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), M.dark).translateX(sx * 0.62));
    this.travCar = add(mergeGroup(feet), 0, BV.ROOF + 0.015, BV.FEET_Z);
    this.sheets = [-1, 1].map(() => { const l = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); l.frustumCulled = false; return l; });
    this.mainsheet = add(new THREE.Group()); this.mainsheet.add(...this.sheets);
    for (const sx of [-1, 1]) T.add(line([[sx * 0.62, BV.ROOF + 0.08, BV.FEET_Z + 0.03], [sx * 0.8, BV.ROOF + 0.06, 2.45]]));
    // the boom, its kicker, the bail for the sheets and the outhaul along it; the main rolls away inside the mast, so
    // there is no bag and no reef points
    this.mainPivot = add(new THREE.Group(), 0, 0, BV.MAST_Z);
    const gear = new THREE.Group();
    const boom = cyl(0.07, 0.06, BV.BL, M.alu, 12); boom.rotation.x = Math.PI / 2; boom.position.set(0, BV.BOOM_Y, BV.BL / 2 + 0.05); boom.scale.set(0.8, 1, 1.3); gear.add(boom);
    gear.add(bar([0, BV.MAST_FOOT + 0.35, 0.18], [0, BV.BOOM_Y - 0.06, 1.25], 0.025, 0.03, M.alu));
    for (const [g, mm] of block(0.05)) { const o = new THREE.Mesh(g, mm); o.position.set(0, BV.BOOM_Y - 0.12, BV.SHEET_Z); gear.add(o); }
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.16), M.dark).translateY(BV.BOOM_Y + 0.06).translateZ(BV.BL - 0.02)); // the outhaul's car at the clew
    this.mainPivot.add(mergeGroup(gear));
    this.mainPivot.add(line([[0.05, BV.BOOM_Y + 0.08, BV.BL - 0.05], [0.05, BV.BOOM_Y + 0.08, 0.2], [0.08, BV.MAST_FOOT + 0.3, 0.17]]));
    const mtex = sailTexture('main', look, BV.rig); // her sails in your colours, as every boat's are
    this.main = sailMesh(24, 12, mtex, look.laminate, 'main'); this.mainPivot.add(this.main);
    // the genoa on the forestay, sheeted through its car on the side deck to the primary winch
    this.TACK = BV.TACK; this.HEAD = BV.HEAD; this.CLEW = BV.CLEW; this.jibMax = 32; this.jibBelly = 0.13;
    this.jibPivot = add(new THREE.Group(), BV.TACK.x, BV.TACK.y, BV.TACK.z);
    this.jibAxis = BV.HEAD.clone().sub(BV.TACK).normalize();
    // the furling genoa, in your colours
    const jtex = sailTexture('jib', look, BV.rig);
    this.jib = sailMesh(18, 9, jtex, look.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.kite = sailMesh(16, 10, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);
    this.makeTells(player);
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 2.4, 1.15, 1.3, 0.48));
    T.add(...bowNumber(H, look, H.BOW + 1.05, 1.25, 0.95, 0.26));
    { const z = H.STERN - 1.4; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.25, 1.7)) T.add(d); }
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false;
    this.windex = windex(add, BV.MASTHEAD + 0.06, BV.MAST_Z);
    // five: the helm at the windward wheel, the main trimmer and the genoa trimmer in the cockpit, two on the side deck
    const m = crewMats(look);
    this.crew = [BV.WHEEL_Z + 0.5, BV.CK[0] + 0.6, BV.WINCH_Z - 0.4, -0.4, -1.5].map((z0, i) => {
      const s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[i], roughness: 0.65 }) });
      T.add(s.g);
      return { g: s.g, s, z0, i, x: 0, y: BV.FLOOR, z: z0, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 };
    });
    this.eye = [BV.WHEEL_X, BV.FLOOR + 1.9, BV.WHEEL_Z + 0.7]; // the helm view: standing behind the windward wheel, the rim low in the view
    this.finish(label, 23);
  }
  update(b, t, W, showLabel) {
    const H = BV.hull, side = this.place(b, t, W);
    this.wheel.children.forEach((w) => { w.rotation.z = -b.rudder * 1.4; });
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    const sc = this.cloth, ss = this.sailSide, belly = -ss * (1 - sc.flogM * 0.85), span = BV.rig.span;
    clearShrouds(this, sa, ss, { y: (f) => BV.BOOM_Y + 0.1 + f * span, chord: BV.chord, z0: 0.17, x: (f, u) => mainShape(sc, f, u, BV.chord(f), ss, 0.11, 0.6, false).x });
    setSail(this.main, (f, u, v) => {
      const m = mainShape(sc, f, u, BV.chord(f), ss, 0.11, 0.6, false); // furled into the mast: no battens
      v.set(m.x, BV.BOOM_Y + 0.1 + f * span, m.z + 0.17);
      turnMain(this, f, v);
    });
    // the mainsheet's two tackles, from their blocks on the coachroof up to the bail under the boom
    const ma = this.mainPivot.rotation.y, bail = [Math.sin(ma) * BV.SHEET_Z, BV.BOOM_Y - 0.17, BV.MAST_Z + Math.cos(ma) * BV.SHEET_Z];
    this.sheets.forEach((l, i) => purchase(l, [(i ? 0.62 : -0.62), BV.ROOF + 0.12, BV.FEET_Z], bail, 0.04));
    // the genoa and its sheets: the working one through the car to the winch, the lazy one slack across the foredeck
    const gz = BV.MAST_Z + 1.4, gx = (s) => s * (H.hbAt(gz) - 0.4), wy = coamY(BV.WINCH_Z) + 0.18, wx = (s) => s * BV.WINCH_X;
    this.jibAndTells(b, t, side, belly, luff, ph, (ls) => [[gx(ls), H.deckY(gz) + 0.1, gz], [wx(ls), wy, BV.WINCH_Z]]);
    { const cw = this.jibClew(), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position;
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, cw.y - 0.5, cw.z + 0.4); lz.setXYZ(2, gx(-ls), H.deckY(gz) + 0.1, gz); lz.setXYZ(3, wx(-ls), wy, BV.WINCH_Z); lz.needsUpdate = true; }
    // the crew: the helm stands behind the windward wheel; the trimmers sit to windward upwind, the gennaker's
    // trimmer to leeward off the wind; the two forward sit out on the windward side deck, legs over the side, and one
    // goes to the mast for a hoist or a drop
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -1.4, reach = 0.55;
      let hands = null;
      if (c.i === 0) { x = side * BV.WHEEL_X; z = BV.WHEEL_Z + 0.42; y = BV.FLOOR + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.15; knee = -0.3; reach = 1.0; const w = this.wheel.children[side > 0 ? 1 : 0]; hands = this.rim(w, w, 0.52, 1, [Math.PI / 2 - 0.85, Math.PI / 2 + 0.85]); }
      else if (c.i === 1) { x = side * (BV.CK[1] - 0.3); y = BV.FLOOR + 0.43; yaw = Math.PI - 0.5; reach = 0.8; }
      else if (c.i === 2) { const lee = !up && b.kite; x = (lee ? -side : side) * (BV.CK[1] - 0.25); y = BV.FLOOR + 0.43; yaw = Math.PI - 0.9; reach = 0.9; }
      else if (c.i === 4 && bowBusy) { x = 0.25; z = BV.MAST_Z + 0.45; y = BV.ROOF + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; hands = this.haul(0.05, y + 1.0, BV.MAST_Z + 0.18, t); }
      else if (up) { x = side * (H.hbAt(z) - 0.12); y = H.deckY(z) + 0.07; yaw = 0; lean = 0.2; knee = -1.85; reach = 0.3; }
      else { x = side * (H.hbAt(z) - 0.45); y = H.deckY(z) + 0.06; yaw = Math.PI - 0.5; knee = -1.2; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach, hands }, k);
    }
    // the gennaker, tacked to the sprit and hoisted to the hounds
    const kf = kiteHoist(b), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)), S = BV.SPRIT;
    this.kite.visible = this.kiteSheet.visible = kf > 0.02;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6.2, 3.6, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [S.x, S.y + 0.1, S.z], hd = [0, lerp(S.y + 1.0, BV.HOUNDS + 0.2, kf), lerp(S.z, BV.MAST_Z - 0.2, kf)], cl = [sd * out, lerp(S.y + 0.5, 3.4, kf), lerp(S.z + 1.0, 1.2, kf)];
      const qz = H.STERN - 0.7, lead = [sd * (H.hbAt(qz) - 0.1), H.deckY(qz) + 0.1, qz], guard = kiteGuard(this); guard.clew(cl, lead);
      setKite(this, tk, hd, cl, sd, 0, 3.0, kfill, guard);
      const kp = this.kiteSheet.geometry.attributes.position;
      kp.setXYZ(0, cl[0], cl[1], cl[2]); kp.setXYZ(1, ...lead); kp.setXYZ(2, sd * BV.WINCH_X, wy, BV.WINCH_Z); kp.needsUpdate = true;
    }
    this.showLabel(b, showLabel);
  }
}

// ---------- the AC75 ----------
// to the AC75 Class Rule (v2, the 37th Cup's): a 20.7 m hull without a bowsprit, 5 m beam; the mast stepped 9.15 m
// forward of the transom, 1.5 m up, raked 5° aft, its forestay 24 m up it and its tack 8.2 m ahead of it; the foil
// arms' cant axes inside the hull 2.05 m out and 0.52 m up, 11 m forward of the transom, ahead of the mast
const A = (() => {
  const L = 20.7, B = 5.0;
  const hull = hullOf({
    L, flare: 0.02,
    // full aft, a long fine bow that rounds up to a narrow, raked stem (within the rule's 1.6 m half-beam 3.7 m aft
    // of the bow, 1.0 m at 1.7 m)
    hb: (t) => (B / 2) * (t < 0.5 ? 0.86 + 0.14 * Math.sin((t / 0.5) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.5) / 0.5) * Math.PI / 2)) ** 0.72),
    sheer: (t) => 1.05 + 0.32 * t ** 2.2,
    depth: (t) => 0.62 * Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.1)) ** 0.6,
    n: (t) => lerp(3.4, 2.1, clamp((t - 0.4) / 0.6, 0, 1)), // a flat-bottomed scow aft
    // a hard chine high on the topsides aft, the flat, nearly deadrise-less bottom of a skimming hull below it
    chine: { y: (t) => 0.42 - 0.45 * t, w: (t) => 1 - smooth(0.5, 0.88, t), dead: (t) => lerp(7, 3, clamp(t / 0.4, 0, 1)), flat: 0.92 },
  });
  const MAST_Z = hull.STERN - 9.15, MAST_FOOT = 1.5, MASTHEAD = 27.6, RAKE = Math.tan(5 * D2R), DECK = hull.deckY(MAST_Z);
  const rz = (y) => MAST_Z + (y - MAST_FOOT) * RAKE; // the mast's centre at height y, raked aft
  const FOOT_Y = DECK + 0.15; // the main sweeps the deck: no boom
  const chord = (f) => lerp(7.2, 2.6, f) + 0.4 * Math.sin(Math.PI * f); // the rule's girths: 7.0–7.4 m at the foot, ≤ 5.8 m half way up
  const FORESTAY = MAST_FOOT + 24;
  const TACK = new THREE.Vector3(0, hull.deckY(MAST_Z - 8.2) + 0.12, MAST_Z - 8.2);
  const HEAD = new THREE.Vector3(0, FORESTAY - 0.3, rz(FORESTAY - 0.3) - 0.35);
  const CLEW = new THREE.Vector3(0, 0.25, 7.6); // from the tack: the self-tacker's foot, its clew just ahead of the mast
  const ARM = { x: 2.05, y: 0.52, z: hull.STERN - 11, len: 5.3 }; // the foil arms' cant axes, inside the hull, and their length
  const PODS = [[1.9, 3.3], [3.8, 5.0], [5.6, 8.6]]; // each side: the helm's, the trimmer's, the two cyclors' in tandem
  const rig = rigOf({ span: MASTHEAD - 0.4 - FOOT_Y, chord, numAt: 0.5, flagAt: 0.84, mark: 2.6, head: HEAD, tack: TACK, clew: CLEW });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, RAKE, rz, FOOT_Y, chord, FORESTAY, TACK, HEAD, CLEW, ARM, PODS, rig, TRAV_Z: hull.STERN - 0.9 };
})();

// the bustle's depth under the hull's bottom, s = 0 at the transom … 1 where it fairs out 4 m aft of the bow:
// deepest a little aft of amidships, still deep where it ends square at the transom (blender/ac75.py's on the same curve)
const bustleDepth = (s) => 0.7 * Math.sin(Math.PI * Math.min(1, s * 0.9 + 0.1)) ** 0.8;
const CYCLE_Z = [A.PODS[2][0] + 0.7, A.PODS[2][1] - 0.8]; // the bikes in the cyclors' pod, one behind the other

class AC75View extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    this.flutter = 0.3; // her jib's leech, sheeted hard on a foiler, barely flutters (clothState)
    const add = this.start(), T = this.tilt, H = A.hull;
    this.flyY = 1.7;
    const paint = foilerMaterial(look.hull), MOD = AC75_MODEL;
    const podWall = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.6, side: THREE.DoubleSide });
    if (MOD) {
      // the hull with its bustle faired in, the deck and the pods, moulded (blender/ac75.py), in a group of their own so
      // the boat's merging of her small parts (bake) leaves the shared geometry alone
      const moulded = add(new THREE.Group());
      for (const [k, mat] of [['hull', paint], ['deck', deckFinish(look, AC_DECK)], ['pod', podWall], ['rubber', MAT.rubber]]) if (MOD[k]) moulded.add(new THREE.Mesh(MOD[k], mat));
    } else add(new THREE.Mesh(H.geometry(), paint));
    // the bustle: a long fin down the centreline of the bottom, from 4 m aft of the bow to the transom, sealing the
    // main's foot to the water (faired into the hull, in the model: blender/ac75.py's bustle, on the same curve)
    if (!MOD) {
      const bus = new THREE.Shape(), n = 24;
      for (let i = 0; i <= n; i++) { const s = i / n; bus[i ? 'lineTo' : 'moveTo'](-lerp(H.STERN - 0.02, H.BOW + 4, s), -bustleDepth(s)); }
      bus.lineTo(-(H.BOW + 4), 0.3); bus.lineTo(-(H.STERN - 0.02), 0.3); bus.closePath();
      const bg = new THREE.ExtrudeGeometry(bus, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
      bg.translate(0, 0, -0.18); bg.rotateY(Math.PI / 2);
      add(new THREE.Mesh(bg, paint), 0, -0.48, 0);
    }
    // the deck, flat and dark, with the crew's pods cut into it, three a side: the helm's forward, the trimmer's, and
    // the cyclors' aft, two of them in tandem in a long one. Each a moulded well with rounded corners, its rim in
    // rubber, a floor and its seats, bikes or wheel
    const pods = [];
    for (const sx of [-1, 1]) for (const [z0, z1] of A.PODS) {
      const [x0, x1] = sx < 0 ? [-2.05, -1.05] : [1.05, 2.05], tb = H.tub(x0, z0, x1, z1, 0.22, H.deckY((z0 + z1) / 2) - 0.9, { slope: 0.05, crown: 0.08 });
      pods.push(tb.outline);
      if (!MOD) { const w = add(new THREE.Mesh(tb.walls, podWall)); w.userData.detail = false; add(new THREE.Mesh(tb.floor, MAT.rubber)); }
      T.add(tube(tb.outline.map(([x, z]) => [x, H.deckY(z) + 0.1, z]), 0.03, MAT.rubber, true));
    }
    if (!MOD) add(new THREE.Mesh(H.deck(pods, 0.08), deckFinish(look, AC_DECK)));
    // the cyclors' bikes, two in the aft pod each side: a saddle on its post, the crank housing and the bars
    this.bikes = [];
    for (const sx of [-1, 1]) for (const z of CYCLE_Z) {
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
    for (const z of [-5.6, 4.4]) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), M.dark), 0, H.deckY(z) + 0.09, z);
    // the foil arms: one each side, canting about an axis inside the hull and coming out of a slot low in the
    // topsides; the leeward one down in the water, the windward one canted up and out. Each is a foil section bent
    // out at its root (the swan neck), then straight down to a T-wing: two anhedral halves, their flaps and the
    // ballast pod where they meet
    const foilMat = new THREE.MeshPhysicalMaterial({ color: '#23272d', roughness: 0.35, metalness: 0.2, clearcoat: 0.8 });
    const flapMat = new THREE.MeshPhysicalMaterial({ color: look.hull, roughness: 0.3, clearcoat: 0.8 });
    this.arms = [-1, 1].map((sx) => {
      const g = add(new THREE.Group(), sx * A.ARM.x, A.ARM.y, A.ARM.z), NECK = 1.0, BEND = 0.45;
      const neck = new THREE.Mesh(finGeo(NECK, 0.8, 0.78, 0.2, 0), foilMat); neck.rotation.z = sx * BEND; g.add(neck);
      const nx = sx * NECK * Math.sin(BEND), ny = -NECK * Math.cos(BEND);
      g.add(new THREE.Mesh(finGeo(A.ARM.len - NECK, 0.78, 0.6, 0.2, 0.12).translate(nx, ny, 0), foilMat));
      const tip = new THREE.Group(); tip.position.set(nx, ny - (A.ARM.len - NECK), 0.1); g.add(tip);
      // each half of the wing: out from the pod nearly level, drooping more and more towards its tip (the anhedral
      // that keeps her steady in roll), tapering and swept back, the tip rounded; the flap runs most of its span
      const WING = Array.from({ length: 13 }, (_, i) => i / 12).reduce((st, u, i) => {
        const p = st[i - 1] || { x: 0.12, y: 0, u: 0 }, a = (3 + 38 * u ** 2.2) * D2R, ds = 2.25 / 12;
        st.push({ u, x: i ? p.x + ds * Math.cos(a) : p.x, y: i ? p.y - ds * Math.sin(a) : p.y, c: Math.max(0.1, 0.86 * (1 - 0.42 * u) * Math.sqrt(1 - u ** 6)), s: 0.05 + 0.36 * u ** 1.6 });
        return st;
      }, []);
      const FLAP = WING.filter((w) => w.u > 0.04 && w.u < 0.9);
      for (const wx of [-1, 1]) {
        tip.add(new THREE.Mesh(wingGeo(WING, 0.13, [0, 0.72], 0, wx), foilMat));
        tip.add(new THREE.Mesh(wingGeo(FLAP, 0.11, [0.74, 1], 0.1, wx), flapMat));
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
    // the helms' wheels, at the front of the forward pods (they turn with the helm)
    this.wheel = add(new THREE.Group(), 0, 0, 0);
    { const z0 = A.PODS[0][0];
      for (const sx of [-1, 1]) {
        const w = wheel(0.3, 5); w.position.set(sx * 1.55, H.deckY(z0) - 0.1, z0 + 0.2); this.wheel.add(w);
        add(cyl(0.05, 0.07, 0.75, M.dark, 8), sx * 1.55, H.deckY(z0) - 0.5, z0 + 0.35);
      } }
    // the mast: a tall D-section stepped on a ball 1.5 m up, raked 5° aft and rotating with the main; the shrouds and
    // the jumpers, the forestay
    this.mast = add(new THREE.Group(), 0, A.MAST_FOOT, A.MAST_Z); this.mast.rotation.x = Math.atan(A.RAKE); // raked about its foot; it turns about its own axis (Euler XYZ: the turn first, then the rake)
    const mast = cyl(0.2, 0.36, A.MASTHEAD - A.MAST_FOOT, CARBON, 20); mast.position.y = (A.MASTHEAD - A.MAST_FOOT) / 2; mast.scale.set(0.75, 1, 1.55); this.mast.add(mast);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, (A.MAST_FOOT - H.deckY(A.MAST_Z)) / 0.5, 1.4), M.dark), 0, H.deckY(A.MAST_Z), A.MAST_Z);
    for (const sx of [-1, 1]) {
      T.add(line([[0, 22.5, A.rz(22.5)], [sx * 1.4, 13, A.rz(13) + 0.4], [sx * (H.hbAt(A.MAST_Z + 1) - 0.2), H.deckY(A.MAST_Z + 1) + 0.05, A.MAST_Z + 1]]));
      T.add(line([[0, 13, A.rz(13)], [sx * (H.hbAt(A.MAST_Z + 0.5) - 0.25), H.deckY(A.MAST_Z + 0.5) + 0.05, A.MAST_Z + 0.5]]));
      const s = add(new THREE.Mesh(spreaderGeo(1.4, 0.05, 0.028), CARBON), sx * 0.7, 13, A.rz(13) + 0.2); s.rotation.z = -sx * Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), M.steel), sx * (H.hbAt(A.MAST_Z + 1) - 0.2), H.deckY(A.MAST_Z + 1) + 0.04, A.MAST_Z + 1);
    }
    T.add(line([[0, A.FORESTAY, A.rz(A.FORESTAY) - 0.2], [A.TACK.x, A.TACK.y, A.TACK.z]]));
    // the main: two skins round the mast, meeting at the leech; the clew sheeted to a traveller near the stern, no boom
    this.mainsheet = line([[0, 0, 0], [0, 1, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    this.travCar = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.24), M.dark), 0, H.deckY(A.TRAV_Z) + 0.07, A.TRAV_Z);
    add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.12), M.steel), 0, H.deckY(A.TRAV_Z) + 0.02, A.TRAV_Z); // in its trench across the transom's scoop
    this.mainPivot = add(new THREE.Group(), 0, 0, A.MAST_Z + 0.35);
    const mtex = sailTexture('main', look, A.rig);
    this.main = sailMesh(24, 12, mtex, true, 'main'); this.mainPivot.add(this.main);
    this.main2 = sailMesh(24, 12, mtex, true, 'main'); this.mainPivot.add(this.main2);
    this.clewBoard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), M.carbon); this.mainPivot.add(this.clewBoard);
    // the self-tacking jib: its car runs on a curved track across the foredeck
    this.TACK = A.TACK; this.HEAD = A.HEAD; this.CLEW = A.CLEW; this.jibMax = 18; this.jibBelly = 0.09;
    const JR = A.CLEW.z, JA = Math.asin(1.6 / JR); // the track's radius (the jib's foot) and how far round it runs, to 1.6 m out
    const trk = []; for (let i = 0; i <= 16; i++) { const a = (i / 16 - 0.5) * 2 * JA; trk.push([Math.sin(a) * JR, H.deckY(A.TACK.z + JR * Math.cos(a)) + 0.04, A.TACK.z + JR * Math.cos(a)]); }
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
    { const z = H.STERN - 3.6; for (const d of nameDecal(H, look, z, H.deckY(z) - 0.45, 4.2)) T.add(d); }
    this.windex = windex(add, A.MASTHEAD + 0.05, A.MAST_Z);
    // the broadcast's camera pods: one on a short post on the aft deck looking forward, one high on the mast
    { const z = H.STERN - 0.3; add(cyl(0.04, 0.05, 0.5, M.dark, 8), 0, H.deckY(z) + 0.25, z);
      add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10).rotateX(Math.PI / 2), M.dark), 0, H.deckY(z) + 0.55, z - 0.05); }
    const cam = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 10).rotateX(Math.PI / 2), M.dark); cam.position.set(0, 18.5 - A.MAST_FOOT, -0.4); this.mast.add(cam);
    // eight: the two helms forward at their wheels, the two trimmers behind them, and the four cyclors aft, heads down
    // on their bikes, as the 37th Cup's crews sailed
    const m = { ...crewMats(look), helmet: true }, spots = []; // America's Cup crews race in helmets
    for (const [z, i] of [[A.PODS[0][0] + 0.7, 0], [(A.PODS[1][0] + A.PODS[1][1]) / 2, 1], ...CYCLE_Z.map((z) => [z, 3])]) for (const sx of [-1, 1]) spots.push([sx, z, i]);
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
    const sc = this.cloth, ss = this.sailSide, belly = -ss * (1 - sc.flogM * 0.85), span = A.rig.span;
    // the double skin: a deep, even camber all the way up, a little twist off at the head; the two skins stand apart
    // round the mast (its width) and close to the leech
    const skin = (f, u, sk) => { const ch = A.chord(f); return belly * Math.sin(Math.PI * u ** 0.7) * ch * 0.1 * sc.depth - ss * f * f * 0.9 * u * sc.twist + sk * 0.24 * (1 - 0.5 * f) * (1 - u) ** 1.6 + flog(f, u, sc.fp, sc.flogM, ch, sc.aws, ss, sc.ph) * 0.6; };
    clearShrouds(this, sa, ss, { y: (f) => A.FOOT_Y + f * span, chord: A.chord, axis: (y) => (y - A.FOOT_Y) * A.RAKE, x: (f, u) => skin(f, u, ss < 0 ? 1 : -1) });
    this.mast.rotation.y = this.mainPivot.rotation.y - this.sailSide * Math.min(sa, 0.5) * 0.3; // the mast turns a little further than the sail's foot to line up with it
    // the sail turns about the upright through its tack; each height carried aft (in the boat's frame, whichever way
    // the sail is turned) by the mast's rake there, so the luff stays on the mast
    const psi = this.mainPivot.rotation.y, rs = -Math.sin(psi), rc = Math.cos(psi);
    for (const [mesh, sk] of [[this.main, 1], [this.main2, -1]]) setSail(mesh, (f, u, v) => {
      const y = A.FOOT_Y + f * span, o = (y - A.FOOT_Y) * A.RAKE;
      v.set(skin(f, u, sk), y, u * A.chord(f));
      turnMain(this, f, v);
      v.x += o * rs; v.z += o * rc;
    });
    const ch0 = A.chord(0), ma = this.mainPivot.rotation.y, ms = this.mainsheet.geometry.attributes.position;
    this.clewBoard.position.set(0, A.FOOT_Y + 0.25, ch0 - 0.3);
    ms.setXYZ(0, clamp(Math.sin(ma) * ch0 * 0.45, -1.5, 1.5), H.deckY(A.TRAV_Z) + 0.1, A.TRAV_Z); this.travCar.position.x = ms.getX(0);
    ms.setXYZ(1, Math.sin(ma) * ch0, A.FOOT_Y + 0.1, A.MAST_Z + 0.35 + Math.cos(ma) * ch0); ms.needsUpdate = true;
    this.jibAndTells(b, t, side, belly, luff, ph, null);
    // the jib's car follows the clew round its track
    const cw = A.CLEW.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position);
    const JR = A.CLEW.z, JA = Math.asin(1.6 / JR), ang = clamp(Math.atan2(cw.x, cw.z - A.TACK.z), -JA, JA), car = [Math.sin(ang) * JR, 0, A.TACK.z + JR * Math.cos(ang)];
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
        const w = this.wheel.children[c.sx > 0 ? 1 : 0];
        this.pose(c, { x: c.sx * 1.55, y: fy - 0.05, z: c.z0, yaw: c.i === 0 ? Math.PI / 2 : wind ? 0.9 : Math.PI / 2, stand: 1, knee: -0.4, hands: c.i === 0 ? this.rim(w, w, 0.3, 1, [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9]) : null,
          lean: c.i === 1 && wind ? 0.35 + 0.1 * Math.sin(t * 3 + c.ph) : 0.2, reach: c.i === 0 ? 1.0 : wind ? 1.1 + 0.25 * Math.sin(t * 2.5 + c.ph) : 0.7 }, k);
      }
    }
    this.showLabel(b, showLabel);
  }
}

// the moulded parts of the Bavaria (blender/bavaria46.py), the Laser (blender/laser.py), the Optimist
// (blender/optimist.py), the J/70 and the RS21
// (blender/sportboats.py), the AC75 (blender/ac75.py), the Dragon (blender/dragon.py) and the J Class (blender/jclass.py), each asked for only on a page that will build her (her races,
// her boat page, the fleet). Here at the end, once every class's lines are laid down: the views read them only when a
// boat is built, after this module has loaded
const [BV_MODEL, LZ_MODEL, OZ_MODEL, J70_MODEL, RS21_MODEL, AC75_MODEL, DRAGON_MODEL, JCLASS_MODEL] = await Promise.all([
  CLS.id !== 'bavaria46' && !ON_FLEET ? null : loadModel('bavaria46.glb', BV.hull, [['deck', 1], ['roof', 1], ['teak', 1 / 0.8]]),
  CLS.id !== 'laser' && !ON_FLEET ? null : loadModel('laser.glb', LZ.hull, [['deck', 1]]),
  CLS.id !== 'optimist' && !ON_FLEET ? null : loadModel('optimist.glb', OZ.hull, [['deck', 1]]),
  CLS.id !== 'j70' && !ON_FLEET ? null : loadModel('j70.glb', sportOf(false).hull, [['deck', 1]]),
  CLS.id !== 'rs21' && !ON_FLEET ? null : loadModel('rs21.glb', sportOf(true).hull, [['deck', 1]]),
  CLS.id !== 'ac75' && !ON_FLEET ? null : loadModel('ac75.glb', A.hull, [['deck', 1]]),
  CLS.id !== 'dragon' && !ON_FLEET ? null : loadModel('dragon.glb', DZ.hull, [['deck', 1], ['teak', 1 / 0.8]]),
  CLS.id !== 'jclass' && !ON_FLEET ? null : loadModel('jclass.glb', JZ.hull, [['deck', 1 / 0.8], ['teak', 1 / 0.8]]),
]);
// the Dragon's mahogany: its grain laid along her, its UVs the height and the length in metres (the band's faces stand
// upright, so the plan's would smear it)
// (and the J's doghouse and skylight, the same way)
for (const MOD of [DRAGON_MODEL, JCLASS_MODEL]) if (MOD?.wood) {
  const q = MOD.wood.attributes.position, uv = new Float32Array(q.count * 2);
  for (let i = 0; i < q.count; i++) { uv[2 * i] = (q.getY(i) + Math.abs(q.getX(i)) * 0.5) * 2; uv[2 * i + 1] = -q.getZ(i) * 0.5; }
  MOD.wood.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
