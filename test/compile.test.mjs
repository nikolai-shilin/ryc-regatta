// Compiling the shaders aside (compile.js): a material thrown away, or the graphics lost, while it waits breaks nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileReady, checkShaders } from '../public/game/compile.js';

// a renderer as far as compileReady sees it: compile() hands back the materials, properties says each one's program
function renderer(programs) {
  const mats = Object.keys(programs);
  const r = { compile: () => new Set(mats), properties: { get: (m) => ({ currentProgram: programs[m] }) } };
  return r;
}
const program = (ready) => ({ isReady: () => ready() });
const settled = (p, ms = 200) => Promise.race([p.then(() => 'done'), new Promise((res) => setTimeout(() => res('waiting'), ms))]);

test('compileReady waits for every program', async () => {
  let ready = false;
  const p = compileReady(renderer({ a: program(() => true), b: program(() => ready) }), {}, {});
  assert.equal(await settled(p, 60), 'waiting');
  ready = true;
  assert.equal(await settled(p), 'done');
});

test('compileReady goes on past a material disposed while it waits', async () => {
  const programs = { a: program(() => false), b: program(() => true) };
  const p = compileReady(renderer(programs), {}, {});
  delete programs.a; // material.dispose(): three forgets its program
  assert.equal(await settled(p), 'done');
});

test('compileReady reads the renderer anew: the graphics restored, it has new properties', async () => {
  const r = renderer({ a: program(() => false) });
  const p = compileReady(r, {}, {});
  r.properties = { get: () => ({}) };
  assert.equal(await settled(p), 'done');
});

test('compileReady hands back the scene', async () => {
  const scene = {};
  assert.equal(await compileReady(renderer({ a: program(() => true) }), scene, {}), scene);
});

test('the shaders are checked on a developer\'s machine only', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'game.localhost']) assert.equal(checkShaders(host), true, host);
  for (const host of ['www.sailupdown.com', 'ryc-regatta.vercel.app', 'localhost.example.com']) assert.equal(checkShaders(host), false, host);
});
