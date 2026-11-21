'use client';
import { useEffect, useState } from 'react';
import { pick, tx, type Lang } from '@/lib/lang';
import { SHAPE_NAME } from '@/lib/race';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { levelName } from '@/lib/levels';
import { provisional, shown } from '@/lib/elo';
import { parseInvite, type Invite } from '@/lib/duel-invite';
import { IconPlay } from './ui';
import '@/styles/duel-rating.css';

// The invite page's ask (app/[lang]/match/[code]/page.tsx): who is asking, their level and rating, about how long the race
// takes, and one button that names them ("Race Alex"). Read in the browser from GET /connect/invite, as the page is built
// once per language for the CDN. A friend signed out races at once, just for fun, and can keep the race by signing in after
// it (components/duel-keep.tsx). Until the answer comes, or with none (a link made before invites were kept), the page's
// own button, "Join the race".
export function InviteJoin({ code, href, lang }: { code: string; href: string; lang: Lang }) {
  const [inv, setInv] = useState<Invite | null>(null);
  useEffect(() => {
    let on = true;
    fetch(`/connect/invite?code=${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setInv(parseInvite(j)); }, () => {});
    return () => { on = false; };
  }, [code]);
  return <InviteJoinView inv={inv} href={href} lang={lang} />;
}

export function InviteJoinView({ inv, href, lang }: { inv: Invite | null; href: string; lang: Lang }) {
  const t = tx(lang), name = inv?.name;
  const prov = inv ? provisional(inv.races) : true;
  const who = inv && name ? (
    <p className="iv-who">
      <b>{name}</b>
      <span className="dr-lvl">{prov ? t('New to 1-on-1', 'Новичок в 1 на 1', 'Nuevo en 1 contra 1', 'Neu im 1 gegen 1', 'Bire birde yeni', 'Nouveau en duel', 'Nuovo all’1 contro 1', 'Novo no 1 contra 1') : levelName(inv.rating, lang)}</span>
      <span className="iv-r">{shown(inv.rating, inv.races)}</span>
      {inv.minutes ? <span className="iv-m">{t(`about ${inv.minutes} min`, `около ${inv.minutes} мин`, `unos ${inv.minutes} min`, `etwa ${inv.minutes} Min.`, `yaklaşık ${inv.minutes} dk`, `environ ${inv.minutes} min`, `circa ${inv.minutes} min`, `cerca de ${inv.minutes} min`)}</span> : null}
    </p>
  ) : null;
  // the race itself: where, the yacht, the wind, the course and the laps, as the host set it
  const wind = inv?.wind ? ({ light: t('light breeze', 'слабый ветер', 'viento flojo', 'leichter Wind', 'hafif rüzgâr', 'petit vent', 'vento leggero', 'vento fraco'), medium: t('medium breeze', 'средний ветер', 'viento medio', 'mittlerer Wind', 'orta rüzgâr', 'vent moyen', 'vento medio', 'vento médio'), strong: t('strong breeze', 'сильный ветер', 'viento fuerte', 'starker Wind', 'kuvvetli rüzgâr', 'vent fort', 'vento forte', 'vento forte') } as Record<string, string>)[inv.wind] : null;
  const shape = inv?.course && inv.course in SHAPE_NAME ? pick(SHAPE_NAME[inv.course as keyof typeof SHAPE_NAME], lang) : null;
  const laps = inv?.laps ? t(`${inv.laps} ${inv.laps === 1 ? 'lap' : 'laps'}`, `${inv.laps} ${inv.laps === 1 ? 'круг' : 'круга'}`, `${inv.laps} ${inv.laps === 1 ? 'vuelta' : 'vueltas'}`, `${inv.laps} ${inv.laps === 1 ? 'Runde' : 'Runden'}`, `${inv.laps} tur`, `${inv.laps} ${inv.laps === 1 ? 'tour' : 'tours'}`, `${inv.laps} ${inv.laps === 1 ? 'giro' : 'giri'}`, `${inv.laps} ${inv.laps === 1 ? 'volta' : 'voltas'}`) : null;
  const race = inv ? [pick(VENUES.find((v) => v.id === inv.venue)?.name, lang), pick(YACHTS.find((y) => y.id === inv.yacht)?.name, lang), wind, shape, laps].filter(Boolean).join(' · ') : '';
  const label = name
    ? t(`Race ${name}`, `Гонка с ${name}`, `Regatea con ${name}`, `Gegen ${name} segeln`, `${name} ile yarış`, `Affronter ${name}`, `Sfida ${name}`, `Correr contra ${name}`)
    : t('Join the race', 'Войти в гонку', 'Unirse a la regata', 'An der Regatta teilnehmen', 'Yarışa katıl', 'Rejoindre la régate', 'Entra in regata', 'Entrar na regata');
  return (
    <>
      {who}
      {race && <p className="df-where">{race}</p>}
      <a className="bt-go" href={href}><IconPlay /><span>{label}</span></a>
      <p className="iv-note if-guest">{t('No account needed: race now, and sign in after it to keep the race.', 'Аккаунт не нужен: гоняйся сейчас, а войди после гонки, чтобы её сохранить.', 'No necesitas cuenta: regatea ya y, después, inicia sesión para guardar la regata.', 'Kein Konto nötig: jetzt segeln und danach anmelden, um die Regatta zu behalten.', 'Hesap gerekmez: şimdi yarış, yarışı saklamak için sonra giriş yap.', 'Pas besoin de compte : régate maintenant, et connecte-toi après pour garder la régate.', 'Non serve un account: regata ora e accedi dopo per conservarla.', 'Não precisa de conta: corra agora e entre depois para guardar a regata.')}</p>
      {inv && <p className="iv-note if-me">{t('You’re both signed in, so this race counts for your 1-on-1 ratings, once both screens agree on the result.', 'Вы оба вошли в аккаунт, поэтому гонка пойдёт в рейтинг 1 на 1, когда оба экрана согласятся с итогом.', 'Los dos habéis iniciado sesión, así que esta regata cuenta para vuestro rating 1 contra 1 cuando ambas pantallas coincidan en el resultado.', 'Ihr seid beide angemeldet, also zählt diese Regatta für eure 1-gegen-1-Wertung, sobald beide Bildschirme das Ergebnis bestätigen.', 'İkiniz de giriş yaptınız; iki ekran sonuçta anlaşınca bu yarış bire bir reytinginize sayılır.', 'Vous êtes connectés tous les deux : cette régate compte pour vos classements en duel, une fois que les deux écrans sont d’accord sur le résultat.', 'Avete fatto entrambi l’accesso, quindi questa regata conta per i vostri rating 1 contro 1, quando entrambi gli schermi concordano sul risultato.', 'Vocês dois estão conectados, então esta regata vale para o rating 1 contra 1 de vocês, quando as duas telas concordarem com o resultado.')}</p>}
    </>
  );
}
