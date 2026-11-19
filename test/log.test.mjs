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
  // what an older log kept of the badges is left behind
  assert.deepEqual(cleanLog({ d: {}, v: {}, b: { win: 100 } }), { d: {}, v: {} });
  addDay(l, '2026-11-10', 230);
  addDay(l, '2026-11-10', 250);
  assert.equal(l.d['2026-11-10'], 230);
  // a day's venue is stamped at the day's end, so a result of that day, which knows when it was sailed, comes first
  const v = dailyVenue(new Date('2026-11-10T12:00:00Z'));
  assert.equal(l.v[v], Date.parse('2026-11-10T23:59:59Z'));
  addResult(l, { at: Date.parse('2026-11-10T09:00:00Z'), daily: '2026-11-10', boats: [{ me: true, done: true, dsq: false, secs: 228 }] });
  assert.equal(l.v[v], Date.parse('2026-11-10T09:00:00Z'));
  assert.equal(l.d['2026-11-10'], 228);
  // a custom race stamps its venue but isn't a day; a race not finished stamps nothing
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
  assert.equal(passport(m).of, 65);
});

test('the passport link carries the streak, the venues and the name, and an older link still opens', async () => {
  const { passportInLink, passportQuery, readPassport } = await import('../lib/passport-share.ts');
  const q = Object.fromEntries(new URLSearchParams(passportQuery({ streak: 5, raced: new Set(['cowes', 'kiel']), name: 'Anna' })));
  assert.deepEqual(Object.keys(q).sort(), ['n', 's', 'v', 'vs']);
  const p = readPassport(q);
  assert.equal(p.s, 5);
  assert.equal(p.v, 2);
  assert.equal(p.n, 'Anna');
  assert.equal(p.raced.filter(Boolean).length, 2);
  // a link from when it carried the badges too: the same passport, and they stay out of its address
  const old = { ...q, b: '4', bb: '1a' };
  assert.deepEqual(readPassport(old), p);
  assert.deepEqual(passportInLink(old).map(([k]) => k).sort(), ['n', 's', 'v', 'vs']);
});

test('the drills: the page lists the game\'s, in the game\'s order', async () => {
  const { readFile } = await import('node:fs/promises');
  const { DRILL_IDS, DRILLS, levelOf, levelOpen } = await import('../lib/drills.ts');
  // extras.js reaches for the page (three.js, the DOM) as it loads, so its DRILL_ORDER is read from the source
  const src = await readFile(new URL('../public/game/extras.js', import.meta.url), 'utf8');
  const order = JSON.parse(src.match(/export const DRILL_ORDER = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(DRILL_IDS, order);
  // each has its race, at the level the page says
  for (const d of DRILLS) assert.match(src, new RegExp(`\\n  ${d.id}: \\{ level: '${d.level}',`), d.id);
  // a level opens with two thirds of the stars below it, and only once the one below is open too
  assert.equal(levelOf({}), 'beginner');
  assert.equal(levelOf({ start: 3, mark: 3, layline: 2 }), 'club'); // 8 of 12
  assert.equal(levelOf({ start: 3, mark: 3, layline: 1 }), 'beginner');
  assert.ok(!levelOpen('racer', { end: 3, beat: 3, run: 3, finish: 3 })); // club's stars, but club isn't open
  assert.equal(levelOf(Object.fromEntries(DRILLS.map((d) => [d.id, 2]))), 'expert');
});

test('a 1-on-1 race finished earns the venue\'s stamp, and one not finished doesn\'t', () => {
  const l = cleanLog({});
  addResult(l, { at: 70, daily: null, oneOnOne: true, venue: 'kiel', boats: [{ me: true, done: true, dsq: false, secs: 300 }] });
  assert.equal(l.v.kiel, 70);
  addResult(l, { at: 80, daily: null, oneOnOne: true, venue: 'sydney', boats: [{ me: true, done: false, dsq: false, dnf: true, secs: null }] });
  assert.equal(l.v.sydney, undefined);
  assert.equal(Object.keys(l.d).length, 0);
});
