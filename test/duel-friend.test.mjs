// The friend challenge, its first part: the host's invite reported (POST /connect/log, kind 'invite'), read back for the
// invite page (GET /connect/invite, components/invite-info.tsx), a friend who raced signed out keeping the race after
// signing in (POST /connect/claim, components/duel-keep.tsx), and every 1-on-1 race on your card (components/my-duel-rating.tsx).
// Over a stand-in for Supabase. Run: node --test test/duel-friend.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { plain } from './fake-dom.mjs';

const rpc = { calls: [], data: null, error: null };
const session = { user: null };
mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
globalThis.__sb = {
  auth: { getUser: async () => ({ data: { user: session.user ? { id: session.user } : null } }) },
  rpc: async (fn, args) => { rpc.calls.push({ fn, ...args }); return { data: typeof rpc.data === 'function' ? rpc.data(fn, args) : rpc.data, error: rpc.error }; },
};
const { NextRequest } = await import('next/server');
const { POST: LOG } = await import('../app/connect/log/route.ts');
const { GET: INVITE } = await import('../app/connect/invite/route.ts');
const { POST: CLAIM } = await import('../app/connect/claim/route.ts');
const { parseReport } = await import('../lib/duel-log.ts');
const { parseInvite } = await import('../lib/duel-invite.ts');
const { InviteJoinView } = await import('../components/invite-info.tsx');
const { DuelKeepView } = await import('../components/duel-keep.tsx');
const { MyDuelRatingView } = await import('../components/my-duel-rating.tsx');
const { parseMine, whyText } = await import('../lib/duel-rating.ts');

const SITE = 'https://www.sailupdown.com';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SETTINGS = { venue: 'gocek', yacht: 'j70', preset: 'medium', length: 'short', course: 'wl', laps: 1, start: 1, current: 0, daytime: 'any' };
const INVITE_REPORT = { kind: 'invite', code: 'K7M2QZ', host: 'Alex P.', settings: SETTINGS };
const TOKEN = 'ab'.repeat(32);
let n = 0;
const req = (path, init = {}) => new NextRequest(new URL(path, SITE), { headers: { host: 'www.sailupdown.com', 'x-forwarded-for': `10.9.0.${++n}`, ...(init.headers || {}) }, ...init });
beforeEach(() => { rpc.calls = []; rpc.data = null; rpc.error = null; session.user = null; process.env.DUEL_LOG_KEY = 'k'; });

test('the host\'s invite is written with the session\'s account, never one the body names; a bad one writes nothing', async () => {
  session.user = 'u-alex';
  await LOG(req('/connect/log', { method: 'POST', body: JSON.stringify({ ...INVITE_REPORT, host_user: 'someone' }) }));
  assert.deepEqual(rpc.calls[0].p_report, { kind: 'invite', code: 'K7M2QZ', host_user: 'u-alex', host_name: 'Alex P.', venue: 'gocek', yacht: 'j70', wind: 'medium',
    length: 'short', course: 'wl', laps: 1, start_min: 1, current: false, daytime: 'any' });
  for (const bad of [{ ...INVITE_REPORT, code: 'nope' }, { ...INVITE_REPORT, host: '' }, { ...INVITE_REPORT, settings: { ...SETTINGS, venue: 'atlantis' } }, { ...INVITE_REPORT, settings: null }])
    assert.equal(parseReport(bad), null, JSON.stringify(bad));
});

const INV = { name: 'Alex P.', rating: 1558, races: 41, venue: 'gocek', yacht: 'j70', wind: 'medium', length: 'short', course: 'wl', laps: 1, start_min: 1, current: false, minutes: 7, sailed: 0 };
test('GET /connect/invite reads who is asking for that link; a bad code is asked of nobody', async () => {
  rpc.data = INV;
  const res = await INVITE(req('/connect/invite?code=K7M2QZ'));
  assert.deepEqual(rpc.calls, [{ fn: 'regatta_invite', p_code: 'K7M2QZ' }]);
  assert.equal((await res.json()).name, 'Alex P.');
  rpc.calls = [];
  assert.equal(await (await INVITE(req('/connect/invite?code=bad'))).json(), null); assert.equal(rpc.calls.length, 0);
  rpc.data = null;
  assert.equal(await (await INVITE(req('/connect/invite?code=K7M2QZ'))).json(), null, 'a link the database doesn\'t know');
});

test('an invite is read as the database gives it: a minutes figure out of reason, or a name with emoji, is cleaned', () => {
  assert.equal(parseInvite({ ...INV, minutes: 500 }).minutes, null);
  assert.equal(parseInvite({ ...INV, minutes: null }).minutes, null);
  assert.equal(parseInvite({ ...INV, name: 'Alex 😀' }).name, 'Alex');
  assert.equal(parseInvite({ ...INV, rating: '1558' }), null);
});

test('the invite page: who is asking, their level and rating, about how long, and "Race Alex P."', () => {
  const s = plain(renderToStaticMarkup(InviteJoinView({ inv: parseInvite(INV), href: '/play?match=K7M2QZ', lang: 'en' })));
  assert.match(s, /Alex P\. Fleet 1558 about 7 min Race Alex P\. No account needed/);
  const prov = plain(renderToStaticMarkup(InviteJoinView({ inv: parseInvite({ ...INV, rating: 1500, races: 0, minutes: null }), href: '/x', lang: 'en' })));
  assert.match(prov, /Alex P\. New to 1-on-1 ~1500 Race Alex P\./); assert.doesNotMatch(prov, /about/);
  const none = renderToStaticMarkup(InviteJoinView({ inv: null, href: '/play?match=K7M2QZ', lang: 'en' }));
  assert.match(plain(none), /^Join the race/); assert.match(none, /href="\/play\?match=K7M2QZ"/);
  assert.match(plain(renderToStaticMarkup(InviteJoinView({ inv: parseInvite(INV), href: '/x', lang: 'de' }))), /etwa 7 Min\. Gegen Alex P\. segeln/);
});

const claim = (body, headers = {}) => CLAIM(req('/connect/claim', { method: 'POST', body: JSON.stringify(body), headers }));
test('POST /connect/claim keeps a race for the session\'s account with the hash of the guest\'s token', async () => {
  session.user = 'u-marco'; rpc.data = true;
  const r = await claim({ code: 'K7M2QZ', seed: 11, token: TOKEN });
  assert.deepEqual(await r.json(), { kept: true });
  assert.deepEqual(rpc.calls, [{ fn: 'regatta_duel_claim', p_key: 'k', p_code: 'K7M2QZ', p_seed: 11, p_hash: sha256(TOKEN), p_user: 'u-marco' }]);
  assert.equal(JSON.stringify(rpc.calls).includes(TOKEN), false, 'the token itself never goes on');
});

test('a claim signed out, malformed, from another site, without the key, or refused keeps nothing', async () => {
  rpc.data = true;
  assert.deepEqual(await (await claim({ code: 'K7M2QZ', seed: 11, token: TOKEN })).json(), { kept: false }, 'signed out');
  session.user = 'u-marco';
  for (const bad of [{ code: 'nope', seed: 11, token: TOKEN }, { code: 'K7M2QZ', seed: -1, token: TOKEN }, { code: 'K7M2QZ', seed: 11, token: 'short' }, { code: 'K7M2QZ', seed: '11', token: TOKEN }])
    assert.deepEqual(await (await claim(bad)).json(), { kept: false }, JSON.stringify(bad));
  assert.deepEqual(await (await claim({ code: 'K7M2QZ', seed: 11, token: TOKEN }, { origin: 'https://evil.example' })).json(), { kept: false });
  assert.equal(rpc.calls.length, 0);
  delete process.env.DUEL_LOG_KEY;
  assert.deepEqual(await (await claim({ code: 'K7M2QZ', seed: 11, token: TOKEN })).json(), { kept: false });
  process.env.DUEL_LOG_KEY = 'k'; rpc.data = false;
  assert.deepEqual(await (await claim({ code: 'K7M2QZ', seed: 11, token: TOKEN })).json(), { kept: false }, 'the database refused it');
});

const keep = (o) => plain(renderToStaticMarkup(createElement(DuelKeepView, { lang: 'en', id: 'r1', signed: false, kept: 'no', won: true, rival: 'Alex P.', ...o })));
test('the result signed out: "Keep your win over Alex P.", or "Keep this race"; Google first, a code by email beside it', () => {
  assert.match(keep(), /Only on this device Keep your win over Alex P\. Sign in and it’s yours/);
  assert.match(keep(), /Your races with Alex P\., and who leads/);
  assert.match(keep(), /Continue with Google Email me a code Free · no password · ten seconds/);
  assert.match(keep({ won: false }), /Keep this race/);
  assert.match(renderToStaticMarkup(createElement(DuelKeepView, { lang: 'en', id: 'r1', signed: false, kept: 'no', won: true, rival: 'A' })), /href="\/sign-in\?next=%2Frace%2Fresult%2Fr1"/);
});
test('signed in: nothing while it\'s kept, then a line saying it\'s in your history and not the rating', () => {
  assert.equal(renderToStaticMarkup(createElement(DuelKeepView, { lang: 'en', id: 'r1', signed: true, kept: 'busy', won: true, rival: 'A' })), '');
  assert.match(keep({ signed: true, kept: 'yes' }), /Kept: this race is in your 1-on-1 history\. It was sailed signed out, so it doesn’t count for the rating\./);
  assert.match(plain(renderToStaticMarkup(createElement(DuelKeepView, { lang: 'ru', id: 'r1', signed: false, kept: 'no', won: true, rival: 'Alex' }))), /Сохрани победу над Alex/);
  assert.match(whyText('claimed', 'en'), /signed out and kept after/);
});

const MINE = { rating: 1500, races: 0, wins: 0, losses: 0, best: 1500, lowest: 1500, place: null, of: 12, changes: [], recent: [
  { at: '2026-11-21T09:10:00Z', state: 'finished', won: true, them: 'Alex P.', venue: 'gocek', yacht: 'j70', delta: null },
  { at: '2026-11-21T09:02:00Z', state: 'abandoned', won: null, them: 'Alex P.', venue: 'gocek', yacht: 'j70', delta: null },
] };
test('your card lists every 1-on-1 race: one kept after signing in reads "For fun", an abandoned one so', () => {
  const s = plain(renderToStaticMarkup(MyDuelRatingView({ mine: parseMine(MINE), lang: 'en' })));
  assert.match(s, /Not rated yet/);
  assert.match(s, /21 Nov Beat Alex P\. Göcek · J\/70 For fun/);
  assert.match(s, /21 Nov Raced Alex P\. Göcek · J\/70 Abandoned/);
  const rated = parseMine({ ...MINE, rating: 1532, races: 1, wins: 1, recent: [{ ...MINE.recent[0], delta: 32 }] });
  assert.match(plain(renderToStaticMarkup(MyDuelRatingView({ mine: rated, lang: 'en' }))), /Beat Alex P\. Göcek · J\/70 \+32/);
});
