// The site's own readers of a race, in Node: npm test. A result saved before the course shapes has no `type`; the
// site still names and lays it out as it did, and a new one is named by its shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
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

test('after signing in, only a path on this site', async () => {
  const { safeNext } = await import('../lib/next-path.ts');
  const base = 'https://www.sailupdown.com';
  for (const ok of ['/race', '/race/result/abc?lang=ru', '/admin', '/settings#sound']) assert.equal(safeNext(ok), ok);
  // each of these would leave the site once the browser parses it
  for (const bad of ['//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '\\/evil.com', 'https://evil.com', '', null, undefined]) {
    assert.equal(safeNext(bad), '/race', JSON.stringify(bad));
  }
  for (const v of ['/race', '/ /evil.com', '/%2F%2Fevil.com', '/%09/evil.com']) assert.equal(new URL(safeNext(v), base).host, 'www.sailupdown.com', v);
});

test('the 1-on-1 race is named as such, and its set-up offers all but the fleet', () => {
  for (const f of ['components/hub-client.tsx', 'components/home-back.tsx', 'components/home-client.tsx', 'app/og/page/[key]/route.tsx', 'app/[lang]/match/[code]/page.tsx', 'app/[lang]/match/new/page.tsx']) {
    assert.match(read(f), /1-on-1 race|1-on-1/, f); assert.match(read(f), /1 на 1|один на один/, f);
    assert.doesNotMatch(read(f), /Match race|Матчевая|Best of 3|До 2 побед/, f);
  }
  const setup = read('components/free-setup.tsx');
  assert.doesNotMatch(setup, /!match && l === 'long'|!match && tags\('(course|laps|start|current|daytime)'|match && p\.length === 'long'/);
  assert.match(setup, /!match && tags\('fleet'/);
  assert.match(setup, /fromToday \|\| match/);
  assert.match(setup, /course: p\.course, laps: p\.laps, start: p\.start, current: p\.current, daytime: p\.daytime/);
});

test('the result page shows a 1-on-1 race as such', () => {
  const view = read('components/result-view.tsx');
  assert.match(view, /oneOnOne\?: boolean/); assert.match(view, /dnf\?: boolean/);
  assert.match(view, /'1-on-1 race', 'Гонка 1 на 1'/); assert.match(view, /'Did not finish'/);
  assert.match(view, /one \? '\/match\/new'/);
  assert.match(view, /!shared && !one && <ShareButton/);
});

test('the result page tells a win by a boat dropping out, and no winner, in both languages', () => {
  const view = read('components/result-view.tsx');
  assert.match(view, /You won: \$\{[^}]+\} dropped out/); assert.match(view, /Ты победил: \$\{[^}]+\} — сход/);
  assert.match(view, /'No winner', 'Без победителя'/);
  assert.match(view, /standing\(res, b\) === 'place' \? i \+ 1 : '–'/, 'a place number only for a boat home');
});

test('a 1-on-1 race posts no rating, and its button is counted as its own', () => {
  const view = read('components/result-view.tsx');
  assert.match(view, /!shared && !one && Date\.now\(\) - res\.at < 864e5 && <RateRace/);
  assert.match(view, /race: one \? 'one-on-one' : res\.daily \? 'daily' : 'free', \.\.\.\(target/);
});

test('the loading screen names the 1-on-1 race, under today\'s rules', () => {
  const play = read('public/play/index.html');
  assert.match(play, /match \? t\('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1'\)/);
  assert.doesNotMatch(play, /Match race|Матчевая гонка|match-racing rules|правилам матчевых гонок/);
  assert.match(play, /under the rules of today’s race/); assert.match(play, /по правилам гонки дня/);
});
