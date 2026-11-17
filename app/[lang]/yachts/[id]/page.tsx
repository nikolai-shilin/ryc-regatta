import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { YACHTS, YACHT_IDS } from '@/lib/yachts';
import { PAGES_DATE } from '@/lib/venue-guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import '@/styles/reading.css';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

type Props = { params: Promise<{ lang: string; id: string }> };
const yachtById = (id: string) => YACHTS.find((y) => y.id === id);

// every yacht, in both languages, built at deploy; any other id is a 404. /yachts is the fleet in 3D, this the yacht in words.
export const generateStaticParams = () => YACHT_IDS.map((id) => ({ id }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const y = yachtById(id);
  if (!y) return {};
  const name = t(...y.name);
  const meta = pageMeta(lang, {
    title: t(`The ${name}: race her in a 3D sailing game`, `${name}: гонки в 3D-парусной игре`),
    description: `${t(...y.tagline)} ${t('What she is, her numbers, and how she sails in the game.', 'Что это за яхта, её цифры и как она ходит в игре.')}`,
    path: `/yachts/${id}`, card: '/og/page/yachts',
  });
  return { ...meta, authors: [{ name: t(...AUTHOR.name) }] };
}

// Y1 · A yacht: her name, what she is and her line, what she is in full, her numbers, how she sails in the game and its
// speeds, then racing her, and the other yachts.
export default async function YachtPage({ params }: Props) {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const y = yachtById(id);
  if (!y) notFound();
  const name = t(...y.name);
  const crumbs: Crumb[] = [[t('The yachts', 'Яхты'), '/yachts'], [name, `/yachts/${id}`]];
  const others = YACHTS.filter((o) => o.id !== y.id);
  const kn = (v: number) => (lang === 'ru' ? `${String(v).replace('.', ',')} уз` : `${v} kn`);
  const url = SITE + langUrl(`/yachts/${id}`, lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: t(`The ${name}`, name), description: t(...y.tagline), inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url, datePublished: PAGES_DATE, dateModified: PAGES_DATE,
    author: AUTHOR_LD, publisher: RYC_LD, about: { '@type': 'Thing', name: y.name[0], description: y.kind[0] },
  };

  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="yachts" crumbs={crumbs} />
      <header className="hm-page hm-ph">
        <Trail t={t} crumbs={crumbs} />
        <span className="kicker">{t(...y.kind)}</span>
        <h1 className="hm-ph-h">{name}</h1>
        <p className="hm-text">{t(...y.tagline)}</p>
        <p className="gd-by">{t('By ', '')}<span>{t(...AUTHOR.name)}</span>, {AUTHOR.org} · {t('Published ', 'Опубликовано ')}<time dateTime={PAGES_DATE}>{longDate(PAGES_DATE, lang)}</time></p>
      </header>

      <div className="hm-page rd-main">
        <dl className="vn-facts">
          {y.specs.map((s, k) => <div key={k}><dt>{t(...s.k)}</dt><dd>{t(...s.v)}</dd></div>)}
        </dl>

        <article className="gd">
          <section id="about" className="gd-sec" data-n="01" aria-labelledby="about-t">
            <h2 id="about-t">{t(`What the ${name} is`, `Что такое ${name}`)}</h2>
            {y.about.map((p, j) => <p key={j}>{t(...p)}</p>)}
          </section>
          <section id="game" className="gd-sec" data-n="02" aria-labelledby="game-t">
            <h2 id="game-t">{t('How she sails in the game', 'Как она ходит в игре')}</h2>
            <p>{t(...y.race)}</p>
            <p>{t(`In 12 knots of breeze she makes about ${kn(y.speed.up)} close-hauled and ${kn(y.speed.down)} at her best angle downwind.`, `При ветре 12 узлов она идёт около ${kn(y.speed.up)} в бейдевинд и ${kn(y.speed.down)} на лучшем полном курсе.`)}</p>
          </section>
        </article>

        <section className="gd-try" aria-labelledby="gd-try">
          <div className="gd-try-t">
            <span className="gd-try-k">{t('Race her', 'Гоняйся на ней')}</span>
            <h2 className="hm-h2" id="gd-try">{t(`The ${name}, in your browser`, `${name} — прямо в браузере`)}</h2>
            <p>{t(`Set up a free race in the ${name} at any of the 34 venues, or see her in 3D with the rest of the fleet.`, `Настрой свободную гонку на ${name} в любой из 34 акваторий или посмотри на неё в 3D вместе с остальным флотом.`)} {t('Up and down is free, on a phone or a computer, with nothing to install.', 'Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.')}</p>
          </div>
          <Link className="gd-try-go" href={`/race/free?yacht=${y.id}`}>{t('Race her', 'Гоняться на ней')}<IconArrow /></Link>
        </section>

        <section className="gd-more" aria-labelledby="gd-more">
          <h2 className="lbl-ink" id="gd-more">{t('The other yachts', 'Другие яхты')}</h2>
          <div className="gd-next">
            {others.map((o) => (
              <Link key={o.id} className="gd-next-card" href={`/yachts/${o.id}`}>
                <span className="lbl">{t(...o.kind)}</span><span className="card-title">{t(...o.name)}</span><IconArrow s={16} />
              </Link>
            ))}
          </div>
          <p className="gd-also"><Link className="hm-src" href={`/yachts?y=${y.id}`}>{t('See her in 3D', 'Посмотреть в 3D')}<IconArrow s={14} /></Link></p>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back={`/yachts/${id}`} />
    </div>
  );
}
