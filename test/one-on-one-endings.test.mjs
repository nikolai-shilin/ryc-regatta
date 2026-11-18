// Every way a 1-on-1 race can end, as a table: for each, what both screens say of the winner and the marks, the order of the
// final results, and who keeps a record. Then the same marks on a page opened again after the race.
import { sailing, page, run, until, toFinish, owes, place, viewOf, M, sim } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SEED = { P: 11, U: 13, B: 14 }; // the preparatory flag each of these seeds draws
const LIMIT = sim.FINISH_LIMIT_S;

// ---------- what happens on the water ----------
const home = (x, b) => { toFinish(x.hr, b); until(() => b.done, x.live, 10, `${b.name} is home`); };
const homeOwing = (x, b) => { owes(b); home(x, b); assert.equal(b.dsq, true, `${b.name} is home with her turn unpaid`); };
const toLimit = (x) => { x.hr.clock = x.hr.validAt + LIMIT - 0.5; until(() => x.hr.over, x.live, 3, 'the limit ends the race'); };
// boat b over the line in the last minute under the race's flag, then the race a minute past the gun
async function flagged(flag, who) {
  const x = await sailing({ seed: SEED[flag], gun: false }), r = x.hr, c = r.course, b = who === 'host' ? x.H : x.G, other = b === x.H ? x.G : x.H;
  x.live = x.both;
  r.clock = -30;
  place(r, b, { x: (c.pin.x + c.committee.x + c.windward.x) / 3, z: (c.pin.z + c.committee.z + c.windward.z) / 3 }, b.h, 1);
  run(0.5, ...x.live);
  assert.equal(b[flag === 'U' ? 'ufd' : 'bfd'], true, 'she is out under the flag');
  assert.equal(other.ufd || other.bfd, false);
  r.clock = 60;
  return x;
}
const plain = async () => { const x = await sailing({ seed: SEED.P }); x.live = x.both; return x; };
// a tab that stops: its frames and timers stand still, and nothing it would have said is said
const asleep = (x, secs) => { const was = x.live; x.live = [x.g]; run(secs, x.g); x.live = was; run(0.5, ...x.live); };
const leaves = (x, s) => { s.leave(); x.live = x.live.filter((p) => p !== s); run(0.5, ...x.live); };
// silent for thirty seconds, and not a moment less
const silent = (x) => { run(29, ...x.live); assert.equal(x.hr.over, false, 'still racing at 29 s'); run(2, ...x.live); assert.equal(x.hr.over, true, 'hers is given up at 30 s'); };

// winner: the name, or null; marks: name → mark, as both screens' cards show them; order: the final results'; kept: whose
// screen keeps a record; left: who has gone (no card there). abandoned: no result at all.
const ENDINGS = [
  { what: 'both home, the host first', make: plain, play: (x) => { home(x, x.H); run(1, ...x.live); home(x, x.G); },
    winner: 'Host', margin: true, marks: { Host: '1', Guest: '2' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'both home, the guest first', make: plain, play: (x) => { home(x, x.G); run(1, ...x.live); home(x, x.H); },
    winner: 'Guest', margin: true, marks: { Guest: '1', Host: '2' }, order: ['Guest', 'Host'], kept: ['Host', 'Guest'] },
  { what: 'the host home first and disqualified', make: plain, play: (x) => { homeOwing(x, x.H); run(1, ...x.live); assert.equal(x.hr.validAt, null, 'no limit starts'); home(x, x.G); },
    winner: 'Guest', marks: { Guest: '1', Host: 'DSQ' }, order: ['Guest', 'Host'], kept: ['Host', 'Guest'] },
  { what: 'the guest home first and disqualified', make: plain, play: (x) => { homeOwing(x, x.G); run(1, ...x.live); home(x, x.H); },
    winner: 'Host', marks: { Host: '1', Guest: 'DSQ' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'both home and both disqualified', make: plain, play: (x) => { homeOwing(x, x.G); run(1, ...x.live); homeOwing(x, x.H); },
    winner: null, marks: { Host: 'DSQ', Guest: 'DSQ' }, order: ['Guest', 'Host'], kept: ['Host', 'Guest'] },
  { what: 'the guest out under the U flag, still sailing at the limit', make: () => flagged('U', 'guest'), play: (x) => { home(x, x.H); toLimit(x); },
    winner: 'Host', marks: { Host: '1', Guest: 'DSQ' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'the guest out under the U flag, home first', make: () => flagged('U', 'guest'), play: (x) => { home(x, x.G); assert.equal(x.G.dsq, true); assert.equal(x.hr.validAt, null); run(1, ...x.live); home(x, x.H); },
    winner: 'Host', marks: { Host: '1', Guest: 'DSQ' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'the host out under the black flag, home first', make: () => flagged('B', 'host'), play: (x) => { home(x, x.H); assert.equal(x.hr.validAt, null); run(1, ...x.live); home(x, x.G); },
    winner: 'Guest', marks: { Guest: '1', Host: 'DSQ' }, order: ['Guest', 'Host'], kept: ['Host', 'Guest'] },
  { what: 'the host out under the black flag, and the guest giving up: a forfeit wins nothing for a boat already out', make: () => flagged('B', 'host'), play: (x) => leaves(x, x.g),
    winner: null, forfeited: 'Guest', marks: { Host: 'DSQ', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host'], left: ['Guest'] },
  { what: 'the three-minute limit: the guest still out', make: plain, play: (x) => { home(x, x.H); toLimit(x); },
    winner: 'Host', marks: { Host: '1', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'the three-minute limit: the host still out', make: plain, play: (x) => { home(x, x.G); toLimit(x); },
    winner: 'Guest', marks: { Guest: '1', Host: 'DNF' }, order: ['Guest', 'Host'], kept: ['Host', 'Guest'] },
  { what: 'the guest silent 30 s, her screen still hearing the host', make: plain, play: (x) => { x.g.mute = (e) => e === 'input'; silent(x); },
    winner: 'Host', forfeited: 'Guest', marks: { Host: '1', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'the guest\'s tab gone, silent 30 s', make: plain, play: (x) => { x.g.gone(); x.live = [x.h]; silent(x); },
    winner: 'Host', forfeited: 'Guest', marks: { Host: '1', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host'], left: ['Guest'] },
  { what: 'the guest pressing Leave before her finish', make: plain, play: (x) => leaves(x, x.g),
    winner: 'Host', forfeited: 'Guest', marks: { Host: '1', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host'], left: ['Guest'] },
  { what: 'the guest pressing Leave with the host already home', make: plain, play: (x) => { home(x, x.H); leaves(x, x.g); },
    winner: 'Host', forfeited: 'Guest', marks: { Host: '1', Guest: 'DNF' }, order: ['Host', 'Guest'], kept: ['Host'], left: ['Guest'] },
  { what: 'the guest pressing Leave after her finish, the host sailing home', make: plain, play: (x) => { home(x, x.G); leaves(x, x.g); assert.equal(x.hr.over, false, 'the race runs on'); home(x, x.H); },
    winner: 'Guest', margin: true, marks: { Guest: '1', Host: '2' }, order: ['Guest', 'Host'], kept: ['Host'], left: ['Guest'] },
  { what: 'the guest pressing Leave after her finish, the host out at the limit', make: plain, play: (x) => { home(x, x.G); leaves(x, x.g); toLimit(x); },
    winner: 'Guest', marks: { Guest: '1', Host: 'DNF' }, order: ['Guest', 'Host'], kept: ['Host'], left: ['Guest'] },
  { what: 'the host pressing Leave before her finish', make: plain, play: (x) => leaves(x, x.h),
    abandoned: true, kept: [], left: ['Host'] },
  { what: 'the host pressing Leave after her finish', make: plain, play: (x) => { home(x, x.H); leaves(x, x.h); },
    abandoned: true, kept: [], left: ['Host'] },
  { what: 'the host\'s tab asleep over a minute', make: plain, play: (x) => asleep(x, 61),
    abandoned: true, kept: [] },
  { what: 'the host\'s tab asleep over a minute after her own finish', make: plain, play: (x) => { home(x, x.H); asleep(x, 61); },
    abandoned: true, kept: [] },
  { what: 'the host\'s tab asleep under a minute: the race carries on', make: plain, play: (x) => { asleep(x, 50); assert.equal(x.hr.over, false); home(x, x.H); run(1, ...x.live); home(x, x.G); },
    winner: 'Host', margin: true, marks: { Host: '1', Guest: '2' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
  { what: 'the host\'s tab asleep with the race already over: it stands', make: plain, play: (x) => { home(x, x.H); run(1, ...x.live); home(x, x.G); asleep(x, 70); },
    winner: 'Host', margin: true, marks: { Host: '1', Guest: '2' }, order: ['Host', 'Guest'], kept: ['Host', 'Guest'] },
];

// the card up on every screen still there, and what each says
function cardsUp(x) { until(() => x.live.every((s) => s.shows('#mCard')) && (x.live.length < 2 || x.g.kept.length > 0 || x.abandonedRace?.()), x.live, 40, 'the cards are up'); }
const heading = (s, e) => (e.abandoned ? 'Race abandoned' : e.winner === null ? 'No winner' : e.winner === s.name ? 'raceWon' : `raceLost ${e.winner}`);

for (const e of ENDINGS) {
  test(`how it ends: ${e.what}`, async () => {
    const x = await e.make();
    const name = (id) => (id === null ? null : x.hr.humans.find((b) => b.id === id).name);
    x.abandonedRace = () => !!e.abandoned;
    await e.play(x);
    cardsUp(x);
    for (const s of x.live) {
      const r = s.match().result;
      assert.equal(s.says('#mCardH'), heading(s, e), `${s.name}: the card's title`);
      assert.equal(r.abandoned, !!e.abandoned, `${s.name}: abandoned or not`);
      assert.equal(name(r.winner), e.abandoned ? null : e.winner, `${s.name}: the winner`);
      assert.equal(name(r.forfeited), e.forfeited ?? null, `${s.name}: who gave it up`);
      assert.equal(r.margin !== null, !!e.margin, `${s.name}: a margin or none`);
      assert.deepEqual(s.marks(), e.abandoned ? {} : e.marks, `${s.name}: the marks`);
      if (e.margin) assert.ok(s.rows()[1][2].startsWith('+'), `${s.name}: the gap on the second row`);
    }
    if (!e.abandoned) {
      assert.deepEqual(M.finalResults(x.hr).boats.map((b) => name(b.id)), e.order, 'the order of the final results');
      assert.equal(name(M.finalResults(x.hr).winner), e.winner);
    }
    run(2, ...x.live); // (a record is kept once, however long the card stays up)
    if (!e.abandoned) for (const s of x.live) assert.deepEqual(Object.fromEntries(Object.entries(s.match().result.marks ?? {}).map(([id, m]) => [name(id), m])), Object.fromEntries(Object.entries(e.marks).filter(([, m]) => m === 'DSQ' || m === 'DNF')), `${s.name}: the marks the result keeps`);
    if (!e.abandoned && x.live.includes(x.g)) assert.deepEqual(viewOf(x.g.race()).boats, viewOf(x.hr).boats, 'each boat as the guest\'s screen has her at the end');
    for (const s of x.both) {
      const keeps = e.kept.includes(s.name);
      assert.equal(s.records.length, keeps ? 1 : 0, `${s.name}: ${keeps ? 'keeps a record' : 'keeps none'}`);
      if (keeps) {
        assert.deepEqual(s.kept[0].boats.map((b) => name(b.id)), e.order, `${s.name}: the record's order`);
        assert.deepEqual(s.records[0].boats.map((b) => (b.me ? s.name : b.name)), e.order, `${s.name}: the page's order`);
        assert.deepEqual(s.records[0].boats.filter((b) => b.won).map((b) => (b.me ? s.name : b.name)), e.winner ? [e.winner] : [], `${s.name}: who it says won`);
      }
      if (x.live.includes(s)) assert.equal(s.shows('#mCard .m-full'), keeps, `${s.name}: Full result, with a record to open`);
    }
  });
}

// ---------- a page opened again after the race ----------
const MARKED = ENDINGS.filter((e) => !e.abandoned && !e.left && Object.values(e.marks).some((m) => m === 'DSQ' || m === 'DNF'));

for (const e of MARKED) {
  test(`opened again, the card still has its DSQ or DNF: ${e.what}`, async () => {
    const x = await e.make();
    await e.play(x);
    cardsUp(x);
    assert.deepEqual(x.h.marks(), e.marks, 'as the race ended');

    // the guest's page reloaded: she has only what the host tells her
    x.g.gone();
    const g2 = await page('Guest', { ls: x.g.ls });
    until(() => g2.shows('#mCard'), [x.h, g2], 5, 'her card is back');
    assert.deepEqual(g2.marks(), e.marks, 'the guest\'s page');
    assert.equal(g2.says('#mCardH'), heading(g2, e));

    // the host's page reloaded: she has only what she saved
    x.h.gone();
    const h2 = await page('Host', { ls: x.h.ls });
    run(0.5, h2, g2);
    assert.equal(h2.shows('#mCard'), true);
    assert.deepEqual(h2.marks(), e.marks, 'the host\'s page');
    assert.equal(h2.says('#mCardH'), heading(h2, e));
    assert.equal(h2.records.length, 0, 'and no second record');
  });
}

test('opened again after a clean race, the second boat is still second, with her gap', async () => {
  const x = await plain();
  home(x, x.H); run(1, ...x.live); home(x, x.G);
  cardsUp(x);
  const rows = x.h.rows();
  x.h.gone();
  const h2 = await page('Host', { ls: x.h.ls });
  run(0.5, h2);
  assert.deepEqual(h2.rows(), rows);
});
