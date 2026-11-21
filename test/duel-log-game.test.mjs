// What a 1-on-1 race tells the site (public/game/duel-log.js, and match-ui.js calling it): the two real screens of
// one-on-one-screens.mjs, every report caught on its way to POST /connect/log and held against the site's own parser
// (lib/duel-log.ts), so a body this game sends is one the site keeps.
import { sailing, room, start, rematch, page, world, run, until, toFinish, owes, clock, CODE, M, viewOf, plain } from './one-on-one-screens.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const Log = await import('../public/game/duel-log.js');
const { parseReport } = await import('../lib/duel-log.ts');
const LIMIT = (await import('../public/game/sim.js')).FINISH_LIMIT_S;

// ---------- the road to the site ----------
const ok = async () => new Response(null, { status: 204 });
const offline = async () => { throw new TypeError('Failed to fetch'); };
let posts = [], refused = [], answer = ok;
const pageFetch = globalThis.fetch;
globalThis.fetch = (u, init) => {
  if (u !== '/connect/log') return pageFetch(u, init);
  const body = JSON.parse(init.body);
  if (!parseReport(body)) refused.push(body);
  posts.push({ at: clock.t, init, body, loc: location });
  return answer(body);
};
// the page's pagehide, by the page that listens for it
const hides = new Map();
globalThis.addEventListener = (k, fn) => { if (k === 'pagehide') hides.set(location, fn); };

beforeEach(() => { posts = []; refused = []; answer = ok; });
afterEach(() => assert.deepEqual(refused, [], 'every report is one the site accepts'));

// what the promises owe: the screens' frames run without giving them a turn
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
// a while on the screens, the promises having their turn all along
const pass = async (secs, ...pages) => { for (let t = 0; t < secs; t += 0.1) { run(0.1, ...pages); await settle(); } };
const gate = () => { let open; const promise = new Promise((r) => { open = () => r(new Response(null, { status: 204 })); }); return { promise, open }; };

// the guest's end (side 'guest') is her word beside the race's: of('end') and allKinds() are the host's, guestEnds() hers
const mine = (p) => !(p.body.kind === 'end' && p.body.side === 'guest');
const of = (kind) => posts.filter((p) => p.body.kind === kind && mine(p)).map((p) => p.body);
const guestEnds = () => posts.filter((p) => !mine(p)).map((p) => p.body);
const kinds = (s) => posts.filter((p) => p.loc === s.loc).map((p) => p.body.kind);
const allKinds = () => posts.filter(mine).map((p) => p.body.kind);

// ---------- what happens on the water (as one-on-one-endings.test.mjs sails it) ----------
const home = (x, b) => { toFinish(x.hr, b); until(() => b.done, x.live, 10, `${b.name} is home`); };
const homeOwing = (x, b) => { owes(b); home(x, b); assert.equal(b.dsq, true); };
const toLimit = (x) => { x.hr.clock = x.hr.validAt + LIMIT - 0.5; until(() => x.hr.over, x.live, 3, 'the limit ends the race'); };
const leaves = (x, s) => { s.leave(); x.live = x.live.filter((p) => p !== s); run(0.5, ...x.live); };
const asleep = (x, secs) => { const was = x.live; x.live = [x.g]; run(secs, x.g); x.live = was; run(0.5, ...x.live); };
const afloat = async (o = {}) => { const x = await sailing({ seed: 11, ...o }); x.live = x.both; await settle(); return x; };
const toCard = (x) => until(() => x.h.shows('#mCard .m-go') && x.g.shows('#mCard'), x.both, 40, 'the card, with its rematch');
const bothHome = (x) => { home(x, x.H); run(1, ...x.live); home(x, x.G); };
// a guest whose screen never has the race built, and whose tab then goes: five minutes on, the race is over
const neverLoads = async () => {
  const x = await room();
  x.g.mute = (e) => e === 'loaded';
  start(x, 11);
  run(1, x.h, x.g);
  await settle();
  x.g.gone();
  x.live = [x.h];
  return x;
};

// [place, mark, has a time]
const side = (b) => [b.place, b.mark, b.secs !== null];
const pick = (e) => ({ state: e.state, winner: e.winner, forfeited: e.forfeited, margin: e.margin === null ? null : e.margin > 0, host: side(e.host), guest: side(e.guest) });
const FINISHED = { state: 'finished', forfeited: null, margin: null };
const ABANDONED = { state: 'abandoned', winner: null, forfeited: null, margin: null, host: [null, null, false], guest: [null, null, false] }; // (it isn't scored)

const ENDINGS = [
  ['both home', afloat, bothHome,
    { ...FINISHED, winner: 'host', margin: true, host: [1, null, true], guest: [2, null, true] }],
  ['the guest home first, the host second', afloat, (x) => { home(x, x.G); run(1, ...x.live); home(x, x.H); },
    { ...FINISHED, winner: 'guest', margin: true, host: [2, null, true], guest: [1, null, true] }],
  ['the first home disqualified', afloat, (x) => { homeOwing(x, x.H); run(1, ...x.live); home(x, x.G); },
    { ...FINISHED, winner: 'guest', host: [null, 'DSQ', true], guest: [1, null, true] }],
  ['both disqualified', afloat, (x) => { homeOwing(x, x.G); run(1, ...x.live); homeOwing(x, x.H); },
    { ...FINISHED, winner: null, host: [null, 'DSQ', true], guest: [null, 'DSQ', true] }],
  ['the limit, with a DNF', afloat, (x) => { home(x, x.H); toLimit(x); },
    { ...FINISHED, winner: 'host', host: [1, null, true], guest: [null, 'DNF', false] }],
  ['the guest silent 30 s', afloat, (x) => { x.g.mute = (e) => e === 'input'; run(31, ...x.live); },
    { ...FINISHED, winner: 'host', forfeited: 'guest', host: [1, null, false], guest: [null, 'DNF', false] }],
  ['the guest leaving before her finish', afloat, (x) => leaves(x, x.g),
    { ...FINISHED, winner: 'host', forfeited: 'guest', host: [1, null, false], guest: [null, 'DNF', false] }],
  ['the guest leaving after her finish', afloat, (x) => { home(x, x.G); leaves(x, x.g); assert.equal(x.hr.over, false); home(x, x.H); },
    { ...FINISHED, winner: 'guest', margin: true, host: [2, null, true], guest: [1, null, true] }],
  ['the host leaving', afloat, (x) => leaves(x, x.h), ABANDONED],
  ['the host leaving after her finish', afloat, (x) => { home(x, x.H); leaves(x, x.h); }, ABANDONED],
  ['a sleeping host', afloat, (x) => asleep(x, 61), ABANDONED],
  ['a guest who never loads the race', neverLoads, (x) => run(312, x.h), ABANDONED],
];

for (const [name, make, sail, want] of ENDINGS) {
  test(`the end of a race: ${name}`, async () => {
    const x = await make();
    sail(x);
    await settle();
    run(2, ...x.live);
    await settle();
    assert.equal(of('end').length, 1, 'told once');
    assert.deepEqual(pick(of('end')[0]), want);
    assert.equal(of('end')[0].token, of('start')[0].token);
    assert.equal(of('end')[0].seed, of('start')[0].seed);
    assert.deepEqual(allKinds().filter((k) => k !== 'join'), ['start', 'end'], 'the start first');
    const g = guestEnds();
    assert.ok(g.length <= 1, 'her end told once at the most');
    if (g.length) assert.deepEqual([g[0].state, g[0].winner, g[0].seed], [of('end')[0].state, of('end')[0].winner, of('end')[0].seed], 'the two screens agree');
  });
}

// ---------- who tells what, and when ----------
test('the host reports the start once for each race, rematches included', async () => {
  const x = await afloat();
  bothHome(x); await settle(); toCard(x);
  rematch(x, 12);
  run(1, ...x.both); await settle();
  assert.deepEqual(kinds(x.h), ['start', 'end', 'start']);
  const [a, b] = of('start');
  assert.deepEqual([a.seed, b.seed], [11, 12]);
  assert.notEqual(a.token, b.token, 'each race its own token');
  assert.match(a.token, /^[0-9a-f]{64}$/);
  assert.deepEqual([a.code, a.host, a.guest], [CODE, 'Host', 'Guest']);
  assert.deepEqual(a.settings, { venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' });
});

test('a rematch drawing a seed already sailed is no new race to the site', async () => {
  const x = await afloat();
  bothHome(x); await settle(); toCard(x);
  rematch(x, 12);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, x.both, 10);
  await settle();
  x.hr = x.h.race(); x.H = x.hr.player; x.G = x.hr.humans.find((b) => b !== x.H);
  x.hr.clock = 60;
  for (const b of x.hr.humans) b.leg = 1;
  bothHome(x); await settle(); toCard(x);
  rematch(x, 11);
  run(2, ...x.both); await settle();
  assert.deepEqual(kinds(x.h), ['start', 'end', 'start', 'end']);
});

test('the guest reports joining once a race with a token of her own, and her end beside the host\'s, and never a start', async () => {
  const x = await afloat();
  run(3, ...x.both);
  bothHome(x); await settle(); toCard(x);
  rematch(x, 12);
  run(1, ...x.both); await settle();
  assert.deepEqual(kinds(x.g), ['join', 'end', 'join']);
  const joins = of('join');
  assert.deepEqual(joins.map(({ token, ...j }) => j), [{ kind: 'join', code: CODE, seed: 11, name: 'Guest' }, { kind: 'join', code: CODE, seed: 12, name: 'Guest' }]);
  for (const j of joins) assert.match(j.token, /^[0-9a-f]{64}$/);
  assert.notEqual(joins[0].token, joins[1].token, 'each race its own token');
  const [mine] = guestEnds(), [host] = of('end');
  assert.equal(mine.side, 'guest'); assert.equal(mine.token, joins[0].token, 'her end carries her join\'s token');
  assert.notEqual(mine.token, host.token);
  assert.deepEqual([mine.seed, mine.state, mine.winner, mine.gun], [11, host.state, host.winner, true], 'the two screens agree');
});

test('both home: the end names the winner, the margin and each boat', async () => {
  const x = await afloat();
  x.H.pens = 2;
  bothHome(x); run(1, ...x.live); await settle();
  const [end] = of('end');
  assert.equal(end.state, 'finished');
  assert.equal(end.winner, 'host');
  assert.equal(end.host.place, 1);
  assert.equal(end.guest.place, 2);
  assert.ok(end.margin > 0);
  assert.equal(end.margin, Math.round((x.G.finish - x.H.finish) * 1000) / 1000);
  assert.equal(end.host.secs, Math.round(x.H.finish * 1000) / 1000);
  assert.deepEqual([end.host.pens, end.guest.pens], [2, 0]);
  assert.deepEqual([end.prep, end.recalls], ['P', 0]);
});

test('the flag and the recalls are the race\'s', async () => {
  const x = await afloat({ seed: 13 });
  x.hr.recalls = 12;
  leaves(x, x.g); await settle();
  assert.deepEqual([of('end')[0].prep, of('end')[0].recalls], ['U', 9], 'U for this seed, and as many recalls as the site can keep');
});

test('the names are the sailors\' own, as the waiting room shows them', async () => {
  world();
  const h = await page('Anna 🌊 P', { host: true }), g = await page('<Bo> \u0007Li');
  const x = { h, g, live: [h, g] };
  run(0.5, h, g);
  assert.match(h.says('#mRoom .m-ppl'), /Anna P/);
  assert.match(h.says('#mRoom .m-ppl'), /Bo Li/);
  start(x, 11);
  until(() => h.cur()?.H && g.cur()?.G, x.live, 10);
  await settle();
  assert.deepEqual([of('start')[0].host, of('start')[0].guest, of('join')[0].name], ['Anna P', 'Bo Li', 'Bo Li']);
});

test('the guest never receives the write token', async () => {
  const x = await room(), wire = [];
  x.g.heardMsg = (e, p) => wire.push([e, p]);
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G, [x.h, x.g], 10);
  await settle();
  run(1, x.h, x.g);
  x.h.press('#mRoom .m-leave');
  run(1, x.g);
  await settle();
  const hostToken = of('start')[0].token;
  assert.ok(wire.length > 10, 'she heard the race');
  assert.equal(JSON.stringify(wire).includes(hostToken), false);
  assert.equal(JSON.stringify(Object.entries(x.g.ls)).includes(hostToken), false);
  assert.ok(of('join').every((b) => b.token !== hostToken), 'her token is her own');
});

// ---------- a report that fails ----------
test('a report that fails is tried three times, 3 s apart, and the race goes on', async () => {
  answer = offline;
  const x = await room();
  start(x, 11);
  await pass(10, x.h, x.g);
  const tries = posts.filter((p) => p.body.kind === 'start');
  assert.equal(tries.length, 3);
  for (const [a, b] of [[0, 1], [1, 2]]) assert.ok(Math.abs(tries[b].at - tries[a].at - 3000) < 200, `${tries[b].at - tries[a].at} ms apart`);
  assert.equal(x.h.match().state, 'race');
  assert.ok(x.h.cur().H, 'the race is on');
  await pass(10, x.h, x.g);
  assert.equal(posts.filter((p) => p.body.kind === 'start').length, 3, 'and no more');
});

test('a race whose every report fails sails as one whose reports all arrive', async () => {
  const sail = async (a) => {
    answer = a;
    const x = await room();
    start(x, 11);
    until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
    await pass(6, x.h, x.g);
    return { view: viewOf(x.h.race()), guest: viewOf(x.g.race()), clock: x.h.race().clock, match: plain(x.h.match().toJSON()), at: x.h.race().humans.map((b) => [b.x, b.z, b.h, b.v]) };
  };
  assert.deepEqual(await sail(offline), await sail(ok));
});

// ---------- in order ----------
test('an end waits for the start\'s tries to be over, and the screens don\'t wait for it', async () => {
  answer = (b) => (b.kind === 'start' ? offline() : ok());
  const x = await room();
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  x.g.leave();
  run(0.5, x.h, x.g);
  assert.equal(x.h.match().state, 'over', 'the race is over');
  assert.deepEqual(of('end'), [], 'not told yet');
  until(() => x.h.shows('#mCard'), [x.h, x.g], 6, 'the card is up, the start still being tried');
  await pass(9, x.h, x.g);
  assert.deepEqual(allKinds().filter((k) => k !== 'join'), ['start', 'start', 'start', 'end']);
});

test('an end that has waited for a start that worked goes as soon as it has', async () => {
  const held = gate();
  answer = (b) => (b.kind === 'start' ? held.promise : ok());
  const x = await room();
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  x.g.leave();
  run(3, x.h, x.g); await settle();
  assert.deepEqual(of('end'), []);
  held.open();
  await settle();
  assert.equal(of('end').length, 1);
  run(2, x.h, x.g); await settle();
  assert.equal(of('end').length, 1, 'once');
});

test('a rematch doesn\'t lose the end of the race before it, still waiting for its start', async () => {
  const held = gate();
  answer = (b) => (b.kind === 'start' && b.seed === 11 ? held.promise : ok());
  const x = await afloat();
  bothHome(x); await settle(); toCard(x);
  rematch(x, 12);
  run(1, ...x.both); await settle();
  assert.deepEqual(of('end'), []);
  held.open();
  await settle();
  assert.deepEqual(of('end').map((b) => [b.seed, b.token]), [[11, of('start')[0].token]]);
  run(2, ...x.both); await settle();
  assert.equal(of('end').length, 1, 'and the race on the water has no end yet');
});

test('leaving sends the end at once, whatever the start is still waiting for', async () => {
  answer = (b) => (b.kind === 'start' ? new Promise(() => {}) : ok());
  const x = await room();
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G, [x.h, x.g], 10);
  x.h.leave();
  assert.deepEqual(allKinds().filter((k) => k !== 'join'), ['start', 'end'], 'in the same moment');
  assert.equal(of('end')[0].state, 'abandoned');
  assert.equal(x.h.ls.getItem(`regatta-match-${CODE}`), null, 'and nothing is left saved');
  await settle();
  assert.equal(x.h.ls.getItem(`regatta-match-${CODE}`), null);
});

test('a page going away sends the end that was waiting', async () => {
  answer = (b) => (b.kind === 'start' ? new Promise(() => {}) : ok());
  const x = await room();
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  x.g.leave();
  run(1, x.h, x.g);
  assert.deepEqual(of('end'), []);
  hides.get(x.h.loc)();
  assert.equal(of('end').length, 1);
  assert.equal(of('end')[0].forfeited, 'guest');
});

test('a page going away with the race on says nothing yet: the page opened again will', async () => {
  const x = await afloat();
  hides.get(x.h.loc)();
  await settle();
  assert.deepEqual(of('end'), []);
});

test('the end is sent with keepalive, so a page closing at once still delivers it', async () => {
  const x = await afloat();
  x.h.leave();
  const calls = posts.filter((p) => p.body.kind === 'end');
  assert.equal(calls.at(-1).init.keepalive, true);
  const { body, ...rest } = calls.at(-1).init;
  assert.deepEqual(rest, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' } });
  assert.ok(Buffer.byteLength(body) < 1024, `${Buffer.byteLength(body)} bytes`);
});

test('an end carries no tracks and no logs, however long the race', async () => {
  const x = await afloat();
  for (const b of x.hr.humans) { b.track = Array.from({ length: 9000 }, (_, i) => [i, i]); b.log.notes = 'x'.repeat(50000); }
  bothHome(x); run(1, ...x.live); await settle();
  const raw = posts.find((p) => p.body.kind === 'end').init.body;
  assert.ok(Buffer.byteLength(raw) < 1024, `${Buffer.byteLength(raw)} bytes`);
  assert.deepEqual(Object.keys(of('end')[0].host).sort(), ['mark', 'pens', 'place', 'secs']);
});

// ---------- where it is told from ----------
for (const [what, host, search, posted] of [
  ['localhost posts nothing', 'localhost', '', false], ['127.0.0.1 posts nothing', '127.0.0.1', '', false], ['[::1] posts nothing', '[::1]', '', false], ['a .localhost name posts nothing', 'game.localhost', '', false],
  ['localhost with ?scores posts', 'localhost', '?scores', true], ['localhost with &scores posts', 'localhost', '?a=1&scores=1', true], ['the site posts', 'sailupdown.com', '', true],
]) {
  test(`${what}`, async () => {
    const x = await room();
    for (const s of [x.h, x.g]) Object.assign(s.loc, { hostname: host, search });
    start(x, 11);
    until(() => x.h.cur()?.H && x.g.cur()?.G, [x.h, x.g], 10);
    await settle();
    x.h.leave();
    await settle();
    assert.deepEqual(allKinds().sort(), posted ? ['end', 'join', 'start'] : []);
  });
}

// ---------- a host back on the page ----------
const savedKey = `regatta-match-${CODE}`;

test('a host back on a page with a saved token reports the abandoned race', async () => {
  const x = await afloat();
  const savedToken = of('start')[0].token;
  assert.equal(JSON.parse(x.h.ls.getItem(savedKey)).w, savedToken, 'kept with the saved race');
  x.h.gone();
  const back = await page('Host', { ls: x.h.ls });
  await settle();
  const end = of('end')[0];
  assert.equal(of('end').length, 1);
  assert.equal(end.state, 'abandoned');
  assert.equal(end.token, savedToken);
  assert.equal(end.seed, 11);
  assert.deepEqual([end.prep, end.recalls, end.winner, end.margin, end.forfeited], [null, null, null, null, null]);
  assert.deepEqual(end.host, { place: null, secs: null, mark: null, pens: null });
  assert.deepEqual(end.guest, { place: null, secs: null, mark: null, pens: null });
  run(3, back); await settle();
  assert.equal(of('end').length, 1, 'once');
  assert.equal(of('start').length, 1, 'and its start is not told again');
});

for (const [what, sail] of [['with both boats out', () => {}], ['with the host home', (x) => { x.H.pens = 2; home(x, x.H); }], ['with the guest disqualified at the finish', (x) => homeOwing(x, x.G)]]) {
  test(`an abandoned race says the same on the host's page and after a reload, ${what}`, async () => {
    const x = await afloat();
    sail(x);
    const saved = x.h.ls.getItem(savedKey);
    x.h.leave();
    const { prep, recalls, gun, ...here } = of('end')[0];
    assert.deepEqual([prep, recalls, gun], ['P', 0, true], 'the race on the page has its flag, its recalls and its clock past the gun');
    assert.deepEqual([here.host, here.guest], [{ place: null, secs: null, mark: null, pens: null }, { place: null, secs: null, mark: null, pens: null }]);
    assert.deepEqual([here.state, here.winner, here.margin, here.forfeited], ['abandoned', null, null, null]);

    // the same race, as the page opened again finds it
    x.h.ls.setItem(savedKey, saved);
    x.h.gone();
    posts = [];
    await page('Host', { ls: x.h.ls });
    await settle();
    const { prep: prep2, recalls: recalls2, gun: gun2, ...back } = of('end')[0];
    assert.deepEqual([prep2, recalls2, gun2], [null, null, null], 'a reloaded page has no race to read them from');
    assert.deepEqual(back, here);
  });
}

test('a host back on a race whose end never went reports what the race saved', async () => {
  answer = (b) => (b.kind === 'start' ? new Promise(() => {}) : ok());
  const x = await room();
  start(x, 11);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  Object.assign(x, { hr: x.h.race(), live: [x.h, x.g] });
  x.H = x.hr.player; x.G = x.hr.humans.find((b) => b !== x.H);
  x.hr.clock = 60;
  for (const b of x.hr.humans) b.leg = 1;
  home(x, x.H); toLimit(x);
  run(1, ...x.live);
  assert.deepEqual(of('end'), [], 'waiting for its start');
  x.h.gone();
  answer = ok;
  await page('Host', { ls: x.h.ls });
  await settle();
  const end = of('end')[0];
  assert.deepEqual([end.state, end.winner, end.forfeited], ['finished', 'host', null]);
  assert.deepEqual(end.host, { place: 1, secs: null, mark: null, pens: null });
  assert.deepEqual(end.guest, { place: null, secs: null, mark: 'DNF', pens: null });
});

test('a host back after the end has gone tells it no second time', async () => {
  const x = await afloat();
  bothHome(x); run(1, ...x.live); await settle();
  assert.equal(of('end').length, 1);
  assert.equal(JSON.parse(x.h.ls.getItem(savedKey)).w, undefined, 'its token is done with');
  x.h.gone();
  const back = await page('Host', { ls: x.h.ls });
  run(2, back); await settle();
  assert.equal(of('end').length, 1);
  assert.equal(back.shows('#mCard'), true);
});

test('a race saved before this shipped has no token: no end, no throw', async () => {
  const x = await afloat();
  const saved = JSON.parse(x.h.ls.getItem(savedKey));
  delete saved.w;
  x.h.ls.setItem(savedKey, JSON.stringify(saved));
  x.h.gone();
  posts = [];
  const back = await page('Host', { ls: x.h.ls });
  run(2, back); await settle();
  assert.deepEqual(kinds(back), []);
  assert.equal(back.shows('#mCard'), true);
  assert.equal(back.says('#mCardH'), 'Race abandoned');
});

test('a saved token that isn\'t one is no token', async () => {
  const x = await afloat();
  const saved = JSON.parse(x.h.ls.getItem(savedKey));
  x.h.ls.setItem(savedKey, JSON.stringify({ ...saved, w: 'not-a-token' }));
  x.h.gone();
  posts = [];
  const back = await page('Host', { ls: x.h.ls });
  run(2, back); await settle();
  assert.deepEqual(kinds(back), []);
});

test('a host back on a saved race whose duel-log.js failed to load makes no noise and sends nothing', async () => {
  const x = await afloat();
  x.h.gone();
  posts = [];
  const hook = registerHooks({ resolve(spec, ctx, next) {
    if (globalThis.__noDuelLog && spec === './duel-log.js' && /match-ui\.js/.test(ctx.parentURL ?? '')) throw new Error('duel-log.js failed to load');
    return next(spec, ctx);
  } });
  const errors = [], was = console.error;
  console.error = (...a) => errors.push(a);
  try {
    globalThis.__noDuelLog = true;
    const back = await page('Host', { ls: x.h.ls });
    run(3, back); await settle();
    run(3, back); await settle();
    assert.deepEqual(errors, [], 'tellEnd throws on no beat');
    assert.deepEqual(posts, [], 'and nothing is sent');
    assert.equal(back.says('#mCardH'), 'Race abandoned', 'the race itself is told as before');
  } finally { console.error = was; globalThis.__noDuelLog = false; hook.deregister(); }
});

// ---------- report(), on its own ----------
const BODY = { kind: 'join', code: CODE, seed: 1, name: 'Ann' };
const instant = () => { const gaps = []; return { gaps, wait: (fn, ms) => { gaps.push(ms); fn(); } }; };
const answers = (...list) => { const calls = []; return { calls, fetch: (u, init) => { calls.push({ u, init }); const a = list[Math.min(calls.length - 1, list.length - 1)]; return a(); } }; };
const status = (n) => async () => new Response(null, { status: n });

test('report posts the body as JSON to the site, once when it is taken', async () => {
  const f = answers(status(204)), w = instant();
  Log.report(BODY, { fetch: f.fetch, wait: w.wait, local: false });
  await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].u, '/connect/log');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), BODY);
  assert.deepEqual(w.gaps, []);
});

for (const [what, first] of [['a network failure', offline], ['a 500', status(500)], ['a 429', status(429)], ['an answer that is nothing', async () => undefined]]) {
  test(`report tries again after ${what}, three tries in all, 3 s apart`, async () => {
    const f = answers(first), w = instant();
    Log.report(BODY, { fetch: f.fetch, wait: w.wait, local: false });
    await settle();
    assert.equal(f.calls.length, 3);
    assert.deepEqual(w.gaps, [3000, 3000]);
  });
}

test('report stops at the first try that works', async () => {
  const f = answers(offline, status(204)), w = instant();
  Log.report(BODY, { fetch: f.fetch, wait: w.wait, local: false });
  await settle();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(w.gaps, [3000]);
});

test('report does nothing when local', async () => {
  const f = answers(status(204)), w = instant();
  Log.report(BODY, { fetch: f.fetch, wait: w.wait, local: true });
  await settle();
  assert.equal(f.calls.length, 0);
});

test('report says once when its tries are over, whether they worked or not', async () => {
  for (const [fetch, local, want] of [[answers(status(204)).fetch, false, true], [answers(offline).fetch, false, false], [answers(status(204)).fetch, true, false]]) {
    const said = [];
    Log.report(BODY, { fetch, wait: instant().wait, local, done: (v) => said.push(v) });
    await settle();
    assert.deepEqual(said, [want]);
  }
});

test('report never throws and never leaves a promise to reject', async () => {
  const loose = [], hear = (e) => loose.push(e);
  process.on('unhandledRejection', hear);
  const was = globalThis.fetch;
  try {
    const wait = instant().wait, thrower = () => { throw new Error('no'); };
    assert.doesNotThrow(() => Log.report(BODY, { fetch: thrower, wait, local: false }), 'a fetch that throws');
    assert.doesNotThrow(() => Log.report(BODY, { fetch: () => Promise.reject(new Error('no')), wait, local: false }), 'a fetch that rejects');
    assert.doesNotThrow(() => Log.report(BODY, { fetch: answers(offline).fetch, wait: thrower, local: false }), 'a timer that throws');
    assert.doesNotThrow(() => Log.report(BODY, { fetch: answers(status(204)).fetch, wait, local: false, done: thrower }), 'a listener that throws');
    assert.doesNotThrow(() => Log.report(BODY, { fetch: () => ({ then() { throw new Error('no'); } }), wait, local: false }), 'an answer that throws');
    assert.doesNotThrow(() => Log.report({ n: 1n }, { fetch: answers(status(204)).fetch, wait, local: false }), 'a body that can\'t be sent');
    assert.doesNotThrow(() => Log.report(BODY, null), 'no options');
    globalThis.fetch = undefined;
    assert.doesNotThrow(() => Log.report(BODY, { wait, local: false }), 'no fetch at all');
    await settle();
    assert.deepEqual(loose, []);
  } finally { globalThis.fetch = was; process.off('unhandledRejection', hear); }
});

test('newToken is 32 random bytes, in hex', () => {
  assert.match(Log.newToken(), /^[0-9a-f]{64}$/);
  assert.notEqual(Log.newToken(), Log.newToken());
});

// ---------- the bodies, on their own ----------
const SETTINGS = { venue: 'palma', yacht: 'jpk1050', preset: 'light', length: 'long', course: 'tri', laps: 2, start: 5, current: 1, daytime: 'sunset' };
const TOKEN = 'ab'.repeat(32);
const matchOf = (result, names = ['Ann', 'Bo']) => ({ result, hostId: 'h1', guestId: 'g1', start: { seed: 42, settings: SETTINGS, host: { id: 'h1', name: names[0] }, guest: { id: 'g1', name: names[1] } } });
const row = (id, o = {}) => ({ id, done: true, dsq: false, dnf: false, place: null, finish: 100, pens: 0, track: [[0, 0]], log: {}, ...o });
const accepted = (b) => { assert.ok(parseReport(b), JSON.stringify(b)); return b; };

test('startBody says the race, its token and both names', () => {
  assert.deepEqual(accepted(Log.startBody(matchOf(null), CODE, TOKEN)), { kind: 'start', code: CODE, seed: 42, token: TOKEN, host: 'Ann', guest: 'Bo', settings: SETTINGS });
});

test('a name with nothing left in it is the dash the waiting room shows', () => {
  const b = accepted(Log.startBody(matchOf(null, ['Ann', '🌊']), CODE, TOKEN));
  assert.equal(b.guest, '—');
  assert.equal(accepted(Log.joinBody(matchOf(null), CODE, '🌊')).name, '—');
});

test('a name cut in the middle of a character is sent whole', () => {
  const b = accepted(Log.startBody(matchOf(null, ['a'.repeat(15) + '𝐀', 'Bo']), CODE, TOKEN));
  assert.equal(b.host, 'a'.repeat(15));
  assert.equal(JSON.stringify(b).includes('\\ud'), false);
});

test('joinBody says who joined which race', () => {
  assert.deepEqual(accepted(Log.joinBody(matchOf(null), CODE, ' Bo  Li ')), { kind: 'join', code: CODE, seed: 42, name: 'Bo Li' });
});

test('endBody with the race here reads its boats, and only what the site keeps of them', () => {
  const result = { winner: 'g1', margin: 12.34567, forfeited: null, abandoned: false };
  const race = { prepFlag: 'B', recalls: 2 };
  const results = { boats: [row('g1', { place: 1, finish: 400.1234 }), row('h1', { place: 2, finish: 412.5, pens: 3 })] };
  assert.deepEqual(accepted(Log.endBody(matchOf(result), CODE, TOKEN, race, results)), {
    kind: 'end', side: 'host', code: CODE, seed: 42, token: TOKEN, state: 'finished', winner: 'guest', margin: 12.346, forfeited: null, recalls: 2, prep: 'B', gun: true,
    host: { place: 2, secs: 412.5, mark: null, pens: 3 }, guest: { place: 1, secs: 400.123, mark: null, pens: 0 },
  });
});

test('the gun: the clock past nought or a recall; a page with no race knows it of a finish, not of an abandoned race', () => {
  const won = { winner: 'g1', margin: 1, forfeited: null, abandoned: false }, off = { abandoned: true };
  const gun = (result, race) => accepted(Log.endBody(matchOf(result), CODE, TOKEN, race, null)).gun;
  assert.equal(gun(off, { clock: -42, recalls: 0 }), false, 'abandoned in the sequence');
  assert.equal(gun(off, { clock: 0, recalls: 0 }), true, 'abandoned at the gun');
  assert.equal(gun(off, { clock: -50, recalls: 1 }), true, 'abandoned in the sequence again, after a recall');
  assert.equal(gun(off, null), null);
  assert.equal(gun(won, null), true);
});

test('the guest\'s end says her side; her join carries her token, and one with none is still a join', () => {
  const result = { winner: 'h1', margin: 3, forfeited: null, abandoned: false };
  const mine = accepted(Log.endBody(matchOf(result), CODE, TOKEN, { clock: 300, recalls: 0 }, null, 'guest'));
  assert.deepEqual([mine.side, mine.winner, mine.token], ['guest', 'host', TOKEN]);
  assert.equal(accepted(Log.joinBody(matchOf(null), CODE, 'Bo', TOKEN)).token, TOKEN);
  assert.equal('token' in accepted(Log.joinBody(matchOf(null), CODE, 'Bo')), false);
});

for (const [what, boat, mark] of [['dsq', { dsq: true }, 'DSQ'], ['ufd', { ufd: true, done: false }, 'DSQ'], ['bfd', { bfd: true, done: false }, 'DSQ'], ['dnf', { dnf: true, done: false }, 'DNF'], ['not home', { done: false, finish: null }, 'DNF'], ['home', {}, null]]) {
  test(`a boat's mark: ${what}`, () => {
    const b = accepted(Log.endBody(matchOf({ winner: 'h1', margin: null, forfeited: null, abandoned: false }), CODE, TOKEN, { prepFlag: 'P', recalls: 0 }, { boats: [row('h1', { place: 1 }), row('g1', boat)] }));
    assert.equal(b.guest.mark, mark);
    assert.equal(b.host.mark, null, 'the winner has her place');
  });
}

test('a winner by forfeit, not home herself, is first with no mark and no time; the boat that gave up is named by her role', () => {
  const b = accepted(Log.endBody(matchOf({ winner: 'g1', margin: null, forfeited: 'h1', abandoned: false }), CODE, TOKEN, { prepFlag: 'P', recalls: 0 }, { boats: [row('h1', { done: false, dnf: true, finish: null }), row('g1', { done: false, finish: null })] }));
  assert.equal(b.forfeited, 'host');
  assert.deepEqual(b.guest, { place: 1, secs: null, mark: null, pens: 0 });
  assert.deepEqual(b.host, { place: null, secs: null, mark: 'DNF', pens: 0 });
});

test('with no race on this page, endBody reports what the result holds', () => {
  const b = accepted(Log.endBody(matchOf({ winner: 'h1', margin: 7.5, forfeited: null, abandoned: false }), CODE, TOKEN, null, null));
  assert.deepEqual([b.state, b.winner, b.margin, b.prep, b.recalls], ['finished', 'host', 7.5, null, null]);
  assert.deepEqual(b.host, { place: 1, secs: null, mark: null, pens: null });
  assert.deepEqual(b.guest, { place: 2, secs: null, mark: null, pens: null });
  const marked = accepted(Log.endBody(matchOf({ winner: 'h1', margin: null, forfeited: 'g1', abandoned: false, marks: { g1: 'DNF' } }), CODE, TOKEN, null, null));
  assert.deepEqual(marked.guest, { place: null, secs: null, mark: 'DNF', pens: null });
  assert.equal(marked.forfeited, 'guest');
});

test('an abandoned race scores nobody, whatever its boats had done', () => {
  const b = accepted(Log.endBody(matchOf({ winner: 'h1', margin: 5, forfeited: 'g1', abandoned: true, marks: { g1: 'DNF' } }), CODE, TOKEN, { prepFlag: 'U', recalls: 1 }, { boats: [row('h1', { place: 1, pens: 2 }), row('g1', { dsq: true })] }));
  assert.deepEqual([b.state, b.winner, b.margin, b.forfeited, b.prep, b.recalls], ['abandoned', null, null, null, 'U', 1]);
  for (const s of [b.host, b.guest]) assert.deepEqual(s, { place: null, secs: null, mark: null, pens: null });
});

test('with no result at all a race is abandoned', () => {
  assert.equal(accepted(Log.endBody(matchOf(null), CODE, TOKEN, null, null)).state, 'abandoned');
});

test('numbers the site wouldn\'t take are never sent', () => {
  const result = { winner: 'h1', margin: NaN, forfeited: null, abandoned: false };
  for (const [recalls, want] of [[3.7, 3], [40, 9], [-1, null], [NaN, null], ['2', null]]) {
    const b = accepted(Log.endBody(matchOf(result), CODE, TOKEN, { prepFlag: 'X', recalls }, { boats: [row('h1', { place: 1, finish: Infinity, pens: 250 }), row('g1', { place: 2, finish: 90000, pens: -3 })] }));
    assert.equal(b.recalls, want);
    assert.deepEqual([b.margin, b.prep, b.host.secs, b.guest.secs, b.host.pens, b.guest.pens], [null, null, null, null, 99, null]);
  }
});

test('the reports load with the 1-on-1 race alone', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.doesNotMatch(read('../public/game/main.js'), /duel-log/);
  assert.match(read('../public/game/match-ui.js'), /import\('\.\/duel-log\.js'\)\.catch\(/, 'and a module that doesn\'t load stops no race');
  assert.doesNotMatch(read('../public/game/duel-log.js'), /\bdocument\b|\bwindow\b|localStorage/);
});

test('its copy of the name\'s pattern is the site\'s', async () => {
  const { EMOJI } = await import('../lib/name.ts');
  assert.ok(readFileSync(new URL('../public/game/duel-log.js', import.meta.url), 'utf8').includes(`/${EMOJI.source}/gu`));
  const { clean } = await import('../public/game/match-ui.js');
  for (const s of ['Anna 🌊 P', '<Bo> \u0007Li', '  a   b ', '1️⃣ Bo', 'x'.repeat(30)]) assert.equal(Log.joinBody(matchOf(null), CODE, s).name, clean(s));
});

test('M.finalResults gives endBody every boat it reads', async () => {
  const x = await afloat();
  bothHome(x);
  for (const b of M.finalResults(x.hr).boats) for (const k of ['id', 'done', 'dsq', 'dnf', 'place', 'finish', 'pens']) assert.ok(k in b, k);
});

test('endBody keeps the I flag', () => {
  const result = { winner: 'g1', margin: 3, forfeited: null, abandoned: false };
  const results = { boats: [row('g1', { place: 1, finish: 400 }), row('h1', { place: 2, finish: 403 })] };
  assert.equal(accepted(Log.endBody(matchOf(result), CODE, TOKEN, { prepFlag: 'I', recalls: 0 }, results)).prep, 'I');
});

// ---------- how the race ran on each screen ----------
const PERF = { fps: 30.3, low: 19.6, stall: 2.13, secs: 282, q0: 'low', q: 'low', gfx: 'auto', saver: 0, dev: 'desktop', tg: 0, os: 'windows', br: 'chrome', dpr: 1.25,
  cores: 4, mem: 8, gpu: 'Intel(R) UHD Graphics', w: 1536, h: 703, load: null };

test('each screen reports how the race ran on it once, as its card opens: its frames, and how the other screen\'s messages came', async () => {
  const x = await afloat();
  x.h.perf = () => PERF; x.g.perf = () => ({ ...PERF, fps: 60 });
  await pass(25, ...x.both);
  bothHome(x); await settle(); toCard(x); await settle();
  run(3, ...x.both); await settle();
  const perf = of('perf');
  assert.deepEqual(perf.map((p) => [p.side, p.seed, p.code, p.perf.fps]).sort(), [['guest', 11, CODE, 60], ['host', 11, CODE, 30.3]], 'one from each screen');
  const g = perf.find((p) => p.side === 'guest').perf.net, h = perf.find((p) => p.side === 'host').perf.net;
  assert.deepEqual(g, { rtt: null, late: 0 }, 'the guest\'s: no snapshot late (and no way there and back to measure with no delay)');
  assert.equal(h.rtt, null);
});

test('a screen with too few frames, or none measured, reports nothing; leaving mid-race reports what was measured', async () => {
  const x = await afloat();
  await pass(3, ...x.both);
  x.g.perf = () => PERF; // (main.js's meter: null under 20 s of frames)
  leaves(x, x.g); await settle();
  assert.deepEqual(of('perf').map((p) => p.side), ['guest'], 'the guest leaving says hers');
  assert.equal(of('perf')[0].perf.net, null, 'under 20 s of snapshots: no word on them');
  until(() => x.h.shows('#mCard'), x.live, 40, 'the host\'s card (the race is hers: the guest gave it up)'); await settle(); run(2, ...x.live); await settle();
  assert.equal(of('perf').length, 1, 'the host measured nothing: nothing from it');
});
