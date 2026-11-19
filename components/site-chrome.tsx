import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type { Lang, T } from '@/lib/lang';
import { SITE, jsonLd, langUrl } from '@/lib/seo';
import { Logo, Langs } from './ui';
import { SiteMenu } from './home-client';

type Page = 'home' | 'help' | 'faq' | 'race' | 'free' | 'boat' | 'result' | 'settings' | 'signin' | 'iyt' | 'learn' | 'rating' | 'drills' | 'social' | 'players' | 'venues' | 'yachts' | 'sponsorship' | 'rulebook';

// Where each page sits under Home, for the breadcrumb trail search engines show instead of the bare address
// (BreadcrumbList). A guide passes its own trail: Home › Racing guides › the guide.
export type Crumb = [name: string, path: string];
const CRUMBS: Partial<Record<Page, [en: string, ru: string, path: string, es?: string]>> = {
  help: ['How to play', 'Как играть', '/help', 'Cómo jugar'], faq: ['FAQ', 'Вопросы и ответы', '/faq', 'Preguntas'], race: ['Today’s race', 'Гонка дня', '/race', 'La regata del día'],
  free: ['Custom race', 'Своя гонка', '/race/free', 'Regata libre'], boat: ['Your yacht', 'Твоя яхта', '/boat', 'Tu yate'],
  iyt: ['Sailing exam practice', 'Тренажёр к яхтенному экзамену', '/iyt', 'Práctica de examen de vela'], learn: ['Racing guides', 'Пособия по гонкам', '/learn', 'Guías de regata'],
  drills: ['Drills', 'Тренировки', '/race/drills', 'Ejercicios'],
  social: ['Social media', 'Соцсети', '/social', 'Redes sociales'], players: ['The players', 'Игроки', '/players', 'Los jugadores'],
  venues: ['The venues', 'Акватории', '/venues', 'Las sedes'], yachts: ['The yachts', 'Яхты', '/yachts', 'Los yates'],
  sponsorship: ['Sponsorship', 'Спонсорство', '/sponsorship', 'Patrocinio'], rulebook: ['Racing rules', 'Правила гонок', '/rulebook', 'Reglas de regata'],
};
function Breadcrumbs({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const c = CRUMBS[page];
  const trail: Crumb[] = crumbs || (c ? [[t(c[0], c[1], c[3]), c[2]]] : []);
  if (!trail.length) return null;
  const items = [[t('Home', 'Главная', 'Inicio'), '/'] as Crumb, ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + langUrl(path, lang) }));
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })} />;
}

// The same trail where the reader sees it, over a guide's or the glossary's head: without Home (the name in the header
// goes there), the last step the page itself.
export function Trail({ t, crumbs }: { t: T; crumbs: Crumb[] }) {
  return (
    <nav className="rd-trail" aria-label={t('Breadcrumb', 'Навигационная цепочка', 'Ruta de navegación')}>
      {crumbs.map(([name, path], i) => (i < crumbs.length - 1
        ? <Fragment key={path}><Link href={path}>{name}</Link><span aria-hidden="true">/</span></Fragment>
        : <span key={path} aria-current="page">{name}</span>))}
    </nav>
  );
}

// The site's header, as on rycrentals.com: the logo, the site's pages in the middle (from 1100 px wide), and the menu
// (the burger and your avatar) at the right; your account, your boat and passport, How to play, Racing guides,
// Racing rules and FAQ are in the menu alone. On a page in the broadcast look (.bc, styles/broadcast.css) it is the
// broadcast's bar: the name with the blue mark, the pages as tabs (from 1280 px wide; Venues and Yachts, hm-tab-x,
// from 1360), Sign in (a guest's) and Play now beside the menu. On every page: the scrolling ones (home, help, the race result) and the
// app screens, where it sits over the screen and stays short on a phone held sideways.
// Who is signed in isn't known here (the pages are cached): the avatar and the account link are filled in by lib/me.ts.
export function SiteHead({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const cur = (p: Page) => (p === page ? ({ 'aria-current': 'page' } as const) : {});
  return (
    <header className="hm-head">
      <Breadcrumbs lang={lang} t={t} page={page} crumbs={crumbs} />
      <div className="hm-page hm-head-in">
        <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /><span className="hm-brand-t">Up and down</span></Link>
        <nav className="hm-nav" aria-label={t('Main', 'Главное', 'Principal')}>
          <Link className="hm-tab" href="/race" {...cur('race')}>{t('Today’s race', 'Гонка дня', 'La regata del día')}</Link>
          <Link className="hm-tab" href="/race/free" {...cur('free')}>{t('Custom race', 'Своя гонка', 'Regata personalizada')}</Link>
          <Link className="hm-tab" href="/match/new">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1')}</Link>
          <Link className="hm-tab" href="/race/drills" {...cur('drills')}>{t('Drills', 'Тренировки', 'Ejercicios')}</Link>
          <Link className="hm-tab" href="/race/rating" {...cur('rating')}>{t('Leaderboard', 'Рейтинг', 'Clasificación')}</Link>
          <Link className="hm-tab" href="/players" {...cur('players')}>{t('Players', 'Игроки', 'Jugadores')}</Link>
          <Link className="hm-tab hm-tab-x" href="/venues" {...cur('venues')}>{t('Venues', 'Акватории', 'Sedes')}</Link>
          <Link className="hm-tab hm-tab-x" href="/yachts" {...cur('yachts')}>{t('Yachts', 'Яхты', 'Yates')}</Link>
        </nav>
        {/* a guest's way to sign in, in the bar where there's room (else in the menu); signed in, the avatar says who */}
        <Link className="hm-signin if-guest" href="/sign-in" {...cur('signin')}>{t('Sign in', 'Войти', 'Iniciar sesión')}</Link>
        {/* the broadcast look's way in, always at hand (hidden in the old look, styles/ryc.css) */}
        <a className="hm-play" href="/play?race=today">{t('Play now', 'Играть', 'Jugar ya')}</a>
        <SiteMenu lang={lang} />
      </div>
    </header>
  );
}

function FootGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="hm-foot-g"><h2 className="hm-foot-h">{title}</h2><ul>{children}</ul></div>;
}
function FootLink({ href, only, children }: { href: string; only?: 'if-guest'; children: ReactNode }) {
  return <li className={only}><Link href={href}>{children}</Link></li>;
}

// The site's footer, the map of the site: the name, who makes it and the language switch, then every page that stands
// on its own in five columns (a venue, a yacht or a guide is found from its list); under them, that the game has nothing
// to do with the America's Cup, whose boat it sails (the AC75). Your account follows the menu: Settings for everyone, and
// Sign in for a guest.
export function SiteFoot({ lang, t, back }: { lang: Lang; t: T; back: string }) {
  return (
    <div className="hm-page hm-foot-wrap">
      <footer className="hm-foot">
        <div className="hm-foot-id">
          <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /><span className="hm-brand-t">Up and down</span></Link>
          <span className="hm-foot-by">{t('RYC race office', 'Офис регаты RYC', 'Oficina de regatas del RYC')}</span>
        </div>
        <Langs lang={lang} back={back} />
        <nav className="hm-foot-map" aria-label={t('All pages', 'Все страницы', 'Todas las páginas')}>
          <FootGroup title={t('Race', 'Гонки', 'Regata')}>
            <FootLink href="/race">{t('Today’s race', 'Гонка дня', 'La regata del día')}</FootLink>
            <FootLink href="/race/free">{t('Custom race', 'Своя гонка', 'Regata personalizada')}</FootLink>
            <FootLink href="/match/new">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1')}</FootLink>
            <FootLink href="/race/drills">{t('Drills', 'Тренировки', 'Ejercicios')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Explore', 'Мир игры', 'Explorar')}>
            <FootLink href="/race/rating">{t('Leaderboard', 'Рейтинг', 'Clasificación')}</FootLink>
            <FootLink href="/players">{t('Players', 'Игроки', 'Jugadores')}</FootLink>
            <FootLink href="/venues">{t('Venues', 'Акватории', 'Sedes')}</FootLink>
            <FootLink href="/yachts">{t('Yachts', 'Яхты', 'Yates')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Learn', 'Обучение', 'Aprender')}>
            <FootLink href="/help">{t('How to play', 'Как играть', 'Cómo jugar')}</FootLink>
            <FootLink href="/learn">{t('Racing guides', 'Пособия по гонкам', 'Guías de regatas')}</FootLink>
            <FootLink href="/rulebook">{t('Racing rules', 'Правила гонок', 'Reglas de regatas')}</FootLink>
            <FootLink href="/learn/glossary">{t('Glossary', 'Словарь', 'Glosario')}</FootLink>
            <FootLink href="/iyt">{t('Sailing exam practice', 'Тренажёр к яхтенному экзамену', 'Práctica del examen de vela')}</FootLink>
            <FootLink href="/faq">{t('FAQ', 'Вопросы и ответы', 'Preguntas')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Your account', 'Твой аккаунт', 'Tu cuenta')}>
            <FootLink href="/sign-in" only="if-guest">{t('Sign in', 'Войти', 'Iniciar sesión')}</FootLink>
            <FootLink href="/boat">{t('Your yacht', 'Твоя яхта', 'Tu yate')}</FootLink>
            <FootLink href="/players?me=1">{t('Your player card', 'Твоя карточка игрока', 'Tu tarjeta de jugador')}</FootLink>
            <FootLink href="/settings">{t('Settings', 'Настройки', 'Ajustes')}</FootLink>
          </FootGroup>
          <FootGroup title={t('About', 'О проекте', 'Acerca de')}>
            <FootLink href="/social">{t('Social media', 'Соцсети', 'Redes sociales')}</FootLink>
            <FootLink href="/sponsorship">{t('Sponsorship', 'Спонсорство', 'Patrocinio')}</FootLink>
            <li><a href="https://www.rycrentals.com/">RYC Rentals</a></li>
            <li><a href="https://www.rycsailing.com/">RYC Sailing</a></li>
          </FootGroup>
        </nav>
        <p className="hm-foot-note">{t('This simulator is an independent project and is not affiliated with, sponsored by, or endorsed by America’s Cup or its organizers.',
          'Этот симулятор — независимый проект, не связанный с America’s Cup и его организаторами, не спонсируемый и не одобренный ими.', 'Este simulador es un proyecto independiente y no está afiliado, patrocinado ni respaldado por la Copa América ni por sus organizadores.')}</p>
      </footer>
    </div>
  );
}
