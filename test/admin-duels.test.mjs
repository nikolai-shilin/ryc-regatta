// The admin's page on the 1-on-1 races (components/admin-duels.tsx, app/[lang]/admin/duels/page.tsx): the totals, every
// race and its result, the period links, and that a non-admin sees none of it. Run: node --test test/admin-duels.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { hrefs, plain } from './fake-dom.mjs';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 18, 12) });
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');

const { AdminDuels, pickDuelDays } = await import('../components/admin-duels.tsx');

const sailor = (o = {}) => ({ name: 'Anna Petrova', who: 'u-anna', kind: 'acct', handle: 'anna@example.com', place: 1, secs: 521, mark: null, pens: 0, ...o });
const race = (o = {}) => ({
  id: 'r1', code: 'KQ7M', race_no: 1, at: '2026-11-18T14:02:00Z', ended: '2026-11-18T14:11:00Z', state: 'finished',
  venue: 'cowes', yacht: 'j70', wind: 'light', length: 'short', course: 'tri', laps: 1, start_min: 1, current: false, daytime: null,
  winner: 'host', margin: 12, forfeited: null, recalls: 0, prep_flag: null, length_s: 533,
  host: sailor(), guest: sailor({ name: 'Boris', who: null, kind: 'guest', handle: null, place: 2, secs: 533 }), ...o,
});
const TOTALS = { races: 128, finished: 104, abandoned: 17, no_result: 7, sailors: 86, seats: 200, signed: 122, rematches: 39, median: 702 };
const data = (o = {}) => ({
  since: null, more: false, totals: TOTALS, days: [{ d: '2026-11-17', n: 5, fin: 4 }, { d: '2026-11-18', n: 3, fin: 3 }],
  endings: { forfeit: 22, no_winner: 3, dnf: 3, dsq: 8, both: 71 }, groups: [{ k: 'venue', v: 'cowes', n: 60, fin: 50 }, { k: 'start', v: '3', n: 10, fin: 5 }, { k: 'wind', v: null, n: 2, fin: 0 }],
  races: [race()], ...o,
});
const html = (o, lang = 'en', days = null) => renderToStaticMarkup(AdminDuels({ lang, data: data(o), days }));
const text = (o, lang, days) => plain(html(o, lang, days));
const tile = (h, k) => new RegExp(`adm-tile-k">${k}</span><b>(.*?)</b>`).exec(h)?.[1];

test('the totals: races, finished, abandoned, no result, sailors, signed in, rematches, median', () => {
  const h = html();
  assert.equal(tile(h, 'Races'), '128');
  assert.equal(tile(h, 'Finished'), '104 · 81%');
  assert.equal(tile(h, 'Abandoned'), '17 · 13%');
  assert.equal(tile(h, 'No result'), '7 · 5%');
  assert.equal(tile(h, 'Sailors'), '86');
  assert.equal(tile(h, 'Signed in'), '61%');
  assert.equal(tile(h, 'Rematches'), '39');
  assert.equal(tile(h, 'Median race'), '11:42.0');
  assert.equal(tile(html({ totals: { ...TOTALS, races: 0, seats: 0, median: null } }), 'Median race'), '–');
});

test('the endings and the tables by venue and start are there', () => {
  const t = text();
  assert.match(t, /Both home 71 · Forfeit 22 · DSQ 8 · DNF 3 · No winner 3/);
  assert.match(t, /By venue Venue Races Finished Cowes 60 83%/);
  assert.match(t, /By start Start Races Finished 3 min 10 50%/);
});

test('each race shows who, where, when, the settings, the result and the state', () => {
  const t = text();
  assert.match(t, /18 Nov, 14:02/);
  assert.match(t, /KQ7M/);
  assert.match(t, /Cowes · .*Light/);
  assert.match(t, /Triangle · Short · 1 lap · 1 min/);
  assert.match(t, /Anna Petrova/);
  assert.match(t, /Boris/);
  assert.match(t, /1st 8:41.0 \/ 2nd 8:53.0/);
  assert.match(t, /12\.0 s/);
  assert.match(t, /8:53.0 Finished/);
});

test('a rematch shows the race number on its code, a first race does not', () => {
  assert.match(text({ races: [race({ race_no: 3 })] }), /KQ7M · Race 3/);
  assert.doesNotMatch(text(), /KQ7M · Race/);
});

test('a signed-in sailor links to her log; a guest is marked and has no link', () => {
  const h = html({ races: [race({ host: sailor({ who: 'u-anna' }) })] }, 'en', 7);
  assert.ok(hrefs(h).includes('/admin/logs?who=u-anna&days=7'));
  assert.equal(hrefs(h).filter((x) => x.startsWith('/admin/logs')).length, 1, 'the guest has no link');
  assert.match(h, /Boris<\/span>|Boris<span class="adm-pl-sub">Guest/);
  assert.match(text(), /Boris Guest/);
  assert.ok(hrefs(html()).includes('/admin/logs?who=u-anna'), 'the log of 30 days is the default');
});

test('DSQ, DNF, a forfeit, no winner, abandoned and no result each read as such, in both languages', () => {
  const o = (r) => ({ races: [r] });
  const dsq = race({ host: sailor({ mark: 'DSQ', place: null, secs: null }), winner: 'guest' });
  assert.match(text(o(dsq), 'en'), /DSQ \/ 2nd 8:53.0/);
  assert.match(text(o(race({ guest: sailor({ name: 'Boris', who: null, kind: 'guest', mark: 'DNF', place: null, secs: null }) })), 'en'), /1st 8:41.0 \/ DNF/);
  assert.match(text(o(race({ forfeited: 'guest', winner: 'host' })), 'en'), /Forfeit: Boris/);
  assert.match(text(o(race({ forfeited: 'guest', winner: 'host' })), 'ru'), /Сдача: Boris/);
  assert.match(text(o(race({ winner: null })), 'en'), /Finished/);
  const ab = race({ state: 'abandoned', ended: null, winner: null, margin: null, length_s: null, host: sailor({ place: null, secs: null }), guest: sailor({ name: 'Boris', who: null, kind: 'guest', place: null, secs: null }) });
  assert.match(text(o(ab), 'en'), /Abandoned/);
  assert.match(text(o(ab), 'ru'), /Брошена/);
  assert.doesNotMatch(text(o(ab), 'en'), /1st|2nd/);
  const nr = text(o({ ...ab, state: 'no_result' }), 'en');
  assert.match(nr, /No result/);
  assert.match(text(o(race({ state: 'racing', ended: null })), 'en'), /Racing/);
  const ru = text(o(race()), 'ru');
  assert.match(ru, /1-е 8:41.0 \/ 2-е 8:53.0/);
  assert.match(ru, /Финиш/);
  assert.match(ru, /Все гонки|Каждая гонка/);
});

test('a race reported only by a join, with no settings, host or times, still draws', () => {
  const join = race({ venue: null, yacht: null, wind: null, length: null, course: null, laps: null, start_min: null, current: null, winner: null, margin: null, length_s: null,
    state: 'no_result', host: { name: null, who: null, kind: 'guest', handle: null, place: null, secs: null, mark: null, pens: null }, guest: sailor() });
  const t = text({ races: [join] });
  assert.match(t, /KQ7M/);
  assert.match(t, /Anna Petrova/);
  assert.match(t, /No result/);
});

test('a name with markup is drawn as text', () => {
  const h = html({ races: [race({ host: sailor({ name: '<img src=x>' }), guest: sailor({ name: '<b>Bob</b>', who: null, kind: 'guest' }) })] });
  assert.doesNotMatch(h, /<img src=x>|<b>Bob<\/b>/);
  assert.match(h, /&lt;img src=x&gt;/);
});

test('no races: the page says so', () => {
  const h = html({ races: [], days: [], groups: [], totals: { ...TOTALS, races: 0, finished: 0, abandoned: 0, no_result: 0 } });
  assert.match(plain(h), /No races in this period\./);
  assert.doesNotMatch(h, /adm-players/);
});

test('more than the table holds: the page says only the newest 1,000 are shown', () => {
  assert.match(text({ more: true }), /only the newest 1,000 are shown/);
  assert.match(text({ more: true }, 'ru'), /последние 1000/);
  assert.doesNotMatch(text({ more: false }), /newest 1,000/);
});

test('the period links are All time, 90, 30 and 7 days, and All time is the default', () => {
  assert.equal(pickDuelDays(undefined), null);
  assert.equal(pickDuelDays('30'), 30);
  assert.equal(pickDuelDays('13'), null);
  assert.equal(pickDuelDays('90'), 90);
  assert.equal(pickDuelDays('7'), 7);
  assert.equal(pickDuelDays('abc'), null);
  const h = html();
  const nav = /<nav class="adm-range"[^>]*>(.*?)<\/nav>/.exec(h)[1];
  assert.deepEqual([...nav.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]), ['/admin/duels', '/admin/duels?days=90', '/admin/duels?days=30', '/admin/duels?days=7']);
  assert.match(nav, /aria-current="page" class="on">All time/);
  assert.match(plain(nav), /All time 90 days 30 days 7 days/);
  assert.match(/<nav class="adm-range"[^>]*>(.*?)<\/nav>/.exec(html({}, 'en', 30))[1], /href="\/admin\/duels\?days=30"[^>]*aria-current="page"/);
});

// ---------- the page itself, over a stand-in for the database ----------
const db = { user: null, admin: false, calls: [] };
globalThis.__sb = {
  auth: { getUser: async () => ({ data: { user: db.user } }) },
  rpc: async (fn, args) => { db.calls.push([fn, args]); return fn === 'is_regatta_admin' ? { data: db.admin, error: null } : { data: data({ races: [race({ venue: 'SECRET-VENUE-WORD' })] }), error: null }; },
};
const ACCOUNT = { id: 'u1', email: 'sailor@example.com', user_metadata: { display_name: 'Anna Sailor' }, app_metadata: { provider: 'email' } };
const view = async (sp = {}) => renderToStaticMarkup(await (await import('../app/[lang]/admin/duels/page.tsx')).default({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve(sp) }));

test('a non-admin sees none of it', async () => {
  for (const [user, admin] of [[null, false], [ACCOUNT, false], [ACCOUNT, null]]) {
    Object.assign(db, { user, admin, calls: [] });
    const h = await view();
    assert.doesNotMatch(h, /SECRET-VENUE-WORD|KQ7M|adm-tile|adm-range/);
    if (!user) assert.equal(db.calls.length, 0, 'a guest costs the database no question');
  }
});

test('an admin gets the page, asked for all time unless the address names a period', async () => {
  for (const [q, days] of [[undefined, null], ['7', 7], ['90', 90], ['365', null], ['x', null]]) {
    Object.assign(db, { user: ACCOUNT, admin: true, calls: [] });
    const h = await view(q === undefined ? {} : { days: q });
    assert.match(h, /KQ7M/);
    assert.deepEqual(db.calls.find((c) => c[0] === 'regatta_admin_duels'), ['regatta_admin_duels', { days }], `?days=${q}`);
    assert.equal((h.match(/class="adm-range"/g) ?? []).length, 1, 'only the page’s own period links, none from the shell');
  }
});
