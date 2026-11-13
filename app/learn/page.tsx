import Link from 'next/link';
import { getT, titled } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { GUIDES, guide } from '@/lib/guides';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const generateMetadata = titled('Learn to race', 'Учись гоняться', {
  path: '/learn',
  description: [
    'Short guides to sailboat racing: the racing rules in five minutes, how to win a start, and how to play the wind shifts upwind. Then try each one in a free 3D sailing race.',
    'Короткие пособия по парусным гонкам: правила за пять минут, как выиграть старт и как использовать заходы ветра на лавировке. А потом попробуй каждое в бесплатной 3D-гонке.'],
});

// L0 · Learn to race: the guides, one card each.
export default async function Learn() {
  const [{ lang, t }, account] = await Promise.all([getT(), getAccount()]);
  const guides = GUIDES.map((g) => guide(g, t, lang));
  return (
    <div className="scr help hp" lang={lang}>
      <SiteHead lang={lang} t={t} account={account} page="learn" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('Learn to race', 'Учись гоняться')}</h1>
        <p className="hm-text">{t('What wins a sailboat race, a few minutes at a time: the rules when boats meet, the start, and the wind shifts. Each guide ends on the water, in the game.', 'Что выигрывает парусную гонку — по несколько минут на тему: правила при встрече лодок, старт и заходы ветра. Каждое пособие заканчивается на воде, в игре.')}</p>
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
      </div>
      <SiteFoot lang={lang} t={t} account={account} back="/learn" />
    </div>
  );
}
