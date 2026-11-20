import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, langUrl, longDate, SITE, OG_IMAGE, AUTHOR, AUTHOR_LD, RYC_LD } from '@/lib/seo';
import { GUIDES, GUIDE_DATES, guide, guideNo, isGuide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { Toc } from '@/components/toc';
import { GuideFigure } from '@/components/guide-figure';
import '@/styles/reading.css';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

type Props = { params: Promise<{ lang: string; slug: string }> };

// every guide, in both languages, built at deploy; any other slug is a 404
export const generateStaticParams = () => GUIDES.map((slug) => ({ slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { lang, t }] = await Promise.all([params, getT(params)]);
  if (!isGuide(slug)) return {};
  const g = guide(slug, t, lang);
  const meta = pageMeta(lang, { title: g.title, description: g.description, path: `/learn/${slug}`, card: `/og/page/guide?g=${slug}` });
  const d = GUIDE_DATES[slug];
  return { ...meta, authors: [{ name: t(...AUTHOR.name) }], openGraph: { ...meta.openGraph, type: 'article', publishedTime: d.published, modifiedTime: d.modified, authors: [t(...AUTHOR.name)] } };
}

// L1 · A guide: its number, the title and the intro over its picture from the game (where it has one), the sections one after another (the contents beside them on a wide screen),
// each with its tip and its drawing, then the game, where you try it, and three ways on: the most relevant reading, the glossary, and the next guide.
export default async function GuidePage({ params }: Props) {
  const [{ slug }, { lang, t }] = await Promise.all([params, getT(params)]);
  if (!isGuide(slug)) notFound();
  const g = guide(slug, t, lang);
  const dates = GUIDE_DATES[slug];
  const crumbs: Crumb[] = [[t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata'), '/learn'], [g.short, `/learn/${slug}`]];
  const contents: [string, string][] = g.sections.map((s) => [s.id, s.h.replace(/ \(rules? [^)]*\)| \(правил[ао] [^)]*\)/, '')]);
  // Read more: the guide's first further reading, its glossary link (or the glossary), then the next guide in order (the
  // last one goes back to the first); any other reading under them
  const next = guide(GUIDES[(GUIDES.indexOf(slug) + 1) % GUIDES.length], t, lang);
  const gloss = g.more.find((m) => m.href.startsWith('/learn/glossary'));
  const related = g.more.find((m) => m !== gloss);
  const rest = g.more.filter((m) => m !== gloss && m !== related);
  const glossLabel = gloss ? gloss.label.replace(/^(Glossary|Словарь): (.)/, (_, _w, c: string) => c.toUpperCase()) : t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü', 'Glossaire de la régate à la voile', 'Glossario delle regate a vela');
  const cards: [string, string, string][] = [
    ...(related ? [[t('Further reading', 'Подробнее', 'Más lecturas', 'Weiterlesen', 'Daha fazla oku', 'Pour aller plus loin', 'Per approfondire'), related.label, related.href] as [string, string, string]] : []),
    [t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario'), glossLabel, gloss?.href || '/learn/glossary'],
    [t('Next guide', 'Следующее пособие', 'Siguiente guía', 'Nächste Anleitung', 'Sonraki rehber', 'Guide suivant', 'Guida successiva'), next.short, `/learn/${next.slug}`],
  ];
  const go = (href: string, cls: string, body: React.ReactNode) => (href.startsWith('/')
    ? <Link key={href} className={cls} href={href}>{body}</Link>
    : <a key={href} className={cls} href={href}>{body}</a>);
  const url = SITE + langUrl(`/learn/${slug}`, lang);
  // "Guide 4 of 6 · marks": the number, and the topic from the kicker ("Learn to race · marks"), the trail above saying the rest
  const kicker = [t(`Guide ${guideNo(slug)} of ${GUIDES.length}`, `Пособие ${guideNo(slug)} из ${GUIDES.length}`, `Guía ${guideNo(slug)} de ${GUIDES.length}`, `Anleitung ${guideNo(slug)} von ${GUIDES.length}`, `Rehber ${guideNo(slug)} / ${GUIDES.length}`, `Guide ${guideNo(slug)} sur ${GUIDES.length}`, `Guida ${guideNo(slug)} di ${GUIDES.length}`), g.kicker.split(' · ')[1]].filter(Boolean).join(' · ');
  const head = (
    <div className="hm-page hm-ph">
      <Trail t={t} crumbs={crumbs} />
      <span className="kicker">{kicker}</span>
      <h1 className="hm-ph-h">{g.title}</h1>
      <p className="hm-text">{g.intro}</p>
      <p className="gd-by">{t('By ', '', 'Por ', 'Von ', 'Yazan: ')}<span>{t(...AUTHOR.name)}</span>, {AUTHOR.org} · {dates.modified === dates.published ? t('Published ', 'Опубликовано ', 'Publicado ', 'Veröffentlicht ', 'Yayımlandı: ', 'Publié le ', 'Pubblicata il ') : t('Updated ', 'Обновлено ', 'Actualizado ', 'Aktualisiert ', 'Güncellendi: ', 'Mis à jour le ', 'Aggiornata il ')}<time dateTime={dates.modified}>{longDate(dates.modified, lang)}</time></p>
      <nav className="hm-ph-nav rd-chips" aria-label={t('Contents', 'Содержание', 'Contenido', 'Inhalt', 'İçindekiler', 'Sommaire', 'Indice')}>
        {contents.map(([id, h]) => <a key={id} className="hm-chip" href={`#${id}`}>{h}</a>)}
      </nav>
    </div>
  );
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, inLanguage: lang,
    url, mainEntityOfPage: url, image: SITE + (g.img?.src || OG_IMAGE.url), datePublished: dates.published, dateModified: dates.modified,
    author: AUTHOR_LD, publisher: RYC_LD,
    about: ['Sailboat racing', 'Racing Rules of Sailing'],
  };

  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      {g.img
        ? <header className="gd-hero"><Image className="gd-hero-bg" src={g.img.src} width={g.img.width} height={g.img.height} sizes="100vw" fetchPriority="high" loading="eager" alt={g.img.alt} />{head}</header>
        : <header>{head}</header>}

      <div className="hm-page rd-layout">
        <Toc items={contents} label={t('Contents', 'Содержание', 'Contenido', 'Inhalt', 'İçindekiler', 'Sommaire', 'Indice')} numbered />
        <div className="rd-main">
          <article className="gd">
            {g.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="gd-sec" data-n={String(i + 1).padStart(2, '0')} aria-labelledby={`${s.id}-t`}>
                <h2 id={`${s.id}-t`}>{s.h}</h2>
                {s.p.map((p, j) => <p key={j}>{p}</p>)}
                {s.fig && <GuideFigure fig={s.fig} t={t} />}
                {s.tip && <div className={s.pen ? 'gd-tip pen' : 'gd-tip'}><b className="lbl">{t('Tip', 'Совет', 'Consejo', 'Tipp', 'İpucu', 'Conseil', 'Consiglio')}</b><p>{s.tip}</p></div>}
              </section>
            ))}
          </article>

          <section className="gd-try" aria-labelledby="gd-try">
            <div className="gd-try-t">
              <span className="gd-try-k">{t('Now try it', 'Теперь попробуй', 'Pruébalo ahora', 'Jetzt ausprobieren', 'Şimdi dene', 'À toi d’essayer', 'Ora prova tu')}</span>
              <h2 className="hm-h2" id="gd-try">{t('On the water, in your browser', 'На воде, прямо в браузере', 'En el agua, en tu navegador', 'Auf dem Wasser, in deinem Browser', 'Suda, tarayıcında', 'Sur l’eau, dans ton navigateur', 'In acqua, nel tuo browser')}</h2>
              <p>{g.try.text} {t('Up and down is free, on a phone or a computer, with nothing to install.', 'Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.', 'Up and down es gratis, en el móvil o en el ordenador, sin instalar nada.', 'Up and down ist kostenlos, auf dem Handy oder am Computer, ohne etwas zu installieren.', 'Up and down ücretsizdir, telefonda ya da bilgisayarda, hiçbir şey kurmadan.', 'Up and down est gratuit, sur téléphone ou ordinateur, sans rien à installer.', 'Up and down è gratis, su telefono o computer, senza installare nulla.')}</p>
            </div>
            <Link className="gd-try-go" href={g.try.href}>{g.try.label}<IconArrow /></Link>
          </section>

          <section className="gd-more" aria-labelledby="gd-more">
            <h2 className="lbl-ink" id="gd-more">{t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku', 'Lire la suite', 'Leggi di più')}</h2>
            <div className="gd-next">
              {cards.map(([k, label, href]) => go(href, 'gd-next-card', <><span className="lbl">{k}</span><span className="card-title">{label}</span><IconArrow s={16} /></>))}
            </div>
            {rest.length > 0 && <p className="gd-also">{rest.map((m) => go(m.href, 'hm-src', <>{m.label}<IconArrow s={14} /></>))}</p>}
          </section>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back={`/learn/${slug}`} />
    </div>
  );
}
