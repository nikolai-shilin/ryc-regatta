import type { VenueGuide } from '../venue-guides';
import type { VenueId } from '../venues';

export const PART_3: Partial<Record<VenueId, VenueGuide>> = {
  batumi: {
    title: ['Sailing in Batumi: the Black Sea breeze', 'Яхтинг в Батуми: дневной бриз Чёрного моря'],
    description: [
      'Batumi’s sea breeze, its rain and swell, the Black Sea’s coastal current and how to race there – and race it free in a 3D sailing game.',
      'Морской бриз Батуми, дожди и зыбь, прибрежное течение Чёрного моря и как здесь гоняться – и пройди гонку бесплатно в 3D-игре.',
    ],
    intro: [
      'Batumi sits in the south-eastern corner of the Black Sea, close to the Turkish border, with the mountains of Adjara rising straight behind the town. In summer the sea is warm, the mornings are often still, and a breeze comes in off the water in the afternoon.',
      'Батуми стоит в юго-восточном углу Чёрного моря, недалеко от турецкой границы, и прямо за городом поднимаются горы Аджарии. Летом море тёплое, по утрам часто штиль, а после полудня с моря приходит бриз.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['This is a sea breeze coast. On a typical summer day the land behind the town heats up, and by early afternoon a westerly or north-westerly fills in from the open sea. It is usually moderate, and it fades again towards evening. Batumi is also the wettest city in Georgia: damp air off the sea meets the mountains, and showers and thunderstorms can bring sudden gusts and shifts.',
          'Это берег морского бриза. В обычный летний день суша за городом прогревается, и к началу второй половины дня с открытого моря задувает западный или северо-западный ветер. Обычно он умеренный и к вечеру снова стихает. Ещё Батуми – самый дождливый город Грузии: влажный воздух с моря упирается в горы, и ливни с грозами могут принести внезапные порывы и сдвиги ветра.'],
        ['As everywhere in the Black Sea, there is almost no tide. A weak current runs along the coast, part of the anticlockwise circulation round the sea, and here it sets to the north-east. The shelf is narrow, so the water gets deep close to the shore, and the beaches are grey pebble rather than sand. After a day or two of westerly wind, a long swell rolls into the bay.',
          'Как и везде на Чёрном море, приливов почти нет. Вдоль берега идёт слабое течение – часть кругового течения против часовой стрелки вокруг всего моря, – и здесь оно несёт на северо-восток. Шельф узкий, глубина начинается у самого берега, а пляжи не песчаные, а из серой гальки. После одного-двух дней западного ветра в бухту приходит длинная зыбь.'],
      ] },
      { h: ['Sailing in Batumi', 'Парус в Батуми'], p: [
        ['Batumi is a port town first. Tankers and cargo ships use the harbour on the cape. Sailing here is a modest scene of dinghies, beach catamarans and cruising yachts in the marina, with racing that is mostly local and held in the summer season, when the breeze is most reliable.',
          'Батуми прежде всего портовый город. В порт на мысе заходят танкеры и сухогрузы. Парусный спорт здесь скромный: швертботы, пляжные катамараны и крейсерские яхты в марине, а гонки в основном местные и проходят летом, когда бриз надёжнее всего.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the breeze. On a sea breeze day the first puffs show as dark patches out to sea. Like most sea breezes north of the equator, it tends to veer, turning clockwise, as the afternoon goes on, so the right-hand side of the beat often pays later in the day.',
          'Дождись бриза. В день морского бриза первые порывы видны как тёмные пятна в море. Как большинство морских бризов к северу от экватора, он обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['Under the mountains the wind is less steady. Close to the shore and off the cape it bends and drops, so the steadier breeze is usually further out. Tack on the headers and sail towards the darker water. If a thunderstorm builds over the mountains, expect the wind to change completely: a squall off the land can arrive against the sea breeze within minutes.',
          'Под горами ветер менее устойчив. У берега и у мыса он отклоняется и слабеет, так что ровный бриз обычно дальше в море. Поворачивай на заходах и иди к более тёмной воде. Если над горами собирается гроза, жди, что ветер сменится полностью: шквал с берега может за несколько минут прийти навстречу морскому бризу.'],
      ] },
    ],
  },

  scheveningen: {
    title: ['Sailing in Scheveningen: North Sea tide and surf', 'Яхтинг в Схевенингене: приливы и прибой Северного моря'],
    description: [
      'The North Sea off The Hague: the south-westerly, the tide along the beach, the 2023 worlds and local tactics – and race it free in a 3D sailing game.',
      'Северное море у Гааги: юго-западный ветер, приливное течение вдоль пляжа, чемпионат мира 2023 года и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Scheveningen is The Hague’s seaside: a long, straight beach backed by dunes, the Kurhaus and the pier, and a fishing and yacht harbour at its southern end. There is no bay and no shelter. You sail on the open North Sea, straight off the beach.',
      'Схевенинген – морской район Гааги: длинный прямой пляж, за ним дюны, Курхаус и пирс, а в южном конце – рыбацкая и яхтенная гавань. Ни бухты, ни укрытия здесь нет. Ты выходишь прямо с пляжа в открытое Северное море.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind is from the south-west, blowing along the coast or a little onshore, and it is often fresh. On a warm summer day a sea breeze can add to it in the afternoon. A north-westerly, behind a passing front, blows straight onto the beach and builds a steep sea quickly.',
          'Преобладает юго-западный ветер: он дует вдоль берега или чуть с моря и часто бывает свежим. В тёплый летний день после полудня к нему может добавиться морской бриз. Северо-западный ветер за проходящим фронтом дует прямо на пляж и быстро разводит крутую волну.'],
        ['The North Sea is shallow here, so the waves are short and steep, and they break on the sandbars off the beach. The tide runs along the coast rather than in and out: the flood sets north-east and the ebb south-west, at around a knot, more at springs. The rise and fall is small, usually under two metres.',
          'Северное море здесь мелкое, поэтому волна короткая и крутая и разбивается на песчаных отмелях у пляжа. Приливное течение идёт не к берегу и от берега, а вдоль него: прилив несёт на северо-восток, отлив – на юго-запад, примерно со скоростью узла, в сизигию сильнее. Перепад уровня небольшой, обычно меньше двух метров.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Hague has become one of the North Sea’s big racing venues. The Volvo Ocean Race finished here in 2018, after its last leg from Gothenburg. In 2023 the Sailing World Championships, the first big qualifier for the Paris Olympics, were raced off the beach, with all the Olympic classes on courses in front of the town. Each spring the North Sea Regatta fills Scheveningen harbour with offshore boats and one-designs.',
          'Гаага стала одной из главных гоночных площадок Северного моря. Здесь в 2018 году финишировала Volvo Ocean Race – после последнего этапа из Гётеборга. В 2023 году у этого пляжа прошёл чемпионат мира по парусному спорту, первый крупный отбор на Олимпиаду в Париже: все олимпийские классы гонялись на дистанциях перед городом. Каждую весну Североморская регата заполняет гавань Схевенингена морскими яхтами и монотипами.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Play the tide first. A knot of stream along the beach is worth more than most shifts, so work out which way it is running before the start and check it against a buoy or a pot. With the flood running north-east, boats at the down-tide end of the line can be swept over it early.',
          'Сначала разберись с течением. Узел течения вдоль пляжа стоит больше, чем большинство сдвигов, так что ещё до старта выясни, куда оно идёт, и проверь по бую или вешке. Когда прилив несёт на северо-восток, лодки у того конца линии, куда идёт течение, может вынести за неё раньше времени.'],
        ['The stream is usually weaker close to the beach, which pays when it is against you, but the waves are steeper there and the bars are shallow. In a fresh south-westerly the chop matters as much as the angles. Sail a little lower and faster upwind to drive through it, and downwind work the waves: bear away down the face of each one and come up in the troughs.',
          'У пляжа течение обычно слабее, и это выгодно, когда оно встречное, но волна там круче, а над отмелями мелко. В свежий юго-западный ветер волна значит не меньше, чем углы. На лавировке иди чуть полнее и быстрее, чтобы продавливать её, а на попутном работай с волной: уваливайся по склону каждой и приводись во впадинах.'],
      ] },
    ],
  },

  'hong-kong': {
    title: ['Sailing in Hong Kong: Victoria Harbour racing', 'Яхтинг в Гонконге: гонки в гавани Виктория'],
    description: [
      'Victoria Harbour’s monsoon winds, tide and wash, the Royal Hong Kong Yacht Club’s races and how to sail them – and race it free in a 3D sailing game.',
      'Муссоны, течения и волна гавани Виктория, гонки Королевского яхт-клуба Гонконга и как в них гоняться – и пройди гонку бесплатно в 3D-игре.',
    ],
    intro: [
      'Victoria Harbour lies between Hong Kong Island and the Kowloon peninsula, one of the busiest stretches of water in the world. Ferries, barges and ships cross it all day, the towers come down to the water on both sides, and the Peak rises behind the island.',
      'Гавань Виктория лежит между островом Гонконг и полуостровом Коулун и входит в число самых оживлённых акваторий мира. Паромы, баржи и суда пересекают её весь день, небоскрёбы спускаются к самой воде на обоих берегах, а за островом поднимается пик Виктория.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Hong Kong’s wind follows the monsoon. From about October to March the north-east monsoon blows steadily, and in the harbour it usually arrives from the east, funnelled between the hills. The air is drier and clearer then, and this is the main racing season. In summer the south-west monsoon brings lighter, hotter and less settled weather, with thunderstorms and the risk of typhoons.',
          'Ветер в Гонконге подчиняется муссону. Примерно с октября по март устойчиво дует северо-восточный муссон, и в гавани он обычно приходит с востока, зажатый между холмами. Воздух тогда суше и прозрачнее, и это главный гоночный сезон. Летом юго-западный муссон приносит более слабый, жаркий и неустойчивый ветер, грозы и угрозу тайфунов.'],
        ['The tidal stream runs east and west along the harbour, typically at around a knot. On top of it there is the wash: ferries and launches leave a confused, lumpy sea that never really settles, and the sea walls of the waterfront throw it back.',
          'Приливное течение идёт вдоль гавани на восток и на запад, обычно около узла. А поверх него – волна от судов: паромы и катера оставляют беспорядочную толчею, которая никогда толком не успокаивается, а набережные отражают её обратно.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Royal Hong Kong Yacht Club, founded in the middle of the nineteenth century, has its clubhouse on Kellett Island, once an island and now joined to Causeway Bay by reclaimed land. Its Around the Island Race takes a large fleet right round Hong Kong Island each autumn, and its offshore races, the China Sea Race to the Philippines and the race to Vietnam, are among the oldest in Asia. The Volvo Ocean Race stopped here in 2018, with an in-port race in the harbour.',
          'Королевский яхт-клуб Гонконга, основанный в середине XIX века, стоит на острове Келлетт – когда-то это был остров, а теперь он соединён с Козуэй-Бэй намывной землёй. Каждую осень его гонка вокруг острова ведёт большой флот вокруг всего острова Гонконг, а его морские гонки – China Sea Race на Филиппины и гонка во Вьетнам – одни из старейших в Азии. В 2018 году здесь останавливалась Volvo Ocean Race, и в гавани прошла её гонка у берега.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['The towers bend the wind. Close to either shore it is blocked, lifted over the buildings or channelled down the streets, so the wind in mid-harbour is usually the steadiest and strongest. Watch the gaps between the buildings, where a gust can blow out across the water.',
          'Небоскрёбы искривляют ветер. У обоих берегов он перекрыт, поднимается над зданиями или прорывается вдоль улиц, поэтому посреди гавани ветер обычно ровнее и сильнее всего. Следи за просветами между зданиями: оттуда на воду может вырваться порыв.'],
        ['Work the tide as you would in a river: against it, keep to the side where it is weaker; with it, go where it runs strongest, usually mid-channel. Keep a lookout and give ferries and ships a wide berth. A big ship in a narrow channel cannot turn or stop for a racing fleet, and its wash can stop a light boat dead.',
          'Работай с течением, как на реке: против течения держись той стороны, где оно слабее, по течению – иди туда, где оно сильнее всего, обычно на середину фарватера. Смотри по сторонам и обходи паромы и суда с большим запасом. Большое судно в узком фарватере не может отвернуть или остановиться ради гоночного флота, а его волна может остановить лёгкую лодку на месте.'],
      ] },
    ],
  },

  'cape-town': {
    title: ['Sailing in Cape Town: Table Bay’s south-easter', 'Яхтинг в Кейптауне: юго-восточный ветер Столового залива'],
    description: [
      'Table Bay’s Cape Doctor, cold Atlantic water, the Cape to Rio race and how to race in heavy gusts – and race it free in a 3D sailing game.',
      '«Кейпский доктор» Столового залива, холодная Атлантика, гонка Кейптаун – Рио и тактика в сильных порывах – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Cape Town’s racing water is Table Bay, open to the Atlantic in the north-west and overlooked by Table Mountain. The Royal Cape Yacht Club is in the harbour, next to the V&A Waterfront, and in summer the bay is known for one thing: wind.',
      'Гоночная акватория Кейптауна – Столовый залив, открытый Атлантике на северо-запад, над которым стоит Столовая гора. Королевский Кейпский яхт-клуб находится в порту, рядом с набережной Виктории и Альфреда, а летом залив известен прежде всего ветром.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['From about November to March the south-easter blows, often for days at a time. Capetonians call it the Cape Doctor, for the way it clears the city’s air. When it is strong, a white cloud spills over the top of Table Mountain, the tablecloth, and the wind comes down off the mountain in hard gusts; on the strongest days 30 knots and more is not unusual.',
          'Примерно с ноября по март дует юго-восточный ветер, нередко по нескольку дней подряд. Жители Кейптауна зовут его «Кейпским доктором» – за то, что он очищает городской воздух. Когда он сильный, через вершину Столовой горы переливается белое облако – «скатерть», – а ветер срывается с горы жёсткими порывами; в самые сильные дни 30 узлов и больше – не редкость.'],
        ['The water is cold even in summer, because of the upwelling along the Atlantic coast, and fog can roll into the bay on calm days. In winter, cold fronts bring north-westerly gales and big swell straight into the bay. The tide is small and the streams in the bay are weak.',
          'Вода холодная даже летом из-за подъёма глубинных вод у атлантического побережья, а в штиль в залив может заползти туман. Зимой холодные фронты приносят северо-западные штормы и крупную зыбь прямо в залив. Прилив невелик, течения в заливе слабые.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Cape Town is where South Africa’s ocean racing starts. The Cape to Rio race, first sailed in 1971, sets off from Table Bay across the South Atlantic to Brazil. The round-the-world races have stopped here for decades, from the first Whitbread in 1973 to the Volvo Ocean Race and The Ocean Race that followed it. Inshore, the Lipton Cup, a trophy given by Sir Thomas Lipton, is still raced for between the country’s clubs.',
          'Именно в Кейптауне начинаются океанские гонки ЮАР. Гонка Кейптаун – Рио, впервые прошедшая в 1971 году, стартует в Столовом заливе и пересекает Южную Атлантику до Бразилии. Кругосветные гонки заходят сюда десятилетиями – от первой Whitbread в 1973 году до сменивших её Volvo Ocean Race и The Ocean Race. А у берега клубы страны до сих пор разыгрывают Кубок Липтона – приз, учреждённый сэром Томасом Липтоном.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a south-easter, reef early and think about the gusts before the shifts. The wind comes off the mountain in bands: the water under a gust turns dark and ruffled, and it can hit with far more strength than the lulls between. Ease and keep the boat flat as it arrives.',
          'В юго-восточный ветер бери рифы заранее и думай о порывах раньше, чем о сдвигах. Ветер срывается с горы полосами: под порывом вода темнеет и рябит, и он может ударить намного сильнее, чем в затишьях между ними. Когда порыв приходит, потравливай и держи лодку ровно.'],
        ['The south-easter blows off the land on the city side of the bay, so the water near the harbour is flatter, while further out the sea builds. Close in, under the mountain, the wind is gustier and shiftier; out in the bay it is steadier but stronger. On a summer day the south-easter often builds through the afternoon, so a race that starts gently may finish in a blow.',
          'У городского берега залива юго-восточный ветер дует с суши, поэтому у порта вода ровнее, а дальше в заливе волна растёт. У берега, под горой, ветер порывистее и сильнее гуляет, в открытом заливе он ровнее, но сильнее. Летом юго-восточный ветер часто усиливается к вечеру, так что гонка, начавшаяся спокойно, может закончиться в свежак.'],
      ] },
    ],
  },

  athens: {
    title: ['Sailing in Athens: meltemi and the 2004 Olympics', 'Яхтинг в Афинах: мельтеми и Олимпиада 2004 года'],
    description: [
      'The Saronic Gulf off Athens: the meltemi, the southerly sea breeze, the 2004 Olympic regatta and local tactics – and race it free in a 3D sailing game.',
      'Саронический залив у Афин: мельтеми, южный морской бриз, олимпийская регата 2004 года и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Athens sails on the Saronic Gulf, the sheltered sea south of the city between Attica and the Peloponnese. The racing water off Faliro Bay is a few miles from the Acropolis, and marinas and clubs line the coast from Piraeus south past Glyfada.',
      'Афины ходят под парусом в Сароническом заливе – защищённом море к югу от города, между Аттикой и Пелопоннесом. Гоночная акватория у Фалирского залива в нескольких милях от Акрополя, а марины и клубы тянутся вдоль берега от Пирея на юг, за Глифаду.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In July and August the meltemi, the dry northerly wind of the Aegean, blows across Attica. Off Athens it comes over the land from the north or north-east, so it is gusty and shifty near the coast and steadier further out. It can blow for days, often strongest in the afternoon and easing at night.',
          'В июле и августе над Аттикой дует мельтеми – сухой северный ветер Эгейского моря. У Афин он приходит через сушу с севера или северо-востока, поэтому у берега порывистый и неустойчивый, а дальше в море ровнее. Он может дуть по нескольку дней, обычно сильнее всего днём и слабея к ночи.'],
        ['When the meltemi is weak or absent, a sea breeze from the south fills in on most summer afternoons, and the two can fight over the gulf, leaving patches of calm and big shifts between them. Spring and autumn bring lighter, more variable wind. The tide is barely measurable.',
          'Когда мельтеми слабый или его нет, в большинство летних дней после полудня с юга приходит морской бриз, и два ветра могут бороться над заливом, оставляя между собой пятна штиля и большие сдвиги. Весной и осенью ветер слабее и переменчивее. Прилив почти не заметен.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Sailing was on the programme of the first modern Olympics, in Athens in 1896, but the races were never sailed. The city made up for it in 2004: the Olympic regatta was held from a new sailing centre at Agios Kosmas, just south of Faliro, with courses laid in the gulf off the coast. The wind was often light and hard to read, caught between the northerly and the sea breeze. The Hellenic Yacht Club, in the small harbour of Mikrolimano in Piraeus, is the best-known of the clubs that race here through most of the year.',
          'Парусный спорт был в программе первых современных Олимпийских игр в Афинах в 1896 году, но гонки так и не состоялись. Город наверстал это в 2004 году: олимпийская регата проходила из нового парусного центра в Агиос-Космасе, чуть южнее Фалиро, на дистанциях в заливе у берега. Ветер часто был слабым и трудным для чтения, зажатым между северным ветром и морским бризом. Самый известный из клубов, которые гоняются здесь почти круглый год, – Греческий яхт-клуб в маленькой гавани Микролимано в Пирее.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In the meltemi off Athens, the wind has crossed the city and the hills, so expect big shifts and puffs that arrive in streaks. Look upwind for dark water and sail to it, and tack on the headers: the shifts are often big enough to decide a beat.',
          'В мельтеми у Афин ветер проходит над городом и холмами, так что жди больших сдвигов и порывов, приходящих полосами. Ищи на ветре тёмную воду и иди к ней, поворачивай на заходах: сдвиги часто достаточно велики, чтобы решить исход лавировки.'],
        ['On a light day, watch the battle between the two winds. If the sea breeze is coming in from the south while the northerly fades, the boats nearest the new wind get it first, so lean towards the side where it is filling in, and expect a band of calm between the two.',
          'В слабый ветер следи за борьбой двух ветров. Если с юга приходит морской бриз, а северный стихает, первыми новый ветер получают лодки, которые ближе к нему, – так что держись той стороны, где он заполняет воду, и жди полосы штиля между ними.'],
      ] },
    ],
  },

  marmaris: {
    title: ['Sailing in Marmaris: a bay ringed by mountains', 'Яхтинг в Мармарисе: бухта в кольце гор'],
    description: [
      'Marmaris bay’s afternoon westerly, gusts off the pine hills, Marmaris Race Week and how to race in flat water – and race it free in a 3D sailing game.',
      'Дневной западный ветер бухты Мармариса, порывы с сосновых гор, Неделя гонок и тактика на ровной воде – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Marmaris lies on Turkey’s south-west coast, where the Aegean gives way to the Mediterranean. Its bay is almost closed off from the sea, with pine-covered mountains on every side, the old town and its castle on a small headland, and one of the country’s main yachting centres round the marina.',
      'Мармарис стоит на юго-западном побережье Турции, там, где Эгейское море переходит в Средиземное. Его бухта почти закрыта от моря, со всех сторон её окружают поросшие соснами горы, на небольшом мысе – старый город с крепостью, а вокруг марины – один из главных яхтенных центров страны.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The bay is a natural harbour, and the hills shelter it from the sea outside. In summer the wind usually comes in by day from the west, building through the late morning and fading in the evening. It is rarely as strong as the wind out at sea, but the mountains make it gusty: it drops into the bay in puffs and swirls round the headlands and islands.',
          'Бухта – естественная гавань, и холмы закрывают её от моря. Летом ветер обычно приходит днём с запада, усиливается к концу утра и стихает к вечеру. Он редко бывает таким же сильным, как в открытом море, но горы делают его порывистым: он падает в бухту порывами и закручивается вокруг мысов и островов.'],
        ['The water is flat, since the waves outside cannot get in, and there is no tide to speak of. The bay is deep almost everywhere, right up to the shore.',
          'Вода ровная – волна снаружи сюда не заходит, а прилива практически нет. Бухта глубокая почти везде, до самого берега.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Marmaris Race Week, held at the end of the season in late autumn, is one of the longest-running regattas on the Turkish coast. It brings cruiser-racers and charter yachts from Turkey and abroad for a week of racing in and around the bay. The town is also a base for charter fleets and gulets, the traditional wooden Turkish motor-sailers, which cruise the coast towards Bodrum and Fethiye.',
          'Неделя гонок Мармариса, которая проходит в конце сезона, поздней осенью, – одна из старейших регат турецкого побережья. На неделю гонок в бухте и вокруг неё собираются крейсерско-гоночные и чартерные яхты из Турции и других стран. Ещё город – база чартерных флотилий и гулетов, традиционных турецких деревянных моторно-парусных судов, которые ходят вдоль побережья к Бодруму и Фетхие.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Read the hills. The puffs come down off the slopes and fan out across the water, so a gust that arrives from the side of the course nearest the mountains often brings a shift with it. Look for the dark patches and expect them to swing the wind as they hit.',
          'Читай холмы. Порывы скатываются со склонов и веером расходятся по воде, поэтому порыв, пришедший со стороны дистанции ближе к горам, часто приносит с собой сдвиг. Ищи тёмные пятна и жди, что ветер в них повернёт.'],
        ['Near the shore and in the lee of the headlands the wind is weaker and bends along the land; in the middle of the bay it is usually steadier. With flat water and no current, small things decide the race: a clean start, clear air and tacking on the shifts.',
          'У берега и в тени мысов ветер слабее и огибает сушу, посреди бухты он обычно ровнее. На ровной воде и без течения гонку решают мелочи: чистый старт, чистый ветер и повороты на сдвигах.'],
      ] },
    ],
  },

  fethiye: {
    title: ['Sailing in Fethiye: the bay behind Şövalye island', 'Яхтинг в Фетхие: бухта за островом Шовалье'],
    description: [
      'Fethiye bay’s afternoon westerly, the mountains’ gusts, the Lycian coast’s cruising waters and local tactics – and race it free in a 3D sailing game.',
      'Дневной западный ветер бухты Фетхие, порывы с гор, ликийское побережье и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Fethiye is a harbour town on the Lycian coast of south-west Turkey, at the head of the Gulf of Fethiye. The town wraps round a sheltered bay, closed off from the gulf by Şövalye island, and the rock tombs of ancient Telmessos are cut into the cliff above it.',
      'Фетхие – портовый город на ликийском побережье юго-запада Турции, в глубине залива Фетхие. Город огибает защищённую бухту, которую от залива закрывает остров Шовалье, а в скале над ним высечены гробницы древнего Телмесса.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['On summer days the wind comes in from the gulf as the land heats up, usually from the west. It is often light in the morning, builds to a moderate breeze in the afternoon and dies away at sunset. Behind Şövalye the bay is well sheltered, so the water stays flat even when the gulf outside is choppy.',
          'Летом, когда суша прогревается, ветер приходит из залива, обычно с запада. Утром он часто слабый, к середине дня крепнет до умеренного бриза и стихает на закате. За островом Шовалье бухта хорошо защищена, и вода остаётся ровной, даже когда в заливе волна.'],
        ['The mountains above Fethiye, with Babadağ rising almost 2,000 metres behind the coast, shape the wind: they bend it, block it and send it down in gusts. There is no tide to speak of.',
          'Горы над Фетхие – а Бабадаг поднимается за берегом почти на 2000 метров – формируют ветер: искривляют его, перекрывают и сбрасывают порывами. Прилива практически нет.'],
      ] },
      { h: ['Sailing in Fethiye', 'Парус в Фетхие'], p: [
        ['The Gulf of Fethiye, with its dozen islands, is a favourite cruising ground, and the town is a port of call on the Blue Voyage, the slow cruise along the Lycian coast by gulet. Fethiye and the marinas of nearby Göcek are bases for charter yachts, and the bay is used for dinghy sailing and local racing. The town itself was largely rebuilt after an earthquake in 1957, which is why so little of the old harbour survives beside the ancient tombs.',
          'Залив Фетхие с его дюжиной островов – любимое место для крейсерских походов, а город – остановка на «Голубом путешествии», неспешном плавании на гулете вдоль ликийского берега. Фетхие и марины соседнего Гёчека – базы чартерных яхт, а в бухте ходят на швертботах и проводят местные гонки. Сам город был почти целиком отстроен заново после землетрясения 1957 года, поэтому от старой гавани рядом с древними гробницами осталось так мало.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Inside the bay the course is short and the shore is never far away, so the bends in the wind near the land matter. A westerly has to come past Şövalye, so expect it to be patchy in the island’s lee and stronger where it comes through the channels either side.',
          'Внутри бухты дистанция короткая, берег всегда рядом, и изгибы ветра у суши важны. Западному ветру приходится обходить Шовалье, так что жди пятнистого ветра в тени острова и более сильного – там, где он проходит через проливы по обе стороны.'],
        ['In the afternoon breeze, watch for the gusts off the mountains and the dark water that marks them. Early in the day, while the breeze is still building, the side of the course that gets the new wind first usually pays, and that is normally the side nearer the open gulf.',
          'В дневном бризе следи за порывами с гор и тёмной водой, которая их выдаёт. Пока бриз ещё набирает силу, обычно выигрывает та сторона дистанции, куда новый ветер приходит первым, – как правило, ближняя к открытому заливу.'],
      ] },
    ],
  },

  sochi: {
    title: ['Sailing in Sochi: the Black Sea under the Caucasus', 'Яхтинг в Сочи: Чёрное море у подножия Кавказа'],
    description: [
      'Sochi’s afternoon sea breeze, the Black Sea’s coastal current, the swell and how to race off the sea terminal – and race it free in a 3D sailing game.',
      'Дневной морской бриз Сочи, прибрежное течение Чёрного моря, зыбь и тактика у морского вокзала – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Sochi stretches for miles along the Russian Black Sea coast, with the Caucasus mountains close behind it. The racing water is off the sea terminal, whose spire is one of the town’s landmarks, and the beaches on either side are grey pebble.',
      'Сочи на много километров тянется вдоль российского берега Чёрного моря, а сразу за ним поднимаются Кавказские горы. Гоночная акватория – у морского вокзала, чей шпиль стал одним из символов города, а пляжи по обе стороны от него галечные.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Sochi has a subtropical climate, and in summer its wind is mostly a sea breeze. The mornings are often calm, or a light land breeze blows off the mountains; by early afternoon a south-westerly comes in off the sea, usually light to moderate, and it fades in the evening. The mountains shelter the coast from the north, so the cold bora that blows at Novorossiysk rarely reaches it.',
          'В Сочи субтропический климат, и летом ветер здесь в основном – морской бриз. По утрам часто штиль или с гор тянет слабый береговой бриз; к началу второй половины дня с моря приходит юго-западный ветер, обычно слабый или умеренный, и к вечеру стихает. Горы закрывают берег с севера, поэтому холодная бора, которая дует в Новороссийске, сюда почти не доходит.'],
        ['There is no tide. A weak current runs along the coast towards the north-west, part of the anticlockwise circulation of the Black Sea. The water gets deep quickly off the beach, and after a blow from the south-west a long swell can run onto the shore for a day or more.',
          'Прилива нет. Вдоль берега на северо-запад идёт слабое течение – часть кругового течения Чёрного моря против часовой стрелки. Глубина у пляжа нарастает быстро, а после юго-западного шторма на берег день и дольше может накатывать длинная зыбь.'],
      ] },
      { h: ['Sailing in Sochi', 'Парус в Сочи'], p: [
        ['Sochi has a long sailing history, and its mild winters let boats sail there all year, when the water further north is frozen. Its yachts are based in the port by the sea terminal and in the newer Imereti port further south, built for the 2014 Winter Olympics, and both host national regattas and cruiser races along the coast.',
          'У Сочи давняя парусная история, а мягкие зимы позволяют ходить здесь круглый год, пока вода севернее скована льдом. Яхты базируются в порту у морского вокзала и в новом Имеретинском порту южнее, построенном к зимней Олимпиаде 2014 года, и оба принимают всероссийские регаты и крейсерские гонки вдоль побережья.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the sea breeze and watch it fill. It arrives from the open sea as a line of darker water, and the first boats to reach it are away. Like most sea breezes north of the equator, it tends to veer, turning clockwise, as the afternoon goes on, so the right-hand side of the beat often pays later in the day.',
          'Дождись морского бриза и смотри, как он заполняет воду. Он приходит с открытого моря полосой более тёмной воды, и кто первым до неё доберётся, тот и уходит вперёд. Как большинство морских бризов к северу от экватора, он обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['Near the shore the wind is lighter and less steady, bent by the town and the hills behind it; it is usually better further out. The current is weak but steady, and on a long beat it adds up, so allow for it when you lay a mark.',
          'У берега ветер слабее и менее устойчив – его искривляют город и холмы за ним; дальше в море он обычно лучше. Течение слабое, но постоянное, и на длинной лавировке оно накапливается, так что учитывай его, когда выходишь на лейлайн знака.'],
      ] },
    ],
  },

  melbourne: {
    title: ['Sailing in Melbourne: Port Phillip’s sea breeze', 'Яхтинг в Мельбурне: морской бриз Порт-Филлипа'],
    description: [
      'Port Phillip’s sea breeze and cool changes, its short chop, the 1956 Olympic regatta and local tactics – and race it free in a 3D sailing game.',
      'Морской бриз и холодные фронты Порт-Филлипа, короткая волна, олимпийская регата 1956 года и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Melbourne sits at the head of Port Phillip, a wide, shallow bay almost closed off from Bass Strait. The racing water off St Kilda, with the city’s towers behind, has seen everything from the 1956 Olympic regatta to the weekly club races of the bayside clubs.',
      'Мельбурн стоит в глубине Порт-Филлипа – широкого мелкого залива, почти отрезанного от Бассова пролива. Акватория у Сент-Килды, за которой видны небоскрёбы города, видела всё – от олимпийской регаты 1956 года до еженедельных гонок прибрежных клубов.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the sea breeze is the racing wind. On a warm day it comes in off the bay from the south or south-west, often fresh, and builds through the afternoon. On hot days a northerly blows off the land first, and the sea breeze or a cool change from the south-west replaces it, sometimes within minutes, with a jump in strength and a drop in temperature.',
          'Летом гоночный ветер – морской бриз. В тёплый день он приходит с залива с юга или юго-запада, часто свежий, и усиливается к вечеру. В жаркие дни сначала с суши дует северный ветер, а потом его сменяет морской бриз или холодный фронт с юго-запада – порой за считаные минуты, с резким усилением ветра и падением температуры.'],
        ['Port Phillip is shallow for its size, so even a moderate wind raises a short, steep chop. The tide inside the bay is small. The strong streams are at the entrance, the Rip, between Point Lonsdale and Point Nepean, where the whole bay fills and empties through a narrow gap. It is one of the most dangerous entrances on the Australian coast.',
          'Для своих размеров Порт-Филлип мелкий, поэтому даже умеренный ветер разводит короткую крутую волну. Прилив внутри залива невелик. Сильные течения – на входе, в проливе Рип между мысами Лонсдейл и Непин, где весь залив наполняется и опустошается через узкий проход. Это один из самых опасных входов на побережье Австралии.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The sailing of the 1956 Olympic Games, the first held in the southern hemisphere, was raced on Port Phillip. Today the bay has a crowded racing calendar: clubs such as the Royal Melbourne Yacht Squadron at St Kilda race through the year, and the bay has hosted Olympic-class regattas such as Sail Melbourne. Offshore, boats from Port Phillip race to Hobart down the west coast of Tasmania.',
          'Парусные гонки Олимпийских игр 1956 года – первых в Южном полушарии – прошли на Порт-Филлипе. Сегодня календарь гонок в заливе плотный: клубы вроде Королевской Мельбурнской яхтенной эскадры в Сент-Килде гоняются круглый год, а залив принимал регаты олимпийских классов, например Sail Melbourne. В море яхты с Порт-Филлипа гоняются до Хобарта вдоль западного берега Тасмании.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Watch the sea breeze come in. It shows as a dark line across the bay from the south, and on a strong day it arrives with its own chop. When the northerly is fading, the first boats into the new breeze can gain a leg in minutes, so be on the side it is coming from.',
          'Смотри, как приходит морской бриз. Он виден как тёмная полоса поперёк залива с юга, а в сильный день приходит вместе со своей волной. Когда северный ветер стихает, первые лодки, поймавшие новый бриз, могут за минуты выиграть целую лавировку, так что будь на той стороне, откуда он идёт.'],
        ['The chop is the other thing to manage. In a fresh sea breeze, sail upwind a little fuller and faster to keep the boat driving through the waves. Downwind, the bay’s waves are short, so catch each one early and steer down its face.',
          'Второе, с чем приходится работать, – волна. В свежий морской бриз иди в лавировку чуть полнее и быстрее, чтобы лодка продавливала волну. На попутном волны в заливе короткие, так что лови каждую пораньше и уваливайся по её склону.'],
      ] },
    ],
  },

  'gold-coast': {
    title: ['Sailing on the Gold Coast: sea breeze and current', 'Яхтинг на Голд-Кост: бриз и течение'],
    description: [
      'The Pacific off Surfers Paradise: the sea breeze, the East Australian Current, the swell and tactics – and race it free in a 3D sailing game.',
      'Тихий океан у Серферс-Парадайз: восточный морской бриз, Восточно-Австралийское течение, зыбь и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'The Gold Coast runs south from the Broadwater towards the New South Wales border, a line of surf beaches backed by the towers of Surfers Paradise. Offshore it is open Pacific, with no headland or island for shelter; the sheltered water is behind the beach, in the Broadwater at Southport.',
      'Голд-Кост тянется от лагуны Бродуотер на юг, к границе Нового Южного Уэльса, – полоса пляжей для сёрфинга, за которой стоят небоскрёбы Серферс-Парадайз. В море – открытый Тихий океан, без мысов и островов, за которыми можно укрыться; защищённая вода – за пляжем, в лагуне Бродуотер у Саутпорта.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The Gold Coast has a subtropical climate. The south-east trade wind blows for much of the year, and in spring and summer an easterly or north-easterly sea breeze builds most afternoons and can be fresh by the end of the day. Summer also brings afternoon thunderstorms, which can arrive with strong, sudden gusts off the land.',
          'На Голд-Кост субтропический климат. Большую часть года дует юго-восточный пассат, а весной и летом почти каждый день после полудня поднимается восточный или северо-восточный морской бриз, к концу дня он может быть свежим. Летом бывают и дневные грозы, которые приходят с суши с сильными внезапными порывами.'],
        ['Offshore, the East Australian Current runs south along the coast, carrying warm water down from the Coral Sea. It is usually strongest well out, over the edge of the continental shelf, but it can be felt close in, and it changes from day to day. The swell is almost always there: long Pacific swell, mostly from the south-east or east, breaking on the beaches and the bars.',
          'В море вдоль берега на юг идёт Восточно-Австралийское течение, несущее тёплую воду из Кораллового моря. Обычно оно сильнее всего далеко от берега, над краем континентального шельфа, но чувствуется и ближе, и меняется день ото дня. Зыбь здесь есть почти всегда: длинная тихоокеанская зыбь, чаще с юго-востока или востока, разбивается на пляжах и отмелях.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Gold Coast’s racing is centred on Southport, where the Southport Yacht Club looks out over the Broadwater and the Gold Coast Seaway leads to the open sea. The Sydney to Gold Coast race, run by the Cruising Yacht Club of Australia, finishes here each winter, bringing offshore boats several hundred miles up the coast.',
          'Гоночная жизнь Голд-Кост сосредоточена в Саутпорте, где яхт-клуб Саутпорта смотрит на лагуну Бродуотер, а канал Голд-Кост-Сиуэй выводит в открытое море. Каждую зиму здесь финиширует гонка Сидней – Голд-Кост, которую проводит Крейсерский яхт-клуб Австралии, и морские яхты проходят несколько сотен миль вдоль побережья.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Know which way the current is running. Going south, the East Australian Current carries you along; going north, against it, look for weaker stream closer inshore, as long as you stay well clear of the surf. A current across the course also moves the laylines, so allow for being set south as you approach a mark.',
          'Знай, куда идёт течение. На юг Восточно-Австралийское течение несёт тебя вперёд; на север, против него, ищи более слабое течение ближе к берегу – но держись подальше от прибоя. Течение поперёк дистанции сдвигает и лейлайны, так что на подходе к знаку учитывай снос на юг.'],
        ['Sea breezes in the southern hemisphere tend to back, turning anticlockwise, as the afternoon goes on, so watch for the wind swinging from east towards north-east later in the day. Downwind, the swell is your friend: pick the bigger waves, bear away to catch them and ride them as far as they will take you.',
          'Морские бризы в Южном полушарии обычно поворачивают против часовой стрелки по мере того, как день идёт, так что ближе к вечеру жди, что ветер уйдёт с востока к северо-востоку. На попутном зыбь – твой союзник: выбирай волны покрупнее, уваливайся, чтобы поймать их, и катись на них так далеко, как они понесут.'],
      ] },
    ],
  },

  'new-york': {
    title: ['Sailing in New York: the harbour and its tides', 'Яхтинг в Нью-Йорке: гавань и приливные течения'],
    description: [
      'New York’s Upper Bay: the summer south-westerly, the tide, the America’s Cup’s first home and tactics – and race it free in a 3D sailing game.',
      'Верхняя бухта Нью-Йорка: летний юго-западный ветер, течения через Нэрроуз, первый дом Кубка «Америки» и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'New York’s Upper Bay is the harbour between Manhattan, Brooklyn, Staten Island and New Jersey, with the Statue of Liberty on its island near the New Jersey shore. Ships come in through the Narrows under the Verrazzano bridge, and the Hudson and the East River meet the bay at the tip of Manhattan.',
      'Верхняя бухта Нью-Йорка – гавань между Манхэттеном, Бруклином, Статен-Айлендом и Нью-Джерси; статуя Свободы стоит на своём острове у берега Нью-Джерси. Суда входят через пролив Нэрроуз под мостом Верразано, а у южной оконечности Манхэттена в бухту впадают Гудзон и Ист-Ривер.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the prevailing wind is a south-westerly, often helped in the afternoon by a sea breeze off the ocean. Mornings can be light. On hot days thunderstorms come off the land from the west with sudden gusts. In spring and autumn, fronts bring stronger, shiftier north-westerlies.',
          'Летом преобладает юго-западный ветер, которому после полудня часто помогает морской бриз с океана. По утрам бывает слабо. В жаркие дни с суши с запада приходят грозы с внезапными порывами. Весной и осенью фронты приносят более сильные и неустойчивые северо-западные ветры.'],
        ['The tide matters as much as the wind. The harbour fills and empties through the Narrows and the rivers, and the stream in the Upper Bay can run at a knot or two, more in the channels: the flood runs north, up the bay and the Hudson, and the ebb south, out to sea. Wind against tide quickly kicks up a steep chop, and the wash of ferries, tugs and ships adds to it.',
          'Течение здесь значит не меньше, чем ветер. Гавань наполняется и опустошается через Нэрроуз и реки, и течение в Верхней бухте может достигать узла-двух, а на фарватерах и больше: прилив идёт на север, вверх по бухте и Гудзону, отлив – на юг, в океан. Ветер против течения быстро разводит крутую волну, а волна от паромов, буксиров и судов добавляет своё.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['New York is where the America’s Cup was first defended. The first challenge, in 1870, was raced off New York, and the New York Yacht Club went on defending the Cup until it lost in 1983; the matches moved to Newport, Rhode Island, in 1930. More recently, SailGP has brought its foiling catamarans to the harbour, racing off Lower Manhattan in front of the city.',
          'Именно в Нью-Йорке Кубок «Америки» защищали впервые. Первый вызов, в 1870 году, разыгрывался у Нью-Йорка, и Нью-Йоркский яхт-клуб защищал Кубок, пока не проиграл его в 1983 году; в 1930 году матчи переехали в Ньюпорт, штат Род-Айленд. А в последние годы SailGP привозила в гавань свои катамараны на подводных крыльях и гонялась у Нижнего Манхэттена, прямо перед городом.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Plan your race on the tide table. Against the stream, get out of the strongest of it: it is usually weaker in shallower water and close to the shore, and eddies form behind points and piers. With it, stay in the deep channel, where it runs hardest. Know when the tide turns.',
          'Планируй гонку по таблице приливов. Против течения уходи с самой сильной струи: обычно оно слабее на мелководье и у берега, а за мысами и пирсами образуются обратные течения. По течению держись глубокого фарватера, где оно сильнее всего. Знай, когда сменится течение.'],
        ['Lower Manhattan and the Brooklyn and Jersey City waterfronts bend and block the wind near the shore, so the breeze in the open bay is usually steadier. Keep a lookout: the Staten Island Ferry and commercial ships run through the bay all day, and they cannot stop or turn for a racing fleet.',
          'Нижний Манхэттен и набережные Бруклина и Джерси-Сити искривляют и перекрывают ветер у берега, поэтому в открытой бухте он обычно ровнее. Смотри по сторонам: паром на Статен-Айленд и торговые суда ходят через бухту весь день и не могут остановиться или отвернуть ради гоночного флота.'],
      ] },
    ],
  },
};
