// The admin pages and the admin's server action. Whoever is not an admin sees none of the numbers, the ads or the forms
// and can't drop the sponsor cache; an admin sees all of it. The check runs through the real lib/supabase/server.ts and
// components/admin-shell.tsx, over a stand-in for the database. Every page and action found on disk is tried, so a new
// one can't slip past. Run: node --test test/pages-admin.test.mjs
import { mock, ROOT } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');

// ---------- the numbers only an admin may read: each carries a word the page can be searched for ----------
const group = (k, v) => ({ k, v, n: 120, fin: 90, dsq: 6, top3: 30, who: 40, down: 0.4, np: 100, fps: 58, low: 31, stall: 0.4, load: 3.2, slow: 10, saver: 0.1, qh: 50, qm: 30, ql: 20 });
const STATS = { since: '2026-11-01T00:00:00Z', days: [{ d: '2026-11-17', n: 12, fin: 9, who: 4, fps: 58 }],
  groups: [group('all', null), group('yacht', 'j70'), group('wind', 'light'), group('venue', 'SECRET-VENUE'), group('shape', 'wl'), group('kind', 'daily'),
    group('dev', 'phone'), group('gpu', 'SECRET-CHIP'), group('q', 'high'), group('os', 'iOS'), group('br', 'Safari')] };
const INSIGHT = { since: '2026-11-01T00:00:00Z',
  exits: { how: { finish: 8, close: 2 }, stage: { 'first leg': 2 }, last: { ocs: 1 }, left: 2, mins_left: 3.5, mins_fin: 7.5 },
  retention: { new: 10, d1: 2, d1of: 8, d7: 3, d7of: 7, d30: 1, d30of: 5, back: 4, active: 22 },
  ratings: { n: 2, avg: 4.5, stars: [0, 0, 0, 1, 1], yacht: { j70: { n: 2, avg: 4.5 } },
    comments: [{ at: '2026-11-17T10:00:00Z', rating: 5, comment: 'SECRET-COMMENT', yacht: 'j70', venue: 'cowes', wind: 'light', place: 1, boats: 5, dsq: false, dev: 'phone' }] },
  funnel: { opened: 100, loaded: 90, failed: 4, gave_up: 6, raced: 70, finished: 50, load: 3.1, mins: 8.2, races: 1.4, dev: { phone: { opened: 60, loaded: 50, gave_up: 5, failed: 3, raced: 40 } },
    why: [{ why: 'SECRET-LOAD-FAILURE', n: 4 }], errors: [{ m: 'SECRET-ERROR', src: 'main.js', n: 3, visits: 2 }], lost: 1, howto: 20, drill: 5, ghost: 2 },
  usage: { cam: { drone: 8, top: 2 }, speed: { 1: 9 } },
  difficulty: [{ b: 1, n: 40, fin: 20, top3: 5, dsq: 2, who: 30, down: 0.6, pens: 1.2 }] };
const PLAYERS = { since: '2026-11-01T00:00:00Z', players: [{ who: 'abcd1234', kind: 'acct', name: 'SECRET-PLAYER', handle: null, first: '2026-11-01T10:00:00Z', last: '2026-11-17T10:00:00Z',
  new: true, n: 5, fin: 4, top3: 2, dsq: 0, days: 2, down: 0.3, best: 312.4, rated: 1, rating: 4, dev: 'phone' }] };
const WHO = '5f0c1a52-7c1e-4a53-9a44-0d6f1f6f7a10';
const LOGS = { since: '2026-11-01T00:00:00Z', report: null, totals: { visits: 40, bad: 3, failed: 1, gave_up: 1, lost: 1, errors: 1, slow: 2, low: 1, people: 1 },
  people: [{ who: WHO, kind: 'acct', name: 'SECRET-LOGGED', handle: 'logged@example.com', last: '2026-11-17T10:00:00Z', visits: 4, bad: 3, failed: 1, gave_up: 1, lost: 1, errors: 1, slow: 2, low: 1, dev: 'phone tg' }] };
const REPORT = { who: WHO, kind: 'acct', name: 'SECRET-LOGGED', handle: 'logged@example.com', first: '2026-11-01T10:00:00Z', last: '2026-11-17T10:00:00Z',
  visits: [{ id: 'v1', at: '2026-11-17T10:00:00Z', kind: 'today', ref: 'tg', tg: 1, dev: 'phone', load: 4.2, loaded_at: null, failed_at: '2026-11-17T10:00:05Z', why: 'SECRET-WHY', gave_up_at: null, pct: null,
    last_at: '2026-11-17T10:05:00Z', races: 1, finished: 0, mins: 5, howto: null, drill: null, ghost: null, lost: 1, errors: [{ m: 'SECRET-STACK', src: 'main.js:12', n: 3 }] }],
  races: [{ id: 'r1', visit: 'v1', at: '2026-11-17T10:01:00Z', finished_at: null, wind: 'light', laps: 2, length: 'short', boats: 8, place: null, secs: null, dsq: false, daily: '2026-11-17', shape: 'wl', yacht: 'j70', venue: 'cowes',
    perf: { fps: 18, low: 9, stall: 4.5, gpu: 'SECRET-GPU', os: 'ios', br: 'safari', dev: 'phone', tg: 1, w: 800, h: 400, dpr: 2, cores: 6, mem: 4, q0: 'high', q: 'low', gfx: 'auto' },
    ended: { how: 'close', leg: 2, legs: 4, clock: 200, place: 5, boats: 8, inc: { ocs: 1 }, last: 'ocs', ago: 30, pens: 1, mins: 3.4 }, rating: 2, comment: 'SECRET-SAID' },
    { id: 'r2', visit: 'gone', at: '2026-11-10T10:01:00Z', finished_at: '2026-11-10T10:09:00Z', wind: 'medium', laps: 1, length: 'short', boats: 6, place: 2, secs: 480, dsq: false, daily: null, shape: 'wl', yacht: null, venue: 'cowes', perf: null, ended: null, rating: null, comment: null }] };
const DUELS = { since: null, more: false, totals: { races: 3, finished: 2, abandoned: 1, no_result: 0, sailors: 3, seats: 6, signed: 3, rematches: 0, median: 500 },
  days: [{ d: '2026-11-17', n: 3, fin: 2 }], endings: { forfeit: 0, no_winner: 0, dnf: 0, dsq: 0, both: 2 }, groups: [{ k: 'venue', v: 'cowes', n: 3, fin: 2 }],
  races: [{ id: 'd1', code: 'SECRET-DUEL', race_no: 1, at: '2026-11-17T10:00:00Z', ended: '2026-11-17T10:09:00Z', state: 'finished', venue: 'cowes', yacht: 'j70', wind: 'light', length: 'short', course: 'wl', laps: 1, start_min: 1,
    current: false, daytime: null, winner: 'host', margin: 3, forfeited: null, recalls: 0, prep_flag: null, length_s: 500,
    host: { name: 'SECRET-DUELIST', who: WHO, kind: 'acct', handle: null, place: 1, secs: 497, mark: null, pens: 0 }, guest: { name: 'Guest', who: null, kind: 'guest', handle: null, place: 2, secs: 500, mark: null, pens: 0 } }] };
const SETTINGS = { jib_ad: { url: 'https://cdn.example/SECRET-JIB.png', path: 'jib.png' }, main_logo: { url: 'https://cdn.example/SECRET-MAIN.png' }, kite_logo: { url: 'https://cdn.example/SECRET-KITE.png' }, sail_colors: { jib: '#abcdef', kite: ['#fedcba', 'nope'] }, plane_banner: { lines: ['SECRET-BANNER'] } };

// ---------- the database, as the session reading it is answered ----------
const db = { user: null, isAdmin: { data: false, error: null }, rpc: {}, settings: SETTINGS, calls: [] };
const ACCOUNT = { id: 'u1', email: 'sailor@example.com', user_metadata: { display_name: 'Anna Sailor' }, app_metadata: { provider: 'email' } };
const answers = () => ({ regatta_admin_stats: { data: STATS, error: null }, regatta_admin_insight: { data: INSIGHT, error: null }, regatta_admin_players: { data: PLAYERS, error: null }, regatta_admin_logs: { data: LOGS, error: null }, regatta_admin_duels: { data: DUELS, error: null } });
globalThis.__sb = {
  auth: { getUser: async () => ({ data: { user: db.user } }) },
  rpc: async (fn, args) => {
    db.calls.push([fn, args]);
    if (fn !== 'is_regatta_admin') return db.rpc[fn];
    if (db.isAdmin instanceof Error) throw db.isAdmin;
    return db.isAdmin;
  },
  from: () => ({ select: () => ({ eq: (_k, key) => ({ maybeSingle: async () => ({ data: db.settings[key] ? { value: db.settings[key] } : null }) }) }) }),
};
globalThis.fetch = async () => new Response('{}', { status: 503 }); // the scores API, down: the admin's race page copes

// who comes to the admin
const VISITORS = {
  'a guest': () => ({ user: null, isAdmin: { data: false, error: null } }),
  'a signed-in player who is not an admin': () => ({ user: ACCOUNT, isAdmin: { data: false, error: null } }),
  'a player the database gives no answer for': () => ({ user: ACCOUNT, isAdmin: { data: null, error: null } }),
  'a player whose admin check fails with an error': () => ({ user: ACCOUNT, isAdmin: { data: null, error: { message: 'permission denied' } } }),
  'a player whose check answers the word "true"': () => ({ user: ACCOUNT, isAdmin: { data: 'true', error: null } }),
  'a player whose check answers 1': () => ({ user: ACCOUNT, isAdmin: { data: 1, error: null } }),
  'a player whose check answers an object': () => ({ user: ACCOUNT, isAdmin: { data: { admin: true }, error: null } }),
};
const be = (who) => { Object.assign(db, who, { rpc: answers(), settings: SETTINGS, calls: [] }); globalThis.__revalidated = []; };
const admin = () => be({ user: ACCOUNT, isAdmin: { data: true, error: null } });

// ---------- every admin page on disk ----------
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const adminDir = join(ROOT, 'app/[lang]/admin');
const PAGES = walk(adminDir).filter((f) => f.endsWith('page.tsx')).map((f) => ({ file: f, id: relative(adminDir, f).replace(/\/?page\.tsx$/, '') || 'hub' }));
// what only an admin's copy of each page has
const ONLY_ADMIN = { hub: 'adm-hub', ads: 'SECRET-BANNER', game: 'SECRET-COMMENT', players: 'SECRET-PLAYER', tech: 'SECRET-CHIP', race: 'adm-sched', logs: 'SECRET-LOGGED', duels: 'SECRET-DUELIST' };
const SECRETS = /SECRET-|adm-hub|adm-sched|adm-bar|adm-tile/;

const load = (file) => import(file);
const props = (lang, sp = {}) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(sp) });
const render = async (file, lang = 'en', sp) => renderToStaticMarkup(await (await load(file)).default(props(lang, sp)));
const page = (id) => PAGES.find((p) => p.id === id).file;

test('every admin page on disk is one this file knows how to check', () => {
  assert.deepEqual(PAGES.map((p) => p.id).sort(), Object.keys(ONLY_ADMIN).sort());
});

for (const { id, file } of PAGES) {
  for (const [who, state] of Object.entries(VISITORS)) {
    for (const lang of ['en', 'ru']) {
      test(`/admin ${id} (${lang}) shows ${who} nothing of the admin's`, async () => {
        be(state());
        const html = await render(file, lang, { days: '7' });
        assert.doesNotMatch(html, SECRETS);
      });
    }
  }

  test(`/admin ${id} asks a guest to sign in and comes back here after it`, async () => {
    be(VISITORS['a guest']());
    const html = await render(file);
    const here = id === 'hub' ? '/admin' : `/admin/${id}`;
    assert.ok(html.includes(`href="/sign-in?next=${here}"`), 'the sign-in link returns to this page');
    assert.match(html, /Sign in as an admin/);
    assert.equal(db.calls.length, 0, 'a guest costs the database no question at all');
  });

  test(`/admin ${id} tells a signed-in player they are not on the list, in their language`, async () => {
    be(VISITORS['a signed-in player who is not an admin']());
    assert.match(await render(file, 'en'), /sailor@example\.com is not on the admin list\./);
    be(VISITORS['a signed-in player who is not an admin']());
    assert.match(await render(file, 'ru'), /sailor@example\.com нет в списке администраторов\./);
  });

  test(`/admin ${id} shows an admin what the page is for, in both languages`, async () => {
    admin();
    const en = await render(file, 'en');
    assert.ok(en.includes(ONLY_ADMIN[id]), `${ONLY_ADMIN[id]} is on the page`);
    assert.match(en, /adm-bar/, 'the admin pages are linked to each other');
    assert.doesNotMatch(en, /not on the admin list/);
    admin();
    const ru = await render(file, 'ru');
    assert.ok(ru.includes(ONLY_ADMIN[id]));
    assert.match(ru, /Разделы админки/);
    assert.notEqual(en, ru);
  });

  test(`/admin ${id} is kept out of search, and titled in each language`, async () => {
    const { generateMetadata } = await load(file);
    const [en, ru] = await Promise.all(['en', 'ru'].map((lang) => generateMetadata(props(lang))));
    assert.deepEqual(en.robots, { index: false, follow: true });
    assert.deepEqual(ru.robots, { index: false, follow: true });
    assert.match(en.title, /^Admin/);
    assert.match(ru.title, /^Админка/);
    assert.equal(en.alternates, undefined, 'no canonical address: it is not a page to find');
  });

  test(`/admin ${id} refuses a language the site doesn't have`, async () => {
    be(VISITORS['a guest']());
    await assert.rejects(render(file, 'fr'), (e) => e.kind === 'notFound');
  });
}

// ---------- what the data pages do for an admin ----------
for (const [id, fns] of [['game', ['regatta_admin_stats', 'regatta_admin_insight']], ['players', ['regatta_admin_players', 'regatta_admin_insight']], ['tech', ['regatta_admin_stats', 'regatta_admin_insight']]]) {
  test(`/admin/${id} asks the database for the period in the address, and 30 days for anything else`, async () => {
    for (const [q, days] of [['7', 7], ['30', 30], ['90', 90], ['365', 30], ['abc', 30], [undefined, 30], ['-7', 30]]) {
      admin();
      await render(page(id), 'en', q === undefined ? {} : { days: q });
      for (const fn of fns) assert.deepEqual(db.calls.find((c) => c[0] === fn), [fn, { days }], `${fn} for ?days=${q}`);
    }
  });

  test(`/admin/${id} marks the chosen period and keeps it on the links to the other number pages`, async () => {
    admin();
    const html = await render(page(id), 'en', { days: '90' });
    assert.match(html, new RegExp(`href="/admin/${id}\\?days=90"[^>]*aria-current="page"`));
    assert.ok(html.includes('href="/admin/tech?days=90"') && html.includes('href="/admin/game?days=90"'));
    assert.ok(html.includes('href="/admin/race"'), 'the race page has no period');
  });

  test(`/admin/${id} says why when the database's numbers fail`, async () => {
    admin();
    for (const fn of fns) db.rpc[fn] = { data: null, error: { message: 'canceling statement due to timeout' } };
    const en = await render(page(id), 'en');
    assert.equal(en.match(/The numbers didn’t load: canceling statement due to timeout/g)?.length, 2, 'each of the two blocks says so');
    admin();
    for (const fn of fns) db.rpc[fn] = { data: null, error: { message: 'boom' } };
    assert.match(await render(page(id), 'ru'), /Цифры не загрузились: boom/);
  });

  test(`/admin/${id} says so when the period has no numbers`, async () => {
    admin();
    for (const fn of fns) db.rpc[fn] = { data: null, error: null };
    assert.equal((await render(page(id), 'en')).match(/Nothing in this period\./g)?.length, 2);
  });
}

test('/admin/game and /admin/tech count a period with no "all" row as having no numbers', async () => {
  for (const id of ['game', 'tech']) {
    admin();
    db.rpc.regatta_admin_stats = { data: { ...STATS, groups: [group('yacht', 'j70')] }, error: null };
    assert.match(await render(page(id), 'en'), /Nothing in this period\./, id);
  }
});

test('/admin/players lists a player, and /admin/tech the errors on the page', async () => {
  admin();
  const players = await render(page('players'));
  assert.match(players, /SECRET-PLAYER/);
  assert.match(players, /Do they come back/);
  admin();
  const tech = await render(page('tech'));
  assert.match(tech, /SECRET-ERROR/);
  assert.match(tech, /SECRET-LOAD-FAILURE/);
});

// ---------- /admin/logs: who had a problem, and one player's log ----------
const logsCall = () => db.calls.find((c) => c[0] === 'regatta_admin_logs');

test('/admin/logs lists the players with a problem, each linked to their log', async () => {
  admin();
  const html = await render(page('logs'), 'en', { days: '7' });
  assert.deepEqual(logsCall(), ['regatta_admin_logs', { days: 7, person: null }]);
  assert.ok(html.includes(`href="/admin/logs?who=${WHO}&amp;days=7"`), 'the player opens with the period kept');
  assert.match(html, /3\/40/);
});

test('/admin/logs?who= asks for that player and shows everything kept of their visits and races', async () => {
  admin();
  db.rpc.regatta_admin_logs = { data: { ...LOGS, report: REPORT }, error: null };
  const html = await render(page('logs'), 'en', { who: WHO.toUpperCase(), days: '90' });
  assert.deepEqual(logsCall(), ['regatta_admin_logs', { days: 90, person: WHO }]);
  for (const s of ['SECRET-WHY', 'SECRET-STACK', 'main.js:12', 'SECRET-GPU', 'SECRET-SAID', 'Load failed', '3D lost', '18 FPS', 'Rated 2 of 5', 'Over early × 1', 'Closed the page']) assert.ok(html.includes(s), s);
  assert.ok(html.includes(`href="/admin/logs?days=90&amp;who=${WHO}"`), 'a change of period stays on this player');
  assert.ok(html.includes('href="/admin/logs?days=90"'), 'the way back keeps the period');
  assert.ok(html.indexOf('SECRET-STACK') < html.indexOf('2/6'), 'the latest first; a race whose visit is gone is still listed');
});

test('/admin/logs takes only a player id from the address', async () => {
  for (const who of ['abc', "1' or 1=1", '../etc', '1234567890123456789', `${WHO}x`]) {
    admin();
    await render(page('logs'), 'en', { who });
    assert.deepEqual(logsCall(), ['regatta_admin_logs', { days: 30, person: null }], who);
  }
  admin();
  await render(page('logs'), 'en', { who: '123456789' });
  assert.deepEqual(logsCall(), ['regatta_admin_logs', { days: 30, person: '123456789' }]);
});

test('/admin/logs says why when the log fails, and when a player has nothing in the period', async () => {
  admin();
  db.rpc.regatta_admin_logs = { data: null, error: { message: 'function not found' } };
  assert.match(await render(page('logs')), /The numbers didn’t load: function not found/);
  admin();
  db.rpc.regatta_admin_logs = { data: { ...LOGS, report: { ...REPORT, visits: [], races: [], first: null, last: null } }, error: null };
  assert.match(await render(page('logs'), 'en', { who: WHO }), /Nothing recorded for this player in this period\./);
  admin();
  db.rpc.regatta_admin_logs = { data: { ...LOGS, people: [] }, error: null };
  assert.match(await render(page('logs')), /No player had a problem in this period\./);
});

test('/admin/players links each player to their log', async () => {
  admin();
  assert.ok((await render(page('players'), 'en', { days: '7' })).includes('href="/admin/logs?who=abcd1234&amp;days=7"'));
});

test('/admin/ads shows the saved logos and the banner\'s words', async () => {
  admin();
  const html = await render(page('ads'));
  assert.ok(html.includes('https://cdn.example/SECRET-JIB.png'));
  assert.ok(html.includes('https://cdn.example/SECRET-MAIN.png'));
  assert.ok(html.includes('https://cdn.example/SECRET-KITE.png'));
  assert.ok(html.includes('#ABCDEF') && html.includes('#FEDCBA'), 'the saved colours shown');
  const card = (k) => html.slice(html.indexOf(`adm adm-${k}"`), html.indexOf('</section>', html.indexOf(`adm adm-${k}"`)));
  assert.match(card('jib'), /Colour of the jibs/, 'each sail\'s colour in its own card');
  assert.match(card('kite'), /Colour of the gennakers/);
  assert.doesNotMatch(card('main'), /Colour of/);
  assert.doesNotMatch(html, /adm-dye adm-dye/, 'no card of their own');
  assert.match(html, /SECRET-BANNER/);
});

test('/admin/ads?set= sets a set\'s own, showing every venue\'s until it has them, and no banner', async () => {
  admin();
  db.settings = { ...SETTINGS, sail_sets: {
    turkey: { name: 'Turkey', venues: ['gocek', 'nowhere', 'gocek'], kite: { url: 'https://cdn.example/TR-KITE.png', path: 'kite/t.png' }, colors: { jib: 'auto', kite: 'own' }, jib: { url: 'javascript:x' } },
    again: { name: '', venues: ['gocek', 'cowes'], main: { url: 'https://cdn.example/AGAIN.png' } }, 'Bad Id': { name: 'X', venues: [] }, junk: 'junk',
  } };
  const html = await render(page('ads'), 'en', { set: 'turkey' });
  assert.ok(html.includes('https://cdn.example/TR-KITE.png'), 'its own gennaker logo');
  assert.ok(html.includes('https://cdn.example/SECRET-JIB.png'), 'every venue\'s jib ad, as it has none');
  assert.doesNotMatch(html, /SECRET-KITE|javascript:x/);
  assert.match(html, /<option value="turkey" selected="">Turkey · 1 venue<\/option><option value="again">again · 1 venue<\/option>/, 'a venue in one set only; a set with no name goes by its id');
  assert.doesNotMatch(html, /Bad Id|junk/);
  assert.match(html, /The set · Turkey/);
  assert.doesNotMatch(html, /On the plane’s banner/);
  const all = await render(page('ads'), 'en', { set: 'nowhere' });
  assert.match(all, /On the plane’s banner/, 'a set there isn\'t: every venue\'s');
  assert.doesNotMatch(all, /The set ·/);
  assert.ok(all.includes('https://cdn.example/SECRET-KITE.png'));
});

test('/admin/ads leaves out a saved setting that is not what it should be', async () => {
  admin();
  db.settings = { jib_ad: { url: 42 }, main_logo: { path: 'no-url.png' }, plane_banner: { lines: ['KEPT-LINE', 7, null] } };
  const html = await render(page('ads'));
  assert.doesNotMatch(html, /no-url\.png/);
  assert.doesNotMatch(html, /src="42"/);
  assert.match(html, /KEPT-LINE/);
  admin();
  db.settings = { plane_banner: { lines: 'not a list' } };
  assert.doesNotMatch(await render(page('ads')), /not a list/);
});

test('/admin/race still opens for an admin when the scores API is down', async () => {
  admin();
  const html = await render(page('race'));
  assert.match(html, /adm-sched/);
  assert.match(html, /No races yet/);
});

// ---------- the server action: the most important check here ----------
const actionsFile = join(ROOT, 'app/[lang]/admin/actions.ts');

test('the only server actions in the site are the ones tested here', () => {
  const found = ['app', 'lib', 'components'].flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => /\.tsx?$/.test(f) && /^\s*['"]use server['"]/m.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(found, ['app/[lang]/admin/actions.ts']);
});

test('sponsorChanged is the admin file\'s only action', async () => {
  assert.deepEqual(Object.keys(await load(actionsFile)), ['sponsorChanged']);
});

for (const [who, state] of Object.entries(VISITORS)) {
  test(`sponsorChanged does nothing for ${who}`, async () => {
    const { sponsorChanged } = await load(actionsFile);
    be(state());
    await sponsorChanged();
    assert.deepEqual(globalThis.__revalidated, []);
  });
}

test('sponsorChanged does nothing when the admin check itself throws', async () => {
  const { sponsorChanged } = await load(actionsFile);
  be({ user: ACCOUNT, isAdmin: new Error('network down') });
  await sponsorChanged().catch(() => {});
  assert.deepEqual(globalThis.__revalidated, []);
});

test('sponsorChanged drops the sponsor cache for an admin, and only that', async () => {
  const { sponsorChanged } = await load(actionsFile);
  admin();
  await sponsorChanged();
  assert.deepEqual(globalThis.__revalidated, [['sponsor']]);
});

test('sponsorChanged asks the database every time: an admin who has lost the role is refused', async () => {
  const { sponsorChanged } = await load(actionsFile);
  admin();
  await sponsorChanged();
  be(VISITORS['a signed-in player who is not an admin']());
  await sponsorChanged();
  assert.deepEqual(globalThis.__revalidated, []);
  assert.deepEqual(db.calls, [['is_regatta_admin', undefined]]);
});
