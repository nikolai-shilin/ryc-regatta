import { getT, titled, type LangParams } from '@/lib/i18n';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { DrillsList } from '@/components/progress';

export const generateMetadata = titled('Drills', 'Тренировки', {
  path: '/race/drills',
  description: [
    'Short sailing drills in the browser, a minute or two each: the start, rounding the windward mark in a crowd, playing the shifts up a beat, the run down to the gate and the finish. Three stars for each.',
    'Короткие парусные тренировки в браузере, по минуте-две: старт, огибание верхнего знака в группе, игра на сдвигах ветра на лавировке, фордевинд до ворот и финиш. По три звезды за каждую.'],
});

// The drills (lib/drills.ts; the game's side in public/game/extras.js): the moments a race is won in, one at a time
export default async function Drills({ params }: LangParams) {
  const { lang, t } = await getT(params);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="drills" />
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{t('Drills', 'Тренировки')}</span>
        <h1 className="hm-ph-h">{t('A minute or two, one skill', 'Минута-две, один навык')}</h1>
        <p className="hm-text">{t('A race is won at the start, at the marks, on the shifts and at the line. Each drill takes you to one of them: a computer skipper sails your boat there, then she’s yours. Three stars each; your best is kept on this device.', 'Гонку выигрывают на старте, на знаках, на сдвигах ветра и на финише. Каждая тренировка приводит тебя к одному из этих моментов: компьютер ведёт твою лодку туда, а дальше — ты. По три звезды за каждую; твой лучший результат хранится на этом устройстве.')}</p>
      </header>
      <main className="hm-page rt"><DrillsList lang={lang} /></main>
      <SiteFoot lang={lang} t={t} back="/race/drills" />
    </div>
  );
}
