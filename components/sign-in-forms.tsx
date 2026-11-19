'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tx, type Lang, type T } from '@/lib/lang';
import { cleanName, NAME_MAX } from '@/lib/name';
import { placeAmong } from '@/lib/race-log';
import { IconGoogle, clock } from './ui';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const callback = (next: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

// Why a code didn't go. A 429 is one of two limits: this address asked again too soon (Supabase names the seconds
// left), or the project has sent all the emails it may this hour, which no one's waiting a minute will mend.
function sendFailed(t: T, error: { status?: number; message?: string }, other: string) {
  if (error.status !== 429) return other;
  const secs = /after (\d+) second/.exec(error.message || '')?.[1];
  return secs
    ? t(`Wait ${secs} seconds, then try again.`, `Подожди ${secs} сек. и попробуй снова.`, `Espera ${secs} segundos y vuelve a intentarlo.`, `Warte ${secs} Sekunden und versuch es dann nochmal.`)
    : t('Too many sign-in emails have gone out. Try again in an hour, or continue with Google.', 'Отправлено слишком много писем для входа. Попробуй через час или войди через Google.', 'Se han enviado demasiados correos de acceso. Inténtalo de nuevo en una hora, o continúa con Google.', 'Es sind zu viele Anmelde-E-Mails verschickt worden. Versuch es in einer Stunde nochmal oder mach mit Google weiter.');
}

// The numbered step at the card's top (1 Email, 2 Code, 3 Name), and on its right a way out of it
function Step({ n, label, children }: { n: number; label: string; children?: React.ReactNode }) {
  return (
    <div className="au-step-h">
      <span className="au-step"><b>{n}</b><span className="lbl-ink">{label}</span></span>
      {children}
    </div>
  );
}

// A1 · Google, or a one-time 6-digit code by email (no password). Either makes the account the first time, so signing
// up is this same form under its own heading (signup).
export function SignInForm({ lang, next, failed, signup = false }: { lang: Lang; next: string; failed: boolean; signup?: boolean }) {
  const t = tx(lang);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(failed ? t('That didn’t work. Try again.', 'Не получилось. Попробуй ещё раз.', 'No ha funcionado. Inténtalo de nuevo.', 'Das hat nicht geklappt. Versuch es nochmal.') : '');
  const google = async () => {
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } });
    if (error) { setBusy(false); setErr(t('Google sign-in isn’t available right now.', 'Вход через Google сейчас недоступен.', 'El inicio de sesión con Google no está disponible ahora mismo.', 'Die Anmeldung mit Google ist gerade nicht verfügbar.')); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setErr(t('Type your email address.', 'Введи адрес почты.', 'Escribe tu correo electrónico.', 'Gib deine E-Mail-Adresse ein.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: v, options: { shouldCreateUser: true, emailRedirectTo: callback(next) } });
    setBusy(false);
    if (error) { setErr(sendFailed(t, error, t('Couldn’t send the code. Try again.', 'Не удалось отправить код. Попробуй ещё раз.', 'No se pudo enviar el código. Inténtalo de nuevo.', 'Der Code konnte nicht gesendet werden. Versuch es nochmal.'))); return; }
    try { sessionStorage.setItem('regatta-otp-sent', String(Date.now())); } catch {}
    router.push(`/sign-in/code?email=${encodeURIComponent(v)}&next=${encodeURIComponent(next)}`);
  };
  return (
    <>
      <Step n={1} label={t('Email', 'Почта', 'Correo', 'E-Mail')}><Link className="back-link" href={next}>{t('Not now', 'Не сейчас', 'Ahora no', 'Nicht jetzt')}</Link></Step>
      <h1 className="h-land-s">{signup ? t('Create your account', 'Создай аккаунт', 'Crea tu cuenta', 'Konto erstellen') : t('Sign in to get on the ranking', 'Войди, чтобы попасть в рейтинг', 'Inicia sesión para entrar en la clasificación', 'Melde dich an, um in die Rangliste zu kommen')}</h1>
      <p className="lead muted">{t('Your times go on today’s ranking, and your best times follow you to any device.', 'Твоё время попадёт в рейтинг дня, а рекорды будут с тобой на любом устройстве.', 'Tus tiempos entran en la clasificación de hoy, y tus mejores tiempos te siguen a cualquier dispositivo.', 'Deine Zeiten kommen in die Rangliste des Tages, und deine Bestzeiten folgen dir auf jedes Gerät.')}</p>
      <button type="button" className="pill pill-oauth pill-wide au-google" onClick={google} disabled={busy}><IconGoogle /><span className="btn-t">{t('Continue with Google', signup ? 'Продолжить с Google' : 'Войти через Google', signup ? 'Continuar con Google' : 'Entrar con Google', signup ? 'Weiter mit Google' : 'Mit Google anmelden')}</span></button>
      <div className="or">{t('or by email', 'или по почте', 'o por correo', 'oder per E-Mail')}</div>
      <form className="au-form" onSubmit={send} noValidate>
        <label className="au-lbl" htmlFor="em">{t('Email', 'Почта', 'Correo', 'E-Mail')}</label>
        <input id="em" className="field" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        <button className="pill pill-primary pill-wide pill-s" type="submit" disabled={busy}><span className="btn-t">{t('Send code', 'Получить код', 'Enviar código', 'Code senden')}</span></button>
      </form>
      {err ? <p className="err" role="alert">{err}</p> : <p className="hint">{t('No password: we email you a 6-digit code.', 'Без пароля: пришлём на почту 6-значный код.', 'Sin contraseña: te enviamos por correo un código de 6 dígitos.', 'Kein Passwort: Wir mailen dir einen 6-stelligen Code.')}</p>}
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
  const sent = useRef(0); // when the code last went, so that sending it again starts the minute over
  useEffect(() => {
    sent.current = Date.now();
    try { sent.current = Number(sessionStorage.getItem('regatta-otp-sent')) || sent.current; } catch {}
    const tick = () => setWait(Math.max(0, 60 - Math.floor((Date.now() - sent.current) / 1000)));
    tick(); const id = setInterval(tick, 1000);
    refs.current[0]?.focus();
    return () => clearInterval(id);
  }, []);
  const verify = async (code: string) => {
    setBusy(true); setErr('');
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.user) { setBusy(false); setErr(t('That code didn’t work. Check it, or send a new one.', 'Код не подошёл. Проверь его или запроси новый.', 'Ese código no ha funcionado. Revísalo o pide uno nuevo.', 'Dieser Code hat nicht funktioniert. Prüf ihn oder lass einen neuen senden.')); setD(['', '', '', '', '', '']); refocus.current = true; return; }
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
    if (error) { setErr(sendFailed(t, error, t('Couldn’t send the code. Try again in a minute.', 'Не удалось отправить код. Попробуй через минуту.', 'No se pudo enviar el código. Inténtalo de nuevo en un minuto.', 'Der Code konnte nicht gesendet werden. Versuch es in einer Minute nochmal.'))); return; }
    sent.current = Date.now();
    try { sessionStorage.setItem('regatta-otp-sent', String(sent.current)); } catch {}
    setWait(60);
  };
  return (
    <>
      <Step n={2} label={t('Code', 'Код', 'Código', 'Code')}><Link className="back-link" href={`/sign-in?next=${encodeURIComponent(next)}`}>{t('Change email', 'Другая почта', 'Cambiar correo', 'E-Mail ändern')}</Link></Step>
      <h1 className="h-land-s">{t('Check your email', 'Проверь почту', 'Revisa tu correo', 'Prüfe deine E-Mails')}</h1>
      <p className="lead muted">{t('We sent a 6-digit code to ', 'Мы отправили 6-значный код на ', 'Hemos enviado un código de 6 dígitos a ', 'Wir haben einen 6-stelligen Code an ')}<b className="ink">{email}</b>{t('. Type it here.', '. Введи его здесь.', '. Escríbelo aquí.', ' geschickt. Gib ihn hier ein.')}</p>
      <div className="otp" role="group" aria-label={t('Code', 'Код', 'Código', 'Code')}>
        {d.map((c, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} className={c ? 'on' : ''} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1} value={c} disabled={busy}
            aria-label={`${i + 1}`}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>
      {err ? <p className="err" role="alert">{err}</p> : (
        <p className="hint">{wait > 0
          ? t(`Didn’t get it? Check spam, or send it again in ${mmss(wait)}.`, `Не пришёл? Проверь спам или отправь снова через ${mmss(wait)}.`, `¿No te ha llegado? Mira en el spam o vuelve a enviarlo en ${mmss(wait)}.`, `Nichts bekommen? Schau im Spam nach oder sende ihn in ${mmss(wait)} nochmal.`)
          : <>{t('Didn’t get it? Check spam, or ', 'Не пришёл? Проверь спам или ', '¿No te ha llegado? Mira en el spam o ', 'Nichts bekommen? Schau im Spam nach oder ')}<button type="button" className="back-link" onClick={resend}>{t('send it again', 'отправь снова', 'envíalo de nuevo', 'sende ihn nochmal')}</button>.</>}</p>
      )}
      <span className="sp" />
      <button type="button" className="pill pill-primary pill-wide pill-s" disabled={busy || !d.every(Boolean)} onClick={() => verify(d.join(''))}><span className="btn-t">{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden')}</span></button>
    </>
  );
}

// A3 · The ranking shows a name, never the email: first name and the first letter of the surname.
// Your best time in today's race on this device: the game's record of it (regatta-pb), else the day's results kept here
function todaysTime(day: string) {
  let best: number | null = null;
  try {
    const pb = JSON.parse(localStorage.getItem('regatta-pb') || '{}')[`daily|${day}`];
    if (typeof pb === 'number' && pb > 0) best = pb;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('regatta-result-')) continue;
      const r = JSON.parse(localStorage.getItem(k) || 'null'), me = r?.daily === day && Array.isArray(r.boats) ? r.boats.find((b: { me?: boolean }) => b.me) : null;
      if (me && me.done && !me.dsq && typeof me.secs === 'number' && (best == null || me.secs < best)) best = me.secs;
    }
  } catch {}
  return best;
}

// day and times: today's race and its ranked times (lib/rating.ts; null when they couldn't be had). With a time of
// today's on this device, a row shows where it would go on the ranking, under the name being typed
export function NameForm({ lang, next, suggested, fromGoogle = false, day, times = null }: { lang: Lang; next: string; suggested: string; fromGoogle?: boolean; day?: string; times?: number[] | null }) {
  const t = tx(lang);
  const router = useRouter();
  const [name, setName] = useState(suggested);
  const [mine, setMine] = useState<number | null>(null);
  useEffect(() => { if (day && times) setMine(todaysTime(day)); }, [day, times]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = cleanName(name);
    if (v.length < 2) { setErr(t('Two letters at least.', 'Хотя бы две буквы.', 'Mínimo dos letras.', 'Mindestens zwei Buchstaben.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.updateUser({ data: { display_name: v } });
    if (error) { setBusy(false); setErr(t('Couldn’t save it. Try again.', 'Не удалось сохранить. Попробуй ещё раз.', 'No se pudo guardar. Inténtalo de nuevo.', 'Konnte nicht gespeichert werden. Versuch es nochmal.')); return; }
    router.replace(next); router.refresh();
  };
  return (
    <form onSubmit={save} style={{ display: 'contents' }}>
      <Step n={3} label={t('Name', 'Имя', 'Nombre', 'Name')} />
      <h1 className="h-land-s">{t('Almost there: how should the ranking show you?', 'Почти готово: как подписать тебя в рейтинге?', 'Casi listo: ¿cómo quieres que te muestre la clasificación?', 'Fast geschafft: Wie soll die Rangliste dich zeigen?')}</h1>
      <p className="lead muted">{t('Only this name is public. Your email stays private.', 'Всем видно только это имя. Почта остаётся скрытой.', 'Solo este nombre es público. Tu correo sigue siendo privado.', 'Nur dieser Name ist öffentlich. Deine E-Mail bleibt privat.')}</p>
      <label className="au-lbl" htmlFor="nm">{t('Name on the ranking', 'Имя в рейтинге', 'Nombre en la clasificación', 'Name in der Rangliste')}</label>
      <input id="nm" className="field" type="text" autoComplete="nickname" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} autoFocus />
      {mine != null && times && (
        <ol className="hm-lb bt-lb au-pv" aria-label={t('Where your time today goes on the ranking', 'Где твоё сегодняшнее время в рейтинге', 'Dónde entra tu tiempo de hoy en la clasificación', 'Wo deine Zeit von heute in der Rangliste steht')}>
          <li className="me"><span className="hm-n">{placeAmong(times, mine)}</span><span>{cleanName(name) || t('Your name', 'Твоё имя', 'Tu nombre', 'Dein Name')}</span><span className="hm-t">{clock(mine)}</span></li>
        </ol>
      )}
      {err ? <p className="err" role="alert">{err}</p> : <p className="hint">{fromGoogle ? t('Taken from your Google account: change it if you like. You can change it later in Settings too.', 'Взято из аккаунта Google — поменяй, если хочешь. Позже это можно сделать и в настройках.', 'Tomado de tu cuenta de Google: cámbialo si quieres. También puedes cambiarlo luego en Ajustes.', 'Aus deinem Google-Konto übernommen: Ändere ihn, wenn du magst. Du kannst ihn auch später in den Einstellungen ändern.') : t('First name and the first letter of your surname works well. You can change it in Settings.', 'Лучше всего имя и первая буква фамилии. Поменять можно в настройках.', 'Funciona bien el nombre y la inicial del apellido. Puedes cambiarlo en Ajustes.', 'Vorname und der erste Buchstabe des Nachnamens passen gut. Du kannst ihn in den Einstellungen ändern.')}</p>}
      <span className="sp" />
      <button className="pill pill-primary pill-wide pill-s" type="submit" disabled={busy}><span className="btn-t">{next.startsWith('/race') ? t('Save and race', 'Сохранить и в гонку', 'Guardar y regatear', 'Speichern und segeln') : t('Save', 'Сохранить', 'Guardar', 'Speichern')}</span></button>
    </form>
  );
}
