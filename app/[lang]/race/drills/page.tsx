import { getT, titled, type LangParams } from '@/lib/i18n';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { DrillsList } from '@/components/progress';

export const generateMetadata = titled('Sailing drills: starts, shifts and marks', 'Парусные тренировки: старт, сдвиги ветра, знаки', 'Ejercicios de vela: salidas, roladas y balizas', 'Segelübungen: Starts, Dreher und Bahnmarken', {
  path: '/race/drills', card: '/og/page/drills',
  description: [
    'Sailing drills in your browser at four levels: the start, the top mark, laylines, wind shifts, penalty turns and a heavy-air run, against computer fleets.',
    'Парусные тренировки в браузере на четырёх уровнях: старт, верхний знак, лейлайн, сдвиги ветра, штрафной оборот и фордевинд в свежак — против компьютерных флотов.', 'Ejercicios de vela en tu navegador en cuatro niveles: la salida, la baliza de barlovento, laylines, roladas, giros de penalización y una empopada con viento fuerte, contra flotas del ordenador.', 'Segelübungen in deinem Browser auf vier Stufen: der Start, die Luvtonne, Laylines, Winddreher, Strafkringel und ein Vorwindkurs bei viel Wind, gegen Computerfelder.'],
});

// The drills (lib/drills.ts; the game's side in public/game/extras.js): the moments a race is won in, one at a time,
// level by level
export default async function Drills({ params }: LangParams) {
  const { lang, t } = await getT(params);
  return (
    <div className="scr help hp bc rt-scr" lang={lang}>
      <SiteHead lang={lang} t={t} page="drills" />
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{t('Drills', 'Тренировки', 'Ejercicios', 'Übungen')}</span>
        <h1 className="hm-ph-h">{t('One skill at a time, level by level', 'Навык за навыком, уровень за уровнем', 'Una habilidad cada vez, nivel a nivel', 'Eine Fähigkeit nach der anderen, Stufe für Stufe')}</h1>
        <p className="hm-text">{t('A race is won at the start, at the marks, on the shifts and at the line. Each drill takes you to one of them: a computer skipper sails your boat there, then she’s yours. The levels are the computer skippers’: Beginner, Club, Racer, Expert, each drill sailed against a fleet of its own level. Two thirds of a level’s stars open the next. Three stars each; your best is kept on this device.', 'Гонку выигрывают на старте, на знаках, на сдвигах ветра и на финише. Каждая тренировка приводит тебя к одному из этих моментов: компьютер ведёт твою лодку туда, а дальше — ты. Уровни — как у компьютерных шкиперов: Новичок, Клуб, Гонщик, Эксперт, и каждая тренировка идёт против флота своего уровня. Две трети звёзд уровня открывают следующий. По три звезды за каждую; твой лучший результат хранится на этом устройстве.', 'Una regata se gana en la salida, en las balizas, en las roladas y en la línea. Cada ejercicio te lleva a uno de ellos: un patrón del ordenador navega tu barco hasta allí, y luego es tuyo. Los niveles son los de los patrones del ordenador: Principiante, Club, Regatista, Experto, cada ejercicio navegado contra una flota de su propio nivel. Dos tercios de las estrellas de un nivel abren el siguiente. Tres estrellas cada uno; tu mejor marca se guarda en este dispositivo.', 'Eine Regatta wird am Start, an den Bahnmarken, auf den Drehern und an der Linie gewonnen. Jede Übung bringt dich zu einem davon: Ein Computerskipper segelt dein Boot dorthin, dann gehört sie dir. Die Stufen sind die der Computerskipper: Anfänger, Club, Racer, Experte, jede Übung gegen ein Feld ihrer eigenen Stufe. Zwei Drittel der Sterne einer Stufe öffnen die nächste. Je drei Sterne; deine Bestzeit bleibt auf diesem Gerät.')}</p>
      </header>
      <main className="hm-page rt"><DrillsList lang={lang} /></main>
      <SiteFoot lang={lang} t={t} back="/race/drills" />
    </div>
  );
}
