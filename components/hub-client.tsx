'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, saveOpts } from '@/lib/opts';
import { KN, type Wind } from '@/lib/race';
import { IconArrow, IconLock, IconWind } from './ui';

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
      <div className="chip-tags">
        <button type="button" className="chip chip-s" onClick={() => setOpen(true)}>
          <IconWind />{chips.join(' · ')}<IconLock />
        </button>
      </div>
      {open && (
        <div className="dlg-wrap" lang={lang}>
          <div className="scr dlg-scr">
            <div className="lay">
              <div className="scrim" onClick={() => setOpen(false)} />
              <div className="lsheet" role="dialog" aria-modal="true" aria-labelledby="lock-h">
                <div className="grip" />
                <div className="lhead">
                  <span className="kicker">{t('Today’s race', 'Гонка дня')} · {day}</span>
                  <span className="sp" />
                  <span className="meta ico-t"><IconLock />{t('Fixed', 'Закреплена')}</span>
                </div>
                <h2 id="lock-h" className="h-land-s">{t('Everyone sails the same race today', 'Сегодня у всех одна и та же гонка')}</h2>
                <p className="lead muted">{t('The wind, the boats and the course are the same for everyone, so times compare fairly. Change them and it becomes a free race: that time won’t count for today’s ranking.', 'Ветер, лодки и дистанция одинаковые для всех, поэтому время сравнивается честно. Измени их — и это станет свободной гонкой: время не попадёт в рейтинг дня.')}</p>
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

// The free-race card: one tap starts a free race in that wind, with the fleet, course and start you chose last time;
// More options opens the full set-up.
export function FreeCard({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [last, setLast] = useState('');
  useEffect(() => {
    const o = readOpts();
    if (!o.lastFree) return;
    const w = { light: t('light', 'слабый'), medium: t('medium', 'средний'), strong: t('strong', 'сильный') }[o.preset];
    setLast(t(`Last: ${w}, ${o.fleet} boats`, `Прошлая: ${w}, ${o.fleet} лодок`));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (preset: Wind) => { saveOpts({ preset, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };
  const winds: [Wind, string][] = [['light', t('Light', 'Слабый')], ['medium', t('Medium', 'Средний')], ['strong', t('Strong', 'Сильный')]];
  return (
    <div className="band free-card">
      <div className="lhead"><span className="kicker">{t('Free race', 'Свободная гонка')}</span><span className="sp" />{last && <span className="meta">{last}</span>}</div>
      <h2 className="hm-h3">{t('Or race in a wind you pick', 'Или гоняйся в свой ветер')}</h2>
      <div className="qtags" role="group" aria-label={t('Start a free race in this wind', 'Начать свободную гонку в этот ветер')}>
        {winds.map(([w, label]) => (
          <button key={w} type="button" className="qtag" onClick={() => go(w)}>{label} {KN[w]}</button>
        ))}
      </div>
      <Link className="hm-src" href="/race/free">{t('More options', 'Все настройки')}<IconArrow s={14} /></Link>
    </div>
  );
}
