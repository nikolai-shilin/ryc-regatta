// Find a race's own page, mounted (components/duel-finder.tsx DuelFinder): Ready now read as the page opens and every 10 s,
// Race beside a sailor challenging them (POST /connect/seek challenge with the wishes), a sailor gone said and the list read
// again, a challenge answered by Match found, and the wishes kept on this device and sent with each ask.
// Run: node --test test/duel-finder.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { click, dom, done, fire, h, json, mount, reset, serve, tick } from './fake-dom.mjs';

const { DuelFinder } = await import('../components/duel-finder.tsx');
const SETTINGS = { venue: 'phuket', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
const PAIR = { id: '0b8f1c2e-1111-4222-8333-944455556666', code: 'K7M2QZ', role: 'guest', settings: SETTINGS, them: { name: 'Cara M.', rating: 1900, races: 12 }, me: { rating: 1500, races: 8, ok: null }, them_ok: null, left: 10, minutes: 6 };
const LIST = [{ handle: '3f9a0c1d2e4b', name: 'Cara M.', rating: 1900, races: 12, waited: 23 }];
let answer = {};
const asks = () => dom.fetches.filter((f) => f.url === '/connect/seek').map((f) => JSON.parse(f.init.body));
beforeEach(() => {
  reset({ url: 'https://updown.test/duel' });
  answer = { ready_now: { list: LIST }, challenge: { status: 'none', reason: 'gone' }, seek: { status: 'looking', waited: 0, band: 100, online: 1, near: 0 } };
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })]]);
});
afterEach(done);
const race = (v) => v.$$('.df-race')[0];

test('Ready now is read as the page opens and every 10 s after, each sailor with Race', async () => {
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  assert.match(v.text(), /Ready now Cara M\. National 1900 waiting 0:23 Race/);
  assert.equal(asks().filter((a) => a.do === 'ready_now').length, 1);
  await tick(10000);
  assert.equal(asks().filter((a) => a.do === 'ready_now').length, 2);
  await v.unmount();
});

test('Race on a sailor who has gone says so, reads the list again and leaves the page ready to look', async () => {
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  answer.ready_now = { list: [] };
  await click(race(v));
  assert.deepEqual(asks().find((a) => a.do === 'challenge'), { do: 'challenge', handle: '3f9a0c1d2e4b', wishes: {} });
  assert.match(v.text(), /That sailor has just gone.* Find a race .* Nobody else is looking right now/);
  assert.equal(asks().filter((a) => a.do === 'ready_now').length, 2);
  await v.unmount();
});

test('Race answered by a match: Match found with the sailor challenged, and the list gone from over it', async () => {
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  answer.challenge = { status: 'found', pair: PAIR }; answer.seek = { status: 'found', pair: PAIR };
  await click(race(v));
  assert.match(v.text(), /Match found Cara M\. National 1900 about 6 min/);
  assert.doesNotMatch(v.text(), /Ready now/);
  await v.unmount();
});

test('the wishes are kept on this device and sent with Find a race and with a challenge', async () => {
  localStorage.setItem('regatta-duel-wishes', JSON.stringify({ venue: 'cowes', yacht: 'titanic' }));
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  const yacht = v.$$('.df-sel select')[1];
  yacht.value = 'dragon'; await fire(yacht, 'change');
  assert.deepEqual(JSON.parse(localStorage.getItem('regatta-duel-wishes')), { venue: 'cowes', yacht: 'dragon' });
  await click(v.$('.bt-go'));
  assert.deepEqual(asks().find((a) => a.do === 'seek').wishes, { venue: 'cowes', yacht: 'dragon' });
  await click(race(v));
  assert.deepEqual(asks().find((a) => a.do === 'challenge').wishes, { venue: 'cowes', yacht: 'dragon' });
  await v.unmount();
});

test('signed out, nothing is asked', async () => {
  const v = await mount(h(DuelFinder, { lang: 'en', signed: false }));
  await tick(10000);
  assert.deepEqual(asks(), []);
  await v.unmount();
});

test('a match found starts loading the race at once, and the card says how far, then that it opens at once', async () => {
  const play = `<script type="importmap">{"imports":{"three":"/vendor/three.js"}}</script><link rel="modulepreload" href="/game/main.js">`;
  let hold = null;
  const gate = new Promise((r) => { hold = r; });
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })], ['/play', { text: async () => play }],
    [/\/game\/|\/vendor\//, async (u) => { if (u.endsWith('main.js')) await gate; return json(null); }]]);
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  answer.challenge = { status: 'found', pair: PAIR }; answer.seek = { status: 'found', pair: PAIR };
  await click(race(v));
  assert.match(v.text(), /Match found .* Loading Phuket · 86%/);
  assert.deepEqual(dom.fetches.map((f) => f.url).filter((u) => !u.startsWith('/connect/')), ['/play', '/game/venues/phuket.json', '/game/venues/phuket.bin', '/game/j70.glb', '/game/yacht.glb', '/game/committee.glb', '/vendor/three.js', '/game/main.js']);
  hold(); await tick(0);
  assert.match(v.text(), /Phuket is loaded: the race opens at once/);
  await v.unmount();
});

test('Post an open call while looking: the call\'s link to send, and a match through it is Match found as ever', async () => {
  answer.call = { status: 'open', code: 'K7M2QZ', lo: 1458, hi: 1658, left: 3600 };
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  const postBtn = v.$$('.df-call button').find((b) => b.textContent === 'Post an open call');
  await click(postBtn);
  assert.deepEqual(asks().find((a) => a.do === 'call'), { do: 'call', wishes: {} });
  assert.match(v.text(), /Your open call For ratings 1458–1658/);
  assert.equal(v.$('.df-url').value, 'https://updown.test/call/K7M2QZ');
  answer.seek = { status: 'found', pair: PAIR };
  await tick(3000);
  assert.match(v.text(), /Match found Cara M\./);
  assert.doesNotMatch(v.text(), /Your open call/);
  await v.unmount();
});

test('/duel?take= takes that call once, and the address loses it; a call taken already says so', async () => {
  reset({ url: 'https://updown.test/duel?take=k7m2qz' });
  answer.take = { status: 'none', reason: 'taken' };
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })]]);
  let v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  assert.deepEqual(asks().filter((a) => a.do === 'take'), [{ do: 'take', code: 'K7M2QZ', wishes: {} }]);
  assert.equal(location.search, '');
  assert.match(v.text(), /That call has been taken: someone else got there first\. .*Find a race/);
  await v.unmount();
  reset({ url: 'https://updown.test/duel?take=K7M2QZ' });
  answer.take = { status: 'found', pair: PAIR };
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })], ['/play', { text: async () => '' }], [/\/game\//, json(null)]]);
  v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  assert.match(v.text(), /Match found Cara M\./);
  await v.unmount();
});

test('/duel?resume, as a Match found message opens it: looking again at once, and the address loses it', async () => {
  reset({ url: 'https://updown.test/duel?resume' });
  answer.seek = { status: 'found', pair: { ...PAIR, left: 40, ttl: 60 } };
  serve([['/connect/seek', (u, init) => json(answer[JSON.parse(init.body).do] ?? { status: 'none', reason: null })], ['/play', { text: async () => '' }], [/\/game\//, json(null)]]);
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  assert.ok(asks().some((a) => a.do === 'seek'));
  assert.equal(location.search, '');
  assert.match(v.text(), /Match found Cara M\./);
  await v.unmount();
});

const keepLooking = (v) => click(v.$$('.df-away button').find((b) => b.textContent === 'Keep looking if I leave'));

test('Keep looking if I leave: the site asked first; with nothing to reach this sailor and a browser that can\'t take messages, says so', async () => {
  answer.away = { status: 'none', reason: 'no_push' };
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  await keepLooking(v);
  assert.deepEqual(asks().filter((a) => a.do === 'away'), [{ do: 'away', on: true }]);
  assert.match(v.text(), /This browser can’t take the site’s messages/);
  await v.unmount();
});

test('Keep looking if I leave, when a device or the bot already reaches this sailor: on at once, this browser not asked', async () => {
  answer.away = { status: 'away', left: 1800 };
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  await keepLooking(v);
  assert.match(v.text(), /Looking for you while you’re away You can leave this page\. We’ll message you/);
  await v.unmount();
});

test('Keep looking if I leave, inside Telegram: the bot\'s leave to write asked, then the site again; declined, said why', async () => {
  let n = 0, allow = true;
  globalThis.Telegram = { WebApp: { initData: 'query_id=1', requestWriteAccess: (cb) => cb(allow) } };
  answer.away = () => (++n === 1 ? { status: 'none', reason: 'no_push' } : { status: 'away', left: 1800 });
  serve([['/connect/seek', (u, init) => { const d = JSON.parse(init.body).do, a = answer[d]; return json(typeof a === 'function' ? a() : a ?? { status: 'none', reason: null }); }]]);
  let v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  await keepLooking(v);
  await tick(1600);
  assert.equal(asks().filter((a) => a.do === 'away').length, 2);
  assert.match(v.text(), /Looking for you while you’re away/);
  await v.unmount();
  n = 0; allow = false;
  v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  await keepLooking(v);
  assert.match(v.text(), /Without the bot’s messages we can’t reach you while you’re away/);
  await v.unmount();
  globalThis.Telegram = undefined;
});

test('looking, as the database says a sailor is looked for while away: the page says so', async () => {
  answer.seek = { status: 'looking', waited: 40, band: 200, online: 2, near: 1, away: true };
  const v = await mount(h(DuelFinder, { lang: 'en', signed: true }));
  await click(v.$('.bt-go'));
  assert.match(v.text(), /Looking for you while you’re away/);
  await v.unmount();
});
