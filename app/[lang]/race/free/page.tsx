import { getT, titled, type LangParams } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';
import { SiteHead } from '@/components/site-chrome';

export const generateMetadata = titled('Free race', 'Свободная гонка', {
  path: '/race/free',
  description: [
    'Set up your own sailing race: light, medium or strong wind, 3 to 7 boats, up and down or a triangle, one or two laps, a 1, 3 or 5 minute start, with or without a current.',
    'Настрой свою парусную гонку: слабый, средний или сильный ветер, от 3 до 7 лодок, апвинд — даунвинд или треугольник, один или два круга, старт за 1, 3 или 5 минут, с течением или без.'],
});

export default async function FreeRacePage({ params, searchParams }: LangParams & { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, sp] = await Promise.all([getT(params), searchParams]);
  return <FreeSetup lang={lang} fromToday={sp.from === 'today'} head={<SiteHead lang={lang} t={t} page="free" />} />;
}
