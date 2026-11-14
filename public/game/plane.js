// Regatta: a light plane towing an advertising banner low over the course now and then, as they do along any coast
// in summer — a high-wing single-engine taildragger, 45 m of tow rope, and a letter banner that ripples in the
// slipstream. All picture (and, in main.js, the engine's drone): nothing here touches the race.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from './sim.js';
import { sponsor } from './sponsor.js';

// what the banner says until /sponsor answers, or when the admin has set nothing: the first words in navy, the second in red
export const BANNER = ['RYCRENTALS.COM', 'RENT YACHTS HERE!'];

const rnd = (a, b) => a + Math.random() * (b - a);
const SPEED = 28; // m/s, about 55 kn: a banner tow's cruise, slow enough to read
const ROPE = 45, ROPE_DROP = 8 * Math.PI / 180, SAG = 1.4; // the tow rope: length, how steeply it runs down aft, its sag
const BANNER_H = 4.6; // metres, top to bottom; the length follows from the lettering
const NX = 64, NY = 4; // the banner's grid
const PASS = 1800; // metres of each pass, half before the point nearest you and half after (fog hides the ends)
const MID = 900; // metres either side of that point that should be over water
const STEP = 20, CLIMB = 0.18; // her height profile: its spacing, and the steepest she climbs or comes down

// ---------- shapes ----------
function paint(g, fn) {
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { fn(c, P.getX(i), P.getY(i), P.getZ(i)); c.toArray(col, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const solid = (g, hex) => { const k = new THREE.Color(hex); return paint(g, (c) => c.copy(k)); };
// a round rod from a to b
function rod(a, b, r, hex) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return solid(g, hex);
}
// a flat shape drawn in (back, up), given some thickness across
function fin(pts, depth) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2).rotateY(-Math.PI / 2);
}

const WHITE = '#f4f5f3', BLUE = '#1f6fb2', DARK = '#23282d', GLASS = '#2b3a46';
// 7 m long and 10.7 m across the wing, nose at −z: white with a blue cheat line, cowling and fin
function planeGeometry() {
  // the fuselage, turned from a profile (radius, along) and lifted towards the tail as a Cub's is
  const prof = [[0.02, 0], [0.32, 0.04], [0.48, 0.3], [0.56, 0.9], [0.58, 1.9], [0.5, 3.1], [0.32, 4.9], [0.14, 6.6], [0.02, 6.75]].map(([r, y]) => new THREE.Vector2(r, y));
  let f = new THREE.LatheGeometry(prof, 14).rotateX(Math.PI / 2).translate(0, 0, -3.35).scale(1, 1.22, 1);
  const P = f.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + Math.max(0, P.getZ(i) + 0.5) * 0.07);
  f.computeVertexNormals();
  const white = new THREE.Color(WHITE), blue = new THREE.Color(BLUE), glass = new THREE.Color(GLASS);
  f = paint(f, (c, x, y, z) => {
    if (z < -2.75) c.copy(blue); // the cowling
    else if (z > -2.2 && z < -0.4 && y > 0.12 + Math.max(0, z + 0.4) * 0.05) c.copy(glass); // the cabin's windows
    else if (Math.abs(y - (0.02 + Math.max(0, z + 0.5) * 0.07)) < 0.09) c.copy(blue); // the cheat line, rising aft
    else c.copy(white);
  });
  const parts = [f];
  // the wing on top of the cabin, blue at the tips
  parts.push(paint(new THREE.BoxGeometry(10.7, 0.14, 1.6).translate(0, 0.78, -1.25), (c, x) => c.set(Math.abs(x) > 4.9 ? BLUE : WHITE)));
  for (const sx of [-1, 1]) {
    parts.push(rod([sx * 0.5, -0.35, -1.6], [sx * 2.7, 0.72, -1.7], 0.035, '#c9cdd0')); // the wing struts
    parts.push(rod([sx * 0.5, -0.35, -1.0], [sx * 2.7, 0.72, -0.7], 0.035, '#c9cdd0'));
    parts.push(rod([sx * 0.3, -0.55, -1.9], [sx * 0.95, -1.15, -2.0], 0.04, DARK)); // the main gear
    parts.push(solid(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12).rotateZ(Math.PI / 2).translate(sx * 1.0, -1.2, -2.0), DARK));
  }
  parts.push(solid(new THREE.BoxGeometry(3.4, 0.07, 0.85).translate(0, 0.52, 2.95), WHITE)); // the tailplane
  parts.push(solid(fin([[0, 0], [1.2, 0], [1.15, 0.2], [0.85, 1.3], [0.45, 1.32], [0.15, 0.35]], 0.08).translate(0, 0.52, 2.35), BLUE)); // the fin
  parts.push(solid(new THREE.SphereGeometry(0.09, 6, 4).translate(0, 0.02, 3.35), DARK)); // the tail wheel
  parts.push(solid(new THREE.ConeGeometry(0.15, 0.38, 10).rotateX(-Math.PI / 2).translate(0, 0, -3.5), '#e8eaec')); // the spinner
  return mergeGeometries(parts);
}

// the lettering, on a canvas: off-white cloth with a navy hem, the first words in navy, a red dot, the second in red
// (one part alone: just the navy words)
function bannerTexture(lines, anisotropy) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), H = 256, px = 196;
  const font = `900 ${px}px Impact, "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  x.font = font;
  const two = lines.length > 1 && !!lines[1];
  const gap = two ? px * 0.75 : 0, w0 = x.measureText(lines[0]).width, w1 = two ? x.measureText(lines[1]).width : 0, pad = px * 0.5;
  const W = w0 + gap + w1 + 2 * pad, k = Math.min(1, 4096 / W);
  c.width = Math.ceil(W * k); c.height = H;
  x.scale(k, 1);
  x.fillStyle = '#f7f5ef'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#0b2a4a'; x.fillRect(0, 0, W, 12); x.fillRect(0, H - 12, W, 12);
  x.font = font; x.textBaseline = 'middle';
  x.fillStyle = '#0b2a4a'; x.fillText(lines[0], pad, H / 2 + 6);
  if (two) {
    x.fillStyle = '#d7262e'; x.beginPath(); x.arc(pad + w0 + gap / 2, H / 2, px * 0.07, 0, 2 * Math.PI); x.fill();
    x.fillText(lines[1], pad + w0 + gap, H / 2 + 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anisotropy;
  return { tex, aspect: W / H };
}

export class BannerPlane {
  constructor(anisotropy = 4) {
    this.group = new THREE.Group(); // at the origin: the rope and the banner are drawn in world space
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
    this.craft = new THREE.Group(); this.craft.rotation.order = 'YXZ';
    this.craft.add(new THREE.Mesh(planeGeometry(), mat));
    // the propeller: a pale disc where the blades blur, and the blades themselves turning through it
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: '#8b9196', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.z = -3.42;
    this.prop = new THREE.Mesh(solid(new THREE.BoxGeometry(1.9, 0.12, 0.03), DARK), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    this.prop.position.z = -3.4;
    this.craft.add(disc, this.prop);
    this.group.add(this.craft);

    // the tow rope and the bridle to the banner's pole
    this.ropeN = 14;
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.ropeN + 3) * 3), 3));
    this.rope = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: '#3a3d40', transparent: true, opacity: 0.85 }));
    this.pole = new THREE.Mesh(solid(new THREE.CylinderGeometry(0.06, 0.06, BANNER_H + 0.5, 6), DARK), mat);
    this.weight = new THREE.Mesh(solid(new THREE.SphereGeometry(0.18, 8, 6), DARK), mat);

    // the banner: one sheet, lettered on both faces — the back face reads the same way round, not mirrored
    const { tex, aspect } = bannerTexture(BANNER, anisotropy);
    this.len = clamp(BANNER_H * aspect, 40, 90);
    const bg = new THREE.PlaneGeometry(1, 1, NX, NY);
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, side: THREE.DoubleSide });
    bm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
        'vec2 bannerUv = vMapUv; if (!gl_FrontFacing) bannerUv.x = 1.0 - bannerUv.x; diffuseColor *= texture2D(map, bannerUv);');
    };
    this.banner = new THREE.Mesh(bg, bm);
    this.group.add(this.rope, this.pole, this.weight, this.banner);
    // the admin's words, once /sponsor answers (long before the first pass): a new texture, and the banner's length to suit
    sponsor().then((d) => {
      if (!Array.isArray(d?.banner) || !d.banner.length) return;
      const n = bannerTexture(d.banner, anisotropy);
      bm.map.dispose(); bm.map = n.tex; bm.needsUpdate = true;
      this.len = clamp(BANNER_H * n.aspect, 30, 90);
    });

    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); // where she is and how she goes (for her sound)
    this.on = false; this.race = null;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._d = new THREE.Vector3();
    this.show(false);
  }
  show(v) { this.group.visible = v; }

  // ground(x, z): the land's height in the race's coordinates, so a pass keeps to the water and clears the hills
  reset(race, ground) {
    this.race = race; this.ground = ground || (() => 0);
    this.on = false; this.show(false);
    this.timer = rnd(15, 30); // the first comes over early in the sequence before the start
    this.clock = 0;
  }

  // a pass straight across what you're looking at, side-on so the banner reads, 170–300 m off, and as high as puts the
  // banner a third of the way down the picture (the camera is low and looks down, so 'up in the sky' is out of frame):
  // of a dozen lines tried, the one with the least land under its middle stretch (the first ones tried are the nearest
  // and squarest); out at the ends she climbs over whatever is there
  spawn(cam) {
    const look = cam.getWorldDirection(this._d), lh = Math.atan2(look.x, -look.z);
    let best = null;
    for (let i = 0; i < 12; i++) {
      const sq = i / 11, h = lh + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + rnd(-0.25, 0.25) * (1 + sq)), D = rnd(170, 230) + sq * 70;
      const fx = Math.sin(h), fz = -Math.cos(h), cx = cam.position.x + Math.sin(lh) * D, cz = cam.position.z - Math.cos(lh) * D;
      let top = 0;
      for (let s = -MID; s <= MID; s += 60) top = Math.max(top, this.ground(cx + fx * s, cz + fz * s));
      if (!best || top < best.top) best = { h, D, x0: cx - fx * PASS / 2, z0: cz - fz * PASS / 2, top };
      if (top < 2) break;
    }
    Object.assign(this, best);
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    this.f = { x: fx, z: fz };
    // her height along the pass, every STEP metres: 45 m over any land under her and under the banner trailing
    // behind, never below her cruising height, and changing no steeper than she can climb
    const base = this.cruise(cam, best.D), n = Math.ceil((PASS + 200) / STEP) + 1, g = new Float32Array(n), a = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = this.ground(this.x0 + fx * i * STEP, this.z0 + fz * i * STEP); // below 0: the sea's floor
    const back = Math.ceil(130 / STEP);
    for (let i = 0; i < n; i++) { let m = -1e9; for (let j = Math.max(0, i - back); j <= Math.min(n - 1, i + 2); j++) m = Math.max(m, g[j]); a[i] = m > 0 ? Math.max(base, m + 45) : base; }
    for (let i = 1; i < n; i++) a[i] = Math.max(a[i], a[i - 1] - CLIMB * STEP);
    for (let i = n - 2; i >= 0; i--) a[i] = Math.max(a[i], a[i + 1] - CLIMB * STEP);
    this.alts = a;
    this.s = 0; this.on = true; this.show(true);
    this.k = Math.random() * 10;
  }
  // her height for a pass D m off along the camera's look: the banner (hung ROPE·sin(ROPE_DROP) below her) where the
  // ray through a third of the way down the picture meets that distance; never so low the banner skims the waves
  cruise(cam, D) {
    const r = this._a.set(0, 0.35, 0.5).unproject(cam).sub(cam.position), hz = Math.hypot(r.x, r.z);
    const y = cam.position.y + (hz > 1e-6 ? r.y / hz : 0) * D;
    return clamp(y + ROPE * Math.sin(ROPE_DROP) + rnd(-1, 1), BANNER_H / 2 + ROPE * Math.sin(ROPE_DROP) + 4, 45);
  }
  altAt(s) {
    const a = this.alts, x = clamp(s / STEP, 0, a.length - 1.001), i = Math.floor(x), u = x - i;
    return a[i] + (a[i + 1] - a[i]) * u;
  }

  // ready: the camera is where it will stay a while (not in the opening fly-in), so a pass can be laid across its view
  update(dt, cam, ready = true) {
    if (!this.race) return;
    this.clock += dt;
    if (!this.on) {
      this.timer -= dt;
      if (this.timer > 0 || dt <= 0 || !ready) return;
      this.spawn(cam);
    }
    this.s += SPEED * dt;
    if (this.s > PASS + ROPE + this.len) { this.on = false; this.show(false); this.timer = rnd(60, 120); return; }
    const t = this.clock + this.k, f = this.f;
    // she holds her line and height, give or take the air
    const bob = 0.9 * Math.sin(t * 0.37) + 0.3 * Math.sin(t * 1.13), yaw = 0.025 * Math.sin(t * 0.23);
    const h = this.h + yaw, climb = (this.altAt(this.s + 10) - this.altAt(this.s - 10)) / 20;
    this.p.set(this.x0 + f.x * this.s, this.altAt(this.s) + bob, this.z0 + f.z * this.s);
    this.v.set(f.x * SPEED, climb * SPEED + 0.9 * 0.37 * Math.cos(t * 0.37), f.z * SPEED);
    const c = this.craft;
    c.position.copy(this.p);
    c.rotation.set(0.06 + Math.atan(climb) + 0.02 * Math.cos(t * 0.37), -h, 0.035 * Math.sin(t * 0.61));
    this.prop.rotation.z += dt * 47; // about 2,700 rpm shown as a flicker through the disc
    c.updateMatrixWorld(true);

    // the tow: from the hook under her tail, down and aft to the bridle, which spreads to the pole's ends
    const hook = this._a.set(0, -0.05, 3.4).applyMatrix4(c.matrixWorld);
    const bx = -f.x, bz = -f.z, lx = -Math.cos(this.h), lz = -Math.sin(this.h); // aft, and to her left
    const sway = 0.8 * Math.sin(t * 0.5);
    const B = this._b.set(hook.x + bx * ROPE * Math.cos(ROPE_DROP) + lx * sway, hook.y - ROPE * Math.sin(ROPE_DROP), hook.z + bz * ROPE * Math.cos(ROPE_DROP) + lz * sway);
    const poleX = B.x + bx * 2.5, poleZ = B.z + bz * 2.5, top = B.y + BANNER_H / 2, bot = B.y - BANNER_H / 2;
    const R = this.rope.geometry.attributes.position;
    for (let i = 0; i <= this.ropeN; i++) {
      const u = i / this.ropeN;
      R.setXYZ(i, hook.x + (B.x - hook.x) * u, hook.y + (B.y - hook.y) * u - SAG * 4 * u * (1 - u), hook.z + (B.z - hook.z) * u);
    }
    R.setXYZ(this.ropeN + 1, poleX, top, poleZ); R.setXYZ(this.ropeN + 2, poleX, bot, poleZ);
    R.needsUpdate = true; this.rope.geometry.computeBoundingSphere();
    this.pole.position.set(poleX, B.y, poleZ); this.weight.position.set(poleX, bot - 0.2, poleZ);

    // the banner, streaming aft of the pole: ripples running down it, growing towards the free end, which also wanders
    const G = this.banner.geometry, P = G.attributes.position, L = this.len, w = 2 * Math.PI * 1.7, kk = (2 * Math.PI) / 13;
    for (let iy = 0, n = 0; iy <= NY; iy++) {
      const v = iy / NY, y = top - v * BANNER_H;
      for (let ix = 0; ix <= NX; ix++, n++) {
        const u = ix / NX, s = u * L;
        const fl = (0.05 + 0.7 * u * u) * Math.sin(kk * s - w * t) + 1.4 * u * u * Math.sin(t * 0.43) + 0.15 * u * (v - 0.5) * Math.sin(kk * 0.7 * s - w * 0.8 * t);
        P.setXYZ(n, poleX + bx * s + lx * fl, y + 0.2 * u * Math.sin(t * 0.8 + s * 0.09), poleZ + bz * s + lz * fl);
      }
    }
    P.needsUpdate = true; G.computeVertexNormals(); G.computeBoundingSphere();
  }
}
