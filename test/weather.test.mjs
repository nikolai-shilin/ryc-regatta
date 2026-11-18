// The weather each venue really has: which way its sea breeze swings, where one comes in at all, the water that runs
// whatever the race's setting, and the wind each venue's page names. Each venue in a process of its own, as the game
// reads its venue once, from the address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VENUES } from '../public/game/venues.js';
import { VENUES as SITE } from '../lib/venues.ts';

const run = promisify(execFile), sim = new URL('../public/game/sim.js', import.meta.url).href;
const inVenue = async (id, body) => JSON.parse((await run(process.execPath, ['--input-type=module', '-e', `
  import { readFile } from 'node:fs/promises';
  globalThis.location = { search: '?venue=${id}' };
  globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
  const sim = await import('${sim}');
  const breezy = (daytime) => { let n = 0; for (let s = 1; s <= 200; s++) n += sim.seaBreeze(s, 'medium', daytime) ? 1 : 0; return n; };
  const swing = () => { let s = 1; while (!sim.seaBreeze(s, 'medium')) s++; const w = new sim.Wind('medium', s); w.t = 720; return w.mean(); };
  console.log(JSON.stringify(await (async () => { ${body} })()));`], { maxBuffer: 1e7 })).stdout);

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

test('each venue’s page names the point of the compass its wind blows from', () => {
  for (const v of VENUES) assert.equal(SITE.find((s) => s.id === v.id).wind[0], POINTS[Math.round(v.wind / 22.5) % 16], v.id);
});

test('the site and the game agree on the water that always runs', () => {
  for (const v of VENUES) assert.equal(!!SITE.find((s) => s.id === v.id).runs, !!v.runs, v.id);
});

test('a sea breeze swings right north of the equator and left south of it', async () => {
  assert.ok(await inVenue('cowes', 'return swing();') > 0, 'Cowes');
  for (const id of VENUES.filter((v) => v.lat < 0 && v.thermal !== false).map((v) => v.id)) assert.ok(await inVenue(id, 'return swing();') < 0, id);
});

test('no sea breeze where the venue’s wind is a gradient wind or blows off the land', async () => {
  assert.ok(await inVenue('cowes', "return breezy('any');") > 0);
  for (const v of VENUES.filter((x) => x.thermal === false)) assert.equal(await inVenue(v.id, "return breezy('any');"), 0, v.id);
});

test('a sea breeze comes with the day’s heat, not in a race set for the morning or the evening', async () => {
  const [morning, evening, sunset, afternoon] = await inVenue('cowes', "return ['morning', 'evening', 'sunset', 'afternoon'].map(breezy);");
  assert.deepEqual([morning, evening, sunset], [0, 0, 0]);
  assert.ok(afternoon > 0);
});

test('a river runs with the current switched off, and other water stands still', async () => {
  const speed = "return Math.hypot(r.current.x, r.current.z);", race = "const r = new sim.Race({ preset: 'medium', seed: 11, current: false, fleet: 2 });";
  for (const v of VENUES.filter((x) => x.runs)) assert.ok(await inVenue(v.id, race + speed) > 0, v.id);
  assert.equal(await inVenue('cowes', race + speed), 0);
});

test('a 1-on-1 race on a river has the river\'s current', async () => {
  const id = VENUES.find((x) => x.runs).id;
  assert.ok(await inVenue(id, "const r = new sim.Race({ seed: 11, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }); return Math.hypot(r.current.x, r.current.z);") > 0);
});
