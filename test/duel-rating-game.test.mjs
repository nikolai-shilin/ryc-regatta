// The rating on the game's card after a 1-on-1 race (public/game/match-ui.js askRating, paintRating): the two real screens
// of one-on-one-screens.mjs, GET /connect/rating answered by the test. Each screen asks once the race is over, again every
// 4 s while the answer is "waiting", for 90 s at the most, and puts the line on its card, green for a gain and orange for a
// loss. Each keeps its record with the race's code and seed, for the result page. Run: node --test test/duel-rating-game.test.mjs
import { sailing, run, until, toFinish, CODE, clock } from './one-on-one-screens.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const pageFetch = globalThis.fetch;
let asked = [], answer = () => ({ status: 'none', line: null });
globalThis.fetch = (u, init) => {
  if (typeof u === 'string' && u.startsWith('/connect/rating')) { asked.push({ u, loc: location, at: clock.t }); try { return Promise.resolve(Response.json(answer(u, location))); } catch (e) { return Promise.reject(e); } }
  if (u === '/connect/log') return Promise.resolve(new Response(null, { status: 204 }));
  return pageFetch(u, init);
};
beforeEach(() => { asked = []; answer = () => ({ status: 'none', line: null }); });

const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const pass = async (secs, ...pages) => { for (let t = 0; t < secs; t += 0.5) { run(0.5, ...pages); await settle(); } };
const home = (x, b) => { toFinish(x.hr, b); until(() => b.done, x.both, 10, `${b.name} is home`); };
// both home, the host first, and on to both cards; each screen's records mirrored into its storage, as main.js keeps them
const raced = async () => {
  const x = await sailing({ seed: 11 });
  x.h.loc.isHost = true;
  for (const s of x.both) s.records.push = function (res) { s.ls.setItem('regatta-result-' + res.id, JSON.stringify(res)); return Array.prototype.push.call(this, res); };
  home(x, x.H); run(1, ...x.both); home(x, x.G);
  await settle();
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard'), x.both, 40, 'both cards');
  await settle();
  return x;
};
const rate = (s) => ({ text: s.says('#mCard .m-rate'), shown: s.shows('#mCard .m-rate'), cls: s.$('#mCard .m-rate')?.className ?? '' });

test('each screen asks after its own race, in its language, and shows the line: green for the winner, orange for the other', async () => {
  answer = (u, loc) => (loc.isHost
    ? { status: 'rated', me: { delta: 18 }, line: '1-on-1 rating 1558 (+18) · Fleet' }
    : { status: 'rated', me: { delta: -18 }, line: '1-on-1 rating 1567 (−18) · Fleet' });
  const x = await raced();
  await pass(1, ...x.both);
  assert.ok(asked.some((a) => a.loc === x.h.loc) && asked.some((a) => a.loc === x.g.loc), 'both asked');
  for (const a of asked) assert.equal(a.u, `/connect/rating?code=${CODE}&seed=11&lang=en`);
  await pass(5, ...x.both); // (an answer that isn't "waiting" is the last: no second ask)
  assert.deepEqual(rate(x.h), { text: '1-on-1 rating 1558 (+18) · Fleet', shown: true, cls: 'm-rate up' });
  assert.deepEqual(rate(x.g), { text: '1-on-1 rating 1567 (−18) · Fleet', shown: true, cls: 'm-rate down' });
});

test('"waiting" is asked again every 4 s, and the answer that follows it stands', async () => {
  let n = 0;
  answer = () => (++n <= 4 ? { status: 'waiting', line: '1-on-1 rating: waiting for both screens…' } : { status: 'rated', me: { delta: 18 }, line: '1-on-1 rating 1558 (+18) · Fleet' });
  const x = await raced();
  const host = () => asked.filter((a) => a.loc === x.h.loc);
  await pass(1, x.h);
  assert.equal(rate(x.h).text, '1-on-1 rating: waiting for both screens…');
  await pass(20, x.h);
  assert.equal(rate(x.h).text, '1-on-1 rating 1558 (+18) · Fleet');
  const at = host().map((a) => a.at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 4000 && at[i] - at[i - 1] <= 4600, `4 s apart (${at[i] - at[i - 1]} ms)`);
  const done = host().length;
  await pass(20, x.h);
  assert.equal(host().length, done, 'asked no more once rated');
});

test('a race never rated is asked after for 90 s, then no more', async () => {
  answer = () => ({ status: 'waiting', line: 'w' });
  const x = await raced();
  await pass(100, x.h);
  const n = asked.filter((a) => a.loc === x.h.loc).length;
  assert.ok(n >= 20 && n <= 24, `about one ask in 4 s for 90 s (${n})`);
  await pass(30, x.h);
  assert.equal(asked.filter((a) => a.loc === x.h.loc).length, n);
});

test('nothing to say, or the site down: the card has no rating line, and the race\'s card is as before', async () => {
  const x = await raced();
  await pass(2, ...x.both);
  assert.equal(rate(x.h).shown, false); assert.equal(rate(x.g).shown, false);
  answer = () => { throw new Error('down'); };
  const y = await raced();
  await pass(2, ...y.both);
  assert.equal(rate(y.h).shown, false);
  assert.ok(y.h.shows('#mCard .m-go'), 'the rematch is offered as ever');
});

test('each screen\'s record names its race, for the result page to ask after its rating', async () => {
  const x = await raced();
  for (const s of x.both) {
    const [res] = s.records;
    assert.ok(res, `${s.name} kept a record`);
    const { token, ...duel } = JSON.parse(s.ls.getItem('regatta-result-' + res.id)).duel;
    assert.deepEqual(duel, { code: CODE, seed: 11 });
    if (s === x.h) assert.equal(token, undefined, 'the host\'s has no token'); else assert.match(token, /^[0-9a-f]{64}$/, 'the guest\'s keeps hers, to keep the race');
  }
});
