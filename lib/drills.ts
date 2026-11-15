// The drills (public/game/extras.js DRILLS: what each sails, where it hands over, how it scores), as the pages list
// them, in the order a race comes to them (extras.js DRILL_ORDER); their best stars are kept on this device (localStorage regatta-drills: { id: stars }).
type Pair = [en: string, ru: string];
export const DRILLS: { id: string; name: Pair; what: Pair; three: Pair; min: number }[] = [
  { id: 'start', name: ['The start', 'Старт'], min: 1,
    what: ['The minute before the gun, with the fleet on the line. Be at the line, at full speed, as it goes.', 'Минута до сигнала, флот на линии. Будь у линии на полной скорости в момент старта.'],
    three: ['Under 10 m from the line at the gun, over 4.5 kn, not over early.', 'Ближе 10 м к линии на сигнале, быстрее 4,5 уз, без фальстарта.'] },
  { id: 'end', name: ['The favoured end', 'Выгодный конец'], min: 1,
    what: ['A line skewed hard to one end, the fleet on it. Find the end further upwind and start there, at full speed, as the gun goes.', 'Линия сильно перекошена к одному концу, на ней флот. Найди конец, который выше по ветру, и стартуй там на полной скорости в момент сигнала.'],
    three: ['In the third of the line by that end, under 15 m from it at the gun, over 4 kn, not over early.', 'В трети линии у этого конца, ближе 15 м на сигнале, быстрее 4 уз, без фальстарта.'] },
  { id: 'beat', name: ['The shifts', 'Сдвиги ветра'], min: 2,
    what: ['Halfway up the first beat in a shifty breeze, the fleet round you. Tack on the headers to the windward mark.', 'Половина первой лавировки в переменчивом ветре, вокруг флот. Поворачивай на заходах до верхнего знака.'],
    three: ['First or second at the windward mark, with no penalty.', 'Первым или вторым у верхнего знака и без штрафа.'] },
  { id: 'layline', name: ['The layline', 'Лейлайн'], min: 1,
    what: ['You take over below the windward mark, a tack still to make. Make it on the layline: too soon and you tack twice more, too late and you sail past it.', 'Ты берёшь лодку под верхним знаком, поворот ещё впереди. Сделай его на лейлайне: раньше — придётся поворачивать ещё дважды, позже — перебор.'],
    three: ['At the mark in two tacks at most, under 10 m past the layline, and no penalty.', 'У знака не больше чем за два поворота, перебор меньше 10 м и без штрафа.'] },
  { id: 'mark', name: ['The top mark', 'Верхний знак'], min: 1,
    what: ['You take over 130 m from the windward mark, boats round you. Round it and bear away to the gate.', 'Ты берёшь лодку в 130 м от верхнего знака, вокруг другие лодки. Обогни его и уходи к воротам.'],
    three: ['A place gained at the mark (or the lead kept), and no penalty.', 'Выигранное у знака место (или удержанное первое) и без штрафа.'] },
  { id: 'run', name: ['The run', 'Фордевинд'], min: 2,
    what: ['You take over just round the windward mark, the fleet round you. Sail the run in clear air, gybe on the shifts and pick your gate mark.', 'Ты берёшь лодку сразу за верхним знаком, вокруг флот. Пройди фордевинд в чистом ветре, делай повороты фордевинд на сдвигах и выбери знак ворот.'],
    three: ['A place gained through the gate (or the lead kept), and no penalty.', 'Выигранное в воротах место (или удержанное первое) и без штрафа.'] },
  { id: 'finish', name: ['The finish', 'Финиш'], min: 1,
    what: ['The last 150 m of the race, boats round you. Find the end of the line that pays and cross ahead of them.', 'Последние 150 м гонки, вокруг лодки. Найди выгодный конец финишной линии и пересеки её впереди них.'],
    three: ['A place gained at the line (or the lead kept), and no penalty.', 'Выигранное на финише место (или удержанное первое) и без штрафа.'] },
  { id: 'penalty', name: ['The penalty turn', 'Штрафной оборот'], min: 1,
    what: ['Thirty seconds up the beat, you owe a penalty: a tack and a gybe, turning the same way. Spin it and get back up to speed, keeping clear of the others.', 'Через 30 секунд лавировки на тебе штраф: оверштаг и поворот фордевинд в одну сторону. Сделай оборот и снова набери скорость, никому не мешая.'],
    three: ['Turned and back to close-hauled speed in under 20 s, without fouling anyone.', 'Оборот и снова на скорости в бейдевинд быстрее 20 с, без новых нарушений.'] },
];
export const DRILL_IDS = DRILLS.map((d) => d.id);
export const DRILLS_KEY = 'regatta-drills';
