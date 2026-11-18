import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { plainName } from '@/lib/name';
import { SHAPE_NAME } from '@/lib/race';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { DayChart, type DaySlot } from './admin-days';
import { Table, Tile } from './admin-stats';
import { PlayersTable, type Col, type Row } from './admin-players-table';
import { logHref } from './admin-logs';
import { IconCrew, clock } from './ui';

// The admin's look at the 1-on-1 races, from the database's regatta_admin_duels (which answers an admin alone): the
// totals, the races a day, how they ended, the tables by venue, yacht, wind, course and start, and every race, the
// newest first (1,000 at most). The game's screens report each race (public/game/duel-log.js → app/connect/log), the
// database keeps one row to a race. Drawn on the server, per request; the table sorts in the browser by the column
// clicked (components/admin-players-table.tsx). Times are UTC, as on /admin/players.
type Num = number | null;
export type Sailor = { name: string | null; who: string | null; kind: 'tg' | 'acct' | 'guest'; handle: string | null; place: Num; secs: Num; mark: string | null; pens: Num };
export type DuelRace = {
  id: string; code: string; race_no: number; at: string; ended: string | null; state: 'racing' | 'finished' | 'abandoned' | 'no_result';
  venue: string | null; yacht: string | null; wind: string | null; length: string | null; course: string | null; laps: Num; start_min: Num;
  current: boolean | null; daytime: string | null; winner: 'host' | 'guest' | null; margin: Num; forfeited: 'host' | 'guest' | null;
  recalls: Num; prep_flag: string | null; length_s: Num; host: Sailor | null; guest: Sailor | null;
};
export type Duels = {
  since: string | null; more: boolean;
  totals: { races: number; finished: number; abandoned: number; no_result: number; sailors: number; seats: number; signed: number; rematches: number; median: Num };
  days: { d: string; n: number; fin: number }[];
  endings: { forfeit: number; no_winner: number; dnf: number; dsq: number; both: number };
  groups: { k: 'venue' | 'yacht' | 'wind' | 'course' | 'start'; v: string | null; n: number; fin: number }[];
  races: DuelRace[];
};

// the period filter: 7, 30 or 90 days (?days=), else all time
export const DUEL_DAYS = [90, 30, 7] as const;
export const pickDuelDays = (q?: string): number | null => ((DUEL_DAYS as readonly number[]).includes(Number(q)) ? Number(q) : null);

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const ordinal = (n: number, lang: Lang) => (lang === 'ru' ? `${n}-е` : ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`);

export function AdminDuels({ lang, data, days }: { lang: Lang; data: Duels; days: number | null }) {
  const t = tx(lang), L = lang === 'ru' ? 1 : 0, T = data.totals, R = data.races;
  const when = (s: string) => new Date(s).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const venue = (v: string | null) => (v ? VENUES.find((x) => x.id === v)?.name[L] ?? v : '–');
  const yacht = (v: string | null) => (v ? YACHTS.find((x) => x.id === v)?.name[L] ?? v : '–');
  const wind = (v: string | null) => ({ light: t('Light', 'Слабый'), medium: t('Medium', 'Средний'), strong: t('Strong', 'Сильный') }[v ?? ''] ?? v ?? '–');
  const course = (v: string | null) => (v && v in SHAPE_NAME ? SHAPE_NAME[v as keyof typeof SHAPE_NAME][L] : v ?? '–');
  const length = (v: string | null) => ({ short: t('Short', 'Короткая'), medium: t('Medium', 'Средняя'), long: t('Long', 'Длинная') }[v ?? ''] ?? v ?? '–');
  const STATE = { racing: t('Racing', 'Идёт'), finished: t('Finished', 'Финиш'), abandoned: t('Abandoned', 'Брошена'), no_result: t('No result', 'Без итога') };
  const name = (s: Sailor | null) => (s ? plainName(s.name) ?? (s.kind === 'guest' ? t('Guest', 'Гость') : '–') : '–');
  const who = (s: Sailor | null) => {
    if (!s || (!s.who && plainName(s.name) == null)) return <span>–</span>;
    return (
      <span className="adm-pl-name">
        {s.who ? <Link className="adm-pl-link" href={logHref(s.who, days ?? 30)}>{name(s)}</Link> : name(s)}
        {s.kind === 'guest' && <span className="adm-pl-sub">{t('Guest', 'Гость')}</span>}
      </span>
    );
  };
  // one boat's result: DSQ or DNF, else her place and time
  const boat = (s: Sailor | null) => {
    if (!s) return '–';
    if (s.mark) return s.mark;
    if (s.place == null && s.secs == null) return '–';
    return [s.place == null ? null : ordinal(s.place, lang), s.secs == null ? null : clock(s.secs)].filter(Boolean).join(' ');
  };
  const side = (r: DuelRace, w: 'host' | 'guest' | null) => (w ? name(r[w]) : '–');
  const result = (r: DuelRace) => {
    if (r.state === 'abandoned' || r.state === 'no_result' || r.state === 'racing') return '–';
    if (r.forfeited) return t(`Forfeit: ${side(r, r.forfeited)}`, `Сдача: ${side(r, r.forfeited)}`);
    return `${boat(r.host)} / ${boat(r.guest)}`;
  };
  const lap = (n: number) => t(n === 1 ? '1 lap' : `${n} laps`, `${n} кр.`);
  const settings = (r: DuelRace) => [r.course && course(r.course), r.length && length(r.length), r.laps != null && lap(r.laps), r.start_min != null && t(`${r.start_min} min`, `${r.start_min} мин`), r.current && t('Current', 'Течение')].filter(Boolean).join(' · ');
  const where = (r: DuelRace) => (r.venue || r.yacht || r.wind ? [venue(r.venue), yacht(r.yacht), wind(r.wind)].join(' · ') : '–');

  const cols: Col[] = [
    { label: t('Where', 'Где'), asc: true }, { label: t('Host', 'Хозяин'), asc: true }, { label: t('Guest', 'Гость'), asc: true },
    { label: t('Winner', 'Победил'), asc: true }, { label: t('Result', 'Итог'), asc: true }, { label: t('Margin', 'Отрыв') },
    { label: t('Length', 'Длина') }, { label: t('State', 'Статус'), asc: true },
  ];
  const rows: Row[] = R.map((r) => ({
    key: r.id,
    name: when(r.at),
    sort: Date.parse(r.at),
    sub: `${r.code}${r.race_no > 1 ? ` · ${t('Race', 'Гонка')} ${r.race_no}` : ''}`,
    isNew: false,
    cells: [
      <span key="w" className="adm-pl-name">{where(r)}<span className="adm-pl-sub">{settings(r)}</span></span>,
      who(r.host), who(r.guest), side(r, r.winner), result(r),
      r.margin == null ? '–' : `${r.margin.toFixed(1)} ${t('s', 'с')}`, r.length_s == null ? '–' : clock(r.length_s), STATE[r.state],
    ],
    vals: [r.venue ? venue(r.venue) : null, plainName(r.host?.name)?.toLowerCase() ?? null, plainName(r.guest?.name)?.toLowerCase() ?? null,
      r.winner ? name(r[r.winner]).toLowerCase() : null, r.host?.place ?? null, r.margin, r.length_s, STATE[r.state]],
  }));

  const E = data.endings;
  const endings: [string, number][] = [[t('Both home', 'Оба финишировали'), E.both], [t('Forfeit', 'Сдача'), E.forfeit], [t('DSQ', 'DSQ'), E.dsq], [t('DNF', 'DNF'), E.dnf], [t('No winner', 'Без победителя'), E.no_winner]];
  const groupRows = (k: Duels['groups'][number]['k'], label: (v: string | null) => string) =>
    data.groups.filter((g) => g.k === k).map((g) => ({ key: `${k}-${g.v}`, name: label(g.v), cells: [String(g.n), pct(g.fin, g.n)] }));
  const head = [t('Races', 'Гонок'), t('Finished', 'Финиш')];
  // the database returns only the days that had races: the UTC days between the first and the last get an empty track
  const span = (() => {
    const out: { d: string; n: number; fin: number }[] = [], DAY = 864e5;
    const first = Date.parse(`${data.days[0]?.d}T00:00:00Z`), last = Date.parse(`${data.days[data.days.length - 1]?.d}T00:00:00Z`);
    if (!(last - first <= 3660 * DAY)) return data.days; // (a range that isn't one: drawn as it came)
    const by = new Map(data.days.map((d) => [d.d, d]));
    for (let at = first; at <= last; at += DAY) { const d = new Date(at).toISOString().slice(0, 10); out.push(by.get(d) ?? { d, n: 0, fin: 0 }); }
    return out.length >= data.days.length ? out : data.days;
  })();
  const slots: DaySlot[] = span.map((d) => ({ d: d.d, n: d.n, tip: [[t('Races', 'Гонок'), String(d.n)], [t('Finished', 'Финиш'), pct(d.fin, d.n)]] }));
  const PERIODS: { d: number | null; label: string }[] = [{ d: null, label: t('All time', 'Всё время') }, ...DUEL_DAYS.map((d) => ({ d, label: t(`${d} days`, `${d} дн.`) }))];

  return (
    <div className="adm adm-stats">
      <div className="adm-k">
        <IconCrew /><span className="kicker">{t('1-on-1 races', 'Гонки 1 на 1')}</span>
        <nav className="adm-range" aria-label={t('Period', 'Период')}>
          {PERIODS.map((p) => (
            <Link key={p.label} href={p.d ? `/admin/duels?days=${p.d}` : '/admin/duels'} scroll={false} aria-current={p.d === days ? 'page' : undefined} className={p.d === days ? 'on' : undefined}>{p.label}</Link>
          ))}
        </nav>
      </div>
      <div className="adm-tiles">
        <Tile k={t('Races', 'Гонок')} v={String(T.races)} />
        <Tile k={t('Finished', 'Финиш')} v={`${T.finished} · ${pct(T.finished, T.races)}`} />
        <Tile k={t('Abandoned', 'Брошено')} v={`${T.abandoned} · ${pct(T.abandoned, T.races)}`} />
        <Tile k={t('No result', 'Без итога')} v={`${T.no_result} · ${pct(T.no_result, T.races)}`} />
        <Tile k={t('Sailors', 'Гонщиков')} v={String(T.sailors)} />
        <Tile k={t('Signed in', 'С аккаунтом')} v={pct(T.signed, T.seats)} />
        <Tile k={t('Rematches', 'Реваншей')} v={String(T.rematches)} />
        <Tile k={t('Median race', 'Медиана гонки')} v={T.median == null ? '–' : clock(T.median)} />
      </div>
      {data.days.length > 0 && <DayChart lang={lang} title={t('Races a day', 'Гонок в день')} label={t('Races started each day', 'Гонок начато в каждый день')} slots={slots} />}
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('How the finished races ended', 'Чем закончились гонки')}</h3>
        <p className="hint">{endings.map(([k, n]) => `${k} ${n}`).join(' · ')}</p>
      </section>
      <Table title={t('By venue', 'По месту')} first={t('Venue', 'Место')} head={head} rows={groupRows('venue', (v) => (v ? venue(v) : t('Not kept', 'Не записано')))} />
      <Table title={t('By yacht', 'По яхте')} first={t('Yacht', 'Яхта')} head={head} rows={groupRows('yacht', yacht)} />
      <Table title={t('By wind', 'По ветру')} first={t('Wind', 'Ветер')} head={head} rows={groupRows('wind', wind)} />
      <Table title={t('By course', 'По дистанции')} first={t('Course', 'Дистанция')} head={head} rows={groupRows('course', course)} />
      <Table title={t('By start', 'По старту')} first={t('Start', 'Старт')} head={head} rows={groupRows('start', (v) => (v ? t(`${v} min`, `${v} мин`) : '–'))} />
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('Every race', 'Каждая гонка')}</h3>
        {R.length > 0 ? (
          <PlayersTable first={{ label: t('When', 'Когда') }} cols={cols} rows={rows} start={0}
            label={t('Every race', 'Каждая гонка')} newLabel="" />
        ) : <p className="hint">{t('No races in this period.', 'За этот период гонок нет.')}</p>}
        {data.more && <p className="hint">{t('The period has more races than the table holds: only the newest 1,000 are shown.', 'В периоде больше гонок, чем помещается в таблицу: показаны только последние 1000.')}</p>}
      </section>
      <p className="hint">{t('Races are counted by when they started. No result: a race still on after two hours with no end reported. Sailors: accounts, and guests by name, so a guest who changes name counts twice. Signed in: the share of seats sailed with an account. Rematches: races beyond the first on each code. Median race: the slower boat’s time over the finished races with a time. Times in UTC.',
        'Гонки считаются по времени старта. Без итога — гонка, идущая дольше двух часов без отчёта о конце. Гонщики — аккаунты и гости по имени, так что гость, сменивший имя, считается дважды. С аккаунтом — доля мест, на которых гонщик вошёл в аккаунт. Реванши — гонки сверх первой на каждом коде. Медиана — время более медленной лодки в завершённых гонках с временем. Время по UTC.')}</p>
    </div>
  );
}
