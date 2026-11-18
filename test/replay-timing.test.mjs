// The result page's replay puts a boat where she was, however long the race: a record says how its tracks were thinned
// (trackStep, each boat's own), and the page reads that instead of working it out from the clock. A record kept before
// it did is read as it always was. The tracks here are thinned by the game's own code, the records are main.js's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const { Race, lineD } = await import('../public/game/sim.js');
const { finalResults } = await import('../public/game/match.js');
const { thinTrack } = await import('../public/game/wire.js');
const { TICK, clock0 } = await import('../public/game/track.js');
const { posesAt, replaySpan } = await import('../lib/finish.ts');

// ---------- a track as the game records it: a point a tick from the first signal's lead-in, and one as she finishes ----------
const SPEED = 3;
const north = (T, c0) => [0, -SPEED * (T - c0)];
function recorded(end, start, home) {
  const c0 = clock0(start), full = [];
  for (let i = 0; c0 + (i + 1) * TICK <= end; i++) full.push(north(c0 + (i + 1) * TICK, c0));
  if (home) full.push(north(end, c0));
  return full;
}
const stepOf = (full) => Math.max(1, Math.ceil(full.length / 160));
const raceOf = (start, boat) => ({ daily: null, preset: 'medium', length: 'short', laps: 1, start, current: false, course: {}, boats: [{ name: null, me: true, done: false, dsq: false, secs: null, ...boat }] });

function assertWhereShewas(r, end, label) {
  const c0 = clock0(r.start);
  for (const f of [0.05, 0.25, 0.5, 0.75, 0.97]) {
    const T = c0 + 2 + (end - c0 - 2) * f, [p] = posesAt(r, T), [x, z] = north(T, c0);
    assert.ok(Math.hypot(p.x - x, p.z - z) < 4, `${label}, at ${T.toFixed(1)} s she is ${Math.round(Math.hypot(p.x - x, p.z - z))} m out`);
  }
}

// how long the race ran from the first signal's lead-in: just past a multiple of 160 s is where the clock and the points disagree
const LENGTHS = [160.4, 320.2, 322.5, 480.3, 484, 640.5];

for (const start of [1, 3, 5]) {
  test(`a boat home is where she was, whatever the race's length (${start} min sequence)`, () => {
    for (const L of LENGTHS) {
      const end = clock0(start) + L, full = recorded(end, start, true);
      assertWhereShewas(raceOf(start, { done: true, secs: end, track: thinTrack(full), trackStep: stepOf(full) }), end, `home after ${L} s`);
    }
  });
  test(`a boat not home is where she was, whatever the race's length (${start} min sequence)`, () => {
    for (const L of LENGTHS) {
      const full = recorded(clock0(start) + L, start, false), end = clock0(start) + full.length * TICK;
      assertWhereShewas(raceOf(start, { trackEnd: end, track: thinTrack(full), trackStep: stepOf(full) }), end, `out after ${L} s`);
    }
  });
}

test('every length of race from two minutes to a quarter of an hour plays true', () => {
  for (let L = 120; L < 900; L += 0.7) {
    const end = clock0(1) + L, home = recorded(end, 1, true), out = recorded(end, 1, false), outEnd = clock0(1) + out.length * TICK;
    assertWhereShewas(raceOf(1, { done: true, secs: end, track: thinTrack(home), trackStep: stepOf(home) }), end, `home after ${L.toFixed(1)} s`);
    assertWhereShewas(raceOf(1, { trackEnd: outEnd, track: thinTrack(out), trackStep: stepOf(out) }), outEnd, `out after ${L.toFixed(1)} s`);
  }
});

test('a record kept before the step was saved is read as it always was', () => {
  const end = clock0(1) + 320.2, full = recorded(end, 1, true), track = thinTrack(full), n = track.length;
  const N = Math.round((end - clock0(1)) / TICK), k = Math.max(1, Math.ceil(N / 160));
  const time = (i) => (i === n - 1 ? end : clock0(1) + (i * k + 1) * TICK);
  const r = raceOf(1, { done: true, secs: end, track });
  for (const i of [3, 40, n - 3]) {
    const T = (time(i) + time(i + 1)) / 2, [p] = posesAt(r, T);
    assert.deepEqual([p.x, p.z], [(track[i][0] + track[i + 1][0]) / 2, (track[i][1] + track[i + 1][1]) / 2], `between points ${i} and ${i + 1}`);
  }
  // and with no clock to go by, every point a tick apart
  const [q] = posesAt(raceOf(1, { track: track.slice(0, 50) }), clock0(1) + 11 * TICK);
  assert.deepEqual([q.x, q.z], track[10]);
});

// ---------- the records the game keeps: a real race, main.js's own code ----------
const mainSrc = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
const between = (from, to) => mainSrc.slice(mainSrc.indexOf(from), mainSrc.indexOf(to, mainSrc.indexOf(from)));
const keepers = (keepResult) => new Function('VENUE', 'CLS', 'LOOKS', 'playerLook', 'flagCode', 'lookFrom', 'keepResult',
  `${between('function resultRecord(', 'function keepResult(')}\n${between('function keepOneOnOne(', 'const openResult')}\nreturn { resultRecord, keepOneOnOne };`)(
  { id: 'palma' }, { id: 'jpk1050' }, {}, () => ({ flag: null }), () => null, () => ({ flag: null }), keepResult);

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
const screen = (me) => Object.assign(new Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: HUMANS, me }), { settings: { preset: 'medium', length: 'short', laps: 1, start: 1, fleet: 2, daily: null } });
const T0 = -64, where = (id, T) => ({ x: -450 + 2 * (T - T0), z: id === 'h' ? 400 : 460 });
function sail(r, until) {
  while (r.clock < until && !r.over) {
    for (const b of r.humans) if (!b.done) Object.assign(b, where(b.id, r.clock), { h: Math.PI / 2, v: 0, rudder: 0, auto: null });
    r.step(1 / 60);
  }
}
function home(r, b) {
  const c = r.course, x = (c.pin.x + c.committee.x) / 2, z = (c.pin.z + c.committee.z) / 2;
  b.leg = c.legs.length - 1;
  Object.assign(b, { x: x + c.normal.x * 3, z: z + c.normal.z * 3, v: 0, rudder: 0, auto: null });
  b.lastD = lineD(c, b); b.lastZ = b.z;
  r.step(1 / 60);
  Object.assign(b, { x: x - c.normal.x * 3, z: z - c.normal.z * 3, v: 0 });
  r.step(1 / 60);
  assert.equal(b.done, true, 'she is home');
}
function assertBoatAt(rec, i, id, times) {
  for (const T of times) {
    const p = posesAt(rec, T)[i], at = where(id, T);
    assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 15, `${id} at ${T}: ${Math.round(Math.hypot(p.x - at.x, p.z - at.z))} m out`);
  }
}

test('a race kept by the game replays true: home 320 s after the first signal, the other boat out on the water', () => {
  const r = screen('h'), [h, g] = r.humans;
  sail(r, T0 + 320.2); home(r, h); sail(r, 1200); // (the other boat sails on until the time limit)
  assert.equal(r.over, true);
  const lengths = { h: h.track.length, g: g.track.length };
  const rec = keepers(() => {}).resultRecord(r), mine = rec.boats.find((b) => b.me), other = rec.boats.find((b) => !b.me);
  assert.equal(mine.trackStep, stepOf(h.track)); assert.equal(other.trackStep, stepOf(g.track));
  assert.ok(lengths.h > 320, 'the case the clock gets wrong');
  assertBoatAt(rec, rec.boats.indexOf(mine), 'h', [-30, 30, 120, 240]);
  assertBoatAt(rec, rec.boats.indexOf(other), 'g', [-30, 30, 120, 240, 380]);
  assert.ok(Math.abs(other.trackEnd - r.trackAt) < 0.01, 'a boat not home keeps the clock her track ends at');
  assert.equal(mine.trackEnd, undefined, 'a boat home has her finish');
});

test('a boat put out of the race keeps the clock her track ends at', () => {
  const r = screen('h'), [h, g] = r.humans;
  sail(r, 200);
  Object.assign(g, { dsq: true, done: true, out: true, finish: r.clock, place: null }); g.track.push([g.x, g.z]); // (as sim.js contactOut leaves her)
  const out = r.clock;
  sail(r, 250); home(r, h);
  const rec = keepers(() => {}).resultRecord(r), other = rec.boats.find((b) => !b.me);
  assert.equal(other.secs, null);
  assert.ok(Math.abs(other.trackEnd - out) < 0.01);
  assertBoatAt(rec, rec.boats.indexOf(other), 'g', [-30, 60, 150, 195]);
});

test('a 1-on-1 record takes each track\'s step from the screen that thinned it', () => {
  const r = screen('h'), [h, g] = r.humans;
  sail(r, T0 + 320.2); home(r, h); sail(r, 1200);
  assert.equal(r.over, true);
  const results = JSON.parse(JSON.stringify(finalResults(r))), recs = {};
  for (const me of ['h', 'g']) keepers((res) => { recs[me] = res; }).keepOneOnOne(me === 'h' ? r : screen('g'), results); // (the guest's own tracks are not the ones kept)
  for (const rec of [recs.h, recs.g]) {
    const i = (id) => rec.boats.findIndex((b) => (id === 'h' ? b.done : !b.done));
    assert.equal(rec.boats[i('h')].trackStep, stepOf(h.track)); assert.equal(rec.boats[i('g')].trackStep, stepOf(g.track));
    assert.equal(rec.boats[i('h')].trackEnd, undefined, 'a boat home has her finish');
    assertBoatAt(rec, i('h'), 'h', [-30, 30, 120, 240]);
    assertBoatAt(rec, i('g'), 'g', [-30, 30, 120, 240, 380]);
  }
});

test('results from a host without the step are read as before', () => {
  const r = screen('h'), [h] = r.humans;
  sail(r, 100); home(r, h); sail(r, 400);
  const results = JSON.parse(JSON.stringify(finalResults(r)));
  for (const b of results.boats) delete b.trackStep;
  let rec; keepers((res) => { rec = res; }).keepOneOnOne(screen('g'), results);
  for (const b of rec.boats) assert.equal(b.trackStep, undefined, 'no step of the guest\'s own beside the host\'s track');
});

// ---------- a race given up before the gun ----------
const givenUp = (end, start = 1) => { const full = recorded(end, start, false); return raceOf(start, { dnf: true, trackEnd: end, track: thinTrack(full), trackStep: stepOf(full) }); };

test('a race given up long before the gun plays forwards, up to where it ended', () => {
  for (const [end, start] of [[-40, 1], [-16, 1], [-15, 1], [-60, 1], [-200, 5], [-150, 3]]) {
    const { from, to } = replaySpan(givenUp(end, start));
    assert.equal(to, end, 'it ends where the race did');
    assert.ok(from < to, `${from} to ${to} runs forwards`);
    assert.ok(from >= clock0(start), `${from} is not before the tracks begin`);
  }
});

test('a race given up at the very first moment never runs backwards', () => {
  const r = givenUp(clock0(1) + 0.5), { from, to } = replaySpan(r);
  assert.ok(to >= from);
});

test('the replay of any other race starts 15 s before the gun as it did', () => {
  assert.deepEqual(replaySpan(givenUp(-10)), { from: -15, to: -10 });
  assert.deepEqual(replaySpan(raceOf(1, { done: true, secs: 200, track: [[0, 0], [0, 1]] })), { from: -15, to: 200 });
});

// ---------- the ghost: the same track, sailed beside you in the game (track.js, extras.js) ----------
const track = await import('../public/game/track.js');
const ghostOf = (end, start = 1) => { const full = recorded(end, start, true); return { track: thinTrack(full), secs: end, start, legT: [0, end], step: stepOf(full) }; };

test('the ghost sails where the boat sailed, whatever the race\'s length', () => {
  for (const start of [1, 3, 5]) for (const L of LENGTHS) {
    const c0 = clock0(start), end = c0 + L, g = ghostOf(end, start);
    for (const f of [0.05, 0.25, 0.5, 0.75, 0.97]) {
      const T = c0 + 2 + (L - 2) * f, p = track.ghostAt(g, T), [x, z] = north(T, c0);
      assert.ok(Math.hypot(p.x - x, p.z - z) < 4, `${L} s after the first signal, at ${T.toFixed(1)} s she is ${Math.round(Math.hypot(p.x - x, p.z - z))} m out`);
    }
  }
});

test('the ghost and the replay put a boat in the same place', () => {
  const end = clock0(1) + 320.2, g = ghostOf(end);
  const r = raceOf(1, { done: true, secs: end, track: g.track, trackStep: g.step });
  for (const T of [-30, 0, 47.3, 120, 250]) {
    const a = track.along(g.track, g.secs, g.start, T, g.step), [b] = posesAt(r, T);
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, `at ${T}`);
  }
});

test('the gap to the ghost is the time she was there', () => {
  const c0 = clock0(1), end = c0 + 320.2, g = ghostOf(end), [x, z] = north(150, c0);
  assert.ok(Math.abs(track.ghostGap(g, x, z, 1, 154) - 4) < 1.1, 'four seconds behind her');
  assert.ok(Math.abs(track.ghostGap(g, x, z, 1, 147) + 3) < 1.1, 'three seconds ahead of her');
});

test('a ghost from a record kept before the step was saved sails as she always did', () => {
  const end = clock0(1) + 320.2, { track: tr } = ghostOf(end), g = { track: tr, secs: end, start: 1, legT: [0, end] };
  for (const T of [-30, 47.3, 200]) assert.deepEqual(track.ghostAt(g, T), track.along(tr, end, 1, T));
});

test('the ghost picked from a record brings its step along', () => {
  const src = readFileSync(new URL('../public/game/extras.js', import.meta.url), 'utf8');
  const pick = new Function('day', `${src.slice(src.indexOf('const pick = (r, own) =>'), src.indexOf('if (want && UUID.test(want))'))}\nreturn pick;`)('2026-11-18');
  const boat = { me: true, done: true, dsq: false, secs: 256.2, track: [[0, 0], [0, -9]], legT: [0] };
  assert.equal(pick({ daily: '2026-11-18', start: 1, boats: [{ ...boat, trackStep: 3 }] }, true).step, 3);
  assert.equal(pick({ daily: '2026-11-18', start: 1, boats: [boat] }, true).step, undefined);
});
