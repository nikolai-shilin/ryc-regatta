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

export const generateMetadata = titled('Racing guides', 'Пособия по гонкам', 'Guías de regatas', {
  path: '/learn', card: '/og/page/learn',
  description: [
    'Short guides to sailboat racing: points of sail, tacking and gybing, the racing rules, the start, wind shifts, the marks, downwind and boat speed. Then try them in a free 3D race.',
    'Короткие пособия по парусным гонкам: курсы относительно ветра, повороты, правила, старт, сдвиги ветра, знаки, попутные курсы и скорость. А потом попробуй их в бесплатной 3D-гонке.', 'Guías breves de regatas a vela: rumbos respecto al viento, virar y trasluchar, las reglas de regatas, la salida, las roladas, las balizas, la popa y la velocidad del barco. Luego pruébalas en una regata 3D gratuita.'],
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
        <span className="kicker">{t(`Up and down · ${guides.length} guides`, `Up and down · ${guides.length} ${ruPlural(guides.length, ['пособие', 'пособия', 'пособий'])}`, `Up and down · ${guides.length} guías`)}</span>
        <h1 className="hm-ph-h">{t('Racing guides', 'Пособия по гонкам', 'Guías de regatas')}</h1>
        <p className="hm-text">{t('What wins a sailboat race, a few minutes at a time: the points of sail and the tack, the rules when boats meet, the start, the wind shifts, the marks, the run and boat speed. Each guide ends on the water, in the game.', 'Что выигрывает парусную гонку — по несколько минут на тему: курсы относительно ветра и повороты, правила при встрече лодок, старт, заходы и отходы ветра, знаки, попутный курс и скорость. Каждое пособие заканчивается на воде, в игре.', 'Qué gana una regata a vela, unos minutos cada vez: los rumbos respecto al viento y la virada, las reglas cuando los barcos se encuentran, la salida, las roladas, las balizas, la empopada y la velocidad del barco. Cada guía acaba en el agua, en el juego.')}</p>
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
              <span className="hm-src">{t('Read', 'Читать', 'Leer')}<IconArrow s={14} /></span>
            </div>
          </Link>
        ))}
        <Link className="gd-banner" href="/learn/glossary">
          <span className="kicker">{t('Glossary', 'Словарь', 'Glosario')}</span>
          <span className="gd-banner-t">
            <span className="card-title">{t('Sailing racing glossary', 'Словарь парусных гонок', 'Glosario de regatas a vela')}</span>
            <p>{t('Beat, overlap, clear astern, header, layline, zone, mark-room, OCS: the words of a race course, a sentence or two each.', 'Лавировка, связанность, чисто позади, заход ветра, лейлайн, зона, место у знака, фальстарт: слова гоночной дистанции, по паре предложений.', 'Ceñida, compromiso, libre por la popa, rolada desfavorable, layline, zona, espacio en baliza, OCS: las palabras de un recorrido de regata, una frase o dos cada una.')}</p>
          </span>
          <span className="gd-banner-go">{t('Read', 'Читать', 'Leer')}<IconArrow s={14} /></span>
        </Link>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn" />
    </div>
  );
}
