import { getT, titled, type LangParams } from '@/lib/i18n';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { BadgesGrid } from '@/components/progress';

export const generateMetadata = titled('Badges', 'Значки', {
  path: '/race/badges',
  description: [
    'The badges in Up and down: each for something a good sailor does, from a clean race and a start on the gun to tacking on the headers and racing at every venue.',
    'Значки в Up and down: каждый — за то, что делает хороший гонщик, от чистой гонки и старта точно с сигналом до поворотов на заходах и гонок на всех акваториях.'],
});

// The badges (lib/badges.ts), those you have earned lit: this device's log, and a signed-in player's account's
export default async function Badges({ params }: LangParams) {
  const { lang, t } = await getT(params);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="badges" />
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{t('Badges', 'Значки')}</span>
        <h1 className="hm-ph-h">{t('Earned on the water', 'Заработано на воде')}</h1>
        <p className="hm-text">{t('Each badge is for something a good sailor does. Your races earn them as you sail: a clean race, a start on the gun, a tack on every header.', 'Каждый значок — за то, что делает хороший гонщик. Твои гонки приносят их по ходу дела: чистая гонка, старт точно с сигналом, поворот на каждом заходе.')}</p>
      </header>
      <main className="hm-page rt"><BadgesGrid lang={lang} /></main>
      <SiteFoot lang={lang} t={t} back="/race/badges" />
    </div>
  );
}
