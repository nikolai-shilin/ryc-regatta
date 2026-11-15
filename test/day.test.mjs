// A day's rating address (lib/day.ts), which proxy.ts checks before the page: a day the rating can't show is a 404
// there, as the page's own loading screen would already have answered 200. In Node: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { validDay, todayUtc } = await import('../lib/day.ts');
const ago = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

test('a day the rating can show: a real date, today or before, within 400 days', () => {
  assert.ok(validDay(todayUtc()));
  assert.ok(validDay(ago(1)));
  assert.ok(validDay(ago(399)));
  for (const d of ['not-a-day', '2026-02-30', '2026-13-01', '2026-1-05', ago(-1), ago(401), '']) assert.equal(validDay(d), false, d);
});

test('the proxy sends a day the rating can’t show to the 404', async () => {
  const { readFileSync } = await import('node:fs');
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxy, /import \{ validDay \} from '@\/lib\/day'/);
  assert.match(proxy, /\\\/race\\\/rating\\\/\(\[\^\/\]\+\)\$/);
  assert.match(proxy, /!validDay\(day\) \? '\/404'/);
});
