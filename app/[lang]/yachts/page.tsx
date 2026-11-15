import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { YachtsView } from '@/components/yachts-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The yachts', 'Яхты', {
  path: '/yachts',
  description: [
    'The yachts you can race in Up and down: the JPK 1050 offshore racer, the Bavaria 46 cruiser, the J/70 and RS21 sportboats, the Laser (ILCA) dinghy and the AC75, the America’s Cup’s foiling monohull, each in 3D in your colours.',
    'Яхты, на которых можно гоняться в Up and down: офшорная гоночная JPK 1050, крейсерская Bavaria 46, спортботы J/70 и RS21, швертбот Laser (ILCA) и AC75 — монокорпус Кубка Америки на подводных крыльях, каждая в 3D в твоих цветах.'],
});

// The yachts: each class you can race, in 3D in your colours, with what she is and how she sails (components/yachts-view).
// ?y= picks the one shown first.
export default async function YachtsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ y?: string; from?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const back = q.from === 'free' ? '/race/free' : '/race';
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <YachtsView lang={lang} start={isYacht(q.y) ? q.y : 'jpk1050'} back={(
        <BackLink href={back} label={back === '/race' ? t('Back to the race hub', 'Назад в меню гонок') : t('Back to the free race', 'Назад к свободной гонке')} />
      )} />
    </div>
  );
}
