import type { LangParams } from '@/lib/i18n';
import { AdminShell, adminLoad, adminTitle } from '@/components/admin-shell';
import { AdminSchedule } from '@/components/admin-schedule';
import { todayTop } from '@/lib/today';

export const generateMetadata = adminTitle('race');

// What every player sails today and on each of the next seven days (components/admin-schedule.tsx).
export default async function AdminRacePage({ params }: LangParams) {
  const [a, today] = await Promise.all([adminLoad(params), todayTop()]);
  return <AdminShell {...a} page="race"><AdminSchedule lang={a.lang} today={today} /></AdminShell>;
}
