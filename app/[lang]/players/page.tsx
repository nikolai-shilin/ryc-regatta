import type { Metadata } from 'next';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { BackLink } from '@/components/back-link';
import { PlayersView } from '@/components/players-view';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';

const list = titled('The players', 'Игроки', {
  path: '/players', card: '/og/page/players', live: true,
  description: [
    'Everyone who races in Up and down: their races, wins and podiums, the yachts and venues they sail, and their boat in 3D in their own colours.',
    'Все, кто гоняется в Up and down: их гонки, победы и подиумы, яхты и места, где они ходят, и их лодка в 3D в их цветах.'],
});

// ?p=<k>, one player: their name in the title and their own share card (app/og/page/[key], player), so a link to it
// shows them, not the list; kept out of search, the list is the page to find
export async function generateMetadata(props: LangParams & { searchParams: Promise<{ p?: string }> }): Promise<Metadata> {
  const { p } = await props.searchParams;
  const key = p && KEY_RE.test(p) ? p : null;
  const player = key ? await getPlayer(key) : null;
  if (!key || !player) return list(props);
  const { lang, t } = await getT(props.params);
  const name = player.name || t('A sailor', 'Гонщик');
  return pageMeta(lang, {
    title: t(`${name} · The players`, `${name} · Игроки`), index: false, card: `/og/page/player?p=${key}`, live: true,
    description: t(`${name} in Up and down: ${player.n} races, ${player.wins} wins, ${player.podiums} podiums.`,
      `${name} в Up and down: гонок — ${player.n}, побед — ${player.wins}, подиумов — ${player.podiums}.`),
  });
}

// The players: the game's own scene behind the page (a JPK 1050 on Lake Garda, public/boat-view), the players' table in
// its card, PER a page (?page=), the most points first (lib/players.ts, the scores API). ?p=<k> is one player: the card
// shows their numbers, and the yacht in the scene is dressed in their colours, as their account keeps them.
export default async function PlayersPage({ params, searchParams }: LangParams & { searchParams: Promise<{ page?: string; p?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(q.page)) || 1));
  const key = q.p && KEY_RE.test(q.p) ? q.p : null;
  const [list, player] = await Promise.all([getPlayers(page), key ? getPlayer(key) : Promise.resolve(null)]);
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <PlayersView lang={lang} list={list} player={player} missing={!!key && !player} back={(
        <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
      )} />
    </div>
  );
}
