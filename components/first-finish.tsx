'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tx, type Lang } from '@/lib/lang';
import { track } from '@/lib/track';
import { IconGoogle } from './ui';
import { PushButton } from './home-back';
import '@/styles/first-finish.css';

// The result of a newcomer's first race (the game's easy one, public/game/main.js FIRST: its record says first), signed out: keep it.
// An account is what brings a player back (2026-11-19: 41% of the players with one raced again on another day, 2% of
// guests), so here, while the result is fresh, Google or a code by email, back to this page; and the daily reminder,
// where the browser takes one (components/home-back.tsx PushButton). Nothing for someone signed in, and ResultView
// mounts it only for this device's own first race (not a shared one).
export function FirstFinish({ lang, id, signed }: { lang: Lang; id: string; signed: boolean }) {
  const t = tx(lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (signed) return null;
  const next = `/race/result/${encodeURIComponent(id)}`;
  const google = async () => {
    setBusy(true); setErr('');
    track('First finish sign-in', { via: 'google' });
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) { setBusy(false); setErr(t('Google sign-in isn’t available right now.', 'Вход через Google сейчас недоступен.', 'El inicio de sesión con Google no está disponible ahora mismo.', 'Die Anmeldung mit Google ist gerade nicht verfügbar.', 'Google ile giriş şu an kullanılamıyor.')); }
  };
  return (
    <section className="ff" aria-labelledby="ff-h">
      <div className="ff-t">
        <h2 className="ff-h" id="ff-h">{t('Keep this result', 'Сохрани результат', 'Guarda este resultado', 'Behalte dieses Ergebnis', 'Bu sonucu sakla')}</h2>
        <p className="ff-p">{t('Sign in and your races, your boat and your place on today’s ranking go with you to any device.', 'Войди — и твои гонки, лодка и место в рейтинге дня будут с тобой на любом устройстве.', 'Inicia sesión y tus regatas, tu barco y tu puesto en la clasificación del día te acompañan en cualquier dispositivo.', 'Melde dich an, und deine Regatten, dein Boot und dein Platz in der Tageswertung sind auf jedem Gerät dabei.', 'Giriş yap; yarışların, teknen ve günün sıralamasındaki yerin her cihazda seninle olsun.')}</p>
      </div>
      <div className="ff-b">
        <button type="button" className="ff-go" onClick={google} disabled={busy}><IconGoogle s={18} /><span>Google</span></button>
        <Link className="ff-alt" href={`/sign-in?next=${encodeURIComponent(next)}`} onClick={() => track('First finish sign-in', { via: 'email' })}>{t('Email me a code', 'Код на почту', 'Envíame un código', 'Code per E-Mail', 'Bana kod gönder')}</Link>
      </div>
      {err && <p className="ff-err" role="alert">{err}</p>}
      <div className="ff-push"><PushButton lang={lang} where="first-finish" /></div>
      <a className="ff-more" href="/play?race=first">{t('Race the Optimist again', 'Ещё раз на «Оптимисте»', 'Otra vez en Optimist', 'Nochmal im Optimist', 'Optimist ile tekrar')}</a>
    </section>
  );
}
