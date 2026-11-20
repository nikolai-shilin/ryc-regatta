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

export const generateMetadata = titled('Sponsor a sailing race game', 'Спонсорство парусной игры', 'Patrocina un juego de regatas a vela', 'Ein Segelregatta-Spiel sponsern', 'Bir yelken yarışı oyununa sponsor ol', 'Sponsoriser un jeu de régate à la voile', {
  path: '/sponsorship', card: '/og/page/sponsorship',
  description: [
    'Sponsor Up and down, the free 3D sailing race game: your banner over the whole jib, your logo on the mainsail and the gennaker, your words on the banner a plane tows over the course, at every venue or the ones you choose.',
    'Спонсорство Up and down, бесплатной парусной 3D-гонки: ваш баннер на весь стаксель, логотип на гроте и генакере, текст на баннере за самолётом над дистанцией — на всех акваториях или на выбранных.', 'Patrocina Up and down, el juego gratuito de regatas a vela en 3D: tu pancarta en todo el foque, tu logo en la mayor y el gennaker, tus palabras en la pancarta que remolca una avioneta sobre el recorrido, en todas las sedes o en las que elijas.', 'Sponsere Up and down, das kostenlose 3D-Segelregatta-Spiel: dein Banner über die ganze Fock, dein Logo auf Großsegel und Gennaker, deine Worte auf dem Banner, das ein Flugzeug über die Bahn zieht, in allen Revieren oder in denen, die du wählst.', 'Ücretsiz 3D yelken yarışı oyunu Up and down’a sponsor ol: pankartın bütün flokta, logon ana yelkende ve balonda, sözlerin parkurun üstünde bir uçağın çektiği pankartta, tüm yarış alanlarında ya da seçtiklerinde.', 'Sponsorise Up and down, le jeu de régate à la voile en 3D gratuit : ta bannière sur tout le foc, ton logo sur la grand-voile et le gennaker, ton message sur la banderole qu’un avion remorque au-dessus du parcours, sur tous les plans d’eau ou ceux que tu choisis.'],
});

// where a sponsor writes: the racing contact rycsailing.com/contacts lists
const CONTACT = { handle: '@fullcrimp', url: 'https://t.me/fullcrimp' };
// the Laser and the Optimist sail with no jib (public/game/classes.js jib: false), so they carry no jib's ad; nor they and
// the AC75 a gennaker or spinnaker (kite: false), so no logo there
const WITH_JIB = YACHT_IDS.filter((y) => y !== 'laser' && y !== 'optimist').length;
const WITH_KITE = YACHT_IDS.filter((y) => y !== 'laser' && y !== 'optimist' && y !== 'ac75').length;
// where each ad is in its picture: left, top, width and height in % (the words on the jib, the logo on the main, her
// gennaker)
const MARKS: Record<'jib' | 'main' | 'kite', [number, number, number, number]> = {
  jib: [51, 21, 16, 57], main: [46, 39, 17, 23], kite: [50.1, 20.9, 24.6, 67.2],
};

// A picture of the game, with the ad's place marked on it (mark: left, top, width and height, in % of the picture), or
// with none where the whole picture is the ad
function Shot({ src, alt, tag, mark, sizes, priority }: { src: string; alt: string; tag?: string; mark?: [number, number, number, number]; sizes: string; priority?: boolean }) {
  return (
    <figure className="sp-shot">
      <Image src={src} width={1600} height={1000} sizes={sizes} alt={alt} priority={priority} />
      {mark && <span className="sp-mark" style={{ left: `${mark[0]}%`, top: `${mark[1]}%`, width: `${mark[2]}%`, height: `${mark[3]}%` }} aria-hidden="true"><span className="sp-tag">{tag}</span></span>}
    </figure>
  );
}

function Spec({ rows }: { rows: [label: string, value: string][] }) {
  return <dl className="sp-spec">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

// What can be sponsored: the places the game already has (the jib's banner, the mainsail's and the gennaker's logo, set
// on /admin/sails for every venue or a set of them, and the plane's banner, on /admin/ads, all served by /sponsor), all of
// them together, what reaches people away from the race (a post on the game's channel, a film
// of a race) and what would have to be built first. No prices: they're agreed by message.
export default async function Sponsorship({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const channel = CHANNELS[0];
  const made: [title: string, text: string][] = [
    [t('Name on the race marks', 'Имя на знаках', 'Tu nombre en las balizas', 'Name auf den Bahnmarken', 'Yarış şamandıralarında adın', 'Ton nom sur les bouées'), t('Your name on the white band round every mark the boats race to.', 'Ваше имя на белой полосе каждого знака, который огибают лодки.', 'Tu nombre en la banda blanca alrededor de cada baliza a la que navegan los barcos.', 'Dein Name auf dem weißen Band rund um jede Bahnmarke, die die Boote ansteuern.', 'Teknelerin yarıştığı her şamandıranın etrafındaki beyaz bantta adın.', 'Ton nom sur la bande blanche autour de chaque bouée que les bateaux contournent.')],
    [t('Race of the day partner', 'Партнёр гонки дня', 'Socio de la regata del día', 'Partner der Regatta des Tages', 'Günün yarışı ortağı', 'Partenaire de la régate du jour'), t('Your name on the day’s race and its leaderboard, on the days you choose.', 'Ваше имя на гонке дня и в её рейтинге в выбранные вами дни.', 'Tu nombre en la regata del día y en su clasificación, los días que elijas.', 'Dein Name auf der Regatta des Tages und ihrer Rangliste, an den Tagen, die du wählst.', 'Seçtiğin günlerde, günün yarışında ve sıralamasında adın.', 'Ton nom sur la régate du jour et son classement, les jours que tu choisis.')],
    [t('Venue partner', 'Партнёр акватории', 'Socio de una sede', 'Revierpartner', 'Yarış alanı ortağı', 'Partenaire d’un plan d’eau'), t(`Your name at one of the game’s ${VENUES.length} venues, or your own waters built as a new one, for a marina, a sailing club or a tourist board.`,
      `Ваше имя на одной из ${VENUES.length} акваторий игры или ваша акватория как новая: для марины, яхт-клуба или туристической организации.`, `Tu nombre en una de las ${VENUES.length} sedes del juego, o tus propias aguas creadas como una nueva, para una marina, un club náutico o una oficina de turismo.`, `Dein Name an einem der ${VENUES.length} Reviere des Spiels, oder dein eigenes Revier als neues gebaut, für eine Marina, einen Segelclub oder ein Tourismusbüro.`, `Oyunun ${VENUES.length} yarış alanından birinde adın ya da kendi suların yeni bir alan olarak kurulur; bir marina, yelken kulübü ya da turizm kurulu için.`, `Ton nom sur l’un des ${VENUES.length} plans d’eau du jeu, ou tes propres eaux recréées comme un nouveau plan d’eau, pour une marina, un club de voile ou un office de tourisme.`)],
    [t('Your yacht in the game', 'Ваша яхта в игре', 'Tu yate en el juego', 'Deine Yacht im Spiel', 'Oyunda yatın', 'Ton yacht dans le jeu'), t('Your boat modelled in 3D and added to the fleet, for a yacht builder or a class association.', 'Ваша лодка в 3D в составе флота игры: для верфи или классовой ассоциации.', 'Tu barco modelado en 3D y añadido a la flota, para un astillero o una asociación de clase.', 'Dein Boot in 3D modelliert und dem Feld hinzugefügt, für einen Yachtbauer oder einen Klassenverband.', 'Teknen 3D modellenip filoya eklenir; bir yat üreticisi ya da sınıf birliği için.', 'Ton bateau modélisé en 3D et ajouté à la flotte, pour un chantier naval ou une association de classe.')],
    [t('Your colours on players’ boats', 'Ваши цвета на яхтах игроков', 'Tus colores en los barcos de los jugadores', 'Deine Farben auf den Booten der Spieler', 'Renklerin oyuncuların teknelerinde', 'Tes couleurs sur les bateaux des joueurs'), t('A ready colour scheme in your brand’s colours that players can choose for their own boat.', 'Готовая схема в цветах вашего бренда, которую игроки смогут выбрать для своей яхты.', 'Un esquema de color listo con los colores de tu marca que los jugadores pueden elegir para su propio barco.', 'Ein fertiges Farbschema in den Farben deiner Marke, das Spieler für ihr eigenes Boot wählen können.', 'Markanın renklerinde, oyuncuların kendi tekneleri için seçebileceği hazır bir renk düzeni.', 'Une décoration prête à l’emploi aux couleurs de ta marque, que les joueurs peuvent choisir pour leur propre bateau.')],
    [t('Partner of the guides', 'Партнёр пособий', 'Socio de las guías', 'Partner der Anleitungen', 'Rehberlerin ortağı', 'Partenaire des guides'), t(`Your name on the game’s ${GUIDES.length} guides to racing, for a sailing school or a chandlery.`, `Ваше имя на ${GUIDES.length} пособиях игры по гонкам: для парусной школы или магазина яхтенного снаряжения.`, `Tu nombre en las ${GUIDES.length} guías de regatas del juego, para una escuela de vela o una tienda náutica.`, `Dein Name auf den ${GUIDES.length} Regatta-Anleitungen des Spiels, für eine Segelschule oder einen Yachtausrüster.`, `Oyunun ${GUIDES.length} yarış rehberinde adın, bir yelken okulu ya da denizcilik malzemecisi için.`, `Ton nom sur les ${GUIDES.length} guides de régate du jeu, pour une école de voile ou un shipchandler.`)],
  ];
  const logo = t('Your logo', 'Ваш логотип', 'Tu logo', 'Dein Logo', 'Logon', 'Ton logo'), words = t('Your words', 'Ваш текст', 'Tus palabras', 'Deine Worte', 'Sözlerin', 'Ton message'), ad = t('Your banner', 'Ваш баннер', 'Tu pancarta', 'Dein Banner', 'Pankartın', 'Ta bannière');
  const artwork: [string, string] = [t('Artwork', 'Материалы', 'Material gráfico', 'Artwork', 'Tasarım', 'Visuels'), t('PNG, JPEG, WebP or SVG, up to 2 MB', 'PNG, JPEG, WebP или SVG, до 2 МБ', 'PNG, JPEG, WebP o SVG, hasta 2 MB', 'PNG, JPEG, WebP oder SVG, bis 2 MB', 'PNG, JPEG, WebP ya da SVG, en çok 2 MB', 'PNG, JPEG, WebP ou SVG, jusqu’à 2 Mo')];
  const ask = t('Ask about sponsoring', 'Обсудить спонсорство', 'Pregunta por el patrocinio', 'Zum Sponsoring anfragen', 'Sponsorluk hakkında sor', 'Se renseigner sur le sponsoring');
  const facts: [string, string][] = [
    [String(VENUES.length), t('Venues', 'Акваторий', 'Sedes', 'Reviere', 'Yarış alanları', 'Plans d’eau')],
    [String(YACHT_IDS.length), t('Yachts', 'Яхт', 'Yates', 'Yachten', 'Yatlar', 'Yachts')],
    ['1', t('New race a day', 'Новая гонка в день', 'Regata nueva al día', 'Neue Regatta pro Tag', 'Günde yeni yarış', 'Une nouvelle régate par jour')],
    ['2', t('Languages', 'Языка', 'Idiomas', 'Sprachen', 'Diller', 'Langues')],
  ];
  const steps: [string, string][] = [
    [t('Tell us what you need', 'Расскажите о задаче', 'Cuéntanos qué necesitas', 'Sag uns, was du brauchst', 'Neye ihtiyacın olduğunu söyle', 'Dis-nous ce qu’il te faut'), t('Send the option you want and your dates.', 'Напишите, какой вариант вам подходит и на какие даты.', 'Envía la opción que quieres y tus fechas.', 'Schick die gewünschte Option und deine Termine.', 'İstediğin seçeneği ve tarihlerini gönder.', 'Envoie l’option que tu veux et tes dates.')],
    [t('Agree the terms', 'Согласуем условия', 'Acordamos las condiciones', 'Konditionen vereinbaren', 'Koşulları kararlaştıralım', 'Fixons les conditions'), t('We confirm the price, the dates and what goes on show.', 'Подтвердим цену, даты и то, что появится в игре.', 'Confirmamos el precio, las fechas y lo que se muestra.', 'Wir bestätigen den Preis, die Termine und was gezeigt wird.', 'Fiyatı, tarihleri ve nelerin gösterileceğini onaylarız.', 'Nous confirmons le prix, les dates et ce qui sera affiché.')],
    [t('Send your artwork', 'Пришлите материалы', 'Envía tu material', 'Schick dein Artwork', 'Tasarımını gönder', 'Envoie tes visuels'), t('Your logo, words or pictures, to the specifications above.', 'Логотип, текст или изображения по требованиям выше.', 'Tu logo, palabras o imágenes, según las especificaciones de arriba.', 'Dein Logo, deine Worte oder Bilder, nach den Angaben oben.', 'Logon, sözlerin ya da resimlerin, yukarıdaki özelliklere uygun.', 'Ton logo, ton message ou tes images, selon les spécifications ci-dessus.')],
    [t('Go live', 'Запуск', 'En marcha', 'Live gehen', 'Yayına geç', 'Mise en ligne'), t('We set it up and it goes out on the agreed date.', 'Мы всё настроим и запустим в согласованный день.', 'Lo preparamos y sale en la fecha acordada.', 'Wir richten es ein, und es geht am vereinbarten Datum live.', 'Kurarız ve kararlaştırılan tarihte yayına çıkar.', 'Nous mettons tout en place et c’est en ligne à la date convenue.')],
  ];

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="sponsorship" />

      <header className="hm-page hm-ph sp-hero">
        <div className="sp-hero-t">
          <span className="kicker">{t('Sponsorship', 'Спонсорство', 'Patrocinio', 'Sponsoring', 'Sponsorluk', 'Sponsoring')}</span>
          <h1 className="hm-ph-h">{t('Your brand in the race', 'Ваш бренд в гонке', 'Tu marca en la regata', 'Deine Marke in der Regatta', 'Markan yarışta', 'Ta marque dans la régate')}</h1>
          <p className="hm-text">{t('Up and down is a free 3D sailing race game, played in the browser on phones and computers. Your logo or message appears inside the race itself: on the sails and in the sky over the course.',
            'Up and down — бесплатная парусная 3D-гонка в браузере, на телефоне и компьютере. Ваш логотип или текст появляется в самой гонке: на парусах и в небе над дистанцией.', 'Up and down es un juego gratuito de regatas a vela en 3D, que se juega en el navegador, en móviles y ordenadores. Tu logo o mensaje aparece dentro de la propia regata: en las velas y en el cielo sobre el recorrido.', 'Up and down ist ein kostenloses 3D-Segelregatta-Spiel, im Browser auf Handys und Computern gespielt. Dein Logo oder deine Botschaft erscheint in der Regatta selbst: auf den Segeln und im Himmel über der Bahn.', 'Up and down, tarayıcıda telefonlarda ve bilgisayarlarda oynanan ücretsiz bir 3D yelken yarışı oyunudur. Logon ya da mesajın yarışın içinde görünür: yelkenlerde ve parkurun üstündeki gökyüzünde.', 'Up and down est un jeu de régate à la voile en 3D gratuit, qui se joue dans le navigateur, sur téléphone comme sur ordinateur. Ton logo ou ton message apparaît au cœur même de la régate : sur les voiles et dans le ciel au-dessus du parcours.')}</p>
          <div className="sp-acts">
            <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{ask}</span><IconArrow /></a>
            <a className="pill" href="#options"><span className="btn-t">{t('See the options', 'Посмотреть варианты', 'Ver las opciones', 'Die Optionen ansehen', 'Seçenekleri gör', 'Voir les options')}</span></a>
          </div>
        </div>
        <Shot src="/images/sp-pack-v1.jpg" priority sizes="(min-width: 1100px) 680px, 100vw"
          alt={t('A race in the game at Göcek: at the windward mark one yacht bears away under her red gennaker across the bow of another still beating up, her crew hiking, with the jib’s banner and the logo on the mainsails', 'Гонка в игре у Гёджека: у верхнего знака одна яхта уваливается под красным генакером прямо перед носом другой, которая ещё идёт в лавировку, экипаж на борту; баннер на стакселе и логотип на гротах', 'Una regata en el juego en Göcek: en la baliza de barlovento un yate arriba bajo su gennaker rojo por la proa de otro que aún ciñe con la tripulación sacando el cuerpo, con la pancarta del foque y el logo en las mayores', 'Eine Regatta im Spiel vor Göcek: an der Luvtonne fällt eine Yacht unter ihrem roten Gennaker vor dem Bug einer anderen ab, die noch kreuzt, die Crew im Ausreiten, mit dem Banner auf der Fock und dem Logo auf den Großsegeln', 'Oyunda Göcek’te bir yarış: rüzgâr üstü şamandırasında bir yat kırmızı balonuyla, mürettebatı küpeştede hâlâ orsada giden başka bir yatın pruvasından geçerek kırıyor; flokta pankart, ana yelkenlerde logo', 'Une régate dans le jeu à Göcek : à la bouée au vent, un yacht abat sous son gennaker rouge devant l’étrave d’un autre encore au près, son équipage au rappel, avec la bannière du foc et le logo sur les grand-voiles')} />
        <dl className="sp-facts">
          {facts.map(([n, label]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}
        </dl>
      </header>

      <section className="hm-page hm-sec" id="options" aria-labelledby="sp-now">
        <div className="hm-sec-t">
          <span className="kicker">{t('Available now', 'Доступно сейчас', 'Disponible ahora', 'Jetzt verfügbar', 'Şimdi mevcut', 'Disponible maintenant')}</span>
          <h2 className="hm-h2" id="sp-now">{t('Choose your place on the course', 'Выберите место на дистанции', 'Elige tu lugar en el recorrido', 'Wähle deinen Platz auf der Bahn', 'Parkurdaki yerini seç', 'Choisis ta place sur le parcours')}</h2>
          <p className="hm-text">{t(`Each place goes to one sponsor at a time, at all of the game’s ${VENUES.length} venues or at the ones you choose: a country’s, say, or a single venue. The price depends on the option, the venues and how long it runs, so ask us for a quote.`,
            `Каждое место достаётся одному спонсору на время размещения — на всех ${VENUES.length} акваториях игры или на выбранных вами: например, в одной стране или на одной акватории. Цена зависит от варианта, акваторий и срока: напишите нам, и мы её назовём.`, `Cada lugar va a un solo patrocinador a la vez, en las ${VENUES.length} sedes del juego o en las que elijas: las de un país, por ejemplo, o una sola sede. El precio depende de la opción, las sedes y cuánto dure, así que pídenos un presupuesto.`, `Jeder Platz geht jeweils an einen Sponsor, in allen ${VENUES.length} Revieren des Spiels oder in denen, die du wählst: etwa denen eines Landes oder einem einzigen Revier. Der Preis hängt von der Option, den Revieren und der Laufzeit ab, frag uns also nach einem Angebot.`, `Her yer bir seferde bir sponsora gider; oyunun ${VENUES.length} yarış alanının hepsinde ya da seçtiklerinde: örneğin bir ülkeninkilerde ya da tek bir alanda. Fiyat seçeneğe, alanlara ve ne kadar sürdüğüne bağlıdır, bu yüzden bizden teklif iste.`, `Chaque emplacement va à un seul sponsor à la fois, sur les ${VENUES.length} plans d’eau du jeu ou sur ceux que tu choisis : ceux d’un pays, par exemple, ou un seul plan d’eau. Le prix dépend de l’option, des plans d’eau et de la durée : demande-nous un devis.`)}</p>
        </div>
        <div className="sp-opts">
          <article className="sp-opt">
            <Shot src="/images/sp-jib-v3.jpg" tag={ad} mark={MARKS.jib} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A banner over the whole jib, reading along the luff, marked', 'Баннер на весь стаксель вдоль передней шкаторины, место отмечено', 'Una pancarta en todo el foque, a lo largo del grátil, señalada', 'Ein Banner über die ganze Fock, am Vorliek entlang, markiert', 'Bütün flokta, orsa yakası boyunca pankart, işaretli', 'Une bannière sur tout le foc, lisible le long du guindant, mise en évidence')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Banner on the jib', 'Баннер на стакселе', 'Pancarta en el foque', 'Banner auf der Fock', 'Flokta pankart', 'Bannière sur le foc')}</h3>
              <p className="hm-text">{t('Your banner over the whole jib of every boat in the race, the player’s and the computer’s: as large as the sail takes it, reading along the luff, and the jib dyed your banner’s own colour.',
                'Ваш баннер на весь стаксель каждой лодки в гонке, у игрока и у компьютерных соперников: так крупно, как позволяет парус, вдоль передней шкаторины, а сам стаксель — в цвете вашего баннера.', 'Tu pancarta en todo el foque de cada barco de la regata, el del jugador y los del ordenador: tan grande como lo admite la vela, a lo largo del grátil, y el foque teñido del color de tu pancarta.', 'Dein Banner über die ganze Fock jedes Bootes in der Regatta, des Spielers und der Computerboote: so groß, wie das Segel es zulässt, am Vorliek entlang, und die Fock in der Farbe deines Banners.', 'Pankartın yarıştaki her teknenin, oyuncunun ve bilgisayarın, bütün flokunda: yelkenin aldığı kadar büyük, orsa yakası boyunca, flok da pankartının renginde.', 'Ta bannière sur tout le foc de chaque bateau de la régate, celui du joueur comme ceux de l’ordinateur : aussi grande que la voile le permet, lisible le long du guindant, et le foc teint de la couleur même de ta bannière.')}</p>
              <Spec rows={[
                [t('Yachts', 'Яхты', 'Yates', 'Yachten', 'Yatlar', 'Yachts'), t(`The ${WITH_JIB} of ${YACHT_IDS.length} classes that carry a jib`, `${WITH_JIB} из ${YACHT_IDS.length} классов, у которых есть стаксель`, `Las ${WITH_JIB} de ${YACHT_IDS.length} clases que llevan foque`, `${WITH_JIB} von ${YACHT_IDS.length} Klassen führen eine Fock`, `Flok taşıyan ${YACHT_IDS.length} sınıftan ${WITH_JIB}`, `Les ${WITH_JIB} classes sur ${YACHT_IDS.length} qui portent un foc`)],
                [t('Size on the sail', 'Размер на парусе', 'Tamaño en la vela', 'Größe auf dem Segel', 'Yelkendeki boyut', 'Taille sur la voile'), t('The whole jib, along the luff', 'Весь стаксель, вдоль передней шкаторины', 'Todo el foque, a lo largo del grátil', 'Die ganze Fock, am Vorliek entlang', 'Bütün flok, orsa yakası boyunca', 'Tout le foc, le long du guindant')],
                artwork,
                [t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs'), t('A wide banner on a colour of its own: the jib takes that colour. Or a colour of yours for every jib', 'Широкий баннер на своём цвете: стаксель принимает этот цвет. Или ваш цвет для всех стакселей', 'Una pancarta ancha sobre un color propio: el foque toma ese color. O un color tuyo para todos los foques', 'Ein breites Banner auf eigener Farbe: Die Fock nimmt diese Farbe an. Oder eine Farbe von dir für alle Focks', 'Kendi renginde geniş bir pankart: flok o rengi alır. Ya da bütün floklar için senin bir rengin', 'Une bannière large sur une couleur à elle : le foc prend cette couleur. Ou une couleur de ton choix pour tous les focs')],
              ]} />
            </div>
          </article>
          <article className="sp-opt">
            <Shot src="/images/sp-main-v3.jpg" tag={logo} mark={MARKS.main} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A logo on the mainsail, marked', 'Логотип на гроте, место отмечено', 'Un logo en la mayor, señalado', 'Ein Logo auf dem Großsegel, markiert', 'Ana yelkende logo, işaretli', 'Un logo sur la grand-voile, mis en évidence')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Logo on the mainsail', 'Логотип на гроте', 'Logo en la mayor', 'Logo auf dem Großsegel', 'Ana yelkende logo', 'Logo sur la grand-voile')}</h3>
              <p className="hm-text">{t('Your logo on the mainsail of every boat in the race, above her sail number, on both sides. A logo of one colour takes the colour of each boat’s number, so it reads on light and dark sails alike.',
                'Ваш логотип на гроте каждой лодки в гонке, над номером на парусе, с обеих сторон. Одноцветный логотип принимает цвет номера каждой яхты, поэтому читается и на светлых, и на тёмных парусах.', 'Tu logo en la mayor de cada barco de la regata, sobre su número de vela, por ambas caras. Un logo de un solo color toma el color del número de cada barco, así se lee igual en velas claras y oscuras.', 'Dein Logo auf dem Großsegel jedes Bootes in der Regatta, über ihrer Segelnummer, auf beiden Seiten. Ein einfarbiges Logo nimmt die Farbe der Nummer jedes Bootes an, so liest es sich auf hellen wie auf dunklen Segeln.', 'Logon yarıştaki her teknenin ana yelkeninde, yelken numarasının üstünde, iki yüzde de. Tek renkli bir logo her teknenin numarasının rengini alır, böylece açık ve koyu yelkende aynı okunur.', 'Ton logo sur la grand-voile de chaque bateau de la régate, au-dessus de son numéro de voile, des deux côtés. Un logo d’une seule couleur prend la couleur du numéro de chaque bateau, pour rester lisible sur les voiles claires comme sombres.')}</p>
              <Spec rows={[
                [t('Yachts', 'Яхты', 'Yates', 'Yachten', 'Yatlar', 'Yachts'), t(`All ${YACHT_IDS.length} classes`, `Все ${YACHT_IDS.length} классов`, `Las ${YACHT_IDS.length} clases`, `Alle ${YACHT_IDS.length} Klassen`, `${YACHT_IDS.length} sınıfın hepsi`, `Toutes les ${YACHT_IDS.length} classes`)],
                [t('Size on the sail', 'Размер на парусе', 'Tamaño en la vela', 'Größe auf dem Segel', 'Yelkendeki boyut', 'Taille sur la voile'), t('As large as the cloth above the boom allows', 'Так крупно, как позволяет парус над гиком', 'Tan grande como lo permite la tela sobre la botavara', 'So groß, wie das Tuch über dem Baum es zulässt', 'Bumbanın üstündeki kumaşın izin verdiği kadar büyük', 'Aussi grand que le tissu au-dessus de la bôme le permet')],
                artwork,
                [t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs'), t('One colour on a transparent background reads best', 'Лучше всего читается одноцветный на прозрачном фоне', 'Un solo color sobre fondo transparente se lee mejor', 'Einfarbig auf transparentem Hintergrund liest sich am besten', 'Saydam arka planda tek renk en iyi okunur', 'Une seule couleur sur fond transparent, c’est le plus lisible')],
              ]} />
            </div>
          </article>
          <article className="sp-opt">
            <Shot src="/images/sp-kite-v1.jpg" tag={logo} mark={MARKS.kite} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A yacht running down the course under a gennaker in a sponsor’s colour with a large logo, marked', 'Яхта идёт по дистанции фордевиндом под генакером в цвете спонсора с большим логотипом, место отмечено', 'Un yate navegando en popa por el recorrido con un gennaker del color de un patrocinador y un logo grande, señalado', 'Eine Yacht vor dem Wind auf der Bahn unter einem Gennaker in der Farbe eines Sponsors mit einem großen Logo, markiert', 'Parkurda pupada, bir sponsorun renginde büyük logolu balonla giden bir yat, işaretli', 'Un yacht qui descend le parcours sous un gennaker aux couleurs d’un sponsor avec un grand logo, mis en évidence')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Gennaker in your colour', 'Генакер в вашем цвете', 'Gennaker de tu color', 'Gennaker in deiner Farbe', 'Senin renginde balon', 'Gennaker à ta couleur')}</h3>
              <p className="hm-text">{t('Every gennaker and spinnaker in the race in your colour with your logo large across it, when the boats bear away downwind: the biggest sail on the course.',
                'Каждый генакер и спинакер в гонке — в вашем цвете и с крупным логотипом, когда лодки уваливаются на полные курсы: самый большой парус на дистанции.', 'Cada gennaker y spinnaker de la regata de tu color con tu logo en grande, cuando los barcos arriban con viento de popa: la vela más grande del recorrido.', 'Jeder Gennaker und Spinnaker in der Regatta in deiner Farbe mit deinem Logo groß darauf, wenn die Boote vor dem Wind abfallen: das größte Segel auf der Bahn.', 'Tekneler pupaya döndüğünde yarıştaki her balon senin renginde ve üstünde büyük logonla: parkurdaki en büyük yelken.', 'Chaque gennaker et chaque spi de la régate à ta couleur, avec ton logo en grand dessus, quand les bateaux abattent au portant : la plus grande voile du parcours.')}</p>
              <Spec rows={[
                [t('Yachts', 'Яхты', 'Yates', 'Yachten', 'Yatlar', 'Yachts'), t(`The ${WITH_KITE} of ${YACHT_IDS.length} classes that carry one`, `${WITH_KITE} из ${YACHT_IDS.length} классов, у которых он есть`, `Las ${WITH_KITE} de ${YACHT_IDS.length} clases que lo llevan`, `${WITH_KITE} von ${YACHT_IDS.length} Klassen führen einen`, `Taşıyan ${YACHT_IDS.length} sınıftan ${WITH_KITE}`, `Les ${WITH_KITE} classes sur ${YACHT_IDS.length} qui en portent un`)],
                [t('Size on the sail', 'Размер на парусе', 'Tamaño en la vela', 'Größe auf dem Segel', 'Yelkendeki boyut', 'Taille sur la voile'), t('About three quarters of its width', 'Около трёх четвертей его ширины', 'Unas tres cuartas partes de su ancho', 'Etwa drei Viertel seiner Breite', 'Genişliğinin dörtte üçü kadar', 'Environ les trois quarts de sa largeur')],
                artwork,
                [t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs'), t('One colour of yours for the whole sail', 'Один ваш цвет на весь парус', 'Un color tuyo para toda la vela', 'Eine Farbe von dir für das ganze Segel', 'Bütün yelken için senin bir rengin', 'Une couleur de ton choix pour toute la voile')],
              ]} />
            </div>
          </article>
          <article className="sp-opt">
            <Shot src="/images/sp-banner-v2.jpg" tag={words} mark={[41.4, 28.6, 38.1, 7.4]} sizes="(min-width: 900px) 580px, 100vw"
              alt={t('A light plane towing a banner over the course, the banner marked', 'Лёгкий самолёт с баннером над дистанцией, баннер отмечен', 'Una avioneta ligera remolcando una pancarta sobre el recorrido, la pancarta señalada', 'Ein Leichtflugzeug zieht ein Banner über die Bahn, das Banner markiert', 'Parkurun üstünde pankart çeken hafif bir uçak, pankart işaretli', 'Un avion léger qui remorque une banderole au-dessus du parcours, la banderole mise en évidence')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('Banner over the course', 'Баннер над дистанцией', 'Pancarta sobre el recorrido', 'Banner über der Bahn', 'Parkurun üstünde pankart', 'Banderole au-dessus du parcours')}</h3>
              <p className="hm-text">{t('A light plane tows your words across the course, side-on to the player’s view so they can be read.',
                'Лёгкий самолёт несёт ваш текст над дистанцией, бортом к игроку, чтобы его было легко прочитать.', 'Una avioneta ligera remolca tus palabras por el recorrido, de lado a la vista del jugador para que se puedan leer.', 'Ein Leichtflugzeug zieht deine Worte quer über die Bahn, seitlich zur Sicht des Spielers, damit sie lesbar sind.', 'Hafif bir uçak sözlerini parkurun üstünde çeker, oyuncunun görüş açısına yandan, böylece okunabilir.', 'Un avion léger remorque ton message à travers le parcours, de profil par rapport à la vue du joueur pour qu’il soit lisible.')}</p>
              <Spec rows={[
                [t('Seen', 'Показы', 'Visto', 'Zu sehen', 'Görünme', 'Visible'), t('Every minute or two during a race', 'Каждые одну-две минуты во время гонки', 'Cada uno o dos minutos durante una regata', 'Alle ein bis zwei Minuten während einer Regatta', 'Yarış sırasında bir iki dakikada bir', 'Toutes les une à deux minutes pendant une régate')],
                [t('Words', 'Текст', 'Palabras', 'Worte', 'Sözler', 'Texte'), t('Two parts, up to 40 characters each', 'Две части, до 40 знаков в каждой', 'Dos partes, de hasta 40 caracteres cada una', 'Zwei Teile, je bis zu 40 Zeichen', 'İki bölüm, her biri en çok 40 karakter', 'Deux parties, jusqu’à 40 caractères chacune')],
                [t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs'), t('The first part navy, the second red', 'Первая часть синяя, вторая красная', 'La primera parte en azul marino, la segunda en rojo', 'Der erste Teil marineblau, der zweite rot', 'İlk bölüm lacivert, ikincisi kırmızı', 'La première partie en bleu marine, la seconde en rouge')],
              ]} />
            </div>
          </article>
          <article className="sp-opt sp-opt-wide">
            <Shot src="/images/sp-run-v1.jpg" sizes="(min-width: 900px) 640px, 100vw"
              alt={t('Yachts racing down the run at Göcek under gennakers in one sponsor’s colour and logo, the logo on every mainsail too', 'Яхты в гонке у Гёджека идут фордевиндом под генакерами в цвете и с логотипом одного спонсора, с логотипом и на каждом гроте', 'Yates en regata navegando en popa en Göcek con gennakers del color y el logo de un patrocinador, con el logo también en cada mayor', 'Yachten in der Regatta vor Göcek vor dem Wind unter Gennakern in Farbe und Logo eines Sponsors, das Logo auch auf jedem Großsegel', 'Göcek’te yarışta, bir sponsorun rengi ve logosuyla balonlar altında pupada giden yatlar, logo her ana yelkende de', 'Des yachts qui descendent le vent arrière à Göcek sous des gennakers aux couleurs et au logo d’un même sponsor, le logo aussi sur chaque grand-voile')} />
            <div className="sp-opt-t">
              <h3 className="hm-h3">{t('All the sails at your venues', 'Все паруса на ваших акваториях', 'Todas las velas en tus sedes', 'Alle Segel in deinen Revieren', 'Yarış alanlarında bütün yelkenler', 'Toutes les voiles sur tes plans d’eau')}</h3>
              <p className="hm-text">{t('A set of venues, a country’s coast, a region or a single bay, dressed in your brand: your banner on every jib, your logo on every mainsail, every gennaker and spinnaker in your colour with your logo, and the jibs in a colour of yours. Races there carry your sails; the other venues keep theirs.',
                'Набор акваторий — побережье страны, регион или одна бухта — в вашем стиле: ваш баннер на каждом стакселе, логотип на каждом гроте, каждый генакер и спинакер в вашем цвете с вашим логотипом, а стаксели — в вашем цвете. Гонки там идут под вашими парусами, на остальных акваториях — свои.', 'Un conjunto de sedes, la costa de un país, una región o una sola bahía, con tu marca: tu pancarta en cada foque, tu logo en cada mayor, cada gennaker y spinnaker de tu color con tu logo, y los foques de un color tuyo. Las regatas allí llevan tus velas; las demás sedes conservan las suyas.', 'Eine Reihe von Revieren, die Küste eines Landes, eine Region oder eine einzelne Bucht, in deiner Marke: dein Banner auf jeder Fock, dein Logo auf jedem Großsegel, jeder Gennaker und Spinnaker in deiner Farbe mit deinem Logo und die Focks in einer Farbe von dir. Regatten dort tragen deine Segel; die anderen Reviere behalten ihre.', 'Bir dizi yarış alanı, bir ülkenin kıyısı, bir bölge ya da tek bir koy, markanla giydirilir: her flokta pankartın, her ana yelkende logon, her balon ve spinaker senin renginde ve logonla, floklar da senin bir renginde. Oradaki yarışlar senin yelkenlerini taşır; diğer alanlar kendilerininkini korur.', 'Un ensemble de plans d’eau, la côte d’un pays, une région ou une seule baie, aux couleurs de ta marque : ta bannière sur chaque foc, ton logo sur chaque grand-voile, chaque gennaker et chaque spi à ta couleur avec ton logo, et les focs dans une couleur de ton choix. Les régates là-bas portent tes voiles ; les autres plans d’eau gardent les leurs.')}</p>
              <Spec rows={[
                [t('Venues', 'Акватории', 'Sedes', 'Reviere', 'Yarış alanları', 'Plans d’eau'), t(`Any of the ${VENUES.length}: one, a country’s or a list of your own`, `Любые из ${VENUES.length}: одна, все акватории страны или ваш список`, `Cualquiera de las ${VENUES.length}: una, las de un país o una lista tuya`, `Beliebige der ${VENUES.length}: eines, die eines Landes oder eine eigene Liste`, `${VENUES.length} alandan herhangi biri: tek bir alan, bir ülkeninkiler ya da kendi listen`, `N’importe lesquels des ${VENUES.length} : un seul, ceux d’un pays ou ta propre liste`)],
                [t('Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler', 'Voiles'), t('Jib, mainsail and gennaker: each one yours, or as at every venue', 'Стаксель, грот и генакер: каждый ваш или как на всех акваториях', 'Foque, mayor y gennaker: cada uno tuyo, o como en todas las sedes', 'Fock, Großsegel und Gennaker: jedes von dir oder wie in allen Revieren', 'Flok, ana yelken ve balon: her biri senin ya da tüm alanlardaki gibi', 'Foc, grand-voile et gennaker : chacun à toi, ou comme sur tous les plans d’eau')],
                [t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs'), t('One of yours for every jib and one for every gennaker', 'Ваш цвет для всех стакселей и ваш — для всех генакеров', 'Uno tuyo para todos los foques y otro para todos los gennakers', 'Eine von dir für alle Focks und eine für alle Gennaker', 'Bütün floklar için bir rengin, bütün balonlar için bir rengin', 'Une couleur à toi pour tous les focs et une pour tous les gennakers')],
                artwork,
              ]} />
            </div>
          </article>
        </div>
        <article className="sp-both">
          <div>
            <h3 className="hm-h3">{t('The sails and the banner together', 'Паруса и баннер вместе', 'Las velas y la pancarta juntas', 'Segel und Banner zusammen', 'Yelkenler ve pankart birlikte', 'Les voiles et la banderole ensemble')}</h3>
            <p className="hm-text">{t('You take every place, so no other sponsor appears in the race while yours runs.',
              'Все места за вами: пока идёт размещение, других спонсоров в гонке нет.', 'Te quedas con todos los lugares, así que ningún otro patrocinador aparece en la regata mientras dure el tuyo.', 'Du nimmst alle Plätze, also erscheint in der Regatta kein anderer Sponsor, solange deiner läuft.', 'Bütün yerleri alırsın, böylece seninki sürerken yarışta başka bir sponsor görünmez.', 'Tu prends tous les emplacements : aucun autre sponsor n’apparaît dans la régate tant que le tien est en cours.')}</p>
          </div>
          <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><span className="btn-t">{t('Ask for all of them', 'Узнать о пакете', 'Pide todos', 'Alles anfragen', 'Hepsini iste', 'Tout demander')}</span><IconArrow /></a>
        </article>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-away">
          <div className="hm-sec-t">
            <span className="kicker">{t('Available now', 'Доступно сейчас', 'Disponible ahora', 'Jetzt verfügbar', 'Şimdi mevcut', 'Disponible maintenant')}</span>
            <h2 className="hm-h2" id="sp-away">{t('Take your brand beyond the race', 'Ваш бренд и за пределами гонки', 'Lleva tu marca más allá de la regata', 'Trag deine Marke über die Regatta hinaus', 'Markanı yarışın ötesine taşı', 'Ta marque au-delà de la régate')}</h2>
            <p className="hm-text">{t('These need no change to the game, so they can start as soon as we agree the dates.', 'Для них не нужно менять игру, поэтому начать можно сразу после согласования дат.', 'Esto no requiere cambios en el juego, así que puede empezar en cuanto acordemos las fechas.', 'Dafür muss am Spiel nichts geändert werden, also können sie starten, sobald wir die Termine vereinbaren.', 'Bunlar oyunda değişiklik gerektirmez, bu yüzden tarihlerde anlaştığımız anda başlayabilir.', 'Ces options ne demandent aucun changement dans le jeu : elles peuvent commencer dès que nous avons fixé les dates.')}</p>
          </div>
          <div className="sp-opts">
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('Post on our Telegram channel', 'Пост в нашем Telegram-канале', 'Publicación en nuestro canal de Telegram', 'Beitrag in unserem Telegram-Kanal', 'Telegram kanalımızda yazı', 'Publication sur notre chaîne Telegram')}</h3>
                <p className="hm-text">{t(`A post about your brand on ${channel.handle}, where we share the game’s news, the day’s best races and the racing rules.`,
                  `Пост о вашем бренде в ${channel.handle}, где мы публикуем новости игры, лучшие гонки дня и разборы гоночных правил.`, `Una publicación sobre tu marca en ${channel.handle}, donde compartimos las novedades del juego, las mejores regatas del día y las reglas de regatas.`, `Ein Beitrag über deine Marke auf ${channel.handle}, wo wir die Neuigkeiten des Spiels, die besten Regatten des Tages und die Wettfahrtregeln teilen.`, `${channel.handle} üzerinde, oyunun haberlerini, günün en iyi yarışlarını ve yarış kurallarını paylaştığımız yerde, markan hakkında bir yazı.`, `Une publication sur ta marque sur ${channel.handle}, où nous partageons les nouvelles du jeu, les meilleures régates du jour et les règles de course.`)}</p>
                <Spec rows={[
                  [t('Language', 'Язык', 'Idioma', 'Sprache', 'Dil', 'Langue'), t('Russian', 'Русский', 'Ruso', 'Russisch', 'Rusça', 'Russe')],
                  [t('You send', 'От вас', 'Tú envías', 'Du schickst', 'Sen gönderirsin', 'Tu envoies'), t('Your text, a picture and a link', 'Текст, изображение и ссылка', 'Tu texto, una imagen y un enlace', 'Deinen Text, ein Bild und einen Link', 'Bir metin, bir resim ve bir bağlantı', 'Ton texte, une image et un lien')],
                  [t('Shown as', 'Формат', 'Se muestra como', 'Gezeigt als', 'Şöyle gösterilir', 'Affichée comme'), t('Marked as an advertisement', 'С пометкой «реклама»', 'Marcado como publicidad', 'Als Werbung gekennzeichnet', 'Reklam olarak işaretli', 'Signalée comme publicité')],
                ]} />
              </div>
            </article>
            <article className="sp-opt">
              <div className="sp-opt-t">
                <h3 className="hm-h3">{t('A race film with your brand', 'Фильм о гонке с вашим брендом', 'Un vídeo de regata con tu marca', 'Ein Regattafilm mit deiner Marke', 'Markanla bir yarış filmi', 'Un film de régate avec ta marque')}</h3>
                <p className="hm-text">{t('A short film of a race in the game, with your logo on the jibs and your words on the plane’s banner, for your own channels.',
                  'Короткий фильм о гонке в игре с вашим логотипом на стакселях и вашим текстом на баннере самолёта для ваших каналов.', 'Un vídeo corto de una regata del juego, con tu logo en los foques y tus palabras en la pancarta de la avioneta, para tus propios canales.', 'Ein kurzer Film einer Regatta im Spiel, mit deinem Logo auf den Focks und deinen Worten auf dem Banner des Flugzeugs, für deine eigenen Kanäle.', 'Oyunda bir yarışın, flokların üzerinde logon ve uçağın pankartında sözlerinle, kendi kanalların için kısa bir filmi.', 'Un court film d’une régate dans le jeu, avec ton logo sur les focs et ton message sur la banderole de l’avion, pour tes propres canaux.')}</p>
                <Spec rows={[
                  [t('Race', 'Гонка', 'Regata', 'Regatta', 'Yarış', 'Régate'), t('The venue and yacht you choose', 'Акватория и яхта на ваш выбор', 'La sede y el yate que elijas', 'Das Revier und die Yacht, die du wählst', 'Seçtiğin alan ve yat', 'Le plan d’eau et le yacht de ton choix')],
                  [t('Formats', 'Форматы', 'Formatos', 'Formate', 'Biçimler', 'Formats'), t('Vertical for stories, 4:5 for feeds, widescreen for YouTube', 'Вертикальный для сторис, 4:5 для лент, широкий для YouTube', 'Vertical para stories, 4:5 para feeds, panorámico para YouTube', 'Hochformat für Stories, 4:5 für Feeds, Breitbild für YouTube', 'Hikâyeler için dikey, akışlar için 4:5, YouTube için geniş ekran', 'Vertical pour les stories, 4:5 pour les fils d’actualité, panoramique pour YouTube')],
                  [t('Languages', 'Языки', 'Idiomas', 'Sprachen', 'Diller', 'Langues'), t('English and Russian', 'Английский и русский', 'Inglés y ruso', 'Englisch und Russisch', 'İngilizce ve Rusça', 'Anglais et russe')],
                ]} />
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="hm-page hm-sec" aria-labelledby="sp-made">
        <div className="hm-sec-t">
          <span className="kicker">{t('Made to order', 'На заказ', 'A medida', 'Auf Bestellung', 'Sipariş üzerine', 'Sur mesure')}</span>
          <h2 className="hm-h2" id="sp-made">{t('Something built for you', 'Сделаем под вас', 'Algo hecho para ti', 'Etwas, das für dich gebaut wird', 'Senin için yapılmış bir şey', 'Quelque chose de créé pour toi')}</h2>
          <p className="hm-text">{t('These need work in the game first, so we agree the timing with you.', 'Для них нужно доработать игру, поэтому сроки согласуем с вами.', 'Esto requiere trabajo previo en el juego, así que acordamos los plazos contigo.', 'Dafür ist zuerst Arbeit im Spiel nötig, also stimmen wir den Zeitplan mit dir ab.', 'Bunlar önce oyunda çalışma gerektirir, bu yüzden zamanlamayı seninle kararlaştırırız.', 'Ces options demandent d’abord du travail dans le jeu : nous convenons du calendrier avec toi.')}</p>
        </div>
        <ul className="sp-made">
          {made.map(([title, text]) => <li key={title}><h3 className="hm-h3">{title}</h3><p className="hm-text">{text}</p></li>)}
        </ul>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="sp-how">
          <div className="hm-sec-t">
            <span className="kicker">{t('How it works', 'Как это устроено', 'Cómo funciona', 'So funktioniert es', 'Nasıl çalışır', 'Comment ça marche')}</span>
            <h2 className="hm-h2" id="sp-how">{t('From first message to the start line', 'От первого сообщения до старта', 'Del primer mensaje a la línea de salida', 'Von der ersten Nachricht bis zur Startlinie', 'İlk mesajdan start hattına', 'Du premier message à la ligne de départ')}</h2>
          </div>
          <ol className="rd-cells">
            {steps.map(([title, text], i) => <li key={title}><span className="lbl">{i + 1}</span><b>{title}</b><p>{text}</p></li>)}
          </ol>
        </section>
      </div>

      <section className="hm-page hm-sec sp-end" aria-labelledby="sp-talk">
        <div className="hm-sec-t">
          <span className="kicker">{t('Get in touch', 'Связаться', 'Ponte en contacto', 'Kontakt aufnehmen', 'İletişime geç', 'Nous contacter')}</span>
          <h2 className="hm-h2" id="sp-talk">{t('Tell us what you have in mind', 'Расскажите, что вы задумали', 'Cuéntanos qué tienes en mente', 'Sag uns, was du vorhast', 'Aklındakini bize anlat', 'Dis-nous ce que tu as en tête')}</h2>
          <p className="hm-text">{t('Write to us on Telegram for prices, free dates and current audience figures.', 'Напишите нам в Telegram: расскажем о ценах, свободных датах и текущей аудитории.', 'Escríbenos por Telegram para precios, fechas libres y cifras de audiencia actuales.', 'Schreib uns auf Telegram für Preise, freie Termine und aktuelle Reichweitenzahlen.', 'Fiyatlar, boş tarihler ve güncel izleyici sayıları için bize Telegram’dan yaz.', 'Écris-nous sur Telegram pour les prix, les dates libres et les chiffres d’audience actuels.')}</p>
        </div>
        <a className="pill pill-primary" href={CONTACT.url} target="_blank" rel="noopener"><AppMark app="telegram" s={22} /><span className="btn-t" lang="en" translate="no">{CONTACT.handle}</span></a>
      </section>

      <SiteFoot lang={lang} t={t} back="/sponsorship" />
    </div>
  );
}
