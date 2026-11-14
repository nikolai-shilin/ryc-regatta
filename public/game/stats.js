// Tells the server about the player's races (api/game.mjs in the iyt-test repo, on iyt.rycrentals.com → public.game_races), for the
// admins' Overview page and the rankings: one post when a race starts, one when the player crosses the finish, and the
// result page's record of the race, so a result link opens on any device. Best effort: a failure is ignored and the
// game never waits on it. Who the player is: inside Telegram the launch data names them; on the site, the access token
// of their account (from /auth/token, on this origin); in a plain browser signed out the race is a guest's. The post
// goes to another site, so it stays a simple request (plain text, no headers of its own, the launch data and the token
// in the body): no preflight, which a keepalive post on leaving the page may not get through.
const API = 'https://iyt.rycrentals.com/api/game';
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

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
  if (!race || race._rid) return;
  race._rid = uuid();
  const body = { ev: 'start', id: race._rid, wind: opts.preset, laps: opts.laps, length: opts.length, shape: race.course.type, boats: race.boats.length, ...(opts.daily && { daily: opts.daily }), ...(myFlag() && { flag: myFlag() }) };
  account().then((tok) => send(body, tok));
}

// The player crossed the finish line (place is null when disqualified).
export function raceFinished(race) {
  const P = race && race.player;
  if (!P || !race._rid || race._sent) return;
  race._sent = true;
  send({ ev: 'finish', id: race._rid, place: P.dsq ? null : P.place, boats: race.boats.length, secs: P.finish, dsq: !!P.dsq });
}

// The result page's record (main.js finishToPage), kept on the server too, so its link works on any device. A
// keepalive post carries at most 64 kB, and the page is left at once: a bigger record stays on this device only.
export function raceResult(race, result) {
  if (!race || !race._rid || !result) return;
  const body = { ev: 'result', id: race._rid, result };
  if (JSON.stringify(body).length < 60000) send(body, null);
}
