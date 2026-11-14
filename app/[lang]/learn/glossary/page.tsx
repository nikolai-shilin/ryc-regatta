import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { glossary } from '@/lib/glossary';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const generateMetadata = titled('Sailing racing glossary', 'Словарь парусных гонок', {
  path: '/learn/glossary',
  description: [
    'The words of sailboat racing in plain English: beat, close-hauled, tack and gybe, overlap, clear astern, header and lift, layline, zone, mark-room, OCS, penalty turn and more.',
    'Слова парусных гонок простым языком: лавировка, бейдевинд, оверштаг и фордевинд, перекрытие, чисто позади, заход и отход ветра, лейлайн, зона, место у знака, фальстарт, штрафной оборот и другие.'],
});

// L2 · The glossary: every term with a short definition, A to Z, each linkable (#layline) and marked up as a
// DefinedTermSet, so a search for one word can land on its line.
export default async function Glossary({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const terms = glossary(t);
  const url = SITE + langUrl('/learn/glossary', lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url, name: t('Sailing racing glossary', 'Словарь парусных гонок'), inLanguage: lang, url,
    hasDefinedTerm: terms.map((x) => ({ '@type': 'DefinedTerm', '@id': `${url}#${x.id}`, name: x.term, description: x.def, inDefinedTermSet: url })),
  };
  return (
    <div className="scr help hp" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={[[t('Learn to race', 'Учись гоняться'), '/learn'], [t('Glossary', 'Словарь'), '/learn/glossary']]} />
      <header className="hm-page hm-ph">
        <Link className="kicker" href="/learn">{t('Learn to race · glossary', 'Учись гоняться · словарь')}</Link>
        <h1 className="hm-ph-h">{t('Sailing racing glossary', 'Словарь парусных гонок')}</h1>
        <p className="hm-text">{t(`The ${terms.length} words you hear most on a race course, each in a sentence or two. The guides go further.`, `${terms.length} слов, которые чаще всего слышно на гоночной дистанции, — каждое в паре предложений. Подробнее — в пособиях.`)}</p>
      </header>
      <dl className="hm-page gd gd-terms">
        {terms.map((x) => (
          <div key={x.id} id={x.id} className="gd-term">
            <dt>{x.term}</dt>
            <dd>{x.def}{x.see && <> <Link className="gd-see" href={x.see}>{t('More', 'Подробнее')}<IconArrow s={12} /></Link></>}</dd>
          </div>
        ))}
      </dl>
      <SiteFoot lang={lang} t={t} back="/learn/glossary" />
    </div>
  );
}
