import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { glossaryGroups, SCENES_3D, dictPath, dictName } from '@/lib/glossary';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot, Trail, type Crumb } from '@/components/site-chrome';
import { Toc } from '@/components/toc';
import { WordScene } from '@/components/word-scene';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/reading.css';
import '@/styles/dictionary.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Sailing dictionary: the words of racing, sailed in 3D', 'Словарь яхтсмена: слова парусных гонок в 3D', 'Diccionario de vela: las palabras de las regatas, en 3D', 'Segelwörterbuch: die Wörter des Regattasegelns in 3D', 'Yelken sözlüğü: yarışın sözcükleri, 3D olarak', 'Dictionnaire de la voile : les mots de la régate, en 3D', 'Dizionario della vela: le parole della regata, in 3D', 'Dicionário de vela: as palavras da regata, em 3D', {
  path: '/dictionary', card: '/og/page/glossary',
  description: [
    'The words of sailboat racing, each defined in a sentence or two and most of them sailed on the water in 3D: tack and gybe, by the lee, layline, header and lift, overlap, mark-room, OCS, the favoured end and more.',
    'Слова парусных гонок: каждое объяснено в паре предложений, и почти все показаны на воде в 3D — оверштаг и фордевинд, бай-ли, лейлайн, заход и отход ветра, связанность, место у знака, фальстарт, выгодный конец линии и другие.',
    'Las palabras de las regatas a vela, cada una definida en una o dos frases y casi todas navegadas en el agua en 3D: virada y trasluchada, layline, roladas, compromiso, espacio en baliza, OCS, el extremo favorecido y más.',
    'Die Wörter des Regattasegelns, jedes in ein, zwei Sätzen erklärt und fast alle in 3D auf dem Wasser gesegelt: Wende und Halse, Layline, Dreher und Raumer, Überlappung, Bahnmarkenraum, OCS, das begünstigte Ende und mehr.',
    'Yelken yarışının sözcükleri: her biri bir iki cümleyle açıklanmış, çoğu suyun üstünde 3D olarak seyredilmiş — tramola ve kavança, layline, lehte ve aleyhte dönüş, bindirme, şamandıra alanı, OCS, avantajlı uç ve daha fazlası.',
    'Le vocabulaire de la régate, chaque mot défini en une phrase ou deux et presque tous montrés sur l’eau en 3D : virement et empannage, fausse panne, lay-line, refus et adonnante, engagement, place à la marque, OCS, l’extrémité favorisée et plus encore.',
    'Le parole delle regate a vela, ognuna spiegata in una frase o due e quasi tutte navigate in acqua in 3D: virata e strambata, strapoggio, layline, salti di vento, ingaggio, spazio alla boa, OCS, l’estremità favorita e altro.',
    'As palavras da regata a vela, cada uma explicada em uma ou duas frases e quase todas veleadas na água em 3D: cambada e jibe, layline, rondadas, sobreposição, espaço de marca, OCS, o lado favorecido e mais.'],
});

// D1 · The sailing dictionary: the glossary's words (lib/glossary.ts), each with a page of its own (./[term]), most of
// them sailed on the water in 3D. Over the heading the game goes from word to word, the one shown a link to its page;
// then the six groups, each word's name a link, the 3D mark on the ones the game sails, and its definition, all in the
// page as it is sent. Marked up as a DefinedTermSet, each term at its own address.
export default async function Dictionary({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const groups = glossaryGroups(t);
  const terms = groups.flatMap((g) => g.terms);
  const shown = terms.filter((x) => SCENES_3D.includes(x.id));
  const url = SITE + langUrl(dictPath(), lang);
  const name = dictName(t);
  const crumbs: Crumb[] = [[t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata', 'Guias de regata'), '/learn'], [name, dictPath()]];
  const ld = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url, name, inLanguage: lang, url,
    hasDefinedTerm: terms.map((x) => ({ '@type': 'DefinedTerm', '@id': SITE + langUrl(dictPath(x.id), lang), url: SITE + langUrl(dictPath(x.id), lang), name: x.term, description: x.def, inDefinedTermSet: url })),
  };
  const topics = t('Topics', 'Темы', 'Temas', 'Themen', 'Konular', 'Thèmes', 'Argomenti', 'Temas');
  const cards: [string, string, string][] = [
    [t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario', 'Glossário'), t('All the words on one page, with the guides', 'Все слова на одной странице, со ссылками на пособия', 'Todas las palabras en una página, con las guías', 'Alle Wörter auf einer Seite, mit den Anleitungen', 'Tüm sözcükler tek sayfada, rehberlerle', 'Tous les mots sur une page, avec les guides', 'Tutte le parole in una pagina, con le guide', 'Todas as palavras numa página, com os guias'), '/learn/glossary'],
    [t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları', 'Règles de course', 'Regole di regata', 'Regras de regata'), t('The racing rules, rule by rule', 'Правила гонок, правило за правилом', 'Las reglas de regatas, regla a regla', 'Die Wettfahrtregeln, Regel für Regel', 'Yarış kuralları, kural kural', 'Les règles de course, règle par règle', 'Le regole di regata, una per una', 'As regras de regata, regra por regra'), '/rulebook'],
    [t('On the water', 'На воде', 'En el agua', 'Auf dem Wasser', 'Suda', 'Sur l’eau', 'In acqua', 'Na água'), t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia'), '/race'],
  ];
  const n = terms.length, k = shown.length;
  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="learn" crumbs={crumbs} />
      <header className="gd-hero">
        <WordScene className="gd-hero-bg" lang={lang} title={t('The words sailed on the water in 3D', 'Слова на воде в 3D', 'Las palabras navegadas en el agua en 3D', 'Die Wörter in 3D auf dem Wasser gesegelt', 'Sözcükler suda 3D olarak', 'Les mots montrés sur l’eau en 3D', 'Le parole navigate in acqua in 3D', 'As palavras veleadas na água em 3D')}
            now={t('On the water', 'На воде', 'En el agua', 'Auf dem Wasser', 'Suda', 'Sur l’eau', 'In acqua', 'Na água')}
            tour={shown.map((x) => ({ id: x.id, term: x.term, href: dictPath(x.id) }))} />
        <div className="hm-page hm-ph">
          <Trail t={t} crumbs={crumbs} />
          <span className="kicker">{t('Racing guides · in 3D', 'Пособия по гонкам · в 3D', 'Guías de regatas · en 3D', 'Regatta-Anleitungen · in 3D', 'Yarış rehberleri · 3D', 'Guides de régate · en 3D', 'Guide alla regata · in 3D', 'Guias de regata · em 3D')}</span>
          <h1 className="hm-ph-h">{name}</h1>
          <p className="hm-text">{t(`${n} words of sailboat racing, each in a sentence or two, and ${k} of them sailed on the water in 3D, as the game sails them. Each has a page of its own.`, `${n} слов парусных гонок, каждое в паре предложений, и ${k} из них показаны на воде в 3D — так, как их проходит игра. У каждого слова своя страница.`, `${n} palabras de las regatas a vela, cada una en una frase o dos, y ${k} de ellas navegadas en el agua en 3D, como las navega el juego. Cada una tiene su propia página.`, `${n} Wörter des Regattasegelns, jedes in ein, zwei Sätzen, und ${k} davon in 3D auf dem Wasser gesegelt, so wie das Spiel sie segelt. Jedes hat eine eigene Seite.`, `Yelken yarışının ${n} sözcüğü, her biri bir iki cümleyle; ${k} tanesi oyunun seyrettiği gibi suda 3D olarak gösteriliyor. Her birinin kendi sayfası var.`, `${n} mots de la régate à la voile, chacun en une phrase ou deux, dont ${k} montrés sur l’eau en 3D, tels que le jeu les navigue. Chacun a sa propre page.`, `${n} parole delle regate a vela, ognuna in una frase o due, e ${k} navigate in acqua in 3D, come le naviga il gioco. Ognuna ha la sua pagina.`, `${n} palavras da regata a vela, cada uma em uma ou duas frases, e ${k} delas veleadas na água em 3D, como o jogo as veleja. Cada uma tem sua própria página.`)}</p>
          <nav className="hm-ph-nav rd-chips" aria-label={topics}>
            {groups.map((g) => <a key={g.id} className="hm-chip" href={`#${g.id}`}>{g.title}<span className="td">{g.terms.length}</span></a>)}
          </nav>
        </div>
      </header>

      <div className="hm-page rd-layout">
        <Toc items={groups.map((g) => [g.id, g.title])} label={topics} numbered />
        <div className="rd-main">
          <article className="gd">
            {groups.map((g, i) => (
              <section key={g.id} id={g.id} className="gd-sec" data-n={String(i + 1).padStart(2, '0')} aria-labelledby={`${g.id}-t`}>
                <h2 id={`${g.id}-t`}>{g.title}</h2>
                <dl className="rb-rules">
                  {g.terms.map((x) => (
                    <div key={x.id} id={x.id} className="rb-rule">
                      <dt><Link className="dc-term" href={dictPath(x.id)}>{x.term}</Link>{SCENES_3D.includes(x.id) ? <span className="dc-3d" aria-label={t('shown in 3D', 'показано в 3D', 'en 3D', 'in 3D', '3D olarak', 'en 3D', 'in 3D', 'em 3D')}>3D</span> : null}</dt>
                      <dd>{x.def}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </article>

          <section className="gd-more" aria-labelledby="dc-more">
            <h2 className="lbl-ink" id="dc-more">{t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku', 'Lire la suite', 'Leggi di più', 'Leia mais')}</h2>
            <div className="gd-next">
              {cards.map(([kk, label, href]) => <Link key={href} className="gd-next-card" href={href}><span className="lbl">{kk}</span><span className="card-title">{label}</span><IconArrow s={16} /></Link>)}
            </div>
          </section>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back={dictPath()} />
    </div>
  );
}
