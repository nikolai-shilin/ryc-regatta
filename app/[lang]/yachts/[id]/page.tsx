import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { YACHTS, YACHT_IDS } from '@/lib/yachts';
import { PAGES_DATE } from '@/lib/venue-guides';
import { BackLink } from '@/components/back-link';
import { FleetView } from '@/components/fleet-view';

type Props = { params: Promise<{ lang: string; id: string }> };
const yachtById = (id: string) => YACHTS.find((y) => y.id === id);

// every yacht, in both languages, built at deploy; any other id is a 404.
export const generateStaticParams = () => YACHT_IDS.map((id) => ({ id }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const y = yachtById(id);
  if (!y) return {};
  const name = t(...y.name);
  const meta = pageMeta(lang, {
    title: t(`The ${name}: race her in a 3D sailing game`, `${name}: гонки в 3D-парусной игре`, `${name}: regatea en un juego de vela 3D`, `${name}: im 3D-Segelspiel segeln`),
    description: `${t(...y.tagline)} ${t('What she is, her numbers, and how she sails in the game.', 'Что это за яхта, её цифры и как она ходит в игре.', 'Qué es, sus números y cómo navega en el juego.', 'Was sie ausmacht, ihre Daten und wie sie im Spiel segelt.')}`,
    path: `/yachts/${id}`, card: '/og/page/yachts',
  });
  return { ...meta, authors: [{ name: t(...AUTHOR.name) }] };
}

// Y1 · A yacht: the fleet in 3D as /yachts is (components/fleet-view), opened on her and staying there: her name, what
// she is and her line, her numbers, what she is in full and how she sails in the game, all in the page as it is sent;
// the strip's yachts are links to their own pages, and the card ends with who wrote it and when.
export default async function YachtPage({ params }: Props) {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const y = yachtById(id);
  if (!y) notFound();
  const name = t(...y.name);
  const url = SITE + langUrl(`/yachts/${id}`, lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: t(`The ${name}`, name, `El ${name}`, `Die ${name}`), description: t(...y.tagline), inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url, datePublished: PAGES_DATE, dateModified: PAGES_DATE,
    author: AUTHOR_LD, publisher: RYC_LD, about: { '@type': 'Thing', name: y.name[0], description: y.kind[0] },
  };

  return (
    <div className="scr bt-scr bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <FleetView lang={lang} start={y.id} tour={false} own
        back={<BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub')} />}
        foot={<p className="bt-hint">{t('By ', '', 'Por ', 'Von ')}{t(...AUTHOR.name)}, {AUTHOR.org} · {t('Published ', 'Опубликовано ', 'Publicado ', 'Veröffentlicht ')}<time dateTime={PAGES_DATE}>{longDate(PAGES_DATE, lang)}</time></p>} />
    </div>
  );
}
