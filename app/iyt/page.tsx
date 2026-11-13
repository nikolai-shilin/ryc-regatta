import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { IconArrow, IconSail, IconCheck, IconBook, IconClock, IconSend, IconOut } from '@/components/ui';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import type { Lang, T } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('Sailing certification exam practice', 'Тренажёр к экзамену на яхтенный сертификат'),
    description: t(
      'Free practice for the theory of sailing certification exams, VHF Radio Operator to Yachtmaster Ocean: situations in drawings, the reason after every answer, a mock exam.',
      'Бесплатная подготовка к теории экзаменов на яхтенные сертификаты от VHF Radio Operator до Yachtmaster Ocean: ситуации в рисунках, пояснение после ответа, пробный экзамен.'),
  };
}

const BOT = 'https://t.me/iyt_test_bot?startapp';
const web = (lang: Lang) => (lang === 'ru' ? 'https://iyt.rycrentals.com/ru' : 'https://iyt.rycrentals.com/');

// The two ways in: the Telegram mini app first, the browser version as a caps link beside the note.
function Open({ lang, t }: { lang: Lang; t: T }) {
  return (
    <div className="iyt-open">
      <a className="pill pill-primary" href={BOT}><IconSend /><span className="btn-t">{t('Open in Telegram', 'Открыть в Telegram')}</span></a>
      <p className="iyt-note">
        <span className="hm-muted">{t('Free, no sign-up.', 'Бесплатно, без регистрации.')}</span>
        <a className="hm-src" href={web(lang)}>{t('Or in the browser', 'Или в браузере')}<IconOut /></a>
      </p>
    </div>
  );
}

// IYT · the IYT Test, as rycrentals.com/iyt has it: what the trainer is, how it works, its nine levels, why RYC makes
// it, and the way in again at the foot.
export default async function Iyt() {
  const { lang, t } = await getT();
  const account = await getAccount();
  const n = (v: number) => v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB');

  const how: [React.ReactNode, string, string][] = [
    [<IconSail key="s" s={20} />, t('Situations, not definitions', 'Ситуации, а не определения'), t(
      'Every question is a moment on the water, drawn where it can be: the mark ahead, the lights at night, the other boat’s bearing, the engine panel. Four options to choose from.',
      'Каждый вопрос — момент на воде, где можно — с рисунком: знак впереди, огни ночью, пеленг на другое судно, панель двигателя. Четыре варианта ответа.')],
    [<IconCheck key="c" s={20} />, t('The reason after every answer', 'Пояснение после каждого ответа'), t(
      'Right or wrong, you see a one-line explanation and the rule behind it: COLREGs, IALA buoyage or standard seamanship. Your mistakes come back until you get them right.',
      'Верно или нет — вы видите короткое пояснение и правило, из которого оно следует: МППСС-72, система МАМС или хорошая морская практика. Ошибки возвращаются, пока не ответите верно.')],
    [<IconBook key="b" s={20} />, t('Theory for every topic', 'Теория по каждой теме'), t(
      'Each level is split into topics, and every topic has a short article with drawings that explains the rules its questions ask about.',
      'Уровень разбит на темы, и у каждой темы есть короткая статья с рисунками — о правилах, о которых спрашивают её вопросы.')],
    [<IconClock key="k" s={20} />, t('Timed mock exam', 'Пробный экзамен с таймером'), t(
      'A mock exam with a timer draws questions from every topic of the level, and your progress is shown per topic, so you know what to repeat.',
      'Пробный экзамен берёт вопросы из всех тем уровня, а прогресс виден по каждой теме — понятно, что повторить.')],
  ];

  const levels: [string, number, string][] = [
    [t('VHF Radio Operator', 'VHF Radio Operator'), 200, t('Marine VHF radio: channels, procedure, distress, urgency and safety calls.', 'Морская УКВ-радиосвязь: каналы, порядок связи, сигналы бедствия, срочности и безопасности.')],
    [t('International Crew', 'International Crew'), 200, t('The first step aboard: life on a yacht, ropes and knots, safety and helping the skipper.', 'Первый шаг на борту: жизнь на яхте, концы и узлы, безопасность и помощь шкиперу.')],
    [t('Flotilla Skipper', 'Flotilla Skipper'), 200, t('Skippering a yacht by day in a flotilla, with a lead boat nearby.', 'Управление яхтой днём во флотилии, рядом с лидирующей лодкой.')],
    [t('Bareboat Skipper', 'Bareboat Skipper'), 1000, t('Skippering a charter yacht yourself by day in coastal waters, without a hired skipper.', 'Самостоятельное управление чартерной яхтой днём в прибрежных водах — без нанятого шкипера.')],
    [t('Yachtmaster Coastal', 'Yachtmaster Coastal'), 1000, t('Coastal passages by day and night: navigation, tides, weather and passage planning.', 'Прибрежные переходы днём и ночью: навигация, приливы, погода и планирование перехода.')],
    [t('Yachtmaster Offshore', 'Yachtmaster Offshore'), 1000, t('Offshore passages out of sight of land, the crew and the boat on longer trips.', 'Морские переходы вне видимости берега, экипаж и яхта в долгом плавании.')],
    [t('Yachtmaster Ocean', 'Yachtmaster Ocean'), 1000, t('Ocean crossings: celestial navigation, ocean weather and the routine of a long passage.', 'Океанские переходы: астронавигация, погода в океане и распорядок долгого перехода.')],
    [t('Racing Rules of Sailing', 'Правила парусных гонок'), 1000, t('Right of way between racing boats, marks, starts and penalties.', 'Право дороги между гоночными яхтами, знаки, старт и штрафы.')],
    [t('Charter check-in', 'Приёмка чартерной яхты'), 500, t('Taking over a charter yacht: inventory, engine, sails, safety gear and the paperwork.', 'Как принять яхту в чартер: инвентарь, двигатель, паруса, снаряжение безопасности и документы.')],
  ];
  const total = levels.reduce((a, l) => a + l[1], 0);

  const ld = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Sailing Certification Test', inLanguage: ['en', 'ru'],
    applicationCategory: 'EducationalApplication', operatingSystem: 'Web, Telegram', url: 'https://iyt.rycrentals.com/',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };

  return (
    <div className="scr help hp iyt" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <SiteHead lang={lang} t={t} account={account} page="iyt" />

      <header className="hm-page hm-ph">
        <span className="kicker">{t('Sailing certification exam practice', 'Тренажёр к экзамену на яхтенный сертификат')}</span>
        <h1 className="hm-ph-h">{t('Prepare for your sailing certification exam for free', 'Подготовьтесь к экзамену на яхтенный сертификат бесплатно')}</h1>
        <p className="hm-text iyt-lead">{t(
          `Sailing Certification Test is our free trainer for the theory of sailing certificates: ${n(total)} questions from VHF Radio Operator to Yachtmaster Ocean, with a short explanation after every answer. In English and Russian, no sign-up.`,
          `Sailing Certification Test — наш бесплатный тренажёр теории к яхтенным сертификатам: ${n(total)} вопросов от VHF Radio Operator до Yachtmaster Ocean и короткое пояснение после каждого ответа. На русском и английском, без регистрации.`)}</p>
        <Open lang={lang} t={t} />
      </header>

      <section className="hm-page hm-sec" aria-labelledby="iyt-how">
        <div className="hm-sec-t"><span className="kicker">{t('The trainer', 'Тренажёр')}</span><h2 className="hm-h2" id="iyt-how">{t('How it works', 'Как устроен тренажёр')}</h2></div>
        <div className="iyt-how">
          {how.map(([ic, title, text]) => (
            <div className="iyt-card" key={title}>
              <span className="iyt-card-h"><span className="iyt-ic">{ic}</span><span className="hm-h3">{title}</span></span>
              <p className="hm-text">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="iyt-levels">
          <div className="hm-sec-t">
            <span className="kicker">{t(`${levels.length} courses · ${n(total)} questions`, `${levels.length} курсов · ${n(total)} вопросов`)}</span>
            <h2 className="hm-h2" id="iyt-levels">{t('Levels', 'Уровни')}</h2>
            <p className="hm-text iyt-lead">{t(`${n(total)} questions across every theory level from VHF Radio Operator to Yachtmaster Ocean, plus the racing rules and a charter check-in course.`, `${n(total)} вопросов по всем уровням теории от VHF Radio Operator до Yachtmaster Ocean, плюс правила парусных гонок и курс приёмки чартерной яхты.`)}</p>
          </div>
          <ul className="iyt-levels">
            {levels.map(([name, q, text]) => (
              <li key={name}>
                <span className="hm-h3">{name}</span>
                <span className="meta">{t(`${n(q)} questions`, `${n(q)} вопросов`)}</span>
                <span className="hm-text">{text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="hm-page hm-sec hm-help" aria-labelledby="iyt-why">
        <div className="hm-help-main">
          <span className="kicker">RYC</span>
          <h2 className="hm-h2" id="iyt-why">{t('Why a charter site makes an exam trainer', 'Зачем чартерному сайту тренажёр')}</h2>
          <p className="hm-text">{t(
            'To charter a yacht without a hired skipper, the charter company asks for a skipper’s licence, such as a sailing certificate. The trainer helps with the theory part of the exam. Once you have the licence, discounted boats for your dates are on rycrentals.com.',
            'Чтобы взять яхту в чартер без нанятого шкипера, чартерная компания попросит шкиперские права — например, яхтенный сертификат. Тренажёр помогает с теоретической частью экзамена. А когда права на руках, яхты со скидкой на ваши даты — на rycrentals.com.')}</p>
          <p className="hm-text">{t(
            'The racing rules course asks about the same rules the boats in Up and down sail by.',
            'Курс правил парусных гонок спрашивает о тех же правилах, по которым ходят лодки в Up and down.')}</p>
          <a className="pill hm-cta" href={lang === 'ru' ? 'https://www.rycrentals.com/deals' : 'https://www.rycrentals.com/en/deals'}><span className="btn-t">{t('See discounted yachts', 'Смотреть яхты со скидкой')}</span><IconArrow /></a>
        </div>
        <div className="hm-help-side">
          <div className="iyt-card">
            <span className="hm-h3">{t('Written for study', 'Сделано для учёбы')}</span>
            <p className="hm-text">{t(
              'The questions and articles are our own work, close to the syllabus of the sailing certificates. They are not official exam content, and neither a certifying body nor World Sailing has reviewed them. The exam size, time and pass mark in the trainer are its own defaults.',
              'Вопросы и статьи — наша работа, близкая к программе яхтенных сертификатов. Это не официальные экзаменационные материалы, их не проверяли ни сертифицирующие организации, ни World Sailing. Число вопросов, время и проходной балл пробного экзамена — настройки тренажёра.')}</p>
          </div>
          <div className="iyt-card">
            <span className="hm-h3">{t('Found a mistake?', 'Нашли ошибку?')}</span>
            <p className="hm-text">{t(
              'Every question and every article section has a report button. We read each report and fix the question.',
              'Под каждым вопросом и каждым разделом статьи есть кнопка «Сообщить». Читаем каждое сообщение и исправляем вопрос.')}</p>
          </div>
        </div>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec iyt-end" aria-labelledby="iyt-try">
          <h2 className="hm-h2" id="iyt-try">{t('Try a few questions now', 'Попробуйте пару вопросов прямо сейчас')}</h2>
          <Open lang={lang} t={t} />
        </section>
      </div>

      <SiteFoot lang={lang} t={t} account={account} back="/iyt" />
    </div>
  );
}
