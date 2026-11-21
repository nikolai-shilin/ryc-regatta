// The boards (components/race-board.tsx): on the race hub, a sheet at /race#board with today's race alone behind radio
// tabs, Today (every ranked sailor's best, the points) and the month (the standings, your month), and the way to the 1-on-1
// rating; the 1-on-1 rating's own list (settled first with their level and record, then provisional ones with ~); each
// board's empty and down states; the 1-on-1 board read as it is (lib/duel-board.ts); /race/rating sent to /race#board;
// /race carrying the sheet; and the two ratings side by side on /rating. Run: node --test test/race-board.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { plain } from './fake-dom.mjs';

const TODAY = '2026-11-18';
clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { auth: { getUser: async () => ({ data: { user: null } }) } };
const { RaceBoard, DuelList } = await import('../components/race-board.tsx');
const { parseDuelBoard } = await import('../lib/duel-board.ts');
const { tx } = await import('../lib/lang.ts');

const row = (k, name, s, pts, fl = null) => ({ k, name, ph: null, fl, s, p: null, pts, n: 1 });
const mrow = (k, name, pts, days) => ({ k, name, ph: null, fl: null, pts, days, wins: 0, podiums: 0 });
const RATING = { d: TODAY, w: null, races: 12, guests: 3, rows: [row('a', 'Anna', 65.4, 3, 'au'), row('b', 'Bo', 70, 2), row('c', 'Cy', 80.5, 1)],
  month: { m: '2026-11', days: 9, rows: [mrow('a', 'Anna', 40, 9), mrow('b', 'Bo', 12, 3)] }, days: [TODAY] };
const DUEL = { settled: 2, provisional: 1, rows: [{ name: 'Cara M.', rating: 1620, races: 12, wins: 8, losses: 4 }, { name: 'Alex P.', rating: 1558, races: 41, wins: 24, losses: 17 }, { name: 'Bea K.', rating: 1700, races: 3, wins: 3, losses: 0 }] };
const board = (o = {}) => { const lang = o.lang ?? 'en'; return renderToStaticMarkup(h(RaceBoard, { lang, t: tx(lang), day: TODAY, venue: 'Cowes', data: RATING, ...o })); };
const duelList = (duel, lang = 'en') => renderToStaticMarkup(h(DuelList, { lang, t: tx(lang), duel }));

test('a sheet at #board with today\'s race alone, two tabs, Today chosen: radio buttons, so it works without script', () => {
  const html = board();
  assert.match(html, /<section id="board" class="rb bc" aria-labelledby="rb-h">/);
  assert.match(plain(html), /^Today’s race · the leaderboard × Wednesday,? 18 November · Cowes Today November 1 Anna/);
  assert.doesNotMatch(html, /rb-t-duel/, 'the 1-on-1 rating is a rating of its own');
  assert.match(plain(html), /The 1-on-1 rating is a board of its own, moved only by races against one other sailor: Both ratings ›$/);
  assert.match(html, /href="\/rating"/);
  assert.match(html, /<input type="radio" id="rb-t-day" class="rb-radio" name="rb-tab" checked=""\/><label for="rb-t-day" class="rb-tab">Today<\/label>/);
  assert.match(html, /id="rb-t-month" class="rb-radio" name="rb-tab"\/>/);
  assert.match(html, /<a class="rb-close" href="#" aria-label="Close the leaderboard">/);
});

test('Today: every ranked sailor\'s best time, gap and points; the races signed out; the days before', () => {
  const html = board(), words = plain(html);
  assert.match(words, /1 Anna 1:05\.4 \+3 2 Bo 1:10\.0 \+4\.6 \+2 3 Cy 1:20\.5 \+15\.1 \+1/);
  assert.match(words, /3 races were sailed signed out and don’t rank\. Beat these times The days before ›/);
  assert.match(html, /href="\/race\/rating\/2026-11-17"/);
});

test('the month: the standings with days and points, and how the points work', () => {
  const words = plain(board()); // (a count-up says its number twice: once for a screen reader)
  assert.match(words, /1 Anna 9 days 40 40 pts 2 Bo 3 days 12 12 pts How the points work Each day, your best time in that day’s race counts\./);
});

test('the 1-on-1 rating: settled ones placed, with level and record; provisional ones with ~; what counts', () => {
  const words = plain(duelList(parseDuelBoard(DUEL)));
  assert.match(words, /1 Cara M\. Regional · 8–4 1620 2 Alex P\. Fleet · 24–17 1558 ~ Bea K\. provisional · 3–0 ~1700/);
  assert.match(words, /2 settled · 1 still on their first five rated races \(~\)\. Only races against one other sailor count here\. Find a 1-on-1 race/);
});

test('nobody yet on each board, and a board that can\'t be had, said as such; in Russian too', () => {
  const empty = plain(board({ data: { ...RATING, rows: [], guests: 0, month: { m: '2026-11', days: 0, rows: [] } } }));
  assert.match(empty, /No ranked times yet today\. The first to finish takes the top\. Sail today’s race/);
  assert.match(empty, /No points yet this month\./);
  assert.match(plain(duelList({ settled: 0, provisional: 0, rows: [] })), /No 1-on-1 ratings yet\. A rating starts at 1500 and settles after five rated races/);
  const down = plain(board({ data: null }));
  assert.equal((down.match(/The leaderboard can’t be loaded right now/g) || []).length, 2);
  assert.match(plain(duelList(null)), /The leaderboard can’t be loaded right now/);
  assert.match(plain(board({ lang: 'ru' })), /^Гонка дня · рейтинг × среда, 18 ноября · Cowes Сегодня Ноябрь 1 Anna/);
});

test('the 1-on-1 board read as it is; anything malformed left out', () => {
  assert.deepEqual(parseDuelBoard(DUEL).rows.map((r) => r.name), ['Cara M.', 'Alex P.', 'Bea K.']);
  assert.deepEqual(parseDuelBoard({ settled: '2', provisional: 'x', rows: [{ name: 'X', rating: '1500', races: 1, wins: 0, losses: 0 }, null] }), { settled: 2, provisional: 0, rows: [] });
  assert.equal(parseDuelBoard(null), null); assert.equal(parseDuelBoard({ rows: 'no' }), null);
});

test('/race/rating is sent to the race hub\'s board for good; the days before keep their pages; it leaves the sitemap', () => {
  const cfg = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(cfg, /\{ source: '\/race\/rating', destination: '\/race#board', permanent: true \}/);
  assert.ok(!readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8').includes("'/race/rating'"));
  assert.match(readFileSync(new URL('../app/[lang]/race/rating/[day]/page.tsx', import.meta.url), 'utf8'), /redirect\(lang === 'en' \? '\/race#board' : `\/race\?lang=\$\{lang\}#board`\)/);
});

test('/race carries the sheet, and its card\'s "Full rating" opens it', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.invalid'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  globalThis.fetch = async (u) => {
    const url = String(u);
    if (url.includes('regatta_rating_board')) return Response.json(DUEL);
    if (url.includes('?day=')) return Response.json(RATING);
    return Response.json(null);
  };
  const page = await import('../app/[lang]/race/page.tsx');
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ lang: 'en' }) }));
  assert.match(html, /<a href="#board" class="lb-more">/);
  assert.match(html, /<section id="board" class="rb bc"/);
  assert.match(plain(html), /1 Anna 1:05\.4/);
  assert.doesNotMatch(plain(html), /Cara M\./, 'the 1-on-1 rating lives on /rating');
});

test('/rating: the two ratings side by side, each with what it measures; the header\'s Leaderboard leads there', async () => {
  const page = await import('../app/[lang]/rating/page.tsx');
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ lang: 'en' }) })), words = plain(html);
  assert.match(words, /Two ratings, kept apart/);
  assert.match(html, /<section id="duel" class="rtg-col rtg-duel"/); assert.match(html, /<section id="race" class="rtg-col rtg-race"/);
  assert.match(words, /1-on-1 rating · Elo Who wins head to head Everyone starts at 1500\..* 1 Cara M\. Regional · 8–4 1620/);
  assert.match(words, /Today’s race · points Wednesday,? 18 November · .+ Everyone sails the same race today.* Today November 1 Anna 1:05\.4/);
  assert.ok(html.indexOf('id="duel"') < html.indexOf('id="race"'));
  assert.match(html, /href="\/help\/duel#h-rating"/); assert.match(html, /href="\/help\/race"/);
  const ru = plain(renderToStaticMarkup(await page.default({ params: Promise.resolve({ lang: 'ru' }) })));
  assert.match(ru, /Два рейтинга, каждый сам по себе/); assert.match(ru, /Кто сильнее один на один/);
  const chrome = readFileSync(new URL('../components/site-chrome.tsx', import.meta.url), 'utf8');
  assert.match(chrome, /<Link className="hm-tab" href="\/rating" \{\.\.\.cur\('rating'\)\}>/); assert.match(chrome, /<FootLink href="\/rating">/);
});
