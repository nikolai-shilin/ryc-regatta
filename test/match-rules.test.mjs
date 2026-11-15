// A match race in the sim (public/game/sim.js, `match: true`): two human boats, blue and yellow, Appendix C's entry,
// penalties taken when the boat chooses, the two-length zone, recalls one by one, and the first home wins. Run
// headless in Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { D2R, HULL, lineD, lineT, wrap } = sim;
const sgn = (v) => (v < 0 ? -1 : 1);

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
const matchRace = (opts = {}) => new sim.Race({ preset: 'medium', length: 'short', seed: 11, humans: HUMANS, me: 'h', match: true, ...opts });
// a boat's script: fn(r, b) sets her helm (or holds her) before each step
const steer = (b, fn) => { b.script = fn; };
// step the race, 1/60 s at a time, each human on her script, until cond() or `secs` more seconds; true if cond() held
function runUntil(r, cond, secs = 600) {
  for (let n = 0; n < secs * 60 && !cond(); n++) { for (const b of r.humans) b.script?.(r, b); r.step(1 / 60); }
  return cond();
}
const toward = (r, b, p) => r.steerTo(b, r.sailable(Math.atan2(p.x - b.x, -(p.z - b.z)), b.wdir, b.tws));
// held where she is, stopped, heading as she was (a boat sitting still)
const still = (b) => { const at = { x: b.x, z: b.z, h: b.h }; steer(b, (r, o) => Object.assign(o, at, { v: 0, rudder: 0, yawRate: 0 })); };
// a point by the line: t along it (0 the pin, 1 the committee boat), d off it (+ the course side)
const linePt = (c, t, d) => ({ x: c.pin.x + c.dir.x * c.len * t + c.normal.x * d, z: c.pin.z + c.dir.z * c.len * t + c.normal.z * d });
const said = (r, key, b) => r.messages.filter((m) => m.key === key && (b === undefined || m.to === b));
// put a boat somewhere sailing, her line crossing state from there
const put = (r, b, p, h, v = 3) => Object.assign(b, { x: p.x, z: p.z, h, v, lastD: lineD(r.course, b), lastZ: p.z, auto: null, rudder: 0, yawRate: 0 });
// halfway up the beat, off to one side (+1 right, −1 left) by `off` metres
const midBeat = (c, off = 0) => ({ x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2 + off, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 });
// after the gun, both on leg `leg`, with the clock at t
function afterGun(r, t = 10, leg = 1) { r.clock = t; for (const b of r.humans) b.leg = leg; }

test('a match is two boats, blue at the committee boat, yellow at the pin, each outside her end', () => {
  const r = matchRace(); const [h, g] = r.humans;
  assert.equal(r.boats.length, 2); assert.equal(h.side, 'blue'); assert.equal(g.side, 'yellow');
  assert.ok(sim.lineT(r.course, h) > 1 && sim.lineT(r.course, g) < 0);
  assert.equal(r.zone, 2 * sim.HULL);
  // and the rest of the match's settings
  assert.equal(r.match, true); assert.equal(r.course.type, 'wl'); assert.equal(r.course.laps, 2); assert.equal(r.prepFlag, 'P');
  assert.equal(r.clock, -308); assert.deepEqual(r.current, { x: 0, z: 0 });
  assert.ok(lineD(r.course, h) > 0 && lineD(r.course, g) > 0, 'both on the course side');
  const W = r.wind.dir();
  assert.ok(wrap(W - h.h) < 0, 'blue on port'); assert.ok(wrap(W - g.h) > 0, 'yellow on starboard');
  // each heading away from her end along the line's extension, on a reach
  const c = r.course, along = (b) => Math.sin(b.h) * c.dir.x - Math.cos(b.h) * c.dir.z;
  assert.ok(along(h) > 0.99 && along(g) < -0.99, 'along the extension, away from her end');
  assert.ok(Math.abs(wrap(W - h.h)) > 70 * D2R && Math.abs(wrap(W - h.h)) < 110 * D2R, 'a reach');
  assert.ok(r.roomAt(h.x, h.z) > 20 && r.roomAt(g.x, g.z) > 20, 'both in open water');
  assert.ok(r.humans.every((b) => b.owed === 0 && b.pen === null && !b.entered));
  // blue can be the guest
  const r2 = matchRace({ blue: 'g' });
  assert.equal(r2.humans[1].side, 'blue'); assert.equal(r2.humans[0].side, 'yellow');
  assert.ok(sim.lineT(r2.course, r2.humans[1]) > 1 && sim.lineT(r2.course, r2.humans[0]) < 0);
  // a free race has none of it
  const f = new sim.Race({ seed: 11, fleet: 2, humans: HUMANS });
  assert.equal(f.match, false); assert.equal(f.zone, sim.ZONE);
});

test('a boat that enters through her own end in the window owes nothing; one that doesn\'t owes one', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course;
  // h: down to a spot just outside the committee boat on the course side, waits there head to wind until the
  // preparatory signal, then runs down across the line's extension outside her end
  const hold = linePt(c, 1 + 25 / c.len, 15), across = linePt(c, 1 + 25 / c.len, -30);
  let enteredAt = null;
  steer(h, (r, b) => {
    if (b.entered && enteredAt === null) enteredAt = r.clock;
    if (r.clock < -240) { if (Math.hypot(hold.x - b.x, hold.z - b.z) > 10) toward(r, b, hold); else r.steerTo(b, b.wdir); }
    else toward(r, b, across);
  });
  still(g);
  runUntil(r, () => r.clock >= -119);
  assert.ok(h.entered, 'blue entered'); assert.equal(h.owed, 0);
  assert.ok(enteredAt !== null && enteredAt >= -240 && enteredAt <= -150, `entered at ${enteredAt}`);
  assert.equal(said(r, 'entered', h).length, 1);
  assert.equal(said(r, 'entryEarly').length, 0);
  assert.ok(!g.entered); assert.equal(g.owed, 1);
  assert.equal(said(r, 'entryLate', g).length, 1); assert.equal(said(r, 'entryLate').length, 1, 'only to yellow');
});

test('left alone, each boat owes one for a late entry and none for an early one', () => {
  for (const preset of ['light', 'medium', 'strong']) for (const seed of [11, 12, 13]) {
    const r = matchRace({ preset, seed }), key = `${preset} ${seed}`;
    for (const b of r.humans) steer(b, (r, o) => { o.rudder = 0; });
    runUntil(r, () => r.clock >= -119);
    for (const b of r.humans) {
      assert.equal(b.owed, 1, `${key} ${b.side} owes one`); assert.ok(!b.entered, key);
      assert.equal(said(r, 'entryLate', b).length, 1, key);
    }
    assert.equal(said(r, 'entryEarly').length, 0, `${key}: no early entry`);
  }
});

test('turning back and running in through her own end enters, on both sides, in every wind', () => {
  for (const preset of ['light', 'medium', 'strong']) for (const seed of [1, 5, 9, 12]) {
    const r = matchRace({ preset, seed }), c = r.course, key = `${preset} ${seed}`;
    for (const b of r.humans) {
      const t = b.side === 'blue' ? 1 + 25 / c.len : -25 / c.len, hold = linePt(c, t, 15), across = linePt(c, t, -30);
      steer(b, (r, o) => {
        if (r.clock < -240) { if (Math.hypot(hold.x - o.x, hold.z - o.z) > 10) toward(r, o, hold); else r.steerTo(o, o.wdir); }
        else toward(r, o, across);
      });
    }
    runUntil(r, () => r.clock >= -119);
    for (const b of r.humans) { assert.ok(b.entered, `${key} ${b.side} entered`); assert.equal(b.owed, 0, `${key} ${b.side} owes nothing`); }
  }
});

test('inside her end at the preparatory signal: a penalty', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course;
  still(h); still(g);
  runUntil(r, () => r.clock >= -245);
  put(r, g, linePt(c, 0.3, 20), g.h, 0); still(g);
  assert.ok(lineT(c, g) >= 0);
  runUntil(r, () => r.clock >= -239);
  assert.equal(g.owed, 1); assert.equal(said(r, 'entryEarly', g).length, 1);
  assert.equal(h.owed, 0); assert.equal(said(r, 'entryEarly', h).length, 0);
});

test('both over at the gun are each recalled, no general recall', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course;
  still(h); still(g);
  runUntil(r, () => r.clock >= -3);
  put(r, h, linePt(c, 0.7, 10), h.h, 0); still(h);
  put(r, g, linePt(c, 0.3, 10), g.h, 0); still(g);
  runUntil(r, () => r.clock >= 0.1);
  assert.ok(lineD(c, h) > 0 && lineD(c, g) > 0);
  assert.ok(h.ocs && g.ocs, 'both OCS'); assert.ok(r.flags.X, 'the X flag');
  assert.equal(r.recalls, 0); assert.equal(said(r, 'genRecall').length, 0); assert.ok(r.clock > 0, 'the start stands');
  assert.equal(said(r, 'ocs', h).length, 1); assert.equal(said(r, 'ocs', g).length, 1);
});

test('a penalty can\'t be paid before the start', () => {
  const r = matchRace(), [h, g] = r.humans;
  still(h); still(g);
  runUntil(r, () => r.clock >= -60);
  g.owed = 1;
  // two full circles and more, hard over, before the gun
  let turned = 0, prev = g.h;
  steer(g, (r, b) => { b.rudder = 1; turned += Math.abs(wrap(b.h - prev)); prev = b.h; });
  runUntil(r, () => r.clock >= -1);
  assert.ok(turned > 4 * Math.PI, `turned ${(turned / D2R).toFixed(0)}°`);
  assert.equal(g.owed, 1); assert.equal(g.pen, null);
  assert.equal(said(r, 'penStart').length, 0); assert.ok(!g.events.includes('penaltyDone'));
});

test('on a beat a gybe and back to close-hauled pays one; a tack doesn\'t', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir(), up = sim.beatAngle(r.wind.p.tws) * D2R;
  afterGun(r);
  assert.ok(sim.isBeat(c, 1));
  put(r, h, linePt(c, 0.5, -80), h.h, 0); still(h);
  put(r, g, midBeat(c), W - up, 3.5); // close-hauled on starboard
  runUntil(r, () => false, 2);
  g.owed = 1; g.events.length = 0;
  // a tack: no penalty paid, none begun
  g.tackOrGybe(); assert.ok(g.auto && !g.auto.gybe, 'a tack');
  runUntil(r, () => !g.auto, 15);
  assert.ok(g.twa < 0, 'on port now');
  assert.equal(g.owed, 1); assert.equal(g.pen, null); assert.equal(said(r, 'penStart').length, 0);
  // now bear away, gybe, and come on round up to close-hauled
  const dir = -sgn(g.twa);
  steer(g, (r, b) => { b.rudder = dir; });
  assert.ok(runUntil(r, () => g.owed === 0, 40), 'paid');
  assert.equal(said(r, 'penStart', g).length, 1);
  assert.equal(g.pen, null); assert.ok(g.events.includes('penaltyDone'));
  assert.ok(Math.abs(g.twa) <= (sim.beatAngle(g.tws) + 10) * D2R + 0.05, 'back close-hauled');
});

test('on a run a tack and back to a run pays one', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir();
  afterGun(r, 120, 2);
  assert.equal(c.legs[2], 'gate'); assert.ok(!sim.isBeat(c, 2));
  put(r, h, linePt(c, 0.5, -80), h.h, 0); still(h);
  put(r, g, midBeat(c), W - 150 * D2R, 3); // running on starboard
  runUntil(r, () => false, 2);
  g.owed = 1; g.events.length = 0;
  // luff right up through head to wind (a tack) and on, bearing away on the other tack
  const dir = sgn(g.twa);
  let tackedAt = null;
  steer(g, (r, b) => { b.rudder = dir; if (tackedAt === null && sgn(b.twa) !== dir) tackedAt = r.clock; });
  assert.ok(runUntil(r, () => g.owed === 0, 40), 'paid');
  assert.ok(tackedAt !== null, 'she tacked');
  assert.equal(said(r, 'penStart', g).length, 1);
  assert.equal(g.pen, null); assert.ok(g.events.includes('penaltyDone'));
  assert.ok(Math.abs(wrap(g.wdir - g.h)) > 90 * D2R, 'more than 90° off the wind (C5.2)');
});

test('owing a penalty keeps her right of way; turning one gives it away', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir(), up = 45 * D2R;
  afterGun(r);
  // halfway up the beat, yellow on starboard and blue on port, 5 s from meeting
  const X = midBeat(c);
  for (const [b, hd] of [[g, W - up], [h, W + up]]) put(r, b, { x: X.x - Math.sin(hd) * 15, z: X.z + Math.cos(hd) * 15 }, hd);
  r.step(1 / 60);
  g.owed = 1;
  assert.ok(g.twa > 0 && h.twa < 0);
  assert.equal(r.rightOfWay(g, h).giver, h); assert.equal(r.rightOfWay(g, h).rule, '10');
  g.pen = { mr: true };
  assert.deepEqual(r.rightOfWay(g, h), { giver: g, rule: '44' });
  assert.deepEqual(r.rightOfWay(h, g), { giver: g, rule: '44' });
});

test('two owed and no turn for 20 s: the race goes to the other boat', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course;
  afterGun(r);
  put(r, h, midBeat(c, 60), h.h); still(h);
  put(r, g, midBeat(c, -60), g.h); still(g);
  r.step(1 / 60);
  g.owed = 2;
  runUntil(r, () => r.over, 19);
  assert.ok(!r.over, 'not yet at 19 s');
  assert.equal(said(r, 'penNow', g).length, 1);
  runUntil(r, () => r.over, 1.5);
  assert.ok(r.over);
  assert.equal(r.winner, h); assert.equal(r.forfeited, g); assert.equal(r.margin, null);
  assert.equal(said(r, 'penNow', g).length, 1, 'told once');
  assert.equal(said(r, 'penNow', h).length, 0);
});

test('a finish with a penalty owed counts only after the turn', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir();
  afterGun(r, 300, 1);
  g.leg = 4; assert.equal(c.legs[4], 'finish');
  put(r, h, midBeat(c), h.h, 0); still(h);
  put(r, g, linePt(c, 0.5, 30), W - 160 * D2R, 3);
  g.owed = 1;
  // down across the finish: not finished, she owes a turn
  steer(g, (r, b) => toward(r, b, linePt(c, 0.5, -30)));
  assert.ok(runUntil(r, () => lineD(c, g) < -1, 60));
  assert.ok(!g.done); assert.equal(said(r, 'finishOwed', g).length, 1); assert.equal(g.owed, 1);
  // the turn: up through head to wind and back down to a run
  const dir = sgn(g.twa);
  steer(g, (r, b) => { b.rudder = dir; });
  assert.ok(runUntil(r, () => g.owed === 0, 40), 'paid');
  const paidAt = r.clock;
  // back up to the course side, and down across the line again
  steer(g, (r, b) => toward(r, b, linePt(c, 0.5, 25)));
  runUntil(r, () => lineD(c, g) > 10 || g.done, 180);
  steer(g, (r, b) => toward(r, b, linePt(c, 0.5, -30)));
  assert.ok(runUntil(r, () => g.done, 90), 'finished');
  assert.ok(g.finish >= paidAt); assert.ok(!g.dsq);
  assert.equal(said(r, 'finishOwed', g).length, 1);
  assert.equal(r.winner, g); assert.ok(!h.done); assert.equal(r.margin, null);
  assert.equal(said(r, 'finished', g).length, 1);
});

test('the first to finish wins; the margin is the gap', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir();
  afterGun(r, 300, 4);
  put(r, h, linePt(c, 0.7, 20), W + 170 * D2R, 3);
  put(r, g, linePt(c, 0.3, 50), W - 170 * D2R, 3);
  for (const b of [h, g]) steer(b, (r, o) => toward(r, o, linePt(c, lineT(c, o), -30)));
  assert.ok(runUntil(r, () => h.done, 60));
  assert.equal(r.winner, h); assert.ok(!g.done); assert.ok(!r.over, 'not over while the other is racing');
  assert.equal(r.margin, null);
  assert.ok(runUntil(r, () => g.done, 60));
  assert.equal(r.winner, h); assert.ok(r.over);
  assert.ok(r.margin > 0); assert.ok(Math.abs(r.margin - (g.finish - h.finish)) < 1e-9);
  assert.equal(h.place, 1); assert.equal(g.place, 2);
});

test('the race is over a minute after the winner, the other still racing', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir();
  afterGun(r, 300, 4);
  put(r, h, linePt(c, 0.5, 15), W + 170 * D2R, 3);
  steer(h, (r, o) => toward(r, o, linePt(c, 0.5, -30)));
  put(r, g, midBeat(c), g.h, 0); still(g);
  assert.ok(runUntil(r, () => h.done, 60));
  const t = h.finish;
  runUntil(r, () => r.over, 70);
  assert.ok(r.over); assert.ok(r.clock >= t + 60 && r.clock < t + 60.1, `over at ${r.clock - t}`);
  assert.equal(r.winner, h); assert.equal(r.margin, null); assert.ok(!g.done);
});

test('a foul or a touch of a mark in a match: one owed, no turn begun, the other told', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course, W = r.wind.dir(), up = 45 * D2R;
  afterGun(r);
  const X = midBeat(c);
  for (const [b, hd] of [[g, W - up], [h, W + up]]) put(r, b, { x: X.x - Math.sin(hd) * 4, z: X.z + Math.cos(hd) * 4 }, hd);
  runUntil(r, () => h.owed > 0 || g.owed > 0, 5);
  assert.equal(h.owed, 1, 'port owes one'); assert.equal(h.pen, null, 'and is not turning'); assert.equal(g.owed, 0);
  assert.equal(said(r, 'fouled', h).length, 1); assert.equal(said(r, 'theyOwe', g).length, 1);
  // and yellow, her side against the windward mark
  const m = c.windward;
  put(r, h, midBeat(c, 80), h.h, 0); still(h);
  put(r, g, { x: m.x + 1, z: m.z }, W - up, 1); still(g);
  r.step(1 / 60);
  assert.equal(g.owed, 1); assert.equal(g.pen, null);
  assert.equal(said(r, 'touched', g).length, 1); assert.equal(said(r, 'theyOwe', h).length, 1);
});

// a race sailed to the end of the computer boats with you on a fixed script: the helm over (0.3) for 2 s every 20 s,
// a tack every 45 s from the gun (as test/sim.test.mjs has it)
function sailScripted(opts) {
  const r = new sim.Race(opts), P = r.player, others = r.boats.filter((b) => b !== P);
  let tacks = 0;
  for (let n = 0; n < 60 * 60 * 40 && !others.every((b) => b.done); n++) {
    const t = r.clock;
    P.rudder = ((t % 20) + 20) % 20 < 2 ? 0.3 : 0;
    if (t >= 0 && Math.floor(t / 45) > tacks) { tacks = Math.floor(t / 45); P.tackOrGybe(); }
    r.step(1 / 60);
  }
  return r.boats.map((b) => (b.done && !b.dsq ? Math.round(b.finish * 10) / 10 : null));
}
const GOLDEN_4242 = [null, 285, 280.2, 237.2, 270.7];
test('a free race is unchanged by the match code', () => {
  assert.deepEqual(sailScripted({ preset: 'medium', length: 'short', laps: 1, fleet: 5, seed: 4242 }), GOLDEN_4242);
});
