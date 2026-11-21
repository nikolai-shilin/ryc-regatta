import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { todayUtc } from '@/lib/day';
import { myPlayerKey } from '@/lib/player-key';
import { getPlayerMonth, KEY_RE, lastDay, monthName, MONTH_RE, shiftMonth, type PlayerMonth } from '@/lib/player-month';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { RaceMonth } from '@/components/race-month';
import { MyMonth } from '@/components/my-month';
import { IconPlay } from '@/components/ui';
import '@/styles/race-board.css'; // (its buttons and links: .rb-acts, .rb-link)
import '@/styles/race-help.css'; // (its table: .rh-table)
import '@/styles/race-month.css';

// your own month: read with your session, so never the same page twice; not for search
export const generateMetadata = titled('Your month, day by day', 'Твой месяц по дням', 'Tu mes, día a día', 'Dein Monat, Tag für Tag', 'Ayın, gün gün', 'Ton mois, jour par jour', 'Il tuo mese, giorno per giorno', 'Seu mês, dia a dia', { index: false });

type Query = Record<string, string | string[] | undefined>;
const one = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x);
const DAY_BACK = 400; // as far back as the scores API keeps days

// Your month, day by day (release 6c of the 1-on-1 plan): the month's points, from the scores API's own table, day by
// day (components/race-month.tsx). ?m=YYYY-MM another month; ?p=<key> another sailor's (their key, as /players?p=).
// Signed out, the times this device kept this month (components/my-month.tsx) and a way to sign in: points are for
// sailors who are somebody.
export default async function RaceMonthPage({ params, searchParams }: LangParams & { searchParams: Promise<Query> }) {
  const { lang, t } = await getT(params);
  const sp = await searchParams, today = todayUtc(), cur = today.slice(0, 7);
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_BACK * 864e5).toISOString().slice(0, 10);
  const mq = one(sp.m), m = mq && MONTH_RE.test(mq) && mq <= cur && lastDay(mq) >= oldest ? mq : cur;
  const pq = one(sp.p), p = pq && KEY_RE.test(pq) ? pq : null;
  const me = p ? null : await myPlayerKey(), k = p || me?.k || null;
  const data: PlayerMonth | null = k ? await getPlayerMonth(m, k)
    : me?.signedIn ? { m, k: '', pts: 0, place: null, of: 0, wins: 0, podiums: 0, sailed: 0, days: [], near: [], above: null } : null; // never raced: no points yet
  const own = !p, name = data?.near.find((x) => x.me)?.name ?? null;

  const href = (mm: string) => `/race/month${p || mm !== cur ? `?${new URLSearchParams({ ...(p && { p }), ...(mm !== cur && { m: mm }) })}` : ''}`;
  const prev = shiftMonth(m, -1), next = shiftMonth(m, 1);
  const nav = (
    <nav className="hm-page rm-nav" aria-label={t('Months', 'Месяцы', 'Meses', 'Monate', 'Aylar', 'Mois', 'Mesi', 'Meses')}>
      {lastDay(prev) >= oldest ? <Link className="rb-link" href={href(prev)} rel="prev">‹ {monthName(prev, lang)}</Link> : <span />}
      <Link className="rb-link" href="/race#board">{t('The leaderboard', 'Рейтинг', 'La clasificación', 'Die Rangliste', 'Sıralama', 'Le classement', 'La classifica', 'A classificação')}</Link>
      {next <= cur ? <Link className="rb-link" href={href(next)} rel="next">{monthName(next, lang)} ›</Link> : <span />}
    </nav>
  );
  const sailToday = <a className="rt-go" href="/play?race=today"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia')}</span></a>;

  return (
    <div className="scr help hp bc rm" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" crumbs={[[t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia'), '/race'], [t('Your month', 'Твой месяц', 'Tu mes', 'Dein Monat', 'Senin ayın', 'Ton mois', 'Il tuo mese', 'Seu mês'), '/race/month']]} />
      {data ? <RaceMonth lang={lang} data={data} today={today} own={own} name={name} nav={nav} /> : (
        <>
          <header className="hm-page hm-ph rm-head">
            <span className="kicker">{t(`Your month · ${monthName(m, lang)}`, `Твой месяц · ${monthName(m, lang)}`, `Tu mes · ${monthName(m, lang)}`, `Dein Monat · ${monthName(m, lang)}`, `Senin ayın · ${monthName(m, lang)}`, `Ton mois · ${monthName(m, lang)}`, `Il tuo mese · ${monthName(m, lang)}`, `Seu mês · ${monthName(m, lang)}`)}</span>
            <h1 className="hm-ph-h">{t('Your month, day by day', 'Твой месяц по дням', 'Tu mes, día a día', 'Dein Monat, Tag für Tag', 'Ayın, gün gün', 'Ton mois, jour par jour', 'Il tuo mese, giorno per giorno', 'Seu mês, dia a dia')}</h1>
          </header>
          {nav}
          <div className="hm-page rm-main">
            {k ? (
              <section className="rm-sec"><p className="lead">{t('Your month can’t be loaded right now. Your times are still being kept: try again in a minute.', 'Твой месяц сейчас не загружается. Время всё равно записывается — попробуй через минуту.', 'Tu mes no se puede cargar ahora. Tus tiempos se siguen guardando: inténtalo en un minuto.', 'Dein Monat lässt sich gerade nicht laden. Deine Zeiten werden weiter gespeichert: versuch es in einer Minute.', 'Ayın şu an yüklenemiyor. Sürelerin yine kaydediliyor: bir dakika sonra dene.', 'Ton mois ne se charge pas pour l’instant. Tes temps sont toujours gardés : réessaie dans une minute.', 'Il tuo mese non si carica ora. I tuoi tempi vengono comunque salvati: riprova tra un minuto.', 'Seu mês não carrega agora. Seus tempos continuam guardados: tente em um minuto.')}</p></section>
            ) : (
              <section className="rm-sec rm-guest">
                <p className="lead">{t('Points are kept for sailors who are signed in. Sign in, and every day you finish today’s race adds up here, on the same board as everyone’s.', 'Очки ведутся для тех, кто вошёл в аккаунт. Войди — и каждый день, когда ты проходишь гонку дня, будет складываться здесь, на общей доске.', 'Los puntos son para quien ha iniciado sesión. Inicia sesión y cada día que termines la regata del día se sumará aquí, en la misma clasificación que todos.', 'Punkte gibt es für angemeldete Segler. Melde dich an, und jeder Tag, an dem du die Regatta des Tages beendest, zählt hier, auf derselben Rangliste wie alle.', 'Puanlar giriş yapmış denizciler için tutulur. Giriş yap; günün yarışını bitirdiğin her gün burada, herkesle aynı tabloda toplanır.', 'Les points sont pour les régatiers connectés. Connecte-toi, et chaque jour où tu termines la régate du jour s’additionne ici, au même classement que tout le monde.', 'I punti sono per chi ha fatto l’accesso. Accedi, e ogni giorno in cui finisci la regata del giorno si somma qui, nella stessa classifica di tutti.', 'Os pontos são para quem entrou na conta. Entre, e cada dia em que você termina a regata do dia soma aqui, na mesma classificação de todos.')}</p>
                <div className="rb-acts">
                  <Link className="rt-go" href={`/sign-in?next=${encodeURIComponent('/race/month')}`}><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</span></Link>
                  {sailToday}
                </div>
                <MyMonth day={m === cur ? today : lastDay(m)} lang={lang} />
              </section>
            )}
          </div>
        </>
      )}
      <SiteFoot lang={lang} t={t} back="/race/month" />
    </div>
  );
}
