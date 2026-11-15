// The yachts you can race (public/game/classes.js has the same ids, in the same order, and sails them): what the
// yachts page (/yachts), the fleet page (/fleet) and the free race's set-up say about each. Today's race is sailed
// in a new one every day (lib/race.ts dailyYacht); a free race in any.

export type YachtId = 'jpk1050' | 'bavaria46' | 'j70' | 'rs21' | 'laser' | 'ac75';
export const YACHT_IDS: readonly YachtId[] = ['jpk1050', 'bavaria46', 'j70', 'rs21', 'laser', 'ac75'];
export const DEFAULT_YACHT: YachtId = 'jpk1050';
export const isYacht = (v: unknown): v is YachtId => typeof v === 'string' && (YACHT_IDS as readonly string[]).includes(v);

type T2 = [string, string]; // English, Russian
export type Yacht = {
  id: YachtId;
  name: T2; kind: T2; tagline: T2;
  about: T2[]; // paragraphs
  race: T2; // how she sails in the game
  specs: { k: T2; v: T2 }[];
  speed: { up: number; down: number }; // knots, close-hauled and at her best downwind angle, in 12 knots of breeze (classes.js)
  // the free race: courses laid this many times longer than the JPK 1050's (classes.js courseK), and how long a race
  // takes her against it
  courseK: number; lineK: number; timeK: number;
};

export const YACHTS: Yacht[] = [
  {
    id: 'jpk1050',
    name: ['JPK 1050', 'JPK 1050'],
    kind: ['34-foot offshore racer', '34-футовая офшорная гоночная яхта'],
    tagline: ['The boat that won the 2025 Fastnet outright, sailed two-handed.', 'Яхта, выигравшая Фастнет-2025 в абсолютном зачёте — вдвоём.'],
    about: [
      ['JPK Composites of Lorient, in Brittany, builds offshore racers for crews of two and more. The JPK 1050, drawn by Jacques Valer and Jean-Baptiste Dejeanty, was launched in 2025, and that summer Alexis Loison and Jean-Pierre Kelbert sailed her two-handed to win the centenary Rolex Fastnet Race outright.',
        'Верфь JPK Composites из Лорьяна в Бретани строит офшорные гоночные яхты для экипажей от двух человек. JPK 1050 по проекту Жака Валера и Жана-Батиста Дежанти спустили на воду в 2025 году, и тем же летом Алексис Луазон и Жан-Пьер Кельбер вдвоём выиграли на ней юбилейную гонку Rolex Fastnet в абсолютном зачёте.'],
      ['Her hull takes after the scows: full sections forward, the waterline starting nearly a metre aft of the stem, the beam carried aft to a wide transom with twin lifting rudders, and a T-keel with a lead bulb. She is steered with a tiller; the rig is a carbon mast with one set of swept spreaders and twin backstays, a square-top main, a gennaker on a fixed carbon bowsprit and a code zero.',
        'Корпус — по мотивам скоу: полные обводы в носу, где ватерлиния начинается почти в метре за форштевнем, ширина вынесена в корму к широкому транцу с двумя подъёмными рулями, Т-образный киль со свинцовым бульбом. Управляется румпелем; рангоут — карбоновая мачта с одним ярусом отогнутых назад краспиц и двумя бакштагами, грот с квадратной головой, генакер на неподвижном карбоновом бушприте и код зеро.'],
      ['She sails to the speeds of a JPK 1050’s official ORC certificate: some three and a half tonnes, quick to get going and quick to lose way, and from about 16 knots of wind she planes on the reaches and runs.',
        'Её скорости — из официального мерительного сертификата ORC одной из JPK 1050: около трёх с половиной тонн — она быстро разгоняется и быстро теряет ход, а с 16 узлов ветра на полных курсах выходит на глиссирование.'],
    ],
    race: ['Four crew: the helm on the tiller, trim the main and jib, hoist the gennaker on the runs, change to the J3 and tie in a reef when it blows. Light for her size: a tack costs her less than it would a heavier boat, a stall more.', 'Экипаж из четырёх: рулевой на румпеле, настраивай грот и стаксель, ставь генакер на полных курсах, в сильный ветер меняй стаксель на J3 и бери риф. Лёгкая для своего размера: поворот обходится ей дешевле, чем тяжёлой лодке, а потеря хода — дороже.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['10.45 m', '10,45 м'] }, { k: ['Beam', 'Ширина'], v: ['3.54 m', '3,54 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['3.5 t', '3,5 т'] }, { k: ['Draft', 'Осадка'], v: ['2.2 m', '2,2 м'] },
      { k: ['Crew', 'Экипаж'], v: ['4', '4'] }, { k: ['Sails', 'Паруса'], v: ['Main, jib, J3, gennaker, code zero', 'Грот, стаксель, J3, генакер, код зеро'] },
    ],
    speed: { up: 6.7, down: 8.6 }, courseK: 1, lineK: 1, timeK: 1,
  },
  {
    id: 'bavaria46',
    name: ['Bavaria 46', 'Bavaria 46'],
    kind: ['46-foot cruising yacht', '46-футовая крейсерская яхта'],
    tagline: ['The charter fleets’ boat: race the yacht you take on holiday.', 'Яхта чартерных флотов: гоняйся на той, что берёшь в отпуск.'],
    about: [
      ['Bavaria Yachtbau of Giebelstadt, in Germany, builds more cruising yachts than almost anyone, and its 46-footer is one of the boats you are most likely to charter in the Mediterranean: high topsides with long hull windows, three or four double cabins under a long low coachroof, a cockpit with a table between two wheels and a bathing platform that folds down out of the transom. The rig is a deck-stepped aluminium mast with swept spreaders, a main that drops into a lazy bag on the boom and a furling genoa.',
        'Верфь Bavaria Yachtbau из Гибельштадта в Германии строит больше крейсерских яхт, чем почти кто-либо, а её 46-футовик — одна из лодок, которые чаще всего берут в чартер на Средиземном море: высокий борт с длинными корпусными окнами, три-четыре двухместные каюты под длинной низкой рубкой, кокпит со столом между двумя штурвалами и купальная платформа, откидывающаяся из транца. Рангоут — алюминиевая мачта на палубе с отогнутыми назад краспицами, грот, который падает в лэйзи-бэг на гике, и закручивающаяся генуя.'],
      ['Some eleven tonnes, she carries her way through a tack and takes her time to get going again. No racer, but quick for a cruiser on a reach, and charter crews race them across the Mediterranean in flotilla and corporate regattas, the whole fleet in the same boat.',
        'Около одиннадцати тонн: она хорошо несёт инерцию в повороте и не спеша разгоняется снова. Не гоночная яхта, но для крейсера быстрая на полных курсах, и чартерные экипажи гоняются на них по всему Средиземноморью в флотилиях и корпоративных регатах — весь флот на одинаковых лодках.'],
    ],
    race: ['Five crew: trim the main and the genoa, hoist the cruising gennaker on the runs and tie in a reef when it blows. Heavy and steady, slow to speed up and slow to stop; the line and the marks are laid a little wider for her. No code zero, no change of jib.', 'Экипаж из пяти: настраивай грот и геную, ставь круизный генакер на полных курсах и бери риф в сильный ветер. Тяжёлая и устойчивая, медленно разгоняется и медленно останавливается; линия старта и знаки для неё чуть шире. Без код зеро и без смены стакселя.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['14.27 m', '14,27 м'] }, { k: ['Beam', 'Ширина'], v: ['4.35 m', '4,35 м'] },
      { k: ['Displacement', 'Водоизмещение'], v: ['about 11 t', 'около 11 т'] }, { k: ['Draft', 'Осадка'], v: ['2.1 m', '2,1 м'] },
      { k: ['Crew', 'Экипаж'], v: ['5', '5'] }, { k: ['Sails', 'Паруса'], v: ['Main, furling genoa, cruising gennaker', 'Грот, закручивающаяся генуя, круизный генакер'] },
    ],
    speed: { up: 6.2, down: 7.6 }, courseK: 1, lineK: 1.3, timeK: 1.1,
  },
  {
    id: 'j70',
    name: ['J/70', 'J/70'],
    kind: ['22-foot one-design sportboat', '22-футовый монотипный спортбот'],
    tagline: ['Small, light and lively: the world’s biggest keelboat fleet.', 'Маленький, лёгкий и живой: самый массовый килевой класс в мире.'],
    about: [
      ['Designed by Rod Johnstone and launched in 2012, the J/70 became the fastest-growing keelboat class in the world, with thousands built and world championships of more than a hundred boats. Her fin keel with a lead bulb, retractable carbon bowsprit and big asymmetric spinnaker make her a planing sportboat you can still trailer behind a car.',
        'Спроектирован Родом Джонстоном и спущен в 2012 году — J/70 стал самым быстрорастущим килевым классом в мире: построены тысячи лодок, на чемпионаты мира выходят больше ста. Плавниковый киль с бульбом, выдвижной карбоновый бушприт и большой асимметричный спинакер делают его глиссирующим спортботом, который всё равно можно возить на прицепе.'],
      ['Three to five sail her, hiked out hard on the rail upwind. She weighs about 800 kg, so she jumps up to speed out of a tack and loses it just as fast, and from about 12 knots of wind she planes downwind, faster than the JPK 1050.',
        'Ходят на нём втроём-впятером, на лавировке — в жёсткой откренке на борту. Лодка весит около 800 кг: из поворота разгоняется мгновенно и так же быстро теряет ход, а с 12 узлов ветра на полных курсах выходит на глиссирование — быстрее JPK 1050.'],
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
    id: 'laser',
    name: ['Laser (ILCA)', 'Laser (ILCA)'],
    kind: ['14-foot single-handed Olympic dinghy', '14-футовый одноместный олимпийский швертбот'],
    tagline: ['One sailor, one sail: the most raced dinghy there is.', 'Один гонщик, один парус: самый массовый гоночный швертбот.'],
    about: [
      ['Designed by Bruce Kirby and Ian Bruce and launched in 1970, the Laser was made to be simple: a 59 kg hull, a daggerboard, a kick-up rudder and one sail sleeved over an unstayed two-part mast, with nothing to adjust but the sheet, the kicker, the outhaul and the downhaul. More than 200,000 have been built, and she has been an Olympic class since 1996. Since a dispute over the name, the class and its boats are called ILCA, and the full rig is the ILCA 7.',
        'Спроектирован Брюсом Кирби и Яном Брюсом и спущен в 1970 году. Laser задуман простым: корпус 59 кг, выдвижной шверт, откидной руль и один парус, надетый карманом на мачту из двух колен без вант; настраиваются только шкот, оттяжка гика, аутхол и каннингхэм. Построено больше 200 000 лодок, с 1996 года это олимпийский класс. После спора об имени класс и лодки называются ILCA, а полное вооружение — ILCA 7.'],
      ['One sails her, hiked out flat over the side with the feet under the strap. Light as she is, she stops in a tack and goes again at once; from about 12 knots of wind she planes on a reach and surfs down the waves, and a fleet of them racing is the closest racing there is.',
        'Ходят на ней в одиночку, откренившись над водой и зацепившись ногами за ремень. Лодка лёгкая: в повороте почти останавливается и тут же снова идёт, а с 12 узлов ветра на галфвинде выходит на глиссирование и серфит на волне. Флот лазеров — самые плотные гонки, какие бывают.'],
    ],
    race: ['Alone: one sail and one sheet, no kite, no jib, no reef. Quick through a tack and quick to lose way; hike hard upwind and steer the waves on the reaches. Courses are laid 0.6 times as long.', 'В одиночку: один парус и один шкот, без спинакера, без стакселя, без рифа. Быстро проходит поворот и быстро теряет ход; на лавировке откренивайся, а на галфвинде веди по волне. Дистанции в 0,6 раза короче.'],
    specs: [
      { k: ['Length', 'Длина'], v: ['4.19 m', '4,19 м'] }, { k: ['Beam', 'Ширина'], v: ['1.39 m', '1,39 м'] },
      { k: ['Hull weight', 'Вес корпуса'], v: ['59 kg', '59 кг'] }, { k: ['Mast', 'Мачта'], v: ['6.43 m', '6,43 м'] },
      { k: ['Crew', 'Экипаж'], v: ['1', '1'] }, { k: ['Sail', 'Парус'], v: ['7.06 m² (ILCA 7)', '7,06 м² (ILCA 7)'] },
    ],
    speed: { up: 4.7, down: 7.2 }, courseK: 0.6, lineK: 0.6, timeK: 0.9,
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
