import Link from 'next/link';
import type { Lang, T } from '@/lib/lang';
import { SITE, jsonLd, langUrl } from '@/lib/seo';
import { Logo, Langs } from './ui';
import { SiteMenu } from './home-client';

type Page = 'home' | 'help' | 'faq' | 'race' | 'free' | 'boat' | 'result' | 'settings' | 'signin' | 'iyt' | 'learn' | 'rating';

// Where each page sits under Home, for the breadcrumb trail search engines show instead of the bare address
// (BreadcrumbList). A guide passes its own trail: Home › Learn to race › the guide.
type Crumb = [name: string, path: string];
const CRUMBS: Partial<Record<Page, [en: string, ru: string, path: string]>> = {
  help: ['How to play', 'Как играть', '/help'], faq: ['Questions', 'Вопросы', '/faq'], race: ['Today’s race', 'Гонка дня', '/race'],
  free: ['Free race', 'Свободная гонка', '/race/free'], boat: ['Your boat', 'Твоя яхта', '/boat'],
  iyt: ['Sailing Certification Test', 'Sailing Certification Test', '/iyt'], learn: ['Learn to race', 'Учись гоняться', '/learn'],
};
function Breadcrumbs({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const c = CRUMBS[page];
  const trail: Crumb[] = crumbs || (c ? [[t(c[0], c[1]), c[2]]] : []);
  if (!trail.length) return null;
  const items = [[t('Home', 'Главная'), '/'] as Crumb, ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + langUrl(path, lang) }));
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })} />;
}

// The site's header, as on rycrentals.com: the logo, the site's pages in the middle (from 1100 px wide), and the menu
// (the burger and your avatar) at the right. On a page in the broadcast look (.bc, styles/broadcast.css) it is the
// broadcast's bar: the name with the blue mark, the pages as tabs, Play now beside the menu. On every page: the scrolling ones (home, help, the race result) and the
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
          <Link className="hm-tab" href="/help" {...cur('help')}>{t('How to play', 'Как играть')}</Link>
          <Link className="hm-tab" href="/race" {...cur('race')}>{t('Today’s race', 'Гонка дня')}</Link>
          <Link className="hm-tab" href="/race/rating" {...cur('rating')}>{t('Rating', 'Рейтинг')}</Link>
          <Link className="hm-tab" href="/race/free" {...cur('free')}>{t('Free race', 'Свободная гонка')}</Link>
          <Link className="hm-tab" href="/boat" {...cur('boat')}>{t('Your boat', 'Твоя яхта')}</Link>
          <Link className="hm-tab" href="/faq" {...cur('faq')}>{t('Questions', 'Вопросы')}</Link>
          <Link className="hm-tab" href="/iyt" {...cur('iyt')}>{'Sailing Certification Test'}</Link>
        </nav>
        {/* the broadcast look's way in, always at hand (hidden in the old look, styles/ryc.css) */}
        <a className="hm-play" href="/play?race=today">{t('Play now', 'Играть')}</a>
        <SiteMenu lang={lang} />
      </div>
    </header>
  );
}

// The site's footer: the logo, three columns of links, the language switch.
export function SiteFoot({ lang, t, back }: { lang: Lang; t: T; back: string }) {
  return (
    <div className="hm-page hm-foot-wrap">
      <footer className="hm-foot">
        <Link className="hm-brand" href="/" aria-label="RYC"><Logo /></Link>
        <div className="hm-foot-col"><span className="meta">{t('Game', 'Игра')}</span><Link href="/help">{t('How to play', 'Как играть')}</Link><Link href="/race">{t('Today’s race', 'Гонка дня')}</Link><Link href="/race/rating">{t('Rating', 'Рейтинг')}</Link><Link href="/race/free">{t('Free race', 'Свободная гонка')}</Link><Link href="/boat">{t('Your boat', 'Твоя яхта')}</Link><Link href="/learn">{t('Learn to race', 'Учись гоняться')}</Link><Link href="/settings">{t('Settings', 'Настройки')}</Link></div>
        <div className="hm-foot-col"><span className="meta">{t('Account', 'Аккаунт')}</span><Link className="if-me me-name" href="/settings" /><Link className="if-guest" href="/sign-in">{t('Sign in', 'Войти')}</Link><Link href="/faq">{t('Questions', 'Вопросы')}</Link></div>
        <div className="hm-foot-col"><span className="meta">RYC</span><a href="https://www.rycrentals.com/">rycrentals.com</a><a href="https://www.rycsailing.com/">rycsailing.com</a><Link href="/iyt">{'Sailing Certification Test'}</Link></div>
        <Langs lang={lang} back={back} />
      </footer>
    </div>
  );
}
