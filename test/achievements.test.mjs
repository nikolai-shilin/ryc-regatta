// Achievements (release 7c of the 1-on-1 plan; lib/achievements.ts, components/achievements.tsx, POST
// /connect/achievements): every one named and described in every language, the database's answer checked, the line
// under one had, the card (had ones first with their day and what they were, then how far along, then the rest), the
// card asking once and showing what the database says, the route asking for the session's account alone, and your own
// player card carrying it. Run: node --test test/achievements.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from './load.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { dom, done, h, json, mount, plain, reset, serve } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const { ACHIEVEMENTS, parseAchievements, detailOf } = await import('../lib/achievements.ts');
const { AchievementsView, MyAchievements } = await import('../components/achievements.tsx');
const { ordinal } = await import('../lib/player-month.ts');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');
const { NextRequest } = await import('next/server');
const { POST } = await import('../app/connect/achievements/route.ts');

const ANSWER = {
  got: [
    { key: 'first_race', at: '2026-11-14T10:00:00Z', detail: {} },
    { key: 'podium', at: '2026-11-17T12:00:00Z', detail: { day: '2026-11-17', place: 3, of: 25 } },
    { key: 'giant', at: '2026-11-19T19:30:00Z', detail: { them: 'Tomás R.', rating: 1752, gap: 214 } },
    { key: 'made_up', at: '2026-11-19T19:30:00Z', detail: {} }, { key: 'week', at: 'not a day', detail: {} },
  ],
  progress: { week: [6, 7], month: [6, 30], venues_10: [0, 10], regional: null, rival: [2, 'x'], nope: [1, 2] },
};
beforeEach(() => { reset(); rpc.calls = []; rpc.data = null; rpc.error = null; globalThis.__sb = { rpc: async (fn) => { rpc.calls.push(fn); return { data: rpc.data, error: rpc.error }; } }; });
afterEach(done);

test('fifteen, each with a badge, and named and described in every language', () => {
  assert.deepEqual(ACHIEVEMENTS.map((a) => a.key), ['first_race', 'week', 'month', 'podium', 'day_winner', 'venues_10', 'venues_33', 'first_duel', 'first_win', 'settled', 'giant', 'run_5', 'regional', 'rival', 'hour_5']);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.icon && a.name.length === 8 && a.how.length === 8 && [...a.name, ...a.how].every((s) => s && s.trim()), a.key);
    assert.notEqual(a.how[1], a.how[0], `${a.key} in Russian`);
  }
  assert.ok(ACHIEVEMENTS.find((a) => a.key === 'venues_33').how[0].includes('of the 66 venues'));
});

test('the answer checked: an unknown key or a bad day left out, progress only as [have, need]', () => {
  const a = parseAchievements(ANSWER);
  assert.deepEqual(a.got.map((g) => g.key), ['first_race', 'podium', 'giant']);
  assert.deepEqual(a.progress, { week: [6, 7], month: [6, 30], venues_10: [0, 10], regional: null, rival: null });
  for (const bad of [null, {}, { got: 'x' }]) assert.equal(parseAchievements(bad), null);
});

test('the line under one had: the place of how many, who and their rating', () => {
  const ord = (n) => ordinal(n, 'en'), [, podium, giant] = parseAchievements(ANSWER).got;
  assert.equal(detailOf(podium, 'en', ord), '3rd of 25');
  assert.equal(detailOf(podium, 'ru', (n) => ordinal(n, 'ru')), '3-е из 25');
  assert.equal(detailOf(giant, 'en', ord), 'Tomás R. · 1752');
  assert.equal(detailOf({ key: 'first_race', at: '', detail: {} }, 'en', ord), '');
});

test('the card: how many of fifteen; had ones first, the latest first, with the day, what it was and where; then how far along; then the rest', () => {
  const w = plain(renderToStaticMarkup(h(AchievementsView, { a: parseAchievements(ANSWER), lang: 'en' })));
  const venue = venueOf(dailyRace(new Date('2026-11-17T12:00:00Z')).venue).name[0];
  assert.match(w, /^Achievements · 3 of 15/);
  const order = ['Giant-killer', 'Podium', 'First race', 'A week on the water', 'A month on the water'];
  let at = 0; for (const o of order) { const i = w.indexOf(o, at); assert.ok(i >= at, o); at = i; }
  assert.ok(w.includes(`Podium Finish in the top three of a day’s race. Got it · 17 Nov · 3rd of 25 · ${venue}`));
  assert.match(w, /Giant-killer Beat a sailor 200 or more above you\. Got it · 19 Nov · Tomás R\. · 1752/);
  assert.match(w, /A week on the water .* 6 \/ 7/);
  assert.match(w, /Ten venues Race at ten of the venues\. Not yet/);
  const html = renderToStaticMarkup(h(AchievementsView, { a: parseAchievements(ANSWER), lang: 'en' }));
  assert.match(html, /class="ach-duel got"/); assert.match(html, /class="ach-race part"/); assert.match(html, /class="ach-venues none"/);
});

test('on your card: asked once, by POST, and shown as the database says; nothing when it says nothing', async () => {
  serve([['/connect/achievements', json(ANSWER)]]);
  let v = await mount(h(MyAchievements, { lang: 'en' }));
  assert.deepEqual(dom.fetches.map((f) => [f.url, f.init.method]), [['/connect/achievements', 'POST']]);
  assert.match(v.text(), /Achievements · 3 of 15/);
  await v.unmount();
  reset({ at: Date.now() + 60_000 }); // (a later visit: a minute on, the answer is asked again)
  serve([['/connect/achievements', json(null)]]);
  v = await mount(h(MyAchievements, { lang: 'en' }));
  assert.equal(v.text(), '');
  await v.unmount();
});

test('the route: the database\'s rules for the session\'s account, checked; another site refused, an error nothing', async () => {
  const req = (origin) => new NextRequest(new URL('/connect/achievements', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', ...(origin && { origin }) } });
  rpc.data = ANSWER;
  const r = await POST(req('https://www.sailupdown.com'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await r.json()).got.map((g) => g.key), ['first_race', 'podium', 'giant']);
  assert.deepEqual(rpc.calls, ['regatta_achievements']);
  rpc.calls = [];
  assert.equal(await (await POST(req('https://evil.example'))).json(), null); assert.equal(rpc.calls.length, 0);
  rpc.error = { message: 'x' };
  assert.equal(await (await POST(req())).json(), null);
});

test('your own player card carries them, under your rating', () => {
  const src = readFileSync(new URL('../components/players-view.tsx', import.meta.url), 'utf8');
  assert.match(src, /\{mine && <MyDuelRating lang=\{lang\} \/>\}.*\n\s*\{mine \? <MyAchievements lang=\{lang\} \/> : /); // (another's card: theirs, release 8b)
});
