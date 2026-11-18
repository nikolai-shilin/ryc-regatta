'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { BADGES } from '@/lib/badges';
import { BadgePennant } from './badge-pennant';
import { IconPin, IconTrophy } from './ui';

// What a passport says, wherever it comes from: a player's races on the scores API (the venues, with how many at each),
// your own log on this device (the streak and the badges too), or a shared link. streak and badges null: not known, as
// on another player's card, where the scores API keeps neither.
export type PassportFacts = {
  raced: Set<string>; n: number; counts?: Record<string, number>;
  streak?: { n: number; risk?: boolean } | null;
  badges?: { got: Set<string>; n: number } | null;
};

// the venues shown before "all of them": four rows of two
const SHOWN = 8;

// The passport in the player card (components/players-view.tsx): the streak and the badges in two cells, a tick a venue
// in the venues' order, the venues raced with the most raced first (the rest a tap away), and the badges as pennants.
export function PassportBlock({ lang, facts, mine, share }: { lang: Lang; facts: PassportFacts; mine: boolean; share?: ReactNode }) {
  const t = tx(lang), [all, setAll] = useState(false);
  const { raced, n, counts, streak, badges } = facts, of = VENUES.length;
  const name = (v: (typeof VENUES)[number]) => t(...v.name);
  const races = (x: number) => (lang === 'ru' ? `${x} ${ruPlural(x, ['гонка', 'гонки', 'гонок'])}` : `${x} race${x === 1 ? '' : 's'}`);
  const been = VENUES.filter((v) => raced.has(v.id)).sort((a, b) => (counts?.[b.id] ?? 0) - (counts?.[a.id] ?? 0));
  const rows = all ? [...been, ...VENUES.filter((v) => !raced.has(v.id))] : been.slice(0, SHOWN);
  const days = streak ? (streak.n ? t(`${streak.n} ${streak.n === 1 ? 'day' : 'days'}`, `${streak.n} ${ruPlural(streak.n, ['день', 'дня', 'дней'])}`) : '–') : '';
  return (<>
    {streak || badges ? (
      <div className="fl-stats pl-pass-st">
        {streak ? <div><span className="bt-sk">{t('Streak', 'Серия')}</span><b>{days}</b></div> : null}
        {badges ? <div><span className="bt-sk">{t('Badges', 'Достижения')}</span><b>{t(`${badges.n} of ${BADGES.length}`, `${badges.n} из ${BADGES.length}`)}</b></div> : null}
        {streak?.risk ? <span className="bt-sv pl-risk">{t('Race today to keep your streak', 'Пройди гонку сегодня, чтобы не прервать серию')}</span> : null}
      </div>
    ) : null}
    <div className="bt-g pl-pass">
      <div className="pl-k"><span className="bt-k"><IconPin s={14} />{t('Venues raced', 'Пройденные акватории')}</span><span className="bt-k-r">{t(`${n} of ${of}`, `${n} из ${of}`)}</span></div>
      <div className="pl-ticks" aria-hidden="true">{VENUES.map((v) => <i key={v.id} className={raced.has(v.id) ? 'on' : undefined} />)}</div>
      {rows.length ? (
        <ul className="pl-vn">
          {rows.map((v) => {
            const on = raced.has(v.id), c = counts?.[v.id];
            return (
              <li key={v.id} className={on ? 'on' : undefined} title={on && c ? `${name(v)}: ${races(c)}` : name(v)}>
                <span className="pl-vn-t">{name(v)}</span>
                {on && c ? <span className="pl-vn-n">{c}</span> : null}
                {on ? null : <span className="pl-sr">{t(' (not raced yet)', ' (ещё не пройдена)')}</span>}
              </li>
            );
          })}
        </ul>
      ) : n ? null : <p className="bt-hint">{mine ? t('Finish a race and its venue is stamped here.', 'Финишируй в гонке, и её акватория появится здесь.') : t('No venue raced yet.', 'Пока ни одной акватории.')}</p>}
      <button type="button" className="bt-mini pl-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? t('Show fewer', 'Свернуть') : t(`All ${of} venues`, `Все ${of} акватории`)}</button>
    </div>

    {badges && (badges.got.size > 0 || mine) ? (
      <div className="bt-g">
        <div className="pl-k"><span className="bt-k"><IconTrophy s={14} />{t('Badges', 'Достижения')}</span><span className="bt-k-r">{t(`${badges.n} of ${BADGES.length}`, `${badges.n} из ${BADGES.length}`)}</span></div>
        <ul className="pl-bdg">
          {BADGES.map((b) => {
            const on = badges.got.has(b.id), label = `${t(...b.name)}${on ? '' : t(' (not yet)', ' (ещё нет)')}`;
            return <li key={b.id} title={label}><Link href="/race/badges" aria-label={label}><BadgePennant id={b.id} on={on} /></Link></li>;
          })}
        </ul>
      </div>
    ) : null}
    {share ? <div className="pl-share">{share}</div> : null}
  </>);
}
