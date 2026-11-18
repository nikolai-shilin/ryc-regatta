// What the game does round the race (public/game/extras.js), on a small stand-in for the page with the 3D boat left out:
// the analytics, the ghost you sail against, and each drill from the hand-over to its stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mock } from './load.mjs';

const def = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
let page = null;

mock('public/game/boats3d.js', 'export const makeBoatView = (o) => globalThis.__view(o);');
mock('public/game/yacht.js', "export const LOOKS = { Aurora: { name: 'Aurora' } }; export const playerLook = () => ({ name: 'mine' });");
def('location', { search: '', pathname: '/' });
def('fetch', async (u) => {
  const s = String(u);
  if (s.startsWith('file:')) return new Response(await readFile(new URL(s))); // land.js's bay files, from the disk
  page.fetched.push(s);
  return page.api(s);
});
const { along } = await import('../public/game/track.js');
const { beatAngle, polarSpeed, KN, D2R } = await import('../public/game/sim.js');

// ---------- the page ----------
class El {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.found = {}; this.className = ''; this.innerHTML = ''; this.textContent = ''; }
  append(...c) { for (const x of c) { this.children.push(x); x.parent = this; } }
  remove() { this.removed = true; this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(s) { return (this.found[s] ||= new El(s)); }
  focus() { this.focused = true; }
}
let loads = 0;
async function open({ search = '', stored = {}, lang = 'en', api = () => { throw new Error('nothing to fetch'); }, board = true, va, brokenStorage = false, random } = {}) {
  const data = new Map(Object.entries(stored).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const p = { data, api, fetched: [], on: {}, stops: 0, race: null, running: true, head: new El('head'), body: new El('body'), board: board ? new El('board') : null, views: [], added: [], removed: [] };
  page = p;
  def('location', { search, pathname: '/play' });
  p.win = va ? { va } : {};
  def('window', p.win);
  def('document', { head: p.head, body: p.body, createElement: (t) => new El(t), querySelector: (s) => (s === '.b-board' ? p.board : null) });
  def('addEventListener', (k, fn) => { (p.on[k] ||= []).push(fn); });
  def('localStorage', {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (brokenStorage) throw new Error('full'); data.set(k, String(v)); },
  });
  globalThis.__view = (o) => {
    const meshes = [{ material: material(0.5), castShadow: true }, { material: [material(), material(0.8)], castShadow: true }, { name: 'a group' }];
    const v = { o, noFine: false, updates: [], meshes, root: { visible: false, traverse: (fn) => meshes.forEach(fn) }, update(...a) { this.updates.push(a); } };
    p.views.push(v);
    return v;
  };
  const real = Math.random;
  if (random != null) Math.random = () => random;
  try { p.x = await import(`../public/game/extras.js?case=${++loads}`); } finally { Math.random = real; }
  p.ctx = { LANG: lang, world: { W: 'the waves', mode: 'chase', scene: { add: (v) => p.added.push(v), remove: (v) => p.removed.push(v) } }, getRace: () => p.race, isRunning: () => p.running, stop: () => { p.stops++; } };
  p.x.initExtras(p.ctx);
  p.events = () => (p.win.vaq || []).map((a) => a[1]);
  p.named = (name) => p.events().filter((e) => e.name === name);
  p.end = () => p.body.children.find((c) => c.className === 'drill-end bc');
  p.banner = () => p.body.children.find((c) => c.className === 'drill-k bc');
  p.stars = () => Number(p.end().innerHTML.match(/aria-label="(\d) \/ 3"/)[1]);
  p.line = () => p.end().querySelector('p').textContent;
  p.saved = () => JSON.parse(data.get('regatta-drills') || '{}');
  return p;
}
function material(opacity) { return { opacity, clone() { return { ...this, cloned: true }; } }; }

function aRace({ player, course, log, settings = {}, place = 1, fleet = 6, dist = 500, clock = 0, onStep } = {}) {
  const P = { name: 'me', x: 0, z: 0, h: 0, leg: 1, tws: 12, wdir: 0, twa: 0.7, v: 6, pens: 0, done: false, finish: null, events: ['said'], ...player };
  const rivals = Array.from({ length: fleet - 1 }, (_, i) => ({ name: `rival ${i}`, ai: { skill: 0.5, mood: 'keen' }, events: ['said'] }));
  const race = { player: P, boats: [P, ...rivals], clock, place, dist, over: false, settings, messages: ['said'], log: { ...log },
    course: { windward: { x: 0, z: -1000 }, pin: { x: -100, z: 0 }, committee: { x: 100, z: 0 }, dir: { x: 1, z: 0 }, len: 200, legs: ['start', 'mark', 'gate', 'mark', 'finish'], ...course },
    wind: { dir: () => 0, mean: () => 0, p: { tws: 12 } },
    standings() { const r = rivals.slice(); r.splice(this.place - 1, 0, P); return r; },
    distToNext: () => race.dist,
    step(dt) { race.clock += dt; race.steps = (race.steps || 0) + 1; onStep?.(race); },
  };
  return race;
}

// ---------- the analytics ----------
test('what is tracked goes to Vercel, queued until its script has come', async () => {
  const p = await open();
  p.x.track('Hello', { a: 1 });
  assert.deepEqual(p.events(), [{ name: 'Hello', data: { a: 1 } }]);
  assert.equal(p.win.vaq[0][0], 'event');
});

test("the analytics script's own function is left in place, and its failing stops nothing", async () => {
  const calls = [];
  const p = await open({ va: (...a) => calls.push(a) });
  p.x.track('Hello');
  assert.deepEqual(calls, [['event', { name: 'Hello', data: undefined }]]);
  const bad = await open({ va: () => { throw new Error('blocked'); } });
  assert.doesNotThrow(() => bad.x.track('Hello'));
});

test("the page's styles go in as the game starts", async () => {
  const p = await open();
  assert.equal(p.head.children.length, 1);
  assert.equal(p.head.children[0].tag, 'style');
  assert.match(p.head.children[0].textContent, /\.drill-end/);
});

const leaving = (p) => p.on.pagehide.forEach((fn) => fn());

test('a race left before its finish says where it was left', async () => {
  const p = await open();
  p.race = aRace({ clock: 300, player: { leg: 2 }, settings: { daily: '2026-11-18' } });
  leaving(p);
  assert.deepEqual(p.named('Race left')[0].data, { race: 'daily', leg: 2, min: 5 });
});

test('a free race left before its gun counts no minutes', async () => {
  const p = await open();
  p.race = aRace({ clock: -50, player: { leg: 0 } });
  leaving(p);
  assert.deepEqual(p.named('Race left')[0].data, { race: 'free', leg: 0, min: 0 });
});

for (const [name, set] of [
  ['no race on', (p) => { p.race = null; }],
  ['the game paused out of the race', (p) => { p.running = false; }],
  ['a race that is over', (p) => { p.race.over = true; }],
  ['a player already home', (p) => { p.race.player.done = true; }],
]) {
  test(`leaving says nothing with ${name}`, async () => {
    const p = await open();
    p.race = aRace();
    set(p);
    leaving(p);
    assert.equal(p.named('Race left').length, 0);
  });
}

test('a drill left half way is not a race left', async () => {
  const p = await open({ search: '?race=free&drill=start' });
  p.race = aRace({ clock: -30 });
  await p.x.onStart(p.race);
  leaving(p);
  assert.equal(p.named('Race left').length, 0);
});

for (const [name, settings, race] of [['today\'s', { daily: 'd' }, 'daily'], ['a free', {}, 'free']]) {
  test(`${name} race says it started`, async () => {
    const p = await open();
    p.race = aRace({ settings });
    await p.x.onStart(p.race);
    const [e] = p.named('Race start');
    assert.equal(e.data.race, race);
    assert.equal(typeof e.data.venue, 'string');
    assert.equal('drill' in e.data, false);
  });
}

test('a drill says it started, and which', async () => {
  const p = await open({ search: '?drill=start' });
  p.race = aRace();
  await p.x.onStart(p.race);
  assert.equal(p.named('Race start')[0].data.race, 'drill');
  assert.equal(p.named('Race start')[0].data.drill, 'start');
});

// ---------- the drills, as lists ----------
test('every drill is in the running order once, and sails as a drill that exists', async () => {
  const { DRILLS, DRILL_ORDER, LEVEL_ORDER } = await open().then((p) => p.x);
  assert.deepEqual([...DRILL_ORDER].sort(), Object.keys(DRILLS).sort());
  for (const [id, d] of Object.entries(DRILLS)) {
    assert.ok(LEVEL_ORDER.includes(d.level), id);
    if (d.as) assert.ok(DRILLS[d.as], id);
    assert.deepEqual(Object.keys(d.race).slice(0, 7), ['preset', 'fleet', 'length', 'laps', 'start', 'current', 'course'], id);
  }
  assert.deepEqual(LEVEL_ORDER.map((lv) => DRILL_ORDER.filter((id) => DRILLS[id].level === lv).length), [4, 4, 4, 3]);
  const levels = DRILL_ORDER.map((id) => LEVEL_ORDER.indexOf(DRILLS[id].level));
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'level by level');
});

test("the favoured end's line is skewed 12 degrees, one way or the other", async () => {
  assert.equal((await open({ random: 0.2 })).x.DRILLS.end.race.bias, -12);
  assert.equal((await open({ random: 0.7 })).x.DRILLS.end.race.bias, 12);
});

test('beginners are always in; each level opens with two thirds of the stars of the one below', async () => {
  const { levelOpen } = (await open()).x;
  assert.equal(levelOpen('beginner', {}), true);
  assert.equal(levelOpen('nonsense', {}), true);
  const beginner = { start: 2, mark: 2, layline: 2, penalty: 2 };
  assert.equal(levelOpen('club', { ...beginner, penalty: 1 }), false);
  assert.equal(levelOpen('club', beginner), true);
  const club = { end: 3, beat: 3, run: 2, finish: 0 };
  assert.equal(levelOpen('racer', { ...beginner, ...club }), true);
  assert.equal(levelOpen('racer', { ...beginner, ...club, run: 1 }), false);
  assert.equal(levelOpen('racer', club), false, "club's stars, but club isn't open");
  const racer = { tide: 2, light: 2, wing: 2, heavy: 2 };
  assert.equal(levelOpen('expert', { ...beginner, ...club, ...racer }), true);
  assert.equal(levelOpen('expert', { ...beginner, ...club, ...racer, heavy: 1 }), false);
});

test('the address says which drill is sailed, and what it sails', async () => {
  const p = await open({ search: '?race=free&drill=heavy' });
  assert.equal(p.x.drill, 'heavy');
  assert.deepEqual(p.x.drillSettings(), { preset: 'strong', fleet: 6, length: 'short', laps: 2, start: 1, current: 0, course: 'wl', level: 'racer' });
});

for (const search of ['', '?drill=nonsense', '?drill=']) {
  test(`no drill at "${search}"`, async () => {
    const p = await open({ search });
    assert.equal(p.x.drill, null);
    assert.equal(p.x.drillSettings(), null);
  });
}

// ---------- a drill's hand-over ----------
// where the computer skipper hands her over, for each drill
const HANDOVER = {
  start: { player: { leg: 0 }, clock: -60 }, end: { player: { leg: 0 }, clock: -60 }, port: { player: { leg: 0 }, clock: -60 }, tide: { player: { leg: 0 }, clock: -60 }, race: { player: { leg: 0 }, clock: -60 },
  mark: { dist: 100 }, wing: { dist: 100 }, beat: { dist: 100 }, light: { dist: 100 },
  run: { player: { leg: 2 } }, heavy: { player: { leg: 2 } }, back: { player: { leg: 2 } },
  finish: { player: { leg: 4 }, dist: 100 }, layline: { dist: 80 }, penalty: { clock: 31 },
};
async function drilled(id, o = {}, pageOpts = {}) {
  const p = await open({ search: `?race=free&drill=${id}`, ...pageOpts });
  const h = HANDOVER[id];
  p.race = aRace({ ...h, ...o, player: { ...h.player, ...o.player } });
  await p.x.onStart(p.race);
  p.frame = () => p.x.onFrame(p.race, 1 / 60, 0);
  return p;
}

const SKIPPER = [['mark', 0.35], ['layline', 0.35], ['penalty', 0.35], ['beat', 0.55], ['run', 0.55], ['finish', 0.55], ['light', 0.75], ['wing', 0.75], ['heavy', 0.75], ['back', 0.3]];
for (const [id, skill] of SKIPPER) {
  test(`in the ${id} drill a computer skipper of skill ${skill} sails her to the moment, and hands her over`, async () => {
    const seen = [], leg = HANDOVER[id].player?.leg ?? 1;
    const p = await drilled(id, { player: { leg: 0, auto: { tack: 1 } }, onStep: (r) => { seen.push({ ...r.player.ai }); r.player.leg = leg; } });
    const P = p.race.player;
    assert.equal(seen.length, 1, 'one step, and she is there');
    assert.equal(seen[0].skill, skill);
    assert.equal(seen[0].mood, 'keen', "the fleet's own way of sailing");
    assert.equal(seen[0].lineT, 0.5);
    assert.equal(P.ai, undefined);
    assert.equal(P.auto, null);
    assert.deepEqual(p.race.messages, [], 'what was said on the way is not said now');
    for (const b of p.race.boats) assert.deepEqual(b.events, []);
  });
}

for (const id of ['start', 'end', 'port', 'tide', 'race']) {
  test(`in the ${id} drill she is yours from the minute before`, async () => {
    const p = await drilled(id);
    assert.equal(p.race.steps, undefined);
    assert.deepEqual(p.race.messages, ['said']);
  });
}

const until = [
  ['mark', { player: { leg: 0 }, dist: 500 }, (r) => { if (r.steps === 10) r.player.leg = 1; if (r.steps === 20) r.dist = 129; }, 20],
  ['beat', { player: { leg: 1 }, dist: 800 }, (r) => { if (r.steps === 15) r.dist = 499; }, 15],
  ['run', { player: { leg: 1 } }, (r) => { if (r.steps === 12) r.player.leg = 2; }, 12],
  ['finish', { player: { leg: 3 }, dist: 100 }, (r) => { if (r.steps === 5) r.player.leg = 4; }, 5],
  ['back', { player: { leg: 2, x: 0, z: -1010 } }, (r) => { if (r.steps === 9) r.player.z = -900; }, 9],
  ['layline', { player: { leg: 1, x: 900, z: -900 }, dist: 300 }, (r) => { if (r.steps === 6) r.dist = 89; }, 6],
  ['penalty', { player: { leg: 1 }, clock: 29 }, null, 60],
];
for (const [id, o, onStep, steps] of until) {
  test(`the ${id} drill is handed over at its moment, and no sooner`, async () => {
    const p = await drilled(id, { ...o, onStep });
    assert.ok(Math.abs(p.race.steps - steps) <= 1, `after ${p.race.steps} steps`);
  });
}

test('the layline is handed over early with the mark inside the no-go cone, 170 m off', async () => {
  const p = await drilled('layline', { player: { x: 0, z: -850 }, dist: 150 });
  assert.equal(p.race.steps, undefined);
});

test('the wing drill goes to the wing mark where the course has one', async () => {
  const course = { legs: ['start', 'mark', 'wing', 'gate', 'finish'] };
  const p = await drilled('wing', { course, player: { leg: 1 }, dist: 100, onStep: (r) => { if (r.steps === 7) r.player.leg = 2; } });
  assert.equal(p.race.steps, 7);
});

test('the top-mark drill on a course with a wing mark still goes to the windward mark', async () => {
  const course = { legs: ['start', 'mark', 'wing', 'gate', 'finish'] };
  const p = await drilled('mark', { course, player: { leg: 1 }, dist: 100 });
  assert.equal(p.race.steps, undefined);
});

test('a skipper who never gets there gives up after ten minutes of the race', async () => {
  const p = await drilled('beat', { dist: 5000 });
  assert.equal(p.race.steps, 36000);
  assert.equal(p.race.player.ai, undefined);
});

test('the penalty drill starts with one turn owed', async () => {
  const p = await drilled('penalty', { player: { pens: 2 } });
  assert.deepEqual(p.race.player.pen, { tack: false, gybe: false, dir: 0 });
  assert.equal(p.race.player.pens, 3);
});

for (const lang of ['en', 'ru']) {
  test(`every drill says its level and what to do (${lang})`, async () => {
    const { DRILL_ORDER } = (await open()).x;
    for (const id of DRILL_ORDER) {
      const p = await drilled(id, {}, { lang });
      assert.doesNotMatch(p.banner().innerHTML, /undefined/, id);
      assert.match(p.banner().innerHTML, lang === 'ru' ? /<b>[А-Я]/ : /<b>[A-Z]/, id);
    }
  });
}

// ---------- each drill's stars ----------
const P_ = (r) => r.player;
const pass = (r, leg) => { r.player.leg = leg; };
// [drill, what happened, stars, what she is told, how it went, (where she was at the hand-over)]
const SCORES = [
  ['start', 'over the line at the gun', 0, /Over the line at the gun/, (r) => { r.log.ocs = true; r.clock = 8; }],
  ['start', 'disqualified at the start', 0, /Over the line at the gun/, (r) => { r.log.startDsq = 'U'; r.clock = 8; }],
  ['start', 'no start', 0, /No start this time/, (r) => { r.clock = 8; }],
  ['start', 'on the line at speed', 3, /At the gun: 5 m from the line at 5\.0 kn\. That is the start that wins races/, (r) => { Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],
  ['start', 'close and fairly quick', 2, /Three stars: under 10 m, over 4\.5 kn/, (r) => { Object.assign(r.log, { gunD: 20, gunV: 4 }); r.clock = 8; }],
  ['start', 'close but slow', 1, /At the gun: 9 m/, (r) => { Object.assign(r.log, { gunD: 9, gunV: 3 }); r.clock = 8; }],
  ['start', 'far back', 1, /At the gun: 40 m/, (r) => { Object.assign(r.log, { gunD: 40, gunV: 6 }); r.clock = 8; }],
  ['start', 'just over, and back behind it', 3, /At the gun: 0 m/, (r) => { Object.assign(r.log, { gunD: -2, gunV: 5 }); r.clock = 8; }],
  ['tide', 'over the line on the stream', 0, /The stream sets you/, (r) => { r.log.ocs = true; r.clock = 8; }],
  ['tide', 'a fair start on the stream', 2, /The stream sets you/, (r) => { Object.assign(r.log, { gunD: 20, gunV: 4 }); r.clock = 8; }],
  ['tide', 'a perfect start on the stream', 3, /wins races\.$/, (r) => { Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],

  ['mark', 'not rounded in time', 0, /wasn’t rounded in time/, (r) => { r.clock = 181; }],
  ['mark', 'a place gained', 3, /4th at the zone, 2nd after it\. Wide in, tight out/, (r, f) => { pass(r, 2); f(); r.clock += 21; r.place = 2; }, { place: 4 }],
  ['mark', 'the lead kept', 3, /1st at the zone, 1st after it/, (r, f) => { pass(r, 2); f(); r.clock += 21; }, { place: 1 }],
  ['mark', 'the same place', 2, /3rd at the zone, 3rd after it\. Three stars/, (r, f) => { pass(r, 2); f(); r.clock += 21; }, { place: 3 }],
  ['mark', 'a place lost', 1, /3rd at the zone, 5th after it/, (r, f) => { pass(r, 2); f(); r.clock += 21; r.place = 5; }, { place: 3 }],
  ['mark', 'a place gained with a penalty', 1, /with a penalty/, (r, f) => { pass(r, 2); f(); r.clock += 21; r.place = 1; P_(r).pens = 1; }, { place: 3 }],
  ['wing', 'the wing mark, a place gained', 3, /Wide in/, (r, f) => { pass(r, 2); f(); r.clock += 21; r.place = 2; }, { place: 4 }],

  ['beat', 'not at the mark in time', 0, /Not at the mark in time/, (r) => { r.clock = 601; }],
  ['beat', 'first or second there', 3, /You played the shifts/, (r) => { pass(r, 2); r.place = 2; }, { place: 5 }],
  ['beat', 'in the top half', 2, /5th halfway up, 3rd of 6 at the top mark\. Three stars/, (r) => { pass(r, 2); r.place = 3; }, { place: 5 }],
  ['beat', 'first but with a penalty', 2, /Three stars: first or second/, (r) => { pass(r, 2); r.place = 1; P_(r).pens = 1; }],
  ['beat', 'in the bottom half', 1, /6th of 6/, (r) => { pass(r, 2); r.place = 6; }, { place: 2 }],
  ['light', 'light air, second there', 3, /You played the shifts/, (r) => { pass(r, 2); r.place = 2; }],

  ['run', 'not through the gate in time', 0, /Not through the gate in time/, (r) => { r.clock = 301; }],
  ['run', 'a place gained', 3, /4th at the top mark, 3rd out of the gate\. Clear air/, (r, f) => { pass(r, 3); f(); r.clock += 11; r.place = 3; }, { place: 4 }],
  ['run', 'the lead kept', 3, /Clear air/, (r, f) => { pass(r, 3); f(); r.clock += 11; }],
  ['run', 'the same place', 2, /Three stars: a place gained/, (r, f) => { pass(r, 3); f(); r.clock += 11; }, { place: 2 }],
  ['run', 'a place lost', 1, /2nd at the top mark, 4th out of the gate/, (r, f) => { pass(r, 3); f(); r.clock += 11; r.place = 4; }, { place: 2 }],
  ['run', 'with a penalty', 1, /with a penalty/, (r, f) => { pass(r, 3); f(); r.clock += 11; P_(r).pens = 1; }],
  ['heavy', 'on her feet all the way', 3, /Clear air/, (r, f) => { f(); pass(r, 3); f(); r.clock += 11; r.place = 1; }, { place: 3 }],
  ['heavy', 'a broach', 1, /You broached on the way down/, (r, f) => { P_(r).broachT = 1; f(); P_(r).broachT = 0; pass(r, 3); f(); r.clock += 11; r.place = 1; }, { place: 3 }],
  ['heavy', 'the kite wrapped', 1, /The kite wrapped round the forestay/, (r, f) => { P_(r).kiteJob = { messy: true }; f(); P_(r).kiteJob = null; pass(r, 3); f(); r.clock += 11; }],
  ['heavy', 'a broach and no gate', 0, /Not through the gate in time/, (r, f) => { P_(r).broachT = 1; f(); r.clock = 301; }],

  ['finish', 'not over the line in time', 0, /Not over the line in time/, (r) => { r.clock = 301; }],
  ['finish', 'a place gained', 3, /3rd with 150 m to go, 2nd over the line\. You found the end/, (r) => { P_(r).done = true; r.place = 2; }, { place: 3 }],
  ['finish', 'the same place', 2, /Three stars: a place gained/, (r) => { P_(r).done = true; }, { place: 3 }],
  ['finish', 'a place lost', 1, /2nd with 150 m to go, 3rd over the line/, (r) => { P_(r).done = true; r.place = 3; }, { place: 2 }],
  ['finish', 'with a penalty', 1, /with a penalty/, (r) => { P_(r).done = true; P_(r).pens = 1; }],

  ['end', 'over the line', 0, /Over the line at the gun/, (r, f) => { r.clock = 0; f(); r.log.ocs = true; r.clock = 8; }],
  ['end', 'no start', 0, /No start this time/, (r, f) => { r.clock = 0; f(); r.clock = 8; }],
  ['end', 'at the end that paid', 3, /The end that paid: the pin\. At the gun you were 10% of the way along the line from it, 5 m .* at 5\.0 kn\. A head start/, (r, f) => { P_(r).x = -80; r.clock = 0; f(); Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],
  ['end', 'nearer that end than not', 2, /45% of the way/, (r, f) => { P_(r).x = -10; r.clock = 0; f(); Object.assign(r.log, { gunD: 20, gunV: 5 }); r.clock = 8; }],
  ['end', 'at that end but slow', 2, /Three stars: in the third of the line/, (r, f) => { P_(r).x = -80; r.clock = 0; f(); Object.assign(r.log, { gunD: 5, gunV: 3 }); r.clock = 8; }],
  ['end', 'at the wrong end', 1, /90% of the way/, (r, f) => { P_(r).x = 80; r.clock = 0; f(); Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],
  ['end', 'the committee boat further upwind, and there', 3, /The end that paid: the committee boat\. At the gun you were 10%/, (r, f) => { r.course.committee = { x: 100, z: -50 }; P_(r).x = 80; r.clock = 0; f(); Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],
  ['end', 'off the end of the line', 3, /0% of the way/, (r, f) => { P_(r).x = -300; r.clock = 0; f(); Object.assign(r.log, { gunD: 5, gunV: 5 }); r.clock = 8; }],

  ['layline', 'not at the mark in time', 0, /Not at the mark in time/, (r) => { r.clock = 241; }],
  ['layline', 'no tack needed', 3, /0 tacks, not overstood\. Tacked on the layline/, (r, f) => { f(); pass(r, 2); }],
  ['layline', 'one tack on the layline', 3, /^1 tack, not overstood/, (r, f) => { P_(r).auto = { gybe: false }; f(); P_(r).auto = null; f(); pass(r, 2); }],
  ['layline', 'two tacks', 3, /^2 tacks/, (r, f) => { for (let i = 0; i < 2; i++) { P_(r).auto = {}; f(); P_(r).auto = null; f(); } pass(r, 2); }],
  ['layline', 'a gybe is not a tack', 3, /^0 tacks/, (r, f) => { P_(r).auto = { gybe: true }; f(); P_(r).auto = null; f(); pass(r, 2); }],
  ['layline', 'three tacks', 2, /^3 tacks.*Three stars/, (r, f) => { for (let i = 0; i < 3; i++) { P_(r).auto = {}; f(); P_(r).auto = null; f(); } pass(r, 2); }],
  ['layline', 'four tacks', 1, /^4 tacks/, (r, f) => { for (let i = 0; i < 4; i++) { P_(r).auto = {}; f(); P_(r).auto = null; f(); } pass(r, 2); }],
  ['layline', 'a little past the layline', 2, /overstood by 13 m/, (r, f) => { Object.assign(P_(r), { x: 500 * Math.tan(0.72), z: -500, auto: {} }); f(); P_(r).auto = null; f(); pass(r, 2); }],
  ['layline', 'far past the layline', 1, /overstood by 137 m/, (r, f) => { Object.assign(P_(r), { x: 600, z: -500, auto: {} }); f(); P_(r).auto = null; f(); pass(r, 2); }],
  ['layline', 'a penalty on the way', 1, /with a penalty/, (r, f) => { f(); P_(r).pens = 1; pass(r, 2); }],
  ['layline', 'no angle measured: taken as a good beat', 3, /not overstood/, (r) => { r.dist = 20; pass(r, 2); }],

  ['penalty', 'not done in 90 s', 0, /wasn’t done, or she wasn’t back up to speed/, (r) => { r.clock += 91; }],
  ['penalty', 'still turning', 0, /wasn’t done/, (r) => { P_(r).v = 100; r.clock += 91; }],
  ['penalty', 'back up to speed quickly', 3, /in 15\.0 s\. Barely a dent/, (r) => { P_(r).pen = null; P_(r).v = 100; r.clock += 15; }],
  ['penalty', 'in fair time', 2, /in 25\.0 s\. Three stars/, (r) => { P_(r).pen = null; P_(r).v = 100; r.clock += 25; }],
  ['penalty', 'slowly', 1, /in 40\.0 s/, (r) => { P_(r).pen = null; P_(r).v = 100; r.clock += 40; }],
  ['penalty', 'a foul on the way', 1, /you fouled someone on the way/, (r) => { P_(r).pen = null; P_(r).v = 100; P_(r).pens += 1; r.clock += 10; }],

  ['port', 'over the line', 0, /Over the line at the gun/, (r) => { r.log.ocs = true; r.clock = 20; }],
  ['port', 'no start', 0, /No start in the first 20 s/, (r) => { r.clock = 20; }],
  ['port', 'on starboard', 1, /You started on starboard/, (r, f) => { pass(r, 1); P_(r).twa = 0.7; f(); r.clock = 20; }],
  ['port', 'on port but a foul', 1, /you fouled a starboard boat/, (r, f) => { pass(r, 1); P_(r).twa = -0.7; f(); P_(r).pens = 1; r.clock = 20; }],
  ['port', 'on port by the pin', 3, /On port, 10% along the line from the pin, 5 m from it at the gun\. Across the whole fleet/, (r, f) => { pass(r, 1); Object.assign(P_(r), { twa: -0.7, x: -80 }); f(); r.log.gunD = 5; r.clock = 20; }],
  ['port', 'on port up the line', 2, /On port, 50% along.*Three stars/, (r, f) => { pass(r, 1); P_(r).twa = -0.7; f(); r.log.gunD = 5; r.clock = 20; }],
  ['port', 'on port by the pin but late', 2, /Three stars: in the third/, (r, f) => { pass(r, 1); Object.assign(P_(r), { twa: -0.7, x: -80 }); f(); r.log.gunD = 30; r.clock = 20; }],

  ['back', 'not home in time', 0, /Not over the line in time/, (r) => { r.clock = 601; }],
  ['back', 'home but disqualified', 0, /disqualified/, (r) => { Object.assign(P_(r), { done: true, dsq: true }); }],
  ['back', 'three places made up', 3, /6th at the top mark, 3rd at the finish\. Through the fleet/, (r) => { P_(r).done = true; r.place = 3; }, { place: 6 }],
  ['back', 'three places made up, with a penalty', 2, /with a penalty/, (r) => { Object.assign(P_(r), { done: true, pens: 1 }); r.place = 3; }, { place: 6 }],
  ['back', 'one place made up', 2, /Three stars: three places/, (r) => { P_(r).done = true; r.place = 5; }, { place: 6 }],
  ['back', 'none made up', 1, /6th at the top mark, 6th at the finish/, (r) => { P_(r).done = true; r.place = 6; }, { place: 6 }],

  ['race', 'not home in time', 0, /Not over the line in time/, (r) => { r.clock = 901; }],
  ['race', 'disqualified', 0, /disqualified/, (r) => { Object.assign(P_(r), { done: true, dsq: true }); }],
  ['race', 'a win', 3, /1st of 6 against the experts\. You beat them all/, (r) => { P_(r).done = true; r.place = 1; }],
  ['race', 'a podium', 2, /3rd of 6.*Two: a podium/, (r) => { P_(r).done = true; r.place = 3; }],
  ['race', 'the rest', 1, /4th of 6/, (r) => { P_(r).done = true; r.place = 4; }],
  ['race', 'one penalty', 2, /2nd of 6 against the experts, 1 penalty/, (r) => { Object.assign(P_(r), { done: true, pens: 1 }); r.place = 2; }],
  ['race', 'two penalties', 1, /5th of 6 against the experts, 2 penalties/, (r) => { Object.assign(P_(r), { done: true, pens: 2 }); r.place = 5; }],
];
for (const [id, what, stars, line, play, init] of SCORES) {
  test(`${id} drill, ${what}: ${stars} stars`, async () => {
    const p = await drilled(id, init);
    play(p.race, p.frame);
    p.frame();
    assert.ok(p.end(), 'the drill has ended');
    assert.equal(p.stars(), stars);
    assert.match(p.line(), line);
  });
  test(`${id} drill, ${what}, in Russian: ${stars} stars, in Russian words`, async () => {
    const p = await drilled(id, init, { lang: 'ru' });
    play(p.race, p.frame);
    p.frame();
    assert.equal(p.stars(), stars);
    assert.match(p.line(), /[а-яё]{3}/i);
    assert.doesNotMatch(p.line(), /undefined|NaN/);
    assert.doesNotMatch(p.end().innerHTML, /undefined/);
  });
}

test('no drill ends before its time', async () => {
  const early = [['start', (r) => { r.clock = 7.9; }], ['tide', (r) => { r.clock = 7.9; }], ['end', (r) => { r.clock = 7.9; }], ['port', (r) => { r.clock = 19.9; }], ['mark', (r) => { r.clock = 179; }],
    ['beat', (r) => { r.clock = 599; }], ['run', (r) => { r.clock = 299; }], ['finish', (r) => { r.clock = 299; }], ['layline', (r) => { r.clock = 239; }], ['penalty', (r) => { r.clock += 89; }],
    ['back', (r) => { r.clock = 599; }], ['race', (r) => { r.clock = 899; }]];
  for (const [id, set] of early) {
    const p = await drilled(id);
    set(p.race);
    p.frame();
    assert.equal(p.end(), undefined, id);
    assert.equal(p.stops, 0, id);
  }
});

test('rounding the mark, the drill goes on for 20 s down the run', async () => {
  const p = await drilled('mark');
  pass(p.race, 2);
  p.frame();
  p.race.clock += 19;
  p.frame();
  assert.equal(p.end(), undefined);
  p.race.clock += 2;
  p.frame();
  assert.ok(p.end());
});

test('a turn not yet back on the wind, or not up to speed, is not done', async () => {
  const ba = beatAngle(12), full = polarSpeed(12, ba) * KN;
  const p = await drilled('penalty');
  Object.assign(p.race.player, { pen: null, twa: (ba + 13) * D2R, v: full });
  p.frame();
  assert.equal(p.end(), undefined, 'still too far off the wind');
  Object.assign(p.race.player, { twa: ba * D2R, v: full * 0.8 });
  p.frame();
  assert.equal(p.end(), undefined, 'still too slow');
  p.race.player.v = full * 0.86;
  p.frame();
  assert.ok(p.end());
});

test('only the first crossing counts for the port-tack start', async () => {
  const p = await drilled('port');
  pass(p.race, 1);
  Object.assign(p.race.player, { twa: -0.7, x: -80 });
  p.frame();
  Object.assign(p.race.player, { twa: 0.7, x: 80 });
  p.race.log.gunD = 5;
  p.race.clock = 20;
  p.frame();
  assert.equal(p.stars(), 3);
});

test('tacks after the mark is rounded are not counted against the layline', async () => {
  const p = await drilled('layline');
  pass(p.race, 2);
  p.race.player.auto = {};
  p.frame();
  assert.match(p.line(), /^0 tacks/);
});

// ---------- the end of a drill ----------
test('a drill ended stops the race once, takes down its banner and says so', async () => {
  const p = await drilled('start');
  const banner = p.banner();
  Object.assign(p.race.log, { gunD: 5, gunV: 5 });
  p.race.clock = 8;
  p.frame(); p.frame(); p.frame();
  assert.equal(p.stops, 1);
  assert.equal(banner.removed, true);
  assert.deepEqual(p.named('Drill done').map((e) => e.data), [{ drill: 'start', stars: 3 }]);
  const end = p.end();
  assert.deepEqual([end.attrs.role, end.attrs['aria-modal']], ['dialog', 'true']);
  assert.equal(end.querySelector('a.go').focused, true);
  assert.match(end.innerHTML, /Three stars/);
  assert.equal((end.innerHTML.match(/class="on"/g) || []).length, 3);
  assert.match(end.innerHTML, /href="\/play\?race=free&drill=start">Again/);
  assert.match(end.innerHTML, /href="\/race\/drills">All drills/);
});

const ending = async (id, stars, o = {}, pageOpts = {}) => {
  const p = await drilled(id, o, pageOpts);
  if (id === 'start') { Object.assign(p.race.log, stars === 3 ? { gunD: 5, gunV: 5 } : stars === 2 ? { gunD: 20, gunV: 4 } : stars === 1 ? { gunD: 40, gunV: 4 } : { ocs: true }); p.race.clock = 8; }
  if (id === 'penalty') { Object.assign(p.race.player, { pen: null, v: 100 }); p.race.clock += stars === 3 ? 15 : stars === 2 ? 25 : 40; }
  if (id === 'race') { p.race.player.done = true; p.race.place = stars === 3 ? 1 : stars === 2 ? 2 : 4; }
  p.frame();
  return p;
};

for (const [stars, title] of [[2, '2 stars'], [1, '1 star'], [0, 'Try again']]) {
  test(`${stars} stars are headed "${title}"`, async () => {
    assert.match((await ending('start', stars)).end().innerHTML, new RegExp(`<h2>${title}</h2>`));
  });
}
for (const [stars, title] of [[3, 'Три звезды'], [2, '2 звезды'], [1, '1 звезда'], [0, 'Ещё раз']]) {
  test(`${stars} stars in Russian are headed "${title}"`, async () => {
    assert.match((await ending('start', stars, {}, { lang: 'ru' })).end().innerHTML, new RegExp(`<h2>${title}</h2>`));
  });
}

test("a drill's stars are kept on this device", async () => {
  const p = await ending('start', 2, {}, { stored: { 'regatta-drills': { mark: 1 } } });
  assert.deepEqual(p.saved(), { mark: 1, start: 2 });
  assert.doesNotMatch(p.end().innerHTML, /A new best/, 'the first time is no record');
});

test('more stars than before are a new best', async () => {
  const p = await ending('start', 3, {}, { stored: { 'regatta-drills': { start: 1 } } });
  assert.deepEqual(p.saved(), { start: 3 });
  assert.match(p.end().innerHTML, /A new best on this drill/);
});

test('fewer stars than before leave the best as it was', async () => {
  const p = await ending('start', 1, {}, { stored: { 'regatta-drills': { start: 3 } } });
  assert.deepEqual(p.saved(), { start: 3 });
  assert.doesNotMatch(p.end().innerHTML, /A new best/);
});

test('spoiled stars on this device are started afresh', async () => {
  const p = await ending('start', 2, {}, { stored: { 'regatta-drills': '{not json' } });
  assert.deepEqual(p.saved(), { start: 2 });
});

test('a device that cannot keep the stars still shows them', async () => {
  const p = await ending('start', 3, {}, { brokenStorage: true });
  assert.equal(p.stars(), 3);
});

test('the star that opens the next level says so, and offers the next drill', async () => {
  const stored = { 'regatta-drills': { start: 3, mark: 2, layline: 2 } };
  const p = await ending('penalty', 1, {}, { stored }); // the eighth of the beginners' twelve
  assert.match(p.end().innerHTML, /<p class="lv">Club drills are open\.<\/p>/);
  assert.match(p.end().innerHTML, /href="\/play\?race=free&drill=end">Next drill/);
});

test('in Russian the level opened is named too', async () => {
  const stored = { 'regatta-drills': { start: 3, mark: 2, layline: 2 } };
  const p = await ending('penalty', 1, {}, { stored, lang: 'ru' });
  assert.match(p.end().innerHTML, /Открыты тренировки уровня «Клуб»/);
});

test('a level already open is not announced again', async () => {
  const stored = { 'regatta-drills': { start: 3, mark: 3, layline: 3, penalty: 1 } };
  const p = await ending('penalty', 2, {}, { stored });
  assert.doesNotMatch(p.end().innerHTML, /class="lv"/);
});

test('the next drill is not offered while its level is shut', async () => {
  const p = await ending('penalty', 1);
  assert.doesNotMatch(p.end().innerHTML, /Next drill/);
});

test('within a level the next drill is always offered', async () => {
  const p = await ending('start', 0);
  assert.match(p.end().innerHTML, /href="\/play\?race=free&drill=mark">Next drill/);
});

test('after the last drill there is no next', async () => {
  const p = await ending('race', 3);
  assert.doesNotMatch(p.end().innerHTML, /Next drill/);
});

// ---------- the ghost ----------
const DAY = '2026-11-18';
const ID = '12345678-1234-4234-8234-1234567890ab';
const TRACK = Array.from({ length: 83 }, (_, i) => [0, -10 * i]);
const sailed = (boat = {}, o = {}) => ({ id: 'r1', daily: DAY, start: 1, boats: [{ me: false }, { me: true, done: true, dsq: false, secs: 100, track: TRACK, legT: [10, 60], ...boat }], ...o });
const SETTING = { regatta: { ghost: 1, ghostV: 1 } };
const today = (o = {}) => aRace({ settings: { daily: DAY }, ...o });
async function withGhost(pageOpts = {}, race = today()) {
  const p = await open(pageOpts);
  p.race = race;
  await p.x.onStart(race);
  return p;
}

test('your best today sails with you when the setting is on', async () => {
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } });
  assert.equal(p.views.length, 1);
  assert.equal(p.added[0], p.views[0].root);
  assert.deepEqual(p.views[0].o.look, { name: 'mine' });
  assert.deepEqual(p.views[0].o.label, { text: 'Your best 1:40.0', color: 0xffffff });
  assert.deepEqual(p.named('Ghost')[0].data, { own: 1 });
});

test('the fastest of the day is the one that sails', async () => {
  const stored = { ...SETTING, 'regatta-result-a': sailed({ secs: 100 }), 'regatta-result-b': sailed({ secs: 90 }), 'regatta-result-c': sailed({ secs: 95 }) };
  const p = await withGhost({ stored });
  assert.match(p.views[0].o.label.text, /1:30\.0/);
});

const NOT_A_GHOST = [
  ['another day', sailed({}, { daily: '2026-11-17' })],
  ['a race not finished', sailed({ done: false })],
  ['a disqualified race', sailed({ dsq: true })],
  ['a race with no time', sailed({ secs: null })],
  ['a track of one point', sailed({ track: [[0, 0]] })],
  ['a race with no track', sailed({ track: undefined })],
  ['a race you were not in', { daily: DAY, boats: [{ me: false }] }],
  ['a record with no boats', { daily: DAY }],
  ['a spoiled record', '{not json'],
];
for (const [name, result] of NOT_A_GHOST) {
  test(`${name} makes no ghost`, async () => {
    const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': result, 'something-else': 1 } });
    assert.equal(p.views.length, 0);
    assert.equal(p.named('Ghost').length, 0);
  });
}

for (const [name, setting] of [['off', {}], ['never set', null], ['from an older version of it', { ghost: 1, ghostV: 0 }]]) {
  test(`with the ghost setting ${name} your best stays home`, async () => {
    const p = await withGhost({ stored: { ...(setting && { regatta: setting }), 'regatta-result-a': sailed() } });
    assert.equal(p.views.length, 0);
  });
}

test('a free race has no ghost', async () => {
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } }, aRace());
  assert.equal(p.views.length, 0);
});

test("a result link's race on this device is yours", async () => {
  const p = await withGhost({ search: `?race=today&ghost=${ID}`, stored: { [`regatta-result-${ID}`]: sailed() } });
  assert.deepEqual(p.fetched, []);
  assert.deepEqual(p.named('Ghost')[0].data, { own: 1 });
});

test('a link to your own race of another day makes no ghost, and asks nobody', async () => {
  const p = await withGhost({ search: `?ghost=${ID}`, stored: { [`regatta-result-${ID}`]: sailed({}, { daily: '2020-01-01' }) } });
  assert.equal(p.views.length, 0);
  assert.deepEqual(p.fetched, []);
});

test("someone else's race is asked for from the server, and sails as a ghost", async () => {
  const upper = ID.toUpperCase();
  const p = await withGhost({ search: `?ghost=${upper}`, api: () => ({ ok: true, json: async () => sailed() }) });
  assert.deepEqual(p.fetched, [`https://iyt.rycrentals.com/api/game?race=${ID}`]);
  assert.deepEqual(p.views[0].o.look, { name: 'Aurora' });
  assert.equal(p.views[0].o.label.text, 'Ghost 1:40.0');
  assert.deepEqual(p.named('Ghost')[0].data, { own: 0 });
});

test('the ghost is named in Russian for a Russian player', async () => {
  const own = await withGhost({ lang: 'ru', stored: { ...SETTING, 'regatta-result-a': sailed() } });
  assert.equal(own.views[0].o.label.text, 'Твой лучший 1:40.0');
  assert.match(own.board.children[0].innerHTML, /Лучший 1:40\.0/);
  const other = await withGhost({ lang: 'ru', search: `?ghost=${ID}`, api: () => ({ ok: true, json: async () => sailed() }) });
  assert.equal(other.views[0].o.label.text, 'Призрак 1:40.0');
});

for (const [name, api] of [['that it has no such race', () => ({ ok: false })], ['nothing at all', () => { throw new Error('offline'); }]]) {
  test(`a server that says ${name} leaves the race without a ghost`, async () => {
    const p = await withGhost({ search: `?ghost=${ID}`, api });
    assert.equal(p.views.length, 0);
  });
}

test("an address that isn't a race's id falls back on your own best", async () => {
  const p = await withGhost({ search: '?ghost=not-an-id', stored: { ...SETTING, 'regatta-result-a': sailed() } });
  assert.deepEqual(p.fetched, []);
  assert.equal(p.views.length, 1);
});

test('a ghost that comes in after the race has been left is not put on the water', async () => {
  let answer;
  const p = await open({ search: `?ghost=${ID}`, api: () => new Promise((r) => { answer = r; }) });
  const race = today();
  p.race = race;
  const going = p.x.onStart(race);
  p.race = today();
  answer({ ok: true, json: async () => sailed() });
  await going;
  assert.equal(p.views.length, 0);
});

test('a ghost that comes in after the race is over is not put on the water', async () => {
  let answer;
  const p = await open({ search: `?ghost=${ID}`, api: () => new Promise((r) => { answer = r; }) });
  p.race = today();
  const going = p.x.onStart(p.race);
  p.race.over = true;
  answer({ ok: true, json: async () => sailed() });
  await going;
  assert.equal(p.views.length, 0);
});

test('she is see-through, casts no shadow, and leaves the original materials alone', async () => {
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } });
  const [v] = p.views, [a, b] = v.meshes;
  assert.equal(v.noFine, true);
  assert.deepEqual([a.material.cloned, a.material.transparent, a.material.depthWrite], [true, true, false]);
  assert.ok(Math.abs(a.material.opacity - 0.16) < 1e-9);
  assert.ok(Math.abs(b.material[0].opacity - 0.32) < 1e-9, 'a material with no opacity of its own counts as solid');
  assert.ok(Math.abs(b.material[1].opacity - 0.256) < 1e-9);
  assert.deepEqual([a.castShadow, b.castShadow], [false, false]);
});

test('she has a row of her own on the board', async () => {
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } });
  const [row] = p.board.children;
  assert.equal(row.className, 'b-ghost');
  assert.match(row.innerHTML, /title="Your best · 1:40\.0">Best 1:40\.0/);
});

test('a page with no board still has her on the water', async () => {
  const p = await withGhost({ board: false, stored: { ...SETTING, 'regatta-result-a': sailed() } });
  assert.equal(p.views.length, 1);
});

test('the debug page can reach her', async () => {
  const p = await open({ stored: { ...SETTING, 'regatta-result-a': sailed() } });
  p.win.__rg = {};
  p.race = today();
  await p.x.onStart(p.race);
  assert.equal(p.win.__rg.ghost.secs, 100);
});

test('a time just short of the minute is shown as the next minute, not as 60 seconds', async () => {
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed({ secs: 119.97 }) } });
  assert.equal(p.views[0].o.label.text, 'Your best 2:00.0');
});

// ---------- the ghost on the water ----------
const ghosted = async (o = {}) => withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } }, today(o));

test('each frame she is where her track had her at this moment of the clock', async () => {
  const p = await ghosted();
  p.race.clock = 20.5;
  p.x.onFrame(p.race, 1 / 60, 7);
  const want = along(TRACK, 100, 1, 20.5), [b, t, W, drone] = p.views[0].updates[0];
  assert.deepEqual([b.x, b.z, b.h], [want.x, want.z, want.h]);
  assert.deepEqual([t, W, drone], [7, 'the waves', false]);
  assert.equal(p.views[0].root.visible, true);
});

test('from the drone her view is told so', async () => {
  const p = await ghosted();
  p.ctx.world.mode = 'drone';
  p.x.onFrame(p.race, 1 / 60, 0);
  assert.equal(p.views[0].updates[0][3], true);
});

test('she is a boat of her own: yours is not moved', async () => {
  const proto = { hello() { return 'hi'; } };
  const race = today({ player: { x: 5, z: 6 } });
  Object.setPrototypeOf(race.player, proto);
  const p = await withGhost({ stored: { ...SETTING, 'regatta-result-a': sailed() } }, race);
  p.race.clock = 30;
  p.x.onFrame(p.race, 1 / 60, 0);
  assert.deepEqual([race.player.x, race.player.z], [5, 6]);
  const [b] = p.views[0].updates[0];
  assert.notEqual(b, race.player);
  assert.equal(b.hello(), 'hi');
});

test('upwind she carries no kite and heels hard; downwind the kite is up', async () => {
  const p = await ghosted();
  p.race.clock = 30;
  p.x.onFrame(p.race, 1 / 60, 0); // her track runs north, into the wind
  const up = { ...p.views[0].updates[0][0] };
  assert.deepEqual([up.kite, up.kiteFill, up.heel, up.sail], [false, 0, 14, 12]);
  assert.equal(up.boom, 1, 'dead into the wind, the boom has to lie somewhere');
  p.race.wind.dir = () => Math.PI;
  p.x.onFrame(p.race, 1 / 60, 0);
  const down = p.views[0].updates[1][0];
  assert.deepEqual([down.kite, down.kiteFill, down.heel], [true, 1, 6]);
  assert.equal(down.sail, 80);
});

test('on a reach she heels less than on the wind', async () => {
  const p = await ghosted();
  p.race.wind.dir = () => Math.PI / 2;
  p.race.clock = 30;
  p.x.onFrame(p.race, 1 / 60, 0);
  const [b] = p.views[0].updates[0];
  assert.deepEqual([b.kite, b.heel, b.boom], [false, 10, 1]);
});

test('she is done once her finishing time has passed', async () => {
  const p = await ghosted();
  p.race.clock = 99;
  p.x.onFrame(p.race, 1 / 60, 0);
  assert.equal(p.views[0].updates[0][0].done, false);
  p.race.clock = 101;
  p.x.onFrame(p.race, 1 / 60, 0);
  assert.equal(p.views[0].updates[1][0].done, true);
});

test('a frame of another race does not move her', async () => {
  const p = await ghosted();
  p.x.onFrame(today(), 1 / 60, 0);
  assert.equal(p.views[0].updates.length, 0);
});

const gapAt = async (clock, player) => {
  const at = along(TRACK, 100, 1, 30);
  const p = await ghosted({ player: { x: at.x, z: at.z, leg: 1, ...player } });
  p.race.clock = clock;
  p.x.onFrame(p.race, 0.5, 0);
  return p.views[0] && p.board.children[0].querySelector('b');
};

test('behind her, the board says by how long', async () => {
  const gap = await gapAt(33);
  assert.equal(gap.textContent, '+3.0');
  assert.equal(gap.className, 'down');
});

test('ahead of her, the board says that too', async () => {
  const gap = await gapAt(28);
  assert.equal(gap.textContent, '−2.0');
  assert.equal(gap.className, 'up');
});

test('too far from her track to compare, the board says nothing', async () => {
  const gap = await gapAt(33, { x: 900 });
  assert.equal(gap.textContent, '—');
  assert.equal(gap.className, '');
});

test('home, the board has the difference in the two times', async () => {
  const gap = await gapAt(120, { done: true, finish: 97.5 });
  assert.equal(gap.textContent, '−2.5');
  assert.equal(gap.className, 'up');
});

test('the gap is worked out a few times a second, not every frame', async () => {
  const p = await ghosted({ player: { leg: 1 } });
  const gap = p.board.children[0].querySelector('b');
  p.race.clock = 33;
  p.x.onFrame(p.race, 0.2, 0);
  p.x.onFrame(p.race, 0.2, 0);
  assert.equal(gap.textContent, '');
  p.x.onFrame(p.race, 0.2, 0);
  assert.notEqual(gap.textContent, '');
});

test('a new race takes the ghost off the water and off the board', async () => {
  const p = await ghosted();
  const row = p.board.children[0];
  p.x.onNewRace();
  assert.deepEqual(p.removed, [p.views[0].root]);
  assert.equal(row.removed, true);
  p.x.onFrame(p.race, 1 / 60, 0);
  assert.equal(p.views[0].updates.length, 0);
  assert.doesNotThrow(() => p.x.onNewRace(), 'and with none there is nothing to take off');
});

test('starting again replaces the ghost with a new one', async () => {
  const p = await ghosted();
  p.race = today();
  await p.x.onStart(p.race);
  assert.equal(p.removed.length, 1);
  assert.equal(p.views.length, 2);
  assert.equal(p.board.children.length, 1);
});

test('with neither a ghost nor a drill a frame does nothing', async () => {
  const p = await open();
  p.race = aRace();
  assert.doesNotThrow(() => p.x.onFrame(p.race, 1 / 60, 0));
  assert.equal(p.stops, 0);
});
