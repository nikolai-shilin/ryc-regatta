// A race between two people on today's rules, on two screens: the host's game runs a plain Race (Host), the guest's
// follows it (Guest), over the in-memory hub and a fake clock. Each test names the screen it checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryRealtime } from './hub.mjs';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const { makeLink, Host, Guest } = await import('../public/game/match.js');
const { controlsOf, thinTrack, resultsOf } = await import('../public/game/wire.js');
const { Race, D2R, wrap, lineD, FINISH_LIMIT_S } = await import('../public/game/sim.js');

const SETTINGS = { venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short' };
const FRAME = 1 / 60;
const SEED = { P: 1, U: 3, B: 4 }; // the preparatory flag each of these seeds draws
const plain = (v) => JSON.parse(JSON.stringify(v));

// one race on two screens: the host's (h) and the guest's (g), each with her own link, over one hub (latency: ms each way)
async function duel({ seed = SEED.P, latency = 0 } = {}) {
  const clock = { t: 50000 }, now = () => clock.t, code = 'ONE122';
  const rt = memoryRealtime({ latency, now });
  const raceOf = (me) => new Race({ ...SETTINGS, seed, fleet: 2, start: 1, humans: [{ id: 'h', name: 'Host' }, { id: 'g', name: 'Guest' }], me });
  const hl = makeLink(rt, code), gl = makeLink(rt, code);
  await hl.all.join(); await gl.all.join();
  const hrace = raceOf('h'), grace = raceOf('g');
  const host = new Host({ race: hrace, link: hl, guestId: 'g', now });
  const guest = new Guest({ race: grace, link: gl, me: 'g', now });
  assert.equal(await host.joined, true); assert.equal(await guest.joined, true);
  const d = {
    rt, clock, now, code, seed, hrace, grace, host, guest,
    H: hrace.player, Gh: hrace.humans.find((b) => b.id === 'g'), // the host's boat and the guest's, on the host's screen
    me: guest.me, Hg: grace.humans.find((b) => b.id === 'h'), // the guest's boat and the host's, on the guest's screen
    heard: [], // what the guest's game is told
    // one frame on both screens: fn (the sailors' hands), the host's step, the guest's controls and her frame
    frame(fn) {
      clock.t += 1000 * FRAME;
      rt.pump?.();
      fn?.();
      d.host.tick(FRAME);
      hrace.messages.length = 0;
      d.guest.input(controlsOf(d.me));
      d.guest.frame(FRAME);
      d.heard.push(...d.grace.messages); d.grace.messages.length = 0;
    },
    run(secs, fn) { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) d.frame(fn); },
    // the guest's tab is gone: the host's game goes on alone
    quiet(secs) { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) { clock.t += 1000 * FRAME; rt.pump?.(); d.host.tick(FRAME); hrace.messages.length = 0; } },
    // her page is opened again: a new race built, following the host's from its next snapshot
    async reload() {
      d.guest.stop();
      const link = makeLink(rt, code);
      await link.all.join();
      const race = raceOf('g'), g = new Guest({ race, link, me: 'g', now });
      assert.equal(await g.joined, true);
      Object.assign(d, { guest: g, grace: race, me: g.me, Hg: race.humans.find((b) => b.id === 'h') });
      return g;
    },
  };
  return d;
}

const midBeat = (c) => ({ x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 });
const midLine = (c) => ({ x: (c.pin.x + c.committee.x) / 2, z: (c.pin.z + c.committee.z) / 2 });
const settle = (r, b) => { b.lastD = lineD(r.course, b); b.lastZ = b.z; };

// a minute after the gun, both boats on the first beat, side by side and well apart
function underWay(d) {
  const r = d.hrace, c = r.course, X = midBeat(c), h = r.wind.at(X.x, X.z).dir + 45 * D2R;
  r.clock = 60;
  for (const [b, off] of [[d.H, 70], [d.Gh, -70]]) {
    Object.assign(b, { x: X.x + c.dir.x * off, z: X.z + c.dir.z * off, h, v: 3, leg: 1, auto: null, rudder: 0, yawRate: 0 });
    settle(r, b);
  }
  d.run(0.5);
}
// boat b on the last leg, three metres short of the finish and sailing across it
function toFinish(d, b) {
  const r = d.hrace, c = r.course, m = midLine(c);
  Object.assign(b, { x: m.x + c.normal.x * 3, z: m.z + c.normal.z * 3, h: Math.atan2(-c.normal.x, c.normal.z), v: 4, leg: c.legs.length - 1, auto: null, rudder: 0, yawRate: 0 });
  settle(r, b);
}
// the guest, on port, sails into the host on starboard: contact, and the penalty turn is hers
function fouled(d) {
  underWay(d);
  const r = d.hrace, X = midBeat(r.course), W = r.wind.at(X.x, X.z).dir, V = 3.4, secs = 2;
  for (const [b, h] of [[d.Gh, W + 45 * D2R], [d.H, W - 45 * D2R]]) {
    Object.assign(b, { x: X.x - Math.sin(h) * V * secs, z: X.z + Math.cos(h) * V * secs, h, v: V, auto: null, rudder: 0, yawRate: 0 });
    settle(r, b);
  }
  for (let i = 0; i < 600 && !d.Gh.pen; i++) d.frame(() => { d.me.rudder = 0; d.H.rudder = 0; });
  assert.ok(d.Gh.pen, 'the contact is the guest\'s foul');
  assert.deepEqual(d.Gh.pen, { tack: false, gybe: false, dir: 0 });
  d.run(0.2, () => { d.me.rudder = 0; d.H.rudder = 0; }); // (a snapshot on)
}
// her helm hard over until the host's copy of her has done `until` (true: the turn's half done)
function turn(d, until) {
  for (let i = 0; i < 60 * 90 && !until(); i++) d.frame(() => { d.me.rudder = 1; d.H.rudder = 0; });
  assert.ok(until(), 'the turn got that far');
}
// both boats over the line as the gun goes: a general recall, as the guest's screen hears of it
function recall(d) {
  const r = d.hrace, c = r.course, m = midLine(c);
  r.clock = -1.5;
  for (const [b, off] of [[d.H, 25], [d.Gh, -25]]) {
    Object.assign(b, { x: m.x + c.dir.x * off + c.normal.x * 15, z: m.z + c.dir.z * off + c.normal.z * 15, v: 1, auto: null, rudder: 0, yawRate: 0 });
    settle(r, b);
  }
  for (let i = 0; i < 600 && d.grace.recalls === 0; i++) d.frame();
  assert.equal(r.recalls, 1, 'the host\'s race was recalled');
}

test('a foul: the turn\'s progress shows on the guest\'s screen, and the host alone pays it', async () => {
  const d = await duel();
  fouled(d);
  assert.deepEqual(d.me.pen, { tack: false, gybe: false, dir: 0 }, 'her screen shows the turn owed');
  turn(d, () => d.Gh.pen && (d.Gh.pen.tack || d.Gh.pen.gybe));
  d.run(0.2, () => { d.me.rudder = 1; });
  assert.ok(d.Gh.pen, 'half the turn done');
  assert.notEqual(d.Gh.pen.dir, 0);
  assert.deepEqual(d.me.pen, d.Gh.pen, 'her screen shows how far the host has her');

  // the host's game stalls for a moment, and her own screen sails her through the other half of the turn
  const word = { ...d.Gh.pen }, { dir } = word, at = wrap(d.me.wdir + (word.tack ? Math.PI : 0)); // the stern through the wind, or the bow
  Object.assign(d.me, { h: wrap(at - dir * 2 * D2R), yawRate: dir * 0.6 });
  for (let i = 0; i < 40; i++) { d.clock.t += 1000 * FRAME; d.me.rudder = dir; d.guest.frame(FRAME); }
  assert.ok(wrap(d.me.h - at) * dir > 0, 'her own boat went through it');
  assert.deepEqual(d.me.pen, word, 'her own step doesn\'t change the host\'s word');
  assert.deepEqual(d.Gh.pen, word);
  assert.equal(d.me.events.filter((e) => e === 'penaltyDone').length, 0, 'nor pays the turn');
});

test('the turn paid on the host\'s copy is told to the guest once', async () => {
  const d = await duel();
  fouled(d);
  turn(d, () => !d.Gh.pen);
  d.run(1, () => { d.me.rudder = 0; });
  assert.equal(d.me.pen, null);
  assert.equal(d.me.events.filter((e) => e === 'penaltyDone').length, 1);
});

test('a turn left unpaid at the finish is a disqualification on the guest\'s screen, and never told as paid', async () => {
  const d = await duel();
  fouled(d);
  toFinish(d, d.Gh);
  d.run(2, () => { d.me.rudder = 0; });
  assert.equal(d.Gh.dsq, true);
  assert.equal(d.me.dsq, true);
  assert.equal(d.me.pen, null);
  assert.equal(d.me.events.filter((e) => e === 'penaltyDone').length, 0);
});

for (const [flag, out, not] of [['U', 'ufd', 'bfd'], ['B', 'bfd', 'ufd']]) {
  test(`the ${flag === 'U' ? 'U' : 'black'} flag reaches the guest: the flag, and the disqualification of either boat`, async () => {
    const d = await duel({ seed: SEED[flag] });
    const r = d.hrace, c = r.course, X = { x: (c.pin.x + c.committee.x + c.windward.x) / 3, z: (c.pin.z + c.committee.z + c.windward.z) / 3 };
    r.clock = -30;
    d.grace.prepFlag = 'P'; // (a guest who took it from nowhere but the snapshot)
    d.run(0.5);
    assert.equal(d.grace.prepFlag, flag, 'her screen flies the host\'s flag');
    assert.equal(d.me[out], false);
    Object.assign(d.Gh, { x: X.x, z: X.z, v: 1 });
    d.run(0.5);
    assert.equal(d.Gh[out], true, 'the host\'s race has her out');
    assert.equal(d.me[out], true, 'and so does her screen');
    assert.equal(d.me[not], false);
    assert.equal(d.Hg[out], false, 'the host\'s boat is still racing');
    Object.assign(d.H, { x: X.x + 40 * c.dir.x, z: X.z + 40 * c.dir.z, v: 1 });
    d.run(0.5);
    assert.equal(d.Hg[out], true, 'the host\'s boat, out, on the guest\'s screen');
  });
}

test('a general recall: the guest takes the host\'s clock, backwards, and her tracks start again', async () => {
  const d = await duel();
  d.run(3);
  assert.ok(d.me.track.length >= 2 && d.Hg.track.length >= 2, 'tracks before the recall');
  recall(d);
  assert.equal(d.grace.recalls, 1);
  assert.ok(d.grace.clock < -60, `her clock went back (${d.grace.clock.toFixed(1)})`);
  assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.5, 'to the host\'s');
  assert.equal(d.grace.prepFlag, 'U');
  assert.equal(d.me.track.length, 0);
  assert.ok(d.Hg.track.length <= 1);
  for (const b of d.grace.boats) assert.deepEqual(b.legT, []);
  const c0 = d.grace.clock;
  d.run(5);
  assert.ok(Math.abs(d.grace.clock - c0 - 5) < 0.3, `her clock runs on from there (${(d.grace.clock - c0).toFixed(2)} s in 5 s)`);
  assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.25);
  assert.ok(d.me.track.length >= 3 && d.me.track.length <= 6, `her track: ${d.me.track.length} points in 5 s`);
  assert.ok(d.Hg.track.length >= 4 && d.Hg.track.length <= 7, `the host's boat: ${d.Hg.track.length} points in 5 s`);
});

test('a general recall under 150 ms each way leaves the two clocks together', async () => {
  const d = await duel({ latency: 150 });
  d.run(2);
  recall(d);
  let worst = 0;
  d.run(6, () => { worst = Math.max(worst, Math.abs(d.grace.clock - d.hrace.clock)); });
  assert.ok(worst < 0.5, `at worst ${worst.toFixed(3)} s apart`);
  assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.5);
  assert.equal(d.guest.hostSilent, false);
});

test('a guest reloaded after a recall reads the flag, clock and count from the first snapshot', async () => {
  const d = await duel();
  d.run(1);
  recall(d);
  d.quiet(2);
  const fresh = await d.reload();
  assert.equal(fresh.race.recalls, 0);
  d.run(0.3);
  assert.equal(fresh.race.recalls, 1);
  assert.equal(fresh.race.prepFlag, 'U');
  assert.ok(Math.abs(fresh.race.clock - d.hrace.clock) < 0.5, `${fresh.race.clock.toFixed(2)} against ${d.hrace.clock.toFixed(2)}`);
});

test('a guest reloaded after a recall has the host\'s wind and waves: the race\'s time caught up', async () => {
  const d = await duel();
  d.run(40); // (time sailed that the clock, set back by the recall, doesn't show)
  recall(d);
  d.quiet(2);
  const fresh = await d.reload();
  d.run(0.3);
  assert.equal(fresh.race.recalls, 1);
  assert.ok(d.hrace.t > 40, `the host's race has run ${d.hrace.t.toFixed(1)} s`);
  assert.ok(Math.abs(fresh.race.t - d.hrace.t) < 0.5, `her race's time ${fresh.race.t.toFixed(2)} s, the host's ${d.hrace.t.toFixed(2)} s`);
  const off = Math.abs(wrap(fresh.race.wind.dir() - d.hrace.wind.dir()));
  assert.ok(off < 0.5 * D2R, `her wind is ${(off / D2R).toFixed(3)}° off the host's`);
  assert.ok(Math.abs(fresh.race.clock - d.hrace.clock) < 0.5, 'and the clock is still the host\'s');
});

test('a guest finished, then silent: no forfeit; the race runs out to its end', async () => {
  const d = await duel();
  underWay(d);
  toFinish(d, d.Gh);
  d.run(2, () => { d.me.rudder = 0.2; });
  assert.equal(d.Gh.done, true);
  assert.equal(d.hrace.winner, d.Gh);
  d.quiet(35);
  assert.equal(d.hrace.forfeited, null, 'on the host\'s screen, no forfeit');
  assert.equal(d.hrace.over, false, 'and the race goes on');
  assert.equal(d.Gh.rudder, 0.2, 'nobody holds the course of a boat that is home');
  d.hrace.clock = d.hrace.validAt + FINISH_LIMIT_S - 0.5;
  d.quiet(1);
  assert.equal(d.hrace.over, true, 'it ends at the limit');
  assert.equal(d.hrace.forfeited, null);
  assert.equal(d.hrace.winner, d.Gh);
  assert.equal(d.H.dnf, true);
});

test('a guest silent 30 s before her finish forfeits', async () => {
  const d = await duel();
  underWay(d);
  d.quiet(29);
  assert.equal(d.hrace.over, false, 'under 30 s: still racing');
  d.quiet(1.5);
  assert.equal(d.hrace.over, true);
  assert.equal(d.hrace.forfeited, d.Gh);
  assert.equal(d.hrace.winner, d.H);
  assert.equal(d.grace.over, true, 'her screen is told');
  assert.equal(d.grace.winner, d.Hg);
});

test('a boat that gives up is DNF on both screens, and the results say who won', async () => {
  const d = await duel();
  underWay(d);
  d.host.guestLeft();
  d.run(0.5);
  assert.equal(d.Gh.dnf, true, 'on the host\'s screen'); assert.equal(d.me.dnf, true, 'and on her own');
  assert.equal(d.H.dnf, false); assert.equal(d.Hg.dnf, false);
  d.run(1.5);
  assert.equal(d.guest.results.winner, 'h');
  assert.equal(d.guest.results.boats.find((b) => b.id === 'g').dnf, true);
});

test('guestLeft before her finish forfeits at once; after it the race runs on', async () => {
  const d = await duel();
  underWay(d);
  d.host.guestLeft();
  assert.equal(d.hrace.over, true, 'before her finish: at once');
  assert.equal(d.hrace.forfeited, d.Gh);
  assert.equal(d.hrace.winner, d.H);

  const e = await duel();
  underWay(e);
  toFinish(e, e.Gh);
  e.run(2, () => { e.me.rudder = 0; });
  assert.equal(e.Gh.done, true);
  e.host.guestLeft();
  assert.equal(e.hrace.over, false, 'after her finish: the race runs on');
  assert.equal(e.hrace.forfeited, null);
  assert.equal(e.Gh.place, 1, 'and her place stands');
  toFinish(e, e.H);
  e.quiet(2);
  assert.equal(e.hrace.over, true, 'to the host\'s own finish');
  assert.equal(e.hrace.winner, e.Gh);
  assert.ok(e.hrace.margin > 0);
});

test('DNF reaches the guest with the race\'s end, and a race over can\'t be given up afterwards', async () => {
  const d = await duel();
  underWay(d);
  toFinish(d, d.H);
  d.run(2, () => { d.me.rudder = 0; });
  assert.equal(d.H.done, true);
  assert.equal(d.me.dnf, false);
  d.hrace.clock = d.hrace.validAt + FINISH_LIMIT_S - 0.5;
  d.run(1, () => { d.me.rudder = 0; });
  assert.equal(d.Gh.dnf, true, 'the host\'s race has her out at the limit');
  assert.equal(d.me.dnf, true, 'her screen shows it');
  assert.equal(d.Hg.dnf, false);
  assert.equal(d.grace.over, true);
  assert.equal(d.grace.winner, d.Hg);

  // a boat DNF'd at the limit is not then marked as having given up, whatever her tab does
  d.host.guestLeft();
  d.hrace.forfeit(d.Gh);
  d.quiet(35);
  assert.equal(d.hrace.forfeited, null);
  assert.equal(d.hrace.winner, d.H);
});

test('the results reach the guest, and go on until she answers', async () => {
  const d = await duel();
  fouled(d);
  turn(d, () => !d.Gh.pen);
  const hostSend = d.host.link.all.send, guestSend = d.guest.link.input.send;
  let sent = 0, acks = 0, told = 0;
  d.host.link.all.send = (e, p) => { if (e === 'results' && ++sent === 1) return; hostSend(e, p); }; // the first is lost…
  d.guest.link.input.send = (e, p) => { if (e === 'resultsOk' && ++acks === 1) return; guestSend(e, p); }; // …and her first answer
  d.guest.onResults(() => told++);
  toFinish(d, d.H);
  d.run(1, () => { d.me.rudder = 0; });
  toFinish(d, d.Gh);
  for (let i = 0; i < 300 && !d.hrace.over; i++) d.frame(() => { d.me.rudder = 0; });
  assert.equal(d.hrace.over, true);
  assert.equal(sent, 1);
  assert.equal(d.guest.results, null, 'her screen: nothing yet');
  assert.equal(d.host.acked, false);

  d.run(1.1);
  assert.equal(sent, 2, 'sent again a second later');
  assert.ok(d.guest.results, 'her screen has them');
  assert.equal(acks, 1);
  assert.equal(d.host.acked, false, 'her answer was lost');
  const first = d.guest.results;

  d.run(1.1);
  assert.equal(sent, 3, 'so they go again');
  assert.equal(acks, 2, 'and she answers again');
  assert.equal(d.host.acked, true);
  assert.equal(d.guest.results, first, 'the first copy is kept');
  assert.equal(told, 1, 'and she is told once');
  d.run(3);
  assert.equal(sent, 3, 'answered: no more');

  const R = d.guest.results, g = R.boats.find((b) => b.id === 'g'), h = R.boats.find((b) => b.id === 'h');
  assert.equal(R.seed, d.seed);
  assert.equal(R.boats.length, 2);
  assert.ok(d.Gh.log.fouls.length >= 1, 'the foul is in her log');
  assert.deepEqual(g.log.fouls, d.Gh.log.fouls.map(plain));
  assert.deepEqual(g.legT, plain(d.Gh.legT));
  assert.deepEqual([g.done, g.dsq, g.dnf, g.pens, g.place, g.finish], [true, false, false, 1, 2, d.Gh.finish]);
  assert.deepEqual([h.done, h.dsq, h.dnf, h.pens, h.place, h.finish], [true, false, false, 0, 1, d.H.finish]);
  assert.deepEqual(g.track, plain(thinTrack(d.Gh.track)));
});

// boat b over the line in the last minute under the race's U or black flag, then the race a minute past the gun
async function flagged(flag, b = (d) => d.Gh) {
  const d = await duel({ seed: SEED[flag] }), r = d.hrace, c = r.course, boat = b(d);
  r.clock = -30;
  d.run(0.5);
  Object.assign(boat, { x: (c.pin.x + c.committee.x + c.windward.x) / 3, z: (c.pin.z + c.committee.z + c.windward.z) / 3, v: 1 });
  d.run(0.5);
  assert.equal(boat[flag === 'U' ? 'ufd' : 'bfd'], true, 'she is out under the flag');
  underWay(d);
  return d;
}

for (const flag of ['U', 'B']) {
  // under U she sails on and is still out at the limit; under the black flag she is out of the race there and then
  const want = flag === 'U' ? [false, true, true] : [true, true, false];
  test(`the results count a boat out under the ${flag === 'U' ? 'U' : 'black'} flag as disqualified: still out at the limit, or gone`, async () => {
    const d = await flagged(flag);
    toFinish(d, d.H);
    d.run(2, () => { d.me.rudder = 0; });
    assert.equal(d.hrace.winner, d.H);
    d.hrace.clock = d.hrace.validAt + FINISH_LIMIT_S - 0.5;
    d.run(1.5, () => { d.me.rudder = 0; });
    const late = d.guest.results.boats.find((b) => b.id === 'g');
    assert.deepEqual([late.done, late.dsq, late.dnf], want, 'out at the limit');
    assert.equal(d.guest.results.boats.find((b) => b.id === 'h').dsq, false, 'and the boat home clean is not');

    const e = await flagged(flag);
    e.host.guestLeft();
    e.run(0.5);
    // (out under the black flag, she had already left the race: the host's boat races on to her finish)
    if (flag === 'B') { assert.equal(e.hrace.over, false); toFinish(e, e.H); e.run(2, () => { e.me.rudder = 0; }); }
    const gone = e.guest.results.boats.find((b) => b.id === 'g');
    assert.deepEqual([gone.done, gone.dsq, gone.dnf], want, 'gone before her finish: out, and she never finished');
  });
}

test('a boat merely out of time is DNF in the results, not disqualified', async () => {
  const d = await duel();
  underWay(d);
  toFinish(d, d.H);
  d.run(2, () => { d.me.rudder = 0; });
  d.hrace.clock = d.hrace.validAt + FINISH_LIMIT_S - 0.5;
  d.run(1.5, () => { d.me.rudder = 0; });
  const g = d.guest.results.boats.find((b) => b.id === 'g');
  assert.deepEqual([g.done, g.dsq, g.dnf], [false, false, true]);
});

test('the last snapshot lost at the limit: the guest\'s screen has her DNF from the next, after her end', async () => {
  const d = await duel();
  underWay(d);
  toFinish(d, d.H);
  d.run(2, () => { d.me.rudder = 0; });
  const send = d.host.link.all.send;
  let lost = 0;
  d.host.link.all.send = (e, p) => { if (e === 'snap' && d.hrace.over && !lost++) return; send(e, p); }; // the socket blinks
  d.hrace.clock = d.hrace.validAt + FINISH_LIMIT_S - 0.5;
  for (let i = 0; i < 120 && !d.hrace.over; i++) d.frame(() => { d.me.rudder = 0; });
  assert.equal(d.Gh.dnf, true, 'the host\'s race has her out');
  assert.equal(lost, 1, 'the snapshot that said so was lost');
  assert.ok(d.guest.ended, 'her screen has the end');
  assert.equal(d.me.dnf, false, 'and doesn\'t know yet');
  d.run(1.1);
  assert.equal(d.me.dnf, true, 'told with the end\'s next repeat');
  assert.equal(d.grace.over, true);
});

test('a page reloaded after the race reads the boats\' final state', async () => {
  const d = await duel();
  underWay(d);
  toFinish(d, d.H);
  d.run(1, () => { d.me.rudder = 0; });
  toFinish(d, d.Gh);
  for (let i = 0; i < 300 && !d.hrace.over; i++) d.frame(() => { d.me.rudder = 0; });
  assert.equal(d.hrace.over, true);
  assert.equal(d.Gh.place, 2);
  d.run(0.5);
  const fresh = await d.reload();
  assert.equal(d.me.done, false, 'a new page knows nothing yet');
  d.run(1.1);
  assert.equal(fresh.race.over, true);
  assert.equal(fresh.race.winner, d.Hg);
  assert.deepEqual([d.me.done, d.me.place, d.me.finish], [true, 2, d.Gh.finish], 'her own boat, as the host has her');
  assert.deepEqual([d.Hg.done, d.Hg.place, d.Hg.finish], [true, 1, d.H.finish], 'and the host\'s');
});

test('results of another seed are ignored', async () => {
  const d = await duel();
  const ear = makeLink(d.rt, d.code);
  await ear.all.join(); await ear.input.join();
  const answers = [];
  ear.input.on('resultsOk', (m) => answers.push(m));
  ear.all.send('results', { ...resultsOf(d.hrace), seed: d.seed + 1 });
  assert.equal(d.guest.results, null, 'her screen keeps nothing');
  assert.deepEqual(answers, [], 'and doesn\'t answer');
  ear.input.send('resultsOk', { id: 'g', seed: d.seed + 1 });
  ear.input.send('resultsOk', { id: 'x', seed: d.seed });
  assert.equal(d.host.acked, false, 'nor does the host take another race\'s answer, or another sailor\'s');
  ear.all.send('results', resultsOf(d.hrace));
  assert.equal(d.guest.results.seed, d.seed, 'this race\'s are kept');
  assert.deepEqual(answers, [{ id: 'g', seed: d.seed }]);
  assert.equal(d.host.acked, true);
});

test('thinTrack keeps every k-th point and the last, as a race\'s record does and the result page reads them', () => {
  const long = Array.from({ length: 1000 }, (_, i) => [i + 0.4, -i - 0.6]), t = thinTrack(long);
  assert.equal(t.length, 144); // (every 7th, and the last)
  assert.deepEqual(t[0], [0, -1]);
  assert.deepEqual(t[1], [7, -8], 'every k-th, k = ceil(n / 160)');
  assert.deepEqual(t.at(-1), [999, -1000], 'the last point, in whole metres');
  assert.ok(t.flat().every(Number.isInteger));
  assert.ok(t.every((p, i) => !i || p[0] > t[i - 1][0]), 'in order, none twice');
  for (const n of [1, 2, 159, 160, 161, 320, 321, 777]) {
    const tr = Array.from({ length: n }, (_, i) => [i, i]), k = Math.max(1, Math.ceil(n / 160));
    assert.deepEqual(thinTrack(tr), tr.filter((_, i) => i % k === 0 || i === n - 1), `${n} points`);
  }
  const short = [[1.2, 2.7], [3.5, 4.1], [5.9, 6.2]];
  assert.deepEqual(thinTrack(short), [[1, 3], [4, 4], [6, 6]], 'a short track keeps every point');
  assert.deepEqual(thinTrack([[7.4, 8.6]]), [[7, 9]]);
  assert.deepEqual(thinTrack([]), []);
});

// ---------- the end of the race, as each screen keeps it ----------
// how the race has ended on the host's screen, and what the guest's had when her results came
function ending(d) {
  const at = {}, order = [];
  const ear = makeLink(d.rt, d.code).all;
  ear.join();
  for (const k of ['snap', 'end', 'results']) ear.on(k, () => order.push(k));
  d.guest.onResults(() => Object.assign(at, { over: d.grace.over, winner: d.grace.winner?.id ?? null, boats: Object.fromEntries(d.grace.humans.map((b) => [b.id, { done: b.done, dsq: b.dsq, place: b.place }])) }));
  return { at, order };
}
const ids = (R) => R.boats.map((b) => b.id);

test('the end reaches the guest before the results: her race is over, its last state hers, when she keeps them', async () => {
  const d = await duel();
  underWay(d);
  const { at, order } = ending(d);
  toFinish(d, d.H); d.H.pen = { tack: false, gybe: false, dir: 0 };
  d.run(1.5);
  assert.equal(d.H.dsq, true, 'the host home first, her penalty unserved');
  toFinish(d, d.Gh);
  d.run(1.5);
  assert.equal(d.hrace.over, true);
  const first = order.indexOf('results');
  assert.deepEqual(order.slice(first - 2, first + 1), ['snap', 'end', 'results'], 'the last snapshot, the end, then the results');
  assert.equal(at.over, true); assert.equal(at.winner, 'g');
  assert.deepEqual(at.boats, { h: { done: true, dsq: true, place: null }, g: { done: true, dsq: false, place: 1 } });
});

test('the results are in the order of the result, whatever the water says: the winner first, for every ending', async () => {
  // home first with a penalty unserved: the next boat home wins
  const a = await duel();
  underWay(a);
  toFinish(a, a.H); a.H.pen = { tack: false, gybe: false, dir: 0 };
  a.run(1.5);
  toFinish(a, a.Gh);
  a.run(1.5);
  assert.deepEqual(ids(a.guest.results), ['g', 'h']);

  // given up with the boat that gave up ahead on the water
  const b = await duel();
  underWay(b);
  b.Gh.leg = b.H.leg + 1;
  assert.equal(b.hrace.standings()[0], b.Gh, 'she is ahead');
  b.hrace.forfeit(b.Gh);
  b.run(0.2);
  assert.equal(b.hrace.winner, b.H);
  assert.deepEqual(ids(b.guest.results), ['h', 'g']);

  // both home clean, the guest first
  const c = await duel();
  underWay(c);
  toFinish(c, c.Gh);
  c.run(1.5);
  toFinish(c, c.H);
  c.run(1.5);
  assert.deepEqual(ids(c.guest.results), ['g', 'h']);

  // still out at the limit, ahead of nobody
  const e = await duel();
  underWay(e);
  toFinish(e, e.Gh);
  e.run(1.5);
  e.hrace.clock = e.hrace.validAt + FINISH_LIMIT_S;
  e.run(0.5);
  assert.equal(e.H.dnf, true);
  assert.deepEqual(ids(e.guest.results), ['g', 'h']);

  // nobody a valid finisher: the boat home before the boat that never got there
  const f = await duel();
  underWay(f);
  toFinish(f, f.Gh); f.Gh.pen = { tack: false, gybe: false, dir: 0 };
  f.run(1.5);
  assert.equal(f.Gh.dsq, true);
  f.hrace.forfeit(f.H);
  f.run(0.5);
  assert.equal(f.hrace.winner, null);
  assert.deepEqual(ids(f.guest.results), ['g', 'h']);
});

test('guestLeft before the gun calls the race off: nobody has raced yet, so nothing counts (the brief: before the gun, nothing; after it, a loss)', async () => {
  const d = await duel();
  assert.ok(d.hrace.clock < 0 && !d.hrace.recalls, 'still before the gun');
  d.host.guestLeft();
  assert.equal(d.host.abandoned, true, 'called off');
  assert.equal(d.host.guestGone, true, 'by the guest, so the end names her as the one who left');
  assert.equal(d.hrace.forfeited, null, 'no forfeit'); assert.equal(d.hrace.winner, null, 'no winner');
});
