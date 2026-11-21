// Quick chat in a 1-on-1 race (public/game/match-ui.js): four set phrases, no typing, on the waiting room's card and the
// race's, while the other sailor is there. A tap sends the phrase's number, at most every 3 s; the other screen says it as
// a toast in its own language, "Host: Good luck!". Anything else heard as a chat is nothing. Run: node --test test/one-on-one-chat.test.mjs
import { room, sailing, run, until, toFinish } from './one-on-one-screens.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const pageFetch = globalThis.fetch;
globalThis.fetch = (u, init) => (typeof u === 'string' && u.startsWith('/connect/') && u !== '/connect' ? Promise.resolve(u === '/connect/log' ? new Response(null, { status: 204 }) : Response.json(null)) : pageFetch(u, init));
const phrases = (s, card) => s.doc.body.querySelectorAll(`${card} .m-chat button`).map((b) => b.textContent);
const tap = (s, card, i) => s.doc.body.querySelectorAll(`${card} .m-chat button`)[i].click();
const chats = (s) => s.toasts.filter((x) => /: /.test(x));

test('the waiting room offers the four phrases once both are in it, and a tap reaches the other screen as a toast', async () => {
  const x = await room();
  run(1, x.h, x.g);
  assert.equal(x.h.shows('#mRoom .m-chat'), true); assert.equal(x.g.shows('#mRoom .m-chat'), true);
  assert.deepEqual(phrases(x.h, '#mRoom'), ['Good luck!', 'Nice start', 'Rematch?', 'GG']);
  tap(x.h, '#mRoom', 0);
  run(0.5, x.h, x.g);
  assert.deepEqual(chats(x.g), ['Host: Good luck!']);
  assert.deepEqual(chats(x.h), [], 'not told to herself');
  tap(x.g, '#mRoom', 0);
  run(0.5, x.h, x.g);
  assert.deepEqual(chats(x.h), ['Guest: Good luck!']);
});

test('a phrase at most every 3 s: a second tap at once sends nothing', async () => {
  const x = await room();
  run(1, x.h, x.g);
  tap(x.h, '#mRoom', 0); tap(x.h, '#mRoom', 3);
  run(1, x.h, x.g);
  assert.deepEqual(chats(x.g), ['Host: Good luck!']);
  run(3, x.h, x.g);
  tap(x.h, '#mRoom', 3);
  run(0.5, x.h, x.g);
  assert.deepEqual(chats(x.g), ['Host: Good luck!', 'Host: GG']);
});

test('alone in the room there is nobody to say it to: no phrases', async () => {
  const x = await room();
  x.g.gone(); run(12, x.h);
  assert.equal(x.h.shows('#mRoom .m-chat'), false);
});

test('after the race the card offers them too, and one reaches the other screen', async () => {
  const x = await sailing({ seed: 11 });
  const home = (b) => { toFinish(x.hr, b); until(() => b.done, x.both, 10); };
  home(x.H); run(1, ...x.both); home(x.G);
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard'), x.both, 40);
  run(1, ...x.both);
  assert.equal(x.g.shows('#mCard .m-chat'), true);
  tap(x.g, '#mCard', 3);
  run(0.5, ...x.both);
  assert.ok(chats(x.h).includes('Guest: GG'));
});

test('a chat heard with a number out of range, words instead, or from nobody in the race is nothing', async () => {
  const x = await room();
  run(1, x.h, x.g);
  const send = (p) => x.h.channels.find((c) => c.topic?.includes('all') || true).send('chat', p);
  for (const p of [{ id: 'x', k: 0 }, { id: x.h.match?.()?.hostId ?? 'h', k: 99 }, { k: 'Good luck!' }, null]) { try { send(p); } catch (e) {} }
  run(0.5, x.h, x.g);
  assert.deepEqual(chats(x.g), []);
});
