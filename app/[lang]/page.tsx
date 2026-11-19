import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta, jsonLd, SITE, NAME, OG_IMAGE, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { pick, ruBoats, ruPlural } from '@/lib/lang';
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
import { CHANNELS } from '@/lib/social';
import { DRILLS } from '@/lib/drills';
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
function siteLd(lang: 'en' | 'ru' | 'es', t: (en: string, ru: string, es?: string) => string) {
  const org = { '@type': 'Organization', '@id': `${SITE}/#ryc`, name: 'RYC', url: 'https://www.rycrentals.com/', logo: `${SITE}/logo-black.svg`, sameAs: ['https://www.rycrentals.com/', 'https://www.rycsailing.com/'] };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: NAME, inLanguage: ['en', 'ru'], publisher: { '@id': org['@id'] }, sameAs: CHANNELS.map((c) => c.url) },
      {
        '@type': 'VideoGame', '@id': `${SITE}/#game`, name: NAME, alternateName: t('Up and down sailing race', 'Up and down — парусная гонка', 'Regata de Up and down'),
        url: `${SITE}/`, description: t(...HOME_DESC), inLanguage: lang, image: `${SITE}${OG_IMAGE.url}`,
        screenshot: [`${SITE}/images/hud-desk-v9.jpg`, `${SITE}/images/top-v9.jpg`],
        genre: ['Sailing', 'Racing', 'Sports simulation'], gamePlatform: ['Web browser', 'Mobile web browser'],
        applicationCategory: 'GameApplication', operatingSystem: 'Any (runs in a web browser)', playMode: 'SinglePlayer',
        gameLocation: VENUES.map((v) => (v.place[0] === v.name[0] ? t(...v.name) : `${t(...v.name)}, ${t(...v.place)}`)), isAccessibleForFree: true,
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
  const d = dailyRace(), where = pick(venueOf(d.venue).name, lang), boat = yachtOf(d.yacht), yacht = t(...boat.name);
  const kn = KN[d.preset], mins = raceMinutes({ ...d, timeK: boat.timeK }); // at today's yacht's own pace
  const windName = { light: t('Light', 'Слабый', 'Flojo'), medium: t('Medium', 'Средний', 'Medio'), strong: t('Strong', 'Сильный', 'Fuerte') }[d.preset];
  const live = today && today.d === d.day ? today : null;
  const top = live ? live.top : [];
  const best = top[0], races = live ? live.races : 0;
  const tenth = live?.tenth ?? null, ranked = live?.ranked ?? 0; // the 10th time, when ten are ranked today
  const name = (n: string | null) => n || t('No name', 'Без имени', 'Sin nombre');
  const beat = best ? clock(best.s) : null;
  // the ticker: only what's true of today's race
  const lines = [
    races ? t(`${races} ${races === 1 ? 'race' : 'races'} sailed today`, `Сегодня заездов: ${races}`, `${races} ${races === 1 ? 'regata' : 'regatas'} hoy`) : t('Nobody has finished today’s race yet', 'Гонку дня ещё никто не прошёл', 'Nadie ha terminado aún la regata del día'),
    best ? t(`${name(best.name)} holds the time to beat · ${beat}`, `Время, которое надо побить, у ${name(best.name)} · ${beat}`, `${name(best.name)} tiene el tiempo a batir · ${beat}`) : '',
    best && top[1] ? t(`${name(top[1].name)} is ${(top[1].s - best.s).toFixed(1)} s off the lead`, `${name(top[1].name)} отстаёт от лидера на ${(top[1].s - best.s).toFixed(1).replace('.', ',')} с`, `${name(top[1].name)} está a ${(top[1].s - best.s).toFixed(1).replace('.', ',')} s del primero`) : '',
    t(`${where} · the ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} boats`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} уз · ${ruBoats(d.fleet)}`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} barcos`),
    t('A new yacht every day', 'Каждый день — новая яхта', 'Un yate nuevo cada día'),
    t('A new race every midnight UTC', 'Новая гонка — каждую полночь по UTC', 'Una regata nueva cada medianoche UTC'),
  ].filter(Boolean);

  const features: [string, string][] = [
    [t('Wind that won’t sit still', 'Ветер, который не стоит на месте', 'Un viento que no se está quieto'), t('Shifts of 10° and more a minute, gusts and lulls. Races are won on them.', 'Сдвиги ветра на 10° и больше каждую минуту, порывы и затишья. На них и выигрывают.', 'Roladas de 10° y más por minuto, rachas y calmas. Las regatas se ganan en ellas.')],
    [t('A start like the real thing', 'Старт как в жизни', 'Una salida como la de verdad'), t('Class flag, P, one minute, then the gun. Over early? Go back.', 'Флаг класса, P, минута — и сигнал. Фальстарт? Назад за линию.', 'Bandera de clase, P, un minuto, y la señal. ¿Salida adelantada? Vuelve.')],
    [t('Sails in your hands', 'Паруса в твоих руках', 'Las velas en tus manos'), t('Main and jib on their own sheets, or auto-trim while you steer.', 'Грот и стаксель на своих шкотах или автонастройка, а ты только рулишь.', 'Mayor y foque con sus propias escotas, o trimado automático mientras gobiernas.')],
    [t('Rivals who know their rights', 'Соперники знают свои права', 'Rivales que conocen sus derechos'), t('Up to six computer boats that hail, give way and do their penalty turns.', 'До шести компьютерных лодок: окликают, уступают и крутят штрафные обороты.', 'Hasta seis barcos del ordenador que gritan, ceden el paso y hacen sus giros de penalización.')],
    [t('Tacks, gybes and the kite', 'Повороты и генакер', 'Viradas, trasluchadas y el gennaker'), t('Tack on the headers, hoist the gennaker for the run home.', 'Поворачивай на заходах, ставь генакер на попутном к финишу.', 'Vira con las roladas desfavorables, iza el gennaker para la empopada final.')],
    [t('A phone or a keyboard', 'Телефон или клавиатура', 'Móvil o teclado'), t('Steer with your thumb, upright or sideways, or with the arrow keys.', 'Рули пальцем, вертикально или горизонтально, или стрелками.', 'Gobierna con el pulgar, en vertical o en horizontal, o con las flechas.')],
  ];
  const way: [string, string, string][] = [
    [t('Or set up your own', 'Или настрой свою', 'O prepara la tuya'), t('The place, the wind, the fleet, the course’s shape and length, laps, the start’s length and the current. The game keeps your best on every course.', 'Место, ветер, флот, форма и длина дистанции, круги, длина старта и течение. Игра помнит твоё лучшее время на каждой дистанции.', 'El lugar, el viento, la flota, la forma y la longitud del recorrido, las vueltas, la duración de la salida y la corriente. El juego guarda tu mejor marca en cada recorrido.'), '/race/free'],
    [t('A debrief, not just a place', 'Разбор, а не только место', 'Un análisis, no solo un puesto'), t('Every finish opens its own page: the results, your track with any foul marked, leg by leg, what to work on, and the rule behind each foul.', 'Каждый финиш открывает свою страницу: результаты, твой трек с отмеченными нарушениями, отрезок за отрезком, над чем поработать и правило за каждым нарушением.', 'Cada llegada abre su propia página: los resultados, tu track con cada falta marcada, tramo a tramo, en qué mejorar y la regla detrás de cada falta.'), '/help#h-today'],
    [t('Hold it any way you like', 'Держи как удобно', 'Sujétalo como quieras'), t('Phone sideways, phone upright or a computer: the race screen lays itself out for each, and follows the phone if you turn it mid-race.', 'Телефон горизонтально, вертикально или компьютер: экран гонки подстраивается под каждый и поворачивается вместе с телефоном прямо в гонке.', 'Móvil en horizontal, móvil en vertical o un ordenador: la pantalla de regata se organiza para cada uno, y sigue al móvil si lo giras en plena regata.'), '/help#h-screen'],
    [t('Three views', 'Три вида', 'Tres vistas'), t('The drone behind the boat, straight down from above, or from the helm. Switch any time; on a keyboard, X, C and V.', 'Дрон за лодкой, прямо сверху или со штурвала. Переключай в любой момент; на клавиатуре — X, C и V.', 'El dron tras el barco, justo desde arriba, o desde el timón. Cambia cuando quieras; en el teclado, X, C y V.'), '/help#h-views'],
  ];
  // the hero's still under the game: the wide picture on a wide screen, the upright one on a phone — one <picture>, so
  // a browser fetches only the one it shows
  const hero = { alt: '', fill: true, sizes: '100vw', fetchPriority: 'high', loading: 'eager' } as const;
  const heroWide = getImageProps({ ...hero, src: '/images/drone-desk-v9.jpg' }).props.srcSet;
  const { alt: _alt, ...heroNarrow } = getImageProps({ ...hero, src: '/images/drone-port-v9.jpg' }).props;
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
        <HeroScene title={t('A race in the game', 'Гонка в игре', 'Una regata en el juego')} />
        <Soundtrack />
        <div className="ho-in">
          <div className="ho-info">
            <span className="ho-kick"><span className="dot-live" />{t(`Live · today’s race · ${where} · ${yacht}`, `Эфир · гонка дня · ${where} · ${yacht}`, `En directo · regata del día · ${where} · ${yacht}`)}</span>
            <h1 className="ho-h1" id="home-h1">{beat ? t(`Beat ${beat} today`, `Побей ${beat} сегодня`, `Bate ${beat} hoy`) : t('Set today’s time to beat', 'Задай время дня', 'Marca el tiempo a batir de hoy')}</h1>
            <BackStrip lang={lang} day={d.day} top={top} cap={live?.n} />
            <p className="ho-lead ho-new">{t(
              `A free sailing race game in your browser, under the real racing rules. One race for everyone today, so your time sits right next to theirs. About ${mins} minutes, no sign-up to start.`,
              `Бесплатная парусная гонка в браузере, по настоящим правилам. Сегодня у всех одна гонка, так что твоё время встанет рядом с остальными. Около ${mins} минут, без регистрации.`, `Un juego gratuito de regatas a vela en tu navegador, con las reglas de regatas reales. Una regata para todos hoy, así que tu tiempo queda junto al suyo. Unos ${mins} minutos, sin registro para empezar.`)}</p>
            <div className="ho-acts ho-hero-acts">
              <a className="ho-go ho-go-xl" href={go} data-cta="hero"><IconPlay s={22} /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día')}</span></a>
              <Link className="ho-ghost ho-go-xl ho-new" href="/race/free" data-cta="hero-practise">{t('Practise first', 'Сначала потренироваться', 'Practica primero')}</Link>
            </div>
            <Link className="ho-how ho-new" href="/help" data-cta="hero-how">{t('New to it? How to play, in 3 minutes', 'Впервые? Как играть — за 3 минуты', '¿Nuevo? Cómo jugar, en 3 minutos')} ›</Link>
            <ul className="ho-trust ho-new">
              <li>{t('Free', 'Бесплатно', 'Gratis')}</li><li>{t('No install', 'Без установки', 'Sin instalar')}</li><li>{t('No sign-up to play', 'Без регистрации', 'Sin registro para jugar')}</li><li>{t('Phone or keyboard', 'Телефон или клавиатура', 'Móvil o teclado')}</li><li>English · Русский</li>
            </ul>
          </div>
          <aside className="ho-card ho-rank" aria-label={t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy')}>
            <div className="ho-card-h"><span className="lbl-ink">{t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy')}</span><span className="lbl">{races ? t(`${races} ${races === 1 ? 'race' : 'races'}`, `заездов: ${races}`, `${races} ${races === 1 ? 'regata' : 'regatas'}`) : windName + ` · ${kn} ${t('kn', 'уз', 'kn')}`}</span></div>
            <div className="ho-cd"><span className="lbl">{t('This race closes, a new one starts in', 'Эта гонка закроется, новая начнётся через', 'Esta regata cierra, una nueva empieza en')}</span><Countdown /></div>
            <ol className="hm-lb bt-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><Who fl={r.fl} name={name(r.name)} lang={lang} />
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов', 'Aún no hay tiempos hoy')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} top={top} cap={live?.n} />
            </ol>
            <Link className="lb-more" href="/race/rating" data-cta="rank-more">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц', 'Clasificación completa y puntos del mes')}</Link>
            <div className="ho-tick" aria-live="polite"><span className="dot-live" /><Ticker lines={lines} /></div>
          </aside>
        </div>
      </section>

      <main className="ho-main">
        {/* 2 · three targets: something to aim for at every level */}
        <section className="ho-sec" aria-labelledby="h-goals">
          <div className="ho-sec-h">
            <div className="ho-sec-t"><span className="ho-k">{t('Today’s targets', 'Цели дня', 'Objetivos de hoy')}</span><h2 className="ho-h2" id="h-goals">{t('Pick one. Then go for the next.', 'Выбери одну. Потом — следующую.', 'Elige uno. Luego ve a por el siguiente.')}</h2></div>
            <span className="lbl">{t('Reset at midnight UTC with the race', 'Обновляются в полночь по UTC вместе с гонкой', 'Se reinicia a medianoche UTC con la regata')}</span>
          </div>
          <div className="ho-goals">
            <a className="ho-goal" href={go} data-cta="goal-finish">
              <span className="ho-medal">✓</span>
              <span className="lbl is-you">{t('Everyone', 'Для всех', 'Todos')}</span>
              <h3 className="ho-h3">{t('Finish the race', 'Пройди гонку', 'Termina la regata')}</h3>
              <p className="ho-ps">{t('Cross the line once. The game calls the start, the marks and when to tack as you go.', 'Пересеки финиш один раз. Игра подскажет старт, знаки и когда поворачивать.', 'Cruza la línea una vez. El juego te avisa de la salida, las balizas y cuándo virar sobre la marcha.')}</p>
              <span className="lbl-ink ho-foot">{t(`About ${mins} minutes ›`, `Около ${mins} минут ›`, `Unos ${mins} minutos ›`)}</span>
            </a>
            {/* with ten ranked today the club racer's target is the top ten, under the 10th time; else the podium */}
            {tenth != null ? (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">10</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик', 'Regatista de club')}</span>
                <h3 className="ho-h3">{t(`Top ten under ${clock(tenth)}`, `В десятку быстрее ${clock(tenth)}`, `Entre los diez primeros: menos de ${clock(tenth)}`)}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.', 'Gana la salida, vira con las roladas desfavorables, mantén la escota en la banda verde.')}</p>
                <span className="lbl-ink ho-foot">{t(`Today: ${clock(tenth)} is 10th of ${ranked} ›`, `Сегодня: ${clock(tenth)} — 10-е место из ${ranked} ›`, `Hoy: ${clock(tenth)} es el 10.º de ${ranked} ›`)}</span>
              </a>
            ) : (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">3</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик', 'Regatista de club')}</span>
                <h3 className="ho-h3">{t('Make the podium', 'Попади в тройку', 'Sube al podio')}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.', 'Gana la salida, vira con las roladas desfavorables, mantén la escota en la banda verde.')}</p>
                <span className="lbl-ink ho-foot">{top[2] ? t(`Today: ${clock(top[2].s)} is 3rd ›`, `Сегодня: ${clock(top[2].s)} — третье место ›`, `Hoy: ${clock(top[2].s)} es el 3.º ›`) : t('The podium is still open ›', 'В тройке ещё есть места ›', 'El podio sigue abierto ›')}</span>
              </a>
            )}
            <a className="ho-goal" href={go} data-cta="goal-win">
              <span className="ho-medal ho-medal-g">1</span>
              <span className="lbl is-you">{t('The time to beat', 'Время, которое надо побить', 'El tiempo a batir')}</span>
              <h3 className="ho-h3">{beat ? t(`Beat ${beat}`, `Побей ${beat}`, `Bate ${beat}`) : t('Set the time to beat', 'Задай время дня', 'Marca el tiempo a batir')}</h3>
              <p className="ho-ps">{best ? t(`${name(best.name)} holds it. A clean start and two good shifts get you close.`, `Оно у ${name(best.name).replace(/\.$/, '')}. Чистый старт и два пойманных захода — и ты рядом.`, `${name(best.name)} lo tiene. Una salida limpia y dos buenas roladas te acercan.`) : t('Nobody has finished today’s race yet: the first time home is the one to beat.', 'Гонку дня ещё никто не прошёл: первое время и станет тем, что будут бить.', 'Nadie ha terminado aún la regata del día: el primer tiempo en llegar es el que hay que batir.')}</p>
              <span className="lbl-ink ho-foot">{t('Take the top spot ›', 'Займи первое место ›', 'Toma el primer puesto ›')}</span>
            </a>
          </div>
        </section>

        {/* 3 · the first four races, each in its picture: a path, so a first race isn't the last (and what a race is) */}
        <section className="ho-sec ho-new" aria-labelledby="h-path">
          <div className="ho-sec-t"><span className="ho-k">{t('New to racing?', 'Впервые на гонке?', '¿Nuevo en las regatas?')}</span><h2 className="ho-h2" id="h-path">{t('Your first four races', 'Твои первые четыре гонки', 'Tus cuatro primeras regatas')}</h2></div>
          <ol className="ho-path">
            <li className="now"><span className="ho-pic ho-path-pic"><Image src="/images/h-steer-v9.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">1</span><span className="lbl is-you">{t(`Today · ${mins} min`, `Сегодня · ${mins} мин`, `Hoy · ${mins} min`)}</span><h3 className="ho-h3">{t('Just finish', 'Просто финишируй', 'Solo llega')}</h3><p className="ho-ps">{t('Sails on Auto, you only steer. Follow the call above your numbers.', 'Паруса на «Авто», ты только рулишь. Следуй подсказке над своими цифрами.', 'Velas en Auto, tú solo gobiernas. Sigue el aviso sobre tus números.')}</p></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-start-v9.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">2</span><span className="lbl">{t('Then', 'Потом', 'Luego')}</span><h3 className="ho-h3">{t('Win the start', 'Выиграй старт', 'Gana la salida')}</h3><p className="ho-ps">{t('Be a boat length behind the line, at full speed, as the gun goes.', 'Будь в корпусе от линии на полном ходу в момент сигнала.', 'Ponte una eslora por detrás de la línea, a toda velocidad, cuando suene la señal.')}</p><a className="ho-drill" href="/play?race=free&drill=start" data-cta="path-drill-start">{t('Practise it: the start drill ›', 'Потренируй: упражнение «Старт» ›', 'Practícalo: el ejercicio de salida ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-tack-v9.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">3</span><span className="lbl">{t('Then', 'Потом', 'Luego')}</span><h3 className="ho-h3">{t('Play the shifts', 'Лови заходы', 'Juega las roladas')}</h3><p className="ho-ps">{t('Tack when the wind heads you. Every header you catch is a place.', 'Поворачивай, когда ветер заходит. Каждый пойманный заход — место.', 'Vira cuando el viento te cierra. Cada rolada desfavorable que pilles es un puesto.')}</p><a className="ho-drill" href="/play?race=free&drill=beat" data-cta="path-drill-beat">{t('Practise it: the shifts drill ›', 'Потренируй: упражнение «Сдвиги ветра» ›', 'Practícalo: el ejercicio de roladas ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-trim-v9.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">4</span><span className="lbl">{t('Then', 'Потом', 'Luego')}</span><h3 className="ho-h3">{t('Race the ranking', 'Гоняйся за рейтингом', 'Compite por la clasificación')}</h3><p className="ho-ps">{t('Trim the sails yourself and go for today’s podium.', 'Настраивай паруса сам и иди в тройку дня.', 'Trima las velas tú mismo y ve a por el podio de hoy.')}</p></li>
          </ol>
          <div className="ho-acts">
            <a className="ho-go" href={go} data-cta="path-start"><IconPlay /><span>{t('Start race 1', 'Начать гонку 1', 'Empezar la regata 1')}</span></a>
            <Link className="ho-ghost" href="/help" data-cta="path-how">{t('How to play, in 3 minutes', 'Как играть — за 3 минуты', 'Cómo jugar, en 3 minutos')}</Link>
          </div>
        </section>

        {/* 5 · a reason to come back tomorrow */}
        <section className="ho-sec" aria-labelledby="h-venues">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k">{t('Come back tomorrow', 'Возвращайся завтра', 'Vuelve mañana')}</span>
              <h2 className="ho-h2" id="h-venues">{t(`${VENUES.length} venues, one a day`, `${VENUES.length} ${ruPlural(VENUES.length, ['акватория', 'акватории', 'акваторий'])}, по одной в день`, `${VENUES.length} sedes, una al día`)}</h2>
              <p className="ho-ps">{t(`Each day the race moves to another famous regatta venue, with its own hills, town and wind. Each comes round once every ${VENUES.length} days. Tomorrow’s is revealed at midnight UTC.`, `Каждый день гонка переезжает на другую знаменитую регатную акваторию — со своими холмами, городом и ветром. Каждая возвращается раз в ${VENUES.length} дня. Завтрашняя откроется в полночь по UTC.`, `Cada día la regata se muda a otra sede famosa de regatas, con sus propias colinas, ciudad y viento. Cada una vuelve cada ${VENUES.length} días. La de mañana se revela a medianoche UTC.`)}</p>
              <PushButton lang={lang} where="venues" />
              <p className="ho-ps"><Link className="hm-src" href="/venues" data-cta="venues">{t('The venues: the water, the wind and the regattas of each', 'Акватории: вода, ветер и регаты каждой', 'Las sedes: el agua, el viento y las regatas de cada una')}<IconArrow s={14} /></Link></p>
            </div>
            {/* the venues you've raced are stamped, and your streak over them: this device's, drawn in the browser */}
            <VenueList lang={lang} today={d.venue} />
          </div>
        </section>

        {/* 6 · bring a friend */}
        <section className="ho-sec ho-split" aria-labelledby="h-friend">
          <div className="ho-split-t">
            <span className="ho-k">{t('Race a friend', 'Гоняйся с другом', 'Compite con un amigo')}</span>
            <h2 className="ho-h2" id="h-friend">{t('Same wind. Same course. Who’s faster?', 'Тот же ветер. Та же дистанция. Кто быстрее?', 'Mismo viento. Mismo recorrido. ¿Quién es más rápido?')}</h2>
            <p className="ho-ps">{t('Everyone sails the same race today, so a result link is a challenge. Send yours after the finish; it opens on any device.', 'Сегодня у всех одна гонка, так что ссылка на результат — это вызов. Отправь свою после финиша: она откроется на любом устройстве.', 'Hoy todos navegan la misma regata, así que un enlace de resultado es un reto. Envía el tuyo tras la llegada; se abre en cualquier dispositivo.')}</p>
            <div className="ho-acts"><a className="ho-go" href={go} data-cta="friend">{t('Set a time to send', 'Поставь время, чтобы отправить', 'Marca un tiempo para enviar')}</a><MatchLink lang={lang} /></div>
          </div>
          <figure className="ho-card ho-friend">
            <span className="ho-pic"><Image src="/images/top-v9.jpg" alt={t('Yachts racing in the game, seen from above', 'Яхты на гонке в игре, вид сверху', 'Yates en regata en el juego, vistos desde arriba')} fill sizes="(min-width: 900px) 560px, 100vw" /></span>
            <span className="ho-friend-t"><span className="ho-kick">{t(`Today’s race · ${where}`, `Гонка дня · ${where}`, `Regata del día · ${where}`)}</span><b>{t('Can you beat me?', 'Сможешь быстрее?', '¿Puedes batirme?')}</b></span>
            <figcaption><span className="ho-ps">“{t('I finished today’s race. Can you beat my time?', 'Я прошёл гонку дня. Сможешь быстрее?', 'He terminado la regata del día. ¿Puedes batir mi tiempo?')}”</span><span className="lbl">{t('The link opens on any device', 'Ссылка откроется где угодно', 'El enlace se abre en cualquier dispositivo')}</span></figcaption>
          </figure>
        </section>

        {/* 6½ · between races: the drills */}
        <section className="ho-sec" aria-labelledby="h-more">
          <div className="ho-sec-t"><span className="ho-k">{t('Between races', 'Между гонками', 'Entre regatas')}</span><h2 className="ho-h2" id="h-more">{t('Practise the moments.', 'Отрабатывай ключевые моменты.', 'Practica los momentos.')}</h2></div>
          <div className="ho-feats">
            <Link className="ho-feat ho-feat-a" href="/race/drills" data-cta="drills"><i aria-hidden="true" /><div><h3 className="ho-h3">{t(`${DRILLS.length} drills`, `Упражнений: ${DRILLS.length}`, `${DRILLS.length} ejercicios`)}</h3><p className="ho-ps">{t('The start, the top mark, the shifts, a comeback: each a minute or two, three stars to win, from beginner to expert.', 'Старт, верхний знак, сдвиги ветра, отыгрыш: каждое на минуту-две, три звезды, от новичка до эксперта.', 'La salida, la baliza de barlovento, las roladas, una remontada: cada uno de uno o dos minutos, tres estrellas para ganar, de principiante a experto.')}</p></div></Link>
          </div>
        </section>

        <Fold lang={lang}>
        {/* 7 · why it is worth it */}
        <section className="ho-sec" aria-labelledby="h-parts">
          <div className="ho-sec-t"><span className="ho-k">{t('Inside the game', 'Внутри игры', 'Dentro del juego')}</span><h2 className="ho-h2" id="h-parts">{t('Everything a real race throws at you', 'Всё, чем встречает настоящая гонка', 'Todo lo que te lanza una regata de verdad')}</h2></div>
          <div className="ho-feats">
            {features.map(([title, text]) => <div className="ho-feat" key={title}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></div>)}
          </div>
          <dl className="bt-stats ho-nums">
            <div><dt className="bt-sk">{t('Wind', 'Ветер', 'Viento')}</dt><dd><b><Num v={`${KN.light}–${KN.strong} ${t('kn', 'уз', 'kn')}`} /></b></dd><dd className="bt-sv">{t('From light air to a breeze you reef for', 'От лёгкого ветра до такого, что берут рифы', 'De aire flojo a una brisa que obliga a rizar')}</dd></div>
            <div><dt className="bt-sk">{t('Fleet', 'Флот', 'Flota')}</dt><dd><b><CountUp v="3 · 5 · 7" /></b></dd><dd className="bt-sv">{t('Boats on the line, every one sailing by the rules', 'Лодок на линии, и все ходят по правилам', 'Barcos en la línea, todos navegando según las reglas')}</dd></div>
            <div><dt className="bt-sk">{t('Shifts', 'Сдвиги', 'Roladas')}</dt><dd><b><CountUp v="10°+" /></b></dd><dd className="bt-sv">{t('Every minute. Catch them or lose places', 'Каждую минуту. Лови их или теряй места', 'Cada minuto. Pilla las buenas o pierde puestos')}</dd></div>
            <div><dt className="bt-sk">{t('Race of the day', 'Гонка дня', 'Regata del día')}</dt><dd><b>1</b></dd><dd className="bt-sv">{t('One for everyone, a new one every midnight', 'Одна на всех, новая каждую полночь', 'Una para todos, una nueva cada medianoche')}</dd></div>
          </dl>
        </section>

        {/* your race, your way: the set-up, the debrief, the screens and the views */}
        <section className="ho-sec" aria-labelledby="h-way">
          <div className="ho-sec-t"><span className="ho-k">{t('Your race, your way', 'Твоя гонка — по-твоему', 'Tu regata, a tu manera')}</span><h2 className="ho-h2" id="h-way">{t('Set it up, sail it, read it back', 'Настрой, пройди, разбери', 'Prepárala, navégala, revísala')}</h2></div>
          <div className="ho-feats ho-feats-4">
            {way.map(([title, text, href]) => <Link className="ho-feat ho-feat-a" href={href} key={title} data-cta={`way-${href}`}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></Link>)}
          </div>
        </section>

        {/* 8 · the doubts, answered where they come up */}
        <section className="ho-sec ho-split" id="faq" aria-labelledby="h-faq">
          <div className="ho-split-t ho-faq-side">
            <span className="ho-k">{t('Before you sail', 'Перед стартом', 'Antes de navegar')}</span>
            <h2 className="ho-h2" id="h-faq">{t('In short', 'Коротко', 'En resumen')}</h2>
            <p className="ho-ps">{t(`The questions people ask before their first race. ${all.length - faq.length} more are on the FAQ page.`, `Вопросы, которые задают перед первой гонкой. Ещё ${all.length - faq.length} — на странице «Вопросы и ответы».`, `Las preguntas que la gente hace antes de su primera regata. Hay ${all.length - faq.length} más en la página de preguntas.`)}</p>
            <Link className="ho-ghost" href="/faq" data-cta="faq">{t('All questions', 'Все вопросы', 'Todas las preguntas')}<IconArrow s={16} /></Link>
          </div>
          <div className="ho-faq"><FaqList items={faq} openFirst /></div>
        </section>

        {/* 9 · the rules, and where to learn them */}
        <section className="ho-sec" aria-labelledby="h-rules">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k">Sailing Certification Test</span>
              <h2 className="ho-h2" id="h-rules">{t('Learn the rules there, race by them here', 'Учи правила там, гоняйся по ним здесь', 'Aprende las reglas allí, compite con ellas aquí')}</h2>
              <p className="ho-ps">{t('Up and down comes from RYC, the team behind Sailing Certification Test, the free trainer for sailing certificate exams. The computer boats give way by the same rules the exam asks about, so every race is revision you can feel on the water.', 'Up and down делает RYC — команда, которая сделала Sailing Certification Test, бесплатный тренажёр к экзаменам на яхтенные сертификаты. Компьютерные лодки уступают по тем же правилам, что спрашивают на экзамене, так что каждая гонка — повторение, которое чувствуешь на воде.', 'Up and down viene de RYC, el equipo detrás de Sailing Certification Test, el entrenador gratuito para los exámenes de títulos náuticos. Los barcos del ordenador ceden el paso con las mismas reglas por las que pregunta el examen, así que cada regata es un repaso que se siente en el agua.')}</p>
              <Link className="ho-ghost" href="/iyt" data-cta="iyt">{t('Sailing exam practice · 6100 questions', 'Тренажёр к яхтенному экзамену · 6100 вопросов', 'Práctica de examen náutico · 6100 preguntas')}<IconArrow s={16} /></Link>
            </div>
            <div className="ho-rules">
              <span className="lbl">{t('Rules you meet on the first beat', 'Правила, которые встретишь на первой лавировке', 'Reglas que encuentras en la primera ceñida')}</span>
              <ol className="hm-lb bt-lb ho-card">
                <li><span className="hm-n">10</span><span>{t('Port gives way to starboard', 'Левый галс уступает правому', 'Babor cede el paso a estribor')}</span></li>
                <li><span className="hm-n">11</span><span>{t('Windward boat keeps clear', 'Наветренная уступает', 'El barco de barlovento se mantiene separado')}</span></li>
                <li><span className="hm-n">13</span><span>{t('A tacking boat keeps clear', 'Поворачивающая уступает', 'Un barco que vira se mantiene separado')}</span></li>
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
        <div className="ho-dock-t"><span className="dot-live" /><b>{beat ? <><span className="ho-dock-w">{t(`Today’s race · ${where} · `, `Гонка дня · ${where} · `, `Regata del día · ${where} · `)}</span>{t(`beat ${beat}`, `побей ${beat}`, `bate ${beat}`)}</> : t(`Today’s race · ${where}`, `Гонка дня · ${where}`, `Regata del día · ${where}`)}</b><span className="lbl">{t('closes in', 'закроется через', 'cierra en')}</span><Countdown className="ho-dock-cd" /></div>
        <a className="ho-go" href={go} data-cta="dock"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día')}</span></a>
      </Dock>
    </div>
  );
}
