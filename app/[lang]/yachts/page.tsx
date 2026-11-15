import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { IconBack } from '@/components/ui';
import { YachtsView } from '@/components/yachts-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The yachts', 'Яхты', {
  path: '/yachts',
  description: [
    'The yachts you can race in Up and down: the Club 40 racer-cruiser of today’s race, the J/70 and RS21 sportboats and the AC75, the America’s Cup’s foiling monohull, each in 3D in your colours.',
    'Яхты, на которых можно гоняться в Up and down: крейсерско-гоночный Клуб 40 из гонки дня, спортботы J/70 и RS21 и AC75 — монокорпус Кубка Америки на подводных крыльях, каждая в 3D в твоих цветах.'],
});

// The yachts: each class you can race, in 3D in your colours, with what she is and how she sails (components/yachts-view).
// ?y= picks the one shown first.
export default async function YachtsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ y?: string; from?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const back = q.from === 'free' ? '/race/free' : '/race';
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <YachtsView lang={lang} start={isYacht(q.y) ? q.y : 'club40'} back={(
        <Link className="bt-back" href={back} aria-label={back === '/race' ? t('Back to the race hub', 'Назад в меню гонок') : t('Back to the free race', 'Назад к свободной гонке')}><IconBack /></Link>
      )} />
    </div>
  );
}
