import type { LangParams } from '@/lib/i18n';
import { AdminMissing, AdminShell, adminLoad, adminRpc, adminTitle, pickDays } from '@/components/admin-shell';
import { AdminPerf, hasStats, type Stats } from '@/components/admin-stats';
import { InsightLoading, type Insight } from '@/components/admin-insight';
import { IconDevice, IconScreen } from '@/components/ui';

export const generateMetadata = adminTitle('tech');

// Does it run well, over the last ?days=: the frame rate and stalls by device, chip, level, system and venue
// (regatta_admin_stats), the loads that fail and the errors on the page (regatta_admin_insight).
export default async function AdminTechPage({ params, searchParams }: LangParams & { searchParams: Promise<{ days?: string }> }) {
  const days = pickDays((await searchParams).days);
  const a = await adminLoad(params, (sb) => Promise.all([adminRpc<Stats>(sb, 'regatta_admin_stats', days), adminRpc<Insight>(sb, 'regatta_admin_insight', days)]));
  const [st, ins] = a.data ?? [null, null];
  const { lang, t } = a;
  return (
    <AdminShell {...a} page="tech" days={days}>
      {hasStats(st?.data ?? null) ? <AdminPerf lang={lang} stats={st!.data!} /> : <AdminMissing t={t} Icon={IconDevice} title={t('How the game runs', 'Как работает игра', 'Cómo funciona el juego', 'Wie das Spiel läuft', 'Oyun nasıl çalışıyor', 'Comment tourne le jeu', 'Come gira il gioco', 'Como o jogo roda')} error={st?.error} />}
      {ins?.data ? <InsightLoading lang={lang} data={ins.data} /> : <AdminMissing t={t} Icon={IconScreen} title={t('Loads and errors', 'Загрузка и ошибки', 'Cargas y errores', 'Ladezeiten und Fehler', 'Yüklemeler ve hatalar', 'Chargements et erreurs', 'Caricamenti ed errori', 'Carregamentos e erros')} error={ins?.error} />}
    </AdminShell>
  );
}
