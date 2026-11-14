// The land round the course: the real coast, hills and marinas of the race's venue (venues.js), each baked by
// blender/venues.py into its .json and .bin (Göcek's as skopea.json and skopea.bin, the others' as venues/<id>.*).
// This module holds the numbers only (no three.js), for the race and for the picture (skopea.js): the parts of the
// .bin unpacked, how much sea room there is anywhere, and where in the venue's water a course fits.
//
// The venue's own frame: metres, x east and z south in Göcek (from the town); elsewhere from the middle of the race
// area, turned so the prevailing wind comes from the north like the race's. A race is laid at an offset (ox, oz) in
// it: a point (x, z) of the race is (x + ox, z + oz) in the venue.
import { VENUE, landFiles, venueById } from './venues.js';
export { VENUE };

const base = new URL('./', import.meta.url), [JSON_FILE, BIN_FILE] = landFiles();
// skopea.bin comes gzipped (a host sends a .bin as it is), unless the host has already unpacked it on the way
async function unpack(r) {
  const b = await r.arrayBuffer(), u = new Uint8Array(b, 0, 2);
  if (u[0] !== 0x1f || u[1] !== 0x8b) return b;
  return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
const load = ([json, bin]) => Promise.all([fetch(new URL(json, base)).then((r) => r.json()), fetch(new URL(bin, base)).then(unpack)]);
let [META, BIN] = await load([JSON_FILE, BIN_FILE]);
// A venue blender/venues.py hasn't baked again yet still has its old files, without `parts`, which this can't read:
// until it is baked, its race is sailed in Göcek's land (under its own name, wind, light and colours), so the game
// still loads there. npm test still names each such venue, as its land isn't at its own position.
if (!META.parts) {
  console.warn(`${VENUE.id}: its land isn't baked in the new format yet, so the race is in Göcek's`);
  [META, BIN] = await load(landFiles(venueById('gocek')));
}
const M = META.room;
// each row is stored as differences from the point before it (or the whole part as one row): added up again here,
// wrapping as they were taken
function rows(a, w) { for (let i = 0; i < a.length; i += w) for (let j = i + 1; j < i + w && j < a.length; j++) a[j] += a[j - 1]; return a; }
// or each point as what its neighbours left, up and up-left predict (left + up − up-left), and the difference
function grad(a, w) {
  for (let k = 1; k < a.length; k++) { const i = (k / w) | 0, j = k - i * w; a[k] += !i ? a[k - 1] : !j ? a[k - w] : a[k - 1] + a[k - w] - a[k - w - 1]; }
  return a;
}
// the parts of the .bin, in the order the json lists them, each padded to 4 bytes (blender/venues.py)
const TYPES = { i8: Int8Array, u8: Uint8Array, i16: Int16Array, u16: Uint16Array, bits: Uint8Array };
const PARTS = {};
for (let o = 0, k = 0; k < META.parts.length; k++) {
  const p = META.parts[k], T = TYPES[p.t], n = p.t === 'bits' ? Math.ceil(p.len / 8) : p.len, a = new T(BIN, o, n);
  if (p.d === 'rows') rows(a, p.w); else if (p.d === 'seq') rows(a, a.length); else if (p.d === 'grad') grad(a, p.w);
  PARTS[p.n] = a; if (p.t === 'bits') PARTS[p.n + 'Len'] = p.len;
  o += n * T.BYTES_PER_ELEMENT; o += (4 - (o % 4)) % 4;
}
export const SKOPEA = {
  meta: META,
  parts: PARTS,
  room: PARTS.room, // steps of 4 m
};

// the sea room at a point of the bay, metres: how far to the shore, + at sea, − on land (as far as 508 m)
export function roomAt(x, z) {
  const fx = (x - M.x0) / M.cell, fz = (z - M.z0) / M.cell;
  if (fx < 0 || fz < 0 || fx >= M.nx - 1 || fz >= M.nz - 1) return 508; // off the map: open sea
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, R = SKOPEA.room, n = M.nx;
  const a = R[j * n + i], b = R[j * n + i + 1], c = R[(j + 1) * n + i], d = R[(j + 1) * n + i + 1];
  return 4 * ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v);
}

// Göcek: Skopea Marina, on the town quay at the head of the bay
const SKOPEA_MARINA = (META.marinas.find((m) => /skopea/i.test(m.name)) || { at: [-60, -156] }).at;
// where the course would go: in Göcek, the windward mark some 450 m off Skopea Marina, out in the middle of the inner
// bay; elsewhere the middle of the beat at the middle of the race area
const HOME = META.home ? { x: META.home[0], z: META.home[1] } : { x: SKOPEA_MARINA[0] - 90, z: SKOPEA_MARINA[1] + 450 };

// the places a course may start round a point, nearest first: every 25 m out to 4 km
let RINGS = null;
function rings() {
  if (RINGS) return RINGS;
  const a = [];
  for (let x = -4000; x <= 4000; x += 25) for (let z = -4000; z <= 4000; z += 25) if (x * x + z * z <= 16e6) a.push([x, z, x * x + z * z]);
  return (RINGS = a.sort((p, q) => p[2] - q[2] || p[0] - q[0] || p[1] - q[1]));
}

// Where the course goes: the start (the race's origin) somewhere in the bay with the marks, the starting area and the
// beat out to the laylines all in clear water; of the places that fit, the one that puts the windward mark nearest
// HOME. Only from the course's shape, so the same race is laid in the same place on every device.
export function placeCourse(course, beatDeg = 42) {
  const c = course, beat = -c.windward.z, half = c.len / 2, tb = Math.tan(beatDeg * Math.PI / 180);
  const need = []; // [x, z, metres of water round it]
  // every mark: the windward mark, the gate and the line, then the course's other marks and a finish line of its own
  const others = Object.entries(c.marks).filter(([k]) => k !== 'mark').map(([, m]) => m);
  const fin = c.finish ? [c.finish.a, c.finish.b, c.finishBoat] : [];
  for (const m of [c.windward, ...c.gate, c.pin, c.committee, ...others, ...fin]) need.push([m.x, m.z, 70]);
  for (const f of [-1, -0.5, 0, 0.5, 1]) for (const z of [0, 90, 170]) need.push([f * (half + 60), z, 35]); // the line and the boats below it
  need.push([0, -beat - 90, 25]); // over the top of the windward mark
  for (const f of [0.25, 0.5, 0.75]) { // the beat, out to most of the way to the laylines
    const w = Math.min(f, 1 - f) * beat * tb * 0.85;
    need.push([-w, -f * beat, 25], [w, -f * beat, 25]);
  }
  // the middle of each leg sailed off the wind, each once, but the run from the windward mark down to the gate (it's
  // over the beat): a leg goes from its mark, the gate's left buoy or the finish line's pin to the next; a finish back
  // at the start line counts as the gate, just above it
  const end = (i) => c.marks[c.legs[i]] || (c.legs[i] === 'gate' || !c.finish ? c.gate[0] : c.finish.a);
  for (let i = 2; i < c.legs.length; i++) {
    const a = end(i - 1), b = end(i), m = [(a.x + b.x) / 2, (a.z + b.z) / 2, 50];
    if (c.legInfo[i].beat || (a === c.windward && b === c.gate[0]) || need.some((p) => p[0] === m[0] && p[1] === m[1] && p[2] === 50)) continue;
    need.push(m);
  }
  const fits = (gx, gz) => { let worst = Infinity; for (const [x, z, r] of need) { worst = Math.min(worst, roomAt(gx + x, gz + z) - r); if (worst < 0) break; } return worst; };
  if (META.home) { // the nearest start to the middle that fits; none: the one with the most room
    const want = { x: HOME.x - c.windward.x / 2, z: HOME.z - c.windward.z / 2 };
    let spare = null, spareR = -Infinity;
    for (const [dx, dz] of rings()) {
      const gx = want.x + dx, gz = want.z + dz, w = fits(gx, gz);
      if (w >= 0) return { x: gx, z: gz };
      if (w > spareR) { spare = { x: gx, z: gz }; spareR = w; }
    }
    return spare;
  }
  const want = { x: HOME.x - c.windward.x, z: HOME.z - c.windward.z };
  let best = null, bestD = Infinity, spare = null, spareR = -Infinity;
  for (let gx = -3000; gx <= 3000; gx += 25) for (let gz = -600; gz <= 5000; gz += 25) {
    const d = Math.hypot(gx - want.x, gz - want.z);
    if (best && d >= bestD) continue;
    let worst = Infinity;
    for (const [x, z, r] of need) { worst = Math.min(worst, roomAt(gx + x, gz + z) - r); if (worst < 0 && best) break; }
    if (worst >= 0) { best = { x: gx, z: gz }; bestD = d; }
    if (!best && worst > spareR) { spare = { x: gx, z: gz }; spareR = worst; } // none fits: the one with the most room
  }
  return best || spare;
}
