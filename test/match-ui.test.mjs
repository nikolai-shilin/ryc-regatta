// The 1-on-1 race's screens (public/game/match-ui.js): every word in both languages, main.js's calls, and the two screens
// themselves, on a small stand-in for the page, over the in-memory hub and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { memoryRealtime } from './hub.mjs';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const { MATCH_STRINGS: S } = await import('../public/game/match-ui.js');
const { lineD } = await import('../public/game/sim.js');

test('the match screens have every word in both languages', async () => {
  const { MATCH_STRINGS: S } = await import('../public/game/match-ui.js');
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(S.ru), keys(S.en));
  for (const lang of ['en', 'ru']) for (const [k, v] of Object.entries(S[lang])) {
    if (typeof v === 'function') assert.equal(typeof v('A', 'B', 'C'), 'string', `${lang}.${k}`);
    else assert.ok(typeof v === 'string' && v.length, `${lang}.${k}`);
  }
});

test("main.js says each of a match's calls in both languages", () => {
  const main = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
  const ru = main.slice(main.indexOf('\n  ru: {'));
  const en = main.slice(main.indexOf('\n  en: {'), main.indexOf('\n  ru: {'));
  for (const k of ['entered', 'entryEarly', 'entryLate', 'umpire', 'theyOwe', 'penStart', 'penNow', 'finishOwed', 'raceWon', 'raceLost', 'matchWon', 'matchLost', 'waitingHost', 'guestGone', 'abandoned', 'full']) {
    for (const [lang, src] of [['en', en], ['ru', ru]]) assert.match(src, new RegExp(`\\b${k}: `), `${lang}.${k}`);
  }
});

test('a match loads its own modules only when it runs: none of them is in the page or main.js imports', () => {
  const main = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
  const play = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
  for (const m of ['match-ui', 'match', 'net', 'wire']) {
    assert.doesNotMatch(main, new RegExp(`^import [^\\n]*'\\./${m}\\.js'`, 'm'), m);
    assert.doesNotMatch(play, new RegExp(`/game/${m}\\.js`), m);
  }
  assert.match(main, /import\('\.\/match-ui\.js'\)/);
});

test('seconds are said in each language\'s own unit ("через 45 с", not "45 s")', async () => {
  const { MATCH_STRINGS: S } = await import('../public/game/match-ui.js');
  assert.equal(S.en.sec, 's');
  assert.equal(S.ru.sec, 'с');
  const ui = readFileSync(new URL('../public/game/match-ui.js', import.meta.url), 'utf8');
  // every call of fmtS (not its definition) gives the unit
  for (let i = ui.indexOf('fmtS('); i >= 0; i = ui.indexOf('fmtS(', i + 1)) {
    if (ui.slice(i - 6, i) === 'const ') continue;
    let d = 0, j = i + 4;
    do { if (ui[j] === '(') d++; else if (ui[j] === ')') d--; j++; } while (d > 0);
    assert.match(ui.slice(i, j), /, L\.sec\)$/, ui.slice(i, j));
  }
});


test('a shared race posts nothing and never jumps to the result page at the finish', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const stats = read('../public/game/stats.js'), main = read('../public/game/main.js');
  assert.equal((stats.match(/race\.multi/g) || []).length, 5);
  assert.match(main, /if \(!race\.multi\) setTimeout\(finishToPage/);
});

// ---------- what the card and the note say ----------
test('the card\'s rows: the winner first, the second with the gap, DSQ or DNF in place of a place', async () => {
  const { cardRows } = await import('../public/game/match-ui.js');
  const home = (id, place, finish) => ({ id, done: true, dsq: false, dnf: false, place, finish });
  // both home
  assert.deepEqual(cardRows([home('h', 2, 130), home('g', 1, 118)], { winner: 'g', margin: 12 }), [{ id: 'g', mark: '1', gap: null }, { id: 'h', mark: '2', gap: 12 }]);
  // first across with a penalty unserved: disqualified, and the next boat home wins
  assert.deepEqual(cardRows([{ ...home('h', null, 100), dsq: true }, home('g', 1, 118)], { winner: 'g', margin: null }), [{ id: 'g', mark: '1', gap: null }, { id: 'h', mark: 'DSQ', gap: null }]);
  // still racing at the limit
  assert.deepEqual(cardRows([home('h', 1, 100), { id: 'g', done: false, dnf: true }], { winner: 'h', margin: null }), [{ id: 'h', mark: '1', gap: null }, { id: 'g', mark: 'DNF', gap: null }]);
  // out under the black flag, never home; the other gave up: no winner
  assert.deepEqual(cardRows([{ id: 'h', done: false, bfd: true }, { id: 'g', done: false }], { winner: null, margin: null }), [{ id: 'h', mark: 'DSQ', gap: null }, { id: 'g', mark: 'DNF', gap: null }]);
  // given up: the boat left on the water has it, and has no time
  assert.deepEqual(cardRows([{ id: 'g', done: false }, { id: 'h', done: false }], { winner: 'h', margin: null, forfeited: 'g' }), [{ id: 'h', mark: '1', gap: null }, { id: 'g', mark: 'DNF', gap: null }]);
  // a page reloaded after the race has only the result
  assert.deepEqual(cardRows([{ id: 'h' }, { id: 'g' }], { winner: 'g', margin: 3 }), [{ id: 'g', mark: '1', gap: null }, { id: 'h', mark: '2', gap: 3 }]);
  assert.deepEqual(cardRows([{ id: 'h' }, { id: 'g' }], { winner: 'g', margin: null }), [{ id: 'g', mark: '1', gap: null }, { id: 'h', mark: '', gap: null }]);
});

test('the time left runs from the first valid finish, on either screen, and there is none without one', async () => {
  const { timeLeft } = await import('../public/game/match-ui.js');
  const race = (clock, ...humans) => ({ clock, humans });
  assert.equal(timeLeft(race(100, { done: true, dsq: false, finish: 40 }, { done: false }), 180), 120);
  assert.equal(timeLeft(race(400, { done: true, dsq: false, finish: 40 }, { done: false }), 180), 0, 'never below nothing');
  assert.equal(timeLeft(race(100, { done: true, dsq: true, finish: 40 }, { done: false }), 180), null, 'a disqualified boat home starts no limit');
});

// ---------- the two screens themselves: match-ui.js on a small page, over the in-memory hub ----------
class El {
  constructor(tag = 'div') {
    Object.assign(this, { tag, kids: [], parent: null, heard: {}, hidden: false, disabled: false, value: '', id: '', className: '', placeholder: '', own: '', style: { setProperty() {} } });
    const list = () => this.className.split(/\s+/).filter(Boolean);
    this.classList = { add: (c) => { this.className = [...new Set([...list(), c])].join(' '); }, remove: (c) => { this.className = list().filter((x) => x !== c).join(' '); }, toggle: (c, on) => this.classList[on ? 'add' : 'remove'](c), contains: (c) => list().includes(c) };
  }
  append(...xs) { for (const x of xs) { const e = x instanceof El ? x : Object.assign(new El('#text'), { own: String(x) }); e.parent = this; this.kids.push(e); } }
  get firstChild() { return this.kids[0] ?? null; }
  get textContent() { return this.own + this.kids.map((k) => k.textContent).join(''); }
  set textContent(s) { this.kids = []; this.own = String(s); }
  set innerHTML(s) {
    this.kids = []; this.own = '';
    let at = this;
    for (const [, close, tag, attrs, text] of s.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
      if (text !== undefined) { if (text.trim()) at.append(text); continue; }
      if (close) { at = at.parent; continue; }
      const e = new El(tag);
      for (const [, k, v] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) { if (k === 'class') e.className = v; else if (k === 'id') e.id = v; else if (k === 'hidden') e.hidden = true; }
      at.append(e);
      if (tag !== 'input') at = e;
    }
  }
  *walk() { for (const k of this.kids) { yield k; yield* k.walk(); } }
  is(simple) { return (simple.match(/[#.]?[\w-]+/g) || []).every((p) => (p[0] === '#' ? this.id === p.slice(1) : p[0] === '.' ? this.classList.contains(p.slice(1)) : this.tag === p)); }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    return [...this.walk()].filter((e) => {
      if (!e.is(parts.at(-1))) return false;
      let i = parts.length - 2;
      for (let a = e.parent; a && i >= 0; a = a.parent) if (a.is(parts[i])) i--;
      return i < 0;
    });
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  addEventListener(k, fn) { (this.heard[k] ||= []).push(fn); }
  click() { for (const fn of this.heard.click || []) fn({}); }
  focus() {} blur() {} select() {}
}

// the clock, and the screen whose code is running: its page, its storage and its timers
const clock = { t: 1e6 };
let on = null;
const CODE = 'ABC234', FRAME_S = 1 / 60;
let wire = memoryRealtime();
Date.now = () => clock.t;
for (const [k, get] of Object.entries({ document: () => on.doc, localStorage: () => on.ls })) Object.defineProperty(globalThis, k, { get, configurable: true });
Object.assign(globalThis, {
  location: { origin: 'http://game.test', search: '', reload() {}, replace() {} }, addEventListener() {},
  setInterval: (fn, ms) => { const x = { fn, ms, at: clock.t + ms }; on.timers.push(x); return x; },
  clearInterval: (x) => { on.timers = on.timers.filter((o) => o !== x); },
  fetch: async (u) => (u === '/connect' ? { ok: true, json: async () => ({ url: 'u', key: 'k', name: on.name, build: 'b1' }) } : new Response(await readFile(new URL(String(u))))),
  __realtime: () => {
    const me = on;
    return { setHeartbeat() {}, reconnect() {}, close() {}, lastHeard: () => clock.t,
      channel(topic, o) {
        const ch = wire.channel(topic, o), give = ch._deliver;
        ch._deliver = (e, p) => { const was = on; on = me; try { me.tamper?.(e, p); if (!me.deaf?.(e, p)) give(e, p); } finally { on = was; } };
        me.channels.push(ch);
        return ch;
      } };
  },
});
registerHooks({ resolve: (spec, ctx, next) => (spec === './net.js' ? { url: 'data:text/javascript,export const realtime = (o) => globalThis.__realtime(o);', shortCircuit: true } : next(spec, ctx)) });

let opened = 0;
// a page opened: match-ui.js's own copy of the module, the page's storage (ls: the same page reloaded)
async function page(name, { host = false, settings = {}, ls = null } = {}) {
  const s = { name, timers: [], channels: [], kept: [], opened: [], ended: 0, raced: 0, session: null, racing: false, doc: { head: new El('head'), body: new El('body'), activeElement: null, visibilityState: 'visible', createElement: (t) => new El(t), addEventListener() {}, execCommand() {} },
    ls: ls ?? Object.create({ getItem(k) { return k in this ? this[k] : null; }, setItem(k, v) { this[k] = String(v); }, removeItem(k) { delete this[k]; } }) };
  s.$ = (sel) => s.doc.body.querySelector(sel);
  s.shows = (sel) => { const e = s.$(sel); return !!e && !e.hidden; };
  s.says = (sel) => s.$(sel)?.textContent ?? '';
  s.rows = () => s.doc.body.querySelectorAll('#mCard .m-rows div').map((r) => r.kids.map((k) => k.textContent));
  s.cur = () => s.session.debug.cur;
  s.gone = () => { for (const c of s.channels) c.leave(); s.timers = []; s.racing = false; };
  on = s;
  if (host) { s.ls.setItem('regatta-match-host', JSON.stringify({ code: CODE })); s.ls.setItem('regatta-match-settings', JSON.stringify({ venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short', ...settings })); }
  s.mod = await import(`../public/game/match-ui.js?page=${++opened}`);
  await s.mod.startMatch({ code: CODE, t: (k, ...a) => [k, ...a].join(' '), LANG: 'en', venue: { id: 'palma' }, cls: { id: 'jpk1050' },
    onRace: (x) => { s.session = x; s.racing = true; s.raced++; }, onIdle: () => { s.racing = false; }, onEnd: () => { s.ended++; },
    keepOneOnOne: (race, results) => { s.kept.push(results); return `${name}-record-${s.kept.length}`; }, openResult: (id) => s.opened.push(id) });
  return s;
}
// time passing on the screens: the game's frames while a race is on screen, and each page's timers
function run(secs, ...pages) {
  for (let i = 0, n = Math.round(secs / FRAME_S); i < n; i++) {
    clock.t += 1000 * FRAME_S;
    for (const s of pages) {
      on = s;
      if (s.racing) s.session.step(FRAME_S);
      for (const x of s.timers) if (clock.t >= x.at) { x.at = clock.t + x.ms; x.fn(); }
    }
  }
}
// the host presses Start with her guest in the room, and the race is on both screens
async function sailing(settings = {}) {
  wire = memoryRealtime();
  const h = await page('Host', { host: true, settings }), g = await page('Guest');
  run(0.5, h, g);
  on = h; h.$('.m-start').click();
  run(1.5, h, g);
  assert.ok(h.cur().H, 'the host\'s race is running');
  assert.ok(g.cur().G, 'the guest\'s is following');
  const hr = h.cur().race;
  hr.clock = 60; // the gun long gone
  return { h, g, hr, H: hr.player, G: hr.humans.find((b) => b !== hr.player) };
}
// boat b three metres short of the finish, and sailing across it
function home(r, b) {
  const c = r.course, x = (c.pin.x + c.committee.x) / 2, z = (c.pin.z + c.committee.z) / 2;
  Object.assign(b, { x: x + c.normal.x * 3, z: z + c.normal.z * 3, h: Math.atan2(-c.normal.x, c.normal.z), v: 4, leg: c.legs.length - 1, auto: null, rudder: 0, yawRate: 0 });
  b.lastD = lineD(c, b); b.lastZ = b.z;
}
const CARD_S = 4; // (a race's end stays on the water 3.5 s before its card)
const HOME_S = 2.5; // (three metres to the finish, in whatever wind the race's seed has drawn, and the word of it on both screens)

test('a race on two screens: the settings reach both, and the seed is the race\'s', async () => {
  const { h, g } = await sailing({ course: 'tri', laps: 2, start: 3, preset: 'strong' });
  for (const s of [h, g]) {
    const r = s.cur().race;
    assert.equal(r.course.type, 'tri', s.name); assert.equal(r.seq[0].t, -180, s.name); assert.equal(r.multi, true, s.name);
    assert.equal(r.settings.fleet, 2); assert.equal(r.settings.daily, null); assert.equal(r.settings.laps, 2); assert.equal(r.settings.preset, 'strong');
    assert.equal(r.seed, h.cur().race.seed);
  }
  h.gone(); g.gone();
});

test('the guest repairs what the host sends: a course this build doesn\'t know is the plain one', async () => {
  wire = memoryRealtime();
  const h = await page('Host', { host: true }), g = await page('Guest');
  const bad = (p) => { if (p?.start?.settings) p.start.settings = { ...p.start.settings, course: 'zz', laps: 9 }; if (p?.settings && p.seed !== undefined) p.settings = { ...p.settings, course: 'zz', laps: 9 }; };
  g.tamper = (e, p) => { if (e === 'mstate' || e === 'start') bad(p); };
  run(0.5, h, g);
  on = h; h.$('.m-start').click();
  run(1.5, h, g);
  assert.equal(g.cur().race.settings.course, 'wl');
  assert.equal(g.cur().race.settings.laps, 1);
  h.gone(); g.gone();
});

test('both home: the finished boat is told who is out and the time left, each screen keeps its record once, and the card has the places and the gap', async () => {
  const { h, g, hr, H, G } = await sailing();
  home(hr, H);
  run(6, h, g);
  assert.equal(H.done, true);
  assert.match(h.says('#mNote'), /Guest is still racing/);
  assert.match(h.says('#mNote'), /2:5\d left/);
  assert.match(h.says('#mNote'), new RegExp(S.en.keepOpen), 'the host is told to keep her screen open');
  assert.equal(g.shows('#mNote'), false, 'the boat still racing has no such note');
  hr.clock += 10;
  home(hr, G);
  run(HOME_S, h, g);
  assert.equal(hr.over, true);
  assert.equal(h.shows('#mNote'), false);
  assert.equal(h.kept.length, 1, 'the host keeps it at the race\'s end');
  assert.equal(g.kept.length, 1, 'the guest as her results come');
  assert.deepEqual(g.kept[0].boats.map((b) => b.id).sort(), [H.id, G.id].sort(), 'both boats\' results');
  run(CARD_S, h, g);
  for (const s of [h, g]) {
    assert.equal(s.shows('#mCard'), true, s.name);
    assert.equal(s.racing, false, `${s.name}: the game's frames have stopped`);
    assert.deepEqual(s.rows().map((r) => r.slice(0, 2)), [['1', s === h ? 'you' : 'Host'], ['2', s === h ? 'Guest' : 'you']], s.name);
    assert.equal(s.rows()[1][2], S.en.by(`${hr.margin.toFixed(1)} s`), `${s.name}: the gap`);
    assert.equal(s.shows('#mCard .m-full'), true, `${s.name}: Full result`);
  }
  assert.equal(h.says('#mCardH'), 'raceWon');
  assert.equal(g.says('#mCardH'), 'raceLost Host');
  run(2, h, g);
  assert.equal(h.shows('#mCard .m-go'), true, 'Rematch is the host\'s');
  assert.equal(h.says('#mCard .m-go'), S.en.rematch);
  assert.equal(g.shows('#mCard .m-go'), false);
  assert.equal(g.says('#mCard .m-st'), S.en.waitRematch('Host'));
  run(8, h, g);
  assert.equal(h.kept.length, 1, 'once'); assert.equal(g.kept.length, 1, 'once');
  // Full result opens this screen's own record and leaves the race; the other is told and keeps hers
  on = g; g.$('#mCard .m-full').click();
  assert.deepEqual(g.opened, ['Guest-record-1']);
  assert.equal(g.ended, 0, 'to the result page, not the hub');
  run(1, h);
  assert.equal(h.says('#mCard .m-st'), S.en.left('Guest'));
  assert.equal(h.shows('#mCard .m-go'), false, 'no rematch without her');
  assert.equal(h.shows('#mCard .m-full'), true, 'her own Full result stands');
  on = h; h.$('#mCard .m-full').click();
  assert.deepEqual(h.opened, ['Host-record-1']);
});

test('after the card opens the host goes on sending the end and the results until the guest has them; Full result waits for them', async () => {
  const { h, g, hr, H, G } = await sailing();
  let results = 0, ends = 0;
  g.deaf = (e) => { if (e === 'results') results++; if (e === 'end') ends++; return e === 'results'; }; // her line drops the results
  home(hr, H); home(hr, G);
  run(HOME_S + CARD_S, h, g);
  assert.equal(h.shows('#mCard'), true); assert.equal(g.shows('#mCard'), true);
  assert.equal(h.racing, false, 'the host\'s frames have stopped');
  assert.equal(g.kept.length, 0);
  assert.equal(g.shows('#mCard .m-full'), false, 'no Full result before her results are in');
  assert.equal(h.shows('#mCard .m-full'), true, 'the host has hers');
  assert.equal(h.shows('#mCard .m-go'), false, 'no rematch before she has them');
  const r0 = results, e0 = ends;
  run(10, h, g);
  assert.ok(results - r0 >= 9, `the results repeated ${results - r0} times in 10 s`);
  assert.ok(ends - e0 >= 9, `the end repeated ${ends - e0} times in 10 s`);
  assert.equal(h.cur().H.stopped, false); assert.equal(g.cur().G.stopped, false);
  g.deaf = null; // her line is back
  run(2, h, g);
  assert.equal(g.kept.length, 1);
  assert.equal(g.shows('#mCard .m-full'), true);
  assert.equal(h.cur().H.acked, true);
  assert.equal(h.cur().H.stopped, true, 'answered: the host stops');
  assert.equal(g.cur().G.stopped, true);
  run(1, h, g);
  assert.equal(h.shows('#mCard .m-go'), true, 'and the rematch is there');
  h.gone(); g.gone();
});

test('a guest whose results never come: thirty seconds, and the two screens let go', async () => {
  const { h, g, hr, H, G } = await sailing();
  g.deaf = (e) => e === 'results';
  home(hr, H); home(hr, G);
  run(HOME_S + CARD_S, h, g);
  run(20, h, g);
  assert.equal(h.cur().H.stopped, false); assert.equal(g.cur().G.stopped, false);
  run(12, h, g);
  assert.equal(h.cur().H.stopped, true); assert.equal(g.cur().G.stopped, true);
  assert.equal(g.kept.length, 0); assert.equal(g.shows('#mCard .m-full'), false);
  h.gone(); g.gone();
});

test('the guest leaving before her finish forfeits at once: the host has the race, and the card says so', async () => {
  const { h, g, hr, G } = await sailing();
  on = g; g.mod.leaveMatch();
  assert.equal(g.ended, 1, 'she goes to the hub');
  run(0.5, h);
  assert.equal(hr.over, true); assert.equal(hr.forfeited, G);
  run(CARD_S, h);
  assert.equal(h.says('#mCardH'), 'raceWon');
  assert.deepEqual(h.rows().map((r) => r.slice(0, 2)), [['1', 'you'], ['DNF', 'Guest']]);
  assert.equal(h.says('#mCard .m-sub'), S.en.forfeit('Guest'));
  assert.equal(h.kept.length, 1);
  assert.equal(h.shows('#mCard .m-go'), false, 'she has gone: no rematch');
  h.gone(); g.gone();
});

test('the guest leaving after her finish: her place stands, and the race runs on for the host', async () => {
  const { h, g, hr, H, G } = await sailing();
  home(hr, G);
  run(HOME_S, h, g);
  assert.equal(G.done, true);
  assert.match(g.says('#mNote'), /Host is still racing/);
  assert.doesNotMatch(g.says('#mNote'), new RegExp(S.en.keepOpen), 'the guest\'s screen isn\'t the race');
  on = g; g.mod.leaveMatch();
  run(40, h);
  assert.equal(hr.over, false, 'the race runs on, past the 30 s of a silent boat');
  assert.equal(hr.forfeited, null);
  assert.equal(h.shows('#mBanner'), false, 'and nobody is said not to be answering');
  home(hr, H);
  run(HOME_S + CARD_S, h);
  assert.deepEqual(h.rows().map((r) => r[0]), ['1', '2']);
  assert.equal(h.rows()[0][1], 'Guest');
  assert.equal(h.says('#mCardH'), 'raceLost Guest');
  h.gone(); g.gone();
});

test('the host leaving while the race is on abandons it on both screens: no record, no Full result', async () => {
  const { h, g, hr, H } = await sailing();
  home(hr, H);
  run(HOME_S, h, g);
  assert.equal(H.done, true, 'even with her own finish made');
  on = h; h.mod.leaveMatch();
  assert.equal(h.ended, 1);
  assert.equal(g.cur().G.abandoned, true, 'the guest is told it is abandoned');
  run(CARD_S, g);
  assert.equal(g.shows('#mCard'), true);
  assert.equal(g.says('#mCardH'), S.en.abandonedH);
  assert.equal(g.shows('#mCard .m-full'), false);
  assert.equal(g.kept.length, 0);
  assert.deepEqual(g.rows(), []);
  assert.equal(g.cur().G.stopped, true, 'with no results to wait for');
  g.gone();
});

test('a reloaded host: the race on the water is abandoned, the card says so on both screens, and the rematch sails with the same settings', async () => {
  const { h, g } = await sailing({ course: 'trap', laps: 2 });
  const seed = h.cur().seed;
  h.gone();
  const back = await page('Host', { ls: h.ls });
  run(HOME_S + CARD_S, back, g);
  for (const s of [back, g]) { assert.equal(s.shows('#mCard'), true, s.name); assert.equal(s.says('#mCardH'), S.en.abandonedH, s.name); assert.equal(s.shows('#mCard .m-full'), false, s.name); }
  run(4, back, g);
  assert.equal(back.shows('#mCard .m-go'), true, 'Rematch is offered');
  on = back; back.$('#mCard .m-go').click();
  run(1.5, back, g);
  assert.equal(back.shows('#mCard'), false); assert.equal(g.shows('#mCard'), false);
  const r = back.cur().race;
  assert.notEqual(r.seed, seed, 'a new seed');
  assert.equal(g.cur().race.seed, r.seed);
  assert.equal(r.course.type, 'trap'); assert.equal(g.cur().race.course.type, 'trap');
  assert.ok(back.cur().H, 'the race runs');
  assert.equal(back.raced, 1, 'built once');
  back.gone(); g.gone();
});

test('the record survives a reload: the page reloaded after the race still has its Full result, and keeps no second record', async () => {
  const { h, g, hr, H, G } = await sailing();
  home(hr, H); home(hr, G);
  run(HOME_S + CARD_S, h, g);
  assert.equal(g.kept.length, 1);
  g.gone();
  const back = await page('Guest', { ls: g.ls });
  run(3, h, back);
  assert.equal(back.shows('#mCard'), true);
  assert.equal(back.kept.length, 0, 'kept once, by the page before');
  assert.equal(back.shows('#mCard .m-full'), true);
  on = back; back.$('#mCard .m-full').click();
  assert.deepEqual(back.opened, ['Guest-record-1']);
  h.gone(); back.gone();
});

test('both screens keep the same order: a boat home first with her penalty unserved, and a boat that gave up ahead on the water', async () => {
  const a = await sailing();
  home(a.hr, a.H); a.H.pen = { tack: false, gybe: false, dir: 0 };
  run(HOME_S, a.h, a.g);
  assert.equal(a.H.dsq, true);
  home(a.hr, a.G);
  run(HOME_S, a.h, a.g);
  for (const s of [a.h, a.g]) assert.deepEqual(s.kept[0].boats.map((b) => b.id), [a.G.id, a.H.id], s.name);
  a.h.gone(); a.g.gone();

  const b = await sailing();
  b.G.leg = b.H.leg + 2;
  assert.equal(b.hr.standings()[0], b.G, 'the guest is ahead as she goes');
  on = b.g; b.g.mod.leaveMatch();
  run(0.5, b.h);
  assert.deepEqual(b.h.kept[0].boats.map((x) => x.id), [b.H.id, b.G.id]);
  b.h.gone(); b.g.gone();
});

// main.js can't be loaded here (it is the page): its functions read from its source, with what they call handed in
const mainSrc = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
const between = (from, to) => mainSrc.slice(mainSrc.indexOf(from), mainSrc.indexOf(to, mainSrc.indexOf(from)));

test('the record takes its order from the results, not from where this screen last had the boats', () => {
  const keep = new Function('resultRecord', 'keepResult', 'flagCode', 'lookFrom', `${between('function keepOneOnOne(', 'const openResult')}; return keepOneOnOne;`);
  let kept = null;
  const G = { id: 'g', name: 'Guest', look: {} }, H = { id: 'h', name: 'Host', look: {} };
  const race = { player: G, log: {}, standings: () => [H, G] }; // (her screen: the host ahead)
  const record = () => ({ id: 'r1', boats: [{ name: 'Host', me: false, level: 3 }, { name: null, me: true }] });
  const fn = keep(record, (r) => { kept = r; }, () => 'xx', () => ({ flag: 'x' }));
  const boat = (id, o) => ({ id, done: true, dsq: false, dnf: false, place: null, finish: 100, pens: 0, legT: [], track: [[1.2, 3.4]], log: {}, ...o });
  assert.equal(fn(race, { seed: 1, boats: [boat('g', { place: 1, finish: 120 }), boat('h', { dsq: true })] }), 'r1');
  assert.equal(kept.oneOnOne, true);
  assert.deepEqual(kept.boats.map((b) => [b.name, b.me, b.dsq, b.secs]), [[null, true, false, 120], ['Host', false, true, 100]], 'the winner first, each boat still herself');
  assert.equal('level' in kept.boats[1], false);
});

test('leaving a race on the water says what it does to it, in both languages, and the page has no second question', async () => {
  const en = mainSrc.slice(mainSrc.indexOf('\n  en: {'), mainSrc.indexOf('\n  ru: {')), ru = mainSrc.slice(mainSrc.indexOf('\n  ru: {'));
  for (const k of ['leaveHost', 'leaveGuest', 'leaveHome']) for (const src of [en, ru]) assert.match(src, new RegExp(`\\b${k}: `), k);
  const words = { leaveHost: 'HOST', leaveGuest: (w) => `GUEST ${w}`, leaveHome: 'HOME', askK: { leave: 'k' }, askH: { leave: 'h' }, askT: { leave: 'hub' }, notKept: 'NOT KEPT', inSeq: 'seq', doLeave: 'Leave', toK: {}, whereH: () => 'where' };
  const asked = (me, other, isGuest, clock = 60) => {
    const els = {}, $ = (id) => (els[id] ||= {});
    const P = { id: 'p', leg: 1, ...me }, O = { id: 'o', name: 'Rival', ...other };
    const race = { multi: true, player: P, humans: [P, O], clock, course: { legs: ['start', 'w'] }, standings: () => [P, O], distToNext: () => 10 };
    const t = (k, ...a) => (typeof words[k] === 'function' ? words[k](...a) : words[k]);
    new Function('race', 'mx', 't', 'LANG', 'ord', 'legKey', '$', 'pauseEl', 'confirmEl', `${between('let confirmDo = null;', "$('#pResume')")}; ask('leave');`)(race, { isGuest }, t, 'en', (n) => n, () => 'w', $, {}, {});
    return els['#cTxt'].textContent;
  };
  assert.equal(asked({}, {}, false), 'HOST');
  assert.equal(asked({ done: true }, {}, false), 'HOST', 'the host home too: the race lives in her tab');
  assert.equal(asked({}, {}, true), 'GUEST Rival');
  assert.equal(asked({}, {}, true, -30), 'GUEST Rival', 'in the start sequence too');
  assert.equal(asked({}, { bfd: true }, true), 'GUEST null', 'a boat out herself wins nothing');
  assert.equal(asked({ done: true }, {}, true), 'HOME');
  const ui = readFileSync(new URL('../public/game/match-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /mAsk|askLeave/);
  assert.doesNotMatch(mainSrc, /askLeave/);
});
