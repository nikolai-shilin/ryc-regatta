// Two real screens of a 1-on-1 race for the test/one-on-one-*.test.mjs files: match-ui.js on a small stand-in for the page,
// over the in-memory hub, on a fake clock and with seeded dice; the records kept by main.js's own code; and helms that sail
// a real course with the buttons a sailor has. Import it first: it takes over the clock and the timers of the process.
import { mock } from './load.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { memoryRealtime } from './hub.mjs';

mock('public/game/net.js', 'export const realtime = (o) => globalThis.__realtime(o);');

// ---------- the page ----------
class El {
  constructor(tag = 'div') {
    Object.assign(this, { tag, kids: [], parent: null, heard: {}, hidden: false, disabled: false, value: '', id: '', className: '', placeholder: '', own: '', style: {} });
    const list = () => this.className.split(/\s+/).filter(Boolean);
    this.classList = { add: (c) => { this.className = [...new Set([...list(), c])].join(' '); }, remove: (c) => { this.className = list().filter((x) => x !== c).join(' '); }, toggle: (c, v) => this.classList[v ? 'add' : 'remove'](c), contains: (c) => list().includes(c) };
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

// ---------- the clock, the dice, and the screen whose code is running ----------
export const clock = { t: 1e6 };
export const CODE = 'ABC234', FRAME = 1 / 60;
let on = null, wire = memoryRealtime(), dice = 1, nextSeed = null;
Date.now = () => clock.t;
Math.random = () => {
  if (nextSeed !== null) { const v = (nextSeed + 0.5) / 100000; nextSeed = null; return v; } // (the seed of the race about to be started)
  dice = (dice * 16807) % 2147483647; return dice / 2147483647;
};
for (const [k, get] of Object.entries({ document: () => on.doc, localStorage: () => on.ls, location: () => on.loc, navigator: () => on?.nav ?? { userAgent: '' } })) Object.defineProperty(globalThis, k, { get, configurable: true });
Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }, configurable: true });
const realFetch = async (u) => new Response(await readFile(new URL(String(u))));
Object.assign(globalThis, {
  addEventListener: () => {},
  setInterval: (fn, ms) => { const x = { fn, ms, at: clock.t + ms }; on.timers.push(x); return x; },
  clearInterval: (x) => { on.timers = on.timers.filter((o) => o !== x); },
  setTimeout: (fn, ms = 0) => { const x = { fn, once: true, at: clock.t + ms }; on.timers.push(x); return x; },
  clearTimeout: (x) => { on.timers = on.timers.filter((o) => o !== x); },
  fetch: async (u, ...a) => (u === '/connect' ? on.connect(...a) : realFetch(u)),
  __realtime: () => {
    const me = on;
    return { setHeartbeat() {}, reconnect() {}, close() {}, lastHeard: () => clock.t,
      channel(topic, o) {
        const ch = wire.channel(topic, o), give = ch._deliver, send = ch.send;
        ch._deliver = (e, p) => { const was = on; on = me; try { if (!me.deaf?.(e, p)) { give(e, p); me.heardMsg?.(e, p); } } finally { on = was; } };
        ch.send = (e, p) => { me.sent?.(e, p); if (!me.mute?.(e, p)) send(e, p); };
        me.channels.push(ch);
        return ch;
      } };
  },
});
await import('../public/game/land.js').catch(() => {}); // (its bay files, read while nobody's page is open)
export const ui = await import('../public/game/match-ui.js');
export const M = await import('../public/game/match.js');
export const W = await import('../public/game/wire.js');
export const sim = await import('../public/game/sim.js');
const { lineD, lineT, D2R, wrap } = sim;

// ---------- the record: main.js's own code, read from its source (main.js is the page, and can't be loaded here) ----------
const mainSrc = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
const between = (from, to) => mainSrc.slice(mainSrc.indexOf(from), mainSrc.indexOf(to, mainSrc.indexOf(from)));
const recorder = (keepResult) => new Function('VENUE', 'CLS', 'LOOKS', 'playerLook', 'flagCode', 'lookFrom', 'keepResult',
  `${between('function resultRecord(', 'function keepResult(')}\n${between('function keepOneOnOne(', 'const openResult')}\nreturn keepOneOnOne;`)(
  { id: 'palma' }, { id: 'jpk1050' }, {}, () => ({ flag: null }), () => null, () => ({ flag: null }), keepResult);

// ---------- a page ----------
const memory = () => Object.create({ getItem(k) { return k in this ? this[k] : null; }, setItem(k, v) { this[k] = String(v); }, removeItem(k) { delete this[k]; } });
// a page opened (ls: the same page reloaded). kept: the results it kept the record from; records: the records themselves
export async function page(name, { host = false, settings = {}, ls = null, ...more } = {}) {
  const s = { name, timers: [], channels: [], kept: [], records: [], opened: [], toasts: [], ended: 0, session: null, racing: false, heard: [], hands: null, ...more,
    doc: { head: new El('head'), body: new El('body'), activeElement: null, visibilityState: 'visible', createElement: (t) => new El(t), addEventListener() {}, execCommand() {} },
    ls: ls ?? memory(), nav: { userAgent: 'test' }, loc: { origin: 'http://game.test', search: '', reload() {}, replace() {} } };
  s.connect = async () => ({ ok: true, json: async () => ({ url: 'u', key: 'k', name, canHost: true, build: 'b1' }) });
  s.$ = (sel) => s.doc.body.querySelector(sel);
  s.shows = (sel) => { const e = s.$(sel); return !!e && !e.hidden; };
  s.says = (sel) => s.$(sel)?.textContent ?? '';
  // the card's rows as this screen shows them: { name: mark }, and the gap on the second row
  s.rows = () => s.doc.body.querySelectorAll('#mCard .m-rows div').map((r) => r.kids.map((k) => k.textContent));
  s.marks = () => Object.fromEntries(s.rows().map(([mark, who]) => [who === 'you' ? name : who, mark]));
  s.cur = () => s.session?.debug.cur;
  s.race = () => s.cur()?.race;
  s.match = () => s.session?.debug.match;
  s.gone = () => { for (const c of s.channels) c.leave(); s.timers = []; s.racing = false; };
  s.press = (sel) => { on = s; return s.$(sel).click(); };
  s.leave = () => s.press('#mRoom .m-leave'); // (Leave, as the question on the water ends: the room's own button does the same)
  on = s;
  if (host) { s.ls.setItem('regatta-match-host', JSON.stringify({ code: CODE })); s.ls.setItem('regatta-match-settings', JSON.stringify({ venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short', ...settings })); }
  const keepOne = recorder((res) => s.records.push(res));
  await ui.startMatch({ code: CODE, t: (k, ...a) => [k, ...a].join(' '), LANG: 'en', venue: { id: 'palma' }, cls: { id: 'jpk1050' },
    onRace: (x) => { s.session = x; s.racing = true; }, onIdle: () => { s.racing = false; }, onEnd: () => { s.ended++; }, toast: (x) => s.toasts.push(x),
    keepOneOnOne: (race, results) => { s.kept.push(JSON.parse(JSON.stringify(results))); return keepOne(race, results); }, openResult: (id) => s.opened.push(id) });
  return s;
}

// one frame on the screens: the sailors' hands, the game's step, what main.js does with the race's news, the page's timers
export function frame(...pages) {
  clock.t += 1000 * FRAME;
  wire.pump();
  for (const s of pages) {
    on = s;
    if (s.racing) {
      const r = s.session.race;
      s.hands?.(r, r.player);
      s.session.step(FRAME);
      if (s.session.race === r) { for (const m of r.messages) if (!m.to || m.to === r.player) s.heard.push(m.key); r.messages.length = 0; }
    }
    for (const x of s.timers) if (clock.t >= x.at) { if (x.once) s.timers = s.timers.filter((o) => o !== x); else x.at = clock.t + x.ms; x.fn(); }
  }
}
export function run(secs, ...pages) { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) frame(...pages); }
// until something has happened on the screens, then a beat more for them to paint it
export function until(cond, pages, secs = 120, what = 'it never happened') {
  for (let i = 0; i < secs * 60 && !cond(); i++) frame(...pages);
  assert.ok(cond(), what);
  run(0.3, ...pages);
}

// the world anew: the clock, the dice and the hub (latency: ms each way, jitter: ms more at random)
export function world({ latency = 0, jitter = 0 } = {}) {
  clock.t = 1e6; dice = 1; nextSeed = null;
  wire = latency || jitter ? memoryRealtime({ latency, jitter, now: () => clock.t, seed: 11 }) : memoryRealtime();
  return wire;
}
export const hub = () => wire;
// the two pages in the waiting room
export async function room({ settings = {}, latency = 0, jitter = 0 } = {}) {
  world({ latency, jitter });
  const h = await page('Host', { host: true, settings }), g = await page('Guest');
  run(0.5 + (latency + jitter) / 500, h, g);
  return { h, g };
}
// the host presses Start, for a race of this seed
export function start(x, seed) { nextSeed = seed; x.h.press('.m-start'); }
export function rematch(x, seed) { nextSeed = seed; x.h.press('#mCard .m-go'); }
// the race on both screens, its seed the test's. gun: the gun long gone, the boats under way
export async function sailing({ seed = 11, gun = true, ...o } = {}) {
  const x = await room(o);
  start(x, seed);
  until(() => x.h.cur()?.H && x.g.cur()?.G && x.g.cur().gotSnap, [x.h, x.g], 10);
  return aboard(x, gun);
}
// (the host's race and boats, for the test to arrange)
export function aboard(x, gun = true) {
  const hr = x.h.race();
  Object.assign(x, { hr, H: hr.player, G: hr.humans.find((b) => b !== hr.player), gr: x.g.race() });
  x.me = x.gr.player; x.both = [x.h, x.g];
  if (gun) { hr.clock = 60; for (const b of hr.humans) { b.leg = 1; place(hr, b, midBeat(hr.course, b === x.H ? 70 : -70), hr.wind.dir() + 45 * D2R, 3); } }
  return x;
}

// ---------- the water ----------
export const midBeat = (c, off = 0) => ({ x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2 + c.dir.x * off, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 + c.dir.z * off });
export const midLine = (c) => ({ x: (c.pin.x + c.committee.x) / 2, z: (c.pin.z + c.committee.z) / 2 });
export function place(r, b, p, h, v = 3) { Object.assign(b, { x: p.x, z: p.z, h, v, auto: null, rudder: 0, yawRate: 0 }); b.lastD = lineD(r.course, b); b.lastZ = b.z; }
// boat b on the last leg, three metres short of the finish and sailing across it
export function toFinish(r, b) {
  const c = r.course, m = midLine(c);
  b.leg = c.legs.length - 1;
  place(r, b, { x: m.x + c.normal.x * 3, z: m.z + c.normal.z * 3 }, Math.atan2(-c.normal.x, c.normal.z), 4);
}
export const owes = (b) => { b.pen = { tack: false, gybe: false, dir: 0 }; };

// ---------- what each screen knows ----------
// the race as a screen has it: everything the two must agree on
export const viewOf = (r) => ({ recalls: r.recalls, prep: r.prepFlag, flags: { ...r.flags }, winner: r.winner?.id ?? null,
  boats: Object.fromEntries(r.humans.map((b) => [b.id, { leg: b.leg, pen: b.pen ? { tack: !!b.pen.tack, gybe: !!b.pen.gybe, dir: b.pen.dir || 0 } : null, ocs: !!b.ocs, ufd: !!b.ufd, bfd: !!b.bfd, dsq: !!b.dsq, dnf: !!b.dnf, done: !!b.done, place: b.place ?? null, finish: b.finish ?? null }])) });
// Every snapshot the host sends is held against the host's race as it was sent, and the guest's race as it took it: the two
// screens agree at every point of the race, the way there allowed for. Gives the count so far, and the first disagreement
export function watchAgreement(x) {
  const sent = [], w = { n: 0, bad: null };
  x.h.sent = (e, p) => { if (e === 'snap') sent.push({ c: p.c, view: viewOf(x.h.race()) }); };
  x.g.heardMsg = (e, p) => {
    if (e !== 'snap') return;
    const i = sent.findIndex((o) => o.c === p.c); // (none: one on its way as the watch began)
    if (i < 0 || !x.g.race()) return;
    const want = sent[i].view;
    sent.splice(0, i + 1);
    w.n++;
    const got = viewOf(x.g.race());
    if (!w.bad && JSON.stringify(got) !== JSON.stringify(want)) w.bad = { at: x.g.race().clock, got, want };
  };
  return w;
}

// ---------- a sailor's hands ----------
const sgn = (v) => (v < 0 ? -1 : 1);
// a press of the tack button, as main.js's doTack has it
export function press(b) { const n = b.events.length; b.tackOrGybe(); if (b.events.length > n) b.tackN = (b.tackN || 0) + 1; }
// steer for point p: straight there if she can, else close-hauled, tacking when the other tack will fetch it
function steerFor(r, b, p) {
  const W = b.wdir, want = Math.atan2(p.x - b.x, -(p.z - b.z)), rel = wrap(want - W), up = (sim.beatAngle(b.tws) + 2) * D2R, side = sgn(wrap(b.h - W));
  if (b.auto) return;
  if (Math.abs(rel) < up) { r.steerTo(b, W + side * up); return; }
  if (sgn(rel) !== side && Math.abs(rel) < 100 * D2R && !b.pen) { press(b); return; } // the other tack fetches it
  r.steerTo(b, want);
}
// A helm that sails the course: below the line till the gun, across it, round each mark to port, through the gate and over
// the finish. lane: where along the line she starts (0 to 1). Any turn she owes she sails at once, the helm hard over.
export const sailor = (lane) => (r, b) => {
  b.autoTrim = true;
  if (b.done) { b.rudder = 0; return; }
  const c = r.course, k = c.legs[b.leg], d = lineD(c, b);
  if (b.pen) { // clear of the mark she may have touched, then round
    const near = r.hardMarks().map(([m]) => m).find((m) => Math.hypot(m.x - b.x, m.z - b.z) < 18);
    if (near) steerFor(r, b, { x: b.x + (b.x - near.x) * 3, z: b.z + (b.z - near.z) * 3 }); else b.rudder = 1;
    return;
  }
  const at = (t, off) => ({ x: c.pin.x + c.dir.x * c.len * t + c.normal.x * off, z: c.pin.z + c.dir.z * c.len * t + c.normal.z * off });
  if (k === 'start') {
    if (b.ocs || d > 1.5) { steerFor(r, b, at(lane, -25)); return; } // back below the line, to cross it again
    const left = -r.clock, way = -d / 4.5;
    if (left > 0 && (left > way + 1 || d > -5)) { steerFor(r, b, at(lane, left > 12 ? -45 : -22)); return; } // waiting below it
    const t = lineT(c, b), toward = t < lane ? 1 : -1; // up to it on the tack that brings her nearer her place on it
    steerFor(r, b, at(Math.max(0.08, Math.min(0.92, t + toward * (-d + 12) * 1.2 / c.len)), 10));
    return;
  }
  const m = c.marks[k];
  if (m) {
    const o = c.legInfo[b.leg].out || { x: Math.sin(b.wdir), z: -Math.cos(b.wdir) }, R = { x: -o.z, z: o.x };
    const ahead = (b.x - m.x) * o.x + (b.z - m.z) * o.z, side = (b.x - m.x) * R.x + (b.z - m.z) * R.z;
    const round = (a, s) => ({ x: m.x + o.x * a + R.x * s, z: m.z + o.z * a + R.z * s });
    steerFor(r, b, ahead > 8 && side > 6 ? round(22, -40) : round(22, 26)); // up on her right, and across above it
    return;
  }
  if (k === 'gate') { const g = sim.legAim(c, b.leg); steerFor(r, b, { x: g.x, z: b.z < g.z - 14 || b.z > g.z ? g.z - 20 : g.z + 30 }); return; } // above its middle, and down through it
  const f = c.finish, l = sim.legAim(c, b.leg);
  steerFor(r, b, f ? { x: l.x + f.through.x * 30, z: l.z + f.through.z * 30 } : { x: l.x - c.normal.x * 30, z: l.z - c.normal.z * 30 });
};
export const plain = (v) => JSON.parse(JSON.stringify(v));
