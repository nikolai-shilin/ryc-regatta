import { getT, titled, type LangParams } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';

// The match race's set-up: the free race's, with only the place, the yacht, the wind and the length.
export const generateMetadata = titled('Match race', 'Матчевая гонка', { index: false, card: '/og/page/match' });

export default async function NewMatchPage({ params }: LangParams) {
  const { lang } = await getT(params);
  return <FreeSetup lang={lang} from={null} match />;
}
