import { DoneButton } from '@/components/done-button';
import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { dailyRace } from '@/lib/race';
import { IconBack } from '@/components/ui';
import { GameScene } from '@/components/game-scene';
import { SceneBrand } from '@/components/scene-brand';
import { NameRow, SettingsForm } from '@/components/settings-form';

export const generateMetadata = titled('Settings', 'Настройки', { index: false });

// S3 / A5 · Settings, as the race's pause screen: today's venue in the game's own scene behind (as the race hub has
// it), the heading on the left, and three cards on the right: the account, your boat and the language; sailing; the
// screen and the sound.
export default async function SettingsPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  const d = dailyRace();
  const href = (to: string) => `/lang?to=${to}&back=/settings`;
  const langSeg = (
    <nav className="segc" aria-labelledby="l-lang">
      <a className={lang === 'en' ? 'on' : ''} href={href('en')} aria-current={lang === 'en' ? 'true' : undefined}>English</a>
      <a className={lang === 'ru' ? 'on' : ''} href={href('ru')} aria-current={lang === 'ru' ? 'true' : undefined} lang="ru">Русский</a>
    </nav>
  );
  const via = account?.provider === 'google' ? 'Google' : account?.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте');
  const acct = account ? (<>
      <div className="acct acct-row">
        <span className="avatar">{initials(account.name, account.email)}</span>
        <div className="acct-guest">
          <span className="card-title">{account.name || account.email}</span>
          <span className="small">{[account.email, via].filter(Boolean).join(' · ')}</span>
        </div>
        <form action="/auth/sign-out" method="post"><button className="mini" type="submit"><span className="btn-t">{t('Sign out', 'Выйти')}</span></button></form>
      </div>
      <NameRow lang={lang} name={account.name} />
    </>) : (
      <div className="acct acct-row">
        <span className="avatar avatar-guest" aria-hidden="true">?</span>
        <div className="acct-guest">
          <span className="card-title">{t('Guest', 'Гость')}</span>
          <span className="small">{t('Times stay on this device', 'Результаты только на этом устройстве')}</span>
        </div>
        <Link className="pill pill-primary pill-xs" href="/sign-in?next=/settings"><span className="btn-t">{t('Sign in', 'Войти')}</span></Link>
      </div>
    );
  return (
    <div className="scr bt-scr bc st-scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="bt">
        <GameScene venue={d.venue} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D')} loading={t('Loading the venue', 'Загружаем место гонки')} />

        <div className="bt-info">
          <div className="bt-top">
            <Link className="bt-back" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
            <SceneBrand />
            <DoneButton label={t('Done', 'Готово')} />
          </div>
          <span className="bt-kick">{t('Settings', 'Настройки')}</span>
          <h1 className="bt-h">{t('Sailing, screen and sound', 'Яхта, экран и звук')}</h1>
          <p className="bt-p">{t('The game reads these at every start. Each change is saved at once, on this device.', 'Игра читает их перед каждым стартом. Каждое изменение сохраняется сразу, на этом устройстве.')}</p>
        </div>

        <div className="bt-card st-wrap">
          <SettingsForm lang={lang} langSeg={langSeg} account={acct} />
        </div>
      </div>
    </div>
  );
}
