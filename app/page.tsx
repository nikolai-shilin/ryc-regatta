import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { todayTop } from '@/lib/today';
import { dailyRace, KN } from '@/lib/race';
import { Logo, IconArrow, IconPlay, IconWind, IconSail, clock } from '@/components/ui';
import { RacePill, TileRow, MyRow } from '@/components/home-client';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

// H0 · Home, laid out like rycrentals.com's: a header with the site's pages, a hero with today's race in a pill over
// the game itself sailing a race (public/hero-view), then sections that alternate white and the pale band.
export default async function Home() {
  const { lang, t } = await getT();
  const [account, today] = await Promise.all([getAccount(), todayTop()]);
  const d = dailyRace();
  const kn = KN[d.preset];
  const windName = { light: t('Light', 'Слабый'), medium: t('Medium', 'Средний'), strong: t('Strong', 'Сильный') }[d.preset];
  const breeze = { light: t('a light breeze', 'слабый ветер'), medium: t('a medium breeze', 'средний ветер'), strong: t('a strong breeze', 'сильный ветер') }[d.preset];
  const length = { short: t('short', 'короткий'), medium: t('medium', 'средний'), long: t('long', 'длинный') }[d.length];
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const live = today && today.d === d.day ? today : null;
  const top = live ? live.top : [];
  const best = top[0];

  const tiles: [string, string, string, string][] = [
    ['h-wind', '/help', t('Wind that shifts', 'Ветер меняется'), t('10° and more a minute, with gusts and lulls', '10° и больше в минуту, с порывами и затишьями')],
    ['h-start', '/help', t('A real start', 'Настоящий старт'), t('Class flag, P, one minute, then the gun', 'Флаг класса, P, минута — и сигнал')],
    ['h-trim', '/help', t('Sails you trim', 'Паруса настраиваешь сам'), t('Main and jib, or auto-trim', 'Грот и стаксель или автонастройка')],
    ['h-view-drone', '/help', t('Rivals who know the rules', 'Соперники знают правила'), t('3, 5 or 7 boats, penalty turns too', '3, 5 или 7 лодок, и штрафные обороты')],
    ['h-tack', '/help', t('Tacks and gybes', 'Повороты'), t('Tack on the headers, gybe the kite', 'Поворачивай на заходах, перекидывай генакер')],
    ['h-steer', '/help', t('Touch or keys', 'Пальцем или клавишами'), t('A phone either way, or a keyboard', 'Телефон в любой ориентации или клавиатура')],
    ['h-view-helm', '/help', t('From the helm', 'С руля'), t('Sail it from the cockpit', 'Веди яхту из кокпита')],
    ['h-view-top', '/help', t('From above', 'Сверху'), t('The whole course and the lay lines', 'Вся дистанция и лейлайны')],
  ];
  const faq: [string, string][] = [
    [t('Is it free?', 'Это бесплатно?'), t('Yes. The game runs in the browser on a phone or a computer, with nothing to install and nothing to pay.', 'Да. Игра работает в браузере на телефоне или компьютере: ничего не нужно устанавливать и ни за что платить.')],
    [t('Do I have to sign in?', 'Нужно ли входить?'), t('No. Sign in with Google or your email only to put your time on today’s ranking and keep your best times on every device.', 'Нет. Войди через Google или по почте, только чтобы попасть в рейтинг дня и видеть лучшие результаты на любом устройстве.')],
    [t('How is today’s race chosen?', 'Как выбирается гонка дня?'), t('A new race starts at midnight. Its wind, course and fleet are the same for every player, so the times compare fairly.', 'Новая гонка начинается в полночь. Ветер, дистанция и флот у всех одинаковые, поэтому время сравнивается честно.')],
    [t('What is a free race?', 'Что такое свободная гонка?'), t('You pick the wind, fleet, course, laps and start yourself and race as often as you like. The game keeps your best time on every course; free race times don’t go on today’s ranking.', 'Ты сам выбираешь ветер, флот, дистанцию, круги и старт и гоняешься сколько хочешь. Игра помнит лучший результат на каждой дистанции; время свободных гонок не попадает в рейтинг дня.')],
    [t('Which rules do the boats sail by?', 'По каким правилам ходят лодки?'), t('Part 2 of the Racing Rules of Sailing: port gives way to starboard, windward keeps clear, room at the mark. Break one and you spin a penalty turn, the computer boats too.', 'По части 2 Правил парусных гонок: левый галс уступает правому, наветренная лодка уступает, место у знака. Нарушил — крути штрафной оборот; компьютерные лодки тоже.')],
    [t('Does it work on a phone?', 'Работает ли на телефоне?'), t('Yes, held sideways or upright. Steer by touch on a phone and with the arrow keys on a computer.', 'Да, в любой ориентации. На телефоне рули пальцем, на компьютере — стрелками.')],
  ];

  return (
    <div className="scr help home" lang={lang}>
      <SiteHead lang={lang} t={t} account={account} page="home" />

      <div className="hm-hero">
        <Image className="bgimg only-wide" src="/images/drone-desk.jpg" alt="" fill priority sizes="100vw" />
        <Image className="bgimg only-narrow" src="/images/drone-port.jpg" alt="" fill priority sizes="100vw" />
        <iframe className="hm-scene" src="/hero-view" title={t('A race in the game', 'Гонка в игре')} aria-hidden="true" tabIndex={-1} />
        <section className="hm-page hm-hero-in" aria-labelledby="home-h1">
          <span className="kicker">{t('Up and down · a sailing race game by RYC', 'Up and down · парусная гонка от RYC')}</span>
          <h1 className="hm-display" id="home-h1">{t('Sailing race game: up to seven rivals, shifting wind and the real racing rules', 'Парусная гонка: до семи соперников, переменчивый ветер и настоящие правила')}</h1>
          <p className="hm-lead">{t(
            `Today’s race, ${date}, is ${breeze} of ${kn} knots, ${d.fleet} boats and one ${length} lap up and down. Everyone sails the same race, so times compare fairly. No sign-in needed to play.`,
            `Гонка дня, ${date}: ${breeze} ${kn} узлов, ${d.fleet} лодок и один ${length} круг апвинд — даунвинд. У всех одна и та же гонка, поэтому время сравнивается честно. Играть можно без входа.`)}</p>
          <span className="meta hm-asof">{t(`Today’s race for ${date} · a new one at midnight`, `Гонка дня на ${date} · новая в полночь`)}</span>
          <RacePill lang={lang} daily={d} />
          <Link className="hm-src" href="/help">{t('How a race goes', 'Как проходит гонка')}<IconArrow s={14} /></Link>
        </section>
      </div>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="h-parts">
          <TileRow lang={lang} head={
            <div className="hm-sec-t"><span className="kicker">{t('In the game · 8 parts', 'В игре · 8 частей')}</span><h2 className="hm-h2" id="h-parts">{t('Everything a real race has', 'Всё, что есть в настоящей гонке')}</h2></div>
          }>
            {tiles.map(([img, href, title, meta]) => (
              <Link className="hm-tile" href={href} key={img}>
                <span className="hm-photo hm-sq"><Image src={`/images/${img}.jpg`} alt="" fill sizes="180px" /></span>
                <span className="card-title">{title}</span>
                <span className="hm-meta">{meta}</span>
              </Link>
            ))}
          </TileRow>
        </section>
      </div>

      <section className="hm-page hm-sec" aria-labelledby="h-today">
        <div className="hm-sec-h">
          <div className="hm-sec-t">
            <span className="kicker">{t('Today’s race · the same for everyone', 'Гонка дня · одна для всех')}</span>
            <h2 className="hm-h2" id="h-today">{best
              ? t(`${live!.races} races today · best time ${clock(best.s)}`, `Гонок сегодня: ${live!.races} · лучшее время ${clock(best.s)}`)
              : t('Be the first on today’s ranking', 'Стань первым в рейтинге дня')}</h2>
          </div>
          <Link className="hm-src" href="/race">{t('Race hub', 'Меню гонок')}<IconArrow s={14} /></Link>
        </div>
        <div className="hm-today">
          <a className="hm-course" href="/play?race=today">
            <span className="hm-photo hm-wide">
              <span className="hm-clip"><Image src="/images/top.jpg" alt={t('Today’s course from above', 'Дистанция дня сверху')} fill sizes="(min-width: 900px) 640px, 100vw" /></span>
              <span className="hm-ptag"><span className="hm-ptag-a">{kn} {t('kn', 'уз')}</span><span className="hm-ptag-b"><span>{t('Today', 'Сегодня')}</span><b>{t(`${d.laps} lap`, `${d.laps} круг`)}</b><span>{t(`${d.fleet} boats`, `${d.fleet} лодок`)}</span></span></span>
            </span>
            <span className="card-title">{t(`Up and down · ${length} course · ${d.laps} lap`, `Апвинд — даунвинд · ${length} · ${d.laps} круг`)}</span>
            <span className="hm-facts">
              <span><IconWind s={15} />{windName}, {kn} {t('kn', 'уз')}</span>
              <span><IconSail s={15} />{t(`${d.fleet} boats`, `${d.fleet} лодок`)}</span>
              <span>{t(`${d.start}-minute start`, `старт ${d.start} мин`)}</span>
              {d.current ? <span>{t('A current', 'Течение')}</span> : null}
            </span>
          </a>
          <div className="hm-board">
            <div className="hm-board-h"><span className="meta ink">{t('Today’s fastest', 'Самые быстрые сегодня')}</span><span className="meta">{windName} · {kn} {t('kn', 'уз')} · {d.fleet} {t('boats', 'лодок')}</span></div>
            <ol className="hm-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span>
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} signedIn={!!account} />
            </ol>
            <a className="pill pill-primary hm-cta" href="/play?race=today"><IconPlay /><span className="btn-t">{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
          </div>
        </div>
      </section>

      <section className="hm-page hm-sec" aria-labelledby="h-how">
        <div className="hm-sec-h">
          <div className="hm-sec-t"><span className="kicker">{t('How a race goes', 'Как проходит гонка')}</span><h2 className="hm-h2" id="h-how">{t('A minute to the gun, then up and down', 'Минута до старта — и вверх-вниз')}</h2></div>
          <Link className="hm-src" href="/help">{t('How to play in detail', 'Подробно о игре')}<IconArrow s={14} /></Link>
        </div>
        <ol className="hm-steps">
          <li><span className="hm-num">1</span><span className="hm-step-t"><span className="hm-h3">{t('Pick a race', 'Выбери гонку')}</span><span className="hm-text">{t('Today’s race is the same for everyone. A free race takes your wind, fleet and course. Both start in one tap.', 'Гонка дня одна для всех. В свободной — твой ветер, флот и дистанция. Обе начинаются в одно касание.')}</span></span></li>
          <li><span className="hm-num">2</span><span className="hm-step-t"><span className="hm-h3">{t('Get the start right', 'Возьми старт')}</span><span className="hm-text">{t('Hold below the line until the gun. Over early and the X flag sends you back to start again.', 'Держись под линией до сигнала. Фальстарт — флаг X, возвращайся и стартуй заново.')}</span></span></li>
          <li><span className="hm-num">3</span><span className="hm-step-t"><span className="hm-h3">{t('Round the marks', 'Обойди знаки')}</span><span className="hm-text">{t('Beat up to the windward mark, run back through the gate and finish. Your time goes on today’s ranking.', 'Лавируй к верхнему знаку, спускайся через ворота и финишируй. Время попадёт в рейтинг дня.')}</span></span></li>
        </ol>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="h-num">
          <div className="hm-sec-t"><span className="kicker">{t('RYC race office', 'Гоночный комитет RYC')}</span><h2 className="hm-h2" id="h-num">{t('The game in numbers', 'Игра в цифрах')}</h2></div>
          <dl className="hm-stats">
            <div><dt className="meta">{t('Wind', 'Ветер')}</dt><dd className="hm-stat-v">{KN.light}–{KN.strong} {t('kn', 'уз')}</dd><dd className="hm-meta">{t('Light, medium or strong breeze', 'Слабый, средний или сильный')}</dd></div>
            <div><dt className="meta">{t('Rivals', 'Соперники')}</dt><dd className="hm-stat-v">3 · 5 · 7</dd><dd className="hm-meta">{t('Computer boats that sail by the rules', 'Компьютерные лодки, которые ходят по правилам')}</dd></div>
            <div><dt className="meta">{t('Shifts', 'Заходы')}</dt><dd className="hm-stat-v">10°+</dd><dd className="hm-meta">{t('Every minute, with gusts and lulls', 'Каждую минуту, с порывами и затишьями')}</dd></div>
            <div><dt className="meta">{t('Race of the day', 'Гонка дня')}</dt><dd className="hm-stat-v">1</dd><dd className="hm-meta">{t('A new one at midnight, the same for all', 'Новая в полночь, одна для всех')}</dd></div>
          </dl>
          <p className="hm-cite">{t('Free · no install · phone or computer · English and Russian.', 'Бесплатно · без установки · телефон или компьютер · английский и русский.')}<a className="hm-src" href="#faq">{t('Questions', 'Вопросы')}<IconArrow s={14} /></a></p>
        </section>
      </div>

      <section className="hm-page hm-sec" id="faq" aria-labelledby="h-faq">
        <div className="hm-faq">
          <div className="hm-faq-side">
            <span className="kicker">{t('Questions', 'Вопросы')}</span>
            <h2 className="hm-h2" id="h-faq">{t('In short', 'Коротко')}</h2>
            <p className="hm-text">{t('The game, today’s race and the ranking in a few lines. The full guide is on the How to play page.', 'Об игре, гонке дня и рейтинге в нескольких строках. Полное руководство — на странице «Как играть».')}</p>
            <Link className="hm-src" href="/help">{t('How to play', 'Как играть')}<IconArrow s={14} /></Link>
          </div>
          <div className="hm-faq-list">
            {faq.map(([q, a], i) => (
              <details className="hm-faq-item" key={i} open={i === 0}>
                <summary>{q}<svg className="hm-faq-ico" viewBox="0 0 20 20" width={18} height={18} aria-hidden="true"><path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg></summary>
                <p className="hm-text">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec hm-help" aria-labelledby="h-rules">
          <div className="hm-help-main">
            <span className="kicker">Sailing Certification Test</span>
            <h2 className="hm-h2" id="h-rules">{t('Learn the rules there, race by them here', 'Учи правила там, гоняйся по ним здесь')}</h2>
            <p className="hm-text">{t('Up and down is made by RYC alongside Sailing Certification Test, the app for IYT exam practice. The rules the computer boats follow are the ones on the exam.', 'Up and down делает RYC вместе с Sailing Certification Test — приложением для подготовки к экзаменам IYT. Компьютерные лодки ходят по тем же правилам, что спрашивают на экзамене.')}</p>
            <a className="hm-app" href="https://iyt.rycrentals.com/">
              <span className="hm-app-ic"><Logo /></span>
              <span className="hm-app-t"><span className="hm-app-n">Sailing Certification Test</span><span className="meta">{t('IYT exam practice · 6100 questions', 'Подготовка к IYT · 6100 вопросов')}</span></span>
              <span className="hm-app-go" aria-hidden="true"><IconArrow s={20} /></span>
            </a>
          </div>
          <div className="hm-help-side">
            <span className="meta">{t('Rules you meet on the first beat', 'Правила, которые встретишь на первой лавировке')}</span>
            <ol className="hm-tips">
              <li><span className="hm-num">1</span><span>{t('Port gives way to starboard', 'Левый галс уступает правому')}</span><span className="meta">{t('Rule 10', 'Правило 10')}</span></li>
              <li><span className="hm-num">2</span><span>{t('Windward boat keeps clear', 'Наветренная уступает')}</span><span className="meta">{t('Rule 11', 'Правило 11')}</span></li>
              <li><span className="hm-num">3</span><span>{t('Room at the mark', 'Место у знака')}</span><span className="meta">{t('Rule 18', 'Правило 18')}</span></li>
            </ol>
          </div>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} account={account} back="/" />
    </div>
  );
}
