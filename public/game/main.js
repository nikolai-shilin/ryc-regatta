// Regatta: the game loop, the touch controls, the instruments, the sounds and the menus.
import { Race, D2R, KN, HULL, clamp, wrap, idealSail, sheetFor, beatAngle, ZONE, dailyRace } from './sim.js';
import { World, defaultQuality, ladderStep } from './world.js';
import { raceStarted, raceFinished, raceResult } from './stats.js';
import { createHudNext } from './hud-next.js';
import { VENUE, venueById } from './venues.js';

const $ = (s) => document.querySelector(s);
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
// The game is a site of its own (this repo, the Vercel project ryc-regatta, at regatta.rycrentals.com); the app,
// its rule articles, its fonts and the race scores (api/game.mjs in the iyt-test repo) stay on iyt.rycrentals.com, which lets this site
// read them across origins. SITE is in stats.js too.
const SITE = 'https://iyt.rycrentals.com';
// The menus are Next.js pages on this site now: the race hub, the free-race set-up and the race's result page.
const HUB = '/race';
// From Telegram the app passes its launch data in the hash, as Telegram does (miniapp/app.js in iyt-test); telegram-web-app.js has
// read and kept it by now, so it comes off the address bar and out of any link the player copies.
if (TG && /tgWebAppData=/.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}

// ---------- words ----------
const ord = (n) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`;
const T = {
  en: {
    pausedK: 'Paused', legOf: (a, b) => `Leg ${a} of ${b}`, nextK: (m) => `Next: ${m}`, placeK: 'Place', ofN: (n) => `of ${n}`, timeK: 'Race time', penK: 'Penalties', penNone: 'clean so far', penS: 'spinning turns',
    changeRace: 'Change the race', leaveHub: 'Leave to the race hub', quickK: 'Quick switches', startsOver: 'starts over', loadingK: 'Rigging the boat', escResumes: 'Esc resumes',
    leaveK: 'Leave this race?', leaveTxt: (pl, leg) => `You are ${pl} on leg ${leg}. This race’s time and place are not kept.`, keepRacing: 'Keep racing', doRestart: 'Restart', doChange: 'Change it', doLeave: 'Leave',
    kick: 'Game', title: 'Up and down', fun: 'Just for fun — take a break and relax between tests.', sub: 'A windward–leeward race against the computer boats, under the racing rules. Steer, trim, tack, read the wind.',
    modeK: 'Race', daily: 'Today’s race', free: 'Free race', howK: 'How to play',
    dailyNote: (w, at) => `The same place, course and wind for everyone today — ${at}, ${w} — so times compare fairly. The fastest are on the Home page.`,
    dbK: 'Your race', dGun: (d, v) => `At the gun: ${d} m from the line at ${v} kn`, dGunOver: 'At the gun: over the line — you had to go back',
    dStartLate: (s) => `You crossed the line ${s} s after the gun`, tipStart: 'Aim to be a boat length behind the line, at full speed, as the gun goes.',
    dSpeed: (p) => `Speed: ${p}% of target on average`, tipSpeed: 'Keep the sheet in the blue band and steer smoothly: every turn of the rudder brakes.',
    dTacks: (h, l) => `Tacks on the beat: ${h} in a header, ${l} in a lift`, tipTacks: 'Tack when the wind heads you (the orange chip), not when it lifts you (the blue one).',
    dDirty: (s) => `${s} s in another boat’s dirty air`, tipDirty: 'Behind and downwind of another boat the wind is weaker: tack away or sail clear of it.',
    dPen: (s) => `${s} s spinning penalty turns`, dClean: 'No fouls and no penalties — a clean race', dHails: (n) => `Hailed ${n}× by boats you had to keep clear of`,
    dRule: (r) => `Rule ${r}`, read: 'Read the rule', r10: 'Port keeps clear of starboard', r11: 'Windward keeps clear of leeward', r12: 'Clear astern keeps clear',
    r13: 'While tacking, keep clear', r18: 'Mark-room', r31: 'Touching a mark', r44: 'A boat taking a penalty keeps clear', rOcs: 'Over the line at the start',
    x10: 'On opposite tacks, the boat with the wind on her port side keeps clear.', x11: 'Overlapped on the same tack, the windward boat keeps clear.',
    x12: 'On the same tack and not overlapped, the boat behind keeps clear.', x13: 'From head to wind until close-hauled, a tacking boat keeps clear of everyone.',
    x18: 'At the gate and the wing mark, in the zone, the inside boat, or the one clear ahead, gets room to round. Not at the windward mark: there nobody gets mark-room, and port keeps clear of starboard.', x31: 'Touching a mark costs one penalty turn.', x44: 'A boat spinning her penalty turns keeps clear of the others.',
    r15: 'Just got right of way — give room first', r16: 'Right of way, but no sudden turns', r17: 'In to leeward from astern — no higher than your proper course',
    x15: 'A boat that gets right of way by her own action (a tack, or sailing up from astern) must at first give the other room to keep clear.',
    x16: 'A boat with right of way that changes course must leave the other boat room to keep clear.',
    x17: 'Overlapped to leeward from clear astern within two hull lengths, a boat must not sail above her proper course.',
    hail15: 'Give me room to keep clear!', hail16: 'Don’t turn into me!', hail17: 'Proper course!',
    split: 'Main + jib', mainCap: 'Main', jibCap: 'Jib', jibIn: 'Jib: pull in', jibOut: 'Jib: ease out',
    kiteHoist: 'Hoisting the kite…', kiteUp: 'Kite’s drawing', kiteDrop: 'Dropping the kite…',
    r20: 'Room to tack at an obstruction', x20: 'Close-hauled and blocked by an obstruction ahead, a boat may hail for room to tack; the boat hailed must tack or give her room.',
    hail20: 'Room to tack!', exonerated: 'Pushed into it by another boat’s foul — no penalty (rule 21)',
    barging: 'Barging: there’s no room at the committee boat at the start — the windward boat keeps clear',
    reef: 'Reef', reefStart: 'Tying in a reef…', reefDone: 'Reefed — she stands up better', shakeStart: 'Shaking out the reef…', shakeDone: 'Full main again',
    jibBtn: 'J3', jibBig: 'J1', jibStart: 'Changing jibs…', jibDone: 'New jib up', zero: 'Code 0',
    kiteHoistZ: 'Unfurling the code zero…', kiteUpZ: 'Code zero drawing', kiteDropZ: 'Furling the code zero…',
    hailBtn: 'Hail', youHail: (h) => `You: “${h}”`, hailNone: 'Nothing to hail for',
    prepU: 'U flag today: in the triangle by the line in the last minute, you’re out (UFD)', prepB: 'Black flag today: over in the last minute and you’re out, even if the start is recalled (BFD)',
    ufd: 'Over in the last minute under the U flag — disqualified (UFD)', bfd: 'Over in the last minute under the black flag — disqualified (BFD)',
    genRecall: (f) => `General recall — too many over. The start is repeated${f === 'U' ? ', now under the U flag' : f === 'B' ? ', now under the black flag' : ''}`,
    finishedStartDsq: 'Finished — but disqualified at the start', flagU: 'U flag', flagB: 'Black', flagSub: 'Recall',
    dStartDsq: (f) => (f === 'U' ? 'Disqualified at the start (U flag)' : 'Disqualified at the start (black flag)'), tipStartDsq: 'Under U or the black flag, stay below the line for the whole last minute.',
    'r18.3': 'Tacking in the zone', 'r18.4': 'Gybing at the mark', r19: 'Room at an obstruction', rU: 'The U flag', rB: 'The black flag',
    'x18.3': 'A boat that tacks onto starboard in the zone mustn’t make a boat that has been on starboard since entering it sail above close-hauled, and gives her room if she gets inside.',
    'x18.4': 'An inside boat with right of way that has to gybe at the mark sails no farther from it than her proper course needs.',
    x19: 'Passing an obstruction overlapped (the committee boat, away from the start and finish), the outside boat gives the inside one room.',
    'hail18.3': 'You tacked in the zone — keep clear!', 'hail18.4': 'Gybe — no wider than you need!', hail19: 'Room at the committee boat!',
    pb: (s) => `Your best on this course: ${s}`, pbNew: 'A new personal best!', pbToday: (s) => `Your best today: ${s}`, todayTop: 'Today’s fastest', guest: 'No name',
    cSteer: 'Steer: drag your left thumb along the arc', cSheet: 'Trim: slide your right thumb up to pull the sails in, down to ease them',
    cLine: 'Head for the line and cross it just after the gun', cHeader: 'The wind has headed you — tap Tack', cMark: 'Round the mark leaving it on your left (to port)',
    cKite: 'Bear away and tap Kite to fly the gennaker', cGate: 'Sail between the two buoys of the gate', cFinish: 'Now cross the line to finish',
    wind: 'Wind', light: 'Light · 7 kn', medium: 'Medium · 12 kn', strong: 'Strong · 19 kn', laps: 'Laps', sails: 'Sails',
    manual: 'I trim', auto: 'Auto-trim', sound: 'Sound', voiceK: 'Voice', on: 'On', off: 'Off', startK: 'Start', m1: '1 min', m3: '3 min', m5: '5 min',
    fleetK: 'Boats', lengthK: 'Course', lShort: 'Short', lMedium: 'Medium', lLong: 'Long',
    currentK: 'Current', guidesK: 'Guides', gfx: 'Graphics', gAuto: 'Auto', gHigh: 'High', gMedium: 'Medium', gLow: 'Low', gsHigh: 'High', gsMedium: 'Medium', gsLow: 'Low', gfxNow: (q) => `Graphics · ${q} now`, start: 'Start race', resume: 'Resume', restart: 'Restart',
    how1: '<b>Left thumb</b> steers on the arc. <b>Right thumb</b> works the sheet: up pulls the sails in, down lets them out. Keep the telltales green.',
    how2: '<b>Tack</b> turns you through the wind (<b>Gybe</b> downwind). <b>Kite</b> sets the gennaker on a run — the hoist and the drop take the crew a few seconds, so get it down in good time before the gate. In a gust, ease the sheet before she heels too far; in a blow, <b>Reef</b> makes the main smaller. Before the start, head up and let the sheet right out to stop — or even go astern.',
    how3: 'Start after the gun — the class flag comes down. Over early and you must go back. Round the windward mark <b>leaving it to port</b>, finish through the line.',
    how5: 'Round your boat: the <b>arrow</b> shows where the wind blows from; <b>red</b> — too close to the wind to sail; <b>green</b> marks — the best angle upwind; <b>blue</b> — the best angle downwind. The wind swings ten degrees and more either way every minute or so: in a <b>lift</b> you can point higher, in a <b>header</b> tack.',
    how4: 'Racing rules: port tack keeps clear of starboard, windward of leeward, the boat astern of the boat ahead; at the windward mark nobody gets room, port keeps clear of starboard; at the gate, the <b>zone</b> (dashed ring, three hull lengths): if two boats are overlapped when the first reaches it, the inside one gets room, if not — the one clear ahead. Hit someone you should have avoided, or touch a mark — one penalty turn: a tack and a gybe. A boat that has just got right of way must first give the other room, and a boat with right of way mustn’t turn suddenly into one keeping clear.',
    rotate: 'Turn your phone sideways for the best view.', back: '← Back to Sailing Certification Test',
    flagCls: 'Class', flagP: 'Prep', flagX: 'Recall', kn: 'kn', drone: 'Drone', helm: 'Helm', top: 'Top', tack: 'Tack', gybe: 'Gybe', kite: 'Kite', in: 'In', out: 'Out',
    ok: 'Trim OK', pullIn: 'Pull in', easeOut: 'Ease out', irons: 'In irons',
    startIn: 'Start', lineStart: 'Start line', mark: 'Windward mark', wing: 'Wing mark', gate: 'Leeward gate', finish: 'Finish',
    roundedTri: 'Mark rounded — bear away onto the reach to the wing mark', roundedWing: 'Wing mark rounded — gybe onto the broad reach',
    seaBreeze: 'Sea breeze today — it will build and swing right as you race', kiteWrap: 'The kite wrapped in the gybe — it has to come down', kiteGybed: 'Kite gybed',
    crashGybe: 'Crash gybe! Too far by the lee — the boom slammed across', deathRoll: 'Death roll! By the lee with the kite up — she rolled and rounded up',
    byLee: (d) => `By the lee ${d}° — gybe or head up`, foot: 'Slow — foot a few degrees to build speed', waveTip: 'Waves: luff up the face, bear away down the back', ocsS: 'OCS — return below the line',
    target: 'target', vmg: 'VMG', line: 'line', toLine: 'to line', favPin: 'pin end favoured', favBoat: 'boat end favoured', square: 'line square',
    sigWarn: (n) => `Warning signal — class flag up, ${n} min`, sigPrep: (n, f = 'P') => `Preparatory — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} up, ${n} min`, sig1: (n, f = 'P') => `One minute — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} down`, gun: 'Start! Class flag down',
    ocs: 'Over early! X flag — go back below the line', cleared: 'Clear — now start', started: 'Good start!', rounded: 'Mark rounded — bear away, kite up',
    missedLine: 'Outside the line — cross between the committee boat and the pin', missedGate: 'Outside the gate — go back and sail between the two buoys', wrongSide: 'Leave the mark to port — go back round it',
    gateMsg: 'Through the gate — back upwind', bump: 'Contact!', aground: 'Aground! Steer back out to sea', broach: 'Broach! Ease the sheet', kitedown: 'Too close to the wind — the kite comes down in a hurry',
    heelMsg: 'Too much heel — ease the sheet', ironsMsg: 'In irons — steer away from the wind', gust: 'Gust!', autoOff: 'Auto-trim off — you trim now',
    hail10: 'Starboard!', hail11: 'Windward boat, keep clear!', hail12: 'Keep clear astern!', hail13: 'You’re tacking — keep clear!', hail18: 'Room at the mark!', hail44: 'Penalty boat — keep clear!',
    fouled: (w, r) => `Foul on ${w} (rule ${r}) — penalty turn: tack and gybe`, theyFouled: (w, r) => `${w} broke rule ${r} and takes a penalty`,
    touched: 'You touched the mark — penalty turn: tack and gybe', penaltyDone: 'Penalty done', pen: (tk, gy) => `Penalty: ${tk ? '✓' : '○'} tack ${gy ? '✓' : '○'} gybe`,
    dirty: 'Dirty air', surf: 'Surfing!', lift: (d) => `Lift ${d}°`, header: (d) => `Header ${d}° — tack?`,
    zIn: (n) => `Zone · overlapped with ${n}, you're inside — you get room`, zOut: (n) => `Zone · overlapped with ${n}, you're outside — give room`,
    zAhead: (n) => `Zone · clear ahead of ${n} — you get room`, zAstern: (n) => `Zone · clear astern of ${n} — keep clear`, tackCall: 'Ready about… Lee-oh!', gybeCall: 'Stand by to gybe… Gybe-oh!',
    results: 'Results', again: 'Race again', menu: 'Menu', racing: 'racing…', you: 'You', dsq: 'DSQ',
    gfxDown: (q) => `Graphics set to ${q} to keep it smooth`, place: ord, finished: (n) => `Finished ${ord(n)}!`, finishedDsq: 'Finished without taking your penalty — DSQ',
  },
  ru: {
    pausedK: 'Пауза', legOf: (a, b) => `Отрезок ${a} из ${b}`, nextK: (m) => `Дальше: ${m}`, placeK: 'Место', ofN: (n) => `из ${n}`, timeK: 'Время', penK: 'Штрафы', penNone: 'пока чисто', penS: 'штрафные обороты',
    changeRace: 'Изменить гонку', leaveHub: 'Выйти в меню гонок', quickK: 'Быстрые переключатели', startsOver: 'новый старт', loadingK: 'Готовим лодку', escResumes: 'Esc — продолжить',
    leaveK: 'Выйти из гонки?', leaveTxt: (pl, leg) => `Ты ${pl}-й на ${leg}-м отрезке. Время и место этой гонки не сохранятся.`, keepRacing: 'Продолжить', doRestart: 'Заново', doChange: 'Изменить', doLeave: 'Выйти',
    kick: 'Игра', title: 'Up and down', fun: 'Просто для удовольствия — отдохни и расслабься между тестами.', sub: 'Гонка «апвинд — даунвинд» против компьютерных лодок по правилам. Рули, работай шкотом, делай повороты, читай ветер.',
    modeK: 'Гонка', daily: 'Гонка дня', free: 'Свободная', howK: 'Как играть',
    dailyNote: (w, at) => `Сегодня у всех одно место, одна дистанция и один ветер — ${at}, ${w}, — так что время честно сравнивается. Самые быстрые — на главной.`,
    dbK: 'Твоя гонка', dGun: (d, v) => `На сигнале старта: ${d} м до линии, ${v} уз`, dGunOver: 'На сигнале старта: за линией — пришлось возвращаться',
    dStartLate: (s) => `Линию пересёк через ${s} с после сигнала`, tipStart: 'Цель — быть в корпусе от линии на полной скорости в момент сигнала.',
    dSpeed: (p) => `Скорость: в среднем ${p}% от целевой`, tipSpeed: 'Держи шкот в синей полосе и рули плавно: каждое движение руля тормозит.',
    dTacks: (h, l) => `Повороты на лавировке: ${h} — когда ветер зашёл, ${l} — когда отошёл`, tipTacks: 'Поворачивай, когда ветер заходит (оранжевая метка), а не когда отходит (синяя).',
    dDirty: (s) => `${s} с в грязном ветре другой лодки`, tipDirty: 'За другой лодкой и под ветром от неё ветер слабее: поверни или уйди в чистый ветер.',
    dPen: (s) => `${s} с на штрафных оборотах`, dClean: 'Ни нарушений, ни штрафов — чистая гонка', dHails: (n) => `${n} раз(а) окликнули лодки, которым ты должен был уступить`,
    dRule: (r) => `Правило ${r}`, read: 'Прочитать правило', r10: 'Левый галс уступает правому', r11: 'Наветренная уступает подветренной', r12: 'Догоняющая уступает',
    r13: 'В повороте — уступай', r18: 'Место у знака', r31: 'Касание знака', r44: 'Лодка на штрафе уступает', rOcs: 'Фальстарт',
    x10: 'На разных галсах уступает лодка, у которой ветер слева (левый галс).', x11: 'Связанные на одном галсе: наветренная уступает.',
    x12: 'На одном галсе без связанности уступает идущая сзади.', x13: 'От линии ветра до курса бейдевинд лодка в повороте уступает всем.',
    x18: 'У ворот и у бокового знака в зоне место для огибания получает внутренняя лодка или та, что впереди. У верхнего знака места не требует никто: левый галс уступает правому.', x31: 'Касание знака — один штрафной оборот.', x44: 'Лодка на штрафных оборотах уступает остальным.',
    r15: 'Получила право дороги — сначала дай место', r16: 'Право дороги — но без резких поворотов', r17: 'Догнала сзади под ветром — не выше надлежащего курса',
    x15: 'Лодка, получившая право дороги своими действиями (поворотом или догнав сзади), сначала должна дать другой место, чтобы уступить.',
    x16: 'Лодка с правом дороги, меняя курс, должна оставлять другой лодке место, чтобы уступить.',
    x17: 'Став связанной под ветром, догнав сзади в пределах двух корпусов, лодка не должна идти выше своего надлежащего курса.',
    hail15: 'Дай место уступить!', hail16: 'Не поворачивай на меня!', hail17: 'Надлежащий курс!',
    split: 'Грот + стаксель', mainCap: 'Грот', jibCap: 'Стаксель', jibIn: 'Стаксель: выбрать', jibOut: 'Стаксель: травить',
    kiteHoist: 'Ставим генакер…', kiteUp: 'Генакер работает', kiteDrop: 'Убираем генакер…',
    r20: 'Место для поворота у препятствия', x20: 'Идя в бейдевинд и упираясь в препятствие, лодка может окликнуть и попросить место для поворота; окликнутая должна повернуть или дать место.',
    hail20: 'Место для поворота!', exonerated: 'Тебя вытолкнули чужим нарушением — без штрафа (правило 21)',
    barging: 'У судейского судна на старте места не положено — наветренная уступает',
    reef: 'Риф', reefStart: 'Берём риф…', reefDone: 'Риф взят — крен меньше', shakeStart: 'Отдаём риф…', shakeDone: 'Снова полный грот',
    jibBtn: 'J3', jibBig: 'J1', jibStart: 'Меняем стаксель…', jibDone: 'Новый стаксель поднят', zero: 'Код 0',
    kiteHoistZ: 'Раскатываем код-зеро…', kiteUpZ: 'Код-зеро работает', kiteDropZ: 'Скатываем код-зеро…',
    hailBtn: 'Окрик', youHail: (h) => `Ты: «${h}»`, hailNone: 'Окликать некого',
    prepU: 'Сегодня флаг U: в треугольнике у линии в последнюю минуту — дисквалификация (UFD)', prepB: 'Сегодня чёрный флаг: за линией в последнюю минуту — дисквалификация, даже при общем отзыве (BFD)',
    ufd: 'За линией в последнюю минуту под флагом U — дисквалификация (UFD)', bfd: 'За линией в последнюю минуту под чёрным флагом — дисквалификация (BFD)',
    genRecall: (f) => `Общий отзыв — слишком многие за линией. Старт повторяется${f === 'U' ? ', теперь под флагом U' : f === 'B' ? ', теперь под чёрным флагом' : ''}`,
    finishedStartDsq: 'Финиш — но дисквалификация на старте', flagU: 'Флаг U', flagB: 'Чёрный', flagSub: 'Отзыв',
    dStartDsq: (f) => (f === 'U' ? 'Дисквалификация на старте (флаг U)' : 'Дисквалификация на старте (чёрный флаг)'), tipStartDsq: 'Под флагом U или чёрным флагом всю последнюю минуту держись ниже линии.',
    'r18.3': 'Поворот в зоне', 'r18.4': 'Фордевинд у знака', r19: 'Место у препятствия', rU: 'Флаг U', rB: 'Чёрный флаг',
    'x18.3': 'Лодка, сделавшая поворот на правый галс в зоне, не должна заставлять лодку, идущую правым галсом с входа в зону, идти выше бейдевинда, и даёт ей место, если та окажется внутри.',
    'x18.4': 'Внутренняя лодка с правом дороги, которой нужно сделать фордевинд у знака, не уходит от него дальше, чем требует её надлежащий курс.',
    x19: 'Проходя препятствие связанными (судейское судно — не на старте и финише), внешняя лодка даёт внутренней место.',
    'hail18.3': 'Ты повернул в зоне — уходи!', 'hail18.4': 'Фордевинд — не шире, чем нужно!', hail19: 'Место у судейского судна!',
    pb: (s) => `Твой рекорд на этой дистанции: ${s}`, pbNew: 'Новый личный рекорд!', pbToday: (s) => `Твой лучший результат сегодня: ${s}`, todayTop: 'Самые быстрые сегодня', guest: 'Без имени',
    cSteer: 'Руль: веди левым пальцем по дуге', cSheet: 'Шкот: правым пальцем вверх — выбрать паруса, вниз — потравить',
    cLine: 'Иди к линии и пересеки её сразу после сигнала', cHeader: 'Ветер зашёл — жми «Поворот»', cMark: 'Огибай знак, оставляя его слева',
    cKite: 'Уваливайся и жми «Генакер»', cGate: 'Пройди между двумя знаками ворот', cFinish: 'Теперь пересеки линию — финиш',
    wind: 'Ветер', light: 'Слабый · 7 уз', medium: 'Средний · 12 уз', strong: 'Сильный · 19 уз', laps: 'Круги', sails: 'Паруса',
    manual: 'Сам', auto: 'Авто', sound: 'Звук', voiceK: 'Голос', on: 'Вкл', off: 'Выкл', startK: 'Старт', m1: '1 мин', m3: '3 мин', m5: '5 мин',
    fleetK: 'Лодок', lengthK: 'Дистанция', lShort: 'Короткая', lMedium: 'Средняя', lLong: 'Длинная',
    currentK: 'Течение', guidesK: 'Подсказки', gfx: 'Графика', gAuto: 'Авто', gHigh: 'Высокая', gMedium: 'Средняя', gLow: 'Низкая', gsHigh: 'Макс.', gsMedium: 'Сред.', gsLow: 'Мин.', gfxNow: (q) => `Графика · сейчас ${q.toLowerCase()}`, start: 'Начать гонку', resume: 'Продолжить', restart: 'Заново',
    how1: '<b>Левый палец</b> рулит по дуге. <b>Правый</b> работает шкотом: вверх выбрать, вниз потравить. Колдунчики должны быть зелёными.',
    how2: '<b>Поворот</b> — оверштаг через ветер (на полных курсах — <b>фордевинд</b>). <b>Генакер</b> — для попутного ветра; постановка и уборка занимают у экипажа несколько секунд, так что убирай его заранее, до ворот. В порыве трави шкот, пока крен не стал слишком большим; в сильный ветер <b>Риф</b> уменьшает грот. Перед стартом приведись и потрави шкот до конца — лодка остановится или даже пойдёт назад.',
    how3: 'Старт после сигнала — флаг класса спущен. Фальстарт — вернись за линию. Верхний знак огибают, <b>оставляя его слева</b>; финиш — через линию.',
    how5: 'Вокруг лодки: <b>стрелка</b> — откуда дует ветер; <b>красное</b> — слишком остро к ветру, идти нельзя; <b>зелёные</b> метки — лучший угол на ветер; <b>синие</b> — лучший угол по ветру. Ветер гуляет на десять с лишним градусов в обе стороны каждую минуту-другую: когда он <b>отходит</b>, можно идти круче, когда <b>заходит</b> — поворачивай.',
    how4: 'Правила: левый галс уступает правому, наветренная — подветренной, догоняющая — идущей впереди; у верхнего знака места не требует никто, левый галс уступает правому; у ворот — <b>зона</b> (пунктирный круг, три корпуса): если лодки связаны, когда первая в неё входит, место получает внутренняя, если не связаны — идущая впереди. Столкнулся, когда должен был уступить, или задел знак — штрафной оборот: поворот оверштаг и фордевинд. Лодка, только что получившая право дороги, сначала даёт место, а лодка с правом дороги не может резко поворачивать на ту, что уступает.',
    rotate: 'Поверните телефон горизонтально.', back: '← Назад в Sailing Certification Test',
    flagCls: 'Класс', flagP: 'Подгот.', flagX: 'Отзыв', kn: 'уз', drone: 'Дрон', helm: 'Штурвал', top: 'Сверху', tack: 'Поворот', gybe: 'Фордевинд', kite: 'Генакер', in: 'Выбрать', out: 'Травить',
    ok: 'Паруса в норме', pullIn: 'Выбери шкот', easeOut: 'Потрави шкот', irons: 'Левентик',
    startIn: 'Старт', lineStart: 'Линия старта', mark: 'Верхний знак', wing: 'Боковой знак', gate: 'Нижние ворота', finish: 'Финиш',
    roundedTri: 'Знак пройден — уваливайся на галфвинд к боковому знаку', roundedWing: 'Боковой знак пройден — поворот фордевинд на бакштаг',
    seaBreeze: 'Сегодня бриз — он будет усиливаться и отходить вправо', kiteWrap: 'Генакер закрутился на повороте — его надо убрать', kiteGybed: 'Генакер переброшен',
    crashGybe: 'Самопроизвольный фордевинд! Слишком далеко на ветер с кормы — гик перелетел', deathRoll: 'Брочинг на ветер! С генакером на «неправильном» борту — её положило и привело',
    byLee: (d) => `Ветер с подветра ${d}° — поворачивай или приводись`, foot: 'Мало скорости — уваливайся на пару градусов, разгонись', waveTip: 'Волна: приводись на склон, уваливайся с гребня', ocsS: 'Фальстарт — вернись за линию',
    target: 'цель', vmg: 'VMG', line: 'линия', toLine: 'до линии', favPin: 'выгоднее у знака', favBoat: 'выгоднее у судна', square: 'линия ровная',
    sigWarn: (n) => `Предупредительный сигнал — флаг класса, ${n} мин`, sigPrep: (n, f = 'P') => `Подготовительный — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]}, ${n} мин`, sig1: (n, f = 'P') => `Одна минута — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]} спущен`, gun: 'Старт! Флаг класса спущен',
    ocs: 'Фальстарт! Флаг X — вернись за линию', cleared: 'Теперь стартуй', started: 'Отличный старт!', rounded: 'Знак пройден — уваливайся, ставь генакер',
    missedLine: 'Мимо линии — пересеки её между судейским судном и знаком', missedGate: 'Мимо ворот — вернись и пройди между двумя знаками', wrongSide: 'Знак оставляют слева — обогни его снова',
    gateMsg: 'Ворота пройдены — снова на ветер', bump: 'Столкновение!', aground: 'На мели! Уходите от берега', broach: 'Брочинг! Трави шкот', kitedown: 'Слишком остро — генакер убирают в спешке',
    heelMsg: 'Сильный крен — потрави шкот', ironsMsg: 'Левентик — уваливайся', gust: 'Порыв!', autoOff: 'Автоподбор выключен — шкот твой',
    hail10: 'Правый галс!', hail11: 'Наветренная, уходи!', hail12: 'Сзади, уходи!', hail13: 'Ты в повороте — уходи!', hail18: 'Место у знака!', hail44: 'Штрафник, уходи!',
    fouled: (w, r) => `Нарушение против ${w} (правило ${r}) — штрафной оборот: оверштаг и фордевинд`, theyFouled: (w, r) => `${w}: нарушение правила ${r}, штрафные обороты`,
    touched: 'Касание знака — штрафной оборот: оверштаг и фордевинд', penaltyDone: 'Штраф выполнен', pen: (tk, gy) => `Штраф: ${tk ? '✓' : '○'} оверштаг ${gy ? '✓' : '○'} фордевинд`,
    dirty: 'Грязный ветер', surf: 'Сёрфинг!', lift: (d) => `Ветер отошёл ${d}°`, header: (d) => `Ветер зашёл ${d}° — поворот?`,
    zIn: (n) => `Зона · связаны с ${n}, ты внутри — тебе дают место`, zOut: (n) => `Зона · связаны с ${n}, ты снаружи — дай место`,
    zAhead: (n) => `Зона · не связаны, ты впереди ${n} — тебе дают место`, zAstern: (n) => `Зона · не связаны, ты позади ${n} — держись в стороне`, tackCall: 'К повороту оверштаг… Поворот!', gybeCall: 'К повороту фордевинд… Поворот!',
    results: 'Результаты', again: 'Ещё гонку', menu: 'Меню', racing: 'в гонке…', you: 'Вы', dsq: 'DSQ',
    gfxDown: (q) => `Графика: «${q}» — для плавности`, place: (n) => `${n}-е`, finished: (n) => `Финиш: ${n}-е место!`, finishedDsq: 'Финиш без штрафа — дисквалификация (DSQ)',
  },
};
const urlLang = new URLSearchParams(location.search).get('lang');
const cookieLang = (document.cookie.match(/(?:^|; )lang=(en|ru)\b/) || [])[1];
const LANG = urlLang === 'ru' || urlLang === 'en' ? urlLang : cookieLang ? cookieLang
  : /^(ru|uk|be|kk)\b/i.test((TG && TG.initDataUnsafe?.user?.language_code) || navigator.language || '') ? 'ru' : 'en';
const t = (k, ...a) => { const v = T[LANG][k] ?? T.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
const fmt = (s) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

// ---------- the app's light and night themes ----------
const night = () => (TG ? TG.colorScheme === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
let COL = {};
function applyTheme() {
  document.documentElement.classList.toggle('theme-night', night());
  const cs = getComputedStyle(document.getElementById('hud')), v = (k) => cs.getPropertyValue(k).trim(); // the minimap draws in the HUD's own colours
  COL = { ink: v('--ink'), muted: v('--muted'), faint: v('--faint'), accent: v('--accent'), danger: v('--danger'), bg: v('--bg') };
  try { TG && TG.setHeaderColor && TG.setHeaderColor(night() ? '#000000' : '#ffffff'); } catch (e) {}
}
applyTheme();
if (!TG && window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- settings ----------
const opts = { mode: 'daily', preset: 'medium', fleet: 5, length: 'short', laps: 1, autoTrim: 0, sound: 1, voice: 1, start: 1, current: 0, course: 'wl', gfx: 'auto', guides: 1, played: 0 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('regatta') || '{}')); } catch (e) {}
delete opts.undefined; // left by an older pause menu, whose quick switches also ran the menu's choice handler
if (opts.fleetV !== 3) { opts.fleet = 5; opts.fleetV = 3; } // the default changed (10, then 7): start everyone on 5 once
if (opts.optsV !== 4) { opts.length = 'short'; opts.mode = 'daily'; opts.optsV = 4; } // a short race, today's, is the default now
const saveOpts = () => { try { localStorage.setItem('regatta', JSON.stringify(opts)); } catch (e) {} };
// the race's settings: the menu's, or in today's race the day's own (the same for everyone)
const DAILY_KEYS = ['preset', 'fleet', 'length', 'laps', 'start', 'current', 'course'];
const settings = () => { if (opts.mode !== 'daily') return { ...opts, daily: null }; const d = dailyRace(); return { ...opts, ...d, daily: d.day }; };
const windName = (p) => t(p);
const paintOpts = () => {
  const s = settings();
  document.querySelectorAll('.choice[data-opt]').forEach((g) => {
    g.classList.toggle('locked', opts.mode === 'daily' && DAILY_KEYS.includes(g.dataset.opt));
    g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(s[g.dataset.opt]) === b.dataset.v));
  });
  const n = $('#dailyNote'); if (n) { n.hidden = opts.mode !== 'daily'; n.textContent = t('dailyNote', windName(s.preset), venueById(s.venue).name[LANG === 'ru' ? 1 : 0]); }
};
// a third way to trim: the main and the jib each on their own sheet
{ const g = document.querySelector('.choice[data-opt="autoTrim"]'); if (g && !g.querySelector('[data-v="2"]')) { const b = document.createElement('button'); b.dataset.v = '2'; b.innerHTML = t('split'); g.append(b); } }
paintOpts();
for (const g of document.querySelectorAll('.choice[data-opt]')) {
  const k = g.dataset.opt;
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (opts.mode === 'daily' && DAILY_KEYS.includes(k)) { Object.assign(opts, Object.fromEntries(DAILY_KEYS.map((x) => [x, settings()[x]]))); opts.mode = 'free'; } // changing today's settings makes it a free race
    opts[k] = k === 'preset' || k === 'gfx' || k === 'length' || k === 'mode' || k === 'course' ? b.dataset.v : +b.dataset.v; paintOpts(); saveOpts();
    // today's race is at the day's venue, a free race where the set-up chose: another venue's land needs the page loaded again
    if (k === 'mode' && !new URLSearchParams(location.search).get('venue') && (opts.mode === 'daily' ? dailyRace().venue : venueById(opts.venue).id) !== VENUE.id) { location.href = '/play?race=' + (opts.mode === 'daily' ? 'today' : 'free'); return; }
    if (k === 'gfx') { world.setQuality(startQuality()); perf.settle = 2; }
    if (k === 'guides') world.showGuides = !!opts.guides;
    if (k === 'sound') audio.setOn(!!opts.sound);
    if (k === 'autoTrim' && race && running) applyTrimMode();
    if (k === 'preset' || k === 'laps' || k === 'start' || k === 'current' || k === 'mode' || k === 'fleet' || k === 'length' || k === 'course') { if (!running) newRace(); else menuChanged = true; }
  });
}

// ---------- Telegram ----------
if (TG) {
  TG.ready(); TG.expand();
  try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && /android|iphone|ipad/i.test(navigator.userAgent)) TG.requestFullscreen(); } catch (e) {}
  TG.onEvent && TG.onEvent('themeChanged', () => applyTheme());
  TG.BackButton.show();
  TG.BackButton.onClick(() => { if (running && !paused) pause(); else location.href = HUB; });
}
const haptic = (kind) => {
  if (opts.vibration === 0) return; // Settings › Vibration
  if (!TG && navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // the browser refuses before the first tap
  try { if (TG && TG.HapticFeedback) kind === 'warn' ? TG.HapticFeedback.notificationOccurred('warning') : TG.HapticFeedback.impactOccurred(kind || 'light'); else navigator.vibrate && navigator.vibrate(kind === 'heavy' ? 40 : 15); } catch (e) {}
};

// ---------- sound: wind, water, flapping sails, winch, horns, voices ----------
const audio = {
  ctx: null, on: !!opts.sound,
  noise(ctx) {
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  chain(type, freq, q) {
    const src = this.ctx.createBufferSource(); src.buffer = this.buf; src.loop = true; src.loopStart = Math.random();
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master); src.start();
    return g;
  },
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.buf = this.noise(this.ctx);
      this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(this.ctx.destination);
      this.windG = this.chain('lowpass', 500); this.waterG = this.chain('bandpass', 1500, 0.6); this.flapG = this.chain('bandpass', 320, 1.2);
    } catch (e) { this.ctx = null; }
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 1 : 0; if (!v && window.speechSynthesis) speechSynthesis.cancel(); if (!v) { skipper.stop(); asides.stop(); } },
  set(g, v, tc = 0.25) { if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); },
  update(P, paused) {
    if (!this.ctx) return;
    const k = paused ? 0 : 1;
    this.set(this.windG, k * Math.min(0.45, 0.03 + P.aws / 80));
    this.set(this.waterG, k * Math.min(0.35, P.v / 22 + (P.surf > 0 ? 0.1 : 0)));
    const flog = P.trim === 'irons' ? 1 : P.luff;
    this.set(this.flapG, k * flog * (Math.random() < 0.45 ? 0.55 : 0.04), 0.012); // a sail flogging cracks
  },
  tone(freq, dur, type = 'sine', vol = 0.25) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), n = this.ctx.currentTime;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(vol, n + 0.02); g.gain.setValueAtTime(vol, n + dur - 0.05); g.gain.linearRampToValueAtTime(0, n + dur);
    o.connect(g).connect(this.master); o.start(n); o.stop(n + dur + 0.02);
  },
  horn(long) { const d = long ? 2.2 : 1.0; this.tone(233, d, 'sawtooth', 0.12); this.tone(466, d, 'square', 0.035); },
  click() { // a winch pawl
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(), n = this.ctx.currentTime;
    s.buffer = this.buf; f.type = 'highpass'; f.frequency.value = 3500; g.gain.setValueAtTime(0.25, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.03);
    s.connect(f).connect(g).connect(this.master); s.start(n, Math.random(), 0.04);
  },
  say(text, from) { // from: another boat, spoken in her skipper's own pitch, and her own voice where there are several
    if (!this.on || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace('…', ', '));
      u.lang = LANG === 'ru' ? 'ru-RU' : 'en-GB'; u.rate = 1.1; u.volume = 0.9;
      if (from) {
        const v = crews.voice(from), list = speechSynthesis.getVoices().filter((x) => x.lang.slice(0, 2) === LANG);
        u.pitch = v.pitch; u.rate = 1.1 * Math.sqrt(v.rate);
        if (list.length > 1) u.voice = list[v.n % list.length];
      }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  },
};

// ---------- the skipper: recorded voices on board ----------
// In Russian, a skipper from Odessa who shouts at the crew when they've earned it; in English, a crew's racing calls: the
// hails, protest, bear away, and the count down to the gun. Each language's lines are in one file, skipper-<lang>.mp3,
// loaded once the race starts. He says one line at a time, and not every time he could: half the time he lets a moment
// go, and after a line he keeps quiet for twenty seconds or more. He doesn't repeat a line within a few minutes, and of
// the lines that fit he picks at random, likelier the longer since he said it; a call that must be heard now (a hail,
// the count) cuts in.
const VOICES = { ru: {
  // where each line sits in skipper-ru.mp3: [start, length] in seconds
  clips: {
    // on the boat
    hands: [0.6, 3.772], // Руки убрал! Это шкот, а не твоя личная жизнь!
    ease1: [4.972, 2.861], // Трави, блядь! Она сама не догадается!
    pull1: [8.433, 1.181], // Добирай!
    pull2: [10.214, 2.371], // Не уговаривай верёвку — тяни!
    hold: [13.185, 4.965], // Кто держит? Кто не держит? Почему вообще никто не держит?!
    tack1: [18.75, 4.416], // Поворот через три… два… да куда вы уже пошли?!
    tack2: [23.766, 4.131], // Готовься к повороту! Хотя нет, уже поздно — поворачиваем!
    ease2: [28.497, 3.43], // Шкот отдай! Не замуж же за него вышла!
    pull3: [32.527, 3.374], // Добери этот парус, он уже морально распустился!
    people: [36.501, 3.995], // Что ж вы за люди такие? Я же русским языком ору!
    column: [41.096, 3.41], // Не стой столбом, у нас тут гонка, а не экскурсия!
    feet: [45.106, 4.014], // Под ногами не мешайся. Лучше где-нибудь сбоку мешайся!
    clue: [49.72, 3.435], // Кто-нибудь, сделайте вид, что знает, что происходит!
    // at the start
    minute: [53.754, 4.256], // До старта минута! У нас есть время испортить всё красиво!
    push: [58.61, 2.348], // Не толкайся, мы и так идём не туда!
    plan: [61.558, 3.195], // Стартуем по плану. План, правда, никто не видел.
    where: [65.353, 3.251], // Линия старта где? Там, где сейчас чужая яхта?
    distance: [69.205, 3.115], // Держи дистанцию! Это гонка, а не знакомство!
    early: [72.92, 2.634], // Рано пошли! Зато уверенно!
    late: [76.153, 2.48], // Поздно пошли! Зато без суеты!
    ready: [79.233, 3.457], // Кто дал команду стартовать? Я ещё морально не готов!
    flag: [83.29, 5.04], // Смотрите на флаг! Хотя бы один из нас должен понимать, что он означает!
    clean: [88.93, 3.385], // Идём чисто! В смысле, пока никого не задели!
    // with feeling
    sank: [92.915, 4.239], // Что ж вы за люди такие? Что ж вы ботик потопили, гады?
    hands2: [97.754, 3.893], // Гадёныш, убери свои руки тупые, блядь! Бросай, брат!
    ease3: [102.248, 2.007], // Да трави ты, сучара тупая!
    pull4: [104.855, 3.157], // Я вас очень сильно матом прошу, доберите!
  },
  // the lines for each situation: most have a few that fit, so the same moment doesn't always get the same line
  pools: {
    pull: ['pull1', 'pull2', 'pull3', 'pull4', 'people'], // the sails flapping, the sheet left out
    ease: ['ease2', 'ease1', 'ease3'], // sheeted in too hard
    heel: ['ease1', 'ease2', 'ease3', 'hold'], // heeled over: ease!
    fiddle: ['hands', 'hands2'], // the sheet worked in and out, in and out
    chaos: ['hold', 'people', 'clue'], // a broach, a crash gybe, a death roll, a wrapped or collapsed kite
    tack: ['tack1', 'tack2'], // a tack or a gybe, now and then
    foul: ['people', 'clue'], // a foul, a touched mark, the wrong side of a mark, a missed gate
    slow: ['column', 'people', 'clue'], // stopped, or in irons, after the gun
    contact: ['feet', 'push', 'people'], // a collision after the start, or a boat that fouled us
    push: ['push', 'feet'], // a collision before the start
    lost: ['clue', 'people'], // a general recall, disqualified at the start
    aground: ['sank', 'clue'],
    plan: ['plan'], // the warning signal
    flag: ['flag', 'plan'], // the preparatory signal, and the U or black flag today
    minute: ['minute'], // the one-minute signal
    where: ['where', 'clue'], // far from the line near the gun, or across it outside the ends
    distance: ['distance', 'push'], // another boat a few metres off for a while, not touching
    early: ['early', 'ready'], // over early
    ready: ['ready', 'clean'], // across the line within three seconds of the gun
    clean: ['clean'], // a start without fuss, or the windward mark with no fouls
    late: ['late', 'column'], // across the line more than ten seconds after the gun
  },
}, en: {
  // a crew's racing calls in skipper-en.mp3, a man's and a woman's (g…), and the count to the gun: [start, length] in seconds
  clips: {
    starboard: [0.6, 0.744], // Starboard!
    keepClear: [1.944, 0.737], // Keep clear!
    port: [3.28, 2.301], // You're on port! We're on starboard!
    hold: [6.181, 1.038], // Hold your course!
    room: [7.819, 0.967], // Room at the mark!
    protest: [9.386, 0.785], // Protest!
    bearAway: [10.771, 0.852], // Bear away!
    go: [12.223, 1.107], // Go, go, go!
    n10: [13.929, 0.487], n9: [15.016, 0.565], n8: [16.182, 0.438], n7: [17.22, 0.568], n6: [18.388, 0.667], // Ten… six
    n5: [19.655, 0.506], n4: [20.76, 0.539], n3: [21.899, 0.545], n2: [23.044, 0.508], n1: [24.152, 0.506], // five… one
    start: [25.258, 2.019], // Start, start, start!
    g10: [27.877, 0.558], g9: [29.035, 0.656], g8: [30.291, 0.47], g7: [31.361, 0.686], g6: [32.647, 0.651], // her count
    g5: [33.898, 0.618], g4: [35.116, 0.599], g3: [36.315, 0.581], g2: [37.495, 0.512], g1: [38.607, 0.559],
    gStart: [39.766, 2.054], // Start, start, start!
    gStarboard: [42.42, 0.847], gKeepClear: [43.867, 0.806], gHold: [45.273, 1.005], // Starboard! Keep clear! Hold your course!
    gRoom: [46.878, 0.62], gMarkRoom: [48.098, 0.788], gRoomTack: [49.485, 0.963], // Room! Mark room! Room to tack!
    gProtest: [51.048, 0.827], gOverlap: [52.475, 0.696], gClearAhead: [53.771, 0.818], gClearAstern: [55.189, 0.932],
    gHeads: [56.721, 0.557], gTacking: [57.878, 0.775], gJibe: [59.253, 0.635], // Heads! Tacking! Jibe!
    gTrim: [60.487, 0.621], gEase: [61.708, 0.625], gBearAway: [62.933, 0.82], gHeadUp: [64.353, 0.598], // Trim! Ease! Bear away! Head up!
  },
  // the hails, by rule (the ones with no recording are still spoken by the browser), and the other calls
  pools: {
    hail10: ['starboard', 'port', 'gStarboard'], hail11: ['keepClear', 'gKeepClear'], hail12: ['keepClear', 'gKeepClear'],
    hail13: ['keepClear', 'gKeepClear'], hail15: ['keepClear', 'gKeepClear'], hail44: ['keepClear', 'gKeepClear'],
    'hail18.3': ['keepClear', 'gKeepClear'], hail16: ['hold', 'gHold'], hail17: ['hold', 'gHold'],
    hail18: ['room', 'gMarkRoom'], hail19: ['gRoom'], hail20: ['gRoomTack'],
    protest: ['protest', 'gProtest'], // a foul, ours or theirs
    bearAway: ['bearAway', 'gBearAway'], irons: ['bearAway', 'gBearAway'], // the windward mark rounded; in irons
    foot: ['gBearAway', 'bearAway'], // slow on the beat, pinching: foot off
    headUp: ['gHeadUp'], // well by the lee
    tackCall: ['gTacking'], gybeCall: ['gJibe', 'gHeads'], heads: ['gHeads'], // a tack, a gybe; a crash gybe
    pull: ['gTrim'], ease: ['gEase'], heel: ['gEase'], // the sheet left out, or in too hard; heeled over
    overlap: ['gOverlap'], clearAhead: ['gClearAhead'], clearAstern: ['gClearAstern'], // at the zone of a mark
    go: ['go'], // back below the line after being over early: now start
  },
} };
const skipper = {
  ...VOICES[LANG],
  buf: null, loading: false, src: null, speakTill: 0, busyTill: 0, last: {}, letGo: {},
  TALK: 0.5, // how often he says something when he could
  REST: 180, // seconds before he says a line again
  load() {
    if (!VOICES[LANG] || this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    fetch(new URL(`skipper-${LANG}.mp3`, import.meta.url)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
      .then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
  // a line for the situation; false when he keeps quiet (no sound, mid-line, a hail being spoken, said it lately).
  // A moment that won't come again (a signal, the start) needn't wait for his breath, only for the line he's saying.
  // Whether he speaks is rolled once for a moment: a situation he lets go (one the game asks about every frame, a sheet
  // left wrong, heeled over) isn't asked again for a while.
  shout(kind, chance = 1, now_ = false) {
    if (!this.buf || !audio.on || !opts.voice || paused || audio.ctx.state !== 'running') return false;
    const ctx = audio.ctx, now = ctx.currentTime;
    if (now < (now_ ? this.speakTill : this.busyTill) || now < (this.letGo[kind] ?? 0) || (window.speechSynthesis && speechSynthesis.speaking)) return false;
    const fresh = (this.pools[kind] || []).filter((k) => !(now - this.last[k] < this.REST));
    if (!fresh.length) return false;
    if (Math.random() > chance * this.TALK) { this.letGo[kind] = now + 10 + Math.random() * 15; return false; }
    const k = this.choose(fresh, now), len = this.play(k);
    this.last[k] = now; this.speakTill = now + len + 0.4; this.busyTill = now + len + 20 + Math.random() * 20;
    return true;
  },
  // one of the lines at random, a line he's never said or not said for long likelier than one he said lately
  choose(list, now) {
    const w = list.map((k) => (this.last[k] === undefined ? 1 : Math.min(1, 0.15 + (now - this.last[k]) / 600)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < list.length - 1 && (r -= w[i]) > 0) i++;
    return list[i];
  },
  // a call that has to be heard now (a hail, the count to the gun): no breath, no minute's rest, and it cuts in on a line
  cue(kind, from) {
    const list = this.pools[kind] || (this.clips[kind] ? [kind] : null);
    if (!list || !this.buf || !audio.on || !opts.voice || paused || audio.ctx.state !== 'running') return false;
    const now = audio.ctx.currentTime, k = from ? crews.pick(from, list) : this.choose(list, now), len = this.play(k, from);
    if (!from) this.last[k] = now;
    this.speakTill = now + len + 0.2; this.busyTill = Math.max(this.busyTill, now + len + 2);
    return true;
  },
  // the clips have silence round them in the file, and some decoders start an MP3 a few hundredths of a second late:
  // play a little either side, so a line never loses its first or last sound
  play(k, from) { // from: another boat, whose call comes from where she is, in her skipper's own voice (crews.say)
    if (from) { const r = crews.say(from, k, 0.9, true); this.stop(); this.src = r.src; return r.len; }
    const ctx = audio.ctx, [at, len] = this.clips[k], s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.9;
    s.buffer = this.buf; s.connect(g).connect(from ? crews.out(1, crews.place(from).pan * 0.7) : audio.master); s.start(ctx.currentTime, Math.max(0, at - 0.03), len + 0.09);
    this.stop(); this.src = s;
    return len;
  },
  stop() { try { this.src && this.src.stop(); } catch (e) {} this.src = null; },
  // the start signals and crossing the line, from the race's messages
  signal(key, ocs) {
    if (key === 'gun') { if (!ocs) this.cue(this.crew === 'g' ? 'gStart' : 'start'); return; }
    const k = { sigWarn: 'plan', sigPrep: 'flag', sig1: 'minute' }[key]; if (k) this.shout(k, 1, true);
  },
  // the count to the gun, in one voice all the way: in English the race's crew is his or hers, picked at the start
  count(n) { return this.cue(this.crew === 'g' ? 'g' + n : 'n' + n); },
  // a mark's zone, called once as it's reached: overlapped, or clear ahead or astern
  zones: new WeakSet(),
  zone(st, mine) { if (this.zones.has(st)) return; this.zones.add(st); this.cue(st.overlapped ? 'overlap' : mine ? 'clearAhead' : 'clearAstern'); },
  started(c) { this.shout(c < 3 ? 'ready' : c > 10 ? 'late' : 'clean', 1, true); },
  // what he watches for himself, every frame: a sheet left wrong, a sheet fiddled with, a boat stopped after the gun,
  // a boat too close, the line far off as the gun nears
  w: null,
  crew: 'm',
  reset() { this.stop(); this.crew = Math.random() < 0.5 ? 'm' : 'g'; this.w = { trim: '', t: 0, sheet: 0, dir: 0, rev: [], slowT: 0, nearT: 0 }; },
  watch(P, dt) {
    const w = this.w, c = race.clock;
    if (!this.buf || !w || P.done || P.pen || P.auto) return;
    // the sheet: pull in or ease out for three seconds straight
    const wrong = c > 5 && !P.autoTrim && (P.trim === 'in' || P.trim === 'out');
    w.t = wrong && P.trim === w.trim ? w.t + dt : 0; w.trim = P.trim;
    if (w.t > 3 && this.shout(P.trim === 'in' ? 'pull' : 'ease')) w.t = 0;
    // fiddling: six changes of direction on the sheet within four seconds
    const ds = P.sheet - w.sheet; w.sheet = P.sheet;
    if (!P.autoTrim && Math.abs(ds) > 0.004 && Math.sign(ds) !== w.dir) { w.dir = Math.sign(ds); w.rev.push(c); }
    while (w.rev.length && c - w.rev[0] > 4) w.rev.shift();
    if (w.rev.length >= 6 && this.shout('fiddle')) w.rev.length = 0;
    // after the gun, all but stopped for four seconds
    w.slowT = c > 3 && P.v / KN < 1.5 ? w.slowT + dt : 0;
    if (w.slowT > 4 && this.shout('slow')) w.slowT = 0;
    if (P.heel > 33) this.shout('heel');
    if (P.byLee > 8) this.shout('headUp');
    // another boat within a hull length and a half, not touching, for two seconds
    let near = 1e9; for (const b of race.boats) if (b !== P && !b.done) near = Math.min(near, Math.hypot(b.x - P.x, b.z - P.z));
    w.nearT = near < HULL * 1.4 && near > HULL * 0.5 ? w.nearT + dt : 0;
    if (w.nearT > 2 && this.shout('distance')) w.nearT = 0;
    // half a minute to the gun and still far from the line
    if (c > -30 && c < -10 && P.leg === 0 && -race.lineInfo(P).d > 80) this.shout('where');
  },
};

// ---------- the other crews: what you hear of a boat when you sail close to her ----------
// Within about seventy metres: her sails flogging and her winches in a tack or a gybe, her bow wave and wash, and her
// crew's calls in the game's language (under the Voice switch): in Russian the other skippers have a voice of their own,
// crews-ru.mp3, the same lines as ours said by another man; in English the voices of skipper-en.mp3. Each comes from
// where she is (left or right of where the camera looks), quieter and duller the further off she is.
const crews = {
  R: 70, // metres: out of earshot beyond
  calls: {
    ru: { tacking: ['tack1', 'tack2'], gybing: ['tack1', 'tack2'], tacked: ['pull1', 'pull2', 'pull3'], broach: ['hold', 'ease1'], crashGybe: ['hold', 'people'], deathRoll: ['hold', 'people'], kiteWrap: ['hold', 'clue'], kitedown: ['hold', 'column'] },
    en: { tacking: ['gTacking'], gybing: ['gJibe', 'gHeads'], tacked: ['gTrim'], broach: ['gEase'], crashGybe: ['gHeads'], deathRoll: ['gHeads'], kiteWrap: ['gHeads'], kitedown: ['gEase'] },
  },
  last: new WeakMap(), talkTill: 0, wash: null,
  // their own voice where there is one: the file, and where each line sits in it, [start, length] in seconds
  own: { ru: { file: 'crews-ru.mp3', clips: {
    hands: [0.08, 3.32], ease1: [3.62, 2.6], pull1: [6.4, 0.66], pull2: [7.3, 2.02], hold: [9.57, 3.85],
    tack1: [13.73, 3.67], tack2: [17.63, 3.84], ease2: [21.72, 2.75], pull3: [24.68, 2.97], people: [27.87, 3.37],
    column: [31.47, 2.98], feet: [34.67, 3.31], clue: [38.18, 3.12],
  } } },
  buf: null, loading: false,
  load() {
    const o = this.own[LANG]; if (!o || this.buf || this.loading || !audio.ctx) return;
    this.loading = true;
    fetch(new URL(o.file, import.meta.url)).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
      .then((b) => { this.buf = b; }, () => { this.loading = false; });
  },
  // where line k is to be had: { buf, at, len, own } in their own voice if it's loaded, else in ours; null if neither
  line(k) {
    const c = this.buf && this.own[LANG].clips[k];
    if (c) return { buf: this.buf, at: c[0], len: c[1], own: true };
    return skipper.buf && skipper.clips[k] ? { buf: skipper.buf, at: skipper.clips[k][0], len: skipper.clips[k][1], own: false } : null;
  },
  // a boat as heard from ours: near 1 alongside to 0 out of earshot, pan −1 left to 1 right of the camera's view
  place(b) {
    const P = race.player, dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz);
    const v = world.camera.getWorldDirection(this._v || (this._v = world.camera.position.clone())), r = Math.hypot(v.x, v.z) || 1;
    return { d, near: clamp(1 - d / this.R, 0, 1), pan: d < 1 ? 0 : clamp((dx * -v.z + dz * v.x) / r / d, -1, 1) };
  },
  // a way into the master: a gain, then a stereo panner where the browser has one
  out(gain, pan) {
    const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = gain;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan * 0.85; g.connect(p).connect(audio.master); } else g.connect(audio.master);
    return g;
  },
  // one of her events (sim.js): the sound of it, and her crew's call
  hear(b, e) {
    if (!audio.ctx || !audio.on || paused || audio.ctx.state !== 'running') return;
    const { near, pan } = this.place(b); if (near <= 0) return;
    const v = near * near, ctx = audio.ctx, now = ctx.currentTime;
    if (e === 'tacking' || e === 'gybing') { this.flog(v, pan, 1.6); this.winch(v, pan, 1.5); }
    const list = (this.calls[LANG] || {})[e];
    if (!list || !(this.buf || skipper.buf) || !opts.voice || now < this.talkTill || now < skipper.speakTill || now - (this.last.get(b) ?? -1e9) < 10) return;
    const { len } = this.say(b, this.pick(b, list), 0.8 * Math.max(v, 0.08));
    this.last.set(b, now); this.talkTill = now + len + 1.5;
  },
  // Each other boat's skipper has a voice of their own: the same recordings, played lower and slower or higher and
  // quicker (never at our own pitch), darker or brighter; in Russian the other man's, half as far from his own pitch
  // so he's still himself; in English the man or the woman of skipper-en.mp3 at her helm. The browser's speech, where
  // it speaks for her, takes her pitch too (audio.say).
  voices: new WeakMap(),
  RATES: [0.84, 1.12, 0.9, 1.17, 0.8, 1.07, 0.94, 1.14, 0.87, 1.1],
  voice(b) {
    let v = this.voices.get(b);
    if (!v) {
      const n = Math.max(0, race.boats.indexOf(b)), rate = this.RATES[n % this.RATES.length];
      v = { n, rate, tone: [-5, 4, -2, 6, -6, 2][n % 6], woman: n % 2 === 1, pitch: clamp(0.55 + (rate - 0.8) * 2.4, 0.5, 1.6) };
      this.voices.set(b, v);
    }
    return v;
  },
  // a line from the list in her voice: in English, her helm's (the woman's clips are the g… ones)
  pick(b, list) {
    const w = this.voice(b).woman, mine = LANG === 'en' ? list.filter((k) => /^g[A-Z0-9]/.test(k) === w) : list;
    const from = mine.length ? mine : list;
    return from[Math.floor(Math.random() * from.length)];
  },
  // play line k as boat b's skipper says it, from where she is: { src, len } (len in seconds as heard)
  say(b, k, gain, hail) {
    const ctx = audio.ctx, ln = this.line(k), v = this.voice(b), { near, pan } = this.place(b);
    const { at, len } = ln, rate = ln.own ? 1 + (v.rate - 1) / 2 : v.rate;
    const s = ctx.createBufferSource(), sh = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    s.buffer = ln.buf; s.playbackRate.value = rate;
    sh.type = 'highshelf'; sh.frequency.value = 2200; sh.gain.value = v.tone;
    lp.type = 'lowpass'; lp.frequency.value = (hail ? 3000 : 1500) + 6000 * near; // across the water a voice loses its top; a hail is shouted
    s.connect(sh).connect(lp).connect(this.out(gain, pan * (hail ? 0.7 : 1)));
    s.start(ctx.currentTime, Math.max(0, at - 0.03), len + 0.09); // the duration is the file's, whatever the rate
    return { src: s, len: len / rate };
  },
  // sails flogging through the wind: noise in cracks, dying away
  flog(v, pan, dur) {
    if (v < 0.01) return;
    const ctx = audio.ctx, n = ctx.currentTime + 0.15, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = audio.buf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 1.2; g.gain.value = 0;
    for (let t = 0; t < dur; t += 0.04) g.gain.setValueAtTime((Math.random() < 0.45 ? 0.5 : 0.04) * v * (1 - t / dur), n + t);
    g.gain.setValueAtTime(0, n + dur);
    s.connect(f).connect(g).connect(this.out(1, pan)); s.start(n - 0.15, Math.random()); s.stop(n + dur + 0.05);
  },
  // the new sheet ground in on a winch: a run of pawl clicks
  winch(v, pan, delay) {
    if (v < 0.02) return;
    const ctx = audio.ctx, o = this.out(1, pan);
    for (let i = 0, t = ctx.currentTime + delay; i < 9; i++, t += 0.08 + Math.random() * 0.04) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = audio.buf; f.type = 'highpass'; f.frequency.value = 3500; g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      s.connect(f).connect(g).connect(o); s.start(t, Math.random(), 0.04);
    }
  },
  // every frame: the nearest boat's bow wave and wash, while she's within forty metres
  update(P, still) {
    if (!audio.ctx) return;
    if (!this.wash) {
      const ctx = audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      s.buffer = audio.buf; s.loop = true; s.loopStart = Math.random(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7; g.gain.value = 0;
      s.connect(f).connect(g); if (p) g.connect(p).connect(audio.master); else g.connect(audio.master); s.start();
      this.wash = { g, p };
    }
    let best = null, bd = 40;
    if (!still) for (const b of race.boats) if (b !== P) { const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < bd) { bd = d; best = b; } }
    const ctx = audio.ctx, k = best ? (1 - bd / 40) ** 2 * Math.min(1, best.v / 5) * 0.3 : 0;
    this.wash.g.gain.setTargetAtTime(k, ctx.currentTime, 0.3);
    if (best && this.wash.p) this.wash.p.pan.setTargetAtTime(this.place(best).pan * 0.85, ctx.currentTime, 0.2);
  },
};

// ---------- the gulls you hear, and the crew's asides ----------
// The gulls (wildlife.js) call now and then, and cry when a boat puts one up off the water: a cry made here, from where
// the gull is, quieter and duller the further off (under Sound, like the wind and the water). In the Russian game the
// crew has two asides of their own, each a file of its own and under the Voice switch: after another boat hails us,
// «Шо он орёт, я всё равно ничего не понимаю»; and when we put a gull up, «О, смотри, чайка полетела. Главное, на кита
// не наехать». An aside waits for the skipper to finish his line, and he waits for it.
// A herring gull's voice. Each note is a stack of harmonics on a fundamental near 1 kHz, loudest from the second to the
// fourth, that sweeps up fast and slides down slower, darkening as it falls. What makes it a gull and not a whistle is
// the rasp: the voice catching on half its pitch (a subharmonic), a pitch that never quite holds still, and breath.
// She has three calls: the mew, one long plaintive "kee-aaw"; the long call, a drawn note, then a run of "kyow"s
// quickening and falling away, then a few slower "kau"s (the seaside laugh); and, put up in alarm, a sharp "kyow!"
// and a hard, low "ga-ga-ga". Plays into dest from t; returns when she's done.
function gullCall(ctx, dest, t, n, alarm, vol, pitch = 0.9 + Math.random() * 0.2) {
  const G = gullCall, rnd = (a, b) => a + Math.random() * (b - a);
  if (G.ctx !== ctx) {
    G.ctx = ctx;
    const N = 20, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let k = 1; k <= N; k++) im[k] = (k === 1 ? 0.55 : Math.exp(-((k - 3) ** 2) / 6) + 0.5 / k) * (k % 2 ? 1 : -1);
    G.wave = ctx.createPeriodicWave(re, im);
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    G.noise = nb;
    G.curve = new Float32Array(1024).map((_, i) => Math.tanh(2.2 * (i / 511.5 - 1)) / Math.tanh(2.2));
  }
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = G.noise; s.loop = true; return s; };
  // one note: dur s, a → b (its peak, reached at rise of the way through, held to hold) → c Hz; h the rasp, br the breath
  const note = ({ dur, a, b, c, rise, hold, h, br }, v, f) => {
    const s = pitch * f * rnd(0.97, 1.03);
    const sweep = (p, k) => {
      p.setValueAtTime(a * s * k, t); p.exponentialRampToValueAtTime(b * s * k, t + dur * rise);
      p.linearRampToValueAtTime(b * s * k * 0.97, t + dur * hold); p.exponentialRampToValueAtTime(c * s * k, t + dur);
    };
    const o = ctx.createOscillator(), sub = ctx.createOscillator(), am = ctx.createGain(), subG = ctx.createGain();
    const sh = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), env = ctx.createGain();
    o.setPeriodicWave(G.wave); sweep(o.frequency, 1); sweep(sub.frequency, 0.5);
    am.gain.value = 1 - h; subG.gain.value = h; sub.connect(subG).connect(am.gain); // the voice breaking on half its pitch
    const jit = noise(), jl = ctx.createBiquadFilter(), jg = ctx.createGain(), sg = ctx.createGain(); // and never quite holding it
    jl.type = 'lowpass'; jl.frequency.value = 300; jg.gain.value = 220 + 300 * h; sg.gain.value = 0.8 + 2 * h; // cents, and a shimmer
    jit.connect(jl).connect(jg); jg.connect(o.detune); jg.connect(sub.detune); jl.connect(sg).connect(am.gain);
    sh.curve = G.curve;
    lp.type = 'lowpass'; lp.Q.value = 0.7; sweep(lp.frequency, 4.2);
    const air = noise(), ab = ctx.createBiquadFilter(), ag = ctx.createGain(); // breath through the bill
    ab.type = 'bandpass'; ab.Q.value = 1.3; sweep(ab.frequency, 2.6); ag.gain.value = br;
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(v, t + Math.min(0.015, dur * 0.15));
    env.gain.setValueAtTime(v, t + dur * rise); env.gain.linearRampToValueAtTime(v * 0.8, t + dur * hold); env.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(am).connect(sh).connect(lp).connect(env); air.connect(ab).connect(ag).connect(env); env.connect(dest);
    const off = rnd(0, 1.8), end = t + dur + 0.03;
    for (const x of [o, sub]) { x.start(t); x.stop(end); }
    for (const x of [jit, air]) { x.start(t, off); x.stop(end); }
    t += dur;
  };
  const MEW = { a: 850, b: 1150, c: 780, rise: 0.35, hold: 0.65, h: 0.15, br: 0.14 };
  const DRAWN = { a: 720, b: 1050, c: 800, rise: 0.4, hold: 0.7, h: 0.3, br: 0.16 };
  const KYOW = { a: 950, b: 1300, c: 980, rise: 0.3, hold: 0.65, h: 0.35, br: 0.12 };
  const KAU = { a: 900, b: 1080, c: 820, rise: 0.3, hold: 0.6, h: 0.45, br: 0.14 };
  const GAG = { a: 650, b: 720, c: 560, rise: 0.3, hold: 0.5, h: 0.6, br: 0.2 };
  if (alarm) {
    note({ ...KYOW, dur: rnd(0.16, 0.2), h: 0.5 }, vol, 1.08); t += rnd(0.07, 0.11);
    const k = n + 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) { note({ ...GAG, dur: rnd(0.075, 0.1) }, vol * (1 - i * 0.06), 1 - i * 0.01); t += rnd(0.09, 0.14); }
  } else if (n === 1) note({ ...MEW, dur: rnd(0.5, 0.75) }, vol * 0.9, 1);
  else if (n === 2) for (let i = 0; i < 2; i++) { note({ ...KYOW, dur: rnd(0.19, 0.24) }, vol, 1 - i * 0.03); t += rnd(0.18, 0.28); }
  else {
    note({ ...DRAWN, dur: rnd(0.4, 0.5) }, vol * 0.85, 1); t += rnd(0.1, 0.14);
    const k = n + 3;
    for (let i = 0; i < k; i++) {
      note({ ...KYOW, dur: rnd(0.22, 0.27) * (1 - i * 0.03) }, vol * (i < 3 ? 1 : 1 - (i - 2) * 0.07), 1 + (i < 2 ? i * 0.02 : 0.04 - i * 0.02));
      t += 0.12 - i * (0.05 / k) + rnd(-0.01, 0.01);
    }
    t += 0.06;
    const m = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < m; i++) { note({ ...KAU, dur: rnd(0.16, 0.2) }, vol * (0.7 - i * 0.12), 0.92 - i * 0.03); t += rnd(0.11, 0.15); }
  }
  return t;
}

const asides = {
  R: 120, // metres: a gull beyond is out of earshot
  files: { ru: { sho: 'crew-ru-sho.mp3', gull: 'crew-ru-gull.mp3' } },
  buf: {}, loading: {}, last: {}, raced: {}, pend: null, cryTill: 0,
  load() {
    const files = this.files[LANG]; if (!files || !audio.ctx) return;
    for (const [k, f] of Object.entries(files)) {
      if (this.buf[k] || this.loading[k]) continue;
      this.loading[k] = true;
      fetch(new URL(f, import.meta.url)).then((r) => r.arrayBuffer())
        .then((b) => new Promise((res, rej) => audio.ctx.decodeAudioData(b, res, rej)))
        .then((b) => { this.buf[k] = b; }, () => { this.loading[k] = false; });
    }
  },
  reset() { this.stop(); this.pend = null; this.raced = {}; },
  stop() { try { this.src && this.src.stop(); } catch (e) {} this.src = null; },
  live() { return audio.ctx && audio.on && !paused && audio.ctx.state === 'running'; },
  // after another boat's hail, now and then: what's he on about?
  hail() {
    if (!this.buf.sho || !opts.voice || this.pend) return;
    const now = audio.ctx.currentTime;
    if (now - (this.last.sho ?? -1e9) < 180 || Math.random() > 0.4) return;
    this.pend = { k: 'sho', at: Math.max(now, skipper.speakTill) + 0.5, until: now + 6 };
  },
  // a line now; false when it can't be heard
  say(k) {
    const b = this.buf[k]; if (!b || !this.live() || !opts.voice) return false;
    const ctx = audio.ctx, now = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.9;
    s.buffer = b; s.connect(g).connect(audio.master); s.start(now); this.stop(); this.src = s;
    this.last[k] = now; skipper.speakTill = Math.max(skipper.speakTill, now + b.duration + 0.4); skipper.busyTill = Math.max(skipper.busyTill, now + b.duration + 6);
    return true;
  },
  // a gull's cry, from where she is: quieter, duller and a touch later the further off, with the sea's echo under it
  cry(p, n, alarm) {
    const ctx = audio.ctx, pl = crews.place(p), d = Math.hypot(pl.d, p.y || 0), near = clamp(1 - d / this.R, 0, 1);
    if (near <= 0) return;
    const v = near * near, out = crews.out(1, pl.pan), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200 + 8000 * near; lp.Q.value = 0.5; lp.connect(out);
    const echo = ctx.createDelay(0.5), eg = ctx.createGain(), el = ctx.createBiquadFilter(); // off the water and the hulls round about
    echo.delayTime.value = 0.05 + 0.12 * (1 - near); eg.gain.value = 0.18 + 0.2 * (1 - near); el.type = 'lowpass'; el.frequency.value = 2600;
    lp.connect(echo).connect(el).connect(eg).connect(out);
    const t0 = ctx.currentTime + 0.03 + Math.random() * 0.08 + d / 343;
    const end = gullCall(ctx, lp, t0, n, alarm, 0.55 * Math.max(v, 0.03));
    setTimeout(() => { try { lp.disconnect(); eg.disconnect(); } catch (e) {} }, (end - ctx.currentTime + 1) * 1000);
    this.cryTill = end + 1.5 + Math.random() * 3;
  },
  // every frame: what the gulls did, and a waiting aside
  update() {
    const ev = world.wild && world.wild.events; if (!ev) return;
    const can = this.live() && race && !race.over;
    if (can) {
      const now = audio.ctx.currentTime;
      for (const e of ev) {
        if (e.type === 'call' && (e.alarm || now >= this.cryTill)) this.cry(e.p, e.n, e.alarm);
        // we put one up: a look, once a race
        if (e.type === 'up' && e.player && this.buf.gull && opts.voice && !this.raced.gull && !this.pend && Math.random() < 0.7) {
          this.raced.gull = true; this.pend = { k: 'gull', at: now + 0.8, until: now + 5 };
        }
      }
    }
    ev.length = 0;
    const pd = this.pend; if (!pd || !can) return;
    const now = audio.ctx.currentTime;
    if (now > pd.until) { this.pend = null; return; } // the moment has passed
    if (now < pd.at || now < skipper.speakTill || (window.speechSynthesis && speechSynthesis.speaking)) return;
    this.say(pd.k); this.pend = null;
  },
};

// ---------- the world ----------
const canvas = $('#gl');
let world;
try { world = new World(canvas); } catch (e) {
  document.body.innerHTML = '<p style="padding:24px;font-size:18px">This game needs WebGL, which this browser or device doesn\'t offer.</p>';
  throw e;
}
const resize = () => world.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', resize); resize();
// Auto remembers a step down as 'medium|<when>' for three days, then tries the device's own level again: one slow
// race (another tab busy, a hot phone) shouldn't keep the picture down for good. A bare level from before is retried now.
const GFX_KEY = 'regatta-gfx', GFX_DAYS = 3;
function startQuality() {
  if (opts.gfx !== 'auto') return opts.gfx;
  try {
    const [q, at] = (localStorage.getItem(GFX_KEY) || '').split('|');
    if (q && Date.now() - at < GFX_DAYS * 864e5) return q;
    localStorage.removeItem(GFX_KEY);
  } catch (e) {}
  return defaultQuality();
}
world.setQuality(startQuality());
world.showGuides = !!opts.guides;
// Auto: watch the frame rate while racing; under 45 fps, step down a level and remember it for this device
const perf = { t: 0, n: 0, settle: 3 };
function watchFps(raw) {
  if (opts.gfx !== 'auto' || world.quality === 'low') return;
  if (perf.settle > 0) { perf.settle -= raw; return; }
  perf.t += raw; perf.n++;
  if (perf.t < 3) return;
  const fps = perf.n / perf.t; perf.t = perf.n = 0;
  if (fps >= 45) return;
  const q = world.quality === 'high' ? 'medium' : 'low';
  world.setQuality(q); perf.settle = 2;
  try { localStorage.setItem(GFX_KEY, `${q}|${Date.now()}`); } catch (e) {}
  toast(t('gfxDown', t(q === 'medium' ? 'gMedium' : 'gLow')), 2.5);
}

let race = null, running = false, paused = false, menuChanged = false, hints = {}, lastClockInt = null, coachSeen = {};
function newRace() {
  const s = settings();
  race = new Race({ preset: s.preset, laps: s.laps, autoTrim: opts.autoTrim === 1, start: s.start, current: !!s.current, fleet: s.fleet, length: s.length, course: s.course, seed: s.daily ? s.seed : undefined });
  race.settings = s;
  race.player.name = t('you');
  world.setRace(race);
  world.resetView();
  hints = {}; lastClockInt = null; coachSeen = {}; skipper.reset(); asides.reset();
}
newRace();

// ---------- controls ----------
const input = { rudderHeld: false, rudder: 0, keys: {}, lastSheet: 0 };
const rz = $('#rudderZone');
let rudderPtr = null, rudderX0 = 0;
rz.addEventListener('pointerdown', (e) => {
  rudderPtr = e.pointerId; rudderX0 = e.clientX - input.rudder * 80; input.rudderHeld = true;
  rz.setPointerCapture(e.pointerId); race.player.auto = null; e.preventDefault();
});
rz.addEventListener('pointermove', (e) => { if (e.pointerId === rudderPtr) input.rudder = clamp((e.clientX - rudderX0) / 80, -1, 1); });
const rudderUp = (e) => { if (e.pointerId === rudderPtr) { rudderPtr = null; input.rudderHeld = false; } };
rz.addEventListener('pointerup', rudderUp); rz.addEventListener('pointercancel', rudderUp);

const sz = $('#sheetZone'), sheetEl = $('#sheet');
let sheetPtr = null, sheetWhich = 'main';
// Main + jib: the jib gets its own slider, to the left of the main's (built here, styled like it, white knob)
const jibEl = sheetEl.cloneNode(true); jibEl.id = 'jibSheet'; sheetEl.before(jibEl);
const jibKnob = jibEl.querySelector('.knob'), jibBand = jibEl.querySelector('.band');
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #jibSheet { position: relative; width: 24px; height: calc(100% - 22px); border-radius: 54px; background: var(--glass); border: 2px solid var(--tag-line); margin-right: 30px; display: none; }
  #jibSheet .band { position: absolute; left: 2px; right: 2px; background: color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 54px; }
  #jibSheet .knob { position: absolute; left: -10px; width: 40px; height: 20px; border-radius: 54px; background: #fff; border: 2px solid var(--accent); box-shadow: 0 2px 6px rgba(0,0,0,.3); transform: translateY(-50%); }
  #jibSheet .cap { position: absolute; left: 50%; transform: translateX(-50%); font-family: var(--sans); font-size: 11px; font-weight: 700; white-space: nowrap; text-transform: uppercase; letter-spacing: .02em; }
  #jibSheet .cap.t { top: -19px; } #jibSheet .cap.b { bottom: -19px; }
  #sheetZone.split, #hud #sheetZone.split { width: 124px; } #sheetZone.split #jibSheet { display: block; }
  #hud.split-trim #tackBtn, #hud.split-trim #kiteBtn { right: calc(136px + var(--sr)); } /* moved over for the second slider */
  #hud #jibSheet { width: 18px; border-width: 1.5px; margin-right: 26px; } #hud #jibSheet .knob { left: -8px; width: 30px; height: 16px; border-width: 1.5px; box-shadow: none; } #hud #jibSheet .cap { font-size: 10px; }` }));
// the Sails setting on the player's boat: 0 one sheet, 1 auto-trim, 2 main and jib apart
function applyTrimMode() {
  const P = race && race.player; if (!P) return;
  P.autoTrim = opts.autoTrim === 1; P.split = opts.autoTrim === 2;
  if (P.split) P.jibSheet = P.sheet;
  sz.classList.toggle('split', P.split); hud.classList.toggle('split-trim', P.split);
  sheetEl.querySelector('.cap.t').innerHTML = t(P.split ? 'mainCap' : 'in');
  jibEl.querySelector('.cap.t').innerHTML = t('jibCap');
}
// in Main + jib, a thumb works whichever slider it lands nearer
const pickSheet = (x) => {
  if (!race.player.split) return 'main';
  const a = jibEl.getBoundingClientRect(), b = sheetEl.getBoundingClientRect();
  return Math.abs(x - (a.left + a.width / 2)) < Math.abs(x - (b.left + b.width / 2)) ? 'jib' : 'main';
};
const autoOff = () => {
  if (!race.player.autoTrim) return;
  race.player.autoTrim = false; opts.autoTrim = 0; saveOpts(); paintOpts(); toast(t('autoOff'));
};
const setSheet = (v) => {
  const P = race.player; v = clamp(v, 0, 1);
  if (v < input.lastSheet - 0.012) { audio.click(); input.lastSheet = v; } // trimming in: the winch clicks
  else if (v > input.lastSheet) input.lastSheet = v;
  if (sheetWhich === 'jib') P.jibSheet = v; else P.sheet = v;
};
const setSheetFrom = (y) => { const r = (sheetWhich === 'jib' ? jibEl : sheetEl).getBoundingClientRect(); setSheet((y - r.top) / r.height); };
sz.addEventListener('pointerdown', (e) => { sheetPtr = e.pointerId; sz.setPointerCapture(e.pointerId); autoOff(); sheetWhich = pickSheet(e.clientX); input.lastSheet = sheetWhich === 'jib' ? race.player.jibSheet : race.player.sheet; setSheetFrom(e.clientY); e.preventDefault(); });
sz.addEventListener('pointermove', (e) => { if (e.pointerId === sheetPtr) setSheetFrom(e.clientY); });
const sheetUp = (e) => { if (e.pointerId === sheetPtr) sheetPtr = null; };
sz.addEventListener('pointerup', sheetUp); sz.addEventListener('pointercancel', sheetUp);

const tackBtn = $('#tackBtn'), kiteBtn = $('#kiteBtn');
const doTack = () => { if (!running || paused) return; race.player.tackOrGybe(); haptic('medium'); };
// the kite: a tap starts the crew hoisting it (or getting it down); a tap during a hoist calls it off
const doKite = () => {
  if (!running || paused) return;
  const P = race.player, j = P.kiteJob;
  if (j) { if (j.up && P.setKite(false)) haptic('light'); return; }
  if (P.kite) { if (P.setKite(false)) haptic('light'); return; }
  const type = kiteKind(P);
  if (type && P.setKite(true, type)) haptic('light');
};
// which sail the Kite button sets now: the gennaker running, a code zero reaching in light air (below 15 knots)
const kiteKind = (P) => { const a = Math.abs(P.twa) / D2R; return a > 100 ? 'gen' : a > 60 && P.tws < 15 ? 'zero' : null; };
// the reef: a button above the kite's, shown in a breeze; a tap starts the crew tying a reef in (or shaking it out)
const reefBtn = kiteBtn.cloneNode(true); reefBtn.id = 'reefBtn'; reefBtn.classList.remove('on'); reefBtn.innerHTML = t('reef'); kiteBtn.after(reefBtn);
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #reefBtn { right: calc(94px + var(--sr)); bottom: calc(166px + var(--sb)); width: 56px; height: 56px; font-size: 10px; }
  #hud #reefBtn { right: calc(76px + var(--sr)); bottom: calc(136px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud.split-trim #reefBtn { right: calc(136px + var(--sr)); }
  #reefBtn.on { background: var(--accent); color: var(--on-accent); } #reefBtn[hidden] { display: none; }` }));
const doReef = () => { if (!running || paused) return; const P = race.player; if (!P.reefJob && P.setReef(!P.reef)) haptic('light'); };
// the jib: in a breeze, a button to change to the J3 (or back to the J1); and the hail, shown when there's something
// to hail for — room to tack, or a boat that must keep clear of you and is on her way into you
const jibBtn = reefBtn.cloneNode(true); jibBtn.id = 'jibBtn'; reefBtn.after(jibBtn);
const hailBtn = reefBtn.cloneNode(true); hailBtn.id = 'hailBtn'; hailBtn.innerHTML = t('hailBtn'); jibBtn.after(hailBtn);
document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #jibBtn { right: calc(94px + var(--sr)); bottom: calc(234px + var(--sb)); width: 56px; height: 56px; font-size: 10px; }
  #hailBtn { right: calc(94px + var(--sr)); bottom: calc(302px + var(--sb)); width: 56px; height: 56px; font-size: 10px; background: var(--warn); color: #1a1200; border-color: var(--warn); }
  #hud #jibBtn { right: calc(76px + var(--sr)); bottom: calc(190px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud #hailBtn { right: calc(76px + var(--sr)); bottom: calc(244px + var(--sb)); width: 46px; height: 46px; font-size: 9px; }
  #hud.split-trim #jibBtn, #hud.split-trim #hailBtn { right: calc(136px + var(--sr)); }
  #jibBtn[hidden], #hailBtn[hidden] { display: none; }
  .flag.U { background: conic-gradient(#d22 0 25%, #fff 0 50%, #d22 0 75%, #fff 0); }
  .flag.B { background: #111; }
  .flag.sub { background: #f2c230; clip-path: polygon(0 0, 100% 50%, 0 100%); box-shadow: inset 0 0 0 4px #1f4fa8; }` }));
const doJib = () => { if (!running || paused) return; const P = race.player; if (!P.jibJob && P.setJib(!P.smallJib)) haptic('light'); };
const doHail = () => {
  if (!running || paused) return;
  const h = race.youCanHail();
  race.hail(); haptic('medium');
  if (!h) toast(t('hailNone'), 1.4);
};
jibBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doJib(); });
hailBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doHail(); });
reefBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doReef(); });
tackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doTack(); });
kiteBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doKite(); });

// camera: one finger on the water orbits (drone) or looks around (helm); two fingers pinch to zoom
const ptrs = new Map();
let pinch0 = 0, lastTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
  const now = performance.now(); if (now - lastTap < 300 && ptrs.size === 1) world.resetView(); lastTap = now;
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) world.drag(e.clientX - p.x);
  else if (ptrs.size === 2) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0) world.zoom(pinch0 / d); pinch0 = d;
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
});
const ptrUp = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', ptrUp); canvas.addEventListener('pointercancel', ptrUp);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); world.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
// + / − buttons: a step per tap, repeating while held
for (const [id, f] of [['#zoomIn', 1 / 1.06], ['#zoomOut', 1.06]]) {
  const b = $(id); let timer = null;
  const stop = () => { clearInterval(timer); timer = null; };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); world.zoom(f ** 3); stop(); timer = setInterval(() => world.zoom(f), 40); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
}

// game speed: the race runs 1×, 1.5×, 2× or 3× as fast (more fixed steps a frame, so the sailing is the same; times
// are in race seconds, so results don't change)
const SPEEDS = [1, 1.5, 2, 3], speedBtn = $('#speedBtn');
let timeScale = 1;
const cycleSpeed = () => {
  timeScale = SPEEDS[(SPEEDS.indexOf(timeScale) + 1) % SPEEDS.length];
  speedBtn.textContent = `${timeScale}×`; speedBtn.classList.toggle('fast', timeScale > 1); haptic('light');
};
speedBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); cycleSpeed(); });

// keyboard, for a computer: ←/→ steer, ↑/↓ sheet, space tack, K kite, T game speed, X/C/V drone/top/helm view, A/Z zoom in/out, Esc pause
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); doTack(); }
  if (e.code === 'KeyK') doKite();
  if (e.code === 'KeyT') cycleSpeed();
  if (e.code === 'KeyH') toast(hudNext.toggle() ? 'HUD: next' : 'HUD: old', 1.2);
  if (e.code === 'KeyA') world.zoom(1 / 1.12); // held down, the key repeats: a smooth zoom
  if (e.code === 'KeyZ') world.zoom(1.12);
  const view = { KeyX: 'drone', KeyC: 'top', KeyV: 'helm' }[e.code]; // in the order of the buttons
  if (view) setCam(view);
  if (e.code === 'Escape' || e.code === 'KeyP') { if (running) paused ? resume() : pause(); }
  if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) autoOff();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

const camSeg = $('#camSeg');
function setCam(m) { world.mode = m; camSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.cam === m)); }
camSeg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setCam(b.dataset.cam); });
setCam(['drone', 'top', 'helm'].includes(opts.camera) ? opts.camera : 'drone'); // Settings › First camera
// the lighter HUD, the default: ?hud=old brings back the old one (and keeps it), ?hud=next returns; H switches while sailing
const hudNext = createHudNext({ t, LANG, fmt, world, getRace: () => race, setCam });

// ---------- menus ----------
const menu = $('#menu'), results = $('#results'), hud = $('#hud');
if (!opts.played) $('#howD').open = true; // how to play: open until the first race
function startRace() {
  audio.init(); audio.setOn(!!opts.sound); skipper.load(); crews.load(); asides.load();
  const day = dailyRace();
  // a new day: a new daily race, and at another venue its land needs the page loaded again
  if (race.settings.daily && race.settings.daily !== day.day && day.venue !== VENUE.id && !new URLSearchParams(location.search).get('venue')) { location.href = '/play?race=today'; return; }
  if (running || menuChanged || race.over || (race.settings.daily && race.settings.daily !== day.day)) newRace();
  menuChanged = false;
  opts.played = (opts.played || 0) + 1; saveOpts();
  race.coach = opts.played <= 3; // the first three races: tips as you go
  menu.hidden = true; results.hidden = true; hud.hidden = false;
  running = true; paused = false;
  applyTrimMode();
  setCam(world.mode);
  raceStarted(race, race.settings); // counted for the admins' Overview and the leaderboards (stats.js)
}
// ---------- pause: the race stays in view; resume, change the race, restart or leave (each of the last three asks first) ----------
const pauseEl = $('#pauseCard'), confirmEl = $('#confirmCard');
// the voice on board (the skipper in Russian, the crew's calls in English) has a switch of its own, next to Sound;
// off, the hails are spoken by the browser again and the count to the gun beeps (Settings › Voice on board too)
{ const s = pauseEl.querySelector('[data-q="sound"]'); if (s) { const b = s.cloneNode(); b.dataset.q = 'voice'; delete b.dataset.t; b.innerHTML = t('voiceK'); s.after(b); s.parentNode.style.flexWrap = 'wrap'; } }
const ordL = (n) => (LANG === 'ru' ? `${n}-е` : ord(n));
function paintPause() {
  const P = race.player, legs = race.course.legs, n = legs.length - 1, leg = Math.min(n, Math.max(1, P.leg));
  const place = race.standings().indexOf(P) + 1, L = race.log;
  $('#pLeg').textContent = t('legOf', leg, n);
  $('#pLegs').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i + 1 < leg ? 'done' : i + 1 === leg ? 'now' : ''}"></i>`).join('');
  const nx = legs[P.leg];
  $('#pNext').textContent = P.leg < legs.length ? t('nextK', t(legName[nx])) : '';
  $('#pNext').classList.toggle('mark', nx === 'mark' || nx === 'wing' || nx === 'gate'); // as its tag on the water
  $('#pPen').parentNode.className = L.penT > 1 ? 'pen' : 'clean';
  $('.p-esc').innerHTML = `<kbd>Esc</kbd>${t('resume')}`;
  $('#pPlace').textContent = ordL(place); $('#pOf').textContent = t('ofN', race.boats.length);
  $('#pTime').textContent = fmt(Math.max(0, race.clock));
  $('#pPen').textContent = L.penT > 1 ? `${Math.round(L.penT)} s` : '0'; $('#pPenD').textContent = L.penT > 1 ? t('penS') : t('penNone');
  for (const b of pauseEl.querySelectorAll('[data-q]')) b.classList.toggle('on', b.dataset.q === 'autoTrim' ? opts.autoTrim === 1 : !!opts[b.dataset.q]);
  // graphics: the choice, and on Auto the level it has settled on for this device
  for (const b of pauseEl.querySelectorAll('[data-g]')) b.setAttribute('aria-checked', String(b.dataset.g === opts.gfx));
  $('#pGfxK').textContent = opts.gfx === 'auto' ? t('gfxNow', t({ high: 'gHigh', medium: 'gMedium', low: 'gLow' }[world.quality] || 'gHigh')) : t('gfx');
}
function pause() { if (!running || race.over) return; paused = true; paintPause(); pauseEl.hidden = false; confirmEl.hidden = true; }
function resume() { paused = false; pauseEl.hidden = true; confirmEl.hidden = true; }
let confirmDo = null;
function ask(action) {
  const P = race.player, place = race.standings().indexOf(P) + 1, leg = Math.max(1, P.leg);
  $('#cTxt').textContent = t('leaveTxt', LANG === 'ru' ? place : ord(place), leg);
  $('#cGo').textContent = t({ restart: 'doRestart', change: 'doChange', leave: 'doLeave' }[action]);
  confirmDo = action; pauseEl.hidden = true; confirmEl.hidden = false;
}
$('#pResume').addEventListener('click', resume);
$('#pChange').addEventListener('click', () => ask('change'));
$('#pRestart').addEventListener('click', () => ask('restart'));
$('#pLeave').addEventListener('click', () => ask('leave'));
$('#cKeep').addEventListener('click', () => { confirmEl.hidden = true; pauseEl.hidden = false; });
$('#cGo').addEventListener('click', () => {
  if (confirmDo === 'restart') { confirmEl.hidden = true; paused = false; running = false; newRace(); startRace(); return; }
  location.href = confirmDo === 'change' ? '/race/free' : HUB;
});
pauseEl.addEventListener('click', (e) => {
  const g = e.target.closest('[data-g]');
  if (g) { opts.gfx = g.dataset.g; saveOpts(); world.setQuality(startQuality()); perf.settle = 2; paintOpts(); paintPause(); return; } // as the menu's Graphics does
  const b = e.target.closest('[data-q]'); if (!b) return;
  const k = b.dataset.q;
  if (k === 'autoTrim') { opts.autoTrim = opts.autoTrim === 1 ? 0 : 1; applyTrimMode(); }
  else opts[k] = opts[k] ? 0 : 1;
  if (k === 'sound') audio.setOn(!!opts.sound);
  if (k === 'voice' && !opts.voice) { skipper.stop(); asides.stop(); asides.pend = null; }
  if (k === 'guides') world.showGuides = !!opts.guides;
  saveOpts(); paintPause();
});
$('#goBtn').addEventListener('click', startRace);
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', pause);
$('#againBtn').addEventListener('click', () => { running = false; newRace(); startRace(); });
$('#menuBtn').addEventListener('click', () => { running = false; paused = false; newRace(); results.hidden = true; hud.hidden = true; menu.hidden = false; $('#resumeBtn').hidden = true; $('#goBtn').textContent = t('start'); });
$('#backLink').href = HUB;

// ---------- the race to sail: from the address (the hub and the set-up page are Next.js pages) ----------
{
  const want = new URLSearchParams(location.search).get('race');
  opts.mode = want === 'free' ? 'free' : 'daily';
  paintOpts(); // the menu as this race has it (the note on today's race, its place and wind)
  menu.hidden = true; menuChanged = true;
  // the preloader in play/index.html has counted the files in; the scene is built, so it fills its bar and fades into the race
  // …once the shaders are compiled too (world.prepare), so the first frame of the race doesn't stall
  world.ready().then(() => {
    if (window.rycLoader) window.rycLoader.done(startRace);
    else { $('#loading').hidden = true; startRace(); }
  });
}


// ---------- instruments ----------
const el = { spd: $('#spd'), perf: $('#perf'), status: $('#status'), trim: $('#trim'), trimTxt: $('#trimTxt'), knob: $('#rudderKnob'), band: $('#sheet .band'), sknob: $('#sheet .knob'),
  toast: $('#toast'), count: $('#count'), flags: $('#flags'), chips: $('#chips') };
let toastT = 0;
const txt = (e, s) => { if (e._t !== s) { e._t = s; e.textContent = s; } }; // write the DOM only when the text changes
function toast(msg, secs = 2.4) { txt(el.toast, msg); el.toast.classList.add('show'); toastT = secs; }
function hint(key, msg, every = 12) { const n = race.clock; if (hints[key] && n - hints[key] < every) return; hints[key] = n; toast(msg); }

const legName = { start: 'lineStart', mark: 'mark', wing: 'wing', gate: 'gate', finish: 'finish' };
let flagsKey = '', chipsKey = '';
function updateHud(dt) {
  const P = race.player, a = Math.abs(P.twa) / D2R, awa = Math.abs(P.awa) / D2R, c = race.course;
  const kn = P.v / KN;
  txt(el.spd, kn.toFixed(1));
  el.trim.dataset.s = P.trim;
  el.trim.hidden = P.trim === 'ok'; // the chip only when there's something to do
  txt(el.trimTxt, t(P.trimSail === 'jib' && (P.trim === 'in' || P.trim === 'out') ? (P.trim === 'in' ? 'jibIn' : 'jibOut') : { ok: 'ok', in: 'pullIn', out: 'easeOut', irons: 'irons' }[P.trim]));
  const ang = P.rudder * 70 * D2R; el.knob.setAttribute('cx', (105 + Math.sin(ang) * 84).toFixed(1)); el.knob.setAttribute('cy', (104 - Math.cos(ang) * 84).toFixed(1));
  const tol = 7 / 77, lo = clamp(sheetFor(idealSail(awa)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(awa) + P.depower) + tol, 0, 1);
  el.band.style.top = `${lo * 100}%`; el.band.style.height = `${(hi - lo) * 100}%`;
  el.band.style.display = a < 28 ? 'none' : '';
  el.sknob.style.top = `${P.sheet * 100}%`;
  if (P.split) { jibKnob.style.top = `${P.jibSheet * 100}%`; jibBand.style.top = el.band.style.top; jibBand.style.height = el.band.style.height; jibBand.style.display = el.band.style.display; }
  sz.classList.toggle('auto', P.autoTrim);
  txt(tackBtn, t(a > 95 ? 'gybe' : 'tack'));
  tackBtn.classList.toggle('down', !!P.auto);
  const kk = P.kite || P.kiteJob ? P.kiteType : kiteKind(P);
  kiteBtn.hidden = !(kk || P.kite || P.kiteJob) || race.clock < 0;
  if (kiteBtn.dataset.k !== kk) { kiteBtn.dataset.k = kk; txt(kiteBtn, t(kk === 'zero' ? 'zero' : 'kite')); }
  kiteBtn.classList.toggle('on', P.kiteJob ? P.kiteJob.up : P.kite);
  kiteBtn.style.opacity = P.kiteJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : ''; // the crew at work: it pulses
  reefBtn.hidden = !(race.wind.p.tws >= 15 || P.reef || P.reefJob);
  reefBtn.classList.toggle('on', P.reefJob ? P.reefJob.on : P.reef);
  reefBtn.style.opacity = P.reefJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : '';
  jibBtn.hidden = !(race.wind.p.tws >= 15 || P.smallJib || P.jibJob);
  const jl = t((P.jibJob ? P.jibJob.small : P.smallJib) ? 'jibBig' : 'jibBtn'); if (jibBtn.textContent !== jl) txt(jibBtn, jl); // what a tap changes to
  jibBtn.style.opacity = P.jibJob ? (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))).toFixed(2) : '';
  hailBtn.hidden = !race.youCanHail();

  // status and the line below it
  const leg = c.legs[P.leg];
  el.status.classList.toggle('bad', P.ocs);
  el.status.style.display = race.clock < 0 && !P.ocs ? 'none' : ''; // before the start the big countdown says it
  let perf = '';
  if (P.ocs) txt(el.status, t('ocsS'));
  else if (race.clock < 0) {
    txt(el.status, `${t('startIn')} ${fmt(-race.clock + 0.999)}`);
    // distance to the line, time to get there at this speed, and the favoured end
    const li = race.lineInfo(P), close = (Math.sin(P.h) * c.normal.x - Math.cos(P.h) * c.normal.z) * P.v;
    const ux = Math.sin(race.wind.dir()), uz = -Math.cos(race.wind.dir());
    const fav = (c.pin.x - c.committee.x) * ux + (c.pin.z - c.committee.z) * uz;
    perf = `${t('line')} ${Math.max(0, -li.d).toFixed(0)} m` + (close > 0.3 && li.d < 0 ? ` · ${fmt(-li.d / close)} ${t('toLine')}` : '') + ` · ${Math.abs(fav) < 4 ? t('square') : fav > 0 ? t('favPin') : t('favBoat')}`;
  } else if (P.done) txt(el.status, P.dsq ? `${t('dsq')} · ${fmt(P.finish)}` : `${t('place', P.place)} · ${fmt(P.finish)}`);
  else {
    const place = race.standings().indexOf(P) + 1, d = race.distToNext(P);
    txt(el.status, `${fmt(race.clock)} · ${t(legName[leg])} ${Math.round(d)} m · ${t('place', place)}`);
  }
  if (race.clock >= 0 && !P.done) {
    const m = race.nextMark(P), brg = Math.atan2(m.x - P.x, -(m.z - P.z));
    const vmg = kn * Math.cos(wrap(brg - P.h)), pct = P.polar > 0.5 ? Math.round((kn / P.polar) * 100) : 0;
    perf = `${t('target')} ${P.polar.toFixed(1)} · ${pct}% · ${t('vmg')} ${vmg.toFixed(1)}`;
  }
  txt(el.perf, perf);

  // the committee boat's flags
  const fk = `${race.flags.cls}${race.flags.P}${race.flags.X}${race.flags.sub}${race.prepFlag}`;
  if (fk !== flagsKey) {
    flagsKey = fk;
    const fig = (cls, inner, cap) => `<figure><i class="flag ${cls}">${inner}</i><figcaption>${t(cap)}</figcaption></figure>`;
    const pf = race.prepFlag || 'P'; // the preparatory flag: P, U or black
    el.flags.innerHTML = (race.flags.sub ? fig('sub', '', 'flagSub') : '') + (race.flags.cls ? fig('cls', 'R', 'flagCls') : '') + (race.flags.P ? fig(pf, '', { P: 'flagP', U: 'flagU', B: 'flagB' }[pf]) : '') + (race.flags.X ? fig('X', '', 'flagX') : '');
  }
  // chips: penalty, dirty air, surfing
  const chips = [];
  if (P.pen) chips.push(['bad', t('pen', P.pen.tack, P.pen.gybe), 'pen']);
  if (P.shadow > 0.08) chips.push(['warn', `${t('dirty')} −${Math.round(P.shadow * 100)}%`, 'dirty']);
  if (P.surf > 0) chips.push(['ok', t('surf'), 'surf']);
  if (P.byLee > 3) chips.push([P.byLee > 8 ? 'bad' : 'warn', t('byLee', Math.round(P.byLee)), 'byLee']);
  // on the beat, the wind's swing against its middle: a lift (she can point higher) or a header (time to tack)
  if (race.clock >= 0 && !P.done && !P.auto && a < 70) {
    const s = Math.round(((P.twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean())) / D2R);
    if (s >= 4) chips.push(['ok', t('lift', s), 'shift']); else if (s <= -4) chips.push(['warn', t('header', -s), 'shift']);
  }
  // mark-room: who gets it was settled when the first of you reached the zone
  let zs = null, zd = 1e9;
  for (const st of race.zoneStates.values()) {
    if (st.p !== P && st.q !== P) continue;
    const o = st.p === P ? st.q : st.p, d = Math.hypot(o.x - P.x, o.z - P.z);
    if (d < zd) { zd = d; zs = { st, o }; }
  }
  if (zs && zd < 60) {
    const mine = zs.st.entitled === P, n = zs.o.name;
    chips.push([mine ? 'ok' : 'warn', zs.st.overlapped ? t(mine ? 'zIn' : 'zOut', n) : t(mine ? 'zAhead' : 'zAstern', n), 'zone']);
    skipper.zone(zs.st, mine);
  }
  if (hudNext.on) chips.length = Math.min(chips.length, 2); // the lighter HUD: the two that matter most
  const ck = chips.map((x) => x.join()).join('|');
  if (hudNext.on) { hudNext.chips(chips); chipsKey = ''; } // it updates them in place, in and out smoothly
  else if (ck !== chipsKey) { chipsKey = ck; el.chips.innerHTML = chips.map(([k, s]) => `<span class="chip ${k}">${s}</span>`).join(''); }

  const left = -race.clock;
  // the countdown to the start, large all the way, and huge for the last ten seconds
  txt(el.count, race.clock < 0 ? (left <= 10 ? String(Math.ceil(left)) : fmt(left + 0.999)) : '');
  el.count.classList.toggle('final', race.clock < 0 && left <= 10);
  const ci = Math.ceil(-race.clock);
  if (race.clock < 0 && ci !== lastClockInt) {
    if (lastClockInt !== null && ci <= 10 && ci > 0) { if (!skipper.count(ci)) audio.tone(ci <= 3 ? 1046 : 880, 0.12); if (ci <= 3) haptic('light'); } // the count: a voice, or beeps
    lastClockInt = ci;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }
  audio.update(P, paused); crews.update(P, paused); asides.update();
  if (race.coach) coach(P, a, leg);
  skipper.watch(P, dt);
  hudNext.update(P, dt);
}
// the first races: a tip when it's needed, each once a race
function coach(P, a, leg) {
  const once = (k, cond) => { if (!cond || coachSeen[k] || toastT > 0.6) return; coachSeen[k] = 1; toast(t(k), 4.5); };
  const c = race.clock, s0 = race.seq[0].t, d = race.distToNext(P);
  once('cSteer', c > s0 + 3);
  once('cSheet', coachSeen.cSteer && c > s0 + 10 && !P.autoTrim);
  once('cLine', c > -32 && c < -5);
  const shift = (P.twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean()) / D2R;
  once('cHeader', c > 20 && leg === 'mark' && a < 70 && shift <= -5 && !P.auto);
  once('cMark', leg === 'mark' && d < 90);
  once('cKite', c > 0 && leg !== 'mark' && leg !== 'start' && a > 110 && !P.kite);
  once('cGate', leg === 'gate' && d < 90);
  once('cFinish', leg === 'finish' && d < 90);
}

// messages from the race and the boat
function handleMessages() {
  const P = race.player;
  for (const m of race.messages) {
    const a = m.arg || {};
    if (m.key === 'signal') {
      audio.horn(a.sound === 'long'); haptic(a.key === 'gun' ? 'heavy' : 'medium'); skipper.signal(a.key, P.ocs);
      if (a.key === 'gun' && P.ocs) continue;
      toast(t(a.key, Math.round(-a.t / 60), race.prepFlag), 3);
    } else if (m.key === 'finished' || m.key === 'finishedDsq' || m.key === 'finishedStartDsq') { race._fin = finishScene(race); raceFinished(race); toast(t(m.key, m.arg), 3); audio.horn(); haptic('heavy'); setTimeout(finishToPage, 2500); }
    else if (m.key === 'gate') toast(t('gateMsg'));
    else if (m.key === 'bump') { hint('bump', t('bump'), 3); haptic('heavy'); skipper.shout(race.clock < 0 ? 'push' : 'contact'); }
    else if (m.key === 'aground') { hint('aground', t('aground'), 3); haptic('heavy'); skipper.shout('aground'); }
    else if (m.key === 'hail') { const h = t('hail' + a.rule), who = race.boats.find((b) => b.name === a.who); toast(`${a.who}: “${h}”`, 2.2); if (!skipper.cue('hail' + a.rule, who)) audio.say(h, who); asides.hail(); haptic('warn'); }
    else if (m.key === 'youHail') { if (a.rule) { const h = t('hail' + a.rule); toast(t('youHail', h), 2); if (!skipper.cue('hail' + a.rule)) audio.say(h); } }
    else if (m.key === 'seaBreeze') toast(t('seaBreeze'), 5);
    else if (m.key === 'genRecall') { toast(t('genRecall', m.arg), 4); audio.horn(); audio.horn(); haptic('warn'); skipper.shout('lost'); }
    else if (m.key === 'prepU' || m.key === 'prepB' || m.key === 'ufd' || m.key === 'bfd') { toast(t(m.key), 4); if (m.key === 'prepU' || m.key === 'prepB') skipper.shout('flag', 1, true); if (m.key === 'ufd' || m.key === 'bfd') { haptic('warn'); skipper.shout('lost'); } }
    else if (m.key === 'fouled' || m.key === 'theyFouled') { toast(t(m.key, a.who, a.rule), 3.5); skipper.cue('protest') || skipper.shout(m.key === 'fouled' ? 'foul' : 'contact'); }
    else {
      toast(t(m.key), 2.6); if (m.key === 'ocs') { haptic('warn'); skipper.shout('early', 1, true); } if (m.key === 'rounded') haptic('medium');
      if (m.key === 'touched' || m.key === 'wrongSide' || m.key === 'missedGate') skipper.shout('foul');
      if (m.key === 'missedLine') skipper.shout('where', 1, true);
      if (m.key === 'started') skipper.started(race.clock);
      if (m.key === 'cleared') skipper.cue('go');
      if ((m.key === 'rounded' || m.key === 'roundedTri') && !skipper.cue('bearAway') && P.leg === 2 && !race.log.fouls.length) skipper.shout('clean'); // the windward mark, and nobody touched yet
    }
  }
  race.messages.length = 0;
  for (const e of P.events) {
    if (e === 'broach') { toast(t('broach')); haptic('heavy'); skipper.shout('chaos'); }
    if (e === 'kitedown') { toast(t('kitedown')); haptic('warn'); skipper.shout('chaos'); }
    if (e === 'kiteHoist' || e === 'kiteDrop' || e === 'kiteUp') toast(t(e + (P.kiteType === 'zero' ? 'Z' : '')), 1.8);
    if (e === 'reefStart' || e === 'reefDone' || e === 'shakeStart' || e === 'shakeDone' || e === 'jibStart' || e === 'jibDone') toast(t(e), 1.8);
    if (e === 'penaltyDone') toast(t('penaltyDone'));
    if (e === 'kiteWrap' || e === 'crashGybe' || e === 'deathRoll') { toast(t(e), 3); haptic(e === 'kiteWrap' ? 'warn' : 'heavy'); if (!(e === 'crashGybe' && skipper.cue('heads'))) skipper.shout('chaos'); }
    if (e === 'kiteGybed') toast(t('kiteGybed'), 1.4);
    // the call for a tack or a gybe: now and then the Russian skipper's own way, in English the crew's recorded call, else spoken
    if ((e === 'tacking' || e === 'gybing') && !(!P.pen && skipper.shout('tack', 0.35)) && !skipper.cue(e === 'tacking' ? 'tackCall' : 'gybeCall')) audio.say(t(e === 'tacking' ? 'tackCall' : 'gybeCall'));
  }
  P.events.length = 0;
  for (const b of race.boats) if (b !== P) { for (const e of b.events) crews.hear(b, e); b.events.length = 0; } // heard when close
  if (P.heel > 33) hint('heel', t('heelMsg'), 10);
  if (P.trim === 'irons' && P.v < 0.6 && !P.auto && !P.pen && race.clock > race.seq[0].t + 8) { hint('irons', t('ironsMsg'), 10); skipper.shout('irons'); }
  if (P.gust > 0.55) hint('gust', t('gust'), 15);
  // slow on the beat and pointing as if at full speed: foot to build it; in a seaway, steer the waves
  if (race.clock > 0 && !P.auto && !P.pen && P.trim !== 'irons' && P.stall > 2.5 && Math.abs(P.twa) / D2R < beatAngle(P.tws) + 3) { hint('foot', t('foot'), 30); skipper.shout('foot'); }
  if (race.clock > 20 && race.wind.p.waves >= 0.45 && Math.abs(P.twa) / D2R < 60 && P.waveRhythm < -0.15) hint('waves', t('waveTip'), 90);
}

// ---------- minimap ----------
const mini = $('#mini'), mctx = mini.getContext('2d');
mini.width = mini.height = 360; mctx.setTransform(1.5, 0, 0, 1.5, 0, 0); // drawn at 240, sharp at the bigger size
mini.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); mini.classList.toggle('big'); });
// the shore of Göcek bay (and the marinas' pontoons) where it comes into the map, in the map's faint ink; made once
// for each race and map size
let shore = { key: '' };
function shoreLayer(ox, oz, s, size) {
  const key = [race.at.x, race.at.z, ox, oz, s, size, COL.faint].join();
  if (shore.key === key) return shore.cv;
  const n = size * 2, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const x = cv.getContext('2d'), img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = race.roomAt((i / 2 - ox) / s, (j / 2 - oz) / s);
    img.data[(j * n + i) * 4 + 3] = r < 0 ? 255 : 0;
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = COL.faint; x.fillRect(0, 0, n, n);
  shore = { key, cv };
  return cv;
}
function drawMap(ctx, size, full) {
  const c = race.course, P = race.player, W = race.wind.dir();
  const hw = Math.max(150, c.len / 2 + 40, c.wing ? -c.wing.x / 2 + 60 : 0), x0 = -hw + (c.wing ? c.wing.x / 2 : 0), x1 = hw + (c.wing ? c.wing.x / 2 : 0), z0 = c.windward.z - 45, z1 = 140;
  const s = Math.min(size / (x1 - x0), size / (z1 - z0)), ox = size / 2 - ((x0 + x1) / 2) * s, oz = size / 2 - ((z0 + z1) / 2) * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(shoreLayer(ox, oz, s, size), 0, 0, size, size);
  if (!full) for (const g of race.wind.gusts) {
    ctx.globalAlpha = 0.16 * g.s / race.wind.p.gustStr * (g.k ?? Math.min(1, g.life / 6)); ctx.fillStyle = COL.accent;
    ctx.beginPath(); ctx.ellipse(X(g.x), Z(g.z), g.r * s, g.r * 1.35 * s, W, 0, 7); ctx.fill(); // longer down the wind than across
  }
  ctx.globalAlpha = 1;
  // laylines to the windward mark, for the wind and current now
  const leg = c.legs[P.leg];
  if (leg === 'mark' || full) {
    ctx.strokeStyle = COL.faint; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    const up = beatAngle(race.wind.p.tws) * D2R;
    for (const sd of [-1, 1]) {
      const hd = W + sd * up, L = 600;
      ctx.beginPath(); ctx.moveTo(X(c.windward.x), Z(c.windward.z)); ctx.lineTo(X(c.windward.x - Math.sin(hd) * L), Z(c.windward.z + Math.cos(hd) * L)); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(X(c.pin.x), Z(c.pin.z)); ctx.lineTo(X(c.committee.x), Z(c.committee.z)); ctx.stroke(); ctx.setLineDash([]);
  if (opts.guides) { // the distance lines across the beat, as on the water, every 100 m here
    const beat = -c.windward.z, st = Math.max(100, ladderStep(beat));
    ctx.strokeStyle = COL.ink; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    for (let d = st; d < beat - 15; d += st) { const z = c.windward.z + d, hw = Math.min(260, 30 + d * 0.95); ctx.beginPath(); ctx.moveTo(X(c.windward.x - hw), Z(z)); ctx.lineTo(X(c.windward.x + hw), Z(z)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  const next = leg === 'mark' ? [c.windward] : leg === 'wing' ? [c.wing] : leg === 'gate' ? c.gate : [c.pin, c.committee];
  const rounding = [c.windward, ...c.gate, ...(c.wing ? [c.wing] : [])];
  ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
  for (const m of rounding) { // the three-length zone (none at the windward mark: no mark-room there)
    if (m === c.windward) continue;
    ctx.strokeStyle = next.includes(m) && !full ? COL.accent : COL.ink; ctx.globalAlpha = next.includes(m) ? 0.8 : 0.35;
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), ZONE * s, 0, 7); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  for (const m of [...rounding, c.pin, c.committee]) {
    const hot = next.includes(m) && !full;
    ctx.fillStyle = hot ? COL.accent : '#ff7a1a';
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), hot ? 4.5 : 3.5, 0, 7); ctx.fill();
  }
  const tr = P.track; if (tr.length > 1) {
    ctx.strokeStyle = COL.accent; ctx.globalAlpha = full ? 1 : 0.6; ctx.lineWidth = full ? 2 : 1.2;
    ctx.beginPath(); tr.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.lineTo(X(P.x), Z(P.z)); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const b of race.boats) {
    ctx.save(); ctx.translate(X(b.x), Z(b.z)); ctx.rotate(b.h);
    ctx.fillStyle = b === P ? COL.ink : '#' + b.color.toString(16).padStart(6, '0');
    const k = b === P ? 1.3 : 1; ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(3.5 * k, 5 * k); ctx.lineTo(-3.5 * k, 5 * k); ctx.closePath(); ctx.fill();
    if (b.pen) { ctx.strokeStyle = COL.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  // wind arrow, and the current if there is one
  const arrow = (x, y, ang, col, len) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(5, -len + 9); ctx.lineTo(1.5, -len + 9); ctx.lineTo(1.5, len); ctx.lineTo(-1.5, len); ctx.lineTo(-1.5, -len + 9); ctx.lineTo(-5, -len + 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  arrow(size - 16, 18, W + Math.PI, COL.accent, 10);
  const cu = race.currentAt(P.x, P.z); // the stream where you are now
  if (cu.x || cu.z) arrow(16, size - 18, Math.atan2(cu.x, -cu.z), COL.muted, 9);
}


// ---------- the finish: the computer boats sail on to the line (fast, unseen), the race is kept, the result page opens ----------
// the fleet as it lay the moment you crossed the line: where each boat was, her heading and how she was sailing, for
// the result page to show the finish as it was (the scene behind it, /boat-view?finish=1)
function finishScene(race) {
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  return new Map(race.boats.map((b) => [b, { x: r1(b.x), z: r1(b.z), h: r2(b.h), twa: r2(b.twa || 0), awa: r2(b.awa || 0), heel: Math.round(b.heel || 0),
    sail: Math.round(b.sail || 0), kite: b.kite ? 1 : 0, kiteFill: r2(b.kiteFill || 0), boom: b.boom || 1, v: r1(b.v || 0), done: b.done ? 1 : 0 }]));
}
function finishToPage() {
  if (!race.over) return;
  for (let n = 0; !race.boats.every((b) => b.done) && n < 60 * 900; n++) race.step(STEP);
  const id = race._rid || (race._rid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));
  const c = race.course, P = race.player, L = race.log, s = race.settings;
  const xz = (m) => [Math.round(m.x), Math.round(m.z)];
  const thin = (tr) => { const k = Math.max(1, Math.ceil(tr.length / 160)); return tr.filter((_, i) => i % k === 0 || i === tr.length - 1).map(([x, z]) => [Math.round(x), Math.round(z)]); };
  let pb = null;
  if (P.done && !P.dsq) pb = personalBest(s.daily ? `daily|${s.daily}` : pbKey(s), Math.round(P.finish * 10) / 10);
  const head = L.tacks.filter((x) => x <= -3).length, lift = L.tacks.filter((x) => x >= 3).length;
  const res = {
    v: 1, id, at: Date.now(), daily: s.daily || null, preset: s.preset, length: s.length, laps: s.laps, start: s.start, current: !!s.current,
    venue: VENUE.id, origin: [Math.round(race.at.x), Math.round(race.at.z)], seed: s.seed ?? null,
    course: { windward: xz(c.windward), gate: c.gate.map(xz), pin: xz(c.pin), committee: xz(c.committee), legs: c.legs, ...(c.wing && { wing: xz(c.wing), type: 'tri' }) },
    boats: race.standings().map((b) => ({ name: b === P ? null : b.name, me: b === P, color: typeof b.color === 'number' ? '#' + b.color.toString(16).padStart(6, '0') : null,
      done: !!b.done, dsq: !!b.dsq, secs: b.done ? Math.round(b.finish * 10) / 10 : null, track: thin(b.track || []), ...(race._fin?.get(b) && { at: race._fin.get(b) }) })),
    log: { gunD: L.gunD, gunV: L.gunV, ocs: !!L.ocs, startDsq: L.startDsq || null, startT: L.startT, sailing: L.sailing, pct: L.sailing > 20 && L.polar ? Math.round((L.v / L.polar) * 100) : null,
      head, lift, tacks: L.tacks.length, dirty: Math.round(L.dirty), penT: Math.round(L.penT), hails: L.hails, legs: L.legs, legPlaces: L.legPlaces || [],
      fouls: L.fouls.map((f) => ({ rule: String(f.rule), who: f.who || null, t: f.t ?? null, x: f.x == null ? null : Math.round(f.x), z: f.z == null ? null : Math.round(f.z) })) },
    pb: pb && { best: pb.best, isNew: pb.isNew },
  };
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('regatta-result-')).sort((a, b) => (JSON.parse(localStorage.getItem(a) || '{}').at || 0) - (JSON.parse(localStorage.getItem(b) || '{}').at || 0));
    while (keys.length >= 20) localStorage.removeItem(keys.shift()); // the last twenty races stay on this device
    localStorage.setItem('regatta-result-' + id, JSON.stringify(res));
  } catch (e) {}
  raceResult(race, res); // and on the server, so the result's link opens on any device (stats.js)
  location.href = '/race/result/' + encodeURIComponent(id);
}

function showResults() {
  if (!race.over) return;
  renderResults();
  drawMap($('#track').getContext('2d'), 312, true);
  renderDebrief();
  results.hidden = false; hud.hidden = true;
}

// ---------- the debrief: what went well and what to work on, with the rules behind any foul ----------
// the racing-rules articles (the site's theory pages), by rule
const RULE_LINK = { 10: 'rightofway#sec-r10', 11: 'rightofway#sec-r11', 12: 'rightofway#sec-r12', 13: 'rightofway#sec-r13', 18: 'marks#sec-room',
  15: 'limits#sec-r15', 16: 'limits#sec-r16-1', 17: 'limits#sec-r17', 20: 'obstructions#sec-tack', 21: 'penalties#sec-exoneration',
  31: 'penalties#sec-how', 44: 'penalties#sec-how', ocs: 'starting#sec-recalls',
  '18.3': 'marks#sec-tack', '18.4': 'marks#sec-gybe', 19: 'obstructions#sec-room', U: 'starting#sec-recalls', B: 'starting#sec-recalls' };
const ruleHref = (r) => `${SITE}${LANG === 'ru' ? '/ru' : ''}/racing-rules/${RULE_LINK[r]}`;
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// personal bests, kept on this device: per course on a free race, per day on today's race
const PB_KEY = 'regatta-pb';
const pbKey = (s) => `${s.preset}|${s.laps}|${s.length}|${s.fleet}${s.course === 'tri' ? '|tri' : ''}`; // a triangle is a course of its own
function personalBest(key, secs) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(PB_KEY) || '{}'); } catch (e) {}
  const old = all[key], isNew = secs != null && (old == null || secs < old);
  if (isNew) { all[key] = secs; for (const k of Object.keys(all)) if (/^daily\|/.test(k) && k < `daily|${dailyRace(new Date(Date.now() - 7 * 864e5)).day}`) delete all[k]; try { localStorage.setItem(PB_KEY, JSON.stringify(all)); } catch (e) {} }
  return { best: isNew ? secs : old, isNew: isNew && old != null };
}
function renderDebrief() {
  const L = race.log, P = race.player, s = race.settings, rows = [];
  const row = (ok, text, tip, link) => rows.push(`<li class="${ok ? 'ok' : 'warn'}"><b>${esc(text)}</b>${tip ? `<span>${esc(tip)}</span>` : ''}${link || ''}</li>`);
  // the start
  if (L.startDsq) row(false, t('dStartDsq', L.startDsq), t('tipStartDsq'), `<a class="rl" hidden href="${ruleHref(L.startDsq)}">${esc(t('read'))} · ${esc(t('r' + L.startDsq))} →</a>`);
  else if (L.ocs) row(false, t('dGunOver'), t('tipStart'), `<a class="rl" hidden href="${ruleHref('ocs')}">${esc(t('read'))} · ${esc(t('rOcs'))} →</a>`);
  else if (L.gunD != null) {
    const good = L.gunD >= 0 && L.gunD < 25 && L.gunV > 3.5;
    row(good, t('dGun', Math.round(Math.max(0, L.gunD)), L.gunV.toFixed(1)) + (L.startT != null && L.startT > 8 ? ` · ${t('dStartLate', Math.round(L.startT))}` : ''), good ? '' : t('tipStart'));
  }
  // speed against the polar
  if (L.sailing > 20) { const pct = Math.round((L.v / L.polar) * 100); row(pct >= 90, t('dSpeed', pct), pct >= 90 ? '' : t('tipSpeed')); }
  // tacks against the wind's swings
  const head = L.tacks.filter((x) => x <= -3).length, lift = L.tacks.filter((x) => x >= 3).length;
  if (L.tacks.length) row(lift <= head, t('dTacks', head, lift), lift > head ? t('tipTacks') : '');
  if (L.dirty >= 10) row(L.dirty < 30, t('dDirty', Math.round(L.dirty)), L.dirty >= 30 ? t('tipDirty') : '');
  // fouls, with the rule to read
  const seen = new Set();
  for (const f of L.fouls) {
    if (seen.has(f.rule)) continue; seen.add(f.rule);
    const n = L.fouls.filter((x) => x.rule === f.rule).length;
    row(false, `${t('dRule', f.rule)} · ${t('r' + f.rule)}${n > 1 ? ` ×${n}` : ''}`, t('x' + f.rule), RULE_LINK[f.rule] ? `<a class="rl" hidden href="${ruleHref(f.rule)}">${esc(t('read'))} →</a>` : '');
  }
  if (L.penT > 1) row(false, t('dPen', Math.round(L.penT)), '');
  const hails = Object.values(L.hails).reduce((x, y) => x + y, 0);
  if (hails) { const rs = Object.keys(L.hails).filter((r) => !seen.has(r)).sort((x, y) => L.hails[y] - L.hails[x]).slice(0, 2); row(false, t('dHails', hails), rs.map((r) => `${t('dRule', r)}: ${t('x' + r)}`).join(' '), rs.filter((r) => RULE_LINK[r]).map((r) => `<a class="rl" hidden href="${ruleHref(r)}">${esc(t('dRule', r))} · ${esc(t('r' + r))} →</a>`).join('')); }
  if (!L.fouls.length && !L.ocs && !L.startDsq && !hails) row(true, t('dClean'), '');
  // personal best
  let pb = '';
  if (P.done && !P.dsq) {
    const key = s.daily ? `daily|${s.daily}` : pbKey(s), r = personalBest(key, Math.round(P.finish * 10) / 10);
    pb = `<p class="pb">${r.isNew ? `<b>${esc(t('pbNew'))}</b> ` : ''}${esc(t(s.daily ? 'pbToday' : 'pb', fmt(r.best)))}</p>`;
  }
  $('#debrief').innerHTML = `<span class="meta">${esc(t('dbK'))}</span><ul class="db">${rows.join('')}</ul>${pb}<div id="todayTop"></div>`;
  // the rule articles are the app's pages; a link shows only once its page is there (a level can be switched off)
  for (const a of $('#debrief').querySelectorAll('a.rl')) fetch(a.getAttribute('href').split('#')[0], { method: 'HEAD' }).then((r) => { if (r.ok) a.hidden = false; }).catch(() => {});
  // today's fastest (from the server, a few minutes behind)
  if (s.daily) fetch(`${SITE}/api/game`).then((r) => (r.ok ? r.json() : null)).then((j) => {
    const d = j && j.daily; if (!d || d.d !== s.daily || !d.top.length) return;
    $('#todayTop').innerHTML = `<span class="meta">${esc(t('todayTop'))}</span><ol class="lb">${d.top.map((x) => `<li><span>${esc(x.name || t('guest'))}</span><b>${fmt(x.s)}</b></li>`).join('')}</ol>`;
  }).catch(() => {});
}
function renderResults() {
  const st = race.standings();
  $('#resTitle').textContent = t('results');
  $('#resTable').innerHTML = st.map((b, i) => `<tr class="${b === race.player ? 'me' : ''}"><td>${b.dsq ? '–' : i + 1}</td><td>${b === race.player ? t('you') : b.name}</td><td>${b.done ? (b.dsq ? `${t('dsq')} · ` : '') + fmt(b.finish) : t('racing')}</td></tr>`).join('');
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
let frameN = 0;
function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  if (window.__slow) { const t0 = performance.now(); while (performance.now() - t0 < window.__slow); } // debug: pretend to be a slow phone
  const P = race.player;
  if (running && !paused) {
    const kl = input.keys.ArrowLeft, kr = input.keys.ArrowRight;
    if (kl || kr) { input.rudderHeld = true; input._key = true; input.rudder = clamp(input.rudder + (kr ? 1 : -1) * dt * 2.5, -1, 1); P.auto = null; }
    else if (input._key) { input._key = false; input.rudderHeld = rudderPtr !== null; }
    if (input.keys.ArrowUp || input.keys.KeyW) setSheet(P.sheet - dt * 0.6);
    if (input.keys.ArrowDown || input.keys.KeyS) setSheet(P.sheet + dt * 0.6);
    if (!input.rudderHeld) input.rudder *= Math.exp(-dt * 5);
    if (!P.auto) P.rudder = input.rudder; else input.rudder = 0;
    acc += dt * timeScale;
    while (acc >= STEP) { race.step(STEP); acc -= STEP; }
    handleMessages();
    updateHud(dt);
    if (world.quality === 'high' || frameN++ % 3 === 0) drawMap(mctx, 240, false);
    watchFps(raw);
    if (!results.hidden && Math.floor(race.clock) !== Math.floor(race.clock - dt)) renderResults();
  } else {
    if (!running) world.orbit += dt * 0.12; // behind the menu the drone circles
    race.idle(dt);
    if (paused) { audio.update(P, true); crews.update(P, true); }
  }
  world.frame(running && !paused ? dt * timeScale : 0, race.t); // foam and wakes keep pace with the race
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (/[?&]debug\b/.test(location.search)) window.__rg = { get race() { return race; }, world, audio, skipper, crews, asides };
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !window.__rg) pause(); }); // not in debug: test screenshots hide the tab
