// Achievements on every player's card (release 8b of the 1-on-1 plan: release 7's leftovers): the scores API's card
// carries them (lib/players.ts getPlayer, each checked; [] from an API before them); another sailor's card lists the
// ones they have, with the count of all, and mixes them into their history; your own card keeps its own read, with how
// far along you are. Run: node --test test/card-achievements.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { plain } from './fake-dom.mjs';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 21, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const players = await import('../app/[lang]/players/page.tsx');
const { getPlayer } = await import('../lib/players.ts');
const { AchievementsView } = await import('../components/achievements.tsx');

const K = 'kAnna-0001';
const GOT = [{ key: 'first_race', at: '2026-11-14T10:00:00Z', detail: {} }, { key: 'giant', at: '2026-11-19T19:30:00Z', detail: { them: 'Tomás R.', rating: 1752 } }];
const card = (o = {}) => ({ k: K, name: 'Anna Petrova', ph: null, fl: 'GB', pts: 1240, n: 30, fin: 27, wins: 4, podiums: 11, days: 12, last: '2026-11-17', yacht: 'j70',
  first: '2026-10-01', dsq: 0, best: 1, fleet: 5, daily: { n: 9, days: 8, wins: 2, podiums: 5 }, yachts: [{ id: 'j70', n: 20 }], venues: [{ id: 'cowes', n: 3 }], boat: null, ...o });
let answer = card({ achievements: [...GOT, { key: 'nope', at: '2026-11-01T00:00:00Z' }, { key: 'week', at: 'never' }] });
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  if (u.searchParams.has('player')) return new Response(JSON.stringify(answer));
  if (u.searchParams.has('players')) return new Response(JSON.stringify({ total: 1, page: 1, pages: 1, per: 50, rows: [card()] }));
  return new Response('{}', { status: 404 });
};

test('the card carries them, each checked; an API before them gives none', async () => {
  assert.deepEqual((await getPlayer(K)).achievements.map((g) => g.key), ['first_race', 'giant']);
  answer = card();
  assert.deepEqual((await getPlayer(K)).achievements, []);
  answer = card({ achievements: GOT });
});

test('another sailor\'s card: the ones they have, with the count of all, and nothing they\'re short of', async () => {
  const w = plain(renderToStaticMarkup(await players.default({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({ p: K }) })));
  assert.match(w, /Achievements · 2 of 15 ▲ 1-on-1 Giant-killer Beat a sailor 200 or more above you\. Got it · 19 Nov · Tomás R\. · 1752 1 Today’s race First race Finish your first race\. Got it · 14 Nov/);
  assert.doesNotMatch(w, /Not yet/);
  const html = renderToStaticMarkup(h(AchievementsView, { a: { got: GOT, progress: { week: [6, 7] } }, lang: 'en', had: true }));
  assert.equal((html.match(/<li /g) || []).length, 2);
});

test('their history mixes them in; your own card keeps its own read', () => {
  const view = readFileSync(new URL('../components/players-view.tsx', import.meta.url), 'utf8');
  assert.match(view, /\{mine \? <MyAchievements lang=\{lang\} \/> : player\.achievements\?\.length \? <AchievementsView a=\{\{ got: player\.achievements, progress: \{\} \}\} lang=\{lang\} had \/> : null\}/);
  assert.match(view, /theirs=\{player\.achievements \?\? \[\]\}/);
  assert.match(readFileSync(new URL('../components/player-history.tsx', import.meta.url), 'utf8'), /got = mine \? \(ach \? ach\.got : \[\]\) : theirs;/);
});
