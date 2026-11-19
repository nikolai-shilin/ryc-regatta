// A whole race on two screens, from the first signal to the records: scripted helms sail both boats round a real course over
// the hub, with no delay and at about 150 ms each way with jitter. Every snapshot the guest takes is held against the host's
// race as it was sent, and at the end the two screens must have the same result, card and records.
import { sailing, frame, run, until, sailor, watchAgreement, viewOf, place, midBeat, midLine, plain, sim } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { D2R } = sim;
const NETS = [['no delay', { latency: 0, jitter: 0 }], ['150 ms each way with jitter', { latency: 150, jitter: 40 }]];

// the race on the two screens, each helm her own lane on the line
async function raced({ seed, net, settings, helmH = sailor(0.3), helmG = sailor(0.7) }) {
  const x = await sailing({ seed, gun: false, settings, ...net });
  x.h.hands = helmH; x.g.hands = helmG;
  x.watch = watchAgreement(x);
  return x;
}
const sailHome = (x, secs = 900) => {
  for (let i = 0; i < secs * 60 && !x.hr.over; i++) frame(x.h, x.g);
  assert.equal(x.hr.over, true, `the race ended (clock ${x.hr.clock.toFixed(0)}, legs ${x.hr.humans.map((b) => b.leg)})`);
};
const nameOf = (x, id) => (id === null ? null : x.hr.humans.find((b) => b.id === id).name);
const rowsNamed = (s) => s.rows().map(([mark, who, gap]) => [mark, who === 'you' ? s.name : who, gap]);
// a record's boats as the page will read them, whoever's screen kept it
const recordRows = (s) => s.records[0].boats.map((b) => ({ who: b.me ? s.name : b.name, done: b.done, dsq: b.dsq, dnf: !!b.dnf, won: !!b.won, secs: b.secs, pens: b.pens, legT: b.legT, track: b.track }));

// everything the two screens must agree on once the race is over
function sameEnd(x) {
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard') && x.g.kept.length > 0, x.both, 30, 'both cards are up and the guest has her results');
  assert.equal(x.watch.bad, null, 'the screens agreed at every snapshot');
  assert.ok(x.watch.n >= 900, `held against each other ${x.watch.n} times`);
  assert.deepEqual(viewOf(x.gr), viewOf(x.hr), 'legs, penalties, flags, marks of each boat, the winner');
  assert.equal(x.gr.margin, x.hr.margin, 'the margin');
  assert.deepEqual(x.g.match().result, x.h.match().result, 'the result');
  assert.equal(x.h.match().result.winner, x.hr.winner?.id ?? null);
  assert.deepEqual(rowsNamed(x.g), rowsNamed(x.h), 'the card');
  assert.equal(x.h.kept.length, 1); assert.equal(x.g.kept.length, 1); assert.equal(x.h.records.length, 1); assert.equal(x.g.records.length, 1);
  assert.deepEqual(x.g.kept[0], x.h.kept[0], 'the results each record was kept from');
  assert.deepEqual(plain(recordRows(x.g)), plain(recordRows(x.h)), 'the two records, in the same order');
  assert.equal(x.g.records[0].oneOnOne, true);
  // what each screen says of the race's signals
  const signals = (s) => s.heard.filter((k) => k === 'signal').length;
  assert.ok(signals(x.h) >= 2); assert.equal(signals(x.g), signals(x.h), 'every signal, on both');
}
function bothHomeClean(x) {
  const [a, b] = [...x.hr.humans].sort((p, q) => p.finish - q.finish);
  assert.ok(a.done && b.done, 'both sailed the course to the finish');
  assert.ok(!a.dsq && !b.dsq);
  assert.equal(x.hr.winner, a); assert.ok(Math.abs(x.hr.margin - (b.finish - a.finish)) < 1e-9);
  assert.deepEqual(x.h.marks(), { [a.name]: '1', [b.name]: '2' });
  assert.deepEqual(x.h.kept[0].boats.map((r) => r.id), [a.id, b.id], 'the winner first');
  assert.equal(x.h.records[0].boats[0].won, true);
  assert.equal(nameOf(x, x.h.match().result.winner), a.name);
}

for (const [net, o] of NETS) {
  test(`a race sailed from the first signal to the records: ${net}`, async () => {
    const x = await raced({ seed: 11, net: o });
    assert.ok(x.hr.clock < -55, 'from before the first signal');
    sailHome(x);
    sameEnd(x);
    bothHomeClean(x);
    for (const b of x.hr.humans) assert.ok(b.legT.length === x.hr.course.legs.length - 1, 'every leg sailed');
  });

  test(`twice round the triangle, a current running: ${net}`, async () => {
    const x = await raced({ seed: 16, net: o, settings: { course: 'tri', laps: 2, current: 1 } });
    assert.equal(x.hr.course.type, 'tri');
    sailHome(x, 1500);
    sameEnd(x);
    bothHomeClean(x);
  });

  test(`a general recall, then a clean start and a finish: ${net}`, async () => {
    const x = await raced({ seed: 21, net: o });
    assert.equal(x.hr.prepFlag, 'P');
    for (let i = 0; i < 90 * 60 && x.hr.clock < -1.5; i++) frame(x.h, x.g);
    const c = x.hr.course, m = midLine(c), up = 5 + sim.HULL / 2; // both boats over the line as the gun goes, bow and all
    [[x.H, 25], [x.G, -25]].forEach(([b, off]) => place(x.hr, b, { x: m.x + c.dir.x * off + c.normal.x * up, z: m.z + c.dir.z * off + c.normal.z * up }, x.hr.wind.dir() + Math.PI, 0.5));
    for (let i = 0; i < 5 * 60 && x.hr.recalls === 0; i++) frame(x.h, x.g);
    assert.equal(x.hr.recalls, 1, 'both over at the gun');
    run(1, x.h, x.g);
    assert.equal(x.gr.recalls, 1, 'on the guest\'s screen too');
    assert.equal(x.gr.prepFlag, 'U', 'and the next flag up');
    assert.ok(Math.abs(x.gr.clock - x.hr.clock) < 0.5, `her clock went back with the host's (${x.gr.clock.toFixed(2)}, ${x.hr.clock.toFixed(2)})`);
    assert.ok(x.hr.clock < -50);
    sailHome(x);
    sameEnd(x);
    bothHomeClean(x);
    for (const s of [x.h, x.g]) assert.equal(s.heard.filter((k) => k === 'genRecall').length, 1, `${s.name} told once`);
  });

  for (const fouler of ['guest', 'host']) {
    test(`a contact foul by the ${fouler}, and the penalty turn sailed to its end: ${net}`, async () => {
      const x = await raced({ seed: 12, net: o });
      for (let i = 0; i < 200 * 60 && !(x.hr.clock > 45 && x.hr.humans.every((b) => b.leg === 1 && !b.pen)); i++) frame(x.h, x.g);
      assert.ok(x.hr.humans.every((b) => b.leg === 1 && !b.pen), 'both on the beat, owing nothing');
      // the fouler on port, the other on starboard, two seconds from where they meet
      const helms = [x.h.hands, x.g.hands], [bad, good] = fouler === 'guest' ? [x.G, x.H] : [x.H, x.G], pens = bad.pens;
      x.h.hands = x.g.hands = (r, b) => { b.rudder = 0; };
      const X = midBeat(x.hr.course), W = x.hr.wind.at(X.x, X.z).dir, V = 3.4;
      for (const [b, h] of [[bad, W + 45 * D2R], [good, W - 45 * D2R]]) place(x.hr, b, { x: X.x - Math.sin(h) * V * 2, z: X.z + Math.cos(h) * V * 2 }, h, V);
      for (let i = 0; i < 8 * 60 && !bad.pen; i++) frame(x.h, x.g);
      assert.ok(bad.pen, 'the port boat owes a turn');
      assert.equal(bad.pens, pens + 1);
      assert.equal(good.pen, null);
      run(0.6, x.h, x.g);
      const on = (s) => s.race().humans.find((b) => b.id === bad.id);
      assert.ok(on(x.g).pen, 'the guest\'s screen shows it'); assert.ok(on(x.h).pen, 'and the host\'s');
      [x.h.hands, x.g.hands] = helms;
      for (let i = 0; i < 120 * 60 && bad.pen; i++) frame(x.h, x.g);
      assert.equal(bad.pen, null, 'the turn is sailed');
      run(0.6, x.h, x.g);
      assert.equal(on(x.g).pen, null, 'and its end reaches the guest\'s screen');
      assert.equal(bad.dsq, false);
      sailHome(x);
      sameEnd(x);
      bothHomeClean(x);
      const row = x.h.kept[0].boats.find((r) => r.id === bad.id);
      assert.equal(row.pens, bad.pens, 'the penalty is in the results');
      assert.ok(row.log.fouls.length >= 1, 'and the foul in her log');
      assert.ok(row.pens >= 1);
    });
  }
}

// main.js draws the boats between their last two steps: the screen's step calls its hook before each step, and says how
// far the frame is into the next
test('a frame steps the race in 1/60 s steps, calling the hook before each, and says how far it is into the next', async () => {
  const x = await sailing({ seed: 11 });
  run(1, ...x.both);
  for (const s of [x.h, x.g]) {
    let n = 0;
    s.session.step(0.05, () => n++);
    assert.equal(n, 3, `${s.name}: 0.05 s is three steps`);
    assert.ok(s.session.frac >= 0 && s.session.frac < 1);
    n = 0; s.session.step(0.5, () => n++); // a slow frame (main.js's MATCH_DT): made up, every step of it
    assert.ok(n >= 29 && n <= 31, `${s.name}: half a second is thirty steps (${n})`);
  }
});
