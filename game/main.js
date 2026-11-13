// Regatta: the game loop, the touch controls, the instruments, the sounds and the menus.
import { Race, D2R, KN, clamp, wrap, idealSail, sheetFor, beatAngle, ZONE, dailyRace } from './sim.js';
import { World, defaultQuality, ladderStep } from './world.js';
import { raceStarted, raceFinished } from './stats.js';

const $ = (s) => document.querySelector(s);
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
// The game is a site of its own (this repo, the Vercel project ryc-regatta, at regatta.rycrentals.com); the app,
// its rule articles, its fonts and the race scores (api/game.mjs in the iyt-test repo) stay on iyt.rycrentals.com, which lets this site
// read them across origins. SITE is in stats.js too.
const SITE = 'https://iyt.rycrentals.com';
// From Telegram the app passes its launch data in the hash, as Telegram does (miniapp/app.js in iyt-test); telegram-web-app.js has
// read and kept it by now, so it comes off the address bar and out of any link the player copies.
if (TG && /tgWebAppData=/.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}

// ---------- words ----------
const ord = (n) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`;
const T = {
  en: {
    kick: 'Game', title: 'Up and down', fun: 'Just for fun — take a break and relax between tests.', sub: 'A windward–leeward race against the computer boats, under the racing rules. Steer, trim, tack, read the wind.',
    modeK: 'Race', daily: 'Today’s race', free: 'Free race', howK: 'How to play',
    dailyNote: (w) => `The same course and wind for everyone today — ${w} — so times compare fairly. The fastest are on the Home page.`,
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
    x18: 'In the zone the inside boat, or the one clear ahead, gets room to round the mark.', x31: 'Touching a mark costs one penalty turn.', x44: 'A boat spinning her penalty turns keeps clear of the others.',
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
    pb: (s) => `Your best on this course: ${s}`, pbNew: 'A new personal best!', pbToday: (s) => `Your best today: ${s}`, todayTop: 'Today’s fastest', guest: 'Guest',
    cSteer: 'Steer: drag your left thumb along the arc', cSheet: 'Trim: slide your right thumb up to pull the sails in, down to ease them',
    cLine: 'Head for the line and cross it just after the gun', cHeader: 'The wind has headed you — tap Tack', cMark: 'Round the mark leaving it on your left (to port)',
    cKite: 'Bear away and tap Kite to fly the gennaker', cGate: 'Sail between the two buoys of the gate', cFinish: 'Now cross the line to finish',
    wind: 'Wind', light: 'Light · 7 kn', medium: 'Medium · 12 kn', strong: 'Strong · 19 kn', laps: 'Laps', sails: 'Sails',
    manual: 'I trim', auto: 'Auto-trim', sound: 'Sound', on: 'On', off: 'Off', startK: 'Start', m1: '1 min', m3: '3 min', m5: '5 min',
    fleetK: 'Boats', lengthK: 'Course', lShort: 'Short', lMedium: 'Medium', lLong: 'Long',
    currentK: 'Current', guidesK: 'Guides', gfx: 'Graphics', gAuto: 'Auto', gHigh: 'High', gMedium: 'Medium', gLow: 'Low', start: 'Start race', resume: 'Resume', restart: 'Restart',
    how1: '<b>Left thumb</b> steers on the arc. <b>Right thumb</b> works the sheet: up pulls the sails in, down lets them out. Keep the telltales green.',
    how2: '<b>Tack</b> turns you through the wind (<b>Gybe</b> downwind). <b>Kite</b> sets the gennaker on a run — the hoist and the drop take the crew a few seconds, so get it down in good time before the gate. In a gust, ease the sheet before she heels too far; in a blow, <b>Reef</b> makes the main smaller. Before the start, head up and let the sheet right out to stop — or even go astern.',
    how3: 'Start after the gun — the class flag comes down. Over early and you must go back. Round the windward mark <b>leaving it to port</b>, finish through the line.',
    how5: 'Round your boat: the <b>arrow</b> shows where the wind blows from; <b>red</b> — too close to the wind to sail; <b>green</b> marks — the best angle upwind; <b>blue</b> — the best angle downwind. The wind swings ten degrees and more either way every minute or so: in a <b>lift</b> you can point higher, in a <b>header</b> tack.',
    how4: 'Racing rules: port tack keeps clear of starboard, windward of leeward, the boat astern of the boat ahead; at a mark, the <b>zone</b> (dashed ring, three hull lengths): if two boats are overlapped when the first reaches it, the inside one gets room, if not — the one clear ahead. Hit someone you should have avoided — two penalty turns. Touch a mark — one. A boat that has just got right of way must first give the other room, and a boat with right of way mustn’t turn suddenly into one keeping clear.',
    rotate: 'Turn your phone sideways for the best view.', back: '← Back to Sailing Certification Test',
    flagCls: 'Class', flagP: 'Prep', flagX: 'Recall', kn: 'kn', drone: 'Drone', helm: 'Helm', top: 'Top', tack: 'Tack', gybe: 'Gybe', kite: 'Kite', in: 'In', out: 'Out',
    ok: 'Trim OK', pullIn: 'Pull in', easeOut: 'Ease out', irons: 'In irons',
    startIn: 'Start', lineStart: 'Start line', mark: 'Windward mark', gate: 'Leeward gate', finish: 'Finish', ocsS: 'OCS — return below the line',
    target: 'target', vmg: 'VMG', line: 'line', toLine: 'to line', favPin: 'pin end favoured', favBoat: 'boat end favoured', square: 'line square',
    sigWarn: (n) => `Warning signal — class flag up, ${n} min`, sigPrep: (n, f = 'P') => `Preparatory — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} up, ${n} min`, sig1: (n, f = 'P') => `One minute — ${{ P: 'P flag', U: 'U flag', B: 'black flag' }[f]} down`, gun: 'Start! Class flag down',
    ocs: 'Over early! X flag — go back below the line', cleared: 'Clear — now start', started: 'Good start!', rounded: 'Mark rounded — bear away, kite up',
    missedLine: 'Outside the line — cross between the committee boat and the pin', missedGate: 'Outside the gate — go back and sail between the two buoys', wrongSide: 'Leave the mark to port — go back round it',
    gateMsg: 'Through the gate — back upwind', bump: 'Contact!', broach: 'Broach! Ease the sheet', kitedown: 'Too close to the wind — the kite comes down in a hurry',
    heelMsg: 'Too much heel — ease the sheet', ironsMsg: 'In irons — steer away from the wind', gust: 'Gust!', autoOff: 'Auto-trim off — you trim now',
    hail10: 'Starboard!', hail11: 'Windward boat, keep clear!', hail12: 'Keep clear astern!', hail13: 'You’re tacking — keep clear!', hail18: 'Room at the mark!', hail44: 'Penalty boat — keep clear!',
    fouled: (w, r) => `Foul on ${w} (rule ${r}) — do two penalty turns`, theyFouled: (w, r) => `${w} broke rule ${r} and takes a penalty`,
    touched: 'You touched the mark — one penalty turn', penaltyDone: 'Penalty done', pen: (d, n) => `Penalty ${d}/${n} turns`,
    dirty: 'Dirty air', surf: 'Surfing!', lift: (d) => `Lift ${d}°`, header: (d) => `Header ${d}° — tack?`,
    zIn: (n) => `Zone · overlapped with ${n}, you're inside — you get room`, zOut: (n) => `Zone · overlapped with ${n}, you're outside — give room`,
    zAhead: (n) => `Zone · clear ahead of ${n} — you get room`, zAstern: (n) => `Zone · clear astern of ${n} — keep clear`, tackCall: 'Ready about… Lee-oh!', gybeCall: 'Stand by to gybe… Gybe-oh!',
    results: 'Results', again: 'Race again', menu: 'Menu', racing: 'racing…', you: 'You', dsq: 'DSQ',
    gfxDown: (q) => `Graphics set to ${q} to keep it smooth`, place: ord, finished: (n) => `Finished ${ord(n)}!`, finishedDsq: 'Finished without taking your penalty — DSQ',
  },
  ru: {
    kick: 'Игра', title: 'Up and down', fun: 'Просто для удовольствия — отдохни и расслабься между тестами.', sub: 'Гонка «апвинд — даунвинд» против компьютерных лодок по правилам. Рули, работай шкотом, делай повороты, читай ветер.',
    modeK: 'Гонка', daily: 'Гонка дня', free: 'Свободная', howK: 'Как играть',
    dailyNote: (w) => `Сегодня у всех одна дистанция и один ветер — ${w}, — так что время честно сравнивается. Самые быстрые — на главной.`,
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
    x18: 'В зоне место для огибания знака получает внутренняя лодка или та, что впереди.', x31: 'Касание знака — один штрафной оборот.', x44: 'Лодка на штрафных оборотах уступает остальным.',
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
    pb: (s) => `Твой рекорд на этой дистанции: ${s}`, pbNew: 'Новый личный рекорд!', pbToday: (s) => `Твой лучший результат сегодня: ${s}`, todayTop: 'Самые быстрые сегодня', guest: 'Гость',
    cSteer: 'Руль: веди левым пальцем по дуге', cSheet: 'Шкот: правым пальцем вверх — выбрать паруса, вниз — потравить',
    cLine: 'Иди к линии и пересеки её сразу после сигнала', cHeader: 'Ветер зашёл — жми «Поворот»', cMark: 'Огибай знак, оставляя его слева',
    cKite: 'Уваливайся и жми «Генакер»', cGate: 'Пройди между двумя знаками ворот', cFinish: 'Теперь пересеки линию — финиш',
    wind: 'Ветер', light: 'Слабый · 7 уз', medium: 'Средний · 12 уз', strong: 'Сильный · 19 уз', laps: 'Круги', sails: 'Паруса',
    manual: 'Сам', auto: 'Авто', sound: 'Звук', on: 'Вкл', off: 'Выкл', startK: 'Старт', m1: '1 мин', m3: '3 мин', m5: '5 мин',
    fleetK: 'Лодок', lengthK: 'Дистанция', lShort: 'Короткая', lMedium: 'Средняя', lLong: 'Длинная',
    currentK: 'Течение', guidesK: 'Подсказки', gfx: 'Графика', gAuto: 'Авто', gHigh: 'Высокая', gMedium: 'Средняя', gLow: 'Низкая', start: 'Начать гонку', resume: 'Продолжить', restart: 'Заново',
    how1: '<b>Левый палец</b> рулит по дуге. <b>Правый</b> работает шкотом: вверх выбрать, вниз потравить. Колдунчики должны быть зелёными.',
    how2: '<b>Поворот</b> — оверштаг через ветер (на полных курсах — <b>фордевинд</b>). <b>Генакер</b> — для попутного ветра; постановка и уборка занимают у экипажа несколько секунд, так что убирай его заранее, до ворот. В порыве трави шкот, пока крен не стал слишком большим; в сильный ветер <b>Риф</b> уменьшает грот. Перед стартом приведись и потрави шкот до конца — лодка остановится или даже пойдёт назад.',
    how3: 'Старт после сигнала — флаг класса спущен. Фальстарт — вернись за линию. Верхний знак огибают, <b>оставляя его слева</b>; финиш — через линию.',
    how5: 'Вокруг лодки: <b>стрелка</b> — откуда дует ветер; <b>красное</b> — слишком остро к ветру, идти нельзя; <b>зелёные</b> метки — лучший угол на ветер; <b>синие</b> — лучший угол по ветру. Ветер гуляет на десять с лишним градусов в обе стороны каждую минуту-другую: когда он <b>отходит</b>, можно идти круче, когда <b>заходит</b> — поворачивай.',
    how4: 'Правила: левый галс уступает правому, наветренная — подветренной, догоняющая — идущей впереди; у знака — <b>зона</b> (пунктирный круг, три корпуса): если лодки связаны, когда первая в неё входит, место получает внутренняя, если не связаны — идущая впереди. Столкнулся, когда должен был уступить, — два штрафных оборота. Задел знак — один. Лодка, только что получившая право дороги, сначала даёт место, а лодка с правом дороги не может резко поворачивать на ту, что уступает.',
    rotate: 'Поверните телефон горизонтально.', back: '← Назад в Sailing Certification Test',
    flagCls: 'Класс', flagP: 'Подгот.', flagX: 'Отзыв', kn: 'уз', drone: 'Дрон', helm: 'Штурвал', top: 'Сверху', tack: 'Поворот', gybe: 'Фордевинд', kite: 'Генакер', in: 'Выбрать', out: 'Травить',
    ok: 'Паруса в норме', pullIn: 'Выбери шкот', easeOut: 'Потрави шкот', irons: 'Левентик',
    startIn: 'Старт', lineStart: 'Линия старта', mark: 'Верхний знак', gate: 'Нижние ворота', finish: 'Финиш', ocsS: 'Фальстарт — вернись за линию',
    target: 'цель', vmg: 'VMG', line: 'линия', toLine: 'до линии', favPin: 'выгоднее у знака', favBoat: 'выгоднее у судна', square: 'линия ровная',
    sigWarn: (n) => `Предупредительный сигнал — флаг класса, ${n} мин`, sigPrep: (n, f = 'P') => `Подготовительный — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]}, ${n} мин`, sig1: (n, f = 'P') => `Одна минута — ${{ P: 'флаг P', U: 'флаг U', B: 'чёрный флаг' }[f]} спущен`, gun: 'Старт! Флаг класса спущен',
    ocs: 'Фальстарт! Флаг X — вернись за линию', cleared: 'Теперь стартуй', started: 'Отличный старт!', rounded: 'Знак пройден — уваливайся, ставь генакер',
    missedLine: 'Мимо линии — пересеки её между судейским судном и знаком', missedGate: 'Мимо ворот — вернись и пройди между двумя знаками', wrongSide: 'Знак оставляют слева — обогни его снова',
    gateMsg: 'Ворота пройдены — снова на ветер', bump: 'Столкновение!', broach: 'Брочинг! Трави шкот', kitedown: 'Слишком остро — генакер убирают в спешке',
    heelMsg: 'Сильный крен — потрави шкот', ironsMsg: 'Левентик — уваливайся', gust: 'Порыв!', autoOff: 'Автоподбор выключен — шкот твой',
    hail10: 'Правый галс!', hail11: 'Наветренная, уходи!', hail12: 'Сзади, уходи!', hail13: 'Ты в повороте — уходи!', hail18: 'Место у знака!', hail44: 'Штрафник, уходи!',
    fouled: (w, r) => `Нарушение против ${w} (правило ${r}) — два штрафных оборота`, theyFouled: (w, r) => `${w}: нарушение правила ${r}, штрафные обороты`,
    touched: 'Касание знака — один штрафной оборот', penaltyDone: 'Штраф выполнен', pen: (d, n) => `Штраф ${d}/${n} об.`,
    dirty: 'Грязный ветер', surf: 'Сёрфинг!', lift: (d) => `Ветер отошёл ${d}°`, header: (d) => `Ветер зашёл ${d}° — поворот?`,
    zIn: (n) => `Зона · связаны с ${n}, ты внутри — тебе дают место`, zOut: (n) => `Зона · связаны с ${n}, ты снаружи — дай место`,
    zAhead: (n) => `Зона · не связаны, ты впереди ${n} — тебе дают место`, zAstern: (n) => `Зона · не связаны, ты позади ${n} — держись в стороне`, tackCall: 'К повороту оверштаг… Поворот!', gybeCall: 'К повороту фордевинд… Поворот!',
    results: 'Результаты', again: 'Ещё гонку', menu: 'Меню', racing: 'в гонке…', you: 'Вы', dsq: 'DSQ',
    gfxDown: (q) => `Графика: «${q}» — для плавности`, place: (n) => `${n}-е`, finished: (n) => `Финиш: ${n}-е место!`, finishedDsq: 'Финиш без штрафа — дисквалификация (DSQ)',
  },
};
const urlLang = new URLSearchParams(location.search).get('lang');
const LANG = urlLang === 'ru' || urlLang === 'en' ? urlLang
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
const opts = { mode: 'daily', preset: 'medium', fleet: 5, length: 'short', laps: 1, autoTrim: 0, sound: 1, start: 1, current: 0, gfx: 'auto', guides: 1, played: 0 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('regatta') || '{}')); } catch (e) {}
if (opts.fleetV !== 3) { opts.fleet = 5; opts.fleetV = 3; } // the default changed (10, then 7): start everyone on 5 once
if (opts.optsV !== 4) { opts.length = 'short'; opts.mode = 'daily'; opts.optsV = 4; } // a short race, today's, is the default now
const saveOpts = () => { try { localStorage.setItem('regatta', JSON.stringify(opts)); } catch (e) {} };
// the race's settings: the menu's, or in today's race the day's own (the same for everyone)
const DAILY_KEYS = ['preset', 'fleet', 'length', 'laps', 'start', 'current'];
const settings = () => { if (opts.mode !== 'daily') return { ...opts, daily: null }; const d = dailyRace(); return { ...opts, ...d, daily: d.day }; };
const windName = (p) => t(p);
const paintOpts = () => {
  const s = settings();
  document.querySelectorAll('.choice').forEach((g) => {
    g.classList.toggle('locked', opts.mode === 'daily' && DAILY_KEYS.includes(g.dataset.opt));
    g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(s[g.dataset.opt]) === b.dataset.v));
  });
  const n = $('#dailyNote'); if (n) { n.hidden = opts.mode !== 'daily'; n.textContent = t('dailyNote', windName(s.preset)); }
};
// a third way to trim: the main and the jib each on their own sheet
{ const g = document.querySelector('.choice[data-opt="autoTrim"]'); if (g && !g.querySelector('[data-v="2"]')) { const b = document.createElement('button'); b.dataset.v = '2'; b.innerHTML = t('split'); g.append(b); } }
paintOpts();
for (const g of document.querySelectorAll('.choice')) {
  const k = g.dataset.opt;
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (opts.mode === 'daily' && DAILY_KEYS.includes(k)) { Object.assign(opts, Object.fromEntries(DAILY_KEYS.map((x) => [x, settings()[x]]))); opts.mode = 'free'; } // changing today's settings makes it a free race
    opts[k] = k === 'preset' || k === 'gfx' || k === 'length' || k === 'mode' ? b.dataset.v : +b.dataset.v; paintOpts(); saveOpts();
    if (k === 'gfx') { world.setQuality(startQuality()); perf.settle = 2; }
    if (k === 'guides') world.showGuides = !!opts.guides;
    if (k === 'sound') audio.setOn(!!opts.sound);
    if (k === 'autoTrim' && race && running) applyTrimMode();
    if (k === 'preset' || k === 'laps' || k === 'start' || k === 'current' || k === 'mode' || k === 'fleet' || k === 'length') { if (!running) newRace(); else menuChanged = true; }
  });
}

// ---------- Telegram ----------
if (TG) {
  TG.ready(); TG.expand();
  try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && /android|iphone|ipad/i.test(navigator.userAgent)) TG.requestFullscreen(); } catch (e) {}
  TG.onEvent && TG.onEvent('themeChanged', () => applyTheme());
  TG.BackButton.show();
  TG.BackButton.onClick(() => { if (running && !paused) pause(); else location.href = SITE + '/'; });
}
const haptic = (kind) => {
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
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 1 : 0; if (!v && window.speechSynthesis) speechSynthesis.cancel(); },
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
  say(text) {
    if (!this.on || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace('…', ', '));
      u.lang = LANG === 'ru' ? 'ru-RU' : 'en-GB'; u.rate = 1.1; u.volume = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
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
const GFX_KEY = 'regatta-gfx';
function startQuality() {
  if (opts.gfx !== 'auto') return opts.gfx;
  try { return localStorage.getItem(GFX_KEY) || defaultQuality(); } catch (e) { return defaultQuality(); }
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
  try { localStorage.setItem(GFX_KEY, q); } catch (e) {}
  toast(t('gfxDown', t(q === 'medium' ? 'gMedium' : 'gLow')), 2.5);
}

let race = null, running = false, paused = false, menuChanged = false, hints = {}, lastClockInt = null, coachSeen = {};
function newRace() {
  const s = settings();
  race = new Race({ preset: s.preset, laps: s.laps, autoTrim: opts.autoTrim === 1, start: s.start, current: !!s.current, fleet: s.fleet, length: s.length, seed: s.daily ? s.seed : undefined });
  race.settings = s;
  race.player.name = t('you');
  world.setRace(race);
  world.resetView();
  hints = {}; lastClockInt = null; coachSeen = {};
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
setCam('drone');

// ---------- menus ----------
const menu = $('#menu'), results = $('#results'), hud = $('#hud');
if (!opts.played) $('#howD').open = true; // how to play: open until the first race
function startRace() {
  audio.init(); audio.setOn(!!opts.sound);
  if (running || menuChanged || race.over || (race.settings.daily && race.settings.daily !== dailyRace().day)) newRace(); // a new day: a new daily race
  menuChanged = false;
  opts.played = (opts.played || 0) + 1; saveOpts();
  race.coach = opts.played <= 3; // the first three races: tips as you go
  menu.hidden = true; results.hidden = true; hud.hidden = false;
  running = true; paused = false;
  applyTrimMode();
  setCam(world.mode);
  raceStarted(race, race.settings); // counted for the admins' Overview and the leaderboards (stats.js)
}
function pause() { paused = true; menu.hidden = false; $('#resumeBtn').hidden = false; $('#goBtn').textContent = t('restart'); }
function resume() { if (menuChanged) { startRace(); return; } paused = false; menu.hidden = true; }
$('#goBtn').addEventListener('click', startRace);
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', pause);
$('#againBtn').addEventListener('click', () => { running = false; newRace(); startRace(); });
$('#menuBtn').addEventListener('click', () => { running = false; paused = false; newRace(); results.hidden = true; hud.hidden = true; menu.hidden = false; $('#resumeBtn').hidden = true; $('#goBtn').textContent = t('start'); });
$('#backLink').href = SITE + '/';
if (TG) $('#backLink').addEventListener('click', (e) => { e.preventDefault(); location.href = SITE + '/'; });

// ---------- instruments ----------
const el = { spd: $('#spd'), perf: $('#perf'), status: $('#status'), trim: $('#trim'), trimTxt: $('#trimTxt'), knob: $('#rudderKnob'), band: $('#sheet .band'), sknob: $('#sheet .knob'),
  toast: $('#toast'), count: $('#count'), flags: $('#flags'), chips: $('#chips') };
let toastT = 0;
const txt = (e, s) => { if (e._t !== s) { e._t = s; e.textContent = s; } }; // write the DOM only when the text changes
function toast(msg, secs = 2.4) { txt(el.toast, msg); el.toast.classList.add('show'); toastT = secs; }
function hint(key, msg, every = 12) { const n = race.clock; if (hints[key] && n - hints[key] < every) return; hints[key] = n; toast(msg); }

const legName = { start: 'lineStart', mark: 'mark', gate: 'gate', finish: 'finish' };
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
  if (P.pen) chips.push(['bad', t('pen', Math.min(P.pen.turns, Math.floor(Math.abs(P.pen.sum) / (2 * Math.PI) * 10) / 10).toFixed(1), P.pen.turns)]);
  if (P.shadow > 0.08) chips.push(['warn', `${t('dirty')} −${Math.round(P.shadow * 100)}%`]);
  if (P.surf > 0) chips.push(['ok', t('surf')]);
  // on the beat, the wind's swing against its middle: a lift (she can point higher) or a header (time to tack)
  if (race.clock >= 0 && !P.done && !P.auto && a < 70) {
    const s = Math.round(((P.twa < 0 ? -1 : 1) * wrap(P.wdir - race.wind.mean())) / D2R);
    if (s >= 4) chips.push(['ok', t('lift', s)]); else if (s <= -4) chips.push(['warn', t('header', -s)]);
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
    chips.push([mine ? 'ok' : 'warn', zs.st.overlapped ? t(mine ? 'zIn' : 'zOut', n) : t(mine ? 'zAhead' : 'zAstern', n)]);
  }
  const ck = chips.map((x) => x.join()).join('|');
  if (ck !== chipsKey) { chipsKey = ck; el.chips.innerHTML = chips.map(([k, s]) => `<span class="chip ${k}">${s}</span>`).join(''); }

  const left = -race.clock;
  // the countdown to the start, large all the way, and huge for the last ten seconds
  txt(el.count, race.clock < 0 ? (left <= 10 ? String(Math.ceil(left)) : fmt(left + 0.999)) : '');
  el.count.classList.toggle('final', race.clock < 0 && left <= 10);
  const ci = Math.ceil(-race.clock);
  if (race.clock < 0 && ci !== lastClockInt) {
    if (lastClockInt !== null && ci <= 10 && ci > 0) { audio.tone(ci <= 3 ? 1046 : 880, 0.12); if (ci <= 3) haptic('light'); }
    lastClockInt = ci;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }
  audio.update(P, paused);
  if (race.coach) coach(P, a, leg);
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
      audio.horn(a.sound === 'long'); haptic(a.key === 'gun' ? 'heavy' : 'medium');
      if (a.key === 'gun' && P.ocs) continue;
      toast(t(a.key, Math.round(-a.t / 60), race.prepFlag), 3);
    } else if (m.key === 'finished' || m.key === 'finishedDsq' || m.key === 'finishedStartDsq') { raceFinished(race); toast(t(m.key, m.arg), 3); audio.horn(); haptic('heavy'); setTimeout(showResults, 2500); }
    else if (m.key === 'gate') toast(t('gateMsg'));
    else if (m.key === 'bump') { hint('bump', t('bump'), 3); haptic('heavy'); }
    else if (m.key === 'hail') { const h = t('hail' + a.rule); toast(`${a.who}: “${h}”`, 2.2); audio.say(h); haptic('warn'); }
    else if (m.key === 'youHail') { if (a.rule) { const h = t('hail' + a.rule); toast(t('youHail', h), 2); audio.say(h); } }
    else if (m.key === 'genRecall') { toast(t('genRecall', m.arg), 4); audio.horn(); audio.horn(); haptic('warn'); }
    else if (m.key === 'prepU' || m.key === 'prepB' || m.key === 'ufd' || m.key === 'bfd') { toast(t(m.key), 4); if (m.key === 'ufd' || m.key === 'bfd') haptic('warn'); }
    else if (m.key === 'fouled' || m.key === 'theyFouled') toast(t(m.key, a.who, a.rule), 3.5);
    else { toast(t(m.key), 2.6); if (m.key === 'ocs') haptic('warn'); if (m.key === 'rounded') haptic('medium'); }
  }
  race.messages.length = 0;
  for (const e of P.events) {
    if (e === 'broach') { toast(t('broach')); haptic('heavy'); }
    if (e === 'kitedown') { toast(t('kitedown')); haptic('warn'); }
    if (e === 'kiteHoist' || e === 'kiteDrop' || e === 'kiteUp') toast(t(e + (P.kiteType === 'zero' ? 'Z' : '')), 1.8);
    if (e === 'reefStart' || e === 'reefDone' || e === 'shakeStart' || e === 'shakeDone' || e === 'jibStart' || e === 'jibDone') toast(t(e), 1.8);
    if (e === 'penaltyDone') toast(t('penaltyDone'));
    if (e === 'tacking' || e === 'gybing') audio.say(t(e === 'tacking' ? 'tackCall' : 'gybeCall'));
  }
  P.events.length = 0;
  for (const b of race.boats) if (b !== P) b.events.length = 0;
  if (P.heel > 33) hint('heel', t('heelMsg'), 10);
  if (P.trim === 'irons' && P.v < 0.6 && !P.auto && !P.pen && race.clock > race.seq[0].t + 8) hint('irons', t('ironsMsg'), 10);
  if (P.gust > 0.55) hint('gust', t('gust'), 15);
}

// ---------- minimap ----------
const mini = $('#mini'), mctx = mini.getContext('2d');
mini.width = mini.height = 360; mctx.setTransform(1.5, 0, 0, 1.5, 0, 0); // drawn at 240, sharp at the bigger size
mini.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); mini.classList.toggle('big'); });
function drawMap(ctx, size, full) {
  const c = race.course, P = race.player, W = race.wind.dir();
  const hw = Math.max(150, c.len / 2 + 40), x0 = -hw, x1 = hw, z0 = c.windward.z - 45, z1 = 140;
  const s = Math.min(size / (x1 - x0), size / (z1 - z0)), ox = size / 2 - ((x0 + x1) / 2) * s, oz = size / 2 - ((z0 + z1) / 2) * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, size, size);
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
  const next = leg === 'mark' ? [c.windward] : leg === 'gate' ? c.gate : [c.pin, c.committee];
  ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
  for (const m of [c.windward, ...c.gate]) { // the three-length zone
    ctx.strokeStyle = next.includes(m) && !full ? COL.accent : COL.ink; ctx.globalAlpha = next.includes(m) ? 0.8 : 0.35;
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), ZONE * s, 0, 7); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  for (const m of [c.windward, ...c.gate, c.pin, c.committee]) {
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
    const key = s.daily ? `daily|${s.daily}` : `${s.preset}|${s.laps}|${s.length}|${s.fleet}`, r = personalBest(key, Math.round(P.finish * 10) / 10);
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
    if (paused) audio.update(P, true);
  }
  world.frame(running && !paused ? dt * timeScale : 0, race.t); // foam and wakes keep pace with the race
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (/[?&]debug\b/.test(location.search)) window.__rg = { get race() { return race; }, world };
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !window.__rg) pause(); }); // not in debug: test screenshots hide the tab
