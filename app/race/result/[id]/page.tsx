import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import ResultView from '@/components/result-view';
import { SiteHead, SiteFoot } from '@/components/site-chrome';

export const metadata: Metadata = { title: 'Race result' };

// R1 · The result and debrief. The game keeps the race on this device and opens this page at the finish.
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { lang, t }, account] = await Promise.all([params, getT(), getAccount()]);
  return (
    <ResultView id={id} lang={lang} signedName={account ? account.name || account.email : null}
      head={<SiteHead lang={lang} t={t} account={account} page="result" />}
      foot={<SiteFoot lang={lang} t={t} account={account} back={`/race/result/${id}`} />} />
  );
}
