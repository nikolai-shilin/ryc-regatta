import Link from 'next/link';
import { getT, titled } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { IconBack } from '@/components/ui';
import { BoatEditor } from '@/components/boat-editor';

export const generateMetadata = titled('Your boat', 'Твоя яхта', {
  path: '/boat',
  description: [
    'Make the yacht yours: hull and sail colours, a logo and a sail number, seen in 3D, for every race you sail in Up and down.',
    'Сделай яхту своей: цвета корпуса и парусов, логотип и номер на парусе — в 3D, для каждой гонки в Up and down.'],
});

// Your boat: the game's own scene behind the whole page (your yacht on Lake Garda on a summer evening, public/boat-view),
// her name and numbers over it as the race's pause screen has them, and the choices in its dark glass card. Saved on
// this device for the next race.
export default async function BoatPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, account, q] = await Promise.all([getT(), getAccount(), searchParams]);
  // opened from Settings, the back arrow returns there; otherwise to the race hub
  const back = q.from === 'settings' ? '/settings' : '/race';
  return (
    <div className="scr bt-scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <BoatEditor lang={lang} back={(
        <Link className="bt-back" href={back} aria-label={back === '/settings' ? t('Back to settings', 'Назад в настройки') : t('Back to the race hub', 'Назад в меню гонок')}><IconBack /></Link>
      )} />
    </div>
  );
}
