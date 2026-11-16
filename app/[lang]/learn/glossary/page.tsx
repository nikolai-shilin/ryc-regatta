import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { glossaryGroups, seeLabel } from '@/lib/glossary';
import { GUIDES } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';

export const generateMetadata = titled('Sailing racing glossary', 'Словарь парусных гонок', {
  path: '/learn/glossary',
  description: [
    'The words of sailboat racing in plain English: beat, close-hauled, tack and gybe, overlap, clear astern, header and lift, layline, zone, mark-room, OCS, penalty turn and more.',
    'Слова парусных гонок простым языком: лавировка, бейдевинд, оверштаг и фордевинд, связанность, чисто позади, заход и отход ветра, лейлайн, зона, место у знака, фальстарт, штрафной оборот и другие.'],
});

// L2 · The glossary: every term with a short definition, in six groups (chips with their counts at the top, then a
// section each), each linkable (#layline), its see-link naming where it goes ("Rule 18", "Guide: rounding the marks"),
// and marked up as a DefinedTermSet, so a search for one word can land on its line; at the foot, the way on to the guides.

// how many guides, in words where it's a small number ("Six guides"), as the closing band says it
const EN_N = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const RU_N = ['', 'Одно', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'];
export default async function Glossary({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const groups = glossaryGroups(t);
  const terms = groups.flatMap((g) => g.terms);
  const url = SITE + langUrl('/learn/glossary', lang);
  const crumbs: Crumb[] = [[t('Learn to race', 'Учись гоняться'), '/learn'], [t('Glossary', 'Словарь'), '/learn/glossary']];
  const n = GUIDES.length;
  const ld = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url, name: t('Sailing racing glossary', 'Словарь парусных гонок'), inLanguage: lang, url,
    hasDefinedTerm: terms.map((x) => ({ '@type': 'DefinedTerm', '@id': `${url}#${x.id}`, name: x.term, description: x.def, inDefinedTermSet: url })),
  };
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      <header className="hm-page hm-ph">
        <Trail t={t} crumbs={crumbs} />
        <span className="kicker">{t('Learn to race · glossary', 'Учись гоняться · словарь')}</span>
        <h1 className="hm-ph-h">{t('Sailing racing glossary', 'Словарь парусных гонок')}</h1>
        <p className="hm-text">{t(`The ${terms.length} words you hear most on a race course, each in a sentence or two. The guides go further.`, `${terms.length} слов, которые чаще всего слышно на гоночной дистанции, — каждое в паре предложений. Подробнее — в пособиях.`)}</p>
        <nav className="hm-ph-nav" aria-label={t('Topics', 'Темы')}>
          {groups.map((g) => (
            <a key={g.id} className="hm-chip" href={`#${g.id}`} aria-label={t(`${g.title}, ${g.terms.length} terms`, `${g.title}, терминов: ${g.terms.length}`)}>
              {g.title}<span className="td">{g.terms.length}</span>
            </a>
          ))}
        </nav>
      </header>
      <div className="hm-page gd gd-groups">
        {groups.map((g) => (
          <section key={g.id} id={g.id} className="gd-group" aria-labelledby={`${g.id}-t`}>
            <h2 id={`${g.id}-t`}>{g.title}<span className="lbl" aria-hidden="true">{g.terms.length}</span></h2>
            <dl className="gd-terms">
              {g.terms.map((x) => (
                <div key={x.id} id={x.id} className="gd-term">
                  <dt>{x.term}</dt>
                  <dd>{x.def}</dd>
                  {x.see && <dd className="gd-see-d"><Link className="gd-see" href={x.see}>{seeLabel(x.see, t, lang)}<IconArrow s={12} /></Link></dd>}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="hm-page">
        <section className="rd-cta" aria-labelledby="gl-guides">
          <div className="rd-cta-t">
            <span className="lbl">{t('The words, on the water', 'Слова — на воде')}</span>
            <b id="gl-guides">{t(`${EN_N[n] || n} guides, each ending in a race`, `${RU_N[n] || n} ${ruPlural(n, ['пособие', 'пособия', 'пособий'])}, и каждое заканчивается гонкой`)}</b>
          </div>
          <Link className="pill pill-primary" href="/learn"><span className="btn-t">{t('Learn to race', 'Учись гоняться')}</span><IconArrow /></Link>
        </section>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn/glossary" />
    </div>
  );
}
