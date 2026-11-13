import Link from 'next/link';
import { getT, titled } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { SiteHead } from '@/components/site-chrome';
import { SettingsForm } from '@/components/settings-form';

export const generateMetadata = titled('Settings', 'Настройки', { index: false });

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
  const via = account?.provider === 'google' ? 'Google' : account?.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте');
  return (
    <div className="scr app" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} account={account} page="settings" />
      <div className="lay page">
        <div className="aph">
          <div className="aph-top">
            <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <span className="kicker">{t('Settings', 'Настройки')}</span>
          </div>
          <h1 className="aph-h">{t('Sailing, screen and sound', 'Яхта, экран и звук')}</h1>
        </div>
        <SettingsForm lang={lang} langRow={langRow} accountRow={account ? (
              <div className="acct acct-row">
                <span className="avatar">{initials(account.name, account.email)}</span>
                <div className="acct-guest">
                  <span className="card-title">{account.name || account.email}</span>
                  <span className="small">{[account.email, via].filter(Boolean).join(' · ')}</span>
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
