import Link from 'next/link';
import Image from 'next/image';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { ruPlural } from '@/lib/lang';
import { GUIDES, guide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata', {
  path: '/learn', card: '/og/page/learn',
  description: [
    'Short guides to sailboat racing: points of sail, tacking and gybing, the racing rules, the start, wind shifts, the marks, downwind and boat speed. Then try them in a free 3D race.',
    'Короткие пособия по парусным гонкам: курсы относительно ветра, повороты, правила, старт, сдвиги ветра, знаки, попутные курсы и скорость. А потом попробуй их в бесплатной 3D-гонке.', 'Guías breves de regatas a vela: rumbos respecto al viento, virar y trasluchar, las reglas de regatas, la salida, las roladas, las balizas, la popa y la velocidad del barco. Luego pruébalas en una regata 3D gratuita.', 'Kurze Anleitungen zum Segelregattasport: Kurse zum Wind, Wenden und Halsen, die Wettfahrtregeln, der Start, Winddreher, die Bahnmarken, Vorwindkurs und Bootstempo. Dann probiere sie in einer kostenlosen 3D-Regatta aus.', 'Yelken yarışı için kısa rehberler: seyir yönleri, tramola ve kavança, yarış kuralları, start, rüzgâr dönüşleri, şamandıralar, pupa ve tekne hızı. Sonra ücretsiz bir 3D yarışta dene.', 'De courts guides de régate à la voile : les allures, virer de bord et empanner, les règles de course, le départ, les bascules de vent, les bouées, le portant et la vitesse. Puis mets-les en pratique dans une régate gratuite en 3D.', 'Brevi guide alle regate a vela: le andature, virata e strambata, le regole di regata, la partenza, i salti di vento, le boe, le andature portanti e la velocità della barca. Poi provale in una regata 3D gratuita.'],
});

// L0 · Learn to race: the guides, one card each (its picture from the game and its number over it; the one without a
// picture has its topic in big letters instead), and the glossary as a banner under them.
export default async function Learn({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const guides = GUIDES.map((g) => guide(g, t, lang));
  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="learn" />
      <header className="hm-page hm-ph">
        <span className="kicker">{t(`Up and down · ${guides.length} guides`, `Up and down · ${guides.length} ${ruPlural(guides.length, ['пособие', 'пособия', 'пособий'])}`, `Up and down · ${guides.length} guías`, `Up and down · ${guides.length} Anleitungen`, `Up and down · ${guides.length} rehber`, `Up and down · ${guides.length} guides`, `Up and down · ${guides.length} guide`)}</span>
        <h1 className="hm-ph-h">{t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata')}</h1>
        <p className="hm-text">{t('What wins a sailboat race, a few minutes at a time: the points of sail and the tack, the rules when boats meet, the start, the wind shifts, the marks, the run and boat speed. Each guide ends on the water, in the game.', 'Что выигрывает парусную гонку — по несколько минут на тему: курсы относительно ветра и повороты, правила при встрече лодок, старт, заходы и отходы ветра, знаки, попутный курс и скорость. Каждое пособие заканчивается на воде, в игре.', 'Qué gana una regata a vela, unos minutos cada vez: los rumbos respecto al viento y la virada, las reglas cuando los barcos se encuentran, la salida, las roladas, las balizas, la empopada y la velocidad del barco. Cada guía acaba en el agua, en el juego.', 'Was eine Segelregatta gewinnt, ein paar Minuten auf einmal: die Kurse zum Wind und die Wende, die Regeln, wenn Boote sich begegnen, der Start, die Winddreher, die Bahnmarken, der Vorwindkurs und das Bootstempo. Jede Anleitung endet auf dem Wasser, im Spiel.', 'Bir yelken yarışını ne kazandırır, her seferinde birkaç dakika: seyir yönleri ve tramola, tekneler karşılaşınca kurallar, start, rüzgâr dönüşleri, şamandıralar, pupa ve tekne hızı. Her rehber suda, oyunda biter.', 'Ce qui fait gagner une régate, quelques minutes à la fois : les allures et le virement de bord, les règles quand les bateaux se croisent, le départ, les bascules, les bouées, le vent arrière et la vitesse. Chaque guide se termine sur l’eau, dans le jeu.', 'Cosa fa vincere una regata a vela, pochi minuti alla volta: le andature e le mure, le regole quando le barche si incontrano, la partenza, i salti di vento, le boe, la poppa e la velocità della barca. Ogni guida finisce in acqua, nel gioco.')}</p>
      </header>
      <div className="hm-page gd-list">
        {guides.map((g, i) => (
          <Link key={g.slug} className="gd-card" href={`/learn/${g.slug}`}>
            <div className={g.img ? 'gd-card-pic' : 'gd-card-pic gd-card-slate'}>
              {g.img
                ? <Image src={g.img.src} width={g.img.width} height={g.img.height} sizes="(min-width: 900px) 33vw, 100vw" alt="" />
                : <span className="gd-card-topic" aria-hidden="true">{g.kicker.split(' · ')[1]}</span>}
              <span className="gd-card-n" aria-hidden="true">{i + 1}</span>
            </div>
            <div className="gd-card-b">
              <span className="kicker">{g.kicker}</span>
              <span className="card-title">{g.title}</span>
              <p>{g.description}</p>
              <span className="hm-src">{t('Read', 'Читать', 'Leer', 'Lesen', 'Oku', 'Lire', 'Leggi')}<IconArrow s={14} /></span>
            </div>
          </Link>
        ))}
        <Link className="gd-banner" href="/learn/glossary">
          <span className="kicker">{t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario')}</span>
          <span className="gd-banner-t">
            <span className="card-title">{t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela', 'Segelregatta-Glossar', 'Yelken yarışı sözlüğü', 'Glossaire de la régate à la voile', 'Glossario delle regate a vela')}</span>
            <p>{t('Beat, overlap, clear astern, header, layline, zone, mark-room, OCS: the words of a race course, a sentence or two each.', 'Лавировка, связанность, чисто позади, заход ветра, лейлайн, зона, место у знака, фальстарт: слова гоночной дистанции, по паре предложений.', 'Ceñida, compromiso, libre por la popa, rolada desfavorable, layline, zona, espacio en baliza, OCS: las palabras de un recorrido de regata, una frase o dos cada una.', 'Kreuz, Überlappung, klar achteraus, Dreher, Layline, Zone, Bahnmarkenraum, OCS: die Wörter einer Regattabahn, je ein bis zwei Sätze.', 'Orsa ayağı, bindirme, açık arkada, aleyhte dönüş, layline, bölge, şamandıra alanı, OCS: bir yarış parkurunun sözcükleri, her biri bir iki cümle.', 'Bord de près, engagement, route libre derrière, refus, lay-line, zone, place à la marque, OCS : les mots d’un parcours de régate, une phrase ou deux chacun.', 'Bolina, ingaggio, libera dietro, scarso, layline, zona, spazio alla boa, OCS: le parole di un campo di regata, una frase o due ciascuna.')}</p>
          </span>
          <span className="gd-banner-go">{t('Read', 'Читать', 'Leer', 'Lesen', 'Oku', 'Lire', 'Leggi')}<IconArrow s={14} /></span>
        </Link>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn" />
    </div>
  );
}
