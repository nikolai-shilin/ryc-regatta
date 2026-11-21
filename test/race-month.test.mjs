// Your month, day by day (release 6c of the 1-on-1 plan; app/[lang]/race/month): the month's points from the scores
// API's table, day by day, adding up to the total; the bars, the days with where and in what, the table around you and
// the points to the next place; another month, another sailor's; signed out, a way to sign in; down, said so; and in
// Russian. Run: node --test test/race-month.test.mjs
import { mock } from './load.mjs';
import { test, mock as clock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

clock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 21, 12) });
mock('lib/supabase/server.ts', 'export const supabaseServer = async () => globalThis.__supabase;');
const page = await import('../app/[lang]/race/month/page.tsx');
const { readPlayerMonth, ordinal } = await import('../lib/player-month.ts');
const { dailyRace } = await import('../lib/race.ts');
const { venueOf } = await import('../lib/venues.ts');
const { yachtOf } = await import('../lib/yachts.ts');

const KEY = 'Key_of-Fed123456', OTHER = 'Anna_key-0000000';
const session = (signed, token = 'tok') => { globalThis.__supabase = { auth: {
  getClaims: async () => ({ data: signed ? { claims: { sub: 'u1' } } : null }),
  getSession: async () => ({ data: { session: signed ? { access_token: token } : null } }),
} }; };
// the scores API: ?me → your key; ?month= → the month (month: m → answer, or a status)
let sent = [];
const api = ({ me = KEY, month = {} } = {}) => { sent = []; globalThis.fetch = async (u, o = {}) => {
  const url = String(u); sent.push({ url, o });
  if (url.endsWith('?me')) return me ? Response.json({ k: me }) : new Response(null, { status: 404 });
  const q = new URL(url).searchParams, a = month[q.get('month')];
  if (typeof a === 'number') return new Response('{}', { status: a });
  return Response.json(a ? { m: q.get('month'), k: q.get('k'), ...a } : { m: q.get('month'), k: q.get('k'), pts: 0, place: null, of: 0, wins: 0, podiums: 0, sailed: 0, days: [], near: [], above: null });
}; };
const NOV = {
  pts: 105, place: 7, of: 120, wins: 1, podiums: 1, sailed: 21,
  days: [{ d: '2026-11-21', s: 431.2, place: 12, of: 50, pts: 39 }, { d: '2026-11-03', s: 402.5, place: 5, of: 40, pts: 36 }, { d: '2026-11-10', s: 390, place: 1, of: 30, pts: 30 }],
  near: [{ k: 'a1', name: 'Bo Lind', fl: 'se', pts: 110, place: 6, me: false }, { k: KEY, name: 'Fed', fl: null, pts: 105, place: 7, me: true }, { k: 'a3', name: 'Cy', fl: null, pts: 99, place: 8, me: false }],
  above: { place: 6, pts: 110 },
};
const html = async ({ lang = 'en', q = {} } = {}) => renderToStaticMarkup(await page.default({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(q) }));

test('your month: asked with your own key, the total, your place, today\'s points and the days sailed', async () => {
  session(true); api({ month: { '2026-11': NOV } });
  const h = await html(), w = plain(h);
  assert.match(sent[0].url, /\?me$/); assert.equal(sent[0].o.headers.authorization, 'Bearer tok');
  assert.match(sent[1].url, new RegExp(`\\?month=2026-11&k=${KEY}$`));
  assert.match(w, /Your month · November 105 pts 7th of 120 in November \+39 today 3 of 21 days sailed/);
  assert.match(w, /Best day 1st of 30 Tue 10 Nov · .+ · 30 pts Wins 1 Podiums 1/);
});

test('the days add up: each with its venue, yacht, time and place, the points under it the total', async () => {
  session(true); api({ month: { '2026-11': NOV } });
  const h = await html(), w = plain(h);
  const body = h.slice(h.indexOf('<tbody>'), h.indexOf('</tbody>')), foot = h.slice(h.indexOf('<tfoot>'), h.indexOf('</tfoot>'));
  const pts = [...body.matchAll(/<td class="n">(\d+)<\/td>/g)].map((x) => +x[1]);
  assert.deepEqual(pts, [36, 30, 39], 'the earliest first');
  assert.equal(pts.reduce((a, b) => a + b, 0), 105);
  assert.match(plain(foot), /November so far 105/);
  const d = dailyRace(new Date('2026-11-03T12:00:00Z'));
  assert.ok(w.includes(`Tue 3 Nov ${venueOf(d.venue).name[0]} ${yachtOf(d.yacht).name[0]} 6:42.5 5th of 40 40 ranked − 5 + 1 36`), w.slice(w.indexOf('Tue 3 Nov'), w.indexOf('Tue 3 Nov') + 120));
  assert.match(body, /<tr class="win">/);
});

test('a bar a day of the month: the days sailed, a podium gold, today ringed, the days to come empty', async () => {
  session(true); api({ month: { '2026-11': NOV } });
  const h = await html(), bars = [...h.matchAll(/<li class="rm-bar([^"]*)"/g)].map((x) => x[1]);
  assert.equal(bars.length, 30);
  assert.equal(bars.filter((c) => c.includes('has')).length, 3);
  assert.deepEqual(bars.map((c, i) => (c.includes('pod') ? i + 1 : 0)).filter(Boolean), [10]);
  assert.deepEqual(bars.map((c, i) => (c.includes(' on') ? i + 1 : 0)).filter(Boolean), [21]);
  assert.equal(bars.filter((c) => c.includes('later')).length, 9);
  assert.match(h, /style="--h:1\.000"/, 'the best day the tallest');
  assert.match(plain(h), /Tue 10 Nov: 1st of 30, 30 pts/, 'each day said for a screen reader');
});

test('the table around you, yours marked, and the points to the next place up', async () => {
  session(true); api({ month: { '2026-11': NOV } });
  const h = await html(), w = plain(h);
  assert.match(w, /The month, near you 6 Bo Lind 110 pts 7 Fed 105 pts 8 Cy 99 pts The whole month/);
  assert.match(h, /<li class="me" aria-current="true">/);
  const t = dailyRace(new Date('2026-11-22T12:00:00Z'));
  assert.match(w, /To 6th: 6 pts Every sailor you finish ahead of today is a point/);
  assert.ok(w.includes(`Sail today’s race Tomorrow: ${venueOf(t.venue).name[0]} · ${yachtOf(t.yacht).name[0]}`));
});

test('another month: its own, in all, the months either side; another sailor\'s by their key, without asking whose you are', async () => {
  session(true); api({ month: { '2026-10': { ...NOV, days: [{ d: '2026-10-30', s: 400, place: 2, of: 10, pts: 9 }], pts: 9, sailed: 31 } } });
  let h = await html({ q: { m: '2026-10' } }), w = plain(h);
  assert.match(sent[1].url, /month=2026-10/);
  assert.match(w, /Your month · October 9 pts/); assert.match(w, /October in all 9/);
  assert.match(h, /href="\/race\/month\?m=2026-09" class="rb-link" rel="prev">‹ September/); assert.match(h, /href="\/race\/month" class="rb-link" rel="next">November ›/);
  assert.doesNotMatch(w, /Sail today’s race Tomorrow/, 'what\'s next is for this month');
  api({ month: { '2026-11': { ...NOV, near: NOV.near.map((x) => ({ ...x, me: x.k === OTHER })).concat([{ k: OTHER, name: 'Anna Petrova', fl: 'it', pts: 1, place: 9, me: true }]) } } });
  h = await html({ q: { p: OTHER } }); w = plain(h);
  assert.ok(!sent.some((x) => x.url.endsWith('?me')), 'no session asked for');
  assert.match(sent[0].url, new RegExp(`k=${OTHER}$`));
  assert.match(w, /Anna Petrova · November/); assert.match(w, /Every day sailed/);
  assert.match(h, /href="\/race\/month\?p=Anna_key-0000000&amp;m=2026-10" class="rb-link" rel="prev"/);
  // a month to come, not a month, or too far back: this one; a key not shaped as one: your own
  for (const m of ['2026-12', '2026-13', '2024-01', 'x']) { api({ month: { '2026-11': NOV } }); await html({ q: { m } }); assert.match(sent.at(-1).url, /month=2026-11&/, m); }
  api({ month: { '2026-11': NOV } }); await html({ q: { p: '../x' } }); assert.match(sent.at(-1).url, new RegExp(`k=${KEY}$`));
});

test('signed out: the device\'s month and a way to sign in; never raced: no points yet; the scores server down: said so', async () => {
  session(false); api();
  let w = plain(await html());
  assert.equal(sent.length, 0);
  assert.match(w, /Points are kept for sailors who are signed in\. Sign in, and every day you finish today’s race adds up here/);
  assert.match(await html(), /href="\/sign-in\?next=%2Frace%2Fmonth"/);
  session(true); api({ me: null });
  w = plain(await html());
  assert.match(w, /Your month · November 0 pts 0 of 21 days sailed/); assert.match(w, /No points this month yet\./);
  session(true); api({ month: { '2026-11': 500 } });
  assert.match(plain(await html()), /Your month can’t be loaded right now\./);
});

test('the answer is checked: another month\'s or sailor\'s is none, a malformed day is left out', () => {
  assert.equal(readPlayerMonth({ ...NOV, m: '2026-10', k: KEY }, '2026-11', KEY), null);
  assert.equal(readPlayerMonth({ ...NOV, m: '2026-11', k: OTHER }, '2026-11', KEY), null);
  const r = readPlayerMonth({ ...NOV, m: '2026-11', k: KEY, days: [...NOV.days, { d: '2026-10-01', s: 1, place: 1, of: 1, pts: 1 }, { d: '2026-11-04', s: 0, place: 1, of: 1, pts: 1 }, { d: '2026-11-05', s: 300, place: 0, of: 1, pts: 1 }] }, '2026-11', KEY);
  assert.deepEqual(r.days.map((x) => x.d), ['2026-11-03', '2026-11-10', '2026-11-21']);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => ordinal(n, 'en')).join(' '), '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th');
});

test('not for search, linked from the leaderboard\'s month', async () => {
  const m = await page.generateMetadata({ params: Promise.resolve({ lang: 'en' }) });
  assert.equal(m.title, 'Your month, day by day'); assert.equal(m.robots?.index, false);
  assert.match(readFileSync(new URL('../components/race-board.tsx', import.meta.url), 'utf8'), /href="\/race\/month"/);
});

test('in Russian', async () => {
  session(true); api({ month: { '2026-11': NOV } });
  const w = plain(await html({ lang: 'ru' }));
  assert.match(w, /Твой месяц · Ноябрь 105 очков 7-е из 120 в месяце \+39 сегодня 3 из 21 дня в гонке/);
  assert.match(w, /Ноябрь на сегодня 105/);
  assert.match(w, /До 6-го места: 6 очков/);
});
