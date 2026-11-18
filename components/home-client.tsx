'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readPb } from '@/lib/opts';
import { readBoat } from '@/lib/boat';
import { readMe } from '@/lib/me';
import { briefUrl, readBrief } from '@/lib/day-brief';
import { dailyVenue, dailyYacht } from '@/lib/race';
import { clock } from './ui';
import { FlagImg } from './flag';
import { AvMenuItem } from './av-row';

const IconBurger = () => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const IconUser = () => <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><circle cx="8" cy="5.2" r="2.8" fill="currentColor" /><path d="M2.5 14.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6z" fill="currentColor" /></svg>;

// The header's menu: the burger and your avatar (your initials once signed in, from lib/me.ts: the pages are cached,
// so whether you are is drawn by CSS, .if-me and .if-guest). At its head who you are: signed in, your initials and name,
// the way to the account and settings; a guest, the way to sign in and why (at every width, the bar's own button
// beside it or not). Then what's yours on this device (the boat, the passport; Settings is the head's once signed in;
// and, for a player who has raced, their own card on /players), the reading pages with the badges, on a narrow screen
// (where the header's links are hidden) the site's pages too, and last, signed in, Sign out (back to the page it was
// on, app/auth/sign-out).
export function SiteMenu({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const ref = useRef<HTMLDetailsElement>(null);
  const [card, askCard] = useCardKey();
  useEffect(() => {
    const close = (e: Event) => { const d = ref.current; if (d?.open && !(e instanceof KeyboardEvent ? e.key !== 'Escape' : d.contains(e.target as Node))) d.open = false; };
    document.addEventListener('click', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details className="hm-menu" ref={ref} onToggle={(e) => { if (e.currentTarget.open) askCard(); }}>
      <summary className="hm-prof" aria-label={t('Menu', 'Меню')} onPointerEnter={askCard} onFocus={askCard}><IconBurger /><span className="hm-av"><IconUser /><span className="me-ini" /></span></summary>
      <div className="hm-menu-pop">
        <Link className="hm-acct if-me" href="/settings">
          <span className="hm-av hm-acct-av me-ini" aria-hidden="true" />
          <span className="hm-acct-t"><span className="hm-acct-n me-name" /><span className="hm-acct-s">{t('Account and settings', 'Аккаунт и настройки')}</span></span>
        </Link>
        <Link className="hm-acct if-guest" href="/sign-in">
          <span className="hm-av hm-acct-av" aria-hidden="true"><IconUser /></span>
          <span className="hm-acct-t"><span className="hm-acct-n">{t('Sign in', 'Войти')}</span><span className="hm-acct-s">{t('To be ranked and keep your times', 'Чтобы попасть в рейтинг и сохранить результаты')}</span></span>
        </Link>
        <span className="hm-msep" />
        <Link className="hm-mi" href="/boat">{t('Your boat', 'Твоя яхта')}</Link>
        <Link className="hm-mi" href="/passport">{t('Your passport', 'Твой паспорт')}</Link>
        {card && <Link className="hm-mi if-me" href={`/players?p=${encodeURIComponent(card)}`}>{t('Your player card', 'Твоя карточка игрока')}</Link>}
        <Link className="hm-mi if-guest" href="/settings">{t('Settings', 'Настройки')}</Link>
        <AvMenuItem lang={lang} />
        <span className="hm-msep" />
        <Link className="hm-mi" href="/help">{t('How to play', 'Как играть')}</Link>
        <Link className="hm-mi" href="/learn">{t('Learn to race', 'Учись гоняться')}</Link>
        <Link className="hm-mi" href="/race/badges">{t('Badges', 'Достижения')}</Link>
        <Link className="hm-mi" href="/faq">{t('Questions', 'Вопросы')}</Link>
        <nav className="hm-menu-nav" aria-label={t('Pages', 'Страницы')}>
          <span className="hm-msep" />
          <Link className="hm-mi" href="/race">{t('Today’s race', 'Гонка дня')}</Link>
          <Link className="hm-mi" href="/race/free">{t('Free race', 'Свободная гонка')}</Link>
          <Link className="hm-mi" href="/match/new">{t('Match race a friend', 'Матч с другом')}</Link>
          <Link className="hm-mi" href="/race/drills">{t('Drills', 'Тренировки')}</Link>
          <Link className="hm-mi" href="/race/rating">{t('Rating', 'Рейтинг')}</Link>
          <Link className="hm-mi" href="/players">{t('Players', 'Игроки')}</Link>
          <Link className="hm-mi hm-mi-x" href="/venues">{t('Venues', 'Акватории')}</Link>
          <Link className="hm-mi hm-mi-x" href="/yachts">{t('Yachts', 'Яхты')}</Link>
        </nav>
        <form className="if-me" action="/auth/sign-out" method="post"
          onSubmit={(e) => { (e.currentTarget.elements.namedItem('next') as HTMLInputElement).value = location.pathname + location.search; forgetCard(); }}>
          <span className="hm-msep" />
          <input type="hidden" name="next" />
          <button className="hm-mi hm-mi-out" type="submit">{t('Sign out', 'Выйти')}</button>
        </form>
      </div>
    </details>
  );
}

// The key of your own card on /players (?p=<k>), for the menu's row. The scores server makes it from a secret of its
// own, so it is asked for (app/auth/player, with the session) once you are signed in, when the menu is first opened
// or pointed at, not on every page load; null until then, and for a guest or an account that has never raced (not a
// player yet), so the row isn't there. A key found is kept for the tab, under who it is for (as lib/me.ts reads the
// session), so the next page has the row at once; Sign out forgets it. Not having one is not kept: it is asked again
// on the next page, so a first race shows the row soon after.
const CARD = 'regatta-card';
const cardWho = () => { const m = readMe(); return m ? `${m.provider}|${m.email}|${m.name}` : null; };
const forgetCard = () => { try { sessionStorage.removeItem(CARD); } catch {} };
function useCardKey(): [string | null, () => void] {
  const [k, setK] = useState<string | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CARD) || 'null');
      if (c && typeof c.k === 'string' && c.who === cardWho()) { setK(c.k); asked.current = true; }
    } catch {}
  }, []);
  const ask = () => {
    const who = cardWho();
    if (asked.current || !who) return;
    asked.current = true;
    fetch('/auth/player', { cache: 'no-store' }).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null).then((j) => {
      const key = typeof j?.k === 'string' ? j.k : null;
      setK(key);
      if (key) try { sessionStorage.setItem(CARD, JSON.stringify({ who, k: key })); } catch {}
    });
  };
  return [k, ask];
}

// Your best time in today's race on this device (the game keeps it), or the way onto the ranking. The ranking above it is
// the server's, and a time the server didn't keep (a finish that never reached it, or one its checks threw out) is in this
// device's record all the same: the row shows where the time stands against the board, its place when the board has it
// and its gap to the leader, and says so when a time that would be on the board isn't, rather than sit under slower ones
// (once the server, asked afresh, confirms it: the board on the page can be minutes old).
// The board names no one, so "on it" means a ranked time equal to this one.
// Signed in or not is CSS's to show (.if-me, .if-guest; lib/me.ts), so Home can be a cached page.
// cap: how many rows the list can hold (lib/today.ts: 5, or 3 when only the plain API answered), for whether a time
// slower than the last of them could still have been on it
export function MyRow({ lang, day, top = [], cap = 5, next = '/' }: { lang: Lang; day: string; top?: { s: number }[]; cap?: number; next?: string }) {
  const t = tx(lang);
  const [best, setBest] = useState<number | null>(null);
  const [fl, setFl] = useState<string | null>(null); // the flag you fly on the boat page, as the rows above show theirs
  useEffect(() => { setBest(readPb()[`daily|${day}`] ?? null); setFl(readBoat().flag ?? null); }, [day]);
  const near = (s: number) => best != null && Math.abs(s - best) < 0.05;
  // a time the list should have had and hasn't (an empty list is the scores server not answering, the page passes []
  // then, not a ranking without you on it)
  const suspect = best != null && !top.some((r) => near(r.s)) && top.length > 0 && (top.length < cap || best < top[top.length - 1].s);
  // The list is cached (the page and its fetch five minutes each, the scores API's edge as long again), so a race just
  // finished isn't on it yet. Before saying a time is missing, the server itself is asked for the day's ranked times,
  // past every cache: a request of its own, made only for such a time, so seldom. Until it answers, or when it can't,
  // the row claims nothing. field: undefined not asked, null no answer, else every ranked time, the fastest first.
  const [field, setField] = useState<number[] | null | undefined>(undefined);
  useEffect(() => {
    if (!suspect) return;
    let live = true;
    fetch(`${briefUrl(day)}&fresh=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j) => { if (live) setField(readBrief(j, day)?.s ?? null); });
    return () => { live = false; };
  }, [suspect, day]);
  const times = field ?? top.map((r) => r.s);
  const listed = best != null && times.some(near);
  const place = best != null ? times.filter((s) => s < best - 0.05).length + 1 : 0;
  const missing = suspect && Array.isArray(field) && !listed;
  const gap = best != null && times.length ? best - times[0] : 0;
  return (
    <li className="me">
      <span className="hm-n">{listed ? place : '·'}</span>
      <span className="lb-who">
        <FlagImg code={fl} lang={lang} />
        <span className="lb-nm"><span className="if-guest">{t('You', 'Ты')}</span><span className="if-me lb-you" data-you={t('(you)', '(ты)')} /></span>
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
    // today's race as the game has it, by this browser's clock (the page is cached, and may be from yesterday): the
    // day's venue and yacht; the view lights it at the venue's own hour now
    const url = `/hero-view?venue=${dailyVenue()}&boat=${dailyYacht()}`;
    let idle = 0, timer = 0;
    const go = () => {
      const ric = window.requestIdleCallback;
      if (ric) idle = ric(() => setSrc(url), { timeout: 2000 });
      else timer = window.setTimeout(() => setSrc(url), 200);
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
