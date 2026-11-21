// The player card's tabs (release 7d of the 1-on-1 plan; components/player-tabs.tsx, components/players-view.tsx): the
// tab bar (1-on-1 on your own card alone), the 1-on-1 tab (your rivals and every 1-on-1 by month, from GET
// /connect/duels/me), today's races (the last three months day by day, from the scores API's month read, anyone's by
// their key), the venues raced most; the answer checked and grouped by month; the route asking for the session's
// account alone; and a card drawn on the server opening on the overview. Run: node --test test/player-tabs.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from './load.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { click, clock, dom, done, h, json, mount, plain, reset, serve } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const { parseMyDuels, byMonth } = await import('../lib/my-duels.ts');
const { TabBar, DuelTab, DailyTab, VenueCounts } = await import('../components/player-tabs.tsx');
const { GET } = await import('../app/connect/duels/me/route.ts');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf, VENUES } = await import('../lib/venues.ts');

const DUELS = {
  races: [
    { at: '2026-11-20T19:10:00Z', them: 'Anna K.', won: true, margin: 1.8, forfeit: false, delta: 18, venue: 'phuket', yacht: 'j70' },
    { at: '2026-11-19T18:00:00Z', them: 'Lotte V.', won: false, margin: 0.6, forfeit: false, delta: -16, venue: 'muscat', yacht: 'dragon' },
    { at: '2026-11-02T10:00:00Z', them: 'Kid', won: true, margin: null, forfeit: true, delta: null, venue: null, yacht: null },
    { at: '2026-10-03T19:30:00Z', them: 'Tomás R.', won: true, margin: 4, forfeit: false, delta: 26, venue: 'phuket', yacht: 'j70' },
    { at: 'nonsense', them: 'x' },
  ],
  rivals: [{ name: 'Anna K.', met: 11, wins: 7, losses: 4, rating: 1567, races: 30 }, { name: 'Lotte V.', met: 6, wins: 2, losses: 4, rating: null, races: null }, { met: 'x' }],
};
const MONTH = (m, k, days) => ({ m, k, pts: days.reduce((a, x) => a + x.pts, 0), place: 7, of: 40, wins: 0, podiums: days.filter((x) => x.place <= 3).length, sailed: 20, days, near: [], above: null });
beforeEach(() => { reset({ url: 'https://updown.test/players?p=kAnna-0001', at: Date.parse('2026-11-21T12:00:00Z') }); rpc.calls = []; rpc.data = null; rpc.error = null; globalThis.__sb = { rpc: async (fn) => { rpc.calls.push(fn); return { data: rpc.data, error: rpc.error }; } }; });
afterEach(done);

test('the answer checked and the races grouped by month, the latest first, with their record and change', () => {
  const d = parseMyDuels(DUELS);
  assert.equal(d.races.length, 4); assert.equal(d.rivals.length, 2);
  assert.deepEqual(byMonth(d.races).map((m) => [m.m, m.wins, m.losses, m.delta, m.races.length]), [['2026-11', 2, 1, 2, 3], ['2026-10', 1, 0, 26, 1]]);
  for (const bad of [null, {}, { races: [] }]) assert.equal(parseMyDuels(bad), null);
});

test('the tab bar: four on your own card, three on another\'s (no 1-on-1), the one chosen marked', async () => {
  let chosen = null;
  const mine = renderToStaticMarkup(h(TabBar, { lang: 'en', tab: 'over', set: () => {}, duel: true }));
  assert.match(plain(mine), /^Overview 1-on-1 Today’s races Venues$/);
  assert.match(mine, /id="pt-over" aria-selected="true"/);
  assert.match(plain(renderToStaticMarkup(h(TabBar, { lang: 'en', tab: 'over', set: () => {}, duel: false }))), /^Overview Today’s races Venues$/);
  const v = await mount(h(TabBar, { lang: 'en', tab: 'over', set: (t) => { chosen = t; }, duel: true }));
  await click(v.$('#pt-daily')); assert.equal(chosen, 'daily');
  await v.unmount();
});

test('1-on-1: your rivals with the head-to-head, then each month\'s races with who, where, the margin and the change', async () => {
  serve([['/connect/duels/me', json(DUELS)]]);
  const v = await mount(h(DuelTab, { lang: 'en' }));
  const w = v.text();
  assert.match(w, /Your rating, race by race › Rivals Anna K\. 1567 · 11 races 7–4 Lotte V\. 6 races 2–4/);
  assert.match(w, /November 2026 · 2–1 · \+2 20 Nov Beat Anna K\. Phuket · J\/70 · 1\.8 s \+18 19 Nov Lost to Lotte V\. .+ −16 2 Nov Beat Kid forfeit · just for fun/);
  assert.match(w, /October 2026 · 1–0 · \+26 3 Oct Beat Tomás R\./);
  assert.deepEqual(dom.fetches.map((f) => f.url), ['/connect/duels/me']);
  await v.unmount();
  serve([['/connect/duels/me', json({ races: [], rivals: [] })]]);
  const e = await mount(h(DuelTab, { lang: 'en' }));
  assert.match(e.text(), /No 1-on-1 races finished yet\. Find a race ›/);
  await e.unmount();
});

test('today\'s races: the last three months from the scores API, each day with where, the place and the points', async () => {
  const K = 'kAnna-0001';
  serve([[/month=2026-11/, json(MONTH('2026-11', K, [{ d: '2026-11-03', s: 400, place: 2, of: 30, pts: 29 }, { d: '2026-11-20', s: 390, place: 12, of: 40, pts: 29 }]))],
         [/month=2026-10/, json(MONTH('2026-10', K, []))], [/month=2026-09/, json(MONTH('2026-09', K, [{ d: '2026-09-30', s: 410, place: 1, of: 5, pts: 5 }]))]]);
  const v = await mount(h(DailyTab, { lang: 'en', k: K, mine: false }));
  assert.deepEqual(dom.fetches.map((f) => new URL(f.url).searchParams.get('month')), ['2026-11', '2026-10', '2026-09']);
  const d = dailyRace(new Date('2026-11-20T12:00:00Z')), w = v.text();
  assert.ok(w.startsWith(`November 2026 · 58 pts · 7th of 40 Fri 20 Nov 12th of 40 ${venueOf(d.venue).name[0]}`), w.slice(0, 120));
  assert.match(w, /Tue 3 Nov 2nd of 30 .* 29 pts September 2026 · 5 pts/);
  assert.doesNotMatch(w, /October 2026/, 'a month with no day ranked is left out');
  assert.match(v.container.innerHTML, /href="\/race\/month\?p=kAnna-0001"/);
  assert.match(v.container.innerHTML, /<li class="pod">/);
  await v.unmount();
  serve([[/month=/, () => new Error('down')]]);
  const x = await mount(h(DailyTab, { lang: 'en', k: K, mine: true }));
  assert.match(x.text(), /Today’s races can’t be loaded right now\./);
  assert.match(x.container.innerHTML, /href="\/race\/month"/);
  await x.unmount();
});

test('the venues raced most, a bar each, an unknown venue left out', () => {
  const w = plain(renderToStaticMarkup(h(VenueCounts, { lang: 'en', venues: [{ id: VENUES[2].id, n: 2 }, { id: 'atlantis', n: 9 }, { id: VENUES[0].id, n: 5 }] })));
  assert.equal(w, `Most raced ${VENUES[0].name[0]} 5 ${VENUES[2].name[0]} 2`);
});

test('the route: the database\'s answer for the session\'s account, checked; an error nothing', async () => {
  rpc.data = DUELS;
  const r = await GET();
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await r.json()).races.length, 4); assert.deepEqual(rpc.calls, ['regatta_my_duels']);
  rpc.error = { message: 'x' };
  assert.equal(await (await GET()).json(), null);
});

test('the card opens on the overview; 1-on-1 for your own alone; the passport moved to the venues tab', () => {
  const src = readFileSync(new URL('../components/players-view.tsx', import.meta.url), 'utf8');
  assert.match(src, /useEffect\(\(\) => \{ setTab\('over'\); \}, \[player\?\.k\]\);/);
  assert.match(src, /const shown: Tab = tab === 'duel' && !mine \? 'over' : tab;/);
  assert.match(src, /<TabBar lang=\{lang\} tab=\{shown\} set=\{setTab\} duel=\{mine\} \/>/);
  assert.match(src, /\{shown === 'venues' && \(<div[^>]*>\n\s*<PassportBlock/);
});
