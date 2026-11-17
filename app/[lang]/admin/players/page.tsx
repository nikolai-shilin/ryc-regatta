import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle, pickDays } from '@/components/admin-shell';
import { InsightRetention, InsightVisits, type Insight } from '@/components/admin-insight';
import { IconCrew } from '@/components/ui';

export const generateMetadata = adminTitle('players');

// Do they come and stay: how far a visit gets, and whether the players come back, over the last ?days=
// (regatta_admin_insight, components/admin-insight.tsx).
export default async function AdminPlayersPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => adminRpc<Insight>(sb, 'regatta_admin_insight', days));
  const ins = a.data;
  return (
    <AdminShell {...a} page="players" days={days}>
      {ins?.data ? (<>
        <InsightVisits lang={a.lang} data={ins.data} />
        <InsightRetention lang={a.lang} data={ins.data} />
      </>) : <AdminMissing t={a.t} Icon={IconCrew} title={a.t('Players', 'Игроки')} error={ins?.error} />}
    </AdminShell>
  );
}
