// What a 1-on-1 race did to the rating, as the site tells it: lib/duel-rating.ts reading the database's answer and saying it
// in a line, GET /connect/rating (app/connect/rating/route.ts) over a stand-in for Supabase, and the result page's block
// (components/duel-rating.tsx DuelRatingView) for each answer, in English and in another language.
// Run: node --test test/duel-rating.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null, throws: false };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb;');
globalThis.__sb = { rpc: async (fn, args) => { rpc.calls.push({ fn, ...args }); if (rpc.throws) throw new Error('down'); return { data: rpc.data, error: rpc.error }; } };
const { NextRequest } = await import('next/server');
const { GET } = await import('../app/connect/rating/route.ts');
const { parseRating, ratingLine, whyText } = await import('../lib/duel-rating.ts');
const { DuelRatingView } = await import('../components/duel-rating.tsx');

// Alex P. beat Anna K. at Göcek: 1540 → 1558, Anna 1585 → 1567, both settled
const RATED = { status: 'rated', side: 'host', me: { before: 1540, after: 1558, delta: 18, won: true, k: 32, chance: 0.4357, races: 41, rating: 1558, all_races: 41 },
  them: { name: 'Anna K.', before: 1585, after: 1567, delta: -18, races: 40 } };
// a first rated race: provisional, K 64
const FIRST = { status: 'rated', side: 'guest', me: { before: 1500, after: 1533, delta: 33, won: true, k: 64, chance: 0.4885, races: 1, rating: 1533, all_races: 1 },
  them: { name: 'Lina S.', before: 1508, after: 1475, delta: -33, races: 3 } };
const get = async (q) => { const res = await GET(new NextRequest(new URL(`/connect/rating?${q}`, 'https://www.sailupdown.com'))); return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() }; };
const view = (r, lang = 'en') => plain(renderToStaticMarkup(DuelRatingView({ r, lang })));

beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; rpc.throws = false; });

test('the database\'s four answers are read as they are; anything else is none', () => {
  assert.equal(parseRating(RATED).status, 'rated');
  assert.deepEqual(parseRating({ status: 'waiting', side: 'guest' }), { status: 'waiting', side: 'guest' });
  assert.deepEqual(parseRating({ status: 'unrated', side: 'host', reason: 'limit' }), { status: 'unrated', side: 'host', reason: 'limit' });
  for (const bad of [null, 'rated', {}, { status: 'rated', side: 'host' }, { ...RATED, side: 'nobody' }, { ...RATED, me: { ...RATED.me, delta: 1.5 } }, { status: 'unrated', side: 'host', reason: 'weather' }, { status: 'waiting' }])
    assert.deepEqual(parseRating(bad), { status: 'none' }, JSON.stringify(bad));
  assert.equal(parseRating({ ...RATED, them: { ...RATED.them, name: 'Anna 😀' } }).them.name, 'Anna', 'the other sailor\'s name is plain');
});

test('the game\'s line: the rating, the change and the level; a provisional one says which of the five it was', () => {
  assert.equal(ratingLine(parseRating(RATED), 'en'), '1-on-1 rating 1558 (+18) · Fleet');
  assert.equal(ratingLine(parseRating(FIRST), 'en'), '1-on-1 rating ~1533 (+33) · race 1 of 5');
  assert.equal(ratingLine(parseRating({ ...RATED, me: { ...RATED.me, after: 1522, delta: -18 } }), 'ru'), 'Рейтинг 1 на 1 1522 (−18) · Флот');
  assert.match(ratingLine({ status: 'waiting', side: 'host' }, 'en'), /waiting for both screens/);
  assert.equal(ratingLine({ status: 'unrated', side: 'host', reason: 'account' }, 'en'), 'Not rated: both sailors need to be signed in');
  assert.equal(ratingLine({ status: 'none' }, 'en'), null);
});

test('every reason a race isn\'t rated is said in every language', () => {
  for (const why of ['account', 'same', 'abandoned', 'no_winner', 'disputed', 'limit', 'one_screen'])
    for (const lang of ['en', 'ru', 'es', 'de', 'tr', 'fr', 'it', 'pt']) {
      const s = whyText(why, lang);
      assert.ok(s && s.length > 8, `${why} in ${lang}`);
      if (lang !== 'en') assert.notEqual(s, whyText(why, 'en'), `${why} in ${lang} is its own`);
    }
});

test('GET /connect/rating asks the database for that race as the session\'s sailor, and says it in the asked language', async () => {
  rpc.data = RATED;
  const r = await get('code=K7M2QZ&seed=4242&lang=it');
  assert.deepEqual(rpc.calls, [{ fn: 'regatta_duel_rating', p_code: 'K7M2QZ', p_seed: 4242 }]);
  assert.equal(r.status, 200); assert.equal(r.cache, 'no-store');
  assert.equal(r.body.status, 'rated'); assert.equal(r.body.me.after, 1558);
  assert.equal(r.body.line, 'Rating 1 contro 1 1558 (+18) · Flotta');
});

test('a bad question, a database error or a failure is none, asked of nobody when the question is bad', async () => {
  for (const q of ['code=nope&seed=1', 'code=K7M2QZ&seed=-1', 'code=K7M2QZ&seed=1.5', 'code=K7M2QZ', 'seed=4']) {
    rpc.calls = [];
    const r = await get(q);
    assert.deepEqual(r.body, { status: 'none', line: null }, q); assert.equal(rpc.calls.length, 0);
  }
  rpc.error = { code: '42501' };
  assert.deepEqual((await get('code=K7M2QZ&seed=4')).body, { status: 'none', line: null });
  rpc.error = null; rpc.throws = true;
  assert.deepEqual((await get('code=K7M2QZ&seed=4')).body, { status: 'none', line: null });
  rpc.throws = false; rpc.data = { status: 'waiting', side: 'host' };
  assert.equal((await get('code=K7M2QZ&seed=4&lang=xx')).body.line, '1-on-1 rating: waiting for both screens…', 'an unknown language is English');
});

test('the result page\'s block: the new rating, the change, the level and how far the next one is, and the other sailor', () => {
  const s = view(parseRating(RATED));
  assert.match(s, /1-on-1 rating 1558 \+18 Fleet from 1540/);
  assert.match(s, /42 to Regional/);
  assert.match(s, /Anna K\. 1567 −18/);
  assert.doesNotMatch(s, /count double/);
  assert.match(renderToStaticMarkup(DuelRatingView({ r: parseRating(RATED), lang: 'en' })), /class="dr-d up"/);
  assert.match(renderToStaticMarkup(DuelRatingView({ r: parseRating(RATED), lang: 'en' })), /width:79%/);
});

test('a provisional rating: ~, which of the five this was, why it moved so far, and no level yet', () => {
  const s = view(parseRating(FIRST));
  assert.match(s, /~1533 \+33 Race 1 of 5 from 1500/);
  assert.match(s, /count double/);
  assert.doesNotMatch(s, /Fleet|to Regional/);
  assert.match(s, /Lina S\. ~1475 −33/);
});

test('waiting, not rated and nothing at all', () => {
  assert.match(view({ status: 'waiting', side: 'host' }), /Waiting for both screens/);
  assert.match(view({ status: 'unrated', side: 'host', reason: 'disputed' }), /Not rated: the two screens saw different results\./);
  assert.equal(renderToStaticMarkup(DuelRatingView({ r: { status: 'none' }, lang: 'en' })), '');
});

test('the block in German and Russian', () => {
  assert.match(view(parseRating(RATED), 'de'), /1-gegen-1-Wertung 1558 \+18 Flotte vorher 1540.*42 bis Regional/);
  assert.match(view(parseRating(RATED), 'ru'), /42 до уровня «Региональный»/);
  assert.match(view(parseRating(FIRST), 'ru'), /Гонка 1 из 5/);
});

// ---------- your own rating, on your card on /players ----------
const { GET: GET_ME } = await import('../app/connect/rating/me/route.ts');
const { parseMine } = await import('../lib/duel-rating.ts');
const { MyDuelRatingView } = await import('../components/my-duel-rating.tsx');
const MINE = { rating: 1558, races: 41, wins: 24, losses: 17, best: 1558, lowest: 1431, place: 198, of: 1240, changes: [
  { at: '2026-11-20T18:02:00Z', won: true, before: 1540, after: 1558, delta: 18, them: 'Anna K.', them_before: 1585, venue: 'gocek', yacht: 'j70', margin: 1.8, forfeit: false },
  { at: '2026-11-19T18:40:00Z', won: false, before: 1556, after: 1540, delta: -16, them: 'Lotte V.', them_before: 1556, venue: null, yacht: null, margin: null, forfeit: false },
] };
const card = (mine, lang = 'en') => plain(renderToStaticMarkup(MyDuelRatingView({ mine, lang })));

test('your own rating is read as the database gives it; anything malformed is nothing, a bad race row is left out', () => {
  assert.equal(parseMine(MINE).changes.length, 2);
  for (const bad of [null, 1500, {}, { ...MINE, rating: '1558' }, { ...MINE, place: 1.5 }, { ...MINE, changes: null }]) assert.equal(parseMine(bad), null, JSON.stringify(bad));
  assert.equal(parseMine({ ...MINE, changes: [...MINE.changes, { at: 'x', before: 'no' }] }).changes.length, 2);
});

test('GET /connect/rating/me asks for the session\'s own rating, and is never cached', async () => {
  rpc.data = MINE;
  const res = await GET_ME();
  assert.deepEqual(rpc.calls, [{ fn: 'regatta_my_rating' }]);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await res.json()).place, 198);
  rpc.data = null;
  assert.equal(await (await GET_ME()).json(), null, 'not signed in: nothing');
  rpc.throws = true;
  assert.equal(await (await GET_ME()).json(), null);
});

test('your card: the rating, the level and the bar, the record, your place, best and lowest, your last races', () => {
  const s = card(parseMine(MINE));
  assert.match(s, /1-on-1 rating 1558 Fleet 42 to Regional/);
  assert.match(s, /Record 24–17 Place #198 of 1,240 Best 1558 Lowest 1431/);
  assert.match(s, /20 Nov Beat Anna K\. 1585 Göcek · J\/70 \+18/);
  assert.match(s, /19 Nov Lost to Lotte V\. 1556 −16/);
});

test('your card while provisional: a ~, how many of the five are done, a place only after five; and before any race', () => {
  const s = card(parseMine({ ...MINE, rating: 1531, races: 2, wins: 1, losses: 1, place: null }));
  assert.match(s, /~1531 2 of 5 races/); assert.match(s, /Place After five races/);
  assert.doesNotMatch(s, /to Regional/);
  const none = card(parseMine({ ...MINE, rating: 1500, races: 0, wins: 0, losses: 0, place: null, changes: [] }));
  assert.match(none, /Not rated yet: everyone starts at 1500/);
  assert.match(renderToStaticMarkup(MyDuelRatingView({ mine: parseMine({ ...MINE, races: 0, changes: [] }), lang: 'en' })), /href="\/match\/new"/);
  assert.match(card(parseMine(MINE), 'pt'), /Retrospecto 24–17/);
});
