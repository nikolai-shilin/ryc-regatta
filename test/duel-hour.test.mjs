// The duel hour (release 6d of the 1-on-1 plan): every day 19:00–20:00 UTC (lib/duel-hour.ts); its box in Ready now on
// /duel (components/duel-hour.tsx) counting down, then on, with who's in and near your level, I'm in (asking this
// browser for messages when nothing reaches the sailor yet) and Not tonight; the message 15 minutes before
// (lib/push-send.ts sendDuelHour, app/push/hour, the cron at 18:45 UTC) by push and from the bot, in the sailor's
// language; its tap, /duel?hour, looking at once; POST /connect/seek hour and hour_in. Run: node --test test/duel-hour.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from './load.mjs';
import { click, dom, done, h, json, mount, reset, serve, tick, clock } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const sbStub = { rpc: async (fn, args) => { rpc.calls.push({ fn, ...(args || {}) }); return { data: rpc.data, error: rpc.error }; } };
const { hourAt, hms, parseHour, hourMessage } = await import('../lib/duel-hour.ts');
const { DuelHour } = await import('../components/duel-hour.tsx');
const { DuelFinder } = await import('../components/duel-finder.tsx');
const { sendDuelHour } = await import('../lib/push-send.ts');
const { NextRequest } = await import('next/server');
const { POST: seek } = await import('../app/connect/seek/route.ts');
const { GET: cron } = await import('../app/push/hour/route.ts');

const at = (iso) => Date.parse(iso);
let state = {};
const asks = () => dom.fetches.filter((f) => f.url === '/connect/seek').map((f) => JSON.parse(f.init.body));
beforeEach(() => {
  reset({ url: 'https://updown.test/duel', at: at('2026-11-21T17:38:56Z') });
  state = { hour: { day: '2026-11-21', in: 5, near: 2, me: false, reach: true }, hour_in: null, ready_now: { list: [] }, seek: { status: 'looking', waited: 0, band: 100, online: 1, near: 0 } };
  serve([['/connect/seek', (u, init) => { const b = JSON.parse(init.body); return json(b.do === 'hour_in' ? { hour: { ...state.hour, me: b.on, in: state.hour.in + (b.on ? 1 : 0) } } : b.do === 'hour' ? { hour: state.hour } : state[b.do] ?? { status: 'none', reason: null }); }]]);
});
afterEach(done);

test('the hour: 19:00 to 20:00 UTC, on or counted down to; the day after once it is over', () => {
  assert.deepEqual(hourAt(at('2026-11-21T18:00:00Z')), { on: false, start: at('2026-11-21T19:00:00Z'), end: at('2026-11-21T20:00:00Z'), left: 3600e3 });
  assert.deepEqual(hourAt(at('2026-11-21T19:30:00Z')), { on: true, start: at('2026-11-21T19:00:00Z'), end: at('2026-11-21T20:00:00Z'), left: 1800e3 });
  assert.equal(hourAt(at('2026-11-21T20:00:00Z')).start, at('2026-11-22T19:00:00Z'));
  assert.equal(hourAt(at('2026-11-21T23:00:00Z')).left, 20 * 3600e3);
  assert.deepEqual([hms(4864e3), hms(61e3), hms(0), hms(999)], ['1:21:04', '1:01', '0:00', '0:01']);
  assert.deepEqual(parseHour({ day: '2026-11-21', in: 3, near: 1, me: true, reach: false }), { day: '2026-11-21', in: 3, near: 1, me: true, reach: false });
  assert.deepEqual(parseHour({ day: '2026-11-21', in: 3 }), { day: '2026-11-21', in: 3, near: null, me: false, reach: false });
  for (const bad of [null, {}, { day: 'x', in: 1 }, { day: '2026-11-21', in: -1 }, { day: '2026-11-21', in: 1.5 }]) assert.equal(parseHour(bad), null);
});

test('the box: counted down in your own time, who is in and near your level, and I\'m in', async () => {
  const v = await mount(h(DuelHour, { lang: 'en', signed: true, looking: false, onFind: () => {} }));
  assert.match(v.text(), /Duel hour · every day · 19:00 UTC Starts in 1:21:04 .+ your time, for an hour 5 in · 2 at your level I’m in · remind me/);
  await tick(1000);
  assert.match(v.text(), /Starts in 1:21:03/);
  await click(v.$('.df-hour button'));
  assert.deepEqual(asks().at(-1), { do: 'hour_in', on: true });
  assert.match(v.text(), /6 in · 2 at your level You’re in\. A message 15 minutes before, to this browser or from our Telegram bot\. Not tonight/);
  await click(v.$('.df-hour button'));
  assert.deepEqual(asks().at(-1), { do: 'hour_in', on: false });
  assert.match(v.text(), /5 in · 2 at your level I’m in · remind me/);
  await tick(60000);
  assert.equal(asks().filter((a) => a.do === 'hour').length, 2, 'read again each minute');
  await v.unmount();
});

test('in, with nothing to message: this browser can\'t take messages, so come back at 19:00', async () => {
  state.hour.reach = false;
  const v = await mount(h(DuelHour, { lang: 'en', signed: true, looking: false, onFind: () => {} }));
  await click(v.$('.df-hour button'));
  assert.match(v.text(), /You’re in\. Nothing can message you yet, so come back at 19:00 UTC\..*This browser can’t take messages, so come back at 19:00 UTC\./);
  await v.unmount();
});

test('while it\'s on: on now, the time left, and Find a race now', async () => {
  clock.set('2026-11-21T19:40:00Z');
  let found = 0;
  const v = await mount(h(DuelHour, { lang: 'en', signed: true, looking: false, onFind: () => { found++; } }));
  assert.match(v.text(), /On now until .+ your time · 20:00 left 5 in · 2 at your level Find a race now/);
  assert.ok(v.$('.df-hour.on'));
  await click(v.$('.df-hour button'));
  assert.equal(found, 1);
  await v.rerender(h(DuelHour, { lang: 'en', signed: true, looking: true, onFind: () => {} }));
  assert.equal(v.$('.df-hour button'), null, 'not while looking');
  await v.unmount();
});

test('signed out: the hour and how to be in, and nothing asked', async () => {
  const v = await mount(h(DuelHour, { lang: 'en', signed: false, looking: false, onFind: () => {} }));
  assert.match(v.text(), /Starts in 1:21:04 .+ Sign in to say you’re in\./);
  assert.equal(asks().length, 0);
  await v.unmount();
});

test('on /duel: in Ready now, marked while it\'s on; its message\'s tap, /duel?hour, looks at once', async () => {
  reset({ url: 'https://updown.test/duel?hour', at: at('2026-11-21T19:05:00Z') });
  serve([['/connect/seek', (u, init) => { const d = JSON.parse(init.body).do; return json(d === 'hour' ? { hour: state.hour } : state[d] ?? { status: 'none', reason: null }); }]]);
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  assert.ok(asks().some((a) => a.do === 'seek'), 'looking');
  assert.deepEqual(history.replaced, ['/duel']);
  assert.match(v.text(), /Ready now · \d+ Duel hour .*Duel hour · every day · 19:00 UTC On now/);
  await v.unmount();
});

test('the message: how many more are in, and the tap that looks; in the sailor\'s language', () => {
  assert.deepEqual(hourMessage('en', 5), { title: 'The duel hour starts in 15 minutes', body: '4 more sailors are in tonight. 19:00–20:00 UTC: tap to find a race.', lang: 'en', tag: 'duel-hour', url: '/duel?hour', button: 'Find a race' });
  assert.equal(hourMessage('en', 2).body, '1 more sailor is in tonight. 19:00–20:00 UTC: tap to find a race.');
  assert.equal(hourMessage('en', 1).body, '19:00–20:00 UTC: tap to find a race.');
  assert.equal(hourMessage('ru', 3).title, 'Час дуэлей через 15 минут');
  assert.equal(hourMessage('xx', 1).lang, 'en');
});

test('sendDuelHour: the day\'s rows from the database with the key, by push and from the bot; a gone browser dropped', async () => {
  const real = globalThis.fetch, rest = [], bot = [], sent = [];
  process.env.PUSH_LIST_KEY = 'list-key'; process.env.VAPID_PRIVATE_KEY = 'x'.repeat(43); process.env.REGATTA_NOTIFY_SECRET = 's';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.invalid'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  const P = { kind: 'push', p256dh: 'B'.repeat(87), auth: 'A'.repeat(22), telegram_id: null, n_in: 3 };
  globalThis.fetch = async (u, init) => { const fn = String(u).split('/rpc/')[1]; rest.push({ fn, ...JSON.parse(init.body) }); return Response.json(fn === 'regatta_hour_due'
    ? [{ ...P, endpoint: 'https://fcm.googleapis.com/fcm/send/a', lang: 'ru' }, { ...P, endpoint: 'https://fcm.googleapis.com/fcm/send/gone', lang: 'en' }, { kind: 'telegram', endpoint: null, p256dh: null, auth: null, telegram_id: 77, lang: 'en', n_in: 3 }] : null); };
  try {
    const out = await sendDuelHour('2026-11-21', async (sub, payload, o) => {
      if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ sub, payload: JSON.parse(payload), o });
    }, async (b) => { bot.push(b); return new Response('{}'); });
    assert.deepEqual(out, { day: '2026-11-21', due: 3, sent: 2, gone: 1, failed: 0 });
    assert.deepEqual(rest[0], { fn: 'regatta_hour_due', p_key: 'list-key', p_day: '2026-11-21' });
    assert.deepEqual(sent[0].payload, { title: 'Час дуэлей через 15 минут', body: 'Сегодня с тобой ещё 2. 19:00–20:00 UTC: нажми, чтобы найти гонку.', lang: 'ru', tag: 'duel-hour', url: '/duel?hour' });
    assert.deepEqual(sent[0].o, { TTL: 4500, urgency: 'high', topic: 'duel-hour' });
    assert.deepEqual(bot[0], { telegram_id: 77, text: 'The duel hour starts in 15 minutes\n2 more sailors are in tonight. 19:00–20:00 UTC: tap to find a race.', button: { text: 'Find a race', url: 'https://www.sailupdown.com/duel?hour' } });
    assert.deepEqual(rest.at(-1), { fn: 'regatta_push_drop', p_endpoint: 'https://fcm.googleapis.com/fcm/send/gone' });
    delete process.env.PUSH_LIST_KEY;
    assert.match((await sendDuelHour('2026-11-21')).error, /PUSH_LIST_KEY/);
  } finally { globalThis.fetch = real; delete process.env.VAPID_PRIVATE_KEY; delete process.env.REGATTA_NOTIFY_SECRET; }
});

test('the cron: only with its secret, for the day of the next hour, at 18:45 UTC', async () => {
  process.env.CRON_SECRET = 'cron';
  assert.equal((await cron(new Request('https://x/push/hour'))).status, 401);
  assert.equal((await cron(new Request('https://x/push/hour', { headers: { authorization: 'Bearer nope' } }))).status, 401);
  const r = await cron(new Request('https://x/push/hour', { headers: { authorization: 'Bearer cron' } }));
  assert.equal(r.status, 500); assert.match((await r.json()).error, /not set/, 'without the keys: said, nothing sent');
  const crons = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).crons;
  assert.deepEqual(crons.find((c) => c.path === '/push/hour'), { path: '/push/hour', schedule: '45 18 * * *' });
  delete process.env.CRON_SECRET;
});

test('POST /connect/seek hour and hour_in: the database\'s state, read and checked', async () => {
  globalThis.__sb = sbStub;
  const req = (body) => new NextRequest(new URL('/connect/seek', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com' }, body: JSON.stringify(body) });
  rpc.data = { day: '2026-11-21', in: 4, near: 1, me: false, reach: true };
  assert.deepEqual(await (await seek(req({ do: 'hour' }))).json(), { hour: { day: '2026-11-21', in: 4, near: 1, me: false, reach: true } });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_hour_state' });
  await seek(req({ do: 'hour_in', on: true }));
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_hour_join', p_in: true });
  await seek(req({ do: 'hour_in', on: 'yes' }));
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_hour_join', p_in: false }, 'only true is in');
  rpc.error = { message: 'x' };
  assert.deepEqual(await (await seek(req({ do: 'hour' }))).json(), { hour: null });
});
