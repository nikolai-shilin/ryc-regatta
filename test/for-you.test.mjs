// For you (release 7e of the 1-on-1 plan; lib/suggest.ts, components/for-you.tsx, GET/POST /connect/suggest): gather,
// score, filter, show and learn. A newcomer gets only the first race; a guest today's race and a sign-in; today's race
// says the streak at stake, a new venue or the time left; once sailed, the time to the next group; someone looking
// now is live; three at most, never two of a group, best first, each with the reason that scored highest; a kind held
// out (dismissed this week) never shows; weights and staleness reorder; a guest's taps and dismissals kept on the
// device as the database keeps a signed-in sailor's; the route for the session's account alone; and the list on the
// home page and on /duel. Run: node --test test/for-you.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from './load.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { click, dom, done, h, json, mount, plain, reset, serve, signIn } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
const { suggest, gather, markLocal, localState, parseState, FACTOR } = await import('../lib/suggest.ts');
const { ForYou, ForYouView } = await import('../components/for-you.tsx');
const { NextRequest } = await import('next/server');
const { GET, POST } = await import('../app/connect/suggest/route.ts');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');

const NOW = Date.parse('2026-11-21T12:00:00Z'), TODAY = '2026-11-21';
const base = (o = {}) => ({ now: NOW, back: true, signed: false, log: { d: {}, v: {} }, field: null, rating: null, ready: [], hour: null, achievements: null, ...o });
const READY = [{ handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1540, races: 12, waited: 20, away: false }, { handle: '3f9a0c1d2e4c', name: 'Bo', rating: 1900, races: 30, waited: 5, away: false }];
beforeEach(() => { reset({ url: 'https://updown.test/', at: NOW }); rpc.calls = []; rpc.data = null; rpc.error = null; globalThis.__sb = { rpc: async (fn, args) => { rpc.calls.push({ fn, ...(args || {}) }); return { data: rpc.data, error: rpc.error }; } }; });
afterEach(done);

test('a device that hasn\'t raced: its first race, nothing else', () => {
  const c = suggest(base({ back: false, signed: true, ready: READY }), 'en', null);
  assert.deepEqual(c.map((x) => [x.kind, x.href]), [['first_race', '/play?race=first&intro']]);
  assert.match(c[0].why, /Tobago Cays/);
});

test('a guest who has raced: today\'s race and a sign-in, nothing rated', () => {
  const c = suggest(base({ ready: READY }), 'en', null);
  assert.deepEqual(c.map((x) => x.kind).sort(), ['sign_in', 'today']);
  const v = venueOf(dailyRace(new Date(NOW)).venue).name[0];
  assert.ok(c.find((x) => x.kind === 'today').title.startsWith(`Today’s race: ${v}`));
});

test('today\'s race: the streak at stake says why first; a venue new to you; the hours left near midnight', () => {
  const d = { '2026-11-17': 300, '2026-11-18': 300, '2026-11-19': 300 }; // yesterday missed
  let c = gather(base({ log: { d, v: {} } }), 'en').find((x) => x.kind === 'today');
  assert.deepEqual(c.reasons.map((r) => r[0]), ['goal', 'fresh']);
  assert.match(c.reasons[0][1], /you missed yesterday: finish today or your 3-day streak ends\./);
  assert.equal(suggest(base({ log: { d, v: {} } }), 'en', null).find((x) => x.kind === 'today').why, c.reasons[0][1], 'the goal outscores the new venue');
  c = gather(base({ now: Date.parse('2026-11-21T20:30:00Z') }), 'en').find((x) => x.kind === 'today');
  assert.match(c.reasons.at(-1)[1], /closes in 4 h, at midnight UTC\./);
});

test('sailed today: the next group up and the time that reaches it', () => {
  const field = Array.from({ length: 50 }, (_, i) => 300 + i); // 300 … 349
  const c = suggest(base({ log: { d: { [TODAY]: 313.5 }, v: {} }, field }), 'en', null).find((x) => x.kind === 'today_better');
  assert.equal(c.title, 'You’re 15th of 50: the top 10 is 4.5 s away');
  assert.equal(c.why, 'a 5:09.0 puts you 10th.');
  assert.equal(c.act, 'Beat 5:13.5');
  assert.equal(suggest(base({ log: { d: { [TODAY]: 300 }, v: {} }, field }), 'en', null).find((x) => x.kind === 'today_better'), undefined, 'first: nothing to beat');
  assert.ok(!suggest(base({ log: { d: { [TODAY]: 313.5 }, v: {} }, field }), 'en', null).some((x) => x.kind === 'today'));
});

test('signed in: the nearest sailor looking is live and first; three at most, one of a group, best first', () => {
  const i = base({ signed: true, log: { d: {}, v: {} }, rating: { rating: 1580, races: 9 }, ready: READY,
    hour: { day: TODAY, in: 12, near: 3, me: false, reach: true }, achievements: { got: [], progress: { venues_10: [8, 10] } } });
  const c = suggest(i, 'en', null);
  assert.equal(c.length, 3);
  assert.equal(c[0].kind, 'ready'); assert.ok(c[0].live);
  assert.equal(c[0].title, 'Cara M. is ready for a race'); assert.equal(c[0].why, 'Cara M. is looking for a race right now.');
  assert.equal(c[0].href, '/duel?challenge=3f9a0c1d2e4b');
  assert.ok(c.every((x, k) => !k || x.score <= c[k - 1].score), 'best first');
  assert.ok(!c.some((x) => x.kind === 'first_duel'), 'one of a group: ready and first 1-on-1 are both 1-on-1s');
  assert.equal(FACTOR.live * FACTOR.close, c[0].score);
});

test('a kind held out never shows; a weight or a stale kind moves the order', () => {
  const i = base({ signed: true, rating: { rating: 1580, races: 9 }, ready: READY });
  assert.ok(!suggest(i, 'en', { weights: {}, out: ['ready'], stale: [] }).some((x) => x.kind === 'ready'), 'dismissed this week');
  const plain1 = suggest(i, 'en', null).map((x) => x.kind);
  assert.equal(plain1[0], 'ready');
  assert.notEqual(suggest(i, 'en', { weights: { ready: 0.2 }, out: [], stale: [] })[0].kind, 'ready');
  const stale = suggest(i, 'en', { weights: {}, out: [], stale: ['ready'] }).find((x) => x.kind === 'ready');
  assert.equal(stale.score, FACTOR.live * FACTOR.close * FACTOR.stale);
});

test('a guest\'s taps and dismissals, on the device, in the database\'s steps', () => {
  let l = { w: {}, out: {} };
  l = markLocal(l, 'tap', 'today', NOW); assert.equal(l.w.today, 1.1);
  for (let k = 0; k < 20; k++) l = markLocal(l, 'tap', 'today', NOW);
  assert.equal(l.w.today, 3, 'up to 3');
  l = markLocal(l, 'dismiss', 'sign_in', NOW); assert.equal(l.w.sign_in, 0.8);
  l = markLocal(l, 'fewer', 'goal', NOW); assert.equal(l.w.goal, 0.5);
  assert.deepEqual(localState(l, NOW).out.sort(), ['goal', 'sign_in']);
  assert.deepEqual(localState(l, NOW + 7 * 864e5 + 1).out, [], 'a week later, back');
  assert.deepEqual(parseState({ weights: { today: 1.21, bad: -1 }, out: ['level', 3], stale: null }), { weights: { today: 1.21 }, out: ['level'], stale: [] });
});

test('the card: the title, why, its button, fewer like this and ×; live ones marked', () => {
  const cards = suggest(base({ signed: true, ready: READY, rating: { rating: 1580, races: 9 } }), 'en', null);
  const html = renderToStaticMarkup(h(ForYouView, { lang: 'en', cards, mark: () => {} }));
  assert.match(plain(html), /^For you Now Cara M\. is ready for a race Why: Cara M\. is looking for a race right now\. Race Cara M\. Fewer like this ×/);
  assert.match(html, /class="fy-c fy-ready live"/); assert.match(html, /aria-label="Hide this for a week"/);
});

test('on the page: a signed-in sailor\'s list from what the page gathers; × tells the database and the card goes', async () => {
  document.documentElement.setAttribute('data-back', '');
  signIn();
  const posted = [];
  serve([['/connect/rating/me', json({ rating: 1580, races: 9, wins: 5, losses: 4, best: 1600, lowest: 1500, place: 3, of: 10, changes: [], recent: [] })],
    ['/connect/seek', (u, init) => json(JSON.parse(init.body).do === 'ready_now' ? { list: READY } : { hour: null })],
    ['/connect/achievements', json({ got: [], progress: {} })],
    ['/connect/suggest', (u, init) => { if (init?.method === 'POST') posted.push(JSON.parse(init.body)); return json({ weights: {}, out: [], stale: [] }); }]]);
  const v = await mount(h(ForYou, { lang: 'en' }));
  assert.match(v.text(), /Cara M\. is ready for a race/);
  assert.deepEqual(posted[0], { ev: 'shown', kinds: posted[0].kinds }); assert.ok(posted[0].kinds.includes('ready'));
  await click(v.$('.fy-ready .fy-x'));
  assert.deepEqual(posted.at(-1), { ev: 'dismiss', kinds: ['ready'] });
  assert.ok(!v.$('.fy-ready'));
  await v.unmount();
});

test('on the page: a guest\'s list and its × kept on this device; a newcomer\'s first race', async () => {
  document.documentElement.setAttribute('data-back', '');
  serve([]);
  let v = await mount(h(ForYou, { lang: 'en' }));
  assert.match(v.text(), /Keep your times on every device .* Today’s race:/);
  assert.equal(dom.fetches.length, 0, 'a guest who hasn\'t sailed today asks nothing');
  await click(v.$('.fy-sign_in .fy-x'));
  assert.ok(!v.$('.fy-sign_in'));
  assert.ok(JSON.parse(localStorage.getItem('regatta-suggest')).out.sign_in > Date.now());
  await v.unmount();
  v = await mount(h(ForYou, { lang: 'en' }));
  assert.ok(!v.$('.fy-sign_in'), 'still out on the next visit');
  await v.unmount();
  document.documentElement.removeAttribute('data-back');
  v = await mount(h(ForYou, { lang: 'en' }));
  assert.match(v.text(), /^For you Your first race: three minutes/);
  await v.unmount();
});

test('the route: the state and the marks for the session\'s account; unknown kinds and other sites refused', async () => {
  const req = (body, origin = 'https://www.sailupdown.com') => new NextRequest(new URL('/connect/suggest', 'https://www.sailupdown.com'), { method: 'POST', headers: { host: 'www.sailupdown.com', origin }, body: JSON.stringify(body) });
  rpc.data = { weights: { today: 1.1 }, out: [], stale: [] };
  assert.deepEqual(await (await GET()).json(), { weights: { today: 1.1 }, out: [], stale: [] });
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_suggest_state' });
  await POST(req({ ev: 'shown', kinds: ['today', 'nope', 'ready', 'hour', 'level'] }));
  assert.deepEqual(rpc.calls.at(-1), { fn: 'regatta_suggest_mark', p_ev: 'shown', p_kinds: ['today', 'ready', 'hour'] });
  rpc.calls = [];
  for (const b of [{ ev: 'boom', kinds: ['today'] }, { ev: 'tap', kinds: ['nope'] }, { ev: 'tap' }]) assert.equal(await (await POST(req(b))).json(), null);
  assert.equal(await (await POST(req({ ev: 'tap', kinds: ['today'] }, 'https://evil.example'))).json(), null);
  assert.equal(rpc.calls.length, 0);
});

test('on the home page for a sailor who has raced, and on /duel', () => {
  const home = readFileSync(new URL('../app/[lang]/page.tsx', import.meta.url), 'utf8'), duel = readFileSync(new URL('../app/[lang]/duel/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /<div className="ho-sec ho-old"><ForYou lang=\{lang\} \/><\/div>/);
  assert.match(duel, /<ForYou lang=\{lang\} \/>/);
});
