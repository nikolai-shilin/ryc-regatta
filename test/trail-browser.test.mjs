// The way back in the browser (the second half of public/game/trail.js, the pure half is test/trail.test.mjs): what is
// kept in sessionStorage as pages are reached, and where a back arrow really goes, on a stand-in for the page.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const def = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const GOING = 'ud-trail-going';
let store, nav, wentBack, brokenStore;

function at(path, { referrer = '', type = 'navigate', historyLength = 10 } = {}) {
  const [pathname, query = ''] = path.split('?');
  def('location', { pathname, search: query ? `?${query}` : '', origin: 'https://sail.example', href: `https://sail.example${path}` });
  def('document', { referrer });
  nav = type;
  def('history', { length: historyLength, go: (n) => { wentBack.push(n); } });
}

def('sessionStorage', {
  getItem: (k) => { if (brokenStore) throw new Error('denied'); return store.has(k) ? store.get(k) : null; },
  setItem: (k, v) => { if (brokenStore) throw new Error('denied'); store.set(k, String(v)); },
  removeItem: (k) => { if (brokenStore) throw new Error('denied'); store.delete(k); },
});
def('performance', { getEntriesByType: (k) => { assert.equal(k, 'navigation'); if (nav === 'throw') throw new Error('old browser'); return nav ? [{ type: nav }] : []; } });

const { KEY, load, save, arriveLoaded, arriveWithin, outOfRace, goBack } = await import('../public/game/trail.js');
const kept = () => JSON.parse(store.get(KEY) ?? 'null');

beforeEach(() => {
  store = new Map(); wentBack = []; brokenStore = false;
  save([]); store.clear();
  at('/');
});

// ---------- load and save ----------
test('a trail saved is kept for the tab and read back', () => {
  const t = [{ p: '/a', n: 0 }, { p: '/b', n: 1 }];
  save(t);
  assert.deepEqual(kept(), t);
  assert.deepEqual(load(), t);
});

test('steps that are not steps are dropped as the trail is read', () => {
  store.set(KEY, JSON.stringify([{ p: '/a', n: 0 }, null, { p: 7 }, 'x', { n: 1 }, { p: '/b', n: 1 }]));
  assert.deepEqual(load(), [{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
});

for (const [name, value] of [['spoiled', '{not json'], ['not a list', '{"p":"/a"}'], ['empty', null]]) {
  test(`a stored trail that is ${name} leaves the trail as it was in memory`, () => {
    save([{ p: '/mem', n: 0 }]);
    if (value === null) store.delete(KEY); else store.set(KEY, value);
    assert.deepEqual(load(), [{ p: '/mem', n: 0 }]);
  });
}

test('a browser that keeps nothing still has the trail for this page', () => {
  brokenStore = true;
  assert.doesNotThrow(() => save([{ p: '/only', n: 0 }]));
  assert.deepEqual(load(), [{ p: '/only', n: 0 }]);
});

// ---------- a page loaded in full ----------
test('the first page of a visit, from nowhere on this site, starts the trail', () => {
  at('/race?x=1', { referrer: 'https://www.google.com/search?q=sailing' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/race?x=1', n: 0 }]);
});

test('a page loaded from another page of the site puts that page behind it', () => {
  at('/race', { referrer: 'https://sail.example/news?page=2' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/news?page=2', n: 0 }, { p: '/race', n: 1 }]);
});

test('a referrer that cannot be read counts as none', () => {
  at('/race', { referrer: 'not a url' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/race', n: 0 }]);
});

test('the same page loaded again changes nothing', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/b', { type: 'reload', referrer: 'https://sail.example/b' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
});

test('a page loaded again from itself (the language switch) is one more history entry to go back over', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/b', { referrer: 'https://sail.example/b' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b', n: 2 }]);
});

test("the browser's back to a page in full takes the step off the trail", () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/a', { type: 'back_forward' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }]);
});

test('a page brought back from the cache counts as the browser going back', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/a');
  arriveLoaded({ pop: true });
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }]);
});

for (const [name, type] of [['no navigation entry', ''], ['a browser that cannot say', 'throw']]) {
  test(`with ${name} a page arrives as a plain link`, () => {
    save([{ p: '/a', n: 0 }]);
    at('/b', { type });
    arriveLoaded();
    assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  });
}

test('the arrival of a back of our own is not taken for the browser going back, nor for a link', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }, { p: '/c', n: 1 }]);
  store.set(GOING, '/c');
  at('/c', { type: 'back_forward', referrer: 'https://sail.example/z' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b', n: 1 }, { p: '/c', n: 1 }]);
  assert.equal(store.has(GOING), false, 'and it is said only once');
});

test('a back of our own that ended up somewhere else is an ordinary arrival', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  store.set(GOING, '/elsewhere');
  at('/a', { type: 'back_forward' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }]);
  assert.equal(store.has(GOING), false);
});

// ---------- a page reached within the app ----------
test('a link within the site adds a step', () => {
  save([{ p: '/a', n: 0 }]);
  at('/b?tab=2');
  arriveWithin();
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b?tab=2', n: 1 }]);
});

test("the browser's back within the site takes one off", () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/a');
  arriveWithin({ pop: true });
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }]);
});

test('a back of our own within the site is not counted twice', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 2 }]);
  store.set(GOING, '/b');
  at('/b');
  arriveWithin({ pop: true });
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }, { p: '/b', n: 2 }], 'the entry count is not taken down');
});

test('a query changed on the same page is the same step, at its new address', () => {
  save([{ p: '/a?x=1', n: 0 }]);
  at('/a?x=2');
  arriveWithin();
  assert.deepEqual(kept(), [{ p: '/a?x=2', n: 0 }]);
});

// ---------- out of the race ----------
test("out of the race to its result: the race's step goes and the arrival is ours", () => {
  save([{ p: '/hub', n: 0 }, { p: '/play?race=today', n: 1 }]);
  at('/play?race=today');
  outOfRace('/result/1');
  assert.deepEqual(kept(), [{ p: '/hub', n: 0 }]);
  assert.equal(store.get(GOING), '/result/1');
  at('/result/1', { referrer: 'https://sail.example/play?race=today' });
  arriveLoaded();
  assert.deepEqual(kept(), [{ p: '/hub', n: 0 }, { p: '/result/1', n: 1 }], 'one step on from the page the race was started from');
});

test('out of the race on a browser that keeps nothing still drops its step', () => {
  save([{ p: '/hub', n: 0 }, { p: '/play', n: 1 }]);
  brokenStore = true;
  assert.doesNotThrow(() => outOfRace('/result/1'));
  assert.deepEqual(load(), [{ p: '/hub', n: 0 }]);
});

// ---------- going back ----------
test("back over a link is the browser's own back", () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/b');
  let went = null;
  goBack('/home', (to) => { went = to; });
  assert.deepEqual(wentBack, [-1]);
  assert.equal(went, null, 'the page is not loaded anew');
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }]);
  assert.equal(store.get(GOING), '/a');
});

test('back over a page loaded twice goes back over both its history entries', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 2 }]);
  at('/b');
  goBack('/home');
  assert.deepEqual(wentBack, [-2]);
});

test('the race counts the history entry it added of its own', () => {
  save([{ p: '/hub', n: 0 }, { p: '/play', n: 1 }]);
  at('/play');
  goBack('/home', null, { extra: 1 });
  assert.deepEqual(wentBack, [-2]);
});

test('with more entries than the browser has left, back goes to the page by address', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/b', { historyLength: 2 });
  const went = [];
  goBack('/home', (to) => went.push(to), { extra: 1 });
  assert.deepEqual(wentBack, []);
  assert.deepEqual(went, ['/a']);
  assert.deepEqual(kept(), [{ p: '/a', n: 0 }], 'the page reached by a jump has no known way back');
});

test('single: only one page may be gone back over in the history', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 2 }]);
  at('/b');
  const went = [];
  goBack('/home', (to) => went.push(to), { single: true });
  assert.deepEqual(wentBack, []);
  assert.deepEqual(went, ['/a']);

  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  goBack('/home', (to) => went.push(to), { single: true });
  assert.deepEqual(wentBack, [-1]);
  assert.deepEqual(went, ['/a']);
});

test('with nothing behind you, back goes where the arrow says', () => {
  at('/b');
  const went = [];
  goBack('/home', (to) => went.push(to));
  assert.deepEqual(went, ['/home']);
  assert.deepEqual(kept(), [{ p: '/home', n: 0 }]);
  assert.equal(store.get(GOING), '/home');
});

test('without a router, back goes by the address bar', () => {
  at('/b');
  goBack('/home');
  assert.equal(location.href, '/home');
});

test('back never lands on the race or the language switch', () => {
  save([{ p: '/hub', n: 0 }, { p: '/play', n: 1 }, { p: '/lang', n: 1 }, { p: '/b', n: 1 }]);
  at('/b');
  const went = [];
  goBack('/home', (to) => went.push(to));
  assert.deepEqual(went, ['/hub']);
  assert.deepEqual(wentBack, []);
  assert.deepEqual(kept(), [{ p: '/hub', n: 0 }]);
});

test('a back that cannot be remembered still goes back', () => {
  save([{ p: '/a', n: 0 }, { p: '/b', n: 1 }]);
  at('/b');
  brokenStore = true;
  goBack('/home');
  assert.deepEqual(wentBack, [-1]);
  assert.deepEqual(load(), [{ p: '/a', n: 0 }]);
});
