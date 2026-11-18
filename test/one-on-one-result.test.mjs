// What a 1-on-1 race leaves on each screen: the record main.js keeps from the host's results, and how the result page
// reads it (lib/finish.ts): who won, what each boat is called, and where the replay puts her. The race is a real Race,
// the record main.js's own code, read from its source (main.js is the page, and can't be loaded here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const { Race, lineD } = await import('../public/game/sim.js');
const { finalResults } = await import('../public/game/match.js');
const finish = await import('../lib/finish.ts');

const mainSrc = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
const between = (from, to) => mainSrc.slice(mainSrc.indexOf(from), mainSrc.indexOf(to, mainSrc.indexOf(from)));
const keeper = (keepResult) => new Function('VENUE', 'CLS', 'LOOKS', 'playerLook', 'flagCode', 'lookFrom', 'keepResult',
  `${between('function resultRecord(', 'function keepResult(')}\n${between('function keepOneOnOne(', 'const openResult')}\nreturn keepOneOnOne;`)(
  { id: 'palma' }, { id: 'jpk1050' }, {}, () => ({ flag: null }), () => null, () => ({ flag: null }), keepResult);

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
const SETTINGS = { preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: HUMANS };
const screen = (me) => Object.assign(new Race({ ...SETTINGS, me }), { settings: { preset: 'medium', length: 'short', laps: 1, start: 1, fleet: 2, daily: null } });
// the two boats sail straight along their own lines, far below the start, at 2 m/s from the first moment of the race
const SPEED = 2, T0 = -64;
const where = (id, T) => ({ x: -450 + SPEED * (T - T0), z: id === 'h' ? 400 : 460 });
function sail(r, until) {
  while (r.clock < until && !r.over) {
    for (const b of r.humans) if (!b.done) Object.assign(b, where(b.id, r.clock), { h: Math.PI / 2, v: 0, rudder: 0, auto: null });
    r.step(1 / 60);
  }
}
// boat b across the finish, from just above it
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
// the record each screen keeps of the race as it ended on the host's: the results as the guest has them, off the wire
const screenOf = (r, me) => (r.player.id === me ? r : screen(me));
function keepAll(r) {
  const results = JSON.parse(JSON.stringify(finalResults(r))), out = {};
  for (const me of ['h', 'g']) keeper((res) => { out[me] = res; })(screenOf(r, me), results);
  return out;
}
const mine = (rec) => rec.boats.find((b) => b.me), theirs = (rec) => rec.boats.find((b) => !b.me);

test('a boat that gives up is DNF, and the other has won without a place or a time', () => {
  const r = screen('h'), [h, g] = r.humans;
  sail(r, 30);
  r.forfeit(g);
  assert.equal(g.dnf, true, 'in the race'); assert.equal(h.dnf, false);
  assert.equal(finalResults(r).winner, 'h', 'the results say who won');
  const { h: host, g: guest } = keepAll(r);

  assert.equal(mine(host).won, true); assert.equal(mine(host).done, false); assert.equal(mine(host).secs, null);
  assert.equal(finish.standing(host, mine(host)), 'won', 'no place for a boat that never crossed the line');
  assert.equal(finish.winnerOf(host), mine(host));
  assert.equal(theirs(host).dnf, true); assert.equal(finish.standing(host, theirs(host)), 'dnf');

  assert.equal(mine(guest).dnf, true);
  assert.equal(finish.standing(guest, mine(guest)), 'dnf', 'the one who gave up did not finish 2nd');
  assert.equal(finish.winnerOf(guest), theirs(guest));
  assert.equal(theirs(guest).name, 'Host');
});

test('a boat out at the limit is DNF, and the boat home keeps her place', () => {
  const r = screen('h'), [h, g] = r.humans;
  sail(r, 20); home(r, h); sail(r, 400);
  assert.equal(r.over, true);
  const { h: host, g: guest } = keepAll(r);
  assert.equal(finish.standing(host, mine(host)), 'place');
  assert.equal(host.boats.indexOf(mine(host)), 0);
  assert.equal(finish.winnerOf(host), mine(host));
  assert.equal(finish.standing(guest, mine(guest)), 'dnf');
  assert.equal(finish.winnerOf(guest), theirs(guest));
  assert.equal(g.dnf, true);
});

test('with no valid finisher the record has no winner', () => {
  // a boat out under the flag, left on the water when the other gives up
  const r = screen('h'), [h, g] = r.humans;
  sail(r, 30); h.ufd = true; r.forfeit(g);
  const a = keepAll(r);
  assert.equal(r.winner, null); assert.equal(finalResults(r).winner, null);
  assert.equal(finish.winnerOf(a.h), null);
  assert.equal(finish.standing(a.h, mine(a.h)), 'dsq'); assert.equal(finish.standing(a.g, mine(a.g)), 'dnf');
  assert.equal(a.h.boats.some((b) => b.won), false);

  // both home with a penalty unserved
  const s = screen('h'), [p, q] = s.humans;
  sail(s, 20);
  for (const b of [p, q]) { b.pen = { tack: false, gybe: false, dir: 1 }; home(s, b); }
  assert.equal(s.over, true); assert.equal(s.winner, null);
  const b = keepAll(s);
  assert.equal(finish.winnerOf(b.h), null);
  assert.deepEqual(b.h.boats.map((x) => finish.standing(b.h, x)), ['dsq', 'dsq']);
});

test('a race with one sailor reads as it always did', () => {
  const rec = { boats: [{ me: false, done: true, dsq: true, secs: 90 }, { me: true, done: true, dsq: false, secs: 100 }, { me: false, done: false, dsq: false, secs: null }] };
  assert.equal(finish.winnerOf(rec), rec.boats[1]);
  assert.deepEqual(rec.boats.map((b) => finish.standing(rec, b)), ['dsq', 'place', 'place'], 'a computer boat not home has her row as before');
  assert.equal(finish.winnerOf({ boats: [{ me: true, done: true, dsq: true, secs: 1 }] }), null);
});

// (each boat within 20 m of where she was: a point every few seconds, and the page's tick)
test('the replay of a kept race puts a boat home and a boat still out where they were', () => {
  const r = screen('h'), [h] = r.humans;
  sail(r, 200); home(r, h); sail(r, 400);
  assert.equal(r.over, true);
  const recs = keepAll(r);
  for (const rec of [recs.h, recs.g]) {
    for (const T of [-30, 30, 100, 190]) for (const p of finish.posesAt(rec, T)) {
      const id = (p.me ? rec === recs.h : rec !== recs.h) ? 'h' : 'g', at = where(id, T);
      assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 20, `${id} at ${T}`);
    }
    const out = rec.boats.find((b) => b.dnf), i = rec.boats.indexOf(out);
    for (const T of [230, 300, 370]) { const p = finish.posesAt(rec, T)[i], at = where('g', T); assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 20, `the boat out, at ${T}`); }
    assert.ok(out.trackEnd > 370 && out.trackEnd <= r.clock + 0.01, 'she keeps the clock her track ends at');
    assert.equal(rec.boats.find((b) => b.done).trackEnd, undefined, 'a boat home has her finish');
  }
});

test('the replay of a race given up runs to where it ended, for both boats', () => {
  const r = screen('h'), [, g] = r.humans;
  sail(r, 150); r.forfeit(g);
  const { h: rec } = keepAll(r);
  for (const b of rec.boats) assert.ok(Math.abs(b.trackEnd - r.clock) <= 1.1, 'each ends with the race');
  assert.ok(Math.abs(finish.replaySpan(rec).to - r.clock) <= 1.1, 'and the replay with them');
  for (const T of [0, 80, 140]) for (const p of finish.posesAt(rec, T)) {
    const at = where(p.me ? 'h' : 'g', T);
    assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 20, `${p.me ? 'h' : 'g'} at ${T}`);
  }
});

test('a record without the track\'s end is read as before', () => {
  const track = Array.from({ length: 100 }, (_, i) => [i, 0]);
  const old = { daily: null, preset: 'medium', length: 'short', laps: 1, start: 1, current: false, course: {}, boats: [{ name: null, me: true, done: false, dsq: false, secs: null, track }] };
  const was = finish.posesAt(old, -20)[0];
  assert.equal(finish.posesAt({ ...old, boats: [{ ...old.boats[0], trackEnd: undefined }] }, -20)[0].x, was.x);
  assert.equal(finish.replaySpan(old).to, 300);
});
