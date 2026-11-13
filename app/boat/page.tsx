import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { BoatEditor } from '@/components/boat-editor';

export const metadata: Metadata = { title: 'Your boat' };

// Your boat: its colours, logo and sail number, with a live 3D preview. Saved on this device for the next race.
export default async function BoatPage() {
  const [{ lang, t }, account] = await Promise.all([getT(), getAccount()]);
  return (
    <div className="scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="lay page boat-page">
        <div className="lhead" style={{ gap: 14 }}>
          <Link className="round round-s round-muted" href="/race" aria-label={t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span className="kicker">Up and down</span>
            <h1 className="h-land-s">{t('Your boat', 'Твоя яхта')}</h1>
          </div>
          <span className="sp" />
          <Link className="pill pill-primary pill-xs" href="/race" style={{ flex: 'none' }}><span className="btn-t">{t('Done', 'Готово')}</span></Link>
        </div>
        <BoatEditor lang={lang} />
      </div>
    </div>
  );
}
