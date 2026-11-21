// Your 1-on-1 rating, its own page (release 7b of the 1-on-1 plan; app/[lang]/duel/rating, lib/rating-page.ts): the
// database's answer checked, the record against stronger, level and weaker sailors, why each race moved the rating with
// its sum, the page's head, chart, levels, spread and last five; signed out, never rated, the database down; not for
// search, linked from your rating on /duel, the leaderboard's 1-on-1 tab and the help page; and in Russian.
// Run: node --test test/rating-page.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 21, 12) });
mock('lib/supabase/server.ts', 'export const supabaseServer = async () => globalThis.__supabase;');
const page = await import('../app/[lang]/duel/rating/page.tsx');
const { parseRatingPage, bands, whyMoved } = await import('../lib/rating-page.ts');
const { rate } = await import('../lib/elo.ts');

// a history made by lib/elo.ts's own sums: five provisional races, then three settled ones
const opp = [['Rival A', 1500, true], ['Rival B', 1560, false], ['Rival C', 1450, true], ['Rival D', 1700, true], ['Rival E', 1520, false], ['Tomás R.', 1752, true], ['Lotte V.', 1556, false], ['Anna K.', 1585, true]];
const history = []; let me = { rating: 1500, races: 0 };
opp.forEach(([them, r, won], i) => {
  const c = rate(me, { rating: r, races: 20 }, won).a;
  history.push({ at: `2026-11-${String(10 + i).padStart(2, '0')}T18:00:00Z`, before: c.before, after: c.after, delta: c.delta, won, k: c.k, chance: Math.round(c.chance * 1e4) / 1e4, n: i, them, them_before: r, margin: 1.8, forfeit: i === 2, venue: 'phuket', yacht: 'j70' });
  me = { rating: c.after, races: me.races + 1 };
});
const RAW = { rating: me.rating, races: 8, wins: 5, losses: 3, best: Math.max(...history.map((h) => h.after)), lowest: 1500, place: 3, of: 12, below: 9, today: 0,
  levels: [0, 1, 6, 4, 1, 0, 0], spread: [{ at: 1350, n: 1 }, { at: 1450, n: 3 }, { at: 1500, n: 3 }, { at: 1600, n: 4 }, { at: 1800, n: 1 }], history: [...history].reverse() };
const session = (signed, rpc = { data: RAW, error: null }) => { globalThis.__supabase = { auth: { getClaims: async () => ({ data: signed ? { claims: { sub: 'u1' } } : null }) }, rpc: async (fn) => { globalThis.__asked = fn; return rpc; } }; };
const html = async (lang = 'en') => renderToStaticMarkup(await page.default({ params: Promise.resolve({ lang }) }));

test('the answer checked: the history earliest first, a malformed race left out, nothing at all for no answer', () => {
  const d = parseRatingPage({ ...RAW, history: [...RAW.history, { at: 'x' }, { ...RAW.history[0], chance: 2 }] });
  assert.equal(d.history.length, 8);
  assert.deepEqual(d.history.map((h) => h.them), opp.map((o) => o[0]));
  assert.equal(d.history.at(-1).after, d.rating, 'the last race ends where the rating stands');
  assert.equal(d.history.reduce((a, h) => a + h.delta, 1500), d.rating, 'the changes add up to the rating');
  for (const bad of [null, false, {}, { rating: 'x', races: 1 }]) assert.equal(parseRatingPage(bad), null);
  assert.deepEqual(parseRatingPage({ rating: 1500, races: 0 }).levels, [0, 0, 0, 0, 0, 0, 0]);
});

test('against whom: stronger, about your level and weaker, each with the race that gained most', () => {
  const b = bands(parseRatingPage(RAW).history);
  assert.deepEqual(b.map((x) => [x.key, x.wins, x.losses]), [['above', 2, 0], ['level', 3, 3], ['below', 0, 0]]);
  assert.equal(b[0].best.them, 'Rival D', 'a first-five win counts double, so it gained most');
});

test('why it moved: the gap, the chance and the sum, the same numbers lib/elo.ts worked it out from', () => {
  const d = parseRatingPage(RAW), anna = d.history.at(-1), lotte = d.history.at(-2), first = d.history[0];
  const p = Math.round(anna.chance * 100);
  assert.equal(whyMoved(anna, 'en'), `Anna K. was ${1585 - anna.before} above you: your chance was ${p}%. A win earns 32 × ${100 - p}% = ${anna.delta}.`);
  assert.match(whyMoved(lotte, 'en'), /^Lotte V\. was \d+ (above|below) you: your chance was \d+%\. A loss costs 32 × \d+% = \d+\.$/);
  assert.equal(whyMoved(first, 'en'), 'Rival A was level with you: your chance was 50%. A win earns 64 × 50% = 32. Race 1 of your first five: counted double.');
  assert.equal(whyMoved({ ...anna, them: null }, 'ru').slice(0, 9), 'Соперник ');
});

test('the page: the rating, its level and record, the place, the chart with the first five shaded, the levels, the spread', async () => {
  session(true);
  const h = await html(), w = plain(h);
  assert.equal(globalThis.__asked, 'regatta_rating_page');
  assert.match(w, new RegExp(`Your 1-on-1 rating ${RAW.rating} Fleet 5 won · 3 lost #3 of 12`));
  assert.match(w, /Place #3 of 12 settled sailors Record 5–3 8 rated · 63% won Best ever \d+ lowest 1500 To Regional \d+ points to the next level/);
  assert.match(w, /1-on-1 rating Today’s race Your month/);
  assert.match(w, /All 8 rated races/);
  assert.equal((h.match(/<circle class="rp-(up|down)"/g) || []).length, 8, 'a point a race');
  assert.match(h, /<rect class="rp-first"/); assert.match(w, /FIRST FIVE · ×2/);
  assert.match(w, /The seven levels Olympian 2200\+ 0 International 2000–2199 0 National 1800–1999 1 Regional 1600–1799 4 Fleet 1400–1599 6 Local 1200–1399 1 Novice < 1200 0/);
  assert.match(h, /<li class="me" aria-current="true"><b>Fleet<\/b>/);
  assert.match(w, /Among 12 sailors .* Ahead of 82% of the settled sailors/);
});

test('the record by opponent, and the last five races newest first with why each moved it', async () => {
  session(true);
  const w = plain(await html());
  assert.match(w, /Against whom Stronger · 100 or more above 2–0 Your best: Rival D, 1700, on 13 Nov: \+\d+\. About your level · within 100 3–3 .* Weaker · 100 or more below 0–0 None yet\./);
  const why = w.slice(w.indexOf('Why it moved'));
  assert.deepEqual([...why.matchAll(/\d+ Nov (\S+ \S+) ·/g)].map((m) => m[1]), ['Anna K.', 'Lotte V.', 'Tomás R.', 'Rival E', 'Rival D']);
  assert.match(why, /Anna K\. · 1585 Won · 1\.8 s Phuket \+\d+ \d+ Anna K\. was \d+ above you/);
  assert.match(why, /How the rating works › Everyone’s ratings ›/);
});

test('signed out: a way to sign in, nothing asked; never rated: where everyone starts; the database down: said so', async () => {
  session(false); globalThis.__asked = null;
  let w = plain(await html());
  assert.equal(globalThis.__asked, null);
  assert.match(w, /The 1-on-1 rating is kept for sailors who are signed in/);
  assert.match(await html(), /href="\/sign-in\?next=%2Fduel%2Frating"/);
  session(true, { data: { ...RAW, rating: 1500, races: 0, wins: 0, losses: 0, place: null, below: null, history: [] }, error: null });
  w = plain(await html());
  assert.match(w, /Your 1-on-1 rating ~1500 Race 0 of 5/); assert.match(w, /No rated races yet: everyone starts at 1500\./);
  assert.doesNotMatch(w, /Against whom|Why it moved/);
  session(true, { data: null, error: { message: 'x' } });
  assert.match(plain(await html()), /Your rating can’t be loaded right now\./);
});

test('not for search; linked from your rating on /duel, the leaderboard\'s 1-on-1 tab and the help page', async () => {
  const m = await page.generateMetadata({ params: Promise.resolve({ lang: 'en' }) });
  assert.equal(m.title, 'Your 1-on-1 rating'); assert.equal(m.robots?.index, false);
  for (const f of ['components/my-duel-rating.tsx', 'components/race-board.tsx', 'app/[lang]/help/duel/page.tsx']) assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /href="\/duel\/rating"/, f);
});

test('in Russian', async () => {
  session(true);
  const w = plain(await html('ru'));
  assert.match(w, new RegExp(`Твой рейтинг 1 на 1 ${RAW.rating} Флот 5 побед · 3 поражений №3 из 12`));
  assert.match(w, /Против кого/); assert.match(w, /Anna K\. — на \d+ выше: шансы \d+%\. Победа даёт 32 × \d+% = \d+\./);
});
