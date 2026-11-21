// A sailor's best of and history on their card's overview (release 8a of the 1-on-1 plan; lib/history.ts,
// components/player-history.tsx): everything by month, the latest first, with each month's sum; the longest streak as
// the site counts one; the best of; anyone's card with today's race alone, your own with the 1-on-1s, the achievements
// and the streak too; the achievements asked once for the card and its history together. Run: node --test test/player-history.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './load.mjs';
import { dom, done, h, json, mount, reset, serve } from './fake-dom.mjs';

const { byMonth, longestStreak, bestOf } = await import('../lib/history.ts');
const { PlayerHistory } = await import('../components/player-history.tsx');
const { MyAchievements } = await import('../components/achievements.tsx');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf, VENUES } = await import('../lib/venues.ts');

const K = 'kAnna-0001';
const day = (d, place, of) => ({ d, s: 400, place, of, pts: of - place + 1 });
const NOV = [day('2026-11-03', 5, 40), day('2026-11-09', 3, 241), day('2026-11-20', 12, 50)], OCT = [day('2026-10-30', 2, 10)];
const DUELS = [
  { at: '2026-11-20T19:10:00Z', them: 'Anna K.', won: true, margin: 1.8, forfeit: false, delta: 18, venue: 'phuket', yacht: 'j70' },
  { at: '2026-11-19T18:00:00Z', them: 'Lotte V.', won: false, margin: 0.6, forfeit: false, delta: -16, venue: 'muscat', yacht: 'dragon' },
  { at: '2026-10-03T19:30:00Z', them: 'Tomás R.', won: true, margin: 4, forfeit: false, delta: 26, venue: 'phuket', yacht: 'j70' },
  { at: '2026-10-02T19:30:00Z', them: 'Bea S.', won: true, margin: 2, forfeit: false, delta: 12, venue: 'phuket', yacht: 'j70' },
];
const GOT = [{ key: 'podium', at: '2026-11-09T12:00:00Z', detail: { day: '2026-11-09', place: 3, of: 241 } }, { key: 'first_win', at: '2026-10-02T19:30:00Z', detail: { them: 'Bea S.', rating: 1500 } }];
const MONTH = (m, days) => ({ m, k: K, pts: days.reduce((a, x) => a + x.pts, 0), place: 9, of: 99, wins: 0, podiums: 0, sailed: 20, days, near: [], above: null });
beforeEach(() => reset({ url: 'https://updown.test/players?p=kAnna-0001', at: Date.parse('2026-11-21T12:00:00Z') }));
afterEach(done);
const api = (o = {}) => serve([[/month=2026-11/, json(MONTH('2026-11', NOV))], [/month=2026-10/, json(MONTH('2026-10', OCT))], [/month=2026-09/, json(MONTH('2026-09', []))],
  ['/connect/duels/me', json({ races: DUELS, rivals: [] })], ['/connect/achievements', json({ got: GOT, progress: {} })], ...(o.extra || [])]);

test('everything by month, the latest first, with each month\'s sum; on one day the achievement, then the 1-on-1, then the race', () => {
  const m = byMonth({ days: [...NOV, ...OCT], duels: DUELS, got: GOT });
  assert.deepEqual(m.map((x) => [x.m, x.days, x.pts, x.wins, x.losses, x.delta, x.got]), [['2026-11', 3, 36 + 239 + 39, 1, 1, 2, 1], ['2026-10', 1, 9, 2, 0, 38, 1]]);
  assert.deepEqual(m[0].entries.map((e) => `${e.at.slice(5, 10)} ${e.kind}`), ['11-20 duel', '11-20 day', '11-19 duel', '11-09 ach', '11-09 day', '11-03 day']);
});

test('the longest streak as the site counts one: one day missed doesn\'t break it, two in a row do', () => {
  assert.deepEqual(longestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-08', '2026-11-09']), { n: 4, end: '2026-11-05' });
  assert.equal(longestStreak([]), null);
  assert.deepEqual(longestStreak(['2026-11-03', 'x', '2026-11-03']), { n: 1, end: '2026-11-03' });
});

test('the best of: the best place, the biggest win, the longest run of wins, the venue sailed most', () => {
  const b = bestOf({ days: [...NOV, ...OCT, day('2026-11-11', 3, 12)], duels: DUELS, venues: [{ id: 'cowes', n: 3 }, { id: 'phuket', n: 11 }] });
  assert.deepEqual([b.place.d, b.win.them, b.run, b.venue.id], ['2026-10-30', 'Tomás R.', 2, 'phuket']); // (two in October, then a loss)
  assert.equal(bestOf({ days: [day('2026-11-01', 3, 12), day('2026-11-02', 3, 241)] }).place.of, 241, 'equal places: the bigger field');
});

test('another sailor\'s card: their best place and today\'s races by month, nothing of yours asked', async () => {
  api();
  const v = await mount(h(PlayerHistory, { lang: 'en', k: K, mine: false, log: null, venues: [{ id: VENUES[0].id, n: 4 }] }));
  const w = v.text(), d = dailyRace(new Date('2026-10-30T12:00:00Z'));
  assert.ok(w.startsWith(`Best of Best place, today’s race 2nd of 10 · ${venueOf(d.venue).name[0]} · 30 Oct Most sailed ${VENUES[0].name[0]} · 4 races November 2026 3 days of today’s race · 314 pts`), w.slice(0, 220));
  assert.match(w, /October 2026 1 day of today’s race · 9 pts 2 2nd of 10 in today’s race 30 Oct/);
  assert.ok(!dom.fetches.some((f) => f.url.startsWith('/connect/')), 'your own reads: not on another\'s card');
  await v.unmount();
});

test('your own card: the 1-on-1s and achievements mixed in by day, the biggest win, the run and the streak', async () => {
  api();
  const log = { d: { '2026-11-17': 1, '2026-11-18': 1, '2026-11-20': 1 }, v: {} };
  const v = await mount(h(PlayerHistory, { lang: 'en', k: K, mine: true, log, venues: [] }));
  const w = v.text();
  assert.match(w, /Biggest 1-on-1 win \+26 · Tomás R\. · 3 Oct Longest streak 3 days · to 20 Nov Best 1-on-1 run 2 wins in a row/);
  assert.match(w, /November 2026 3 days of today’s race · 314 pts · 1-on-1 1–1, \+2 · an achievement W Beat Anna K\. 20 Nov · Phuket · J\/70 · 1\.8 s \+18 12 12th of 50 in today’s race/);
  assert.match(w, /★ Podium 9 Nov · achievement · 3rd of 241 3 3rd of 241 in today’s race/);
  assert.match(w, /October 2026 1 day of today’s race · 9 pts · 1-on-1 2–0, \+38 · an achievement/);
  await v.unmount();
});

test('the card\'s achievements and its history ask for them once together', async () => {
  reset({ url: 'https://updown.test/players?p=kAnna-0001', at: Date.parse('2026-11-21T13:00:00Z') }); // (a later visit: the last one's answer is stale)
  api();
  const a = await mount(h('div', null, h(MyAchievements, { lang: 'en' }), h(PlayerHistory, { lang: 'en', k: K, mine: true, log: null, venues: [] })));
  assert.equal(dom.fetches.filter((f) => f.url === '/connect/achievements').length, 1);
  await a.unmount();
});

test('on the overview, after today\'s race', () => {
  const src = readFileSync(new URL('../components/players-view.tsx', import.meta.url), 'utf8');
  assert.match(src, /<PlayerHistory lang=\{lang\} k=\{player\.k\} mine=\{mine\} log=\{log\} venues=\{player\.venues\} theirs=\{player\.achievements \?\? \[\]\} \/>/);
  assert.ok(src.indexOf('<PlayerHistory') > src.indexOf("t('Today’s race', 'Гонка дня'") && src.indexOf('<PlayerHistory') < src.indexOf('<IconKite'));
});
