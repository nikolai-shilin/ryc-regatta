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

// today's venue: every venue in turn, never the same two days running; and the play page's preloader (an inline copy
// in public/play/index.html) fetches the same venue's land as the game then asks for
test('today’s race goes round the venues, and the play page preloads the day’s', async () => {
  const { VENUES, dailyVenue, landFiles, venueById } = await import('../public/game/venues.js');
  const html = await readFile(new URL('../public/play/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>(\(function \(\) \{ var v = 'gocek';[\s\S]*?)<\/script>/)[1];
  const { runInNewContext } = await import('node:vm');
  const from = Date.UTC(2026, 0, 1);
  let prev = null;
  for (let d = 0; d < 400; d++) {
    const now = from + d * 864e5, day = new Date(now), v = dailyVenue(day);
    assert.notEqual(v, prev, `${day.toISOString().slice(0, 10)}: not yesterday’s venue`); prev = v;
    if (d % VENUES.length === 0) {
      const round = new Set(Array.from({ length: VENUES.length }, (_, i) => dailyVenue(new Date(now + i * 864e5))));
      assert.ok(round.size >= VENUES.length - 2, 'every venue comes round');
    }
    const links = [];
    class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } }
    FakeDate.parse = Date.parse;
    runInNewContext(script, {
      Date: FakeDate, Math, JSON, URLSearchParams, location: { search: '?race=today' }, localStorage: { getItem: () => null },
      document: { createElement: () => ({}), head: { appendChild: (l) => links.push(l.href) } },
    });
    assert.deepEqual(links.sort(), landFiles(venueById(v)).map((f) => '/game/' + f).sort(), day.toISOString().slice(0, 10));
  }
});

test('the site’s course numbers are the game’s', () => {
  assert.deepEqual(site.COURSE_LEN, sim.COURSE_LEN);
  assert.deepEqual(site.BEAT_LEN, BEAT);
});

// the course as a set of rounding marks keyed by leg, with what each leg is: a beat into the windward mark, a reach
// to the wing; the triangle's finish is the start line (null)
test('the course lists its marks and legs', () => {
  const c = sim.makeCourse(2, 260, 0, 5, 'tri');
  assert.deepEqual(Object.keys(c.marks), ['mark', 'wing']);
  assert.deepEqual(c.legInfo.map((l) => l.beat), [false, true, false, false, true, false, false]);
  assert.equal(c.finish, null);
  assert.equal(sim.legAim(c, c.legs.indexOf('gate')).x, (c.gate[0].x + c.gate[1].x) / 2);
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

// The venues a free race can go to (public/game/venues.js; the set-up page's list is lib/venues.ts). Each one's land,
// baked by blender/venues.py, must be there, at the venue's own position and turned to its wind; and every course,
// in every wind, must be laid with its marks well clear of the shore. Each venue is sailed in a Node of its own, since
// the game picks its venue once, from the address, as the page loads.
test('the set-up page lists the game’s venues', async () => {
  const { VENUES } = await import('../public/game/venues.js');
  const page = await readFile(new URL('../lib/venues.ts', import.meta.url), 'utf8');
  assert.deepEqual([...page.matchAll(/\{ id: '([a-z-]+)', name: \['([^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2], m[3]]), VENUES.map((v) => [v.id, ...v.name]));
});

const { execFileSync } = await import('node:child_process');
const { VENUES } = await import('../public/game/venues.js');
for (const v of VENUES.filter((x) => x.id !== 'gocek')) {
  test(`${v.name[0]}: the land is baked, and every course is laid in clear water`, () => {
    const code = `
      import { readFile } from 'node:fs/promises';
      globalThis.location = { search: '?venue=${v.id}' };
      globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u))));
      const sim = await import(${JSON.stringify(new URL('../public/game/sim.js', import.meta.url).href)});
      const { SKOPEA } = await import(${JSON.stringify(new URL('../public/game/land.js', import.meta.url).href)});
      let worst = Infinity;
      for (const preset of ['light', 'medium', 'strong']) for (const length of ['short', 'medium', 'long']) for (const course of ['wl', 'tri']) {
        const r = new sim.Race({ preset, length, course, fleet: 7, laps: 1, seed: 1 }), c = r.course;
        for (const m of [c.windward, ...c.gate, c.pin, c.committee, ...(c.wing ? [c.wing] : [])]) worst = Math.min(worst, r.roomAt(m.x, m.z));
      }
      console.log(JSON.stringify({ origin: SKOPEA.meta.origin, turn: SKOPEA.meta.turn, worst }));`;
    const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }));
    assert.deepEqual(out.origin, [v.lat, v.lon], 'baked at the venue’s position');
    assert.equal(out.turn, v.wind, 'turned to the venue’s wind');
    assert.ok(out.worst >= 60, `a mark only ${Math.round(out.worst)} m from the shore`);
  });
}

// Up and down and the triangle, sailed before the course code was reshaped (test/golden.mjs --write made the fixture):
// the same finishes, leg times and tracks, to the tenth. Rewrite the fixture only when a change to the sailing is meant.
test('the existing shapes sail exactly as before the course refactor', async () => {
  const { goldenRuns } = await import('./golden.mjs');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/courses-golden.json', import.meta.url), 'utf8'));
  assert.deepEqual(goldenRuns(), fixture);
});
