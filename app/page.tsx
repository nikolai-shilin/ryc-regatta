import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { pageMeta, jsonLd, SITE, NAME, OG_IMAGE, HOME_TITLE, HOME_DESC } from '@/lib/seo';
import { ruBoats } from '@/lib/lang';
import { getAccount } from '@/lib/supabase/server';
import { todayTop } from '@/lib/today';
import { dailyRace, KN } from '@/lib/race';
import { Logo, IconArrow, IconPlay, IconWind, IconSail, clock } from '@/components/ui';
import { RacePill, TileRow, MyRow, HeroScene } from '@/components/home-client';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { FaqList } from '@/components/faq-list';
import { faqGroups, HOME } from '@/lib/faq';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getT();
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
        screenshot: [`${SITE}/images/hud-desk-v3.jpg`, `${SITE}/images/top-v3.jpg`],
        genre: ['Sailing', 'Racing', 'Sports simulation'], gamePlatform: ['Web browser', 'Mobile web browser'],
        applicationCategory: 'GameApplication', operatingSystem: 'Any (runs in a web browser)', playMode: 'SinglePlayer',
        gameLocation: t('Göcek bay, Turkey', 'Бухта Гёчек, Турция'), isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${SITE}/race` },
        author: { '@id': org['@id'] }, publisher: { '@id': org['@id'] },
        potentialAction: { '@type': 'PlayAction', target: `${SITE}/race` },
      },
    ],
  };
}

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
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const live = today && today.d === d.day ? today : null;
  const top = live ? live.top : [];
  const best = top[0];

  const tiles: [string, string, string, string][] = [
    ['h-wind', '/help#h-wind', t('Wind that won’t sit still', 'Ветер, который не стоит на месте'), t('Shifts of 10° and more a minute, gusts and lulls. Races are won on them', 'Заходы на 10° и больше каждую минуту, порывы и затишья. На них и выигрывают')],
    ['h-start', '/help#h-start', t('A start like the real thing', 'Старт как в жизни'), t('Class flag, P, one minute, then the gun. Over early? Go back', 'Флаг класса, P, минута — и сигнал. Фальстарт? Назад за линию')],
    ['h-trim', '/help#h-controls', t('Sails in your hands', 'Паруса в твоих руках'), t('Main and jib on their own sheets, or auto-trim while you steer', 'Грот и стаксель на своих шкотах или автонастройка, а ты только рулишь')],
    ['h-view-drone', '/help#h-rules', t('Rivals who know their rights', 'Соперники знают свои права'), t('Up to six computer boats that hail, give way and do their penalty turns', 'До шести компьютерных лодок: окликают, уступают и крутят штрафные обороты')],
    ['h-tack', '/help#h-controls', t('Tacks, gybes and the kite', 'Повороты и генакер'), t('Tack on the headers, hoist the gennaker for the run home', 'Поворачивай на заходах, ставь генакер на попутном к финишу')],
    ['h-steer', '/help#h-controls', t('A phone or a keyboard', 'Телефон или клавиатура'), t('Steer with your thumb, upright or sideways, or with the arrow keys', 'Рули пальцем, вертикально или горизонтально, или стрелками')],
    ['h-view-helm', '/help#h-views', t('From the helm', 'С руля'), t('Sail from the cockpit, with Göcek’s hills all around', 'Веди яхту из кокпита, а вокруг — холмы Гёчека')],
    ['h-view-top', '/help#h-views', t('From above', 'Сверху'), t('The whole course, the lay lines and every boat at a glance', 'Вся дистанция, лейлайны и все лодки одним взглядом')],
  ];
  // the hero's still: the wide picture on a wide screen, the upright one on a phone — one <picture>, so a browser
  // fetches only the one it shows (two <Image>s hidden by CSS each got fetched, at high priority)
  const hero = { alt: '', fill: true, sizes: '100vw', fetchPriority: 'high', loading: 'eager' } as const;
  const heroWide = getImageProps({ ...hero, src: '/images/drone-desk-v3.jpg' }).props.srcSet;
  const { alt: _alt, ...heroNarrow } = getImageProps({ ...hero, src: '/images/drone-port-v3.jpg' }).props;
  const all = faqGroups(t).flatMap((g) => g.items);
  const faq = HOME.map((id) => all.find((f) => f.id === id)!);

  return (
    <div className="scr help home" lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteLd(lang, t))} />
      <SiteHead lang={lang} t={t} account={account} page="home" />

      <div className="hm-hero">
        <picture>
          <source media="(min-width: 600px)" srcSet={heroWide} sizes="100vw" />
          <img className="bgimg" {...heroNarrow} alt="" />
        </picture>
        <HeroScene title={t('A race in the game', 'Гонка в игре')} />
        <section className="hm-page hm-hero-in" aria-labelledby="home-h1">
          <span className="kicker">{t('Up and down · a sailing race game by RYC', 'Up and down · парусная гонка от RYC')}</span>
          <h1 className="hm-display" id="home-h1">{t('Win the start. Play the shifts. Race by the real rules.', 'Возьми старт. Лови заходы. Гоняйся по настоящим правилам.')}</h1>
          <p className="hm-lead">{t(
            `Today, ${date}: ${breeze} of ${kn} knots in Göcek bay, ${d.fleet} boats on the line, one ${length} lap up and down. Everyone sails the same race, so the only thing between you and the top of the ranking is how you sail it. A free online sailing game, a yacht race simulator right in the browser, no sign-in to play.`,
            `Сегодня, ${date}: ${breeze} ${kn} узлов в бухте Гёчек, ${ruBoats(d.fleet)} на линии, один ${length} круг апвинд — даунвинд. У всех одна и та же гонка, так что между тобой и первой строчкой рейтинга — только то, как ты её пройдёшь. Бесплатный парусный симулятор онлайн, прямо в браузере, играть можно без входа.`)}</p>
          <span className="meta hm-asof">{t(`Today’s race · ${date} · a new one every midnight UTC`, `Гонка дня · ${date} · новая каждую полночь по UTC`)}</span>
          <RacePill lang={lang} daily={d} />
          <Link className="hm-src" href="/help">{t('How a race goes', 'Как проходит гонка')}<IconArrow s={14} /></Link>
        </section>
      </div>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="h-parts">
          <TileRow lang={lang} head={
            <div className="hm-sec-t"><span className="kicker">{t('Inside the game', 'Внутри игры')}</span><h2 className="hm-h2" id="h-parts">{t('Everything a real race throws at you', 'Всё, чем встречает настоящая гонка')}</h2></div>
          }>
            {tiles.map(([img, href, title, meta]) => (
              <Link className="hm-tile" href={href} key={img}>
                <span className="hm-photo hm-sq"><Image src={`/images/${img}-v3.jpg`} alt="" fill sizes="180px" /></span>
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
            <span className="kicker">{t('Today’s race · one race, one ranking', 'Гонка дня · одна гонка, один рейтинг')}</span>
            <h2 className="hm-h2" id="h-today">{best
              ? t(`${live!.races} races sailed today. The time to beat: ${clock(best.s)}`, `Заездов сегодня: ${live!.races}. Время, которое надо побить, — ${clock(best.s)}`)
              : t('Nobody has finished yet. Set the time to beat', 'Ещё никто не финишировал. Задай время, которое будут бить')}</h2>
          </div>
          <Link className="hm-src" href="/race">{t('Race hub', 'Меню гонок')}<IconArrow s={14} /></Link>
        </div>
        <div className="hm-today">
          <a className="hm-course" href="/play?race=today">
            <span className="hm-photo hm-wide">
              <span className="hm-clip"><Image src="/images/top-v3.jpg" alt={t('Today’s course from above', 'Дистанция дня сверху')} fill sizes="(min-width: 900px) 640px, 100vw" /></span>
              <span className="hm-ptag"><span className="hm-ptag-a">{kn} {t('kn', 'уз')}</span><span className="hm-ptag-b"><span>{t('Today', 'Сегодня')}</span><b>{t(`${d.laps} lap`, `${d.laps} круг`)}</b><span>{t(`${d.fleet} boats`, `${ruBoats(d.fleet)}`)}</span></span></span>
            </span>
            <span className="card-title">{t(`Up and down · ${length} course · ${d.laps} lap`, `Апвинд — даунвинд · ${length} · ${d.laps} круг`)}</span>
            <span className="hm-facts">
              <span><IconWind s={15} />{windName}, {kn} {t('kn', 'уз')}</span>
              <span><IconSail s={15} />{t(`${d.fleet} boats`, `${ruBoats(d.fleet)}`)}</span>
              <span>{t(`${d.start}-minute start`, `старт ${d.start} мин`)}</span>
              {d.current ? <span>{t('A current', 'Течение')}</span> : null}
            </span>
          </a>
          <div className="hm-board">
            <div className="hm-board-h"><span className="meta ink">{t('Today’s fastest', 'Самые быстрые сегодня')}</span><span className="meta">{windName} · {kn} {t('kn', 'уз')} · {t(`${d.fleet} boats`, ruBoats(d.fleet))}</span></div>
            <ol className="hm-lb">
              {top.map((r, i) => (
                <li key={i} className={i === 0 ? 'first' : ''}>
                  <span className="hm-n">{i + 1}</span><span>{r.name || t('Guest', 'Гость')}</span>
                  <span className="hm-t">{clock(r.s)}{i > 0 && best ? <small>+{(r.s - best.s).toFixed(1)}</small> : null}</span>
                </li>
              ))}
              {!top.length && <li><span className="hm-n">·</span><span className="hm-muted">{t('No times yet today', 'Сегодня ещё нет результатов')}</span><span /></li>}
              <MyRow lang={lang} day={d.day} signedIn={!!account} top={top} />
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
          <li><span className="hm-num">1</span><span className="hm-step-t"><span className="hm-h3">{t('Pick a race', 'Выбери гонку')}</span><span className="hm-text">{t('Today’s race is the same for everyone. A free race is yours to set up: the wind, the fleet, the course. Either starts in one tap.', 'Гонка дня одна для всех. Свободную настраиваешь сам: ветер, флот, дистанцию. Любая начинается в одно касание.')}</span></span></li>
          <li><span className="hm-num">2</span><span className="hm-step-t"><span className="hm-h3">{t('Win the start', 'Выиграй старт')}</span><span className="hm-text">{t('Hover below the line while the minute runs down, then cross it at full speed on the gun. Go too soon and the X flag sends you back.', 'Держись под линией, пока идёт минута, и пересеки её на полном ходу с сигналом. Поспешишь — флаг X отправит назад.')}</span></span></li>
          <li><span className="hm-num">3</span><span className="hm-step-t"><span className="hm-h3">{t('Round the marks', 'Обойди знаки')}</span><span className="hm-text">{t('Work the shifts up to the windward mark, run back down through the gate and take the gun. Signed in, your time goes on today’s ranking.', 'Лови заходы на лавировке к верхнему знаку, спустись через ворота и финишируй. Если ты вошёл, время попадёт в рейтинг дня.')}</span></span></li>
        </ol>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="h-num">
          <div className="hm-sec-t"><span className="kicker">{t('RYC race office', 'Гоночный комитет RYC')}</span><h2 className="hm-h2" id="h-num">{t('The game in numbers', 'Игра в цифрах')}</h2></div>
          <dl className="hm-stats">
            <div><dt className="meta">{t('Wind', 'Ветер')}</dt><dd className="hm-stat-v">{KN.light}–{KN.strong} {t('kn', 'уз')}</dd><dd className="hm-meta">{t('From light air to a breeze you reef for', 'От лёгкого ветра до такого, что берут рифы')}</dd></div>
            <div><dt className="meta">{t('Fleet', 'Флот')}</dt><dd className="hm-stat-v">3 · 5 · 7</dd><dd className="hm-meta">{t('Boats on the line, every one sailing by the rules', 'Лодок на линии, и все ходят по правилам')}</dd></div>
            <div><dt className="meta">{t('Shifts', 'Заходы')}</dt><dd className="hm-stat-v">10°+</dd><dd className="hm-meta">{t('Every minute. Catch them or lose places', 'Каждую минуту. Лови их или теряй места')}</dd></div>
            <div><dt className="meta">{t('Race of the day', 'Гонка дня')}</dt><dd className="hm-stat-v">1</dd><dd className="hm-meta">{t('One for everyone, a new one every midnight', 'Одна на всех, новая каждую полночь')}</dd></div>
          </dl>
          <p className="hm-cite">{t('Free · no install · phone or computer · English and Russian.', 'Бесплатно · без установки · телефон или компьютер · английский и русский.')}<a className="hm-src" href="#faq">{t('Questions', 'Вопросы')}<IconArrow s={14} /></a></p>
        </section>
      </div>

      <section className="hm-page hm-sec" id="faq" aria-labelledby="h-faq">
        <div className="hm-faq">
          <div className="hm-faq-side">
            <span className="kicker">{t('Questions', 'Вопросы')}</span>
            <h2 className="hm-h2" id="h-faq">{t('In short', 'Коротко')}</h2>
            <p className="hm-text">{t(`Six to start with. ${all.length - faq.length} more on sailing, the rules and your boat are on the Questions page.`, `Шесть для начала. Ещё ${all.length - faq.length} — об управлении, правилах и яхте — на странице «Вопросы».`)}</p>
            <Link className="hm-src" href="/faq">{t('All questions', 'Все вопросы')}<IconArrow s={14} /></Link>
          </div>
          <FaqList items={faq} openFirst />
        </div>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec hm-help" aria-labelledby="h-rules">
          <div className="hm-help-main">
            <span className="kicker">Sailing Certification Test</span>
            <h2 className="hm-h2" id="h-rules">{t('Learn the rules there, race by them here', 'Учи правила там, гоняйся по ним здесь')}</h2>
            <p className="hm-text">{t('Up and down comes from RYC, the team behind Sailing Certification Test, the free trainer for sailing certificate exams. The computer boats give way by the same rules the exam asks about, so every race is revision you can feel on the water.', 'Up and down делает RYC — команда, которая сделала Sailing Certification Test, бесплатный тренажёр к экзаменам на яхтенные сертификаты. Компьютерные лодки уступают по тем же правилам, что спрашивают на экзамене, так что каждая гонка — повторение, которое чувствуешь на воде.')}</p>
            <a className="hm-app" href="https://iyt.rycrentals.com/">
              <span className="hm-app-ic"><Logo /></span>
              <span className="hm-app-t"><span className="hm-app-n">Sailing Certification Test</span><span className="meta">{t('Exam practice · 6100 questions', 'Подготовка к экзамену · 6100 вопросов')}</span></span>
              <span className="hm-app-go" aria-hidden="true"><IconArrow s={20} /></span>
            </a>
          </div>
          <div className="hm-help-side">
            <span className="meta">{t('Rules you meet on the first beat', 'Правила, которые встретишь на первой лавировке')}</span>
            <ol className="hm-tips">
              <li><span className="hm-num">1</span><span>{t('Port gives way to starboard', 'Левый галс уступает правому')}</span><span className="meta">{t('Rule 10', 'Правило 10')}</span></li>
              <li><span className="hm-num">2</span><span>{t('Windward boat keeps clear', 'Наветренная уступает')}</span><span className="meta">{t('Rule 11', 'Правило 11')}</span></li>
              <li><span className="hm-num">3</span><span>{t('A tacking boat keeps clear', 'Поворачивающая уступает')}</span><span className="meta">{t('Rule 13', 'Правило 13')}</span></li>
            </ol>
          </div>
        </section>
      </div>

      <SiteFoot lang={lang} t={t} account={account} back="/" />
    </div>
  );
}
