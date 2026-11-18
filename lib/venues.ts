// Where a race can be sailed: the set-up page's list, and today's race goes to one of them each day (lib/race.ts). The game's own list, with each venue's position, wind and
// look, is public/game/venues.js; the ids and names here must match it, and so must the skip lists (npm test checks).
// skip: the course shapes not offered at the venue at some length, as '<shape>:<length>', and a length not offered at
// all (never a short course).
// nation: the country's letters as a boat from there carries them on her sail (lib/flags.ts ioc), shown after the
// venue's name on the race pages.
// from: the day a venue added later joins today's races (lib/race.ts dailyVenue), as in the game's list.
// runs: a river or a strait, whose water runs in every race whether the current is on or off, as in the game's list.
export type VenueId = 'gocek' | 'cowes' | 'newport' | 'sydney' | 'kiel' | 'trieste' | 'porto-cervo' | 'saint-tropez' | 'antigua' | 'auckland'
  | 'san-francisco' | 'valencia' | 'barcelona' | 'palma' | 'marstrand' | 'bermuda' | 'enoshima' | 'weymouth' | 'marseille' | 'rio' | 'garda' | 'istanbul'
  | 'st-petersburg' | 'batumi' | 'scheveningen' | 'hong-kong' | 'cape-town' | 'athens' | 'marmaris' | 'fethiye'
  | 'sochi' | 'melbourne' | 'gold-coast' | 'new-york'
  | 'naples' | 'los-angeles' | 'les-sables' | 'dubai' | 'miami' | 'split' | 'monaco' | 'fremantle' | 'sint-maarten' | 'phuket' | 'tbilisi-sea';
type Pair = [string, string]; // English, Russian

export const VENUES: { id: VenueId; nation: string; name: Pair; place: Pair; wind: Pair; skip?: string[]; from?: string; runs?: boolean; about: Pair }[] = [
  { id: 'gocek', nation: 'TUR', name: ['Göcek', 'Гёчек'], place: ['Turkey', 'Турция'], wind: ['SSW', 'ЮЮЗ'],
    about: ['Pine-clad hills and the gulets of Skopea Marina, where the game began.', 'Сосновые холмы и гулеты марины Скопеа, где игра началась.'] },
  { id: 'cowes', nation: 'GBR', name: ['Cowes', 'Каус'], place: ['Isle of Wight, UK', 'Остров Уайт, Великобритания'], wind: ['SW', 'ЮЗ'],
    about: ['The Solent, home of Cowes Week since 1826, in the south-westerly.', 'Пролив Солент, где с 1826 года проходит Неделя Каус, под юго-западным ветром.'] },
  { id: 'newport', nation: 'USA', name: ['Newport', 'Ньюпорт'], place: ['Rhode Island, USA', 'Род-Айленд, США'], wind: ['SSW', 'ЮЮЗ'],
    about: ['The America’s Cup’s home for 53 years, off Castle Hill, with the Newport Bridge behind.', '53 года дом Кубка «Америка». У мыса Касл-Хилл, за кормой — Ньюпортский мост.'] },
  { id: 'sydney', nation: 'AUS', name: ['Sydney', 'Сидней'], place: ['Australia', 'Австралия'], wind: ['NE', 'СВ'],
    about: ['The harbour of the Boxing Day start, in the nor’easter, with the Harbour Bridge up the harbour.', 'Гавань старта 26 декабря, под северо-восточным бризом, вдали — мост Харбор-Бридж.'] },
  { id: 'kiel', nation: 'GER', name: ['Kiel', 'Киль'], place: ['Germany', 'Германия'], wind: ['WSW', 'ЗЮЗ'],
    about: ['Kieler Woche’s Olympic waters off Schilksee and Laboe, in the westerly.', 'Олимпийская акватория Кильской недели у Шильксе и Лабё, под западным ветром.'] },
  { id: 'trieste', nation: 'ITA', name: ['Trieste', 'Триест'], place: ['Italy', 'Италия'], wind: ['ENE', 'ВСВ'],
    about: ['The gulf of the Barcolana under the karst cliffs, with the bora off the land.', 'Залив Барколаны под карстовыми скалами, с борой, дующей с берега.'] },
  { id: 'porto-cervo', nation: 'ITA', name: ['Porto Cervo', 'Порто-Черво'], place: ['Sardinia, Italy', 'Сардиния, Италия'], wind: ['NW', 'СЗ'],
    about: ['Costa Smeralda’s granite and emerald water, where the maxis race in the mistral.', 'Гранит и изумрудная вода Коста-Смеральды, где под мистралем гоняются макси.'] },
  { id: 'saint-tropez', nation: 'FRA', name: ['Saint-Tropez', 'Сен-Тропе'], place: ['France', 'Франция'], wind: ['W', 'З'],
    about: ['The gulf of Les Voiles, between the old port and Sainte-Maxime, in the westerly.', 'Залив регаты Les Voiles между старым портом и Сент-Максимом, под западным ветром.'] },
  { id: 'antigua', nation: 'ANT', name: ['Antigua', 'Антигуа'], place: ['Caribbean', 'Карибы'], wind: ['E', 'В'],
    about: ['Off English Harbour and Falmouth, in the steady easterly trade wind.', 'У Инглиш-Харбор и Фалмута, под ровным восточным пассатом.'] },
  { id: 'auckland', nation: 'NZL', name: ['Auckland', 'Окленд'], place: ['New Zealand', 'Новая Зеландия'], wind: ['SW', 'ЮЗ'],
    about: ['The City of Sails: the Waitematā off Rangitoto, with the Sky Tower over the city.', 'Город парусов: гавань Уаитемата у вулкана Рангитото, над городом — башня Скай-Тауэр.'] },
  { id: 'san-francisco', nation: 'USA', name: ['San Francisco', 'Сан-Франциско'], place: ['California, USA', 'Калифорния, США'], wind: ['WSW', 'ЗЮЗ'],
    about: ['The bay of the 2013 America’s Cup, off the city front and Alcatraz, the Golden Gate to windward.', 'Залив Кубка «Америка» 2013 года, у набережной и Алькатраса, на ветре — мост Золотые Ворота.'] },
  { id: 'valencia', nation: 'ESP', name: ['Valencia', 'Валенсия'], place: ['Spain', 'Испания'], wind: ['ESE', 'ВЮВ'],
    about: ['Off the port of the 2007 America’s Cup, in the afternoon sea breeze.', 'У порта Кубка «Америка» 2007 года, под дневным морским бризом.'] },
  { id: 'barcelona', nation: 'ESP', name: ['Barcelona', 'Барселона'], place: ['Spain', 'Испания'], wind: ['SSW', 'ЮЮЗ'],
    about: ['The 2024 America’s Cup off the beaches, Montjuïc and the Sagrada Família behind.', 'Кубок «Америка» 2024 года у пляжей, за ними — Монжуик и Саграда Фамилия.'] },
  { id: 'palma', nation: 'ESP', name: ['Palma', 'Пальма'], place: ['Mallorca, Spain', 'Майорка, Испания'], wind: ['SW', 'ЮЗ'],
    about: ['The bay of the Copa del Rey under the cathedral, in the afternoon embat.', 'Бухта Кубка короля под кафедральным собором, под дневным ветром эмбат.'] },
  { id: 'marstrand', nation: 'SWE', name: ['Marstrand', 'Марстранд'], place: ['Sweden', 'Швеция'], wind: ['SW', 'ЮЗ'],
    about: ['Match racing’s granite archipelago, under Carlsten fortress, in the south-westerly.', 'Гранитные шхеры матч-рейсов под крепостью Карлстен, под юго-западным ветром.'] },
  { id: 'bermuda', nation: 'BER', name: ['Bermuda', 'Бермуды'], place: ['Atlantic', 'Атлантика'], wind: ['SSW', 'ЮЮЗ'],
    about: ['The Great Sound of the 2017 America’s Cup: turquoise water, white roofs.', 'Большой залив Кубка «Америка» 2017 года: бирюзовая вода, белые крыши.'] },
  { id: 'enoshima', nation: 'JPN', name: ['Enoshima', 'Эносима'], place: ['Japan', 'Япония'], wind: ['S', 'Ю'],
    about: ['Olympic waters of 1964 and 2020 in Sagami Bay, off the island and its Sea Candle.', 'Олимпийская акватория 1964 и 2020 годов в заливе Сагами, у острова и его маяка.'] },
  { id: 'weymouth', nation: 'GBR', name: ['Weymouth', 'Уэймут'], place: ['Dorset, UK', 'Дорсет, Великобритания'], wind: ['SW', 'ЮЗ'],
    about: ['The 2012 Olympic bay, between the Georgian seafront and the Isle of Portland.', 'Олимпийская бухта 2012 года между набережной Уэймута и островом Портленд.'] },
  { id: 'marseille', nation: 'FRA', name: ['Marseille', 'Марсель'], place: ['France', 'Франция'], wind: ['NW', 'СЗ'],
    about: ['The Paris 2024 Olympic waters, under Notre-Dame de la Garde, in the mistral.', 'Олимпийская акватория 2024 года под собором Нотр-Дам-де-ла-Гард, под мистралем.'] },
  { id: 'rio', nation: 'BRA', name: ['Rio de Janeiro', 'Рио-де-Жанейро'], place: ['Brazil', 'Бразилия'], wind: ['SSE', 'ЮЮВ'],
    about: ['Guanabara Bay of the 2016 Olympics, under Sugarloaf and Christ the Redeemer.', 'Залив Гуанабара Олимпиады 2016 года, под Сахарной Головой и статуей Христа.'] },
  { id: 'garda', nation: 'ITA', name: ['Lake Garda', 'Озеро Гарда'], place: ['Italy', 'Италия'], wind: ['S', 'Ю'],
    about: ['Fresh water under the Alps, off Riva and Torbole, in the afternoon Ora.', 'Пресная вода у подножия Альп, у Ривы и Торболе, под дневным ветром Ора.'] },
  { id: 'istanbul', nation: 'TUR', name: ['Istanbul', 'Стамбул'], place: ['Turkey', 'Турция'], wind: ['NE', 'СВ'], runs: true,
    about: ['Off Moda at the mouth of the Bosphorus, in the poyraz, the old city’s domes and minarets ashore.', 'У Моды, у входа в Босфор, под северо-восточным пойразом; на берегу — купола и минареты старого города.'] },
  { id: 'st-petersburg', nation: 'RUS', name: ['St Petersburg', 'Санкт-Петербург'], place: ['Russia', 'Россия'], wind: ['WSW', 'ЗЮЗ'], runs: true, skip: ['tri:medium', 'tri:long', 'long'], from: '2026-11-20',
    about: ['The Neva under the walls of the Peter and Paul Fortress, between the raised bridges, in the westerly off the Gulf.', 'Нева под стенами Петропавловской крепости, между разведёнными мостами, под западным ветром с залива.'] },
  { id: 'batumi', nation: 'GEO', name: ['Batumi', 'Батуми'], place: ['Georgia', 'Грузия'], wind: ['WNW', 'ЗСЗ'], from: '2026-11-20',
    about: ['Batumi bay in the Black Sea’s afternoon breeze, the city and the Alphabetic Tower on the cape, the mountains of Adjara over the coast.', 'Батумская бухта под дневным бризом Чёрного моря: на мысе — город и Башня алфавита, над берегом — горы Аджарии.'] },
  { id: 'scheveningen', nation: 'NED', name: ['Scheveningen', 'Схевенинген'], place: ['The Hague, Netherlands', 'Гаага, Нидерланды'], wind: ['SW', 'ЮЗ'], from: '2026-11-20',
    about: ['The North Sea of the 2023 Sailing World Championships, off the pier and the Kurhaus, in the south-westerly along the dunes.', 'Северное море чемпионата мира 2023 года, у пирса и Курхауса, под юго-западным ветром вдоль дюн.'] },
  { id: 'hong-kong', nation: 'HKG', name: ['Hong Kong', 'Гонконг'], place: ['China', 'Китай'], wind: ['E', 'В'], from: '2026-11-20',
    about: ['Victoria Harbour between Wan Chai and Tsim Sha Tsui, in the easterly, the towers on both shores and the Peak above.', 'Гавань Виктория между Ваньчаем и Цимшацуем, под восточным ветром; небоскрёбы на обоих берегах, над ними — пик Виктория.'] },
  { id: 'cape-town', nation: 'RSA', name: ['Cape Town', 'Кейптаун'], place: ['South Africa', 'ЮАР'], wind: ['SSE', 'ЮЮВ'], from: '2026-11-20',
    about: ['Table Bay off the V&A Waterfront, in the Cape Doctor blowing off Table Mountain.', 'Столовый залив у набережной Виктории и Альфреда, под ветром «Кейпский доктор» со Столовой горы.'] },
  { id: 'athens', nation: 'GRE', name: ['Athens', 'Афины'], place: ['Greece', 'Греция'], wind: ['NNE', 'ССВ'], from: '2026-11-20',
    about: ['The 2004 Olympic waters in Faliro Bay, in the meltemi off the land, the Parthenon to windward.', 'Олимпийская акватория 2004 года в Фалирском заливе, под мельтеми с берега; на ветре — Парфенон.'] },
  { id: 'marmaris', nation: 'TUR', name: ['Marmaris', 'Мармарис'], place: ['Turkey', 'Турция'], wind: ['W', 'З'], from: '2026-11-20',
    about: ['The bay of Marmaris Race Week, ringed by pine mountains, in the westerly, the castle above the old town and the marina to leeward.', 'Бухта Недели гонок Мармариса в кольце сосновых гор, под западным ветром; под ветром — крепость над старым городом и марина.'] },
  { id: 'fethiye', nation: 'TUR', name: ['Fethiye', 'Фетхие'], place: ['Turkey', 'Турция'], wind: ['W', 'З'], from: '2026-11-20',
    about: ['The bay inside Şövalye island, in the afternoon westerly, the town all round, the Lycian rock tombs in the cliff over the harbour and Babadağ above.', 'Бухта за островом Шовалье, под дневным западным ветром; вокруг город, над гаванью — ликийские гробницы в скале и гора Бабадаг.'] },
  { id: 'sochi', nation: 'RUS', name: ['Sochi', 'Сочи'], place: ['Russia', 'Россия'], wind: ['SW', 'ЮЗ'], from: '2026-11-20',
    about: ['The Black Sea off the sea terminal and its spire, in the afternoon sea breeze, the town along the shore and the Caucasus behind it.', 'Чёрное море у морского вокзала со шпилем, под дневным морским бризом; вдоль берега — город, за ним — Кавказские горы.'] },
  { id: 'melbourne', nation: 'AUS', name: ['Melbourne', 'Мельбурн'], place: ['Victoria, Australia', 'Виктория, Австралия'], wind: ['SSW', 'ЮЮЗ'], from: '2026-11-20',
    about: ['Port Phillip off St Kilda, the waters of the 1956 Olympic regatta, in the afternoon sea breeze, the city’s towers to leeward.', 'Залив Порт-Филлип у Сент-Килды, акватория олимпийской регаты 1956 года, под дневным морским бризом; под ветром — небоскрёбы города.'] },
  { id: 'gold-coast', nation: 'AUS', name: ['Gold Coast', 'Голд-Кост'], place: ['Queensland, Australia', 'Квинсленд, Австралия'], wind: ['E', 'В'], from: '2026-11-20',
    about: ['The Pacific off the beach and towers of Surfers Paradise, in the easterly sea breeze, the East Australian Current running south.', 'Тихий океан у пляжа и небоскрёбов Серферс-Парадайз, под восточным морским бризом; Восточно-Австралийское течение несёт на юг.'] },
  { id: 'new-york', nation: 'USA', name: ['New York', 'Нью-Йорк'], place: ['USA', 'США'], wind: ['SSW', 'ЮЮЗ'], from: '2026-11-20',
    about: ['The Upper Bay by the Statue of Liberty, in the summer south-westerly, Lower Manhattan and the Brooklyn Bridge to leeward, the Verrazzano to windward.', 'Верхняя бухта у статуи Свободы, под летним юго-западным ветром; под ветром — Нижний Манхэттен и Бруклинский мост, на ветре — мост Верразано.'] },
  { id: 'naples', nation: 'ITA', name: ['Naples', 'Неаполь'], place: ['Italy', 'Италия'], wind: ['SW', 'ЮЗ'], from: '2026-11-20',
    about: ['The bay of the 2027 America’s Cup, off Posillipo and Castel dell’Ovo, in the afternoon sea breeze, Vesuvius beyond the city.', 'Неаполитанский залив Кубка «Америка» 2027 года, у Позиллипо и замка Кастель-дель-Ово, под дневным морским бризом; за городом — Везувий.'] },
  { id: 'los-angeles', nation: 'USA', name: ['Los Angeles', 'Лос-Анджелес'], place: ['California, USA', 'Калифорния, США'], wind: ['WSW', 'ЗЮЗ'], from: '2026-11-20',
    about: ['San Pedro Bay, the sailing waters of the 2028 Olympics, off the Port of Los Angeles and the Queen Mary at Long Beach.', 'Залив Сан-Педро, парусная акватория Олимпиады 2028 года, у порта Лос-Анджелеса и лайнера «Куин Мэри» в Лонг-Бич.'] },
  { id: 'les-sables', nation: 'FRA', name: ['Les Sables-d’Olonne', 'Ле-Сабль-д’Олон'], place: ['Vendée, France', 'Вандея, Франция'], wind: ['WNW', 'ЗСЗ'], from: '2026-11-20',
    about: ['The Bay of Biscay off the channel where the Vendée Globe starts and ends, La Chaume’s tower and the long beach to leeward.', 'Бискайский залив у канала, где стартует и финиширует «Вандея Глоб»; под ветром — башня Ла-Шом и длинный пляж.'] },
  { id: 'dubai', nation: 'UAE', name: ['Dubai', 'Дубай'], place: ['UAE', 'ОАЭ'], wind: ['NW', 'СЗ'], from: '2026-11-20',
    about: ['The Gulf off Jumeirah in the shamal, between the Burj Al Arab, the Palm and the World, the Burj Khalifa over the city.', 'Персидский залив у Джумейры под ветром шамаль, между Бурдж-эль-Араб, Пальмой и островами Мир; над городом — Бурдж-Халифа.'] },
  { id: 'miami', nation: 'USA', name: ['Miami', 'Майами'], place: ['Florida, USA', 'Флорида, США'], wind: ['ESE', 'ВЮВ'], from: '2026-11-20',
    about: ['Biscayne Bay off Coconut Grove, home of the Bacardi Cup, in the trade wind, Key Biscayne to windward and the towers of downtown up the bay.', 'Залив Бискейн у Коконат-Гроув, дом Кубка Bacardi, под пассатом; на ветре — Ки-Бискейн, вдали — небоскрёбы центра.'] },
  { id: 'split', nation: 'CRO', name: ['Split', 'Сплит'], place: ['Croatia', 'Хорватия'], wind: ['WNW', 'ЗСЗ'], from: '2026-11-20',
    about: ['The Split Channel in the summer maestral, off Marjan’s wooded hill and Diocletian’s city, Brač and Šolta across the water.', 'Сплитский канал под летним маэстралом, у лесистого холма Марьян и города Диоклетиана; напротив — острова Брач и Шолта.'] },
  { id: 'monaco', nation: 'MON', name: ['Monaco', 'Монако'], place: ['Côte d’Azur', 'Лазурный Берег'], wind: ['SE', 'ЮВ'], from: '2026-11-20',
    about: ['The sea off Port Hercule in the afternoon breeze, the Rock and its palace, Monte Carlo’s towers climbing the mountain behind.', 'Море у порта Эркюль под дневным бризом: Скала с дворцом и небоскрёбы Монте-Карло, взбирающиеся на гору.'] },
  { id: 'fremantle', nation: 'AUS', name: ['Fremantle', 'Фримантл'], place: ['Western Australia', 'Западная Австралия'], wind: ['SW', 'ЮЗ'], from: '2026-11-20',
    about: ['Gage Roads, the waters of the 1987 America’s Cup, in the south-westerly Fremantle Doctor, the port’s moles and cranes to leeward.', 'Рейд Гейдж, акватория Кубка «Америка» 1987 года, под юго-западным «Фримантлским доктором»; под ветром — молы и краны порта.'] },
  { id: 'sint-maarten', nation: 'NED', name: ['Sint Maarten', 'Синт-Мартен'], place: ['Caribbean', 'Карибы'], wind: ['E', 'В'], from: '2026-11-20',
    about: ['The Caribbean of the Heineken Regatta off Simpson Bay, in the trade wind, the airliners landing low over Maho Beach.', 'Карибское море регаты Heineken у залива Симпсон, под пассатом; над пляжем Махо низко заходят на посадку лайнеры.'] },
  { id: 'phuket', nation: 'THA', name: ['Phuket', 'Пхукет'], place: ['Thailand', 'Таиланд'], wind: ['ENE', 'ВСВ'], from: '2026-11-20',
    about: ['The Andaman Sea of the King’s Cup off Kata and Karon, in the north-east monsoon, the Big Buddha on the hill above the beaches.', 'Андаманское море Королевского кубка у Каты и Карона, под северо-восточным муссоном; над пляжами на холме — Большой Будда.'] },
  { id: 'tbilisi-sea', nation: 'GEO', name: ['Tbilisi Sea', 'Тбилисское море'], place: ['Georgia', 'Грузия'], wind: ['NW', 'СЗ'], from: '2026-11-20',
    about: ['Fresh water in the dry hills over Georgia’s capital, in the north-westerly, under the bronze pillars of the Chronicle of Georgia.', 'Пресная вода в сухих холмах над столицей Грузии, под северо-западным ветром и бронзовыми колоннами «Хроники Грузии».'] },
];

export const venueOf = (id: string | undefined) => VENUES.find((v) => v.id === id) || VENUES[0];
// whether the set-up offers a course shape at the venue at that length, as public/game/venues.js shapeOffered
export const shapeOffered = (id: string | undefined, shape: string, length: string) => !(venueOf(id).skip || []).includes(`${shape}:${length}`);
// and whether it offers that length at all, as public/game/venues.js lengthOffered
export const lengthOffered = (id: string | undefined, length: string) => !(venueOf(id).skip || []).includes(length);
