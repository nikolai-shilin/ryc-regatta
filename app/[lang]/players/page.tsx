import type { Metadata } from 'next';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { pageMeta } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { BackLink } from '@/components/back-link';
import { PlayersView } from '@/components/players-view';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';
import { passportInLink, readPassport } from '@/lib/passport-share';

type Query = Record<string, string | string[] | undefined>;
const one = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x);

const list = titled('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', {
  path: '/players', card: '/og/page/players', live: true,
  description: [
    'Everyone who races in Up and down: their races, wins and podiums, the yachts and venues they sail, and their boat in 3D in their own colours.',
    'Все, кто гоняется в Up and down: их гонки, победы и подиумы, яхты и места, где они ходят, и их лодка в 3D в их цветах.', 'Todos los que compiten en Up and down: sus regatas, victorias y podios, los yates y sedes que navegan, y su barco en 3D con sus propios colores.', 'Alle, die in Up and down segeln: ihre Regatten, Siege und Podestplätze, die Yachten und Reviere, die sie segeln, und ihr Boot in 3D in ihren eigenen Farben.', 'Up and down’da yarışan herkes: yarışları, galibiyetleri ve podyumları, yarıştıkları yatlar ve alanlar, kendi renklerinde 3D tekneleri.', 'Tous ceux qui régatent dans Up and down : leurs régates, victoires et podiums, les yachts et les plans d’eau où ils naviguent, et leur bateau en 3D à leurs couleurs.', 'Tutti quelli che regatano in Up and down: le loro regate, vittorie e podi, gli yacht e i campi di regata dove navigano, e la loro barca in 3D con i loro colori.'],
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
    const name = player.name || t('A sailor', 'Гонщик', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista');
    return pageMeta(lang, {
      title: t(`${name} · The players`, `${name} · Игроки`, `${name} · Los jugadores`, `${name} · Die Spieler`, `${name} · Oyuncular`, `${name} · Les joueurs`, `${name} · I giocatori`), index: false, card: `/og/page/player?p=${key}`, live: true,
      description: t(`${name} in Up and down: ${player.n} races, ${player.wins} wins, ${player.podiums} podiums.`,
        `${name} в Up and down: гонок — ${player.n}, побед — ${player.wins}, подиумов — ${player.podiums}.`, `${name} en Up and down: ${player.n} regatas, ${player.wins} victorias, ${player.podiums} podios.`, `${name} in Up and down: ${player.n} Regatten, ${player.wins} Siege, ${player.podiums} Podestplätze.`, `${name}, Up and down’da: ${player.n} yarış, ${player.wins} galibiyet, ${player.podiums} podyum.`, `${name} dans Up and down : ${player.n} régates, ${player.wins} victoires, ${player.podiums} podiums.`, `${name} in Up and down: ${player.n} regate, ${player.wins} vittorie, ${player.podiums} podi.`),
    });
  }
  const inLink = passportInLink(sp);
  if (!key && inLink.length) {
    const s = readPassport(sp);
    const title = s.n ? t(`${s.n}’s passport`, `Паспорт: ${s.n}`, `Pasaporte de ${s.n}`, `Pass von ${s.n}`, `Pasaport: ${s.n}`, `Carte de joueur de ${s.n}`, `Tessera di ${s.n}`) : t('A sailor’s passport', 'Паспорт гонщика', 'Pasaporte de un regatista', 'Der Pass eines Seglers', 'Bir denizcinin pasaportu', 'La carte de joueur d’un régatier', 'La tessera di un velista');
    const meta = pageMeta(lang, { title, description: t(`${s.v} of ${VENUES.length} venues raced${s.s >= 2 ? `, ${s.s} days in a row` : ''}. A free 3D sailing race in your browser, a new venue every day.`, `Пройдено ${s.v} из ${VENUES.length} акваторий${s.s >= 2 ? `, ${s.s} ${ruPlural(s.s, ['день', 'дня', 'дней'])} подряд` : ''}. Бесплатная 3D-парусная гонка в браузере, каждый день новая акватория.`, `${s.v} de ${VENUES.length} sedes navegadas${s.s >= 2 ? `, ${s.s} días seguidos` : ''}. Una regata 3D gratuita en tu navegador, con una sede nueva cada día.`, `${s.v} von ${VENUES.length} Revieren gesegelt${s.s >= 2 ? `, ${s.s} Tage in Folge` : ''}. Eine kostenlose 3D-Segelregatta im Browser, jeden Tag ein neues Revier.`, `${VENUES.length} yarış alanından ${s.v} tanesinde yarışıldı${s.s >= 2 ? `, üst üste ${s.s} gün` : ''}. Tarayıcında ücretsiz bir 3D yelken yarışı, her gün yeni bir yarış alanı.`, `${s.v} plans d’eau courus sur ${VENUES.length}${s.s >= 2 ? `, ${s.s} jours d’affilée` : ''}. Une régate de voile en 3D gratuite dans ton navigateur, un nouveau plan d’eau chaque jour.`, `${s.v} campi di regata su ${VENUES.length}${s.s >= 2 ? `, ${s.s} giorni di fila` : ''}. Una regata a vela in 3D gratuita nel tuo browser, un nuovo campo di regata ogni giorno.`), index: false });
    const qs = new URLSearchParams(inLink);
    if (lang !== 'en') qs.set('lang', lang);
    const card = { url: `/og/passport?${qs}`, width: 1200, height: 630, alt: title };
    return { ...meta, openGraph: { ...meta.openGraph, images: [card] }, twitter: { ...meta.twitter, images: [card] } };
  }
  if (!key && one(sp.me)) return pageMeta(lang, { title: t('Your player card', 'Твоя карточка игрока', 'Tu tarjeta de jugador', 'Deine Spielerkarte', 'Oyuncu kartın', 'Ta carte de joueur', 'La tua tessera del giocatore'), description: t('Your venues and streak in Up and down.', 'Твои акватории и серия в Up and down.', 'Tus sedes y tu racha en Up and down.', 'Deine Reviere und Serie in Up and down.', 'Up and down’daki alanların ve serin.', 'Tes plans d’eau et ta série dans Up and down.', 'I tuoi campi di regata e la tua serie in Up and down.'), index: false });
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
      <PlayersView lang={lang} list={rows} player={player} missing={!!key && !player && !!rows} passport={passport} back={(
        <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate')} />
      )} />
    </div>
  );
}
