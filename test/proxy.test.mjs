// proxy.ts's matcher: which addresses go through the proxy (to their language, /players to /en/players) and which it
// leaves alone (the game's page and files). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const matcher = new RegExp(`^${/matcher: \['([^']+)'\]/.exec(src)[1]}$`);

test('the proxy leaves the game alone, and still takes the pages whose names start as its do', () => {
  for (const path of ['/play', '/play/index.html', '/game/sim.js', '/boat-view', '/fleet-view', '/connect']) assert.ok(!matcher.test(path), `${path}: left alone`);
  for (const path of ['/', '/players', '/yachts', '/boat', '/race/rating', '/social']) assert.ok(matcher.test(path), `${path}: sent to its language`);
});

test('the full text for AI assistants is left alone, the venue pages go to their language', () => {
  for (const path of ['/llms.txt', '/llms-full.txt', '/sitemap.xml', '/robots.txt']) assert.ok(!matcher.test(path), `${path}: left alone`);
  for (const path of ['/venues', '/venues/cowes', '/yachts/j70', '/learn/sail']) assert.ok(matcher.test(path), `${path}: sent to its language`);
});

// a crawler is served the address's own language whatever its Accept-Language; a chat app's link preview and a person
// are served theirs
const crawler = new RegExp(/const CRAWLER = \/(.+)\/i;/.exec(src)[1], 'i');
test('search engines and AI crawlers are told apart from people and link previews', () => {
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'])
    assert.ok(crawler.test(ua), ua);
  for (const ua of ['TelegramBot (like TwitterBot)', 'WhatsApp/2.23.20.0', 'facebookexternalhit/1.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'])
    assert.ok(!crawler.test(ua), ua);
});
