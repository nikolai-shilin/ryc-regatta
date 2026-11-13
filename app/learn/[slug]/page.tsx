import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, SITE, OG_IMAGE } from '@/lib/seo';
import { getAccount } from '@/lib/supabase/server';
import { GUIDES, guide, isGuide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

type Props = { params: Promise<{ slug: string }> };
// when the guides were written, and last changed: for the Article data below
const PUBLISHED = '2026-11-14', MODIFIED = '2026-11-14';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { lang, t }] = await Promise.all([params, getT()]);
  if (!isGuide(slug)) return {};
  const g = guide(slug, t, lang);
  const meta = pageMeta(lang, { title: g.title, description: g.description, path: `/learn/${slug}` });
  return { ...meta, openGraph: { ...meta.openGraph, type: 'article', publishedTime: PUBLISHED, modifiedTime: MODIFIED, authors: ['RYC'] } };
}

// L1 · A guide: the title and the intro, the sections one after another, then the game, where you try it.
export default async function GuidePage({ params }: Props) {
  const [{ slug }, { lang, t }, account] = await Promise.all([params, getT(), getAccount()]);
  if (!isGuide(slug)) notFound();
  const g = guide(slug, t, lang);
  const others = GUIDES.filter((s) => s !== slug).map((s) => guide(s, t, lang));
  const url = SITE + langUrl(`/learn/${slug}`, lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + OG_IMAGE.url, datePublished: PUBLISHED, dateModified: MODIFIED,
    author: { '@type': 'Organization', name: 'RYC', url: 'https://www.rycrentals.com/' },
    publisher: { '@type': 'Organization', name: 'RYC', url: 'https://www.rycrentals.com/', logo: { '@type': 'ImageObject', url: `${SITE}/logo-black.svg` } },
    about: ['Sailboat racing', 'Racing Rules of Sailing'],
  };

  return (
    <div className="scr help hp" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} account={account} page="learn" crumbs={[[t('Learn to race', 'Учись гоняться'), '/learn'], [g.short, `/learn/${slug}`]]} />
      <header className="hm-page hm-ph">
        <Link className="kicker" href="/learn">{g.kicker}</Link>
        <h1 className="hm-ph-h">{g.title}</h1>
        <p className="hm-text">{g.intro}</p>
        <nav className="hm-ph-nav" aria-label={t('Contents', 'Содержание')}>
          {g.sections.map((s) => <a key={s.id} className="hm-chip" href={`#${s.id}`}>{s.h.replace(/ \(rules? [^)]*\)| \(правил[ао] [^)]*\)/, '')}</a>)}
        </nav>
      </header>

      <article className="hm-page gd">
        {g.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="gd-sec" data-n={String(i + 1).padStart(2, '0')} aria-labelledby={`${s.id}-t`}>
            <h2 id={`${s.id}-t`}>{s.h}</h2>
            {s.p.map((p, j) => <p key={j}>{p}</p>)}
          </section>
        ))}
      </article>

      <div className="hm-band">
        <section className="hm-page hm-sec hm-help" aria-labelledby="gd-try">
          <div className="hm-help-main">
            <span className="kicker">{t('Now try it', 'Теперь попробуй')}</span>
            <h2 className="hm-h2" id="gd-try">{t('On the water, in your browser', 'На воде, прямо в браузере')}</h2>
            <p className="hm-text">{g.try.text} {t('Up and down is free, on a phone or a computer, with nothing to install.', 'Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.')}</p>
            <Link className="pill pill-primary hm-cta" href={g.try.href}><span className="btn-t">{g.try.label}</span><IconArrow /></Link>
          </div>
          <div className="hm-help-side gd-more">
            <span className="kicker">{t('Read more', 'Читать дальше')}</span>
            {g.more.map((m) => (m.href.startsWith('/')
              ? <Link key={m.href} className="hm-src" href={m.href}>{m.label}<IconArrow s={14} /></Link>
              : <a key={m.href} className="hm-src" href={m.href}>{m.label}<IconArrow s={14} /></a>))}
            {others.map((o) => <Link key={o.slug} className="hm-src" href={`/learn/${o.slug}`}>{o.short}<IconArrow s={14} /></Link>)}
          </div>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} account={account} back={`/learn/${slug}`} />
    </div>
  );
}
