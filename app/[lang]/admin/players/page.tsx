import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle, pickDays } from '@/components/admin-shell';
import { InsightRetention, InsightVisits, type Insight } from '@/components/admin-insight';
import { AdminPlayers, type Players } from '@/components/admin-players';
import { IconCrew, IconScreen } from '@/components/ui';

export const generateMetadata = adminTitle('players');

// Do they come and stay, over the last ?days=: who played, one by one (regatta_admin_players,
// components/admin-players.tsx); how far a visit gets, and whether the players come back (regatta_admin_insight,
// components/admin-insight.tsx).
export default async function AdminPlayersPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => Promise.all([adminRpc<Players>(sb, 'regatta_admin_players', days), adminRpc<Insight>(sb, 'regatta_admin_insight', days)]));
  const [pl, ins] = a.data ?? [null, null];
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="players" days={days}>
      {pl?.data ? <AdminPlayers lang={lang} data={pl.data} days={days} /> : <AdminMissing t={t} Icon={IconCrew} title={t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs')} error={pl?.error} />}
      {ins?.data ? (<>
        <InsightVisits lang={lang} data={ins.data} />
        <InsightRetention lang={lang} data={ins.data} />
      </>) : <AdminMissing t={t} Icon={IconScreen} title={t('Visits and returns', 'Заходы и возвраты', 'Visitas y regresos', 'Besuche und Rückkehrer', 'Ziyaretler ve geri dönüşler', 'Visites et retours')} error={ins?.error} />}
    </AdminShell>
  );
}
