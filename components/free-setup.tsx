'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, readPb, saveOpts } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { shapeOffered, venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, pbKey, plannedCourse, savedShape, KN, SHAPE_NAME, SHAPES, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { GameScene } from './game-scene';
import { IconBack, IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, clock } from './ui';

// the way round each shape but up and down, under its choice
const SHAPE_HINT: Partial<Record<Shape, [string, string]>> = {
  tri: ['Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там фордевинд и бакштаг обратно.'],
  trap: ['Up to mark 1, a broad reach out to mark 2, a run down to the gate, and a beam reach home to a finish line of its own.', 'Вверх к знаку 1, бакштаг к знаку 2, фордевинд к воротам и галфвинд к своей финишной линии.'],
  wlu: ['Up to the windward mark, a short reach to the offset mark, a run down through the gate, and a last beat up to a finish line below the windward mark.', 'Вверх к верхнему знаку, короткий галфвинд к знаку смещения, фордевинд через ворота и последняя лавировка к финишу чуть ниже верхнего знака.'],
};

type Pick = { venue: VenueId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape };

// a rough guide to the race's length on the water, so a choice shows its effect; each shape's factor is as the computer
// boats take it, against up and down
const SHAPE_TIME: Record<Shape, number> = { wl: 1, tri: 1.3, trap: 1.25, wlu: 1.6 };
const minutes = (p: Pick) => Math.round(({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * SHAPE_TIME[p.course]) + p.start);

// S1 · Free race set-up, as the boat page: the game's own scene at the chosen venue behind it all (your yacht afloat there
// on a clear evening, /boat-view), the race's place and numbers over it as the pause screen has them, and the choices
// in the pause menu's dark glass card. Picking another place loads that venue's scene and fades it in over the last;
// the wind changes the breeze in the scene as it is. Start saves the choice where the game reads it and opens the race.
export default function FreeSetup({ lang, fromToday }: { lang: Lang; fromToday: boolean }) {
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ venue: 'gocek', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    const venue = venueOf(o.venue).id;
    setP(fromToday ? { venue, preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course }
      : { venue, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: savedShape(o.course) });
    setReady(true);
  }, [fromToday]);
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => setP((x) => ({ ...x, [k]: v }));
  // the shapes this venue has room for at this length; one it hasn't goes back to up and down
  const shapes = SHAPES.filter((s) => shapeOffered(p.venue, s, p.length));
  useEffect(() => { if (!shapeOffered(p.venue, p.course, p.length)) set('course', 'wl'); }, [p.venue, p.course, p.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = () => { saveOpts({ ...p, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free'; };

  // one choice as the pause menu's quick switches: a label, then pills with a light that's on
  const tags = <K extends keyof Pick>(k: K, ico: React.ReactNode, label: string, opts: [Pick[K], string][], hint?: React.ReactNode) => (
    <div className="bt-g">
      <span className="bt-k" id={`fs-${k}`}>{ico}{label}</span>
      <div className={`bt-pills ${k === 'venue' ? 'bt-row1' : ''}`} role="radiogroup" aria-labelledby={`fs-${k}`}>
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className="bt-pill" onClick={() => set(k, v)}>{l}</button>
        ))}
      </div>
      {hint}
    </div>
  );
  const [pb, setPb] = useState<Record<string, number>>({});
  useEffect(() => { setPb(readPb()); }, []);
  const best = pb[pbKey(p)];
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course);
  const where = venueOf(p.venue);
  const courseName = { short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[p.length];
  const metres = fmtDistance(courseDistance(geo, p.laps), lang).split(' · ')[0];
  const card = useRef<HTMLElement>(null);
  // upright the places run in one row that scrolls sideways: the chosen one in view
  useEffect(() => {
    const row = card.current?.querySelector('.bt-row1'), on = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - (row as HTMLElement).offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scr bt-scr" lang={lang}>
      <div className="bt">
        {ready && <GameScene venue={p.venue} wind={p.preset} title={t('The race’s venue in 3D', 'Место гонки в 3D')} />}

        <div className="bt-info">
          <div className="bt-top">
            <Link className="bt-back" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <span className="bt-kick">{t('Free race', 'Свободная гонка')}</span>
          </div>
          <h1 className="bt-h" id="fs-title">{t(...where.name)}</h1>
          <p className="bt-p">{t(...where.place)} · {t(`prevailing wind ${where.wind[0]}`, `преобладающий ветер ${where.wind[1]}`)}. {t(...where.about)}</p>
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Wind', 'Ветер')}</span><b>{KN[p.preset]} {t('kn', 'уз')}</b></div>
            <div><span className="bt-sk">{t('Course', 'Дистанция')}</span><b>{metres}</b></div>
            <div><span className="bt-sk">{t('About', 'Около')}</span><b>{minutes(p)} {t('min', 'мин')}</b></div>
            <div><span className="bt-sk">{t('Your best', 'Рекорд')}</span><b>{best != null ? clock(best) : '—'}</b></div>
          </div>
        </div>

        <section className="bt-card" ref={card} aria-labelledby="fs-title">
          <button type="button" className="bt-go" onClick={go}><IconPlay /><span>{t('Start race', 'Начать гонку')}</span></button>
          {tags('venue', <IconPin />, t('Where', 'Где'), VENUES.map((v) => [v.id, t(...v.name)] as [VenueId, string]))}
          {tags('preset', <IconWind s={14} />, t('Wind', 'Ветер'), [['light', t('Light 7 kn', 'Слабый 7 уз')], ['medium', t('Medium 12 kn', 'Средний 12 уз')], ['strong', t('Strong 19 kn', 'Сильный 19 уз')]])}
          {tags('fleet', <IconBoats />, t('Boats', 'Лодки'), [[3, t('3 boats', '3 лодки')], [5, t('5 boats', '5 лодок')], [7, t('7 boats', '7 лодок')]])}
          {tags('course', <IconRoute />, t('Shape', 'Форма'), shapes.map((s) => [s, t(...SHAPE_NAME[s])] as [Shape, string]),
            SHAPE_HINT[p.course] && <p className="bt-hint">{t(...SHAPE_HINT[p.course]!)}</p>)}
          {tags('length', <IconRoute />, t('Course', 'Дистанция'), [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]])}
          {tags('laps', <IconLaps />, t('Laps', 'Круги'), [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]])}
          {tags('start', <IconFlag />, t('Start', 'Старт'), [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
          {tags('current', <IconTide />, t('Current', 'Течение'), [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]],
            <p className="bt-hint">{t('On: a tide sets every boat across the course.', 'Вкл: течение сносит все лодки поперёк дистанции.')}</p>)}
          <div className="bt-g">
            <span className="bt-k"><IconRoute />{t('Your course', 'Твоя дистанция')}<span className="bt-k-r">{p.course !== 'wl' ? `${t(...SHAPE_NAME[p.course])} · ` : ''}{courseName} · {p.laps} {t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг')} · {metres}</span></span>
            <CourseMap className="cmap bt-map" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
          </div>
          <p className="bt-saved bt-saved-l">{best != null
            ? t(`Your best on this course: ${clock(best)}. Beat it and the result page says so.`, `Твой лучший результат на этой дистанции: ${clock(best)}. Побьёшь — страница результата скажет.`)
            : t('The game keeps your best time on every course. A free race doesn’t go on today’s ranking.', 'Игра помнит лучшее время на каждой дистанции. Свободная гонка в рейтинг дня не идёт.')}</p>
        </section>
      </div>
    </div>
  );
}
