import { LOCALE, tx, type Lang } from '@/lib/lang';
import { plainName } from '@/lib/name';
import { Tile } from './admin-stats';
import { IconCrew, clock } from './ui';
import { PlayersTable, type Col, type Row } from './admin-players-table';
import { logHref } from './admin-logs';

// The admin's list of the players who began a race in the last `days`, the last seen first (500 at most), from the
// database's regatta_admin_players (supabase/migrations/20261117150000_regatta_admin_players.sql in the iyt-test repo),
// which answers an admin alone. A player is a Telegram user, a site account or, for a guest, a browser; a browser that
// later signed in is that player throughout. Drawn on the server, per request; the table sorts in the browser by the
// column clicked (components/admin-players-table.tsx).
type Num = number | null;
export type Player = {
  who: string; kind: 'tg' | 'acct' | 'guest'; name: string | null; handle: string | null; first: string; last: string; new: boolean;
  n: number; fin: number; top3: number; dsq: number; days: number; down: Num; best: Num; rated: number; rating: Num; dev: string | null;
};
export type Players = { since: string; players: Player[] };

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');

export function AdminPlayers({ lang, data, days = 30 }: { lang: Lang; data: Players; days?: number }) {
  const t = tx(lang), P = data.players;
  const KIND = { tg: 'Telegram', acct: t('Site account', 'Аккаунт на сайте', 'Cuenta del sitio', 'Konto auf der Seite', 'Site hesabı', 'Compte du site'), guest: t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité') };
  const when = (s: string) => new Date(s).toLocaleString(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const dev = (v: string | null) => {
    if (!v) return '–';
    const [d, tg] = v.split(' ');
    const name = { phone: t('Phone', 'Телефон', 'Móvil', 'Handy', 'Telefon', 'Téléphone'), tablet: t('Tablet', 'Планшет', 'Tableta', 'Tablet', 'Tablet', 'Tablette'), desktop: t('Computer', 'Компьютер', 'Ordenador', 'Computer', 'Bilgisayar', 'Ordinateur') }[d] ?? d;
    return tg ? `${name} · Telegram` : name;
  };
  const count = (k: Player['kind']) => P.filter((p) => p.kind === k).length;
  const cols: Col[] = [
    { label: t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates') }, { label: t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée') }, { label: t('Top 3', 'Топ-3', 'Top 3', 'Top 3', 'İlk 3', 'Top 3') },
    { label: t('DSQ', 'DSQ') }, { label: t('Days', 'Дней', 'Días', 'Tage', 'Gün', 'Jours') }, { label: t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place'), asc: true },
    { label: t('Best today’s race', 'Лучшее в гонке дня', 'Mejor de la regata del día', 'Beste Regatta des Tages', 'Günün yarışında en iyi', 'Meilleur temps, régate du jour'), asc: true }, { label: t('Rating', 'Оценка', 'Valoración', 'Bewertung', 'Puan', 'Note') },
    { label: t('Device', 'Устройство', 'Dispositivo', 'Gerät', 'Cihaz', 'Appareil'), asc: true }, { label: t('Last seen', 'Был', 'Visto por última vez', 'Zuletzt gesehen', 'Son görülme', 'Dernière visite') }, { label: t('First seen', 'Впервые', 'Visto por primera vez', 'Zuerst gesehen', 'İlk görülme', 'Première visite') },
  ];
  const rows: Row[] = P.map((p) => ({
    key: p.who,
    href: logHref(p.who, days),
    name: plainName(p.name) || (p.kind === 'guest' ? `${KIND.guest} ${p.who.slice(0, 4)}` : '–'),
    sub: `${KIND[p.kind]}${p.handle ? ` · ${p.kind === 'tg' ? '@' : ''}${p.handle}` : ''}`,
    isNew: p.new,
    hideable: p.kind === 'guest',
    cells: [String(p.n), pct(p.fin, p.n), String(p.top3), p.dsq ? String(p.dsq) : '–', String(p.days), p.down == null ? '–' : `${Math.round(100 * p.down)}%`,
      p.best == null ? '–' : clock(p.best), p.rated ? `${(p.rating ?? 0).toFixed(1)} · ${p.rated}` : '–', dev(p.dev), when(p.last), when(p.first)],
    vals: [p.n, p.n ? p.fin / p.n : null, p.top3, p.dsq, p.days, p.down, p.best, p.rated ? p.rating : null, p.dev ? dev(p.dev) : null, Date.parse(p.last), Date.parse(p.first)],
  }));
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconCrew /><span className="kicker">{t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Players who raced', 'Игроков с гонками', 'Jugadores que regatearon', 'Spieler, die gesegelt sind', 'Yarışan oyuncular', 'Joueurs ayant régaté')} v={String(P.length)} />
        <Tile k={t('New in the period', 'Новых за период', 'Nuevos en el periodo', 'Neu im Zeitraum', 'Dönemde yeni', 'Nouveaux sur la période')} v={String(P.filter((p) => p.new).length)} />
        <Tile k="Telegram" v={String(count('tg'))} />
        <Tile k={t('Site accounts', 'Аккаунтов на сайте', 'Cuentas del sitio', 'Konten auf der Seite', 'Site hesapları', 'Comptes du site')} v={String(count('acct'))} />
        <Tile k={t('Guests', 'Гостей', 'Invitados', 'Gäste', 'Misafirler', 'Invités')} v={String(count('guest'))} />
      </div>
      {P.length > 0 && (
        <section className="adm-tab">
          <h3 className="adm-tab-h">{t('Click a column to sort by it', 'Нажмите на столбец, чтобы отсортировать', 'Pulsa una columna para ordenar', 'Klicke auf eine Spalte, um danach zu sortieren', 'Sıralamak için bir sütuna tıkla', 'Clique sur une colonne pour trier')}</h3>
          <PlayersTable first={{ label: t('Player', 'Игрок', 'Jugador', 'Spieler', 'Oyuncu', 'Joueur'), asc: true }} cols={cols} rows={rows} start={10}
            hideLabel={count('guest') ? t('Hide guests', 'Скрыть гостей', 'Ocultar invitados', 'Gäste ausblenden', 'Misafirleri gizle', 'Masquer les invités') : undefined}
            label={t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs')} newLabel={t('New', 'Новый', 'Nuevo', 'Neu', 'Yeni', 'Nouveau')} />
        </section>
      )}
      <p className="hint">{t('Everyone who began a race in the period, the last seen first; click a column’s head to sort by it, again to turn it round. A guest is a browser; one who signed in later is counted as that player. Place: the median, 0% first in the fleet, 100% last. Rating: the average of the stars they gave, and how many. Times in UTC; first seen is their first race ever. Guests’ races before 17 November had no browser and aren’t here.',
        'Все, кто начинал гонку за период, недавние сверху; нажмите на заголовок столбца, чтобы отсортировать, ещё раз — в обратном порядке. Гость — это браузер; если он потом вошёл, его гонки считаются за этого игрока. Место — медиана: 0% — первым во флоте, 100% — последним. Оценка — средняя из поставленных звёзд и их число. Время по UTC; «Впервые» — первая гонка вообще. Гонки гостей до 17 ноября без браузера и сюда не попали.', 'Todos los que empezaron una regata en el periodo, el visto más recientemente primero; pulsa el encabezado de una columna para ordenar, otra vez para invertir. Un invitado es un navegador; si entró después, se cuenta como ese jugador. Puesto: la mediana, 0 % primero de la flota, 100 % último. Valoración: la media de las estrellas que dieron, y cuántas. Horas en UTC; visto por primera vez es su primera regata de siempre. Las regatas de invitados anteriores al 17 de noviembre no tenían navegador y no están aquí.', 'Alle, die im Zeitraum eine Regatta begonnen haben, die zuletzt gesehenen zuerst; klicke auf den Kopf einer Spalte, um danach zu sortieren, nochmals, um umzudrehen. Ein Gast ist ein Browser; wer sich später anmeldete, zählt als dieser Spieler. Platz: der Median, 0 % für den Ersten im Feld, 100 % für den Letzten. Bewertung: der Durchschnitt der vergebenen Sterne und wie viele. Zeiten in UTC; zuerst gesehen ist ihre allererste Regatta. Regatten von Gästen vor dem 17. November hatten keinen Browser und sind nicht hier.', 'Dönemde bir yarışa başlayan herkes, son görülen önce; sıralamak için sütun başlığına tıkla, tersine çevirmek için yine tıkla. Misafir bir tarayıcıdır; sonradan giriş yapan, o oyuncu olarak sayılır. Sıra: ortanca; %0 filoda birinci, %100 sonuncu. Puan: verdikleri yıldızların ortalaması ve kaç tane. Saatler UTC; ilk görülme, ilk yarışlarıdır. Misafirlerin 17 Kasım’dan önceki yarışlarının tarayıcı kaydı yoktu, burada değiller.', 'Tous ceux qui ont commencé une régate pendant la période, les plus récents d’abord ; clique sur l’en-tête d’une colonne pour trier, une deuxième fois pour inverser. Un invité est un navigateur ; celui qui s’est connecté ensuite compte comme ce joueur. Place : la médiane, 0 % premier de la flotte, 100 % dernier. Note : la moyenne des étoiles données, et leur nombre. Heures en UTC ; la première visite est leur toute première régate. Les régates des invités avant le 17 novembre n’avaient pas de navigateur et ne figurent pas ici.')}</p>
    </div>
  );
}
