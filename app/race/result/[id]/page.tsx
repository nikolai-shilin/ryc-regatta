import type { Metadata } from 'next';
import { getLang } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import ResultView from '@/components/result-view';

export const metadata: Metadata = { title: 'Race result' };

// R1 · The result and debrief. The game keeps the race on this device and opens this page at the finish.
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, lang, account] = await Promise.all([params, getLang(), getAccount()]);
  return <ResultView id={id} lang={lang} signedName={account ? account.name || account.email : null} />;
}
