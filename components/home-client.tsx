'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readPb } from '@/lib/opts';
import { clock } from './ui';

const IconBurger = () => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const IconUser = () => <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><circle cx="8" cy="5.2" r="2.8" fill="currentColor" /><path d="M2.5 14.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6z" fill="currentColor" /></svg>;

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

// The time left in today's race, to midnight UTC when the next one starts, ticking each second. The page is cached,
// so the server can't know the time: it shows a blank clock until the browser fills it in.
export function Countdown({ className }: { className?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const n = new Date(); setLeft(Math.max(0, Math.floor((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime()) / 1000))); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const p = (x: number) => String(x).padStart(2, '0');
  return <b className={className} role="timer" aria-live="off">{left == null ? '--:--:--' : `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`}</b>;
}

// The bar with today's race at the foot of the screen: it comes up once the hero's own buttons (watch) have scrolled
// away above, so it never sits over them, and goes again when they come back. Inert while it's down.
export function Dock({ watch, children }: { watch: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = document.querySelector(watch);
    if (!el) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  return <div className={`ho-dock${on ? ' on' : ''}`} inert={!on}>{children}</div>;
}

// One line at a time from a few, each sliding in after the last, as a broadcast's ticker; only true lines (today's
// ranking, as the page has it), never made-up activity.
export function Ticker({ lines, every = 4000 }: { lines: string[]; every?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), every);
    return () => clearInterval(id);
  }, [lines.length, every]);
  return lines.length ? <span className="ho-tick-t" key={i}>{lines[i % lines.length]}</span> : null;
}
