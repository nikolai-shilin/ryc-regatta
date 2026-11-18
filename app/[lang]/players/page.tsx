import type { Metadata } from 'next';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { BackLink } from '@/components/back-link';
import { PlayersView } from '@/components/players-view';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';
import { passportInLink, readPassport } from '@/lib/passport-share';

type Query = Record<string, string | string[] | undefined>;
const one = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x);

const list = titled('The players', 'Игроки', {
  path: '/players', card: '/og/page/players', live: true,
  description: [
    'Everyone who races in Up and down: their races, wins and podiums, the yachts and venues they sail, and their boat in 3D in their own colours.',
    'Все, кто гоняется в Up and down: их гонки, победы и подиумы, яхты и места, где они ходят, и их лодка в 3D в их цветах.'],
});

// ?p=<k>, one player: their name in the title and their own share card (app/og/page/[key], player), so a link to it
// shows them, not the list; kept out of search, the list is the page to find. ?s=5&v=12&vs=…&n=Anna, a passport
// as its owner shared it (lib/passport-share.ts), with its card for the chat apps (app/og/passport). ?me=1, your own for
// someone with no player card yet.
export async function generateMetadata(props: LangParams & { searchParams: Promise<Query> }): Promise<Metadata> {
  const sp = await props.searchParams, p = one(sp.p);
  const key = p && KEY_RE.test(p) ? p : null;
  const player = key ? await getPlayer(key) : null;
  const { lang, t } = await getT(props.params);
  if (key && player) {
    const name = player.name || t('A sailor', 'Гонщик');
    return pageMeta(lang, {
      title: t(`${name} · The players`, `${name} · Игроки`), index: false, card: `/og/page/player?p=${key}`, live: true,
      description: t(`${name} in Up and down: ${player.n} races, ${player.wins} wins, ${player.podiums} podiums.`,
        `${name} в Up and down: гонок — ${player.n}, побед — ${player.wins}, подиумов — ${player.podiums}.`),
    });
  }
  const inLink = passportInLink(sp);
  if (!key && inLink.length) {
    const s = readPassport(sp);
    const title = s.n ? t(`${s.n}’s passport`, `Паспорт: ${s.n}`) : t('A sailor’s passport', 'Паспорт гонщика');
    const meta = pageMeta(lang, { title, description: t(`${s.v} of ${VENUES.length} venues raced${s.s >= 2 ? `, ${s.s} days in a row` : ''}. A free 3D sailing race in your browser, a new venue every day.`, `Пройдено ${s.v} из ${VENUES.length} акваторий${s.s >= 2 ? `, ${s.s} дней подряд` : ''}. Бесплатная 3D-парусная гонка в браузере, каждый день новая акватория.`), index: false });
    const qs = new URLSearchParams(inLink);
    if (lang === 'ru') qs.set('lang', 'ru');
    const card = { url: `/og/passport?${qs}`, width: 1200, height: 630, alt: title };
    return { ...meta, openGraph: { ...meta.openGraph, images: [card] }, twitter: { ...meta.twitter, images: [card] } };
  }
  if (!key && one(sp.me)) return pageMeta(lang, { title: t('Your player card', 'Твоя карточка игрока'), description: t('Your venues and streak in Up and down.', 'Твои акватории и серия в Up and down.'), index: false });
  return list(props);
}

// The players: the game's own scene behind the page (a JPK 1050 on Lake Garda, public/boat-view), the players' table in
// its card, PER a page (?page=), the most points first (lib/players.ts, the scores API). ?p=<k> is one player: the card
// shows their numbers, and the yacht in the scene is dressed in their colours, as their account keeps them. A shared
// passport and your own without a card (above) take the same card. Old /passport links come here (next.config.ts).
export default async function PlayersPage({ params, searchParams }: LangParams & { searchParams: Promise<Query> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(one(q.page))) || 1));
  const p = one(q.p), key = p && KEY_RE.test(p) ? p : null;
  const inLink = key ? [] : passportInLink(q), me = !key && !inLink.length && !!one(q.me);
  const passport = inLink.length ? { shared: readPassport(q), path: `/players?${new URLSearchParams(inLink)}` } : me ? { shared: null, path: '/players?me=1' } : undefined;
  const [rows, player] = await Promise.all([passport ? Promise.resolve(null) : getPlayers(page), key ? getPlayer(key) : Promise.resolve(null)]);
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <PlayersView lang={lang} list={rows} player={player} missing={!!key && !player} passport={passport} back={(
        <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
      )} />
    </div>
  );
}
