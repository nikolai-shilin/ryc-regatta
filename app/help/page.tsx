import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { IconBack, IconArrow } from '@/components/ui';

export const metadata: Metadata = { title: 'How to play' };

const WIDE: [number, number][] = [[53.5, 3.2], [43.5, 8.5], [84, 7.5], [89, 13], [5.5, 6], [13.5, 87], [95.5, 70], [88.5, 91], [66, 66]];
const NARROW: [number, number][] = [[36, 7.6], [28.5, 13], [43, 2.5], [77, 9], [14, 4.5], [47, 91], [86, 72], [63, 91.5], [78, 55]];
const K = ({ k }: { k: string }) => <span className="kbd">{k}</span>;

// H1 · How to play: one page with the game's own pictures, instead of coach marks.
export default async function Help() {
  const { lang, t } = await getT();
  const key: [string, string][] = [
    [t('Speed', 'Скорость'), t('Boat speed in knots; under it, your speed towards the mark (VMG) and the target.', 'Скорость лодки в узлах, под ней — скорость к знаку (VMG) и цель.')],
    [t('Committee boat flags', 'Флаги судейского судна'), t('The countdown to the start. Under them: the line, the time to it, the favoured end.', 'Отсчёт до старта. Под ними — линия, время до неё и выгодный конец.')],
    [t('Views and pause', 'Виды и пауза'), t('Drone, Top and Helm; the last button pauses the race.', 'Дрон, Сверху и Штурвал; последняя кнопка ставит гонку на паузу.')],
    [t('Map', 'Карта'), t('The whole course: the marks, the line, every boat. Tap it to make it bigger.', 'Вся дистанция: знаки, линия, все лодки. Нажми, чтобы увеличить.')],
    [t('Zoom and game speed', 'Масштаб и скорость игры'), t('+ and − move the camera; 1× runs the race 1.5, 2 or 3 times faster.', '+ и − приближают камеру; 1× ускоряет гонку в 1,5, 2 или 3 раза.')],
    [t('Steering arc', 'Руль'), t('Drag along it with your left thumb, or press ← →.', 'Веди по дуге левым пальцем или жми ← →.')],
    [t('Sheet', 'Шкот'), t('Up pulls the sails in, down eases them; ↑ ↓ on a keyboard.', 'Вверх — выбрать паруса, вниз — потравить; ↑ ↓ на клавиатуре.')],
    [t('Tack', 'Поворот'), t('Turns you through the wind; downwind it gybes. Space on a keyboard.', 'Поворот через ветер, на попутном курсе — фордевинд. Пробел на клавиатуре.')],
    [t('Wind ring', 'Кольцо ветра'), t('Where the wind comes from, and the angles you can sail. See “Reading the wind”.', 'Откуда дует ветер и под какими углами можно идти. См. «Как читать ветер».')],
  ];
  const rules: [string, string, string][] = [
    [t('Rule 10', 'Правило 10'), t('Port keeps clear of starboard', 'Левый галс уступает правому'), t('On opposite tacks, the boat with the wind on her port side keeps clear.', 'На разных галсах уступает лодка, у которой ветер дует в левый борт.')],
    [t('Rule 11', 'Правило 11'), t('Windward keeps clear of leeward', 'Наветренная уступает подветренной'), t('Overlapped on the same tack, the windward boat keeps clear.', 'На одном галсе с перекрытием уступает наветренная лодка.')],
    [t('Rule 12', 'Правило 12'), t('Clear astern keeps clear', 'Идущая сзади уступает'), t('On the same tack and not overlapped, the boat behind keeps clear.', 'На одном галсе без перекрытия уступает лодка, идущая сзади.')],
    [t('Rule 13', 'Правило 13'), t('While tacking, keep clear', 'При повороте уступай'), t('From head to wind until close-hauled, a tacking boat keeps clear of everyone.', 'От линии ветра до бейдевинда поворачивающая лодка уступает всем.')],
    [t('Rule 18', 'Правило 18'), t('Mark-room', 'Место у знака'), t('In the zone — the dashed ring, three hull lengths — the inside boat, or the one clear ahead, gets room to round.', 'В зоне — пунктирное кольцо в три корпуса — место получает внутренняя лодка или та, что впереди.')],
    [t('Rules 31 and 44', 'Правила 31 и 44'), t('Penalties', 'Штрафы'), t('Break a rule: two penalty turns. Touch a mark: one. The debrief after the finish shows each one.', 'Нарушил правило — два штрафных оборота. Задел знак — один. Разбор после финиша покажет каждый.')],
  ];
  const sec = (id: string, n: number, title: string, body: React.ReactNode) => (
    <section className="hsec" id={id}>
      <div className="hsec-k"><span className="kicker">{n}</span><h2 className="h-land-s">{title}</h2></div>
      {body}
    </section>
  );
  const marks = (pts: [number, number][]) => pts.map(([x, y], i) => <span key={i} className="hmark" style={{ left: `${x}%`, top: `${y}%` }}>{i + 1}</span>);
  const item = (img: string, alt: string, title: string, text: string, keys: React.ReactNode) => (
    <div className="hitem">
      <Image className="hshot" src={`/images/${img}.jpg`} width={960} height={720} sizes="(min-width: 900px) 360px, (min-width: 600px) 50vw, 100vw" alt={alt} />
      <span className="card-title">{title}</span>
      <p className="lead">{text}</p>
      <span className="hkeys">{keys}</span>
    </div>
  );

  return (
    <div className="scr help" lang={lang}>
      <div className="hwrap">
        <header className="hhead">
          <div className="lhead">
            <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <span className="kicker">{'Up and down'}</span>
          </div>
          <h1 className="h-land">{t('How to play', 'Как играть')}</h1>
          <p className="lead">{t('Race a yacht round the marks against the computer boats. Here is everything on the race screen, and what to do with it.', 'Гонка вокруг знаков против компьютерных лодок. Здесь — всё, что есть на экране гонки, и что с этим делать.')}</p>
          <nav className="hnav" aria-label={t('Contents', 'Содержание')}>
            {[['h-screen', t('The race screen', 'Экран гонки')], ['h-controls', t('Controls', 'Управление')], ['h-wind', t('The wind', 'Ветер')], ['h-start', t('The start', 'Старт')], ['h-rules', t('Rules', 'Правила')], ['h-views', t('Views', 'Виды')], ['h-today', t('Today’s race', 'Гонка дня')]].map(([h, l]) => <a key={h} className="chip" href={`#${h}`}>{l}</a>)}
          </nav>
        </header>

        {sec('h-screen', 1, t('The race screen', 'Экран гонки'), <>
          <figure className="hfig only-wide" style={{ margin: 0 }}>
            <Image className="hshot" src="/images/hud-desk.jpg" width={2160} height={1350} sizes="(min-width: 1200px) 1120px, 100vw" alt={t('The race screen on a desktop, numbered', 'Экран гонки на компьютере, с номерами')} />
            {marks(WIDE)}
          </figure>
          <figure className="hfig only-narrow" style={{ margin: 0 }}>
            <Image className="hshot" src="/images/hud-port.jpg" width={780} height={1688} sizes="100vw" alt={t('The race screen on a phone held upright, numbered', 'Экран гонки на телефоне вертикально, с номерами')} />
            {marks(NARROW)}
          </figure>
          <ol className="hlegend">
            {key.map(([b, d], i) => <li key={i}><span className="num-ico">{i + 1}</span><span><b>{b}</b><span className="d">{d}</span></span></li>)}
          </ol>
        </>)}

        {sec('h-controls', 2, t('Controls', 'Управление'), (
          <div className="hgrid">
            {item('h-steer', t('The steering arc', 'Дуга руля'), t('Steer', 'Руль'), t('Drag your left thumb along the arc. She turns slowly, so make small moves: every turn of the rudder brakes the boat.', 'Веди левым пальцем по дуге. Яхта поворачивает медленно, так что двигай понемногу: каждый поворот руля тормозит лодку.'), <>{t('Keyboard:', 'Клавиатура:')} <K k="←" /> <K k="→" /></>)}
            {item('h-trim', t('The sheet slider', 'Ползунок шкота'), t('Trim the sails', 'Настрой паруса'), t('Slide your right thumb up to pull the sails in, down to ease them. Keep the knob in the blue band. Rather just steer? Settings › Sails › Auto.', 'Правым пальцем вверх — выбрать паруса, вниз — потравить. Держи ручку в синей полосе. Хочешь только рулить? Настройки › Паруса › Авто.'), <>{t('Keyboard:', 'Клавиатура:')} <K k="↑" /> <K k="↓" /></>)}
            {item('h-tack', t('The Tack button', 'Кнопка «Поворот»'), t('Tack, gybe, kite', 'Поворот, фордевинд, генакер'), t('Tack turns the bow through the wind; downwind the same button gybes. On a run, Kite sets the gennaker — drop it in good time before the gate. In a blow, Reef makes the main smaller.', '«Поворот» проводит нос через ветер, на попутном курсе — фордевинд. На попутном «Генакер» ставит генакер — убирай его заранее до ворот. В сильный ветер «Риф» уменьшает грот.'), <>{t('Keyboard:', 'Клавиатура:')} <K k={t('Space', 'Пробел')} /> {t('tack', 'поворот')} · <K k="K" /> {t('kite', 'генакер')}</>)}
          </div>
        ))}

        {sec('h-wind', 3, t('Reading the wind', 'Как читать ветер'), (
          <div className="hsplit">
            <Image className="hshot" src="/images/h-wind.jpg" width={960} height={720} sizes="(min-width: 600px) 50vw, 100vw" alt={t('The wind ring round the boat, from above', 'Кольцо ветра вокруг лодки, сверху')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p className="lead">{t('The ring round your boat shows the wind. It swings ten degrees and more either way every minute or so: in a lift you can point higher; in a header, tack — the chip under the speed says which.', 'Кольцо вокруг лодки показывает ветер. Он меняется на десять градусов и больше каждую минуту: когда отходит — иди круче, когда заходит — делай поворот. Подсказка под скоростью скажет, что сейчас.')}</p>
              <div className="legend" style={{ fontSize: 15, gap: '10px 12px' }}>
                <span className="sw" style={{ background: '#b9c6cf' }} /><span>{t('Arrow: where the wind comes from', 'Стрелка: откуда дует ветер')}</span>
                <span className="sw" style={{ background: '#d9675d' }} /><span>{t('Red: too close to the wind to sail', 'Красный: слишком круто, лодка не идёт')}</span>
                <span className="sw" style={{ background: '#7fd3b0' }} /><span>{t('Green: the best angle upwind', 'Зелёный: лучший угол против ветра')}</span>
                <span className="sw" style={{ background: '#4ea8e0' }} /><span>{t('Blue: the best angle downwind', 'Синий: лучший угол по ветру')}</span>
              </div>
            </div>
          </div>
        ))}

        {sec('h-start', 4, t('The start', 'Старт'), (
          <div className="hsplit">
            <Image className="hshot" src="/images/h-start.jpg" width={960} height={720} sizes="(min-width: 600px) 50vw, 100vw" alt={t('The committee boat flags over the start line', 'Флаги судейского судна над стартовой линией')} />
            <ol className="hsteps">
              <li><span className="t">{t('Class', 'Класс')}</span><span>{t('Warning: the class flag goes up and the countdown starts.', 'Предупреждение: поднимается флаг класса, начинается отсчёт.')}</span></li>
              <li><span className="t">P</span><span>{t('Preparatory: the P flag goes up (or U, or the black flag).', 'Подготовительный: поднимается флаг P (или U, или чёрный).')}</span></li>
              <li><span className="t">1:00</span><span>{t('One minute: P comes down. From now on, stay behind the line.', 'Минута: P опускается. Теперь держись за линией.')}</span></li>
              <li><span className="t">0:00</span><span>{t('The gun: the class flag comes down. Cross the line now, at full speed.', 'Сигнал: флаг класса опускается. Пересекай линию на полной скорости.')}</span></li>
              <li><span className="t">X</span><span>{t('Over early: the X flag. Go back behind the line and start again.', 'Фальстарт: флаг X. Вернись за линию и стартуй заново.')}</span></li>
            </ol>
          </div>
        ))}

        {sec('h-rules', 5, t('The rules on the water', 'Правила на воде'), <>
          <p className="lead">{t('The computer boats race by the Racing Rules of Sailing, and so do you. The six you meet most:', 'Компьютерные лодки гоняются по Правилам парусных гонок — и ты тоже. Шесть, что встречаются чаще всего:')}</p>
          <div className="hrules">
            {rules.map(([m, h, p]) => <div key={m} className="hrule"><span className="meta">{m}</span><span className="card-title">{h}</span><p className="lead">{p}</p></div>)}
          </div>
        </>)}

        {sec('h-views', 6, t('Three views', 'Три вида'), (
          <div className="hgrid">
            {item('h-view-drone', t('The drone view', 'Вид с дрона'), t('Drone', 'Дрон'), t('Behind and above the boat: the best view for racing.', 'Сзади и сверху — лучший вид для гонки.'), <>{t('Key', 'Клавиша')} <K k="X" /></>)}
            {item('h-view-top', t('The top view', 'Вид сверху'), t('Top', 'Сверху'), t('Straight down: for tactics, the line and the marks.', 'Прямо сверху — для тактики, линии и знаков.'), <>{t('Key', 'Клавиша')} <K k="C" /></>)}
            {item('h-view-helm', t('The helm view', 'Вид со штурвала'), t('Helm', 'Штурвал'), t('From the helm, as if you were sailing her.', 'Со штурвала, как будто ты на борту.'), <>{t('Key', 'Клавиша')} <K k="V" /></>)}
          </div>
        ))}

        <section className="hsec" id="h-today">
          <div className="hband">
            <span className="kicker">7</span>
            <h2 className="h-land-s">{t('Today’s race', 'Гонка дня')}</h2>
            <p className="lead">{t('Once a day everyone sails the same race: the same wind, course and fleet, so times compare fairly. Sign in and your time goes on today’s ranking. A free race lets you choose everything; its times stay with you.', 'Раз в день у всех одна гонка: один ветер, дистанция и флот, поэтому время сравнивается честно. Войди — и твоё время попадёт в рейтинг дня. В свободной гонке выбираешь всё сам, а результаты остаются у тебя.')}</p>
            <Link className="pill pill-primary pill-s" href="/race" style={{ alignSelf: 'flex-start' }}><span className="btn-t">{t('To the race hub', 'В меню гонок')}</span><IconArrow /></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
