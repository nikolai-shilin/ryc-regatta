// Who is signed in, read from the session cookie in the browser (lib/me.ts), and the language proxy.ts picks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { applyMe } = await import('../lib/me.ts');
const { pickLang } = await import('../lib/lang.ts');

// just enough of a document: the cookie, and <html>'s attributes and style
function page(cookie) {
  const attrs = new Map(), style = new Map();
  globalThis.document = {
    cookie,
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k),
      style: { setProperty: (k, v) => style.set(k, v), removeProperty: (k) => style.delete(k) },
    },
  };
  applyMe();
  return { me: attrs.has('data-me'), ini: style.get('--me-ini'), name: style.get('--me-name') };
}
const b64url = (s) => Buffer.from(s).toString('base64url');
const session = (user, extra = {}) => 'base64-' + b64url(JSON.stringify({ access_token: 'x.y.z', refresh_token: 'r', ...extra, user }));
const ref = 'sb-abcdefghijklmnop-auth-token';

test('a guest: no session cookie, nothing marked', () => {
  assert.deepEqual(page(''), { me: false, ini: undefined, name: undefined });
  assert.equal(page(`lang=ru; ${ref}-code-verifier=abc`).me, false); // the sign-in's PKCE cookie isn't a session
});

test('the ranking name gives the initials, Cyrillic too', () => {
  assert.deepEqual(page(`lang=ru; ${ref}=${session({ email: 'a@b.c', user_metadata: { display_name: 'Николай Шилин' } })}`),
    { me: true, ini: '"НШ"', name: '"Николай Шилин"' });
});

test('no name yet: the address, as getAccount and initials() have it', () => {
  assert.deepEqual(page(`${ref}=${session({ email: 'sailor.one@example.com', user_metadata: {} })}`),
    { me: true, ini: '"SO"', name: '"sailor.one@example.com"' });
});

test('a Telegram player without a name: the made-up address is never shown', () => {
  assert.deepEqual(page(`${ref}=${session({ email: 'tg123@telegram.invalid', app_metadata: { telegram_id: 123 }, user_metadata: {} })}`),
    { me: true, ini: '"·"', name: '""' });
});

test('a long session split over chunked cookies, in any order', () => {
  const v = session({ email: 'a@b.c', user_metadata: { display_name: 'Ann Lee', pb: Object.fromEntries([...Array(200)].map((_, i) => [`k${i}`, i])) } });
  const half = Math.floor(v.length / 2);
  assert.equal(page(`${ref}.1=${v.slice(half)}; x=1; ${ref}.0=${v.slice(0, half)}`).ini, '"AL"');
});

test('no user in the session: the access token’s claims', () => {
  const jwt = `h.${b64url(JSON.stringify({ email: 'a@b.c', user_metadata: { display_name: 'Bo "Q" \\ Z' } }))}.s`;
  const v = 'base64-' + b64url(JSON.stringify({ access_token: jwt }));
  assert.deepEqual(page(`${ref}=${v}`), { me: true, ini: '"B\\""', name: '"Bo \\"Q\\" \\\\ Z"' }); // as initials() splits it, and safe CSS strings
});

test('a broken cookie counts as signed out, and signing out clears the marks', () => {
  page(`${ref}=${session({ email: 'a@b.c' })}`);
  assert.equal(page(`${ref}=base64-!!!`).me, false);
});

test('the language: the address, then the cookie, then the browser', () => {
  assert.equal(pickLang('ru', 'en', 'en-GB'), 'ru');
  assert.equal(pickLang('xx', 'ru', 'en-GB'), 'ru');
  assert.equal(pickLang(null, null, 'uk-UA,uk;q=0.9'), 'ru');
  assert.equal(pickLang(null, 'de', 'tr-TR,tr;q=0.9,en;q=0.8'), 'en');
  assert.equal(pickLang(undefined, undefined, null), 'en');
});
