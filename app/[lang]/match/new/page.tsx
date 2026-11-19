import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount } from '@/lib/supabase/server';
import FreeSetup from '@/components/free-setup';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';

// The 1-on-1 race's set-up: the free race's, without the number of boats. Hosting takes an account: a visitor who isn't
// signed in is asked to, and comes back here (joining a friend's race, /match/[code], takes none).
export const generateMetadata = titled('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', { index: false, card: '/og/page/match' });

export default async function NewMatchPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  if (account) return <FreeSetup lang={lang} from={null} match />;
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön')} />
            <SceneBrand lang={lang} />
          </div>
          <span className="bt-kick bt-kick-w">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış')}</span>
          <h1 className="bt-h">{t('Sign in to host a 1-on-1 race', 'Войди, чтобы создать гонку 1 на 1', 'Inicia sesión para organizar una regata 1 contra 1', 'Melde dich an, um eine 1-gegen-1-Regatta auszurichten', 'Bire bir yarış kurmak için giriş yap')}</h1>
          <p className="bt-p">{t('You set the race and send a friend the link. Joining a friend’s race doesn’t take an account.', 'Ты настраиваешь гонку и отправляешь другу ссылку. Чтобы войти в гонку друга, аккаунт не нужен.', 'Tú preparas la regata y envías el enlace a un amigo. Unirse a la regata de un amigo no requiere cuenta.', 'Du legst die Regatta fest und schickst einem Freund den Link. Für die Teilnahme an der Regatta eines Freundes brauchst du kein Konto.', 'Yarışı sen kurarsın ve bir arkadaşına bağlantıyı gönderirsin. Bir arkadaşının yarışına katılmak için hesap gerekmez.')}</p>
          <a className="bt-go" href="/sign-in?next=/match/new"><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap')}</span></a>
          <a className="bt-show" href="/sign-in?next=/match/new&signup=1"><span>{t('Sign up', 'Зарегистрироваться', 'Registrarse', 'Registrieren', 'Kaydol')}</span></a>
        </div>
      </div>
    </div>
  );
}
