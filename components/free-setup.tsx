'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { DAYTIMES, readOpts, readPb, saveOpts, type Daytime } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { shapeOffered, venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, pbKey, plannedCourse, savedShape, KN, SHAPE_NAME, SHAPES, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { GameScene, type SceneSetup } from './game-scene';
import { PauseCard, SettingsRow, type Who } from './pause-card';
import { IconBack, IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, IconSail, IconSun, Num, clock } from './ui';

// the way round each shape but up and down, under its choice
const SHAPE_HINT: Partial<Record<Shape, [string, string]>> = {
  tri: ['Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там фордевинд и бакштаг обратно.'],
  trap: ['Up to mark 1, a broad reach out to mark 2, a run down to the gate, and a beam reach home to a finish line of its own.', 'Вверх к знаку 1, бакштаг к знаку 2, фордевинд к воротам и галфвинд к своей финишной линии.'],
  wlu: ['Up to the windward mark, a short reach to the offset mark, a run down through the gate, and a last beat up to a finish line below the windward mark.', 'Вверх к верхнему знаку, короткий галфвинд к знаку смещения, фордевинд через ворота и последняя лавировка к финишу чуть ниже верхнего знака.'],
};

type Pick = { venue: VenueId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape; daytime: Daytime };

// a rough guide to the race's length on the water, so a choice shows its effect; each shape's factor is as the computer
// boats take it, against up and down
const SHAPE_TIME: Record<Shape, number> = { wl: 1, tri: 1.3, trap: 1.25, wlu: 1.6 };
const minutes = (p: Pick) => Math.round(({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * SHAPE_TIME[p.course]) + p.start);
// what the scene shows as each choice is made: the fleet, the wind or the current over the course, or the course
type View = SceneSetup['view'];
const VIEW_OF: Record<keyof Pick, View> = { venue: 'boats', fleet: 'boats', start: 'boats', preset: 'wind', current: 'current', course: 'course', length: 'course', laps: 'course', daytime: 'boats' };
// the breeze as the game blows it (sim.js PRESETS): its gusts' top and how far it swings either way
const GUST: Record<Wind, [number, number]> = { light: [9, 12], medium: [16, 13], strong: [26, 14] };

// S1 · Free race set-up, as the boat page: the game's own scene at the chosen venue behind it all (your yacht afloat there
// on a clear evening, /boat-view), the race's place and numbers over it as the pause screen has them, and the choices
// in the pause menu's dark glass card. Picking another place loads that venue's scene and fades it in over the last.
// The scene is the race as it will be laid, all its boats afloat together; each choice flies the drone to where it shows
// (the wind or the current over the course, the course itself), and Show course does too. Start and Show course stay at
// the card's top, your boat and Settings at its bottom. Start saves the choice where the game reads it and opens the race.
export default function FreeSetup({ lang, fromToday, who }: { lang: Lang; fromToday: boolean; who: Who }) {
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ venue: 'gocek', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', daytime: 'any' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    const venue = venueOf(o.venue).id, daytime = DAYTIMES.includes(o.daytime) ? o.daytime : 'any';
    setP(fromToday ? { venue, preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course, daytime }
      : { venue, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: savedShape(o.course), daytime });
    setReady(true);
  }, [fromToday]);
  const [view, setView] = useState<View>('boats');
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => { setP((x) => ({ ...x, [k]: v })); setView(VIEW_OF[k]); };
  // the shapes this venue has room for at this length; one it hasn't goes back to up and down (the drone stays put)
  const shapes = SHAPES.filter((s) => shapeOffered(p.venue, s, p.length));
  useEffect(() => { if (!shapeOffered(p.venue, p.course, p.length)) setP((x) => ({ ...x, course: 'wl' })); }, [p.venue, p.course, p.length]);
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
  const shapeName = t(...SHAPE_NAME[p.course]);
  const lapsName = `${p.laps} ${t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг')}`;
  const beat = Math.round(Math.abs(geo.windward[1]));
  const scene: SceneSetup = {
    race: { preset: p.preset, fleet: p.fleet, length: p.length, laps: p.laps, course: p.course, current: p.current, start: p.start, daytime: p.daytime },
    view,
    // the marks' names (on a trapezoid the windward mark is mark 1), and the start line's: the finish too, unless the
    // shape has a finish line of its own
    labels: { windward: p.course === 'trap' ? t('Mark 1', 'Знак 1') : t('Windward mark', 'Верхний знак'), gate: t('Gate', 'Ворота'), wing: t('Wing mark', 'Боковой знак'),
      mark2: t('Mark 2', 'Знак 2'), offset: t('Offset mark', 'Знак смещения'), finish: t('Finish', 'Финиш'),
      line: geo.finish ? t('Start', 'Старт') : t('Start · Finish', 'Старт · Финиш'), beat: t(`Beat ${beat} m`, `Лавировка ${beat} м`) },
  };
  // a word on what the scene shows, when it shows more than the boats
  const cap: Record<Exclude<View, 'boats'>, [string, string]> = {
    wind: [t(`Wind · ${KN[p.preset]} kn`, `Ветер · ${KN[p.preset]} уз`),
      t(`The streaks run with the breeze down the course. The gold ones are gusts, up to ${GUST[p.preset][0]} kn; the wind swings up to ${GUST[p.preset][1]}° either way.`,
        `Штрихи бегут с ветром вниз по дистанции. Золотые — порывы, до ${GUST[p.preset][0]} уз; ветер гуляет до ${GUST[p.preset][1]}° в каждую сторону.`)],
    current: p.current
      ? [t('Current · 0.6 kn', 'Течение · 0,6 уз'), t('The tide sets every boat across the course, harder on one side, and builds and eases as you race.', 'Течение сносит все лодки поперёк дистанции, с одного края сильнее, и то крепчает, то слабеет по ходу гонки.')]
      : [t('No current', 'Без течения'), t('The water stands still. Switch the current on to see the tide run over the course.', 'Вода стоит. Включи течение — и увидишь, как оно идёт по дистанции.')],
    course: [`${shapeName} · ${lapsName} · ${metres}`, {
      wl: `${t('From the start up to the windward mark and down to the gate', 'От старта вверх к верхнему знаку и вниз к воротам')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.') : t(', then down to the finish.', ', потом вниз на финиш.')}`,
      tri: `${t('From the start up to the windward mark, a reach out to the wing mark and back down to the gate', 'От старта вверх к верхнему знаку, галфвинд к боковому знаку и вниз к воротам')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.') : t(', then down to the finish.', ', потом вниз на финиш.')}`,
      trap: `${t('From the start up to mark 1, a reach out to mark 2 and down to the gate', 'От старта вверх к знаку 1, бакштаг к знаку 2 и вниз к воротам')}${p.laps > 1
        ? t(', then back up to mark 2 and down again; lap 1 in gold, lap 2 in blue. Last, a reach across to the finish line.', ', потом снова вверх к знаку 2 и вниз; первый круг золотой, второй синий. В конце — галфвинд к финишной линии.')
        : t(', then a reach across to the finish line.', ', потом галфвинд к финишной линии.')}`,
      wlu: `${t('From the start up to the windward mark, out to the offset mark and down to the gate', 'От старта вверх к верхнему знаку, к знаку смещения и вниз к воротам')}${p.laps > 1
        ? t(', then round again; lap 1 in gold, lap 2 in blue. Last, a beat up to the finish line below the windward mark.', ', потом ещё круг; первый круг золотой, второй синий. В конце — лавировка к финишу чуть ниже верхнего знака.')
        : t(', then a beat up to the finish line below the windward mark.', ', потом лавировка к финишу чуть ниже верхнего знака.')}`,
    }[p.course]],
  };
  // upright the places run in one row that scrolls sideways: the chosen one in view
  useEffect(() => {
    const row = document.querySelector('.bt-card .bt-row1'), on = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - (row as HTMLElement).offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        {ready && <GameScene venue={p.venue} wind={p.preset} setup={scene} title={t('The race’s venue in 3D', 'Место гонки в 3D')} />}

        <div className="bt-info">
          <div className="bt-top">
            <Link className="bt-back" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <span className="bt-kick">{t('Free race', 'Свободная гонка')}</span>
          </div>
          <h1 className="bt-h" id="fs-title">{t(...where.name)}</h1>
          <p className="bt-p">{t(...where.place)} · {t(`prevailing wind ${where.wind[0]}`, `преобладающий ветер ${where.wind[1]}`)}. {t(...where.about)}</p>
          {view !== 'boats' && (
            <div className="bt-cap" role="status">
              <span className="bt-cap-t"><b>{cap[view][0]}</b><span>{cap[view][1]}</span></span>
              <button type="button" className="bt-cap-x" onClick={() => setView('boats')} aria-label={t('Back to the boats', 'Назад к лодкам')}>×</button>
            </div>
          )}
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Wind', 'Ветер')}</span><b><Num v={`${KN[p.preset]} ${t('kn', 'уз')}`} /></b></div>
            <div><span className="bt-sk">{t('Course', 'Дистанция')}</span><b><Num v={metres} /></b></div>
            <div><span className="bt-sk">{t('About', 'Около')}</span><b><Num v={`${minutes(p)} ${t('min', 'мин')}`} /></b></div>
            <div><span className="bt-sk">{t('Your best', 'Рекорд')}</span><b>{best != null ? clock(best) : '—'}</b></div>
          </div>
        </div>

        <PauseCard lang={lang} who={who} back={fromToday ? '/race/free?from=today' : '/race/free'} label={t('Set up your race', 'Настрой гонку')}
          head={<>
            <button type="button" className="bt-go" onClick={go}><IconPlay /><span>{t('Start race', 'Начать гонку')}</span></button>
            <button type="button" className="bt-show" aria-pressed={view === 'course'} onClick={() => setView(view === 'course' ? 'boats' : 'course')}>
              {view === 'course' ? <IconBoats s={15} /> : <IconRoute s={15} />}<span>{view === 'course' ? t('Boats', 'Лодки') : t('Show course', 'Дистанция')}</span>
            </button>
          </>}
          foot={<div className="bt-rows">
            <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your boat', 'Твоя яхта')}</span></Link>
            <SettingsRow lang={lang} />
          </div>}>
          {tags('venue', <IconPin />, t('Where', 'Где'), VENUES.map((v) => [v.id, t(...v.name)] as [VenueId, string]))}
          {tags('preset', <IconWind s={14} />, t('Wind', 'Ветер'), [['light', t('Light 7 kn', 'Слабый 7 уз')], ['medium', t('Medium 12 kn', 'Средний 12 уз')], ['strong', t('Strong 19 kn', 'Сильный 19 уз')]])}
          {tags('daytime', <IconSun />, t('Time of day', 'Время суток'), [['any', t('Any', 'Любое')], ['morning', t('Morning', 'Утро')], ['midday', t('Midday', 'Полдень')], ['afternoon', t('Afternoon', 'День')], ['evening', t('Evening', 'Вечер')]],
            <p className="bt-hint">{{
              any: t('A new hour every race, now and then under a grey sky.', 'Каждая гонка в новый час, иногда под серым небом.'),
              morning: t('Early, the sun low in the east and the air still fresh.', 'Рано: солнце низко на востоке, воздух ещё свежий.'),
              midday: t('The sun at its highest, the sea at its bluest.', 'Солнце в зените, море самое синее.'),
              afternoon: t('The sun past its highest, swinging west.', 'Солнце уже за зенитом, уходит на запад.'),
              evening: t('Golden light, the sun an hour above the horizon.', 'Золотой свет, солнце за час до заката.'),
            }[p.daytime]}</p>)}
          {tags('fleet', <IconBoats />, t('Boats', 'Лодки'), [[3, t('3 boats', '3 лодки')], [5, t('5 boats', '5 лодок')], [7, t('7 boats', '7 лодок')]])}
          {tags('course', <IconRoute />, t('Shape', 'Форма'), shapes.map((s) => [s, t(...SHAPE_NAME[s])] as [Shape, string]),
            SHAPE_HINT[p.course] && <p className="bt-hint">{t(...SHAPE_HINT[p.course]!)}</p>)}
          {tags('length', <IconRoute />, t('Course', 'Дистанция'), [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]])}
          {tags('laps', <IconLaps />, t('Laps', 'Круги'), [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]])}
          {tags('start', <IconFlag />, t('Start', 'Старт'), [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
          {tags('current', <IconTide />, t('Current', 'Течение'), [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]],
            <p className="bt-hint">{t('On: a tide sets every boat across the course.', 'Вкл: течение сносит все лодки поперёк дистанции.')}</p>)}
          <div className="bt-g">
            <span className="bt-k"><IconRoute />{t('Your course', 'Твоя дистанция')}<span className="bt-k-r">{p.course !== 'wl' ? `${shapeName} · ` : ''}{courseName} · {lapsName} · {metres}</span></span>
            <CourseMap className="cmap bt-map" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
          </div>
          <p className="bt-saved bt-saved-l">{best != null
            ? t(`Your best on this course: ${clock(best)}. Beat it and the result page says so.`, `Твой лучший результат на этой дистанции: ${clock(best)}. Побьёшь — страница результата скажет.`)
            : t('The game keeps your best time on every course. A free race doesn’t go on today’s ranking.', 'Игра помнит лучшее время на каждой дистанции. Свободная гонка в рейтинг дня не идёт.')}</p>
        </PauseCard>
      </div>
    </div>
  );
}
