// Spanish, the third language (lib/lang.ts): every line of copy written as t('English', 'Русский') carries its Spanish
// third, the reader is sent to it, and the game has every word of it.
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

test('Spanish is a language of the site, with its own address and locale', () => {
  assert.deepEqual(LANGS, ['en', 'ru', 'es', 'de', 'tr', 'fr']);
  assert.ok(isLang('es'));
  assert.equal(LOCALE.es, 'es-ES');
  assert.equal(seo.langUrl('/faq', 'es'), '/faq?lang=es');
  assert.equal(seo.languages('/faq').es, '/faq?lang=es');
});

test('a Spanish browser is sent to Spanish, unless the address or the cookie says otherwise', () => {
  assert.equal(pickLang(null, null, 'es-ES,es;q=0.9,en;q=0.8'), 'es');
  assert.equal(pickLang(null, null, 'es-419'), 'es');
  assert.equal(pickLang(null, 'en', 'es-ES'), 'en');
  assert.equal(pickLang('ru', 'es', 'es-ES'), 'ru');
  assert.equal(pickLang(null, null, 'pt-BR'), 'en');
});

test('a line with no Spanish reads in English, and a kept name in its language', () => {
  assert.equal(tx('es')('Settings', 'Настройки', 'Ajustes'), 'Ajustes');
  assert.equal(tx('es')('Settings', 'Настройки'), 'Settings');
  assert.equal(tx('ru')('Settings', 'Настройки', 'Ajustes'), 'Настройки');
  assert.equal(pick(['Lake Garda', 'Озеро Гарда', 'Lago de Garda'], 'es'), 'Lago de Garda');
  assert.equal(pick(['Cowes', 'Каус'], 'es'), 'Cowes');
});

// every t('…', '…') and ['…', '…'] in the source whose second is Russian
function pairsWithoutSpanish() {
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
      if (ts.isCallExpression(n) && n.arguments.length === 2 && isText(n.arguments[0]) && isText(n.arguments[1]) && CYR.test(n.arguments[1].getText()) && !CYR.test(n.arguments[0].getText())) left.push(at(n));
      if (ts.isArrayLiteralExpression(n) && n.elements.length === 2 && isText(n.elements[0]) && isText(n.elements[1]) && CYR.test(n.elements[1].getText()) && !CYR.test(n.elements[0].getText())) left.push(at(n));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return left;
}

test('every English and Russian line in the source has its Spanish', () => {
  assert.deepEqual(pairsWithoutSpanish(), []);
});

test('the guides, the questions, the glossary and the rule book read in Spanish, citing the rules by number', () => {
  const t = tx('es');
  const words = [
    ...GUIDES.flatMap((slug) => guide(slug, t, 'es').sections.flatMap((s) => [s.h, ...s.p, s.tip || ''])),
    ...faqGroups(t).flatMap((g) => g.items.flatMap((f) => [f.q, f.a])),
    ...rulebook(t).flatMap(entriesOf).flatMap((e) => [e.title, e.text]),
    JSON.stringify(glossaryGroups(t)),
  ].join('\n');
  assert.doesNotMatch(words, CYR);
  assert.match(words, /regla 43\b/);
  assert.match(words, /barlovento/);
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

test('the game has every one of its words in Spanish', async () => {
  const ES = await import('../public/game/strings-es.js');
  const esKeys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? esKeys(v, `${pre}${k}.`) : [pre + k])).sort();
  const missing = (es, en) => en.filter((k) => !es.includes(k));
  assert.deepEqual(missing(esKeys(ES.MAIN), tableIn('public/game/main.js', 'T', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.HUD), tableIn('public/game/hud-bc.js', 'HUD_STRINGS', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.MATCH), tableIn('public/game/match-ui.js', 'MATCH_STRINGS', 'en')), []);
  assert.doesNotMatch(read('public/game/strings-es.js'), CYR);
});

test('the game reads Spanish from the address, the cookie and the device, and fetches its words only then', () => {
  const main = read('public/game/main.js');
  assert.match(main, /lang=\(en\|ru\|es\|de\|tr\|fr\)/);
  assert.match(main, /LANG === 'es' \? await import\('\.\/strings-es\.js'\)/);
  assert.match(main, /LANG === 'de' \? await import\('\.\/strings-de\.js'\)/);
  assert.match(read('public/play/index.html'), /lang=\(en\|ru\|es\|de\|tr\|fr\)/);
});
