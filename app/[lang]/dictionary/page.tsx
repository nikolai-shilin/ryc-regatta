import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd, langUrl, SITE } from '@/lib/seo';
import { glossaryGroups, SCENES_3D, dictPath, dictName } from '@/lib/glossary';
import { DictionaryScreen, type DictWords } from '@/components/dictionary-screen';
import { WORDS_CSS } from '@/public/game/words.js';
import { READING_VIEWPORT } from '@/lib/no-zoom';
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

// D1 · The sailing dictionary, as the race shows it (public/game/words.js): the water in 3D over the whole screen, the
// panel at its side with every word of the glossary (lib/glossary.ts), the one picked sailed on the water and named in
// the caption (components/dictionary-screen.tsx). All the words are in the page as it is sent, each name a link to its
// own page (./[term]); marked up as a DefinedTermSet, each term at its own address.
export default async function Dictionary({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const groups = glossaryGroups(t);
  const terms = groups.flatMap((g) => g.terms);
  const url = SITE + langUrl(dictPath(), lang);
  const name = dictName(t);
  const ld = {
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url, name, inLanguage: lang, url,
    hasDefinedTerm: terms.map((x) => ({ '@type': 'DefinedTerm', '@id': SITE + langUrl(dictPath(x.id), lang), url: SITE + langUrl(dictPath(x.id), lang), name: x.term, ...(x.en ? { alternateName: x.en } : {}), description: x.def, inDefinedTermSet: url })),
  };
  const w: DictWords = {
    title: name,
    back: t('Back', 'Назад', 'Atrás', 'Zurück', 'Geri', 'Retour', 'Indietro', 'Voltar'),
    find: t('Find a word', 'Найти слово', 'Buscar una palabra', 'Wort suchen', 'Sözcük ara', 'Chercher un mot', 'Cerca una parola', 'Buscar uma palavra'),
    clear: t('Clear', 'Очистить', 'Borrar', 'Löschen', 'Temizle', 'Effacer', 'Cancella', 'Limpar'),
    topics: t('Topics', 'Темы', 'Temas', 'Themen', 'Konular', 'Thèmes', 'Argomenti', 'Temas'),
    all: t('All', 'Все', 'Todas', 'Alle', 'Tümü', 'Tous', 'Tutte', 'Todas'),
    allGroups: t('All groups', 'Все группы', 'Todos los grupos', 'Alle Gruppen', 'Tüm gruplar', 'Tous les groupes', 'Tutti i gruppi', 'Todos os grupos'),
    notShown: t('Not shown on the water', 'На воде не показать', 'No se muestra en el agua', 'Nicht auf dem Wasser zu sehen', 'Suda gösterilmiyor', 'Pas montré sur l’eau', 'Non mostrato in acqua', 'Não mostrado na água'),
    notIn: t('Not in this group: “%s”.', 'В этой группе нет: «%s».', 'No está en este grupo: «%s».', 'Nicht in dieser Gruppe: „%s“.', 'Bu grupta yok: “%s”.', 'Pas dans ce groupe : « %s ».', 'Non in questo gruppo: «%s».', 'Não está neste grupo: “%s”.'),
    none: t('No word matches “%s”.', 'Ни одно слово не подходит под «%s».', 'Ninguna palabra coincide con «%s».', 'Kein Wort passt zu „%s“.', '“%s” ile eşleşen sözcük yok.', 'Aucun mot ne correspond à « %s ».', 'Nessuna parola corrisponde a «%s».', 'Nenhuma palavra corresponde a “%s”.'),
    page: t('Its page', 'Страница слова', 'Su página', 'Seine Seite', 'Sayfası', 'Sa page', 'La sua pagina', 'A página da palavra'),
    scene: t('The word sailed on the water in 3D', 'Слово на воде в 3D', 'La palabra navegada en el agua en 3D', 'Das Wort in 3D auf dem Wasser gesegelt', 'Sözcük suda 3D olarak', 'Le mot montré sur l’eau en 3D', 'La parola navigata in acqua in 3D', 'A palavra veleada na água em 3D'),
    more: t('Read more', 'Читать дальше', 'Leer más', 'Mehr lesen', 'Devamını oku', 'Lire la suite', 'Leggi di più', 'Leia mais'),
    links: [
      [t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario', 'Glossário'), '/learn/glossary'],
      [t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata', 'Guias de regata'), '/learn'],
      [t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları', 'Règles de course', 'Regole di regata', 'Regras de regata'), '/rulebook'],
      [t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia'), '/race'],
      ['Up and down', '/'],
    ],
  };
  return (
    <div className="scr dc-scr" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <style dangerouslySetInnerHTML={{ __html: WORDS_CSS }} />
      <DictionaryScreen lang={lang} w={w} shown3d={[...SCENES_3D]}
        groups={groups.map((g) => ({ id: g.id, title: g.title, terms: g.terms.map((x) => ({ id: x.id, term: x.term, def: x.def, ...(x.en ? { en: x.en } : {}), ...(x.warn ? { warn: x.warn } : {}) })) }))} />
    </div>
  );
}
