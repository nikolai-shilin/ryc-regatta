// The land round the course: Göcek bay (Skopea Limanı) in Turkey, the real coast, hills and marinas, baked by
// blender/skopea.py into skopea.json and skopea.bin. This module holds the numbers only (no three.js), for the race:
// how much sea room there is anywhere, and where in the bay a course fits.
//
// The bay's own frame: metres from Göcek, x east and z south, like the race's (the wind from the north). A race
// is laid at an offset (ox, oz) in it: a point (x, z) of the race is (x + ox, z + oz) in the bay.

const base = new URL('./', import.meta.url);
// skopea.bin comes gzipped (a host sends a .bin as it is), unless the host has already unpacked it on the way
async function unpack(r) {
  const b = await r.arrayBuffer(), u = new Uint8Array(b, 0, 2);
  if (u[0] !== 0x1f || u[1] !== 0x8b) return b;
  return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
const [META, BIN] = await Promise.all([
  fetch(new URL('skopea.json', base)).then((r) => r.json()),
  fetch(new URL('skopea.bin', base)).then(unpack),
]);
const T = META.terrain, M = META.room;
// each row is stored as differences from the point before it: added up again here (wrapping as they were taken)
function rows(a, w) { for (let i = 0; i < a.length; i += w) for (let j = i + 1; j < i + w; j++) a[j] += a[j - 1]; return a; }
export const SKOPEA = {
  meta: META,
  heights: rows(new Int16Array(BIN.slice(0, T.nx * T.nz * 2)), T.nx), // decimetres
  room: rows(new Int8Array(BIN, T.nx * T.nz * 2, M.nx * M.nz), M.nx), // steps of 4 m
};

// the sea room at a point of the bay, metres: how far to the shore, + at sea, − on land (as far as 508 m)
export function roomAt(x, z) {
  const fx = (x - M.x0) / M.cell, fz = (z - M.z0) / M.cell;
  if (fx < 0 || fz < 0 || fx >= M.nx - 1 || fz >= M.nz - 1) return 508; // off the map: open sea
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, R = SKOPEA.room, n = M.nx;
  const a = R[j * n + i], b = R[j * n + i + 1], c = R[(j + 1) * n + i], d = R[(j + 1) * n + i + 1];
  return 4 * ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v);
}

// Skopea Marina, on the town quay at the head of the bay
const SKOPEA_MARINA = (META.marinas.find((m) => /skopea/i.test(m.name)) || { at: [-60, -156] }).at;
// the windward mark the bay would choose: some 450 m off Skopea Marina, out in the middle of the inner bay
const HOME = { x: SKOPEA_MARINA[0] - 90, z: SKOPEA_MARINA[1] + 450 };

// Where the course goes: the start (the race's origin) somewhere in the bay with the marks, the starting area and the
// beat out to the laylines all in clear water; of the places that fit, the one that puts the windward mark nearest
// HOME. Only from the course's shape, so the same race is laid in the same place on every device.
export function placeCourse(course, beatDeg = 42) {
  const c = course, beat = -c.windward.z, half = c.len / 2, tb = Math.tan(beatDeg * Math.PI / 180);
  const need = []; // [x, z, metres of water round it]
  for (const m of [c.windward, ...c.gate, c.pin, c.committee, ...(c.wing ? [c.wing] : [])]) need.push([m.x, m.z, 70]);
  for (const f of [-1, -0.5, 0, 0.5, 1]) for (const z of [0, 90, 170]) need.push([f * (half + 60), z, 35]); // the line and the boats below it
  need.push([0, -beat - 90, 25]); // over the top of the windward mark
  for (const f of [0.25, 0.5, 0.75]) { // the beat, out to most of the way to the laylines
    const w = Math.min(f, 1 - f) * beat * tb * 0.85;
    need.push([-w, -f * beat, 25], [w, -f * beat, 25]);
  }
  if (c.wing) for (const [a, b] of [[c.windward, c.wing], [c.wing, c.gate[0]]]) need.push([(a.x + b.x) / 2, (a.z + b.z) / 2, 50]);
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
