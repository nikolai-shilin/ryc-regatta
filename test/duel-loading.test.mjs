// A screen still loading a 1-on-1 race tells the other, already in the waiting room (public/game/duel-loading.js,
// started by /play's loader for ?match=; match-ui.js heardLoading): "Anna K. · loading the race · 70%" on the empty row,
// every second till it's loaded, then the socket closes; a word three seconds old, or the screen's own, is nothing.
// Run: node --test test/duel-loading.test.mjs
import { world, page, run, hub, CODE } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { tellLoading, myId, ME_KEY } = await import('../public/game/duel-loading.js');
const row = (s) => s.says('#mRoom .m-ppl');
let closed = 0, made = 0;
const net = () => { made++; return { channel: (t) => hub().channel(t), close() { closed++; } }; };
const anna = { url: 'u', key: 'k', name: 'Anna K.' };

async function hostAlone() {
  world(); closed = 0; made = 0;
  const h = await page('Host', { host: true });
  run(0.5, h);
  return h;
}

test('the host alone in the room hears the guest still loading, each second, until she is loaded', async () => {
  const h = await hostAlone();
  assert.match(row(h), /Waiting for a friend…/);
  let pct = 12;
  await tellLoading({ code: CODE, connect: async () => anna, net, id: 'annaid000001', pct: () => pct });
  run(1.1, h);
  assert.match(row(h), /Anna K\. · loading the race · 12%/);
  pct = 70; run(1.3, h);
  assert.match(row(h), /Anna K\. · loading the race · 70%/);
  pct = 100; run(1, h);
  assert.match(row(h), /Waiting for a friend…/, 'loaded: her row waits for her to come in');
  run(2, h);
  assert.equal(closed, 1, 'and the socket is closed');
});

test('a word three seconds old is nothing; so is the screen\'s own, or one without a number', async () => {
  const h = await hostAlone();
  const stop = await tellLoading({ code: CODE, connect: async () => anna, net, id: 'annaid000001', pct: () => 40 });
  run(1.1, h);
  assert.match(row(h), /loading the race · 40%/);
  stop(); run(3.5, h);
  assert.match(row(h), /Waiting for a friend…/);
  const own = JSON.parse(h.ls.getItem(ME_KEY));
  await tellLoading({ code: CODE, connect: async () => anna, net, id: own, pct: () => 40 });
  run(1.1, h);
  assert.match(row(h), /Waiting for a friend…/);
  const ch = hub().channel('match:' + CODE); await ch.join();
  for (const p of [{ id: 'x1234567', pct: 'lots' }, { id: 'x1234567' }, null, { pct: 50 }]) ch.send('loading', p);
  run(0.3, h);
  assert.match(row(h), /Waiting for a friend…/);
});

test('nothing is said for a code that isn\'t one, or without the site\'s address; it stops after a minute', async () => {
  const h = await hostAlone();
  for (const [code, connect] of [['nope', async () => anna], [CODE, async () => null], [CODE, async () => { throw new Error('offline'); }]]) await tellLoading({ code, connect, net, id: 'annaid000001', pct: () => 5 });
  assert.equal(made, 0);
  await tellLoading({ code: CODE, connect: async () => anna, net, id: 'annaid000001', pct: () => 5 });
  run(64, h);
  assert.equal(closed, 1, 'a screen stuck loading stops telling after a minute');
});

test('the id is the one this device keeps for its 1-on-1 races, made and kept here if it has none', () => {
  const ls = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; } };
  const a = myId(ls);
  assert.match(a, /^[a-z0-9]{8,24}$/);
  assert.equal(JSON.parse(ls.m[ME_KEY]), a);
  assert.equal(myId(ls), a);
  ls.m[ME_KEY] = JSON.stringify('BAD id!'); assert.notEqual(myId(ls), 'BAD id!');
});

test('/play\'s loader gives its share and starts it for a 1-on-1 race only', () => {
  const play = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
  assert.match(play, /window\.rycLoadPct = p;/);
  assert.match(play, /if \(\/\[\?&\]match=\[A-Za-z0-9\]\{6\}\(&\|\$\)\/\.test\(location\.search\)\) import\('\/game\/duel-loading\.js'\)/);
  for (const lang of ['de', 'es', 'fr', 'it', 'pt', 'tr']) assert.match(readFileSync(new URL(`../public/game/strings-${lang}.js`, import.meta.url), 'utf8'), /loadingPct: \(w, p\) =>/, lang);
});
