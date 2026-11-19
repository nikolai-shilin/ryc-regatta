import { getT, titled, type LangParams } from '@/lib/i18n';
import FreeSetup from '@/components/free-setup';

export const generateMetadata = titled('Custom race: set up your own regatta', 'Своя гонка: настрой свою регату', 'Regata personalizada: prepara tu propia regata', 'Freie Regatta: richte deine eigene Regatta ein', {
  path: '/race/free', card: '/og/page/free',
  description: [
    'Set up your own sailing race at one of 55 regatta venues, from Cowes to Sydney: the yacht, the wind, 3 to 7 boats, the course, laps, the start and the current.',
    'Настрой свою парусную гонку на одной из 55 регатных акваторий, от Кауса до Сиднея: яхта, ветер, от 3 до 7 лодок, дистанция, круги, старт и течение.', 'Prepara tu propia regata a vela en una de las 55 sedes de regatas, de Cowes a Sídney: el yate, el viento, de 3 a 7 barcos, el recorrido, las vueltas, la salida y la corriente.', 'Richte deine eigene Segelregatta in einem von 55 Regattarevieren ein, von Cowes bis Sydney: die Yacht, der Wind, 3 bis 7 Boote, die Bahn, Runden, der Start und die Strömung.'],
});

export default async function FreeRacePage({ params, searchParams }: LangParams & { searchParams: Promise<{ from?: string }> }) {
  // (who is signed in: the pause card reads the session cookie, components/me.tsx)
  const [{ lang }, sp] = await Promise.all([getT(params), searchParams]);
  return <FreeSetup lang={lang} from={sp.from === 'today' ? 'today' : sp.from === 'race' ? 'race' : null} />;
}
