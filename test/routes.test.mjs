// The site's route handlers, each called as Next calls it, with Supabase, the scores server and the push service stood
// in for: who may sign in and where they are sent afterwards, what the game is told, what an admin's settings let onto
// the sails, the daily reminder, and the text served to AI assistants.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';

mock('lib/supabase/server.ts', 'export const supabaseServer = async () => { if (globalThis.__supabase instanceof Error) throw globalThis.__supabase; return globalThis.__supabase; };');
mock('web-push', `export default {
  setVapidDetails: (...a) => { globalThis.__push.vapid = a; },
  sendNotification: (...a) => globalThis.__push.send(...a),
};`);

const { NextRequest } = await import('next/server');
const SITE = 'https://www.sailupdown.com';
const req = (path, init) => new NextRequest(new URL(path, SITE), init);
const where = (res) => { const u = new URL(res.headers.get('location'), SITE); return u.origin === SITE ? u.pathname + u.search : u.href; };

// the session as Supabase would answer for it
function supabase({ sub = null, token = null, user = null, exchange = null, otpError = null } = {}) {
  const calls = [];
  globalThis.__supabase = { calls, auth: {
    getClaims: async () => ({ data: sub ? { claims: { sub } } : null }),
    getSession: async () => ({ data: { session: token ? { access_token: token, expires_at: 1900000000 } : null } }),
    getUser: async () => ({ data: { user } }),
    signOut: async () => { calls.push(['signOut']); },
    exchangeCodeForSession: async (code) => { calls.push(['exchange', code]); return exchange ?? { data: {}, error: new Error('bad code') }; },
    verifyOtp: async (o) => { calls.push(['verifyOtp', o]); return { error: otpError }; },
  } };
  return calls;
}
// every fetch answered by fn(url, options), and kept
let sent = [];
const answer = (fn) => { sent = []; globalThis.fetch = async (u, o) => { sent.push({ url: String(u), o }); return fn(String(u), o); }; };
const json = (v, status = 200) => Response.json(v, { status });
const noFetch = () => answer(() => { throw new Error('nothing should be fetched'); });

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub-key';
  noFetch();
});

// ---------- /auth/callback ----------
const callback = (await import('../app/auth/callback/route.ts')).GET;

test('the sign-in callback: no code, or one Supabase refuses, goes back to sign-in and keeps where you were going', async () => {
  supabase();
  assert.equal(where(await callback(req('/auth/callback?next=/boat'))), '/sign-in?error=1&next=%2Fboat');
  assert.equal(where(await callback(req('/auth/callback?code=bad&next=/boat'))), '/sign-in?error=1&next=%2Fboat');
});

test('the sign-in callback: a sailor with a name goes on, a first sign-in is asked for one', async () => {
  supabase({ exchange: { data: { user: { user_metadata: { display_name: 'Anna' } } }, error: null } });
  assert.equal(where(await callback(req('/auth/callback?code=c&next=/boat'))), '/boat');
  supabase({ exchange: { data: { user: { user_metadata: {} } }, error: null } });
  assert.equal(where(await callback(req('/auth/callback?code=c&next=/boat'))), '/sign-in/name?next=%2Fboat');
});

test('the sign-in callback never sends anyone to another site', async () => {
  supabase({ exchange: { data: { user: { user_metadata: { display_name: 'Anna' } } }, error: null } });
  for (const next of ['//evil.test', 'https://evil.test', '/\\evil.test', '/\t/evil.test']) {
    assert.equal(where(await callback(req(`/auth/callback?code=c&next=${encodeURIComponent(next)}`))), '/race', next);
  }
});

// ---------- /auth/player ----------
const player = (await import('../app/auth/player/route.ts')).GET;

test('your card\'s key: a guest, or a claim with no session, gets nothing and the scores server isn\'t asked', async () => {
  supabase();
  let r = await player();
  assert.equal(r.status, 204); assert.equal(r.headers.get('cache-control'), 'private, no-store');
  supabase({ sub: 'u1' });
  assert.equal((await player()).status, 204);
  assert.equal(sent.length, 0);
});

test('your card\'s key is asked for with your own token, and is never cached', async () => {
  supabase({ sub: 'u1', token: 'tok' });
  answer(() => json({ k: 'abc_DEF-123' }));
  const r = await player();
  assert.deepEqual(await r.json(), { k: 'abc_DEF-123' });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.match(sent[0].url, /\?me$/);
  assert.equal(sent[0].o.headers.authorization, 'Bearer tok');
});

test('your card\'s key: a malformed key, an error or a dead server all answer 204', async () => {
  supabase({ sub: 'u1', token: 'tok' });
  for (const fn of [() => json({ k: '../../etc' }), () => json({ k: 7 }), () => json({}), () => json({ k: 'abc' }, 500), () => { throw new Error('down'); }, () => new Response('not json')]) {
    answer(fn);
    assert.equal((await player()).status, 204);
  }
});

// ---------- /auth/sign-out ----------
const signOut = (await import('../app/auth/sign-out/route.ts')).POST;
const leave = (next) => req('/auth/sign-out', { method: 'POST', ...(next !== undefined && { body: new URLSearchParams({ next }) }) });

test('signing out ends the session and goes back to the page it was asked from', async () => {
  const calls = supabase();
  const r = await signOut(leave('/boat?x=1'));
  assert.deepEqual(calls, [['signOut']]);
  assert.equal(r.status, 303);
  assert.equal(where(r), '/boat?x=1');
});

test('signing out with no page named goes to the race hub', async () => {
  supabase();
  assert.equal(where(await signOut(leave())), '/race');
  assert.equal(where(await signOut(leave(''))), '/race');
});

test('signing out refuses an address on another site', async () => {
  supabase();
  for (const next of ['//evil.test', 'https://evil.test', '/\\evil.test']) assert.equal(where(await signOut(leave(next))), '/race', next);
});

test('signing out refuses an address a browser reads as another site once it drops a tab or newline', async () => {
    supabase();
    for (const next of ['/\t/evil.test', '/\n/evil.test', '/\r/evil.test']) assert.equal(where(await signOut(leave(next))), '/race', JSON.stringify(next));
  });

// ---------- /auth/telegram ----------
const telegram = (await import('../app/auth/telegram/route.ts')).POST;
const launch = (id) => new URLSearchParams({ user: JSON.stringify({ id }), hash: 'h' }).toString();
const tg = (body, headers = {}) => req('/auth/telegram', { method: 'POST', headers: { host: 'www.sailupdown.com', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('Telegram sign-in: another site can\'t post it, whatever it sends', async () => {
  supabase();
  for (const origin of ['https://evil.test', 'not a url']) {
    const r = await telegram(tg({ initData: launch(1) }, { origin }));
    assert.equal(r.status, 403, origin);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.equal(sent.length, 0);
});

test('Telegram sign-in: anything but JSON with launch data is a bad request', async () => {
  supabase();
  assert.equal((await telegram(tg('initData=1', { 'content-type': 'text/plain' }))).status, 400);
  for (const body of ['{broken', {}, { initData: 5 }, { initData: '' }]) assert.equal((await telegram(tg(body))).status, 400);
  assert.equal(sent.length, 0);
});

test('Telegram sign-in: someone already signed in stays as they are', async () => {
  supabase({ user: { app_metadata: {} } }); // with Google or email
  assert.deepEqual(await (await telegram(tg({ initData: launch(5) }))).json(), { changed: false });
  supabase({ user: { app_metadata: { telegram_id: 5 } } }); // this same Telegram account
  assert.deepEqual(await (await telegram(tg({ initData: launch(5) }, { origin: SITE }))).json(), { changed: false });
  assert.equal(sent.length, 0);
});

test('Telegram sign-in: another Telegram account is switched to, and the token it answers is verified', async () => {
  const calls = supabase({ user: { app_metadata: { telegram_id: 5 } } });
  answer(() => json({ token_hash: 'hash' }));
  const r = await telegram(tg({ initData: launch(6) }));
  assert.deepEqual(await r.json(), { changed: true });
  assert.deepEqual(JSON.parse(sent[0].o.body), { initData: launch(6) });
  assert.deepEqual(calls, [['verifyOtp', { token_hash: 'hash', type: 'magiclink' }]]);
});

test('Telegram sign-in: launch data with no readable user is not taken for the same account', async () => {
  supabase({ user: { app_metadata: { telegram_id: 5 } } });
  answer(() => json({ token_hash: 'hash' }));
  assert.deepEqual(await (await telegram(tg({ initData: 'user=%7Bbroken' }))).json(), { changed: true });
});

test('Telegram sign-in: launch data is cut to 4 KB before it goes on', async () => {
  supabase();
  answer(() => json({ token_hash: 'hash' }));
  await telegram(tg({ initData: 'x'.repeat(9000) }));
  assert.equal(JSON.parse(sent[0].o.body).initData.length, 4096);
});

test('Telegram sign-in: what the sign-in server says becomes the answer', async () => {
  const cases = [[() => json({}, 403), 403], [() => json({}, 400), 403], [() => json({}, 500), 502], [() => json({}), 502], [() => json({ token_hash: 7 }), 502],
    [() => new Response('nope'), 502], [() => { throw new Error('down'); }, 502]];
  for (const [fn, status] of cases) {
    supabase();
    answer(fn);
    assert.equal((await telegram(tg({ initData: launch(1) }))).status, status);
  }
  supabase({ otpError: new Error('expired') });
  answer(() => json({ token_hash: 'hash' }));
  assert.equal((await telegram(tg({ initData: launch(1) }))).status, 502);
});

// ---------- /auth/token ----------
const token = (await import('../app/auth/token/route.ts')).GET;

test('the game\'s token: only for a signed-in player, and never cached', async () => {
  supabase();
  assert.equal((await token()).status, 204);
  supabase({ sub: 'u1' });
  assert.equal((await token()).status, 204);
  supabase({ sub: 'u1', token: 'tok' });
  const r = await token();
  assert.deepEqual(await r.json(), { token: 'tok', expires: 1900000000 });
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

// ---------- /connect ----------
const connect = (await import('../app/connect/route.ts')).GET;

test('/connect tells the game the project, the key, the name and the build', async () => {
  delete process.env.VERCEL_GIT_COMMIT_SHA; delete process.env.VERCEL_DEPLOYMENT_ID;
  supabase({ user: { user_metadata: { display_name: 'Anna' } } });
  const r = await connect();
  assert.deepEqual(await r.json(), { url: 'https://proj.supabase.test', key: 'pub-key', name: 'Anna', canHost: true, build: 'dev' });
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('/connect: hosting a 1-on-1 race takes an account, with or without a ranking name', async () => {
  supabase({ user: { id: 'u1', user_metadata: {} } });
  const named = await (await connect()).json();
  assert.equal(named.canHost, true);
  assert.equal(named.name, null);
});

test('/connect: a guest may not host, and nor may anyone while Supabase can\'t say who they are', async () => {
  supabase();
  assert.equal((await (await connect()).json()).canHost, false);
  globalThis.__supabase = new Error('down');
  assert.equal((await (await connect()).json()).canHost, false);
});

test('/connect: a guest has no name, even when Supabase can\'t be reached', async () => {
  supabase();
  assert.equal((await (await connect()).json()).name, null);
  globalThis.__supabase = new Error('down');
  const r = await connect();
  assert.equal(r.status, 200);
  assert.equal((await r.json()).name, null);
});

test('/connect names the commit first, then the deployment', async () => {
  supabase();
  process.env.VERCEL_DEPLOYMENT_ID = 'dpl';
  assert.equal((await (await connect()).json()).build, 'dpl');
  process.env.VERCEL_GIT_COMMIT_SHA = 'abc';
  assert.equal((await (await connect()).json()).build, 'abc');
  delete process.env.VERCEL_GIT_COMMIT_SHA; delete process.env.VERCEL_DEPLOYMENT_ID;
});

// ---------- /lang and /indexnow.txt ----------
const lang = (await import('../app/lang/route.ts')).GET;

test('/lang keeps the language for a year and goes back', () => {
  const r = lang(req('/lang?to=ru&back=/race/free'));
  assert.equal(where(r), '/race/free');
  const c = r.cookies.get('lang');
  assert.equal(c.value, 'ru'); assert.equal(c.path, '/'); assert.equal(c.maxAge, 31536000); assert.equal(c.sameSite, 'lax');
});

test('/lang: a language that doesn\'t exist sets nothing, and another site is never gone to', () => {
  assert.equal(lang(req('/lang?to=fr&back=/boat')).cookies.get('lang'), undefined);
  assert.equal(where(lang(req('/lang?to=ru&back=//evil.test'))), '/');
  assert.equal(where(lang(req('/lang?to=ru'))), '/');
});

test('/indexnow.txt serves the key the search engines are told about', async () => {
  const { INDEXNOW_KEY } = await import('../lib/seo.ts');
  const r = (await import('../app/indexnow.txt/route.ts')).GET();
  assert.equal(await r.text(), INDEXNOW_KEY);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
});

// ---------- /sponsor ----------
const sponsor = (await import('../app/sponsor/route.ts')).GET;
const settings = (o) => answer(() => json(Object.entries(o).map(([key, value]) => ({ key, value }))));
const BUCKET = 'https://proj.supabase.test/storage/v1/object/public/regatta-ads/';

test('/sponsor: an uploaded picture and the site\'s own go on the sails', async () => {
  settings({ jib_ad: { url: `${BUCKET}jib.png` }, main_logo: { url: '/images/ryc-badge.svg' }, kite_logo: { url: '/flags/tr.svg' } });
  const r = await sponsor();
  assert.deepEqual(await r.json(), { jib: `${BUCKET}jib.png`, main: '/images/ryc-badge.svg', kite: '/flags/tr.svg', colors: { jib: null, kite: null }, banner: null });
  assert.match(r.headers.get('cache-control'), /s-maxage=60/);
  assert.equal(sent[0].o.headers.apikey, 'pub-key');
  assert.ok(sent[0].o.signal instanceof AbortSignal, 'it doesn\'t wait on a database that doesn\'t answer');
});

test('/sponsor: a picture from anywhere else is refused', async () => {
  for (const url of ['https://evil.test/a.png', 'https://proj.supabase.test/storage/v1/object/public/other/a.png', '/images/../secret.png', '/flags/../secret.svg', '/images/a.exe', '/game/a.png', 'javascript:alert(1)', 7, null]) {
    settings({ jib_ad: { url }, main_logo: { url }, kite_logo: { url } });
    const j = await (await sponsor()).json();
    assert.equal(j.jib, null, String(url)); assert.equal(j.main, null, String(url)); assert.equal(j.kite, null, String(url));
  }
});

test('/sponsor: the banner is two lines of 40 characters at most, with the blanks dropped', async () => {
  settings({ plane_banner: { lines: ['  first  ', 7, '   ', 'x'.repeat(60), 'third'] } });
  assert.deepEqual((await (await sponsor()).json()).banner, ['first', 'x'.repeat(40)]);
  for (const lines of [[], ['  '], 'words', null]) {
    settings({ plane_banner: { lines } });
    assert.equal((await (await sponsor()).json()).banner, null);
  }
});

test('/sponsor: the jibs\' and gennakers\' colours, as the game takes them', async () => {
  settings({ sail_colors: { jib: '#AE0000', kite: '#111111' } });
  assert.deepEqual((await (await sponsor()).json()).colors, { jib: '#AE0000', kite: '#111111' });
  settings({ sail_colors: { jib: 'own', kite: ['#222222', '#333333'] } });
  assert.deepEqual((await (await sponsor()).json()).colors, { jib: 'own', kite: '#222222' }, 'bands saved before: the first colour');
  for (const bad of [{ jib: 'red', kite: 'red' }, { jib: '#12345', kite: [] }, { jib: 7, kite: ['nope', '#111111'] }, null]) {
    settings({ sail_colors: bad });
    assert.deepEqual((await (await sponsor()).json()).colors, { jib: null, kite: null }, JSON.stringify(bad));
  }
});

test('/sponsor?venue=: the venue\'s set\'s pictures and colours over every venue\'s, the rest every venue\'s', async () => {
  const all = { jib_ad: { url: `${BUCKET}all-jib.png` }, main_logo: { url: '/images/ryc-badge.svg' }, kite_logo: { url: `${BUCKET}all-kite.png` }, sail_colors: { jib: '#111111', kite: '#222222' }, plane_banner: { lines: ['WORDS'] } };
  settings({ ...all, sail_sets: {
    turkey: { name: 'Turkey', venues: ['gocek', 'istanbul'], jib: { url: '/images/ryc-jib-banner.svg' }, kite: { url: '/flags/tr.svg' }, colors: { kite: '#e30a17' } },
    uk: { name: 'UK', venues: ['cowes'], main: { url: 'https://evil.test/a.png' }, colors: { jib: 'auto', kite: 'own' } },
    junk: 'junk', loose: { name: 'No venues', kite: { url: '/flags/gb.svg' } },
  } });
  const at = async (v) => (await (await sponsor(new Request(`https://x.test/sponsor${v === undefined ? '' : `?venue=${v}`}`))).json());
  const turkey = { jib: '/images/ryc-jib-banner.svg', main: '/images/ryc-badge.svg', kite: '/flags/tr.svg', colors: { jib: '#111111', kite: '#e30a17' }, banner: ['WORDS'] };
  assert.deepEqual(await at('gocek'), turkey);
  assert.deepEqual(await at('istanbul'), turkey, 'every venue in the set alike');
  assert.deepEqual(await at('cowes'), { jib: `${BUCKET}all-jib.png`, main: '/images/ryc-badge.svg', kite: `${BUCKET}all-kite.png`, colors: { jib: null, kite: null }, banner: ['WORDS'] }, 'a picture from anywhere else refused; the jib back to its ad, the gennaker each boat\'s own');
  const everyVenue = { jib: `${BUCKET}all-jib.png`, main: '/images/ryc-badge.svg', kite: `${BUCKET}all-kite.png`, colors: { jib: '#111111', kite: '#222222' }, banner: ['WORDS'] };
  for (const v of [undefined, 'kiel', 'nowhere', '__proto__', '']) assert.deepEqual(await at(v), everyVenue, String(v));
  settings({ ...all, sail_sets: 'junk' });
  assert.deepEqual(await at('gocek'), everyVenue);
  settings({ ...all, sail_sets: { t: { venues: ['gocek'], colors: { jib: 'blue', kite: 'all' } } } });
  assert.deepEqual((await at('gocek')).colors, { jib: '#111111', kite: '#222222' });
});

test('/sponsor: nothing to be had leaves the sails plain', async () => {
  const none = { jib: null, main: null, kite: null, colors: { jib: null, kite: null }, banner: null };
  answer(() => json({}, 500));
  assert.deepEqual(await (await sponsor()).json(), none);
  answer(() => { throw new Error('down'); });
  const r = await sponsor();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), none);
});

// ---------- /push/remind ----------
const remind = (await import('../app/push/remind/route.ts')).GET;
const { dailyRace } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');
const day = dailyRace().day, venue = venueOf(dailyRace().venue).name, yacht = yachtOf(dailyRace().yacht).name;
const cron = () => new Request(`${SITE}/push/remind`, { headers: { authorization: 'Bearer cron' } });
const shift = (n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const row = (o = {}) => ({ endpoint: 'https://push.test/1', p256dh: 'p', auth: 'a', lang: 'en', last_day: null, streak: 0, ...o });

// the reminder run over these subscriptions, with today's best time if any
async function run(rows, { best = null, fail = () => null } = {}) {
  const out = [];
  globalThis.__push = { send: async (sub, body, o) => { out.push({ sub, body: JSON.parse(body), o }); const e = fail(sub.endpoint); if (e) throw e; } };
  answer((u) => {
    if (u.includes('regatta_push_due')) return json(rows);
    if (u.includes('regatta_push_drop')) return json({});
    if (u.includes('&brief')) return best == null ? json({}, 500) : json({ d: day, w: 'w', races: 3, ranked: 1, top: [{ name: 'Anna', s: best, fl: null }], s: [best] });
    return json({}, 500);
  });
  const r = await remind(cron());
  return { out, j: await r.json(), status: r.status };
}

beforeEach(() => { process.env.CRON_SECRET = 'cron'; process.env.VAPID_PRIVATE_KEY = 'vapid'; process.env.PUSH_LIST_KEY = 'list'; });

test('the reminder runs only for the cron, with its secret', async () => {
  assert.equal((await remind(new Request(`${SITE}/push/remind`))).status, 401);
  assert.equal((await remind(new Request(`${SITE}/push/remind`, { headers: { authorization: 'Bearer wrong' } }))).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await remind(new Request(`${SITE}/push/remind`, { headers: { authorization: 'Bearer undefined' } }))).status, 401);
  assert.equal(sent.length, 0);
});

test('the reminder says what it is missing, and when the list can\'t be had', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  assert.equal((await remind(cron())).status, 500);
  process.env.VAPID_PRIVATE_KEY = 'vapid'; delete process.env.PUSH_LIST_KEY;
  assert.equal((await remind(cron())).status, 500);
  process.env.PUSH_LIST_KEY = 'list';
  globalThis.__push = {};
  answer(() => json({}, 503));
  const r = await remind(cron());
  assert.equal(r.status, 502);
  assert.deepEqual(await r.json(), { error: 'regatta_push_due: 503' });
});

test('the reminder asks for those due today, with the key to the list', async () => {
  await run([]);
  assert.deepEqual(JSON.parse(sent[0].o.body), { p_key: 'list', p_day: day });
});

test('a streak still alive is what the reminder is about', async () => {
  const { out } = await run([row({ streak: 4, last_day: shift(-1) }), row({ streak: 4, last_day: shift(-2), lang: 'ru' })]);
  assert.equal(out[0].body.title, 'Keep your 4-day streak');
  assert.equal(out[0].body.body, `Today’s race at ${venue[0]} on the ${yacht[0]} closes in 7 hours.`);
  assert.equal(out[1].body.title, 'Серия: 4 дня подряд');
  assert.equal(out[1].body.body, `Гонка дня — ${venue[1]}, ${yacht[1]}. Закроется через 7 часов.`);
  assert.equal(out[0].body.tag, `daily-${day}`); assert.equal(out[0].body.url, '/race?from=push');
  assert.deepEqual(out[0].o, { TTL: 21600, urgency: 'normal' });
});

test('the streak\'s days in Russian take their right form', async () => {
  for (const [n, word] of [[2, 'дня'], [5, 'дней'], [11, 'дней'], [12, 'дней'], [14, 'дней'], [21, 'день'], [22, 'дня'], [101, 'день'], [111, 'дней']]) {
    const { out } = await run([row({ streak: n, last_day: shift(-1), lang: 'ru' })]);
    assert.equal(out[0].body.title, `Серия: ${n} ${word} подряд`);
  }
});

test('a streak broken, or of one day, gets today\'s race instead', async () => {
  for (const r of [row({ streak: 4, last_day: shift(-3) }), row({ streak: 1, last_day: shift(-1) }), row({ streak: 3, last_day: null })]) {
    const { out } = await run([r]);
    assert.equal(out[0].body.title, `Today’s race: ${venue[0]}`);
  }
});

test('the reminder names the time to beat, or says nobody has set one', async () => {
  let { out } = await run([row(), row({ lang: 'ru' })], { best: 225.7 });
  assert.equal(out[0].body.body, `The ${yacht[0]}. The time to beat is 3:45.7. Closes in 7 hours.`);
  assert.equal(out[1].body.body, `${yacht[1]}. Время, которое надо побить: 3:45.7. Закроется через 7 часов.`);
  ({ out } = await run([row(), row({ lang: 'ru' })]));
  assert.equal(out[0].body.body, `The ${yacht[0]}. Nobody has finished it yet: set the time to beat.`);
  assert.equal(out[1].body.body, `${yacht[1]}. Гонку ещё никто не прошёл: задай время дня.`);
});

test('the time to beat never reads 60 seconds in a minute', async () => {
    const { out } = await run([row()], { best: 119.97 });
    assert.match(out[0].body.body, /2:00\.0/);
  });

test('every subscription due is sent to, however many there are', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => row({ endpoint: `https://push.test/${i}` }));
  const { out, j } = await run(rows);
  assert.equal(new Set(out.map((m) => m.sub.endpoint)).size, 60);
  assert.deepEqual(j, { day, due: 60, sent: 60, gone: 0, failed: 0 });
});

test('a subscription the push service says is gone is dropped; any other failure is only counted', async () => {
  const code = { 'https://push.test/404': 404, 'https://push.test/410': 410, 'https://push.test/500': 500 };
  const rows = [...Object.keys(code), 'https://push.test/ok'].map((endpoint) => row({ endpoint }));
  const { j } = await run(rows, { fail: (e) => (code[e] ? Object.assign(new Error('no'), { statusCode: code[e] }) : null) });
  assert.deepEqual(j, { day, due: 4, sent: 1, gone: 2, failed: 1 });
  const dropped = sent.filter((s) => s.url.includes('regatta_push_drop')).map((s) => JSON.parse(s.o.body).p_endpoint).sort();
  assert.deepEqual(dropped, ['https://push.test/404', 'https://push.test/410']);
});

test('a failed drop doesn\'t stop the reminder\'s report', async () => {
  globalThis.__push = { send: async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); } };
  answer((u) => {
    if (u.includes('regatta_push_due')) return json([row()]);
    if (u.includes('regatta_push_drop')) throw new Error('down');
    return json({}, 500);
  });
  const r = await remind(cron());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).gone, 1);
});

// ---------- /llms.txt and /llms-full.txt ----------
test('/llms.txt lists every venue, yacht and question, in Markdown', async () => {
  const { VENUES } = await import('../lib/venues.ts');
  const { YACHTS } = await import('../lib/yachts.ts');
  const { faqGroups } = await import('../lib/faq.ts');
  const { tx } = await import('../lib/lang.ts');
  const r = (await import('../app/llms.txt/route.ts')).GET(), s = await r.text();
  assert.match(r.headers.get('content-type'), /^text\/markdown/);
  for (const v of VENUES) assert.ok(s.includes(`${SITE}/venues/${v.id})`), v.id);
  for (const y of YACHTS) assert.ok(s.includes(`${SITE}/yachts/${y.id})`), y.id);
  for (const g of faqGroups(tx('en'))) for (const f of g.items) assert.ok(s.includes(f.q), f.id);
  assert.doesNotMatch(s, /undefined|\[object Object\]/);
});

test('/llms.txt says how many venues and yachts there really are (its words are written by hand)', async () => {
  const { VENUES } = await import('../lib/venues.ts');
  const { YACHTS } = await import('../lib/yachts.ts');
  const s = await (await import('../app/llms.txt/route.ts')).GET().text();
  assert.ok(s.includes(`the ${VENUES.length} regatta venues`), `${VENUES.length} venues`);
  assert.equal(YACHTS.length, 9, 'the page says "the nine yachts"');
  assert.ok(s.includes('the nine yachts'));
});

test('/llms-full.txt carries every guide, venue and yacht whole', async () => {
  const { GUIDES, guide } = await import('../lib/guides.ts');
  const { VENUES } = await import('../lib/venues.ts');
  const { VENUE_GUIDES } = await import('../lib/venue-guides.ts');
  const { YACHTS } = await import('../lib/yachts.ts');
  const { tx } = await import('../lib/lang.ts');
  const r = (await import('../app/llms-full.txt/route.ts')).GET(), s = await r.text();
  assert.match(r.headers.get('content-type'), /^text\/markdown/);
  for (const slug of GUIDES) for (const sec of guide(slug, tx('en'), 'en').sections) assert.ok(s.includes(`### ${sec.h}`), `${slug}: ${sec.h}`);
  for (const v of VENUES) assert.ok(s.includes(`## ${VENUE_GUIDES[v.id].title[0]}`), v.id);
  for (const y of YACHTS) assert.ok(s.includes(`${SITE}/yachts/${y.id}`), y.id);
  assert.doesNotMatch(s, /undefined|\[object Object\]/);
});
