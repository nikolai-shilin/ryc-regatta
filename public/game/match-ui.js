// A match race on screen: the waiting room, each race against the friend, the cards between the races and at the
// end, the HUD's match strip (your side, the score, each boat's penalties, the entry) and, with &debug=umpire in the
// address, the umpire's calls with their reasons. main.js imports this module only when the address has ?match=<code>,
// and this module imports the Realtime client and the match's protocol (net.js, match.js, wire.js) only once it runs:
// nobody sailing today's race or a free race downloads any of it.
//
// Who runs what: the host's game runs each race (match.js Host) and keeps the match (Match: the score, the races, who
// is ready); the guest's follows (Guest) and copies the host's match from its 'mstate' messages. On 'match:CODE'
// (link.all), besides the Room's and the race's own messages:
//   mstate  host → guest  { start, state, raceN, score, races, leftBy, ready: [ids], left (s to the automatic start,
//                          or null), calls (this race's umpire calls with their reasons) } on every change, every
//                          second between races and every two seconds in one (a reloaded guest learns where it is)
//   loaded  guest → host  { id, n } race n is built on her screen: the host's race starts then (its silence timers
//                          with it), so a slow phone still building the venue isn't forfeited; every second till it is
//   ready   guest → host  { id, n } Ready on the card before race n; every second till the host has it
//   leave   either        { id } Leave or Done: the match is over, on both screens
const STEP = 1 / 60;
const CARD_MS = 3500; // a race's end stays on the water this long before its card
const NAME_KEY = 'regatta-match-name', ME_KEY = 'regatta-match-me', SETTINGS_KEY = 'regatta-match-settings';
const BLUE = '#2f7dff', YELLOW = '#f5c400';
const SIDE_HEX = { blue: 0x2f7dff, yellow: 0xf5c400 };

export const MATCH_STRINGS = {
  en: {
    kick: 'Match race', room: 'Waiting room', linkK: 'Send your friend this link', share: 'Share', copy: 'Copy', copied: 'Copied',
    bestOf: 'Best of three · first to two wins', nameK: 'Your name', namePh: 'Your name', youTag: 'you', hostTag: 'host',
    blue: 'blue', yellow: 'yellow', blueEnd: 'the committee boat end', yellowEnd: 'the pin end',
    waitFriend: 'Waiting for a friend…', waitStart: (n) => `Waiting for ${n} to start the match…`, start: 'Start the match', leave: 'Leave',
    connecting: 'Connecting…', noConnect: 'Couldn’t connect to the match', retry: 'Try again', nameFirst: 'Type your name to join', join: 'Join',
    sides: 'Race 1: the host is blue, at the committee boat end; the friend yellow, at the pin. The colours swap each race.',
    raceN: (n) => `Race ${n}`, youWin: (n) => `You win race ${n}`, theyWin: (w, n) => `${w} wins race ${n}`, by: (s) => `by ${s}`,
    forfeit: (w) => `${w} dropped out`, abandonedN: (n) => `Race ${n} abandoned — not scored`, score: 'Score',
    next: (n, side, end) => `Race ${n}: you are ${side} — enter at ${end}`, ready: 'Ready', readyOn: 'Ready ✓', theyReady: (w) => `${w} is ready`,
    autoIn: (s) => `Starts when you’re both ready, or in ${s}`, waitBoth: 'Starts once you’re both here',
    rematch: 'Rematch', done: 'Done', waitRematch: (w) => `${w} can start a rematch`, left: (w) => `${w} left the match`,
    gone: (w) => `${w} was gone five minutes — the match is over`, matchK: 'Match', abandonedR: 'abandoned', forfeitR: 'dropped out',
    enter: (end) => `Enter at ${end}, 4:00 to 2:00: across the line from the course side`, entered: 'Entered ✓',
    penHow: 'Penalty owed: on a beat bear away and gybe, then back up to close-hauled; on a run tack, then bear away', loadingRace: (w) => `Waiting for ${w} to load the race…`,
    umpireK: 'Umpire’s calls', noCalls: 'no calls yet', contact: 'contact', turned: (s) => `turned at ${s}`, gap: (m) => `gap ${m} m`, look: (s) => `in ${s} s`,
    sec: 's', waitHost: 'Waiting for the host…', stale: 'The game was updated: reload to join', reload: 'Reload',
    badSet: 'This match is set at a venue or on a yacht this page can’t open', askK: 'Leave the match?',
    askT: 'It ends on both screens, at the score it has.', stay: 'Stay',
  },
  ru: {
    kick: 'Матчевая гонка', room: 'Зал ожидания', linkK: 'Отправь другу эту ссылку', share: 'Поделиться', copy: 'Скопировать', copied: 'Скопировано',
    bestOf: 'До двух побед из трёх гонок', nameK: 'Твоё имя', namePh: 'Твоё имя', youTag: 'ты', hostTag: 'хозяин',
    blue: 'синий', yellow: 'жёлтый', blueEnd: 'у судейского судна', yellowEnd: 'у знака',
    waitFriend: 'Ждём соперника…', waitStart: (n) => `Ждём, когда ${n} начнёт матч…`, start: 'Начать матч', leave: 'Выйти',
    connecting: 'Подключаемся…', noConnect: 'Не удалось подключиться к матчу', retry: 'Ещё раз', nameFirst: 'Напиши имя, чтобы войти', join: 'Войти',
    sides: 'Гонка 1: хозяин — синий, вход у судейского судна; гость — жёлтый, у знака. Цвета меняются каждую гонку.',
    raceN: (n) => `Гонка ${n}`, youWin: (n) => `Гонка ${n} — твоя`, theyWin: (w, n) => `Гонка ${n} — ${w}`, by: (s) => `отрыв ${s}`,
    forfeit: (w) => `${w}: сход`, abandonedN: (n) => `Гонка ${n} прекращена — не засчитана`, score: 'Счёт',
    next: (n, side, end) => `Гонка ${n}: ты — ${side}, вход ${end}`, ready: 'Готов', readyOn: 'Готов ✓', theyReady: (w) => `${w}: готов(а)`,
    autoIn: (s) => `Старт, когда оба готовы, или через ${s}`, waitBoth: 'Старт — когда вы оба на месте',
    rematch: 'Реванш', done: 'Закончить', waitRematch: (w) => `${w} может начать реванш`, left: (w) => `${w}: выход из матча`,
    gone: (w) => `${w} не на связи пять минут — матч окончен`, matchK: 'Матч', abandonedR: 'прекращена', forfeitR: 'сход',
    enter: (end) => `Вход ${end}, с 4:00 до 2:00: пересеки линию со стороны дистанции`, entered: 'Вход ✓',
    penHow: 'Штраф: на лавировке уваливайся и делай поворот фордевинд, потом приводись до бейдевинда; на попутном — оверштаг, потом уваливайся', loadingRace: (w) => `${w} загружает гонку…`,
    umpireK: 'Решения судьи', noCalls: 'решений пока нет', contact: 'касание', turned: (s) => `поворот в ${s}`, gap: (m) => `зазор ${m} м`, look: (s) => `через ${s} с`,
    sec: 'с', waitHost: 'Ждём хозяина матча…', stale: 'Игра обновилась: перезагрузи страницу, чтобы войти', reload: 'Перезагрузить',
    badSet: 'Этот матч в месте или на яхте, которых эта страница не открывает', askK: 'Выйти из матча?',
    askT: 'Матч закончится на обоих экранах, со счётом как есть.', stay: 'Остаться',
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
#mWrap button.on { background: var(--up); color: var(--ink-on); }
#mWrap .m-btns { display: flex; gap: var(--s-2); } #mWrap .m-btns button { flex: 1 1 0; }
#mWrap .m-ppl { display: flex; flex-direction: column; border-top: 1px solid var(--rule); }
#mWrap .m-p { display: flex; align-items: center; gap: var(--s-2); height: 40px; border-bottom: 1px solid var(--rule-2); font: 700 var(--fs-row)/1 var(--cond); }
#mWrap .m-p.empty { color: var(--ink-3); font-weight: 600; font-size: var(--fs-small); }
#mWrap .m-p .t { font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
#mWrap .m-chip, #mHud .m-chip { width: 12px; height: 12px; flex: none; background: var(--c); box-shadow: 0 0 0 2px rgba(0,0,0,.35); }
#mWrap .m-st { font: 600 var(--fs-small)/1.3 var(--sans); color: var(--ink-2); }
#mWrap .m-st.bad { color: var(--down); }
#mWrap .m-score { display: flex; align-items: center; justify-content: center; gap: var(--s-4); font: 800 var(--fs-h3)/1 var(--cond); }
#mWrap .m-score em { font-style: normal; }
#mWrap .m-score span { display: flex; align-items: center; gap: var(--s-2); font: 700 var(--fs-row)/1 var(--cond); }
#mWrap .m-races { display: flex; flex-direction: column; border-top: 1px solid var(--rule); }
#mWrap .m-races div { display: flex; justify-content: space-between; gap: var(--s-3); height: 32px; align-items: center; border-bottom: 1px solid var(--rule-2); font: 600 var(--fs-small)/1 var(--cond); }
#mWrap .m-races b { font-weight: 700; }
#mBanner { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); max-width: calc(100% - 32px); padding: var(--s-3) var(--s-5); background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  font: 700 var(--fs-lead)/1.2 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; text-align: center; border-left: 4px solid var(--live); }
#mHud { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 112px); transform: translateX(-50%); z-index: 3; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: var(--s-1); }
#mHud[hidden] { display: none; }
#mHud .mh-row { display: flex; align-items: stretch; background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); font: 700 var(--fs-small)/1 var(--cond); text-transform: uppercase; letter-spacing: var(--ls-name); }
#mHud .mh-b { display: flex; align-items: center; gap: var(--s-2); padding: 0 var(--s-3); height: 30px; }
#mHud .mh-b.me b { color: var(--you); }
#mHud .mh-sc { display: flex; align-items: center; padding: 0 var(--s-3); background: var(--fill-2); font-size: var(--fs-lead); font-weight: 800; }
#mHud .mh-pen { display: flex; gap: 3px; }
#mHud .mh-pen i { width: 14px; height: 14px; background: var(--live); color: #fff; font: 800 10px/14px var(--cond); font-style: normal; text-align: center; }
#mHud .mh-pen i.turn { animation: mh-blink .5s steps(2, start) infinite; }
@keyframes mh-blink { to { visibility: hidden; } }
#mHud .mh-note { max-width: min(560px, calc(100vw - 32px)); padding: var(--s-1) var(--s-3); background: var(--panel); font: 600 var(--fs-label)/1.3 var(--sans); color: var(--ink-2); text-align: center; }
#mHud .mh-note.ok { color: var(--up); }
#mDbg { position: fixed; left: 8px; bottom: 8px; z-index: 11; max-width: min(520px, calc(100vw - 16px)); max-height: 40vh; overflow: auto; padding: 6px 8px; background: rgba(0,0,0,.72); color: #dfe; font: 11px/1.4 ui-monospace, Menlo, monospace; white-space: pre-wrap; pointer-events: auto; }
@media (max-height: 500px) { #mHud { top: calc(env(safe-area-inset-top, 0px) + 94px); } #mHud .mh-note { max-width: min(420px, calc(100vw - 32px)); } #mWrap .m-card { padding: var(--s-4); gap: var(--s-2); } }
`;

const html = (s) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild; };
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; };
const fmtS = (s, unit = 's') => { s = Math.max(0, Math.round(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} ${unit}`; };
// a host's match, kept in localStorage['regatta-match-' + code] as { at, m } for six hours (a tab closed and the link
// opened again finds its score); Leave or Done clears it, and an open page sweeps away any other code's gone stale
const SAVED_MS = 6 * 3600 * 1000, SAVED_RE = /^regatta-match-[A-HJ-KM-NP-Z2-9]{6}$/;
const savedMatch = (code) => {
  let v = null; try { v = JSON.parse(localStorage.getItem('regatta-match-' + code) || 'null'); } catch (e) {}
  return v && v.m && v.m.start && Date.now() - v.at < SAVED_MS ? v.m : null;
};
const sweepSaved = () => { try { for (const k of Object.keys(localStorage)) if (SAVED_RE.test(k)) { let v = null; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) {} if (!v || !(Date.now() - v.at < SAVED_MS)) localStorage.removeItem(k); } } catch (e) {} };
const fmtC = (c) => `${c < 0 ? '−' : ''}${Math.floor(Math.abs(c) / 60)}:${(Math.abs(c) % 60).toFixed(1).padStart(4, '0')}`;

let api = null; // the match on this page, for main.js's leaveMatch() and askLeave()
// Leave the match: on both screens it's over (main.js's pause menu's Leave, asked and answered)
export function leaveMatch() { if (api) api.leave(); }
// Back, or Telegram's back button, with no race on the water (between races, just after a finish): the match's own
// question, Leave or Stay; asked again, it's Stay. With no match yet, or one over, it simply leaves
export function askLeave() { if (api) api.ask(); }

// The match at `code` on this page. t: main.js's words (the T keys); world, venue and cls: the page's; onRace(session)
// puts a race on screen ({ race, step(dt), isGuest }), onIdle() takes it off (a card, the waiting room); onEnd() leaves
// the page; toast(text) says a word over the race. yachtName(id) and venueName(id) for the waiting room's settings.
export async function startMatch({ code, t, LANG = 'en', onRace, onIdle = () => {}, onEnd = () => {}, toast = () => {}, venue, cls, yachtName = (id) => id, venueName = (id) => id }) {
  const L = MATCH_STRINGS[LANG] || MATCH_STRINGS.en;
  const debug = /[?&]debug=umpire\b/.test(location.search);
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const wrap = html(`<div id="mWrap" class="bc">
    <div class="m-card" id="mRoom" role="dialog" aria-labelledby="mRoomH">
      <span class="m-kick"></span><h2 id="mRoomH"></h2>
      <p class="m-set"></p>
      <div class="m-linkBox"><span class="m-k m-linkK"></span><div class="m-link"><input readonly aria-label="link"><button type="button" class="m-share"></button></div></div>
      <div class="m-ppl"></div>
      <div class="m-nameBox"><span class="m-k m-nameK"></span><div class="m-name"><input maxlength="16" autocomplete="nickname"><button type="button" class="m-join"></button></div></div>
      <p class="m-sides"></p>
      <span class="m-st"></span>
      <button type="button" class="m-prim m-start"></button>
      <div class="m-btns"><button type="button" class="m-retry" hidden></button><button type="button" class="m-leave"></button></div>
    </div>
    <div class="m-card" id="mCard" role="dialog" aria-labelledby="mCardH" hidden>
      <span class="m-kick"></span><h2 id="mCardH"></h2><p class="m-sub"></p>
      <div class="m-score"></div>
      <div class="m-races"></div>
      <span class="m-st"></span>
      <button type="button" class="m-prim m-go"></button>
      <div class="m-btns"><button type="button" class="m-leave"></button></div>
    </div>
    <div class="m-card" id="mAsk" role="alertdialog" aria-labelledby="mAskH" hidden>
      <span class="m-kick"></span><h2 id="mAskH"></h2><p class="m-sub"></p>
      <div class="m-btns"><button type="button" class="m-prim m-stay"></button><button type="button" class="m-out"></button></div>
    </div>
    <div id="mBanner" hidden></div>
  </div>`);
  document.body.append(wrap);
  const hudEl = html(`<div id="mHud" class="bc" hidden><div class="mh-row"><span class="mh-b me"><i class="m-chip"></i><b></b><span class="mh-pen"></span></span><span class="mh-sc"></span><span class="mh-b them"><span class="mh-pen"></span><b></b><i class="m-chip"></i></span></div><div class="mh-note" hidden></div></div>`);
  document.body.append(hudEl);
  const dbg = debug ? html('<div id="mDbg"></div>') : null;
  if (dbg) document.body.append(dbg);
  const q = (root, s) => root.querySelector(s);
  const R = { card: q(wrap, '#mRoom') }, C = { card: q(wrap, '#mCard') }, A = { card: q(wrap, '#mAsk') }, banner = q(wrap, '#mBanner');
  for (const k of ['kick', 'sub', 'stay', 'out']) A[k] = q(A.card, '.m-' + k);
  A.h = q(A.card, 'h2');
  for (const k of ['kick', 'set', 'linkK', 'ppl', 'nameBox', 'nameK', 'sides', 'st', 'start', 'retry', 'leave', 'share', 'join']) R[k] = q(R.card, '.m-' + k);
  R.h = q(R.card, 'h2'); R.link = q(R.card, '.m-link input'); R.name = q(R.card, '.m-name input'); R.linkBox = q(R.card, '.m-linkBox');
  for (const k of ['kick', 'sub', 'score', 'races', 'st', 'go', 'leave']) C[k] = q(C.card, '.m-' + k);
  C.h = q(C.card, 'h2');
  const txt = (el, s) => { s = String(s ?? ''); if (el._t !== s) { el._t = s; el.textContent = s; } };
  const show = (el, on) => { if (el.hidden === !!on) el.hidden = !on; };
  R.kick.textContent = C.kick.textContent = L.kick; R.h.textContent = L.room; R.linkK.textContent = L.linkK; R.nameK.textContent = L.nameK;
  R.name.placeholder = L.namePh; R.join.textContent = L.join; R.start.textContent = L.start; R.leave.textContent = L.leave; R.retry.textContent = L.retry;
  R.sides.textContent = L.sides; C.leave.textContent = L.done;
  A.kick.textContent = L.kick; A.h.textContent = L.askK; A.sub.textContent = L.askT; A.stay.textContent = L.stay; A.out.textContent = L.leave;
  R.link.value = `${location.origin}/match/${code}?v=${encodeURIComponent(venue.id)}&b=${encodeURIComponent(cls.id)}`;
  R.share.textContent = navigator.share ? L.share : L.copy;

  // ---------- who I am ----------
  let myId = store(ME_KEY);
  if (typeof myId !== 'string' || !/^[a-z0-9]{8,24}$/.test(myId)) { myId = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-4); store(ME_KEY, myId); }
  let boat = null; try { boat = JSON.parse(localStorage.getItem('regatta-boat') || 'null'); } catch (e) {}
  const look = boat && typeof boat === 'object' ? Object.fromEntries(Object.entries(boat).filter(([k]) => k !== 'logoImg')) : null; // her look, less her own logo's picture
  let isHost = false, hostSettings = null; // (known once match.js is in: connect())
  sweepSaved();

  // ---------- the state of the screen ----------
  let rt = null, link = null, room = null, M = null, W = null, K = null; // K: the host's Keeper (match.js)
  let match = null; // Match: the host's own (K.match); the guest's a copy of the host's
  let cur = null; // the race on screen: { n, seed (its match's), race, H | G, acc, at, endedAt, told, gotSnap, loadedAt }
  let phase = 'room'; // 'room' | 'race' | 'card'
  let error = null, left = false, joined = false, build = null, asking = false, badSet = false;
  let readyIds = new Set(), readySent = 0, wantReady = null, lastHostAt = Date.now(), lastState = 0, stateKey = '', kicked = 0;
  let pendingStart = null, autoLeft = null; // the guest: a start heard before any mstate; the host's seconds to the automatic start
  let myName = clean(store(NAME_KEY) || '');

  const nameOf = (id) => (match ? (id === match.hostId ? match.start.host.name : id === match.guestId ? match.start.guest.name : '') : '') || '—';
  const onScreen = () => !!cur && cur.n === match.raceN && cur.seed === match.start.seed; // the match's race is the one on screen
  const otherId = () => (match ? (myId === match.hostId ? match.guestId : match.hostId) : null);
  const saveMatch = () => { if (isHost && match) store('regatta-match-' + code, { at: Date.now(), m: match.toJSON() }); };
  const ready = () => (isHost && K ? K.ready : readyIds);
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
  const leave = () => {
    if (left) return;
    left = true;
    try { link?.all.send('leave', { id: myId }); } catch (e) {}
    cur?.H?.stop(); cur?.G?.stop();
    if (isHost) try { localStorage.removeItem('regatta-match-' + code); } catch (e) {}
    try { room?.leave(); } catch (e) {}
    clearInterval(timer);
    setTimeout(() => { try { rt?.close(); } catch (e) {} }, 400);
    onEnd();
  };
  // the match's question: Leave, or Stay (asked again, Stay)
  const ask = () => {
    if (left) return;
    if (!match || match.state === 'over') { leave(); return; }
    asking = !asking; beat();
    if (asking) A.stay.focus();
  };
  R.leave.addEventListener('click', leave);
  C.leave.addEventListener('click', () => (match && match.state !== 'over' ? ask() : leave())); // between races, asked; Done, at once
  A.out.addEventListener('click', leave);
  A.stay.addEventListener('click', () => { asking = false; beat(); });
  R.retry.addEventListener('click', () => location.reload());
  addEventListener('pagehide', () => { if (!left) try { room?.leave(); } catch (e) {} });
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
      [net, M, W] = await Promise.all([import('./net.js'), import('./match.js'), import('./wire.js')]);
      isHost = (store(M.HOST_KEY) || {}).code === code;
      const mySet = isHost ? store(SETTINGS_KEY) : null;
      hostSettings = mySet && typeof mySet === 'object' ? { venue: String(mySet.venue || venue.id), yacht: String(mySet.yacht || cls.id), preset: ['light', 'medium', 'strong'].includes(mySet.preset) ? mySet.preset : 'medium', length: mySet.length === 'medium' ? 'medium' : 'short' }
        : isHost ? { venue: venue.id, yacht: cls.id, preset: 'medium', length: 'short' } : null;
      if (isHost && !settingsHere(hostSettings)) return; // (another page: the host's own venue and yacht)
      R.link.value = `${location.origin}/match/${code}?v=${encodeURIComponent(hostSettings ? hostSettings.venue : venue.id)}&b=${encodeURIComponent(hostSettings ? hostSettings.yacht : cls.id)}`;
      rt = net.realtime({ url: cfg.url, key: cfg.key });
      rt.setHeartbeat(5000); // a match notices a dead link in under 10 s
      link = M.makeLink(rt, code);
      if (myName) openRoom();
    } catch (e) { console.error(e); error = 'connect'; } // a module that didn't load, or anything else: Try again
  };
  // This page's venue and yacht must be the match's (another venue or yacht is another page): sent there once, with
  // fix=1 in the address; on that page still not the match's (a venue or yacht this build hasn't), the host races what
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
    badSet = true; // the guest can't sail this match here: out of its room, so the host never takes her for its guest
    try { room?.leave(); } catch (e) {}
    return false;
  };
  const openRoom = () => {
    if (room) return;
    store(NAME_KEY, myName);
    room = new M.Room({ link, me: { id: myId, name: myName, look, build }, host: isHost, settings: hostSettings });
    room.joined.then((ok) => { if (!ok) error = 'connect'; else joined = true; });
    room.onStart((m) => onStartMsg(m));
    if (isHost) K = new M.Keeper({ room, link, build, onChange: () => sendState() });
    link.all.on('mstate', (s) => { if (!isHost && !left) onState(s); });
    link.all.on('leave', (m) => {
      if (!match || !m || m.id !== otherId()) return;
      if (isHost) { match.leave(m.id); saveMatch(); sendState(); } else { match.state = 'over'; match.leftBy = m.id; }
    });
    link.all.on('snap', () => { lastHostAt = Date.now(); if (cur && !cur.gotSnap && cur.G) { cur.gotSnap = true; room.pause(true); } });
    link.all.on('ev', () => { lastHostAt = Date.now(); });
    // a reloaded host, or one whose tab was closed and the link opened again: the match goes on from its saved score,
    // the race that was on abandoned (it lived in that tab)
    if (isHost) {
      const saved = savedMatch(code);
      if (saved) try { match = M.Match.from(saved); K.set(match); saveMatch(); } catch (e) { match = null; }
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

  // ---------- the match: the host's, sent to the guest ----------
  const onStartMsg = (m) => {
    if (match && match.start.seed === m.seed) return;
    if (isHost) { match = new M.Match({ start: m }); K.set(match); saveMatch(); sendState(); enterRace(); return; }
    pendingStart = { m, at: Date.now() }; // the guest: the host's mstate, if it comes at once, says where the match is
  };
  const sendState = () => {
    if (!isHost || !match || !link) return;
    lastState = Date.now();
    const c = onScreen() ? cur.race.calls : [];
    link.all.send('mstate', { ...match.toJSON(), ready: [...K.ready], left: K.left(), calls: c.slice(-20) });
  };
  let hostCalls = [];
  const onState = (s) => {
    if (!s || !s.start || !s.start.host || !s.start.guest) return;
    if (s.start.guest.id !== myId && s.start.host.id !== myId) return; // somebody else's match: this one is full
    lastHostAt = Date.now(); pendingStart = null;
    if (!match || match.start.seed !== s.start.seed) { match = new M.Match({ start: s.start }); wantReady = null; } // a new match: the first, or a rematch
    Object.assign(match, { state: s.state, raceN: s.raceN, score: s.score, races: s.races, leftBy: s.leftBy ?? null });
    readyIds = new Set(s.ready || []); hostCalls = Array.isArray(s.calls) ? s.calls : []; autoLeft = s.left ?? null;
    if (match.state === 'race' && !onScreen() && !stale()) enterRace();
  };
  // the host's view of the guest (Keeper: her inputs in a race, the room between them)
  const present = () => !!K && K.present();

  // ---------- a race ----------
  const enterRace = () => {
    const n = match.raceN;
    cur?.H?.stop(); cur?.G?.stop();
    const race = M.raceFor(match, myId);
    for (const b of race.humans) b.color = SIDE_HEX[b.side];
    race.settings = { ...match.start.settings, laps: 2, start: 5, fleet: 2, course: 'wl', current: 0, daily: null, match: true };
    cur = { n, seed: match.start.seed, race, H: null, G: null, acc: 0, at: Date.now(), endedAt: 0, told: false, gotSnap: false, loadedAt: 0 };
    phase = 'race'; asking = false; show(R.card, false); show(C.card, false); show(A.card, false);
    if (isHost) { K.lastIn = Date.now(); saveMatch(); sendState(); }
    else {
      cur.G = new M.Guest({ race, link, me: myId });
      cur.G.onEnd(() => { if (!cur.endedAt) cur.endedAt = Date.now(); });
    }
    onRace(session);
    if (!isHost) sendLoaded();
  };
  const sendLoaded = () => { if (cur && cur.G && !cur.gotSnap) { cur.loadedAt = Date.now(); link.all.send('loaded', { id: myId, n: cur.n, seed: match.start.seed }); } };
  // the host's race starts once the guest's screen has it built
  const startHost = () => {
    if (!isHost || !cur || cur.H || cur.endedAt || match.state !== 'race' || K.loaded.seed !== match.start.seed || K.loaded.n < cur.n) return;
    K.raceOn();
    cur.H = new M.Host({ race: cur.race, link, guestId: match.guestId, alive: () => Date.now() - rt.lastHeard() < 7000 });
    room.pause(true);
  };
  const session = {
    get race() { return cur?.race; },
    get isGuest() { return !isHost; },
    get debug() { return { cur, phase, match, room, link, K, rt }; }, // (main.js's window.__rg.mx, under ?debug)
    // a frame of the race: the host steps it (once the guest has it), the guest follows the host's
    step(dt) {
      if (!cur) return;
      const P = cur.race.player;
      if (cur.H) { cur.acc += dt; while (cur.acc >= STEP) { cur.H.tick(STEP); cur.acc -= STEP; } }
      else if (cur.G) { cur.G.input(W.controlsOf(P)); cur.acc += dt; while (cur.acc >= STEP) { cur.G.frame(STEP); cur.acc -= STEP; } }
      if (isHost && cur.H && !cur.endedAt && (cur.race.over || cur.H.abandoned)) {
        cur.endedAt = Date.now();
        K.raceEnded(cur.H.abandoned ? { abandoned: true } : { winner: cur.race.winner?.id ?? null, margin: cur.race.margin ?? null });
        saveMatch(); sendState();
      }
      paintHud();
    },
  };

  // the race's result over the water, for a boat that didn't cross the finish herself (her own finish says it)
  const tell = () => {
    const race = cur.race, P = race.player, w = race.winner;
    if (P.done || !w) return;
    if (race.forfeited && race.forfeited !== P) toast(`${L.forfeit(race.forfeited.name)} · ${t('raceWon')}`);
    else toast(w === P ? t('raceWon') : t('raceLost', w.name));
  };

  // ---------- the HUD's strip: your side, the score, each boat's penalties, the entry ----------
  const H = { me: q(hudEl, '.mh-b.me'), them: q(hudEl, '.mh-b.them'), sc: q(hudEl, '.mh-sc'), note: q(hudEl, '.mh-note') };
  const pens = (el, b) => {
    const k = `${b.owed || 0}|${b.pen ? 1 : 0}`; if (el._k === k) return; el._k = k;
    el.innerHTML = Array.from({ length: b.owed || 0 }, (_, i) => `<i class="${i === 0 && b.pen ? 'turn' : ''}">P</i>`).join('');
  };
  const paintHud = () => {
    if (!cur) return;
    const race = cur.race, P = race.player, O = race.humans.find((b) => b !== P);
    show(hudEl, phase === 'race');
    q(H.me, '.m-chip').style.setProperty('--c', P.side === 'blue' ? BLUE : YELLOW);
    q(H.them, '.m-chip').style.setProperty('--c', O.side === 'blue' ? BLUE : YELLOW);
    txt(q(H.me, 'b'), t('you')); txt(q(H.them, 'b'), O.name);
    pens(q(H.me, '.mh-pen'), P); pens(q(H.them, '.mh-pen'), O);
    txt(H.sc, match ? `${match.score[myId] ?? 0}–${match.score[otherId()] ?? 0}` : '');
    let note = '', ok = false;
    if (race.clock < -120 && !P.done) { if (P.entered) { note = L.entered; ok = true; } else note = L.enter(P.side === 'blue' ? L.blueEnd : L.yellowEnd); }
    else if (race.clock >= 0 && P.owed > 0 && !P.pen && !P.done) note = L.penHow;
    txt(H.note, note); show(H.note, !!note); H.note.classList.toggle('ok', ok);
  };

  // ---------- the cards ----------
  const raceLine = (r, i) => {
    const w = r.abandoned ? L.abandonedR : r.winner === myId ? t('you') : r.winner ? nameOf(r.winner) : '—';
    return [L.raceN(i + 1), r.abandoned ? '' : r.margin != null ? L.by(fmtS(r.margin, L.sec)) : r.winner && !r.abandoned && r.margin == null ? L.forfeitR : '', w];
  };
  const paintScore = () => {
    const me = myId, o = otherId(), side = (id) => (match.blueOf(match.nextN) === id ? BLUE : YELLOW);
    const k = `${match.score[me]}|${match.score[o]}|${nameOf(o)}|${match.nextN}`; if (C.score._k === k) return; C.score._k = k;
    C.score.innerHTML = '<span><i class="m-chip"></i><b></b></span><em></em><span><b></b><i class="m-chip"></i></span>';
    const [a, b] = C.score.querySelectorAll('span');
    a.querySelector('.m-chip').style.setProperty('--c', side(me)); b.querySelector('.m-chip').style.setProperty('--c', side(o));
    a.querySelector('b').textContent = t('you'); b.querySelector('b').textContent = nameOf(o);
    C.score.querySelector('em').textContent = `${match.score[me] ?? 0}–${match.score[o] ?? 0}`;
  };
  const paintRaces = () => {
    const k = JSON.stringify(match.races); if (C.races._k === k) return; C.races._k = k;
    C.races.textContent = '';
    match.races.forEach((r, i) => {
      const [a, m, w] = raceLine(r, i), row = document.createElement('div');
      row.append(Object.assign(document.createElement('span'), { textContent: a }), Object.assign(document.createElement('span'), { textContent: m }), Object.assign(document.createElement('b'), { textContent: w }));
      C.races.append(row);
    });
  };
  const paintCard = () => {
    const o = otherId(), last = match.races[match.races.length - 1], n = match.races.length, oName = nameOf(o);
    paintScore(); paintRaces();
    const here = isHost ? present() : Date.now() - lastHostAt < 6000, old = stale();
    txt(C.leave, match.state === 'over' ? L.done : L.leave);
    if (old) { // another build on the other screen: a reload, not a race
      show(C.go, true); txt(C.go, L.reload); C.go.disabled = false; C.go.classList.remove('on');
      txt(C.st, L.stale); C.st.classList.add('bad');
      return;
    }
    C.st.classList.remove('bad');
    if (match.state === 'over') {
      const me = match.score[myId] ?? 0, them = match.score[o] ?? 0, s = `${Math.max(me, them)}–${Math.min(me, them)}`;
      txt(C.kick, L.matchK);
      txt(C.h, me >= 2 ? t('matchWon', s) : them >= 2 ? t('matchLost', oName, s) : match.leftBy ? L.left(match.leftBy === myId ? t('you') : nameOf(match.leftBy)) : L.gone(oName));
      txt(C.sub, me < 2 && them < 2 ? '' : match.leftBy ? L.left(nameOf(match.leftBy)) : '');
      const canRe = isHost && here && !match.leftBy;
      show(C.go, canRe); txt(C.go, L.rematch); C.go.disabled = false; C.go.classList.remove('on');
      txt(C.st, isHost ? (here || match.leftBy ? '' : t('waitingHost', oName)) : match.leftBy ? '' : here ? L.waitRematch(oName) : t('waitingHost', oName));
      return;
    }
    txt(C.kick, L.kick);
    txt(C.h, !last ? L.raceN(match.nextN) : last.abandoned ? L.abandonedN(n) : last.winner === myId ? L.youWin(n) : last.winner ? L.theyWin(oName, n) : L.abandonedN(n));
    const by = last && !last.abandoned ? (last.margin != null ? L.by(fmtS(last.margin, L.sec)) : last.winner ? L.forfeit(last.winner === myId ? oName : t('you')) : '') : '';
    const side = match.blueOf(match.nextN) === myId ? 'blue' : 'yellow';
    txt(C.sub, [by, L.next(match.nextN, L[side], L[side + 'End'])].filter(Boolean).join(' · '));
    const R0 = ready(), mine = R0.has(myId) || wantReady === `${match.start.seed}|${match.nextN}`;
    show(C.go, true); txt(C.go, mine ? L.readyOn : L.ready); C.go.classList.toggle('on', mine); C.go.disabled = mine;
    const leftS = isHost ? K.left() : autoLeft;
    txt(C.st, !here ? t('waitingHost', oName) : R0.has(o) ? L.theyReady(oName) : leftS != null ? L.autoIn(fmtS(leftS, L.sec)) : L.waitBoth);
  };
  C.go.addEventListener('click', () => {
    if (!match) return;
    if (stale()) { location.reload(); return; }
    if (match.state === 'over') { if (isHost) rematch(); return; }
    if (match.state !== 'between' || ready().has(myId)) return;
    if (isHost) K.readyMe(); // (its onChange sends the state)
    else { wantReady = `${match.start.seed}|${match.nextN}`; sendReady(); }
    paintCard();
  });
  const sendReady = () => { readySent = Date.now(); link.all.send('ready', { id: myId, n: match.nextN, seed: match.start.seed }); };
  const rematch = () => {
    if (!isHost || !room.canStart()) return;
    const m = room.start(); // the same code, the same settings, a new seed, the same guest; she takes it from the mstate
    match = new M.Match({ start: m }); K.set(match); saveMatch(); sendState(); enterRace();
  };

  // ---------- the waiting room ----------
  const paintRoom = () => {
    const s = (room && room.settings) || hostSettings;
    txt(R.set, s ? `${venueName(s.venue)} · ${t(s.preset)} · ${yachtName(s.yacht)} · ${t(s.length === 'medium' ? 'lMedium' : 'lShort')} · ${L.bestOf}` : L.bestOf);
    const full = !!room && room.full;
    const h = room ? room.host : isHost ? { id: myId, name: myName || '…' } : null, g = room && room.guest;
    const rows = [[h, BLUE, L.hostTag], [full ? null : g, YELLOW, '']];
    const k = JSON.stringify(rows.map(([p]) => p && [p.id, p.name])) + full + !!room + joined;
    if (R.ppl._k !== k) {
      R.ppl._k = k; R.ppl.textContent = '';
      for (const [p, col, tag] of rows) {
        const row = document.createElement('div'); row.className = 'm-p' + (p ? '' : ' empty');
        if (p) {
          const chip = document.createElement('i'); chip.className = 'm-chip'; chip.style.setProperty('--c', col);
          row.append(chip, Object.assign(document.createElement('span'), { textContent: clean(p.name) || '—' }));
          const tags = [p.id === myId ? L.youTag : '', tag].filter(Boolean).join(' · ');
          if (tags) row.append(Object.assign(document.createElement('span'), { className: 't', textContent: tags }));
        } else row.textContent = isHost ? L.waitFriend : joined ? L.waitHost : L.connecting; // (the guest: joined, the host just isn't there)
        if (p || (room && !full && row.textContent)) R.ppl.append(row); // (before the room is open, or a full one: only who is known)
      }
    }
    show(R.linkBox, isHost);
    show(R.nameBox, (!room || !full) && !badSet); show(R.ppl, !badSet); // (a match this page can't sail: only why)
    if (document.activeElement !== R.name && !R.name.value) R.name.value = myName;
    const old = stale();
    show(R.retry, !!error || old); txt(R.retry, old ? L.reload : L.retry);
    let st = '', bad = false;
    if (badSet) { st = L.badSet; bad = true; }
    else if (error) { st = L.noConnect; bad = true; }
    else if (old) { st = L.stale; bad = true; }
    else if (!link) st = L.connecting;
    else if (!room) st = L.nameFirst;
    else if (full) { st = t('full'); bad = true; }
    else if (isHost) st = ''; // (alone, the friend's row says it)
    else st = h ? L.waitStart(clean(h.name)) : joined ? '' : L.connecting; // (no host yet: its row says so)
    txt(R.st, st); R.st.classList.toggle('bad', bad); show(R.st, !!st);
    show(R.start, isHost && !error);
    R.start.disabled = !(room && room.canStart()) || old;
    show(R.sides, !full && !error && !badSet);
  };
  R.start.addEventListener('click', () => { if (room && room.canStart() && !match && !stale()) room.start(); });

  // ---------- the umpire's calls, with their reasons (&debug=umpire) ----------
  const paintDbg = () => {
    if (!dbg) return;
    const calls = isHost ? cur?.race.calls || [] : hostCalls;
    const lines = calls.slice(-12).map((c) => {
      const w = c.why || {}, who = c.on === myId ? t('you') : nameOf(c.on);
      return `${fmtC(c.t)}  ${c.rule} → ${who}  ${L.gap(w.gap)} · ${L.look(w.look)}${w.rowTurned ? ' · ' + L.turned(fmtC(w.rowTurnT)) : ''}${w.contact ? ' · ' + L.contact : ''}`;
    });
    txt(dbg, `${L.umpireK} (${isHost ? 'host' : 'guest'})\n${lines.join('\n') || L.noCalls}`);
  };

  // ---------- the beat: four times a second ----------
  const beat = () => {
    if (left) return;
    const now = Date.now();
    // the guest's settings must be the host's: another venue or yacht is another page (sent there once)
    if (!isHost && room && room.settings && !match && !badSet && !settingsHere(room.settings) && left) return;
    if (!isHost && pendingStart && now - pendingStart.at > 1500 && (!match || match.start.seed !== pendingStart.m.seed)) {
      const m = pendingStart.m; pendingStart = null; match = new M.Match({ start: m }); enterRace();
    }
    if (isHost && match) {
      K.beat(); // her presence to the match, which starts the next race when its rules say
      if (match.state === 'race' && !onScreen()) enterRace();
      startHost();
      const key = `${match.state}|${match.raceN}|${match.races.length}|${[...K.ready].join()}`;
      if (key !== stateKey || now - lastState > (match.state === 'race' ? 2000 : 1000)) { if (key !== stateKey) saveMatch(); stateKey = key; sendState(); }
    }
    if (!isHost && match) {
      if (cur && cur.G && !cur.gotSnap && now - cur.loadedAt > 1000) sendLoaded();
      if (match.state === 'between' && !readyIds.has(myId) && wantReady === `${match.start.seed}|${match.nextN}` && now - readySent > 1000) sendReady();
      if (match.state !== 'over' && now - lastHostAt > 300000) match.state = 'over'; // her host gone five minutes: over
    }
    // a race gone quiet 3 s (no snapshot on the guest's screen, no input on the host's): the link checked, at once and
    // then every 10 s while it stays quiet (a half-open socket would otherwise take a heartbeat or two to notice)
    if (cur && phase === 'race' && !cur.endedAt && (cur.G ? cur.gotSnap && now - lastHostAt > 3000 : cur.H && now - K.lastIn > 3000) && now - kicked > 10000) relink();
    // the race ends: its last moments on the water, then its card
    if (cur && phase === 'race') {
      const done = match.state !== 'race' || !onScreen(); // the match has moved on: the race was sailed, abandoned or the match left
      if (!cur.endedAt && done) cur.endedAt = now;
      if (cur.endedAt && !cur.told) { cur.told = true; tell(); }
      if (cur.endedAt && done && now - cur.endedAt >= CARD_MS) {
        if (isHost) K.raceOff();
        cur.H?.stop(); cur.G?.stop();
        room?.pause(false);
        phase = 'card'; show(hudEl, false); onIdle();
      }
    }
    if (phase === 'card' && match && match.state === 'race' && !onScreen()) enterRace();
    if (phase === 'room' && match && match.state !== 'race') { phase = 'card'; show(R.card, false); } // a reloaded page, between races or after the match
    // what's on screen
    show(A.card, asking && !!match && match.state !== 'over');
    if (asking && (!match || match.state === 'over')) asking = false;
    show(R.card, phase === 'room' && !asking); if (phase === 'room') paintRoom();
    show(C.card, phase === 'card' && !!match && !asking); if (phase === 'card' && match) paintCard();
    let b = '';
    if (phase === 'race' && cur) {
      if (isHost && !cur.H && !cur.endedAt) b = L.loadingRace(nameOf(match.guestId));
      else if (isHost && cur.H && !cur.endedAt && now - K.lastIn > 3000) b = t('guestGone', nameOf(match.guestId));
      else if (!isHost && cur.G && !cur.endedAt && cur.G.abandoned) b = t('abandoned');
      else if (!isHost && cur.G && !cur.endedAt && (cur.G.hostSilent || (!cur.gotSnap && now - cur.at > 4000))) b = t('waitingHost', nameOf(match.hostId));
    }
    txt(banner, b); show(banner, !!b);
    paintDbg();
  };
  const timer = setInterval(beat, 250);

  api = { leave, ask };
  paintRoom();
  await connect();
  // a reloaded host goes straight to the card it was on
  if (isHost && match) { phase = 'card'; show(R.card, false); }
  beat();
}
