import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { FleetView } from '@/components/fleet-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The yachts', 'Яхты', {
  path: '/yachts',
  description: [
    'Every yacht you can race in Up and down, afloat together in 3D in your colours: the JPK 1050 offshore racer, the Bavaria 46 cruiser, the J/70 and RS21 sportboats, the Laser (ILCA) dinghy and the AC75, the America’s Cup’s foiling monohull, with what each is and how she sails.',
    'Все яхты, на которых можно гоняться в Up and down, вместе на воде в 3D в твоих цветах: офшорная гоночная JPK 1050, крейсерская Bavaria 46, спортботы J/70 и RS21, швертбот Laser (ILCA) и AC75 — монокорпус Кубка Америки на подводных крыльях, что это за лодки и как они ходят.'],
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
