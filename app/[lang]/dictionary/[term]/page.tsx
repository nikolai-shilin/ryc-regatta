import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { tx } from '@/lib/lang';
import { pageMeta, jsonLd, langUrl, SITE } from '@/lib/seo';
import { glossary, glossaryGroups, seeLabel, SCENES_3D, dictPath, dictName } from '@/lib/glossary';
import { guide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { WordScene } from '@/components/word-scene';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/reading.css';
import '@/styles/dictionary.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

type Props = { params: Promise<{ lang: string; term: string }> };
const IDS = glossary(tx('en')).map((x) => x.id);

// every word, in every language, built at deploy; any other is a 404
export const generateStaticParams = () => IDS.map((term) => ({ term }));
export const dynamicParams = false;

// "Layline: what it means in sailing"
const titleOf = (t: ReturnType<typeof tx>, term: string) => t(`${term}: what it means in sailing`, `${term}: что это значит в парусном спорте`, `${term}: qué significa en vela`, `${term}: was es beim Segeln bedeutet`, `${term}: yelkencilikte ne demek`, `${term} : ce que cela veut dire en voile`, `${term}: cosa significa nella vela`, `${term}: o que significa na vela`);
const in3d = (t: ReturnType<typeof tx>) => t('Shown on the water in 3D.', 'Показано на воде в 3D.', 'Navegado en el agua en 3D.', 'In 3D auf dem Wasser gezeigt.', 'Suda 3D olarak gösteriliyor.', 'Montré sur l’eau en 3D.', 'Mostrato in acqua in 3D.', 'Mostrado na água em 3D.');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ term: id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const x = glossary(t).find((y) => y.id === id);
  if (!x) return {};
  return pageMeta(lang, { title: titleOf(t, x.en ? `${x.term} (${x.en})` : x.term), description: SCENES_3D.includes(id) ? `${x.def} ${in3d(t)}` : x.def, path: dictPath(id), card: '/og/page/glossary' });
}

// D2 · A word of the sailing dictionary: its name and its definition over the word sailed on the water in 3D (or the
// guides' picture, for the four that can't be seen), the guide that goes further, the other words of its group, and
// the words before and after it. Marked up as a DefinedTerm in the dictionary's set, with the trail to it.
export default async function TermPage({ params }: Props) {
  const [{ term: id }, { lang, t }] = await Promise.all([params, getT(params)]);
  const groups = glossaryGroups(t), all = groups.flatMap((g) => g.terms);
  const at = all.findIndex((y) => y.id === id);
  if (at < 0) notFound();
  const x = all[at], group = groups.find((g) => g.id === x.group)!;
  const prev = all[(at - 1 + all.length) % all.length], next = all[(at + 1) % all.length];
  const name = dictName(t), seen = SCENES_3D.includes(id);
  const url = SITE + langUrl(dictPath(id), lang), setUrl = SITE + langUrl(dictPath(), lang);
  const guides = t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata', 'Guias de regata');
  const crumbs: Crumb[] = [[guides, '/learn'], [name, dictPath()], [x.term, dictPath(id)]];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'DefinedTerm', '@id': url, url, name: x.term, ...(x.en ? { alternateName: x.en } : {}), description: x.def, inLanguage: lang, termCode: id,
      inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': setUrl, name, url: setUrl } },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + langUrl(p, lang) })) },
  ] };
  const img = guide('sail', t, lang).img!;
  const near = group.terms.filter((y) => y.id !== id);
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      <header className="gd-hero">
        {seen
          ? <WordScene className="gd-hero-bg" lang={lang} word={id} title={t(`${x.term}, on the water in 3D`, `${x.term} — на воде в 3D`, `${x.term}, en el agua en 3D`, `${x.term}, in 3D auf dem Wasser`, `${x.term}, suda 3D olarak`, `${x.term}, sur l’eau en 3D`, `${x.term}, in acqua in 3D`, `${x.term}, na água em 3D`)} />
          : <Image className="gd-hero-bg" src={img.src} width={img.width} height={img.height} sizes="100vw" fetchPriority="high" loading="eager" alt={img.alt} />}
        <div className="hm-page hm-ph">
          <Trail t={t} crumbs={crumbs} />
          <span className="kicker">{`${name} · ${group.title}`}</span>
          <h1 className="hm-ph-h">{x.term}</h1>
          {x.en ? <p className="dc-en" lang="en">({x.en})</p> : null}
          <p className="hm-text">{x.def}</p>
          {x.warn ? <p className="dc-warn" role="note">{x.warn}</p> : null}
          {x.see && <p className="gd-see-d"><Link className="gd-see" href={x.see}>{seeLabel(x.see, t, lang)}<IconArrow s={12} /></Link></p>}
        </div>
      </header>

      <div className="hm-page">
        <div className="rd-main">
          {near.length > 0 && (
            <section className="gd-sec" aria-labelledby="dc-group">
              <h2 id="dc-group">{group.title}</h2>
              <ul className="dc-near">
                {near.map((y) => <li key={y.id}><Link href={dictPath(y.id)}><b>{y.term}{y.en ? <i className="dc-en-s" lang="en"> ({y.en})</i> : null}{SCENES_3D.includes(y.id) ? <span className="dc-3d">3D</span> : null}</b><span>{y.def}</span></Link></li>)}
              </ul>
            </section>
          )}
          <nav className="dc-steps" aria-label={name}>
            <Link href={dictPath(prev.id)} rel="prev"><span>{t('Previous word', 'Предыдущее слово', 'Palabra anterior', 'Voriges Wort', 'Önceki sözcük', 'Mot précédent', 'Parola precedente', 'Palavra anterior')}</span><b>{prev.term}</b></Link>
            <Link href={dictPath(next.id)} rel="next"><span>{t('Next word', 'Следующее слово', 'Palabra siguiente', 'Nächstes Wort', 'Sonraki sözcük', 'Mot suivant', 'Parola successiva', 'Próxima palavra')}</span><b>{next.term}</b></Link>
          </nav>
          <section className="gd-more" aria-labelledby="dc-more">
            <h2 className="lbl-ink" id="dc-more">{t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku', 'Lire la suite', 'Leggi di più', 'Leia mais')}</h2>
            <div className="gd-next">
              <Link className="gd-next-card" href={dictPath()}><span className="lbl">{name}</span><span className="card-title">{t(`All ${all.length} words`, `Все ${all.length} слов`, `Las ${all.length} palabras`, `Alle ${all.length} Wörter`, `${all.length} sözcüğün tümü`, `Les ${all.length} mots`, `Tutte le ${all.length} parole`, `Todas as ${all.length} palavras`)}</span><IconArrow s={16} /></Link>
              <Link className="gd-next-card" href="/learn"><span className="lbl">{guides}</span><span className="card-title">{t('Learn to race, step by step', 'Учимся гоняться, шаг за шагом', 'Aprende a regatear, paso a paso', 'Regattasegeln lernen, Schritt für Schritt', 'Adım adım yarışmayı öğren', 'Apprendre à régater, pas à pas', 'Impara a regatare, passo dopo passo', 'Aprenda a regatear, passo a passo')}</span><IconArrow s={16} /></Link>
              <Link className="gd-next-card" href="/race"><span className="lbl">{t('On the water', 'На воде', 'En el agua', 'Auf dem Wasser', 'Suda', 'Sur l’eau', 'In acqua', 'Na água')}</span><span className="card-title">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')}</span><IconArrow s={16} /></Link>
            </div>
          </section>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back={dictPath(id)} />
    </div>
  );
}
