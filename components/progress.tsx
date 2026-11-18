'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { DRILLS, DRILLS_KEY, LEVELS, levelOf, levelOpen, toOpen } from '@/lib/drills';
import { todayUtc } from '@/lib/log';
import { myPoints, useMyDays } from './my-month';
import { Who } from './flag';

// The player's progress beyond a race: the drills' stars and the rival in the month's standings, drawn in the browser
// on cached pages.

const readDrills = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(DRILLS_KEY) || '{}') || {}; } catch { return {}; } };
function useDrills() {
  const [d, setD] = useState<Record<string, number> | null>(null);
  useEffect(() => setD(readDrills()), []);
  return d;
}
const IconStar = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
);
const Stars = ({ n, label }: { n: number; label: string }) => (
  <span className="pg-stars" role="img" aria-label={label}>{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>
);

// /race/drills: the levels, each with its stars so far and whether it's open (two thirds of the stars of the one below
// open it), and under each its drills: what it is, what three stars take, your best, and the way in (a shut level's
// drills are shown, with what opens them)
export function DrillsList({ lang }: { lang: Lang }) {
  const t = tx(lang), got = useDrills(), mine = got ? levelOf(got) : null;
  let n = 0;
  return (
    <div className="pg-levels">
      {LEVELS.map((lv, li) => {
        const open = !got || levelOpen(lv.id, got), ds = DRILLS.filter((d) => d.level === lv.id);
        const have = got ? ds.reduce((a, d) => a + (got[d.id] || 0), 0) : null, below = LEVELS[li - 1];
        return (
          <section key={lv.id} className={`pg-level${open ? '' : ' off'}`} aria-labelledby={`lv-${lv.id}`}>
            <div className="pg-level-h">
              <span className={`pg-lv l${li + 1}`} aria-hidden="true"><i /><i /><i /><i /></span>
              <h2 id={`lv-${lv.id}`}>{t(...lv.name)}</h2>
              {mine === lv.id ? <span className="pg-level-you">{t('Your level', 'Твой уровень')}</span> : null}
              {have == null ? null : <span className="pg-level-n">{lang === 'ru' ? <><b>{have}</b> из {ds.length * 3} звёзд</> : <><b>{have}</b> of {ds.length * 3} stars</>}</span>}
            </div>
            <p className="pg-level-who">{t(...lv.who)}{open || !below ? null : <> <b>{lang === 'ru' ? `Откроется с ${toOpen(lv.id)} звёздами уровня «${below.name[1]}».` : `Opens with ${toOpen(lv.id)} stars at ${below.name[0]} level.`}</b></>}</p>
            <ol className="pg-drills" start={n + 1}>
              {ds.map((d) => {
                const s = got?.[d.id] || 0;
                n++;
                return (
                  <li key={d.id} className={`pg-card${open ? '' : ' off'}`}>
                    <div className="pg-card-h"><span className="pg-n">{n}</span><h3>{t(...d.name)}</h3>
                      <span className="pg-min">{t(`${d.min} min`, `${d.min} мин`)}</span></div>
                    <p>{t(...d.what)}</p>
                    <p className="pg-three"><b>{t('Three stars', 'Три звезды')}</b> · {t(...d.three)}</p>
                    <div className="pg-foot">
                      {got ? <Stars n={s} label={t(`Your best: ${s} of 3 stars`, `Твой лучший: ${s} из 3 звёзд`)} /> : <span />}
                      {open ? <a className="rt-go pg-go" href={`/play?race=free&drill=${d.id}`}>{s ? t('Again', 'Ещё раз') : t('Start', 'Начать')}</a>
                        : <span className="pg-lock">{t('Not open yet', 'Пока закрыто')}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

// the hub's row: the drills, your level and your stars at it
export function ProgressRows({ lang }: { lang: Lang }) {
  const t = tx(lang), got = useDrills();
  const stars = got ? DRILLS.reduce((a, d) => a + (got[d.id] || 0), 0) : null;
  // the pips: your level's drills' stars (the whole set's are too many to draw)
  const lv = got ? LEVELS.find((l) => l.id === levelOf(got))! : null, mineDs = lv ? DRILLS.filter((d) => d.level === lv.id) : [];
  const mineStars = got ? mineDs.reduce((a, d) => a + (got[d.id] || 0), 0) : 0;
  // the level after yours, and the stars at yours that open it: the row's next goal
  const next = lv ? LEVELS[LEVELS.indexOf(lv) + 1] : undefined;
  return (
    <Link className="bt-row pg-row" href="/race/drills">
      <IconStar />
      <span className="pg-row-t">{t('Drills', 'Тренировки')}{stars == null || !lv ? null : <small>{lang === 'ru'
        ? <>{lv.name[1]} · <b>{mineStars}</b> из {mineDs.length * 3}{next ? <> · ещё {toOpen(next.id) - mineStars} до уровня «{next.name[1]}»</> : null}</>
        : <>{lv.name[0]} · <b>{mineStars}</b> of {mineDs.length * 3} stars{next ? <> · {toOpen(next.id) - mineStars} more to open {next.name[0]}</> : null}</>}</small>}</span>
    </Link>
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
