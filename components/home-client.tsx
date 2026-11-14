'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, readPb, saveOpts } from '@/lib/opts';
import { shapeOffered } from '@/lib/venues';
import { KN, SHAPE_NAME, SHAPES, type Daily, type Length, type Shape, type Wind } from '@/lib/race';
import { IconArrow, IconPlay, clock } from './ui';

const IconBurger = () => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const IconUser = () => <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><circle cx="8" cy="5.2" r="2.8" fill="currentColor" /><path d="M2.5 14.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6z" fill="currentColor" /></svg>;
const IconPrev = () => <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;
const IconNext = () => <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;

// The header's menu: the burger and your avatar (your initials once signed in, from lib/me.ts: the pages are cached,
// so whether you are is drawn by CSS, .if-me and .if-guest). It holds the account pages, and on a
// narrow screen, where the header's links are hidden, the site's pages too.
export function SiteMenu({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => { const d = ref.current; if (d?.open && !(e instanceof KeyboardEvent ? e.key !== 'Escape' : d.contains(e.target as Node))) d.open = false; };
    document.addEventListener('click', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details className="hm-menu" ref={ref}>
      <summary className="hm-prof" aria-label={t('Menu', 'Меню')}><IconBurger /><span className="hm-av"><IconUser /><span className="me-ini" /></span></summary>
      <div className="hm-menu-pop">
        <Link className="hm-mi if-guest" href="/sign-in">{t('Sign in', 'Войти')}</Link>
        <Link className="hm-mi" href="/boat">{t('Your boat', 'Твоя яхта')}</Link>
        <Link className="hm-mi" href="/settings">{t('Settings', 'Настройки')}</Link>
        <nav className="hm-menu-nav" aria-label={t('Pages', 'Страницы')}>
          <span className="hm-msep" />
          <Link className="hm-mi" href="/help">{t('How to play', 'Как играть')}</Link>
          <Link className="hm-mi" href="/race">{t('Today’s race', 'Гонка дня')}</Link>
          <Link className="hm-mi" href="/race/free">{t('Free race', 'Свободная гонка')}</Link>
          <Link className="hm-mi" href="/faq">{t('Questions', 'Вопросы')}</Link>
          <Link className="hm-mi" href="/iyt">{'Sailing Certification Test'}</Link>
        </nav>
      </div>
    </details>
  );
}

type Pick = { preset: Wind; fleet: number; course: Shape; length: Length; laps: number; start: number };
const KEYS = ['preset', 'fleet', 'course', 'length', 'laps', 'start'] as const;

// The hero's race: a pill with today's race in it and a play button. Tap the race and its settings open as chips;
// change any and it becomes a free race, saved where the game reads it, like the free-race set-up does.
export function RacePill({ lang, daily }: { lang: Lang; daily: Daily }) {
  const t = tx(lang);
  const today: Pick = { preset: daily.preset, fleet: daily.fleet, course: daily.course, length: daily.length, laps: daily.laps, start: daily.start };
  const [p, setP] = useState<Pick>(today);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // a free race goes to the venue last picked in the set-up: it offers the shapes that venue has room for at this length
  // (and today's, to go back to today's race), and once the race is a free one a shape it hasn't goes back to up and
  // down, as in the set-up
  const [venue, setVenue] = useState<string>(daily.venue);
  useEffect(() => { setVenue(readOpts().venue); }, []);
  const offered = (s: Shape) => shapeOffered(venue, s, p.length);
  useEffect(() => {
    if (!KEYS.every((k) => p[k] === today[k]) && !offered(p.course)) setP((x) => ({ ...x, course: 'wl' }));
  }, [venue, p]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);

  const OPTS: { [K in keyof Pick]: [Pick[K], string][] } = {
    preset: [['light', t(`Light ${KN.light} kn`, `Слабый ${KN.light} уз`)], ['medium', t(`Medium ${KN.medium} kn`, `Средний ${KN.medium} уз`)], ['strong', t(`Strong ${KN.strong} kn`, `Сильный ${KN.strong} уз`)]],
    fleet: [[3, t('3 boats', '3 лодки')], [5, t('5 boats', '5 лодок')], [7, t('7 boats', '7 лодок')]],
    course: SHAPES.filter((s) => s === today.course || offered(s)).map((s) => [s, t(...SHAPE_NAME[s])]),
    length: [['short', t('Short', 'Короткая')], ['medium', t('Medium', 'Средняя')], ['long', t('Long', 'Длинная')]],
    laps: [[1, t('1 lap', '1 круг')], [2, t('2 laps', '2 круга')]],
    start: [[1, t('1 min', '1 мин')], [3, t('3 min', '3 мин')], [5, t('5 min', '5 мин')]],
  };
  const NAMES: Record<keyof Pick, string> = { preset: t('Wind', 'Ветер'), fleet: t('Boats', 'Лодки'), course: t('Course', 'Дистанция'), length: t('Length', 'Длина'), laps: t('Laps', 'Круги'), start: t('Start', 'Старт') };
  const label = <K extends keyof Pick>(k: K) => (OPTS[k] as [Pick[K], string][]).find(([v]) => v === p[k])?.[1] ?? '';
  const isToday = KEYS.every((k) => p[k] === today[k]);
  const summary = [label('preset'), label('fleet'), label('course'), `${label('length').toLowerCase()}, ${label('laps')}`, t(`${p.start}-min start`, `старт ${p.start} мин`)].join(' · ');
  const go = () => {
    if (isToday) { location.href = '/play?race=today'; return; }
    saveOpts({ ...p, current: 0, mode: 'free', lastFree: Date.now() });
    location.href = '/play?race=free';
  };
  const goLabel = isToday ? t('Play today’s race', 'Сыграть гонку дня') : t('Start a free race', 'Начать свободную гонку');

  return (
    <div className="hm-race" ref={box} role="search" aria-label={t('Race settings', 'Настройки гонки')}>
      <div className="hm-pill">
        <button type="button" className="hm-pill-t" aria-expanded={open} aria-controls="hm-race-panel" onClick={() => setOpen((o) => !o)}>
          <span className="hm-l1">{isToday ? t('Today’s race', 'Гонка дня') : t('Free race', 'Свободная гонка')}</span>
          <span className="hm-l2">{summary}</span>
        </button>
        <button type="button" className="hm-go" onClick={go} aria-label={goLabel}><IconPlay s={22} /></button>
      </div>
      {open && (
        <div className="hm-panel" id="hm-race-panel">
          {KEYS.map((k) => (
            <div className="hm-prow" key={k}>
              <span className="hm-slab">{NAMES[k]}</span>
              <div className="hm-chips" role="radiogroup" aria-label={NAMES[k]}>
                {(OPTS[k] as [Pick[typeof k], string][]).map(([v, l]) => (
                  <button key={String(v)} type="button" role="radio" aria-checked={p[k] === v} className={`hm-chip${p[k] === v ? ' on' : ''}`} onClick={() => setP((x) => ({ ...x, [k]: v }))}>
                    {l}{today[k] === v && <span className="td"> · {t('today', 'сегодня')}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="hm-panel-go" onClick={go}><span className="btn-t">{goLabel}</span><IconArrow s={18} /></button>
        </div>
      )}
      <p className="hm-note">
        {isToday
          ? t('Tap the race to change it. Any change makes it a free race.', 'Нажми на гонку, чтобы её изменить. Любое изменение делает её свободной.')
          : <>{t('A free race: its time won’t go on today’s ranking.', 'Свободная гонка: её время не попадёт в рейтинг дня.')} <button type="button" className="hm-reset" onClick={() => setP(today)}>{t('Back to today’s race', 'Вернуться к гонке дня')}</button></>}
      </p>
    </div>
  );
}

// A row of tiles that scrolls sideways, with the two round arrows in its section's header.
export function TileRow({ lang, head, children }: { lang: Lang; head: ReactNode; children: ReactNode }) {
  const t = tx(lang);
  const row = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  useEffect(() => {
    const r = row.current; if (!r) return;
    const upd = () => setEnds({ start: r.scrollLeft < 4, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 4 });
    upd(); r.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd);
    return () => { r.removeEventListener('scroll', upd); removeEventListener('resize', upd); };
  }, []);
  const by = (dir: number) => { const r = row.current, tile = r?.firstElementChild as HTMLElement | null; if (r && tile) r.scrollBy({ left: dir * (tile.offsetWidth + 20) * 3, behavior: 'smooth' }); };
  return (
    <>
      <div className="hm-sec-h">
        {head}
        <div className="hm-arrows">
          <button type="button" className="round round-s round-muted" onClick={() => by(-1)} disabled={ends.start} aria-label={t('Back', 'Назад')}><IconPrev /></button>
          <button type="button" className="round round-s round-muted" onClick={() => by(1)} disabled={ends.end} aria-label={t('More', 'Ещё')}><IconNext /></button>
        </div>
      </div>
      <div className="hm-row" ref={row}>{children}</div>
    </>
  );
}

// Your best time in today's race on this device (the game keeps it), or the way onto the ranking. The ranking above it is
// the server's, and a time the server didn't keep (a finish that never reached it, or one its checks threw out) is in this
// device's record all the same: the row shows where the time stands against the board, its place when the board has it
// and its gap to the leader, and says so when a time that would be on the board isn't, rather than sit under slower ones.
// The board names no one, so "on it" means a ranked time equal to this one.
// Signed in or not is CSS's to show (.if-me, .if-guest; lib/me.ts), so Home can be a cached page.
export function MyRow({ lang, day, top = [], next = '/' }: { lang: Lang; day: string; top?: { s: number }[]; next?: string }) {
  const t = tx(lang);
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => { setBest(readPb()[`daily|${day}`] ?? null); }, [day]);
  const listed = best != null && top.some((r) => Math.abs(r.s - best) < 0.05);
  const place = best != null ? top.filter((r) => r.s < best - 0.05).length + 1 : 0;
  const missing = best != null && !listed && (top.length < 3 || best < top[top.length - 1].s);
  const gap = best != null && top.length ? best - top[0].s : 0;
  return (
    <li className="me">
      <span className="hm-n">{listed ? place : '·'}</span>
      <span>
        {t('You', 'Ты')}
        {missing && <small className="hm-why if-me" title={t('This device has the time, but the race didn’t reach today’s ranking', 'Время есть на этом устройстве, но в рейтинг дня гонка не попала')}>{t('not on the ranking', 'не в рейтинге')}</small>}
      </span>
      <span className="hm-t if-me">{best != null ? <>{clock(best)}{Math.abs(gap) >= 0.05 ? <small>{gap > 0 ? '+' : '−'}{Math.abs(gap).toFixed(1)}</small> : null}</> : <span className="hm-muted">{t('not yet', 'ещё нет')}</span>}</span>
      <Link className="hm-src if-guest" href={`/sign-in?next=${next}`}>{t('Sign in to get on it', 'Войди, чтобы попасть сюда')}</Link>
    </li>
  );
}

// The hero's live race (public/hero-view): the whole game, ~1.4 MB of three.js and the course. It shares the page's
// thread, so it starts only once the page has loaded and gone idle; until then the still picture under it shows.
// Not at all where it would be hidden (reduced motion: a display:none iframe still downloads everything), or where the
// reader has asked to save data or is on a slow connection: there the still picture is the hero.
export function HeroScene({ title }: { title: string }) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || net?.saveData || /(^|-)(2g|3g)$/.test(net?.effectiveType || '')) return;
    let idle = 0, timer = 0;
    const go = () => {
      const ric = window.requestIdleCallback;
      if (ric) idle = ric(() => setSrc('/hero-view'), { timeout: 2000 });
      else timer = window.setTimeout(() => setSrc('/hero-view'), 200);
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    return () => { window.removeEventListener('load', go); if (idle) window.cancelIdleCallback(idle); clearTimeout(timer); };
  }, []);
  return <iframe className="hm-scene" src={src} title={title} aria-hidden="true" tabIndex={-1} />;
}
