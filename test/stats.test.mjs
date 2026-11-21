// What the game tells the server about a race (public/game/stats.js), on a small stand-in for the page: the posts of a
// race's start, finish, result, frames, end and the visit, who the player is, and when nothing may be posted at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';

const API = 'https://iyt.rycrentals.com/api/game';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const NOW = 1_800_000_000_000;
const realCrypto = globalThis.crypto;
const def = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

const clock = { date: NOW, perf: 0 };
Date.now = () => clock.date;
def('performance', { now: () => clock.perf });

const target = () => {
  const on = {};
  return { addEventListener: (k, fn) => { (on[k] ||= []).push(fn); }, fire: (k, e = {}) => { for (const fn of on[k] || []) fn(e); } };
};
const signedOut = () => ({ status: 401, json: async () => null });
const signedIn = (token = 'T1', life = 3600) => () => ({ status: 200, json: async () => ({ token, expires: clock.date / 1000 + life }) });

let loads = 0;
// a page opened at this address, with stats.js freshly loaded on it
async function open({ host = 'sail.example', protocol = 'https:', search = '', tg = '', ua = DESKTOP, stored = {}, auth = signedOut, yacht = 'jpk1050', visitId = null,
  coarse = false, size = [1920, 1080], touch = 0, dpr = 2, cores = 8, memory = 16, elements = false, brokenStorage = false, api = 'ok', crypto = realCrypto } = {}) {
  clock.date = NOW; clock.perf = 0;
  const page = { posts: [], asks: [], raw: [], auth, api, win: target(), doc: target(), gl: target(), how: target() };
  const data = new Map(Object.entries(stored));
  page.data = data;
  def('location', { hostname: host, protocol, search, pathname: '/play' });
  def('window', { ...(tg && { Telegram: { WebApp: { initData: tg } } }), ...(visitId && { rycVisit: { id: visitId } }) });
  def('localStorage', brokenStorage
    ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
    : { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); } });
  def('navigator', { userAgent: ua, maxTouchPoints: touch, hardwareConcurrency: cores, deviceMemory: memory });
  def('matchMedia', () => ({ matches: coarse }));
  def('screen', { width: size[0], height: size[1] });
  def('devicePixelRatio', dpr);
  def('crypto', crypto);
  def('addEventListener', page.win.addEventListener);
  page.document = { hidden: false, addEventListener: page.doc.addEventListener, querySelector: (s) => (elements ? { '#gl': page.gl, '#howD': page.how }[s] ?? null : null) };
  def('document', page.document);
  def('fetch', (url, o = {}) => {
    if (url === '/auth/token') { page.asks.push(o); return Promise.resolve().then(() => page.auth()); }
    assert.equal(url, API);
    page.raw.push(o);
    if (page.api === 'throw') throw new Error('no network');
    page.posts.push(JSON.parse(o.body));
    return page.api === 'reject' ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true });
  });
  mock('public/game/classes.js', `export const CLS = { id: '${yacht}' };`);
  mock('public/game/venues.js', "export const VENUE = { id: 'palma' };");
  page.stats = await import(`../public/game/stats.js?case=${++loads}`);
  page.of = (ev) => page.posts.filter((p) => p.ev === ev);
  await flush();
  return page;
}

function aRace(o = {}) {
  const other = { name: 'rival' }, player = { leg: 2, pens: 1, place: 3, finish: 612.4, done: false, ...o.player };
  return { player, boats: [other, player], course: { type: 'wl', legs: ['start', 'mark', 'gate', 'finish'] }, clock: 301.6, standings: () => [other, player], ...o.race };
}
const OPTS = { preset: 'medium', laps: 2, length: 'short' };
async function started(page, o) { const r = aRace(o); page.stats.raceStarted(r, OPTS); await flush(); return r; }
// frames enough to be worth posting: 1200 at 60 Hz, 98 at 25 Hz and two stalls of 200 ms
function sail(stats, race, q = 2, gfx = 'high', saver = false) {
  for (let i = 0; i < 1200; i++) stats.perfFrame(race, 1 / 60, q, gfx, saver);
  for (let i = 0; i < 98; i++) stats.perfFrame(race, 0.04, q, gfx, saver);
  for (let i = 0; i < 2; i++) stats.perfFrame(race, 0.2, q, gfx, saver);
}

// ---------- the start ----------
test("a race's start is posted once, as a simple request, with the course it was sailed on", async () => {
  const page = await open();
  const race = await started(page);
  const [s] = page.of('start');
  assert.equal(page.of('start').length, 1);
  assert.match(s.id, /^[0-9a-f-]{36}$/);
  assert.equal(s.id, race._rid);
  assert.deepEqual({ wind: s.wind, laps: s.laps, length: s.length, shape: s.shape, boats: s.boats, venue: s.venue }, { wind: 'medium', laps: 2, length: 'short', shape: 'wl', boats: 2, venue: 'palma' });
  assert.equal(s.initData, '');
  assert.equal(page.raw[0].method, 'POST');
  assert.equal(page.raw[0].keepalive, true);
  assert.equal(page.raw[0].headers, undefined, 'no headers of its own: no preflight');
  page.stats.raceStarted(race, OPTS);
  await flush();
  assert.equal(page.of('start').length, 1, 'the same race again says nothing');
});

test('no race, nothing is posted', async () => {
  const page = await open();
  page.stats.raceStarted(null, OPTS);
  page.stats.raceFinished(null);
  page.stats.raceResult(null, {});
  page.stats.raceEnded(null, 'menu');
  page.stats.raceIncident(null, 'ocs');
  page.stats.perfFrame(null, 0.016, 2, 'high', false);
  await flush();
  assert.deepEqual(page.posts, []);
});

test("today's race names its day, and the JPK 1050 is the only yacht that goes unnamed", async () => {
  const jpk = await open();
  const a = aRace();
  jpk.stats.raceStarted(a, { ...OPTS, daily: '2026-11-18' });
  await flush();
  assert.equal(jpk.of('start')[0].daily, '2026-11-18');
  assert.equal('yacht' in jpk.of('start')[0], false);

  const j70 = await open({ yacht: 'j70' });
  await started(j70);
  assert.equal(j70.of('start')[0].yacht, 'j70');
  assert.equal('daily' in j70.of('start')[0], false);
});

for (const [saved, flag] of [['{"flag":"gr"}', 'gr'], ['{"flag":"GRC"}', undefined], ['{"flag":7}', undefined], ['{not json', undefined], [undefined, undefined]]) {
  test(`the flag you fly goes with the start only when it is two small letters: ${saved}`, async () => {
    const page = await open({ stored: saved ? { 'regatta-boat': saved } : {} });
    await started(page);
    assert.equal(page.of('start')[0].flag, flag);
  });
}

// ---------- who the player is ----------
test('signed in: the start and the finish carry the token, and what names nobody does not', async () => {
  const page = await open({ auth: signedIn('TOKEN') });
  assert.deepEqual(page.asks, [{ credentials: 'same-origin', cache: 'no-store' }]);
  const race = await started(page);
  page.stats.raceResult(race, { boats: [] });
  page.stats.raceFinished(race);
  page.stats.visitSend('left');
  await flush();
  assert.equal(page.of('start')[0].token, 'TOKEN');
  assert.equal(page.of('finish')[0].token, 'TOKEN');
  for (const ev of ['result', 'end', 'visit']) assert.equal('token' in page.of(ev)[0], false, ev);
});

test('the start waits for a token still on its way', async () => {
  let answer;
  const page = await open({ auth: () => new Promise((r) => { answer = r; }) });
  page.stats.raceStarted(aRace(), OPTS);
  await flush();
  assert.equal(page.of('start').length, 0);
  assert.equal(page.asks.length, 1, 'the question already asked is not asked twice');
  answer(signedIn('LATE')());
  await flush();
  assert.equal(page.of('start')[0].token, 'LATE');
});

test('a token with time left is used as it is; one about to run out is asked for again', async () => {
  const page = await open({ auth: signedIn('OLD', 600) });
  await started(page);
  assert.equal(page.asks.length, 1);
  assert.equal(page.of('start')[0].token, 'OLD');
  clock.date += 481e3; // 119 s left
  page.auth = signedIn('NEW', 3600);
  await started(page);
  assert.equal(page.asks.length, 2);
  assert.equal(page.of('start')[1].token, 'NEW');
});

test('signed out, the player is a guest and the site is asked again only after five minutes', async () => {
  const page = await open();
  await started(page);
  assert.equal('token' in page.of('start')[0], false);
  clock.date += 299e3;
  await started(page);
  assert.equal(page.asks.length, 1);
  clock.date += 2e3;
  page.auth = signedIn('BACK');
  await started(page);
  assert.equal(page.asks.length, 2);
  assert.equal(page.of('start')[2].token, 'BACK');
});

test('a token route that fails leaves a guest, and is tried again at the next race', async () => {
  const page = await open({ auth: () => Promise.reject(new Error('down')) });
  await started(page);
  assert.equal('token' in page.of('start')[0], false);
  await started(page);
  assert.equal(page.asks.length, 3, 'on load, and once for each race');
});

test('an answer of 200 with no token is a guest', async () => {
  const page = await open({ auth: () => ({ status: 200, json: async () => ({}) }) });
  await started(page);
  assert.equal('token' in page.of('start')[0], false);
});

test('inside Telegram the launch data names the player and the site is never asked', async () => {
  const page = await open({ tg: 'query_id=1&user=2' });
  await started(page);
  assert.equal(page.asks.length, 0);
  assert.equal(page.of('start')[0].initData, 'query_id=1&user=2');
});

test('a page opened from a file never asks for a token', async () => {
  const page = await open({ protocol: 'file:' });
  await started(page);
  assert.equal(page.asks.length, 0);
  assert.equal(page.of('start').length, 1);
});

// ---------- when nothing is posted ----------
for (const host of ['localhost', '127.0.0.1', '[::1]', 'game.localhost']) {
  test(`the game run locally at ${host} keeps its races to itself`, async () => {
    const page = await open({ host });
    const race = await started(page);
    page.stats.raceFinished(race);
    page.stats.visitSend('left');
    await flush();
    assert.deepEqual(page.posts, []);
    assert.ok(race._rid, 'the race itself still goes on as usual');
  });
}

for (const search of ['?scores', '?race=free&scores=1']) {
  test(`run locally with ${search} in the address, it posts all the same`, async () => {
    const page = await open({ host: 'localhost', search });
    await started(page);
    assert.equal(page.of('start').length, 1);
  });
}

test('?scoresheet in a local address is not ?scores, and a site merely named localhost is not local', async () => {
  const sheet = await open({ host: 'localhost', search: '?scoresheet' });
  await started(sheet);
  assert.equal(sheet.of('start').length, 0);
  const other = await open({ host: 'localhost.example.com' });
  await started(other);
  assert.equal(other.of('start').length, 1);
});

test('a race shared by two posts nothing, from its start to its end', async () => {
  const page = await open();
  const fresh = aRace({ race: { multi: true } });
  page.stats.raceStarted(fresh, OPTS);
  await flush();
  assert.equal(fresh._rid, undefined);
  const race = aRace({ race: { multi: true, _rid: 'an-id' } });
  page.stats.perfFrame(race, 1 / 60, 2, 'high', false);
  page.stats.raceFinished(race);
  page.stats.raceResult(race, { boats: [] });
  page.stats.raceEnded(race, 'menu');
  await flush();
  assert.deepEqual(page.posts, []);
  assert.equal(race._sent, undefined);
  assert.equal(race._ended, undefined);
});

for (const api of ['throw', 'reject']) {
  test(`a post that fails (${api}) is ignored and the race goes on`, async () => {
    const page = await open({ api });
    const race = await started(page);
    assert.doesNotThrow(() => page.stats.raceFinished(race));
    await flush();
    assert.equal(race._sent, true);
  });
}

// ---------- the finish and the result ----------
test('the finish is posted once, with the place and the time', async () => {
  const page = await open();
  const race = await started(page, { player: { place: 2, finish: 500.5, done: true } });
  page.stats.raceFinished(race);
  page.stats.raceFinished(race);
  await flush();
  assert.equal(page.of('finish').length, 1);
  const f = page.of('finish')[0];
  assert.deepEqual({ id: f.id, place: f.place, boats: f.boats, secs: f.secs, dsq: f.dsq }, { id: race._rid, place: 2, boats: 2, secs: 500.5, dsq: false });
  assert.equal(page.of('end')[0].end.how, 'finish');
});

test('a disqualified boat finishes with no place', async () => {
  const page = await open();
  const race = await started(page, { player: { place: 2, dsq: true } });
  page.stats.raceFinished(race);
  await flush();
  assert.equal(page.of('finish')[0].place, null);
  assert.equal(page.of('finish')[0].dsq, true);
});

test('a race that was never started has no finish to post', async () => {
  const page = await open();
  page.stats.raceFinished(aRace());
  page.stats.raceResult(aRace(), { boats: [] });
  await flush();
  assert.deepEqual(page.posts, []);
});

test("the result page's record is posted for the race, unless there is none", async () => {
  const page = await open();
  const race = await started(page);
  page.stats.raceResult(race, null);
  assert.equal(page.of('result').length, 0);
  page.stats.raceResult(race, { boats: [1, 2] });
  await flush();
  assert.deepEqual(page.of('result')[0].result, { boats: [1, 2] });
  assert.equal(page.of('result')[0].id, race._rid);
});

test('a record too big for a keepalive post stays on this device', async () => {
  const page = await open();
  const race = await started(page);
  page.stats.raceResult(race, { blob: 'x'.repeat(60000) });
  await flush();
  assert.equal(page.of('result').length, 0);
  page.stats.raceResult(race, { blob: 'x'.repeat(59000) });
  await flush();
  assert.equal(page.of('result').length, 1);
});

// ---------- how the game ran ----------
test('a race sailed long enough posts how it ran, once, at its finish', async () => {
  const page = await open();
  const race = await started(page);
  clock.perf = 3400;
  page.stats.perfSetup({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', size: () => [1280, 720] });
  sail(page.stats, race);
  page.stats.raceFinished(race);
  page.stats.raceFinished(race);
  await flush();
  assert.equal(page.of('perf').length, 1);
  const { id, perf } = page.of('perf')[0];
  assert.equal(id, race._rid);
  assert.equal(perf.fps, 58.8, 'the middle frame: 16 to 18 ms');
  assert.equal(perf.low, 24.4, 'the slow end: 40 to 42 ms');
  assert.equal(perf.stall, 4.93, 'two stalls in 24.32 s, a minute');
  assert.equal(perf.secs, 24);
  assert.deepEqual([perf.gpu, perf.w, perf.h], ['Apple M2', 1280, 720]);
  assert.equal(perf.load, 3.4, "the page's first race says how long it took to get there");
  assert.equal('token' in page.of('perf')[0], false);
});

test('the level at the start and the end are kept apart, and the battery saver once on stays on', async () => {
  const page = await open();
  const race = await started(page);
  page.stats.perfFrame(race, 1 / 60, 3, 'ultra', false);
  page.stats.perfFrame(race, 1 / 60, 3, 'ultra', true);
  sail(page.stats, race, 1, 'low', false);
  page.stats.raceFinished(race);
  await flush();
  const { perf } = page.of('perf')[0];
  assert.deepEqual([perf.q0, perf.q, perf.gfx, perf.saver], [3, 1, 'low', 1]);
});

test('a race left within 20 s, or in under 200 frames, tells nothing', async () => {
  const page = await open();
  const short = await started(page);
  for (let i = 0; i < 1000; i++) page.stats.perfFrame(short, 1 / 60, 2, 'high', false); // 16.7 s
  page.stats.raceFinished(short);
  const few = await started(page);
  for (let i = 0; i < 100; i++) page.stats.perfFrame(few, 0.25, 2, 'high', false); // 25 s of 100 frames
  page.stats.raceFinished(few);
  await flush();
  assert.equal(page.of('perf').length, 0);
});

test('a frame of no length, or of a second and more (the tab was away), is not counted', async () => {
  const page = await open();
  const race = await started(page);
  sail(page.stats, race);
  for (const raw of [0, -1, 1.01, NaN]) for (let i = 0; i < 50; i++) page.stats.perfFrame(race, raw, 2, 'high', false);
  page.stats.raceFinished(race);
  await flush();
  assert.equal(page.of('perf')[0].perf.secs, 24);
});

test('the next race posts how the last one ran, and only the first says how long the page took to load', async () => {
  const page = await open();
  clock.perf = 5000;
  const first = await started(page);
  sail(page.stats, first);
  const second = await started(page);
  sail(page.stats, second);
  page.stats.perfFrame(aRace({ race: { _rid: 'third' } }), 1 / 60, 2, 'high', false); // a new race's frame closes the one before
  await flush();
  const [a, b] = page.of('perf');
  assert.deepEqual([a.id, b.id], [first._rid, second._rid]);
  assert.equal(a.perf.load, 5);
  assert.equal(b.perf.load, null);
});

test("perfSummary reads what it is given, and a chip or a canvas nobody named is null", async () => {
  const { stats } = await open();
  const hist = new Uint32Array(126); hist[8] = 10;
  const s = stats.perfSummary({ hist, n: 10, t: 30, stalls: 3, q0: 1, q: 2, gfx: 'mid', saver: 0 }, { dev: 'desktop' }, null);
  assert.deepEqual(s, { fps: 58.8, low: 58.8, stall: 6, secs: 30, q0: 1, q: 2, gfx: 'mid', saver: 0, rs: 1, dev: 'desktop', gpu: null, w: null, h: null, load: null });
});

test('the resolution below Low is told as it was at the end, 1 when there was none', async () => {
  const { stats } = await open();
  const m = stats.perfMeter();
  for (let i = 0; i < 600; i++) m.frame(1 / 20, 'low', 'auto', false, i < 300 ? 1 : 0.8);
  assert.equal(m.summary().rs, 0.8);
  const n = stats.perfMeter();
  for (let i = 0; i < 600; i++) n.frame(1 / 20, 'low', 'auto', false);
  assert.equal(n.summary().rs, 1, 'a caller that says nothing of it: none');
});

test('frames that the histogram has no bin for read as its slowest', async () => {
  const { stats } = await open();
  const s = stats.perfSummary({ hist: new Uint32Array(126), n: 4, t: 1, stalls: 0 }, {}, { size: () => [10, 20], gpu: 'X' });
  assert.equal(s.fps, 4);
  assert.deepEqual([s.w, s.h, s.gpu], [10, 20, 'X']);
});

const GPUS = [
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'NVIDIA GeForce RTX 3060'],
  ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'Apple M2'],
  ['Adreno (TM) 650', 'Adreno (TM) 650'],
  ['ANGLE (SwiftShader)', 'SwiftShader'],
  ['Mali-G78 ™ <b>', 'Mali-G78  b'],
  ['Google SwiftShader driver 5.0', 'Google'],
];
for (const [raw, clean] of GPUS) test(`the graphics chip "${raw}" is shown as "${clean}"`, async () => {
  const { stats } = await open();
  assert.equal(stats.cleanGpu(raw), clean);
});

test('a chip name that is not one is null, and a long one is cut to 60 letters', async () => {
  const { stats } = await open();
  for (const bad of [null, undefined, '', 42, {}, '™™™']) assert.equal(stats.cleanGpu(bad), null, String(bad));
  assert.equal(stats.cleanGpu('A'.repeat(90)).length, 60);
});

const AGENTS = [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1', 'ios', 'safari', 0],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 CriOS/120 Mobile/15E148 Safari/604.1', 'ios', 'chrome', 0],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17.0 Safari/605.1', 'ios', 'safari', 5], // an iPad asks for the desktop page
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17.0 Safari/605.1', 'mac', 'safari', 0],
  ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537 Chrome/120 Mobile Safari/537', 'android', 'chrome', 5],
  ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537 Chrome/120 Safari/537', 'chromeos', 'chrome', 0],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537 Chrome/120 Safari/537 Edg/120.0', 'windows', 'edge', 0],
  ['Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0', 'windows', 'firefox', 0],
  ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537 Chrome/120 YaBrowser/24.1 Safari/537', 'linux', 'yandex', 0],
  ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537 Chrome/120 Safari/537 OPR/105.0', 'linux', 'opera', 0],
  ['SomeBot/1.0', 'other', 'other', 0],
  ['', 'other', 'other', 0],
];
for (const [ua, os, br, touch] of AGENTS) test(`the browser "${ua.slice(0, 44)}" with ${touch} touch points is ${os}, ${br}`, async () => {
  const { stats } = await open({ ua, touch });
  const d = stats.device();
  assert.deepEqual([d.os, d.br], [os, br]);
});

test('a coarse pointer on a small screen is a phone, on a big one a tablet, and a mouse a desktop', async () => {
  assert.equal((await open({ coarse: true, size: [390, 844] })).stats.device().dev, 'phone');
  assert.equal((await open({ coarse: true, size: [1180, 820] })).stats.device().dev, 'tablet');
  assert.equal((await open({ coarse: false, size: [390, 844] })).stats.device().dev, 'desktop');
});

test('the device says its pixels, cores and memory, or null where the browser will not', async () => {
  const known = (await open({ dpr: 2.625, cores: 8, memory: 4, tg: 'x' })).stats.device();
  assert.deepEqual([known.dpr, known.cores, known.mem, known.tg], [2.63, 8, 4, 1]);
  const hidden = (await open({ dpr: 0, cores: 0, memory: 0 })).stats.device();
  assert.deepEqual([hidden.dpr, hidden.cores, hidden.mem, hidden.tg], [1, null, null, 0]);
});

// ---------- how a race ended ----------
test('the end of a race says how, where, what went wrong and what the player had set', async () => {
  const page = await open();
  clock.perf = 1000;
  const race = await started(page);
  page.stats.statsContext(() => ({ camera: 'chase' }));
  clock.perf = 5000;
  page.stats.raceIncident(race, 'ocs');
  page.stats.raceIncident(race, 'ocs');
  page.stats.raceIncident(race, 'bump');
  page.stats.raceIncident(race, 'a nice breeze');
  clock.perf = 61000;
  page.stats.raceEnded(race, 'menu');
  await flush();
  const { id, end } = page.of('end')[0];
  assert.equal(id, race._rid);
  assert.deepEqual(end, { how: 'menu', leg: 2, legs: 3, clock: 302, place: 2, boats: 2, done: 0, inc: { ocs: 2, bump: 1 }, last: 'bump', ago: 56, pens: 1, mins: 1, use: { camera: 'chase' } });
});

test('a race ends once: the first way it ended is the one posted', async () => {
  const page = await open();
  const race = await started(page);
  page.stats.raceEnded(race, 'restart');
  page.stats.raceEnded(race, 'menu');
  page.stats.raceFinished(race);
  await flush();
  assert.deepEqual(page.of('end').map((e) => e.end.how), ['restart']);
});

for (const [name, ctx] of [['throws', () => { throw new Error('not yet'); }], ['returns nothing', () => null]]) {
  test(`what the player had set is left empty when reading it ${name}`, async () => {
    const page = await open();
    const race = await started(page);
    page.stats.statsContext(ctx);
    page.stats.raceEnded(race, 'menu');
    await flush();
    assert.deepEqual(page.of('end')[0].end.use, {});
  });
}

test('the end of a race with little to say about it still posts', async () => {
  const page = await open();
  const P = {};
  page.stats.raceEnded({ _rid: 'bare', player: P, boats: [P], clock: 12.2 }, 'menu');
  await flush();
  assert.deepEqual(page.of('end')[0].end, { how: 'menu', leg: null, legs: null, clock: 12, place: 1, boats: 1, done: 0, inc: {}, ago: null, pens: 0, mins: 0, use: {} });
});

test('an incident is not counted for a race that was never started', async () => {
  const page = await open();
  const race = aRace();
  page.stats.raceIncident(race, 'ocs');
  assert.equal(race._inc, undefined);
});

test('a new race begun before the last was over says how that one ended, before its own start', async () => {
  const page = await open();
  const first = await started(page);
  const second = aRace();
  page.stats.raceStarted(second, OPTS);
  await flush();
  assert.deepEqual(page.of('end').map((e) => [e.id, e.end.how]), [[first._rid, 'new']]);
  assert.ok(page.posts.findIndex((p) => p.ev === 'end') < page.posts.findLastIndex((p) => p.ev === 'start'));
  assert.notEqual(first._rid, second._rid);
});

// ---------- the page left ----------
test('the page left: how the race ran, how it ended and the visit are all posted', async () => {
  const page = await open();
  const race = await started(page);
  sail(page.stats, race);
  page.win.fire('pagehide');
  await flush();
  assert.equal(page.of('perf')[0].id, race._rid);
  assert.equal(page.of('end')[0].end.how, 'close');
  assert.equal(page.of('visit')[0].visit.stage, 'left');
});

test('the page put away says so; the page brought back says nothing', async () => {
  const page = await open();
  const race = await started(page);
  page.doc.fire('visibilitychange');
  await flush();
  assert.equal(page.of('end').length, 0);
  assert.equal(page.of('visit').length, 0);
  page.document.hidden = true;
  page.doc.fire('visibilitychange');
  await flush();
  assert.equal(page.of('end')[0].end.how, 'hidden');
  assert.equal(page.of('end')[0].id, race._rid);
  assert.equal(page.of('visit')[0].visit.stage, 'left');
});

// ---------- the visit ----------
test('the visit counts the races begun and finished and the minutes on the page', async () => {
  const page = await open({ visitId: 'visit-1', search: '?drill=start&ghost=abc' });
  const race = await started(page);
  await started(page);
  page.stats.raceFinished(race);
  clock.perf = 90000;
  page.stats.visitSend('left');
  await flush();
  const v = page.of('visit')[0];
  assert.equal(v.id, 'visit-1');
  assert.deepEqual([v.visit.races, v.visit.finished, v.visit.mins, v.visit.drill], [2, 1, 1.5, 1]);
  assert.equal('ghost' in v.visit, false, 'an old link to race a ghost counts for nothing');
  assert.equal('load' in v.visit, false);
});

test('the visit says how long the race took to load only at that stage', async () => {
  const page = await open();
  clock.perf = 7300;
  page.stats.visitSend('loaded');
  await flush();
  assert.equal(page.of('visit')[0].visit.load, 7.3);
  assert.equal(page.of('visit')[0].visit.drill, 0);
});

test('a browser keeps its id from one visit to the next', async () => {
  const vid = '12345678-1234-4234-8234-123456789012';
  const page = await open({ stored: { 'regatta-vid': vid } });
  await started(page);
  assert.equal(page.of('start')[0].vid, vid);
  assert.equal(page.data.get('regatta-vid'), vid);
});

for (const [name, stored] of [['no id yet', {}], ['a spoiled one', { 'regatta-vid': 'nonsense' }]]) {
  test(`a browser with ${name} is given a new id, kept for next time`, async () => {
    const page = await open({ stored });
    await started(page);
    const vid = page.of('start')[0].vid;
    assert.match(vid, /^[0-9a-f-]{36}$/);
    assert.equal(page.data.get('regatta-vid'), vid);
  });
}

test('a browser that keeps nothing is nobody in particular, and still races', async () => {
  const page = await open({ brokenStorage: true });
  await started(page);
  assert.equal(page.of('start')[0].vid, null);
  assert.equal('flag' in page.of('start')[0], false);
});

test('without crypto.randomUUID an id is still a well-formed one', async () => {
  const page = await open({ crypto: { getRandomValues: (a) => a.fill(7) } });
  const race = await started(page);
  assert.match(race._rid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ---------- what went wrong ----------
test('an error is noted once with how many times it came, and where, without the path', async () => {
  const page = await open();
  for (let i = 0; i < 3; i++) page.win.fire('error', { message: 'boom', filename: 'https://x.example/game/main.js', lineno: 12 });
  page.win.fire('error', { message: 'boom', filename: 'https://x.example/game/sim.js', lineno: 9 });
  page.win.fire('error', { message: 'no file' });
  page.win.fire('error', {}); // a resource that failed to load: no message
  page.stats.visitSend('left');
  await flush();
  assert.deepEqual(page.of('visit')[0].visit.errors, [{ m: 'boom', src: 'main.js:12', n: 3 }, { m: 'boom', src: 'sim.js:9', n: 1 }, { m: 'no file', src: '', n: 1 }]);
});

test('only the first five different errors are kept, each cut to length', async () => {
  const page = await open();
  for (let i = 0; i < 8; i++) page.win.fire('error', { message: `${i}`.repeat(200) });
  page.stats.visitSend('left');
  await flush();
  const { errors } = page.of('visit')[0].visit;
  assert.equal(errors.length, 5);
  assert.equal(errors[0].m.length, 140);
});

test('a promise nobody caught is noted as an error too', async () => {
  const page = await open();
  page.win.fire('unhandledrejection', { reason: { message: 'lost', stack: 'Error: lost\n    at go (https://x.example/game/net.js:4:2)' } });
  page.win.fire('unhandledrejection', { reason: 'plain words' });
  page.win.fire('unhandledrejection', { reason: null });
  page.stats.visitSend('left');
  await flush();
  assert.deepEqual(page.of('visit')[0].visit.errors, [{ m: 'lost', src: 'net.js:4:2)', n: 1 }, { m: 'plain words', src: '', n: 1 }, { m: 'error', src: '', n: 1 }]);
});

test('a lost WebGL context and how to play being opened are in the visit', async () => {
  const page = await open({ elements: true });
  page.stats.visitSend('left');
  page.how.fire('toggle', { target: { open: false } });
  page.stats.visitSend('left');
  page.gl.fire('webglcontextlost');
  page.how.fire('toggle', { target: { open: true } });
  page.stats.visitSend('left');
  await flush();
  assert.deepEqual(page.of('visit').map((v) => [v.visit.lost, v.visit.howto]), [[0, 0], [0, 0], [1, 1]]);
});
