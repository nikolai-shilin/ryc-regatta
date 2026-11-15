'use client';
import { useEffect, useState } from 'react';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { placeAmong } from '@/lib/race-log';
import { shiftDay, todayUtc } from '@/lib/log';
import { useLog } from './passport';

// Your month on the rating page: for each day of the month you finished today's race, where your best time that day
// stood among that day's ranked times, as a bar: how much of the field you beat (all of it: first). The times are
// this device's log (lib/log.ts; for a signed-in player, the account's too); the days' fields are the scores API's.
// The board names no one by account, so it's your times placed against it, as the result page places them.
type Day = { d: string; s: number; place: number; of: number };
const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };

export function MyMonth({ day, lang }: { day: string; lang: Lang }) {
  const t = tx(lang), log = useLog();
  const [days, setDays] = useState<Day[] | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const first = day.slice(0, 8) + '01', today = todayUtc();
  const end = (() => { const e = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10); return e < today ? e : today; })();
  const mine = log ? Object.entries(log.d).filter(([d]) => d >= first && d <= end).sort(([a], [b]) => (a < b ? -1 : 1)) : null;
  const key = mine ? `m|${mine.map(([d, s]) => `${d}:${s}`).join(',')}` : ''; // m|: the log is in, with or without days
  useEffect(() => {
    if (!mine) return;
    if (!mine.length) { setDays([]); return; }
    let live = true;
    Promise.all(mine.map(([d, s]) => fetch(`https://iyt.rycrentals.com/api/game?day=${d}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const field: number[] = j && j.d === d && Array.isArray(j.rows) ? j.rows.map((r: { s: number }) => r.s) : [];
      const listed = field.some((x) => Math.abs(x - s) < 0.05);
      return { d, s, place: placeAmong(field, s), of: field.length + (listed ? 0 : 1) };
    }))).then((r) => live && setDays(r));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!log || !days) return null;
  const loc = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const all: string[] = []; for (let d = first; d <= end; d = shiftDay(d, 1)) all.push(d);
  const by = new Map(days.map((x) => [x.d, x]));
  const share = (x: Day) => (x.of <= 1 ? 1 : (x.of - x.place) / (x.of - 1)); // of the field beaten: 1 first, 0 last
  const ord = (n: number) => t(`${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`, `${n}-е`);
  const best = days.length ? days.reduce((a, b) => (share(b) > share(a) || (share(b) === share(a) && b.place < a.place) ? b : a)) : null;
  const wins = days.filter((x) => x.place === 1).length, podiums = days.filter((x) => x.place <= 3).length;
  const H = 72, shown = hover ? by.get(hover) : null;
  const dateW = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <section className="rt-mine" aria-labelledby="rt-mine-h">
      <div className="rt-card-h"><span className="lbl-ink" id="rt-mine-h">{t('Your month', 'Твой месяц')}</span>
        <span className="lbl">{t(`${days.length} ${days.length === 1 ? 'day' : 'days'} raced`, `${days.length} ${ruPlural(days.length, ['день', 'дня', 'дней'])} в гонке`)}</span></div>
      {days.length ? (
        <>
          <p className="rt-mine-s" aria-live="polite">
            {shown ? <><b>{dateW(shown.d)}</b> · {t(`${ord(shown.place)} of ${shown.of}`, `${shown.place}-е из ${shown.of}`)} · {clock(shown.s)}</>
              : best ? <><b>{t(`Best: ${ord(best.place)} of ${best.of}`, `Лучшее: ${best.place}-е из ${best.of}`)}</b> · {dateW(best.d)}{podiums ? <> · {wins ? t(`${wins} ${wins === 1 ? 'win' : 'wins'}, `, `побед: ${wins}, `) : ''}{t(`${podiums} on the podium`, `на подиуме: ${podiums}`)}</> : null}</> : null}
          </p>
          <div className="rt-mine-c" role="img" aria-label={t('Your place each day this month, as the share of the field you beat', 'Твоё место в каждый день месяца — какую часть флота ты обогнал')} onPointerLeave={() => setHover(null)}>
            {all.map((d) => {
              const x = by.get(d), h = x ? Math.max(4, share(x) * H) : 0;
              return (
                <span key={d} className={`rt-mine-d${x ? ' has' : ''}${x?.place === 1 ? ' win' : ''}${d === day ? ' on' : ''}${hover === d ? ' hv' : ''}`}
                  onPointerEnter={() => x && setHover(d)} onFocus={() => x && setHover(d)} onBlur={() => setHover(null)} tabIndex={x ? 0 : -1}
                  aria-label={x ? `${dateW(d)}: ${t(`${ord(x.place)} of ${x.of}`, `${x.place}-е из ${x.of}`)}, ${clock(x.s)}` : undefined}>
                  <i style={{ height: h }} />
                  <small>{+d.slice(8)}</small>
                </span>
              );
            })}
          </div>
          <p className="rt-mine-k">{t('Taller is better: the top is first that day, the foot last.', 'Чем выше, тем лучше: верх — первое место в тот день, низ — последнее.')}</p>
        </>
      ) : (
        <p className="rt-none">{t('No races of yours this month on this device yet. Finish today’s race and it shows here.', 'На этом устройстве в этом месяце твоих гонок пока нет. Пройди гонку дня — и она появится здесь.')}</p>
      )}
    </section>
  );
}
