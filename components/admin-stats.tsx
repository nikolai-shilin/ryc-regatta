import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { SHAPE_NAME } from '@/lib/race';
import { IconDevice, IconTrophy } from './ui';

// The admin's look at the game: how the players race and how the game runs on their devices, over the last `days`
// (7, 30 or 90). Every race the game posts (public/game/stats.js → api/game.mjs in the iyt-test repo → public.game_races)
// is summed up by the database (regatta_admin_stats, supabase/migrations/20261117120000_game_races_perf.sql there), which
// answers an admin alone. A race's perf is how the game ran through it: the middle frame's rate (fps), the slow end's
// (the 95th percentile frame), the stalls (frames over 100 ms) a minute, the graphics level it ended on, the device.
// Drawn on the server, per request.
export const STAT_DAYS = [7, 30, 90] as const;

type Group = {
  k: string; v: string | null; n: number; fin: number; dsq: number; top3: number; who: number; down: number | null;
  np: number; fps: number | null; low: number | null; stall: number | null; load: number | null; slow: number; saver: number | null;
  qh: number; qm: number; ql: number;
};
type Day = { d: string; n: number; fin: number; who: number; fps: number | null };
export type Stats = { since: string; groups: Group[]; days: Day[] };

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const num = (x: number | null | undefined, k = 0) => (x == null ? '–' : x.toFixed(k));

export function AdminStats({ lang, days, stats, error }: { lang: Lang; days: number; stats: Stats | null; error?: string | null }) {
  const t = tx(lang), L = lang === 'ru' ? 1 : 0;
  const of = (k: string) => (stats?.groups || []).filter((g) => g.k === k);
  const all = of('all')[0];
  const yachtName = (id: string | null) => YACHTS.find((y) => y.id === id)?.name[L] ?? id ?? '–';
  const venueName = (id: string | null) => (id ? VENUES.find((v) => v.id === id)?.name[L] ?? id : t('Not kept (older races)', 'Не записано (старые гонки)'));
  const wind = (v: string | null) => ({ light: t('Light', 'Слабый'), medium: t('Medium', 'Средний'), strong: t('Strong', 'Сильный') }[v || ''] ?? '–');
  const shape = (v: string | null) => (v && v in SHAPE_NAME ? SHAPE_NAME[v as keyof typeof SHAPE_NAME][L] : v ?? '–');
  const dev = (v: string | null) => {
    const [d, tg] = (v || '').split(' ');
    const name = { phone: t('Phone', 'Телефон'), tablet: t('Tablet', 'Планшет'), desktop: t('Computer', 'Компьютер') }[d] ?? d;
    return tg ? `${name} · Telegram` : `${name} · ${t('browser', 'браузер')}`;
  };
  const level = (v: string | null) => ({ high: t('High', 'Высокая'), medium: t('Medium', 'Средняя'), low: t('Low', 'Низкая') }[v || ''] ?? '–');
  const plain = (v: string | null) => v ?? '–';

  const range = (
    <nav className="adm-range" aria-label={t('Period', 'Период')}>
      {STAT_DAYS.map((d) => (
        <Link key={d} href={`/admin?days=${d}`} scroll={false} aria-current={d === days ? 'page' : undefined} className={d === days ? 'on' : undefined}>
          {t(`${d} days`, `${d} дн.`)}
        </Link>
      ))}
    </nav>
  );

  if (!stats || !all) {
    return (
      <div className="adm adm-stats">
        <div className="adm-k"><IconTrophy /><span className="kicker">{t('The game in numbers', 'Игра в цифрах')}</span>{range}</div>
        <p className="hint">{error
          ? t(`The numbers didn’t load: ${error}`, `Цифры не загрузились: ${error}`)
          : t('No races in this period.', 'За этот период гонок нет.')}</p>
      </div>
    );
  }

  // the race tables: a group's races, how many finished, made the podium, were disqualified, and her median place
  const raceRows = (k: string, name: (v: string | null) => string, keep = (g: Group) => g.v != null) => of(k).filter(keep).map((g) => ({
    key: g.v ?? '–', name: name(g.v), cells: [String(g.n), pct(g.fin, g.n), pct(g.top3, g.fin), pct(g.dsq, g.n), g.down == null ? '–' : `${Math.round(100 * g.down)}%`, num(g.fps)],
  }));
  const raceHead = [t('Races', 'Гонок'), t('Finished', 'Финиш'), t('Top 3', 'Топ-3'), t('DSQ', 'DSQ'), t('Place', 'Место'), t('FPS', 'FPS')];
  // the device tables: the races measured, their median frame rates, how many ran under 30, stalls, the saver, the
  // level they ended on and the load
  const perfRows = (k: string, name: (v: string | null) => string, limit = 50) => of(k).filter((g) => g.v != null && g.np > 0).sort((a, b) => b.np - a.np).slice(0, limit).map((g) => ({
    key: g.v ?? '–', name: name(g.v),
    cells: [String(g.np), num(g.fps), num(g.low), pct(g.slow, g.np), num(g.stall, 1), g.saver == null ? '–' : `${Math.round(100 * g.saver)}%`,
      `${pct(g.qh, g.np)} / ${pct(g.qm, g.np)} / ${pct(g.ql, g.np)}`, g.load == null ? '–' : `${num(g.load, 1)} ${t('s', 'с')}`],
  }));
  const perfHead = [t('Races', 'Гонок'), t('FPS', 'FPS'), t('Slow 5%', 'Худшие 5%'), t('Under 30', 'Ниже 30'), t('Stalls/min', 'Рывков/мин'), t('Saver', 'Экономия'), t('High / Med / Low', 'Выс / Сред / Низ'), t('Load', 'Загрузка')];

  return (
    <>
      <div className="adm adm-stats">
        <div className="adm-k"><IconTrophy /><span className="kicker">{t('How they race', 'Как гоняются')}</span>{range}</div>
        <div className="adm-tiles">
          <Tile k={t('Races started', 'Гонок начато')} v={String(all.n)} />
          <Tile k={t('Finished', 'Дошли до финиша')} v={pct(all.fin, all.n)} />
          <Tile k={t('Players signed in', 'Игроков с аккаунтом')} v={String(all.who)} />
          <Tile k={t('Disqualified', 'Дисквалификаций')} v={pct(all.dsq, all.n)} />
        </div>
        <DayBars lang={lang} days={stats.days} since={stats.since} />
        <Table title={t('By yacht', 'По яхтам')} first={t('Yacht', 'Яхта')} head={raceHead} rows={raceRows('yacht', yachtName)} />
        <Table title={t('By wind', 'По ветру')} first={t('Wind', 'Ветер')} head={raceHead} rows={raceRows('wind', wind)} />
        <Table title={t('By venue', 'По месту')} first={t('Venue', 'Место')} head={raceHead} rows={raceRows('venue', venueName, () => true)} />
        <Table title={t('By course and race', 'По дистанции и виду гонки')} first={t('Course', 'Дистанция')} head={raceHead}
          rows={[...raceRows('shape', shape), ...raceRows('kind', (v) => (v === 'daily' ? t('Today’s race', 'Гонка дня') : t('Free race', 'Свободная гонка')))]} />
        <p className="hint">{t('Finished and DSQ: of the races started. Top 3: of the races finished. Place: the median, 0% first in the fleet, 100% last. FPS: the median frame rate of the races measured.',
          'Финиш и DSQ — от начатых гонок. Топ-3 — от финишировавших. Место — медиана: 0% — первым во флоте, 100% — последним. FPS — медианная частота кадров в измеренных гонках.')}</p>
      </div>
      <div className="adm adm-stats">
        <div className="adm-k"><IconDevice /><span className="kicker">{t('How the game runs', 'Как работает игра')}</span></div>
        <div className="adm-tiles">
          <Tile k={t('Races measured', 'Гонок измерено')} v={String(all.np)} />
          <Tile k={t('Median FPS', 'Медиана FPS')} v={num(all.fps)} />
          <Tile k={t('Under 30 FPS', 'Ниже 30 FPS')} v={pct(all.slow, all.np)} />
          <Tile k={t('Stalls a minute', 'Рывков в минуту')} v={num(all.stall, 1)} />
          <Tile k={t('To the first race', 'До первой гонки')} v={all.load == null ? '–' : `${num(all.load, 1)} ${t('s', 'с')}`} />
        </div>
        <Table title={t('By device', 'По устройству')} first={t('Device', 'Устройство')} head={perfHead} rows={perfRows('dev', dev)} />
        <Table title={t('By graphics chip', 'По видеочипу')} first={t('Chip', 'Чип')} head={perfHead} rows={perfRows('gpu', plain, 15)} />
        <Table title={t('By graphics level', 'По уровню графики')} first={t('Level', 'Уровень')} head={perfHead} rows={perfRows('q', level)} />
        <Table title={t('By system and browser', 'По системе и браузеру')} first={t('System', 'Система')} head={perfHead} rows={[...perfRows('os', plain), ...perfRows('br', plain)]} />
        <Table title={t('By venue', 'По месту')} first={t('Venue', 'Место')} head={perfHead} rows={perfRows('venue', venueName)} />
        <p className="hint">{t('Each race the game measures its frames: FPS is the middle frame’s rate, Slow 5% the rate of the slowest twentieth; a stall is a frame over 0.1 s. The level is the one a race ended on (Auto steps down on a slow device). Load: from opening the page to the first race. Races before 17 November weren’t measured.',
          'Игра измеряет кадры в каждой гонке: FPS — частота среднего кадра, «Худшие 5%» — частота самой медленной двадцатой части кадров; рывок — кадр дольше 0,1 с. Уровень — тот, на котором гонка закончилась (Авто понижает его на медленном устройстве). Загрузка — от открытия страницы до первой гонки. Гонки до 17 ноября не измерялись.')}</p>
      </div>
    </>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return <div className="adm-tile"><span className="adm-tile-k">{k}</span><b>{v}</b></div>;
}

function Table({ title, first, head, rows }: { title: string; first: string; head: string[]; rows: { key: string; name: string; cells: string[] }[] }) {
  if (!rows.length) return null;
  return (
    <section className="adm-tab">
      <h3 className="adm-tab-h">{title}</h3>
      <div className="adm-tab-scroll" tabIndex={0} role="region" aria-label={title}>
        <table>
          <thead><tr><th scope="col">{first}</th>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key + r.name}><th scope="row">{r.name}</th>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

// races started a day, one bar a UTC day of the period (a day without races is an empty slot); the finished share and
// the median frame rate in each bar's tooltip
function DayBars({ lang, days, since }: { lang: Lang; days: Day[]; since: string }) {
  const t = tx(lang);
  const from = Date.parse(since.slice(0, 10)), to = Date.parse(new Date().toISOString().slice(0, 10));
  const n = Math.max(1, Math.round((to - from) / 864e5) + 1), by = new Map(days.map((d) => [d.d, d]));
  const slots = Array.from({ length: n }, (_, i) => { const d = new Date(from + i * 864e5).toISOString().slice(0, 10); return { d, x: by.get(d) }; });
  const max = Math.max(1, ...days.map((d) => d.n));
  const W = 600, H = 120, gap = 2, bw = Math.max(1, W / n - gap);
  const date = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <figure className="adm-days">
      <figcaption className="adm-tab-h">{t('Races started a day', 'Гонок начато в день')} · {t('max', 'максимум')} {max}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Races started each day', 'Гонок начато в каждый день')}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="adm-days-base" />
        {slots.map((s, i) => {
          const h = s.x ? Math.max(2, (s.x.n / max) * (H - 4)) : 0, x = i * (W / n) + gap / 2;
          return (
            <g key={s.d}>
              <rect x={x} y={0} width={bw} height={H} className="adm-days-hit">
                <title>{`${date(s.d)}: ${s.x ? t(`${s.x.n} races, ${pct(s.x.fin, s.x.n)} finished, ${s.x.who} players, ${num(s.x.fps)} FPS`, `${s.x.n} гонок, финиш ${pct(s.x.fin, s.x.n)}, игроков ${s.x.who}, ${num(s.x.fps)} FPS`) : t('no races', 'гонок нет')}`}</title>
              </rect>
              {h > 0 && <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} className="adm-days-bar" />}
            </g>
          );
        })}
      </svg>
      <div className="adm-days-t"><span>{date(slots[0].d)}</span><span>{date(slots[slots.length - 1].d)}</span></div>
    </figure>
  );
}
