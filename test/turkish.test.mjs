// Turkish, the fifth language (lib/lang.ts): every line of copy written as t('English', 'Русский', 'Español',
// 'Deutsch') carries its Turkish fifth, the reader is sent to it, and the game has every word of it.
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

test('Turkish is a language of the site, with its own address and locale', () => {
  assert.ok(LANGS.includes('tr'));
  assert.ok(isLang('tr'));
  assert.equal(LOCALE.tr, 'tr-TR');
  assert.equal(seo.langUrl('/faq', 'tr'), '/faq?lang=tr');
  assert.equal(seo.languages('/faq').tr, '/faq?lang=tr');
});

test('a Turkish browser is sent to Turkish, unless the address or the cookie says otherwise', () => {
  assert.equal(pickLang(null, null, 'tr-TR,tr;q=0.9,en;q=0.8'), 'tr');
  assert.equal(pickLang(null, null, 'tr'), 'tr');
  assert.equal(pickLang(null, 'en', 'tr-TR'), 'en');
  assert.equal(pickLang('de', 'tr', 'tr-TR'), 'de');
});

test('a line with no Turkish reads in English, and a kept name in its language', () => {
  assert.equal(tx('tr')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar'), 'Ayarlar');
  assert.equal(tx('tr')('Settings', 'Настройки', 'Ajustes', 'Einstellungen'), 'Settings');
  assert.equal(tx('de')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar'), 'Einstellungen');
  assert.equal(pick(['Lake Garda', 'Озеро Гарда', 'Lago de Garda', 'Gardasee', 'Garda Gölü'], 'tr'), 'Garda Gölü');
  assert.equal(pick(['Cowes', 'Каус', 'Cowes', 'Cowes'], 'tr'), 'Cowes');
});

// every t('…', '…', '…', '…') and ['…', '…', '…', '…'] in the source whose second is Russian, with no Turkish fifth
function linesWithoutTurkish() {
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
      if (ts.isCallExpression(n) && n.arguments.length >= 2 && n.arguments.length < 5 && isText(n.arguments[0]) && isText(n.arguments[1]) && CYR.test(n.arguments[1].getText()) && !CYR.test(n.arguments[0].getText()) && !(n.expression.getText() === 'titled' && n.arguments[2] && !isText(n.arguments[2]))) left.push(at(n));
      if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2 && n.elements.length <= 4 && n.elements.every(isText) && CYR.test(n.elements[1].getText()) && !CYR.test(n.elements[0].getText())) left.push(at(n));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return left;
}

test('every English, Russian, Spanish and German line in the source has its Turkish', () => {
  assert.deepEqual(linesWithoutTurkish(), []);
});

test('the guides, the questions, the glossary and the rule book read in Turkish, citing the rules by number', () => {
  const t = tx('tr');
  const words = [
    ...GUIDES.flatMap((slug) => guide(slug, t, 'tr').sections.flatMap((s) => [s.h, ...s.p, s.tip || ''])),
    ...faqGroups(t).flatMap((g) => g.items.flatMap((f) => [f.q, f.a])),
    ...rulebook(t).flatMap(entriesOf).flatMap((e) => [e.title, e.text]),
    JSON.stringify(glossaryGroups(t)),
  ].join('\n');
  assert.doesNotMatch(words, CYR);
  assert.match(words, /[Kk]ural 43\b/);
  assert.match(words, /rüzgârüstü/i);
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

test('the game has every one of its words in Turkish', async () => {
  const ES = await import('../public/game/strings-tr.js');
  const esKeys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? esKeys(v, `${pre}${k}.`) : [pre + k])).sort();
  const missing = (es, en) => en.filter((k) => !es.includes(k));
  assert.deepEqual(missing(esKeys(ES.MAIN), tableIn('public/game/main.js', 'T', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.HUD), tableIn('public/game/hud-bc.js', 'HUD_STRINGS', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.MATCH), tableIn('public/game/match-ui.js', 'MATCH_STRINGS', 'en')), []);
  assert.doesNotMatch(read('public/game/strings-tr.js'), CYR);
});

