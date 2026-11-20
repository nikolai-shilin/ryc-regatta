import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { BoatEditor } from '@/components/boat-editor';

export const generateMetadata = titled('Your yacht: colours, flag and sail number', 'Твоя яхта: цвета, флаг и номер на парусе', 'Tu yate: colores, bandera y número de vela', 'Deine Yacht: Farben, Flagge und Segelnummer', 'Yatın: renkler, bayrak ve yelken numarası', 'Ton yacht : couleurs, pavillon et numéro de voile', 'Il tuo yacht: colori, bandiera e numero velico', {
  path: '/boat', card: '/og/page/boat',
  description: [
    'Make the yacht yours: hull and sail colours, a flag and a sail number, seen in 3D, for every race you sail in Up and down.',
    'Сделай яхту своей: цвета корпуса и парусов, флаг и номер на парусе — в 3D, для каждой гонки в Up and down.', 'Haz tuyo el yate: colores de casco y velas, una bandera y un número de vela, en 3D, para cada regata que navegues en Up and down.', 'Mach die Yacht zu deiner: Rumpf- und Segelfarben, eine Flagge und eine Segelnummer, in 3D zu sehen, in jeder Regatta, die du in Up and down segelst.', 'Yatı kendine göre yap: gövde ve yelken renkleri, bir bayrak ve bir yelken numarası, 3D’de görünür; Up and down’da yelken açtığın her yarış için.', 'Personnalise ton yacht : couleurs de coque et de voiles, un pavillon et un numéro de voile, en 3D, pour chaque régate que tu cours dans Up and down.', 'Fai tuo lo yacht: colori dello scafo e delle vele, una bandiera e un numero velico, visti in 3D, per ogni regata che corri in Up and down.'],
});

// Your boat: the game's own scene behind the whole page (your yacht on Lake Garda on a summer evening, public/boat-view),
// her name and numbers over it as the race's pause screen has them, and the choices in its dark glass card. Saved on
// this device for the next race.
export default async function BoatPage({ params, searchParams }: LangParams & { searchParams: Promise<{ from?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  // opened from Settings, the back arrow returns there; otherwise to the race hub
  const back = q.from === 'settings' ? '/settings' : '/race';
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <BoatEditor lang={lang} back={(
        <BackLink href={back} label={back === '/settings' ? t('Back to settings', 'Назад в настройки', 'Volver a ajustes', 'Zurück zu den Einstellungen', 'Ayarlara dön', 'Retour aux réglages', 'Torna alle impostazioni') : t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate')} />
      )} />
    </div>
  );
}
