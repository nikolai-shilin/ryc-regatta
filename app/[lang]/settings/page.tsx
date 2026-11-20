import { DoneButton } from '@/components/done-button';
import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, initials } from '@/lib/supabase/server';
import { dailyRace } from '@/lib/race';
import { BackLink } from '@/components/back-link';
import { GameScene } from '@/components/game-scene';
import { SceneBrand } from '@/components/scene-brand';
import { NameRow, SettingsForm } from '@/components/settings-form';

export const generateMetadata = titled('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', { index: false });

// S3 / A5 · Settings, as the race's pause screen: today's venue in the game's own scene behind (as the race hub has
// it), the heading on the left, and on the right the cards: the account, your boat and the language; sailing; and the
// way to Audio & graphics.
export default async function SettingsPage({ params }: LangParams) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  const d = dailyRace();
  const href = (to: string) => `/lang?to=${to}&back=/settings`;
  const langSeg = (
    <nav className="segc" aria-labelledby="l-lang">
      <a className={lang === 'en' ? 'on' : ''} href={href('en')} aria-current={lang === 'en' ? 'true' : undefined} lang="en">English</a>
      <a className={lang === 'ru' ? 'on' : ''} href={href('ru')} aria-current={lang === 'ru' ? 'true' : undefined} lang="ru">Русский</a>
      <a className={lang === 'es' ? 'on' : ''} href={href('es')} aria-current={lang === 'es' ? 'true' : undefined} lang="es">Español</a>
      <a className={lang === 'de' ? 'on' : ''} href={href('de')} aria-current={lang === 'de' ? 'true' : undefined} lang="de">Deutsch</a>
      <a className={lang === 'tr' ? 'on' : ''} href={href('tr')} aria-current={lang === 'tr' ? 'true' : undefined} lang="tr">Türkçe</a>
      <a className={lang === 'fr' ? 'on' : ''} href={href('fr')} aria-current={lang === 'fr' ? 'true' : undefined} lang="fr">Français</a>
    </nav>
  );
  const via = account?.provider === 'google' ? 'Google' : account?.provider === 'telegram' ? 'Telegram' : t('email code', 'код по почте', 'código por correo', 'E-Mail-Code', 'e-posta kodu', 'code par e-mail');
  const acct = account ? (<>
      <div className="acct acct-row">
        <span className="avatar">{initials(account.name, account.email)}</span>
        <div className="acct-guest">
          <span className="card-title">{account.name || account.email}</span>
          <span className="small">{[account.email, via].filter(Boolean).join(' · ')}</span>
        </div>
        <form action="/auth/sign-out" method="post"><button className="mini" type="submit"><span className="btn-t">{t('Sign out', 'Выйти', 'Cerrar sesión', 'Abmelden', 'Çıkış yap', 'Se déconnecter')}</span></button></form>
      </div>
      <NameRow lang={lang} name={account.name} />
    </>) : (
      <div className="acct acct-row">
        <span className="avatar avatar-guest" aria-hidden="true">?</span>
        <div className="acct-guest">
          <span className="card-title">{t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité')}</span>
          <span className="small">{t('Times stay on this device', 'Результаты только на этом устройстве', 'Los tiempos se quedan en este dispositivo', 'Zeiten bleiben auf diesem Gerät', 'Süreler bu cihazda kalır', 'Les temps restent sur cet appareil')}</span>
        </div>
        <Link className="pill pill-primary pill-xs" href="/sign-in?next=/settings"><span className="btn-t">{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter')}</span></Link>
      </div>
    );
  return (
    <div className="scr bt-scr bc st-scr" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <div className="bt">
        <GameScene venue={d.venue} wind={d.preset} title={t('Today’s venue in 3D', 'Место гонки дня в 3D', 'La sede de hoy en 3D', 'Das Revier von heute in 3D', 'Günün yarış alanı 3D’de', 'Le plan d’eau du jour en 3D')} loading={t('Loading the venue', 'Загружаем место гонки', 'Cargando la sede', 'Revier wird geladen', 'Yarış alanı yükleniyor', 'Chargement du plan d’eau')} />

        <div className="bt-info">
          <div className="bt-top">
            <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate')} />
            <SceneBrand lang={lang} />
            <DoneButton label={t('Done', 'Готово', 'Hecho', 'Fertig', 'Tamam', 'Terminé')} />
          </div>
          <span className="bt-kick">{t('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages')}</span>
          <h1 className="bt-h">{t('Sailing, screen and sound', 'Яхта, экран и звук', 'Navegación, pantalla y sonido', 'Segeln, Bildschirm und Ton', 'Yelken, ekran ve ses', 'Navigation, écran et son')}</h1>
          <p className="bt-p">{t('The game reads these at every start. Each change is saved at once, on this device.', 'Игра читает их перед каждым стартом. Каждое изменение сохраняется сразу, на этом устройстве.', 'El juego lee esto en cada salida. Cada cambio se guarda al instante, en este dispositivo.', 'Das Spiel liest diese bei jedem Start. Jede Änderung wird sofort auf diesem Gerät gespeichert.', 'Oyun bunları her startta okur. Her değişiklik hemen, bu cihazda saklanır.', 'Le jeu les lit à chaque départ. Chaque changement est enregistré aussitôt, sur cet appareil.')}</p>
        </div>

        <div className="bt-card st-wrap">
          <SettingsForm lang={lang} langSeg={langSeg} account={acct} />
        </div>
      </div>
    </div>
  );
}
