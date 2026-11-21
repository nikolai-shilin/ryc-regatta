// A first 1-on-1's intro (public/play/index.html, the preloader's script, beside the first race's: test/play-intro.test.mjs):
// four cards while the race loads, the order panel, leaving, what it's worth and the rematch, drawn as the HUD's pieces,
// shown once on a device, Start going on to the race. The preloader's own script runs here on the page's own markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reset, tick, settle, parseInto, dom } from './fake-game.mjs';

const PLAY = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
const BODY = PLAY.slice(PLAY.indexOf('<body>') + 6, PLAY.indexOf('</body>')).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
const LOADER = PLAY.match(/<script>\s*(\/\* The preloader runs before[\s\S]*?)<\/script>/)[1];

// the page opened at `search`, with `played` races behind it and the 1-on-1 cards seen or not; the preloader run on it
async function open(search, { played = 3, seen = false } = {}) {
  reset({ url: `https://updown.test/play${search}` });
  if (played) localStorage.setItem('regatta', JSON.stringify({ played }));
  if (seen) localStorage.setItem('regatta-duel-intro', '1');
  dom.media['(pointer: coarse)'] = false;
  globalThis.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };
  globalThis.screen = { width: 390, height: 844 };
  globalThis.fetch = async () => new Response('{}');
  document.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]) };
  while (document.body.firstChild) document.body.firstChild.remove(); // (one page a test)
  parseInto(document.body, BODY);
  new Function(LOADER)();
  await settle();
  let started = 0;
  return { $: (s) => document.querySelector(s), $$: (s) => [...document.querySelectorAll(s)], start: () => { started++; }, get started() { return started; } };
}

test('a first 1-on-1 opens on its own four cards, held until Start, which goes on to the race', async () => {
  const p = await open('?match=K7M2QZ&lang=en');
  assert.equal(p.$('#intro').hidden, false);
  assert.equal(p.$('#iH').textContent, 'Four things before your first 1-on-1');
  assert.deepEqual(p.$$('#iCards li b').map((b) => b.textContent), ['The order panel', 'Leaving', 'What it’s worth', 'Rematch']);
  assert.equal(p.$$('#iCards li svg').length, 4);
  const [order, leave, worth] = p.$$('#iCards svg');
  assert.match(order.textContent, /1YOU24 M2ANNA\+6\.1 S/, 'the two rows of the order panel, with the gap');
  assert.equal(leave.querySelector('.m-gn').textContent, '0:59', 'the start waiting, on the gun clock');
  assert.match(worth.textContent, /\+33.*−31/, 'what a first race is worth');
  assert.match(p.$$('#iCards li p')[1].textContent, /Before the gun the start waits a minute/);
  assert.equal(p.$('#iSkip').hidden, true, 'nothing to skip to: the friend is in this race');
  assert.equal(p.$('#iStartT').textContent, 'On to the race');
  window.rycLoader.done(p.start);
  await tick(2000);
  assert.equal(p.started, 0, 'held for Start');
  assert.equal(p.$('#iStartT').textContent, 'On to the race', 'its own label once loaded');
  p.$('#iStart').click();
  await tick(200);
  assert.equal(p.started, 1);
});

test('the 1-on-1 cards are remembered once shown; seen, the race goes in as before; ?intro shows them again', async () => {
  await open('?match=K7M2QZ&lang=en');
  assert.equal(localStorage.getItem('regatta-duel-intro'), '1', 'remembered as they are shown');
  const seen = await open('?match=K7M2QZ&lang=en', { seen: true });
  assert.equal(seen.$('#intro').hidden, true);
  const forced = await open('?match=K7M2QZ&intro&lang=en', { seen: true });
  assert.equal(forced.$('#intro').hidden, false);
});

test('a first race keeps its own cards, and today\'s race none', async () => {
  const first = await open('?race=first&lang=en', { played: 0 });
  assert.equal(first.$('#iH').textContent, 'Four things before the gun');
  const today = await open('?race=today&lang=en');
  assert.equal(today.$('#intro').hidden, true);
});

test('the 1-on-1 cards speak the page\'s language', async () => {
  const ru = await open('?match=K7M2QZ&lang=ru');
  assert.equal(ru.$('#iH').textContent, 'Четыре вещи перед первой гонкой 1 на 1');
  const pt = await open('?match=K7M2QZ&lang=pt');
  assert.deepEqual(pt.$$('#iCards li b').map((b) => b.textContent), ['O painel de ordem', 'Sair', 'O que vale', 'Revanche']);
});
