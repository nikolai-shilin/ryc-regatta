import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { VENUES, type VenueId } from '@/lib/venues';
import { VENUE_GUIDES, PAGES_DATE } from '@/lib/venue-guides';
import { dailyVenue } from '@/lib/race';
import { IconArrow } from '@/components/ui';
import { RaceHere } from '@/components/race-here';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import '@/styles/reading.css';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

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

// V1 · A venue: the place and its intro, the game's facts about it, what the water, the wind and the regattas are
// like there and how to race it, then racing it in the game, and the other venues.
export default async function VenuePage({ params }: Props) {
  const [{ id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const v = venueById(id), g = VENUE_GUIDES[id as VenueId];
  if (!v || !g) notFound();
  const name = t(...v.name), place = t(...v.place);
  const crumbs: Crumb[] = [[t('The venues', 'Акватории'), '/venues'], [name, `/venues/${id}`]];
  const next = nextDaily(v.id);
  const today = next === new Date().toISOString().slice(0, 10);
  const i = VENUES.indexOf(v);
  const others = [1, 2, 3, 4].map((k) => VENUES[(i + k) % VENUES.length]);
  const url = SITE + langUrl(`/venues/${id}`, lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: t(...g.title), description: t(...g.description), inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url, datePublished: PAGES_DATE, dateModified: PAGES_DATE,
    author: AUTHOR_LD, publisher: RYC_LD,
    about: { '@type': 'Place', name: v.name[0], address: { '@type': 'PostalAddress', addressCountry: v.nation, addressRegion: v.place[0] } },
  };

  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="venues" crumbs={crumbs} />
      <header className="hm-page hm-ph">
        <Trail t={t} crumbs={crumbs} />
        <span className="kicker">{t('Regatta venue', 'Регатная акватория')} · {place}</span>
        <h1 className="hm-ph-h">{t(...g.title)}</h1>
        <p className="hm-text">{t(...g.intro)}</p>
        <p className="gd-by">{t('By ', '')}<span>{t(...AUTHOR.name)}</span>, {AUTHOR.org} · {t('Published ', 'Опубликовано ')}<time dateTime={PAGES_DATE}>{longDate(PAGES_DATE, lang)}</time></p>
      </header>

      <div className="hm-page rd-main">
        <dl className="vn-facts">
          <div><dt>{t('Where', 'Где')}</dt><dd>{place}</dd></div>
          <div><dt>{t('Wind in the game', 'Ветер в игре')}</dt><dd>{t(...v.wind)}</dd></div>
          <div><dt>{t('Sail letters', 'Буквы на парусе')}</dt><dd>{v.nation}</dd></div>
          {next && <div><dt>{t('Race of the day here', 'Гонка дня здесь')}</dt><dd>{today ? t('Today', 'Сегодня') : longDate(next, lang)}</dd></div>}
        </dl>

        <article className="gd">
          {g.sections.map((s, k) => (
            <section key={k} id={`s${k + 1}`} className="gd-sec" data-n={String(k + 1).padStart(2, '0')} aria-labelledby={`s${k + 1}-t`}>
              <h2 id={`s${k + 1}-t`}>{t(...s.h)}</h2>
              {s.p.map((p, j) => <p key={j}>{t(...p)}</p>)}
            </section>
          ))}
        </article>

        <section className="gd-try" aria-labelledby="gd-try">
          <div className="gd-try-t">
            <span className="gd-try-k">{t('Race here', 'Гоняйся здесь')}</span>
            <h2 className="hm-h2" id="gd-try">{t(`${name}, in your browser`, `${name} — прямо в браузере`)}</h2>
            <p>{t(`Set up a free race at ${name}: the yacht, the wind, the fleet and the course are yours to choose. ${today ? 'Today’s race is sailed here too.' : ''}`, `Настрой свободную гонку в акватории ${name}: яхту, ветер, флот и дистанцию выбираешь ты. ${today ? 'Гонка дня сегодня тоже здесь.' : ''}`)} {t('Up and down is free, on a phone or a computer, with nothing to install.', 'Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.')}</p>
          </div>
          {today
            ? <Link className="gd-try-go" href="/race">{t('Sail today’s race', 'Пройди гонку дня')}<IconArrow /></Link>
            : <RaceHere venue={v.id} label={t(`Race at ${name}`, 'Гоняться здесь')} />}
        </section>

        <section className="gd-more" aria-labelledby="gd-more">
          <h2 className="lbl-ink" id="gd-more">{t('More venues', 'Другие акватории')}</h2>
          <div className="gd-next">
            {others.map((o) => (
              <Link key={o.id} className="gd-next-card" href={`/venues/${o.id}`}>
                <span className="lbl">{t(...o.place)}</span><span className="card-title">{t(...o.name)}</span><IconArrow s={16} />
              </Link>
            ))}
          </div>
          <p className="gd-also">
            <Link className="hm-src" href="/venues">{t('Every venue', 'Все акватории')}<IconArrow s={14} /></Link>
            <Link className="hm-src" href="/learn/shifts">{t('Headers and lifts: playing the wind shifts', 'Заходы и отходы: как играть на сдвигах ветра')}<IconArrow s={14} /></Link>
          </p>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back={`/venues/${id}`} />
    </div>
  );
}
