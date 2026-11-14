'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, readPb, saveOpts } from '@/lib/opts';
import type { VenueId } from '@/lib/venues';
import { venueOf, VENUES } from '@/lib/venues';
import { courseDistance, dailyRace, fmtDistance, plannedCourse, KN, type Length, type Shape, type Wind } from '@/lib/race';
import { CourseMap } from './course-map';
import { IconBack, IconPin, IconPlay, IconWind, IconBoats, IconRoute, IconLaps, IconFlag, IconTide, clock } from './ui';

type Pick = { venue: VenueId; preset: Wind; fleet: number; length: Length; laps: number; start: number; current: number; course: Shape };

// a rough guide to the race's length on the water, so a choice shows its effect
const minutes = (p: Pick) => Math.round(({ short: 4.5, medium: 7, long: 9.5 }[p.length] * p.laps * { light: 1.25, medium: 1, strong: 0.9 }[p.preset] * (p.course === 'tri' ? 1.3 : 1)) + p.start);

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
      : { venue, preset: o.preset, fleet: o.fleet, length: o.length, laps: o.laps, start: o.start, current: o.current, course: o.course === 'tri' ? 'tri' : 'wl' });
    setReady(true);
  }, [fromToday]);
  const set = <K extends keyof Pick>(k: K, v: Pick[K]) => setP((x) => ({ ...x, [k]: v }));
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
  const best = pb[`${p.preset}|${p.laps}|${p.length}|${p.fleet}${p.course === 'tri' ? '|tri' : ''}`];
  const geo = plannedCourse(p.preset, p.length, p.fleet, p.course);
  const where = venueOf(p.venue);
  const courseName = { short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[p.length];
  const metres = fmtDistance(courseDistance(geo, p.laps), lang).split(' · ')[0];
  const card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  // upright the places run in one row that scrolls sideways: the chosen one in view
  useEffect(() => {
    const row = card.current?.querySelector('.bt-row1'), on = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - (row as HTMLElement).offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scr bt-scr" lang={lang}>
      <div className="bt">
        {ready && <Scene venue={p.venue} wind={p.preset} card={card} info={info} title={t('The race’s venue in 3D', 'Место гонки в 3D')} />}

        <div className="bt-info" ref={info}>
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
          {tags('course', <IconRoute />, t('Shape', 'Форма'), [['wl', t('Up and down', 'Апвинд — даунвинд')], ['tri', t('Triangle', 'Треугольник')]],
            p.course === 'tri' && <p className="bt-hint">{t('Up to the windward mark, a tight reach out to the wing mark, a gybe there and a broad reach back.', 'Вверх к верхнему знаку, галфвинд к боковому знаку, там фордевинд и бакштаг обратно.')}</p>)}
          {tags('length', <IconRoute />, t('Course', 'Дистанция'), [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]])}
          {tags('laps', <IconLaps />, t('Laps', 'Круги'), [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]])}
          {tags('start', <IconFlag />, t('Start', 'Старт'), [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]])}
          {tags('current', <IconTide />, t('Current', 'Течение'), [[0, t('Off', 'Выкл')], [1, t('On', 'Вкл')]],
            <p className="bt-hint">{t('On: a tide sets every boat across the course.', 'Вкл: течение сносит все лодки поперёк дистанции.')}</p>)}
          <div className="bt-g">
            <span className="bt-k"><IconRoute />{t('Your course', 'Твоя дистанция')}<span className="bt-k-r">{p.course === 'tri' ? `${t('Triangle', 'Треугольник')} · ` : ''}{courseName} · {p.laps} {t(p.laps > 1 ? 'laps' : 'lap', p.laps > 1 ? 'круга' : 'круг')} · {metres}</span></span>
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

// The scene behind the set-up: the game at the venue (public/boat-view). Another venue is a new page, loaded beside the
// one showing and faded in over it once its first frame is up; a venue picked while one loads takes its place. Each
// is told the wind as it changes, and what the card and the heading cover, so the boat stands in the part left clear.
function Scene({ venue, wind, card, info, title }: { venue: VenueId; wind: Wind; card: React.RefObject<HTMLElement | null>; info: React.RefObject<HTMLDivElement | null>; title: string }) {
  const [frames, setFrames] = useState<{ id: number; venue: VenueId; wind: Wind; live: boolean }[]>(() => [{ id: 0, venue, wind, live: false }]);
  const refs = useRef(new Map<number, HTMLIFrameElement>());
  const windNow = useRef(wind); windNow.current = wind;
  const post = (msg: object, id?: number) => refs.current.forEach((f, k) => { if (id == null || id === k) f.contentWindow?.postMessage(msg, location.origin); });
  const inset = (id?: number) => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? (H - st.top) / H * 0.5 : 0 }, id);
  };
  // a new venue: a new page beside the one showing (or in place of one still loading)
  useEffect(() => {
    setFrames((fs) => {
      const top = fs[fs.length - 1];
      if (top.venue === venue) return fs;
      const next = { id: top.id + 1, venue, wind: windNow.current, live: false };
      return top.live ? [...fs.filter((f) => f.live), next] : [...fs.filter((f) => f !== top), next];
    });
  }, [venue]);
  useEffect(() => { post({ type: 'wind', preset: wind }); }, [wind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const id = [...refs.current].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (id == null) return;
      if (e.data?.type === 'ready') { inset(id); post({ type: 'wind', preset: windNow.current }, id); }
      if (e.data?.type === 'live') {
        setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, live: true } : f)));
        setTimeout(() => setFrames((fs) => fs.filter((f) => f.id >= id)), 900); // the one under it, once faded over
      }
    };
    addEventListener('message', on);
    const ro = new ResizeObserver(() => inset());
    if (card.current) ro.observe(card.current);
    if (info.current) ro.observe(info.current);
    addEventListener('resize', () => inset());
    return () => { removeEventListener('message', on); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{frames.map((f) => (
    <iframe key={f.id} ref={(el) => { if (el) refs.current.set(f.id, el); else refs.current.delete(f.id); }} className={`bt-scene bt-fade ${f.live ? 'on' : ''}`}
      src={`/boat-view?venue=${f.venue}&wind=${f.wind}`} title={title} onLoad={() => post({ type: 'hello' }, f.id)} />
  ))}</>;
}
