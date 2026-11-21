'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { tx, type Lang } from '@/lib/lang';
import { track } from '@/lib/track';
import { IconCheck, IconGoogle } from './ui';
import '@/styles/first-finish.css';

// A friend who raced a 1-on-1 signed out, on its result page (components/result-view.tsx): keep the race, the first race's
// way (components/first-finish.tsx): "Only on this device", "Keep your win over Alex" (or "Keep this race"), what an
// account gives, Google as the one action and a code by email beside it, back to this page. Signed in, the page keeps it:
// POST /connect/claim once with the token her screen sent as she joined (the record keeps it: match-ui.js markDuel), and
// the race joins her history, never the rating. Nothing for a race that isn't a guest's.
const KEPT = 'regatta-kept-';

export function DuelKeep({ lang, id, duel, signed, won, rival }: { lang: Lang; id: string; duel: { code: string; seed: number; token: string }; signed: boolean; won: boolean; rival: string }) {
  const [kept, setKept] = useState<'no' | 'yes' | 'busy'>('no');
  useEffect(() => {
    const k = KEPT + duel.code + '-' + duel.seed;
    let done = false;
    try { done = localStorage.getItem(k) === '1'; } catch {}
    if (done) { setKept('yes'); return; }
    if (!signed) return;
    setKept('busy');
    fetch('/connect/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(duel) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.kept) { try { localStorage.setItem(k, '1'); } catch {} track('Duel kept', {}); } setKept(j?.kept ? 'yes' : 'no'); }, () => setKept('no'));
  }, [signed, duel]);
  return <DuelKeepView lang={lang} id={id} signed={signed} kept={kept} won={won} rival={rival} />;
}

export function DuelKeepView({ lang, id, signed, kept, won, rival }: { lang: Lang; id: string; signed: boolean; kept: 'no' | 'yes' | 'busy'; won: boolean; rival: string }) {
  const t = tx(lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (kept === 'yes') return <p className="bt-hint rs-hint">{t('Kept: this race is in your 1-on-1 history. It was sailed signed out, so it doesn’t count for the rating.', 'Сохранено: гонка в твоей истории 1 на 1. Она прошла без аккаунта, поэтому в рейтинг не идёт.', 'Guardada: esta regata está en tu historial 1 contra 1. Se navegó sin sesión, así que no cuenta para el rating.', 'Gespeichert: Diese Regatta steht in deiner 1-gegen-1-Geschichte. Sie wurde ohne Anmeldung gesegelt und zählt daher nicht für die Wertung.', 'Saklandı: bu yarış bire bir geçmişinde. Giriş yapmadan yarışıldığı için reytinge sayılmaz.', 'Gardée : cette régate est dans ton historique de duels. Courue sans être connecté, elle ne compte pas pour le classement.', 'Salvata: questa regata è nella tua cronologia 1 contro 1. È stata corsa senza accesso, quindi non conta per il rating.', 'Guardada: esta regata está no seu histórico 1 contra 1. Foi corrida sem conta, então não conta para o rating.')}</p>;
  if (signed) return null; // (keeping it: a moment; or the race was someone else's to keep)
  const next = `/race/result/${encodeURIComponent(id)}`;
  const google = async () => {
    setBusy(true); setErr('');
    track('Duel keep sign-in', { via: 'google' });
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) { setBusy(false); setErr(t('Google sign-in isn’t available right now.', 'Вход через Google сейчас недоступен.', 'El inicio de sesión con Google no está disponible ahora mismo.', 'Die Anmeldung mit Google ist gerade nicht verfügbar.', 'Google ile giriş şu an kullanılamıyor.', 'La connexion avec Google n’est pas disponible pour le moment.', 'L’accesso con Google non è disponibile al momento.', 'O login com o Google não está disponível agora.')); }
  };
  const head = won
    ? t(`Keep your win over ${rival}`, `Сохрани победу над ${rival}`, `Guarda tu victoria sobre ${rival}`, `Behalte deinen Sieg über ${rival}`, `${rival} karşısındaki galibiyetini sakla`, `Garde ta victoire sur ${rival}`, `Conserva la tua vittoria su ${rival}`, `Guarde sua vitória sobre ${rival}`)
    : t('Keep this race', 'Сохрани эту гонку', 'Guarda esta regata', 'Behalte diese Regatta', 'Bu yarışı sakla', 'Garde cette régate', 'Conserva questa regata', 'Guarde esta regata');
  const why = [
    t(`Your races with ${rival}, and who leads`, `Твои гонки с ${rival} и кто впереди`, `Tus regatas con ${rival} y quién va delante`, `Deine Regatten mit ${rival} und wer vorn liegt`, `${rival} ile yarışların ve kimin önde olduğu`, `Tes régates avec ${rival}, et qui mène`, `Le tue regate con ${rival} e chi è in vantaggio`, `Suas regatas com ${rival} e quem está na frente`),
    t('A 1-on-1 rating from your next race', 'Рейтинг 1 на 1 со следующей гонки', 'Un rating 1 contra 1 desde tu próxima regata', 'Eine 1-gegen-1-Wertung ab deiner nächsten Regatta', 'Bir sonraki yarışından itibaren bire bir reyting', 'Un classement en duel dès ta prochaine régate', 'Un rating 1 contro 1 dalla prossima regata', 'Um rating 1 contra 1 a partir da próxima regata'),
    t('Your races and your boat on any device', 'Твои гонки и лодка на любом устройстве', 'Tus regatas y tu barco en cualquier dispositivo', 'Deine Regatten und dein Boot auf jedem Gerät', 'Yarışların ve teknen her cihazda', 'Tes régates et ton bateau sur tous tes appareils', 'Le tue regate e la tua barca su qualsiasi dispositivo', 'Suas regatas e seu barco em qualquer aparelho'),
  ];
  return (
    <section className="ff" aria-labelledby="dk-h">
      <span className="ff-k">{t('Only on this device', 'Только на этом устройстве', 'Solo en este dispositivo', 'Nur auf diesem Gerät', 'Sadece bu cihazda', 'Seulement sur cet appareil', 'Solo su questo dispositivo', 'Só neste aparelho')}</span>
      <h2 className="ff-h" id="dk-h">{head}</h2>
      <p className="ff-p">{t('Sign in and it’s yours: in your history, and the next race counts.', 'Войди — и она твоя: в истории, а следующая гонка пойдёт в рейтинг.', 'Inicia sesión y es tuya: en tu historial, y la próxima regata cuenta.', 'Melde dich an, und sie gehört dir: in deiner Geschichte, und die nächste Regatta zählt.', 'Giriş yap, senin olsun: geçmişinde, ve bir sonraki yarış sayılır.', 'Connecte-toi et elle est à toi : dans ton historique, et la prochaine régate compte.', 'Accedi ed è tua: nella tua cronologia, e la prossima regata conta.', 'Entre e ela é sua: no seu histórico, e a próxima regata conta.')}</p>
      <ul className="ff-why">{why.map((w) => <li key={w}><IconCheck s={18} /><span>{w}</span></li>)}</ul>
      <div className="ff-b">
        <button type="button" className="ff-go" onClick={google} disabled={busy}><IconGoogle s={20} /><span>{t('Continue with Google', 'Войти через Google', 'Continuar con Google', 'Weiter mit Google', 'Google ile devam et', 'Continuer avec Google', 'Continua con Google', 'Continuar com o Google')}</span></button>
        <Link className="ff-alt" href={`/sign-in?next=${encodeURIComponent(next)}`} onClick={() => track('Duel keep sign-in', { via: 'email' })}>{t('Email me a code', 'Код на почту', 'Envíame un código', 'Code per E-Mail', 'Bana kod gönder', 'Recevoir un code par e-mail', 'Inviami un codice via email', 'Me envie um código por e-mail')}</Link>
      </div>
      <p className="ff-note">{t('Free · no password · ten seconds', 'Бесплатно · без пароля · десять секунд', 'Gratis · sin contraseña · diez segundos', 'Kostenlos · ohne Passwort · zehn Sekunden', 'Ücretsiz · şifresiz · on saniye', 'Gratuit · sans mot de passe · dix secondes', 'Gratis · nessuna password · dieci secondi', 'Grátis · sem senha · dez segundos')}</p>
      {err && <p className="ff-err" role="alert">{err}</p>}
    </section>
  );
}
