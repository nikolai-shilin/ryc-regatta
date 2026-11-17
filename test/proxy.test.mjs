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
