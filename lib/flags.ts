// The country flags a boat can fly on her main: the boat page's Flag. Each is public/flags/<code>.svg, drawn 3:2 by
// scripts/flags.mjs (add a country there and here). ioc: the letters a boat from there carries on her sail, which the
// boat page fills in when you pick her flag.

export type Flag = { code: string; ioc: string; en: string; ru: string };

export const FLAGS: Flag[] = [
  { code: 'ge', ioc: 'GEO', en: 'Georgia', ru: 'Грузия' },
  { code: 'ru', ioc: 'RUS', en: 'Russia', ru: 'Россия' },
  { code: 'ua', ioc: 'UKR', en: 'Ukraine', ru: 'Украина' },
  { code: 'kz', ioc: 'KAZ', en: 'Kazakhstan', ru: 'Казахстан' },
  { code: 'am', ioc: 'ARM', en: 'Armenia', ru: 'Армения' },
  { code: 'az', ioc: 'AZE', en: 'Azerbaijan', ru: 'Азербайджан' },
  { code: 'tr', ioc: 'TUR', en: 'Türkiye', ru: 'Турция' },
  { code: 'gr', ioc: 'GRE', en: 'Greece', ru: 'Греция' },
  { code: 'hr', ioc: 'CRO', en: 'Croatia', ru: 'Хорватия' },
  { code: 'it', ioc: 'ITA', en: 'Italy', ru: 'Италия' },
  { code: 'fr', ioc: 'FRA', en: 'France', ru: 'Франция' },
  { code: 'es', ioc: 'ESP', en: 'Spain', ru: 'Испания' },
  { code: 'pt', ioc: 'POR', en: 'Portugal', ru: 'Португалия' },
  { code: 'de', ioc: 'GER', en: 'Germany', ru: 'Германия' },
  { code: 'nl', ioc: 'NED', en: 'Netherlands', ru: 'Нидерланды' },
  { code: 'be', ioc: 'BEL', en: 'Belgium', ru: 'Бельгия' },
  { code: 'gb', ioc: 'GBR', en: 'Great Britain', ru: 'Великобритания' },
  { code: 'ie', ioc: 'IRL', en: 'Ireland', ru: 'Ирландия' },
  { code: 'se', ioc: 'SWE', en: 'Sweden', ru: 'Швеция' },
  { code: 'no', ioc: 'NOR', en: 'Norway', ru: 'Норвегия' },
  { code: 'dk', ioc: 'DEN', en: 'Denmark', ru: 'Дания' },
  { code: 'fi', ioc: 'FIN', en: 'Finland', ru: 'Финляндия' },
  { code: 'ee', ioc: 'EST', en: 'Estonia', ru: 'Эстония' },
  { code: 'lv', ioc: 'LAT', en: 'Latvia', ru: 'Латвия' },
  { code: 'lt', ioc: 'LTU', en: 'Lithuania', ru: 'Литва' },
  { code: 'pl', ioc: 'POL', en: 'Poland', ru: 'Польша' },
  { code: 'cz', ioc: 'CZE', en: 'Czechia', ru: 'Чехия' },
  { code: 'at', ioc: 'AUT', en: 'Austria', ru: 'Австрия' },
  { code: 'ch', ioc: 'SUI', en: 'Switzerland', ru: 'Швейцария' },
  { code: 'hu', ioc: 'HUN', en: 'Hungary', ru: 'Венгрия' },
  { code: 'ro', ioc: 'ROU', en: 'Romania', ru: 'Румыния' },
  { code: 'bg', ioc: 'BUL', en: 'Bulgaria', ru: 'Болгария' },
  { code: 'us', ioc: 'USA', en: 'United States', ru: 'США' },
  { code: 'ca', ioc: 'CAN', en: 'Canada', ru: 'Канада' },
  { code: 'br', ioc: 'BRA', en: 'Brazil', ru: 'Бразилия' },
  { code: 'ar', ioc: 'ARG', en: 'Argentina', ru: 'Аргентина' },
  { code: 'au', ioc: 'AUS', en: 'Australia', ru: 'Австралия' },
  { code: 'nz', ioc: 'NZL', en: 'New Zealand', ru: 'Новая Зеландия' },
  { code: 'jp', ioc: 'JPN', en: 'Japan', ru: 'Япония' },
  { code: 'cn', ioc: 'CHN', en: 'China', ru: 'Китай' },
  { code: 'in', ioc: 'IND', en: 'India', ru: 'Индия' },
  { code: 'ae', ioc: 'UAE', en: 'UAE', ru: 'ОАЭ' },
  { code: 'il', ioc: 'ISR', en: 'Israel', ru: 'Израиль' },
  { code: 'th', ioc: 'THA', en: 'Thailand', ru: 'Таиланд' },
  { code: 'sc', ioc: 'SEY', en: 'Seychelles', ru: 'Сейшелы' },
  { code: 'za', ioc: 'RSA', en: 'South Africa', ru: 'ЮАР' },
];

export const flagSrc = (code: string) => `/flags/${code}.svg`;
export const findFlag = (code: string | undefined) => (code ? FLAGS.find((f) => f.code === code) : undefined);
