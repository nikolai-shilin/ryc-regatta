// A contact in a free race sailed with DSQ for it (public/game/sim.js verdict), judged as sailors asked: the rudder of the
// boat that had to keep clear is read, and the boat with right of way can be at fault too. Also how far a boat carries
// her way, and the seconds a mile upwind the yacht pages show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { CLASSES } = await import('../public/game/classes.js');
const { BEAT_TWS, BEAT_SECS, YACHT_IDS } = await import('../lib/yachts.ts');
const { D2R, lineD } = sim;
const KN = 0.5144;

// two boats crossing on opposite tacks on the beat, the clock at `clock`: `keep` must keep clear of `row`
function crossing({ clock = 100, contactDsq = true } = {}) {
  const r = new sim.Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, contactDsq }), [p, q] = r.boats, W = r.wind.at(0, 0).dir;
  r.clock = clock;
  const set = (b, h, x) => Object.assign(b, { x, z: 0, h, v: 3, leg: 1, twa: Math.atan2(Math.sin(W - h), Math.cos(W - h)), tws: 12, wdir: W, tackSide: Math.sign(Math.sin(W - h)), lastD: lineD(r.course, b), lastZ: 0, auto: null, rudder: 0, yawRate: 0, hist: [] });
  set(p, W + 45 * D2R, 0); set(q, W - 45 * D2R, 4);
  const keep = r.rightOfWay(p, q).giver, row = keep === p ? q : p;
  return { r, p, q, keep, row, W };
}
// her last three seconds: on this heading, the rudder at this
const held = (r, b, rudder = 0) => { const at = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((s) => r.clock - 3 + s); b.rudder = rudder; b.hist = at.map((t) => [t, b.h]); b.helm = at.map((t) => [t, rudder]); };
const names = (v) => v.guilty.map((f) => f.boat);
const why = (v, b) => v.guilty.find((f) => f.boat === b)?.why;

test('the boat that had to keep clear, her rudder not hard over, is at fault and the angle is read', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 0.4); held(r, row);
  const v = r.verdict(p, q, 1);
  assert.deepEqual(names(v), [keep]); assert.equal(why(v, keep), 'rudder'); assert.equal(v.rudder, 14);
});

test('hard over and too late, with nothing wrong in the other boat, she is still at fault', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 1); held(r, row);
  const v = r.verdict(p, q, 1);
  assert.deepEqual(names(v), [keep]); assert.equal(why(v, keep), 'late');
});

test('the boat with right of way who had room and held her course is at fault too (rule 14)', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 0.4); held(r, row);
  const v = r.verdict(p, q, 6);
  assert.deepEqual(names(v), [keep, row]);
  assert.equal(v.guilty[1].rule, '14'); assert.equal(why(v, row), 'room');
});

test('she had no room if the other boat has only just turned across her, or if they barely closed', () => {
  const a = crossing(); held(a.r, a.keep, 0.4); held(a.r, a.row); a.keep.hist[1][1] = a.keep.h - 40 * D2R;
  assert.deepEqual(names(a.r.verdict(a.p, a.q, 6)), [a.keep]);
  const b = crossing(); held(b.r, b.keep, 0.4); held(b.r, b.row);
  assert.deepEqual(names(b.r.verdict(b.p, b.q, 2)), [b.keep]);
});

test('she who was already steering away had not held on', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 0.4); held(r, row, 0.6);
  assert.deepEqual(names(r.verdict(p, q, 6)), [keep]);
});

test('bearing away onto the boat keeping clear is a foul (rule 16); the boat hard over is cleared', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 1); held(r, row); r.turnedAt = (b) => b === row;
  const v = r.verdict(p, q, 6);
  assert.deepEqual(names(v), [row]); assert.equal(v.guilty[0].rule, '16'); assert.equal(why(v, row), 'turned');
});

test('…but with her rudder not hard over both are at fault', () => {
  const { r, p, q, keep, row } = crossing();
  held(r, keep, 0.3); held(r, row); r.turnedAt = (b) => b === row;
  assert.deepEqual(new Set(names(r.verdict(p, q, 6))), new Set([keep, row]));
});

// the boat with right of way luffed up to 20° off the wind
function luffed(clock) {
  const c = crossing({ clock }), { row, W } = c, s = Math.sign(row.twa);
  row.h = W - s * 20 * D2R; row.twa = s * 20 * D2R;
  held(c.r, c.keep, 1); held(c.r, row);
  return c;
}
test('above close-hauled after the gun she is at fault (rule 17), and the boat hard over is cleared', () => {
  const { r, p, q, row } = luffed(100), v = r.verdict(p, q, 1);
  assert.deepEqual(names(v), [row]); assert.equal(v.guilty[0].rule, '17'); assert.equal(why(v, row), 'above');
});

test('before the gun there is no proper course: she may luff as high as she likes', () => {
  const { r, p, q, keep } = luffed(-30);
  assert.deepEqual(names(r.verdict(p, q, 1)), [keep]);
});

test('disqualified, you are told why and your race is over', () => {
  const { r, p, q } = crossing(), P = r.player, o = P === p ? q : p;
  r.verdict = () => ({ guilty: [{ boat: P, rule: '10', why: 'rudder', who: o.name }], keep: P, row: o, rudder: 14 });
  r.contactOut(p, q, 3);
  assert.equal(P.dsq, true); assert.equal(P.done, true); assert.equal(r.over, true); assert.equal(P.place, null);
  const m = r.messages.find((x) => x.key === 'contactDsq');
  assert.deepEqual([m.arg.rule, m.arg.why, m.arg.deg, m.arg.max, m.to], ['10', 'rudder', 14, 35, P]);
  assert.equal(P.log.fouls.at(-1).rule, '10');
});

test('a computer boat disqualified is out of the way: no shadow, no contact, and you race on', () => {
  const { r, p, q, W } = crossing(), P = r.player, o = P === p ? q : p;
  r.verdict = () => ({ guilty: [{ boat: o, rule: '10', why: 'late', who: P.name }], keep: o, row: P, rudder: 35 });
  r.contactOut(p, q, 3);
  assert.equal(o.dsq, true); assert.equal(r.over, false);
  assert.equal(r.messages.find((x) => x.key === 'theyDsq').arg.who, o.name);
  Object.assign(P, { x: o.x - Math.sin(W) * 30, z: o.z + Math.cos(W) * 30 });
  assert.equal(r.windAt(P).shadow, 0);
  Object.assign(P, { x: o.x, z: o.z, hit: 0 }); o.hit = 0; r.messages.length = 0;
  r.collide(1 / 60);
  assert.equal(r.messages.filter((x) => x.key === 'bump').length, 0);
});

test('with the switch off a contact is the penalty turn it always was', () => {
  const { r, p, q } = crossing({ contactDsq: false });
  Object.assign(q, { x: p.x + 1, z: p.z }); p.hit = q.hit = 0;
  r.collide(1 / 60);
  assert.equal(p.dsq || q.dsq, false);
  assert.ok(p.pen || q.pen, 'one of them owes a turn');
});

test('a race with two humans never disqualifies for contact', () => {
  const r = new sim.Race({ seed: 11, fleet: 2, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], me: 'a', contactDsq: true });
  assert.equal(r.contactDsq, false);
});

test('luffed head to wind from 7 knots the JPK 1050 carries her way some 55 m', () => {
  const d = sim.shootReach(7 * KN, 12);
  assert.ok(d > 48 && d < 65, `${d} m`);
});

test('the seconds a mile upwind on the yacht pages are the game’s own', () => {
  assert.deepEqual(Object.keys(BEAT_SECS).sort(), [...YACHT_IDS].sort());
  for (const id of YACHT_IDS) {
    const c = CLASSES[id];
    assert.deepEqual([...BEAT_SECS[id]], BEAT_TWS.map((w) => { const i = c.tws.indexOf(w); return Math.round(3600 / (c.beatV[i] * Math.cos(c.beat[i] * D2R))); }), id);
  }
});
