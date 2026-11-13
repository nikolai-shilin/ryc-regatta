import type { Metadata } from 'next';
import { getLang } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';

export const metadata: Metadata = { title: 'Free race' };

export default async function FreeRacePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [lang, sp] = await Promise.all([getLang(), searchParams]);
  return <FreeSetup lang={lang} fromToday={sp.from === 'today'} />;
}
