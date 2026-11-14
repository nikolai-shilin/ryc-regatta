import Image from 'next/image';
import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { IconArrow } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const generateMetadata = titled('How to play', 'Как играть', {
  path: '/help',
  description: [
    'How to sail Up and down: steer by touch or the arrow keys, trim the main and jib, tack, gybe and hoist the gennaker, win the start and play the wind shifts. The race screen, the camera views and the racing rules, with pictures.',
    'Как играть в Up and down: руль пальцем или стрелками, настройка грота и стакселя, повороты, генакер, старт и заходы ветра. Экран гонки, виды камеры и правила парусных гонок — с картинками.'],
});

const WIDE: [number, number][] = [[34.8, 3.1], [65.2, 3.1], [44.2, 9], [84.1, 3.1], [96.5, 8], [9.2, 6.4], [9.2, 18.3], [8, 84], [95.3, 70], [87, 95.7], [73.5, 58.5], [80.8, 24.5]];
const NARROW: [number, number][] = [[12, 25.3], [86, 25.3], [32.5, 26.1], [62.3, 7.4], [89.5, 7.4], [23, 4.6], [23, 13], [21.5, 85.5], [87, 72], [59.5, 96], [50, 50], [84, 39.5]];
const K = ({ k }: { k: string }) => <span className="kbd">{k}</span>;

// H1 · How to play: one page with the game's own pictures, instead of coach marks.
export default async function Help({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const key: [string, string][] = [
    [t('Speed', 'Скорость'), t('Boat speed in knots; the bar under it fills towards her target speed.', 'Скорость лодки в узлах; полоска под ней растёт к целевой скорости.')],
    [t('The race', 'Гонка'), t('Before the start: the countdown, the distance and time to the line, the favoured end. Then the race time, the next mark and your place.', 'До старта — отсчёт, расстояние и время до линии, выгодный конец. Потом — время гонки, следующий знак и твоё место.')],
    [t('Committee boat flags', 'Флаги судейского судна'), t('The start signals. See “The start”.', 'Стартовые сигналы. См. «Старт».')],
    [t('Zoom and game speed', 'Масштаб и скорость игры'), t('+ and − move the camera; 1× runs the race 1.5, 2 or 3 times faster.', '+ и − приближают камеру; 1× ускоряет гонку в 1,5, 2 или 3 раза.')],
    [t('Camera and pause', 'Камера и пауза'), t('The camera button switches Drone, Top and Helm; the last button pauses the race.', 'Кнопка камеры переключает Дрон, Сверху и Штурвал; последняя ставит гонку на паузу.')],
    [t('Wind dial', 'Ветер'), t('Where the wind comes from and how strong it is; red, the angles too close to sail.', 'Откуда дует ветер и какой он силы; красным — слишком острые углы.')],
    [t('Map', 'Карта'), t('The whole course: the marks, the line, every boat. Tap it to make it bigger.', 'Вся дистанция: знаки, линия, все лодки. Нажми, чтобы увеличить.')],
    [t('Steering arc', 'Руль'), t('Drag along it with your left thumb, or press ← →.', 'Веди по дуге левым пальцем или жми ← →.')],
    [t('Sheet', 'Шкот'), t('Up pulls the sails in, down eases them; ↑ ↓ on a keyboard.', 'Вверх — выбрать паруса, вниз — потравить; ↑ ↓ на клавиатуре.')],
    [t('Tack', 'Поворот'), t('Turns you through the wind; downwind it gybes. Space on a keyboard.', 'Поворот через ветер, на попутном курсе — фордевинд. Пробел на клавиатуре.')],
    [t('Wind ring', 'Кольцо ветра'), t('The angles you can sail, round your boat. See “Reading the wind”.', 'Углы, под которыми можно идти, вокруг лодки. См. «Как читать ветер».')],
    [t('Where next', 'Куда дальше'), t('The line before the start, then each mark, and how far it is.', 'До старта — линия, потом каждый знак, и сколько до него.')],
  ];
  const rules: [string, string, string][] = [
    [t('Rule 10', 'Правило 10'), t('Port keeps clear of starboard', 'Левый галс уступает правому'), t('On opposite tacks, the boat with the wind on her port side keeps clear.', 'На разных галсах уступает лодка, у которой ветер дует в левый борт.')],
    [t('Rule 11', 'Правило 11'), t('Windward keeps clear of leeward', 'Наветренная уступает подветренной'), t('Overlapped on the same tack, the windward boat keeps clear.', 'На одном галсе с перекрытием уступает наветренная лодка.')],
    [t('Rule 12', 'Правило 12'), t('Clear astern keeps clear', 'Идущая сзади уступает'), t('On the same tack and not overlapped, the boat behind keeps clear.', 'На одном галсе без перекрытия уступает лодка, идущая сзади.')],
    [t('Rule 13', 'Правило 13'), t('While tacking, keep clear', 'При повороте уступай'), t('From head to wind until close-hauled, a tacking boat keeps clear of everyone.', 'От линии ветра до бейдевинда поворачивающая лодка уступает всем.')],
    [t('Rule 18', 'Правило 18'), t('Mark-room', 'Место у знака'), t('At the gate and at a mark you reach off the wind (the wing mark, mark 2, the offset mark), in the zone — the dashed ring, three hull lengths — the inside boat, or the one clear ahead, gets room to round. Not at the windward mark: there nobody gets room, and port keeps clear of starboard.', 'У ворот и у знака, к которому идёшь не в лавировку (боковой знак, знак 2, знак смещения), в зоне — пунктирное кольцо в три корпуса — место получает внутренняя лодка или та, что впереди. У верхнего знака места не требует никто: левый галс уступает правому.')],
    [t('Rules 31 and 44', 'Правила 31 и 44'), t('Penalties', 'Штрафы'), t('Break a rule or touch a mark: one penalty turn, a tack and a gybe. The debrief after the finish shows each one.', 'Нарушил правило или задел знак — штрафной оборот: поворот оверштаг и фордевинд. Разбор после финиша покажет каждый.')],
  ];
  const sec = (id: string, kicker: string, title: string, body: React.ReactNode, band = false) => {
    const el = (
      <section className="hm-page hm-sec" id={id} aria-labelledby={`${id}-t`}>
        <div className="hm-sec-t"><span className="kicker">{kicker}</span><h2 className="hm-h2" id={`${id}-t`}>{title}</h2></div>
        {body}
      </section>
    );
    return band ? <div className="hm-band">{el}</div> : el;
  };
  const marks = (pts: [number, number][]) => pts.map(([x, y], i) => <span key={i} className="hmark" style={{ left: `${x}%`, top: `${y}%` }}>{i + 1}</span>);
  const item = (img: string, alt: string, title: string, text: string, keys: React.ReactNode) => (
    <div className="hitem">
      <Image className="hshot" src={`/images/${img}-v3.jpg`} width={960} height={720} sizes="(min-width: 900px) 360px, (min-width: 600px) 50vw, 100vw" alt={alt} />
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
        <h1 className="hm-ph-h">{t('How to play', 'Как играть')}</h1>
        <p className="hm-text">{t('Everything on the race screen and what to do with it: how to steer and trim, read the wind, time the start, and the handful of rules that decide most races. Read it once and your first race goes a lot better.', 'Всё, что есть на экране гонки, и что с этим делать: как рулить и работать парусами, читать ветер, выходить на старт, и те несколько правил, что решают большинство гонок. Прочитай один раз — и первая гонка пойдёт куда лучше.')}</p>
        <nav className="hm-ph-nav" aria-label={t('Contents', 'Содержание')}>
          {[['h-screen', t('The race screen', 'Экран гонки')], ['h-controls', t('Controls', 'Управление')], ['h-wind', t('The wind', 'Ветер')], ['h-start', t('The start', 'Старт')], ['h-rules', t('Rules', 'Правила')], ['h-views', t('Views', 'Виды')], ['h-today', t('Today’s race', 'Гонка дня')]].map(([h, l]) => <a key={h} className="hm-chip" href={`#${h}`}>{l}</a>)}
        </nav>
      </header>

      {sec('h-screen', t('Everything you see', 'Всё, что на экране'), t('The race screen', 'Экран гонки'), <>
        <figure className="hfig only-wide">
          <Image className="hshot" src="/images/hud-desk-v3.jpg" width={2160} height={1350} sizes="(min-width: 1200px) 1120px, 100vw" alt={t('The race screen on a desktop, numbered', 'Экран гонки на компьютере, с номерами')} />
          {marks(WIDE)}
        </figure>
        <figure className="hfig only-narrow">
          <Image className="hshot" src="/images/hud-port-v3.jpg" width={780} height={1688} sizes="100vw" alt={t('The race screen on a phone held upright, numbered', 'Экран гонки на телефоне вертикально, с номерами')} />
          {marks(NARROW)}
        </figure>
        <ol className="hlegend">
          {key.map(([b, d], i) => <li key={i}><span className="num-ico">{i + 1}</span><span><b>{b}</b><span className="d">{d}</span></span></li>)}
        </ol>
      </>, true)}

      {sec('h-controls', t('Sailing the boat', 'Как вести лодку'), t('Controls', 'Управление'), (
        <div className="hgrid">
          {item('h-steer', t('The steering arc', 'Дуга руля'), t('Steer', 'Руль'), t('Drag your left thumb along the arc. She turns slowly, so make small moves: every turn of the rudder brakes the boat.', 'Веди левым пальцем по дуге. Яхта поворачивает медленно, так что двигай понемногу: каждый поворот руля тормозит лодку.'), <>{t('Keyboard:', 'Клавиатура:')} <K k="←" /> <K k="→" /></>)}
          {item('h-trim', t('The sheet slider', 'Ползунок шкота'), t('Trim the sails', 'Настрой паруса'), t('Slide your right thumb up to pull the sails in, down to ease them. Keep the knob in the green band. Rather just steer? Settings › Sails › Auto.', 'Правым пальцем вверх — выбрать паруса, вниз — потравить. Держи ручку в зелёной полосе. Хочешь только рулить? Настройки › Паруса › Авто.'), <>{t('Keyboard:', 'Клавиатура:')} <K k="↑" /> <K k="↓" /></>)}
          {item('h-tack', t('The Tack button', 'Кнопка «Поворот»'), t('Tack, gybe, kite', 'Поворот, фордевинд, генакер'), t('Tack turns the bow through the wind; downwind the same button gybes. On a run, Kite sets the gennaker — drop it in good time before the gate. In a blow, Reef makes the main smaller.', '«Поворот» проводит нос через ветер, на попутном курсе — фордевинд. На попутном «Генакер» ставит генакер — убирай его заранее до ворот. В сильный ветер «Риф» уменьшает грот.'), <>{t('Keyboard:', 'Клавиатура:')} <K k={t('Space', 'Пробел')} /> {t('tack', 'поворот')} · <K k="K" /> {t('kite', 'генакер')}</>)}
        </div>
      ))}

      {sec('h-wind', t('Where the speed is', 'Откуда скорость'), t('Reading the wind', 'Как читать ветер'), (
        <div className="hsplit">
          <Image className="hshot" src="/images/h-wind-v3.jpg" width={960} height={720} sizes="(min-width: 600px) 50vw, 100vw" alt={t('The wind ring round the boat, from above', 'Кольцо ветра вокруг лодки, сверху')} />
          <div className="hstack">
            <p className="lead">{t('The ring round your boat shows the angles you can sail, and the wind box at the top of the screen where the wind comes from and how strong it is. It swings ten degrees and more either way every minute or so: in a lift you can point higher; in a header, tack — on the beat the wind box says Lift or Header.', 'Кольцо вокруг лодки показывает, под какими углами можно идти, а окно ветра вверху экрана — откуда и с какой силой дует ветер. Он меняется на десять градусов и больше каждую минуту: когда отходит — иди круче, когда заходит — делай поворот. На лавировке окно ветра так и пишет: «Отход» или «Заход».')}</p>
            <div className="legend">
              <span className="lsw lsw-no" /><span>{t('Red: too close to the wind to sail', 'Красный: слишком круто, лодка не идёт')}</span>
              <span className="lsw lsw-up" /><span>{t('Green: the best angle upwind', 'Зелёный: лучший угол против ветра')}</span>
              <span className="lsw lsw-down" /><span>{t('Blue: the best angle downwind', 'Синий: лучший угол по ветру')}</span>
            </div>
          </div>
        </div>
      ), true)}

      {sec('h-start', t('Flags and the gun', 'Флаги и сигнал'), t('The start', 'Старт'), (
        <div className="hsplit">
          <Image className="hshot" src="/images/h-start-v3.jpg" width={960} height={720} sizes="(min-width: 600px) 50vw, 100vw" alt={t('The committee boat flags over the start line', 'Флаги судейского судна над стартовой линией')} />
          <ol className="hsteps">
            <li><span className="t">{t('Class', 'Класс')}</span><span>{t('Warning: the class flag goes up and the countdown starts.', 'Предупреждение: поднимается флаг класса, начинается отсчёт.')}</span></li>
            <li><span className="t">P</span><span>{t('Preparatory: the P flag goes up (or U, or the black flag).', 'Подготовительный: поднимается флаг P (или U, или чёрный).')}</span></li>
            <li><span className="t">1:00</span><span>{t('One minute: P comes down. From now on, stay behind the line.', 'Минута: P опускается. Теперь держись за линией.')}</span></li>
            <li><span className="t">0:00</span><span>{t('The gun: the class flag comes down. Cross the line now, at full speed.', 'Сигнал: флаг класса опускается. Пересекай линию на полной скорости.')}</span></li>
            <li><span className="t">X</span><span>{t('Over early: the X flag. Go back behind the line and start again.', 'Фальстарт: флаг X. Вернись за линию и стартуй заново.')}</span></li>
          </ol>
        </div>
      ))}

      {sec('h-rules', t('Who keeps clear', 'Кто уступает'), t('The rules on the water', 'Правила на воде'), <>
        <p className="lead">{t('The computer boats race by the Racing Rules of Sailing, and so do you. The six you meet most:', 'Компьютерные лодки гоняются по Правилам парусных гонок — и ты тоже. Шесть, что встречаются чаще всего:')}</p>
        <div className="hrules">
          {rules.map(([m, h, p]) => <div key={m} className="hrule"><span className="meta">{m}</span><span className="card-title">{h}</span><p className="lead">{p}</p></div>)}
        </div>
      </>, true)}

      {sec('h-views', t('Cameras', 'Камеры'), t('Three views', 'Три вида'), (
        <div className="hgrid">
          {item('h-view-drone', t('The drone view', 'Вид с дрона'), t('Drone', 'Дрон'), t('Behind and above the boat: the best view for racing.', 'Сзади и сверху — лучший вид для гонки.'), <>{t('Key', 'Клавиша')} <K k="X" /></>)}
          {item('h-view-top', t('The top view', 'Вид сверху'), t('Top', 'Сверху'), t('Straight down: for tactics, the line and the marks.', 'Прямо сверху — для тактики, линии и знаков.'), <>{t('Key', 'Клавиша')} <K k="C" /></>)}
          {item('h-view-helm', t('The helm view', 'Вид со штурвала'), t('Helm', 'Штурвал'), t('From the helm, as if you were sailing her.', 'Со штурвала, как будто ты на борту.'), <>{t('Key', 'Клавиша')} <K k="V" /></>)}
        </div>
      ))}

      <div className="hm-band">
        <section className="hm-page hm-sec hm-help" id="h-today" aria-labelledby="h-today-t">
          <div className="hm-help-main">
            <span className="kicker">{t('Once a day', 'Раз в день')}</span>
            <h2 className="hm-h2" id="h-today-t">{t('Today’s race', 'Гонка дня')}</h2>
            <p className="hm-text">{t('Once a day everyone sails the same race: the same wind, course and fleet, so times compare fairly. Sign in and your time goes on today’s ranking. A free race lets you choose everything; its times stay with you.', 'Раз в день у всех одна гонка: один ветер, дистанция и флот, поэтому время сравнивается честно. Войди — и твоё время попадёт в рейтинг дня. В свободной гонке выбираешь всё сам, а результаты остаются у тебя.')}</p>
            <Link className="pill pill-primary hm-cta" href="/race"><span className="btn-t">{t('To the race hub', 'В меню гонок')}</span><IconArrow /></Link>
          </div>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back="/help" />
    </div>
  );
}
