// The game's race, run headless in Node: npm test. The sim (public/game/sim.js) has no three.js in it; its one outside
// need is land.js fetching the bay's files, which is answered here from the disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');
const site = await import('../lib/race.ts');
// the beat (start to windward mark) in each wind, as sim.js Race and api/game.mjs have it; and the server's floor (below)
const BEAT = { light: 200, medium: 260, strong: 280 }, FLOOR = 0.45;

// lib/race.ts is a copy of the game's dailyRace for the hub and Home: the same day must give the same race
test('the site and the game agree on today’s race, every day for a year and more', () => {
  const from = Date.UTC(2026, 0, 1);
  for (let d = 0; d < 500; d++) {
    const day = new Date(from + d * 864e5);
    assert.deepEqual(site.dailyRace(day), sim.dailyRace(day), day.toISOString().slice(0, 10));
  }
});

test('the site’s course numbers are the game’s', () => {
  assert.deepEqual(site.COURSE_LEN, sim.COURSE_LEN);
  assert.deepEqual(site.BEAT_LEN, BEAT);
});

// sail a race to the end with only the computer boats racing; their finishing times
function sail(opts) {
  const r = new sim.Race(opts), others = r.boats.filter((b) => b !== r.player);
  for (let n = 0; n < 60 * 60 * 40 && !others.every((b) => b.done); n++) r.step(1 / 60);
  return others.map((b) => (b.done && !b.dsq ? Math.round(b.finish * 10) / 10 : null));
}

test('the same seed sails the same race', () => {
  const opts = { preset: 'medium', length: 'short', laps: 1, fleet: 5, seed: 4242 };
  assert.deepEqual(sail(opts), sail(opts));
});

// The scores server (api/game.mjs in the iyt-test repo) keeps no time under FLOOR seconds a metre of beat a lap:
// half of what the computer boats take, so that no one sailing the game well is ever turned away. Keep the two in step.
for (const preset of ['light', 'medium', 'strong']) {
  test(`the computer boats in ${preset} wind finish well above the server's floor`, () => {
    const times = sail({ preset, length: 'short', laps: 1, fleet: 5, seed: 11 }).filter((x) => x != null);
    assert.ok(times.length >= 3, 'most of the fleet finishes');
    const floor = FLOOR * BEAT[preset] * sim.COURSE_LEN.short;
    assert.ok(Math.min(...times) > floor * 1.5, `fastest ${Math.min(...times)} s, floor ${floor} s`);
  });
}
