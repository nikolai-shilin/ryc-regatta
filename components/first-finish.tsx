'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tx, type Lang } from '@/lib/lang';
import { track } from '@/lib/track';
import { IconCheck, IconGoogle } from './ui';
import { PushButton } from './home-back';
import '@/styles/first-finish.css';

// The result of a newcomer's first race (the game's easy one, public/game/main.js FIRST: its record says first), signed out: keep it,
// the page's one ask, right under the result's numbers: the place she sailed to, hers to save, what an account gives,
// Google as the one action (a code by email beside it), free and without a password.
// An account is what brings a player back (2026-11-19: 41% of the players with one raced again on another day, 2% of
// guests), so here, while the result is fresh, Google or a code by email, back to this page; and the daily reminder,
// where the browser takes one (components/home-back.tsx PushButton). Nothing for someone signed in, and ResultView
// mounts it only for this device's own first race (not a shared one).
export function FirstFinish({ lang, id, signed, place }: { lang: Lang; id: string; signed: boolean; place: number | null }) {
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
  // the headline: the place she sailed to, hers to keep (a race not finished: the race itself)
  const head = place
    ? t(`Save your ${ordEn(place)} place`, `Сохрани своё ${place}-е место`, `Guarda tu ${place}.º puesto`, `Sichere deinen ${place}. Platz`, `${place}. sıranı sakla`)
    : t('Keep your first race', 'Сохрани первую гонку', 'Guarda tu primera regata', 'Behalte deine erste Regatta', 'İlk yarışını sakla');
  const why = [
    t('Your races and your boat on any device', 'Твои гонки и лодка на любом устройстве', 'Tus regatas y tu barco en cualquier dispositivo', 'Deine Regatten und dein Boot auf jedem Gerät', 'Yarışların ve teknen her cihazda'),
    t('Your name on today’s leaderboard', 'Твоё имя в рейтинге дня', 'Tu nombre en la clasificación de hoy', 'Dein Name in der Tageswertung', 'Adın günün sıralamasında'),
    t('A player card: your venues, your streak', 'Карточка игрока: твои акватории и серия', 'Una ficha de jugador: tus sedes, tu racha', 'Eine Spielerkarte: deine Reviere, deine Serie', 'Oyuncu kartı: yarış alanların, serin'),
  ];
  return (
    <section className="ff" aria-labelledby="ff-h">
      <span className="ff-k">{t('Only on this device', 'Только на этом устройстве', 'Solo en este dispositivo', 'Nur auf diesem Gerät', 'Sadece bu cihazda')}</span>
      <h2 className="ff-h" id="ff-h">{head}</h2>
      <p className="ff-p">{t('Sign in and it’s yours, wherever you race next.', 'Войди — и он твой, где бы ты ни гонялся дальше.', 'Inicia sesión y es tuyo, dondequiera que navegues después.', 'Melde dich an, und es gehört dir, wo immer du als Nächstes segelst.', 'Giriş yap, bir sonraki yarışın nerede olursa olsun senin olsun.')}</p>
      <ul className="ff-why">{why.map((w) => <li key={w}><IconCheck s={18} /><span>{w}</span></li>)}</ul>
      <div className="ff-b">
        <button type="button" className="ff-go" onClick={google} disabled={busy}><IconGoogle s={20} /><span>{t('Continue with Google', 'Войти через Google', 'Continuar con Google', 'Weiter mit Google', 'Google ile devam et')}</span></button>
        <Link className="ff-alt" href={`/sign-in?next=${encodeURIComponent(next)}`} onClick={() => track('First finish sign-in', { via: 'email' })}>{t('Email me a code', 'Код на почту', 'Envíame un código', 'Code per E-Mail', 'Bana kod gönder')}</Link>
      </div>
      <p className="ff-note">{t('Free · no password · ten seconds', 'Бесплатно · без пароля · десять секунд', 'Gratis · sin contraseña · diez segundos', 'Kostenlos · ohne Passwort · zehn Sekunden', 'Ücretsiz · şifresiz · on saniye')}</p>
      {err && <p className="ff-err" role="alert">{err}</p>}
      <div className="ff-push"><PushButton lang={lang} where="first-finish" /></div>
      <a className="ff-more" href="/play?race=first">{t('Race the Optimist again', 'Ещё раз на «Оптимисте»', 'Otra vez en Optimist', 'Nochmal im Optimist', 'Optimist ile tekrar')}</a>
    </section>
  );
}
// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st
const ordEn = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
