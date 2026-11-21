// Find a race: the database's answers read (lib/duel-seek.ts), POST /connect/seek over a stand-in for Supabase, the
// link each sailor is sent to (the host's with ?auto), and the finder's screens (components/duel-finder.tsx DuelFinderView):
// signed out, ready to look, looking, a long wait, Match found (the short one, and the full one with the stakes), waiting
// for the other, off to the race, missed; Ready now (who else is looking, each with Race), a challenge, a sailor gone, the
// wishes. Run: node --test test/duel-seek.test.mjs
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
const { parseSeek, parseReady, raceHref, wishesOf } = await import('../lib/duel-seek.ts');
const { DuelFinderView } = await import('../components/duel-finder.tsx');

const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
const PAIR = { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'host', settings: SETTINGS, them: { name: 'Anna K.', rating: 1585, races: 40 },
  me: { rating: 1540, races: 41, ok: null }, them_ok: null, left: '9.5', minutes: 6 };
const post = async (body, origin) => (await POST(new NextRequest(new URL('/connect/seek', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', ...(origin && { origin }) }, body: JSON.stringify(body) }))).json();
beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; });

test('the database\'s answers are read as they are; a pair with settings the game can\'t sail is none', () => {
  assert.deepEqual(parseSeek({ status: 'looking', waited: '23', band: 100, online: 3, near: 1 }), { status: 'looking', waited: 23, band: 100, online: 3, near: 1, away: false });
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
  assert.match(view(), /Set up your race Who Find one A friend Open call Ratings to race 1400 – 1600 ±100 to start\. It widens to ±200 at 0:20 and ±350 at 0:45/);
  assert.match(view(), /Find a race ~4 min race/);
  assert.match(view({ phase: 'looking', look: { waited: 23, band: 200, online: 3 } }), /Looking for a sailor 0:23 Within 200 of your rating · wider as you wait · 2 other looking now Stop looking/);
  assert.match(view({ phase: 'looking', look: { waited: 50, band: 350, online: 1 } }), /Within 350 of your rating Stop/);
  assert.match(view({ phase: 'looking', look: { waited: 95, band: 350, online: 1 }, longWait: true }), /Nobody near your level is looking yet\. .* Stop looking Challenge a friend instead/);
  assert.match(view({ phase: 'looking', note: 'declined' }), /The other sailor declined\. Still looking\./);
  assert.match(view({ phase: 'looking', note: 'noanswer' }), /didn’t say Ready\. Still looking\./);
});

test('Match found, the full one: who, level and rating, how long, where, the stakes, Ready with its seconds, Decline', () => {
  const s = view({ phase: 'found', pair: pairOf(), left: 8.2 });
  assert.match(s, /Match found Anna K\. Fleet 1585 about 6 min Phuket · J\/70 · medium breeze · Up and down · 1 lap · 1-min start Your chance 44% · win \+18 · lose −14 Ready 9 Decline/);
});

test('Match found, the short one for a first match: no stakes; and waiting once Ready is said', () => {
  const first = view({ phase: 'found', pair: pairOf({ me: { rating: 1500, races: 0, ok: null }, them: { name: 'Lina S.', rating: 1508, races: 2 } }), left: 10 });
  assert.match(first, /Match found Lina S\. New to 1-on-1 about 6 min Ready 10 Not now/);
  assert.doesNotMatch(first, /Your chance/);
  assert.match(view({ phase: 'found', pair: pairOf(), said: true }), /Ready\. Waiting for Anna K\.…/);
});

test('off to the race, and a missed match', () => {
  assert.match(view({ phase: 'go', pair: pairOf() }), /Both ready\. Off to the race…/);
  assert.match(view({ phase: 'missed' }), /The match went: Ready wasn’t said in time\. Who Find one/);
  assert.match(plain(renderToStaticMarkup(DuelFinderView({ lang: 'ru', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop }))), /Найти гонку/);
});

const READY = [{ handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1900, races: 12, waited: 23 }, { handle: 'a1b2c3d4e5f6', name: 'Lina S.', rating: 1508, races: 2, waited: '4' }];

test('Ready now is read as it is: a handle, never an id, the name, rating, races and wait; anything else dropped', () => {
  const r = parseReady([...READY, { handle: '00000000-0000-4000-8000-00000000000a', name: 'x', rating: 1500, races: 0 }, { handle: 'abc', rating: 1500, races: 0 }, { handle: 'bbbbbbbbbbbb', rating: '1500', races: 0 }, null]);
  assert.deepEqual(r, [{ handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1900, races: 12, waited: 23, away: false }, { handle: 'a1b2c3d4e5f6', name: 'Lina S.', rating: 1508, races: 2, waited: 4, away: false }]);
  assert.deepEqual(parseReady(null), []); assert.deepEqual(parseReady({ handle: 'x' }), []);
  assert.equal(parseReady(Array.from({ length: 30 }, (_, i) => ({ ...READY[0], handle: i.toString(16).padStart(12, '0') }))).length, 20);
});

test('POST /connect/seek: ready_now lists who is looking; challenge names a handle with clean wishes; a bad handle asks nothing', async () => {
  rpc.data = READY;
  assert.deepEqual((await post({ do: 'ready_now' })).list.map((x) => x.name), ['Cara M.', 'Lina S.']);
  assert.ok(rpc.calls.some((c) => c.fn === 'regatta_ready_now') && rpc.calls.some((c) => c.fn === 'regatta_calls_open'), 'who is looking, and the open calls');
  rpc.data = { status: 'found', pair: PAIR };
  assert.equal((await post({ do: 'challenge', handle: '3f9a0c1d2e4b', wishes: { yacht: 'dragon', venue: 'nowhere' } })).status, 'found');
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_seek_challenge', p_handle: '3f9a0c1d2e4b', p_wishes: { yacht: 'dragon' } });
  rpc.data = { status: 'none', reason: 'gone' };
  assert.deepEqual(await post({ do: 'challenge', handle: '3f9a0c1d2e4b' }), { status: 'none', reason: 'gone' });
  for (const handle of [undefined, '', 'ZZZZZZZZZZZZ', '00000000-0000-4000-8000-00000000000a', 42]) { rpc.calls = []; assert.equal((await post({ do: 'challenge', handle })).status, 'none'); assert.equal(rpc.calls.length, 0, String(handle)); }
  rpc.error = { code: '42501' }; assert.deepEqual(await post({ do: 'ready_now' }), { list: [], calls: [] });
});

test('Ready now under the button and while looking: nearest first, level or New, rating, how long, Race; nobody yet; gone', () => {
  const list = parseReady(READY), raced = [];
  const s = view({ list, challenge: (h) => raced.push(h) });
  assert.match(s, /Ready now · 2 .*Cara M\. waiting 0:23 National 1900 \d+% \+\d+ \/ −\d+ Race Lina S\. waiting 0:04 New ~1508 \d+% \+\d+ \/ −\d+ Race/);
  assert.match(view({ phase: 'looking', look: { waited: 5, band: 100, online: 3 }, list }), /Stop looking Keep looking if I leave .* Post an open call .* Ready now · 2 .*Cara M\./);
  assert.match(view(), /Ready now · 0 Nobody else is looking right now\. Find a race, and you’re the first one the next sailor sees\./);
  assert.match(view({ note: 'gone' }), /That sailor has just gone: paired with someone else, or stopped looking\. Who Find one/);
  assert.doesNotMatch(view({ phase: 'found', pair: pairOf(), list }), /Ready now/, 'not over a match found');
  assert.match(plain(renderToStaticMarkup(DuelFinderView({ lang: 'ru', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop, list }))), /Готовы сейчас · 2 .*Cara M\. ждёт 0:23 Национальный 1900 .* Гонка/);
});

test('the wishes, a venue and a yacht or Any, and when they count; a signed-out visitor sees neither them nor the list', () => {
  const html = renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop, wishes: { venue: 'phuket' } }));
  assert.match(html, /<option value="phuket" selected="">Phuket<\/option>/);
  assert.match(html, /<option value="j70">J\/70<\/option>/);
  assert.match(plain(html), /Venue Any .* Yacht Any .* Your wishes count from your fourth rated race; the host’s come first\./);
  const out = plain(renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: false, phase: 'idle', look: { waited: 0, band: 100, online: 0 }, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop, list: parseReady(READY) })));
  assert.doesNotMatch(out, /Ready now|Venue/);
});

test('POST /connect/seek: call posts with a band it knows and clean wishes; take names a code; a bad code asks nothing', async () => {
  rpc.data = { status: 'open', code: 'K7M2QZ', lo: 1458, hi: 1658, left: 3600 };
  assert.deepEqual(await post({ do: 'call', band: 200, wishes: { venue: 'cowes', yacht: 'titanic' } }), { status: 'open', code: 'K7M2QZ', lo: 1458, hi: 1658, left: 3600 });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_call_post', p_wishes: { venue: 'cowes' }, p_band: 200 });
  await post({ do: 'call', band: 999 });
  assert.equal(rpc.calls.at(-1).p_band, 100, 'a band it doesn\'t know is the narrowest');
  rpc.data = { status: 'none', reason: 'not_looking' };
  assert.deepEqual(await post({ do: 'call' }), { status: 'none', reason: 'not_looking' });
  rpc.data = { status: 'found', pair: PAIR };
  assert.equal((await post({ do: 'take', code: 'k7m2qz' })).status, 'found');
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_call_take', p_code: 'K7M2QZ', p_wishes: {} });
  rpc.data = { status: 'none', reason: 'taken' };
  assert.deepEqual(await post({ do: 'take', code: 'K7M2QZ' }), { status: 'none', reason: 'taken' });
  for (const code of [undefined, 'nope', 'K7M2Q0', 7]) { rpc.calls = []; assert.equal((await post({ do: 'take', code })).status, 'none'); assert.equal(rpc.calls.length, 0, String(code)); }
});

test('looking: Post an open call; posted, the call\'s band, its link and the ways to send it', () => {
  const looking = { phase: 'looking', look: { waited: 30, band: 200, online: 1 } };
  assert.match(view(looking), /Stop looking Keep looking if I leave A message when a sailor is found, for 30 minutes: to this browser, or from our Telegram bot\. Ratings to race .* Post an open call A link for any chat: the first sailor near your rating to take it races you\./);
  const call = { code: 'K7M2QZ', lo: 1458, hi: 1658, url: 'https://www.sailupdown.com/call/K7M2QZ' };
  const html = renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, ...looking, pair: null, said: false, left: 0, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop, call }));
  assert.match(plain(html), /Your open call For ratings 1458–1658: the first to take it races you\. Open while you look, an hour at most\. Telegram WhatsApp Copy link/);
  assert.match(html, /href="https:\/\/t\.me\/share\/url\?url=https%3A%2F%2Fwww\.sailupdown\.com%2Fcall%2FK7M2QZ%3Futm_source%3Dtelegram&amp;text=Race%20me%201-on-1/);
  assert.match(html, /href="https:\/\/wa\.me\/\?text=Race%20me%201-on-1%20on%20Up%20and%20down%3A%20rated%2C%20about%204%20minutes%2C%20for%20ratings%201458%E2%80%931658\.%20https/);
  assert.match(html, /value="https:\/\/www\.sailupdown\.com\/call\/K7M2QZ"/);
  assert.doesNotMatch(plain(html), /Post an open call/);
  assert.doesNotMatch(view(), /Post an open call/, 'only while looking');
});

test('a call that couldn\'t be taken says why, in each case', () => {
  for (const [note, said] of [['taken', /That call has been taken/], ['away', /isn’t looking right now/], ['closed', /That call has closed\./], ['band', /outside that call’s range/], ['mine', /That’s your own call/]]) assert.match(view({ note }), said, note);
  assert.match(view({ phase: 'looking', note: 'nocall' }), /The call couldn’t be posted just now/);
});

test('Keep looking if I leave: off, on (you can leave; Only while I’m here), why it couldn’t; the away marked in Ready now', () => {
  const looking = { phase: 'looking', look: { waited: 30, band: 200, online: 1 } };
  assert.match(view({ ...looking, away: true }), /Looking for you while you’re away You can leave this page\. We’ll message you the moment a sailor is found, for 30 minutes; then a minute to say Ready\. Only while I’m here/);
  assert.doesNotMatch(view({ ...looking, away: true }), /Keep looking if I leave/);
  assert.match(view({ ...looking, note: 'nopush' }), /This browser can’t take the site’s messages\. On an iPhone, add the site to your Home Screen first\./);
  assert.match(view({ ...looking, note: 'pushdenied' }), /Messages from this site are blocked in your browser’s settings/);
  assert.match(view({ ...looking, note: 'noaway' }), /Couldn’t keep looking for you just now/);
  assert.match(view({ ...looking, note: 'nobot' }), /Without the bot’s messages we can’t reach you while you’re away\./);
  assert.match(view({ list: parseReady([{ ...READY[0], away: true }]) }), /Cara M\. away · gets a message National 1900 \d+% .* Race/);
  assert.doesNotMatch(view(), /Keep looking if I leave/, 'only while looking');
});

test('Match found with a minute (one of you was away): the bar is of the minute', () => {
  const p = parseSeek({ status: 'found', pair: { ...PAIR, left: 30, ttl: 60 } }).pair;
  assert.match(renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, phase: 'found', look: { waited: 0, band: 100, online: 1 }, pair: p, said: false, left: 30, note: '', longWait: false, find: noop, stop: noop, ready: noop, decline: noop })), /style="width:50%"/);
});
