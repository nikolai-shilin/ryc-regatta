// Who is signed in, as the server reads it (lib/supabase/server.ts): the session's cookies, and the account's name,
// address and way of signing in.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from './load.mjs';

mock('@supabase/ssr', 'export const createServerClient = (...a) => globalThis.__ssr(...a);');
const { supabaseServer, getAccount, initials } = await import('../lib/supabase/server.ts');

let user, made;
beforeEach(() => {
  user = null; made = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub';
  globalThis.__request = { cookies: { 'sb-x-auth-token': 'tok', lang: 'ru' } };
  globalThis.__ssr = (url, key, o) => { made = { url, key, o }; return { auth: { getUser: async () => ({ data: { user } }) } }; };
});

test('the client is made for the project, on the request\'s cookies', async () => {
  await supabaseServer();
  assert.equal(made.url, 'https://proj.supabase.test'); assert.equal(made.key, 'pub');
  assert.deepEqual(made.o.cookies.getAll(), [{ name: 'sb-x-auth-token', value: 'tok' }, { name: 'lang', value: 'ru' }]);
});

test('a refreshed session is written back', async () => {
  await supabaseServer();
  made.o.cookies.setAll([{ name: 'sb-x-auth-token', value: 'fresh', options: {} }]);
  assert.equal(globalThis.__request.cookies['sb-x-auth-token'], 'fresh');
});

test('a server component, which can\'t set cookies, doesn\'t break the page', async () => {
  await supabaseServer();
  assert.doesNotThrow(() => made.o.cookies.setAll([{ get name() { throw new Error('read-only'); }, value: 'x' }]));
});

test('a guest has no account', async () => {
  assert.equal(await getAccount(), null);
});

test('an account by email or Google: its address, its name without emoji, how it signs in', async () => {
  user = { id: 'u1', email: 'a@b.test', user_metadata: { display_name: 'Anna 🚤' }, app_metadata: { provider: 'google' } };
  assert.deepEqual(await getAccount(), { id: 'u1', email: 'a@b.test', name: 'Anna', provider: 'google' });
});

test('a Telegram player\'s made-up address is never shown', async () => {
  user = { id: 'u2', email: 'tg123@made.up', user_metadata: { display_name: 'Ivan' }, app_metadata: { telegram_id: 123, provider: 'email' } };
  assert.deepEqual(await getAccount(), { id: 'u2', email: '', name: 'Ivan', provider: 'telegram' });
});

test('an account with nothing filled in still reads', async () => {
  user = { id: 'u3', app_metadata: {} };
  assert.deepEqual(await getAccount(), { id: 'u3', email: '', name: '', provider: 'email' });
});

test('the avatar\'s letters are the shared ones', () => {
  assert.equal(initials('Anna Petrova', ''), 'AP');
});
