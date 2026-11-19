// The 1-on-1 race's waiting room (Room), its state (Match, Keeper), and the race between two screens (Host and Guest),
// over the in-memory hub and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryRealtime } from './hub.mjs';

globalThis.fetch = async (u) => new Response(await readFile(new URL(String(u)))); // land.js's bay files, from the disk
const { makeLink, Room, Match, HOST_KEY, raceFor, cleanSettings, Host, Guest, Keeper } = await import('../public/game/match.js');
const { controlsOf, readBoat, encodeSnap } = await import('../public/game/wire.js');
const { D2R, wrap, sheetFor, idealSail } = await import('../public/game/sim.js');

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

const start = (host = person('h', 'Host'), guest = person('g', 'Guest')) => ({ settings: SETTINGS, seed: 4242, host, guest });

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
  assert.equal('race' in msg, false, 'one race: no number');
  assert.equal('blue' in msg, false, 'and no colours');
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

// ---------- the settings, and the race both screens build from them ----------
const here = { venue: 'palma', yacht: 'jpk1050' };

test('cleanSettings keeps a good race and repairs a bad or old one', () => {
  assert.deepEqual(cleanSettings({ preset: 'strong', length: 'long', course: 'trap', laps: 2, start: 5, current: 1, daytime: 'sunset' }, here), { ...here, preset: 'strong', length: 'long', course: 'trap', laps: 2, start: 5, current: 1, daytime: 'sunset' });
  assert.deepEqual(cleanSettings({ preset: 'x', length: 'short', course: 'zz', laps: 9 }, here), { ...here, preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' });
  // what the set-up saved before it offered more, and nothing at all
  const plain = { ...here, preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
  assert.deepEqual(cleanSettings({ venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short' }, { venue: 'cork', yacht: 'ac75' }), plain);
  for (const bad of [null, undefined, 7, 'x']) assert.deepEqual(cleanSettings(bad, here), plain);
  // each list's every value stands; anything else, a number's string aside, is the default
  for (const [k, list] of Object.entries({ preset: ['light', 'medium', 'strong'], length: ['short', 'medium', 'long'], course: ['wl', 'tri', 'trap', 'wlu'], laps: [1, 2], start: [1, 3, 5], current: [0, 1], daytime: ['any', 'morning', 'midday', 'afternoon', 'evening', 'sunset'] })) {
    for (const v of list) assert.equal(cleanSettings({ [k]: v }, here)[k], v, `${k} ${v}`);
    assert.equal(cleanSettings({ [k]: 'nonsense' }, here)[k], plain[k], k);
  }
  assert.equal(cleanSettings({ start: 4 }, here).start, 1);
  assert.equal(cleanSettings({ current: true }, here).current, 1);
});

const raceStart = (seed, settings = { ...here, preset: 'strong', length: 'short', course: 'tri', laps: 2, start: 3, current: 1, daytime: 'morning' }) => ({ settings, seed, host: person('h', 'Host'), guest: person('g', 'Guest') });

test('both screens build the same race from the settings', () => {
  const m = new Match({ start: raceStart(4242) });
  const a = raceFor(m, 'h'), b = raceFor(m, 'g');
  assert.deepEqual(a.boats.map((x) => x.id), b.boats.map((x) => x.id));
  assert.deepEqual(a.boats.map((x) => [x.x, x.z, x.h]), b.boats.map((x) => [x.x, x.z, x.h]), 'on the same spots');
  assert.deepEqual(a.current, b.current);
  assert.notDeepEqual(a.current, { x: 0, z: 0 }, 'the current the host chose');
  assert.equal(a.course.type, 'tri');
  assert.equal(a.seq[0].t, -180, 'the three-minute sequence the host chose');
  assert.equal(a.seq.length, 4); // (warning, preparatory, one minute, gun)
  assert.equal(a.seed, 4242);
  assert.equal(a.boats.length, 2, 'no computer boats');
  assert.equal(a.multi, true);
  assert.equal(a.player.id, 'h'); assert.equal(b.player.id, 'g');
  assert.deepEqual(a.humans.find((x) => x.id === 'g').look, { hull: 'g' }, 'each sailor in her own look');
});

test('the seed decides who has which start position', () => {
  const even = new Match({ start: raceStart(4242) }), odd = new Match({ start: raceStart(4243) });
  assert.deepEqual(raceFor(even, 'h').boats.map((b) => b.id), ['h', 'g']);
  assert.deepEqual(raceFor(odd, 'h').boats.map((b) => b.id), ['g', 'h']);
  assert.deepEqual(raceFor(odd, 'g').boats.map((b) => b.id), ['g', 'h'], 'on both screens');
});

// ---------- one race's state ----------
test('a match is one race: its result, and nothing of a best of three', () => {
  const m = new Match({ start: start() });
  assert.equal(m.state, 'race');
  assert.equal(m.result, null);
  for (const k of ['score', 'races', 'raceN', 'blueOf', 'ready', 'nextRace', 'seedOf', 'nextN']) assert.equal(k in m, false, k);
  m.endRace({ winner: 'h', margin: 12.5, forfeited: null });
  assert.equal(m.state, 'over');
  assert.deepEqual(m.result, { winner: 'h', margin: 12.5, forfeited: null, abandoned: false });
  m.endRace({ winner: 'g', margin: 1 });
  assert.equal(m.result.winner, 'h', 'its first end stands');
});

test('an abandoned race has no winner, whatever it is told', () => {
  const m = new Match({ start: start() });
  m.endRace({ winner: 'h', margin: 4, forfeited: 'g', abandoned: true });
  assert.deepEqual(m.result, { winner: null, margin: null, forfeited: null, abandoned: true });
});

test('the host leaving abandons the race; the guest leaving leaves it to the race\'s own rules', () => {
  const a = new Match({ start: start() });
  a.leave('h');
  assert.equal(a.state, 'over'); assert.equal(a.result.abandoned, true); assert.equal(a.leftBy, 'h');
  const b = new Match({ start: start() });
  b.leave('g');
  assert.equal(b.state, 'race', 'the Host forfeits her, or her place stands and it runs on');
  assert.equal(b.leftBy, 'g');
  b.endRace({ winner: 'h', margin: 3 });
  assert.equal(b.result.winner, 'h');
  // after the race, leaving changes nothing of its result
  const c = new Match({ start: start() });
  c.endRace({ winner: 'g', margin: 3 });
  c.leave('h');
  assert.equal(c.result.winner, 'g'); assert.equal(c.result.abandoned, false); assert.equal(c.leftBy, 'h');
});

test('a reloaded host: the race on the water is abandoned', () => {
  const m = Match.from(JSON.parse(JSON.stringify(new Match({ start: start() }).toJSON())));
  assert.equal(m.state, 'over');
  assert.equal(m.result.abandoned, true);
  assert.equal(m.result.winner, null);
  assert.equal(m.hostId, 'h'); assert.equal(m.guestId, 'g');
});

test('a reloaded host: a race sailed to its end keeps its result, and who left', () => {
  const m = new Match({ start: start() });
  m.endRace({ winner: 'g', margin: 7.5, forfeited: null });
  m.leave('g');
  const back = Match.from(JSON.parse(JSON.stringify(m.toJSON())));
  assert.equal(back.state, 'over');
  assert.deepEqual(back.result, { winner: 'g', margin: 7.5, forfeited: null, abandoned: false });
  assert.equal(back.leftBy, 'g');
});

test('a host\'s match saved in the old format opens as no race at all, without a throw', () => {
  const oldStart = { settings: SETTINGS, seed: 4242, race: 1, blue: 'h', host: person('h', 'Host'), guest: person('g', 'Guest') };
  for (const state of ['between', 'race', 'over']) {
    const m = Match.from({ start: oldStart, state, raceN: 2, score: { h: 1, g: 0 }, races: [{ winner: 'h' }] });
    assert.equal(m.state, 'over', state);
    assert.equal(m.result.abandoned, true, state);
  }
});

test('gone five minutes: the race is over', () => {
  const t = { v: 0 };
  const m = new Match({ start: start(), now: () => t.v });
  m.present('g', false);
  t.v += 299000; m.tick();
  assert.equal(m.state, 'race', 'under five minutes: still on');
  m.present('g', true); // she is back: the five minutes start again
  t.v += 299000; m.tick();
  assert.equal(m.state, 'race');
  m.present('g', false);
  t.v += 299999; m.tick();
  assert.equal(m.state, 'race');
  t.v += 1; m.tick();
  assert.equal(m.state, 'over');
  assert.equal(m.result.abandoned, true);
  // someone who isn't in the race counts for nothing
  const n = new Match({ start: start(), now: () => t.v });
  n.present('x', false);
  t.v += 600000; n.tick();
  assert.equal(n.state, 'race');
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
const RACE_SETTINGS = { venue: 'palma', yacht: 'jpk1050', preset: 'medium', length: 'short', start: 5 }; // (the five-minute sequence: these tests are of the screens, before any gun)
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

// both boats sailing, well apart below the line and on a reach away from each other at 2 m/s, the same on each screen
// (these tests are of the helm and the sails between the screens, which want a boat with way on and none in her way)
function underWay(r) {
  const c = r.course;
  r.humans.forEach((b, i) => {
    const out = i ? -1 : 1;
    Object.assign(b, { x: b.x + c.dir.x * out * 60, z: b.z + c.dir.z * out * 60, h: Math.atan2(c.dir.x * out, -c.dir.z * out), v: 2, sheet: sheetFor(idealSail(60)), jibSheet: sheetFor(idealSail(60)) });
  });
}
// a race on two screens: the host's (h) and the guest's (g), each with her own link, over one hub
// (latency: ms each way); rooms: each screen's waiting room too, paused for the race as the game pauses it
async function duel({ rt = null, hub = null, latency = 0, jitter = 0, rooms = false, alive } = {}) {
  const clock = { t: 50000 }, now = () => clock.t, code = 'DUEL22';
  rt ??= hub ? hub(now) : memoryRealtime({ latency, jitter, now });
  const match = new Match({ start: { settings: RACE_SETTINGS, seed: 4242, host: person('h', 'Host'), guest: person('g', 'Guest') }, now });
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
  // the host's copy of her owes a turn, the tack of it done
  d.Gh.pen = { tack: true, gybe: false, dir: 1 };
  d.run(0.2);
  assert.deepEqual(d.me.pen, { tack: true, gybe: false, dir: 1 });
  // her own screen, sailing on, has her gybing: there the turn would be done at once
  d.me.events = [];
  d.me.pen.gybe = true;
  for (let k = 0; k < 20; k++) { d.clock.t += 1000 * FRAME; d.guest.frame(FRAME); }
  d.run(0.3);
  assert.deepEqual(d.me.pen, { tack: true, gybe: false, dir: 1 }, 'still turning: the host hasn\'t seen it done');
  assert.deepEqual(d.me.events.filter((e) => e === 'penaltyDone'), []);
  // the host sees it done
  d.Gh.pen = null;
  d.run(0.5);
  assert.equal(d.me.pen, null);
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

// ---------- the host's side after the race (Keeper): who is here ----------
// the host's, the guest's and a third person's screens in one room over the hub, the clock fake; the race started and
// sailed, the card just open. say(who): that screen's beat of hellos; secs(n, ...who): n seconds of beats, the Keeper's
// four a second, each named screen's room ticking
async function afterRace({ build = 'b1', guestBuild = 'b1' } = {}) {
  const hub = memoryRealtime(), clock = { t: 10000 }, now = () => clock.t;
  const mk = async (me, host) => { const r = new Room({ link: makeLink(hub, 'KEEP22'), me, host, settings: host ? SETTINGS : null, now, every: 0 }); await r.joined; return r; };
  const hl = makeLink(hub, 'KEEP22');
  const host = new Room({ link: hl, me: { ...person('h', 'Host'), build }, host: true, settings: SETTINGS, now, every: 0 });
  await host.joined;
  const keeper = new Keeper({ room: host, link: hl, build, now });
  await hl.input.join();
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
  return { hub, clock, keeper, m, host, guest, third, secs, gl, hl };
}

test('the Keeper keeps who is here and what she has loaded, and nothing of Ready', async () => {
  const { keeper, m, gl } = await afterRace();
  for (const k of ['ready', 'readyMe', 'left', 'cardOpenAt']) assert.equal(k in keeper, false, k);
  assert.equal(m.result.winner, 'h', 'its race ended with its result');
  // loaded: this race's, from her alone
  gl.all.send('loaded', { id: 'x', seed: m.start.seed });
  gl.all.send('loaded', { id: 'g', seed: m.start.seed + 1 });
  assert.equal(keeper.loaded, null);
  gl.all.send('loaded', { id: 'g', seed: m.start.seed });
  assert.equal(keeper.loaded, m.start.seed);
});

test('a third with the link never takes the guest\'s place: she is silent 12 s after the race, comes back, and the rematch is hers', async () => {
  const { keeper, m, host, third, secs } = await afterRace();
  assert.equal(m.state, 'over');
  secs(12, 'host', 'third'); // the guest's screen silent (a tunnel, a locked phone); the third's open
  assert.equal(keeper.present(), false, 'she is not here');
  assert.equal(host.guest, null, 'the room has no guest while she is away: not the third');
  assert.equal(third.full, true, 'the third is still told the race is full');
  secs(1, 'host', 'third', 'guest'); // she is back
  assert.equal(keeper.present(), true);
  assert.equal(host.guest.id, 'g');
  assert.equal(third.full, true);
  assert.equal(host.start().guest.id, 'g', 'a rematch is hers too');
});

test('a guest silent as a race ends isn\'t here till she is heard again (not the room\'s ten seconds)', async () => {
  const { keeper, m, clock, host, secs } = await afterRace();
  const next = new Match({ start: { ...m.start, seed: m.start.seed + 1 }, now: () => clock.t });
  keeper.set(next);
  host.pause(true); keeper.raceOn(); // (the room paused for the race, as the game pauses it)
  secs(5); // no inputs
  keeper.raceEnded({ winner: 'g', margin: 3 }); keeper.raceOff(); host.pause(false);
  assert.equal(keeper.present(), false, 'not here at once, though the room gives her ten seconds');
  assert.equal(host.heard('g'), true);
  secs(1, 'host', 'guest');
  assert.equal(keeper.present(), true, 'heard again: here');
});

test('a guest home and silent costs the race nothing: only the race\'s own rules end it', async () => {
  const { keeper, m, clock, secs } = await afterRace();
  const next = new Match({ start: { ...m.start, seed: m.start.seed + 1 }, now: () => clock.t });
  keeper.set(next);
  keeper.raceOn();
  secs(400); // over six minutes without a word: the Host forfeits a boat still out at 30 s; a boat home has nothing to give up
  assert.equal(next.state, 'race');
});

test('a guest who never loads the race, gone five minutes: the race is over, abandoned', async () => {
  const { keeper, m, clock, secs } = await afterRace();
  const next = new Match({ start: { ...m.start, seed: m.start.seed + 1 }, now: () => clock.t });
  keeper.set(next);
  secs(290, 'host');
  assert.equal(next.state, 'race', 'under five minutes of her silence');
  secs(25, 'host');
  assert.equal(next.state, 'over');
  assert.equal(next.result.abandoned, true);
});

test('a guest on another build is never raced: the room has her, but she isn\'t here till both screens run the same game', async () => {
  const { keeper, secs } = await afterRace({ guestBuild: 'b2' });
  secs(2, 'host', 'guest');
  assert.equal(keeper.stale(), true);
  assert.equal(keeper.present(), false);
});

// ---------- the end of the race, once the card is up: the beat keeps it going (match-ui.js) ----------
test('after the race the host\'s tick(0) and flush go on repeating the end and the results, and the results stop at her answer', async () => {
  const d = await duel();
  d.run(1);
  const heard = { snap: 0, end: 0, results: 0 };
  const ear = makeLink(d.rt, d.code).all;
  await ear.join();
  for (const k of Object.keys(heard)) ear.on(k, () => heard[k]++);
  // her answer doesn't come: she is deaf to the results for now
  const answer = d.guest._onResults; d.guest._onResults = () => {};
  d.hrace.forfeit(d.Gh);
  d.host.tick(FRAME);
  assert.equal(heard.end, 1); assert.equal(heard.results, 1);
  // the frames have stopped (the card is open): only the beat, four times a second
  const beat = (secs) => { for (let i = 0; i < secs * 4; i++) { d.clock.t += 250; d.host.tick(0); d.host.flush(); } };
  beat(5);
  assert.ok(heard.end >= 5 && heard.end <= 6, `the end told ${heard.end} times`);
  assert.ok(heard.snap >= 5 && heard.snap <= 6, `the last snapshot ${heard.snap} times`);
  assert.ok(heard.results >= 5 && heard.results <= 6, `the results ${heard.results} times`);
  assert.equal(d.host.acked, false);
  // she hears them, and answers: no more results
  d.guest._onResults = answer;
  beat(1.25);
  assert.equal(d.host.acked, true);
  assert.ok(d.guest.results, 'she has them');
  const n = heard.results;
  beat(3);
  assert.equal(heard.results, n, 'answered: the results stop');
});


// ---------- the other boat on the guest's screen, and what each screen heard ----------
test('the host\'s boat glides on the guest\'s screen: a snapshot that corrects her is eased in, never drawn as a jump', async () => {
  const d = await duel({ latency: 80, jitter: 60 });
  const drawn = [], real = [];
  d.run(6, () => {});
  for (let i = 0; i < 20 * 60; i++) { d.frame(() => { d.H.rudder = Math.sin(d.clock.t / 1000 * 1.2) * 0.6; }); drawn.push([d.Hg.x, d.Hg.z]); real.push([d.H.x, d.H.z]); } // (as the screen draws her: after the frame)
  // a jump: the change in her movement from one frame to the next (drawn as the snapshots came, unsmoothed: 6.7 cm)
  const jerk = (P) => P.slice(2).map((p, i) => Math.hypot(p[0] - 2 * P[i + 1][0] + P[i][0], p[1] - 2 * P[i + 1][1] + P[i][1]));
  const J = jerk(drawn), worst = Math.max(...J);
  assert.ok(worst < 0.015, `the drawn boat's movement changes by ${worst.toFixed(4)} m a frame at most`);
  const off = drawn.map((p, i) => Math.hypot(p[0] - real[i][0], p[1] - real[i][1]));
  assert.ok(Math.max(...off) < 0.5, `and she stays where the host has her: ${Math.max(...off).toFixed(2)} m off at most`);
});

test('each screen says how the other\'s messages came: the guest the way there and back and her late snapshots, the host her late inputs', async () => {
  const d = await duel({ latency: 50 });
  assert.equal(d.guest.net(), null, 'nothing under 20 s');
  d.run(30, () => { d.me.rudder = Math.sin(d.clock.t / 700) * 0.4; });
  const g = d.guest.net(), h = d.host.net();
  assert.ok(g.rtt >= 60 && g.rtt <= 140, `the way there and back (50 ms each way): ${g.rtt} ms`);
  assert.equal(g.late, 0); assert.deepEqual(h, { rtt: null, late: 0 });
  // the host's game stalls 1 s: no snapshot and no input heard in that time
  const T = d.clock.t; let stalled = false;
  const tick = d.host.tick.bind(d.host);
  d.host.tick = (dt) => { if (d.clock.t - T < 1000) { stalled = true; return; } tick(dt); };
  d.run(5, () => {});
  assert.ok(stalled);
  assert.ok(d.guest.net().late > 0, 'the guest heard the snapshots late');
});
