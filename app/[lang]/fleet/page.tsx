import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { FleetView } from '@/components/fleet-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The fleet', 'Флот', {
  path: '/fleet',
  description: [
    'Every yacht you can race in Up and down, afloat together in 3D: the JPK 1050, the Bavaria 46 cruiser, the J/70 and RS21 sportboats, the Laser (ILCA) dinghy and the AC75 foiler, with what each is and how she sails.',
    'Все яхты, на которых можно гоняться в Up and down, вместе на воде в 3D: JPK 1050, крейсерская Bavaria 46, спортботы J/70 и RS21, швертбот Laser (ILCA) и летающий AC75 — что это за лодки и как они ходят.'],
});

// The fleet: every yacht you can race in one scene, the drone flying from one to the next (components/fleet-view).
// ?y= picks the one it flies to first.
export default async function FleetPage({ params, searchParams }: LangParams & { searchParams: Promise<{ y?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <FleetView lang={lang} start={isYacht(q.y) ? q.y : null} back={(
        <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
      )} />
    </div>
  );
}
