import Link from 'next/link';
import type { ReactNode } from 'react';
import { pick, LOCALE, tx, type Lang } from '@/lib/lang';
import { plainName } from '@/lib/name';
import { SHAPE_NAME } from '@/lib/race';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { PlayersTable, type Col, type Row } from './admin-players-table';
import { Tile } from './admin-stats';
import { IconBack, IconClock, IconCrew, clock } from './ui';

// What went wrong for whom, on /admin/logs, over the last `days`, from the database's regatta_admin_logs
// (supabase/migrations/20261118150000_regatta_admin_logs.sql in the iyt-test repo), which answers an admin alone. First
// the players with a problem, the latest first; ?who= opens one player's report: each visit of the game's page with
// the races sailed in it, the visits and races with a problem open. A problem is a load that failed or was given up,
// the 3D lost, an error on the page, a race under SLOW frames a second, or one rated two stars or fewer. Drawn on the
// server, per request.
type Num = number | null;
type Kind = 'tg' | 'acct' | 'guest';
export type LogPerson = {
  who: string; kind: Kind; name: string | null; handle: string | null; last: string | null; visits: number; bad: number;
  failed: number; gave_up: number; lost: number; errors: number; slow: number; low: number; dev: string | null;
};
export type LogVisit = {
  id: string; at: string; kind: string | null; ref: string | null; tg: Num; dev: string | null; load: Num; loaded_at: string | null;
  failed_at: string | null; why: string | null; gave_up_at: string | null; pct: Num; last_at: string | null; races: Num; finished: Num;
  mins: Num; howto: Num; drill: Num; lost: Num; errors: { m: string; src?: string | null; n?: number }[] | null;
};
type Perf = { fps?: number; low?: number; stall?: number; secs?: number; q0?: string; q?: string; gfx?: string; saver?: number; dev?: string; tg?: number;
  os?: string; br?: string; dpr?: number; cores?: number; mem?: number; gpu?: string; w?: number; h?: number; load?: number };
type Ended = { how?: string; leg?: number; legs?: number; clock?: number; place?: number; boats?: number; inc?: Record<string, number>; last?: string; ago?: number; pens?: number; mins?: number };
export type LogRace = {
  id: string; visit: string | null; at: string; finished_at: string | null; wind: string | null; laps: Num; length: string | null; boats: Num; place: Num;
  secs: Num; dsq: boolean | null; daily: string | null; shape: string | null; yacht: string | null; venue: string | null; perf: Perf | null; ended: Ended | null;
  rating: Num; comment: string | null;
};
export type LogReport = { who: string; kind: Kind | null; name: string | null; handle: string | null; first: string | null; last: string | null; visits: LogVisit[]; races: LogRace[] };
export type Logs = {
  since: string; people: LogPerson[]; report: LogReport | null;
  totals: { visits: number; bad: number; failed: number; gave_up: number; lost: number; errors: number; slow: number; low: number; people: number };
};

// the frame rate a race counts as slow under, as the database counts it
const SLOW = 24;
const MAX_VISITS = 100, MAX_RACES = 200;

// a player's id from the address: a Telegram user's number, or an account's or a browser's uuid
export const pickWho = (q?: string) => (q && /^(\d{1,18}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(q) ? q.toLowerCase() : null);
export const logHref = (who: string | null, days: number) => {
  const q = [who && `who=${encodeURIComponent(who)}`, days !== 30 && `days=${days}`].filter(Boolean).join('&');
  return q ? `/admin/logs?${q}` : '/admin/logs';
};

const hasErrors = (v: LogVisit) => Array.isArray(v.errors) && v.errors.length > 0;
const visitBad = (v: LogVisit) => !!v.failed_at || !!v.gave_up_at || v.lost === 1 || hasErrors(v);
const raceSlow = (r: LogRace) => typeof r.perf?.fps === 'number' && r.perf.fps < SLOW;
const raceLow = (r: LogRace) => r.rating != null && r.rating <= 2;
const raceBad = (r: LogRace) => raceSlow(r) || raceLow(r);

function words(lang: Lang) {
  const t = tx(lang);
  const of = (m: Record<string, string>, k: string | null | undefined) => (k ? m[k] ?? k : null);
  return {
    t,
    when: (s: string) => new Date(s).toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    kind: (k: Kind | null) => of({ tg: 'Telegram', acct: t('Site account', 'Аккаунт на сайте', 'Cuenta del sitio'), guest: t('Guest', 'Гость', 'Invitado') }, k),
    dev: (v: string | null | undefined) => {
      if (!v) return null;
      const [d, tg] = v.split(' ');
      const name = of({ phone: t('Phone', 'Телефон', 'Móvil'), tablet: t('Tablet', 'Планшет', 'Tableta'), desktop: t('Computer', 'Компьютер', 'Ordenador') }, d);
      return tg ? `${name} · Telegram` : name;
    },
    ref: (k: string | null) => of({ tg: 'Telegram', site: t('The site', 'С сайта', 'El sitio'), other: t('Another site', 'Другой сайт', 'Otro sitio'), direct: t('Direct', 'Напрямую', 'Directo') }, k),
    race: (k: string | null) => of({ today: t('Today’s race', 'Гонка дня', 'La regata del día'), free: t('Custom race', 'Своя гонка', 'Regata personalizada'), match: t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1'), drill: t('Drill', 'Упражнение', 'Ejercicio') }, k),
    how: (k: string | undefined) => of({ finish: t('Finished', 'Финиш', 'Terminada'), restart: t('Restarted', 'Перезапуск', 'Reinicio'), change: t('Back to the set-up', 'Назад к настройке', 'Volver al ajuste'), menu: t('Back to the menu', 'Назад в меню', 'Volver al menú'),
      close: t('Closed the page', 'Страница закрыта', 'Cerró la página'), hidden: t('Put the page away', 'Страница свёрнута', 'Dejó la página en segundo plano'), new: t('Began another race', 'Начата другая гонка', 'Empezó otra regata') }, k),
    incident: (k: string | undefined) => of({ ocs: t('Over early', 'Фальстарт', 'Salida adelantada'), fouled: t('Foul', 'Нарушение', 'Infracción'), touched: t('Touched a mark', 'Касание знака', 'Tocó una baliza'), bump: t('Collision', 'Столкновение', 'Colisión'),
      aground: t('Aground', 'На мели', 'Varado'), missedLine: t('Missed the line', 'Мимо линии', 'Se pasó de la línea'), missedGate: t('Missed the gate', 'Мимо ворот', 'Se pasó de la puerta'), wrongSide: t('Wrong side', 'Не с той стороны', 'Lado equivocado'),
      genRecall: t('General recall', 'Общий отзыв', 'Llamada general'), barging: t('Barging', 'Навал на старте', 'Abordaje en la salida') }, k),
    wind: (k: string | null) => of({ light: t('Light', 'Слабый', 'Flojo'), medium: t('Medium', 'Средний', 'Medio'), strong: t('Strong', 'Сильный', 'Fuerte') }, k),
    level: (k: string | undefined) => of({ auto: t('Auto', 'Авто', 'Auto'), high: t('High', 'Высокая', 'Alto'), medium: t('Medium', 'Средняя', 'Media'), low: t('Low', 'Низкая', 'Bajo') }, k),
    yacht: (id: string | null) => pick(YACHTS.find((y) => y.id === (id ?? 'jpk1050'))?.name, lang) ?? id,
    venue: (id: string | null) => (id ? pick(VENUES.find((v) => v.id === id)?.name, lang) ?? id : null),
    shape: (v: string | null) => (v && v in SHAPE_NAME ? pick(SHAPE_NAME[v as keyof typeof SHAPE_NAME], lang) : v),
  };
}
type W = ReturnType<typeof words>;

const playerName = (w: W, p: { who: string; kind: Kind | null; name: string | null }) => plainName(p.name) || (p.kind === 'tg' || p.kind === 'acct' ? w.kind(p.kind)! : `${w.t('Guest', 'Гость', 'Invitado')} ${p.who.slice(0, 4)}`);
const playerSub = (w: W, p: { kind: Kind | null; handle: string | null }) => `${w.kind(p.kind) ?? ''}${p.handle ? ` · ${p.kind === 'tg' ? '@' : ''}${p.handle}` : ''}`;
const cell = (n: number) => (n ? String(n) : '–');

function Flag({ bad, children }: { bad?: boolean; children: ReactNode }) {
  return <span className={bad ? 'adm-log-f bad' : 'adm-log-f'}>{children}</span>;
}

// what was kept of something, the facts it has
function Facts({ rows }: { rows: [string, string | number | null | undefined][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== '');
  if (!shown.length) return null;
  return <dl className="adm-log-d">{shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function RaceEntry({ w, race: r }: { w: W; race: LogRace }) {
  const { t } = w, e = r.ended, p = r.perf, bad = raceBad(r);
  const outcome = r.dsq ? 'DSQ' : r.finished_at && r.place != null ? `${r.place}/${r.boats ?? '–'}${r.secs != null ? ` · ${clock(r.secs)}` : ''}` : w.how(e?.how) ?? t('No end recorded', 'Конец не записан', 'Sin final registrado');
  const incidents = e?.inc ? Object.entries(e.inc).map(([k, n]) => `${w.incident(k)} × ${n}`).join(', ') : null;
  return (
    <li className={bad ? 'adm-log-i bad' : 'adm-log-i'}>
      <details open={bad}>
        <summary>
          <time dateTime={r.at}>{w.when(r.at)}</time>
          <b className="adm-log-h">{[w.venue(r.venue), w.yacht(r.yacht)].filter(Boolean).join(' · ')}</b>
          <span className="adm-log-o">{outcome}</span>
          {raceSlow(r) && <Flag bad>{p!.fps} FPS</Flag>}
          {raceLow(r) && <Flag bad>{t(`Rated ${r.rating} of 5`, `Оценка ${r.rating} из 5`, `Valorada ${r.rating} de 5`)}</Flag>}
        </summary>
        {r.comment && <p className="adm-log-say">{r.comment}</p>}
        <Facts rows={[
          [t('Kind of race', 'Тип гонки', 'Tipo de regata'), r.daily ? t('Today’s race', 'Гонка дня', 'La regata del día') : t('Custom race', 'Своя гонка', 'Regata personalizada')],
          [t('Wind', 'Ветер', 'Viento'), w.wind(r.wind)],
          [t('Course', 'Дистанция', 'Recorrido'), [w.shape(r.shape), r.laps != null ? t(`${r.laps} laps`, `Кругов: ${r.laps}`, `${r.laps} ${r.laps === 1 ? 'vuelta' : 'vueltas'}`) : null].filter(Boolean).join(' · ')],
          [t('Boats', 'Яхт', 'Barcos'), r.boats],
          [t('How it ended', 'Как закончилась', 'Cómo terminó'), w.how(e?.how)],
          [t('Leg', 'Отрезок', 'Tramo'), e?.leg != null ? `${e.leg}${e.legs != null ? `/${e.legs}` : ''}` : null],
          [t('Race clock', 'Часы гонки', 'Reloj de regata'), e?.clock != null ? clock(Math.max(0, e.clock)) : null],
          [t('Place then', 'Место на тот момент', 'Puesto entonces'), e?.place != null ? `${e.place}/${e.boats ?? '–'}` : null],
          [t('Minutes in the race', 'Минут в гонке', 'Minutos en la regata'), e?.mins],
          [t('Penalties', 'Штрафы', 'Penalizaciones'), e?.pens || null],
          [t('Incidents', 'Происшествия', 'Incidentes'), incidents],
          [t('Last incident', 'Последнее происшествие', 'Último incidente'), e?.last ? `${w.incident(e.last)}${e.ago != null ? t(`, ${e.ago} s before the end`, `, за ${e.ago} с до конца`, `, ${e.ago} s antes del final`) : ''}` : null],
          [t('Frame rate', 'Частота кадров', 'Fotogramas por segundo'), p?.fps != null ? `${p.fps} FPS${p.low != null ? t(`, slowest 5% ${p.low}`, `, худшие 5% — ${p.low}`, `, el 5 % más lento ${p.low}`) : ''}` : null],
          [t('Stalls a minute', 'Рывков в минуту', 'Tirones por minuto'), p?.stall],
          [t('Graphics', 'Графика', 'Gráficos'), p?.q ? `${p.q0 && p.q0 !== p.q ? `${w.level(p.q0)} → ` : ''}${w.level(p.q)}${p.gfx ? ` (${w.level(p.gfx)})` : ''}` : null],
          [t('Battery saver', 'Экономия батареи', 'Ahorro de batería'), p?.saver ? t('On', 'Вкл.', 'Sí') : null],
          [t('Device', 'Устройство', 'Dispositivo'), p ? [w.dev(p.dev ? `${p.dev}${p.tg ? ' tg' : ''}` : null), p.os, p.br].filter(Boolean).join(' · ') : null],
          [t('Graphics chip', 'Видеочип', 'Chip gráfico'), p?.gpu],
          [t('Screen', 'Экран', 'Pantalla'), p?.w && p?.h ? `${p.w}×${p.h}${p.dpr ? ` @${p.dpr}x` : ''}` : null],
          [t('Cores and memory', 'Ядра и память', 'Núcleos y memoria'), p?.cores ? `${p.cores}${p.mem ? t(` · ${p.mem} GB`, ` · ${p.mem} ГБ`, ` · ${p.mem} GB`) : ''}` : null],
        ]} />
      </details>
    </li>
  );
}

function VisitEntry({ w, visit: v, races }: { w: W; visit: LogVisit; races: LogRace[] }) {
  const { t } = w, bad = visitBad(v), errors = hasErrors(v) ? v.errors! : [];
  return (
    <li className={bad ? 'adm-log-i bad' : 'adm-log-i'}>
      <details open={bad || races.some(raceBad)}>
        <summary>
          <time dateTime={v.at}>{w.when(v.at)}</time>
          <b className="adm-log-h">{[t('Visit', 'Визит', 'Visita'), w.dev(v.dev ? `${v.dev}${v.tg === 1 ? ' tg' : ''}` : null)].filter(Boolean).join(' · ')}</b>
          {v.failed_at && <Flag bad>{t('Load failed', 'Не загрузилась', 'Fallo de carga')}</Flag>}
          {v.gave_up_at && <Flag bad>{v.pct != null ? t(`Gave up at ${v.pct}%`, `Бросил на ${v.pct}%`, `Se fue al ${v.pct} %`) : t('Gave up loading', 'Бросил загрузку', 'Dejó la carga')}</Flag>}
          {v.lost === 1 && <Flag bad>{t('3D lost', '3D потеряно', '3D perdido')}</Flag>}
          {errors.length > 0 && <Flag bad>{t(`Errors: ${errors.length}`, `Ошибок: ${errors.length}`, `Errores: ${errors.length}`)}</Flag>}
          {!bad && <Flag>{t('No problem', 'Без проблем', 'Sin problemas')}</Flag>}
        </summary>
        {v.why && <p className="adm-log-say">{v.why}</p>}
        {errors.length > 0 && (
          <ul className="adm-log-errs">
            {errors.map((e, i) => <li key={i}><code>{e.m}</code><span>{[e.src, e.n && e.n > 1 ? `× ${e.n}` : null].filter(Boolean).join(' ')}</span></li>)}
          </ul>
        )}
        <Facts rows={[
          [t('Came from', 'Откуда пришёл', 'De dónde vino'), w.ref(v.ref)],
          [t('Opened for', 'Открыл для', 'Abrió para'), w.race(v.kind)],
          [t('Load time', 'Загрузка', 'Tiempo de carga'), v.load != null ? t(`${v.load} s`, `${v.load} с`, `${v.load} s`) : null],
          [t('Minutes on the page', 'Минут на странице', 'Minutos en la página'), v.mins],
          [t('Races begun', 'Гонок начато', 'Regatas empezadas'), v.races],
          [t('Races finished', 'Гонок закончено', 'Regatas terminadas'), v.finished],
          [t('Last heard from', 'Последний сигнал', 'Última señal'), v.last_at ? w.when(v.last_at) : null],
          [t('How to play opened', 'Открывал «Как играть»', 'Abrió «Cómo se juega»'), v.howto === 1 ? t('Yes', 'Да', 'Sí') : null],
        ]} />
        {races.length > 0 && <ol className="adm-log adm-log-in">{races.map((r) => <RaceEntry key={r.id} w={w} race={r} />)}</ol>}
      </details>
    </li>
  );
}

// one player's report: their visits, each with its races, and the races whose visit wasn't kept, the latest first
function Report({ w, report: r, days }: { w: W; report: LogReport; days: number }) {
  const { t } = w, ids = new Set(r.visits.map((v) => v.id));
  const entries = [
    ...r.visits.map((v) => ({ at: v.at, key: v.id, el: <VisitEntry key={v.id} w={w} visit={v} races={r.races.filter((x) => x.visit === v.id)} /> })),
    ...r.races.filter((x) => !x.visit || !ids.has(x.visit)).map((x) => ({ at: x.at, key: x.id, el: <RaceEntry key={x.id} w={w} race={x} /> })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <div className="adm adm-stats">
      <Link className="adm-log-back" href={logHref(null, days)}><IconBack s={16} />{t('All players with problems', 'Все игроки с проблемами', 'Todos los jugadores con problemas')}</Link>
      <div className="adm-k"><IconCrew /><span className="kicker">{t('Player’s log', 'Журнал игрока', 'Registro del jugador')}</span></div>
      <h2 className="adm-log-who">{playerName(w, r)}</h2>
      <p className="adm-pl-sub">{playerSub(w, r)}{r.first ? ` · ${t('first seen', 'впервые', 'visto por primera vez')} ${w.when(r.first)}` : ''}{r.last ? ` · ${t('last seen', 'был', 'visto por última vez')} ${w.when(r.last)}` : ''}</p>
      <div className="adm-tiles adm-log-tiles">
        <Tile k={t('Visits', 'Визитов', 'Visitas')} v={String(r.visits.length)} />
        <Tile k={t('With a problem', 'С проблемой', 'Con un problema')} v={String(r.visits.filter(visitBad).length)} />
        <Tile k={t('Races', 'Гонок', 'Regatas')} v={String(r.races.length)} />
        <Tile k={t('Slow races', 'Медленных гонок', 'Regatas lentas')} v={String(r.races.filter(raceSlow).length)} />
        <Tile k={t('Low ratings', 'Низких оценок', 'Valoraciones bajas')} v={String(r.races.filter(raceLow).length)} />
      </div>
      {entries.length ? <ol className="adm-log">{entries.map((e) => e.el)}</ol> : <p className="hint">{t('Nothing recorded for this player in this period.', 'За этот период у игрока ничего не записано.', 'Nada registrado para este jugador en este periodo.')}</p>}
      <p className="hint">{t(`Times in UTC. A visit keeps its first five different errors, each cut to 140 characters.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Only the latest ${MAX_VISITS} visits and ${MAX_RACES} races are shown.` : ''}`,
        `Время по UTC. Визит хранит первые пять разных ошибок, каждая обрезана до 140 знаков.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Показаны только последние ${MAX_VISITS} визитов и ${MAX_RACES} гонок.` : ''}`, `Horas en UTC. Una visita guarda sus cinco primeros errores distintos, cada uno cortado a 140 caracteres.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Solo se muestran las últimas ${MAX_VISITS} visitas y las últimas ${MAX_RACES} regatas.` : ''}`)}</p>
    </div>
  );
}

// the players with a problem in the period, the latest first
function People({ w, data, days }: { w: W; data: Logs; days: number }) {
  const { t } = w, T = data.totals;
  const cols: Col[] = [
    { label: t('Failed', 'Сбой', 'Fallo') }, { label: t('Gave up', 'Бросил', 'Se fue') }, { label: t('3D lost', '3D', '3D perdido') }, { label: t('Errors', 'Ошибки', 'Errores') },
    { label: t('Slow', 'Медленно', 'Lento') }, { label: t('Low rating', 'Оценка', 'Valoración baja') }, { label: t('Device', 'Устройство', 'Dispositivo'), asc: true }, { label: t('Last problem', 'Последняя проблема', 'Último problema') },
  ];
  // a count of none sorts as nothing, so the players who have that problem stay on top whichever way the column is turned
  const rows: Row[] = data.people.map((p) => {
    const counts = [p.failed, p.gave_up, p.lost, p.errors, p.slow, p.low];
    return {
      key: p.who, href: logHref(p.who, days), name: playerName(w, p), sub: playerSub(w, p), isNew: false,
      cells: [...counts.map(cell), w.dev(p.dev) ?? '–', p.last ? w.when(p.last) : '–'],
      vals: [...counts.map((n) => n || null), w.dev(p.dev), p.last ? Date.parse(p.last) : null],
    };
  });
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconClock /><span className="kicker">{t('Players with problems', 'Игроки с проблемами', 'Jugadores con problemas')}</span></div>
      <div className="adm-tiles adm-log-tiles">
        <Tile k={t('Players affected', 'Игроков затронуто', 'Jugadores afectados')} v={String(T.people)} />
        <Tile k={t('Visits with a problem', 'Визитов с проблемой', 'Visitas con problema')} v={`${T.bad}/${T.visits}`} />
        <Tile k={t('Loads failed', 'Не загрузилось', 'Cargas fallidas')} v={String(T.failed)} />
        <Tile k={t('Loads given up', 'Брошено загрузок', 'Cargas abandonadas')} v={String(T.gave_up)} />
        <Tile k={t('3D lost', '3D потеряно', '3D perdido')} v={String(T.lost)} />
        <Tile k={t('Page errors', 'Ошибок на странице', 'Errores de página')} v={String(T.errors)} />
        <Tile k={t('Slow races', 'Медленных гонок', 'Regatas lentas')} v={String(T.slow)} />
        <Tile k={t('Low ratings', 'Низких оценок', 'Valoraciones bajas')} v={String(T.low)} />
      </div>
      {data.people.length > 0 ? (
        <section className="adm-tab">
          <h3 className="adm-tab-h">{t('Open a player for their full log, or click a column to sort by it', 'Откройте игрока, чтобы увидеть весь журнал, или нажмите на столбец, чтобы отсортировать', 'Abre un jugador para ver su registro completo, o pulsa una columna para ordenar')}</h3>
          <PlayersTable first={{ label: t('Player', 'Игрок', 'Jugador'), asc: true }} cols={cols} rows={rows} start={cols.length}
            label={t('Players with problems', 'Игроки с проблемами', 'Jugadores con problemas')} newLabel={t('New', 'Новый', 'Nuevo')} />
        </section>
      ) : <p className="hint">{t('No player had a problem in this period.', 'За этот период проблем ни у кого не было.', 'Ningún jugador tuvo problemas en este periodo.')}</p>}
      <p className="hint">{t(`A problem is a load that failed or was given up, the 3D lost, an error on the page, a race under ${SLOW} frames a second, or one rated two stars or fewer. A guest is a browser. Times in UTC. The latest 200 players are shown.`,
        `Проблема — это сбой или брошенная загрузка, потеря 3D, ошибка на странице, гонка ниже ${SLOW} кадров в секунду или оценка в две звезды и ниже. Гость — это браузер. Время по UTC. Показаны последние 200 игроков.`, `Un problema es una carga que falló o se abandonó, el 3D perdido, un error en la página, una regata por debajo de ${SLOW} fotogramas por segundo o una valorada con dos estrellas o menos. Un invitado es un navegador. Horas en UTC. Se muestran los últimos 200 jugadores.`)}</p>
    </div>
  );
}

export function AdminLogs({ lang, data, days }: { lang: Lang; data: Logs; days: number }) {
  const w = words(lang);
  return data.report ? <Report w={w} report={data.report} days={days} /> : <People w={w} data={data} days={days} />;
}
