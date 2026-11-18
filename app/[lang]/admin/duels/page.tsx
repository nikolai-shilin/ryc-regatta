import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle } from '@/components/admin-shell';
import { AdminDuels, pickDuelDays, type Duels } from '@/components/admin-duels';
import { IconCrew } from '@/components/ui';

export const generateMetadata = adminTitle('duels');

// The 1-on-1 races, over the last ?days= (7, 30 or 90) or all time when not said: the totals and every race
// (regatta_admin_duels, components/admin-duels.tsx). The page has its own period links, so the shell has none.
export default async function AdminDuelsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDuelDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => adminRpc<Duels>(sb, 'regatta_admin_duels', days));
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="duels">
      {a.data?.data ? <AdminDuels lang={lang} data={a.data.data} days={days} /> : <AdminMissing t={t} Icon={IconCrew} title={t('1-on-1 races', 'Гонки 1 на 1')} error={a.data?.error} />}
    </AdminShell>
  );
}
