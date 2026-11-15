// The Realtime client (public/game/net.js) against a fake socket, the in-memory hub, and the link codes.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { realtime } from '../public/game/net.js';
import { memoryRealtime } from './hub.mjs';

const { newCode, CODE_RE } = await import('../lib/code.ts');

class FakeSocket {
  static all = [];
  constructor(url) { this.url = url; this.sent = []; this.readyState = 0; FakeSocket.all.push(this); }
  send(s) { this.sent.push(JSON.parse(s)); }
  open() { this.readyState = 1; this.onopen?.({}); }
  recv(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  close() { this.readyState = 3; this.onclose?.({}); }
}
const frames = (s, event) => s.sent.filter((f) => f.event === event);
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

test('reconnect delays run 1, 2, 5, then every 10 s', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    const { sock } = setup();
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
