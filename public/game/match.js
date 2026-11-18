// A 1-on-1 race's protocol, with no DOM: the waiting room (Room), the race's settings (cleanSettings) and state (Match,
// Keeper), the two channels it talks on (makeLink), and the race between the two screens: the host's game runs it
// (Host), the guest's follows it (Guest). Every clock is the injected now().
import { Race, wrap, YAW_LAG } from './sim.js';
import { applyControls, encodeSnap, applySnap, readBoat, setBoat, setSails, resultsOf } from './wire.js';
export { FINISH_LIMIT_S } from './sim.js';

export const HOST_KEY = 'regatta-match-host'; // localStorage: { code } of the match this browser hosts

const HELLO_MS = 3000;
const GONE_MS = 10000; // a hello unheard this long drops its sender from the room
const ABSENT_MS = 300000; // gone this long, the race is over

// 'match:CODE' carries the room and the match's events; 'match:CODE:in' the guest's inputs (race sync).
export function makeLink(rt, code) {
  return { all: rt.channel('match:' + code), input: rt.channel('match:' + code + ':in') };
}

// what the host may choose, each list's first the default: a race's settings as the two screens build it, whatever was
// saved or sent (an older set-up's, or a bad one's)
const CHOICES = { preset: ['medium', 'light', 'strong'], length: ['short', 'medium', 'long'], course: ['wl', 'tri', 'trap', 'wlu'], laps: [1, 2], start: [1, 3, 5], current: [0, 1],
  daytime: ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset'] };
export function cleanSettings(s, { venue, yacht }) {
  const o = s && typeof s === 'object' ? s : {}, out = { venue: String(o.venue || venue), yacht: String(o.yacht || yacht) };
  for (const [k, list] of Object.entries(CHOICES)) {
    const v = typeof list[0] === 'number' ? Number(o[k]) : o[k];
    out[k] = list.includes(v) ? v : list[0];
  }
  return out;
}

const byJoin = (a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class Room {
  // every: ms between ticks of the built-in timer (hello + expiry); 0 = none, the caller calls tick() itself.
  constructor({ link, me, host, settings = null, now = Date.now, every = 1000 }) {
    this.link = link;
    this.me = me;
    this.isHost = !!host;
    this.now = now;
    this._hello = { id: me.id, name: me.name, look: me.look, build: me.build ?? null, host: !!host, settings: host ? settings : null, joinedAt: now() };
    this._peers = new Map(); // id -> { hello, seen }
    this._lastHello = -Infinity;
    this._starts = [];
    this._started = null; // the host: the StartMsg it sent; carried in its hello for a client that missed it
    this._emitted = false;
    this._pick = null; // the host's guest, kept while that guest is heard
    this._pinned = null; // the host's guest once a match is on: hers alone, heard or not (pin)
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
    if (this.isHost) { h.guestId = this._pinned ?? this._hostGuest()?.id ?? null; h.start = this._started; }
    this.link.all.send('hello', h);
  }
  _emitStart(m) { if (this._emitted) return; this._emitted = true; for (const fn of this._starts) fn(m); }
  // The host's own pick: the pinned guest (or nobody while she isn't heard); else sticky while heard, else the first
  // non-host by joinedAt, then id.
  _hostGuest() {
    if (this._pinned) return this.peer(this._pinned);
    const c = this._heard().filter((h) => !h.host);
    const kept = c.find((h) => h.id === this._pick);
    if (kept) return kept;
    const g = c.sort(byJoin)[0] || null;
    this._pick = g ? g.id : null;
    return g;
  }
  // (paused, nobody goes: during a race the snapshots and inputs show who is there)
  _heard() { const t = this.now(); return [...this._peers.values()].filter((p) => this._paused || t - p.seen < GONE_MS).map((p) => p.hello); }
  // the hello of id while it's heard, else null; heard(id) whether it is
  peer(id) { const p = this._peers.get(id); return p && (this._paused || this.now() - p.seen < GONE_MS) ? p.hello : null; }
  heard(id) { return !!this.peer(id); }
  // The host, once a match is on: its guest is the match's (id), and nobody else, whoever else has the link. While she
  // isn't heard the room has no guest (the match waits for her), and its hellos still name her, so a third is told the
  // match is full. A rematch is hers too.
  pin(id) {
    if (!this.isHost || this._pinned === id) return;
    this._pinned = id; this._pick = id;
    if (!this._left && !this._paused) this._sendHello();
  }

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
    const msg = { settings: this.settings, seed: Math.floor(Math.random() * 100000), host: pick(this._hello), guest: pick(guest) };
    this._started = msg;
    this.link.all.send('start', msg);
    this._emitStart(msg);
    return msg;
  }
  onStart(fn) { this._starts.push(fn); }
  // a name typed in the waiting room: in every hello from now on (and told at once)
  rename(name) {
    this.me.name = name; this._hello.name = name;
    if (!this._left && !this._paused) this._sendHello();
  }

  leave() {
    if (this._left) return;
    this._left = true;
    if (this._timer) clearInterval(this._timer);
    this.link.all.send('bye', { id: this.me.id });
    this.link.all.leave();
  }
}

// The state of one race: pure, no channels. result: { winner, margin, forfeited, abandoned } (ids) once it is over.
export class Match {
  constructor({ start, now = Date.now }) {
    this.start = start;
    this.now = now;
    this.hostId = start.host.id;
    this.guestId = start.guest.id;
    this.state = 'race';
    this.result = null;
    this.leftBy = null;
    this._absent = { [this.hostId]: null, [this.guestId]: null }; // id -> when they went, or null
  }

  endRace({ winner = null, margin = null, forfeited = null, abandoned = false } = {}) {
    if (this.state !== 'race') return;
    this.state = 'over';
    this.result = abandoned ? { winner: null, margin: null, forfeited: null, abandoned: true } : { winner, margin, forfeited, abandoned: false };
  }
  // id has gone for good. The race lives in the host's tab, so with her it is abandoned; the guest's going is the race's
  // own to judge (Host.guestLeft: before her finish she gives it up, after it her place stands and it runs on)
  leave(id) {
    this.leftBy = id;
    if (id === this.hostId) this.endRace({ abandoned: true });
  }
  present(id, on) {
    if (!(id in this._absent)) return;
    if (on) this._absent[id] = null;
    else this._absent[id] ??= this.now();
  }
  tick() {
    if (this.state === 'over') return;
    const t = this.now();
    if (Object.values(this._absent).some((a) => a !== null && t - a >= ABSENT_MS)) this.endRace({ abandoned: true });
  }

  toJSON() { return { start: this.start, state: this.state, result: this.result, leftBy: this.leftBy }; }
  // The host's saved race after a reload: one that was on lived only in that tab, so it is abandoned; one sailed to its
  // end keeps its result. (A match saved by an older build, with a score and no result, opens as no race at all.)
  static from(json, now = Date.now) {
    const j = JSON.parse(JSON.stringify(json));
    const m = new Match({ start: j.start, now });
    m.leftBy = j.leftBy ?? null;
    m.endRace(j.state === 'over' && j.result ? j.result : { abandoned: true });
    return m;
  }
}

// The host's side of a race, with no DOM: who is here, and whether her screen has the race built; match-ui.js draws it.
// The guest is the race's, the Room pinned to her: a third with the link is never taken for her. Off the water she is
// here while the Room hears her, and her build is this page's (build: this page's; another build is another game: never
// raced, the screens ask for a reload), and, silent as the last race ended, once she has been heard since; in a race,
// while her inputs come (FORFEIT_MS).
//   loaded { id, seed }: the race is built on her screen
export class Keeper {
  constructor({ room, link, build = null, now = Date.now }) {
    Object.assign(this, { room, link, build, now });
    this.match = null;
    this.racing = false; // a Host is running the race: her inputs say she's there
    this.lastIn = 0; // her last input
    this.heardAt = 0; // her last hello
    this.quietFrom = 0; // silent as the last race ended: not here till heard after this
    this.loaded = null; // the seed of the last race her screen has built
    const all = link.all, hers = (m) => !!this.match && !!m && m.id === this.match.guestId;
    all.on('loaded', (m) => { if (hers(m) && m.seed === this.match.start.seed) this.loaded = m.seed; });
    all.on('hello', (h) => { if (hers(h)) this.heardAt = this.now(); });
    link.input.on('input', (m) => { if (hers(m)) this.lastIn = this.now(); });
  }
  // the race kept from now on: a new one, a rematch, or a reloaded host's saved one
  set(match) {
    this.match = match; this.quietFrom = 0; this.racing = false;
    this.room.pin(match.guestId);
  }
  // another build on the guest's screen (null while she isn't heard)
  stale() {
    const h = this.match && this.room.peer(this.match.guestId);
    return !!(h && this.build && h.build && h.build !== this.build);
  }
  present() {
    const M = this.match, t = this.now();
    if (!M) return false;
    if (this.racing) return t - this.lastIn < FORFEIT_MS;
    return this.room.heard(M.guestId) && !this.stale() && !(this.quietFrom && Math.max(this.heardAt, this.lastIn) < this.quietFrom);
  }
  // its race begins (its Host built), and ends with its result
  raceOn() { this.racing = true; this.lastIn = this.now(); }
  raceEnded(result) { this.match.endRace(result); }
  // the card opens. A guest silent then isn't here till she's heard again (the Room would give her ten seconds from its
  // hellos resuming)
  raceOff() {
    const t = this.now();
    this.quietFrom = this.racing && t - this.lastIn > HOLD_MS ? t : 0;
    this.racing = false;
  }
  // four times a second: her presence to the Match. On the water her silence is the race's to judge (the Host's forfeit;
  // a boat home has nothing to give up)
  beat() {
    const M = this.match;
    if (!M) return;
    M.present(M.guestId, this.racing || this.present());
    M.tick();
  }
}

// ---------- the race between the two screens ----------
// 'match:CODE' (link.all): host → guest snap { c, f, w, b, a } (wire.js; a: [g, hc], the guest's latest controls'
// own clock stamp and the host's clock when they came, or null) ten times a second; ev { list: [{ key, arg, to: id |
// null }] }, the race's news; end { winner, margin, forfeited } (ids) once it's over, the last snap before it, both
// again every second it's ticked; results (wire.js resultsOf) once it's over, every second until she answers; abandon
// {} after the host's tab slept over a minute, or at its Leave with the race on. 'match:CODE:in' (link.input): guest → host input { id, c, g } (controlsOf;
// g her own clock when they last changed), as they change (see INPUT_MIN_MS); resultsOk { id, seed }, for each results
// heard. The Room joins link.all; Host and Guest join link.input, and stop() leaves it.
const SNAP_S = 0.1; // a snapshot every 0.1 s of the race
const HOLD_MS = 3000; // a guest unheard this long holds her course; a host unheard this long: "Waiting for <host>"
const FORFEIT_MS = 30000; // a guest unheard this long: the race is the host's
const ASLEEP_MS = 60000; // a host's tab asleep this long: the race is abandoned (the host's word: the guest waits for it)
const CLOCK_S = 2; // the host's clock is read from the quickest snapshot of the last 2 s…
const HITCH_S = 0.25; // …unless one comes this much later for its clock than the last: the host's game fell behind
const CARRY_S = 1; // the host's boat carried on from its last snapshot to the host's clock now, at most this far
const RTT_N = 10; // the way there and back, the least of the last ten measured (her stamps' sends against their acks)
const EASE_S = 0.5; // the guest's own boat eased to the host's copy of her, with this time constant…
const SNAP_M = 20; // …or taken as it is when further off than this, or after one of these on her:
const SNAP_ON = new Set(['bump', 'aground', 'touched', 'fouled', 'umpire']);
// her controls go as they change, at most every 0.2 s, and at least every 0.5 s; a tack or gybe pressed, a hail, or
// the helm moved more than 0.3 since the last went, at once, but never more than ten a second
const INPUT_MIN_MS = 200, INPUT_MAX_MS = 500, INPUT_NOW_MS = 100, HELM_NOW = 0.3;
const HIST_S = 2; // the guest's own boat's recent poses, kept this long, to set the host's copy of her against

// the race, as both screens build it: the host's settings, its seed, the two sailors and their looks, and the seed's
// word on who has which start position (a rematch has a new seed); myId the one this screen sails
export function raceFor(match, myId) {
  const s = match.start, pick = ({ id, name }) => ({ id, name }), two = [pick(s.host), pick(s.guest)];
  const race = new Race({ ...s.settings, current: !!s.settings.current, seed: s.seed, fleet: 2, humans: s.seed % 2 ? two.reverse() : two, me: myId });
  for (const p of [s.host, s.guest]) race.humans.find((b) => b.id === p.id).look = p.look;
  return race;
}

const joinOf = (owner, ch) => ch.join().then(() => true, (e) => { owner.error = e || new Error('join failed'); return false; });

// The host's game: it runs the race. Its own boat is the local UI's; the guest's sails on the inputs that arrive.
// alive(): whether its own link to the server is known to be up (net.js lastHeard): while it isn't, the guest's silence
// may be its own outage, and her clock to holding course and to the forfeit stands still.
export class Host {
  constructor({ race, link, guestId, now = Date.now, alive = () => true }) {
    this.race = race;
    this.link = link;
    this.now = now;
    this.alive = alive;
    this.guest = race.humans.find((b) => b.id === guestId);
    this.stopped = false;
    this.abandoned = false;
    this.ended = false;
    this.acked = false; // the guest has the results
    this.error = null;
    this._endAt = -Infinity;
    this._results = null; // the race's results, built once as it ends
    this._flushAt = -Infinity;
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
    link.input.on('resultsOk', (m) => { if (!this.stopped && m && m.id === guestId && m.seed === race.seed) this.acked = true; });
    this.joined = joinOf(this, link.input);
  }

  tick(dt) {
    if (this.stopped) return;
    const race = this.race, t = this.now(), all = this.link.all;
    if (race.over) { this._lastTick = t; this._end(); return; } // a race sailed to its end is never abandoned
    if (this._lastTick !== null) {
      const gap = t - this._lastTick;
      if (gap > ASLEEP_MS) { all.send('abandon', {}); this.abandoned = true; this.stop(); return; }
      if (gap > HOLD_MS || !this.alive()) this._lastIn += gap; // its own sleep, or its own link in doubt, isn't the guest's silence
    }
    this._lastTick = t;
    const g = this.guest, quiet = t - this._lastIn;
    if (quiet >= FORFEIT_MS && !g.done) race.forfeit(g); // (a boat home has nothing to give up: the race runs out to its end)
    else if (quiet >= HOLD_MS && !g.done) { g.rudder = 0; g.auto = null; } // she holds her course
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
    if (this._snapT >= SNAP_S - 1e-6 && !race.over) { this._snapT = 0; all.send('snap', { ...encodeSnap(race), a: this._ack }); } // (the last is _end's)
    if (race.over) this._end();
  }
  // the guest has left the race: before her finish she gives it up at once; after it her place stands (race.forfeit)
  guestLeft() { if (!this.stopped) this.race.forfeit(this.guest); }
  // the results, once a second until she answers
  flush() {
    const t = this.now();
    if (this.stopped || this.acked || !this._results || t - this._flushAt < 1000) return;
    this._flushAt = t;
    this.link.all.send('results', this._results);
  }
  // the end, and the boats as they ended it, told at once and again every second it's still ticked, for a guest whose
  // connection blinked or whose page has just opened
  _end() {
    this._results ??= resultsOf(this.race);
    this.flush();
    const t = this.now();
    if (this.ended && t - this._endAt < 1000) return;
    this.ended = true; this._endAt = t;
    const r = this.race;
    this.link.all.send('snap', { ...encodeSnap(r), a: this._ack });
    this.link.all.send('end', { winner: r.winner?.id ?? null, margin: r.margin ?? null, forfeited: r.forfeited?.id ?? null });
  }
  // stop listening and sending (the race is done with, or abandoned)
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.link.input.leave();
  }
}


// boat o (a read row) t s on: her speed held, and her turn dying away as the helm is taken to be centred (YAW_LAG), as
// the umpire's closing() projects a boat
function carryOn(o, t) {
  if (!(t > 0)) return o;
  const n = Math.max(1, Math.ceil(t / 0.05)), d = t / n, head = (u) => o.h + o.yawRate * YAW_LAG * (1 - Math.exp(-u / YAW_LAG));
  let x = o.x, z = o.z;
  for (let i = 1; i <= n; i++) { const h = head((i - 0.5) * d); x += Math.sin(h) * o.v * d; z -= Math.cos(h) * o.v * d; }
  return { ...o, x, z, h: wrap(head(t)) };
}

// The guest's game: it follows the host's race. Her own boat is stepped here from her own hands (the helm answers at
// once), and set against the host's copy of her: each snapshot is compared with where she herself was when her
// controls were where the host's copy's were, and that difference is eased away. The times are on her own clock (_own:
// her sailing time, on with every frame she is stepped, from the wall clock when the page opened, so a reloaded page's
// run on from the last's): her stamp on the latest controls the host had, plus the host's time since they came. Her
// race's clock follows the host's, read from the quickest snapshot of the last 2 s (a late one never sets it back);
// ahead of it, the clock waits and she sails on. The host's boat is drawn where it is now (that clock and the way here,
// half of there and back, measured on her stamps' acks), carried on from its last snapshot; the calls, the penalties, the signals and the rest of the news are the host's. It never runs the rules, and
// never gives a race up on its own: a host silent 3 s is waited for ("Waiting for <host>"), and only the host's
// `abandon` abandons it.
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
    this.results = null; // the host's results of the race, once they have come
    this.error = null;
    this._ends = [];
    this._onResultsFns = [];
    this._last = null; // { at, s }: the latest snapshot, as it arrived
    this._offs = []; // { at, off }: the snapshots of the last 2 s, their arrival (s) less their clock
    this._lastSnap = now();
    this._lastFrame = null;
    this._first = true; // nothing taken from the host yet: her page has just opened
    this._snapMe = false; // take the host's copy of her as it is at the next snapshot
    this._own0 = now() / 1000; this._own = this._own0; // her own clock (s)
    this._hist = []; // { c (her own clock), x, z, h, v }: her own boat, as her screen sailed her
    this._err = null; // the difference from the host's copy still to ease away
    this._sentAt = -Infinity;
    this._sentKey = null;
    this._sentC = null;
    this._key = null;
    this._changedC = this._own;
    this._stamp = false; // stamp her controls afresh as they next go: her own clock and the host's lost each other
    this._sends = new Map(); // stamp -> when (ms) it first went
    this._rtts = []; // s: the way to the host and back, as measured
    this._ackG = null;
    this._trackC = -Infinity;
    const all = link.all;
    all.on('snap', (s) => { if (!this.stopped) this._onSnap(s); });
    all.on('ev', (e) => { if (!this.stopped) this._onEv(e); });
    all.on('end', (e) => { if (!this.stopped) this._onEnd(e); });
    all.on('results', (m) => { if (!this.stopped) this._onResults(m); });
    all.on('abandon', () => { if (!this.stopped && !this.ended) this.abandoned = true; });
    this.joined = joinOf(this, link.input);
  }

  onEnd(fn) { this._ends.push(fn); }
  onResults(fn) { this._onResultsFns.push(fn); }
  _boat(id) { return id ? this.race.humans.find((b) => b.id === id) ?? null : null; }
  // the host's clock now, as the quickest snapshot of the last 2 s has it (null before the first)
  _hostClock(t) { return this._offs.length ? t / 1000 - Math.min(...this._offs.map((o) => o.off)) : null; }

  _onSnap(s) {
    const race = this.race, me = this.me, owed = me.owed, pen = !!me.pen;
    if (s?.r !== undefined && s.r !== race.recalls) this._recalled(s);
    if (!applySnap(race, s, me)) return;
    // the host saw her turn done (a turn gone with a disqualification, at the finish, wasn't paid)
    if (pen && !me.pen && !me.dsq && (race.multi || me.owed < owed)) me.events.push('penaltyDone');
    const at = this.now();
    this._lastSnap = at;
    this._last = { at, s };
    const O = this._offs, off = at / 1000 - s.c;
    if (O.length && off - O[O.length - 1].off > HITCH_S) O.length = 0; // the host's game fell behind: its clock as it is now
    O.push({ at, off });
    while (O.length > 1 && O[0].at < at - CLOCK_S * 1000) O.shift();
    const o = readBoat(s.b[race.boats.indexOf(me)]);
    me.tackN = Math.max(me.tackN || 0, o.tackSeen || 0); // a reloaded page's presses count on from the host's
    me.hailN = Math.max(me.hailN || 0, o.hailSeen || 0);
    if (s.c - this._trackC >= 1) { // the other boats' tracks, at 1 Hz (her own is stepView's)
      this._trackC = s.c;
      race.boats.forEach((b, k) => { if (b !== me && !b.done) { const p = readBoat(s.b[k]); b.track.push([p.x, p.z]); } });
    }
    this._drawOthers(at);
    if (race.clock < s.c - 1) this._catchUp(s.c); // a page just opened, or one that slept: the wind and waves too
    // the time on her own clock the host's copy at s.c stands for: her stamp on its controls, plus the host's time
    // since they came (a stamp from before this page opened is a reloaded page's last: nothing here to set it against)
    const a = Array.isArray(s.a) && Number.isFinite(s.a[0]) && Number.isFinite(s.a[1]) && s.a[0] >= this._own0 - 1e-6 ? s.a : null;
    const ownAt = a ? a[0] + (s.c - a[1]) : null, carry = Math.min(HOLD_MS / 1000, Math.max(0, race.clock - s.c));
    if (a && a[0] !== this._ackG && this._sends.has(a[0])) { // a stamp's first ack: there and back is the time since it went, less the host's
      this._ackG = a[0];
      const r = (at - this._sends.get(a[0])) / 1000 - (s.c - a[1]);
      if (r >= 0 && r < 5) { this._rtts.push(r); if (this._rtts.length > RTT_N) this._rtts.shift(); }
    }
    if (this._first) { this._first = false; this._stamp = true; setSails(me, o); this._take(o, carry); return; } // everything, once
    // set against where she was then; with no such pose kept (her page slept, or the host hasn't her newest stamp
    // yet), against the host's copy itself, carried on to her clock
    const p = ownAt === null ? null : this._histAt(ownAt), ahead = p ? Math.min(HOLD_MS / 1000, Math.max(0, this._own - ownAt)) : carry;
    if (this._snapMe) { this._snapMe = false; this._take(o, ahead); return; }
    const E = p ? { x: o.x - p.x, z: o.z - p.z, h: wrap(o.h - p.h), v: o.v - p.v }
      : { x: o.x + Math.sin(o.h) * o.v * carry - me.x, z: o.z - Math.cos(o.h) * o.v * carry - me.z, h: wrap(o.h - me.h), v: o.v - me.v };
    if (Math.hypot(E.x, E.z) > SNAP_M) this._take(o, ahead);
    else this._err = E;
  }
  // a general recall (the count is the host's word, so a reloaded page reads it too): the wind and waves caught up to the
  // race's time (a reloaded page's are behind it), then the race's clock is the host's as it is, backwards too; the
  // tracks start again, and everything timed on the old clock is forgotten
  _recalled(s) {
    const race = this.race;
    for (let d = s.t - race.t; d > 1e-9; d -= 0.25) race.advance(Math.min(0.25, d));
    race.recalls = s.r; race.clock = s.c; race.trackT = 0; // (the clock after: advance moves it)
    for (const b of race.boats) { b.track = []; b.legT = []; }
    this._offs = []; this._hist = []; this._err = null;
    this._trackC = -Infinity; this._stamp = true;
  }
  // the host's copy of her taken as it is, carried on `ahead` s; her past poses moved with her (as the easing moves
  // them), so the next snapshot is set against where she would have been
  _take(o, ahead) {
    const me = this.me, was = { x: me.x, z: me.z, h: me.h, v: me.v };
    for (const k of ['x', 'z', 'h', 'v', 'heel', 'yawRate']) me[k] = o[k];
    me.x += Math.sin(o.h) * o.v * ahead; me.z -= Math.cos(o.h) * o.v * ahead;
    const dx = me.x - was.x, dz = me.z - was.z, dh = wrap(me.h - was.h), dv = me.v - was.v;
    for (const q of this._hist) { q.x += dx; q.z += dz; q.h = wrap(q.h + dh); q.v += dv; }
    this._err = null;
  }
  // the other boat where she is now: carried on from the last snapshot to the host's clock now, which is ahead of the
  // snapshots' by the way here (half there and back). Each frame, and as a snapshot comes (it put her where she was)
  _drawOthers(t) {
    const L = this._last, race = this.race, me = this.me, est = this._hostClock(t);
    const way = this._rtts.length ? Math.min(0.5, Math.min(...this._rtts) / 2) : 0, on = Math.min(CARRY_S, Math.max(0, est + way - L.s.c));
    race.boats.forEach((b, i) => { if (b !== me) setBoat(b, carryOn(readBoat(L.s.b[i]), on)); });
  }
  // her own pose at her own clock c, between the two around it (null outside what's kept)
  _histAt(c) {
    const H = this._hist;
    if (!H.length || c < H[0].c - 1e-6 || c > H[H.length - 1].c + 0.05) return null;
    let i = 1;
    while (i < H.length && H[i].c < c) i++;
    if (i >= H.length) return H[H.length - 1];
    const a = H[i - 1], b = H[i], f = b.c > a.c ? Math.min(1, Math.max(0, (c - a.c) / (b.c - a.c))) : 1;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, h: wrap(a.h + wrap(b.h - a.h) * f), v: a.v + (b.v - a.v) * f };
  }
  // the race's clock forward to c, the wind and the waves with it (a jump: her controls stamped afresh, to be safe)
  _catchUp(c) {
    if (c - this.race.clock > 0.5) this._stamp = true;
    for (let d = c - this.race.clock; d > 1e-9; d -= 0.25) this.race.advance(Math.min(0.25, d));
  }

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
    this.abandoned = false; // the race was sailed to its end: that stands
    race.over = true;
    race.winner = this._boat(e?.winner) ?? race.winner;
    race.margin = e?.margin ?? null;
    race.forfeited = this._boat(e?.forfeited);
    for (const fn of this._ends) fn({ winner: e?.winner ?? null, margin: e?.margin ?? null, forfeited: e?.forfeited ?? null });
  }

  // the host's results of this race: the first copy kept, and every copy answered (her last answer may have been lost)
  _onResults(m) {
    if (!m || m.seed !== this.race.seed) return;
    this.link.input.send('resultsOk', { id: this.me.id, seed: m.seed });
    if (this.results) return;
    this.results = m;
    for (const fn of this._onResultsFns) fn(m);
  }

  // her controls (controlsOf her boat), each frame: sent as they change (see INPUT_MIN_MS); nothing until her boat has
  // been taken from the host's first snapshot (a reloaded page's own sails aren't hers). Each carries her own clock when
  // they last changed (or, stamped afresh, when it goes)
  input(c) {
    if (this.stopped) return;
    const t = this.now(), key = JSON.stringify(c.at ? { ...c, s: 0, j: c.sp ? c.j : 0 } : c); // auto-trim's sheet is the host's to work
    if (key !== this._key) { this._key = key; this._changedC = this._own; }
    if (this._first) return;
    const since = t - this._sentAt, l = this._sentC;
    const now = !l || (c.tk || 0) !== (l.tk || 0) || (c.hl || 0) !== (l.hl || 0) || Math.abs((c.r || 0) - (l.r || 0)) > HELM_NOW;
    const changed = key !== this._sentKey || this._stamp;
    if ((changed && since >= (now ? INPUT_NOW_MS : INPUT_MIN_MS)) || since >= INPUT_MAX_MS) {
      if (this._stamp) { this._stamp = false; this._changedC = this._own; }
      this._sentAt = t; this._sentKey = key; this._sentC = c;
      const g = Math.round(this._changedC * 1000) / 1000;
      if (!this._sends.has(g)) { this._sends.set(g, t); if (this._sends.size > 20) this._sends.delete(this._sends.keys().next().value); }
      this.link.input.send('input', { id: this.me.id, c, g });
    }
  }

  frame(dt) {
    if (this.stopped) return;
    const race = this.race, me = this.me, t = this.now();
    if (this._lastFrame !== null && t - this._lastFrame > HOLD_MS) { this._lastSnap += t - this._lastFrame; this._stamp = true; } // her own page slept: not the host's silence
    this._lastFrame = t;
    if (this.ended) return;
    this.hostSilent = t - this._lastSnap >= HOLD_MS;
    if (this.hostSilent || this.abandoned) return; // frozen until the host's game is back, or says the race is abandoned
    const L = this._last, est = this._hostClock(t);
    // her boat; her penalties are the host's to judge, and her screen's news (a turn begun) the host's to tell
    const n0 = race.messages.length, ne = me.events.length, owed = me.owed, pen = me.pen && { ...me.pen }; // (a copy: her step works on the turn it finds)
    if (est !== null && race.clock - est > dt / 2) me.step(dt, race); // ahead of the host: the clock waits, she sails on
    else race.stepView(dt, me);
    this._own += dt;
    race.messages.length = n0;
    me.owed = owed; me.pen = pen;
    if (me.events.length > ne) me.events.splice(ne, me.events.length - ne, ...me.events.slice(ne).filter((e) => e !== 'penaltyDone'));
    if (est !== null && est - race.clock > dt / 2) this._catchUp(est); // behind: forward, the wind and waves with it
    if (!L) return;
    this._drawOthers(t);
    // her own boat: the difference from the host's copy eased away, her past poses moved with her
    const E = this._err, H = this._hist;
    if (E) {
      const e = 1 - Math.exp(-dt / EASE_S), d = { x: E.x * e, z: E.z * e, h: E.h * e, v: E.v * e };
      me.x += d.x; me.z += d.z; me.h = wrap(me.h + d.h); me.v += d.v;
      for (const p of H) { p.x += d.x; p.z += d.z; p.h = wrap(p.h + d.h); p.v += d.v; }
      E.x -= d.x; E.z -= d.z; E.h -= d.h; E.v -= d.v;
    }
    H.push({ c: this._own, x: me.x, z: me.z, h: me.h, v: me.v });
    while (H.length && H[0].c < this._own - HIST_S) H.shift();
  }

  // stop following (the race is done with, or the page is leaving)
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.link.input.leave();
  }
}
