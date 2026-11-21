// Sailing words, the race's dictionary (public/game/words.js), opened from the pause menu: the site's glossary
// (lib/glossary.ts) in every language, as words.json carries it to the race's page; how a search finds a word; and the
// panel on a page: it loads, finds, keeps a group, says when nothing matches or the words didn't come, and closes.
import { mock } from './load.mjs'; // eslint-disable-line no-unused-vars
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reset, done, serve, json, settle, until, click, type, press, dom, plain } from './fake-dom.mjs';

const { wordsJson, wordsData, WORDS_FILE } = await import('../scripts/words.mjs');
const { openWords, wordsTitle, find, fold } = await import('../public/game/words.js');
const { tx, LANGS } = await import('../lib/lang.ts');
const { glossary } = await import('../lib/glossary.ts');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DATA = wordsData();

test("words.json is the site's glossary as it stands (run node scripts/words.mjs after changing lib/glossary.ts)", () => {
  assert.equal(readFileSync(WORDS_FILE, 'utf8'), wordsJson());
  for (const lang of LANGS) {
    const terms = DATA[lang].flatMap((g) => g.terms);
    assert.equal(terms.length, glossary(tx(lang)).length, lang);
    for (const [id, term, def] of terms) assert.ok(id && term.trim() && def.trim().length > 20, `${lang} ${id}`);
  }
  // each language its own words, not English left in
  for (const lang of LANGS.filter((l) => l !== 'en')) assert.notEqual(DATA[lang][0].terms[0][2], DATA.en[0].terms[0][2], lang);
});

test("the pause menu's row names the panel as its title does, in every language", async () => {
  const play = read('public/play/index.html');
  assert.match(play, /<div class="p-rows p-rows-av">.*<button class="p-row" id="pWords"><span data-t="wordsK"><\/span><\/button><\/div>/);
  assert.match(read('public/ui/game.css'), /#pauseCard #pWords \{ --ic: url\(/, 'the row has its icon');
  const main = read('public/game/main.js');
  assert.ok(main.includes(`wordsK: '${wordsTitle('en')}'`) && main.includes(`wordsK: '${wordsTitle('ru')}'`));
  for (const lang of ['es', 'de', 'tr', 'fr', 'it', 'pt']) {
    const { MAIN: pack } = await import(`../public/game/strings-${lang}.js`);
    assert.equal(pack.wordsK, wordsTitle(lang), lang);
  }
  // fetched only when opened: the race's start loads none of it
  assert.doesNotMatch(main, /^import .*word(s|-scenes)\.js/m);
  assert.match(main, /import\('\.\/words\.js'\)/);
  assert.match(main, /import\('\.\/word-scenes\.js'\)/, 'the scenes too, but not in a 1-on-1 race');
  assert.match(main, /fileAt\('words\.json'\)/);
});

test('a search folds case and accents, needs every word typed, and puts the terms found by name first', () => {
  assert.equal(fold('Évitement'), 'evitement');
  assert.equal(fold('Ёлка', 'ru'), 'елка');
  assert.equal(fold('Işık', 'tr'), 'isik');
  const g = DATA.en;
  const shown = (q, tab) => find(g, q, tab).filter((x) => x.shown).flatMap((x) => x.terms.filter((y) => y.shown).map((y) => y.id));
  assert.equal(shown('').length, g.flatMap((x) => x.terms).length, 'nothing typed: every word');
  assert.deepEqual(shown('LAYLINE'), ['layline']);
  assert.ok(shown('mark room').includes('mark-room'));
  assert.deepEqual(shown('zzzz'), []);
  // a word in many definitions: those named by it come first in their group
  const marks = find(g, 'mark').find((x) => x.id === 'marks');
  const first = marks.terms.filter((y) => y.shown);
  assert.ok(first[0].named, 'a term with "mark" in its name leads');
  assert.ok(first.findIndex((y) => !y.named) === -1 || first.findIndex((y) => !y.named) > first.findLastIndex((y) => y.named));
  // a tab keeps one group; its count is the search's in it
  const wind = find(g, '', 'wind');
  assert.deepEqual(wind.filter((x) => x.shown).map((x) => x.id), ['wind']);
  assert.ok(wind.every((x) => x.count === x.terms.length), 'each group still counted');
  // in Russian, Russian words
  assert.ok(find(DATA.ru, 'лейлайн', '', 'ru').some((x) => x.terms.some((y) => y.id === 'layline' && y.shown)));
  assert.ok(find(DATA.de, 'uberlappung', '', 'de').some((x) => x.terms.some((y) => y.id === 'overlap' && y.shown)), 'ü found as u');
});

// ---------- on a page ----------
let close = null;
beforeEach(() => { reset(); serve([['words.json', json(DATA)]]); });
afterEach(async () => { if (close) close(); close = null; await done(); });
const $ = (s) => document.body.querySelector(s), $$ = (s) => document.body.querySelectorAll(s);
const visible = (e) => { for (let x = e; x; x = x.parentNode) if (x.hidden) return false; return true; };
const shownTerms = () => $$('.wd-w').filter(visible).map((w) => w.dataset.id);
async function open(opt = {}) {
  const closes = [];
  close = openWords({ lang: 'en', url: '/game/words.json', zIndex: 15, onClose: () => closes.push(1), ...opt });
  await until(() => $('.wd-cols .wd-g'), 'the words');
  return closes;
}

test('it opens over the race with every word in its groups, and the field takes the keys on a computer', async () => {
  dom.media['(pointer: fine)'] = true;
  const before = document.activeElement;
  const closes = await open();
  const card = $('.wd-card');
  assert.equal(card.getAttribute('role'), 'dialog');
  assert.equal($('.wd').style.zIndex, 15);
  assert.equal($('.wd-top h2').textContent, 'Sailing words');
  const total = DATA.en.flatMap((g) => g.terms).length;
  assert.equal($('.wd-n').textContent, String(total));
  assert.equal(shownTerms().length, total);
  assert.deepEqual($$('.wd-g h3').map((h) => plain(h.textContent)), DATA.en.map((g, i) => `${String(i + 1).padStart(2, '0')}${g.title}`));
  // the tabs: All, then each group, with its count; All picked
  const tabs = $$('.wd-tabs button');
  assert.deepEqual(tabs.map((b) => b.getAttribute('aria-checked')), ['true', ...DATA.en.map(() => 'false')]);
  assert.equal(tabs[0].textContent, `All${total}`);
  assert.equal(document.activeElement, $('.wd-q'), 'a keyboard types at once');
  // a key while it's open is the panel's, not the race's
  let raceHeard = 0;
  const race = () => raceHeard++;
  window.addEventListener('keydown', race);
  await press('ArrowLeft', $('.wd-q'));
  window.removeEventListener('keydown', race);
  assert.equal(raceHeard, 0);
  await press('Escape');
  assert.equal($('.wd'), null);
  assert.deepEqual(closes, [1]);
  assert.equal(document.activeElement, before, 'the focus back where it was');
  close = null;
});

test('typing finds the words, marks them, counts them in the tabs, and Esc clears before it closes', async () => {
  const closes = await open();
  assert.equal(document.activeElement, $('.wd-back'), 'on a touch screen the field waits for a tap');
  await type($('.wd-q'), 'lay');
  assert.deepEqual(shownTerms(), ['layline']);
  assert.equal($('.wd-w[data-id="layline"] mark').textContent, 'Lay');
  assert.ok($('.wd-w[data-id="layline"]').classList.contains('hit'));
  assert.equal($('.wd-tabs button').textContent, 'All1');
  assert.equal($('.wd-tabs [data-g="wind"]').textContent, `${DATA.en.find((g) => g.id === 'wind').title}1`);
  assert.ok($('.wd-tabs [data-g="boat"]').classList.contains('none'));
  assert.equal($('.wd-x').hidden, false);
  // a group picked: only its words
  await type($('.wd-q'), '');
  await click($('.wd-tabs [data-g="start"]'));
  assert.deepEqual(shownTerms(), DATA.en.find((g) => g.id === 'start').terms.map((x) => x[0]));
  // nothing there in this group, but elsewhere: it says so, and offers all the groups
  await type($('.wd-q'), 'gennaker');
  assert.deepEqual(shownTerms(), []);
  assert.match($('.wd-say').textContent, /^Not in this group: “gennaker”\.All groups$/);
  await click($('.wd-say button'));
  assert.deepEqual(shownTerms(), ['gennaker']);
  // nothing anywhere
  await type($('.wd-q'), 'qwerty');
  assert.match($('.wd-say').textContent, /^No word matches “qwerty”\.Clear$/);
  await click($('.wd-say button'));
  assert.equal($('.wd-q').value, '');
  assert.equal($('.wd-say').hidden, true);
  // Esc: the search first, then the panel
  await type($('.wd-q'), 'tack');
  await press('Escape');
  assert.equal($('.wd-q').value, '');
  assert.ok($('.wd'));
  await click($('.wd-back'));
  assert.equal($('.wd'), null);
  assert.deepEqual(closes, [1]);
  close = null;
});

test('in Russian, Russian; the title the race gives it', async () => {
  await open({ lang: 'ru', title: 'Словарь яхтсмена' });
  assert.equal($('.wd').lang, 'ru');
  assert.equal($('.wd-top h2').textContent, 'Словарь яхтсмена');
  assert.equal($('.wd-q').placeholder, 'Найти слово');
  assert.equal($('.wd-g h3 span').textContent, DATA.ru[0].title);
  await type($('.wd-q'), 'зона');
  assert.ok(shownTerms().includes('zone'));
});

test("the words fetched once a page; when they don't come it says so, and tries again on a tap", async () => {
  let n = 0;
  serve([['words.json', () => (++n === 1 ? new Error('offline') : json(DATA))]]);
  const url = '/game/words.json?v=new'; // (an address this page hasn't fetched yet)
  close = openWords({ lang: 'en', url });
  assert.match($('.wd-say').textContent, /^Loading the words/);
  await until(() => /didn’t load/.test($('.wd-say').textContent), 'the failure');
  assert.equal($('.wd-bar').hidden, true);
  await click($('.wd-say button'));
  await until(() => $('.wd-cols .wd-g'), 'the words, again');
  assert.equal($('.wd-bar').hidden, false);
  close(); close = null;
  await open({ url });
  assert.equal(n, 2, 'opened again, the words it has');
  // one panel at a time
  assert.equal(openWords({ lang: 'en', url }), close);
  await settle();
});

// ---------- in the race, with its scenes ----------
test('in the race the panel docks beside the water: the first word with a scene is shown, each word a button that shows its own', async () => {
  const shown = [], views = [];
  const stage = { ids: ['beat', 'tack', 'close-hauled'], show: (id) => { shown.push(id); return id !== 'luff'; }, view: (r) => views.push(r) };
  const closes = await open({ stage });
  assert.ok($('.wd').classList.contains('staged'));
  assert.deepEqual(shown, ['beat'], 'the first word with a scene, at once');
  assert.equal(views.length, 1, 'the open part of the screen told');
  assert.equal($('.wd-cap').hidden, false);
  assert.equal($('.wd-cap b').textContent, 'Beat');
  assert.equal($('.wd-cap span').textContent, DATA.en[0].title);
  assert.ok($('.wd-w[data-id="beat"]').classList.contains('on'));
  assert.equal($('.wd-w[data-id="beat"] .wd-pick').getAttribute('aria-pressed'), 'true');
  // the 3D mark on the words that have a scene only
  assert.equal($$('.wd-3d').length, 3);
  assert.ok($('.wd-w[data-id="tack"] .wd-3d') && !$('.wd-w[data-id="luff"] .wd-3d'));
  // another word: shown, marked, the last one unmarked
  await click($('.wd-w[data-id="tack"] .wd-pick'));
  assert.deepEqual(shown, ['beat', 'tack']);
  assert.ok(!$('.wd-w[data-id="beat"]').classList.contains('on'));
  assert.equal($('.wd-cap b').textContent, DATA.en[0].terms.find((x) => x[0] === 'tack')[1]);
  assert.equal($('.wd-cap i').hidden, true);
  // one with none: the race in view, and the caption says so
  await click($('.wd-w[data-id="luff"] .wd-pick'));
  assert.equal($('.wd-cap i').hidden, false);
  assert.equal($('.wd-cap i').textContent, 'Not shown on the water');
  // ↓ and ↑ from a word go to the next and the last one shown, and show them
  await press('ArrowDown', $('.wd-w[data-id="luff"] .wd-pick'));
  assert.equal(shown.at(-1), 'bear-away');
  assert.equal(document.activeElement, $('.wd-w[data-id="bear-away"] .wd-pick'));
  await press('ArrowUp');
  assert.equal(shown.at(-1), 'luff');
  // a search keeps what's shown
  await type($('.wd-q'), 'gybe');
  assert.equal(shown.at(-1), 'luff');
  // closed: its listeners go with it (done() checks the window's)
  await click($('.wd-back'));
  assert.deepEqual(closes, [1]);
  assert.equal($('.wd-cap'), null);
  close = null;
});

test('without a stage (a 1-on-1 race, or the scenes not loaded) it is the list alone', async () => {
  await open();
  assert.ok(!$('.wd').classList.contains('staged'));
  assert.equal($('.wd-pick'), null);
  assert.equal($('.wd-cap'), null);
});
