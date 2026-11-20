import Link from 'next/link';
import { pick, LOCALE, tx, type Lang } from '@/lib/lang';
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
// how the race ran on that sailor's screen, as the game reported it (lib/duel-log.ts Perf); null when it didn't
export type Perf = { fps: number; low: Num; stall: Num; secs: number; q: string | null; gfx: string | null; saver: 0 | 1; dev: string | null; os: string | null; br: string | null;
  gpu: string | null; cores: Num; mem: Num; net: { rtt: Num; late: Num } | null };
export type Sailor = { name: string | null; who: string | null; kind: 'tg' | 'acct' | 'guest'; handle: string | null; place: Num; secs: Num; mark: string | null; pens: Num; perf?: Perf | null };
export type DuelRace = {
  id: string; code: string; race_no: number; at: string; ended: string | null; state: 'racing' | 'finished' | 'abandoned' | 'no_result';
  venue: string | null; yacht: string | null; wind: string | null; length: string | null; course: string | null; laps: Num; start_min: Num;
  current: boolean | null; daytime: string | null; winner: 'host' | 'guest' | null; margin: Num; forfeited: 'host' | 'guest' | null;
  recalls: Num; prep_flag: string | null; length_s: Num; host: Sailor | null; guest: Sailor | null;
};
export type Duels = {
  since: string | null; more: boolean;
  totals: { races: number; finished: number; abandoned: number; no_result: number; sailors: number; seats: number; signed: number; rematches: number; median: Num; perf_seats?: number; slow_seats?: number };
  days: { d: string; n: number; fin: number }[];
  endings: { forfeit: number; no_winner: number; dnf: number; dsq: number; both: number };
  groups: { k: 'venue' | 'yacht' | 'wind' | 'course' | 'start'; v: string | null; n: number; fin: number }[];
  races: DuelRace[];
};

// the period filter: 7, 30 or 90 days (?days=), else all time
export const DUEL_DAYS = [90, 30, 7] as const;
export const pickDuelDays = (q?: string): number | null => ((DUEL_DAYS as readonly number[]).includes(Number(q)) ? Number(q) : null);

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
// a screen that ran slow: its slow end under 20 fps, or two stalls (frames over 100 ms) a minute or more
export const slowScreen = (p: Perf) => (p.low != null && p.low < 20) || (p.stall != null && p.stall >= 2);
const ordinal = (n: number, lang: Lang) => (lang === 'ru' ? `${n}-е` : lang === 'es' ? `${n}.º` : lang === 'fr' ? (n === 1 ? '1er' : `${n}e`) : lang === 'de' || lang === 'tr' ? `${n}.` : ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`);

export function AdminDuels({ lang, data, days }: { lang: Lang; data: Duels; days: number | null }) {
  const t = tx(lang), T = data.totals, R = data.races;
  const when = (s: string) => new Date(s).toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const venue = (v: string | null) => (v ? pick(VENUES.find((x) => x.id === v)?.name, lang) ?? v : '–');
  const yacht = (v: string | null) => (v ? pick(YACHTS.find((x) => x.id === v)?.name, lang) ?? v : '–');
  const wind = (v: string | null) => ({ light: t('Light', 'Слабый', 'Flojo', 'Leicht', 'Hafif', 'Léger'), medium: t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta', 'Moyen'), strong: t('Strong', 'Сильный', 'Fuerte', 'Stark', 'Kuvvetli', 'Fort') }[v ?? ''] ?? v ?? '–');
  const course = (v: string | null) => (v && v in SHAPE_NAME ? pick(SHAPE_NAME[v as keyof typeof SHAPE_NAME], lang) : v ?? '–');
  const length = (v: string | null) => ({ short: t('Short', 'Короткая', 'Corta', 'Kurz', 'Kısa', 'Courte'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta', 'Moyenne'), long: t('Long', 'Длинная', 'Larga', 'Lang', 'Uzun', 'Longue') }[v ?? ''] ?? v ?? '–');
  const STATE = { racing: t('Racing', 'Идёт', 'En regata', 'Unterwegs', 'Yarışıyor', 'En course'), finished: t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée'), abandoned: t('Abandoned', 'Брошена', 'Abandonada', 'Abgebrochen', 'Terk edildi', 'Abandonnée'), no_result: t('No result', 'Без итога', 'Sin resultado', 'Kein Ergebnis', 'Sonuç yok', 'Pas de résultat') };
  const name = (s: Sailor | null) => (s ? plainName(s.name) ?? (s.kind === 'guest' ? t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité') : '–') : '–');
  const who = (s: Sailor | null) => {
    if (!s || (!s.who && plainName(s.name) == null)) return <span>–</span>;
    return (
      <span className="adm-pl-name">
        {s.who ? <Link className="adm-pl-link" href={logHref(s.who, days ?? 30)}>{name(s)}</Link> : name(s)}
        {s.kind === 'guest' && <span className="adm-pl-sub">{t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité')}</span>}
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
    if (r.forfeited) return t(`Forfeit: ${side(r, r.forfeited)}`, `Сдача: ${side(r, r.forfeited)}`, `Retirada: ${side(r, r.forfeited)}`, `Aufgabe: ${side(r, r.forfeited)}`, `Çekilme: ${side(r, r.forfeited)}`, `Forfait : ${side(r, r.forfeited)}`);
    return `${boat(r.host)} / ${boat(r.guest)}`;
  };
  const lap = (n: number) => t(n === 1 ? '1 lap' : `${n} laps`, `${n} кр.`, n === 1 ? '1 vuelta' : `${n} vueltas`, n === 1 ? '1 Runde' : `${n} Runden`, `${n} tur`, n === 1 ? '1 tour' : `${n} tours`);
  const settings = (r: DuelRace) => [r.course && course(r.course), r.length && length(r.length), r.laps != null && lap(r.laps), r.start_min != null && t(`${r.start_min} min`, `${r.start_min} мин`, `${r.start_min} min`, `${r.start_min} Min.`, `${r.start_min} dk`, `${r.start_min} min`), r.current && t('Current', 'Течение', 'Corriente', 'Strömung', 'Akıntı', 'En cours')].filter(Boolean).join(' · ');
  // how the race ran on a sailor's screen: the middle frame's rate, and below it the slow end's, the stalls, the way to the
  // other screen and back (the guest's), the late messages and the device; the whole in the tooltip
  const screen = (s: Sailor | null) => {
    const p = s?.perf;
    if (!p) return <span>–</span>;
    const net = p.net, sys = [p.os, p.br].filter(Boolean).join('/');
    const sub = [p.low != null && t(`low ${Math.round(p.low)}`, `мин. ${Math.round(p.low)}`, `mín. ${Math.round(p.low)}`, `niedrig ${Math.round(p.low)}`, `düşük ${Math.round(p.low)}`, `min ${Math.round(p.low)}`), p.stall != null && p.stall > 0 && t(`${p.stall}/min stalls`, `${p.stall}/мин рывков`, `${p.stall}/min tirones`, `${p.stall}/Min. Ruckler`, `${p.stall}/dk takılma`, `${p.stall}/min saccades`),
      net?.rtt != null && `${net.rtt} ${t('ms', 'мс', 'ms', 'ms', 'ms', 'ms')}`, net?.late != null && net.late > 0 && t(`${net.late}/min late`, `${net.late}/мин поздно`, `${net.late}/min tarde`, `${net.late}/Min. verspätet`, `${net.late}/dk geç`, `${net.late}/min en retard`)].filter(Boolean).join(' · ');
    const tip = [sys, p.gpu, p.cores != null && t(`${p.cores} cores`, `${p.cores} ядер`, `${p.cores} núcleos`, `${p.cores} Kerne`, `${p.cores} çekirdek`, `${p.cores} cœurs`), p.mem != null && `${p.mem} GB`, p.q && t(`graphics ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `графика ${p.q}${p.gfx === 'auto' ? ' (авто)' : ''}`, `gráficos ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `Grafik ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `grafik ${p.q}${p.gfx === 'auto' ? ' (otomatik)' : ''}`, `graphismes ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`),
      p.saver ? t('battery saver', 'экономия батареи', 'ahorro de batería', 'Energiesparmodus', 'pil tasarrufu', 'économie de batterie') : null].filter(Boolean).join(' · ');
    return (
      <span className="adm-pl-name" title={tip}>
        <span style={slowScreen(p) ? { color: 'var(--warn)' } : undefined}>{Math.round(p.fps)} fps</span>
        <span className="adm-pl-sub">{sub || sys || '–'}</span>
      </span>
    );
  };
  const where = (r: DuelRace) => (r.venue || r.yacht || r.wind ? [venue(r.venue), yacht(r.yacht), wind(r.wind)].join(' · ') : '–');

  const cols: Col[] = [
    { label: t('Where', 'Где', 'Dónde', 'Wo', 'Nerede', 'Où'), asc: true }, { label: t('Host', 'Хозяин', 'Anfitrión', 'Gastgeber', 'Ev sahibi', 'Hôte'), asc: true }, { label: t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité'), asc: true },
    { label: t('Winner', 'Победил', 'Ganador', 'Sieger', 'Kazanan', 'Vainqueur'), asc: true }, { label: t('Result', 'Итог', 'Resultado', 'Ergebnis', 'Sonuç', 'Résultat'), asc: true }, { label: t('Margin', 'Отрыв', 'Diferencia', 'Abstand', 'Fark', 'Écart') },
    { label: t('Length', 'Длина', 'Duración', 'Länge', 'Uzunluk', 'Durée') }, { label: t('State', 'Статус', 'Estado', 'Status', 'Durum', 'État'), asc: true },
    { label: t('Host’s screen', 'Экран хозяина', 'Pantalla del anfitrión', 'Bildschirm des Gastgebers', 'Ev sahibinin ekranı', 'Écran de l’hôte') }, { label: t('Guest’s screen', 'Экран гостя', 'Pantalla del invitado', 'Bildschirm des Gastes', 'Konuğun ekranı', 'Écran de l’invité') },
  ];
  const rows: Row[] = R.map((r) => ({
    key: r.id,
    name: when(r.at),
    sort: Date.parse(r.at),
    sub: `${r.code}${r.race_no > 1 ? ` · ${t('Race', 'Гонка', 'Regata', 'Regatta', 'Yarış', 'Régate')} ${r.race_no}` : ''}`,
    isNew: false,
    cells: [
      <span key="w" className="adm-pl-name">{where(r)}<span className="adm-pl-sub">{settings(r)}</span></span>,
      who(r.host), who(r.guest), side(r, r.winner), result(r),
      r.margin == null ? '–' : `${r.margin.toFixed(1)} ${t('s', 'с', 's', 's', 'sn', 's')}`, r.length_s == null ? '–' : clock(r.length_s), STATE[r.state],
      screen(r.host), screen(r.guest),
    ],
    vals: [r.venue ? venue(r.venue) : null, plainName(r.host?.name)?.toLowerCase() ?? null, plainName(r.guest?.name)?.toLowerCase() ?? null,
      r.winner ? name(r[r.winner]).toLowerCase() : null, r.host?.place ?? null, r.margin, r.length_s, STATE[r.state], r.host?.perf?.fps ?? null, r.guest?.perf?.fps ?? null],
  }));

  const E = data.endings;
  const endings: [string, number][] = [[t('Both home', 'Оба финишировали', 'Ambos llegaron', 'Beide im Ziel', 'İkisi de bitirdi', 'Tous deux arrivés'), E.both], [t('Forfeit', 'Сдача', 'Retirada', 'Aufgabe', 'Çekilme', 'Forfait'), E.forfeit], [t('DSQ', 'DSQ'), E.dsq], [t('DNF', 'DNF'), E.dnf], [t('No winner', 'Без победителя', 'Sin ganador', 'Kein Sieger', 'Kazanan yok', 'Pas de vainqueur'), E.no_winner]];
  const groupRows = (k: Duels['groups'][number]['k'], label: (v: string | null) => string) =>
    data.groups.filter((g) => g.k === k).map((g) => ({ key: `${k}-${g.v}`, name: label(g.v), cells: [String(g.n), pct(g.fin, g.n)] }));
  const head = [t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates'), t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée')];
  // the database returns only the days that had races: the UTC days between the first and the last get an empty track
  const span = (() => {
    const out: { d: string; n: number; fin: number }[] = [], DAY = 864e5;
    const first = Date.parse(`${data.days[0]?.d}T00:00:00Z`), last = Date.parse(`${data.days[data.days.length - 1]?.d}T00:00:00Z`);
    if (!(last - first <= 3660 * DAY)) return data.days; // (a range that isn't one: drawn as it came)
    const by = new Map(data.days.map((d) => [d.d, d]));
    for (let at = first; at <= last; at += DAY) { const d = new Date(at).toISOString().slice(0, 10); out.push(by.get(d) ?? { d, n: 0, fin: 0 }); }
    return out.length >= data.days.length ? out : data.days;
  })();
  const slots: DaySlot[] = span.map((d) => ({ d: d.d, n: d.n, tip: [[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates'), String(d.n)], [t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée'), pct(d.fin, d.n)]] }));
  const PERIODS: { d: number | null; label: string }[] = [{ d: null, label: t('All time', 'Всё время', 'Todo el tiempo', 'Gesamt', 'Tüm zamanlar', 'Depuis le début') }, ...DUEL_DAYS.map((d) => ({ d, label: t(`${d} days`, `${d} дн.`, `${d} días`, `${d} Tage`, `${d} gün`, `${d} jours`) }))];

  return (
    <div className="adm adm-stats">
      <div className="adm-k">
        <IconCrew /><span className="kicker">{t('1-on-1 races', 'Гонки 1 на 1', 'Regatas 1 contra 1', '1-gegen-1-Regatten', 'Bire bir yarışlar', 'Duels 1 contre 1')}</span>
        <nav className="adm-range" aria-label={t('Period', 'Период', 'Periodo', 'Zeitraum', 'Dönem', 'Période')}>
          {PERIODS.map((p) => (
            <Link key={p.label} href={p.d ? `/admin/duels?days=${p.d}` : '/admin/duels'} scroll={false} aria-current={p.d === days ? 'page' : undefined} className={p.d === days ? 'on' : undefined}>{p.label}</Link>
          ))}
        </nav>
      </div>
      <div className="adm-tiles">
        <Tile k={t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates')} v={String(T.races)} />
        <Tile k={t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée')} v={`${T.finished} · ${pct(T.finished, T.races)}`} />
        <Tile k={t('Abandoned', 'Брошено', 'Abandonadas', 'Abgebrochen', 'Terk edilenler', 'Abandonnées')} v={`${T.abandoned} · ${pct(T.abandoned, T.races)}`} />
        <Tile k={t('No result', 'Без итога', 'Sin resultado', 'Kein Ergebnis', 'Sonuç yok', 'Pas de résultat')} v={`${T.no_result} · ${pct(T.no_result, T.races)}`} />
        <Tile k={t('Sailors', 'Гонщиков', 'Regatistas', 'Segler', 'Denizciler', 'Marins')} v={String(T.sailors)} />
        <Tile k={t('Signed in', 'С аккаунтом', 'Con sesión', 'Angemeldet', 'Giriş yapıldı', 'Connectés')} v={pct(T.signed, T.seats)} />
        <Tile k={t('Rematches', 'Реваншей', 'Revanchas', 'Revanchen', 'Rövanşlar', 'Revanches')} v={String(T.rematches)} />
        <Tile k={t('Median race', 'Медиана гонки', 'Regata mediana', 'Mittlere Regatta', 'Medyan yarış', 'Régate médiane')} v={T.median == null ? '–' : clock(T.median)} />
        {T.perf_seats ? <Tile k={t('Slow screens', 'Медленные экраны', 'Pantallas lentas', 'Langsame Bildschirme', 'Yavaş ekranlar', 'Écrans lents')} v={`${T.slow_seats ?? 0} · ${pct(T.slow_seats ?? 0, T.perf_seats)}`} /> : null}
      </div>
      {data.days.length > 0 && <DayChart lang={lang} title={t('Races a day', 'Гонок в день', 'Regatas al día', 'Regatten pro Tag', 'Günde yarış', 'Régates par jour')} label={t('Races started each day', 'Гонок начато в каждый день', 'Regatas iniciadas cada día', 'Pro Tag gestartete Regatten', 'Her gün başlayan yarışlar', 'Régates lancées chaque jour')} slots={slots} />}
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('How the finished races ended', 'Чем закончились гонки', 'Cómo acabaron las regatas terminadas', 'Wie die beendeten Regatten ausgingen', 'Biten yarışlar nasıl sona erdi', 'Comment se sont terminées les régates finies')}</h3>
        <p className="hint">{endings.map(([k, n]) => `${k} ${n}`).join(' · ')}</p>
      </section>
      <Table title={t('By venue', 'По месту', 'Por sede', 'Nach Revier', 'Alana göre', 'Par plan d’eau')} first={t('Venue', 'Место', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau')} head={head} rows={groupRows('venue', (v) => (v ? venue(v) : t('Not kept', 'Не записано', 'No guardado', 'Nicht erfasst', 'Saklanmadı', 'Non conservé')))} />
      <Table title={t('By yacht', 'По яхте', 'Por yate', 'Nach Yacht', 'Yata göre', 'Par yacht')} first={t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Yacht')} head={head} rows={groupRows('yacht', yacht)} />
      <Table title={t('By wind', 'По ветру', 'Por viento', 'Nach Wind', 'Rüzgâra göre', 'Par vent')} first={t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent')} head={head} rows={groupRows('wind', wind)} />
      <Table title={t('By course', 'По дистанции', 'Por recorrido', 'Nach Bahn', 'Parkura göre', 'Par parcours')} first={t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours')} head={head} rows={groupRows('course', course)} />
      <Table title={t('By start', 'По старту', 'Por salida', 'Nach Start', 'Starta göre', 'Par départ')} first={t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ')} head={head} rows={groupRows('start', (v) => (v ? t(`${v} min`, `${v} мин`, `${v} min`, `${v} Min.`, `${v} dk`, `${v} min`) : '–'))} />
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('Every race', 'Каждая гонка', 'Todas las regatas', 'Jede Regatta', 'Her yarış', 'Toutes les régates')}</h3>
        {R.length > 0 ? (
          <PlayersTable first={{ label: t('When', 'Когда', 'Cuándo', 'Wann', 'Ne zaman', 'Quand') }} cols={cols} rows={rows} start={0}
            label={t('Every race', 'Каждая гонка', 'Todas las regatas', 'Jede Regatta', 'Her yarış', 'Toutes les régates')} newLabel="" />
        ) : <p className="hint">{t('No races in this period.', 'За этот период гонок нет.', 'No hay regatas en este periodo.', 'Keine Regatten in diesem Zeitraum.', 'Bu dönemde yarış yok.', 'Aucune régate sur cette période.')}</p>}
        {data.more && <p className="hint">{t('The period has more races than the table holds: only the newest 1,000 are shown.', 'В периоде больше гонок, чем помещается в таблицу: показаны только последние 1000.', 'El periodo tiene más regatas de las que caben en la tabla: solo se muestran las 1000 más recientes.', 'Der Zeitraum hat mehr Regatten, als die Tabelle fasst: Es werden nur die neuesten 1.000 gezeigt.', 'Dönemde tablonun alabileceğinden fazla yarış var: yalnızca en yeni 1.000 gösteriliyor.', 'La période compte plus de régates que le tableau n’en contient : seules les 1 000 plus récentes sont affichées.')}</p>}
      </section>
      <p className="hint">{t('Races are counted by when they started. No result: a race still on after two hours with no end reported. Sailors: accounts, and guests by name, so a guest who changes name counts twice. Signed in: the share of seats sailed with an account. Rematches: races beyond the first on each code. Median race: the slower boat’s time over the finished races with a time. Times in UTC.',
        'Гонки считаются по времени старта. Без итога — гонка, идущая дольше двух часов без отчёта о конце. Гонщики — аккаунты и гости по имени, так что гость, сменивший имя, считается дважды. С аккаунтом — доля мест, на которых гонщик вошёл в аккаунт. Реванши — гонки сверх первой на каждом коде. Медиана — время более медленной лодки в завершённых гонках с временем. Время по UTC.', 'Las regatas se cuentan por cuándo empezaron. Sin resultado: una regata aún en curso tras dos horas sin fin registrado. Regatistas: cuentas, e invitados por nombre, así que un invitado que cambia de nombre cuenta dos veces. Con sesión: la proporción de plazas navegadas con cuenta. Revanchas: regatas posteriores a la primera en cada código. Regata mediana: el tiempo del barco más lento en las regatas terminadas con tiempo. Horas en UTC.', 'Regatten werden nach ihrem Start gezählt. Kein Ergebnis: eine Regatta, die nach zwei Stunden noch läuft, ohne dass ein Ende gemeldet wurde. Segler: Konten, und Gäste nach Namen, also zählt ein Gast, der den Namen wechselt, doppelt. Angemeldet: der Anteil der Plätze, die mit einem Konto gesegelt wurden. Revanchen: Regatten über die erste hinaus je Code. Mittlere Regatta: die Zeit des langsameren Bootes über die beendeten Regatten mit einer Zeit. Zeiten in UTC.', 'Yarışlar başladıkları ana göre sayılır. Sonuç yok: iki saat sonra hâlâ süren ve bitiş bildirilmeyen yarış. Denizciler: hesaplar ve ada göre misafirler; yani adını değiştiren bir misafir iki kez sayılır. Giriş yapıldı: bir hesapla oturulan koltukların payı. Rövanşlar: her kodda ilkinden sonraki yarışlar. Medyan yarış: süresi olan biten yarışlarda yavaş teknenin süresi. Saatler UTC.', 'Les régates sont comptées selon leur heure de départ. Pas de résultat : une régate encore en cours après deux heures sans fin signalée. Marins : les comptes, et les invités par leur nom, si bien qu’un invité qui change de nom compte deux fois. Connectés : la part des places courues avec un compte. Revanches : les régates au-delà de la première sur chaque code. Régate médiane : le temps du bateau le plus lent sur les régates terminées avec un temps. Heures en UTC.')}</p>
      <p className="hint">{t('Host’s and Guest’s screen: how the race ran on each sailor’s screen, as the game reported it when its card opened or the page left the race (nothing under 20 s of racing): the middle frame’s rate, and below it the slow end’s (the 95th percentile frame), stalls over 100 ms a minute, the way to the host and back (the guest’s screen), and the other screen’s messages that came over 250 ms late, a minute. The device is in the tooltip. Amber: a slow screen, its slow end under 20 fps or two stalls a minute or more. The race runs on the host’s screen, so a slow host slows it for both.',
        'Экран хозяина и гостя — как гонка шла на экране каждого, по отчёту игры, когда открылась карточка или страница ушла из гонки (меньше 20 с гонки не отчитывается): частота среднего кадра, под ней — медленного края (95-й процентиль), рывки дольше 100 мс в минуту, путь до хозяина и обратно (на экране гостя) и сообщения другого экрана, опоздавшие больше чем на 250 мс, в минуту. Устройство — во всплывающей подсказке. Жёлтым — медленный экран: медленный край ниже 20 fps или два рывка в минуту и больше. Гонка идёт на экране хозяина, так что медленный хозяин замедляет её обоим.',
        'Pantalla del anfitrión y del invitado: cómo fue la regata en la pantalla de cada uno, según la informó el juego al abrirse su tarjeta o al salir la página de la regata (nada con menos de 20 s de regata): la frecuencia del fotograma medio y, debajo, la del extremo lento (el percentil 95), los tirones de más de 100 ms por minuto, la ida y vuelta hasta el anfitrión (en la pantalla del invitado) y los mensajes de la otra pantalla que llegaron con más de 250 ms de retraso, por minuto. El dispositivo, en la información emergente. En ámbar: una pantalla lenta, con el extremo lento por debajo de 20 fps o dos tirones por minuto o más. La regata corre en la pantalla del anfitrión, así que un anfitrión lento la ralentiza para los dos.', 'Bildschirm des Gastgebers und des Gastes: wie die Regatta auf dem Bildschirm jedes Seglers lief, so wie das Spiel es meldete, als seine Karte aufging oder die Seite die Regatta verließ (nichts unter 20 s Regatta): die Rate des mittleren Frames und darunter die des langsamen Endes (der Frame am 95. Perzentil), Ruckler über 100 ms pro Minute, der Weg zum Gastgeber und zurück (der Bildschirm des Gastes) und die Nachrichten des anderen Bildschirms, die mehr als 250 ms zu spät kamen, pro Minute. Das Gerät steht im Tooltip. Bernstein: ein langsamer Bildschirm, sein langsames Ende unter 20 fps oder zwei Ruckler pro Minute oder mehr. Die Regatta läuft auf dem Bildschirm des Gastgebers, also bremst ein langsamer Gastgeber sie für beide.', 'Ev sahibinin ve konuğun ekranı: yarışın her denizcinin ekranında nasıl geçtiği, oyunun kartı açıldığında ya da sayfa yarıştan ayrıldığında bildirdiği gibi (20 sn altındaki yarış sayılmaz): ortadaki karenin hızı, altında yavaş ucu (95. yüzdelik kare), dakikada 100 ms üzerindeki takılmalar, ev sahibine gidiş ve dönüş yolu (konuğun ekranı) ve öteki ekranın 250 ms’den geç gelen mesajları, dakikada. Cihaz ipucunda. Sarı: yavaş bir ekran, yavaş ucu 20 fps altında ya da dakikada iki takılma ve üstü. Yarış ev sahibinin ekranında çalışır, bu yüzden yavaş bir ev sahibi onu ikisi için yavaşlatır.', 'Écran de l’hôte et de l’invité : comment la régate a tourné sur l’écran de chaque marin, tel que le jeu l’a signalé à l’ouverture de sa carte ou quand la page a quitté la régate (rien sous 20 s de course) : la cadence de l’image médiane, et en dessous celle du bas de l’échelle (l’image au 95e centile), les saccades de plus de 100 ms par minute, l’aller-retour jusqu’à l’hôte (écran de l’invité), et les messages de l’autre écran arrivés avec plus de 250 ms de retard, par minute. L’appareil est dans l’infobulle. Orange : un écran lent, son bas d’échelle sous 20 i/s ou deux saccades par minute ou plus. La régate tourne sur l’écran de l’hôte : un hôte lent la ralentit donc pour les deux.')}</p>
    </div>
  );
}
