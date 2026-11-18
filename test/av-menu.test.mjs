// Audio & graphics is the one place the picture and the sound are set (public/game/av-menu.js): the graphics choice it
// writes is what every 3D scene reads (public/game/gfx.js), and no other menu has controls of its own for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { GFX_KEY, GFX_PARTS, defaultQuality, followSettings, gfxDetail, gfxParts, startQuality } = await import('../public/game/gfx.js');

test('a level chosen is the level drawn, and Custom draws its own parts', () => {
  assert.equal(startQuality({ gfx: 'low' }), 'low');
  assert.equal(startQuality({ gfx: 'custom' }), 'custom');
  assert.deepEqual(gfxDetail({ gfx: 'medium' }), gfxParts('medium'));
  const d = gfxDetail({ gfx: 'custom', gfxD: { shadows: 'low', sea: 'nonsense' } });
  assert.equal(d.shadows, 'low');
  assert.equal(d.sea, 'high', 'a part not known draws High');
  assert.deepEqual(Object.keys(d), GFX_PARTS);
});

test("Auto starts at this device's level, or the step down it remembers for three days", () => {
  store.clear();
  assert.equal(startQuality({ gfx: 'auto' }), defaultQuality());
  assert.equal(startQuality({}), defaultQuality(), 'nothing saved yet is Auto');
  store.set(GFX_KEY, `low|${Date.now()}`);
  assert.equal(startQuality({ gfx: 'auto' }), 'low');
  store.set(GFX_KEY, `low|${Date.now() - 4 * 864e5}`);
  assert.equal(startQuality({ gfx: 'auto' }), defaultQuality());
  assert.equal(store.has(GFX_KEY), false, 'an old step down is forgotten');
});

test('a view draws the level chosen, follows a change, and lets frames go on the battery saver', () => {
  store.clear();
  store.set('regatta', JSON.stringify({ gfx: 'low' }));
  const calls = [], on = {};
  globalThis.addEventListener = (k, f) => { on[k] = f; };
  const skip = followSettings({ setQuality: (q) => calls.push(q) });
  assert.deepEqual(calls, ['low']);
  assert.equal(skip(0), false);
  assert.equal(skip(8), false, 'no saver: every frame is drawn');
  store.set('regatta', JSON.stringify({ gfx: 'medium', saver: 1 }));
  on.storage({ key: 'regatta' });
  assert.deepEqual(calls, ['low', 'medium']);
  assert.equal(skip(1000), false);
  assert.equal(skip(1016), true, 'the saver: the frame between is let go');
  assert.equal(skip(1033), false);
});

test('every 3D view follows the settings, none sets its own level', () => {
  for (const v of ['boat-view', 'fleet-view', 'hero-view', 'venue-view', 'venues-view']) {
    const html = read(`public/${v}/index.html`);
    assert.match(html, /followSettings\(world\)/, v);
    assert.match(html, /if \(skipFrame\(now\)\) return;/, v);
    assert.doesNotMatch(html, /setQuality\(/, v);
  }
});

test('the other menus only lead to Audio & graphics', () => {
  const play = read('public/play/index.html');
  assert.doesNotMatch(play, /data-(g|mu|mv|sea)="|data-q="(sound|voice|saver)"|data-opt="(gfx|saver|sound)"/);
  assert.match(play, /id="pAv"/);
  for (const f of ['components/pause-card.tsx', 'components/settings-form.tsx', 'components/sailing-opts.tsx']) {
    assert.doesNotMatch(read(f), /'(gfx|music|musicVol|sea|saver|sound|voice|vibration)'/, f);
  }
});

test('the sailing options are the same in every menu', () => {
  const site = read('components/sailing-opts.tsx'), play = read('public/play/index.html');
  for (const k of ['autoTrim', 'camera', 'guides', 'ghost']) assert.match(site, new RegExp(`'${k}'`));
  for (const a of ['data-trim="2"', 'data-pc="helm"', 'data-q="guides"', 'data-q="ghost"']) assert.ok(play.includes(a), a);
  for (const f of ['components/pause-card.tsx', 'components/settings-form.tsx']) assert.match(read(f), /<SailingOpts lang=\{lang\} \/>/, f);
});
