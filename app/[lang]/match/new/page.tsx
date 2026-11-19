import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import FreeSetup from '@/components/free-setup';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';

// The 1-on-1 race's set-up: the free race's, without the number of boats. Hosting takes an account: a visitor who isn't
// signed in is asked to, and comes back here (joining a friend's race, /match/[code], takes none).
export const generateMetadata = titled('1-on-1 race', 'Гонка 1 на 1', { index: false, card: '/og/page/match' });

export default async function NewMatchPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  if (account) return <FreeSetup lang={lang} from={null} match />;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1')}</span>
          <h1 className="bt-h">{t('Sign in to host a 1-on-1 race', 'Войди, чтобы создать гонку 1 на 1')}</h1>
          <p className="bt-p">{t('You set the race and send a friend the link. Joining a friend’s race doesn’t take an account.', 'Ты настраиваешь гонку и отправляешь другу ссылку. Чтобы войти в гонку друга, аккаунт не нужен.')}</p>
          <a className="bt-go" href="/sign-in?next=/match/new"><span>{t('Sign in', 'Войти')}</span></a>
          <a className="bt-show" href="/sign-in?next=/match/new&signup=1"><span>{t('Sign up', 'Зарегистрироваться')}</span></a>
        </div>
      </div>
    </div>
  );
}
