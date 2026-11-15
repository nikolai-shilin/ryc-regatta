// The match's waiting room (Room) and score (Match), over the in-memory hub and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryRealtime } from './hub.mjs';
import { makeLink, Room, Match, HOST_KEY } from '../public/game/match.js';

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
