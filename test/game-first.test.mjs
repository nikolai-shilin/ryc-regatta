// A newcomer's first race (public/game/main.js FIRST, classes.js firstRaceHere): today's race asked for on a device
// that has raced nothing yet is an easy race of its own instead, an Optimist among five boats of beginners on a short
// course, its start sequence run on to its last 20 seconds; the Ready card starts the clock by itself, and the last
// seconds to the gun are counted big. One page a file, as the game runs once a page: the tests go on from each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame, freshPage, fetched } from './fake-game.mjs';

const game = await bootGame({ search: '?debug' });
const { $ } = game, race = () => game.rg.race;
const { CLS, firstRaceHere } = await import('../public/game/classes.js'); // (the module main.js loaded: the page's class)

test('the loading screen names it: a short race in an Optimist, about three minutes, from 20 seconds before the gun', () => {
  assert.equal(game.loader.failed.length, 0);
  const [{ venue, cells, next }] = game.loader.races;
  assert.equal(venue, 'A short race in an Optimist');
  assert.deepEqual(cells.map((c) => c[0]), ['Wind', 'About', 'Fleet']);
  assert.equal(cells[1][1], 3);
  assert.equal(cells[1][3], '20-second start');
  assert.equal(next, '20-second start');
});

test('sailed at a venue of its own, the Tobago Cays, wherever today’s race is: named as it loads, its land the only one fetched', async () => {
  const { VENUE, FIRST_VENUE } = await import('../public/game/venues.js');
  assert.equal(VENUE, FIRST_VENUE);
  assert.equal(VENUE.id, 'tobago-cays');
  assert.equal(game.loader.races[0].place, 'Tobago Cays');
  const land = fetched.map((f) => String(f.url)).filter((u) => /\/game\/(venues\/|skopea\.)/.test(u));
  assert.ok(land.length && land.every((u) => u.includes('tobago-cays')), land.join(' '));
  await game.frames(2);
  assert.equal($('.b-sub').textContent, 'First race · Tobago Cays', 'the HUD names it so, not a custom race');
});

test('an Optimist race of its own, not today’s: five boats of beginners, a medium breeze, up and down once', () => {
  assert.equal(CLS.id, 'optimist');
  const s = race().settings;
  assert.equal(s.first, true);
  assert.equal(s.daily, null, 'never posted as today’s race');
  assert.equal(s.preset, 'medium');
  assert.equal(s.laps, 1);
  assert.equal(race().boats.length, 5);
  assert.ok(race().boats.filter((b) => b.ai).every((b) => b.level === 'beginner'), 'a fleet of beginners');
  // played now 1 (counted as the race started): the next page is today's race
  assert.equal(JSON.parse(localStorage.getItem('regatta')).played, 1);
  assert.equal(firstRaceHere(), false);
});

test('only the last 20 seconds of the start sequence are hers: the clock run on, the Ready card up and counting', () => {
  assert.equal(game.rg.running, true);
  assert.equal(game.rg.paused, true);
  assert.ok(race().clock >= -20 && race().clock < -19.5, `clock ${race().clock}`);
  assert.ok(!$('#readyCard').hidden);
  assert.equal($('#rCount').textContent, '3');
  assert.ok($('#hud').classList.contains('r-wait'), 'the steering glows while it waits');
  assert.equal($('[data-t="rGo"]').textContent, 'Start now');
});

test('the Ready card starts the clock by itself after three seconds', async () => {
  const c0 = race().clock;
  await game.frames(70);
  assert.equal(game.rg.paused, true, 'not yet');
  assert.equal(race().clock, c0, 'the clock waits behind the card');
  assert.equal($('#rCount').textContent, '2');
  await game.until(() => !game.rg.paused, 'the card to start the race', 300);
  assert.ok($('#readyCard').hidden);
  // the land's trees, town and moored boats were built behind the card, not under the loading screen (skopea.js lateLand)
  const land = game.rg.world.skopea;
  assert.equal(land.late.length, 0, 'all of the land in');
  assert.ok(land.town.children.length > 0 && land.trees.children.length > 0 && land.boats.children.length > 0);
  assert.ok(!$('#hud').classList.contains('r-wait'));
  await game.frames(30);
  assert.ok(race().clock > c0, 'the count to the gun runs');
});

test('the last seconds to the gun are counted big, and gone with the gun', async () => {
  assert.ok($('#gunCount').classList.contains('on'));
  assert.equal($('#gunN').textContent, String(Math.ceil(-race().clock)));
  assert.ok(!$('#gunCount').classList.contains('now'), 'white before the last ten seconds, as the HUD’s gun clock');
  await game.until(() => race().clock > -9.5, 'the last ten seconds', 1500);
  await game.frames(2);
  assert.ok($('#gunCount').classList.contains('now'), 'blue in the last ten');
  await game.until(() => race().clock > 0.2, 'the gun', 3000);
  await game.frames(2);
  assert.ok(!$('#gunCount').classList.contains('on'));
});

test('sailed to the finish: the result kept says it was the first race, and isn’t today’s', async () => {
  const r = race(), other = r.boats.find((b) => b.ai);
  r.player.ai = { ...other.ai, skill: 1, lineT: 0.5, port: false, dare: 0, lay: 0.2, wp: 0, go: false }; // (the computer sails her round)
  for (let i = 0; i < 400 && !r.over; i++) { for (let k = 0; k < 120 && !r.over; k++) r.step(1 / 60); await game.frames(1); }
  assert.ok(r.over, 'the race over');
  await game.until(() => location.assigned.length > 0 || history.went.length > 0, 'the result page', 1200, 50);
  const [key] = Object.keys(localStorage).filter((k) => k.startsWith('regatta-result-'));
  const res = JSON.parse(localStorage.getItem(key));
  assert.equal(res.first, true);
  assert.equal(res.daily, null);
  assert.equal(res.yacht, 'optimist');
});

test('?race=first asks for it by name, on a device that has raced before; today\'s race there is today\'s', () => {
  localStorage.setItem('regatta', JSON.stringify({ played: 7 }));
  freshPage('/play/?race=first');
  assert.equal(firstRaceHere(), true);
  freshPage('/play/?race=today');
  assert.equal(firstRaceHere(), false);
  freshPage('/play/?race=free');
  assert.equal(firstRaceHere(), false);
});
