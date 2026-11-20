import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { jsonLd } from '@/lib/seo';
import { faqGroups } from '@/lib/faq';
import { IconArrow } from '@/components/ui';
import { FaqList } from '@/components/faq-list';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Sailing game FAQ: today’s race, controls, rules', 'Вопросы о парусной игре: гонка дня, управление, правила', 'Preguntas del juego de vela: la regata del día, controles, reglas', 'Segelspiel-FAQ: Regatta des Tages, Steuerung, Regeln', 'Yelken oyunu SSS: günün yarışı, kontroller, kurallar', 'FAQ du jeu de voile : régate du jour, commandes, règles', 'Domande sul gioco di vela: la regata del giorno, i comandi, le regole', {
  path: '/faq', card: '/og/page/faq',
  description: [
    'Questions about Up and down, the free sailing race game: does it work on a phone, how today’s race and the ranking work, sailing the boat, the racing rules the computer boats follow.',
    'Вопросы об Up and down, бесплатной парусной гонке: работает ли на телефоне, как устроены гонка дня и рейтинг, управление лодкой, правила, по которым гоняются компьютерные лодки.', 'Preguntas sobre Up and down, el juego gratuito de regatas a vela: si funciona en el móvil, cómo van la regata del día y la clasificación, cómo navegar el barco, las reglas de regatas que siguen los barcos del ordenador.', 'Fragen zu Up and down, dem kostenlosen Segelregatta-Spiel: Läuft es auf dem Handy, wie funktionieren die Regatta des Tages und die Rangliste, wie segelt man das Boot, welche Wettfahrtregeln befolgen die Computerboote.', 'Up and down, ücretsiz yelken yarışı oyunu hakkında sorular: telefonda çalışır mı, günün yarışı ve sıralama nasıl işler, tekneyi kullanmak, bilgisayar teknelerinin uyduğu yarış kuralları.', 'Questions sur Up and down, le jeu de régate à la voile gratuit : fonctionne-t-il sur téléphone, comment marchent la régate du jour et le classement, comment mener le bateau, quelles règles de course suivent les bateaux de l’ordinateur.', 'Domande su Up and down, il gioco di regate a vela gratuito: funziona su un telefono, come funzionano la regata del giorno e la classifica, come si conduce la barca, le regole di regata che seguono le barche del computer.'],
});

// H2 · Questions: every question in five groups, white and the pale band in turn, as on the home page.
export default async function Faq({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const groups = faqGroups(t);
  // FAQPage structured data, so search engines can show the answers
  const ld = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang,
    mainEntity: groups.flatMap((g) => g.items).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <div className="scr help hp bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <SiteHead lang={lang} t={t} page="faq" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('FAQ', 'Вопросы и ответы', 'Preguntas', 'FAQ', 'SSS', 'FAQ', 'Domande frequenti')}</h1>
        <p className="hm-text">{t('The game, today’s race, sailing the boat and the rules, a question at a time. For the race screen itself, with pictures, see ', 'Об игре, гонке дня, управлении лодкой и правилах — по вопросу за раз. Сам экран гонки, с картинками, — на странице «', 'El juego, la regata del día, cómo navegar el barco y las reglas, una pregunta cada vez. Para la pantalla de regata en sí, con imágenes, mira ', 'Das Spiel, die Regatta des Tages, das Segeln und die Regeln, Frage für Frage. Für den Regattabildschirm selbst, mit Bildern, siehe ', 'Oyun, günün yarışı, tekneyi kullanmak ve kurallar, her seferinde bir soru. Resimli yarış ekranının kendisi için bkz. ', 'Le jeu, la régate du jour, la conduite du bateau et les règles, une question à la fois. Pour l’écran de course lui-même, en images, voir ', 'Il gioco, la regata del giorno, condurre la barca e le regole, una domanda alla volta. Per la schermata di regata, con le immagini, vedi ')}<Link href="/help">{t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca')}</Link>{t('.', '».')}</p>
        <nav className="hm-ph-nav" aria-label={t('Contents', 'Содержание', 'Contenido', 'Inhalt', 'İçindekiler', 'Sommaire', 'Indice')}>
          {groups.map((g) => <a key={g.id} className="hm-chip" href={`#q-${g.id}`}>{g.title}<span className="td">{g.items.length}</span></a>)}
        </nav>
      </header>

      {groups.map((g, i) => {
        const sec = (
          <section className="hm-page hm-sec" id={`q-${g.id}`} aria-labelledby={`q-${g.id}-t`}>
            <div className="hm-faq">
              <div className="hm-faq-side">
                <span className="kicker">{g.kicker}</span>
                <h2 className="hm-h2" id={`q-${g.id}-t`}>{g.title}</h2>
                <span className="meta">{t(`${g.items.length} questions`, `Вопросов: ${g.items.length}`, `${g.items.length} preguntas`, `${g.items.length} Fragen`, `${g.items.length} soru`, `${g.items.length} questions`, `${g.items.length} domande`)}</span>
              </div>
              <FaqList items={g.items} open />
            </div>
          </section>
        );
        return i % 2 ? <div className="hm-band" key={g.id}>{sec}</div> : <div key={g.id}>{sec}</div>;
      })}

      <div className={groups.length % 2 ? 'hm-band' : ''}>
        <section className="hm-page hm-sec hm-help" aria-labelledby="q-more">
          <div className="hm-help-main">
            <span className="kicker">{t('Still unsure?', 'Остались вопросы?', '¿Aún tienes dudas?', 'Noch unsicher?', 'Hâlâ emin değil misin?', 'Encore un doute ?', 'Ancora dubbi?')}</span>
            <h2 className="hm-h2" id="q-more">{t('The race screen, with pictures', 'Экран гонки в картинках', 'La pantalla de regata, con imágenes', 'Der Regattabildschirm, mit Bildern', 'Resimlerle yarış ekranı', 'L’écran de course, en images', 'La schermata di regata, con le immagini')}</h2>
            <p className="hm-text">{t('How to play goes through every button, the wind ring, the start sequence and the six rules you meet most.', 'На странице «Как играть» — каждая кнопка, кольцо ветра, стартовая процедура и шесть самых частых правил.', 'Cómo jugar repasa cada botón, el anillo de viento, la secuencia de salida y las seis reglas que más verás.', '„So spielst du“ geht jede Taste durch, den Windring, die Startsequenz und die sechs Regeln, denen du am häufigsten begegnest.', 'Nasıl oynanır; her düğmeyi, rüzgâr halkasını, start sırasını ve en sık karşılaşacağın altı kuralı anlatır.', 'Comment jouer passe en revue chaque bouton, le cercle du vent, la procédure de départ et les six règles que tu rencontreras le plus.', '«Come si gioca» spiega ogni pulsante, l’anello del vento, la sequenza di partenza e le sei regole che incontri più spesso.')}</p>
            <Link className="pill pill-primary hm-cta" href="/help"><span className="btn-t">{t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca')}</span><IconArrow /></Link>
          </div>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back="/faq" />
    </div>
  );
}
