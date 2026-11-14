// The golden runs: up and down and the triangle, one lap, in light and strong wind, with and without the current (8
// races, fleet 7, seed 31), sailed to the end in headless Node and boiled down to each boat's finish, leg-change times
// and (every 30th) track point. test/sim.test.mjs holds 'wl' and 'tri' to the fixture written here, so they sail on
// unchanged by the new shapes and whatever comes after. Rewrite it only on purpose: node test/golden.mjs --write. The
// race is sailed in Göcek's bay, so the fixture must be written again whenever Göcek's land is baked again
// (blender/venues.py): the boats steer round the shore.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
const sim = await import('../public/game/sim.js');

const round = (x) => Math.round(x * 10) / 10;

function sailRun(opts) {
  const r = new sim.Race({ ...opts, fleet: 7, seed: 31, length: 'short' });
  const others = r.boats.filter((b) => b !== r.player); // the player boat is not steered, so it never finishes
  const legs = r.boats.map(() => []);
  const last = r.boats.map((b) => b.leg);
  for (let n = 0; n < 60 * 60 * 40 && !others.every((b) => b.done); n++) {
    r.step(1 / 60);
    r.boats.forEach((b, i) => { if (b.leg !== last[i]) { last[i] = b.leg; legs[i].push(round(r.clock)); } });
  }
  return {
    finish: r.boats.map((b) => (b.done && !b.dsq ? round(b.finish) : null)),
    legs,
    track: r.boats.flatMap((b) => b.track.filter((_, i) => i % 30 === 0).map(([x, z]) => [round(x), round(z)])),
  };
}

export function goldenRuns() {
  const runs = [];
  for (const course of ['wl', 'tri']) for (const preset of ['light', 'strong']) for (const current of [0, 1])
    runs.push({ key: `${course} ${preset} laps 1 current ${current}`, ...sailRun({ course, preset, laps: 1, current }) });
  return JSON.parse(JSON.stringify(runs));
}

if (process.argv[2] === '--write') {
  const file = fileURLToPath(new URL('./fixtures/courses-golden.json', import.meta.url));
  await writeFile(file, JSON.stringify(goldenRuns()) + '\n');
  console.log('wrote', file);
}
