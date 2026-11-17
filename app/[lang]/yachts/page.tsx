import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { FleetView } from '@/components/fleet-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The yachts: from the Optimist to the AC75', 'Яхты: от Оптимиста до AC75', {
  path: '/yachts', card: '/og/page/yachts',
  description: [
    'The nine yachts you can race in 3D, from the Optimist, ILCA and J/70 to the Dragon, the J Class and the foiling AC75: what each is and how she sails.',
    'Девять яхт, на которых можно гоняться в 3D, от Оптимиста, ILCA и J/70 до Дракона, класса J и AC75 на крыльях: что это за лодки и как они ходят.'],
});

// The yachts: every class you can race in one scene, the drone flying from one to the next (components/fleet-view).
// ?y= picks the one it flies to first and keeps it there (no tour); ?from=free comes from the free race's set-up and
// goes back to it. /fleet, the page it once shared this with, is sent here (next.config.ts).
export default async function YachtsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ y?: string; from?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const back = q.from === 'free' ? '/race/free' : '/race';
  const start = isYacht(q.y) ? q.y : null;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <FleetView lang={lang} start={start} tour={!start} back={(
        <BackLink href={back} label={back === '/race' ? t('Back to the race hub', 'Назад в меню гонок') : t('Back to the free race', 'Назад к свободной гонке')} />
      )} />
    </div>
  );
}
