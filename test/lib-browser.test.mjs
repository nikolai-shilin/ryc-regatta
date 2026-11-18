// The site's code that runs in the reader's browser, on a small stand-in for it: the settings shared with the game
// (lib/opts.ts), sharing a link (lib/share.ts), the daily reminder's subscription (lib/push.ts), what the log and the
// boat keep on the device (lib/log.ts, lib/boat.ts), and the analytics queue (lib/track.ts).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';

// a page's localStorage; `full` makes it refuse to write, `blocked` to be read at all
class Store {
  m = new Map(); full = false; blocked = false;
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { if (this.blocked) throw new Error('blocked'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.full) throw new Error('full'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
let ls;
beforeEach(() => { ls = new Store(); set('localStorage', ls); set('window', undefined); set('navigator', { userAgent: 'Desktop' }); });

const { readOpts, saveOpts, readPb, songNow, DEFAULTS, OPTS_EVENT, SONGS } = await import('../lib/opts.ts');
const { tagged, shareHref, canSms, openShare, copyText, nativeShare, SHARE_TARGETS } = await import('../lib/share.ts');
const { harvest, keptResults, readLog, saveLog, LOG_KEY, shiftDay, passport } = await import('../lib/log.ts');
const { readBoat, saveBoat, DEFAULT_BOAT, BOAT_KEY } = await import('../lib/boat.ts');
const { fmtDistance, plannedCourse } = await import('../lib/race.ts');
const push = await import('../lib/push.ts');

// ---------- the settings ----------
const save = (o) => ls.setItem('regatta', JSON.stringify(o));

test('a new player has the defaults', () => {
  assert.deepEqual(readOpts(), DEFAULTS);
});

test('the settings saved are read back over the defaults, marked as current', () => {
  save({ musicV: 2, ghostV: 1, fleet: 7, venue: 'palma', fleetV: 1, optsV: 1 });
  const o = readOpts();
  assert.equal(o.fleet, 7); assert.equal(o.venue, 'palma'); assert.equal(o.sound, DEFAULTS.sound);
  assert.equal(o.fleetV, 3); assert.equal(o.optsV, 4);
});

test('the music chosen before the playlist came is moved to it, once; after that it stays theirs', () => {
  save({ music: 'groove' });
  assert.equal(readOpts().music, 'playlist');
  save({ music: 'groove', musicV: 2 });
  assert.equal(readOpts().music, 'groove');
  save({ music: 'off', musicV: 2 });
  assert.equal(readOpts().music, 'off');
});

test('a style of music that\'s gone falls back to the playlist', () => {
  save({ music: 'ambient', musicV: 2 });
  assert.equal(readOpts().music, 'playlist');
});

test('the ghost is off unless the player chose it since it became a choice', () => {
  save({ ghost: 1 });
  assert.equal(readOpts().ghost, 0);
  save({ ghost: 1, ghostV: 1 });
  assert.equal(readOpts().ghost, 1);
});

test('junk an older game wrote is dropped', () => {
  save({ undefined: 1 });
  assert.equal('undefined' in readOpts(), false);
});

test('broken or blocked settings are the defaults, not a crash', () => {
  ls.setItem('regatta', '{broken');
  assert.deepEqual(readOpts(), DEFAULTS);
  ls.blocked = true;
  assert.deepEqual(readOpts(), DEFAULTS);
});

test('saving keeps the rest of the settings and tells the page', () => {
  const heard = [];
  set('window', { dispatchEvent: (e) => heard.push(e.type) });
  save({ fleet: 7, musicV: 2, ghostV: 1 });
  const next = saveOpts({ sound: 0 });
  assert.equal(next.fleet, 7); assert.equal(next.sound, 0);
  assert.equal(JSON.parse(ls.getItem('regatta')).sound, 0);
  assert.deepEqual(heard, [OPTS_EVENT]);
});

test('settings that can\'t be stored are still returned', () => {
  ls.full = true;
  assert.equal(saveOpts({ sound: 0 }).sound, 0);
});

test('the song coming up wraps round the playlist, whatever is stored', () => {
  const at = (v) => { ls.setItem('regatta-song', v); return songNow(); };
  assert.equal(songNow(), 0);
  assert.equal(at('1'), 1);
  assert.equal(at(String(SONGS.length)), 0);
  assert.equal(at('-1'), SONGS.length - 1);
  assert.equal(at('junk'), 0);
  ls.blocked = true;
  assert.equal(songNow(), 0);
});

test('the personal bests are read, or there are none', () => {
  assert.deepEqual(readPb(), {});
  ls.setItem('regatta-pb', '{"daily|2026-11-10":200}');
  assert.deepEqual(readPb(), { 'daily|2026-11-10': 200 });
  ls.setItem('regatta-pb', '{broken');
  assert.deepEqual(readPb(), {});
});

// ---------- sharing ----------
const data = { url: 'https://www.sailupdown.com/race?utm_medium=share', text: 'Beat me & win', title: 'My race' };
const link = (target) => encodeURIComponent(`https://www.sailupdown.com/race?utm_medium=share&utm_source=${target}`);

test('a shared link says which app it went to, and keeps what it had', () => {
  assert.equal(tagged(data.url, 'x'), 'https://www.sailupdown.com/race?utm_medium=share&utm_source=x');
  assert.equal(tagged('https://a.test/?utm_source=old', 'x'), 'https://a.test/?utm_source=x');
  assert.equal(tagged('not a url', 'x'), 'not a url');
});

test('each app is given the link and the line in the way it reads them', () => {
  const text = encodeURIComponent('Beat me & win');
  assert.equal(shareHref('telegram', data), `https://t.me/share/url?url=${link('telegram')}&text=${text}`);
  assert.equal(shareHref('facebook', data), `https://www.facebook.com/sharer/sharer.php?u=${link('facebook')}`);
  assert.equal(shareHref('x', data), `https://x.com/intent/post?text=${text}&url=${link('x')}`);
  assert.equal(shareHref('vk', data), `https://vk.com/share.php?url=${link('vk')}&title=${text}`);
  assert.equal(shareHref('linkedin', data), `https://www.linkedin.com/sharing/share-offsite/?url=${link('linkedin')}`);
});

test('WhatsApp and SMS take one message: the line, then the link', () => {
  const msg = (t) => encodeURIComponent(`Beat me & win ${decodeURIComponent(link(t))}`);
  assert.equal(shareHref('whatsapp', data), `https://wa.me/?text=${msg('whatsapp')}`);
  assert.equal(shareHref('sms', data), `sms:?&body=${msg('sms')}`);
});

test('an email has the title for its subject, or else the line', () => {
  assert.ok(shareHref('email', data).startsWith(`mailto:?subject=${encodeURIComponent('My race')}&body=`));
  assert.ok(shareHref('email', { url: data.url, text: 'Line' }).startsWith('mailto:?subject=Line&body='));
  assert.ok(decodeURIComponent(shareHref('email', data)).includes('Beat me & win\n\nhttps://'));
});

test('every app on the share sheet has its address', () => {
  assert.equal(new Set(SHARE_TARGETS.map((t) => t.id)).size, SHARE_TARGETS.length);
  for (const t of SHARE_TARGETS) assert.match(shareHref(t.id, data), /^(https:|mailto:|sms:)/, t.id);
});

test('SMS is offered only where there\'s a phone', () => {
  assert.equal(canSms(), false);
  set('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
  assert.equal(canSms(), true);
  set('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
  assert.equal(canSms(), true);
  set('navigator', undefined);
  assert.equal(canSms(), false);
});

test('on an ordinary page the browser follows the link itself', () => {
  assert.equal(openShare('x', data), false);
  set('window', { Telegram: { WebApp: { initData: '' } } });
  assert.equal(openShare('x', data), false, 'Telegram\'s script on a page outside Telegram');
});

test('inside Telegram its own links stay in Telegram and the rest open through it', () => {
  const opened = [];
  set('window', { Telegram: { WebApp: { initData: 'x', openTelegramLink: (u) => opened.push(['tg', u]), openLink: (u) => opened.push(['web', u]) } } });
  assert.equal(openShare('telegram', data), true);
  assert.equal(openShare('x', data), true);
  assert.deepEqual(opened.map((o) => o[0]), ['tg', 'web']);
});

test('inside Telegram an email or SMS goes by the address', () => {
  set('window', { Telegram: { WebApp: { initData: 'x', openLink: () => assert.fail('not a web link') } } });
  set('location', { href: '' });
  assert.equal(openShare('email', data), true);
  assert.match(location.href, /^mailto:/);
});

test('copying uses the clipboard', async () => {
  let got = null;
  set('navigator', { clipboard: { writeText: async (s) => { got = s; } } });
  assert.equal(await copyText('line'), true);
  assert.equal(got, 'line');
});

function oldCopy(result) {
  const f = { style: {}, setAttribute() {}, select() { f.selected = true; }, remove() { f.removed = true; } };
  set('navigator', {});
  set('document', { createElement: () => f, body: { append: () => { f.added = true; } }, execCommand: (c) => { if (result instanceof Error) throw result; f.cmd = c; return result; } });
  return f;
}

test('with no clipboard, copying goes through a selected field that is taken away after', async () => {
  const f = oldCopy(true);
  assert.equal(await copyText('line'), true);
  assert.equal(f.value, 'line'); assert.equal(f.cmd, 'copy'); assert.ok(f.selected); assert.ok(f.removed);
});

test('a copy the browser refuses says so, and still clears its field', async () => {
  oldCopy(false);
  assert.equal(await copyText('line'), false);
  const f = oldCopy(new Error('denied'));
  assert.equal(await copyText('line'), false);
  assert.ok(f.removed);
});

test('the phone\'s own share sheet: shared, closed, failed or missing', async () => {
  assert.equal(await nativeShare(data), false, 'there is none');
  set('navigator', undefined);
  assert.equal(await nativeShare(data), false);
  let got;
  set('navigator', { share: async (o) => { got = o; } });
  assert.equal(await nativeShare(data), true);
  assert.match(got.url, /utm_source=native/); assert.equal(got.title, 'My race');
  set('navigator', { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } });
  assert.equal(await nativeShare(data), null);
  set('navigator', { share: async () => { throw new Error('failed'); } });
  assert.equal(await nativeShare(data), false);
});

// ---------- what the log keeps on the device ----------
const result = (o) => ({ at: Date.UTC(2026, 10, 10), venue: 'palma', daily: null, boats: [{ me: true, done: true, dsq: false, secs: 200 }], ...o });

test('the log gathers the week\'s bests and the results the game keeps, and saves them', () => {
  ls.setItem('regatta-pb', JSON.stringify({ 'daily|2026-11-10': 210, 'light|1|short|5': 100, 'daily|2026-11-11': 'junk' }));
  ls.setItem('regatta-result-1', JSON.stringify(result({ daily: '2026-11-09' })));
  ls.setItem('regatta-other', JSON.stringify(result({ daily: '2026-11-08' })));
  const l = harvest();
  assert.deepEqual(Object.keys(l.d).sort(), ['2026-11-09', '2026-11-10']);
  assert.equal(l.v.palma, Date.UTC(2026, 10, 10));
  assert.deepEqual(readLog(), l);
});

test('a harvest that finds nothing new doesn\'t write', () => {
  saveLog({ d: { '2026-11-10': 200 }, v: {} });
  let writes = 0; const real = ls.setItem.bind(ls); ls.setItem = (k, v) => { writes++; real(k, v); };
  harvest(); harvest();
  assert.equal(writes, 0);
});

test('an older, slower best never replaces a faster one', () => {
  saveLog({ d: { '2026-11-10': 190 }, v: {} });
  ls.setItem('regatta-pb', JSON.stringify({ 'daily|2026-11-10': 210 }));
  assert.equal(harvest().d['2026-11-10'], 190);
});

test('a broken log or broken records are left out', () => {
  ls.setItem(LOG_KEY, '{broken');
  ls.setItem('regatta-pb', '"junk"');
  ls.setItem('regatta-result-1', '{broken');
  assert.deepEqual(harvest(), { d: {}, v: {} });
});

test('a log that can\'t be saved is still read', () => {
  ls.setItem('regatta-pb', JSON.stringify({ 'daily|2026-11-10': 210 }));
  ls.full = true;
  assert.equal(harvest().d['2026-11-10'], 210);
});

test('the results kept are only those with boats', () => {
  ls.setItem('regatta-result-1', JSON.stringify(result({})));
  ls.setItem('regatta-result-2', JSON.stringify({ at: 1 }));
  ls.setItem('regatta-result-3', '{broken');
  ls.setItem('regatta-pb', JSON.stringify({ boats: [] }));
  assert.equal(keptResults().length, 1);
});

test('a storage that can\'t be walked leaves no results', () => {
  Object.defineProperty(ls, 'length', { get() { throw new Error('blocked'); } });
  assert.deepEqual(keptResults(), []);
});

test('days are counted in UTC, across a month\'s end', () => {
  assert.equal(shiftDay('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
});

test('the passport counts the venues raced, of all of them', () => {
  const p = passport({ d: {}, v: { palma: 1, gocek: 2 } });
  assert.equal(p.n, 2); assert.ok(p.raced.has('palma')); assert.ok(p.of >= 2);
});

// ---------- the boat kept on the device ----------
test('a new player has the default boat, and it is a copy', () => {
  const b = readBoat();
  assert.deepEqual(b, DEFAULT_BOAT);
  b.hull = 'changed';
  assert.notEqual(readBoat().hull, 'changed');
});

test('a boat is saved with the time it was changed, and read back', () => {
  assert.equal(saveBoat({ ...DEFAULT_BOAT, hull: '#123456' }, 1234), true);
  const b = readBoat();
  assert.equal(b.hull, '#123456'); assert.equal(b.at, 1234);
});

test('a broken boat is the default boat, and a full storage says it couldn\'t keep yours', () => {
  ls.setItem(BOAT_KEY, '{broken');
  assert.deepEqual(readBoat(), DEFAULT_BOAT);
  ls.full = true;
  assert.equal(saveBoat(DEFAULT_BOAT), false);
});

// ---------- the course in words ----------
test('a course\'s length, to the nearest ten metres and in sea miles', () => {
  assert.equal(fmtDistance(1854, 'en'), '1850 m · 1.00 nm');
  assert.equal(fmtDistance(1854, 'ru'), '1850 м · 1,00 мили');
});

test('another class of yacht sails a course of her own size', () => {
  const base = plannedCourse('medium', 'short', 5, 'tri');
  const big = plannedCourse('medium', 'short', 5, 'tri', { courseK: 2, lineK: 2 });
  assert.equal(big.type, 'tri');
  assert.deepEqual(big.windward, base.windward.map((v) => v * 2));
  assert.deepEqual(big.pin, base.pin.map((v) => v * 2));
  assert.deepEqual(big.wing, base.wing.map((v) => v * 2));
  const longer = plannedCourse('medium', 'short', 5, 'wl', { courseK: 1.5, lineK: 1 });
  assert.equal(longer.windward[1], plannedCourse('medium', 'short', 5, 'wl').windward[1] * 1.5);
});

// ---------- the daily reminder ----------
const SUB = { endpoint: 'https://push.test/e', keys: { p256dh: 'p', auth: 'a' } };
function browser({ perm = 'granted', existing = SUB, registered = true, rpcOk = true, rpc = null } = {}) {
  const b = { calls: [], unsubscribed: false, subscribed: null };
  const sub = (j) => ({ endpoint: j.endpoint, toJSON: () => j, unsubscribe: async () => { b.unsubscribed = true; } });
  const manager = { getSubscription: async () => (existing ? sub(existing) : null), subscribe: async (o) => { b.subscribed = o; return sub(SUB); } };
  const reg = { pushManager: manager };
  set('window', { isSecureContext: true, PushManager: class {}, Notification: class {} });
  set('navigator', { serviceWorker: { getRegistration: async () => (registered ? reg : undefined), register: async (u, o) => { b.registered = [u, o]; return reg; }, ready: Promise.resolve(reg) } });
  set('Notification', { permission: perm, requestPermission: async () => perm });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  globalThis.fetch = async (u, o) => { b.calls.push({ fn: String(u).split('/').pop(), body: JSON.parse(o.body), headers: o.headers }); if (rpc) return rpc(); return new Response('{}', { status: rpcOk ? 200 : 500 }); };
  return b;
}
const log = { d: { '2026-11-09': 200, '2026-11-10': 190 }, v: {} };

test('a browser that can\'t take a push is told so before anything is asked', async () => {
  assert.equal(push.pushable(), false, 'no window');
  set('window', { isSecureContext: false, PushManager: 1, Notification: 1 });
  set('navigator', { serviceWorker: {} });
  assert.equal(push.pushable(), false, 'not a secure page');
  set('window', { isSecureContext: true, Notification: 1 });
  assert.equal(push.pushable(), false, 'iOS Safari in a tab');
  assert.equal(await push.subscribe('en', null), 'failed');
  assert.equal(await push.currentSub(), null);
});

test('saying no to the browser\'s question is "denied"', async () => {
  const b = browser({ perm: 'denied' });
  assert.equal(await push.subscribe('en', log), 'denied');
  assert.equal(b.calls.length, 0);
});

test('the reminder turned on: the subscription is saved with the last day and the streak', async () => {
  const b = browser();
  assert.equal(await push.subscribe('ru', log), 'on');
  assert.deepEqual(b.registered, ['/sw.js', { scope: '/' }]);
  assert.equal(b.subscribed, null, 'it already had a subscription');
  const c = b.calls[0];
  assert.equal(c.fn, 'regatta_push_save');
  assert.equal(c.body.p_endpoint, SUB.endpoint); assert.equal(c.body.p_lang, 'ru'); assert.equal(c.body.p_last, '2026-11-10');
  assert.equal(c.headers.apikey, 'pub'); assert.equal(c.headers.Authorization, 'Bearer pub');
});

test('a browser with no subscription yet gets one, with the site\'s key decoded to bytes', async () => {
  const b = browser({ existing: null });
  assert.equal(await push.subscribe('en', null), 'on');
  assert.equal(b.subscribed.userVisibleOnly, true);
  const key = b.subscribed.applicationServerKey;
  assert.ok(key instanceof Uint8Array);
  assert.equal(key.length, 65, 'an uncompressed P-256 public key');
  assert.equal(key[0], 4);
  assert.equal(b.calls[0].body.p_last, null); assert.equal(b.calls[0].body.p_streak, 0);
});

test('a subscription missing its keys, or a save refused, is "failed"', async () => {
  browser({ existing: { endpoint: 'https://push.test/e', keys: {} } });
  assert.equal(await push.subscribe('en', log), 'failed');
  browser({ rpcOk: false });
  assert.equal(await push.subscribe('en', log), 'failed');
  assert.equal(ls.getItem('regatta-push'), null, 'a failed save isn\'t remembered as sent');
  browser({ rpc: () => { throw new Error('down'); } });
  assert.equal(await push.subscribe('en', log), 'failed');
});

test('the reminder turned off: the row goes, then the subscription', async () => {
  const b = browser();
  ls.setItem('regatta-push', 'x');
  await push.unsubscribe();
  assert.equal(b.calls[0].fn, 'regatta_push_drop');
  assert.deepEqual(b.calls[0].body, { p_endpoint: SUB.endpoint });
  assert.ok(b.unsubscribed);
  assert.equal(ls.getItem('regatta-push'), null);
});

test('turning it off still ends the subscription when the server can\'t be reached', async () => {
  const b = browser({ rpc: () => Promise.reject(new Error('down')) });
  await push.unsubscribe();
  assert.ok(b.unsubscribed);
});

test('turning it off with no subscription asks nothing of the server', async () => {
  const b = browser({ registered: false });
  await push.unsubscribe();
  assert.equal(b.calls.length, 0);
});

test('the sync sends once, and again only when something has changed', async () => {
  const b = browser();
  await push.pushSync('en', log);
  await push.pushSync('en', log);
  assert.equal(b.calls.length, 1);
  await push.pushSync('ru', log);
  assert.equal(b.calls.length, 2, 'the language changed');
  await push.pushSync('ru', { d: { ...log.d, '2026-11-11': 180 }, v: {} });
  assert.equal(b.calls.length, 3, 'another day finished');
});

test('the sync does nothing for a browser that never asked', async () => {
  const b = browser({ perm: 'default' });
  await push.pushSync('en', log);
  const c = browser({ existing: null });
  await push.pushSync('en', log);
  assert.equal(b.calls.length + c.calls.length, 0);
});

test('a sync that fails is forgotten about and tried again next time', async () => {
  const b = browser({ rpc: () => Promise.reject(new Error('down')) });
  await push.pushSync('en', log);
  await push.pushSync('en', log);
  assert.equal(b.calls.length, 2);
});

// ---------- analytics ----------
test('an event sent before the analytics script has loaded waits in its queue', async () => {
  const { track } = await import('../lib/track.ts');
  track('nothing'); // no window: nothing happens, and nothing breaks
  const w = {};
  set('window', w);
  track('race-finish', { place: 1 });
  w.va('event', { name: 'x' });
  assert.deepEqual(w.vaq, [['event', { name: 'x' }]]);
});
