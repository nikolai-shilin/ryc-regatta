'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { BADGES, FAMS, type BadgeFam, type BadgeId } from '@/lib/badges';
import { BadgePennant, FAM_COLOUR } from './badge-pennant';
import { DRILLS, DRILLS_KEY } from '@/lib/drills';
import { todayUtc } from '@/lib/log';
import { passportShare, useLog } from './passport';
import { ShareButton } from './share-sheet';
import { myPoints, useMyDays } from './my-month';
import { Who } from './flag';

// The player's progress beyond a race: the drills' stars, the badges, the rival in the month's standings. All of it is
// this device's (and a signed-in player's account's, through the log), drawn in the browser on cached pages.

const readDrills = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(DRILLS_KEY) || '{}') || {}; } catch { return {}; } };
function useDrills() {
  const [d, setD] = useState<Record<string, number> | null>(null);
  useEffect(() => setD(readDrills()), []);
  return d;
}
const Stars = ({ n, label }: { n: number; label: string }) => (
  <span className="pg-stars" role="img" aria-label={label}>{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>
);

// /race/drills: each drill, what it is, what three stars take, your best, and the way in
export function DrillsList({ lang }: { lang: Lang }) {
  const t = tx(lang), got = useDrills();
  return (
    <ol className="pg-drills">
      {DRILLS.map((d, i) => {
        const n = got?.[d.id] || 0;
        return (
          <li key={d.id} className="pg-card">
            <div className="pg-card-h"><span className="pg-n">{i + 1}</span><h2>{t(...d.name)}</h2>
              <span className="pg-min">{t(`${d.min} min`, `${d.min} мин`)}</span></div>
            <p>{t(...d.what)}</p>
            <p className="pg-three"><b>{t('Three stars', 'Три звезды')}</b> · {t(...d.three)}</p>
            <div className="pg-foot">
              {got ? <Stars n={n} label={t(`Your best: ${n} of 3 stars`, `Твой лучший: ${n} из 3 звёзд`)} /> : <span />}
              <a className="rt-go pg-go" href={`/play?race=free&drill=${d.id}`}>{n ? t('Again', 'Ещё раз') : t('Start', 'Начать')}</a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// /race/badges: every badge as its pennant, those you have lit with when, the rest dark with how; over them how many,
// a pip each in its family's colour
export function BadgesGrid({ lang }: { lang: Lang }) {
  const t = tx(lang), log = useLog(), loc = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const n = log ? BADGES.filter((b) => log.b[b.id]).length : 0;
  return (
    <>
      <div className="pg-count">
        <p role="status">{log ? (lang === 'ru' ? <>Получено <b>{n}</b> из {BADGES.length}</> : <><b>{n}</b> of {BADGES.length} earned</>) : ' '}</p>
        <Pips got={log?.b} />
        <span className="pg-legend">{FAMS.map((f) => <span key={f.id} style={fam(f.id)}>{t(...f.many)}</span>)}</span>
        {log && n ? <ShareButton lang={lang} data={() => passportShare(log, lang)} className="bt-show" title={t('Share your badges and venues', 'Поделиться значками и акваториями')} /> : null}
      </div>
      <ul className="pg-badges">
        {BADGES.map((b) => {
          const at = log?.b[b.id];
          return (
            <li key={b.id} className={`pg-badge${at ? ' on' : ''}`} style={fam(b.fam)}>
              <span className="pg-fam">{t(...FAMS.find((f) => f.id === b.fam)!.name)}</span>
              <BadgePennant id={b.id} on={!!at} className="pg-emb" />
              <b>{t(...b.name)}</b>
              <span>{t(...b.how)}</span>
              <small>{at ? new Date(at).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : t('Not yet', 'Ещё нет')}</small>
            </li>
          );
        })}
      </ul>
    </>
  );
}
// a family's colour, for the CSS
const fam = (f: BadgeFam) => ({ '--c': FAM_COLOUR[f] }) as CSSProperties;
// a pip a badge, lit in its family's colour once earned
const Pips = ({ got, className = 'pg-pips' }: { got?: Partial<Record<string, number>>; className?: string }) => (
  <span className={className} aria-hidden="true">{BADGES.map((b) => <i key={b.id} className={got?.[b.id] ? 'on' : undefined} style={fam(b.fam)} />)}</span>
);

// the result page: the badges this race earned first (the log keeps each at the race that first earned it), as a
// banner under the result's kicks: one, its pennant, name and how; several (a first race often earns three), their
// pennants side by side and their names, so the result stays in sight on a phone
export function RaceBadges({ lang, at }: { lang: Lang; at: number }) {
  const t = tx(lang), log = useLog();
  const won = log ? BADGES.filter((b) => b.race && log.b[b.id] === at) : [];
  if (!won.length) return null;
  const one = won.length === 1 ? won[0] : null;
  return (
    <Link href="/race/badges" className={`pg-kick${one ? '' : ' many'}`} style={fam(won[0].fam)}>
      <span className="pg-kick-embs">{won.map((b) => <BadgePennant key={b.id} id={b.id} on className="pg-kick-emb" style={fam(b.fam)} />)}</span>
      <span className="pg-kick-t">
        <em>{one ? t('New badge', 'Новый значок') : lang === 'ru' ? `${won.length} ${ruPlural(won.length, ['новый значок', 'новых значка', 'новых значков'])}` : `${won.length} new badges`}</em>
        <strong>{won.map((b) => t(...b.name)).join(' · ')}</strong>
        {one ? <span>{t(...one.how)}</span> : null}
      </span>
    </Link>
  );
}

// the hub's rows: the drills (a gold pennant, your stars of all) and the badges (your last three earned fanned, how
// many, a pip each)
export function ProgressRows({ lang }: { lang: Lang }) {
  const t = tx(lang), got = useDrills(), log = useLog();
  const stars = got ? DRILLS.reduce((a, d) => a + (got[d.id] || 0), 0) : null;
  const n = log ? BADGES.filter((b) => log.b[b.id]).length : null;
  const last = log ? (Object.entries(log.b) as [BadgeId, number][]).filter(([id]) => BADGES.some((b) => b.id === id)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id) : [];
  return (
    <>
      <Link className="bt-row pg-row" href="/race/drills">
        <span className="pg-row-ico" aria-hidden="true"><BadgePennant id="drills" fam="result" on /></span>
        <span className="pg-row-t">{t('Drills', 'Тренировки')}{stars == null ? null : <small>{lang === 'ru' ? <><b>{stars}</b> из {DRILLS.length * 3} звёзд</> : <><b>{stars}</b> of {DRILLS.length * 3} stars</>}</small>}</span>
        {stars == null ? null : <span className="pg-row-stars" aria-hidden="true">{Array.from({ length: DRILLS.length * 3 }, (_, i) => <i key={i} className={i < stars ? 'on' : undefined}>★</i>)}</span>}
      </Link>
      <Link className="bt-row pg-row" href="/race/badges">
        <span className="pg-row-ico pg-row-fan" aria-hidden="true">
          {last.length ? last.map((id, i) => <BadgePennant key={id} id={id} on style={{ left: i * 11, zIndex: 3 - i }} />) : <BadgePennant id="first" on={false} />}
        </span>
        <span className="pg-row-t">{t('Badges', 'Значки')}{n == null ? null : <small>{lang === 'ru' ? <>Получено <b>{n}</b> из {BADGES.length}</> : <><b>{n}</b> of {BADGES.length} earned</>}</small>}</span>
        {n == null ? null : <Pips got={log?.b} className="pg-row-pips" />}
      </Link>
    </>
  );
}

// ---------- the rival ----------
// The one just above you in the month's standings, and how far: your points worked out from your days on the ranking
// (useMyDays: the board names no one by account), the standings' rows from the scores API. Only for a player whose
// times are on the ranking (signed in): a guest's earn no points.
type MonthRow = { k: string; name: string | null; fl: string | null; pts: number };
export function useRival() {
  const days = useMyDays(todayUtc());
  const [rows, setRows] = useState<MonthRow[] | null>(null);
  const on = !!days && days.some((x) => x.listed);
  useEffect(() => {
    if (!on) return;
    let live = true;
    fetch(`https://iyt.rycrentals.com/api/game?day=${todayUtc()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j) => live && setRows(j && j.month && Array.isArray(j.month.rows) ? j.month.rows : []));
    return () => { live = false; };
  }, [on]);
  if (!on || !days || !rows) return null;
  const mine = myPoints(days);
  // never yourself: this device may not have all your days (another device's not merged yet), so your own row could
  // stand above the points worked out here. The ranking shortens names ("Anna P."): first name and initial compared.
  const me = short(getComputedStyle(document.documentElement).getPropertyValue('--me-name').trim().replace(/^"|"$/g, ''));
  const others = rows.filter((r) => !me || short(r.name || '') !== me);
  const above = others.filter((r) => r.pts > mine).sort((a, b) => a.pts - b.pts)[0];
  const place = others.filter((r) => r.pts > mine).length + 1;
  return { mine, place, rival: above || null, lead: !above ? (others.filter((r) => r.pts < mine).sort((a, b) => b.pts - a.pts)[0] || null) : null };
}
const short = (n: string) => { const w = n.toLowerCase().split(/[\s.]+/).filter(Boolean); return w.length ? `${w[0]} ${w[1]?.[0] || ''}`.trim() : ''; };
const pts = (n: number, lang: Lang) => tx(lang)(`${n} ${n === 1 ? 'pt' : 'pts'}`, `${n} ${ruPlural(n, ['очко', 'очка', 'очков'])}`);

// the hub's row: who's next above you this month, and by how much
export function RivalRow({ lang }: { lang: Lang }) {
  const t = tx(lang), r = useRival();
  if (!r) return null;
  return (
    <Link className="bt-row pg-rival" href="/race/rating">
      <span className="pg-ico" aria-hidden="true">⚔</span>
      {r.rival
        ? <><span>{t('Your rival', 'Твой соперник')}</span><span className="bt-row-m pg-rival-m"><Who fl={r.rival.fl} name={r.rival.name || t('No name', 'Без имени')} lang={lang} /> · {t(`${r.rival.pts - r.mine} ${r.rival.pts - r.mine === 1 ? 'pt' : 'pts'} ahead`, `впереди на ${pts(r.rival.pts - r.mine, lang)}`)}</span></>
        : <><span>{t('You lead the month', 'Ты лидер месяца')}</span><span className="bt-row-m">{r.lead ? t(`${r.mine - r.lead.pts} clear of ${r.lead.name || 'the next'}`, `отрыв ${pts(r.mine - r.lead.pts, lang)}`) : pts(r.mine, lang)}</span></>}
    </Link>
  );
}

// the rating page, over your month: the same, as the race's split strip: who, by how much, and where you stand
export function RivalLine({ lang }: { lang: Lang }) {
  const t = tx(lang), r = useRival();
  if (!r) return null;
  const ordW = (n: number) => t(`${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`, `${n}-е`);
  return (
    <div className={`pg-rv${r.rival ? '' : ' lead'}`} role="status">
      <span className="k">{r.rival ? t('Your rival', 'Соперник') : t('You lead', 'Ты лидер')}</span>
      {r.rival
        ? <b className="t"><Who fl={r.rival.fl} name={r.rival.name || t('No name', 'Без имени')} lang={lang} /></b>
        : <b className="t">{t('The month', 'Месяц')}</b>}
      <span className="v">{r.rival ? `+${pts(r.rival.pts - r.mine, lang)}` : r.lead ? `+${pts(r.mine - r.lead.pts, lang)}` : pts(r.mine, lang)}</span>
      <span className="g">{t(`You ${ordW(r.place)} · ${pts(r.mine, lang)}`, `Ты ${r.place}-й · ${pts(r.mine, lang)}`)}</span>
    </div>
  );
}
