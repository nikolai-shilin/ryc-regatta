// The game's entry (public/game/main.js) where it can't go on: no WebGL to be had (the preloader's failure says so, or
// with no preloader a line on the page), and a 1-on-1 race whose module doesn't load (a card with Try again and Leave).
// main.js is loaded three times on one page, each a module of its own address (?…), as a reload would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';
import { bootGame, freshPage } from './fake-game.mjs';

mock('public/game/match-ui.js', 'export async function startMatch() { throw new Error("the Realtime client didn’t load"); }\nexport function leaveMatch() {}');
const game = await bootGame({ search: '?debug', noGl: 2 });

test('no WebGL: the preloader says why, with what to do, and the game goes no further', () => {
  assert.match(String(game.error), /WebGL/);
  assert.equal(game.loader.failed.length, 1);
  const [{ why, say }] = game.loader.failed;
  assert.match(why, /^webgl: Error creating WebGL context/);
  assert.match(say, /graphics|WebGL|browser/i);
  assert.equal(game.loader.handed, 0);
  assert.equal(window.__rg, undefined);
});

test('no WebGL and no preloader: the page itself says so, readable on the dark page', async () => {
  delete window.rycLoader;
  await assert.rejects(import('../public/game/main.js?no-loader'), /WebGL/);
  const p = document.body.querySelector('p');
  assert.ok(p);
  assert.match(p.textContent, /graphics|WebGL|browser/i);
  assert.match(p.getAttribute('style'), /color:#fff/);
});

test('a 1-on-1 race whose module doesn’t load: a card, Try again reloads, Leave goes to the hub', async () => {
  freshPage('/play/?match=QWERTY&debug');
  await import('../public/game/main.js?match');
  await game.frames(5);
  assert.ok(game.$('#loading').hidden, 'no preloader: the page shows the race itself');
  const card = game.$('#matchFail');
  assert.ok(card, 'the card');
  assert.match(card.querySelector('h2').textContent, /\S/);
  assert.ok(game.dom.warnings.some((w) => /Realtime client/.test(w)));
  const [again, out] = card.querySelectorAll('button');
  assert.equal(again.textContent, 'Try again');
  again.click();
  assert.ok(location.assigned.includes('reload'));
  out.click();
  await game.frames(30, 20);
  assert.ok(location.assigned.includes('/race'), location.assigned.join(' '));
});
