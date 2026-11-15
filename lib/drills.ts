// The drills (public/game/extras.js DRILLS: what each sails, where it hands over, how it scores), as the pages list
// them; their best stars are kept on this device (localStorage regatta-drills: { id: stars }).
type Pair = [en: string, ru: string];
export const DRILLS: { id: string; name: Pair; what: Pair; three: Pair; min: number }[] = [
  { id: 'start', name: ['The start', 'Старт'], min: 1,
    what: ['The minute before the gun, with the fleet on the line. Be at the line, at full speed, as it goes.', 'Минута до сигнала, флот на линии. Будь у линии на полной скорости в момент старта.'],
    three: ['Under 10 m from the line at the gun, over 4.5 kn, not over early.', 'Ближе 10 м к линии на сигнале, быстрее 4,5 уз, без фальстарта.'] },
  { id: 'mark', name: ['The top mark', 'Верхний знак'], min: 1,
    what: ['You take over 130 m from the windward mark, boats round you. Round it and bear away to the gate.', 'Ты берёшь лодку в 130 м от верхнего знака, вокруг другие лодки. Обогни его и уходи к воротам.'],
    three: ['A place gained at the mark (or the lead kept), and no penalty.', 'Выигранное у знака место (или удержанное первое) и без штрафа.'] },
  { id: 'beat', name: ['The shifts', 'Сдвиги ветра'], min: 2,
    what: ['Halfway up the first beat in a shifty breeze, the fleet round you. Tack on the headers to the windward mark.', 'Половина первой лавировки в переменчивом ветре, вокруг флот. Поворачивай на заходах до верхнего знака.'],
    three: ['First or second at the windward mark, with no penalty.', 'Первым или вторым у верхнего знака и без штрафа.'] },
];
export const DRILL_IDS = DRILLS.map((d) => d.id);
export const DRILLS_KEY = 'regatta-drills';
