import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { PlayersView } from '@/components/players-view';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';

export const generateMetadata = titled('The players', 'Игроки', {
  path: '/players',
  description: [
    'Everyone who races in Up and down: their races, wins and podiums, the yachts and venues they sail, and their boat in 3D in their own colours.',
    'Все, кто гоняется в Up and down: их гонки, победы и подиумы, яхты и места, где они ходят, и их лодка в 3D в их цветах.'],
});

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
