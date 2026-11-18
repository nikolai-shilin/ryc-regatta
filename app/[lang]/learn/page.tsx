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

export const generateMetadata = titled('Learn to race', 'Учись гоняться', {
  path: '/learn', card: '/og/page/learn',
  description: [
    'Short guides to sailboat racing: points of sail, tacking and gybing, the racing rules, the start, wind shifts, the marks, downwind and boat speed. Then try them in a free 3D race.',
    'Короткие пособия по парусным гонкам: курсы относительно ветра, повороты, правила, старт, сдвиги ветра, знаки, попутные курсы и скорость. А потом попробуй их в бесплатной 3D-гонке.'],
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
        <span className="kicker">{t(`Up and down · ${guides.length} guides`, `Up and down · ${guides.length} ${ruPlural(guides.length, ['пособие', 'пособия', 'пособий'])}`)}</span>
        <h1 className="hm-ph-h">{t('Learn to race', 'Учись гоняться')}</h1>
        <p className="hm-text">{t('What wins a sailboat race, a few minutes at a time: the points of sail and the tack, the rules when boats meet, the start, the wind shifts, the marks, the run and boat speed. Each guide ends on the water, in the game.', 'Что выигрывает парусную гонку — по несколько минут на тему: курсы относительно ветра и повороты, правила при встрече лодок, старт, заходы и отходы ветра, знаки, попутный курс и скорость. Каждое пособие заканчивается на воде, в игре.')}</p>
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
              <span className="hm-src">{t('Read', 'Читать')}<IconArrow s={14} /></span>
            </div>
          </Link>
        ))}
        <Link className="gd-banner" href="/learn/rulebook">
          <span className="kicker">{t('Rule book', 'Все правила')}</span>
          <span className="gd-banner-t">
            <span className="card-title">{t('The racing rules, rule by rule', 'Правила гонок, правило за правилом')}</span>
            <p>{t('Every rule of the Racing Rules of Sailing in plain words, from right of way to protests, with the definitions and the race signals.', 'Все правила парусных гонок простыми словами, от права дороги до протестов, с определениями и гоночными сигналами.')}</p>
          </span>
          <span className="gd-banner-go">{t('Read', 'Читать')}<IconArrow s={14} /></span>
        </Link>
        <Link className="gd-banner" href="/learn/glossary">
          <span className="kicker">{t('Glossary', 'Словарь')}</span>
          <span className="gd-banner-t">
            <span className="card-title">{t('Sailing racing glossary', 'Словарь парусных гонок')}</span>
            <p>{t('Beat, overlap, clear astern, header, layline, zone, mark-room, OCS: the words of a race course, a sentence or two each.', 'Лавировка, связанность, чисто позади, заход ветра, лейлайн, зона, место у знака, фальстарт: слова гоночной дистанции, по паре предложений.')}</p>
          </span>
          <span className="gd-banner-go">{t('Read', 'Читать')}<IconArrow s={14} /></span>
        </Link>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn" />
    </div>
  );
}
