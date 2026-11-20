// Audio & graphics: the one place the picture and the sound of every 3D scene are set. It opens over whatever screen
// asks for it: the race's pause menu (main.js), and on the site the race hub, the free race's set-up, /settings and the
// header's menu (components/av-row.tsx). The race's page has no React, so this is plain DOM, with its look in here too.
//
// It doesn't know where the settings live: `read` gives them and `write` saves a change, which the game applies to the
// race and the site tells the page's music about (lib/opts.ts saveOpts). The views behind the pages hear of it themselves
// (gfx.js followSettings).
import { GFX_PARTS, autoEased, gfxDetail, startQuality } from './gfx.js';

const CSS = `
.av { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: var(--s-4); background: rgba(3, 8, 14, 0.62); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); color: var(--ink); font-family: var(--sans); text-align: left; text-shadow: none; }
.av, .av * { box-sizing: border-box; }
.av-card { display: flex; flex-direction: column; width: min(880px, 100%); max-height: 100%; background: rgb(8, 13, 21); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); animation: av-in .25s var(--ease) both; }
@keyframes av-in { from { opacity: 0; transform: translateY(10px); } }
.av-top { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding-left: var(--s-5); border-bottom: 1px solid var(--rule); }
.av-top h2 { min-width: 0; margin: 0; font: 700 var(--fs-title)/1 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; }
.av-back { flex: none; height: var(--h-l); padding: 0 var(--s-5); border: 0; border-radius: 0; background: var(--fill-2); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; cursor: pointer; }
.av-back:hover { background: var(--w-14); }
.av-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--s-2) var(--s-10); padding: var(--s-2) var(--s-5) var(--s-5); overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-color: var(--w-25) transparent; }
.av-g { display: flex; flex-direction: column; min-width: 0; }
.av-g h3 { margin: 0; padding: var(--s-4) 0 var(--s-2); border-bottom: 1px solid var(--rule); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink); }
.av-row { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: var(--h-l); padding: var(--s-1) 0; border-bottom: 1px solid var(--rule-2); }
.av-k { min-width: 0; font: 500 var(--fs-body)/1.3 var(--sans); color: var(--ink); }
.av-seg { flex-direction: column; align-items: stretch; gap: var(--s-2); padding: var(--s-3) 0; }
.av-opts { display: flex; flex-wrap: wrap; gap: var(--s-1); }
.av-opts button { flex: 1 1 auto; height: var(--h-m); padding: 0 var(--s-3); border: 0; border-radius: 0; background: var(--fill-2); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; white-space: nowrap; cursor: pointer; transition: background-color var(--t-quick), color var(--t-quick), scale .12s; }
.av-opts button:hover { background: var(--w-14); }
.av-opts button:active { scale: .97; }
.av-opts button[aria-checked="true"] { background: var(--you); color: var(--ink-on); }
.av-hint { margin: 0; font: 500 var(--fs-small)/1.45 var(--sans); color: var(--ink-3); }
.av-sw { position: relative; flex: none; width: 52px; height: 28px; padding: 0; border: 0; border-radius: 0; background: var(--fill-3); cursor: pointer; transition: background-color var(--t-quick); }
.av-sw::after { content: ''; position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; background: var(--ink); transition: left var(--t-quick) var(--ease), background-color var(--t-quick); }
.av-sw[aria-checked="true"] { background: var(--you); }
.av-sw[aria-checked="true"]::after { left: 28px; background: var(--ink-on); }
.av-det { display: flex; flex-direction: column; border-bottom: 1px solid var(--rule-2); }
.av-det-t { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); width: 100%; height: var(--h-m); padding: 0; border: 0; background: none; color: var(--ink-2); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; cursor: pointer; }
.av-det-t:hover { color: var(--ink); }
.av-det-t::after { content: ''; width: 7px; height: 7px; margin-right: var(--s-1); border: solid currentColor; border-width: 0 2px 2px 0; transform: translateY(-2px) rotate(45deg); transition: transform .15s; }
.av-det-t[aria-expanded="true"]::after { transform: translateY(2px) rotate(-135deg); }
.av-det-b { display: flex; flex-direction: column; padding-bottom: var(--s-2); }
.av-det-b[hidden] { display: none; }
.av-part { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s-1) var(--s-3); padding: var(--s-1) 0; }
.av-part .av-k { flex: 1 1 130px; font-size: var(--fs-small); color: var(--ink-2); }
.av-part .av-opts { flex: 1 1 200px; flex-wrap: nowrap; }
.av-part .av-opts button { flex: 1 1 0; min-width: 0; height: var(--h-s); padding: 0 var(--s-1); font-size: var(--fs-label); letter-spacing: var(--ls-name); }
.av button:focus-visible { outline: 2px solid var(--you); outline-offset: 2px; }
@media (pointer: coarse) { .av-part .av-opts button { height: 40px; } }
@media (min-width: 760px) { .av-body { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 559px), (max-height: 519px) {
  .av { padding: 0; }
  .av-card { width: 100%; height: 100%; }
  .av-top { padding-top: env(safe-area-inset-top); padding-left: max(var(--s-5), env(safe-area-inset-left)); padding-right: env(safe-area-inset-right); }
  .av-body { padding-left: max(var(--s-5), env(safe-area-inset-left)); padding-right: max(var(--s-5), env(safe-area-inset-right)); padding-bottom: max(var(--s-5), env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion: reduce) { .av-card { animation: none; } }
`;

const LEVEL = { high: ['High', 'Макс.', 'Alta', 'Hoch', 'Yüksek', 'Élevée'], medium: ['Medium', 'Сред.', 'Media', 'Mittel', 'Orta', 'Moyenne'], low: ['Low', 'Мин.', 'Baja', 'Niedrig', 'Düşük', 'Basse'] };
const CHOICE = { auto: ['Auto', 'Авто', 'Auto', 'Auto', 'Otomatik', 'Auto'], ...LEVEL, custom: ['Custom', 'Своя', 'Personalizada', 'Eigene', 'Özel', 'Personnalisée'] };
const TRACK = { playlist: ['Playlist', 'Плейлист', 'Lista', 'Playlist', 'Çalma listesi', 'Playlist'], racing: ['Racing', 'Гонка', 'Regata', 'Racing', 'Yarış', 'Régate'], groove: ['Groove', 'Грув', 'Groove', 'Groove', 'Groove', 'Groove'], riff: ['Riff', 'Рифф', 'Riff', 'Riff', 'Riff', 'Riff'], openwater: ['Open water', 'Простор', 'Mar abierto', 'Offenes Wasser', 'Açık deniz', 'Grand large'] };
// the costliest first: resolution, shadows, the sea and its reflection
const GFX_NAMES = {
  res: ['Resolution', 'Разрешение', 'Resolución', 'Auflösung', 'Çözünürlük', 'Résolution'],
  shadows: ['Shadows', 'Тени', 'Sombras', 'Schatten', 'Gölgeler', 'Ombres'],
  sea: ['Waves', 'Волны', 'Olas', 'Wellen', 'Dalgalar', 'Vagues'],
  refl: ['Reflections', 'Отражения', 'Reflejos', 'Spiegelungen', 'Yansımalar', 'Reflets'],
  post: ['Glow and smoothing', 'Свечение и сглаживание', 'Brillo y suavizado', 'Glühen und Glättung', 'Parlama ve yumuşatma', 'Halo et lissage'],
  wakes: ['Wakes and spray', 'Кильватер и брызги', 'Estelas y salpicaduras', 'Kielwasser und Gischt', 'İz ve serpinti', 'Sillages et embruns'],
  under: ['Hulls under water', 'Корпуса под водой', 'Cascos bajo el agua', 'Rümpfe unter Wasser', 'Su altındaki gövdeler', 'Coques sous l’eau'],
  land: ['Shore and trees', 'Берег и деревья', 'Costa y árboles', 'Ufer und Bäume', 'Kıyı ve ağaçlar', 'Côte et arbres'],
  life: ['Gulls, dolphins and crew', 'Птицы, дельфины, экипаж', 'Gaviotas, delfines y tripulación', 'Möwen, Delfine und Crew', 'Martılar, yunuslar ve mürettebat', 'Mouettes, dauphins et équipage'],
};
// whether each one's lowest is off
const GFX_OFF = { res: false, shadows: true, sea: false, refl: true, post: true, wakes: false, under: true, land: false, life: false };
const SOUND_NAMES = {
  sndVoices: ['Voices', 'Голоса', 'Voces', 'Stimmen', 'Sesler', 'Voix'],
  sndBoats: ['Sails, winches, hulls', 'Паруса, лебёдки, корпус', 'Velas, winches, cascos', 'Segel, Winschen, Rümpfe', 'Yelkenler, vinçler, gövdeler', 'Voiles, winchs, coques'],
  sndSignals: ['Horns and beeps', 'Сигналы и таймер', 'Bocinas y pitidos', 'Hörner und Pieptöne', 'Kornalar ve bipler', 'Cornes et bips'],
  sndAround: ['Gulls and the plane', 'Чайки и самолёт', 'Gaviotas y el avión', 'Möwen und das Flugzeug', 'Martılar ve uçak', 'Mouettes et l’avion'],
};

const at = (p, lang) => p[{ en: 0, ru: 1, es: 2, de: 3, tr: 4, fr: 5 }[lang] ?? 0] ?? p[0]; // [English, Russian, Spanish, German, Turkish, French]
export const avTitle = (lang) => at(['Audio & graphics', 'Звук и графика', 'Sonido y gráficos', 'Ton & Grafik', 'Ses ve grafik', 'Audio et graphismes'], lang);

// what's chosen, for the row that opens the menu: "Auto · Racing"
export function avSummary(o, lang) {
  const off = ['Sound off', 'Звук выкл', 'Sonido desactivado', 'Ton aus', 'Ses kapalı', 'Son coupé'], noMusic = ['Music off', 'Музыка выкл', 'Música desactivada', 'Musik aus', 'Müzik kapalı', 'Musique coupée'];
  const sound = !o.sound ? off : TRACK[o.music] || noMusic;
  return `${at(CHOICE[o.gfx] || CHOICE.auto, lang)} · ${at(sound, lang)}`;
}

// the graphics level alone, for the button in the head of a page's panel: "Auto"
export const avGfx = (o, lang) => at(CHOICE[o.gfx] || CHOICE.auto, lang);

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (cls, text) => { const b = el('button', cls, text); b.type = 'button'; return b; };

let shown = null, ids = 0; // the menu open now: its close

// lang: 'en', 'ru', 'es', 'de', 'tr' or 'fr'; read(): the settings; write(patch): save a change; now(): the level drawn on Auto, where a scene
// is running; zIndex: over what's on the page; onClose: called once it has closed. Gives back its close.
export function openAvMenu({ lang = 'en', read, write, now, zIndex = 1000, onClose }) {
  if (shown) return shown;
  if (!document.getElementById('av-css')) { const s = el('style', '', CSS); s.id = 'av-css'; document.head.append(s); }
  const t = (en, ru, es, de, tr, fr) => (lang === 'ru' ? ru : lang === 'es' ? es ?? en : lang === 'de' ? de ?? en : lang === 'tr' ? tr ?? en : lang === 'fr' ? fr ?? en : en), pair = ([en, ru, es, de, tr, fr]) => t(en, ru, es, de, tr, fr);
  let o = read();
  const paints = [];
  const paint = () => { o = read(); for (const p of paints) p(); };
  const set = (patch) => { write(patch); paint(); };

  // one of a few: its name over the buttons, the picked one in your colour
  const choice = (name, opts, get, pick, cls = 'av-row av-seg') => {
    const row = el('div', cls), k = el('span', 'av-k', name), g = el('div', 'av-opts');
    k.id = `av-l${++ids}`;
    g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-labelledby', k.id);
    const bs = opts.map(([v, label]) => {
      const b = button('', label);
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => pick(v));
      g.append(b);
      return [v, b];
    });
    paints.push(() => {
      const cur = get(), any = bs.some(([v]) => v === cur);
      bs.forEach(([v, b], i) => { b.setAttribute('aria-checked', String(v === cur)); b.tabIndex = v === cur || (!any && !i) ? 0 : -1; });
    });
    row.append(k, g);
    return row;
  };
  const key = (k, opts, fallback) => choice(opts.name, opts.list, () => o[k] ?? fallback, (v) => set({ [k]: v }));
  // on or off (fallback: what it is until it's been set)
  const toggle = (k, name, fallback = 0) => {
    const row = el('div', 'av-row'), l = el('span', 'av-k', name), b = button('av-sw');
    l.id = `av-l${++ids}`;
    b.setAttribute('role', 'switch'); b.setAttribute('aria-labelledby', l.id);
    b.addEventListener('click', () => set({ [k]: (o[k] ?? fallback) ? 0 : 1 }));
    paints.push(() => b.setAttribute('aria-checked', String(!!(o[k] ?? fallback))));
    row.append(l, b);
    return row;
  };
  // a list that opens under its name
  const details = (name, isOpen, rows) => {
    const box = el('div', 'av-det'), head = button('av-det-t', name), body = el('div', 'av-det-b');
    body.id = `av-d${++ids}`; body.append(...rows);
    head.setAttribute('aria-controls', body.id);
    const show = (v) => { body.hidden = !v; head.setAttribute('aria-expanded', String(v)); };
    head.addEventListener('click', () => show(body.hidden));
    show(isOpen);
    box.append(head, body);
    return { box, show };
  };

  const loud = [['loud', t('Loud', 'Громко', 'Alto', 'Laut', 'Yüksek', 'Fort')], ['normal', t('Normal', 'Обычно', 'Normal', 'Normal', 'Normal', 'Normal')], ['quiet', t('Quiet', 'Тихо', 'Bajo', 'Leise', 'Kısık', 'Doux')]];
  const level = [...loud, ['off', t('Off', 'Выкл', 'No', 'Aus', 'Kapalı', 'Non')]];

  // ---------- the picture ----------
  const pickGfx = (v) => {
    if (v !== 'custom') { set({ gfx: v }); return; }
    set({ gfx: 'custom', gfxD: gfxDetail(o) }); // Custom starts from the parts drawn now, and opens them
    gfxParts.show(true);
  };
  const quality = choice(t('Quality', 'Качество', 'Calidad', 'Qualität', 'Kalite', 'Qualité'), Object.entries(CHOICE).map(([v, n]) => [v, pair(n)]), () => o.gfx || 'auto', pickGfx);
  const hint = el('p', 'av-hint');
  quality.append(hint);
  paints.push(() => {
    const g = o.gfx || 'auto';
    if (g === 'custom') hint.textContent = t('Each part as you set it below. Resolution, shadows and reflections cost the most frames.', 'Каждая часть — как задано ниже. Больше всего кадров съедают разрешение, тени и отражения.', 'Cada parte como la ajustes abajo. La resolución, las sombras y los reflejos son lo que más fotogramas cuesta.', 'Jeder Teil so, wie du ihn unten einstellst. Auflösung, Schatten und Spiegelungen kosten die meisten Frames.', 'Her parça aşağıda ayarladığın gibi. Çözünürlük, gölgeler ve yansımalar en çok kare yer.', 'Chaque élément tel que tu le règles ci-dessous. La résolution, les ombres et les reflets sont ce qui coûte le plus d’images par seconde.');
    else if (g === 'auto') {
      const eased = autoEased(gfxDetail(o)).map((k) => pair(GFX_NAMES[k]));
      const head = `${t('Now:', 'Сейчас:', 'Ahora:', 'Jetzt:', 'Şimdi:', 'Maintenant :')} ${pair(LEVEL[(now && now()) || startQuality(o)] || LEVEL.high)}${eased.length ? ` · ${t('eased off:', 'снижено:', 'reducido:', 'reduziert:', 'kısıldı:', 'allégé :')} ${eased.join(', ')}` : ''}`;
      hint.textContent = `${head}${head.endsWith('.') ? '' : '.'} ${t('When the frame rate drops the game eases off what shows least first, brings it back when it can, and remembers it for this device.', 'Когда падает частота кадров, игра сначала снижает то, что меньше всего заметно, возвращает это, когда может, и запоминает для устройства.', 'Cuando baja la tasa de fotogramas, el juego reduce primero lo que menos se nota, lo recupera cuando puede y lo recuerda en este dispositivo.', 'Wenn die Bildrate sinkt, nimmt das Spiel zuerst zurück, was am wenigsten auffällt, bringt es zurück, sobald es kann, und merkt es sich für dieses Gerät.', 'Kare hızı düşünce oyun önce en az göze çarpanı kısar, olabildiğinde geri getirir ve bu cihaz için hatırlar.', 'Quand la fluidité baisse, le jeu allège d’abord ce qui se voit le moins, le rétablit dès qu’il le peut et s’en souvient pour cet appareil.')}`;
    }
    else hint.textContent = t('The race and every 3D scene on the site draw at this level.', 'Гонка и все 3D-сцены на сайте рисуются с этим качеством.', 'La regata y cada escena 3D del sitio se dibujan a este nivel.', 'Die Regatta und jede 3D-Szene auf der Seite zeichnen in dieser Stufe.', 'Yarış ve sitedeki her 3D sahne bu seviyede çizilir.', 'La régate et toutes les scènes 3D du site s’affichent à ce niveau.');
  });
  const partLevels = (off) => [['high', t('High', 'Макс.', 'Alta', 'Hoch', 'Yüksek', 'Élevée')], ['medium', t('Medium', 'Сред.', 'Media', 'Mittel', 'Orta', 'Moyenne')], ['low', off ? t('Off', 'Выкл', 'No', 'Aus', 'Kapalı', 'Non') : t('Low', 'Мин.', 'Baja', 'Niedrig', 'Düşük', 'Basse')]];
  const gfxParts = details(t('Details', 'Подробно', 'Detalles', 'Details', 'Ayrıntılar', 'Détails'), o.gfx === 'custom', GFX_PARTS.map((k) => choice(pair(GFX_NAMES[k]), partLevels(GFX_OFF[k]), () => gfxDetail(o)[k],
    (v) => set({ gfx: 'custom', gfxD: { ...gfxDetail(o), [k]: v } }), 'av-part'))); // a part changed makes it Custom

  // ---------- the sound ----------
  const soundParts = Object.keys(SOUND_NAMES);
  const soundDet = details(t('Sound details', 'Звук подробно', 'Detalles del sonido', 'Tondetails', 'Ses ayrıntıları', 'Détails du son'), soundParts.some((k) => (o[k] || 'normal') !== 'normal'),
    soundParts.map((k) => choice(pair(SOUND_NAMES[k]), level, () => o[k] || 'normal', (v) => set({ [k]: v }), 'av-part')));

  const group = (name, ...rows) => { const g = el('section', 'av-g'); g.append(el('h3', '', name), ...rows); return g; };
  const body = el('div', 'av-body');
  body.append(
    group(t('Graphics', 'Графика', 'Gráficos', 'Grafik', 'Grafik', 'Graphismes'), quality, gfxParts.box, toggle('figures', t('People on board', 'Люди на борту', 'Gente a bordo', 'Leute an Bord', 'Teknedeki insanlar', 'Personnes à bord'), 1), toggle('saver', t('Battery saver · 30 fps', 'Экономия батареи · 30 к/с', 'Ahorro de batería · 30 fps', 'Akkusparmodus · 30 fps', 'Pil tasarrufu · 30 fps', 'Économie de batterie · 30 fps'))),
    group(t('Audio', 'Звук', 'Audio', 'Audio', 'Ses', 'Audio'),
      toggle('sound', t('Sound', 'Звук', 'Sonido', 'Ton', 'Ses', 'Son')),
      toggle('voice', t('Voice on board', 'Голос шкипера', 'Voz a bordo', 'Stimme an Bord', 'Kaptanın sesi', 'Voix à bord')),
      key('music', { name: t('Music', 'Музыка', 'Música', 'Musik', 'Müzik', 'Musique'), list: [...Object.entries(TRACK).map(([v, n]) => [v, pair(n)]), ['off', t('Off', 'Выкл', 'No', 'Aus', 'Kapalı', 'Non')]] }, 'playlist'),
      key('musicVol', { name: t('Music volume', 'Громкость музыки', 'Volumen de la música', 'Musiklautstärke', 'Müzik sesi', 'Volume de la musique'), list: loud }, 'normal'),
      key('sea', { name: t('Sea', 'Море', 'Mar', 'Meer', 'Deniz', 'Mer'), list: level }, 'normal'),
      soundDet.box,
      ...(matchMedia('(pointer: coarse)').matches ? [toggle('vibration', t('Vibration', 'Вибрация', 'Vibración', 'Vibration', 'Titreşim', 'Vibration'))] : [])),
  );

  // ---------- the card over the screen ----------
  const ov = el('div', 'av bc'), card = el('section', 'av-card'), top = el('div', 'av-top'), h = el('h2', '', avTitle(lang)), back = button('av-back', t('Back', 'Назад', 'Atrás', 'Zurück', 'Geri', 'Retour'));
  h.id = `av-h${++ids}`;
  ov.style.zIndex = zIndex;
  ov.lang = lang;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', h.id);
  top.append(h, back); card.append(top, body); ov.append(card);

  const was = document.activeElement;
  const close = () => {
    if (shown !== close) return;
    shown = null;
    removeEventListener('keydown', keys, true);
    ov.remove();
    if (was && was.isConnected && was.focus) was.focus();
    if (onClose) onClose();
  };
  // the keys are the menu's while it's open: Esc closes it and not what's under it, and nothing reaches the race
  const keys = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const all = [...card.querySelectorAll('button')].filter((b) => b.tabIndex >= 0 && b.offsetParent !== null);
      const first = all[0], last = all[all.length - 1], at = document.activeElement;
      if (!card.contains(at) || at === (e.shiftKey ? first : last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step && e.target.getAttribute && e.target.getAttribute('role') === 'radio') {
      e.preventDefault();
      const rs = [...e.target.parentNode.children], next = rs[(rs.indexOf(e.target) + step + rs.length) % rs.length];
      next.click(); next.focus();
    }
  };
  back.addEventListener('click', close);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  addEventListener('keydown', keys, true);
  paint();
  document.body.append(ov);
  back.focus({ preventScroll: true });
  shown = close;
  return close;
}
