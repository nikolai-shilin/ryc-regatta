import { pick } from '@/lib/lang';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { CHANNELS } from '@/lib/social';
import { SHARE_TARGETS } from '@/lib/share';
import { IconArrow } from '@/components/ui';
import { AppMark } from '@/components/app-marks';
import { ShareGame } from '@/components/social-share';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { READING_VIEWPORT } from '@/lib/no-zoom';

// text to read: it zooms (lib/no-zoom.ts)
export const viewport = READING_VIEWPORT;

export const generateMetadata = titled('Social media', 'Соцсети', 'Redes sociales', {
  path: '/social', card: '/og/page/social',
  description: [
    'Where Up and down, the free sailing race game, posts: its news, the day’s best races and the racing rules. Follow it, or send the game to a friend.',
    'Где пишет Up and down, бесплатная парусная регата: новости игры, лучшие гонки дня и разборы по правилам. Подпишитесь или отправьте игру другу.', 'Dónde publica Up and down, el juego gratuito de regatas a vela: sus novedades, las mejores regatas del día y las reglas de regatas. Síguelo o envía el juego a un amigo.'],
});

// The game's channels (lib/social.ts), a card each with the app's mark on its colour, and below them the way to send
// the game to a friend (components/social-share.tsx). Home's structured data names the channels too (sameAs).
export default async function Social({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const color = (app: string) => SHARE_TARGETS.find((a) => a.id === app)?.color;
  const speaks = (l: 'en' | 'ru' | 'both') => (l === 'both' ? t('In English and Russian', 'На русском и английском', 'En inglés y ruso') : l === 'ru' ? t('In Russian', 'На русском', 'En ruso') : t('In English', 'На английском', 'En inglés'));

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="social" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('Social media', 'Соцсети', 'Redes sociales')}</h1>
        <p className="hm-text">{t('The game’s news as it comes, the day’s best races and the racing rules, a situation at a time. Follow it where you read.', 'Новости игры, лучшие гонки дня и разборы ситуаций по гоночным правилам. Подписывайтесь там, где удобно.', 'Las novedades del juego según llegan, las mejores regatas del día y las reglas de regatas, una situación cada vez. Síguelo donde lees.')}</p>
      </header>

      <section className="hm-page hm-sec" aria-labelledby="so-ch">
        <div className="hm-sec-t"><span className="kicker">{t('Channels', 'Каналы', 'Canales')}</span><h2 className="hm-h2" id="so-ch">{t('Where we post', 'Где мы пишем', 'Dónde publicamos')}</h2></div>
        <ul className="so-chs">
          {CHANNELS.map((c) => (
            <li key={c.url}>
              <a className="so-ch" href={c.url} target="_blank" rel="noopener">
                <span className="so-ch-i" style={{ background: color(c.app) }}><AppMark app={c.app} s={30} /></span>
                <span className="so-ch-t">
                  <span className="meta">{c.name} · {speaks(c.lang)}</span>
                  <b className="hm-h3">{c.handle}</b>
                  <span className="hm-text">{pick(c.what, lang)}</span>
                </span>
                <span className="so-ch-go">{t('Follow', 'Подписаться', 'Seguir')}<IconArrow s={16} /></span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="so-share">
          <div className="hm-sec-t">
            <span className="kicker">{t('Tell a friend', 'Расскажите другу', 'Díselo a un amigo')}</span>
            <h2 className="hm-h2" id="so-share">{t('Race your friends', 'Гоняйтесь с друзьями', 'Compite con tus amigos')}</h2>
            <p className="hm-text">{t('Today’s race is the same for everyone, so you can race a friend on the same course and compare times. Send them the game: Telegram, WhatsApp, VK and more, or copy the link.',
              'Гонка дня одна на всех: можно пройти ту же дистанцию, что и друг, и сравнить время. Отправьте ему игру — в Telegram, WhatsApp, VK и не только, или скопируйте ссылку.', 'La regata del día es la misma para todos, así que puedes competir con un amigo en el mismo recorrido y comparar tiempos. Envíale el juego: Telegram, WhatsApp, VK y más, o copia el enlace.')}</p>
          </div>
          <ShareGame lang={lang} />
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back="/social" />
    </div>
  );
}
