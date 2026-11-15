// The yachts you can race (public/game/classes.js has the same ids and sails them): what the yachts page (/yachts)
// and the free race's set-up say about each. Today's race is sailed in a new one every day (lib/race.ts dailyYacht); a free race in any.

export type YachtId = 'club40' | 'j70' | 'rs21' | 'ac75';
export const YACHT_IDS: readonly YachtId[] = ['club40', 'j70', 'rs21', 'ac75'];
export const DEFAULT_YACHT: YachtId = 'club40';
export const isYacht = (v: unknown): v is YachtId => typeof v === 'string' && (YACHT_IDS as readonly string[]).includes(v);

type T2 = [string, string]; // English, Russian
export type Yacht = {
  id: YachtId;
  name: T2; kind: T2; tagline: T2;
  about: T2[]; // paragraphs
  race: T2; // how she sails in the game
  specs: { k: T2; v: T2 }[];
  speed: { up: number; down: number }; // knots, close-hauled and at her best downwind angle, in 12 knots of breeze (classes.js)
  // the free race: courses laid this many times longer than the club's boat's (classes.js courseK), and how long a race
  // takes her against it
  courseK: number; lineK: number; timeK: number;
};

export const YACHTS: Yacht[] = [
  {
    id: 'club40',
    name: ['Club 40', 'Клуб 40'],
    kind: ['40-foot racer-cruiser', '40-футовая крейсерско-гоночная яхта'],
    tagline: ['The club’s own boat, the one most clubs race on weekends.', 'Яхта клуба — на таких гоняются по выходным.'],
    about: [
      ['A 40-foot racer-cruiser of the kind most clubs race on weekends: a lofted hull with a chine aft, a coachroof and a wheel, a carbon rig with two sets of swept spreaders, a square-top main, a jib and an asymmetric gennaker on a bowsprit, and a code zero for light-air reaching.',
        '40-футовая крейсерско-гоночная яхта — на таких гоняется большинство клубов по выходным: корпус со скулой в корме, рубка и штурвал, карбоновая мачта с двумя ярусами краспиц, грот с квадратной головой, стаксель и асимметричный генакер на бушприте, а для слабого ветра — код зеро.'],
      ['She sails to a polar built from 193 official ORC certificates of a popular 40-foot class: seven and a half tonnes that carry their way through a tack and take a while to get going again.',
        'Её скорости — из поляры по 193 официальным мерительным сертификатам ORC популярного 40-футового класса: семь с половиной тонн, которые хорошо несут инерцию в повороте и не сразу разгоняются снова.'],
    ],
    race: ['Four crew: trim the main and jib, hoist the gennaker on the runs, change to the J3 and tie in a reef when it blows.', 'Экипаж из четырёх: настраивай грот и стаксель, ставь генакер на полных курсах, в сильный ветер меняй стаксель на J3 и бери риф.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['12.2 m', '12,2 м'] }, { k: ['Beam', 'Ширина'], v: ['3.7 m', '3,7 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['7.5 t', '7,5 т'] }, { k: ['Crew', 'Экипаж'], v: ['4', '4'] },
      { k: ['Sails', 'Паруса'], v: ['Main, jib, J3, gennaker, code zero', 'Грот, стаксель, J3, генакер, код зеро'] },
    ],
    speed: { up: 6.6, down: 8.1 }, courseK: 1, lineK: 1, timeK: 1,
  },
  {
    id: 'j70',
    name: ['J/70', 'J/70'],
    kind: ['22-foot one-design sportboat', '22-футовый монотипный спортбот'],
    tagline: ['Small, light and lively: the world’s biggest keelboat fleet.', 'Маленький, лёгкий и живой: самый массовый килевой класс в мире.'],
    about: [
      ['Designed by Rod Johnstone and launched in 2012, the J/70 became the fastest-growing keelboat class in the world, with thousands built and world championships of more than a hundred boats. Her fin keel with a lead bulb, retractable carbon bowsprit and big asymmetric spinnaker make her a planing sportboat you can still trailer behind a car.',
        'Спроектирован Родом Джонстоном и спущен в 2012 году — J/70 стал самым быстрорастущим килевым классом в мире: построены тысячи лодок, на чемпионаты мира выходят больше ста. Плавниковый киль с бульбом, выдвижной карбоновый бушприт и большой асимметричный спинакер делают его глиссирующим спортботом, который всё равно можно возить на прицепе.'],
      ['Three to five sail her, hiked out hard on the rail upwind. She weighs about 800 kg, so she jumps up to speed out of a tack and loses it just as fast, and from about 12 knots of wind she planes downwind, faster than the 40-footer.',
        'Ходят на нём втроём-впятером, на лавировке — в жёсткой откренке на борту. Лодка весит около 800 кг: из поворота разгоняется мгновенно и так же быстро теряет ход, а с 12 узлов ветра на полных курсах выходит на глиссирование — быстрее 40-футовика.'],
    ],
    race: ['Sharp and twitchy: tacks cost little but stalls cost a lot. Fly the kite early and steer the waves to keep her planing. No code zero, no reef, one jib.', 'Острый и нервный: повороты почти ничего не стоят, а потеря хода — дорого. Ставь спинакер пораньше и веди по волне, чтобы держать глиссирование. Без код зеро, без рифа, один стаксель.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['6.93 m', '6,93 м'] }, { k: ['Beam', 'Ширина'], v: ['2.25 m', '2,25 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['794 kg', '794 кг'] }, { k: ['Draft', 'Осадка'], v: ['1.45 m', '1,45 м'] },
      { k: ['Crew', 'Экипаж'], v: ['3–5', '3–5'] }, { k: ['Sails', 'Паруса'], v: ['Main, jib, asymmetric spinnaker', 'Грот, стаксель, асимметричный спинакер'] },
    ],
    speed: { up: 6.0, down: 8.7 }, courseK: 0.8, lineK: 0.8, timeK: 0.95,
  },
  {
    id: 'rs21',
    name: ['RS21', 'RS21'],
    kind: ['21-foot one-design keelboat', '21-футовая монотипная килевая яхта'],
    tagline: ['RS Sailing’s open-cockpit sportboat: simple, quick and easy to sail short-handed.', 'Спортбот RS Sailing с открытым кокпитом: простой, быстрый и лёгкий в управлении малым экипажем.'],
    about: [
      ['Designed by Jo Richards for RS Sailing, the RS21 is a modern take on the small keelboat: no cabin at all, just a long, wide cockpit from the mast to an open transom, a lifting keel with a bulb so she goes on a trailer, a carbon mast, a retractable bowsprit and a 40 m² gennaker. An electric outboard tucks away under the deck.',
        'Спроектирована Джо Ричардсом для RS Sailing: RS21 — современный взгляд на маленькую килевую яхту. Никакой каюты — только длинный широкий кокпит от мачты до открытой кормы, подъёмный киль с бульбом, чтобы возить её на прицепе, карбоновая мачта, выдвижной бушприт и генакер на 40 м². Электромотор убирается под палубу.'],
      ['She sails with two to four, the crew weight capped at 300 kg, and weighs about 650 kg. The class races in a growing international series and is a favourite for club fleets and corporate regattas, because she is forgiving to learn on and still planes readily downwind.',
        'Ходят на ней вдвоём-вчетвером, вес экипажа ограничен 300 кг, сама лодка весит около 650 кг. Класс гоняется в растущей международной серии и любим клубными флотами и корпоративными регатами: она прощает ошибки новичкам и при этом охотно глиссирует на полных курсах.'],
    ],
    race: ['Light and quick to accelerate, a touch slower than the J/70 upwind but she planes early under her big gennaker. Three aboard; no code zero, no reef, one jib.', 'Лёгкая и быстро разгоняется, на лавировке чуть медленнее J/70, но под большим генакером рано выходит на глиссирование. Экипаж из трёх; без код зеро, без рифа, один стаксель.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['6.67 m', '6,67 м'] }, { k: ['Beam', 'Ширина'], v: ['2.2 m', '2,2 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['about 650 kg', 'около 650 кг'] }, { k: ['Draft', 'Осадка'], v: ['1.38 m, lifting', '1,38 м, подъёмный киль'] },
      { k: ['Crew', 'Экипаж'], v: ['2–4', '2–4'] }, { k: ['Sails', 'Паруса'], v: ['Main 16.2 m², jib 8.4 m², gennaker 40 m²', 'Грот 16,2 м², стаксель 8,4 м², генакер 40 м²'] },
    ],
    speed: { up: 5.85, down: 8.8 }, courseK: 0.8, lineK: 0.8, timeK: 0.97,
  },
  {
    id: 'ac75',
    name: ['AC75', 'AC75'],
    kind: ['75-foot foiling America’s Cup monohull', '75-футовый монокорпус Кубка Америки на подводных крыльях'],
    tagline: ['The America’s Cup boat: flies on foils at three times the wind’s speed.', 'Яхта Кубка Америки: летит на крыльях втрое быстрее ветра.'],
    about: [
      ['Raced in the America’s Cup since 2021, the AC75 has no keel at all. Two canting arms swing T-foils down into the water; once she is going fast enough the leeward foil lifts the whole 7-tonne hull clear and she flies, sailing upwind at 30–40 knots and downwind at close to 50. The windward arm is lifted out of the water, its weight working as ballast.',
        'Гоняется в Кубке Америки с 2021 года и вообще не имеет киля. Два поворотных рычага опускают в воду Т-образные крылья; набрав скорость, подветренное крыло поднимает весь семитонный корпус из воды, и она летит — 30–40 узлов на лавировке и почти 50 на полных курсах. Наветренный рычаг поднят из воды и работает как балласт.'],
      ['Her mainsail is a double skin on a D-shaped mast that sweeps the deck, with no boom; there is no spinnaker, because at those speeds the apparent wind is always ahead. Eight sail her from pods sunk into the deck: two helms, trimmers, a flight controller keeping her at the right height, and the cyclists powering the hydraulics.',
        'Грот — двойной, на D-образной мачте, без гика, нижней шкаториной до самой палубы; спинакера нет, потому что на таких скоростях вымпельный ветер всегда дует спереди. Экипаж из восьми сидит в кокпитах, утопленных в палубу: два рулевых, триммеры, «пилот полёта», держащий нужную высоту, и велосипедисты, питающие гидравлику.'],
      ['The boat in the game is a virtual model, inspired by the design of today’s AC75-class foiling yachts.',
        'Виртуальная модель, созданная по мотивам конструкции современных фойловых яхт класса AC75.'],
    ],
    race: ['Stay on the foils: a slow tack or a bad bear-away drops her into the water, and she has to bear off to build speed and take off again. In light wind, bear away to a reach to get flying. Courses are laid two and a half times longer.', 'Держись на крыльях: медленный поворот или неудачный уваливание роняют её в воду, и придётся увалиться, разогнаться и взлететь снова. В слабый ветер увались до галфвинда, чтобы взлететь. Дистанции в два с половиной раза длиннее.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['22.86 m', '22,86 м'] }, { k: ['Beam', 'Ширина'], v: ['5 m', '5 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['about 7 t', 'около 7 т'] }, { k: ['Mast', 'Мачта'], v: ['26.5 m', '26,5 м'] },
      { k: ['Crew', 'Экипаж'], v: ['8', '8'] }, { k: ['Top speed', 'Максимальная скорость'], v: ['over 50 kn', 'больше 50 уз'] },
    ],
    speed: { up: 35, down: 40 }, courseK: 2.5, lineK: 1.8, timeK: 0.55,
  },
];
export const yachtOf = (id: unknown): Yacht => YACHTS.find((y) => y.id === id) || YACHTS[0];
