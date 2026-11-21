// A sailor's choice of messages (release 5d of the 1-on-1 plan): the database's answer read and the page's choice sent
// cleanly (lib/messages.ts); GET/POST /connect/messages as the session's sailor; the Messages card (components/messages-form.tsx):
// the two switches with what each needs, quiet hours in the browser's time zone; the card on /settings only for a
// signed-in sailor; and /duel saying why "Keep looking if I leave" can't be on. Run: node --test test/messages.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { plain } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
let user = null;
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = { auth: { getUser: async () => ({ data: { user } }) }, rpc: async (fn, args) => { rpc.calls.push({ fn, ...(args || {}) }); return { data: rpc.data, error: rpc.error }; },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
const { NextRequest } = await import('next/server');
const { parseMsg, msgBody } = await import('../lib/messages.ts');
const { GET, POST } = await import('../app/connect/messages/route.ts');
const { MessagesView } = await import('../components/messages-form.tsx');
const settings = await import('../app/[lang]/settings/page.tsx');
const { DuelFinderView } = await import('../components/duel-finder.tsx');

const DB = { push: true, telegram: false, quiet_from: 23, quiet_to: 7, tz: 'Europe/Berlin', browsers: 2, bot: true, quiet_now: false };
const post = async (body, origin) => (await POST(new NextRequest(new URL('/connect/messages', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', ...(origin && { origin }) }, body: JSON.stringify(body) }))).json();
beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; user = null; });

test('the database\'s answer read as it is; the page\'s choice sent cleanly, quiet hours both or neither', () => {
  assert.deepEqual(parseMsg(DB), { push: true, telegram: false, quietFrom: 23, quietTo: 7, tz: 'Europe/Berlin', browsers: 2, bot: true, quietNow: false });
  assert.deepEqual(parseMsg({ ...DB, quiet_to: null }).quietFrom, null);
  for (const bad of [null, {}, { ...DB, push: 'yes' }]) assert.equal(parseMsg(bad), null);
  assert.deepEqual(msgBody({ push: false, telegram: true, quietFrom: 22, quietTo: 8, tz: 'America/New_York' }), { p_push: false, p_telegram: true, p_quiet_from: 22, p_quiet_to: 8, p_tz: 'America/New_York' });
  assert.deepEqual(msgBody({ push: true, telegram: true, quietFrom: 22, quietTo: 22, tz: 'x; drop table' }), { p_push: true, p_telegram: true, p_quiet_from: null, p_quiet_to: null, p_tz: 'UTC' });
  assert.equal(msgBody({ push: 1, telegram: true }), null);
});

test('GET and POST /connect/messages as the session\'s sailor; another site, a bad body or an error is null', async () => {
  rpc.data = DB;
  assert.equal((await (await GET()).json()).tz, 'Europe/Berlin');
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_msg_get' });
  assert.equal((await post({ push: false, telegram: true, quietFrom: 0, quietTo: 9, tz: 'Asia/Tokyo' })).push, true);
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_msg_set', p_push: false, p_telegram: true, p_quiet_from: 0, p_quiet_to: 9, p_tz: 'Asia/Tokyo' });
  rpc.calls = [];
  assert.equal(await post({ push: false, telegram: true }, 'https://evil.example'), null);
  assert.equal(await post({ push: 'no' }), null);
  assert.equal(rpc.calls.length, 0);
  rpc.error = { code: '42501' }; assert.equal(await post({ push: true, telegram: true }), null);
});

const view = (o = {}, lang = 'en') => renderToStaticMarkup(h(MessagesView, { lang, m: { ...parseMsg(DB), ...o }, tz: 'Europe/Berlin', save: () => {} }));

test('the card: two switches with what each needs, quiet hours as chosen, in the browser\'s time', () => {
  const s = view();
  assert.match(plain(s), /1-on-1: Match found while you’re away In the browsers you’ve allowed 2 browsers allowed\. From the Telegram bot The bot can write to you\. Quiet hours Off 22:00–08:00 23:00–07:00 00:00–09:00 In your time \(Europe\/Berlin\): no Match found and no daily reminder in these hours\./);
  assert.match(s, /role="switch" aria-checked="true" aria-labelledby="l-msg-push"/);
  assert.match(s, /role="switch" aria-checked="false" aria-labelledby="l-msg-telegram"/);
  assert.match(s, /role="radio" aria-checked="true" class="on">23:00–07:00/);
  const none = view({ browsers: 0, bot: false, quietFrom: null, quietTo: null, quietNow: false });
  assert.match(plain(none), /None yet: turn on “Keep looking if I leave” on the 1-on-1 page ?\. .* Sign in with Telegram and start the bot to get these there\./);
  assert.match(none, /href="\/duel"/);
  assert.match(none, /role="radio" aria-checked="true" class="on">Off/);
  assert.match(plain(view({ quietNow: true })), /It’s quiet hours now\./);
  assert.match(plain(view({}, 'ru')), /1 на 1: соперник найден, пока тебя нет .* Разрешено браузеров: 2\. .* Тихие часы Выкл\./);
});

test('/settings has the Messages card for a signed-in sailor only', async () => {
  const page = async () => renderToStaticMarkup(await settings.default({ params: Promise.resolve({ lang: 'en' }) }));
  assert.doesNotMatch(await page(), /id="st-msg"/);
  user = { id: 'u', email: 'a@example.com', user_metadata: { display_name: 'Anna' }, app_metadata: {} };
  assert.match(await page(), /<section class="st-card" aria-labelledby="st-msg"><div class="st-card-h"><span class="lbl-ink" id="st-msg">Messages<\/span>/);
});

test('/duel says why Keep looking if I leave can\'t be on: quiet hours, or the messages turned off', () => {
  const n = () => {};
  const v = (note) => plain(renderToStaticMarkup(DuelFinderView({ lang: 'en', signed: true, phase: 'looking', look: { waited: 5, band: 100, online: 1 }, pair: null, said: false, left: 0, note, longWait: false, find: n, stop: n, ready: n, decline: n })));
  assert.match(v('quiet'), /It’s your quiet hours, so we can’t message you now\. You can change them in Settings\./);
  assert.match(v('msgoff'), /Match found messages are off in your Settings\./);
});
