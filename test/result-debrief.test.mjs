// The result page's debrief: a verdict only on what the race shows. A start near the line at the gun but over it long
// after isn't praised as the one that wins races, and tacks that came in no shift get no verdict on shifts. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { clock, done, h, mount, plain, reset } from './fake-dom.mjs';

const { default: ResultView } = await import('../components/result-view.tsx');
await import('../public/game/av-menu.js');

beforeEach(() => reset());
afterEach(done);

const boat = (p = {}) => ({ name: 'Bo', me: false, color: '#ff0000', flag: null, done: true, dsq: false, secs: 100, track: [[0, 0], [0, -100], [0, -300]], ...p });
const LOG = { gunD: 10, gunV: 5, ocs: false, startDsq: null, startT: null, sailing: 100, pct: 92, head: 3, lift: 1, tacks: 4, dirty: 5, penT: 0, hails: {}, legs: [40, 80], legPlaces: [3, 2], fouls: [] };
const result = (log) => ({
  v: 1, id: 'r1', at: clock.now - 60000, daily: null, preset: 'medium', length: 'short', laps: 1, start: 1, current: false, venue: 'gocek',
  course: { windward: [0, -300], gate: [[-20, 0], [20, 0]], pin: [-50, 10], committee: [50, 10], legs: ['mark', 'gate', 'finish'] },
  boats: [boat({ name: 'Ann', secs: 95 }), boat({ name: null, me: true, color: null, secs: 100 }), boat({ name: 'Cy', secs: 110 })],
  log: { ...LOG, ...log }, pb: { best: 100, isNew: false },
});
const page = (log) => { const r = result(log); localStorage.setItem(`regatta-result-${r.id}`, JSON.stringify(r)); return mount(h(ResultView, { id: r.id, lang: 'en' })); };
const items = (v) => v.$$('.rs-db li').map((l) => plain(l.innerHTML));

test('near the line at the gun but over it long after is a start to work on, not one that wins races', async () => {
  let v = await page({ gunD: 21, gunV: 3.9, startT: 17.9 });
  assert.match(items(v)[0], /^Work on it Start At the gun: 21 m from the line at 3\.9 kn Aim to be a boat length behind/);
  await v.unmount();
  v = await page({ gunD: 8, gunV: 4.8, startT: 3.2 });
  assert.match(items(v)[0], /^Good Start At the gun: 8 m from the line at 4\.8 kn Close to the line/);
  await v.unmount();
  v = await page({ gunD: 8, gunV: 4.8, startT: null }); // a result saved before the start's crossing was kept
  assert.match(items(v)[0], /^Good Start/);
});

test('tacks that came in no shift are neither praised nor faulted', async () => {
  let v = await page({ tacks: 1, head: 0, lift: 0 });
  assert.ok(!items(v).some((x) => /Tacks|tacked on the headers/.test(x)), 'no verdict on shifts not tacked in');
  await v.unmount();
  v = await page({ tacks: 4, head: 3, lift: 1 });
  assert.ok(items(v).some((x) => /Tacks On the beat: 3 in a header, 1 in a lift/.test(x)));
});
