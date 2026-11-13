import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { SiteHead } from '@/components/site-chrome';
import { SettingsForm } from '@/components/settings-form';

export const metadata: Metadata = { title: 'Settings' };

// S3 / A5 · Settings: the account on top, then one row per setting.
export default async function SettingsPage() {
  const [{ lang, t }, account] = await Promise.all([getT(), getAccount()]);
  const href = (to: string) => `/lang?to=${to}&back=/settings`;
  const langRow = (
    <div className="srow">
      <span className="srow-k">{t('Language', 'Язык')}</span>
      <nav className="segc" aria-label={t('Language', 'Язык')}>
        <a className={lang === 'en' ? 'on' : ''} href={href('en')}>English</a>
        <a className={lang === 'ru' ? 'on' : ''} href={href('ru')}>Русский</a>
      </nav>
    </div>
  );
  const via = account?.provider === 'google' ? 'Google' : t('email code', 'код по почте');
  return (
    <div className="scr app" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} account={account} page="settings" />
      <div className="lay page">
        <div className="lhead">
          <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
          <h1 className="h-land-s">{t('Settings', 'Настройки')}</h1>
        </div>
        <SettingsForm lang={lang} langRow={langRow} accountRow={account ? (
              <div className="acct acct-row">
                <span className="avatar">{initials(account.name, account.email)}</span>
                <div className="acct-guest">
                  <span className="card-title">{account.name || account.email}</span>
                  <span className="small">{account.email} · {via}</span>
                </div>
                <Link className="mini" href="/sign-in/name?next=/settings"><span className="btn-t">{t('Name', 'Имя')}</span></Link>
                <form action="/auth/sign-out" method="post"><button className="mini" type="submit"><span className="btn-t">{t('Sign out', 'Выйти')}</span></button></form>
              </div>
            ) : (
              <div className="acct acct-row">
                <div className="acct-guest">
                  <span className="srow-k">{t('Guest', 'Гость')}</span>
                  <span className="small">{t('Times stay on this device', 'Результаты только на этом устройстве')}</span>
                </div>
                <Link className="pill pill-xs" href="/sign-in?next=/settings"><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
              </div>
            )} />
      </div>
    </div>
  );
}
