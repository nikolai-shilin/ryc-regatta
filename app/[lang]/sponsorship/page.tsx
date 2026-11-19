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

export const generateMetadata = titled('Sponsor a sailing race game', 'Спонсорство парусной игры', 'Patrocina un juego de regatas a vela', 'Ein Segelregatta-Spiel sponsern', {
  path: '/sponsorship', card: '/og/page/sponsorship',
  description: [
    'Sponsor Up and down, the free 3D sailing race game: your logo on the jib, your words on the banner a plane tows over the course, or both.',
    'Спонсорство Up and down, бесплатной парусной 3D-гонки: ваш логотип на стакселе, ваш текст на баннере за самолётом над дистанцией или всё вместе.', 'Patrocina Up and down, el juego gratuito de regatas a vela en 3D: tu logo en el foque, tus palabras en la pancarta que remolca una avioneta sobre el recorrido, o ambos.', 'Sponsere Up and down, das kostenlose 3D-Segelregatta-Spiel: dein Logo auf der Fock, deine Worte auf dem Banner, das ein Flugzeug über die Bahn zieht, oder beides.'],
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
    [t('Name on the race marks', 'Имя на знаках', 'Tu nombre en las balizas', 'Name auf den Bahnmarken'), t('Your name on the white band round every mark the boats race to.', 'Ваше имя на белой полосе каждого знака, который огибают лодки.', 'Tu nombre en la banda blanca alrededor de cada baliza a la que navegan los barcos.', 'Dein Name auf dem weißen Band rund um jede Bahnmarke, die die Boote ansteuern.')],
    [t('Race of the day partner', 'Партнёр гонки дня', 'Socio de la regata del día', 'Partner der Regatta des Tages'), t('Your name on the day’s race and its leaderboard, on the days you choose.', 'Ваше имя на гонке дня и в её рейтинге в выбранные вами дни.', 'Tu nombre en la regata del día y en su clasificación, los días que elijas.', 'Dein Name auf der Regatta des Tages und ihrer Rangliste, an den Tagen, die du wählst.')],
    [t('Venue partner', 'Партнёр акватории', 'Socio de una sede', 'Revierpartner'), t(`Your name at one of the game’s ${VENUES.length} venues, or your own waters built as a new one, for a marina, a sailing club or a tourist board.`,
      `Ваше имя на одной из ${VENUES.length} акваторий игры или ваша акватория как новая: для марины, яхт-клуба или туристической организации.`, `Tu nombre en una de las ${VENUES.length} sedes del juego, o tus propias aguas creadas como una nueva, para una marina, un club náutico o una oficina de turismo.`, `Dein Name an einem der ${VENUES.length} Reviere des Spiels, oder dein eigenes Revier als neues gebaut, für eine Marina, einen Segelclub oder ein Tourismusbüro.`)],
    [t('Your yacht in the game', 'Ваша яхта в игре', 'Tu yate en el juego', 'Deine Yacht im Spiel'), t('Your boat modelled in 3D and added to the fleet, for a yacht builder or a class association.', 'Ваша лодка в 3D в составе флота игры: для верфи или классовой ассоциации.', 'Tu barco modelado en 3D y añadido a la flota, para un astillero o una asociación de clase.', 'Dein Boot in 3D modelliert und dem Feld hinzugefügt, für einen Yachtbauer oder einen Klassenverband.')],
    [t('Your colours on players’ boats', 'Ваши цвета на яхтах игроков', 'Tus colores en los barcos de los jugadores', 'Deine Farben auf den Booten der Spieler'), t('A ready colour scheme in your brand’s colours that players can choose for their own boat.', 'Готовая схема в цветах вашего бренда, которую игроки смогут выбрать для своей яхты.', 'Un esquema de color listo con los colores de tu marca que los jugadores pueden elegir para su propio barco.', 'Ein fertiges Farbschema in den Farben deiner Marke, das Spieler für ihr eigenes Boot wählen können.')],
    [t('Partner of the guides', 'Партнёр пособий', 'Socio de las guías', 'Partner der Anleitungen'), t(`Your name on the game’s ${GUIDES.length} guides to racing, for a sailing school or a chandlery.`, `Ваше имя на ${GUIDES.length} пособиях игры по гонкам: для парусной школы или магазина яхтенного снаряжения.`, `Tu nombre en las ${GUIDES.length} guías de regatas del juego, para una escuela de vela o una tienda náutica.`, `Dein Name auf den ${GUIDES.length} Regatta-Anleitungen des Spiels, für eine Segelschule oder einen Yachtausrüster.`)],
  ];
  const logo = t('Your logo', 'Ваш логотип', 'Tu logo', 'Dein Logo'), words = t('Your words', 'Ваш текст', 'Tus palabras', 'Deine Worte');
  const ask = t('Ask about sponsoring', 'Обсудить спонсорство', 'Pregunta por el patrocinio', 'Zum Sponsoring anfragen');
  const facts: [string, string][] = [
    [String(VENUES.length), t('Venues', 'Акваторий', 'Sedes', 'Reviere')],
    [String(YACHT_IDS.length), t('Yachts', 'Яхт', 'Yates', 'Yachten')],
    ['1', t('New race a day', 'Новая гонка в день', 'Regata nueva al día', 'Neue Regatta pro Tag')],
    ['2', t('Languages', 'Языка', 'Idiomas', 'Sprachen')],
  ];
  const steps: [string, string][] = [
    [t('Tell us what you need', 'Расскажите о задаче', 'Cuéntanos qué necesitas', 'Sag uns, was du brauchst'), t('Send the option you want and your dates.', 'Напишите, какой вариант вам подходит и на какие даты.', 'Envía la opción que quieres y tus fechas.', 'Schick die gewünschte Option und deine Termine.')],
    [t('Agree the terms', 'Согласуем условия', 'Acordamos las condiciones', 'Konditionen vereinbaren'), t('We confirm the price, the dates and what goes on show.', 'Подтвердим цену, даты и то, что появится в игре.', 'Confirmamos el precio, las fechas y lo que se muestra.', 'Wir bestätigen den Preis, die Termine und was gezeigt wird.')],
    [t('Send your artwork', 'Пришлите материалы', 'Envía tu material', 'Schick dein Artwork'), t('Your logo, words or pictures, to the specifications above.', 'Логотип, текст или изображения по требованиям выше.', 'Tu logo, palabras o imágenes, según las especificaciones de arriba.', 'Dein Logo, deine Worte oder Bilder, nach den Angaben oben.')],
    [t('Go live', 'Запуск', 'En marcha', 'Live gehen'), t('We set it up and it goes out on the agreed date.', 'Мы всё настроим и запустим в согласованный день.', 'Lo preparamos y sale en la fecha acordada.', 'Wir richten es ein, und es geht am vereinbarten Datum live.')],
  ];

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="sponsorship" />

      <header className="hm-page hm-ph sp-hero">
        <div className="sp-hero-t">
          <span className="kicker">{t('Sponsorship', 'Спонсорство', 'Patrocinio', 'Sponsoring')}</span>
          <h1 className="hm-ph-h">{t('Your brand in the race', 'Ваш бренд в гонке', 'Tu marca en la regata', 'Deine Marke in der Regatta')}</h1>
          <p className="hm-text">{t('Up and down is a free 3D sailing race game, played in the browser on phones and computers. Your logo or message appears inside the race itself: on the sails and in the sky over the course.',
            'Up and down — бесплатная парусная 3D-гонка в браузере, на телефоне и компьютере. Ваш логотип или текст появляется в самой гонке: на парусах и в небе над дистанцией.', 'Up and down es un juego gratuito de regatas a vela en 3D, que se juega en el navegador, en móviles y ordenadores. Tu logo o mensaje aparece dentro de la propia regata: en las velas y en el cielo sobre el recorrido.', 'Up and down ist ein kostenloses 3D-Segelregatta-Spiel, im Browser auf Handys und Computern gespielt. Dein Logo oder deine Botschaft erscheint in der Regatta selbst: auf den Segeln und im Himmel über der Bahn.')}</p>
          <div className="sp-acts">
            <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{ask}</span><IconArrow /></a>
            <a className="pill" href="#options"><span className="btn-t">{t('See the options', 'Посмотреть варианты', 'Ver las opciones', 'Die Optionen ansehen')}</span></a>
          </div>
        </div>
        <Shot src="/images/sp-jib-v2.jpg" tag={logo} mark={[53.7, 64.7, 9.6, 10.3]} priority sizes="(min-width: 1100px) 680px, 100vw"
          alt={t('A yacht racing in the game with a logo on her jib', 'Яхта в гонке с логотипом на стакселе', 'Un yate regateando en el juego con un logo en el foque', 'Eine Yacht, die im Spiel segelt, mit einem Logo auf der Fock')} />
        <dl className="sp-facts">
          {facts.map(([n, label]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}
        </dl>
      </header>

      <section className="hm-page hm-sec" id="options" aria-labelledby="sp-now">
        <div className="hm-sec-t">
          <span className="kicker">{t('Available now', 'Доступно сейчас', 'Disponible ahora', 'Jetzt verfügbar')}</span>
          <h2 className="hm-h2" id="sp-now">{t('Choose your place on the course', 'Выберите место на дистанции', 'Elige tu lugar en el recorrido', 'Wähle deinen Platz auf der Bahn')}</h2>
          <p className="hm-text">{t('Each place goes to one sponsor at a time. The price depends on the option and how long it runs, so ask us for a quote.',
            'Каждое место достаётся одному спонсору на время размещения. Цена зависит от варианта и срока: напишите нам, и мы её назовём.', 'Cada lugar va a un solo patrocinador a la vez. El precio depende de la opción y de cuánto dure, así que pídenos un presupuesto.', 'Jeder Platz geht jeweils an einen Sponsor. Der Preis hängt von der Option und der Laufzeit ab, frag uns also nach einem Angebot.')}</p>
        </div>
        <div className="sp-opts">
          <article className="sp-opt">
            <Shot src="/images/sp-jib-close-v2.jpg" tag={logo} mark={[47.3, 53.2, 26.6, 23.2]} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('The logo on the jib, marked', 'Логотип на стакселе, место отмечено', 'El logo en el foque, señalado', 'Das Logo auf der Fock, markiert')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Logo on the jib', 'Логотип на стакселе', 'Logo en el foque', 'Logo auf der Fock')}</h3>
              <p className="hm-text">{t('Your logo on the jib of every boat in the race, the player’s and the computer’s, from the start to the finish.',
                'Ваш логотип на стакселе каждой лодки в гонке, у игрока и у компьютерных соперников, от старта до финиша.', 'Tu logo en el foque de cada barco de la regata, el del jugador y los del ordenador, desde la salida hasta la llegada.', 'Dein Logo auf der Fock jedes Bootes in der Regatta, des Spielers und der Computerboote, vom Start bis zum Ziel.')}</p>
              <Spec rows={[
                [t('Yachts', 'Яхты', 'Yates', 'Yachten'), t(`The ${WITH_JIB} of ${YACHT_IDS.length} classes that carry a jib`, `${WITH_JIB} из ${YACHT_IDS.length} классов, у которых есть стаксель`, `Las ${WITH_JIB} de ${YACHT_IDS.length} clases que llevan foque`, `${WITH_JIB} von ${YACHT_IDS.length} Klassen führen eine Fock`)],
                [t('Size on the sail', 'Размер на парусе', 'Tamaño en la vela', 'Größe auf dem Segel'), t('Up to 2 × 1 m', 'До 2 × 1 м', 'Hasta 2 × 1 m', 'Bis zu 2 × 1 m')],
                [t('Artwork', 'Материалы', 'Material gráfico', 'Artwork'), t('PNG, JPEG, WebP or SVG, up to 2 MB', 'PNG, JPEG, WebP или SVG, до 2 МБ', 'PNG, JPEG, WebP o SVG, hasta 2 MB', 'PNG, JPEG, WebP oder SVG, bis 2 MB')],
                [t('Colours', 'Цвета', 'Colores', 'Farben'), t('Must read on both light and dark sails', 'Логотип должен читаться на светлых и тёмных парусах', 'Debe leerse tanto en velas claras como oscuras', 'Muss auf hellen und dunklen Segeln lesbar sein')],
              ]} />
            </div>
          </article>
          <article className="sp-opt">
            <Shot src="/images/sp-banner-v2.jpg" tag={words} mark={[41.4, 28.6, 38.1, 7.4]} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A light plane towing a banner over the course, the banner marked', 'Лёгкий самолёт с баннером над дистанцией, баннер отмечен', 'Una avioneta ligera remolcando una pancarta sobre el recorrido, la pancarta señalada', 'Ein Leichtflugzeug zieht ein Banner über die Bahn, das Banner markiert')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Banner over the course', 'Баннер над дистанцией', 'Pancarta sobre el recorrido', 'Banner über der Bahn')}</h3>
              <p className="hm-text">{t('A light plane tows your words across the course, side-on to the player’s view so they can be read.',
                'Лёгкий самолёт несёт ваш текст над дистанцией, бортом к игроку, чтобы его было легко прочитать.', 'Una avioneta ligera remolca tus palabras por el recorrido, de lado a la vista del jugador para que se puedan leer.', 'Ein Leichtflugzeug zieht deine Worte quer über die Bahn, seitlich zur Sicht des Spielers, damit sie lesbar sind.')}</p>
              <Spec rows={[
                [t('Seen', 'Показы', 'Visto', 'Zu sehen'), t('Every minute or two during a race', 'Каждые одну-две минуты во время гонки', 'Cada uno o dos minutos durante una regata', 'Alle ein bis zwei Minuten während einer Regatta')],
                [t('Words', 'Текст', 'Palabras', 'Worte'), t('Two parts, up to 40 characters each', 'Две части, до 40 знаков в каждой', 'Dos partes, de hasta 40 caracteres cada una', 'Zwei Teile, je bis zu 40 Zeichen')],
                [t('Colours', 'Цвета', 'Colores', 'Farben'), t('The first part navy, the second red', 'Первая часть синяя, вторая красная', 'La primera parte en azul marino, la segunda en rojo', 'Der erste Teil marineblau, der zweite rot')],
              ]} />
            </div>
          </article>
        </div>
        <article className="sp-both">
          <div>
            <h3 className="hm-h3">{t('Jib and banner together', 'Стаксель и баннер вместе', 'Foque y pancarta juntos', 'Fock und Banner zusammen')}</h3>
            <p className="hm-text">{t('You take both places, so no other sponsor appears in the race while yours runs.',
              'Оба места за вами: пока идёт размещение, других спонсоров в гонке нет.', 'Te quedas con ambos lugares, así que ningún otro patrocinador aparece en la regata mientras dure el tuyo.', 'Du nimmst beide Plätze, also erscheint in der Regatta kein anderer Sponsor, solange deiner läuft.')}</p>
          </div>
          <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{t('Ask for both', 'Узнать о пакете', 'Pide ambos', 'Beides anfragen')}</span><IconArrow /></a>
        </article>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-away">
          <div className="hm-sec-t">
            <span className="kicker">{t('Available now', 'Доступно сейчас', 'Disponible ahora', 'Jetzt verfügbar')}</span>
            <h2 className="hm-h2" id="sp-away">{t('Take your brand beyond the race', 'Ваш бренд и за пределами гонки', 'Lleva tu marca más allá de la regata', 'Trag deine Marke über die Regatta hinaus')}</h2>
            <p className="hm-text">{t('These need no change to the game, so they can start as soon as we agree the dates.', 'Для них не нужно менять игру, поэтому начать можно сразу после согласования дат.', 'Esto no requiere cambios en el juego, así que puede empezar en cuanto acordemos las fechas.', 'Dafür muss am Spiel nichts geändert werden, also können sie starten, sobald wir die Termine vereinbaren.')}</p>
          </div>
          <div className="sp-opts">
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('Post on our Telegram channel', 'Пост в нашем Telegram-канале', 'Publicación en nuestro canal de Telegram', 'Beitrag in unserem Telegram-Kanal')}</h3>
                <p className="hm-text">{t(`A post about your brand on ${channel.handle}, where we share the game’s news, the day’s best races and the racing rules.`,
                  `Пост о вашем бренде в ${channel.handle}, где мы публикуем новости игры, лучшие гонки дня и разборы гоночных правил.`, `Una publicación sobre tu marca en ${channel.handle}, donde compartimos las novedades del juego, las mejores regatas del día y las reglas de regatas.`, `Ein Beitrag über deine Marke auf ${channel.handle}, wo wir die Neuigkeiten des Spiels, die besten Regatten des Tages und die Wettfahrtregeln teilen.`)}</p>
                <Spec rows={[
                  [t('Language', 'Язык', 'Idioma', 'Sprache'), t('Russian', 'Русский', 'Ruso', 'Russisch')],
                  [t('You send', 'От вас', 'Tú envías', 'Du schickst'), t('Your text, a picture and a link', 'Текст, изображение и ссылка', 'Tu texto, una imagen y un enlace', 'Deinen Text, ein Bild und einen Link')],
                  [t('Shown as', 'Формат', 'Se muestra como', 'Gezeigt als'), t('Marked as an advertisement', 'С пометкой «реклама»', 'Marcado como publicidad', 'Als Werbung gekennzeichnet')],
                ]} />
              </div>
            </article>
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('A race film with your brand', 'Фильм о гонке с вашим брендом', 'Un vídeo de regata con tu marca', 'Ein Regattafilm mit deiner Marke')}</h3>
                <p className="hm-text">{t('A short film of a race in the game, with your logo on the jibs and your words on the plane’s banner, for your own channels.',
                  'Короткий фильм о гонке в игре с вашим логотипом на стакселях и вашим текстом на баннере самолёта для ваших каналов.', 'Un vídeo corto de una regata del juego, con tu logo en los foques y tus palabras en la pancarta de la avioneta, para tus propios canales.', 'Ein kurzer Film einer Regatta im Spiel, mit deinem Logo auf den Focks und deinen Worten auf dem Banner des Flugzeugs, für deine eigenen Kanäle.')}</p>
                <Spec rows={[
                  [t('Race', 'Гонка', 'Regata', 'Regatta'), t('The venue and yacht you choose', 'Акватория и яхта на ваш выбор', 'La sede y el yate que elijas', 'Das Revier und die Yacht, die du wählst')],
                  [t('Formats', 'Форматы', 'Formatos', 'Formate'), t('Vertical for stories, 4:5 for feeds, widescreen for YouTube', 'Вертикальный для сторис, 4:5 для лент, широкий для YouTube', 'Vertical para stories, 4:5 para feeds, panorámico para YouTube', 'Hochformat für Stories, 4:5 für Feeds, Breitbild für YouTube')],
                  [t('Languages', 'Языки', 'Idiomas', 'Sprachen'), t('English and Russian', 'Английский и русский', 'Inglés y ruso', 'Englisch und Russisch')],
                ]} />
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="hm-page hm-sec" aria-labelledby="sp-made">
        <div className="hm-sec-t">
          <span className="kicker">{t('Made to order', 'На заказ', 'A medida', 'Auf Bestellung')}</span>
          <h2 className="hm-h2" id="sp-made">{t('Something built for you', 'Сделаем под вас', 'Algo hecho para ti', 'Etwas, das für dich gebaut wird')}</h2>
          <p className="hm-text">{t('These need work in the game first, so we agree the timing with you.', 'Для них нужно доработать игру, поэтому сроки согласуем с вами.', 'Esto requiere trabajo previo en el juego, así que acordamos los plazos contigo.', 'Dafür ist zuerst Arbeit im Spiel nötig, also stimmen wir den Zeitplan mit dir ab.')}</p>
        </div>
        <ul className="sp-made">
          {made.map(([title, text]) => <li key={title}><h3 className="hm-h3">{title}</h3><p className="hm-text">{text}</p></li>)}
        </ul>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-how">
          <div className="hm-sec-t">
            <span className="kicker">{t('How it works', 'Как это устроено', 'Cómo funciona', 'So funktioniert es')}</span>
            <h2 className="hm-h2" id="sp-how">{t('From first message to the start line', 'От первого сообщения до старта', 'Del primer mensaje a la línea de salida', 'Von der ersten Nachricht bis zur Startlinie')}</h2>
          </div>
          <ol className="rd-cells">
            {steps.map(([title, text], i) => <li key={title}><span className="lbl">{i + 1}</span><b>{title}</b><p>{text}</p></li>)}
          </ol>
        </section>
      </div>

      <section className="hm-page hm-sec sp-end" aria-labelledby="sp-talk">
        <div className="hm-sec-t">
          <span className="kicker">{t('Get in touch', 'Связаться', 'Ponte en contacto', 'Kontakt aufnehmen')}</span>
          <h2 className="hm-h2" id="sp-talk">{t('Tell us what you have in mind', 'Расскажите, что вы задумали', 'Cuéntanos qué tienes en mente', 'Sag uns, was du vorhast')}</h2>
          <p className="hm-text">{t('Write to us on Telegram for prices, free dates and current audience figures.', 'Напишите нам в Telegram: расскажем о ценах, свободных датах и текущей аудитории.', 'Escríbenos por Telegram para precios, fechas libres y cifras de audiencia actuales.', 'Schreib uns auf Telegram für Preise, freie Termine und aktuelle Reichweitenzahlen.')}</p>
        </div>
        <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><AppMark app="telegram" s={22} /><span className="btn-t">{CONTACT.handle}</span></a>
      </section>

      <SiteFoot lang={lang} t={t} back="/sponsorship" />
    </div>
  );
}
