import type { T, Lang } from './lang';
import { guide, isGuide } from './guides';

// The words of sailboat racing, for /learn/glossary: each a short, plain definition (what search engines quote for
// "what is a layline", and AI assistants too), with the guide that goes further where there is one. In six groups,
// each in the order a sailor meets them.
export type GroupId = 'points-of-sail' | 'right-of-way' | 'wind' | 'start' | 'marks' | 'boat';
export type Term = { id: string; group: GroupId; term: string; def: string; see?: string };

export function glossaryGroups(t: T): { id: GroupId; title: string; terms: Term[] }[] {
  const all = glossary(t);
  const groups: [GroupId, string][] = [
    ['points-of-sail', t('Points of sail and turns', 'Курсы и повороты', 'Rumbos y giros')],
    ['right-of-way', t('Who keeps clear', 'Кто уступает', 'Quién se mantiene separado')],
    ['wind', t('The wind', 'Ветер', 'El viento')],
    ['start', t('The start', 'Старт', 'La salida')],
    ['marks', t('The marks', 'Знаки', 'Las balizas')],
    ['boat', t('The boat', 'Лодка', 'El barco')],
  ];
  return groups.map(([id, title]) => ({ id, title, terms: all.filter((x) => x.group === id) }));
}

// what a term's see-link says, from where it goes: a section of the rules guide by its rule ("Rule 10"), any other
// guide by its name ("Guide: rounding the marks"), How to play by its own
export function seeLabel(href: string, t: T, lang: Lang): string {
  const [path, hash] = href.split('#');
  const slug = path.replace(/^\/learn\//, '');
  if (path.startsWith('/learn/') && isGuide(slug)) {
    const g = guide(slug, t, lang);
    const rule = hash && g.sections.find((s) => s.id === hash)?.h.match(/\((rules? [^)]*|правил[ао] [^)]*)\)/)?.[1];
    if (rule) return rule[0].toUpperCase() + rule.slice(1);
    const name = g.short[0].toLowerCase() + g.short.slice(1);
    return t(`Guide: ${name}`, `Пособие: ${name}`, `Guía: ${name}`);
  }
  if (path === '/help') return t('How to play', 'Как играть', 'Cómo jugar');
  return t('More', 'Подробнее', 'Más');
}

export function glossary(t: T): Term[] {
  const terms: Term[] = [
    { id: 'beat', group: 'points-of-sail', term: t('Beat', 'Лавировка', 'Ceñida'), see: '/learn/shifts', def: t(
      'Sailing towards a mark that lies upwind. No boat can sail straight into the wind, so she zigzags towards it, close-hauled on one tack and then the other.',
      'Движение к знаку, который лежит против ветра. Прямо против ветра лодка идти не может, поэтому идёт зигзагом, в бейдевинд то одним, то другим галсом.', 'Navegar hacia una baliza que queda a barlovento. Ningún barco puede navegar directo contra el viento, así que va en zigzag hacia ella, de ceñida por una amura y luego por la otra.') },
    { id: 'close-hauled', group: 'points-of-sail', term: t('Close-hauled', 'Бейдевинд', 'De ceñida'), def: t(
      'As close to the wind as the boat sails well, about 40° off it, with the sails pulled in hard.',
      'Курс так круто к ветру, как лодка ещё хорошо идёт, — около 40° к ветру, паруса выбраны туго.', 'Lo más cerca del viento que el barco navega bien, a unos 40° de él, con las velas cazadas a fondo.') },
    { id: 'reach', group: 'points-of-sail', term: t('Reach', 'Галфвинд и бакштаг', 'Través'), def: t(
      'Sailing with the wind across the boat: a tight reach a little upwind of square, a broad reach a little downwind.',
      'Курс, при котором ветер дует поперёк лодки: галфвинд — примерно в борт, бакштаг — сзади-сбоку.', 'Navegar con el viento cruzado al barco: un través cerrado, algo a barlovento de la perpendicular, y un largo, algo a sotavento.') },
    { id: 'run', group: 'points-of-sail', term: t('Run', 'Фордевинд (курс)', 'Empopada'), see: '/learn/downwind', def: t(
      'Sailing with the wind from behind, towards a mark that lies downwind.',
      'Курс, при котором ветер дует сзади, к знаку, который лежит по ветру.', 'Navegar con el viento por detrás, hacia una baliza que queda a sotavento.') },
    { id: 'tack', group: 'points-of-sail', term: t('Tack (to tack)', 'Поворот оверштаг', 'Virar (virada)'), def: t(
      'Turning the bow through the wind, from one tack to the other. Until she is close-hauled on the new tack a tacking boat keeps clear of others (rule 13).',
      'Поворот, при котором лодка проходит линию ветра носом и переходит с галса на галс. Пока она не легла в бейдевинд на новом галсе, она уступает всем (правило 13).', 'Girar la proa a través del viento, de una amura a la otra. Hasta que está de ceñida en la nueva amura, un barco que vira se mantiene separado de los demás (regla 13).') },
    { id: 'gybe', group: 'points-of-sail', term: t('Gybe', 'Поворот фордевинд', 'Trasluchar'), see: '/learn/downwind', def: t(
      'Turning the stern through the wind, so the boom swings across to the other side.',
      'Поворот, при котором через линию ветра проходит корма и гик перебрасывается на другой борт.', 'Girar la popa a través del viento, de modo que la botavara pasa al otro lado.') },
    { id: 'starboard', group: 'right-of-way', term: t('Starboard tack', 'Правый галс', 'Amura de estribor'), see: '/learn/rules#r10', def: t(
      'Sailing with the wind coming over the boat’s starboard (right) side and the boom out to port. Port tack keeps clear of starboard (rule 10).',
      'Ветер дует в правый борт, гик вынесен влево. Лодка левого галса уступает лодке правого (правило 10).', 'Navegar con el viento entrando por el costado de estribor (derecha) del barco y la botavara fuera por babor. Babor se mantiene separado de estribor (regla 10).') },
    { id: 'port', group: 'right-of-way', term: t('Port tack', 'Левый галс', 'Amura de babor'), see: '/learn/rules#r10', def: t(
      'Sailing with the wind coming over the boat’s port (left) side and the boom out to starboard.',
      'Ветер дует в левый борт, гик вынесен вправо.', 'Navegar con el viento entrando por el costado de babor (izquierda) del barco y la botavara fuera por estribor.') },
    { id: 'windward', group: 'right-of-way', term: t('Windward and leeward', 'Наветренный и подветренный', 'Barlovento y sotavento'), see: '/learn/rules#r11', def: t(
      'Windward is the side or the boat nearer the wind; leeward is the side or the boat away from it. Overlapped on the same tack, windward keeps clear (rule 11).',
      'Наветренный — борт или лодка ближе к ветру, подветренный — дальше от него. На одном галсе при связанности наветренная уступает (правило 11).', 'Barlovento es el costado o el barco más cercano al viento; sotavento es el costado o el barco más alejado de él. Con compromiso en la misma amura, el de barlovento se mantiene separado (regla 11).') },
    { id: 'overlap', group: 'right-of-way', term: t('Overlap', 'Связанность (перекрытие)', 'Compromiso'), see: '/learn/rules#r11', def: t(
      'Two boats on the same tack are overlapped when neither is clear astern of the other. It decides who keeps clear and who gets room at a mark.',
      'Две лодки на одном галсе связаны, когда ни одна не находится чисто позади другой. Связанность решает, кто уступает и кому положено место у знака.', 'Dos barcos en la misma amura tienen compromiso cuando ninguno está libre por la popa del otro. Decide quién se mantiene separado y quién tiene espacio en una baliza.') },
    { id: 'clear-astern', group: 'right-of-way', term: t('Clear astern', 'Чисто позади', 'Libre por la popa'), see: '/learn/rules#r12', def: t(
      'A boat is clear astern when her hull is behind a line square across the stern of the other boat. Clear astern keeps clear of clear ahead (rule 12).',
      'Лодка чисто позади, когда её корпус целиком за линией, проведённой поперёк через корму другой. Чисто позади уступает чисто впереди (правило 12).', 'Un barco está libre por la popa cuando su casco queda detrás de una línea perpendicular a la popa del otro barco. El libre por la popa se mantiene separado del libre por la proa (regla 12).') },
    { id: 'luff', group: 'points-of-sail', term: t('Luff (to luff)', 'Приводиться', 'Orzar'), def: t(
      'To turn towards the wind. A leeward boat may luff a windward one, which has to answer (rules 11 and 16).',
      'Поворачивать к ветру. Подветренная лодка может приводиться, и наветренная должна отвечать (правила 11 и 16).', 'Girar hacia el viento. Un barco de sotavento puede orzar sobre uno de barlovento, que tiene que responder (reglas 11 y 16).') },
    { id: 'bear-away', group: 'points-of-sail', term: t('Bear away', 'Уваливаться', 'Arribar'), def: t(
      'To turn away from the wind. Upwind a boat bears away a few degrees to build speed; at the windward mark she bears away onto the run.',
      'Поворачивать от ветра. На лавировке немного уваливаются, чтобы набрать скорость; у верхнего знака уваливаются на попутный курс.', 'Girar alejándose del viento. De ceñida un barco arriba unos grados para ganar velocidad; en la baliza de barlovento arriba hacia la empopada.') },
    { id: 'proper-course', group: 'right-of-way', term: t('Proper course', 'Надлежащий курс', 'Rumbo debido'), see: '/learn/rules#r11', def: t(
      'The course a boat would sail to finish as soon as possible if the other boats weren’t there. Some rules stop a boat sailing above it (rule 17).',
      'Курс, которым лодка шла бы, чтобы финишировать как можно скорее, если бы других лодок не было. Некоторые правила запрещают идти выше него (правило 17).', 'El rumbo que un barco navegaría para llegar lo antes posible si los otros barcos no estuvieran. Algunas reglas impiden a un barco navegar por encima de él (regla 17).') },
    { id: 'in-irons', group: 'points-of-sail', term: t('In irons', 'В левентике', 'Proa al viento'), def: t(
      'Stopped head to wind, with the sails flapping and no way to steer. Bear away until the sails fill again.',
      'Лодка встала носом к ветру, паруса полощут, рулём не управляется. Нужно уваливаться, пока паруса снова не наполнятся.', 'Parado proa al viento, con las velas aleteando y sin poder gobernar. Arriba hasta que las velas se llenen otra vez.') },
    { id: 'header', group: 'wind', term: t('Header', 'Заход ветра', 'Rolada desfavorable'), see: '/learn/shifts', def: t(
      'A wind shift that comes from further ahead, so a close-hauled boat has to bear away. Upwind, tack on the headers.',
      'Сдвиг ветра к носу, из-за которого лодке в бейдевинд приходится уваливаться. На лавировке поворачивай на заходе.', 'Un cambio de viento que viene de más a proa, de modo que un barco de ceñida tiene que arribar. De ceñida, vira en las roladas desfavorables.') },
    { id: 'lift', group: 'wind', term: t('Lift', 'Отход ветра', 'Rolada favorable'), see: '/learn/shifts', def: t(
      'A wind shift that comes from further aft, so a close-hauled boat can point higher. A header on one tack is a lift on the other.',
      'Сдвиг ветра к корме, при котором лодка в бейдевинд может идти круче. Заход на одном галсе — отход на другом.', 'Un cambio de viento que viene de más a popa, de modo que un barco de ceñida puede apuntar más alto. Una rolada desfavorable en una amura es favorable en la otra.') },
    { id: 'layline', group: 'wind', term: t('Layline', 'Лейлайн', 'Layline'), see: '/learn/shifts#lay', def: t(
      'The line from which a boat can just fetch the mark on one tack, without another tack. Reach it too early and every shift works against you.',
      'Линия, с которой знак берётся одним галсом, без лишнего поворота. Выйдешь на неё слишком рано — любой сдвиг ветра против тебя.', 'La línea desde la que un barco puede justo alcanzar la baliza en una amura, sin otra virada. Si la alcanzas demasiado pronto, cada rolada juega en tu contra.') },
    { id: 'dirty-air', group: 'wind', term: t('Dirty air', 'Ветровая тень', 'Aire sucio'), see: '/learn/start#air', def: t(
      'The weaker, bent wind behind and to leeward of another boat’s sails. A boat in it is slower, so she tacks away to clear air.',
      'Ослабленный и сбитый ветер за парусами другой лодки и под ветром от неё. В тени лодка идёт медленнее, поэтому поворачивает в чистый ветер.', 'El viento más débil y desviado detrás y a sotavento de las velas de otro barco. Un barco metido en él va más lento, así que vira para buscar aire limpio.') },
    { id: 'gust', group: 'wind', term: t('Gust and lull', 'Порыв и затишье', 'Racha y calma'), see: '/learn/shifts#gusts', def: t(
      'A gust is a patch of stronger wind, darker on the water; a lull is a patch of lighter wind.',
      'Порыв — участок более сильного ветра, на воде темнее; затишье — участок более слабого.', 'Una racha es una zona de viento más fuerte, más oscura sobre el agua; una calma es una zona de viento más flojo.') },
    { id: 'start-line', group: 'start', term: t('Start line', 'Стартовая линия', 'Línea de salida'), see: '/learn/start', def: t(
      'The line between the committee boat and the pin, a mark at the other end. Boats start when they cross it after the starting signal.',
      'Линия между судейским судном и знаком на другом её конце. Лодки стартуют, пересекая её после стартового сигнала.', 'La línea entre el barco del comité y el pin, una baliza en el otro extremo. Los barcos salen al cruzarla tras la señal de salida.') },
    { id: 'favoured-end', group: 'start', term: t('Favoured end', 'Выгодный конец линии', 'Extremo favorecido'), see: '/learn/start#end', def: t(
      'The end of the start line further upwind. A boat that starts there is ahead of one that starts at the other end.',
      'Конец стартовой линии, который ближе к ветру. Лодка, стартовавшая там, впереди той, что ушла с другого конца.', 'El extremo de la línea de salida más a barlovento. Un barco que sale por allí va por delante de uno que sale por el otro extremo.') },
    { id: 'ocs', group: 'start', term: t('OCS (over early)', 'Фальстарт (OCS)', 'OCS (salir antes de tiempo)'), see: '/learn/start#early', def: t(
      'On the course side of the start line at the starting signal. Under the P flag the boat goes back and starts again; the committee flies X.',
      'Лодка оказалась на стороне дистанции от стартовой линии в момент сигнала. Под флагом P она возвращается и стартует заново; комитет поднимает флаг X.', 'Estar en el lado del recorrido de la línea de salida en la señal de salida. Con la bandera P el barco vuelve y sale de nuevo; el comité iza la X.') },
    { id: 'general-recall', group: 'start', term: t('General recall', 'Общий отзыв', 'Llamada general'), see: '/learn/start#early', def: t(
      'The whole start is called off, usually because too many boats were over early to identify, and the fleet starts again.',
      'Отзыв всего флота со старта, обычно потому, что слишком много лодок оказались за линией, и флот стартует заново.', 'Se anula toda la salida, normalmente porque demasiados barcos salieron antes de tiempo para identificarlos, y la flota sale otra vez.') },
    { id: 'windward-mark', group: 'marks', term: t('Windward mark', 'Верхний знак', 'Baliza de barlovento'), see: '/learn/marks', def: t(
      'The mark at the top of the beat, usually left to port.',
      'Знак в конце лавировки; обычно его оставляют слева.', 'La baliza al final de la ceñida, normalmente dejada por babor.') },
    { id: 'gate', group: 'marks', term: t('Leeward gate', 'Нижние ворота', 'Puerta de sotavento'), see: '/learn/marks#gate', def: t(
      'Two marks at the bottom of the run. A boat sails between them and rounds either one, and starts the next beat from there.',
      'Два знака в конце попутного курса. Лодка проходит между ними, огибает любой и оттуда начинает следующую лавировку.', 'Dos balizas al final de la empopada. Un barco pasa entre ellas, redondea una cualquiera y empieza desde allí la siguiente ceñida.') },
    { id: 'zone', group: 'marks', term: t('Zone', 'Зона', 'Zona'), see: '/learn/rules#r18', def: t(
      'The area within three hull lengths of a mark. When the first of two overlapped boats enters it, the outside boat owes the inside one mark-room.',
      'Пространство в пределах трёх корпусов от знака. Когда первая из двух связанных лодок входит в неё, внешняя должна дать внутренней место у знака.', 'El área a menos de tres esloras de una baliza. Cuando el primero de dos barcos con compromiso entra en ella, el barco exterior debe espacio en baliza al interior.') },
    { id: 'mark-room', group: 'marks', term: t('Mark-room', 'Место у знака', 'Espacio en baliza'), see: '/learn/rules#r18', def: t(
      'Room for a boat to sail to the mark and round it as she should (rule 18).',
      'Место, чтобы подойти к знаку и обогнуть его как положено (правило 18).', 'Espacio para que un barco navegue hasta la baliza y la redondee como debe (regla 18).') },
    { id: 'penalty', group: 'right-of-way', term: t('Penalty turn', 'Штрафной оборот', 'Giro de penalización'), see: '/learn/rules#pen', def: t(
      'A turn through a tack and a gybe, taken as soon as possible after a foul, clear of other boats. Usually two turns for a foul between boats and one for touching a mark.',
      'Оборот через поворот оверштаг и фордевинд, который делают как можно скорее после нарушения, отойдя от других лодок. Обычно два оборота за нарушение против лодки и один за касание знака.', 'Un giro con una virada y una trasluchada, hecho lo antes posible tras una falta, separado de los otros barcos. Normalmente dos giros por una falta entre barcos y uno por tocar una baliza.') },
    { id: 'gennaker', group: 'boat', term: t('Gennaker (kite)', 'Генакер', 'Gennaker (kite)'), see: '/learn/downwind', def: t(
      'A big, light, asymmetric sail set from the bow for sailing downwind.',
      'Большой лёгкий асимметричный парус, который ставят с носа для попутных курсов.', 'Una vela grande, ligera y asimétrica, izada desde la proa para navegar de popa.') },
    { id: 'sheet', group: 'boat', term: t('Sheet and trim', 'Шкот и настройка', 'Escota y trimado'), see: '/learn/trim', def: t(
      'The sheet is the rope that pulls a sail in or lets it out; trimming is setting it right for the wind. Too far out and the sail flaps, too far in and it stalls.',
      'Шкот — снасть, которой парус выбирают или травят; настройка — поставить парус правильно к ветру. Перетравил — парус полощет, перебрал — срывается поток.', 'La escota es el cabo que cobra una vela o la suelta; trimar es ponerla bien para el viento. Demasiado suelta y la vela aletea, demasiado cazada y se para.') },
    { id: 'reef', group: 'boat', term: t('Reef', 'Риф', 'Rizo'), see: '/learn/trim#blow', def: t(
      'Making the mainsail smaller in a strong wind, so the boat heels less and stays fast.',
      'Уменьшение площади грота в сильный ветер, чтобы лодка меньше кренилась и шла быстрее.', 'Reducir la mayor con viento fuerte, para que el barco escore menos y siga rápido.') },
  ];
  return terms;
}
