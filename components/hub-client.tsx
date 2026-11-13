'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, readPb } from '@/lib/opts';
import { IconArrow, IconLock, IconWind, clock } from './ui';

// Today's conditions as chips; tapping one says why they are fixed (S2) and offers the same race as a free race.
export function TodayChips({ lang, chips, day }: { lang: Lang; chips: string[]; day: string }) {
  const t = tx(lang);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  return (
    <>
      <div className="chip-tags" style={{ gap: 6 }}>
        {chips.map((c, i) => (
          <button key={i} type="button" className="chip chip-s" onClick={() => setOpen(true)} style={{ border: 0 }}>
            {i === 0 && <IconWind />}{c}
          </button>
        ))}
      </div>
      {open && (
        <div className="dlg-wrap" lang={lang}>
          <div className="scr" style={{ position: 'absolute', inset: 0, background: 'transparent' }}>
            <div className="lay">
              <div className="scrim" onClick={() => setOpen(false)} />
              <div className="lsheet" role="dialog" aria-modal="true" aria-labelledby="lock-h">
                <div className="grip" />
                <div className="lhead">
                  <span className="kicker">{t('Today’s race', 'Гонка дня')} · {day}</span>
                  <span className="sp" />
                  <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconLock />{t('Fixed', 'Закреплена')}</span>
                </div>
                <h2 id="lock-h" className="h-land-s">{t('Everyone sails the same race today', 'Сегодня у всех одна и та же гонка')}</h2>
                <p className="lead" style={{ color: 'var(--muted)' }}>{t('The wind, the boats and the course are the same for everyone, so times compare fairly. Change them and it becomes a free race: that time won’t count for today’s ranking.', 'Ветер, лодки и дистанция одинаковые для всех, поэтому время сравнивается честно. Измени их — и это станет свободной гонкой: время не попадёт в рейтинг дня.')}</p>
                <div className="btn-pair">
                  <button type="button" className="pill pill-primary pill-s" onClick={() => setOpen(false)}><span className="btn-t">{t('Keep today’s race', 'Остаться в гонке дня')}</span></button>
                  <Link className="pill pill-s" href="/race/free?from=today"><span className="btn-t">{t('Make it a free race', 'Свободная гонка')}</span><IconArrow /></Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Your best time in today's race on this device (the game keeps it), shown on the ranking's last row.
export function MyToday({ lang, day, name }: { lang: Lang; day: string; name: string }) {
  const t = tx(lang);
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => { setBest(readPb()[`daily|${day}`] ?? null); }, [day]);
  return (
    <li className="me">
      <span className="n">·</span>
      <span>{name ? `${name} (${t('you', 'ты')})` : t('You', 'Ты')}</span>
      <span>{best != null ? clock(best) : t('not yet', 'ещё нет')}</span>
    </li>
  );
}

// The free-race card: what the player chose last time.
export function LastFree({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const o = readOpts();
    if (!o.lastFree) return;
    const w = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[o.preset];
    setTxt(t(`Last time: ${w}, ${o.fleet} boats, ${o.laps} ${o.laps > 1 ? 'laps' : 'lap'}.`, `В прошлый раз: ${w}, ${o.fleet} лодок, ${o.laps} ${o.laps > 1 ? 'круга' : 'круг'}.`));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="small" style={{ color: 'var(--muted)' }}>{t('Your wind, fleet and course.', 'Свой ветер, флот и дистанция.')}{txt ? ` ${txt}` : ''}</span>;
}
