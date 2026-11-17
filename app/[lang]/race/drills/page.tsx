import { getT, titled, type LangParams } from '@/lib/i18n';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { DrillsList } from '@/components/progress';

export const generateMetadata = titled('Sailing drills: starts, shifts and marks', 'Парусные тренировки: старт, сдвиги ветра, знаки', {
  path: '/race/drills', card: '/og/page/drills',
  description: [
    'Sailing drills in your browser at four levels: the start, the top mark, laylines, wind shifts, penalty turns and a heavy-air run, against computer fleets.',
    'Парусные тренировки в браузере на четырёх уровнях: старт, верхний знак, лейлайн, сдвиги ветра, штрафной оборот и фордевинд в свежак — против компьютерных флотов.'],
});

// The drills (lib/drills.ts; the game's side in public/game/extras.js): the moments a race is won in, one at a time,
// level by level
export default async function Drills({ params }: LangParams) {
  const { lang, t } = await getT(params);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="drills" />
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{t('Drills', 'Тренировки')}</span>
        <h1 className="hm-ph-h">{t('One skill at a time, level by level', 'Навык за навыком, уровень за уровнем')}</h1>
        <p className="hm-text">{t('A race is won at the start, at the marks, on the shifts and at the line. Each drill takes you to one of them: a computer skipper sails your boat there, then she’s yours. The levels are the computer skippers’: Beginner, Club, Racer, Expert, each drill sailed against a fleet of its own level. Two thirds of a level’s stars open the next. Three stars each; your best is kept on this device.', 'Гонку выигрывают на старте, на знаках, на сдвигах ветра и на финише. Каждая тренировка приводит тебя к одному из этих моментов: компьютер ведёт твою лодку туда, а дальше — ты. Уровни — как у компьютерных шкиперов: Новичок, Клуб, Гонщик, Эксперт, и каждая тренировка идёт против флота своего уровня. Две трети звёзд уровня открывают следующий. По три звезды за каждую; твой лучший результат хранится на этом устройстве.')}</p>
      </header>
      <main className="hm-page rt"><DrillsList lang={lang} /></main>
      <SiteFoot lang={lang} t={t} back="/race/drills" />
    </div>
  );
}
