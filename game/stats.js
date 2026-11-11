// Tells the server about the player's races (api/game.mjs → public.game_races), for the admins' Overview page: one post
// when a race starts, one when the player crosses the finish. Best effort: a failure is ignored and the game never
// waits on it. Inside Telegram the launch data names the player; in a plain browser the race is counted without a name.
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

function send(body) {
  try {
    fetch('/api/game', {
      method: 'POST', keepalive: true, body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-telegram-init-data': TG ? TG.initData : '' },
    }).catch(() => {});
  } catch (e) {}
}

// A race has begun (the player pressed Start or Race again): race is the sim's Race, opts the menu's settings. Wind,
// laps, course length and fleet make the course, so the admins compare best times only on the same one.
export function raceStarted(race, opts) {
  if (!race || race._rid) return;
  race._rid = uuid();
  send({ ev: 'start', id: race._rid, wind: opts.preset, laps: opts.laps, length: opts.length, boats: race.boats.length });
}

// The player crossed the finish line (place is null when disqualified).
export function raceFinished(race) {
  const P = race && race.player;
  if (!P || !race._rid || race._sent) return;
  race._sent = true;
  send({ ev: 'finish', id: race._rid, place: P.dsq ? null : P.place, boats: race.boats.length, secs: P.finish, dsq: !!P.dsq });
}
