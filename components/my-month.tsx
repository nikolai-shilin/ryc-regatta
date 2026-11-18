'use client';
import { clock } from '@/lib/clock';
import { useEffect, useState } from 'react';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { placeAmong } from '@/lib/race-log';
import { shiftDay, todayUtc } from '@/lib/log';
import { useLog } from './passport';
import { briefUrl, readBrief } from '@/lib/day-brief';

// Your month on the rating page: for each day of the month you finished today's race, where your best time that day
// stood among that day's ranked times, as a bar: how much of the field you beat (all of it: first). The times are
// this device's log (lib/log.ts; for a signed-in player, the account's too); the days' fields are the scores API's.
// The board names no one by account, so it's your times placed against it, as the result page places them.
// a day of yours: your best that day, its place among that day's ranked times and how many there are (with yours if it
// isn't on the board), and whether it is (a signed-in player's are: those earn the month's points)
export type MyDay = { d: string; s: number; place: number; of: number; listed: boolean };
export const monthOf = (day: string) => {
  const today = todayUtc(), first = day.slice(0, 8) + '01';
  const e = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10);
  return { first, end: e < today ? e : today };
};

// your days of the month that `day` is in, each placed on that day's ranking (null until known)
export function useMyDays(day: string) {
  const log = useLog();
  const [days, setDays] = useState<MyDay[] | null>(null);
  const { first, end } = monthOf(day);
  const mine = log ? Object.entries(log.d).filter(([d]) => d >= first && d <= end).sort(([a], [b]) => (a < b ? -1 : 1)) : null;
  const key = mine ? `m|${mine.map(([d, s]) => `${d}:${s}`).join(',')}` : ''; // m|: the log is in, with or without days
  useEffect(() => {
    if (!mine) return;
    if (!mine.length) { setDays([]); return; }
    let live = true;
    Promise.all(mine.map(([d, s]) => fetch(briefUrl(d)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const field: number[] = readBrief(j, d)?.s || [];
      const listed = field.some((x) => Math.abs(x - s) < 0.05);
      return { d, s, place: placeAmong(field, s), of: field.length + (listed ? 0 : 1), listed };
    }))).then((r) => live && setDays(r));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return log ? days : null;
}
// the month's points your listed days earned: on a day with N ranked, place p takes N − p + 1 (lib/rating.ts)
export const myPoints = (days: MyDay[]) => days.filter((x) => x.listed).reduce((a, x) => a + x.of - x.place + 1, 0);

export function MyMonth({ day, lang }: { day: string; lang: Lang }) {
  const t = tx(lang), log = useLog(), days = useMyDays(day);
  const [hover, setHover] = useState<string | null>(null);
  const { first, end } = monthOf(day);
  if (!log || !days) return null;
  const loc = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const all: string[] = []; for (let d = first; d <= end; d = shiftDay(d, 1)) all.push(d);
  const by = new Map(days.map((x) => [x.d, x]));
  const share = (x: MyDay) => (x.of <= 1 ? 1 : (x.of - x.place) / (x.of - 1)); // of the field beaten: 1 first, 0 last
  const ord = (n: number) => t(`${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`, `${n}-е`);
  // a day nobody else ranked has no field to place you in: drawn hollow, and neither a win nor your best
  const placed = days.filter((x) => x.of > 1);
  const best = placed.length ? placed.reduce((a, b) => (share(b) > share(a) || (share(b) === share(a) && b.place < a.place) ? b : a)) : null;
  const wins = placed.filter((x) => x.place === 1).length, podiums = placed.filter((x) => x.place <= 3).length;
  const dateW = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  // the day the strip under the chart reads: the one pointed at, else today's, else your best
  const shown = (hover && by.get(hover)) || by.get(end) || best;
  const stat = (k: string, v: string, u?: string, gold = false) => (
    <div className="rt-ms"><span className="lbl">{k}</span><b className={gold ? 'is-gold' : undefined}>{v}{u ? <span className="unit">{u}</span> : null}</b></div>
  );

  return (
    <section className="rt-mine" aria-labelledby="rt-mine-h">
      <div className="rt-card-h"><span className="lbl-ink" id="rt-mine-h">{t('Your month', 'Твой месяц')}</span>
        <span className="lbl">{new Date(day + 'T12:00:00Z').toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' })}</span></div>
      {days.length ? (
        <>
          {/* the month in four numbers, as the pause card's */}
          <div className="rt-mstats">
            {stat(t('Days', 'Дней'), String(days.length))}
            {stat(t('Best', 'Лучшее'), best ? (lang === 'ru' ? `${best.place}` : ord(best.place)) : '—', best ? t(`of ${best.of}`, `из ${best.of}`) : undefined, best?.place === 1)}
            {stat(t('Wins', 'Победы'), String(wins), undefined, wins > 0)}
            {stat(t('Podiums', 'Подиумы'), String(podiums))}
          </div>
          {/* each day you raced: a marker at your place that day (the top first, the foot last), on a stem from the foot;
              a win gold, your best labelled; the days you didn't, a tick on the foot */}
          <div className="rt-mc" role="img" aria-label={t('Your place each day this month: higher is better, the top is first that day', 'Твоё место в каждый день месяца: чем выше, тем лучше, верх — первое место')}
            onPointerLeave={() => setHover(null)}>
            <span className="rt-mc-g top"><i>{t('1st', '1-е')}</i></span>
            <span className="rt-mc-g mid" />
            <span className="rt-mc-g foot"><i>{t('Last', 'Посл.')}</i></span>
            <div className="rt-mc-cols">
              {all.map((d) => {
                const x = by.get(d), y = x && x.of > 1 ? share(x) : 0; // a day nobody else ranked: on the foot, hollow
                return (
                  <span key={d} className={`rt-mc-d${x ? ' has' : ''}${x && x.of > 1 && x.place === 1 ? ' win' : ''}${x && x.of <= 1 ? ' alone' : ''}${d === end ? ' on' : ''}${shown?.d === d ? ' sel' : ''}`}
                    style={{ ['--y' as string]: y.toFixed(3) }}
                    onPointerEnter={() => x && setHover(d)} onFocus={() => x && setHover(d)} onBlur={() => setHover(null)} tabIndex={x ? 0 : -1}
                    aria-label={x ? `${dateW(d)}: ${x.of > 1 ? t(`${ord(x.place)} of ${x.of}`, `${x.place}-е из ${x.of}`) : t('no one else ranked', 'других в рейтинге нет')}, ${clock(x.s)}` : undefined}>
                    {x ? <><i className="rt-mc-st" /><i className="rt-mc-mk" />{best?.d === d ? <b className="rt-mc-lb">{lang === 'ru' ? `${x.place}-е` : ord(x.place)}</b> : null}</> : null}
                    <small>{+d.slice(8)}</small>
                  </span>
                );
              })}
            </div>
          </div>
          {/* the day, as the race's split at a mark: the date, the place, the time */}
          {shown ? (
            <div className="rt-msplit" aria-live="polite">
              <span className="k">{dateW(shown.d)}</span>
              <b className={`t${shown.of > 1 && shown.place === 1 ? ' gold' : ''}`}>{shown.of > 1 ? t(`${ord(shown.place)} of ${shown.of}`, `${shown.place}-е из ${shown.of}`) : t('No one else ranked', 'Других в рейтинге нет')}</b>
              <span className="v">{clock(shown.s)}</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rt-none">{t('No races of yours this month on this device yet. Finish today’s race and it shows here.', 'На этом устройстве в этом месяце твоих гонок пока нет. Пройди гонку дня — и она появится здесь.')}</p>
      )}
    </section>
  );
}
