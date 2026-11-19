import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { VENUES, type VenueId } from '@/lib/venues';
import { VENUE_GUIDES, PAGES_DATE } from '@/lib/venue-guides';
import { dailyVenue } from '@/lib/race';
import { BackLink } from '@/components/back-link';
import { VenueView } from '@/components/venue-view';

type Props = { params: Promise<{ lang: string; id: string }> };
const venueById = (id: string) => VENUES.find((v) => v.id === id);

// every venue, in both languages, built at deploy and again hourly (the next day today's race comes here moves on);
// any other id is a 404
export const revalidate = 3600;
export const generateStaticParams = () => VENUES.map((v) => ({ id: v.id }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const g = VENUE_GUIDES[id as VenueId];
  if (!venueById(id) || !g) return {};
  const meta = pageMeta(lang, { title: t(...g.title), description: t(...g.description), path: `/venues/${id}` });
  return { ...meta, authors: [{ name: t(...AUTHOR.name) }], openGraph: { ...meta.openGraph, type: 'article', publishedTime: PAGES_DATE, modifiedTime: PAGES_DATE, authors: [t(...AUTHOR.name)] } };
}

// the next day today's race is sailed here, from today on (lib/race.ts dailyVenue), within the next three months
function nextDaily(id: VenueId) {
  const now = Date.now();
  for (let i = 0; i < 92; i++) {
    const d = new Date(now + i * 864e5);
    if (dailyVenue(d) === id) return d.toISOString().slice(0, 10);
  }
  return null;
}

// V1 · A venue, as the yachts page shows a yacht: the drone over a race on its course (components/venue-view), and
// beside it the game's facts about it, what the water, the wind and the regattas are like there and how to race it,
// racing it in the game, and the other venues.
export default async function VenuePage({ params }: Props) {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const v = venueById(id), g = VENUE_GUIDES[id as VenueId];
  if (!v || !g) notFound();
  const next = nextDaily(v.id);
  const i = VENUES.indexOf(v);
  const others = [1, 2, 3, 4].map((k) => VENUES[(i + k) % VENUES.length]).map((o) => ({ id: o.id, name: o.name, place: o.place }));
  const url = SITE + langUrl(`/venues/${id}`, lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: t(...g.title), description: t(...g.description), inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url, datePublished: PAGES_DATE, dateModified: PAGES_DATE,
    author: AUTHOR_LD, publisher: RYC_LD,
    about: { '@type': 'Place', name: v.name[0], address: { '@type': 'PostalAddress', addressCountry: v.nation, addressRegion: v.place[0] } },
  };

  return (
    <div className="scr bt-scr bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <VenueView lang={lang} back={<BackLink href="/venues" label={t('Back to the venues', 'Назад к акваториям', 'Volver a las sedes', 'Zurück zu den Revieren')} />} v={{
        id: v.id, n: i + 1, of: VENUES.length, name: v.name, place: v.place, about: v.about, wind: v.wind, nation: v.nation,
        title: g.title, intro: g.intro, sections: g.sections,
        next: next && longDate(next, lang), today: next === new Date().toISOString().slice(0, 10),
        by: `${t(...AUTHOR.name)}, ${AUTHOR.org}`, published: [longDate(PAGES_DATE, lang), PAGES_DATE], others,
      }} />
    </div>
  );
}
