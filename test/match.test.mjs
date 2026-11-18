// The match's waiting room (Room) and score (Match), and the race between two screens (Host and Guest), over the
// in-memory hub and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryRealtime } from './hub.mjs';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const { makeLink, Room, Match, HOST_KEY, raceFor, Host, Guest, Keeper } = await import('../public/game/match.js');
const { controlsOf, readBoat, encodeSnap } = await import('../public/game/wire.js');
const { D2R, wrap, lineD, sheetFor, idealSail } = await import('../public/game/sim.js');

const SETTINGS = { venue: 'palma', wind: 12, yacht: 'ac75', length: 'short' };
const person = (id, name) => ({ id, name, look: { hull: id } });

function setup() {
  const hub = memoryRealtime();
  const clock = { t: 1000 };
  const now = () => clock.t;
  const room = async (me, host, settings = null) => {
    const r = new Room({ link: makeLink(hub, 'ABC234'), me, host, settings: host ? settings : null, now, every: 0 });
    await r.joined;
    return r;
  };
  return { hub, clock, now, room };
}

const start = (host = person('h', 'Host'), guest = person('g', 'Guest')) => ({ settings: SETTINGS, seed: 4242, race: 1, blue: host.id, host, guest });

test('makeLink names the two channels after the code', () => {
  const topics = [];
  const rt = { channel: (topic) => { topics.push(topic); return {}; } };
  makeLink(rt, 'ABC234');
  assert.deepEqual(topics, ['match:ABC234', 'match:ABC234:in']);
  assert.match(HOST_KEY, /^regatta-match-host$/);
});

test('the host sees the guest arrive and only then may start', async () => {
  const { room, clock } = setup();
  const host = await room(person('h', 'Host'), true, SETTINGS);
  assert.equal(host.canStart(), false);
  assert.equal(host.guest, null);
  clock.t += 100;
  const guest = await room(person('g', 'Guest'), false);
  assert.equal(host.guest.id, 'g');
  assert.equal(host.canStart(), true);
  assert.equal(guest.canStart(), false);
  assert.equal(guest.host.id, 'h');
  assert.deepEqual(guest.settings, SETTINGS);
  const heard = [];
  guest.onStart((m) => heard.push(m));
  const msg = host.start();
  assert.deepEqual(heard, [msg]);
  assert.equal(msg.race, 1);
  assert.equal(msg.blue, 'h');
  assert.equal(msg.host.id, 'h');
  assert.equal(msg.guest.id, 'g');
  assert.deepEqual(msg.settings, SETTINGS);
  assert.ok(Number.isInteger(msg.seed) && msg.seed >= 0 && msg.seed < 100000);
});

test('a guest who leaves is gone from the host at once, and a silent one after 10 s', async () => {
  const { room, clock } = setup();
  const host = await room(person('h', 'Host'), true, SETTINGS);
  const g1 = await room(person('g', 'Guest'), false);
  assert.equal(host.guest.id, 'g');
  g1.leave();
  assert.equal(host.guest, null);
  assert.equal(host.canStart(), false);
  const g2 = await room(person('g2', 'Two'), false);
  assert.equal(host.guest.id, 'g2');
  clock.t += 9999;
  assert.equal(host.guest.id, 'g2');
  clock.t += 2;
  assert.equal(host.guest, null);
  g2.tick(); // a hello every 3 s brings them back
  assert.equal(host.guest.id, 'g2');
});

test('a third person is told the match is full', async () => {
  const { room, clock } = setup();
  const host = await room(person('h', 'Host'), true, SETTINGS);
  clock.t += 10;
  const guest = await room(person('g', 'Guest'), false);
  clock.t += 10;
  const third = await room(person('x', 'Third'), false);
  assert.equal(third.full, true);
  assert.equal(host.full, false);
  assert.equal(guest.full, false);
  assert.equal(host.guest.id, 'g');
  assert.equal(guest.guest.id, 'g');
});

test('first to two wins the match', () => {
  const m = new Match({ start: start() });
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 1);
  m.endRace({ winner: 'h', margin: 12.5, abandoned: false });
  assert.equal(m.state, 'between');
  m.ready('h'); m.ready('g');
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 2);
  m.endRace({ winner: 'g', margin: 3, abandoned: false });
  assert.equal(m.state, 'between');
  m.ready('h'); m.ready('g');
  m.endRace({ winner: 'h', margin: 7, abandoned: false });
  assert.equal(m.state, 'over');
  assert.deepEqual(m.score, { h: 2, g: 1 });
  assert.equal(m.races.length, 3);
  assert.deepEqual(m.races[2], { winner: 'h', margin: 7, abandoned: false });
});

test('colours swap each race', () => {
  const m = new Match({ start: start() });
  assert.equal(m.blueOf(1), 'h');
  assert.equal(m.blueOf(2), 'g');
  assert.equal(m.blueOf(3), 'h');
  assert.equal(m.seedOf(1), (4242 + 7919) % 100000);
  assert.equal(m.seedOf(2), (4242 + 2 * 7919) % 100000);
});

test('between races the match waits for a missing player', () => {
  const t = { v: 0 };
  const m = new Match({ start: start(), now: () => t.v });
  m.endRace({ winner: 'h', margin: 5, abandoned: false });
  m.present('g', false);
  m.ready('h'); m.ready('g');
  t.v += 120000; m.tick();
  assert.equal(m.state, 'between');
  t.v += 179000; m.tick(); // 299 s gone
  assert.equal(m.state, 'between');
  t.v += 1000; m.tick();
  assert.equal(m.state, 'over');
  assert.deepEqual(m.score, { h: 1, g: 0 });
});

test('both ready starts the next race at once; one ready waits 60 s with both present', () => {
  const t = { v: 0 };
  const m = new Match({ start: start(), now: () => t.v });
  m.endRace({ winner: 'g', margin: 5, abandoned: false });
  m.ready('h');
  assert.equal(m.state, 'between');
  t.v += 59000; m.tick();
  assert.equal(m.state, 'between');
  t.v += 1000; m.tick();
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 2);
  // and with nobody pressing, the 60 s alone does it; ready is cleared for the next card
  m.endRace({ winner: 'h', margin: 1, abandoned: false });
  assert.equal(m.state, 'between');
  t.v += 60000; m.tick();
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 3);
  // never with one absent: the 60 s waits, and counts from their return
  m.endRace({ winner: null, margin: null, abandoned: true });
  m.present('h', false);
  t.v += 100000; m.tick();
  assert.equal(m.state, 'between');
  m.present('h', true);
  t.v += 59000; m.tick();
  assert.equal(m.state, 'between');
  t.v += 1000; m.tick();
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 4);
});

test('an abandoned race scores nothing, and leave ends the match at the score', () => {
  const m = new Match({ start: start() });
  m.endRace({ winner: 'h', margin: 4, abandoned: false });
  m.ready('h'); m.ready('g');
  m.endRace({ winner: null, margin: null, abandoned: true });
  assert.equal(m.state, 'between');
  assert.deepEqual(m.score, { h: 1, g: 0 });
  m.leave('g');
  assert.equal(m.state, 'over');
  assert.deepEqual(m.score, { h: 1, g: 0 });
});

test('a reloaded host keeps the score and loses the race in progress', () => {
  const t = { v: 5000 };
  const m = new Match({ start: start(), now: () => t.v });
  m.endRace({ winner: 'h', margin: 9, abandoned: false });
  m.ready('h'); m.ready('g');
  assert.equal(m.state, 'race');
  const saved = JSON.parse(JSON.stringify(m.toJSON()));
  const back = Match.from(saved, () => t.v);
  assert.equal(back.state, 'between');
  assert.deepEqual(back.score, { h: 1, g: 0 });
  assert.equal(back.races.length, 2);
  assert.deepEqual(back.races[1], { winner: null, margin: null, abandoned: true });
  assert.equal(back.blueOf(back.raceN + 1), 'h');
  back.ready('h'); back.ready('g');
  assert.equal(back.state, 'race');
  assert.equal(back.raceN, 3);
  // a finished match comes back finished
  back.endRace({ winner: 'h', margin: 2, abandoned: false });
  assert.equal(Match.from(back.toJSON()).state, 'over');
});

test('the host picks the guest: a third person with an earlier clock still sees the match full', async () => {
  const hub = memoryRealtime();
  const mk = (me, host, t, settings) => {
    const r = new Room({ link: makeLink(hub, 'SKEW22'), me, host, settings, now: () => t, every: 0 });
    return r.joined.then(() => r);
  };
  const host = await mk(person('h', 'Host'), true, 1000, SETTINGS);
  const guest = await mk(person('g', 'Guest'), false, 5000, null);
  const third = await mk(person('x', 'Third'), false, 100, null); // joined last, but its clock says earliest
  assert.equal(host.guest.id, 'g');
  assert.equal(third.full, true);
  assert.equal(guest.full, false);
  assert.equal(guest.guest.id, 'g');
  assert.equal(third.guest.id, 'g');
});

test('a guest whose channel missed start gets onStart from the host\'s next hello, once', async () => {
  const { hub, clock, now } = setup();
  const host = new Room({ link: makeLink(hub, 'MISS22'), me: person('h', 'Host'), host: true, settings: SETTINGS, now, every: 0 });
  await host.joined;
  const link = makeLink(hub, 'MISS22');
  const deaf = { ...link, all: { ...link.all, on: (e, f) => { if (e !== 'start') link.all.on(e, f); } } };
  const guest = new Room({ link: deaf, me: person('g', 'Guest'), host: false, settings: null, now, every: 0 });
  await guest.joined;
  const heard = [];
  guest.onStart((m) => heard.push(m));
  const msg = host.start();
  assert.equal(heard.length, 0);
  clock.t += 3000;
  host.tick();
  assert.deepEqual(heard, [msg]);
  clock.t += 3000;
  host.tick();
  assert.equal(heard.length, 1);
});

test('a join that fails is reported: joined is false and error says why', async () => {
  const boom = new Error('no socket');
  const ch = { join: () => Promise.reject(boom), send() {}, on() {}, leave() {} };
  const room = new Room({ link: { all: ch, input: ch }, me: person('h', 'Host'), host: true, settings: SETTINGS, every: 0 });
  assert.equal(await room.joined, false);
  assert.equal(room.error, boom);
  const ok = await setup().room(person('g', 'G'), false);
  assert.equal(await ok.joined, true);
  assert.equal(ok.error, null);
});

// ---------- the race between two screens: the host's game runs it, the guest's follows ----------
const RACE_SETTINGS = { venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short' };
const FRAME = 1 / 60;

// a hub that counts every broadcast sent and every one delivered
function counting(hub) {
  const n = { sent: 0, delivered: 0 };
  const rt = {
    channel(topic, o) {
      const ch = hub.channel(topic, o), send = ch.send, deliver = ch._deliver;
      ch.send = (e, p) => { n.sent++; send(e, p); };
      ch._deliver = (e, p) => { n.delivered++; deliver(e, p); };
      return ch;
    },
    pump: () => hub.pump(),
    close: () => hub.close(),
  };
  return { rt, n };
}

// both boats sailing, on a reach away from their ends at 2 m/s, the same on each screen (a match starts them luffing,
// nearly stopped: these tests are of the helm and the sails between the screens, which want a boat with way on)
function underWay(r) {
  const c = r.course;
  for (const b of r.humans) {
    const out = b.side === 'blue' ? 1 : -1;
    Object.assign(b, { h: Math.atan2(c.dir.x * out, -c.dir.z * out), v: 2, sheet: sheetFor(idealSail(60)), jibSheet: sheetFor(idealSail(60)) });
  }
}
// a match's first race on two screens: the host's (h) and the guest's (g), each with her own link, over one hub
// (latency: ms each way); rooms: each screen's waiting room too, paused for the race as the game pauses it
async function duel({ rt = null, hub = null, latency = 0, jitter = 0, rooms = false, alive } = {}) {
  const clock = { t: 50000 }, now = () => clock.t, code = 'DUEL22';
  rt ??= hub ? hub(now) : memoryRealtime({ latency, jitter, now });
  const match = new Match({ start: { settings: RACE_SETTINGS, seed: 4242, race: 1, blue: 'h', host: person('h', 'Host'), guest: person('g', 'Guest') }, now });
  const hl = makeLink(rt, code), gl = makeLink(rt, code);
  let hroom = null, groom = null;
  if (rooms) {
    hroom = new Room({ link: hl, me: person('h', 'Host'), host: true, settings: RACE_SETTINGS, now, every: 0 });
    groom = new Room({ link: gl, me: person('g', 'Guest'), host: false, now, every: 0 });
    await hroom.joined; await groom.joined;
    hroom.pause(true); groom.pause(true);
  } else { await hl.all.join(); await gl.all.join(); } // (the waiting room's: the Room joins it)
  const hrace = raceFor(match, 'h'), grace = raceFor(match, 'g');
  for (const r of [hrace, grace]) underWay(r);
  const host = new Host({ race: hrace, link: hl, guestId: 'g', now, alive });
  const guest = new Guest({ race: grace, link: gl, me: 'g', now });
  assert.equal(await host.joined, true); assert.equal(await guest.joined, true);
  const d = {
    rt, clock, now, match, code, hrace, grace, host, guest, hroom, groom,
    H: hrace.player, Gh: hrace.humans.find((b) => b.id === 'g'), // the host's boat and the guest's, on the host's screen
    me: guest.me, Hg: grace.humans.find((b) => b.id === 'h'), // the guest's boat and the host's, on the guest's screen
    heard: [], // what the guest's game is told (as main.js reads race.messages and then clears them)
    hostHeard: [],
    // one frame on both screens: fn (the sailors' hands), the host's step, the guest's controls and her frame
    frame(fn) {
      clock.t += 1000 * FRAME;
      rt.pump?.();
      fn?.();
      hroom?.tick(); groom?.tick();
      d.host.tick(FRAME);
      d.hostHeard.push(...hrace.messages.filter((m) => !m.to || m.to === d.H)); hrace.messages.length = 0;
      d.guest.input(controlsOf(d.me));
      d.guest.frame(FRAME);
      d.heard.push(...d.grace.messages); d.grace.messages.length = 0;
    },
    run(secs, fn) { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) d.frame(fn); },
  };
  return d;
}
const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

test('the guest steers and the host\'s copy turns; each sees the other within 1 m after 1 s', async (t) => {
  const d = await duel();
  d.run(1);
  const h0 = d.Gh.h;
  let worstHost = 0, worstGuest = 0, n = 0;
  d.run(3, () => {
    d.me.rudder = 0.5; // the guest's helm, on her screen
    if (n++ >= 60) { worstGuest = Math.max(worstGuest, near(d.Hg, d.H)); worstHost = Math.max(worstHost, near(d.Gh, d.me)); }
  });
  assert.equal(d.Gh.rudder, 0.5, 'the host\'s copy has her helm');
  assert.ok(Math.abs(wrap(d.Gh.h - h0)) > 20 * D2R, `the host's copy turned ${(wrap(d.Gh.h - h0) / D2R).toFixed(1)}°`);
  assert.ok(worstGuest < 1, `the guest sees the host's boat within ${worstGuest.toFixed(2)} m`);
  assert.ok(worstHost < 1, `the host sees the guest's boat within ${worstHost.toFixed(2)} m`);
  assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.25, 'the clocks agree');
  assert.equal(d.grace.calls.length, 0);

  // 150 ms each way: she turns, and centres her helm. What the host's copy of her says moves her own boat only by
  // what really differs, not by the delay: her bow isn't pulled on after the turn, and she is on the host's copy's
  // course and line within a second
  const e = await duel({ latency: 150 });
  e.run(2);
  let pull = 0, after = null;
  const step = e.me.step;
  e.me.step = function (dt, r) { step.call(this, dt, r); after = this.h; }; // her heading as her own helm left it
  const pulled = () => { if (after !== null) pull += Math.abs(wrap(e.me.h - after)); };
  e.run(2, () => { e.me.rudder = 0.5; });
  e.run(1, () => { pulled(); e.me.rudder = 0; });
  pulled();
  t.diagnostic(`at 150 ms: pulled ${(pull / D2R).toFixed(3)}°, heading off ${(wrap(e.me.h - e.Gh.h) / D2R).toFixed(3)}°, line off ${((e.me.x - e.Gh.x) * Math.cos(e.Gh.h) + (e.me.z - e.Gh.z) * Math.sin(e.Gh.h)).toFixed(3)} m`);
  assert.ok(pull < 1 * D2R, `her bow moved ${(pull / D2R).toFixed(2)}° by the host's copy in the second after she centred`);
  const fw = { x: Math.sin(e.Gh.h), z: -Math.cos(e.Gh.h) }, dx = e.me.x - e.Gh.x, dz = e.me.z - e.Gh.z;
  assert.ok(Math.abs(wrap(e.me.h - e.Gh.h)) < 1 * D2R, `on the host's copy's heading (${(wrap(e.me.h - e.Gh.h) / D2R).toFixed(2)}°)`);
  assert.ok(Math.abs(dx * fw.z - dz * fw.x) < 0.5, `and on its line (${(dx * fw.z - dz * fw.x).toFixed(2)} m off it)`);
});

// a port–starboard crossing halfway up the first beat, after the gun: the host (blue) on port, the guest on
// starboard, each `secs` from the crossing at V, their helms centred
function crossing(d, secs = 5, V = 3.4) {
  const r = d.hrace, c = r.course;
  r.clock = 30;
  const X = { x: (c.pin.x + c.committee.x) / 4 + c.windward.x / 2, z: (c.pin.z + c.committee.z) / 4 + c.windward.z / 2 };
  const W = r.wind.at(X.x, X.z).dir;
  const put = (b, h) => {
    Object.assign(b, { x: X.x - Math.sin(h) * V * secs, z: X.z + Math.cos(h) * V * secs, h, v: V, leg: 1, entered: true, owed: 0, auto: null, rudder: 0, yawRate: 0, hist: null, boom: 0 });
    Object.assign(b, { lastD: lineD(c, b), lastZ: b.z });
  };
  put(d.H, W + 45 * D2R); put(d.Gh, W - 45 * D2R);
}

test('a call is made once, on the host, and each hears her own', async () => {
  const d = await duel();
  d.run(1);
  crossing(d);
  d.run(12, () => { d.H.rudder = 0; d.me.rudder = 0; });
  assert.equal(d.hrace.calls.length, 1, JSON.stringify(d.hrace.calls.map((k) => [k.on, k.rule])));
  const k = d.hrace.calls[0], arg = { rule: k.rule, on: k.on };
  assert.equal(d.grace.calls.length, 0, 'the guest\'s game makes no calls of its own');
  const ump = (list) => list.filter((m) => m.key === 'umpire');
  assert.deepEqual(ump(d.heard).map((m) => [m.arg, m.to === d.me]), [[arg, true]], 'the guest hears it once, as hers');
  assert.deepEqual(ump(d.hostHeard).map((m) => [m.arg, m.to === d.H]), [[arg, true]], 'and the host once');
  const owes = k.on === 'g' ? d.me : d.Hg;
  assert.equal(owes.owed, 1, 'the guest\'s screen shows the penalty owed');
  assert.ok(d.heard.every((m) => !m.to || m.to === d.me), 'the guest is told only her own news');
});

test('a silent guest holds course, then the race goes to the host', async () => {
  const d = await duel();
  d.run(1, () => { d.me.rudder = 0.6; });
  d.clock.t += 100; d.me.rudder = 0.65; d.guest.input(controlsOf(d.me)); // her last input
  let end = null;
  d.guest.onEnd((e) => { end = e; });
  // her tab is gone: no input, no frame; the host's game goes on
  const quiet = (secs) => { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) { d.clock.t += 1000 * FRAME; d.host.tick(FRAME); } };
  quiet(2.9);
  assert.equal(d.Gh.rudder, 0.65, 'under 3 s: her last helm');
  quiet(0.6);
  assert.equal(d.Gh.rudder, 0, 'after 3 s: she holds her course');
  assert.equal(d.Gh.auto, null);
  quiet(26.3);
  assert.equal(d.hrace.over, false, 'under 30 s: still racing');
  assert.equal(end, null);
  quiet(0.5);
  assert.equal(d.hrace.over, true);
  assert.equal(d.hrace.winner, d.H);
  assert.equal(d.hrace.forfeited, d.Gh);
  assert.deepEqual(end, { winner: 'h', margin: null, forfeited: 'g' });
  assert.equal(d.grace.winner, d.Hg);
  assert.equal(d.grace.over, true);
  // told again each second while the host's game runs on (for a guest who missed it), heard once
  let ends = 0;
  const ear = makeLink(d.rt, d.code).all;
  await ear.join(); ear.on('end', () => ends++);
  quiet(2.1);
  assert.equal(ends, 2);
  d.guest.frame(FRAME);
  assert.equal(d.guest.abandoned, false);
});

test('a host asleep for over a minute abandons the race', async () => {
  const d = await duel();
  d.run(2);
  // the host's tab sleeps: its game stops; the guest's goes on
  const alone = (secs) => { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) { d.clock.t += 1000 * FRAME; d.guest.input(controlsOf(d.me)); d.guest.frame(FRAME); } };
  alone(2.8);
  assert.equal(d.guest.hostSilent, false);
  const ahead = d.me.x;
  assert.notEqual(ahead, d.Gh.x, 'still sailing on her own screen');
  alone(0.4);
  assert.equal(d.guest.hostSilent, true, 'after 3 s: waiting for the host');
  const at = { x: d.me.x, z: d.me.z, clock: d.grace.clock };
  alone(5);
  assert.deepEqual({ x: d.me.x, z: d.me.z, clock: d.grace.clock }, at, 'her screen is frozen');
  assert.equal(d.guest.abandoned, false);
  // the host's tab wakes over a minute after its last step: the race is abandoned
  d.clock.t += 61000;
  const was = d.hrace.clock;
  d.host.tick(FRAME);
  assert.equal(d.host.abandoned, true);
  assert.equal(d.guest.abandoned, true, 'the guest is told');
  assert.equal(d.hrace.clock, was, 'and the host\'s race went no further');
  d.host.tick(FRAME);
  assert.equal(d.hrace.clock, was);

  // a host that never comes back: the guest's game never gives the race up on its own; it waits for the host's word
  // (the match's five minutes end it)
  const e = await duel();
  e.run(2);
  const alone2 = (secs) => { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) { e.clock.t += 1000 * FRAME; e.guest.frame(FRAME); } };
  alone2(120);
  assert.equal(e.guest.hostSilent, true);
  assert.equal(e.guest.abandoned, false);
});

test('a guest who reloads steers her boat again', async () => {
  const d = await duel();
  d.run(1);
  d.me.tackOrGybe(); d.me.tackN = 1; // she presses tack
  d.run(0.3);
  assert.ok(d.Gh.auto, 'the host\'s copy tacks');
  d.run(8);
  assert.equal(d.Gh.auto, null);
  // she reloads: the old page is gone; a new one builds the race again and follows it, with her id
  d.guest.stop();
  await new Promise((r) => setTimeout(r, 0));
  d.clock.t += 2000;
  for (let i = 0; i < 120; i++) { d.clock.t += 1000 * FRAME; d.host.tick(FRAME); }
  const link = makeLink(d.rt, d.code);
  await link.all.join();
  const grace = raceFor(d.match, 'g');
  const guest = new Guest({ race: grace, link, me: 'g', now: d.now });
  assert.equal(await guest.joined, true);
  const me = guest.me;
  assert.equal(me.tackN ?? 0, 0);
  Object.assign(d, { guest, grace, me, Hg: grace.humans.find((b) => b.id === 'h') });
  d.run(0.3);
  assert.ok(near(me, d.Gh) < 1, `back where the host has her (${near(me, d.Gh).toFixed(2)} m)`);
  assert.ok(Math.abs(grace.clock - d.hrace.clock) < 0.25, 'and at the host\'s time');
  // her presses move the host's copy again: a tack (her count goes on from the host's), then the helm
  me.tackOrGybe(); me.tackN = (me.tackN || 0) + 1;
  d.run(0.3);
  assert.ok(d.Gh.auto, 'the host\'s copy tacks for the reloaded guest');
  d.run(8);
  const h0 = d.Gh.h;
  d.run(2, () => { me.rudder = -0.5; });
  assert.equal(d.Gh.rudder, -0.5);
  assert.ok(Math.abs(wrap(d.Gh.h - h0)) > 15 * D2R, 'and turns with her helm');

  // with the code zero up, the main trimmed and a reef going in: the reloaded page takes her sails from the host's
  // copy before it sends a thing, and the host's copy keeps them
  const e = await duel();
  e.run(1);
  e.me.setKite(true, 'zero');
  e.run(11, () => { e.me.sheet = 0.7; });
  e.me.setReef(true);
  e.run(5);
  assert.ok(e.Gh.kite && e.Gh.kiteType === 'zero' && !e.Gh.kiteJob, 'the host\'s copy has the zero up');
  assert.ok(e.Gh.reefJob?.on, 'and a reef going in');
  e.guest.stop();
  const lk = makeLink(e.rt, e.code);
  await lk.all.join();
  const g2 = new Guest({ race: raceFor(e.match, 'g'), link: lk, me: 'g', now: e.now });
  await g2.joined;
  const m2 = g2.me, heardFrom = e.host._lastIn;
  e.clock.t += 50;
  g2.input(controlsOf(m2)); // her fresh page, before any snapshot: nothing goes out
  assert.equal(e.host._lastIn, heardFrom, 'no input before the first snapshot');
  Object.assign(e, { guest: g2, grace: g2.race, me: m2, Hg: g2.race.humans.find((b) => b.id === 'h') });
  e.run(1);
  assert.ok(e.host._lastIn > heardFrom, 'and then it does');
  for (const b of [e.Gh, m2]) {
    assert.ok(b.kite && b.kiteType === 'zero' && !b.kiteJob, `${b === m2 ? 'her page' : 'the host\'s copy'}: the zero still up`);
    assert.equal(b.sheet, 0.7);
    assert.ok(b.reefJob?.on, 'the reef still going in');
  }
  assert.ok(Math.abs(m2.reefJob.t - e.Gh.reefJob.t) < 0.5, `as far along (${m2.reefJob.t.toFixed(2)} s left, the host ${e.Gh.reefJob.t.toFixed(2)})`);
});

test('the message budget: one minute of racing under 30 a second', async (t) => {
  const { rt, n } = counting(memoryRealtime());
  const d = await duel({ rt });
  n.sent = n.delivered = 0;
  // a sailor's hands: the helm moved every half second, a tack every 15 s, a sheet trimmed every 4 s
  let i = 0;
  const HELM = [0.2, 0, -0.15, 0.1, 0, -0.3, 0.25, 0, 0.05, -0.1];
  d.run(60, () => {
    const s = i++ * FRAME;
    if (i % 30 === 0) d.me.rudder = HELM[(i / 30) % HELM.length];
    if (i % 900 === 450) { d.me.tackOrGybe(); d.me.tackN = (d.me.tackN || 0) + 1; }
    if (i % 240 === 0) d.me.sheet = Math.min(1, Math.max(0, d.me.sheet + (s % 8 < 4 ? 0.05 : -0.05)));
    d.H.rudder = HELM[Math.floor(s) % HELM.length];
  });
  const rate = (n.sent + n.delivered) / 60;
  t.diagnostic(`${n.sent} sent, ${n.delivered} delivered: ${rate.toFixed(1)} messages a second`);
  assert.ok(rate < 30, `${rate.toFixed(1)} a second`);
  assert.ok(n.sent >= 600, 'ten snapshots a second at least');

  // the most a sailor sends: the helm dragged all the time, a tack every 15 s; the waiting rooms paused for the race
  let m = null;
  const e = await duel({ rooms: true, hub: () => { const c = counting(memoryRealtime()); m = c.n; return c.rt; } });
  m.sent = m.delivered = 0;
  i = 0;
  e.run(60, () => {
    i++;
    e.me.rudder = 0.5 * Math.sin(i / 20);
    if (i % 900 === 450) { e.me.tackOrGybe(); e.me.tackN = (e.me.tackN || 0) + 1; }
    e.H.rudder = 0.4 * Math.sin(i / 25);
  });
  const most = (m.sent + m.delivered) / 60;
  t.diagnostic(`helm dragged, rooms paused: ${m.sent} sent, ${m.delivered} delivered: ${most.toFixed(1)} messages a second`);
  assert.ok(most < 30, `${most.toFixed(1)} a second`);
  assert.equal(e.hroom.guest?.id, 'g', 'the paused room still has its guest');
});

test('a paused waiting room says nothing, and speaks up again at once when resumed', async () => {
  const { room, clock, hub } = setup();
  const host = await room(person('h', 'Host'), true, SETTINGS);
  const guest = await room(person('g', 'Guest'), false);
  const said = { h: 0, g: 0 };
  const ear = makeLink(hub, 'ABC234').all;
  await ear.join(); ear.on('hello', (h) => { said[h.id]++; });
  host.pause(true); guest.pause(true);
  for (let k = 0; k < 30; k++) { clock.t += 1000; host.tick(); guest.tick(); }
  assert.deepEqual(said, { h: 0, g: 0 }, 'no hellos for 30 s');
  assert.equal(host.guest?.id, 'g', 'and nobody gone');
  assert.equal(guest.host?.id, 'h');
  host.pause(false); guest.pause(false);
  assert.deepEqual(said, { h: 1, g: 1 }, 'a hello each at once');
  for (let k = 0; k < 9; k++) { clock.t += 1000; host.tick(); guest.tick(); }
  assert.deepEqual(said, { h: 4, g: 4 }, 'then every 3 s');
  assert.equal(host.guest?.id, 'g');
});

test('a race sailed to its end is never abandoned', async () => {
  // the host's game ends the race, then its tab sleeps over a minute and wakes: the end again, no abandon
  const d = await duel();
  d.run(1);
  const heard = { end: 0, abandon: 0 };
  const ear = makeLink(d.rt, d.code).all;
  await ear.join(); ear.on('end', () => heard.end++); ear.on('abandon', () => heard.abandon++);
  d.hrace.forfeit(d.Gh);
  d.run(0.1);
  assert.equal(heard.end, 1);
  d.clock.t += 61000;
  d.host.tick(FRAME);
  assert.equal(heard.abandon, 0);
  assert.equal(d.host.abandoned, false);
  assert.equal(heard.end, 2, 'told again');
  assert.equal(d.guest.abandoned, false);

  // the guest's page waited a minute for a silent host; then the host's end comes: the result stands
  const e = await duel();
  e.run(1);
  for (let k = 0, n = Math.round(60.2 / FRAME); k < n; k++) { e.clock.t += 1000 * FRAME; e.guest.frame(FRAME); }
  assert.equal(e.guest.hostSilent, true);
  assert.equal(e.guest.abandoned, false);
  let end = null;
  e.guest.onEnd((x) => { end = x; });
  e.hrace.forfeit(e.Gh);
  e.host.tick(FRAME);
  assert.deepEqual(end, { winner: 'h', margin: null, forfeited: 'g' });
  assert.equal(e.guest.abandoned, false, 'a race sailed to its end is not abandoned');
  assert.equal(e.host.abandoned, false);
});

test('after the host\'s game hitches, the guest\'s clock, wind and waves are the host\'s again', async () => {
  const d = await duel();
  d.run(2);
  // the host's game stops for 2 s (under the 3 s that freezes the guest's screen); hers goes on
  for (let k = 0; k < 120; k++) { d.clock.t += 1000 * FRAME; d.guest.input(controlsOf(d.me)); d.guest.frame(FRAME); }
  assert.ok(d.grace.clock > d.hrace.clock + 1.5, 'her clock ran on');
  d.run(3);
  for (const [what, a, b] of [['clock', d.grace.clock, d.hrace.clock], ['waves', d.grace.t, d.hrace.t], ['wind', d.grace.wind.t, d.hrace.wind.t]]) {
    assert.ok(Math.abs(a - b) <= FRAME + 1e-6, `${what}: ${a.toFixed(4)} against the host's ${b.toFixed(4)}`);
  }
  assert.ok(Math.abs(d.grace.wind.t - d.grace.t) < 1e-6, 'her wind and waves together');
});

test('her penalty turn is the host\'s to judge: her own screen never pays it, and hears it paid once', async () => {
  const d = await duel();
  d.run(1);
  // the host's copy of her owes one and is turning it
  Object.assign(d.Gh, { owed: 1, pen: { mr: true } });
  d.run(0.2);
  assert.equal(d.me.owed, 1); assert.ok(d.me.pen);
  // her own screen, sailing on, has her on the beat and close-hauled: there the turn would be done at once
  Object.assign(d.me, { leg: 1, h: wrap(d.me.wdir - 40 * D2R), events: [] });
  d.grace.clock = 20;
  for (let k = 0; k < 20; k++) { d.clock.t += 1000 * FRAME; d.guest.frame(FRAME); }
  assert.equal(d.me.owed, 1, 'still owed: the host hasn\'t seen it done');
  assert.ok(d.me.pen, 'still turning');
  assert.deepEqual(d.me.events.filter((e) => e === 'penaltyDone'), []);
  // the host sees it done
  Object.assign(d.Gh, { owed: 0, pen: null });
  d.run(0.5);
  assert.equal(d.me.owed, 0); assert.equal(d.me.pen, null);
  assert.deepEqual(d.me.events.filter((e) => e === 'penaltyDone'), ['penaltyDone']);
});

test('a reloaded guest holding her controls steady is set against the host\'s copy again: a drift eased away, a big one taken at once', async () => {
  const d = await duel({ latency: 150 });
  d.run(5, () => { d.me.rudder = 0; });
  d.run(1, () => { d.me.rudder = 0.2; });
  d.run(14, () => { d.me.rudder = 0; });
  d.guest.stop();
  const lk = makeLink(d.rt, d.code);
  await lk.all.join();
  const ear = makeLink(d.rt, d.code).input, stamps = [];
  await ear.join(); ear.on('input', (m) => stamps.push(m.g));
  const g2 = new Guest({ race: raceFor(d.match, 'g'), link: lk, me: 'g', now: d.now });
  await g2.joined;
  Object.assign(d, { guest: g2, grace: g2.race, me: g2.me, Hg: g2.race.humans.find((b) => b.id === 'h') });
  d.run(2); // her hands off the helm: the same controls all along
  assert.ok(stamps.length > 0 && stamps.at(-1) >= g2._own0 && Math.abs(stamps.at(-1) - g2._own) < 2, `her controls stamped on her new page's clock (${stamps.at(-1)}, her clock ${g2._own.toFixed(2)})`);
  d.me.x += 10; // her screen drifts 10 m off
  d.run(3);
  assert.ok(near(d.me, d.Gh) < 2, `the drift eased away (${near(d.me, d.Gh).toFixed(2)} m off the host's copy)`);
  d.me.x += 25; // and 25 m
  d.run(0.4);
  assert.ok(near(d.me, d.Gh) < 2, `taken at once (${near(d.me, d.Gh).toFixed(2)} m)`);
  // with no past pose of hers to set it against (the host's game hitched; her clock ran on and now waits for it):
  // the host's copy itself, and 25 m off is still taken at once
  for (let k = 0; k < 120; k++) { d.clock.t += 1000 * FRAME; d.rt.pump(); d.guest.input(controlsOf(d.me)); d.guest.frame(FRAME); }
  d.run(0.3);
  assert.ok(d.grace.clock > d.hrace.clock + 1, 'her clock is waiting for the host\'s');
  d.me.x += 25;
  d.run(0.4);
  // (her boat sails on while her clock waits: she is ahead of the host's copy by the clocks' difference)
  const lead = d.grace.clock - d.hrace.clock, at = { x: d.Gh.x + Math.sin(d.Gh.h) * d.Gh.v * lead, z: d.Gh.z - Math.cos(d.Gh.h) * d.Gh.v * lead };
  assert.ok(near(d.me, at) < 2, `taken at once, waiting (${near(d.me, at).toFixed(2)} m off the host's copy carried on ${lead.toFixed(2)} s)`);
});

// a frame on each screen as a browser gives them: the host's game sometimes drops a frame and steps twice in the next;
// the guest's frames come every 16.7 ms give or take a quarter, each stepping what its accumulator holds (match-ui.js)
function browserFrames(d, { drops = true, seed = 11 } = {}) {
  let x = seed, i = 0, acc = 0;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  return (fn) => {
    d.clock.t += 1000 * FRAME; d.rt.pump(); fn?.(); i++;
    const ticks = drops ? (i % 7 === 3 ? 0 : i % 7 === 4 ? 2 : 1) : 1;
    for (let k = 0; k < ticks; k++) d.host.tick(FRAME);
    d.hrace.messages.length = 0;
    d.guest.input(controlsOf(d.me));
    acc += FRAME * (1 + 0.5 * (rnd() - 0.5));
    while (acc >= FRAME) { d.guest.frame(FRAME); acc -= FRAME; }
    d.grace.messages.length = 0;
  };
}

test('under jitter and the host\'s dropped frames her helm stays her own: nearly every snapshot is set against her own past, and nothing pulls her turn back', async (t) => {
  for (const jitter of [10, 20]) {
    const d = await duel({ latency: 150, jitter });
    const frame = browserFrames(d), run = (secs, fn) => { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) frame(fn); };
    run(2);
    let calls = 0, hits = 0;
    const histAt = d.guest._histAt.bind(d.guest);
    d.guest._histAt = (c) => { const p = histAt(c); calls++; if (p) hits++; return p; };
    let after = null, inTurn = 0, afterCentre = 0;
    const step = d.me.step;
    d.me.step = function (dt, r) { step.call(this, dt, r); after = this.h; }; // her heading as her own helm left it
    const pull = () => (after === null ? 0 : Math.abs(wrap(d.me.h - after)));
    const h0 = d.me.h;
    run(2, () => { inTurn += pull(); d.me.rudder = 0.5; });
    const turned = Math.abs(wrap(d.me.h - h0));
    run(1, () => { afterCentre += pull(); d.me.rudder = 0; });
    afterCentre += pull();
    t.diagnostic(`jitter ${jitter} ms: ${hits}/${calls} snapshots set against her own past (${(100 * hits / calls).toFixed(0)}%); a ${(turned / D2R).toFixed(0)}° turn pulled back ${(inTurn / D2R).toFixed(2)}°, ${(afterCentre / D2R).toFixed(2)}° in the second after she centred; clocks ${(d.grace.clock - d.hrace.clock).toFixed(3)} s apart`);
    assert.ok(turned > 20 * D2R, 'she turned');
    assert.ok(hits / calls >= 0.9, `${hits}/${calls} set against her own past`);
    assert.ok(inTurn < 1 * D2R, `her turn pulled back ${(inTurn / D2R).toFixed(2)}°`);
    assert.ok(afterCentre < 1 * D2R, `her bow moved ${(afterCentre / D2R).toFixed(2)}° after she centred`);
    assert.ok(Math.abs(wrap(d.me.h - d.Gh.h)) < 1 * D2R, `on the host's copy's heading (${(wrap(d.me.h - d.Gh.h) / D2R).toFixed(2)}°)`);
  }
});

test('the guest sees the host\'s boat where it is now, not where it was: within 0.5 m at 150 ms each way', async (t) => {
  const d = await duel({ latency: 150, jitter: 10 });
  const frame = browserFrames(d, { drops: false });
  for (let i = 0; i < 120; i++) frame();
  let worst = 0, n = 0, jump = 0, last = null;
  for (let i = 0; i < 300; i++) {
    frame(() => { if (i >= 150) d.H.rudder = 0.15; }); // she sails straight, then bears off steadily
    worst = Math.max(worst, near(d.Hg, d.H)); n++;
    if (last) jump = Math.max(jump, Math.abs(near(d.Hg, last) - Math.abs(d.H.v) * FRAME)); // a step that isn't her speed's
    last = { x: d.Hg.x, z: d.Hg.z };
  }
  t.diagnostic(`at ${d.H.v.toFixed(2)} m/s: the drawn host boat ≤ ${worst.toFixed(2)} m from the host's own, at the same moment; the most a frame's step differs from her speed's ${jump.toFixed(3)} m`);
  assert.ok(worst < 0.5, `${worst.toFixed(2)} m off`);
  assert.ok(jump < 0.1, `a jump of ${jump.toFixed(3)} m`);
});

test('a tack pressed or the helm thrown goes at once, past the 0.2 s floor, but never more than ten inputs a second', async () => {
  const d = await duel();
  d.run(1);
  const ear = makeLink(d.rt, d.code).input, got = [];
  await ear.join(); ear.on('input', (m) => got.push({ at: d.clock.t, c: m.c }));
  // her hands still till an input has just gone, then 0.12 s more (the 0.2 s floor would hold a change 80 ms longer)
  const still = (r) => { for (let i = 0; i < 60 && !(got.length && got.at(-1).at === d.clock.t); i++) d.frame(() => { d.me.rudder = r; }); d.run(0.12, () => { d.me.rudder = r; }); };
  // a small helm change waits for the floor
  still(0);
  let n = got.length, t0 = d.clock.t;
  d.run(0.3, () => { d.me.rudder = 0.1; });
  const small = got.slice(n).find((m) => m.c.r === 0.1);
  assert.ok(small && small.at - t0 >= 75, `the small change waited for the floor (${small ? (small.at - t0).toFixed(0) : '–'} ms)`);
  // the helm thrown over goes at once
  still(0.1);
  n = got.length; t0 = d.clock.t;
  d.run(0.12, () => { d.me.rudder = -0.4; });
  const thrown = got.slice(n).find((m) => m.c.r === -0.4);
  assert.ok(thrown && thrown.at - t0 <= 1000 * FRAME + 1, `the helm thrown went ${thrown ? (thrown.at - t0).toFixed(0) : '–'} ms after`);
  // the helm thrown from side to side every frame for 2 s: ten a second at the most
  const n1 = got.length; let k = 0;
  d.run(2, () => { d.me.rudder = k++ % 2 ? 0.6 : -0.6; });
  assert.ok(got.length - n1 <= 21, `${got.length - n1} inputs in 2 s`);
  const gaps = got.slice(n1).map((m, i, a) => (i ? m.at - a[i - 1].at : Infinity));
  assert.ok(Math.min(...gaps) >= 99, `never two within ${Math.min(...gaps).toFixed(0)} ms`);
  // a tack pressed goes at once
  still(0);
  n = got.length; t0 = d.clock.t;
  d.me.tackOrGybe(); d.me.tackN = (d.me.tackN || 0) + 1;
  d.run(0.12);
  const tk = got.slice(n).find((m) => m.c.tk === d.me.tackN);
  assert.ok(tk && tk.at - t0 <= 1000 * FRAME + 1, `the tack went ${tk ? (tk.at - t0).toFixed(0) : '–'} ms after the press`);
});

test('while the host\'s own link is in doubt the guest\'s silence isn\'t counted: no forfeit for the host\'s outage', async () => {
  let up = true;
  const d = await duel({ alive: () => up });
  d.run(1);
  // the host's socket is dead (no heartbeat answered for over 7 s): nothing from the guest gets through
  up = false;
  const quiet = (secs) => { for (let i = 0, n = Math.round(secs / FRAME); i < n; i++) { d.clock.t += 1000 * FRAME; d.host.tick(FRAME); } };
  quiet(45);
  assert.equal(d.hrace.over, false, 'not forfeited in 45 s of its own outage');
  // its link back, the guest still silent: now her 30 s run
  up = true;
  quiet(29);
  assert.equal(d.hrace.over, false);
  quiet(1.5);
  assert.equal(d.hrace.over, true);
  assert.equal(d.hrace.forfeited, d.Gh);
});

test('a host silent 58 to 65 s: the guest waits, and both screens agree on what became of the race', async (t) => {
  for (const gap of [58, 59.9, 60.5, 62, 65]) {
    const d = await duel({ latency: 100 });
    d.run(2);
    // the host's tab sleeps: no tick, no snapshot; the guest's screen runs on, waiting
    for (let i = 0, n = Math.round(gap / FRAME); i < n; i++) { d.clock.t += 1000 * FRAME; d.rt.pump(); d.guest.input(controlsOf(d.me)); d.guest.frame(FRAME); }
    assert.equal(d.guest.abandoned, false, `${gap} s: the guest doesn't give it up herself`);
    assert.equal(d.guest.hostSilent, true);
    const was = d.grace.clock;
    d.run(6); // the host wakes (her clock, which ran on 3 s before she froze, waits for its)
    t.diagnostic(`${gap} s: host abandoned ${d.host.abandoned}, guest abandoned ${d.guest.abandoned}, guest waiting ${d.guest.hostSilent}`);
    assert.equal(d.guest.abandoned, d.host.abandoned, `${gap} s: the same on both screens`);
    assert.equal(d.host.abandoned, gap > 60, `${gap} s: abandoned only past a minute`);
    if (!d.host.abandoned) {
      assert.equal(d.guest.hostSilent, false, `${gap} s: she sails on`);
      assert.ok(d.grace.clock > was + 2, `her race goes on (${(d.grace.clock - was).toFixed(2)} s)`);
      assert.ok(Math.abs(d.grace.clock - d.hrace.clock) < 0.25, 'at the host\'s time');
    }
  }
});

// ---------- the host's side between races (Keeper): presence, Ready and the automatic start ----------
// the host's, the guest's and a third person's screens in one room over the hub, the clock fake; the match started and
// its first race sailed, the card just open. say(who): that screen's beat of hellos; secs(n, ...who): n seconds of
// beats, the Keeper's four a second, each named screen's room ticking
async function between({ build = 'b1', guestBuild = 'b1' } = {}) {
  const hub = memoryRealtime(), clock = { t: 10000 }, now = () => clock.t;
  const mk = async (me, host) => { const r = new Room({ link: makeLink(hub, 'KEEP22'), me, host, settings: host ? SETTINGS : null, now, every: 0 }); await r.joined; return r; };
  const hl = makeLink(hub, 'KEEP22');
  const host = new Room({ link: hl, me: { ...person('h', 'Host'), build }, host: true, settings: SETTINGS, now, every: 0 });
  await host.joined;
  const keeper = new Keeper({ room: host, link: hl, build, now });
  clock.t += 100;
  const gl = makeLink(hub, 'KEEP22');
  const guest = new Room({ link: gl, me: { ...person('g', 'Guest'), build: guestBuild }, host: false, now, every: 0 });
  await guest.joined;
  await gl.input.join();
  clock.t += 100;
  const third = await mk(person('x', 'Third'), false);
  assert.equal(host.guest.id, 'g');
  const m = new Match({ start: host.start(), now });
  keeper.set(m);
  keeper.raceOn();
  for (let i = 0; i < 20; i++) { clock.t += 250; gl.input.send('input', { id: 'g', c: {}, g: 0 }); keeper.beat(); } // racing, her inputs coming
  keeper.raceEnded({ winner: 'h', margin: 4 });
  keeper.raceOff();
  host.pause(false); guest.pause(false); third.pause(false);
  const rooms = { host, guest, third };
  const secs = (n, ...who) => { for (let i = 0; i < n * 4; i++) { clock.t += 250; for (const w of who) rooms[w].tick(); keeper.beat(); } };
  const ready = (n = m.nextN) => gl.all.send('ready', { id: 'g', n, seed: m.start.seed });
  return { hub, clock, keeper, m, host, guest, third, secs, ready, gl };
}

test('a third with the link never takes the guest\'s place: she is silent 12 s between races, comes back, both Ready, and race 2 is hers', async () => {
  const { keeper, m, host, third, secs, ready } = await between();
  assert.equal(m.state, 'between');
  secs(12, 'host', 'third'); // the guest's screen silent (a tunnel, a locked phone); the third's open
  assert.equal(keeper.present(), false, 'she is not here');
  assert.equal(host.guest, null, 'the room has no guest while she is away: not the third');
  assert.equal(third.full, true, 'the third is still told the match is full');
  assert.equal(m.state, 'between');
  secs(1, 'host', 'third', 'guest'); // she is back
  assert.equal(keeper.present(), true);
  assert.equal(host.guest.id, 'g');
  ready(); keeper.readyMe();
  assert.equal(m.state, 'race', 'both Ready: the next race');
  assert.equal(m.raceN, 2);
  assert.equal(m.guestId, 'g');
  assert.equal(third.full, true);
  // a rematch is hers too
  assert.equal(host.start().guest.id, 'g');
});

test('between races: one Ready starts the race after the card\'s minute with both here; the minute waits for a missing guest, and counts from her return', async () => {
  const { keeper, m, clock, secs, ready } = await between();
  keeper.readyMe();
  secs(30, 'host', 'guest');
  assert.equal(m.state, 'between');
  assert.ok(Math.abs(keeper.left() - 30) < 0.5, `${keeper.left()} s left`);
  secs(30.5, 'host', 'guest');
  assert.equal(m.state, 'race', 'the minute up with both here');
  // the next card: she goes silent at once, for two minutes; the race never starts without her
  keeper.raceOn(); secs(1); keeper.raceEnded({ winner: 'g', margin: 2 }); keeper.raceOff();
  secs(120, 'host');
  assert.equal(m.state, 'between');
  assert.equal(keeper.left(), null, 'no countdown while she is away');
  secs(1, 'host', 'guest');
  assert.ok(keeper.left() > 58, 'the minute from her return');
  secs(58, 'host', 'guest');
  assert.equal(m.state, 'between');
  secs(2, 'host', 'guest');
  assert.equal(m.state, 'race');
  assert.equal(m.raceN, 3);
  // a Ready for another race, or another match's, or from someone else, is nothing
  keeper.raceOn(); secs(1); keeper.raceEnded({ winner: 'h', margin: 1 }); keeper.raceOff();
  assert.equal(m.state, 'over', '2–1');
  void clock; void ready;
});

test('a guest silent as a race ends isn\'t here till she is heard again (not the room\'s ten seconds); gone five minutes, the match is over', async () => {
  const { hub, keeper, m, clock, host, secs, ready, gl } = await between();
  // (between() had her inputs coming to the end) — the next race, and she goes silent in it
  keeper.readyMe(); ready();
  assert.equal(m.state, 'race');
  host.pause(true); keeper.raceOn(); // (the room paused for the race, as the game pauses it)
  secs(5); // no inputs
  keeper.raceEnded({ winner: 'g', margin: 3 }); keeper.raceOff(); host.pause(false);
  assert.equal(keeper.present(), false, 'not here at once, though the room gives her ten seconds');
  assert.equal(host.heard('g'), true);
  secs(1, 'host', 'guest');
  assert.equal(keeper.present(), true, 'heard again: here');
  // a Ready from someone else, for another race, or another match, is nothing
  gl.all.send('ready', { id: 'x', n: m.nextN, seed: m.start.seed });
  gl.all.send('ready', { id: 'g', n: m.nextN + 1, seed: m.start.seed });
  gl.all.send('ready', { id: 'g', n: m.nextN, seed: m.start.seed + 1 });
  assert.equal(keeper.ready.size, 0);
  // gone for good: five minutes
  secs(299, 'host');
  assert.equal(m.state, 'between', 'four minutes and fifty-odd seconds: still waiting');
  secs(12, 'host');
  assert.equal(m.state, 'over', 'five minutes gone: over');
  assert.deepEqual(m.score, { h: 1, g: 1 });
  void hub; void clock;
});

test('a guest on another build is never raced: the room has her, but she isn\'t here till both screens run the same game', async () => {
  const { keeper, m, secs, ready } = await between({ guestBuild: 'b2' });
  secs(2, 'host', 'guest');
  assert.equal(keeper.stale(), true);
  assert.equal(keeper.present(), false);
  ready(); keeper.readyMe();
  secs(90, 'host', 'guest');
  assert.equal(m.state, 'between', 'never started');
});

test('penalties owed off the wire are read as 0 to 9: a bad number never hangs the HUD', async () => {
  const d = await duel();
  const row = encodeSnap(d.hrace).b[0], N = row.length - 24; // (the row's numbers, then its 24 fields after them)
  const at = (v) => { const r = row.slice(); r[N + 8] = v; return readBoat(r).owed; };
  assert.equal(at(2), 2);
  assert.equal(at(1e9), 9);
  assert.equal(at(-3), 0);
  assert.equal(at(NaN), 0);
  assert.equal(at('7'), 0);
  assert.equal(at(2.7), 2);
});

