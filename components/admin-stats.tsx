import { pick, tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { SHAPE_NAME } from '@/lib/race';
import { DayChart, type DaySlot } from './admin-days';
import { IconDevice, IconTrophy } from './ui';

// The admin's look at the game: how the players race and how the game runs on their devices, over the last `days`
// (7, 30 or 90). Every race the game posts (public/game/stats.js → api/game.mjs in the iyt-test repo → public.game_races)
// is summed up by the database (regatta_admin_stats, supabase/migrations/20261117120000_game_races_perf.sql there), which
// answers an admin alone. A race's perf is how the game ran through it: the middle frame's rate (fps), the slow end's
// (the 95th percentile frame), the stalls (frames over 100 ms) a minute, the graphics level it ended on, the device.
// Drawn on the server, per request: how they race on /admin/game, how the game runs on /admin/tech.

type Group = {
  k: string; v: string | null; n: number; fin: number; dsq: number; top3: number; who: number; down: number | null;
  np: number; fps: number | null; low: number | null; stall: number | null; load: number | null; slow: number; saver: number | null;
  qh: number; qm: number; ql: number;
};
type Day = { d: string; n: number; fin: number; who: number; fps: number | null };
export type Stats = { since: string; groups: Group[]; days: Day[] };

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const num = (x: number | null | undefined, k = 0) => (x == null ? '–' : x.toFixed(k));

// what a group's key and value are called
function names(lang: Lang) {
  const t = tx(lang);
  return {
    t,
    yachtName: (id: string | null) => pick(YACHTS.find((y) => y.id === id)?.name, lang) ?? id ?? '–',
    venueName: (id: string | null) => (id ? pick(VENUES.find((v) => v.id === id)?.name, lang) ?? id : t('Not kept (older races)', 'Не записано (старые гонки)', 'No guardado (regatas anteriores)', 'Nicht erfasst (ältere Regatten)', 'Tutulmadı (eski yarışlar)', 'Non conservé (anciennes régates)')),
    wind: (v: string | null) => ({ light: t('Light', 'Слабый', 'Flojo', 'Leicht', 'Hafif', 'Léger'), medium: t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta', 'Moyen'), strong: t('Strong', 'Сильный', 'Fuerte', 'Stark', 'Kuvvetli', 'Fort') }[v || ''] ?? '–'),
    shape: (v: string | null) => (v && v in SHAPE_NAME ? pick(SHAPE_NAME[v as keyof typeof SHAPE_NAME], lang) : v ?? '–'),
    dev: (v: string | null) => {
      const [d, tg] = (v || '').split(' ');
      const name = { phone: t('Phone', 'Телефон', 'Móvil', 'Handy', 'Telefon', 'Téléphone'), tablet: t('Tablet', 'Планшет', 'Tableta', 'Tablet', 'Tablet', 'Tablette'), desktop: t('Computer', 'Компьютер', 'Ordenador', 'Computer', 'Bilgisayar', 'Ordinateur') }[d] ?? d;
      return tg ? `${name} · Telegram` : `${name} · ${t('browser', 'браузер', 'navegador', 'Browser', 'tarayıcı', 'navigateur')}`;
    },
    level: (v: string | null) => ({ high: t('High', 'Высокая', 'Alto', 'Hoch', 'Yüksek', 'Élevé'), medium: t('Medium', 'Средняя', 'Media', 'Mittel', 'Orta', 'Moyenne'), low: t('Low', 'Низкая', 'Bajo', 'Niedrig', 'Düşük', 'Bas') }[v || ''] ?? '–'),
    plain: (v: string | null) => v ?? '–',
  };
}
const groups = (stats: Stats, k: string) => stats.groups.filter((g) => g.k === k);
export const hasStats = (stats: Stats | null): stats is Stats => !!stats && groups(stats, 'all').length > 0;

// how they race: the races started, finished, by whom, the disqualified; a day's races; tables by yacht, wind, venue,
// course and kind of race (a group's races, how many finished, made the podium, were disqualified, her median place)
export function AdminRacing({ lang, stats }: { lang: Lang; stats: Stats }) {
  const { t, yachtName, venueName, wind, shape } = names(lang);
  const of = (k: string) => groups(stats, k), all = of('all')[0];
  const raceRows = (k: string, name: (v: string | null) => string, keep = (g: Group) => g.v != null) => of(k).filter(keep).map((g) => ({
    key: g.v ?? '–', name: name(g.v), cells: [String(g.n), pct(g.fin, g.n), pct(g.top3, g.fin), pct(g.dsq, g.n), g.down == null ? '–' : `${Math.round(100 * g.down)}%`, num(g.fps)],
  }));
  const raceHead = [t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates'), t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée'), t('Top 3', 'Топ-3', 'Top 3', 'Top 3', 'İlk 3', 'Top 3'), t('DSQ', 'DSQ'), t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place'), t('FPS', 'FPS')];
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconTrophy /><span className="kicker">{t('How they race', 'Как гоняются', 'Cómo compiten', 'Wie sie segeln', 'Nasıl yarışıyorlar', 'Comment ils régatent')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Races started', 'Гонок начато', 'Regatas empezadas', 'Gestartete Regatten', 'Başlayan yarışlar', 'Régates lancées')} v={String(all.n)} />
        <Tile k={t('Finished', 'Дошли до финиша', 'Llegaron', 'Im Ziel', 'Bitti', 'Arrivés')} v={pct(all.fin, all.n)} />
        <Tile k={t('Players signed in', 'Игроков с аккаунтом', 'Jugadores con sesión', 'Angemeldete Spieler', 'Giriş yapan oyuncular', 'Joueurs connectés')} v={String(all.who)} />
        <Tile k={t('Disqualified', 'Дисквалификаций', 'Descalificados', 'Disqualifiziert', 'Diskalifiye', 'Disqualifiés')} v={pct(all.dsq, all.n)} />
      </div>
      <DayBars lang={lang} days={stats.days} since={stats.since} />
      <Table title={t('By yacht', 'По яхтам', 'Por yate', 'Nach Yacht', 'Yata göre', 'Par yacht')} first={t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Yacht')} head={raceHead} rows={raceRows('yacht', yachtName)} />
      <Table title={t('By wind', 'По ветру', 'Por viento', 'Nach Wind', 'Rüzgâra göre', 'Par vent')} first={t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent')} head={raceHead} rows={raceRows('wind', wind)} />
      <Table title={t('By venue', 'По месту', 'Por sede', 'Nach Revier', 'Alana göre', 'Par plan d’eau')} first={t('Venue', 'Место', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau')} head={raceHead} rows={raceRows('venue', venueName, () => true)} />
      <Table title={t('By course and race', 'По дистанции и виду гонки', 'Por recorrido y regata', 'Nach Bahn und Regatta', 'Parkura ve yarışa göre', 'Par parcours et régate')} first={t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours')} head={raceHead}
        rows={[...raceRows('shape', shape), ...raceRows('kind', (v) => (v === 'daily' ? t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour') : t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre')))]} />
      <p className="hint">{t('Finished and DSQ: of the races started. Top 3: of the races finished. Place: the median, 0% first in the fleet, 100% last. FPS: the median frame rate of the races measured.',
        'Финиш и DSQ — от начатых гонок. Топ-3 — от финишировавших. Место — медиана: 0% — первым во флоте, 100% — последним. FPS — медианная частота кадров в измеренных гонках.', 'Terminadas y DSQ: de las regatas empezadas. Top 3: de las regatas terminadas. Puesto: la mediana, 0 % primero de la flota, 100 % último. FPS: la mediana de fotogramas por segundo de las regatas medidas.', 'Im Ziel und DSQ: von den gestarteten Regatten. Top 3: von den beendeten Regatten. Platz: der Median, 0 % für den Ersten im Feld, 100 % für den Letzten. FPS: die mittlere Bildrate der gemessenen Regatten.', 'Bitirenler ve DSQ: başlayan yarışların. İlk 3: bitirilen yarışların. Sıra: ortanca; %0 filoda birinci, %100 sonuncu. FPS: ölçülen yarışların ortanca kare hızı.', 'Terminées et DSQ : sur les régates lancées. Top 3 : sur les régates terminées. Place : la médiane, 0 % premier de la flotte, 100 % dernier. FPS : la fréquence d’images médiane des régates mesurées.')}</p>
    </div>
  );
}

// how the game runs: the races measured, their median frame rates, how many ran under 30, stalls, the saver, the
// level they ended on and the load, all told and by device, chip, level, system and browser, venue
export function AdminPerf({ lang, stats }: { lang: Lang; stats: Stats }) {
  const { t, venueName, dev, level, plain } = names(lang);
  const of = (k: string) => groups(stats, k), all = of('all')[0];
  const perfRows = (k: string, name: (v: string | null) => string, limit = 50) => of(k).filter((g) => g.v != null && g.np > 0).sort((a, b) => b.np - a.np).slice(0, limit).map((g) => ({
    key: g.v ?? '–', name: name(g.v),
    cells: [String(g.np), num(g.fps), num(g.low), pct(g.slow, g.np), num(g.stall, 1), g.saver == null ? '–' : `${Math.round(100 * g.saver)}%`,
      `${pct(g.qh, g.np)} / ${pct(g.qm, g.np)} / ${pct(g.ql, g.np)}`, g.load == null ? '–' : `${num(g.load, 1)} ${t('s', 'с', 's', 's', 'sn', 's')}`],
  }));
  const perfHead = [t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates'), t('FPS', 'FPS'), t('Slow 5%', 'Худшие 5%', '5 % lento', 'Langsamste 5 %', 'En yavaş %5', '5 % lents'), t('Under 30', 'Ниже 30', 'Menos de 30', 'Unter 30', '30 altı', 'Sous 30'), t('Stalls/min', 'Рывков/мин', 'Tirones/min', 'Ruckler/min', 'Takılma/dk', 'Saccades/min'), t('Saver', 'Экономия', 'Ahorro', 'Sparmodus', 'Tasarruf', 'Économie'), t('High / Med / Low', 'Выс / Сред / Низ', 'Alto / Medio / Bajo', 'Hoch / Mittel / Niedrig', 'Yüksek / Orta / Düşük', 'Haute / Moy. / Basse'), t('Load', 'Загрузка', 'Carga', 'Laden', 'Yükleme', 'Chargement')];
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconDevice /><span className="kicker">{t('How the game runs', 'Как работает игра', 'Cómo funciona el juego', 'Wie das Spiel läuft', 'Oyun nasıl çalışıyor', 'Comment tourne le jeu')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Races measured', 'Гонок измерено', 'Regatas medidas', 'Gemessene Regatten', 'Ölçülen yarışlar', 'Régates mesurées')} v={String(all.np)} />
        <Tile k={t('Median FPS', 'Медиана FPS', 'FPS medianos', 'Mittlere FPS', 'Ortanca FPS', 'FPS médians')} v={num(all.fps)} />
        <Tile k={t('Under 30 FPS', 'Ниже 30 FPS', 'Menos de 30 FPS', 'Unter 30 FPS', '30 FPS altı', 'Sous 30 FPS')} v={pct(all.slow, all.np)} />
        <Tile k={t('Stalls a minute', 'Рывков в минуту', 'Tirones por minuto', 'Ruckler pro Minute', 'Dakikada takılma', 'Saccades par minute')} v={num(all.stall, 1)} />
        <Tile k={t('To the first race', 'До первой гонки', 'Hasta la primera regata', 'Bis zur ersten Regatta', 'İlk yarışa kadar', 'Jusqu’à la première régate')} v={all.load == null ? '–' : `${num(all.load, 1)} ${t('s', 'с', 's', 's', 'sn', 's')}`} />
      </div>
      <Table title={t('By device', 'По устройству', 'Por dispositivo', 'Nach Gerät', 'Cihaza göre', 'Par appareil')} first={t('Device', 'Устройство', 'Dispositivo', 'Gerät', 'Cihaz', 'Appareil')} head={perfHead} rows={perfRows('dev', dev)} />
      <Table title={t('By graphics chip', 'По видеочипу', 'Por chip gráfico', 'Nach Grafikchip', 'Grafik çipine göre', 'Par puce graphique')} first={t('Chip', 'Чип', 'Chip', 'Chip', 'Çip', 'Puce')} head={perfHead} rows={perfRows('gpu', plain, 15)} />
      <Table title={t('By graphics level', 'По уровню графики', 'Por nivel de gráficos', 'Nach Grafikstufe', 'Grafik düzeyine göre', 'Par niveau graphique')} first={t('Level', 'Уровень', 'Nivel', 'Stufe', 'Düzey', 'Niveau')} head={perfHead} rows={perfRows('q', level)} />
      <Table title={t('By system and browser', 'По системе и браузеру', 'Por sistema y navegador', 'Nach System und Browser', 'Sisteme ve tarayıcıya göre', 'Par système et navigateur')} first={t('System', 'Система', 'Sistema', 'System', 'Sistem', 'Système')} head={perfHead} rows={[...perfRows('os', plain), ...perfRows('br', plain)]} />
      <Table title={t('By venue', 'По месту', 'Por sede', 'Nach Revier', 'Alana göre', 'Par plan d’eau')} first={t('Venue', 'Место', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau')} head={perfHead} rows={perfRows('venue', venueName)} />
      <p className="hint">{t('Each race the game measures its frames: FPS is the middle frame’s rate, Slow 5% the rate of the slowest twentieth; a stall is a frame over 0.1 s. The level is the one a race ended on (Auto steps down on a slow device). Load: from opening the page to the first race. Races before 17 November weren’t measured.',
        'Игра измеряет кадры в каждой гонке: FPS — частота среднего кадра, «Худшие 5%» — частота самой медленной двадцатой части кадров; рывок — кадр дольше 0,1 с. Уровень — тот, на котором гонка закончилась (Авто понижает его на медленном устройстве). Загрузка — от открытия страницы до первой гонки. Гонки до 17 ноября не измерялись.', 'En cada regata el juego mide sus fotogramas: FPS es la velocidad del fotograma central, 5 % lento la del vigésimo más lento; un tirón es un fotograma de más de 0,1 s. El nivel es en el que terminó una regata (Auto baja en un dispositivo lento). Carga: desde que se abre la página hasta la primera regata. Las regatas anteriores al 17 de noviembre no se midieron.', 'Bei jeder Regatta misst das Spiel seine Bilder: FPS ist die Rate des mittleren Bildes, Langsamste 5 % die Rate des langsamsten Zwanzigstels; ein Ruckler ist ein Bild über 0,1 s. Die Stufe ist die, auf der eine Regatta endete (Auto schaltet auf einem langsamen Gerät herunter). Laden: vom Öffnen der Seite bis zur ersten Regatta. Regatten vor dem 17. November wurden nicht gemessen.', 'Oyun her yarışta karelerini ölçer: FPS ortadaki karenin hızı, En yavaş %5 en yavaş yirmide birinin hızıdır; takılma 0,1 sn’yi aşan bir karedir. Düzey, yarışın bittiği düzeydir (Otomatik, yavaş bir cihazda basamak düşer). Yükleme: sayfanın açılışından ilk yarışa kadar. 17 Kasım’dan önceki yarışlar ölçülmedi.', 'À chaque régate, le jeu mesure ses images : FPS est la fréquence de l’image médiane, 5 % lents celle du vingtième le plus lent ; une saccade est une image de plus de 0,1 s. Le niveau est celui sur lequel une régate s’est terminée (Auto descend d’un cran sur un appareil lent). Chargement : de l’ouverture de la page à la première régate. Les régates avant le 17 novembre n’ont pas été mesurées.')}</p>
    </div>
  );
}

export function Tile({ k, v }: { k: string; v: string }) {
  return <div className="adm-tile"><span className="adm-tile-k">{k}</span><b>{v}</b></div>;
}

export function Table({ title, first, head, rows }: { title: string; first: string; head: string[]; rows: { key: string; name: string; cells: string[] }[] }) {
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
  const slots: DaySlot[] = Array.from({ length: n }, (_, i) => {
    const d = new Date(from + i * 864e5).toISOString().slice(0, 10), x = by.get(d);
    return { d, n: x?.n ?? 0, tip: x ? [[t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates'), String(x.n)], [t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée'), pct(x.fin, x.n)], [t('Players', 'Игроков', 'Jugadores', 'Spieler', 'Oyuncu', 'Joueurs'), String(x.who)], [t('FPS', 'FPS'), num(x.fps)]] : [] };
  });
  return <DayChart lang={lang} title={t('Races started a day', 'Гонок начато в день', 'Regatas empezadas al día', 'Gestartete Regatten pro Tag', 'Günde başlayan yarış', 'Régates lancées par jour')} label={t('Races started each day', 'Гонок начато в каждый день', 'Regatas iniciadas cada día', 'Pro Tag gestartete Regatten', 'Her gün başlayan yarışlar', 'Régates lancées chaque jour')} slots={slots} />;
}
