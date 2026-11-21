// The sailing dictionary's scenes while they load: the bar along the top and the words on the water, until the scene's
// first frame is up (components/word-scene.tsx, components/dictionary-screen.tsx). npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { done, fromFrame, h, mount, reset, tick } from './fake-dom.mjs';

const { WordScene } = await import('../components/word-scene.tsx');
const { DictionaryScreen } = await import('../components/dictionary-screen.tsx');

beforeEach(() => { reset(); globalThis.CSS ??= { escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`) }; });
afterEach(done);

const W = { title: 'Sailing dictionary', back: 'Back', find: 'Find a word', clear: 'Clear', topics: 'Topics', all: 'All', allGroups: 'All groups',
  notShown: 'Not shown', notIn: 'Not in', none: 'Nothing', page: 'Its page', scene: 'The words on the water in 3D', more: 'More', links: [] };
const GROUPS = [{ id: 'courses', title: 'Courses', terms: [{ id: 'beat', term: 'Beat', def: 'Sailing towards the wind.' }] }];
const on = (el) => /\bon\b/.test(el.className);

test('a word’s picture says it is loading the water until the scene’s first frame, then fades it in', async () => {
  const v = await mount(h(WordScene, { lang: 'en', word: 'tack', title: 'Tack, on the water in 3D' }));
  assert.ok(!on(v.$('.wd-load')) && !on(v.$('.bc-load')), 'nothing loading before the scene starts');
  await tick(5);
  assert.equal(v.$('iframe').getAttribute('src'), '/word-view?w=tack&lang=en');
  assert.ok(on(v.$('.wd-load')) && on(v.$('.bc-load')));
  assert.equal(v.$('.wd-load').textContent, 'Loading the water');
  await fromFrame(v.$('iframe'), { type: 'live' });
  assert.ok(!on(v.$('.wd-load')) && !on(v.$('.bc-load')));
  assert.match(v.$('.wd-scene').className, /\blive\b/);
});

test('in Russian it says so in Russian', async () => {
  const v = await mount(h(WordScene, { lang: 'ru', word: 'tack', title: 'Поворот оверштаг' }));
  await tick(5);
  assert.equal(v.$('.wd-load').textContent, 'Загружаем акваторию');
});

test('the dictionary’s water says it is loading, in the open water beside the panel, until its first frame', async () => {
  const v = await mount(h(DictionaryScreen, { lang: 'en', groups: GROUPS, shown3d: ['beat'], w: W }));
  await tick(5);
  const load = v.$('.wd-load.dc-load');
  assert.ok(load && on(load) && on(v.$('.bc-load')));
  await fromFrame(v.$('iframe.dc-water'), { type: 'live' });
  assert.ok(!on(load) && !on(v.$('.bc-load')));
});
