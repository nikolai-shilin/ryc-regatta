import type { T, Lang } from './lang';
import type { Guide } from './guides';

// Two more guides for /learn, on what people search for before they race: the points of sail, and how to tack and
// gybe. The same shape, voice and promise as lib/guides.ts: every claim about the game is what it does
// (public/game/sim.js, main.js, classes.js, world.js); change the game, change the guide.

// the rules guide on the Sailing Certification Test site, rule by rule
const rr = (lang: Lang, page: string) => `https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/${page}`;

// the game's pictures, 1920 × 1440 unless said
const shot = (src: string, alt: string, width = 1920, height = 1440) => ({ src: `/images/${src}.jpg`, width, height, alt });

export function moreGuide(slug: 'sail' | 'tack', t: T, lang: Lang): Guide {
  if (slug === 'sail') return {
    slug,
    title: t('Points of sail: from close-hauled to a run', 'Курсы относительно ветра: от бейдевинда до фордевинда'),
    short: t('Points of sail', 'Курсы относительно ветра'),
    kicker: t('Racing guides · points of sail', 'Пособия по гонкам · курсы'),
    img: shot('gd-sail-v1', t('Your boat close-hauled in the game, the fleet sailing upwind around her', 'Твоя лодка идёт в бейдевинд в игре, вокруг неё флот на лавировке'), 3840, 1600),
    description: t(
      'The points of sail: the no-go zone, close-hauled, reaching and running, how the sails are set on each, true and apparent wind, and which point is fastest.',
      'Курсы относительно ветра: мёртвый угол, бейдевинд, галфвинд, бакштаг и фордевинд, как ставить паруса, истинный и вымпельный ветер и какой курс быстрее.'),
    intro: t(
      'A boat’s point of sail is her angle to the wind, and it decides almost everything else: how the sails are set, how fast she goes and whether she can sail where you want at all. There are five to know, from close-hauled, as near the wind as she will go, round to a run, with the wind behind her.',
      'Курс относительно ветра — это угол лодки к ветру, и от него зависит почти всё остальное: как стоят паруса, как быстро она идёт и может ли вообще идти туда, куда тебе нужно. Знать надо пять курсов: от бейдевинда, так круто к ветру, как она ещё идёт, до фордевинда, когда ветер дует сзади.'),
    sections: [
      { id: 'nogo', h: t('The no-go zone', 'Мёртвый угол'), p: [
        t('No sailing boat can sail straight into the wind. Point within about 40° to 45° of it on either side and the sails flap and she stops. That arc, some 90° wide, is the no-go zone; a boat stuck head to wind in it, unable to steer, is in irons.',
          'Прямо против ветра не может идти ни одна парусная лодка. Направь нос ближе чем на 40–45° к ветру с любой стороны — паруса заполощут, и лодка остановится. Эта дуга шириной около 90° — мёртвый угол; лодка, которая встала в нём носом к ветру и не слушается руля, — в левентике.'),
        t('So to reach a mark that lies upwind she sails a zigzag, close-hauled on one tack and then on the other: a beat. In the game the red arc round your boat is the no-go zone for the wind you’re in, and the green marks at its ends are close-hauled on each tack.',
          'Поэтому к знаку, который лежит против ветра, лодка идёт зигзагом, в бейдевинд то одним галсом, то другим, — это лавировка. В игре красная дуга вокруг лодки — мёртвый угол для текущего ветра, а зелёные метки на её концах — бейдевинд на каждом галсе.'),
      ], tip: t('In irons, let the sheets out and hold the jib out to one side: the wind pushes the bow off the other way, and once the sails fill you can pull them in and sail off. In the game, steer away from the wind.',
        'Встал в левентик — потрави шкоты и вынеси стаксель на один борт: ветер оттолкнёт нос в другую сторону, а когда паруса наполнятся, выбери их и уходи. В игре просто рули от ветра.') },
      { id: 'close', h: t('Close-hauled and the close reach', 'Бейдевинд и полный бейдевинд'), p: [
        t('Close-hauled is as near the wind as the boat sails well: about 45° off the true wind for most cruisers and dinghies, nearer 40° for a racing keelboat. The sails are pulled in hard, the boom near the middle of the boat and the jib close in. Point higher and she pinches: the front of the jib lifts, and she slows and slips sideways.',
          'Бейдевинд — так круто к ветру, как лодка ещё хорошо идёт: около 45° к истинному ветру у большинства крейсерских яхт и швертботов и ближе к 40° у гоночной килевой лодки. Паруса выбраны туго, гик почти над серединой лодки, стаксель прижат. Пойдёшь круче — передняя кромка стакселя заполощет, лодка замедлится и начнёт сползать вбок.'),
        t('Bear away a little further and ease the sheets a little, and she is on a close reach: she points lower than close-hauled, but goes faster.',
          'Увались ещё немного, чуть потрави шкоты — и ты в полный бейдевинд: лодка идёт ниже, чем в крутой бейдевинд, зато быстрее.'),
      ], tip: t('Steer close-hauled by the jib: head up until its front edge just starts to lift, then bear away a touch until it stops. That edge is the edge of the no-go zone, and it moves with every shift.',
        'В бейдевинд рули по стакселю: приводись, пока его передняя кромка не начнёт заполаскивать, потом чуть увались, пока не перестанет. Эта кромка и есть граница мёртвого угла, и она сдвигается с каждым сдвигом ветра.') },
      { id: 'reach', h: t('Reaching: beam and broad', 'Галфвинд и бакштаг'), p: [
        t('A reach is a course across the wind. On a beam reach the wind comes square over the side, at 90°, and the sails are let out about halfway. On a broad reach it comes over the back quarter, between the beam and the stern, and they go out further still, the boom well out over the side.',
          'В галфвинд и бакштаг ветер дует сбоку. В галфвинд ветер дует ровно в борт, под 90°, и паруса потравлены примерно наполовину. В бакштаг он дует сзади-сбоку, между траверзом и кормой, и паруса потравлены ещё больше, гик далеко за бортом.'),
        t('On any reach the way to set a sail is the same: ease it until its front edge just starts to flap, then pull it back in until it stops. In a dinghy the centreboard goes up as you bear away: all the way down close-hauled, about halfway on a beam reach, mostly up on a run.',
          'На любом из этих курсов парус ставят одинаково: трави, пока передняя кромка не начнёт заполаскивать, потом выбирай, пока не перестанет. На швертботе шверт поднимают по мере того, как уваливаются: в бейдевинд он опущен полностью, в галфвинд — наполовину, на фордевинде почти поднят.'),
      ], tip: t('In the game the Kite button sets the gennaker once the wind is more than 100° off the bow, and it comes down in a hurry if you head up much above a beam reach with it set.',
        'В игре кнопка «Генакер» ставит генакер, когда ветер дует больше чем на 100° от носа, а если с поднятым генакером привестись заметно круче галфвинда, его в спешке убирают.') },
      { id: 'run', h: t('Running', 'Фордевинд'), p: [
        t('On a run the wind is behind you and the boat is pushed rather than pulled along. The main is let right out, the boom square across the boat, short of the shrouds. The jib, in the main’s wind shadow, goes limp: you can hold it out on the other side, goose-winged, or set a spinnaker or a gennaker instead.',
          'На фордевинде ветер дует сзади, и лодку не тянет, а толкает. Грот потравлен до конца, гик стоит поперёк лодки, не доходя до вант. Стаксель в ветровой тени грота обвисает: его можно вынести на другой борт — поставить паруса «бабочкой» — или вместо него поставить спинакер или генакер.'),
        t('Bear away past dead downwind and the wind gets behind the main from the other side: you are sailing by the lee, and the boom can come across on its own. So most boats, and all with an asymmetric gennaker, sail a few degrees either side of dead downwind and gybe between them.',
          'Увалишься дальше чистого фордевинда — ветер зайдёт за грот с другой стороны, и гик может перебросить сам. Поэтому большинство лодок, а с асимметричным генакером все, идут на несколько градусов в сторону от чистого фордевинда и делают между этими углами повороты фордевинд.'),
      ], tip: t('In the game the blue marks round your boat are the best angle downwind on each gybe for the wind you’re in; between them, dead downwind, she is slower.',
        'В игре синие метки вокруг лодки — лучший угол на попутном курсе на каждом галсе для текущего ветра; между ними, на чистом фордевинде, лодка идёт медленнее.') },
      { id: 'apparent', h: t('True and apparent wind', 'Истинный и вымпельный ветер'), p: [
        t('The true wind is the one you feel standing still. Once the boat moves she makes a wind of her own, from dead ahead, as you feel on a bicycle, and the two together are the apparent wind: the one the sails feel and the masthead wind indicator shows. It always blows from further forward than the true wind, except dead downwind. Upwind and across the wind it is stronger; downwind it is weaker, which is why a run feels gentler than it is.',
          'Истинный ветер — тот, что чувствуешь, стоя на месте. Когда лодка движется, она создаёт свой встречный ветер, как на велосипеде, и вместе они дают вымпельный ветер — тот, что чувствуют паруса и показывает флюгер на топе мачты. Он всегда дует ближе к носу, чем истинный, кроме чистого фордевинда. На лавировке и в галфвинд он сильнее истинного, на попутном курсе — слабее, поэтому на фордевинде ветер кажется тише, чем есть.'),
        t('The sails are trimmed to the apparent wind, so it moves the sheets. As she speeds up it swings forward and you pull in. In a gust it swings aft for a moment: upwind she can point a little higher, downwind go a little deeper. The faster the boat, the further forward it comes: the AC75 in the game, on her foils, sails at three times the wind’s speed, and her apparent wind stays ahead even heading downwind.',
          'Паруса настраивают по вымпельному ветру, и он двигает шкоты. Лодка разгоняется — он смещается к носу, и шкот надо выбрать. В порыве он на время смещается к корме: на лавировке можно идти чуть круче, на попутном — чуть глубже. Чем быстрее лодка, тем дальше к носу он заходит: AC75 в игре на крыльях идёт втрое быстрее ветра, и её вымпельный ветер остаётся впереди даже на попутном курсе.'),
      ], tip: t('The wind in a forecast is the true wind. In the game the sheet’s green band follows the apparent wind; the wind box and the ring round your boat show the true.',
        'В прогнозе — истинный ветер. В игре зелёная полоса на шкоте следует за вымпельным ветром, а окно ветра и кольцо вокруг лодки показывают истинный.') },
      { id: 'fast', h: t('Which point of sail is fastest', 'Какой курс самый быстрый'), p: [
        t('For most boats it is a reach. With the wind across her, more of the sails’ force drives her forward and less pushes her sideways than close-hauled, and the apparent wind is still strong. A heavy displacement boat is fastest about on the beam; a light one with a gennaker, in a breeze, on a broad reach, where she can plane and surf.',
          'У большинства лодок — галфвинд или бакштаг. Когда ветер дует поперёк, большая часть силы парусов толкает лодку вперёд, а меньшая, чем в бейдевинд, — вбок, и вымпельный ветер всё ещё сильный. Тяжёлая водоизмещающая лодка быстрее всего примерно в галфвинд, а лёгкая, с генакером и в хороший ветер, — в бакштаг, где она может глиссировать и ловить волну.'),
        t('In the game each yacht sails to her own speeds for every wind and angle. The J Class is fastest on a beam reach; the JPK 1050 with the wind some 110° to 135° off, further aft the harder it blows. For every one of them, the dead run is the slowest way downwind.',
          'В игре у каждой яхты свои скорости для каждого ветра и угла. J Class быстрее всего в галфвинд, JPK 1050 — когда ветер дует под 110–135°, и чем он сильнее, тем ближе к корме. И у всех чистый фордевинд — самый медленный попутный курс.'),
      ], tip: t('Fastest isn’t quickest to the mark. Upwind and downwind what counts is VMG, your speed towards the wind or away from it, and it is best close-hauled and at a downwind angle, not on the reaches between. The game shows your VMG with your speed.',
        'Самый быстрый курс — не самый короткий путь к знаку. На лавировке и на попутном важен VMG — скорость к ветру или от него, — а он лучше всего в бейдевинд и под попутным углом, а не на курсах между ними. Игра показывает VMG рядом со скоростью.') },
    ],
    more: [
      { label: t('Glossary: points of sail and turns', 'Словарь: курсы и повороты'), href: '/learn/glossary#close-hauled' },
      { label: t('Sail trim and boat speed', 'Настройка парусов и скорость лодки'), href: '/learn/trim' },
      { label: t('Sailing downwind', 'Попутные курсы'), href: '/learn/downwind' },
    ],
    try: { label: t('Sail a triangle', 'Пройди треугольник'), href: '/race/free', text: t(
      'Pick the triangle in a custom race: a beat, a tight reach out to the wing mark, a gybe there and a broad reach back — every point of sail in one lap.',
      'Выбери треугольник в своей гонке: лавировка, крутой галфвинд к боковому знаку, там поворот фордевинд и бакштаг обратно — все курсы за один круг.') },
  };

  return {
    slug,
    title: t('How to tack and gybe a sailboat', 'Как делать поворот оверштаг и фордевинд'),
    short: t('Tacking and gybing', 'Оверштаг и фордевинд'),
    kicker: t('Racing guides · tacking', 'Пособия по гонкам · повороты'),
    img: shot('gd-tack-v1', t('Your boat head to wind in the middle of a tack in the game', 'Твоя лодка стоит носом к ветру в середине поворота оверштаг в игре'), 3840, 1600),
    description: t(
      'How to tack and gybe a sailboat step by step: the calls, how far to turn, keeping speed, roll tacks, avoiding a crash gybe, which to choose and rule 13.',
      'Как делать поворот оверштаг и фордевинд шаг за шагом: команды, насколько поворачивать, как не терять ход, ролл-так, самопроизвольный поворот и правило 13.'),
    intro: t(
      'A tack turns the bow through the wind, from one tack to the other; a gybe turns the stern through it. Upwind you tack, downwind you gybe. Done well, each costs a little speed. Done badly, a tack leaves you stopped head to wind, and a gybe brings the boom across someone’s head.',
      'При повороте оверштаг через линию ветра проходит нос, и лодка переходит с галса на галс; при повороте фордевинд — корма. На лавировке поворачивают оверштаг, на попутном — фордевинд. Хороший поворот стоит немного скорости. Плохой оверштаг оставляет тебя стоять носом к ветру, а плохой фордевинд проносит гик над чьей-нибудь головой.'),
    sections: [
      { id: 'tack', h: t('The tack, step by step', 'Оверштаг шаг за шагом'), p: [
        t('Look first: clear water on the new tack, no boat you would tack in front of, and full speed, so that she carries her way through the wind. Call “Ready about” and wait for the crew’s “Ready”: the old jib sheet in hand, the new one ready.',
          'Сначала осмотрись: вода на новом галсе свободна, нет лодки, перед которой ты повернёшь, и ход полный, чтобы инерции хватило пройти линию ветра. Командуй «К повороту оверштаг!» и дождись ответа «Готов!»: рабочий шкот стакселя в руках, новый наготове.'),
        t('Call “Lee-oh” and put the helm over smoothly: a tiller pushed towards the sail, a wheel turned the way the bow is to go. As the jib starts to back, let its old sheet go and pull it in fast on the new side; the main comes across by itself. Straighten the helm as she comes onto close-hauled on the new tack. Then trim: the sheets a touch eased until she picks up speed, in hard once she has.',
          'Командуй «Поворот!» и плавно переложи руль: румпель — к парусу, штурвал — в ту сторону, куда должен пойти нос. Когда стаксель начнёт обстеняться, отдай старый шкот и быстро выбери новый; грот перейдёт сам. Выпрями руль, когда лодка ляжет в бейдевинд на новом галсе. Потом настрой паруса: шкоты чуть потравлены, пока лодка разгоняется, и выбраны туго, когда разогналась.'),
      ], tip: t('In the game, Tack — the button, or Space on a keyboard — does all of it: she turns to the same angle to the wind on the other tack and the crew calls it. Tacking by hand with the steering works too.',
        'В игре «Поворот» — кнопка или пробел на клавиатуре — делает всё это сам: лодка поворачивает на тот же угол к ветру на другом галсе, а команда даёт команды. Можно повернуть и рулём, вручную.') },
      { id: 'turn', h: t('How far, and keeping speed', 'Насколько поворачивать и как не терять ход'), p: [
        t('From close-hauled to close-hauled most boats turn through about 80° to 90°, twice their angle to the wind. Turn too slowly and she loses her way before the bow is through, and stops head to wind, in irons. Turn too hard and the rudder, across the flow, brakes her. A smooth, steady turn loses least; in waves, tack on a flat patch.',
          'Из бейдевинда в бейдевинд большинство лодок поворачивают примерно на 80–90° — на свой двойной угол к ветру. Повернёшь слишком медленно — лодка потеряет ход раньше, чем нос пройдёт ветер, и встанет в левентик. Слишком резко — руль поперёк потока затормозит её. Меньше всего теряет плавный, ровный поворот; в волну поворачивай на участке поглаже.'),
        t('Every tack costs speed, and building it again takes a while: longer in light air and in a heavy boat. Come out a few degrees below close-hauled with the sheets a little eased, let her accelerate, then head up to her proper angle. In light air, tack less.',
          'Каждый поворот стоит скорости, и набрать её снова удаётся не сразу: дольше в слабый ветер и на тяжёлой лодке. Выходи из поворота на несколько градусов ниже бейдевинда с чуть потравленными шкотами, дай лодке разогнаться и потом приведись до её угла. В слабый ветер поворачивай реже.'),
        t('Dinghy sailors roll tack: they heel her to windward as she turns, which helps her round, then cross and flatten her hard on the new side, which flicks the sail and gets her going. Rule 42 allows it, as long as she comes out no faster than she would have been without the tack.',
          'На швертботах делают поворот с раскачкой — ролл-так: в повороте кренят лодку на ветер, что помогает ей повернуть, а потом переходят на новый борт и резко её выравнивают, и этот рывок парусом разгоняет лодку. Правило 42 это разрешает, если после поворота лодка идёт не быстрее, чем шла бы без него.'),
      ], tip: t('There is no roll tack in the game. The Laser and the Optimist stop in a tack and go again at once; the J Class takes some three times as long as the JPK 1050. Come out of a tack slow and the game tells you to foot.',
        'В игре ролл-така нет. Laser и Optimist в повороте останавливаются и сразу идут дальше; J Class поворачивает примерно втрое дольше JPK 1050. Вышел из поворота без скорости — игра подскажет увалиться и разогнаться.') },
      { id: 'gybe', h: t('The gybe, step by step', 'Фордевинд шаг за шагом'), p: [
        t('Look first: clear water on the new gybe, and every head clear of the boom’s path. Call “Stand by to gybe”; on a keelboat the crew pull the main in towards the middle, so the boom has less far to swing.',
          'Сначала осмотрись: свободна ли вода на новом галсе и нет ли чьей-нибудь головы на пути гика. Командуй «К повороту фордевинд!»; на килевой лодке команда выбирает грот ближе к середине, чтобы гику было меньше лететь.'),
        t('Call “Gybe-oh” and bear away steadily. As the stern passes through the wind the boom comes across — in a dinghy, help it with a tug on the mainsheet — and everyone ducks. The moment it crosses, meet her with the helm: with the main filling on the new side she wants to round up. Let the main out on the new side, bring the jib across, and settle on the new course.',
          'Командуй «Поворот!» и ровно уваливайся. Когда корма проходит линию ветра, гик перелетает — на швертботе помоги ему, дёрнув гика-шкот, — и все пригибаются. Как только он перешёл, одерживай рулём: грот наполняется на новом борту, и лодка стремится привестись. Потрави грот на новом борту, перекинь стаксель и ложись на новый курс.'),
      ], tip: t('In the game the same button gybes once the wind is more than about 95° off the bow, and then reads Gybe. Steer through dead downwind by hand instead, turning steadily, and the crew brings the boom across as you go.',
        'В игре та же кнопка делает фордевинд, когда ветер дует больше чем на 95° от носа, и тогда на ней написано «Фордевинд». Можно и вручную: уваливайся через чистый фордевинд ровно, не останавливаясь, и команда перекинет гик по ходу.') },
      { id: 'crash', h: t('Avoid the crash gybe', 'Не допусти самопроизвольного поворота'), p: [
        t('A crash gybe is one you didn’t mean. Sailing by the lee, past dead downwind, the wind gets behind the main and throws the boom across at full speed. It can hurt anyone in its way and break gear, and in a breeze it lays the boat over and spins her round.',
          'Самопроизвольный поворот — это фордевинд, которого ты не хотел. Когда увалился дальше чистого фордевинда, ветер заходит за грот и со всей силы перебрасывает гик. Он может покалечить того, кто на пути, и сломать снаряжение, а в свежий ветер кладёт лодку на борт и разворачивает её.'),
        t('The warnings come first: the jib goes limp and floats across, the wind indicator at the masthead points to the boom’s side, the boom starts to lift. Head up a few degrees and they stop. Keep the kicker on to hold the boom down, and on a cruiser rig a preventer for a long run.',
          'Сначала будут предупреждения: стаксель обвисает и перетягивает на другой борт, флюгер на топе мачты показывает в сторону гика, гик начинает задираться. Приведись на несколько градусов — и всё прекратится. Держи оттяжку гика выбранной, чтобы гик не задирался, а на крейсерской яхте на долгом фордевинде ставь превентер.'),
      ], tip: t('The game warns you, “By the lee”, with the degrees. Drift on by the lee without turning and the boom comes across on its own: in a breeze she heels hard and slows, and with the gennaker up she can roll and round up.',
        'Игра предупреждает: «Увалился дальше фордевинда» — и на сколько градусов. Если идти так и дальше, не поворачивая, гик перебросит сам: в свежий ветер лодку сильно положит и затормозит, а с генакером её может положить и привести.') },
      { id: 'which', h: t('Tack or gybe?', 'Оверштаг или фордевинд?'), p: [
        t('Upwind, tack: to gybe from close-hauled you bear away through a run and come all the way back up, some 270° of turning and a lot of ground lost to leeward. Downwind, gybe, for the same reason the other way round. On a reach either will do: tack from a close or a beam reach, gybe from a broad one.',
          'На лавировке поворачивай оверштаг: чтобы сделать фордевинд из бейдевинда, надо увалиться через фордевинд и привестись обратно — около 270° поворота и много потерянного под ветер расстояния. На попутном курсе делай фордевинд — по той же причине, только наоборот. На галфвинде годится любой: из полного бейдевинда или галфвинда поворачивай оверштаг, из бакштага — фордевинд.'),
        t('A tack is the gentler of the two, the boom crossing slowly with the sails flapping. In a blow, or with a new crew, turning the long way round through a tack — a “chicken gybe” — costs distance, not gear.',
          'Оверштаг мягче: гик переходит медленно, паруса полощут. В сильный ветер или с новой командой повернуть длинным путём, через оверштаг, стоит расстояния, а не снаряжения.'),
      ], tip: t('A penalty turn is one of each, a tack and a gybe, turning the same way (rule 44.2).',
        'Штрафной оборот — это один оверштаг и один фордевинд в одну сторону (правило 44.2).') },
      { id: 'rule', h: t('Keep clear while you tack (rule 13)', 'Поворачивая, уступай (правило 13)'), p: [
        t('From the moment she passes head to wind until she is on a close-hauled course, a tacking boat keeps clear of everyone, on either tack (rule 13). Once on her new course she may have right of way, but must at first give the other boat room to keep clear (rule 15). A gybe has no rule of its own: she is on the new tack as soon as the boom comes across.',
          'С момента, когда лодка прошла положение левентик, и пока не легла в бейдевинд, она уступает всем, на каком бы галсе они ни шли (правило 13). Легла на новый курс — может получить право дороги, но сначала должна дать другой лодке место, чтобы уступить (правило 15). Для фордевинда отдельного правила нет: лодка на новом галсе, как только гик перешёл на другой борт.'),
        t('The computer boats in the game race by it: tack too close under their bows and they hail “You’re tacking — keep clear!”, and the foul is yours.',
          'Компьютерные лодки в игре гоняются по нему: повернёшь слишком близко у них перед носом — услышишь «Ты в повороте — уходи!», и нарушение твоё.'),
      ], tip: t('Tacking just ahead and to leeward of a boat, on her lee bow, puts her in your dirty air — but only if you are close-hauled before she has to change course to avoid you. A length short and it’s a foul.',
        'Поворот чуть впереди лодки и под ветер от неё ставит её в твою ветровую тень — но только если ты ляжешь в бейдевинд раньше, чем ей придётся менять курс, чтобы тебя избежать. Не хватит корпуса — нарушение.') },
    ],
    more: [
      { label: t('Sailing downwind: gybing with the gennaker', 'Попутные курсы: фордевинд с генакером'), href: '/learn/downwind' },
      { label: t('Right of way, rule by rule', 'Право дороги, правило за правилом'), href: rr(lang, 'rightofway') },
      { label: t('Glossary: tack and gybe', 'Словарь: оверштаг и фордевинд'), href: '/learn/glossary#tack' },
    ],
    try: { label: t('Try the drills', 'Попробуй тренировки'), href: '/race/drills', text: t(
      'The penalty turn drill times a tack and a gybe and the climb back to speed; the shifts drill is a beat of tacks on the headers.',
      'Тренировка «Штрафной оборот» засекает оверштаг, фордевинд и разгон после них, а «Сдвиги ветра» — это лавировка с поворотами на заходах.') },
  };
}
