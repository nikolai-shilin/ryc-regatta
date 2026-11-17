import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { VENUES } from '@/lib/venues';
import { dailyVenue } from '@/lib/race';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import '@/styles/reading.css';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('The venues: 34 regatta waters to race', 'Акватории: 34 регатных места для гонок', {
  path: '/venues',
  description: [
    'The 34 regatta venues you can race in the game, from Cowes, Newport and Sydney to Lake Garda and Hong Kong: the water, the wind and the regattas of each.',
    '34 регатные акватории, на которых можно гоняться в игре, от Кауса, Ньюпорта и Сиднея до озера Гарда и Гонконга: вода, ветер и регаты каждой.'],
});

// rebuilt hourly, for the venue of today's race at the head
export const revalidate = 3600;

// V0 · The venues: today's race's first, then the rest in the game's order, a card each with where it is and its line.
export default async function Venues({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const today = dailyVenue();
  const list = [...VENUES.filter((v) => v.id === today), ...VENUES.filter((v) => v.id !== today)];
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: t('Regatta venues in Up and down', 'Регатные акватории в Up and down'),
    itemListElement: list.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: t(...v.name), url: SITE + langUrl(`/venues/${v.id}`, lang) })),
  };
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="venues" />
      <header className="hm-page hm-ph">
        <span className="kicker">{t(`Up and down · ${VENUES.length} venues`, `Up and down · ${VENUES.length} акватории`)}</span>
        <h1 className="hm-ph-h">{t('The venues', 'Акватории')}</h1>
        <p className="hm-text">{t('Every place you can race in the game is a real one, laid out from the map: the famous regatta waters of the Solent, Newport, Sydney Harbour, the Mediterranean and beyond. Each page says what the water and the wind are like there, which regattas are sailed on it, and how to race it.', 'Каждое место для гонки в игре — настоящее, построенное по карте: знаменитые регатные акватории Солента, Ньюпорта, гавани Сиднея, Средиземного моря и не только. На странице каждой — какие там вода и ветер, какие регаты на ней проходят и как на ней гоняться.')}</p>
      </header>
      <div className="hm-page vn-list">
        {list.map((v) => (
          <Link key={v.id} className="vn-card" href={`/venues/${v.id}`}>
            <span className="lbl"><span>{t(...v.place)}</span>{v.id === today && <span>· {t('Today’s race', 'Гонка дня')}</span>}</span>
            <span className="card-title">{t(...v.name)}</span>
            <p>{t(...v.about)}</p>
            <span className="hm-src">{t('Read', 'Читать')}<IconArrow s={14} /></span>
          </Link>
        ))}
      </div>
      <SiteFoot lang={lang} t={t} back="/venues" />
    </div>
  );
}
