// A 1-on-1 race on screen: the waiting room, the race against the friend, and the card after it. main.js imports this
// module only when the address has ?match=<code>, and this module imports the Realtime client, the race's protocol and
// its reports to the site (net.js, match.js, wire.js, duel-log.js) only once it runs: nobody sailing today's race or a free
// race downloads any of it.
//
// Who runs what: the host's game runs the race (match.js Host) and keeps its state (Match); the guest's follows (Guest)
// and copies the host's Match from its 'mstate' messages. On 'match:CODE' (link.all), besides the Room's and the race's
// own messages:
//   mstate  host → guest  { start, state, result, leftBy } on every change, every second after the race and every two
//                          seconds in one (a reloaded guest learns where it is)
//   loaded  guest → host  { id, seed } the race is built on her screen: the host's race starts then (its silence timers
//                          with it), so a slow phone still building the venue isn't forfeited; every second till it is
//   leave   either        { id } Leave, Done or Full result. The guest's, in a race: before her finish she gives it up,
//                          after it her place stands. The host's, in a race: `abandon` goes first (match.js)
const STEP = 1 / 60;
const CARD_MS = 3500; // a race's end stays on the water this long before its card
const HOST_WAIT_MS = 30000; // the guest alone in a room this long: the room says the host may not come
const RESULTS_MS = 30000; // the results go on being sent, and waited for, this long after the race's end
const NAME_KEY = 'regatta-match-name', ME_KEY = 'regatta-match-me', SETTINGS_KEY = 'regatta-match-settings';
const RESULT_KEY = 'regatta-match-result'; // { code, seed, id }: the record this device kept of its last race, for Full result after a reload
const SHAPE_KEY = { wl: 'shapeWl', tri: 'shapeTri', trap: 'shapeTrap', wlu: 'shapeWlu' };
const LENGTH_KEY = { short: 'lShort', medium: 'lMedium', long: 'lLong' };

export const MATCH_STRINGS = {
  en: {
    kick: '1-on-1 race', room: 'Waiting room', linkK: 'Send your friend this link', share: 'Share', copy: 'Copy', copied: 'Copied',
    nameK: 'Your name', namePh: 'Your name', youTag: 'you', hostTag: 'host', laps: (n) => (Number(n) > 1 ? `${n} laps` : `${n} lap`), startMin: (n) => `${n}-minute start`,
    waitFriend: 'Waiting for a friend…', waitStart: (n) => `Waiting for ${n} to start the race…`, start: 'Start the race', leave: 'Leave',
    connecting: 'Connecting…', noConnect: 'Couldn’t connect to the race', retry: 'Try again', nameFirst: 'Type your name to join', join: 'Join',
    currentOn: 'Current', daytime: (d) => ({ morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', evening: 'Evening', sunset: 'Sunset' })[d] ?? d,
    by: (s) => `+${s}`, forfeit: (w) => `${w} dropped out`, abandonedH: 'Race abandoned', notScored: 'It doesn’t count for either of you', noWinner: 'No winner',
    rematch: 'Rematch', fullResult: 'Full result', done: 'Done', waitRematch: (w) => `${w} can start a rematch`, left: (w) => `${w} left the race`,
    stillOut: (w) => `${w} is still racing`, stillOutT: (w, s) => `${w} is still racing · ${s} left`, keepOpen: 'Keep this screen open',
    loadingRace: (w) => `Waiting for ${w} to load the race…`,
    sec: 's', waitHost: 'Waiting for the host…', noHost: 'Nobody is hosting this race yet. The link may be old, or your friend has left: ask them for a new one, or leave and sail today’s race.', stale: 'The game was updated: reload to join', reload: 'Reload', fullRoom: 'This race already has two sailors',
    badSet: 'This race is set at a venue or on a yacht this page can’t open',
    hostH: 'Sign in to host this race', hostP: 'Hosting a 1-on-1 race takes an account. Joining a friend’s race doesn’t.', signIn: 'Sign in',
  },
  ru: {
    kick: 'Гонка 1 на 1', room: 'Зал ожидания', linkK: 'Отправь другу эту ссылку', share: 'Поделиться', copy: 'Скопировать', copied: 'Скопировано',
    nameK: 'Твоё имя', namePh: 'Твоё имя', youTag: 'ты', hostTag: 'хозяин', laps: (n) => (Number(n) > 1 ? `${n} круга` : `${n} круг`), startMin: (n) => `старт ${n} мин`,
    waitFriend: 'Ждём соперника…', waitStart: (n) => `Ждём, когда ${n} начнёт гонку…`, start: 'Начать гонку', leave: 'Выйти',
    connecting: 'Подключаемся…', noConnect: 'Не удалось подключиться к гонке', retry: 'Ещё раз', nameFirst: 'Напиши имя, чтобы войти', join: 'Войти',
    currentOn: 'Течение', daytime: (d) => ({ morning: 'Утро', midday: 'Полдень', afternoon: 'День', evening: 'Вечер', sunset: 'Закат' })[d] ?? d,
    by: (s) => `+${s}`, forfeit: (w) => `${w}: сход`, abandonedH: 'Гонка прекращена', notScored: 'Она не засчитывается никому из вас', noWinner: 'Без победителя',
    rematch: 'Реванш', fullResult: 'Полный результат', done: 'Закончить', waitRematch: (w) => `${w} может начать реванш`, left: (w) => `${w}: выход из гонки`,
    stillOut: (w) => `${w} ещё в гонке`, stillOutT: (w, s) => `${w} ещё в гонке · осталось ${s}`, keepOpen: 'Не закрывай этот экран',
    loadingRace: (w) => `${w} загружает гонку…`,
    sec: 'с', waitHost: 'Ждём хозяина гонки…', noHost: 'Эту гонку пока никто не открыл. Возможно, ссылка устарела или друг вышел: попроси новую или выйди и пройди гонку дня.', stale: 'Игра обновилась: перезагрузи страницу, чтобы войти', reload: 'Перезагрузить', fullRoom: 'В этой гонке уже двое',
    badSet: 'Эта гонка в месте или на яхте, которых эта страница не открывает',
    hostH: 'Войди, чтобы создать гонку', hostP: 'Чтобы создать гонку 1 на 1, нужен аккаунт. Чтобы войти в гонку друга, он не нужен.', signIn: 'Войти',
  },
};

const CSS = `
#mWrap { position: fixed; inset: 0; z-index: 9; pointer-events: none; font-family: var(--cond); color: var(--ink); }
#mWrap .m-card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100% - 32px)); max-height: calc(100% - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-5); background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%); animation: m-in var(--t-in) var(--ease) both; }
@keyframes m-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 14px)); } }
#mWrap .m-card[hidden], #mWrap [hidden] { display: none !important; } /* (over any display a class gives) */
#mWrap .m-kick { font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
#mWrap h2 { margin: 0; font: 700 var(--fs-title)/1.1 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; }
#mWrap p { margin: 0; font: 500 var(--fs-small)/1.35 var(--sans); color: var(--ink-2); }
#mWrap .m-k { font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
#mWrap .m-link { display: flex; gap: var(--s-2); }
#mWrap .m-link input, #mWrap .m-name input { flex: 1 1 auto; min-width: 0; height: var(--h-m); padding: 0 var(--s-3); border: 1px solid var(--rule); background: var(--fill-1); color: var(--ink); font: 600 var(--fs-small) var(--sans); }
#mWrap .m-name { display: flex; gap: var(--s-2); }
#mWrap button { height: var(--h-m); padding: 0 var(--s-4); border: 0; background: var(--fill-2); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; cursor: pointer; flex: none; }
#mWrap button:hover { background: var(--w-14); }
#mWrap button.m-prim { height: var(--h-l); border-radius: 0; background: var(--you); color: var(--ink-on); }
#mWrap button.m-prim:disabled { background: var(--fill-2); color: var(--ink-3); cursor: default; }
#mWrap .m-btns { display: flex; gap: var(--s-2); } #mWrap .m-btns button { flex: 1 1 0; }
#mWrap .m-ppl { display: flex; flex-direction: column; border-top: 1px solid var(--rule); }
#mWrap .m-p { display: flex; align-items: center; gap: var(--s-2); height: 40px; border-bottom: 1px solid var(--rule-2); font: 700 var(--fs-row)/1 var(--cond); }
#mWrap .m-p.empty { color: var(--ink-3); font-weight: 600; font-size: var(--fs-small); }
#mWrap .m-p .t { font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
#mWrap .m-st { font: 600 var(--fs-small)/1.3 var(--sans); color: var(--ink-2); }
#mWrap .m-st.bad { color: var(--down); }
#mWrap .m-rows { display: flex; flex-direction: column; border-top: 1px solid var(--rule); }
#mWrap .m-rows div { display: grid; grid-template-columns: 44px 1fr auto; gap: var(--s-2); height: 40px; align-items: center; border-bottom: 1px solid var(--rule-2); font: 700 var(--fs-row)/1 var(--cond); }
#mWrap .m-rows b { font-weight: 800; }
#mWrap .m-rows span:last-child { font-weight: 600; color: var(--ink-2); }
#mBanner { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); max-width: calc(100% - 32px); padding: var(--s-3) var(--s-5); background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  font: 700 var(--fs-lead)/1.2 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; text-align: center; border-left: 4px solid var(--live); }
#mNote { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 112px); transform: translateX(-50%); width: max-content; max-width: min(560px, calc(100vw - 32px)); padding: var(--s-1) var(--s-3); background: var(--panel); font: 600 var(--fs-label)/1.3 var(--sans); color: var(--ink-2); text-align: center; }
@media (max-height: 500px) { #mNote { top: calc(env(safe-area-inset-top, 0px) + 94px); } #mWrap .m-card { padding: var(--s-4); gap: var(--s-2); } }
`;

const html = (s) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild; };
// a name: no control characters, no emoji (lib/name.ts's EMOJI), 16 characters at most
export const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/[#*0-9]️?⃣|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}][︎️‍\u{E0020}-\u{E007F}]*/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; };
const fmtS = (s, unit = 's') => { s = Math.max(0, Math.round(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} ${unit}`; };
// a host's match, kept in localStorage['regatta-match-' + code] as { at, m, w } for six hours (a tab closed and the link
// opened again finds its race; w: its write token, till its end has been reported); Leave or Done clears it, and an open
// page sweeps away any other code's gone stale
const SAVED_MS = 6 * 3600 * 1000, SAVED_RE = /^regatta-match-[A-HJ-KM-NP-Z2-9]{6}$/;
const savedMatch = (code) => {
  let v = null; try { v = JSON.parse(localStorage.getItem('regatta-match-' + code) || 'null'); } catch (e) {}
  return v && v.m && v.m.start && Date.now() - v.at < SAVED_MS ? v : null;
};
const sweepSaved = () => { try { for (const k of Object.keys(localStorage)) if (SAVED_RE.test(k)) { let v = null; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) {} if (!v || !(Date.now() - v.at < SAVED_MS)) localStorage.removeItem(k); } } catch (e) {} };

// The card's two rows, the winner first: { id, mark, gap }. mark: her place, or DSQ or DNF in place of one ('' for a boat
// a reloaded page knows only from the result); gap: the margin, on the second boat's row
export function cardRows(boats, { winner = null, margin = null } = {}) {
  const markOf = (b) => {
    if (b.dsq || b.ufd || b.bfd) return 'DSQ';
    if (b.id === winner) return '1';
    if (b.dnf || b.done === false) return 'DNF';
    return b.place != null ? String(b.place) : margin != null ? '2' : '';
  };
  const rank = (r) => (r.id === winner ? 0 : Number(r.mark) || 9);
  return boats.map((b) => ({ id: b.id, mark: markOf(b) })).sort((a, b) => rank(a) - rank(b))
    .map((r) => ({ ...r, gap: r.mark === '2' ? margin : null }));
}
// The seconds the boat still out has left: limit, less the time since the first valid finish (as the boats say it, so on
// the guest's screen too, whose race doesn't judge). Null with no valid finish yet: she sails on to her own
export function timeLeft(race, limit) {
  const home = race.humans.filter((b) => b.done && !b.dsq).map((b) => b.finish);
  return home.length ? Math.max(0, limit - (race.clock - Math.min(...home))) : null;
}

let api = null; // the race on this page, for main.js's leaveMatch()
// Leave the race (on the water main.js has asked first: ask('leave'))
export function leaveMatch() { if (api) api.leave(); }

// The race at `code` on this page. t: main.js's words (the T keys); world, venue and cls: the page's; onRace(session)
// puts the race on screen ({ race, step(dt), isGuest }), onIdle() takes it off (the card); onEnd() leaves the page;
// toast(text) says a word over the race; keepOneOnOne(race, results) keeps this screen's record of it and returns its id,
// openResult(id) goes to its page. yachtName(id) and venueName(id) for the waiting room's settings.
export async function startMatch({ code, t, LANG = 'en', strings = null, perf = () => null, onRace, onIdle = () => {}, onEnd = () => {}, toast = () => {}, keepOneOnOne = () => null, openResult = () => {}, venue, cls, yachtName = (id) => id, venueName = (id) => id }) {
  const L = strings || MATCH_STRINGS[LANG] || MATCH_STRINGS.en;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const wrap = html(`<div id="mWrap" class="bc">
    <div class="m-card" id="mRoom" role="dialog" aria-labelledby="mRoomH">
      <span class="m-kick"></span><h2 id="mRoomH"></h2>
      <p class="m-set"></p>
      <div class="m-linkBox"><span class="m-k m-linkK"></span><div class="m-link"><input readonly><button type="button" class="m-share"></button></div></div>
      <div class="m-ppl"></div>
      <div class="m-nameBox"><span class="m-k m-nameK"></span><div class="m-name"><input maxlength="16" autocomplete="nickname"><button type="button" class="m-join"></button></div></div>
      <span class="m-st"></span>
      <button type="button" class="m-prim m-start"></button>
      <button type="button" class="m-prim m-signin" hidden></button>
      <div class="m-btns"><button type="button" class="m-retry" hidden></button><button type="button" class="m-leave"></button></div>
    </div>
    <div class="m-card" id="mCard" role="dialog" aria-labelledby="mCardH" hidden>
      <span class="m-kick"></span><h2 id="mCardH"></h2><p class="m-sub"></p>
      <div class="m-rows"></div>
      <span class="m-st"></span>
      <button type="button" class="m-prim m-go"></button>
      <div class="m-btns"><button type="button" class="m-full" hidden></button><button type="button" class="m-leave"></button></div>
    </div>
    <div id="mBanner" hidden></div>
    <div id="mNote" hidden></div>
  </div>`);
  document.body.append(wrap);
  const q = (root, s) => root.querySelector(s);
  const R = { card: q(wrap, '#mRoom') }, C = { card: q(wrap, '#mCard') }, banner = q(wrap, '#mBanner'), note = q(wrap, '#mNote');
  for (const k of ['kick', 'set', 'linkK', 'ppl', 'nameBox', 'nameK', 'st', 'start', 'signin', 'retry', 'leave', 'share', 'join']) R[k] = q(R.card, '.m-' + k);
  R.h = q(R.card, 'h2'); R.link = q(R.card, '.m-link input'); R.name = q(R.card, '.m-name input'); R.linkBox = q(R.card, '.m-linkBox');
  for (const k of ['kick', 'sub', 'rows', 'st', 'go', 'full', 'leave']) C[k] = q(C.card, '.m-' + k);
  C.h = q(C.card, 'h2');
  const txt = (el, s) => { s = String(s ?? ''); if (el._t !== s) { el._t = s; el.textContent = s; } };
  const show = (el, on) => { if (el.hidden === !!on) el.hidden = !on; };
  R.kick.textContent = C.kick.textContent = L.kick; R.h.textContent = L.room; R.linkK.textContent = L.linkK; R.link.ariaLabel = L.linkK; R.nameK.textContent = L.nameK;
  R.name.placeholder = L.namePh; R.join.textContent = L.join; R.start.textContent = L.start; R.leave.textContent = L.leave; R.retry.textContent = L.retry; R.signin.textContent = L.signIn;
  C.leave.textContent = L.done; C.full.textContent = L.fullResult; C.go.textContent = L.rematch;
  R.link.value = `${location.origin}/match/${code}?v=${encodeURIComponent(venue.id)}&b=${encodeURIComponent(cls.id)}`;
  R.share.textContent = navigator.share ? L.share : L.copy;

  // ---------- who I am ----------
  let myId = store(ME_KEY);
  if (typeof myId !== 'string' || !/^[a-z0-9]{8,24}$/.test(myId)) { myId = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-4); store(ME_KEY, myId); }
  let boat = null; try { boat = JSON.parse(localStorage.getItem('regatta-boat') || 'null'); } catch (e) {}
  const look = boat && typeof boat === 'object' ? Object.fromEntries(Object.entries(boat).filter(([k]) => k !== 'logoImg')) : null; // her look, less the picture of a logo saved before the logos became the admin's
  let isHost = false, hostSettings = null; // (known once match.js is in: connect())
  let needsAccount = false; // this device made the race, but the site says nobody is signed in: no room, only the question
  sweepSaved();

  // ---------- the state of the screen ----------
  let rt = null, link = null, room = null, M = null, W = null, K = null; // K: the host's Keeper (match.js)
  let Log = null; // duel-log.js: what the site is told of the race (not loaded: nothing is told, and the race goes on)
  let match = null; // Match: the host's own (K.match); the guest's a copy of the host's
  let cur = null; // the race on screen: { seed, race, H | G, acc, at, endedAt, told, gotSnap, loadedAt, rid (its record's id) }
  let phase = 'room'; // 'room' | 'race' | 'card'
  let error = null, left = false, joined = false, build = null, badSet = false;
  let lastHostAt = Date.now(), lastState = 0, stateKey = '', kicked = 0;
  let pendingStart = null; // the guest: a start heard before any mstate
  const pastSeeds = new Set(); // the guest: the races before the one she is on
  const told = new Map(); // what the site has been told, by seed. The host's: { token, settled (its start's tries are over), end (its report, till then) }, the token gone with the end; the guest's: true, she has joined
  let myName = clean(store(NAME_KEY) || '');

  const here = () => ({ venue: venue.id, yacht: cls.id });
  const nameOf = (id) => (match ? (id === match.hostId ? match.start.host.name : id === match.guestId ? match.start.guest.name : '') : '') || '—';
  const onScreen = () => !!cur && cur.seed === match.start.seed; // the race of the Match is the one on screen
  const otherId = () => (match ? (myId === match.hostId ? match.guestId : match.hostId) : null);
  const saveMatch = () => { if (isHost && match) store('regatta-match-' + code, { at: Date.now(), m: match.toJSON(), w: told.get(match.start.seed)?.token ?? undefined }); };
  // the other screen runs another build of the game: never raced; both screens ask for a reload
  const stale = () => {
    if (!room || !build) return false;
    const o = isHost ? (match ? room.peer(match.guestId) : room.guest) : room.host;
    return !!(o && o.build && o.build !== build);
  };

  R.share.addEventListener('click', async () => {
    const url = R.link.value;
    if (navigator.share) { try { await navigator.share({ title: L.kick, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); } catch (e) { R.link.select(); try { document.execCommand('copy'); } catch (x) {} }
    R.share.textContent = L.copied; setTimeout(() => { R.share.textContent = navigator.share ? L.share : L.copy; }, 1600);
  });
  R.link.addEventListener('focus', () => R.link.select());
  // out of the race, to the hub (then: elsewhere). The race lives in the host's tab: with it on, it is abandoned
  const leave = (then = onEnd) => {
    if (left) return;
    left = true;
    try {
      if (isHost && match?.state === 'race') link?.all.send('abandon', { seed: match.start.seed });
      link?.all.send('leave', { id: myId });
    } catch (e) {}
    if (isHost && match?.state === 'race') match.endRace({ abandoned: true }); // (it lived in this tab)
    tellEnd(true); tellPerf(cur);
    cur?.H?.stop(); cur?.G?.stop();
    if (isHost) try { localStorage.removeItem('regatta-match-' + code); } catch (e) {}
    try { room?.leave(); } catch (e) {}
    clearInterval(timer);
    setTimeout(() => { try { rt?.close(); } catch (e) {} }, 400);
    then();
  };
  R.leave.addEventListener('click', () => leave());
  C.leave.addEventListener('click', () => leave());
  C.full.addEventListener('click', () => { const id = resultId(); if (id) leave(() => openResult(id)); });
  R.retry.addEventListener('click', () => location.reload());
  R.signin.addEventListener('click', () => leave(() => { location.href = `/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`; })); // (back to this race)
  addEventListener('pagehide', () => { tellEnd(true); tellPerf(cur); if (!left) try { room?.leave(); } catch (e) {} });
  // the link checked at once when the page comes back to the front or the network comes back: a phone drops a
  // background tab's socket, and the old one may be half-open
  const relink = () => { if (rt && !left) { kicked = Date.now(); rt.reconnect(); } };
  addEventListener('online', relink);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') relink(); });

  // ---------- connecting ----------
  const connect = async () => {
    try {
      let cfg = null;
      try { cfg = await fetch('/connect', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)); } catch (e) {}
      if (!cfg || !cfg.url || !cfg.key) { error = 'connect'; return; }
      if (cfg.name) myName = clean(cfg.name) || myName; // signed in: the account's name
      build = typeof cfg.build === 'string' ? cfg.build : null;
      let net;
      [net, M, W, Log] = await Promise.all([import('./net.js'), import('./match.js'), import('./wire.js'), import('./duel-log.js').catch(() => null)]);
      // hosting takes an account, and the site says who has one: what this device saved only says the race was made here
      const mine = (store(M.HOST_KEY) || {}).code === code;
      if (mine && cfg.canHost !== true) { needsAccount = true; return; }
      isHost = mine;
      hostSettings = isHost ? M.cleanSettings(store(SETTINGS_KEY), here()) : null;
      if (isHost && !settingsHere(hostSettings)) return; // (another page: the host's own venue and yacht)
      R.link.value = `${location.origin}/match/${code}?v=${encodeURIComponent(hostSettings ? hostSettings.venue : venue.id)}&b=${encodeURIComponent(hostSettings ? hostSettings.yacht : cls.id)}`;
      rt = net.realtime({ url: cfg.url, key: cfg.key });
      rt.setHeartbeat(5000); // a race notices a dead link in under 10 s
      link = M.makeLink(rt, code);
      if (myName) openRoom();
    } catch (e) { console.error(e); error = 'connect'; } // a module that didn't load, or anything else: Try again
  };
  // This page's venue and yacht must be the race's (another venue or yacht is another page): sent there once, with
  // fix=1 in the address; on that page still not the race's (a venue or yacht this build hasn't), the host races what
  // the page has (the guest follows its settings), and the guest is told she can't join. True if this page will do.
  const settingsHere = (s) => {
    if (!s || ((!s.venue || s.venue === venue.id) && (!s.yacht || s.yacht === cls.id))) return true;
    const u = new URLSearchParams(location.search);
    if (u.get('fix') !== '1') {
      u.set('venue', s.venue); u.set('boat', s.yacht); u.set('fix', '1');
      try { room?.leave(); } catch (e) {}
      left = true; location.replace(`/play?${u}`); return false;
    }
    if (isHost) { s.venue = venue.id; s.yacht = cls.id; store(SETTINGS_KEY, { ...(store(SETTINGS_KEY) || {}), venue: venue.id, yacht: cls.id }); return true; }
    badSet = true; // the guest can't sail this race here: out of its room, so the host never takes her for its guest
    try { room?.leave(); } catch (e) {}
    return false;
  };
  const openRoom = () => {
    if (room) return;
    store(NAME_KEY, myName);
    room = new M.Room({ link, me: { id: myId, name: myName, look, build }, host: isHost, settings: hostSettings });
    room.joined.then((ok) => { if (!ok) error = 'connect'; else joined = true; });
    room.onStart((m) => onStartMsg(m));
    if (isHost) K = new M.Keeper({ room, link, build });
    link.all.on('mstate', (s) => { if (!isHost && !left) onState(s); });
    link.all.on('leave', (m) => {
      if (!match || !m || m.id !== otherId()) return;
      // the guest gone in a race: before her finish she gives it up, after it it runs on; not yet under way, there's no race
      if (isHost && match.state === 'race') { if (cur?.H) cur.H.guestLeft(); else match.endRace({ abandoned: true }); }
      match.leave(m.id);
      if (isHost) { saveMatch(); sendState(); }
    });
    link.all.on('snap', (s) => { if (!cur || s?.seed !== cur.seed) return; lastHostAt = Date.now(); if (!cur.gotSnap && cur.G) { cur.gotSnap = true; room.pause(true); } }); // (this race's: a late one of the race before says nothing of this)
    link.all.on('ev', (e) => { if (cur && e?.seed === cur.seed) lastHostAt = Date.now(); });
    // a reloaded host, or one whose tab was closed and the link opened again: the race that was on is abandoned (it lived
    // in that tab), one sailed to its end stands
    if (isHost) {
      const saved = savedMatch(code);
      if (saved) try {
        match = M.Match.from(saved.m);
        if (match) {
          if (typeof saved.w === 'string' && /^[0-9a-f]{32,64}$/i.test(saved.w)) told.set(match.start.seed, { token: saved.w, settled: true, end: null }); // (its start was the last page's to tell)
          K.set(match); saveMatch();
        }
      } catch (e) { match = null; }
    }
  };
  R.join.addEventListener('click', () => submitName());
  R.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });
  const submitName = () => {
    const n = clean(R.name.value); if (!n) { R.name.focus(); return; }
    myName = n; store(NAME_KEY, n);
    if (room) room.rename(n); else if (link) openRoom();
    R.name.blur();
  };

  // ---------- the race's state: the host's, sent to the guest ----------
  const onStartMsg = (m) => {
    if (match && match.start.seed === m.seed) return;
    if (isHost) { match = new M.Match({ start: m }); K.set(match); saveMatch(); sendState(); enterRace(); return; }
    pendingStart = { m, at: Date.now() }; // the guest: the host's mstate, if it comes at once, says where the race is
  };
  const sendState = () => {
    if (!isHost || !match || !link) return;
    lastState = Date.now();
    link.all.send('mstate', match.toJSON());
  };
  // the guest takes the race the host sends as this build can sail it
  const guestMatch = (start) => new M.Match({ start: { ...start, settings: M.cleanSettings(start.settings, here()) } });
  const onState = (s) => {
    if (!M.goodState(s)) return;
    if (s.start.guest.id !== myId && s.start.host.id !== myId) return; // somebody else's race: this one is full
    if (pastSeeds.has(s.start.seed)) return; // a late word of a race before this rematch
    lastHostAt = Date.now(); pendingStart = null;
    if (!match || match.start.seed !== s.start.seed) { if (match) pastSeeds.add(match.start.seed); match = guestMatch(s.start); } // a new race: the first, or a rematch
    if (match.state !== 'over' || s.state === 'over') Object.assign(match, { state: s.state, result: s.result ?? null, leftBy: s.leftBy ?? null }); // (a race over stays over, whatever was on its way)
    if (match.state === 'race' && !onScreen() && !stale()) enterRace();
  };
  // the host's view of the guest (Keeper: her inputs in a race, the room after it)
  const present = () => !!K && K.present();

  // this screen's record of the race, kept once, as it has the results (a reload finds its id: resultId)
  const keep = (c, results) => {
    if (c.rid || savedRid(c.seed)) return;
    try { c.rid = keepOneOnOne(c.race, results); store(RESULT_KEY, { code, seed: c.seed, id: c.rid }); } catch (e) { console.error(e); }
  };
  const savedRid = (seed) => { const v = store(RESULT_KEY); return v && v.code === code && v.seed === seed ? v.id : null; };
  const resultId = () => (match ? (onScreen() && cur.rid) || savedRid(match.start.seed) : null);

  // ---------- what the site is told of the race (duel-log.js): in the background, whatever becomes of it ----------
  // the host: the race's start, once, with the token that will prove its end hers
  const tellStart = () => {
    const seed = match.start.seed;
    if (told.has(seed)) return;
    try {
      const l = { token: Log.newToken(), settled: false, end: null };
      told.set(seed, l);
      Log.report(Log.startBody(match, code, l.token), { done: () => { l.settled = true; if (l.end) sendEnd(l); } });
    } catch (e) { console.error(e); }
  };
  const sendEnd = (l) => {
    const body = l.end;
    l.end = null; l.token = null;
    if (!left) saveMatch(); // (the token goes with it: a page opened again has nothing more to tell)
    Log.report(body);
  };
  // the host: the race's end, once, by whatever way it ended. It follows its start's tries, for the site can't place an end
  // that overtakes its start; a page going away (now) can't wait for them
  const tellEnd = (now = false) => {
    if (!Log) return; // (duel-log.js not loaded: nothing to build or send it with, and nothing is changed, so the end still goes if it loads)
    try {
      if (isHost && match?.state === 'over') {
        const l = told.get(match.start.seed), race = onScreen() ? cur.race : null;
        if (l?.token && !l.end) l.end = Log.endBody(match, code, l.token, race, race && M.finalResults(race));
      }
      for (const l of told.values()) if (l.end && (l.settled || now)) sendEnd(l);
    } catch (e) { console.error(e); }
  };
  // this screen's frames in race c and how the other screen's messages came (main.js measures the frames: perf()), once a
  // race: as its card opens, or as the page leaves it; under 20 s of frames tells nothing
  const tellPerf = (c) => {
    if (!c || c.perfTold || !Log?.perfBody || !match) return;
    c.perfTold = true;
    try {
      const p = perf();
      if (p) Log.report(Log.perfBody(match, code, isHost ? 'host' : 'guest', p, (c.H || c.G)?.net() ?? null));
    } catch (e) { console.error(e); }
  };
  // the guest: her joining this race, once
  const tellJoin = () => {
    const seed = match.start.seed;
    if (told.has(seed)) return;
    told.set(seed, true);
    try { Log.report(Log.joinBody(match, code, myName)); } catch (e) { console.error(e); }
  };

  // ---------- the race ----------
  const enterRace = () => {
    cur?.H?.stop(); cur?.G?.stop();
    const race = M.raceFor(match, myId);
    for (const b of race.humans) b.color ??= 0xffffff; // (the first boat has no colour of her own: a computer boat's is never hers)
    race.settings = { ...match.start.settings, fleet: 2, daily: null };
    const c = cur = { seed: match.start.seed, race, H: null, G: null, acc: 0, at: Date.now(), endedAt: 0, told: false, gotSnap: false, loadedAt: 0, rid: null };
    phase = 'race'; show(R.card, false); show(C.card, false);
    if (isHost) { tellStart(); K.lastIn = Date.now(); saveMatch(); sendState(); }
    else {
      tellJoin();
      c.G = new M.Guest({ race, link, me: myId });
      c.G.onEnd((e) => { if (!c.endedAt) c.endedAt = Date.now(); if (c === cur) match.endRace(e); }); // (the host's word, ahead of its next mstate)
      c.G.onResults((m) => keep(c, m));
    }
    onRace(session);
    if (!isHost) sendLoaded();
  };
  const sendLoaded = () => { if (cur && cur.G && !cur.gotSnap) { cur.loadedAt = Date.now(); link.all.send('loaded', { id: myId, seed: match.start.seed }); } };
  // the host's race starts once the guest's screen has it built
  const startHost = () => {
    if (!isHost || !cur || cur.H || cur.endedAt || match.state !== 'race' || K.loaded !== match.start.seed) return;
    K.raceOn();
    cur.H = new M.Host({ race: cur.race, link, guestId: match.guestId, alive: () => Date.now() - rt.lastHeard() < 7000 });
    room.pause(true);
  };
  // the host's race is over, or abandoned: its result to the Match and the guest, and this screen's record
  const hostEnded = () => {
    if (!isHost || !cur?.H || cur.endedAt || !(cur.race.over || cur.H.abandoned)) return;
    const r = cur.race;
    cur.endedAt = Date.now();
    K.raceEnded(cur.H.abandoned ? { abandoned: true } : { winner: r.winner?.id ?? null, margin: r.margin ?? null, forfeited: r.forfeited?.id ?? null, marks: M.marksOf(r) });
    if (!cur.H.abandoned) keep(cur, M.finalResults(r));
    saveMatch(); sendState();
  };
  const session = {
    get race() { return cur?.race; },
    get isGuest() { return !isHost; },
    get debug() { return { cur, phase, match, room, link, K, rt }; }, // (main.js's window.__rg.mx, under ?debug)
    // a frame of the race: the host steps it (once the guest has it), the guest follows the host's; each() before each step
    // (main.js keeps the boats' poses, to draw them between their last two steps)
    step(dt, each = () => {}) {
      if (!cur) return;
      const P = cur.race.player;
      if (cur.H) { cur.acc += dt; while (cur.acc >= STEP) { each(); cur.H.tick(STEP); cur.acc -= STEP; } }
      else if (cur.G) { cur.G.input(W.controlsOf(P)); cur.acc += dt; while (cur.acc >= STEP) { each(); cur.G.frame(STEP); cur.acc -= STEP; } }
      hostEnded();
    },
    // how far the frame is into the next step (0 to 1)
    get frac() { return cur ? Math.min(1, Math.max(0, cur.acc / STEP)) : 0; },
  };

  // the race's result over the water, for a boat that didn't cross the finish herself (her own finish says it)
  const tell = () => {
    const race = cur.race, P = race.player, w = race.winner;
    if (P.done || !w) return;
    if (race.forfeited && race.forfeited !== P) toast(`${L.forfeit(race.forfeited.name)} · ${t('raceWon')}`);
    else toast(w === P ? t('raceWon') : t('raceLost', w.name));
  };

  // ---------- the note over a finished boat's race: who is still out, and for how long ----------
  const paintNote = () => {
    const race = cur?.race, P = race?.player;
    let s = '';
    if (phase === 'race' && race && P.done && !race.over && !cur.endedAt) {
      const o = race.humans.find((b) => b !== P).name, l = timeLeft(race, M.FINISH_LIMIT_S);
      s = [l === null ? L.stillOut(o) : L.stillOutT(o, fmtS(l, L.sec)), isHost ? L.keepOpen : ''].filter(Boolean).join(' · ');
    }
    txt(note, s); show(note, !!s);
  };

  // ---------- the card ----------
  const fmtGap = (s) => (s < 60 ? `${s.toFixed(1)} ${L.sec}` : fmtS(s, L.sec));
  const paintRows = (r) => {
    const boats = onScreen() ? cur.race.humans : [match.hostId, match.guestId].map((id) => ({ id, dsq: r.marks?.[id] === 'DSQ', dnf: r.marks?.[id] === 'DNF' })); // (a page opened again: the result's word for each boat)
    const rows = r.abandoned ? [] : cardRows(boats, r), k = JSON.stringify(rows);
    show(C.rows, rows.length > 0);
    if (C.rows._k === k) return; C.rows._k = k;
    C.rows.textContent = '';
    for (const { id, mark, gap } of rows) {
      const row = document.createElement('div');
      row.append(Object.assign(document.createElement('b'), { textContent: mark }), Object.assign(document.createElement('span'), { textContent: id === myId ? t('you') : nameOf(id) }),
        Object.assign(document.createElement('span'), { textContent: gap != null ? L.by(fmtGap(gap)) : '' }));
      C.rows.append(row);
    }
  };
  const paintCard = () => {
    const r = match.result || { abandoned: true }, o = otherId(), oName = nameOf(o), gone = match.leftBy === o;
    const hereNow = isHost ? present() : Date.now() - lastHostAt < 6000, old = stale();
    txt(C.h, r.abandoned ? L.abandonedH : r.winner === myId ? t('raceWon') : r.winner ? t('raceLost', nameOf(r.winner)) : L.noWinner);
    txt(C.sub, r.abandoned ? L.notScored : r.forfeited ? L.forfeit(r.forfeited === myId ? t('you') : nameOf(r.forfeited)) : '');
    show(C.sub, !!C.sub._t);
    paintRows(r);
    show(C.full, !r.abandoned && !!resultId());
    if (old) { // another build on the other screen: a reload, not a race
      show(C.go, true); txt(C.go, L.reload);
      txt(C.st, L.stale); C.st.classList.add('bad');
      return;
    }
    C.st.classList.remove('bad');
    // the rematch: the host's, with both here, and the results on their way to her done with
    show(C.go, isHost && hereNow && !gone && (!cur?.H || cur.H.stopped)); txt(C.go, L.rematch);
    txt(C.st, gone ? L.left(oName) : !hereNow ? t('waitingHost', oName) : isHost ? '' : L.waitRematch(oName));
  };
  C.go.addEventListener('click', () => {
    if (!match) return;
    if (stale()) { location.reload(); return; }
    if (isHost) rematch();
  });
  const rematch = () => {
    if (!isHost || match.state !== 'over' || !room.canStart()) return;
    const m = room.start(); // the same code, the same settings, a new seed, the same guest; she takes it from the mstate
    if (match.start.seed !== m.seed) onStartMsg(m); // (a reloaded host's first start has been through onStart already)
  };

  // ---------- the waiting room ----------
  // the guest in the room with no host in it, since when (0: not so): after HOST_WAIT_MS it says why that may be
  let alone = 0;
  const hostGone = (h) => {
    if (isHost || !room || h || !joined || error) { alone = 0; return false; }
    if (!alone) alone = Date.now();
    return Date.now() - alone > HOST_WAIT_MS;
  };
  const paintRoom = () => {
    show(R.signin, needsAccount);
    if (needsAccount) {
      txt(R.h, L.hostH); txt(R.set, L.hostP);
      for (const el of [R.linkBox, R.ppl, R.nameBox, R.st, R.start, R.retry]) show(el, false);
      return;
    }
    const raw = (room && room.settings) || hostSettings, s = raw && M ? M.cleanSettings(raw, here()) : null;
    txt(R.set, s ? [venueName(s.venue), yachtName(s.yacht), t(s.preset), t(LENGTH_KEY[s.length]), t(SHAPE_KEY[s.course]), L.laps(s.laps), L.startMin(s.start), s.current ? L.currentOn : '', s.daytime !== 'any' ? L.daytime(s.daytime) : ''].filter(Boolean).join(' · ') : '');
    const full = !!room && room.full;
    const h = room ? room.host : isHost ? { id: myId, name: myName || '…' } : null, g = room && room.guest;
    const rows = [[h, L.hostTag], [full ? null : g, '']];
    const k = JSON.stringify(rows.map(([p]) => p && [p.id, p.name])) + full + !!room + joined;
    if (R.ppl._k !== k) {
      R.ppl._k = k; R.ppl.textContent = '';
      for (const [p, tag] of rows) {
        const row = document.createElement('div'); row.className = 'm-p' + (p ? '' : ' empty');
        if (p) {
          row.append(Object.assign(document.createElement('span'), { textContent: clean(p.name) || '—' }));
          const tags = [p.id === myId ? L.youTag : '', tag].filter(Boolean).join(' · ');
          if (tags) row.append(Object.assign(document.createElement('span'), { className: 't', textContent: tags }));
        } else row.textContent = isHost ? L.waitFriend : joined ? L.waitHost : L.connecting; // (the guest: joined, the host just isn't there)
        if (p || (room && !full && row.textContent)) R.ppl.append(row); // (before the room is open, or a full one: only who is known)
      }
    }
    show(R.linkBox, isHost);
    show(R.nameBox, (!room || !full) && !badSet); show(R.ppl, !badSet); // (a race this page can't sail: only why)
    if (document.activeElement !== R.name && !R.name.value) R.name.value = myName;
    const old = stale();
    show(R.retry, !!error || old); txt(R.retry, old ? L.reload : L.retry);
    const gone = hostGone(h);
    let st = '', bad = false;
    if (badSet) { st = L.badSet; bad = true; }
    else if (error) { st = L.noConnect; bad = true; }
    else if (old) { st = L.stale; bad = true; }
    else if (!link) st = L.connecting;
    else if (!room) st = L.nameFirst;
    else if (full) { st = L.fullRoom; bad = true; }
    else if (isHost) st = ''; // (alone, the friend's row says it)
    else if (gone) st = L.noHost || MATCH_STRINGS.en.noHost; // and Leave, lit, is the way on
    else st = h ? L.waitStart(clean(h.name)) : joined ? '' : L.connecting; // (no host yet: its row says so)
    R.leave.classList.toggle('m-prim', gone);
    txt(R.st, st); R.st.classList.toggle('bad', bad); show(R.st, !!st);
    show(R.start, isHost && !error);
    R.start.disabled = !(room && room.canStart()) || old;
  };
  R.start.addEventListener('click', () => { if (room && room.canStart() && !match && !stale()) room.start(); });

  // ---------- the beat: four times a second ----------
  const beat = () => {
    if (left) return;
    const now = Date.now();
    // the guest's settings must be the host's: another venue or yacht is another page (sent there once)
    if (!isHost && room && room.settings && !match && !badSet && !settingsHere(room.settings) && left) return;
    if (!isHost && pendingStart && now - pendingStart.at > 1500 && (!match || match.start.seed !== pendingStart.m.seed)) {
      const m = pendingStart.m; pendingStart = null; match = guestMatch(m); enterRace();
    }
    if (isHost && match) {
      K.beat(); // her presence to the Match
      startHost();
      hostEnded(); // (a race given up with this tab in the background, its frames stopped)
      tellEnd();
      const key = `${match.state}|${match.leftBy}`;
      if (key !== stateKey || now - lastState > (match.state === 'race' ? 2000 : 1000)) { if (key !== stateKey) saveMatch(); stateKey = key; sendState(); }
    }
    if (!isHost && match) {
      if (cur && cur.G && !cur.gotSnap && now - cur.loadedAt > 1000) sendLoaded();
      if (onScreen() && cur.G?.abandoned) match.endRace({ abandoned: true });
      if (match.state !== 'over' && now - lastHostAt > 300000) match.endRace({ abandoned: true }); // her host gone five minutes: over
    }
    // a race gone quiet 3 s (no snapshot on the guest's screen, no input from a boat still out on the host's): the link
    // checked, at once and then every 10 s while it stays quiet (a half-open socket would otherwise take a heartbeat or
    // two to notice)
    if (cur && phase === 'race' && !cur.endedAt && (cur.G ? cur.gotSnap && now - lastHostAt > 3000 : cur.H && !cur.H.guest.done && now - K.lastIn > 3000) && now - kicked > 10000) relink();
    // the race ends: its last moments on the water, then its card
    if (cur && phase === 'race') {
      const done = match.state !== 'race' || !onScreen(); // the race was sailed, abandoned or left
      if (!cur.endedAt && done) cur.endedAt = now;
      if (cur.endedAt && !cur.told) { cur.told = true; tell(); }
      if (cur.endedAt && done && now - cur.endedAt >= CARD_MS) {
        if (isHost) K.raceOff();
        room?.pause(false);
        tellPerf(cur);
        phase = 'card'; onIdle();
      }
    }
    // The race's end outlives its frames: the host goes on repeating the last snapshot, the end and the results until the
    // guest has them, and the guest goes on listening, for RESULTS_MS at the most
    const H = cur?.H, G = cur?.G, waited = !!cur && now - cur.endedAt >= RESULTS_MS;
    if (H && !H.stopped && cur.endedAt) {
      if (cur.race.over && !H.acked && !waited) { H.tick(0); H.flush(); }
      else if (phase === 'card') H.stop();
    }
    if (G && !G.stopped && phase === 'card' && (G.results || match.result?.abandoned || waited)) G.stop();
    if (phase === 'room' && match && match.state !== 'race') { phase = 'card'; show(R.card, false); } // a reloaded page, after the race
    // what's on screen
    show(R.card, phase === 'room'); if (phase === 'room') paintRoom();
    show(C.card, phase === 'card' && !!match); if (phase === 'card' && match) paintCard();
    let b = '';
    if (phase === 'race' && cur) {
      if (isHost && !cur.H && !cur.endedAt) b = L.loadingRace(nameOf(match.guestId));
      else if (isHost && cur.H && !cur.endedAt && !cur.H.guest.done && now - K.lastIn > 3000) b = t('guestGone', nameOf(match.guestId));
      else if (!isHost && cur.G?.abandoned) b = t('abandoned'); // (over the last moments on the water: the race has already ended)
      else if (!isHost && cur.G && !cur.endedAt && (cur.G.hostSilent || (!cur.gotSnap && now - cur.at > 4000))) b = t('waitingHost', nameOf(match.hostId));
    }
    txt(banner, b); show(banner, !!b);
    paintNote();
  };
  const timer = setInterval(beat, 250);

  api = { leave };
  paintRoom();
  await connect();
  // a reloaded host goes straight to the card it was on
  if (isHost && match) { phase = 'card'; show(R.card, false); }
  beat();
}
