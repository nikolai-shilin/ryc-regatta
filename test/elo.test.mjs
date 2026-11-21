// The 1-on-1 rating's sums (lib/elo.ts) and levels (lib/levels.ts): the cases the help page and the design show, a
// provisional sailor's double weight, and the levels' edges. ELO_CASES are the cases the database's own regatta_rate_duel
// was run against (iyt-test supabase/migrations/20261121140000_regatta_rating.sql), so the two can't drift apart unseen.
// Run: node --test test/elo.test.mjs
import './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { chance, stakes, rate, kFor, shown, signed, START, K, K_NEW, PROVISIONAL } = await import('../lib/elo.ts');
const { LEVELS, levelOf, levelName, nextLevel } = await import('../lib/levels.ts');

const settled = (rating) => ({ rating, races: 40 });

test('everyone starts at 1500; K is 32, and 64 for the first five rated races', () => {
  assert.equal(START, 1500); assert.equal(K, 32); assert.equal(K_NEW, 64); assert.equal(PROVISIONAL, 5);
  assert.deepEqual([0, 1, 4, 5, 40].map(kFor), [64, 64, 64, 32, 32]);
});

test('the chance: even at the same rating, 1 in 11 at 400 apart, and the two chances make one', () => {
  assert.equal(chance(1500, 1500), 0.5);
  assert.ok(Math.abs(chance(1500, 1900) - 1 / 11) < 1e-12);
  for (const [a, b] of [[1540, 1585], [1388, 1720], [2210, 1190]]) assert.ok(Math.abs(chance(a, b) + chance(b, a) - 1) < 1e-12);
});

// Alex P.'s last five on the design, all settled: [yours, theirs, won, change]
export const ELO_CASES = [
  [1540, 1497, false, -18], // lost to Kai L.
  [1522, 1388, true, 10], // beat Marco R.
  [1532, 1720, true, 24], // beat Jonas B.
  [1556, 1556, false, -16], // lost to Lotte V.
  [1540, 1585, true, 18], // beat Anna K.
  [1509, 1752, true, 26], // the giant-killer win over Tomás R.
];
test('a settled race moves both by the same amount, the other way: the design\'s cases', () => {
  for (const [mine, theirs, won, want] of ELO_CASES) {
    const r = rate(settled(mine), settled(theirs), won);
    assert.equal(r.a.delta, want, `${mine} v ${theirs}`);
    assert.equal(r.b.delta, -want, 'zero-sum between two settled sailors');
    assert.equal(r.a.after, mine + want);
  }
});

test('a 1540 who beats a 1585 gains 18 and the 1585 loses 18; the stakes say so before the race', () => {
  const r = rate(settled(1540), settled(1585), true);
  assert.deepEqual([r.a.before, r.a.after, r.a.delta, r.b.after, r.b.delta], [1540, 1558, 18, 1567, -18]);
  const s = stakes(1540, 1585, 40);
  assert.deepEqual([s.win, s.loss, Math.round(s.chance * 100)], [18, 14, 44]);
});

test('a first-five race moves twice as far, and a race between a new sailor and a settled one isn\'t zero-sum', () => {
  const r = rate({ rating: 1500, races: 0 }, { rating: 1508, races: 2 }, true);
  assert.deepEqual([r.a.delta, r.b.delta, r.a.k], [33, -33, 64]);
  const card = stakes(1500, 1508, 0);
  assert.deepEqual([card.win, card.loss], [33, 31], 'the first 1-on-1\'s card: a win about +33, a loss about −31');
  const mixed = rate({ rating: 1500, races: 4 }, settled(1500), false);
  assert.deepEqual([mixed.a.delta, mixed.b.delta, mixed.a.k, mixed.b.k], [-32, 16, 64, 32]);
  assert.equal(rate({ rating: 1500, races: 5 }, settled(1500), false).a.delta, -16, 'the sixth race is settled');
});

test('an expected win moves little, an upset a lot; nothing is lost for a win or won for a loss', () => {
  assert.equal(rate(settled(2200), settled(1200), true).a.delta, 0);
  assert.equal(rate(settled(1200), settled(2200), true).a.delta, 32);
  for (let d = -800; d <= 800; d += 37) {
    const r = rate(settled(1500 + d), settled(1500), true);
    assert.ok(r.a.delta >= 0 && r.b.delta <= 0);
  }
});

// what regatta_rate_duel wrote, run on the project on 21 Nov 2026 in a transaction rolled back: three new sailors racing
// through their first five, the guest winning some. [host, guest, host won, host's change, guest's change]
const DB_CASES = [
  [{ rating: 1500, races: 0 }, { rating: 1500, races: 0 }, true, 32, -32],
  [{ rating: 1532, races: 1 }, { rating: 1468, races: 1 }, false, -38, 38],
  [{ rating: 1506, races: 2 }, { rating: 1494, races: 2 }, true, 31, -31],
  [{ rating: 1463, races: 3 }, { rating: 1500, races: 0 }, false, -29, 29],
  [{ rating: 1529, races: 1 }, { rating: 1434, races: 4 }, false, -41, 41],
];
test('the site\'s sums are the database\'s: the cases regatta_rate_duel was run against', () => {
  for (const [h, g, hostWon, dh, dg] of DB_CASES) {
    const r = rate(h, g, hostWon);
    assert.deepEqual([r.a.delta, r.b.delta], [dh, dg], JSON.stringify([h, g]));
  }
});

test('shown with a ~ while provisional, and a change with its sign', () => {
  assert.equal(shown(1500, 0), '~1500'); assert.equal(shown(1531, 4), '~1531'); assert.equal(shown(1558, 5), '1558');
  assert.deepEqual([signed(18), signed(-16), signed(0)], ['+18', '−16', '±0']);
});

test('seven levels, 200 apart, Local where Club once was, each with a name in every language', () => {
  assert.deepEqual(LEVELS.map((l) => l.key), ['novice', 'local', 'fleet', 'regional', 'national', 'international', 'olympian']);
  assert.deepEqual(LEVELS.slice(1).map((l) => l.min), [1200, 1400, 1600, 1800, 2000, 2200]);
  for (const l of LEVELS) { assert.equal(l.name.length, 8, l.key); for (const n of l.name) assert.ok(n); }
  assert.deepEqual([1199, 1200, 1399, 1400, 1558, 1599, 1600, 2199, 2200, 3000].map((r) => levelOf(r).key),
    ['novice', 'local', 'local', 'fleet', 'fleet', 'fleet', 'regional', 'international', 'olympian', 'olympian']);
  assert.equal(levelName(1558, 'en'), 'Fleet'); assert.equal(levelName(1388, 'it'), 'Locale'); assert.equal(levelName(1558, 'ru'), 'Флот');
});

test('the next level: 42 to Regional from 1558, the bar most of the way; none past Olympian', () => {
  const n = nextLevel(1558);
  assert.equal(n.level.key, 'regional'); assert.equal(n.to, 42); assert.ok(Math.abs(n.at - 0.79) < 1e-9);
  assert.equal(nextLevel(1000).level.key, 'local'); assert.ok(nextLevel(1000).at >= 0);
  assert.equal(nextLevel(2250), null);
});
