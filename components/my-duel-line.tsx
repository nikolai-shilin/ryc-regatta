'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALE, tx, type Lang } from '@/lib/lang';
import { levelName } from '@/lib/levels';
import { provisional, shown, PROVISIONAL } from '@/lib/elo';
import { parseMine, type MyRating } from '@/lib/duel-rating';

// Where you stand in the 1-on-1 rating, one line over its board on the ratings' page (app/[lang]/rating/page.tsx): your
// rating, your level (or how many of your first five are done), your record and your place; from GET /connect/rating/me.
// Nothing for a sailor not signed in: the board is everyone's.
export function MyDuelLine({ lang }: { lang: Lang }) {
  const [mine, setMine] = useState<MyRating | null>(null);
  useEffect(() => {
    let on = true;
    fetch('/connect/rating/me', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setMine(parseMine(j)); }, () => {});
    return () => { on = false; };
  }, []);
  if (!mine) return null;
  const t = tx(lang), num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const where = provisional(mine.races)
    ? t(`race ${mine.races} of ${PROVISIONAL}`, `гонка ${mine.races} из ${PROVISIONAL}`, `regata ${mine.races} de ${PROVISIONAL}`, `Regatta ${mine.races} von ${PROVISIONAL}`, `${PROVISIONAL} yarışın ${mine.races}.`, `régate ${mine.races} sur ${PROVISIONAL}`, `regata ${mine.races} di ${PROVISIONAL}`, `regata ${mine.races} de ${PROVISIONAL}`)
    : mine.place ? t(`#${num(mine.place)} of ${num(mine.of)}`, `${num(mine.place)}-е из ${num(mine.of)}`, `#${num(mine.place)} de ${num(mine.of)}`, `Platz ${num(mine.place)} von ${num(mine.of)}`, `${num(mine.of)} içinde ${num(mine.place)}.`, `${num(mine.place)}e sur ${num(mine.of)}`, `${num(mine.place)}º su ${num(mine.of)}`, `${num(mine.place)}º de ${num(mine.of)}`) : '';
  return (
    <Link className="rtg-you" href="/duel/rating">
      <span className="lbl">{t('You', 'Ты', 'Tú', 'Du', 'Sen', 'Toi', 'Tu', 'Você')}</span>
      <b>{shown(mine.rating, mine.races)}</b>
      <span>{[provisional(mine.races) ? null : levelName(mine.rating, lang), `${mine.wins}–${mine.losses}`, where].filter(Boolean).join(' · ')}</span>
      <span className="rtg-more">{t('Race by race', 'По гонкам', 'Regata a regata', 'Regatta für Regatta', 'Yarış yarış', 'Régate par régate', 'Regata per regata', 'Regata a regata')} ›</span>
    </Link>
  );
}
