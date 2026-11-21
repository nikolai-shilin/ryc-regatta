'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
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
  const label = name
    ? t(`Race ${name}`, `Гонка с ${name}`, `Regatea con ${name}`, `Gegen ${name} segeln`, `${name} ile yarış`, `Affronter ${name}`, `Sfida ${name}`, `Correr contra ${name}`)
    : t('Join the race', 'Войти в гонку', 'Unirse a la regata', 'An der Regatta teilnehmen', 'Yarışa katıl', 'Rejoindre la régate', 'Entra in regata', 'Entrar na regata');
  return (
    <>
      {who}
      <a className="bt-go" href={href}><IconPlay /><span>{label}</span></a>
      <p className="iv-note">{t('No account needed: race now, and sign in after it to keep the race.', 'Аккаунт не нужен: гоняйся сейчас, а войди после гонки, чтобы её сохранить.', 'No necesitas cuenta: regatea ya y, después, inicia sesión para guardar la regata.', 'Kein Konto nötig: jetzt segeln und danach anmelden, um die Regatta zu behalten.', 'Hesap gerekmez: şimdi yarış, yarışı saklamak için sonra giriş yap.', 'Pas besoin de compte : régate maintenant, et connecte-toi après pour garder la régate.', 'Non serve un account: regata ora e accedi dopo per conservarla.', 'Não precisa de conta: corra agora e entre depois para guardar a regata.')}</p>
    </>
  );
}
