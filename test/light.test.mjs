// The light a race is sailed in (public/game/light.js), in Node: npm test. It imports three.js by its bare name, as
// the page's import map gives it; here that name is pointed at the vendored copy the page loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const THREE_URL = new URL('../public/vendor/three@0.160.0/build/three.module.min.js', import.meta.url).href;
registerHooks({ resolve: (spec, ctx, next) => (spec === 'three' ? { url: THREE_URL, shortCircuit: true } : next(spec, ctx)) });
globalThis.location = { search: '?venue=auckland' };
const { skyAt, HOURS } = await import('../public/game/light.js');

test('under a cloud deck the light keeps every number it has under a clear sky, the morning mist too', () => {
  for (const hour of [HOURS[0] + 0.3, HOURS[0] + 2, 13, HOURS[1] - 1]) {
    const clear = skyAt(hour, false), grey = skyAt(hour, true);
    for (const [k, v] of Object.entries(grey)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} at ${hour.toFixed(2)} is ${v}`);
    assert.equal(grey.mist, clear.mist, 'the mist lies on the water whether or not the sun is out');
  }
});
