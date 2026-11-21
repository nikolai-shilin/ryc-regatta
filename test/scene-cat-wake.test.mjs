// A catamaran on the water: the F50 leaves a wake from each of her two hulls, each hull its own foam and shade at the
// waterline, and, flying, a thin trace behind each foil that cuts the water (both rudders and the leeward board), the
// hulls' wakes gone; the club boat's wake is as it was, down her middle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mock, ROOT } from './load.mjs';
import { installPage, fakeRenderer, FakeCanvas, seedRandom } from './fake-page.mjs';

const later = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => { const t = later(f, ms, ...a); if (ms >= 1000) t.unref?.(); return t; };
const real = pathToFileURL(join(ROOT, 'public/vendor/three@0.160.0/build/three.module.min.js')).href;
mock('three', `export * from '${real}'; export class WebGLRenderer { constructor(o) { return globalThis.__renderer(o); } }`);
globalThis.__renderer = () => fakeRenderer({ width: 1280, height: 720 });
installPage({ search: '?boat=f50' });
const { World } = await import('../public/game/world.js');
const { Race } = await import('../public/game/sim.js');
const { CLS, CLASSES } = await import('../public/game/classes.js');

seedRandom(99);
const world = new World(new FakeCanvas(1280, 720));
const race = new Race({ preset: 'medium', seed: 7, fleet: 2, start: 1, autoTrim: true });
world.setRace(race); world.resize(1280, 720); world.setQuality('high');
const P = race.player;
// her wake's ribbons, sailed at a steady state: where each one's newest point lies across her, and how strong it is
const ribbons = (w) => {
  const g = w.mesh.geometry, pos = g.attributes.position, st = g.attributes.aStr, kd = g.attributes.aKind, out = [];
  const rx = Math.cos(P.h), rz = Math.sin(P.h);
  for (let r = 0; r < w.R; r++) {
    const o = r * 64 * 2 + 4; // (a sample a little behind the newest, both edges)
    const x = ((pos.getX(o) + pos.getX(o + 1)) / 2 - P.x) * rx + ((pos.getZ(o) + pos.getZ(o + 1)) / 2 - P.z) * rz;
    out.push({ x, str: st.getX(o), arm: kd.getX(o) > 0.5 });
  }
  return out;
};
const sail = (s) => { for (let i = 0; i < 60; i++) { Object.assign(P, s); world.wakes[0].update(P, 1 / 10, i / 10, world.W, null); } };

test('the page sails the F50', () => assert.equal(CLS.id, 'f50'));

test('she has a contact patch at each hull, 3.7 m either side of her middle', () => {
  const mine = world.contacts.filter((c) => c.bi === 0);
  assert.deepEqual(mine.map((c) => c.dx).sort((a, b) => a - b), CLASSES.f50.hulls);
});

test('off her foils, a wash and two Kelvin arms from each hull, none from her foils', () => {
  sail({ v: 6, ride: 0, fly: false, boom: 1, twa: 0.8 });
  const rs = ribbons(world.wakes[0]), washes = rs.filter((r) => !r.arm && r.str > 0.5);
  assert.equal(washes.length, 2, `${washes.length} washes`);
  for (const sx of [-1, 1]) assert.ok(washes.some((r) => Math.abs(r.x - sx * 3.7) < 0.3), `a wash behind the hull at ${sx * 3.7}`);
  assert.equal(rs.filter((r) => r.arm && r.str > 0.5).length, 4, 'two arms a hull');
});

test('flying, a trace behind each rudder and the leeward board, the hulls\' wakes gone', () => {
  sail({ v: 15, ride: 1, fly: true, boom: 1, twa: 0.8 });
  const rs = ribbons(world.wakes[0]), live = rs.filter((r) => r.str > 0.5);
  assert.equal(live.length, 3, `${live.length} traces`);
  assert.ok(live.every((r) => !r.arm), 'no bow waves');
  for (const sx of [-1, 1]) assert.ok(live.filter((r) => Math.abs(r.x - sx * 3.7) < 0.3).length >= 1, `a trace at ${sx * 3.7}`);
  // the leeward board's, on her leeward side (boom 1: the wind from starboard, her leeward hull to port)
  assert.equal(live.filter((r) => Math.abs(r.x + 3.7) < 0.3).length, 2, 'the board and the rudder to leeward');
});
