'use client';
import { useState, type ReactNode } from 'react';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { IconPin } from './ui';

// What a passport says, wherever it comes from: a player's races on the scores API (the venues, with how many at each),
// your own log on this device (the streak too), or a shared link. streak null: not known, as on another player's card,
// where the scores API doesn't keep it.
export type PassportFacts = {
  raced: Set<string>; n: number; counts?: Record<string, number>;
  streak?: { n: number; risk?: boolean } | null;
};

// the venues shown before "all of them": four rows of two
const SHOWN = 8;

// The passport in the player card (components/players-view.tsx): the streak, a tick a venue in the venues' order, and
// the venues raced with the most raced first (the rest a tap away).
export function PassportBlock({ lang, facts, mine, share }: { lang: Lang; facts: PassportFacts; mine: boolean; share?: ReactNode }) {
  const t = tx(lang), [all, setAll] = useState(false);
  const { raced, n, counts, streak } = facts, of = VENUES.length;
  const name = (v: (typeof VENUES)[number]) => t(...v.name);
  const races = (x: number) => (lang === 'ru' ? `${x} ${ruPlural(x, ['гонка', 'гонки', 'гонок'])}` : lang === 'es' ? `${x} ${x === 1 ? 'regata' : 'regatas'}` : lang === 'de' ? `${x} ${x === 1 ? 'Regatta' : 'Regatten'}` : lang === 'tr' ? `${x} yarış` : `${x} race${x === 1 ? '' : 's'}`);
  const been = VENUES.filter((v) => raced.has(v.id)).sort((a, b) => (counts?.[b.id] ?? 0) - (counts?.[a.id] ?? 0));
  const rows = all ? [...been, ...VENUES.filter((v) => !raced.has(v.id))] : been.slice(0, SHOWN);
  const days = streak ? (streak.n ? t(`${streak.n} ${streak.n === 1 ? 'day' : 'days'}`, `${streak.n} ${ruPlural(streak.n, ['день', 'дня', 'дней'])}`, `${streak.n} ${streak.n === 1 ? 'día' : 'días'}`, `${streak.n} ${streak.n === 1 ? 'Tag' : 'Tage'}`, `${streak.n} gün`) : '–') : '';
  return (<>
    {streak ? (
      <div className="fl-stats pl-pass-st">
        <div><span className="bt-sk">{t('Streak', 'Серия', 'Racha', 'Serie', 'Seri')}</span><b>{days}</b></div>
        {streak.risk ? <span className="bt-sv pl-risk">{t('Race today to keep your streak', 'Пройди гонку сегодня, чтобы не прервать серию', 'Regatea hoy para mantener tu racha', 'Segle heute, um deine Serie zu halten', 'Serini korumak için bugün yarış')}</span> : null}
      </div>
    ) : null}
    <div className="bt-g pl-pass">
      <div className="pl-k"><span className="bt-k"><IconPin s={14} />{t('Venues raced', 'Пройденные акватории', 'Sedes regateadas', 'Gesegelte Reviere', 'Yarışılan yerler')}</span><span className="bt-k-r">{t(`${n} of ${of}`, `${n} из ${of}`, `${n} de ${of}`, `${n} von ${of}`, `${of} içinde ${n}`)}</span></div>
      <div className="pl-ticks" aria-hidden="true">{VENUES.map((v) => <i key={v.id} className={raced.has(v.id) ? 'on' : undefined} />)}</div>
      {rows.length ? (
        <ul className="pl-vn">
          {rows.map((v) => {
            const on = raced.has(v.id), c = counts?.[v.id];
            return (
              <li key={v.id} className={on ? 'on' : undefined} title={on && c ? `${name(v)}: ${races(c)}` : name(v)}>
                <span className="pl-vn-t">{name(v)}</span>
                {on && c ? <span className="pl-vn-n">{c}</span> : null}
                {on ? null : <span className="pl-sr">{t(' (not raced yet)', ' (ещё не пройдена)', ' (sin regatear aún)', ' (noch nicht gesegelt)', ' (henüz yarışılmadı)')}</span>}
              </li>
            );
          })}
        </ul>
      ) : n ? null : <p className="bt-hint">{mine ? t('Finish a race and its venue is stamped here.', 'Финишируй в гонке, и её акватория появится здесь.', 'Termina una regata y su sede se sella aquí.', 'Beende eine Regatta, und ihr Revier wird hier abgestempelt.', 'Bir yarışı bitir, yeri buraya damgalanır.') : t('No venue raced yet.', 'Пока ни одной акватории.', 'Aún ninguna sede regateada.', 'Noch kein Revier gesegelt.', 'Henüz yarışılan yer yok.')}</p>}
      <button type="button" className="bt-mini pl-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? t('Show fewer', 'Свернуть', 'Ver menos', 'Weniger zeigen', 'Daha az göster') : t(`All ${of} venues`, `Все ${of} ${ruPlural(of, ['акватория', 'акватории', 'акваторий'])}`, `Las ${of} sedes`, `Alle ${of} Reviere`, `${of} yerin tümü`)}</button>
    </div>
    {share ? <div className="pl-share">{share}</div> : null}
  </>);
}
