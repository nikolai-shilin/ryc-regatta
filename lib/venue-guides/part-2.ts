import type { VenueGuide } from '../venue-guides';
import type { VenueId } from '../venues';

// The venue pages' own words for Barcelona, Palma, Marstrand, Bermuda, Enoshima, Weymouth, Marseille, Rio, Lake Garda,
// Istanbul and St Petersburg: the real place, its water, its wind, its regattas and a few local tactics (lib/venue-guides.ts).
export const PART_2: Partial<Record<VenueId, VenueGuide>> = {
  barcelona: {
    title: ['Sailing in Barcelona: the 2024 America’s Cup', 'Парусный спорт в Барселоне: Кубок «Америка» 2024'],
    description: [
      'Barcelona’s sea breeze, swell and harbour walls, the 2024 America’s Cup and how to race off its beaches, and race it free in a 3D sailing game.',
      'Морской бриз, зыбь и молы Барселоны, Кубок «Америка» 2024 года и как гоняться у её пляжей — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Barcelona races on the open Mediterranean, straight off the city’s beaches, with the hill of Montjuïc to the south-west and the towers of the Sagrada Família behind. In 2024 it held the 37th America’s Cup, with the racing laid close enough to the shore to be watched from the sand.',
      'В Барселоне гоняются в открытом Средиземном море, прямо у городских пляжей: на юго-западе — холм Монжуик, за спиной — башни Саграда Фамилии. В 2024 году здесь прошёл 37-й Кубок «Америка», и дистанцию ставили так близко к берегу, что гонки смотрели прямо с песка.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the racing wind is usually the sea breeze, which the Catalans call the garbí. It fills in from the south or south-west around midday and dies away towards evening. On a good day it is a steady, moderate breeze; in autumn it is often lighter and less reliable.',
          'Летом гоночный ветер здесь обычно — морской бриз, который каталонцы называют гарби. Он заполняет акваторию с юга или юго-запада около полудня и стихает к вечеру. В хороший день это ровный умеренный ветер; осенью он часто слабее и менее надёжен.'],
        ['The sea is the awkward part. There is almost no tide, but a swell from the east or south-east, left by weather far away, can run under the breeze, and close in the waves bounce back off the long harbour breakwaters. The result on many days is a lumpy, confused sea that a light wind cannot flatten.',
          'Сложнее всего здесь с волной. Прилива почти нет, но под бризом может идти зыбь с востока или юго-востока, оставшаяся от далёкой непогоды, а у берега волны отражаются от длинных портовых молов. Во многие дни получается беспорядочная толчея, которую слабый ветер не в силах сгладить.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The 37th America’s Cup, in October 2024, was sailed in foiling AC75 monohulls off the city beaches. Emirates Team New Zealand beat INEOS Britannia to keep the Cup, and the same water held the first Women’s America’s Cup and the Youth America’s Cup.',
          '37-й Кубок «Америка» в октябре 2024 года разыграли на AC75 — однокорпусниках на подводных крыльях — у городских пляжей. Emirates Team New Zealand обыграла INEOS Britannia и сохранила Кубок, а на той же воде прошли первый женский Кубок «Америка» и молодёжный Кубок «Америка».'],
        ['Barcelona was also the start and finish of the Barcelona World Race, a two-handed non-stop race around the world. The Real Club Náutico de Barcelona, in the old harbour, runs the Trofeo Conde de Godó, one of Spain’s best-known keelboat regattas.',
          'Барселона была стартом и финишем Barcelona World Race — безостановочной кругосветной гонки экипажей из двух человек. Королевский морской клуб Барселоны в старом порту проводит Трофей графа Годо, одну из самых известных килевых регат Испании.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the sea breeze to settle before you commit to a side. In its first hour it is often patchy and can swing a long way. Once it is in, it tends to veer slowly to the right through the afternoon, so the right-hand side often pays later in the day.',
          'Не выбирай сторону, пока бриз не установится. В первый час он часто пятнами и может сильно гулять. Когда он задул всерьёз, то обычно медленно заходит вправо в течение дня, поэтому ближе к вечеру правая сторона часто оказывается выгоднее.'],
        ['In a lumpy sea, sail a little freer upwind and keep the boat moving through the waves rather than pointing high. Near the breakwaters and the port entrances the wind bends and the waves come back at you, so keep away from the walls unless the shift there is worth the chop.',
          'В толчею на лавировке иди чуть полнее и держи ход на волне, а не жмись к ветру. У молов и входов в порты ветер изгибается, а волна идёт обратно на тебя, так что держись подальше от стенок, если только сдвиг ветра там не стоит этой толчеи.'],
      ] },
    ],
  },

  palma: {
    title: ['Sailing in Palma: the bay and its embat', 'Парусный спорт в Пальме: бухта и эмбат'],
    description: [
      'The Bay of Palma’s afternoon sea breeze, the Copa del Rey and how to race the embat, and race the bay free in a 3D sailing game.',
      'Дневной морской бриз бухты Пальмы, Кубок короля и как гоняться в эмбат — и гонка в этой бухте бесплатно в 3D-игре.',
    ],
    intro: [
      'The Bay of Palma, on the south-west coast of Mallorca, is one of the busiest racing waters in the Mediterranean. The city and its Gothic cathedral, La Seu, stand at the head of the bay, with the mountains of the Serra de Tramuntana beyond. In summer a sea breeze, the embat, comes in on most afternoons.',
      'Бухта Пальмы на юго-западном побережье Майорки — одна из самых оживлённых гоночных акваторий Средиземноморья. Город и его готический собор Ла Сеу стоят в глубине бухты, а за ними поднимаются горы Серра-де-Трамунтана. Летом почти каждый день после обеда приходит морской бриз — эмбат.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The embat is a thermal breeze. On a sunny day the island heats up, the morning is calm or light, and from around midday the breeze fills in across the bay from the south-west. It usually builds to a moderate wind through the afternoon and eases towards evening, so racing here is timed for after lunch.',
          'Эмбат — термический бриз. В солнечный день остров прогревается, утро проходит в штиль или при слабом ветре, а около полудня бриз заполняет бухту с юго-запада. Обычно он крепнет до умеренного к середине дня и стихает к вечеру, поэтому гонки здесь назначают на после обеда.'],
        ['There is no real tide. The bay is open to the south, so a swell can run in, but under the embat the sea is usually a short chop. When a gradient wind blows instead, from the north or north-east, it comes off the land and is gusty and shifty near the shore.',
          'Настоящего прилива нет. Бухта открыта на юг, и туда может заходить зыбь, но под эмбатом волна обычно короткая. Когда вместо бриза дует градиентный ветер с севера или северо-востока, он идёт с суши, и у берега он порывистый и неустойчивый.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Copa del Rey, run by the Real Club Náutico de Palma for more than forty years, brings big keelboat fleets to the bay every summer, with several courses laid at once. Members of the Spanish royal family have raced in it.',
          'Кубок короля, который Королевский морской клуб Пальмы проводит уже больше сорока лет, каждое лето собирает в бухте большие флоты килевых яхт, и дистанции ставят сразу на нескольких полях. В нём гонялись и члены испанской королевской семьи.'],
        ['In spring the Trofeo Princesa Sofía gathers the Olympic classes. Palma is also a home port for many of the largest racing yachts and superyachts, which meet at regattas such as PalmaVela and the Superyacht Cup.',
          'Весной Трофей принцессы Софии собирает олимпийские классы. А ещё Пальма — домашний порт многих крупнейших гоночных яхт и суперъяхт, которые встречаются на регатах PalmaVela и Superyacht Cup.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Be patient early. Before the embat is established the wind is light and changeable, and a side that looks right can be wrong ten minutes later. Look out to sea for the darker water that marks the breeze coming in.',
          'Не спеши в начале. Пока эмбат не установился, ветер слабый и переменчивый, и сторона, которая кажется верной, через десять минут может оказаться ошибкой. Смотри в сторону моря: тёмная вода показывает, где идёт бриз.'],
        ['Once it is blowing, the embat is usually steady enough that pressure counts for more than shifts: find the darker lanes and sail to them. In the afternoon chop, keep the boat powered up and footing a little; pinching in short waves costs more than it gains.',
          'Когда эмбат задул, он обычно достаточно ровный, и давление ветра значит больше, чем его сдвиги: ищи полосы тёмной воды и иди к ним. В дневной короткой волне держи паруса наполненными и иди чуть полнее: острый курс на такой волне отнимает больше, чем даёт.'],
      ] },
    ],
  },

  marstrand: {
    title: ['Sailing in Marstrand: match racing’s island', 'Парусный спорт в Марстранде: остров матч-рейса'],
    description: [
      'Marstrand’s south-westerly, granite skerries and weak current, its match racing and how to race there, and race it free in a 3D sailing game.',
      'Юго-западный ветер, гранитные шхеры и слабое течение Марстранда, его матч-рейсы и как там гоняться — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Marstrand is a small, car-free island on the Swedish west coast, north of Gothenburg, among the granite skerries of Bohuslän. Carlsten fortress stands on its highest rock. In summer the narrow sound between Marstrand and the neighbouring island of Koön fills with yachts, and for years it held one of match racing’s best-known events.',
      'Марстранд — маленький остров без машин на западном побережье Швеции, к северу от Гётеборга, среди гранитных шхер Бохуслена. На его самой высокой скале стоит крепость Карлстен. Летом узкий пролив между Марстрандом и соседним островом Коён заполняется яхтами, и много лет здесь проходил один из самых известных матч-рейсов.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing summer wind is from the south-west or west, off the Skagerrak and the Kattegat, and on sunny afternoons a sea breeze often adds to it from the same quarter. Among the islands it is a different wind: the bare granite bends and blocks it, so it comes in gusts and holes, with sharp shifts close to the rocks.',
          'Летом здесь преобладает ветер с юго-запада или запада, со Скагеррака и Каттегата, а в солнечные дни после обеда его часто усиливает морской бриз с той же стороны. Среди островов это уже другой ветер: голый гранит изгибает и закрывает его, и он идёт порывами и провалами, с резкими сдвигами у самых скал.'],
        ['There is very little tide on this coast; the water level rises and falls more with the air pressure and the wind than with the moon. What there is instead is a weak current: water from the Baltic flows out through the Kattegat and runs north along the Swedish coast, and in the sounds the wind can push the water one way or the other.',
          'Прилив на этом побережье очень мал: уровень воды больше зависит от давления и ветра, чем от Луны. Зато есть слабое течение: вода из Балтики выходит через Каттегат и идёт на север вдоль шведского берега, а в проливах ветер может гнать воду то в одну, то в другую сторону.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['For many years Marstrand hosted the Match Cup Sweden, a stop on the World Match Racing Tour. It was raced in identical keelboats right up against the harbour, with the crowd on the quay and the rocks a few metres from the boats, and it drew the leading match racers, many of them America’s Cup helmsmen.',
          'Много лет Марстранд принимал Match Cup Sweden — этап Мирового тура по матч-рейсу. Гонялись на одинаковых килевых лодках прямо у гавани: зрители стояли на причале и скалах в нескольких метрах от яхт, а соревновались сильнейшие матч-рейсеры, многие из них — рулевые Кубка «Америка».'],
        ['The Royal Gothenburg Yacht Club, the GKSS, also races there in summer.',
          'Летом здесь гоняется и Королевский гётеборгский яхт-клуб (GKSS).'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a match race the boat that wins the start can usually control the race, but near the rocks the shifts are big enough to pass on: if you are behind, look for a split; if you lead, cover.',
          'В матч-рейсе лодка, выигравшая старт, обычно контролирует гонку, но у скал сдвиги ветра настолько велики, что на них можно обогнать: если ты позади — ищи разделения, если впереди — накрывай.'],
        ['Watch the shore. The wind lifts and heads where it bends round the islands, and a gust through a gap in the rocks can be worth more than a tack. The current is weak but steady: when it runs with you, stay in the middle of the sound; when it runs against you, look for slacker water near the edges, but go close to the granite only where you know it is deep.',
          'Следи за берегом. Там, где ветер огибает острова, он отходит и заходит, а порыв через просвет между скалами может стоить больше, чем поворот. Течение слабое, но постоянное: когда оно попутное, держись середины пролива; когда встречное — ищи воду потише у краёв, но подходи к граниту только там, где точно знаешь глубину.'],
      ] },
    ],
  },

  bermuda: {
    title: ['Sailing in Bermuda: the Great Sound', 'Парусный спорт на Бермудах: Большой залив'],
    description: [
      'Bermuda’s Great Sound, its puffy summer south-westerly, the 2017 America’s Cup and how to race there, and race it free in a 3D sailing game.',
      'Большой залив Бермуд, летний юго-западный ветер с порывами, Кубок «Америка» 2017 года и как там гоняться — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Bermuda is a hook of small islands in the western Atlantic, about a thousand kilometres off the coast of North Carolina. Inside the hook lies the Great Sound, a broad, sheltered stretch of turquoise water ringed by islands and reefs, where the 35th America’s Cup was raced in 2017.',
      'Бермуды — дуга из небольших островов в западной Атлантике, примерно в тысяче километров от побережья Северной Каролины. Внутри этой дуги лежит Большой залив — широкая защищённая акватория бирюзовой воды в кольце островов и рифов, где в 2017 году разыграли 35-й Кубок «Америка».',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer Bermuda lies under the Azores high, and the usual wind is a warm south-westerly to southerly, often light to moderate. In winter, fronts from North America bring stronger, more changeable winds from the west and north.',
          'Летом Бермуды находятся под Азорским антициклоном, и обычный ветер — тёплый, с юго-запада или юга, чаще слабый или умеренный. Зимой фронты с Североамериканского континента приносят более сильный и переменчивый ветер с запада и севера.'],
        ['The Sound is enclosed, so its water stays flat even when the ocean outside is rough, and the tidal stream inside is weak. But the wind reaches it over the islands, past houses, trees and headlands, so it arrives in puffs and lulls with frequent shifts. The reefs and shallows that make the water so clear also limit where you can sail.',
          'Залив закрыт со всех сторон, поэтому вода в нём остаётся ровной, даже когда снаружи океан штормит, а приливное течение внутри слабое. Зато ветер приходит туда через острова, мимо домов, деревьев и мысов, и дует порывами и затишьями с частыми сдвигами. Рифы и мели, из-за которых вода такая прозрачная, ещё и ограничивают, где можно ходить.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The 2017 America’s Cup was sailed in foiling AC50 catamarans on a short course in the Great Sound. Emirates Team New Zealand beat the defender, Oracle Team USA, and took the Cup.',
          'Кубок «Америка» 2017 года разыграли на AC50 — катамаранах на подводных крыльях — на короткой дистанции в Большом заливе. Emirates Team New Zealand обыграла защитника, Oracle Team USA, и забрала Кубок.'],
        ['Bermuda’s racing goes back much further. The Royal Bermuda Yacht Club was founded in 1844, and the Newport Bermuda Race, first sailed in 1906, finishes off St David’s Head every two years. The islands also have a boat of their own, the Bermuda fitted dinghy: a small open boat with a towering rig, still raced between local clubs.',
          'Гоночная история Бермуд гораздо длиннее. Королевский бермудский яхт-клуб основан в 1844 году, а гонка Ньюпорт — Бермуды, впервые прошедшая в 1906 году, раз в два года финиширует у мыса Сент-Дейвидс-Хед. Есть у островов и своя лодка — бермудский «фиттед-динги»: маленькая открытая лодка с огромным парусным вооружением, на которой до сих пор гоняются местные клубы.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Race the puffs. In the Sound the wind is rarely the same across the course, so look upwind for the dark patches and sail to them; a gust is often worth more than a small shift.',
          'Гоняйся по порывам. В заливе ветер редко одинаков по всей дистанции, поэтому смотри наветер, ищи тёмные пятна на воде и иди к ним: порыв часто стоит больше, чем небольшой сдвиг.'],
        ['Near the shore and the small islands, expect the wind to bend and drop. Give the headlands room, and don’t sail so close to the land that you end up in its wind shadow. On a light summer day the breeze comes and goes, so keep the boat moving and favour the side with more pressure over the side that looks shorter.',
          'У берега и у маленьких островов ветер будет изгибаться и проваливаться. Обходи мысы с запасом и не подходи к суше так близко, чтобы попасть в её ветровую тень. В слабый летний день ветер то приходит, то уходит, так что держи ход и выбирай сторону, где больше ветра, а не ту, что кажется короче.'],
      ] },
    ],
  },

  enoshima: {
    title: ['Sailing in Enoshima: Japan’s Olympic waters', 'Парусный спорт в Эносиме: олимпийская вода Японии'],
    description: [
      'Enoshima’s Pacific swell and summer sea breeze, its 1964 and 2020 Olympic regattas and how to race the waves, and race it free in a 3D sailing game.',
      'Тихоокеанская зыбь и летний бриз Эносимы, олимпийские регаты 1964 и 2020 годов и как гоняться на волне — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Enoshima is a small island joined by a bridge to the coast at Fujisawa, south-west of Tokyo, on Sagami Bay. Its harbour was built for the sailing of the 1964 Tokyo Olympics, and the sailing of the Tokyo 2020 Games, held in 2021, came back to it. On a clear day Mount Fuji stands to the west across the bay.',
      'Эносима — небольшой остров в заливе Сагами, соединённый мостом с берегом у Фудзисавы, к юго-западу от Токио. Его гавань построили для парусной регаты Олимпиады 1964 года в Токио, и сюда же вернулась регата Игр Токио-2020, прошедших в 2021 году. В ясный день за заливом на западе видна Фудзи.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Sagami Bay opens straight onto the Pacific, so the water here moves. A long ocean swell often runs in under the local wind waves, and in late summer and autumn typhoons far to the south can send in a big one.',
          'Залив Сагами открыт прямо в Тихий океан, поэтому вода здесь неспокойная. Под местной ветровой волной часто идёт длинная океанская зыбь, а в конце лета и осенью тайфуны далеко на юге могут нагнать большую.'],
        ['In summer the usual racing wind is a southerly sea breeze off the bay, filling in during the late morning and often blowing at a moderate strength through the afternoon. In winter the wind turns to the north and comes off the land, cold and gusty. Spring and autumn are more changeable, with fronts passing through. The tidal stream in the bay is weak.',
          'Летом обычный гоночный ветер — южный морской бриз с залива: он заполняет акваторию ближе к полудню и часто держится умеренным всю вторую половину дня. Зимой ветер поворачивает на север и дует с суши — холодный и порывистый. Весной и осенью погода переменчивее, проходят фронты. Приливное течение в заливе слабое.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The 1964 Olympic regatta made Enoshima a centre of Japanese dinghy racing, and it has stayed one, with clubs and school and university teams sailing from the harbour. In the years before the 2020 Games it hosted major international regattas for the Olympic classes.',
          'Олимпийская регата 1964 года сделала Эносиму одним из центров японских гонок на швертботах, и такой она осталась: из гавани ходят клубы, школьные и университетские команды. В годы перед Играми-2020 здесь проходили крупные международные регаты олимпийских классов.'],
        ['For Tokyo 2020 the courses were laid both close to the island, in more sheltered water, and further out in the bay, where the swell was bigger. The Games were sailed in the summer of 2021, a year late.',
          'На Играх Токио-2020 дистанции ставили и у самого острова, на более защищённой воде, и дальше в заливе, где зыбь была больше. Олимпийская регата прошла летом 2021 года, на год позже срока.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Learn to sail the waves. Upwind, steer up the face of a swell and bear away down its back so the boat doesn’t slam to a stop. Downwind, catch the swells and ride them; the gains can be bigger than any shift.',
          'Научись ходить по волне. На лавировке приводись на склоне волны и уваливайся за её гребнем, чтобы лодка не ударялась и не теряла ход. На попутном лови зыбь и съезжай с неё: выигрыш может оказаться больше, чем от любого сдвига ветра.'],
        ['Close to Enoshima and the shore the sea breeze bends round the land and is shiftier; out in the bay it is usually steadier, and the race is more about speed and the waves. On a summer day the breeze often builds as the afternoon goes on, so expect more wind in the last race than in the first.',
          'У Эносимы и у берега бриз огибает сушу и сильнее гуляет; дальше в заливе он обычно ровнее, и гонка больше зависит от скорости и волны. Летом бриз часто крепнет к середине дня, так что в последней гонке жди больше ветра, чем в первой.'],
      ] },
    ],
  },

  weymouth: {
    title: ['Sailing in Weymouth: the 2012 Olympic bay', 'Парусный спорт в Уэймуте: олимпийская бухта 2012'],
    description: [
      'Weymouth Bay and Portland Harbour: the south-westerly, the weak tide, the 2012 Olympic regatta and local tactics, and race it free in a 3D sailing game.',
      'Бухта Уэймута и гавань Портленда: юго-западный ветер, слабый прилив, олимпийская регата 2012 года и местная тактика — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Weymouth Bay and Portland Harbour, on the Dorset coast in the south of England, held the sailing of the London 2012 Olympics and Paralympics. The bay lies between Weymouth’s Georgian seafront and the Isle of Portland, a block of limestone tied to the mainland by Chesil Beach, and the harbour is enclosed by long stone breakwaters.',
      'Бухта Уэймута и гавань Портленда на побережье Дорсета, на юге Англии, приняли парусные регаты Олимпийских и Паралимпийских игр 2012 года в Лондоне. Бухта лежит между георгианской набережной Уэймута и островом Портленд — известняковой глыбой, связанной с большой землёй галечной косой Чезил-Бич, а гавань закрыта длинными каменными волноломами.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind is from the south-west, off the Channel, but every direction is common as weather systems pass. In a westerly or south-westerly the wind reaches the bay over Portland and the land behind Chesil Beach, which makes it gustier and shiftier close in; from the south or east it comes in off open water, with more waves.',
          'Преобладает юго-западный ветер с Ла-Манша, но с проходом циклонов здесь бывает любое направление. При западном или юго-западном ветер приходит в бухту через Портленд и сушу за Чезил-Бич, поэтому у берега он порывистее и сильнее гуляет; с юга или востока он идёт с открытой воды, и волна больше.'],
        ['The tidal streams in the bay are weak, far weaker than off Portland Bill, where the Portland Race is one of the roughest tidal races on the English coast. Inside Portland Harbour, behind the breakwaters, the water is flatter still.',
          'Приливные течения в бухте слабые — куда слабее, чем у мыса Портленд-Билл, где Портлендский сулой считается одним из самых бурных приливных сулоев у берегов Англии. Внутри гавани Портленда, за волноломами, вода ещё ровнее.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['For 2012 the Weymouth and Portland National Sailing Academy, on part of the old naval base, was the Olympic venue. Races were laid in Portland Harbour, out in Weymouth Bay and on the Nothe course, a small area under the Nothe Fort where spectators could watch from the shore.',
          'В 2012 году олимпийской базой стала Национальная парусная академия Уэймута и Портленда на территории бывшей военно-морской базы. Гонки шли в гавани Портленда, в бухте Уэймута и на дистанции Нот — небольшой акватории под фортом Нот, откуда зрители смотрели гонки прямо с берега.'],
        ['The academy has since held world and European championships for many classes. Portland Harbour is also home to Weymouth Speed Week, held each autumn since the 1970s, where boards, kites and sailing craft go for the fastest run.',
          'С тех пор академия принимала чемпионаты мира и Европы во многих классах. А в гавани Портленда с 1970-х годов каждую осень проходит Неделя скорости Уэймута, где доски, кайты и парусные лодки соревнуются за самый быстрый проход.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a south-westerly, close to the shore, expect lifts and headers off the land and gusts coming down from Portland: sail the shifts there. Out in the bay the wind is steadier and the waves bigger.',
          'При юго-западном у берега жди отходов и заходов с суши и порывов со стороны Портленда — там гоняйся по сдвигам. Дальше в бухте ветер ровнее, а волна больше.'],
        ['The tide matters less here than in the Solent, but it is not nothing: on a long beat, check which way it is running and favour the side where it helps more or hurts less. On the Nothe course the legs are short and the shore is close, so clean tacks and gybes and tidy mark roundings count as much as speed.',
          'Прилив здесь значит меньше, чем в Соленте, но совсем не учитывать его нельзя: на длинной лавировке проверь, куда идёт течение, и выбирай сторону, где оно больше помогает или меньше мешает. На дистанции Нот лавировки короткие, а берег близко, так что чистые повороты оверштаг и фордевинд и аккуратное огибание знаков значат не меньше скорости.'],
      ] },
    ],
  },

  marseille: {
    title: ['Sailing in Marseille: the mistral and 2024', 'Парусный спорт в Марселе: мистраль и Олимпиада'],
    description: [
      'Marseille’s mistral and summer sea breeze, the Paris 2024 Olympic regatta and how to race in gusts off the land, and race it free in a 3D sailing game.',
      'Мистраль и летний бриз Марселя, олимпийская регата Парижа-2024 и как гоняться в порывах с берега — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Marseille, founded by Greek sailors some 2,600 years ago, held the sailing of the Paris 2024 Olympics. The racing was laid in the roadstead off the Roucas-Blanc marina, under the basilica of Notre-Dame de la Garde, with the Frioul islands and the Château d’If to seaward.',
      'Марсель, основанный греческими мореходами около 2600 лет назад, принял парусную регату Олимпиады Париж-2024. Дистанции ставили на рейде у марины Рукас-Блан, под базиликой Нотр-Дам-де-ла-Гард, а со стороны моря видны Фриульские острова и замок Иф.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The wind Marseille is known for is the mistral, a cold, dry north-westerly that pours down the Rhône valley to the sea. It often blows at 20 knots and more, can last several days, and comes with a clear sky. Because it blows off the land, it is gusty and shifty near the coast, and the waves grow the further out you go.',
          'Ветер, которым знаменит Марсель, — мистраль: холодный сухой северо-западный ветер, который стекает к морю по долине Роны. Он часто дует 20 узлов и сильнее, может держаться несколько дней и приходит с ясным небом. Дует он с суши, поэтому у берега порывистый и неустойчивый, а волна растёт по мере удаления от берега.'],
        ['On summer days without a mistral, a sea breeze usually sets in from the south-west or south in the afternoon, lighter and steadier, bringing a short sea in from the open water. There is no tide to speak of.',
          'Летом в дни без мистраля после обеда обычно устанавливается морской бриз с юго-запада или юга — слабее и ровнее, с короткой волной с открытого моря. Прилива практически нет.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['For Paris 2024 Marseille hosted all ten Olympic sailing events, including the first Olympic kitefoiling and the new iQFOiL windsurfers, after a test event on the same water the summer before.',
          'На Играх Париж-2024 в Марселе разыграли все десять комплектов медалей в парусном спорте, в том числе впервые на Олимпиаде — в кайтинге на подводных крыльях и в новом виндсёрфинговом классе iQFOiL, а за год до Игр на той же воде прошла тестовая регата.'],
        ['The city’s racing is much older than that. The Société Nautique de Marseille, in the Vieux-Port, is one of France’s oldest sailing clubs, and the bay and the islands are raced on all year round.',
          'Гоночная история города гораздо старше. Société Nautique de Marseille в Старом порту — один из старейших яхт-клубов Франции, а в бухте и у островов гоняются круглый год.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a mistral the gusts come off the land in dark streaks you can see on the water. Look upwind for them and be ready: depower before a gust hits and use the lift it brings. In the lulls the wind can swing well to one side.',
          'В мистраль порывы идут с берега тёмными полосами, которые видно на воде. Смотри наветер и будь готов: разгружай паруса до прихода порыва и используй отход ветра, который он несёт. В затишьях ветер может сильно уйти в сторону.'],
        ['Close to the coast the mistral is bent by the hills and the city; further out it is steadier but the sea is rougher. Downwind in a strong wind, keep the boat flat and steer to the waves; a wipe-out costs more than a cautious gybe. In the lighter sea breeze the race is about pressure: go where there is more wind, and keep the boat moving through the leftover chop.',
          'У берега мистраль изгибается о холмы и город; дальше в море он ровнее, но волна круче. На попутном в сильный ветер держи лодку ровно и правь по волне: брочинг обойдётся дороже, чем осторожный фордевинд. В более слабый бриз гонка решается давлением ветра: иди туда, где ветра больше, и держи ход на оставшейся толчее.'],
      ] },
    ],
  },

  rio: {
    title: ['Sailing in Rio: Guanabara Bay and 2016', 'Парусный спорт в Рио: залив Гуанабара'],
    description: [
      'Rio’s Guanabara Bay: the sea breeze, the tide at its mouth, the 2016 Olympic regatta and local tactics, and race it free in a 3D sailing game.',
      'Залив Гуанабара в Рио: морской бриз, приливное течение у входа, олимпийская регата 2016 года и местная тактика — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Guanabara Bay is a large natural harbour on Brazil’s Atlantic coast, entered through a narrow mouth between Rio de Janeiro and Niterói. Sugarloaf Mountain guards the entrance, and Christ the Redeemer looks down from Corcovado. The bay held the sailing of the 2016 Olympics.',
      'Залив Гуанабара — большая естественная гавань на атлантическом побережье Бразилии, с узким входом между Рио-де-Жанейро и Нитероем. Вход сторожит гора Сахарная Голова, а со скалы Корковаду смотрит статуя Христа-Искупителя. В 2016 году здесь прошла олимпийская парусная регата.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The racing wind is the sea breeze. Mornings are often light, sometimes with a weak breeze off the land; around midday the breeze comes in from the sea, from the south-east or south, and blows through the afternoon. It reaches the bay over and around the mountains, so inside it is shifty and patchy, with holes in the lee of the high ground.',
          'Гоночный ветер здесь — морской бриз. Утром ветер часто слабый, иногда дует слабый береговой; около полудня с моря приходит бриз с юго-востока или юга и держится всю вторую половину дня. В залив он попадает через горы и в обход них, поэтому внутри он неустойчивый и пятнистый, с провалами за возвышенностями.'],
        ['Unlike the Mediterranean, Rio has a real tide. The water floods into the bay and ebbs out through the narrow entrance, and the stream there is strong; deeper inside the bay it is weaker. Outside the entrance, off Copacabana and Niterói, the open Atlantic brings a long swell.',
          'В отличие от Средиземного моря, в Рио есть настоящий прилив. Вода входит в залив и выходит обратно через узкий вход, и течение там сильное; в глубине залива оно слабее. Снаружи, у Копакабаны и Нитероя, открытая Атлантика приносит длинную зыбь.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['For the 2016 Games the courses were spread inside the bay and outside it: some close under Sugarloaf, some out in the ocean swell off Copacabana and Niterói. The boats sailed from the Marina da Glória, and the medal races were held close to the Flamengo shore, in front of the crowds on the beach.',
          'На Играх 2016 года дистанции разнесли по заливу и за его пределы: одни ставили у самой Сахарной Головы, другие — в океанской зыби у Копакабаны и Нитероя. Лодки выходили из Марины да Глория, а медальные гонки проходили у берега Фламенгу, перед зрителями на пляже.'],
        ['Brazil has a strong Olympic sailing tradition, and Niterói, across the bay, is home to the Grael family. At the 2016 Games Martine Grael and Kahena Kunze won gold in the 49erFX on their home water.',
          'У Бразилии сильная олимпийская парусная школа, а в Нитерое, на другом берегу залива, живёт семья Граэл. На Играх 2016 года Мартина Граэл и Каэна Кунзе выиграли золото в классе 49erFX на родной воде.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Play the tide first. Near the entrance the stream can be worth more than any shift: going against it, get out of the strongest flow towards the shallower edges; going with it, stay in the middle.',
          'Сначала думай о течении. У входа в залив оно может стоить больше любого сдвига ветра: против течения уходи из самого сильного потока к мелководью у краёв, по течению — держись середины.'],
        ['Expect the land to shape the wind. Near Sugarloaf and the other hills the breeze bends, drops and gusts, so look for the pressure on the water and keep out of the shadow of the high ground. Outside, off Copacabana, the wind is steadier and the race is more about speed in the swell.',
          'Помни, что ветер здесь лепит суша. У Сахарной Головы и других холмов бриз изгибается, проваливается и бьёт порывами, так что ищи давление на воде и не заходи в тень возвышенностей. Снаружи, у Копакабаны, ветер ровнее, и гонка больше зависит от скорости на зыби.'],
      ] },
    ],
  },

  garda: {
    title: ['Sailing on Lake Garda: the Ora and the Pelèr', 'Парусный спорт на Гарде: Ора и Пелер'],
    description: [
      'Lake Garda’s morning Pelèr and afternoon Ora, its regattas and how to race between the cliffs, and race it free in a 3D sailing game.',
      'Два ежедневных ветра Гарды — утренний Пелер и дневная Ора, её регаты и как гоняться между скалами — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Lake Garda is the largest lake in Italy. Its northern end is a narrow trough between steep mountains, with Riva del Garda and Torbole at the top and Monte Baldo along the eastern shore. Two thermal winds blow there on most summer days, regular enough to plan a regatta around.',
      'Гарда — самое большое озеро Италии. Его северная часть — узкая котловина между крутыми горами: наверху Рива-дель-Гарда и Торболе, вдоль восточного берега — хребет Монте-Бальдо. Почти каждый летний день здесь дуют два термических ветра, настолько регулярных, что по ним можно составлять расписание регаты.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The Pelèr is the morning wind: it blows from the north, down the lake, from the night until late morning, sometimes fresh. Then it dies, and after a calm around midday the Ora comes up from the south, blowing up the lake towards Riva and Torbole through the afternoon. On a sunny summer day the Ora usually builds to a moderate or fresh breeze and fades in the evening.',
          'Пелер — утренний ветер: он дует с севера, вдоль озера, с ночи до позднего утра, иногда свежо. Потом он стихает, и после штиля около полудня с юга поднимается Ора — она дует вверх по озеру, к Риве и Торболе, всю вторую половину дня. В солнечный летний день Ора обычно крепнет до умеренной или свежей и затихает к вечеру.'],
        ['Both winds are channelled by the mountains, so they blow along the lake rather than across it. The water is fresh, with no tide and no current to speak of, and the waves are short and steep. A boat floats a little lower in fresh water than in the sea.',
          'Оба ветра направляют горы, поэтому дуют они вдоль озера, а не поперёк. Вода пресная, ни прилива, ни заметного течения нет, а волна короткая и крутая. В пресной воде лодка сидит чуть глубже, чем в море.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The northern lake is one of Europe’s busiest racing waters. The Fraglia Vela Riva runs the Lake Garda Meeting for Optimists each spring, one of the largest youth regattas anywhere, and the clubs at Riva, Torbole and Arco host world and European championships for many dinghy and keelboat classes.',
          'Северная часть озера — одна из самых оживлённых гоночных акваторий Европы. Клуб Fraglia Vela Riva каждую весну проводит Lake Garda Meeting для «Оптимистов» — одну из крупнейших детских регат в мире, а клубы Ривы, Торболе и Арко принимают чемпионаты мира и Европы во многих классах швертботов и килевых яхт.'],
        ['Further south, the Centomiglia, sailed from Bogliaco since 1951, is a long-distance race round the lake for big lake boats.',
          'Южнее, из Больяко, с 1951 года стартует Чентомилья — длинная гонка по озеру для больших озёрных яхт.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Time matters as much as place. Races are set for the Ora in the afternoon, and in the gap between the two winds there may be nothing at all, so be patient.',
          'Время здесь значит не меньше, чем место. Гонки назначают на дневную Ору, а в промежутке между двумя ветрами может не быть ничего, так что наберись терпения.'],
        ['The lake is narrow and the cliffs are steep, so the wind bends along the shore. Near the walls it lifts or heads you and can blow harder, and that is where most of the gains are; but the water runs out quickly, so tack before the cliff makes you. In the short, steep chop of a fresh Ora, keep the boat powered and footing a little, and downwind, work the boat on every wave.',
          'Озеро узкое, скалы крутые, и ветер изгибается вдоль берега. У стен он отходит или заходит и может дуть сильнее — там и делается большая часть выигрыша; но вода у берега быстро кончается, так что поворачивай раньше, чем тебя заставит скала. В короткой крутой волне свежей Оры держи паруса наполненными и иди чуть полнее, а на попутном работай лодкой на каждой волне.'],
      ] },
    ],
  },

  istanbul: {
    title: ['Sailing in Istanbul: the Bosphorus and poyraz', 'Парусный спорт в Стамбуле: Босфор и пойраз'],
    description: [
      'Istanbul’s poyraz, the Bosphorus current, its regattas and how to race at the strait’s mouth off Moda, and race it free in a 3D sailing game.',
      'Северо-восточный пойраз, течение Босфора, регаты Стамбула и как гоняться у входа в пролив у Моды — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Istanbul stands on both banks of the Bosphorus, the strait between the Black Sea and the Sea of Marmara. At its southern mouth, off Moda on the Asian shore, the water opens into the Marmara, with the domes and minarets of the old city across the way. The shore between Moda and Fenerbahçe is home to several of the city’s sailing clubs.',
      'Стамбул стоит на обоих берегах Босфора — пролива между Чёрным и Мраморным морями. У его южного входа, у Моды на азиатском берегу, вода открывается в Мраморное море, а напротив видны купола и минареты старого города. На берегу между Модой и Фенербахче — несколько парусных клубов города.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind is the poyraz, a north-easterly that blows down the Bosphorus from the Black Sea, often for days at a time, above all in summer. Its opposite is the lodos, a south-westerly off the Marmara that brings warm air and, when it blows hard, rough seas onto the city’s shores.',
          'Преобладающий ветер — пойраз: северо-восточный, он дует вдоль Босфора с Чёрного моря, часто по нескольку дней подряд, особенно летом. Его противоположность — лодос, юго-западный ветер с Мраморного моря: он приносит тёплый воздух, а когда дует сильно — бурное море у берегов города.'],
        ['The Bosphorus has no real tide but a strong current. Water from the Black Sea runs south on the surface into the Marmara, fastest in the narrows, with eddies and counter-currents along the shores and round the points. At the southern mouth the stream spreads out and slows, but it is still there.',
          'Настоящего прилива в Босфоре нет, зато есть сильное течение. Черноморская вода идёт по поверхности на юг, в Мраморное море, быстрее всего в узкостях, а вдоль берегов и у мысов образуются водовороты и обратные течения. У южного входа поток расходится и слабеет, но никуда не исчезает.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Bosphorus Cup, an international keelboat regatta, races in the Marmara and inside the strait itself, past the palaces on its banks.',
          'Bosphorus Cup — международная регата килевых яхт — проходит в Мраморном море и в самом проливе, мимо дворцов на его берегах.'],
        ['Club racing goes on through much of the year off Moda, Fenerbahçe and Kalamış. The strait is one of the world’s busiest shipping lanes, so courses near its mouth are laid clear of the ship traffic, and any race in the Bosphorus is planned around it.',
          'Клубные гонки идут у Моды, Фенербахче и Каламыша большую часть года. Пролив — один из самых загруженных судоходных путей в мире, поэтому дистанции у входа в него ставят в стороне от фарватера, а любую гонку в самом Босфоре планируют с оглядкой на суда.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Know the current. In a poyraz, wind and stream run the same way: the sea is flatter, the beat is against the stream and the run goes with it. In a southerly they oppose each other, and the water gets steeper.',
          'Знай течение. В пойраз ветер и течение идут в одну сторону: волна положе, лавировка идёт против течения, а попутный — по нему. При южном ветре они встречаются, и волна становится круче.'],
        ['Beating against the stream, look for the weaker flow and the eddies near the shore and off the points; running with it, stay out in the strongest water. Keep an eye on the land as well: the Moda headland and the hills of the Asian shore bend the north-easterly, so the wind near them shifts and gusts.',
          'На лавировке против течения ищи слабый поток и водовороты у берега и у мысов; на попутном держись самого сильного потока. И следи за сушей: мыс Мода и холмы азиатского берега изгибают северо-восточный ветер, поэтому рядом с ними он гуляет и бьёт порывами.'],
      ] },
    ],
  },

  'st-petersburg': {
    title: ['Sailing in St Petersburg: the Neva', 'Парусный спорт в Петербурге: Нева'],
    description: [
      'The Neva in St Petersburg: its fast current, the westerly off the Gulf, Peter the Great’s flotilla and how to race, and race it free in a 3D sailing game.',
      'Нева в Петербурге: быстрое течение, западный ветер с Финского залива, флотилия Петра Великого и тактика гонок — и гонка здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'St Petersburg stands where the Neva runs into the Gulf of Finland. The city was founded in 1703 with the Peter and Paul Fortress on Hare Island, and granite embankments, palaces and drawbridges line the river.',
      'Петербург стоит там, где Нева впадает в Финский залив. Город заложен в 1703 году вместе с Петропавловской крепостью на Заячьем острове, а вдоль реки тянутся гранитные набережные, дворцы и разводные мосты.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The Neva is a short, deep river that carries the water of Lake Ladoga to the sea, and in the city it runs fast all year, with no tide to turn it. The current is strongest in the middle of the channel, weaker along the embankments, and quicker where the river narrows.',
          'Нева — короткая полноводная река, несущая воду Ладожского озера в море, и в городе она течёт быстро круглый год, без прилива, который мог бы её развернуть. Течение сильнее всего на середине русла, слабее вдоль набережных и быстрее там, где река сужается.'],
        ['The prevailing wind is westerly or south-westerly, off the Gulf. In the city it comes over roofs and between buildings, so on the river it is gusty and shifty, funnelled along the wide reaches and broken up near the bridges. A strong westerly can pile the water up into the Neva and raise its level; for three centuries that flooded the city, until the barrier across the Gulf was finished in 2011.',
          'Преобладает западный или юго-западный ветер с залива. В городе он проходит над крышами и между домами, поэтому на реке он порывистый и неустойчивый: вдоль широких плёсов его разгоняет, как в трубе, а у мостов он рвётся. Сильный западный ветер может нагнать воду в Неву и поднять её уровень; три века это оборачивалось наводнениями, пока в 2011 году не достроили дамбу через залив.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Russian yachting began here. In 1718 Peter the Great set up the Neva flotilla, handing out boats to the city’s residents and ordering them out on the river; it is often counted among the first yacht clubs anywhere.',
          'Русский яхтинг начался здесь. В 1718 году Пётр Великий учредил Невскую флотилию: раздал горожанам лодки и велел выходить на них на реку. Её часто называют одним из первых яхт-клубов в мире.'],
        ['Today most of the city’s racing is out in the Gulf of Finland, from the yacht clubs near the mouths of the Neva’s branches, in the season between the ice going out in spring and coming back in late autumn.',
          'Сегодня большая часть гонок проходит в Финском заливе, из яхт-клубов у устьев рукавов Невы, — в сезон от весеннего ледохода до ледостава поздней осенью.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['On the river the current comes first. In a westerly the beat runs downstream, so the current carries you up to the windward mark: tack for it earlier than you would in still water, or you will overstand. The run back is against the stream, so keep near the embankments, where it is weakest.',
          'На реке главное — течение. В западный ветер лавировка идёт вниз по течению, и оно само несёт тебя к верхнему знаку: поворачивай на него раньше, чем на стоячей воде, иначе перебёрешь лейлайн. Обратно, на попутном, идёшь против течения — держись ближе к набережным, где оно слабее.'],
        ['Wind against current steepens the water, and the stream changes your angles over the ground: it lifts you to windward on the beat and holds you back on the run, so judge the laylines by the banks, not by the compass. Expect the buildings and bridges to break the wind into gusts and holes, and look for it funnelled along the open reaches.',
          'Ветер против течения делает волну круче, а само течение меняет твои углы относительно берега: на лавировке оно сносит тебя на ветер, на попутном тормозит, поэтому оценивай лейлайны по набережным, а не по компасу. Дома и мосты рвут ветер на порывы и провалы, а вдоль открытых плёсов ищи, где его разгоняет.'],
      ] },
    ],
  },
};
