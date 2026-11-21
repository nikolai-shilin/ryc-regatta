// An open call's page, /call/[code] (release 5a of the 1-on-1 plan): who calls, rating and level, where if wished, the
// band; open — Take it for a signed-in sailor in the band (/duel?take=), Sign in to take it for a visitor, the band said
// to one outside it, their own call to the caller; taken (by whom), away and closed with Find a race; a code that isn't
// one. Its share card. And the reader of the database's answers (lib/duel-call.ts). The session and the database go
// through the real lib/supabase/server.ts over a stand-in. Run: node --test test/pages-call.test.mjs
import { mock } from './load.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { plain } from './fake-dom.mjs';

mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
let user = null, view = null;
const asked = [];
globalThis.__sb = { auth: { getUser: async () => ({ data: { user } }) }, rpc: async (fn, args) => { asked.push({ fn, ...args }); return { data: view, error: null }; },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
const SIGNED = { id: 'u', email: 'b@example.com', user_metadata: { display_name: 'Bea' }, app_metadata: {} };

const page = await import('../app/[lang]/call/[code]/page.tsx');
const { parseCall, parsePosted, callCode } = await import('../lib/duel-call.ts');
const VIEW = { code: 'K7M2QZ', name: 'Alex P.', rating: 1558, races: 41, lo: 1458, hi: 1658, venue: 'gocek', yacht: 'j70', state: 'open', taken_name: null, left: 2950, mine: false, fits: null };
const props = (lang = 'en', code = 'K7M2QZ') => ({ params: Promise.resolve({ lang, code }) });
const html = async (o = {}, lang, code) => { view = { ...VIEW, ...o }; return renderToStaticMarkup(await page.default(props(lang, code))); };
beforeEach(() => { user = null; asked.length = 0; });

test('the database\'s answer is read as it is; anything malformed is nothing', () => {
  const c = parseCall({ ...VIEW, state: 'taken', taken_name: 'Bea' });
  assert.deepEqual(c, { code: 'K7M2QZ', name: 'Alex P.', rating: 1558, races: 41, lo: 1458, hi: 1658, venue: 'gocek', yacht: 'j70', state: 'taken', takenBy: 'Bea', left: 2950, mine: false, fits: null });
  for (const bad of [null, {}, { ...VIEW, code: 'nope' }, { ...VIEW, state: 'won' }, { ...VIEW, lo: '1458' }]) assert.equal(parseCall(bad), null, JSON.stringify(bad));
  assert.equal(parseCall({ ...VIEW, venue: 'atlantis' }).venue, null);
  assert.deepEqual(parsePosted({ status: 'open', code: 'k7m2qz', lo: 1458, hi: 1658, left: '3600' }), { status: 'open', code: 'K7M2QZ', lo: 1458, hi: 1658, left: 3600 });
  assert.deepEqual(parsePosted({ status: 'none', reason: 'not_looking' }), { status: 'none', reason: 'not_looking' });
  assert.equal(callCode(' k7m2qz '), 'K7M2QZ'); assert.equal(callCode('K7M2Q0'), null);
});

test('open, to a visitor: who, level and rating, where, the band; sign in to take it, and back to take it', async () => {
  const h = await html();
  assert.match(plain(h), /Open call · 1-on-1 · rated Race me Alex P\. Fleet 1558 Göcek · J\/70 · one lap · about 4 min · for 1458–1658 Open Rated races need an account on both sides\. Sign in, and the call is yours to take\. Sign in to take it/);
  assert.match(h, /href="\/sign-in\?next=%2Fduel%3Ftake%3DK7M2QZ"/);
  assert.deepEqual(asked.at(-1), { fn: 'regatta_call_view', p_code: 'K7M2QZ' });
});

test('open, to a signed-in sailor in the band: Take it, to /duel; outside it, the band; to the caller, their own', async () => {
  user = SIGNED;
  const inBand = await html({ fits: true });
  assert.match(inBand, /class="bt-go df-go" href="\/duel\?take=K7M2QZ"/);
  assert.match(plain(inBand), /Take it Find a race Then ten seconds to say Ready, as with any match\. Open for 50 more min\./);
  assert.match(plain(await html({ fits: false })), /This call is for ratings 1458–1658, and yours is outside it\./);
  assert.match(plain(await html({ mine: true, fits: true })), /This is your call\. It stays open while you look on the 1-on-1 page/);
  assert.doesNotMatch(await html({ mine: true, fits: true }), /take=/);
});

test('taken, by whom; away; closed: each with Find a race and no way to take it', async () => {
  user = SIGNED;
  for (const [o, said] of [[{ state: 'taken', taken_name: 'Cara M.' }, /Taken Cara M\. took it\. Find a race of your own/], [{ state: 'away' }, /Waiting Alex P\. isn’t looking for a race right now\. The call is still theirs for 50 min/], [{ state: 'closed', left: 0 }, /Closed This call has closed\./]]) {
    const h = await html({ ...o, fits: true });
    assert.match(plain(h), said);
    assert.doesNotMatch(h, /take=/);
    assert.match(h, /href="\/duel"/);
  }
});

test('a code that isn\'t one, or a call that isn\'t there, says the link doesn\'t work; in Russian too', async () => {
  assert.match(plain(await html({}, 'en', 'nope')), /This call link doesn’t work/);
  assert.equal(asked.length, 0, 'nothing asked for a bad code');
  view = null; assert.match(plain(renderToStaticMarkup(await page.default(props('en', 'ABCDEF')))), /This call link doesn’t work/);
  assert.match(plain(await html({}, 'ru')), /Открытый вызов · 1 на 1 · рейтинг Сыграем Alex P\. Флот 1558 .* для 1458–1658 Открыт/);
});

test('its share card is the call\'s own (drawn in test/pages-og.test.mjs); never indexed', async () => {
  view = VIEW;
  const m = await page.generateMetadata(props());
  assert.equal(m.title, 'Alex P. wants a 1-on-1 race: take the call');
  assert.deepEqual(m.robots, { index: false, follow: true });
  const img = String(m.openGraph.images[0].url);
  assert.match(img, /^\/og\/page\/call\?n=Alex\+P\.&r=1558&p=41&lo=1458&hi=1658&v=gocek&b=j70&lang=en$/);
});
