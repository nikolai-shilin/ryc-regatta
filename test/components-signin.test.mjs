// Signing in: Google or a code by email, the six digits, and the name on the ranking. npm test.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './load.mjs';
import { click, clock, dom, done, englishIn, h, hrefs, mount, plain, press, reset, settle, spyRouter, ssr, tick, type } from './fake-dom.mjs';

const { SignInForm, CodeForm, NameForm } = await import('../components/sign-in-forms.tsx');

let auth, router;
beforeEach(() => {
  reset();
  router = spyRouter();
  auth = { calls: [], otpError: null, oauthError: null, verify: { data: { user: { user_metadata: { display_name: 'Anna' } } }, error: null }, updateError: null };
  globalThis.__supabase = { auth: {
    signInWithOAuth: async (a) => { auth.calls.push(['oauth', a]); return { error: auth.oauthError }; },
    signInWithOtp: async (a) => { auth.calls.push(['otp', a]); return { error: auth.otpError }; },
    verifyOtp: async (a) => { auth.calls.push(['verify', a]); return auth.verify; },
    updateUser: async (a) => { auth.calls.push(['update', a]); return { error: auth.updateError }; },
  } };
});
afterEach(done);

// ---------- step 1: the email ----------
const signIn = (p = {}) => mount(h(SignInForm, { lang: 'en', next: '/race', failed: false, ...p }));

test('the first step offers Google or a code, and a way out', () => {
  const html = ssr(h(SignInForm, { lang: 'en', next: '/race/rating', failed: false }));
  assert.match(plain(html), /1 Email Not now Sign in to get on the ranking/);
  assert.match(plain(html), /Continue with Google or by email/);
  assert.match(plain(html), /No password: we email you a 6-digit code\./);
  assert.ok(hrefs(html).includes('/race/rating'));
});

test('signing up is the same form under its own heading', () => {
  const en = plain(ssr(h(SignInForm, { lang: 'en', next: '/match/new', failed: false, signup: true })));
  assert.match(en, /1 Email Not now Create your account/);
  assert.doesNotMatch(en, /Sign in to get on the ranking/);
  assert.match(en, /Continue with Google or by email/);
  const ru = plain(ssr(h(SignInForm, { lang: 'ru', next: '/match/new', failed: false, signup: true })));
  assert.match(ru, /Создай аккаунт/);
  assert.match(ru, /Продолжить с Google/);
});

test('coming back from a failed sign-in says so', () => {
  assert.match(plain(ssr(h(SignInForm, { lang: 'en', next: '/', failed: true }))), /That didn’t work\. Try again\./);
  assert.match(plain(ssr(h(SignInForm, { lang: 'ru', next: '/', failed: true }))), /Не получилось\. Попробуй ещё раз\./);
});

test('something that isn’t an address is refused before anything is sent', async () => {
  const v = await signIn();
  for (const bad of ['', 'anna', 'anna@', 'anna@site', 'a b@c.de']) {
    await type(v.$('#em'), bad);
    await click(v.$('button[type=submit]'));
    assert.equal(v.$('[role=alert]').textContent, 'Type your email address.', bad);
  }
  assert.deepEqual(auth.calls, []);
});

test('a good address is sent a code and the next step opens', async () => {
  const v = await signIn({ next: '/race?x=1' });
  await type(v.$('#em'), '  anna+1@example.com ');
  await click(v.$('button[type=submit]'));
  const [kind, a] = auth.calls[0];
  assert.equal(kind, 'otp');
  assert.equal(a.email, 'anna+1@example.com');
  assert.equal(a.options.shouldCreateUser, true);
  assert.equal(a.options.emailRedirectTo, 'https://updown.test/auth/callback?next=%2Frace%3Fx%3D1');
  assert.deepEqual(router.pushed, ['/sign-in/code?email=anna%2B1%40example.com&next=%2Frace%3Fx%3D1']);
  assert.equal(sessionStorage.getItem('regatta-otp-sent'), String(clock.now));
});

test('the hour\'s emails all gone, an address asking too soon and any other failure each say their own wait', async () => {
  auth.otpError = { status: 429, message: 'email rate limit exceeded' };
  const v = await signIn();
  await type(v.$('#em'), 'a@b.co');
  await click(v.$('button[type=submit]'));
  assert.equal(v.$('[role=alert]').textContent, 'Too many sign-in emails have gone out. Try again in an hour, or continue with Google.');
  auth.otpError = { status: 429, message: 'For security purposes, you can only request this after 42 seconds.' };
  await click(v.$('button[type=submit]'));
  assert.equal(v.$('[role=alert]').textContent, 'Wait 42 seconds, then try again.');
  auth.otpError = { status: 500 };
  await click(v.$('button[type=submit]'));
  assert.equal(v.$('[role=alert]').textContent, 'Couldn’t send the code. Try again.');
  assert.deepEqual(router.pushed, []);
  assert.equal(v.$('#em').disabled, false, 'it can be tried again');
});

test('Google is asked to come back to the page you wanted', async () => {
  const v = await signIn({ next: '/boat' });
  await click(v.$('.au-google'));
  assert.deepEqual(auth.calls[0], ['oauth', { provider: 'google', options: { redirectTo: 'https://updown.test/auth/callback?next=%2Fboat' } }]);
  assert.equal(v.$('.au-google').disabled, true, 'held while the browser goes to Google');
});

test('Google being unavailable is said, and the form comes back', async () => {
  auth.oauthError = { message: 'off' };
  const v = await signIn();
  await click(v.$('.au-google'));
  assert.equal(v.$('[role=alert]').textContent, 'Google sign-in isn’t available right now.');
  assert.equal(v.$('.au-google').disabled, false);
});

test('the first step in Russian', () => {
  const words = plain(ssr(h(SignInForm, { lang: 'ru', next: '/', failed: false })));
  assert.match(words, /Войди, чтобы попасть в рейтинг/);
  assert.deepEqual(englishIn(words, ['you@example.com']), []);
});

// ---------- step 2: the code ----------
const code = (p = {}) => mount(h(CodeForm, { lang: 'en', email: 'anna@example.com', next: '/race', ...p }));
const boxes = (v) => v.$$('.otp input');
const hint = (v) => v.$('.hint').textContent;

test('the code step says where it went, with six boxes and the first ready', async () => {
  const v = await code();
  assert.equal(v.$('.lead').textContent, 'We sent a 6-digit code to anna@example.com. Type it here.');
  assert.equal(boxes(v).length, 6);
  assert.equal(document.activeElement, boxes(v)[0]);
  assert.equal(v.$('.back-link').getAttribute('href'), '/sign-in?next=%2Frace');
  assert.equal(v.$('.pill-primary').disabled, true);
});

test('each digit moves on to the next box', async () => {
  const v = await code();
  await type(boxes(v)[0], '1');
  assert.equal(boxes(v)[0].value, '1');
  assert.equal(document.activeElement, boxes(v)[1]);
  assert.ok(boxes(v)[0].classList.contains('on'));
});

test('only digits go in', async () => {
  const v = await code();
  await type(boxes(v)[0], 'x');
  assert.equal(boxes(v)[0].value, '');
  assert.equal(document.activeElement, boxes(v)[0]);
});

test('emptying a box clears that digit alone', async () => {
  const v = await code();
  await type(boxes(v)[0], '12');
  await type(boxes(v)[0], '');
  assert.deepEqual(boxes(v).map((b) => b.value).slice(0, 2), ['', '2']);
});

test('Backspace in an empty box goes back one', async () => {
  const v = await code();
  await type(boxes(v)[0], '1');
  await press('Backspace', boxes(v)[1]);
  assert.equal(document.activeElement, boxes(v)[0]);
});

test('a pasted code fills the boxes and signs in at once', async () => {
  const v = await code();
  await type(boxes(v)[0], '123 456');
  assert.deepEqual(auth.calls, [['verify', { email: 'anna@example.com', token: '123456', type: 'email' }]]);
  assert.deepEqual(router.replaced, ['/race']);
  assert.equal(router.refreshed, 1);
  assert.ok(v.$('.otp'));
});

test('the last digit typed signs in', async () => {
  const v = await code();
  for (let i = 0; i < 6; i++) await type(boxes(v)[i], String(i));
  assert.equal(auth.calls[0][1].token, '012345');
  assert.deepEqual(router.replaced, ['/race']);
});

test('someone with no name on the ranking yet is asked for one', async () => {
  auth.verify = { data: { user: { user_metadata: {} } }, error: null };
  const v = await code({ next: '/race?x=1' });
  await type(boxes(v)[0], '123456');
  assert.deepEqual(router.replaced, ['/sign-in/name?next=%2Frace%3Fx%3D1']);
});

test('a wrong code clears the boxes and puts you back at the first', async () => {
  auth.verify = { data: {}, error: { message: 'bad' } };
  const v = await code();
  await type(boxes(v)[0], '123456');
  assert.equal(v.$('[role=alert]').textContent, 'That code didn’t work. Check it, or send a new one.');
  assert.deepEqual(boxes(v).map((b) => b.value), ['', '', '', '', '', '']);
  assert.equal(boxes(v)[0].disabled, false);
  assert.equal(document.activeElement, boxes(v)[0]);
  assert.deepEqual(router.replaced, []);
});

test('sending again is a minute away, counted down', async () => {
  const v = await code();
  assert.match(hint(v), /send it again in 1:00\.$/);
  await tick(1000);
  assert.match(hint(v), /send it again in 0:59\.$/);
  await tick(50000);
  assert.match(hint(v), /send it again in 0:09\.$/);
  assert.equal(v.$('.hint button'), null);
});

test('the minute counts from when the code was sent, across a reload', async () => {
  sessionStorage.setItem('regatta-otp-sent', String(clock.now - 45000));
  const v = await code();
  assert.match(hint(v), /send it again in 0:15\.$/);
});

test('after the minute the code can be sent again', async () => {
  const v = await code();
  await tick(60000);
  await click(v.$('.hint button'));
  assert.equal(auth.calls[0][0], 'otp');
  assert.equal(auth.calls[0][1].email, 'anna@example.com');
  assert.equal(sessionStorage.getItem('regatta-otp-sent'), String(clock.now));
  assert.match(hint(v), /send it again in 1:00\.$/);
});

test('after sending again the next minute is counted down in full', async () => {
  const v = await code();
  await tick(60000);
  await click(v.$('.hint button'));
  await tick(1000);
  assert.match(hint(v), /send it again in 0:59\.$/);
});

test('a code that can’t be sent again says so', async () => {
  auth.otpError = { status: 500 };
  const v = await code();
  await tick(60000);
  await click(v.$('.hint button'));
  assert.equal(v.$('[role=alert]').textContent, 'Couldn’t send the code. Try again in a minute.');
});

for (const [lang, message, says] of [
  ['en', 'email rate limit exceeded', 'Too many sign-in emails have gone out. Try again in an hour, or continue with Google.'],
  ['ru', 'email rate limit exceeded', 'Отправлено слишком много писем для входа. Попробуй через час или войди через Google.'],
  ['en', 'For security purposes, you can only request this after 7 seconds.', 'Wait 7 seconds, then try again.'],
  ['ru', 'For security purposes, you can only request this after 7 seconds.', 'Подожди 7 сек. и попробуй снова.'],
]) test(`sending a code again says the real wait (${lang}): ${says}`, async () => {
  auth.otpError = { status: 429, message };
  const v = await code({ lang });
  await tick(60000);
  await click(v.$('.hint button'));
  assert.equal(v.$('[role=alert]').textContent, says);
});

test('the code step in Russian', async () => {
  const v = await code({ lang: 'ru' });
  assert.match(v.text(), /Проверь почту/);
  assert.match(hint(v), /отправь снова через 1:00\.$/);
  assert.deepEqual(englishIn(v.text(), ['anna@example.com']), []);
});

// ---------- step 3: the name ----------
const name = (p = {}) => mount(h(NameForm, { lang: 'en', next: '/', suggested: 'Anna P.', ...p }));
const DAY = '2026-11-18';

test('the name step starts from the name suggested', async () => {
  const v = await name();
  assert.equal(v.$('#nm').value, 'Anna P.');
  assert.match(v.text(), /3 Name Almost there/);
  assert.match(v.text(), /First name and the first letter of your surname works well\./);
});

test('a name from Google says where it came from', async () => {
  const v = await name({ fromGoogle: true });
  assert.match(v.text(), /Taken from your Google account/);
});

test('the button says where saving leads', async () => {
  let v = await name({ next: '/race/free' });
  assert.equal(v.$('button').textContent, 'Save and race');
  await v.unmount();
  v = await name({ next: '/boat' });
  assert.equal(v.$('button').textContent, 'Save');
});

test('a name of one letter is refused', async () => {
  const v = await name();
  await type(v.$('#nm'), ' A ');
  await click(v.$('button'));
  assert.equal(v.$('[role=alert]').textContent, 'Two letters at least.');
  assert.deepEqual(auth.calls, []);
});

test('a name made only of emoji is refused too', async () => {
  const v = await name();
  await type(v.$('#nm'), '🚀🚀🚀');
  await click(v.$('button'));
  assert.ok(v.$('[role=alert]'));
});

test('the name is saved clean and you go where you were going', async () => {
  const v = await name({ next: '/race' });
  await type(v.$('#nm'), 'Anna 🚀 K.');
  await click(v.$('button'));
  assert.deepEqual(auth.calls, [['update', { data: { display_name: 'Anna K.' } }]]);
  assert.deepEqual(router.replaced, ['/race']);
  assert.equal(router.refreshed, 1);
});

test('a name that can’t be saved says so and can be tried again', async () => {
  auth.updateError = { message: 'no' };
  const v = await name();
  await click(v.$('button'));
  assert.equal(v.$('[role=alert]').textContent, 'Couldn’t save it. Try again.');
  assert.equal(v.$('#nm').disabled, false);
  assert.deepEqual(router.replaced, []);
});

test('a time of today’s on this device shows where it would go on the ranking', async () => {
  localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${DAY}`]: 75 }));
  const v = await name({ day: DAY, times: [60, 70, 80] });
  assert.equal(plain(v.$('.au-pv').innerHTML), '3 Anna P. 1:15.0');
  await type(v.$('#nm'), 'Bo');
  assert.equal(plain(v.$('.au-pv').innerHTML), '3 Bo 1:15.0');
  await type(v.$('#nm'), '');
  assert.equal(plain(v.$('.au-pv').innerHTML), '3 Your name 1:15.0');
});

test('the day’s results kept here count when they are faster', async () => {
  localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${DAY}`]: 75 }));
  localStorage.setItem('regatta-result-a', JSON.stringify({ daily: DAY, boats: [{ me: true, done: true, dsq: false, secs: 65 }] }));
  localStorage.setItem('regatta-result-b', JSON.stringify({ daily: DAY, boats: [{ me: true, done: true, dsq: true, secs: 50 }] }));
  localStorage.setItem('regatta-result-c', JSON.stringify({ daily: '2026-11-17', boats: [{ me: true, done: true, dsq: false, secs: 40 }] }));
  const v = await name({ day: DAY, times: [60, 70, 80] });
  assert.equal(plain(v.$('.au-pv').innerHTML), '2 Anna P. 1:05.0');
});

test('no time today, or no ranking to set it against, shows no row', async () => {
  let v = await name({ day: DAY, times: [60] });
  assert.equal(v.$('.au-pv'), null);
  await v.unmount();
  localStorage.setItem('regatta-pb', JSON.stringify({ [`daily|${DAY}`]: 75 }));
  v = await name({ day: DAY, times: null });
  assert.equal(v.$('.au-pv'), null);
});

test('damaged records on this device don’t stop the step', async () => {
  localStorage.setItem('regatta-pb', '{oops');
  const v = await name({ day: DAY, times: [60] });
  assert.equal(v.$('.au-pv'), null);
  assert.ok(v.$('#nm'));
  await settle();
  assert.deepEqual(dom.reported, []);
});

test('the name step in Russian', async () => {
  const v = await name({ lang: 'ru', suggested: 'Анна П.', next: '/race' });
  assert.equal(v.$('button').textContent, 'Сохранить и в гонку');
  assert.match(v.text(), /Почти готово: как подписать тебя в рейтинге\?/);
  assert.deepEqual(englishIn(v.text()), []);
});
