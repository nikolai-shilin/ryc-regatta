import { tx, type Lang } from '@/lib/lang';
import { Tile } from './admin-stats';
import { IconCrew, clock } from './ui';

// The admin's list of the players who began a race in the last `days`, the last seen first (500 at most), from the
// database's regatta_admin_players (supabase/migrations/20261117150000_regatta_admin_players.sql in the iyt-test repo),
// which answers an admin alone. A player is a Telegram user, a site account or, for a guest, a browser; a browser that
// later signed in is that player throughout. Drawn on the server, per request.
type Num = number | null;
export type Player = {
  who: string; kind: 'tg' | 'acct' | 'guest'; name: string | null; handle: string | null; first: string; last: string; new: boolean;
  n: number; fin: number; top3: number; dsq: number; days: number; down: Num; best: Num; rated: number; rating: Num; dev: string | null;
};
export type Players = { since: string; players: Player[] };

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');

export function AdminPlayers({ lang, data }: { lang: Lang; data: Players }) {
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
  const head = [t('Races', 'Гонок'), t('Finished', 'Финиш'), t('Top 3', 'Топ-3'), t('DSQ', 'DSQ'), t('Days', 'Дней'), t('Place', 'Место'),
    t('Best today’s race', 'Лучшее в гонке дня'), t('Rating', 'Оценка'), t('Device', 'Устройство'), t('Last seen', 'Был'), t('First seen', 'Впервые')];
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
          <h3 className="adm-tab-h">{t('Last seen first', 'Сначала недавние')}</h3>
          <div className="adm-tab-scroll" tabIndex={0} role="region" aria-label={t('The players', 'Игроки')}>
            <table className="adm-players">
              <thead><tr><th scope="col">{t('Player', 'Игрок')}</th>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {P.map((p) => (
                  <tr key={p.who}>
                    <th scope="row">
                      <span className="adm-pl-name">{p.name || (p.kind === 'guest' ? `${KIND.guest} ${p.who.slice(0, 4)}` : '–')}</span>
                      <span className="adm-pl-sub">
                        {KIND[p.kind]}{p.handle ? ` · ${p.kind === 'tg' ? '@' : ''}${p.handle}` : ''}
                        {p.new && <b className="adm-pl-new">{t('New', 'Новый')}</b>}
                      </span>
                    </th>
                    <td>{p.n}</td>
                    <td>{pct(p.fin, p.n)}</td>
                    <td>{p.top3}</td>
                    <td>{p.dsq || '–'}</td>
                    <td>{p.days}</td>
                    <td>{p.down == null ? '–' : `${Math.round(100 * p.down)}%`}</td>
                    <td>{p.best == null ? '–' : clock(p.best)}</td>
                    <td>{p.rated ? `${(p.rating ?? 0).toFixed(1)} · ${p.rated}` : '–'}</td>
                    <td>{dev(p.dev)}</td>
                    <td>{when(p.last)}</td>
                    <td>{when(p.first)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="hint">{t('Everyone who began a race in the period, the last seen first. A guest is a browser; one who signed in later is counted as that player. Place: the median, 0% first in the fleet, 100% last. Rating: the average of the stars they gave, and how many. Times in UTC; first seen is their first race ever. Guests’ races before 17 November had no browser and aren’t here.',
        'Все, кто начинал гонку за период, недавние сверху. Гость — это браузер; если он потом вошёл, его гонки считаются за этого игрока. Место — медиана: 0% — первым во флоте, 100% — последним. Оценка — средняя из поставленных звёзд и их число. Время по UTC; «Впервые» — первая гонка вообще. Гонки гостей до 17 ноября без браузера и сюда не попали.')}</p>
    </div>
  );
}
