// Audio & graphics is the one place the picture and the sound are set (public/game/av-menu.js): the graphics choice it
// writes is what every 3D scene reads (public/game/gfx.js), and no other menu has controls of its own for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { GFX_KEY, GFX_LADDER, GFX_LEVELS, GFX_PARTS, autoEased, autoParts, autoTuner, defaultQuality, followSettings, gfxDetail, gfxLevel, gfxNow, gfxParts, lighterParts, raiseParts, saveAuto, shedParts, startQuality } = await import('../public/game/gfx.js');

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

test('Auto gives up what shows least first, and among those what frees the most', () => {
  assert.equal(GFX_LADDER.length, GFX_PARTS.length * 2, 'every part, both steps down');
  GFX_LADDER.forEach(([k, to], i) => {
    assert.ok(GFX_PARTS.includes(k) && to !== 'high', k);
    if (to === 'low') assert.ok(GFX_LADDER.findIndex((r) => r[0] === k && r[1] === 'medium') < i, `${k}: medium before low`);
    const n = GFX_LADDER[i + 1];
    if (n) assert.ok(n[4] > GFX_LADDER[i][4] || (n[4] === GFX_LADDER[i][4] && n[2] <= GFX_LADDER[i][2]), `${k} ${to} before ${n[0]} ${n[1]}`);
  });
  const high = gfxParts('high');
  assert.deepEqual(shedParts(high, 0.01, false), { ...high, land: 'medium' }, 'a small shortfall: the one step');
  const big = shedParts(high, 0.3, false);
  assert.equal(big.res, 'medium', 'a large one reaches the resolution');
  assert.equal(big.sea, 'medium');
  assert.equal(big.wakes, 'high', 'the wakes, which show, are kept');
  assert.equal(shedParts(gfxParts('low'), 0.5, false), null, 'nothing left to give');
});

test('a frame held up by the CPU gives up only what eases the CPU', () => {
  const p = shedParts(gfxParts('high'), 1, true);
  assert.equal(p.post, 'high', 'the glow is the GPU\'s work');
  assert.equal(p.shadows, 'low', 'the shadow pass is the CPU\'s');
  assert.equal(p.res, 'medium');
  assert.equal(shedParts(p, 1, true), null);
});

test('Auto brings back the last step it gave up, never past where the device starts', () => {
  const base = gfxParts('medium');
  assert.equal(raiseParts(base, base), null);
  const down = { ...base, under: 'low', land: 'low' };
  assert.deepEqual(raiseParts(down, base), { ...base, under: 'low' }, 'land went after the hulls, so it comes back first');
  assert.deepEqual(raiseParts({ ...base, under: 'low' }, base), base);
});

test('Auto sheds on slow frames, waits on steady ones, and backs off a step back that failed', () => {
  const base = gfxParts('high'), tune = autoTuner(base);
  let parts = base, got = null;
  const run = (secs, raw, busy = 0.004) => { got = null; for (let t = 0; t < secs; t += raw) { const n = tune(raw, busy, parts, false); if (n) { parts = n; got = n; } } return got; };
  assert.equal(run(6, 1 / 60), null, 'a steady 60 fps changes nothing');
  assert.ok(run(4, 1 / 30), 'a steady 30 fps gives something up');
  assert.notDeepEqual(parts, base);
  const eased = parts;
  assert.equal(run(30, 1 / 60), null, 'not back at once');
  assert.ok(run(20, 1 / 60), 'steady for 40 s, a step comes back');
  assert.notDeepEqual(parts, eased);
  assert.ok(run(6, 1 / 30), 'too much: given up again');
  assert.equal(run(100, 1 / 60), null, 'and the next try waits longer');
  assert.ok(run(30, 1 / 60), 'but it does come');
});

test('giving things up that buys no frames is undone: a phone held at 30 fps keeps its picture', () => {
  const base = gfxParts('high'), tune = autoTuner(base);
  let parts = base, changes = 0;
  const run = (secs, raw) => { for (let t = 0; t < secs; t += raw) { const n = tune(raw, 0.004, parts, false); if (n) { parts = n; changes++; } } };
  run(12, 1 / 30);
  assert.equal(changes, 2, 'two rounds of giving up');
  assert.notDeepEqual(parts, base);
  run(6, 1 / 30);
  assert.deepEqual(parts, base, 'no frames bought: all of it back');
  changes = 0;
  run(120, 1 / 30);
  assert.equal(changes, 0, 'and left alone at that rate');
  run(8, 1 / 15);
  assert.ok(changes > 0, 'frames much slower than that are a real shortfall again');
});

test('giving things up that does buy frames goes on until the frames hold', () => {
  const base = gfxParts('high'), tune = autoTuner(base);
  let parts = base;
  const frameOf = (p) => (1 / 30) * (1 - 0.5 * GFX_PARTS.filter((k) => p[k] !== 'high').length / GFX_PARTS.length);
  for (let t = 0; t < 60;) { const raw = frameOf(parts), n = tune(raw, 0.004, parts, false); t += raw; if (n) parts = n; }
  assert.ok(frameOf(parts) <= 1 / 45, 'it got there');
  assert.notDeepEqual(parts, base, 'and kept what it gave up');
  assert.equal(GFX_PARTS.every((k) => parts[k] === 'low'), false, 'without going further than it had to');
});

test('stalls say nothing about the frame rate', () => {
  const base = gfxParts('high'), tune = autoTuner(base);
  for (let i = 0; i < 2000; i++) assert.equal(tune(i % 50 ? 1 / 60 : 0.4, 0.004, base, false), null);
});

test('the battery saver\'s 30 fps is not slow', () => {
  const base = gfxParts('high'), tune = autoTuner(base);
  for (let i = 0; i < 600; i++) assert.equal(tune(1 / 30, 0.004, base, true), null);
});

test('what Auto gave up is remembered part by part, and every scene draws it', () => {
  store.clear();
  const mix = { ...gfxParts('high'), land: 'medium', post: 'medium' };
  saveAuto(mix);
  assert.deepEqual(autoParts(), mix);
  assert.deepEqual(gfxNow({ gfx: 'auto' }), ['custom', mix]);
  assert.deepEqual(gfxDetail({}), mix);
  assert.equal(startQuality({}), 'high', 'two parts down is still closest to High');
  assert.deepEqual(autoEased(mix), defaultQuality() === 'high' ? ['post', 'land'] : []);
  saveAuto(gfxParts(defaultQuality()));
  assert.equal(store.has(GFX_KEY), false, 'all back: nothing to remember');
  store.set(GFX_KEY, `medium|${Date.now()}`);
  assert.deepEqual(gfxNow({}), ['medium'], 'a level remembered from before still counts');
  store.set(GFX_KEY, `nonsense|${Date.now()}`);
  assert.deepEqual(autoParts(), gfxParts(defaultQuality()));
  assert.equal(gfxLevel(gfxParts('low')), 'low');
  assert.deepEqual(lighterParts({ ...gfxParts('high'), sea: 'low' }), { ...gfxParts('medium'), sea: 'low' });
  assert.deepEqual(GFX_LEVELS, ['high', 'medium', 'low']);
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

test('People on board: on until it is turned off, and every 3D view follows it at once', () => {
  const on = {}, shown = [];
  globalThis.addEventListener = (k, f) => { on[k] = f; };
  store.clear();
  followSettings({ setQuality() {}, setFigures: (v) => shown.push(v) });
  assert.deepEqual(shown, [true], 'nothing saved yet: the people are there');
  store.set('regatta', JSON.stringify({ figures: 0 }));
  on.storage({ key: 'regatta' });
  store.set('regatta', JSON.stringify({ figures: 1 }));
  on.storage({ key: 'regatta' });
  assert.deepEqual(shown, [true, false, true]);
  const menu = read('public/game/av-menu.js');
  assert.match(menu, /toggle\('figures', t\('People on board', 'Люди на борту', '[^']+'\), 1\)/, 'in the Graphics group, on by default');
  assert.match(read('lib/opts.ts'), /figures: 1,/, 'the site starts with it on');
  assert.match(read('public/game/main.js'), /'figures' in p\) world\.setFigures\(p\.figures !== 0\)/, 'the race hears of a change as it is made');
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
  for (const k of ['autoTrim', 'camera', 'guides']) assert.match(site, new RegExp(`'${k}'`));
  for (const a of ['data-trim="2"', 'data-pc="helm"', 'data-q="guides"']) assert.ok(play.includes(a), a);
  assert.doesNotMatch(site + play, /ghostSw|data-q="ghost"|'ghost'|game\/track\.js/);
  for (const f of ['components/pause-card.tsx', 'components/settings-form.tsx']) assert.match(read(f), /<SailingOpts lang=\{lang\} \/>/, f);
});
