// node scripts/words.mjs — writes public/game/words.json, the race's dictionary (public/game/words.js), from the
// site's glossary (lib/glossary.ts): the same groups, terms and definitions, in every language, so the race's page,
// which has no TypeScript or React, reads the words /learn/glossary prints. Run it after a change to the glossary;
// npm test (test/words.test.mjs) fails while the file is behind.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../test/load.mjs'; // the site's TypeScript, as the tests import it

const { tx, LANGS } = await import('../lib/lang.ts');
const { glossaryGroups } = await import('../lib/glossary.ts');

// { en: [{ id, title, terms: [[id, term, definition], …] }, …], ru: [… [id, term, definition, English name], …], … }; a dangerous one's warning last
export const wordsData = () => Object.fromEntries(LANGS.map((lang) => [lang,
  glossaryGroups(tx(lang)).map((g) => ({ id: g.id, title: g.title, terms: g.terms.map((x) => (x.warn ? [x.id, x.term, x.def, x.en || '', x.warn] : x.en ? [x.id, x.term, x.def, x.en] : [x.id, x.term, x.def])) }))]));

export const WORDS_FILE = fileURLToPath(new URL('../public/game/words.json', import.meta.url));
export const wordsJson = () => `${JSON.stringify(wordsData())}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(WORDS_FILE, wordsJson());
  console.log(`wrote ${WORDS_FILE}`);
}
