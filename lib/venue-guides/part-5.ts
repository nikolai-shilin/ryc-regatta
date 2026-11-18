import type { VenueGuide } from '../venue-guides';
import type { VenueId } from '../venues';

export const PART_5: Partial<Record<VenueId, VenueGuide>> = {
  malta: {
    title: ['Sailing in Malta: the Grand Harbour and the Middle Sea Race', 'Яхтинг на Мальте: Гранд-Харбор и Middle Sea Race'],
    description: [
      'Malta: the north-westerly majjistral, the gregale, the Rolex Middle Sea Race and local tactics – and race it free in a 3D sailing game.',
      'Мальта: северо-западный майистраль, грегаль, Rolex Middle Sea Race и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Valletta stands on a peninsula between two harbours, with Fort St Elmo at its tip and the Grand Harbour opening to the north-east along its southern side. Every October the fleet of the Rolex Middle Sea Race sets out from here on its 606 miles round Sicily.',
      'Валлетта стоит на полуострове между двумя гаванями: на его оконечности – форт Сент-Эльмо, а вдоль южного берега тянется Гранд-Харбор, открытый на северо-восток. Каждый октябрь отсюда уходит на 606 миль вокруг Сицилии флот Rolex Middle Sea Race.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The north-westerly, called the majjistral in Maltese, is the most common wind in every season and blows on about a fifth of the days in the year. Spring and autumn can bring spells of strong north-westerly. The other wind to respect is the gregale, a strong, cool north-easterly that comes when a low passes south of the island. The mouth of the Grand Harbour faces north-east, and a breakwater stands off the entrance to give it extra shelter.',
          'Северо-западный ветер, по-мальтийски майистраль, – самый частый здесь в любое время года: он дует примерно пятую часть дней в году. Весной и осенью случаются периоды сильного северо-запада. Считаться приходится и с грегалем – сильным прохладным северо-восточным ветром, который приходит, когда к югу от острова проходит циклон. Вход в Гранд-Харбор обращён как раз на северо-восток, и дополнительную защиту гавани даёт волнолом перед входом.'],
        ['The tide hardly counts. A gauge at Mellieħa Bay recorded an average maximum range of only about 20 centimetres, and short oscillations of the sea known locally as milgħuba can hide the tide altogether. The Grand Harbour itself is about 3.6 km long and a working port, shared by large ships, ferries and water taxis.',
          'Прилив здесь почти ничего не значит. Мареограф в бухте Меллиха показал средний максимальный перепад всего около 20 сантиметров, а короткие колебания уровня моря, которые местные называют milgħuba, могут полностью скрывать прилив. Сам Гранд-Харбор длиной около 3,6 км – действующий порт, где ходят большие суда, паромы и водные такси.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Rolex Middle Sea Race was first sailed in 1968, created by the Royal Malta Yacht Club and the Royal Ocean Racing Club. Eight boats started, and John Ripard’s Josian, the smallest of them, won overall. The course leads north through the Strait of Messina, past Stromboli, west to the Egadi Islands, then south by Pantelleria and Lampedusa and back to Malta. In recent editions each start has been fired by the cannon of the Saluting Battery above the Grand Harbour. The record fleet is 130 yachts, in 2018, and the outright record of 33 hours 29 minutes 28 seconds belongs to the MOD70 Argo. The 47th race, in October 2026, went to the Wallyrocket 71 Django 7x on handicap, with Black Jack 100 first monohull home.',
          'Rolex Middle Sea Race впервые прошла в 1968 году; её создали Королевский яхт-клуб Мальты и Королевский клуб океанских гонок. На старт вышли восемь лодок, а в общем зачёте победила самая маленькая из них – Josian Джона Рипарда. Маршрут ведёт на север через Мессинский пролив, мимо Стромболи, на запад к Эгадским островам, затем на юг мимо Пантеллерии и Лампедузы и обратно на Мальту. В последние годы каждый старт дают пушки Салютующей батареи над Гранд-Харбором. Рекордный флот – 130 яхт – собрался в 2018 году, а абсолютный рекорд, 33 часа 29 минут 28 секунд, принадлежит тримарану MOD70 Argo. 47-ю гонку в октябре 2026 года по гандикапу выиграла Wallyrocket 71 Django 7x, а первым из однокорпусных финишировал Black Jack 100.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['A north-westerly blows almost along the coast off Valletta, so compare the pressure inshore and further out before you commit to a side. Close to the land the wind bends round the headlands and buildings, and the steadier breeze is usually out to sea.',
          'Северо-западный ветер у Валлетты дует почти вдоль берега, так что, прежде чем выбрать сторону, сравни силу ветра у суши и дальше в море. У берега ветер огибает мысы и здания, а ровнее он обычно мористее.'],
        ['With no tide to plan for, sail the shifts and the pressure. Swell left over from an earlier blow can run across the wind, so steer through each wave rather than sailing a straight line. Near the harbour entrance, keep a lookout for ships and ferries, which cannot stop for a racing fleet.',
          'Приливы учитывать не нужно, так что лови заходы и иди туда, где ветер сильнее. Зыбь от прошедшего шторма может идти поперёк ветра, поэтому подруливай на каждой волне, а не держи прямую линию. У входа в гавань следи за судами и паромами: остановиться ради гоночного флота они не могут.'],
      ] },
    ],
  },

  'saint-malo': {
    title: ['Sailing in Saint-Malo: the Route du Rhum and the great tides', 'Яхтинг в Сен-Мало: Route du Rhum и большие приливы'],
    description: [
      'Saint-Malo: tides of up to 13 metres, the Channel westerlies, the Route du Rhum and local tactics – and race it free in a 3D sailing game.',
      'Сен-Мало: приливы до 13 метров, западные ветры Ла-Манша, Route du Rhum и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Saint-Malo is a walled port on the Channel coast of Brittany, with Fort National just off its beach and the island of Cézembre further out. It has some of the biggest tides in Europe, and every four years the solo sailors of the Route du Rhum set out from here across the Atlantic.',
      'Сен-Мало – город-крепость на бретонском берегу Ла-Манша: прямо у пляжа стоит форт Насьональ, а дальше в море лежит остров Сезамбр. Здесь одни из самых больших приливов в Европе, а раз в четыре года отсюда уходят через Атлантику одиночки Route du Rhum.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['At the largest spring tides the sea here can rise and fall by about 13 metres. In the mouth of the Rance, beside the town, the average range is about 8 metres, and that is why the world’s first tidal power station opened there in 1966. So much moving water makes strong streams among the rocks and islands of the approaches, and the shape of the coast changes through the day as reefs cover and uncover.',
          'В самые большие сизигийные приливы уровень моря здесь меняется примерно на 13 метров. В устье Ранса рядом с городом средний перепад составляет около 8 метров – поэтому именно там в 1966 году открылась первая в мире приливная электростанция. Такая масса воды создаёт сильные течения среди скал и островов на подходах, а очертания берега меняются в течение дня: рифы то скрываются, то выходят из воды.'],
        ['Westerly winds are frequent, especially in winter, when they can bring storms, and in summer a regular sea breeze comes in. Spring and early summer can be different: a stationary high over northern Europe can hold the wind in the east for weeks at a time.',
          'Западные ветры здесь часты, особенно зимой, когда они могут приносить шторма, а летом приходит регулярный морской бриз. Весной и в начале лета бывает иначе: стационарный антициклон над Северной Европой способен неделями удерживать восточный ветер.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Route du Rhum, first sailed in 1978, covers about 3,542 miles from a start line north of the Pointe du Grouin to Pointe-à-Pitre in Guadeloupe. Its first edition was decided by just 98 seconds, when Mike Birch’s trimaran Olympus Photo beat Michel Malinovsky’s Kriter V. The 13th race left on 1 November 2026, and Tom Laperche on the Ultim SVR-Lazartigue set a new race record of 6 days 13 hours 27 minutes 40 seconds. Saint-Malo is also the finish of the Transat Québec–Saint-Malo, first raced in 1984 to mark 450 years since Jacques Cartier’s voyage from this port.',
          'Route du Rhum, впервые прошедшая в 1978 году, – это примерно 3542 мили от стартовой линии к северу от мыса Груэн до Пуэнт-а-Питра на Гваделупе. Первую гонку решили всего 98 секунд: тримаран Olympus Photo Майка Бёрча опередил Kriter V Мишеля Малиновски. 13-я гонка стартовала 1 ноября 2026 года, и Том Лаперш на ультиме SVR-Lazartigue установил новый рекорд – 6 дней 13 часов 27 минут 40 секунд. В Сен-Мало финиширует и Transat Québec–Saint-Malo: её впервые провели в 1984 году в честь 450-летия плавания Жака Картье из этого порта.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Plan the race around the tide. Know when the stream turns and how hard it is running, check it against a buoy before the start, and allow for it on every layline. A boat that picks the right side of the stream can gain more than one that finds a good shift.',
          'Строй гонку вокруг прилива. Знай, когда сменится течение и насколько оно сильное, проверь его по бую ещё до старта и учитывай на каждом лейлайне. Лодка, выбравшая правильную сторону течения, может выиграть больше, чем та, что поймала удачный заход.'],
        ['When a fresh westerly blows against the stream, expect a short, steep sea: sail a little fuller upwind to keep driving through it. Near the islands and reefs, remember that the depth is changing all the time, and do not cut a corner that was safe an hour ago.',
          'Когда свежий западный ветер дует против течения, жди короткой крутой волны: на лавировке иди чуть полнее, чтобы продавливать её. У островов и рифов помни, что глубина всё время меняется, и не срезай угол, который был безопасен час назад.'],
      ] },
    ],
  },

  hobart: {
    title: ['Sailing in Hobart: the Derwent and the Sydney Hobart finish', 'Яхтинг в Хобарте: река Деруэнт и финиш Сидней – Хобарт'],
    description: [
      'The River Derwent: the afternoon sea breeze, kunanyi, the Sydney Hobart finish and local tactics – and race it free in a 3D sailing game.',
      'Река Деруэнт: дневной морской бриз, гора кунаньи, финиш гонки Сидней – Хобарт и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Hobart lies on the River Derwent beneath kunanyi / Mount Wellington, which rises to 1,271 metres behind the city. Off Sandy Bay the river is a wide estuary, and a little upstream, off Battery Point, is the line where the Sydney Hobart ends.',
      'Хобарт стоит на реке Деруэнт у подножия горы кунаньи, она же Веллингтон, которая поднимается за городом на 1271 метр. У Сэнди-Бей река превращается в широкий эстуарий, а чуть выше по течению, у Баттери-Пойнт, проходит финишная линия гонки Сидней – Хобарт.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The most common wind on this stretch is a steady sea breeze of 10 to 15 knots. It is mostly a south-easterly, drawing more from the east further down the estuary. When it is not established the river can be very fickle: during the 2007 Sydney Hobart, boats between the Iron Pot and the finish met anything from no wind to 30 knots and back to none.',
          'Самый частый ветер на этом участке – ровный морской бриз на 10–15 узлов. Обычно он юго-восточный, а ниже по эстуарию заходит ближе к востоку. Пока бриз не установился, река бывает очень капризной: на гонке Сидней – Хобарт 2007 года лодки между скалой Айрон-Пот и финишем встречали всё – от штиля до 30 узлов и снова штиль.'],
        ['The tide is small, with a range of only about a metre even at springs, and the two tides of a day can be very unequal. South of the Tasman Bridge, where the racing is, the current is much lighter than it is further up the river.',
          'Прилив здесь невелик – около метра даже в сизигию, а два прилива одних суток могут сильно отличаться друг от друга. К югу от моста Тасмана, где проходят гонки, течение гораздо слабее, чем выше по реке.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Sydney Hobart began on Boxing Day 1945, when nine yachts set off and Rani won, and it now covers 628 miles. After crossing Storm Bay the fleet rounds the Iron Pot and sails about 12 miles up the Derwent to finish. LDV Comanche set the race record of 1 day 9 hours 15 minutes 24 seconds in 2017. The storm of 1998 is the race’s darkest memory: six sailors died and five boats sank. In 2025 Master Lock Comanche was first home, and Min River became the first double-handed boat to win the Tattersall Cup overall. Hobart’s own sailing goes back much further: the Royal Hobart Regatta was first held on 1 December 1838, and the Royal Yacht Club of Tasmania, based at Sandy Bay, dates from 1880.',
          'Гонка Сидней – Хобарт началась в День подарков 1945 года: на старт вышли девять яхт, а победила Rani. Сегодня её длина – 628 миль. Пройдя залив Сторм, флот огибает скалу Айрон-Пот и ещё около 12 миль идёт вверх по Деруэнту к финишу. Рекорд гонки – 1 день 9 часов 15 минут 24 секунды – установила в 2017 году LDV Comanche. Самая горькая страница её истории – шторм 1998 года, когда погибли шесть яхтсменов и затонули пять лодок. В 2025 году первой финишировала Master Lock Comanche, а Min River стала первой лодкой с экипажем из двух человек, завоевавшей Кубок Таттерсолла в общем зачёте. Собственная парусная история Хобарта намного старше: Королевская регата Хобарта впервые прошла 1 декабря 1838 года, а Королевский яхт-клуб Тасмании в Сэнди-Бей ведёт отсчёт с 1880 года.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the sea breeze and watch for it coming up the river as a line of darker water. Sea breezes in the southern hemisphere tend to back, turning anticlockwise, so once it is in, the left-hand side of the beat often pays as the afternoon goes on.',
          'Дождись морского бриза и высматривай, как он поднимается по реке тёмной полосой. Морские бризы в Южном полушарии обычно поворачивают против часовой стрелки, так что, когда бриз установится, ближе к вечеру часто выигрывает левая сторона лавировки.'],
        ['The river has land on both sides, so the wind bends near each shore: look for the shift before you reach the bank and tack on it. If the wind goes west it comes down off kunanyi and the hills behind the city, so expect strong gusts and big shifts, and keep the boat flat through each one.',
          'Река зажата берегами с двух сторон, и у каждого из них ветер искривляется: ищи заход ещё до подхода к берегу и поворачивай на нём. Если ветер уходит на запад, он спускается с кунаньи и холмов за городом, так что жди сильных порывов и больших заходов и держи лодку ровно в каждом из них.'],
      ] },
    ],
  },

  'lake-geneva': {
    title: ['Sailing on Lake Geneva: the bise and the Bol d’Or', 'Яхтинг на Женевском озере: биза и Bol d’Or'],
    description: [
      'The Petit-Lac above Geneva: the north-easterly bise, the Jet d’Eau, the Bol d’Or and local tactics – and race it free in a 3D sailing game.',
      'Малое озеро у Женевы: северо-восточная биза, фонтан Же-До, регата Bol d’Or и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'The Petit-Lac is the narrow south-western arm of Lake Geneva, running from Yvoire down to the city of Geneva between the Swiss and French shores. At its foot the Jet d’Eau throws a column of water 140 metres into the air, and the Société Nautique de Genève, twice winner of the America’s Cup, has its home on the water’s edge.',
      'Малое озеро, Пти-Лак, – узкий юго-западный рукав Женевского озера: оно тянется от Ивуара до самой Женевы между швейцарским и французским берегами. У его конца на 140 метров взлетает струя фонтана Же-До, а на берегу расположен яхт-клуб Société Nautique de Genève, дважды выигравший Кубок «Америки».',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The bise is a cold, dry wind from the north-east. It forms when high pressure over northern Europe meets low pressure over the Mediterranean, and it is funnelled between the Jura and the Alps, often gathering speed in the west where the mountains draw closer together. It can reach about 100 km/h around the lake, and sailors say that it blows in multiples of three days. On quieter days thermal breezes take over, and a south-westerly brings warm, moist air off the Atlantic.',
          'Биза – холодный сухой северо-восточный ветер. Она возникает, когда над Северной Европой стоит высокое давление, а над Средиземным морем – низкое, и проходит как по коридору между Юрой и Альпами, часто усиливаясь на западе, где горы сближаются. Вокруг озера она может достигать примерно 100 км/ч, а яхтсмены говорят, что дует она три, шесть или девять дней. В спокойные дни её сменяют термические бризы, а юго-западный ветер приносит тёплый влажный воздух с Атлантики.'],
        ['This is fresh water, and the tide amounts to about 4 millimetres. The Petit-Lac averages only 40 metres deep, against more than 300 metres at the deepest point of the main lake. The biggest waves on Lake Geneva reach about 1.7 metres, and a strong bise can raise a heavy sea.',
          'Вода здесь пресная, а прилив составляет около 4 миллиметров. Средняя глубина Малого озера – всего 40 метров, тогда как в самой глубокой точке основной части озера она превышает 300 метров. Самые большие волны на Женевском озере достигают примерно 1,7 метра, и сильная биза способна развести крутую волну.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Société Nautique de Genève was founded in 1872, and with Alinghi it won the America’s Cup in 2003 and defended it in 2007. Its great event is the Bol d’Or, first sailed on 22 July 1939 with 26 boats and now one of the largest regattas held on closed water anywhere. The course runs about 66 miles from Geneva to Le Bouveret, at the far end of the lake, and back. For 20 years, until 2024, it was the Bol d’Or Mirabaud, and it now sails as the Bol d’Or du Léman. The 87th edition, in June 2026, drew 391 entries and was won by the TF35 Ylliam XII in 11 hours 48 minutes 53 seconds.',
          'Клуб Société Nautique de Genève основан в 1872 году; с командой Alinghi он выиграл Кубок «Америки» в 2003 году и защитил его в 2007-м. Его главное событие – Bol d’Or: регата впервые прошла 22 июля 1939 года с 26 лодками, а сегодня это одна из крупнейших в мире гонок на закрытой акватории. Дистанция длиной около 66 миль ведёт от Женевы до Ле-Бувре на дальнем конце озера и обратно. Двадцать лет, до 2024 года, она называлась Bol d’Or Mirabaud, а теперь носит имя Bol d’Or du Léman. В 87-й регате в июне 2026 года участвовала 391 лодка, а победил катамаран TF35 Ylliam XII с результатом 11 часов 48 минут 53 секунды.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a bise the beat runs straight up the lake, with a shore on each side. Plan your tacks early so that you are not forced off a good shift by the bank, and compare the pressure near each shore with the middle before you choose a side. The hills bend the wind close to the land.',
          'В бизу лавировка идёт прямо вверх по озеру, а берега остаются с обеих сторон. Планируй повороты заранее, чтобы берег не вынудил тебя уйти с удачного захода, и, прежде чем выбрать сторону, сравни силу ветра у каждого берега и посередине. У суши холмы искривляют ветер.'],
        ['The waves build towards the Geneva end, where the wind has had the longest run over the water, so sail a little fuller upwind to keep driving through them and ride them downwind. On light days, watch the water for the first signs of a thermal breeze and be on the side it reaches first.',
          'Волна растёт к женевскому концу озера, где у ветра самый длинный разгон, так что на лавировке иди чуть полнее, чтобы продавливать её, а на попутном катись по ней. В слабый ветер следи за водой, высматривая первые признаки термического бриза, и будь на той стороне, куда он придёт раньше.'],
      ] },
    ],
  },

  'san-diego': {
    title: ['Sailing in San Diego: Point Loma and the America’s Cup', 'Яхтинг в Сан-Диего: Пойнт-Лома и Кубок «Америки»'],
    description: [
      'The Pacific off Point Loma: the sea breeze, kelp, three America’s Cups and local tactics – and race it free in a 3D sailing game.',
      'Тихий океан у Пойнт-Ломы: морской бриз, водоросли, три Кубка «Америки» и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Point Loma is the long headland that shelters San Diego Bay from the Pacific, and the open ocean off it is one of the great stages of American sailing. The America’s Cup was raced from San Diego in 1988, 1992 and 1995.',
      'Пойнт-Лома – длинный мыс, прикрывающий залив Сан-Диего от Тихого океана, а открытая вода за ним – одна из главных сцен американского парусного спорта. Кубок «Америки» разыгрывали в Сан-Диего в 1988, 1992 и 1995 годах.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The racing wind is a sea breeze that fills in from the west and tends to shift right through the day, more strongly the closer you are to Point Loma. Spring is the windiest season, with March and April often the windiest months, and cold water in the mid-50s Fahrenheit helps to drive the breeze. Clouds building over the mountains behind the city in mid-morning are a good sign that it is on its way. Now and then a Catalina eddy brings a lighter south-westerly instead.',
          'Гоночный ветер здесь – морской бриз: он приходит с запада и в течение дня обычно смещается вправо, тем сильнее, чем ближе к Пойнт-Ломе. Самое ветреное время года – весна, чаще всего март и апрель, а холодная вода, около 13 °C, помогает бризу набрать силу. Облака, растущие над горами за городом в середине утра, – верный признак, что он уже на подходе. Иногда вихрь Каталины приносит вместо него более слабый юго-западный ветер.'],
        ['Ocean swell runs across the course, and the current generally sets from north to south, stronger offshore and lighter near the coast. Kelp is the local hazard: together the forests off Point Loma and La Jolla are the largest on the US West Coast, and loose strands drift across the racing area, often gathering along the current lines.',
          'По дистанции идёт океанская зыбь, а течение обычно направлено с севера на юг: мористее оно сильнее, у берега слабее. Местная опасность – гигантские бурые водоросли, келп: вместе их леса у Пойнт-Ломы и Ла-Хольи – самые большие на западном побережье США, а оторванные стебли дрейфуют по акватории, часто собираясь вдоль линий течения.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The San Diego Yacht Club, founded in 1886, won the America’s Cup at Fremantle in 1987 with Dennis Conner and brought it home. The 1988 match was one of the strangest in the Cup’s history: Conner’s catamaran Stars & Stripes beat the 120-foot New Zealand monohull KZ-1 2–0, and the courts argued over the result until 1990. In 1992 America³ beat Il Moro di Venezia 4–1 in the first Cup sailed in the International America’s Cup Class, and in 1995 Team New Zealand’s Black Magic swept Young America 5–0 to take the Cup away. The club has also raced for the Sir Thomas Lipton Cup since 1904.',
          'Яхт-клуб Сан-Диего, основанный в 1886 году, выиграл Кубок «Америки» во Фримантле в 1987 году с Деннисом Коннером и привёз трофей домой. Матч 1988 года стал одним из самых странных в истории Кубка: катамаран Коннера Stars & Stripes обыграл 120-футовую новозеландскую однокорпусную яхту KZ-1 со счётом 2–0, а суды спорили о результате до 1990 года. В 1992 году America³ победила Il Moro di Venezia со счётом 4–1 в первом Кубке на яхтах класса IACC, а в 1995 году Black Magic команды Team New Zealand разгромила Young America 5–0 и увезла Кубок. Кроме того, с 1904 года клуб разыгрывает Кубок сэра Томаса Липтона.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Read the wind direction first. In a west-north-westerly, head right, especially closer to the shore, where the current is kinder and big right shifts often roll out from the land. Further offshore, in a true westerly, the left can have more pressure, so the side that pays depends on how far you are from Point Loma.',
          'Сначала определи направление ветра. При западо-северо-западном ветре иди вправо, особенно ближе к берегу: там течение мягче, а с суши часто приходят большие правые заходы. Дальше в море, при чистом западном ветре, больше давления бывает слева, так что выгодная сторона зависит от того, насколько ты далеко от Пойнт-Ломы.'],
        ['Keep a crew member watching for kelp. A strand on the keel or rudder costs real speed, and stopping to clear it on a beat is very slow. On port tack the swell can come at you from abeam, so steer through each crest and keep the boat powered up in the troughs.',
          'Пусть кто-то из экипажа постоянно следит за водорослями. Стебель на киле или руле серьёзно отбирает скорость, а останавливаться, чтобы его снять, на лавировке очень накладно. На левом галсе зыбь может идти прямо в борт, поэтому подруливай на каждом гребне и держи лодку под полной тягой во впадинах.'],
      ] },
    ],
  },

  cork: {
    title: ['Sailing in Cork: Roches Point and the Royal Cork Yacht Club', 'Яхтинг в Корке: мыс Рошес и Королевский яхт-клуб Корка'],
    description: [
      'Cork Harbour’s mouth: the south-westerly, the tide, the Royal Cork Yacht Club of 1720, Cork Week and tactics – and race it free in a 3D sailing game.',
      'Вход в гавань Корка: юго-западный ветер, приливы, яхт-клуб 1720 года, Cork Week и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'The white lighthouse on Roches Point marks the entrance to Cork Harbour, on the south coast of Ireland. Inside, at Crosshaven, is the Royal Cork Yacht Club, which traces its history back to 1720 and is widely regarded as the oldest yacht club in the world.',
      'Белый маяк на мысе Рошес отмечает вход в гавань Корка на южном побережье Ирландии. В глубине, в Кросхейвене, находится Королевский яхт-клуб Корка: его история восходит к 1720 году, и многие считают его старейшим яхт-клубом мира.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The prevailing wind comes from the south-west, straight in from the Atlantic. Long-term figures for Roches Point put the average at about 12 knots over the year, around 10 knots in July and nearer 15 in January. Summer racing can also begin in fog or light air, with the south-westerly filling in later in the day.',
          'Преобладающий ветер дует с юго-запада, прямо с Атлантики. По многолетним данным станции на мысе Рошес, средняя скорость за год – около 12 узлов: примерно 10 узлов в июле и ближе к 15 в январе. Летом гонки могут начинаться в тумане или при слабом ветре, а юго-западный ветер приходит позже.'],
        ['The tide is a real factor. At Cobh the range is about 3.7 metres at springs and 1.9 metres at neaps. The stream in the harbour generally runs at up to 2 knots, reaching about 3 knots in the narrows and near Harbour Rock. Strong southerlies have a long fetch into the entrance, and where the harbour narrows between Rams Head and Dogsnose Point an ebb against that wind can make the sea rough.',
          'Приливы здесь нужно учитывать. В Кобе перепад составляет около 3,7 метра в сизигию и 1,9 метра в квадратуру. Течение в гавани обычно достигает 2 узлов, а в узостях и у скалы Харбор-Рок – примерно 3 узлов. Сильный южный ветер заходит в гавань с большим разгоном, и там, где она сужается между мысами Рамс-Хед и Догснос, отлив против такого ветра может развести крутую волну.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The club began in 1720 as the Water Club of the Harbour of Cork, founded on Haulbowline Island by William O’Brien, the 4th Earl of Inchiquin, and five friends. It moved to Cove, now Cobh, in the early 19th century, took the name Royal Cork in 1831 and settled at Crosshaven after merging with the Royal Munster Yacht Club in 1966. Its great event is Cork Week, held every two years. The 2026 edition ran from 6 to 10 July with a Harbour Race inside Cork Harbour, and Baltimore RNLI’s J/109 Storm won the Beaufort Cup, whose fleet raced round the Fastnet Rock.',
          'Клуб возник в 1720 году как Водный клуб гавани Корка: его основали на острове Хаулбоулайн Уильям О’Брайен, 4-й граф Инчикуин, и пятеро его друзей. В начале XIX века клуб перебрался в Коув, нынешний Коб, в 1831 году стал Королевским клубом Корка, а после слияния с Королевским яхт-клубом Манстера в 1966 году обосновался в Кросхейвене. Его главное событие – Cork Week, которая проходит раз в два года. В 2026 году регата шла с 6 по 10 июля, в её программе была гонка Harbour Race внутри гавани, а Beaufort Cup с маршрутом вокруг скалы Фастнет выиграла J/109 Storm экипажа спасательной станции Балтимора.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Work out the tide first. Off the entrance the stream floods into the harbour and ebbs out of it, so check which way it is running at the start and when it will turn. Near the narrows it can decide the race: use the weaker water at the edges when it is against you and the stronger stream in the channel when it is with you.',
          'Сначала разберись с приливом. У входа течение в прилив идёт в гавань, а в отлив – из неё, так что проверь его направление на старте и узнай, когда оно сменится. В узостях оно может решить исход гонки: когда течение встречное, держись у краёв, где оно слабее, а когда попутное – иди по фарватеру, где оно сильнее.'],
        ['In a south-westerly the land to the west bends the wind near the shore, so compare the pressure inshore and further out before you commit. When the wind is blowing against the ebb the waves get shorter and steeper, so sail a little fuller upwind to keep the boat moving through them.',
          'При юго-западном ветре суша на западе искривляет его у берега, так что, прежде чем выбрать сторону, сравни силу ветра у берега и мористее. Когда ветер дует против отлива, волна становится короче и круче, поэтому на лавировке иди чуть полнее, чтобы лодка не теряла ход.'],
      ] },
    ],
  },

  cascais: {
    title: ['Sailing in Cascais: the nortada and Portugal’s Atlantic coast', 'Яхтинг в Кашкайше: нортада и атлантический берег Португалии'],
    description: [
      'Cascais: the summer nortada, Atlantic swell, world championships, the America’s Cup World Series and tactics – and race it free in a 3D sailing game.',
      'Кашкайш: летняя нортада, атлантическая зыбь, чемпионаты мира, America’s Cup World Series и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Cascais lies west of Lisbon, where the coast of Portugal turns the corner from the open Atlantic towards the mouth of the Tagus. Its bay faces south, with the land to the north, and in summer it is known for a strong northerly wind, the nortada.',
      'Кашкайш лежит к западу от Лиссабона, там, где берег Португалии поворачивает от открытой Атлантики к устью Тежу. Его бухта обращена на юг, суша прикрывает её с севера, а летом здесь славится сильный северный ветер – нортада.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The nortada blows down the west coast of Iberia all year but above all from June to August, driven by the Azores High and the summer heat low over the interior. Coastal jets form in the lee of the main headlands, including Cabo da Roca just north-west of Cascais. It is the typical afternoon breeze here, and regattas off Cascais often sail in 15 to 25 knots from the north or north-north-west, though it has also sent fleets ashore in gusts of up to 40 knots.',
          'Нортада дует вдоль западного берега Пиренейского полуострова круглый год, но сильнее всего с июня по август: её создают Азорский антициклон и летняя термическая депрессия над внутренними районами. За главными мысами, в том числе за мысом Рока к северо-западу от Кашкайша, формируются прибрежные струйные течения. Здесь это обычный дневной ветер: регаты у Кашкайша часто проходят при 15–25 узлах с севера или северо-северо-запада, хотя бывало, что порывы до 40 узлов отправляли флот на берег.'],
        ['Close to the shore, inside the bay, the wind comes off the land over flat water, while further out towards the Guia race area the Atlantic swell rolls in. The tide is semi-diurnal, with a range from about half a metre to nearly four metres between neaps and springs. The sea has been measured here for a long time: the first tide gauge at Cascais was installed in 1882.',
          'У берега, внутри бухты, ветер идёт с суши над ровной водой, а дальше в море, в районе дистанции Гия, накатывает атлантическая зыбь. Прилив полусуточный, а его перепад меняется примерно от полуметра в квадратуру почти до четырёх метров в сизигию. За уровнем моря здесь следят давно: первый мареограф в Кашкайше поставили в 1882 году.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Cascais has hosted the sport’s biggest names. From 28 June to 13 July 2007 it staged the ISAF Sailing World Championships, with all eleven Olympic events on five race areas and places at the Beijing Games at stake. In August 2011 it opened the first America’s Cup World Series, in which nine teams raced AC45 catamarans and Emirates Team New Zealand won. Clube Naval de Cascais is also a regular home of grand-prix racing, and the TP52 fleet has held world championships here, most recently in July 2025, when American Magic Quantum Racing took the title.',
          'Кашкайш принимал крупнейшие события парусного спорта. С 28 июня по 13 июля 2007 года здесь прошёл чемпионат мира ISAF: все одиннадцать олимпийских дисциплин на пяти дистанциях и борьба за путёвки на Игры в Пекине. В августе 2011 года Кашкайш открыл первую серию America’s Cup World Series: девять команд гонялись на катамаранах AC45, а победила Emirates Team New Zealand. Clube Naval de Cascais регулярно принимает и гонки гран-при: здесь проходили чемпионаты мира класса TP52, в последний раз в июле 2025 года, когда титул завоевала American Magic Quantum Racing.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['A nortada comes off the land, so near the shore expect flat water but a gusty, shifting wind. One local racer warns that the breeze in the bay east of the marina arrives late and is very shifty, so the steadier wind is usually further west and offshore. Look upwind for dark patches, tack on the shifts and do not sail in too close under the land.',
          'Нортада дует с суши, так что у берега жди ровной воды, но порывистого и неустойчивого ветра. Один из местных гонщиков предупреждает: в бухте к востоку от марины ветер приходит поздно и очень неустойчив, так что ровнее он обычно западнее и дальше в море. Ищи на ветре тёмные пятна, поворачивай на заходах и не прижимайся слишком близко к суше.'],
        ['The wind usually builds through the afternoon, so choose your sails for what is coming rather than what you have at the start. Out on the swell, sail a little fuller upwind and catch the waves downwind, and check the tide against a buoy before the start.',
          'Днём ветер обычно усиливается, поэтому выбирай паруса в расчёте на то, что будет, а не на то, что есть на старте. На зыби иди на лавировке чуть полнее, на попутном лови волны и ещё до старта проверь течение по бую.'],
      ] },
    ],
  },

  chicago: {
    title: ['Sailing in Chicago: Lake Michigan and the Race to Mackinac', 'Яхтинг в Чикаго: озеро Мичиган и гонка до Макино'],
    description: [
      'Lake Michigan off Chicago: the lake breeze, cold fresh water, the Race to Mackinac and local tactics – and race it free in a 3D sailing game.',
      'Озеро Мичиган у Чикаго: озёрный бриз, холодная пресная вода, гонка до острова Макино и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Monroe Harbor lies at the foot of downtown Chicago, between Navy Pier and the Adler Planetarium, with the city’s towers rising straight from the lakefront. The Chicago Yacht Club has a station here, and each July its Race to Mackinac starts just off Navy Pier.',
      'Гавань Монро лежит у самого центра Чикаго, между пирсом Нейви и планетарием Адлера, а небоскрёбы города поднимаются прямо от набережной. Здесь находится одна из баз Чикагского яхт-клуба, и каждый июль неподалёку, у пирса Нейви, стартует его гонка до острова Макино.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Chicago stands on the west shore of the lake, so its thermal breeze comes in from the east. On a hot day the city can reach the 90s Fahrenheit while the water stays far cooler, and that contrast draws in a lake breeze that typically starts from the north-east and veers to the east-north-east as it strengthens, often lasting into the evening. A strong south-westerly can keep it offshore, and northerlies bring a bumpier sea because they have the whole length of the lake to build over.',
          'Чикаго стоит на западном берегу озера, поэтому термический бриз приходит сюда с востока. В жаркий день город прогревается выше 32 °C, а вода остаётся гораздо холоднее, и эта разница притягивает озёрный бриз: обычно он начинается с северо-востока, по мере усиления заходит к востоко-северо-востоку и часто держится до вечера. Сильный юго-западный ветер может не пустить его к берегу, а северные ветры разводят более крутую волну, потому что разгоняются по всей длине озера.'],
        ['Lake Michigan is fresh water, up to 281 metres deep and covering almost 58,000 square kilometres. The true tide is under 5 centimetres, but wind and air pressure can set up seiches, slow oscillations of the water level. Early in the summer the lake can still be around 10 °C, and water that cold creates strong wind shear, with the breeze at the masthead blowing harder and from a different angle than at deck level.',
          'Озеро Мичиган пресное, его глубина доходит до 281 метра, а площадь – почти 58 000 квадратных километров. Настоящий прилив здесь меньше 5 сантиметров, зато ветер и давление могут вызывать сейши – медленные колебания уровня воды. В начале лета вода в озере бывает всё ещё около 10 °C, и над такой холодной водой возникает сильный сдвиг ветра: у топа мачты он дует сильнее и под другим углом, чем у палубы.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Chicago Yacht Club was founded in 1875, and its Race to Mackinac, first sailed in 1898, is the oldest annual freshwater distance race in the world. The course runs 333 statute miles, or 289 nautical miles, up the length of Lake Michigan and under the Mackinac Bridge to a finish off Mackinac Island. The monohull record is 22 hours 24 minutes 23 seconds, set in 2024, and the multihull record of 18 hours 50 minutes 32 seconds has stood since Steve Fossett’s Stars & Stripes in 1998. The 117th race started in July 2026. SailGP’s foiling catamarans also raced off Navy Pier in 2022 and 2023.',
          'Чикагский яхт-клуб основан в 1875 году, а его гонка до Макино, впервые прошедшая в 1898 году, – старейшая ежегодная дальняя гонка на пресной воде в мире. Дистанция длиной 333 сухопутные, или 289 морских, миль ведёт через всё озеро Мичиган и под мостом Макино к финишу у острова Макино. Рекорд для однокорпусных лодок – 22 часа 24 минуты 23 секунды, установлен в 2024 году, а рекорд для многокорпусных, 18 часов 50 минут 32 секунды, держится с 1998 года, когда его поставил Stars & Stripes Стива Фоссетта. 117-я гонка стартовала в июле 2026 года. В 2022 и 2023 годах у пирса Нейви гонялись и катамараны SailGP на подводных крыльях.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['On a lake breeze day, watch the temperature on shore: the hotter the city, the stronger the breeze is likely to be. Once it is established it tends to veer, turning clockwise, so the right-hand side of the beat often pays as the afternoon goes on.',
          'В день озёрного бриза следи за температурой на берегу: чем жарче в городе, тем сильнее обычно бриз. Когда он установится, то обычно поворачивает по часовой стрелке, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['Cold water means shear, so give the sails more twist and expect a different trim on each tack. If the wind is blowing off the land, the strongest pressure is near the shore, but the city’s buildings make it unstable, so stay ready for big shifts and sudden gusts.',
          'Холодная вода означает сдвиг ветра по высоте, так что давай парусам больше твиста и будь готов к разной настройке на каждом галсе. Когда ветер дует с суши, самый сильный он у берега, но здания делают его неустойчивым, поэтому будь готов к большим заходам и внезапным порывам.'],
      ] },
    ],
  },

  'st-barths': {
    title: ['Sailing in St Barths: the trade wind and the Bucket', 'Яхтинг на Сен-Бартелеми: пассат и St Barths Bucket'],
    description: [
      'Gustavia’s trade winds, rocky courses, Les Voiles de St Barth, the St Barths Bucket and local tactics – and race it free in a 3D sailing game.',
      'Пассат Густавии, скалистые дистанции, Les Voiles de St Barth, St Barths Bucket и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Gustavia is the small capital of Saint-Barthélemy in the French Caribbean, set round a deep harbour on the sheltered western side of the island. France ceded the island to Sweden in 1784 and took it back in 1878, and the town still carries the name of the Swedish king Gustav III.',
      'Густавия – маленькая столица острова Сен-Бартелеми во Французской Вест-Индии; город раскинулся вокруг глубокой гавани на защищённой западной стороне острова. В 1784 году Франция уступила остров Швеции, а в 1878 году вернула его себе, и город до сих пор носит имя шведского короля Густава III.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The easterly trade wind sets the pattern here. Around the turn of the year it often blows hardest, in the strong spells known as the Christmas winds, and from about February to April it usually settles to 15 to 20 knots. In summer it tends to be lighter and to come from further south-east.',
          'Здесь всё определяет восточный пассат. На рубеже года он часто дует сильнее всего – это так называемые рождественские ветры, а примерно с февраля по апрель обычно устанавливается на 15–20 узлах. Летом он, как правило, слабее и заходит ближе к юго-востоку.'],
        ['Round the island the courses cross open water, rocks and small islets. Out in the trade wind the seas can be steep, while Gustavia’s side of the island gets some shelter from the land.',
          'Дистанции вокруг острова проходят через открытую воду, скалы и маленькие островки. На открытой воде в пассат волна бывает крутой, а сторона острова, где стоит Густавия, частично прикрыта сушей.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Bucket began in 1986 on Nantucket, when seven superyachts raced at a birthday celebration, and it has come to St Barths since 1995. Today’s event is a pursuit: the slowest yachts start first and the fastest last, so that the fleet should finish close together, on courses that go round the island in either direction. The 2026 edition ran from 12 to 15 March, and Hetairos won. Les Voiles de St Barth, first sailed in 2010, has been raced from Gustavia in April, with as many as 28 courses among the rocks and islands and a reputation for big breeze and big waves.',
          'История Bucket началась в 1986 году на острове Нантакет, где семь суперъяхт устроили гонку на праздновании дня рождения, а на Сен-Бартелеми регата приходит с 1995 года. Сегодня это гонка преследования: самые медленные яхты стартуют первыми, самые быстрые – последними, чтобы весь флот финишировал почти одновременно, а дистанции огибают остров в обоих направлениях. В 2026 году регата прошла с 12 по 15 марта, а победила Hetairos. Les Voiles de St Barth, впервые прошедшая в 2010 году, проводилась в апреле в Густавии: у судей было до 28 вариантов дистанции среди скал и островов, а славится регата сильным ветром и большой волной.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['An easterly has to cross the island before it reaches Gustavia, so close in it is gusty and shifty, and the steadier breeze lies further out. Look upwind for dark water, and take care not to sail into the wind shadow under the hills.',
          'Прежде чем добраться до Густавии, восточный ветер пересекает остров, так что у берега он порывистый и неустойчивый, а ровнее дальше в море. Ищи на ветре тёмную воду и не заходи в ветровую тень под холмами.'],
        ['Round the rocks and headlands the wind speeds up and bends, so plan each passage early and know exactly where the dangers lie. When you clear the end of the island expect more wind and a steeper sea: reef before you get there, and downwind ride every wave you can catch.',
          'У скал и мысов ветер ускоряется и искривляется, так что планируй каждый проход заранее и точно знай, где находятся опасности. Выходя из-за оконечности острова, жди более сильного ветра и более крутой волны: бери рифы заранее, а на попутном катись на каждой волне, какую сможешь поймать.'],
      ] },
    ],
  },

  qingdao: {
    title: ['Sailing in Qingdao: Fushan Bay and the 2008 Olympics', 'Яхтинг в Циндао: бухта Фушань и Олимпиада 2008 года'],
    description: [
      'Fushan Bay: the south-easterly sea breeze, big tides, fog and the 2008 Olympic regatta, with local tactics – and race it free in a 3D sailing game.',
      'Бухта Фушань: юго-восточный бриз, большие приливы, туман и олимпийская регата 2008 года, а ещё тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Qingdao is a port city on China’s Shandong Peninsula, looking out over the Yellow Sea. In August 2008 Fushan Bay, right in front of the city, staged the sailing of the Beijing Olympics, and the Olympic Sailing Centre built for the Games still stands on its shore.',
      'Циндао – портовый город на полуострове Шаньдун с видом на Жёлтое море. В августе 2008 года в бухте Фушань, прямо перед городом, прошли парусные гонки Олимпиады в Пекине, а построенный к Играм олимпийский парусный центр по-прежнему стоит на её берегу.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['South-easterlies are the wind of spring and summer on this coast. Sea breezes are most frequent from April to September and average only about 6 to 10 knots, so Qingdao is known above all for light, shifty wind. Fog can form on calm days, especially in April and May, and at the 2008 Games the light air of the first week gave way to severe storms during several of the medal races.',
          'Юго-восточные ветры преобладают здесь весной и летом. Морские бризы чаще всего дуют с апреля по сентябрь и в среднем достигают лишь 6–10 узлов, поэтому Циндао известен прежде всего слабым и неустойчивым ветром. В безветренные дни, особенно в апреле и мае, бывает туман, а на Играх 2008 года слабый ветер первой недели сменился сильной непогодой во время нескольких медальных гонок.'],
        ['The tide matters here. It is regular and semi-diurnal, with an average range of about 3 metres in neighbouring Jiaozhou Bay, so in a light breeze the stream can count for as much as the wind. Before the 2008 Games the venue also had a reputation for peculiar wave patterns.',
          'Приливы здесь важны. Они правильные полусуточные, со средним перепадом около 3 метров в соседней бухте Цзяочжоу, так что в слабый ветер течение может значить не меньше, чем сам ветер. Ещё до Игр 2008 года это место славилось и необычным характером волнения.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Olympic regatta ran from 9 to 21 August 2008, with 400 sailors from 62 nations racing in eleven events. In the weeks before it a huge bloom of green algae covered the sailing waters, and soldiers and volunteers cleared it in time for the Games. Great Britain topped the medal table with four golds, among them Ben Ainslie’s in the Finn, and Yin Jian won China’s first Olympic sailing gold in the women’s RS:X. The city has stayed on the sailing map since: the Volvo Ocean Race called here in its 2008–09 edition, and the Clipper Race arrived for the tenth time in March 2026.',
          'Олимпийская регата прошла с 9 по 21 августа 2008 года: 400 яхтсменов из 62 стран соревновались в одиннадцати дисциплинах. За несколько недель до неё акваторию затянуло огромное цветение зелёных водорослей, и военные с волонтёрами успели очистить её к Играм. Великобритания возглавила медальный зачёт с четырьмя золотыми наградами, одну из которых завоевал Бен Эйнсли в классе «Финн», а Инь Цзянь принесла Китаю первое олимпийское золото в парусном спорте в виндсёрфинге RS:X. Циндао и после Игр остаётся на парусной карте: сюда заходила Volvo Ocean Race 2008–09 годов, а в марте 2026 года в десятый раз прибыла Clipper Race.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Light air rewards patience. Keep the boat moving, stay in clear wind and sail towards the pressure, looking for the darker patches on the water. Like most sea breezes north of the equator, the south-easterly tends to veer, turning clockwise, as the afternoon goes on, so the right-hand side of the beat often pays later in the day.',
          'Слабый ветер вознаграждает терпение. Не давай лодке останавливаться, держись в чистом ветре и иди туда, где он сильнее, высматривая тёмные пятна на воде. Как большинство морских бризов к северу от экватора, юго-восточный бриз обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['Always know what the tide is doing. In 6 knots of wind a stream of even half a knot moves the laylines a long way, so check it against a buoy before the start and again at each mark. If fog comes down, keep track of where the marks and the other boats are.',
          'Всегда знай, что делает прилив. При ветре 6 узлов даже полуузловое течение сильно сдвигает лейлайны, так что проверяй его по бую перед стартом и снова у каждого знака. Если опустится туман, следи за тем, где находятся знаки и другие лодки.'],
      ] },
    ],
  },
};
