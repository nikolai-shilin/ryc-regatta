import { tx, type Lang } from '@/lib/lang';
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
  const KIND = { tg: 'Telegram', acct: t('Site account', 'Аккаунт на сайте'), guest: t('Guest', 'Гость') };
  const when = (s: string) => new Date(s).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const dev = (v: string | null) => {
    if (!v) return '–';
    const [d, tg] = v.split(' ');
    const name = { phone: t('Phone', 'Телефон'), tablet: t('Tablet', 'Планшет'), desktop: t('Computer', 'Компьютер') }[d] ?? d;
    return tg ? `${name} · Telegram` : name;
  };
  const count = (k: Player['kind']) => P.filter((p) => p.kind === k).length;
  const cols: Col[] = [
    { label: t('Races', 'Гонок') }, { label: t('Finished', 'Финиш') }, { label: t('Top 3', 'Топ-3') },
    { label: t('DSQ', 'DSQ') }, { label: t('Days', 'Дней') }, { label: t('Place', 'Место'), asc: true },
    { label: t('Best today’s race', 'Лучшее в гонке дня'), asc: true }, { label: t('Rating', 'Оценка') },
    { label: t('Device', 'Устройство'), asc: true }, { label: t('Last seen', 'Был') }, { label: t('First seen', 'Впервые') },
  ];
  const rows: Row[] = P.map((p) => ({
    key: p.who,
    href: logHref(p.who, days),
    name: plainName(p.name) || (p.kind === 'guest' ? `${KIND.guest} ${p.who.slice(0, 4)}` : '–'),
    sub: `${KIND[p.kind]}${p.handle ? ` · ${p.kind === 'tg' ? '@' : ''}${p.handle}` : ''}`,
    isNew: p.new,
    cells: [String(p.n), pct(p.fin, p.n), String(p.top3), p.dsq ? String(p.dsq) : '–', String(p.days), p.down == null ? '–' : `${Math.round(100 * p.down)}%`,
      p.best == null ? '–' : clock(p.best), p.rated ? `${(p.rating ?? 0).toFixed(1)} · ${p.rated}` : '–', dev(p.dev), when(p.last), when(p.first)],
    vals: [p.n, p.n ? p.fin / p.n : null, p.top3, p.dsq, p.days, p.down, p.best, p.rated ? p.rating : null, p.dev ? dev(p.dev) : null, Date.parse(p.last), Date.parse(p.first)],
  }));
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><IconCrew /><span className="kicker">{t('The players', 'Игроки')}</span></div>
      <div className="adm-tiles">
        <Tile k={t('Players who raced', 'Игроков с гонками')} v={String(P.length)} />
        <Tile k={t('New in the period', 'Новых за период')} v={String(P.filter((p) => p.new).length)} />
        <Tile k="Telegram" v={String(count('tg'))} />
        <Tile k={t('Site accounts', 'Аккаунтов на сайте')} v={String(count('acct'))} />
        <Tile k={t('Guests', 'Гостей')} v={String(count('guest'))} />
      </div>
      {P.length > 0 && (
        <section className="adm-tab">
          <h3 className="adm-tab-h">{t('Click a column to sort by it', 'Нажмите на столбец, чтобы отсортировать')}</h3>
          <PlayersTable first={{ label: t('Player', 'Игрок'), asc: true }} cols={cols} rows={rows} start={10}
            label={t('The players', 'Игроки')} newLabel={t('New', 'Новый')} />
        </section>
      )}
      <p className="hint">{t('Everyone who began a race in the period, the last seen first; click a column’s head to sort by it, again to turn it round. A guest is a browser; one who signed in later is counted as that player. Place: the median, 0% first in the fleet, 100% last. Rating: the average of the stars they gave, and how many. Times in UTC; first seen is their first race ever. Guests’ races before 17 November had no browser and aren’t here.',
        'Все, кто начинал гонку за период, недавние сверху; нажмите на заголовок столбца, чтобы отсортировать, ещё раз — в обратном порядке. Гость — это браузер; если он потом вошёл, его гонки считаются за этого игрока. Место — медиана: 0% — первым во флоте, 100% — последним. Оценка — средняя из поставленных звёзд и их число. Время по UTC; «Впервые» — первая гонка вообще. Гонки гостей до 17 ноября без браузера и сюда не попали.')}</p>
    </div>
  );
}
