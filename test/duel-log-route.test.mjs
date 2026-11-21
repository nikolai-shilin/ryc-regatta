// POST /connect/log: what the game's reports of a 1-on-1 race become in the database. The route is called as Next calls
// it, through the real lib/supabase/server.ts and lib/duel-log.ts, over a stand-in for Supabase that keeps the one call
// it should make. Every answer is 204; a report that is bad, limited, from another site or lost writes nothing, and the
// account comes from the session, never from the body. Run: node --test test/duel-log-route.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const rpc = { calls: 0, args: null, error: null };
const session = { user: null, throws: false };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb;');
globalThis.__sb = {
  auth: { getUser: async () => { if (session.throws) throw new Error('session failed'); return { data: { user: session.user ? { id: session.user } : null } }; } },
  rpc: async (fn, args) => { rpc.calls++; rpc.args = { fn, ...args }; if (rpc.error === 'throw') throw new Error('db down'); return { data: null, error: rpc.error }; },
};
const { NextRequest } = await import('next/server');
const { POST } = await import('../app/connect/log/route.ts');
const { parseReport, toRow } = await import('../lib/duel-log.ts');

const SITE = 'https://www.sailupdown.com';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SETTINGS = { venue: 'cowes', yacht: 'j70', preset: 'light', length: 'short', course: 'wl', laps: 2, start: 3, current: 1, daytime: 'sunset' };
const START = { kind: 'start', code: 'K7M2QZ', seed: 4242, token: TOKEN, host: 'Anna', guest: 'Boris', settings: SETTINGS };
const JOIN = { kind: 'join', code: 'K7M2QZ', seed: 4242, name: 'Boris' };
const END = { kind: 'end', code: 'K7M2QZ', seed: 4242, token: TOKEN, state: 'finished', winner: 'host', margin: 12.5, forfeited: null, recalls: 1, prep: 'P',
  host: { place: 1, secs: 301.2, mark: null, pens: 0 }, guest: { place: 2, secs: 313.7, mark: null, pens: 1 } };

let n = 0;
// one address a call, so the limiter of one test never counts for another
const post = async (body, { user, ip = `10.0.0.${++n}`, headers = {}, raw } = {}) => {
  session.user = user ?? null;
  const res = await POST(new NextRequest(new URL('/connect/log', SITE), { method: 'POST', headers: { host: 'www.sailupdown.com', 'x-forwarded-for': ip, ...headers }, body: raw ?? JSON.stringify(body) }));
  return { status: res.status, text: await res.text() };
};

beforeEach(() => {
  rpc.calls = 0; rpc.args = null; rpc.error = null; session.user = null; session.throws = false;
  process.env.DUEL_LOG_KEY = 'k';
});

const set = (patch) => ({ ...START, settings: { ...SETTINGS, ...patch } });
const side = (patch) => ({ place: 1, secs: 300, mark: null, pens: 0, ...patch });
const BAD = [
  null, 'start', [], {}, { ...START, kind: 'other' }, { ...START, kind: undefined },
  { ...START, code: 'k7m2qz' }, { ...START, code: 'K7M2Q' }, { ...START, code: 'K7M2QO' }, { ...START, code: 'K7M2Q1' }, { ...START, code: 123456 },
  { ...START, seed: -1 }, { ...START, seed: 1.5 }, { ...START, seed: 100001 }, { ...START, seed: '4242' }, { ...START, seed: NaN }, { ...START, seed: null },
  set({ venue: 'atlantis' }), set({ yacht: 'titanic' }), set({ venue: undefined }), { ...START, settings: null },
  set({ preset: 'gale' }), set({ length: 'epic' }), set({ course: 'zigzag' }), set({ laps: 3 }), set({ laps: '2' }), set({ start: 4 }), set({ current: 2 }), set({ daytime: 'night' }),
  { ...START, token: 'abc' }, { ...START, token: 'g'.repeat(32) }, { ...START, token: 'a'.repeat(65) }, { ...START, token: undefined }, { ...START, token: 12345678901234567890123456789012 },
  { ...START, host: '' }, { ...START, host: '<>😀' }, { ...START, guest: '   ' }, { ...START, host: 42 },
  { ...JOIN, name: '' }, { ...JOIN, name: '😀😀' }, { ...JOIN, name: '<>' }, { ...JOIN, name: null }, { ...JOIN, code: 'nope' },
  { ...END, state: 'racing' }, { ...END, state: undefined },
  { ...END, winner: 'nobody' }, { ...END, winner: undefined }, { ...END, forfeited: 'both' }, { ...END, forfeited: undefined },
  { ...END, margin: -1 }, { ...END, margin: NaN }, { ...END, margin: Infinity }, { ...END, margin: '5' }, { ...END, margin: 86401 }, { ...END, margin: undefined },
  { ...END, recalls: -1 }, { ...END, recalls: 10 }, { ...END, recalls: 1.5 }, { ...END, recalls: '1' }, { ...END, recalls: NaN },
  { ...END, prep: 'X' }, { ...END, prep: 'p' }, { ...END, prep: undefined },
  { ...END, host: null }, { ...END, guest: undefined }, { ...END, host: side({ place: 0 }) }, { ...END, host: side({ place: 3 }) }, { ...END, host: side({ place: 1.5 }) }, { ...END, guest: side({ place: '1' }) },
  { ...END, host: side({ mark: 'OCS' }) }, { ...END, host: side({ mark: undefined }) },
  { ...END, host: side({ secs: -1 }) }, { ...END, host: side({ secs: NaN }) }, { ...END, guest: side({ secs: Infinity }) }, { ...END, guest: side({ secs: '300' }) }, { ...END, host: side({ secs: 86401 }) },
  { ...END, host: side({ pens: -1 }) }, { ...END, host: side({ pens: 100 }) }, { ...END, guest: side({ pens: 0.5 }) }, { ...END, guest: side({ pens: '0' }) }, { ...END, guest: side({ pens: NaN }) },
  { ...END, token: 'zz' },
  { ...END, side: 'both' }, { ...END, side: 'Guest' }, { ...END, gun: 1 }, { ...END, gun: 'yes' },
  { ...END, left: 'both' }, { ...END, left: 1 }, { ...END, left: 'Host' },
  { ...JOIN, token: 'abc' }, { ...JOIN, token: 42 }, { ...JOIN, token: 'g'.repeat(32) },
];

test('a good start is written with the account from the session, never from the body', async () => {
  const sent = await post({ ...START, host_user: 'someone-else', hostUser: 'someone-else' }, { user: 'u-1' });
  assert.equal(sent.status, 204); assert.equal(sent.text, '');
  assert.equal(rpc.calls, 1); assert.equal(rpc.args.fn, 'regatta_duel_log'); assert.equal(rpc.args.p_key, 'k');
  assert.equal(rpc.args.p_report.host_user, 'u-1');
  assert.equal(rpc.args.p_report.write_hash, sha256(START.token));
  assert.equal(JSON.stringify(rpc.args).includes(START.token), false, 'the token itself never goes on');
  assert.deepEqual(rpc.args.p_report, { kind: 'start', code: 'K7M2QZ', seed: 4242, write_hash: sha256(TOKEN), host_user: 'u-1', host_name: 'Anna', guest_name: 'Boris', venue: 'cowes', yacht: 'j70',
    wind: 'light', length: 'short', course: 'wl', laps: 2, start_min: 3, current: true, daytime: 'sunset' });
});
test('a join is written with the guest as the session names her; a body naming an account changes nothing', async () => {
  await post({ ...JOIN, guest_user: 'someone-else' }, { user: 'u-2' });
  assert.deepEqual(rpc.args.p_report, { kind: 'join', code: 'K7M2QZ', seed: 4242, guest_user: 'u-2', guest_name: 'Boris', guest_hash: null });
});
test('a join with the guest\'s own token is written with its hash, never the token', async () => {
  const mine = 'f'.repeat(64);
  await post({ ...JOIN, token: mine }, { user: 'u-2' });
  assert.equal(rpc.args.p_report.guest_hash, sha256(mine));
  assert.equal(JSON.stringify(rpc.args).includes(mine), false);
});
test('the guest\'s end is written as her side, with the hash of her token; a host\'s end from an older build is the host\'s', async () => {
  const mine = 'e'.repeat(64);
  await post({ ...END, token: mine, side: 'guest', gun: true });
  assert.deepEqual([rpc.args.p_report.side, rpc.args.p_report.write_hash, rpc.args.p_report.gun], ['guest', sha256(mine), true]);
  await post(END);
  assert.deepEqual([rpc.args.p_report.side, rpc.args.p_report.gun], ['host', null]);
  await post({ ...END, side: 'host', gun: false });
  assert.deepEqual([rpc.args.p_report.side, rpc.args.p_report.gun], ['host', false]);
  await post({ ...END, state: 'abandoned', winner: null, margin: null, gun: true, left: 'host' });
  assert.deepEqual([rpc.args.p_report.state, rpc.args.p_report.gun, rpc.args.p_report.left], ['abandoned', true, 'host'], 'who left goes on as sent');
  await post({ ...END, token: 'e'.repeat(64), side: 'guest', winner: 'host', forfeited: 'guest', left: 'guest' });
  assert.equal(rpc.args.p_report.left, 'guest');
});
test('no session is a guest', async () => {
  await post(JOIN, { user: null });
  assert.equal(rpc.calls, 1); assert.equal(rpc.args.p_report.guest_user, null);
  await post(START, { user: null });
  assert.equal(rpc.args.p_report.host_user, null);
});
test('a session that fails to load is a guest, and the report is still written', async () => {
  session.throws = true;
  const sent = await post(JOIN);
  assert.equal(sent.status, 204); assert.equal(rpc.calls, 1); assert.equal(rpc.args.p_report.guest_user, null); assert.equal(rpc.args.p_report.guest_name, 'Boris');
});
test('an end is written with the hash of its token, the results as sent, and no account', async () => {
  session.throws = true; // an end never asks who is signed in
  await post({ ...END, host_user: 'x' }, { user: 'u-1' });
  assert.equal(rpc.calls, 1);
  assert.deepEqual(rpc.args.p_report, { kind: 'end', side: 'host', code: 'K7M2QZ', seed: 4242, write_hash: sha256(TOKEN), state: 'finished', winner: 'host', margin: 12.5, forfeited: null, recalls: 1, prep_flag: 'P',
    gun: null, left: null, host: { place: 1, secs: 301.2, mark: null, pens: 0 }, guest: { place: 2, secs: 313.7, mark: null, pens: 1 } });
  assert.equal(JSON.stringify(rpc.args).includes(TOKEN), false);
});
test('an end with nobody home: no winner, no times, a mark, no margin, is kept', async () => {
  const end = { ...END, state: 'abandoned', winner: null, margin: null, forfeited: 'guest', recalls: 0, prep: 'U', host: { place: null, secs: null, mark: 'DNF', pens: 0 }, guest: { place: null, secs: null, mark: 'DSQ', pens: 99 } };
  await post(end);
  assert.equal(rpc.calls, 1);
  assert.deepEqual(rpc.args.p_report.host, { place: null, secs: null, mark: 'DNF', pens: 0 }); assert.deepEqual(rpc.args.p_report.guest, { place: null, secs: null, mark: 'DSQ', pens: 99 });
  assert.equal(rpc.args.p_report.margin, null); assert.equal(rpc.args.p_report.forfeited, 'guest'); assert.equal(rpc.args.p_report.state, 'abandoned');
});
test('an abandoned end from a reloaded host, with nothing to read, is written with its nulls', async () => {
  const none = { place: null, secs: null, mark: null, pens: null };
  const sent = await post({ ...END, state: 'abandoned', prep: null, recalls: null, winner: null, margin: null, forfeited: null, host: none, guest: { ...none } });
  assert.equal(sent.status, 204); assert.equal(rpc.calls, 1);
  assert.deepEqual(rpc.args.p_report, { kind: 'end', side: 'host', code: 'K7M2QZ', seed: 4242, write_hash: sha256(TOKEN), state: 'abandoned', winner: null, margin: null, forfeited: null, recalls: null, prep_flag: null, gun: null, left: null, host: none, guest: none });
});
test('every range is kept at its edges', async () => {
  for (const [venue, yacht] of [['gocek', 'jclass'], ['auckland', 'optimist']]) {
    const sent = await post({ ...START, seed: 100000, token: 'F'.repeat(64), settings: { ...SETTINGS, venue, yacht, laps: 1, start: 5, current: 0, daytime: 'any', preset: 'strong', length: 'long', course: 'wlu' } });
    assert.equal(sent.status, 204); assert.equal(rpc.args.p_report.current, false); assert.equal(rpc.args.p_report.seed, 100000);
  }
  rpc.calls = 0;
  await post({ ...END, margin: 86400, recalls: 9, prep: 'B', host: side({ secs: 0, pens: 99 }), guest: side({ place: 2, secs: 86400 }) });
  assert.equal(rpc.calls, 1);
});
// JSON carries NaN and Infinity as null, so over the wire they are not those numbers: parseReport alone is tried with them
const loose = (v) => typeof v === 'number' ? !Number.isFinite(v) : v && typeof v === 'object' && Object.values(v).some(loose);
test('each bad report is dropped with a 204 and writes nothing', async () => {
  for (const bad of BAD.filter((b) => !loose(b))) { rpc.calls = 0; assert.equal((await post(bad)).status, 204); assert.equal(rpc.calls, 0, JSON.stringify(bad)); }
});
test('parseReport answers null for each bad report, and a report for each good one', () => {
  for (const bad of BAD) assert.equal(parseReport(bad), null, JSON.stringify(bad));
  for (const good of [START, JOIN, END]) assert.equal(parseReport(good)?.kind, good.kind);
  assert.equal(parseReport({ ...START, extra: 1 }).extra, undefined, 'only what is known is kept');
  assert.equal(toRow(parseReport(START), null, null).host_user, null);
});
test('a name is cleaned: no markup, no emoji, 16 characters at most', async () => {
  await post({ ...JOIN, name: '<b>Анна😀</b>' + 'x'.repeat(500) });
  const name = rpc.args.p_report.guest_name;
  assert.doesNotMatch(name, /[<>😀]/); assert.ok(name.length <= 16); assert.equal(name, 'bАнна/b' + 'x'.repeat(9));
});
test('a name loses control characters and runs of spaces, and is cut without splitting a character', async () => {
  await post({ ...JOIN, name: '  Anna\u0000\n\t  Smith 👨‍👩‍👧 ' });
  assert.equal(rpc.args.p_report.guest_name, 'Anna Smith');
  await post({ ...JOIN, name: '𝒜'.repeat(40) }); // astral letters: two UTF-16 units each
  const cut = rpc.args.p_report.guest_name;
  assert.equal([...cut].length, 16); assert.equal(JSON.stringify(cut).includes('\\ud'), false, 'no lone half of a pair');
  await post({ ...START, host: 'Анна', guest: 'Bob 🇬🇧' });
  assert.equal(rpc.args.p_report.host_name, 'Анна'); assert.equal(rpc.args.p_report.guest_name, 'Bob');
});
test('the 61st report from an address in ten minutes is dropped', async () => {
  const ip = '203.0.113.7';
  for (let i = 1; i <= 60; i++) { rpc.calls = 0; assert.equal((await post(JOIN, { ip })).status, 204); assert.equal(rpc.calls, 1, `report ${i}`); }
  rpc.calls = 0;
  assert.equal((await post(JOIN, { ip })).status, 204); assert.equal(rpc.calls, 0, 'the 61st');
  assert.equal((await post(JOIN, { ip: '203.0.113.8' })).status, 204); assert.equal(rpc.calls, 1, 'another address is not limited');
  rpc.calls = 0;
  await post(JOIN, { ip: '203.0.113.9, 10.1.1.1' }); await post(JOIN, { ip: '203.0.113.9, 10.2.2.2' });
  assert.equal(rpc.calls, 2, 'the first value of x-forwarded-for is the address');
});
test('with no DUEL_LOG_KEY nothing is written and the answer is 204', async () => {
  delete process.env.DUEL_LOG_KEY;
  assert.equal((await post(START)).status, 204); assert.equal(rpc.calls, 0);
  process.env.DUEL_LOG_KEY = '';
  assert.equal((await post(START)).status, 204); assert.equal(rpc.calls, 0);
});
test('a database failure is a 204', async () => {
  rpc.error = 'throw';
  assert.equal((await post(START)).status, 204); assert.equal(rpc.calls, 1);
  rpc.error = { message: 'permission denied', code: '42501' }; // an answer with an error, not a throw
  assert.equal((await post(END)).status, 204); assert.equal(rpc.calls, 1 + 1);
});
test('a body that is not JSON, or larger than 4 KB, is a 204 and writes nothing', async () => {
  for (const raw of ['', 'not json', '{"kind":', 'null', '"start"']) { assert.equal((await post(null, { raw })).status, 204); }
  const big = JSON.stringify({ ...JOIN, pad: 'x'.repeat(4100) });
  assert.ok(big.length > 4096);
  assert.equal((await post(null, { raw: big })).status, 204);
  assert.equal((await post(null, { raw: big, headers: { 'content-length': String(big.length) } })).status, 204);
  assert.equal((await post(null, { raw: JSON.stringify({ ...JOIN, name: 'é'.repeat(16), pad: 'é'.repeat(2100) }) })).status, 204, 'bytes, not characters');
  assert.equal(rpc.calls, 0);
  const small = JSON.stringify({ ...JOIN, pad: 'x'.repeat(3000) });
  await post(null, { raw: small }); assert.equal(rpc.calls, 1, 'under 4 KB is read');
});
test('another site\'s Origin is refused with a 204 and writes nothing', async () => {
  assert.equal((await post(START, { headers: { origin: 'https://evil.example' } })).status, 204);
  assert.equal((await post(START, { headers: { origin: 'https://www.sailupdown.com.evil.example' } })).status, 204);
  assert.equal((await post(START, { headers: { origin: 'not a url' } })).status, 204);
  assert.equal(rpc.calls, 0);
  assert.equal((await post(START, { headers: { origin: SITE } })).status, 204); assert.equal(rpc.calls, 1, 'this site\'s own Origin is let through');
  await post(START); assert.equal(rpc.calls, 2, 'no Origin (same-origin fetch from an older browser) is let through');
});
test('the counters clear themselves when they grow past 5,000 addresses', async () => {
  const ip = '198.51.100.1';
  for (let i = 0; i < 60; i++) await post(JOIN, { ip });
  rpc.calls = 0; await post(JOIN, { ip }); assert.equal(rpc.calls, 0, 'limited');
  for (let i = 0; i < 5001; i++) await post({}, { ip: `172.16.${i >> 8}.${i & 255}` });
  rpc.calls = 0; await post(JOIN, { ip }); assert.equal(rpc.calls, 1, 'forgotten once the map was cleared');
});

// ---------- what the server says of a failure (the code only, never the report, the key or a token) ----------
const heard = async (fn) => {
  const logs = [], was = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  console.error = (...a) => logs.push(['error', a]); console.warn = (...a) => logs.push(['warn', a]);
  console.log = (...a) => logs.push(['log', a]); console.info = (...a) => logs.push(['info', a]);
  try { await fn(); } finally { Object.assign(console, was); }
  return logs;
};
const everything = (logs) => JSON.stringify(logs, (k, v) => (v instanceof Error ? { m: v.message, s: v.stack, c: v.code } : v));
test('a missing key says nothing outside production, and once on a production instance', async () => {
  delete process.env.DUEL_LOG_KEY;
  delete process.env.VERCEL_ENV;
  assert.deepEqual(await heard(async () => { await post(START); await post(START); }), [], 'not production: silent');
  process.env.VERCEL_ENV = 'preview';
  assert.deepEqual(await heard(() => post(START)), [], 'a preview is not production');
  process.env.VERCEL_ENV = 'production';
  let res;
  const logs = await heard(async () => { res = [await post(START), await post(END), await post(JOIN)]; });
  assert.deepEqual(res.map((r) => r.status), [204, 204, 204]);
  assert.equal(rpc.calls, 0);
  assert.equal(logs.length, 1, 'one warning for the instance');
  assert.equal(logs[0][0], 'warn');
  assert.match(String(logs[0][1][0]), /duel-log/);
  assert.match(String(logs[0][1][0]), /DUEL_LOG_KEY/);
  delete process.env.VERCEL_ENV;
});
test('a database that answers with an error is logged by its code alone, and is still a 204', async () => {
  process.env.DUEL_LOG_KEY = 'SECRET-KEY-VALUE';
  rpc.error = { code: '42501', message: `permission denied for ${TOKEN} SECRET-KEY-VALUE Anna Boris` };
  let res;
  const logs = await heard(async () => { res = await post(START, { user: 'u-anna' }); });
  assert.equal(res.status, 204);
  assert.deepEqual(logs, [['error', ['duel-log', '42501']]]);
});
test('a database that throws is logged without its message, and is still a 204', async () => {
  process.env.DUEL_LOG_KEY = 'SECRET-KEY-VALUE';
  rpc.error = 'throw';
  let res;
  const logs = await heard(async () => { res = await post(START); });
  assert.equal(res.status, 204);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'error');
  assert.equal(logs[0][1][0], 'duel-log');
  assert.equal(logs[0][1].length, 2);
  assert.equal(typeof logs[0][1][1], 'string');
  assert.doesNotMatch(everything(logs), /db down/);
});
test('nothing logged ever holds the key, a token, a hash of it or a name', async () => {
  process.env.DUEL_LOG_KEY = 'SECRET-KEY-VALUE';
  const bodies = [START, JOIN, END];
  const logs = [];
  for (const error of [{ code: '42501', message: `bad ${TOKEN} SECRET-KEY-VALUE Anna Boris` }, 'throw', { message: 'no code SECRET-KEY-VALUE Anna' }, { code: `${TOKEN} Anna` }]) {
    rpc.error = error;
    for (const b of bodies) logs.push(...await heard(() => post(b, { user: 'u-anna' })));
  }
  assert.ok(logs.length >= 12, 'every failure is told');
  const all = everything(logs);
  for (const secret of ['SECRET-KEY-VALUE', TOKEN, sha256(TOKEN), 'Anna', 'Boris', 'u-anna', 'permission denied']) assert.ok(!all.includes(secret), `no ${secret} in the logs`);
});

// ---------- how the race ran on a screen ----------
const PERF = { fps: 30.3, low: 19.6, stall: 2.13, secs: 282, q0: 'low', q: 'low', gfx: 'auto', saver: 0, rs: 0.8, dev: 'desktop', tg: 0, os: 'windows', br: 'chrome', dpr: 1.25,
  cores: 4, mem: 8, gpu: 'Intel(R) UHD Graphics', w: 1536, h: 703, load: 7.9, net: { rtt: 98, late: 0.4 } };
const PERFR = { kind: 'perf', code: 'K7M2QZ', seed: 4242, side: 'host', perf: PERF };

test('a screen\'s perf is written for its side, with no account and no token, its fields as sent', async () => {
  assert.equal((await post(PERFR, { user: 'u-1' })).status, 204);
  assert.equal(rpc.calls, 1);
  const { load, ...kept } = PERF; // (the page's load time isn't the race's)
  assert.deepEqual(rpc.args, { fn: 'regatta_duel_log', p_key: 'k', p_report: { kind: 'perf', code: 'K7M2QZ', seed: 4242, side: 'host', perf: kept } });
  await post({ ...PERFR, side: 'guest', perf: { ...PERF, net: { rtt: null, late: 0 } } });
  assert.equal(rpc.args.p_report.side, 'guest');
  assert.deepEqual(rpc.args.p_report.perf.net, { rtt: null, late: 0 });
});

test('a perf with a bad side, fps or secs is dropped; any other bad field is kept as null, and unknown ones go', async () => {
  for (const bad of [{ ...PERFR, side: 'both' }, { ...PERFR, side: undefined }, { ...PERFR, perf: null }, { ...PERFR, perf: [] }, { ...PERFR, perf: { ...PERF, fps: -1 } },
    { ...PERFR, perf: { ...PERF, fps: '30' } }, { ...PERFR, perf: { ...PERF, fps: NaN } }, { ...PERFR, perf: { ...PERF, secs: 1.5 } }, { ...PERFR, perf: { ...PERF, secs: undefined } },
    { ...PERFR, seed: -1 }, { ...PERFR, code: 'nope' }]) assert.equal(parseReport(bad), null, JSON.stringify(bad));
  const r = parseReport({ ...PERFR, perf: { ...PERF, low: -3, stall: 'many', q: 'ultra', gfx: 'turbo', rs: 3, dev: 'fridge', os: '<script>', br: 'a'.repeat(17), dpr: 99, cores: 0.5, mem: -1,
    gpu: 'GPU <img src=x>', w: 0, h: 1e9, saver: 'yes', tg: 2, net: { rtt: -5, late: 'x' }, extra: 'dropped' } });
  assert.deepEqual(r.perf, { fps: 30.3, low: null, stall: null, secs: 282, q0: 'low', q: null, gfx: null, saver: 0, rs: null, dev: null, tg: 0, os: null, br: null, dpr: null,
    cores: null, mem: null, gpu: null, w: null, h: null, net: { rtt: null, late: null } });
  assert.equal(parseReport({ ...PERFR, perf: { ...PERF, net: 'fast' } }).perf.net, null);
  assert.deepEqual(toRow(parseReport(PERFR), 'u-1', 'h'), { kind: 'perf', code: 'K7M2QZ', seed: 4242, side: 'host', perf: parseReport(PERFR).perf });
});
