// What a 1-on-1 race tells the site: POST /connect/log (app/connect/log/route.ts, whose rules are lib/duel-log.ts) hears of its
// start and its end from the host's screen, and of each guest's joining from hers. Nothing here touches the page but
// isLocal's reading of the address, and nothing here can get in the way of a race: a report goes in the background, is
// tried again a few times, and is then forgotten. match-ui.js is the only module that loads this one.
const ROUTE = '/connect/log';
const TRIES = 3, TRY_MS = 3000;
const MAX_SECS = 86400, MAX_RECALLS = 9, MAX_PENS = 99;

// a page on this computer posts nothing, unless its address has ?scores (as stats.js's LOCAL)
export function isLocal() {
  try { return /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(location.hostname) && !/[?&]scores\b/.test(location.search); } catch (e) { return true; }
}

// the host's proof that a race is hers: sent with its start and its end, and never to the guest
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');

// Posts a report, up to three tries 3 s apart on a network failure or an answer that isn't 2xx. keepalive: a page closing at
// once still delivers it. done(worked), when given, is told once as the tries are over. Never throws, and leaves no
// promise to reject.
export function report(body, options) {
  let over = false;
  const finish = (worked) => { if (over) return; over = true; try { options?.done?.(worked); } catch (e) {} };
  try {
    const { fetch: post = globalThis.fetch, wait = setTimeout, local = isLocal() } = options ?? {};
    if (local || typeof post !== 'function') { finish(false); return; }
    const init = { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    const attempt = (n) => {
      const failed = () => {
        if (n >= TRIES) { finish(false); return; }
        try { wait(() => attempt(n + 1), TRY_MS); } catch (e) { finish(false); }
      };
      try { Promise.resolve(post(ROUTE, init)).then((r) => { if (r?.ok) finish(true); else failed(); }, failed).catch(() => finish(false)); } catch (e) { failed(); }
    };
    attempt(1);
  } catch (e) { finish(false); }
}

// ---------- the reports: each fits what lib/duel-log.ts parseReport takes, or the site would drop the whole of it ----------
// a sailor's name as the waiting room shows it: match-ui.js's `clean`, the pattern lib/name.ts's EMOJI (this module can't
// import the screens that load it), whole (the cut to 16 may have halved a character), and a dash for a name with nothing left
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/[#*0-9]️?⃣|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}][︎️‍\u{E0020}-\u{E007F}]*/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const shown = (name) => clean(name).replace(/[\ud800-\udbff]$/, '').trim() || '—';
const span = (v) => (Number.isFinite(v) && v >= 0 && v <= MAX_SECS ? Math.round(v * 1000) / 1000 : null);
const count = (v, most) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), most) : null);
const SETTINGS = ['venue', 'yacht', 'preset', 'length', 'course', 'laps', 'start', 'current', 'daytime'];

export function startBody(match, code, token) {
  const { seed, host, guest, settings } = match.start;
  return { kind: 'start', code, seed, token, host: shown(host.name), guest: shown(guest.name), settings: Object.fromEntries(SETTINGS.map((k) => [k, settings?.[k]])) };
}

export function joinBody(match, code, name) {
  return { kind: 'join', code, seed: match.start.seed, name: shown(name) };
}

// How the race ended. race and results (M.finalResults) are the race on this page; a page opened again has neither, and
// reports what match.result holds. Each boat: her place, her time, DSQ or DNF as marksOf (match.js) has it, her penalties;
// an abandoned race isn't scored, so it says none of these of either boat, wherever it is reported from
export function endBody(match, code, token, race, results) {
  const r = match.result ?? { abandoned: true }, abandoned = !!r.abandoned, winner = abandoned ? null : r.winner ?? null;
  const role = (id) => (id === match.hostId ? 'host' : id === match.guestId ? 'guest' : null);
  const boat = (id) => {
    if (abandoned) return { place: null, secs: null, mark: null, pens: null };
    const won = id === winner, b = results?.boats?.find((x) => x.id === id) ?? race?.humans?.find((x) => x.id === id);
    if (!b) {
      const mark = r.marks?.[id];
      return { place: won ? 1 : winner && r.margin != null ? 2 : null, secs: null, mark: mark === 'DSQ' || mark === 'DNF' ? mark : null, pens: null };
    }
    return { place: won ? 1 : b.place != null ? 2 : null, secs: b.done ? span(b.finish) : null,
      mark: won ? null : b.dsq || b.ufd || b.bfd ? 'DSQ' : b.dnf || !b.done ? 'DNF' : null, pens: count(b.pens || 0, MAX_PENS) };
  };
  return { kind: 'end', code, seed: match.start.seed, token, state: abandoned ? 'abandoned' : 'finished', winner: role(winner), margin: abandoned ? null : span(r.margin),
    forfeited: abandoned ? null : role(r.forfeited), recalls: race ? count(race.recalls, MAX_RECALLS) : null, prep: ['P', 'I', 'U', 'B'].includes(race?.prepFlag) ? race.prepFlag : null,
    host: boat(match.hostId), guest: boat(match.guestId) };
}
