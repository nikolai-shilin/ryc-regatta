// While a 1-on-1 race's page loads, this screen tells the race's channel how far it has got, so the other screen,
// already in the waiting room, says "Anna K. · loading 70%" on her row rather than nothing (match-ui.js heardLoading).
// public/play/index.html's loader starts it for ?match=<code>, before the game's own modules have come, and gives the
// share loaded as window.rycLoadPct (0–100, 100 once the race is up). On 'match:CODE', its own socket (net.js):
//   loading  either  { id, name, pct } every second till loaded, then 100 once, and the socket closes
// The id is the one match-ui.js keeps for this device (ME_KEY), made here first if this is its first race; the name is
// the account's, as /connect says it (a matched race is always between two accounts). Nothing is said for a code that
// isn't one, without /connect's address, or after a minute.
import { realtime } from './net.js';

export const ME_KEY = 'regatta-match-me'; // (match-ui.js's)
const EVERY_MS = 1000, FOR_MS = 60000;
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
export function myId(storage = localStorage) {
  let id = null;
  try { id = JSON.parse(storage.getItem(ME_KEY) || 'null'); } catch (e) {}
  if (typeof id === 'string' && /^[a-z0-9]{8,24}$/.test(id)) return id;
  id = newId();
  try { storage.setItem(ME_KEY, JSON.stringify(id)); } catch (e) {}
  return id;
}

// returns stop(); every clock and the socket injected for the tests
export async function tellLoading({ code, pct = () => window.rycLoadPct, connect = () => fetch('/connect', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)),
  net = realtime, id = myId(), setInterval: every = setInterval, clearInterval: stopEvery = clearInterval, now = Date.now } = {}) {
  if (!CODE.test(String(code || ''))) return () => {};
  let cfg = null;
  try { cfg = await connect(); } catch (e) {}
  if (!cfg || !cfg.url || !cfg.key) return () => {};
  const name = typeof cfg.name === 'string' ? cfg.name.slice(0, 64) : '';
  const rt = net({ url: cfg.url, key: cfg.key }), ch = rt.channel('match:' + code), t0 = now();
  try { ch.join().catch(() => {}); } catch (e) {} // (a send before the join is answered is dropped: the next second's goes)
  let timer = null, done = false;
  const stop = () => { if (done) return; done = true; stopEvery(timer); try { rt.close(); } catch (e) {} };
  const say = () => {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct()) || 0)));
    try { ch.send('loading', { id, name, pct: p }); } catch (e) {}
    if (p >= 100 || now() - t0 > FOR_MS) { stopEvery(timer); timer = every(stop, 1500); } // (a moment for the last word to go)
  };
  timer = every(() => { if (!done) say(); }, EVERY_MS);
  return stop;
}

// started by the page (which set window.rycLoadPct): the code in its address
try {
  if (typeof window !== 'undefined' && window.rycLoadPct !== undefined) tellLoading({ code: (new URLSearchParams(location.search).get('match') || '').toUpperCase() });
} catch (e) {}
