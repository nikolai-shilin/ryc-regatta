'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, saveOpts } from '@/lib/opts';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { IconBack, IconPlay } from './ui';

type Pick = { preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape };

// a rough guide to the race's length on the water, so a choice shows its effect
const minutes = (p: Pick) => Math.round(({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * (p.course === 'tri' ? 1.3 : 1)) + p.start);

// S1 · Free race set-up: only the race. Start saves the choice where the game reads it and opens the race.
export default function FreeSetup({ lang, fromToday }: { lang: Lang; fromToday: boolean }) {
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' });
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    setP(fromToday ? { preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course }
      : { preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: o.course === 'tri' ? 'tri' : 'wl' });
  }, [fromToday]);
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => setP((x) => ({ ...x, [k]: v }));
  const go = () => { saveOpts({ ...p, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };

  const tags = <K extends keyof Pick>(k: K, opts: [Pick[K], string][]) => (
    <div className="segc" role="radiogroup">
      {opts.map(([v, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className={p[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{label}</button>
      ))}
    </div>
  );
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course);
  const courseName = { short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[p.length];

  return (
    <div className="scr" lang={lang}>
      <div className="lay page">
        <div className="lhead">
          <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
          <h1 className="h-land-s">{t('Set up your race', 'Настрой гонку')}</h1>
        </div>
        <div className="setup-grid">
          <div className="opts">
            <span className="meta">{t('Wind, kn', 'Ветер, уз')}</span>
            {tags('preset', [['light', t('Light 7', 'Слабый 7')], ['medium', t('Medium 12', 'Средний 12')], ['strong', t('Strong 19', 'Сильный 19')]])}
            <span className="meta">{t('Boats', 'Лодок')}</span>
            {tags('fleet', [[3, '3'], [5, '5'], [7, '7']])}
            <span className="meta">{t('Shape', 'Форма')}</span>
            {tags('course', [['wl', t('Up and down', 'Апвинд — даунвинд')], ['tri', t('Triangle', 'Треугольник')]])}
            {p.course === 'tri' && <p className="hint ohint">{t('Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там фордевинд и бакштаг обратно.')}</p>}
            <span className="meta">{t('Course', 'Дистанция')}</span>
            {tags('length', [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]])}
            <span className="meta">{t('Laps', 'Круги')}</span>
            {tags('laps', [[1, '1'], [2, '2']])}
            <span className="meta">{t('Start', 'Старт')}</span>
            {tags('start', [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
            <span className="meta">{t('Current', 'Течение')}</span>
            {tags('current', [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]])}
            <p className="hint ohint">{t('On: a tide sets every boat across the course.', 'Вкл: течение сносит все лодки поперёк дистанции.')}</p>
          </div>
          <div className="band setup-panel">
            <div className="lhead"><span className="kicker">{t('Your course', 'Твоя дистанция')}</span><span className="sp" /><span className="meta">{p.course === 'tri' ? `${t('Triangle', 'Треугольник')} · ` : ''}{courseName} · {p.laps} {t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг')} · {fmtDistance(courseDistance(geo, p.laps), lang).split(' · ')[0]}</span></div>
            <CourseMap className="cmap" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
            <span className="sp" />
            {/* upright on a phone this row stays pinned to the bottom of the screen, so Start is always in reach */}
            <div className="setup-go">
              <div className="setup-time">
                <span className="h-land-s">≈ {minutes(p)} {t('min', 'мин')}</span>
                <span className="meta">{t(`${p.fleet} boats · ${p.start}-min start`, `${p.fleet} лодок · старт ${p.start} мин`)}</span>
              </div>
              <button type="button" className="pill pill-primary pill-wide pill-s" onClick={go}><IconPlay /><span className="btn-t">{t('Start race', 'Начать гонку')}</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
