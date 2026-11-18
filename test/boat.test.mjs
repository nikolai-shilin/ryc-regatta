// The boat on this device and in the account made one (lib/boat.ts mergeBoat): the one changed last wins, and a
// default boat the boat page saved on a first visit never beats the account's.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { mergeBoat, cleanBoat, DEFAULT_BOAT } = await import('../lib/boat.ts');

const mine = { ...DEFAULT_BOAT, preset: undefined, hull: '#1f6fb2', flag: 'by', nat: 'BLR', num: '77' };

test('a new address with the default boat takes the account’s', () => {
  const r = mergeBoat({ ...DEFAULT_BOAT }, { ...mine, at: 100 });
  assert.equal(r.remote, undefined);
  assert.equal(r.local.flag, 'by');
  assert.equal(r.local.num, '77');
  assert.equal(r.local.at, 100);
  assert.deepEqual(mergeBoat(null, { ...mine, at: 100 }).local.num, '77');
});

test('a boat chosen before the sync goes to an empty account, stamped', () => {
  const r = mergeBoat(mine, undefined, 5);
  assert.equal(r.remote.num, '77');
  assert.equal(r.remote.at, 5);
  assert.equal(r.local.at, 5);
});

test('the default boat is never sent to the account', () => {
  assert.deepEqual(mergeBoat({ ...DEFAULT_BOAT }, undefined), {});
  assert.deepEqual(mergeBoat(null, undefined), {});
});

test('the one changed last wins', () => {
  assert.equal(mergeBoat({ ...mine, num: '9', at: 200 }, { ...mine, at: 100 }).remote.num, '9');
  assert.equal(mergeBoat({ ...mine, num: '9', at: 100 }, { ...mine, at: 200 }).local.num, '77');
  assert.deepEqual(mergeBoat({ ...mine, at: 100 }, { ...mine, at: 100 }), {});
});

test('going back to the RYC colours is a choice too', () => {
  const r = mergeBoat({ ...DEFAULT_BOAT, at: 300 }, { ...mine, at: 100 });
  assert.equal(r.remote.num, '1');
  assert.equal(r.remote.flag, undefined);
});

test('a logo saved on a boat is dropped: the mainsail’s logo is the admin’s', () => {
  const img = 'data:image/png;base64,AAAA';
  const up = mergeBoat({ ...mine, logo: 'custom', logoImg: img, at: 200 }, undefined);
  assert.equal(up.remote.logo, undefined);
  assert.equal(up.remote.logoImg, undefined);
  const down = mergeBoat({ ...DEFAULT_BOAT, logo: 'ryc', logoImg: img }, { ...mine, logo: 'custom', logoImg: img, at: 100 });
  assert.equal(down.local.logo, undefined);
  assert.equal(down.local.logoImg, undefined);
});

test('a broken boat in the account is cleaned', () => {
  const b = cleanBoat({ hull: 'red', flag: 'xx', num: 12345, nat: 'ABCDE', at: -1 });
  assert.equal(b.hull, DEFAULT_BOAT.hull);
  assert.equal(b.flag, undefined);
  assert.equal(b.num, '1');
  assert.equal(b.nat, 'ABC');
  assert.equal(b.at, undefined);
});

test('the gennaker’s colours, the bottom paint, the deck and the name are kept, and cleaned', () => {
  const b = cleanBoat({ kite: '#1c1f24', kite2: '#f2c230', kite3: '#b0202b', bottom: '#16325c', deck: 'teak', name: '  Bora <b>Bora</b>  ' });
  assert.equal(b.kite2, '#f2c230');
  assert.equal(b.kite3, '#b0202b');
  assert.equal(b.bottom, '#16325c');
  assert.equal(b.deck, 'teak');
  assert.equal(b.name, 'Bora bBorab');
  const d = cleanBoat({ kite3: '#b0202b', bottom: 'blue', deck: 'gold', name: '   ' });
  assert.equal(d.kite2, '#b0202b'); // a third colour without a second moves up
  assert.equal(d.kite3, undefined);
  assert.equal(d.bottom, DEFAULT_BOAT.bottom);
  assert.equal(d.deck, 'nonskid');
  assert.equal(d.name, undefined);
  assert.equal(cleanBoat({ name: 'Ласточка-2 of the North Sea' }).name, 'Ласточка-2 of th');
});

test('a new name or deck is a change the account takes', () => {
  assert.equal(mergeBoat({ ...DEFAULT_BOAT, name: 'Bora' }, undefined, 5).remote.name, 'Bora');
  assert.equal(mergeBoat({ ...DEFAULT_BOAT, deck: 'teak' }, undefined, 5).remote.deck, 'teak');
});
