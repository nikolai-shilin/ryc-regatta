import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { DuelFinder } from '@/components/duel-finder';
import { MyDuelRating } from '@/components/my-duel-rating';

// Find a race: a 1-on-1 with a sailor of about your rating, found for you (components/duel-finder.tsx, POST /connect/seek).
// Finding one takes an account (a rated race needs one on both sides); a visitor is asked to sign in and comes back here.
// Who else is looking now, each to challenge; your wishes for the race; your own rating and last races under it.
// Challenging a friend by link is /match/new. Never indexed: what it shows is the sailor's own.
export const generateMetadata = titled('Find a 1-on-1 race', 'Найти гонку 1 на 1', 'Buscar una regata 1 contra 1', 'Eine 1-gegen-1-Regatta finden', 'Bire bir yarış bul', 'Trouver un duel', 'Trova una regata 1 contro 1', 'Encontrar um duelo 1 contra 1', { index: false });

export default async function DuelPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')}</span>
          <h1 className="bt-h">{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</h1>
          <p className="bt-p">{t('Race someone at your level, live, on the same course. The result moves your 1-on-1 rating.', 'Гонка с соперником твоего уровня, вживую, на одной дистанции. Итог меняет твой рейтинг 1 на 1.', 'Regatea con alguien de tu nivel, en directo, en el mismo recorrido. El resultado mueve tu rating 1 contra 1.', 'Segle live gegen jemanden auf deinem Niveau, auf derselben Bahn. Das Ergebnis bewegt deine 1-gegen-1-Wertung.', 'Seviyende biriyle, canlı, aynı parkurda yarış. Sonuç bire bir reytingini değiştirir.', 'Régate en direct contre quelqu’un de ton niveau, sur le même parcours. Le résultat fait bouger ton classement en duel.', 'Sfida qualcuno del tuo livello, dal vivo, sullo stesso percorso. Il risultato muove il tuo rating 1 contro 1.', 'Corra contra alguém do seu nível, ao vivo, no mesmo percurso. O resultado mexe no seu rating 1 contra 1.')}</p>
          <DuelFinder lang={lang} signed={!!account} />
          {account && <MyDuelRating lang={lang} here />}{/* your rating, level, record and last rated races */}
        </div>
      </div>
    </div>
  );
}
