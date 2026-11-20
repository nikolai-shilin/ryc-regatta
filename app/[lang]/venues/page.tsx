import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { dailyVenue } from '@/lib/race';
import { BackLink } from '@/components/back-link';
import { VenuesList } from '@/components/venues-list';

export const generateMetadata = titled('The venues: 66 regatta waters to race', 'Акватории: 66 регатных мест для гонок', 'Las sedes: 66 aguas de regatas para competir', 'Die Reviere: 66 Regattagewässer zum Segeln', 'Yarış alanları: yarışılacak 66 regata suyu', 'Les plans d’eau : 66 sites de régate à courir', 'I campi di regata: 66 specchi d’acqua su cui regatare', 'As raias: 66 águas de regata para velejar', {
  path: '/venues',
  description: [
    'The 66 regatta venues you can race in the game, from Cowes, Newport and Sydney to Lake Garda and Hong Kong: the water, the wind and the regattas of each.',
    '66 регатных акваторий, на которых можно гоняться в игре, от Кауса, Ньюпорта и Сиднея до озера Гарда и Гонконга: вода, ветер и регаты каждой.', 'Las 66 sedes de regatas que puedes navegar en el juego, de Cowes, Newport y Sídney al Lago de Garda y Hong Kong: el agua, el viento y las regatas de cada una.', 'Die 66 Regattareviere, in denen du im Spiel segeln kannst, von Cowes, Newport und Sydney bis zum Gardasee und Hongkong: das Wasser, der Wind und die Regatten jedes Reviers.', 'Oyunda yarışabileceğin 66 regata alanı, Cowes, Newport ve Sidney’den Garda Gölü ve Hong Kong’a: her birinin suyu, rüzgârı ve regataları.', 'Les 66 plans d’eau de régate du jeu, de Cowes, Newport et Sydney au lac de Garde et à Hong Kong : l’eau, le vent et les régates de chacun.', 'I 66 campi di regata su cui puoi regatare nel gioco, da Cowes, Newport e Sydney al Lago di Garda e Hong Kong: l’acqua, il vento e le regate di ciascuno.', 'As 66 raias de regata em que você pode velejar no jogo, de Cowes, Newport e Sydney ao Lago de Garda e Hong Kong: a água, o vento e as regatas de cada uma.'],
});

// rebuilt hourly, for the venue of today's race at the head
export const revalidate = 3600;

// The venues, as /players: the game's scene behind the page (components/venues-list: your yacht at the venue of today's
// race, the drone pulling away from her into a wide circuit of the water), the list in its card by country and name, A to Z, each a
// link to its own page (the ItemList data has today's first, then the game's order). As one of the 3D screens it doesn't zoom (lib/no-zoom.ts).
export default async function Venues({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const today = dailyVenue();
  const list = [...VENUES.filter((v) => v.id === today), ...VENUES.filter((v) => v.id !== today)];
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: t('Regatta venues in Up and down', 'Регатные акватории в Up and down', 'Sedes de regatas en Up and down', 'Regattareviere in Up and down', 'Up and down’daki regata alanları', 'Les plans d’eau de régate dans Up and down', 'Campi di regata in Up and down', 'Raias de regata no Up and down'),
    itemListElement: list.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: t(...v.name), url: SITE + langUrl(`/venues/${v.id}`, lang) })),
  };
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <VenuesList lang={lang} today={today} back={<BackLink href="/" label={t('Home', 'На главную', 'Inicio', 'Startseite', 'Ana sayfa', 'Accueil', 'Home', 'Início')} />}
        list={list.map(({ id, name, place, wind, nation, about }) => ({ id, name, place, wind, nation, about }))} />
    </div>
  );
}
