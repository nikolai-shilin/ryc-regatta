import type { T, Lang } from './lang';

// The guides at /learn: short, plain pages on the things a race is won by, each ending in the game, where you can try
// it. Written for people who search for them (and for the AI assistants that answer them), so each one teaches the
// thing itself and not just the game. Every claim about the game is what it does (public/game/sim.js, main.js); change
// the game, change the guide.
export type Guide = {
  slug: string; title: string; short: string; description: string; kicker: string; intro: string;
  sections: { id: string; h: string; p: string[] }[];
  more: { label: string; href: string }[]; // further reading
  try: { label: string; href: string; text: string };
};

// the rules guide on the Sailing Certification Test site, rule by rule
const rr = (lang: Lang, page: string) => `https://iyt.rycrentals.com${lang === 'ru' ? '/ru' : ''}/racing-rules/${page}`;

export const GUIDES = ['rules', 'start', 'shifts'] as const;
export type GuideSlug = (typeof GUIDES)[number];
export const isGuide = (s: string): s is GuideSlug => (GUIDES as readonly string[]).includes(s);

export function guide(slug: GuideSlug, t: T, lang: Lang): Guide {
  if (slug === 'rules') return {
    slug,
    title: t('The racing rules in five minutes', 'Правила парусных гонок за пять минут'),
    short: t('The racing rules in five minutes', 'Правила гонок за пять минут'),
    kicker: t('Learn to race · rules', 'Учись гоняться · правила'),
    description: t(
      'The Racing Rules of Sailing that decide almost every meeting on the water: port and starboard, windward and leeward, clear astern, tacking, room at the mark, and how to take a penalty.',
      'Правила парусных гонок, которые решают почти каждую встречу на воде: левый и правый галс, наветренная и подветренная, чистая позади, поворот, место у знака и как отработать штраф.'),
    intro: t(
      'The Racing Rules of Sailing run to dozens of pages, but when two boats meet, a handful of them decide who keeps clear. These are the ones from Part 2, “When boats meet”, that the computer boats in Up and down race by — and you with them.',
      'Правила парусных гонок занимают десятки страниц, но когда встречаются две лодки, кто кому уступает, решают несколько правил. Вот они — из части 2, «Когда лодки встречаются»: по ним гоняются компьютерные лодки в Up and down, а вместе с ними и ты.'),
    sections: [
      { id: 'r10', h: t('Port keeps clear of starboard (rule 10)', 'Левый галс уступает правому (правило 10)'), p: [
        t('A boat is on starboard tack when the wind comes over her starboard (right) side, with the boom out to port; on port tack the other way round. When two boats on opposite tacks meet, the port-tack boat keeps clear: she tacks, or ducks behind the other’s stern.',
          'Лодка идёт правым галсом, когда ветер дует ей в правый борт, а гик вынесен влево; левым — наоборот. Когда встречаются лодки на разных галсах, уступает та, что идёт левым: она поворачивает или проходит за кормой другой.'),
        t('The starboard boat usually makes sure with a hail: “Starboard!” A hail is a warning, not a penalty; keep clear in time and nothing happens.',
          'Лодка правого галса обычно предупреждает окликом: «Правый!» Оклик — не штраф, а предупреждение: уступи вовремя, и ничего не будет.'),
      ] },
      { id: 'r11', h: t('Windward keeps clear of leeward (rule 11)', 'Наветренная уступает подветренной (правило 11)'), p: [
        t('On the same tack and overlapped — neither boat clear ahead of the other — the windward boat, the one nearer the wind, keeps clear. The leeward boat may luff, turning towards the wind, and the windward boat has to answer.',
          'На одном галсе, когда лодки перекрываются — ни одна не впереди чисто, — уступает наветренная, та, что ближе к ветру. Подветренная может приводиться, поворачивая к ветру, и наветренная должна отвечать.'),
        t('There is a limit: a boat that became overlapped to leeward from clear astern, within two of her hull lengths, must not sail above her proper course while the overlap lasts (rule 17).',
          'Но есть предел: если подветренная вошла в перекрытие, будучи чисто позади, ближе двух своих корпусов, она не должна идти выше своего надлежащего курса, пока перекрытие длится (правило 17).'),
      ] },
      { id: 'r12', h: t('Clear astern keeps clear of clear ahead (rule 12)', 'Чисто позади уступает чисто впереди (правило 12)'), p: [
        t('On the same tack and not overlapped, the boat behind keeps clear of the boat ahead. Catch up to windward and you are the windward boat; to leeward, and the boat ahead now keeps clear of you — mind rule 17 above.',
          'На одном галсе и без перекрытия лодка позади уступает лодке впереди. Догнала с наветра — стала наветренной; с подветра — теперь уступает тебе передняя, но помни о правиле 17.'),
      ] },
      { id: 'r13', h: t('Tacking boats keep clear (rules 13, 15, 16)', 'Поворачивающая уступает (правила 13, 15, 16)'), p: [
        t('From passing head to wind until she is on a close-hauled course, a tacking boat keeps clear of everyone. Tack too close in front of a starboard boat and the foul is yours.',
          'С момента, когда лодка прошла линию ветра, и пока не легла в бейдевинд, она уступает всем. Повернула слишком близко перед лодкой правого галса — нарушение твоё.'),
        t('Right of way comes with duties: a boat that gains it must at first give the other room to keep clear (rule 15), and a right-of-way boat that changes course must still leave the other room to keep clear (rule 16).',
          'У права дороги есть обязанности: лодка, получившая его, сначала должна дать другой место, чтобы уступить (правило 15), а лодка с правом дороги, меняя курс, должна оставлять другой место, чтобы уступить (правило 16).'),
      ] },
      { id: 'r18', h: t('Room at the mark (rule 18)', 'Место у знака (правило 18)'), p: [
        t('Round every mark lies a zone three hull lengths across. When the first of two overlapped boats reaches it, the outside boat must give the inside boat room to sail round the mark. In Up and down that decides the leeward gate, where boats arrive together.',
          'Вокруг каждого знака — зона в три корпуса. Когда первая из двух перекрывающихся лодок входит в неё, внешняя должна дать внутренней место, чтобы обогнуть знак. В Up and down это решает нижние ворота, куда лодки приходят вместе.'),
        t('Rule 18 does not apply between boats on opposite tacks on a beat, so at the windward mark the port and starboard rule still decides. And tack inside the zone at your peril: you must not make a boat that is fetching the mark sail above close-hauled (rule 18.3).',
          'Между лодками на разных галсах на лавировке правило 18 не действует, так что у верхнего знака по-прежнему решает правило галсов. А поворот внутри зоны опасен: нельзя заставить лодку, которая идёт прямо на знак, идти круче бейдевинда (правило 18.3).'),
      ] },
      { id: 'pen', h: t('Fouls and penalties (rules 21, 31, 44)', 'Нарушения и штрафы (правила 21, 31, 44)'), p: [
        t('Break a rule of Part 2 and you can take a penalty at once instead of a protest: get clear of the other boats and turn through a tack and a gybe. Touching a mark is a foul too (rule 31). Real races usually ask for two turns for a foul between boats and one for a mark, unless the sailing instructions say otherwise; the game asks for one turn either way, and disqualifies a boat that finishes without taking it.',
          'Нарушил правило части 2 — можешь сразу отработать штраф вместо протеста: отойди от других лодок и сделай оборот через поворот оверштаг и фордевинд. Касание знака — тоже нарушение (правило 31). В настоящих гонках за нарушение против лодки обычно положено два оборота, за знак — один, если гоночная инструкция не говорит иначе; в игре — один оборот в любом случае, а лодка, финишировавшая без штрафа, дисквалифицируется.'),
        t('If another boat’s foul forced you into one, you are exonerated and take no penalty (rule 21).',
          'Если тебя вынудило нарушить чужое нарушение, ты освобождаешься от ответственности и штраф не берёшь (правило 21).'),
      ] },
    ],
    more: [
      { label: t('Right of way, rule by rule', 'Право дороги, правило за правилом'), href: rr(lang, 'rightofway') },
      { label: t('Room at marks', 'Место у знаков'), href: rr(lang, 'marks') },
      { label: t('Penalties', 'Штрафы'), href: rr(lang, 'penalties') },
    ],
    try: { label: t('Sail today’s race', 'Пройди гонку дня'), href: '/race', text: t(
      'Five computer boats that hail, give way and spin their penalty turns. After the finish, the result shows every foul with the rule behind it.',
      'Пять компьютерных лодок, которые окликают, уступают и крутят штрафные обороты. После финиша в результате видно каждое нарушение и правило за ним.') },
  };

  if (slug === 'start') return {
    slug,
    title: t('How to win a sailing start', 'Как выиграть старт в парусной гонке'),
    short: t('How to win the start', 'Как выиграть старт'),
    kicker: t('Learn to race · the start', 'Учись гоняться · старт'),
    description: t(
      'How to start a sailing race well: the flags and signals, finding the favoured end of the line, timing your run, holding your spot, what to do when you are over early, and clear air after the gun.',
      'Как хорошо стартовать в парусной гонке: флаги и сигналы, выгодный конец линии, расчёт разгона, как удержать место, что делать при фальстарте и чистый ветер после сигнала.'),
    intro: t(
      'A good start puts you in front with clean wind, and a bad one leaves you in everyone’s dirty air for the whole beat. Most of it is known before the gun: which end of the line to start at, where to wait and when to go.',
      'Хороший старт выводит тебя вперёд в чистом ветре, плохой оставляет в чужой ветровой тени на всю лавировку. Многое решается до сигнала: у какого конца линии стартовать, где ждать и когда разгоняться.'),
    sections: [
      { id: 'flags', h: t('The signals', 'Сигналы'), p: [
        t('The race committee starts the countdown with flags over the committee boat, each with a sound. In the standard sequence (rule 26) the class flag goes up five minutes before the start, the preparatory flag at four, the preparatory comes down at one minute, and the class flag drops with the gun.',
          'Гоночный комитет ведёт отсчёт флагами на судейском судне, каждый — со звуковым сигналом. В стандартной процедуре (правило 26) флаг класса поднимают за пять минут до старта, подготовительный — за четыре, за минуту подготовительный опускают, а со стартовым сигналом опускают флаг класса.'),
        t('The preparatory flag tells you the rules for the last minute: P — be on the course side and you just go back; U — be in the triangle formed by the line and the first mark in the last minute and you are disqualified; the black flag — the same, even if the start is recalled. Up and down flies all three and lets you set a 1, 3 or 5 minute sequence for a free race.',
          'Подготовительный флаг говорит, какие правила в последнюю минуту: P — оказался за линией, просто вернись; U — оказался в последнюю минуту в треугольнике между линией и первым знаком — дисквалификация; чёрный флаг — то же, даже если старт отменят. В Up and down есть все три, а в свободной гонке можно выбрать процедуру на 1, 3 или 5 минут.'),
      ] },
      { id: 'end', h: t('Start at the favoured end', 'Стартуй у выгодного конца'), p: [
        t('A line is rarely square to the wind. The end further upwind is favoured: start there and you are ahead of everyone who started at the other end, before anyone has sailed a metre. To check, sail along the line, or turn head to wind on it — your bow points nearer the favoured end.',
          'Линия редко стоит ровно поперёк ветра. Выгоден конец, что ближе к ветру: стартовав там, ты впереди всех, кто ушёл с другого конца, ещё не пройдя ни метра. Проверить просто: пройди вдоль линии или встань на ней носом к ветру — нос укажет ближе к выгодному концу.'),
        t('The wind shifts during the sequence, so check again in the last minutes. Up and down says which end is favoured in the bar at the top: the committee boat end or the pin.',
          'Ветер заходит и во время процедуры, так что проверь ещё раз в последние минуты. Up and down пишет выгодный конец в строке сверху: у судна или у знака.'),
      ] },
      { id: 'time', h: t('Time your run', 'Рассчитай разгон'), p: [
        t('The aim: on the line at full speed as the gun goes. Being on the line early and stopped is nearly as bad as being late. Know how far you are from the line and how long it takes to sail there; the game shows both, the distance and the time to the line, before the start.',
          'Цель — на линии на полной скорости в момент сигнала. Прийти рано и стоять почти так же плохо, как опоздать. Знай, сколько до линии и за сколько ты её пройдёшь; игра до старта показывает и расстояние, и время до линии.'),
        t('A boat accelerates slowly from a standstill, so start your run a few lengths back and a few seconds early, then ease off if you are too soon. A boat length behind the line at the gun, going full speed, is a very good start.',
          'С места лодка разгоняется медленно, так что начинай разгон за несколько корпусов и на несколько секунд раньше, а если приходишь рано — притормози. Корпус до линии на сигнале и полная скорость — очень хороший старт.'),
      ] },
      { id: 'hold', h: t('Hold your spot', 'Удержи место'), p: [
        t('To wait near the line, head up and let the sheets right out: the boat slows and stops, and can even go backwards. Keep a gap to leeward to bear away into when it is time to accelerate, and defend it: a boat that sails into it becomes the leeward boat, and you must keep clear (rule 11).',
          'Чтобы ждать у линии, приведись и потрави шкоты до конца: лодка замедлится, остановится и может даже пойти назад. Держи свободное место под ветром, чтобы увалиться в него и разогнаться, и защищай его: лодка, которая туда зайдёт, станет подветренной, и уступать придётся тебе (правило 11).'),
        t('Close to the committee boat there is no room to be had at the start: a windward boat that tries to squeeze in between a leeward boat and the committee boat keeps clear.',
          'У судейского судна на старте места не положено: наветренная, которая пытается втиснуться между подветренной и судном, уступает.'),
      ] },
      { id: 'early', h: t('Over early', 'Фальстарт'), p: [
        t('Over the line at the gun under P, the committee flies X: go back to the pre-start side and start again; the sooner you turn, the less it costs. If too many are over to tell who, the whole start is recalled (two flags, the First Substitute) and you start again.',
          'Оказался за линией на сигнале под флагом P — комитет поднимает X: вернись на предстартовую сторону и стартуй заново; чем раньше развернёшься, тем меньше потеряешь. Если за линией слишком много лодок, весь старт отменяют (флаг «Первый заменяющий») и стартуют снова.'),
      ] },
      { id: 'air', h: t('Clear air after the gun', 'Чистый ветер после старта'), p: [
        t('Behind and to leeward of another boat the wind is weaker and bent: dirty air. If you are stuck in it after the start, tack away to clear wind as soon as you can safely do it. The result page counts the seconds you spent in another boat’s dirty air.',
          'За другой лодкой и под ветром от неё ветер слабее и сбит: ветровая тень. Если после старта ты в ней, поворачивай в чистый ветер, как только это безопасно. На странице результата посчитано, сколько секунд ты провёл в чужой тени.'),
      ] },
    ],
    more: [
      { label: t('Starting rules and signals', 'Правила и сигналы старта'), href: rr(lang, 'starting') },
      { label: t('How to play: the start', 'Как играть: старт'), href: '/help#h-start' },
    ],
    try: { label: t('Practise the start', 'Потренируй старт'), href: '/race/free', text: t(
      'Set a 5-minute sequence and a 7-boat fleet in a free race, and start as often as you like.',
      'Поставь процедуру на 5 минут и флот из 7 лодок в свободной гонке — и стартуй сколько хочешь.') },
  };

  return {
    slug,
    title: t('Headers and lifts: how to play the wind shifts', 'Заходы и отходы ветра: как их использовать'),
    short: t('Headers and lifts', 'Заходы и отходы'),
    kicker: t('Learn to race · tactics', 'Учись гоняться · тактика'),
    description: t(
      'How to sail the wind shifts upwind: what a header and a lift are, why you tack on the headers, when not to tack, laylines, gusts and lulls, and gybing on the lifts downwind.',
      'Как использовать заходы ветра на лавировке: что такое заход и отход, почему поворачивать на заходе, когда не поворачивать, лейлайны, порывы и затишья и фордевинд на отходе на попутном курсе.'),
    intro: t(
      'The wind never blows from one direction for long. It swings a few degrees, then ten or more, back and forth every minute or so. Upwind, a boat that tacks on those shifts sails a shorter way to the mark than one that just sails the same distance on each tack — often by more than any boat speed can make up.',
      'Ветер никогда долго не дует с одного направления. Он гуляет на несколько градусов, потом на десять и больше — туда и обратно примерно каждую минуту. На лавировке лодка, которая поворачивает на этих заходах, проходит до знака более короткий путь, чем та, что просто делает равные галсы, — часто больше, чем можно отыграть скоростью.'),
    sections: [
      { id: 'what', h: t('Header or lift', 'Заход или отход'), p: [
        t('Sailing close-hauled, a header is a shift that comes from further ahead: to keep the sails full you have to bear away, and you point further from the mark. A lift comes from further aft: you can head up and point closer to the mark.',
          'В бейдевинд заход ветра — это сдвиг ветра к носу: чтобы паруса не заполаскивали, приходится уваливаться, и ты идёшь дальше от знака. Отход — сдвиг к корме: можно привестись и идти ближе к знаку.'),
        t('A header on one tack is a lift on the other. That is the whole trick.',
          'Заход на одном галсе — это отход на другом. В этом весь секрет.'),
      ] },
      { id: 'tack', h: t('Tack on the headers', 'Поворачивай на заходе'), p: [
        t('When you are headed, tack: on the new tack the same shift lifts you, and you sail towards the mark at a better angle. Stay on the tack that points you closer to the mark, and you are always on the lifted one.',
          'Когда ветер зашёл — поворачивай: на новом галсе тот же сдвиг станет отходом, и ты пойдёшь к знаку под лучшим углом. Держись галса, который ведёт ближе к знаку, — и ты всегда на выгодном.'),
        t('In Up and down the chip under the speed says which you are in: orange for a header, blue for a lift. After the race, the result counts your tacks in headers and in lifts.',
          'В Up and down метка под скоростью говорит, что сейчас: оранжевая — заход, синяя — отход. После гонки в результате посчитано, сколько поворотов ты сделал на заходе и сколько на отходе.'),
      ] },
      { id: 'dont', h: t('When not to tack', 'Когда не поворачивать'), p: [
        t('Every tack costs a few boat lengths while the boat slows and builds speed again. A shift of two or three degrees that lasts ten seconds isn’t worth one. Wait until the header is real — and don’t tack into another boat’s dirty air, or onto port across a fleet on starboard.',
          'Каждый поворот стоит нескольких корпусов, пока лодка теряет и снова набирает скорость. Сдвиг на два-три градуса на десять секунд того не стоит. Дождись настоящего захода — и не поворачивай в чужую ветровую тень или левым галсом поперёк флота на правом.'),
      ] },
      { id: 'lay', h: t('Stay off the laylines', 'Не выходи на лейлайн рано'), p: [
        t('A layline is the line from which you can just fetch the mark on one tack. Reach it early and every shift works against you: a header and you have to tack again, a lift and you have sailed too far. Keep to the middle of the course until the last part of the beat. The game’s top view draws the laylines.',
          'Лейлайн — линия, с которой знак берётся одним галсом. Выйдешь на неё рано — и любой сдвиг против тебя: заход — придётся поворачивать снова, отход — ты прошёл лишнее. Держись середины дистанции до конца лавировки. В виде сверху игра рисует лейлайны.'),
      ] },
      { id: 'gusts', h: t('Gusts and lulls', 'Порывы и затишья'), p: [
        t('A gust shows as darker water coming down the course. Upwind in a gust the boat heels and can point higher; in a lull bear away a little to keep her speed up. In a strong breeze, reef the main or change to the small jib before she heels too far.',
          'Порыв видно как тёмную рябь, идущую по дистанции. На лавировке в порыве лодка кренится и может идти круче; в затишье увались немного, чтобы держать скорость. В сильный ветер возьми риф на гроте или поставь малый стаксель, пока крен не стал слишком большим.'),
      ] },
      { id: 'down', h: t('Downwind: gybe on the lifts', 'На попутном: фордевинд на отходе'), p: [
        t('On the run it works the other way round. A lift makes you head up, away from the mark, to keep the same angle to the wind; gybe and the shift points you at the mark again. On a sea-breeze day the wind also builds and swings right as the race goes on, so the right side of the course often pays.',
          'На попутном всё наоборот. Отход заставляет приводиться, уходя от знака, чтобы сохранить угол к ветру; сделай фордевинд — и тот же сдвиг снова поведёт тебя к знаку. А в день морского бриза ветер к тому же усиливается и заходит вправо по ходу гонки, так что правая сторона дистанции часто выгоднее.'),
      ] },
    ],
    more: [
      { label: t('How to play: wind that won’t sit still', 'Как играть: ветер, который не стоит на месте'), href: '/help#h-wind' },
      { label: t('Questions: sailing the boat', 'Вопросы: управление лодкой'), href: '/faq' },
    ],
    try: { label: t('Sail today’s race', 'Пройди гонку дня'), href: '/race', text: t(
      'Shifts of ten degrees and more, gusts and lulls, five boats to beat to the windward mark.',
      'Заходы на десять градусов и больше, порывы и затишья и пять лодок, которых надо обойти к верхнему знаку.') },
  };
}
