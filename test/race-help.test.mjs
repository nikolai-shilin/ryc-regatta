// Today's race, explained (release 6b of the 1-on-1 plan; app/[lang]/help/race): its five parts in order, today's own
// card from the day's race, the steps from the gun to the board, the sum 228 − 34 + 1 = 195 and its table, the streak as
// lib/log.ts counts it, the questions; open to search, in the sitemap, linked from the footer and the leaderboard; and in
// Russian. Run: node --test test/race-help.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { auth: { getUser: async () => ({ data: { user: null } }) } };
const page = await import('../app/[lang]/help/race/page.tsx');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf, VENUES } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');
const props = (lang) => ({ params: Promise.resolve({ lang }) });
const html = async (lang = 'en') => renderToStaticMarkup(await page.default(props(lang)));

test('five parts in order, each with its number, and the contents to reach them', async () => {
  const w = plain(await html());
  assert.match(w, /Help · today’s race One race, everyone Every day, one venue, one yacht and one wind, the same for every sailor\./);
  const order = ['1 · The day A new race at midnight', '2 · Your time From the gun to the board', '3 · Points A point for each sailor you beat', '4 · Streaks and the passport Come back tomorrow', '5 · Questions Asked often'];
  let at = 0; for (const o of order) { const i = w.indexOf(o, at); assert.ok(i > at, o); at = i; }
  for (const id of ['h-day', 'h-time', 'h-points', 'h-streak', 'h-faq']) assert.match(await html(), new RegExp(`href="#${id}"`));
});

test('today\'s own card: the day\'s venue, yacht, breeze, laps and fleet, and the way to sail it', async () => {
  const d = dailyRace(), w = plain(await html());
  assert.ok(w.includes(`Today Venue ${venueOf(d.venue).name[0]} Yacht ${yachtOf(d.yacht).name[0]}`), w.slice(w.indexOf('Today Venue'), w.indexOf('Today Venue') + 120));
  assert.ok(w.includes(`Laps ${d.laps} Fleet You and ${d.fleet - 1} boats Sail today’s race`));
  assert.ok(w.includes(`${VENUES.length} Venues in turn`));
});

test('the points: the sum, said for a screen reader too, and its table from the winner to the last', async () => {
  const h = await html(), w = plain(h);
  assert.match(h, /aria-label="228 minus 34 plus 1 equals 195"/);
  assert.match(w, /228 ranked − 34 your place \+ 1 = 195 points The sailors ranked that day, less your place, plus one\. 34th of 228 is 195 points: one for finishing, and one for each of the 194 behind you\./);
  assert.match(w, /Place Points That is 1st 228 The day’s winner 3rd 226 A podium 10th 219 The top ten 34th 195 Mid-fleet 228th 1 The last finisher still scores/);
  assert.match(h, /href="\/race#board"/);
});

test('the streak as it is counted: one day missed doesn\'t break it, two in a row do', async () => {
  assert.match(plain(await html()), /Finish today’s race every day to keep your streak; one day missed doesn’t break it, two in a row do\./);
  assert.match(readFileSync(new URL('../lib/log.ts', import.meta.url), 'utf8'), /One day missed doesn't break it, two in a row do\./);
});

test('the questions, the first open', async () => {
  const h = await html();
  assert.match(plain(h), /When does the day change\? At midnight UTC, the same moment everywhere\./);
  for (const q of ['Does a race sailed signed out count?', 'Why did my points go up after I finished?', 'Who are the other boats?', 'Can I see an earlier day’s board?', 'Can I race someone from the board?']) assert.ok(plain(h).includes(q), q);
});

test('open to search with its own address, in the sitemap, linked from the footer and the leaderboard', async () => {
  const m = await page.generateMetadata(props('en'));
  assert.equal(m.title, 'Today’s race: how it works, points and streaks');
  assert.notEqual(m.robots?.index, false);
  assert.match(String(m.alternates?.canonical), /\/help\/race$/);
  assert.match(readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8'), /\['\/help\/race', 0\.7\]/);
  assert.match(readFileSync(new URL('../components/site-chrome.tsx', import.meta.url), 'utf8'), /<FootLink href="\/help\/race">/);
  assert.match(readFileSync(new URL('../components/race-board.tsx', import.meta.url), 'utf8'), /href="\/help\/race"/);
});

test('in Russian, with no English left but names', async () => {
  const w = plain(await html('ru'));
  assert.match(w, /Помощь · гонка дня Одна гонка для всех/);
  assert.match(w, /1 · День Новая гонка в полночь/);
  assert.match(w, /228 в рейтинге − 34 твоё место \+ 1 = 195 очков/);
  assert.match(w, /один пропущенный день её не рвёт, два подряд — рвут\./);
});
