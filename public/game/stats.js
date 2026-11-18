// Tells the server about the player's races (api/game.mjs in the iyt-test repo, on iyt.rycrentals.com → public.game_races), for the
// admins' Overview page and the rankings: one post when a race starts, one when the player crosses the finish, and the
// result page's record of the race, so a result link opens on any device; and how the game ran through it (its frame
// rate, the graphics, the device: perfFrame, below), for the site's /admin. Best effort: a failure is ignored and the
// game never waits on it. Who the player is: inside Telegram the launch data names them; on the site, the access token
// of their account (from /auth/token, on this origin); in a plain browser signed out the race is a guest's. The post
// goes to another site, so it stays a simple request (plain text, no headers of its own, the launch data and the token
// in the body): no preflight, which a keepalive post on leaving the page may not get through.
import { CLS } from './classes.js';
import { VENUE } from './venues.js';
const API = 'https://iyt.rycrentals.com/api/game';
// the game run locally (npm run dev) keeps its races to itself: a test race isn't one of the day's. ?scores in the
// address posts them all the same, for trying the scores server
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(location.hostname) && !/[?&]scores\b/.test(location.search);
const TG =window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// the site account's access token, asked for once the page is open and again when it is about to run out (an hour)
let token = null, expires = 0, asking = null, askedAt = -Infinity;
function account() {
  if (TG || location.protocol === 'file:') return Promise.resolve(null);
  if (token && expires - Date.now() / 1000 > 120) return Promise.resolve(token);
  if (!token && Date.now() - askedAt < 300e3) return Promise.resolve(null); // signed out a moment ago: still a guest
  return asking || (asking = fetch('/auth/token', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.status === 200 ? r.json() : null))
    .then((j) => { token = (j && j.token) || null; expires = (j && j.expires) || 0; askedAt = Date.now(); return token; })
    .catch(() => null)
    .finally(() => { asking = null; }));
}
account();

function send(body, tok = token) {
  if (LOCAL) return;
  try {
    fetch(API, { method: 'POST', keepalive: true, body: JSON.stringify({ ...body, initData: TG ? TG.initData : '', ...(tok && { token: tok }) }) }).catch(() => {});
  } catch (e) {}
}

// the flag you fly (the boat page's, localStorage 'regatta-boat'), shown by your name on the rankings
function myFlag() {
  try { const f = JSON.parse(localStorage.getItem('regatta-boat') || 'null')?.flag; return typeof f === 'string' && /^[a-z]{2}$/.test(f) ? f : null; } catch (e) { return null; }
}

// A race has begun (the player pressed Start or Race again): race is the sim's Race, opts the race's settings. Wind,
// laps, course length, fleet and shape (the one it is laid in) make the course, so the admins compare best times only on the same one; daily names
// the day of today's race (the same wind for everyone), whose times rank on the game card on Home. Only the start
// names the player (the finish finds its row), so it waits for the token if it is still on its way.
export function raceStarted(race, opts) {
  if (!race || race._rid || (race.match || race.multi)) return; // a match race is kept nowhere: nothing is posted from one
  perfSend(); // the race before it, left before its finish: how it ran
  raceEnded(cur, 'new'); // …and how it ended, if it wasn't said (a race begun from somewhere main.js doesn't name)
  race._rid = uuid();
  // (and the class of yacht, when not the JPK 1050: a J/70's or an AC75's times aren't the same race's)
  cur = race; race._t0 = performance.now(); race._inc = { n: {}, last: null, at: 0 }; visit.races++;
  const body = { ev: 'start', id: race._rid, vid: VID, visit: VISIT, wind: opts.preset, laps: opts.laps, length: opts.length, shape: race.course.type, boats: race.boats.length, ...(opts.daily && { daily: opts.daily }), ...(myFlag() && { flag: myFlag() }), ...(CLS.id !== 'jpk1050' && { yacht: CLS.id }), venue: VENUE.id };
  account().then((tok) => send(body, tok));
}

// The player crossed the finish line (place is null when disqualified).
export function raceFinished(race) {
  const P = race && race.player;
  if (!P || !race._rid || race._sent || (race.match || race.multi)) return;
  race._sent = true;
  send({ ev: 'finish', id: race._rid, place: P.dsq ? null : P.place, boats: race.boats.length, secs: P.finish, dsq: !!P.dsq });
  visit.finished++;
  raceEnded(race, 'finish');
  perfSend();
}

// The result page's record (main.js finishToPage), kept on the server too, so its link works on any device. A
// keepalive post carries at most 64 kB, and the page is left at once: a bigger record stays on this device only.
export function raceResult(race, result) {
  if (!race || !race._rid || !result || (race.match || race.multi)) return;
  const body = { ev: 'result', id: race._rid, result };
  if (JSON.stringify(body).length < 60000) send(body, null);
}

// ---------- how the game ran: each race's frames, for the site's /admin ----------
// main.js hands every frame drawn while the race runs (not behind the pause menu) to perfFrame: its time since the
// last, the graphics level in effect, the setting (auto or a level) and the battery saver. The times go into a
// histogram of 2 ms bins, so a race of any length keeps a few hundred numbers. Once a race (at the finish, on the next
// race, or as the page is left) it is boiled down and posted ({ ev: 'perf' }): the middle frame's rate (fps) and the
// slow end's (low: the 95th percentile frame), the stalls (frames over 100 ms) a minute, the seconds measured, the
// level at the start and the end, the device (phone, tablet or desktop; in Telegram or a browser; the system and the
// browser; the graphics chip, as WebGL names it; the screen's pixel ratio and the size drawn; its cores and memory),
// and the seconds from opening the page to the first race. Nothing in it names the player.
const BIN = 2, NB = 126, STALL = 0.1; // ms a bin; the last bin takes every frame of 250 ms and more
let pf = null, dev = null, loaded = false;
// once, from main.js: the graphics chip's name, and the canvas's drawn size (a function: it changes with the window)
export function perfSetup({ gpu, size }) { dev = { gpu: cleanGpu(gpu), size }; }
// "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060";
// "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" → "Apple M2"; "Adreno (TM) 650" as it is
export function cleanGpu(s) {
  if (typeof s !== 'string' || !s) return null;
  const a = s.match(/^ANGLE \((.*)\)$/);
  if (a) { const parts = a[1].split(', '); s = parts.length >= 2 ? parts[1] : a[1]; }
  s = s.replace(/^.*Renderer: /, '').replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s+(Direct3D|OpenGL|vs_|ps_|Metal|SwiftShader driver).*$/i, '').replace(/[^\w ()+\-.,/:]/g, '').trim();
  return s.slice(0, 60) || null;
}
const ua = navigator.userAgent || '', touch = navigator.maxTouchPoints > 1;
const IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch);
export const device = () => ({
  dev: matchMedia('(pointer: coarse)').matches ? (Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet') : 'desktop',
  tg: TG ? 1 : 0,
  os: IOS ? 'ios' : /Android/.test(ua) ? 'android' : /CrOS/.test(ua) ? 'chromeos' : /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'windows' : /Linux/.test(ua) ? 'linux' : 'other',
  br: /Edg\//.test(ua) ? 'edge' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /YaBrowser/.test(ua) ? 'yandex' : /OPR\//.test(ua) ? 'opera' : /Chrome|CriOS/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other',
  dpr: Math.round((devicePixelRatio || 1) * 100) / 100,
  cores: navigator.hardwareConcurrency || null,
  mem: navigator.deviceMemory || null,
});
export function perfFrame(race, raw, q, gfx, saver) {
  if (!race || !race._rid || (race.match || race.multi) || !(raw > 0) || raw > 1) return; // (a second and more: the tab was away)
  if (!pf || pf.rid !== race._rid) {
    perfSend();
    pf = { rid: race._rid, hist: new Uint32Array(NB), n: 0, t: 0, stalls: 0, q0: q, q, gfx, saver: saver ? 1 : 0 };
    pf.load = loaded ? null : Math.round(performance.now() / 100) / 10; loaded = true; // the page's first race: since it opened
  }
  pf.hist[Math.min(NB - 1, Math.floor((raw * 1000) / BIN))]++;
  pf.n++; pf.t += raw; if (raw > STALL) pf.stalls++;
  pf.q = q; pf.gfx = gfx; if (saver) pf.saver = 1;
}
// the frame time (s) at fraction f of the frames, the slowest last
function frameAt(h, n, f) {
  const want = Math.max(1, Math.ceil(n * f));
  for (let i = 0, c = 0; i < NB; i++) if ((c += h[i]) >= want) return ((i + 0.5) * BIN) / 1000;
  return (NB * BIN) / 1000;
}
export function perfSummary(p, d = device(), extra = dev) {
  const r = (x, k = 10) => Math.round(x * k) / k;
  const [w, h] = (extra && extra.size && extra.size()) || [null, null];
  return { fps: r(1 / frameAt(p.hist, p.n, 0.5)), low: r(1 / frameAt(p.hist, p.n, 0.95)), stall: r((p.stalls / p.t) * 60, 100), secs: Math.round(p.t),
    q0: p.q0, q: p.q, gfx: p.gfx, saver: p.saver, ...d, gpu: (extra && extra.gpu) || null, w, h, load: p.load ?? null };
}
// post the race measured so far, once (20 s of frames at least: a race left at once tells nothing)
function perfSend() {
  const p = pf; pf = null;
  if (!p || p.t < 20 || p.n < 200) return;
  send({ ev: 'perf', id: p.rid, perf: perfSummary(p) }, null);
}
// the page left, or put away (a phone often closes it from there without a pagehide); a race that then goes on keeps
// what was posted (the server takes one a race)
addEventListener('pagehide', () => { perfSend(); raceEnded(cur, 'close'); visitSend('left'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { perfSend(); raceEnded(cur, 'hidden'); visitSend('left'); } });

// ---------- how a race ended, the visit, what went wrong: for the site's /admin ----------
// VID: this browser, a random id kept in localStorage (so a guest who comes back another day counts as one coming
// back); VISIT: this page's opening, made by the loading screen (play/index.html), which posted it first ({ ev: 'open' }).
// Neither names anyone.
const VID = (() => { try { let v = localStorage.getItem('regatta-vid'); if (!v || !/^[0-9a-f-]{36}$/.test(v)) localStorage.setItem('regatta-vid', (v = uuid())); return v; } catch (e) { return null; } })();
const VISIT = (window.rycVisit && window.rycVisit.id) || uuid();
const visit = { races: 0, finished: 0, howto: 0, errors: [], lost: 0 };
let cur = null, context = () => ({});
// main.js: what the player has set (the camera, the sails' trim, the sound, the speed …), read as a race ends
export function statsContext(fn) { context = fn; }
// the incidents that may make a player give up, as the race says them (main.js handleMessages): counted, and the
// last one remembered with when
const BAD = new Set(['ocs', 'fouled', 'touched', 'bump', 'aground', 'penNow', 'missedLine', 'missedGate', 'wrongSide', 'genRecall', 'barging', 'finishOwed']);
export function raceIncident(race, key) {
  const I = race && race._inc;
  if (!I || !BAD.has(key)) return;
  I.n[key] = (I.n[key] || 0) + 1; I.last = key; I.at = performance.now();
}
// The race is over for the player: how (finish, restart, change: to the set-up, menu: back to the hub, close: the page
// left, hidden: put away, new: another race begun), where (the leg and the race's clock, her place then), the
// incidents, the last one and how many seconds before, and what she had set. Once a race (the server keeps the first).
export function raceEnded(race, how) {
  if (!race || !race._rid || race._ended || (race.match || race.multi)) return;
  race._ended = true;
  const P = race.player, I = race._inc || { n: {} }, st = race.standings ? race.standings() : [];
  let use = {}; try { use = context() || {}; } catch (e) {}
  send({ ev: 'end', id: race._rid, end: {
    how, leg: P.leg ?? null, legs: race.course && race.course.legs ? race.course.legs.length - 1 : null, clock: Math.round(race.clock),
    place: Math.max(1, st.indexOf(P) + 1), boats: race.boats.length, done: P.done ? 1 : 0,
    inc: I.n, last: I.last, ago: I.last ? Math.round((performance.now() - I.at) / 1000) : null, pens: P.pens || 0,
    mins: Math.round((performance.now() - (race._t0 || performance.now())) / 6000) / 10, use } }, null);
}
// what went wrong on the page: the first five different errors (the message and where), a lost WebGL context
function noteError(m, src) {
  m = String(m || 'error').slice(0, 140); src = String(src || '').replace(/^.*\/(?=[^/]+$)/, '').slice(0, 60);
  const e = visit.errors.find((x) => x.m === m && x.src === src);
  if (e) e.n++; else if (visit.errors.length < 5) visit.errors.push({ m, src, n: 1 });
}
addEventListener('error', (e) => { if (e.message) noteError(e.message, e.filename ? `${e.filename}:${e.lineno}` : ''); });
addEventListener('unhandledrejection', (e) => noteError(e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack ? String(e.reason.stack).split('\n')[1] : ''));
document.querySelector('#gl')?.addEventListener('webglcontextlost', () => { visit.lost = 1; });
document.querySelector('#howD')?.addEventListener('toggle', (e) => { if (e.target.open) visit.howto = 1; });
// The visit, as it stands, each time the page is left or put away (and when the race is first under way: it loaded):
// the races begun and finished, the minutes on the page, how to play opened, a drill or a ghost, the errors
export function visitSend(stage) {
  if (!VISIT) return;
  const q = new URLSearchParams(location.search);
  send({ ev: 'visit', id: VISIT, visit: { stage, vid: VID, races: visit.races, finished: visit.finished, mins: Math.round(performance.now() / 6000) / 10,
    howto: visit.howto, drill: q.get('drill') ? 1 : 0, ghost: q.get('ghost') ? 1 : 0, errors: visit.errors, lost: visit.lost,
    ...(stage === 'loaded' && { load: Math.round(performance.now() / 100) / 10 }) } }, null);
}
