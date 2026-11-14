// Where a race can be sailed: the set-up page's list, and today's race goes to one of them each day (lib/race.ts). The game's own list, with each venue's position, wind and
// look, is public/game/venues.js; the ids and names here must match it, and so must the skip lists (npm test checks).
// skip: the course shapes not offered at the venue at some length, as '<shape>:<length>' (never a short course).
export type VenueId = 'gocek' | 'cowes' | 'newport' | 'sydney' | 'kiel' | 'trieste' | 'porto-cervo' | 'saint-tropez' | 'antigua' | 'auckland'
  | 'san-francisco' | 'valencia' | 'barcelona' | 'palma' | 'marstrand' | 'bermuda' | 'enoshima' | 'weymouth' | 'marseille' | 'rio' | 'garda';
type Pair = [string, string]; // English, Russian

export const VENUES: { id: VenueId; name: Pair; place: Pair; wind: Pair; skip?: string[]; about: Pair }[] = [
  { id: 'gocek', name: ['Göcek', 'Гёчек'], place: ['Turkey', 'Турция'], wind: ['N', 'С'],
    about: ['Pine-clad hills and the gulets of Skopea Marina, where the game began.', 'Сосновые холмы и гулеты марины Скопеа, где игра началась.'] },
  { id: 'cowes', name: ['Cowes', 'Каус'], place: ['Isle of Wight, UK', 'Остров Уайт, Великобритания'], wind: ['SW', 'ЮЗ'],
    about: ['The Solent, home of Cowes Week since 1826, in the south-westerly.', 'Пролив Солент, где с 1826 года проходит Неделя Каус, под юго-западным ветром.'] },
  { id: 'newport', name: ['Newport', 'Ньюпорт'], place: ['Rhode Island, USA', 'Род-Айленд, США'], wind: ['SW', 'ЮЗ'],
    about: ['The America’s Cup’s home for 53 years, off Castle Hill, with the Newport Bridge behind.', '53 года дом Кубка «Америка». У мыса Касл-Хилл, за кормой — Ньюпортский мост.'] },
  { id: 'sydney', name: ['Sydney', 'Сидней'], place: ['Australia', 'Австралия'], wind: ['NE', 'СВ'],
    about: ['The harbour of the Boxing Day start, in the nor’easter, with the Harbour Bridge up the harbour.', 'Гавань старта 26 декабря, под северо-восточным бризом, вдали — мост Харбор-Бридж.'] },
  { id: 'kiel', name: ['Kiel', 'Киль'], place: ['Germany', 'Германия'], wind: ['W', 'З'],
    about: ['Kieler Woche’s Olympic waters off Schilksee and Laboe, in the westerly.', 'Олимпийская акватория Кильской недели у Шильксе и Лабё, под западным ветром.'] },
  { id: 'trieste', name: ['Trieste', 'Триест'], place: ['Italy', 'Италия'], wind: ['ENE', 'ВСВ'],
    about: ['The gulf of the Barcolana under the karst cliffs, with the bora off the land.', 'Залив Барколаны под карстовыми скалами, с борой, дующей с берега.'] },
  { id: 'porto-cervo', name: ['Porto Cervo', 'Порто-Черво'], place: ['Sardinia, Italy', 'Сардиния, Италия'], wind: ['NW', 'СЗ'],
    about: ['Costa Smeralda’s granite and emerald water, where the maxis race in the mistral.', 'Гранит и изумрудная вода Коста-Смеральды, где под мистралем гоняются макси.'] },
  { id: 'saint-tropez', name: ['Saint-Tropez', 'Сен-Тропе'], place: ['France', 'Франция'], wind: ['W', 'З'],
    about: ['The gulf of Les Voiles, between the old port and Sainte-Maxime, in the westerly.', 'Залив регаты Les Voiles между старым портом и Сент-Максимом, под западным ветром.'] },
  { id: 'antigua', name: ['Antigua', 'Антигуа'], place: ['Caribbean', 'Карибы'], wind: ['E', 'В'],
    about: ['Off English Harbour and Falmouth, in the steady easterly trade wind.', 'У Инглиш-Харбор и Фалмута, под ровным восточным пассатом.'] },
  { id: 'auckland', name: ['Auckland', 'Окленд'], place: ['New Zealand', 'Новая Зеландия'], wind: ['SW', 'ЮЗ'],
    about: ['The City of Sails: the Waitematā off Rangitoto, with the Sky Tower over the city.', 'Город парусов: гавань Уаитемата у вулкана Рангитото, над городом — башня Скай-Тауэр.'] },
  { id: 'san-francisco', name: ['San Francisco', 'Сан-Франциско'], place: ['California, USA', 'Калифорния, США'], wind: ['W', 'З'],
    about: ['The bay of the 2013 America’s Cup, off the city front and Alcatraz, the Golden Gate to windward.', 'Залив Кубка «Америка» 2013 года, у набережной и Алькатраса, на ветре — мост Золотые Ворота.'] },
  { id: 'valencia', name: ['Valencia', 'Валенсия'], place: ['Spain', 'Испания'], wind: ['ESE', 'ВЮВ'],
    about: ['Off the port of the 2007 America’s Cup, in the afternoon sea breeze.', 'У порта Кубка «Америка» 2007 года, под дневным морским бризом.'] },
  { id: 'barcelona', name: ['Barcelona', 'Барселона'], place: ['Spain', 'Испания'], wind: ['SSW', 'ЮЮЗ'],
    about: ['The 2024 America’s Cup off the beaches, Montjuïc and the Sagrada Família behind.', 'Кубок «Америка» 2024 года у пляжей, за ними — Монжуик и Саграда Фамилия.'] },
  { id: 'palma', name: ['Palma', 'Пальма'], place: ['Mallorca, Spain', 'Майорка, Испания'], wind: ['SW', 'ЮЗ'],
    about: ['The bay of the Copa del Rey under the cathedral, in the afternoon embat.', 'Бухта Кубка короля под кафедральным собором, под дневным ветром эмбат.'] },
  { id: 'marstrand', name: ['Marstrand', 'Марстранд'], place: ['Sweden', 'Швеция'], wind: ['SW', 'ЮЗ'],
    about: ['Match racing’s granite archipelago, under Carlsten fortress, in the south-westerly.', 'Гранитные шхеры матч-рейсов под крепостью Карлстен, под юго-западным ветром.'] },
  { id: 'bermuda', name: ['Bermuda', 'Бермуды'], place: ['Atlantic', 'Атлантика'], wind: ['SSW', 'ЮЮЗ'],
    about: ['The Great Sound of the 2017 America’s Cup: turquoise water, white roofs.', 'Большой залив Кубка «Америка» 2017 года: бирюзовая вода, белые крыши.'] },
  { id: 'enoshima', name: ['Enoshima', 'Эносима'], place: ['Japan', 'Япония'], wind: ['S', 'Ю'],
    about: ['Olympic waters of 1964 and 2020 in Sagami Bay, off the island and its Sea Candle.', 'Олимпийская акватория 1964 и 2020 годов в заливе Сагами, у острова и его маяка.'] },
  { id: 'weymouth', name: ['Weymouth', 'Уэймут'], place: ['Dorset, UK', 'Дорсет, Великобритания'], wind: ['SW', 'ЮЗ'],
    about: ['The 2012 Olympic bay, between the Georgian seafront and the Isle of Portland.', 'Олимпийская бухта 2012 года между набережной Уэймута и островом Портленд.'] },
  { id: 'marseille', name: ['Marseille', 'Марсель'], place: ['France', 'Франция'], wind: ['NW', 'СЗ'],
    about: ['The Paris 2024 Olympic waters, under Notre-Dame de la Garde, in the mistral.', 'Олимпийская акватория 2024 года под собором Нотр-Дам-де-ла-Гард, под мистралем.'] },
  { id: 'rio', name: ['Rio de Janeiro', 'Рио-де-Жанейро'], place: ['Brazil', 'Бразилия'], wind: ['SE', 'ЮВ'],
    about: ['Guanabara Bay of the 2016 Olympics, under Sugarloaf and Christ the Redeemer.', 'Залив Гуанабара Олимпиады 2016 года, под Сахарной Головой и статуей Христа.'] },
  { id: 'garda', name: ['Lake Garda', 'Озеро Гарда'], place: ['Italy', 'Италия'], wind: ['S', 'Ю'],
    about: ['Fresh water under the Alps, off Riva and Torbole, in the afternoon Ora.', 'Пресная вода у подножия Альп, у Ривы и Торболе, под дневным ветром Ора.'] },
];

export const venueOf = (id: string | undefined) => VENUES.find((v) => v.id === id) || VENUES[0];
// whether the set-up offers a course shape at the venue at that length, as public/game/venues.js shapeOffered
export const shapeOffered = (id: string | undefined, shape: string, length: string) => !(venueOf(id).skip || []).includes(`${shape}:${length}`);
