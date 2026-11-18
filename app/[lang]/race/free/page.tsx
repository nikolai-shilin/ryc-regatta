import { getT, titled, type LangParams } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';

export const generateMetadata = titled('Free race: set up your own regatta', 'Свободная гонка: настрой свою регату', {
  path: '/race/free', card: '/og/page/free',
  description: [
    'Set up your own sailing race at one of 55 regatta venues, from Cowes to Sydney: the yacht, the wind, 3 to 7 boats, the course, laps, the start and the current.',
    'Настрой свою парусную гонку на одной из 55 регатных акваторий, от Кауса до Сиднея: яхта, ветер, от 3 до 7 лодок, дистанция, круги, старт и течение.'],
});

export default async function FreeRacePage({ params, searchParams }: LangParams & { searchParams: Promise<{ from?: string }> }) {
  // (who is signed in: the pause card reads the session cookie, components/me.tsx)
  const [{ lang }, sp] = await Promise.all([getT(params), searchParams]);
  return <FreeSetup lang={lang} from={sp.from === 'today' ? 'today' : sp.from === 'race' ? 'race' : null} />;
}
