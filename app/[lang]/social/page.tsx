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

export const generateMetadata = titled('Social media', 'Соцсети', 'Redes sociales', 'Soziale Medien', 'Sosyal medya', {
  path: '/social', card: '/og/page/social',
  description: [
    'Where Up and down, the free sailing race game, posts: its news, the day’s best races and the racing rules. Follow it, or send the game to a friend.',
    'Где пишет Up and down, бесплатная парусная регата: новости игры, лучшие гонки дня и разборы по правилам. Подпишитесь или отправьте игру другу.', 'Dónde publica Up and down, el juego gratuito de regatas a vela: sus novedades, las mejores regatas del día y las reglas de regatas. Síguelo o envía el juego a un amigo.', 'Wo Up and down, das kostenlose Segelregatta-Spiel, postet: seine Neuigkeiten, die besten Regatten des Tages und die Wettfahrtregeln. Folge ihm oder schick das Spiel einem Freund.', 'Ücretsiz yelken yarışı oyunu Up and down’ın paylaştıkları: haberleri, günün en iyi yarışları ve yarış kuralları. Takip et ya da oyunu bir arkadaşına gönder.'],
});

// The game's channels (lib/social.ts), a card each with the app's mark on its colour, and below them the way to send
// the game to a friend (components/social-share.tsx). Home's structured data names the channels too (sameAs).
export default async function Social({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const color = (app: string) => SHARE_TARGETS.find((a) => a.id === app)?.color;
  const speaks = (l: 'en' | 'ru' | 'both') => (l === 'both' ? t('In English and Russian', 'На русском и английском', 'En inglés y ruso', 'Auf Englisch und Russisch', 'İngilizce ve Rusça') : l === 'ru' ? t('In Russian', 'На русском', 'En ruso', 'Auf Russisch', 'Rusça') : t('In English', 'На английском', 'En inglés', 'Auf Englisch', 'İngilizce'));

  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="social" />
      <header className="hm-page hm-ph">
        <span className="kicker">Up and down</span>
        <h1 className="hm-ph-h">{t('Social media', 'Соцсети', 'Redes sociales', 'Soziale Medien', 'Sosyal medya')}</h1>
        <p className="hm-text">{t('The game’s news as it comes, the day’s best races and the racing rules, a situation at a time. Follow it where you read.', 'Новости игры, лучшие гонки дня и разборы ситуаций по гоночным правилам. Подписывайтесь там, где удобно.', 'Las novedades del juego según llegan, las mejores regatas del día y las reglas de regatas, una situación cada vez. Síguelo donde lees.', 'Die Neuigkeiten des Spiels, wie sie kommen, die besten Regatten des Tages und die Wettfahrtregeln, eine Situation nach der anderen. Folge ihm, wo du liest.', 'Oyunun haberleri geldikçe, günün en iyi yarışları ve yarış kuralları, her seferinde bir durum. Okuduğun yerde takip et.')}</p>
      </header>

      <section className="hm-page hm-sec" aria-labelledby="so-ch">
        <div className="hm-sec-t"><span className="kicker">{t('Channels', 'Каналы', 'Canales', 'Kanäle', 'Kanallar')}</span><h2 className="hm-h2" id="so-ch">{t('Where we post', 'Где мы пишем', 'Dónde publicamos', 'Wo wir posten', 'Nerede paylaşıyoruz')}</h2></div>
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
                <span className="so-ch-go">{t('Follow', 'Подписаться', 'Seguir', 'Folgen', 'Takip et')}<IconArrow s={16} /></span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="hm-band">
        <section className="hm-page hm-sec" aria-labelledby="so-share">
          <div className="hm-sec-t">
            <span className="kicker">{t('Tell a friend', 'Расскажите другу', 'Díselo a un amigo', 'Sag es einem Freund', 'Bir arkadaşına söyle')}</span>
            <h2 className="hm-h2" id="so-share">{t('Race your friends', 'Гоняйтесь с друзьями', 'Compite con tus amigos', 'Segle gegen deine Freunde', 'Arkadaşlarınla yarış')}</h2>
            <p className="hm-text">{t('Today’s race is the same for everyone, so you can race a friend on the same course and compare times. Send them the game: Telegram, WhatsApp, VK and more, or copy the link.',
              'Гонка дня одна на всех: можно пройти ту же дистанцию, что и друг, и сравнить время. Отправьте ему игру — в Telegram, WhatsApp, VK и не только, или скопируйте ссылку.', 'La regata del día es la misma para todos, así que puedes competir con un amigo en el mismo recorrido y comparar tiempos. Envíale el juego: Telegram, WhatsApp, VK y más, o copia el enlace.', 'Die Regatta des Tages ist für alle gleich, also kannst du gegen einen Freund auf derselben Bahn segeln und die Zeiten vergleichen. Schick ihm das Spiel: Telegram, WhatsApp, VK und mehr, oder kopiere den Link.', 'Günün yarışı herkes için aynı, böylece bir arkadaşınla aynı parkurda yarışıp süreleri karşılaştırabilirsin. Oyunu ona gönder: Telegram, WhatsApp, VK ve daha fazlası, ya da bağlantıyı kopyala.')}</p>
          </div>
          <ShareGame lang={lang} />
        </section>
      </div>

      <SiteFoot lang={lang} t={t} back="/social" />
    </div>
  );
}
