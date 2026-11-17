'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { DAYTIMES, readOpts, readPb, saveOpts, type Daytime } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { YACHTS, isYacht, yachtOf, type YachtId } from '@/lib/yachts';
import { lengthOffered, shapeOffered, venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, pbKey, plannedCourse, raceMinutes, savedShape, KN, SHAPE_NAME, SHAPES, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { GameScene, type SceneSetup } from './game-scene';
import { PauseCard, SettingsRow } from './pause-card';
import { BackLink } from './back-link';
import { IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, IconSail, IconSun, Num, clock } from './ui';
import { SceneBrand } from './scene-brand';
import { newCode } from '@/lib/code';
import { useLog } from './passport';

// the way round each shape but up and down, under its choice
const SHAPE_HINT: Partial<Record<Shape, [string, string]>> = {
  tri: ['Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там поворот фордевинд и бакштаг обратно.'],
  trap: ['Up to mark 1, a broad reach out to mark 2, a run down to the gate, and a beam reach home to a finish line of its own.', 'Вверх к знаку 1, бакштаг к знаку 2, фордевинд к воротам и галфвинд к своей финишной линии.'],
  wlu: ['Up to the windward mark, a short reach to the offset mark, a run down through the gate, and a last beat up to a finish line below the windward mark.', 'Вверх к верхнему знаку, короткий галфвинд к отбойнику, фордевинд через ворота и последняя лавировка к финишу чуть ниже верхнего знака.'],
};

type Pick = { venue: VenueId; yacht: YachtId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape; daytime: Daytime };

// a rough guide to the race's length on the water, so a choice shows its effect (lib/race.ts), at the yacht's own pace
const minutes = (p: Pick) => raceMinutes({ ...p, timeK: yachtOf(p.yacht).timeK });
// what the scene shows as each choice is made: the fleet, the wind or the current over the course, or the course
type View = SceneSetup['view'];
const VIEW_OF: Record<keyof Pick, View> = { venue: 'boats', yacht: 'boats', fleet: 'boats', start: 'boats', preset: 'wind', current: 'current', course: 'course', length: 'course', laps: 'course', daytime: 'boats' };
// the breeze as the game blows it (sim.js PRESETS): its gusts' top and how far it swings either way
const GUST: Record<Wind, [number, number]> = { light: [9, 12], medium: [16, 13], strong: [26, 14] };

// S1 · Free race set-up, as the boat page: the game's own scene at the chosen venue behind it all (your yacht afloat there
// on a clear evening, /boat-view), the race's place and numbers over it as the pause screen has them, and the choices
// in the pause menu's dark glass card. Picking another place loads that venue's scene and fades it in over the last.
// The scene is the race as it will be laid, all its boats afloat together; each choice flies the drone to where it shows
// (the wind or the current over the course, the course itself), and Show course does too. Start and Show course stay at
// the card's top, your boat and Settings at its bottom. Start saves the choice where the game reads it and opens the race.
// from: 'today' (today's race, as a free race), 'race' (the free race you were sailing; the game's Change the race), or none
// match: a match race's set-up (/match/new): only the venue, yacht, wind and length (short or medium, as the venue offers),
// and the button makes the match: a code, saved here as the host's, and the game opens at it.
export default function FreeSetup({ lang, from, match }: { lang: Lang; from: 'today' | 'race' | null; match?: boolean }) {
  const fromToday = from === 'today';
  const t = tx(lang);
  const [p, setP] = useState<Pick>({ venue: 'gocek', yacht: 'jpk1050', preset: 'medium', fleet: 5, length: 'short', laps: 1, start: 1, current: 0, course: 'wl', daytime: 'any' });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const o = readOpts();
    const d = dailyRace();
    const venue = venueOf(o.venue).id, daytime = DAYTIMES.includes(o.daytime) ? o.daytime : 'any';
    // a yacht asked for in the address (the yachts page's Race her), else the one last raced
    const asked = new URLSearchParams(location.search).get('yacht'), yacht = isYacht(asked) ? asked : isYacht(o.yacht) ? o.yacht : 'jpk1050';
    const start: Pick = fromToday ? { venue: d.venue, yacht: d.yacht, preset: d.preset, fleet: d.fleet, length: d.length, laps: d.laps, start: d.start, current: d.current, course: d.course, daytime }
      : { venue, yacht, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: savedShape(o.course), daytime };
    setP(start); if (from) setBase(start);
    setNear([d.venue, venue]);
    setReady(true);
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps
  // today's venue and the one you sailed last: the first of the places offered, before the rest A to Z
  const [near, setNear] = useState<VenueId[]>([]);
  const [allPlaces, setAllPlaces] = useState(false);
  // the race this page was opened from, to mark what's changed from it
  const [base, setBase] = useState<Pick | null>(null);
  const changed = base ? (Object.keys(base) as (keyof Pick)[]).filter((k) => base[k] !== p[k]) : [];
  const [view, setView] = useState<View>('boats');
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => { setP((x) => ({ ...x, [k]: v })); setView(VIEW_OF[k]); };
  // the shapes this venue has room for at this length; one it hasn't goes back to up and down (the drone stays put)
  const shapes = SHAPES.filter((s) => shapeOffered(p.venue, s, p.length));
  useEffect(() => { if (!shapeOffered(p.venue, p.course, p.length)) setP((x) => ({ ...x, course: 'wl' })); }, [p.venue, p.course, p.length]);
  // and the lengths it has room for: one it hasn't goes down to the longest it has
  useEffect(() => { if (!lengthOffered(p.venue, p.length)) setP((x) => ({ ...x, length: lengthOffered(x.venue, 'medium') ? 'medium' : 'short' })); }, [p.venue, p.length]);
  // a match is never long: the longest length goes down to medium (or short, where the venue has no room for medium)
  useEffect(() => { if (match && p.length === 'long') setP((x) => ({ ...x, length: lengthOffered(x.venue, 'medium') ? 'medium' : 'short' })); }, [match, p.length, p.venue]);
  const go = () => {
    if (match) {
      const code = newCode();
      try {
        localStorage.setItem('regatta-match-host', JSON.stringify({ code }));
        localStorage.setItem('regatta-match-settings', JSON.stringify({ venue: p.venue, yacht: p.yacht, preset: p.preset, length: p.length }));
      } catch { /* storage blocked: the game still opens at the code */ }
      location.href = `/play?match=${code}&venue=${p.venue}&boat=${p.yacht}`;
      return;
    }
    saveOpts({ ...p, mode: 'free', lastFree: Date.now() }); location.href = '/play?race=free';
  };

  // a blue dot on a choice changed from the race this page was opened from
  const chg = (k: keyof Pick) => changed.includes(k) ? <i className="bt-chg" title={t('Changed', 'Изменено')}><span className="vh">{t('changed', 'изменено')}</span></i> : null;
  // one choice as the pause menu's quick switches: a label, then pills with a light that's on
  const tags = <K extends keyof Pick>(k: K, ico: React.ReactNode, label: string, opts: [Pick[K], string][], hint?: React.ReactNode) => (
    <div className="bt-g">
      <span className="bt-k" id={`fs-${k}`}>{ico}{label}{chg(k)}</span>
      <div className="bt-pills" role="radiogroup" aria-labelledby={`fs-${k}`}>
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className="bt-pill" onClick={() => set(k, v)}>{l}</button>
        ))}
      </div>
      {hint}
    </div>
  );
  const log = useLog();
  const [pb, setPb] = useState<Record<string, number>>({});
  useEffect(() => { setPb(readPb()); }, []);
  const best = pb[pbKey(p)];
  const boat = yachtOf(p.yacht);
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course, boat);
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
      mark2: t('Mark 2', 'Знак 2'), offset: t('Offset mark', 'Отбойник'), finish: t('Finish', 'Финиш'),
      line: geo.finish ? t('Start', 'Старт') : t('Start · Finish', 'Старт · Финиш'), beat: t(`Beat ${beat} m`, `Лавировка ${beat} м`) },
  };
  // a word on what the scene shows, when it shows more than the boats
  const cap: Record<Exclude<View, 'boats'>, [string, string]> = {
    wind: [t(`Wind · ${KN[p.preset]} kn`, `Ветер · ${KN[p.preset]} уз`),
      t(`The streaks run with the breeze down the course. The gold ones are gusts, up to ${GUST[p.preset][0]} kn; the wind swings up to ${GUST[p.preset][1]}° either way.`,
        `Штрихи бегут с ветром вниз по дистанции. Золотые — порывы, до ${GUST[p.preset][0]} уз; ветер гуляет до ${GUST[p.preset][1]}° в каждую сторону.`)],
    current: p.current
      ? [t('Current · the venue’s own', 'Течение · местное'), t('The water runs as it does there: the tide along the channel, a river downstream, or, where the sea has no tide, the wind’s light drift. Harder in places, and it builds and eases as you race.', 'Вода идёт так, как там на самом деле: приливное течение вдоль пролива, река вниз по течению, а где прилива нет — лёгкий дрейф по ветру. Где-то сильнее, и то крепчает, то слабеет по ходу гонки.')]
      : [t('No current', 'Без течения'), t('The water stands still. Switch the current on to see the tide run over the course.', 'Вода стоит. Включи течение — и увидишь, как оно идёт по дистанции.')],
    course: [`${shapeName} · ${lapsName} · ${metres}`, {
      wl: `${t('From the start up to the windward mark and down to the gate', 'От старта вверх к верхнему знаку и вниз к воротам')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.') : t(', then down to the finish.', ', потом вниз на финиш.')}`,
      tri: `${t('From the start up to the windward mark, a reach out to the wing mark and back down to the gate', 'От старта вверх к верхнему знаку, галфвинд к боковому знаку и вниз к воротам')}${p.laps > 1 ? t(', then round again; lap 1 in gold, lap 2 in blue.', ', потом ещё круг; первый круг золотой, второй синий.') : t(', then down to the finish.', ', потом вниз на финиш.')}`,
      trap: `${t('From the start up to mark 1, a reach out to mark 2 and down to the gate', 'От старта вверх к знаку 1, бакштаг к знаку 2 и вниз к воротам')}${p.laps > 1
        ? t(', then back up to mark 2 and down again; lap 1 in gold, lap 2 in blue. Last, a reach across to the finish line.', ', потом снова вверх к знаку 2 и вниз; первый круг золотой, второй синий. В конце — галфвинд к финишной линии.')
        : t(', then a reach across to the finish line.', ', потом галфвинд к финишной линии.')}`,
      wlu: `${t('From the start up to the windward mark, out to the offset mark and down to the gate', 'От старта вверх к верхнему знаку, к отбойнику и вниз к воротам')}${p.laps > 1
        ? t(', then round again; lap 1 in gold, lap 2 in blue. Last, a beat up to the finish line below the windward mark.', ', потом ещё круг; первый круг золотой, второй синий. В конце — лавировка к финишу чуть ниже верхнего знака.')
        : t(', then a beat up to the finish line below the windward mark.', ', потом лавировка к финишу чуть ниже верхнего знака.')}`,
    }[p.course]],
  };
  // the places: four to pick from (today's, your last, then the first A to Z; the one chosen always among them), and
  // All opens every one, by name in the page's language (VENUES' own order is today's race's rotation, so it stays)
  const byName = VENUES.map((v) => [v.id, t(...v.name)] as [VenueId, string]).sort((a, b) => a[1].localeCompare(b[1], lang));
  const four = [...new Set([...near, ...byName.map(([id]) => id)])].slice(0, 4);
  if (!four.includes(p.venue)) four[3] = p.venue;
  const places = allPlaces ? byName : four.map((id) => byName.find(([v]) => v === id)!);

  return (
    <div className="scr bt-scr bc fs-scr" lang={lang}>
      <div className="bt">
        {ready && <GameScene venue={p.venue} boat={p.yacht} wind={p.preset} setup={scene} title={t('The race’s venue in 3D', 'Место гонки в 3D')} loading={t('Loading the venue', 'Загружаем место гонки')} />}

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
            <SceneBrand />
          </div>
          <span className="bt-kick bt-kick-w">{match ? t('Match race', 'Матчевая гонка') : from === 'race' ? t('Change the race', 'Изменить гонку') : t('Free race', 'Свободная гонка')}</span>
          <h1 className="bt-h" id="fs-title">{t(...where.name)} <span className="bt-h-cc">{where.nation}</span></h1>
          <p className="bt-p">{t(...where.place)} · {t(`prevailing wind ${where.wind[0]}`, `преобладающий ветер ${where.wind[1]}`)}. {t(...where.about)}</p>
          {view !== 'boats' && (
            <div className="bt-cap" role="status">
              <span className="bt-cap-t"><b>{cap[view][0]}</b><span>{cap[view][1]}</span></span>
              <button type="button" className="bt-cap-x" onClick={() => setView('boats')} aria-label={t('Back to the boats', 'Назад к лодкам')}>×</button>
            </div>
          )}
          <div className="bt-stats">
            <div><span className="bt-sk">{t('Beat', 'Лавировка')}</span><b><Num v={`${beat} ${t('m', 'м')}`} /></b></div>
            <div><span className="bt-sk">{t('About', 'Около')}</span><b><Num v={`${minutes(p)} ${t('min', 'мин')}`} /></b></div>
            {/* a match is one on one, best of three: a free race's best time says nothing of it */}
            {match
              ? <div><span className="bt-sk">{t('Match', 'Матч')}</span><b>{t('Best of 3', 'До 2 побед')}</b></div>
              : <div><span className="bt-sk">{t('Your best', 'Рекорд')}</span><b className={best != null ? 'is-gold' : ''}>{best != null ? clock(best) : '—'}</b></div>}
          </div>
        </div>

        <PauseCard lang={lang} back={match ? '/match/new' : fromToday ? '/race/free?from=today' : '/race/free'} label={match ? t('Set up your match', 'Настрой матч') : t('Set up your race', 'Настрой гонку')}
          head={<>
            <button type="button" className="bt-go" onClick={go}><IconPlay /><span>{match ? t('Create the match', 'Создать матч') : from === 'race' ? t('Restart with these', 'Заново с этими') : t('Start race', 'Начать гонку')}</span></button>
            <button type="button" className="bt-show" aria-pressed={view === 'course'} onClick={() => setView(view === 'course' ? 'boats' : 'course')}>
              {view === 'course' ? <IconBoats s={15} /> : <IconRoute s={15} />}<span>{view === 'course' ? t('Boats', 'Лодки') : t('Show course', 'Дистанция')}</span>
            </button>
          </>}
          foot={<div className="bt-rows">
            <Link className="bt-row" href="/boat"><IconSail s={18} /><span>{t('Your boat', 'Твоя яхта')}</span></Link>
            <Link className="bt-row" href={`/yachts?y=${p.yacht}&from=free`}><IconBoats s={18} /><span>{t('The yachts', 'Яхты')}</span></Link>
            <SettingsRow lang={lang} />
          </div>}>
          <div className="bt-g">
            <span className="bt-k" id="fs-venue"><IconPin />{t('Where', 'Где')}{chg('venue')}</span>
            <div className={`fs-where${allPlaces ? '' : ' fs-one'}`}>
              <div className="bt-pills" id="fs-places" role="radiogroup" aria-labelledby="fs-venue">
                {places.map(([v, l]) => {
                  // the venues you've raced (today's race or a free one) carry a tick, as the passport stamps them
                  const done = !!log?.v[v];
                  return (
                    <button key={v} type="button" role="radio" aria-checked={p.venue === v} className={`bt-pill${done ? ' is-raced' : ''}`} title={done ? t('You’ve raced here', 'Ты здесь уже гонялся') : undefined} onClick={() => { set('venue', v); setAllPlaces(false); }}>
                      {l}{done ? <span className="vh">{t(' · raced', ' · пройдено')}</span> : null}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="bt-pill fs-all" aria-expanded={allPlaces} aria-controls="fs-places" onClick={() => setAllPlaces(!allPlaces)}>
                {t(`All ${VENUES.length}`, `Все ${VENUES.length}`)}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            </div>
          </div>
          {tags('yacht', <IconSail s={14} />, t('Yacht', 'Яхта'), YACHTS.map((y) => [y.id, t(...y.name)] as [YachtId, string]),
            <p className="bt-hint">{t(...boat.tagline)} <Link href={`/yachts?y=${boat.id}&from=free`}>{t('About the yachts', 'О яхтах')}</Link></p>)}
          {tags('preset', <IconWind s={14} />, t('Wind', 'Ветер'), [['light', t('Light 7 kn', 'Слабый 7 уз')], ['medium', t('Medium 12 kn', 'Средний 12 уз')], ['strong', t('Strong 19 kn', 'Сильный 19 уз')]])}
          {!match && tags('daytime', <IconSun />, t('Time of day', 'Время суток'), [['any', t('Any', 'Любое')], ['morning', t('Morning', 'Утро')], ['midday', t('Midday', 'Полдень')], ['afternoon', t('Afternoon', 'День')], ['evening', t('Evening', 'Вечер')], ['sunset', t('Sunset', 'Закат')]],
            <p className="bt-hint">{{
              any: t('A new hour every race, now and then under a grey sky.', 'Каждая гонка в новый час, иногда под серым небом.'),
              morning: t('Early, the sun low in the east and the air still fresh.', 'Рано: солнце низко на востоке, воздух ещё свежий.'),
              midday: t('The sun at its highest, the sea at its bluest.', 'Солнце в зените, море самое синее.'),
              afternoon: t('The sun past its highest, swinging west.', 'Солнце уже за зенитом, уходит на запад.'),
              evening: t('Golden light, the sun an hour above the horizon.', 'Золотой свет, солнце за час до заката.'),
              sunset: t('The sun on the horizon, the sky and the sea gone orange.', 'Солнце у горизонта, небо и море в оранжевом.'),
            }[p.daytime]}</p>)}
          {!match && tags('course', <IconRoute />, t('Shape', 'Форма'), shapes.map((s) => [s, t(...SHAPE_NAME[s])] as [Shape, string]),
            SHAPE_HINT[p.course] && <p className="bt-hint">{t(...SHAPE_HINT[p.course]!)}</p>)}
          {/* the race's size, two to a row on a wide screen */}
          <div className="fs-grid">
            {tags('length', <IconRoute />, t('Course', 'Дистанция'), ([['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]] as [Length, string][]).filter(([l]) => lengthOffered(p.venue, l) && !(match && l === 'long')))}
            {!match && tags('fleet', <IconBoats />, t('Boats', 'Лодки'), [[3, t('3 boats', '3 лодки')], [5, t('5 boats', '5 лодок')], [7, t('7 boats', '7 лодок')]])}
            {!match && tags('laps', <IconLaps />, t('Laps', 'Круги'), [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]])}
            {!match && tags('start', <IconFlag />, t('Start', 'Старт'), [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
            {!match && tags('current', <IconTide />, t('Current', 'Течение'), [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]],
              <p className="bt-hint">{t('On: the venue’s tide, river or drift sets every boat.', 'Вкл: местное приливное течение, река или дрейф сносит все лодки.')}</p>)}
          </div>
          <div className="bt-g fs-course-in">
            <span className="bt-k"><IconRoute />{t('Your course', 'Твоя дистанция')}<span className="bt-k-r">{p.course !== 'wl' ? `${shapeName} · ` : ''}{courseName} · {lapsName} · {metres}</span></span>
            <CourseMap className="cmap bt-map" lang={lang} geo={geo} preset={p.preset} W={250} H={210} route fleet={p.fleet} />
          </div>
          {base && changed.length ? <p className="bt-what" role="status"><b>{t('What happens', 'Что будет')}</b> {from === 'today' ? t(`A free race with ${changed.length} ${changed.length === 1 ? 'change' : 'changes'} from today’s. It doesn’t go on today’s ranking.`, `Свободная гонка, изменений по сравнению с гонкой дня: ${changed.length}. В рейтинг дня она не идёт.`) : t(`The race starts over, with ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}.`, `Гонка начнётся заново, изменений: ${changed.length}.`)}</p> : null}
          {match ? <p className="bt-saved bt-saved-l">{t('You and a friend, one on one. After you create the match you get a link to send.', 'Вы и друг, один на один. Когда создашь матч, получишь ссылку, чтобы отправить.')}</p> : <p className="bt-saved bt-saved-l">{best != null
            ? t(`Your best in this wind, fleet and course, at any venue: ${clock(best)}. Beat it and the result page says so.`, `Твой лучший результат при этом ветре, флоте и дистанции, на любой акватории: ${clock(best)}. Побьёшь — страница результата скажет.`)
            : t('The game keeps your best time on every course. A free race doesn’t go on today’s ranking.', 'Игра помнит лучшее время на каждой дистанции. Свободная гонка в рейтинг дня не идёт.')}</p>}
        </PauseCard>
      </div>
    </div>
  );
}
