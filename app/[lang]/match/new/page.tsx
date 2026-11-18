import { getT, titled, type LangParams } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';

// The 1-on-1 race's set-up: the free race's, without the number of boats.
export const generateMetadata = titled('1-on-1 race', 'Гонка один на один', { index: false, card: '/og/page/match' });

export default async function NewMatchPage({ params }: LangParams) {
  const { lang } = await getT(params);
  return <FreeSetup lang={lang} from={null} match />;
}
