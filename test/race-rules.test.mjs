// The racing rules as a race judge rules on them: the false start and its flags, the line crossed at the bow, mark-room
// at the windward mark, and who keeps clear in a tack. Run headless in Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { D2R, HULL } = sim;

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
const SEED = { P: 11, B: 14 }; // the seed picks the day's flag
const duel = (o = {}) => new sim.Race({ preset: 'medium', length: 'short', laps: 2, seed: SEED.P, fleet: 2, start: 1, humans: HUMANS, me: 'h', ...o });
const legOf = (r, k) => r.course.legs.indexOf(k);
// a point on the line's normal: t along the line, d above it (the middle of the hull)
const linePt = (c, t, d) => ({ x: c.pin.x + c.dir.x * c.len * t + c.normal.x * d, z: c.pin.z + c.dir.z * c.len * t + c.normal.z * d });
const headingOf = (v) => Math.atan2(v.x, -v.z);
const UP = (c) => headingOf(c.normal), DOWN = (c) => headingOf({ x: -c.normal.x, z: -c.normal.z });
// square to the line, the middle of her hull d above it
const onLine = (r, b, d, h, t = 0.5) => { Object.assign(b, linePt(r.course, t, d), { h, v: 0, rudder: 0, yawRate: 0, auto: null }); };
// a boat on a true wind angle (+: the wind on her starboard side, her starboard tack)
function sail(r, b, x, z, twaDeg) {
  const W = r.wind.dir();
  Object.assign(b, { x, z, h: W - twaDeg * D2R, v: 3, wdir: W, twa: twaDeg * D2R, boom: twaDeg >= 0 ? 1 : -1, tackSide: Math.sign(twaDeg), auto: null, pen: null, ocs: false, sinceTack: 99 });
}
function racing(r, k) { r.clock = 300; for (const b of r.boats) b.leg = legOf(r, k); r.zoneStates.clear(); r.pairs.clear(); return r.boats; }
// two boats on one course, the mark `ahead` hulls before them: a is `sa` hulls to her starboard side of that course, b `sb`
function nearMark(r, a, b, twaDeg, ahead, sa, sb) {
  const m = r.course.windward, h = r.wind.dir() - twaDeg * D2R, fx = Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = Math.sin(h);
  const at = (s) => [m.x - fx * ahead * HULL + sx * s * HULL, m.z - fz * ahead * HULL + sz * s * HULL];
  sail(r, a, ...at(sa), twaDeg); sail(r, b, ...at(sb), twaDeg);
}

// ---------- the line is crossed at the bow

test('over at the gun: the bow over the line is over, the bow short of it is not', () => {
  for (const [d, over] of [[-HULL / 2 + 1, true], [-HULL / 2 - 1, false]]) {
    const r = duel(), [h, g] = r.boats;
    r.clock = -0.01; onLine(r, h, d, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
    r.step(1 / 60);
    assert.equal(!!h.ocs, over, `the middle of her hull ${d.toFixed(1)} m from the line`);
  }
});

test('back from a false start: clear once all of her hull is below the line', () => {
  for (const [d, clear] of [[-3, false], [-HULL / 2 - 0.5, true]]) {
    const r = duel(), [h] = r.boats;
    r.clock = 20; h.ocs = true; onLine(r, h, d, DOWN(r.course));
    r.progress(h);
    assert.equal(!h.ocs, clear, `the middle of her hull ${d.toFixed(1)} m from the line`);
  }
});

test('she has started when her bow crosses the line', () => {
  const r = duel(), [h] = r.boats;
  r.clock = 20; onLine(r, h, -HULL / 2 - 1, UP(r.course)); r.progress(h);
  assert.equal(h.leg, 0);
  onLine(r, h, -HULL / 2 + 1, UP(r.course)); r.progress(h);
  assert.equal(h.leg, 1);
});

test('she has finished when her bow crosses the line', () => {
  const r = duel(), [h] = r.boats, last = r.course.legs.length - 1;
  r.clock = 300; h.leg = last; onLine(r, h, HULL / 2 + 1, DOWN(r.course)); r.progress(h);
  assert.ok(!h.done);
  onLine(r, h, HULL / 2 - 1, DOWN(r.course)); r.progress(h);
  assert.ok(h.done);
});

test('a finish line of its own is crossed at the bow too', () => {
  const r = duel({ course: 'trap' }), [h] = r.boats, f = r.course.finish;
  const put = (s) => Object.assign(h, { x: (f.a.x + f.b.x) / 2 + f.through.x * s, z: (f.a.z + f.b.z) / 2 + f.through.z * s, h: headingOf(f.through) });
  r.clock = 300; h.leg = r.course.legs.length - 1;
  put(-HULL / 2 - 1); r.progress(h); assert.ok(!h.done);
  put(-HULL / 2 + 1); r.progress(h); assert.ok(h.done);
});

test('home with a penalty still owed is disqualified: no turns after the finish', () => {
  const r = duel(), [h] = r.boats;
  r.clock = 300; h.leg = r.course.legs.length - 1; h.pen = { tack: false, gybe: false, dir: 0 };
  onLine(r, h, HULL / 2 + 1, DOWN(r.course)); r.progress(h);
  onLine(r, h, HULL / 2 - 1, DOWN(r.course)); r.progress(h);
  assert.ok(h.done); assert.equal(h.dsq, true);
});

// ---------- the false start

test('a boat going back after a false start keeps clear, even on starboard (rule 21.1)', () => {
  const r = duel(); racing(r, 'mark'); const [h, g] = r.boats;
  sail(r, h, 0, -200, 45); sail(r, g, 8, -200, -45);
  assert.equal(r.rightOfWay(h, g).giver, g, 'port keeps clear of starboard');
  h.ocs = true;
  assert.deepEqual(r.rightOfWay(h, g), { giver: h, rule: '21.1' });
  assert.deepEqual(r.judge(g, h), { giver: h, rule: '21.1' });
});

test('a boat taking a penalty keeps clear under rule 21.2', () => {
  const r = duel(); racing(r, 'mark'); const [h, g] = r.boats;
  sail(r, h, 0, -200, 45); sail(r, g, 8, -200, -45);
  h.pen = { tack: false, gybe: false, dir: 0 };
  assert.deepEqual(r.rightOfWay(h, g), { giver: h, rule: '21.2' });
  assert.deepEqual(r.judge(h, g), { giver: h, rule: '21.2' });
});

test('over under the black flag: out of the race at once', () => {
  const r = duel({ seed: SEED.B }), [h, g] = r.boats;
  assert.equal(r.prepFlag, 'B');
  r.clock = -30; onLine(r, h, 20, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
  r.step(1 / 60);
  assert.equal(h.bfd, true); assert.equal(h.dsq, true); assert.equal(h.done, true); assert.equal(h.out, true); assert.equal(h.place, null);
  assert.ok(!g.done); assert.equal(r.over, false, 'the other races on');
});

test('the black flag sees the bow in the triangle', () => {
  const r = duel({ seed: SEED.B }), [h, g] = r.boats;
  r.clock = -30; onLine(r, h, -HULL / 2 + 1, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
  r.step(1 / 60);
  assert.equal(h.bfd, true);
});

test('out under the black flag, a boat sails no restart', () => {
  const r = duel({ seed: SEED.B }), [h, g] = r.boats;
  r.clock = -30; onLine(r, h, 20, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
  r.step(1 / 60);
  r.generalRecall();
  assert.equal(h.done, true); assert.equal(h.dsq, true); assert.equal(h.out, true);
});

test('alone in a fleet, the black flag ends her race', () => {
  const r = new sim.Race({ preset: 'medium', length: 'short', seed: SEED.B, fleet: 4, start: 1 }), P = r.player;
  r.clock = -30; onLine(r, P, 20, UP(r.course));
  r.step(1 / 60);
  assert.equal(P.out, true); assert.equal(r.over, true);
});

test('both out under the black flag: the race is over, and nobody has won it', () => {
  const r = duel({ seed: SEED.B }), [h, g] = r.boats;
  r.clock = -30; onLine(r, h, 20, UP(r.course)); onLine(r, g, 20, UP(r.course), 0.2);
  r.step(1 / 60);
  assert.equal(r.over, true); assert.equal(r.winner, null);
});

// ---------- rule 18 at the windward mark

test('the windward mark has a zone', () => {
  const c = sim.makeCourse(2, 260, 0, 5, 'wl');
  assert.equal(sim.hasZone(c, c.legs.indexOf('mark')), true);
});

test('windward mark, same tack, overlapped: the inside boat gets the room', () => {
  const r = duel(); racing(r, 'mark'); const [inside, outside] = r.boats;
  nearMark(r, inside, outside, -40, 2, 0.5, 1.1); // on port, the mark to port of them: the boat nearer it is inside
  assert.equal(r.rightOfWay(inside, outside, true).giver, inside, 'without the mark she would be the windward boat');
  r.zones();
  assert.deepEqual(r.rightOfWay(inside, outside), { giver: outside, rule: '18' });
});

test('windward mark, same tack, outside the zone: no mark-room yet', () => {
  const r = duel(); racing(r, 'mark'); const [inside, outside] = r.boats;
  nearMark(r, inside, outside, -40, 5, 0.5, 1.1);
  r.zones();
  assert.equal(r.zoneOf(inside, outside), null);
  assert.equal(r.rightOfWay(inside, outside).rule, '11');
});

test('windward mark, opposite tacks: no inside or outside, port keeps clear of starboard', () => {
  const r = duel(); racing(r, 'mark'); const [stb, port] = r.boats, m = r.course.windward;
  sail(r, stb, m.x + 12, m.z + 14, 40); sail(r, port, m.x + 4, m.z + 14, -40);
  r.zones();
  assert.equal(r.zoneOf(stb, port), null);
  assert.deepEqual(r.rightOfWay(stb, port), { giver: port, rule: '10' });
});

test('windward mark, a boat that tacks in the zone gets no room from one already on that tack', () => {
  const r = duel(); racing(r, 'mark'); const [tacker, other] = r.boats;
  nearMark(r, tacker, other, -40, 2, 0.5, 1.1);
  Object.assign(tacker, { twa: 10 * D2R, tackSide: -1 }); // through head to wind, in the zone
  assert.ok(tacker.tacking);
  r.trackRow();
  nearMark(r, tacker, other, -40, 2, 0.5, 1.1);
  r.zones();
  assert.deepEqual(r.rightOfWay(tacker, other), { giver: tacker, rule: '18.3' });
});

// ---------- rule 13

test('a tack starts at head to wind: until then she holds her tack', () => {
  const r = duel(); racing(r, 'mark'); const [h, g] = r.boats;
  sail(r, h, 0, -200, 40); sail(r, g, 8, -200, -40);
  h.tackOrGybe();
  assert.ok(h.auto, 'the helm is over'); assert.equal(h.tacking, false);
  assert.deepEqual(r.rightOfWay(h, g), { giver: g, rule: '10' });
});

test('past head to wind she keeps clear until she is close-hauled on the new tack', () => {
  const r = duel(); racing(r, 'mark'); const [h, g] = r.boats;
  sail(r, h, 0, -200, 40); sail(r, g, 8, -200, -40);
  h.tackOrGybe();
  h.twa = -10 * D2R;
  assert.equal(h.tacking, true);
  assert.deepEqual(r.rightOfWay(h, g), { giver: h, rule: '13' });
  Object.assign(h, { twa: -34 * D2R, tackSide: -1 }); // bearing away, not yet close-hauled
  assert.equal(h.tacking, true);
  h.auto = null;
  assert.equal(h.tacking, false);
});

test('both tacking: the boat on the other\'s port side keeps clear', () => {
  const r = duel(); racing(r, 'mark'); const [a, b] = r.boats, W = r.wind.dir();
  const sx = Math.cos(W), sz = Math.sin(W); // across the wind, to starboard of a boat head to wind
  sail(r, a, 0, -200, 10); sail(r, b, sx * 8, -200 + sz * 8, 10);
  a.tackSide = b.tackSide = -1;
  assert.ok(a.tacking && b.tacking);
  assert.deepEqual(r.rightOfWay(a, b), { giver: a, rule: '13' });
  assert.deepEqual(r.rightOfWay(b, a), { giver: a, rule: '13' });
});

// ---------- the words for the new calls

test('the new calls are named in both languages', async () => {
  const rules = JSON.parse(await readFile(new URL('../lib/rules.json', import.meta.url), 'utf8'));
  for (const k of ['r21.1', 'x21.1', 'r21.2', 'x21.2', 'r18.3', 'x18.3']) for (const l of ['en', 'ru']) assert.ok(rules[k]?.[l], `${k} ${l}`);
});

// ---------- the I flag (rule 30.1): over in the last minute, back round an end of the line

const SEED_I = 12;
const iRace = () => duel({ seed: SEED_I });
const said = (r, key, b) => r.messages.filter((m) => m.key === key && (b === undefined || m.to === b));

test('one day in five flies the I flag; the other days keep theirs', () => {
  assert.equal(iRace().prepFlag, 'I');
  assert.equal(duel({ seed: 11 }).prepFlag, 'P'); assert.equal(duel({ seed: 13 }).prepFlag, 'U'); assert.equal(duel({ seed: 14 }).prepFlag, 'B');
});

test('under I, over the line in the last minute: she must go round an end', () => {
  const r = iRace(), [h, g] = r.boats;
  r.clock = -30; onLine(r, h, 3, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
  r.step(1 / 60);
  assert.equal(h.roundEnd, true); assert.ok(!g.roundEnd);
  assert.equal(said(r, 'roundEnd', h).length, 1);
  assert.ok(!h.ufd && !h.bfd && !h.done, 'and she is still racing');
});

test('under I, over the line before the last minute is no matter', () => {
  const r = iRace(), [h] = r.boats;
  r.clock = -90; onLine(r, h, 3, UP(r.course));
  r.step(1 / 60);
  assert.ok(!h.roundEnd);
});

test('under P, over in the last minute is no matter until the gun', () => {
  const r = duel(), [h] = r.boats;
  r.clock = -30; onLine(r, h, 3, UP(r.course));
  r.step(1 / 60);
  assert.ok(!h.roundEnd);
});

test('dipping back through the line doesn\'t clear her; across its extension does', () => {
  const r = iRace(), [h] = r.boats;
  r.clock = -30; h.roundEnd = true;
  onLine(r, h, HULL / 2 + 1, DOWN(r.course)); r.progress(h);
  onLine(r, h, -HULL, DOWN(r.course)); r.progress(h);
  assert.equal(h.roundEnd, true, 'back through the line between its ends');
  onLine(r, h, HULL / 2 + 1, DOWN(r.course), 1.3); r.progress(h);
  onLine(r, h, -HULL, DOWN(r.course), 1.3); r.progress(h);
  assert.equal(h.roundEnd, false, 'round the committee boat\'s end');
  assert.equal(said(r, 'clearedEnd', h).length, 1);
});

test('still owing the round at the gun, she is over (the X flag) and doesn\'t start until she has gone round', () => {
  const r = iRace(), [h, g] = r.boats;
  r.clock = -0.01; h.roundEnd = true; onLine(r, h, -20, UP(r.course)); onLine(r, g, -60, UP(r.course), 0.2);
  r.step(1 / 60);
  assert.equal(h.ocs, true); assert.equal(r.flags.X, true);
  onLine(r, h, -HULL / 2 - 1, UP(r.course)); r.progress(h);
  onLine(r, h, -HULL / 2 + 1, UP(r.course)); r.progress(h);
  assert.equal(h.leg, 0, 'across the line without going round: no start');
  onLine(r, h, HULL / 2 + 1, DOWN(r.course), -0.3); r.progress(h);
  onLine(r, h, -HULL, DOWN(r.course), -0.3); r.progress(h); // round the pin end
  assert.ok(!h.roundEnd && !h.ocs);
  onLine(r, h, -HULL / 2 - 1, UP(r.course)); r.progress(h);
  onLine(r, h, -HULL / 2 + 1, UP(r.course)); r.progress(h);
  assert.equal(h.leg, 1, 'now she has started');
});

test('a general recall under I: the next start is under U, and nobody owes a round', () => {
  const r = iRace(), [h] = r.boats;
  h.roundEnd = true; r.generalRecall();
  assert.equal(r.prepFlag, 'U'); assert.ok(!h.roundEnd);
});

test('a computer boat over under I goes round an end of the line and starts', () => {
  const r = new sim.Race({ preset: 'medium', length: 'short', seed: SEED_I, fleet: 3, start: 1 });
  assert.equal(r.prepFlag, 'I');
  const ai = r.boats.find((b) => b.ai), c = r.course;
  r.clock = -40; onLine(r, ai, 4, UP(c)); Object.assign(ai, { v: 3 }); ai.ai.go = true;
  let wasOver = false, outside = false;
  for (let n = 0; n < 60 * 150 && ai.leg === 0; n++) {
    r.step(1 / 60);
    if (ai.roundEnd) wasOver = true;
    if (wasOver && ai.roundEnd === false && !outside) { const t = sim.lineT(c, sim.bowOf(ai)); outside = t < 0 || t > 1; }
  }
  assert.ok(wasOver, 'she was over in the last minute');
  assert.ok(outside, 'and cleared herself round an end');
  assert.equal(ai.leg, 1, 'then she started');
});

test('a computer boat owing a round but back below the line, between its ends, goes up round an end and starts', () => {
  for (const t of [0.1, 0.5, 0.9]) {
    const r = new sim.Race({ preset: 'medium', length: 'short', seed: SEED_I, fleet: 3, start: 1 });
    const ai = r.boats.find((b) => b.ai), c = r.course;
    r.clock = -20; onLine(r, ai, -15, DOWN(c), t); Object.assign(ai, { v: 2, roundEnd: true }); ai.ai.go = true;
    for (let n = 0; n < 60 * 200 && ai.leg === 0; n++) r.step(1 / 60);
    assert.ok(!ai.roundEnd, `${t}: she went round an end`);
    assert.equal(ai.leg, 1, `${t}: and started`);
  }
});

test('the I flag and a round owed reach the guest', async () => {
  const { encodeSnap, readBoat, goodSnap } = await import('../public/game/wire.js');
  const r = iRace(), [h] = r.boats;
  h.roundEnd = true;
  const s = encodeSnap(r);
  assert.equal(s.p, 'I'); assert.ok(goodSnap(r, s));
  assert.equal(readBoat(s.b[0]).roundEnd, true); assert.equal(readBoat(s.b[1]).roundEnd, false);
});
