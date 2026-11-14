// The site's own readers of a race, in Node: npm test. A result saved before the course shapes has no `type`; the
// site still names and lays it out as it did, and a new one is named by its shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { describe } = await import('../lib/result.ts');
const race = await import('../lib/race.ts');

const result = (course) => ({
  v: 1, id: 'x', at: Date.UTC(2026, 10, 20, 12), daily: null, preset: 'medium', length: 'short', laps: 1,
  course: { windward: [0, -260], gate: [[-22, -45], [22, -45]], pin: [-70, 0], committee: [70, 0], ...course },
  boats: [{ me: true, done: true, dsq: false, secs: 300, track: [] }, { me: false, done: true, dsq: false, secs: 310, track: [] }],
});

test('an old result still describes and lays out as before', () => {
  const old = result({ wing: [-182, -227] });
  assert.match(describe(old, 'en').detail, /triangle/);
  assert.match(describe(old, 'ru').detail, /треугольник/);
  assert.equal(race.shapeOf(old.course), 'tri');
  assert.match(describe(result({}), 'en').detail, /up and down/);
  assert.equal(race.shapeOf(result({}).course), 'wl');
  // its legs and distance as before: the beat, the wing mark, the gate, the finish
  const legs = race.courseLegs(1, 'tri');
  assert.deepEqual(legs, ['start', 'mark', 'wing', 'finish']);
  assert.ok(race.courseDistance(old.course, 1) > 0);
});

test('a new result names its shape', () => {
  const trap = race.plannedCourse('medium', 'short', 5, 'trap'), wlu = race.plannedCourse('medium', 'short', 5, 'wlu');
  assert.match(describe(result(trap), 'en').detail, /trapezoid/);
  assert.match(describe(result(trap), 'ru').detail, /трапеция/);
  assert.match(describe(result(wlu), 'en').detail, /upwind finish/);
  assert.match(describe(result(wlu), 'ru').detail, /финиш наверху/);
  // a shape the site doesn't know reads as its old fallback, not as nothing
  assert.equal(race.shapeOf({ type: 'zigzag' }), 'wl');
});

test('a saved course is kept when it is one of the four shapes, else up and down', () => {
  for (const s of ['wl', 'tri', 'trap', 'wlu']) assert.equal(race.savedShape(s), s);
  for (const s of [undefined, null, '', 'zigzag', 3]) assert.equal(race.savedShape(s), 'wl');
});

test('each shape has its own best-time key, up and down none', () => {
  const o = { preset: 'medium', laps: 1, length: 'short', fleet: 5 };
  assert.equal(race.pbKey({ ...o, course: 'wl' }), 'medium|1|short|5');
  assert.equal(race.pbKey({ ...o, course: 'tri' }), 'medium|1|short|5|tri');
  assert.equal(race.pbKey({ ...o, course: 'trap' }), 'medium|1|short|5|trap');
  assert.equal(race.pbKey({ ...o, course: 'wlu' }), 'medium|1|short|5|wlu');
});
