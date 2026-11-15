// The match's screens (public/game/match-ui.js) have every word in both languages, and main.js the match's calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the match screens have every word in both languages', async () => {
  const { MATCH_STRINGS: S } = await import('../public/game/match-ui.js');
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(S.ru), keys(S.en));
  for (const lang of ['en', 'ru']) for (const [k, v] of Object.entries(S[lang])) {
    if (typeof v === 'function') assert.equal(typeof v('A', 'B', 'C'), 'string', `${lang}.${k}`);
    else assert.ok(typeof v === 'string' && v.length, `${lang}.${k}`);
  }
});

test("main.js says each of a match's calls in both languages", () => {
  const main = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
  const ru = main.slice(main.indexOf('\n  ru: {'));
  const en = main.slice(main.indexOf('\n  en: {'), main.indexOf('\n  ru: {'));
  for (const k of ['entered', 'entryEarly', 'entryLate', 'umpire', 'theyOwe', 'penStart', 'penNow', 'finishOwed', 'raceWon', 'raceLost', 'matchWon', 'matchLost', 'waitingHost', 'guestGone', 'abandoned', 'full']) {
    for (const [lang, src] of [['en', en], ['ru', ru]]) assert.match(src, new RegExp(`\\b${k}: `), `${lang}.${k}`);
  }
});

test('a match loads its own modules only when it runs: none of them is in the page or main.js imports', () => {
  const main = readFileSync(new URL('../public/game/main.js', import.meta.url), 'utf8');
  const play = readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
  for (const m of ['match-ui', 'match', 'net', 'wire']) {
    assert.doesNotMatch(main, new RegExp(`^import [^\\n]*'\\./${m}\\.js'`, 'm'), m);
    assert.doesNotMatch(play, new RegExp(`/game/${m}\\.js`), m);
  }
  assert.match(main, /import\('\.\/match-ui\.js'\)/);
});

test('seconds are said in each language\'s own unit ("через 45 с", not "45 s")', async () => {
  const { MATCH_STRINGS: S } = await import('../public/game/match-ui.js');
  assert.equal(S.en.sec, 's');
  assert.equal(S.ru.sec, 'с');
  const ui = readFileSync(new URL('../public/game/match-ui.js', import.meta.url), 'utf8');
  // every call of fmtS (not its definition) gives the unit
  for (let i = ui.indexOf('fmtS('); i >= 0; i = ui.indexOf('fmtS(', i + 1)) {
    if (ui.slice(i - 6, i) === 'const ') continue;
    let d = 0, j = i + 4;
    do { if (ui[j] === '(') d++; else if (ui[j] === ')') d--; j++; } while (d > 0);
    assert.match(ui.slice(i, j), /, L\.sec\)$/, ui.slice(i, j));
  }
});

