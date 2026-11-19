import { getT, titled, type LangParams } from '@/lib/i18n';
import { IconArrow, IconSend, IconOut } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { IytSample } from '@/components/iyt-sample';
import { iytSample } from '@/lib/iyt-sample';
import { IYT_LEVELS } from '@/lib/iyt';
import { LOCALE, type Lang, type T } from '@/lib/lang';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Sailing certification exam practice', 'Тренажёр к экзамену на яхтенный сертификат', 'Práctica para el examen de titulación náutica', 'Prüfungsvorbereitung für Segelscheine', 'Yelken belgesi sınavı alıştırması', {
  path: '/iyt', card: '/og/page/iyt',
  description: [
    'Free practice for the theory of sailing certification exams, VHF Radio Operator to Yachtmaster Ocean: situations in drawings, the reason after every answer, a mock exam.',
    'Бесплатная подготовка к теории экзаменов на яхтенные сертификаты от VHF Radio Operator до Yachtmaster Ocean: ситуации в рисунках, пояснение после ответа, пробный экзамен.', 'Práctica gratuita de la teoría de los exámenes de titulación náutica, de Operador de Radio VHF a Yachtmaster Ocean: situaciones en dibujos, la razón tras cada respuesta, un examen de prueba.', 'Kostenlos üben für die Theorie der Segelscheinprüfungen, von VHF Radio Operator bis Yachtmaster Ocean: Situationen in Zeichnungen, die Begründung nach jeder Antwort, eine Probeprüfung.', 'Yelken belgesi sınavlarının teorisi için ücretsiz alıştırma, VHF Radio Operator’dan Yachtmaster Ocean’a: çizimli durumlar, her cevaptan sonra nedeni, bir deneme sınavı.'],
});

const BOT = 'https://t.me/iyt_test_bot?startapp';
const web = (lang: Lang) => (lang === 'ru' ? 'https://iyt.rycrentals.com/ru' : 'https://iyt.rycrentals.com/');

// The two ways in: the Telegram mini app first, the browser version as a caps link beside the note.
function Open({ lang, t }: { lang: Lang; t: T }) {
  return (
    <div className="iyt-open">
      <a className="pill pill-primary" href={BOT}><IconSend /><span className="btn-t">{t('Open in Telegram', 'Открыть в Telegram', 'Abrir en Telegram', 'In Telegram öffnen', 'Telegram’da aç')}</span></a>
      <p className="iyt-note">
        <span className="hm-muted">{t('Free, no sign-up.', 'Бесплатно, без регистрации.', 'Gratis, sin registro.', 'Kostenlos, ohne Anmeldung.', 'Ücretsiz, kaydolmadan.')}</span>
        <a className="hm-src" href={web(lang)}>{t('Or in the browser', 'Или в браузере', 'O en el navegador', 'Oder im Browser', 'Ya da tarayıcıda')}<IconOut /></a>
      </p>
    </div>
  );
}

// IYT · the IYT Test, as rycrentals.com/iyt has it: what the trainer is and the ways in, beside a real question from it
// to try (on a wide screen; under it on a narrower one), how it works in four numbered steps, its nine levels, why RYC makes it, and the way in again at the foot.
export default async function Iyt({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const n = (v: number) => v.toLocaleString(LOCALE[lang]);

  const how: [string, string][] = [
    [t('Situations, not definitions', 'Ситуации, а не определения', 'Situaciones, no definiciones', 'Situationen statt Definitionen', 'Tanımlar değil, durumlar'), t(
      'Every question is a moment on the water, drawn where it can be: the mark ahead, the lights at night, the other boat’s bearing, the engine panel. Four options to choose from.',
      'Каждый вопрос — момент на воде, где можно — с рисунком: знак впереди, огни ночью, пеленг на другое судно, панель двигателя. Четыре варианта ответа.', 'Cada pregunta es un momento en el agua, dibujado siempre que se puede: la baliza de proa, las luces de noche, la demora del otro barco, el panel del motor. Cuatro opciones a elegir.', 'Jede Frage ist ein Moment auf dem Wasser, gezeichnet, wo es geht: die Tonne voraus, die Lichter bei Nacht, die Peilung des anderen Bootes, das Motorpanel. Vier Antworten zur Auswahl.', 'Her soru suda bir an, çizilebildiği yere kadar çizili: öndeki şamandıra, gecenin fenerleri, öteki teknenin kerterizi, motor paneli. Seçmek için dört seçenek.')],
    [t('The reason after every answer', 'Пояснение после каждого ответа', 'La razón tras cada respuesta', 'Die Begründung nach jeder Antwort', 'Her cevaptan sonra nedeni'), t(
      'Right or wrong, you see a one-line explanation and the rule behind it: COLREGs, IALA buoyage or standard seamanship. Your mistakes come back until you get them right.',
      'Верно или нет — вы видите короткое пояснение и правило, из которого оно следует: МППСС-72, система МАМС или хорошая морская практика. Ошибки возвращаются, пока не ответите верно.', 'Aciertes o falles, ves una explicación de una línea y la regla que hay detrás: RIPA, balizamiento IALA o buena marinería. Tus errores vuelven hasta que los aciertas.', 'Ob richtig oder falsch, du siehst eine einzeilige Erklärung und die Regel dahinter: KVR, IALA-Betonnung oder gute Seemannschaft. Deine Fehler kommen wieder, bis du sie richtig hast.', 'Doğru ya da yanlış, tek satırlık bir açıklama ve arkasındaki kuralı görürsün: COLREG, IALA şamandıra sistemi ya da standart denizcilik. Yanlışların doğrusunu bulana kadar geri gelir.')],
    [t('Theory for every topic', 'Теория по каждой теме', 'Teoría de cada tema', 'Theorie zu jedem Thema', 'Her konu için teori'), t(
      'Each level is split into topics, and every topic has a short article with drawings that explains the rules its questions ask about.',
      'Уровень разбит на темы, и у каждой темы есть короткая статья с рисунками — о правилах, о которых спрашивают её вопросы.', 'Cada nivel se divide en temas, y cada tema tiene un artículo corto con dibujos que explica las reglas sobre las que preguntan sus cuestiones.', 'Jede Stufe ist in Themen gegliedert, und zu jedem Thema gibt es einen kurzen Artikel mit Zeichnungen, der die Regeln erklärt, nach denen seine Fragen fragen.', 'Her seviye konulara bölünür ve her konunun, sorularının sorduğu kuralları açıklayan, çizimli kısa bir makalesi vardır.')],
    [t('Timed mock exam', 'Пробный экзамен с таймером', 'Examen de prueba cronometrado', 'Probeprüfung mit Zeit', 'Süreli deneme sınavı'), t(
      'A mock exam with a timer draws questions from every topic of the level, and your progress is shown per topic, so you know what to repeat.',
      'Пробный экзамен берёт вопросы из всех тем уровня, а прогресс виден по каждой теме — понятно, что повторить.', 'Un examen de prueba con cronómetro saca preguntas de todos los temas del nivel, y tu progreso se muestra por tema, para que sepas qué repasar.', 'Eine Probeprüfung mit Timer zieht Fragen aus jedem Thema der Stufe, und dein Fortschritt wird je Thema angezeigt, damit du weißt, was du wiederholen musst.', 'Zamanlayıcılı bir deneme sınavı seviyenin her konusundan soru çeker ve ilerlemen konu konu gösterilir; neyi tekrarlayacağını bilirsin.')],
  ];

  const levels: [string, number, string][] = IYT_LEVELS.map((l) => [t(...l.name), l.n, t(...l.text)]);
  const total = levels.reduce((a, l) => a + l[1], 0);

  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Sailing Certification Test', inLanguage: ['en', 'ru'],
    applicationCategory: 'EducationalApplication', operatingSystem: 'Web, Telegram', url: 'https://iyt.rycrentals.com/',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };

  return (
    <div className="scr help hp iyt bc" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <SiteHead lang={lang} t={t} page="iyt" />

      <header className="hm-page hm-ph iyt-hero">
        <div>
          <span className="kicker">{t('Sailing certification exam practice', 'Тренажёр к экзамену на яхтенный сертификат', 'Práctica para el examen de titulación náutica', 'Prüfungsvorbereitung für Segelscheine', 'Yelken belgesi sınavı alıştırması')}</span>
          <h1 className="hm-ph-h">{t('Prepare for your sailing certification exam for free', 'Подготовьтесь к экзамену на яхтенный сертификат бесплатно', 'Prepara gratis tu examen de titulación náutica', 'Bereite dich kostenlos auf deine Segelscheinprüfung vor', 'Yelken belgesi sınavına ücretsiz hazırlan')}</h1>
          <p className="hm-text iyt-lead">{t(
            `Sailing Certification Test is our free trainer for the theory of sailing certificates: ${n(total)} questions from VHF Radio Operator to Yachtmaster Ocean, with a short explanation after every answer. In English and Russian, no sign-up.`,
            `Sailing Certification Test — наш бесплатный тренажёр теории к яхтенным сертификатам: ${n(total)} вопросов от VHF Radio Operator до Yachtmaster Ocean и короткое пояснение после каждого ответа. На русском и английском, без регистрации.`, `Sailing Certification Test es nuestro entrenador gratuito para la teoría de los títulos náuticos: ${n(total)} preguntas de Operador de Radio VHF a Yachtmaster Ocean, con una breve explicación tras cada respuesta. En inglés y ruso, sin registro.`, `Sailing Certification Test ist unser kostenloser Trainer für die Theorie der Segelscheine: ${n(total)} Fragen von VHF Radio Operator bis Yachtmaster Ocean, mit einer kurzen Erklärung nach jeder Antwort. Auf Englisch und Russisch, ohne Anmeldung.`, `Sailing Certification Test, yelken belgelerinin teorisi için ücretsiz çalışma aracımız: VHF Radio Operator’dan Yachtmaster Ocean’a ${n(total)} soru, her cevaptan sonra kısa bir açıklamayla. İngilizce ve Rusça, kaydolmadan.`)}</p>
          <Open lang={lang} t={t} />
        </div>
        <IytSample lang={lang} q={iytSample(lang)} />
      </header>

      <section className="hm-page hm-sec" aria-labelledby="iyt-how">
        <div className="hm-sec-t"><span className="kicker">{t('The trainer', 'Тренажёр', 'El entrenador', 'Der Trainer', 'Çalışma aracı')}</span><h2 className="hm-h2" id="iyt-how">{t('How it works', 'Как устроен тренажёр', 'Cómo funciona', 'So funktioniert es', 'Nasıl çalışır')}</h2></div>
        <ol className="rd-cells">
          {how.map(([title, text], i) => (
            <li key={title}><span className="lbl">{String(i + 1).padStart(2, '0')}</span><b>{title}</b><p>{text}</p></li>
          ))}
        </ol>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="iyt-levels">
          <div className="hm-sec-t">
            <span className="kicker">{t(`${levels.length} courses · ${n(total)} questions`, `${levels.length} курсов · ${n(total)} вопросов`, `${levels.length} cursos · ${n(total)} preguntas`, `${levels.length} Kurse · ${n(total)} Fragen`, `${levels.length} kurs · ${n(total)} soru`)}</span>
            <h2 className="hm-h2" id="iyt-levels">{t('Levels', 'Уровни', 'Niveles', 'Stufen', 'Seviyeler')}</h2>
            <p className="hm-text iyt-lead">{t(`${n(total)} questions across every theory level from VHF Radio Operator to Yachtmaster Ocean, plus the racing rules and a charter check-in course.`, `${n(total)} вопросов по всем уровням теории от VHF Radio Operator до Yachtmaster Ocean, плюс правила парусных гонок и курс приёмки чартерной яхты.`, `${n(total)} preguntas en todos los niveles de teoría, de Operador de Radio VHF a Yachtmaster Ocean, además de las reglas de regatas y un curso de check-in de chárter.`, `${n(total)} Fragen in allen Theoriestufen von VHF Radio Operator bis Yachtmaster Ocean, dazu die Wettfahrtregeln und ein Charter-Check-in-Kurs.`, `VHF Radio Operator’dan Yachtmaster Ocean’a her teori seviyesinde ${n(total)} soru, ayrıca yarış kuralları ve bir charter check-in kursu.`)}</p>
          </div>
          <ul className="iyt-levels">
            {levels.map(([name, q, text]) => (
              <li key={name}>
                <span className="hm-h3">{name}</span>
                <span className="meta">{t(`${n(q)} questions`, `${n(q)} вопросов`, `${n(q)} preguntas`, `${n(q)} Fragen`, `${n(q)} soru`)}</span>
                <span className="hm-text">{text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="hm-page hm-sec hm-help" aria-labelledby="iyt-why">
        <div className="hm-help-main">
          <span className="kicker">RYC</span>
          <h2 className="hm-h2" id="iyt-why">{t('Why a charter site makes an exam trainer', 'Зачем чартерному сайту тренажёр', 'Por qué un sitio de chárter hace un entrenador de examen', 'Warum eine Charterseite einen Prüfungstrainer macht', 'Neden bir charter sitesi sınav çalışma aracı yapar')}</h2>
          <p className="hm-text">{t(
            'To charter a yacht without a hired skipper, the charter company asks for a skipper’s licence, such as a sailing certificate. The trainer helps with the theory part of the exam. Once you have the licence, discounted boats for your dates are on rycrentals.com.',
            'Чтобы взять яхту в чартер без нанятого шкипера, чартерная компания попросит шкиперские права — например, яхтенный сертификат. Тренажёр помогает с теоретической частью экзамена. А когда права на руках, яхты со скидкой на ваши даты — на rycrentals.com.', 'Para alquilar un yate sin patrón, la empresa de chárter pide un título de patrón, como un título náutico. El entrenador ayuda con la parte de teoría del examen. Cuando tengas el título, los barcos con descuento para tus fechas están en rycrentals.com.', 'Um eine Yacht ohne gemieteten Skipper zu chartern, verlangt die Charterfirma einen Führerschein für Skipper, etwa einen Segelschein. Der Trainer hilft beim Theorieteil der Prüfung. Hast du den Schein, findest du auf rycrentals.com Yachten mit Rabatt für deine Termine.', 'Kaptansız bir yat kiralamak için charter şirketi, yelken belgesi gibi bir kaptan belgesi ister. Çalışma aracı sınavın teori kısmına yardım eder. Belgeyi aldığında, tarihlerine uygun indirimli tekneler rycrentals.com’da.')}</p>
          <p className="hm-text">{t(
            'The racing rules course asks about the same rules the boats in Up and down sail by.',
            'Курс правил парусных гонок спрашивает о тех же правилах, по которым ходят лодки в Up and down.', 'El curso de reglas de regatas pregunta por las mismas reglas con las que navegan los barcos de Up and down.', 'Der Kurs zu den Wettfahrtregeln fragt nach denselben Regeln, nach denen die Boote in Up and down segeln.', 'Yarış kuralları kursu, Up and down’daki teknelerin uyduğu kurallarla ilgili sorular sorar.')}</p>
          <a className="pill hm-cta" href={lang === 'ru' ? 'https://www.rycrentals.com/deals' : 'https://www.rycrentals.com/en/deals'}><span className="btn-t">{t('See discounted yachts', 'Смотреть яхты со скидкой', 'Ver yates con descuento', 'Yachten mit Rabatt ansehen', 'İndirimli yatları gör')}</span><IconArrow /></a>
        </div>
        <div className="hm-help-side">
          <div className="iyt-card">
            <span className="hm-h3">{t('Written for study', 'Сделано для учёбы', 'Hecho para estudiar', 'Zum Lernen geschrieben', 'Çalışmak için yazıldı')}</span>
            <p className="hm-text">{t(
              'The questions and articles are our own work, close to the syllabus of the sailing certificates. They are not official exam content, and neither a certifying body nor World Sailing has reviewed them. The exam size, time and pass mark in the trainer are its own defaults.',
              'Вопросы и статьи — наша работа, близкая к программе яхтенных сертификатов. Это не официальные экзаменационные материалы, их не проверяли ни сертифицирующие организации, ни World Sailing. Число вопросов, время и проходной балл пробного экзамена — настройки тренажёра.', 'Las preguntas y los artículos son obra nuestra, cercanos al temario de los títulos náuticos. No son contenido oficial de examen, y ni un organismo certificador ni World Sailing los han revisado. El tamaño, el tiempo y la nota de aprobado del examen en el entrenador son valores propios.', 'Die Fragen und Artikel sind unsere eigene Arbeit, nah am Lehrplan der Segelscheine. Sie sind keine offiziellen Prüfungsinhalte, und weder eine Prüfstelle noch World Sailing hat sie geprüft. Umfang, Zeit und Bestehensgrenze der Prüfung im Trainer sind seine eigenen Vorgaben.', 'Sorular ve makaleler kendi çalışmamızdır, yelken belgelerinin müfredatına yakındır. Resmî sınav içeriği değildir ve ne bir belgelendirme kuruluşu ne de World Sailing bunları gözden geçirmiştir. Çalışma aracındaki sınavın boyutu, süresi ve geçme notu kendi varsayılanlarıdır.')}</p>
          </div>
          <div className="iyt-card">
            <span className="hm-h3">{t('Found a mistake?', 'Нашли ошибку?', '¿Has encontrado un error?', 'Einen Fehler gefunden?', 'Hata mı buldun?')}</span>
            <p className="hm-text">{t(
              'Every question and every article section has a report button. We read each report and fix the question.',
              'Под каждым вопросом и каждым разделом статьи есть кнопка «Сообщить». Читаем каждое сообщение и исправляем вопрос.', 'Cada pregunta y cada sección de artículo tiene un botón para avisar. Leemos cada aviso y corregimos la pregunta.', 'Jede Frage und jeder Artikelabschnitt hat eine Melden-Taste. Wir lesen jede Meldung und korrigieren die Frage.', 'Her sorunun ve her makale bölümünün bir bildir düğmesi var. Her bildirimi okur ve soruyu düzeltiriz.')}</p>
          </div>
        </div>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec iyt-end" aria-labelledby="iyt-try">
          <h2 className="hm-h2" id="iyt-try">{t('Try a few questions now', 'Попробуйте пару вопросов прямо сейчас', 'Prueba unas preguntas ahora', 'Probiere jetzt ein paar Fragen', 'Şimdi birkaç soru dene')}</h2>
          <Open lang={lang} t={t} />
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back="/iyt" />
    </div>
  );
}
