import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { SiteFoot } from '@/components/site-chrome';
import { DuelFinder } from '@/components/duel-finder';
import { ForYou } from '@/components/for-you';

// Find a race: a 1-on-1 with a sailor of about your rating, found for you (components/duel-finder.tsx, POST /connect/seek).
// Finding one takes an account (a rated race needs one on both sides); a visitor is asked to sign in and comes back here.
// Who else is looking now, each to challenge; your wishes for the race; your own rating and last races under it.
// Challenging a friend by link is /match/new. Never indexed: what it shows is the sailor's own.
// The top is a race page over the game's own scene, in the HUD's design (the canvas "Regatta Broadcast HUD", the race
// pages: its top bar, the heading, the HUD's cells with your rating, and the card where the race is set up and found);
// under it, as the 1-on-1 design has them: Ready now, the duel hour, the open calls, your last races, the rating around
// you and For you.
export const generateMetadata = titled('Find a 1-on-1 race', 'Найти гонку 1 на 1', 'Buscar una regata 1 contra 1', 'Eine 1-gegen-1-Regatta finden', 'Bire bir yarış bul', 'Trouver un duel', 'Trova una regata 1 contro 1', 'Encontrar um duelo 1 contra 1', { index: false });

export default async function DuelPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  return (
    <div className="scr help hp bc dpg" lang={lang}>
      <DuelFinder lang={lang} signed={!!account}>
        <ForYou lang={lang} />{/* up to three things to do next (components/for-you.tsx) */}
      </DuelFinder>
      <SiteFoot lang={lang} t={t} back="/duel" />
    </div>
  );
}
