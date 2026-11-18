// Messages from the race before: after a rematch a late snapshot, event, end, abandon, results, answer, state or input from
// the race just sailed must change nothing in the new one, on either screen.
import { sailing, aboard, run, until, rematch, toFinish, viewOf, watchAgreement, M, CODE, hub, plain } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const FIRST = 11, SECOND = 22;

// a third party on the channels: what it heard of each message, and a way to say it again
async function listener() {
  const ear = M.makeLink(hub(), CODE), last = {}, evs = [];
  await ear.all.join(); await ear.input.join();
  for (const k of ['snap', 'ev', 'end', 'results', 'mstate']) ear.all.on(k, (m) => { last[k] = m; if (k === 'ev') evs.push(...m.list); });
  for (const k of ['input', 'resultsOk']) ear.input.on(k, (m) => { last[k] = m; });
  return { ear, last, evs };
}
// a first race sailed to its end and its card, what it said kept, and the second under way on both screens
async function rematched({ settle = true } = {}) {
  const x = await sailing({ seed: FIRST });
  const { ear, last, evs } = await listener();
  toFinish(x.hr, x.H); until(() => x.H.done, x.both, 10);
  run(1, ...x.both);
  toFinish(x.hr, x.G); until(() => x.hr.over, x.both, 10);
  until(() => x.h.shows('#mCard .m-go') && x.g.kept.length === 1, x.both, 20, 'the card offers the rematch');
  const { winner, margin, forfeited, ...id } = last.end; // (whatever says which race it was, an abandon of that race says too)
  const old = { ...plain(last), abandon: id, ev: { ...last.ev, list: evs.filter((m) => m.key !== 'signal') } };
  assert.ok(old.ev.list.length > 0, 'the race had its news');
  assert.deepEqual(old.results?.seed, FIRST);
  x.old = old; x.ear = ear;
  x.say = (k, m) => (k === 'input' || k === 'resultsOk' ? ear.input : ear.all).send(k, m);
  if (settle) {
    rematch(x, SECOND);
    until(() => x.h.cur().seed === SECOND && x.h.cur().H && x.g.cur()?.seed === SECOND && x.g.cur().gotSnap, x.both, 10, 'the second race is on');
    aboard(x);
    run(2, ...x.both);
  }
  return x;
}
// what must not move: both screens' races, whole
const state = (s) => { const r = s.race(); return { seed: r.seed, clock: r.clock, over: r.over, view: viewOf(r), at: r.humans.map((b) => [b.x, b.z, b.h, b.v, b.rudder, b.track.length, b.legT.length, b.tackSeen || 0]), match: plain(s.match().toJSON()) }; };
function untouched(x, k, m = x.old[k]) {
  const before = [state(x.h), state(x.g)], heard = [x.h.heard.length, x.g.heard.length], msgs = x.g.race().messages.length;
  x.say(k, m);
  assert.deepEqual([state(x.h), state(x.g)], before, `a late ${k} moved nothing`);
  assert.equal(x.g.race().messages.length, msgs, 'and told the guest nothing');
  assert.deepEqual([x.h.heard.length, x.g.heard.length], heard);
}
// and the new race goes on as if nothing had been said
function goesOn(x) {
  const w = watchAgreement(x);
  run(5, ...x.both);
  assert.equal(w.bad, null, 'the screens still agree');
  assert.ok(w.n >= 40, `on ${w.n} snapshots`);
  assert.equal(x.hr.over, false); assert.equal(x.gr.over, false);
  assert.equal(x.g.match().start.seed, SECOND); assert.equal(x.g.match().state, 'race');
  assert.equal(x.h.match().state, 'race');
  assert.equal(x.g.cur().seed, SECOND); assert.equal(x.g.cur().G.abandoned, false); assert.equal(x.g.cur().G.ended, null);
  for (const s of x.both) { assert.equal(s.shows('#mCard'), false, `${s.name}: no card`); assert.equal(s.says('#mBanner'), '', `${s.name}: no banner`); assert.equal(s.racing, true, `${s.name}: still sailing`); }
}
// the new race ends as it should, and its result is its own
function endsWell(x) {
  toFinish(x.hr, x.G); until(() => x.G.done, x.both, 10);
  run(1, ...x.both);
  toFinish(x.hr, x.H); until(() => x.hr.over, x.both, 10);
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard') && x.g.kept.length === 2, x.both, 20, 'the second race\'s results are kept');
  for (const s of x.both) {
    assert.equal(s.kept.length, 2, `${s.name}: a record of each race`);
    assert.equal(s.kept[1].seed, SECOND, `${s.name}: the second is the second race's`);
    assert.equal(s.kept[1].winner, x.G.id);
    assert.deepEqual(s.marks(), { Guest: '1', Host: '2' });
  }
  assert.deepEqual(x.g.kept[1], x.h.kept[1]);
}

for (const k of ['snap', 'ev', 'end', 'abandon', 'results', 'resultsOk', 'mstate', 'input']) {
  test(`a late ${k} from the race before changes nothing in the rematch`, async () => {
    const x = await rematched();
    untouched(x, k);
    goesOn(x);
    endsWell(x);
  });
}

test('a late snapshot of a race that had a recall doesn\'t set the new race\'s clock back or wipe its tracks', async () => {
  const x = await rematched();
  run(4, ...x.both);
  const tracks = x.gr.humans.map((b) => b.track.length);
  assert.ok(tracks.every((n) => n >= 3), 'tracks under way');
  untouched(x, 'snap', { ...x.old.snap, r: 3, c: -70 });
  assert.deepEqual(x.gr.humans.map((b) => b.track.length), tracks);
  goesOn(x);
});

test('a late input with the last race\'s tack count and helm doesn\'t turn the host\'s copy of the guest', async () => {
  const x = await rematched();
  x.g.hands = (r, b) => { b.rudder = 0; };
  run(1, ...x.both);
  untouched(x, 'input', { ...x.old.input, c: { ...x.old.input.c, r: 1, tk: 5, hl: 5 } });
  run(0.05, ...x.both);
  assert.equal(x.G.rudder, 0, 'her helm is where she has it');
  assert.equal(x.G.auto, null, 'no tack');
  assert.equal(x.G.tackSeen || 0, 0, 'and her count stands');
});

test('every late message at once, again and again through the rematch, and it still ends with its own result', async () => {
  const x = await rematched();
  for (let i = 0; i < 12; i++) { for (const k of ['snap', 'ev', 'end', 'abandon', 'results', 'resultsOk', 'mstate', 'input']) x.say(k, x.old[k]); run(0.4, ...x.both); }
  goesOn(x);
  endsWell(x);
});

test('a late snapshot before the rematch has begun doesn\'t stop the guest saying her screen is ready', async () => {
  const x = await rematched({ settle: false });
  let dropped = 0;
  x.h.deaf = (e) => e === 'loaded' && dropped++ < 1; // her first word is lost on the way
  rematch(x, SECOND);
  assert.equal(x.g.cur().seed, SECOND, 'her screen has the new race');
  assert.equal(dropped, 1);
  x.say('snap', x.old.snap);
  until(() => x.h.cur().H, x.both, 5, 'she says it again, and the host\'s race starts');
  assert.equal(x.h.cur().seed, SECOND);
});

test('a late answer of the last race leaves the host still sending the new race\'s results', async () => {
  const x = await rematched();
  x.say('resultsOk', x.old.resultsOk);
  assert.equal(x.h.cur().H.acked, false);
  x.g.deaf = (e) => e === 'results'; // her line drops the results for a moment
  toFinish(x.hr, x.H); toFinish(x.hr, x.G);
  until(() => x.hr.over, x.both, 10);
  run(2, ...x.both);
  x.say('resultsOk', x.old.resultsOk);
  run(1, ...x.both);
  assert.equal(x.h.cur().H.acked, false, 'the old answer doesn\'t count as hers');
  x.g.deaf = null;
  until(() => x.h.cur().H.acked && x.g.kept.length === 2, x.both, 5, 'the new results reach her');
  assert.equal(x.g.kept[1].seed, SECOND);
});
