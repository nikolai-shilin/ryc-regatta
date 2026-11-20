// Portuguese (Brazil's), the eighth language (lib/lang.ts): every line of copy written as t('English', 'Русский',
// 'Español', 'Deutsch', 'Türkçe', 'Français', 'Italiano') carries its Portuguese eighth, the reader is sent to it, and the
// game has every word of it.
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

test('Portuguese is a language of the site, with its own address and locale', () => {
  assert.ok(LANGS.includes('pt'));
  assert.ok(isLang('pt'));
  assert.equal(LOCALE.pt, 'pt-BR');
  assert.equal(seo.langUrl('/faq', 'pt'), '/faq?lang=pt');
  assert.equal(seo.languages('/faq').pt, '/faq?lang=pt');
});

test('a Portuguese browser, Brazil\'s or Portugal\'s, is sent to Portuguese, unless the address or the cookie says otherwise', () => {
  assert.equal(pickLang(null, null, 'pt-BR,pt;q=0.9,en;q=0.8'), 'pt');
  assert.equal(pickLang(null, null, 'pt-PT'), 'pt');
  assert.equal(pickLang(null, null, 'pt'), 'pt');
  assert.equal(pickLang(null, 'en', 'pt-BR'), 'en');
  assert.equal(pickLang('it', 'pt', 'pt-BR'), 'it');
  assert.equal(pickLang('pt', null, 'en-GB'), 'pt');
});

test('a line with no Portuguese reads in English, and a kept name in its language', () => {
  assert.equal(tx('pt')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni', 'Configurações'), 'Configurações');
  assert.equal(tx('pt')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni'), 'Settings');
  assert.equal(tx('it')('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni', 'Configurações'), 'Impostazioni');
  assert.equal(pick(['Naples', 'Неаполь', 'Nápoles', 'Neapel', 'Napoli', 'Naples', 'Napoli', 'Nápoles'], 'pt'), 'Nápoles');
  assert.equal(pick(['Cowes', 'Каус', 'Cowes', 'Cowes', 'Cowes', 'Cowes', 'Cowes'], 'pt'), 'Cowes');
});

// every t('…', '…', …) and ['…', '…', …] in the source whose second is Russian, with no Portuguese eighth
// (a breadcrumb keeps its path third, [English, Russian, path, Spanish, German, Turkish, French, Italian, Portuguese]: its
// Portuguese is ninth)
function linesWithoutPortuguese() {
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
        const want = list[2] && /^'\//.test(list[2].getText()) ? 9 : 8;
        if (k < want && (ts.isCallExpression(n) || k === list.length)) left.push(at(n));
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return left;
}

test('every line in the source has its Portuguese', () => {
  assert.deepEqual(linesWithoutPortuguese(), []);
});

test('the guides, the questions, the glossary and the rule book read in Portuguese, citing the rules by number', () => {
  const t = tx('pt');
  const words = [
    ...GUIDES.flatMap((slug) => guide(slug, t, 'pt').sections.flatMap((s) => [s.h, ...s.p, s.tip || ''])),
    ...faqGroups(t).flatMap((g) => g.items.flatMap((f) => [f.q, f.a])),
    ...rulebook(t).flatMap(entriesOf).flatMap((e) => [e.title, e.text]),
    JSON.stringify(glossaryGroups(t)),
  ].join('\n');
  assert.doesNotMatch(words, CYR);
  assert.match(words, /[Rr]egra 43\b/);
  assert.match(words, /barlavento/i);
  assert.match(words, /amurado a bombordo/i);
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

test('the game has every one of its words in Portuguese', async () => {
  const ES = await import('../public/game/strings-pt.js');
  const esKeys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? esKeys(v, `${pre}${k}.`) : [pre + k])).sort();
  const missing = (es, en) => en.filter((k) => !es.includes(k));
  assert.deepEqual(missing(esKeys(ES.MAIN), tableIn('public/game/main.js', 'T', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.HUD), tableIn('public/game/hud-bc.js', 'HUD_STRINGS', 'en')), []);
  assert.deepEqual(missing(esKeys(ES.MATCH), tableIn('public/game/match-ui.js', 'MATCH_STRINGS', 'en')), []);
  assert.doesNotMatch(read('public/game/strings-pt.js'), CYR);
});

test('the rule names, the play page and the language links have Portuguese', () => {
  const RULES = JSON.parse(read('lib/rules.json'));
  assert.deepEqual(Object.keys(RULES).filter((k) => !RULES[k].pt), []);
  assert.match(read('public/play/index.html'), /lang === 'pt'/);
  for (const f of ['components/ui.tsx', 'components/pause-card.tsx', 'app/[lang]/settings/page.tsx']) assert.match(read(f), /lang="pt"[^>]*>Português</);
});

