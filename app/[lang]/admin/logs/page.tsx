import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle, pickDays } from '@/components/admin-shell';
import { AdminLogs, pickWho, type Logs } from '@/components/admin-logs';
import { IconClock } from '@/components/ui';

export const generateMetadata = adminTitle('logs');

// What went wrong for whom, over the last ?days=: the players with a problem, and with ?who= one player's full log
// (regatta_admin_logs, components/admin-logs.tsx).
export default async function AdminLogsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string; who?: string }> }) {
  const sp = await searchParams;
  const days = pickDays(sp.days), who = pickWho(sp.who);
  const a = await adminLoad(params, (sb) => adminRpc<Logs>(sb, 'regatta_admin_logs', days, { person: who }));
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="logs" days={days} who={who}>
      {a.data?.data ? <AdminLogs lang={lang} data={a.data.data} days={days} /> : <AdminMissing t={t} Icon={IconClock} title={t('Players with problems', 'Игроки с проблемами', 'Jugadores con problemas')} error={a.data?.error} />}
    </AdminShell>
  );
}
