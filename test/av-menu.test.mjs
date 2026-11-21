// Audio & graphics is the one place the picture and the sound are set (public/game/av-menu.js): the graphics choice it
// writes is what every 3D scene reads (public/game/gfx.js), and no other menu has controls of its own for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { GFX_KEY, GFX_LADDER, GFX_LEVELS, GFX_PARTS, LOWEST_TIP_DAYS, LOWEST_TIP_KEY, RES_BELOW, autoEased, autoParts, autoScale, autoTuner, defaultQuality, followSettings, gfxDetail, gfxLevel, gfxNow, gfxParts, gfxScale, lighterParts, lowestTipDue, lowestTipShown, raiseParts, saveAuto, shedParts, slowWatch, startQuality } = await import('../public/game/gfx.js');

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

test('at 10 fps it goes on giving things up though the first steps buy nothing, down to Low', () => {
  const base = gfxParts('medium'), tune = autoTuner(base);
  let parts = base;
  // a laptop whose frames come only once nearly everything is low, and only some seconds after each change (its
  // shaders compiling again, slowly): the first rounds seem to buy nothing
  let since = 0;
  const frameOf = (p) => (since > 8 && GFX_PARTS.filter((k) => p[k] === 'low').length >= GFX_PARTS.length - 1 ? 1 / 30 : 1 / 10);
  // and whose frames keep the CPU busy (Windows draws through ANGLE onto Direct3D: the GL calls are CPU time), so it looks CPU-bound
  for (let t = 0; t < 90;) { const raw = frameOf(parts), n = tune(raw, raw * 0.9, parts, false); t += raw; since += raw; if (n) { parts = n; since = 0; } }
  assert.equal(frameOf(parts), 1 / 30, 'it got down to where the frames come');
  assert.notDeepEqual(parts, base, 'and kept it');
});

test('at 12 fps, each round buying a little, it goes on past the CPU\'s steps down to Low', () => {
  // the laptop of 19 Nov (Intel UHD, Windows, 1950 × 1124): every part given up bought a few per cent, never enough. Each
  // round's few per cent read as "that helped", the next round looked CPU-bound again (ANGLE), the CPU's steps were all
  // gone, and Auto stopped on Medium for nine races at 8.5–12 fps
  const base = gfxParts('high'), tune = autoTuner(base);
  let parts = gfxParts('medium');
  const lows = (p) => GFX_PARTS.filter((k) => p[k] === 'low').length;
  const frameOf = (p) => (1 / 12) * (1 - 0.06 * lows(p));
  for (let t = 0; t < 120;) { const raw = frameOf(parts), n = tune(raw, raw * 0.95, parts, false); t += raw; if (n) parts = n; }
  assert.equal(gfxLevel(parts), 'low', 'it got to Low');
  assert.ok(lows(parts) >= GFX_PARTS.length - 1, 'with the GPU\'s steps given up too');
});

test('at 30 fps on a 60 Hz screen, a Windows laptop goes on past the CPU\'s steps down to where it draws 60', () => {
  // the laptops of the week to 21 Nov: Windows draws through ANGLE onto Direct3D, so the GPU's work is CPU time and the
  // frame looks CPU-bound; and a frame shows only at the screen's refresh, so 19 ms of work comes at 30 fps like 30 ms
  // does. Auto gave up the CPU's steps, which bought no frames, and kept the rest: Medium at 30 for whole races
  const rank = { high: 0, medium: 1, low: 2 };
  const work = (p) => (2.5 * (13.3 - GFX_LADDER.reduce((s, [k, to, ms]) => s + (rank[p[k]] >= rank[to] ? ms : 0), 0))) / 1000;
  const shown = (p) => Math.ceil(work(p) * 60 - 1e-9) / 60;
  for (const start of ['high', 'medium']) {
    const base = gfxParts(start), tune = autoTuner(base);
    let parts = base;
    for (let t = 0; t < 300;) { const raw = shown(parts), n = tune(raw, work(parts), parts, false); t += raw; if (n) parts = n; }
    assert.equal(shown(parts), 1 / 60, `from ${start}: it got to 60 fps`);
    assert.equal(gfxLevel(parts), 'low', `from ${start}: on Low`);
  }
});

test('a 30 fps frame that nothing eases gets its picture back', () => {
  // held at 30 whatever it's given and busy all the while (a CPU at its limit, or a rate cap): the CPU's steps, then the
  // GPU's, buy nothing, and the picture comes back as it was
  const base = gfxParts('high'), tune = autoTuner(base);
  let parts = base, changes = 0;
  for (let t = 0; t < 300;) { const raw = 1 / 30, n = tune(raw, raw * 0.95, parts, false); t += raw; if (n) { parts = n; changes++; } }
  assert.deepEqual(parts, base, 'back to where it started');
  assert.ok(changes <= 3, 'and left there');
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

test('below Low, Auto draws fewer pixels: 0.8 of Low\'s resolution, then 0.65, while the frames stay under 24 fps', () => {
  // the laptops of 19–20 Nov (Intel HD 620, UHD): 15–20 fps with every part already Low, held up by the pixels drawn
  const tune = autoTuner(gfxParts('high'));
  let parts = gfxParts('low');
  const frameOf = (p) => (1 / 10) * (0.3 + 0.7 * (p.scale ?? 1) ** 2);
  const seen = [];
  for (let t = 0; t < 120;) { const raw = frameOf(parts), n = tune(raw, raw * 0.95, parts, false); t += raw; if (n) { parts = n; seen.push(n.scale); } }
  assert.deepEqual(seen, RES_BELOW, 'one step, then the next, and no further');
  assert.ok(GFX_PARTS.every((k) => parts[k] === 'low'), 'the parts stay as they were');
});

test('the resolution goes below Low only once every part is Low', () => {
  const tune = autoTuner(gfxParts('high'));
  let parts = gfxParts('medium');
  const lows = (p) => GFX_PARTS.filter((k) => p[k] === 'low').length;
  const frameOf = (p) => (1 / 9) * (1 - 0.04 * lows(p)) * (0.3 + 0.7 * (p.scale ?? 1) ** 2);
  let scaled = false;
  for (let t = 0; t < 150;) {
    const raw = frameOf(parts), n = tune(raw, raw * 0.95, parts, false); t += raw;
    if (!n) continue;
    if ((n.scale ?? 1) < 1 && !scaled) { scaled = true; assert.equal(lows(parts), GFX_PARTS.length, 'every part was Low before it'); }
    parts = n;
  }
  assert.ok(scaled, 'and then it went below');
});

test('a step below Low that buys nothing is undone, and not tried again', () => {
  // a phone held up by its CPU (an iPhone at 24 fps on Low): fewer pixels change nothing
  const tune = autoTuner(gfxParts('medium'));
  let parts = gfxParts('low');
  const seen = [];
  for (let t = 0; t < 180;) { const raw = 1 / 20, n = tune(raw, raw * 0.95, parts, false); t += raw; if (n) { parts = n; seen.push(n.scale); } }
  assert.deepEqual(seen, [RES_BELOW[0], 1]);
});

test('over 24 fps the resolution never goes below Low', () => {
  const tune = autoTuner(gfxParts('high'));
  let parts = gfxParts('low');
  for (let t = 0; t < 120;) { const raw = 1 / 30, n = tune(raw, raw * 0.95, parts, false); t += raw; if (n) parts = n; }
  assert.equal(parts.scale ?? 1, 1);
});

test('steady again, the resolution below Low is the first thing back', () => {
  const base = gfxParts('high'), low = gfxParts('low');
  assert.deepEqual(raiseParts({ ...low, scale: RES_BELOW[1] }, base), { ...low, scale: RES_BELOW[0] });
  assert.deepEqual(raiseParts({ ...low, scale: RES_BELOW[0] }, base), { ...low, scale: 1 });
  assert.deepEqual(raiseParts({ ...low, scale: 1 }, base), { ...low, scale: 1, wakes: 'medium' }, 'then the parts, as before');
  const tune = autoTuner(base);
  let parts = { ...low, scale: RES_BELOW[1] };
  const seen = [];
  for (let t = 0; t < 200 && seen.length < 3;) { const raw = 1 / 60, n = tune(raw, 0.004, parts, false); t += raw; if (n) { parts = n; seen.push(n.scale); } }
  assert.deepEqual(seen.slice(0, 2), [RES_BELOW[0], 1]);
});

test('the resolution below Low is remembered with the parts, for Auto alone: no level and no Custom draws it', () => {
  store.clear();
  saveAuto({ ...gfxParts('low'), scale: 0.65 });
  assert.match(store.get(GFX_KEY), /^lllllllll@0\.65\|\d+$/);
  assert.equal(autoScale(), 0.65);
  assert.deepEqual(autoParts(), gfxParts('low'), 'the parts as ever, no scale among them');
  assert.deepEqual(gfxNow({ gfx: 'auto' }), ['low']);
  assert.deepEqual(gfxDetail({}), gfxParts('low'), 'Custom, begun from what Auto draws, starts without it');
  assert.equal(gfxScale({}), 0.65);
  assert.equal(gfxScale({ gfx: 'auto' }), 0.65);
  for (const g of ['low', 'medium', 'high', 'custom']) assert.equal(gfxScale({ gfx: g }), 1, g);
  store.set(GFX_KEY, `lllllllll|${Date.now()}`);
  assert.equal(autoScale(), 1, 'remembered before it was: full resolution');
  for (const bad of ['0.3', 'x', '1', '']) { store.set(GFX_KEY, `lllllllll@${bad}|${Date.now()}`); assert.equal(autoScale(), 1, bad); assert.deepEqual(autoParts(), gfxParts('low')); }
  store.set(GFX_KEY, `lllllllll@0.8|${Date.now() - 4 * 864e5}`);
  assert.equal(autoScale(), 1, 'three days on, tried again from the top');
  saveAuto({ ...gfxParts(defaultQuality()), scale: 1 });
  assert.equal(store.has(GFX_KEY), false, 'all back: nothing to remember');
  saveAuto({ ...gfxParts('low') });
  assert.match(store.get(GFX_KEY), /^lllllllll\|\d+$/, 'no scale: none written');
});

test('Lowest draws every part Low at the resolution below Low Auto goes to last, whatever Auto remembers', () => {
  store.clear();
  store.set(GFX_KEY, `mmmmmmmmm@0.8|${Date.now()}`);
  assert.deepEqual(gfxNow({ gfx: 'lowest' }), ['low']);
  assert.deepEqual(gfxDetail({ gfx: 'lowest' }), gfxParts('low'), 'Custom begun from it: every part Low');
  assert.equal(gfxScale({ gfx: 'lowest' }), RES_BELOW.at(-1));
  assert.equal(startQuality({ gfx: 'lowest' }), 'lowest');
  const calls = [], scales = [];
  store.set('regatta', JSON.stringify({ gfx: 'lowest' }));
  globalThis.addEventListener = () => {};
  followSettings({ setQuality: (q) => calls.push(q), setResScale: (s) => scales.push(s) });
  assert.deepEqual([calls, scales], [['low'], [RES_BELOW.at(-1)]], 'and every view behind the site\'s pages with it');
});

test('slow on Low: told once, after 15 s of frames all under 24 fps', () => {
  const watch = slowWatch();
  let said = 0, at = null;
  for (let t = 0; t < 60; t += 1 / 20) if (watch(1 / 20)) { said++; at ??= t; }
  assert.equal(said, 1, 'once');
  assert.ok(at >= 14.9 && at < 16, `after 15 s (${at.toFixed(1)})`);
  const steady = slowWatch();
  for (let t = 0; t < 120; t += 1 / 30) assert.equal(steady(1 / 30), false, '30 fps is not slow');
  const spells = slowWatch(); // slow spells broken by smooth ones: never five in a row
  for (let t = 0; t < 120; t += 1 / 20) assert.equal(spells(Math.floor(t / 9) % 2 ? 1 / 40 : 1 / 20), false);
  const stalls = slowWatch(); // stalls aren't the frame rate
  for (let i = 0; i < 3000; i++) assert.equal(stalls(i % 10 ? 1 / 40 : 0.5), false);
});

test('the Lowest tip is shown once a week at most', () => {
  store.clear();
  const now = Date.now();
  assert.equal(lowestTipDue(now), true);
  lowestTipShown(now);
  assert.equal(store.get(LOWEST_TIP_KEY), String(now));
  assert.equal(lowestTipDue(now + 864e5), false, 'the next day: not again');
  assert.equal(lowestTipDue(now + LOWEST_TIP_DAYS * 864e5 + 1), true, 'a week on: again');
  store.set(LOWEST_TIP_KEY, 'garbage');
  assert.equal(lowestTipDue(now), true);
});

test('a view draws the level chosen, follows a change, and lets frames go on the battery saver', () => {
  store.clear();
  store.set('regatta', JSON.stringify({ gfx: 'low' }));
  const calls = [], on = {};
  globalThis.addEventListener = (k, f) => { on[k] = f; };
  const scales = [];
  const skip = followSettings({ setQuality: (q) => calls.push(q), setResScale: (s) => scales.push(s) });
  assert.deepEqual(calls, ['low']);
  assert.deepEqual(scales, [1], 'a level chosen: full resolution');
  assert.equal(skip(0), false);
  assert.equal(skip(8), false, 'no saver: every frame is drawn');
  store.set('regatta', JSON.stringify({ gfx: 'medium', saver: 1 }));
  on.storage({ key: 'regatta' });
  assert.deepEqual(calls, ['low', 'medium']);
  store.set('regatta', JSON.stringify({ gfx: 'auto', saver: 1 }));
  store.set(GFX_KEY, `lllllllll@0.8|${Date.now()}`);
  on.storage({ key: GFX_KEY });
  assert.deepEqual(scales, [1, 1, 0.8], 'on Auto, what Auto remembers below Low');
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
  assert.match(menu, /toggle\('figures', t\('People on board', 'Люди на борту', '[^']+', '[^']+', '[^']+', '[^']+', '[^']+', '[^']+'\), 1\)/, 'in the Graphics group, on by default');
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

test("the pause card's eight languages sit four a row, so their names fit (eight in one row ran into each other)", () => {
  const card = read('components/pause-card.tsx');
  assert.match(card, /<nav className="bt-seg" style=\{\{ \['--n' as string\]: 4 \}\} aria-labelledby="st-lang">/);
  assert.equal((card.match(/href=\{`\/lang\?to=/g) || []).length, 8);
  assert.match(read('styles/ryc.css'), /\.bt-set \.bt-seg :is\(button, a\) \{ padding: 0 4px; white-space: nowrap; \}/);
});
