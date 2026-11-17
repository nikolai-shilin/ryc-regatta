type Pair = [en: string, ru: string];

// The Sailing Certification Test's courses, as /iyt lists them and its share card counts them: the name, how many
// questions, what it covers.
export const IYT_LEVELS: { name: Pair; n: number; text: Pair }[] = [
  { name: ['VHF Radio Operator', 'VHF Radio Operator'], n: 200, text: ['Marine VHF radio: channels, procedure, distress, urgency and safety calls.', 'Морская УКВ-радиосвязь: каналы, порядок связи, сигналы бедствия, срочности и безопасности.'] },
  { name: ['International Crew', 'International Crew'], n: 200, text: ['The first step aboard: life on a yacht, ropes and knots, safety and helping the skipper.', 'Первый шаг на борту: жизнь на яхте, концы и узлы, безопасность и помощь шкиперу.'] },
  { name: ['Flotilla Skipper', 'Flotilla Skipper'], n: 200, text: ['Skippering a yacht by day in a flotilla, with a lead boat nearby.', 'Управление яхтой днём во флотилии, рядом с лидирующей лодкой.'] },
  { name: ['Bareboat Skipper', 'Bareboat Skipper'], n: 1000, text: ['Skippering a charter yacht yourself by day in coastal waters, without a hired skipper.', 'Самостоятельное управление чартерной яхтой днём в прибрежных водах — без нанятого шкипера.'] },
  { name: ['Yachtmaster Coastal', 'Yachtmaster Coastal'], n: 1000, text: ['Coastal passages by day and night: navigation, tides, weather and passage planning.', 'Прибрежные переходы днём и ночью: навигация, приливы, погода и планирование перехода.'] },
  { name: ['Yachtmaster Offshore', 'Yachtmaster Offshore'], n: 1000, text: ['Offshore passages out of sight of land, the crew and the boat on longer trips.', 'Морские переходы вне видимости берега, экипаж и яхта в долгом плавании.'] },
  { name: ['Yachtmaster Ocean', 'Yachtmaster Ocean'], n: 1000, text: ['Ocean crossings: celestial navigation, ocean weather and the routine of a long passage.', 'Океанские переходы: астронавигация, погода в океане и распорядок долгого перехода.'] },
  { name: ['Racing Rules of Sailing', 'Правила парусных гонок'], n: 1000, text: ['Right of way between racing boats, marks, starts and penalties.', 'Право дороги между гоночными яхтами, знаки, старт и штрафы.'] },
  { name: ['Charter check-in', 'Приёмка чартерной яхты'], n: 500, text: ['Taking over a charter yacht: inventory, engine, sails, safety gear and the paperwork.', 'Как принять яхту в чартер: инвентарь, двигатель, паруса, снаряжение безопасности и документы.'] },
];
export const IYT_TOTAL = IYT_LEVELS.reduce((a, l) => a + l.n, 0);
