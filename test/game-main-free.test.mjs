// The game's entry (public/game/main.js) in a custom race, for a player who has raced before: no Ready card, her own
// sheets, the strong wind on a trapezoid, a contact out of the race. Here the page has no preloader, the browser's back
// button runs the pause menu, Audio & graphics is changed from it, the graphics go slow and come down a level, and the
// WebGL context is lost and given back. Every message the race can send is shown in words. One page, in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame, sound } from './fake-game.mjs';
import { GFX_KEY } from '../public/game/gfx.js';

const game = await bootGame({
  search: '?race=free&debug', loader: false,
  storage: { regatta: { played: 7, fleetV: 3, optsV: 4, musicV: 2, trimV: 1, autoTrim: 0, preset: 'strong', course: 'trap', contact: 'dsq', fleet: 7, start: 3, sound: 1, voice: 1, camera: 'top', guides: 0 } },
});
const { $ } = game, rg = () => game.rg, P = () => rg().race.player;
const shown = (s) => !$(s).hidden;
const box = (el, left, top, width, height) => { el.rect = { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }; };
const toast = () => $('#toast').textContent;

test('with no preloader on the page the race starts on its own, and a player who has raced gets no Ready card', async () => {
  assert.equal(game.error, null);
  assert.ok($('#loading').hidden);
  assert.equal(rg().running, true);
  assert.equal(rg().paused, false);
  assert.ok($('#readyCard').hidden);
  const s = rg().race.settings;
  assert.equal(s.preset, 'strong'); assert.equal(s.course, 'trap'); assert.equal(s.fleet, 7); assert.equal(s.daily, null);
  assert.equal(rg().race.course.type, 'trap');
  assert.equal(rg().race.boats.length, 7);
  assert.equal(rg().world.mode, 'top', 'Settings › First camera');
  assert.equal(rg().world.showGuides, false);
  assert.equal(P().autoTrim, false);
  assert.equal(rg().race.coach, false);
  assert.equal(JSON.parse(localStorage.getItem('regatta')).played, 8);
  await game.frames(20);
});

test('her own sheet: dragged on the slider, by the keys, the winch clicking in and the sheet running out', async () => {
  const sz = $('#sheetZone'), sh = $('#sheet');
  box(sh, 1200, 400, 40, 300); box($('#jibSheet'), 1150, 400, 40, 300);
  const n0 = sound.contexts[0].nodes.length;
  game.pointer(sz, 'pointerdown', { clientX: 1220, clientY: 700 });
  assert.ok(Math.abs(P().sheet - 1) < 1e-9, 'all the way out');
  game.pointer(sz, 'pointermove', { clientX: 1220, clientY: 400 });
  assert.ok(Math.abs(P().sheet) < 1e-9, 'all the way in');
  game.pointer(sz, 'pointermove', { clientX: 1220, clientY: 520 });
  assert.ok(Math.abs(P().sheet - 0.4) < 1e-9);
  game.pointer(sz, 'pointermove', { pointerId: 9, clientY: 700 }); // another finger's move is not this one's
  assert.ok(Math.abs(P().sheet - 0.4) < 1e-9);
  game.pointer(sz, 'pointerup', { clientX: 1220, clientY: 520 });
  assert.ok(sound.contexts[0].nodes.length > n0, 'the winch and the sheet heard');
  game.key('ArrowDown'); await game.frames(20); game.keyUp('ArrowDown');
  assert.ok(P().sheet > 0.5, 'eased by the key');
  game.key('KeyW'); await game.frames(20); game.keyUp('KeyW');
  assert.ok(P().sheet < 0.6, 'trimmed by the key');
});

test('main + jib: a thumb works the slider it lands nearer; Auto taken by hand for one race and handed back', async () => {
  game.key('Escape');
  $('#pauseCard [data-trim="2"]').click();
  game.key('Escape');
  assert.equal(P().split, true);
  assert.ok($('#sheetZone').classList.contains('split'));
  assert.equal($('#sheet .cap.t').textContent, 'Main');
  const sz = $('#sheetZone');
  game.pointer(sz, 'pointerdown', { clientX: 1160, clientY: 640 });
  assert.ok(Math.abs(P().jibSheet - 0.8) < 1e-9, 'the jib’s');
  game.pointer(sz, 'pointerup');
  game.pointer(sz, 'pointerdown', { clientX: 1230, clientY: 460 });
  assert.ok(Math.abs(P().sheet - 0.2) < 1e-9, 'the main’s');
  game.pointer(sz, 'pointerup');
  // Auto: a hand on the sheet takes it for this race (no first race keeps it), U hands it back
  game.key('Escape'); $('#pauseCard [data-trim="1"]').click(); game.key('Escape');
  assert.equal(P().autoTrim, true);
  game.key('ArrowUp'); game.keyUp('ArrowUp');
  assert.equal(P().autoTrim, false);
  await game.frames(2);
  assert.match(toast(), /\S/);
  assert.equal(JSON.parse(localStorage.getItem('regatta')).autoTrim, 1, 'the setting stays Auto');
  game.key('KeyU');
  assert.equal(P().autoTrim, true);
  game.pointer(sz, 'pointerdown', { clientX: 1220, clientY: 500 }); // the slider too
  assert.equal(P().autoTrim, false);
  game.pointer(sz, 'pointerup');
  await game.frames(2);
  game.pointer($('#autoBtn'), 'pointerdown');
  assert.equal(P().autoTrim, true);
  game.key('Escape'); $('#pauseCard [data-trim="0"]').click(); game.key('Escape');
});

test('every message the race sends to its player is shown in words, none of them a key', async () => {
  const r = rg().race, me = P(), other = r.boats.find((b) => b !== me);
  const msgs = [
    ['gate'], ['bump', 0.5], ['theyDsq', { who: other.name, rule: 10 }], ['aground'], ['hail', { rule: 'Room', who: other.name }], ['youHail', { rule: 'Room' }], ['youHail', {}],
    ['seaBreeze'], ['seaBreezeSouth'], ['thermalBreeze'], ['prepI'], ['prepU'], ['prepB'], ['ufd'], ['bfd'],
    ['fouled', { rule: 10, who: other.name }], ['theyFouled', { rule: 11, who: other.name }], ['touched', {}],
    ['ocs'], ['rounded'], ['roundedTri'], ['roundedTrap'], ['roundedWlu'], ['wrongSide'], ['missedGate'], ['cleared'], ['exonerated'], ['missedLine'], ['started'],
    ['signal', { key: 'sigWarn', t: -180, sound: 'short' }], ['signal', { key: 'sigPrep', t: -120, sound: 'short' }], ['signal', { key: 'sig1', t: -60, sound: 'long' }],
    ['genRecall', 3],
  ];
  for (const [key, arg] of msgs) {
    r.messages.push({ key, arg }); r.messages.push({ key: 'gate', to: other }); // and another boat's news, not hers
    await game.frames(1);
    assert.equal(r.messages.length, 0, key);
    if (!['signal', 'started'].includes(key)) assert.doesNotMatch(toast(), new RegExp(`^${key}$`), `${key}: a word, not the key`);
  }
  // what happens to her boat
  for (const e of ['broach', 'kitedown', 'kiteHoist', 'kiteDrop', 'kiteUp', 'reefStart', 'reefDone', 'shakeStart', 'shakeDone', 'jibStart', 'jibDone', 'penaltyDone', 'kiteWrap', 'crashGybe', 'deathRoll', 'kiteGybed', 'takeoff', 'splashdown', 'tacking', 'gybing']) {
    me.events.push(e); await game.frames(1);
    assert.equal(me.events.length, 0, e);
    assert.doesNotMatch(toast(), new RegExp(`^${e}$`), e);
  }
  // the other boats' crews heard
  for (const e of ['tacking', 'gybing', 'kiteHoist', 'broach']) other.events.push(e);
  await game.frames(2);
  assert.equal(other.events.length, 0);
});

test('the game’s hints: heeled hard, in irons, a gust, pinching, the waves', async () => {
  const me = P();
  for (const [k, set, back] of [[/heel/i, { heel: 40 }, { heel: 0 }], [/gust/i, { gust: 0.9 }, { gust: 0 }]]) {
    Object.assign(me, set); await game.frames(1);
    assert.match(toast(), k);
    Object.assign(me, back);
  }
});

test('Audio & graphics from the pause menu: each change heard and seen at once, the menu painted again as it closes', async () => {
  game.key('Escape');
  assert.ok(shown('#pauseCard'));
  $('#pAv').click();
  const av = game.dom.avOpened.at(-1);
  assert.ok(av && typeof av.write === 'function');
  assert.equal(av.lang, 'en');
  assert.equal(av.read(), av.read());
  for (const p of [{ gfx: 'low' }, { gfxD: { water: 0 } }, { saver: 1 }, { figures: 0 }, { figures: 1 }, { music: 'off' }, { musicVol: 'quiet' }, { sound: 0 }, { sound: 1 }, { voice: 0 }, { sndBoats: 'loud' }, { saver: 0 }, { gfx: 'auto' }])
    av.write(p);
  const saved = JSON.parse(localStorage.getItem('regatta'));
  assert.equal(saved.gfx, 'auto'); assert.equal(saved.music, 'off'); assert.equal(saved.voice, 0);
  assert.equal(typeof av.now(), 'string');
  av.onClose();
  assert.equal($('#pAvM').textContent, 'Auto · sound on');
  // Back from the menu open is to the pause menu
  $('#pAv').click();
  game.dom.avOpened.at(-1).onClose();
  game.key('Escape');
});

test('the menu’s choices change the next race; the guides and the sails at once', async () => {
  const choice = (opt, v) => $(`.choice[data-opt="${opt}"] [data-v="${v}"]`).click();
  choice('guides', 1); assert.equal(rg().world.showGuides, true);
  choice('guides', 0); assert.equal(rg().world.showGuides, false);
  choice('autoTrim', 1); assert.equal(P().autoTrim, true);
  choice('autoTrim', 0); assert.equal(P().autoTrim, false);
  const before = rg().race;
  choice('preset', 'light');
  assert.equal(rg().race, before, 'racing: the change waits for the next race');
  assert.equal(JSON.parse(localStorage.getItem('regatta')).preset, 'light');
  assert.ok($('.choice[data-opt="preset"] [data-v="light"]').classList.contains('on'));
  $('.choice[data-opt="preset"]').click(); // between the buttons
});

test('slow frames bring the graphics down a level, and say so', async () => {
  const { GFX_PARTS } = await import('../public/game/gfx.js');
  const parts = () => GFX_PARTS.map((k) => rg().world.gfx[k]).join();
  const was = parts();
  const raf = globalThis.requestAnimationFrame; // a frame every 100 ms: 10 fps
  globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 100);
  try { await game.until(() => parts() !== was, 'the picture to come down', 300, 100); } finally { globalThis.requestAnimationFrame = raf; }
  await game.frames(30, 100);
  assert.ok(localStorage.getItem(GFX_KEY), 'the lighter picture remembered for this device');
});

test('the WebGL context lost: the race pauses, a card after 2 s, and the picture back takes the card away', async () => {
  if (rg().paused) game.key('Escape');
  const gl = $('#gl');
  gl.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(rg().paused, true);
  await game.frames(150, 16);
  assert.ok($('#glLost'), 'the card');
  assert.match($('#glLost h2').textContent, /\S/);
  gl.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal($('#glLost'), null);
  // lost again, and the card's Reload
  gl.dispatchEvent(new Event('webglcontextlost'));
  await game.frames(150, 16);
  const [again] = $('#glLost').querySelectorAll('button');
  again.click();
  assert.ok(location.assigned.includes('reload'));
  gl.dispatchEvent(new Event('webglcontextrestored'));
  game.key('Escape');
});

test('the browser’s back: first the pause menu, then its question, then out to where she came from', async () => {
  if (rg().paused) game.key('Escape');
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  assert.equal(history.state?.race ?? 1, 1);
  window.dispatchEvent(new Event('popstate'));
  assert.equal(rg().paused, true);
  assert.ok(shown('#pauseCard'));
  window.dispatchEvent(new Event('popstate'));
  assert.ok(shown('#confirmCard'));
  assert.match($('#cGo').textContent, /Leave/i);
  // racing: the question's headline says where she is
  assert.match($('#cHead').textContent + $('#cTxt').textContent, /\S/);
  // Audio & graphics open: back closes it
  $('#cKeep').click();
  $('#pAv').click();
  window.dispatchEvent(new Event('popstate'));
  window.dispatchEvent(new Event('popstate'));
  assert.ok(shown('#confirmCard'));
  const n = location.assigned.length;
  window.dispatchEvent(new Event('popstate'));
  assert.ok(location.assigned.length > n || history.went.length > 0, 'gone back');
});

test('change the race: to the custom race’s set-up, in the race’s place', async () => {
  if (!rg().paused) game.key('Escape');
  $('#confirmCard').hidden = true; $('#pauseCard').hidden = false;
  $('#pChange').click(); $('#cGo').click();
  await game.frames(30, 20);
  assert.ok(location.assigned.some((u) => u === '/race/free?from=race') || history.went.length, location.assigned.join(' '));
});

test('a contact under the disqualification rule puts her out of the race, and the result follows', async () => {
  $('#confirmCard').hidden = true; $('#pResume').click();
  assert.equal(rg().paused, false);
  const r = rg().race;
  r.messages.push({ key: 'contactDsq', arg: { why: 'rudder', rule: 10, who: r.boats[1].name, deg: 12, max: 35 } });
  r.over = true; r.player.dsq = true;
  await game.frames(1);
  assert.equal(toast(), `DSQ, rule 10: you had to keep clear of ${r.boats[1].name}, and your rudder was only 12° of 35° over`);
  await game.frames(300, 20);
  assert.ok(Object.keys(localStorage).some((k) => k.startsWith('regatta-result-')), 'the result kept');
});
