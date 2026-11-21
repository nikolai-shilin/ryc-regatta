// Sailing words: the race's dictionary, opened from the pause menu (main.js), over the race as Audio & graphics is and in
// its look (av-menu.js): the broadcast's square panel, its condensed labels, the picked one in your colour. The words are
// the site's glossary (lib/glossary.ts, /learn/glossary), in the race's language, from words.json (scripts/words.mjs
// writes it; npm test keeps it in step), fetched the first time the menu opens. A field finds a word in the names and
// the definitions, accents and case aside; the tabs keep one group.
//
// The race's page has no React, so this is plain DOM, with its look in here too. Fetched only when opened (main.js
// imports it then), so it costs the race's start nothing. The site's /dictionary is the same panel over the same
// water, drawn by React from WORDS_CSS, find and fold (components/dictionary-screen.tsx).

const CSS = `
.wd { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: var(--s-4); background: rgba(3, 8, 14, 0.62); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); color: var(--ink); font-family: var(--sans); text-align: left; text-shadow: none; }
.wd, .wd * { box-sizing: border-box; }
.wd-card { display: flex; flex-direction: column; width: min(960px, 100%); height: min(760px, 100%); background: rgb(8, 13, 21); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); animation: wd-in .25s var(--ease) both; }
@keyframes wd-in { from { opacity: 0; transform: translateY(10px); } }
.wd-top { flex: none; display: flex; align-items: center; gap: var(--s-3); padding-left: var(--s-5); border-bottom: 1px solid var(--rule); }
.wd-top h2 { min-width: 0; margin: 0; font: 700 var(--fs-title)/1 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wd-n { flex: none; margin-right: auto; padding: 3px var(--s-2); background: var(--fill-2); font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); color: var(--ink-3); }
.wd-back { flex: none; height: var(--h-l); padding: 0 var(--s-5); border: 0; border-radius: 0; background: var(--fill-2); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; cursor: pointer; }
.wd-back:hover { background: var(--w-14); }
.wd-bar { flex: none; display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-4) var(--s-5) var(--s-3); border-bottom: 1px solid var(--rule); }
.wd-find { position: relative; display: flex; }
.wd-find::before { content: ''; position: absolute; left: 14px; top: 50%; width: 16px; height: 16px; margin-top: -8px; background: var(--ink-3);
  -webkit-mask: var(--wd-lens) center / contain no-repeat; mask: var(--wd-lens) center / contain no-repeat; pointer-events: none;
  --wd-lens: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E"); }
.wd-q { flex: 1 1 auto; min-width: 0; height: var(--h-m); padding: 0 var(--h-m) 0 42px; border: 0; border-radius: 0; background: var(--fill-1); box-shadow: inset 0 -2px 0 var(--rule); color: var(--ink);
  font: 500 var(--fs-body)/1 var(--sans); -webkit-appearance: none; appearance: none; }
.wd-q::placeholder { color: var(--ink-3); }
.wd-q::-webkit-search-cancel-button { display: none; }
.wd-x { position: absolute; right: 0; top: 0; width: var(--h-m); height: var(--h-m); padding: 0; border: 0; border-radius: 0; background: none; color: var(--ink-3); font: 700 var(--fs-row)/1 var(--cond); cursor: pointer; }
.wd-x:hover { color: var(--ink); }
.wd-x[hidden] { display: none; }
.wd-tabs { display: flex; gap: var(--s-1); margin: 0 calc(-1 * var(--s-5)); padding: 0 var(--s-5); overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
.wd-tabs::-webkit-scrollbar { display: none; }
.wd-tabs button { flex: none; display: inline-flex; align-items: center; gap: var(--s-2); height: var(--h-s); padding: 0 var(--s-3); border: 0; border-radius: 0; background: var(--fill-2); color: var(--ink);
  font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; white-space: nowrap; cursor: pointer; transition: background-color var(--t-quick), color var(--t-quick), scale .12s; }
.wd-tabs button:hover { background: var(--w-14); }
.wd-tabs button:active { scale: .97; }
.wd-tabs button i { font-style: normal; color: var(--ink-3); }
.wd-tabs button[aria-checked="true"] { background: var(--you); color: var(--ink-on); }
.wd-tabs button[aria-checked="true"] i { color: var(--ink-on); opacity: .7; }
.wd-tabs button.none { color: var(--ink-3); }
.wd-body { flex: 1 1 auto; min-height: 0; padding: var(--s-2) var(--s-5) var(--s-6); overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-color: var(--w-25) transparent; }
.wd-cols { columns: 2 320px; column-gap: var(--s-10); }
.wd-g { margin: 0; }
.wd-g[hidden] { display: none; }
.wd-g h3 { display: flex; align-items: baseline; gap: var(--s-2); margin: 0; padding: var(--s-5) 0 var(--s-2); border-bottom: 1px solid var(--rule); break-after: avoid;
  font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink); }
.wd-g h3 b { font-weight: 700; color: var(--gold); }
.wd-g dl { margin: 0; }
.wd-w { padding: var(--s-3) 0 var(--s-3) var(--s-3); border-bottom: 1px solid var(--rule-2); border-left: 3px solid transparent; break-inside: avoid; }
.wd-w[hidden] { display: none; }
.wd-w dt { margin: 0 0 var(--s-1); font: 700 var(--fs-row)/1.1 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; color: var(--ink); }
.wd-w dd { margin: 0; font: 500 var(--fs-small)/1.5 var(--sans); color: var(--ink-2); text-wrap: pretty; }
.wd-w mark { background: color-mix(in srgb, var(--you) 34%, transparent); color: inherit; }
/* the English name, beside the name in another language: "Поворот оверштаг (tack)" */
.wd-en { font-weight: 600; color: var(--ink-3); }
dt > .wd-en { margin-left: .35em; }
/* what's dangerous about it (the crash gybe), in red */
.wd-warn { margin: var(--s-2) 0 0; padding: 6px 10px; background: #c8180f; color: #fff; font: 600 var(--fs-small)/1.45 var(--sans); text-wrap: pretty; }
.wd-warn[hidden] { display: none; }
.wd-w.hit { border-left-color: var(--you); }
.wd-say { margin: 0; padding: var(--s-8) 0; font: 500 var(--fs-body)/1.5 var(--sans); color: var(--ink-3); text-align: center; }
.wd-say[hidden] { display: none; }
.wd-say button { margin-left: var(--s-2); height: var(--h-s); padding: 0 var(--s-3); border: 0; border-radius: 0; background: var(--fill-2); color: var(--ink); font: 700 var(--fs-small)/1 var(--cond); letter-spacing: var(--ls-button); text-transform: uppercase; cursor: pointer; }
.wd-say button:hover { background: var(--w-14); }
.wd button:focus-visible { outline: 2px solid var(--you); outline-offset: 2px; }
@media (max-width: 559px), (max-height: 519px) {
  .wd { padding: 0; }
  .wd-card { width: 100%; height: 100%; }
  .wd-top { padding-top: env(safe-area-inset-top); padding-left: max(var(--s-5), env(safe-area-inset-left)); padding-right: env(safe-area-inset-right); }
  .wd-bar, .wd-body { padding-left: max(var(--s-5), env(safe-area-inset-left)); padding-right: max(var(--s-5), env(safe-area-inset-right)); }
  .wd-body { padding-bottom: max(var(--s-5), env(safe-area-inset-bottom)); }
  .wd-w dt { font-size: var(--fs-lead); }
}
@media (max-height: 519px) { .wd-bar { flex-direction: row; align-items: center; padding-top: var(--s-2); padding-bottom: var(--s-2); } .wd-find { flex: 0 1 300px; } .wd-tabs { flex: 1 1 0; margin: 0; padding: 0; } }
/* in the race, with its scenes: the panel at the side (at the foot on a phone held upright), the water open beside it */
.wd.staged { justify-content: flex-start; align-items: stretch; background: none; -webkit-backdrop-filter: none; backdrop-filter: none; pointer-events: none; }
.wd.staged .wd-card { pointer-events: auto; width: min(440px, 42vw); height: 100%; background: rgba(8, 13, 21, 0.94); }
.wd.staged .wd-cols { columns: 1; }
.wd.staged .wd-w { position: relative; padding-right: var(--s-2); cursor: pointer; transition: background-color var(--t-quick); }
.wd.staged .wd-w:hover { background: var(--w-06); }
.wd.staged .wd-w.on { background: color-mix(in srgb, var(--you) 14%, transparent); border-left-color: var(--you); }
.wd-pick { display: inline-flex; align-items: baseline; gap: var(--s-2); padding: 0; border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; text-align: left; cursor: pointer; }
.wd-pick::after { content: ''; position: absolute; inset: 0; }
.wd-3d { flex: none; padding: 2px 5px; background: var(--fill-2); font: 700 10px/1 var(--cond); letter-spacing: var(--ls-label); color: var(--ink-3); transform: translateY(-2px); }
.wd-w.on .wd-3d { background: var(--you); color: var(--ink-on); }
.wd-cap { position: fixed; display: flex; flex-direction: column; gap: var(--s-1); max-width: 620px; padding: var(--s-3) var(--s-4) var(--s-3) var(--s-4); border-left: 4px solid var(--gold); background: var(--panel); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); pointer-events: none; animation: wd-in .25s var(--ease) both; }
.wd-cap[hidden] { display: none; }
.wd-cap span { font: 700 var(--fs-label)/1 var(--cond); letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--gold); }
.wd-cap b { font: 700 var(--fs-title)/1.05 var(--cond); letter-spacing: var(--ls-name); text-transform: uppercase; color: var(--ink); }
.wd-cap p { margin: 0; font: 500 var(--fs-small)/1.45 var(--sans); color: var(--ink-2); }
.wd-cap em { margin-top: -2px; font: 600 var(--fs-label)/1.2 var(--cond); font-style: normal; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
.wd-cap em[hidden] { display: none; }
.wd-cap i { font: 600 var(--fs-label)/1.2 var(--cond); font-style: normal; letter-spacing: var(--ls-label); text-transform: uppercase; color: var(--ink-3); }
.wd-cap.top p { display: none; }
.wd-cap .wd-warn { margin: var(--s-1) 0 0; }
@media (max-width: 559px) and (orientation: portrait) { .wd.staged { align-items: flex-end; } .wd.staged .wd-card { width: 100%; height: 58%; } .wd.staged .wd-top { padding-top: 0; } .wd-cap b { font-size: var(--fs-row); } }
@media (max-height: 519px) and (orientation: landscape) { .wd.staged .wd-card { width: min(380px, 48vw); } }
@media (prefers-reduced-motion: reduce) { .wd-card, .wd-cap { animation: none; } }
`;

// the panel's look, the site's /dictionary too (components/dictionary-screen.tsx): one look, the race's
export const WORDS_CSS = CSS;

const LANG_AT = { en: 0, ru: 1, es: 2, de: 3, tr: 4, fr: 5, it: 6, pt: 7 };
const at = (p, lang) => p[LANG_AT[lang] ?? 0] ?? p[0]; // [English, Russian, Spanish, German, Turkish, French, Italian, Portuguese]
// (the pause menu's row says the same: main.js wordsK)
export const wordsTitle = (lang) => at(['Sailing words', 'Словарь яхтсмена', 'Palabras de vela', 'Segelwörter', 'Yelken sözlüğü', 'Mots de la voile', 'Parole della vela', 'Palavras da vela'], lang);

// a word as a search compares it: lower case in its own language, accents and ё/й marks aside ("Bahnmarkenraum",
// "bahnmarkenraum"; "évitement", "evitement"; "ёлка", "елка")
export const fold = (s, lang = 'en') => String(s).toLocaleLowerCase(lang).normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');

// The groups as they show for a search and a tab: each with its terms in order, each term with whether it shows and
// whether the search found it in its name or its English one (those come first: "tack" finds "Поворот оверштаг"). q: what's typed; tab: a group's id, or '' for all.
export function find(groups, q, tab = '', lang = 'en') {
  const parts = fold(q, lang).split(/\s+/).filter(Boolean);
  return groups.map((g) => {
    const terms = g.terms.map(([id, term, def, en = '', warn = '']) => {
      const name = `${fold(term, lang)} ${fold(en, 'en')}`, all = `${name} ${fold(def, lang)}`;
      const shown = parts.every((p) => all.includes(p));
      return { id, term, def, en, warn, shown, named: shown && parts.length > 0 && parts.every((p) => name.includes(p)) };
    });
    const order = [...terms.filter((x) => x.named), ...terms.filter((x) => !x.named)];
    const count = terms.filter((x) => x.shown).length;
    return { id: g.id, title: g.title, terms: order, count, shown: count > 0 && (!tab || tab === g.id) };
  });
}

// the words, fetched once a page (a failed fetch is tried again at the next opening)
const words = new Map();
const load = (url) => {
  if (!words.has(url)) words.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }).catch((e) => { words.delete(url); throw e; }));
  return words.get(url);
};

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (cls, text) => { const b = el('button', cls, text); b.setAttribute('type', 'button'); return b; };
// a term's name with what the search found in it marked
function named(dt, term, q, lang) {
  dt.textContent = '';
  const parts = fold(q, lang).split(/\s+/).filter(Boolean);
  const f = fold(term, lang);
  // folding keeps the length for these languages' letters, one for one, so a place in the folded name is one in the name
  if (!parts.length || f.length !== term.length) { dt.textContent = term; return; }
  const on = new Array(term.length).fill(false);
  for (const p of parts) for (let i = f.indexOf(p); i >= 0; i = f.indexOf(p, i + 1)) on.fill(true, i, i + p.length);
  let i = 0;
  while (i < term.length) {
    let j = i; while (j < term.length && on[j] === on[i]) j++;
    dt.append(on[i] ? el('mark', '', term.slice(i, j)) : document.createTextNode(term.slice(i, j)));
    i = j;
  }
}

let shown = null, ids = 0; // the menu open now: its close

// lang: the race's language; title: its name (wordsTitle's by default); url: where words.json is (main.js gives its
// address in the import map); zIndex: over what's on the page; onClose: called once it has closed. stage, in the race:
// its scenes (word-scenes.js) — ids, the words that have one; show(id), true when it's shown on the water; view(rect),
// the part of the screen the panel leaves open. Gives back its close.
export function openWords({ lang = 'en', title = wordsTitle(lang), url, zIndex = 1000, onClose, stage = null }) {
  if (shown) return shown;
  if (!document.getElementById('wd-css')) { const s = el('style', '', CSS); s.id = 'wd-css'; document.head.append(s); }
  const t = (...p) => at(p, lang);
  // a keyboard's player can type at once, in the field as soon as the words are in; on a touch screen it waits for a
  // tap (its keyboard would cover the words)
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

  const ov = el('div', stage ? 'wd bc staged' : 'wd bc'), card = el('section', 'wd-card'), top = el('div', 'wd-top'), h = el('h2', '', title), n = el('span', 'wd-n');
  const back = button('wd-back', t('Back', 'Назад', 'Atrás', 'Zurück', 'Geri', 'Retour', 'Indietro', 'Voltar'));
  const bar = el('div', 'wd-bar'), findBox = el('div', 'wd-find'), q = el('input', 'wd-q'), x = button('wd-x', '×'), tabs = el('div', 'wd-tabs');
  const body = el('div', 'wd-body'), cols = el('div', 'wd-cols'), say = el('p', 'wd-say');
  h.id = `wd-h${++ids}`;
  n.hidden = true;
  ov.style.zIndex = zIndex;
  ov.lang = lang;
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', h.id);
  q.type = 'search';
  q.placeholder = t('Find a word', 'Найти слово', 'Buscar una palabra', 'Wort suchen', 'Sözcük ara', 'Chercher un mot', 'Cerca una parola', 'Buscar uma palavra');
  q.setAttribute('aria-label', q.placeholder);
  q.setAttribute('autocomplete', 'off'); q.setAttribute('spellcheck', 'false'); q.setAttribute('enterkeyhint', 'search');
  x.setAttribute('aria-label', t('Clear', 'Очистить', 'Borrar', 'Löschen', 'Temizle', 'Effacer', 'Cancella', 'Limpar'));
  x.hidden = true;
  tabs.setAttribute('role', 'radiogroup'); tabs.setAttribute('aria-label', t('Topics', 'Темы', 'Temas', 'Themen', 'Konular', 'Thèmes', 'Argomenti', 'Temas'));
  findBox.append(q, x); bar.append(findBox, tabs);
  body.append(cols, say);
  top.append(h, n, back); card.append(top, bar, body); ov.append(card);
  // what's shown on the water: its group, its name, its words (a word with no scene says so, and the race is in view)
  const cap = el('div', 'wd-cap'), capK = el('span'), capT = el('b'), capE = el('em', 'wd-cap-en'), capP = el('p'), capW = el('p', 'wd-warn'), capN = el('i');
  capE.lang = 'en'; capE.hidden = true;
  cap.hidden = true; cap.setAttribute('aria-live', 'polite'); capW.hidden = true;
  cap.append(capK, capT, capE, capP, capW, capN);
  if (stage) ov.append(cap);
  const has = new Set(stage?.ids || []);
  bar.hidden = true;
  say.textContent = t('Loading the words…', 'Загружаем слова…', 'Cargando las palabras…', 'Die Wörter werden geladen…', 'Sözcükler yükleniyor…', 'Chargement des mots…', 'Caricamento delle parole…', 'Carregando as palavras…');

  let groups = [], tab = '', paint = () => {};
  const build = (data) => {
    groups = data[lang] || data.en || [];
    const total = groups.reduce((s, g) => s + g.terms.length, 0);
    n.textContent = String(total); n.hidden = false;
    // a tab for all, then each group; a section for each group, a row for each term
    const tabBs = [['', t('All', 'Все', 'Todas', 'Alle', 'Tümü', 'Tous', 'Tutte', 'Todas')], ...groups.map((g) => [g.id, g.title])].map(([id, name]) => {
      const b = button('', name), c = el('i');
      b.setAttribute('role', 'radio'); b.dataset.g = id; b.append(c);
      b.addEventListener('click', () => { tab = id; paint(); body.scrollTop = 0; });
      tabs.append(b);
      return { id, b, c };
    });
    const secs = groups.map((g, i) => {
      const s = el('section', 'wd-g'), head = el('h3'), dl = el('dl');
      head.append(el('b', '', String(i + 1).padStart(2, '0')), el('span', '', g.title));
      const rows = new Map(g.terms.map(([id, term, def, en, warn]) => {
        const w = el('div', 'wd-w'), dt = el('dt'), dd = el('dd', '', def), wd = warn ? el('dd', 'wd-warn', warn) : null;
        const name = el('span', 'wd-tn'), eng = en ? el('span', 'wd-en') : null;
        if (eng) eng.lang = 'en';
        let pick = null;
        if (stage) { // a button: the word on the water
          pick = button('wd-pick');
          pick.append(name); if (eng) pick.append(eng); if (has.has(id)) pick.append(el('span', 'wd-3d', '3D'));
          pick.setAttribute('aria-pressed', 'false');
          pick.addEventListener('click', () => choose(id));
          dt.append(pick);
        } else { dt.append(name); if (eng) dt.append(eng); }
        name.textContent = term;
        if (eng) eng.textContent = `(${en})`;
        w.dataset.id = id; w.append(dt, dd); if (wd) w.append(wd); dl.append(w);
        return [id, { w, dt: name, eng, term, en, def, warn, pick, group: g.title }];
      }));
      s.append(head, dl); cols.append(s);
      return { s, dl, rows };
    });
    const rowOf = (id) => { for (const x of secs) if (x.rows.has(id)) return x.rows.get(id); return null; };
    // a word chosen: shown on the water, named in the caption, marked in the list
    choose = (id) => {
      const r = rowOf(id); if (!r) return;
      if (picked) { const p = rowOf(picked); p.w.classList.toggle('on', false); p.pick.setAttribute('aria-pressed', 'false'); }
      picked = id; r.w.classList.toggle('on', true); r.pick.setAttribute('aria-pressed', 'true');
      const onWater = !!stage.show(id);
      capK.textContent = r.group; capT.textContent = r.term; capP.textContent = r.def;
      capE.textContent = r.en ? `(${r.en})` : ''; capE.hidden = !r.en;
      capW.textContent = r.warn || ''; capW.hidden = !r.warn;
      capN.textContent = onWater ? '' : t('Not shown on the water', 'На воде не показать', 'No se muestra en el agua', 'Nicht auf dem Wasser zu sehen', 'Suda gösterilmiyor', 'Pas montré sur l’eau', 'Non mostrato in acqua', 'Não mostrado na água');
      capN.hidden = onWater; cap.hidden = false;
    };
    bar.hidden = false;
    paint = () => {
      const v = q.value.trim(), res = find(groups, v, tab, lang);
      x.hidden = !q.value;
      let any = 0;
      res.forEach((g, i) => {
        const { s, dl, rows } = secs[i];
        s.hidden = !g.shown;
        if (g.shown) any += g.count;
        for (const term of g.terms) {
          const r = rows.get(term.id);
          r.w.hidden = !term.shown; r.w.classList.toggle('hit', term.named);
          named(r.dt, r.term, term.shown ? v : '', lang);
          if (r.eng) named(r.eng, `(${r.en})`, term.shown ? v : '', 'en');
          dl.append(r.w); // the ones found by name first
        }
      });
      for (const { id, b, c } of tabBs) {
        const k = id ? res.find((g) => g.id === id).count : res.reduce((s, g) => s + g.count, 0);
        c.textContent = String(k);
        b.classList.toggle('none', !k);
        b.setAttribute('aria-checked', String(id === tab));
        b.tabIndex = id === tab ? 0 : -1;
      }
      say.hidden = any > 0;
      if (!any) {
        say.textContent = tab && !res.find((g) => g.id === tab).count && res.some((g) => g.count)
          ? t(`Not in this group: “${v}”.`, `В этой группе нет: «${v}».`, `No está en este grupo: «${v}».`, `Nicht in dieser Gruppe: „${v}“.`, `Bu grupta yok: “${v}”.`, `Pas dans ce groupe : « ${v} ».`, `Non in questo gruppo: «${v}».`, `Não está neste grupo: “${v}”.`)
          : t(`No word matches “${v}”.`, `Ни одно слово не подходит под «${v}».`, `Ninguna palabra coincide con «${v}».`, `Kein Wort passt zu „${v}“.`, `“${v}” ile eşleşen sözcük yok.`, `Aucun mot ne correspond à « ${v} ».`, `Nessuna parola corrisponde a «${v}».`, `Nenhuma palavra corresponde a “${v}”.`);
        const all = button('', tab ? t('All groups', 'Все группы', 'Todos los grupos', 'Alle Gruppen', 'Tüm gruplar', 'Tous les groupes', 'Tutti i gruppi', 'Todos os grupos') : t('Clear', 'Очистить', 'Borrar', 'Löschen', 'Temizle', 'Effacer', 'Cancella', 'Limpar'));
        all.addEventListener('click', () => { if (tab) tab = ''; else q.value = ''; paint(); q.focus({ preventScroll: true }); });
        say.append(all);
      }
    };
    paint();
    if (stage) { const first = groups.flatMap((g) => g.terms).find(([id]) => has.has(id)); if (first) choose(first[0]); }
    if (fine && document.activeElement === back) q.focus({ preventScroll: true });
  };
  let picked = null, choose = () => {};
  const fail = () => {
    say.textContent = t('The words didn’t load. Check the connection.', 'Слова не загрузились. Проверьте соединение.', 'Las palabras no se cargaron. Revisa la conexión.', 'Die Wörter wurden nicht geladen. Prüfe die Verbindung.', 'Sözcükler yüklenmedi. Bağlantını kontrol et.', 'Les mots ne se sont pas chargés. Vérifie la connexion.', 'Le parole non si sono caricate. Controlla la connessione.', 'As palavras não carregaram. Verifique a conexão.');
    const again = button('', t('Try again', 'Ещё раз', 'Reintentar', 'Nochmal', 'Tekrar dene', 'Réessayer', 'Riprova', 'Tentar de novo'));
    again.addEventListener('click', () => { say.textContent = '…'; load(url).then((d) => { if (shown === close) build(d); }, fail); });
    say.append(again);
  };
  load(url).then((d) => { if (shown === close) build(d); }, () => { if (shown === close) fail(); });

  q.addEventListener('input', () => paint());
  x.addEventListener('click', () => { q.value = ''; paint(); q.focus({ preventScroll: true }); });

  const was = document.activeElement;
  const close = () => {
    if (shown !== close) return;
    shown = null;
    removeEventListener('keydown', keys, true);
    if (stage) removeEventListener('resize', place);
    ov.remove();
    if (was && was.isConnected && was.focus) was.focus();
    if (onClose) onClose();
  };
  // the keys are the menu's while it's open: Esc clears the search first, then closes, and nothing reaches the race
  // (typing a word in the field included: no letter steers or tacks)
  const keys = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (q.value) { q.value = ''; paint(); } else close(); return; }
    if (e.key === 'Tab') {
      const all = [...card.querySelectorAll('button, input')].filter((b) => b.tabIndex >= 0 && b.offsetParent !== null);
      const first = all[0], last = all[all.length - 1], now = document.activeElement;
      if (!card.contains(now) || now === (e.shiftKey ? first : last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      return;
    }
    if (e.key === '/' && e.target !== q && !bar.hidden) { e.preventDefault(); q.focus({ preventScroll: true }); return; }
    const go = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (go && stage && e.target.classList?.contains('wd-pick')) {
      e.preventDefault();
      const ps = [...card.querySelectorAll('.wd-pick')].filter((b) => b.offsetParent !== null), i = ps.indexOf(e.target), next = ps[i + go];
      if (next) { next.click(); next.focus({ preventScroll: true }); next.scrollIntoView?.({ block: 'nearest' }); }
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step && e.target.getAttribute && e.target.getAttribute('role') === 'radio') {
      e.preventDefault();
      const rs = [...e.target.parentNode.children], next = rs[(rs.indexOf(e.target) + step + rs.length) % rs.length];
      next.click(); next.focus();
    }
  };
  back.addEventListener('click', close);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  addEventListener('keydown', keys, true);
  document.body.append(ov);
  // the open part of the screen: beside the panel, or over it on a phone held upright; the caption at its foot (its top)
  function place() {
    const r = card.getBoundingClientRect(), Wd = innerWidth, Hd = innerHeight, side = r.width < Wd * 0.8;
    const open = side ? { x: r.right, y: 0, w: Math.max(1, Wd - r.right), h: Hd } : { x: 0, y: 0, w: Wd, h: Math.max(1, r.top) };
    stage.view(open);
    cap.classList.toggle('top', !side);
    Object.assign(cap.style, { left: `${open.x + 16}px`, right: side ? '16px' : '16px', top: side ? 'auto' : '12px', bottom: side ? '16px' : 'auto' });
  }
  if (stage) { place(); addEventListener('resize', place); }
  back.focus({ preventScroll: true });
  shown = close;
  return close;
}
