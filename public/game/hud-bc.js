// The HUD. The race laid out as a sailing TV broadcast lays it out, in the design system of public/ui/tokens.css:
//   top left      the race bug (the race, the venue, the clock) and under it the umpire's and the boat's calls
//   top centre    the gun clock with the committee's flags and the line's bias; after the gun, the legs
//   top right     camera, zoom, game speed, pause; the wind; the fleet board
//   bottom left   the course map (on a touch screen the rudder, the map higher up)
//   bottom centre the one call (what to do next), the leg you're on, your numbers
//   bottom right  the tack button, the sails' buttons, the sheet
//   on the water  the mark you're sailing to, labelled
// It takes the game's own controls and readouts (the same elements, so main.js drives them as before) and moves them
// into these blocks.
import { D2R, KN, NO_GO, clamp, wrap, idealSail, sheetFor, beatAngle, polarSpeed, legTargets, legAim, isBeat, LEVELS } from './sim.js';
import { VENUE } from './venues.js';

// "place" counted in Russian: 1 место, 2–4 места, 5 and on мест (11–14 мест too)
const ruPlaces = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'место' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'места' : 'мест');

// the HUD's own words; test/ui.test.mjs checks both languages have them all
export const HUD_STRINGS = {
  en: {
    title: 'Up and down', daily: 'Daily race', free: 'Free race', live: 'Live', startIn: 'Start in', gun: 'Gun',
    bias: 'Line bias', pinEnd: 'Pin end', boatEnd: 'Boat end', square: 'Square', line: 'Line',
    legOf: (n, N) => `Leg ${n} of ${N}`, legN: (n) => `Leg ${n}`, legShort: (n, N) => `Leg ${n}/${N}`, up: 'Up', down: 'Down', reach: 'Reach',
    upwind: 'upwind', downwind: 'downwind', reaching: 'reach', stbd: 'starboard', port: 'port', preStart: 'Pre-start',
    finish: 'Finish', finished: 'Finished', trueWind: 'True wind', from: 'From', lift: 'Lift', header: 'Header',
    onLine: 'On the line', toLineSpd: 'To line · speed', gap: 'Gap', leader: 'Leader', course: 'Course',
    shape: { wl: 'Windward–leeward', tri: 'Triangle', trap: 'Trapezoid', wlu: 'Upwind finish' },
    speed: 'Speed', ofTarget: 'Of target', vmg: 'VMG', toMark: 'To mark', toLine: 'To line', burn: 'Time to burn',
    toLeader: 'To leader', ahead: 'Ahead of 2nd', sec: 's', time: 'Time', start: 'Start', perMin: '/min', camera: 'Camera', pause: 'Pause',
    you: 'You', layIn: (s) => `Layline in ${s} · then tack`, layNow: 'On the layline · tack', over: 'Past the layline · tack now', fetch: 'Laying the mark',
    advantage: 'Advantage',
    camName: { drone: 'Drone camera', top: 'Top camera', helm: 'Helm camera' },
    space: 'Space', boardFoot: (n) => `The boats round you · ${n} in all`,
    level: { beginner: 'Beginner', club: 'Club', racer: 'Racer', expert: 'Expert' },
    toLeg: { lineStart: 'To the start line', mark: 'To the windward mark', mark1: 'To mark 1', wing: 'To the wing mark', mark2: 'To mark 2', offset: 'To the offset mark', gate: 'To the leeward gate', finish: 'To the finish' },
    go: 'Go', leads: 'Leads', afterGun: 'after the gun', ord: (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`,
    umpire: 'Umpire · penalty', oneTurn: 'one turn', ruleN: (r) => `Rule ${r}`, against: (n) => `Against ${n}`, againstYou: 'Against you', pen: 'Pen',
    split: 'split', timeGap: 'Time · gap', due: 'Grey: still to round, metres to the mark', toGo: 'to go',
    squareAt: 'square', veer: 'Veer', back: 'Back', mToLine: (m) => `${m} m to line`,
    hold: (s) => `Hold ${s}, then bear away`, bearNow: 'Bear away now, full speed', late: 'Late: bear away now',
    mvUp: (n) => (n > 1 ? `Up ${n} places` : 'Up a place'), mvDown: (n) => (n > 1 ? `Down ${n} places` : 'Down a place'),
    mvPast: (n) => `Past ${n}`, mvBy: (n) => `${n} through`, mvTheirPen: 'Her penalty turn', mvYourPen: 'Your penalty turn',
    mvMark: 'At the mark', mvShift: 'On the shift',
  },
  ru: {
    title: 'Up and down', daily: 'Гонка дня', free: 'Свободная гонка', live: 'Эфир', startIn: 'До старта', gun: 'Старт',
    bias: 'Перекос линии', pinEnd: 'У знака', boatEnd: 'У судна', square: 'Ровная', line: 'Линия',
    legOf: (n, N) => `Отрезок ${n} из ${N}`, legN: (n) => `Отрезок ${n}`, legShort: (n, N) => `Отр. ${n}/${N}`, up: 'Апвинд', down: 'Даунвинд', reach: 'Траверз',
    upwind: 'апвинд', downwind: 'даунвинд', reaching: 'траверз', stbd: 'правый галс', port: 'левый галс', preStart: 'Предстарт',
    finish: 'Финиш', finished: 'Финиш пройден', trueWind: 'Истинный ветер', from: 'С', lift: 'Отход', header: 'Заход',
    onLine: 'На линии', toLineSpd: 'До линии · скорость', gap: 'Разрыв', leader: 'Лидер', course: 'Дистанция',
    shape: { wl: 'Апвинд — даунвинд', tri: 'Треугольник', trap: 'Трапеция', wlu: 'Финиш наверху' },
    speed: 'Скорость', ofTarget: 'От цели', vmg: 'VMG', toMark: 'До знака', toLine: 'До линии', burn: 'Запас времени',
    toLeader: 'До лидера', ahead: 'Впереди второго', sec: 'с', time: 'Время', start: 'Старт', perMin: '/мин', camera: 'Камера', pause: 'Пауза',
    you: 'Ты', layIn: (s) => `Лейлайн через ${s} · потом поворот`, layNow: 'На лейлайне · поворот', over: 'Лейлайн пройден · поворачивай', fetch: 'Идёшь на знак',
    advantage: 'Выигрыш',
    camName: { drone: 'Камера с дрона', top: 'Камера сверху', helm: 'Камера у штурвала' },
    space: 'Пробел', boardFoot: (n) => `Лодки рядом с тобой · всего ${n}`,
    level: { beginner: 'Новичок', club: 'Клуб', racer: 'Гонщик', expert: 'Эксперт' },
    toLeg: { lineStart: 'К линии старта', mark: 'К верхнему знаку', mark1: 'К знаку 1', wing: 'К боковому знаку', mark2: 'К знаку 2', offset: 'К знаку смещения', gate: 'К нижним воротам', finish: 'К финишу' },
    go: 'Старт!', leads: 'Лидирует', afterGun: 'после сигнала', ord: (n) => `${n}-й`,
    umpire: 'Судья · штраф', oneTurn: 'один оборот', ruleN: (r) => `Правило ${r}`, against: (n) => `Против ${n}`, againstYou: 'Против тебя', pen: 'Штраф',
    split: 'отсечка', timeGap: 'Время · разрыв', due: 'Серым: ещё не обогнули, метров до знака', toGo: 'осталось',
    squareAt: 'ровная при', veer: 'Сдвиг вправо', back: 'Сдвиг влево', mToLine: (m) => `${m} м до линии`,
    hold: (s) => `Выжди ${s}, потом уваливайся`, bearNow: 'Уваливайся сейчас, полный ход', late: 'Опаздываешь: уваливайся сейчас',
    mvUp: (n) => `+${n} ${ruPlaces(n)}`, mvDown: (n) => `−${n} ${ruPlaces(n)}`,
    mvPast: (n) => `${n} позади`, mvBy: (n) => `${n} впереди`, mvTheirPen: 'Она крутит штраф', mvYourPen: 'Ты крутишь штраф',
    mvMark: 'На знаке', mvShift: 'На сдвиге ветра',
  },
};

const ic = (svg) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'>${svg}</svg>`)}")`;
const ICON = {
  tack: ic("<g fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 9c2.5-4.5 9.5-4.5 12 0'/><path d='M12.5 9H16.5V5'/><path d='M10 11.5V17'/></g>"),
  kite: ic("<path d='M5 17C4 11 6 5 11 2c5 4 6 10 4 15Z' fill='#000'/>"),
  reef: ic("<g stroke='#000' stroke-width='2.2' stroke-linecap='round'><path d='M4 5h12M6 10h8M8 15h4'/></g>"),
  jib: ic("<path d='M7 2.5v14.5h9.5Z' fill='#000'/>"),
  hail: ic("<path d='M3 8v4h3l6 4V4L6 8Z' fill='#000'/><path d='M15 7c1.4 1.7 1.4 4.3 0 6' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round'/>"),
};
const CAM_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2" y="5" width="11" height="10" rx="1"/><path d="M13 9l5-2.6v7.2L13 11"/></g></svg>';
const ARROW = { up: 'M5 1 L9 8 H1 Z', down: 'M5 9 L9 2 H1 Z', reach: 'M9 5 L2 1 V9 Z' };

// The layouts follow the screen: wide (a computer, a tablet sideways) as the designs are drawn at 1600×1000, compact
// (a phone sideways, 844×390) and compact upright. Each is scaled as a whole to the screen it's on (--hz).
const WIDE = '(min-width: 1100px) and (min-height: 640px)';
// the blocks come in one after another, in reading order (the design's 60 ms stagger): the delay of the i-th
const AT = (i) => `calc(${i} * var(--t-stagger) + 150ms)`;
const CSS = `
#hud.bc { zoom: var(--hz, 1); }
#hud.bc > .tc, #hud.bc > .tr, #hud.bc > .tl { display: none !important; }
.bx { display: none !important; }
#hud.bc .bx { display: flex !important; position: absolute; pointer-events: none; }
#hud.bc [hidden] { display: none !important; }
#hud.bc button { pointer-events: auto; }

/* ---------- top left: the race bug, the calls under it ---------- */
.b-bug { left: calc(28px + var(--sl)); top: calc(26px + var(--st)); align-items: stretch; height: 52px; animation: bc-slide-l var(--t-in) var(--ease) both ${AT(0)}; }
.b-bug .b-acc { width: 6px; background: var(--you); }
.b-bug .b-bug-t { display: flex; flex-direction: column; justify-content: center; gap: var(--s-2); padding: 0 var(--s-5) 0 var(--s-4); }
.b-bug .b-title { font: 700 var(--fs-row)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; }
.b-bug .b-live { display: flex; align-items: center; gap: var(--s-2); padding: 0 var(--s-6) 0 var(--s-4); }
.b-bug .b-clock { font: 700 var(--fs-lead)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; }
.b-bug .b-clock.run { letter-spacing: 0; font-size: var(--fs-row); }
.b-calls { left: calc(28px + var(--sl)); top: calc(90px + var(--st)); flex-direction: column; align-items: flex-start; gap: var(--s-1); }
#hud.bc #chips { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-1); }
#hud.bc #chips .chip { display: inline-flex; align-items: center; height: 30px; border-radius: 0; background: var(--panel); color: var(--ink); border-left: 4px solid var(--c, var(--ink)); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); }
#hud.bc #chips .chip.bad { --c: var(--live); } #hud.bc #chips .chip.warn { --c: var(--down); } #hud.bc #chips .chip.ok { --c: var(--up); }
/* each call one element, its words changing in place; in with a slide, out with a fade while the others close up */
.nx-chip { overflow: hidden; white-space: nowrap; max-width: 0; padding-left: 0 !important; padding-right: 0 !important; opacity: 0; translate: -12px 0;
  transition: opacity .45s ease, translate .55s var(--ease), max-width .55s var(--ease), padding .55s var(--ease), border-color .5s; }
.nx-chip.in { max-width: 420px; padding-left: var(--s-3) !important; padding-right: var(--s-4) !important; opacity: 1; translate: 0 0; }
.nx-chip.out { transition: opacity .5s ease, translate .6s var(--ease), max-width .6s var(--ease) .15s, padding .6s var(--ease) .15s; }
#hud.bc #trim { position: static; height: 30px; border-radius: 0; background: var(--live); color: var(--ink); padding: 0 var(--s-4) 0 var(--s-3); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; -webkit-backdrop-filter: none; backdrop-filter: none; }
#hud.bc #trim:not([data-s="irons"]) { display: none; }
#hud.bc #trim i { background: var(--ink); }

/* ---------- top centre: the gun clock, then the legs ---------- */
.b-top { left: 50%; top: calc(22px + var(--st)); translate: -50% 0; flex-direction: column; align-items: center; gap: var(--s-2); animation: bc-drop var(--t-in) var(--ease) both ${AT(1)}; }
.b-gun { display: flex; align-items: stretch; }
.b-gun > div { display: flex; flex-direction: column; justify-content: center; gap: var(--s-2); }
.b-flagbox { flex-direction: row !important; align-items: center; gap: var(--s-3); padding: 0 var(--s-5) 0 var(--s-8); }
.b-flagbox:has(#flags:empty) { display: none !important; }
#hud.bc #flags { position: static; display: flex; gap: var(--s-3); padding: 0; background: none; border-radius: 0; -webkit-backdrop-filter: none; backdrop-filter: none; animation: none; }
#hud.bc #flags figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
#hud.bc #flags .flag { width: 38px; height: 26px; border-radius: 0; box-shadow: 0 0 0 1px var(--w-35); animation: none; }
#hud.bc #flags .flag.P::after { inset: 8px 13px; }
#hud.bc #flags .flag.cls { background: var(--gold); color: var(--ink-on); font: 700 var(--fs-lead)/26px var(--cond); }
#hud.bc #flags figcaption { font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
.b-gunc { align-items: center; padding: var(--s-3) var(--s-8); min-width: 240px; }
.b-gunn { font: 800 var(--fs-h1)/0.9 var(--cond); transition: color .4s; }
.b-gunn.soon { color: var(--gold); } .b-gunn.now { color: var(--live); }
.b-gunn.beat { animation: bc-beat .5s var(--ease); } /* the last ten seconds: a beat a second, in its own place */
.b-seq { position: relative; width: 200px; height: 4px; background: var(--fill-3); }
.b-seq > i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--you); transition: width .6s var(--ease); }
.b-seq > b { position: absolute; top: -3px; width: 2px; height: 10px; background: var(--ink); }
.b-seql { position: relative; width: 200px; height: 12px; }
.b-seql > span { position: absolute; top: 0; translate: -50% 0; font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; color: var(--ink-3); }
.b-seql > span:first-child { translate: 0 0; } .b-seql > span:last-child { translate: -100% 0; }
.b-bias { padding: 0 var(--s-10) 0 var(--s-5); }
.b-legs { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-3) var(--s-8); }
.b-legs .b-legr { display: flex; gap: var(--s-1); }
.b-legs .b-leg { display: flex; align-items: center; justify-content: center; gap: var(--s-2); min-width: 74px; height: 26px; padding: 0 var(--s-2); background: var(--w-10); color: var(--ink-3); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; transition: background-color .5s, color .5s; }
.b-legs .b-leg.done { background: var(--w-25); color: var(--ink); }
.b-legs .b-leg.now { background: var(--you); color: var(--ink-on); }
.b-legs .b-leg svg { width: 10px; height: 10px; flex: none; }
/* under the top camera the wind rides in the leg tracker: which way it blows across the picture, and how strong */
.b-lw { display: flex; align-items: center; gap: var(--s-2); padding-left: var(--s-4); border-left: 1px solid var(--rule); }
.b-lw svg { width: 18px; height: 18px; flex: none; color: var(--you); }

/* ---------- top right: the buttons and the wind; the board under them ---------- */
.b-tr { right: calc(28px + var(--sr)); top: calc(26px + var(--st)); align-items: flex-start; gap: var(--s-2); animation: bc-slide-r var(--t-in) var(--ease) both ${AT(2)}; }
.b-btns { display: flex; gap: var(--s-1); }
#hud.bc .b-btns > button { position: static; display: inline-flex; align-items: center; justify-content: center; gap: 0; width: auto; min-width: var(--h-m); height: var(--h-m); padding: 0; margin: 0; border: 0; border-radius: 0; background: var(--panel); color: var(--ink); font: 700 var(--fs-body)/1 var(--cond); letter-spacing: 0; -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); transition: background-color var(--t-quick), color var(--t-quick), scale .12s; }
#hud.bc .b-btns > button:hover { background: var(--panel-2); }
#hud.bc .b-btns > button:active { scale: .94; background: var(--you); color: var(--ink-on); }
#hud.bc .b-btns > #zoomIn, #hud.bc .b-btns > #zoomOut { font-size: var(--fs-title); font-weight: 600; }
#hud.bc .b-btns > #speedBtn.fast { background: var(--you); color: var(--ink-on); }
#hud.bc .b-btns > #pauseBtn svg { width: 14px; height: 14px; }
.b-cam span { max-width: 0; overflow: hidden; opacity: 0; white-space: nowrap; font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; transition: max-width .35s var(--ease), opacity .25s, margin .35s var(--ease); }
#hud.bc .b-cam { padding: 0 var(--s-3) !important; }
.b-cam.say span { max-width: 90px; opacity: 1; margin-left: var(--s-2); }
.b-wind { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-3) var(--s-5) var(--s-3) var(--s-8); margin-left: var(--s-1); }
.b-wind svg { width: 64px; height: 64px; flex: none; display: block; }
.b-wind .b-wt { display: flex; flex-direction: column; gap: var(--s-2); }
.b-wind .b-wl { letter-spacing: var(--ls-button); white-space: nowrap; }
.b-board { right: calc(28px + var(--sr)); top: calc(126px + var(--st)); width: 340px; flex-direction: column; animation: bc-slide-r var(--t-in) var(--ease) both ${AT(3)}; }
.b-board .b-bh { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--rule); }
.b-row { display: flex; align-items: center; height: 40px; border-bottom: 1px solid var(--rule-2); transition: background-color .4s; }
.b-row:last-child { border-bottom: 0; }
.b-row .b-pos { width: 36px; align-self: stretch; display: flex; align-items: center; justify-content: center; background: var(--fill-2); font: 700 var(--fs-row)/1 var(--cond); }
.b-row.first .b-pos { background: var(--ink); color: var(--ink-on); }
.b-row.me { background: color-mix(in srgb, var(--you) 16%, transparent); }
.b-row.me .b-pos { background: var(--you); color: var(--ink-on); }
.b-row .b-bar { width: 4px; align-self: stretch; background: var(--c, var(--fill-3)); }
/* the boat's country flag, 3:2, before her name (none when she flies none) */
#hud.bc .b-fl, #bOver .b-fl { flex: none; display: block; width: 24px; height: 16px; object-fit: cover; box-shadow: 0 0 0 1px var(--w-25); }
#hud.bc .b-row .b-fl { margin-left: var(--s-3); }
#hud.bc .b-row .b-fl + .b-nm { padding-left: var(--s-2); }
#hud.bc .b-fl[hidden], #bOver .b-fl[hidden] { display: none; }
.b-row.me .b-bar { background: var(--you); }
.b-row .b-nm { flex: 1; min-width: 0; padding-left: var(--s-3); font: 700 var(--fs-row)/1 var(--cond); letter-spacing: var(--ls-name); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.b-row .b-mv { width: 18px; font: 700 var(--fs-small)/1 var(--cond); }
.b-row .b-mv.u { color: var(--up); } .b-row .b-mv.d { color: var(--down); }
.b-row .b-gp { min-width: 72px; padding-right: var(--s-4); text-align: right; font: 700 var(--fs-row)/1 var(--cond); }
.b-row .b-gp.dim { color: var(--ink-3); } .b-row.me .b-gp { color: var(--you); }
.b-row .b-x { min-width: 52px; padding-right: var(--s-4); text-align: right; font: 700 var(--fs-row)/1 var(--cond); color: var(--ink-2); }
.b-board.pre .b-pos { display: none; } .b-board:not(.pre) .b-x { display: none; }
.b-board.pre .b-row { height: 34px; } .b-board.pre .b-mv { display: none; }
/* under the rows: how many boats there are, and the key that hides the board and brings it back */
.b-bf { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding: var(--s-2) var(--s-4) var(--s-3); border-top: 1px solid var(--rule-2); }
.b-lk { display: none; font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); color: var(--ink-3); border: 1px solid var(--rule); padding: var(--s-1) var(--s-2); }
@media (hover: hover) and (pointer: fine) { .b-lk { display: inline-block; } }
#hud.bc .b-board.off { display: none !important; }

/* ---------- bottom left: the course ---------- */
.b-map { left: calc(28px + var(--sl)); bottom: calc(28px + var(--sb)); flex-direction: column; animation: bc-rise var(--t-in) var(--ease) both ${AT(4)}; }
.b-map .b-mh { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); padding: var(--s-3) var(--s-4) var(--s-2); }
#hud.bc #mini { position: static; display: block; width: 240px; height: 240px; margin: 0 var(--s-1) var(--s-1); border: 0; border-radius: 0; background: none; opacity: 1; pointer-events: auto; -webkit-backdrop-filter: none; backdrop-filter: none; transition: width .3s var(--ease), height .3s var(--ease); }
#hud.bc #mini.big { width: min(420px, calc(100vh / var(--hz, 1) - 260px)); height: min(420px, calc(100vh / var(--hz, 1) - 260px)); }
@media (pointer: coarse) { .b-map { bottom: auto; top: calc(196px + var(--st)); } #hud.bc #rudder { width: 250px; height: 140px; } } /* the rudder has the corner */
/* on a computer the keys steer, and the mouse can too: the arc shows only while it's held, right of the map */
@media (hover: hover) and (pointer: fine) {
  #hud.bc #rudder { left: calc(296px + var(--sl)); bottom: calc(24px + var(--sb)); opacity: 0; transition: opacity .25s; }
  #hud.bc #rudderZone.held #rudder { opacity: 1; transition: opacity .1s; }
}

/* ---------- bottom centre: the call, the leg, your numbers ---------- */
.b-low { left: 50%; bottom: calc(28px + var(--sb)); translate: -50% 0; flex-direction: column; align-items: stretch; animation: bc-rise var(--t-in) var(--ease) both ${AT(5)}; }
.b-callrow { display: flex; min-height: 30px; margin-bottom: var(--s-2); }
#hud.bc #toast { position: static; margin: 0; transform: none; translate: 0 0; display: flex; align-items: center; gap: var(--s-3); max-width: 640px; min-height: 30px; padding: var(--s-2) var(--s-4); border-radius: 0; background: var(--ink); color: var(--ink-on); font: 700 var(--fs-small)/1.15 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; text-align: left; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; }
#hud.bc #toast.long { font: 600 var(--fs-body)/1.3 var(--cond); letter-spacing: var(--ls-name); text-transform: none; }
#hud.bc #toast.show { animation: bc-call 1.1s var(--ease) both; }
.b-state { align-self: flex-start; padding: var(--s-2) var(--s-8) var(--s-2) var(--s-4); background: var(--you); color: var(--ink-on); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%); transition: background-color .4s; }
.b-state.bad { background: var(--live); color: var(--ink); }
.b-you { display: flex; align-items: stretch; height: 78px; }
.b-you { padding-right: var(--s-1); }
.b-you > div { display: flex; flex-direction: column; justify-content: center; gap: var(--s-2); padding: 0 var(--s-5); }
.b-you > div + div { border-left: 1px solid var(--rule); }
.b-you .c-pos { width: 48px; padding: 0 !important; align-items: center; background: var(--you); color: var(--ink-on); font: 700 var(--fs-h3)/1 var(--cond); }
.b-you .c-nm { flex-direction: row; align-items: center; gap: var(--s-3); padding-left: var(--s-5); }
.b-you .c-nm i { width: 6px; height: 30px; background: var(--you); }
/* your flag and sail number, "You" under them; the blue bar where you fly no flag */
#hud.bc .b-you .c-nm .b-fl { width: 30px; height: 20px; }
.b-you .c-nm .b-fl:not([hidden]) + i { display: none; }
.b-you .c-nmt { display: flex; flex-direction: column; gap: var(--s-2); white-space: nowrap; }
.b-you .c-nmt .lbl { color: var(--you); }
.b-you .c-leg { display: none; }
.b-you .b-v { display: flex; align-items: baseline; gap: var(--s-2); white-space: nowrap; }
.b-you .b-g { position: relative; width: 100px; height: 3px; background: var(--fill-3); }
.b-you .b-g i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); transition: width .6s var(--ease), background-color .4s; }
.b-you .b-g::after { content: ''; position: absolute; left: 90.9%; top: -3px; width: 2px; height: 9px; background: var(--ink); }
.b-you .good { color: var(--up); } .b-you .b-g.good i { background: var(--up); }
.b-you .low { color: var(--down); } .b-you .b-g.low i { background: var(--down); }
.b-you .late { color: var(--live); }
.b-you .b-sub { font: 600 var(--fs-body)/1 var(--cond); color: var(--ink-2); }
.b-you.pre > div:not(.s-pre), .b-you.run > div:not(.s-run), .b-you.done > div:not(.s-done) { display: none !important; }

/* ---------- bottom right: the buttons and the sheet ---------- */
.b-acts { right: calc(108px + var(--sr)); bottom: calc(28px + var(--sb)); flex-direction: column; align-items: flex-end; gap: var(--s-2); animation: bc-slide-r var(--t-in) var(--ease) both ${AT(6)}; }
#hud.bc.split-trim .b-acts { right: calc(168px + var(--sr)); }
#hud.bc .b-acts > .round { position: static; display: inline-flex; align-items: center; gap: var(--s-3); width: auto !important; height: var(--h-m) !important; padding: 0 var(--s-4) 0 var(--s-6); margin: 0; border: 0; border-radius: 0; background: var(--panel); color: var(--ink); font: 700 var(--fs-body)/1 var(--cond) !important; letter-spacing: var(--ls-button); text-transform: uppercase; clip-path: polygon(var(--cut) 0, 100% 0, 100% 100%, 0 100%); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); animation: bc-slide-r .4s var(--ease) both; transition: background-color var(--t-quick), color var(--t-quick), scale .12s; }
#hud.bc .b-acts > .round::before { content: ''; width: 18px; height: 18px; flex: none; background: currentColor; -webkit-mask: var(--ic) center / contain no-repeat; mask: var(--ic) center / contain no-repeat; }
#hud.bc .b-acts > #tackBtn { height: 64px !important; padding: 0 var(--s-6) 0 var(--s-8); --ic: ${ICON.tack}; }
#hud.bc .b-acts > #tackBtn::before { width: 22px; height: 22px; }
#hud.bc .b-acts > #kiteBtn { --ic: ${ICON.kite}; } #hud.bc .b-acts > #reefBtn { --ic: ${ICON.reef}; }
#hud.bc .b-acts > #jibBtn { --ic: ${ICON.jib}; } #hud.bc .b-acts > #hailBtn { --ic: ${ICON.hail}; background: var(--gold); color: var(--ink-on); }
#hud.bc .b-acts > .round:active, #hud.bc .b-acts > .round.down, #hud.bc .b-acts > .round.on { background: var(--you); color: var(--ink-on); }
#hud.bc .b-acts > .round:active { scale: .96; }
#hud.bc .b-acts > .round[hidden] { display: none !important; }
#hud.bc .b-acts > .round.fresh { animation: bc-slide-r .4s var(--ease) both, b-fresh 1.5s ease-in-out .4s infinite; }
@keyframes b-fresh { 50% { background-color: color-mix(in srgb, var(--you) 45%, rgba(5, 10, 18, 0.88)); } }
@media (hover: hover) and (pointer: fine) {
  #hud.bc .b-acts > #tackBtn::after, #hud.bc .b-acts > #kiteBtn::after { font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); color: var(--ink-3); border: 1px solid var(--rule); padding: var(--s-1) var(--s-2); text-transform: none; }
  #hud.bc .b-acts > #tackBtn::after { content: attr(data-key); } #hud.bc .b-acts > #kiteBtn::after { content: 'K'; }
  #hud.bc .b-acts > .round.on::after, #hud.bc .b-acts > .round.down::after { color: var(--ink-on); border-color: rgba(4, 18, 30, 0.3); }
}
#hud.bc #sheetZone { right: calc(28px + var(--sr)); bottom: calc(28px + var(--sb)); width: 64px; height: min(300px, calc(100vh / var(--hz, 1) - 440px)); padding: 36px 0 40px; justify-content: center; background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); transition: opacity .4s; animation: bc-slide-r var(--t-in) var(--ease) both ${AT(7)}; }
#hud.bc #sheetZone.split { width: 124px; }
#hud.bc #sheetZone.auto { opacity: .45; }
#hud.bc #sheet, #hud.bc #jibSheet { width: 6px; height: 100%; border: 0; border-radius: 0; background: var(--fill-3); box-shadow: none; }
#hud.bc #jibSheet { margin-right: 54px; }
#hud.bc #sheetZone.split #jibSheet { display: block; }
#hud.bc #sheet .band, #hud.bc #jibSheet .band { left: 0; right: 0; border-radius: 0; background: var(--up); box-shadow: 0 0 10px rgba(46, 230, 160, 0.5); transition: top .3s var(--ease), height .3s var(--ease); }
#hud.bc #sheet .knob, #hud.bc #jibSheet .knob { left: -15px; width: 36px; height: 16px; border: 0; border-radius: 0; background: var(--ink); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.4); transition: background-color .25s, scale .15s; }
#hud.bc #jibSheet .knob { box-shadow: inset 0 0 0 3px var(--you); }
#hud.bc #sheet.off .knob, #hud.bc #jibSheet.off .knob { background: var(--down); }
#hud.bc #sheetZone:active .knob { scale: 1.12; }
#hud.bc #sheet .cap, #hud.bc #jibSheet .cap { display: block !important; font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); text-shadow: none; }
#hud.bc #sheet .cap.t, #hud.bc #jibSheet .cap.t { top: -24px; } #hud.bc #sheet .cap.b, #hud.bc #jibSheet .cap.b { bottom: -24px; }
/* which way to pull, over the sheet */
.b-adv { position: absolute; right: -29px; top: -70px; display: none; align-items: center; gap: var(--s-1); height: 26px; padding: 0 var(--s-3); background: var(--ink); color: var(--ink-on); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; white-space: nowrap; pointer-events: none; }
#hud.bc .b-adv { display: inline-flex; opacity: 0; transition: opacity .25s; }
#hud.bc .b-adv.on { opacity: 1; }
.b-adv i { font-style: normal; display: inline-block; animation: b-bob .9s ease-in-out infinite; }
.b-adv.t i { animation-name: b-bob-up; }
@keyframes b-bob { 50% { translate: 0 2px; } } @keyframes b-bob-up { 50% { translate: 0 -2px; } }
/* the rudder, on a touch screen */
#hud.bc #rudder { opacity: .55; transition: opacity .4s; }
#hud.bc #rudder.act { opacity: 1; transition: opacity .12s; }
#hud.bc #rudder .track { stroke: rgba(5, 10, 18, 0.62); stroke-width: 24; stroke-linecap: butt; }
#hud.bc #rudder .ticks { stroke: var(--w-25); }
#hud.bc #rudderKnob { fill: var(--ink); stroke: var(--you); stroke-width: 3; r: 12; transition: r .15s; }
#hud.bc #rudder.act #rudderKnob { r: 14; }
.b-mid { display: none; stroke: var(--w-62); stroke-width: 2; }
#hud.bc .b-mid { display: inline; }

/* the last ten seconds, big, a beat a second: on a phone, where the gun clock is folded away (a wide screen beats the
   gun clock itself) */
#hud.bc #count:not(.final) { display: none; }
@media ${WIDE} { #hud.bc #count { display: none; } }
#hud.bc #count.final { left: 50%; top: 30%; bottom: auto; transform: translateX(-50%); font: 800 180px/0.9 var(--cond); color: var(--ink); text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); }
#hud.bc #count.beat { animation: bc-beat .5s var(--ease); }

/* ---------- on the water: the mark you're sailing to ---------- */
#nxTag { position: fixed; left: 0; top: 0; z-index: 2; pointer-events: none; zoom: var(--hz, 1); display: none; will-change: transform; }
#nxTag.on { display: block; }
#nxTag .in { position: absolute; left: 0; bottom: 0; translate: -50% -22px; display: flex; align-items: stretch; height: 28px; background: var(--panel); color: var(--ink); white-space: nowrap; clip-path: polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px)); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); animation: bc-drop .5s var(--ease) both; }
#nxTag .buoy { width: 26px; display: flex; align-items: center; justify-content: center; background: var(--ink); flex: none; }
#nxTag .buoy i { width: 9px; height: 13px; border-radius: 2px; background: var(--buoy); display: block; }
#nxTag.line .buoy i { width: 12px; height: 4px; border-radius: 0; background: var(--gold); }
#nxTag .t-nm { display: flex; align-items: center; padding: 0 var(--s-3); font: 700 var(--fs-body)/1 var(--cond); letter-spacing: var(--ls-name); }
#nxTag .t-v { display: flex; align-items: center; padding: 0 var(--s-3); border-left: 1px solid var(--rule); font: 600 var(--fs-body)/1 var(--cond); color: var(--ink-2); }
#nxTag .stem { position: absolute; left: -1px; bottom: 0; width: 2px; height: 22px; background: linear-gradient(var(--w-90), var(--w-14)); transform-origin: top; animation: bc-pin .35s var(--ease) both .3s; }
#nxTag.edge .stem { display: none; } #nxTag.edge .in { translate: -50% 50%; }
#nxTag .ptr { display: none; align-items: center; justify-content: center; width: 26px; flex: none; color: var(--ink); background: var(--you); transition: transform .2s linear; }
#nxTag .ptr svg { width: 14px; height: 14px; display: block; }
#nxTag.edge .ptr { display: flex; } #nxTag.edge .buoy { display: none; }

/* the race's moments, as a broadcast cuts to them: a split at each mark, the gun, the finish; a place won or lost */
.b-split { display: none; align-self: flex-start; align-items: stretch; height: 34px; margin-bottom: var(--s-2); }
#hud.bc .b-split.on { display: flex; animation: b-split 4.8s var(--ease) both; }
@keyframes b-split { 0% { clip-path: inset(0 100% 0 0); } 9% { clip-path: inset(0 0 0 0); } 90% { clip-path: inset(0 0 0 0); opacity: 1; } 100% { clip-path: inset(0 0 0 0); opacity: 0; } }
.b-split > * { display: flex; align-items: center; padding: 0 var(--s-4); white-space: nowrap; }
.b-split .k { background: var(--you); color: var(--ink-on); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; }
.b-split .t { background: var(--ink); color: var(--ink-on); font: 800 var(--fs-row)/1 var(--cond); text-transform: uppercase; }
.b-split .v { background: var(--panel); font: 700 var(--fs-row)/1 var(--cond); }
.b-split .g { padding-right: var(--s-6); background: var(--panel); border-left: 1px solid var(--rule); font: 700 var(--fs-lead)/1 var(--cond); clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); }
.b-split .g.gold { color: var(--gold); } .b-split .g.up { color: var(--up); } .b-split .g.down { color: var(--down); }
/* a place won or lost: the split's strip, green up, orange down; who, and why when it's plain */
.b-move { display: none; align-self: flex-start; align-items: stretch; height: 34px; margin-bottom: var(--s-2); }
#hud.bc .b-move.on { display: flex; animation: b-split 4.8s var(--ease) both; }
.b-move > * { display: flex; align-items: center; padding: 0 var(--s-4); white-space: nowrap; }
.b-move .k { color: var(--ink-on); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; }
.b-move.up .k { background: var(--up); } .b-move.down .k { background: var(--down); }
.b-move .t { background: var(--ink); color: var(--ink-on); font: 800 var(--fs-row)/1 var(--cond); text-transform: uppercase; }
.b-move .v { background: var(--panel); font: 700 var(--fs-row)/1 var(--cond); }
.b-move .g { padding-right: var(--s-6); background: var(--panel); border-left: 1px solid var(--rule); font: 600 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-2); clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); }
.b-move .v:last-child { clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); padding-right: var(--s-6); }
.b-move [hidden] { display: none; }
.b-go, .b-fin { display: none; left: 50%; top: 32%; translate: -50% -50%; pointer-events: none; }
#hud.bc .b-go.on { display: block; animation: b-go 1.5s var(--ease) both; }
.b-go { font: 800 180px/0.9 var(--cond); text-transform: uppercase; color: var(--ink); text-shadow: 0 4px 40px rgba(0, 0, 0, 0.55); }
@keyframes b-go { 0% { scale: 1.7; opacity: 0; } 14% { scale: 1; opacity: 1; } 70% { opacity: 1; } 100% { scale: .92; opacity: 0; } }
#hud.bc .b-fin.on { display: flex; animation: bc-rise .6s var(--ease) both; }
.b-fin { flex-direction: column; align-items: center; gap: var(--s-3); }
.b-fin .k { padding: var(--s-2) var(--s-8) var(--s-2) var(--s-5); background: var(--gold); color: var(--ink-on); font: 700 var(--fs-lead)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase;
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%); }
.b-fin b { font: 800 var(--fs-display)/0.9 var(--cond); text-transform: uppercase; white-space: nowrap; text-shadow: 0 4px 40px rgba(0, 0, 0, 0.55); }
.b-row.gain { animation: b-gain 1.6s var(--ease); } .b-row.lose { animation: b-lose 1.6s var(--ease); }
@keyframes b-gain { 0% { background-color: rgba(46, 230, 160, 0.5); } 100% { background-color: transparent; } }
@keyframes b-lose { 0% { background-color: rgba(255, 138, 61, 0.45); } 100% { background-color: transparent; } }
.b-you .c-pos.gain { animation: b-pop .7s var(--ease); } .b-you .c-pos.lose { animation: b-pop-l .7s var(--ease); }
@keyframes b-pop { 0% { scale: 1.3; background-color: var(--up); } 100% { scale: 1; } }
@keyframes b-pop-l { 0% { scale: .85; background-color: var(--down); } 100% { scale: 1; } }
.b-wind.pulse { animation: b-pulse 1.4s ease-out; }
@keyframes b-pulse { 0% { box-shadow: inset 0 0 0 3px var(--pc, var(--up)); } 100% { box-shadow: inset 0 0 0 3px transparent; } }
#hud.bc .b-legs:not([hidden]) { animation: b-wipe .7s var(--ease) both; }
@keyframes b-wipe { from { clip-path: polygon(16px 0, 16px 0, 16px 100%, 0 100%); } to { clip-path: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%); } }
.b-legs .b-leg.now { background: linear-gradient(90deg, var(--you) 50%, var(--w-10) 50%) right / 200% 100% no-repeat; animation: b-fill .9s var(--ease) both; }
@keyframes b-fill { to { background-position: left; } }

/* the layline, as the call when nothing else is called */
.b-lay { display: none; align-items: center; gap: var(--s-3); min-height: 30px; padding: var(--s-2) var(--s-4); background: var(--ink); color: var(--ink-on);
  font: 700 var(--fs-small)/1.15 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; animation: bc-call 1.1s var(--ease) both; }
#hud.bc .b-lay.on { display: flex; }
.b-lay svg { width: 16px; height: 16px; flex: none; }
.b-lay.now { background: var(--you); }
/* the key that does what the call asks, on a computer (as the tack button shows it) */
.b-key { display: none; font: 600 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: none; color: var(--ink-on); border: 1px solid color-mix(in srgb, var(--ink-on) 30%, transparent); padding: var(--s-1) var(--s-2); }
@media (hover: hover) and (pointer: fine) { .b-lay .b-key:not(:empty) { display: inline-block; } }
/* the boats' tags and the advantage line, over the water (outside #hud, scaled as it is) */
#hud.bc { z-index: 1; }
#bOver { position: fixed; inset: 0; z-index: 0; pointer-events: none; zoom: var(--hz, 1); display: none; }
#bOver.on { display: block; }
#bOver svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
#bOver .adv { stroke: var(--gold); stroke-width: 2; opacity: .85; filter: drop-shadow(0 0 6px rgba(245, 196, 0, 0.5)); }
.b-advl { position: absolute; left: 0; top: 0; display: none; align-items: center; height: 22px; padding: 0 var(--s-3); translate: -50% -130%; background: var(--gold); color: var(--ink-on); white-space: nowrap;
  font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; }
.b-advl.on { display: flex; }
.b-btag { position: absolute; left: 0; top: 0; display: none; will-change: transform; }
.b-btag.on { display: block; }
.b-btag .in { position: absolute; left: 0; bottom: 0; translate: -50% -22px; display: flex; align-items: stretch; height: 28px; background: var(--panel); color: var(--ink); white-space: nowrap;
  -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); animation: bc-drop .5s var(--ease) both; }
.b-btag .p { width: 26px; display: flex; align-items: center; justify-content: center; background: var(--fill-2); font: 700 var(--fs-body)/1 var(--cond); }
.b-btag.first .p { background: var(--ink); color: var(--ink-on); }
.b-btag.me .p { background: var(--you); color: var(--ink-on); }
.b-btag.me .in { box-shadow: inset 0 -3px 0 var(--you); clip-path: polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
.b-btag .c { width: 4px; background: var(--c, var(--fill-3)); }
.b-btag .n { display: flex; align-items: center; gap: var(--s-2); padding: 0 var(--s-3); font: 700 var(--fs-body)/1 var(--cond); letter-spacing: var(--ls-name); }
.b-btag .b-me { color: var(--you); } .b-btag .b-me:empty { display: none; }
.b-btag .v { display: flex; align-items: center; padding: 0 var(--s-3); border-left: 1px solid var(--rule); font: 600 var(--fs-small)/1 var(--cond); color: var(--ink-2); }
.b-btag .stem { position: absolute; left: -1px; bottom: 0; width: 2px; height: 22px; background: linear-gradient(var(--w-90), var(--w-14)); transform-origin: top; animation: bc-pin .35s var(--ease) both .3s; }
/* the HUD's entrance: the tags on the water drop in last, after every block, their pins after them; the board's rows
   arrive one after another (b-intro, for a moment as a race comes on, or the board comes back) */
#nxTag.b-intro .in, #bOver.b-intro .b-btag .in { animation-delay: ${AT(8)}; }
#nxTag.b-intro .stem, #bOver.b-intro .b-btag .stem { animation-delay: calc(${AT(8)} + .3s); }
.b-board.b-intro .b-row { animation: bc-slide-l .4s var(--ease) both; animation-delay: calc(${AT(3)} + (var(--r, 0) + 2) * var(--t-stagger)); }
.b-row:nth-child(2) { --r: 1; } .b-row:nth-child(3) { --r: 2; } .b-row:nth-child(4) { --r: 3; } .b-row:nth-child(5) { --r: 4; } .b-row:nth-child(6) { --r: 5; }

/* the umpire's call: a red header, the boat penalised and the rule, a timer running down (under the race bug, over the
   calls) */
.b-ump { display: flex; flex-direction: column; width: 400px; margin-bottom: var(--s-1); animation: bc-slide-l .5s var(--ease) both; }
.b-ump .b-umph { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-4); background: var(--live); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; }
.b-ump .b-umph svg { width: 16px; height: 18px; flex: none; }
.b-ump .b-umpb { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-4); }
#hud.bc .b-ump .b-fl { width: 36px; height: 24px; }
.b-ump .b-umpt { display: flex; flex-direction: column; gap: var(--s-2); flex: 1; min-width: 0; }
.b-ump .n-m { display: flex; align-items: baseline; gap: var(--s-2); letter-spacing: var(--ls-name); }
.b-ump .b-me { color: var(--you); } .b-ump .b-me:empty { display: none; }
.b-ump .b-umpr { font: 500 var(--fs-body)/1.3 var(--sans); color: var(--ink-2); }
.b-timer { height: 3px; background: var(--w-10); }
.b-timer > i { display: block; height: 100%; background: var(--w-62); }
/* a computer skipper's level on her row of the board: four pips, lit to her level, and the word (on a phone the pips) */
.b-lv { flex: none; display: inline-flex; align-items: center; gap: 2px; height: 18px; margin-right: var(--s-2); padding: 0 var(--s-2); border: 1px solid var(--rule); color: var(--ink-3); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; }
.b-lv[hidden] { display: none; }
.b-lv > i { width: 3px; height: 8px; background: var(--w-14); }
.b-lv.l1 > i:nth-child(-n+1), .b-lv.l2 > i:nth-child(-n+2), .b-lv.l3 > i:nth-child(-n+3), .b-lv.l4 > i { background: var(--ink-2); }
.b-lv > span { margin-left: var(--s-1); }
.b-lv.l4 { color: var(--ink-2); }
.b-row:has(.b-pen:not([hidden])) .b-lv > span { display: none; } /* with PEN beside it, the pips alone, so her name keeps its room */
/* a boat with a penalty to do: PEN, on her row of the board and on her tag */
.b-pen { flex: none; display: inline-flex; align-items: center; align-self: center; height: 18px; padding: 0 var(--s-2); margin-right: var(--s-2); background: var(--live); color: var(--ink); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; }
.b-btag .b-pen { align-self: stretch; height: auto; margin: 0; padding: 0 var(--s-3); }
.b-btag .b-lv { margin: 0; }
/* the split at a mark, every boat's time there, in the board's place for a few seconds; the ones still to round in grey,
   when they're due at their pace */
.b-msplit { right: calc(28px + var(--sr)); top: calc(126px + var(--st)); width: 340px; flex-direction: column; animation: bc-slide-r .5s var(--ease) both; }
.b-msplit .b-bh { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--rule); }
.b-msplit .b-row .b-pos { width: 34px; }
.b-msplit .b-row.rd .b-pos { background: var(--ink); color: var(--ink-on); }
.b-msplit .b-row.me .b-pos { background: var(--you); color: var(--ink-on); }
.b-msplit .b-tm { width: 56px; text-align: right; font: 600 var(--fs-row)/1 var(--cond); color: var(--ink-2); }
.b-msplit .b-row .b-gp { min-width: 66px; }
.b-msplit .b-lv { padding: 0; border: 0; } .b-msplit .b-lv > span { display: none; } /* tight here beside the times: the pips alone */
.b-msplit .b-row.due .b-nm, .b-msplit .b-row.due .b-tm, .b-msplit .b-row.due .b-gp { color: var(--ink-3); }
.b-msplit .b-row.due .b-fl { opacity: .6; }
.b-msplit .b-bf { padding: var(--s-2) var(--s-4) var(--s-3); border-top: 1px solid var(--rule-2); }
#hud.bc .b-board.spl { display: none !important; }
#bOver .b-pen[hidden] { display: none; }
/* the call's two signs: a tack, or bear away (before the start) */
.b-lay .i-bear { display: none; }
.b-lay.burn .i-bear { display: block; } .b-lay.burn .i-tack { display: none; }
.b-lay.late { background: var(--live); color: var(--ink); }
.b-shift.b-vb { color: var(--ink); }

/* ---------- compact: a phone sideways, then upright ---------- */
@media not all and ${WIDE} {
  .b-ump { width: 280px; }
  .b-ump .b-umph { padding: var(--s-1) var(--s-3); font-size: var(--fs-label); }
  .b-ump .b-umpb { gap: var(--s-3); padding: var(--s-2) var(--s-3); }
  #hud.bc .b-ump .b-fl { width: 24px; height: 16px; }
  .b-ump .n-m { font-size: var(--fs-body); }
  .b-ump .b-umpr { font-size: var(--fs-small); }
  .b-msplit { right: calc(16px + var(--sr)); top: calc(54px + var(--st)); width: 200px; }
  .b-msplit .b-bh { padding: var(--s-2) var(--s-3); }
  .b-msplit .b-bf, .b-msplit .b-tm { display: none !important; }
  .b-msplit .b-row .b-pos { width: 22px; }
  .b-msplit .b-row .b-gp { min-width: 0; }
  .b-pen { height: 14px; padding: 0 var(--s-1); margin-right: var(--s-1); }
  .b-lv { height: 14px; gap: 1px; padding: 0; border: 0; margin: 0 var(--s-1); } .b-lv > span { display: none; } .b-lv > i { width: 2px; height: 7px; }
  #hud.bc .b-bug, #hud.bc .b-state, #hud.bc .b-board .b-bh, #hud.bc .b-board .b-bf, #hud.bc .b-map .b-mh, #hud.bc .b-gunc, #hud.bc .b-bias, #hud.bc .b-legs, #hud.bc .b-wind .b-wt > .lbl:first-child, #hud.bc .b-dir { display: none !important; }
  #hud.bc .b-tr, #hud.bc .b-low { display: contents !important; }
  .b-wind { position: absolute; left: calc(16px + var(--sl)); top: calc(12px + var(--st)); height: 36px; gap: var(--s-2); padding: 0 var(--s-3) 0 var(--s-2); margin: 0; pointer-events: none; animation: bc-slide-l var(--t-in) var(--ease) both ${AT(0)}; }
  .b-wind svg { width: 30px; height: 30px; }
  .b-wind .b-wt { flex-direction: row; align-items: baseline; gap: var(--s-2); }
  .b-wind .n-l { font-size: var(--fs-body); }
  .b-wind .b-shift { font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; }
  .b-btns { position: absolute; right: calc(16px + var(--sr)); top: calc(12px + var(--st)); pointer-events: none; animation: bc-slide-r var(--t-in) var(--ease) both ${AT(2)}; }
  #hud.bc .b-btns > button { min-width: 36px; height: 36px; }
  #hud.bc .b-btns > button svg { width: 16px; height: 16px; }
  #hud.bc .b-btns > #zoomIn, #hud.bc .b-btns > #zoomOut { font-size: var(--fs-row); }
  .b-board { right: calc(16px + var(--sr)); top: calc(54px + var(--st)); width: 168px; }
  .b-row { height: 26px; } .b-board.pre .b-row { height: 26px; }
  .b-row .b-pos { width: 22px; font-size: var(--fs-small); }
  .b-row .b-nm, .b-row .b-gp, .b-row .b-x { font-size: var(--fs-small); }
  .b-row .b-nm { padding-left: var(--s-2); } .b-row .b-gp { min-width: 0; padding-right: var(--s-2); } .b-row .b-x { min-width: 0; padding-right: var(--s-2); }
  .b-row .b-mv { display: none; }
  .b-row.cxh { display: none; }
  .b-map { left: calc(16px + var(--sl)); top: calc(56px + var(--st)); bottom: auto; }
  #hud.bc #mini { width: 96px; height: 96px; margin: var(--s-1); }
  #hud.bc #mini.big { width: min(240px, calc(100vh / var(--hz, 1) - 120px)); height: min(240px, calc(100vh / var(--hz, 1) - 120px)); }
  @media (pointer: coarse) { .b-map { top: calc(56px + var(--st)); } }
  .b-calls { left: calc(16px + var(--sl)); top: calc(164px + var(--st)); }
  #hud.bc #chips .chip, #hud.bc #trim { height: 24px; font-size: var(--fs-label); }
  .b-top { top: calc(56px + var(--st)); }
  .b-flagbox { padding: var(--s-2) var(--s-3); gap: var(--s-2); }
  #hud.bc #flags .flag { width: 30px; height: 20px; } #hud.bc #flags .flag.P::after { inset: 6px 10px; } #hud.bc #flags .flag.cls { font-size: var(--fs-small); line-height: 20px; }
  #hud.bc #flags figcaption { display: none; }
  .b-you { position: absolute; left: 50%; top: calc(12px + var(--st)); translate: -50% 0; height: 36px; pointer-events: none; animation: bc-drop var(--t-in) var(--ease) both ${AT(1)}; clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%); }
  .b-you > div { flex-direction: row; align-items: center; gap: var(--s-2); padding: 0 var(--s-3); }
  .b-you { padding-right: var(--s-4); }
  .b-you > div > .lbl, .b-you .c-nm, .b-you .c-vm, .b-you .c-ldr, .b-you .c-burn, .b-you .b-sub { display: none !important; }
  .b-you .c-pos { width: 34px; font-size: var(--fs-title); }
  .b-you .c-leg { display: flex; font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-2); white-space: nowrap; }
  .b-you .c-leg svg { width: 9px; height: 9px; }
  .b-you .n-l, .b-you .pv { font-size: var(--fs-body); }
  .b-you .unit { font-size: var(--fs-label); }
  .b-you .b-g { width: 34px; }
  .b-you .b-g::after { display: none; }
  .b-callrow { position: absolute; left: 50%; bottom: calc(18px + var(--sb)); translate: -50% 0; margin: 0; pointer-events: none; }
  #hud.bc #toast { max-width: min(380px, calc(100vw / var(--hz, 1) - 480px)); font-size: var(--fs-label); padding: var(--s-2) var(--s-3); }
  #hud.bc #toast.long { font-size: var(--fs-small); }
  .b-acts { right: calc(76px + var(--sr)); bottom: calc(18px + var(--sb)); }
  #hud.bc.split-trim .b-acts { right: calc(136px + var(--sr)); }
  #hud.bc .b-acts > .round { height: 40px !important; font-size: var(--fs-small) !important; padding: 0 var(--s-3) 0 var(--s-5); }
  #hud.bc .b-acts > #tackBtn { height: 56px !important; padding: 0 var(--s-5) 0 var(--s-8); font-size: var(--fs-body) !important; }
  #hud.bc #sheetZone { right: calc(16px + var(--sr)); bottom: calc(18px + var(--sb)); width: 48px; height: min(200px, calc(100vh / var(--hz, 1) - 170px)); padding: 28px 0; }
  #hud.bc #sheetZone.split { width: 108px; }
  #hud.bc #sheet .knob, #hud.bc #jibSheet .knob { left: -12px; width: 30px; height: 14px; }
  #hud.bc #jibSheet { margin-right: 48px; }
  #hud.bc #sheet .cap.t, #hud.bc #jibSheet .cap.t { top: -20px; } #hud.bc #sheet .cap.b, #hud.bc #jibSheet .cap.b { bottom: -20px; }
  .b-adv { right: -21px; top: -60px; }
  #hud.bc #rudder { left: calc(16px + var(--sl)); bottom: calc(12px + var(--sb)); width: 190px; height: 107px; }
  #hud.bc #count.final { top: 26%; font-size: 120px; }
  #nxTag .in { height: 24px; } #nxTag .buoy, #nxTag .ptr { width: 22px; }
  #nxTag .t-nm, #nxTag .t-v { font-size: var(--fs-small); padding: 0 var(--s-2); }
  .b-btag .in { height: 24px; } .b-btag .p { width: 22px; font-size: var(--fs-small); } .b-btag .n, .b-btag .v { font-size: var(--fs-label); padding: 0 var(--s-2); }
  .b-lay { font-size: var(--fs-label); padding: var(--s-2) var(--s-3); }
  .b-split { position: absolute; left: 50%; top: calc(56px + var(--st)); translate: -50% 0; height: 28px; margin: 0; }
  .b-split > * { padding: 0 var(--s-3); font-size: var(--fs-small) !important; } .b-split .k { font-size: var(--fs-label) !important; }
  .b-move { position: absolute; left: 50%; top: calc(56px + var(--st)); translate: -50% 0; height: 28px; margin: 0; max-width: calc(100vw / var(--hz, 1) - 32px); }
  .b-move > * { padding: 0 var(--s-3); font-size: var(--fs-small) !important; } .b-move .k, .b-move .g { font-size: var(--fs-label) !important; }
  .b-go { font-size: 110px; } .b-fin b { font-size: var(--fs-h2); }
}
/* a phone sideways: pause beside the board, and the call right over the tack button (moved into its column: see
   placeCall) */
@media not all and ${WIDE} { @media (orientation: landscape) {
  #hud.bc .b-btns > #pauseBtn { position: absolute; right: calc(168px + var(--s-1)); top: 42px; }
  .b-acts > .b-callrow { position: static; translate: none; margin: 0; }
} }
@media not all and ${WIDE} { @media (orientation: portrait) {
  .b-wind { top: calc(56px + var(--st)); }
  .b-board, .b-msplit { top: calc(56px + var(--st)); }
  .b-btns { top: auto; right: calc(16px + var(--sr)); bottom: calc(250px + var(--sb)); flex-direction: column; }
  .b-map { top: calc(100px + var(--st)); }
  .b-calls { top: calc(208px + var(--st)); }
  .b-top { top: calc(144px + var(--st)); }
  .b-callrow { bottom: calc(150px + var(--sb)); }
  #hud.bc #toast { max-width: calc(100vw / var(--hz, 1) - 32px); }
  .b-you .c-pct .b-g { display: none; }
} }
`;

// On a beat, where the layline is along the course you're steering: the mark (mx, mz), you (x, z, heading h, speed v
// in m/s), the wind from W and the angle she sails to it (radians). The layline is where the mark opens up on the other
// tack, as wide of the wind as she can point. { kind: 'in', s } seconds to it (within three minutes), 'now' on it,
// 'over' past it, 'fetch' already laying the mark on this tack; null when not sailing upwind or it's further.
export function laylineAt({ mx, mz, x, z, h, v, W, beat }) {
  const side = Math.sign(wrap(h - W)) || 1;
  if (Math.abs(wrap(h - W)) > beat + 25 * D2R) return null; // not sailing upwind just now
  const rel = (px, pz) => wrap(Math.atan2(mx - px, -(mz - pz)) - W); // the mark's bearing, against the wind
  const past = (px, pz) => -side * rel(px, pz) >= beat; // on the other side of the wind, as wide as the tack goes
  if (Math.abs(wrap(rel(x, z) + W - h)) < 4 * D2R) return { kind: 'fetch' };
  if (past(x, z)) return { kind: -side * rel(x, z) > beat + 6 * D2R ? 'over' : 'now' };
  const vx = Math.sin(h) * v, vz = -Math.cos(h) * v;
  for (let s = 1; s <= 180; s++) if (past(x + vx * s, z + vz * s)) return { kind: 'in', s };
  return null;
}

// The call before the start, from the time to burn (seconds in hand, − late) and the seconds to the gun: in the last
// minute, early by more than five seconds 'hold' (for s seconds, then bear away), within three either way 'now', more
// than three late 'late'; null otherwise. Between the bands it keeps the call it had (prev), so it doesn't flicker.
export function burnCall(burn, left, prev = null) {
  if (burn == null || !Number.isFinite(burn) || !(left > 0 && left < 60)) return null;
  const was = prev && prev.kind;
  const kind = burn > 5 ? 'hold' : burn > 3 ? (was === 'now' ? 'now' : 'hold') : burn >= -3 ? 'now' : burn >= -4 && was === 'now' ? 'now' : 'late';
  return kind === 'hold' ? { kind, s: burn } : { kind };
}

// The bearing the line is square to: the wind from there and neither end is favoured (degrees, 0 … 359, from the north
// clockwise). The line's normal points up the course, into the wind it was laid for.
export const squareBearing = (c) => ((Math.round(Math.atan2(c.normal.x, -c.normal.z) / D2R) % 360) + 360) % 360;

// How far the wind has swung since a first reading, in whole degrees: + veered (clockwise), − backed.
export const veerBack = (now, first) => Math.round(wrap(now - first) / D2R);

// The best speed a boat can make good along a leg (m/s): the polar's best over the angles she could sail, at the wind's
// mean speed (tws, knots), the leg running twaDeg off the wind (0: straight upwind, 180: dead downwind). A beat's comes
// out as the beat's VMG, a run's as the run's, a reach's as her speed on it. It turns the board's gaps, metres of course
// still to sail, into seconds: steady, as it doesn't move with a gust, a tack or a penalty turn.
export function legPace(tws, twaDeg) {
  let best = 0;
  for (let a = NO_GO + 2; a <= 180; a += 2) best = Math.max(best, polarSpeed(tws, a) * KN * Math.cos((a - twaDeg) * D2R));
  return best;
}

// A mark's split: the boats round it in the order they rounded (t, the race's clock there), then those still to round
// (due: true) nearest the mark first (d, metres to it; null, as for a boat out of the race, last). The gap is to the
// first one round. No time is guessed for those still to round: near a mark a boat can miss it, or take a penalty and
// go round again, and a guess at her pace would be a minute out. Her distance is what's known, as on the board.
export function markSplit(list) {
  const round = list.filter((r) => !r.due).sort((a, b) => a.t - b.t);
  const due = list.filter((r) => r.due).sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));
  const first = round.length ? round[0].t : null;
  return [...round, ...due].map((r) => ({ ...r, gap: r.due || first == null ? null : r.t - first }));
}

const LEG = { start: 'lineStart', mark: 'mark', wing: 'wing', mark2: 'mark2', offset: 'offset', gate: 'gate', finish: 'finish' };
// a leg's name, by its mark: on a trapezoid the windward mark is mark 1
const legKey = (c, k) => (k === 'mark' && c.type === 'trap' ? 'mark1' : LEG[k]);
// a leg's kind, for its arrow: up (a beat), across (a reach out to the wing, mark 2 or the offset), down
const legKind = (c, i) => (isBeat(c, i) ? 'up' : ['wing', 'mark2', 'offset'].includes(c.legs[i]) ? 'reach' : 'down');
const CAMS = ['drone', 'top', 'helm'];
const hex = (n) => (typeof n === 'number' ? '#' + n.toString(16).padStart(6, '0') : '');

export function createHud({ t, LANG, fmt, world, getRace, setCam, flagOf: lookFlag = () => null, sailOf = () => '' }) {
  const L = HUD_STRINGS[LANG] || HUD_STRINGS.en;
  const $ = (s) => document.querySelector(s);
  const hud = $('#hud');
  const rudder = $('#rudder'), sheet = $('#sheet'), mini = $('#mini'), count = $('#count'), toastEl = $('#toast');
  const nf = (x, d = 1) => (LANG === 'ru' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
  const M = LANG === 'ru' ? 'м' : 'm', KNU = t('kn').toUpperCase();
  const venue = (VENUE.name && VENUE.name[LANG === 'ru' ? 1 : 0]) || '';
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const html = (s) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstChild; };
  const q = (root, s) => root.querySelector(s);

  // the blocks
  const bug = html(`<div class="bx b-bug"><i class="b-acc"></i><div class="pn b-bug-t"><span class="b-title">${L.title}</span><span class="lbl b-sub"></span></div>
    <div class="pn2 cut-r b-live"><span class="dot-live"></span><span class="b-clock"></span></div></div>`);
  const calls = html(`<div class="bx b-calls"></div>`);
  const top = html(`<div class="bx b-top"><div class="b-gun">
      <div class="pn2 cut-l b-flagbox"></div>
      <div class="pn b-gunc"><span class="lbl">${L.startIn}</span><span class="b-gunn" role="timer" aria-live="off"></span><div class="b-seq"><i></i></div><div class="b-seql"></div></div>
      <div class="pn2 cut-r b-bias"><span class="lbl">${L.bias}</span><span class="n-m b-bv"></span><span class="lbl b-bl"></span></div>
    </div>
    <div class="pn cut-lr b-legs"><span class="lbl-ink b-legn"></span><div class="b-legr"></div><span class="lbl-ink">${L.finish}</span>
      <span class="b-lw" hidden><svg viewBox="0 0 64 64" role="img"><path d="M32 56 L44 16 L32 24 L20 16 Z" fill="currentColor"/></svg><span class="n-s"></span></span></div></div>`);
  const tr = html(`<div class="bx b-tr"><div class="b-btns"><button class="b-cam" aria-label="${L.camera} (X/C/V)" title="${L.camera} · X C V">${CAM_SVG}<span></span></button></div>
    <div class="pn cut-l b-wind"><svg viewBox="0 0 64 64" role="img"><circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
      <path class="nogo" fill="rgba(255,59,48,0.3)"/><g stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M32 3v6M32 55v6M3 32h6M55 32h6"/></g>
      <path d="M32 22 C 34.6 25.5 35.2 31 34.7 38 L 29.3 38 C 28.8 31 29.4 25.5 32 22 Z" fill="rgba(255,255,255,0.9)"/>
      <g class="tw"><path d="M32 4 L38 15 L32 12 L26 15 Z" fill="#3db8ff" transform="rotate(180 32 9.5)"/></g></svg>
      <div class="b-wt"><span class="lbl">${L.trueWind}</span><span class="n-l b-tws"></span><span class="lbl b-wl"><span class="b-dir"></span><span class="b-shift"></span></span></div></div></div>`);
  const board = html(`<div class="bx pn b-board"><div class="b-bh"><span class="lbl-ink b-bt"></span><span class="lbl b-br"></span></div><div class="b-rows"></div><div class="b-bf"><span class="lbl b-bfn"></span><kbd class="b-lk">L</kbd></div></div>`);
  const map = html(`<div class="bx pn b-map"><div class="b-mh"><span class="lbl-ink">${L.course}</span><span class="lbl b-shape"></span></div></div>`);
  const TACK_SVG = '<svg class="i-tack" viewBox="0 0 20 20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9c2.5-4.5 9.5-4.5 12 0"/><path d="M12.5 9H16.5V5"/><path d="M10 11.5V17"/></g></svg>';
  const BEAR_SVG = '<svg class="i-bear" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v9M3 7l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const low = html(`<div class="bx b-low"><div class="b-move" role="status"><span class="k"></span><b class="t"></b><span class="v"></span><span class="g"></span></div><div class="b-split" role="status"><span class="k"></span><b class="t"></b><span class="v"></span><span class="g"></span></div><div class="b-callrow"><div class="b-lay" role="status">${TACK_SVG}${BEAR_SVG}<span></span><kbd class="b-key"></kbd></div></div><div class="b-state"></div>
    <div class="pn b-you pre">
      <div class="c-pos s-run s-done"></div>
      <div class="c-nm s-pre s-run s-done"><img class="b-fl" alt="" hidden><i></i><span class="c-nmt"><span class="n-m"></span><span class="lbl">${L.you}</span></span></div>
      <div class="c-leg s-pre s-run s-done"><svg viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor"/></svg><span></span></div>
      <div class="c-spd s-pre s-run"><span class="lbl">${L.speed}</span><span class="n-l"><span class="v"></span><span class="unit">${KNU}</span></span></div>
      <div class="c-pct s-run"><span class="lbl">${L.vmg} · ${L.ofTarget.toLowerCase()}</span><span class="b-v"><span class="n-l c-vm"><span class="v"></span><span class="unit">${KNU}</span></span><span class="n-s pv"></span></span><span class="b-g" aria-hidden="true"><i></i></span></div>
      <div class="c-to s-pre s-run"><span class="lbl"></span><span class="b-v"><span class="n-l"><span class="v"></span><span class="unit">${M.toUpperCase()}</span></span><span class="b-sub"></span></span></div>
      <div class="c-burn s-pre"><span class="lbl">${L.burn}</span><span class="n-l v"></span></div>
      <div class="c-ldr s-run"><span class="lbl"></span><span class="b-v"><span class="n-l v"></span><span class="b-sub r"></span></span></div>
      <div class="c-time s-done"><span class="lbl">${L.time}</span><span class="n-l v"></span></div>
    </div></div>`);
  const acts = html(`<div class="bx b-acts"></div>`);
  const goEl = html(`<div class="b-go" aria-hidden="true"></div>`), fin = html(`<div class="b-fin" role="status"><span class="k"></span><b></b></div>`);
  // the umpire's card, over the calls; the split at a mark, in the board's place
  const ump = html(`<div class="b-ump" role="status" hidden><div class="b-umph"><svg viewBox="0 0 16 18" aria-hidden="true"><path d="M2 1v16" stroke="currentColor" stroke-width="2"/><path d="M3 2h11v8H3z" fill="currentColor"/></svg><span>${L.umpire}</span></div>
    <div class="pn b-umpb"><img class="b-fl" alt="" hidden><div class="b-umpt"><span class="n-m"><span class="nm"></span><span class="lbl b-me"></span></span><span class="b-umpr"></span><span class="lbl b-umpv"></span></div></div>
    <div class="b-timer" aria-hidden="true"><i></i></div></div>`);
  calls.append(ump);
  const U = { fl: q(ump, '.b-fl'), nm: q(ump, '.nm'), me: q(ump, '.b-me'), r: q(ump, '.b-umpr'), v: q(ump, '.b-umpv'), bar: q(ump, '.b-timer i') };
  const msplit = html(`<div class="bx pn b-msplit" role="status" hidden><div class="b-bh"><span class="lbl-ink"></span><span class="lbl">${L.timeGap}</span></div><div class="b-rows"></div>
    <div class="b-bf"><span class="lbl">${L.due}</span></div><div class="b-timer" aria-hidden="true"><i></i></div></div>`);
  const MS = { k: q(msplit, '.lbl-ink'), bar: q(msplit, '.b-timer i'), rows: [] };
  for (let n = 0; n < 6; n++) {
    const r = html(`<div class="b-row"><b class="b-pos"></b><img class="b-fl" alt="" hidden><span class="b-nm"></span><span class="b-lv" hidden><i></i><i></i><i></i><i></i><span></span></span><b class="b-pen" hidden>${L.pen}</b><span class="b-tm"></span><span class="b-gp"></span></div>`);
    q(msplit, '.b-rows').append(r);
    MS.rows.push({ el: r, pos: q(r, '.b-pos'), fl: q(r, '.b-fl'), nm: q(r, '.b-nm'), lv: q(r, '.b-lv'), pen: q(r, '.b-pen'), tm: q(r, '.b-tm'), gp: q(r, '.b-gp') });
  }
  hud.append(bug, calls, top, tr, board, msplit, map, low, acts, goEl, fin);
  const windBox = q(tr, '.b-wind');
  const B = {
    sub: q(bug, '.b-sub'), clock: q(bug, '.b-clock'), gun: q(top, '.b-gun'), gunN: q(top, '.b-gunn'), seq: q(top, '.b-seq'), seqI: q(top, '.b-seq i'), seqL: q(top, '.b-seql'),
    bv: q(top, '.b-bv'), bl: q(top, '.b-bl'), legs: q(top, '.b-legs'), legN: q(top, '.b-legn'), legR: q(top, '.b-legr'), lw: q(top, '.b-lw'), lwSvg: q(top, '.b-lw svg'), lwN: q(top, '.b-lw .n-s'), btns: q(tr, '.b-btns'), cam: q(tr, '.b-cam'),
    nogo: q(tr, '.nogo'), tw: q(tr, '.tw'), tws: q(tr, '.b-tws'), dir: q(tr, '.b-dir'), shift: q(tr, '.b-shift'), windSvg: q(tr, 'svg'),
    bt: q(board, '.b-bt'), br: q(board, '.b-br'), rows: q(board, '.b-rows'), bfn: q(board, '.b-bfn'), shape: q(map, '.b-shape'), state: q(low, '.b-state'), you: q(low, '.b-you'),
  };
  const cell = (k) => q(low, `.c-${k}`);
  const Y = {
    pos: cell('pos'), legP: q(cell('leg'), 'path'), legT: q(cell('leg'), 'span'), spd: q(cell('spd'), '.v'), pct: q(cell('pct'), '.pv'), pctG: q(cell('pct'), '.b-g'),
    pctI: q(cell('pct'), '.b-g i'), vmg: q(cell('pct'), '.c-vm .v'), toL: q(cell('to'), '.lbl'), to: q(cell('to'), '.v'), eta: q(cell('to'), '.b-sub'), burn: q(cell('burn'), '.v'),
    ldrL: q(cell('ldr'), '.lbl'), ldr: q(cell('ldr'), '.v'), rate: q(cell('ldr'), '.b-sub'), time: q(cell('time'), '.v'),
    nm: q(cell('nm'), '.n-m'), fl: q(cell('nm'), '.b-fl'),
  };
  // six rows on the board (three on a phone), made once and refilled
  const rows = Array.from({ length: 6 }, () => {
    const r = html(`<div class="b-row"><b class="b-pos"></b><i class="b-bar"></i><img class="b-fl" alt="" hidden><span class="b-nm"></span><span class="b-lv" hidden><i></i><i></i><i></i><i></i><span></span></span><b class="b-pen" hidden>${L.pen}</b><span class="b-mv"></span><span class="b-gp"></span><span class="b-x"></span></div>`);
    B.rows.append(r);
    return { el: r, pos: q(r, '.b-pos'), bar: q(r, '.b-bar'), fl: q(r, '.b-fl'), nm: q(r, '.b-nm'), lv: q(r, '.b-lv'), pen: q(r, '.b-pen'), mv: q(r, '.b-mv'), gp: q(r, '.b-gp'), x: q(r, '.b-x') };
  });
  // the camera button cycles the three views, and says which for a moment
  let sayT = 0;
  B.cam.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setCam(CAMS[(CAMS.indexOf(world.mode) + 1) % CAMS.length]);
    B.cam.classList.add('say'); clearTimeout(sayT); sayT = setTimeout(() => B.cam.classList.remove('say'), 1400);
  });
  // L hides the board and brings it back (a computer's keys; see main.js for the others)
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyL' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || hud.hidden || e.target.closest?.('input, textarea, select')) return;
    if (!board.classList.toggle('off')) intro([board]);
  });
  // the rudder's centre mark
  const mid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  Object.entries({ class: 'b-mid', x1: 105, y1: 10, x2: 105, y2: 30 }).forEach(([k, v]) => mid.setAttribute(k, v));
  rudder.insertBefore(mid, $('#rudderKnob'));
  // which way to pull, over each sheet (the jib's is made by main.js before this runs)
  const jibSheet = $('#jibSheet');
  const adv = (el) => { const a = html(`<span class="b-adv"><i></i><span></span></span>`); el.append(a); return a; };
  const advMain = adv(sheet), advJib = jibSheet ? adv(jibSheet) : null;
  // the tag on the water
  const tag = html(`<div id="nxTag" class="bc"><span class="stem"></span><div class="in"><b class="ptr"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h9.5M7.5 3l4 4-4 4"/></svg></b><span class="buoy"><i></i></span><span class="t-nm"></span><span class="t-v"></span></div></div>`);
  document.body.append(tag);
  const tagN = q(tag, '.t-nm'), tagV = q(tag, '.t-v'), tagIn = q(tag, '.in'), tagPtr = q(tag, '.ptr');
  const v3 = world.camera.position.clone();
  // over the water: the advantage line and its label, and three boats' tags (you, and the two that matter most)
  const over = html(`<div id="bOver" class="bc"><svg><polyline class="adv" fill="none"/></svg><span class="b-advl"></span></div>`);
  document.body.append(over);
  const advLine = q(over, '.adv'), advLab = q(over, '.b-advl');
  const btags = Array.from({ length: 3 }, () => {
    const el = html(`<div class="b-btag"><span class="stem"></span><div class="in"><b class="p"></b><i class="c"></i><span class="n"><img class="b-fl" alt="" hidden><span class="nt"></span><span class="lbl b-me"></span><span class="b-lv" hidden><i></i><i></i><i></i><i></i><span></span></span></span><span class="v"></span><b class="b-pen" hidden>${L.pen}</b></div></div>`);
    over.append(el);
    return { el, box: q(el, '.in'), p: q(el, '.p'), c: q(el, '.c'), n: q(el, '.n .nt'), me: q(el, '.b-me'), fl: q(el, '.b-fl'), lv: q(el, '.b-lv'), v: q(el, '.v'), pen: q(el, '.b-pen'), w: 0, f: 0 };
  });
  const lay = q(low, '.b-lay'), layT = q(lay, 'span'), layK = q(lay, '.b-key');
  const split = q(low, '.b-split'), SP = { k: q(split, '.k'), t: q(split, '.t'), v: q(split, '.v'), g: q(split, '.g') };
  const move = q(low, '.b-move'), MV = { k: q(move, '.k'), t: q(move, '.t'), v: q(move, '.v'), g: q(move, '.g') };

  // the game's own elements, and where each goes in this HUD
  const btnIds = ['hailBtn', 'jibBtn', 'reefBtn', 'kiteBtn', 'tackBtn']; // top to bottom
  const MOVES = [
    ['#chips', calls], ['#trim', calls], ['#toast', q(low, '.b-callrow')], ['#flags', q(top, '.b-flagbox')], ['#mini', map],
    ['#zoomIn', B.btns], ['#zoomOut', B.btns], ['#speedBtn', B.btns], ['#pauseBtn', B.btns], ...btnIds.map((id) => [`#${id}`, acts]),
  ].map(([s, to]) => { const el = $(s); return el && { el, to }; }).filter(Boolean);
  // the steering arc held (a computer shows it only then)
  const rz = $('#rudderZone');
  rz.addEventListener('pointerdown', () => rz.classList.add('held'));
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => rz.classList.remove('held'));
  const fresh = {};
  for (const id of btnIds) { const b = document.getElementById(id); b && b.addEventListener('pointerdown', () => b.classList.remove('fresh')); }

  const on = true;
  try { localStorage.removeItem('hudNext'); localStorage.removeItem('hudOld'); } catch (e) {} // the trials' switches, gone

  // the whole HUD scaled to the screen: the designs are drawn at 1600×1000 (wide) and 844×390 (a phone sideways)
  const wideQ = matchMedia(WIDE);
  function scale() {
    const w = innerWidth, h = innerHeight, port = h > w;
    const hz = wideQ.matches ? clamp(Math.min(w / 1600, h / 1000), 0.66, 1.3) : port ? clamp(Math.min(w / 390, h / 844), 0.82, 1.15) : clamp(Math.min(w / 844, h / 390), 0.82, 1.2);
    for (const el of [hud, tag, over]) el.style.setProperty('--hz', hz.toFixed(3));
  }
  addEventListener('resize', scale); scale();
  // a phone sideways has the call over the tack button: the call's row goes to the top of the buttons' column, and
  // back over your strip on any other screen
  const callRow = q(low, '.b-callrow'), landQ = matchMedia('(orientation: landscape)');
  function placeCall() {
    if (!wideQ.matches && landQ.matches) { if (callRow.parentNode !== acts) acts.prepend(callRow); }
    else if (callRow.parentNode !== low) split.after(callRow);
  }
  addEventListener('resize', placeCall); placeCall();

  hud.classList.add('bc');
  for (const m of MOVES) m.to.append(m.el);
  const tackB = $('#tackBtn'); if (tackB) tackB.dataset.key = L.space;
  scale();

  const txt = (e, s) => { if (e._t !== s) { e._t = s; e.textContent = s; } };
  // (a flash running on it stays: see flash below)
  const cls = (e, c) => { if (e._c !== c) { e._c = c; e.className = c + ['gain', 'lose', 'pulse', 'beat'].filter((k) => e.classList.contains(k)).map((k) => ' ' + k).join(''); } };
  const htm = (e, s) => { if (e._h !== s) { e._h = s; e.innerHTML = s; } };
  const pt = (a, r) => `${(32 + r * Math.sin(a)).toFixed(2)} ${(32 - r * Math.cos(a)).toFixed(2)}`;
  const metres = (d) => `${Math.round(d)} ${M}`;
  // a gap of m metres of course as seconds, at the pace the boat behind can make on her leg (legPace), kept by leg
  const paces = new Map();
  function gapTime(race, b, m) {
    const c = race.course, i = clamp(b.leg, 1, c.legs.length - 1), tws = (race.wind.p && race.wind.p.tws) || 12;
    const key = `${i}|${tws}`;
    if (!paces.has(key) || paces.get(key).c !== c) {
      const a = legAim(c, i - 1), z = legAim(c, i), up = Math.atan2(c.normal.x, -c.normal.z);
      const twa = Math.abs(wrap(Math.atan2(z.x - a.x, -(z.z - a.z)) - up)) / D2R;
      paces.set(key, { c, v: legPace(tws, twa) });
    }
    const v = paces.get(key).v;
    return v > 0.3 ? Math.max(0, m) / v : null;
  }
  const secs = (s) => (s == null ? '—' : `+${fmt(s)}`);

  // how far a boat has still to sail: to her next mark, then each leg after it, mark to mark
  let lens = null, lensFor = null;
  function remaining(race, b) {
    const c = race.course;
    if (lensFor !== c) {
      lensFor = c;
      lens = c.legs.map((_, i) => { if (!i) return 0; const a = legAim(c, i - 1), z = legAim(c, i); return Math.hypot(z.x - a.x, z.z - a.z); });
    }
    let d = race.distToNext(b);
    for (let i = b.leg + 1; i < c.legs.length; i++) d += lens[i];
    return d;
  }
  // the gap to the leader against time, for its trend: seconds a minute, gained (+) or lost
  const hist = [];
  function trend(clock, gap) {
    hist.push([clock, gap]);
    while (hist.length > 2 && clock - hist[0][0] > 12) hist.shift();
    const [c0, g0] = hist[0];
    return clock - c0 > 4 ? ((g0 - gap) / (clock - c0)) * 60 : 0;
  }
  const lastPlace = new Map(), moved = new Map();
  let twaS = null, lastCount = '', legsKey = '', seqKey = '', raceRef = null, wasLead = null, wasPre = true, wasDone = false, wasShift = '', pulseAt = -1e9;
  // each boat's leg as last seen, and when each boat reached each mark (the race's clock), for the splits
  const legOf = new Map(), atMark = [];
  // the umpire's card and the split at a mark, while they show (seconds left); the wind's first reading, the start's
  // call as last made
  let umpT = 0, spl = null, wind0 = null, burnK = null;
  // a place won or lost: the order as last called (your index, the boats ahead of you) and a new place while it holds
  let mvBase = null, mvHold = null;
  const UMP_S = 7, SPLIT_S = 8;
  // play a one-off animation again: the class off, a reflow, on, and off when it's done
  // a boat's flag (its picture's address, from main.js: the fleet's from their looks, yours from the boat page), yours
  // read once a race
  let myFlag, mySail;
  const flagOf = (b, me) => (me ? (myFlag === undefined ? (myFlag = lookFlag(b, true)) : myFlag) : lookFlag(b, false));
  // your sail number (from the boat page), read once a race too; "You" when there's none
  const sailNo = () => (mySail === undefined ? (mySail = sailOf() || t('you')) : mySail);
  // a computer skipper's level (sim.js LEVELS): four pips, as many lit as she is good, and the word
  const showLevel = (el, lv) => {
    if (el._lv === lv) return; el._lv = lv; el.hidden = !lv; if (!lv) return;
    const n = LEVELS.findIndex(([k]) => k === lv) + 1;
    el.className = `b-lv l${n}`; el.title = L.level[lv]; txt(el.lastChild, L.level[lv]);
  };
  const showPen = (el, b) => { const on = !!b.pen && !b.done; if (el.hidden === on) el.hidden = !on; }; // PEN while she has a penalty to do
  const setFlag = (img, src) => { if (img._s === src) return; img._s = src; img.hidden = !src; if (src) img.src = src; else img.removeAttribute('src'); };
  // the entrance's last part, as a race comes on: the tags, and the board's rows one by one
  let introT = 0;
  const intro = (els = [tag, over, board]) => { clearTimeout(introT); for (const e of els) e.classList.add('b-intro'); introT = setTimeout(() => { for (const e of [tag, over, board]) e.classList.remove('b-intro'); }, 1800); };
  const flash = (el, c, ms) => { el.classList.remove(c, ...({ gain: ['lose'], lose: ['gain'] }[c] || [])); void el.offsetWidth; el.classList.add(c); clearTimeout(el['_f' + c]); el['_f' + c] = setTimeout(() => el.classList.remove(c), ms); };

  // a place won or lost, called as a broadcast calls it: once the new order has held a moment (boats side by side swap
  // back and forth), the places, who went by, and why when it's plain: a penalty turn, a mark, a wind shift
  const MV_HOLD = 2.5;
  function moveCall(race, st, P) {
    const i = st.indexOf(P);
    if (!mvBase) { mvBase = { i, ahead: new Set(st.slice(0, i)) }; return; }
    if (i === mvBase.i) { mvHold = null; return; }
    if (!mvHold || mvHold.i !== i) { mvHold = { i, at: race.clock }; return; }
    if (race.clock - mvHold.at < MV_HOLD || split.classList.contains('on') || spl) return; // a mark's split has the place first
    const ahead = new Set(st.slice(0, i)), up = i < mvBase.i, n = Math.abs(i - mvBase.i);
    const who = up ? [...mvBase.ahead].filter((b) => !ahead.has(b)) : [...ahead].filter((b) => !mvBase.ahead.has(b));
    mvBase = { i, ahead }; mvHold = null;
    const atMarkLately = (b) => atMark.some((m) => m && m.has(b) && race.clock - m.get(b) < 20);
    const why = up && who.some((b) => b.pen) ? L.mvTheirPen : !up && P.pen ? L.mvYourPen
      : atMarkLately(P) || who.some(atMarkLately) ? L.mvMark
      : isBeat(race.course, P.leg) && race.clock - pulseAt < 20 ? L.mvShift : ''; // upwind, a shift just come through: shifts come often, so only then
    txt(MV.k, `${up ? '▲' : '▼'} ${up ? L.mvUp(n) : L.mvDown(n)}`);
    txt(MV.t, L.ord(i + 1));
    const name = who.length === 1 ? who[0].name : '';
    txt(MV.v, name ? (up ? L.mvPast(name) : L.mvBy(name)) : ''); MV.v.hidden = !name;
    txt(MV.g, why); MV.g.hidden = !why;
    move.classList.toggle('up', up); move.classList.toggle('down', !up);
    flash(move, 'on', 4800);
  }

  function update(P, dt) {
    if (!on) return;
    const race = getRace(), c = race.course, kn = P.v / KN, twa = P.twa, pre = race.clock < 0, done = !!P.done;
    if (race !== raceRef) { raceRef = race; hist.length = 0; lastPlace.clear(); pulseAt = -1e9; myFlag = undefined; mySail = undefined; moved.clear(); twaS = null; legOf.clear(); atMark.length = 0; wasPre = true; wasDone = false; split.classList.remove('on'); fin.classList.remove('on'); umpT = 0; ump.hidden = true; spl = null; mvBase = mvHold = null; move.classList.remove('on'); msplit.hidden = true; board.classList.remove('spl'); wind0 = race.wind.dir(); burnK = null; intro(); }
    const leg = c.legs[P.leg], nLegs = c.legs.length - 1;
    // the order: before the gun, nearest the line first; then the race's
    const toLine = (b) => Math.max(0, -race.lineInfo(b).d);
    const st = pre ? race.boats.slice().sort((a, b) => toLine(a) - toLine(b)) : race.standings();
    const place = done ? P.place : st.indexOf(P) + 1, left = -race.clock;
    const side = (P.boom ? P.boom > 0 : twa > 0) ? L.stbd : L.port;

    // the gun: GO, unless you're over
    if (wasPre && !pre && !P.ocs) { txt(goEl, L.go); flash(goEl, 'on', 1500); }
    wasPre = pre;
    // every boat's roundings, as they happen. Yours: over the start line a strip (your place, how long after the gun);
    // at a mark the full split, every boat's time there, in the board's place
    if (!pre) for (const b of race.boats) {
      const was = legOf.get(b) ?? b.leg;
      for (let l = was + 1; l <= b.leg; l++) (atMark[l] ||= new Map()).set(b, race.clock);
      legOf.set(b, b.leg);
      if (b !== P || P.leg <= was || done) continue;
      if (P.leg > 1) { spl = { l: P.leg, n: -1, left: SPLIT_S }; split.classList.remove('on'); continue; }
      txt(SP.k, L.start); txt(SP.t, L.ord(st.indexOf(P) + 1)); txt(SP.v, fmt(race.clock));
      txt(SP.g, `+${fmt(race.clock)} ${L.afterGun}`); cls(SP.g, 'g');
      flash(split, 'on', 4800);
    }
    if (spl) markSplitShow(race, c, P, dt);
    // the umpire's card runs down, then goes
    if (umpT > 0) { umpT -= dt; U.bar.style.width = `${(clamp(umpT / UMP_S, 0, 1) * 100).toFixed(1)}%`; if (umpT <= 0) ump.hidden = true; }
    // the finish
    if (done && !wasDone) { txt(q(fin, '.k'), L.finished); txt(q(fin, 'b'), `${L.ord(P.place)} · ${fmt(P.finish)}`); fin.classList.add('on'); }
    if (!done) fin.classList.remove('on');
    wasDone = done;
    const daily = !!race.settings?.daily;

    // the bug: the race, and the clock; from the top camera or the helm, the camera's name, as a broadcast says which it's on
    txt(B.sub, world.mode !== 'drone' && L.camName[world.mode] ? L.camName[world.mode] : `${daily ? L.daily : L.free}${venue ? ' · ' + venue : ''}`);
    txt(B.clock, pre ? L.live : done ? fmt(P.finish) : fmt(race.clock));
    B.clock.classList.toggle('run', !pre);

    // the gun clock, before the start
    B.gun.hidden = !pre; B.legs.hidden = pre;
    if (pre) {
      const gs = fmt(left + 0.999);
      if (left <= 10 && gs !== B.gunN._t) flash(B.gunN, 'beat', 500);
      txt(B.gunN, gs);
      cls(B.gunN, `b-gunn${left <= 10 ? ' now' : left <= 60 ? ' soon' : ''}`);
      const seq = race.seq, total = -seq[0].t, k = `${seq.length}|${total}`;
      if (k !== seqKey) {
        seqKey = k;
        B.seq.querySelectorAll('b').forEach((e) => e.remove());
        B.seqL.textContent = '';
        for (const s of seq) {
          const x = ((total + s.t) / total) * 100;
          if (s.t !== seq[0].t && s.t !== 0) { const tick = document.createElement('b'); tick.style.left = `${x}%`; B.seq.append(tick); }
          const lab = document.createElement('span'); lab.style.left = `${x}%`; lab.textContent = s.t === 0 ? L.gun : String(-s.t / 60); B.seqL.append(lab);
        }
      }
      B.seqI.style.width = `${clamp((total - left) / total, 0, 1) * 100}%`;
      // the line's bias: which end is further upwind, by how much
      const ux = Math.sin(race.wind.dir()), uz = -Math.cos(race.wind.dir());
      const fav = (c.pin.x - c.committee.x) * ux + (c.pin.z - c.committee.z) * uz, len = Math.hypot(c.pin.x - c.committee.x, c.pin.z - c.committee.z);
      const deg = Math.round(Math.asin(clamp(Math.abs(fav) / (len || 1), 0, 1)) / D2R);
      htm(B.bv, Math.abs(fav) < 4 ? L.square : `${fav > 0 ? L.pinEnd : L.boatEnd} <span class="is-up">+${deg}°</span>`);
      // its length, and the wind it would be square to
      txt(B.bl, `${L.line} ${metres(len)} · ${L.squareAt} ${String(squareBearing(c)).padStart(3, '0')}°`);
    } else {
      // the legs: done, now, to come
      const k = c.legs.join() + c.type;
      if (k !== legsKey) {
        legsKey = k; B.legR.textContent = '';
        for (let i = 1; i <= nLegs; i++) {
          const kind = legKind(c, i), el = document.createElement('div');
          el.className = 'b-leg';
          el.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true"><path d="${ARROW[kind]}" fill="currentColor"/></svg>${L[kind]}`;
          B.legR.append(el);
        }
      }
      [...B.legR.children].forEach((el, i) => { el.classList.toggle('done', done || i + 1 < P.leg); el.classList.toggle('now', !done && i + 1 === P.leg); });
      txt(B.legN, done ? L.finished : P.leg ? L.legOf(P.leg, nLegs) : L.start); // leg 0 after the gun: still to cross the line
      // the top camera: the wind in the tracker, its arrow the way it blows across the screen
      const topCam = world.mode === 'top' && !done;
      B.lw.hidden = !topCam;
      if (topCam) {
        const ux = Math.sin(P.wdir), uz = -Math.cos(P.wdir), a = onScreen(P.x, 0, P.z, 1e5), b = onScreen(P.x + ux * 60, 0, P.z + uz * 60, 1e5);
        if (a && b) { const r = Math.round(Math.atan2(a[1] - b[1], a[0] - b[0]) / D2R - 90); if (B.lwSvg._r !== r) { B.lwSvg._r = r; B.lwSvg.style.rotate = `${r}deg`; } }
        htm(B.lwN, `${Math.round(P.tws)}<span class="unit">${KNU}</span>`);
        B.lwSvg.setAttribute('aria-label', `${L.trueWind} ${Math.round(P.tws)} ${t('kn')}`);
      }
    }

    // the wind: where it comes from round your bow, its strength, and how it has swung on the beat
    twaS = twaS === null ? twa : twaS + wrap(twa - twaS) * (1 - Math.exp(-dt * 6));
    B.tw.setAttribute('transform', `rotate(${(twaS / D2R).toFixed(1)} 32 32)`);
    const beat = beatAngle(P.tws) * D2R;
    B.nogo.setAttribute('d', `M32 32 L${pt(twaS - beat, 29)} A29 29 0 0 1 ${pt(twaS + beat, 29)} Z`);
    htm(B.tws, `${Math.round(P.tws)}<span class="unit">${KNU}</span>`);
    const from = String(Math.round((((P.wdir / D2R) % 360) + 360) % 360) % 360).padStart(3, '0');
    txt(B.dir, `${L.from} ${from}°`);
    B.windSvg.setAttribute('aria-label', `${L.trueWind} ${from}°, ${Math.round(P.tws)} ${t('kn')}`);
    let sh = '', shc = '';
    if (pre) { // before the start: how far it has veered or backed since the first reading
      const vb = veerBack(race.wind.dir(), wind0 ?? race.wind.dir());
      if (vb >= 2) { sh = `${L.veer} ${vb}°`; shc = 'b-shift b-vb'; } else if (vb <= -2) { sh = `${L.back} ${-vb}°`; shc = 'b-shift b-vb'; }
    } else if (!done && !P.auto && Math.abs(twa) / D2R < 70) {
      const s = Math.round(((twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean())) / D2R);
      if (s >= 4) { sh = `${L.lift} ${s}°`; shc = 'b-shift is-up'; } else if (s <= -4) { sh = `${L.header} ${-s}°`; shc = 'b-shift is-down'; }
    }
    txt(B.shift, sh ? ` · ${sh}` : ''); cls(B.shift, shc || 'b-shift');
    const shk = sh && !pre ? shc : ''; // a lift or a header pulses the box
    if (shk && shk !== wasShift && race.clock - pulseAt > 10) { pulseAt = race.clock; windBox.style.setProperty('--pc', shk.includes('up') ? 'var(--up)' : 'var(--down)'); flash(windBox, 'pulse', 1400); }
    wasShift = shk;

    // the board: on the line before the start, then the race order with the gaps
    board.classList.toggle('pre', pre);
    txt(B.bt, pre ? L.onLine : done ? L.finished : L.toLeg[legKey(c, leg)] || t(legKey(c, leg)));
    txt(B.br, pre ? L.toLineSpd : L.gap);
    txt(B.bfn, L.boardFoot(race.boats.length));
    const iP = st.indexOf(P), show = iP < 6 ? st.slice(0, 6) : [...st.slice(0, 5), P], cx = iP < 3 ? st.slice(0, 3) : [...st.slice(0, 2), P];
    const leader = st[0], remL = remaining(race, leader);
    if (!pre) for (const [b, i] of st.map((b, i) => [b, i + 1])) {
      const was = lastPlace.get(b);
      if (was && was !== i && race.clock > 5) { // the first seconds after the gun the order sorts itself out as the boats cross
        moved.set(b, [i < was ? 'u' : 'd', race.clock + 4]);
        if (b === P) flash(Y.pos, i < was ? 'gain' : 'lose', 800);
      }
      lastPlace.set(b, i);
    }
    if (!pre && !done && !P.dsq && race.clock > 20) moveCall(race, st, P); // the first seconds after the gun the order sorts itself out
    rows.forEach((r, n) => {
      const b = show[n];
      r.el.hidden = !b; if (!b) return;
      const i = st.indexOf(b) + 1, me = b === P;
      cls(r.el, `b-row${me ? ' me' : ''}${i === 1 && !pre ? ' first' : ''}${cx.includes(b) ? '' : ' cxh'}`);
      txt(r.pos, b.dsq ? '–' : String(i));
      r.bar.style.setProperty('--c', hex(b.color));
      txt(r.nm, me ? t('you') : b.name); setFlag(r.fl, flagOf(b, me)); showPen(r.pen, b); showLevel(r.lv, me ? null : b.level);
      const mv = moved.get(b), mvOn = mv && race.clock < mv[1];
      txt(r.mv, mvOn ? (mv[0] === 'u' ? '▲' : '▼') : ''); cls(r.mv, `b-mv${mvOn ? ' ' + mv[0] : ''}`);
      if (mvOn && r.el._mv !== mv) { r.el._mv = mv; flash(r.el, mv[0] === 'u' ? 'gain' : 'lose', 1600); }
      if (pre) {
        txt(r.gp, metres(toLine(b))); txt(r.x, nf(b.v / KN));
        r.gp.classList.remove('dim');
      } else {
        let g;
        if (b.dsq) g = t('dsq');
        else if (i === 1) g = b.done ? fmt(b.finish) : L.leader;
        else if (b.done && leader.done) g = `+${fmt(b.finish - leader.finish)}`;
        else g = secs(gapTime(race, b, remaining(race, b) - remL));
        txt(r.gp, g); r.gp.classList.toggle('dim', i === 1);
      }
    });

    // the map's course
    txt(B.shape, L.shape[c.type] || L.shape.wl);

    // the state bar and your numbers
    const kindW = { up: L.upwind, down: L.downwind, reach: L.reaching }[legKind(c, clamp(P.leg, 1, nLegs))];
    txt(B.state, P.ocs ? t('ocsS') : pre ? `${L.preStart} · ${side}` : done ? L.finished : !P.leg ? `${L.start} · ${side}` : `${L.legN(P.leg)} · ${kindW} · ${side}`);
    B.state.classList.toggle('bad', !!P.ocs);
    cls(B.you, `pn b-you ${pre ? 'pre' : done ? 'done' : 'run'}`);
    txt(Y.pos, P.dsq ? '–' : String(place));
    txt(Y.nm, sailNo()); setFlag(Y.fl, flagOf(P, true));
    txt(Y.spd, nf(kn));
    let burn = null; // the time to burn, when you're closing on the line
    const ink = (el, c2) => { el.classList.remove('good', 'low', 'late'); if (c2) el.classList.add(c2); };
    if (pre) {
      const li = race.lineInfo(P), close = (Math.sin(P.h) * c.normal.x - Math.cos(P.h) * c.normal.z) * P.v;
      txt(Y.toL, L.toLine); txt(Y.to, String(Math.round(Math.max(0, -li.d)))); txt(Y.eta, '');
      Y.legP.setAttribute('d', ARROW.up); txt(Y.legT, `${L.start} ${fmt(left + 0.999)}`);
      if (close > 0.3 && li.d < 0) {
        burn = left - -li.d / close;
        txt(Y.burn, burn >= 1 ? `+${fmt(burn)}` : burn > -1 ? fmt(0) : `−${fmt(-burn)}`); ink(Y.burn, burn <= -1 ? 'late' : burn < 5 ? 'low' : ''); // time in hand +, late −
      } else { txt(Y.burn, '—'); ink(Y.burn, ''); }
    } else if (!done) {
      const m = race.nextMark(P), brg = Math.atan2(m.x - P.x, -(m.z - P.z)), cos = Math.cos(wrap(brg - P.h));
      const pct = P.polar > 0.5 ? kn / P.polar : 0, d = race.distToNext(P);
      txt(Y.pct, P.polar > 0.5 ? `${Math.round(pct * 100)}%` : '—');
      Y.pctI.style.width = `${(clamp(pct, 0, 1.1) / 1.1) * 100}%`;
      const pk = pct >= 0.95 ? 'good' : pct < 0.7 ? 'low' : ''; ink(Y.pct, pk); ink(Y.pctG, pk);
      txt(Y.vmg, nf(kn * cos));
      txt(Y.toL, L.toMark); txt(Y.to, String(Math.round(d)));
      const vm = P.v * cos; txt(Y.eta, vm > 0.3 ? fmt(d / vm) : '');
      Y.legP.setAttribute('d', ARROW[legKind(c, Math.max(1, P.leg))]); txt(Y.legT, P.leg ? L.legShort(P.leg, nLegs) : L.start);
      // to the leader, or ahead of the second, and the trend
      const lead = iP === 0, other = lead ? st[1] : leader;
      const gapM = other ? (lead ? remaining(race, other) - remaining(race, P) : remaining(race, P) - remL) : 0;
      // in seconds at the pace of the boat behind: the second's when you lead, yours when you don't
      const gap = other ? gapTime(race, lead ? other : P, gapM) : null;
      txt(Y.ldrL, lead ? L.ahead : L.toLeader);
      txt(Y.ldr, other ? secs(gap) : '—');
      if (lead !== wasLead) { wasLead = lead; hist.length = 0; }
      const r = gap == null ? 0 : trend(race.clock, lead ? -gap : gap); // seconds a minute, gaining on the one ahead or pulling away: both > 0
      const rs = Math.abs(r) >= 1 ? String(Math.round(Math.abs(r))) : nf(Math.abs(r));
      txt(Y.rate, Math.abs(r) >= 0.5 ? `${r > 0 ? '▲' : '▼'} ${rs} ${L.sec}${L.perMin}` : '');
      ink(Y.rate, Math.abs(r) >= 0.5 ? (r > 0 ? 'good' : 'low') : '');
    } else {
      txt(Y.time, P.dsq ? t('dsq') : fmt(P.finish));
      Y.legP.setAttribute('d', ARROW.down); txt(Y.legT, L.finished);
    }

    // the call: short ones as the broadcast's capitals, a sentence in its own case
    toastEl.classList.toggle('long', (toastEl.textContent || '').length > 44);
    // the layline, when nothing else is being called
    // before the start, the same place calls the time to burn: hold, bear away now, or late
    burnK = pre && !P.ocs && !P.auto ? burnCall(burn, left, burnK) : null;
    const ly = !pre && !done ? layline(race, c, P) : burnK ? [burnK.kind === 'hold' ? L.hold(fmt(burnK.s)) : burnK.kind === 'now' ? L.bearNow : L.late, burnK.kind === 'now', false] : null;
    lay.classList.toggle('on', !!ly && !toastEl.classList.contains('show'));
    if (ly) { txt(layT, ly[0]); lay.classList.toggle('now', ly[1]); txt(layK, ly[2] ? L.space : ''); }
    lay.classList.toggle('burn', !!burnK); lay.classList.toggle('late', burnK?.kind === 'late');

    // the rudder fades back when no one is steering
    rudder.classList.toggle('act', Math.abs(P.rudder) > 0.04);
    // the sheet: is the knob in the band, and which way to pull
    const awa = Math.abs(P.awa) / D2R, a = Math.abs(twa) / D2R, tol = 7 / 77;
    const lo = clamp(sheetFor(idealSail(awa)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(awa) + P.depower) + tol, 0, 1);
    const isOff = (s) => a >= 28 && (s < lo || s > hi);
    sheet.classList.toggle('off', isOff(P.sheet));
    if (jibSheet) jibSheet.classList.toggle('off', !!P.split && isOff(P.jibSheet));
    const want = P.trim === 'in' || P.trim === 'out' ? P.trim : null, onJib = P.split && P.trimSail === 'jib';
    for (const [el, mine] of [[advMain, !onJib], [advJib, onJib]]) {
      if (!el) continue;
      const showA = !P.autoTrim && want && mine;
      el.classList.toggle('on', !!showA);
      if (showA) { el.classList.toggle('t', want === 'in'); txt(el.firstChild, want === 'in' ? '↑' : '↓'); txt(el.lastChild, t(want)); }
    }
    // buttons that have just come up pulse until used (or for a while)
    for (const id of btnIds) {
      const b = document.getElementById(id); if (!b || id === 'tackBtn') continue;
      const vis = !b.hidden;
      if (vis && fresh[id] === false && race.clock > 0) { b.classList.add('fresh'); clearTimeout(b._ft); b._ft = setTimeout(() => b.classList.remove('fresh'), 6000); }
      if (!vis) b.classList.remove('fresh');
      fresh[id] = vis;
    }
    // the last ten seconds: a beat a second
    const cs = count.textContent;
    if (cs !== lastCount) { lastCount = cs; if (count.classList.contains('final')) { count.classList.remove('beat'); void count.offsetWidth; count.classList.add('beat'); } }
    txt(q(B.cam, 'span'), t(world.mode));

    placeTag(race, c, leg, P);
    over.classList.toggle('on', !hud.hidden);
    if (!hud.hidden) { placeBoats(race, P, st, pre); placeAdv(race, c, P, st, pre, done); }
  }

  // the screen point of a place on the water (in the tags' own scaled pixels), or null behind the camera or off it
  function onScreen(x, y, z, pad = 0) {
    v3.set(x, y, z).project(world.camera);
    if (v3.z > 1) return null;
    const hz = parseFloat(over.style.getPropertyValue('--hz')) || 1, W = innerWidth / hz, H = innerHeight / hz;
    const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
    return sx < -pad || sx > W + pad || sy < -pad || sy > H + pad ? null : [sx, sy];
  }

  // the boats' tags: yours, and before the start the two nearest the line, then the leader and the boat just ahead (or
  // just behind, when you lead); halfway up each mast. Not yours from the helm.
  // the HUD's blocks a tag on the water would hide under (the calls, the map, the board), as the screen has them,
  // read once a frame
  let blocks = [];
  function readBlocks() {
    blocks = [...calls.children, map, board].filter((e) => e && !e.hidden).map((e) => e.getBoundingClientRect())
      .filter((r) => r.width && r.height).map((r) => ({ l: r.left - 4, r: r.right + 4, t: r.top - 4, b: r.bottom + 4 }));
  }
  function placeBoats(race, P, st, pre) {
    readBlocks();
    const i = st.indexOf(P);
    const others = pre ? st.filter((b) => b !== P).slice(0, 2) : [st[0], st[i - 1] || st[i + 1]].filter((b) => b && b !== P);
    const list = [...(world.mode === 'helm' ? [] : [P]), ...new Set(others)].slice(0, 3);
    btags.forEach((g, n) => {
      const b = list[n], at = b && !b.done && onScreen(b.x, 9, b.z, 40); // halfway up the mast
      g.el.classList.toggle('on', !!at);
      if (!at) return;
      const place = st.indexOf(b) + 1, me = b === P;
      cls(g.el, `b-btag on${me ? ' me' : ''}${place === 1 && !pre ? ' first' : ''}`);
      g.el.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px)`;
      txt(g.p, pre ? '·' : String(place));
      g.c.style.setProperty('--c', me ? 'var(--you)' : hex(b.color));
      txt(g.n, me ? sailNo() : b.name); txt(g.me, me ? L.you : ''); setFlag(g.fl, flagOf(b, me)); showLevel(g.lv, me ? null : b.level);
      txt(g.v, pre && !me ? L.mToLine(Math.round(Math.max(0, -race.lineInfo(b).d))) : `${nf(b.v / KN)} ${t('kn')}`); // a rival before the start: how far from the line
      showPen(g.pen, b);
      // its box slid back onto the screen when the boat is near an edge (its width read now and then, not every frame)
      if (!g.w || ++g.f % 30 === 0) g.w = g.box.offsetWidth;
      const half = g.w / 2, edge = 8, dx = Math.min(0, innerWidth - edge - (at[0] + half)) + Math.max(0, edge - (at[0] - half));
      const tr = dx ? `calc(-50% + ${dx.toFixed(0)}px) -22px` : '';
      if (g.box._tr !== tr) { g.box._tr = tr; g.box.style.translate = tr; }
      // under one of the HUD's blocks it would only peek out from beneath it: then it isn't shown (its box as the
      // screen has it: it hangs above the point, lifted off it)
      if (blocks.length) { const r = g.box.getBoundingClientRect(); if (blocks.some((k) => r.left < k.r && r.right > k.l && r.top < k.b && r.bottom > k.t)) g.el.classList.remove('on'); }
    });
  }

  // the advantage line: across the water through the leader, square to the wind, on a beat or a run, while you're
  // behind it; its label says how far, along the wind
  function placeAdv(race, c, P, st, pre, done) {
    const lead = st[0], kind = legKind(c, Math.max(1, P.leg));
    let gap = 0, pts = [];
    if (!pre && !done && lead && lead !== P && !lead.done && lead.leg === P.leg && kind !== 'reach') {
      const W = race.wind.dir(), ux = Math.sin(W), uz = -Math.cos(W), s = kind === 'up' ? 1 : -1; // up the wind, or down it
      gap = ((lead.x - P.x) * ux + (lead.z - P.z) * uz) * s;
      if (gap > 3) for (let k = -12; k <= 12; k++) { const a = onScreen(lead.x - uz * k * 40, 0.3, lead.z + ux * k * 40, 4000); if (a) pts.push(a); }
    }
    const show = pts.length > 1;
    advLine.style.display = show ? '' : 'none';
    if (show) advLine.setAttribute('points', pts.map((a) => a.map((v) => v.toFixed(1)).join(',')).join(' '));
    // the label at the leader, or where the line is in sight when she isn't: the visible point nearest the middle
    let at = show && onScreen(lead.x, 0.3, lead.z, 0);
    if (show && !at) {
      const hz = parseFloat(over.style.getPropertyValue('--hz')) || 1, W = innerWidth / hz, H = innerHeight / hz;
      const seen = pts.filter(([x, y]) => x > 120 && x < W - 120 && y > 80 && y < H - 80);
      at = seen.sort((a, b) => Math.abs(a[0] - W / 2) - Math.abs(b[0] - W / 2))[0] || null;
    }
    advLab.classList.toggle('on', !!at);
    if (at) { advLab.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px)`; txt(advLab, `${L.advantage} · ${lead.name} +${metres(gap)}`); }
  }

  // on a beat: how long until the mark opens up on the other tack, along the course you're steering (the wind as it is
  // where you are; a shift moves it). [what to call, whether it's now]
  function layline(race, c, P) {
    if (!isBeat(c, P.leg) || P.auto) return null;
    const m = race.nextMark(P), k = laylineAt({ mx: m.x, mz: m.z, x: P.x, z: P.z, h: P.h, v: P.v, W: P.wdir, beat: beatAngle(P.tws) * D2R });
    // [the words, whether it's now, whether it asks for a tack (Space)]
    return !k ? null : k.kind === 'in' ? [L.layIn(fmt(k.s)), false, true] : k.kind === 'fetch' ? [L.fetch, false, false] : [k.kind === 'over' ? L.over : L.layNow, true, true];
  }

  function placeTag(race, c, leg, P) {
    if (hud.hidden || P.done) { tag.classList.remove('on'); return; }
    const next = legTargets(c, P.leg);
    const x = next.reduce((s, m) => s + m.x, 0) / next.length, z = next.reduce((s, m) => s + m.z, 0) / next.length;
    v3.set(x, 2.5, z).project(world.camera);
    const hz = parseFloat(getComputedStyle(tag).zoom) || 1, W = innerWidth / hz, H = innerHeight / hz;
    let sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
    const lw = tagIn.offsetWidth / 2 + 10; // the label must fit whole, or it goes to the edge and points
    const behind = v3.z > 1, inView = !behind && sx > lw && sx < W - lw && sy > 120 && sy < H - 140;
    tag.classList.toggle('line', !c.marks[leg] && leg !== 'gate');
    tag.classList.toggle('edge', !inView);
    let rot = 0;
    if (!inView) { // pinned to the edge, pointing the way
      let dx = sx - W / 2, dy = sy - H / 2; if (behind) { dx = -dx; dy = -dy; }
      const hw = W / 2 - lw, hh = H / 2 - 150, k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      sx = W / 2 + dx * k; sy = H / 2 + dy * k; rot = Math.atan2(dy, dx);
      // the umpire's card and the calls are under it there (it stands over the HUD): below them instead
      for (const e of [ump, ...calls.children]) {
        if (!e || e.hidden || !e.offsetParent) continue;
        const r = e.getBoundingClientRect(); if (!r.height) continue;
        const l = r.left / hz, rr = r.right / hz, t2 = r.top / hz, b = r.bottom / hz;
        if (sx + lw > l && sx - lw < rr && sy + 22 > t2 && sy - 22 < b) sy = Math.min(H - 150, b + 30);
      }
    }
    tag.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    tagPtr.style.transform = `rotate(${(rot / D2R).toFixed(0)}deg)`;
    txt(tagN, t(legKey(c, leg))); txt(tagV, metres(race.distToNext(P)));
    tag.classList.add('on');
  }

  // the calls, kept by key: a new one slides in, a changed one only changes its words (and colour), one no longer
  // wanted stays a moment (no flicker at a threshold), then fades and folds away. The wind's swing is in the wind box.
  const chipBox = $('#chips'), live = new Map(), LINGER = 0.9;
  function chips(list) {
    const now = performance.now() / 1000, want = new Set();
    for (const [kind, text, key = text] of list) {
      if (key === 'shift') continue;
      want.add(key);
      let ch = live.get(key);
      if (!ch) {
        const el = document.createElement('span'); el.className = `chip nx-chip ${kind}`; chipBox.append(el);
        ch = { el, kind }; live.set(key, ch);
        void el.offsetWidth; el.classList.add('in');
      }
      if (ch.kind !== kind) { ch.el.classList.replace(ch.kind, kind); ch.kind = kind; }
      if (ch.out) { ch.out = false; clearTimeout(ch.timer); ch.el.classList.remove('out'); ch.el.classList.add('in'); }
      txt(ch.el, text); ch.seen = now;
    }
    for (const [key, ch] of live) {
      if (want.has(key) || ch.out || now - ch.seen < LINGER) continue;
      ch.out = true; ch.el.classList.remove('in'); ch.el.classList.add('out');
      ch.timer = setTimeout(() => { ch.el.remove(); live.delete(key); }, 800);
    }
  }

  // the split at the mark you've just rounded, in the board's place: filled as it opens and again as each boat rounds
  // while it shows (not every frame); the ones still to round greyed, with how far they are from the mark
  function markSplitShow(race, c, P, dt) {
    spl.left -= dt;
    if (spl.left <= 0) { spl = null; msplit.hidden = true; board.classList.remove('spl'); return; }
    MS.bar.style.width = `${(clamp(spl.left / SPLIT_S, 0, 1) * 100).toFixed(1)}%`;
    const at = atMark[spl.l];
    if (!at || at.size === spl.n) return;
    if (spl.n < 0) { msplit.hidden = false; board.classList.add('spl'); }
    spl.n = at.size;
    const ml = spl.l - 1; // the mark: where the leg before this one went
    remaining(race, P); // (the legs' lengths, for this course)
    const rows = markSplit(race.boats.map((b) => {
      if (at.has(b)) return { b, t: at.get(b) };
      // still to round: how far she is from the mark (none for a boat out of the race, or not yet on that leg)
      const d = race.distToNext(b);
      return { b, due: true, d: b.done || b.dsq || b.leg !== ml || !Number.isFinite(d) ? null : d };
    }));
    const iP = rows.findIndex((r) => r.b === P);
    const show = iP < 6 ? rows.slice(0, 6) : [...rows.slice(0, 5), rows[iP]], cx = iP < 3 ? rows.slice(0, 3) : [...rows.slice(0, 2), rows[iP]];
    txt(MS.k, `${t(legKey(c, c.legs[ml]))} · ${L.split}`);
    MS.rows.forEach((r, n) => {
      const x = show[n];
      r.el.hidden = !x; if (!x) return;
      const me = x.b === P, i = rows.indexOf(x) + 1, lead = i === 1 && !x.due;
      cls(r.el, `b-row${me ? ' me' : ''}${x.due ? ' due' : ' rd'}${lead ? ' first' : ''}${cx.includes(x) ? '' : ' cxh'}`);
      txt(r.pos, String(i));
      txt(r.nm, me ? t('you') : x.b.name); setFlag(r.fl, flagOf(x.b, me)); showPen(r.pen, x.b); showLevel(r.lv, me ? null : x.b.level);
      txt(r.tm, x.due ? (x.d == null ? '—' : `${Math.round(x.d)} ${M}`) : fmt(x.t));
      txt(r.gp, x.due ? (x.d == null ? '' : L.toGo) : x.gap == null ? '—' : lead ? L.leads : `+${fmt(x.gap)}`); r.gp.classList.toggle('dim', lead || x.due);
    });
  }

  // the umpire's call on a foul that involves you (main.js hands over the race's message: 'fouled', you fouled a.who;
  // 'theyFouled', a.who fouled you; 'touched', you touched a mark): who takes the penalty, one turn (a tack and a gybe,
  // rule 44.2), the rule in a sentence; a timer runs down and it goes
  function umpire(key, a = {}) {
    const race = getRace(), P = race.player, mine = key !== 'theyFouled';
    const b = mine ? P : race.boats.find((x) => x.name === a.who), you = b === P;
    const rule = key === 'touched' ? '31' : String(a.rule ?? '');
    txt(U.nm, `${you ? sailNo() : b ? b.name : a.who || ''} · ${L.oneTurn}`);
    txt(U.me, you && sailNo() !== t('you') ? L.you : '');
    setFlag(U.fl, b ? flagOf(b, you) : null);
    const x = t('x' + rule);
    txt(U.r, `${L.ruleN(rule)}: ${x !== 'x' + rule ? x : t('r' + rule)}`);
    txt(U.v, key === 'fouled' ? L.against(a.who) : key === 'theyFouled' ? L.againstYou : '');
    U.v.hidden = !U.v.textContent;
    umpT = UMP_S; U.bar.style.width = '100%';
    ump.hidden = false; ump.style.animation = 'none'; void ump.offsetWidth; ump.style.animation = ''; // in again, if one was showing
  }

  return { update, chips, remaining, gapTime, umpire };
}
