// Audio & graphics on screen (public/game/av-menu.js): what the menu says in both languages, what each control saves, and
// how it opens, closes and takes the keys, on a small stand-in for the page.
import { mock } from './load.mjs'; // eslint-disable-line no-unused-vars
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------- a small page ----------
class El {
  constructor(tag = 'div') {
    Object.assign(this, { tag, kids: [], parentNode: null, heard: {}, attrs: {}, own: '', id: '', className: '', hidden: false, type: '', lang: '', style: {}, focused: 0 });
    this._tab = undefined;
    const list = () => this.className.split(/\s+/).filter(Boolean);
    this.classList = { contains: (c) => list().includes(c) };
  }
  get tabIndex() { return this._tab ?? (this.tag === 'button' ? 0 : -1); }
  set tabIndex(v) { this._tab = v; }
  append(...xs) { for (const x of xs) { x.parentNode?.kids.splice(x.parentNode.kids.indexOf(x), 1); x.parentNode = this; this.kids.push(x); } }
  remove() { if (this.parentNode) { this.parentNode.kids.splice(this.parentNode.kids.indexOf(this), 1); this.parentNode = null; } }
  get children() { return this.kids; }
  get textContent() { return this.own + this.kids.map((k) => k.textContent).join(''); }
  set textContent(s) { this.kids = []; this.own = String(s); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  get isConnected() { let e = this; while (e.parentNode) e = e.parentNode; return e === doc.documentElement; }
  // what a browser gives: null for what isn't drawn
  get offsetParent() { for (let e = this; e; e = e.parentNode) if (e.hidden) return null; return this.parentNode; }
  contains(x) { for (let e = x; e; e = e.parentNode) if (e === this) return true; return false; }
  *walk() { for (const k of this.kids) { yield k; yield* k.walk(); } }
  querySelectorAll(tag) { return [...this.walk()].filter((e) => e.tag === tag); }
  addEventListener(k, fn) { (this.heard[k] ||= []).push(fn); }
  fire(k, e = {}) { for (const fn of this.heard[k] || []) fn({ target: this, ...e }); }
  click() { this.fire('click'); }
  focus() { doc.activeElement = this; this.focused++; }
}

let doc, win, coarse;
function freshPage() {
  const documentElement = new El('html'), head = new El('head'), body = new El('body');
  documentElement.append(head, body);
  doc = { documentElement, head, body, activeElement: body, createElement: (t) => new El(t), getElementById: (id) => [...documentElement.walk()].find((e) => e.id === id) ?? null };
  win = {};
  coarse = false;
}
freshPage();
const store = new Map();
Object.assign(globalThis, {
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  addEventListener: (k, fn) => { (win[k] ||= []).push(fn); },
  removeEventListener: (k, fn) => { win[k] = (win[k] || []).filter((f) => f !== fn); },
  matchMedia: (q) => ({ matches: q.includes('coarse') && coarse }),
});
Object.defineProperty(globalThis, 'document', { get: () => doc, configurable: true });

const { avTitle, avSummary, avGfx, openAvMenu } = await import('../public/game/av-menu.js');
const { gfxDetail, gfxParts, saveAuto, defaultQuality, GFX_PARTS } = await import('../public/game/gfx.js');

// ---------- the menu, opened on some settings ----------
let open = null; // the menu's close, shut after each test (one menu at a time, in the module)
function menu(start = {}, opt = {}) {
  const saved = { ...start }, writes = [], closes = [];
  open = openAvMenu({ read: () => saved, write: (p) => { writes.push(p); Object.assign(saved, p); }, onClose: () => closes.push(1), ...opt });
  const root = doc.body.kids.at(-1), all = () => [...root.walk()];
  const named = (text, tag = 'span') => all().find((e) => e.tag === tag && e.own === text);
  // the row a name stands in: its radio buttons, or its switch
  const rowOf = (name) => named(name).parentNode;
  const radios = (name) => rowOf(name).kids.find((k) => k.getAttribute('role') === 'radiogroup').kids;
  const radio = (name, label) => radios(name).find((b) => b.own === label);
  const picked = (name) => radios(name).filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.own);
  const sw = (name) => rowOf(name).kids.find((k) => k.getAttribute('role') === 'switch');
  const button = (text) => named(text, 'button');
  const hint = () => all().find((e) => e.className === 'av-hint').own;
  return { root, card: root.kids[0], saved, writes, closes, named, radios, radio, picked, sw, button, hint, all };
}
const key = (k, target = doc.activeElement, extra = {}) => {
  const e = { key: k, target, stops: 0, prevented: 0, stopPropagation() { this.stops++; }, preventDefault() { this.prevented++; }, ...extra };
  for (const fn of [...(win.keydown || [])]) fn(e);
  return e;
};

beforeEach(() => { open?.(); open = null; freshPage(); store.clear(); });

// ---------- the words ----------
test('the menu is named in each language', () => {
  assert.equal(avTitle('en'), 'Audio & graphics');
  assert.equal(avTitle('ru'), 'Звук и графика');
  assert.equal(avTitle(undefined), 'Audio & graphics', 'English unless it is Russian');
});

test('the row that opens the menu says the level and the music', () => {
  assert.equal(avSummary({ gfx: 'auto', sound: 1, music: 'racing' }, 'en'), 'Auto · Racing');
  assert.equal(avSummary({ gfx: 'auto', sound: 1, music: 'racing' }, 'ru'), 'Авто · Гонка');
  assert.equal(avSummary({ gfx: 'high', sound: 1, music: 'openwater' }, 'en'), 'High · Open water');
  assert.equal(avSummary({ gfx: 'low', sound: 1, music: 'playlist' }, 'ru'), 'Мин. · Плейлист');
  assert.equal(avSummary({ gfx: 'custom', sound: 1, music: 'riff' }, 'en'), 'Custom · Riff');
});

test('with the sound off the row says so, whatever music is chosen', () => {
  assert.equal(avSummary({ gfx: 'medium', sound: 0, music: 'racing' }, 'en'), 'Medium · Sound off');
  assert.equal(avSummary({ gfx: 'medium', sound: 0, music: 'racing' }, 'ru'), 'Сред. · Звук выкл');
});

test('with the sound on and no track the row says the music is off', () => {
  assert.equal(avSummary({ gfx: 'high', sound: 1, music: 'off' }, 'en'), 'High · Music off');
  assert.equal(avSummary({ gfx: 'high', sound: 1 }, 'ru'), 'Макс. · Музыка выкл');
});

test('a level the menu does not know reads as Auto', () => {
  assert.equal(avSummary({ gfx: 'ultra', sound: 1, music: 'groove' }, 'en'), 'Auto · Groove');
  assert.equal(avGfx({ gfx: 'ultra' }, 'ru'), 'Авто');
  assert.equal(avGfx({}, 'en'), 'Auto');
});

test('the button in a panel\'s head says the graphics level alone', () => {
  assert.equal(avGfx({ gfx: 'high' }, 'en'), 'High');
  assert.equal(avGfx({ gfx: 'high' }, 'ru'), 'Макс.');
  assert.equal(avGfx({ gfx: 'custom' }, 'ru'), 'Своя');
  assert.equal(avGfx({ gfx: 'lowest' }, 'en'), 'Lowest');
  assert.equal(avGfx({ gfx: 'lowest' }, 'ru'), 'Ещё ниже');
  assert.equal(avSummary({ gfx: 'lowest', sound: 1, music: 'riff' }, 'de'), 'Minimal · Riff');
});

// ---------- opening ----------
test('it opens over the page as a dialog named by its title, at the z-index asked for', () => {
  const m = menu({}, { zIndex: 77, lang: 'ru' });
  assert.equal(m.root.className, 'av bc');
  assert.equal(m.root.style.zIndex, 77);
  assert.equal(m.root.lang, 'ru');
  assert.equal(m.card.getAttribute('role'), 'dialog');
  assert.equal(m.card.getAttribute('aria-modal'), 'true');
  const h = m.all().find((e) => e.tag === 'h2');
  assert.equal(h.own, 'Звук и графика');
  assert.equal(m.card.getAttribute('aria-labelledby'), h.id);
  assert.equal(doc.activeElement, m.button('Назад'), 'the focus starts on Back');
});

test('the z-index is 1000 and the language English unless told otherwise', () => {
  const m = menu();
  assert.equal(m.root.style.zIndex, 1000);
  assert.equal(m.root.lang, 'en');
  assert.ok(m.button('Back'));
});

test('the look goes into the page once, however often the menu opens', () => {
  menu(); open(); menu(); open();
  const styles = doc.head.kids.filter((e) => e.id === 'av-css');
  assert.equal(styles.length, 1);
  assert.match(styles[0].own, /\.av-card/);
});

test('asked to open while it is open, it gives back the same menu', () => {
  const m = menu();
  const again = openAvMenu({ read: () => ({}), write() {} });
  assert.equal(again, open);
  assert.equal(doc.body.kids.filter((e) => e === m.root || e.className === 'av bc').length, 1);
});

test('every group and control is there in English', () => {
  const m = menu();
  const heads = m.all().filter((e) => e.tag === 'h3').map((e) => e.own);
  assert.deepEqual(heads, ['Graphics', 'Audio']);
  for (const n of ['Quality', 'People on board', 'Battery saver · 30 fps', 'Sound', 'Voice on board', 'Music', 'Music volume', 'Sea']) assert.ok(m.named(n), n);
  assert.deepEqual(m.radios('Quality').map((b) => b.own), ['Auto', 'High', 'Medium', 'Low', 'Lowest', 'Custom']);
  assert.deepEqual(m.radios('Music').map((b) => b.own), ['Playlist', 'Racing', 'Groove', 'Riff', 'Open water', 'Off']);
  assert.deepEqual(m.radios('Music volume').map((b) => b.own), ['Loud', 'Normal', 'Quiet']);
  assert.deepEqual(m.radios('Sea').map((b) => b.own), ['Loud', 'Normal', 'Quiet', 'Off']);
});

test('every group and control is there in Russian', () => {
  const m = menu({}, { lang: 'ru' });
  assert.deepEqual(m.all().filter((e) => e.tag === 'h3').map((e) => e.own), ['Графика', 'Звук']);
  for (const n of ['Качество', 'Люди на борту', 'Экономия батареи · 30 к/с', 'Голос шкипера', 'Музыка', 'Громкость музыки', 'Море']) assert.ok(m.named(n), n);
  assert.deepEqual(m.radios('Качество').map((b) => b.own), ['Авто', 'Макс.', 'Сред.', 'Мин.', 'Ещё ниже', 'Своя']);
  assert.deepEqual(m.radios('Море').map((b) => b.own), ['Громко', 'Обычно', 'Тихо', 'Выкл']);
  assert.ok(m.button('Подробно'));
  assert.ok(m.button('Звук подробно'));
});

test('Vibration is offered only on a touch screen', () => {
  assert.equal(menu().named('Vibration'), undefined);
  open(); coarse = true;
  const m = menu({}, { lang: 'ru' });
  assert.ok(m.named('Вибрация'));
  m.sw('Вибрация').click();
  assert.deepEqual(m.writes, [{ vibration: 1 }]);
});

// ---------- what is picked ----------
test('what is saved shows as picked, and what was never set shows its default', () => {
  const m = menu({ gfx: 'medium', music: 'groove', musicVol: 'quiet' });
  assert.deepEqual(m.picked('Quality'), ['Medium']);
  assert.deepEqual(m.picked('Music'), ['Groove']);
  assert.deepEqual(m.picked('Music volume'), ['Quiet']);
  assert.deepEqual(m.picked('Sea'), ['Normal'], 'the sea is Normal until it is set');
  open();
  assert.deepEqual(menu().picked('Quality'), ['Auto']);
  assert.deepEqual(menu().picked('Music'), ['Playlist']);
});

test('only the picked radio takes the tab; with none picked, the first does', () => {
  const m = menu({ gfx: 'low' });
  assert.deepEqual(m.radios('Quality').map((b) => b.tabIndex), [-1, -1, -1, 0, -1, -1]);
  open();
  const n = menu({ music: 'nothing-known' });
  assert.deepEqual(n.picked('Music'), []);
  assert.deepEqual(n.radios('Music').map((b) => b.tabIndex), [0, -1, -1, -1, -1, -1]);
});

test('each radio group is named by its row', () => {
  const m = menu();
  const g = m.radios('Sea')[0].parentNode;
  assert.equal(g.getAttribute('role'), 'radiogroup');
  assert.equal(g.getAttribute('aria-labelledby'), m.named('Sea').id);
  assert.equal(m.sw('Sound').getAttribute('aria-labelledby'), m.named('Sound').id);
});

test('picking a level saves it, and the mark moves to it', () => {
  const m = menu({ gfx: 'auto' });
  m.radio('Quality', 'Low').click();
  assert.deepEqual(m.writes, [{ gfx: 'low' }]);
  assert.deepEqual(m.picked('Quality'), ['Low']);
});

test('Lowest is a level of its own: picked, saved and marked as the others', () => {
  const m = menu({ gfx: 'low' });
  m.radio('Quality', 'Lowest').click();
  assert.deepEqual(m.writes, [{ gfx: 'lowest' }]);
  assert.deepEqual(m.picked('Quality'), ['Lowest']);
});

test('picking the music, its volume and the sea saves each under its own key', () => {
  const m = menu();
  m.radio('Music', 'Open water').click();
  m.radio('Music volume', 'Loud').click();
  m.radio('Sea', 'Off').click();
  assert.deepEqual(m.writes, [{ music: 'openwater' }, { musicVol: 'loud' }, { sea: 'off' }]);
  assert.deepEqual(m.picked('Sea'), ['Off']);
});

test('a switch turns its setting on and off', () => {
  const m = menu({ sound: 0 });
  const b = m.sw('Sound');
  assert.equal(b.getAttribute('aria-checked'), 'false');
  b.click();
  assert.equal(b.getAttribute('aria-checked'), 'true');
  b.click();
  assert.deepEqual(m.writes, [{ sound: 1 }, { sound: 0 }]);
  assert.equal(b.getAttribute('aria-checked'), 'false');
});

test('People on board is on until it is turned off; the battery saver is off until it is turned on', () => {
  const m = menu();
  assert.equal(m.sw('People on board').getAttribute('aria-checked'), 'true');
  assert.equal(m.sw('Battery saver · 30 fps').getAttribute('aria-checked'), 'false');
  m.sw('People on board').click();
  m.sw('Battery saver · 30 fps').click();
  assert.deepEqual(m.writes, [{ figures: 0 }, { saver: 1 }]);
});

test('the menu shows what read gives after a save, not what it asked for', () => {
  const saved = { gfx: 'high' };
  open = openAvMenu({ read: () => saved, write: () => { saved.gfx = 'medium'; } }); // the page keeps its own idea
  const root = doc.body.kids.at(-1), radios = [...root.walk()].filter((e) => e.getAttribute('role') === 'radio' && ['High', 'Medium', 'Low'].includes(e.own)).slice(0, 3);
  radios[2].click(); // Low
  assert.deepEqual(radios.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.own), ['Medium']);
});

// ---------- the hint under Quality ----------
test('a set level says every scene draws at it, in each language', () => {
  assert.equal(menu({ gfx: 'high' }).hint(), 'The race and every 3D scene on the site draw at this level.');
  open();
  assert.equal(menu({ gfx: 'low' }, { lang: 'ru' }).hint(), 'Гонка и все 3D-сцены на сайте рисуются с этим качеством.');
});

test('Lowest says what it gives up and who it is for, in each language', () => {
  assert.equal(menu({ gfx: 'lowest' }).hint(), 'Low, with the picture drawn at two thirds of its resolution: for a device that is slow even on Low. The race and every 3D scene on the site draw at this level.');
  open();
  assert.match(menu({ gfx: 'lowest' }, { lang: 'ru' }).hint(), /^Как «Мин\.», но картинка рисуется в двух третях разрешения/);
  for (const lang of ['es', 'de', 'tr', 'fr', 'it', 'pt']) { open(); assert.doesNotMatch(menu({ gfx: 'lowest' }, { lang }).hint(), /^Low, with/, lang); }
});

test('Custom says each part is as set below, in each language', () => {
  assert.match(menu({ gfx: 'custom' }).hint(), /^Each part as you set it below\./);
  open();
  assert.match(menu({ gfx: 'custom' }, { lang: 'ru' }).hint(), /^Каждая часть — как задано ниже\./);
});

test('Auto says the level drawn now, as the running scene reports it', () => {
  assert.match(menu({ gfx: 'auto' }, { now: () => 'medium' }).hint(), /^Now: Medium\. When the frame rate drops/);
  open();
  assert.match(menu({}, { now: () => 'low', lang: 'ru' }).hint(), /^Сейчас: Мин\./);
});

test('in Russian the sentence ends with one full stop after a shortened level', () => {
  for (const [now, word] of [['high', 'Макс'], ['medium', 'Сред'], ['low', 'Мин']]) {
    assert.ok(menu({ gfx: 'auto' }, { now: () => now, lang: 'ru' }).hint().startsWith(`Сейчас: ${word}. Когда`), word);
    open();
  }
});

test('Auto with no scene running says the level this device starts at', () => {
  const words = { high: 'High', medium: 'Medium' }[defaultQuality()];
  assert.match(menu({ gfx: 'auto' }).hint(), new RegExp(`^Now: ${words}\\.`));
});

test('Auto names what it has eased off, in each language', () => {
  saveAuto({ ...gfxParts(defaultQuality()), land: 'low', post: 'low' });
  assert.match(menu({ gfx: 'auto' }, { now: () => 'high' }).hint(), /^Now: High · eased off: Glow and smoothing, Shore and trees\. /);
  open();
  assert.match(menu({ gfx: 'auto' }, { now: () => 'high', lang: 'ru' }).hint(), /^Сейчас: Макс\. · снижено: Свечение и сглаживание, Берег и деревья\. /);
});

test('a level the scene reports that the menu has no word for reads as High', () => {
  assert.match(menu({ gfx: 'auto' }, { now: () => 'custom' }).hint(), /^Now: High\./);
});

test('the hint follows the level as it is picked', () => {
  const m = menu({ gfx: 'high' });
  m.radio('Quality', 'Auto').click();
  assert.match(m.hint(), /^Now: /);
  m.radio('Quality', 'Custom').click();
  assert.match(m.hint(), /^Each part/);
});

// ---------- Details: the parts of the picture ----------
const detailBody = (m, name) => m.button(name).parentNode.kids[1];

test('Details is shut unless the level is Custom', () => {
  assert.equal(detailBody(menu({ gfx: 'high' }), 'Details').hidden, true);
  open();
  const m = menu({ gfx: 'custom' });
  assert.equal(detailBody(m, 'Details').hidden, false);
  assert.equal(m.button('Details').getAttribute('aria-expanded'), 'true');
  assert.equal(m.button('Details').getAttribute('aria-controls'), detailBody(m, 'Details').id);
});

test('its head opens and shuts it', () => {
  const m = menu({ gfx: 'high' }), head = m.button('Details');
  head.click();
  assert.equal(detailBody(m, 'Details').hidden, false);
  assert.equal(head.getAttribute('aria-expanded'), 'true');
  head.click();
  assert.equal(detailBody(m, 'Details').hidden, true);
  assert.equal(head.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(m.writes, [], 'opening a list saves nothing');
});

test('every part of the picture has a row, in each language', () => {
  const m = menu();
  for (const n of ['Resolution', 'Shadows', 'Waves', 'Reflections', 'Glow and smoothing', 'Wakes and spray', 'Hulls under water', 'Shore and trees', 'Gulls, dolphins and crew']) assert.ok(m.named(n), n);
  assert.equal(detailBody(m, 'Details').kids.length, GFX_PARTS.length);
  open();
  const r = menu({}, { lang: 'ru' });
  for (const n of ['Разрешение', 'Тени', 'Волны', 'Отражения', 'Кильватер и брызги', 'Корпуса под водой', 'Птицы, дельфины, экипаж']) assert.ok(r.named(n), n);
});

test('the lowest step of a part that can be switched off says Off, of the others Low', () => {
  const m = menu();
  assert.deepEqual(m.radios('Shadows').map((b) => b.own), ['High', 'Medium', 'Off']);
  assert.deepEqual(m.radios('Reflections').map((b) => b.own), ['High', 'Medium', 'Off']);
  assert.deepEqual(m.radios('Resolution').map((b) => b.own), ['High', 'Medium', 'Low']);
  assert.deepEqual(m.radios('Waves').map((b) => b.own), ['High', 'Medium', 'Low']);
  open();
  assert.deepEqual(menu({}, { lang: 'ru' }).radios('Тени').map((b) => b.own), ['Макс.', 'Сред.', 'Выкл']);
});

test('Custom starts from the parts drawn now, and opens them', () => {
  const m = menu({ gfx: 'medium' });
  assert.equal(detailBody(m, 'Details').hidden, true);
  m.radio('Quality', 'Custom').click();
  assert.deepEqual(m.writes, [{ gfx: 'custom', gfxD: gfxParts('medium') }]);
  assert.equal(detailBody(m, 'Details').hidden, false);
  assert.deepEqual(m.picked('Quality'), ['Custom']);
  assert.deepEqual(m.picked('Shadows'), ['Medium']);
});

test('a part changed makes the level Custom, the other parts as they were', () => {
  const m = menu({ gfx: 'low' });
  m.radio('Waves', 'High').click();
  assert.deepEqual(m.writes, [{ gfx: 'custom', gfxD: { ...gfxParts('low'), sea: 'high' } }]);
  assert.deepEqual(m.picked('Quality'), ['Custom']);
  assert.deepEqual(m.picked('Waves'), ['High']);
  assert.deepEqual(m.picked('Shore and trees'), ['Low'], 'the others stay where the level had them');
});

test('a second part changed keeps the first', () => {
  const m = menu({ gfx: 'custom', gfxD: gfxParts('high') });
  m.radio('Shadows', 'Off').click();
  m.radio('Resolution', 'Medium').click();
  assert.deepEqual(m.saved.gfxD, { ...gfxParts('high'), shadows: 'low', res: 'medium' });
  assert.deepEqual(gfxDetail(m.saved).shadows, 'low');
});

// ---------- Sound details ----------
test('Sound details is shut while every sound is Normal, and open when one is not', () => {
  assert.equal(detailBody(menu({ sndVoices: 'normal' }), 'Sound details').hidden, true);
  open();
  const m = menu({ sndBoats: 'quiet' });
  assert.equal(detailBody(m, 'Sound details').hidden, false);
  assert.deepEqual(m.picked('Sails, winches, hulls'), ['Quiet']);
  assert.deepEqual(m.picked('Voices'), ['Normal']);
});

test('each kind of sound is set on its own, in each language', () => {
  const m = menu();
  m.radio('Voices', 'Off').click();
  m.radio('Horns and beeps', 'Loud').click();
  m.radio('Gulls and the plane', 'Quiet').click();
  assert.deepEqual(m.writes, [{ sndVoices: 'off' }, { sndSignals: 'loud' }, { sndAround: 'quiet' }]);
  open();
  const r = menu({}, { lang: 'ru' });
  for (const n of ['Голоса', 'Паруса, лебёдки, корпус', 'Сигналы и таймер', 'Чайки и самолёт']) assert.ok(r.named(n), n);
});

// ---------- closing ----------
test('Back closes it: off the page, the focus back where it was, and onClose told once', () => {
  const opener = new El('button'); doc.body.append(opener); opener.focus();
  const m = menu();
  m.button('Back').click();
  assert.equal(m.root.parentNode, null);
  assert.equal(doc.activeElement, opener);
  assert.deepEqual(m.closes, [1]);
  assert.deepEqual(win.keydown, [], 'the keys are the page\'s again');
});

test('closing twice closes once', () => {
  const m = menu();
  open(); open();
  assert.deepEqual(m.closes, [1]);
});

test('a close left over from a menu already shut does nothing to the next one', () => {
  const m = menu(), old = open;
  old();
  const n = menu();
  old();
  assert.deepEqual(m.closes, [1]);
  assert.deepEqual(n.closes, []);
  assert.ok(n.root.parentNode, 'the new menu stays open');
});

test('it closes with no onClose to tell, and with the focus gone from the page', () => {
  const opener = new El('button'); doc.body.append(opener); opener.focus();
  open = openAvMenu({ read: () => ({}), write() {} });
  opener.remove();
  const before = opener.focused;
  open();
  assert.equal(opener.focused, before, 'what has left the page is not focused');
  assert.equal(doc.body.kids.length, 0);
});

test('a press on the dark round the card closes it, a press on the card does not', () => {
  const m = menu();
  m.root.fire('pointerdown', { target: m.card });
  assert.ok(m.root.parentNode, 'still open');
  m.root.fire('pointerdown', { target: m.root });
  assert.equal(m.root.parentNode, null);
  assert.deepEqual(m.closes, [1]);
});

test('it opens again after it has closed, on the settings as they are then', () => {
  menu({ gfx: 'high' }); open();
  assert.deepEqual(menu({ gfx: 'low' }).picked('Quality'), ['Low']);
});

// ---------- the keys ----------
test('Esc closes it, and nothing under it hears the key', () => {
  const m = menu();
  const e = key('Escape');
  assert.equal(e.stops, 1);
  assert.equal(e.prevented, 1);
  assert.equal(m.root.parentNode, null);
});

test('no key reaches the race while the menu is open', () => {
  const m = menu();
  const e = key('Space', m.button('Back'));
  assert.equal(e.stops, 1);
  assert.equal(e.prevented, 0, 'and an ordinary key is otherwise left alone');
  assert.ok(m.root.parentNode);
});

test('Tab goes round inside the card: from the last control to the first', () => {
  const m = menu();
  const last = m.sw('Voice on board').parentNode.parentNode.kids.at(-1).kids[0]; // Sound details' head, the last drawn
  last.focus();
  const e = key('Tab');
  assert.equal(e.prevented, 1);
  assert.equal(doc.activeElement, m.button('Back'));
});

test('Shift+Tab goes round the other way: from the first control to the last', () => {
  const m = menu();
  m.button('Back').focus();
  const e = key('Tab', doc.activeElement, { shiftKey: true });
  assert.equal(e.prevented, 1);
  assert.equal(doc.activeElement, m.button('Sound details'));
});

test('Shift+Tab with the focus outside the card comes back to its last control', () => {
  const m = menu();
  doc.body.focus();
  const e = key('Tab', doc.body, { shiftKey: true });
  assert.equal(e.prevented, 1);
  assert.equal(doc.activeElement, m.button('Sound details'));
});

test('Tab with the focus outside the card comes back to its first control', () => {
  const m = menu();
  doc.body.focus();
  const e = key('Tab', doc.body);
  assert.equal(e.prevented, 1);
  assert.equal(doc.activeElement, m.button('Back'));
});

test('Tab in the middle of the card is left to the browser', () => {
  const m = menu();
  m.sw('Sound').focus();
  const e = key('Tab');
  assert.equal(e.prevented, 0);
  assert.equal(doc.activeElement, m.sw('Sound'));
});

test('Tab skips what a shut list hides: an open list\'s last control is the last', () => {
  const m = menu({ sndVoices: 'off' }); // Sound details open
  const lastRadio = m.radios('Gulls and the plane').find((b) => b.tabIndex === 0);
  lastRadio.focus();
  assert.equal(key('Tab').prevented, 1);
  assert.equal(doc.activeElement, m.button('Back'));
  m.button('Sound details').click(); // shut
  m.button('Sound details').focus();
  assert.equal(key('Tab').prevented, 1, 'shut, its head is the last again');
});

test('an arrow key moves the pick along the radios and saves it', () => {
  const m = menu({ gfx: 'high' });
  const r = m.radios('Quality');
  r[1].focus();
  const e = key('ArrowRight');
  assert.equal(e.prevented, 1);
  assert.deepEqual(m.writes, [{ gfx: 'medium' }]);
  assert.equal(doc.activeElement, r[2]);
  key('ArrowDown');
  assert.equal(m.saved.gfx, 'low');
  key('ArrowLeft');
  assert.equal(m.saved.gfx, 'medium');
  key('ArrowUp');
  assert.equal(m.saved.gfx, 'high');
});

test('the arrows wrap round at both ends of a row of radios', () => {
  const m = menu({ music: 'playlist' });
  const r = m.radios('Music');
  r[0].focus();
  key('ArrowLeft');
  assert.equal(m.saved.music, 'off');
  assert.equal(doc.activeElement, r.at(-1));
  key('ArrowRight');
  assert.equal(m.saved.music, 'playlist');
  assert.equal(doc.activeElement, r[0]);
});

test('an arrow key on anything but a radio changes nothing', () => {
  const m = menu();
  m.sw('Sound').focus();
  const e = key('ArrowRight');
  assert.equal(e.prevented, 0);
  assert.deepEqual(m.writes, []);
  const w = key('ArrowLeft', {}); // a target that is no element
  assert.equal(w.prevented, 0);
});
