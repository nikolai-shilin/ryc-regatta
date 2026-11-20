// The first race's intro (public/play/index.html, the preloader's script, and public/ui/game.css #intro): a newcomer's
// first race opens on four cards, how the race goes, while the race loads behind them; the race goes in on Start once
// it's loaded, or by itself once it is if Start was pressed before. One who has raced goes straight in, as before.
// The preloader's own script runs here on the page's own markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reset, tick, settle, parseInto, dom } from './fake-game.mjs';

const PLAY = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
const BODY = PLAY.slice(PLAY.indexOf('<body>') + 6, PLAY.indexOf('</body>')).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
const LOADER = PLAY.match(/<script>\s*(\/\* The preloader runs before[\s\S]*?)<\/script>/)[1];

// the page opened at `search`, with `played` races behind it, on a phone (touch) or not; the preloader run on it
async function open(search, { played = 0, touch = false } = {}) {
  reset({ url: `https://updown.test/play${search}` });
  if (played) localStorage.setItem('regatta', JSON.stringify({ played }));
  dom.media['(pointer: coarse)'] = touch;
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

test('a newcomer’s first race opens on the intro: four cards with their drawings, the race held until Start', async () => {
  const p = await open('?race=first&lang=en');
  assert.equal(p.$('#intro').hidden, false);
  assert.ok(p.$('#loading').classList.contains('intro'), 'the loading screen’s own words under it are hidden');
  assert.equal(p.$('#iH').textContent, 'Four things before the gun');
  assert.deepEqual(p.$$('#iCards li b').map((b) => b.textContent), ['The course', 'Steering', 'The start', 'Right of way']);
  assert.equal(p.$$('#iCards li svg').length, 4);
  assert.match(p.$$('#iCards li p')[1].textContent, /← and →/, 'steering by the keys on a computer');
  assert.match(String(p.$('#iSkip').href), /race=today&nofirst/);
  assert.equal(p.$('#iStartT').textContent, 'Start the race');
  // loaded: the race doesn't go in by itself
  window.rycLoader.done(p.start);
  await tick(2000);
  assert.equal(p.started, 0, 'held for Start');
  assert.ok(p.$('#intro').classList.contains('ready'));
  assert.ok(!p.$('#loading').classList.contains('out'));
  p.$('#iStart').click();
  assert.equal(p.started, 1, 'Start puts the race in');
  assert.ok(p.$('#intro').classList.contains('out') && p.$('#loading').classList.contains('out'));
  await tick(600);
  assert.ok(p.$('#intro').hidden && p.$('#loading').hidden);
});

test('Start pressed before the race has loaded is kept: the race goes in by itself once it is', async () => {
  const p = await open('?race=first&lang=en', { touch: true });
  assert.match(p.$$('#iCards li p')[1].textContent, /thumb along the arc/, 'steering by the thumb on a phone');
  p.$('#iStart').click();
  assert.ok(p.$('#intro').classList.contains('go'));
  assert.equal(p.$('#iStartT').textContent, 'Starting as soon as it’s loaded');
  window.rycLoader.done(p.start);
  await tick(400);
  assert.equal(p.started, 1);
});

test('the intro speaks the page’s language', async () => {
  const p = await open('?race=first&lang=ru');
  assert.equal(p.$('#iH').textContent, 'Четыре вещи до старта');
  assert.equal(p.$('#iStartT').textContent, 'Начать гонку');
  const d = await open('?race=first&lang=de');
  assert.deepEqual(d.$$('#iCards li b').map((b) => b.textContent), ['Die Bahn', 'Steuern', 'Der Start', 'Vorfahrt']);
});

test('one who has raced goes straight in: no intro on ?race=first, nor in today’s race; ?intro shows it anyway', async () => {
  const p = await open('?race=first&lang=en', { played: 3 });
  assert.equal(p.$('#intro').hidden, true);
  window.rycLoader.done(p.start);
  await tick(800);
  assert.equal(p.started, 1, 'in by itself, as before');
  const today = await open('?race=today&lang=en', { played: 3 });
  assert.equal(today.$('#intro').hidden, true);
  const shown = await open('?race=first&intro&lang=en', { played: 3 });
  assert.equal(shown.$('#intro').hidden, false);
});

test('the race failing to load takes the intro away, so the failure and Try again are seen', async () => {
  const p = await open('?race=first&lang=en');
  window.rycLoader.fail('webgl: no context', 'No WebGL');
  assert.equal(p.$('#intro').hidden, true);
  assert.ok(!p.$('#loading').classList.contains('intro'));
  assert.ok(p.$('#loading').classList.contains('err'));
});
