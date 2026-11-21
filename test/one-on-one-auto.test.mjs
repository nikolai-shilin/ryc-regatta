// A race found by matchmaking (the site's /duel sends both sailors in, the host with ?auto): the host's screen presses Start
// itself once the guest is in the room, and only once. Without ?auto the host presses it, as ever.
// Run: node --test test/one-on-one-auto.test.mjs
import { page, world, run, until } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const pageFetch = globalThis.fetch;
globalThis.fetch = (u, init) => (typeof u === 'string' && u.startsWith('/connect/') && u !== '/connect' ? Promise.resolve(u === '/connect/log' ? new Response(null, { status: 204 }) : Response.json(null)) : pageFetch(u, init));

test('with ?auto the host\'s screen starts the race itself once the guest is in, and once', async () => {
  world({});
  const h = await page('Host', { host: true, search: '?match=ABC234&auto' });
  run(2, h);
  assert.ok(!h.match(), 'no guest yet: no race');
  const g = await page('Guest');
  until(() => h.match() && g.cur()?.G, [h, g], 15, 'the race starts by itself');
  assert.equal(h.match().state, 'race');
  const seed = h.match().start.seed;
  run(5, h, g);
  assert.equal(h.match().start.seed, seed, 'started once');
});

test('without ?auto the host presses Start, as ever', async () => {
  world({});
  const h = await page('Host', { host: true });
  const g = await page('Guest');
  run(5, h, g);
  assert.ok(!h.match(), 'not started without a press');
  h.press('.m-start');
  until(() => h.match(), [h, g], 5);
  assert.equal(h.match().state, 'race');
});
