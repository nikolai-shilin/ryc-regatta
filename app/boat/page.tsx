import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { BoatEditor } from '@/components/boat-editor';

export const metadata: Metadata = { title: 'Your boat' };

// Your boat: its colours, logo and sail number, with a live 3D preview. Saved on this device for the next race.
export default async function BoatPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, account, q] = await Promise.all([getT(), getAccount(), searchParams]);
  // opened from Settings, the back arrow and Done return there; otherwise to the race hub
  const back = q.from === 'settings' ? '/settings' : '/race';
  return (
    <div className="scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="lay page boat-page">
        <div className="lhead" style={{ gap: 14 }}>
          <Link className="round round-s round-muted" href={back} aria-label={back === '/settings' ? t('Back to settings', 'Назад в настройки') : t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
          <h1 className="h-land-s">{t('Your boat', 'Твоя яхта')}</h1>
        </div>
        <BoatEditor lang={lang} />
      </div>
    </div>
  );
}
