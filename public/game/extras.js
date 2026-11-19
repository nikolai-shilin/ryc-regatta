// What the game does round the race itself, kept out of main.js, which calls in here at three places: start (a race
// starts), frame (each frame, after the race has stepped) and settings (what a drill sails).
//
//   The drills: a minute or two each, from /race/drills (/play?race=free&drill=<id>). A computer skipper sails your
//     boat to the moment the drill is about (or not, for the start), hands her over, and the drill ends when it's
//     done: stars for how it went, kept on this device (localStorage regatta-drills), never posted as a race.
//   The analytics: the race's moments as Vercel Web Analytics events (/play loads its script; the pages send theirs
//   with @vercel/analytics):
//     a race started, a race left before the finish, a drill done.
import { VENUE } from './venues.js';
import { polarSpeed, beatAngle, lineT, KN, D2R } from './sim.js';

const tr = (en, ru, es, de, tk) => (ctx?.LANG === 'ru' ? ru : ctx?.LANG === 'es' ? es ?? en : ctx?.LANG === 'de' ? de ?? en : ctx?.LANG === 'tr' ? tk ?? en : en); // the game's language (main.js), handed over at init
const q = new URLSearchParams(location.search);
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

// ---------- analytics ----------
// Vercel Web Analytics: /play loads its script itself (play/index.html), with the queue below for what's sent first
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
export const track = (name, data) => { try { window.va('event', { name, data }); } catch (e) {} };

// ---------- the drills ----------
// Each drill's level (sim.js LEVELS: her fleet is all of that level, and so is the computer skipper who sails your boat
// to the moment), her race (a free race of its own, whatever the set-up page last chose), and, for a harder sailing of
// another, the drill she plays as (`as`: where she hands over, when she ends and how she scores): 3 stars, 2, 1, or 0
// for not done.
const R = (o = {}) => ({ preset: 'medium', fleet: 6, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', ...o });
export const DRILLS = {
  start: { level: 'beginner', race: R() },
  mark: { level: 'beginner', race: R() },
  layline: { level: 'beginner', race: R() },
  penalty: { level: 'beginner', race: R({ fleet: 4 }) }, // a smaller fleet: room to spin
  // a line skewed 12°, one end or the other (drawn as the page loads, so Again may draw the other)
  end: { level: 'club', race: R({ bias: (Math.random() < 0.5 ? -1 : 1) * 12 }) },
  beat: { level: 'club', race: R() },
  run: { level: 'club', race: R({ laps: 2 }) }, // two laps, so the run goes down to the gate (one lap's is to the finish)
  finish: { level: 'club', race: R({ course: 'wlu' }) }, // an upwind finish where the venue lays one (else downwind)
  tide: { level: 'racer', as: 'start', race: R({ current: 1 }) }, // the venue's own stream across the line
  light: { level: 'racer', as: 'beat', race: R({ preset: 'light' }) },
  wing: { level: 'racer', as: 'mark', race: R({ course: 'tri' }) }, // the triangle's wing mark (the windward mark where it isn't laid)
  heavy: { level: 'racer', as: 'run', race: R({ preset: 'strong', laps: 2 }) },
  port: { level: 'expert', race: R({ bias: 12 }) }, // the pin favoured: the port-tack start pays, if she crosses
  back: { level: 'expert', race: R({ laps: 2 }) },
  race: { level: 'expert', race: R() },
};
// as a race comes, level by level (lib/drills.ts lists them in this order too)
export const DRILL_ORDER = ['start', 'mark', 'layline', 'penalty', 'end', 'beat', 'run', 'finish', 'tide', 'light', 'wing', 'heavy', 'port', 'back', 'race'];
// A level opens with two thirds of the stars of the one below (lib/drills.ts levelOpen, the same)
export const LEVEL_ORDER = ['beginner', 'club', 'racer', 'expert'];
export function levelOpen(lv, got) {
  const i = LEVEL_ORDER.indexOf(lv);
  if (i <= 0) return true;
  const below = DRILL_ORDER.filter((id) => DRILLS[id].level === LEVEL_ORDER[i - 1]);
  return levelOpen(LEVEL_ORDER[i - 1], got) && below.reduce((a, id) => a + (got[id] || 0), 0) >= Math.ceil(below.length * 2);
}
// the skill of the computer skipper who sails your boat to the moment: the middle of the drill's level
const SAILS_TO = { beginner: 0.35, club: 0.55, racer: 0.75, expert: 0.92 };
const drillId = q.get('drill') && DRILLS[q.get('drill')] ? q.get('drill') : null;
export const drill = drillId;
const kind = (id) => DRILLS[id].as || id;
// what a drill sails, over the free race's own choices (main.js settings())
export const drillSettings = () => (drillId ? { ...DRILLS[drillId].race, level: DRILLS[drillId].level } : null);
const drillName = (id) => ({ start: tr('The start', 'Старт', 'La salida', 'Der Start', 'Start'), mark: tr('The top mark', 'Верхний знак', 'La baliza de barlovento', 'Die Luvtonne', 'Üst şamandıra'), beat: tr('The shifts', 'Сдвиги ветра', 'Las roladas', 'Die Winddreher', 'Rüzgâr dönüşleri'),
  run: tr('The run', 'Фордевинд', 'La empopada', 'Der Vorwindkurs', 'Pupa ayağı'), finish: tr('The finish', 'Финиш', 'La llegada', 'Das Ziel', 'Bitiş'), end: tr('The favoured end', 'Выгодный конец', 'El extremo favorecido', 'Das begünstigte Ende', 'Avantajlı uç'), layline: tr('The layline', 'Лейлайн', 'La layline', 'Die Layline', 'Layline'),
  penalty: tr('The penalty turn', 'Штрафной оборот', 'El giro de penalización', 'Der Strafkringel', 'Ceza dönüşü'), tide: tr('The tide start', 'Старт на течении', 'La salida con marea', 'Der Gezeitenstart', 'Gelgit startı'), light: tr('Light air', 'Слабый ветер', 'Poco viento', 'Leichtwind', 'Hafif rüzgâr'),
  wing: tr('The wing mark', 'Боковой знак', 'La baliza de través', 'Die Raumtonne', 'Kanat şamandırası'), heavy: tr('The heavy-air run', 'Фордевинд в свежак', 'La empopada con viento fuerte', 'Der Vorwindkurs bei Starkwind', 'Sert rüzgârda pupa'), port: tr('The port-tack start', 'Старт левым галсом', 'La salida por babor', 'Der Start auf Backbordbug', 'İskele kontra start'),
  back: tr('From the back', 'С последнего места', 'Desde atrás', 'Von hinten', 'Geriden'), race: tr('The whole race', 'Вся гонка', 'La regata completa', 'Die ganze Regatta', 'Bütün yarış') })[id];
const levelName = (lv) => ({ beginner: tr('Beginner', 'Новичок', 'Principiante', 'Anfänger', 'Acemi'), club: tr('Club', 'Клуб', 'Club', 'Club', 'Kulüp'), racer: tr('Racer', 'Гонщик', 'Regatista', 'Regattasegler', 'Yarışçı'), expert: tr('Expert', 'Эксперт', 'Experto', 'Experte', 'Usta') })[lv];

let ctx = null, dr = null;
const css = `
.drill-k { position: fixed; left: 50%; top: calc(14px + env(safe-area-inset-top)); translate: -50% 0; z-index: 40; display: flex; align-items: stretch; height: 30px; pointer-events: none;
  font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-label, .08em); text-transform: uppercase; }
.drill-k > * { display: flex; align-items: center; padding: 0 var(--s-4, 16px); }
.drill-k b { background: var(--gold, #f5c400); color: var(--ink-on, #070d16); } .drill-k span { background: var(--panel, rgba(10,18,30,.8)); color: var(--ink, #fff); }
.drill-end { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(4, 9, 16, 0.55); }
.drill-end .in { width: min(440px, 100%); display: flex; flex-direction: column; gap: var(--s-4, 16px); padding: var(--s-6, 24px); background: var(--panel-2, #0d1724); color: var(--ink, #fff); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.drill-end .k { font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-label, .08em); text-transform: uppercase; color: var(--ink-2, #aab); }
.drill-end h2 { margin: 0; font: 700 var(--fs-h3, 32px)/1 var(--cond, sans-serif); text-transform: uppercase; }
.drill-end .st { display: flex; gap: 6px; font-size: 34px; line-height: 1; color: rgba(255,255,255,.18); } .drill-end .st .on { color: var(--gold, #f5c400); }
.drill-end p.lv { color: var(--gold, #f5c400); font-weight: 700; }
.drill-end p { margin: 0; font: 500 var(--fs-body, 16px)/1.45 var(--sans, sans-serif); color: var(--ink-2, #ccd); }
.drill-end a:focus-visible { outline: 2px solid var(--ink, #fff); outline-offset: 2px; }
.drill-end .bs { display: flex; flex-wrap: wrap; gap: 8px; }
.drill-end a { border-radius: 0; display: inline-flex; align-items: center; height: 44px; padding: 0 18px; background: var(--fill-2, rgba(255,255,255,.12)); color: var(--ink, #fff); font: 700 var(--fs-small, 14px)/1 var(--cond, sans-serif); letter-spacing: var(--ls-button, .04em); text-transform: uppercase; text-decoration: none; }
.drill-end a.go { background: var(--you, #3db8ff); color: var(--ink-on, #070d16); }
`;

// main.js hands over what the hooks need: the language, the race, and how to stop it (a drill's end)
export function initExtras(c) {
  ctx = c;
  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
  // a race left before its finish (not a drill): where it was left
  addEventListener('pagehide', () => {
    const race = ctx.getRace();
    if (!ctx.isRunning() || !race || race.over || race.player.done || dr) return;
    track('Race left', { race: race.settings?.daily ? 'daily' : 'free', leg: race.player.leg, min: Math.max(0, Math.round(race.clock / 60)) });
  });
}

// ---------- the hooks ----------
export function onStart(race) {
  track('Race start', { race: drillId ? 'drill' : race.settings?.daily ? 'daily' : 'free', venue: VENUE.id, ...(drillId && { drill: drillId }) });
  if (drillId) startDrill(race);
}

export function onFrame(race) {
  if (dr) drillFrame(race);
}

// further over the line than this at the gun, and not recalled (out past an end of it, where the committee doesn't look):
// she hasn't started, and isn't on the line at speed whatever her distance from it says
const FAR = 10;

// ---------- a drill's course ----------
function startDrill(race) {
  const P = race.player;
  const K = kind(drillId);
  dr = { id: drillId, kind: K, done: false, pens: 0 };
  // the starts and the whole race: yours from the minute before. The others: a computer skipper of the drill's level
  // sails her to the moment (From the back: a beginner, so she's at the back), then she's yours
  if (!['start', 'end', 'port', 'race'].includes(K)) {
    P.ai = { ...(race.boats.find((b) => b.ai)?.ai || {}), skill: drillId === 'back' ? 0.3 : SAILS_TO[DRILLS[drillId].level], lineT: 0.5, lastTack: -999, go: false, wp: 0, dirtyT: 0, hailT: -99, port: false, dare: 0, loiter: 1 };
    // the beat: halfway up it (from the middle of the line to the windward mark), so what's left is a couple of minutes
    const C = race.course, beat = Math.hypot(C.windward.x - (C.pin.x + C.committee.x) / 2, C.windward.z - (C.pin.z + C.committee.z) / 2);
    // the run: just round the windward mark, 25 m on from it (a lap's gate the leg after). The finish: 150 m from the
    // line on the last leg, whatever the course the venue laid
    // the wing mark: 130 m from it, as the top mark's from the windward mark. From the back: round the windward mark
    const gate = C.legs.indexOf('gate'), last = C.legs.length - 1, mk = C.legs.includes('wing') && drillId === 'wing' ? C.legs.indexOf('wing') : C.legs.indexOf('mark');
    const until = { mark: () => P.leg >= mk && race.distToNext(P) < 130, back: () => P.leg >= 2 && Math.hypot(P.x - C.windward.x, P.z - C.windward.z) > 25, beat: () => P.leg >= 1 && race.distToNext(P) < beat * 0.5,
      run: () => P.leg >= gate && Math.hypot(P.x - C.windward.x, P.z - C.windward.z) > 25, finish: () => P.leg >= last && race.distToNext(P) < 150,
      // the layline: within 170 m of the windward mark with it still inside the no-go cone (a tack to make, and the call
      // when), or 90 m from it whatever. The penalty: 30 s up the beat
      layline: () => P.leg >= 1 && ((race.distToNext(P) < 170 && Math.abs(offWind(P, race.course.windward, P.wdir)) < (beatAngle(P.tws) - 3) * D2R) || race.distToNext(P) < 90),
      penalty: () => P.leg >= 1 && race.clock > 30 }[K];
    for (let n = 0; n < 60 * 600 && !until(); n++) race.step(1 / 60);
    delete P.ai; P.auto = null;
    race.messages.length = 0; for (const b of race.boats) if (b.events) b.events.length = 0; // what was said on the way: not said now
  }
  // the penalty: one turn owed, a tack and a gybe (rule 44.2), as if she'd just fouled someone
  if (drillId === 'penalty') { P.pen = { tack: false, gybe: false, dir: 0 }; P.pens = (P.pens || 0) + 1; }
  // the layline: the tacks from here, and where she was after the last (here, if none) with the wind there
  if (drillId === 'layline') Object.assign(dr, { tacks: 0, inTack: false, T: { x: P.x, z: P.z, W: P.wdir }, tw: [] });
  dr.t0 = race.clock; dr.place0 = race.standings().indexOf(P) + 1; dr.pens0 = P.pens || 0; dr.leg0 = P.leg;
  const k = document.createElement('div'); k.className = 'drill-k bc';
  k.innerHTML = `<b>${levelName(DRILLS[drillId].level)}</b><span>${drillName(drillId)} · ${{ start: tr('cross at the gun, at speed', 'пересеки линию по сигналу, на скорости', 'cruza en la señal, a toda velocidad', 'mit Tempo zum Startsignal über die Linie', 'start işaretinde hattı hızla geç'), mark: tr('round it, gain a place', 'обогни и выиграй место', 'rodéala y gana un puesto', 'umrunden und einen Platz gutmachen', 'dön, bir yer kazan'), beat: tr('to the top mark', 'до верхнего знака', 'hasta la baliza de barlovento', 'zur Luvtonne', 'rüzgârüstü şamandırasına'),
    run: tr('down through the gate', 'вниз через ворота', 'bajando por la puerta', 'durch das Tor nach unten', 'kapıdan aşağı'), finish: tr('cross ahead', 'финишируй впереди', 'cruza por delante', 'davor kreuzen', 'önünden geç'), end: tr('start at the end that pays', 'стартуй у выгодного конца', 'sal por el extremo que compensa', 'am richtigen Ende starten', 'kazandıran uçtan start et'),
    layline: tr('tack for the mark at the right time', 'поверни на знак вовремя', 'vira hacia la baliza en el momento justo', 'zur richtigen Zeit für die Tonne wenden', 'şamandıraya doğru zamanda tramola at'), penalty: tr('tack, gybe, back up to speed', 'оверштаг, фордевинд и снова на скорость', 'vira, traslucha, vuelve a la velocidad', 'wenden, halsen, wieder auf Tempo kommen', 'tramola, kavança, yeniden hıza çık'),
    tide: tr('cross at the gun, the stream under you', 'пересеки линию по сигналу, течение под тобой', 'cruza en la señal, con la corriente bajo ti', 'zum Startsignal über die Linie, mit der Strömung unter dir', 'start işaretinde hattı geç, akıntı altında'), light: tr('to the top mark, in a zephyr', 'до верхнего знака в слабый ветер', 'hasta la baliza de barlovento, con brisa flojita', 'zur Luvtonne, bei einem Hauch von Wind', 'rüzgârüstü şamandırasına, hafif bir meltemde'),
    wing: tr('round it, gain a place', 'обогни и выиграй место', 'rodéala y gana un puesto', 'umrunden und einen Platz gutmachen', 'dön, bir yer kazan'), heavy: tr('through the gate, on her feet', 'через ворота, без брочинга', 'por la puerta, sin tumbarte', 'durchs Tor, aufrecht', 'kapıdan, dik durarak'),
    port: tr('start on port at the pin, cross them', 'стартуй левым у пина, пересеки курс флота', 'sal por babor en el pin, cruza por delante', 'auf Backbord am Pin starten, vor ihnen kreuzen', 'pinde iskele kontra start et, önlerinden geç'), back: tr('from the back, pass them', 'с конца — обгоняй', 'desde atrás, adelántalos', 'von hinten, an ihnen vorbei', 'arkadan başla, onları geç'),
    race: tr('win it', 'выиграй её', 'gana', 'gewinnen', 'kazan') }[drillId]}</span>`;
  document.body.append(k); dr.k = k;
}

// the bearing of `m` from the boat, off the wind `W` (radians: 0 dead upwind, signed)
const offWind = (b, m, W) => { const dx = m.x - b.x, dz = m.z - b.z; return Math.atan2(dx * Math.cos(W) + dz * Math.sin(W), dx * Math.sin(W) - dz * Math.cos(W)); };

function drillFrame(race) {
  if (dr.done) return;
  const P = race.player, L = race.log, K = dr.kind;
  let end = false;
  // the heavy-air run: a broach (or a crash gybe, a death roll) or the kite wrapped round the forestay
  if (dr.id === 'heavy' && !dr.wild && (P.broachT > 0 || P.kiteJob?.messy)) dr.wild = P.kiteJob?.messy ? 'wrap' : 'broach';
  // the port-tack start: which tack she crossed on, and where along the line
  if (dr.id === 'port' && dr.cross == null && P.leg >= 1) dr.cross = { port: P.twa < 0, at: Math.min(1, Math.max(0, lineT(race.course, P))) };
  if (dr.id === 'layline' && P.leg === dr.leg0) {
    // a tack (not a gybe) done: count it, and the approach starts again from where she came out of it
    if (P.auto && !P.auto.gybe) dr.inTack = true;
    else if (!P.auto && dr.inTack) { dr.inTack = false; dr.tacks++; dr.T = { x: P.x, z: P.z, W: P.wdir }; dr.tw = []; }
    // the angle she sails to the wind on the way in (not the last 25 m, where she bears away round it)
    if (!P.auto && !P.pen && race.distToNext(P) > 25) dr.tw.push(Math.abs(P.twa));
  }
  if (K === 'start') end = race.clock >= 8;
  else if (K === 'port') end = race.clock >= 20; // (crossing the fleet takes a while)
  else if (K === 'back') end = P.done || race.clock - dr.t0 > 600;
  else if (K === 'race') end = P.done || race.clock > 900;
  else if (K === 'mark') {
    if (P.leg > dr.leg0 && dr.roundT == null) dr.roundT = race.clock;
    end = (dr.roundT != null && race.clock - dr.roundT > 20) || race.clock - dr.t0 > 180; // 20 s down the run after it
  } else if (K === 'beat') end = P.leg >= 2 || race.clock - dr.t0 > 600;
  else if (K === 'run') {
    if (P.leg > dr.leg0 && dr.roundT == null) dr.roundT = race.clock;
    end = (dr.roundT != null && race.clock - dr.roundT > 10) || race.clock - dr.t0 > 300; // 10 s out of the gate
  } else if (dr.id === 'finish') end = P.done || race.clock - dr.t0 > 300;
  else if (dr.id === 'end') {
    // where along the line she was at the gun (0 the pin … 1 the committee boat), and the end further upwind then
    if (dr.gunAt == null && race.clock >= 0) {
      const C = race.course, W = race.wind.mean();
      dr.gunAt = Math.min(1, Math.max(0, lineT(C, P))); dr.boatEnd = (C.committee.x - C.pin.x) * Math.sin(W) - (C.committee.z - C.pin.z) * Math.cos(W) > 0;
    }
    end = race.clock >= 8;
  }
  else if (dr.id === 'layline') end = P.leg >= 2 || race.clock - dr.t0 > 240;
  else if (dr.id === 'penalty') {
    // done: the turn taken, close-hauled again (within 12° of the beat's angle) at 85% of her speed there
    const ba = beatAngle(P.tws);
    if (!P.pen && dr.doneT == null && Math.abs(P.twa) <= (ba + 12) * D2R && P.v >= 0.85 * polarSpeed(P.tws, ba) * KN) dr.doneT = race.clock;
    end = dr.doneT != null || race.clock - dr.t0 > 90;
  }
  if (!end) return;
  dr.done = true;
  const place = race.standings().indexOf(P) + 1, pens = (P.pens || 0) - dr.pens0, n = race.boats.length;
  let stars = 0, line = '';
  const tide = dr.id === 'tide' ? [' The stream sets you: watch how fast a buoy or the committee boat slides by, and hold further off when it runs toward the line.', ' Течение сносит: смотри, как быстро мимо идёт знак или судейское судно, и держись дальше, если оно несёт на линию.', ' La corriente te arrastra: fíjate en lo rápido que pasa una boya o el barco del comité y mantente más lejos cuando va hacia la línea.', ' Die Strömung versetzt dich: Beobachte, wie schnell eine Boje oder das Wettfahrtleitungsboot vorbeigleitet, und halte mehr Abstand, wenn sie zur Linie hin läuft.', ' Akıntı seni sürükler: bir şamandıranın ya da komite teknesinin ne kadar hızlı kaydığına bak ve akıntı hatta doğru akıyorsa daha uzakta dur.'] : ['', ''];
  if (K === 'start') {
    const d = L.gunD, v = L.gunV;
    if (L.ocs || L.startDsq) { stars = 0; line = tr('Over the line at the gun: you had to go back. Hold below it until the last seconds.' + tide[0], 'Фальстарт — пришлось возвращаться. Держись под ней до последних секунд.' + tide[1], 'Saliste antes de la señal y tuviste que volver. Aguanta por debajo de la línea hasta los últimos segundos.' + (tide[2] ?? tide[0]), 'Beim Startsignal über der Linie: du musstest zurück. Bleib bis zu den letzten Sekunden darunter.' + (tide[3] ?? tide[0]), 'Start işaretinde hattın üzerindeydin: geri dönmen gerekti. Son saniyelere kadar hattın altında kal.' + (tide[4] ?? tide[0])); }
    else if (d < -FAR) { stars = 0; line = tr('Over the line at the gun, out past its end: you never started. Stay below the line, between its ends, until the last seconds.' + tide[0], 'На сигнале ты был за линией, в стороне от её концов: старта не было. Держись под линией, между её концами, до последних секунд.' + tide[1], 'En la señal estabas por encima de la línea, fuera de sus extremos: no llegaste a salir. Quédate por debajo de la línea, entre sus extremos, hasta los últimos segundos.' + (tide[2] ?? tide[0]), 'Beim Startsignal warst du über der Linie, außerhalb ihrer Enden: Du bist nie gestartet. Bleib bis zu den letzten Sekunden unter der Linie, zwischen ihren Enden.' + (tide[3] ?? tide[0]), 'Start işaretinde hattın üstünde, uçlarının dışındaydın: hiç start etmedin. Son saniyelere kadar hattın altında, iki ucunun arasında kal.' + (tide[4] ?? tide[0])); }
    else if (d == null) { stars = 0; line = tr('No start this time.', 'В этот раз старта не было.', 'Esta vez no hubo salida.', 'Diesmal kein Start.', 'Bu sefer start yok.'); }
    else {
      stars = d < 10 && v > 4.5 ? 3 : d < 25 && v > 3.5 ? 2 : 1;
      line = tr(`At the gun: ${Math.round(Math.max(0, d))} m from the line at ${v.toFixed(1)} kn. ${stars === 3 ? 'That is the start that wins races.' : 'Three stars: under 10 m, over 4.5 kn.' + tide[0]}`,
        `На сигнале: ${Math.round(Math.max(0, d))} м до линии, ${v.toFixed(1).replace('.', ',')} уз. ${stars === 3 ? 'Такой старт и выигрывает гонки.' : 'Три звезды: ближе 10 м, быстрее 4,5 уз.' + tide[1]}`, `En la señal: a ${Math.round(Math.max(0, d))} m de la línea a ${v.toFixed(1).replace('.', ',')} kn. ${stars === 3 ? 'Esa es la salida que gana regatas.' : 'Tres estrellas: a menos de 10 m y a más de 4,5 kn.' + (tide[2] ?? tide[0])}`, `Beim Startsignal: ${Math.round(Math.max(0, d))} m von der Linie bei ${v.toFixed(1).replace('.', ',')} kn. ${stars === 3 ? 'Das ist der Start, der Regatten gewinnt.' : 'Drei Sterne: unter 10 m, über 4,5 kn.' + tide[0]}`, `Start işaretinde: hattan ${Math.round(Math.max(0, d))} m uzakta, ${v.toFixed(1).replace('.', ',')} kn hızla. ${stars === 3 ? 'Yarış kazandıran start bu.' : 'Üç yıldız: 10 m’den yakın, 4,5 kn’dan hızlı.' + tide[0]}`);
    }
  } else if (K === 'mark') {
    const gained = dr.place0 - place;
    stars = dr.roundT == null ? 0 : pens ? 1 : gained > 0 || place === 1 ? 3 : gained === 0 ? 2 : 1;
    line = dr.roundT == null ? tr('The mark wasn’t rounded in time.', 'Знак не обогнут вовремя.', 'No rodeaste la baliza a tiempo.', 'Die Tonne wurde nicht rechtzeitig gerundet.', 'Şamandıra zamanında dönülmedi.')
      : tr(`${ord(dr.place0)} at the zone, ${ord(place)} after it${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Wide in, tight out.' : 'Three stars: a place gained (or kept at the front), and no penalty.'}`,
        `${dr.place0}-е у зоны, ${place}-е после неё${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Широко на вход, плотно на выход.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа.'}`, `${ord(dr.place0)} en la zona, ${ord(place)} después${pens ? ', con una penalización' : ''}. ${stars === 3 ? 'Entra abierto, sal pegado.' : 'Tres estrellas: gana un puesto (o sigue en cabeza) y sin penalización.'}`, `${ord(dr.place0)} an der Zone, ${ord(place)} danach${pens ? ', mit einer Strafe' : ''}. ${stars === 3 ? 'Weit hinein, eng wieder hinaus.' : 'Drei Sterne: ein Platz gutgemacht (oder vorn gehalten) und keine Strafe.'}`, `Bölgede ${ord(dr.place0)}, sonra ${ord(place)}${pens ? ', cezalı' : ''}. ${stars === 3 ? 'Geniş gir, dar çık.' : 'Üç yıldız: bir yer kazanmak (ya da önde kalmak) ve ceza almamak.'}`);
  } else if (dr.id === 'end') {
    const boat = dr.boatEnd, at = dr.gunAt, d = L.gunD, v = L.gunV, endName = boat ? tr('the committee boat', 'у судейского судна', 'el barco del comité', 'das Wettfahrtleitungsboot', 'komite teknesi') : tr('the pin', 'у пина', 'el pin', 'der Pin', 'pin');
    const near = at == null ? 1 : boat ? 1 - at : at; // how far along the line from the end that paid
    if (L.ocs || L.startDsq) { stars = 0; line = tr('Over the line at the gun: you had to go back.', 'Фальстарт — пришлось возвращаться.', 'Sobre la línea en la señal: tuviste que volver.', 'Beim Startsignal über der Linie: Du musstest zurück.', 'Start işaretinde hattın üstündeydin: geri dönmen gerekti.'); }
    else if (d < -FAR) { stars = 0; line = tr('Over the line at the gun, out past its end: you never started. Stay below the line, between its ends, until the last seconds.', 'На сигнале ты был за линией, в стороне от её концов: старта не было. Держись под линией, между её концами, до последних секунд.', 'En la señal estabas por encima de la línea, fuera de sus extremos: no llegaste a salir. Quédate por debajo de la línea, entre sus extremos, hasta los últimos segundos.', 'Beim Startsignal warst du über der Linie, außerhalb ihrer Enden: Du bist nie gestartet. Bleib bis zu den letzten Sekunden unter der Linie, zwischen ihren Enden.', 'Start işaretinde hattın üstünde, uçlarının dışındaydın: hiç start etmedin. Son saniyelere kadar hattın altında, iki ucunun arasında kal.'); }
    else if (d == null || at == null) { stars = 0; line = tr('No start this time.', 'В этот раз старта не было.', 'Esta vez no hubo salida.', 'Diesmal kein Start.', 'Bu sefer start yok.'); }
    else {
      stars = near <= 1 / 3 && d < 15 && v > 4 ? 3 : near <= 1 / 2 && d < 30 ? 2 : 1;
      line = tr(`The end that paid: ${boat ? 'the committee boat' : 'the pin'}. At the gun you were ${Math.round(near * 100)}% of the way along the line from it, ${Math.round(Math.max(0, d))} m from the line at the gun at ${v.toFixed(1)} kn. ${stars === 3 ? 'A head start on the whole fleet.' : 'Three stars: in the third of the line nearest that end, under 15 m at the gun, over 4 kn. Look which end is further upwind before you set up.'}`,
        `Выгодный конец — ${endName}. На сигнале ты был в ${Math.round(near * 100)}% длины линии от него, ${Math.round(Math.max(0, d))} м до линии на сигнале, ${v.toFixed(1).replace('.', ',')} уз. ${stars === 3 ? 'Фора перед всем флотом.' : 'Три звезды: в трети линии у этого конца, ближе 15 м на сигнале, быстрее 4 уз. Посмотри, какой конец выше по ветру, прежде чем заходить.'}`, `El extremo que compensaba: ${boat ? 'el barco del comité' : 'la baliza'}. En la señal estabas al ${Math.round(near * 100)}% de la línea contando desde ese extremo, a ${Math.round(Math.max(0, d))} m de la línea y a ${v.toFixed(1).replace('.', ',')} kn. ${stars === 3 ? 'Ventaja sobre toda la flota desde el primer momento.' : 'Tres estrellas: en el tercio de la línea más cercano a ese extremo, a menos de 15 m en la señal y a más de 4 kn. Antes de colocarte, mira qué extremo está más a barlovento.'}`, `Das lohnende Ende: ${boat ? 'das Wettfahrtleitungsboot' : 'der Pin'}. Beim Startsignal warst du ${Math.round(near * 100)} % der Linie von ihm entfernt, ${Math.round(Math.max(0, d))} m von der Linie bei ${v.toFixed(1).replace('.', ',')} kn. ${stars === 3 ? 'Ein Vorsprung vor dem ganzen Feld.' : 'Drei Sterne: im Drittel der Linie nächst diesem Ende, unter 15 m beim Startsignal, über 4 kn. Schau, welches Ende weiter in Luv liegt, bevor du dich aufstellst.'}`, `Kazandıran uç: ${boat ? 'komite teknesi' : 'pin'}. Start işaretinde hat boyunca ondan %${Math.round(near * 100)} uzaktaydın, hattan ${Math.round(Math.max(0, d))} m, ${v.toFixed(1).replace('.', ',')} kn hızla. ${stars === 3 ? 'Tüm filoya karşı bir avantaj.' : 'Üç yıldız: hattın o uca en yakın üçte birinde, start işaretinde 15 m’den yakın, 4 kn’dan hızlı. Yerleşmeden önce hangi ucun daha rüzgârüstünde olduğuna bak.'}`);
    }
  } else if (dr.id === 'layline') {
    // overstood: from where she came out of her last tack the mark lay further off the wind than she sailed (the middle
    // of her angles on the way in), by that many metres across her course. One tack takes her there from the hand-over;
    // a second is allowed, for a shift or a starboard boat
    const tw = dr.tw.slice().sort((a, b) => a - b), sails = tw.length ? tw[tw.length >> 1] : beatAngle(P.tws) * D2R;
    const T = dr.T, lie = Math.abs(offWind(T, race.course.windward, T.W)), d = Math.hypot(race.course.windward.x - T.x, race.course.windward.z - T.z);
    const over = lie > sails ? d * Math.sin(lie - sails) : 0, n = dr.tacks;
    stars = P.leg < 2 ? 0 : pens ? 1 : n <= 2 && over < 10 ? 3 : n <= 3 && over < 25 ? 2 : 1;
    const ru = n === 1 ? 'поворот' : n > 1 && n < 5 ? 'поворота' : 'поворотов';
    line = P.leg < 2 ? tr('Not at the mark in time.', 'Не дошёл до знака вовремя.', 'No llegaste a la baliza a tiempo.', 'Nicht rechtzeitig an der Tonne.', 'Şamandıraya zamanında varılmadı.')
      : tr(`${n} ${n === 1 ? 'tack' : 'tacks'}, ${over < 1 ? 'not overstood' : `overstood by ${Math.round(over)} m`}${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Tacked on the layline, not past it.' : 'Three stars: two tacks at most, under 10 m past the layline, no penalty. Tack when the mark is level with the angle you sail on the other tack, and no later.'}`,
        `${n} ${ru}, ${over < 1 ? 'без перебора' : `перебор ${Math.round(over)} м`}${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Поворот точно на лейлайне, без перебора.' : 'Три звезды: не больше двух поворотов, перебор меньше 10 м и без штрафа. Поворачивай, когда знак встаёт на угол, которым ты идёшь другим галсом, и не позже.'}`, `${n} ${n === 1 ? 'virada' : 'viradas'}, ${over < 1 ? 'sin pasarte de la layline' : `te pasaste ${Math.round(over)} m`}${pens ? ', con una penalización' : ''}. ${stars === 3 ? 'Viraste en la layline, sin pasarte.' : 'Tres estrellas: dos viradas como máximo, menos de 10 m más allá de la layline y sin penalización. Vira cuando la baliza quede a la altura del ángulo que navegas en la otra amura, y no más tarde.'}`, `${n} ${n === 1 ? 'Wende' : 'Wenden'}, ${over < 1 ? 'nicht überstanden' : `${Math.round(over)} m überstanden`}${pens ? ', mit einer Strafe' : ''}. ${stars === 3 ? 'Auf der Layline gewendet, nicht darüber hinaus.' : 'Drei Sterne: höchstens zwei Wenden, unter 10 m über die Layline hinaus, keine Strafe. Wende, wenn die Tonne auf einer Höhe mit dem Winkel liegt, den du auf dem anderen Bug segelst, und nicht später.'}`, `${n} ${n === 1 ? 'tramola' : 'tramola'}, ${over < 1 ? 'layline aşılmadı' : `layline ${Math.round(over)} m aşıldı`}${pens ? ', cezalı' : ''}. ${stars === 3 ? 'Layline’da tramola attın, ötesinde değil.' : 'Üç yıldız: en fazla iki tramola, layline’ı 10 m’den az aşmak, ceza yok. Şamandıra diğer kontrada seyrettiğin açıyla aynı hizaya gelince tramola at, daha geç değil.'}`);
  } else if (dr.id === 'penalty') {
    const took = dr.doneT == null ? null : dr.doneT - dr.t0, more = pens; // (pens0 was counted with the drill's own turn)
    stars = took == null ? 0 : more > 0 ? 1 : took <= 20 ? 3 : took <= 30 ? 2 : 1;
    line = took == null ? tr('The turn wasn’t done, or she wasn’t back up to speed, in 90 s.', 'Оборот не сделан или скорость не набрана за 90 с.', 'No completaste el giro, o el barco no recuperó la velocidad, en 90 s.', 'Die Wende wurde nicht fertig, oder das Boot war nicht in 90 s wieder auf Tempo.', 'Dönüş tamamlanmadı ya da tekne 90 sn içinde yeniden hıza çıkmadı.')
      : tr(`Turned and back up to speed in ${took.toFixed(1)} s${more > 0 ? ', but you fouled someone on the way' : ''}. ${stars === 3 ? 'Barely a dent in your race.' : 'Three stars: under 20 s, keeping clear of the others. Bear away into the gybe, then come up hard through the tack, and don’t stall head to wind.'}`,
        `Оборот и снова на скорости за ${took.toFixed(1).replace('.', ',')} с${more > 0 ? ', но по пути ты нарушил правила' : ''}. ${stars === 3 ? 'Гонка почти не пострадала.' : 'Три звезды: быстрее 20 с, никому не мешая. Уваливайся в поворот фордевинд, затем резко приводись через оверштаг и не застревай в левентике.'}`, `Giro completado y de nuevo a velocidad en ${took.toFixed(1).replace('.', ',')} s${more > 0 ? ', pero cometiste una infracción por el camino' : ''}. ${stars === 3 ? 'Apenas te ha costado tiempo.' : 'Tres estrellas: menos de 20 s y manteniéndote separado de los demás. Arriba para trasluchar, orza con decisión para virar y no te quedes parado proa al viento.'}`, `In ${took.toFixed(1).replace('.', ',')} s gewendet und wieder auf Tempo${more > 0 ? ', aber du hast unterwegs jemanden behindert' : ''}. ${stars === 3 ? 'Kaum ein Kratzer an deiner Regatta.' : 'Drei Sterne: unter 20 s, ohne die anderen zu behindern. Fall in die Halse ab, dann luv hart durch die Wende an und bleib nicht im Wind stehen.'}`, `${took.toFixed(1).replace('.', ',')} sn’de döndün ve yeniden hıza çıktın${more > 0 ? ', ama yolda birine engel oldun' : ''}. ${stars === 3 ? 'Yarışında neredeyse iz bırakmadı.' : 'Üç yıldız: 20 sn’den kısa, diğerlerinden uzak durarak. Kavançaya boşla, sonra tramolada sert orsala ve rüzgârın tam karşısında durma.'}`);
  } else if (K === 'port') {
    const c = dr.cross;
    if (L.ocs || L.startDsq) { stars = 0; line = tr('Over the line at the gun: you had to go back.', 'Фальстарт — пришлось возвращаться.', 'Sobre la línea en la señal: tuviste que volver.', 'Beim Startsignal über der Linie: Du musstest zurück.', 'Start işaretinde hattın üstündeydin: geri dönmen gerekti.'); }
    else if (!c) { stars = 0; line = tr('No start in the first 20 s.', 'Старта не было за первые 20 с.', 'No hubo salida en los primeros 20 s.', 'Kein Start in den ersten 20 s.', 'İlk 20 sn’de start yok.'); }
    else {
      stars = !c.port || pens ? 1 : c.at <= 1 / 3 && L.gunD < 15 ? 3 : 2;
      line = !c.port ? tr('You started on starboard. Three stars: on port, in the third of the line by the pin, clear of everyone.', 'Ты стартовал правым галсом. Три звезды: левым, в трети линии у пина, никому не мешая.', 'Saliste por estribor. Tres estrellas: por babor, en el tercio de la línea junto al pin, libre de todos.', 'Du bist auf Steuerbord gestartet. Drei Sterne: auf Backbord, im Drittel der Linie am Pin, frei von allen.', 'Sancak kontra start ettin. Üç yıldız: iskele kontra, pin yanındaki hat üçte birinde, herkesten açık.')
        : pens ? tr('On port, but you fouled a starboard boat crossing. Duck the ones you can’t cross, behind their sterns.', 'Левым галсом, но ты нарушил правила, пересекая лодку правого галса. Тех, кого не пересечь, обходи за кормой.', 'Por babor, pero cometiste una infracción contra un barco por estribor al cruzar. Pasa por la popa de los que no puedes cruzar.', 'Auf Backbord, aber du hast ein Steuerbordboot beim Kreuzen behindert. Tauche unter denen durch, die du nicht kreuzen kannst, hinter ihren Hecks.', 'İskele kontradaydın ama geçen bir sancak tekneye engel oldun. Geçemeyeceğin teknelerin kıçlarının arkasından geç.')
        : tr(`On port, ${Math.round(c.at * 100)}% along the line from the pin, ${Math.round(Math.max(0, L.gunD))} m from it at the gun. ${stars === 3 ? 'Across the whole fleet: the race is yours to lose.' : 'Three stars: in the third of the line by the pin, under 15 m from it at the gun.'}`,
          `Левым галсом, в ${Math.round(c.at * 100)}% линии от пина, ${Math.round(Math.max(0, L.gunD))} м до неё на сигнале. ${stars === 3 ? 'Прошёл перед носом у всего флота — гонка твоя.' : 'Три звезды: в трети линии у пина, ближе 15 м на сигнале.'}`, `Por babor, al ${Math.round(c.at * 100)}% de la línea desde la baliza, a ${Math.round(Math.max(0, L.gunD))} m de ella en la señal. ${stars === 3 ? 'Por delante de toda la flota: la regata es tuya.' : 'Tres estrellas: en el tercio de la línea junto a la baliza, a menos de 15 m de ella en la señal.'}`, `Auf Backbord, ${Math.round(c.at * 100)} % der Linie vom Pin entfernt, ${Math.round(Math.max(0, L.gunD))} m von ihm beim Startsignal. ${stars === 3 ? 'Vor dem ganzen Feld: Die Regatta kannst nur du verlieren.' : 'Drei Sterne: im Drittel der Linie am Pin, unter 15 m von ihm beim Startsignal.'}`, `İskele kontra, pinden hat boyunca %${Math.round(c.at * 100)}, start işaretinde ondan ${Math.round(Math.max(0, L.gunD))} m. ${stars === 3 ? 'Tüm filonun önünde: yarışı yalnızca sen kaybedebilirsin.' : 'Üç yıldız: pin yanındaki hat üçte birinde, start işaretinde ondan 15 m’den yakın.'}`);
    }
  } else if (K === 'back' || K === 'race') {
    // From the back: the places made up from the windward mark to the finish. The whole race: where she finished
    const back = K === 'back', gained = dr.place0 - place, ok = P.done && !P.dsq;
    stars = !ok ? 0 : back ? (gained >= 3 && !pens ? 3 : gained >= 1 ? 2 : 1) : place === 1 ? 3 : place <= 3 ? 2 : 1;
    line = !P.done ? tr('Not over the line in time.', 'Не финишировал вовремя.', 'No cruzaste la línea a tiempo.', 'Nicht rechtzeitig über der Linie.', 'Hattı zamanında geçmedi.') : P.dsq ? tr('Finished without taking a penalty: disqualified.', 'Финиш без выполненного штрафа — дисквалификация.', 'Llegaste sin cumplir la penalización: descalificado.', 'Ohne Strafe ins Ziel gekommen: disqualifiziert.', 'Ceza almadan bitirdin: diskalifiye.')
      : back ? tr(`${ord(dr.place0)} at the top mark, ${ord(place)} at the finish${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Through the fleet.' : 'Three stars: three places made up, with no penalty. Go where they aren’t: the other side of the run, the less crowded gate mark, the clear lane up the beat.'}`,
        `${dr.place0}-е у верхнего знака, ${place}-е на финише${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Сквозь весь флот.' : 'Три звезды: три отыгранных места и без штрафа. Иди туда, где их нет: другая сторона фордевинда, свободный знак ворот, чистый коридор на лавировке.'}`, `${ord(dr.place0)} en la baliza de barlovento, ${ord(place)} en la llegada${pens ? ', con una penalización' : ''}. ${stars === 3 ? 'Has atravesado la flota.' : 'Tres estrellas: recupera tres puestos sin penalización. Ve por donde no van ellos: el otro lado de la empopada, la baliza de la puerta menos concurrida, el carril libre en la ceñida.'}`, `${ord(dr.place0)} an der Luvtonne, ${ord(place)} im Ziel${pens ? ', mit einer Strafe' : ''}. ${stars === 3 ? 'Durch das Feld.' : 'Drei Sterne: drei Plätze gutgemacht, ohne Strafe. Geh dahin, wo sie nicht sind: die andere Seite des Vorwindkurses, die weniger gedrängte Torboje, die freie Gasse auf dem Kreuz.'}`, `Rüzgârüstü şamandırasında ${ord(dr.place0)}, bitişte ${ord(place)}${pens ? ', cezalı' : ''}. ${stars === 3 ? 'Filonun içinden geçtin.' : 'Üç yıldız: üç yer kazanmak, ceza almadan. Onların olmadığı yere git: pupa ayağının öbür tarafı, daha az kalabalık kapı şamandırası, orsa ayağında açık koridor.'}`)
      : tr(`${ord(place)} of ${n} against the experts${pens ? `, ${pens} ${pens === 1 ? 'penalty' : 'penalties'}` : ''}. ${stars === 3 ? 'You beat them all.' : 'Three stars: win it. Two: a podium.'}`,
        `${place}-е из ${n} против экспертов${pens ? `, штрафов: ${pens}` : ''}. ${stars === 3 ? 'Ты обыграл всех.' : 'Три звезды: победа. Две: подиум.'}`, `${ord(place)} de ${n} frente a los expertos${pens ? `, ${pens} ${pens === 1 ? 'penalización' : 'penalizaciones'}` : ''}. ${stars === 3 ? 'Los has ganado a todos.' : 'Tres estrellas: gana. Dos: sube al podio.'}`, `${ord(place)} von ${n} gegen die Profis${pens ? `, ${pens} ${pens === 1 ? 'Strafe' : 'Strafen'}` : ''}. ${stars === 3 ? 'Du hast sie alle geschlagen.' : 'Drei Sterne: gewinne sie. Zwei: ein Podium.'}`, `Uzmanlara karşı ${n} tekne içinde ${ord(place)}${pens ? `, ${pens} ceza` : ''}. ${stars === 3 ? 'Hepsini yendin.' : 'Üç yıldız: kazan. İki: podyum.'}`);
  } else if (K === 'run' || K === 'finish') {
    // places gained (or the lead kept) down the run and through the gate, or up the last of the beat and over the line;
    // in heavy air, on her feet all the way
    const run = K === 'run', made = run ? dr.roundT != null : P.done, gained = dr.place0 - place;
    stars = !made ? 0 : pens || dr.wild ? 1 : gained > 0 || place === 1 ? 3 : gained === 0 ? 2 : 1;
    line = made && dr.wild ? tr(`${dr.wild === 'wrap' ? 'The kite wrapped round the forestay' : 'You broached'} on the way down. Three stars: through the gate on her feet, a place gained (or the lead kept). Gybe at full speed with the boat flat, and bear away in the gusts.`,
      `${dr.wild === 'wrap' ? 'Генакер замотался вокруг штага' : 'Брочинг'} на фордевинде. Три звезды: через ворота без брочинга, выигранное место (или удержанное первое). Делай поворот фордевинд на полной скорости и ровной лодкой, уваливайся в порывах.`, `${dr.wild === 'wrap' ? 'El gennaker se enrolló en el estay' : 'Has sufrido una barrenada'} en la bajada. Tres estrellas: pasa la puerta sin volcar, ganando un puesto (o manteniendo la cabeza). Traslucha a toda velocidad con el barco plano y arriba en las rachas.`, `${dr.wild === 'wrap' ? 'Der Kite hat sich um das Vorstag gewickelt' : 'Du bist aus dem Ruder gelaufen'} auf dem Weg nach unten. Drei Sterne: aufrecht durch das Tor, ein Platz gutgemacht (oder die Führung gehalten). Halse mit voller Fahrt bei flachem Boot und fall in den Böen ab.`, `Aşağı inerken ${dr.wild === 'wrap' ? 'balon baş istayına dolandı' : 'savruldun'}. Üç yıldız: kapıdan dik durarak geç, bir yer kazan (ya da liderliği koru). Kavançayı tam hızda, tekne düzken at ve hamlelerde boşla.`)
      : !made ? (run ? tr('Not through the gate in time.', 'Не прошёл ворота вовремя.', 'No pasaste por la puerta a tiempo.', 'Nicht rechtzeitig durch das Tor.', 'Kapıdan zamanında geçilmedi.') : tr('Not over the line in time.', 'Не финишировал вовремя.', 'No cruzaste la línea a tiempo.', 'Nicht rechtzeitig über der Linie.', 'Hattı zamanında geçmedi.'))
      : run ? tr(`${ord(dr.place0)} at the top mark, ${ord(place)} out of the gate${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'Clear air down the run, the gate mark nobody else wanted.' : 'Three stars: a place gained (or the lead kept), and no penalty. Keep your air clear and take the less crowded gate mark.'}`,
        `${dr.place0}-е у верхнего знака, ${place}-е после ворот${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Чистый ветер на фордевинде и свободный знак ворот.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа. Держи чистый ветер и бери свободный знак ворот.'}`, `${ord(dr.place0)} en la baliza de barlovento, ${ord(place)} saliendo de la puerta${pens ? ', con una penalización' : ''}. ${stars === 3 ? 'Aire limpio en la empopada y la baliza de la puerta que nadie quería.' : 'Tres estrellas: gana un puesto (o sigue en cabeza) y sin penalización. Mantén el aire limpio y elige la baliza de la puerta menos concurrida.'}`, `${ord(dr.place0)} an der Luvtonne, ${ord(place)} aus dem Tor${pens ? ', mit einer Strafe' : ''}. ${stars === 3 ? 'Freier Wind auf dem Vorwindkurs, die Torboje, die sonst keiner wollte.' : 'Drei Sterne: ein Platz gutgemacht (oder die Führung gehalten) und keine Strafe. Halte deinen Wind frei und nimm die weniger gedrängte Torboje.'}`, `Rüzgârüstü şamandırasında ${ord(dr.place0)}, kapıdan çıkışta ${ord(place)}${pens ? ', cezalı' : ''}. ${stars === 3 ? 'Pupa ayağında temiz rüzgâr, kimsenin istemediği kapı şamandırası.' : 'Üç yıldız: bir yer kazanmak (ya da liderliği korumak) ve ceza almamak. Rüzgârını temiz tut ve daha az kalabalık kapı şamandırasını al.'}`)
      : tr(`${ord(dr.place0)} with 150 m to go, ${ord(place)} over the line${pens ? ', with a penalty' : ''}. ${stars === 3 ? 'You found the end of the line that pays.' : 'Three stars: a place gained (or the lead kept), and no penalty. Finish at the end of the line nearer you.'}`,
        `${dr.place0}-е за 150 м до финиша, ${place}-е на линии${pens ? ', со штрафом' : ''}. ${stars === 3 ? 'Ты нашёл выгодный конец линии.' : 'Три звезды: выигранное место (или удержанное первое) и без штрафа. Финишируй у ближнего к тебе конца линии.'}`, `${ord(dr.place0)} a 150 m del final, ${ord(place)} al cruzar la línea${pens ? ', con una penalización' : ''}. ${stars === 3 ? 'Encontraste el extremo de la línea que compensa.' : 'Tres estrellas: gana un puesto (o sigue en cabeza) y sin penalización. Llega por el extremo de la línea más cercano a ti.'}`, `${ord(dr.place0)} mit 150 m bis zum Ziel, ${ord(place)} über der Linie${pens ? ', mit einer Strafe' : ''}. ${stars === 3 ? 'Du hast das lohnende Ende der Linie gefunden.' : 'Drei Sterne: ein Platz gutgemacht (oder die Führung gehalten) und keine Strafe. Geh am Ende der Linie ins Ziel, das dir näher liegt.'}`, `150 m kala ${ord(dr.place0)}, hattı geçerken ${ord(place)}${pens ? ', cezalı' : ''}. ${stars === 3 ? 'Hattın işe yarayan ucunu buldun.' : 'Üç yıldız: bir yer kazanmak (ya da liderliği korumak) ve ceza almamak. Hattın sana yakın ucundan bitir.'}`);
  } else {
    stars = P.leg < 2 ? 0 : place <= 2 && !pens ? 3 : place <= Math.ceil(n / 2) ? 2 : 1;
    line = P.leg < 2 ? tr('Not at the mark in time.', 'Не дошёл до знака вовремя.', 'No llegaste a la baliza a tiempo.', 'Nicht rechtzeitig an der Tonne.', 'Şamandıraya zamanında varılmadı.')
      : tr(`${ord(dr.place0)} halfway up, ${ord(place)} of ${n} at the top mark. ${stars === 3 ? 'You played the shifts.' : 'Three stars: first or second there. Tack on the headers.'}`,
        `${dr.place0}-е на половине лавировки, ${place}-е из ${n} у верхнего знака. ${stars === 3 ? 'Ты сыграл на сдвигах.' : 'Три звезды: первым или вторым. Поворачивай на заходах.'}`, `${ord(dr.place0)} a mitad de ceñida, ${ord(place)} de ${n} en la baliza de barlovento. ${stars === 3 ? 'Has sabido jugar las roladas.' : 'Tres estrellas: llega primero o segundo. Vira con las roladas desfavorables.'}`, `${ord(dr.place0)} auf halbem Weg nach oben, ${ord(place)} von ${n} an der Luvtonne. ${stars === 3 ? 'Du hast die Winddreher gespielt.' : 'Drei Sterne: dort Erster oder Zweiter. Wende bei den Drehern.'}`, `Yarı yolda ${ord(dr.place0)}, rüzgârüstü şamandırasında ${n} tekne içinde ${ord(place)}. ${stars === 3 ? 'Rüzgâr dönüşlerini iyi oynadın.' : 'Üç yıldız: orada birinci ya da ikinci. Aleyhte dönüşlerde tramola at.'}`);
  }
  const all = read('regatta-drills') || {}, was = all[dr.id] || 0;
  // a level this opened: said on the end screen, and the next drill offered only if its level is open
  const shut = LEVEL_ORDER.filter((lv) => !levelOpen(lv, all));
  if (stars > was) { all[dr.id] = stars; try { localStorage.setItem('regatta-drills', JSON.stringify(all)); } catch (e) {} }
  const opened = shut.find((lv) => levelOpen(lv, all));
  track('Drill done', { drill: dr.id, stars });
  ctx.stop();
  dr.k?.remove();
  const nx = DRILL_ORDER[DRILL_ORDER.indexOf(dr.id) + 1], next = nx && levelOpen(DRILLS[nx].level, all) ? nx : null;
  const el = document.createElement('div'); el.className = 'drill-end bc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="in"><span class="k">${levelName(DRILLS[dr.id].level)} · ${drillName(dr.id)}</span>
    <h2>${stars === 3 ? tr('Three stars', 'Три звезды', 'Tres estrellas', 'Drei Sterne', 'Üç yıldız') : stars ? tr(`${stars} ${stars === 1 ? 'star' : 'stars'}`, `${stars} ${stars === 1 ? 'звезда' : 'звезды'}`, `${stars} ${stars === 1 ? 'estrella' : 'estrellas'}`, `${stars} ${stars === 1 ? 'Stern' : 'Sterne'}`, `${stars} yıldız`) : tr('Try again', 'Ещё раз', 'Reintentar', 'Nochmal versuchen', 'Yeniden dene')}</h2>
    <div class="st" aria-label="${stars} / 3">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
    <p></p>${stars > was && was ? `<p>${tr('A new best on this drill.', 'Новый рекорд в этой тренировке.', 'Nueva mejor marca en este ejercicio.', 'Neue Bestleistung in dieser Übung.', 'Bu alıştırmada yeni rekor.')}</p>` : ''}${opened ? `<p class="lv">${tr(`${levelName(opened)} drills are open.`, `Открыты тренировки уровня «${levelName(opened)}».`, `Los ejercicios de ${levelName(opened)} están abiertos.`, `${levelName(opened)}: Übungen freigeschaltet.`, `${levelName(opened)} alıştırmaları açıldı.`)}</p>` : ''}
    <div class="bs"><a class="go" href="${location.pathname}${location.search}">${tr('Again', 'Ещё раз', 'Otra vez', 'Nochmal', 'Yeniden')}</a>${next ? `<a href="/play?race=free&drill=${next}">${tr('Next drill', 'Следующая', 'Siguiente ejercicio', 'Nächste Übung', 'Sonraki alıştırma')}</a>` : ''}<a href="/race/drills">${tr('All drills', 'Все тренировки', 'Todos los ejercicios', 'Alle Übungen', 'Tüm alıştırmalar')}</a></div></div>`;
  el.querySelector('p').textContent = line;
  document.body.append(el);
  el.querySelector('a.go').focus();
}
const ord = (n) => ctx?.LANG === 'es' ? `${n}.º` : ctx?.LANG === 'de' || ctx?.LANG === 'tr' ? `${n}.` : `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
