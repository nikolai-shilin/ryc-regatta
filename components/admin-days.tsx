import type { CSSProperties } from 'react';
import { LOCALE, tx, type Lang } from '@/lib/lang';

// The admin's races-a-day chart (/admin/game, /admin/duels), drawn as the race's HUD draws its gauges: square bars on
// their tracks, the condensed face, the day's numbers in a plate when it's pointed at (hover or tap, no script), the
// busiest day in gold. A day with no races is an empty track. Fewer days than a week keep a week's room, the newest on
// the right, so that one day is a bar and not the whole panel.
export type DaySlot = { d: string; n: number; tip: [string, string][] };

const WEEK = 7;

// the scale's top and its step: round numbers, about four lines, never a fraction of a race
function scale(max: number) {
  const raw = Math.max(1, max) / 4, p = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p);
  return { step, top: Math.ceil(Math.max(1, max) / step) * step };
}

export function DayChart({ lang, title, label, slots }: { lang: Lang; title: string; label: string; slots: DaySlot[] }) {
  const t = tx(lang);
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const n = slots.length, room = Math.max(n, WEEK), pad = room - n, last = n - 1;
  const max = Math.max(0, ...slots.map((s) => s.n)), { step, top } = scale(max);
  const peak = max ? slots.findLastIndex((s) => s.n === max) : -1;
  const lines = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // the dates under the axis: the two ends, and every so many days counted back from the newest
  const every = Math.max(1, Math.ceil(n / 6));
  const dated = (i: number) => i === 0 || i === last || ((last - i) % every === 0 && i >= every * 0.6);
  const dateClass = (i: number) => [
    room > 14 && i === 0 && 'first', room > 14 && i === last && 'last', // the ends keep inside the panel
    i !== 0 && i !== last && ((last - i) / every % 2 === 1 || (room > 14 && i < every * 1.5)) && 'alt', // every other one, and the one crowding the first, give way on a phone
  ].filter(Boolean).join(' ') || undefined;
  const grid = { '--days': room, '--day-gap': room > 120 ? '0px' : room > 60 ? '1px' : '2px' } as CSSProperties;
  return (
    <figure className="adm-days">
      <figcaption className="adm-days-head">
        <span className="adm-days-title">{title}</span>
        <dl className="adm-days-read">
          {peak >= 0 && <div className="peak"><dt>{t('Peak', 'Пик', 'Pico', 'Spitze')} · {date(slots[peak].d)}</dt><dd>{max}</dd></div>}
          {peak !== last && <div><dt>{t('Last day', 'Последний день', 'Último día', 'Letzter Tag')} · {date(slots[last].d)}</dt><dd>{slots[last].n}</dd></div>}
        </dl>
      </figcaption>
      <div className="adm-days-plot" style={{ '--days-lines': lines.length - 1 } as CSSProperties}>
        <div className="adm-days-y" aria-hidden="true">
          {lines.map((v) => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}><b>{v}</b></span>)}
        </div>
        <ol className="adm-days-bars" style={grid} aria-label={label}>
          {slots.map((s, i) => (
            <li key={s.d} tabIndex={-1} className={i === peak ? 'adm-days-slot peak' : 'adm-days-slot'} style={{ gridColumnStart: pad + i + 1 }}>
              {s.n > 0 && <i className="adm-days-bar" style={{ height: `${(s.n / top) * 100}%` }} />}
              <span className={pad + i < room / 2 ? 'adm-days-tip' : 'adm-days-tip left'}>
                <b>{date(s.d)}</b>
                {s.n > 0
                  ? s.tip.map(([k, v]) => <span key={k}><em>{k}</em>{v}</span>)
                  : <span><em>{t('No races', 'Нет гонок', 'Sin regatas', 'Keine Regatten')}</em></span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="adm-days-t" style={grid} aria-hidden="true">
        {slots.map((s, i) => dated(i) && (
          <span key={s.d} style={{ gridColumnStart: pad + i + 1 }} className={dateClass(i)}><b>{date(s.d)}</b></span>
        ))}
      </div>
    </figure>
  );
}
