// The 1-on-1 page as designed (the design canvas's board "The 1-on-1 page"; components/duel-finder.tsx, components/duel-page.tsx,
// lib/duel-page.ts): the open calls and the rating around you checked as the database gives them; the hero's rating panel
// (provisional, settled with the bar to the next level, signed out); Ready now as a table with your chance and what a win or
// a loss would do, filtered to your level; the open calls (take, yours, out of your band); your last races; the rating around
// you; the set-up card's settings and band; the routes; and the page with the site's header. Run: node --test test/duel-page.test.mjs
import { mock } from './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

const rpc = { calls: {}, near: null, ready: [], err: false };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { rpc: async (fn) => (rpc.err ? { data: null, error: { message: 'x' } } : { data: fn === 'regatta_calls_open' ? rpc.calls : fn === 'regatta_rating_near' ? rpc.near : fn === 'regatta_ready_now' ? rpc.ready : null, error: null }), auth: { getClaims: async () => ({ data: null }) } };
const { parseCalls, parseNear } = await import('../lib/duel-page.ts');
const { RatingPanel, ReadyTable, OpenCalls, LastRaces, NearTable } = await import('../components/duel-page.tsx');
const { DuelFinderView } = await import('../components/duel-finder.tsx');
const { NextRequest } = await import('next/server');
const { POST: seek } = await import('../app/connect/seek/route.ts');
const { GET: near } = await import('../app/connect/rating/near/route.ts');
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const h = (el) => renderToStaticMarkup(el);

const CALL = { code: 'K7M2QZ', name: 'Jonas B.', rating: 1698, races: 30, lo: 1500, hi: 1850, venue: 'palma', yacht: 'dragon', ago: 120, mine: false, in_band: true };
const NEAR = { place: 6, of: 10, rows: [3, 4, 5, 6, 7, 8, 9].map((p) => ({ place: p, name: `S${p}`, rating: 1720 - p * 20, races: 9, wins: 5, losses: 4, me: p === 6 })) };
const MINE = (o = {}) => ({ rating: 1558, races: 41, wins: 24, losses: 17, best: 1558, lowest: 1431, place: 198, of: 1240, changes: [
  { at: '2026-11-20T19:10:00Z', won: true, before: 1540, after: 1558, delta: 18, them: 'Anna K.', them_before: 1585, venue: 'gocek', yacht: 'j70', margin: 1.8, forfeit: false },
  { at: '2026-11-19T19:10:00Z', won: false, before: 1556, after: 1540, delta: -16, them: 'Lotte V.', them_before: 1556, venue: null, yacht: null, margin: null, forfeit: false }], recent: [], ...o });
const READY = [{ handle: '3f9a0c1d2e4b', name: 'Anna K.', rating: 1567, races: 40, waited: 23, away: false }, { handle: 'a1b2c3d4e5f6', name: 'Pieter V.', rating: 1741, races: 20, waited: 4, away: true }];

test('the database\'s open calls and rating around you, checked: a bad code, an unknown venue or a negative number left out', () => {
  assert.deepEqual(parseCalls([CALL, { ...CALL, code: 'nope' }, { ...CALL, rating: -1 }, { ...CALL, code: 'K7M2QA', venue: 'atlantis' }]).map((c) => [c.code, c.venue, c.inBand]), [['K7M2QZ', 'palma', true], ['K7M2QA', null, true]]);
  assert.deepEqual(parseCalls(null), []);
  const n = parseNear(NEAR);
  assert.equal(n.place, 6); assert.equal(n.rows.length, 7); assert.equal(n.rows.find((r) => r.me).place, 6);
  assert.equal(parseNear({ ...NEAR, place: null }).place, null);
  assert.equal(parseNear({ rows: 'x' }), null);
});

test('the hero\'s panel: your rating, its level and the bar to the next, record, place and best; provisional without the bar; signed out, how it works', () => {
  const settled = plain(h(RatingPanel({ lang: 'en', mine: MINE() })));
  assert.match(settled, /Your 1-on-1 rating/); assert.match(settled, /1558/); assert.match(settled, /Fleet/);
  assert.match(settled, /42 to Regional/); assert.match(settled, /1600/); assert.match(settled, /24–17/); assert.match(settled, /#198 \/ 1,240/);
  assert.match(h(RatingPanel({ lang: 'en', mine: MINE() })), /href="\/duel\/rating"/); // (your rating, race by race; everyone's from the rating around you)
  assert.match(plain(h(RatingPanel({ lang: 'en', mine: MINE() }))), /Your rating, race by race →/);
  const prov = plain(h(RatingPanel({ lang: 'en', mine: MINE({ rating: 1532, races: 2, wins: 1, losses: 1, place: null }) })));
  assert.match(prov, /~1532/); assert.match(prov, /Provisional/); assert.match(prov, /2 \/ 5/); assert.doesNotMatch(prov, /to Regional/);
  assert.match(plain(h(RatingPanel({ lang: 'en', mine: null }))), /Everyone starts at 1500/);
  assert.match(plain(h(RatingPanel({ lang: 'ru', mine: MINE() }))), /42 до уровня «Региональный»/);
});

test('Ready now: a table with level, rating, your chance and what a win or a loss would do; your level alone, or everyone', () => {
  const all = h(ReadyTable({ lang: 'en', list: READY, mine: MINE(), filter: 'all', setFilter: () => {}, challenge: () => {}, hour: false }));
  assert.match(plain(all), /Ready now · 2/); assert.match(plain(all), /My level · 1/); assert.match(plain(all), /Everyone · 2/);
  assert.match(plain(all), /ANNA K\.|Anna K\./); assert.match(plain(all), /Pieter V\./); assert.match(plain(all), /away · gets a message/);
  assert.match(plain(all), /1567 49% \+16 \/ −16/, 'your chance against 1567 from 1558, and what each way does'); assert.match(plain(all), /1741 26% \+24 \/ −8/);
  assert.equal((all.match(/df-race/g) || []).length, 2);
  const level = h(ReadyTable({ lang: 'en', list: READY, mine: MINE(), filter: 'level', setFilter: () => {}, challenge: () => {}, hour: true }));
  assert.doesNotMatch(plain(level), /Pieter V\./); assert.match(plain(level), /Duel hour/);
  assert.match(plain(h(ReadyTable({ lang: 'en', list: [], mine: MINE(), filter: 'all', setFilter: () => {}, challenge: () => {}, hour: false }))), /Nobody else is looking right now/);
});

test('open calls: Take it when your rating is in the band, yours marked, out of band said; none, how to post one', () => {
  const calls = parseCalls([CALL, { ...CALL, code: 'K7M2QB', mine: true }, { ...CALL, code: 'K7M2QC', in_band: false }]);
  const out = plain(h(OpenCalls({ lang: 'en', calls, take: () => {}, post: () => {}, canPost: true })));
  assert.match(out, /Open calls · 3/); assert.match(out, /Jonas B\. · 1698/); assert.match(out, /Palma · Dragon · ~4 min · rated, 1500–1850/);
  assert.match(out, /Take it/); assert.match(out, /Your call/); assert.match(out, /outside your range/); assert.match(out, /2 min ago/); assert.match(out, /Post yours/);
  assert.match(plain(h(OpenCalls({ lang: 'en', calls: [], take: () => {}, post: () => {}, canPost: false }))), /No open calls right now/);
});

test('your last races: won or lost, against whom and their rating, the change; the rating around you with your row marked', () => {
  const last = plain(h(LastRaces({ lang: 'en', mine: MINE() })));
  assert.match(last, /Anna K\. · 1585/); assert.match(last, /won · 1558/); assert.match(last, /\+18/); assert.match(last, /lost · 1540/); assert.match(last, /−16/);
  const n = h(NearTable({ lang: 'en', near: parseNear(NEAR) }));
  assert.match(plain(n), /The 1-on-1 rating, around you/); assert.match(plain(n), /#3/); assert.match(plain(n), /#9/); assert.match(plain(n), /You/);
  assert.equal((n.match(/dp-me/g) || []).length, 1);
  assert.match(plain(h(NearTable({ lang: 'en', near: { place: null, of: 0, rows: [] } }))), /Nobody has five rated races yet/);
  assert.match(plain(h(NearTable({ lang: 'en', near: { ...parseNear(NEAR), place: null } }))), /The top of the 1-on-1 rating/);
});

test('the page: the hero, the set-up card with the race\'s settings and the band, Ready now, calls, last races and the rating around you', () => {
  const n = () => {};
  const page = h(DuelFinderView({ lang: 'en', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 1 }, pair: null, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n,
    list: READY, mine: MINE(), near: parseNear(NEAR), calls: parseCalls([CALL]), filter: 'all' }));
  const p = plain(page);
  assert.match(p, /Race someone your level/); assert.match(p, /2 ready now/); assert.match(p, /Find a race · ±100/); assert.match(p, /Challenge a friend/);
  assert.match(p, /Set up your race/); assert.match(p, /Find one/); assert.match(p, /Open call/);
  assert.match(p, /Ratings to race1458 – 1658|Ratings to race 1458 – 1658/); assert.match(p, /±200 at 0:20 and ±350 at 0:45/);
  assert.match(p, /Medium/); assert.match(p, /Up and down/); assert.match(p, /Short · 1 lap · ~4 min/);
  assert.doesNotMatch(p, /Your first three rated races/, 'a sailor past three');
  assert.match(p, /Open calls · 1/); assert.match(p, /Your last races/); assert.match(p, /around you/);
  assert.match(page, /class="bt-go df-go dp-go"/);
  const fresh = plain(h(DuelFinderView({ lang: 'en', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 1 }, pair: null, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, mine: MINE({ races: 1, rating: 1516 }) })));
  assert.match(fresh, /Your first three rated races/); assert.match(fresh, /a light venue, the J\/70/);
  const looking = plain(h(DuelFinderView({ lang: 'en', signed: true, phase: 'looking', look: { waited: 25, band: 200, online: 4, near: 2 }, pair: null, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, mine: MINE() })));
  assert.match(looking, /Looking for a sailor/); assert.match(looking, /2 in your band/); assert.match(looking, /1358 – 1758/);
  const guest = plain(h(DuelFinderView({ lang: 'en', signed: false, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n })));
  assert.match(guest, /Sign in to race/); assert.match(guest, /Everyone starts at 1500/); assert.doesNotMatch(guest, /Ready now/);
});

test('Match found says the whole race: where, the yacht, the wind, the course, the laps and the start', () => {
  const n = () => {};
  const pair = { id: 'p1', code: 'K7M2QZ', role: 'guest', ttl: 10, left: 8, minutes: 4, settings: { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' },
    me: { rating: 1558, races: 41 }, them: { name: 'Anna K.', rating: 1567, races: 40 } };
  const p = plain(h(DuelFinderView({ lang: 'en', signed: true, phase: 'found', look: { waited: 0, band: 100, online: 1 }, pair, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, mine: MINE() })));
  assert.match(p, /Phuket · J\/70 · medium breeze · .+ · 1 lap · 1-min start/);
  assert.match(p, /Match found/);
});

test('the routes: Ready now carries the open calls; the rating around you, or null signed out or on a failure', async () => {
  rpc.ready = []; rpc.calls = [CALL]; rpc.near = NEAR;
  const req = (body) => new NextRequest(new URL('/connect/seek', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com' }, body: JSON.stringify(body) });
  const j = await (await seek(req({ do: 'ready_now' }))).json();
  assert.deepEqual(j.list, []); assert.equal(j.calls[0].code, 'K7M2QZ'); assert.equal(j.calls[0].inBand, true);
  assert.equal((await (await near()).json()).place, 6);
  rpc.err = true;
  assert.deepEqual((await (await seek(req({ do: 'ready_now' }))).json()).calls, []);
  assert.equal(await (await near()).json(), null);
  rpc.err = false;
});

test('the page has the site\'s header with 1-on-1 marked, and For you in its column', () => {
  const pg = src('app/[lang]/duel/page.tsx');
  assert.match(pg, /<SiteHead lang=\{lang\} t=\{t\} page="duel" \/>/);
  assert.match(pg, /<DuelFinder lang=\{lang\} signed=\{!!account\}>\s*<ForYou lang=\{lang\} \/>/);
  assert.match(src('components/site-chrome.tsx'), /href="\/duel" \{\.\.\.cur\('duel'\)\}/);
});

test('a first match shows who, about how long and Ready, with a small Not now; past five, the race and the stakes', () => {
  const n = () => {};
  const pair = (me) => ({ id: 'p1', code: 'K7M2QZ', role: 'guest', ttl: 10, left: 8, minutes: 4, settings: { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' },
    me, them: { name: 'Lina S.', rating: 1508, races: 2 } });
  const view = (me) => plain(h(DuelFinderView({ lang: 'en', signed: true, phase: 'found', look: { waited: 0, band: 100, online: 1 }, pair: pair(me), said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, mine: MINE() })));
  const first = view({ rating: 1500, races: 0 });
  assert.match(first, /Match found Lina S\. New to 1-on-1 about 4 min Ready 8 Not now It counts for your rating/);
  assert.doesNotMatch(first, /~1508|Phuket · J\/70|Your chance/);
  const later = view({ rating: 1558, races: 41 });
  assert.match(later, /~1508/); assert.match(later, /Phuket · J\/70 · medium breeze/); assert.match(later, /Your chance/); assert.match(later, /Decline/);
});

test('Post yours only while no call of yours is out; ?find looks at once (the home\'s Find a race, a result\'s Another 1-on-1 race)', () => {
  const n = () => {};
  const call = { code: 'K7M2QZ', lo: 1458, hi: 1658, url: 'https://www.sailupdown.com/call/K7M2QZ' };
  const looking = (o) => plain(h(DuelFinderView({ lang: 'en', signed: true, phase: 'looking', look: { waited: 5, band: 100, online: 1 }, pair: null, said: false, left: 8, note: '', longWait: false, find: n, stop: n, ready: n, decline: n, mine: MINE(), ...o })));
  assert.match(looking({}), /Open calls · 0 Post yours/);
  assert.doesNotMatch(looking({ call }), /Post yours/);
  assert.match(src('components/duel-finder.tsx'), /has\('hour'\) \|\| new URLSearchParams\(location\.search\)\.has\('find'\)/);
  assert.match(src('components/duel-home.tsx'), /href="\/duel\?find" data-cta="duel-find"/);
  assert.match(src('components/result-view.tsx'), /const again = one \? '\/duel\?find'/);
});
