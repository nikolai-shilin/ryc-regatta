import Image from 'next/image';
import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { Toc } from '@/components/toc';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('How to play: controls and racing rules', 'Как играть: управление и правила гонок', 'Cómo jugar: controles y reglas de regatas', {
  path: '/help', card: '/og/page/help',
  description: [
    'How to sail Up and down: steer by touch or the arrow keys, trim the main and jib, tack, gybe and hoist the gennaker, win the start and play the wind shifts. The race screen, the camera views and the racing rules, with pictures.',
    'Как играть в Up and down: руль пальцем или стрелками, настройка грота и стакселя, повороты, генакер, старт, заходы и отходы ветра. Экран гонки, виды камеры и правила парусных гонок — с картинками.', 'Cómo navegar en Up and down: gobierna con el dedo o las flechas, trima la mayor y el foque, vira, traslucha e iza el gennaker, gana la salida y juega las roladas. La pantalla de regata, las cámaras y las reglas de regatas, con imágenes.'],
});

// where each numbered part sits on the pictures, as a share of their width and height, in the key's order (the
// pictures and the blocks' places come from scripts/shots.mjs); null where that layout has no such part (a computer
// steers with the keys, so it shows no steering arc)
type Mark = [number, number] | null;
const WIDE: Mark[] = [[33.8, 93.3], [31, 4.5], [33.8, 83.7], [85.5, 10], [75.8, 20], [18.6, 72], [72, 9.8], null, [93.3, 75], [80.4, 94], [55.5, 56], [74.6, 53.1]];
const NARROW: Mark[] = [[16, 3.5], [59.5, 19.2], [24.5, 80.4], [33, 8.7], [74, 18], [33.5, 18], [82, 49], [6, 84], [81, 80], [60, 89.5], [53, 50], [64, 40.5]];
const K = ({ k }: { k: string }) => <span className="kbd">{k}</span>;

// the committee boat's signal flags, drawn as the game flies them (public/play/index.html): the class flag (R, gold), P
// (blue with a white square), X (white with a blue cross); one lowered, faded under an arrow down
function Flag({ k, down = false }: { k: 'cls' | 'P' | 'X'; down?: boolean }) {
  return (
    <svg className={`rd-flag${down ? ' down' : ''}`} viewBox="0 0 54 36" width={54} height={36} aria-hidden="true">
      <g className="rd-flag-cloth">
        {k === 'cls' && <><rect className="f-gold" width="54" height="36" /><text className="f-ink" x="27" y="25.5" textAnchor="middle">R</text></>}
        {k === 'P' && <><rect className="f-blue" width="54" height="36" /><rect className="f-white" x="18" y="11" width="18" height="14" /></>}
        {k === 'X' && <><rect className="f-white" width="54" height="36" /><rect className="f-blue" x="21.5" width="11" height="36" /><rect className="f-blue" y="13.5" width="54" height="9" /></>}
      </g>
      {down && <path className="f-arrow" d="M27 8v20M19 20l8 8 8-8" />}
    </svg>
  );
}

// H1 · How to play: one page with the game's own pictures, instead of coach marks.
export default async function Help({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const key: [string, string][] = [
    [t('Your numbers', 'Твои цифры', 'Tus números'), t('Speed, how close you are to her target speed, VMG and the distance to the next mark, and the gap to the leader. Before the start: the distance to the line and your time to burn.', 'Скорость, насколько ты близок к целевой, VMG и расстояние до следующего знака, отставание от лидера. До старта — расстояние до линии и запас времени.', 'La velocidad, lo cerca que estás de su velocidad objetivo, el VMG y la distancia a la siguiente baliza, y la diferencia con el líder. Antes de la salida: la distancia a la línea y tu tiempo de sobra.')],
    [t('Start clock and flags', 'Часы старта и флаги', 'Reloj de salida y banderas'), t('Before the gun: the countdown, the committee boat’s flags and which end of the line is favoured. Then the legs of the race. See “The start”.', 'До сигнала — отсчёт, флаги судейского судна и выгодный конец линии. Потом — отрезки гонки. См. «Старт».', 'Antes de la señal: la cuenta atrás, las banderas del barco de comité y qué extremo de la línea está favorecido. Después, los tramos de la regata. Mira «La salida».')],
    [t('The call', 'Подсказка', 'El aviso'), t('What to do next, or what just happened: the start signals, a tip, a rule.', 'Что делать дальше или что сейчас было: сигналы старта, подсказка, правило.', 'Qué hacer ahora, o qué acaba de pasar: las señales de salida, un consejo, una regla.')],
    [t('Wind box', 'Окно ветра', 'Cuadro de viento'), t('Where the wind comes from round your bow and how strong it is; red, the angles too close to sail. On the beat it says Lift or Header.', 'Откуда дует ветер относительно носа и какой он силы; красным — слишком острые углы. На лавировке пишет «Отход» или «Заход».', 'De dónde viene el viento respecto a tu proa y cuánto sopla; en rojo, los ángulos demasiado cerrados para navegar. En la ceñida indica rolada favorable o desfavorable.')],
    [t('The fleet', 'Флот', 'La flota'), t('Before the start, who is nearest the line; then the order of the race and each boat’s gap.', 'До старта — кто ближе к линии; потом порядок гонки и разрыв каждой лодки.', 'Antes de la salida, quién está más cerca de la línea; luego el orden de la regata y la diferencia de cada barco.')],
    [t('Map', 'Карта', 'Mapa'), t('The whole course: the marks, the line, every boat. Tap it to make it bigger.', 'Вся дистанция: знаки, линия, все лодки. Нажми, чтобы увеличить.', 'Todo el recorrido: las balizas, la línea, cada barco. Tócalo para agrandarlo.')],
    [t('Camera, zoom and pause', 'Камера, масштаб и пауза', 'Cámara, zoom y pausa'), t('The camera button switches Drone, Top and Helm; + and − zoom; 1× runs the race faster; the last button pauses.', 'Кнопка камеры переключает Дрон, Сверху и Штурвал; + и − приближают; 1× ускоряет гонку; последняя кнопка — пауза.', 'El botón de cámara alterna Dron, Cenital y Timón; + y − hacen zoom; 1× acelera la regata; el último botón la pone en pausa.')],
    [t('Steering arc', 'Руль', 'Arco de dirección'), t('On a phone, drag along it with your left thumb. On a computer, ← →.', 'На телефоне веди по дуге левым пальцем. На компьютере — ← →.', 'En el móvil, arrastra a lo largo con el pulgar izquierdo. En el ordenador, ← →.')],
    [t('Sheet', 'Шкот', 'Escota'), t('Up pulls the sails in, down eases them; keep the knob in the green band. ↑ ↓ on a keyboard.', 'Вверх — выбрать шкот, вниз — потравить; держи ручку в зелёной полосе. ↑ ↓ на клавиатуре.', 'Arriba cobra las velas, abajo las larga; mantén el control en la banda verde. ↑ ↓ en el teclado.')],
    [t('Tack', 'Поворот', 'Virar'), t('Turns you through the wind; downwind it gybes. The kite, a reef or a smaller jib come up above it when they’re wanted.', 'Поворот через ветер, на попутном курсе — фордевинд. Генакер, риф и малый стаксель появляются над ней, когда нужны.', 'Te gira a través del viento; de popa, trasluchas. El gennaker, un rizo o un foque menor aparecen encima cuando hacen falta.')],
    [t('Wind ring', 'Кольцо ветра', 'Anillo de viento'), t('The angles you can sail, round your boat. See “Reading the wind”.', 'Углы, под которыми можно идти, вокруг лодки. См. «Как читать ветер».', 'Los ángulos que puedes navegar, alrededor de tu barco. Mira «Leer el viento».')],
    [t('Where next', 'Куда дальше', 'Siguiente'), t('The line before the start, then each mark, and how far it is.', 'До старта — линия, потом каждый знак, и сколько до него.', 'La línea antes de la salida, luego cada baliza y a qué distancia está.')],
  ];
  const rules: [string, string, string][] = [
    [t('Rule 10', 'Правило 10', 'Regla 10'), t('Port keeps clear of starboard', 'Левый галс уступает правому', 'Babor se mantiene separado de estribor'), t('On opposite tacks, the boat with the wind on her port side keeps clear.', 'На разных галсах уступает лодка, у которой ветер дует в левый борт.', 'En amuras opuestas, el barco con el viento por su banda de babor se mantiene separado.')],
    [t('Rule 11', 'Правило 11', 'Regla 11'), t('Windward keeps clear of leeward', 'Наветренная уступает подветренной', 'Barlovento se mantiene separado de sotavento'), t('Overlapped on the same tack, the windward boat keeps clear.', 'Если лодки на одном галсе связаны, уступает наветренная.', 'Con compromiso y en la misma amura, el barco de barlovento se mantiene separado.')],
    [t('Rule 12', 'Правило 12', 'Regla 12'), t('Clear astern keeps clear', 'Чисто позади уступает', 'Libre por la popa se mantiene separado'), t('On the same tack and not overlapped, the boat behind keeps clear.', 'На одном галсе без связанности уступает лодка чисто позади.', 'En la misma amura y sin compromiso, el barco de atrás se mantiene separado.')],
    [t('Rule 13', 'Правило 13', 'Regla 13'), t('While tacking, keep clear', 'При повороте уступай', 'Al virar, mantente separado'), t('From head to wind until close-hauled, a tacking boat keeps clear of everyone.', 'От положения левентик до бейдевинда поворачивающая лодка уступает всем.', 'Desde la proa al viento hasta estar de ceñida, un barco que vira se mantiene separado de todos.')],
    [t('Rule 18', 'Правило 18', 'Regla 18'), t('Mark-room', 'Место у знака', 'Espacio en baliza'), t('At every mark, in the zone — the dashed ring, three hull lengths — the inside boat, or the one clear ahead, gets room to round. At the windward mark only between boats on the same tack: on opposite tacks there is no inside or outside, and port keeps clear of starboard.', 'У каждого знака в зоне — пунктирное кольцо в три корпуса — место получает внутренняя лодка или та, что чисто впереди. У верхнего знака — только между лодками на одном галсе: на разных галсах нет внутренней и внешней, левый галс уступает правому.', 'En cada baliza, dentro de la zona —el anillo discontinuo, tres esloras— el barco interior, o el que va libre por la proa, tiene espacio para montarla. En la baliza de barlovento solo entre barcos en la misma amura: en amuras opuestas no hay interior ni exterior, y babor se mantiene separado de estribor.')],
    [t('Rules 31 and 44', 'Правила 31 и 44', 'Reglas 31 y 44'), t('Penalties', 'Штрафы', 'Penalizaciones'), t('Break a rule or touch a mark: one penalty turn, a tack and a gybe. The debrief after the finish shows each one.', 'Нарушил правило или задел знак — штрафной оборот: поворот оверштаг и фордевинд. Разбор после финиша покажет каждый.', 'Rompe una regla o toca una baliza: un giro de penalización, una virada y una trasluchada. El análisis tras la llegada muestra cada una.')],
  ];
  const contents: [string, string][] = [['h-screen', t('The race screen', 'Экран гонки', 'La pantalla de regata')], ['h-controls', t('Controls', 'Управление', 'Controles')], ['h-wind', t('The wind', 'Ветер', 'El viento')], ['h-start', t('The start', 'Старт', 'La salida')], ['h-rules', t('Rules', 'Правила', 'Reglas')], ['h-views', t('Views', 'Виды', 'Vistas')], ['h-today', t('Today’s race', 'Гонка дня', 'La regata del día')]];
  // the start sequence as the game runs it (public/game/main.js): the warning and the preparatory at the sequence's
  // length, then the one-minute signal and the gun
  const start: [string, React.ReactNode, string, boolean?][] = [
    [t('Warning', 'Предупреждение', 'Atención'), <Flag k="cls" />, t('The class flag goes up and the countdown starts.', 'Поднимается флаг класса, начинается отсчёт.', 'Se iza la bandera de clase y empieza la cuenta atrás.')],
    [t('Preparatory', 'Подготовительный', 'Preparación'), <Flag k="P" />, t('The P flag goes up (or I, U or the black flag). Under I, a boat over the line in the last minute goes back round an end of it.', 'Поднимается флаг P (или I, U, или чёрный). Под флагом I лодка, оказавшаяся за линией в последнюю минуту, возвращается в обход конца линии.', 'Se iza la bandera P (o I, U o la bandera negra). Con la I, un barco que pase la línea en el último minuto vuelve rodeando uno de sus extremos.')],
    [t('1:00 · One minute', '1:00 · Минута', '1:00 · Un minuto'), <Flag k="P" down />, t('P comes down. From now on, stay behind the line.', 'P опускается. Теперь держись за линией.', 'Se arría la P. Desde ahora, quédate por detrás de la línea.')],
    [t('0:00 · The gun', '0:00 · Сигнал', '0:00 · La señal de salida'), <Flag k="cls" down />, t('The class flag comes down. Cross the line now, at full speed.', 'Флаг класса опускается. Пересекай линию на полной скорости.', 'Se arría la bandera de clase. Cruza la línea ahora, a toda velocidad.'), true],
    [t('Over early', 'Фальстарт', 'Salida adelantada'), <Flag k="X" />, t('The X flag. Go back behind the line, keeping clear of the boats that have started, and start again.', 'Флаг X. Вернись за линию, уступая стартовавшим, и стартуй заново.', 'La bandera X. Vuelve por detrás de la línea, manteniéndote separado de los que han salido, y sal de nuevo.')],
  ];
  // the sections run in a column beside the contents card (components/toc.tsx) on a wide screen; on a narrower one the
  // bands reach the screen's edges, as before
  const sec = (id: string, kicker: string, title: string, body: React.ReactNode, band = false) => {
    const el = (
      <section className="hm-sec" id={id} aria-labelledby={`${id}-t`}>
        <div className="hm-sec-t"><span className="kicker">{kicker}</span><h2 className="hm-h2" id={`${id}-t`}>{title}</h2></div>
        {body}
      </section>
    );
    return band ? <div className="hm-band">{el}</div> : el;
  };
  const marks = (pts: Mark[]) => pts.map((m, i) => m && <span key={i} className="hmark" style={{ left: `${m[0]}%`, top: `${m[1]}%` }}>{i + 1}</span>);
  const item = (img: string, alt: string, title: string, text: string, keys: React.ReactNode) => (
    <div className="hitem">
      <Image className="hshot" src={`/images/${img}.jpg`} width={960} height={720} sizes="(min-width: 900px) 360px, (min-width: 600px) 50vw, 100vw" alt={alt} />
      <span className="card-title">{title}</span>
      <p className="lead">{text}</p>
      <span className="hkeys">{keys}</span>
    </div>
  );

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="help" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('How to play', 'Как играть', 'Cómo jugar')}</h1>
        <p className="hm-text">{t('Everything on the race screen and what to do with it: how to steer and trim, read the wind, time the start, and the handful of rules that decide most races. Read it once and your first race goes a lot better.', 'Всё, что есть на экране гонки, и что с этим делать: как рулить и работать парусами, читать ветер, выходить на старт, и те несколько правил, что решают большинство гонок. Прочитай один раз — и первая гонка пойдёт куда лучше.', 'Todo lo que hay en la pantalla de regata y qué hacer con ello: cómo gobernar y trimar, leer el viento, cronometrar la salida y las pocas reglas que deciden la mayoría de las regatas. Léelo una vez y tu primera regata irá mucho mejor.')}</p>
        <nav className="hm-ph-nav rd-chips" aria-label={t('Contents', 'Содержание', 'Contenido')}>
          {contents.map(([h, l]) => <a key={h} className="hm-chip" href={`#${h}`}>{l}</a>)}
        </nav>
      </header>

      <div className="hm-page rd-layout">
        <Toc items={contents} label={t('Contents', 'Содержание', 'Contenido')} />
        <div className="rd-main">
          {sec('h-screen', t('Everything you see', 'Всё, что на экране', 'Todo lo que ves'), t('The race screen', 'Экран гонки', 'La pantalla de regata'), <>
            <figure className="hfig only-wide">
              <Image className="hshot" src="/images/hud-desk-v9.jpg" width={3240} height={2025} sizes="(min-width: 1200px) 1120px, 100vw" alt={t('The race screen on a desktop, numbered', 'Экран гонки на компьютере, с номерами', 'La pantalla de regata en un ordenador, numerada')} />
              {marks(WIDE)}
            </figure>
            <figure className="hfig only-narrow">
              <Image className="hshot" src="/images/hud-port-v9.jpg" width={1170} height={2532} sizes="100vw" alt={t('The race screen on a phone held upright, numbered', 'Экран гонки на телефоне вертикально, с номерами', 'La pantalla de regata en un móvil en vertical, numerada')} />
              {marks(NARROW)}
            </figure>
            <ol className="hlegend">
              {key.map(([b, d], i) => <li key={i}><span className="num-ico">{i + 1}</span><span><b>{b}</b><span className="d">{d}</span></span></li>)}
            </ol>
          </>, true)}

          {sec('h-controls', t('Sailing the boat', 'Как вести лодку', 'Navegar el barco'), t('Controls', 'Управление', 'Controles'), (
            <div className="hgrid">
              {item('h-steer-v9', t('The steering arc', 'Дуга руля', 'El arco de dirección'), t('Steer', 'Руль', 'Gobierna'), t('Drag your left thumb along the arc. She turns slowly, so make small moves: every turn of the rudder brakes the boat.', 'Веди левым пальцем по дуге. Яхта поворачивает медленно, так что двигай понемногу: каждый поворот руля тормозит лодку.', 'Arrastra el pulgar izquierdo a lo largo del arco. Gira despacio, así que haz movimientos pequeños: cada giro del timón frena el barco.'), <>{t('Keyboard:', 'Клавиатура:', 'Teclado:')} <K k="←" /> <K k="→" /></>)}
              {item('h-trim-v9', t('The sheet slider', 'Ползунок шкота', 'El control de escota'), t('Trim the sails', 'Настрой паруса', 'Trima las velas'), t('Slide your right thumb up to pull the sails in, down to ease them. Keep the knob in the green band. Rather just steer? Settings › Sails › Auto.', 'Правым пальцем вверх — выбрать шкот, вниз — потравить. Держи ручку в зелёной полосе. Хочешь только рулить? Настройки › Паруса › Авто.', 'Desliza el pulgar derecho hacia arriba para cobrar las velas, hacia abajo para largarlas. Mantén el control en la banda verde. ¿Prefieres solo gobernar? Ajustes › Velas › Auto.'), <>{t('Keyboard:', 'Клавиатура:', 'Teclado:')} <K k="↑" /> <K k="↓" /></>)}
              {item('h-tack-v9', t('The Tack button', 'Кнопка «Поворот»', 'El botón Virar'), t('Tack, gybe, kite', 'Поворот, фордевинд, генакер', 'Virar, trasluchar, gennaker'), t('Tack turns the bow through the wind; downwind the same button gybes. On a run, Kite sets the gennaker — drop it in good time before the gate. In a blow, Reef makes the main smaller.', '«Поворот» проводит нос через ветер, на попутном курсе — фордевинд. На попутном «Генакер» ставит генакер — убирай его заранее до ворот. В сильный ветер «Риф» уменьшает грот.', 'Virar gira la proa a través del viento; de popa, el mismo botón traslucha. En una empopada, Gennaker iza el gennaker: arríalo con tiempo antes de la puerta. Con viento fuerte, Rizo reduce la mayor.'), <>{t('Keyboard:', 'Клавиатура:', 'Teclado:')} <K k={t('Space', 'Пробел', 'Espacio')} /> {t('tack', 'поворот', 'virar')} · <K k="K" /> {t('kite', 'генакер', 'gennaker')}</>)}
            </div>
          ))}

          {sec('h-wind', t('Where the speed is', 'Откуда скорость', 'Dónde está la velocidad'), t('Reading the wind', 'Как читать ветер', 'Leer el viento'), (
            <div className="hsplit">
              <Image className="hshot" src="/images/h-wind-v9.jpg" width={960} height={720} sizes="(min-width: 600px) 50vw, 100vw" alt={t('The wind ring round the boat, from above', 'Кольцо ветра вокруг лодки, сверху', 'El anillo de viento alrededor del barco, visto desde arriba')} />
              <div className="hstack">
                <p className="lead">{t('The ring round your boat shows the angles you can sail, and the wind box at the top of the screen where the wind comes from and how strong it is. It swings ten degrees and more either way every minute or so: in a lift you can point higher; in a header, tack — on the beat the wind box says Lift or Header.', 'Кольцо вокруг лодки показывает, под какими углами можно идти, а окно ветра вверху экрана — откуда и с какой силой дует ветер. Он меняется на десять градусов и больше каждую минуту: когда отходит — иди круче, когда заходит — делай поворот. На лавировке окно ветра так и пишет: «Отход» или «Заход».', 'El anillo alrededor de tu barco muestra los ángulos que puedes navegar, y el cuadro de viento, arriba en la pantalla, de dónde viene el viento y cuánto sopla. Rola diez grados o más a un lado y a otro cada minuto más o menos: con una rolada favorable puedes ceñir más; con una desfavorable, vira. En la ceñida, el cuadro de viento indica rolada favorable o desfavorable.')}</p>
                <div className="legend">
                  <span className="lsw lsw-no" /><span>{t('Red: too close to the wind to sail', 'Красный: слишком круто, лодка не идёт', 'Rojo: demasiado cerca del viento para navegar')}</span>
                  <span className="lsw lsw-up" /><span>{t('Green: the best angle upwind', 'Зелёный: лучший угол на лавировке', 'Verde: el mejor ángulo de ceñida')}</span>
                  <span className="lsw lsw-down" /><span>{t('Blue: the best angle downwind', 'Синий: лучший угол на попутном курсе', 'Azul: el mejor ángulo de popa')}</span>
                </div>
              </div>
            </div>
          ), true)}

          {sec('h-start', t('Flags and the gun', 'Флаги и сигнал', 'Banderas y señal de salida'), t('The start', 'Старт', 'La salida'), <>
            <ol className="rd-flags">
              {start.map(([when, flag, what, gun]) => <li key={when} className={gun ? 'gun' : undefined}><span className={gun ? 'lbl-ink' : 'lbl'}>{when}</span>{flag}<span className="d">{what}</span></li>)}
            </ol>
            <Image className="hshot rd-flags-shot" src="/images/h-start-v9.jpg" width={960} height={720} sizes="(min-width: 600px) 560px, 100vw" alt={t('The committee boat flags over the start line', 'Флаги судейского судна над стартовой линией', 'Las banderas del barco de comité sobre la línea de salida')} />
          </>)}

          {sec('h-rules', t('Who keeps clear', 'Кто уступает', 'Quién se mantiene separado'), t('The rules on the water', 'Правила на воде', 'Las reglas en el agua'), <>
            <p className="lead">{t('The computer boats race by the Racing Rules of Sailing, and so do you. The six you meet most:', 'Компьютерные лодки гоняются по Правилам парусных гонок — и ты тоже. Шесть, что встречаются чаще всего:', 'Los barcos del ordenador compiten según el Reglamento de Regatas a Vela, y tú también. Las seis que más verás:')}</p>
            <div className="hrules">
              {rules.map(([m, h, p]) => <div key={m} className="hrule"><span className="meta">{m}</span><span className="card-title">{h}</span><p className="lead">{p}</p></div>)}
            </div>
          </>, true)}

          {sec('h-views', t('Cameras', 'Камеры', 'Cámaras'), t('Three views', 'Три вида', 'Tres vistas'), (
            <div className="hgrid">
              {item('h-view-drone-v9', t('The drone view', 'Вид с дрона', 'La vista de dron'), t('Drone', 'Дрон', 'Dron'), t('Behind and above the boat: the best view for racing.', 'Сзади и сверху — лучший вид для гонки.', 'Detrás y por encima del barco: la mejor vista para competir.'), <>{t('Key', 'Клавиша', 'Tecla')} <K k="X" /></>)}
              {item('h-view-top-v9', t('The top view', 'Вид сверху', 'La vista cenital'), t('Top', 'Сверху', 'Cenital'), t('Straight down: for tactics, the line and the marks.', 'Прямо сверху — для тактики, линии и знаков.', 'Justo desde arriba: para la táctica, la línea y las balizas.'), <>{t('Key', 'Клавиша', 'Tecla')} <K k="C" /></>)}
              {item('h-view-helm-v9', t('The helm view', 'Вид со штурвала', 'La vista de timón'), t('Helm', 'Штурвал', 'Timón'), t('From the helm, as if you were sailing her.', 'Со штурвала, как будто ты на борту.', 'Desde el timón, como si lo navegaras tú.'), <>{t('Key', 'Клавиша', 'Tecla')} <K k="V" /></>)}
            </div>
          ))}

          <div className="hm-band rd-end">
            <section className="hm-sec hm-help" id="h-today" aria-labelledby="h-today-t">
              <div className="hm-help-main">
                <span className="kicker">{t('Once a day', 'Раз в день', 'Una vez al día')}</span>
                <h2 className="hm-h2" id="h-today-t">{t('Today’s race', 'Гонка дня', 'La regata del día')}</h2>
                <p className="hm-text">{t('Once a day everyone sails the same race: the same wind, course and fleet, so times compare fairly. Sign in and your time goes on today’s ranking. A custom race lets you choose everything; its times stay with you.', 'Раз в день у всех одна гонка: один ветер, дистанция и флот, поэтому время сравнивается честно. Войди — и твоё время попадёт в рейтинг дня. В своей гонке выбираешь всё сам, а результаты остаются у тебя.', 'Una vez al día todos navegan la misma regata: el mismo viento, recorrido y flota, así que los tiempos se comparan con justicia. Inicia sesión y tu tiempo entra en la clasificación del día. Una regata personalizada te deja elegirlo todo; sus tiempos se quedan contigo.')}</p>
                <Link className="pill pill-primary hm-cta" href="/race"><span className="btn-t">{t('To the race hub', 'В меню гонок', 'Al centro de regatas')}</span><IconArrow /></Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      <SiteFoot lang={lang} t={t} back="/help" />
    </div>
  );
}
