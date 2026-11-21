// What follows a newcomer's first races: the hub's button once today's race has a time (components/hub-client.tsx
// TodayGo), the debrief's way to the drill for what to work on (lib/drills.ts drillLink, components/result-view.tsx) and
// the site's menu on the pages over a scene (components/scene-brand.tsx). Her first start: test/first-start.test.mjs.
// npm test.
import './load.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { done, h, mount, reset } from './fake-dom.mjs';

const { DEBRIEF_DRILL, DRILLS, drillLink } = await import('../lib/drills.ts');
const { TodayGo } = await import('../components/hub-client.tsx');
const { SceneBrand } = await import('../components/scene-brand.tsx');

beforeEach(() => reset());
afterEach(done);

// ---------- the hub's button ----------
test('the hub starts today\'s race until there\'s a time today, then asks you to beat it', async () => {
  const day = '2026-11-18';
  let v = await mount(h(TodayGo, { lang: 'en', day }));
  assert.equal(v.$('.bt-go').textContent, 'Start today’s race');
  assert.equal(v.$('.bt-go').getAttribute('href'), '/play?race=today');
  await v.unmount();
  localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${day}`]: 332.4, 'daily|2026-11-17': 290 }));
  v = await mount(h(TodayGo, { lang: 'en', day }));
  assert.equal(v.$('.bt-go').textContent, 'Beat your 5:32.4');
  await v.unmount();
  v = await mount(h(TodayGo, { lang: 'ru', day }));
  assert.equal(v.$('.bt-go').textContent, 'Побей своё 5:32.4');
  await v.unmount();
  v = await mount(h(TodayGo, { lang: 'en', day: '2026-11-19' }));
  assert.equal(v.$('.bt-go').textContent, 'Start today’s race', 'yesterday\'s time is not today\'s');
});

// ---------- the debrief's drills ----------
test('each part of the race the debrief can say to work on has a drill', () => {
  for (const id of Object.values(DEBRIEF_DRILL)) assert.ok(DRILLS.some((d) => d.id === id), id);
});

test('a drill\'s link goes to the drill when its level is open, else to the drills', () => {
  assert.deepEqual(drillLink('start', {}), { href: '/play?race=free&drill=start', name: DRILLS[0].name, min: 1, open: true });
  const beat = drillLink('beat', {});
  assert.equal(beat.open, false, 'a club drill, with no beginner stars yet');
  assert.equal(beat.href, '/race/drills');
  const stars = Object.fromEntries(DRILLS.filter((d) => d.level === 'beginner').map((d) => [d.id, 3]));
  assert.equal(drillLink('beat', stars).href, '/play?race=free&drill=beat');
  assert.equal(drillLink('nope', {}), null);
});

// ---------- the menu on the scene pages ----------
test('the pages over a scene have the site\'s menu by the name; the sign-in pages leave it out', () => {
  const withMenu = renderToStaticMarkup(createElement(SceneBrand, { lang: 'en' }));
  assert.match(withMenu, /<a href="\/" class="bt-brand">/);
  assert.ok(withMenu.includes('class="hm-menu"'), 'the menu');
  for (const p of ['/race', '/race/drills', '/race#board', '/players', '/venues', '/yachts', '/help']) assert.ok(withMenu.includes(`href="${p}"`), p);
  const plain = renderToStaticMarkup(createElement(SceneBrand));
  assert.ok(!plain.includes('hm-menu'));
});
