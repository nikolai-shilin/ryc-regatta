// Regatta: the game loop, the touch controls, the HUD and the menus.
import { Race, D2R, KN, UP_TWA, clamp, idealSail, sheetFor } from './sim.js';
import { World } from './world.js';

const $ = (s) => document.querySelector(s);
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

// ---------- words ----------
const T = {
  en: {
    title: 'Regatta', sub: 'A windward–leeward race against three boats. Steer, trim, tack — and read the wind.',
    wind: 'Wind', light: 'Light · 6 kn', medium: 'Medium · 12 kn', strong: 'Strong · 19 kn', laps: 'Laps', sails: 'Sails',
    manual: 'I trim', auto: 'Auto-trim', sound: 'Sound', on: 'On', off: 'Off', start: 'Start race', resume: 'Resume', restart: 'Restart',
    how1: '<b>Left thumb</b>: slide on the arc to steer.', how2: '<b>Right thumb</b>: sheet slider — up pulls the sails in, down lets them out. Keep the telltales green.',
    how3: '<b>Tack</b> turns you through the wind; downwind it becomes <b>Gybe</b>. <b>Kite</b> sets the gennaker on a run.',
    how4: 'Dark patches on the water are gusts: ease the sheet before you heel too far. Start after the gun, round the yellow-arrow mark, finish through the line.',
    rotate: 'Turn your phone sideways for the best view.', back: '← Back to IYT Test',
    kn: 'kn', drone: 'Drone', helm: 'Helm', tack: 'Tack', gybe: 'Gybe', kite: 'Kite', in: 'In', out: 'Out',
    ok: 'Trim OK', pullIn: 'Pull in', easeOut: 'Ease out', irons: 'In irons',
    startIn: 'Start in', lineStart: 'Start line', mark: 'Windward mark', gate: 'Leeward gate', finish: 'Finish line', ocsS: 'OCS — return below the line',
    ocs: 'Over early! Go back below the line', cleared: 'Clear — now start', started: 'Good start!', rounded: 'Mark rounded — bear away',
    gateMsg: 'Through the gate — back upwind', gun: 'Go!', bump: 'Bump!', broach: 'Broach! Ease the sheet', kitedown: 'Too close to the wind for the kite',
    heelMsg: 'Too much heel — ease the sheet', ironsMsg: 'In irons — steer away from the wind', gust: 'Gust!', autoOff: 'Auto-trim off — you trim now',
    results: 'Results', again: 'Race again', menu: 'Menu', racing: 'racing…', you: 'You', paused: 'Paused',
    place: (n) => `${n}${['st', 'nd', 'rd'][n - 1] || 'th'}`, finished: (n) => `Finished ${n}${['st', 'nd', 'rd'][n - 1] || 'th'}!`,
  },
  ru: {
    title: 'Регата', sub: 'Гонка «апвинд — даунвинд» против трёх лодок. Рули, работай шкотом, делай повороты и читай ветер.',
    wind: 'Ветер', light: 'Слабый · 6 уз', medium: 'Средний · 12 уз', strong: 'Сильный · 19 уз', laps: 'Круги', sails: 'Паруса',
    manual: 'Сам', auto: 'Авто', sound: 'Звук', on: 'Вкл', off: 'Выкл', start: 'Начать гонку', resume: 'Продолжить', restart: 'Заново',
    how1: '<b>Левый палец</b>: веди по дуге, чтобы рулить.', how2: '<b>Правый палец</b>: шкот — вверх выбрать, вниз потравить. Колдунчики должны быть зелёными.',
    how3: '<b>Поворот</b> — оверштаг через ветер; на полных курсах он становится <b>фордевиндом</b>. <b>Генакер</b> — для попутного ветра.',
    how4: 'Тёмные пятна на воде — порывы: потрави шкот, пока крен не стал слишком большим. Стартуй после сигнала, обогни знак под жёлтой стрелкой, финишируй через линию.',
    rotate: 'Поверните телефон горизонтально.', back: '← Назад в IYT Test',
    kn: 'уз', drone: 'Дрон', helm: 'Штурвал', tack: 'Поворот', gybe: 'Фордевинд', kite: 'Генакер', in: 'Выбрать', out: 'Травить',
    ok: 'Паруса в норме', pullIn: 'Выбери шкот', easeOut: 'Потрави шкот', irons: 'Левентик',
    startIn: 'Старт через', lineStart: 'Линия старта', mark: 'Верхний знак', gate: 'Нижние ворота', finish: 'Финиш', ocsS: 'Фальстарт — вернись за линию',
    ocs: 'Фальстарт! Вернись за линию', cleared: 'Теперь стартуй', started: 'Отличный старт!', rounded: 'Знак пройден — уваливайся',
    gateMsg: 'Ворота пройдены — снова на ветер', gun: 'Старт!', bump: 'Столкновение!', broach: 'Брочинг! Трави шкот', kitedown: 'Слишком остро для генакера',
    heelMsg: 'Сильный крен — потрави шкот', ironsMsg: 'Левентик — уваливайся', gust: 'Порыв!', autoOff: 'Автоподбор выключен — шкот твой',
    results: 'Результаты', again: 'Ещё гонку', menu: 'Меню', racing: 'в гонке…', you: 'Вы', paused: 'Пауза',
    place: (n) => `${n}-е`, finished: (n) => `Финиш: ${n}-е место!`,
  },
};
const urlLang = new URLSearchParams(location.search).get('lang');
const LANG = urlLang === 'ru' || urlLang === 'en' ? urlLang
  : /^(ru|uk|be|kk)\b/i.test((TG && TG.initDataUnsafe?.user?.language_code) || navigator.language || '') ? 'ru' : 'en';
const t = (k, ...a) => { const v = T[LANG][k] ?? T.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
const fmt = (s) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

// ---------- settings ----------
const opts = { preset: 'medium', laps: 1, autoTrim: 0, sound: 1 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('regatta') || '{}')); } catch (e) {}
const saveOpts = () => { try { localStorage.setItem('regatta', JSON.stringify(opts)); } catch (e) {} };
for (const g of document.querySelectorAll('.choice')) {
  const k = g.dataset.opt;
  const paint = () => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(opts[k]) === b.dataset.v));
  paint();
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    opts[k] = k === 'preset' ? b.dataset.v : +b.dataset.v; paint(); saveOpts();
    if (k === 'sound') audio.setOn(!!opts.sound);
    if (k === 'autoTrim' && race && running) race.player.autoTrim = !!opts.autoTrim;
    if (k === 'preset' || k === 'laps') { if (!running) newRace(); else menuChanged = true; }
  });
}

// ---------- Telegram ----------
if (TG) {
  TG.ready(); TG.expand();
  try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && /android|iphone|ipad/i.test(navigator.userAgent)) TG.requestFullscreen(); } catch (e) {}
  try { TG.setHeaderColor && TG.setHeaderColor('#0b3550'); } catch (e) {}
  TG.BackButton.show();
  TG.BackButton.onClick(() => { if (running && !paused) pause(); else location.href = '/'; });
}
const haptic = (kind) => {
  try { if (TG && TG.HapticFeedback) kind === 'warn' ? TG.HapticFeedback.notificationOccurred('warning') : TG.HapticFeedback.impactOccurred(kind || 'light'); else navigator.vibrate && navigator.vibrate(kind === 'heavy' ? 40 : 15); } catch (e) {}
};

// ---------- sound ----------
const audio = {
  ctx: null, on: !!opts.sound, windGain: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // wind and water: filtered noise
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6; }
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
      src.connect(f).connect(this.windGain).connect(this.ctx.destination); src.start();
    } catch (e) { this.ctx = null; }
  },
  setOn(v) { this.on = v; if (this.windGain) this.windGain.gain.value = 0; },
  tone(freq, dur, type = 'sine', vol = 0.25) {
    if (!this.on || !this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), n = this.ctx.currentTime;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(vol, n + 0.02); g.gain.setValueAtTime(vol, n + dur - 0.05); g.gain.linearRampToValueAtTime(0, n + dur);
    o.connect(g).connect(this.ctx.destination); o.start(n); o.stop(n + dur + 0.02);
  },
  horn() { this.tone(233, 1.1, 'sawtooth', 0.12); this.tone(466, 1.1, 'square', 0.04); },
  wind(level) { if (this.windGain && this.on) this.windGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3); },
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

let race = null, running = false, paused = false, menuChanged = false, hints = {}, lastClockInt = null;
function newRace() {
  race = new Race({ preset: opts.preset, laps: opts.laps, autoTrim: !!opts.autoTrim });
  race.player.name = t('you');
  world.setRace(race);
  world.resetView();
  hints = {}; lastClockInt = null;
}
newRace();

// ---------- controls ----------
const input = { rudderHeld: false, rudder: 0, keys: {} };
// rudder: drag sideways anywhere in the bottom-left zone
const rz = $('#rudderZone');
let rudderPtr = null, rudderX0 = 0;
rz.addEventListener('pointerdown', (e) => {
  rudderPtr = e.pointerId; rudderX0 = e.clientX - input.rudder * 80; input.rudderHeld = true;
  rz.setPointerCapture(e.pointerId); race.player.auto = null; e.preventDefault();
});
rz.addEventListener('pointermove', (e) => { if (e.pointerId === rudderPtr) input.rudder = clamp((e.clientX - rudderX0) / 80, -1, 1); });
const rudderUp = (e) => { if (e.pointerId === rudderPtr) { rudderPtr = null; input.rudderHeld = false; } };
rz.addEventListener('pointerup', rudderUp); rz.addEventListener('pointercancel', rudderUp);

// sheet: the thumb's height on the slider is the sheet (top = all in)
const sz = $('#sheetZone'), sheetEl = $('#sheet');
let sheetPtr = null;
const setSheetFrom = (y) => {
  const r = sheetEl.getBoundingClientRect();
  race.player.sheet = clamp((y - r.top) / r.height, 0, 1);
};
sz.addEventListener('pointerdown', (e) => {
  sheetPtr = e.pointerId; sz.setPointerCapture(e.pointerId);
  if (race.player.autoTrim) { race.player.autoTrim = false; opts.autoTrim = 0; saveOpts(); document.querySelectorAll('[data-opt="autoTrim"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === '0')); toast(t('autoOff')); }
  setSheetFrom(e.clientY); e.preventDefault();
});
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

// keyboard, for a computer: ←/→ steer, ↑/↓ sheet, space tack, K kite, C camera, Esc pause
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); doTack(); }
  if (e.code === 'KeyK') doKite();
  if (e.code === 'KeyC') setCam(world.mode === 'drone' ? 'helm' : 'drone');
  if (e.code === 'Escape' || e.code === 'KeyP') { if (running) paused ? resume() : pause(); }
  if ((e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') && race.player.autoTrim) { race.player.autoTrim = false; opts.autoTrim = 0; saveOpts(); toast(t('autoOff')); }
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// cameras
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
}
function pause() { paused = true; menu.hidden = false; $('#resumeBtn').hidden = false; $('#goBtn').textContent = t('restart'); audio.wind(0); }
function resume() { if (menuChanged) { startRace(); return; } paused = false; menu.hidden = true; }
$('#goBtn').addEventListener('click', startRace);
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', pause);
$('#againBtn').addEventListener('click', () => { running = false; newRace(); startRace(); });
$('#menuBtn').addEventListener('click', () => { running = false; paused = false; newRace(); results.hidden = true; hud.hidden = true; menu.hidden = false; $('#resumeBtn').hidden = true; $('#goBtn').textContent = t('start'); });
if (TG) $('#backLink').addEventListener('click', (e) => { e.preventDefault(); location.href = '/'; });

// ---------- HUD ----------
const el = { spd: $('#spd'), status: $('#status'), trim: $('#trim'), trimTxt: $('#trimTxt'), arrow: $('#windArrow'), tws: $('#twsTxt'),
  needle: $('#heelNeedle'), heelTxt: $('#heelTxt'), knob: $('#rudderKnob'), band: $('#sheet .band'), sknob: $('#sheet .knob'), toast: $('#toast'), count: $('#count') };
let toastT = 0;
function toast(msg, secs = 2.2) { el.toast.textContent = msg; el.toast.classList.add('show'); toastT = secs; }
function hint(key, msg, every = 12) { const n = race.clock; if (hints[key] && n - hints[key] < every) return; hints[key] = n; toast(msg); }

const legName = { start: 'lineStart', mark: 'mark', gate: 'gate', finish: 'finish' };
function updateHud(dt) {
  const P = race.player, a = Math.abs(P.twa) / D2R;
  el.spd.textContent = (P.v / KN).toFixed(1);
  el.arrow.setAttribute('transform', `rotate(${(P.twa / D2R).toFixed(1)})`);
  el.tws.textContent = `${P.tws.toFixed(0)} ${t('kn')}`;
  const side = P.twa >= 0 ? 1 : -1;
  el.needle.setAttribute('transform', `rotate(${(side * P.heel).toFixed(1)})`);
  el.needle.setAttribute('stroke', P.heel > 35 ? '#ff4d3d' : P.heel > 28 ? '#ffb020' : '#fff');
  el.heelTxt.textContent = `${P.heel.toFixed(0)}°`;
  el.trim.dataset.s = P.trim;
  el.trimTxt.textContent = t({ ok: 'ok', in: 'pullIn', out: 'easeOut', irons: 'irons' }[P.trim]);
  // rudder knob along the arc
  const ang = P.rudder * 70 * D2R; el.knob.setAttribute('cx', (105 + Math.sin(ang) * 84).toFixed(1)); el.knob.setAttribute('cy', (104 - Math.cos(ang) * 84).toFixed(1));
  // sheet slider: the knob, and the green band where the trim is right
  const tol = 7 / 76, lo = clamp(sheetFor(idealSail(a)) - tol, 0, 1), hi = clamp(sheetFor(idealSail(a) + P.depower) + tol, 0, 1);
  el.band.style.top = `${lo * 100}%`; el.band.style.height = `${(hi - lo) * 100}%`;
  el.band.style.display = a < 30 ? 'none' : '';
  el.sknob.style.top = `${P.sheet * 100}%`;
  sz.classList.toggle('auto', P.autoTrim);
  // buttons
  const gybe = a > 95;
  tackBtn.textContent = t(gybe ? 'gybe' : 'tack');
  tackBtn.classList.toggle('down', !!P.auto);
  kiteBtn.hidden = !(a > 90 || P.kite) || race.clock < 0;
  kiteBtn.classList.toggle('on', P.kite);
  // status line
  const leg = race.course.legs[P.leg];
  el.status.classList.toggle('bad', P.ocs);
  if (P.ocs) el.status.textContent = t('ocsS');
  else if (race.clock < 0) el.status.textContent = `${t('startIn')} ${fmt(-race.clock + 0.999)}`;
  else if (P.done) el.status.textContent = `${t('place', P.place)} · ${fmt(P.finish)}`;
  else {
    const place = race.standings().indexOf(P) + 1, d = race.distToNext(P);
    el.status.textContent = `${fmt(race.clock)} · ${t(legName[leg])} ${Math.round(d)} m · ${t('place', place)}`;
  }
  // the last ten seconds, big
  const left = -race.clock;
  el.count.textContent = race.clock < 0 && left <= 10 ? String(Math.ceil(left)) : '';
  // sounds and signals of the start
  const ci = Math.ceil(-race.clock);
  if (race.clock < 0 && ci !== lastClockInt) {
    if (lastClockInt !== null && (ci === 30 || ci <= 10)) { audio.tone(ci <= 3 ? 1046 : 880, ci === 30 ? 0.35 : 0.12); if (ci <= 3) haptic('light'); }
    lastClockInt = ci;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }
  audio.wind(Math.min(0.5, 0.05 + P.tws / 60 + P.v / 40) * (paused ? 0 : 1));
}

// messages from the race and the boat
function handleMessages() {
  const P = race.player;
  for (const m of race.messages) {
    if (m.key === 'gun') { audio.horn(); haptic('heavy'); if (!P.ocs) toast(t('gun')); }
    else if (m.key === 'finished') { toast(t('finished', m.arg), 3); audio.horn(); haptic('heavy'); setTimeout(showResults, 2500); }
    else if (m.key === 'gate') toast(t('gateMsg'));
    else if (m.key === 'bump') hint('bump', t('bump'), 3);
    else { toast(t(m.key)); if (m.key === 'ocs') { audio.tone(523, 0.6, 'square', 0.1); haptic('warn'); } if (m.key === 'rounded') haptic('medium'); }
  }
  race.messages.length = 0;
  for (const e of P.events) {
    if (e === 'broach') { toast(t('broach')); haptic('heavy'); }
    if (e === 'kitedown') toast(t('kitedown'));
  }
  P.events.length = 0;
  for (const b of race.boats) if (b !== P) b.events.length = 0;
  // coaching, now and then
  if (P.heel > 33) hint('heel', t('heelMsg'), 10);
  if (P.trim === 'irons' && P.v < 0.6 && !P.auto && race.clock > -50) hint('irons', t('ironsMsg'), 10);
  if (P.gust > 0.55) hint('gust', t('gust'), 15);
}

// ---------- minimap ----------
const mini = $('#mini'), mctx = mini.getContext('2d');
function drawMap(ctx, size, full) {
  const c = race.course, P = race.player, W = race.wind.dir();
  const x0 = -150, x1 = 150, z0 = c.windward.z - 45, z1 = 140;
  const s = Math.min(size / (x1 - x0), size / (z1 - z0)), ox = size / 2 - ((x0 + x1) / 2) * s, oz = size / 2 - ((z0 + z1) / 2) * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, size, size);
  // gusts, as dark patches
  if (!full) for (const g of race.wind.gusts) {
    ctx.fillStyle = `rgba(0, 8, 20, ${(0.35 * g.s / race.wind.p.gustStr * Math.min(1, g.life / 6)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(X(g.x), Z(g.z), g.r * s, 0, 7); ctx.fill();
  }
  // laylines to the windward mark
  const leg = c.legs[P.leg];
  if (leg === 'mark' || full) {
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    for (const sd of [-1, 1]) {
      const hd = W + sd * UP_TWA * D2R, L = 600;
      ctx.beginPath(); ctx.moveTo(X(c.windward.x), Z(c.windward.z)); ctx.lineTo(X(c.windward.x - Math.sin(hd) * L), Z(c.windward.z + Math.cos(hd) * L)); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // line
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(X(c.pin.x), Z(0)); ctx.lineTo(X(c.committee.x), Z(0)); ctx.stroke(); ctx.setLineDash([]);
  // marks
  const next = leg === 'mark' ? [c.windward] : leg === 'gate' ? c.gate : [c.pin, c.committee];
  for (const m of [c.windward, ...c.gate, c.pin, c.committee]) {
    ctx.fillStyle = next.includes(m) && !full ? '#ffd400' : '#ff7a1a';
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), next.includes(m) && !full ? 4.5 : 3.5, 0, 7); ctx.fill();
  }
  // track
  const tr = P.track; if (tr.length > 1) {
    ctx.strokeStyle = full ? '#9fdcff' : 'rgba(159,220,255,.6)'; ctx.lineWidth = full ? 2 : 1.2;
    ctx.beginPath(); tr.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.lineTo(X(P.x), Z(P.z)); ctx.stroke();
  }
  // boats
  for (const b of race.boats) {
    ctx.save(); ctx.translate(X(b.x), Z(b.z)); ctx.rotate(b.h);
    ctx.fillStyle = b === P ? '#fff' : '#' + b.color.toString(16).padStart(6, '0');
    const k = b === P ? 1.3 : 1; ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(3.5 * k, 5 * k); ctx.lineTo(-3.5 * k, 5 * k); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // wind arrow
  ctx.save(); ctx.translate(size - 16, 16); ctx.rotate(W + Math.PI);
  ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, 3); ctx.lineTo(1.5, 3); ctx.lineTo(1.5, 9); ctx.lineTo(-1.5, 9); ctx.lineTo(-1.5, 3); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function showResults() {
  if (!race.over) return;
  renderResults();
  drawMap($('#track').getContext('2d'), 300, true);
  results.hidden = false; hud.hidden = true;
}
// the table keeps filling in as the others cross the line
function renderResults() {
  const st = race.standings();
  $('#resTitle').textContent = t('results');
  $('#resTable').innerHTML = st.map((b, i) => `<tr class="${b === race.player ? 'me' : ''}"><td>${i + 1}</td><td>${b === race.player ? t('you') : b.name}</td><td>${b.done ? fmt(b.finish) : t('racing')}</td></tr>`).join('');
}

// ---------- the loop ----------
let last = performance.now(), acc = 0, clockT = 0;
const STEP = 1 / 60;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  clockT += dt;
  const P = race.player;
  if (running && !paused) {
    // keyboard steering and sheet
    const kl = input.keys.ArrowLeft || input.keys.KeyA, kr = input.keys.ArrowRight || input.keys.KeyD;
    if (kl || kr) { input.rudderHeld = true; input._key = true; input.rudder = clamp(input.rudder + (kr ? 1 : -1) * dt * 2.5, -1, 1); P.auto = null; }
    else if (input._key) { input._key = false; input.rudderHeld = rudderPtr !== null; }
    if (input.keys.ArrowUp || input.keys.KeyW) P.sheet = clamp(P.sheet - dt * 0.6, 0, 1);
    if (input.keys.ArrowDown || input.keys.KeyS) P.sheet = clamp(P.sheet + dt * 0.6, 0, 1);
    if (!input.rudderHeld) input.rudder *= Math.exp(-dt * 5);
    if (!P.auto) P.rudder = input.rudder; else input.rudder = 0;
    acc += dt;
    while (acc >= STEP) { race.step(STEP); acc -= STEP; }
    handleMessages();
    updateHud(dt);
    drawMap(mctx, 236, false);
    if (!results.hidden && Math.floor(clockT) !== Math.floor(clockT - dt)) renderResults();
  } else if (!running) {
    // behind the menu: the boats drift on the start area and the drone circles
    world.orbit += dt * 0.12;
  }
  world.frame(running && !paused ? dt : 0, clockT);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (/[?&]debug\b/.test(location.search)) window.__rg = { get race() { return race; }, world };
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) pause(); });
