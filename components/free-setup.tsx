'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ruBoats, tx, type Lang } from '@/lib/lang';
import { readOpts, readPb, saveOpts } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { IconBack, IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, IconTrophy, clock } from './ui';

type Pick = { venue: VenueId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape };

// a rough guide to the race's length on the water, so a choice shows its effect
const minutes = (p: Pick) => Math.round(({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * (p.course === 'tri' ? 1.3 : 1)) + p.start);

// S1 · Free race set-up: only the race. Start saves the choice where the game reads it and opens the race.
export default function FreeSetup({ lang, fromToday, head }: { lang: Lang; fromToday: boolean; head?: ReactNode }) {
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ venue: 'gocek', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' });
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    const venue = venueOf(o.venue).id;
    setP(fromToday ? { venue, preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course }
      : { venue, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: o.course === 'tri' ? 'tri' : 'wl' });
  }, [fromToday]);
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => setP((x) => ({ ...x, [k]: v }));
  const go = () => { saveOpts({ ...p, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };

  // one choice as rycrentals' answer tags; today's value is marked when the set-up came from today's race
  const tags = <K extends keyof Pick>(k: K, ico: React.ReactNode, label: string, opts: [Pick[K], string][], hint?: React.ReactNode) => (
    <div className="fs-g">
      <span className="kicker fs-gk" id={`fs-${k}`}>{ico}{label}</span>
      <div className="qtags" role="radiogroup" aria-labelledby={`fs-${k}`}>
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className="qtag" onClick={() => set(k, v)}>{l}</button>
        ))}
      </div>
      {hint}
    </div>
  );
  const [pb, setPb] = useState<Record<string, number>>({});
  useEffect(() => { setPb(readPb()); }, []);
  const best = pb[`${p.preset}|${p.laps}|${p.length}|${p.fleet}${p.course === 'tri' ? '|tri' : ''}`];
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course);
  const where = venueOf(p.venue);
  const courseName = { short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[p.length];

  return (
    <div className="scr app" lang={lang}>
      {head}
      <div className="lay page fs-page">
        <div className="fs">
          <section className="fs-q" aria-labelledby="fs-title">
            <div className="aph">
              <div className="aph-top">
                <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
                <span className="kicker">{t('Free race', 'Свободная гонка')}</span>
              </div>
              <h1 className="aph-h" id="fs-title">{t('Set up your race', 'Настрой гонку')}</h1>
              <p className="aph-p">{t('Pick the place, the wind, the fleet and the course. The game keeps your best time on every course; it doesn’t go on today’s ranking.', 'Выбери место, ветер, флот и дистанцию. Игра помнит лучшее время на каждой дистанции; в рейтинг дня оно не попадает.')}</p>
            </div>
            {tags('venue', <IconPin />, t('Where', 'Где'), VENUES.map((v) => [v.id, t(...v.name)] as [VenueId, string]),
              <p className="hint">{t(...where.place)} · {t(`prevailing wind ${where.wind[0]}`, `преобладающий ветер ${where.wind[1]}`)}. {t(...where.about)}</p>)}
            {tags('preset', <IconWind s={14} />, t('Wind', 'Ветер'), [['light', t('Light 7 kn', 'Слабый 7 уз')], ['medium', t('Medium 12 kn', 'Средний 12 уз')], ['strong', t('Strong 19 kn', 'Сильный 19 уз')]])}
            {tags('fleet', <IconBoats />, t('Boats', 'Лодки'), [[3, t('3 boats', '3 лодки')], [5, t('5 boats', '5 лодок')], [7, t('7 boats', '7 лодок')]])}
            {tags('course', <IconRoute />, t('Shape', 'Форма'), [['wl', t('Up and down', 'Апвинд — даунвинд')], ['tri', t('Triangle', 'Треугольник')]],
              p.course === 'tri' && <p className="hint">{t('Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там фордевинд и бакштаг обратно.')}</p>)}
            {tags('length', <IconRoute />, t('Course', 'Дистанция'), [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]])}
            {tags('laps', <IconLaps />, t('Laps', 'Круги'), [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]])}
            {tags('start', <IconFlag />, t('Start', 'Старт'), [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
            {tags('current', <IconTide />, t('Current', 'Течение'), [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]],
              <p className="hint">{t('On: a tide sets every boat across the course.', 'Вкл: течение сносит все лодки поперёк дистанции.')}</p>)}
          </section>
          <aside className="fs-aside" aria-label={t('Your race', 'Твоя гонка')}>
            <span className="kicker fs-k">{t('Your race', 'Твоя гонка')}</span>
            <ul className="band qrows">
              <li className="qrow"><span className="meta">{t('Where', 'Где')}</span><span className="qrow-v">{t(...where.name)}, {t(...where.place)}</span></li>
              <li className="qrow"><span className="meta">{t('Wind', 'Ветер')}</span><span className="qrow-v">{{ light: t('Light 7 kn', 'Слабый 7 уз'), medium: t('Medium 12 kn', 'Средний 12 уз'), strong: t('Strong 19 kn', 'Сильный 19 уз') }[p.preset]}</span></li>
              <li className="qrow"><span className="meta">{t('Boats', 'Лодки')}</span><span className="qrow-v">{p.fleet}</span></li>
              <li className="qrow"><span className="meta">{t('Course', 'Дистанция')}</span><span className="qrow-v">{p.course === 'tri' ? t('Triangle', 'Треугольник') : t('Up and down', 'Апвинд — даунвинд')}, {courseName.toLowerCase()}</span></li>
              <li className="qrow"><span className="meta">{t('Laps', 'Круги')}</span><span className="qrow-v">{p.laps}</span></li>
              <li className="qrow"><span className="meta">{t('Start', 'Старт')}</span><span className="qrow-v">{t(`${p.start} min`, `${p.start} мин`)}{p.current ? t(' · current', ' · течение') : ''}</span></li>
            </ul>
            <div className="fs-note">
              <span className="fs-note-i"><IconTrophy /></span>
              <p>{best != null
                ? t(`Your best on this course: ${clock(best)}. Beat it and the result page says so.`, `Твой лучший результат на этой дистанции: ${clock(best)}. Побьёшь — страница результата скажет.`)
                : t('No time on this course yet. The game keeps your best on every course you sail.', 'На этой дистанции ещё нет времени. Игра помнит лучший результат на каждой дистанции.')}</p>
            </div>
            <div className="band setup-panel">
              <div className="lhead"><span className="kicker">{t('Your course', 'Твоя дистанция')}</span><span className="sp" /><span className="meta">{p.course === 'tri' ? `${t('Triangle', 'Треугольник')} · ` : ''}{courseName} · {p.laps} {t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг')} · {fmtDistance(courseDistance(geo, p.laps), lang).split(' · ')[0]}</span></div>
              <CourseMap className="cmap" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
              <span className="sp" />
              {/* upright on a phone this row stays pinned to the bottom of the screen, so Start is always in reach */}
              <div className="setup-go">
                <div className="setup-time">
                  <span className="h-land-s">≈ {minutes(p)} {t('min', 'мин')}</span>
                  <span className="meta">{t(`${p.fleet} boats · ${p.start}-min start`, `${ruBoats(p.fleet)} · старт ${p.start} мин`)}</span>
                </div>
                <button type="button" className="pill pill-primary pill-wide pill-s" onClick={go}><IconPlay /><span className="btn-t">{t('Start race', 'Начать гонку')}</span></button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
