import Image from 'next/image';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { VENUES } from '@/lib/venues';
import { YACHT_IDS } from '@/lib/yachts';
import { GUIDES } from '@/lib/guides';
import { CHANNELS } from '@/lib/social';
import { IconArrow } from '@/components/ui';
import { AppMark } from '@/components/app-marks';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { READING_VIEWPORT } from '@/lib/no-zoom';
import '@/styles/sponsorship.css';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Sponsor a sailing race game', 'Спонсорство парусной игры', {
  path: '/sponsorship', card: '/og/page/sponsorship',
  description: [
    'Sponsor Up and down, the free 3D sailing race game: your logo on the jib, your words on the banner a plane tows over the course, or both.',
    'Спонсорство Up and down, бесплатной парусной 3D-гонки: ваш логотип на стакселе, ваш текст на баннере за самолётом над дистанцией или всё вместе.'],
});

// where a sponsor writes: the racing contact rycsailing.com/contacts lists
const CONTACT = { handle: '@fullcrimp', url: 'https://t.me/fullcrimp' };
// the Laser and the Optimist sail with no jib (public/game/classes.js jib: false), so they carry no logo
const WITH_JIB = YACHT_IDS.filter((y) => y !== 'laser' && y !== 'optimist').length;

// A picture of the game with the ad's place marked on it. mark: left, top, width and height, in % of the picture.
function Shot({ src, alt, tag, mark, sizes, priority }: { src: string; alt: string; tag: string; mark: [number, number, number, number]; sizes: string; priority?: boolean }) {
  const [left, top, width, height] = mark;
  return (
    <figure className="sp-shot">
      <Image src={src} width={1600} height={1000} sizes={sizes} alt={alt} priority={priority} />
      <span className="sp-mark" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} aria-hidden="true"><span className="sp-tag">{tag}</span></span>
    </figure>
  );
}

function Spec({ rows }: { rows: [label: string, value: string][] }) {
  return <dl className="sp-spec">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

// What can be sponsored: the two places the game already has (the jib's logo and the plane's banner, both set on /admin
// and served by /sponsor), the two together, what reaches people away from the race (a post on the game's channel, a film
// of a race) and what would have to be built first. No prices: they're agreed by message.
export default async function Sponsorship({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const channel = CHANNELS[0];
  const made: [title: string, text: string][] = [
    [t('Name on the race marks', 'Имя на знаках'), t('Your name on the white band round every mark the boats race to.', 'Ваше имя на белой полосе каждого знака, который огибают лодки.')],
    [t('Race of the day partner', 'Партнёр гонки дня'), t('Your name on the day’s race and its rating, on the days you choose.', 'Ваше имя на гонке дня и в её рейтинге в выбранные вами дни.')],
    [t('Venue partner', 'Партнёр акватории'), t(`Your name at one of the game’s ${VENUES.length} venues, or your own waters built as a new one, for a marina, a sailing club or a tourist board.`,
      `Ваше имя на одной из ${VENUES.length} акваторий игры или ваша акватория как новая: для марины, яхт-клуба или туристической организации.`)],
    [t('Your yacht in the game', 'Ваша яхта в игре'), t('Your boat modelled in 3D and added to the fleet, for a yacht builder or a class association.', 'Ваша лодка в 3D в составе флота игры: для верфи или классовой ассоциации.')],
    [t('Your colours on players’ boats', 'Ваши цвета на яхтах игроков'), t('A ready colour scheme in your brand’s colours that players can choose for their own boat.', 'Готовая схема в цветах вашего бренда, которую игроки смогут выбрать для своей яхты.')],
    [t('Partner of the guides', 'Партнёр пособий'), t(`Your name on the game’s ${GUIDES.length} guides to racing, for a sailing school or a chandlery.`, `Ваше имя на ${GUIDES.length} пособиях игры по гонкам: для парусной школы или магазина яхтенного снаряжения.`)],
  ];
  const logo = t('Your logo', 'Ваш логотип'), words = t('Your words', 'Ваш текст');
  const ask = t('Ask about sponsoring', 'Обсудить спонсорство');
  const facts: [string, string][] = [
    [String(VENUES.length), t('Venues', 'Акваторий')],
    [String(YACHT_IDS.length), t('Yachts', 'Яхт')],
    ['1', t('New race a day', 'Новая гонка в день')],
    ['2', t('Languages', 'Языка')],
  ];
  const steps: [string, string][] = [
    [t('Tell us what you need', 'Расскажите о задаче'), t('Send the option you want and your dates.', 'Напишите, какой вариант вам подходит и на какие даты.')],
    [t('Agree the terms', 'Согласуем условия'), t('We confirm the price, the dates and what goes on show.', 'Подтвердим цену, даты и то, что появится в игре.')],
    [t('Send your artwork', 'Пришлите материалы'), t('Your logo, words or pictures, to the specifications above.', 'Логотип, текст или изображения по требованиям выше.')],
    [t('Go live', 'Запуск'), t('We set it up and it goes out on the agreed date.', 'Мы всё настроим и запустим в согласованный день.')],
  ];

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="sponsorship" />

      <header className="hm-page hm-ph sp-hero">
        <div className="sp-hero-t">
          <span className="kicker">{t('Sponsorship', 'Спонсорство')}</span>
          <h1 className="hm-ph-h">{t('Your brand in the race', 'Ваш бренд в гонке')}</h1>
          <p className="hm-text">{t('Up and down is a free 3D sailing race game, played in the browser on phones and computers. Your logo or message appears inside the race itself: on the sails and in the sky over the course.',
            'Up and down — бесплатная парусная 3D-гонка в браузере, на телефоне и компьютере. Ваш логотип или текст появляется в самой гонке: на парусах и в небе над дистанцией.')}</p>
          <div className="sp-acts">
            <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{ask}</span><IconArrow /></a>
            <a className="pill" href="#options"><span className="btn-t">{t('See the options', 'Посмотреть варианты')}</span></a>
          </div>
        </div>
        <Shot src="/images/sp-jib-v1.jpg" tag={logo} mark={[32, 43.5, 9.4, 8.6]} priority sizes="(min-width: 1100px) 680px, 100vw"
          alt={t('A yacht racing in the game with a logo on her jib', 'Яхта в гонке с логотипом на стакселе')} />
        <dl className="sp-facts">
          {facts.map(([n, label]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}
        </dl>
      </header>

      <section className="hm-page hm-sec" id="options" aria-labelledby="sp-now">
        <div className="hm-sec-t">
          <span className="kicker">{t('Available now', 'Доступно сейчас')}</span>
          <h2 className="hm-h2" id="sp-now">{t('Choose your place on the course', 'Выберите место на дистанции')}</h2>
          <p className="hm-text">{t('Each place goes to one sponsor at a time. The price depends on the option and how long it runs, so ask us for a quote.',
            'Каждое место достаётся одному спонсору на время размещения. Цена зависит от варианта и срока: напишите нам, и мы её назовём.')}</p>
        </div>
        <div className="sp-opts">
          <article className="sp-opt">
            <Shot src="/images/sp-jib-close-v1.jpg" tag={logo} mark={[35.2, 51, 18.8, 17.2]} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('The logo on the jib, marked', 'Логотип на стакселе, место отмечено')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Logo on the jib', 'Логотип на стакселе')}</h3>
              <p className="hm-text">{t('Your logo on the jib of every boat in the race, the player’s and the computer’s, from the start to the finish.',
                'Ваш логотип на стакселе каждой лодки в гонке, у игрока и у компьютерных соперников, от старта до финиша.')}</p>
              <Spec rows={[
                [t('Yachts', 'Яхты'), t(`The ${WITH_JIB} of ${YACHT_IDS.length} classes that carry a jib`, `${WITH_JIB} из ${YACHT_IDS.length} классов, у которых есть стаксель`)],
                [t('Size on the sail', 'Размер на парусе'), t('Up to 2 × 1 m', 'До 2 × 1 м')],
                [t('Artwork', 'Материалы'), t('PNG, JPEG, WebP or SVG, up to 2 MB', 'PNG, JPEG, WebP или SVG, до 2 МБ')],
                [t('Colours', 'Цвета'), t('Must read on both light and dark sails', 'Логотип должен читаться на светлых и тёмных парусах')],
              ]} />
            </div>
          </article>
          <article className="sp-opt">
            <Shot src="/images/sp-banner-v1.jpg" tag={words} mark={[47.6, 38.4, 44.2, 7]} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A light plane towing a banner over the course, the banner marked', 'Лёгкий самолёт с баннером над дистанцией, баннер отмечен')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Banner over the course', 'Баннер над дистанцией')}</h3>
              <p className="hm-text">{t('A light plane tows your words across the course, side-on to the player’s view so they can be read.',
                'Лёгкий самолёт несёт ваш текст над дистанцией, бортом к игроку, чтобы его было легко прочитать.')}</p>
              <Spec rows={[
                [t('Seen', 'Показы'), t('Every minute or two during a race', 'Каждые одну-две минуты во время гонки')],
                [t('Words', 'Текст'), t('Two parts, up to 40 characters each', 'Две части, до 40 знаков в каждой')],
                [t('Colours', 'Цвета'), t('The first part navy, the second red', 'Первая часть синяя, вторая красная')],
              ]} />
            </div>
          </article>
        </div>
        <article className="sp-both">
          <div>
            <h3 className="hm-h3">{t('Jib and banner together', 'Стаксель и баннер вместе')}</h3>
            <p className="hm-text">{t('You take both places, so no other sponsor appears in the race while yours runs.',
              'Оба места за вами: пока идёт размещение, других спонсоров в гонке нет.')}</p>
          </div>
          <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{t('Ask for both', 'Узнать о пакете')}</span><IconArrow /></a>
        </article>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-away">
          <div className="hm-sec-t">
            <span className="kicker">{t('Available now', 'Доступно сейчас')}</span>
            <h2 className="hm-h2" id="sp-away">{t('Take your brand beyond the race', 'Ваш бренд и за пределами гонки')}</h2>
            <p className="hm-text">{t('These need no change to the game, so they can start as soon as we agree the dates.', 'Для них не нужно менять игру, поэтому начать можно сразу после согласования дат.')}</p>
          </div>
          <div className="sp-opts">
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('Post on our Telegram channel', 'Пост в нашем Telegram-канале')}</h3>
                <p className="hm-text">{t(`A post about your brand on ${channel.handle}, where we share the game’s news, the day’s best races and the racing rules.`,
                  `Пост о вашем бренде в ${channel.handle}, где мы публикуем новости игры, лучшие гонки дня и разборы гоночных правил.`)}</p>
                <Spec rows={[
                  [t('Language', 'Язык'), t('Russian', 'Русский')],
                  [t('You send', 'От вас'), t('Your text, a picture and a link', 'Текст, изображение и ссылка')],
                  [t('Shown as', 'Формат'), t('Marked as an advertisement', 'С пометкой «реклама»')],
                ]} />
              </div>
            </article>
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('A race film with your brand', 'Фильм о гонке с вашим брендом')}</h3>
                <p className="hm-text">{t('A short film of a race in the game, with your logo on the jibs and your words on the plane’s banner, for your own channels.',
                  'Короткий фильм о гонке в игре с вашим логотипом на стакселях и вашим текстом на баннере самолёта для ваших каналов.')}</p>
                <Spec rows={[
                  [t('Race', 'Гонка'), t('The venue and yacht you choose', 'Акватория и яхта на ваш выбор')],
                  [t('Formats', 'Форматы'), t('Vertical for stories, 4:5 for feeds, widescreen for YouTube', 'Вертикальный для сторис, 4:5 для лент, широкий для YouTube')],
                  [t('Languages', 'Языки'), t('English and Russian', 'Английский и русский')],
                ]} />
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="hm-page hm-sec" aria-labelledby="sp-made">
        <div className="hm-sec-t">
          <span className="kicker">{t('Made to order', 'На заказ')}</span>
          <h2 className="hm-h2" id="sp-made">{t('Something built for you', 'Сделаем под вас')}</h2>
          <p className="hm-text">{t('These need work in the game first, so we agree the timing with you.', 'Для них нужно доработать игру, поэтому сроки согласуем с вами.')}</p>
        </div>
        <ul className="sp-made">
          {made.map(([title, text]) => <li key={title}><h3 className="hm-h3">{title}</h3><p className="hm-text">{text}</p></li>)}
        </ul>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-how">
          <div className="hm-sec-t">
            <span className="kicker">{t('How it works', 'Как это устроено')}</span>
            <h2 className="hm-h2" id="sp-how">{t('From first message to the start line', 'От первого сообщения до старта')}</h2>
          </div>
          <ol className="rd-cells">
            {steps.map(([title, text], i) => <li key={title}><span className="lbl">{i + 1}</span><b>{title}</b><p>{text}</p></li>)}
          </ol>
        </section>
      </div>

      <section className="hm-page hm-sec sp-end" aria-labelledby="sp-talk">
        <div className="hm-sec-t">
          <span className="kicker">{t('Get in touch', 'Связаться')}</span>
          <h2 className="hm-h2" id="sp-talk">{t('Tell us what you have in mind', 'Расскажите, что вы задумали')}</h2>
          <p className="hm-text">{t('Write to us on Telegram for prices, free dates and current audience figures.', 'Напишите нам в Telegram: расскажем о ценах, свободных датах и текущей аудитории.')}</p>
        </div>
        <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><AppMark app="telegram" s={22} /><span className="btn-t">{CONTACT.handle}</span></a>
      </section>

      <SiteFoot lang={lang} t={t} back="/sponsorship" />
    </div>
  );
}
