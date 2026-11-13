import Link from 'next/link';
import type { Lang, T } from '@/lib/lang';
import { initials, type Account } from '@/lib/supabase/server';
import { Logo, Langs } from './ui';
import { SiteMenu } from './home-client';

type Page = 'home' | 'help' | 'faq' | 'race' | 'free' | 'boat' | 'result' | 'settings' | 'signin';

// The site's header, as on rycrentals.com: the logo, the site's pages in the middle (from 1100 px wide), and the menu
// (the burger and your avatar) at the right. On every page: the scrolling ones (home, help, the race result) and the
// app screens, where it sits over the screen and stays short on a phone held sideways.
export function SiteHead({ lang, t, account, page }: { lang: Lang; t: T; account: Account; page: Page }) {
  const cur = (p: Page) => (p === page ? ({ 'aria-current': 'page' } as const) : {});
  return (
    <header className="hm-head">
      <div className="hm-page hm-head-in">
        <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /></Link>
        <nav className="hm-nav" aria-label={t('Main', 'Главное')}>
          <Link className="hm-tab" href="/help" {...cur('help')}>{t('How to play', 'Как играть')}</Link>
          <Link className="hm-tab" href="/race" {...cur('race')}>{t('Today’s race', 'Гонка дня')}</Link>
          <Link className="hm-tab" href="/race/free" {...cur('free')}>{t('Free race', 'Свободная гонка')}</Link>
          <Link className="hm-tab" href="/boat" {...cur('boat')}>{t('Your boat', 'Твоя яхта')}</Link>
          <Link className="hm-tab" href="/faq" {...cur('faq')}>{t('Questions', 'Вопросы')}</Link>
          <a className="hm-tab" href="https://iyt.rycrentals.com/">{t('IYT Test', 'Тест IYT')}</a>
        </nav>
        <SiteMenu lang={lang} initials={account ? initials(account.name, account.email) : null} />
      </div>
    </header>
  );
}

// The site's footer: the logo, three columns of links, the language switch.
export function SiteFoot({ lang, t, account, back }: { lang: Lang; t: T; account: Account; back: string }) {
  return (
    <div className="hm-page hm-foot-wrap">
      <footer className="hm-foot">
        <Link className="hm-brand" href="/" aria-label="RYC"><Logo /></Link>
        <div className="hm-foot-col"><span className="meta">{t('Game', 'Игра')}</span><Link href="/help">{t('How to play', 'Как играть')}</Link><Link href="/race">{t('Today’s race', 'Гонка дня')}</Link><Link href="/race/free">{t('Free race', 'Свободная гонка')}</Link><Link href="/boat">{t('Your boat', 'Твоя яхта')}</Link><Link href="/settings">{t('Settings', 'Настройки')}</Link></div>
        <div className="hm-foot-col"><span className="meta">{t('Account', 'Аккаунт')}</span>{account ? <Link href="/settings">{account.name || account.email}</Link> : <Link href="/sign-in">{t('Sign in', 'Войти')}</Link>}<Link href="/faq">{t('Questions', 'Вопросы')}</Link></div>
        <div className="hm-foot-col"><span className="meta">RYC</span><a href="https://www.rycrentals.com/">rycrentals.com</a><a href="https://www.rycsailing.com/">rycsailing.com</a><a href="https://iyt.rycrentals.com/">{t('IYT Test', 'Тест IYT')}</a></div>
        <Langs lang={lang} back={back} />
      </footer>
    </div>
  );
}
