import { tx, type Lang } from '@/lib/lang';
import { dailyRace } from '@/lib/race';
import { GameScene } from './game-scene';
import { SceneBrand } from './scene-brand';
import { BackLink } from './back-link';

// A1–A3: signing in, as the race's pause screen: today's venue in the game's own scene behind (as the race hub has
// it), the brand and a word on why on the left, and the step's card on the right (components/sign-in-forms.tsx).
// Nobody is signed in on these pages (sign-in sends a signed-in visitor on). back: where the back button goes (none on
// the last step, the name, which signing in has already passed).
export function AuthShell({ lang, back, aside, children }: { lang: Lang; back?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const t = tx(lang);
  const d = dailyRace();
  return (
    <div className="scr bt-scr bc au-scr" lang={lang}>
      <div className="bt">
        <GameScene venue={d.venue} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D', 'La sede de hoy en 3D', 'Das Revier von heute in 3D', 'Günün yarış alanı 3D’de', 'Le plan d’eau du jour en 3D')} />
        <div className="bt-info">
          <div className="bt-top">
            {back && <BackLink href={back} label={t('Back', 'Назад', 'Atrás', 'Zurück', 'Geri', 'Retour')} />}
            <SceneBrand />
          </div>
          {aside}
        </div>
        <section className="bt-card au-card">{children}</section>
      </div>
    </div>
  );
}

