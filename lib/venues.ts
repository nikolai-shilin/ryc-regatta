// Where a free race can be sailed: the set-up page's list. The game's own list, with each venue's position, wind and
// look, is public/game/venues.js; the ids and names here must match it (npm test checks).
export type VenueId = 'gocek' | 'cowes' | 'newport' | 'sydney' | 'kiel' | 'trieste' | 'porto-cervo' | 'saint-tropez' | 'antigua' | 'auckland' | 'garda';
type Pair = [string, string]; // English, Russian

export const VENUES: { id: VenueId; name: Pair; place: Pair; wind: Pair; about: Pair }[] = [
  { id: 'gocek', name: ['Göcek', 'Гёчек'], place: ['Turkey', 'Турция'], wind: ['N', 'С'],
    about: ['Pine-clad hills and the gulets of Skopea Marina. Today’s race is always sailed here.', 'Сосновые холмы и гулеты марины Скопеа. Гонка дня всегда проходит здесь.'] },
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
  { id: 'garda', name: ['Lake Garda', 'Озеро Гарда'], place: ['Italy', 'Италия'], wind: ['S', 'Ю'],
    about: ['Fresh water under the Alps, off Riva and Torbole, in the afternoon Ora.', 'Пресная вода у подножия Альп, у Ривы и Торболе, под дневным ветром Ора.'] },
];

export const venueOf = (id: string | undefined) => VENUES.find((v) => v.id === id) || VENUES[0];
