import type { T } from './lang';

// The words of sailboat racing, for /learn/glossary: each a short, plain definition (what search engines quote for
// "what is a layline", and AI assistants too), with the guide that goes further where there is one.
export type Term = { id: string; term: string; def: string; see?: string };

export function glossary(t: T): Term[] {
  const terms: Term[] = [
    { id: 'beat', term: t('Beat', 'Лавировка'), see: '/learn/shifts', def: t(
      'Sailing towards a mark that lies upwind. No boat can sail straight into the wind, so she zigzags towards it, close-hauled on one tack and then the other.',
      'Движение к знаку, который лежит против ветра. Прямо против ветра лодка идти не может, поэтому идёт зигзагом, в бейдевинд то одним, то другим галсом.') },
    { id: 'close-hauled', term: t('Close-hauled', 'Бейдевинд'), def: t(
      'As close to the wind as the boat sails well, about 40° off it, with the sails pulled in hard.',
      'Курс так круто к ветру, как лодка ещё хорошо идёт, — около 40° к ветру, паруса выбраны туго.') },
    { id: 'reach', term: t('Reach', 'Галфвинд и бакштаг'), def: t(
      'Sailing with the wind across the boat: a tight reach a little upwind of square, a broad reach a little downwind.',
      'Курс, при котором ветер дует поперёк лодки: галфвинд — примерно в борт, бакштаг — сзади-сбоку.') },
    { id: 'run', term: t('Run', 'Фордевинд (курс)'), see: '/learn/downwind', def: t(
      'Sailing with the wind from behind, towards a mark that lies downwind.',
      'Курс, при котором ветер дует сзади, к знаку, который лежит по ветру.') },
    { id: 'tack', term: t('Tack (to tack)', 'Поворот оверштаг'), def: t(
      'Turning the bow through the wind, from one tack to the other. Until she is close-hauled on the new tack a tacking boat keeps clear of others (rule 13).',
      'Поворот, при котором лодка проходит линию ветра носом и переходит с галса на галс. Пока она не легла в бейдевинд на новом галсе, она уступает всем (правило 13).') },
    { id: 'gybe', term: t('Gybe', 'Поворот фордевинд'), see: '/learn/downwind', def: t(
      'Turning the stern through the wind, so the boom swings across to the other side.',
      'Поворот, при котором через линию ветра проходит корма и гик перебрасывается на другой борт.') },
    { id: 'starboard', term: t('Starboard tack', 'Правый галс'), see: '/learn/rules#r10', def: t(
      'Sailing with the wind coming over the boat’s starboard (right) side and the boom out to port. Port tack keeps clear of starboard (rule 10).',
      'Ветер дует в правый борт, гик вынесен влево. Лодка левого галса уступает лодке правого (правило 10).') },
    { id: 'port', term: t('Port tack', 'Левый галс'), see: '/learn/rules#r10', def: t(
      'Sailing with the wind coming over the boat’s port (left) side and the boom out to starboard.',
      'Ветер дует в левый борт, гик вынесен вправо.') },
    { id: 'windward', term: t('Windward and leeward', 'Наветренный и подветренный'), see: '/learn/rules#r11', def: t(
      'Windward is the side or the boat nearer the wind; leeward is the side or the boat away from it. Overlapped on the same tack, windward keeps clear (rule 11).',
      'Наветренный — борт или лодка ближе к ветру, подветренный — дальше от него. На одном галсе в перекрытии наветренная уступает (правило 11).') },
    { id: 'overlap', term: t('Overlap', 'Перекрытие'), see: '/learn/rules#r11', def: t(
      'Two boats on the same tack are overlapped when neither is clear astern of the other. It decides who keeps clear and who gets room at a mark.',
      'Две лодки на одном галсе перекрываются, когда ни одна не находится чисто позади другой. Перекрытие решает, кто уступает и кому положено место у знака.') },
    { id: 'clear-astern', term: t('Clear astern', 'Чисто позади'), see: '/learn/rules#r12', def: t(
      'A boat is clear astern when her hull is behind a line square across the stern of the other boat. Clear astern keeps clear of clear ahead (rule 12).',
      'Лодка чисто позади, когда её корпус целиком за линией, проведённой поперёк через корму другой. Чисто позади уступает чисто впереди (правило 12).') },
    { id: 'luff', term: t('Luff (to luff)', 'Приводиться'), def: t(
      'To turn towards the wind. A leeward boat may luff a windward one, which has to answer (rules 11 and 16).',
      'Поворачивать к ветру. Подветренная лодка может приводиться, и наветренная должна отвечать (правила 11 и 16).') },
    { id: 'bear-away', term: t('Bear away', 'Уваливаться'), def: t(
      'To turn away from the wind. Upwind a boat bears away a few degrees to build speed; at the windward mark she bears away onto the run.',
      'Поворачивать от ветра. На лавировке немного уваливаются, чтобы набрать скорость; у верхнего знака уваливаются на попутный курс.') },
    { id: 'proper-course', term: t('Proper course', 'Надлежащий курс'), see: '/learn/rules#r11', def: t(
      'The course a boat would sail to finish as soon as possible if the other boats weren’t there. Some rules stop a boat sailing above it (rule 17).',
      'Курс, которым лодка шла бы, чтобы финишировать как можно скорее, если бы других лодок не было. Некоторые правила запрещают идти выше него (правило 17).') },
    { id: 'in-irons', term: t('In irons', 'В левентике'), def: t(
      'Stopped head to wind, with the sails flapping and no way to steer. Bear away until the sails fill again.',
      'Лодка встала носом к ветру, паруса полощут, рулём не управляется. Нужно уваливаться, пока паруса снова не наполнятся.') },
    { id: 'header', term: t('Header', 'Заход ветра'), see: '/learn/shifts', def: t(
      'A wind shift that comes from further ahead, so a close-hauled boat has to bear away. Upwind, tack on the headers.',
      'Сдвиг ветра к носу, из-за которого лодке в бейдевинд приходится уваливаться. На лавировке поворачивай на заходе.') },
    { id: 'lift', term: t('Lift', 'Отход ветра'), see: '/learn/shifts', def: t(
      'A wind shift that comes from further aft, so a close-hauled boat can point higher. A header on one tack is a lift on the other.',
      'Сдвиг ветра к корме, при котором лодка в бейдевинд может идти круче. Заход на одном галсе — отход на другом.') },
    { id: 'layline', term: t('Layline', 'Лейлайн'), see: '/learn/shifts#lay', def: t(
      'The line from which a boat can just fetch the mark on one tack, without another tack. Reach it too early and every shift works against you.',
      'Линия, с которой знак берётся одним галсом, без лишнего поворота. Выйдешь на неё слишком рано — любой сдвиг ветра против тебя.') },
    { id: 'dirty-air', term: t('Dirty air', 'Ветровая тень'), see: '/learn/start#air', def: t(
      'The weaker, bent wind behind and to leeward of another boat’s sails. A boat in it is slower, so she tacks away to clear air.',
      'Ослабленный и сбитый ветер за парусами другой лодки и под ветром от неё. В тени лодка идёт медленнее, поэтому поворачивает в чистый ветер.') },
    { id: 'gust', term: t('Gust and lull', 'Порыв и затишье'), see: '/learn/shifts#gusts', def: t(
      'A gust is a patch of stronger wind, darker on the water; a lull is a patch of lighter wind.',
      'Порыв — участок более сильного ветра, на воде темнее; затишье — участок более слабого.') },
    { id: 'start-line', term: t('Start line', 'Стартовая линия'), see: '/learn/start', def: t(
      'The line between the committee boat and the pin, a mark at the other end. Boats start when they cross it after the starting signal.',
      'Линия между судейским судном и знаком на другом её конце. Лодки стартуют, пересекая её после стартового сигнала.') },
    { id: 'favoured-end', term: t('Favoured end', 'Выгодный конец линии'), see: '/learn/start#end', def: t(
      'The end of the start line further upwind. A boat that starts there is ahead of one that starts at the other end.',
      'Конец стартовой линии, который ближе к ветру. Лодка, стартовавшая там, впереди той, что ушла с другого конца.') },
    { id: 'ocs', term: t('OCS (over early)', 'Фальстарт (OCS)'), see: '/learn/start#early', def: t(
      'On the course side of the start line at the starting signal. Under the P flag the boat goes back and starts again; the committee flies X.',
      'Лодка оказалась за стартовой линией в момент сигнала. Под флагом P она возвращается и стартует заново; комитет поднимает флаг X.') },
    { id: 'general-recall', term: t('General recall', 'Общий отзыв'), see: '/learn/start#early', def: t(
      'The whole start is called off, usually because too many boats were over early to identify, and the fleet starts again.',
      'Отмена всего старта, обычно потому, что слишком много лодок оказались за линией, и флот стартует заново.') },
    { id: 'windward-mark', term: t('Windward mark', 'Верхний знак'), see: '/learn/marks', def: t(
      'The mark at the top of the beat, usually left to port.',
      'Знак в конце лавировки; обычно его оставляют слева.') },
    { id: 'gate', term: t('Leeward gate', 'Нижние ворота'), see: '/learn/marks#gate', def: t(
      'Two marks at the bottom of the run. A boat sails between them and rounds either one, and starts the next beat from there.',
      'Два знака в конце попутного курса. Лодка проходит между ними, огибает любой и оттуда начинает следующую лавировку.') },
    { id: 'zone', term: t('Zone', 'Зона'), see: '/learn/rules#r18', def: t(
      'The area within three hull lengths of a mark. When the first of two overlapped boats enters it, the outside boat owes the inside one mark-room.',
      'Пространство в пределах трёх корпусов от знака. Когда первая из двух перекрывающихся лодок входит в неё, внешняя должна дать внутренней место у знака.') },
    { id: 'mark-room', term: t('Mark-room', 'Место у знака'), see: '/learn/rules#r18', def: t(
      'Room for a boat to sail to the mark and round it as she should (rule 18).',
      'Место, чтобы подойти к знаку и обогнуть его как положено (правило 18).') },
    { id: 'penalty', term: t('Penalty turn', 'Штрафной оборот'), see: '/learn/rules#pen', def: t(
      'A turn through a tack and a gybe, taken as soon as possible after a foul, clear of other boats. Usually two turns for a foul between boats and one for touching a mark.',
      'Оборот через поворот оверштаг и фордевинд, который делают как можно скорее после нарушения, отойдя от других лодок. Обычно два оборота за нарушение против лодки и один за касание знака.') },
    { id: 'gennaker', term: t('Gennaker (kite)', 'Генакер'), see: '/learn/downwind', def: t(
      'A big, light, asymmetric sail set from the bow for sailing downwind.',
      'Большой лёгкий асимметричный парус, который ставят с носа для попутных курсов.') },
    { id: 'sheet', term: t('Sheet and trim', 'Шкот и настройка'), see: '/learn/trim', def: t(
      'The sheet is the rope that pulls a sail in or lets it out; trimming is setting it right for the wind. Too far out and the sail flaps, too far in and it stalls.',
      'Шкот — снасть, которой парус выбирают или травят; настройка — поставить парус правильно к ветру. Перетравил — парус полощет, перебрал — срывается поток.') },
    { id: 'reef', term: t('Reef', 'Риф'), see: '/learn/trim#blow', def: t(
      'Making the mainsail smaller in a strong wind, so the boat heels less and stays fast.',
      'Уменьшение площади грота в сильный ветер, чтобы лодка меньше кренилась и шла быстрее.') },
  ];
  return terms.sort((a, b) => a.term.localeCompare(b.term));
}
