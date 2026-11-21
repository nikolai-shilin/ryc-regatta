// Find a race: the database's answers read (lib/duel-seek.ts), POST /connect/seek over a stand-in for Supabase, the
// link each sailor is sent to (the host's with ?auto), and the finder's screens (components/duel-finder.tsx DuelFinderView):
// signed out, ready to look, looking, a long wait, Match found (the short one, and the full one with the stakes), waiting
// for the other, off to the race, missed. Run: node --test test/duel-seek.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { rpc: async (fn, args) => { rpc.calls.push({ fn, ...(args || {}) }); return { data: rpc.data, error: rpc.error }; } };
const { NextRequest } = await import('next/server');
const { POST } = await import('../app/connect/seek/route.ts');
const { parseSeek, raceHref, wishesOf } = await import('../lib/duel-seek.ts');
const { DuelFinderView } = await import('../components/duel-finder.tsx');

const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
const PAIR = { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'host', settings: SETTINGS, them: { name: 'Anna K.', rating: 1585, races: 40 },
  me: { rating: 1540, races: 41, ok: null }, them_ok: null, left: '9.5', minutes: 6 };
const post = async (body, origin) => (await POST(new NextRequest(new URL('/connect/seek', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', ...(origin && { origin }) }, body: JSON.stringify(body) }))).json();
beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; });

test('the database\'s answers are read as they are; a pair with settings the game can\'t sail is none', () => {
  assert.deepEqual(parseSeek({ status: 'looking', waited: '23', band: 100, online: 3, near: 1 }), { status: 'looking', waited: 23, band: 100, online: 3, near: 1 });
  const f = parseSeek({ status: 'found', pair: PAIR });
  assert.equal(f.status, 'found'); assert.equal(f.pair.left, 9.5); assert.equal(f.pair.them.name, 'Anna K.'); assert.equal(f.pair.themOk, null);
  assert.equal(parseSeek({ status: 'go', pair: PAIR }).status, 'go');
  for (const bad of [{ ...PAIR, code: 'nope' }, { ...PAIR, settings: { ...SETTINGS, venue: 'atlantis' } }, { ...PAIR, settings: { ...SETTINGS, laps: 3 } }, { ...PAIR, role: 'both' }, { ...PAIR, them: { name: 'x', rating: '1500', races: 0 } }])
    assert.deepEqual(parseSeek({ status: 'found', pair: bad }), { status: 'none', reason: null }, JSON.stringify(bad));
  assert.deepEqual(parseSeek({ status: 'none', reason: 'declined' }), { status: 'none', reason: 'declined' });
  assert.deepEqual(parseSeek(null), { status: 'none', reason: null });
});

test('each sailor is sent to the same race: the host with ?auto, the guest to its link', () => {
  const host = parseSeek({ status: 'go', pair: PAIR }).pair, guest = parseSeek({ status: 'go', pair: { ...PAIR, role: 'guest' } }).pair;
  assert.equal(raceHref(host), '/play?match=K7M2QZ&venue=phuket&boat=j70&auto');
  assert.equal(raceHref(guest), '/play?match=K7M2QZ&venue=phuket&boat=j70');
});

test('POST /connect/seek asks the database as the session\'s sailor: seek with clean wishes, ready, decline, stop', async () => {
  rpc.data = { status: 'looking', waited: 4, band: 100, online: 1, near: 0 };
  assert.equal((await post({ do: 'seek', wishes: { venue: 'cowes', yacht: 'titanic', extra: 1 } })).status, 'looking');
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_seek', p_wishes: { venue: 'cowes' } });
  rpc.data = { status: 'found', pair: PAIR };
  await post({ do: 'ready', pair: PAIR.id });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_seek_ready', p_pair: PAIR.id, p_ok: true });
  await post({ do: 'decline', pair: PAIR.id });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_seek_ready', p_pair: PAIR.id, p_ok: false });
  assert.deepEqual(await post({ do: 'stop' }), { status: 'none', reason: 'stopped' });
  assert.equal(rpc.calls.at(-1).fn, 'regatta_seek_stop');
});

test('a bad ask, another site, or a database error asks nothing or answers none', async () => {
  for (const b of [{}, { do: 'win' }, { do: 'ready' }, { do: 'ready', pair: 'not-a-uuid' }]) { rpc.calls = []; assert.equal((await post(b)).status, 'none'); assert.equal(rpc.calls.length, 0, JSON.stringify(b)); }
  rpc.calls = [];
  assert.equal((await post({ do: 'seek' }, 'https://evil.example')).status, 'none'); assert.equal(rpc.calls.length, 0);
  rpc.error = { code: '42501' };
  assert.deepEqual(await post({ do: 'seek' }), { status: 'none', reason: null });
  assert.deepEqual(wishesOf({ venue: 'gocek', yacht: 'dragon' }), { venue: 'gocek', yacht: 'dragon' });
});

const noop = () => {};
const view = (o) => plain(renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 1 }, pair: null, said: false, left: 10, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop, ...o })));
const pairOf = (o = {}) => parseSeek({ status: 'found', pair: { ...PAIR, ...o } }).pair;

test('signed out: why an account, Sign in back to here, or a friend instead', () => {
  const s = renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: false, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop }));
  assert.match(plain(s), /Rated races need an account on both sides/);
  assert.match(s, /href="\/sign-in\?next=\/duel"/); assert.match(s, /href="\/match\/new"/);
});

test('ready to look, looking, and a long wait offering a friend instead', () => {
  assert.match(view(), /Find a race Challenge a friend instead Matched by rating: within 100 at first/);
  assert.match(view({ phase: 'looking', look: { waited: 23, band: 200, online: 3 } }), /Looking for a sailor 0:23 Within 200 of your rating · wider as you wait · 2 other looking now Stop looking/);
  assert.match(view({ phase: 'looking', look: { waited: 50, band: 350, online: 1 } }), /Within 350 of your rating Stop/);
  assert.match(view({ phase: 'looking', look: { waited: 95, band: 350, online: 1 }, longWait: true }), /Nobody near your level is looking yet\. .* Stop looking Challenge a friend instead/);
  assert.match(view({ phase: 'looking', note: 'declined' }), /The other sailor declined\. Still looking\./);
  assert.match(view({ phase: 'looking', note: 'noanswer' }), /didn’t say Ready\. Still looking\./);
});

test('Match found, the full one: who, level and rating, how long, where, the stakes, Ready with its seconds, Decline', () => {
  const s = view({ phase: 'found', pair: pairOf(), left: 8.2 });
  assert.match(s, /Match found Anna K\. Fleet 1585 about 6 min Phuket · J\/70 Your chance 44% · win \+18 · lose −14 Ready 9 Decline/);
});

test('Match found, the short one for a first match: no stakes; and waiting once Ready is said', () => {
  const first = view({ phase: 'found', pair: pairOf({ me: { rating: 1500, races: 0, ok: null }, them: { name: 'Lina S.', rating: 1508, races: 2 } }), left: 10 });
  assert.match(first, /Match found Lina S\. New to 1-on-1 ~1508 about 6 min/);
  assert.doesNotMatch(first, /Your chance/);
  assert.match(view({ phase: 'found', pair: pairOf(), said: true }), /Ready\. Waiting for Anna K\.…/);
});

test('off to the race, and a missed match', () => {
  assert.match(view({ phase: 'go', pair: pairOf() }), /Both ready\. Off to the race…/);
  assert.match(view({ phase: 'missed' }), /The match went: Ready wasn’t said in time\. Find a race/);
  assert.match(plain(renderToStaticMarkup(DuelFinderView({ lang: 'ru', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop }))), /Найти гонку/);
});
