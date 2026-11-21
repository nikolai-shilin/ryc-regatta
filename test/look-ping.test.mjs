// "A sailor at your level is looking" (release 8c of the 1-on-1 plan: For you's live message; lib/push-send.ts
// sendLookPing, app/connect/seek): the message in the sailor's language with the tap that challenges the searcher; the
// database's rows sent by push and from the bot, a gone browser dropped, a bad handle skipped, nothing without the keys;
// and the seek route setting it off only for a search just begun with nobody near. Run: node --test test/look-ping.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const rpc = { data: null, error: null, claims: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { rpc: async () => ({ data: rpc.data, error: rpc.error }), auth: { getClaims: async () => ({ data: rpc.claims ? { claims: rpc.claims } : null }) } };
const { lookMessage, sendLookPing } = await import('../lib/push-send.ts');
const { NextRequest } = await import('next/server');
const { POST: seek } = await import('../app/connect/seek/route.ts');

const SEEKER = '0b8f1c2e-1111-4222-8333-944455556666', H = '3f9a0c1d2e4b';
const ROW = { kind: 'push', endpoint: 'https://fcm.googleapis.com/fcm/send/a', p256dh: 'B'.repeat(87), auth: 'A'.repeat(22), telegram_id: null, lang: 'en', them_name: 'Cara M.', them_rating: 1540, them_races: 12, handle: H };
let rest = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
  rest = []; rpc.data = null; rpc.error = null; rpc.claims = null; globalThis.fetch = realFetch;
  delete process.env.PUSH_LIST_KEY; delete process.env.VAPID_PRIVATE_KEY; delete process.env.REGATTA_NOTIFY_SECRET;
});
const restAnswers = (rows) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.invalid'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  globalThis.fetch = async (u, init) => { const fn = String(u).split('/rpc/')[1]; rest.push({ fn, ...JSON.parse(init.body) }); return Response.json(fn === 'regatta_ping_due' ? rows : null); };
};
const keys = () => { process.env.PUSH_LIST_KEY = 'list-key'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43); process.env.REGATTA_NOTIFY_SECRET = 's'; };

test('the message: who, their rating and level, and the tap that challenges them; in the sailor\'s language', () => {
  assert.deepEqual(lookMessage(ROW), { title: 'Cara M. is looking for a race', body: '1540 · Fleet, near your rating. Tap to race them now.', lang: 'en', tag: 'duel-look', url: `/duel?challenge=${H}`, button: 'Race them' });
  assert.equal(lookMessage({ ...ROW, lang: 'ru', them_races: 2 }).body, '~1540 · новичок в 1 на 1, рядом с твоим рейтингом. Нажми, чтобы сразиться.');
  assert.equal(lookMessage({ ...ROW, them_name: null }).title, 'A sailor is looking for a race');
});

test('sendLookPing: the database\'s rows by push and from the bot, five minutes to live; a gone browser dropped, a bad handle skipped', async () => {
  keys();
  restAnswers([ROW, { ...ROW, endpoint: 'https://fcm.googleapis.com/fcm/send/gone' }, { ...ROW, handle: 'nope' },
    { kind: 'telegram', endpoint: null, p256dh: null, auth: null, telegram_id: 77, lang: 'en', them_name: 'Cara M.', them_rating: 1540, them_races: 12, handle: H }]);
  const sent = [], bot = [];
  const n = await sendLookPing(SEEKER, async (sub, payload, o) => {
    if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    sent.push({ payload: JSON.parse(payload), o });
  }, async (b) => { bot.push(b); return new Response('{}'); });
  assert.equal(n, 2);
  assert.deepEqual(rest[0], { fn: 'regatta_ping_due', p_key: 'list-key', p_seeker: SEEKER });
  assert.equal(sent.length, 1); assert.equal(sent[0].payload.url, `/duel?challenge=${H}`); assert.deepEqual(sent[0].o, { TTL: 300, urgency: 'high', topic: 'duel-look' });
  assert.deepEqual(bot[0].button, { text: 'Race them', url: `https://www.sailupdown.com/duel?challenge=${H}` });
  assert.deepEqual(rest.at(-1), { fn: 'regatta_push_drop', p_endpoint: 'https://fcm.googleapis.com/fcm/send/gone' });
});

test('sendLookPing sends nothing without the keys, for a seeker not shaped as an account, or when the database fails', async () => {
  restAnswers([ROW]);
  assert.equal(await sendLookPing(SEEKER, async () => { throw new Error('not to be called'); }), 0);
  assert.equal(rest.length, 0, 'not even asked');
  keys();
  assert.equal(await sendLookPing('../x', async () => { throw new Error('not to be called'); }), 0);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await sendLookPing(SEEKER), 0);
});

test('the seek route sets it off for a search just begun with nobody near, and not otherwise', async () => {
  keys(); restAnswers([]);
  const req = (body) => new NextRequest(new URL('/connect/seek', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com' }, body: JSON.stringify(body) });
  rpc.claims = { sub: SEEKER };
  const look = (o) => ({ status: 'looking', waited: 0, band: 100, online: 1, near: 0, ...o });
  rpc.data = look();
  await seek(req({ do: 'seek' }));
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(rest.map((x) => x.fn), ['regatta_ping_due']);
  for (const [data, body, why] of [[look({ near: 1 }), { do: 'seek' }, 'someone near is looking'], [look({ waited: 30 }), { do: 'seek' }, 'long under way'], [look(), { do: 'ready_now' }, 'not a search']]) {
    rest = []; rpc.data = data;
    await seek(req(body)); await new Promise((r) => setTimeout(r, 10));
    assert.equal(rest.filter((x) => x.fn === 'regatta_ping_due').length, 0, why);
  }
  rest = []; rpc.data = look(); rpc.claims = null;
  await seek(req({ do: 'seek' })); await new Promise((r) => setTimeout(r, 10));
  assert.equal(rest.length, 0, 'no session, no message');
  // the search's answer never fails with it: a session that can't be read still gets "looking"
  const real = globalThis.__sb.auth.getClaims;
  globalThis.__sb.auth.getClaims = async () => { throw new Error('down'); };
  try { assert.equal((await (await seek(req({ do: 'seek' }))).json()).status, 'looking'); }
  finally { globalThis.__sb.auth.getClaims = real; }
});
