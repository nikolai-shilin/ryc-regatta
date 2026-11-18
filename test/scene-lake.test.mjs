// A lake with no airport near it: Lake Garda sees no big ships and no airliners, however long the race goes on.
import test from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { installPage, seedRandom } from './fake-page.mjs';

installPage({ search: '?venue=garda' });
seedRandom(5);
const THREE = await import('three');
const { VENUE } = await import('../public/game/venues.js');
const { Ships } = await import('../public/game/ships.js');
const { Airliner } = await import('../public/game/airliners.js');
const { skyUniforms } = await import('../public/game/light.js');

test('this is the lake', () => assert.equal(VENUE.id, 'garda'));

test('no ships are ever laid on a lake, even over deep water', () => {
  const s = new Ships(skyUniforms());
  assert.equal(s.on, false);
  s.reset({ course: { marks: {} } }, () => -100);
  assert.equal(s.list.length, 0);
  s.timer = 0;
  for (let i = 0; i < 100; i++) s.update(10);
  assert.equal(s.list.length, 0);
  assert.equal(s.group.children.length, 0);
});

test('with no airport close, no airliner comes over', () => {
  const a = new Airliner(skyUniforms()), cam = new THREE.PerspectiveCamera();
  a.reset({ player: { x: 0, z: 0 }, at: { x: 0, z: 0 } }, () => 0);
  assert.equal(a.ap, null);
  assert.equal(a.next ?? null, null, 'nothing is built for her');
  for (let i = 0; i < 2000; i++) a.update(1, cam);
  assert.equal(a.on, false);
  assert.equal(a.group.visible, false);
});
