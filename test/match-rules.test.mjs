// A match race in the sim (public/game/sim.js, `match: true`): two human boats, blue and yellow, Appendix C's entry,
// penalties taken when the boat chooses, the two-length zone, recalls one by one, and the first home wins. Run
// headless in Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { D2R, HULL, clamp, lineD, lineT, wrap } = sim;
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
  // each waiting as match boats do: nearly stopped, luffing 30° off the wind, her sheets well out (not backing)
  const W = r.wind.dir();
  for (const b of r.humans) {
    assert.ok(Math.abs(Math.abs(wrap(W - b.h)) - 30 * D2R) < 1e-9, `${b.side} luffing`);
    assert.ok(b.v < 0.5 && b.sheet >= 0.8 && b.sheet <= 0.9 && b.jibSheet === b.sheet, `${b.side} stopped, sheets out`);
  }
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

// (from the start, luffing outside her end: she bears away to a spot just outside her end on the course side, waits
// there head to wind, then runs in across the line after the preparatory signal)
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

// Left alone from the start to −2:00 (no hands on her: the rudder amidships), a match boat must stay afloat at every
// venue and in every wind, in the two classes whose courses differ most: the JPK 1050 (the club's) and the AC75 (the
// biggest course, and the boat that creeps furthest). Each venue and class in a process of its own (they're the page's,
// from its address), eight at a time
test('left alone till 2:00, both boats stay afloat at every venue, in every wind, owing one (late) each', async () => {
  const { VENUES } = await import('../public/game/venues.js');
  const { execFile } = await import('node:child_process');
  const code = (venue, boat) => `
    import { readFile } from 'node:fs/promises';
    globalThis.location = { search: '?venue=${venue}&boat=${boat}' };
    globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
    const sim = await import(${JSON.stringify(new URL('../public/game/sim.js', import.meta.url).href)});
    const { VENUE, lengthOffered } = await import(${JSON.stringify(new URL('../public/game/venues.js', import.meta.url).href)});
    const bad = [];
    for (const length of ['short', 'medium']) if (lengthOffered(VENUE, length)) for (const preset of ['light', 'medium', 'strong']) {
      const r = new sim.Race({ preset, length, seed: 1, match: true, humans: [{ id: 'h', name: 'H' }, { id: 'g', name: 'G' }], me: 'h' });
      let aground = false, room = Infinity, early = 0, late = 0;
      while (r.clock < -119) {
        for (const b of r.humans) b.rudder = 0;
        r.step(1 / 60);
        for (const b of r.humans) room = Math.min(room, r.roomAt(b.x, b.z));
        for (const m of r.messages) { if (m.key === 'aground') aground = true; if (m.key === 'entryEarly') early++; if (m.key === 'entryLate') late++; }
        r.messages.length = 0;
      }
      const owed = r.humans.map((b) => b.owed + (b.entered ? 'E' : '')).join();
      if (aground || room <= 0 || early || late !== 2 || owed !== '1,1') bad.push({ length, preset, aground, room: Math.round(room), early, late, owed });
    }
    console.log(JSON.stringify(bad));`;
  const jobs = VENUES.flatMap((v) => ['jpk1050', 'ac75'].map((boat) => [v.id, boat])), queue = [...jobs], out = [];
  const run = ([venue, boat]) => new Promise((res, rej) => execFile(process.execPath, ['--input-type=module', '-e', code(venue, boat)], { encoding: 'utf8' },
    (e, stdout) => (e ? rej(e) : res(out.push({ venue, boat, bad: JSON.parse(stdout) })))));
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await run(queue.shift()); }));
  assert.equal(out.length, jobs.length);
  for (const o of out) assert.deepEqual(o.bad, [], `${o.venue} ${o.boat}: ${JSON.stringify(o.bad)}`);
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
const GOLDEN_4242 = [null, 282.7, 277, 248.7, 229.9]; // sailed again 2026-11-18: the wind shadow runs six and a half mast heights (sim.js shadowReach)
test('a free race is unchanged by the match code', () => {
  assert.deepEqual(sailScripted({ preset: 'medium', length: 'short', laps: 1, fleet: 5, seed: 4242 }), GOLDEN_4242);
});

// ---------- the umpire: the standard situations, each scripted to happen as the book draws it ----------
// Each boat is placed exactly and sailed on a script: her heading as a function of the seconds since the situation
// began (her helm), her speed held, so a gust or a lull can't change what happens. Then the umpire's call is checked:
// who owes, by which rule, or no call.
const BEAM = sim.CLS.beam;
const gapOf = (p, q) => sim.hullGap(p, q).d - BEAM; // metres between the two hulls
const fwd = (h) => ({ x: Math.sin(h), z: -Math.cos(h) }), stbd = (h) => ({ x: Math.cos(h), z: Math.sin(h) });
const off = (p, v, k) => ({ x: p.x + v.x * k, z: p.z + v.z * k });
// sail boat b from p, heading h, at v m/s held; her helm: helm(s) the heading s seconds from now (none: straight on).
// Her rate of turn goes with it, as a boat turning has one (less the step's easing of it: see Boat.step's YAW_LAG)
function sail(r, b, p, h, v, helm) {
  const t0 = r.clock, dt = 1 / 60; helm ||= () => h;
  put(r, b, p, h, v); b.hist = null; b.boom = 0;
  steer(b, (r, o) => { const s = r.clock - t0; Object.assign(o, { h: wrap(helm(s)), v, rudder: 0, yawRate: (wrap(helm(s + dt) - helm(s)) / dt) * Math.exp(dt / 0.55) }); });
}
// how soon the two hulls touch if both hold their course and speed (Infinity: they don't in `max` s)
function meetIn(p, q, max = 10) {
  const at = (b, t) => ({ x: b.x + Math.sin(b.h) * b.v * t, z: b.z - Math.cos(b.h) * b.v * t, h: b.h });
  for (let t = 0; t <= max; t += 0.02) if (gapOf(at(p, t), at(q, t)) <= 0) return t;
  return Infinity;
}
// run for `secs`, keeping the closest the hulls came
function closest(r, p, q, secs) {
  let min = Infinity;
  runUntil(r, () => { min = Math.min(min, gapOf(p, q)); return false; }, secs);
  return min;
}
// a crossing halfway up the beat: starboard (yellow, g) and port (blue, h) close-hauled, 45° off the wind, at V; the
// starboard boat reaches the crossing point X in `T` s, the port boat `lead` s before her
const V = 3.4;
function crossing({ lead = 0, T = 8, sHelm = null, pHelm = null, clock = 30, leg = 1 } = {}) {
  const r = matchRace(), [P, S] = r.humans, c = r.course;
  afterGun(r, clock, leg);
  const X = midBeat(c), W = r.wind.at(X.x, X.z).dir, hs = W - 45 * D2R, hp = W + 45 * D2R;
  sail(r, S, off(X, fwd(hs), -V * T), hs, V, sHelm && ((s) => sHelm(s, hs, S, P)));
  sail(r, P, off(X, fwd(hp), -V * (T - lead)), hp, V, pHelm && ((s) => pHelm(s, hp, P, S)));
  return { r, P, S, W };
}
// side by side on starboard, 50° off the wind, overlapped: leeward (yellow, g) at X, windward (blue, h) `gap` m off her
// starboard side, both at V
function sideBySide({ gap = 3, lHelm = null, wHelm = null } = {}) {
  const r = matchRace(), [Wb, L] = r.humans, c = r.course;
  afterGun(r, 30);
  const X = midBeat(c), W = r.wind.at(X.x, X.z).dir, h = W - 50 * D2R;
  sail(r, L, X, h, V, lHelm && ((s) => lHelm(s, h)));
  sail(r, Wb, off(X, stbd(h), BEAM + gap), h, V, wHelm && ((s) => wHelm(s, h)));
  return { r, L, Wb, W };
}
const calls = (r) => r.calls.map((k) => `${k.on} ${k.rule}`);

test('port crosses clear ahead of starboard: no call', () => {
  const { r, P, S } = crossing({ lead: 6 });
  const min = closest(r, P, S, 12);
  assert.ok(min > 5 && min < 7, `6 m clear at the crossing (${min.toFixed(2)})`);
  assert.equal(r.calls.length, 0, calls(r).join());
  assert.equal(P.owed, 0); assert.equal(S.owed, 0);
});

test('port aims at starboard, who bears away at the last moment: port penalised', () => {
  let turnAt = null; // starboard bears away hard, 30° a second to 40° lower, when they'd touch in 1 s
  const sHelm = (s, hs, S, P) => { if (turnAt === null && meetIn(S, P) <= 1) turnAt = s; return turnAt === null ? hs : hs - Math.min(40, 30 * (s - turnAt)) * D2R; };
  const { r, P, S } = crossing({ sHelm });
  const min = closest(r, P, S, 10);
  assert.ok(turnAt !== null, 'starboard bore away');
  assert.ok(min > -0.5, `and (nearly) missed her (${min.toFixed(2)})`);
  assert.deepEqual(calls(r), [`${P.id} 10`]);
  assert.equal(P.owed, 1); assert.equal(S.owed, 0);
  // the call, with its reasons, and both boats told
  const k = r.calls[0];
  assert.ok(k.why.gap < 1 && k.why.look >= 0 && k.why.look <= 1.5, JSON.stringify(k));
  assert.equal(typeof k.why.rowTurned, 'boolean'); assert.ok('rowTurnT' in k.why);
  for (const b of [P, S]) assert.deepEqual(said(r, 'umpire', b).map((m) => m.arg), [{ rule: '10', on: P.id }]);
});

test('port ducks starboard close astern: no call', () => {
  // port bears away 60°, 25° a second, when they'd touch in 3 s, and passes astern (the projection along her heading
  // of the moment, not her turn, once called this)
  let duckAt = null;
  const pHelm = (s, hp, P, S) => { if (duckAt === null && meetIn(P, S) <= 3) duckAt = s; return duckAt === null ? hp : hp + Math.min(60, 25 * (s - duckAt)) * D2R; };
  const { r, P, S } = crossing({ pHelm });
  // the closest they came, and where port was then along starboard's course (− astern of her)
  let min = Infinity, along = 0;
  runUntil(r, () => { const d = gapOf(P, S); if (d < min) { min = d; const f = fwd(S.h); along = (P.x - S.x) * f.x + (P.z - S.z) * f.z; } return false; }, 12);
  assert.ok(duckAt !== null, 'port ducked');
  assert.ok(min > 1.5 && min < 2.5, `2 m astern (${min.toFixed(2)})`);
  assert.ok(along < 0, `passed astern (${along.toFixed(1)})`);
  assert.equal(r.calls.length, 0, calls(r).join());
});

test('leeward luffs slowly, windward answers: no call', () => {
  // leeward luffs 3° a second for 5 s; windward answers a moment later, turning with her
  const luff = (s) => clamp(s, 0, 5) * 3 * D2R;
  const { r, L, Wb } = sideBySide({ lHelm: (s, h) => h + luff(s), wHelm: (s, h) => h + luff(s - 0.3) }), h0 = L.h;
  const min = closest(r, L, Wb, 8);
  assert.ok(min > 2.4, `windward kept some 3 m off (${min.toFixed(2)})`);
  for (const b of [L, Wb]) assert.ok(Math.abs(wrap(b.h - h0 - 15 * D2R)) < 0.5 * D2R, 'both luffed 15°');
  assert.equal(r.calls.length, 0, calls(r).join());
});

test('leeward luffs, windward doesn\'t answer: windward penalised', () => {
  const { r, L, Wb } = sideBySide({ lHelm: (s, h) => h + clamp(s, 0, 10) * 3 * D2R });
  assert.equal(r.rightOfWay(L, Wb).rule, '11');
  closest(r, L, Wb, 10);
  assert.deepEqual(calls(r), [`${Wb.id} 11`]);
  assert.equal(Wb.owed, 1); assert.equal(L.owed, 0);
  assert.equal(r.calls[0].why.rowTurned, false);
});

test('leeward luffs hard with no room for windward to keep clear: leeward penalised', () => {
  // 2 m apart, leeward luffs 25° in a second; windward answers, luffing away as hard as she can, a moment later
  const { r, L, Wb } = sideBySide({ gap: 2, lHelm: (s, h) => h + clamp(s, 0, 1) * 25 * D2R, wHelm: (s, h) => h + clamp(s - 0.4, 0, 1.2) * 30 * D2R });
  closest(r, L, Wb, 6);
  assert.deepEqual(calls(r), [`${L.id} 16.1`]);
  assert.equal(L.owed, 1); assert.equal(Wb.owed, 0);
  assert.equal(r.calls[0].why.rowTurned, true); assert.ok(r.calls[0].why.rowTurnT !== null);
});

test('the dial-up: head to wind side by side, no closing: no call', () => {
  const r = matchRace(), [h, g] = r.humans, c = r.course;
  r.clock = -100; for (const b of r.humans) b.entered = true; // in the box after both entered
  const X = linePt(c, 0.5, -60), W = r.wind.at(X.x, X.z).dir;
  // 4 m between their centrelines: the hulls half a metre apart, closer than the umpire's 1 m, but neither closing
  put(r, g, X, W, 0); still(g);
  put(r, h, off(X, stbd(W), 4), W, 0); still(h);
  for (const b of [g, h]) b.hist = null;
  const min = closest(r, h, g, 10);
  assert.ok(min > 0 && min < 1, `${min.toFixed(2)}`);
  assert.equal(r.calls.length, 0, calls(r).join());
});

test('the zone is two lengths: the inside boat gets room, the outside one that shuts her out is penalised', () => {
  const r = matchRace(), [A, B] = r.humans, c = r.course;
  afterGun(r, 200, 2); assert.equal(c.legs[2], 'gate');
  const M = sim.legAim(c, 2), W = r.wind.at(M.x, M.z).dir, h = W - 160 * D2R; // running on starboard at the gate
  // A inside and to windward, heading for the gate, 3 lengths out; B outside and to leeward, 3 m off her port side
  const A0 = off(M, fwd(h), -3 * HULL);
  let luffAt = null; // B, once in the zone, luffs 4° a second into A, shutting her out from the mark
  sail(r, A, A0, h, 3);
  sail(r, B, off(A0, stbd(h), -(BEAM + 3)), h, 3, (s) => { if (luffAt === null && r.zoneOf(A, B)) luffAt = s; return h + (luffAt === null ? 0 : (s - luffAt) * 4 * D2R); });
  // outside the leeward boat has right of way (rule 11), and at two and a half lengths they aren't in the zone yet
  r.step(1 / 60); assert.equal(r.rightOfWay(A, B).giver, A); assert.equal(r.rightOfWay(A, B).rule, '11');
  runUntil(r, () => Math.hypot(A.x - M.x, A.z - M.z) < 2.5 * HULL, 10);
  assert.equal(r.zoneOf(A, B), null, 'not yet: the zone is two lengths');
  runUntil(r, () => r.zoneOf(A, B), 10);
  assert.ok(Math.hypot(A.x - M.x, A.z - M.z) < 2 * HULL + 0.2);
  assert.equal(r.zoneOf(A, B).entitled, A, 'the inside boat gets mark-room');
  runUntil(r, () => r.calls.length > 0 || A.leg > 2, 10);
  assert.deepEqual(calls(r), [`${B.id} 18`]);
  assert.equal(B.owed, 1); assert.equal(A.owed, 0);
});

test('one incident, one call', () => {
  // port aims at starboard and neither alters: the umpire calls it before they touch, and the contact adds nothing
  const { r, P, S } = crossing();
  let callAt = null, bumpAt = null;
  runUntil(r, () => {
    if (callAt === null && r.calls.length) callAt = r.clock;
    if (bumpAt === null && said(r, 'bump').length) bumpAt = r.clock;
    return false;
  }, 10);
  assert.ok(callAt !== null && bumpAt !== null && callAt < bumpAt && bumpAt - callAt < 6, `called ${callAt}, touched ${bumpAt}`);
  assert.deepEqual(calls(r), [`${P.id} 10`]);
  assert.equal(P.owed, 1); assert.equal(S.owed, 0);
  assert.equal(said(r, 'umpire', P).length, 1);
});

test('every duck that passes a metre and a half or more astern: no call; one that hits: port\'s', () => {
  // bearing away at 15 to 30° a second, 3 to 4 s before they'd touch, to 50–70° lower
  let clear = 0, hit = 0;
  for (const rate of [15, 20, 25, 30]) for (const at of [3, 3.5, 4]) for (const ang of [50, 60, 70]) {
    let duckAt = null;
    const pHelm = (s, hp, P, S) => { if (duckAt === null && meetIn(P, S) <= at) duckAt = s; return duckAt === null ? hp : hp + Math.min(ang, rate * (s - duckAt)) * D2R; };
    const { r, P, S } = crossing({ pHelm }), key = `${rate}°/s ${at} s out to ${ang}°`;
    const min = closest(r, P, S, 14);
    if (min >= 1.5) { clear++; assert.equal(r.calls.length, 0, `${key}: ${min.toFixed(2)} m astern, ${calls(r)}`); }
    if (min <= 0) { hit++; assert.deepEqual(calls(r), [`${P.id} 10`], key); }
  }
  assert.ok(clear >= 20 && hit >= 1, `${clear} clear, ${hit} hit`);
});

test('starboard hunts port crossing ahead: with no time to answer it\'s starboard\'s, with time port\'s', () => {
  // port crosses 2.6 m ahead; starboard luffs 30° at her, 30° a second, when they're `d` m apart; port holds on
  for (const [d, rule] of [[14, '16.1'], [20, '10']]) {
    let at = null;
    const sHelm = (s, hs, S, P) => { if (at === null && Math.hypot(S.x - P.x, S.z - P.z) < d) at = s; return at === null ? hs : hs + Math.min(30, 30 * (s - at)) * D2R; };
    const { r, P, S } = crossing({ lead: 4.6, sHelm });
    closest(r, P, S, 14);
    assert.ok(at !== null, 'she luffed');
    assert.deepEqual(calls(r), [`${rule === '16.1' ? S.id : P.id} ${rule}`], `from ${d} m`);
    assert.equal(r.calls[0].why.rowTurned, true);
  }
});

test('the umpire is a match\'s only: a free race makes no calls', () => {
  const r = new sim.Race({ seed: 11, fleet: 2, humans: HUMANS }), [P, S] = r.humans;
  r.clock = 30;
  const X = midBeat(r.course), W = r.wind.at(X.x, X.z).dir;
  sail(r, S, off(X, fwd(W - 45 * D2R), -V * 8), W - 45 * D2R, V);
  sail(r, P, off(X, fwd(W + 45 * D2R), -V * 8), W + 45 * D2R, V);
  const min = closest(r, P, S, 5.8); // up to just before they'd touch: a match's umpire has called it by now
  assert.ok(min > 0 && min < 3, `${min.toFixed(2)}`);
  assert.deepEqual(r.calls, []); assert.equal(said(r, 'umpire').length, 0);
});

test('the umpire starts with the rules, at the preparatory signal: a near-miss before it makes no call, after it one', () => {
  // port crosses starboard's bow half a metre clear, and they don't touch: the same near-miss on each side of the signal
  const prep = matchRace().seq[1].t;
  for (const [clock, n] of [[prep - 20, 0], [prep + 2, 1]]) {
    const { r, P, S } = crossing({ lead: 3.75, clock, leg: 0 });
    const min = closest(r, P, S, 12);
    assert.ok(min > 0.3 && min < 0.8, `a near-miss (${min.toFixed(2)})`);
    assert.equal(said(r, 'bump').length, 0, 'no contact');
    assert.ok(n ? r.calls[0].t > prep : r.clock < prep, 'all on its side of the signal');
    assert.deepEqual(calls(r), n ? [`${P.id} 10`] : [], `placed at ${clock}`);
  }
});
