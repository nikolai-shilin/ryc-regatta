import Link from 'next/link';
import Image from 'next/image';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { jsonLd, langUrl, SITE, AUTHOR } from '@/lib/seo';
import { glossaryGroups, seeLabel } from '@/lib/glossary';
import { GUIDES, guide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { Toc } from '@/components/toc';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/reading.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü', {
  path: '/learn/glossary', card: '/og/page/glossary',
  description: [
    'The words of sailboat racing in plain English: beat, close-hauled, tack and gybe, overlap, clear astern, header and lift, layline, zone, mark-room, OCS, penalty turn and more.',
    'Слова парусных гонок простым языком: лавировка, бейдевинд, оверштаг и фордевинд, связанность, чисто позади, заход и отход ветра, лейлайн, зона, место у знака, фальстарт, штрафной оборот и другие.', 'Las palabras de las regatas a vela en lenguaje llano: ceñida, de ceñida, virada y trasluchada, compromiso, libre por la popa, rolada desfavorable y favorable, layline, zona, espacio en baliza, OCS, giro de penalización y más.', 'Die Wörter des Segelregattasports in einfachen Worten: Kreuz, hoch am Wind, Wende und Halse, Überlappung, klar achteraus, Dreher und Raumer, Layline, Zone, Bahnmarkenraum, OCS, Strafkringel und mehr.', 'Yelken yarışının sözcükleri sade bir dille: orsa ayağı, orsa, tramola ve kavança, bindirme, açık arkada, lehte ve aleyhte dönüş, layline, bölge, şamandıra alanı, OCS, ceza dönüşü ve daha fazlası.'],
});

// L2 · The glossary, laid out as a guide (learn/[slug]/page.tsx): the title and the intro over a picture from the game, the
// contents beside the text on a wide screen (on a narrower one, chips with each group's count), then its six groups as
// numbered sections, every term linkable (#layline), its see-link naming where it goes ("Rule 18", "Guide: rounding the
// marks"), and marked up as a DefinedTermSet, so a search for one word can land on its line; at the foot, the way on.

// how many guides, in words where it's a small number ("Six guides"), as the closing band says it
const EN_N = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const TR_N = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz', 'On'];
const DE_N = ['', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn'];
const ES_N = ['', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
const RU_N = ['', 'Одно', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'];
export default async function Glossary({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const groups = glossaryGroups(t);
  const terms = groups.flatMap((g) => g.terms);
  const img = guide('sail', t, lang).img!;
  const url = SITE + langUrl('/learn/glossary', lang);
  const crumbs: Crumb[] = [[t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri'), '/learn'], [t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük'), '/learn/glossary']];
  const n = GUIDES.length;
  const ld = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url, name: t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü'), inLanguage: lang, url,
    hasDefinedTerm: terms.map((x) => ({ '@type': 'DefinedTerm', '@id': `${url}#${x.id}`, name: x.term, description: x.def, inDefinedTermSet: url })),
  };
  const cards: [string, string, string][] = [
    [t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları'), t('The racing rules, rule by rule', 'Правила гонок, правило за правилом', 'Las reglas de regatas, regla a regla', 'Die Wettfahrtregeln, Regel für Regel', 'Yarış kuralları, kural kural'), '/rulebook'],
    [t('Further reading', 'Подробнее', 'Más lecturas', 'Weiterlesen', 'Daha fazla oku'), guide('rules', t, lang).short, '/learn/rules'],
    [t('On the water', 'На воде', 'En el agua', 'Auf dem Wasser', 'Suda'), t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı'), '/race'],
  ];
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      <header className="gd-hero">
        <Image className="gd-hero-bg" src={img.src} width={img.width} height={img.height} sizes="100vw" fetchPriority="high" loading="eager" alt={img.alt} />
        <div className="hm-page hm-ph">
          <Trail t={t} crumbs={crumbs} />
          <span className="kicker">{t('Racing guides · glossary', 'Пособия по гонкам · словарь', 'Guías de regatas · glosario', 'Regatta-Anleitungen · Glossar', 'Yarış rehberleri · sözlük')}</span>
          <h1 className="hm-ph-h">{t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü')}</h1>
          <p className="hm-text">{t(`The ${terms.length} words you hear most on a race course, each in a sentence or two. The guides go further.`, `${terms.length} слов, которые чаще всего слышно на гоночной дистанции, — каждое в паре предложений. Подробнее — в пособиях.`, `Las ${terms.length} palabras que más oyes en un recorrido de regata, cada una en una frase o dos. Las guías van más allá.`, `Die ${terms.length} Wörter, die du auf einer Regattabahn am häufigsten hörst, jedes in ein bis zwei Sätzen. Die Anleitungen gehen weiter.`, `Bir yarış parkurunda en sık duyduğun ${terms.length} sözcük, her biri bir iki cümleyle. Rehberler daha da ileri gider.`)}</p>
          <p className="gd-by">{t('By ', '', 'Por ', 'Von ', 'Yazan: ')}<span>{t(...AUTHOR.name)}</span>, {AUTHOR.org}</p>
          <nav className="hm-ph-nav rd-chips" aria-label={t('Topics', 'Темы', 'Temas', 'Themen', 'Konular')}>
            {groups.map((g) => (
              <a key={g.id} className="hm-chip" href={`#${g.id}`} aria-label={t(`${g.title}, ${g.terms.length} terms`, `${g.title}, терминов: ${g.terms.length}`, `${g.title}, ${g.terms.length} términos`, `${g.title}, ${g.terms.length} Begriffe`, `${g.title}, ${g.terms.length} terim`)}>
                {g.title}<span className="td">{g.terms.length}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="hm-page rd-layout">
        <Toc items={groups.map((g) => [g.id, g.title])} label={t('Topics', 'Темы', 'Temas', 'Themen', 'Konular')} numbered />
        <div className="rd-main">
          <article className="gd">
            {groups.map((g, i) => (
              <section key={g.id} id={g.id} className="gd-sec" data-n={String(i + 1).padStart(2, '0')} aria-labelledby={`${g.id}-t`}>
                <h2 id={`${g.id}-t`}>{g.title}</h2>
                <dl className="rb-rules">
                  {g.terms.map((x) => (
                    <div key={x.id} id={x.id} className="rb-rule">
                      <dt>{x.term}</dt>
                      <dd>{x.def}</dd>
                      {x.see && <dd className="gd-see-d"><Link className="gd-see" href={x.see}>{seeLabel(x.see, t, lang)}<IconArrow s={12} /></Link></dd>}
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </article>

          <section className="gd-try" aria-labelledby="gl-guides">
            <div className="gd-try-t">
              <span className="gd-try-k">{t('The words, on the water', 'Слова — на воде', 'Las palabras, en el agua', 'Die Wörter, auf dem Wasser', 'Sözcükler, suda')}</span>
              <h2 className="hm-h2" id="gl-guides">{t(`${EN_N[n] || n} guides, each ending in a race`, `${RU_N[n] || n} ${ruPlural(n, ['пособие', 'пособия', 'пособий'])}, и каждое заканчивается гонкой`, `${ES_N[n] || n} guías, cada una acaba en una regata`, `${DE_N[n] || n} Anleitungen, jede endet mit einer Regatta`, `${TR_N[n] ? n : n} rehber, her biri bir yarışla biter`)}</h2>
              <p>{t('Up and down is free, on a phone or a computer, with nothing to install.', 'Up and down бесплатна, на телефоне или компьютере, ничего не нужно устанавливать.', 'Up and down es gratis, en el móvil o en el ordenador, sin instalar nada.', 'Up and down ist kostenlos, auf dem Handy oder am Computer, ohne etwas zu installieren.', 'Up and down ücretsizdir, telefonda ya da bilgisayarda, hiçbir şey kurmadan.')}</p>
            </div>
            <Link className="gd-try-go" href="/learn">{t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri')}<IconArrow /></Link>
          </section>

          <section className="gd-more" aria-labelledby="gd-more">
            <h2 className="lbl-ink" id="gd-more">{t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku')}</h2>
            <div className="gd-next">
              {cards.map(([k, label, href]) => <Link key={href} className="gd-next-card" href={href}><span className="lbl">{k}</span><span className="card-title">{label}</span><IconArrow s={16} /></Link>)}
            </div>
          </section>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back="/learn/glossary" />
    </div>
  );
}
