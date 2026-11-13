'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tx, type Lang } from '@/lib/lang';
import { IconBack, IconGoogle } from './ui';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const callback = (next: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

// A1 · Google, or a one-time 6-digit code by email (no password).
export function SignInForm({ lang, next, failed }: { lang: Lang; next: string; failed: boolean }) {
  const t = tx(lang);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(failed ? t('That didn’t work. Try again.', 'Не получилось. Попробуй ещё раз.') : '');
  const google = async () => {
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } });
    if (error) { setBusy(false); setErr(t('Google sign-in isn’t available right now.', 'Вход через Google сейчас недоступен.')); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setErr(t('Type your email address.', 'Введи адрес почты.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: v, options: { shouldCreateUser: true, emailRedirectTo: callback(next) } });
    setBusy(false);
    if (error) { setErr(error.status === 429 ? t('Too many tries. Wait a minute.', 'Слишком много попыток. Подожди минуту.') : t('Couldn’t send the code. Try again.', 'Не удалось отправить код. Попробуй ещё раз.')); return; }
    try { sessionStorage.setItem('regatta-otp-sent', String(Date.now())); } catch {}
    router.push(`/sign-in/code?email=${encodeURIComponent(v)}&next=${encodeURIComponent(next)}`);
  };
  return (
    <>
      <div className="lhead">
        <Link className="round round-s round-muted" href={next} aria-label={t('Back', 'Назад')}><IconBack /></Link>
        <span className="kicker">{t('Account', 'Аккаунт')}</span>
        <span className="sp" />
        <Link className="back-link" href={next}>{t('Not now', 'Не сейчас')}</Link>
      </div>
      <h1 className="h-land-s">{t('Sign in to get on the ranking', 'Войди, чтобы попасть в рейтинг')}</h1>
      <p className="lead muted">{t('Your times go on today’s ranking, and your best times follow you to any device.', 'Твоё время попадёт в рейтинг дня, а рекорды будут с тобой на любом устройстве.')}</p>
      <button type="button" className="pill pill-oauth pill-wide" onClick={google} disabled={busy}><IconGoogle /><span className="btn-t">{t('Continue with Google', 'Войти через Google')}</span></button>
      <div className="or">{t('or by email', 'или по почте')}</div>
      <form className="field-row" onSubmit={send} noValidate>
        <input className="field" type="email" name="email" autoComplete="email" inputMode="email" aria-label={t('Email', 'Почта')} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        <button className="pill pill-primary pill-s" type="submit" disabled={busy}><span className="btn-t">{t('Send code', 'Получить код')}</span></button>
      </form>
      {err ? <p className="err" role="alert">{err}</p> : <p className="hint">{t('No password: we email you a 6-digit code.', 'Без пароля: пришлём на почту 6-значный код.')}</p>}
    </>
  );
}

// A2 · The six digits from the email; it signs in as soon as the last one is typed.
export function CodeForm({ lang, email, next }: { lang: Lang; email: string; next: string }) {
  const t = tx(lang);
  const router = useRouter();
  const [d, setD] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // after a wrong code, back to the first box, once the boxes are enabled again (a disabled box can't take focus)
  const refocus = useRef(false);
  useEffect(() => { if (!busy && refocus.current) { refocus.current = false; refs.current[0]?.focus(); } }, [busy]);
  useEffect(() => {
    let sent = Date.now();
    try { sent = Number(sessionStorage.getItem('regatta-otp-sent')) || sent; } catch {}
    const tick = () => setWait(Math.max(0, 60 - Math.floor((Date.now() - sent) / 1000)));
    tick(); const id = setInterval(tick, 1000);
    refs.current[0]?.focus();
    return () => clearInterval(id);
  }, []);
  const verify = async (code: string) => {
    setBusy(true); setErr('');
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.user) { setBusy(false); setErr(t('That code didn’t work. Check it, or send a new one.', 'Код не подошёл. Проверь его или запроси новый.')); setD(['', '', '', '', '', '']); refocus.current = true; return; }
    router.replace(data.user.user_metadata?.display_name ? next : `/sign-in/name?next=${encodeURIComponent(next)}`);
    router.refresh();
  };
  const put = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    if (!digits) { setD((x) => x.map((c, j) => (j === i ? '' : c))); return; }
    const nx = [...d];
    for (let k = 0; k < digits.length && i + k < 6; k++) nx[i + k] = digits[k];
    setD(nx);
    const last = Math.min(5, i + digits.length);
    refs.current[nx.every(Boolean) ? 5 : last]?.focus();
    if (nx.every(Boolean)) verify(nx.join(''));
  };
  const resend = async () => {
    setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callback(next) } });
    if (error) { setErr(t('Couldn’t send the code. Try again in a minute.', 'Не удалось отправить код. Попробуй через минуту.')); return; }
    try { sessionStorage.setItem('regatta-otp-sent', String(Date.now())); } catch {}
    setWait(60);
  };
  return (
    <>
      <div className="lhead">
        <Link className="round round-s round-muted" href={`/sign-in?next=${encodeURIComponent(next)}`} aria-label={t('Back', 'Назад')}><IconBack /></Link>
        <span className="kicker">{t('Sign in', 'Вход')}</span>
        <span className="sp" />
        <Link className="back-link" href={`/sign-in?next=${encodeURIComponent(next)}`}>{t('Change email', 'Другая почта')}</Link>
      </div>
      <h1 className="h-land-s">{t('Check your email', 'Проверь почту')}</h1>
      <p className="lead muted">{t('We sent a 6-digit code to ', 'Мы отправили 6-значный код на ')}<b className="ink">{email}</b>{t('. Type it here.', '. Введи его здесь.')}</p>
      <div className="otp" role="group" aria-label={t('Code', 'Код')}>
        {d.map((c, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} className={c ? 'on' : ''} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1} value={c} disabled={busy}
            aria-label={`${i + 1}`}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>
      {err ? <p className="err" role="alert">{err}</p> : (
        <p className="hint">{wait > 0
          ? t(`Didn’t get it? Check spam, or send it again in ${mmss(wait)}.`, `Не пришёл? Проверь спам или отправь снова через ${mmss(wait)}.`)
          : <>{t('Didn’t get it? Check spam, or ', 'Не пришёл? Проверь спам или ')}<button type="button" className="back-link" onClick={resend}>{t('send it again', 'отправь снова')}</button>.</>}</p>
      )}
      <span className="sp" />
      <button type="button" className="pill pill-primary pill-wide pill-s" disabled={busy || !d.every(Boolean)} onClick={() => verify(d.join(''))}><span className="btn-t">{t('Sign in', 'Войти')}</span></button>
    </>
  );
}

// A3 · The ranking shows a name, never the email: first name and the first letter of the surname.
export function NameForm({ lang, next, suggested }: { lang: Lang; next: string; suggested: string }) {
  const t = tx(lang);
  const router = useRouter();
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (v.length < 2) { setErr(t('Two letters at least.', 'Хотя бы две буквы.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.updateUser({ data: { display_name: v } });
    if (error) { setBusy(false); setErr(t('Couldn’t save it. Try again.', 'Не удалось сохранить. Попробуй ещё раз.')); return; }
    router.replace(next); router.refresh();
  };
  return (
    <form onSubmit={save} style={{ display: 'contents' }}>
      <div className="lhead"><span className="kicker">{t('Almost there', 'Почти готово')}</span></div>
      <h1 className="h-land-s">{t('How should the ranking show you?', 'Как подписать тебя в рейтинге?')}</h1>
      <p className="lead muted">{t('Only this name is public. Your email stays private.', 'Всем видно только это имя. Почта остаётся скрытой.')}</p>
      <label className="meta" htmlFor="nm">{t('Name on the ranking', 'Имя в рейтинге')}</label>
      <input id="nm" className="field" type="text" autoComplete="nickname" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} autoFocus />
      {err ? <p className="err" role="alert">{err}</p> : <p className="hint">{t('First name and the first letter of your surname works well. You can change it in Settings.', 'Лучше всего имя и первая буква фамилии. Поменять можно в настройках.')}</p>}
      <span className="sp" />
      <button className="pill pill-primary pill-wide pill-s" type="submit" disabled={busy}><span className="btn-t">{t('Save', 'Сохранить')}</span></button>
    </form>
  );
}
