// /match/new, the host's set-up of a 1-on-1 race: hosting takes an account, so a visitor who isn't signed in is asked to
// sign in and comes back here, in both languages. The session goes through the real lib/supabase/server.ts, over a
// stand-in for Supabase. Run: node --test test/pages-match-new.test.mjs
import { mock } from './load.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

mock('@supabase/ssr', 'export const createServerClient = () => globalThis.__sb; export const createBrowserClient = () => globalThis.__sb;');
let user = null;
globalThis.__sb = { auth: { getUser: async () => ({ data: { user } }) } };

const page = await import('../app/[lang]/match/new/page.tsx');
const props = (lang) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) });
const html = async (lang) => renderToStaticMarkup(await page.default(props(lang)));

test('a visitor who isn\'t signed in is asked to sign in, and comes back to the set-up', async () => {
  user = null;
  const h = await html('en');
  assert.ok(h.includes('Sign in to host a 1-on-1 race'));
  assert.ok(h.includes('Joining a friend’s race doesn’t take an account.'));
  assert.match(h, /class="bt-go" href="\/sign-in\?next=\/match\/new"/);
});

test('the question is in Russian too', async () => {
  user = null;
  const h = await html('ru');
  assert.ok(h.includes('Войди, чтобы создать гонку 1 на 1'));
  assert.ok(h.includes('Чтобы войти в гонку друга, аккаунт не нужен.'));
  assert.match(h, /class="bt-go" href="\/sign-in\?next=\/match\/new"/);
});

test('a visitor who isn\'t signed in gets no way to create a race', async () => {
  user = null;
  const el = await page.default(props('en'));
  assert.notEqual(el.props.match, true, 'not the set-up');
  assert.ok(!(await html('en')).includes('Create the race'));
});

test('a signed-in player gets the set-up', async () => {
  user = { id: 'u1', email: 'a@b.test', user_metadata: { display_name: 'Anna' }, app_metadata: { provider: 'google' } };
  const el = await page.default(props('en'));
  assert.equal(el.props.match, true);
  assert.equal(el.props.from, null);
  assert.ok((await html('en')).includes('Create the race'));
});
