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
  { ...END, recalls: -1 }, { ...END, recalls: 10 }, { ...END, recalls: 1.5 }, { ...END, recalls: '1' }, { ...END, recalls: NaN }, { ...END, recalls: null },
  { ...END, prep: 'X' }, { ...END, prep: 'p' }, { ...END, prep: null }, { ...END, prep: undefined },
  { ...END, host: null }, { ...END, guest: undefined }, { ...END, host: side({ place: 0 }) }, { ...END, host: side({ place: 3 }) }, { ...END, host: side({ place: 1.5 }) }, { ...END, guest: side({ place: '1' }) },
  { ...END, host: side({ mark: 'OCS' }) }, { ...END, host: side({ mark: undefined }) },
  { ...END, host: side({ secs: -1 }) }, { ...END, host: side({ secs: NaN }) }, { ...END, guest: side({ secs: Infinity }) }, { ...END, guest: side({ secs: '300' }) }, { ...END, host: side({ secs: 86401 }) },
  { ...END, host: side({ pens: -1 }) }, { ...END, host: side({ pens: 100 }) }, { ...END, guest: side({ pens: 0.5 }) }, { ...END, guest: side({ pens: '0' }) }, { ...END, guest: side({ pens: NaN }) },
  { ...END, token: 'zz' },
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
  assert.deepEqual(rpc.args.p_report, { kind: 'join', code: 'K7M2QZ', seed: 4242, guest_user: 'u-2', guest_name: 'Boris' });
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
  assert.deepEqual(rpc.args.p_report, { kind: 'end', code: 'K7M2QZ', seed: 4242, write_hash: sha256(TOKEN), state: 'finished', winner: 'host', margin: 12.5, forfeited: null, recalls: 1, prep_flag: 'P',
    host: { place: 1, secs: 301.2, mark: null, pens: 0 }, guest: { place: 2, secs: 313.7, mark: null, pens: 1 } });
  assert.equal(JSON.stringify(rpc.args).includes(TOKEN), false);
});
test('an end with nobody home: no winner, no times, a mark, no margin, is kept', async () => {
  const end = { ...END, state: 'abandoned', winner: null, margin: null, forfeited: 'guest', recalls: 0, prep: 'U', host: { place: null, secs: null, mark: 'DNF', pens: 0 }, guest: { place: null, secs: null, mark: 'DSQ', pens: 99 } };
  await post(end);
  assert.equal(rpc.calls, 1);
  assert.deepEqual(rpc.args.p_report.host, { place: null, secs: null, mark: 'DNF', pens: 0 }); assert.deepEqual(rpc.args.p_report.guest, { place: null, secs: null, mark: 'DSQ', pens: 99 });
  assert.equal(rpc.args.p_report.margin, null); assert.equal(rpc.args.p_report.forfeited, 'guest'); assert.equal(rpc.args.p_report.state, 'abandoned');
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
