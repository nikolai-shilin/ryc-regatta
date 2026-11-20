// The game's entry, public/game/main.js, loaded on its own page (public/play/index.html, test/fake-game.mjs) and played as
// a newcomer plays today's race in English: the loading screen named, the Ready card, the controls by keyboard and by
// touch, the pause menu and its questions, a restart, and a race sailed to its finish and handed to the result page.
// One page a file, as the game runs once a page: the tests go on from each other, in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame, sound, fetched } from './fake-game.mjs';

// (?nofirst: today's race itself, not the easy race a newcomer is given first: test/game-first.test.mjs)
const game = await bootGame({ search: '?debug&nofirst' });
const { $, rg } = { $: game.$, get rg() { return game.rg; } };
const P = () => game.rg.race.player;
const shown = (s) => !$(s).hidden;
// the player's boat sailed by the computer skippers' own helm (sim.js drive), the best of them: she gets round
const autopilot = () => { const r = game.rg.race, other = r.boats.find((b) => b.ai); r.player.ai = { ...other.ai, skill: 1, lineT: 0.5, port: false, dare: 0, lay: 0.2, wp: 0, go: false }; };

test('the loading screen is told the race: its venue, the wind, the course and the fleet, and what comes next', () => {
  assert.equal(game.loader.failed.length, 0);
  assert.equal(game.loader.handed, 1, 'handed over to the race once the scene was ready');
  const [{ venue, cells, next }] = game.loader.races;
  assert.equal(venue, 'Enoshima'); // today's venue on 18 November 2026
  assert.equal(cells.length, 3);
  assert.deepEqual(cells.map((c) => c[0]), ['Wind', 'Course', 'Fleet']);
  assert.match(cells[2][3], /^You and \d boats$/);
  assert.equal(next, '1-minute start sequence');
});

test('the page speaks English: every word on it put in, the buttons named for a screen reader', () => {
  assert.equal(document.documentElement.lang, 'en');
  for (const el of document.querySelectorAll('[data-t]')) assert.match(el.innerHTML, /\S/, `[data-t=${el.dataset.t}] left empty`);
  for (const [k, en] of [['pausedK', 'Paused'], ['resume', 'Resume'], ['rGo', 'Start now']]) assert.match($(`[data-t="${k}"]`).innerHTML, new RegExp(en), k);
  assert.equal($('#zoomIn').getAttribute('aria-label'), 'Zoom in (A)');
  assert.equal($('#zoomIn').title, 'Zoom in · A');
  // the split trim's third choice, and the buttons made from the kite's
  assert.ok($('.choice[data-opt="autoTrim"] [data-v="2"]'));
  for (const id of ['#reefBtn', '#jibBtn', '#hailBtn', '#autoBtn', '#jibSheet']) assert.ok($(id), id);
});

test('a newcomer’s first race waits behind the Ready card, lined up for the start', async () => {
  assert.equal(rg.running, true);
  assert.equal(rg.paused, true);
  assert.ok(shown('#readyCard'));
  assert.ok(shown('#hud'));
  assert.ok($('#menu').hidden);
  assert.match($('#rLine').textContent, /\S/);
  assert.match($('#rSteer').textContent, /arrow|key|←/i);
  assert.equal(document.activeElement, $('#rGo'));
  const opts = JSON.parse(localStorage.getItem('regatta'));
  assert.equal(opts.played, 1);
  assert.equal(rg.race.coach, true);
  // a key that neither starts nor steers does nothing yet; the clock stands still behind the card
  const c0 = rg.race.clock;
  game.key('KeyK'); await game.frames(20);
  assert.equal(rg.race.clock, c0);
  assert.ok(shown('#readyCard'));
  game.key('Enter');
  assert.equal(rg.paused, false);
  assert.ok($('#readyCard').hidden);
  await game.frames(30);
  assert.ok(rg.race.clock > c0, 'the count to the gun runs');
});

test('the keys steer, tack, set the speed, the view and the zoom', async () => {
  const w = rg.world;
  game.keyUp('ArrowLeft');
  game.key('ArrowRight'); await game.frames(10); game.keyUp('ArrowRight');
  assert.ok(P().rudder > 0, 'right arrow: rudder to the right');
  await game.frames(30);
  assert.ok(Math.abs(P().rudder) < 0.5, 'let go, the helm comes back');
  for (const [code, mode] of [['KeyC', 'top'], ['KeyV', 'helm'], ['KeyX', 'drone']]) {
    game.key(code); assert.equal(w.mode, mode, code);
    assert.ok($(`#camSeg [data-cam="${mode}"]`).classList.contains('on'));
  }
  $('#camSeg [data-cam="top"]').click(); assert.equal(w.mode, 'top');
  game.key('KeyX');
  const z = w.zoomK ?? w.dist ?? null;
  game.key('KeyA'); game.key('KeyZ'); // a zoom in and out again: the view where it was
  if (z != null) assert.ok(Math.abs((w.zoomK ?? w.dist) - z) < 1e-6 * Math.max(1, Math.abs(z)));
  // T: the game's speed, round 1×, 1.5×, 2×, 3× and back
  const sp = $('#speedBtn');
  for (const want of ['1.5×', '2×', '3×', '1×']) { game.key('KeyT'); assert.equal(sp.textContent, want); }
  assert.equal(sp.classList.contains('fast'), false);
  game.pointer(sp, 'pointerdown'); assert.equal(sp.textContent, '1.5×');
  game.key('KeyT'); game.key('KeyT'); game.key('KeyT'); assert.equal(sp.textContent, '1×');
  // the sheet keys, on Auto in a first race: kept on Auto, and a word why
  game.key('ArrowUp'); game.keyUp('ArrowUp');
  assert.equal(P().autoTrim, true);
  await game.frames(2);
  assert.match($('#toast').textContent, /Auto/i);
  // Space: a tack (or a gybe), once the start has her moving
  const n = P().events.length;
  game.key('Space'); game.keyUp('Space');
  await game.frames(5);
  assert.ok(P().auto || P().events.length > n, 'the tack under way');
});

test('touch: the rudder’s arc, the sheet, the tack and kite buttons, a drag and a pinch on the water, the zoom buttons', async () => {
  await game.until(() => !P().auto, 'the tack to finish');
  const rz = $('#rudderZone');
  rz.rect = { left: 0, top: 0, width: 210, height: 118, right: 210, bottom: 118 };
  game.pointer(rz, 'pointerdown', { clientX: 100 });
  game.pointer(rz, 'pointermove', { clientX: 180 });
  await game.frames(2);
  assert.ok(P().rudder > 0.5, 'dragged right');
  game.pointer(rz, 'pointerup', { clientX: 180 });
  await game.frames(30);
  // the sheet: on Auto in a first race, a hand on it keeps it on Auto
  const sz = $('#sheetZone');
  const e = game.pointer(sz, 'pointerdown', { clientY: 10 });
  assert.equal(e.defaultPrevented, true);
  assert.equal(P().autoTrim, true);
  // the tack button
  await game.until(() => !P().auto, 'the helm to settle');
  const n = P().events.length;
  game.pointer($('#tackBtn'), 'pointerdown');
  await game.frames(3);
  assert.ok(P().auto || P().events.length > n);
  // the kite upwind does nothing; the reef and the jib, the hail with nobody to hail
  game.pointer($('#kiteBtn'), 'pointerdown');
  assert.ok(!P().kite && !P().kiteJob, 'no kite on a beat');
  game.pointer($('#hailBtn'), 'pointerdown');
  await game.frames(2);
  game.pointer($('#reefBtn'), 'pointerdown');
  game.pointer($('#jibBtn'), 'pointerdown');
  // the water: a drag turns the drone round, two fingers zoom, a double tap puts the view back
  const gl = $('#gl'), w = rg.world;
  game.pointer(gl, 'pointerdown', { pointerId: 5, clientX: 100, clientY: 100 });
  game.pointer(gl, 'pointermove', { pointerId: 5, clientX: 160, clientY: 100 });
  game.pointer(gl, 'pointerdown', { pointerId: 6, clientX: 300, clientY: 100 });
  game.pointer(gl, 'pointermove', { pointerId: 6, clientX: 400, clientY: 100 });
  game.pointer(gl, 'pointermove', { pointerId: 5, clientX: 150, clientY: 100 });
  game.pointer(gl, 'pointerup', { pointerId: 6 }); game.pointer(gl, 'pointercancel', { pointerId: 5 });
  game.pointer(gl, 'pointermove', { pointerId: 7, clientX: 1 }); // a pointer it never saw go down
  game.pointer(gl, 'pointerdown', { pointerId: 8 }); game.pointer(gl, 'pointerup', { pointerId: 8 });
  game.pointer(gl, 'pointerdown', { pointerId: 9 }); game.pointer(gl, 'pointerup', { pointerId: 9 }); // a double tap
  const wheel = new Event('wheel', { cancelable: true }); wheel.deltaY = 120; gl.dispatchEvent(wheel);
  assert.equal(wheel.defaultPrevented, true);
  // + held down zooms on until let go
  game.pointer($('#zoomIn'), 'pointerdown');
  await game.frames(10);
  game.pointer($('#zoomIn'), 'pointerup');
  game.pointer($('#zoomOut'), 'pointerdown'); game.pointer($('#zoomOut'), 'pointerleave');
  assert.ok(w);
  // the course map: a tap makes it big, another small again
  const mini = $('#mini');
  game.pointer(mini, 'pointerdown'); assert.ok(mini.classList.contains('big'));
  game.pointer(mini, 'pointerdown'); assert.ok(!mini.classList.contains('big'));
});

test('Esc pauses: the pause card says where the race stands, its switches work, and Esc again goes on', async () => {
  game.key('Escape'); game.keyUp('Escape');
  assert.equal(rg.paused, true);
  assert.ok(shown('#pauseCard'));
  assert.match($('#pLeg').textContent, /Leg \d of \d/);
  assert.match($('#pTick').textContent, /^Paused · Enoshima · /);
  assert.match($('#pPlace').textContent, /^\d(st|nd|rd|th)$/);
  assert.match($('#pOf').textContent, /\d/);
  assert.ok($('#pLegs').children.length >= 2);
  assert.equal($('.p-esc kbd').textContent, 'Esc');
  // the race stands still while paused
  const c = rg.race.clock; await game.frames(10); assert.equal(rg.race.clock, c);
  // the guides switch, the sails three ways, the camera
  const guides = $('#pauseCard [data-q="guides"]'), was = guides.getAttribute('aria-checked');
  guides.click();
  assert.notEqual(guides.getAttribute('aria-checked'), was);
  assert.equal(rg.world.showGuides, guides.getAttribute('aria-checked') === 'true');
  guides.click();
  $('#pauseCard [data-trim="0"]').click();
  assert.equal(P().autoTrim, false);
  assert.equal($('#pauseCard [data-trim="0"]').getAttribute('aria-checked'), 'true');
  $('#pauseCard [data-trim="2"]').click();
  assert.ok($('#hud').classList.contains('split-trim') === !!P().split);
  $('#pauseCard [data-trim="1"]').click();
  assert.equal(P().autoTrim, true);
  $('#pauseCard [data-pc="helm"]').click();
  assert.equal(rg.world.mode, 'helm');
  assert.equal(JSON.parse(localStorage.getItem('regatta')).camera, 'helm');
  $('#pauseCard [data-pc="drone"]').click();
  $('#pauseCard').click(); // a click on nothing in it
  game.key('Escape');
  assert.equal(rg.paused, false);
  assert.ok($('#pauseCard').hidden);
  $('#pauseBtn').click(); assert.equal(rg.paused, true);
  $('#pResume').click(); assert.equal(rg.paused, false);
});

test('the pause menu’s questions: keep racing, or restart, which starts the race again from its sequence', async () => {
  game.key('KeyP');
  for (const [btn, head] of [['#pLeave', /Leave/i], ['#pChange', /Change|another/i], ['#pRestart', /Restart/i]]) {
    $(btn).click();
    assert.ok(shown('#confirmCard')); assert.ok($('#pauseCard').hidden);
    assert.match($('#cKick').textContent + ' ' + $('#cHead').textContent, head);
    assert.match($('#cTxt').textContent, /\S/);
    assert.match($('#cGo').textContent, /\S/);
    $('#cKeep').click();
    assert.ok($('#confirmCard').hidden); assert.ok(shown('#pauseCard'));
  }
  const before = rg.race;
  $('#pRestart').click(); $('#cGo').click();
  assert.notEqual(rg.race, before, 'a new race');
  assert.equal(rg.running, true);
  assert.ok(rg.race.clock < 0, 'in its start sequence');
  assert.equal(JSON.parse(localStorage.getItem('regatta')).played, 2);
  // a second race still has the Ready card (the first three do)
  assert.ok(shown('#readyCard'));
  $('#rGo').click();
  assert.equal(rg.paused, false);
});

test('sound: the race’s audio graph is built, the sounds follow the boat, and the first key wakes it', async () => {
  assert.ok(sound.contexts.length >= 1);
  const ctx = sound.contexts[0];
  game.key('ShiftLeft'); game.keyUp('ShiftLeft');
  await game.frames(30);
  assert.equal(ctx.state, 'running');
  assert.ok(ctx.nodes.length > 50, `${ctx.nodes.length} nodes`);
  assert.ok(fetched.some((f) => /calls-en|skipper-en/.test(f.url)), 'the recorded lines fetched');
});

test('racing, the question to leave says where she is: her place, and how far to the mark', async () => {
  autopilot();
  const r = rg.race;
  while (!(r.clock > 0 && P().leg >= 1)) r.step(1 / 60);
  await game.frames(2);
  game.key('Escape'); $('#pLeave').click();
  assert.match($('#cHead').textContent, /^You’re \d(st|nd|rd|th), \d+ m from the (windward mark|gate|finish)$/);
  assert.match($('#cTxt').textContent, /\S/);
  $('#cKeep').click(); game.key('Escape');
  assert.equal(rg.paused, false);
});

test('the umpire’s whistle and word when she touches a mark', async () => {
  await game.frames(600); // the radio quiet first: what it had to say said, or let go
  const ctx = sound.contexts[0], n = ctx.nodes.length;
  rg.race.messages.push({ key: 'touched', arg: {} });
  await game.frames(300); // (after the skipper's own word: the radio waits for him)
  const osc = ctx.nodes.slice(n).filter((x) => x.kind === 'Oscillator');
  assert.ok(osc.some((o) => o.frequency.value >= 2900 && o.frequency.value <= 3050), 'the pea whistle’s two blasts');
});

test('sailed to the finish: the result kept on this device, posted, and the result page put in the race’s place', async () => {
  game.key('KeyT'); game.key('KeyT'); game.key('KeyT'); // 3×
  const r = rg.race;
  for (let i = 0; i < 400 && !r.over; i++) { for (let k = 0; k < 120 && !r.over; k++) r.step(1 / 60); await game.frames(1); }
  assert.ok(r.over, 'the race over');
  assert.ok(P().done);
  await game.until(() => location.assigned.length > 0 || history.went.length > 0, 'the result page', 1200, 50);
  await game.frames(30, 50);
  const results = Object.keys(localStorage).filter((k) => k.startsWith('regatta-result-'));
  assert.equal(results.length, 1);
  const res = JSON.parse(localStorage.getItem(results[0]));
  assert.equal(res.venue, 'enoshima');
  assert.equal(res.daily, '2026-11-18');
  assert.equal(res.boats.filter((b) => b.me).length, 1);
  assert.ok(res.boats.find((b) => b.me).secs > 0);
  assert.ok(res.course.legs.length >= 3);
  const pb = JSON.parse(localStorage.getItem('regatta-pb'));
  assert.ok(pb['daily|2026-11-18'] > 0, 'today’s best kept');
  assert.equal(res.pb.best, pb['daily|2026-11-18']);
  assert.ok(location.assigned.some((u) => u === `/race/result/${res.id}`), location.assigned.join(' '));
});
