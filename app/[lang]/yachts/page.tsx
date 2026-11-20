import { getT, titled, type LangParams } from '@/lib/i18n';
import { BackLink } from '@/components/back-link';
import { FleetView } from '@/components/fleet-view';
import { isYacht } from '@/lib/yachts';

export const generateMetadata = titled('The yachts: from the Optimist to the AC75', 'Яхты: от Оптимиста до AC75', 'Los yates: del Optimist al AC75', 'Die Yachten: vom Optimist bis zum AC75', 'Yatlar: Optimist’ten AC75’e', 'Les yachts : de l’Optimist à l’AC75', 'Gli yacht: dall’Optimist all’AC75', 'Os veleiros: do Optimist ao AC75', {
  path: '/yachts', card: '/og/page/yachts',
  description: [
    'The nine yachts you can race in 3D, from the Optimist, ILCA and J/70 to the Dragon, the J Class and the foiling AC75: what each is and how she sails.',
    'Девять яхт, на которых можно гоняться в 3D, от Оптимиста, ILCA и J/70 до Дракона, класса J и AC75 на крыльях: что это за лодки и как они ходят.', 'Los nueve yates que puedes navegar en 3D, del Optimist, el ILCA y el J/70 al Dragon, el J Class y el AC75 con foils: qué es cada uno y cómo navega en el juego.', 'Die neun Yachten, die du in 3D segeln kannst, vom Optimist, ILCA und J/70 bis zum Dragon, der J Class und dem fliegenden AC75: was jede ist und wie sie segelt.', 'Optimist, ILCA ve J/70’ten Dragon’a, J Class’a ve foil üstünde uçan AC75’e kadar 3D’de yarışabileceğin dokuz yat: her biri nedir ve nasıl seyreder.', 'Les neuf yachts que tu peux mener en régate en 3D, de l’Optimist, de l’ILCA et du J/70 au Dragon, au Classe J et à l’AC75 à foils : ce qu’est chacun et comment il navigue.', 'I nove yacht che puoi portare in regata in 3D, dall’Optimist, l’ILCA e il J/70 al Dragon, al J Class e all’AC75 con i foil: cos’è ciascuno e come naviga.', 'Os nove veleiros em que você pode correr regata em 3D, do Optimist, ILCA e J/70 ao Dragon, ao J Class e ao AC75 com foils: o que é cada um e como veleja.'],
});

// The yachts: every class you can race in one scene, the drone flying from one to the next (components/fleet-view).
// ?y= picks the one it flies to first and keeps it there (no tour); ?from=free comes from the free race's set-up and
// goes back to it. /fleet, the page it once shared this with, is sent here (next.config.ts).
export default async function YachtsPage({ params, searchParams }: LangParams & { searchParams: Promise<{ y?: string; from?: string }> }) {
  const [{ lang, t }, q] = await Promise.all([getT(params), searchParams]);
  const back = q.from === 'free' ? '/race/free' : '/race';
  const start = isYacht(q.y) ? q.y : null;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <FleetView lang={lang} start={start} tour={!start} back={(
        <BackLink href={back} label={back === '/race' ? t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas') : t('Back to the custom race', 'Назад к своей гонке', 'Volver a la regata personalizada', 'Zurück zur freien Regatta', 'Serbest yarışa dön', 'Retour à la régate libre', 'Torna alla regata libera', 'Voltar à regata livre')} />
      )} />
    </div>
  );
}
