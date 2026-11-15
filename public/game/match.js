// A match race's protocol, with no DOM: the waiting room (Room), the match's score and state (Match), the two
// channels a match talks on (makeLink), and the race between the two screens: the host's game runs it (Host), the
// guest's follows it (Guest). Every clock is the injected now().
import { Race, wrap } from './sim.js';
import { applyControls, encodeSnap, applySnap, readBoat, lerpBoat, setBoat, setSails } from './wire.js';

export const HOST_KEY = 'regatta-match-host'; // localStorage: { code } of the match this browser hosts

const HELLO_MS = 3000;
const GONE_MS = 10000; // a hello unheard this long drops its sender from the room
const READY_MS = 60000; // between races, the next one starts this long after both are there
const ABSENT_MS = 300000; // gone this long, the match is over

// 'match:CODE' carries the room and the match's events; 'match:CODE:in' the guest's inputs (race sync).
export function makeLink(rt, code) {
  return { all: rt.channel('match:' + code), input: rt.channel('match:' + code + ':in') };
}

const byJoin = (a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class Room {
  // every: ms between ticks of the built-in timer (hello + expiry); 0 = none, the caller calls tick() itself.
  constructor({ link, me, host, settings = null, now = Date.now, every = 1000 }) {
    this.link = link;
    this.me = me;
    this.isHost = !!host;
    this.now = now;
    this._hello = { id: me.id, name: me.name, look: me.look, host: !!host, settings: host ? settings : null, joinedAt: now() };
    this._peers = new Map(); // id -> { hello, seen }
    this._lastHello = -Infinity;
    this._starts = [];
    this._started = null; // the host: the StartMsg it sent; carried in its hello for a client that missed it
    this._emitted = false;
    this._pick = null; // the host's guest, kept while that guest is heard
    this._left = false;
    this._paused = false;
    this.error = null;
    const all = link.all;
    all.on('hello', (h) => {
      if (!h || h.id === me.id) return;
      const known = this._peers.has(h.id);
      this._peers.set(h.id, { hello: h, seen: this.now() });
      if (h.host && h.start && (h.start.guest?.id === me.id || h.start.host?.id === me.id)) this._emitStart(h.start);
      if (!known) this._sendHello(); // answer a newcomer at once rather than on the next beat
    });
    all.on('bye', (b) => { if (b) this._peers.delete(b.id); });
    all.on('start', (m) => { if (m && (m.host?.id === me.id || m.guest?.id === me.id)) this._emitStart(m); });
    // resolves true once joined, false if the join failed (room.error holds why)
    this.joined = all.join().then(() => { if (!this._left) this._sendHello(); return true; }, (e) => { this.error = e || new Error('join failed'); return false; });
    this._timer = every ? setInterval(() => this.tick(), every) : null;
    this._timer?.unref?.();
  }

  _sendHello() {
    this._lastHello = this.now();
    const h = this._hello;
    if (this.isHost) { h.guestId = this._hostGuest()?.id ?? null; h.start = this._started; }
    this.link.all.send('hello', h);
  }
  _emitStart(m) { if (this._emitted) return; this._emitted = true; for (const fn of this._starts) fn(m); }
  // The host's own pick: sticky while heard, else the first non-host by joinedAt, then id.
  _hostGuest() {
    const c = this._heard().filter((h) => !h.host);
    const kept = c.find((h) => h.id === this._pick);
    if (kept) return kept;
    const g = c.sort(byJoin)[0] || null;
    this._pick = g ? g.id : null;
    return g;
  }
  // (paused, nobody goes: during a race the snapshots and inputs show who is there)
  _heard() { const t = this.now(); return [...this._peers.values()].filter((p) => this._paused || t - p.seen < GONE_MS).map((p) => p.hello); }

  // Beat: hello every 3 s, unless paused.
  tick() { if (!this._left && !this._paused && this.now() - this._lastHello >= HELLO_MS) this._sendHello(); }
  // While a race is on the hellos stop (the race's own messages show both are there); after it they start again at
  // once, and each peer has its 10 s from then. A newcomer is still answered.
  pause(on) {
    on = !!on;
    if (on === this._paused) return;
    this._paused = on;
    if (on || this._left) return;
    const t = this.now();
    for (const p of this._peers.values()) p.seen = t;
    this._sendHello();
  }

  get host() {
    if (this.isHost) return this._hello;
    return this._heard().filter((h) => h.host).sort(byJoin)[0] || null;
  }
  // The host's pick, as the host sends it; a client that hasn't heard the host orders by joinedAt, then id.
  get guest() {
    if (this.isHost) return this._hostGuest();
    const gid = this.host?.guestId;
    if (gid) return gid === this.me.id ? this._hello : this._heard().find((h) => h.id === gid) || null;
    const c = this._heard().filter((h) => !h.host);
    c.push(this._hello);
    return c.sort(byJoin)[0] || null;
  }
  get full() {
    if (this.isHost) return false;
    const gid = this.host?.guestId;
    if (gid) return gid !== this.me.id;
    const g = this.guest;
    return !!g && g.id !== this.me.id;
  }
  get settings() { return this.host?.settings ?? null; }

  canStart() { return this.isHost && !!this.guest; }
  start() {
    const guest = this.guest;
    if (!this.isHost || !guest) throw new Error('only the host, with a guest present, can start');
    const pick = (h) => ({ id: h.id, name: h.name, look: h.look });
    const msg = { settings: this.settings, seed: Math.floor(Math.random() * 100000), race: 1, blue: this._hello.id, host: pick(this._hello), guest: pick(guest) };
    this._started = msg;
    this.link.all.send('start', msg);
    this._emitStart(msg);
    return msg;
  }
  onStart(fn) { this._starts.push(fn); }

  leave() {
    if (this._left) return;
    this._left = true;
    if (this._timer) clearInterval(this._timer);
    this.link.all.send('bye', { id: this.me.id });
    this.link.all.leave();
  }
}

// The score and state of one match: pure, no channels. blue is the host in odd races, the guest in even ones.
// raceN is the race in progress, or the one just sailed while 'between'; nextN is the number the next will have.
export class Match {
  constructor({ start, now = Date.now, _from = null }) {
    this.start = start;
    this.now = now;
    this.hostId = start.host.id;
    this.guestId = start.guest.id;
    this.state = 'race';
    this.raceN = 1;
    this.score = { [this.hostId]: 0, [this.guestId]: 0 };
    this.races = [];
    this._ready = new Set();
    this._absent = { [this.hostId]: null, [this.guestId]: null }; // id -> when they went, or null
    this._since = now(); // when the between card opened, or the later of that and the last return
    this.leftBy = null;
    if (_from) Object.assign(this, _from);
  }

  get nextN() { return this.races.length + 1; }
  blueOf(n) { return n % 2 === 1 ? this.hostId : this.guestId; }
  seedOf(n) { return (this.start.seed + n * 7919) % 100000; }

  endRace({ winner = null, margin = null, abandoned = false }) {
    if (this.state !== 'race') return;
    this.races.push({ winner: abandoned ? null : winner, margin: abandoned ? null : margin, abandoned: !!abandoned });
    if (winner && !abandoned) this.score[winner] = (this.score[winner] || 0) + 1;
    this._ready.clear();
    this._since = this.now();
    this.state = Object.values(this.score).some((s) => s >= 2) ? 'over' : 'between';
  }

  ready(id) { this._ready.add(id); this._advance(); }
  present(id, on) {
    if (!(id in this._absent)) return;
    if (on) { if (this._absent[id] !== null) { this._absent[id] = null; this._since = Math.max(this._since, this.now()); } }
    else if (this._absent[id] === null) this._absent[id] = this.now();
    this._advance();
  }
  leave(id) { this.leftBy = id; this.state = 'over'; }

  tick() {
    if (this.state === 'over') return;
    const t = this.now();
    if (Object.values(this._absent).some((a) => a !== null && t - a >= ABSENT_MS)) { this.state = 'over'; return; }
    this._advance();
  }

  _advance() {
    if (this.state !== 'between') return;
    if (Object.values(this._absent).some((a) => a !== null)) return; // never with one of them missing
    const both = this._ready.has(this.hostId) && this._ready.has(this.guestId);
    if (both || this.now() - this._since >= READY_MS) this.nextRace();
  }
  nextRace() {
    if (this.state !== 'between') return;
    this.raceN = this.nextN;
    this.state = 'race';
    this._ready.clear();
  }

  toJSON() {
    return { start: this.start, state: this.state, raceN: this.raceN, score: this.score, races: this.races, leftBy: this.leftBy };
  }
  // The host's saved match after a reload: a race that was on lived only in that tab, so it is abandoned and
  // scores nothing; the match goes on at the score, to the next race.
  static from(json, now = Date.now) {
    const j = JSON.parse(JSON.stringify(json));
    const m = new Match({ start: j.start, now });
    m.score = j.score; m.races = j.races; m.raceN = j.raceN; m.leftBy = j.leftBy ?? null; m.state = j.state;
    if (m.state === 'race') {
      m.races.push({ winner: null, margin: null, abandoned: true });
      m.raceN = m.races.length;
      m.state = 'between';
    }
    m._since = now();
    return m;
  }
}

// ---------- the race between the two screens ----------
// 'match:CODE' (link.all): host → guest snap { c, f, w, b, a } (wire.js; a: [g, hc], the guest's latest controls'
// own clock stamp and the host's clock when they came, or null) ten times a second; ev { list: [{ key, arg, to: id |
// null }] }, the race's news; end { winner, margin, forfeited } (ids) once it's over, and again every second it's
// ticked; abandon {} after the host's tab slept over a minute. 'match:CODE:in' (link.input): guest → host input
// { id, c, g } (controlsOf; g her clock when they last changed), as they change, at most every 0.2 s and at least
// every 0.5 s. The Room joins link.all; Host and Guest join link.input, and
// stop() leaves it.
const SNAP_S = 0.1; // a snapshot every 0.1 s of the race
const HOLD_MS = 3000; // a guest unheard this long holds her course; a host unheard this long: "Waiting for <host>"
const FORFEIT_MS = 30000; // a guest unheard this long: the race is the host's
const ASLEEP_MS = 60000; // a host's tab asleep this long, or unheard by the guest this long: the race is abandoned
const BEHIND_MS = 150; // the guest draws the host's boat this far behind real time, between two snapshots
const EASE_S = 0.5; // the guest's own boat eased to the host's copy of her, with this time constant…
const SNAP_M = 20; // …or taken as it is when further off than this, or after one of these on her:
const SNAP_ON = new Set(['bump', 'aground', 'touched', 'fouled', 'umpire']);
const INPUT_MIN_MS = 200, INPUT_MAX_MS = 500;
const HIST_S = 2; // the guest's own boat's recent poses, kept this long, to set the host's copy of her against

// race n of the match (match.raceN), as both screens build it: the host's settings, the race's seed and colours,
// the two sailors and their looks; myId the one this screen sails
export function raceFor(match, myId) {
  const n = match.raceN, s = match.start, pick = ({ id, name }) => ({ id, name });
  const race = new Race({ ...s.settings, seed: match.seedOf(n), match: true, humans: [pick(s.host), pick(s.guest)], me: myId, blue: match.blueOf(n) });
  for (const p of [s.host, s.guest]) race.humans.find((b) => b.id === p.id).look = p.look;
  return race;
}

const joinOf = (owner, ch) => ch.join().then(() => true, (e) => { owner.error = e || new Error('join failed'); return false; });

// The host's game: it runs the race. Its own boat is the local UI's; the guest's sails on the inputs that arrive.
export class Host {
  constructor({ race, link, guestId, now = Date.now }) {
    this.race = race;
    this.link = link;
    this.now = now;
    this.guest = race.humans.find((b) => b.id === guestId);
    this.stopped = false;
    this.abandoned = false;
    this.ended = false;
    this.error = null;
    this._endAt = -Infinity;
    this._c = null; // the guest's latest controls
    this._lastIn = now(); // when they came
    this._ack = null; // [her clock stamp on them, this race's clock when they came]
    this._lastTick = null;
    this._snapT = SNAP_S; // the first tick sends one
    this._sent = new WeakSet(race.messages); // the race's news so far is the guest's own race's too (same seed)
    link.input.on('input', (m) => {
      if (this.stopped || !m || m.id !== guestId || !m.c) return;
      this._c = m.c; this._lastIn = this.now();
      if (Number.isFinite(m.g) && m.g !== this._ack?.[0]) this._ack = [m.g, Math.round(this.race.clock * 1000) / 1000];
    });
    this.joined = joinOf(this, link.input);
  }

  tick(dt) {
    if (this.stopped) return;
    const race = this.race, t = this.now(), all = this.link.all;
    if (race.over) { this._lastTick = t; this._end(); return; } // a race sailed to its end is never abandoned
    if (this._lastTick !== null) {
      const gap = t - this._lastTick;
      if (gap > ASLEEP_MS) { all.send('abandon', {}); this.abandoned = true; this.stop(); return; }
      if (gap > HOLD_MS) this._lastIn += gap; // its own sleep isn't the guest's silence
    }
    this._lastTick = t;
    const g = this.guest, quiet = t - this._lastIn;
    if (quiet >= FORFEIT_MS) race.forfeit(g);
    else if (quiet >= HOLD_MS) { g.rudder = 0; g.auto = null; } // she holds her course
    else if (this._c) applyControls(race, g, this._c);
    if (!race.over) race.step(dt);
    const list = [];
    for (const m of race.messages) {
      if (this._sent.has(m)) continue;
      this._sent.add(m);
      list.push({ key: m.key, arg: m.arg ?? null, to: m.to ? m.to.id : null });
    }
    if (list.length) all.send('ev', { list });
    this._snapT += dt;
    if (this._snapT >= SNAP_S - 1e-6 || race.over) { this._snapT = 0; all.send('snap', { ...encodeSnap(race), a: this._ack }); }
    if (race.over) this._end();
  }
  // the end, told at once and again every second it's still ticked, for a guest whose connection blinked
  _end() {
    const t = this.now();
    if (this.ended && t - this._endAt < 1000) return;
    this.ended = true; this._endAt = t;
    const r = this.race;
    this.link.all.send('end', { winner: r.winner?.id ?? null, margin: r.margin ?? null, forfeited: r.forfeited?.id ?? null });
  }
  // stop listening and sending (the race is done with, or abandoned)
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.link.input.leave();
  }
}

// The guest's game: it follows the host's race. Her own boat is stepped here from her own hands (the helm answers at
// once), and set against the host's copy of her: each snapshot is compared with where she herself was when her
// controls were where the host's copy's were (her own clock stamp on the latest controls the host had, against its
// clock when they came), and that difference is eased away. The host's boat is drawn BEHIND_MS behind, between two
// snapshots; the calls, the penalties, the signals and the rest of the news are the host's. It never runs the rules.
export class Guest {
  constructor({ race, link, me, now = Date.now }) {
    this.race = race;
    this.link = link;
    this.now = now;
    this.me = typeof me === 'string' ? race.humans.find((b) => b.id === me) : me ?? race.player;
    this.stopped = false;
    this.hostSilent = false;
    this.abandoned = false;
    this.ended = null; // the end message, once the race is over
    this.error = null;
    this._ends = [];
    this._buf = []; // { at, s }: the snapshots, as they arrived
    this._lastSnap = now();
    this._lastFrame = null;
    this._first = true; // nothing taken from the host yet: her page has just opened
    this._snapMe = false; // take the host's copy of her as it is at the next snapshot
    this._hist = []; // { c, x, z, h, v }: her own boat, as her screen sailed her
    this._err = null; // the difference from the host's copy still to ease away
    this._sentAt = -Infinity;
    this._sentKey = null;
    this._key = null;
    this._changedC = race.clock;
    this._trackC = -Infinity;
    const all = link.all;
    all.on('snap', (s) => { if (!this.stopped) this._onSnap(s); });
    all.on('ev', (e) => { if (!this.stopped) this._onEv(e); });
    all.on('end', (e) => { if (!this.stopped) this._onEnd(e); });
    all.on('abandon', () => { if (!this.stopped && !this.ended) this.abandoned = true; });
    this.joined = joinOf(this, link.input);
  }

  onEnd(fn) { this._ends.push(fn); }
  _boat(id) { return id ? this.race.humans.find((b) => b.id === id) ?? null : null; }

  _onSnap(s) {
    const race = this.race, me = this.me, owed = me.owed, pen = !!me.pen;
    if (!applySnap(race, s, me)) return;
    if (pen && !me.pen && me.owed < owed) me.events.push('penaltyDone'); // the host saw her turn done
    const at = this.now();
    this._lastSnap = at;
    this._buf.push({ at, s });
    while (this._buf.length > 2 && this._buf[1].at < at - 1000) this._buf.shift();
    const o = readBoat(s.b[race.boats.indexOf(me)]);
    me.tackN = Math.max(me.tackN || 0, o.tackSeen || 0); // a reloaded page's presses count on from the host's
    me.hailN = Math.max(me.hailN || 0, o.hailSeen || 0);
    if (s.c - this._trackC >= 1) { // the other boats' tracks, at 1 Hz (her own is stepView's)
      this._trackC = s.c;
      race.boats.forEach((b, k) => { if (b !== me && !b.done) { const p = readBoat(s.b[k]); b.track.push([p.x, p.z]); } });
    }
    if (race.clock < s.c - 1) this._catchUp(s.c); // a page just opened, or one that slept: the wind and waves too
    // when her controls were where the host's copy's are: her clock stamp on them, less the host's clock when they came
    const lag = Array.isArray(s.a) && Number.isFinite(s.a[0]) && Number.isFinite(s.a[1]) ? s.a[0] - s.a[1] : 0;
    if (this._first) { this._first = false; setSails(me, o); this._take(o, s.c + lag); return; } // everything, once
    if (this._snapMe) { this._snapMe = false; this._take(o, s.c + lag); return; }
    const p = this._histAt(s.c + lag);
    if (!p) return;
    const E = { x: o.x - p.x, z: o.z - p.z, h: wrap(o.h - p.h), v: o.v - p.v };
    if (Math.hypot(E.x, E.z) > SNAP_M) this._take(o, s.c + lag);
    else this._err = E;
  }
  // the host's copy of her taken as it is, carried on to her own time from `c`, the time on her own clock it stands for
  _take(o, c) {
    const me = this.me, ahead = Math.max(0, this.race.clock - c);
    for (const k of ['x', 'z', 'h', 'v', 'heel', 'yawRate']) me[k] = o[k];
    me.x += Math.sin(o.h) * o.v * ahead; me.z -= Math.cos(o.h) * o.v * ahead;
    this._hist = []; this._err = null;
  }
  // her own pose at clock c, between the two around it (null outside what's kept)
  _histAt(c) {
    const H = this._hist;
    if (!H.length || c < H[0].c - 1e-6 || c > H[H.length - 1].c + 0.05) return null;
    let i = 1;
    while (i < H.length && H[i].c < c) i++;
    if (i >= H.length) return H[H.length - 1];
    const a = H[i - 1], b = H[i], f = b.c > a.c ? Math.min(1, Math.max(0, (c - a.c) / (b.c - a.c))) : 1;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, h: wrap(a.h + wrap(b.h - a.h) * f), v: a.v + (b.v - a.v) * f };
  }
  // the clock forward to c, the wind and the waves with it
  _catchUp(c) { for (let d = c - this.race.clock; d > 1e-9; d -= 0.25) this.race.advance(Math.min(0.25, d)); }

  _onEv(e) {
    const race = this.race, me = this.me;
    for (const m of e?.list || []) {
      const to = m.to ? this._boat(m.to) : null;
      if (m.to && to !== me) continue; // the other boat's news
      race.messages.push({ key: m.key, arg: m.arg, to });
      if (SNAP_ON.has(m.key) && (m.key !== 'umpire' || m.arg?.on === me.id)) this._snapMe = true;
    }
  }

  _onEnd(e) {
    if (this.ended) return;
    const race = this.race;
    this.ended = e || {};
    this.abandoned = false; // the race was sailed to its end: that stands, whatever her own page had given up on
    race.over = true;
    race.winner = this._boat(e?.winner) ?? race.winner;
    race.margin = e?.margin ?? null;
    race.forfeited = this._boat(e?.forfeited);
    for (const fn of this._ends) fn({ winner: e?.winner ?? null, margin: e?.margin ?? null, forfeited: e?.forfeited ?? null });
  }

  // her controls (controlsOf her boat), each frame: sent when they change, at most every 0.2 s, and at least every
  // 0.5 s; nothing until her boat has been taken from the host's first snapshot (a reloaded page's own sails aren't hers)
  input(c) {
    if (this.stopped) return;
    const t = this.now(), key = JSON.stringify(c.at ? { ...c, s: 0, j: c.sp ? c.j : 0 } : c); // auto-trim's sheet is the host's to work
    if (key !== this._key) { this._key = key; this._changedC = this.race.clock; }
    if (this._first) return;
    const since = t - this._sentAt;
    if ((key !== this._sentKey && since >= INPUT_MIN_MS) || since >= INPUT_MAX_MS) {
      this._sentAt = t; this._sentKey = key;
      this.link.input.send('input', { id: this.me.id, c, g: Math.round(this._changedC * 1000) / 1000 });
    }
  }

  frame(dt) {
    if (this.stopped) return;
    const race = this.race, me = this.me, t = this.now();
    if (this._lastFrame !== null && t - this._lastFrame > HOLD_MS) this._lastSnap += t - this._lastFrame; // her own page slept: not the host's silence
    this._lastFrame = t;
    if (this.ended) return;
    const silent = t - this._lastSnap;
    this.hostSilent = silent >= HOLD_MS;
    if (silent >= ASLEEP_MS) this.abandoned = true;
    if (this.hostSilent || this.abandoned) return; // frozen until the host's game is back
    const L = this._buf[this._buf.length - 1], est = L ? L.s.c + (t - L.at) / 1000 : null; // the host's clock now
    // her boat; her penalties are the host's to judge, and her screen's news (a turn begun) the host's to tell
    const n0 = race.messages.length, ne = me.events.length, owed = me.owed, pen = me.pen;
    if (est !== null && race.clock - est > dt / 2) { me.step(dt, race); this._hist = []; } // ahead of the host: the clock waits, she sails on
    else race.stepView(dt, me);
    race.messages.length = n0;
    me.owed = owed; me.pen = pen;
    if (me.events.length > ne) me.events.splice(ne, me.events.length - ne, ...me.events.slice(ne).filter((e) => e !== 'penaltyDone'));
    if (est !== null && est - race.clock > dt / 2) this._catchUp(est); // behind: forward, the wind and waves with it
    if (!L) return;
    // the other boat, BEHIND_MS behind, between the two snapshots around then
    const rt = t - BEHIND_MS, buf = this._buf;
    let k = buf.length - 1;
    while (k > 0 && buf[k].at > rt) k--;
    const A = buf[k], B = buf[Math.min(k + 1, buf.length - 1)], f = B.at > A.at ? Math.min(1, Math.max(0, (rt - A.at) / (B.at - A.at))) : 1;
    race.boats.forEach((b, i) => { if (b !== me) setBoat(b, lerpBoat(readBoat(A.s.b[i]), readBoat(B.s.b[i]), f)); });
    // her own boat: the difference from the host's copy eased away, her past poses moved with her
    const E = this._err, H = this._hist;
    if (E) {
      const e = 1 - Math.exp(-dt / EASE_S), d = { x: E.x * e, z: E.z * e, h: E.h * e, v: E.v * e };
      me.x += d.x; me.z += d.z; me.h = wrap(me.h + d.h); me.v += d.v;
      for (const p of H) { p.x += d.x; p.z += d.z; p.h = wrap(p.h + d.h); p.v += d.v; }
      E.x -= d.x; E.z -= d.z; E.h -= d.h; E.v -= d.v;
    }
    H.push({ c: race.clock, x: me.x, z: me.z, h: me.h, v: me.v });
    while (H.length && H[0].c < race.clock - HIST_S) H.shift();
  }

  // stop following (the race is done with, or the page is leaving)
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.link.input.leave();
  }
}
