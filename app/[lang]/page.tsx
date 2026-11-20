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
function siteLd(lang: 'en' | 'ru' | 'es' | 'de' | 'tr', t: (en: string, ru: string, es?: string, de?: string, tr?: string) => string) {
  const org = { '@type': 'Organization', '@id': `${SITE}/#ryc`, name: 'RYC', url: 'https://www.rycrentals.com/', logo: `${SITE}/logo-black.svg`, sameAs: ['https://www.rycrentals.com/', 'https://www.rycsailing.com/'] };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: NAME, inLanguage: ['en', 'ru'], publisher: { '@id': org['@id'] }, sameAs: CHANNELS.map((c) => c.url) },
      {
        '@type': 'VideoGame', '@id': `${SITE}/#game`, name: NAME, alternateName: t('Up and down sailing race', 'Up and down — парусная гонка', 'Regata de Up and down', 'Up and down Segelregatta', 'Up and down yelken yarışı'),
        url: `${SITE}/`, description: t(...HOME_DESC), inLanguage: lang, image: `${SITE}${OG_IMAGE.url}`,
        screenshot: [`${SITE}/images/hud-desk-v10.jpg`, `${SITE}/images/top-v10.jpg`],
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
  const windName = { light: t('Light', 'Слабый', 'Flojo', 'Leicht', 'Hafif'), medium: t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta'), strong: t('Strong', 'Сильный', 'Fuerte', 'Stark', 'Kuvvetli') }[d.preset];
  const live = today && today.d === d.day ? today : null;
  const top = live ? live.top : [];
  const best = top[0], races = live ? live.races : 0;
  const tenth = live?.tenth ?? null, ranked = live?.ranked ?? 0; // the 10th time, when ten are ranked today
  const name = (n: string | null) => n || t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız');
  const beat = best ? clock(best.s) : null;
  // the ticker: only what's true of today's race
  const lines = [
    races ? t(`${races} ${races === 1 ? 'race' : 'races'} sailed today`, `Сегодня заездов: ${races}`, `${races} ${races === 1 ? 'regata' : 'regatas'} hoy`, `${races} ${races === 1 ? 'Regatta' : 'Regatten'} heute gesegelt`, `Bugün ${races} yarış yapıldı`) : t('Nobody has finished today’s race yet', 'Гонку дня ещё никто не прошёл', 'Nadie ha terminado aún la regata del día', 'Noch niemand hat die Regatta des Tages beendet', 'Günün yarışını henüz kimse bitirmedi'),
    best ? t(`${name(best.name)} holds the time to beat · ${beat}`, `Время, которое надо побить, у ${name(best.name)} · ${beat}`, `${name(best.name)} tiene el tiempo a batir · ${beat}`, `${name(best.name)} hält die Zeit zum Schlagen · ${beat}`, `${name(best.name)} · geçilecek süre ${beat}`) : '',
    best && top[1] ? t(`${name(top[1].name)} is ${(top[1].s - best.s).toFixed(1)} s off the lead`, `${name(top[1].name)} отстаёт от лидера на ${(top[1].s - best.s).toFixed(1).replace('.', ',')} с`, `${name(top[1].name)} está a ${(top[1].s - best.s).toFixed(1).replace('.', ',')} s del primero`, `${name(top[1].name)} liegt ${(top[1].s - best.s).toFixed(1).replace('.', ',')} s hinter der Spitze`, `${name(top[1].name)} lidere ${(top[1].s - best.s).toFixed(1).replace('.', ',')} sn geride`) : '',
    t(`${where} · the ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} boats`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} уз · ${ruBoats(d.fleet)}`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} barcos`, `${where} · Yacht ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} Boote`, `${where} · ${yacht} · ${windName.toLowerCase()} ${kn} kn · ${d.fleet} tekne`),
    t('A new yacht every day', 'Каждый день — новая яхта', 'Un yate nuevo cada día', 'Jeden Tag eine neue Yacht', 'Her gün yeni bir yat'),
    t('A new race every midnight UTC', 'Новая гонка — каждую полночь по UTC', 'Una regata nueva cada medianoche UTC', 'Jede Mitternacht UTC eine neue Regatta', 'Her gece yarısı UTC’de yeni bir yarış'),
  ].filter(Boolean);

  const features: [string, string][] = [
    [t('Wind that won’t sit still', 'Ветер, который не стоит на месте', 'Un viento que no se queda quieto', 'Wind, der nicht stillhält', 'Durmayan rüzgâr'), t('Shifts of 10° and more a minute, gusts and lulls. Races are won on them.', 'Сдвиги ветра на 10° и больше каждую минуту, порывы и затишья. На них и выигрывают.', 'Roladas de 10° y más por minuto, rachas y calmas. Las regatas se ganan en ellas.', 'Dreher von 10° und mehr pro Minute, Böen und Flauten. Darauf werden Regatten gewonnen.', 'Dakikada 10° ve fazla dönüşler, hamleler ve durgunluklar. Yarışlar bunlarla kazanılır.')],
    [t('A start like the real thing', 'Старт как в жизни', 'Una salida como la de verdad', 'Ein Start wie in echt', 'Gerçeği gibi bir start'), t('Class flag, P, one minute, then the gun. Over early? Go back.', 'Флаг класса, P, минута — и сигнал. Фальстарт? Назад за линию.', 'Bandera de clase, P, un minuto, y la señal. ¿Salida adelantada? Vuelve.', 'Klassenflagge, P, eine Minute, dann das Startsignal. Zu früh? Zurück.', 'Sınıf bayrağı, P, bir dakika, sonra start işareti. Erken mi geçtin? Geri dön.')],
    [t('Sails in your hands', 'Паруса в твоих руках', 'Las velas en tus manos', 'Segel in deiner Hand', 'Yelkenler senin elinde'), t('Main and jib on their own sheets, or auto-trim while you steer.', 'Грот и стаксель на своих шкотах или автонастройка, а ты только рулишь.', 'Mayor y foque con sus propias escotas, o trimado automático mientras gobiernas.', 'Groß und Fock an eigenen Schoten, oder Autotrimm, während du steuerst.', 'Ana yelken ve flok kendi iskotalarında, ya da dümen tutarken otomatik trim.')],
    [t('Rivals who know their rights', 'Соперники знают свои права', 'Rivales que conocen sus derechos', 'Gegner, die ihre Rechte kennen', 'Haklarını bilen rakipler'), t('Up to six computer boats that hail, give way and do their penalty turns.', 'До шести компьютерных лодок: окликают, уступают и крутят штрафные обороты.', 'Hasta seis barcos del ordenador que gritan, ceden el paso y hacen sus giros de penalización.', 'Bis zu sechs Computerboote, die rufen, ausweichen und ihre Strafkringel drehen.', 'Seslenen, yol veren ve ceza dönüşlerini yapan altı bilgisayar teknesine kadar.')],
    [t('Tacks, gybes and the kite', 'Повороты и генакер', 'Viradas, trasluchadas y el gennaker', 'Wenden, Halsen und der Kite', 'Tramolalar, kavançalar ve gennaker'), t('Tack on the headers, hoist the gennaker for the run home.', 'Поворачивай на заходах, ставь генакер на попутном к финишу.', 'Vira con las roladas desfavorables, iza el gennaker para la empopada final.', 'Wende bei den Drehern, setze den Gennaker für den Weg nach Hause.', 'Aleyhte dönüşlerde tramola at, eve dönüş pupasında gennakeri aç.')],
    [t('A phone or a keyboard', 'Телефон или клавиатура', 'Móvil o teclado', 'Handy oder Tastatur', 'Telefon ya da klavye'), t('Steer with your thumb, upright or sideways, or with the arrow keys.', 'Рули пальцем, вертикально или горизонтально, или стрелками.', 'Gobierna con el pulgar, en vertical o en horizontal, o con las flechas.', 'Steuere mit dem Daumen, hochkant oder quer, oder mit den Pfeiltasten.', 'Başparmağınla, dik ya da yatay tutarak, ya da ok tuşlarıyla dümen tut.')],
  ];
  const way: [string, string, string][] = [
    [t('Or set up your own', 'Или настрой свою', 'O prepara la tuya', 'Oder richte deine eigene ein', 'Ya da kendi yarışını kur'), t('The place, the wind, the fleet, the course’s shape and length, laps, the start’s length and the current. The game keeps your best on every course.', 'Место, ветер, флот, форма и длина дистанции, круги, длина старта и течение. Игра помнит твоё лучшее время на каждой дистанции.', 'El lugar, el viento, la flota, la forma y la longitud del recorrido, las vueltas, la duración de la salida y la corriente. El juego guarda tu mejor marca en cada recorrido.', 'Der Ort, der Wind, das Feld, Form und Länge der Bahn, Runden, die Länge des Starts und die Strömung. Das Spiel merkt sich deine Bestzeit auf jeder Bahn.', 'Yer, rüzgâr, filo, parkurun biçimi ve uzunluğu, turlar, startın uzunluğu ve akıntı. Oyun her parkurda en iyini saklar.'), '/race/free'],
    [t('A debrief, not just a place', 'Разбор, а не только место', 'Un análisis, no solo un puesto', 'Eine Auswertung, nicht nur ein Platz', 'Sadece bir sıra değil, bir değerlendirme'), t('Every finish opens its own page: the results, your track with any foul marked, leg by leg, what to work on, and the rule behind each foul.', 'Каждый финиш открывает свою страницу: результаты, твой трек с отмеченными нарушениями, отрезок за отрезком, над чем поработать и правило за каждым нарушением.', 'Cada llegada abre su propia página: los resultados, tu track con cada falta marcada, tramo a tramo, en qué mejorar y la regla detrás de cada falta.', 'Jedes Ziel öffnet eine eigene Seite: die Ergebnisse, deine Spur mit jedem markierten Foul, Schenkel für Schenkel, woran du arbeiten kannst und die Regel hinter jedem Foul.', 'Her bitiş kendi sayfasını açar: sonuçlar, varsa ihlallerin işaretli olduğu rotan, ayak ayak, üzerinde çalışılacaklar ve her ihlalin ardındaki kural.'), '/help#h-today'],
    [t('Hold it any way you like', 'Держи как удобно', 'Sujétalo como quieras', 'Halte es, wie du willst', 'İstediğin gibi tut'), t('Phone sideways, phone upright or a computer: the race screen lays itself out for each, and follows the phone if you turn it mid-race.', 'Телефон горизонтально, вертикально или компьютер: экран гонки подстраивается под каждый и поворачивается вместе с телефоном прямо в гонке.', 'Móvil en horizontal, móvil en vertical o un ordenador: la pantalla de regata se organiza para cada uno, y sigue al móvil si lo giras en plena regata.', 'Handy quer, Handy hochkant oder Computer: Der Regattabildschirm ordnet sich für jedes selbst an und folgt dem Handy, wenn du es mitten in der Regatta drehst.', 'Telefon yatay, telefon dik ya da bilgisayar: yarış ekranı her biri için kendini düzenler ve yarışın ortasında telefonu çevirirsen onu izler.'), '/help#h-screen'],
    [t('Three views', 'Три вида', 'Tres vistas', 'Drei Ansichten', 'Üç görünüm'), t('The drone behind the boat, straight down from above, or from the helm. Switch any time; on a keyboard, X, C and V.', 'Дрон за лодкой, прямо сверху или со штурвала. Переключай в любой момент; на клавиатуре — X, C и V.', 'El dron tras el barco, justo desde arriba, o desde el timón. Cambia cuando quieras; en el teclado, X, C y V.', 'Die Drohne hinter dem Boot, senkrecht von oben oder vom Ruder aus. Wechsle jederzeit; auf der Tastatur mit X, C und V.', 'Teknenin arkasındaki drone, tam yukarıdan aşağıya ya da dümenden. İstediğin an değiştir; klavyede X, C ve V.'), '/help#h-views'],
  ];
  // the hero's still under the game: the wide picture on a wide screen, the upright one on a phone — one <picture>, so
  // a browser fetches only the one it shows
  const hero = { alt: '', fill: true, sizes: '100vw', fetchPriority: 'high', loading: 'eager' } as const;
  const heroWide = getImageProps({ ...hero, src: '/images/drone-desk-v10.jpg' }).props.srcSet;
  const { alt: _alt, ...heroNarrow } = getImageProps({ ...hero, src: '/images/drone-port-v10.jpg' }).props;
  const all = faqGroups(t).flatMap((g) => g.items);
  const faq = HOME.map((id) => all.find((f) => f.id === id)!);
  const go = '/play?race=today', first = '/play?race=first'; // (first: the easy race, on any device: public/game/classes.js firstRaceHere)

  // today's leaderboard: the countdown, the top and your row; beside a returning player's hero, under a newcomer's targets
  const board = (
    <>
      <div className="ho-card-h"><span className="lbl-ink">{t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', 'Günün sıralaması')}</span><span className="lbl">{races ? t(`${races} ${races === 1 ? 'race' : 'races'}`, `заездов: ${races}`, `${races} ${races === 1 ? 'regata' : 'regatas'}`, `${races} ${races === 1 ? 'Regatta' : 'Regatten'}`, `${races} yarış`) : windName + ` · ${kn} ${t('kn', 'уз', 'kn', 'kn', 'kn')}`}</span></div>
      <div className="ho-cd"><span className="lbl">{t('This race closes, a new one starts in', 'Эта гонка закроется, новая начнётся через', 'Esta regata cierra, una nueva empieza en', 'Diese Regatta endet, eine neue startet in', 'Bu yarış kapanır, yenisi şu süre sonra başlar')}</span><Countdown /></div>
      <ol className="hm-lb bt-lb">
        {top.map((r, i) => (
          <li key={i} className={i === 0 ? 'first' : ''}>
            <span className="hm-n">{i + 1}</span><Who fl={r.fl} name={name(r.name)} lang={lang} />
            <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
          </li>
        ))}
        {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов', 'Aún no hay tiempos hoy', 'Heute noch keine Zeiten', 'Bugün henüz süre yok')}</span><span /></li>}
        <MyRow lang={lang} day={d.day} top={top} cap={live?.n} />
      </ol>
      <Link className="lb-more" href="/race/rating" data-cta="rank-more">{t('Full rating and the month’s points', 'Весь рейтинг и очки за месяц', 'Clasificación completa y puntos del mes', 'Gesamtrangliste und Punkte des Monats', 'Tam sıralama ve ayın puanları')}</Link>
    </>
  );

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
        <HeroScene title={t('A race in the game', 'Гонка в игре', 'Una regata en el juego', 'Eine Regatta im Spiel', 'Oyunda bir yarış')} />
        <Soundtrack />
        <div className="ho-in">
          {/* a newcomer's (no race on this device): the first race, an Optimist's three minutes, and the way in beside it */}
          {/* the hook. A newcomer's (no race on this device: <html data-back> unset, styles/home-back.css): the first race, an
              Optimist's three minutes, and the way in beside it. A returning player's: today's time to beat, the ranking beside it */}
          <div className="ho-info">
            <span className="ho-kick ho-new">{t('Your first race · 3 min', 'Твоя первая гонка · 3 мин', 'Tu primera regata · 3 min', 'Deine erste Regatta · 3 Min.', 'İlk yarışın · 3 dk')}</span>
            <span className="ho-kick ho-old"><span className="dot-live" />{t(`Live · today’s race · ${where} · ${yacht}`, `Эфир · гонка дня · ${where} · ${yacht}`, `En directo · regata del día · ${where} · ${yacht}`, `Live · Regatta des Tages · ${where} · ${yacht}`, `Canlı · günün yarışı · ${where} · ${yacht}`)}</span>
            <h1 className="ho-h1" id="home-h1"><span className="ho-new">{t('Sail your first race in 3 minutes', 'Первая гонка — за 3 минуты', 'Tu primera regata en 3 minutos', 'Deine erste Regatta in 3 Minuten', 'İlk yarışını 3 dakikada yap')}</span><span className="ho-old">{beat ? t(`Beat ${beat} today`, `Побей ${beat} сегодня`, `Bate ${beat} hoy`, `Schlage ${beat} heute`, `Bugün ${beat} süresini geç`) : t('Set today’s time to beat', 'Задай время дня', 'Marca el tiempo a batir de hoy', 'Die Zeit zum Schlagen des Tages setzen', 'Günün geçilecek süresini belirle')}</span></h1>
            <BackStrip lang={lang} day={d.day} top={top} cap={live?.n} />
            <p className="ho-lead ho-new">{t('A short race in an Optimist against four beginner boats, in your browser. The start counts itself down; you steer, the sails trim themselves. Then today’s race, with everyone.',
              'Короткая гонка на «Оптимисте» против четырёх новичков, прямо в браузере. Старт отсчитается сам; ты рулишь, паруса настраиваются сами. Потом — гонка дня, вместе со всеми.',
              'Una regata corta en Optimist contra cuatro barcos principiantes, en tu navegador. La salida se cuenta sola; tú gobiernas y las velas se ajustan solas. Después, la regata del día, con todos.',
              'Eine kurze Regatta im Optimist gegen vier Anfängerboote, im Browser. Der Start zählt sich selbst herunter; du steuerst, die Segel trimmen sich selbst. Danach die Regatta des Tages, mit allen.',
              'Tarayıcında, dört acemi tekneye karşı Optimist ile kısa bir yarış. Start kendi kendine geri sayar; sen dümen kırarsın, yelkenler kendini ayarlar. Sonra herkesle birlikte günün yarışı.')}</p>
            <div className="ho-acts ho-hero-acts ho-new">
              <a className="ho-go ho-go-xl" href={first} data-cta="hero-first"><IconPlay s={22} /><span>{t('Start your first race', 'Начать первую гонку', 'Empieza tu primera regata', 'Starte deine erste Regatta', 'İlk yarışına başla')}</span></a>
              <a className="ho-ghost ho-go-xl" href="/play?race=today&nofirst" data-cta="hero-today">{t('Already sail? Today’s race', 'Уже ходишь? Гонка дня', '¿Ya navegas? La regata del día', 'Segelst du schon? Regatta des Tages', 'Zaten yelken mi açıyorsun? Günün yarışı')}</a>
            </div>
            <div className="ho-acts ho-hero-acts ho-old">
              <a className="ho-go ho-go-xl" href={go} data-cta="hero"><IconPlay s={22} /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık')}</span></a>
            </div>
            <ul className="ho-trust ho-new">
              <li>{t('Free', 'Бесплатно', 'Gratis', 'Kostenlos', 'Ücretsiz')}</li><li>{t('No install', 'Без установки', 'Sin instalar', 'Keine Installation', 'Kurulum yok')}</li><li>{t('No sign-up to play', 'Без регистрации', 'Sin registro para jugar', 'Zum Spielen keine Anmeldung', 'Oynamak için kayıt gerekmez')}</li>
            </ul>
          </div>
          <aside className="ho-card ho-rank ho-way ho-new" aria-label={t('Your way in', 'Как начать', 'Por dónde empezar', 'Dein Einstieg', 'Başlangıç yolun')}>
            <div className="ho-card-h"><span className="lbl-ink">{t('Your way in', 'Как начать', 'Por dónde empezar', 'Dein Einstieg', 'Başlangıç yolun')}</span><span className="lbl">{t('3 steps', '3 шага', '3 pasos', '3 Schritte', '3 adım')}</span></div>
            <ol className="ho-way-l">
              <li className="now"><a href={first}><span className="ho-n">1</span><span className="ho-way-t"><b>{t('Your first race', 'Первая гонка', 'Tu primera regata', 'Deine erste Regatta', 'İlk yarışın')}</b><span className="ho-ps">{t('An Optimist, four beginner boats, about 3 minutes. Just finish.', '«Оптимист», четыре новичка, около 3 минут. Просто финишируй.', 'Un Optimist, cuatro barcos principiantes, unos 3 minutos. Solo llega.', 'Ein Optimist, vier Anfängerboote, etwa 3 Minuten. Einfach ins Ziel kommen.', 'Bir Optimist, dört acemi tekne, yaklaşık 3 dakika. Sadece bitir.')}</span></span><span className="hm-tag">{t('Now', 'Сейчас', 'Ahora', 'Jetzt', 'Şimdi')}</span></a></li>
              <li><a href="/play?race=today&nofirst"><span className="ho-n">2</span><span className="ho-way-t"><b>{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı')}</b><span className="ho-ps">{beat
                ? t(`${where} · ${yacht}. One race for everyone, the time to beat ${beat}.`, `${where} · ${yacht}. Одна гонка для всех, время дня — ${beat}.`, `${where} · ${yacht}. Una regata para todos, el tiempo a batir: ${beat}.`, `${where} · ${yacht}. Eine Regatta für alle, die Zeit zum Schlagen: ${beat}.`, `${where} · ${yacht}. Herkes için tek yarış, geçilecek süre ${beat}.`)
                : t(`${where} · ${yacht}. One race for everyone.`, `${where} · ${yacht}. Одна гонка для всех.`, `${where} · ${yacht}. Una regata para todos.`, `${where} · ${yacht}. Eine Regatta für alle.`, `${where} · ${yacht}. Herkes için tek yarış.`)}</span></span><span className="ho-way-live"><span className="dot-live" />{t('Live', 'Эфир', 'En directo', 'Live', 'Canlı')}</span></a></li>
              <li><Link href="/sign-in"><span className="ho-n">3</span><span className="ho-way-t"><b>{t('Keep your results', 'Сохраняй результаты', 'Guarda tus resultados', 'Behalte deine Ergebnisse', 'Sonuçlarını sakla')}</b><span className="ho-ps">{t('Sign in once: your races and your boat on any device, and a reminder each day.', 'Войди один раз: гонки и лодка на любом устройстве и напоминание каждый день.', 'Inicia sesión una vez: tus regatas y tu barco en cualquier dispositivo, y un recordatorio cada día.', 'Melde dich einmal an: deine Regatten und dein Boot auf jedem Gerät und eine Erinnerung jeden Tag.', 'Bir kez giriş yap: yarışların ve teknen her cihazda, her gün bir hatırlatma.')}</span></span></Link></li>
            </ol>
          </aside>
          <aside className="ho-card ho-rank ho-old" aria-label={t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', 'Günün sıralaması')}>
            {board}
            <div className="ho-tick" aria-live="polite"><span className="dot-live" /><Ticker lines={lines} /></div>
          </aside>
        </div>
      </section>

      <main className="ho-main">
        {/* 2 · three targets: something to aim for at every level */}
        <section className="ho-sec" aria-labelledby="h-goals">
          <div className="ho-sec-h">
            <div className="ho-sec-t ho-old"><span className="ho-k">{t('Today’s targets', 'Цели дня', 'Objetivos de hoy', 'Ziele von heute', 'Günün hedefleri')}</span><h2 className="ho-h2" id="h-goals">{t('Pick one. Then go for the next.', 'Выбери одну. Потом — следующую.', 'Elige uno. Luego ve a por el siguiente.', 'Such dir eins aus. Dann nimm das nächste.', 'Birini seç. Sonra bir sonrakine geç.')}</h2></div>
            <div className="ho-sec-t ho-new"><span className="ho-kick"><span className="dot-live" />{t(`Then · today’s race · ${where} · ${yacht}`, `Потом · гонка дня · ${where} · ${yacht}`, `Luego · regata del día · ${where} · ${yacht}`, `Dann · Regatta des Tages · ${where} · ${yacht}`, `Sonra · günün yarışı · ${where} · ${yacht}`)}</span><h2 className="ho-h2">{t('One race for everyone. Pick a target.', 'Одна гонка для всех. Выбери цель.', 'Una regata para todos. Elige un objetivo.', 'Eine Regatta für alle. Wähl ein Ziel.', 'Herkes için tek yarış. Bir hedef seç.')}</h2></div>
            <span className="lbl ho-old">{t('Reset at midnight UTC with the race', 'Обновляются в полночь по UTC вместе с гонкой', 'Se reinicia a medianoche UTC con la regata', 'Wird um Mitternacht UTC mit der Regatta zurückgesetzt', 'Yarışla birlikte gece yarısı UTC’de sıfırlanır')}</span>
          </div>
          <div className="ho-goals">
            <a className="ho-goal ho-old" href={go} data-cta="goal-finish">
              <span className="ho-medal">✓</span>
              <span className="lbl is-you">{t('Everyone', 'Для всех', 'Todos', 'Alle', 'Herkes')}</span>
              <h3 className="ho-h3">{t('Finish the race', 'Пройди гонку', 'Termina la regata', 'Die Regatta beenden', 'Yarışı bitir')}</h3>
              <p className="ho-ps">{t('Cross the line once. The game calls the start, the marks and when to tack as you go.', 'Пересеки финиш один раз. Игра подскажет старт, знаки и когда поворачивать.', 'Cruza la línea una vez. El juego te avisa de la salida, las balizas y cuándo virar sobre la marcha.', 'Fahr einmal über die Linie. Das Spiel sagt dir unterwegs den Start, die Bahnmarken und wann du wenden musst.', 'Hattı bir kez geç. Oyun ilerledikçe startı, şamandıraları ve ne zaman tramola atacağını söyler.')}</p>
              <span className="lbl-ink ho-foot">{t(`About ${mins} minutes ›`, `Около ${mins} минут ›`, `Unos ${mins} minutos ›`, `Etwa ${mins} Minuten ›`, `Yaklaşık ${mins} dakika ›`)}</span>
            </a>
            {/* with ten ranked today the club racer's target is the top ten, under the 10th time; else the podium */}
            {tenth != null ? (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">10</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик', 'Regatista de club', 'Clubsegler', 'Kulüp yarışçısı')}</span>
                <h3 className="ho-h3">{t(`Top ten under ${clock(tenth)}`, `В десятку быстрее ${clock(tenth)}`, `Entre los diez primeros: menos de ${clock(tenth)}`, `Top Ten unter ${clock(tenth)}`, `İlk on ${clock(tenth)} altında`)}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.', 'Gana la salida, vira con las roladas desfavorables, mantén la escota en la banda verde.', 'Gewinne den Start, wende bei den Drehern, halte die Schot im grünen Bereich.', 'Startı kazan, aleyhte dönüşlerde tramola at, iskotayı yeşil bantta tut.')}</p>
                <span className="lbl-ink ho-foot">{t(`Today: ${clock(tenth)} is 10th of ${ranked} ›`, `Сегодня: ${clock(tenth)} — 10-е место из ${ranked} ›`, `Hoy: ${clock(tenth)} es el 10.º de ${ranked} ›`, `Heute: ${clock(tenth)} ist Platz 10 von ${ranked} ›`, `Bugün: ${clock(tenth)}, ${ranked} içinde 10. ›`)}</span>
              </a>
            ) : (
              <a className="ho-goal" href={go} data-cta="goal-podium">
                <span className="ho-medal ho-medal-w">3</span>
                <span className="lbl is-you">{t('Club racer', 'Клубный гонщик', 'Regatista de club', 'Clubsegler', 'Kulüp yarışçısı')}</span>
                <h3 className="ho-h3">{t('Make the podium', 'Попади в тройку', 'Sube al podio', 'Aufs Podium kommen', 'Podyuma çık')}</h3>
                <p className="ho-ps">{t('Win the start, tack on the headers, keep the sheet in the green band.', 'Выиграй старт, поворачивай на заходах, держи шкот в зелёной полосе.', 'Gana la salida, vira con las roladas desfavorables, mantén la escota en la banda verde.', 'Gewinne den Start, wende bei den Drehern, halte die Schot im grünen Bereich.', 'Startı kazan, aleyhte dönüşlerde tramola at, iskotayı yeşil bantta tut.')}</p>
                <span className="lbl-ink ho-foot">{top[2] ? t(`Today: ${clock(top[2].s)} is 3rd ›`, `Сегодня: ${clock(top[2].s)} — третье место ›`, `Hoy: ${clock(top[2].s)} es el 3.º ›`, `Heute: ${clock(top[2].s)} ist Platz 3 ›`, `Bugün: ${clock(top[2].s)} 3. ›`) : t('The podium is still open ›', 'В тройке ещё есть места ›', 'El podio sigue abierto ›', 'Das Podium ist noch offen ›', 'Podyum hâlâ açık ›')}</span>
              </a>
            )}
            <a className="ho-goal" href={go} data-cta="goal-win">
              <span className="ho-medal ho-medal-g">1</span>
              <span className="lbl is-you">{t('The time to beat', 'Время, которое надо побить', 'El tiempo a batir', 'Die Zeit zum Schlagen', 'Geçilecek süre')}</span>
              <h3 className="ho-h3">{beat ? t(`Beat ${beat}`, `Побей ${beat}`, `Bate ${beat}`, `${beat} schlagen`, `${beat} süresini geç`) : t('Set the time to beat', 'Задай время дня', 'Marca el tiempo a batir', 'Die Zeit zum Schlagen setzen', 'Geçilecek süreyi belirle')}</h3>
              <p className="ho-ps">{best ? t(`${name(best.name)} holds it. A clean start and two good shifts get you close.`, `Оно у ${name(best.name).replace(/\.$/, '')}. Чистый старт и два пойманных захода — и ты рядом.`, `${name(best.name)} lo tiene. Una salida limpia y dos buenas roladas te acercan.`, `${name(best.name)} hält sie. Ein sauberer Start und zwei gute Dreher bringen dich nah heran.`, `${name(best.name)} bu süreye sahip. Temiz bir start ve iki iyi dönüş seni yaklaştırır.`) : t('Nobody has finished today’s race yet: the first time home is the one to beat.', 'Гонку дня ещё никто не прошёл: первое время и станет тем, что будут бить.', 'Nadie ha terminado aún la regata del día: el primer tiempo en llegar es el que hay que batir.', 'Noch niemand hat die Regatta des Tages beendet: Die erste Zeit im Ziel ist die zu schlagende.', 'Günün yarışını henüz kimse bitirmedi: eve ilk gelen süre, geçilecek süredir.')}</p>
              <span className="lbl-ink ho-foot">{t('Take the top spot ›', 'Займи первое место ›', 'Toma el primer puesto ›', 'Hol dir den Spitzenplatz ›', 'Zirveyi al ›')}</span>
            </a>
          </div>
          <aside className="ho-card ho-rank ho-board ho-new" aria-label={t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', 'Günün sıralaması')}>
            {board}
          </aside>
        </section>

        {/* 3 · the first four races, each in its picture: a path, so a first race isn't the last (and what a race is) */}
        <section className="ho-sec ho-new" aria-labelledby="h-path">
          <div className="ho-sec-t"><span className="ho-k">{t('New to racing?', 'Впервые на гонке?', '¿Nuevo en las regatas?', 'Neu im Regattasport?', 'Yarışa yeni misin?')}</span><h2 className="ho-h2" id="h-path">{t('Your first four races', 'Твои первые четыре гонки', 'Tus cuatro primeras regatas', 'Deine ersten vier Regatten', 'İlk dört yarışın')}</h2></div>
          <ol className="ho-path">
            <li className="now"><span className="ho-pic ho-path-pic"><Image src="/images/first-opti-v1.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">1</span><span className="lbl is-you">{t('First · 3 min · an Optimist', 'Сначала · 3 мин · «Оптимист»', 'Primero · 3 min · un Optimist', 'Zuerst · 3 Min. · ein Optimist', 'Önce · 3 dk · bir Optimist')}</span><h3 className="ho-h3">{t('Just finish', 'Просто финишируй', 'Solo llega', 'Einfach ins Ziel kommen', 'Sadece bitir')}</h3><p className="ho-ps">{t('Four beginner boats, a 20-second start. You only steer; the sails trim themselves.', 'Четыре новичка, старт через 20 секунд. Ты только рулишь, паруса настраиваются сами.', 'Cuatro barcos principiantes, una salida de 20 segundos. Tú solo gobiernas; las velas se ajustan solas.', 'Vier Anfängerboote, ein Start in 20 Sekunden. Du steuerst nur; die Segel trimmen sich selbst.', 'Dört acemi tekne, 20 saniyelik bir start. Sen sadece dümen kırarsın; yelkenler kendini ayarlar.')}</p></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-start-v10.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">2</span><span className="lbl">{t('Then · today’s race', 'Потом · гонка дня', 'Luego · la regata del día', 'Dann · Regatta des Tages', 'Sonra · günün yarışı')}</span><h3 className="ho-h3">{t('Win the start', 'Выиграй старт', 'Gana la salida', 'Gewinne den Start', 'Startı kazan')}</h3><p className="ho-ps">{t('Today’s yacht, with everyone. Be a boat length behind the line, at full speed, as the gun goes.', 'Яхта дня, вместе со всеми. Будь в корпусе от линии на полном ходу в момент сигнала.', 'El yate del día, con todos. Ponte una eslora por detrás de la línea, a toda velocidad, cuando suene la señal.', 'Die Yacht des Tages, mit allen. Sei eine Bootslänge hinter der Linie, mit voller Fahrt, wenn das Startsignal fällt.', 'Günün yatı, herkesle birlikte. Start işareti verilirken hattın bir tekne boyu gerisinde, tam hızda ol.')}</p><a className="ho-drill" href="/play?race=free&drill=start" data-cta="path-drill-start">{t('Practise it: the start drill ›', 'Потренируй: упражнение «Старт» ›', 'Practícalo: el ejercicio de salida ›', 'Übe es: die Start-Übung ›', 'Alıştır: start alıştırması ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-tack-v10.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">3</span><span className="lbl">{t('Then', 'Потом', 'Luego', 'Dann', 'Sonra')}</span><h3 className="ho-h3">{t('Play the shifts', 'Лови заходы', 'Juega las roladas', 'Nutze die Dreher', 'Rüzgâr dönüşlerini oyna')}</h3><p className="ho-ps">{t('Tack when the wind heads you. Every header you catch is a place.', 'Поворачивай, когда ветер заходит. Каждый пойманный заход — место.', 'Vira cuando el viento te cierra. Cada rolada desfavorable que pilles es un puesto.', 'Wende, wenn der Wind dich abdreht. Jeder Dreher, den du erwischst, ist ein Platz.', 'Rüzgâr seni aleyhe çevirince tramola at. Yakaladığın her aleyhte dönüş bir sıra kazandırır.')}</p><a className="ho-drill" href="/play?race=free&drill=beat" data-cta="path-drill-beat">{t('Practise it: the shifts drill ›', 'Потренируй: упражнение «Сдвиги ветра» ›', 'Practícalo: el ejercicio de roladas ›', 'Übe es: die Dreher-Übung ›', 'Alıştır: rüzgâr dönüşleri alıştırması ›')}</a></li>
            <li><span className="ho-pic ho-path-pic"><Image src="/images/h-trim-v10.jpg" alt="" fill sizes="(min-width: 900px) 300px, 100vw" /></span><span className="ho-n">4</span><span className="lbl">{t('Then', 'Потом', 'Luego', 'Dann', 'Sonra')}</span><h3 className="ho-h3">{t('Race the ranking', 'Гоняйся за рейтингом', 'Compite por la clasificación', 'Segle um die Rangliste', 'Sıralama için yarış')}</h3><p className="ho-ps">{t('Trim the sails yourself and go for today’s podium.', 'Настраивай паруса сам и иди в тройку дня.', 'Trima las velas tú mismo y ve a por el podio de hoy.', 'Trimme die Segel selbst und greif nach dem Podium von heute.', 'Yelkenleri kendin trim et ve günün podyumunu hedefle.')}</p></li>
          </ol>
          <div className="ho-acts">
            <Link className="ho-ghost" href="/help" data-cta="path-how">{t('How to play, in 3 minutes', 'Как играть — за 3 минуты', 'Cómo jugar, en 3 minutos', 'So spielst du, in 3 Minuten', 'Nasıl oynanır, 3 dakikada')}</Link>
          </div>
        </section>

        {/* 5 · a reason to come back tomorrow */}
        <section className="ho-sec" aria-labelledby="h-venues">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k">{t('Come back tomorrow', 'Возвращайся завтра', 'Vuelve mañana', 'Komm morgen wieder', 'Yarın yine gel')}</span>
              <h2 className="ho-h2" id="h-venues">{t(`${VENUES.length} venues, one a day`, `${VENUES.length} ${ruPlural(VENUES.length, ['акватория', 'акватории', 'акваторий'])}, по одной в день`, `${VENUES.length} sedes, una al día`, `${VENUES.length} Reviere, eins pro Tag`, `${VENUES.length} yarış alanı, günde bir`)}</h2>
              <p className="ho-ps">{t(`Each day the race moves to another famous regatta venue, with its own hills, town and wind. Each comes round once every ${VENUES.length} days. Tomorrow’s is revealed at midnight UTC.`, `Каждый день гонка переезжает на другую знаменитую регатную акваторию — со своими холмами, городом и ветром. Каждая возвращается раз в ${VENUES.length} дня. Завтрашняя откроется в полночь по UTC.`, `Cada día la regata se muda a otra sede famosa de regatas, con sus propias colinas, ciudad y viento. Cada una vuelve cada ${VENUES.length} días. La de mañana se revela a medianoche UTC.`, `Jeden Tag zieht die Regatta zu einem anderen berühmten Regattarevier um, mit eigenen Hügeln, eigener Stadt und eigenem Wind. Jedes kommt alle ${VENUES.length} Tage einmal dran. Das von morgen wird um Mitternacht UTC enthüllt.`, `Her gün yarış, kendi tepeleri, kasabası ve rüzgârıyla başka ünlü bir regata alanına taşınır. Her biri ${VENUES.length} günde bir kez döner. Yarının alanı gece yarısı UTC’de açıklanır.`)}</p>
              <PushButton lang={lang} where="venues" />
              <p className="ho-ps"><Link className="hm-src" href="/venues" data-cta="venues">{t('The venues: the water, the wind and the regattas of each', 'Акватории: вода, ветер и регаты каждой', 'Las sedes: el agua, el viento y las regatas de cada una', 'Die Reviere: das Wasser, der Wind und die Regatten jedes Reviers', 'Yarış alanları: her birinin suyu, rüzgârı ve regataları')}<IconArrow s={14} /></Link></p>
            </div>
            {/* the venues you've raced are stamped, and your streak over them: this device's, drawn in the browser */}
            <VenueList lang={lang} today={d.venue} />
          </div>
        </section>

        {/* 6 · bring a friend */}
        <section className="ho-sec ho-split" aria-labelledby="h-friend">
          <div className="ho-split-t">
            <span className="ho-k">{t('Race a friend', 'Гоняйся с другом', 'Compite con un amigo', 'Segle gegen einen Freund', 'Bir arkadaşınla yarış')}</span>
            <h2 className="ho-h2" id="h-friend">{t('Same wind. Same course. Who’s faster?', 'Тот же ветер. Та же дистанция. Кто быстрее?', 'Mismo viento. Mismo recorrido. ¿Quién es más rápido?', 'Gleicher Wind. Gleiche Bahn. Wer ist schneller?', 'Aynı rüzgâr. Aynı parkur. Kim daha hızlı?')}</h2>
            <p className="ho-ps">{t('Everyone sails the same race today, so a result link is a challenge. Send yours after the finish; it opens on any device.', 'Сегодня у всех одна гонка, так что ссылка на результат — это вызов. Отправь свою после финиша: она откроется на любом устройстве.', 'Hoy todos navegan la misma regata, así que un enlace de resultado es un reto. Envía el tuyo tras la llegada; se abre en cualquier dispositivo.', 'Heute segelt jeder dieselbe Regatta, also ist ein Ergebnislink eine Herausforderung. Schick deinen nach dem Ziel; er öffnet sich auf jedem Gerät.', 'Bugün herkes aynı yarışı yapar, bu yüzden bir sonuç bağlantısı meydan okumadır. Bitişten sonra seninkini gönder; her cihazda açılır.')}</p>
            <div className="ho-acts"><a className="ho-go" href={go} data-cta="friend">{t('Set a time to send', 'Поставь время, чтобы отправить', 'Marca un tiempo para enviar', 'Eine Zeit zum Senden setzen', 'Göndermek için bir süre belirle')}</a><MatchLink lang={lang} /></div>
          </div>
          <figure className="ho-card ho-friend">
            <span className="ho-pic"><Image src="/images/top-v10.jpg" alt={t('Yachts racing in the game, seen from above', 'Яхты на гонке в игре, вид сверху', 'Yates en regata en el juego, vistos desde arriba', 'Im Spiel segelnde Yachten, von oben gesehen', 'Oyunda yarışan yatlar, yukarıdan görünüş')} fill sizes="(min-width: 900px) 560px, 100vw" /></span>
            <span className="ho-friend-t"><span className="ho-kick">{t(`Today’s race · ${where}`, `Гонка дня · ${where}`, `Regata del día · ${where}`, `Regatta des Tages · ${where}`, `Günün yarışı · ${where}`)}</span><b>{t('Can you beat me?', 'Сможешь быстрее?', '¿Puedes batirme?', 'Kannst du mich schlagen?', 'Beni geçebilir misin?')}</b></span>
            <figcaption><span className="ho-ps">“{t('I finished today’s race. Can you beat my time?', 'Я прошёл гонку дня. Сможешь быстрее?', 'He terminado la regata del día. ¿Puedes batir mi tiempo?', 'Ich habe die Regatta des Tages beendet. Kannst du meine Zeit schlagen?', 'Günün yarışını bitirdim. Süremi geçebilir misin?')}”</span><span className="lbl">{t('The link opens on any device', 'Ссылка откроется где угодно', 'El enlace se abre en cualquier dispositivo', 'Der Link öffnet sich auf jedem Gerät', 'Bağlantı her cihazda açılır')}</span></figcaption>
          </figure>
        </section>

        {/* 6½ · between races: the drills */}
        <section className="ho-sec" aria-labelledby="h-more">
          <div className="ho-sec-t"><span className="ho-k">{t('Between races', 'Между гонками', 'Entre regatas', 'Zwischen den Regatten', 'Yarışlar arasında')}</span><h2 className="ho-h2" id="h-more">{t('Practise the moments.', 'Отрабатывай ключевые моменты.', 'Practica los momentos.', 'Übe die Momente.', 'Anları alıştır.')}</h2></div>
          <div className="ho-feats">
            <Link className="ho-feat ho-feat-a" href="/race/drills" data-cta="drills"><i aria-hidden="true" /><div><h3 className="ho-h3">{t(`${DRILLS.length} drills`, `Упражнений: ${DRILLS.length}`, `${DRILLS.length} ejercicios`, `${DRILLS.length} Übungen`, `${DRILLS.length} alıştırma`)}</h3><p className="ho-ps">{t('The start, the top mark, the shifts, a comeback: each a minute or two, three stars to win, from beginner to expert.', 'Старт, верхний знак, сдвиги ветра, отыгрыш: каждое на минуту-две, три звезды, от новичка до эксперта.', 'La salida, la baliza de barlovento, las roladas, una remontada: cada uno de uno o dos minutos, tres estrellas para ganar, de principiante a experto.', 'Der Start, die Luvtonne, die Dreher, ein Comeback: jede ein bis zwei Minuten, drei Sterne zu gewinnen, vom Anfänger bis zum Experten.', 'Start, rüzgârüstü şamandırası, rüzgâr dönüşleri, bir geri dönüş: her biri bir iki dakika, kazanmak için üç yıldız, acemiden uzmana.')}</p></div></Link>
          </div>
        </section>

        <Fold lang={lang}>
        {/* 7 · why it is worth it */}
        <section className="ho-sec" aria-labelledby="h-parts">
          <div className="ho-sec-t"><span className="ho-k">{t('Inside the game', 'Внутри игры', 'Dentro del juego', 'Im Spiel', 'Oyunun içinde')}</span><h2 className="ho-h2" id="h-parts">{t('Everything a real race throws at you', 'Всё, чем встречает настоящая гонка', 'Todo lo que te lanza una regata de verdad', 'Alles, was eine echte Regatta dir bietet', 'Gerçek bir yarışın sana attığı her şey')}</h2></div>
          <div className="ho-feats">
            {features.map(([title, text]) => <div className="ho-feat" key={title}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></div>)}
          </div>
          <dl className="bt-stats ho-nums">
            <div><dt className="bt-sk">{t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr')}</dt><dd><b><Num v={`${KN.light}–${KN.strong} ${t('kn', 'уз', 'kn', 'kn', 'kn')}`} /></b></dd><dd className="bt-sv">{t('From light air to a breeze you reef for', 'От лёгкого ветра до такого, что берут рифы', 'De aire flojo a una brisa que obliga a rizar', 'Von leichtem Wind bis zu einer Brise, bei der du reffst', 'Hafif havadan camadan almak gereken meltemlere')}</dd></div>
            <div><dt className="bt-sk">{t('Fleet', 'Флот', 'Flota', 'Feld', 'Filo')}</dt><dd><b><CountUp v="3 · 5 · 7" /></b></dd><dd className="bt-sv">{t('Boats on the line, every one sailing by the rules', 'Лодок на линии, и все ходят по правилам', 'Barcos en la línea, todos navegando según las reglas', 'Boote an der Linie, jedes segelt nach den Regeln', 'Hatta tekneler, her biri kurallara göre seyreder')}</dd></div>
            <div><dt className="bt-sk">{t('Shifts', 'Сдвиги', 'Roladas', 'Dreher', 'Dönüşler')}</dt><dd><b><CountUp v="10°+" /></b></dd><dd className="bt-sv">{t('Every minute. Catch them or lose places', 'Каждую минуту. Лови их или теряй места', 'Cada minuto. Pilla las buenas o pierde puestos', 'Jede Minute. Erwisch sie oder verlier Plätze', 'Her dakika. Yakala ya da sıra kaybet')}</dd></div>
          </dl>
        </section>

        {/* your race, your way: the set-up, the debrief, the screens and the views */}
        <section className="ho-sec" aria-labelledby="h-way">
          <div className="ho-sec-t"><span className="ho-k">{t('Your race, your way', 'Твоя гонка — по-твоему', 'Tu regata, a tu manera', 'Deine Regatta, auf deine Art', 'Senin yarışın, senin yolun')}</span><h2 className="ho-h2" id="h-way">{t('Set it up, sail it, read it back', 'Настрой, пройди, разбери', 'Prepárala, navégala, revísala', 'Einrichten, segeln, nachlesen', 'Kur, yarış, sonucu oku')}</h2></div>
          <div className="ho-feats ho-feats-4">
            {way.map(([title, text, href]) => <Link className="ho-feat ho-feat-a" href={href} key={title} data-cta={`way-${href}`}><i aria-hidden="true" /><div><h3 className="ho-h3">{title}</h3><p className="ho-ps">{text}</p></div></Link>)}
          </div>
        </section>

        {/* 8 · the doubts, answered where they come up */}
        <section className="ho-sec ho-split" id="faq" aria-labelledby="h-faq">
          <div className="ho-split-t ho-faq-side">
            <span className="ho-k">{t('Before you sail', 'Перед стартом', 'Antes de navegar', 'Bevor du segelst', 'Yelken açmadan önce')}</span>
            <h2 className="ho-h2" id="h-faq">{t('In short', 'Коротко', 'En resumen', 'Kurz gesagt', 'Kısaca')}</h2>
            <p className="ho-ps">{t(`The questions people ask before their first race. ${all.length - faq.length} more are on the FAQ page.`, `Вопросы, которые задают перед первой гонкой. Ещё ${all.length - faq.length} — на странице «Вопросы и ответы».`, `Las preguntas que la gente hace antes de su primera regata. Hay ${all.length - faq.length} más en la página de preguntas.`, `Die Fragen, die Leute vor ihrer ersten Regatta stellen. ${all.length - faq.length} weitere stehen auf der FAQ-Seite.`, `İlk yarıştan önce insanların sorduğu sorular. ${all.length - faq.length} tane daha SSS sayfasında.`)}</p>
            <Link className="ho-ghost" href="/faq" data-cta="faq">{t('All questions', 'Все вопросы', 'Todas las preguntas', 'Alle Fragen', 'Tüm sorular')}<IconArrow s={16} /></Link>
          </div>
          <div className="ho-faq"><FaqList items={faq} openFirst /></div>
        </section>

        {/* 9 · the rules, and where to learn them */}
        <section className="ho-sec" aria-labelledby="h-rules">
          <div className="ho-band">
            <div className="ho-band-t">
              <span className="ho-k" lang="en">Sailing Certification Test</span>
              <h2 className="ho-h2" id="h-rules">{t('Learn the rules there, race by them here', 'Учи правила там, гоняйся по ним здесь', 'Aprende las reglas allí, compite con ellas aquí', 'Lern die Regeln dort, segle hier nach ihnen', 'Kuralları orada öğren, burada onlarla yarış')}</h2>
              <p className="ho-ps">{t('Up and down comes from RYC, the team behind Sailing Certification Test, the free trainer for sailing certificate exams. The computer boats give way by the same rules the exam asks about, so every race is revision you can feel on the water.', 'Up and down делает RYC — команда, которая сделала Sailing Certification Test, бесплатный тренажёр к экзаменам на яхтенные сертификаты. Компьютерные лодки уступают по тем же правилам, что спрашивают на экзамене, так что каждая гонка — повторение, которое чувствуешь на воде.', 'Up and down viene de RYC, el equipo detrás de Sailing Certification Test, el entrenador gratuito para los exámenes de títulos náuticos. Los barcos del ordenador ceden el paso con las mismas reglas por las que pregunta el examen, así que cada regata es un repaso que se siente en el agua.', 'Up and down kommt von RYC, dem Team hinter Sailing Certification Test, dem kostenlosen Trainer für Segelscheinprüfungen. Die Computerboote weichen nach denselben Regeln aus, nach denen die Prüfung fragt, also ist jede Regatta Wiederholung, die du auf dem Wasser spürst.', 'Up and down, yelken belgesi sınavları için ücretsiz çalışma aracı Sailing Certification Test’in ekibi RYC’den gelir. Bilgisayar tekneleri sınavın sorduğu aynı kurallara göre yol verir; böylece her yarış, suda hissedebileceğin bir tekrardır.')}</p>
              <Link className="ho-ghost" href="/iyt" data-cta="iyt">{t('Sailing exam practice · 6100 questions', 'Тренажёр к яхтенному экзамену · 6100 вопросов', 'Práctica de examen náutico · 6100 preguntas', 'Segelprüfungs-Training · 6100 Fragen', 'Yelken sınavı alıştırması · 6100 soru')}<IconArrow s={16} /></Link>
            </div>
            <div className="ho-rules">
              <span className="lbl">{t('Rules you meet on the first beat', 'Правила, которые встретишь на первой лавировке', 'Reglas que encuentras en la primera ceñida', 'Regeln, denen du auf dem ersten Kreuz begegnest', 'İlk orsada karşılaşacağın kurallar')}</span>
              <ol className="hm-lb bt-lb ho-card">
                <li><span className="hm-n">10</span><span>{t('Port gives way to starboard', 'Левый галс уступает правому', 'Babor cede el paso a estribor', 'Backbord weicht Steuerbord aus', 'İskele, sancağa yol verir')}</span></li>
                <li><span className="hm-n">11</span><span>{t('Windward boat keeps clear', 'Наветренная уступает', 'El barco de barlovento se mantiene separado', 'Das Luvboot hält sich frei', 'Rüzgârüstü tekne uzak durur')}</span></li>
                <li><span className="hm-n">13</span><span>{t('A tacking boat keeps clear', 'Поворачивающая уступает', 'Un barco que vira se mantiene separado', 'Ein wendendes Boot hält sich frei', 'Tramola atan tekne uzak durur')}</span></li>
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
        <div className="ho-dock-t ho-new"><span className="hm-tag">{t('3 min', '3 мин', '3 min', '3 Min.', '3 dk')}</span><b>{t('Your first race', 'Первая гонка', 'Tu primera regata', 'Deine erste Regatta', 'İlk yarışın')}<span className="ho-dock-w">{t(' · an Optimist', ' · «Оптимист»', ' · un Optimist', ' · ein Optimist', ' · bir Optimist')}</span></b><span className="lbl">{t('then today’s race · closes in', 'потом гонка дня · закроется через', 'luego la regata del día · cierra en', 'dann die Regatta des Tages · endet in', 'sonra günün yarışı · kapanmasına')}</span><Countdown className="ho-dock-cd" /></div>
        <a className="ho-go ho-new" href={first} data-cta="dock-first"><IconPlay /><span>{t('Start your first race', 'Начать первую гонку', 'Empieza tu primera regata', 'Starte deine erste Regatta', 'İlk yarışına başla')}</span></a>
        <div className="ho-dock-t ho-old"><span className="dot-live" /><b>{beat ? <><span className="ho-dock-w">{t(`Today’s race · ${where} · `, `Гонка дня · ${where} · `, `Regata del día · ${where} · `, `Regatta des Tages · ${where} · `, `Günün yarışı · ${where} · `)}</span>{t(`beat ${beat}`, `побей ${beat}`, `bate ${beat}`, `${beat} schlagen`, `${beat} süresini geç`)}</> : t(`Today’s race · ${where}`, `Гонка дня · ${where}`, `Regata del día · ${where}`, `Regatta des Tages · ${where}`, `Günün yarışı · ${where}`)}</b><span className="lbl">{t('closes in', 'закроется через', 'cierra en', 'endet in', 'kapanmasına')}</span><Countdown className="ho-dock-cd" /></div>
        <a className="ho-go ho-old" href={go} data-cta="dock"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık')}</span></a>
      </Dock>
    </div>
  );
}
