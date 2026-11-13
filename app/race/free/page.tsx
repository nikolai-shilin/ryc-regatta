import type { Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import FreeSetup from '@/components/free-setup';
import { SiteHead } from '@/components/site-chrome';

export const metadata: Metadata = { title: 'Free race' };

export default async function FreeRacePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, sp, account] = await Promise.all([getT(), searchParams, getAccount()]);
  return <FreeSetup lang={lang} fromToday={sp.from === 'today'} head={<SiteHead lang={lang} t={t} account={account} page="free" />} />;
}
