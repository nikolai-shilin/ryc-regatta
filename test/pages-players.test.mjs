// /players over a stand-in for the scores API: the list page by page, one player's card, a passport shared as a link
// and your own, what the title and the share card say for each, and what shows when the API is down.
// Run: node --test test/pages-players.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');

const { VENUES } = await import('../lib/venues.ts');
const { passportQuery, readPassport } = await import('../lib/passport-share.ts');
const players = await import('../app/[lang]/players/page.tsx');

const KEY = 'kAnna-0001', OTHER = 'kBoris_002';
const row = (k, name, o = {}) => ({ k, name, ph: null, fl: 'GB', pts: 1240, n: 30, fin: 27, wins: 4, podiums: 11, days: 12, last: '2026-11-17', yacht: 'j70', ...o });
const list = (o = {}) => ({ total: 123, page: 1, pages: 3, per: 50, rows: [row(KEY, 'Anna Petrova'), row(OTHER, null, { wins: 0, podiums: 0, yacht: null, days: 1 })], ...o });
const card = (o = {}) => ({ ...row(KEY, 'Anna Petrova'), first: '2026-10-01', dsq: 2, best: 1, fleet: 5, daily: { n: 9, days: 8, wins: 2, podiums: 5 },
  yachts: [{ id: 'j70', n: 20 }, { id: 'dragon', n: 10 }], venues: [{ id: 'cowes', n: 3 }, { id: VENUES[1].id, n: 1 }],
  boat: { name: 'Sea Wolf', nat: 'GBR', num: '77', hull: '#102030', cloth: '#ffffff', deck: 'teak', laminate: true, flag: 'GB' }, ...o });

// what the API answers, by the question asked
const api = { down: false, list: list(), player: card(), asked: [] };
const reset = (o = {}) => Object.assign(api, { down: false, list: list(), player: card(), asked: [] }, o);
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  api.asked.push(u.search);
  if (api.down) throw new TypeError('fetch failed');
  const body = u.searchParams.has('players') ? api.list : api.player; // whatever it holds, asked for whichever key: the page must check
  return body ? new Response(JSON.stringify(body)) : new Response('{}', { status: 404 });
};

const LANGS = ['en', 'ru'];
const props = (lang, q = {}) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(q) });
const view = async (lang, q) => (await players.default(props(lang, q))).props.children.props; // what the page hands its view
const html = async (lang, q) => renderToStaticMarkup(await players.default(props(lang, q)));
const meta = (lang, q) => players.generateMetadata(props(lang, q));

// ---------- the list ----------
test('the list shows every player with their numbers, the first page first', async () => {
  reset();
  const h = await html('en');
  assert.ok(h.includes('<h1 class="bt-h">The players</h1>'));
  assert.ok(h.includes('Anna Petrova'));
  assert.ok(h.includes('1,240'), 'the points');
  assert.ok(h.includes(`/players?p=${KEY}`), 'a link to their card');
  assert.deepEqual(api.asked, ['?players&page=1']);
});

test('the list is in the reader\'s language', async () => {
  reset();
  const h = await html('ru');
  assert.ok(h.includes('<h1 class="bt-h">Игроки</h1>'));
  assert.ok(h.includes('Страница 1 из 3'));
});

test('someone with no name on the list is still shown', async () => {
  reset();
  const h = await html('en');
  assert.ok(h.includes(`/players?p=${OTHER}`));
  assert.doesNotMatch(h, /<b>null<\/b>|undefined/);
});

test('the list turns the page in the address into a page it can ask for', async () => {
  for (const [q, want] of [['2', 2], ['1', 1], ['0', 1], ['-5', 1], ['abc', 1], ['2.9', 2], ['99999', 10000], [['3', '4'], 3], [undefined, 1]]) {
    reset();
    await html('en', q === undefined ? {} : { page: q });
    assert.deepEqual(api.asked, [`?players&page=${want}`], `?page=${q}`);
  }
});

test('the list numbers its rows on from the page it is on', async () => {
  reset({ list: list({ page: 2, per: 50 }) });
  assert.match(await html('en', { page: '2' }), /<span role="cell" class="pl-i">51<\/span>/);
});

test('an empty list says nobody yet', async () => {
  reset({ list: list({ total: 0, pages: 1, rows: [] }) });
  assert.ok((await html('en')).includes('Nobody yet. Sign in and race to be the first.'));
  reset({ list: list({ total: 0, pages: 1, rows: [] }) });
  assert.ok((await html('ru')).includes('Пока никого.'));
});

test('with the API down the list says so and asks you to try again', async () => {
  reset({ down: true });
  const en = await html('en');
  assert.ok(en.includes('The players can’t be had just now. Try again in a minute.'));
  assert.ok(!en.includes('Nobody yet'), 'it doesn\'t say there are no players');
  reset({ down: true });
  assert.ok((await html('ru')).includes('Список игроков сейчас недоступен.'));
});

test('a broken answer from the API counts as the API being down', async () => {
  for (const broken of [{ rows: 'x', pages: 1 }, { rows: [] }, {}]) {
    reset({ list: broken });
    assert.ok((await html('en')).includes('The players can’t be had just now.'), JSON.stringify(broken));
  }
});

test('the list is a page to find, titled and addressed for each language', async () => {
  reset();
  const [en, ru] = await Promise.all(LANGS.map((l) => meta(l)));
  assert.equal(en.title, 'The players');
  assert.equal(ru.title, 'Игроки');
  assert.notEqual(en.description, ru.description);
  assert.equal(en.alternates.canonical, '/players');
  assert.equal(ru.alternates.canonical, '/players?lang=ru');
  assert.equal(en.robots, undefined);
  assert.equal(en.openGraph.images[0].url, '/og/page/players?lang=en&d=2026-11-18');
  assert.deepEqual(api.asked, [], 'the list\'s title costs the API nothing');
});

// ---------- one player ----------
test('a player\'s card shows their name, numbers, boat and yachts', async () => {
  reset();
  const h = await html('en', { p: KEY });
  assert.ok(h.includes('<span>Anna Petrova</span>'));
  assert.ok(h.includes('Sea Wolf'), 'the boat\'s name');
  assert.ok(h.includes('GBR 77'), 'the sail number');
  assert.ok(h.includes('Teak'), 'the deck');
  assert.ok(h.includes('Laminate'), 'the sails');
  assert.ok(h.includes('90%'), 'how many they finish');
  assert.ok(h.includes('J/70') && h.includes('Dragon'), 'the yachts they sail');
  assert.ok(api.asked.includes(`?player=${KEY}`));
});

test('a player who keeps no boat online is told apart from one who does', async () => {
  reset({ player: card({ boat: null }) });
  const h = await html('en', { p: KEY });
  assert.ok(h.includes('They race inside Telegram or haven’t changed their boat'));
  assert.ok(!h.includes('Sea Wolf'));
});

test('a player\'s card has their name in the title and their own share card, and stays out of search', async () => {
  reset();
  const en = await meta('en', { p: KEY }), ru = await meta('ru', { p: KEY });
  assert.equal(en.title, 'Anna Petrova · The players');
  assert.equal(ru.title, 'Anna Petrova · Игроки');
  assert.equal(en.description, 'Anna Petrova in Up and down: 30 races, 4 wins, 11 podiums.');
  assert.equal(ru.description, 'Anna Petrova в Up and down: гонок — 30, побед — 4, подиумов — 11.');
  assert.deepEqual(en.robots, { index: false, follow: true });
  assert.equal(en.alternates, undefined);
  assert.equal(en.openGraph.images[0].url, `/og/page/player?p=${KEY}&lang=en&d=2026-11-18`);
});

test('a player with no name is called a sailor', async () => {
  reset({ player: card({ name: null }) });
  assert.equal((await meta('en', { p: KEY })).title, 'A sailor · The players');
  assert.equal((await meta('ru', { p: KEY })).title, 'Гонщик · Игроки');
});

test('emoji in a player\'s name are left out', async () => {
  reset({ player: card({ name: '⛵ Anna 🇬🇧' }) });
  assert.equal((await meta('en', { p: KEY })).title, 'Anna · The players');
});

test('a key nobody has shows the list and says the player has gone', async () => {
  reset({ player: card({ k: 'kSomeoneElse' }) });
  const h = await html('en', { p: 'kNobody-001' });
  assert.ok(h.includes('That player isn’t on the list any more.'));
  assert.ok(h.includes('Anna Petrova'), 'the list is there to pick from');
  assert.equal((await view('en', { p: 'kNobody-001' })).missing, true);
});

test('a key nobody has gets the list\'s title and address', async () => {
  reset({ player: card({ k: 'kSomeoneElse' }) });
  const m = await meta('en', { p: 'kNobody-001' });
  assert.equal(m.title, 'The players');
  assert.equal(m.alternates.canonical, '/players');
});

for (const p of ['short', 'has space in it', '<script>alert(1)</script>', 'a'.repeat(65), '../../etc/passwd']) {
  test(`the address ?p=${p.slice(0, 24)} is not a key: the API isn't asked and it is the plain list`, async () => {
    reset();
    const v = await view('en', { p });
    assert.equal(v.player, null);
    assert.equal(v.missing, false);
    assert.ok(!api.asked.some((q) => q.includes('player=')));
    assert.equal((await meta('en', { p })).title, 'The players');
  });
}

test('the player\'s key is the one the API answers about, or there is no card', async () => {
  reset({ player: card({ k: 'kSomeoneElse' }) });
  assert.equal((await view('en', { p: KEY })).player, null);
});

test('with the API down a player\'s link doesn\'t crash, and says the list can\'t be had', async () => {
  reset({ down: true });
  const h = await html('en', { p: KEY });
  assert.ok(h.includes('The players can’t be had just now.'));
  assert.equal((await meta('en', { p: KEY })).title, 'The players');
});

test('with the API down a player\'s link doesn\'t say the player has gone', async () => {
  reset({ down: true });
  assert.ok(!(await html('en', { p: KEY })).includes('That player isn’t on the list any more.'));
});

// ---------- a passport in a link ----------
const SHARE = { s: '5', v: '2', vs: '3', n: 'Anna' };

test('a shared passport says whose it is and how long their streak is', async () => {
  reset();
  const en = await html('en', SHARE), ru = await html('ru', SHARE);
  assert.ok(en.includes('Anna’s passport'));
  assert.ok(en.includes('<h1 class="bt-h">5 days in a row</h1>'));
  assert.ok(ru.includes('Паспорт: Anna'));
  assert.ok(ru.includes('<h1 class="bt-h">5 дней подряд</h1>'));
});

test('a shared passport with no streak counts the venues instead', async () => {
  reset();
  assert.ok((await html('en', { s: '1', v: '2', vs: '3' })).includes(`<h1 class="bt-h">2 of ${VENUES.length} venues</h1>`));
});

test('a shared passport costs the scores API nothing', async () => {
  reset();
  await html('en', SHARE);
  assert.deepEqual(api.asked, []);
});

test('a shared passport has its own title, description and picture, out of search', async () => {
  const en = await meta('en', SHARE), ru = await meta('ru', SHARE);
  assert.equal(en.title, 'Anna’s passport');
  assert.equal(ru.title, 'Паспорт: Anna');
  assert.ok(en.description.startsWith(`2 of ${VENUES.length} venues raced, 5 days in a row.`));
  assert.ok(ru.description.startsWith(`Пройдено 2 из ${VENUES.length} акваторий, 5 дней подряд.`));
  assert.deepEqual(en.robots, { index: false, follow: true });
  assert.equal(en.openGraph.images[0].url, '/og/passport?s=5&v=2&vs=3&n=Anna');
  assert.equal(en.twitter.images[0].url, '/og/passport?s=5&v=2&vs=3&n=Anna');
  assert.equal(ru.openGraph.images[0].url, '/og/passport?s=5&v=2&vs=3&n=Anna&lang=ru');
  assert.equal(en.openGraph.images[0].width, 1200);
});

test('a passport with no name is a sailor\'s', async () => {
  assert.equal((await meta('en', { s: '5', v: '2' })).title, 'A sailor’s passport');
  assert.equal((await meta('ru', { s: '5', v: '2' })).title, 'Паспорт гонщика');
});

test('a name in a passport link can carry no markup and no emoji', async () => {
  reset();
  const h = await html('en', { s: '5', v: '1', vs: '1', n: '<img src=x onerror=alert(1)>🇬🇧' });
  assert.ok(!h.includes('<img src=x'));
  const m = await meta('en', { s: '5', v: '1', vs: '1', n: '<b>Anna</b>' });
  assert.equal(m.title, 'bAnna/b’s passport');
});

test('numbers in a passport link are held to what can be true', () => {
  const p = readPassport({ s: '999999', v: '999', vs: 'zzzz-not-bits', n: 'x'.repeat(50) });
  assert.equal(p.s, 9999);
  assert.equal(p.v, VENUES.length);
  assert.equal(p.n.length, 30);
  assert.deepEqual(readPassport({ s: 'abc', v: '-3' }).s, 0);
  assert.equal(readPassport({ s: 'abc', v: '-3' }).v, 0);
});

test('a passport keeps the venues it was shared with, the first ones', () => {
  const raced = new Set([VENUES[0].id, VENUES[3].id]);
  const q = Object.fromEntries(new URLSearchParams(passportQuery({ streak: 2, raced })));
  const p = readPassport(q);
  assert.deepEqual(VENUES.filter((_, i) => p.raced[i]).map((v) => v.id), [...raced]);
  assert.equal(p.v, 2);
});

test('a passport keeps the venues it was shared with, the last ones too', () => {
  const raced = new Set([VENUES[0].id, VENUES[VENUES.length - 1].id]);
  const q = Object.fromEntries(new URLSearchParams(passportQuery({ streak: 2, raced })));
  const p = readPassport(q);
  assert.deepEqual(VENUES.filter((_, i) => p.raced[i]).map((v) => v.id), [...raced]);
});

test('a passport is not read from a link that names a player', async () => {
  reset();
  const v = await view('en', { p: KEY, s: '5', v: '2' });
  assert.equal(v.passport, undefined);
  assert.equal(v.player.k, KEY);
});

// ---------- your own card ----------
test('?me=1 is your own card: nothing to ask the API, kept out of search', async () => {
  reset();
  const v = await view('en', { me: '1' });
  assert.deepEqual(v.passport, { shared: null, path: '/players?me=1' });
  assert.equal(v.list, null);
  assert.deepEqual(api.asked, []);
  const en = await meta('en', { me: '1' }), ru = await meta('ru', { me: '1' });
  assert.equal(en.title, 'Your player card');
  assert.equal(ru.title, 'Твоя карточка игрока');
  assert.deepEqual(en.robots, { index: false, follow: true });
});

test('a shared passport keeps its own address for the page\'s own links', async () => {
  reset();
  assert.equal((await view('en', SHARE)).passport.path, '/players?s=5&v=2&vs=3&n=Anna');
});

test('/players refuses a language the site does not have', async () => {
  reset();
  await assert.rejects(html('de'), (e) => e.kind === 'notFound');
});
