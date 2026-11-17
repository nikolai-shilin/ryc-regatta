import { Fragment } from 'react';
import Link from 'next/link';
import type { Lang, T } from '@/lib/lang';
import { SITE, jsonLd, langUrl } from '@/lib/seo';
import { Logo, Langs } from './ui';
import { SiteMenu } from './home-client';

type Page = 'home' | 'help' | 'faq' | 'race' | 'free' | 'boat' | 'result' | 'settings' | 'signin' | 'iyt' | 'learn' | 'rating' | 'drills' | 'badges' | 'social' | 'players' | 'venues' | 'yachts';

// Where each page sits under Home, for the breadcrumb trail search engines show instead of the bare address
// (BreadcrumbList). A guide passes its own trail: Home › Learn to race › the guide.
export type Crumb = [name: string, path: string];
const CRUMBS: Partial<Record<Page, [en: string, ru: string, path: string]>> = {
  help: ['How to play', 'Как играть', '/help'], faq: ['Questions', 'Вопросы', '/faq'], race: ['Today’s race', 'Гонка дня', '/race'],
  free: ['Free race', 'Свободная гонка', '/race/free'], boat: ['Your boat', 'Твоя яхта', '/boat'],
  iyt: ['Sailing Certification Test', 'Sailing Certification Test', '/iyt'], learn: ['Learn to race', 'Учись гоняться', '/learn'],
  drills: ['Drills', 'Тренировки', '/race/drills'], badges: ['Badges', 'Достижения', '/race/badges'],
  social: ['Follow the game', 'Игра в соцсетях', '/social'], players: ['The players', 'Игроки', '/players'],
  venues: ['The venues', 'Акватории', '/venues'], yachts: ['The yachts', 'Яхты', '/yachts'],
};
function Breadcrumbs({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const c = CRUMBS[page];
  const trail: Crumb[] = crumbs || (c ? [[t(c[0], c[1]), c[2]]] : []);
  if (!trail.length) return null;
  const items = [[t('Home', 'Главная'), '/'] as Crumb, ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + langUrl(path, lang) }));
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })} />;
}

// The same trail where the reader sees it, over a guide's or the glossary's head: without Home (the name in the header
// goes there), the last step the page itself.
export function Trail({ t, crumbs }: { t: T; crumbs: Crumb[] }) {
  return (
    <nav className="rd-trail" aria-label={t('Breadcrumb', 'Навигационная цепочка')}>
      {crumbs.map(([name, path], i) => (i < crumbs.length - 1
        ? <Fragment key={path}><Link href={path}>{name}</Link><span aria-hidden="true">/</span></Fragment>
        : <span key={path} aria-current="page">{name}</span>))}
    </nav>
  );
}

// The site's header, as on rycrentals.com: the logo, the site's pages in the middle (from 1100 px wide), and the menu
// (the burger and your avatar) at the right; your account, your boat, passport and badges, How to play and Learn to race
// are in the menu alone. On a page in the broadcast look (.bc, styles/broadcast.css) it is the
// broadcast's bar: the name with the blue mark, the pages as tabs (from 1280 px wide; those marked hm-tab-x from
// 1600), Sign in (a guest's) and Play now beside the menu. On every page: the scrolling ones (home, help, the race result) and the
// app screens, where it sits over the screen and stays short on a phone held sideways.
// Who is signed in isn't known here (the pages are cached): the avatar and the account link are filled in by lib/me.ts.
export function SiteHead({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const cur = (p: Page) => (p === page ? ({ 'aria-current': 'page' } as const) : {});
  return (
    <header className="hm-head">
      <Breadcrumbs lang={lang} t={t} page={page} crumbs={crumbs} />
      <div className="hm-page hm-head-in">
        <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /><span className="hm-brand-t">Up and down</span></Link>
        <nav className="hm-nav" aria-label={t('Main', 'Главное')}>
          <Link className="hm-tab" href="/race" {...cur('race')}>{t('Today’s race', 'Гонка дня')}</Link>
          <Link className="hm-tab" href="/race/free" {...cur('free')}>{t('Free race', 'Свободная гонка')}</Link>
          <Link className="hm-tab" href="/race/drills" {...cur('drills')}>{t('Drills', 'Тренировки')}</Link>
          <Link className="hm-tab" href="/race/rating" {...cur('rating')}>{t('Rating', 'Рейтинг')}</Link>
          <Link className="hm-tab" href="/players" {...cur('players')}>{t('Players', 'Игроки')}</Link>
          <Link className="hm-tab hm-tab-x" href="/venues" {...cur('venues')}>{t('Venues', 'Акватории')}</Link>
          <Link className="hm-tab hm-tab-x" href="/yachts" {...cur('yachts')}>{t('Yachts', 'Яхты')}</Link>
          <Link className="hm-tab hm-tab-x" href="/faq" {...cur('faq')}>{t('Questions', 'Вопросы')}</Link>
        </nav>
        {/* a guest's way to sign in, in the bar where there's room (else in the menu); signed in, the avatar says who */}
        <Link className="hm-signin if-guest" href="/sign-in" {...cur('signin')}>{t('Sign in', 'Войти')}</Link>
        {/* the broadcast look's way in, always at hand (hidden in the old look, styles/ryc.css) */}
        <a className="hm-play" href="/play?race=today">{t('Play now', 'Играть')}</a>
        <SiteMenu lang={lang} />
      </div>
    </header>
  );
}

// The site's footer, one bar as the broadcast's: who makes it, a short row of links (the reading pages, your account or
// the way to sign in, RYC's own sites), and the language switch; under them, that the game has nothing to do with the
// America's Cup, whose boat it sails (the AC75).
export function SiteFoot({ lang, t, back }: { lang: Lang; t: T; back: string }) {
  return (
    <div className="hm-page hm-foot-wrap">
      <footer className="hm-foot">
        <span className="hm-foot-by">{t('Up and down · RYC race office', 'Up and down · офис регаты RYC')}</span>
        <nav className="hm-foot-links" aria-label={t('More', 'Ещё')}>
          <Link href="/yachts">{t('The yachts', 'Яхты')}</Link>
          <Link href="/venues">{t('The venues', 'Акватории')}</Link>
          <Link href="/players">{t('The players', 'Игроки')}</Link>
          <Link href="/help">{t('How to play', 'Как играть')}</Link>
          <Link href="/learn">{t('Learn to race', 'Учись гоняться')}</Link>
          <Link href="/race/drills">{t('Drills', 'Тренировки')}</Link>
          <Link href="/race/badges">{t('Badges', 'Достижения')}</Link>
          <Link href="/passport">{t('Your passport', 'Твой паспорт')}</Link>
          <Link href="/faq">{t('Questions', 'Вопросы')}</Link>
          <Link href="/social">{t('Follow the game', 'Игра в соцсетях')}</Link>
          <Link className="if-me me-name" href="/settings" /><Link className="if-guest" href="/sign-in">{t('Sign in', 'Войти')}</Link>
          <a href="https://www.rycrentals.com/">rycrentals.com</a>
          <a href="https://www.rycsailing.com/">rycsailing.com</a>
        </nav>
        <Langs lang={lang} back={back} />
        <p className="hm-foot-note">{t('This simulator is an independent project and is not affiliated with, sponsored by, or endorsed by America’s Cup or its organizers.',
          'Этот симулятор — независимый проект, не связанный с America’s Cup и его организаторами, не спонсируемый и не одобренный ими.')}</p>
      </footer>
    </div>
  );
}
