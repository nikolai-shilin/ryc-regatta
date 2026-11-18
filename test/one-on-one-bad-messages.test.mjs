// Bad messages: malformed, missing, wrong-typed or oversized payloads for every message either screen listens to. They must
// never throw, stop the race or change its result. The junk comes from a seed, named in each test, so a failure can be run
// again; the proof is a clean race and a race under fire, frame for frame the same, ending in the very same records.
import { room, start, aboard, frame, run, until, rematch, toFinish, viewOf, M, W, CODE, hub, plain } from './one-on-one-screens.mjs';
import { dice, junk, mutate } from './one-on-one-junk.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ON_ALL = ['hello', 'bye', 'start', 'mstate', 'snap', 'ev', 'end', 'abandon', 'results', 'loaded', 'leave'], ON_INPUT = ['input', 'resultsOk'], KINDS = [...ON_ALL, ...ON_INPUT];
const FREE = /(^|\.)(look|arg)(\.|$)|(^|\.)settings\.(?!venue|yacht)/; // a sailor's look, a message's words and the choices cleanSettings repairs: free to be odd
const SEED = 11;
const errors = []; console.error = (...a) => errors.push(a);

// a third party on the channels: the last real message of each kind, and a way to say anything at all
async function listener() {
  const ear = M.makeLink(hub(), CODE), last = {};
  await ear.all.join(); await ear.input.join();
  for (const k of ON_ALL) ear.all.on(k, (m) => { last[k] = m; });
  for (const k of ON_INPUT) ear.input.on(k, (m) => { last[k] = m; });
  return { last, say: (k, m) => (ON_INPUT.includes(k) ? ear.input : ear.all).send(k, m) };
}
// the shape of each message as this race would send it, for those not heard yet
function shapes(x, last) {
  const idOf = (s) => JSON.parse(s.ls.getItem('regatta-match-me')), r = x.hr ?? x.h.race(), seed = r?.seed ?? SEED, hid = idOf(x.h), gid = idOf(x.g);
  const person = (i, name) => ({ id: i, name, look: null });
  const startMsg = { settings: { venue: 'palma', yacht: 'jpk1050' }, seed: seed + 1, host: person(hid, 'Host'), guest: person(gid, 'Guest') };
  return { hello: { id: gid, name: 'Guest', look: null, build: 'b1', host: false, settings: null, joinedAt: 1 }, bye: { id: gid }, start: startMsg, mstate: { start: startMsg, state: 'race', result: null, leftBy: null },
    end: { seed, winner: hid, margin: 1, forfeited: null }, abandon: { seed }, loaded: { id: gid, seed }, leave: { id: gid }, resultsOk: { id: gid, seed },
    input: { id: gid, seed, c: W.controlsOf(x.G ?? { rudder: 0 }), g: 1 }, results: r ? M.finalResults(r) : { seed, boats: [] }, ...last };
}
function oversized(k, m, g) {
  const long = 'x'.repeat(100000), rows = (a) => Array(20000).fill(a?.[0] ?? 0);
  if (k === 'snap') return { ...m, b: rows(m.b) };
  if (k === 'ev') return { ...m, list: Array(20000).fill({ key: 'hail', arg: null, to: null }) };
  if (k === 'results' && m.boats?.[0]) return { ...m, boats: [{ ...m.boats[0], track: Array(50000).fill([1, 1]) }, m.boats[1]] };
  if (k === 'hello') return { ...m, id: long, name: long };
  if (k === 'input') return { ...m, c: { ...m.c, kt: long } };
  return { ...m, [g.pick(Object.keys(m))]: long }; // (one of its own fields, grown past all reason)
}
// one bad message of this kind
function badOne(k, x, last, g) {
  const m = shapes(x, last)[k];
  const how = g.int(10);
  if (how < 3) return junk(g);
  if (how < 9 && m) return mutate(m, g, FREE);
  return m ? oversized(k, m, g) : junk(g);
}

// the hands of both sailors: the same every time, whatever the screens are told
const steady = (r, b) => { b.autoTrim = true; b.rudder = 0.15 * Math.sin(r.clock / 3); };
// A race from the waiting room to the card, the rematch offered. fire(phase, x): called each frame, to say what it likes
async function aRace(fire = () => {}) {
  errors.length = 0;
  const x = await room(), { last, say } = await listener();
  x.say = say; x.last = last;
  const tick = (phase, n = 1) => { for (let i = 0; i < n; i++) { fire(phase, x); frame(x.h, x.g); } };
  const whileNot = (phase, cond, what) => { for (let i = 0; i < 3600 && !cond(); i++) tick(phase); assert.ok(cond(), what); };
  tick('room', 90);
  assert.equal(x.h.session, null, 'nobody started a race but the host');
  assert.equal(x.g.session, null);
  assert.equal(x.h.$('.m-start').disabled, false, 'the host can start: her guest is in the room');
  start(x, SEED);
  whileNot('race', () => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, 'the race starts');
  aboard(x);
  x.h.hands = x.g.hands = steady;
  tick('race', 600);
  toFinish(x.hr, x.G);
  whileNot('race', () => x.G.done, 'the guest is home');
  tick('race', 120);
  toFinish(x.hr, x.H);
  whileNot('race', () => x.hr.over, 'the host is home');
  whileNot('card', () => x.h.shows('#mCard .m-go') && x.g.shows('#mCard') && x.g.kept.length > 0, 'the cards are up, and the rematch offered');
  tick('card', 300);
  return { x, outcome: plain({
    results: [x.h.kept, x.g.kept], records: [x.h.records, x.g.records], rows: [x.h.rows(), x.g.rows()], titles: [x.h.says('#mCardH'), x.g.says('#mCardH')],
    matches: [x.h.match().toJSON(), x.g.match().toJSON()], views: [viewOf(x.hr), viewOf(x.gr)], margin: [x.hr.margin, x.gr.margin], clock: x.hr.clock,
    boats: x.hr.humans.map((b) => [b.x, b.z, b.h, b.v, b.finish]), mine: [x.gr.player.x, x.gr.player.z, x.gr.player.h], heard: [x.h.heard, x.g.heard], toasts: [x.h.toasts, x.g.toasts],
  }) };
}
const clean = await aRace();
assert.equal(clean.x.hr.winner.name, 'Guest', 'the clean race: the guest first home');
assert.deepEqual(errors, [], 'nothing went wrong in the clean race');

for (const seed of [1, 20261118, 777]) {
  test(`a race under a hail of bad messages ends exactly as a clean one (junk seed ${seed})`, async () => {
    const g = dice(seed), told = Object.fromEntries(KINDS.map((k) => [k, 0]));
    const { outcome } = await aRace((phase, x) => {
      for (let i = g.int(3); i > 0; i--) {
        const k = g.pick(KINDS), m = badOne(k, x, x.last, g);
        told[k]++;
        try { x.say(k, m); }
        catch (e) { assert.fail(`junk seed ${seed}, phase ${phase}: ${k} ${JSON.stringify(m)?.slice(0, 300)} threw ${e.stack}`); }
      }
    });
    for (const k of KINDS) assert.ok(told[k] >= 20, `${k}: ${told[k]} bad ones sent`);
    assert.deepEqual(errors, [], 'nothing was logged as gone wrong');
    assert.deepEqual(outcome, clean.outcome, `junk seed ${seed}: the race was not changed`);
  });
}

// ---------- each message, each kind of badness, by name ----------
const PLAIN_BAD = [null, undefined, 0, 7, -1.5, true, '', 'x', [], [[]], {}, { id: null }, { seed: null }, { seed: 'x' }, { seed: {} }, { toString: 1 }, { valueOf: 1, toString: 1 }, { id: { toString: 1 } }, { list: 5 }, { list: [null] }, { list: [{ key: 5 }] }, { b: 5 }, { b: [] }, { b: [[], []] }, { boats: 5 }, { boats: [null, null] }, { start: 5 }, { start: {} }, { start: { host: 5, guest: 5 } }, { c: 5 }, { c: [] }, { c: { r: 'x' } }];
const state = (s) => { const r = s.race(); return { over: r.over, clock: r.clock, view: viewOf(r), at: r.humans.map((b) => [b.x, b.z, b.h, b.v, b.rudder, b.track.length, b.legT.length]), said: r.messages.length, m: plain(s.match().toJSON()) }; };

for (const k of KINDS) {
  test(`${k}: a bad one on the water moves nothing on either screen`, async () => {
    const x = await room(), { say } = await listener();
    start(x, SEED);
    until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
    aboard(x); x.h.hands = x.g.hands = steady;
    run(1, ...x.both);
    for (const m of PLAIN_BAD) {
      const before = [state(x.h), state(x.g)];
      say(k, m);
      assert.deepEqual([state(x.h), state(x.g)], before, `${k} ${JSON.stringify(m)}`);
    }
    run(4, ...x.both);
    assert.equal(x.hr.over, false); assert.equal(x.gr.over, false);
    assert.equal(x.g.cur().G.abandoned, false); assert.equal(x.g.shows('#mBanner'), false);
    assert.deepEqual(viewOf(x.gr).boats, viewOf(x.hr).boats, 'and the two still agree');
    assert.equal(x.g.cur().G.results, null, 'no results before the race is over');
    assert.deepEqual(errors.splice(0), [], 'nothing logged as gone wrong');
  });
}

test('a bad results with the right seed is not kept, and the real ones that follow are', async () => {
  const x = await room(), { say } = await listener();
  start(x, SEED);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  aboard(x);
  const R = plain(M.finalResults(x.hr));
  for (const bad of [{ seed: SEED }, { seed: SEED, boats: 5 }, { seed: SEED, boats: [] }, { ...R, boats: [R.boats[0]] }, { ...R, boats: [R.boats[0], R.boats[0]] }, { ...R, boats: [{ ...R.boats[0], log: null }, R.boats[1]] }, { ...R, boats: [{ ...R.boats[0], track: 'x' }, R.boats[1]] }, { ...R, winner: 'nobody' }]) say('results', bad);
  assert.equal(x.g.cur().G.results, null, 'none of those');
  assert.equal(x.g.kept.length, 0);
  assert.equal(x.h.cur().H.acked, false, 'and none answered as if it were');
  toFinish(x.hr, x.H); toFinish(x.hr, x.G);
  until(() => x.hr.over && x.g.kept.length === 1, x.both, 10, 'the real results are kept');
  assert.deepEqual(x.g.kept[0], plain(x.h.kept[0]));
});

test('after a hail of bad messages on the card the rematch still sails', async () => {
  const g = dice(5);
  const { x } = await aRace((phase, y) => { if (phase === 'card') y.say(g.pick(KINDS), junk(g)); });
  rematch(x, SEED + 11);
  until(() => x.h.cur().seed === SEED + 11 && x.h.cur().H && x.g.cur().seed === SEED + 11, x.both, 10, 'the second race is on');
  assert.deepEqual(errors.splice(0), []);
});
