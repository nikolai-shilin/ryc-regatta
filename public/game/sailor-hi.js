// Regatta: a sailor as you see her from a few metres away. The figure in yacht.js (sailor) is what the fleet is drawn
// with; this one replaces it on the boats right by the camera, with Life on High (yacht.js crewLevel): a ski mask with
// eyes that blink in its opening, fingers that close on what they hold, a jacket with its panels, seams and creases, a lifejacket with
// its fittings, boots with soles, a ponytail that swings. It is built when she first comes close, a sailor a frame, and
// rides the same bones as the plain figures, with a few of its own (fingers, eyelids, the ponytail).
//
// Nothing here is drawn until fineLibrary is asked for, so a phone on Medium never pays for it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { smoothstep: ss, clamp, lerp } = THREE.MathUtils;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// rings made finer: a smooth curve through them, k rings to each one, and a closed end rounded over
function finer(rings, k) {
  const R = rings.map(([y, w, f, b, x0 = 0]) => [y, w, f, b, x0]), n = R.length, out = [];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) {
    const A = R[Math.max(0, i - 1)], B = R[i], C = R[i + 1], D = R[Math.min(n - 1, i + 2)];
    for (let s = 0; s < k; s++) {
      const t = s / k;
      if (!B[1] || !C[1]) { // towards a point: a dome, not a cone
        const u = Math.sqrt(B[1] ? 1 - t : t), o = B[1] ? B : C;
        out.push([lerp(B[0], C[0], t), o[1] * u, o[2] * u, o[3] * u, lerp(B[4], C[4], t)]);
      } else out.push([lerp(B[0], C[0], t), ...[1, 2, 3, 4].map((j) => { const v = cr(A[j] || B[j], B[j], C[j], D[j] || C[j], t); return j === 4 ? v : Math.max(0.001, v); })]);
    }
  }
  out.push(R[n - 1]);
  return out;
}
// a point on a lofted part: phi round it (0 forward, π/2 towards +z), at height y, `out` beyond its surface
function onLoft(rings, p) {
  const at = (y) => {
    let i = 0; while (i < rings.length - 2 && rings[i + 1][0] < y) i++;
    const A = rings[i], B = rings[i + 1], t = clamp((y - A[0]) / ((B[0] - A[0]) || 1), 0, 1);
    return [1, 2, 3, 4].map((k) => lerp(A[k] ?? 0, B[k] ?? 0, t));
  };
  return (phi, y, out = 0) => {
    const [w, f, b, x0] = at(y), c = Math.cos(phi), s = Math.sin(phi);
    return V(x0 + Math.sign(c) * Math.abs(c) ** (2 / p) * ((c > 0 ? f : b) + out), y, Math.sign(s) * Math.abs(s) ** (2 / p) * (w + out));
  };
}
// the surface pushed out along its normals by fn(x, y, z) metres; what is pushed in lies in the shade of the fold
function fold(geo, fn, dark = 55) {
  const P = geo.attributes.position, N = geo.attributes.normal, sh = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const d = fn(P.getX(i), P.getY(i), P.getZ(i));
    P.setXYZ(i, P.getX(i) + N.getX(i) * d, P.getY(i) + N.getY(i) * d, P.getZ(i) + N.getZ(i) * d);
    sh[i] = clamp(1 + d * dark, 0.72, 1.08);
  }
  geo.setAttribute('shade', new THREE.BufferAttribute(sh, 1));
  geo.computeVertexNormals();
  return geo;
}
// creases round a limb between heights y0 and y1, wandering as they go round: A deep, f to the metre
const creases = (y0, y1, A, f, ph = 0, front = 0) => (x, y, z) => {
  const k = ss(y, y0, y0 + 0.035) * (1 - ss(y, y1 - 0.035, y1)), a = Math.atan2(z, x);
  return A * k * Math.sin(y * f + 2.4 * Math.sin(a * 2 + ph) + ph) * (front ? 0.45 + 0.55 * ss(front * Math.cos(a), -0.3, 0.6) : 1);
};
const sum = (...fs) => (x, y, z) => fs.reduce((s, f) => s + f(x, y, z), 0);
// parts of one colour as one geometry, whatever they carry
function merge(list) {
  return mergeGeometries(list.filter(Boolean).map((g) => {
    const n = g.attributes.position.count;
    if (!g.attributes.shade) g.setAttribute('shade', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'shade'].includes(k)) g.deleteAttribute(k);
    return g.index ? g : g.setIndex([...Array(n).keys()]);
  }));
}
const ball = (rx, ry, rz, x, y, z, w = 10, h = 7) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz).translate(x, y, z);
const box = (a, b, c, x, y, z) => new THREE.BoxGeometry(a, b, c).translate(x, y, z);
const rod = (r, len, x, y, z, seg = 8) => new THREE.CapsuleGeometry(r, len, 3, seg).translate(x, y, z);

// where the fingers bend, down the hand from the wrist
const KNUCKLE = 0.088, MIDDLE = 0.036;
const EYE = { x: 0.0655, y: 0.703, z: 0.031 };

// ---------- the parts, the same for everyone: made once ----------
export function fineLibrary(K) {
  const { loft, sweep, shell, R, SHIN, UPPER_ARM, THIGH, hairLine, brim, yokePts } = K;
  const L = (rings, seg, k = 4, p = 2.3) => loft(finer(rings, k), seg, p);
  const line = (pts, wd = 0.0022, th = 0.0014, centre = V(0, 0.32, 0)) => sweep(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length * 2), wd, th, centre, 3);

  // ---- the legs ----
  const thigh = fold(L(R.thigh, 24, 3), sum(creases(-0.46, -0.3, 0.0028, 120, 0.7), creases(-0.08, 0.05, 0.002, 100, 2.1)));
  const knee = fold(new THREE.SphereGeometry(0.055, 16, 10).scale(1.08, 1, 0.98), creases(-0.06, 0.06, 0.0012, 120));
  const shin = fold(L(R.shin, 20, 3), sum(creases(-0.1, 0.02, 0.0024, 120, 1.1), creases(-0.44, -0.3, 0.0034, 115, 0.3)));
  const foot = fold(L(R.foot, 18, 3).rotateZ(-Math.PI / 2).translate(0, -0.035, 0), (x, y, z) => -0.0014 * ss(Math.abs(Math.sin(x * 62)), 0.92, 1) * ss(x, 0.1, 0.16) * ss(y, -0.05, -0.02));
  const sole = new THREE.CapsuleGeometry(0.052, 0.2, 3, 14).rotateZ(Math.PI / 2).scale(1, 0.2, 1).translate(0.07, -0.067, 0);
  const shaft = merge([
    fold(L([[-SHIN - 0.04, 0.046, 0.046, 0.05], [-SHIN + 0.04, 0.043, 0.044, 0.048], [-0.32, 0.048, 0.048, 0.056], [-0.285, 0.05, 0.05, 0.06], [-0.268, 0.054, 0.054, 0.064], [-0.262, 0.05, 0.05, 0.06], [-0.26, 0, 0, 0]], 18, 2), creases(-0.46, -0.34, 0.0022, 110, 0.9)),
    L([[-0.3, 0.0525, 0.0525, 0.0625], [-0.296, 0.0545, 0.0545, 0.0645], [-0.286, 0.0545, 0.0545, 0.0645], [-0.282, 0.0525, 0.0525, 0.0625]], 18, 1), // the strap round its top
    box(0.012, 0.03, 0.022, 0.058, -0.29, 0),
  ]);
  const cuffShoe = L([[-SHIN - 0.04, 0.044, 0.044, 0.048], [-SHIN, 0.04, 0.042, 0.044], [-SHIN + 0.012, 0.0405, 0.0415, 0.0435], [-SHIN + 0.016, 0, 0, 0]], 16, 1);
  const laces = merge([0.075, 0.095, 0.115, 0.135].map((x, i) => new THREE.CapsuleGeometry(0.0022, 0.05 - i * 0.004, 2, 5).rotateX(Math.PI / 2).translate(x, -0.003 - x * 0.2, 0)));
  const pelvis = fold(L(R.pelvis, 28, 2), creases(-0.03, 0.1, 0.0016, 100, 1.4));

  // ---- the jacket ----
  const onTorso = onLoft(R.torso, 2.3);
  const torso = fold(L(R.torso, 40, 3), sum(creases(0.1, 0.3, 0.0034, 95, 0.5), creases(0.34, 0.47, 0.0012, 110, 1.9)));
  const collar = fold(L([[0.52, 0.112, 0.082, 0.078], [0.545, 0.08, 0.074, 0.071], [0.572, 0.066, 0.064, 0.063], [0.588, 0.066, 0.064, 0.063], [0.594, 0.06, 0.058, 0.057], [0.594, 0, 0, 0]], 28, 2), creases(0.53, 0.58, 0.001, 130));
  const up = (phi, y0, y1, n = 12) => Array.from({ length: n }, (_, i) => onTorso(phi, lerp(y0, y1, i / (n - 1)), 0.0015));
  const stitched = merge([
    line(up(0.012, 0.06, 0.52, 18), 0.005, 0.0022), // the zip
    line([V(0.0645, 0.59, 0), V(0.066, 0.57, 0), V(0.075, 0.545, 0)], 0.0045, 0.0022),
    ...[1, -1].flatMap((s) => [
      line(Array.from({ length: 9 }, (_, i) => onTorso(s * lerp(1.0, 1.42, i / 8), lerp(0.53, 0.38, i / 8), 0.0015))), // the sleeve's seam, front
      line(Array.from({ length: 9 }, (_, i) => onTorso(s * lerp(2.15, 1.72, i / 8), lerp(0.53, 0.38, i / 8), 0.0015))), // and behind
      line(up(s * 1.57, 0.07, 0.36, 10)), // down each side
    ]),
    line(Array.from({ length: 22 }, (_, i) => onTorso(lerp(1.75, TAU - 1.75, i / 21), 0.43, 0.0015))), // the yoke across the back
    line(Array.from({ length: 6 }, (_, i) => onTorso(lerp(0.62, 0.98, i / 5), lerp(0.2, 0.26, i / 5), 0.002)), 0.0042, 0.0022), // a pocket's zip
    line(Array.from({ length: 6 }, (_, i) => onTorso(-lerp(0.62, 0.98, i / 5), lerp(0.2, 0.26, i / 5), 0.002)), 0.0042, 0.0022),
  ]);
  const upperArm = fold(L(R.upperArm, 18, 3), sum(creases(-0.3, -0.17, 0.0026, 120, 1.2), creases(-0.03, 0.04, 0.0014, 110, 0.2)));
  const forearm = fold(L(R.forearm, 18, 3), sum(creases(-0.07, 0.03, 0.0028, 120, 2.3), creases(-0.2, -0.13, 0.0012, 120, 0.6)));
  const elbowJ = new THREE.SphereGeometry(0.0465, 14, 8).translate(0, -UPPER_ARM, 0);
  const deltoid = ball(0.06, 0.066, 0.06, 0, -0.012, 0, 18, 12); // the round of the shoulder, over the joint
  const cuff = merge([
    L([[-0.228, 0.041, 0.043, 0.041], [-0.224, 0.0465, 0.0485, 0.0465], [-0.2, 0.0465, 0.0485, 0.0465], [-0.196, 0.042, 0.044, 0.042]], 18, 1),
    box(0.03, 0.02, 0.006, 0, -0.213, 0.046), // the cuff's tab
  ]);

  // ---- the lifejacket ----
  const yoke = new THREE.CatmullRomCurve3(yokePts.map((v) => V(...v)));
  const channels = (x, y, z) => -0.0026 * ss(Math.abs(Math.sin(y * 62 + z * 7)), 0.86, 1);
  const lobes = fold(sweep(yoke, 64, 0.04, 0.023, V(0, 0.34, 0), 10), channels, 40);
  const belt = merge([
    L([[0.114, 0.171, 0.117, 0.119], [0.118, 0.1735, 0.1195, 0.1215], [0.142, 0.1735, 0.1195, 0.1215], [0.146, 0.171, 0.117, 0.119]], 30, 1),
    new THREE.CylinderGeometry(0.013, 0.013, 0.05, 12).rotateZ(Math.PI / 2).scale(1, 0.5, 1).translate(0.12, 0.13, 0.13), // the slack, tucked
  ]);
  const buckle = merge([box(0.012, 0.052, 0.074, 0.125, 0.13, 0), box(0.006, 0.03, 0.05, 0.133, 0.13, 0)]);
  const fittings = merge([ // the tether's ring, the light and the toggle's cord
    new THREE.TorusGeometry(0.018, 0.0034, 8, 22).rotateY(Math.PI / 2).translate(0.13, 0.102, 0),
  ]);
  const whistle = merge([new THREE.CapsuleGeometry(0.0085, 0.03, 4, 10).rotateX(Math.PI / 2).translate(0.172, 0.31, 0.092), box(0.012, 0.012, 0.012, 0.172, 0.31, 0.116)]);
  const lamp = merge([new THREE.CylinderGeometry(0.0105, 0.012, 0.028, 12).translate(0.168, 0.35, -0.095), ball(0.0102, 0.009, 0.0102, 0.168, 0.367, -0.095, 10, 5)]);
  const toggle = merge([rod(0.0024, 0.06, 0.158, 0.2, -0.082, 5), ball(0.012, 0.018, 0.012, 0.158, 0.155, -0.082, 12, 8)]);

  // ---- the head: its surface moved into a face ----
  const neck = L(R.neck, 18, 2);
  const bump = (y, z, sy, sz, y0, z0) => Math.exp(-(((y - y0) / sy) ** 2) - ((Math.abs(z) - z0) / sz) ** 2);
  const skull = L(R.head, 52, 4, 2.15), pos = skull.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), face = ss(x, 0.015, 0.06);
    if (!face) continue;
    const g = (a, sy, sz, y0, z0) => a * bump(y, z, sy, sz, y0, z0);
    const d = g(-0.0105, 0.0125, 0.019, EYE.y, EYE.z) // the eye sockets
      + g(0.0042, 0.0068, 0.027, 0.7175, 0.033) // the brow
      + g(0.0045, 0.018, 0.0085, 0.694, 0) // the nose's bridge
      + g(0.0045, 0.0145, 0.02, 0.681, 0.056) // the cheekbones
      + g(-0.0034, 0.013, 0.016, 0.651, 0.06) // under them
      + g(0.0024, 0.0085, 0.0085, 0.656, 0.0135) // the nose's wings
      + g(-0.0012, 0.006, 0.0042, 0.648, 0) // the groove over the lip
      + g(0.0052, 0.009, 0.019, 0.606, 0) // the chin
      + g(-0.0028, 0.0042, 0.018, 0.62, 0) // the hollow over it
      + g(0.0026, 0.012, 0.018, 0.622, 0.062); // the jaw
    pos.setX(i, x + d * face);
  }
  skull.computeVertexNormals();
  // the ski mask: a knitted layer over the head, cut clean round the eyes (what lay inside the opening goes, and the
  // edge of what's left is drawn out to the opening's rounded outline)
  const inOpening = (x, y, z) => (x > 0.03 ? ((y - EYE.y) / 0.0165) ** 4 + (z / 0.064) ** 4 : 2);
  const mask = skull.clone(), mp = mask.attributes.position, mn = mask.attributes.normal, old = mask.index.array, kept = [];
  for (let i = 0; i < mp.count; i++) mp.setXYZ(i, mp.getX(i) + mn.getX(i) * 0.0018, mp.getY(i) + mn.getY(i) * 0.0018, mp.getZ(i) + mn.getZ(i) * 0.0018);
  const inside = Array.from({ length: mp.count }, (_, i) => inOpening(mp.getX(i), mp.getY(i), mp.getZ(i)));
  for (let i = 0; i < old.length; i += 3) if (inside[old[i]] >= 1 || inside[old[i + 1]] >= 1 || inside[old[i + 2]] >= 1) kept.push(old[i], old[i + 1], old[i + 2]);
  for (const i of new Set(kept)) if (inside[i] < 1 && inside[i] > 0) { const k = inside[i] ** -0.25; mp.setY(i, EYE.y + (mp.getY(i) - EYE.y) * k); mp.setZ(i, mp.getZ(i) * k); }
  mask.setIndex(kept); mask.computeVertexNormals();
  const nose = L([[0.687, 0, 0, 0, 0.088], [0.684, 0.0098, 0.01, 0.008, 0.088], [0.672, 0.0125, 0.0145, 0.008, 0.087], [0.661, 0.0165, 0.0165, 0.01, 0.087], [0.655, 0.0125, 0.0105, 0.01, 0.088], [0.652, 0, 0, 0, 0.088]], 12, 3);
  const ears = merge([1, -1].map((s) => merge([
    ball(0.0115, 0.0235, 0.0052, 0, 0, 0, 14, 10),
    new THREE.TorusGeometry(0.0175, 0.0026, 6, 20, Math.PI * 1.25).rotateZ(-0.35).scale(0.66, 1.12, 1).translate(0, 0.002, s * 0.002), // its rim
    ball(0.0062, 0.0075, 0.0042, 0.0025, -0.021, 0, 10, 7), // the lobe
  ]).rotateX(s * 0.22).rotateZ(0.12).translate(-0.006, 0.682, s * 0.0795)));
  // the eyes (for those who wear no sunglasses): the ball, its iris and pupil, and the lids, drawn about the point the upper one turns on
  const eyeAt = (g, s) => g.translate(EYE.x, EYE.y, s * EYE.z);
  const eyeball = merge([1, -1].map((s) => eyeAt(ball(0.0118, 0.0118, 0.0118, 0, 0, 0, 16, 12), s)));
  const iris = merge([1, -1].map((s) => eyeAt(ball(0.0016, 0.0058, 0.0058, 0.0104, 0, 0, 14, 10), s)));
  const pupil = merge([1, -1].map((s) => eyeAt(ball(0.0009, 0.0027, 0.0027, 0.0118, 0, 0, 10, 8), s)));
  // a lid is half a shell over the ball, tipped back so that its edge lies just over the iris (or just under it)
  const lid = (a) => new THREE.SphereGeometry(0.0134, 18, 8, 0, TAU, 0, Math.PI / 2).rotateZ(a);
  const lidUp = merge([1, -1].map((s) => lid(0.3).translate(0, 0, s * EYE.z))); // on the eyelids' own bone
  const lidLow = merge([1, -1].map((s) => eyeAt(lid(Math.PI - 0.55), s)));
  const lashes = merge([1, -1].map((s) => new THREE.TorusGeometry(0.0135, 0.0008, 4, 24).rotateX(Math.PI / 2).rotateZ(0.3).translate(0, 0, s * EYE.z)));
  // the hair, in strands; a ponytail through the back of the cap
  const hair = fold(shell(R.head, 2.15, 1.34, TAU - 1.34, hairLine, 0.762, 0.0045, 64, 8), (x, y, z) => 0.0014 * Math.sin(Math.atan2(z, x) * 74 + y * 40) + 0.0009 * Math.sin(Math.atan2(z, x) * 31 + y * 90), 120);
  const tailRings = (a, b, r0, r1) => finer([[a, 0, 0, 0], [a - 0.008, r0, r0, r0], [lerp(a, b, 0.5), lerp(r0, r1, 0.3), lerp(r0, r1, 0.3), lerp(r0, r1, 0.3)], [b + 0.004, r1, r1, r1], [b, 0, 0, 0]], 3);
  const strands = (x, y, z) => 0.001 * Math.sin(Math.atan2(z, x) * 11 + y * 12);
  const tail = [fold(loft(tailRings(0.012, -0.14, 0.021, 0.024), 12, 2), strands, 110), fold(loft(tailRings(0.01, -0.17, 0.024, 0.004), 12, 2), strands, 110)];
  const band = new THREE.TorusGeometry(0.0205, 0.005, 8, 18).rotateX(Math.PI / 2).translate(0, 0.002, 0);

  // ---- the cap, of six panels ----
  const panels = 6, crown = fold(new THREE.SphereGeometry(1, 48, 14, 0, TAU, 0, Math.PI / 2).scale(0.1045, 0.083, 0.0905).translate(-0.008, 0.724, 0),
    (x, y, z) => -0.0013 * ss(Math.abs(Math.cos(Math.atan2(z, x + 0.008) * panels / 2)), 0.96, 1) * ss(y, 0.73, 0.76), 110);
  const capBits = merge([
    new THREE.CylinderGeometry(1, 1, 0.007, 28, 1, true).scale(0.1055, 1, 0.0918).translate(-0.008, 0.7275, 0), // the sweatband's seam
    ball(0.012, 0.0055, 0.012, -0.0095, 0.8065, 0, 14, 8), // the button
  ]);
  const eyelets = merge([0.55, 1.6, 2.65, 3.7, 4.75, 5.8].map((a) => new THREE.TorusGeometry(0.0034, 0.0011, 3, 8).rotateY(Math.PI / 2 - a).translate(-0.008 + Math.cos(a) * 0.0818, 0.776, Math.sin(a) * 0.0708)));
  const badge = ball(0.0022, 0.0085, 0.0145, 0, 0, 0, 14, 8).rotateZ(0.3).translate(0.0912, 0.7515, 0); // on the crown's front
  const stitch = merge([0.45, 0.72].map((r) => { // the rows of stitches round the bill
    const pts = Array.from({ length: 19 }, (_, i) => {
      const th = (i / 18 * 2 - 1) * 1.1, c = Math.cos(th), sn = Math.sin(th), z = 0.09 * sn * (1 + 0.04 * r), len = ((c - Math.cos(1.2)) / (1 - Math.cos(1.2))) ** 0.7;
      return V(-0.008 + 0.104 * c + 0.078 * len * c * r, 0.7262 - 0.016 * len * r - 1.4 * z * z * r, z);
    });
    return sweep(new THREE.CatmullRomCurve3(pts), 22, 0.0009, 0.0006, V(0, 0, 0), 3);
  }));
  const strap = merge([1, -1].map((s) => sweep(new THREE.CatmullRomCurve3([V(0.018, 0.72, s * 0.094), V(0.03, 0.665, s * 0.082), V(0.05, 0.615, s * 0.062), V(0.06, 0.594, s * 0.03), V(0.064, 0.59, 0)]), 10, 0.006, 0.0016, V(0, 0.68, 0), 4)));

  // ---- the hands: palm, four fingers in three joints, the thumb. sz: the side (+z or −z) it's on, the palm towards the body ----
  const hand = (sz) => {
    const palm = fold(L([[0.018, 0, 0, 0], [0.006, 0.0215, 0.028, 0.028], [-0.026, 0.0165, 0.037, 0.036], [-0.066, 0.0145, 0.042, 0.04], [-0.086, 0.013, 0.041, 0.039], [-0.1, 0, 0, 0]], 14, 2), (x, y, z) => (z * sz < 0 ? 0.0012 : 0) * ss(y, -0.075, -0.02));
    const pads = merge([box(0.058, 0.006, 0.004, 0.002, -0.08, sz * 0.0145), box(0.05, 0.005, 0.004, 0.002, -0.066, sz * 0.015), ball(0.03, 0.03, 0.003, 0.004, -0.045, -sz * 0.0135, 10, 5)]);
    const strapW = merge([L([[-0.012, 0.0265, 0.031, 0.031], [-0.006, 0.0285, 0.033, 0.033], [0.012, 0.0285, 0.033, 0.033], [0.018, 0.0265, 0.031, 0.031]], 12, 1), box(0.022, 0.018, 0.004, 0.012, 0.003, sz * 0.0295)]);
    const FINGERS = [[0.0295, 0.076, 0.0086], [0.0098, 0.084, 0.0088], [-0.0098, 0.077, 0.0082], [-0.0285, 0.06, 0.0072]];
    const seg = (r, len, x, y0, bend = 0) => {
      const g = new THREE.CapsuleGeometry(r, len, 2, 7).translate(0, -len / 2, 0);
      if (bend) g.rotateX(sz * bend);
      return g.translate(x, y0, 0);
    };
    const first = [], second = [], tips = [];
    for (const [x, len, r] of FINGERS) {
      const a = len * 0.44, b = len * 0.31, c = len * 0.25;
      first.push(seg(r, a, x, 0)); // from the knuckle, on its bone
      second.push(seg(r * 0.94, b, x, MIDDLE - a)); // on the middle joint's bone, which lies MIDDLE down the finger
      tips.push(seg(r * 0.86, c, x, MIDDLE - a - b, 0.32));
    }
    return { palm, pads, strap: strapW, first: merge(first), second: merge(second), tips: merge(tips),
      thumb: merge([new THREE.CapsuleGeometry(0.0118, 0.034, 2, 7).translate(0, -0.017, 0).rotateZ(0.62).rotateX(sz * 0.2), new THREE.CapsuleGeometry(0.0102, 0.024, 2, 7).translate(0, -0.012, 0).rotateZ(0.36).rotateX(sz * 0.3).translate(0.02, -0.03, sz * 0.006)]),
      thumbTip: new THREE.CapsuleGeometry(0.0094, 0.012, 2, 7).translate(0, -0.006, 0).rotateZ(0.2).rotateX(sz * 0.36).translate(0.031, -0.056, sz * 0.012) };
  };
  const watch = merge([
    L([[-0.183, 0.0442, 0.0462, 0.0442], [-0.179, 0.0452, 0.0472, 0.0452], [-0.165, 0.0452, 0.0472, 0.0452], [-0.161, 0.0442, 0.0462, 0.0442]], 14, 1),
    new THREE.CylinderGeometry(0.019, 0.019, 0.008, 18).rotateX(Math.PI / 2).translate(0, -0.172, -0.0475),
  ]);
  const watchFace = new THREE.CylinderGeometry(0.015, 0.015, 0.002, 18).rotateX(Math.PI / 2).translate(0, -0.172, -0.0518);

  return { thigh, knee, shin, foot, sole, shaft, cuffShoe, laces, pelvis, torso, collar, stitched, upperArm, forearm, elbowJ, deltoid, cuff, lobes, belt, buckle, fittings, whistle, lamp, toggle,
    neck, skull, mask, nose, ears, eyeball, iris, pupil, lidUp, lidLow, lashes, hair, tail, band, crown, capBits, eyelets, badge, stitch, strap, brim: brim(28, 4), hands: [hand(-1), hand(1)], watch, watchFace, THIGH };
}

// ---------- one sailor's finest figure ----------
// S: her bones and how they bend; C: her colours. Gives back the parts for rigidSkin and the bones it adds.
export function fineFigure(F, S, C) {
  const { body, waist, upper, head, legs, arms, elbows, wrists, joint, spine, shoulder, wide, onHead, neckY, UPPER_ARM } = S;
  const col = (c) => (c.isColor ? c : new THREE.Color(c)), shift = (c, l, s = 0) => c.clone().offsetHSL(0, s, l);
  const lightOn = (c) => (c.getHSL({}).l < 0.3 ? 1 : -1);
  const jacket = C.jacket, acc = shift(jacket, 0.1 * lightOn(jacket)), tape = col('#c7cbd0'), seam = shift(jacket, -0.09 * (lightOn(jacket) < 0 ? 1 : 0.4));
  const pad = shift(C.trousers, 0.035 * lightOn(C.trousers)), vestAcc = col(C.vestAlt), hardware = col('#2a2d33'), steel = col('#b9bec4');
  const glove = C.hands, palmPad = shift(glove, 0.09 * lightOn(glove));

  // the extra bones
  const fingers = wrists.map((w, j) => {
    const a = new THREE.Bone(), b = new THREE.Bone(), t = new THREE.Bone();
    a.position.y = -KNUCKLE; b.position.y = -MIDDLE; a.add(b); t.position.set(0.03, -0.03, (j * 2 - 1) * -0.012); w.add(a, t);
    return { a, b, t };
  });
  const lid = new THREE.Bone(); lid.position.set(EYE.x, EYE.y - neckY, 0); head.add(lid);
  const tail = C.tail ? [new THREE.Bone(), new THREE.Bone()] : [];
  if (C.tail) { tail[0].position.set(-0.104, 0.712 - neckY, 0); tail[1].position.y = -0.14; tail[0].add(tail[1]); head.add(tail[0]); }

  // the colours over a part, by where on it they fall
  const thighPaint = (x, y) => (C.shorts && y < -0.3 ? C.skin : x > 0.03 && y < -0.3 ? pad : C.trousers);
  const shinPaint = (x, y) => (C.shorts ? C.skin : x > 0.025 && y > -0.13 ? pad : C.trousers);
  const seatPaint = (x, y) => (x < -0.04 && y < 0.11 ? pad : C.trousers);
  const torsoPaint = (x, y, z) => (y > 0.455 ? acc : y < 0.075 ? acc : Math.abs(z) > 0.15 && y > 0.1 && y < 0.38 ? acc : jacket);
  const upperPaint = (x, y) => (y > -0.045 ? acc : x < -0.012 && y < -0.2 ? acc : y < -0.105 && y > -0.128 ? tape : jacket);
  const forePaint = (x, y) => (y > -0.03 && x < 0.01 ? acc : y < -0.128 && y > -0.148 ? tape : jacket);
  const lobePaint = (x, y) => (y > 0.3 && y < 0.325 ? tape : y > 0.42 && y < 0.436 ? vestAcc : C.vest); // its reflective patch, and a line of colour
  // the skin in the mask's opening, darker in the hollow of the eyes; the mask over it, knitted in fine ribs
  const knit = C.mask, under = shift(C.skin, -0.075);
  const facePaint = (x, yh, z) => C.skin.clone().lerp(under, Math.exp(-(((yh + neckY - EYE.y) / 0.009) ** 2) - ((Math.abs(z) - EYE.z) / 0.021) ** 2) * 0.75);
  const maskPaint = (x, yh) => knit.clone().multiplyScalar(0.9 + 0.14 * Math.sin((yh + neckY) * 420));

  const knee = (l) => (x, y) => [[l.knee, joint(-F.THIGH - y, 0.08)]];
  const hipIn = (l) => (x, y) => [[l.hip, joint(y, 0.08)]];
  const hips = () => (x, y) => [[body, y > 0 ? ss(y, 0, 0.05) : 0]];
  const both = (a, b) => (x, y, z) => [...a(x, y, z), ...b(x, y, z)];
  const elbowIn = (j) => (x, y) => [[elbows[j], joint(-UPPER_ARM - y, 0.055)]];
  const armIn = (j) => (x, y) => [[arms[j], joint(y, 0.055)]];

  const parts = [
    [wide(F.pelvis), body, seatPaint],
    ...legs.flatMap((l) => [
      [F.thigh, l.hip, thighPaint, both(hips(), knee(l))], [F.knee, l.knee, C.shorts ? C.skin : pad], [F.shin, l.knee, shinPaint, hipIn(l)],
      [C.shorts ? F.cuffShoe : F.shaft, l.knee, C.boot], [F.foot, l.ankle, C.shorts ? shift(C.boot, 0.2) : C.boot], [F.sole, l.ankle, C.sole],
      ...(C.shorts ? [[F.laces, l.ankle, C.sole]] : []),
    ]),
    [wide(F.torso), upper, torsoPaint, spine()], [wide(F.collar), upper, acc], [wide(F.stitched), upper, seam, spine()],
    [wide(F.lobes), upper, lobePaint, spine()], [wide(F.belt), upper, hardware, spine()], [wide(F.buckle), upper, steel, spine()], [wide(F.fittings), upper, steel, spine()],
    [F.whistle, upper, '#ff7a1a'], [F.lamp, upper, '#e9e6d8'], [F.toggle, upper, '#d4252b'],
    [F.neck, upper, knit],
    [onHead(F.skull), head, facePaint], [onHead(F.mask), head, maskPaint], [onHead(F.nose), head, knit], [onHead(F.ears), head, knit], [onHead(F.hair), head, knit],
    ...(C.helmet ? [[onHead(C.helmetGeo), head, C.cap], [onHead(F.strap), head, hardware]]
      : [[onHead(F.crown), head, C.cap], [onHead(F.capBits), head, shift(C.cap, -0.12)], [onHead(F.brim), head, C.cap], [onHead(F.stitch), head, shift(C.cap, 0.14 * lightOn(C.cap))], [onHead(F.eyelets), head, shift(C.cap, -0.3)], [onHead(F.badge), head, C.badge]]),
    ...(C.bareEyes
      ? [[onHead(F.eyeball), head, '#f1eee6'], [onHead(F.iris), head, C.iris], [onHead(F.pupil), head, '#0b0c0e'], [onHead(F.lidLow), head, C.skin], [F.lidUp, lid, C.skin], [F.lashes, lid, C.hair]]
      : [[onHead(C.lens), head, null], [onHead(C.frameGeo), head, C.frame]]),
    ...(C.tail ? [[F.tail[0], tail[0], C.hair], [F.tail[1], tail[1], C.hair], [F.band, tail[0], C.badge]] : []),
    ...arms.flatMap((a, j) => {
      const H = F.hands[j], f = fingers[j], w = wrists[j];
      return [
        [F.upperArm, a, upperPaint, both(shoulder(), elbowIn(j))], [F.deltoid, a, acc, shoulder()], [F.elbowJ, a, acc], [F.forearm, elbows[j], forePaint, armIn(j)], [F.cuff, elbows[j], acc],
        ...(C.watch && j === 0 ? [[F.watch, elbows[j], '#1b1d21'], [F.watchFace, elbows[j], '#d9dde1']] : []),
        [H.palm, w, glove], ...(C.bareHands ? [] : [[H.pads, w, palmPad], [H.strap, w, palmPad]]),
        [H.first, f.a, glove], [H.second, f.b, glove], [H.tips, f.b, C.skin], [H.thumb, f.t, glove], [H.thumbTip, f.t, C.skin], // (sailing gloves leave the fingertips bare)
      ];
    }),
  ].filter(([g]) => g).map(([g, bone, c, blend]) => [g, bone, c == null ? null : typeof c === 'function' ? c : col(c), blend]);
  return { parts, bones: [...fingers.flatMap((f) => [f.a, f.b, f.t]), lid, ...tail], fingers, lid, tail };
}

// ---------- what only the finest figure does ----------
// the fingers close on what the hand holds; the lids blink, now and then twice; the ponytail hangs and swings
export function fineMotion(f, c, dt, hw, tilt) {
  f.fingers.forEach((h, j) => {
    const g = hw ? hw[j] : 1, sz = j * 2 - 1;
    h.a.rotation.x = sz * lerp(0.32, 1.28, g); h.b.rotation.x = sz * lerp(0.42, 1.42, g);
    h.t.rotation.set(sz * lerp(0.05, 0.62, g), 0, -lerp(0.08, 0.6, g));
  });
  const t = (c.bt ?? 0) + (c.i ?? 0) * 1.3, cyc = 3.7 + 1.6 * Math.sin((c.i ?? 0) * 2.4), p = t % cyc, twice = Math.floor(t / cyc) % 4 === 2;
  const shut = (u) => (u > 0 && u < 0.2 ? Math.sin((u / 0.2) * Math.PI) : 0);
  f.lid.rotation.z = -0.88 * Math.max(shut(p), twice ? shut(p - 0.3) : 0);
  if (f.tail.length && dt > 0) {
    const want = clamp(tilt + 0.5 * (c.if ?? 0), -1.1, 0.12) + 0.05 * Math.sin(t * 2.7); // (forward, it would go through her neck)
    c.tv = (c.tv ?? 0) + (60 * (want - (c.ta ?? 0)) - 7 * (c.tv ?? 0)) * Math.min(dt, 0.033); c.ta = (c.ta ?? 0) + c.tv * Math.min(dt, 0.033);
    f.tail[0].rotation.z = c.ta; f.tail[1].rotation.z = clamp(0.5 * (c.ta - want) + 0.06 * Math.sin(t * 3.4 + 1), -0.6, 0.6);
    f.tail[0].rotation.x = 0.07 * Math.sin(t * 1.9 + (c.i ?? 0));
  }
}
