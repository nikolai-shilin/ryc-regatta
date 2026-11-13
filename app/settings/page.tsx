import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
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
    <div className="scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="lay page">
        <div className="lhead" style={{ gap: 14 }}>
          <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span className="kicker">Up and down</span>
            <h1 className="h-land-s">{t('Settings', 'Настройки')}</h1>
          </div>
          <span className="sp" />
          <Link className="pill pill-primary pill-xs" href="/race" style={{ flex: 'none' }}><span className="btn-t">{t('Done', 'Готово')}</span></Link>
        </div>
        <SettingsForm lang={lang} langRow={langRow} accountRow={account ? (
              <div className="acct acct-row">
                <span className="avatar">{initials(account.name, account.email)}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="card-title">{account.name || account.email}</span>
                  <span className="small">{account.email} · {via}</span>
                </div>
                <Link className="mini" href="/sign-in/name?next=/settings"><span className="btn-t">{t('Name', 'Имя')}</span></Link>
                <form action="/auth/sign-out" method="post"><button className="mini" type="submit"><span className="btn-t">{t('Sign out', 'Выйти')}</span></button></form>
              </div>
            ) : (
              <div className="acct acct-row">
                <span className="small" style={{ flex: '1 1 auto' }}>{t('Playing as a guest: your times stay on this device.', 'Ты играешь как гость: результаты только на этом устройстве.')}</span>
                <Link className="pill pill-xs" href="/sign-in?next=/settings" style={{ flex: 'none' }}><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
              </div>
            )} />
      </div>
    </div>
  );
}
