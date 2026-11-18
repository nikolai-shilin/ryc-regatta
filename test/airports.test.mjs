// The airliners that come over the course (public/game/airliners.js) fly only where an airport is close, in and out of
// the runway facing the wind, low enough to cast a shadow and clear of the hills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIRPORTS, CLOSE, HALF, STEP, airportOf, flightProfile, frameOf, gapFor, route, runwayInUse } from '../public/game/airports.js';
import { VENUES } from '../public/game/venues.js';

const metres = (a, b, c, d) => Math.hypot((c - a) * 110574, (d - b) * 111320 * Math.cos((a + c) / 2 * Math.PI / 180));
const ends = (rw) => [[rw[0], rw[1]], [rw[2], rw[3]]];

test('every airport belongs to a venue, within 25 km of its course', () => {
  for (const [id, ap] of Object.entries(AIRPORTS)) {
    const v = VENUES.find((x) => x.id === id);
    assert.ok(v, `${id}: no such venue`);
    const near = Math.min(...ap.runways.flatMap((r) => ends(r).map(([la, lo]) => metres(v.lat, v.lon, la, lo))));
    assert.ok(near <= CLOSE, `${id}: ${ap.code} is ${Math.round(near / 1000)} km off`);
  }
});

test('a venue with no airport close has no airliners', () => {
  for (const id of ['kiel', 'newport', 'garda', 'enoshima', 'marstrand', 'les-sables', 'phuket']) assert.equal(airportOf(id), null, id);
});

test('every runway is long enough for a Boeing or an Airbus', () => {
  for (const [id, ap] of Object.entries(AIRPORTS)) {
    assert.ok(ap.runways.length, id);
    for (const r of ap.runways) assert.ok(metres(...r) >= 1200, `${id}: ${Math.round(metres(...r))} m`);
  }
});

for (const v of VENUES.filter((x) => AIRPORTS[x.id])) {
  test(`${v.id}: they land into the wind, and fly the right way over the course`, () => {
    const frame = frameOf({ origin: [v.lat, v.lon], turn: v.wind }), at = { x: 0, z: 0 };
    const rw = runwayInUse(AIRPORTS[v.id].runways, frame);
    assert.ok(Math.abs(Math.hypot(rw.f.x, rw.f.z) - 1) < 1e-9);
    for (const [a, b, c, d] of AIRPORTS[v.id].runways) { // of both ways along every runway, none points more into the wind
      const p = frame(a, b), q = frame(c, d), L = Math.hypot(q.x - p.x, q.z - p.z);
      assert.ok(-rw.f.z >= Math.abs(q.z - p.z) / L - 1e-9);
    }
    for (const kind of ['in', 'out']) {
      const r = route(kind, rw, at);
      assert.ok(Math.abs(Math.hypot(r.dir.x, r.dir.z) - 1) < 1e-9, kind);
      assert.ok(r.height >= 300 && r.height <= 650, `${kind}: ${r.height} m`);
    }
  });
}

test('the frame is the land\'s: the wind\'s direction comes out on −z', () => {
  const frame = frameOf({ origin: [40, 10], turn: 90 }), east = frame(40, 10.1); // a wind from the east: east is the frame's north
  assert.ok(east.z < -8000 && Math.abs(east.x) < 1);
});

test('she keeps clear of a hill, and a wall over the course turns the pass away', () => {
  const f = { x: 1, z: 0 }, hill = (x) => (Math.abs(x - 3000) < 300 ? 700 : -10), a = flightProfile('in', 500, 0, 0, f, hill);
  assert.equal(a.length, 2 * HALF / STEP + 1);
  assert.ok(a[(3000 + HALF) / STEP] >= 870, 'over the hill');
  for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i] - a[i - 1]) <= 9.001, 'no steeper than she can');
  assert.equal(flightProfile('in', 500, 0, 0, f, () => 900), null);
});

test('they come over rarely, the nearer the airport the sooner', () => {
  assert.ok(gapFor(3000, 0.5) < gapFor(25000, 0.5));
  for (const [m, r] of [[0, 0], [25000, 1]]) { const s = gapFor(m, r); assert.ok(s >= 200 && s <= 720, `${s} s`); }
});
