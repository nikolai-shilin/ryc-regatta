// The game's entry (public/game/main.js) in a 1-on-1 race (/play?match=CODE): match-ui.js, which brings the waiting room
// and the Realtime link (test/match-ui*.test.mjs have it), is a stand-in here that keeps what main.js hands it, so the
// race can be put on screen and taken off as it would: the host's screen and the guest's, the pause menu over a race
// that runs on, the browser's back, a frame that throws, the record of the race kept, and leaving. One page, in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mock, ROOT } from './load.mjs';
import { bootGame } from './fake-game.mjs';

const SIM = pathToFileURL(join(ROOT, 'public/game/sim.js')).href;
globalThis.__match = { opts: null, left: 0 };
mock('public/game/match-ui.js', `
export async function startMatch(o) { globalThis.__match.opts = o; }
export function leaveMatch() { globalThis.__match.left++; globalThis.__match.opts.onEnd(); }`);

const game = await bootGame({
  search: '?match=abc234&debug',
  storage: { regatta: { played: 9, fleetV: 3, optsV: 4, musicV: 2, trimV: 1 }, 'regatta-match-settings': { preset: 'strong', length: 'nope', course: 'tri', start: 3, current: 1, daytime: 'dusk', laps: 2 } },
});
const { $ } = game, rg = game.rg, M = globalThis.__match;
const { Race } = await import(SIM);
const { resultsOf } = await import('../public/game/wire.js');

// a race of the match as match-ui.js makes one: two people, a step at a time, this screen the host's or the guest's
const STEP = 1 / 60;
function session({ guest = false, me = 'a' } = {}) {
  const race = new Race({ preset: 'medium', length: 'short', course: 'wl', start: 1, laps: 1, fleet: 2, seed: 3, humans: [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }], me });
  for (const b of race.humans) b.color ??= 0xffffff;
  race.settings = { preset: 'medium', length: 'short', course: 'wl', start: 1, laps: 1, current: 0, fleet: 2, daily: null };
  const s = { race, isGuest: guest, acc: 0, steps: 0, throwOnce: false,
    get frac() { return Math.min(1, s.acc / STEP); },
    step(dt, each = () => {}) { if (s.throwOnce) { s.throwOnce = false; throw new Error('a bad frame'); } s.acc += dt; while (s.acc >= STEP) { each(); race.step(STEP); s.steps++; s.acc -= STEP; } } };
  return s;
}

test('the waiting room’s race on screen at once: the two boats below the line, in the race the host set up', () => {
  assert.equal(game.error, null);
  const r = rg.race;
  assert.equal(r.boats.length, 2);
  assert.equal(r.settings.preset, 'strong');
  assert.equal(r.settings.length, 'short', 'a length it doesn’t know: the first');
  assert.equal(r.settings.course, 'tri');
  assert.equal(r.settings.start, 3); assert.equal(r.settings.current, 1);
  assert.equal(r.settings.daytime, 'any');
  assert.equal(r.settings.daily, null);
});

test('the loading screen names a race of two, and hands over to the match’s own flow', () => {
  const [{ cells, next }] = game.loader.races;
  assert.deepEqual(cells.map((c) => c[0]), ['Race', 'Course', 'Boats']);
  assert.equal(cells[2][3], 'You and a friend');
  assert.equal(next, '3-minute start sequence');
  assert.ok(M.opts, 'match-ui.js started');
  assert.equal(M.opts.code, 'ABC234');
  assert.equal(M.opts.LANG, 'en');
  assert.equal(M.opts.yachtName('j70'), 'J/70');
  assert.equal(M.opts.venueName('garda'), 'Lake Garda');
  assert.equal(M.opts.perf(), null);
  // nothing of a race of one's own: no restart, no change, no game speed
  assert.equal($('#pChange').style.display, 'none'); assert.equal($('#pRestart').style.display, 'none');
  assert.ok($('#speedBtn').hidden);
  assert.ok($('#hud').hidden);
  game.key('KeyT');
  assert.equal($('#speedBtn').textContent, '1×');
});

let s;
test('the host’s race on screen: the HUD up, the race stepped at the clock’s pace, the boats drawn between their steps', async () => {
  s = session();
  M.opts.onRace(s);
  assert.equal(rg.race, s.race);
  assert.equal(rg.running, true); assert.equal(rg.paused, false);
  assert.ok(!$('#hud').hidden);
  assert.equal(rg.race.coach, false);
  await game.frames(60);
  assert.ok(s.steps >= 55 && s.steps <= 65, `${s.steps} steps in a second`);
  assert.ok(typeof M.opts.perf() === 'object');
  M.opts.toast('Ben is here');
  await game.frames(1);
  assert.equal($('#toast').textContent, 'Ben is here');
});

test('paused, a match runs on under the menu; the hail and the tack are the host’s own', async () => {
  game.key('Escape');
  assert.equal(rg.paused, true);
  const n = s.steps; await game.frames(30);
  assert.ok(s.steps > n, 'the race went on');
  game.key('Escape');
  const P = s.race.player;
  game.pointer($('#hailBtn'), 'pointerdown');
  assert.equal(P.hailN, undefined, 'the host hails herself');
});

test('the browser’s back in a match: the menu, then its question, then back to the menu', async () => {
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  window.dispatchEvent(new Event('popstate'));
  assert.equal(rg.paused, true); assert.ok(!$('#pauseCard').hidden);
  window.dispatchEvent(new Event('popstate'));
  assert.ok(!$('#confirmCard').hidden);
  assert.match($('#cTxt').textContent, /\S/);
  const host = $('#cTxt').textContent;
  window.dispatchEvent(new Event('popstate'));
  assert.ok($('#confirmCard').hidden); assert.ok(!$('#pauseCard').hidden);
  game.key('Escape');
  // the guest's question says what leaving does to her
  s.isGuest = true;
  $('#pauseBtn').click(); $('#pLeave').click();
  assert.notEqual($('#cTxt').textContent, host);
  assert.match($('#cTxt').textContent, s.race.clock >= 0 ? /Anna|Ben/ : /The start hasn’t gone yet/); // (before the gun: called off)
  $('#cKeep').click(); game.key('Escape');
});

test('on the guest’s screen the tack and the hail go to the host as counts', async () => {
  const P = s.race.player;
  while (s.race.clock < 5) s.race.step(STEP);
  await game.frames(2);
  game.key('Space'); game.keyUp('Space');
  assert.equal(P.tackN, 1);
  game.pointer($('#hailBtn'), 'pointerdown');
  assert.equal(P.hailN, 1);
  s.isGuest = false;
});

test('a frame that throws costs that frame, not the race', async () => {
  s.throwOnce = true;
  const n = s.steps;
  await game.frames(10);
  assert.ok(s.steps > n, 'the next frames run');
  assert.ok(game.dom.warnings.some((w) => /a bad frame/.test(w)), 'said on the console');
});

test('the race off screen for the card between races; the record kept on this device, and its page opened', async () => {
  const r = s.race, other = r.humans.find((b) => b !== r.player);
  for (const b of r.humans) b.ai = { skill: 1, lineT: b === r.player ? 0.4 : 0.6, lastTack: -999, go: false, mean: r.wind.mean(), dirtyT: 0, hailT: -99, wp: 0, loiter: 1, port: false, dare: 0, lay: 0.2 };
  for (let i = 0; i < 60 * 900 && !r.humans.every((b) => b.done); i++) r.step(STEP);
  assert.ok(r.humans.every((b) => b.done));
  await game.frames(5);
  M.opts.onIdle();
  assert.equal(rg.running, false);
  assert.ok($('#hud').hidden);
  const results = resultsOf(r); results.winner = r.standings()[0].id;
  const id = M.opts.keepOneOnOne(r, results);
  const res = JSON.parse(localStorage.getItem(`regatta-result-${id}`));
  assert.equal(res.oneOnOne, true); assert.equal(res.daily, null);
  assert.deepEqual(res.boats.map((b) => b.me), results.boats.map((b) => b.id === r.player.id));
  assert.equal(res.boats.filter((b) => b.won).length, 1);
  assert.ok(res.boats.every((b) => b.done && b.secs > 0 && !('level' in b)));
  assert.equal(res.boats.find((b) => !b.me).name, other.name);
  // the leave question once she's home
  M.opts.onRace(s); $('#pauseBtn').click();
  s.isGuest = true; $('#pLeave').click();
  assert.match($('#cTxt').textContent, /\S/);
  s.isGuest = false;
  // leaving the match: match-ui.js tells the other screen, and the page goes to the hub
  $('#cGo').click();
  assert.equal(M.left, 1);
  await game.frames(30, 20);
  assert.ok(location.assigned.includes('/race'), location.assigned.join(' '));
});
