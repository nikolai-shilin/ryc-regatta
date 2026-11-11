// Regatta: the game loop, the touch controls, the instruments, the sounds and the menus.
import { Race, D2R, KN, clamp, wrap, idealSail, sheetFor, beatAngle, ZONE } from './sim.js';
import { World, defaultQuality, ladderStep } from './world.js';
import { raceStarted, raceFinished } from './stats.js';

const $ = (s) => document.querySelector(s);
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

// ---------- words ----------
const ord = (n) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`;
const T = {
  en: {
    kick: 'Game', title: 'Regatta', sub: 'A windward–leeward race against three boats, under the racing rules. Steer, trim, tack, read the wind.',
    wind: 'Wind', light: 'Light · 7 kn', medium: 'Medium · 12 kn', strong: 'Strong · 19 kn', laps: 'Laps', sails: 'Sails',
    manual: 'I trim', auto: 'Auto-trim', sound: 'Sound', on: 'On', off: 'Off', startK: 'Start', m1: '1 min', m3: '3 min', m5: '5 min',
    fleetK: 'Boats', lengthK: 'Course', lShort: 'Short', lMedium: 'Medium', lLong: 'Long',
    currentK: 'Current', guidesK: 'Guides', gfx: 'Graphics', gAuto: 'Auto', gHigh: 'High', gMedium: 'Medium', gLow: 'Low', start: 'Start race', resume: 'Resume', restart: 'Restart',
    how1: '<b>Left thumb</b> steers on the arc. <b>Right thumb</b> works the sheet: up pulls the sails in, down lets them out. Keep the telltales green.',
    how2: '<b>Tack</b> turns you through the wind (<b>Gybe</b> downwind). <b>Kite</b> sets the gennaker on a run. In a gust, ease the sheet before she heels too far.',
    how3: 'Start after the gun — the class flag comes down. Over early and you must go back. Round the windward mark <b>leaving it to port</b>, finish through the line.',
    how5: 'Round your boat: the <b>arrow</b> shows where the wind blows from; <b>red</b> — too close to the wind to sail; <b>green</b> marks — the best angle upwind; <b>blue</b> — the best angle downwind. The wind swings ten degrees and more either way every minute or so: in a <b>lift</b> you can point higher, in a <b>header</b> tack.',
    how4: 'Racing rules: port tack keeps clear of starboard, windward of leeward, the boat astern of the boat ahead; at a mark, the <b>zone</b> (dashed ring, three hull lengths): if two boats are overlapped when the first reaches it, the inside one gets room, if not — the one clear ahead. Hit someone you should have avoided — two penalty turns. Touch a mark — one.',
    rotate: 'Turn your phone sideways for the best view.', back: '← Back to Sailing Certification Test',
    flagCls: 'Class', flagP: 'Prep', flagX: 'Recall', kn: 'kn', drone: 'Drone', helm: 'Helm', top: 'Top', tack: 'Tack', gybe: 'Gybe', kite: 'Kite', in: 'In', out: 'Out',
    ok: 'Trim OK', pullIn: 'Pull in', easeOut: 'Ease out', irons: 'In irons',
    startIn: 'Start', lineStart: 'Start line', mark: 'Windward mark', gate: 'Leeward gate', finish: 'Finish', ocsS: 'OCS — return below the line',
    target: 'target', vmg: 'VMG', line: 'line', toLine: 'to line', favPin: 'pin end favoured', favBoat: 'boat end favoured', square: 'line square',
    sigWarn: (n) => `Warning signal — class flag up, ${n} min`, sigPrep: (n) => `Preparatory — P flag up, ${n} min`, sig1: 'One minute — P flag down', gun: 'Start! Class flag down',
    ocs: 'Over early! X flag — go back below the line', cleared: 'Clear — now start', started: 'Good start!', rounded: 'Mark rounded — bear away, kite up',
    missedLine: 'Outside the line — cross between the committee boat and the pin', missedGate: 'Outside the gate — go back and sail between the two buoys', wrongSide: 'Leave the mark to port — go back round it',
    gateMsg: 'Through the gate — back upwind', bump: 'Contact!', broach: 'Broach! Ease the sheet', kitedown: 'Too close to the wind for the kite',
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
    kick: 'Игра', title: 'Регата', sub: 'Гонка «апвинд — даунвинд» против трёх лодок по правилам. Рули, работай шкотом, делай повороты, читай ветер.',
    wind: 'Ветер', light: 'Слабый · 7 уз', medium: 'Средний · 12 уз', strong: 'Сильный · 19 уз', laps: 'Круги', sails: 'Паруса',
    manual: 'Сам', auto: 'Авто', sound: 'Звук', on: 'Вкл', off: 'Выкл', startK: 'Старт', m1: '1 мин', m3: '3 мин', m5: '5 мин',
    fleetK: 'Лодок', lengthK: 'Дистанция', lShort: 'Короткая', lMedium: 'Средняя', lLong: 'Длинная',
    currentK: 'Течение', guidesK: 'Подсказки', gfx: 'Графика', gAuto: 'Авто', gHigh: 'Высокая', gMedium: 'Средняя', gLow: 'Низкая', start: 'Начать гонку', resume: 'Продолжить', restart: 'Заново',
    how1: '<b>Левый палец</b> рулит по дуге. <b>Правый</b> работает шкотом: вверх выбрать, вниз потравить. Колдунчики должны быть зелёными.',
    how2: '<b>Поворот</b> — оверштаг через ветер (на полных курсах — <b>фордевинд</b>). <b>Генакер</b> — для попутного ветра. В порыве трави шкот, пока крен не стал слишком большим.',
    how3: 'Старт после сигнала — флаг класса спущен. Фальстарт — вернись за линию. Верхний знак огибают, <b>оставляя его слева</b>; финиш — через линию.',
    how5: 'Вокруг лодки: <b>стрелка</b> — откуда дует ветер; <b>красное</b> — слишком остро к ветру, идти нельзя; <b>зелёные</b> метки — лучший угол на ветер; <b>синие</b> — лучший угол по ветру. Ветер гуляет на десять с лишним градусов в обе стороны каждую минуту-другую: когда он <b>отходит</b>, можно идти круче, когда <b>заходит</b> — поворачивай.',
    how4: 'Правила: левый галс уступает правому, наветренная — подветренной, догоняющая — идущей впереди; у знака — <b>зона</b> (пунктирный круг, три корпуса): если лодки связаны, когда первая в неё входит, место получает внутренняя, если не связаны — идущая впереди. Столкнулся, когда должен был уступить, — два штрафных оборота. Задел знак — один.',
    rotate: 'Поверните телефон горизонтально.', back: '← Назад в Sailing Certification Test',
    flagCls: 'Класс', flagP: 'Подгот.', flagX: 'Отзыв', kn: 'уз', drone: 'Дрон', helm: 'Штурвал', top: 'Сверху', tack: 'Поворот', gybe: 'Фордевинд', kite: 'Генакер', in: 'Выбрать', out: 'Травить',
    ok: 'Паруса в норме', pullIn: 'Выбери шкот', easeOut: 'Потрави шкот', irons: 'Левентик',
    startIn: 'Старт', lineStart: 'Линия старта', mark: 'Верхний знак', gate: 'Нижние ворота', finish: 'Финиш', ocsS: 'Фальстарт — вернись за линию',
    target: 'цель', vmg: 'VMG', line: 'линия', toLine: 'до линии', favPin: 'выгоднее у знака', favBoat: 'выгоднее у судна', square: 'линия ровная',
    sigWarn: (n) => `Предупредительный сигнал — флаг класса, ${n} мин`, sigPrep: (n) => `Подготовительный — флаг P, ${n} мин`, sig1: 'Одна минута — флаг P спущен', gun: 'Старт! Флаг класса спущен',
    ocs: 'Фальстарт! Флаг X — вернись за линию', cleared: 'Теперь стартуй', started: 'Отличный старт!', rounded: 'Знак пройден — уваливайся, ставь генакер',
    missedLine: 'Мимо линии — пересеки её между судейским судном и знаком', missedGate: 'Мимо ворот — вернись и пройди между двумя знаками', wrongSide: 'Знак оставляют слева — обогни его снова',
    gateMsg: 'Ворота пройдены — снова на ветер', bump: 'Столкновение!', broach: 'Брочинг! Трави шкот', kitedown: 'Слишком остро для генакера',
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
const opts = { preset: 'medium', fleet: 5, length: 'medium', laps: 1, autoTrim: 0, sound: 1, start: 1, current: 0, gfx: 'auto', guides: 1 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('regatta') || '{}')); } catch (e) {}
if (opts.fleetV !== 3) { opts.fleet = 5; opts.fleetV = 3; } // the default changed (10, then 7): start everyone on 5 once
const saveOpts = () => { try { localStorage.setItem('regatta', JSON.stringify(opts)); } catch (e) {} };
const paintOpts = () => document.querySelectorAll('.choice').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(opts[g.dataset.opt]) === b.dataset.v)));
paintOpts();
for (const g of document.querySelectorAll('.choice')) {
  const k = g.dataset.opt;
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    opts[k] = k === 'preset' || k === 'gfx' || k === 'length' ? b.dataset.v : +b.dataset.v; paintOpts(); saveOpts();
    if (k === 'gfx') { world.setQuality(startQuality()); perf.settle = 2; }
    if (k === 'guides') world.showGuides = !!opts.guides;
    if (k === 'sound') audio.setOn(!!opts.sound);
    if (k === 'autoTrim' && race && running) race.player.autoTrim = !!opts.autoTrim;
    if (k === 'preset' || k === 'laps' || k === 'start' || k === 'current') { if (!running) newRace(); else menuChanged = true; }
  });
}

// ---------- Telegram ----------
if (TG) {
  TG.ready(); TG.expand();
  try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && /android|iphone|ipad/i.test(navigator.userAgent)) TG.requestFullscreen(); } catch (e) {}
  TG.onEvent && TG.onEvent('themeChanged', () => applyTheme());
  TG.BackButton.show();
  TG.BackButton.onClick(() => { if (running && !paused) pause(); else location.href = '/'; });
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

let race = null, running = false, paused = false, menuChanged = false, hints = {}, lastClockInt = null;
function newRace() {
  race = new Race({ preset: opts.preset, laps: opts.laps, autoTrim: !!opts.autoTrim, start: opts.start, current: !!opts.current, fleet: opts.fleet, length: opts.length });
  race.player.name = t('you');
  world.setRace(race);
  world.resetView();
  hints = {}; lastClockInt = null;
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
let sheetPtr = null;
const autoOff = () => {
  if (!race.player.autoTrim) return;
  race.player.autoTrim = false; opts.autoTrim = 0; saveOpts(); paintOpts(); toast(t('autoOff'));
};
const setSheet = (v) => {
  const P = race.player; v = clamp(v, 0, 1);
  if (v < input.lastSheet - 0.012) { audio.click(); input.lastSheet = v; } // trimming in: the winch clicks
  else if (v > input.lastSheet) input.lastSheet = v;
  P.sheet = v;
};
const setSheetFrom = (y) => { const r = sheetEl.getBoundingClientRect(); setSheet((y - r.top) / r.height); };
sz.addEventListener('pointerdown', (e) => { sheetPtr = e.pointerId; sz.setPointerCapture(e.pointerId); autoOff(); input.lastSheet = race.player.sheet; setSheetFrom(e.clientY); e.preventDefault(); });
sz.addEventListener('pointermove', (e) => { if (e.pointerId === sheetPtr) setSheetFrom(e.clientY); });
const sheetUp = (e) => { if (e.pointerId === sheetPtr) sheetPtr = null; };
sz.addEventListener('pointerup', sheetUp); sz.addEventListener('pointercancel', sheetUp);

const tackBtn = $('#tackBtn'), kiteBtn = $('#kiteBtn');
const doTack = () => { if (!running || paused) return; race.player.tackOrGybe(); haptic('medium'); };
const doKite = () => { if (!running || paused) return; const P = race.player; if (Math.abs(P.twa) / D2R > 90) { P.kite = !P.kite; haptic('light'); } };
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
function startRace() {
  audio.init(); audio.setOn(!!opts.sound);
  if (running || menuChanged || race.over) newRace();
  menuChanged = false;
  menu.hidden = true; results.hidden = true; hud.hidden = false;
  running = true; paused = false;
  race.player.autoTrim = !!opts.autoTrim;
  setCam(world.mode);
  raceStarted(race, opts); // counted for the admins' Overview (stats.js)
}
function pause() { paused = true; menu.hidden = false; $('#resumeBtn').hidden = false; $('#goBtn').textContent = t('restart'); }
function resume() { if (menuChanged) { startRace(); return; } paused = false; menu.hidden = true; }
$('#goBtn').addEventListener('click', startRace);
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', pause);
$('#againBtn').addEventListener('click', () => { running = false; newRace(); startRace(); });
$('#menuBtn').addEventListener('click', () => { running = false; paused = false; newRace(); results.hidden = true; hud.hidden = true; menu.hidden = false; $('#resumeBtn').hidden = true; $('#goBtn').textContent = t('start'); });
if (TG) $('#backLink').addEventListener('click', (e) => { e.preventDefault(); location.href = '/'; });

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
  txt(el.trimTxt, t({ ok: 'ok', in: 'pullIn', out: 'easeOut', irons: 'irons' }[P.trim]));
  const ang = P.rudder * 70 * D2R; el.knob.setAttribute('cx', (105 + Math.sin(ang) * 84).toFixed(1)); el.knob.setAttribute('cy', (104 - Math.cos(ang) * 84).toFixed(1));
  const tol = 7 / 77, lo = clamp(sheetFor(idealSail(awa)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(awa) + P.depower) + tol, 0, 1);
  el.band.style.top = `${lo * 100}%`; el.band.style.height = `${(hi - lo) * 100}%`;
  el.band.style.display = a < 28 ? 'none' : '';
  el.sknob.style.top = `${P.sheet * 100}%`;
  sz.classList.toggle('auto', P.autoTrim);
  txt(tackBtn, t(a > 95 ? 'gybe' : 'tack'));
  tackBtn.classList.toggle('down', !!P.auto);
  kiteBtn.hidden = !(a > 90 || P.kite) || race.clock < 0;
  kiteBtn.classList.toggle('on', P.kite);

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
  const fk = `${race.flags.cls}${race.flags.P}${race.flags.X}`;
  if (fk !== flagsKey) {
    flagsKey = fk;
    const fig = (cls, inner, cap) => `<figure><i class="flag ${cls}">${inner}</i><figcaption>${t(cap)}</figcaption></figure>`;
    el.flags.innerHTML = (race.flags.cls ? fig('cls', 'R', 'flagCls') : '') + (race.flags.P ? fig('P', '', 'flagP') : '') + (race.flags.X ? fig('X', '', 'flagX') : '');
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
}

// messages from the race and the boat
function handleMessages() {
  const P = race.player;
  for (const m of race.messages) {
    const a = m.arg || {};
    if (m.key === 'signal') {
      audio.horn(a.sound === 'long'); haptic(a.key === 'gun' ? 'heavy' : 'medium');
      if (a.key === 'gun' && P.ocs) continue;
      toast(t(a.key, Math.round(-a.t / 60)), 3);
    } else if (m.key === 'finished' || m.key === 'finishedDsq') { raceFinished(race); toast(t(m.key, m.arg), 3); audio.horn(); haptic('heavy'); setTimeout(showResults, 2500); }
    else if (m.key === 'gate') toast(t('gateMsg'));
    else if (m.key === 'bump') { hint('bump', t('bump'), 3); haptic('heavy'); }
    else if (m.key === 'hail') { const h = t('hail' + a.rule); toast(`${a.who}: “${h}”`, 2.2); audio.say(h); haptic('warn'); }
    else if (m.key === 'fouled' || m.key === 'theyFouled') toast(t(m.key, a.who, a.rule), 3.5);
    else { toast(t(m.key), 2.6); if (m.key === 'ocs') haptic('warn'); if (m.key === 'rounded') haptic('medium'); }
  }
  race.messages.length = 0;
  for (const e of P.events) {
    if (e === 'broach') { toast(t('broach')); haptic('heavy'); }
    if (e === 'kitedown') toast(t('kitedown'));
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
function drawMap(ctx, size, full) {
  const c = race.course, P = race.player, W = race.wind.dir();
  const hw = Math.max(150, c.len / 2 + 40), x0 = -hw, x1 = hw, z0 = c.windward.z - 45, z1 = 140;
  const s = Math.min(size / (x1 - x0), size / (z1 - z0)), ox = size / 2 - ((x0 + x1) / 2) * s, oz = size / 2 - ((z0 + z1) / 2) * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, size, size);
  if (!full) for (const g of race.wind.gusts) {
    ctx.globalAlpha = 0.16 * g.s / race.wind.p.gustStr * Math.min(1, g.life / 6); ctx.fillStyle = COL.accent;
    ctx.beginPath(); ctx.arc(X(g.x), Z(g.z), g.r * s, 0, 7); ctx.fill();
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
  const cu = race.current;
  if (cu.x || cu.z) arrow(16, size - 18, Math.atan2(cu.x, -cu.z), COL.muted, 9);
}

function showResults() {
  if (!race.over) return;
  renderResults();
  drawMap($('#track').getContext('2d'), 312, true);
  results.hidden = false; hud.hidden = true;
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
