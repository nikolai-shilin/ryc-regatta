// The inflatable racing mark, built as the real ones are: a fluorescent PVC cylinder of eight welded panels, each
// blown out a little between its seams and the whole barrel bellied out a touch at its middle, its shoulder rolled
// over to a slightly domed top with a webbing handle and a valve, a white sponsor band round its upper third, a
// webbing strap low down with its D-rings, and a fifth of it under the water. It is worn as marks are after a season:
// the panels not quite one shade, the top bleached by the sun, slack creases low down where the pressure tells least,
// the crimps at the top weld, black scuffs at rubbing-strake height where the boats have leant on it, and a greenish
// film at the waterline with its streaks. R: its radius; it is 2.2 R tall above the water.
import * as THREE from 'three';

const PANELS = 8, SEGS = PANELS * 12;
const TW = 1024, TH = 1024, NW = 512, NH = 512; // the colour and roughness textures; the normal map

// its profile, from the middle of its bottom round to the middle of its top, for a radius of 1 (y: up from the water)
const BASE = -0.5, H = 2.2, FB = 0.24, FS = 0.36, DOME = 0.08;
function profile() {
  const pts = [];
  for (let i = 0; i <= 4; i++) pts.push([(1 - FB) * (i / 4), BASE]); // the bottom
  for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push([1 - FB + Math.cos(a) * FB, BASE + FB + Math.sin(a) * FB]); }
  const y0 = BASE + FB, y1 = H - FS;
  for (let i = 1; i <= 16; i++) { const t = i / 16; pts.push([1 + 0.03 * Math.sin(Math.PI * t), y0 + (y1 - y0) * t]); } // bellied a touch
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); pts.push([1 - FS + Math.cos(a) * FS, y1 + Math.sin(a) * FS]); }
  for (let i = 1; i <= 6; i++) { const f = i / 6; pts.push([(1 - FS) * (1 - f) + 0.002, H + DOME * Math.sin(f * Math.PI / 2)]); }
  pts[0][0] = 0.002;
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const S = s[s.length - 1];
  return { pts, v: s.map((x) => x / S), S, s };
}
const P = profile();
// where height y on its side (between the bottom's roll and the shoulder) falls on the textures, 0 at the bottom's middle
// and 1 at the top's: the profile's length up to there
function vAt(y) {
  for (let i = 1; i < P.pts.length; i++) {
    const [, ya] = P.pts[i - 1], [, yb] = P.pts[i];
    if (yb >= y && ya <= y && yb > ya) return P.v[i - 1] + (P.v[i] - P.v[i - 1]) * ((y - ya) / (yb - ya));
  }
  return y < 0 ? 0 : 1;
}
const V_SHOULDER = vAt(H - FS), V_TOPWELD = P.v[P.pts.length - 7] + 0.004; // where the top panel is welded on
const py = (v) => (1 - v) * TH; // a point on the textures, as the canvas has it (its top is the mark's top)

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// the colour and roughness of the mark, one canvas each, drawn together
function surface(color) {
  seed = 11;
  const c = document.createElement('canvas'); c.width = TW; c.height = TH;
  const r = document.createElement('canvas'); r.width = TW; r.height = TH;
  const x = c.getContext('2d'), xr = r.getContext('2d');
  const base = new THREE.Color(color), pw = TW / PANELS, tmp = new THREE.Color();
  const css = (col, a = 1) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  const grey = (g, a = 1) => `rgba(${g},${g},${g},${a})`;
  xr.fillStyle = grey(70); xr.fillRect(0, 0, TW, TH); // glossy PVC
  // the panels, no two quite the same shade
  for (let k = 0; k < PANELS; k++) {
    tmp.copy(base).offsetHSL((rnd() - 0.5) * 0.008, 0, (rnd() - 0.5) * 0.035);
    x.fillStyle = css(tmp); x.fillRect(k * pw, 0, pw + 1, TH);
  }
  // the sun has bleached the top and the shoulder
  let g = x.createLinearGradient(0, py(1), 0, py(V_SHOULDER - 0.12));
  g.addColorStop(0, 'rgba(255,240,215,0.2)'); g.addColorStop(1, 'rgba(255,240,215,0)');
  x.fillStyle = g; x.fillRect(0, 0, TW, py(V_SHOULDER - 0.12));
  // the welds: a lapped strip down every seam, a hair darker and glossier, and the ring where the top goes on
  for (let k = 0; k <= PANELS; k++) {
    const sx = k * pw;
    x.fillStyle = css(tmp.copy(base).multiplyScalar(0.8), 0.55); x.fillRect(sx - 4, py(V_TOPWELD), 8, TH);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(sx + 3, py(V_TOPWELD), 1.5, TH);
    xr.fillStyle = grey(45); xr.fillRect(sx - 4, 0, 8, TH);
  }
  x.fillStyle = css(tmp.copy(base).multiplyScalar(0.78), 0.6); x.fillRect(0, py(V_TOPWELD) - 3, TW, 6);
  // the white sponsor band, welded on, with the club's name round it twice
  const b0 = py(vAt(1.75)), b1 = py(vAt(1.32));
  x.fillStyle = '#eef0ee'; x.fillRect(0, b0, TW, b1 - b0);
  xr.fillStyle = grey(95); xr.fillRect(0, b0, TW, b1 - b0);
  x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(0, b0 - 1, TW, 3); x.fillRect(0, b1 - 2, TW, 3);
  x.fillStyle = '#122a4a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 ${Math.round((b1 - b0) * 0.62)}px "Arial Black", Helvetica, Arial, sans-serif`;
  for (let k = 0; k < 2; k++) {
    const cx = (k + 0.5) * (TW / 2);
    x.save(); x.translate(cx, (b0 + b1) / 2); x.scale(1, 1.1); x.fillText('RYC REGATTA', 0, 0); x.restore();
  }
  // the webbing strap low down, black, stitched along both edges
  const w0 = py(vAt(0.42)), w1 = py(vAt(0.3));
  x.fillStyle = '#1d1f22'; x.fillRect(0, w0, TW, w1 - w0);
  xr.fillStyle = grey(225); xr.fillRect(0, w0, TW, w1 - w0);
  x.strokeStyle = 'rgba(160,160,150,0.55)'; x.lineWidth = 1.2; x.setLineDash([5, 4]);
  for (const sy of [w0 + 3, w1 - 3]) { x.beginPath(); x.moveTo(0, sy); x.lineTo(TW, sy); x.stroke(); }
  x.setLineDash([]);
  // black scuffs where the boats have leant on it, at rubbing-strake height, smeared along the way they slid
  for (let i = 0; i < 14; i++) {
    const sx = rnd() * TW, sy = py(vAt(0.35 + rnd() * 0.9)), len = 30 + rnd() * 110, tilt = (rnd() - 0.5) * 0.25;
    x.save(); x.filter = 'blur(1.2px)'; x.translate(sx, sy); x.rotate(tilt);
    for (let j = 0; j < 7; j++) {
      x.strokeStyle = `rgba(25,22,20,${0.05 + rnd() * 0.12})`; x.lineWidth = 0.8 + rnd() * 2.5;
      const o = (rnd() - 0.5) * 10; x.beginPath(); x.moveTo(-len / 2 + rnd() * 15, o); x.lineTo(len / 2 - rnd() * 15, o + (rnd() - 0.5) * 3); x.stroke();
    }
    x.restore();
    xr.fillStyle = grey(150, 0.5); xr.fillRect(sx - len / 2, sy - 6, len, 12);
  }
  // the waterline: a greenish-brown film from below the water up to a ragged edge a hand above it, its streaks
  // running up the panels where the chop has slapped, and the scum line along its top
  const wl = py(vAt(0)), top = py(vAt(0.16));
  g = x.createLinearGradient(0, TH, 0, top);
  g.addColorStop(0, 'rgba(48,62,30,0.85)'); g.addColorStop(0.55, 'rgba(70,82,40,0.6)'); g.addColorStop(1, 'rgba(90,96,52,0)');
  x.fillStyle = g; x.fillRect(0, top, TW, TH - top);
  xr.fillStyle = grey(190); xr.fillRect(0, top, TW, TH - top);
  for (let i = 0; i < 260; i++) {
    const sx = rnd() * TW, h = (wl - top) * (0.3 + rnd() * 1.4);
    x.fillStyle = `rgba(${55 + rnd() * 30},${66 + rnd() * 25},${32 + rnd() * 15},${0.08 + rnd() * 0.18})`;
    x.fillRect(sx, wl - h, 1 + rnd() * 3.5, h + 30);
  }
  x.strokeStyle = 'rgba(120,110,80,0.35)'; x.lineWidth = 2.5; x.beginPath();
  for (let sx = 0; sx <= TW; sx += 8) x.lineTo(sx, wl - 4 + Math.sin(sx * 0.05) * 3 + (rnd() - 0.5) * 3);
  x.stroke();
  // and grime in the welds and the creases above it, fading up
  for (let k = 0; k <= PANELS; k++) {
    g = x.createLinearGradient(0, wl, 0, py(vAt(0.9)));
    g.addColorStop(0, 'rgba(60,62,40,0.3)'); g.addColorStop(1, 'rgba(60,62,40,0)');
    x.fillStyle = g; x.fillRect(k * pw - 5, py(vAt(0.9)), 10, wl - py(vAt(0.9)));
  }
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const map = tex(c); map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap: tex(r) };
}

// its relief, as a normal map: the welds standing proud, the panels' slack creases low down, the crimps where the
// panels are gathered into the top, and the strap
function relief() {
  seed = 29;
  const h = new Float32Array(NW * NH), pw = NW / PANELS;
  const at = (v) => (1 - v) * NH;
  const yTop = at(V_TOPWELD), yShoulder = at(V_SHOULDER), yWL = at(vAt(0)), yCrease = at(vAt(0.95));
  const creases = [];
  for (let i = 0; i < 40; i++) creases.push({ x: rnd() * NW, w: 2 + rnd() * 5, a: 0.4 + rnd() * 0.8, top: yCrease + rnd() * (yWL - yCrease) * 0.6 });
  const crimps = [];
  for (let i = 0; i < 64; i++) crimps.push({ x: rnd() * NW, w: 1.5 + rnd() * 2.5, a: 0.3 + rnd() * 0.5, len: 6 + rnd() * 18 });
  const s0 = at(vAt(0.42)), s1 = at(vAt(0.3));
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
    let z = 0;
    const ds = Math.abs(((i + pw / 2) % pw) - pw / 2); // to the nearest seam
    if (j > yTop) z += 1.6 * Math.exp(-((ds - 1.5) ** 2) / 2) - 0.6 * Math.exp(-((ds - 4.5) ** 2) / 1.5); // the weld, and its edge
    z += 1.4 * Math.exp(-((j - yTop) ** 2) / 3);
    for (const c of creases) if (j > c.top) { // slack creases, deepest at the waterline
      const f = Math.min(1, (j - c.top) / (yWL - c.top + 1)), d = i - c.x;
      z -= c.a * f * Math.exp(-(d * d) / (c.w * c.w));
    }
    if (j > yTop - 30 && j < yShoulder + 6) for (const c of crimps) { // gathered into the top weld
      const d = i - c.x, dj = Math.abs(j - yTop);
      if (dj < c.len) z -= c.a * (1 - dj / c.len) * Math.exp(-(d * d) / (c.w * c.w));
    }
    if (j > s0 && j < s1) z += 0.9 + 0.25 * Math.sin(j * 1.9); // the strap and its weave
    h[j * NW + i] = z;
  }
  const c = document.createElement('canvas'); c.width = NW; c.height = NH;
  const x = c.getContext('2d'), img = x.createImageData(NW, NH), k = 0.9;
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
    const hz = (a, b) => h[Math.min(NH - 1, Math.max(0, b)) * NW + ((a + NW) % NW)];
    const dx = (hz(i + 1, j) - hz(i - 1, j)) * k, dy = (hz(i, j - 1) - hz(i, j + 1)) * k; // canvas down is v down
    const n = Math.hypot(dx, dy, 1), o = (j * NW + i) * 4;
    img.data[o] = (-dx / n * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy / n * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / n * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

let geo = null, normalMap = null;
const looks = new Map();
function body(color) {
  if (!geo) {
    geo = new THREE.LatheGeometry(P.pts.map(([r, y]) => new THREE.Vector2(r, y)), SEGS);
    const pos = geo.attributes.position, uv = geo.attributes.uv, n = P.pts.length;
    for (let i = 0; i < pos.count; i++) {
      const j = i % n, x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      uv.setY(i, P.v[j]);
      if (Math.hypot(x, z) > 0.05 && y > BASE + 0.05 && y < H) { // each panel blown out between its seams
        const s = ((Math.atan2(z, x) / (2 * Math.PI)) * PANELS + 100) % 1, k = 0.955 + 0.045 * Math.sqrt(Math.sin(Math.PI * s));
        pos.setX(i, x * k); pos.setZ(i, z * k);
      }
    }
    geo.computeVertexNormals();
    // the seam where the lathe closes has its normals averaged apart; make both sides agree
    const nm = geo.attributes.normal;
    for (let j = 0; j < n; j++) {
      const a = j, b = SEGS * n + j;
      const vx = nm.getX(a) + nm.getX(b), vy = nm.getY(a) + nm.getY(b), vz = nm.getZ(a) + nm.getZ(b), l = Math.hypot(vx, vy, vz) || 1;
      nm.setXYZ(a, vx / l, vy / l, vz / l); nm.setXYZ(b, vx / l, vy / l, vz / l);
    }
    normalMap = relief();
  }
  if (!looks.has(color)) {
    const { map, roughnessMap } = surface(color);
    looks.set(color, new THREE.MeshPhysicalMaterial({
      map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 1.1, // the sheen of wet PVC
    }));
  }
  return new THREE.Mesh(geo, looks.get(color));
}

const rubber = new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.85 });
const steel = new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.25, metalness: 1 });
export function buoy(color = '#ff7314', R = 1.05) {
  const g = new THREE.Group(), turn = new THREE.Group(); // turn: each mark set out with its scuffs somewhere else
  turn.rotation.y = Math.random() * Math.PI * 2; g.add(turn);
  const m = body(color); m.scale.setScalar(R); m.castShadow = m.receiveShadow = true; turn.add(m);
  const top = (H + DOME) * R;
  // the handle: a loop of webbing over the top, its two ends stitched down on patches
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16 * R, 0.022 * R, 4, 18, Math.PI).scale(1, 1, 2.2), rubber);
  handle.position.y = top - 0.01 * R; turn.add(handle);
  for (const s of [-1, 1]) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * R, 0.07 * R, 0.012 * R, 14), rubber);
    patch.position.set(s * 0.16 * R, top - 0.004 * R, 0); turn.add(patch);
  }
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * R, 0.065 * R, 0.04 * R, 14), rubber);
  valve.position.set(0.36 * R, top - 0.02 * R, 0.14 * R); valve.rotation.z = -0.12; turn.add(valve);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * R, 0.035 * R, 0.03 * R, 10), steel);
  cap.position.set(0.36 * R, top + 0.01 * R, 0.14 * R); turn.add(cap);
  // the D-rings on the strap, where the lines go on
  for (const a of [0.3, 0.3 + Math.PI]) {
    const d = new THREE.Mesh(new THREE.TorusGeometry(0.055 * R, 0.009 * R, 6, 14, Math.PI), steel);
    d.position.set(Math.cos(a) * 1.035 * R, 0.33 * R, Math.sin(a) * 1.035 * R);
    d.rotation.order = 'YXZ'; d.rotation.set(0.25, -a - Math.PI / 2, Math.PI); turn.add(d); // flat on the side, hanging
  }
  g.userData.R = R;
  return g;
}
