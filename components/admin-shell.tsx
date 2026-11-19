import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { pick, type Lang, type T } from '@/lib/lang';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { getAccount, supabaseServer, type Account } from '@/lib/supabase/server';
import { BackLink } from './back-link';
import { SiteHead } from './site-chrome';
import { IconArrow, IconClock, IconCrew, IconDevice, IconFlag, IconImage, IconTrophy } from './ui';

// The site's admin, a page for each thing an admin comes to do (app/[lang]/admin/*): see the race the players sail
// today and the week ahead; set the ads in the game; see whether players come and stay; whether the game is fun and
// fair; and whether it runs well on their devices. /admin itself lists them. Who is an admin is the list
// public.regatta_admins (by email), which only the database's owner edits; the settings and the bucket only take an
// admin's writes and the numbers answer an admin alone (row-level security, regatta_admin_stats and _insight), so these
// pages only hide what they show from everyone else.
export const ADMIN_PAGES = [
  { id: 'race', Icon: IconFlag, name: ['Race', 'Гонка', 'Regata', 'Regatta', 'Yarış'], h: ['Today’s race and the week ahead', 'Гонка дня и неделя вперёд', 'La regata de hoy y la semana que viene', 'Die Regatta des Tages und die Woche voraus', 'Günün yarışı ve önümüzdeki hafta'],
    goal: ['What every player sails today, and what comes on each of the next seven days.', 'Что все игроки проходят сегодня и что ждёт их в каждый из следующих семи дней.', 'Lo que navega hoy cada jugador y lo que viene en cada uno de los próximos siete días.', 'Was alle Spieler heute segeln und was an jedem der nächsten sieben Tage kommt.', 'Bugün her oyuncunun yarıştığı ve önümüzdeki yedi günün her birinde gelecek olan.'] },
  { id: 'ads', Icon: IconImage, name: ['Ads', 'Реклама', 'Anuncios', 'Werbung', 'Reklamlar'], h: ['The ads in the game', 'Реклама в игре', 'Los anuncios del juego', 'Die Werbung im Spiel', 'Oyundaki reklamlar'],
    goal: ['The logos every boat carries on her mainsail and her jib, and the words on the banner the plane tows over the course.', 'Логотипы на гроте и стакселе каждой яхты и слова на баннере, который самолёт проносит над дистанцией.', 'Los logos que lleva cada barco en la mayor y en el foque, y las palabras de la pancarta que remolca el avión sobre el recorrido.', 'Die Logos, die jedes Boot auf Großsegel und Fock trägt, und die Worte auf dem Banner, das das Flugzeug über die Bahn zieht.', 'Her teknenin ana yelkeninde ve flokunda taşıdığı logolar ve uçağın parkurun üzerinde çektiği pankarttaki sözler.'] },
  { id: 'players', Icon: IconCrew, name: ['Players', 'Игроки', 'Jugadores', 'Spieler', 'Oyuncular'], h: ['Do they come and stay', 'Приходят ли и остаются', '¿Vienen y se quedan?', 'Kommen sie und bleiben sie', 'Geliyorlar ve kalıyorlar mı'],
    goal: ['Who plays, how far a visit gets from opening the game to a finish, and whether the players come back.', 'Кто играет, как далеко заходит визит, от открытия игры до финиша, и возвращаются ли игроки.', 'Quién juega, hasta dónde llega una visita desde que abre el juego hasta una llegada, y si los jugadores vuelven.', 'Wer spielt, wie weit ein Besuch vom Öffnen des Spiels bis zum Ziel kommt und ob die Spieler wiederkommen.', 'Kim oynuyor, bir ziyaret oyunun açılışından bir bitişe ne kadar ilerliyor ve oyuncular geri geliyor mu.'] },
  { id: 'game', Icon: IconTrophy, name: ['The game', 'Игра', 'El juego', 'Das Spiel', 'Oyun'], h: ['Is it fun and fair', 'Интересно ли и честно', '¿Es divertido y justo?', 'Macht es Spaß und ist es fair', 'Eğlenceli ve adil mi'],
    goal: ['How the races go by yacht, wind, venue and course; how hard they are as a player learns; why races are left; what the players say and what they set.', 'Как идут гонки по яхтам, ветру, месту и дистанции; насколько они сложны по мере опыта; почему их бросают; что говорят игроки и что выставляют.', 'Cómo van las regatas por yate, viento, sede y recorrido; lo difíciles que son según aprende el jugador; por qué se abandonan; qué dicen los jugadores y qué ajustan.', 'Wie die Regatten laufen, nach Yacht, Wind, Revier und Bahn; wie schwer sie werden, wenn ein Spieler dazulernt; warum Regatten abgebrochen werden; was die Spieler sagen und was sie einstellen.', 'Yarışlar yata, rüzgâra, yarış alanına ve parkura göre nasıl geçiyor; oyuncu öğrendikçe ne kadar zorlaşıyor; yarışlar neden bırakılıyor; oyuncular ne diyor ve neyi ayarlıyor.'] },
  { id: 'tech', Icon: IconDevice, name: ['Performance', 'Производительность', 'Rendimiento', 'Leistung', 'Performans'], h: ['Does it run well', 'Хорошо ли работает', '¿Funciona bien?', 'Läuft es gut', 'İyi çalışıyor mu'],
    goal: ['How the game runs on the players’ devices: the frame rate and the stalls, the loads that fail, the errors on the page.', 'Как игра работает на устройствах игроков: частота кадров и рывки, неудачные загрузки, ошибки на странице.', 'Cómo funciona el juego en los dispositivos de los jugadores: los fotogramas por segundo y los tirones, las cargas que fallan, los errores en la página.', 'Wie das Spiel auf den Geräten der Spieler läuft: die Bildrate und die Ruckler, die Ladevorgänge, die fehlschlagen, die Fehler auf der Seite.', 'Oyun oyuncuların cihazlarında nasıl çalışıyor: kare hızı ve takılmalar, başarısız yüklemeler, sayfadaki hatalar.'] },
  { id: 'duels', Icon: IconCrew, name: ['1-on-1 races', 'Гонки 1 на 1', 'Regatas 1 contra 1', '1-gegen-1-Regatten', 'Bire bir yarışlar'], h: ['Races sailed head to head', 'Гонки 1 на 1', 'Regatas cara a cara', 'Regatten Kopf an Kopf', 'Baş başa yarışılan yarışlar'],
    goal: ['Every 1-on-1 race the players sailed: who raced whom, where, how it ended, and how often a race is left or sailed again.', 'Все гонки 1 на 1: кто с кем, где, чем закончилась и как часто гонку бросают или проводят заново.', 'Cada regata 1 contra 1 que navegaron los jugadores: quién contra quién, dónde, cómo terminó y con qué frecuencia se abandona o se repite una regata.', 'Jede 1-gegen-1-Regatta der Spieler: wer gegen wen fuhr, wo, wie sie endete und wie oft eine Regatta abgebrochen oder wiederholt wird.', 'Oyuncuların yarıştığı her bire bir yarış: kim kiminle, nerede yarıştı, nasıl bitti ve bir yarış ne sıklıkla bırakılıyor ya da yeniden yarışılıyor.'] },
  { id: 'logs', Icon: IconClock, name: ['Logs', 'Журнал', 'Registros', 'Protokolle', 'Günlükler'], h: ['What went wrong, and for whom', 'Что пошло не так и у кого', 'Qué salió mal y a quién', 'Was schiefging, und bei wem', 'Neyin ters gittiği ve kimin için'],
    goal: ['The players who hit a problem, and each one’s visits and races in full, to see what happened to them.', 'Игроки, столкнувшиеся с проблемой, и все их визиты и гонки в подробностях, чтобы понять, что с ними случилось.', 'Los jugadores que tuvieron un problema, con sus visitas y regatas completas, para ver qué les pasó.', 'Die Spieler, die ein Problem hatten, und von jedem alle Besuche und Regatten, um zu sehen, was ihnen passiert ist.', 'Sorunla karşılaşan oyuncular ve her birinin ziyaretleri ile yarışları, başlarına ne geldiğini görmek için ayrıntılı olarak.'] },
] as const;
export type AdminPage = (typeof ADMIN_PAGES)[number]['id'];
const pageOf = (id: AdminPage) => ADMIN_PAGES.find((p) => p.id === id)!;

// the numbers are over the last 7, 30 or 90 days (?days=), 30 when not said
export const STAT_DAYS = [7, 30, 90] as const;
export const pickDays = (q?: string) => ((STAT_DAYS as readonly number[]).includes(Number(q)) ? Number(q) : 30);
const DATA: AdminPage[] = ['players', 'game', 'tech', 'logs'];

export const adminTitle = (id?: AdminPage) => (id ? titled(`Admin · ${pageOf(id).name[0]}`, `Админка · ${pageOf(id).name[1]}`, `Admin · ${pageOf(id).name[0]}`, `Admin · ${pageOf(id).name[0]}`, `Yönetici · ${pageOf(id).name[0]}`, { index: false }) : titled('Admin', 'Админка', 'Admin', 'Admin', 'Yönetici', { index: false }));

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;
// Who is reading, whether they are an admin, and what the page loads for one: the load goes with the admin check, not
// after it, and its data is kept for an admin alone.
export async function adminLoad<D = null>(params: LangParams['params'], load?: (sb: Supabase) => Promise<D>) {
  const [{ lang, t }, account] = await Promise.all([getT(params), getAccount()]);
  if (!account) return { lang, t, account, admin: false, data: null };
  const supabase = await supabaseServer();
  const [{ data: isAdmin }, data] = await Promise.all([supabase.rpc('is_regatta_admin'), load ? load(supabase) : Promise.resolve(null)]);
  const admin = isAdmin === true;
  return { lang, t, account, admin, data: admin ? data : null };
}

// one of the database's sums for an admin over the last `days`, or why it didn't come
export async function adminRpc<D>(sb: Supabase, fn: 'regatta_admin_stats' | 'regatta_admin_insight' | 'regatta_admin_players' | 'regatta_admin_logs' | 'regatta_admin_duels', days: number | null, more?: { person: string | null }): Promise<{ data: D | null; error: string | null }> {
  const r = await sb.rpc(fn, { days, ...more });
  return r.error ? { data: null, error: r.error.message } : { data: r.data as D, error: null };
}

const withDays = (path: string, days?: number) => (days && days !== 30 ? `${path}?days=${days}` : path);

export function AdminShell({ lang, t, account, admin, page, days, who, children }: {
  lang: Lang; t: T; account: Account; admin: boolean; page?: AdminPage; days?: number; who?: string | null; children: ReactNode;
}) {
  const p = page ? pageOf(page) : null;
  const here = page ? `/admin/${page}` : '/admin';
  return (
    <div className="scr app bc" lang={lang} data-acct={account ? 'signed' : 'guest'}>
      <SiteHead lang={lang} t={t} page="settings" />
      <div className="lay page">
        <div className="aph">
          <div className="aph-top">
            {p
              ? <BackLink className="round round-s round-muted" href="/admin" label={t('Back to the admin', 'Назад в админку', 'Volver al admin', 'Zurück zum Admin', 'Yöneticiye dön')} />
              : <BackLink className="round round-s round-muted" href="/settings" label={t('Back to settings', 'Назад в настройки', 'Volver a ajustes', 'Zurück zu den Einstellungen', 'Ayarlara dön')} />}
            <span className="kicker">{p ? `${t('Admin', 'Админка', 'Admin', 'Admin', 'Yönetici')} · ${pick(p.name, lang)}` : t('Admin', 'Админка', 'Admin', 'Admin', 'Yönetici')}</span>
          </div>
          <h1 className="aph-h">{p ? pick(p.h, lang) : t('The race, the ads and the numbers', 'Гонка, реклама и цифры', 'La regata, los anuncios y los números', 'Die Regatta, die Werbung und die Zahlen', 'Yarış, reklamlar ve rakamlar')}</h1>
          <p className="aph-p">{p ? pick(p.goal, lang) : t('A page for each thing you come here to do.', 'По странице на каждую задачу.', 'Una página para cada cosa que vienes a hacer aquí.', 'Eine Seite für alles, weswegen du hierherkommst.', 'Buraya geldiğin her iş için bir sayfa.')}</p>
          {admin && (
            <div className="adm-bar">
              <nav className="segc adm-nav" aria-label={t('Admin pages', 'Разделы админки', 'Páginas del admin', 'Admin-Seiten', 'Yönetici sayfaları')}>
                {ADMIN_PAGES.map((x) => (
                  <Link key={x.id} href={DATA.includes(x.id) ? withDays(`/admin/${x.id}`, days) : `/admin/${x.id}`}
                    className={x.id === page ? 'on' : undefined} aria-current={x.id === page ? 'page' : undefined}>{pick(x.name, lang)}</Link>
                ))}
              </nav>
              {page && DATA.includes(page) && days != null && (
                <nav className="adm-range" aria-label={t('Period', 'Период', 'Periodo', 'Zeitraum', 'Dönem')}>
                  {STAT_DAYS.map((d) => (
                    <Link key={d} href={`${here}?days=${d}${who ? `&who=${encodeURIComponent(who)}` : ''}`} scroll={false} aria-current={d === days ? 'page' : undefined} className={d === days ? 'on' : undefined}>
                      {t(`${d} days`, `${d} дн.`, `${d} días`, `${d} Tage`, `${d} gün`)}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          )}
        </div>
        {!account ? (
          <div className="acct acct-row">
            <div className="acct-guest">
              <span className="srow-k">{t('Sign in as an admin', 'Войдите как администратор', 'Inicia sesión como administrador', 'Als Admin anmelden', 'Yönetici olarak giriş yap')}</span>
              <span className="small">{t('With the email on the admin list', 'С почтой из списка администраторов', 'Con el correo de la lista de administradores', 'Mit der E-Mail auf der Admin-Liste', 'Yönetici listesindeki e-postayla')}</span>
            </div>
            <Link className="pill pill-xs" href={`/sign-in?next=${here}`}><span className="btn-t">{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap')}</span></Link>
          </div>
        ) : !admin ? (
          <p className="hint">{t(`${account.email || account.name} is not on the admin list.`, `${account.email || account.name} нет в списке администраторов.`, `${account.email || account.name} no está en la lista de administradores.`, `${account.email || account.name} steht nicht auf der Admin-Liste.`, `${account.email || account.name} yönetici listesinde değil.`)}</p>
        ) : children}
      </div>
    </div>
  );
}

// /admin: the pages, each with what it is for
export function AdminHub({ lang }: { lang: Lang }) {
  return (
    <ul className="adm-hub">
      {ADMIN_PAGES.map(({ id, Icon, name, h, goal }) => (
        <li key={id}>
          <Link href={`/admin/${id}`} className="adm adm-hub-a">
            <span className="adm-k"><Icon /><span className="kicker">{pick(name, lang)}</span></span>
            <b className="adm-hub-h">{pick(h, lang)}</b>
            <span className="hint">{pick(goal, lang)}</span>
            <IconArrow />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// a block of numbers that didn't come: the database's error, or nothing in the period
export function AdminMissing({ title, Icon, error, t }: { title: string; Icon: ComponentType<{ s?: number }>; error?: string | null; t: T }) {
  return (
    <div className="adm adm-stats">
      <div className="adm-k"><Icon /><span className="kicker">{title}</span></div>
      <p className="hint">{error ? t(`The numbers didn’t load: ${error}`, `Цифры не загрузились: ${error}`, `Los números no cargaron: ${error}`, `Die Zahlen wurden nicht geladen: ${error}`, `Rakamlar yüklenmedi: ${error}`) : t('Nothing in this period.', 'За этот период ничего нет.', 'Nada en este periodo.', 'Nichts in diesem Zeitraum.', 'Bu dönemde bir şey yok.')}</p>
    </div>
  );
}
