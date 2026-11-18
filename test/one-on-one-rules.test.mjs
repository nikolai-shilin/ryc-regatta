// A race with two human boats and no computer boats, not a match (public/game/sim.js, `multi`): today's rules and
// today's start, the first valid finish wins, the other has three minutes more, and a finished boat is out of the
// other's way. Run headless in Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const { D2R, lineD, lineT } = sim;

const HUMANS = [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }];
// the seed picks the day's flag: ['P','P','P','U','B'][seed % 5]
const SEED = { P: 11, U: 13, B: 14 };
const duel = (o = {}) => new sim.Race({ preset: 'medium', length: 'short', seed: 11, fleet: 2, start: 1, humans: HUMANS, me: 'h', ...o });
const steer = (b, fn) => { b.script = fn; };
function runUntil(r, cond, secs = 600) {
  for (let n = 0; n < secs * 60 && !cond(); n++) { for (const b of r.humans) b.script?.(r, b); r.step(1 / 60); }
  return cond();
}
const toward = (r, b, p) => r.steerTo(b, r.sailable(Math.atan2(p.x - b.x, -(p.z - b.z)), b.wdir, b.tws));
const still = (b) => { const at = { x: b.x, z: b.z, h: b.h }; steer(b, (r, o) => Object.assign(o, at, { v: 0, rudder: 0, yawRate: 0 })); };
const linePt = (c, t, d) => ({ x: c.pin.x + c.dir.x * c.len * t + c.normal.x * d, z: c.pin.z + c.dir.z * c.len * t + c.normal.z * d });
const said = (r, key, b) => r.messages.filter((m) => m.key === key && (b === undefined || m.to === b));
const put = (r, b, p, h, v = 3) => Object.assign(b, { x: p.x, z: p.z, h, v, lastD: lineD(r.course, b), lastZ: p.z, auto: null, rudder: 0, yawRate: 0 });
const midBeat = (c, off = 0) => ({ x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2 + off, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 });
// after the gun, both on the leg (the finish's by default), the clock at t
function afterGun(r, t = 300, leg = r.course.legs.length - 1) { r.clock = t; for (const b of r.humans) b.leg = leg; }
// a boat just on the course side of the line, on the finish leg, sailing down across it
function toFinish(r, b, t = 0.5) {
  const c = r.course, W = r.wind.dir();
  assert.equal(c.legs[b.leg], 'finish');
  put(r, b, linePt(c, t, 12), W + 170 * D2R, 3);
  steer(b, (r, o) => toward(r, o, linePt(c, lineT(c, o), -30)));
}
// a race at the finish: h's boat just above the line, g's waiting out in the beat
function atFinish(o = {}) {
  const r = duel(o), [h, g] = r.humans;
  afterGun(r);
  put(r, g, midBeat(r.course), g.h, 0); still(g);
  return { r, h, g };
}

test('two humans and no computer boats, on today\'s rules', () => {
  const r = duel();
  assert.equal(r.multi, true); assert.equal(r.boats.length, 2); assert.ok(r.boats.every((b) => b.human));
  assert.equal(r.zone, sim.ZONE); assert.equal(r.match, false); assert.equal(r.validAt, null);
  assert.equal(new sim.Race({ seed: 11 }).multi, false);
  assert.equal(new sim.Race({ seed: 11, humans: [{ id: 'a', name: 'A' }] }).multi, false);
  assert.equal(new sim.Race({ seed: 11, humans: HUMANS, match: true }).multi, false, 'a match is not a duel');
  assert.ok(r.boats.every((b) => b.dnf === false));
  assert.equal(sim.FINISH_LIMIT_S, 180);
});

test('a contact foul starts a turn at once: one tack and one gybe', () => {
  const r = duel(), [h, g] = r.humans, c = r.course, X = midBeat(c), W = r.wind.at(X.x, X.z).dir, V = 3.4, T = 2;
  r.clock = 30; for (const b of r.humans) b.leg = 1;
  // g close-hauled on starboard, h on port, each two seconds from the point where they'd meet
  const at = (hd) => ({ x: X.x - Math.sin(hd) * V * T, z: X.z + Math.cos(hd) * V * T });
  put(r, g, at(W - 45 * D2R), W - 45 * D2R, V); put(r, h, at(W + 45 * D2R), W + 45 * D2R, V);
  assert.ok(runUntil(r, () => h.pen || g.pen, 6), 'someone fouled');
  assert.deepEqual(h.pen, { tack: false, gybe: false, dir: 0 }, 'port keeps clear'); assert.equal(g.pen, null);
  assert.equal(h.owed ?? 0, 0, 'no penalty to take later');
  assert.equal(said(r, 'fouled', h).length, 1); assert.equal(said(r, 'theyFouled', g).length, 1);
  assert.equal(said(r, 'umpire').length, 0, 'no umpire'); assert.equal(r.calls.length, 0);
});

test('home with a penalty unserved is disqualified, and starts no limit', () => {
  const { r, h, g } = atFinish(); toFinish(r, h);
  h.pen = { tack: false, gybe: false, dir: 0 };
  assert.ok(runUntil(r, () => h.done, 60));
  assert.equal(h.dsq, true); assert.equal(h.place, null);
  assert.equal(r.validAt, null); assert.equal(r.winner, null); assert.equal(r.over, false); assert.ok(!g.done);
});

test('a boat out under the black flag starts no limit when she crosses first', () => {
  const r = duel({ seed: SEED.B }), [h, g] = r.humans, c = r.course;
  assert.equal(r.prepFlag, 'B');
  // in the triangle of the line and the first mark in the last minute
  r.clock = -30; put(r, h, linePt(c, 0.5, 20), h.h, 0); still(h); put(r, g, linePt(c, 0.5, -60), g.h, 0); still(g); // (g below the line, outside it)
  r.step(1 / 60);
  assert.equal(h.bfd, true); assert.ok(!g.bfd);
  afterGun(r); toFinish(r, h);
  assert.ok(runUntil(r, () => h.done, 60));
  assert.equal(h.dsq, true); assert.equal(r.validAt, null); assert.equal(r.winner, null); assert.equal(r.over, false);
  // and the other is the one the race is for
  toFinish(r, g, 0.3);
  assert.ok(runUntil(r, () => g.done, 60));
  assert.equal(r.winner, g); assert.equal(r.validAt, g.finish); assert.equal(r.over, true); assert.equal(r.margin, null);
});

test('the race is over when both are home; the winner, her margin and the places', () => {
  const r = duel(), [h, g] = r.humans;
  afterGun(r); toFinish(r, h, 0.7); toFinish(r, g, 0.3);
  put(r, g, linePt(r.course, 0.3, 40), g.h, 3); // (g further back: h is across first)
  assert.ok(runUntil(r, () => h.done, 60));
  assert.equal(r.winner, h); assert.equal(r.validAt, h.finish); assert.equal(r.over, false, 'not while the other is racing');
  assert.equal(r.margin, null);
  assert.ok(runUntil(r, () => g.done, 60));
  assert.equal(r.winner, h); assert.equal(r.margin, g.finish - h.finish); assert.ok(r.margin > 0);
  assert.equal(h.place, 1); assert.equal(g.place, 2); assert.equal(r.over, true);
});

test('3 minutes after the first valid finish the other boat is DNF', () => {
  const { r, h, g } = atFinish(); toFinish(r, h);
  assert.ok(runUntil(r, () => h.done, 60));
  const t = h.finish;
  steer(h, null); still(g);
  r.clock = t + sim.FINISH_LIMIT_S - 0.05; r.step(1 / 60);
  assert.equal(r.over, false, 'not yet'); assert.equal(g.dnf, false);
  assert.ok(runUntil(r, () => r.over, 1));
  assert.equal(g.dnf, true); assert.equal(g.done, false); assert.equal(r.over, true); assert.equal(r.winner, h); assert.equal(r.margin, null);
  assert.equal(h.dnf, false);
});

test('crossing first does not end the race for the boat still sailing', () => {
  const { r, h, g } = atFinish(); toFinish(r, h);
  assert.ok(runUntil(r, () => h.done, 60));
  assert.equal(r.over, false); assert.equal(r.winner, h);
  runUntil(r, () => false, 30);
  assert.equal(r.over, false); assert.ok(!g.done && !g.dnf);
});

test('a finished boat can\'t touch the other or take her wind', () => {
  const run = (finished) => {
    const r = duel(), [h, g] = r.humans, c = r.course, W = r.wind.dir(), X = midBeat(c);
    const hd = W - 50 * D2R;
    afterGun(r, 100, 1); put(r, h, X, hd, 3); still(h); h.done = finished; h.finish = finished ? 90 : null;
    // g alongside her, overlapped, her hulls touching
    put(r, g, { x: X.x + Math.cos(hd) * 0.5, z: X.z + Math.sin(hd) * 0.5 }, hd, 3);
    const vBefore = g.v; r.collide(1 / 60);
    // then directly downwind of her, 15 m
    put(r, g, { x: X.x - Math.sin(W) * 15, z: X.z + Math.cos(W) * 15 }, hd, 3);
    return { r, g, vBefore, shadow: r.windAt(g).shadow };
  };
  const out = run(true);
  assert.equal(out.g.v, out.vBefore); assert.equal(said(out.r, 'bump', out.g).length, 0); assert.equal(out.shadow, 0);
  // (the same, with her still racing: touched, and shadowed)
  const on = run(false);
  assert.equal(said(on.r, 'bump', on.g).length, 1); assert.ok(on.shadow > 0);
});

test('a finished boat can\'t forfeit', () => {
  const { r, h } = atFinish(); toFinish(r, h);
  assert.ok(runUntil(r, () => h.done, 60));
  r.forfeit(h);
  assert.equal(r.over, false); assert.equal(r.forfeited, null); assert.equal(r.winner, h);
});

test('a forfeit gives the race to the other boat, unless she is out', () => {
  const { r, h, g } = atFinish(); toFinish(r, h);
  assert.ok(runUntil(r, () => h.done, 60));
  r.forfeit(g);
  assert.equal(r.winner, h, 'the first home keeps it'); assert.equal(r.forfeited, g); assert.equal(r.over, true); assert.equal(r.margin, null);
  // nobody home: the other boat wins
  const r1 = duel(); r1.forfeit(r1.humans[1]);
  assert.equal(r1.winner, r1.humans[0]); assert.equal(r1.forfeited, r1.humans[1]); assert.equal(r1.over, true);
  // she is out: nobody wins
  for (const k of ['ufd', 'bfd', 'dsq']) {
    const r2 = duel(); r2.humans[0][k] = true; r2.forfeit(r2.humans[1]);
    assert.equal(r2.winner, null, k); assert.equal(r2.over, true, k); assert.equal(r2.forfeited, r2.humans[1], k);
  }
});

test('the other boat hails a boat that must keep clear', () => {
  const r = duel(), [h, g] = r.humans, c = r.course, X = midBeat(c), W = r.wind.at(X.x, X.z).dir, V = 3.4, T = 5;
  r.clock = 30; for (const b of r.humans) b.leg = 1;
  const at = (hd) => ({ x: X.x - Math.sin(hd) * V * T, z: X.z + Math.cos(hd) * V * T });
  put(r, g, at(W - 45 * D2R), W - 45 * D2R, V); put(r, h, at(W + 45 * D2R), W + 45 * D2R, V); // h on port
  r.step(1 / 60);
  assert.equal(said(r, 'hail', h).length, 1, 'port is hailed'); assert.equal(said(r, 'hail', g).length, 0);
  assert.equal(said(r, 'hail', h)[0].arg.who, 'Guest');
  r.step(1 / 60); r.step(1 / 60);
  assert.equal(said(r, 'hail', h).length, 1, 'once in seven seconds');
  assert.ok(runUntil(r, () => said(r, 'hail', h).length > 1, 8), 'and again after');
  // a match's boats don't (the umpire speaks there)
  const m = new sim.Race({ preset: 'medium', length: 'short', seed: 11, humans: HUMANS, me: 'h', match: true });
  m.clock = 30; for (const b of m.humans) b.leg = 1;
  put(m, m.humans[1], at(W - 45 * D2R), W - 45 * D2R, V); put(m, m.humans[0], at(W + 45 * D2R), W + 45 * D2R, V);
  m.step(1 / 60); assert.equal(said(m, 'hail').length, 0);
});

test('both over at the gun is a general recall', () => {
  const r = duel(), [h, g] = r.humans, c = r.course;
  assert.equal(r.prepFlag, 'P'); assert.equal(r.recalls, 0);
  r.clock = -0.01; // the gun, next step
  put(r, h, linePt(c, 0.3, 3), h.h, 0); put(r, g, linePt(c, 0.7, 3), g.h, 0); still(h); still(g);
  runUntil(r, () => r.clock >= 0 || r.recalls > 0, 1);
  assert.equal(r.recalls, 1); assert.equal(r.prepFlag, 'U');
});
