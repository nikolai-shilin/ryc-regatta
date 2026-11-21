import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle } from '@/components/admin-shell';
import { AdminDuels, pickDuelDays, type Duels } from '@/components/admin-duels';
import type { Targets } from '@/components/admin-targets';
import { IconCrew } from '@/components/ui';

export const generateMetadata = adminTitle('duels');

// The 1-on-1 races, over the last ?days= (7, 30 or 90) or all time when not said: the totals and every race
// (regatta_admin_duels, components/admin-duels.tsx), and the 1-on-1 plan's targets over the same period
// (regatta_admin_targets, components/admin-targets.tsx; left out if they don't come). The page has its own period links.
export default async function AdminDuelsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDuelDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => Promise.all([adminRpc<Duels>(sb, 'regatta_admin_duels', days), adminRpc<Targets>(sb, 'regatta_admin_targets', days).catch(() => ({ data: null, error: 'unreachable' }))]));
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="duels">
      {a.data?.[0].data ? <AdminDuels lang={lang} data={a.data[0].data} days={days} targets={a.data[1].data} /> : <AdminMissing t={t} Icon={IconCrew} title={t('1-on-1 races', 'Гонки 1 на 1', 'Regatas 1 contra 1', '1-gegen-1-Regatten', 'Bire bir yarışlar', 'Duels 1 contre 1', 'Duelli 1 contro 1', 'Duelos 1 contra 1')} error={a.data?.[0].error} />}
    </AdminShell>
  );
}
