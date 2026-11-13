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
          <span className="kicker">Up and down</span>
          <span className="sp" />
          <Link className="navl only-wide" href="/help">{t('How to play', 'Как играть')}</Link>
          <Link className="navl only-wide" href="/sign-in">{t('Sign in', 'Войти')}</Link>
          <Langs lang={lang} back="/" className="only-wide" />
          <Link className="pill pill-primary pill-xs" href="/race"><span className="btn-t">{t('Play', 'Играть')}</span></Link>
        </nav>
        <div className="home-hero-in">
          <span className="kicker">{t('A sailing race game by RYC', 'Парусная гонка от RYC')}</span>
          <h1 className="on-photo">Up and down</h1>
          <p className="lead on-photo">{t('Race a yacht round the marks against computer boats, in shifting wind and under the real racing rules. In the browser.', 'Гонка на яхте вокруг знаков против компьютерных лодок, в меняющийся ветер и по настоящим правилам гонок. В браузере.')}</p>
          <p className="facts-line">{t('Free · No install · Phone or computer · EN / RU', 'Бесплатно · Без установки · Телефон или компьютер · EN / RU')}</p>
          <div className="btn-row">
            <a className="pill pill-primary pill-s" href="/play?race=today"><IconPlay /><span className="btn-t"><span className="l-narrow">{t('Play today', 'Гонка дня')}</span><span className="l-wide">{t('Play today’s race', 'Сыграть гонку дня')}</span></span></a>
            <Link className="pill pill-s pill-photo" href="/help"><span className="btn-t">{t('How to play', 'Как играть')}</span></Link>
          </div>
        </div>
      </header>

      <div className="hwrap">
        <section className="hsec">
          <div className="hsec-k"><span className="kicker">{t('Real sailing, made playable', 'Настоящий парусный спорт — в игре')}</span><h2 className="h-land-s">{t('Everything a race has', 'Всё, что есть в гонке')}</h2></div>
          <div className="hgrid hgrid-4">
            <Feat img="h-wind" title={t('Wind that never sits still', 'Ветер не стоит на месте')} text={t('It swings ten degrees and more every minute, with gusts and lulls. Read the shifts on the ring round your boat and tack on the headers.', 'Он меняется на десять градусов и больше каждую минуту, с порывами и затишьями. Читай заходы по кольцу вокруг лодки и поворачивай на них.')} />
            <Feat img="h-start" title={t('A start like a real one', 'Старт как настоящий')} text={t('Class flag, P, one minute, the gun. Over early and the X flag sends you back; under the U or the black flag, you are out.', 'Флаг класса, P, минута, сигнал. Фальстарт — флаг X, возвращайся; под флагом U или чёрным — дисквалификация.')} />
            <Feat img="h-trim" title={t('Sails you trim', 'Паруса, которые надо настраивать')} text={t('Pull the sheet in upwind, ease it off the wind — or let auto-trim do it and just steer. Main and jib on their own sliders, if you want both.', 'Выбирай шкот на лавировке, трави на попутном — или включи автонастройку и просто рули. Грот и стаксель — каждый на своём ползунке, если хочешь.')} />
            <Feat img="h-view-drone" title={t('Rivals who know the rules', 'Соперники знают правила')} text={t('Three, five or seven computer boats that hail, keep clear, take room at the mark — and spin their penalty turns when they get it wrong.', 'Три, пять или семь компьютерных лодок окликают, уступают, берут место у знака — и крутят штрафные обороты, когда ошибаются.')} />
          </div>
        </section>

        <section className="hsec">
          <div className="hsplit">
            <div className="hstack">
              <span className="kicker">{t('Every day', 'Каждый день')}</span>
              <h2 className="h-land-s">{t('Today’s race, the same for everyone', 'Гонка дня — одна для всех')}</h2>
              <p className="lead">{t('One race a day with the same wind, course and fleet for every player, so the times compare fairly. Sign in with Google or your email to put your time on the ranking; your best times follow you to any device.', 'Одна гонка в день: у всех один ветер, дистанция и флот, поэтому время сравнивается честно. Войди через Google или по почте, чтобы попасть в рейтинг; лучшие результаты будут с тобой на любом устройстве.')}</p>
              <a className="pill pill-primary pill-s" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
            </div>
            <div className="band-line fastest">
              <div className="lhead"><span className="meta">{t('Today’s fastest', 'Самые быстрые сегодня')}</span><span className="sp" /><span className="meta">{windName} · {KN[d.preset]} {t('kn', 'уз')} · {d.fleet} {t('boats', 'лодок')}</span></div>
              <ol className="lb">
                {top.map((r, i) => <li key={i}><span className="n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span><span>{clock(r.s)}</span></li>)}
                {!top.length && <li><span className="n">·</span><span className="muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
                <li className="me"><span className="n">·</span><span>{t('You?', 'Ты?')}</span><span /></li>
              </ol>
            </div>
          </div>
        </section>

        <section className="hsec">
          <div className="hstack">
            <span className="kicker">{t('Free race', 'Свободная гонка')}</span>
            <h2 className="h-land-s">{t('Or set up your own', 'Или настрой свою')}</h2>
            <p className="lead">{t('Pick the wind, the fleet, the course, the laps and the start, and race as often as you like. The game keeps your best time for every course.', 'Выбери ветер, флот, дистанцию, круги и старт — и гоняйся сколько хочешь. Игра помнит твой лучший результат на каждой дистанции.')}</p>
            <Link className="pill pill-s" href="/race/free"><span className="btn-t">{t('Set up a free race', 'Настроить гонку')}</span></Link>
          </div>
        </section>

        <section className="hsec">
          <div className="hband">
            <span className="kicker">{t('Ready?', 'Готов?')}</span>
            <h2 className="h-land-s">{t('The start sequence is waiting', 'Стартовая процедура ждёт')}</h2>
            <p className="lead muted">{t('Up and down is made by RYC alongside Sailing Certification Test, the app for IYT exam practice: learn the rules there, race by them here.', 'Up and down делает RYC вместе с Sailing Certification Test — приложением для подготовки к экзаменам IYT: учи правила там, гоняйся по ним здесь.')}</p>
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

function Feat({ img, title, text }: { img: string; title: string; text: string }) {
  return (
    <div className="hitem">
      <Image className="hshot" src={`/images/${img}.jpg`} width={960} height={720} sizes="(min-width: 900px) 280px, 50vw" alt="" />
      <span className="card-title">{title}</span>
      <p className="lead">{text}</p>
    </div>
  );
}
