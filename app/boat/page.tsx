import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { SiteHead } from '@/components/site-chrome';
import { BoatEditor } from '@/components/boat-editor';

export const metadata: Metadata = { title: 'Your boat' };

// Your boat: its colours, logo and sail number beside a live 3D preview, laid out like the free race. Saved on this
// device for the next race.
export default async function BoatPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, account, q] = await Promise.all([getT(), getAccount(), searchParams]);
  // opened from Settings, the back arrow and Done return there; otherwise to the race hub
  const back = q.from === 'settings' ? '/settings' : '/race';
  return (
    <div className="scr app" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} account={account} page="boat" />
      <div className="lay page bt-page">
        <BoatEditor lang={lang} head={(
          <div className="aph">
            <div className="aph-top">
              <Link className="round round-s round-muted" href={back} aria-label={back === '/settings' ? t('Back to settings', 'Назад в настройки') : t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
              <span className="kicker">{t('Your boat', 'Твоя яхта')}</span>
            </div>
            <h1 className="aph-h">{t('Colours, logo and sail number', 'Цвета, логотип и номер')}</h1>
            <p className="aph-p">{t('Start from a preset or mix your own: the hull, the sails, your logo and the team’s kit. Drag the boat to turn her.', 'Начни с готовой схемы или собери свою: корпус, паруса, логотип и форма команды. Тяни яхту, чтобы повернуть.')}</p>
          </div>
        )} />
      </div>
    </div>
  );
}
