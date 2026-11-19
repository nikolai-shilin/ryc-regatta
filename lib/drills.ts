// The drills (public/game/extras.js DRILLS: what each sails, where it hands over, how it scores), as the pages list
// them, level by level in the order a race comes to them (extras.js DRILL_ORDER); their best stars are kept on this
// device (localStorage regatta-drills: { id: stars }).
// The levels are the computer skippers' (public/game/sim.js LEVELS): a drill's fleet is all of its level. A level opens
// with two thirds of the stars of the one below (extras.js levelOpen, the same; npm test keeps them in step).
type Pair = [en: string, ru: string, es?: string];
export type Level = 'beginner' | 'club' | 'racer' | 'expert';
export const LEVELS: { id: Level; name: Pair; who: Pair }[] = [
  { id: 'beginner', name: ['Beginner', 'Новичок', 'Principiante'], who: ['Against beginners: the moments a race turns on, one at a time.', 'Против новичков: моменты, от которых зависит гонка, по одному.', 'Contra principiantes: los momentos de los que depende una regata, uno a uno.'] },
  { id: 'club', name: ['Club', 'Клуб', 'Club'], who: ['Against club sailors: the tactics, from the line to the finish.', 'Против клубных яхтсменов: тактика от старта до финиша.', 'Contra regatistas de club: la táctica, de la línea a la llegada.'] },
  { id: 'racer', name: ['Racer', 'Гонщик', 'Regatista'], who: ['Against racers, in the conditions that make it hard: a stream, a zephyr, a blow, a triangle.', 'Против гонщиков, в условиях посложнее: течение, слабый ветер, свежак, треугольник.', 'Contra regatistas, en las condiciones que lo hacen difícil: una corriente, un céfiro, un vendaval, un triángulo.'] },
  { id: 'expert', name: ['Expert', 'Эксперт', 'Experto'], who: ['Against the experts: the port-tack start, a comeback, and a whole race.', 'Против экспертов: старт левым галсом, отыгрыш с последнего места и целая гонка.', 'Contra expertos: la salida por amura de babor, una remontada y una regata entera.'] },
];
export const DRILLS: { id: string; level: Level; name: Pair; what: Pair; three: Pair; min: number }[] = [
  { id: 'start', level: 'beginner', name: ['The start', 'Старт', 'La salida'], min: 1,
    what: ['The minute before the gun, with the fleet on the line. Be at the line, at full speed, as it goes.', 'Минута до сигнала, флот на линии. Будь у линии на полной скорости в момент старта.', 'El minuto antes de la señal, con la flota en la línea. Estate en la línea, a toda velocidad, cuando suene.'],
    three: ['Under 10 m from the line at the gun, over 4.5 kn, not over early.', 'Ближе 10 м к линии на сигнале, быстрее 4,5 уз, без фальстарта.', 'A menos de 10 m de la línea en la señal, a más de 4,5 kn, sin salir antes de tiempo.'] },
  { id: 'mark', level: 'beginner', name: ['The top mark', 'Верхний знак', 'La baliza de barlovento'], min: 1,
    what: ['You take over 130 m from the windward mark, boats round you. Round it and bear away to the gate.', 'Ты берёшь лодку в 130 м от верхнего знака, вокруг другие лодки. Обогни его и уходи к воротам.', 'Te quedas a más de 130 m de la baliza de barlovento, con barcos a tu alrededor. Rodéala y cae a sotavento hasta la puerta.'],
    three: ['A place gained at the mark (or the lead kept), and no penalty.', 'Выигранное у знака место (или удержанное первое) и без штрафа.', 'Un puesto ganado en la baliza (o la cabeza mantenida) y ninguna penalización.'] },
  { id: 'layline', level: 'beginner', name: ['The layline', 'Лейлайн', 'La layline'], min: 1,
    what: ['You take over below the windward mark, a tack still to make. Make it on the layline: too soon and you tack twice more, too late and you sail past it.', 'Ты берёшь лодку под верхним знаком, поворот ещё впереди. Сделай его на лейлайне: раньше — придётся поворачивать ещё дважды, позже — перебор.', 'Tomas el mando por debajo de la baliza de barlovento, con una virada aún por hacer. Hazla en la layline: demasiado pronto y viras dos veces más, demasiado tarde y te pasas de largo.'],
    three: ['At the mark in two tacks at most, under 10 m past the layline, and no penalty.', 'У знака не больше чем за два поворота, перебор меньше 10 м и без штрафа.', 'En la baliza en dos viradas como máximo, a menos de 10 m de pasarte de la layline y sin penalización.'] },
  { id: 'penalty', level: 'beginner', name: ['The penalty turn', 'Штрафной оборот', 'El giro de penalización'], min: 1,
    what: ['Thirty seconds up the beat, you owe a penalty: a tack and a gybe, turning the same way. Spin it and get back up to speed, keeping clear of the others.', 'Через 30 секунд лавировки на тебе штраф: оверштаг и поворот фордевинд в одну сторону. Сделай оборот и снова набери скорость, никому не мешая.', 'Treinta segundos de ceñida y debes una penalización: una virada y una trasluchada, girando hacia el mismo lado. Hazlo y recupera la velocidad, manteniéndote separado de los demás.'],
    three: ['Turned and back to close-hauled speed in under 20 s, without fouling anyone.', 'Оборот и снова на скорости в бейдевинд быстрее 20 с, без новых нарушений.', 'Girar y recuperar la velocidad de ceñida en menos de 20 s, sin molestar a nadie.'] },
  { id: 'end', level: 'club', name: ['The favoured end', 'Выгодный конец', 'El extremo favorecido'], min: 1,
    what: ['A line skewed hard to one end, the fleet on it. Find the end further upwind and start there, at full speed, as the gun goes.', 'Линия сильно перекошена к одному концу, на ней флот. Найди конец, который выше по ветру, и стартуй там на полной скорости в момент сигнала.', 'Una línea muy sesgada hacia un extremo, con la flota encima. Busca el extremo más a barlovento y sal desde allí, a toda velocidad, en la señal de salida.'],
    three: ['In the third of the line by that end, under 15 m from it at the gun, over 4 kn, not over early.', 'В трети линии у этого конца, ближе 15 м на сигнале, быстрее 4 уз, без фальстарта.', 'En el tercio de la línea de ese extremo, a menos de 15 m de él en la señal, a más de 4 kn y sin salir antes de tiempo.'] },
  { id: 'beat', level: 'club', name: ['The shifts', 'Сдвиги ветра', 'Las roladas'], min: 2,
    what: ['Halfway up the first beat in a shifty breeze, the fleet round you. Tack on the headers to the windward mark.', 'Половина первой лавировки в переменчивом ветре, вокруг флот. Поворачивай на заходах до верхнего знака.', 'A mitad de la primera ceñida con un viento rolón, la flota a tu alrededor. Vira en las roladas desfavorables hasta la baliza de barlovento.'],
    three: ['First or second at the windward mark, with no penalty.', 'Первым или вторым у верхнего знака и без штрафа.', 'Primero o segundo en la baliza de barlovento, sin penalización.'] },
  { id: 'run', level: 'club', name: ['The run', 'Фордевинд', 'La empopada'], min: 2,
    what: ['You take over just round the windward mark, the fleet round you. Sail the run in clear air, gybe on the shifts and pick your gate mark.', 'Ты берёшь лодку сразу за верхним знаком, вокруг флот. Пройди фордевинд в чистом ветре, делай повороты фордевинд на сдвигах и выбери знак ворот.', 'Tomas el mando justo después de la baliza de barlovento, con la flota a tu alrededor. Navega la empopada con aire limpio, traslucha en las roladas y elige tu baliza de la puerta.'],
    three: ['A place gained through the gate (or the lead kept), and no penalty.', 'Выигранное в воротах место (или удержанное первое) и без штрафа.', 'Un puesto ganado en la puerta (o la cabeza mantenida) y ninguna penalización.'] },
  { id: 'finish', level: 'club', name: ['The finish', 'Финиш', 'La llegada'], min: 1,
    what: ['The last 150 m of the race, boats round you. Find the end of the line that pays and cross ahead of them.', 'Последние 150 м гонки, вокруг лодки. Найди выгодный конец финишной линии и пересеки её впереди них.', 'Los últimos 150 m de la regata, con barcos a tu alrededor. Busca el extremo de la línea que compensa y cruza por delante de ellos.'],
    three: ['A place gained at the line (or the lead kept), and no penalty.', 'Выигранное на финише место (или удержанное первое) и без штрафа.', 'Un puesto ganado en la línea (o la cabeza mantenida) y ninguna penalización.'] },
  { id: 'tide', level: 'racer', name: ['The tide start', 'Старт в течение', 'La salida con marea'], min: 1,
    what: ['The start, with the venue’s stream running across the line. It carries you while you wait: time your run to the line with it, not against it.', 'Старт, а через линию идёт течение места гонки. Оно несёт тебя, пока ты ждёшь: рассчитай разгон к линии с его учётом.', 'La salida, con la corriente de la sede cruzando la línea. Te arrastra mientras esperas: calcula tu aproximación a la línea con ella, no contra ella.'],
    three: ['Under 10 m from the line at the gun, over 4.5 kn, not over early.', 'Ближе 10 м к линии на сигнале, быстрее 4,5 уз, без фальстарта.', 'A menos de 10 m de la línea en la señal, a más de 4,5 kn, sin salir antes de tiempo.'] },
  { id: 'light', level: 'racer', name: ['Light air', 'Слабый ветер', 'Poco viento'], min: 3,
    what: ['Halfway up the beat in 7 knots, the racers round you. Every tack costs more than it does in a breeze: tack only on the big shifts, and keep her moving.', 'Половина лавировки при 7 узлах, вокруг гонщики. Каждый поворот стоит дороже, чем в ветер: поворачивай только на больших заходах и не теряй ход.', 'A mitad de la ceñida con 7 nudos, los regatistas a tu alrededor. Cada virada cuesta más que con brisa: vira solo en las grandes roladas y mantenla en movimiento.'],
    three: ['First or second at the windward mark, with no penalty.', 'Первым или вторым у верхнего знака и без штрафа.', 'Primero o segundo en la baliza de barlovento, sin penalización.'] },
  { id: 'wing', level: 'racer', name: ['The wing mark', 'Боковой знак', 'La baliza de través'], min: 1,
    what: ['A triangle: you take over 130 m from the wing mark on the tight reach, the racers round you. Gybe round it and set off down the broad reach.', 'Треугольник: ты берёшь лодку в 130 м от знака на крутом галфвинде, вокруг гонщики. Обогни его поворотом фордевинд и уходи в бакштаг.', 'Un triángulo: tomas el mando a 130 m de la baliza de través, en el través cerrado, con los regatistas a tu alrededor. Traslucha en ella y sal por el largo.'],
    three: ['A place gained at the mark (or the lead kept), and no penalty.', 'Выигранное у знака место (или удержанное первое) и без штрафа.', 'Un puesto ganado en la baliza (o la cabeza mantenida) y ninguna penalización.'] },
  { id: 'heavy', level: 'racer', name: ['The heavy-air run', 'Фордевинд в свежак', 'La empopada con viento fuerte'], min: 2,
    what: ['The run in 19 knots, the kite up, the racers round you. Gybe at full speed, bear away in the gusts, and keep her on her feet to the gate.', 'Фордевинд при 19 узлах, генакер поднят, вокруг гонщики. Делай повороты фордевинд на полной скорости, уваливайся в порывах и не положи лодку до ворот.', 'La empopada con 19 nudos, el kite arriba y los regatistas a tu alrededor. Traslucha a toda velocidad, arriba en las rachas y mantenla en pie hasta la puerta.'],
    three: ['Through the gate without a broach or a wrapped kite, a place gained (or the lead kept), no penalty.', 'Через ворота без брочинга и замотанного генакера, выигранное место (или удержанное первое), без штрафа.', 'Por la puerta sin abroche ni kite enrollado, un puesto ganado (o la cabeza mantenida) y sin penalización.'] },
  { id: 'port', level: 'expert', name: ['The port-tack start', 'Старт левым галсом', 'La salida por babor'], min: 1,
    what: ['A line with the pin well favoured, the experts on it on starboard. Come in on port at the pin and cross them all, or duck the ones you can’t.', 'Пин сильно выгоднее, эксперты на линии правым галсом. Заходи левым у пина и пересеки их всех, а тех, кого не пересечь, обходи за кормой.', 'Una línea con el pin muy favorecido y los expertos en ella por estribor. Entra por babor en el pin y cruza por delante de todos, o pasa por popa de los que no puedas.'],
    three: ['Started on port, in the third of the line by the pin, under 15 m from it at the gun, with no foul.', 'Старт левым галсом, в трети линии у пина, ближе 15 м на сигнале и без нарушений.', 'Salir por babor, en el tercio de la línea del pin, a menos de 15 m de él en la señal y sin faltas.'] },
  { id: 'back', level: 'expert', name: ['From the back', 'С последнего места', 'Desde atrás'], min: 5,
    what: ['Two laps against the experts, and you round the first windward mark last. Find the clear air and the other side, and come through them to the finish.', 'Два круга против экспертов, и ты огибаешь первый верхний знак последним. Найди чистый ветер и другую сторону и пройди сквозь них к финишу.', 'Dos vueltas contra los expertos, y redondeas la primera baliza de barlovento en último lugar. Busca aire limpio y el otro lado, y ábrete paso hasta la llegada.'],
    three: ['Three places made up by the finish, with no penalty.', 'Три отыгранных места к финишу и без штрафа.', 'Tres puestos recuperados al llegar, sin penalización.'] },
  { id: 'race', level: 'expert', name: ['The whole race', 'Вся гонка', 'La regata completa'], min: 6,
    what: ['A whole race against a fleet of experts, from the minute before the gun to the finish. Everything at once.', 'Целая гонка против флота экспертов, от минуты до сигнала до финиша. Всё сразу.', 'Una regata completa contra una flota de expertos, desde el minuto previo a la señal hasta la llegada. Todo a la vez.'],
    three: ['Win it. Two stars: a podium.', 'Победа. Две звезды: подиум.', 'Gánala. Dos estrellas: un podio.'] },
];
export const DRILL_IDS = DRILLS.map((d) => d.id);
export const DRILLS_KEY = 'regatta-drills';
// whether a level is open, by the stars got so far
export function levelOpen(lv: Level, got: Record<string, number>): boolean {
  const i = LEVELS.findIndex((l) => l.id === lv);
  if (i <= 0) return true;
  const below = DRILLS.filter((d) => d.level === LEVELS[i - 1].id);
  return levelOpen(LEVELS[i - 1].id, got) && below.reduce((a, d) => a + (got[d.id] || 0), 0) >= Math.ceil(below.length * 2);
}
// the stars a level needs from the one below, and the level a player is at: the highest open
export const toOpen = (lv: Level) => { const i = LEVELS.findIndex((l) => l.id === lv); return i <= 0 ? 0 : Math.ceil(DRILLS.filter((d) => d.level === LEVELS[i - 1].id).length * 2); };
export const levelOf = (got: Record<string, number>): Level => LEVELS.filter((l) => levelOpen(l.id, got)).at(-1)!.id;

// The drill for a part of the race the result's debrief says to work on (components/result-view.tsx): the start, the
// tacks on the shifts, the penalty turns. Its link: the drill itself when its level is open (got: your stars, as
// regatta-drills keeps them), else the drills, where the way to its level is.
export const DEBRIEF_DRILL = { start: 'start', tacks: 'beat', penalties: 'penalty' } as const;
export function drillLink(id: string, got: Record<string, number>): { href: string; name: Pair; min: number; open: boolean } | null {
  const d = DRILLS.find((x) => x.id === id);
  if (!d) return null;
  const open = levelOpen(d.level, got);
  return { href: open ? `/play?race=free&drill=${d.id}` : '/race/drills', name: d.name, min: d.min, open };
}
export const readDrills = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(DRILLS_KEY) || '{}') || {}; } catch { return {}; } };
