// Italian, the seventh language (lib/lang.ts): every line of copy written as t('English', 'Русский', 'Español',
// 'Deutsch', 'Türkçe', 'Français') carries its Italian seventh, the reader is sent to it, and the game has every word of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ts from 'typescript';
import './load.mjs';

const { tx, pick, pickLang, isLang, LANGS, LOCALE } = await import('../lib/lang.ts');
const seo = await import('../lib/seo.ts');
const { GUIDES, guide } = await import('../lib/guides.ts');
const { faqGroups } = await import('../lib/faq.ts');
const { rulebook, entriesOf } = await import('../lib/rulebook.ts');
const { glossaryGroups } = await import('../lib/glossary.ts');

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(ROOT + f, 'utf8');
const CYR = /[Ѐ-ӿ]/;

test('Italian is a language of the site, with its own address and locale', () => {
  assert.ok(LANGS.includes('it'));
  assert.ok(isLang('it'));
  assert.equal(LOCALE.it, 'it-IT');
  assert.equal(seo.langUrl('/faq', 'it'), '/faq?lang=it');
  assert.equal(seo.languages('/faq').it, '/faq?lang=it');
});

test('an Italian browser is sent to Italian, unless the address or the cookie says otherwise', () => {
  assert.equal(pickLang(null, null, 'it-IT,it;q=0.9,en;q=0.8'), 'it');
  assert.equal(pickLang(null, null, 'it-CH'), 'it');
  assert.equal(pickLang(null, null, 'it'), 'it');
  assert.equal(pickLang(null, 'en', 'it-IT'), 'en');
  assert.equal(pickLang('fr', 'it', 'it-IT'), 'fr');
  assert.equal(pickLang('it', null, 'en-GB'), 'it');
});

test('a line with no Italian reads in English, and a kept name in its language', () => {
  assert.equal(tx('it')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni'), 'Impostazioni');
  assert.equal(tx('it')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages'), 'Settings');
  assert.equal(tx('fr')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni'), 'Réglages');
  assert.equal(pick(['Lake Garda', 'Озеро Гарда', 'Lago de Garda', 'Gardasee', 'Garda Gölü', 'Lac de Garde', 'Lago di Garda'], 'it'), 'Lago di Garda');
  assert.equal(pick(['Cowes', 'Каус', 'Cowes', 'Cowes', 'Cowes', 'Cowes'], 'it'), 'Cowes');
});

// every t('…', '…', …) and ['…', '…', …] in the source whose second is Russian, with no Italian seventh
// (a breadcrumb keeps its path third, [English, Russian, path, Spanish, German, Turkish, French, Italian]: its Italian is eighth)
function linesWithoutItalian() {
  const files = execSync('git ls-files app components lib public/game; git ls-files -o --exclude-standard app components lib public/game', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx|js)$/.test(f) && !/vendor/.test(f));
  const isText = (n) => ts.isStringLiteralLike(n) || ts.isTemplateExpression(n);
  const left = [];
  for (const f of files) {
    let src; try { src = read(f); } catch { continue; }
    if (!CYR.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const at = (n) => `${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n) => {
      const list = ts.isCallExpression(n) ? n.arguments : ts.isArrayLiteralExpression(n) ? n.elements : null;
      if (list && list.length >= 2 && isText(list[0]) && isText(list[1]) && CYR.test(list[1].getText()) && !CYR.test(list[0].getText())) {
        let k = 0; while (k < list.length && isText(list[k])) k++;
        const want = list[2] && /^'\//.test(list[2].getText()) ? 8 : 7;
        if (k < want && (ts.isCallExpression(n) || k === list.length)) left.push(at(n));
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return left;
}

test('every line in the source has its Italian', () => {
  assert.deepEqual(linesWithoutItalian(), []);
});

test('the guides, the questions, the glossary and the rule book read in Italian, citing the rules by number', () => {
  const t = tx('it');
  const words = [
    ...GUIDES.flatMap((slug) => guide(slug, t, 'it').sections.flatMap((s) => [s.h, ...s.p, s.tip || ''])),
    ...faqGroups(t).flatMap((g) => g.items.flatMap((f) => [f.q, f.a])),
    ...rulebook(t).flatMap(entriesOf).flatMap((e) => [e.title, e.text]),
    JSON.stringify(glossaryGroups(t)),
  ].join('\n');
  assert.doesNotMatch(words, CYR);
  assert.match(words, /[Rr]egola 43\b/);
  assert.match(words, /sopravvento/i);
  assert.match(words, /mure a sinistra/i);
});

// the keys of an object literal, nested, as source: { a: 1, b: { c: 2 } } → ['a', 'b.c']
const keysOf = (obj, pre = '') => obj.properties.flatMap((p) => {
  const k = pre + (p.name.text ?? p.name.getText());
  return p.initializer && ts.isObjectLiteralExpression(p.initializer) ? keysOf(p.initializer, `${k}.`) : [k];
});
const tableIn = (file, name, lang) => {
  const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let found = null;
  const visit = (n) => {
    if (!found && ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      const p = n.initializer.properties.find((x) => x.name.getText() === lang);
      found = p ? keysOf(p.initializer).sort() : null;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
};

test('the game has every one of its words in Italian', async () => {
  const ES = await import('../public/game/strings-it.js');
  const esKeys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? esKeys(v, `${pre}${k}.`) : [pre + k])).sort();
  const missing = (es, en) => en.filter((k) => !es.includes(k));
  assert.deepEqual(missing(esKeys(ES.MAIN), tableIn('public/game/main.js', 'T', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.HUD), tableIn('public/game/hud-bc.js', 'HUD_STRINGS', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.MATCH), tableIn('public/game/match-ui.js', 'MATCH_STRINGS', 'en')), []);
  assert.doesNotMatch(read('public/game/strings-it.js'), CYR);
});

test('the rule names, the play page and the language links have Italian', () => {
  const RULES = JSON.parse(read('lib/rules.json'));
  assert.deepEqual(Object.keys(RULES).filter((k) => !RULES[k].it), []);
  assert.match(read('public/play/index.html'), /lang === 'it'/);
  for (const f of ['components/ui.tsx', 'components/pause-card.tsx', 'app/[lang]/settings/page.tsx']) assert.match(read(f), /lang="it"[^>]*>Italiano</);
});

