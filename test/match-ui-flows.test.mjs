// The 1-on-1 race's screens from end to end (public/game/match-ui.js): the waiting room, sharing the link, joining, what goes
// wrong on the way in, the banners and the question during a race, and the card after it, in both languages, on a small
// stand-in for the page, over the in-memory hub, on a fake clock and with seeded dice.
import { mock } from './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryRealtime } from './hub.mjs';

mock('public/game/net.js', 'export const realtime = (o) => globalThis.__realtime(o);');

// ---------- the page ----------
class El {
  constructor(tag = 'div') {
    Object.assign(this, { tag, kids: [], parent: null, heard: {}, hidden: false, disabled: false, value: '', id: '', className: '', placeholder: '', own: '', style: {}, selects: 0, focuses: 0, blurs: 0 });
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
  fire(k, e = {}) { const out = []; for (const fn of this.heard[k] || []) out.push(fn(e)); return Promise.all(out); }
  click() { return this.fire('click'); }
  focus() { this.focuses++; on.doc.activeElement = this; }
  blur() { this.blurs++; if (on.doc.activeElement === this) on.doc.activeElement = null; }
  select() { this.selects++; }
}

// ---------- the clock, the dice, and the screen whose code is running ----------
const clock = { t: 1e6 };
let on = null, wire = memoryRealtime(), dice = 1;
const CODE = 'ABC234', OTHER = 'XYZ789', FRAME_S = 1 / 60, CARD_S = 4;
Date.now = () => clock.t;
Math.random = () => { dice = (dice * 16807) % 2147483647; return dice / 2147483647; };
for (const [k, get] of Object.entries({ document: () => on.doc, localStorage: () => on.ls, location: () => on.loc, navigator: () => on?.nav ?? { userAgent: '' } })) Object.defineProperty(globalThis, k, { get, configurable: true });
Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }, configurable: true });
const realFetch = async (u) => new Response(await readFile(new URL(String(u))));
Object.assign(globalThis, {
  addEventListener: (k, fn) => { (on.win[k] ||= []).push(fn); },
  setInterval: (fn, ms) => { const x = { fn, ms, at: clock.t + ms }; on.timers.push(x); return x; },
  clearInterval: (x) => { on.timers = on.timers.filter((o) => o !== x); },
  setTimeout: (fn, ms = 0) => { const x = { fn, once: true, at: clock.t + ms }; on.timers.push(x); return x; },
  clearTimeout: (x) => { on.timers = on.timers.filter((o) => o !== x); },
  fetch: async (u, ...a) => (u === '/connect' ? on.connect(...a) : realFetch(u)),
  __realtime: () => {
    const me = on;
    if (me.noLink) throw new Error('no link');
    me.rt = { reconnects: 0, closed: 0, setHeartbeat(ms) { me.heartbeat = ms; }, reconnect() { me.rt.reconnects++; }, close() { me.rt.closed++; }, lastHeard: () => clock.t,
      channel(topic, o) {
        const ch = wire.channel(topic, o), give = ch._deliver;
        ch._deliver = (e, p) => { const was = on; on = me; try { me.tamper?.(e, p); if (!me.deaf?.(e, p)) give(e, p); } finally { on = was; } };
        if (me.joinFails) ch.join = () => Promise.reject(new Error('refused'));
        me.channels.push(ch);
        return ch;
      } };
    return me.rt;
  },
});
await import('../public/game/land.js').catch(() => {}); // (its bay files, read while nobody's page is open)
// (one copy of the module for every page, so the coverage adds up: only leaveMatch is the module's, and it is the latest page's)
const ui = await import('../public/game/match-ui.js');
const { MATCH_STRINGS: S, clean, cardRows, timeLeft } = ui;

const memory = () => Object.create({ getItem(k) { return k in this ? this[k] : null; }, setItem(k, v) { this[k] = String(v); }, removeItem(k) { delete this[k]; } });
const hostKeys = (ls, settings = {}) => { ls.setItem('regatta-match-host', JSON.stringify({ code: CODE })); ls.setItem('regatta-match-settings', JSON.stringify({ venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short', ...settings })); };
// a page opened, with the page's storage (ls: the same page reloaded)
async function page(name, { host = false, settings = {}, ls = null, lang = 'en', venue = 'palma', yacht = 'jpk1050', search = '', share, clipboard, cfg = {}, connect = null, build = 'b1', ...more } = {}) {
  const s = { name, timers: [], channels: [], kept: [], opened: [], toasts: [], ended: 0, idled: 0, raced: 0, session: null, racing: false, win: {}, reloads: 0, replaced: [], ...more,
    doc: { head: new El('head'), body: new El('body'), activeElement: null, visibilityState: 'visible', heard: {}, copies: [], createElement: (t) => new El(t), addEventListener(k, fn) { (this.heard[k] ||= []).push(fn); }, execCommand(c) { if (s.doc.copyThrows) throw new Error('no'); s.doc.copies.push(c); } },
    ls: ls ?? memory(), nav: { userAgent: 'test', share, clipboard } };
  s.loc = { origin: 'http://game.test', search, reload: () => { s.reloads++; }, replace: (u) => { s.replaced.push(u); } };
  s.connect = connect ?? (async () => ({ ok: true, json: async () => ({ url: 'u', key: 'k', name, build, ...cfg }) }));
  s.$ = (sel) => s.doc.body.querySelector(sel);
  s.shows = (sel) => { const e = s.$(sel); return !!e && !e.hidden; };
  s.says = (sel) => s.$(sel)?.textContent ?? '';
  s.rows = () => s.doc.body.querySelectorAll('#mCard .m-rows div').map((r) => r.kids.map((k) => k.textContent));
  s.people = () => s.doc.body.querySelectorAll('#mRoom .m-ppl .m-p').map((r) => (r.kids.length ? r.kids.map((k) => k.textContent) : [r.textContent]));
  s.cur = () => s.session?.debug.cur;
  s.fire = (k, e = {}) => { const was = on; on = s; for (const fn of s.win[k] || []) fn(e); on = was; };
  s.press = (sel) => { on = s; return s.$(sel).click(); };
  s.gone = () => { for (const c of s.channels) c.leave(); s.timers = []; s.racing = false; };
  on = s;
  if (host) hostKeys(s.ls, settings);
  s.mod = ui;
  const onRace = (x) => { s.session = x; s.racing = true; s.raced++; };
  if (more.bare) { await ui.startMatch({ code: CODE, t: (k, ...a) => [k, ...a].join(' '), venue: { id: venue }, cls: { id: yacht }, onRace }); return s; }
  await ui.startMatch({ code: CODE, t: (k, ...a) => [k, ...a].join(' '), LANG: lang, venue: { id: venue }, cls: { id: yacht },
    onRace, onIdle: () => { s.racing = false; s.idled++; }, onEnd: () => { s.ended++; }, toast: (x) => s.toasts.push(x),
    keepOneOnOne: (race, results) => { if (s.keepThrows) throw new Error('disk full'); s.kept.push(results); return `${name}-record-${s.kept.length}`; }, openResult: (id) => s.opened.push(id) });
  return s;
}
// time passing on the screens: the game's frames while a race is on screen, and each page's timers
function run(secs, ...pages) {
  for (let i = 0, n = Math.round(secs / FRAME_S); i < n; i++) {
    clock.t += 1000 * FRAME_S;
    for (const s of pages) {
      on = s;
      if (s.racing) s.session.step(FRAME_S);
      for (const x of s.timers) if (clock.t >= x.at) { if (x.once) s.timers = s.timers.filter((o) => o !== x); else x.at = clock.t + x.ms; x.fn(); }
    }
  }
}
// until something has happened on the screens, then a beat more for them to paint it: never a guess at how long it takes
function until(cond, ...pages) {
  for (let i = 0; i < 60 * 60 && !cond(); i++) run(FRAME_S, ...pages);
  assert.ok(cond(), 'it never happened');
  run(0.3, ...pages);
}
const fresh = () => { wire = memoryRealtime(); };
async function room(hostOpts = {}, guestOpts = {}) {
  fresh();
  const h = await page('Host', { host: true, ...hostOpts }), g = await page('Guest', guestOpts);
  run(0.5, h, g);
  return { h, g };
}
// the host presses Start with her guest in the room, and the race is on both screens
async function sailing(hostOpts = {}, guestOpts = {}) {
  const { h, g } = await room(hostOpts, guestOpts);
  h.press('.m-start');
  until(() => h.cur()?.H && g.cur()?.G, h, g);
  const hr = h.cur().race;
  hr.clock = 60; // the gun long gone
  return { h, g, hr, H: hr.player, G: hr.humans.find((b) => b !== hr.player) };
}
const { lineD } = await import('../public/game/sim.js');
// boat b three metres short of the finish, and sailing across it
function home(r, b) {
  const c = r.course, x = (c.pin.x + c.committee.x) / 2, z = (c.pin.z + c.committee.z) / 2;
  Object.assign(b, { x: x + c.normal.x * 3, z: z + c.normal.z * 3, h: Math.atan2(-c.normal.x, c.normal.z), v: 4, leg: c.legs.length - 1, auto: null, rudder: 0, yawRate: 0 });
  b.lastD = lineD(c, b); b.lastZ = b.z;
}
// the race sailed to its end, and its card open on both screens
async function carded(hostOpts, guestOpts) {
  const x = await sailing(hostOpts, guestOpts);
  home(x.hr, x.H); home(x.hr, x.G);
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard'), x.h, x.g);
  return x;
}
// the race ended as it's told to, on the host's screen
function ended(x, o) { Object.assign(x.hr, { over: true, ...o }); until(() => x.h.shows('#mCard'), x.h, x.g); }
// what a press has started (a room being joined) has its moment to finish
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// ---------- what the screens are told to say ----------
test('a name is cleaned of what a name can\'t have', () => {
  assert.equal(clean('  Ada   Lovelace '), 'Ada Lovelace');
  assert.equal(clean('<b>Ada</b>'), 'bAda/b');
  assert.equal(clean('Ada\u0007!'), 'Ada!');
  assert.equal(clean('Ada🚀⛵'), 'Ada');
  assert.equal(clean('🇬🇧 Ann'), 'Ann');
  assert.equal(clean('1️⃣ Bo'), 'Bo');
  assert.equal(clean('a'.repeat(30)).length, 16);
  assert.equal(clean(null), '');
  assert.equal(clean(undefined), '');
  assert.equal(clean(1234), '1234');
});

test('the words that count: laps and starts in each language', () => {
  assert.equal(S.en.laps(1), '1 lap');
  assert.equal(S.en.laps('2'), '2 laps');
  assert.equal(S.ru.laps(1), '1 круг');
  assert.equal(S.ru.laps(2), '2 круга');
  assert.equal(S.en.startMin(3), '3-minute start');
  assert.equal(S.ru.startMin(3), 'старт 3 мин');
});

test('the card puts the disqualified last, whatever the order the boats came in', () => {
  const rows = cardRows([{ id: 'a', ufd: true }, { id: 'b', done: true, place: 1, finish: 90 }], { winner: 'b', margin: null });
  assert.deepEqual(rows.map((r) => [r.id, r.mark]), [['b', '1'], ['a', 'DSQ']]);
  assert.deepEqual(cardRows([{ id: 'a' }, { id: 'b' }]).map((r) => r.mark), ['', ''], 'nothing known');
  assert.deepEqual(cardRows([{ id: 'a', done: true, place: 2, finish: 120 }, { id: 'b', done: true, place: 1, finish: 100 }], { winner: 'b', margin: 20 }), [{ id: 'b', mark: '1', gap: null }, { id: 'a', mark: '2', gap: 20 }]);
  assert.deepEqual(cardRows([{ id: 'a', place: 3 }], {}), [{ id: 'a', mark: '3', gap: null }], 'a place known is the place');
});

test('the time left runs from the first of two valid finishes', () => {
  assert.equal(timeLeft({ clock: 100, humans: [{ done: true, dsq: false, finish: 70 }, { done: true, dsq: false, finish: 40 }] }, 180), 120);
  assert.equal(timeLeft({ clock: 100, humans: [{ done: false }, { done: false }] }, 180), null);
});

test('leaving with no race on this page does nothing', () => {
  assert.doesNotThrow(() => ui.leaveMatch());
});

// ---------- the waiting room ----------
test('the host\'s room in English: the link to send, the settings, and Start waiting for a friend', async () => {
  fresh();
  const h = await page('Host', { host: true, settings: { laps: 2, start: 3, course: 'tri', preset: 'strong', length: 'long' } });
  run(0.5, h);
  assert.equal(h.says('#mRoom .m-kick'), '1-on-1 race');
  assert.equal(h.says('#mRoomH'), 'Waiting room');
  assert.equal(h.says('.m-linkK'), 'Send your friend this link');
  assert.equal(h.$('.m-link input').value, `http://game.test/match/${CODE}?v=palma&b=jpk1050`);
  assert.equal(h.says('.m-set'), 'palma · jpk1050 · strong · lLong · shapeTri · 2 laps · 3-minute start');
  assert.deepEqual(h.people(), [['Host', 'you · host'], ['Waiting for a friend…']]);
  assert.equal(h.says('.m-start'), 'Start the race');
  assert.equal(h.$('.m-start').disabled, true, 'nobody to race yet');
  assert.equal(h.says('#mRoom .m-leave'), 'Leave');
  assert.equal(h.says('.m-share'), 'Copy', 'with no share sheet on this device');
  assert.equal(h.shows('#mRoom .m-st'), false, 'the friend\'s row says it');
  assert.equal(h.shows('.m-retry'), false);
  h.gone();
});

test('the host\'s room in Russian', async () => {
  fresh();
  const h = await page('Хозяйка', { host: true, lang: 'ru', settings: { laps: 2, start: 5 } });
  run(0.5, h);
  assert.equal(h.says('#mRoom .m-kick'), 'Гонка один на один');
  assert.equal(h.says('#mRoomH'), 'Зал ожидания');
  assert.equal(h.says('.m-linkK'), 'Отправь другу эту ссылку');
  assert.match(h.says('.m-set'), / · 2 круга · старт 5 мин$/);
  assert.deepEqual(h.people(), [['Хозяйка', 'ты · хозяин'], ['Ждём соперника…']]);
  assert.equal(h.says('.m-start'), 'Начать гонку');
  assert.equal(h.says('#mRoom .m-leave'), 'Выйти');
  assert.equal(h.says('.m-share'), 'Скопировать');
  assert.equal(h.$('.m-name input').placeholder, 'Твоё имя');
  h.gone();
});

test('a language it doesn\'t have is English', async () => {
  fresh();
  const h = await page('Host', { host: true, lang: 'de' });
  assert.equal(h.says('#mRoomH'), 'Waiting room');
  h.gone();
});

test('a friend comes in: each screen shows the other, and Start is on for the host alone', async () => {
  const { h, g } = await room();
  assert.deepEqual(h.people(), [['Host', 'you · host'], ['Guest']]);
  assert.equal(h.$('.m-start').disabled, false);
  assert.deepEqual(g.people(), [['Host', 'host'], ['Guest', 'you']]);
  assert.equal(g.shows('.m-start'), false);
  assert.equal(g.shows('.m-linkBox'), false, 'the link is the host\'s to send');
  assert.equal(g.says('#mRoom .m-st'), 'Waiting for Host to start the race…');
  assert.equal(g.says('.m-set'), h.says('.m-set'), 'the settings are the host\'s');
  h.gone(); g.gone();
});

test('the guest\'s words in Russian, and a guest alone waits for the host', async () => {
  const { h, g } = await room({}, { lang: 'ru' });
  assert.equal(g.says('#mRoom .m-st'), 'Ждём, когда Host начнёт гонку…');
  h.gone(); g.gone();
  fresh();
  const alone = await page('Guest', { lang: 'ru' });
  run(0.5, alone);
  assert.deepEqual(alone.people(), [['Ждём хозяина гонки…'], ['Guest', 'ты']]);
  assert.equal(alone.shows('#mRoom .m-st'), false, 'no host yet: her row says so');
  alone.gone();
});

test('a third with the link is told the race already has two sailors', async () => {
  const { h, g } = await room();
  const t = await page('Third');
  run(0.5, h, g, t);
  assert.equal(t.says('#mRoom .m-st'), 'This race already has two sailors');
  assert.ok(t.$('#mRoom .m-st').classList.contains('bad'));
  assert.equal(t.shows('.m-nameBox'), false);
  assert.deepEqual(t.people(), [['Host', 'host']], 'and she isn\'t shown as the guest');
  const r = await page('Четвёртая', { lang: 'ru' });
  run(0.5, h, g, t, r);
  assert.equal(r.says('#mRoom .m-st'), 'В этой гонке уже двое');
  h.gone(); g.gone(); t.gone(); r.gone();
});

test('a third hearing the race state stays out of somebody else\'s race', async () => {
  const { h, g } = await room();
  const t = await page('Third');
  run(0.5, h, g, t);
  h.press('.m-start');
  until(() => h.cur()?.H && g.cur()?.G, h, g, t);
  run(3, h, g, t);
  assert.equal(t.raced, 0);
  h.gone(); g.gone(); t.gone();
});

test('a state that makes no sense is ignored', async () => {
  const { h, g } = await room();
  on = h;
  const all = h.channels[0];
  for (const bad of [null, {}, { start: {} }, { start: { host: { id: 'x' } } }]) all.send('mstate', bad);
  run(1, h, g);
  assert.equal(g.raced, 0);
  assert.equal(g.shows('#mRoom'), true);
  h.gone(); g.gone();
});

// ---------- sharing the link ----------
test('on a device with a share sheet the link goes through it', async () => {
  fresh();
  const shared = [];
  const h = await page('Host', { host: true, share: async (o) => { shared.push(o); } });
  assert.equal(h.says('.m-share'), 'Share');
  await h.press('.m-share');
  assert.deepEqual(shared, [{ title: '1-on-1 race', url: h.$('.m-link input').value }]);
  assert.equal(h.says('.m-share'), 'Share', 'and nothing is said to have been copied');
  h.gone();
});

test('a share sheet closed without sharing copies nothing', async () => {
  fresh();
  const copied = [];
  const h = await page('Host', { host: true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }, clipboard: { writeText: async (u) => copied.push(u) } });
  await h.press('.m-share');
  assert.deepEqual(copied, []);
  assert.equal(h.says('.m-share'), 'Share');
  h.gone();
});

test('a share sheet that fails falls back to the clipboard, and says Copied for a moment', async () => {
  fresh();
  const copied = [];
  const h = await page('Host', { host: true, share: async () => { throw new Error('denied'); }, clipboard: { writeText: async (u) => copied.push(u) } });
  await h.press('.m-share');
  assert.deepEqual(copied, [h.$('.m-link input').value]);
  assert.equal(h.says('.m-share'), 'Copied');
  run(1.7, h);
  assert.equal(h.says('.m-share'), 'Share');
  h.gone();
});

test('with no share sheet the link is copied, in each language', async () => {
  fresh();
  const copied = [];
  const h = await page('Хозяйка', { host: true, lang: 'ru', clipboard: { writeText: async (u) => copied.push(u) } });
  await h.press('.m-share');
  assert.equal(copied.length, 1);
  assert.equal(h.says('.m-share'), 'Скопировано');
  run(1.7, h);
  assert.equal(h.says('.m-share'), 'Скопировать');
  h.gone();
});

test('with no clipboard the link is selected and copied the old way', async () => {
  fresh();
  const h = await page('Host', { host: true, clipboard: { writeText: async () => { throw new Error('denied'); } } });
  await h.press('.m-share');
  assert.equal(h.$('.m-link input').selects, 1);
  assert.deepEqual(h.doc.copies, ['copy']);
  assert.equal(h.says('.m-share'), 'Copied');
  h.gone();
});

test('even the old way failing doesn\'t break the button', async () => {
  fresh();
  const h = await page('Host', { host: true });
  h.doc.copyThrows = true;
  await assert.doesNotReject(() => h.press('.m-share'));
  assert.equal(h.$('.m-link input').selects, 1);
  h.gone();
});

test('clicking into the link selects it', async () => {
  fresh();
  const h = await page('Host', { host: true });
  on = h; h.$('.m-link input').fire('focus');
  assert.equal(h.$('.m-link input').selects, 1);
  h.gone();
});

// ---------- joining with a name ----------
test('with no name the guest is asked for one, and stays out of the room until she gives it', async () => {
  fresh();
  const h = await page('Host', { host: true }), g = await page('');
  run(0.5, h, g);
  assert.equal(g.says('#mRoom .m-st'), 'Type your name to join');
  assert.equal(h.$('.m-start').disabled, true, 'she isn\'t in the room');
  assert.equal(g.says('.m-nameK'), 'Your name');
  assert.equal(g.says('.m-join'), 'Join');
  g.$('.m-name input').value = '  Mia 🚀 ';
  g.press('.m-join');
  await settle();
  run(0.5, h, g);
  assert.deepEqual(h.people()[1], ['Mia']);
  assert.equal(h.$('.m-start').disabled, false);
  assert.equal(JSON.parse(g.ls.getItem('regatta-match-name')), 'Mia', 'kept for next time');
  assert.equal(g.$('.m-name input').blurs, 1);
  h.gone(); g.gone();
});

test('asked for a name in Russian', async () => {
  fresh();
  const g = await page('', { lang: 'ru' });
  run(0.5, g);
  assert.equal(g.says('#mRoom .m-st'), 'Напиши имя, чтобы войти');
  assert.equal(g.says('.m-join'), 'Войти');
  g.gone();
});

test('an empty name is not a name: the box keeps the focus', async () => {
  fresh();
  const g = await page('');
  g.$('.m-name input').value = ' 🚀 ';
  g.press('.m-join');
  run(0.5, g);
  assert.equal(g.$('.m-name input').focuses, 1);
  assert.equal(g.says('#mRoom .m-st'), 'Type your name to join');
  assert.equal(g.ls.getItem('regatta-match-name'), null);
  g.gone();
});

test('Enter in the name box joins; other keys just type', async () => {
  fresh();
  const h = await page('Host', { host: true }), g = await page('');
  on = g; g.$('.m-name input').value = 'Zoe';
  g.$('.m-name input').fire('keydown', { key: 'a' });
  await settle();
  run(0.5, h, g);
  assert.equal(h.people().length, 2);
  assert.deepEqual(h.people()[1], ['Waiting for a friend…']);
  on = g; g.$('.m-name input').fire('keydown', { key: 'Enter' });
  await settle();
  run(0.5, h, g);
  assert.deepEqual(h.people()[1], ['Zoe']);
  h.gone(); g.gone();
});

test('a name changed in the room is told to the other screen at once', async () => {
  const { h, g } = await room();
  g.$('.m-name input').value = 'Gwen';
  g.press('.m-join');
  run(0.5, h, g);
  assert.deepEqual(h.people()[1], ['Gwen']);
  h.gone(); g.gone();
});

test('an account\'s name with nothing left of it once cleaned leaves the name she had', async () => {
  fresh();
  const ls = memory(); ls.setItem('regatta-match-name', JSON.stringify('Kit'));
  const g = await page('', { ls, cfg: { name: '🚀🚀' } });
  run(0.5, g);
  assert.deepEqual(g.people()[1], ['Kit', 'you']);
  g.gone();
});

test('a name with nothing to show is a dash in the room', async () => {
  const { h, g } = await room();
  h.tamper = (e, p) => { if (e === 'hello' && p) p.name = '🚀'; };
  run(4, h, g);
  assert.deepEqual(h.people()[1], ['—']);
  h.gone(); g.gone();
});

test('a host with no name yet is shown as dots until she gives one', async () => {
  fresh();
  const h = await page('', { host: true });
  run(0.5, h);
  assert.deepEqual(h.people(), [['…', 'you · host']]);
  h.gone();
});

test('a name kept from before fills the box and walks straight in', async () => {
  fresh();
  const ls = memory(); ls.setItem('regatta-match-name', JSON.stringify('Kit'));
  const h = await page('Host', { host: true }), g = await page('', { ls });
  run(0.5, h, g);
  assert.deepEqual(h.people()[1], ['Kit']);
  assert.equal(g.$('.m-name input').value, 'Kit');
  h.gone(); g.gone();
});

test('signed in, the account\'s name is the name', async () => {
  fresh();
  const ls = memory(); ls.setItem('regatta-match-name', JSON.stringify('Old'));
  const g = await page('', { ls, cfg: { name: 'Account Name' } });
  run(0.5, g);
  assert.deepEqual(g.people()[1], ['Account Name', 'you']);
  g.gone();
});

test('the box isn\'t filled over what she is typing', async () => {
  fresh();
  const g = await page('Guest');
  on = g; g.$('.m-name input').value = ''; g.$('.m-name input').focus();
  run(0.5, g);
  assert.equal(g.$('.m-name input').value, '');
  g.gone();
});

test('this device keeps its sailor\'s id from one page to the next, and mends one that is no good', async () => {
  fresh();
  const ls = memory();
  ls.setItem('regatta-match-me', JSON.stringify('abcdefgh12'));
  const g = await page('Guest', { ls });
  assert.equal(JSON.parse(ls.getItem('regatta-match-me')), 'abcdefgh12');
  g.gone();
  const bad = memory();
  bad.setItem('regatta-match-me', JSON.stringify('NOT OK!'));
  const b = await page('Guest', { ls: bad });
  assert.match(JSON.parse(bad.getItem('regatta-match-me')), /^[a-z0-9]{8,24}$/);
  b.gone();
});

test('her boat\'s look goes with her, less a saved logo picture', async () => {
  fresh();
  const ls = memory(); ls.setItem('regatta-boat', JSON.stringify({ hull: 'red', logoImg: 'data:xxx' }));
  const { h, g } = await room({}, { ls });
  h.press('.m-start');
  until(() => h.cur()?.H, h, g);
  const her = h.cur().race.humans.find((b) => b !== h.cur().race.player);
  assert.deepEqual(her.look, { hull: 'red' });
  h.gone(); g.gone();
});

test('a saved boat that is not a boat is no look at all', async () => {
  fresh();
  const ls = memory(); ls.setItem('regatta-boat', '{oops');
  const { h, g } = await room({}, { ls });
  h.press('.m-start');
  until(() => h.cur()?.H, h, g);
  assert.equal(h.cur().race.humans.find((b) => b !== h.cur().race.player).look ?? null, null);
  h.gone(); g.gone();
});

// ---------- what can go wrong on the way in ----------
const failing = { 'the server answers with an error': { connect: async () => ({ ok: false }) }, 'the network is down': { connect: async () => { throw new Error('offline'); } }, 'the answer has no address': { cfg: { url: '' } }, 'the answer has no key': { cfg: { key: '' } } };
for (const [what, opts] of Object.entries(failing)) {
  test(`${what}: it says so and offers another try`, async () => {
    fresh();
    const g = await page('Guest', opts);
    run(0.5, g);
    assert.equal(g.says('#mRoom .m-st'), 'Couldn’t connect to the race');
    assert.ok(g.$('#mRoom .m-st').classList.contains('bad'));
    assert.equal(g.shows('.m-retry'), true);
    assert.equal(g.says('.m-retry'), 'Try again');
    g.press('.m-retry');
    assert.equal(g.reloads, 1);
    g.gone();
  });
}

test('in Russian it says so in Russian', async () => {
  fresh();
  const g = await page('Guest', { lang: 'ru', connect: async () => ({ ok: false }) });
  run(0.5, g);
  assert.equal(g.says('#mRoom .m-st'), 'Не удалось подключиться к гонке');
  assert.equal(g.says('.m-retry'), 'Ещё раз');
  g.gone();
});

test('a host who can\'t connect has no Start to press', async () => {
  fresh();
  const h = await page('Host', { host: true, connect: async () => ({ ok: false }) });
  run(0.5, h);
  assert.equal(h.shows('.m-start'), false);
  h.gone();
});

test('the link failing to open counts as not connecting, and is logged', async () => {
  fresh();
  const was = console.error, said = [];
  console.error = (...a) => said.push(a);
  const g = await page('Guest', { noLink: true });
  console.error = was;
  run(0.5, g);
  assert.equal(said.length, 1);
  assert.equal(g.says('#mRoom .m-st'), 'Couldn’t connect to the race');
  g.gone();
});

test('a room that refuses her counts as not connecting', async () => {
  fresh();
  const g = await page('Guest', { joinFails: true });
  await Promise.resolve();
  run(0.5, g);
  assert.equal(g.says('#mRoom .m-st'), 'Couldn’t connect to the race');
  g.gone();
});

test('a race on the page before the connection is up says Connecting', async () => {
  fresh();
  let open;
  const hold = new Promise((r) => { open = r; });
  const pending = page('Guest', { connect: async () => { await hold; return { ok: true, json: async () => ({ url: 'u', key: 'k', name: 'Guest', build: 'b1' }) }; } });
  await new Promise((r) => { queueMicrotask(r); });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const s = on;
  assert.equal(s.says('#mRoom .m-st'), 'Connecting…');
  open();
  await pending;
  s.gone();
});

// ---------- the wrong page for this race ----------
test('a host on another venue\'s page is sent to the race\'s own, once', async () => {
  fresh();
  const h = await page('Host', { host: true, venue: 'gocek', search: '?match=ABC234' });
  assert.deepEqual(h.replaced, ['/play?match=ABC234&venue=palma&boat=jpk1050&fix=1']);
  run(1, h);
  assert.equal(h.channels.length, 0, 'no room is opened here');
  h.gone();
});

test('a host on another yacht\'s page too', async () => {
  fresh();
  const h = await page('Host', { host: true, yacht: 'j70' });
  assert.equal(h.replaced.length, 1);
  assert.match(h.replaced[0], /boat=jpk1050/);
  h.gone();
});

test('sent there and still not the race\'s, the host races what the page has', async () => {
  fresh();
  const h = await page('Host', { host: true, venue: 'gocek', yacht: 'j70', search: '?fix=1' });
  run(0.5, h);
  assert.deepEqual(h.replaced, []);
  assert.equal(h.$('.m-link input').value, `http://game.test/match/${CODE}?v=gocek&b=j70`);
  const kept = JSON.parse(h.ls.getItem('regatta-match-settings'));
  assert.deepEqual([kept.venue, kept.yacht], ['gocek', 'j70']);
  assert.match(h.says('.m-set'), /^gocek · j70 · /);
  h.gone();
});

test('a guest on another venue\'s page is sent to the race\'s own', async () => {
  fresh();
  const h = await page('Host', { host: true }), g = await page('Guest', { venue: 'gocek', search: '?match=ABC234' });
  run(1, h, g);
  assert.deepEqual(g.replaced, ['/play?match=ABC234&venue=palma&boat=jpk1050&fix=1']);
  run(1, h, g);
  assert.equal(g.replaced.length, 1, 'once');
  h.gone(); g.gone();
});

test('sent there and still not the race\'s, the guest is told why and leaves the room to the host', async () => {
  fresh();
  const h = await page('Host', { host: true }), g = await page('Guest', { venue: 'gocek', search: '?fix=1' });
  run(1, h, g);
  assert.deepEqual(g.replaced, []);
  assert.equal(g.says('#mRoom .m-st'), 'This race is set at a venue or on a yacht this page can’t open');
  assert.ok(g.$('#mRoom .m-st').classList.contains('bad'));
  assert.equal(g.shows('.m-nameBox'), false);
  assert.equal(g.shows('.m-ppl'), false);
  run(1, h, g);
  assert.deepEqual(h.people()[1], ['Waiting for a friend…'], 'the host never takes her for her guest');
  assert.equal(h.$('.m-start').disabled, true);
  h.gone(); g.gone();
});

test('told why in Russian', async () => {
  fresh();
  const h = await page('Host', { host: true }), g = await page('Guest', { venue: 'gocek', search: '?fix=1', lang: 'ru' });
  run(1, h, g);
  assert.equal(g.says('#mRoom .m-st'), 'Эта гонка в месте или на яхте, которых эта страница не открывает');
  h.gone(); g.gone();
});

// ---------- another build of the game ----------
test('the two screens on different builds ask for a reload, and never race', async () => {
  const { h, g } = await room({}, { build: 'b2' });
  run(0.5, h, g);
  for (const s of [h, g]) {
    assert.equal(s.says('#mRoom .m-st'), 'The game was updated: reload to join', s.name);
    assert.equal(s.says('.m-retry'), 'Reload', s.name);
    assert.equal(s.shows('.m-retry'), true, s.name);
  }
  assert.equal(h.$('.m-start').disabled, true);
  h.press('.m-start'); // (a press that got through)
  run(1, h, g);
  assert.equal(h.raced, 0);
  g.press('.m-retry');
  assert.equal(g.reloads, 1);
  h.gone(); g.gone();
});

test('a build the server doesn\'t name is no reason to reload', async () => {
  const { h, g } = await room({ cfg: { build: 7 } }, { cfg: { build: null } });
  assert.equal(h.$('.m-start').disabled, false);
  assert.equal(g.says('#mRoom .m-st'), 'Waiting for Host to start the race…');
  h.gone(); g.gone();
});

test('reload asked for in Russian', async () => {
  const { h, g } = await room({ lang: 'ru' }, { build: 'b2' });
  run(0.5, h, g);
  assert.equal(h.says('#mRoom .m-st'), 'Игра обновилась: перезагрузи страницу, чтобы войти');
  assert.equal(h.says('.m-retry'), 'Перезагрузить');
  h.gone(); g.gone();
});

// ---------- leaving, and the link coming and going ----------
test('Leave in the room: off to the hub, once, and the link closed a moment later', async () => {
  const { h, g } = await room();
  g.press('#mRoom .m-leave');
  assert.equal(g.ended, 1);
  g.press('#mRoom .m-leave');
  assert.equal(g.ended, 1, 'once');
  assert.equal(g.rt.closed, 0);
  run(0.5, g);
  assert.equal(g.rt.closed, 1);
  run(0.5, h);
  assert.deepEqual(h.people()[1], ['Waiting for a friend…'], 'and the host sees she has gone');
  h.gone(); g.gone();
});

test('a host leaving forgets her saved race', async () => {
  const x = await carded();
  assert.notEqual(x.h.ls.getItem(`regatta-match-${CODE}`), null);
  x.h.press('#mCard .m-leave');
  assert.equal(x.h.ls.getItem(`regatta-match-${CODE}`), null);
  assert.equal(x.h.ended, 1);
  x.g.gone();
});

test('the host leaving on the water abandons the race on the guest\'s screen', async () => {
  const x = await sailing();
  let told = 0;
  x.g.tamper = (e) => { if (e === 'abandon') told++; };
  x.h.press('#mRoom .m-leave');
  assert.equal(x.h.ended, 1);
  assert.equal(told, 1, 'she is told it is abandoned');
  until(() => x.g.shows('#mCard'), x.g);
  assert.equal(x.g.says('#mCardH'), 'Race abandoned');
  assert.equal(x.g.says('#mCard .m-st'), 'Host left the race');
  assert.equal(x.g.kept.length, 0, 'nothing to keep');
  x.g.gone();
});

test('a page going away says goodbye to the room', async () => {
  const { h, g } = await room();
  g.fire('pagehide');
  run(0.5, h);
  assert.deepEqual(h.people()[1], ['Waiting for a friend…']);
  h.gone(); g.gone();
});

test('after leaving, a page going away has nothing more to say', async () => {
  const { h, g } = await room();
  g.press('#mRoom .m-leave');
  assert.doesNotThrow(() => g.fire('pagehide'));
  h.gone(); g.gone();
});

test('the network coming back, or the page coming to the front, checks the link at once', async () => {
  const { h, g } = await room();
  g.fire('online');
  assert.equal(g.rt.reconnects, 1);
  on = g; g.doc.visibilityState = 'hidden';
  for (const fn of g.doc.heard.visibilitychange) fn();
  assert.equal(g.rt.reconnects, 1, 'not while it is in the background');
  g.doc.visibilityState = 'visible';
  for (const fn of g.doc.heard.visibilitychange) fn();
  assert.equal(g.rt.reconnects, 2);
  g.press('#mRoom .m-leave');
  g.fire('online');
  assert.equal(g.rt.reconnects, 2, 'gone: no more of it');
  h.gone(); g.gone();
});

test('a page that never connected has no link to check', async () => {
  fresh();
  const g = await page('Guest', { connect: async () => ({ ok: false }) });
  assert.doesNotThrow(() => g.fire('online'));
  g.gone();
});

// ---------- the start of a race ----------
test('the race starts on both screens with the same seed, and hides the room', async () => {
  const { h, g, hr } = await sailing();
  assert.equal(g.cur().race.seed, hr.seed);
  assert.equal(h.shows('#mRoom'), false);
  assert.equal(g.shows('#mRoom'), false);
  assert.equal(h.session.isGuest, false);
  assert.equal(g.session.isGuest, true);
  assert.equal(h.session.race, hr);
  assert.equal(h.session.debug.phase, 'race');
  assert.equal(h.heartbeat, 5000);
  h.gone(); g.gone();
});

test('the host waits for the guest\'s screen to build the race, and says so', async () => {
  const { h, g } = await room();
  h.deaf = (e) => e === 'loaded';
  h.press('.m-start');
  run(1.5, h, g);
  assert.equal(h.says('#mBanner'), 'Waiting for Guest to load the race…');
  assert.equal(h.cur().H, null, 'her race hasn\'t started');
  h.deaf = null;
  until(() => h.cur().H, h, g);
  assert.equal(h.shows('#mBanner'), false);
  h.gone(); g.gone();
});

test('that wait in Russian', async () => {
  const { h, g } = await room({ lang: 'ru' });
  h.deaf = (e) => e === 'loaded';
  h.press('.m-start');
  run(1.5, h, g);
  assert.equal(h.says('#mBanner'), 'Guest загружает гонку…');
  h.gone(); g.gone();
});

test('the guest goes on saying her screen is ready until the race comes', async () => {
  const { h, g } = await room();
  let told = 0;
  h.deaf = (e) => { if (e === 'loaded') told++; return e === 'loaded'; };
  h.press('.m-start');
  run(5.5, h, g);
  assert.ok(told >= 4, `told ${told} times`);
  h.gone(); g.gone();
});

test('a start heard with no state after it: the guest goes by the start itself', async () => {
  const { h, g } = await room();
  g.deaf = (e) => e === 'mstate';
  h.press('.m-start');
  run(1, h, g);
  assert.equal(g.raced, 0, 'she waits a moment for the host\'s word');
  run(1, h, g);
  assert.equal(g.raced, 1, 'but not for long');
  assert.equal(g.cur().race.seed, h.cur().race.seed);
  h.gone(); g.gone();
});

test('a guest silent on the water: the host is told, and her link is checked', async () => {
  const x = await sailing();
  x.h.deaf = (e) => e === 'input';
  run(1, x.h, x.g);
  assert.equal(x.h.shows('#mBanner'), false, 'a second is nothing');
  const before = x.h.rt.reconnects;
  run(3, x.h, x.g);
  assert.equal(x.h.says('#mBanner'), 'guestGone Guest');
  assert.equal(x.h.rt.reconnects, before + 1, 'at once');
  run(4, x.h, x.g);
  assert.equal(x.h.rt.reconnects, before + 1, 'not again for ten seconds');
  run(7, x.h, x.g);
  assert.equal(x.h.rt.reconnects, before + 2);
  x.h.deaf = null;
  run(1, x.h, x.g);
  assert.equal(x.h.shows('#mBanner'), false, 'she is back');
  x.h.gone(); x.g.gone();
});

test('a host gone quiet: the guest is told she is waiting, and her link is checked', async () => {
  const x = await sailing();
  x.g.deaf = (e) => e === 'snap' || e === 'ev' || e === 'mstate';
  run(2.5, x.h, x.g);
  assert.equal(x.g.shows('#mBanner'), false);
  run(2, x.h, x.g);
  assert.equal(x.g.says('#mBanner'), 'waitingHost Host');
  assert.ok(x.g.rt.reconnects >= 1);
  x.g.deaf = null;
  run(1, x.h, x.g);
  assert.equal(x.g.shows('#mBanner'), false);
  x.h.gone(); x.g.gone();
});

test('a host who never sends the race: the guest waits, and says so after four seconds', async () => {
  const { h, g } = await room();
  g.deaf = (e) => e === 'snap';
  h.press('.m-start');
  until(() => g.raced === 1, h, g);
  run(2, h, g);
  assert.equal(g.shows('#mBanner'), false);
  run(1.5, h, g);
  assert.equal(g.says('#mBanner'), 'waitingHost Host');
  h.gone(); g.gone();
});

test('with her frames stopped the guest still says so, a moment later', async () => {
  const { h, g } = await room();
  g.deaf = (e) => e === 'snap';
  h.press('.m-start');
  until(() => g.raced === 1, h, g);
  g.racing = false;
  run(3, h, g);
  assert.equal(g.shows('#mBanner'), false);
  run(1.2, h, g);
  assert.equal(g.says('#mBanner'), 'waitingHost Host');
  h.gone(); g.gone();
});

test('the host abandoning: the guest is told over the water before the card comes', async () => {
  const x = await sailing();
  on = x.h; x.h.channels[0].send('abandon', { seed: x.hr.seed });
  run(0.3, x.g);
  assert.equal(x.g.says('#mBanner'), 'abandoned');
  x.h.gone(); x.g.gone();
});

test('the host abandoning: the card says so, and the guest stops listening', async () => {
  const x = await sailing();
  on = x.h; x.h.channels[0].send('abandon', { seed: x.hr.seed });
  until(() => x.g.shows('#mCard'), x.g);
  assert.equal(x.g.says('#mCardH'), 'Race abandoned');
  assert.equal(x.g.says('#mCard .m-sub'), 'It doesn’t count for either of you');
  assert.equal(x.g.cur().G.stopped, true);
  x.h.gone(); x.g.gone();
});

test('the abandoned card in Russian', async () => {
  const x = await sailing({}, { lang: 'ru' });
  on = x.h; x.h.channels[0].send('abandon', { seed: x.hr.seed });
  until(() => x.g.shows('#mCard'), x.g);
  assert.equal(x.g.says('#mCardH'), 'Гонка прекращена');
  assert.equal(x.g.says('#mCard .m-sub'), 'Она не засчитывается никому из вас');
  x.h.gone(); x.g.gone();
});

test('a host silent for five minutes ends the race on the guest\'s screen', async () => {
  const x = await sailing();
  x.h.gone();
  x.g.deaf = () => true;
  clock.t += 301000;
  until(() => x.g.shows('#mCard'), x.g);
  assert.equal(x.g.says('#mCardH'), 'Race abandoned');
  x.g.gone();
});

test('a host\'s tab asleep over a minute abandons the race on both screens', async () => {
  const x = await sailing();
  clock.t += 61000;
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard'), x.h, x.g);
  for (const s of [x.h, x.g]) assert.equal(s.says('#mCardH'), 'Race abandoned', s.name);
  assert.equal(x.h.kept.length, 0, 'no record of it');
  x.h.gone(); x.g.gone();
});

test('results that never come: after thirty seconds the two screens stop waiting', async () => {
  const x = await sailing();
  x.g.deaf = (e) => e === 'results';
  home(x.hr, x.H); home(x.hr, x.G);
  until(() => x.h.shows('#mCard') && x.g.shows('#mCard'), x.h, x.g);
  run(15, x.h, x.g);
  assert.equal(x.h.cur().H.stopped, false);
  assert.equal(x.g.cur().G.stopped, false);
  assert.equal(x.g.shows('#mCard .m-full'), false, 'she has no results to show');
  until(() => x.h.cur().H.stopped && x.g.cur().G.stopped, x.h, x.g);
  assert.equal(x.g.kept.length, 0);
  x.h.gone(); x.g.gone();
});

test('the guest gone before her screen has the race: no race, and the host is told', async () => {
  const { h, g } = await room();
  h.deaf = (e) => e === 'loaded';
  h.press('.m-start');
  run(1, h, g);
  assert.equal(h.cur().H, null);
  g.press('#mRoom .m-leave');
  until(() => h.shows('#mCard'), h);
  assert.equal(h.says('#mCardH'), 'Race abandoned');
  assert.equal(h.says('#mCard .m-st'), 'Guest left the race');
  assert.equal(h.shows('#mCard .m-go'), false);
  h.gone(); g.gone();
});

test('someone else\'s leaving means nothing to the race', async () => {
  const x = await sailing();
  on = x.g; x.g.channels[0].send('leave', { id: 'somebodyelse' }); x.g.channels[0].send('leave', null);
  run(1, x.h, x.g);
  assert.equal(x.hr.over, false);
  assert.equal(x.h.session.debug.match.leftBy, null);
  x.h.gone(); x.g.gone();
});

test('a race ended with the host\'s tab in the background is still ended', async () => {
  const x = await sailing();
  x.h.racing = false; // her frames have stopped
  on = x.g; x.g.mod.leaveMatch();
  until(() => x.h.shows('#mCard'), x.h);
  assert.equal(x.h.says('#mCardH'), 'raceWon');
  assert.equal(x.h.kept.length, 1);
  x.h.gone(); x.g.gone();
});

// ---------- the note over a boat home ----------
test('home first, the note counts down the time she has left, in minutes and then in seconds', async () => {
  const x = await sailing();
  home(x.hr, x.H);
  until(() => x.h.shows('#mNote'), x.h, x.g);
  assert.match(x.h.says('#mNote'), /^Guest is still racing · (3:00|2:5\d) left · Keep this screen open$/);
  x.hr.clock = x.H.finish + 140;
  run(0.5, x.h, x.g);
  assert.match(x.h.says('#mNote'), /^Guest is still racing · \d\d s left · Keep this screen open$/);
  x.h.gone(); x.g.gone();
});

test('the note in Russian, with the unit in Russian', async () => {
  const x = await sailing({ lang: 'ru' });
  home(x.hr, x.H);
  until(() => x.h.shows('#mNote'), x.h, x.g);
  x.hr.clock = x.H.finish + 140;
  run(0.5, x.h, x.g);
  assert.match(x.h.says('#mNote'), /^Guest ещё в гонке · осталось \d\d с · Не закрывай этот экран$/);
  x.h.gone(); x.g.gone();
});

test('the guest home first has the same note, without being told to keep her screen open', async () => {
  const x = await sailing();
  home(x.hr, x.G);
  until(() => x.g.shows('#mNote'), x.h, x.g);
  assert.match(x.g.says('#mNote'), /^Host is still racing · (3:00|2:5\d) left$/);
  assert.equal(x.h.shows('#mNote'), false, 'the boat still racing has none');
  x.h.gone(); x.g.gone();
});

test('a boat disqualified at the finish starts no clock: the note has no time in it', async () => {
  const x = await sailing();
  x.H.pen = { turns: 1 };
  home(x.hr, x.H);
  until(() => x.h.shows('#mNote'), x.h, x.g);
  assert.equal(x.H.dsq, true);
  assert.equal(x.h.says('#mNote'), 'Guest is still racing · Keep this screen open');
  x.h.gone(); x.g.gone();
});

// ---------- the word over the water at the race's end ----------
test('a race won on the water with no finish of her own: the boat is told', async () => {
  const x = await sailing();
  ended(x, { winner: x.H });
  assert.deepEqual(x.h.toasts, ['raceWon']);
  assert.deepEqual(x.g.toasts, ['raceLost Host']);
  x.h.gone(); x.g.gone();
});

test('a race won by the other boat: the host is told too', async () => {
  const x = await sailing();
  ended(x, { winner: x.G });
  assert.deepEqual(x.h.toasts, ['raceLost Guest']);
  assert.deepEqual(x.g.toasts, ['raceWon']);
  x.h.gone(); x.g.gone();
});

test('the other boat dropping out is said with her name', async () => {
  const x = await sailing();
  on = x.g; x.g.mod.leaveMatch();
  until(() => x.h.toasts.length > 0, x.h);
  assert.deepEqual(x.h.toasts, ['Guest dropped out · raceWon']);
  x.h.gone(); x.g.gone();
});

test('a boat that crossed the line herself needs no telling', async () => {
  const x = await carded();
  assert.deepEqual(x.h.toasts, []);
  assert.deepEqual(x.g.toasts, []);
  x.h.gone(); x.g.gone();
});

test('a race with no winner tells nobody anything', async () => {
  const x = await sailing();
  ended(x, { winner: null });
  assert.deepEqual(x.h.toasts, []);
  assert.equal(x.h.says('#mCardH'), 'No winner');
  x.h.gone(); x.g.gone();
});

// ---------- the card ----------
test('the card stays off until the race has had its last moments on the water', async () => {
  const x = await sailing();
  home(x.hr, x.H); home(x.hr, x.G);
  until(() => x.hr.over, x.h, x.g);
  assert.equal(x.h.shows('#mCard'), false);
  assert.equal(x.h.idled, 0);
  run(2.5, x.h, x.g);
  assert.equal(x.h.shows('#mCard'), false, 'three and a half seconds on the water');
  run(CARD_S - 2.5, x.h, x.g);
  assert.equal(x.h.shows('#mCard'), true);
  assert.equal(x.h.idled, 1, 'the game\'s frames are told to stop');
  assert.equal(x.h.racing, false);
  x.h.gone(); x.g.gone();
});

test('the card\'s words in English: the title, the buttons, the gap', async () => {
  const x = await carded();
  assert.equal(x.h.says('#mCard .m-kick'), '1-on-1 race');
  assert.equal(x.h.says('#mCard .m-full'), 'Full result');
  assert.equal(x.h.says('#mCard .m-leave'), 'Done');
  assert.equal(x.h.rows().length, 2);
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  assert.equal(x.h.says('#mCard .m-go'), 'Rematch');
  assert.equal(x.g.says('#mCard .m-st'), 'Host can start a rematch');
  x.h.gone(); x.g.gone();
});

test('the card\'s words in Russian', async () => {
  const x = await carded({ lang: 'ru' }, { lang: 'ru' });
  assert.equal(x.h.says('#mCard .m-kick'), 'Гонка один на один');
  assert.equal(x.h.says('#mCard .m-full'), 'Полный результат');
  assert.equal(x.h.says('#mCard .m-leave'), 'Закончить');
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  assert.equal(x.h.says('#mCard .m-go'), 'Реванш');
  assert.equal(x.g.says('#mCard .m-st'), 'Host может начать реванш');
  x.h.gone(); x.g.gone();
});

test('a gap is in seconds and tenths, or minutes past a minute, in the language\'s own unit', async () => {
  const x = await sailing({}, { lang: 'ru' });
  Object.assign(x.H, { done: true, place: 1, finish: 100 }); Object.assign(x.G, { done: true, place: 2, finish: 112.34 });
  ended(x, { winner: x.H, margin: 12.34 });
  until(() => x.g.shows('#mCard'), x.h, x.g);
  assert.equal(x.h.rows()[1][2], '+12.3 s');
  assert.equal(x.g.rows()[1][2], '+12.3 с');
  x.h.gone(); x.g.gone();
  const y = await sailing();
  Object.assign(y.H, { done: true, place: 1, finish: 100 }); Object.assign(y.G, { done: true, place: 2, finish: 175 });
  ended(y, { winner: y.H, margin: 75 });
  assert.equal(y.h.rows()[1][2], '+1:15');
  y.h.gone(); y.g.gone();
});

test('a win by the other boat dropping out says so, in the third person or the second', async () => {
  const x = await sailing({}, { lang: 'ru' });
  ended(x, { winner: x.H, forfeited: x.G });
  until(() => x.g.shows('#mCard'), x.h, x.g);
  assert.equal(x.h.says('#mCard .m-sub'), 'Guest dropped out');
  assert.equal(x.g.says('#mCard .m-sub'), 'you: сход');
  assert.equal(x.g.says('#mCardH'), 'raceLost Host');
  x.h.gone(); x.g.gone();
});

test('the rematch\'s button on a screen with no race does nothing', async () => {
  const { h, g } = await room();
  await assert.doesNotReject(() => g.press('#mCard .m-go'));
  run(0.5, h, g);
  assert.equal(g.raced, 0);
  assert.equal(g.reloads, 0);
  h.gone(); g.gone();
});

test('with only what it must be given, the race still runs to its card', async () => {
  fresh();
  const h = await page('Host', { host: true });
  const g = await page('Guest', { bare: true });
  run(0.5, h, g);
  h.press('.m-start');
  until(() => h.cur()?.H && g.cur()?.G, h, g);
  const hr = h.cur().race;
  hr.clock = 60;
  Object.assign(hr, { over: true, winner: hr.player });
  until(() => g.shows('#mCard'), h, g);
  assert.equal(g.says('#mCardH'), 'raceLost Host');
  assert.equal(g.shows('#mCard .m-full'), false, 'with nothing to keep a record');
  assert.doesNotThrow(() => g.press('#mCard .m-leave'));
  h.gone(); g.gone();
});

test('an abandoned race has no Full result, even with a record of that race on this device', async () => {
  const x = await sailing();
  x.g.ls.setItem('regatta-match-result', JSON.stringify({ code: CODE, seed: x.hr.seed, id: 'old-record' }));
  on = x.h; x.h.channels[0].send('abandon', { seed: x.hr.seed });
  until(() => x.g.shows('#mCard'), x.g);
  assert.equal(x.g.shows('#mCard .m-full'), false);
  x.h.gone(); x.g.gone();
});

test('the guest who has said she is leaving is offered no rematch, though her line is still heard', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.h.deaf = (e) => e === 'bye';
  x.g.press('#mCard .m-leave');
  run(1, x.h);
  assert.equal(x.h.shows('#mCard .m-go'), false);
  assert.equal(x.h.says('#mCard .m-st'), 'Guest left the race');
  x.h.gone(); x.g.gone();
});

test('an ordinary finish has no line under the title', async () => {
  const x = await carded();
  assert.equal(x.h.shows('#mCard .m-sub'), false);
  x.h.gone(); x.g.gone();
});

test('a record that can\'t be kept is no reason to lose the card', async () => {
  const x = await sailing();
  x.h.keepThrows = true;
  let said;
  const was = console.error;
  console.error = (...a) => { said = a; };
  home(x.hr, x.H); home(x.hr, x.G);
  until(() => x.h.shows('#mCard'), x.h, x.g);
  console.error = was;
  assert.match(String(said[0]), /disk full/);
  assert.equal(x.h.shows('#mCard .m-full'), false, 'no record: no Full result');
  assert.match(x.h.says('#mCardH'), /^race(Won|Lost)/, 'the card is there all the same');
  on = x.h; await x.h.$('#mCard .m-full').click();
  assert.equal(x.h.ended, 0, 'a press on it goes nowhere');
  x.h.gone(); x.g.gone();
});

test('the other screen gone quiet after the race: the card says it is waiting, and offers no rematch', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.g.gone();
  run(12, x.h);
  assert.equal(x.h.shows('#mCard .m-go'), false);
  assert.equal(x.h.says('#mCard .m-st'), 'waitingHost Guest');
  x.h.gone();
});

test('the host gone quiet after the race: the guest\'s card says she is waiting', async () => {
  const x = await carded();
  x.h.gone();
  run(7, x.g);
  assert.equal(x.g.says('#mCard .m-st'), 'waitingHost Host');
  x.g.gone();
});

test('the host leaving after the race: the guest\'s card says so', async () => {
  const x = await carded();
  x.h.press('#mCard .m-leave');
  run(1, x.g);
  assert.equal(x.g.says('#mCard .m-st'), 'Host left the race');
  assert.equal(x.g.shows('#mCard .m-full'), true, 'her result stands');
  x.g.gone();
});

test('a rematch: the host presses, both screens are on a new race, and the old card has gone', async () => {
  const x = await carded();
  const seed = x.hr.seed;
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.h.press('#mCard .m-go');
  until(() => x.g.cur().race.seed !== seed && x.h.cur().H && x.g.cur().G, x.h, x.g);
  assert.notEqual(x.h.cur().race.seed, seed);
  assert.equal(x.g.cur().race.seed, x.h.cur().race.seed);
  assert.equal(x.h.shows('#mCard'), false);
  assert.equal(x.g.shows('#mCard'), false);
  assert.equal(x.h.raced, 2);
  assert.equal(x.g.raced, 2);
  x.h.gone(); x.g.gone();
});

test('the rematch\'s button does nothing on the guest\'s screen, or once the guest has gone', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.g.press('#mCard .m-go');
  run(1, x.h, x.g);
  assert.equal(x.g.raced, 1, 'hers isn\'t to press');
  x.g.gone();
  run(12, x.h);
  x.h.press('#mCard .m-go');
  run(1, x.h);
  assert.equal(x.h.raced, 1, 'nobody to race');
  x.h.gone();
});

test('after the race the other screen on a new build: the card asks for a reload', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.g.gone();
  const back = await page('Guest', { ls: x.g.ls, build: 'b2' });
  until(() => x.h.says('#mCard .m-go') === 'Reload' && back.says('#mCard .m-go') === 'Reload', x.h, back);
  for (const s of [x.h, back]) {
    assert.equal(s.says('#mCard .m-go'), 'Reload', s.name);
    assert.equal(s.shows('#mCard .m-go'), true, s.name);
    assert.equal(s.says('#mCard .m-st'), 'The game was updated: reload to join', s.name);
    assert.ok(s.$('#mCard .m-st').classList.contains('bad'), s.name);
  }
  x.h.press('#mCard .m-go');
  assert.equal(x.h.reloads, 1);
  assert.equal(x.h.raced, 1, 'no rematch across builds');
  x.h.gone(); back.gone();
});

test('and when the builds agree again the card goes back to its rematch', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.g.gone();
  const odd = await page('Guest', { ls: x.g.ls, build: 'b2' });
  until(() => x.h.says('#mCard .m-go') === 'Reload', x.h, odd);
  odd.gone();
  const same = await page('Guest', { ls: x.g.ls });
  until(() => x.h.says('#mCard .m-go') === 'Rematch' && x.h.shows('#mCard .m-go'), x.h, same);
  assert.equal(x.h.$('#mCard .m-st').classList.contains('bad'), false);
  x.h.gone(); same.gone();
});

// ---------- a page opened again ----------
const savedKey = `regatta-match-${CODE}`;

test('a host back on a race sailed to its end goes straight to its card', async () => {
  const x = await carded(), title = x.h.says('#mCardH');
  x.h.gone(); x.g.gone();
  fresh();
  const back = await page('Host', { ls: x.h.ls });
  assert.equal(back.shows('#mRoom'), false);
  assert.equal(back.shows('#mCard'), true);
  assert.equal(back.says('#mCardH'), title);
  assert.equal(back.shows('#mCard .m-full'), true, 'her record is still hers');
  assert.equal(back.kept.length, 0, 'not kept again');
  back.press('#mCard .m-full');
  assert.deepEqual(back.opened, ['Host-record-1']);
  back.gone();
});

test('a saved race five hours old is still there', async () => {
  const x = await carded();
  x.h.gone(); x.g.gone();
  clock.t += 5 * 3600 * 1000;
  fresh();
  const back = await page('Host', { ls: x.h.ls });
  assert.equal(back.shows('#mCard'), true);
  back.gone();
});

test('a saved race six hours old is forgotten', async () => {
  const x = await carded();
  x.h.gone(); x.g.gone();
  clock.t += 6 * 3600 * 1000 + 1000;
  fresh();
  const back = await page('Host', { ls: x.h.ls });
  assert.equal(back.shows('#mCard'), false);
  assert.equal(back.shows('#mRoom'), true);
  back.gone();
});

for (const [what, saved] of Object.entries({ 'unreadable': '{oops', 'of an older build, with no start': JSON.stringify({ at: 1e6, m: { score: [1, 0] } }), 'with its sailors missing': JSON.stringify({ at: 1e6, m: { start: {} } }) })) {
  test(`a saved race ${what} opens as no race at all`, async () => {
    fresh();
    const ls = memory(); ls.setItem(savedKey, saved);
    clock.t = Math.max(clock.t, 1e6);
    const s = saved.includes('"at"') ? JSON.parse(saved) : null;
    if (s) { s.at = clock.t; ls.setItem(savedKey, JSON.stringify(s)); }
    const h = await page('Host', { host: true, ls });
    run(0.5, h);
    assert.equal(h.shows('#mRoom'), true);
    assert.equal(h.shows('#mCard'), false);
    h.gone();
  });
}

test('an open page sweeps away other races\' saved state gone stale, and leaves the rest', async () => {
  fresh();
  const ls = memory();
  ls.setItem(`regatta-match-${OTHER}`, JSON.stringify({ at: clock.t - 7 * 3600 * 1000, m: {} }));
  ls.setItem('regatta-match-QQQQQ2', '{oops');
  ls.setItem('regatta-match-WWWWW3', JSON.stringify({ at: clock.t - 1000, m: {} }));
  ls.setItem('regatta-match-name', JSON.stringify('Kit'));
  ls.setItem('unrelated', 'x');
  const g = await page('Guest', { ls });
  assert.equal(ls.getItem(`regatta-match-${OTHER}`), null, 'old');
  assert.equal(ls.getItem('regatta-match-QQQQQ2'), null, 'unreadable');
  assert.notEqual(ls.getItem('regatta-match-WWWWW3'), null, 'fresh');
  assert.notEqual(ls.getItem('regatta-match-name'), null, 'not a race');
  assert.equal(ls.getItem('unrelated'), 'x');
  g.gone();
});

test('storage that refuses everything still lets her sail', async () => {
  fresh();
  const refuse = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const g = await page('Guest', { ls: refuse });
  run(0.5, g);
  assert.deepEqual(g.people()[1], ['Guest', 'you']);
  g.press('#mRoom .m-leave');
  assert.equal(g.ended, 1);
  g.gone();
});

test('a reloaded guest on a new rematch goes straight to the new race', async () => {
  const x = await carded();
  until(() => x.h.shows('#mCard .m-go'), x.h, x.g);
  x.g.gone();
  const back = await page('Guest', { ls: x.g.ls });
  until(() => x.h.shows('#mCard .m-go'), x.h, back);
  x.h.press('#mCard .m-go');
  until(() => back.raced === 1 && x.h.cur().H, x.h, back);
  assert.equal(back.cur().race.seed, x.h.cur().race.seed);
  x.h.gone(); back.gone();
});
