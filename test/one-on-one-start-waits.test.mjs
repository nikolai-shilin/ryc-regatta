// Before the gun, the start waits for both screens (public/game/match.js Host.tick, START_WAIT_MS; match-ui.js): a screen
// gone quiet (a phone flipped to Telegram, say) stops the start sequence, its clock too, and each screen says "<name> stepped
// away · the start waits · 0:24". Back within the minute, the sequence goes on where it stood; gone longer, the race is
// abandoned, the one who left named on both screens, before the gun: nothing counts. After the gun the 30 s forfeit stands.
// Run: node --test test/one-on-one-start-waits.test.mjs
import { sailing, run, CODE } from './one-on-one-screens.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const START_WAIT_MS = (await import('../public/game/match.js')).START_WAIT_MS;
const pageFetch = globalThis.fetch;
let posts = [];
globalThis.fetch = (u, init) => {
  if (u === '/connect/log') { posts.push({ body: JSON.parse(init.body), loc: location }); return Promise.resolve(new Response(null, { status: 204 })); }
  if (typeof u === 'string' && u.startsWith('/connect/')) return Promise.resolve(Response.json(null));
  return pageFetch(u, init);
};
beforeEach(() => { posts = []; });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const ends = () => posts.filter((p) => p.body.kind === 'end').map((p) => p.body);
const banner = (s) => (s.shows('#mBanner') ? s.says('#mBanner') : '');
const quiet = (s) => { s.mute = (e) => e === 'input'; }; // her controls stop coming: the phone in another app
const back = (s) => { s.mute = null; };

test('the start waits one minute for a guest gone quiet: the clock stands, and the host is told who and how long', async () => {
  const x = await sailing({ seed: 11, gun: false });
  run(2, ...x.both);
  const c0 = x.hr.clock;
  assert.ok(c0 < 0, 'before the gun');
  quiet(x.g);
  run(5, ...x.both);
  const c1 = x.hr.clock;
  run(20, ...x.both);
  assert.equal(x.hr.clock, c1, 'the start sequence stands still');
  assert.match(banner(x.h), /^Guest stepped away · the start waits · 0:3\d$/);
  assert.equal(x.hr.over, false, 'no forfeit before the gun, even past 30 s');
  run(15, ...x.both);
  assert.equal(x.hr.over, false); assert.equal(x.h.match().state, 'race');
});

test('back within the minute, the sequence goes on where it stood, and nothing was lost', async () => {
  const x = await sailing({ seed: 11, gun: false });
  run(2, ...x.both);
  quiet(x.g);
  run(30, ...x.both);
  const stood = x.hr.clock;
  back(x.g);
  run(3, ...x.both);
  assert.ok(x.hr.clock > stood, 'the clock moves again');
  assert.equal(banner(x.h), '');
  assert.equal(x.h.match().state, 'race');
});

test('gone past the minute: the race is abandoned before the gun on both screens, the guest the one who left, and nothing counts', async () => {
  const x = await sailing({ seed: 11, gun: false });
  run(2, ...x.both);
  quiet(x.g);
  run((START_WAIT_MS + 3000) / 1000 + 2, ...x.both);
  await settle(); run(2, ...x.both); await settle();
  assert.equal(x.h.match().state, 'over'); assert.equal(x.h.match().result.abandoned, true);
  assert.equal(x.g.match().state, 'over', 'her screen has it from the host');
  const [host] = ends().filter((e) => e.side === 'host'), [guest] = ends().filter((e) => e.side === 'guest');
  assert.deepEqual([host.state, host.left, host.gun], ['abandoned', 'guest', false]);
  assert.deepEqual([guest?.state, guest?.left, guest?.gun], ['abandoned', 'guest', false]);
  assert.equal(host.code, CODE);
});

test('after the gun, a guest gone quiet still drops out after 30 s: the start waits, the race doesn\'t', async () => {
  const x = await sailing({ seed: 11, gun: true });
  quiet(x.g);
  run(31, ...x.both);
  assert.equal(x.hr.over, true);
  assert.equal(x.hr.forfeited?.id, x.G.id);
});

test('a host gone quiet before the gun: the guest is told, waits the minute and a little more, then the race is over, the host the one who left', async () => {
  const x = await sailing({ seed: 11, gun: false });
  run(2, ...x.both);
  x.gr.clock = x.hr.clock; // (her copy of the race at the host's clock, before the gun)
  x.h.mute = () => true; // the host's screen says nothing more: its tab gone to sleep
  run(10, x.g);
  assert.match(banner(x.g), /^Host stepped away · the start waits · 0:5\d$/);
  run(START_WAIT_MS / 1000, x.g);
  await settle(); run(1, x.g); await settle();
  assert.equal(x.g.match().state, 'over');
  const [guest] = ends().filter((e) => e.side === 'guest');
  assert.deepEqual([guest?.state, guest?.left], ['abandoned', 'host']);
});
