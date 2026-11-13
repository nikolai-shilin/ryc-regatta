// npm run indexnow — after a deploy, tells Bing, Yandex and the other IndexNow engines about every address in the live
// sitemap, so new and changed pages are crawled within minutes. The key is lib/seo.ts INDEXNOW_KEY, served at
// /indexnow.txt; this checks it is live before sending.
import { readFile } from 'node:fs/promises';

const SITE = 'https://regatta.rycrentals.com';
const key = (await readFile(new URL('../lib/seo.ts', import.meta.url), 'utf8')).match(/INDEXNOW_KEY = '([0-9a-f]+)'/)?.[1];
if (!key) throw new Error('no INDEXNOW_KEY in lib/seo.ts');
const live = await (await fetch(`${SITE}/indexnow.txt`)).text();
if (live.trim() !== key) throw new Error(`${SITE}/indexnow.txt doesn't serve the key yet: deploy first`);
const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/indexnow.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} addresses → ${r.status} ${r.statusText}`);
if (!r.ok && r.status !== 202) process.exit(1);
