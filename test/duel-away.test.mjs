// Keep looking when you leave (release 5b of the 1-on-1 plan): Match found by push to the away sailor (lib/push-send.ts),
// in their language, sent once per pair, a device the push service says is gone dropped, nothing without the server's
// keys; POST /connect/push-link tying this browser's subscription to the account; POST /connect/seek away, and a pair
// found sending the push; the pair's own time to answer (lib/duel-seek.ts). Run: node --test test/duel-away.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { rpc: async (fn, args) => { rpc.calls.push({ fn, ...(args || {}) }); return { data: rpc.data, error: rpc.error }; } };
const { NextRequest } = await import('next/server');
const { matchFoundMessage, sendMatchFound, telegramNotice } = await import('../lib/push-send.ts');
const { POST: link } = await import('../app/connect/push-link/route.ts');
const { POST: seek } = await import('../app/connect/seek/route.ts');
const { parseSeek, parseReady } = await import('../lib/duel-seek.ts');

const ROW = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'B'.repeat(87), auth: 'A'.repeat(22), lang: 'en', them_name: 'Bea K.', them_rating: 1585, them_races: 40, ttl: 60 };
const req = (path, body, origin) => new NextRequest(new URL(path, 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', ...(origin && { origin }) }, body: JSON.stringify(body) });
let rest = [];
const realFetch = globalThis.fetch;
beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; rest = []; globalThis.fetch = realFetch; delete process.env.PUSH_LIST_KEY; delete process.env.VAPID_PRIVATE_KEY; });
const restAnswers = (answers) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.invalid'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  globalThis.fetch = async (u, init) => { const fn = String(u).split('/rpc/')[1]; rest.push({ fn, ...JSON.parse(init.body) }); return Response.json(answers[fn] ?? null); };
};

test('Match found, as the away sailor reads it: who, rating and level, and the minute; in their language', () => {
  assert.deepEqual(matchFoundMessage(ROW), { title: 'Match found: Bea K.', body: '1585 · Fleet. Tap within 60 s to say Ready.', lang: 'en', tag: 'duel-found', url: '/duel?resume', sticky: true });
  const ru = matchFoundMessage({ ...ROW, lang: 'ru', them_races: 2, them_rating: 1508 });
  assert.equal(ru.title, 'Соперник найден: Bea K.'); assert.equal(ru.body, '~1508 · новичок в 1 на 1. Нажми в течение 60 с, чтобы ответить «Готов».');
  assert.equal(matchFoundMessage({ ...ROW, lang: 'xx', them_name: null }).title, 'Match found: A sailor');
});

test('sendMatchFound: the pair\'s away devices from the database with the key, each sent once with its minute; a gone one dropped', async () => {
  process.env.PUSH_LIST_KEY = 'list-key'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43);
  restAnswers({ regatta_pair_push: [ROW, { ...ROW, endpoint: 'https://fcm.googleapis.com/fcm/send/gone', lang: 'de' }] });
  const sent = [];
  const n = await sendMatchFound('0b8f1c2e-1111-4222-8333-944455556666', async (sub, payload, o) => {
    if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    sent.push({ sub, payload: JSON.parse(payload), o });
  });
  assert.equal(n, 1);
  assert.deepEqual(rest[0], { fn: 'regatta_pair_push', p_key: 'list-key', p_pair: '0b8f1c2e-1111-4222-8333-944455556666' });
  assert.deepEqual(sent[0].sub, { endpoint: ROW.endpoint, keys: { p256dh: ROW.p256dh, auth: ROW.auth } });
  assert.equal(sent[0].payload.url, '/duel?resume'); assert.deepEqual(sent[0].o, { TTL: 60, urgency: 'high', topic: 'duel-found' });
  assert.deepEqual(rest.at(-1), { fn: 'regatta_push_drop', p_endpoint: 'https://fcm.googleapis.com/fcm/send/gone' });
});

test('sendMatchFound sends nothing without the server\'s keys, for a pair with nobody away, or when the database fails', async () => {
  restAnswers({ regatta_pair_push: [ROW] });
  assert.equal(await sendMatchFound('p', async () => { throw new Error('not to be called'); }), 0);
  assert.equal(rest.length, 0, 'not even asked');
  process.env.PUSH_LIST_KEY = 'k'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43);
  restAnswers({ regatta_pair_push: [] });
  assert.equal(await sendMatchFound('p', async () => { throw new Error('not to be called'); }), 0);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await sendMatchFound('p'), 0);
});

test('POST /connect/push-link ties a saved subscription to the session\'s sailor; anything else links nothing', async () => {
  rpc.data = true;
  assert.deepEqual(await (await link(req('/connect/push-link', { endpoint: ROW.endpoint }))).json(), { linked: true });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_push_link', p_endpoint: ROW.endpoint });
  for (const body of [{}, { endpoint: 'http://x.example/y' }, { endpoint: 42 }]) { rpc.calls = []; assert.deepEqual(await (await link(req('/connect/push-link', body))).json(), { linked: false }); assert.equal(rpc.calls.length, 0, JSON.stringify(body)); }
  rpc.calls = [];
  assert.deepEqual(await (await link(req('/connect/push-link', { endpoint: ROW.endpoint }, 'https://evil.example'))).json(), { linked: false });
  assert.equal(rpc.calls.length, 0);
});

test('POST /connect/seek away: on, off, and why not; a pair found sends the away sailor their push', async () => {
  rpc.data = { status: 'away', left: 1800, devices: 1 };
  assert.deepEqual(await (await seek(req('/connect/seek', { do: 'away', on: true }))).json(), { status: 'away', left: 1800 });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_seek_away', p_on: true });
  rpc.data = { status: 'here' };
  assert.deepEqual(await (await seek(req('/connect/seek', { do: 'away', on: 'yes' }))).json(), { status: 'here' });
  assert.equal(rpc.calls.at(-1).p_on, false, 'only true is on');
  rpc.data = { status: 'none', reason: 'no_push' };
  assert.deepEqual(await (await seek(req('/connect/seek', { do: 'away', on: true }))).json(), { status: 'none', reason: 'no_push' });
  process.env.PUSH_LIST_KEY = 'k'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43);
  restAnswers({ regatta_pair_push: [] });
  const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
  rpc.data = { status: 'found', pair: { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'host', settings: SETTINGS, them: { name: 'Bea', rating: 1500, races: 9 }, me: { rating: 1500, races: 9, ok: null }, them_ok: null, left: 60, ttl: 60, minutes: 4 } };
  assert.equal((await (await seek(req('/connect/seek', { do: 'seek' }))).json()).status, 'found');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(rest.map((x) => x.fn), ['regatta_pair_push']);
});

test('a pair\'s own time to answer: a minute when one was away, else 12 s; looking says whether you\'re looked for away; Ready now marks the away', () => {
  const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
  const pair = (o) => parseSeek({ status: 'found', pair: { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'guest', settings: SETTINGS, them: { name: 'B', rating: 1500, races: 9 }, me: { rating: 1500, races: 9, ok: null }, them_ok: null, minutes: 4, ...o } }).pair;
  assert.deepEqual([pair({ left: 40, ttl: 60 }).left, pair({ left: 40, ttl: 60 }).ttl], [40, 60]);
  assert.deepEqual([pair({ left: 40 }).left, pair({ left: 40 }).ttl], [12, 12]);
  assert.equal(parseSeek({ status: 'looking', waited: 3, band: 100, online: 1, near: 0, away: true }).away, true);
  assert.equal(parseSeek({ status: 'looking', waited: 3, band: 100, online: 1, near: 0 }).away, false);
  assert.deepEqual(parseReady([{ handle: '3f9a0c1d2e4b', name: 'A', rating: 1500, races: 1, waited: 9, away: true }, { handle: 'a1b2c3d4e5f6', name: 'B', rating: 1500, races: 1, waited: 9 }]).map((r) => r.away), [true, false]);
});

test('the bot\'s Match found: the title and body as one message, a button to /duel?resume, in the sailor\'s language', () => {
  assert.deepEqual(telegramNotice({ ...ROW, kind: 'telegram', endpoint: null, p256dh: null, auth: null, telegram_id: 990000001 }),
    { telegram_id: 990000001, text: 'Match found: Bea K.\n1585 · Fleet. Tap within 60 s to say Ready.', button: { text: 'Open Match found', url: 'https://www.sailupdown.com/duel?resume' } });
  assert.equal(telegramNotice({ ...ROW, lang: 'ru', telegram_id: 1 }).button.text, 'Открыть: соперник найден');
});

test('sendMatchFound: a Telegram row goes to the bot\'s server with the shared secret; without the secret it is left', async () => {
  process.env.PUSH_LIST_KEY = 'k'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43);
  const TG = { ...ROW, kind: 'telegram', endpoint: null, p256dh: null, auth: null, telegram_id: 990000001 };
  restAnswers({ regatta_pair_push: [TG, { ...ROW, kind: 'push' }] });
  const told = [], pushed = [];
  assert.equal(await sendMatchFound('p', async (sub) => { pushed.push(sub.endpoint); }, async (b) => { told.push(b); return new Response(null, { status: 200 }); }), 1, 'no secret: only the push');
  assert.deepEqual([told.length, pushed.length], [0, 1]);
  process.env.REGATTA_NOTIFY_SECRET = 'shared';
  restAnswers({ regatta_pair_push: [TG] });
  assert.equal(await sendMatchFound('p', async () => {}, async (b) => { told.push(b); return Response.json({ sent: true }); }), 1);
  assert.equal(told[0].telegram_id, 990000001);
  restAnswers({ regatta_pair_push: [TG] });
  assert.equal(await sendMatchFound('p', async () => {}, async () => { throw new Error('down'); }), 0, 'the bot\'s server down: nothing, and no throw');
  process.env.REGATTA_NOTIFY_SECRET = '';
});
