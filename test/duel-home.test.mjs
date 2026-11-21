// The 1-on-1 block on a returning sailor's home (components/duel-home.tsx): only for a sailor who has raced on this device
// (<html data-back>) and is signed in; how many are ready now, Find a race and a friend's link, the rating strip (rating
// and level, the last rated race, the next level, record and place; or not rated yet), the three nearest with chance,
// stakes and Race to /duel?challenge=…; and /duel challenging the sailor its address names, once.
// Run: node --test test/duel-home.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { click, dom, done, h, json, mount, plain, reset, serve, signIn, ssr, tick } from './fake-dom.mjs';

const { DuelHome, DuelHomeView } = await import('../components/duel-home.tsx');
const { DuelFinder } = await import('../components/duel-finder.tsx');
const { parseMine } = await import('../lib/duel-rating.ts');
const { parseReady } = await import('../lib/duel-seek.ts');

const MINE = { rating: 1558, races: 41, wins: 24, losses: 17, best: 1601, lowest: 1480, place: 198, of: 1240, recent: [],
  changes: [{ at: '2026-11-21T10:00:00Z', won: true, before: 1540, after: 1558, delta: 18, them: 'Anna K.', them_before: 1585, venue: 'phuket', yacht: 'j70', margin: 1.8 }] };
const LIST = [
  { handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1570, races: 30, waited: 12 },
  { handle: 'a1b2c3d4e5f6', name: 'Lina S.', rating: 1508, races: 2, waited: 4 },
  { handle: 'b1b2c3d4e5f6', name: 'Max H.', rating: 1640, races: 61, waited: 40 },
  { handle: 'c1b2c3d4e5f6', name: 'Ola N.', rating: 1420, races: 9, waited: 70 },
];
const view = (o = {}) => plain(ssr(h(DuelHomeView, { lang: 'en', mine: parseMine(MINE), list: parseReady(LIST), ...o })));

test('the block: how many ready, the pitch, Find a race and a friend, the rating strip', () => {
  const s = view();
  assert.match(s, /1-on-1 race · 4 ready now Race someone your level One other sailor, live, on the same course\./);
  assert.match(s, /Find a race Challenge a friend Your rating 1558 Fleet Last rated race \+18 beat Anna K\. To Regional 42 Record · place 24–17 #198 of 1,240/);
});

test('the three nearest, each with the chance, the stakes and Race to /duel challenging them; the rest on the 1-on-1 page', () => {
  const html = ssr(h(DuelHomeView, { lang: 'en', mine: parseMine(MINE), list: parseReady(LIST) }));
  assert.match(plain(html), /Ready now Nearest your rating Cara M\. Fleet 1570 chance 48% \+17 −15 Race Lina S\. New ~1508 chance 57% \+14 −18 Race Max H\. Regional 1640 chance 38% \+20 −12 Race All 4 on the 1-on-1 page/);
  assert.doesNotMatch(plain(html), /Ola N\./);
  assert.match(html, /href="\/duel\?challenge=3f9a0c1d2e4b"/);
  assert.match(view({ list: parseReady(LIST.slice(0, 2)) }), /Race The 1-on-1 page$/);
});

test('nobody looking, and a sailor not rated yet; in Russian', () => {
  const s = view({ list: [], mine: parseMine({ ...MINE, rating: 1500, races: 0, wins: 0, losses: 0, place: null, changes: [] }) });
  assert.match(s, /^1-on-1 race Race someone/);
  assert.match(s, /Your rating ~1500 New Not rated yet Everyone starts at 1500; your first five races find your level\./);
  assert.match(s, /Nobody is looking right now\./);
  assert.match(view({ lang: 'ru' }), /Гонка 1 на 1 · готовы сейчас: 4 .* Найти гонку .* Твой рейтинг 1558/);
});

let answer;
beforeEach(() => {
  reset({ url: 'https://updown.test/' });
  answer = { ready_now: { list: LIST }, challenge: { status: 'none', reason: 'gone' } };
  serve([['/connect/rating/me', json(MINE)], ['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })]]);
});
afterEach(done);

test('on the home, only for a sailor who has raced here and is signed in; read again every 15 s', async () => {
  let v = await mount(h(DuelHome, { lang: 'en' }));
  assert.equal(v.text(), '', 'a newcomer, signed out');
  await v.unmount();
  document.documentElement.setAttribute('data-back', '');
  v = await mount(h(DuelHome, { lang: 'en' }));
  assert.equal(v.text(), '', 'raced here, signed out');
  assert.equal(dom.fetches.length, 0);
  await v.unmount();
  signIn();
  v = await mount(h(DuelHome, { lang: 'en' }));
  assert.match(v.text(), /4 ready now .* Your rating 1558 Fleet .* Cara M\./);
  const reads = () => dom.fetches.filter((f) => f.url === '/connect/seek').length;
  assert.equal(reads(), 1);
  await tick(15000);
  assert.equal(reads(), 2);
  await v.unmount();
  document.documentElement.removeAttribute('data-back');
});

test('/duel?challenge= challenges that sailor once, and the address loses it', async () => {
  reset({ url: 'https://updown.test/duel?challenge=3f9a0c1d2e4b' });
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })]]);
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  const asks = dom.fetches.filter((f) => f.url === '/connect/seek').map((f) => JSON.parse(f.init.body));
  assert.deepEqual(asks.filter((a) => a.do === 'challenge'), [{ do: 'challenge', handle: '3f9a0c1d2e4b', wishes: {} }]);
  assert.equal(location.search, '');
  assert.match(v.text(), /That sailor has just gone/);
  await v.unmount();
});

test('/duel with a bad handle, or signed out, challenges nobody', async () => {
  for (const [url, signed] of [['https://updown.test/duel?challenge=nope', true], ['https://updown.test/duel?challenge=3f9a0c1d2e4b', false]]) {
    reset({ url });
    serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })]]);
    const v = await mount(h(DuelFinder, { lang: 'en', signed }));
    assert.equal(dom.fetches.filter((f) => f.url === '/connect/seek' && JSON.parse(f.init.body).do === 'challenge').length, 0, url);
    await v.unmount();
  }
});
