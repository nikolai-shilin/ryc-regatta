// The Realtime client (public/game/net.js) against a fake socket, the in-memory hub, and the link codes.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { realtime } from '../public/game/net.js';
import { memoryRealtime } from './hub.mjs';

const { newCode, CODE_RE, parseCode } = await import('../lib/code.ts');

class FakeSocket {
  static all = [];
  constructor(url) { this.url = url; this.sent = []; this.readyState = 0; FakeSocket.all.push(this); }
  send(s) { this.sent.push(JSON.parse(s)); }
  open() { this.readyState = 1; this.onopen?.({}); }
  recv(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  close() { this.readyState = 3; this.onclose?.({}); }
}
const frames = (s, event) => s.sent.filter((f) => f.event === event);
const answerHb = (s) => { const h = frames(s, 'heartbeat').at(-1); s.recv({ topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok' }, ref: h.ref }); };
const tick = () => new Promise((r) => setImmediate(r));

function setup() {
  FakeSocket.all = [];
  const rt = realtime({ url: 'https://abc.supabase.co', key: 'KEY', WebSocket: FakeSocket });
  const ch = rt.channel('match:ABC123', { self: true });
  const joined = ch.join();
  return { rt, ch, joined, sock: () => FakeSocket.all.at(-1) };
}
const ackJoin = (s) => { const j = frames(s, 'phx_join').at(-1); s.recv({ topic: j.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: j.ref, join_ref: j.join_ref }); };

test('joins with the broadcast config and sends broadcasts in Supabase\'s shape', async (t) => {
  const { rt, ch, joined, sock } = setup();
  t.after(() => rt.close());
  const s = sock();
  assert.equal(s.url, 'wss://abc.supabase.co/realtime/v1/websocket?apikey=KEY&vsn=1.0.0');
  s.open();
  const j = frames(s, 'phx_join')[0];
  assert.equal(j.topic, 'realtime:match:ABC123');
  assert.deepEqual(j.payload, {
    config: { broadcast: { self: true, ack: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false },
    access_token: 'KEY',
  });
  ch.send('early', { n: 0 }); // before the join is answered: dropped
  ackJoin(s);
  await joined;
  ch.send('pos', { n: 1 });
  const b = frames(s, 'broadcast');
  assert.equal(b.length, 1);
  assert.equal(b[0].topic, 'realtime:match:ABC123');
  assert.deepEqual(b[0].payload, { type: 'broadcast', event: 'pos', payload: { n: 1 } });
  const got = [];
  ch.on('pos', (p) => got.push(p));
  s.recv({ topic: 'realtime:match:ABC123', event: 'broadcast', payload: { type: 'broadcast', event: 'pos', payload: { n: 2 } } });
  s.recv({ topic: 'realtime:other', event: 'broadcast', payload: { type: 'broadcast', event: 'pos', payload: { n: 3 } } });
  assert.deepEqual(got, [{ n: 2 }]);
});

test('heartbeats every 25 s and rejoins after a reconnect', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { ch, joined, sock } = setup();
    const s1 = sock();
    s1.open(); ackJoin(s1); await joined;
    mock.timers.tick(24999);
    assert.equal(frames(s1, 'heartbeat').length, 0);
    mock.timers.tick(1);
    const hb = frames(s1, 'heartbeat');
    assert.equal(hb.length, 1);
    assert.equal(hb[0].topic, 'phoenix');
    answerHb(s1);
    mock.timers.tick(25000);
    assert.equal(frames(s1, 'heartbeat').length, 2);

    s1.close(); // dropped: first retry after 1 s
    assert.equal(FakeSocket.all.length, 1);
    mock.timers.tick(999);
    assert.equal(FakeSocket.all.length, 1);
    mock.timers.tick(1);
    assert.equal(FakeSocket.all.length, 2);
    const s2 = sock();
    s2.close(); // never opened: next retry after 2 s
    mock.timers.tick(2000);
    assert.equal(FakeSocket.all.length, 3);
    const s3 = sock();
    s3.open();
    assert.equal(frames(s3, 'phx_join').length, 1); // rejoined
    ch.send('lost', {}); // not yet answered: dropped
    assert.equal(frames(s3, 'broadcast').length, 0);
    ackJoin(s3);
    ch.send('back', {});
    assert.equal(frames(s3, 'broadcast').length, 1);
    mock.timers.tick(25000);
    assert.equal(frames(s3, 'heartbeat').length, 1);
  } finally { mock.timers.reset(); }
});

test('an unanswered heartbeat closes the socket, then reconnects and rejoins', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { rt, ch, joined, sock } = setup();
    const s1 = sock(); s1.open(); ackJoin(s1); await joined;
    mock.timers.tick(25000); // heartbeat 1, unanswered
    assert.equal(s1.readyState, 1);
    mock.timers.tick(25000); // next tick: dead link
    assert.equal(s1.readyState, 3);
    assert.equal(FakeSocket.all.length, 1);
    mock.timers.tick(1000);
    assert.equal(FakeSocket.all.length, 2);
    const s2 = sock(); s2.open();
    assert.equal(frames(s2, 'phx_join').length, 1);
    ackJoin(s2); ch.send('ok', {});
    assert.equal(frames(s2, 'broadcast').length, 1);
    rt.close();
  } finally { mock.timers.reset(); }
});

test('a phx_error on a joined channel rejoins it after a second, and sends wait for the ack', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const { rt, ch, joined, sock } = setup();
    const s = sock(); s.open(); ackJoin(s); await joined;
    s.recv({ topic: 'realtime:match:ABC123', event: 'phx_error', payload: {}, ref: '9' });
    ch.send('lost', {}); // dropped: the channel isn't joined
    assert.equal(frames(s, 'broadcast').length, 0);
    mock.timers.tick(999);
    assert.equal(frames(s, 'phx_join').length, 1, 'not at once');
    mock.timers.tick(1);
    assert.equal(frames(s, 'phx_join').length, 2);
    ch.send('lost', {});
    assert.equal(frames(s, 'broadcast').length, 0);
    ackJoin(s);
    ch.send('back', {});
    assert.equal(frames(s, 'broadcast').length, 1);
    rt.close();
  } finally { mock.timers.reset(); }
});

test('a channel the server keeps dropping is joined again after 1, 2, 5, then every 10 s', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const { rt, joined, sock } = setup();
    const s = sock(); s.open(); ackJoin(s); await joined;
    rt.setHeartbeat(3600000); // (no heartbeat to answer in this test)
    for (const d of [1000, 2000, 5000, 10000, 10000]) {
      const n = frames(s, 'phx_join').length;
      ackJoin(s); // (joined, then at once dropped again: the ladder goes on)
      s.recv({ topic: 'realtime:match:ABC123', event: 'phx_close', payload: {}, ref: frames(s, 'phx_join').at(-1).ref });
      mock.timers.tick(d - 1);
      assert.equal(frames(s, 'phx_join').length, n, `nothing before ${d} ms`);
      mock.timers.tick(1);
      assert.equal(frames(s, 'phx_join').length, n + 1, `joined again at ${d} ms`);
    }
    // joined for half a minute, the next drop starts the ladder again
    ackJoin(s);
    mock.timers.tick(31000);
    const n = frames(s, 'phx_join').length;
    s.recv({ topic: 'realtime:match:ABC123', event: 'phx_error', payload: {}, ref: '99' });
    mock.timers.tick(1000);
    assert.equal(frames(s, 'phx_join').length, n + 1);
    rt.close();
  } finally { mock.timers.reset(); }
});

test('in a match the heartbeat is every 5 s: a dead link is dropped within 10 s, and lastHeard says when the server last spoke', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const { rt, joined, sock } = setup();
    const s1 = sock(); s1.open(); ackJoin(s1); await joined;
    const t0 = Date.now();
    assert.equal(rt.lastHeard(), t0);
    rt.setHeartbeat(5000);
    mock.timers.tick(5000);
    assert.equal(frames(s1, 'heartbeat').length, 1);
    mock.timers.tick(200); answerHb(s1);
    assert.equal(rt.lastHeard(), t0 + 5200, 'the answer counts');
    mock.timers.tick(4800);
    assert.equal(frames(s1, 'heartbeat').length, 2); // unanswered from here: the link went dead
    mock.timers.tick(4999);
    assert.equal(s1.readyState, 1);
    mock.timers.tick(1);
    assert.equal(s1.readyState, 3, 'dropped 10 s after the last answer');
    mock.timers.tick(1000);
    assert.equal(FakeSocket.all.length, 2, 'and connected again');
    const s2 = sock(); s2.open();
    mock.timers.tick(5000);
    assert.equal(frames(s2, 'heartbeat').length, 1, 'the new socket beats every 5 s too');
    rt.close();
  } finally { mock.timers.reset(); }
});

test('reconnect() drops the socket and connects again at once, rejoining every channel', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const { rt, ch, joined, sock } = setup();
    const s1 = sock(); s1.open(); ackJoin(s1); await joined;
    const other = rt.channel('match:ABC123:in');
    const j2 = other.join(); ackJoin(s1); await j2;
    rt.reconnect();
    assert.equal(s1.readyState, 3, 'the old socket closed');
    assert.equal(FakeSocket.all.length, 2, 'a new one at once');
    ch.send('gap', {}); // not joined yet: dropped
    const s2 = sock(); s2.open();
    assert.deepEqual(frames(s2, 'phx_join').map((f) => f.topic).sort(), ['realtime:match:ABC123', 'realtime:match:ABC123:in']);
    for (const f of frames(s2, 'phx_join')) s2.recv({ topic: f.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: f.ref, join_ref: f.ref });
    ch.send('back', {}); other.send('in', {});
    assert.equal(frames(s2, 'broadcast').length, 2);
    s1.recv({ topic: 'realtime:match:ABC123', event: 'broadcast', payload: { type: 'broadcast', event: 'x', payload: 1 } }); // the old socket is deaf
    mock.timers.tick(60000);
    assert.equal(FakeSocket.all.length, 2, 'no retry left over from the old socket');
    rt.close();
    rt.reconnect();
    assert.equal(FakeSocket.all.length, 2, 'nothing once closed');
  } finally { mock.timers.reset(); }
});

test('left and joined again at once, the old join\'s close is no news; the new join\'s close rejoins', async (t) => {
  // as the live server does it: the leave answered, the old join closed (ref: the old join's), the new join answered
  const { rt, ch, joined, sock } = setup();
  t.after(() => rt.close());
  const s = sock(); s.open(); ackJoin(s); await joined;
  const old = frames(s, 'phx_join').at(-1).ref;
  ch.leave();
  const again = ch.join();
  assert.equal(frames(s, 'phx_join').length, 2);
  s.recv({ topic: 'realtime:match:ABC123', event: 'phx_close', payload: {}, ref: old });
  assert.equal(frames(s, 'phx_join').length, 2, 'no join on the old close');
  ackJoin(s); await again;
  ch.send('on', {});
  assert.equal(frames(s, 'broadcast').length, 1);
  s.recv({ topic: 'realtime:match:ABC123', event: 'phx_close', payload: {}, ref: frames(s, 'phx_join').at(-1).ref });
  await new Promise((r) => setTimeout(r, 1050));
  assert.equal(frames(s, 'phx_join').length, 3, 'the current join closed: joined again (after a second)');
});

test('join rejects after 10 s without an ack, and a later ack still joins', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { rt, ch, joined, sock } = setup();
    const s = sock(); s.open();
    const failed = assert.rejects(joined, /timed out/);
    mock.timers.tick(10000);
    await failed;
    ackJoin(s);
    ch.send('late', {});
    assert.equal(frames(s, 'broadcast').length, 1);
    rt.close();
  } finally { mock.timers.reset(); }
});

test('leave settles a pending join', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { rt, ch, joined, sock } = setup();
    sock().open();
    const failed = assert.rejects(joined, /left/);
    ch.leave();
    await failed;
    rt.close();
  } finally { mock.timers.reset(); }
});

test('reconnect delays run 1, 2, 5, then every 10 s', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { sock, joined } = setup();
    joined.catch(() => {}); // it times out while the socket never answers
    const delays = [1000, 2000, 5000, 10000, 10000];
    for (const d of delays) {
      const n = FakeSocket.all.length;
      sock().close();
      mock.timers.tick(d - 1);
      assert.equal(FakeSocket.all.length, n);
      mock.timers.tick(1);
      assert.equal(FakeSocket.all.length, n + 1);
    }
  } finally { mock.timers.reset(); }
});

test('leave sends phx_leave and stops delivery', async (t) => {
  const { rt, ch, joined, sock } = setup();
  t.after(() => rt.close());
  const s = sock(); s.open(); ackJoin(s); await joined;
  const got = [];
  ch.on('x', (p) => got.push(p));
  ch.leave();
  assert.equal(frames(s, 'phx_leave').length, 1);
  s.recv({ topic: 'realtime:match:ABC123', event: 'broadcast', payload: { type: 'broadcast', event: 'x', payload: 1 } });
  assert.deepEqual(got, []);
  await tick();
});

test('the memory hub delivers between clients and honours self', async () => {
  const hub = memoryRealtime();
  const a = hub.channel('t', { self: false }), b = hub.channel('t'), c = hub.channel('other');
  const ga = [], gb = [], gc = [];
  a.on('e', (p) => ga.push(p)); b.on('e', (p) => gb.push(p)); c.on('e', (p) => gc.push(p));
  await Promise.all([a.join(), b.join(), c.join()]);
  a.send('e', { v: 1 });
  assert.deepEqual(ga, []);
  assert.deepEqual(gb, [{ v: 1 }]);
  assert.deepEqual(gc, []);
  b.leave(); a.send('e', { v: 2 });
  assert.deepEqual(gb, [{ v: 1 }]);
});

test('newCode makes six characters from the alphabet', () => {
  for (let i = 0; i < 1000; i++) assert.match(newCode(), CODE_RE);
});

test('a link\'s code is read from its address, and a malformed one is no code (not a throw: /match/% is a 404)', () => {
  assert.equal(parseCode('k7m2qz'), 'K7M2QZ');
  assert.equal(parseCode('%4B7M2QZ'), 'K7M2QZ');
  for (const bad of ['%', '%E0%A4%A', 'K7M2Q', 'K7M2QZZ', 'I0O1LZ', '']) assert.equal(parseCode(bad), null, bad);
});

