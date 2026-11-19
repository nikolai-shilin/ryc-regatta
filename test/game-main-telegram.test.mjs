// The game's entry (public/game/main.js) opened from the Telegram app, in Russian: a first custom race on the course
// with the upwind finish, with Telegram's own back button, haptics and dark theme, and the launch data taken off the
// address. Sailed to the finish with the coach's tips, the last of them for a finish line of its own. One page, in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame, telegramApp } from './fake-game.mjs';

const tg = telegramApp({ lang: 'ru' });
const game = await bootGame({
  search: '?race=free&debug#tgWebAppData=abc', telegram: tg,
  storage: { regatta: { fleetV: 3, optsV: 4, musicV: 2, course: 'wlu', preset: 'light', fleet: 3, start: 1 } },
});
const { $ } = game, rg = game.rg, P = () => rg.race.player;
const toast = () => $('#toast').textContent;

test('Telegram: told the app is ready, full screen on a phone’s new app, the back button shown, the launch data off the address', () => {
  assert.equal(game.error, null);
  for (const c of ['ready', 'expand', 'noSwipes', 'back:show']) assert.ok(tg.calls.includes(c), c);
  assert.ok(!tg.calls.includes('fullscreen'), 'not on a desktop');
  assert.ok(tg.calls.some((c) => c[0] === 'header'));
  assert.ok(history.replaced.some((u) => u === '/play/?race=free&debug'), history.replaced.join(' '));
  assert.ok(document.documentElement.classList.contains('theme-night'), 'Telegram’s dark theme');
  tg.colorScheme = 'light'; tg.handlers.themeChanged();
  assert.ok(!document.documentElement.classList.contains('theme-night'));
});

test('in Russian, from Telegram’s language: the page, the loading screen and the Ready card', () => {
  assert.equal(document.documentElement.lang, 'ru');
  const [{ cells, next }] = game.loader.races;
  assert.deepEqual(cells.map((c) => c[0]), ['Ветер', 'Дистанция', 'Флот']);
  assert.equal(cells[2][3], 'Ты и 2 лодки');
  assert.equal(next, 'стартовая процедура 1 мин');
  assert.match($('[data-t="resume"]').textContent, /[а-я]/i);
  assert.match($('#rLine').textContent, /[а-я]/i);
  assert.equal(rg.race.course.type, 'wlu');
  assert.equal(rg.race.coach, true);
});

test('Telegram’s back button: at the Ready card it leaves; racing it pauses, then leaves', async () => {
  $('#rGo').click();
  assert.equal(rg.paused, false);
  tg.back();
  assert.equal(rg.paused, true);
  assert.ok(!$('#pauseCard').hidden);
  // the pause menu in Russian
  assert.match($('#pLeg').textContent, /[а-я]/i);
  assert.match($('#pPlace').textContent, /^\d-е$/);
  assert.match($('#pTick').textContent, /^Пауза · /);
  game.key('Escape');
  assert.equal(rg.paused, false);
});

test('haptics go through Telegram, a tap for a tack and a thud for the gun', async () => {
  const r = rg.race;
  while (r.clock < -0.5) r.step(1 / 60); // on to just before the gun
  const n = tg.calls.length;
  await game.until(() => r.clock > 1, 'the gun', 600);
  await game.frames(10);
  game.key('Space'); game.keyUp('Space');
  const fresh = tg.calls.slice(n);
  assert.ok(fresh.some((c) => c[0] === 'haptic' && c[1] === 'heavy'), 'the gun');
  assert.ok(fresh.some((c) => c[0] === 'haptic' && c[1] === 'medium'), 'the tack');
});

test('hidden (the phone locked, another app) the race pauses itself', async () => {
  const keep = window.__rg; delete window.__rg; // (under ?debug it doesn't: the test screens hide the tab)
  if (rg.paused) game.key('Escape');
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(rg.paused, true);
  document.hidden = false; window.__rg = keep;
  game.key('Escape');
});

test('sailed home in Russian: the coach’s word for an upwind finish line, and the result in the race’s place', async () => {
  const r = rg.race, other = r.boats.find((b) => b.ai);
  r.player.ai = { ...other.ai, skill: 1, lineT: 0.5, port: false, dare: 0, lay: 0.2, wp: 0 };
  const seen = new Set();
  for (let i = 0; i < 600 && !r.over; i++) { for (let k = 0; k < 60 && !r.over; k++) r.step(1 / 60); await game.frames(1); seen.add(toast()); }
  assert.ok(r.over);
  assert.ok([...seen].some((s) => /финиш/i.test(s)), [...seen].join(' | '));
  // (after the committee's word on the radio: the result waits for it)
  await game.until(() => location.assigned.some((u) => u.startsWith('/race/result/')), 'the result page', 200, 100);
  const id = Object.keys(localStorage).find((k) => k.startsWith('regatta-result-')).slice('regatta-result-'.length);
  // from Telegram there's no history entry of the race's own to go back over: straight to the result
  assert.ok(location.assigned.includes(`/race/result/${id}`), location.assigned.join(' '));
  const res = JSON.parse(localStorage.getItem(`regatta-result-${id}`));
  assert.equal(res.course.type, 'wlu');
  assert.ok(res.course.finish, 'the upwind finish line kept');
  const pb = JSON.parse(localStorage.getItem('regatta-pb'));
  assert.ok(Object.keys(pb).some((k) => k.startsWith('light|1|')), JSON.stringify(pb));
});

test('paused, the back button leaves the race for where she came from', async () => {
  const n = location.assigned.length;
  rg.race.over = false; game.key('Escape'); // (paused once more)
  assert.equal(rg.paused, true);
  tg.back();
  assert.equal(location.assigned.length, n + 1);
  assert.equal(location.assigned.at(-1), '/race');
});
