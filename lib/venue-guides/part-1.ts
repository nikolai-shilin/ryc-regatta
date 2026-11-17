import type { VenueGuide } from '../venue-guides';
import type { VenueId } from '../venues';

// The venue pages' own words for the first twelve venues: the place itself, true of the real water (the game's facts
// about each are added by the page from lib/venues.ts and public/game/venues.js).
export const PART_1: Partial<Record<VenueId, VenueGuide>> = {
  gocek: {
    title: ['Sailing in Göcek: the bays of the Fethiye Gulf', 'Парусный спорт в Гёчеке: бухты залива Фетхие'],
    description: [
      'Sailing in Göcek, Turkey: the afternoon breeze among the islands, the bays and their past, how to race there – and race it free in a 3D sailing game.',
      'Гёчек, Турция: дневной бриз среди островов, бухты и их история, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Göcek sits at the head of the Gulf of Fethiye on Turkey’s south-west coast, where pine-covered hills come down to a bay full of islands. It is one of the busiest yachting harbours on the Turkish coast, with several marinas, a large charter fleet and the wooden gulets that take people round the bays.',
      'Гёчек стоит в вершине залива Фетхие на юго-западном побережье Турции: поросшие соснами холмы спускаются здесь к бухте, полной островов. Это одна из самых оживлённых яхтенных гаваней турецкого побережья — несколько марин, большой чартерный флот и деревянные гулеты, которые возят людей по бухтам.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the mornings are often calm. Around midday a sea breeze comes in from the open gulf, from the west or south-west, and blows through the afternoon before dying away towards dusk. The islands and the high shore bend it: it funnels between the islands, drops in their lee and comes down off the hills in gusts.',
          'Летом утро часто штилевое. Около полудня с открытой части залива приходит морской бриз — с запада или юго-запада — и дует весь день, стихая к закату. Острова и высокий берег его искривляют: между островами он усиливается, за ними пропадает, а с холмов срывается порывами.'],
        ['There is no tide to speak of, as almost everywhere in the Mediterranean, so the wind is all that moves the race. The water inside the islands stays flat even in a fresh breeze; a chop builds only where the bay opens to the gulf.',
          'Прилива, как почти везде в Средиземном море, практически нет, так что гонку определяет только ветер. За островами вода остаётся ровной даже на свежем бризе; короткая волна поднимается только там, где бухта открывается в залив.'],
      ] },
      { h: ['A cruising harbour with a long past', 'Гавань для походов с долгой историей'], p: [
        ['People have sailed these bays since antiquity. This is the edge of ancient Lycia, and ruins stand at the water: the half-sunken walls known as Cleopatra’s Baths in one bay, the remains of old buildings on Tersane Island, whose name means shipyard. Today the bays are anchorages for gulets and yachts, many lying stern-to with a line ashore to a pine.',
          'По этим бухтам ходят под парусом с античных времён. Здесь край древней Ликии, и руины стоят у самой воды: полузатопленные стены, известные как «бани Клеопатры», в одной из бухт, остатки построек на острове Терсане, название которого значит «верфь». Сегодня бухты — стоянки для гулетов и яхт, многие из которых стоят кормой к берегу, заведя конец на сосну.'],
        ['Göcek is a cruising harbour first, and most of its racing is club and charter-fleet regattas sailed among the islands. The marinas are close to Dalaman airport, which makes it an easy place to fly in, charter a boat and race.',
          'Гёчек прежде всего гавань для походов, и гонки здесь — это в основном клубные и чартерные регаты среди островов. Марины недалеко от аэропорта Даламан, так что сюда легко прилететь, взять яхту в чартер и выйти на гонку.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Watch the hills. The breeze comes down off them in gusts you can see as dark patches on the water, and near a high shore it bends to follow the coast. Upwind, sail into the patches and tack when you are headed; don’t sail deep into an island’s lee, where the wind can stop altogether.',
          'Смотри на холмы. Ветер срывается с них порывами, которые видны на воде тёмными пятнами, а у высокого берега он поворачивает вдоль него. В лавировке иди в пятна и поворачивай на заходах; не уходи глубоко в тень острова, где ветер может пропасть совсем.'],
        ['Between two islands the wind blows harder, but it also turns to follow the gap, so it can be a lift on one tack and a header on the other. Late in the afternoon, as the breeze fades, the boat still in pressure wins: keep away from the high shore, where it usually goes first.',
          'Между двумя островами ветер сильнее, но он и поворачивает вдоль прохода, так что на одном галсе может дать отход, а на другом — заход. Под вечер, когда бриз слабеет, выигрывает тот, кто ещё в ветре: держись подальше от высокого берега, под которым он обычно пропадает первым.'],
      ] },
    ],
  },

  cowes: {
    title: ['Sailing in Cowes: the Solent and Cowes Week', 'Парусный спорт в Каусе: Солент и Неделя Каус'],
    description: [
      'Sailing at Cowes: the Solent’s tides, Cowes Week and the Round the Island Race, how to race there – and race it free in a 3D sailing game.',
      'Каус: приливы Солента, Неделя Каус и гонка вокруг острова Уайт, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Cowes stands at the mouth of the River Medina on the north coast of the Isle of Wight, looking across the Solent to the mainland. It has been a centre of yacht racing for two centuries: the guns for its starts are fired from the Royal Yacht Squadron’s castle on the waterfront, and in summer the town fills with crews.',
      'Каус стоит в устье реки Медина на северном берегу острова Уайт, напротив материка через пролив Солент. Уже два века это один из центров парусных гонок: пушечные сигналы стартов дают из замка Королевской яхтенной эскадры на набережной, а летом город заполняют экипажи.',
    ],
    sections: [
      { h: ['Tides in the Solent', 'Приливы Солента'], p: [
        ['The Solent is a strait between the island and the mainland, and its tidal streams decide most races. The flood runs east and the ebb west, at a few knots off Cowes at springs and harder at the narrow western end. Around Southampton high water stands for a long time or comes twice, so the stream turns when a newcomer doesn’t expect it.',
          'Солент — пролив между островом и материком, и большинство гонок здесь решают приливные течения. Прилив идёт на восток, отлив — на запад; в сизигию у Кауса течение доходит до нескольких узлов, а в узкой западной части оно ещё сильнее. У Саутгемптона полная вода стоит долго или приходит дважды, так что течение меняется не тогда, когда ждёт новичок.'],
        ['The prevailing wind is from the south-west. With the wind against the tide the Solent kicks up a short, steep chop; with wind and tide together the water is flat and the course goes by fast. In the middle of the strait lies the Bramble Bank, which dries at low water springs and has caught many a yacht.',
          'Преобладающий ветер — юго-западный. Когда ветер против течения, Солент поднимает короткую крутую волну; когда ветер и течение в одну сторону, вода ровная и дистанция проходится быстро. Посреди пролива лежит банка Брамбл, которая в сизигийный отлив обсыхает и посадила на мель немало яхт.'],
      ] },
      { h: ['Cowes Week and the America’s Cup', 'Неделя Каус и Кубок «Америка»'], p: [
        ['Cowes Week, held every summer since 1826, is one of the oldest regattas in the world: hundreds of boats in dozens of classes race every day for a week, many starting from the Squadron’s line. In 1851 the Squadron ran a race round the Isle of Wight that the schooner America won; the cup she took home became the America’s Cup.',
          'Неделя Каус, которая проходит каждое лето с 1826 года, — одна из старейших регат мира: неделю подряд сотни лодок в десятках классов каждый день гоняются в Соленте, многие стартуют с линии Эскадры. В 1851 году Эскадра провела гонку вокруг острова Уайт, которую выиграла шхуна «Америка»; кубок, который она увезла, стал Кубком «Америка».'],
        ['Cowes is also the start of the Round the Island Race, which usually takes more than a thousand boats round the Isle of Wight in a day, and of the Fastnet Race, offshore to the Fastnet Rock off the south coast of Ireland.',
          'Из Кауса стартует и гонка вокруг острова Уайт — за один день вокруг него обычно обходят больше тысячи лодок, — и Фастнет, океанская гонка к скале Фастнет у южного берега Ирландии.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Know the tide before you start. With the stream against you, get out of it: short-tack along the shore, where it runs weakest and sometimes turns back on itself. With the stream under you, stay in the deep water in the middle, where it runs hardest. When it is about to turn, be where it turns first, which is usually close inshore.',
          'Знай прилив до старта. Если течение против тебя, уходи из него: лавируй короткими галсами вдоль берега, где оно слабее всего, а порой идёт и в обратную сторону. Если течение попутное, держись глубокой воды посередине, где оно сильнее. Перед сменой течения будь там, где оно меняется раньше, — обычно у самого берега.'],
        ['The tide moves the laylines too. In a cross-tide the layline to a windward mark is not where it looks: tack for it later when the stream sets you away from the mark, earlier when it carries you towards it. And keep clear of the ships: container ships and liners use the Solent to reach Southampton, and they cannot stop.',
          'Течение сдвигает и лейлайны. При боковом течении лейлайн к верхнему знаку не там, где кажется: если течение сносит тебя от знака, поворачивай позже, если несёт к нему — раньше. И держись подальше от судов: контейнеровозы и круизные лайнеры идут Солентом в Саутгемптон и остановиться не могут.'],
      ] },
    ],
  },

  newport: {
    title: ['Sailing in Newport: the America’s Cup’s old home', 'Парусный спорт в Ньюпорте: старый дом Кубка «Америка»'],
    description: [
      'Sailing in Newport: the summer sou’wester, the bay’s currents, the America’s Cup years, how to race there – and race it free in a 3D sailing game.',
      'Ньюпорт, Род-Айленд: летний зюйд-вест, течения залива, годы Кубка «Америка», как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Newport, Rhode Island, sits at the mouth of Narragansett Bay, on an island open to the Atlantic. For more than half a century it held the America’s Cup, and it is still one of the busiest racing harbours in the United States, its waterfront lined with yards, yacht clubs and the moorings of classic yachts.',
      'Ньюпорт, штат Род-Айленд, стоит у входа в залив Наррагансетт, на острове, открытом Атлантике. Больше полувека здесь разыгрывался Кубок «Америка», и до сих пор это одна из самых оживлённых гоночных гаваней США: вдоль набережной — верфи, яхт-клубы и стоянки классических яхт.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The summer wind is the sea breeze from the south-west, known locally as the smoky sou’wester. It usually fills in around midday and builds through the afternoon, often to a fresh breeze, pushing up a short sea over the Atlantic swell. Fog is common in early summer, when warm air comes over the cold water.',
          'Летний ветер здесь — морской бриз с юго-запада, который местные зовут «дымчатым зюйд-вестом». Обычно он устанавливается около полудня и усиливается к вечеру, часто до свежего, и поднимает короткую волну поверх атлантической зыби. В начале лета часты туманы, когда тёплый воздух приходит на холодную воду.'],
        ['The tide range is modest, but the current runs in and out of the bay through the passages either side of Conanicut Island. Off Newport, in the East Passage, the flood runs north into the bay and the ebb south to the sea; it is strongest in the deep channel and weakest along the rocky shore.',
          'Амплитуда прилива невелика, но течение входит в залив и выходит из него через проходы по обе стороны острова Конаникат. У Ньюпорта, в Восточном проходе, прилив идёт на север, в залив, а отлив — на юг, в море; сильнее всего течение на глубоком фарватере, слабее всего — вдоль скалистого берега.'],
      ] },
      { h: ['The America’s Cup years', 'Годы Кубка «Америка»'], p: [
        ['The New York Yacht Club defended the America’s Cup off Newport from 1930 to 1983, first in the big J-Class yachts and, after the war, in 12 Metres, racing in open water outside the bay. In 1983 Australia II, with her winged keel, won the deciding race, and the Cup left the club for the first time since 1851.',
          'Нью-Йоркский яхт-клуб защищал Кубок «Америка» у Ньюпорта с 1930 по 1983 год — сначала на больших яхтах класса J, а после войны на «двенадцатиметровиках», на открытой воде за пределами залива. В 1983 году «Австралия II» с её крылатым килем выиграла решающую гонку, и Кубок впервые с 1851 года покинул клуб.'],
        ['Newport is also the start of the Newport Bermuda Race, sailed every two years, which takes the offshore fleet across the Gulf Stream to Bermuda. Through the summer the harbour holds regattas for classic yachts, 12 Metres and one-designs.',
          'Из Ньюпорта стартует и гонка Ньюпорт – Бермуды, которая проходит раз в два года: океанский флот пересекает Гольфстрим до Бермудских островов. Всё лето в гавани идут регаты классических яхт, «двенадцатиметровиков» и монотипов.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Plan for the sea breeze. In the morning the wind may be light and from another direction; when the sou’wester fills, it often reaches one side of the course first, and the boats that get to it first gain a lot. Once it is in, it tends to be steady, and the race becomes one of speed and of the current.',
          'Рассчитывай на бриз. Утром ветер бывает слабым и с другого направления; когда приходит зюйд-вест, он часто появляется сначала на одной стороне дистанции, и те, кто попадёт в него первым, много выигрывают. Когда он установился, он обычно ровный, и гонка становится гонкой скорости и течения.'],
        ['Inside the bay, use the current. With the flood against you on the beat, stay near the shore where it runs weakest; with the ebb under you, sail the channel. Keep an eye on the rocks off Castle Hill and Brenton Point, and on the ferries and moorings at the harbour mouth.',
          'В заливе используй течение. Если в лавировке тебе навстречу прилив, держись у берега, где он слабее; если отлив попутный — иди фарватером. Следи за камнями у Касл-Хилла и мыса Брентон, за паромами и стоянками у входа в гавань.'],
      ] },
    ],
  },

  sydney: {
    title: ['Sailing in Sydney: the harbour and the Hobart', 'Парусный спорт в Сиднее: гавань и гонка в Хобарт'],
    description: [
      'Sailing on Sydney Harbour: the nor’easter, the southerly buster, the Hobart start, how to race there – and race it free in a 3D sailing game.',
      'Сиднейская гавань: «нор-истер», южный шквал, старт гонки в Хобарт, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Sydney Harbour, Port Jackson, winds inland from the Heads between sandstone headlands, bays and beaches, with the Harbour Bridge and the Opera House at its heart. It is one of the busiest sailing harbours anywhere: weekend racing, skiffs, ferries criss-crossing it, and every Boxing Day the start of the race to Hobart.',
      'Сиднейская гавань, Порт-Джексон, уходит вглубь суши от мысов Хедс между песчаниковыми мысами, бухтами и пляжами, а в её сердце — мост Харбор-Бридж и Оперный театр. Это одна из самых оживлённых парусных гаваней мира: гонки по выходным, скифы, паромы во всех направлениях, а каждый год 26 декабря — старт гонки в Хобарт.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the usual afternoon wind is the north-easterly sea breeze, the nor’easter, which comes in through the Heads and builds through the afternoon. On a hot day it can end suddenly in a southerly buster: a change from the south, often marked by a long roll of cloud, that swings the wind round, brings a sharp rise in strength and drops the temperature.',
          'Летом обычный дневной ветер — северо-восточный морской бриз, «нор-истер»: он входит в гавань через Хедс и усиливается к вечеру. В жаркий день он может оборваться «южным бастером» — резкой сменой ветра на южный, которую часто видно по длинному валу облаков: ветер разворачивается, резко усиливается, и становится холоднее.'],
        ['The tide range is moderate and the stream in the harbour mostly gentle, strongest near the Heads and in the narrows. The real complication is the land: the harbour twists between high headlands, and every point and bay bends the wind or blocks it. Swell from the Tasman Sea rolls in through the Heads.',
          'Амплитуда прилива умеренная, и течение в гавани в основном слабое, сильнее всего у Хедс и в узкостях. Главная сложность — берег: гавань петляет между высокими мысами, и каждый мыс и каждая бухта искривляют ветер или закрывают его. Через Хедс заходит зыбь из Тасманова моря.'],
      ] },
      { h: ['The Hobart and the skiffs', 'Гонка в Хобарт и скифы'], p: [
        ['The Sydney Hobart Yacht Race, run by the Cruising Yacht Club of Australia, starts in the harbour every 26 December. It was first sailed in 1945, and its 628 nautical miles down the coast and across Bass Strait have a hard reputation.',
          'Гонка Сидней – Хобарт, которую проводит Крейсерский яхт-клуб Австралии, стартует в гавани каждый год 26 декабря. Впервые её прошли в 1945 году, и её 628 морских миль вдоль побережья и через Бассов пролив пользуются суровой славой.'],
        ['The harbour has boats of its own too. The 18-foot skiffs, open boats with huge rigs and big crews, have raced here for more than a century and still sail on summer weekends. Sydney also held the sailing of the 2000 Olympic Games, on the harbour and offshore outside the Heads.',
          'Есть у гавани и свои лодки. 18-футовые скифы — открытые лодки с огромным парусным вооружением и большими экипажами — гоняются здесь больше века и до сих пор выходят на гонки летними выходными. В Сиднее прошла и парусная регата Олимпиады 2000 года — в гавани и в открытом море за Хедс.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Read the shore. In the nor’easter the wind bends round the headlands and is lighter in the bays; on a beat, the side with more pressure or a lift off a point usually pays more than the stream does. Expect big, sudden shifts close to high ground, and use them: tack when you are headed.',
          'Читай берег. При «нор-истере» ветер огибает мысы и в бухтах слабее; в лавировке сторона, где больше ветра или где мыс даёт отход, обычно приносит больше, чем течение. У высокого берега жди больших и резких сдвигов ветра и используй их: поворачивай на заходе.'],
        ['On a hot day, watch the sky in the late afternoon. When the roll cloud of a southerly appears, reef or change down early and be ready for the new wind to come from the far side of the course. Give the ferries a wide berth: they keep to their timetables and their courses.',
          'В жаркий день под вечер следи за небом. Когда появится вал облаков южного шквала, бери рифы или меняй паруса заранее и будь готов, что новый ветер придёт с другой стороны дистанции. Обходи паромы с запасом: они держатся своего расписания и своего курса.'],
      ] },
    ],
  },

  kiel: {
    title: ['Sailing in Kiel: the fjord and Kiel Week', 'Парусный спорт в Киле: фьорд и Кильская неделя'],
    description: [
      'Sailing in Kiel: the westerly off the land, a sea without tide, Kiel Week and the Olympics, how to race there – and race it free in a 3D sailing game.',
      'Киль: западный ветер с берега, море без прилива, Кильская неделя, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Kiel lies at the head of a long Baltic inlet on Germany’s northern coast, the Kieler Förde. Its outer waters, between the Olympic harbour at Schilksee on the western shore and Laboe on the eastern, are some of the most raced in Europe, and every June the city holds Kiel Week, one of the largest sailing events in the world.',
      'Киль стоит в вершине длинного балтийского залива на севере Германии — Кильского фьорда. Его внешняя часть, между олимпийской гаванью Шильксе на западном берегу и Лабё на восточном, — одна из самых гоночных акваторий Европы, а каждый июнь город проводит Кильскую неделю, одно из крупнейших парусных событий мира.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind is westerly, and over the race areas off Schilksee it blows off the land. That makes it shifty and gusty near the western shore and steadier further out in the bay. In settled summer weather a sea breeze can set in instead, and fronts crossing the Baltic bring quick changes of direction and strength.',
          'Преобладающий ветер — западный, и над гоночными полями у Шильксе он дует с берега. Поэтому у западного берега он неустойчивый и порывистый, а дальше в заливе — ровнее. В устойчивую летнюю погоду вместо него может установиться морской бриз, а фронты, проходящие над Балтикой, быстро меняют и направление, и силу ветра.'],
        ['The Baltic has almost no tide, so there is no tidal stream to plan for. Days of strong wind can raise or lower the water and set up a weak current, but in most races the wind alone matters. The water is cold early in the season, and in a fresh breeze the sea is short and steep.',
          'На Балтике почти нет прилива, так что приливных течений учитывать не нужно. Несколько дней сильного ветра могут поднять или опустить воду и создать слабое течение, но в большинстве гонок важен только ветер. В начале сезона вода холодная, а на свежем ветре волна короткая и крутая.'],
      ] },
      { h: ['Kiel Week and the Olympics', 'Кильская неделя и Олимпиады'], p: [
        ['Kiel Week began in 1882 as a small regatta and grew into a week of racing for Olympic classes, one-designs and offshore boats, with a summer festival in the city around it. Thousands of sailors take part each year.',
          'Кильская неделя началась в 1882 году как небольшая регата и выросла в неделю гонок олимпийских классов, монотипов и крейсерских яхт, а вокруг неё в городе идёт летний праздник. Каждый год в ней участвуют тысячи гонщиков.'],
        ['Kiel has held the Olympic sailing twice, in 1936 and in 1972, when the Games were in Berlin and Munich; the harbour at Schilksee was built for 1972. At the inner end of the fjord is the entrance to the Kiel Canal, the shortcut from the Baltic to the North Sea, so ships and ferries pass close to the race areas.',
          'Киль дважды принимал олимпийскую парусную регату — в 1936 и в 1972 году, когда Игры проходили в Берлине и Мюнхене; гавань Шильксе построили к 1972 году. В глубине фьорда — вход в Кильский канал, короткий путь с Балтики в Северное море, так что рядом с гоночными полями проходят суда и паромы.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In the westerly off the land, play the shifts. The gusts come off the shore in patches, each with its own direction, so look upwind for them and sail to the pressure. Near the shore the shifts are bigger and come more often; further out they are fewer and last longer.',
          'При западном ветре с берега играй на сдвигах. Порывы приходят с берега пятнами, у каждого своё направление, так что смотри на ветер и иди туда, где его больше. У берега сдвиги больше и чаще, дальше от берега — реже, но держатся дольше.'],
        ['With no tide to think about, the race is decided by the wind and by boat handling, and the fleets are often large and close. Get a clean start with space to leeward, and on a short course stay near the middle until you know which way the wind is shifting.',
          'Раз о приливе думать не нужно, гонку решают ветер и работа с лодкой, а флоты здесь часто большие и плотные. Возьми чистый старт со свободным местом под ветром, а на короткой дистанции держись середины, пока не поймёшь, куда смещается ветер.'],
      ] },
    ],
  },

  trieste: {
    title: ['Sailing in Trieste: the bora and the Barcolana', 'Парусный спорт в Триесте: бора и Барколана'],
    description: [
      'Sailing in Trieste: the bora off the Karst, the gulf’s summer breeze, the Barcolana regatta, how to race there – and race it free in a 3D sailing game.',
      'Триест: бора с плато Карст, летний бриз залива, регата Барколана, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Trieste looks over a gulf at the northern end of the Adriatic, below the edge of the Karst plateau, which rises steeply behind the city. The gulf is known for two things: the bora, a cold wind that pours down off the Karst, and the Barcolana, the autumn regatta that fills it with sails.',
      'Триест смотрит на залив в северной части Адриатики, под краем плато Карст, которое круто поднимается за городом. Залив известен двумя вещами: борой — холодным ветром, который обрушивается с Карста, — и Барколаной, осенней регатой, которая заполняет его парусами.',
    ],
    sections: [
      { h: ['The bora and the gulf', 'Бора и залив'], p: [
        ['The bora blows from the north-east, off the land, when cold air on the plateau spills down to the sea. It comes in violent gusts, strongest where it pours through gaps in the hills, and it can arrive suddenly, above all in winter. Off the city the water stays fairly flat, but the gusts hit hard and keep changing direction.',
          'Бора дует с северо-востока, с берега, когда холодный воздух с плато стекает к морю. Она приходит яростными порывами, сильнее всего там, где прорывается через разрывы в холмах, и может налететь внезапно, особенно зимой. У города вода остаётся довольно ровной, но порывы бьют сильно и всё время меняют направление.'],
        ['In summer the bora is rarer, and the usual pattern is a calm morning followed by a sea breeze off the open gulf in the afternoon. The northern Adriatic has more tide than most of the Mediterranean, but in the gulf it is too small to make much of a current.',
          'Летом бора бывает реже, и обычно за штилевым утром приходит дневной морской бриз с открытой части залива. В северной Адриатике прилив больше, чем в большей части Средиземного моря, но в заливе он слишком мал, чтобы создать заметное течение.'],
      ] },
      { h: ['The Barcolana', 'Барколана'], p: [
        ['The Barcolana is sailed on the second Sunday of October and is named after Barcola, the waterfront district where it began in 1969. It has grown into one of the largest regattas in the world: well over a thousand boats, from small cruisers to maxis, start together on one long line between Barcola and Miramare Castle. In 2018 Guinness World Records named it the largest sailing race.',
          'Барколана проходит во второе воскресенье октября и названа по Барколе — прибрежному району, где она началась в 1969 году. Она выросла в одну из крупнейших регат мира: больше тысячи лодок, от небольших крейсерских яхт до макси, стартуют вместе с одной длинной линии между Барколой и замком Мирамаре. В 2018 году Книга рекордов Гиннесса признала её самой массовой парусной гонкой.'],
        ['The course is a loop round the gulf, finishing off the city, and the wind on the day decides everything: some years a bora sends the big boats round at speed, in others the fleet drifts in a light breeze.',
          'Дистанция — круг по заливу с финишем напротив города, и всё решает ветер этого дня: в одни годы бора проносит большие лодки по дистанции на огромной скорости, в другие флот дрейфует в слабом ветре.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a bora, reef early and be ready for the gusts. They hit hard and lift or head you a long way, so ease the sheets and keep the boat flat through them rather than fighting to point. The strongest gusts come where the wind funnels down the valleys; between them the sailing is easier, if lighter.',
          'В бору бери рифы заранее и будь готов к порывам. Они бьют сильно и дают большой заход или отход, так что в порыве потравливай шкоты и держи лодку ровно, а не борись за высоту. Сильнее всего дует там, где ветер скатывается по долинам; между ними идти проще, хоть и слабее.'],
        ['In a crowded start, as at the Barcolana, a clear lane matters more than the perfect spot on the line. In the light airs of a calm autumn day, keep the boat moving, look for the darker water of new breeze and sail to it, and stay out of the wind shadow of the big yachts.',
          'На многолюдном старте, как у Барколаны, чистый коридор важнее идеального места на линии. В слабый ветер тихого осеннего дня держи лодку в движении, ищи тёмную воду нового ветра и иди к ней, и не попадай в ветровую тень больших яхт.'],
      ] },
    ],
  },

  'porto-cervo': {
    title: ['Sailing in Porto Cervo: the maxis and the mistral', 'Парусный спорт в Порто-Черво: макси и мистраль'],
    description: [
      'Sailing at Porto Cervo, Sardinia: the mistral, granite islands and shoals, the maxi regattas, how to race there – and race it free in a 3D sailing game.',
      'Порто-Черво, Сардиния: мистраль, гранитные острова и мели, регаты макси, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Porto Cervo is the harbour of the Costa Smeralda in north-east Sardinia, a coast of weathered granite, sheltered coves and very clear water. The resort was built from the 1960s, and its yacht club has made it one of the Mediterranean’s main venues for big-boat racing.',
      'Порто-Черво — гавань Коста-Смеральды на северо-востоке Сардинии, побережья выветренного гранита, укрытых бухт и очень прозрачной воды. Курорт строили с 1960-х годов, и местный яхт-клуб сделал его одним из главных мест гонок больших яхт в Средиземном море.',
    ],
    sections: [
      { h: ['The mistral and the islands', 'Мистраль и острова'], p: [
        ['The strongest and most common wind is the mistral, the maestrale, from the north-west. It funnels through the Strait of Bonifacio between Sardinia and Corsica and can blow fresh to strong for days, with a steep sea offshore. On days without it, a lighter sea breeze often fills in during the afternoon.',
          'Самый сильный и самый частый ветер — мистраль, маэстрале, с северо-запада. Он усиливается в проливе Бонифачо между Сардинией и Корсикой и может дуть свежо и сильно по нескольку дней, поднимая в открытом море крутую волну. В дни без него после полудня часто устанавливается более слабый морской бриз.'],
        ['There is almost no tide, but the coast is full of hazards: granite rocks, islets and shoals lie off every headland, and the islands of the La Maddalena archipelago are close by to the north. The wind bends and speeds up round the islands and through the channels between them.',
          'Прилива почти нет, зато берег полон опасностей: у каждого мыса — гранитные камни, островки и мели, а совсем рядом к северу лежат острова архипелага Ла-Маддалена. Ветер огибает острова и разгоняется в проливах между ними.'],
      ] },
      { h: ['The Yacht Club Costa Smeralda', 'Яхт-клуб Коста-Смеральда'], p: [
        ['The Yacht Club Costa Smeralda was founded in 1967, with the Aga Khan, who developed the coast, among its founders. Its regattas draw some of the largest racing yachts: the Maxi Yacht Rolex Cup each September brings the maxis and supermaxis, and the Rolex Swan Cup the Swan fleet, from small classics to the largest modern Swans. In 1983 the club challenged for the America’s Cup with Azzurra.',
          'Яхт-клуб Коста-Смеральда основан в 1967 году, и среди его основателей был Ага-хан, который и застроил это побережье. Его регаты собирают одни из крупнейших гоночных яхт: Maxi Yacht Rolex Cup каждый сентябрь — макси и супермакси, Rolex Swan Cup — флот «Свонов», от небольших классических до самых больших современных. В 1983 году клуб бросил вызов за Кубок «Америка» с яхтой «Аццурра».'],
        ['Most of the racing is on coastal courses that wind among the islands and headlands rather than simple windward-leeward loops, so local knowledge counts for a lot.',
          'Большинство гонок проходит на прибрежных дистанциях, которые петляют между островами и мысами, а не по простой схеме «вверх – вниз», так что знание акватории значит очень много.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In the mistral the gusts come off the land and down the gaps between the hills, and the wind bends round each island. Look at the water for the pressure, reef before the strongest of it, and expect the wind to be stronger in the channels and lighter in the lee of the islands.',
          'В мистраль порывы приходят с берега и по разрывам между холмами, а ветер огибает каждый остров. Ищи ветер по воде, бери рифы до самых сильных порывов и жди, что в проливах ветер сильнее, а за островами — слабее.'],
        ['Know the chart. Many courses pass close to rocks and shoals, and the shortest way round an island often runs right beside one. In a light sea breeze, look for where it fills first, usually from the open sea, and get to it before the fleet.',
          'Знай карту. Многие дистанции проходят рядом с камнями и мелями, и кратчайший путь вокруг острова часто идёт прямо возле них. В слабый морской бриз ищи, где он приходит первым — обычно со стороны открытого моря, — и успей туда раньше флота.'],
      ] },
    ],
  },

  'saint-tropez': {
    title: ['Sailing in Saint-Tropez: Les Voiles and the gulf', 'Парусный спорт в Сен-Тропе: Les Voiles и залив'],
    description: [
      'Sailing in Saint-Tropez: the mistral and the easterly in the gulf, Les Voiles de Saint-Tropez, how to race there – and race it free in a 3D sailing game.',
      'Сен-Тропе: мистраль и восточный ветер, регата Les Voiles de Saint-Tropez, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Saint-Tropez is an old fishing port on the south shore of a gulf on the Côte d’Azur, facing Sainte-Maxime across the water. The gulf opens east to the open Mediterranean, and every autumn it is the stage for Les Voiles de Saint-Tropez, where classic and modern yachts race side by side.',
      'Сен-Тропе — старый рыбацкий порт на южном берегу залива на Лазурном берегу, напротив Сент-Максима. Залив открывается на восток, в открытое Средиземное море, и каждую осень здесь проходит Les Voiles de Saint-Tropez, где классические и современные яхты гоняются бок о бок.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The strongest wind is the mistral, which reaches the gulf as a westerly blowing off the land. It is gusty near the shore, and the water inside the gulf stays fairly flat, while outside, off the capes, the wind and the sea build. On quieter summer days a sea breeze comes in from the sea in the afternoon.',
          'Самый сильный ветер — мистраль, который приходит в залив западным ветром с берега. У берега он порывистый, а вода в заливе остаётся довольно ровной; снаружи, у мысов, ветер и волна растут. В тихие летние дни после полудня с моря приходит морской бриз.'],
        ['An easterly is the other wind to know: it blows straight into the gulf from the open sea and brings swell with it, often with cloud. There is no tide to speak of. Courses run inside the gulf and out along the coast to the south, past the capes and the shoals off them.',
          'Второй ветер, который нужно знать, — восточный: он дует прямо в залив с открытого моря и приносит зыбь, часто вместе с облачностью. Прилива практически нет. Дистанции ставят в заливе и вдоль побережья к югу, мимо мысов и мелей у них.'],
      ] },
      { h: ['From La Nioulargue to Les Voiles', 'От «Ньюларг» до Les Voiles'], p: [
        ['The regatta began in 1981 as a challenge between two yachts to race out to a shoal off the coast called La Nioulargue and back. It grew into the Nioulargue regatta and in 1999 became Les Voiles de Saint-Tropez, run by the Société Nautique de Saint-Tropez at the end of September and the start of October.',
          'Регата началась в 1981 году с вызова между двумя яхтами — сходить наперегонки до мели у побережья под названием Ньюларг и обратно. Из этого выросла регата «Ньюларг», а в 1999 году она стала Les Voiles de Saint-Tropez, которую проводит Société Nautique de Saint-Tropez в конце сентября — начале октября.'],
        ['Today it brings together hundreds of yachts: gaff cutters and schooners a century old, classic 12 Metres and modern racing maxis, moored along the old port between races. The Rolex Giraglia has also started from Saint-Tropez in recent years, with inshore races before the offshore race round the Giraglia rock off Corsica.',
          'Сегодня она собирает сотни яхт: гафельные тендеры и шхуны вековой давности, классические «двенадцатиметровики» и современные гоночные макси, которые между гонками стоят вдоль старого порта. В последние годы из Сен-Тропе стартует и Rolex Giraglia: сначала прибрежные гонки, затем морская гонка вокруг скалы Джиралья у Корсики.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In the westerly the wind is off the land: expect big shifts and gusts close to the shore and a steadier wind in the middle of the gulf. Upwind, watch for the gusts coming down off the hills and sail into them; downwind, link the patches of pressure rather than sailing the straight line.',
          'При западном ветре он дует с берега: у берега жди больших сдвигов и порывов, а в середине залива — более ровного ветра. В лавировке следи за порывами, скатывающимися с холмов, и иди в них; на попутном соединяй пятна ветра, а не иди по прямой.'],
        ['The fleets are mixed, from slow classics to fast modern boats, and the starts and marks can be crowded with yachts of very different size and speed. Keep a good lookout, give the big boats room and know the rules: a large classic under sail cannot turn quickly.',
          'Флоты здесь смешанные, от медленной классики до быстрых современных лодок, и на старте и у знаков бывает тесно от яхт самого разного размера и скорости. Внимательно смотри по сторонам, оставляй большим лодкам место и знай правила: большая классическая яхта под парусами не может быстро повернуть.'],
      ] },
    ],
  },

  antigua: {
    title: ['Sailing in Antigua: trade winds and Sailing Week', 'Парусный спорт на Антигуа: пассат и Неделя парусного спорта'],
    description: [
      'Sailing in Antigua: the trade wind, squalls and current, Antigua Sailing Week, how to race there – and race it free in a 3D sailing game.',
      'Антигуа: пассат, шквалы и течение, Неделя парусного спорта, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Antigua is a small island in the Leeward Islands of the eastern Caribbean, ringed with reefs and bays. Its south coast holds two of the region’s best-known yacht harbours, English Harbour and Falmouth Harbour, side by side, and in winter and spring the island is a centre of Caribbean racing.',
      'Антигуа — небольшой остров из Подветренных островов на востоке Карибского моря, окружённый рифами и бухтами. На его южном берегу бок о бок стоят две самые известные яхтенные гавани региона, Инглиш-Харбор и Фалмут-Харбор, а зимой и весной остров становится центром карибских гонок.',
    ],
    sections: [
      { h: ['The trade wind', 'Пассат'], p: [
        ['The wind is the trade wind, blowing from the east, usually between north-east and south-east, and it seldom stops. In the winter season it is often fresh and at times strong; by late spring it tends to ease a little. Squalls pass through with dark cloud and rain, bringing a short burst of stronger wind and a shift, and often a lull behind them.',
          'Ветер здесь — пассат, он дует с востока, обычно между северо-востоком и юго-востоком, и стихает редко. В зимний сезон он часто свежий, а временами сильный; к концу весны обычно немного слабеет. Через остров проходят шквалы с тёмными тучами и дождём: короткий удар сильного ветра со сдвигом, а за ним часто затишье.'],
        ['The tide range is small, but a westward current runs past the island with the general flow of the Caribbean, and the Atlantic swell comes in from the east. Close to the south coast the hills bend the wind and shelter the water; offshore the sea is open and lumpy.',
          'Амплитуда прилива мала, но мимо острова на запад идёт течение — часть общего потока Карибского моря, а с востока приходит атлантическая зыбь. У южного берега холмы искривляют ветер и прикрывают воду; мористее море открытое и неспокойное.'],
      ] },
      { h: ['Sailing Week and the classics', 'Неделя парусного спорта и классика'], p: [
        ['Antigua Sailing Week, first held in 1968, is one of the Caribbean’s oldest and best-known regattas, racing off the south and west coasts in late April or early May. Just before it, the Antigua Classic Yacht Regatta brings schooners, gaff cutters and other traditional yachts.',
          'Неделя парусного спорта на Антигуа, впервые прошедшая в 1968 году, — одна из старейших и самых известных регат Карибского моря; гонки идут у южного и западного берегов в конце апреля или начале мая. Прямо перед ней проходит регата классических яхт, которая собирает шхуны, гафельные тендеры и другие традиционные яхты.'],
        ['English Harbour was the Royal Navy’s base in the eastern Caribbean in the eighteenth century, and its restored Georgian dockyard, Nelson’s Dockyard, is a World Heritage Site. The RORC Caribbean 600, an offshore race round eleven islands, starts and finishes in Antigua each February.',
          'Инглиш-Харбор в XVIII веке был базой Королевского флота на востоке Карибского моря, а его восстановленная георгианская верфь, верфь Нельсона, входит в список Всемирного наследия. Каждый февраль на Антигуа стартует и финиширует RORC Caribbean 600 — морская гонка вокруг одиннадцати островов.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['The trade wind is steady in direction, so races are won more by speed, boat handling and the squalls than by small shifts. Watch the clouds upwind: a squall brings pressure and usually a shift, and being on the right side of it can gain you a lot.',
          'Пассат устойчив по направлению, так что гонки выигрывают скорее скоростью, работой с лодкой и шквалами, чем мелкими сдвигами. Следи за тучами на ветре: шквал приносит ветер и обычно сдвиг, и правильная сторона шквала может дать очень много.'],
        ['Allow for the current. It runs with the wind, from east to west, so on a beat it sets you back: the layline to a windward mark is further out than it looks, and on the run it carries you down. Near the coast, look for the wind bending round the headlands and for the lighter wind under the hills.',
          'Учитывай течение. Оно идёт по ветру, с востока на запад, так что в лавировке сносит тебя назад: лейлайн к верхнему знаку дальше, чем кажется, а на попутном течение несёт тебя вниз. У берега ищи, где ветер огибает мысы, и помни, что под холмами он слабее.'],
      ] },
    ],
  },

  auckland: {
    title: ['Sailing in Auckland: the City of Sails', 'Парусный спорт в Окленде: город парусов'],
    description: [
      'Sailing in Auckland: the harbour’s tides and winds, the America’s Cup, the Anniversary Regatta, how to race there – and race it free in a 3D sailing game.',
      'Окленд: приливы и ветры гавани, Кубок «Америка» и регата Дня основания, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Auckland is built round the Waitematā Harbour, which opens east into the Hauraki Gulf past the volcanic island of Rangitoto. It calls itself the City of Sails: sailing is part of everyday life there, the harbour fills with boats at weekends, and New Zealand has produced many of the sport’s leading sailors and designers.',
      'Окленд построен вокруг гавани Уаитемата, которая открывается на восток в залив Хаураки мимо вулканического острова Рангитото. Он называет себя городом парусов: парусный спорт здесь часть повседневной жизни, по выходным гавань заполняется лодками, а Новая Зеландия дала миру многих ведущих гонщиков и конструкторов.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind is from the south-west, and in settled summer weather an afternoon sea breeze often comes in off the gulf from the north-east. The harbour is ringed by low hills, headlands and the North Shore, so the wind shifts and changes strength as it comes over the land.',
          'Преобладающий ветер — юго-западный, а в устойчивую летнюю погоду после полудня с залива часто приходит морской бриз с северо-востока. Гавань окружена невысокими холмами, мысами и Норт-Шором, так что ветер, проходя над сушей, сдвигается и меняет силу.'],
        ['The tides are large, with a range of two or three metres, and the streams in the harbour and its channels can run at a couple of knots. The flood runs in from the gulf, up the harbour, and the ebb runs out; with the wind against the tide, the channel off North Head kicks up a short, steep sea.',
          'Приливы здесь большие, с амплитудой в два-три метра, и течения в гавани и её проливах могут доходить до пары узлов. Прилив входит из залива вверх по гавани, отлив выходит обратно; когда ветер против течения, в проливе у Норт-Хеда поднимается короткая крутая волна.'],
      ] },
      { h: ['The America’s Cup and the regattas', 'Кубок «Америка» и регаты'], p: [
        ['Auckland has hosted the America’s Cup three times. Team New Zealand won the Cup in 1995 and defended it here in 2000; in 2003 it was lost here to Alinghi of Switzerland; and after winning it back in 2017 the team defended it again in Auckland in 2021, in the foiling AC75 monohulls.',
          'Окленд трижды принимал Кубок «Америка». Команда Новой Зеландии выиграла Кубок в 1995 году и защитила его здесь в 2000-м; в 2003-м уступила его здесь швейцарской «Алинги»; а вернув его в 2017 году, снова защитила в Окленде в 2021-м, на летающих однокорпусниках AC75.'],
        ['Older than all of it is the Auckland Anniversary Regatta, sailed every year since 1840, which brings out everything from dinghies to classic keelboats. The harbour has also been a stopover for round-the-world races, and the Coastal Classic, a race north to the Bay of Islands, starts here each spring.',
          'Старше всего этого регата Дня основания Окленда, которая проходит каждый год с 1840 года и собирает всё — от швертботов до классических килевых яхт. Гавань была и стоянкой кругосветных гонок, а каждую весну отсюда стартует Coastal Classic — гонка на север, к заливу Бей-оф-Айлендс.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Plan the race round the tide. With the stream against you, get out of the channel and work the shallower water along the shore and in the bays, where it runs weakest; with it behind you, stay in the deep water where it is strongest. Know when it turns, because the change can reshape a race halfway through.',
          'Строй гонку вокруг прилива. Если течение против тебя, уходи с фарватера и иди по мелководью вдоль берега и в бухтах, где оно слабее; если попутное — держись глубокой воды, где оно сильнее. Знай, когда оно сменится: смена может перевернуть гонку на полпути.'],
        ['Watch for the wind bending round the headlands and off the cliffs, and for the holes in their lee. Showers and fronts crossing the gulf bring big shifts, so keep looking upwind, and keep clear of the ferries running between the city and the North Shore.',
          'Следи, как ветер огибает мысы и обрывы, и за провалами ветра за ними. Дожди и фронты, проходящие над заливом, приносят большие сдвиги, так что всё время смотри на ветер и держись подальше от паромов между городом и Норт-Шором.'],
      ] },
    ],
  },

  'san-francisco': {
    title: ['Sailing in San Francisco: the bay and the Slot', 'Парусный спорт в Сан-Франциско: залив и «Слот»'],
    description: [
      'Sailing on San Francisco Bay: the westerly and the Slot, the Golden Gate’s tides, the 2013 America’s Cup – and race it free in a 3D sailing game.',
      'Залив Сан-Франциско: западный ветер и «Слот», течения Золотых Ворот, Кубок «Америка» 2013 года — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'San Francisco Bay meets the Pacific through the Golden Gate, a narrow strait between high headlands. The water off the city front, between the Golden Gate Bridge, Alcatraz and the Bay Bridge, is known for strong wind and strong currents, and it is raced by everything from dinghies to America’s Cup boats.',
      'Залив Сан-Франциско соединяется с Тихим океаном через Золотые Ворота — узкий пролив между высокими мысами. Вода у городской набережной, между мостом Золотые Ворота, Алькатрасом и мостом Бэй-Бридж, известна сильным ветром и сильными течениями, и гоняются здесь все — от швертботов до яхт Кубка «Америка».',
    ],
    sections: [
      { h: ['Wind and tide at the Golden Gate', 'Ветер и течение у Золотых Ворот'], p: [
        ['The summer wind is a sea breeze from the west, drawn in through the Golden Gate as the land inland heats up. Mornings are often light; by the afternoon it commonly blows twenty knots or more, strongest in the band known as the Slot, which runs from the Gate past Alcatraz towards Berkeley. Fog often pours in through the Gate with it.',
          'Летний ветер — морской бриз с запада, который затягивает через Золотые Ворота, когда суша в глубине материка прогревается. Утром часто слабый ветер; к середине дня обычно дует двадцать узлов и больше, сильнее всего в полосе, которую называют «Слотом»: она тянется от Ворот мимо Алькатраса к Беркли. Вместе с ветром через Ворота часто вползает туман.'],
        ['The tidal currents are strong. The whole bay fills and empties through the Gate, so the flood runs in to the east and the ebb out to the west, at several knots in the Gate itself. When the ebb runs out against the westerly, the sea becomes short and steep.',
          'Приливные течения сильные. Весь залив наполняется и опустошается через Ворота, так что прилив идёт внутрь, на восток, а отлив наружу, на запад, — в самих Воротах со скоростью в несколько узлов. Когда отлив идёт против западного ветра, волна становится короткой и крутой.'],
      ] },
      { h: ['The America’s Cup and the city front', 'Кубок «Америка» и городская набережная'], p: [
        ['In 2013 the America’s Cup was sailed off the city front in AC72s, foiling catamarans. Oracle Team USA, trailing Emirates Team New Zealand 8–1, won eight races in a row to keep the Cup, one of the great comebacks in the sport. The course ran close to the shore, so crowds could watch from the waterfront.',
          'В 2013 году Кубок «Америка» разыграли у городской набережной на AC72 — летающих катамаранах. Oracle Team USA, проигрывая Emirates Team New Zealand со счётом 1:8, выиграла восемь гонок подряд и сохранила Кубок — одно из величайших возвращений в истории спорта. Дистанция шла близко к берегу, и зрители смотрели гонки с набережной.'],
        ['The St. Francis Yacht Club on the city front runs the Rolex Big Boat Series each September, and the bay has large fleets of one-designs and dinghies racing through the year.',
          'Яхт-клуб St. Francis на городской набережной каждый сентябрь проводит Rolex Big Boat Series, а в заливе круглый год гоняются большие флоты монотипов и швертботов.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Know the current before you start; it matters as much as the wind. Beating against the flood, go to the city front, where the stream is weaker and eddies can even help you; with the ebb under you on the beat, sail into the middle, where it runs hardest. Downwind, do the opposite.',
          'Знай течение до старта — оно значит не меньше ветра. В лавировке против прилива иди к городской набережной, где течение слабее, а обратные течения могут даже помочь; если в лавировке отлив попутный, уходи на середину, где он сильнее всего. На попутном — наоборот.'],
        ['Be ready for wind. The breeze builds through the afternoon and is strongest in the Slot, so reef or depower early and take care with gybes in the gusts. Alcatraz casts a shadow in both the wind and the current, and ships use the channels across the bay, so keep a good lookout.',
          'Будь готов к сильному ветру. Бриз усиливается к вечеру и сильнее всего в «Слоте», так что бери рифы или обезветривай паруса заранее и аккуратно делай повороты фордевинд в порывах. Алькатрас даёт тень и по ветру, и по течению, а через залив идут суда по фарватерам, так что внимательно смотри по сторонам.'],
      ] },
    ],
  },

  valencia: {
    title: ['Sailing in Valencia: the sea breeze and the Cup', 'Парусный спорт в Валенсии: бриз и Кубок «Америка»'],
    description: [
      'Sailing in Valencia: the afternoon sea breeze, the poniente, the 2007 and 2010 America’s Cups, how to race there – and race it free in a 3D sailing game.',
      'Валенсия: дневной морской бриз, поньенте, Кубок «Америка» 2007 и 2010 годов, как здесь гоняться — и гоняйся здесь бесплатно в 3D-игре о парусном спорте.',
    ],
    intro: [
      'Valencia sits on a long, straight stretch of Spain’s east coast, with a flat coastal plain behind it and open sea in front. Its old inner harbour was rebuilt as the base for the America’s Cup of 2007, and the summer sea breeze off its beaches makes it a regular venue for racing.',
      'Валенсия стоит на длинном прямом участке восточного побережья Испании: позади — плоская прибрежная равнина, впереди — открытое море. Её старую внутреннюю гавань перестроили под базу Кубка «Америка» 2007 года, а летний морской бриз у её пляжей делает её постоянным местом гонок.',
    ],
    sections: [
      { h: ['The sea breeze', 'Морской бриз'], p: [
        ['In summer the day usually begins with a light wind off the land, from the west or north-west. As the land heats up, a sea breeze sets in from the east to south-east, often by early afternoon, and blows steadily until evening at moderate strength. It often swings a little to the right as the afternoon goes on.',
          'Летом день обычно начинается со слабого ветра с суши, с запада или северо-запада. Когда земля прогревается, с востока или юго-востока устанавливается морской бриз — часто к началу второй половины дня — и ровно дует до вечера, умеренной силы. К вечеру он часто немного заходит вправо.'],
        ['Some days a hot westerly, the poniente, blows off the land instead and holds the sea breeze back. There is no tide to speak of, and the water off the beaches is open and fairly shallow, so the sea breeze raises a short chop.',
          'В некоторые дни вместо него с суши дует горячий западный ветер — поньенте — и не пускает морской бриз. Прилива практически нет, а вода у пляжей открытая и довольно мелкая, так что бриз поднимает короткую волну.'],
      ] },
      { h: ['Two America’s Cups', 'Два Кубка «Америка»'], p: [
        ['In 2007 the Swiss team Alinghi defended the America’s Cup off Valencia against Emirates Team New Zealand, winning 5–2, after the Louis Vuitton Cup sailed there had chosen the challenger. It was the first time the Cup had been raced in Europe since the 1851 race round the Isle of Wight.',
          'В 2007 году швейцарская команда «Алинги» защитила Кубок «Америка» у Валенсии против Emirates Team New Zealand со счётом 5:2 — после того как претендента выбрал проходивший здесь же Кубок Луи Виттона. Впервые с гонки 1851 года вокруг острова Уайт Кубок разыгрывали в Европе.'],
        ['In 2010 Valencia held the Cup again, in a match between two giant multihulls: BMW Oracle Racing’s trimaran, with a rigid wing sail, beat Alinghi’s catamaran and took the Cup to the United States.',
          'В 2010 году Валенсия снова приняла Кубок — в матче двух гигантских многокорпусников: тримаран BMW Oracle Racing с жёстким парусом-крылом победил катамаран «Алинги» и увёз Кубок в США.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the sea breeze, and watch where it comes from. It fills from the sea, so the boats further offshore often get it first. Once it is in it is usually steady, and the race turns on speed and on its slow swing to the right through the afternoon.',
          'Дождись морского бриза и следи, откуда он приходит. Он наполняется с моря, так что лодки мористее часто получают его первыми. Когда он установился, он обычно ровный, и гонку решают скорость и его медленный заход вправо к вечеру.'],
        ['When the wind swings steadily one way, the side it swings towards usually pays: on the beat, sail first towards the side the wind is moving to, so the shift lifts you up to the mark. On the light, shifty days before the sea breeze settles, keep your options open and stay near the middle.',
          'Когда ветер устойчиво смещается в одну сторону, обычно выигрывает та сторона, куда он уходит: в лавировке иди сначала туда, куда смещается ветер, чтобы сдвиг вывел тебя к знаку отходом. В слабые неустойчивые дни, пока бриз не установился, не связывай себя одной стороной и держись середины.'],
      ] },
    ],
  },
};
