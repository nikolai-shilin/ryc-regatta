import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { supabaseServer } from '@/lib/supabase/server';
import { parseRatingPage, type RatingPage } from '@/lib/rating-page';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { RatingPageView } from '@/components/rating-page';
import '@/styles/race-board.css'; // (its buttons and links: .rb-acts, .rb-link)
import '@/styles/race-month.css'; // (the head, the stats and the sections, as your month's)
import '@/styles/rating-page.css';

// Your 1-on-1 rating, its own page (release 7b of the 1-on-1 plan): components/rating-page.tsx, from the database's
// regatta_rating_page(), read with your session (lib/rating-page.ts). Signed out, a way to sign in; the database down,
// said so. Your own only: not for search.
export const generateMetadata = titled('Your 1-on-1 rating', 'Твой рейтинг 1 на 1', 'Tu rating 1 contra 1', 'Deine 1-gegen-1-Wertung', 'Bire bir reytingin', 'Ton classement en duel', 'Il tuo rating 1 contro 1', 'Seu rating 1 contra 1', { index: false });

export default async function RatingPageRoute({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims?.sub;
  let d: RatingPage | null = null, down = false;
  if (signedIn) {
    const r = await supabase.rpc('regatta_rating_page');
    d = r.error ? null : parseRatingPage(r.data);
    down = !d;
  }
  return (
    <div className="scr help hp bc rm rp" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" crumbs={[[t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel', 'Regata 1 contro 1', 'Duelo 1 contra 1'), '/duel'], [t('Your rating', 'Твой рейтинг', 'Tu rating', 'Deine Wertung', 'Reytingin', 'Ton classement', 'Il tuo rating', 'Seu rating'), '/duel/rating']]} />
      {d ? <RatingPageView d={d} lang={lang} /> : (
        <>
          <header className="hm-page hm-ph rm-head">
            <span className="kicker">{t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1')}</span>
            <h1 className="hm-ph-h">{t('Your 1-on-1 rating', 'Твой рейтинг 1 на 1', 'Tu rating 1 contra 1', 'Deine 1-gegen-1-Wertung', 'Bire bir reytingin', 'Ton classement en duel', 'Il tuo rating 1 contro 1', 'Seu rating 1 contra 1')}</h1>
          </header>
          <div className="hm-page rm-main">
            <section className="rm-sec">
              {down
                ? <p className="lead">{t('Your rating can’t be loaded right now. Try again in a minute.', 'Рейтинг сейчас не загружается. Попробуй через минуту.', 'Tu rating no se puede cargar ahora. Inténtalo en un minuto.', 'Deine Wertung lässt sich gerade nicht laden. Versuch es in einer Minute.', 'Reytingin şu an yüklenemiyor. Bir dakika sonra dene.', 'Ton classement ne se charge pas pour l’instant. Réessaie dans une minute.', 'Il tuo rating non si carica ora. Riprova tra un minuto.', 'Seu rating não carrega agora. Tente em um minuto.')}</p>
                : <>
                  <p className="lead">{t('The 1-on-1 rating is kept for sailors who are signed in: sign in to see yours, every race that moved it and why.', 'Рейтинг 1 на 1 ведётся для тех, кто вошёл в аккаунт: войди, чтобы увидеть свой, каждую гонку, которая его изменила, и почему.', 'El rating 1 contra 1 es para quien ha iniciado sesión: inicia sesión para ver el tuyo, cada regata que lo movió y por qué.', 'Die 1-gegen-1-Wertung gibt es für angemeldete Segler: melde dich an, um deine zu sehen, jede Regatta, die sie bewegt hat, und warum.', 'Bire bir reyting giriş yapmış denizciler için tutulur: kendininkini, onu değiştiren her yarışı ve nedenini görmek için giriş yap.', 'Le classement en duel est tenu pour les régatiers connectés : connecte-toi pour voir le tien, chaque régate qui l’a bougé, et pourquoi.', 'Il rating 1 contro 1 è per chi ha fatto l’accesso: accedi per vedere il tuo, ogni regata che l’ha mosso e perché.', 'O rating 1 contra 1 é para quem entrou na conta: entre para ver o seu, cada regata que o mudou e por quê.')}</p>
                  <div className="rb-acts">
                    <Link className="rt-go" href={`/sign-in?next=${encodeURIComponent('/duel/rating')}`}><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</span></Link>
                    <Link className="rb-link" href="/help/duel#h-rating">{t('How the rating works', 'Как устроен рейтинг', 'Cómo funciona el rating', 'So funktioniert die Wertung', 'Reyting nasıl işler', 'Comment marche le classement', 'Come funziona il rating', 'Como funciona o rating')} ›</Link>
                  </div>
                </>}
            </section>
          </div>
        </>
      )}
      <SiteFoot lang={lang} t={t} back="/duel/rating" />
    </div>
  );
}
