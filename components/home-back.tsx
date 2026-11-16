'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { track } from '@/lib/track';
import { keptResults, readLog, streakOf, LOG_EVENT, type Log } from '@/lib/log';
import { BADGES, badgeNear, type BadgeId } from '@/lib/badges';
import { DRILL_IDS, DRILLS_KEY } from '@/lib/drills';
import { VENUES } from '@/lib/venues';
import { pushable, currentSub, subscribe, unsubscribe, pushSync } from '@/lib/push';
import { useLog } from './passport';
import { Countdown } from './home-client';
import { clock } from './ui';

// Home for the player who has been before. Home is one cached page for everyone, so who has raced is the browser's
// to know: the head script in app/[lang]/layout.tsx marks <html data-back> before the first paint when this device has
// raced (its log or a kept result), and styles/home-back.css shows the strip and folds the explainers by it. The strip
// itself is drawn here from the log (lib/log.ts): the streak and what today's race does to it, today's time against
// the board, and the badge you're nearest.

const BACK = 'data-back';
export const markBack = (log: Log | null) => { if (log && Object.keys(log.d).length) document.documentElement.setAttribute(BACK, ''); };

const ord = (n: number, lang: Lang) => (lang === 'ru' ? `${n}-е` : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`);
const readDrills = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(DRILLS_KEY) || '{}') || {}; } catch { return {}; } };

// the badge not yet earned that you have come nearest to, as far as it can be counted
function nearest(log: Log): { id: BadgeId; v: number; of: number } | null {
  const near = badgeNear(keptResults(), { streak: streakOf(log.d).n, venues: Object.keys(log.v).length, of: VENUES.length, drills: readDrills(), drillIds: DRILL_IDS });
  let best: { id: BadgeId; v: number; of: number } | null = null;
  for (const [id, n] of Object.entries(near) as [BadgeId, NonNullable<(typeof near)[BadgeId]>][]) {
    if (log.b[id] || !n.of || n.unit === 'place' || n.unit === 'hails') continue;
    if (!best || n.v / n.of > best.v / best.of) best = { id, v: Math.min(n.v, n.of), of: n.of };
  }
  return best;
}

export function BackStrip({ lang, day, top, cap = 5 }: { lang: Lang; day: string; top: { s: number }[]; cap?: number }) {
  const t = tx(lang), log = useLog();
  useEffect(() => markBack(log), [log]);
  if (!log || !Object.keys(log.d).length && !keptResults().length) return <div className="ho-back" aria-hidden="true" />;
  const st = streakOf(log.d), mine = log.d[day] ?? null, near = nearest(log);
  const badge = near ? BADGES.find((b) => b.id === near.id) : null;
  const earned = Object.keys(log.b).length;
  // where today's time stands: its place when the board's rows reach it, else its gap to the leader
  const place = mine != null && top.length && (top.length < cap || mine <= top[top.length - 1].s + 0.05) ? top.filter((r) => r.s < mine - 0.05).length + 1 : 0;
  const gap = mine != null && top.length ? mine - top[0].s : 0;
  const days = (n: number) => t(`${n}-day streak`, `${n} ${ruPlural(n, ['день', 'дня', 'дней'])} подряд`);
  return (
    <div className="ho-back" aria-label={t('Your racing', 'Твои гонки')} role="group">
      <div className={`ho-back-i${st.risk ? ' risk' : ''}`}>
        <span className="lbl">{t('Streak', 'Серия')}</span>
        <b>{st.n ? days(st.n) : t('No streak yet', 'Серии пока нет')}</b>
        <small>{st.today ? t('Today’s is in. Back tomorrow for the next', 'Сегодняшняя есть. Завтра — следующая')
          : st.risk ? t('Sail today’s race or it ends', 'Пройди гонку дня, иначе серия прервётся')
          : st.n ? t(`Sail today’s race to make it ${st.n + 1}`, `Пройди гонку дня — будет ${st.n + 1}`)
          : t('Finish today’s race to start one', 'Пройди гонку дня, чтобы начать серию')}</small>
      </div>
      <div className="ho-back-i">
        <span className="lbl">{t('Your time today', 'Твоё время сегодня')}</span>
        {mine != null ? <>
          <b>{clock(mine)}</b>
          <small>{place === 1 ? t('The time to beat is yours', 'Время дня — твоё') : place ? t(`${ord(place, lang)} today · ${gap.toFixed(1)} s off the lead`, `${ord(place, lang)} место · ${gap.toFixed(1).replace('.', ',')} с до лидера`) : gap > 0 ? t(`${gap.toFixed(1)} s off the lead`, `${gap.toFixed(1).replace('.', ',')} с до лидера`) : t('On today’s board', 'В рейтинге дня')}</small>
        </> : <>
          <b>{t('Not sailed yet', 'Ещё не пройдена')}</b>
          <small>{t('Closes in', 'Закроется через')} <Countdown /></small>
        </>}
      </div>
      <Link className="ho-back-i ho-back-a" href="/race/badges" data-cta="back-badge">
        <span className="lbl">{badge ? t('Nearest badge', 'Ближайшее достижение') : t('Badges', 'Достижения')}</span>
        <b>{badge ? t(...badge.name) : t(`${earned} of ${BADGES.length}`, `${earned} из ${BADGES.length}`)}</b>
        <small>{near ? t(`${near.v} of ${near.of} ›`, `${near.v} из ${near.of} ›`) : t('See what each one takes ›', 'Что нужно для каждого ›')}</small>
      </Link>
      <div className="ho-back-i ho-back-push"><PushButton lang={lang} where="back" /></div>
    </div>
  );
}

// The daily reminder's switch (lib/push.ts): nothing where the browser can't take one, a word on adding the site to
// the Home Screen on an iPhone (where Safari takes them only there), and the reminder's own time, in local time.
export function PushButton({ lang, where }: { lang: Lang; where: string }) {
  const t = tx(lang);
  const [st, setSt] = useState<'wait' | 'na' | 'ios' | 'off' | 'on' | 'denied' | 'busy' | 'failed'>('wait');
  useEffect(() => {
    if (!pushable()) {
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone;
      setSt(ios ? 'ios' : 'na');
      return;
    }
    if (Notification.permission === 'denied') { setSt('denied'); return; }
    currentSub().then((s) => setSt(s && Notification.permission === 'granted' ? 'on' : 'off')).catch(() => setSt('off'));
  }, []);
  const at = (() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 17)).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }); })();
  const on = async () => {
    setSt('busy');
    const r = await subscribe(lang, readLog());
    track('Reminder', { where, result: r });
    setSt(r === 'on' ? 'on' : r);
  };
  const off = async () => { setSt('busy'); await unsubscribe(); track('Reminder', { where, result: 'off' }); setSt('off'); };
  if (st === 'wait' || st === 'na') return null;
  if (st === 'ios') return <p className="ho-push-t">{t('For a daily reminder on an iPhone: Share › Add to Home Screen, then open it from there.', 'Чтобы получать напоминание на iPhone: «Поделиться» › «На экран Домой», и открой оттуда.')}</p>;
  if (st === 'denied') return <p className="ho-push-t">{t('Reminders are blocked for this site in the browser’s settings.', 'Напоминания для этого сайта выключены в настройках браузера.')}</p>;
  if (st === 'on') return (
    <div className="ho-push">
      <span className="lbl">{t('Reminder on', 'Напоминание включено')}</span>
      <b>{t(`Daily at ${at}`, `Каждый день в ${at}`)}</b>
      <small>{t('Only on days you haven’t sailed yet. ', 'Только в дни, когда ты ещё не прошёл гонку. ')}<button type="button" className="ho-push-x" onClick={off}>{t('Turn off', 'Выключить')}</button></small>
    </div>
  );
  return (
    <div className="ho-push">
      <button type="button" className="ho-ghost ho-push-go" onClick={on} disabled={st === 'busy'}>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>
        <span>{t('Remind me before it closes', 'Напомни до закрытия')}</span>
      </button>
      <small>{st === 'failed' ? t('That didn’t work. Try again in a moment.', 'Не получилось. Попробуй ещё раз чуть позже.') : t(`At ${at}, only on days you haven’t sailed.`, `В ${at}, только в дни без гонки.`)}</small>
    </div>
  );
}

// On every page (app/[lang]/layout.tsx): the reminder's row kept up with the last day finished and the streak
export function PushSync({ lang }: { lang: Lang }) {
  useEffect(() => {
    const go = () => { if (pushable() && Notification.permission === 'granted') pushSync(lang, readLog()).catch(() => {}); };
    go();
    addEventListener(LOG_EVENT, go);
    return () => removeEventListener(LOG_EVENT, go);
  }, [lang]);
  return null;
}

// Which of Home's buttons lead where (Vercel Analytics, "Home CTA"): anything marked data-cta, with whether the
// reader has raced before. Captured as the click goes, so a link to /play (a page outside the app) still counts.
export function CtaTrack() {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLElement>('[data-cta]');
      if (!a) return;
      track('Home CTA', { where: a.dataset.cta || '', to: a.getAttribute('href') || '', back: document.documentElement.hasAttribute(BACK) ? 1 : 0 });
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, []);
  return null;
}

// The explainers, folded away for a reader who has raced (styles/home-back.css): one button opens them. Open as they
// are for everyone else, and opened by a link to anything inside them (/#faq).
export function Fold({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = tx(lang), ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1)), el = id ? document.getElementById(id) : null;
      // the browser's own jump came while it was folded away, so once it's open, the jump again
      if (el && ref.current?.contains(el) && !el.checkVisibility()) { setOpen(true); setTimeout(() => el.scrollIntoView(), 60); }
    };
    go();
    addEventListener('hashchange', go);
    return () => removeEventListener('hashchange', go);
  }, []);
  return (
    <div className={`ho-fold${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="ho-ghost ho-fold-btn" aria-expanded={open} onClick={() => { setOpen(!open); track('Home CTA', { where: 'fold', to: open ? 'close' : 'open', back: 1 }); }}>
        {open ? t('Less about the game', 'Свернуть') : t('About the game: what’s inside, the questions, the rules', 'Об игре: что внутри, вопросы, правила')}
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
      </button>
      <div className="ho-fold-in">{children}</div>
    </div>
  );
}

// Home's way to a match race against a friend, behind the same gate as the hub's (components/hub-client.tsx MatchCard):
// until the umpire's calls are signed off it shows only when the address has ?match.
export function MatchLink({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(new URLSearchParams(location.search).has('match')); }, []);
  if (!on) return null;
  return <Link className="ho-ghost" href="/match/new" data-cta="friend-match">{t('Match race a friend, one on one', 'Матчевая гонка с другом, один на один')}</Link>;
}
