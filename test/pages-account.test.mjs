// The account pages: Settings and the three steps of signing in. What a guest and a signed-in player each get, where
// each step sends them, that no address can send them off the site, and that none of it is left for search engines.
// The session goes through the real lib/supabase/server.ts, over a stand-in for Supabase.
// Run: node --test test/pages-account.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');

const DAY = '2026-11-18';
const settings = await import('../app/[lang]/settings/page.tsx');
const signIn = await import('../app/[lang]/sign-in/page.tsx');
const code = await import('../app/[lang]/sign-in/code/page.tsx');
const name = await import('../app/[lang]/sign-in/name/page.tsx');

// ---------- who is signed in ----------
let user = null;
globalThis.__sb = { auth: { getUser: async () => ({ data: { user } }) } };
const ANNA = { id: 'u1', email: 'anna@example.com', user_metadata: { display_name: 'Anna Petrova' }, app_metadata: { provider: 'google' } };
const account = (o = {}) => ({ ...ANNA, ...o });

// ---------- the scores API ----------
const top = [{ name: 'Fast Fiona', s: 300.4, fl: 'GB' }, { name: 'Boris Ivanov', s: 312.9, fl: null }, { name: null, s: 330, fl: null }, { name: 'Fourth Fred', s: 340, fl: null }];
const api = { down: false, brief: null, plain: null, rating: null };
const scores = (o = {}) => Object.assign(api, { down: false, brief: { d: DAY, w: 'w', races: 9, ranked: 4, top, s: top.map((r) => r.s) }, plain: null,
  rating: { d: DAY, w: 'w', races: 9, guests: 0, rows: [{ k: 'k1', name: 'A', s: 300.4 }, { k: 'k2', name: 'B', s: 312.9 }], month: { m: '2026-11', days: 1, rows: [] }, days: [] } }, o);
const json = (x) => (x == null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(x)));
globalThis.fetch = async (url) => {
  if (api.down) throw new TypeError('fetch failed');
  const q = new URL(String(url)).searchParams;
  return json(q.has('brief') ? api.brief : q.has('day') ? api.rating : api.plain);
};

const LANGS = ['en', 'ru'];
const props = (lang, q = {}) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(q) });
const html = async (mod, lang, q) => renderToStaticMarkup(await mod.default(props(lang, q)));
const as = (u) => { user = u; scores(); };
const to = (where) => (e) => e.kind === 'redirect' && e.to === where;

test('none of the account pages is left for search engines, and each is titled in both languages', async () => {
  for (const [mod, en, ru] of [[settings, 'Settings', 'Настройки'], [signIn, 'Sign in', 'Вход'], [code, 'Enter the code', 'Введи код'], [name, 'Your name on the ranking', 'Твоё имя в рейтинге']]) {
    const [e, r] = await Promise.all(LANGS.map((l) => mod.generateMetadata(props(l))));
    assert.equal(e.title, en);
    assert.equal(r.title, ru);
    assert.deepEqual(e.robots, { index: false, follow: true }, en);
    assert.deepEqual(r.robots, { index: false, follow: true }, ru);
    assert.equal(e.alternates, undefined, `${en}: no canonical address`);
  }
});

// ---------- Settings ----------
test('Settings shows a guest the way to sign in, and no account', async () => {
  as(null);
  const h = await html(settings, 'en');
  assert.match(h, /data-acct="guest"/);
  assert.ok(h.includes('<span class="card-title">Guest</span>'));
  assert.ok(h.includes('Times stay on this device'));
  assert.ok(h.includes('href="/sign-in?next=/settings"'));
  assert.ok(!h.includes('<button class="mini" type="submit">'), 'nothing to sign out of');
  assert.ok(!h.includes('id="set-name"'), 'no name to change');
});

test('Settings speaks to a guest in Russian too', async () => {
  as(null);
  const h = await html(settings, 'ru');
  assert.ok(h.includes('<span class="card-title">Гость</span>'));
  assert.ok(h.includes('Результаты только на этом устройстве'));
  assert.ok(h.includes('<h1 class="bt-h">Яхта, экран и звук</h1>'));
});

test('Settings shows a signed-in player their name, address and how they signed in', async () => {
  as(account());
  const h = await html(settings, 'en');
  assert.match(h, /data-acct="signed"/);
  assert.ok(h.includes('<span class="avatar">AP</span>'), 'the initials');
  assert.ok(h.includes('<span class="card-title">Anna Petrova</span>'));
  assert.ok(h.includes('anna@example.com · Google'));
  assert.match(h, /<form action="\/auth\/sign-out" method="post"><button class="mini" type="submit"><span class="btn-t">Sign out/);
  assert.ok(h.includes('id="set-name"'), 'the name can be changed');
  assert.ok(!h.includes('href="/sign-in?next=/settings"'));
});

test('Settings says how each kind of account signed in', async () => {
  as(account({ app_metadata: { provider: 'email' } }));
  assert.ok((await html(settings, 'en')).includes('anna@example.com · email code'));
  as(account({ app_metadata: { provider: 'email' } }));
  assert.ok((await html(settings, 'ru')).includes('anna@example.com · код по почте'));
});

test('Settings never shows a Telegram player\'s made-up address', async () => {
  as(account({ email: 'tg123@telegram.invalid', app_metadata: { telegram_id: 123, provider: 'email' } }));
  const h = await html(settings, 'en');
  assert.ok(!h.includes('telegram.invalid'));
  assert.ok(h.includes('<span class="small">Telegram</span>'));
});

test('Settings falls back on the address for a player with no name yet', async () => {
  as(account({ user_metadata: {} }));
  const h = await html(settings, 'en');
  assert.ok(h.includes('<span class="card-title">anna@example.com</span>'));
  assert.ok(h.includes('<span class="avatar">AE</span>'));
});

test('Settings leaves emoji out of a name', async () => {
  as(account({ user_metadata: { display_name: '⛵ Anna 🇬🇧' } }));
  assert.ok((await html(settings, 'en')).includes('<span class="card-title">Anna</span>'));
});

test('Settings offers both languages and marks the one in use', async () => {
  as(null);
  const en = await html(settings, 'en'), ru = await html(settings, 'ru');
  assert.match(en, /class="on" href="\/lang\?to=en&amp;back=\/settings" aria-current="true">English/);
  assert.match(en, /href="\/lang\?to=ru&amp;back=\/settings" lang="ru">Русский/);
  assert.match(ru, /class="on" href="\/lang\?to=ru&amp;back=\/settings" aria-current="true" lang="ru">Русский/);
});

// ---------- signing in: step one ----------
test('sign-in shows a guest the form and today\'s fastest three, with a place for them', async () => {
  as(null);
  const h = await html(signIn, 'en');
  assert.ok(h.includes('Continue with Google'));
  assert.ok(h.includes('Send code'));
  assert.ok(h.includes('Fast F.') && h.includes('5:00.4'));
  assert.ok(h.includes('No name'), 'someone with no name');
  assert.ok(!h.includes('Fourth F.'), 'three, not four');
  assert.ok(h.includes('You?'));
});

test('sign-in speaks Russian', async () => {
  as(null);
  const h = await html(signIn, 'ru');
  assert.ok(h.includes('Войти через Google'));
  assert.ok(h.includes('Без имени'));
  assert.ok(h.includes('Ты?'));
});

test('sign-in still works with the scores API down', async () => {
  as(null);
  scores({ down: true });
  const h = await html(signIn, 'en');
  assert.ok(h.includes('Send code'));
  assert.ok(h.includes('You?'));
  assert.ok(!h.includes('au-n">1<'), 'nobody listed');
});

test('sign-in doesn\'t show yesterday\'s times as today\'s fastest', async () => {
  as(null);
  scores({ brief: null, plain: { daily: { d: '2026-11-17', races: 40, top: [{ name: 'Yesterday Winner', s: 200 }] } } });
  assert.ok(!(await html(signIn, 'en')).includes('Yesterday Winner'));
});

test('sign-in says when the last try failed, and only then', async () => {
  as(null);
  assert.ok((await html(signIn, 'en', { error: '1' })).includes('That didn’t work. Try again.'));
  assert.ok(!(await html(signIn, 'en')).includes('That didn’t work.'));
});

test('sign-in\'s back button returns to where the visitor came from', async () => {
  as(null);
  assert.match(await html(signIn, 'en', { next: '/race/rating' }), /<a href="\/race\/rating" class="bt-back" aria-label="Back"/);
});

test('sign-in sends someone already signed in straight on', async () => {
  as(account());
  await assert.rejects(html(signIn, 'en', { next: '/settings' }), to('/settings'));
  await assert.rejects(html(signIn, 'en'), to('/race'));
});

const OFFSITE = ['//evil.example', 'https://evil.example', '/\\evil.example', '/\t/evil.example', '\\\\evil.example', 'javascript:alert(1)'];
for (const next of OFFSITE) {
  test(`sign-in never sends anyone to ${JSON.stringify(next)}`, async () => {
    as(account());
    await assert.rejects(html(signIn, 'en', { next }), to('/race'));
    as(null);
    const h = await html(signIn, 'en', { next });
    assert.ok(!h.includes('evil.example') && !h.includes('javascript:'));
  });

  test(`the code step never sends anyone to ${JSON.stringify(next)}`, async () => {
    await assert.rejects(html(code, 'en', { next }), to('/sign-in?next=%2Frace'));
    const h = await html(code, 'en', { next, email: 'a@b.co' });
    assert.ok(!h.includes('evil.example') && !h.includes('javascript:'));
  });

  test(`the name step never sends anyone to ${JSON.stringify(next)}`, async () => {
    as(null);
    await assert.rejects(html(name, 'en', { next }), to('/sign-in?next=%2Frace'));
    as(account());
    const el = await name.default(props('en', { next }));
    assert.equal(el.props.children.props.next, '/race');
  });
}

// ---------- step two: the code ----------
test('the code step without an address goes back to the first step, keeping where to go after', async () => {
  await assert.rejects(html(code, 'en', { next: '/race/rating' }), to('/sign-in?next=%2Frace%2Frating'));
  await assert.rejects(html(code, 'en', { email: '' }), to('/sign-in?next=%2Frace'));
});

test('the code step names the address the code went to, and goes back to step one', async () => {
  const h = await html(code, 'en', { email: 'anna@example.com', next: '/settings' });
  assert.ok(h.includes('anna@example.com'));
  assert.ok(h.includes('href="/sign-in?next=%2Fsettings"'));
  assert.ok((await html(code, 'ru', { email: 'anna@example.com' })).includes('Проверь почту'));
});

test('an address in the link is shown as text, never as markup', async () => {
  const h = await html(code, 'en', { email: '<img src=x onerror=alert(1)>' });
  assert.ok(!h.includes('<img src=x'));
});

// ---------- step three: the name ----------
const nameForm = async (q) => (await name.default(props('en', q))).props.children.props;

test('the name step is for someone signed in', async () => {
  as(null);
  await assert.rejects(html(name, 'en', { next: '/race/rating' }), to('/sign-in?next=%2Frace%2Frating'));
});

test('the name step suggests the name the account already has', async () => {
  as(account());
  const f = await nameForm();
  assert.equal(f.suggested, 'Anna Petrova');
  assert.equal(f.fromGoogle, false);
});

test('the name step shortens a full name from Google, and says where it came from', async () => {
  as(account({ user_metadata: { full_name: 'Anna Maria Petrova' } }));
  let f = await nameForm();
  assert.equal(f.suggested, 'Anna M.');
  assert.equal(f.fromGoogle, true);
  as(account({ user_metadata: { name: 'Николай Шилин' } }));
  f = await nameForm();
  assert.equal(f.suggested, 'Николай Ш.');
  as(account({ user_metadata: { name: 'Cher' } }));
  assert.equal((await nameForm()).suggested, 'Cher');
});

test('the name step leaves emoji out of what it suggests', async () => {
  as(account({ user_metadata: { full_name: '🦄 Anna ⛵ Petrova' } }));
  assert.equal((await nameForm()).suggested, 'Anna P.');
  as(account({ user_metadata: { display_name: '⛵⛵' } }));
  assert.equal((await nameForm()).suggested, '');
});

test('the name step suggests nothing for an account with no name, and doesn\'t credit Google for it', async () => {
  as(account({ user_metadata: {} }));
  let f = await nameForm();
  assert.equal(f.suggested, '');
  assert.equal(f.fromGoogle, false);
  as(account({ user_metadata: { full_name: '⛵' } }));
  f = await nameForm();
  assert.equal(f.suggested, '');
  assert.equal(f.fromGoogle, false);
  as(account({ user_metadata: null }));
  assert.equal((await nameForm()).suggested, '');
});

test('the name step knows today\'s ranked times, to place one sailed on this device', async () => {
  as(account());
  const f = await nameForm();
  assert.equal(f.day, DAY);
  assert.deepEqual(f.times, [300.4, 312.9]);
});

test('the name step has no times to go on when the API is down or answers for another day', async () => {
  as(account());
  scores({ down: true });
  assert.equal((await nameForm()).times, null);
  scores({ rating: null });
  assert.equal((await nameForm()).times, null);
  scores({ rating: { d: '2026-11-17', rows: [], month: { rows: [] } } });
  assert.equal((await nameForm()).times, null);
});

test('the name step opens with the suggestion in the box, in the reader\'s language', async () => {
  as(account());
  const en = await html(name, 'en');
  assert.ok(en.includes('value="Anna Petrova"'));
  as(account());
  assert.notEqual(await html(name, 'ru'), en);
});

test('the account pages refuse a language the site does not have', async () => {
  as(null);
  for (const [mod, q] of [[settings], [signIn], [code, { email: 'a@b.co' }], [name]]) await assert.rejects(html(mod, 'de', q), (e) => e.kind === 'notFound');
});
