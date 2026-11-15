// The player's log (lib/log.ts): the days they finished today's race and the venues they've raced, merged from the
// game's records and the account's, and the streak and the passport worked out from it. In Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { addDay, addResult, cleanLog, mergeLog, streakOf, passport, shiftDay } = await import('../lib/log.ts');
const { dailyVenue } = await import('../lib/race.ts');

const days = (today, ...back) => back.map((n) => shiftDay(today, -n));

test('the streak: days in a row, one missed day forgiven, two not', () => {
  const T = '2026-11-15';
  assert.deepEqual(streakOf(days(T, 0, 1, 2), T), { n: 3, today: true, risk: false });
  // today still to sail: the streak stands on yesterday's
  assert.deepEqual(streakOf(days(T, 1, 2), T), { n: 2, today: false, risk: false });
  // yesterday missed: still standing, but today's is needed
  assert.deepEqual(streakOf(days(T, 2, 3, 4), T), { n: 3, today: false, risk: true });
  // a day missed in the middle doesn't break it; two do
  assert.equal(streakOf(days(T, 0, 2, 3), T).n, 3);
  assert.equal(streakOf(days(T, 0, 3, 4), T).n, 1);
  // two days gone: no streak
  assert.equal(streakOf(days(T, 3, 4), T).n, 0);
  assert.equal(streakOf([], T).n, 0);
});

test('the log: a day at its fastest, a venue at its first race, from the game’s records and the account’s', () => {
  const l = cleanLog({ d: { '2026-11-10': 240, 'junk': 3 }, v: { cowes: 100, atlantis: 5 } });
  assert.deepEqual(l, { d: { '2026-11-10': 240 }, v: { cowes: 100 } });
  addDay(l, '2026-11-10', 230);
  addDay(l, '2026-11-10', 250);
  assert.equal(l.d['2026-11-10'], 230);
  // a day's venue is stamped at the day's end, so a result of that day, which knows when it was sailed, comes first
  const v = dailyVenue(new Date('2026-11-10T12:00:00Z'));
  assert.equal(l.v[v], Date.parse('2026-11-10T23:59:59Z'));
  addResult(l, { at: Date.parse('2026-11-10T09:00:00Z'), daily: '2026-11-10', boats: [{ me: true, done: true, dsq: false, secs: 228 }] });
  assert.equal(l.v[v], Date.parse('2026-11-10T09:00:00Z'));
  assert.equal(l.d['2026-11-10'], 228);
  // a free race stamps its venue but isn't a day; a race not finished stamps nothing
  addResult(l, { at: 50, daily: null, venue: 'kiel', boats: [{ me: true, done: true, dsq: false, secs: 300 }] });
  addResult(l, { at: 60, daily: null, venue: 'sydney', boats: [{ me: true, done: false, dsq: false, secs: null }] });
  assert.equal(l.v.kiel, 50);
  assert.equal(l.v.sydney, undefined);
  assert.equal(Object.keys(l.d).length, 1);
  // merged with the account's: every day at the faster time, every venue at the earlier race
  const m = mergeLog(l, { d: { '2026-11-10': 229, '2026-11-11': 260 }, v: { cowes: 40, kiel: 90 } });
  assert.deepEqual(m.d, { '2026-11-10': 228, '2026-11-11': 260 });
  assert.equal(m.v.cowes, 40);
  assert.equal(m.v.kiel, 50);
  assert.deepEqual([...passport(m).raced].sort(), ['cowes', 'kiel', v].sort());
  assert.equal(passport(m).of, 28);
});
