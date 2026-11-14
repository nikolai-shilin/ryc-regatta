import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { GUIDES, guide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const generateMetadata = titled('Learn to race', 'Учись гоняться', {
  path: '/learn',
  description: [
    'Short guides to sailboat racing: the racing rules, the start, wind shifts, mark roundings, sailing downwind and boat speed, and a glossary. Then try each one in a free 3D sailing race.',
    'Короткие пособия по парусным гонкам: правила, старт, заходы ветра, огибание знаков, попутные курсы и скорость лодки, а также словарь. А потом попробуй каждое в бесплатной 3D-гонке.'],
});

// L0 · Learn to race: the guides, one card each.
export default async function Learn({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const guides = GUIDES.map((g) => guide(g, t, lang));
  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="learn" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('Learn to race', 'Учись гоняться')}</h1>
        <p className="hm-text">{t('What wins a sailboat race, a few minutes at a time: the rules when boats meet, the start, the wind shifts, the marks, the run and boat speed. Each guide ends on the water, in the game.', 'Что выигрывает парусную гонку — по несколько минут на тему: правила при встрече лодок, старт, заходы ветра, знаки, попутный курс и скорость. Каждое пособие заканчивается на воде, в игре.')}</p>
      </header>
      <div className="hm-page gd-list">
        {guides.map((g) => (
          <Link key={g.slug} className="gd-card" href={`/learn/${g.slug}`}>
            <span className="kicker">{g.kicker}</span>
            <span className="card-title">{g.title}</span>
            <p>{g.description}</p>
            <span className="hm-src">{t('Read', 'Читать')}<IconArrow s={14} /></span>
          </Link>
        ))}
        <Link className="gd-card" href="/learn/glossary">
          <span className="kicker">{t('Learn to race · glossary', 'Учись гоняться · словарь')}</span>
          <span className="card-title">{t('Sailing racing glossary', 'Словарь парусных гонок')}</span>
          <p>{t('Beat, overlap, clear astern, header, layline, zone, mark-room, OCS: the words of a race course, a sentence or two each.', 'Лавировка, перекрытие, чисто позади, заход ветра, лейлайн, зона, место у знака, фальстарт: слова гоночной дистанции, по паре предложений.')}</p>
          <span className="hm-src">{t('Read', 'Читать')}<IconArrow s={14} /></span>
        </Link>
      </div>
      <SiteFoot lang={lang} t={t} back="/learn" />
    </div>
  );
}
