// Regatta: the other classes' yachts, built in code like the JPK 1050 (yacht.js) and dressed the same way —
// your colours, sail number, logo and flag, the sponsor's ad on the jib. Each is drawn at her real size (drawnL in
// classes.js): the sportboats — the J/70 (tiller, cuddy, retractable sprit and asymmetric kite, four hiking on the
// rail) and the RS21 (the same idea with a wide open cockpit, no cuddy, three aboard) — the Laser (ILCA) dinghy (one
// sail on an unstayed mast, one sailor hiking), the Bavaria 46 cruiser (a long coachroof, twin wheels, a furling
// genoa and a cruising gennaker, five aboard) and the AC75 foiling monohull (a scow-bowed hull flying on canting T-foil arms, a deck-sweeping double-skin main on a
// D-section mast, a self-tacking jib and eight in their pods). makeBoatView gives the page's class (classes.js CLS), or
// the one asked for (the fleet page, /fleet-view, has one of each afloat together).
// Local frame as yacht.js: +x starboard, +y up, −z forward (the bow), the waterline at y = 0.
import * as THREE from 'three';
import { BoatView, M, NONSKID, canvasTex, line, tube, cyl, hullMaterial, logoImage, drawContain, sailTexture, sailMesh, setSail, leechFlutter, sailor, labelSprite, THIGH, SHIN, LOOKS,
  fit, bar, winch, block, clutches, cleat, wheel, chainplate, display, purchase, mergeGroup, bowNumberMaterial, nameMaterial, deckFinish, mastGeo, spreaderGeo } from './yacht.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CLS } from './classes.js';
import { D2R, clamp, lerp, waveHeight } from './sim.js';

export function makeBoatView(o, cls = CLS) {
  if (cls.id === 'j70' || cls.id === 'rs21') return new SportView({ ...o, cls });
  if (cls.id === 'ac75') return new AC75View({ ...o, cls });
  if (cls.id === 'laser') return new LaserView({ ...o, cls });
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
// paint more on a sail's cloth once it is drawn (sailTexture): draw(ctx, w, h) on its canvas, and on its back face's
// when it has one of its own (the jib's, for the ad), x along the chord from the luff, y down from the head. The back
// face reads its canvas mirrored: X(u) gives where u falls on whichever canvas is being drawn
function onCloth(tex, draw) {
  for (const t of [tex, tex.back]) if (t && t.image) { const w = t.image.width, X = t === tex ? (u) => w * u : (u) => w * (1 - u); draw(t.image.getContext('2d'), w, t.image.height, X); t.needsUpdate = true; }
  return tex;
}
// a cruiser's sails, whatever the racing look (but on the fleet page, where she is in yours): white woven Dacron, the luff tape and battens a shade darker, the
// number in the hull's colour (or navy, on a pale hull) to read on the white
function dacron(look) {
  const c = new THREE.Color(look.hull), ink = c.getHSL({}).l < 0.55 ? look.hull : '#1d2a44';
  return { ...look, cloth: '#f1efe8', laminate: false, tape: '#d9d5ca', batten: '#d4d0c4', ink };
}
function windex(add, y, z) {
  const w = add(new THREE.Group(), 0, y, z); w.userData.flat = true;
  const rod = cyl(0.008, 0.008, 0.5, M.dark, 4); rod.position.set(0, 0.1, -0.1); rod.rotation.x = Math.PI / 2; w.add(rod);
  const vane = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.dark); vane.rotation.x = -Math.PI / 2; vane.position.set(0, 0.1, -0.38); w.add(vane);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide })); tail.rotation.y = Math.PI / 2; tail.position.set(0, 0.12, 0.12); w.add(tail);
  return w;
}

// ---------- what both share with the JPK 1050 ----------
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
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !(o.userData.flat || o.parent?.userData.flat); o.receiveShadow = true; } });
    this.bake();
  }
  bake() { BoatView.prototype.bake.call(this); }
  setDetail(on) { BoatView.prototype.setDetail.call(this, on); }
  setCrewNear(near) { BoatView.prototype.setCrewNear.call(this, near); }
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
  // the jib on its stay, its sheets, the telltales and the masthead vane: as on the JPK 1050
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
  const rig = rigOf({ span: MASTHEAD - 0.2 - BOOM_Y, chord, numAt: 0.62, logoAt: 0.78, flagAt: 0.9, mark: 0.85, head: HEAD, tack: TACK, clew: CLEW, ad: 1.1, adH: 0.55 });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, HOUNDS, BOOM_Y, chord, TACK, HEAD, CLEW, SPRIT, rig };
};

class SportView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const RS = this.RS = cls.id === 'rs21', J = this.J = sportOf(RS);
    const add = this.start(), T = this.tilt, H = J.hull, MOD = RS ? RS21_MODEL : J70_MODEL;
    this.flyY = 0;
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
    const ext = cyl(0.012, 0.012, 0.9, M.dark, 6); ext.rotation.z = Math.PI / 2; ext.position.set(0.45, 0.17, -1.1); this.wheel.add(ext);
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
    { const z = H.STERN - 0.85; T.add(...nameDecal(H, look, z, H.deckY(z) - 0.15, 1.0)); }
    // the jib sheets, the working one taut and the lazy one slack; the kite's sheet and its tack line to the sprit
    this.jibSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.lazySheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    this.kiteSheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); T.add(this.jibSheet, this.lazySheet, this.kiteSheet);
    for (const l of [this.jibSheet, this.lazySheet, this.kiteSheet]) l.frustumCulled = false;
    this.windex = windex(add, J.MASTHEAD + 0.02, J.MAST_Z);
    // four: the helm, the main trimmer, the jib and kite trimmer, and the bow, who goes forward for a hoist or a drop
    const m = crewMats(look);
    this.crew = (RS ? [2.1, 1.4, 0.7, 0.0] : [2.25, 1.45, 0.75, 0.0]).map((z0, i) => {
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
    this.travCar.position.x = RS ? 0 : clamp(Math.sin(ma) * bz * 0.4, -0.6, 0.6);
    purchase(this.mainsheet, [this.travCar.position.x, this.sheetFoot[0] + 0.065, this.sheetFoot[1]], [Math.sin(ma) * bz, J.BOOM_Y - 0.085, J.MAST_Z + Math.cos(ma) * bz], 0.03);
    const ty = RS ? H.deckY(-0.7) + 0.07 : 0.95;
    this.jibAndTells(b, t, side, belly, luff, ph, (ls) => [[ls * 0.55, ty, -0.62], [ls * 0.82, H.deckY(0.2) + 0.12, 0.2]]);
    { const cw = J.CLEW.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position;
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, cw.y - 0.25, cw.z + 0.15); lz.setXYZ(2, -ls * 0.55, ty, -0.62); lz.setXYZ(3, -ls * 0.82, H.deckY(0.2) + 0.12, 0.2); lz.needsUpdate = true; }
    // the crew: upwind on the windward side deck, the J/70's two forward hiking with their legs over the side (her
    // class allows two; the RS21's none, so hers sit in, feet in the cockpit); downwind sitting in, the trimmer to
    // leeward under the kite; the bow forward to the mast for a hoist or a drop
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, hike = clamp(b.heel / 18, 0.15, 1), bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -0.8, reach = 0.55;
      if (c.i === 0) { x = side * (H.hbAt(z) - 0.2); y = H.deckY(z) + 0.05; yaw = 1.2; lean = up ? 0.15 + 0.15 * hike : 0.1; knee = -1.2; reach = 0.9; }
      else if (c.i === 3 && bowBusy) { x = 0.1; z = J.MAST_Z + 0.45; y = H.deckY(z) + (RS ? 0.05 : 0.2); yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; }
      else if (up && !RS && c.i >= 2) { x = side * (H.hbAt(z) - 0.1); y = H.deckY(z) + 0.07; yaw = 0; lean = 0.15 + 0.5 * hike; knee = -1.85; reach = 0.3; }
      else if (up) { x = side * (H.hbAt(z) - 0.22); y = H.deckY(z) + 0.05; yaw = Math.PI - 0.35; lean = 0.1; knee = -1.2; }
      else { const lee = c.i === 2 && b.kite; x = (lee ? -side : side) * (H.hbAt(z) - 0.25); y = H.deckY(z) + 0.05; yaw = lee ? 0.6 : Math.PI - 0.4; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach }, k);
    }
    // the kite, off the sprit, hoisted nearly to the masthead
    const kf = b.kiteFill ?? (b.kite ? 1 : 0), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)), S = J.SPRIT;
    this.kite.visible = this.kiteSheet.visible = kf > 0.02; this.sprit.visible = kf > 0.02 || !!b.kiteJob;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(3.6, 2.0, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [S.x, S.y + 0.06, S.z], hd = [0, lerp(S.y + 0.6, J.MASTHEAD - 0.3, kf), lerp(S.z, J.MAST_Z - 0.1, kf)], cl = [sd * out, lerp(S.y + 0.3, 1.7, kf), lerp(S.z + 0.5, 1.0, kf)];
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
    hb: (t) => (B / 2) * (t < 0.5 ? 0.72 + 0.28 * Math.sin((t / 0.5) * Math.PI / 2) : Math.max(0, Math.cos(Math.min(1, (t - 0.5) / 0.5) * Math.PI / 2)) ** 0.72),
    sheer: (t) => 0.3 + 0.07 * t ** 1.6,
    depth: (t) => 0.13 * Math.sin(Math.PI * Math.min(1, t * 0.93 + 0.05)) ** 0.7,
    n: (t) => lerp(2.6, 1.9, clamp((t - 0.4) / 0.6, 0, 1)),
  });
  const MAST_Z = hull.BOW + 1.0, MAST_FOOT = hull.deckY(MAST_Z) + 0.07, MASTHEAD = MAST_FOOT + 6.1, BOOM_Y = MAST_FOOT + 0.68, BL = 2.7; // the mast's foot on the deck's 5 cm crown
  const chord = (f) => lerp(2.45, 0.15, f) + 0.12 * Math.sin(Math.PI * f);
  const span = MASTHEAD - 0.08 - BOOM_Y;
  const rig = rigOf({ span, chord, numAt: 0.5, logoAt: 0.7, flagAt: 0.86, mark: 0.5, head: new THREE.Vector3(0, MASTHEAD, MAST_Z), tack: new THREE.Vector3(0, BOOM_Y, MAST_Z), clew: new THREE.Vector3(0, 0, BL), ad: 0.5, adH: 0.3 });
  return { L, B, hull, MAST_Z, MAST_FOOT, MASTHEAD, BOOM_Y, BL, chord, span, rig, CK: [0.05, 1.55], FLOOR: 0.13, TRAV_Z: hull.STERN - 0.2 };
})();

class LaserView extends ClassView {
  constructor({ look = LOOKS.player, label = null, player = false, cls = CLS }) {
    super();
    this.cls = cls;
    const add = this.start(), T = this.tilt, H = LZ.hull, [cz0, cz1] = LZ.CK;
    this.flyY = 0;
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
    // the bow's handle and eye, the drain bung in the transom
    const bz = H.BOW + 0.32;
    T.add(tube([[-0.07, deckAt(0.07, bz) - 0.01, bz], [-0.06, deckAt(0, bz) + 0.05, bz], [0.06, deckAt(0, bz) + 0.05, bz], [0.07, deckAt(0.07, bz) - 0.01, bz]], 0.009, M.steel));
    add(cyl(0.022, 0.022, 0.02, M.dark, 10), 0.18, 0.2, H.STERN + 0.005).rotation.x = Math.PI / 2;
    // the hiking strap down the middle of the cockpit floor, from its front to the shock cord at the back
    const strap = MAT.strap;
    T.add(tube([[0, LZ.FLOOR + 0.02, cz0 + 0.1], [0, LZ.FLOOR + 0.07, cz0 + 0.5], [0, LZ.FLOOR + 0.07, cz1 - 0.35], [0, LZ.FLOOR + 0.03, cz1 - 0.05]], 0.02, strap));
    // the daggerboard: a slim foil down through its case in the deck, its head and handle standing proud
    const DBZ = cz0 - 0.2;
    add(new THREE.Mesh(finGeo(0.9, 0.31, 0.26, 0.08, 0.04), MAT.fin), 0, -0.08, DBZ);
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
    add(new THREE.Mesh(finGeo(0.82, 0.25, 0.18, 0.09, 0.07), MAT.fin), 0, 0.02, RZ + 0.1);
    for (const y of [0.1, 0.3]) { add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.06), M.steel), 0, y, H.STERN + 0.02); add(cyl(0.008, 0.008, 0.07, M.steel, 6), 0, y - 0.02, H.STERN + 0.05); } // gudgeons and pintles
    // the tiller over the aft deck and its extension, swinging with the helm
    this.wheel = add(new THREE.Group(), 0, deckAt(0, H.STERN) + 0.04, RZ);
    const tl = cyl(0.016, 0.02, 0.95, M.alu, 8); tl.rotation.x = Math.PI / 2 + 0.05; tl.position.set(0, 0.04, -0.47); this.wheel.add(tl);
    const uj = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), M.dark); uj.position.set(0, 0.06, -0.94); this.wheel.add(uj); // the extension's universal joint
    const grip = cyl(0.022, 0.022, 0.13, M.dark, 8); grip.rotation.x = Math.PI / 2; grip.position.set(0, 0.04, -0.12); this.wheel.add(grip);
    this.ext = cyl(0.01, 0.01, 1.1, M.dark, 6); this.ext.rotation.set(0, 0.5, Math.PI / 2); this.ext.position.set(0.45, 0.06, -1.15); this.wheel.add(this.ext); // to the side she sits
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
    // the mast: two alloy sections, unstayed, the top one thinner; its step a collar in the deck
    add(new THREE.Mesh(mastGeo(LZ.MASTHEAD - LZ.MAST_FOOT, 0.064, 0.064, 0.046, 0.046, 0.5), M.alu), 0, (LZ.MAST_FOOT + LZ.MASTHEAD) / 2, LZ.MAST_Z);
    add(cyl(0.045, 0.05, 0.04, M.dark, 12), 0, LZ.MAST_FOOT, LZ.MAST_Z);
    add(cyl(0.036, 0.036, 0.06, M.dark, 10), 0, LZ.MAST_FOOT + 3.1, LZ.MAST_Z); // the joint
    // the boom, its kicker (a tackle from the mast's foot) and its outhaul, turning with the sail
    this.mainPivot = add(new THREE.Group(), 0, 0, LZ.MAST_Z);
    const gear = new THREE.Group();
    const boom = cyl(0.025, 0.025, LZ.BL, M.alu, 10); boom.rotation.x = Math.PI / 2; boom.position.set(0, LZ.BOOM_Y, LZ.BL / 2 + 0.03); gear.add(boom);
    // the kicker: a tackle from a block at the mast's foot to its strop on the boom, the falls between them
    for (const [g, mm] of block(0.018)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.MAST_FOOT + 0.1, 0.06); gear.add(o); }
    for (const [g, mm] of block(0.018)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.08, 0.6); gear.add(o); }
    const VA = [0, LZ.MAST_FOOT + 0.12, 0.07], VB = [0, LZ.BOOM_Y - 0.1, 0.59];
    this.mainPivot.add(line([0, 1, 2, 3, 4, 5].map((i) => { const e = i % 2 ? VB : VA, dx = (i / 5 - 0.5) * 0.03; return [e[0] + dx, e[1], e[2]]; })));
    // the outhaul along the boom from the clew to its turning block at the gooseneck
    this.mainPivot.add(line([[0.02, LZ.BOOM_Y + 0.04, LZ.BL - 0.05], [0.02, LZ.BOOM_Y + 0.02, 0.1], [0.06, LZ.MAST_FOOT + 0.05, 0.06]]));
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.06), M.dark).translateY(LZ.BOOM_Y + 0.04).translateZ(LZ.BL - 0.04)); // the clew's strap
    gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.09), M.dark).translateY(LZ.BOOM_Y).translateZ(0.04)); // the gooseneck
    for (const [g, mm] of block(0.02)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.05, LZ.BL - 0.06); gear.add(o); }
    for (const [g, mm] of block(0.02)) { const o = new THREE.Mesh(g, mm); o.position.set(0, LZ.BOOM_Y - 0.05, 1.45); gear.add(o); }
    this.mainPivot.add(mergeGroup(gear));
    // the window low in the sail, clear plastic sewn in to see to leeward under the boom
    const wtex = onCloth(sailTexture('main', look, LZ.rig), (x, w, h, X) => {
      const y0 = h * (1 - 0.23), y1 = h * (1 - 0.12), x0 = Math.min(X(0.36), X(0.64)), x1 = Math.max(X(0.36), X(0.64)); // even about the middle: both faces read one canvas
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
    this.mainsheet = line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]); this.mainsheet.frustumCulled = false; T.add(this.mainsheet);
    // no jib and no kite: the parts the game asks for, never shown
    const none = sailTexture('kite', look);
    this.jib = sailMesh(2, 2, none, false, 'jib'); this.jib.visible = false;
    this.kite = sailMesh(2, 2, none, false, 'kite'); this.kite.visible = false;
    this.sprit = new THREE.Group(); this.kiteSheet = new THREE.Group(); this.lazySheet = new THREE.Group(); this.jibSheet = new THREE.Group();
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 0.95, 0.19, 0.42, 0.15));
    { const z = H.STERN - 0.55; T.add(...nameDecal(H, look, z, H.deckY(z) - 0.09, 0.5)); }
    this.windex = windex(add, LZ.MASTHEAD + 0.02, LZ.MAST_Z);
    // her one sailor
    const m = crewMats(look), s = sailor({ ...m, skin: new THREE.MeshStandardMaterial({ color: SKINS[0], roughness: 0.65 }) });
    T.add(s.g);
    this.crew = [{ g: s.g, s, z0: 1.05, i: 0, x: 0, y: H.deckY(1.05), z: 1.05, yaw: Math.PI, lean: 0, stand: 0, knee: -0.8, reach: 0.5 }];
    this.eye = [0.85, 1.2, 1.15]; // the helm view: her head as she hikes
    this.finish(label, 8);
  }
  update(b, t, W, showLabel) {
    const H = LZ.hull, side = this.place(b, t, W);
    this.wheel.rotation.y = b.rudder * 0.5;
    this.ext.position.x = side * 0.45; this.ext.rotation.y = side * 0.5;
    const sa = b.sail * D2R, luff = b.luff, ph = t * 17;
    this.mainPivot.rotation.y = -this.sailSide * sa;
    // the sleeve round the mast gives the luff an even entry; the full sail sets deep low down and flattens up high
    const belly = -this.sailSide * (1 - luff * 0.85), span = LZ.span, shape = (f, u) => belly * Math.sin(Math.PI * u ** 0.75) * LZ.chord(f) * 0.12 * (1 - 0.45 * f);
    setSail(this.main, (f, u, v) => {
      const ch = LZ.chord(f), tw = -this.sailSide * f * f * 0.3 * u;
      v.set(shape(f, u) + tw + luff * 0.12 * Math.sin(ph + f * 6 + u * 5) * u + leechFlutter(f, u, t, b.aws || 0), LZ.BOOM_Y + 0.06 + f * span, u * ch + 0.03);
    });
    // the sheet: traveller → boom end → middle block → ratchet, the block on the traveller riding to leeward
    const ma = this.mainPivot.rotation.y, at = (z, dy) => [Math.sin(ma) * z, LZ.BOOM_Y - dy, LZ.MAST_Z + Math.cos(ma) * z];
    this.travCar.position.x = clamp(Math.sin(ma) * 1.6, -0.36, 0.36);
    const ms = this.mainsheet.geometry.attributes.position, ty = H.deckY(LZ.TRAV_Z) + 0.13;
    [[this.travCar.position.x, ty, LZ.TRAV_Z], at(LZ.BL - 0.06, 0.07), at(LZ.BL - 0.06, 0.05), at(1.45, 0.07), [0, LZ.FLOOR + 0.12, LZ.CK[0] + 0.12]].forEach((p, i) => ms.setXYZ(i, ...p));
    ms.needsUpdate = true;
    this.windex.rotation.y = -b.awa;
    for (const tt of this.tells) {
      const { f, sx } = tt.userData, windward = sx === side, u = 0.35 / LZ.chord(f);
      tt.position.set(shape(f, u) + sx * 0.02, LZ.BOOM_Y + 0.06 + f * span, 0.38);
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
    this.pose(c, want, k);
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
  const rig = rigOf({ span: MASTHEAD - 0.45 - BOOM_Y, chord, numAt: 0.6, logoAt: 0.76, flagAt: 0.88, mark: 1.2, head: HEAD, tack: TACK, clew: CLEW, ad: 2.4, adH: 1.2 });
  return { L, B, hull, COACH, coachY, ROOF, SHEET_Z, MAST_Z, MAST_FOOT, MASTHEAD, HOUNDS, BOOM_Y, BL, SPR, chord, TACK, HEAD, CLEW, SPRIT, FLOOR, CK, HELM, PLAT, rig, WHEEL_Z: 5.95, WHEEL_X: 0.88, WINCH_Z: 4.9, WINCH_X: 1.34, FEET_Z: MAST_Z + 2.95 };
})();
const coamY = (z) => BV.hull.deckY(z) + BV.COACH.coam + 0.035; // the coamings' top, where the primary winches stand
// her moulded parts, modelled in Blender on the lines above (blender/bavaria46.py → bavaria46.glb): the hull with its
// rounded deck edge, the deck, the coachroof with its windows, the cockpit cut through the transom, its benches and
// coamings; by material name. Asked for only on a page that will build her (her races, her boat page, the fleet), by
// the address the import map gives it (its hash after a deploy, as yacht.js's yacht.glb); if it doesn't come in 8 s,
// she is built from the lines in code instead.
const fileAt = (f) => (import.meta.resolve ? import.meta.resolve(`./${f}`) : new URL(f, import.meta.url).href);
const ON_FLEET = /fleet-view/.test(globalThis.location?.pathname || ''); // the fleet page: every yacht in your colours, the cruiser's sails too
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
    const cloth = ON_FLEET ? look : dacron(look);
    const mtex = sailTexture('main', cloth, BV.rig);
    this.main = sailMesh(24, 12, mtex, cloth.laminate, 'main'); this.mainPivot.add(this.main);
    // the genoa on the forestay, sheeted through its car on the side deck to the primary winch
    this.TACK = BV.TACK; this.HEAD = BV.HEAD; this.CLEW = BV.CLEW; this.jibMax = 32; this.jibBelly = 0.13;
    this.jibPivot = add(new THREE.Group(), BV.TACK.x, BV.TACK.y, BV.TACK.z);
    this.jibAxis = BV.HEAD.clone().sub(BV.TACK).normalize();
    // the furling genoa, a navy strip of sun cloth down its leech and along its foot, to cover it when it's rolled away
    const jtex = onCloth(sailTexture('jib', cloth, BV.rig), (x, w, h, X) => { x.fillStyle = '#22385a'; x.fillRect(Math.min(X(0.93), X(1)), 0, w * 0.07, h); x.fillRect(0, h * 0.975, w, h * 0.025); });
    this.jib = sailMesh(18, 9, jtex, cloth.laminate, 'jib'); this.jibPivot.add(this.jib);
    this.kite = sailMesh(16, 10, sailTexture('kite', look), false, 'kite'); this.kite.visible = false; T.add(this.kite);
    this.makeTells(player);
    if (look.logo) for (const sx of [-1, 1]) T.add(logoDecal(H, sx, look.logo, H.BOW + 2.4, 1.15, 1.3, 0.48));
    T.add(...bowNumber(H, look, H.BOW + 1.05, 1.25, 0.95, 0.26));
    { const z = H.STERN - 1.4; T.add(...nameDecal(H, look, z, H.deckY(z) - 0.25, 1.7)); }
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
    this.mainPivot.rotation.y = -this.sailSide * sa;
    const belly = -this.sailSide * (1 - luff * 0.85), span = BV.rig.span;
    setSail(this.main, (f, u, v) => {
      const ch = BV.chord(f), tw = -this.sailSide * f * f * 0.6 * u;
      v.set(belly * Math.sin(Math.PI * u ** 0.78) * ch * 0.11 * (1 - 0.4 * f) + tw + luff * 0.25 * Math.sin(ph + f * 6 + u * 5) * u + leechFlutter(f, u, t, b.aws || 0), BV.BOOM_Y + 0.1 + f * span, u * ch + 0.17);
    });
    // the mainsheet's two tackles, from their blocks on the coachroof up to the bail under the boom
    const ma = this.mainPivot.rotation.y, bail = [Math.sin(ma) * BV.SHEET_Z, BV.BOOM_Y - 0.17, BV.MAST_Z + Math.cos(ma) * BV.SHEET_Z];
    this.sheets.forEach((l, i) => purchase(l, [(i ? 0.62 : -0.62), BV.ROOF + 0.12, BV.FEET_Z], bail, 0.04));
    // the genoa and its sheets: the working one through the car to the winch, the lazy one slack across the foredeck
    const gz = BV.MAST_Z + 1.4, gx = (s) => s * (H.hbAt(gz) - 0.4), wy = coamY(BV.WINCH_Z) + 0.18, wx = (s) => s * BV.WINCH_X;
    this.jibAndTells(b, t, side, belly, luff, ph, (ls) => [[gx(ls), H.deckY(gz) + 0.1, gz], [wx(ls), wy, BV.WINCH_Z]]);
    { const cw = BV.CLEW.clone().applyQuaternion(this.jibPivot.quaternion).add(this.jibPivot.position), ls = cw.x < 0 ? -1 : 1, lz = this.lazySheet.geometry.attributes.position;
      lz.setXYZ(0, cw.x, cw.y, cw.z); lz.setXYZ(1, 0, cw.y - 0.5, cw.z + 0.4); lz.setXYZ(2, gx(-ls), H.deckY(gz) + 0.1, gz); lz.setXYZ(3, wx(-ls), wy, BV.WINCH_Z); lz.needsUpdate = true; }
    // the crew: the helm stands behind the windward wheel; the trimmers sit to windward upwind, the gennaker's
    // trimmer to leeward off the wind; the two forward sit out on the windward side deck, legs over the side, and one
    // goes to the mast for a hoist or a drop
    const k = this.crewDt(t), up = Math.abs(b.twa) < 95 * D2R, bowBusy = !!b.kiteJob;
    for (const c of this.crew) {
      let x, y, z = c.z0, yaw = Math.PI, lean = 0.12, stand = 0, knee = -1.4, reach = 0.55;
      if (c.i === 0) { x = side * BV.WHEEL_X; y = BV.FLOOR + 0.02; yaw = Math.PI / 2 + 0.25; stand = 1; lean = 0.1; knee = -0.3; reach = 1.0; }
      else if (c.i === 1) { x = side * (BV.CK[1] - 0.3); y = BV.FLOOR + 0.43; yaw = Math.PI - 0.5; reach = 0.8; }
      else if (c.i === 2) { const lee = !up && b.kite; x = (lee ? -side : side) * (BV.CK[1] - 0.25); y = BV.FLOOR + 0.43; yaw = Math.PI - 0.9; reach = 0.9; }
      else if (c.i === 4 && bowBusy) { x = 0.25; z = BV.MAST_Z + 0.45; y = BV.ROOF + 0.02; yaw = Math.PI / 2; stand = 1; lean = 0.3; reach = 0.8; }
      else if (up) { x = side * (H.hbAt(z) - 0.12); y = H.deckY(z) + 0.07; yaw = 0; lean = 0.2; knee = -1.85; reach = 0.3; }
      else { x = side * (H.hbAt(z) - 0.45); y = H.deckY(z) + 0.06; yaw = Math.PI - 0.5; knee = -1.2; }
      this.pose(c, { x, y, z, yaw, lean, stand, knee, reach }, k);
    }
    // the gennaker, tacked to the sprit and hoisted to the hounds
    const kf = b.kiteFill ?? (b.kite ? 1 : 0), kfill = kf * kf * (1 - 0.65 * (b.kiteCollapse || 0)), S = BV.SPRIT;
    this.kite.visible = this.kiteSheet.visible = kf > 0.02;
    if (kf > 0.02) {
      const a = Math.abs(b.twa) / D2R, out = lerp(6.2, 3.6, clamp((a - 95) / 80, 0, 1)) * lerp(0.15, 1, kfill), sd = -this.sailSide;
      const tk = [S.x, S.y + 0.1, S.z], hd = [0, lerp(S.y + 1.0, BV.HOUNDS + 0.2, kf), lerp(S.z, BV.MAST_Z - 0.2, kf)], cl = [sd * out, lerp(S.y + 0.5, 3.4, kf), lerp(S.z + 1.0, 1.2, kf)];
      setSail(this.kite, (f, u, v) => {
        const lx = sd * Math.sin(Math.PI * f) * 2.6 * kfill, lz = -Math.sin(Math.PI * f) * 2.8 * kfill;
        const p = [lerp(tk[0], hd[0], f) + lx, lerp(tk[1], hd[1], f), lerp(tk[2], hd[2], f) + lz];
        const q = [lerp(cl[0], hd[0], f), lerp(cl[1], hd[1], f), lerp(cl[2], hd[2], f)];
        const bul = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, f * 1.08)) * 3.0 * kfill;
        v.set(lerp(p[0], q[0], u) + sd * bul, lerp(p[1], q[1], u), lerp(p[2], q[2], u) - bul * 0.9);
      });
      const kp = this.kiteSheet.geometry.attributes.position, qz = H.STERN - 0.7;
      kp.setXYZ(0, cl[0], cl[1], cl[2]); kp.setXYZ(1, sd * (H.hbAt(qz) - 0.1), H.deckY(qz) + 0.1, qz); kp.setXYZ(2, sd * BV.WINCH_X, wy, BV.WINCH_Z); kp.needsUpdate = true;
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
  const rig = rigOf({ span: MASTHEAD - 0.4 - FOOT_Y, chord, numAt: 0.5, logoAt: 0.7, flagAt: 0.84, mark: 2.6, head: HEAD, tack: TACK, clew: CLEW, ad: 3.6, adH: 1.6 });
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
    { const z = H.STERN - 3.6; T.add(...nameDecal(H, look, z, H.deckY(z) - 0.45, 4.2)); }
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
    this.mainPivot.rotation.y = -this.sailSide * sa;
    this.mast.rotation.y = this.mainPivot.rotation.y - this.sailSide * Math.min(sa, 0.5) * 0.3; // the mast turns a little further than the sail's foot to line up with it
    const belly = -this.sailSide * (1 - luff * 0.85), span = A.rig.span;
    // the double skin: a deep, even camber all the way up, a little twist off at the head; the two skins stand apart
    // round the mast (its width) and close to the leech
    // the sail turns about the upright through its tack; each height carried aft (in the boat's frame, whichever way
    // the sail is turned) by the mast's rake there, so the luff stays on the mast
    const psi = this.mainPivot.rotation.y, rs = -Math.sin(psi), rc = Math.cos(psi);
    for (const [mesh, sk] of [[this.main, 1], [this.main2, -1]]) setSail(mesh, (f, u, v) => {
      const ch = A.chord(f), tw = -this.sailSide * f * f * 0.9 * u, gap = 0.24 * (1 - 0.5 * f) * (1 - u) ** 1.6, y = A.FOOT_Y + f * span, o = (y - A.FOOT_Y) * A.RAKE;
      v.set(belly * Math.sin(Math.PI * u ** 0.7) * ch * 0.1 + tw + sk * gap + luff * 0.3 * Math.sin(ph + f * 6 + u * 5) * u + o * rs, y, u * ch + o * rc);
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
        this.pose(c, { x: c.sx * 1.55, y: fy - 0.05, z: c.z0, yaw: c.i === 0 ? Math.PI / 2 + 0.35 : wind ? 0.9 : Math.PI / 2, stand: 1, knee: -0.4,
          lean: c.i === 1 && wind ? 0.35 + 0.1 * Math.sin(t * 3 + c.ph) : 0.2, reach: c.i === 0 ? 1.0 : wind ? 1.1 + 0.25 * Math.sin(t * 2.5 + c.ph) : 0.7 }, k);
      }
    }
    this.showLabel(b, showLabel);
  }
}

// the moulded parts of the Bavaria (blender/bavaria46.py), the Laser (blender/laser.py), the J/70 and the RS21
// (blender/sportboats.py) and the AC75 (blender/ac75.py), each asked for only on a page that will build her (her races,
// her boat page, the fleet). Here at the end, once every class's lines are laid down: the views read them only when a
// boat is built, after this module has loaded
const [BV_MODEL, LZ_MODEL, J70_MODEL, RS21_MODEL, AC75_MODEL] = await Promise.all([
  CLS.id !== 'bavaria46' && !ON_FLEET ? null : loadModel('bavaria46.glb', BV.hull, [['deck', 1], ['roof', 1], ['teak', 1 / 0.8]]),
  CLS.id !== 'laser' && !ON_FLEET ? null : loadModel('laser.glb', LZ.hull, [['deck', 1]]),
  CLS.id !== 'j70' && !ON_FLEET ? null : loadModel('j70.glb', sportOf(false).hull, [['deck', 1]]),
  CLS.id !== 'rs21' && !ON_FLEET ? null : loadModel('rs21.glb', sportOf(true).hull, [['deck', 1]]),
  CLS.id !== 'ac75' && !ON_FLEET ? null : loadModel('ac75.glb', A.hull, [['deck', 1]]),
]);
