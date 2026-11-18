import type { VenueGuide } from '../venue-guides';
import type { VenueId } from '../venues';

export const PART_4: Partial<Record<VenueId, VenueGuide>> = {
  naples: {
    title: ['Sailing in Naples: the America’s Cup bay', 'Яхтинг в Неаполе: залив Кубка «Америки»'],
    description: [
      'The Bay of Naples: the afternoon sea breeze, the 2027 America’s Cup, the 1960 Olympics and local tactics – and race it free in a 3D sailing game.',
      'Неаполитанский залив: дневной бриз, Кубок «Америки» 2027 года, Олимпиада 1960 года и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Naples races on the water between Posillipo and Castel dell’Ovo, in full view of the Via Caracciolo seafront, with Vesuvius across the bay and Capri and Ischia on the horizon. In 2027 this stretch of sea hosts the 38th America’s Cup, the first ever held in Italy.',
      'Неаполь гоняется на акватории между Позиллипо и замком Кастель-дель-Ово, на виду у набережной Караччоло; за заливом поднимается Везувий, а на горизонте видны Капри и Искья. В 2027 году здесь пройдёт 38-й Кубок «Америки» – первый, который примет Италия.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The racing wind is a thermal sea breeze. On a good day it fills in between about half past twelve and half past two, usually at 10 to 15 knots. It starts from around south-south-west, straight in from Capri and Ischia, and swings towards the south-west as the afternoon goes on. Local race officers rate mid-May to mid-June as the most reliable time of year; in September the breeze is lighter and less stable.',
          'Гоночный ветер здесь – термический морской бриз. В хороший день он приходит примерно между половиной первого и половиной третьего и обычно дует на 10–15 узлов. Сначала он идёт с юго-юго-запада, прямо со стороны Капри и Искьи, а ближе к вечеру смещается к юго-западу. Местные судьи считают самым надёжным временем года период с середины мая до середины июня; в сентябре бриз слабее и менее устойчив.'],
        ['Now and then a north-westerly mistral blows instead, and Posillipo bends it close to the shore. As elsewhere in the Mediterranean the tide is slight, and the current in the bay generally follows the wind, though after a long spell of offshore wind it takes time to come round. Swell can run in from a different direction to the wind, and ferries to the islands and commercial ships cross the bay all day.',
          'Иногда вместо бриза дует северо-западный мистраль, и у Позиллипо берег его искривляет. Как и везде в Средиземном море, прилив едва заметен, а течение в заливе обычно идёт по ветру, хотя после долгого ветра с берега разворачивается не сразу. Зыбь может приходить совсем не оттуда, откуда дует ветер, а паромы на острова и торговые суда пересекают залив весь день.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Gulf of Naples staged the sailing of the 1960 Rome Olympics, where Paul Elvstrøm won his fourth gold medal. Each spring the Regata dei Tre Golfi leaves from beneath Castel dell’Ovo, traditionally at midnight, for about 150 miles round the islands and a finish off Capri. The 38th America’s Cup is the biggest event the bay has seen: the teams are based at Bagnoli, the Race Village is on the Via Caracciolo, and the Match begins on 10 July 2027. A preliminary regatta in September 2026 was the first racing of this Cup on the bay.',
          'В Неаполитанском заливе прошли парусные гонки Олимпиады 1960 года в Риме, где Пауль Эльвстрём завоевал своё четвёртое золото. Каждую весну от стен Кастель-дель-Ово, по традиции в полночь, стартует Regata dei Tre Golfi: около 150 миль вокруг островов с финишем у Капри. 38-й Кубок «Америки» – самое крупное событие в истории залива: команды базируются в Баньоли, гоночная деревня разместится на набережной Караччоло, а сам матч начнётся 10 июля 2027 года. Предварительная регата в сентябре 2026 года стала первыми гонками этого Кубка в заливе.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Be ready for the breeze to arrive. Until it fills, the wind can be light and shifty, so keep clear air and look seaward for the darker water that marks the new wind. Once it is in, expect it to veer, turning clockwise, through the afternoon, so the right-hand side of the beat often pays later in the day.',
          'Будь готов к приходу бриза. Пока он не установился, ветер бывает слабым и неустойчивым, так что держись в чистом ветре и ищи в море тёмную воду – по ней виден новый ветер. Когда бриз задует, жди, что он будет поворачивать по часовой стрелке, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['In a north-westerly, stay out from under Posillipo: close to the headland the wind bends and drops, and the steadier breeze is further offshore. Check the swell as well as the wind before the start, since the two do not always line up, and keep a lookout for ferries, which cannot stop for a racing fleet.',
          'В северо-западный ветер не прижимайся к Позиллипо: у мыса ветер отклоняется и слабеет, а ровнее он дальше от берега. Перед стартом смотри не только на ветер, но и на зыбь – они не всегда идут с одной стороны. И следи за паромами: остановиться ради гоночного флота они не могут.'],
      ] },
    ],
  },

  'los-angeles': {
    title: ['Sailing in Los Angeles: San Pedro Bay and LA28', 'Яхтинг в Лос-Анджелесе: залив Сан-Педро и Олимпиада 2028 года'],
    description: [
      'San Pedro Bay’s afternoon sea breeze, the breakwater, the LA28 Olympic sailing and local tactics – and race it free in a 3D sailing game.',
      'Дневной бриз залива Сан-Педро, волнолом, олимпийские гонки LA28 и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'San Pedro Bay lies in front of the ports of Los Angeles and Long Beach, together the largest container port complex in the United States. The Federal Breakwater runs across the bay for more than eight miles, and outside it the Pacific opens up towards Catalina Island.',
      'Залив Сан-Педро лежит перед портами Лос-Анджелеса и Лонг-Бич, вместе образующими крупнейший контейнерный комплекс США. Федеральный волнолом тянется через залив больше чем на восемь миль, а за ним открывается Тихий океан с островом Санта-Каталина вдали.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Summer afternoons belong to the thermal sea breeze. The morning is often light, around 5 to 8 knots from the south or south-south-west; then the breeze builds and veers, reaching the west-south-west at 15 knots or more by mid-afternoon on a typical day. June is known for some of the most consistent sailing of the year.',
          'Летом после полудня здесь царит термический морской бриз. Утром ветер часто слабый, 5–8 узлов с юга или юго-юго-запада; потом он крепнет и поворачивает по часовой стрелке, и в обычный день к середине дня дует с запада-юго-запада на 15 узлов и больше. Июнь славится одними из самых стабильных условий в году.'],
        ['Other weather interrupts the pattern. A Catalina eddy, most often in spring, brings a lighter south to south-easterly, and passing fronts can bring a moderate to strong north-westerly. The breakwater, built in three sections between 1899 and 1949, shelters the harbours behind it: inside, the water is flat in the morning and chops up as the breeze builds, while outside the ocean swell runs in. A current sets along the coast here more or less all the time.',
          'Другая погода ломает эту картину. Вихрь Каталины, чаще всего весной, приносит более слабый южный или юго-восточный ветер, а проходящие фронты – умеренный или сильный северо-западный. Волнолом, построенный тремя участками между 1899 и 1949 годами, защищает гавани за ним: внутри по утрам вода ровная, а с усилением бриза появляется короткая волна, снаружи же заходит океанская зыбь. Вдоль берега здесь почти постоянно идёт течение.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Los Angeles has hosted Olympic sailing twice. In 1932 the fleets raced off Los Angeles Harbor, some classes outside the breakwater, and in 1984 the regatta was based at Long Beach. At LA28 the windsurfers and kiteboarders will race from Belmont Shore in Long Beach, and the dinghies, skiffs and multihulls from the Port of Los Angeles. Long Beach Yacht Club has run the Congressional Cup, a landmark of match racing, since 1965, and the Transpac to Honolulu, first sailed in 1906, starts off Point Fermin at the western edge of the bay.',
          'Лос-Анджелес уже дважды принимал олимпийские парусные гонки. В 1932 году флот гонялся у гавани Лос-Анджелеса, причём часть классов – за волноломом, а в 1984 году регата базировалась в Лонг-Бич. На Играх 2028 года виндсёрферы и кайтеры выйдут на воду в Белмонт-Шор в Лонг-Бич, а швертботы, скиффы и катамараны – из порта Лос-Анджелеса. Яхт-клуб Лонг-Бич с 1965 года проводит Congressional Cup, одну из главных регат в матчевых гонках, а гонка Transpac до Гонолулу, впервые прошедшая в 1906 году, стартует у мыса Пойнт-Фермин на западном краю залива.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Read the morning. Towering clouds over the mountains inland point to a strong afternoon breeze, while an overcast or misty start usually means a lighter one. As the day goes on the wind keeps veering, so once it passes about 240 degrees the right side of an ocean course tends to pay, and the first boats to reach the breakwater with leverage often lead.',
          'Читай утро. Высокие облака над горами в глубине суши обещают сильный дневной бриз, а пасмурное или туманное начало дня обычно означает более слабый. Ветер весь день поворачивает вправо, так что, когда он уходит примерно за 240 градусов, на океанской дистанции обычно выигрывает правая сторона, а лодки, первыми вышедшие к волнолому с правого фланга, часто и лидируют.'],
        ['Watch the haze line, which shows how the new pressure is filling across the course, and allow for the coastal current on every layline. Near the Seal Beach shore the chop is worse, because waves bounce back off the beach and meet the incoming swell, so sail for speed there rather than height.',
          'Следи за линией дымки: по ней видно, как новый ветер заполняет дистанцию, и учитывай прибрежное течение на каждом лейлайне. У берега Сил-Бич волна хуже: она отражается от пляжа и встречается с приходящей зыбью, так что там иди на скорость, а не на острый курс.'],
      ] },
    ],
  },

  'les-sables': {
    title: ['Sailing in Les Sables-d’Olonne: the Vendée Globe’s home', 'Яхтинг в Ле-Сабль-д’Олон: родной порт Vendée Globe'],
    description: [
      'Les Sables-d’Olonne: the Atlantic westerly, the tide, the Vendée Globe’s famous channel and local tactics – and race it free in a 3D sailing game.',
      'Ле-Сабль-д’Олон: атлантический западный ветер, приливы, знаменитый канал Vendée Globe и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Les Sables-d’Olonne faces the Bay of Biscay on France’s Vendée coast. A narrow channel leads in from the sea, with the old quarter of La Chaume on one side and on the other the town, whose Remblai promenade curves along the Grande Plage. Every four years the boats of the Vendée Globe go down it on their way round the world.',
      'Ле-Сабль-д’Олон смотрит на Бискайский залив с вандейского побережья Франции. С моря сюда ведёт узкий канал: на одном его берегу старый квартал Ла-Шом, на другом – город, чья набережная Ремблэ изгибается вдоль Гранд-Плаж. Раз в четыре года по этому каналу уходят в кругосветную гонку яхты Vendée Globe.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['This is open Atlantic water. The prevailing wind is westerly, blowing in across the Bay of Biscay with nothing to stop it, and weather systems moving in from the ocean can bring strong wind and rough seas. A south-westerly sends swell towards the harbour entrance, where waves can break, though inside the channel the harbours are well sheltered.',
          'Это открытая Атлантика. Преобладает западный ветер, который идёт через Бискайский залив, не встречая преград, а погодные системы с океана могут принести сильный ветер и крутую волну. Юго-западный ветер гонит зыбь ко входу в гавань, где волны могут разбиваться, зато за каналом гавани хорошо защищены.'],
        ['Unlike the Mediterranean, this coast has a real tide. The water rises and falls by four metres or more at springs. Off the port the flood stream runs east and the ebb west, reaching about a knot at springs.',
          'В отличие от Средиземного моря, приливы здесь настоящие: в сизигию уровень меняется на четыре метра и больше. У порта прилив несёт на восток, отлив – на запад, и в сизигию течение достигает примерно узла.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Vendée Globe, founded by Philippe Jeantot, first left here in 1989: a solo, non-stop, unassisted race round the world by the three great capes, held every four years. Crowds line both sides of the channel to see the skippers off and come back to cheer them home. The town is also the start and finish of the Golden Globe Race, sailed in the spirit of 1968, whose latest edition left in September 2026. Shorter ocean races start here too, among them Les Sables–Horta–Les Sables for the Class40s and the Mini Atlantique, a rehearsal for the Mini Transat.',
          'Vendée Globe, основанная Филиппом Жанто, впервые стартовала здесь в 1989 году: это одиночная кругосветная гонка без остановок и посторонней помощи мимо трёх великих мысов, которая проходит раз в четыре года. Толпы зрителей заполняют оба берега канала, чтобы проводить шкиперов, а потом возвращаются встречать их с финиша. Здесь же стартует и финиширует Golden Globe Race, гонка в духе 1968 года: в последний раз её участники ушли в море в сентябре 2026 года. Начинаются здесь и океанские гонки покороче – например, Les Sables–Horta–Les Sables для класса Class40 и Mini Atlantique, генеральная репетиция Mini Transat.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Work out the tide before the start. A knot of stream running east or west moves the laylines and changes the bias of the line, so check it against a buoy or an anchored boat, and know when it is due to turn.',
          'Разберись с течением ещё до старта. Узел течения на восток или на запад сдвигает лейлайны и меняет выгодный конец линии, так что проверь его по бую или стоящей на якоре лодке и знай, когда оно сменится.'],
        ['In a fresh westerly the waves matter as much as the shifts. Sail upwind a little fuller to keep the boat driving through the sea, and downwind steer down the face of each wave. Keep well clear of the harbour entrance when a swell is running: waves can stand up and break there.',
          'В свежий западный ветер волна значит не меньше, чем сдвиги. На лавировке иди чуть полнее, чтобы лодка продавливала волну, а на попутном уваливайся по склону каждой. Когда идёт зыбь, держись подальше от входа в гавань: волны там встают и разбиваются.'],
      ] },
    ],
  },

  dubai: {
    title: ['Sailing in Dubai: the Gulf’s shamal', 'Яхтинг в Дубае: шамаль Персидского залива'],
    description: [
      'The Gulf off Jumeirah: the north-westerly shamal, the sea breeze, SailGP in Dubai and local tactics – and race it free in a 3D sailing game.',
      'Залив у Джумейры: северо-западный шамаль, морской бриз, SailGP в Дубае и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Off Jumeirah the towers of Dubai line a low desert coast, with the sail-shaped Burj Al Arab on its own island, the fronds of the Palm to the south-west and the World islands offshore to the north-east. The water is the warm, shallow Gulf, and the wind that matters is the shamal.',
      'У Джумейры небоскрёбы Дубая выстроились вдоль низкого пустынного берега: на собственном острове стоит похожий на парус Бурдж-эль-Араб, к юго-западу раскинулись «ветви» Пальмы, а к северо-востоку, в море, лежат острова «Мир». Вода здесь – тёплый мелкий Персидский залив, а главный ветер – шамаль.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The shamal is the north-westerly that dominates the Gulf. In winter it follows cold fronts, on average two or three times a month from December to early March, and these are generally its strongest blows, raising dust that can cut visibility. In summer it comes from a different weather pattern and is steadier. Between shamals, a sea breeze comes in along the coast in the afternoon, most clearly in spring.',
          'Шамаль – северо-западный ветер, господствующий над Персидским заливом. Зимой он приходит вслед за холодными фронтами, в среднем два-три раза в месяц с декабря до начала марта, и именно тогда обычно дует сильнее всего, поднимая пыль, которая ухудшает видимость. Летом его порождает другая погодная система, и он устойчивее. Между шамалями после полудня вдоль берега приходит морской бриз, заметнее всего весной.'],
        ['This coast faces north-west, so a shamal blows straight onshore, and over the shallow Gulf it quickly raises a short, steep sea. Waves are higher in winter than in summer. The tide is modest, and behind the Palm and the other man-made islands the water is flatter.',
          'Этот берег обращён на северо-запад, поэтому шамаль дует прямо на него и над мелким заливом быстро разводит короткую крутую волну. Зимой волны выше, чем летом. Прилив невелик, а за Пальмой и другими насыпными островами вода ровнее.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Dubai Offshore Sailing Club opened in 1974 with little more than a palm-frond shade on the beach at Jumeirah, and its Dubai to Muscat race is the longest-running of its international events. Dubai International Marine Club at Mina Seyahi keeps an older tradition alive with its races for dhows. SailGP brought its foiling catamarans here in November 2022 for its first event in the Middle East, racing on a tight course in Port Rashid, and has been back since.',
          'Dubai Offshore Sailing Club открылся в 1974 году, и поначалу у него был лишь навес из пальмовых листьев на пляже Джумейры; его гонка Дубай – Маскат – старейшая из международных гонок клуба. Dubai International Marine Club в Мина-Сеяхи хранит более древнюю традицию, проводя гонки традиционных парусников-доу. В ноябре 2022 года SailGP впервые привезла на Ближний Восток свои катамараны на подводных крыльях и гонялась на тесной дистанции в порту Рашид, а потом возвращалась сюда снова.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In a shamal, think about the sea first. The waves come from the same direction as the wind, so sail a little fuller upwind to drive through them, and downwind pick the bigger ones and ride them. A cold front can bring squalls before the shamal sets in, so reef before it arrives.',
          'В шамаль думай прежде всего о волне. Она идёт с той же стороны, что и ветер, так что на лавировке иди чуть полнее, чтобы продавливать её, а на попутном выбирай волны покрупнее и катись на них. Холодный фронт может принести шквалы ещё до того, как установится шамаль, поэтому бери рифы заранее.'],
        ['On a sea breeze day, wait for the new wind and watch the water offshore for it. Like most sea breezes north of the equator, it tends to veer, turning clockwise, as the afternoon goes on, so the right-hand side of the beat often pays later in the day. Close to the towers the wind is bent and blocked, and the steadier breeze is further out.',
          'В день морского бриза дождись нового ветра и высматривай его в море. Как большинство морских бризов к северу от экватора, он обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки. У небоскрёбов ветер искривляется и перекрывается, а ровнее он дальше от берега.'],
      ] },
    ],
  },

  miami: {
    title: ['Sailing in Miami: Biscayne Bay and the Bacardi Cup', 'Яхтинг в Майами: залив Бискейн и Bacardi Cup'],
    description: [
      'Biscayne Bay’s easterly, its shallow water and currents, the Bacardi Cup and local tactics – and race it free in a 3D sailing game.',
      'Восточный ветер залива Бискейн, мелководье и течения, Bacardi Cup и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Biscayne Bay lies between the Miami mainland and the barrier islands, with Coconut Grove on its western shore and Key Biscayne to windward in the usual easterly. It is shallow, warm and open to the breeze, and its clubs have been racing here since the nineteenth century.',
      'Залив Бискейн лежит между материковым Майами и барьерными островами: на западном берегу – Коконат-Гроув, а на ветре при обычном восточном ветре – остров Ки-Бискейн. Залив мелкий, тёплый и открыт ветру, а местные клубы гоняются здесь ещё с XIX века.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Easterlies are the rule, and on the best days the breeze is under 15 knots. Spring and autumn are the most settled seasons. In winter, cold fronts drive the weather: the wind swings round through the south-west to the north-west, and the north-westerly behind a front is shifty and up and down, more like sailing on a lake.',
          'Здесь преобладают восточные ветры, и в лучшие дни бриз не превышает 15 узлов. Самые спокойные сезоны – весна и осень. Зимой погоду определяют холодные фронты: ветер уходит через юго-запад на северо-запад, а северо-западный ветер за фронтом неустойчив и то крепнет, то стихает – как на озере.'],
        ['Most of the bay is only two to four metres deep, so the wind raises a short chop but no ocean swell. The current is less simple than it looks. It runs in and out through Bear Cut, by Key Biscayne, and across much of the bay it ebbs towards the north-east and floods back to the south-west. The turn can come up to an hour away from high or low water, so the tide table is only a rough guide.',
          'Глубина почти всего залива – всего два-четыре метра, поэтому ветер разводит короткую волну, но океанской зыби здесь нет. С течением всё не так просто, как кажется. Оно входит и выходит через пролив Бэр-Кат у Ки-Бискейна, а на большей части залива в отлив идёт на северо-восток, в прилив – обратно на юго-запад. Смена течения может отставать от полной и малой воды на целый час, так что таблица приливов даёт лишь примерный ориентир.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Bacardi Cup is the bay’s great event. It began in Havana in 1927 as a regatta for the Star class, and since 1962 it has been sailed on Biscayne Bay, hosted by the Coral Reef Yacht Club in Coconut Grove each March. Biscayne Bay Yacht Club, founded in 1887 with the pioneer Ralph Munroe as its first commodore, is one of Florida’s oldest clubs, and the US Sailing Center in Miami has hosted the Olympic classes at the Miami Olympic Classes Regatta since 1990.',
          'Главное событие залива – Bacardi Cup. Эта регата для класса «Звёздный» началась в Гаване в 1927 году, а с 1962 года проходит в заливе Бискейн: каждый март её принимает яхт-клуб Coral Reef в Коконат-Гроув. Biscayne Bay Yacht Club, основанный в 1887 году, – один из старейших клубов Флориды, а его первым коммодором стал местный первопроходец Ральф Манро. С 1990 года в US Sailing Center в Майами проходит регата олимпийских классов Miami Olympic Classes Regatta.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['In the usual easterly, look left. With the wind from the east or south-east there is often more pressure towards the end of Key Biscayne and a useful shift off the land, and an outgoing current makes the left side better still. The advantage fades further south down the bay, so it depends on where the course is laid.',
          'При обычном восточном ветре смотри влево. Когда дует с востока или юго-востока, ближе к оконечности Ки-Бискейна ветер часто сильнее, а с суши приходит выгодный сдвиг; при отливном течении левая сторона становится ещё лучше. Дальше к югу по заливу это преимущество сходит на нет, так что всё зависит от того, где поставлена дистанция.'],
        ['Check the current at every mark, because you cannot see it in the colour of the water; lines of seaweed are the best clue. After a front, treat the north-westerly like lake sailing: stay in phase with the shifts and look for the puffs coming off the mainland shore.',
          'Проверяй течение у каждого знака: по цвету воды его не увидишь, лучшая подсказка – полосы водорослей. После фронта относись к северо-западному ветру как к озёрному: лови сдвиги и ищи порывы, идущие с материкового берега.'],
      ] },
    ],
  },

  split: {
    title: ['Sailing in Split: the maestral and the Split Channel', 'Яхтинг в Сплите: маэстрал и Сплитский канал'],
    description: [
      'The Split Channel: the summer maestral, bura and jugo, the Mrduja Regatta and local tactics – and race it free in a 3D sailing game.',
      'Сплитский канал: летний маэстрал, бура и юго, Мрдуйская регата и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Split looks south over the Split Channel, with the Roman walls of Diocletian’s Palace behind the Riva and the wooded hill of Marjan on the peninsula to the west. Across the water lie the islands of Brač and Šolta, and the mountains rise steeply behind the city.',
      'Сплит смотрит на юг, на Сплитский канал: за набережной Рива стоят римские стены дворца Диоклетиана, а на полуострове к западу поднимается лесистый холм Марьян. За водой лежат острова Брач и Шолта, а позади города круто встают горы.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['In summer the wind is the maestral, a north-westerly that usually starts lightly around midday, builds through the afternoon and dies away in the evening. Bura and jugo belong mainly to the colder months. The bura is a cold, dry north-easterly that falls off the mountains in hard gusts; the jugo is a moist south-easterly that builds more slowly and can blow for days.',
          'Летом здесь дует маэстрал – северо-западный ветер, который обычно начинается слабо около полудня, крепнет днём и стихает к вечеру. Бура и юго приходят в основном в холодное время года. Бура – холодный сухой северо-восточный ветер, срывающийся с гор жёсткими порывами; юго – влажный юго-восточный ветер, который набирает силу медленнее и может дуть по нескольку дней.'],
        ['The tide hardly counts: the mean daily range at Split is only about 23 centimetres, and strong wind and air pressure can move the sea level more than the tide does. Brač and Šolta keep out the open Adriatic’s biggest waves, so the channel is relatively sheltered water.',
          'Прилив здесь почти ничего не значит: средний суточный перепад в Сплите – всего около 23 сантиметров, а сильный ветер и атмосферное давление могут менять уровень моря сильнее, чем прилив. Брач и Шолта не пускают сюда самые большие волны открытой Адриатики, так что вода в канале относительно защищённая.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The great event is the Mrduja Regatta, first sailed in October 1927 and run by the Split club Labud. It takes its name from the islet of Mrduja in the Split Gates, the strait between Brač and Šolta, and is raced over a course of 22 miles. Apart from the war years of 1941 to 1945 it has been sailed almost every autumn since, and in 2006 it drew 312 boats. Split has produced Olympic medallists too: Tonči Stipanović, born in the city, won silver in the Laser at Rio in 2016 and again at Tokyo.',
          'Главное событие – Мрдуйская регата, впервые прошедшая в октябре 1927 года; её проводит сплитский клуб «Лабуд». Название ей дал островок Мрдуя в Сплитских воротах – проливе между Брачем и Шолтой, а длина дистанции – 22 мили. Если не считать военных 1941–1945 годов, регата с тех пор проходит почти каждую осень, а в 2006 году собрала 312 лодок. Есть в Сплите и свои олимпийские призёры: уроженец города Тончи Стипанович завоевал серебро в классе «Лазер» в Рио в 2016 году и повторил успех в Токио.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Time the maestral. Before it fills in the channel can be almost still, and the first boats to reach the new wind gain quickly. Like most afternoon sea breezes north of the equator, it tends to veer, turning clockwise, as the day goes on, so the right-hand side of the beat often pays later on.',
          'Подгадай момент прихода маэстрала. Пока он не задул, в канале может стоять почти полный штиль, и первые лодки, поймавшие новый ветер, быстро уходят вперёд. Как большинство дневных морских бризов к северу от экватора, он обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['Close to Marjan the wind is blocked and bent, so the breeze is usually steadier out in the channel, away from the city shore. If a bura is forecast, expect strong, gusty wind off the land: reef early, keep the boat flat and watch the water upwind for the dark patches that mark each gust.',
          'У Марьяна ветер перекрывается и искривляется, так что ровнее он обычно в середине канала, вдали от городского берега. Если обещают буру, жди сильного порывистого ветра с суши: бери рифы заранее, держи лодку ровно и высматривай на ветре тёмные пятна – так выглядит каждый порыв.'],
      ] },
    ],
  },

  monaco: {
    title: ['Sailing in Monaco: the Riviera’s sea breeze', 'Яхтинг в Монако: морской бриз Ривьеры'],
    description: [
      'Monaco’s sea breeze, the Ligurian Sea’s current, the Primo Cup, Monaco Classic Week and local tactics – and race it free in a 3D sailing game.',
      'Морской бриз Монако, течение Лигурийского моря, Primo Cup, Monaco Classic Week и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Monaco races on the Ligurian Sea just outside Port Hercule, with the Rock on one side of the harbour, the towers of Monte Carlo on the other and the Alps climbing straight up behind. The Yacht Club de Monaco stands on the quay, in a ship-like clubhouse designed by Norman Foster and opened in 2014.',
      'Монако гоняется в Лигурийском море прямо у выхода из порта Эркюль: по одну сторону гавани – Скала, по другую – башни Монте-Карло, а сразу за ними поднимаются Альпы. На набережной стоит Яхт-клуб Монако – похожее на корабль здание по проекту Нормана Фостера, открытое в 2014 году.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['Summer mornings are often calm. As the land warms, an easterly to south-easterly sea breeze of about 10 to 15 knots comes in across the Ligurian Sea in the afternoon. The cooler months are less predictable: the club’s winter regattas have raced in a 13 to 17 knot easterly and in a 20 to 25 knot south-westerly. A strong north-westerly can also wrap round Cap Ferrat, and south-westerly and easterly blows send heavy swell along this coast.',
          'Летним утром здесь часто штиль. Когда суша прогревается, после полудня через Лигурийское море приходит восточный или юго-восточный морской бриз на 10–15 узлов. В холодное время года ветер менее предсказуем: на зимних регатах клуба гонялись и при восточном ветре 13–17 узлов, и при юго-западном 20–25 узлов. Сильный северо-западный ветер может огибать мыс Кап-Ферра, а юго-западные и восточные ветры гонят вдоль берега тяжёлую зыбь.'],
        ['The tide is barely noticeable. The Northern Current runs westwards along this coast, and in winter it is stronger and closer to the shore. In summer the traffic of yachts and launches off the port adds a short, confused chop.',
          'Прилив почти незаметен. Вдоль берега на запад идёт Северное течение; зимой оно сильнее и ближе к суше. А летом яхты и катера у порта добавляют короткую беспорядочную толчею.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Prince Rainier III founded the Yacht Club de Monaco in 1953, and Prince Albert II has been its president since 1984. The Primo Cup, launched in 1985, brings one-design keelboats to the bay each winter and closes the club’s Monaco Sportsboat Winter Series, raced from November to March. Monaco Classic Week, held every two years since 1994, fills Port Hercule with classic yachts, and the club’s flagship is Tuiga, a 15-metre built in 1909.',
          'Князь Ренье III основал Яхт-клуб Монако в 1953 году, а с 1984 года его президент – князь Альбер II. Primo Cup, впервые прошедший в 1985 году, каждую зиму собирает в заливе монотипные килевые яхты и завершает серию Monaco Sportsboat Winter Series, которая идёт с ноября по март. Monaco Classic Week раз в два года, начиная с 1994-го, заполняет порт Эркюль классическими яхтами, а флагман клуба – пятнадцатиметровая Tuiga постройки 1909 года.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Wait for the sea breeze, and watch for it filling from offshore as a line of darker water. Like most sea breezes north of the equator, it tends to veer, turning clockwise, as the afternoon goes on, so the right-hand side of the beat often pays later in the day.',
          'Дождись морского бриза и высматривай, как он заполняет воду со стороны моря тёмной полосой. Как большинство морских бризов к северу от экватора, он обычно поворачивает по часовой стрелке по мере того, как день идёт, поэтому ближе к вечеру часто выигрывает правая сторона лавировки.'],
        ['The mountains make the wind near the shore patchy and shifty, so the steadier breeze is usually further out. Allow for the westward set of the current on long legs and on the layline to a mark, and keep clear of boats entering and leaving the port.',
          'Из-за гор ветер у берега пятнистый и неустойчивый, так что ровнее он обычно дальше в море. На длинных галсах и на лейлайне к знаку учитывай снос течением на запад и держись подальше от судов, входящих в порт и выходящих из него.'],
      ] },
    ],
  },

  fremantle: {
    title: ['Sailing in Fremantle: the Doctor and the 1987 America’s Cup', 'Яхтинг во Фримантле: «Доктор» и Кубок «Америки» 1987 года'],
    description: [
      'Gage Roads and the Fremantle Doctor, the 1987 America’s Cup, SailGP at Perth and local tactics – and race it free in a 3D sailing game.',
      'Гейдж-Роудс и «Фримантлский доктор», Кубок «Америки» 1987 года, SailGP в Перте и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Gage Roads is the stretch of the Indian Ocean off Fremantle, the port city next to Perth in Western Australia, with Rottnest Island about 19 kilometres offshore. In the summer of 1986–87 the America’s Cup was raced here, in one of sailing’s most famous winds.',
      'Гейдж-Роудс – участок Индийского океана у Фримантла, портового города рядом с Пертом в Западной Австралии; примерно в 19 километрах от берега лежит остров Роттнест. Летом 1986–87 годов здесь разыгрывали Кубок «Америки» – при одном из самых знаменитых ветров в парусном спорте.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The Fremantle Doctor is the summer sea breeze of this coast. It typically arrives between mid-morning and mid-afternoon, often at 15 to 20 knots near the coast, and it is strongest in December and January. It starts from the west-south-west, blows from the south-west or south-south-west at its peak and comes round to the south by early evening. On the days it fails, hot easterlies off the interior can push Perth past 40 °C.',
          '«Фримантлский доктор» – летний морской бриз этого побережья. Обычно он приходит между серединой утра и серединой дня, у берега часто дует на 15–20 узлов и сильнее всего бывает в декабре и январе. Начинается он с запада-юго-запада, в полную силу дует с юго-запада или юго-юго-запада, а к началу вечера заходит к югу. В дни, когда бриза нет, горячие восточные ветры из глубины материка могут поднять температуру в Перте выше 40 °C.'],
        ['Gage Roads lies between Rottnest and Garden Island, which give it partial shelter from the open ocean. The tide is small, around a metre or less. Outside the summer months the sea breeze weakens, and fronts take over as the main source of wind.',
          'Гейдж-Роудс лежит между островами Роттнест и Гарден, которые частично прикрывают его от открытого океана. Прилив невелик – около метра или меньше. Вне летних месяцев морской бриз слабеет, и главным источником ветра становятся фронты.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['Australia II’s win for the Royal Perth Yacht Club in 1983 brought the America’s Cup to Western Australia. The 1987 match, the last sailed in 12-metre yachts, was raced in Gage Roads: Dennis Conner’s Stars & Stripes 87, for the San Diego Yacht Club, beat Kookaburra III 4–0. The waters off Fremantle hosted the ISAF Sailing World Championships in December 2011, and SailGP’s catamarans raced off Bathers Beach for the first time in January 2026.',
          'Победа Australia II под флагом Королевского яхт-клуба Перта в 1983 году привела Кубок «Америки» в Западную Австралию. Матч 1987 года, последний на яхтах класса 12 метров, прошёл в Гейдж-Роудс: Stars & Stripes 87 Денниса Коннера, выступавшая за яхт-клуб Сан-Диего, обыграла Kookaburra III со счётом 4–0. В декабре 2011 года у Фримантла прошёл чемпионат мира ISAF по парусному спорту, а в январе 2026 года у пляжа Батерс-Бич впервые гонялись катамараны SailGP.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Time your race for the Doctor. It arrives from the sea, and the boats that reach it first gain quickly. Sea breezes in the southern hemisphere tend to back, turning anticlockwise, and the Doctor does just that, so the left-hand side of the beat often pays as the afternoon goes on.',
          'Рассчитывай гонку на приход «Доктора». Он идёт с моря, и лодки, первыми поймавшие его, быстро уходят вперёд. Морские бризы в Южном полушарии обычно поворачивают против часовой стрелки, и «Доктор» – не исключение, поэтому ближе к вечеру часто выигрывает левая сторона лавировки.'],
        ['When it is blowing hard, boat handling counts for more than fine tactics. Depower early and keep the boat flat, drive through the chop upwind and catch the waves downwind. Near the shore and the harbour the wind is less steady, so the cleaner breeze is usually further out.',
          'Когда дует сильно, работа с лодкой значит больше, чем тонкая тактика. Заранее уменьшай мощность парусов, держи лодку ровно, на лавировке продавливай волну, а на попутном лови каждую. У берега и порта ветер менее устойчив, так что чище он обычно дальше в море.'],
      ] },
    ],
  },

  'sint-maarten': {
    title: ['Sailing in St. Maarten: trade winds and the Heineken Regatta', 'Яхтинг на Синт-Мартене: пассат и Heineken Regatta'],
    description: [
      'Simpson Bay’s trade winds, the St. Maarten Heineken Regatta, Maho Beach and local tactics – and race it free in a 3D sailing game.',
      'Пассат залива Симпсон, St. Maarten Heineken Regatta, пляж Махо и местная тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Simpson Bay lies on the south-west coast of Sint Maarten, the Dutch side of an island shared with French Saint-Martin. Planes come in low over Maho Beach to Princess Juliana airport at the western end of the bay, and a bridge leads from the bay into the big lagoon behind it.',
      'Залив Симпсон лежит на юго-западном берегу Синт-Мартена – нидерландской части острова, который он делит с французским Сен-Мартеном. В западном конце залива самолёты низко проходят над пляжем Махо, заходя на посадку в аэропорт принцессы Юлианы, а разводной мост ведёт из залива в большую лагуну за ним.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The trade wind blows from the east for most of the year, generally at 10 to 25 knots. In winter it tends to swing north-east and blow harder, and the strong spells of that season are known as the Christmas winds. In summer it is usually calmer and comes from further south-east. That is also the hurricane season: Hurricane Irma devastated the island in September 2017 and left the lagoon full of wrecks.',
          'Пассат дует с востока большую часть года, обычно на 10–25 узлов. Зимой он чаще заходит к северо-востоку и усиливается; такие периоды сильного ветра называют рождественскими ветрами. Летом он обычно спокойнее и дует ближе к юго-востоку. На это же время приходится сезон ураганов: в сентябре 2017 года ураган «Ирма» опустошил остров и оставил лагуну полной затонувших судов.'],
        ['Simpson Bay is on the sheltered side of the island, so the sea is far calmer here than on the windward coast, where strong trades have built four-metre seas. The bay is comfortable in a normal easterly, but a wind from the south or a large swell makes it rolly.',
          'Залив Симпсон находится на подветренной стороне острова, поэтому море здесь гораздо спокойнее, чем на наветренном берегу, где при сильном пассате бывали четырёхметровые волны. В обычный восточный ветер в заливе комфортно, но при южном ветре или большой зыби здесь сильно качает.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The St. Maarten Heineken Regatta began in 1980 with just 12 boats and took Heineken’s name in 1983. Run by the Sint Maarten Yacht Club, whose clubhouse stands next to the Simpson Bay Bridge, it is held on the first weekend of March, and its fleet reached a record 284 boats in 2008. Its motto is “Serious Fun”. The racing ranges from round-the-island courses to point-to-point legs, and boats stream out through the bridge from the lagoon to the start.',
          'St. Maarten Heineken Regatta началась в 1980 году всего с 12 лодок, а в 1983 году получила имя Heineken. Её проводит яхт-клуб Синт-Мартена, чьё здание стоит рядом с мостом Симпсон-Бэй, а проходит она в первые выходные марта; рекордный флот – 284 лодки – собрался в 2008 году. Девиз регаты – «Serious Fun», то есть «серьёзное веселье». Гонки идут и вокруг острова, и от точки к точке, а на старт лодки вереницей выходят из лагуны через мост.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Play the island. The hills bend the trade wind, so on the sheltered side it is gustier and shiftier, and it can come through harder round the headlands. Look upwind for dark water and sail to it, and take care not to sail into the wind shadow close under the land.',
          'Играй с островом. Холмы искривляют пассат, поэтому с подветренной стороны он порывистее и неустойчивее, а у мысов может задувать сильнее. Ищи на ветре тёмную воду и иди к ней, но не заходи в ветровую тень у самого берега.'],
        ['On the windward side, expect more wind and a much bigger sea than in Simpson Bay, so reef before you round the point. Downwind in the trades, catch each wave and ride it, and on the long legs stay in the stronger breeze rather than sailing the shortest line.',
          'С наветренной стороны жди более сильного ветра и гораздо большей волны, чем в заливе Симпсон, так что бери рифы ещё до того, как обогнёшь мыс. На попутном в пассате лови каждую волну и катись на ней, а на длинных отрезках держись в более сильном ветре, а не на кратчайшей линии.'],
      ] },
    ],
  },

  phuket: {
    title: ['Sailing in Phuket: the King’s Cup and the north-east monsoon', 'Яхтинг на Пхукете: Кубок короля и северо-восточный муссон'],
    description: [
      'The Andaman Sea off Kata: the north-east monsoon, the tide, the Phuket King’s Cup Regatta and local tactics – and race it free in a 3D sailing game.',
      'Андаманское море у Каты: северо-восточный муссон, приливы, Phuket King’s Cup Regatta и тактика – и гоняйся здесь бесплатно в 3D-игре.',
    ],
    intro: [
      'Kata and Karon are neighbouring beaches on the west coast of Phuket, Thailand’s largest island, looking out over the Andaman Sea. Around November the monsoon turns, the rain eases and the sailing season begins, and in the first week of December the Phuket King’s Cup Regatta races just off the beach.',
      'Ката и Карон – соседние пляжи на западном берегу Пхукета, самого большого острова Таиланда, с видом на Андаманское море. Примерно в ноябре муссон меняется, дожди стихают и начинается парусный сезон, а в первую неделю декабря прямо у пляжа проходит Phuket King’s Cup Regatta.',
    ],
    sections: [
      { h: ['The water and the wind', 'Вода и ветер'], p: [
        ['The north-east monsoon blows from about November to April, bringing dry weather and winds of around 5 to 20 knots. It crosses the island before it reaches Kata and is usually at its most reliable in the morning; on lighter days a weak sea breeze can come in from the water in the afternoon. Some years it blows hard, with gusts of 25 knots, and in others the fleet has to wait for wind.',
          'Северо-восточный муссон дует примерно с ноября по апрель, принося сухую погоду и ветер около 5–20 узлов. До Каты он доходит, пересекая остров, и надёжнее всего обычно по утрам; в слабые дни после полудня с моря может прийти лёгкий бриз. В одни годы дует сильно, с порывами до 25 узлов, а в другие флоту приходится ждать ветра.'],
        ['Seas are generally calm in this season, and calmest from late January to April. The south-west monsoon, from May to October, is the opposite: rain, stronger gusts and swell rolling in on the west coast. The tide is far from negligible, with up to about three metres between high and low water.',
          'Море в этот сезон обычно спокойное, а спокойнее всего – с конца января по апрель. Юго-западный муссон с мая по октябрь – полная противоположность: дожди, более сильные порывы и зыбь, накатывающая на западный берег. Приливы здесь вполне ощутимы: разница между полной и малой водой доходит примерно до трёх метров.'],
      ] },
      { h: ['The regattas', 'Регаты'], p: [
        ['The Phuket King’s Cup Regatta was first held in 1987 to mark the 60th birthday of King Bhumibol, and the Royal Varuna Yacht Club holds the rights to it. The first edition was based near Nai Harn Beach, at the island’s southern tip, and the regatta’s headquarters moved to Kata in 1998. Keelboats race on courses laid about a mile off the beach, while dinghies such as the Optimist, ILCA and 420 sail closer in.',
          'Phuket King’s Cup Regatta впервые прошла в 1987 году в честь 60-летия короля Пхумипона, а права на неё принадлежат Королевскому яхт-клубу «Варуна». Первая регата базировалась у пляжа Най-Харн на южной оконечности острова, а в 1998 году штаб переехал на Кату. Килевые яхты гоняются примерно в миле от пляжа, а швертботы – «Оптимист», ILCA и 420 – ближе к берегу.'],
      ] },
      { h: ['Racing here', 'Как здесь гоняться'], p: [
        ['Use the morning wind. A north-easterly has crossed the island, so near the shore expect it to be gusty and shifty over flatter water, and steadier further out, where there is more sea. Dark patches show the puffs coming off the land, so tack on the shifts and sail to the pressure.',
          'Используй утренний ветер. Северо-восточный ветер проходит над островом, поэтому у берега он порывистый и неустойчивый, зато вода там ровнее, а дальше в море ветер устойчивее, но и волна больше. Тёмные пятна показывают порывы с суши: поворачивай на заходах и иди туда, где ветер сильнее.'],
        ['On light days patience wins. As the north-easterly fades, a sea breeze can fill in from the water, with a band of calm between the two, so be on the side the new wind is coming from. Keep an eye on the tide as well: with up to three metres of rise and fall, the stream can matter when the wind is light.',
          'В слабый ветер побеждает терпение. Когда северо-восточный ветер стихает, с моря может прийти бриз, а между ними ляжет полоса штиля, так что будь на той стороне, откуда идёт новый ветер. Не забывай и о приливе: при перепаде до трёх метров в слабый ветер течение может сыграть свою роль.'],
      ] },
    ],
  },
};
