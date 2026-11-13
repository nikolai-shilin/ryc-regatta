import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { todayTop } from '@/lib/today';
import { dailyRace, KN } from '@/lib/race';
import { Logo, Langs, IconPlay, clock } from '@/components/ui';

// H0 · Home: what Up and down is, in detail, for anyone arriving on the web.
export default async function Home() {
  const { lang, t } = await getT();
  const [today, d] = [await todayTop(), dailyRace()];
  const windName = { light: t('Light', 'Слабый'), medium: t('Medium', 'Средний'), strong: t('Strong', 'Сильный') }[d.preset];
  const top = today && today.d === d.day ? today.top : [];
  return (
    <div className="scr help home" lang={lang}>
      <header className="home-hero">
        <Image className="bgimg only-wide" src="/images/drone-desk.jpg" alt="" fill priority sizes="100vw" />
        <Image className="bgimg only-narrow" src="/images/drone-port.jpg" alt="" fill priority sizes="100vw" />
        <div className="shade-hero" />
        <nav className="home-top" aria-label={t('Main', 'Главное')}>
          <Logo className="logo-w" />
          <span className="kicker" style={{ color: '#fff' }}>Up and down</span>
          <span className="sp" />
          <Link className="navl only-wide" href="/help">{t('How to play', 'Как играть')}</Link>
          <Link className="navl only-wide" href="/sign-in">{t('Sign in', 'Войти')}</Link>
          <Langs lang={lang} back="/" className="only-wide" />
          <Link className="pill pill-primary pill-xs" href="/race" style={{ flex: 'none' }}><span className="btn-t">{t('Play', 'Играть')}</span></Link>
        </nav>
        <div className="home-hero-in">
          <span className="kicker" style={{ color: '#fff' }}>{t('A sailing race game by RYC', 'Парусная гонка от RYC')}</span>
          <h1 className="on-photo">Up and down</h1>
          <p className="lead on-photo">{t('Race a yacht round a windward–leeward course against the computer boats — in shifting wind, under the real racing rules. In the browser, on a phone or a computer.', 'Гонка на яхте по дистанции «апвинд — даунвинд» против компьютерных лодок — в меняющийся ветер, по настоящим правилам гонок. В браузере, на телефоне или компьютере.')}</p>
          <div className="facts-row">
            <span className="chip chip-photo">{t('Free', 'Бесплатно')}</span>
            <span className="chip chip-photo">{t('Nothing to install', 'Без установки')}</span>
            <span className="chip chip-photo">{t('Phone or computer', 'Телефон или компьютер')}</span>
            <span className="chip chip-photo">English · Русский</span>
          </div>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <a className="pill pill-primary pill-s" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Play today’s race', 'Сыграть гонку дня')}</span></a>
            <Link className="pill pill-s pill-photo" href="/help"><span className="btn-t">{t('How to play', 'Как играть')}</span></Link>
          </div>
        </div>
      </header>

      <div className="hwrap">
        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{t('The race', 'Гонка')}</span><h2 className="h-land-s">{t('What you do out there', 'Что делать на воде')}</h2></div>
          <div className="hsplit">
            <Image className="hshot" src="/images/hud-desk.jpg" width={2160} height={1350} sizes="(min-width: 900px) 540px, 100vw" alt={t('The race screen just before the start', 'Экран гонки перед стартом')} />
            <ol className="hlegend" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <Step n={1} title={t('Start', 'Старт')} text={t('The fleet circles behind the line while the committee boat counts down with flags. Cross just after the gun, at full speed — over early and you go back.', 'Лодки кружат за линией, пока судейское судно отсчитывает время флагами. Пересеки линию сразу после сигнала, на полной скорости; раньше — придётся вернуться.')} />
              <Step n={2} title={t('Beat to the windward mark', 'Лавировка к верхнему знаку')} text={t('Sail as close to the wind as the boat allows, tack on the shifts and keep out of the other boats’ wind shadow.', 'Иди так круто к ветру, как позволяет лодка, поворачивай на заходах и уходи из ветровой тени других лодок.')} />
              <Step n={3} title={t('Run to the gate', 'Попутный к воротам')} text={t('Bear away, hoist the gennaker and surf down to the leeward gate. Get it down in good time before you round.', 'Уваливайся, ставь генакер и скользи по волнам к нижним воротам. Убери его заранее, до огибания.')} />
              <Step n={4} title={t('Finish', 'Финиш')} text={t('Another lap if the race has two, then cross the line. The debrief shows where you gained and where you lost.', 'Ещё круг, если их два, затем пересеки линию. Разбор покажет, где ты выиграл, а где потерял.')} />
            </ol>
          </div>
        </section>

        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{t('Real sailing, made playable', 'Настоящий парусный спорт — в игре')}</span><h2 className="h-land-s">{t('Everything a race has', 'Всё, что есть в гонке')}</h2></div>
          <div className="hgrid">
            <Feat img="h-wind" title={t('Wind that never sits still', 'Ветер не стоит на месте')} text={t('It swings ten degrees and more every minute, with gusts and lulls. Read the shifts on the ring round your boat and tack on the headers.', 'Он меняется на десять градусов и больше каждую минуту, с порывами и затишьями. Читай заходы по кольцу вокруг лодки и поворачивай на них.')} />
            <Feat img="h-start" title={t('A start like a real one', 'Старт как настоящий')} text={t('Class flag, P, one minute, the gun. Over early and the X flag sends you back; under the U or the black flag, you are out.', 'Флаг класса, P, минута, сигнал. Фальстарт — флаг X, возвращайся; под флагом U или чёрным — дисквалификация.')} />
            <Feat img="h-trim" title={t('Sails you trim', 'Паруса, которые надо настраивать')} text={t('Pull the sheet in upwind, ease it off the wind — or let auto-trim do it and just steer. Main and jib on their own sliders, if you want both.', 'Выбирай шкот на лавировке, трави на попутном — или включи автонастройку и просто рули. Грот и стаксель — каждый на своём ползунке, если хочешь.')} />
            <Feat img="h-tack" title={t('Kite, reef and jibs', 'Генакер, риф и стаксели')} text={t('The gennaker takes the crew a few seconds to hoist and drop. In a blow, reef the main or change down to a smaller jib.', 'Экипажу нужно несколько секунд, чтобы поставить или убрать генакер. В сильный ветер возьми риф или смени стаксель на меньший.')} />
            <Feat img="h-view-drone" title={t('Rivals who know the rules', 'Соперники знают правила')} text={t('Three, five or seven computer boats that hail, keep clear, take room at the mark — and spin their penalty turns when they get it wrong.', 'Три, пять или семь компьютерных лодок окликают, уступают, берут место у знака — и крутят штрафные обороты, когда ошибаются.')} />
            <Feat img="h-view-helm" title={t('Three ways to watch', 'Три вида')} text={t('The drone behind the boat, straight down for tactics, or the helm for the feel of it. Switch at any moment.', 'Дрон за лодкой, вид сверху для тактики или со штурвала — для ощущения. Переключай в любой момент.')} />
          </div>
        </section>

        <section className="hsec">
          <div className="hsplit">
            <div className="hsec-k" style={{ gap: 14 }}>
              <span className="kicker">{t('Every day', 'Каждый день')}</span>
              <h2 className="h-land-s">{t('Today’s race, the same for everyone', 'Гонка дня — одна для всех')}</h2>
              <p className="lead">{t('One race a day with the same wind, course and fleet for every player, so the times compare fairly. Sign in with Google or your email to put your time on the ranking; your best times follow you to any device.', 'Одна гонка в день: у всех один ветер, дистанция и флот, поэтому время сравнивается честно. Войди через Google или по почте, чтобы попасть в рейтинг; лучшие результаты будут с тобой на любом устройстве.')}</p>
              <a className="pill pill-primary pill-s" href="/play?race=today" style={{ alignSelf: 'flex-start' }}><IconPlay /><span className="btn-t">{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
            </div>
            <div className="band-line fastest" style={{ padding: '22px 24px 14px' }}>
              <div className="lhead"><span className="meta">{t('Today’s fastest', 'Самые быстрые сегодня')}</span><span className="sp" /><span className="meta">{windName} · {KN[d.preset]} {t('kn', 'уз')} · {d.fleet} {t('boats', 'лодок')}</span></div>
              <ol className="lb" style={{ fontSize: 17 }}>
                {top.map((r, i) => <li key={i}><span className="n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span><span>{clock(r.s)}</span></li>)}
                {!top.length && <li><span className="n">·</span><span style={{ color: 'var(--muted)' }}>{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
                <li className="me"><span className="n">·</span><span>{t('You?', 'Ты?')}</span><span /></li>
              </ol>
            </div>
          </div>
        </section>

        <section className="hsec">
          <div className="hsplit">
            <div className="hsec-k" style={{ gap: 14 }}>
              <span className="kicker">{t('Free race', 'Свободная гонка')}</span>
              <h2 className="h-land-s">{t('Or set up your own', 'Или настрой свою')}</h2>
              <p className="lead">{t('Choose the conditions and race as often as you like. The game keeps your best time for every course.', 'Выбирай условия и гоняйся сколько хочешь. Игра помнит твой лучший результат на каждой дистанции.')}</p>
              <Link className="pill pill-s" href="/race/free" style={{ alignSelf: 'flex-start' }}><span className="btn-t">{t('Set up a free race', 'Настроить гонку')}</span></Link>
            </div>
            <div>
              <Row k={t('Wind', 'Ветер')} v={t('light 7 kn · medium 12 · strong 19', 'слабый 7 уз · средний 12 · сильный 19')} />
              <Row k={t('Boats', 'Лодок')} v="3 · 5 · 7" />
              <Row k={t('Course', 'Дистанция')} v={t('short · medium · long', 'короткая · средняя · длинная')} />
              <Row k={t('Laps', 'Круги')} v="1 · 2" />
              <Row k={t('Start sequence', 'Стартовая процедура')} v={t('1 · 3 · 5 min', '1 · 3 · 5 мин')} />
              <Row k={t('Current', 'Течение')} v={t('off · on', 'выкл · вкл')} />
            </div>
          </div>
        </section>

        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{t('After the finish', 'После финиша')}</span><h2 className="h-land-s">{t('A debrief, not just a place', 'Разбор, а не только место')}</h2></div>
          <div className="hrules">
            <Rule k={t('Start', 'Старт')} v={t('How far from the line you were at the gun, and how fast.', 'Как далеко от линии ты был в момент сигнала и с какой скоростью.')} />
            <Rule k={t('Speed', 'Скорость')} v={t('Your average speed against the boat’s target for each angle.', 'Средняя скорость против целевой для каждого курса.')} />
            <Rule k={t('Tacks', 'Повороты')} v={t('How many you made in a header, and how many in a lift.', 'Сколько поворотов ты сделал на заходе, а сколько — на отходе.')} />
            <Rule k={t('Dirty air', 'Ветровая тень')} v={t('The seconds you sailed in another boat’s wind shadow.', 'Сколько секунд ты шёл в ветровой тени другой лодки.')} />
            <Rule k={t('Rules', 'Правила')} v={t('Every foul and every hail, with the rule behind it and a link to read it.', 'Каждое нарушение и каждый оклик — с правилом и ссылкой на него.')} />
            <Rule k={t('Track', 'Трек')} v={t('Your course drawn over the race area, next to the results.', 'Твой путь на схеме дистанции рядом с результатами.')} />
          </div>
        </section>

        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{t('Anywhere', 'Где угодно')}</span><h2 className="h-land-s">{t('Hold it any way you like', 'Держи как удобно')}</h2></div>
          <div className="hgrid">
            <Device kind="side" title={t('Phone, sideways', 'Телефон горизонтально')} text={t('Both thumbs: steer on the left, trim on the right, Tack under your right thumb.', 'Оба пальца: левым рулишь, правым работаешь шкотом, «Поворот» — под правым.')} />
            <Device kind="up" title={t('Phone, upright', 'Телефон вертикально')} text={t('The same race held upright — the controls rearrange themselves. Turn the phone at any time.', 'Та же гонка, только вертикально — управление перестраивается само. Поворачивай телефон когда угодно.')} />
            <Device kind="desk" title={t('Computer', 'Компьютер')} text={t('Arrows steer and trim, Space tacks, K hoists the kite, X C V switch the view.', 'Стрелки — руль и шкот, пробел — поворот, K — генакер, X C V — вид.')} />
          </div>
        </section>

        <section className="hsec">
          <div className="hband" style={{ padding: 32 }}>
            <span className="kicker">{t('Ready?', 'Готов?')}</span>
            <h2 className="h-land-s">{t('The start sequence is waiting', 'Стартовая процедура ждёт')}</h2>
            <p className="lead" style={{ color: 'var(--muted)' }}>{t('Up and down is made by RYC alongside Sailing Certification Test, the app for IYT exam practice: learn the rules there, race by them here.', 'Up and down делает RYC вместе с Sailing Certification Test — приложением для подготовки к экзаменам IYT: учи правила там, гоняйся по ним здесь.')}</p>
            <div className="btn-row">
              <a className="pill pill-primary pill-s" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Play today’s race', 'Сыграть гонку дня')}</span></a>
              <Link className="pill pill-s" href="/help"><span className="btn-t">{t('How to play', 'Как играть')}</span></Link>
            </div>
          </div>
        </section>

        <footer className="hfoot">
          <span className="kicker">RYC · Up and down</span>
          <Link href="/help">{t('How to play', 'Как играть')}</Link>
          <Link href="/race">{t('Race hub', 'Меню гонок')}</Link>
          <Link href="/sign-in">{t('Sign in', 'Войти')}</Link>
          <a href="https://iyt.rycrentals.com/">Sailing Certification Test</a>
          <span className="sp" />
          <Langs lang={lang} back="/" />
        </footer>
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return <li><span className="num-ico">{n}</span><span><b>{title}</b><span className="d">{text}</span></span></li>;
}
function Feat({ img, title, text }: { img: string; title: string; text: string }) {
  return (
    <div className="hitem">
      <Image className="hshot" src={`/images/${img}.jpg`} width={960} height={720} sizes="(min-width: 900px) 360px, (min-width: 600px) 50vw, 100vw" alt="" />
      <span className="card-title">{title}</span>
      <p className="lead">{text}</p>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="srow"><span className="srow-k">{k}</span><span className="small" style={{ color: 'var(--muted)' }}>{v}</span></div>;
}
function Rule({ k, v }: { k: string; v: string }) {
  return <div className="hrule"><span className="meta">{k}</span><p className="lead">{v}</p></div>;
}
function Device({ kind, title, text }: { kind: 'side' | 'up' | 'desk'; title: string; text: string }) {
  const icon = {
    side: <><rect x="2" y="7" width="20" height="11" rx="2.5" /><path d="M5 12.5h.01" /></>,
    up: <><rect x="7" y="2" width="11" height="20" rx="2.5" /><path d="M12.5 18.5h.01" /></>,
    desk: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M1 20h22" /></>,
  }[kind];
  return (
    <div className="hitem">
      <span className="hfeat-ico"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{icon}</svg></span>
      <span className="card-title">{title}</span>
      <p className="lead">{text}</p>
    </div>
  );
}
