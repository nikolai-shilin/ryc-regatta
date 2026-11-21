// The 1-on-1 plan's targets on the admin's 1-on-1 page (components/admin-targets.tsx, from the database's
// regatta_admin_targets): each release's target with its figure over the page's period, met, not yet, no data or a
// baseline written down; days sailed against the 30 days before; and the page asking for them with its period, and
// drawing without them when they don't come. Run: node --test test/admin-targets.test.mjs
import { mock } from './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const { AdminTargets, GOALS, standing, daysStanding } = await import('../components/admin-targets.tsx');

const DATA = {
  since: null, gun: [36, 36], gun_fin: [36, 36], trusted: [34, 36], rated_1min: [10, 10], disputed: [1, 20], invite_gun: [0, 0], invite_fin: [0, 0],
  claim: [1, 2], rematch: [18, 36], wait_hour: [24, 6], wait_all: [41.5, 15], pair_gun: [6, 8], first_fin: [4, 8], back_7: [0, 0],
  push_ok: [0, 0], call_10: [3, 4], days_now: [2.27, 90], days_prev: [1.8, 70], fy_tap: [1, 22], fy_dismiss: [0, 22],
};
const row = (h, what) => { const r = h.split('<tr>').find((x) => x.includes(what)); return r && plain(r); };

test('each target against its figure: met, not yet, no data, or a baseline written down', () => {
  const g = (k) => GOALS.find((x) => x.key === k);
  assert.equal(standing(g('trusted'), [95, 100]), 'met');
  assert.equal(standing(g('trusted'), [94, 100]), 'not');
  assert.equal(standing(g('disputed'), [1, 51]), 'met', 'under 2%');
  assert.equal(standing(g('disputed'), [1, 50]), 'not', '2% is not under 2%');
  assert.equal(standing(g('wait_hour'), [30, 3]), 'met', 'a time at most 30 s');
  assert.equal(standing(g('wait_hour'), [31, 3]), 'not');
  assert.equal(standing(g('wait_hour'), [null, 0]), 'none');
  assert.equal(standing(g('invite_gun'), [0, 0]), 'none');
  assert.equal(standing(g('gun'), [3, 4]), 'base');
  assert.equal(daysStanding([2.3, 9], [1.8, 7]), 'met');
  assert.equal(daysStanding([1.5, 9], [1.8, 7]), 'not');
  assert.equal(daysStanding([1.5, 9], [null, 0]), 'base', 'nothing before to compare with');
  assert.equal(daysStanding(undefined, undefined), 'none');
});

test('the table: every release in order, with the target, the figure behind it and where it stands', () => {
  const h = renderToStaticMarkup(AdminTargets({ lang: 'en', data: DATA }));
  const rels = [...h.matchAll(/<th scope="row"><span class="adm-pl-name">(\d) · /g)].map((m) => +m[1]);
  assert.deepEqual(rels, [1, 2, 3, 4, 5, 6, 7], 'each release named once, in order');
  assert.equal(row(h, 'finished races with both accounts'), 'finished races with both accounts and both screens agreeing ≥ 95% 94% · 34 of 36 Not yet');
  assert.equal(row(h, 'disputed'), 'finished rated races disputed < 2% 5% · 1 of 20 Not yet');
  assert.match(row(h, 'median wait'), /≤ 30 s 24 s · 6 waits Met$/);
  assert.match(row(h, 'median wait'), /At any hour: 42 s\./);
  assert.match(row(h, 'friends’ links opened'), / – No data yet$/);
  assert.match(row(h, '1-on-1s that reach the gun'), /^1 · Trusted results 1-on-1s that reach the gun Baseline 100% · 36 of 36 Written down$/);
  assert.match(row(h, 'Match found sent while away'), /Opens aren’t recorded/);
  assert.match(row(h, 'days sailed'), /The 30 days before: 1\.8 · 70 sailors\..*up on the 30 before 2\.27 · 90 sailors Met$/);
  assert.match(row(h, '/race/rating'), /next\.config\.ts.* 0 0 Met$/);
  const met = h.match(/>Met</g).length;
  assert.match(plain(h), new RegExp(`over this period\\. ${met} met\\.`));
  assert.ok(/style="color:var\(--warn\)"/.test(h) && /style="color:var\(--up\)"/.test(h));
});

test('in Russian too', () => {
  const h = plain(renderToStaticMarkup(AdminTargets({ lang: 'ru', data: DATA })));
  assert.match(h, /Цели плана/);
  assert.match(h, /94% · 34 из 36 Пока нет/);
  assert.match(h, /Нет данных/);
  assert.match(h, /2,27 · гонщиков: 90 Выполнено/);
});

test('the page asks for the targets with its period, and draws without them when they fail', async () => {
  const calls = [];
  let fail = false;
  const DUELS = { since: null, more: false, totals: { races: 1, finished: 1, abandoned: 0, no_result: 0, sailors: 2, seats: 2, signed: 2, rematches: 0, median: 400 }, days: [], endings: { forfeit: 0, no_winner: 0, dnf: 0, dsq: 0, both: 1 }, groups: [], races: [] };
  globalThis.__sb = {
    auth: { getClaims: async () => ({ data: { claims: { sub: 'u1', email: 'a@example.com' } } }), getUser: async () => ({ data: { user: { id: 'u1', email: 'a@example.com', user_metadata: {} } } }) },
    rpc: async (fn, args) => { calls.push([fn, args]); if (fn === 'is_regatta_admin') return { data: true, error: null }; if (fn === 'regatta_admin_duels') return { data: DUELS, error: null };
      if (fn === 'regatta_admin_targets') { if (fail === 'throw') throw new Error('offline'); return fail ? { data: null, error: { message: 'down' } } : { data: DATA, error: null }; } return { data: null, error: null }; },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  };
  const page = (await import('../app/[lang]/admin/duels/page.tsx')).default;
  const view = async (sp) => renderToStaticMarkup(await page({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve(sp) }));
  const h = await view({ days: '7' });
  assert.deepEqual(calls.find((c) => c[0] === 'regatta_admin_targets'), ['regatta_admin_targets', { days: 7 }]);
  assert.match(plain(h), /The plan’s targets/);
  fail = true;
  const h2 = await view({});
  assert.doesNotMatch(plain(h2), /The plan’s targets/);
  assert.match(plain(h2), /Races/);
  fail = 'throw';
  const h3 = await view({});
  assert.doesNotMatch(plain(h3), /The plan’s targets/, 'a call that throws');
  assert.match(plain(h3), /Races/);
});
