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
    kind: (k: Kind | null) => of({ tg: 'Telegram', acct: t('Site account', 'Аккаунт на сайте', 'Cuenta del sitio', 'Konto auf der Seite', 'Site hesabı', 'Compte du site', 'Account del sito', 'Conta do site'), guest: t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité', 'Ospite', 'Visitante') }, k),
    dev: (v: string | null | undefined) => {
      if (!v) return null;
      const [d, tg] = v.split(' ');
      const name = of({ phone: t('Phone', 'Телефон', 'Móvil', 'Handy', 'Telefon', 'Téléphone', 'Telefono', 'Celular'), tablet: t('Tablet', 'Планшет', 'Tableta', 'Tablet', 'Tablet', 'Tablette', 'Tablet', 'Tablet'), desktop: t('Computer', 'Компьютер', 'Ordenador', 'Computer', 'Bilgisayar', 'Ordinateur', 'Computer', 'Computador') }, d);
      return tg ? `${name} · Telegram` : name;
    },
    ref: (k: string | null) => of({ tg: 'Telegram', site: t('The site', 'С сайта', 'El sitio', 'Die Seite', 'Site', 'Le site', 'Il sito', 'O site'), other: t('Another site', 'Другой сайт', 'Otro sitio', 'Eine andere Seite', 'Başka bir site', 'Un autre site', 'Un altro sito', 'Outro site'), direct: t('Direct', 'Напрямую', 'Directo', 'Direkt', 'Doğrudan', 'Direct', 'Diretto', 'Direto') }, k),
    race: (k: string | null) => of({ today: t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia'), free: t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera', 'Regata livre'), match: t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1'), drill: t('Drill', 'Упражнение', 'Ejercicio', 'Übung', 'Alıştırma', 'Entraînement', 'Esercizio', 'Treino') }, k),
    how: (k: string | undefined) => of({ finish: t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada'), restart: t('Restarted', 'Перезапуск', 'Reinicio', 'Neu gestartet', 'Yeniden başladı', 'Relancée', 'Ricominciata', 'Reiniciou'), change: t('Back to the set-up', 'Назад к настройке', 'Volver al ajuste', 'Zurück zur Einrichtung', 'Kurulum ekranına döndü', 'Retour aux réglages', 'Tornato alla configurazione', 'Voltou à configuração'), menu: t('Back to the menu', 'Назад в меню', 'Volver al menú', 'Zurück zum Menü', 'Menüye döndü', 'Retour au menu', 'Tornato al menu', 'Voltou ao menu'),
      close: t('Closed the page', 'Страница закрыта', 'Cerró la página', 'Seite geschlossen', 'Sayfayı kapattı', 'A fermé la page', 'Ha chiuso la pagina', 'Fechou a página'), hidden: t('Put the page away', 'Страница свёрнута', 'Dejó la página en segundo plano', 'Seite weggelegt', 'Sayfayı kenara koydu', 'A mis la page en arrière-plan', 'Ha messo la pagina in secondo piano', 'Deixou a página em segundo plano'), new: t('Began another race', 'Начата другая гонка', 'Empezó otra regata', 'Andere Regatta begonnen', 'Başka bir yarışa başladı', 'A commencé une autre régate', 'Ha iniziato un’altra regata', 'Começou outra regata') }, k),
    incident: (k: string | undefined) => of({ ocs: t('Over early', 'Фальстарт', 'Salida adelantada', 'Zu früh', 'Erken geçiş', 'Parti trop tôt', 'Partito in anticipo', 'Largada queimada'), fouled: t('Foul', 'Нарушение', 'Infracción', 'Foul', 'Faul', 'Faute', 'Infrazione', 'Infração'), touched: t('Touched a mark', 'Касание знака', 'Tocó una baliza', 'Marke berührt', 'Şamandıraya dokundu', 'A touché une bouée', 'Ha toccato una boa', 'Tocou uma boia'), bump: t('Collision', 'Столкновение', 'Colisión', 'Kollision', 'Çarpışma', 'Collision', 'Collisione', 'Colisão'),
      aground: t('Aground', 'На мели', 'Varado', 'Auf Grund', 'Karaya oturdu', 'Échoué', 'In secca', 'Encalhou'), missedLine: t('Missed the line', 'Мимо линии', 'No cruzó la línea', 'Linie verpasst', 'Hattı kaçırdı', 'A manqué la ligne', 'Linea mancata', 'Não cruzou a linha'), missedGate: t('Missed the gate', 'Мимо ворот', 'Se saltó la puerta', 'Tor verpasst', 'Kapıyı kaçırdı', 'A manqué la porte', 'Cancello mancato', 'Pulou o portão'), wrongSide: t('Wrong side', 'Не с той стороны', 'Lado equivocado', 'Falsche Seite', 'Yanlış taraf', 'Mauvais côté', 'Lato sbagliato', 'Lado errado'),
      genRecall: t('General recall', 'Общий отзыв', 'Llamada general', 'Allgemeiner Rückruf', 'Genel geri çağırma', 'Rappel général', 'Richiamo generale', 'Chamada geral'), barging: t('Barging', 'Навал на старте', 'Colarse en la salida', 'Drängeln', 'Sıkıştırma', 'Engagement abusif au départ', 'Barging', 'Forçou passagem na largada') }, k),
    wind: (k: string | null) => of({ light: t('Light', 'Слабый', 'Flojo', 'Leicht', 'Hafif', 'Léger', 'Leggero', 'Fraco'), medium: t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta', 'Moyen', 'Medio', 'Médio'), strong: t('Strong', 'Сильный', 'Fuerte', 'Stark', 'Kuvvetli', 'Fort', 'Forte', 'Forte') }, k),
    level: (k: string | undefined) => of({ auto: t('Auto', 'Авто', 'Auto', 'Auto', 'Otomatik', 'Auto', 'Auto', 'Auto'), high: t('High', 'Высокая', 'Alto', 'Hoch', 'Yüksek', 'Élevé', 'Alta', 'Alto'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta', 'Moyenne', 'Media', 'Média'), low: t('Low', 'Низкая', 'Bajo', 'Niedrig', 'Düşük', 'Bas', 'Bassa', 'Baixo'), lowest: t('Lowest', 'Ещё ниже', 'Mínimo', 'Minimal', 'En düşük', 'Minimal', 'Minimo', 'Mínimo') }, k),
    yacht: (id: string | null) => pick(YACHTS.find((y) => y.id === (id ?? 'jpk1050'))?.name, lang) ?? id,
    venue: (id: string | null) => (id ? pick(VENUES.find((v) => v.id === id)?.name, lang) ?? id : null),
    shape: (v: string | null) => (v && v in SHAPE_NAME ? pick(SHAPE_NAME[v as keyof typeof SHAPE_NAME], lang) : v),
  };
}
type W = ReturnType<typeof words>;

const playerName = (w: W, p: { who: string; kind: Kind | null; name: string | null }) => plainName(p.name) || (p.kind === 'tg' || p.kind === 'acct' ? w.kind(p.kind)! : `${w.t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité', 'Ospite', 'Visitante')} ${p.who.slice(0, 4)}`);
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
  const outcome = r.dsq ? 'DSQ' : r.finished_at && r.place != null ? `${r.place}/${r.boats ?? '–'}${r.secs != null ? ` · ${clock(r.secs)}` : ''}` : w.how(e?.how) ?? t('No end recorded', 'Конец не записан', 'Sin final registrado', 'Kein Ende erfasst', 'Bitiş kaydı yok', 'Fin non enregistrée', 'Nessuna fine registrata', 'Fim não registrado');
  const incidents = e?.inc ? Object.entries(e.inc).map(([k, n]) => `${w.incident(k)} × ${n}`).join(', ') : null;
  return (
    <li className={bad ? 'adm-log-i bad' : 'adm-log-i'}>
      <details open={bad}>
        <summary>
          <time dateTime={r.at}>{w.when(r.at)}</time>
          <b className="adm-log-h">{[w.venue(r.venue), w.yacht(r.yacht)].filter(Boolean).join(' · ')}</b>
          <span className="adm-log-o">{outcome}</span>
          {raceSlow(r) && <Flag bad>{p!.fps} FPS</Flag>}
          {raceLow(r) && <Flag bad>{t(`Rated ${r.rating} of 5`, `Оценка ${r.rating} из 5`, `Valorada ${r.rating} de 5`, `Mit ${r.rating} von 5 bewertet`, `5 üzerinden ${r.rating} puan`, `Notée ${r.rating} sur 5`, `Valutata ${r.rating} su 5`, `Avaliada com ${r.rating} de 5`)}</Flag>}
        </summary>
        {r.comment && <p className="adm-log-say">{r.comment}</p>}
        <Facts rows={[
          [t('Kind of race', 'Тип гонки', 'Tipo de regata', 'Art der Regatta', 'Yarış türü', 'Type de régate', 'Tipo di regata', 'Tipo de regata'), r.daily ? t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia') : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera', 'Regata livre')],
          [t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent', 'Vento', 'Vento'), w.wind(r.wind)],
          [t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours', 'Percorso', 'Percurso'), [w.shape(r.shape), r.laps != null ? t(`${r.laps} laps`, `Кругов: ${r.laps}`, `${r.laps} ${r.laps === 1 ? 'vuelta' : 'vueltas'}`, `${r.laps} Runden`, `${r.laps} tur`, `${r.laps} ${r.laps === 1 ? 'tour' : 'tours'}`, `${r.laps} ${r.laps === 1 ? 'giro' : 'giri'}`, `${r.laps} ${r.laps === 1 ? 'volta' : 'voltas'}`) : null].filter(Boolean).join(' · ')],
          [t('Boats', 'Яхт', 'Barcos', 'Boote', 'Tekneler', 'Bateaux', 'Barche', 'Barcos'), r.boats],
          [t('How it ended', 'Как закончилась', 'Cómo terminó', 'Wie sie endete', 'Nasıl bitti', 'Comment elle s’est terminée', 'Come è finita', 'Como terminou'), w.how(e?.how)],
          [t('Leg', 'Отрезок', 'Tramo', 'Schenkel', 'Ayak', 'Bord', 'Lato', 'Perna'), e?.leg != null ? `${e.leg}${e.legs != null ? `/${e.legs}` : ''}` : null],
          [t('Race clock', 'Часы гонки', 'Reloj de regata', 'Regattauhr', 'Yarış saati', 'Chrono de la régate', 'Cronometro di regata', 'Relógio da regata'), e?.clock != null ? clock(Math.max(0, e.clock)) : null],
          [t('Place then', 'Место на тот момент', 'Puesto entonces', 'Platz damals', 'O andaki sıra', 'Place à ce moment', 'Posizione allora', 'Posição no momento'), e?.place != null ? `${e.place}/${e.boats ?? '–'}` : null],
          [t('Minutes in the race', 'Минут в гонке', 'Minutos en la regata', 'Minuten in der Regatta', 'Yarışta geçen dakika', 'Minutes en régate', 'Minuti di regata', 'Minutos na regata'), e?.mins],
          [t('Penalties', 'Штрафы', 'Penalizaciones', 'Strafen', 'Cezalar', 'Pénalités', 'Penalità', 'Penalidades'), e?.pens || null],
          [t('Incidents', 'Происшествия', 'Incidentes', 'Vorfälle', 'Olaylar', 'Incidents', 'Incidenti', 'Incidentes'), incidents],
          [t('Last incident', 'Последнее происшествие', 'Último incidente', 'Letzter Vorfall', 'Son olay', 'Dernier incident', 'Ultimo incidente', 'Último incidente'), e?.last ? `${w.incident(e.last)}${e.ago != null ? t(`, ${e.ago} s before the end`, `, за ${e.ago} с до конца`, `, ${e.ago} s antes del final`, `, ${e.ago} s vor dem Ende`, `, bitişten ${e.ago} sn önce`, `, ${e.ago} s avant la fin`, `, ${e.ago} s prima della fine`, `, ${e.ago} s antes do fim`) : ''}` : null],
          [t('Frame rate', 'Частота кадров', 'Fotogramas por segundo', 'Bildrate', 'Kare hızı', 'Images par seconde', 'Frame rate', 'Taxa de quadros'), p?.fps != null ? `${p.fps} FPS${p.low != null ? t(`, slowest 5% ${p.low}`, `, худшие 5% — ${p.low}`, `, el 5 % más lento ${p.low}`, `, langsamste 5 % ${p.low}`, `, en yavaş %5: ${p.low}`, `, 5 % les plus lents ${p.low}`, `, 5% più lento ${p.low}`, `, 5% mais lentos ${p.low}`) : ''}` : null],
          [t('Stalls a minute', 'Рывков в минуту', 'Tirones por minuto', 'Ruckler pro Minute', 'Dakikada takılma', 'Saccades par minute', 'Blocchi al minuto', 'Travamentos por minuto'), p?.stall],
          [t('Graphics', 'Графика', 'Gráficos', 'Grafik', 'Grafik', 'Graphismes', 'Grafica', 'Gráficos'), p?.q ? `${p.q0 && p.q0 !== p.q ? `${w.level(p.q0)} → ` : ''}${w.level(p.q)}${p.gfx ? ` (${w.level(p.gfx)})` : ''}` : null],
          [t('Battery saver', 'Экономия батареи', 'Ahorro de batería', 'Energiesparmodus', 'Pil tasarrufu', 'Économie de batterie', 'Risparmio batteria', 'Economia de bateria'), p?.saver ? t('On', 'Вкл.', 'Sí', 'Ein', 'Açık', 'Oui', 'Attivo', 'Ligado') : null],
          [t('Device', 'Устройство', 'Dispositivo', 'Gerät', 'Cihaz', 'Appareil', 'Dispositivo', 'Aparelho'), p ? [w.dev(p.dev ? `${p.dev}${p.tg ? ' tg' : ''}` : null), p.os, p.br].filter(Boolean).join(' · ') : null],
          [t('Graphics chip', 'Видеочип', 'Chip gráfico', 'Grafikchip', 'Grafik çipi', 'Puce graphique', 'Chip grafico', 'Chip gráfico'), p?.gpu],
          [t('Screen', 'Экран', 'Pantalla', 'Bildschirm', 'Ekran', 'Écran', 'Schermo', 'Tela'), p?.w && p?.h ? `${p.w}×${p.h}${p.dpr ? ` @${p.dpr}x` : ''}` : null],
          [t('Cores and memory', 'Ядра и память', 'Núcleos y memoria', 'Kerne und Speicher', 'Çekirdek ve bellek', 'Cœurs et mémoire', 'Core e memoria', 'Núcleos e memória'), p?.cores ? `${p.cores}${p.mem ? t(` · ${p.mem} GB`, ` · ${p.mem} ГБ`, ` · ${p.mem} GB`, ` · ${p.mem} GB`, ` · ${p.mem} GB`, ` · ${p.mem} Go`, ` · ${p.mem} GB`, ` · ${p.mem} GB`) : ''}` : null],
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
          <b className="adm-log-h">{[t('Visit', 'Визит', 'Visita', 'Besuch', 'Ziyaret', 'Visite', 'Visita', 'Visita'), w.dev(v.dev ? `${v.dev}${v.tg === 1 ? ' tg' : ''}` : null)].filter(Boolean).join(' · ')}</b>
          {v.failed_at && <Flag bad>{t('Load failed', 'Не загрузилась', 'Fallo de carga', 'Laden fehlgeschlagen', 'Yükleme başarısız', 'Échec du chargement', 'Caricamento fallito', 'Falha ao carregar')}</Flag>}
          {v.gave_up_at && <Flag bad>{v.pct != null ? t(`Gave up at ${v.pct}%`, `Бросил на ${v.pct}%`, `Se fue al ${v.pct} %`, `Bei ${v.pct} % aufgegeben`, `%${v.pct}’de vazgeçti`, `Abandon à ${v.pct} %`, `Abbandonato al ${v.pct}%`, `Desistiu em ${v.pct}%`) : t('Gave up loading', 'Бросил загрузку', 'Dejó la carga', 'Laden aufgegeben', 'Yüklemeden vazgeçti', 'Chargement abandonné', 'Caricamento abbandonato', 'Desistiu de carregar')}</Flag>}
          {v.lost === 1 && <Flag bad>{t('3D lost', '3D потеряно', '3D perdido', '3D verloren', '3D kayboldu', '3D perdue', '3D perso', '3D perdido')}</Flag>}
          {errors.length > 0 && <Flag bad>{t(`Errors: ${errors.length}`, `Ошибок: ${errors.length}`, `Errores: ${errors.length}`, `Fehler: ${errors.length}`, `Hatalar: ${errors.length}`, `Erreurs : ${errors.length}`, `Errori: ${errors.length}`, `Erros: ${errors.length}`)}</Flag>}
          {!bad && <Flag>{t('No problem', 'Без проблем', 'Sin problemas', 'Kein Problem', 'Sorun yok', 'Aucun problème', 'Nessun problema', 'Sem problemas')}</Flag>}
        </summary>
        {v.why && <p className="adm-log-say">{v.why}</p>}
        {errors.length > 0 && (
          <ul className="adm-log-errs">
            {errors.map((e, i) => <li key={i}><code>{e.m}</code><span>{[e.src, e.n && e.n > 1 ? `× ${e.n}` : null].filter(Boolean).join(' ')}</span></li>)}
          </ul>
        )}
        <Facts rows={[
          [t('Came from', 'Откуда пришёл', 'De dónde vino', 'Gekommen von', 'Geldiği yer', 'Provenance', 'Arrivato da', 'Veio de'), w.ref(v.ref)],
          [t('Opened for', 'Открыл для', 'Abrió para', 'Geöffnet für', 'Açık kalma süresi', 'Ouverte pour', 'Aperta per', 'Abriu para'), w.race(v.kind)],
          [t('Load time', 'Загрузка', 'Tiempo de carga', 'Ladezeit', 'Yüklenme süresi', 'Temps de chargement', 'Tempo di caricamento', 'Tempo de carregamento'), v.load != null ? t(`${v.load} s`, `${v.load} с`, `${v.load} s`, `${v.load} s`, `${v.load} sn`, `${v.load} s`, `${v.load} s`, `${v.load} s`) : null],
          [t('Minutes on the page', 'Минут на странице', 'Minutos en la página', 'Minuten auf der Seite', 'Sayfada geçen dakika', 'Minutes sur la page', 'Minuti sulla pagina', 'Minutos na página'), v.mins],
          [t('Races begun', 'Гонок начато', 'Regatas empezadas', 'Begonnene Regatten', 'Başlayan yarışlar', 'Régates commencées', 'Regate iniziate', 'Regatas iniciadas'), v.races],
          [t('Races finished', 'Гонок закончено', 'Regatas terminadas', 'Beendete Regatten', 'Biten yarışlar', 'Régates terminées', 'Regate finite', 'Regatas terminadas'), v.finished],
          [t('Last heard from', 'Последний сигнал', 'Última señal', 'Zuletzt gehört', 'Son görülme', 'Dernier signal', 'Ultimo contatto', 'Último sinal'), v.last_at ? w.when(v.last_at) : null],
          [t('How to play opened', 'Открывал «Как играть»', 'Abrió «Cómo jugar»', '„So spielst du“ geöffnet', '“Nasıl oynanır” açıldı', 'A ouvert « Comment jouer »', 'Come si gioca aperto', 'Abriu “Como jogar”'), v.howto === 1 ? t('Yes', 'Да', 'Sí', 'Ja', 'Evet', 'Oui', 'Sì', 'Sim') : null],
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
      <Link className="adm-log-back" href={logHref(null, days)}><IconBack s={16} />{t('All players with problems', 'Все игроки с проблемами', 'Todos los jugadores con problemas', 'Alle Spieler mit Problemen', 'Sorunu olan tüm oyuncular', 'Tous les joueurs avec des problèmes', 'Tutti i giocatori con problemi', 'Todos os jogadores com problemas')}</Link>
      <div className="adm-k"><IconCrew /><span className="kicker">{t('Player’s log', 'Журнал игрока', 'Registro del jugador', 'Protokoll des Spielers', 'Oyuncunun günlüğü', 'Journal du joueur', 'Registro del giocatore', 'Registro do jogador')}</span></div>
      <h2 className="adm-log-who">{playerName(w, r)}</h2>
      <p className="adm-pl-sub">{playerSub(w, r)}{r.first ? ` · ${t('first seen', 'впервые', 'visto por primera vez', 'zuerst gesehen', 'ilk görülme', 'vu pour la première fois', 'visto la prima volta', 'visto pela primeira vez')} ${w.when(r.first)}` : ''}{r.last ? ` · ${t('last seen', 'был', 'visto por última vez', 'zuletzt gesehen', 'son görülme', 'vu pour la dernière fois', 'visto l’ultima volta', 'visto pela última vez')} ${w.when(r.last)}` : ''}</p>
      <div className="adm-tiles adm-log-tiles">
        <Tile k={t('Visits', 'Визитов', 'Visitas', 'Besuche', 'Ziyaretler', 'Visites', 'Visite', 'Visitas')} v={String(r.visits.length)} />
        <Tile k={t('With a problem', 'С проблемой', 'Con un problema', 'Mit Problem', 'Sorunlu', 'Avec un problème', 'Con un problema', 'Com problema')} v={String(r.visits.filter(visitBad).length)} />
        <Tile k={t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas')} v={String(r.races.length)} />
        <Tile k={t('Slow races', 'Медленных гонок', 'Regatas lentas', 'Langsame Regatten', 'Yavaş yarışlar', 'Régates lentes', 'Regate lente', 'Regatas lentas')} v={String(r.races.filter(raceSlow).length)} />
        <Tile k={t('Low ratings', 'Низких оценок', 'Valoraciones bajas', 'Schlechte Bewertungen', 'Düşük puanlar', 'Notes basses', 'Valutazioni basse', 'Notas baixas')} v={String(r.races.filter(raceLow).length)} />
      </div>
      {entries.length ? <ol className="adm-log">{entries.map((e) => e.el)}</ol> : <p className="hint">{t('Nothing recorded for this player in this period.', 'За этот период у игрока ничего не записано.', 'Nada registrado para este jugador en este periodo.', 'Für diesen Spieler wurde in diesem Zeitraum nichts erfasst.', 'Bu dönemde bu oyuncu için kayıt yok.', 'Rien d’enregistré pour ce joueur sur cette période.', 'Nulla registrato per questo giocatore in questo periodo.', 'Nada registrado para este jogador neste período.')}</p>}
      <p className="hint">{t(`Times in UTC. A visit keeps its first five different errors, each cut to 140 characters.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Only the latest ${MAX_VISITS} visits and ${MAX_RACES} races are shown.` : ''}`,
        `Время по UTC. Визит хранит первые пять разных ошибок, каждая обрезана до 140 знаков.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Показаны только последние ${MAX_VISITS} визитов и ${MAX_RACES} гонок.` : ''}`, `Horas en UTC. Una visita guarda sus cinco primeros errores distintos, cada uno cortado a 140 caracteres.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Solo se muestran las últimas ${MAX_VISITS} visitas y las últimas ${MAX_RACES} regatas.` : ''}`, `Zeiten in UTC. Ein Besuch behält seine ersten fünf verschiedenen Fehler, jeder auf 140 Zeichen gekürzt.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Nur die letzten ${MAX_VISITS} Besuche und ${MAX_RACES} Regatten werden gezeigt.` : ''}`, `Saatler UTC. Bir ziyaret ilk beş farklı hatasını tutar, her biri 140 karaktere kısaltılır.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Yalnızca son ${MAX_VISITS} ziyaret ve ${MAX_RACES} yarış gösteriliyor.` : ''}`, `Heures en UTC. Une visite garde ses cinq premières erreurs différentes, chacune coupée à 140 caractères.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Seules les ${MAX_VISITS} dernières visites et les ${MAX_RACES} dernières régates sont affichées.` : ''}`, `Orari in UTC. Una visita conserva i suoi primi cinque errori diversi, ciascuno tagliato a 140 caratteri.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Sono mostrate solo le ultime ${MAX_VISITS} visite e le ultime ${MAX_RACES} regate.` : ''}`, `Horários em UTC. Uma visita guarda seus cinco primeiros erros diferentes, cada um cortado em 140 caracteres.${r.visits.length >= MAX_VISITS || r.races.length >= MAX_RACES ? ` Só são mostradas as últimas ${MAX_VISITS} visitas e ${MAX_RACES} regatas.` : ''}`)}</p>
    </div>
  );
}

// the players with a problem in the period, the latest first
function People({ w, data, days }: { w: W; data: Logs; days: number }) {
  const { t } = w, T = data.totals;
  const cols: Col[] = [
    { label: t('Failed', 'Сбой', 'Fallo', 'Fehlgeschlagen', 'Başarısız', 'Échec', 'Fallito', 'Falhou') }, { label: t('Gave up', 'Бросил', 'Se fue', 'Aufgegeben', 'Vazgeçti', 'Abandon', 'Abbandonato', 'Desistiu') }, { label: t('3D lost', '3D', '3D perdido', '3D verloren', '3D kayboldu') }, { label: t('Errors', 'Ошибки', 'Errores', 'Fehler', 'Hatalar', 'Erreurs', 'Errori', 'Erros') },
    { label: t('Slow', 'Медленно', 'Lento', 'Langsam', 'Yavaş', 'Lent', 'Lenta', 'Lenta') }, { label: t('Low rating', 'Оценка', 'Valoración baja', 'Schlechte Bewertung', 'Düşük puan', 'Note basse', 'Valutazione bassa', 'Nota baixa') }, { label: t('Device', 'Устройство', 'Dispositivo', 'Gerät', 'Cihaz', 'Appareil', 'Dispositivo', 'Aparelho'), asc: true }, { label: t('Last problem', 'Последняя проблема', 'Último problema', 'Letztes Problem', 'Son sorun', 'Dernier problème', 'Ultimo problema', 'Último problema') },
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
      <div className="adm-k"><IconClock /><span className="kicker">{t('Players with problems', 'Игроки с проблемами', 'Jugadores con problemas', 'Spieler mit Problemen', 'Sorun yaşayan oyuncular', 'Joueurs en difficulté', 'Giocatori con problemi', 'Jogadores com problemas')}</span></div>
      <div className="adm-tiles adm-log-tiles">
        <Tile k={t('Players affected', 'Игроков затронуто', 'Jugadores afectados', 'Betroffene Spieler', 'Etkilenen oyuncular', 'Joueurs concernés', 'Giocatori coinvolti', 'Jogadores afetados')} v={String(T.people)} />
        <Tile k={t('Visits with a problem', 'Визитов с проблемой', 'Visitas con problema', 'Besuche mit Problem', 'Sorunlu ziyaretler', 'Visites avec un problème', 'Visite con un problema', 'Visitas com problema')} v={`${T.bad}/${T.visits}`} />
        <Tile k={t('Loads failed', 'Не загрузилось', 'Cargas fallidas', 'Laden fehlgeschlagen', 'Başarısız yüklemeler', 'Chargements échoués', 'Caricamenti falliti', 'Carregamentos com falha')} v={String(T.failed)} />
        <Tile k={t('Loads given up', 'Брошено загрузок', 'Cargas abandonadas', 'Laden aufgegeben', 'Vazgeçilen yüklemeler', 'Chargements abandonnés', 'Caricamenti abbandonati', 'Carregamentos abandonados')} v={String(T.gave_up)} />
        <Tile k={t('3D lost', '3D потеряно', '3D perdido', '3D verloren', '3D kayboldu', '3D perdue', '3D perso', '3D perdido')} v={String(T.lost)} />
        <Tile k={t('Page errors', 'Ошибок на странице', 'Errores de página', 'Seitenfehler', 'Sayfa hataları', 'Erreurs de page', 'Errori della pagina', 'Erros de página')} v={String(T.errors)} />
        <Tile k={t('Slow races', 'Медленных гонок', 'Regatas lentas', 'Langsame Regatten', 'Yavaş yarışlar', 'Régates lentes', 'Regate lente', 'Regatas lentas')} v={String(T.slow)} />
        <Tile k={t('Low ratings', 'Низких оценок', 'Valoraciones bajas', 'Schlechte Bewertungen', 'Düşük puanlar', 'Notes basses', 'Valutazioni basse', 'Notas baixas')} v={String(T.low)} />
      </div>
      {data.people.length > 0 ? (
        <section className="adm-tab">
          <h3 className="adm-tab-h">{t('Open a player for their full log, or click a column to sort by it', 'Откройте игрока, чтобы увидеть весь журнал, или нажмите на столбец, чтобы отсортировать', 'Abre un jugador para ver su registro completo, o pulsa una columna para ordenar', 'Öffne einen Spieler für sein ganzes Protokoll oder klicke auf eine Spalte, um danach zu sortieren', 'Tam günlüğü görmek için bir oyuncuyu aç ya da sıralamak için bir sütuna tıkla', 'Ouvre un joueur pour voir son journal complet, ou clique sur une colonne pour trier', 'Apri un giocatore per il suo registro completo, o clicca una colonna per ordinare in base a essa', 'Abra um jogador para ver o registro completo, ou clique em uma coluna para ordenar por ela')}</h3>
          <PlayersTable first={{ label: t('Player', 'Игрок', 'Jugador', 'Spieler', 'Oyuncu', 'Joueur', 'Giocatore', 'Jogador'), asc: true }} cols={cols} rows={rows} start={cols.length}
            label={t('Players with problems', 'Игроки с проблемами', 'Jugadores con problemas', 'Spieler mit Problemen', 'Sorun yaşayan oyuncular', 'Joueurs en difficulté', 'Giocatori con problemi', 'Jogadores com problemas')} newLabel={t('New', 'Новый', 'Nuevo', 'Neu', 'Yeni', 'Nouveau', 'Nuovo', 'Novo')} />
        </section>
      ) : <p className="hint">{t('No player had a problem in this period.', 'За этот период проблем ни у кого не было.', 'Ningún jugador tuvo problemas en este periodo.', 'In diesem Zeitraum hatte kein Spieler ein Problem.', 'Bu dönemde sorunu olan oyuncu yok.', 'Aucun joueur n’a eu de problème sur cette période.', 'Nessun giocatore ha avuto problemi in questo periodo.', 'Nenhum jogador teve problema neste período.')}</p>}
      <p className="hint">{t(`A problem is a load that failed or was given up, the 3D lost, an error on the page, a race under ${SLOW} frames a second, or one rated two stars or fewer. A guest is a browser. Times in UTC. The latest 200 players are shown.`,
        `Проблема — это сбой или брошенная загрузка, потеря 3D, ошибка на странице, гонка ниже ${SLOW} кадров в секунду или оценка в две звезды и ниже. Гость — это браузер. Время по UTC. Показаны последние 200 игроков.`, `Un problema es una carga que falló o se abandonó, el 3D perdido, un error en la página, una regata por debajo de ${SLOW} fotogramas por segundo o una valorada con dos estrellas o menos. Un invitado es un navegador. Horas en UTC. Se muestran los últimos 200 jugadores.`, `Ein Problem ist ein Laden, das fehlschlug oder aufgegeben wurde, verlorenes 3D, ein Fehler auf der Seite, eine Regatta unter ${SLOW} Bildern pro Sekunde oder eine mit zwei Sternen oder weniger. Ein Gast ist ein Browser. Zeiten in UTC. Gezeigt werden die letzten 200 Spieler.`, `Sorun; başarısız olan ya da vazgeçilen bir yükleme, kaybolan 3D, sayfada bir hata, saniyede ${SLOW} karenin altındaki bir yarış ya da iki yıldız veya daha az puan almış bir yarıştır. Misafir bir tarayıcıdır. Saatler UTC. Son 200 oyuncu gösteriliyor.`, `Un problème, c’est un chargement échoué ou abandonné, la 3D perdue, une erreur sur la page, une régate sous ${SLOW} images par seconde, ou une régate notée deux étoiles ou moins. Un invité est un navigateur. Heures en UTC. Les 200 derniers joueurs sont affichés.`, `Un problema è un caricamento fallito o abbandonato, il 3D perso, un errore sulla pagina, una regata sotto i ${SLOW} fotogrammi al secondo, o una regata valutata due stelle o meno. Un ospite è un browser. Orari in UTC. Sono mostrati gli ultimi 200 giocatori.`, `Um problema é um carregamento que falhou ou foi abandonado, o 3D perdido, um erro na página, uma regata abaixo de ${SLOW} quadros por segundo ou uma avaliada com duas estrelas ou menos. Um convidado é um navegador. Horários em UTC. São mostrados os últimos 200 jogadores.`)}</p>
    </div>
  );
}

export function AdminLogs({ lang, data, days }: { lang: Lang; data: Logs; days: number }) {
  const w = words(lang);
  return data.report ? <Report w={w} report={data.report} days={days} /> : <People w={w} data={data} days={days} />;
}
