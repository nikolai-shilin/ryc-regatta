// 1-on-1 races, explained (release 7a of the 1-on-1 plan; app/[lang]/help/duel): its six parts in order, the three ways
// to a start line with the matchmaker's real bands, the first 1-on-1's four cards in the game's own words, the table of
// what a race is worth drawn from lib/elo.ts, the seven levels from lib/levels.ts, fair play as the database rules it,
// the questions; open to search, in the sitemap, linked from /duel, the result's rating, the leaderboard's 1-on-1 tab and
// the footer; and in Russian. Run: node --test test/duel-help.test.mjs
import { mock } from './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { auth: { getUser: async () => ({ data: { user: null } }) } };
const page = await import('../app/[lang]/help/duel/page.tsx');
const { stakes } = await import('../lib/elo.ts');
const { DuelRatingView } = await import('../components/duel-rating.tsx');
const props = (lang) => ({ params: Promise.resolve({ lang }) });
const html = async (lang = 'en') => renderToStaticMarkup(await page.default(props(lang)));
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('six parts in order, each with its number, and the contents to reach them', async () => {
  const w = plain(await html());
  assert.match(w, /Help · 1-on-1 races One race, one rival How to find someone to race/);
  const order = ['1 · Find a race Three ways to a start line', '2 · Your first 1-on-1 Four cards before your first', '3 · In the race The race screen you know', '4 · The rating Beat someone better, gain more', '5 · Fair play When something goes wrong', '6 · Questions Asked often'];
  let at = 0; for (const o of order) { const i = w.indexOf(o, at); assert.ok(i > at, o); at = i; }
  for (const id of ['h-find', 'h-first', 'h-race', 'h-rating', 'h-fair', 'h-faq']) assert.match(await html(), new RegExp(`href="#${id}"`));
});

test('the three ways, with the matchmaker\'s own bands and the easy first three as the database picks them', async () => {
  const w = plain(await html());
  assert.match(w, /A sailor at your level Find a race › The site looks for a sailor within 100 of your rating, within 200 after 20 seconds and 350 after 45\./);
  assert.match(w, /Someone you know Challenge a friend ›/); assert.match(w, /Anyone who wants it Post an open call ›/);
  assert.match(w, /Your first three rated races are one lap of a short windward–leeward in a medium breeze, in a J\/70, at one of the five quickest venues to load\./);
});

test('the first 1-on-1\'s four cards, in the game\'s own words', async () => {
  const w = plain(await html()), game = src('public/play/index.html');
  for (const line of ['Just the two of you: who leads, and the gap in metres and seconds. Green while you gain, orange while you lose.', 'Before the gun the start waits a minute for either of you to come back. After the gun, leaving loses the race.', 'Both signed in, the race counts for the 1-on-1 rating, and your first five count double. Signed out, it’s just for fun.', 'At the finish, one tap starts the next race on the same course, and the result page shows where the time went.']) {
    assert.ok(w.includes(line), line); assert.ok(game.includes(line), `the game says it too: ${line}`);
  }
  assert.match(w, /01 The order panel .* 02 Leaving .* 03 What it’s worth .* 04 Rematch/);
  assert.match(w, /Good luck! · Nice start · Rematch\? · GG/); assert.ok(src('public/game/match-ui.js').includes("['Good luck!', 'Nice start', 'Rematch?', 'GG']"));
});

test('the rating: the facts, the table from lib/elo.ts, the formula and the seven levels', async () => {
  const w = plain(await html());
  assert.match(w, /1500 Everyone starts here .* ~ Five races count double For your first 5 every win and loss counts double \(64 in place of 32\)/);
  for (const [name, d] of [['300 below you', -300], ['Your level', 0], ['300 above you', 300]]) {
    const s = stakes(1500, 1500 + d, 5);
    assert.ok(w.includes(`${name} ${Math.round(s.chance * 100)}% +${s.win} −${s.loss}`), name);
  }
  assert.ok(w.includes('Your level 50% +16 −16'));
  assert.match(w, /Your chance is 1 ÷ \(1 \+ 10\^\(difference ÷ 400\)\)\. A win earns 32 ×/);
  assert.match(w, /Seven levels, 200 apart Olympian 2200 and up International 2000–2199 National 1800–1999 Regional 1600–1799 Fleet 1400–1599 Local 1200–1399 Novice under 1200/);
});

test('fair play, as the rules are: the start waits, leaving loses, the forfeit, disagreement, three a day, not rated', async () => {
  const w = plain(await html());
  assert.match(w, /A screen gone before the gun The start waits a minute for it: .* The start waits/);
  assert.match(w, /Leaving after the gun .* A loss/);
  assert.match(w, /A guest’s screen unheard for 30 seconds after the gun gives the race up; .* Forfeit at 0:30/);
  assert.match(w, /Three rated races a day for any two sailors\. .* 3 a day/);
  assert.match(src('public/game/match.js'), /const FORFEIT_MS = 30000;/); assert.match(src('public/game/match.js'), /const START_WAIT_MS = 60000;/);
});

test('the questions, the first open', async () => {
  const h = await html();
  assert.match(plain(h), /Does a 1-on-1 change my points in today’s race\? No\./);
  for (const q of ['Why wasn’t my race rated?', 'When are most sailors looking?', 'Do I have to keep the page open while I look?', 'Where do I see my rating?']) assert.ok(plain(h).includes(q), q);
});

test('open to search, in the sitemap, linked from /duel, the result\'s rating, the leaderboard\'s 1-on-1 tab and the footer', async () => {
  const m = await page.generateMetadata(props('en'));
  assert.equal(m.title, '1-on-1 races: how they work and how the rating moves');
  assert.notEqual(m.robots?.index, false);
  assert.match(String(m.alternates?.canonical), /\/help\/duel$/);
  assert.match(src('app/sitemap.ts'), /\['\/help\/duel', 0\.7\]/);
  assert.match(src('components/site-chrome.tsx'), /<FootLink href="\/help\/duel">/);
  assert.match(src('components/race-board.tsx'), /href="\/help\/duel"/);
  assert.match(src('components/duel-finder.tsx'), /href="\/help\/duel"/); // (the 1-on-1 page's hero)
  const rated = renderToStaticMarkup(DuelRatingView({ r: { status: 'rated', side: 'host', me: { before: 1540, after: 1558, delta: 18, races: 9, won: true }, them: { name: 'Anna K.', before: 1600, after: 1582, delta: -18, races: 20 } }, lang: 'en' }));
  assert.match(rated, /href="\/help\/duel#h-rating">How 1-on-1 races work ›/);
  const unrated = renderToStaticMarkup(DuelRatingView({ r: { status: 'unrated', side: 'host', reason: 'limit' }, lang: 'en' }));
  assert.match(unrated, /href="\/help\/duel#h-fair">How 1-on-1 races work ›/);
});

test('in Russian, with no English left but names', async () => {
  const w = plain(await html('ru'));
  assert.match(w, /Помощь · гонки 1 на 1 Одна гонка, один соперник/);
  assert.match(w, /1 · Найти гонку Три пути к старту/);
  assert.match(w, /Твой уровень 50% \+16 −16/);
  assert.match(w, /Олимпийский 2200 и выше/);
});
