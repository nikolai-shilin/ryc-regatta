import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle, pickDays } from '@/components/admin-shell';
import { AdminRacing, hasStats, type Stats } from '@/components/admin-stats';
import { InsightDifficulty, InsightExits, InsightRatings, InsightSettings, type Insight } from '@/components/admin-insight';
import { IconCrew, IconTrophy } from '@/components/ui';

export const generateMetadata = adminTitle('game');

// Is it fun and fair, over the last ?days=: how the races go by yacht, wind, venue and course (regatta_admin_stats),
// how hard they are as a player learns, why races are left, what the players say and what they set
// (regatta_admin_insight).
export default async function AdminGamePage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => Promise.all([adminRpc<Stats>(sb, 'regatta_admin_stats', days), adminRpc<Insight>(sb, 'regatta_admin_insight', days)]));
  const [st, ins] = a.data ?? [null, null];
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="game" days={days}>
      {hasStats(st?.data ?? null) ? <AdminRacing lang={lang} stats={st!.data!} /> : <AdminMissing t={t} Icon={IconTrophy} title={t('How they race', 'Как гоняются')} error={st?.error} />}
      {ins?.data ? (<>
        <InsightDifficulty lang={lang} data={ins.data} />
        <InsightExits lang={lang} data={ins.data} />
        <InsightRatings lang={lang} data={ins.data} />
        <InsightSettings lang={lang} data={ins.data} />
      </>) : <AdminMissing t={t} Icon={IconCrew} title={t('How they like it', 'Нравится ли игра')} error={ins?.error} />}
    </AdminShell>
  );
}
