import { getT, titled } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import FreeSetup from '@/components/free-setup';
import { SiteHead } from '@/components/site-chrome';

export const generateMetadata = titled('Free race', 'Свободная гонка', {
  path: '/race/free',
  description: [
    'Set up your own sailing race at a famous regatta venue (Göcek, Cowes, Newport, Sydney, Kiel, Trieste, Porto Cervo, Saint-Tropez, Antigua, Auckland or Lake Garda): light, medium or strong wind, 3 to 7 boats, up and down or a triangle, one or two laps, a 1, 3 or 5 minute start, with or without a current.',
    'Настрой свою парусную гонку на знаменитой регатной акватории (Гёчек, Каус, Ньюпорт, Сидней, Киль, Триест, Порто-Черво, Сен-Тропе, Антигуа, Окленд или озеро Гарда): слабый, средний или сильный ветер, от 3 до 7 лодок, апвинд — даунвинд или треугольник, один или два круга, старт за 1, 3 или 5 минут, с течением или без.'],
});

export default async function FreeRacePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, sp, account] = await Promise.all([getT(), searchParams, getAccount()]);
  return <FreeSetup lang={lang} fromToday={sp.from === 'today'} head={<SiteHead lang={lang} t={t} account={account} page="free" />} />;
}
