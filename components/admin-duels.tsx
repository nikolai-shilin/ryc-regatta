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
import { AdminTargets, type Targets } from './admin-targets';
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
  // the gun reached (either screen's word; null: not known), and the guest's screen's word on the end beside the host's:
  // agreed null until both are in (20261121120000_regatta_duel_agree.sql)
  gun?: boolean | null; agreed?: boolean | null; guest_state?: 'finished' | 'abandoned' | null; guest_winner?: 'host' | 'guest' | null;
};
export type Duels = {
  since: string | null; more: boolean;
  totals: { races: number; finished: number; abandoned: number; no_result: number; sailors: number; seats: number; signed: number; rematches: number; median: Num; perf_seats?: number; slow_seats?: number;
    gun?: number; gun_known?: number; both_told?: number; agreed?: number; disputed?: number; finished_accounts?: number; trusted?: number };
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
const ordinal = (n: number, lang: Lang) => (lang === 'ru' ? `${n}-е` : lang === 'es' ? `${n}.º` : lang === 'pt' ? `${n}º` : lang === 'it' ? `${n}º` : lang === 'fr' ? (n === 1 ? '1er' : `${n}e`) : lang === 'de' || lang === 'tr' ? `${n}.` : ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`);

export function AdminDuels({ lang, data, days, targets }: { lang: Lang; data: Duels; days: number | null; targets?: Targets | null }) {
  const t = tx(lang), T = data.totals, R = data.races;
  const when = (s: string) => new Date(s).toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const venue = (v: string | null) => (v ? pick(VENUES.find((x) => x.id === v)?.name, lang) ?? v : '–');
  const yacht = (v: string | null) => (v ? pick(YACHTS.find((x) => x.id === v)?.name, lang) ?? v : '–');
  const wind = (v: string | null) => ({ light: t('Light', 'Слабый', 'Flojo', 'Leicht', 'Hafif', 'Léger', 'Leggero', 'Fraco'), medium: t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta', 'Moyen', 'Medio', 'Médio'), strong: t('Strong', 'Сильный', 'Fuerte', 'Stark', 'Kuvvetli', 'Fort', 'Forte', 'Forte') }[v ?? ''] ?? v ?? '–');
  const course = (v: string | null) => (v && v in SHAPE_NAME ? pick(SHAPE_NAME[v as keyof typeof SHAPE_NAME], lang) : v ?? '–');
  const length = (v: string | null) => ({ short: t('Short', 'Короткая', 'Corta', 'Kurz', 'Kısa', 'Courte', 'Corta', 'Curta'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta', 'Moyenne', 'Media', 'Média'), long: t('Long', 'Длинная', 'Larga', 'Lang', 'Uzun', 'Longue', 'Lunga', 'Longa') }[v ?? ''] ?? v ?? '–');
  const STATE = { racing: t('Racing', 'Идёт', 'En regata', 'Unterwegs', 'Yarışıyor', 'En course', 'In regata', 'Em regata'), finished: t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada'), abandoned: t('Abandoned', 'Брошена', 'Abandonada', 'Abgebrochen', 'Terk edildi', 'Abandonnée', 'Abbandonata', 'Abandonada'), no_result: t('No result', 'Без итога', 'Sin resultado', 'Kein Ergebnis', 'Sonuç yok', 'Pas de résultat', 'Nessun risultato', 'Sem resultado') };
  const name = (s: Sailor | null) => (s ? plainName(s.name) ?? (s.kind === 'guest' ? t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité', 'Ospite', 'Visitante') : '–') : '–');
  const who = (s: Sailor | null) => {
    if (!s || (!s.who && plainName(s.name) == null)) return <span>–</span>;
    return (
      <span className="adm-pl-name">
        {s.who ? <Link className="adm-pl-link" href={logHref(s.who, days ?? 30)}>{name(s)}</Link> : name(s)}
        {s.kind === 'guest' && <span className="adm-pl-sub">{t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité', 'Ospite', 'Visitante')}</span>}
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
    if (r.forfeited) return t(`Forfeit: ${side(r, r.forfeited)}`, `Сдача: ${side(r, r.forfeited)}`, `Retirada: ${side(r, r.forfeited)}`, `Aufgabe: ${side(r, r.forfeited)}`, `Çekilme: ${side(r, r.forfeited)}`, `Forfait : ${side(r, r.forfeited)}`, `Forfait: ${side(r, r.forfeited)}`, `Desistência: ${side(r, r.forfeited)}`);
    return `${boat(r.host)} / ${boat(r.guest)}`;
  };
  const lap = (n: number) => t(n === 1 ? '1 lap' : `${n} laps`, `${n} кр.`, n === 1 ? '1 vuelta' : `${n} vueltas`, n === 1 ? '1 Runde' : `${n} Runden`, `${n} tur`, n === 1 ? '1 tour' : `${n} tours`, n === 1 ? '1 giro' : `${n} giri`, n === 1 ? '1 volta' : `${n} voltas`);
  const settings = (r: DuelRace) => [r.course && course(r.course), r.length && length(r.length), r.laps != null && lap(r.laps), r.start_min != null && t(`${r.start_min} min`, `${r.start_min} мин`, `${r.start_min} min`, `${r.start_min} Min.`, `${r.start_min} dk`, `${r.start_min} min`, `${r.start_min} min`, `${r.start_min} min`), r.current && t('Current', 'Течение', 'Corriente', 'Strömung', 'Akıntı', 'En cours', 'Corrente', 'Correnteza')].filter(Boolean).join(' · ');
  // how the race ran on a sailor's screen: the middle frame's rate, and below it the slow end's, the stalls, the way to the
  // other screen and back (the guest's), the late messages and the device; the whole in the tooltip
  const screen = (s: Sailor | null) => {
    const p = s?.perf;
    if (!p) return <span>–</span>;
    const net = p.net, sys = [p.os, p.br].filter(Boolean).join('/');
    const sub = [p.low != null && t(`low ${Math.round(p.low)}`, `мин. ${Math.round(p.low)}`, `mín. ${Math.round(p.low)}`, `niedrig ${Math.round(p.low)}`, `düşük ${Math.round(p.low)}`, `min ${Math.round(p.low)}`, `minimo ${Math.round(p.low)}`, `mín. ${Math.round(p.low)}`), p.stall != null && p.stall > 0 && t(`${p.stall}/min stalls`, `${p.stall}/мин рывков`, `${p.stall}/min tirones`, `${p.stall}/Min. Ruckler`, `${p.stall}/dk takılma`, `${p.stall}/min saccades`, `${p.stall}/min blocchi`, `${p.stall}/min travadas`),
      net?.rtt != null && `${net.rtt} ${t('ms', 'мс', 'ms', 'ms', 'ms', 'ms', 'ms', 'ms')}`, net?.late != null && net.late > 0 && t(`${net.late}/min late`, `${net.late}/мин поздно`, `${net.late}/min tarde`, `${net.late}/Min. verspätet`, `${net.late}/dk geç`, `${net.late}/min en retard`, `${net.late}/min in ritardo`, `${net.late}/min atrasados`)].filter(Boolean).join(' · ');
    const tip = [sys, p.gpu, p.cores != null && t(`${p.cores} cores`, `${p.cores} ядер`, `${p.cores} núcleos`, `${p.cores} Kerne`, `${p.cores} çekirdek`, `${p.cores} cœurs`, `${p.cores} core`, `${p.cores} núcleos`), p.mem != null && `${p.mem} GB`, p.q && t(`graphics ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `графика ${p.q}${p.gfx === 'auto' ? ' (авто)' : ''}`, `gráficos ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `Grafik ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `grafik ${p.q}${p.gfx === 'auto' ? ' (otomatik)' : ''}`, `graphismes ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `grafica ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`, `gráficos ${p.q}${p.gfx === 'auto' ? ' (auto)' : ''}`),
      p.saver ? t('battery saver', 'экономия батареи', 'ahorro de batería', 'Energiesparmodus', 'pil tasarrufu', 'économie de batterie', 'risparmio batteria', 'economia de bateria') : null].filter(Boolean).join(' · ');
    return (
      <span className="adm-pl-name" title={tip}>
        <span style={slowScreen(p) ? { color: 'var(--warn)' } : undefined}>{Math.round(p.fps)} fps</span>
        <span className="adm-pl-sub">{sub || sys || '–'}</span>
      </span>
    );
  };
  // the state, and under it what the guest's screen said of the end: the same, something else (what), or nothing; and for
  // an abandoned race, whether it was before the gun or after it
  const verdict = (r: DuelRace) => {
    if (r.state === 'racing' || r.state === 'no_result') return null;
    if (r.agreed === true) return t('Both screens agree', 'Оба экрана согласны', 'Ambas pantallas coinciden', 'Beide Bildschirme einig', 'İki ekran da aynı', 'Les deux écrans d’accord', 'Entrambi gli schermi concordano', 'As duas telas concordam');
    if (r.agreed === false) {
      const said = r.guest_state === 'abandoned' ? STATE.abandoned : r.guest_winner ? `${t('Winner', 'Победил', 'Ganador', 'Sieger', 'Kazanan', 'Vainqueur', 'Vincitore', 'Vencedor')} ${name(r[r.guest_winner])}` : t('no winner', 'без победителя', 'sin ganador', 'kein Sieger', 'kazanan yok', 'pas de vainqueur', 'nessun vincitore', 'sem vencedor');
      return t(`Guest’s screen: ${said}`, `Экран гостя: ${said}`, `Pantalla del invitado: ${said}`, `Bildschirm des Gastes: ${said}`, `Konuğun ekranı: ${said}`, `Écran de l’invité : ${said}`, `Schermo dell’ospite: ${said}`, `Tela do visitante: ${said}`);
    }
    return t('Host’s screen only', 'Только экран хозяина', 'Solo la pantalla del anfitrión', 'Nur der Bildschirm des Gastgebers', 'Yalnızca ev sahibinin ekranı', 'Seulement l’écran de l’hôte', 'Solo lo schermo dell’host', 'Só a tela do anfitrião');
  };
  const gunNote = (r: DuelRace) => (r.state !== 'abandoned' || r.gun == null ? null : r.gun
    ? t('after the gun', 'после старта', 'tras la salida', 'nach dem Start', 'starttan sonra', 'après le départ', 'dopo la partenza', 'depois da largada')
    : t('before the gun', 'до старта', 'antes de la salida', 'vor dem Start', 'starttan önce', 'avant le départ', 'prima della partenza', 'antes da largada'));
  const stateCell = (r: DuelRace) => {
    const sub = [gunNote(r), verdict(r)].filter(Boolean).join(' · ');
    return <span key="s" className="adm-pl-name"><span style={r.agreed === false ? { color: 'var(--warn)' } : undefined}>{STATE[r.state]}</span>{sub && <span className="adm-pl-sub">{sub}</span>}</span>;
  };
  const where = (r: DuelRace) => (r.venue || r.yacht || r.wind ? [venue(r.venue), yacht(r.yacht), wind(r.wind)].join(' · ') : '–');

  const cols: Col[] = [
    { label: t('Where', 'Где', 'Dónde', 'Wo', 'Nerede', 'Où', 'Dove', 'Onde'), asc: true }, { label: t('Host', 'Хозяин', 'Anfitrión', 'Gastgeber', 'Ev sahibi', 'Hôte', 'Host', 'Anfitrião'), asc: true }, { label: t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité', 'Ospite', 'Visitante'), asc: true },
    { label: t('Winner', 'Победил', 'Ganador', 'Sieger', 'Kazanan', 'Vainqueur', 'Vincitore', 'Vencedor'), asc: true }, { label: t('Result', 'Итог', 'Resultado', 'Ergebnis', 'Sonuç', 'Résultat', 'Risultato', 'Resultado'), asc: true }, { label: t('Margin', 'Отрыв', 'Diferencia', 'Abstand', 'Fark', 'Écart', 'Margine', 'Margem') },
    { label: t('Length', 'Длина', 'Duración', 'Länge', 'Uzunluk', 'Durée', 'Durata', 'Duração') }, { label: t('State', 'Статус', 'Estado', 'Status', 'Durum', 'État', 'Stato', 'Estado'), asc: true },
    { label: t('Host’s screen', 'Экран хозяина', 'Pantalla del anfitrión', 'Bildschirm des Gastgebers', 'Ev sahibinin ekranı', 'Écran de l’hôte', 'Schermo dell’host', 'Tela do anfitrião') }, { label: t('Guest’s screen', 'Экран гостя', 'Pantalla del invitado', 'Bildschirm des Gastes', 'Konuğun ekranı', 'Écran de l’invité', 'Schermo dell’ospite', 'Tela do convidado') },
  ];
  const rows: Row[] = R.map((r) => ({
    key: r.id,
    name: when(r.at),
    sort: Date.parse(r.at),
    sub: `${r.code}${r.race_no > 1 ? ` · ${t('Race', 'Гонка', 'Regata', 'Regatta', 'Yarış', 'Régate', 'Regata', 'Regata')} ${r.race_no}` : ''}`,
    isNew: false,
    cells: [
      <span key="w" className="adm-pl-name">{where(r)}<span className="adm-pl-sub">{settings(r)}</span></span>,
      who(r.host), who(r.guest), side(r, r.winner), result(r),
      r.margin == null ? '–' : `${r.margin.toFixed(1)} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}`, r.length_s == null ? '–' : clock(r.length_s), stateCell(r),
      screen(r.host), screen(r.guest),
    ],
    vals: [r.venue ? venue(r.venue) : null, plainName(r.host?.name)?.toLowerCase() ?? null, plainName(r.guest?.name)?.toLowerCase() ?? null,
      r.winner ? name(r[r.winner]).toLowerCase() : null, r.host?.place ?? null, r.margin, r.length_s, STATE[r.state], r.host?.perf?.fps ?? null, r.guest?.perf?.fps ?? null],
  }));

  const E = data.endings;
  const endings: [string, number][] = [[t('Both home', 'Оба финишировали', 'Ambos llegaron', 'Beide im Ziel', 'İkisi de bitirdi', 'Tous deux arrivés', 'Entrambi arrivati', 'Os dois chegaram'), E.both], [t('Forfeit', 'Сдача', 'Retirada', 'Aufgabe', 'Çekilme', 'Forfait', 'Forfait', 'Desistência'), E.forfeit], [t('DSQ', 'DSQ'), E.dsq], [t('DNF', 'DNF'), E.dnf], [t('No winner', 'Без победителя', 'Sin ganador', 'Kein Sieger', 'Kazanan yok', 'Pas de vainqueur', 'Nessun vincitore', 'Sem vencedor'), E.no_winner]];
  const groupRows = (k: Duels['groups'][number]['k'], label: (v: string | null) => string) =>
    data.groups.filter((g) => g.k === k).map((g) => ({ key: `${k}-${g.v}`, name: label(g.v), cells: [String(g.n), pct(g.fin, g.n)] }));
  const head = [t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas'), t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada')];
  // the database returns only the days that had races: the UTC days between the first and the last get an empty track
  const span = (() => {
    const out: { d: string; n: number; fin: number }[] = [], DAY = 864e5;
    const first = Date.parse(`${data.days[0]?.d}T00:00:00Z`), last = Date.parse(`${data.days[data.days.length - 1]?.d}T00:00:00Z`);
    if (!(last - first <= 3660 * DAY)) return data.days; // (a range that isn't one: drawn as it came)
    const by = new Map(data.days.map((d) => [d.d, d]));
    for (let at = first; at <= last; at += DAY) { const d = new Date(at).toISOString().slice(0, 10); out.push(by.get(d) ?? { d, n: 0, fin: 0 }); }
    return out.length >= data.days.length ? out : data.days;
  })();
  const slots: DaySlot[] = span.map((d) => ({ d: d.d, n: d.n, tip: [[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas'), String(d.n)], [t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada'), pct(d.fin, d.n)]] }));
  const PERIODS: { d: number | null; label: string }[] = [{ d: null, label: t('All time', 'Всё время', 'Todo el tiempo', 'Gesamt', 'Tüm zamanlar', 'Depuis le début', 'Da sempre', 'Desde o início') }, ...DUEL_DAYS.map((d) => ({ d, label: t(`${d} days`, `${d} дн.`, `${d} días`, `${d} Tage`, `${d} gün`, `${d} jours`, `${d} giorni`, `${d} dias`) }))];

  return (
    <div className="adm adm-stats">
      <div className="adm-k">
        <IconCrew /><span className="kicker">{t('1-on-1 races', 'Гонки 1 на 1', 'Regatas 1 contra 1', '1-gegen-1-Regatten', 'Bire bir yarışlar', 'Duels 1 contre 1', 'Duelli 1 contro 1', 'Duelos 1 contra 1')}</span>
        <nav className="adm-range" aria-label={t('Period', 'Период', 'Periodo', 'Zeitraum', 'Dönem', 'Période', 'Periodo', 'Período')}>
          {PERIODS.map((p) => (
            <Link key={p.label} href={p.d ? `/admin/duels?days=${p.d}` : '/admin/duels'} scroll={false} aria-current={p.d === days ? 'page' : undefined} className={p.d === days ? 'on' : undefined}>{p.label}</Link>
          ))}
        </nav>
      </div>
      <div className="adm-tiles">
        <Tile k={t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas')} v={String(T.races)} />
        <Tile k={t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada')} v={`${T.finished} · ${pct(T.finished, T.races)}`} />
        <Tile k={t('Abandoned', 'Брошено', 'Abandonadas', 'Abgebrochen', 'Terk edilenler', 'Abandonnées', 'Abbandonate', 'Abandonadas')} v={`${T.abandoned} · ${pct(T.abandoned, T.races)}`} />
        <Tile k={t('No result', 'Без итога', 'Sin resultado', 'Kein Ergebnis', 'Sonuç yok', 'Pas de résultat', 'Nessun risultato', 'Sem resultado')} v={`${T.no_result} · ${pct(T.no_result, T.races)}`} />
        <Tile k={t('Sailors', 'Гонщиков', 'Regatistas', 'Segler', 'Denizciler', 'Marins', 'Velisti', 'Velejadores')} v={String(T.sailors)} />
        <Tile k={t('Signed in', 'С аккаунтом', 'Con sesión', 'Angemeldet', 'Giriş yapıldı', 'Connectés', 'Con accesso', 'Com conta')} v={pct(T.signed, T.seats)} />
        <Tile k={t('Rematches', 'Реваншей', 'Revanchas', 'Revanchen', 'Rövanşlar', 'Revanches', 'Rivincite', 'Revanches')} v={String(T.rematches)} />
        <Tile k={t('Median race', 'Медиана гонки', 'Regata mediana', 'Mittlere Regatta', 'Medyan yarış', 'Régate médiane', 'Regata mediana', 'Regata mediana')} v={T.median == null ? '–' : clock(T.median)} />
        {T.gun_known ? <Tile k={t('Reached the gun', 'Дошли до старта', 'Llegaron a la salida', 'Bis zum Start', 'Start verildi', 'Jusqu’au départ', 'Fino alla partenza', 'Chegaram à largada')} v={`${T.gun ?? 0} · ${pct(T.gun ?? 0, T.gun_known)}`} /> : null}
        {T.both_told ? <Tile k={t('Screens agree', 'Экраны совпали', 'Pantallas de acuerdo', 'Bildschirme einig', 'Ekranlar uyuşuyor', 'Écrans d’accord', 'Schermi concordi', 'Telas de acordo')} v={`${T.agreed ?? 0} · ${pct(T.agreed ?? 0, T.both_told)}`} /> : null}
        {T.both_told ? <Tile k={t('Disputed', 'Спорные', 'En disputa', 'Strittig', 'Tartışmalı', 'Contestées', 'Contestate', 'Contestadas')} v={String(T.disputed ?? 0)} /> : null}
        {T.finished_accounts ? <Tile k={t('Trusted results', 'Надёжный итог', 'Resultado fiable', 'Gesichertes Ergebnis', 'Güvenilir sonuç', 'Résultat fiable', 'Risultato affidabile', 'Resultado confiável')} v={`${T.trusted ?? 0} · ${pct(T.trusted ?? 0, T.finished_accounts)}`} /> : null}
        {T.perf_seats ? <Tile k={t('Slow screens', 'Медленные экраны', 'Pantallas lentas', 'Langsame Bildschirme', 'Yavaş ekranlar', 'Écrans lents', 'Schermi lenti', 'Telas lentas')} v={`${T.slow_seats ?? 0} · ${pct(T.slow_seats ?? 0, T.perf_seats)}`} /> : null}
      </div>
      {targets && <AdminTargets lang={lang} data={targets} />}
      {data.days.length > 0 && <DayChart lang={lang} title={t('Races a day', 'Гонок в день', 'Regatas al día', 'Regatten pro Tag', 'Günde yarış', 'Régates par jour', 'Regate al giorno', 'Regatas por dia')} label={t('Races started each day', 'Гонок начато в каждый день', 'Regatas iniciadas cada día', 'Pro Tag gestartete Regatten', 'Her gün başlayan yarışlar', 'Régates lancées chaque jour', 'Regate iniziate ogni giorno', 'Regatas iniciadas por dia')} slots={slots} />}
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('How the finished races ended', 'Чем закончились гонки', 'Cómo acabaron las regatas terminadas', 'Wie die beendeten Regatten ausgingen', 'Biten yarışlar nasıl sona erdi', 'Comment se sont terminées les régates finies', 'Come sono finite le regate concluse', 'Como terminaram as regatas concluídas')}</h3>
        <p className="hint">{endings.map(([k, n]) => `${k} ${n}`).join(' · ')}</p>
      </section>
      <Table title={t('By venue', 'По месту', 'Por sede', 'Nach Revier', 'Alana göre', 'Par plan d’eau', 'Per campo di regata', 'Por raia')} first={t('Venue', 'Место', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau', 'Campo di regata', 'Raia')} head={head} rows={groupRows('venue', (v) => (v ? venue(v) : t('Not kept', 'Не записано', 'No guardado', 'Nicht erfasst', 'Saklanmadı', 'Non conservé', 'Non conservato', 'Não guardado')))} />
      <Table title={t('By yacht', 'По яхте', 'Por yate', 'Nach Yacht', 'Yata göre', 'Par yacht', 'Per yacht', 'Por veleiro')} first={t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Yacht', 'Yacht', 'Veleiro')} head={head} rows={groupRows('yacht', yacht)} />
      <Table title={t('By wind', 'По ветру', 'Por viento', 'Nach Wind', 'Rüzgâra göre', 'Par vent', 'Per vento', 'Por vento')} first={t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent', 'Vento', 'Vento')} head={head} rows={groupRows('wind', wind)} />
      <Table title={t('By course', 'По дистанции', 'Por recorrido', 'Nach Bahn', 'Parkura göre', 'Par parcours', 'Per percorso', 'Por percurso')} first={t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours', 'Percorso', 'Percurso')} head={head} rows={groupRows('course', course)} />
      <Table title={t('By start', 'По старту', 'Por salida', 'Nach Start', 'Starta göre', 'Par départ', 'Per partenza', 'Por largada')} first={t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada')} head={head} rows={groupRows('start', (v) => (v ? t(`${v} min`, `${v} мин`, `${v} min`, `${v} Min.`, `${v} dk`, `${v} min`, `${v} min`, `${v} min`) : '–'))} />
      <section className="adm-tab">
        <h3 className="adm-tab-h">{t('Every race', 'Каждая гонка', 'Todas las regatas', 'Jede Regatta', 'Her yarış', 'Toutes les régates', 'Tutte le regate', 'Todas as regatas')}</h3>
        {R.length > 0 ? (
          <PlayersTable first={{ label: t('When', 'Когда', 'Cuándo', 'Wann', 'Ne zaman', 'Quand', 'Quando', 'Quando') }} cols={cols} rows={rows} start={0}
            label={t('Every race', 'Каждая гонка', 'Todas las regatas', 'Jede Regatta', 'Her yarış', 'Toutes les régates', 'Tutte le regate', 'Todas as regatas')} newLabel="" />
        ) : <p className="hint">{t('No races in this period.', 'За этот период гонок нет.', 'No hay regatas en este periodo.', 'Keine Regatten in diesem Zeitraum.', 'Bu dönemde yarış yok.', 'Aucune régate sur cette période.', 'Nessuna regata in questo periodo.', 'Nenhuma regata neste período.')}</p>}
        {data.more && <p className="hint">{t('The period has more races than the table holds: only the newest 1,000 are shown.', 'В периоде больше гонок, чем помещается в таблицу: показаны только последние 1000.', 'El periodo tiene más regatas de las que caben en la tabla: solo se muestran las 1000 más recientes.', 'Der Zeitraum hat mehr Regatten, als die Tabelle fasst: Es werden nur die neuesten 1.000 gezeigt.', 'Dönemde tablonun alabileceğinden fazla yarış var: yalnızca en yeni 1.000 gösteriliyor.', 'La période compte plus de régates que le tableau n’en contient : seules les 1 000 plus récentes sont affichées.', 'Il periodo ha più regate di quante ne contenga la tabella: sono mostrate solo le 1.000 più recenti.', 'O período tem mais regatas do que cabem na tabela: só as 1.000 mais recentes aparecem.')}</p>}
      </section>
      <p className="hint">{t('Races are counted by when they started. No result: a race still on after two hours with no end reported. Sailors: accounts, and guests by name, so a guest who changes name counts twice. Signed in: the share of seats sailed with an account. Rematches: races beyond the first on each code. Median race: the slower boat’s time over the finished races with a time. Times in UTC.',
        'Гонки считаются по времени старта. Без итога — гонка, идущая дольше двух часов без отчёта о конце. Гонщики — аккаунты и гости по имени, так что гость, сменивший имя, считается дважды. С аккаунтом — доля мест, на которых гонщик вошёл в аккаунт. Реванши — гонки сверх первой на каждом коде. Медиана — время более медленной лодки в завершённых гонках с временем. Время по UTC.', 'Las regatas se cuentan por cuándo empezaron. Sin resultado: una regata aún en curso tras dos horas sin fin registrado. Regatistas: cuentas, e invitados por nombre, así que un invitado que cambia de nombre cuenta dos veces. Con sesión: la proporción de plazas navegadas con cuenta. Revanchas: regatas posteriores a la primera en cada código. Regata mediana: el tiempo del barco más lento en las regatas terminadas con tiempo. Horas en UTC.', 'Regatten werden nach ihrem Start gezählt. Kein Ergebnis: eine Regatta, die nach zwei Stunden noch läuft, ohne dass ein Ende gemeldet wurde. Segler: Konten, und Gäste nach Namen, also zählt ein Gast, der den Namen wechselt, doppelt. Angemeldet: der Anteil der Plätze, die mit einem Konto gesegelt wurden. Revanchen: Regatten über die erste hinaus je Code. Mittlere Regatta: die Zeit des langsameren Bootes über die beendeten Regatten mit einer Zeit. Zeiten in UTC.', 'Yarışlar başladıkları ana göre sayılır. Sonuç yok: iki saat sonra hâlâ süren ve bitiş bildirilmeyen yarış. Denizciler: hesaplar ve ada göre misafirler; yani adını değiştiren bir misafir iki kez sayılır. Giriş yapıldı: bir hesapla oturulan koltukların payı. Rövanşlar: her kodda ilkinden sonraki yarışlar. Medyan yarış: süresi olan biten yarışlarda yavaş teknenin süresi. Saatler UTC.', 'Les régates sont comptées selon leur heure de départ. Pas de résultat : une régate encore en cours après deux heures sans fin signalée. Marins : les comptes, et les invités par leur nom, si bien qu’un invité qui change de nom compte deux fois. Connectés : la part des places courues avec un compte. Revanches : les régates au-delà de la première sur chaque code. Régate médiane : le temps du bateau le plus lent sur les régates terminées avec un temps. Heures en UTC.', 'Le regate sono contate in base a quando sono iniziate. Nessun risultato: una regata ancora in corso dopo due ore senza una fine segnalata. Velisti: gli account, e gli ospiti per nome, quindi un ospite che cambia nome conta due volte. Con accesso: la quota di posti corsi con un account. Rivincite: le regate oltre la prima per ogni codice. Regata mediana: il tempo della barca più lenta nelle regate finite con un tempo. Orari in UTC.', 'As regatas são contadas pela hora em que começaram. Sem resultado: uma regata ainda em andamento depois de duas horas, sem fim registrado. Velejadores: contas, e visitantes pelo nome, então um visitante que muda de nome conta duas vezes. Com conta: a parcela das vagas velejadas com conta. Revanches: as regatas além da primeira em cada código. Regata mediana: o tempo do barco mais lento nas regatas terminadas com tempo. Horários em UTC.')}</p>
      <p className="hint">{t('Reached the gun: the finished races, and those either screen said were past the gun, of the races where that is known. Screens agree: of the races both screens reported the end of, those where the two name the same state and the same winner; Disputed: the rest. Trusted results: of the finished races between two accounts, those both screens agree on, the ones a rating may count.',
        'Дошли до старта — финишировавшие гонки и те, о которых хоть один экран сообщил, что старт дан, из гонок, где это известно. Экраны совпали — из гонок, о конце которых сообщили оба экрана, те, где оба называют одно состояние и одного победителя; спорные — остальные. Надёжный итог — из финишировавших гонок двух аккаунтов те, в которых оба экрана согласны: их может считать рейтинг.',
        'Llegaron a la salida: las regatas terminadas y las que alguna pantalla dio por pasada la salida, de las regatas en que se sabe. Pantallas de acuerdo: de las regatas cuyo final informaron ambas pantallas, aquellas en que las dos dan el mismo estado y el mismo ganador; En disputa: el resto. Resultado fiable: de las regatas terminadas entre dos cuentas, las que ambas pantallas confirman, las que podrá contar un rating.',
        'Bis zum Start: die beendeten Regatten und die, bei denen ein Bildschirm den Start gemeldet hat, unter den Regatten, bei denen es bekannt ist. Bildschirme einig: von den Regatten, deren Ende beide Bildschirme gemeldet haben, die mit demselben Status und demselben Sieger; Strittig: der Rest. Gesichertes Ergebnis: von den beendeten Regatten zweier Konten die, bei denen beide Bildschirme einig sind, die ein Rating zählen darf.',
        'Start verildi: biten yarışlar ve ekranlardan birinin startın verildiğini bildirdiği yarışlar, bunun bilindiği yarışlar içinde. Ekranlar uyuşuyor: sonunu iki ekranın da bildirdiği yarışlardan, ikisinin aynı durumu ve aynı kazananı verdiği yarışlar; Tartışmalı: geri kalanı. Güvenilir sonuç: iki hesap arasındaki biten yarışlardan iki ekranın da onayladıkları, bir reytingin sayabileceği yarışlar.',
        'Jusqu’au départ : les régates terminées et celles dont un écran a dit le départ donné, parmi les régates où on le sait. Écrans d’accord : parmi les régates dont les deux écrans ont signalé la fin, celles où les deux donnent le même état et le même vainqueur ; Contestées : les autres. Résultat fiable : parmi les régates terminées entre deux comptes, celles où les deux écrans sont d’accord, celles qu’un classement pourra compter.',
        'Fino alla partenza: le regate finite e quelle che uno dei due schermi ha dato oltre la partenza, tra le regate in cui lo si sa. Schermi concordi: delle regate di cui entrambi gli schermi hanno riferito la fine, quelle in cui i due danno lo stesso stato e lo stesso vincitore; Contestate: le altre. Risultato affidabile: delle regate finite tra due account, quelle su cui entrambi gli schermi concordano, quelle che un rating potrà contare.',
        'Chegaram à largada: as regatas terminadas e as que uma das telas deu como depois da largada, das regatas em que isso se sabe. Telas de acordo: das regatas cujo fim as duas telas informaram, aquelas em que as duas dão o mesmo estado e o mesmo vencedor; Contestadas: o resto. Resultado confiável: das regatas terminadas entre duas contas, aquelas em que as duas telas concordam, as que um rating poderá contar.')}</p>
      <p className="hint">{t('Host’s and Guest’s screen: how the race ran on each sailor’s screen, as the game reported it when its card opened or the page left the race (nothing under 20 s of racing): the middle frame’s rate, and below it the slow end’s (the 95th percentile frame), stalls over 100 ms a minute, the way to the host and back (the guest’s screen), and the other screen’s messages that came over 250 ms late, a minute. The device is in the tooltip. Amber: a slow screen, its slow end under 20 fps or two stalls a minute or more. The race runs on the host’s screen, so a slow host slows it for both.',
        'Экран хозяина и гостя — как гонка шла на экране каждого, по отчёту игры, когда открылась карточка или страница ушла из гонки (меньше 20 с гонки не отчитывается): частота среднего кадра, под ней — медленного края (95-й процентиль), рывки дольше 100 мс в минуту, путь до хозяина и обратно (на экране гостя) и сообщения другого экрана, опоздавшие больше чем на 250 мс, в минуту. Устройство — во всплывающей подсказке. Жёлтым — медленный экран: медленный край ниже 20 fps или два рывка в минуту и больше. Гонка идёт на экране хозяина, так что медленный хозяин замедляет её обоим.',
        'Pantalla del anfitrión y del invitado: cómo fue la regata en la pantalla de cada uno, según la informó el juego al abrirse su tarjeta o al salir la página de la regata (nada con menos de 20 s de regata): la frecuencia del fotograma medio y, debajo, la del extremo lento (el percentil 95), los tirones de más de 100 ms por minuto, la ida y vuelta hasta el anfitrión (en la pantalla del invitado) y los mensajes de la otra pantalla que llegaron con más de 250 ms de retraso, por minuto. El dispositivo, en la información emergente. En ámbar: una pantalla lenta, con el extremo lento por debajo de 20 fps o dos tirones por minuto o más. La regata corre en la pantalla del anfitrión, así que un anfitrión lento la ralentiza para los dos.', 'Bildschirm des Gastgebers und des Gastes: wie die Regatta auf dem Bildschirm jedes Seglers lief, so wie das Spiel es meldete, als seine Karte aufging oder die Seite die Regatta verließ (nichts unter 20 s Regatta): die Rate des mittleren Frames und darunter die des langsamen Endes (der Frame am 95. Perzentil), Ruckler über 100 ms pro Minute, der Weg zum Gastgeber und zurück (der Bildschirm des Gastes) und die Nachrichten des anderen Bildschirms, die mehr als 250 ms zu spät kamen, pro Minute. Das Gerät steht im Tooltip. Bernstein: ein langsamer Bildschirm, sein langsames Ende unter 20 fps oder zwei Ruckler pro Minute oder mehr. Die Regatta läuft auf dem Bildschirm des Gastgebers, also bremst ein langsamer Gastgeber sie für beide.', 'Ev sahibinin ve konuğun ekranı: yarışın her denizcinin ekranında nasıl geçtiği, oyunun kartı açıldığında ya da sayfa yarıştan ayrıldığında bildirdiği gibi (20 sn altındaki yarış sayılmaz): ortadaki karenin hızı, altında yavaş ucu (95. yüzdelik kare), dakikada 100 ms üzerindeki takılmalar, ev sahibine gidiş ve dönüş yolu (konuğun ekranı) ve öteki ekranın 250 ms’den geç gelen mesajları, dakikada. Cihaz ipucunda. Sarı: yavaş bir ekran, yavaş ucu 20 fps altında ya da dakikada iki takılma ve üstü. Yarış ev sahibinin ekranında çalışır, bu yüzden yavaş bir ev sahibi onu ikisi için yavaşlatır.', 'Écran de l’hôte et de l’invité : comment la régate a tourné sur l’écran de chaque marin, tel que le jeu l’a signalé à l’ouverture de sa carte ou quand la page a quitté la régate (rien sous 20 s de course) : la cadence de l’image médiane, et en dessous celle du bas de l’échelle (l’image au 95e centile), les saccades de plus de 100 ms par minute, l’aller-retour jusqu’à l’hôte (écran de l’invité), et les messages de l’autre écran arrivés avec plus de 250 ms de retard, par minute. L’appareil est dans l’infobulle. Orange : un écran lent, son bas d’échelle sous 20 i/s ou deux saccades par minute ou plus. La régate tourne sur l’écran de l’hôte : un hôte lent la ralentit donc pour les deux.', 'Schermo dell’host e dell’ospite: come è girata la regata sullo schermo di ciascun velista, come l’ha segnalato il gioco quando si è aperta la sua scheda o la pagina ha lasciato la regata (niente sotto i 20 s di regata): la frequenza del frame mediano, e sotto quella della coda lenta (il frame al 95º percentile), i blocchi oltre 100 ms al minuto, l’andata e ritorno verso l’host (schermo dell’ospite), e i messaggi dell’altro schermo arrivati con oltre 250 ms di ritardo, al minuto. Il dispositivo è nel tooltip. Ambra: uno schermo lento, con la coda lenta sotto 20 fps o due o più blocchi al minuto. La regata gira sullo schermo dell’host, quindi un host lento la rallenta per entrambi.', 'Tela do anfitrião e do convidado: como a regata rodou na tela de cada velejador, conforme o jogo informou quando o cartão abriu ou a página saiu da regata (nada abaixo de 20 s de regata): a taxa do quadro mediano e, abaixo dela, a da ponta lenta (o quadro do percentil 95), as travadas acima de 100 ms por minuto, a ida e volta até o anfitrião (na tela do convidado) e as mensagens da outra tela que chegaram com mais de 250 ms de atraso, por minuto. O aparelho aparece na dica. Âmbar: uma tela lenta, com a ponta lenta abaixo de 20 fps ou duas travadas por minuto ou mais. A regata roda na tela do anfitrião, então um anfitrião lento deixa a regata lenta para os dois.')}</p>
    </div>
  );
}
