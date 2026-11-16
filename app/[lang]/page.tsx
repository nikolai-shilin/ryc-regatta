import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta, jsonLd, SITE, NAME, OG_IMAGE, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { ruBoats } from '@/lib/lang';
import { todayTop } from '@/lib/today';
import { dailyRace, raceMinutes, KN } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { VENUES, venueOf } from '@/lib/venues';
import { VenueList } from '@/components/passport';
import { IconArrow, IconPlay, Num, clock } from '@/components/ui';
import { MyRow, HeroScene, Countdown, Ticker, Dock } from '@/components/home-client';
import { CountUp } from '@/components/count-up';
import { Who } from '@/components/flag';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { Soundtrack } from '@/components/soundtrack';
import { FaqList } from '@/components/faq-list';
import { faqGroups, HOME } from '@/lib/faq';
import { DRILLS } from '@/lib/drills';
import { BADGES } from '@/lib/badges';
import { BackStrip, PushButton, CtaTrack, Fold, MatchLink } from '@/components/home-back';
import '@/styles/home-back.css';

// Built per language and rebuilt in the background at most every five minutes, for today's fastest (lib/today.ts
// caches them as long). Just after midnight UTC one visitor can still get yesterday's race while the new one builds.
export const revalidate = 300;

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const { lang, t } = await getT(params);
  return pageMeta(lang, { title: t(...HOME_TITLE), description: t(...HOME_DESC), path: '/', absolute: true, today: true });
}

// For search engines and AI answer engines: who makes the site, and the game itself as a free browser game.
function siteLd(lang: 'en' | 'ru', t: (en: string, ru: string) => string) {
  const org = { '@type': 'Organization', '@id': `${SITE}/#ryc`, name: 'RYC', url: 'https://www.rycrentals.com/', logo: `${SITE}/logo-black.svg`, sameAs: ['https://www.rycrentals.com/', 'https://www.rycsailing.com/'] };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: NAME, inLanguage: ['en', 'ru'], publisher: { '@id': org['@id'] } },
      {
        '@type': 'VideoGame', '@id': `${SITE}/#game`, name: NAME, alternateName: t('Up and down sailing race', 'Up and down — парусная гонка'),
        url: `${SITE}/`, description: t(...HOME_DESC), inLanguage: lang, image: `${SITE}${OG_IMAGE.url}`,
        screenshot: [`${SITE}/images/hud-desk-v7.jpg`, `${SITE}/images/top-v7.jpg`],
        genre: ['Sailing', 'Racing', 'Sports simulation'], gamePlatform: ['Web browser', 'Mobile web browser'],
        applicationCategory: 'GameApplication', operatingSystem: 'Any (runs in a web browser)', playMode: 'SinglePlayer',
        gameLocation: VENUES.map((v) => `${t(...v.name)}, ${t(...v.place)}`), isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${SITE}/race` },
        author: { '@id': org['@id'] }, publisher: { '@id': org['@id'] },
        potentialAction: { '@type': 'PlayAction', target: `${SITE}/race` },
      },
    ],
  };
}

// H0 · Home, as the broadcast lays it out (styles/broadcast.css): the hook (beat today's time, with the game sailing a
// race behind it and today's ranking beside it), three targets, the first four races, how a race goes, a venue a day,
// racing a friend, what's inside, the questions, and the rules; a bar with today's race stays at the foot of the screen.
// Every number is real: today's top five, races and 10th time from lib/today.ts, the countdown to midnight UTC, the venues.
export default async function Home({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const today = await todayTop();
  const d = dailyRace(), where = venueOf(d.venue).name[lang === 'ru' ? 1 : 0], boat = yachtOf(d.yacht), yacht = t(...boat.name);
  const kn = KN[d.preset], mins = raceMinutes({ ...d, timeK: boat.timeK }); // at today's yacht's own pace
  const windName = { light: t('Light', 'Слабый'), medium: t('Medium', 'Средний'), strong: t('Strong', 'Сильный') }[d.preset];
  const live = today && today.d === d.day ? today : null;
  const top = live ? live.top : [];
  const best = top[0], races = live ? live.races : 0;
  const tenth = live?.tenth ?? null, ranked = live?.ranked ?? 0; // the 10th time, when ten are ranked today
  const name = (n: string | null) => n || t('No name', 'Без имени');
  const beat = best ? clock(best.s) : null;
  // the ticker: only what's true of today's race
  const lines = [
    races ? t(`${races} ${races === 1 ? 'race' : 'races'} sailed today`, `Сегодня заездов: ${races}`) : t('Nobody has finished today’s race yet', 'Гонку дня ещё никто не прошёл'),
    best ? t(`${name(best.name)} holds the time to beat · ${beat}`, `Время, которое надо побить, у ${name(best.name)} · ${beat}`) : '',
    best && top[1] ? t(`${name(top[1].name)} is ${(top[1].s - best.s).toFixed(1)} s off the lead`, `${name(top[1].name)} отстаёт от лидера на ${(top[1].s - best.s).toFixed(1).replace('.', ',')} с`) : '',
    t(`${where} · the ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} boats`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} уз · ${ruBoats(d.fleet)}`),
    t('A new yacht every day', 'Каждый день — новая яхта'),
    t('A new race every midnight UTC', 'Новая гонка — каждую полночь по UTC'),
  ].filter(Boolean);

  const features: [string, string][] = [
    [t('Wind that won’t sit still', 'Ветер, который не стоит на месте'), t('Shifts of 10° and more a minute, gusts and lulls. Races are won on them.', 'Заходы на 10° и больше каждую минуту, порывы и затишья. На них и выигрывают.')],
    [t('A start like the real thing', 'Старт как в жизни'), t('Class flag, P, one minute, then the gun. Over early? Go back.', 'Флаг класса, P, минута — и сигнал. Фальстарт? Назад за линию.')],
    [t('Sails in your hands', 'Паруса в твоих руках'), t('Main and jib on their own sheets, or auto-trim while you steer.', 'Грот и стаксель на своих шкотах или автонастройка, а ты только рулишь.')],
    [t('Rivals who know their rights', 'Соперники знают свои права'), t('Up to six computer boats that hail, give way and do their penalty turns.', 'До шести компьютерных лодок: окликают, уступают и крутят штрафные обороты.')],
    [t('Tacks, gybes and the kite', 'Повороты и генакер'), t('Tack on the headers, hoist the gennaker for the run home.', 'Поворачивай на заходах, ставь генакер на попутном к финишу.')],
    [t('A phone or a keyboard', 'Телефон или клавиатура'), t('Steer with your thumb, upright or sideways, or with the arrow keys.', 'Рули пальцем, вертикально или горизонтально, или стрелками.')],
  ];
  const way: [string, string, string][] = [
    [t('Or set up your own', 'Или настрой свою'), t('The place, the wind, the fleet, the course’s shape and length, laps, the start’s length and the current. The game keeps your best on every course.', 'Место, ветер, флот, форма и длина дистанции, круги, длина старта и течение. Игра помнит твоё лучшее время на каждой дистанции.'), '/race/free'],
    [t('A debrief, not just a place', 'Разбор, а не только место'), t('Every finish opens its own page: the results, your track with any foul marked, leg by leg, what to work on, and the rule behind each foul.', 'Каждый финиш открывает свою страницу: результаты, твой трек с отмеченными нарушениями, отрезок за отрезком, над чем поработать и правило за каждым нарушением.'), '/help#h-today'],
    [t('Hold it any way you like', 'Держи как удобно'), t('Phone sideways, phone upright or a computer: the race screen lays itself out for each, and follows the phone if you turn it mid-race.', 'Телефон горизонтально, вертикально или компьютер: экран гонки подстраивается под каждый и поворачивается вместе с телефоном прямо в гонке.'), '/help#h-screen'],
    [t('Three views', 'Три вида'), t('The drone behind the boat, straight down from above, or from the helm. Switch any time; on a keyboard, X, C and V.', 'Дрон за лодкой, прямо сверху или со штурвала. Переключай в любой момент; на клавиатуре — X, C и V.'), '/help#h-views'],
  ];
  // the hero's still under the game: the wide picture on a wide screen, the upright one on a phone — one <picture>, so
  // a browser fetches only the one it shows
  const hero = { alt: '', fill: true, sizes: '100vw', fetchPriority: 'high', loading: 'eager' } as const;
  const heroWide = getImageProps({ ...hero, src: '/images/drone-desk-v7.jpg' }).props.srcSet;
  const { alt: _alt, ...heroNarrow } = getImageProps({ ...hero, src: '/images/drone-port-v7.jpg' }).props;
  const all = faqGroups(t).flatMap((g) => g.items);
  const faq = HOME.map((id) => all.find((f) => f.id === id)!);
  const go = '/play?race=today';

  return (
    <div className="scr help home bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteLd(lang, t))} />
      <SiteHead lang={lang} t={t} page="home" />

      {/* 1 · the hook: one challenge, one button, and today's ranking beside it */}
      <section className="ho-hero" aria-labelledby="home-h1">
        <picture>
          <source media="(min-width: 600px)" srcSet={heroWide} sizes="100vw" />
          <img className="ho-bg" {...heroNarrow} alt="" />
        </picture>
        <HeroScene title={t('A race in the game', 'Гонка в игре')} />
        <Soundtrack lang={lang} />
        <div className="ho-in">
          <div className="ho-info">
            <span className="ho-kick"><span className="dot-live" />{t(`Live · today’s race · ${where} · ${yacht}`, `Эфир · гонка дня · ${where} · ${yacht}`)}</span>
            <h1 className="ho-h1" id="home-h1">{beat ? t(`Beat ${beat} today`, `Побей ${beat} сегодня`) : t('Set today’s time to beat', 'Задай время дня')}</h1>
            <BackStrip lang={lang} day={d.day} top={top} cap={live?.n} />
            <p className="ho-lead ho-new">{t(
              `A free sailing race game in your browser, under the real racing rules. One race for everyone today, so your time sits right next to theirs. About ${mins} minutes, no sign-up to start.`,
              `Бесплатная парусная гонка в браузере, по настоящим правилам. Сегодня у всех одна гонка, так что твоё время встанет рядом с остальными. Около ${mins} минут, без регистрации.`)}</p>
            <div className="ho-acts ho-hero-acts">
              <a className="ho-go ho-go-xl" href={go} data-cta="hero"><IconPlay s={22} /><span>{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
              <Link className="ho-ghost ho-go-xl ho-new" href="/race/free" data-cta="hero-practise">{t('Practise first', 'Сначала потренироваться')}</Link>
            </div>
            <Link className="ho-how ho-new" href="/help" data-cta="hero-how">{t('New to it? How to play, in 3 minutes', 'Впервые? Как играть — за 3 минуты')} ›</Link>
            <ul className="ho-trust ho-new">
              <li>{t('Free', 'Бесплатно')}</li><li>{t('No install', 'Без установки')}</li><li>{t('No sign-up to play', 'Без регистрации')}</li><li>{t('Phone or keyboard', 'Телефон или клавиатура')}</li><li>English · Русский</li>
            </ul>
          </div>
          <aside className="ho-card ho-rank" aria-label={t('Today’s ranking', 'Рейтинг дня')}>
            <div className="ho-card-h"><span className="lbl-ink">{t('Today’s ranking', 'Рейтинг дня')}</span><span className="lbl">{races ? t(`${races} ${races === 1 ? 'race' : 'races'}`, `заездов: ${races}`) : windName + ` · ${kn} ${t('kn', 'уз')}`}</span></div>
            <div className="ho-cd"><span className="lbl">{t('This race closes, a new one starts in', 'Эта гонка закроется, новая начнётся через')}</span><Countdown /></div>
            <ol className="hm-lb bt-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><Who fl={r.fl} name={name(r.name)} lang={lang} />
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} top={top} cap={live?.n} />
            </ol>
            <Link className="lb-more" href="/race/rating" data-cta="rank-more">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц')}</Link>
            <div className="ho-tick" aria-live="polite"><span className="dot-live" /><Ticker lines={lines} /></div>
          </aside>
        </div>
      </section>

      <main className="ho-main">
        {/* 2 · three targets: something to aim for at every level */}
        <section className="ho-sec" aria-labelledby="h-goals">
          <div className="ho-sec-h">
            <div className="ho-sec-t"><span className="ho-k">{t('Today’s targets', 'Цели дня')}</span><h2 className="ho-h2" id="h-goals">{t('Pick one. Then go for the next.', 'Выбери одну. Потом — следующую.')}</h2></div>
            <span className="lbl">{t('Reset at midnight UTC with the race', 'Обновляются в полночь по UTC вместе с гонкой')}</span>
          </div>
          <div className="ho-goals">
            <a className="ho-goal" href={go} data-cta="goal-finish">
              <span className="ho-medal">✓</span>
              <span className="lbl is-you">{t('Everyone', 'Для всех')}</span>
              <h3 className="ho-h3">{t('Finish the race', 'Пройди гонку')}</h3>
              <p className="ho-ps">{t('Cross the line once. The game calls the start, the marks and when to tack as you go.', 'Пересеки финиш один раз. Игра подскажет старт, знаки и когда поворачивать.')}</p>
              <span className="lbl-ink ho-foot">{t(`About ${mins} minutes ›`, `Около ${mins} минут ›`)}</span>
            </a>
            {/* with ten ranked today the club racer's target is the top ten, under the 10th time; else the podium */}
            {tenth != null ? (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">10</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик')}</span>
                <h3 className="ho-h3">{t(`Top ten under ${clock(tenth)}`, `В десятку быстрее ${clock(tenth)}`)}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.')}</p>
                <span className="lbl-ink ho-foot">{t(`Today: ${clock(tenth)} is 10th of ${ranked} ›`, `Сегодня: ${clock(tenth)} — 10-е место из ${ranked} ›`)}</span>
              </a>
            ) : (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">3</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик')}</span>
                <h3 className="ho-h3">{t('Make the podium', 'Попади в тройку')}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.')}</p>
                <span className="lbl-ink ho-foot">{top[2] ? t(`Today: ${clock(top[2].s)} is 3rd ›`, `Сегодня: ${clock(top[2].s)} — третье место ›`) : t('The podium is still open ›', 'В тройке ещё есть места ›')}</span>
              </a>
            )}
            <a className="ho-goal" href={go} data-cta="goal-win">
              <span className="ho-medal ho-medal-g">1</span>
              <span className="lbl is-you">{t('The time to beat', 'Время, которое надо побить')}</span>
              <h3 className="ho-h3">{beat ? t(`Beat ${beat}`, `Побей ${beat}`) : t('Set the time to beat', 'Задай время дня')}</h3>
              <p className="ho-ps">{best ? t(`${name(best.name)} holds it. A clean start and two good shifts get you close.`, `Оно у ${name(best.name)}. Чистый старт и два пойманных захода — и ты рядом.`) : t('Nobody has finished today’s race yet: the first time home is the one to beat.', 'Гонку дня ещё никто не прошёл: первое время и станет тем, что будут бить.')}</p>
              <span className="lbl-ink ho-foot">{t('Take the top spot ›', 'Займи первое место ›')}</span>
            </a>
          </div>
        </section>

        {/* 3 · the first four races, each in its picture: a path, so a first race isn't the last (and what a race is) */}
        <section className="ho-sec ho-new" aria-labelledby="h-path">
          <div className="ho-sec-t"><span className="ho-k">{t('New to racing?', 'Впервые на гонке?')}</span><h2 className="ho-h2" id="h-path">{t('Your first four races', 'Твои первые четыре гонки')}</h2></div>
          <ol className="ho-path">
            <li className="now"><span className="ho-pic ho-path-pic"><Image src="/images/h-steer-v7.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">1</span><span className="lbl is-you">{t(`Today · ${mins} min`, `Сегодня · ${mins} мин`)}</span><h3 className="ho-h3">{t('Just finish', 'Просто финишируй')}</h3><p className="ho-ps">{t('Sails on Auto, you only steer. Follow the call above your numbers.', 'Паруса на «Авто», ты только рулишь. Следуй подсказке над своими цифрами.')}</p></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-start-v7.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">2</span><span className="lbl">{t('Then', 'Потом')}</span><h3 className="ho-h3">{t('Win the start', 'Выиграй старт')}</h3><p className="ho-ps">{t('Be a boat length behind the line, at full speed, as the gun goes.', 'Будь в корпусе от линии на полном ходу в момент сигнала.')}</p><a className="ho-drill" href="/play?race=free&drill=start" data-cta="path-drill-start">{t('Practise it: the start drill ›', 'Потренируй: упражнение «Старт» ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-tack-v7.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">3</span><span className="lbl">{t('Then', 'Потом')}</span><h3 className="ho-h3">{t('Play the shifts', 'Лови заходы')}</h3><p className="ho-ps">{t('Tack when the wind heads you. Every header you catch is a place.', 'Поворачивай, когда ветер заходит. Каждый пойманный заход — место.')}</p><a className="ho-drill" href="/play?race=free&drill=beat" data-cta="path-drill-beat">{t('Practise it: the shifts drill ›', 'Потренируй: упражнение «Сдвиги ветра» ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-trim-v7.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">4</span><span className="lbl">{t('Then', 'Потом')}</span><h3 className="ho-h3">{t('Race the ranking', 'Гоняйся за рейтингом')}</h3><p className="ho-ps">{t('Trim the sails yourself and go for today’s podium.', 'Настраивай паруса сам и иди в тройку дня.')}</p></li>
          </ol>
          <div className="ho-acts">
            <a className="ho-go" href={go} data-cta="path-start"><IconPlay /><span>{t('Start race 1', 'Начать гонку 1')}</span></a>
            <Link className="ho-ghost" href="/help" data-cta="path-how">{t('How to play, in 3 minutes', 'Как играть — за 3 минуты')}</Link>
          </div>
        </section>

        {/* 5 · a reason to come back tomorrow */}
        <section className="ho-sec" aria-labelledby="h-venues">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k">{t('Come back tomorrow', 'Возвращайся завтра')}</span>
              <h2 className="ho-h2" id="h-venues">{t(`${VENUES.length} venues, one a day`, `${VENUES.length} акватории, по одной в день`)}</h2>
              <p className="ho-ps">{t(`Each day the race moves to another famous regatta venue, with its own hills, town and wind. Each comes round once every ${VENUES.length} days. Tomorrow’s is revealed at midnight UTC.`, `Каждый день гонка переезжает на другую знаменитую регатную акваторию — со своими холмами, городом и ветром. Каждая возвращается раз в ${VENUES.length} дня. Завтрашняя откроется в полночь по UTC.`)}</p>
              <PushButton lang={lang} where="venues" />
            </div>
            {/* the venues you've raced are stamped, and your streak over them: this device's, drawn in the browser */}
            <VenueList lang={lang} today={d.venue} />
          </div>
        </section>

        {/* 6 · bring a friend */}
        <section className="ho-sec ho-split" aria-labelledby="h-friend">
          <div className="ho-split-t">
            <span className="ho-k">{t('Race a friend', 'Гоняйся с другом')}</span>
            <h2 className="ho-h2" id="h-friend">{t('Same wind. Same course. Who’s faster?', 'Тот же ветер. Та же дистанция. Кто быстрее?')}</h2>
            <p className="ho-ps">{t('Everyone sails the same race today, so a result link is a challenge. Send yours after the finish; it opens on any device.', 'Сегодня у всех одна гонка, так что ссылка на результат — это вызов. Отправь свою после финиша: она откроется на любом устройстве.')}</p>
            <div className="ho-acts"><a className="ho-go" href={go} data-cta="friend">{t('Set a time to send', 'Поставь время, чтобы отправить')}</a><MatchLink lang={lang} /></div>
          </div>
          <figure className="ho-card ho-friend">
            <span className="ho-pic"><Image src="/images/top-v7.jpg" alt={t('Yachts racing in the game, seen from above', 'Яхты на гонке в игре, вид сверху')} fill sizes="(min-width: 900px) 560px, 100vw" /></span>
            <span className="ho-friend-t"><span className="ho-kick">{t(`Today’s race · ${where}`, `Гонка дня · ${where}`)}</span><b>{t('Can you beat me?', 'Сможешь быстрее?')}</b></span>
            <figcaption><span className="ho-ps">“{t('I finished today’s race. Can you beat my time?', 'Я прошёл гонку дня. Сможешь быстрее?')}”</span><span className="lbl">{t('The link opens on any device', 'Ссылка откроется где угодно')}</span></figcaption>
          </figure>
        </section>

        {/* 6½ · between races: the drills and the badges */}
        <section className="ho-sec" aria-labelledby="h-more">
          <div className="ho-sec-t"><span className="ho-k">{t('Between races', 'Между гонками')}</span><h2 className="ho-h2" id="h-more">{t('Practise the moments. Collect the badges.', 'Тренируй моменты. Собирай значки.')}</h2></div>
          <div className="ho-feats ho-feats-2">
            <Link className="ho-feat ho-feat-a" href="/race/drills" data-cta="drills"><i aria-hidden="true" /><div><h3 className="ho-h3">{t(`${DRILLS.length} drills`, `Упражнений: ${DRILLS.length}`)}</h3><p className="ho-ps">{t('The start, the top mark, the shifts, a comeback: each a minute or two, three stars to win, from beginner to expert.', 'Старт, верхний знак, сдвиги ветра, отыгрыш: каждое на минуту-две, три звезды, от новичка до эксперта.')}</p></div></Link>
            <Link className="ho-feat ho-feat-a" href="/race/badges" data-cta="badges"><i aria-hidden="true" /><div><h3 className="ho-h3">{t(`${BADGES.length} badges`, `Значков: ${BADGES.length}`)}</h3><p className="ho-ps">{t('A clean race, a win from behind, a week on the water, every venue raced. Each says how near you are.', 'Чистая гонка, победа с отыгрышем, неделя на воде, все акватории. Каждый показывает, сколько осталось.')}</p></div></Link>
          </div>
        </section>

        <Fold lang={lang}>
        {/* 7 · why it is worth it */}
        <section className="ho-sec" aria-labelledby="h-parts">
          <div className="ho-sec-t"><span className="ho-k">{t('Inside the game', 'Внутри игры')}</span><h2 className="ho-h2" id="h-parts">{t('Everything a real race throws at you', 'Всё, чем встречает настоящая гонка')}</h2></div>
          <div className="ho-feats">
            {features.map(([title, text]) => <div className="ho-feat" key={title}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></div>)}
          </div>
          <dl className="bt-stats ho-nums">
            <div><dt className="bt-sk">{t('Wind', 'Ветер')}</dt><dd><b><Num v={`${KN.light}–${KN.strong} ${t('kn', 'уз')}`} /></b></dd><dd className="bt-sv">{t('From light air to a breeze you reef for', 'От лёгкого ветра до такого, что берут рифы')}</dd></div>
            <div><dt className="bt-sk">{t('Fleet', 'Флот')}</dt><dd><b><CountUp v="3 · 5 · 7" /></b></dd><dd className="bt-sv">{t('Boats on the line, every one sailing by the rules', 'Лодок на линии, и все ходят по правилам')}</dd></div>
            <div><dt className="bt-sk">{t('Shifts', 'Заходы')}</dt><dd><b><CountUp v="10°+" /></b></dd><dd className="bt-sv">{t('Every minute. Catch them or lose places', 'Каждую минуту. Лови их или теряй места')}</dd></div>
            <div><dt className="bt-sk">{t('Race of the day', 'Гонка дня')}</dt><dd><b>1</b></dd><dd className="bt-sv">{t('One for everyone, a new one every midnight', 'Одна на всех, новая каждую полночь')}</dd></div>
          </dl>
        </section>

        {/* your race, your way: the set-up, the debrief, the screens and the views */}
        <section className="ho-sec" aria-labelledby="h-way">
          <div className="ho-sec-t"><span className="ho-k">{t('Your race, your way', 'Твоя гонка — по-твоему')}</span><h2 className="ho-h2" id="h-way">{t('Set it up, sail it, read it back', 'Настрой, пройди, разбери')}</h2></div>
          <div className="ho-feats ho-feats-4">
            {way.map(([title, text, href]) => <Link className="ho-feat ho-feat-a" href={href} key={title} data-cta={`way-${href}`}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></Link>)}
          </div>
        </section>

        {/* 8 · the doubts, answered where they come up */}
        <section className="ho-sec ho-split" id="faq" aria-labelledby="h-faq">
          <div className="ho-split-t ho-faq-side">
            <span className="ho-k">{t('Before you sail', 'Перед стартом')}</span>
            <h2 className="ho-h2" id="h-faq">{t('In short', 'Коротко')}</h2>
            <p className="ho-ps">{t(`The questions people ask before their first race. ${all.length - faq.length} more are on the Questions page.`, `Вопросы, которые задают перед первой гонкой. Ещё ${all.length - faq.length} — на странице «Вопросы».`)}</p>
            <Link className="ho-ghost" href="/faq" data-cta="faq">{t('All questions', 'Все вопросы')}<IconArrow s={16} /></Link>
          </div>
          <div className="ho-faq"><FaqList items={faq} openFirst /></div>
        </section>

        {/* 9 · the rules, and where to learn them */}
        <section className="ho-sec" aria-labelledby="h-rules">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k">Sailing Certification Test</span>
              <h2 className="ho-h2" id="h-rules">{t('Learn the rules there, race by them here', 'Учи правила там, гоняйся по ним здесь')}</h2>
              <p className="ho-ps">{t('Up and down comes from RYC, the team behind Sailing Certification Test, the free trainer for sailing certificate exams. The computer boats give way by the same rules the exam asks about, so every race is revision you can feel on the water.', 'Up and down делает RYC — команда, которая сделала Sailing Certification Test, бесплатный тренажёр к экзаменам на яхтенные сертификаты. Компьютерные лодки уступают по тем же правилам, что спрашивают на экзамене, так что каждая гонка — повторение, которое чувствуешь на воде.')}</p>
              <Link className="ho-ghost" href="/iyt" data-cta="iyt">{t('Exam practice · 6100 questions', 'Подготовка к экзамену · 6100 вопросов')}<IconArrow s={16} /></Link>
            </div>
            <div className="ho-rules">
              <span className="lbl">{t('Rules you meet on the first beat', 'Правила, которые встретишь на первой лавировке')}</span>
              <ol className="hm-lb bt-lb ho-card">
                <li><span className="hm-n">10</span><span>{t('Port gives way to starboard', 'Левый галс уступает правому')}</span></li>
                <li><span className="hm-n">11</span><span>{t('Windward boat keeps clear', 'Наветренная уступает')}</span></li>
                <li><span className="hm-n">13</span><span>{t('A tacking boat keeps clear', 'Поворачивающая уступает')}</span></li>
              </ol>
            </div>
          </div>
        </section>
        </Fold>
      </main>
      <CtaTrack />

      <SiteFoot lang={lang} t={t} back="/" />

      {/* the button that never goes away, once the hero's own have scrolled by */}
      <Dock watch=".ho-hero-acts">
        <div className="ho-dock-t"><span className="dot-live" /><b>{beat ? <><span className="ho-dock-w">{t(`Today’s race · ${where} · `, `Гонка дня · ${where} · `)}</span>{t(`beat ${beat}`, `побей ${beat}`)}</> : t(`Today’s race · ${where}`, `Гонка дня · ${where}`)}</b><span className="lbl">{t('closes in', 'закроется через')}</span><Countdown className="ho-dock-cd" /></div>
        <a className="ho-go" href={go} data-cta="dock"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня')}</span></a>
      </Dock>
    </div>
  );
}
