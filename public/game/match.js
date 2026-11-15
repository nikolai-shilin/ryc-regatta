// A match race's protocol, with no DOM: the waiting room (Room), the match's score and state (Match), and the two
// channels a match talks on (makeLink). Race sync (Host / Guest) is added below it. Every clock is the injected now().
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
    this._left = false;
    const all = link.all;
    all.on('hello', (h) => {
      if (!h || h.id === me.id) return;
      const known = this._peers.has(h.id);
      this._peers.set(h.id, { hello: h, seen: this.now() });
      if (!known) this._sendHello(); // answer a newcomer at once rather than on the next beat
    });
    all.on('bye', (b) => { if (b) this._peers.delete(b.id); });
    all.on('start', (m) => { if (m && (m.host?.id === me.id || m.guest?.id === me.id)) this._emitStart(m); });
    this.joined = all.join().then(() => { if (!this._left) this._sendHello(); }, () => {});
    this._timer = every ? setInterval(() => this.tick(), every) : null;
    this._timer?.unref?.();
  }

  _sendHello() { this._lastHello = this.now(); this.link.all.send('hello', this._hello); }
  _emitStart(m) { for (const fn of this._starts) fn(m); }
  _heard() { const t = this.now(); return [...this._peers.values()].filter((p) => t - p.seen < GONE_MS).map((p) => p.hello); }

  // Beat: hello every 3 s.
  tick() { if (!this._left && this.now() - this._lastHello >= HELLO_MS) this._sendHello(); }

  get host() {
    if (this.isHost) return this._hello;
    return this._heard().filter((h) => h.host).sort(byJoin)[0] || null;
  }
  // The first non-host by joinedAt, then id; this client counts as one when it isn't the host.
  get guest() {
    const c = this._heard().filter((h) => !h.host);
    if (!this.isHost) c.push(this._hello);
    return c.sort(byJoin)[0] || null;
  }
  get full() { const g = this.guest; return !this.isHost && !!g && g.id !== this.me.id; }
  get settings() { return this.host?.settings ?? null; }

  canStart() { return this.isHost && !!this.guest; }
  start() {
    const guest = this.guest;
    if (!this.isHost || !guest) throw new Error('only the host, with a guest present, can start');
    const pick = (h) => ({ id: h.id, name: h.name, look: h.look });
    const msg = { settings: this.settings, seed: Math.floor(Math.random() * 100000), race: 1, blue: this._hello.id, host: pick(this._hello), guest: pick(guest) };
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
