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
  assert.deepEqual(l, { d: { '2026-11-10': 240 }, v: { cowes: 100 }, b: {} });
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
  assert.equal(passport(m).of, 30);
});

test('the ghost in the game and the replay on the result page put a boat in the same place', async () => {
  const { along, ghostGap } = await import('../public/game/track.js');
  const { posesAt } = await import('../lib/finish.ts');
  // a boat sailing up the course at 3 m/s from the gun, a point a second, finished at 200 s
  const track = []; for (let i = 0; i < 270; i++) { const T = -64 + (i + 1) * 61 / 60; track.push([0, -Math.max(0, T) * 3]); }
  const thin = track.filter((_, i) => i % 2 === 0);
  const r = { daily: null, preset: 'light', length: 'short', laps: 1, start: 1, current: false, course: {}, boats: [{ name: null, me: true, done: true, dsq: false, secs: 200, track: thin }] };
  for (const T of [-30, 0, 47.3, 120, 199]) {
    const a = along(thin, 200, 1, T), b = posesAt(r, T)[0];
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, `at ${T}`);
  }
  // at 100 s she was 300 m up; a boat there at 104 s is 4 s behind her, one there at 97 s 3 s ahead
  const g = { track: thin, secs: 200, start: 1, legT: [0, 200] };
  assert.ok(Math.abs(ghostGap(g, 0, -300, 1, 104) - 4) < 1.1);
  assert.ok(Math.abs(ghostGap(g, 0, -300, 1, 97) + 3) < 1.1);
  assert.equal(ghostGap(g, 0, -300, 0, 97), null); // before the start: no gap
});

test('the badges: what a race earned, and what the log and the drills have', async () => {
  const { raceBadges, logBadges } = await import('../lib/badges.ts');
  const { addResult, cleanLog, mergeLog } = await import('../lib/log.ts');
  const boats = (place, n = 6) => Array.from({ length: n }, (_, i) => ({ me: i === place - 1, done: true, dsq: false, secs: 200 + i, pens: 0 }));
  const log = { ocs: false, startDsq: null, startT: 1.2, gunV: 5.1, head: 3, lift: 0, pct: 96, fouls: [], hails: {}, legPlaces: [2, 5, 2], penT: 0 };
  assert.deepEqual(raceBadges({ boats: boats(2), log }).sort(), ['clean', 'comeback', 'first', 'gun', 'podium', 'shifts', 'speed'].sort());
  assert.deepEqual(raceBadges({ boats: boats(1), log: { ...log, startT: 6, lift: 1, pct: 80, hails: { 10: 1 }, legPlaces: [1, 1, 1] } }).sort(), ['first', 'podium', 'win'].sort());
  // three boats: no podium for third; over early: no gun; a dsq earns nothing
  assert.ok(!raceBadges({ boats: boats(3, 3), log }).includes('podium'));
  assert.ok(!raceBadges({ boats: boats(2), log: { ...log, ocs: true } }).includes('gun'));
  assert.deepEqual(raceBadges({ boats: boats(1).map((b) => ({ ...b, dsq: b.me })), log }), []);
  assert.deepEqual(logBadges({ streak: 7, venues: 28, of: 28, drills: { start: 3, mark: 3, beat: 3 }, drillIds: ['start', 'mark', 'beat'] }).sort(), ['drills', 'streak7', 'venues28', 'venues7'].sort());
  assert.deepEqual(logBadges({ streak: 6, venues: 6, of: 28, drills: { start: 3, mark: 2 }, drillIds: ['start', 'mark', 'beat'] }), []);
  // kept in the log at the first race that earned them, merged with the account's at the earlier
  const l = cleanLog(null);
  addResult(l, { at: 500, daily: null, venue: 'kiel', boats: boats(1), log });
  addResult(l, { at: 300, daily: null, venue: 'kiel', boats: boats(4), log });
  assert.equal(l.b.win, 500);
  assert.equal(l.b.first, 300);
  assert.equal(mergeLog(l, { d: {}, v: {}, b: { win: 100, nonsense: 1 } }).b.win, 100);
  assert.equal(cleanLog({ b: { win: 100, nonsense: 1 } }).b.nonsense, undefined);
});

test('the passport link carries which badges, and an older link only how many', async () => {
  const { passportQuery, readPassport } = await import('../lib/passport-share.ts');
  const { BADGES } = await import('../lib/badges.ts');
  const q = Object.fromEntries(new URLSearchParams(passportQuery({ streak: 5, raced: new Set(['cowes', 'kiel']), badges: ['first', 'podium', 'streak7', 'nonsense'], name: 'Anna' })));
  const p = readPassport(q);
  assert.equal(p.b, 3);
  assert.deepEqual(BADGES.filter((_, i) => p.got[i]).map((b) => b.id), ['first', 'podium', 'streak7']);
  assert.equal(p.v, 2);
  // a link from before: the count, none lit
  const old = readPassport({ s: '5', v: '2', b: '4', vs: q.vs });
  assert.equal(old.b, 4);
  assert.ok(!old.got.some(Boolean));
  assert.ok(!readPassport({ bb: '!!' }).got.some(Boolean));
  // every badge has its family
  assert.ok(BADGES.every((b) => ['result', 'skill', 'season'].includes(b.fam)));
});

test('the drills: the page lists the game\'s, in the game\'s order', async () => {
  const { readFile } = await import('node:fs/promises');
  const { DRILL_IDS } = await import('../lib/drills.ts');
  // extras.js reaches for the page (three.js, the DOM) as it loads, so its DRILL_ORDER is read from the source
  const src = await readFile(new URL('../public/game/extras.js', import.meta.url), 'utf8');
  const order = JSON.parse(src.match(/export const DRILL_ORDER = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(DRILL_IDS, order);
  for (const id of order) assert.match(src, new RegExp(`\\n  ${id}: \\{ race: `), id); // and each has its race
});
