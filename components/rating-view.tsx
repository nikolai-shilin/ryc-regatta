import Link from 'next/link';
import { LOCALE, type Lang, type T } from '@/lib/lang';
import { ruPlural } from '@/lib/lang';
import { clock } from '@/lib/clock';
import type { Rating } from '@/lib/rating';
import { todayUtc } from '@/lib/rating';
import { dailyRace, KN } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { venueOf } from '@/lib/venues';
import { IconPlay, IconTrophy } from './ui';
import { Who } from './flag';
import { CountUp } from './count-up';
import { MyMonth } from './my-month';
import { RivalLine } from './progress';

const at = (d: string) => new Date(d + 'T12:00:00Z');
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const href = (d: string) => (d === todayUtc() ? '/race/rating' : `/race/rating/${d}`);

// R2 · The day's rating: that day's race (everyone sails the same one), its sailors by their best time with the
// points each took, and the month's standings, the points added up day by day. Days of the month along the top.
// (the page is cached for everyone alike: whether you're signed in is the browser's to show, .if-guest; lib/me.ts)
export function RatingView({ day, data, lang, t }: { day: string; data: Rating | null; lang: Lang; t: T }) {
  const loc = LOCALE[lang];
  const today = todayUtc(), isToday = day === today;
  const race = dailyRace(at(day)), venue = venueOf(race.venue);
  const wind = { light: t('Light breeze', 'Слабый ветер', 'Brisa suave', 'Leichte Brise', 'Hafif meltem', 'Petite brise'), medium: t('Medium breeze', 'Средний ветер', 'Brisa media', 'Mittlere Brise', 'Orta meltem', 'Brise moyenne'), strong: t('Strong breeze', 'Сильный ветер', 'Brisa fuerte', 'Starke Brise', 'Kuvvetli meltem', 'Forte brise') }[race.preset];
  const title = at(day).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const month = at(day).toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' });
  // the month's days so far, newest first; those with a ranked finisher are marked
  const first = day.slice(0, 8) + '01', last = (() => { const e = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10); return e < today ? e : today; })();
  const days: string[] = []; for (let d = last; d >= first; d = shift(d, -1)) days.push(d);
  const raced = new Set(data?.days || []);
  const rows = data?.rows || [], best = rows[0]?.s;
  const n = rows.length;
  const races = (k: number) => t(`${k} ${k === 1 ? 'race' : 'races'}`, `${k} ${ruPlural(k, ['заезд', 'заезда', 'заездов'])}`, `${k} ${k === 1 ? 'regata' : 'regatas'}`, `${k} ${k === 1 ? 'Regatta' : 'Regatten'}`, `${k} yarış`, `${k} ${k === 1 ? 'régate' : 'régates'}`);
  const pts = (k: number) => t(`${k} ${k === 1 ? 'pt' : 'pts'}`, `${k} ${ruPlural(k, ['очко', 'очка', 'очков'])}`, `${k} ${k === 1 ? 'pto' : 'ptos'}`, `${k} Pkt`, `${k} puan`, `${k} ${k === 1 ? 'pt' : 'pts'}`);

  return (
    <>
      <header className="hm-page hm-ph rt-head">
        <span className="kicker">{isToday ? t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', 'Günün sıralaması', 'Classement du jour') : t('Leaderboard', 'Рейтинг', 'Clasificación', 'Rangliste', 'Sıralama', 'Classement')}</span>
        <h1 className="hm-ph-h">{title}</h1>
        <p className="hm-text">
          {t(...venue.name)} · {t(...yachtOf(race.yacht).name)} · {wind} {KN[race.preset]} {t('kn', 'уз', 'kn', 'kn', 'kn', 'kn')}
          {data ? <> · {races(data.races)}{n ? <>, {t(`${n} ranked`, `в рейтинге ${n}`, `${n} clasificados`, `${n} gerankt`, `${n} sıralandı`, `${n} classés`)}</> : null}</> : null}
        </p>
        <nav className="rt-days" aria-label={t('Days of the month', 'Дни месяца', 'Días del mes', 'Tage des Monats', 'Ayın günleri', 'Jours du mois')}>
          <Link className="rt-step" href={href(shift(day, -1))} aria-label={t('The day before', 'Предыдущий день', 'El día anterior', 'Der Tag davor', 'Önceki gün', 'La veille')} prefetch={false}>‹</Link>
          <div className="rt-strip">
            {days.map((d) => (
              <Link key={d} href={href(d)} className={`rt-day ${d === day ? 'on' : ''} ${raced.has(d) ? 'has' : ''}`} aria-current={d === day ? 'page' : undefined} prefetch={false}>
                <b>{+d.slice(8)}</b><span>{at(d).toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' })}</span>
              </Link>
            ))}
          </div>
          {day < today ? <Link className="rt-step" href={href(shift(day, 1))} aria-label={t('The day after', 'Следующий день', 'El día siguiente', 'Der Tag danach', 'Sonraki gün', 'Le lendemain')} prefetch={false}>›</Link> : <span className="rt-step off" aria-hidden="true">›</span>}
        </nav>
      </header>

      <main className="hm-page rt">
        {!data ? (
          <section className="rt-card rt-empty">
            <span className="lbl-ink">{t('The leaderboard can’t be loaded right now', 'Рейтинг сейчас не загружается', 'La clasificación no se puede cargar ahora mismo', 'Die Rangliste lässt sich gerade nicht laden', 'Sıralama şu an yüklenemiyor', 'Le classement ne peut pas être chargé pour le moment')}</span>
            <p>{t('The scores server didn’t answer. Times are still being kept: try again in a minute.', 'Сервер результатов не ответил. Время всё равно записывается — попробуй через минуту.', 'El servidor de puntuaciones no respondió. Los tiempos se siguen guardando: inténtalo de nuevo en un minuto.', 'Der Punkte-Server hat nicht geantwortet. Zeiten werden weiter gespeichert: Versuch es in einer Minute nochmal.', 'Skor sunucusu yanıt vermedi. Süreler yine de tutuluyor: bir dakika sonra yeniden dene.', 'Le serveur des scores n’a pas répondu. Les temps sont toujours enregistrés : réessaie dans une minute.')}</p>
            <a className="rt-go" href="/play?race=today"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour')}</span></a>
          </section>
        ) : (
          <div className="rt-grid">
            <section className="rt-card" aria-labelledby="rt-day-h">
              <div className="rt-card-h"><span className="lbl-ink" id="rt-day-h"><IconTrophy s={13} />{t('The day’s race', 'Гонка дня', 'La regata del día', 'Die Regatta des Tages', 'Günün yarışı', 'La régate du jour')}</span><span className="lbl">{t('Best time · points', 'Лучшее время · очки', 'Mejor tiempo · puntos', 'Beste Zeit · Punkte', 'En iyi süre · puan', 'Meilleur temps · points')}</span></div>
              {n ? (
                <ol className="rt-lb">
                  {rows.map((r, i) => {
                    const place = rows.findIndex((x) => x.s === r.s) + 1; // equal times share a place
                    return (
                      <li key={r.k} className={place === 1 ? 'first' : place <= 3 ? 'pod' : ''} style={{ ['--i' as string]: Math.min(i, 12) }}>
                        <span className="rt-n">{place}</span>
                        <Who fl={r.fl} name={r.name || t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız', 'Sans nom')} lang={lang} />
                        <span className="rt-t">{clock(r.s)}{i > 0 && best != null ? <small>+{(r.s - best).toFixed(1)}</small> : null}</span>
                        <span className="rt-p"><b>+{r.pts}</b></span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rt-none">{isToday ? t('No ranked times yet today. The first to finish takes the top.', 'Сегодня ещё нет результатов в рейтинге. Первый на финише — первый в таблице.', 'Aún no hay tiempos clasificados hoy. El primero en llegar se lleva la cima.', 'Noch keine gerankten Zeiten heute. Wer zuerst ins Ziel kommt, steht oben.', 'Bugün henüz sıralanan süre yok. İlk bitiren zirveyi alır.', 'Pas encore de temps classé aujourd’hui. Le premier à finir prend la tête.') : t('No one ranked on this day.', 'В этот день в рейтинге никого.', 'Nadie clasificado este día.', 'An diesem Tag niemand gerankt.', 'Bu günde sıralanan yok.', 'Personne n’est classé ce jour-là.')}</p>
              )}
              {data.guests > 0 && (
                <p className="rt-guests">
                  {t(`${data.guests} ${data.guests === 1 ? 'race was' : 'races were'} sailed signed out and ${data.guests === 1 ? 'doesn’t' : 'don’t'} rank.`, `${data.guests} ${ruPlural(data.guests, ['заезд пройден', 'заезда пройдено', 'заездов пройдено'])} без входа и не ${ruPlural(data.guests, ['попал', 'попали', 'попали'])} в рейтинг.`, `${data.guests} ${data.guests === 1 ? 'regata se navegó' : 'regatas se navegaron'} sin iniciar sesión y no ${data.guests === 1 ? 'puntúa' : 'puntúan'}.`, `${data.guests} ${data.guests === 1 ? 'Regatta wurde' : 'Regatten wurden'} abgemeldet gesegelt und ${data.guests === 1 ? 'zählt' : 'zählen'} nicht für die Rangliste.`, `${data.guests} yarış giriş yapmadan yarışıldı ve sıralanmaz.`, `${data.guests} ${data.guests === 1 ? 'régate a été courue' : 'régates ont été courues'} sans connexion et ${data.guests === 1 ? 'n’est pas classée' : 'ne sont pas classées'}.`)}
                  <span className="if-guest"> <Link href={`/sign-in?next=${encodeURIComponent(href(day))}`}>{t('Sign in to rank', 'Войди, чтобы попасть в рейтинг', 'Inicia sesión para clasificarte', 'Anmelden, um zu ranken', 'Sıralanmak için giriş yap', 'Connecte-toi pour être classé')} ›</Link></span>
                </p>
              )}
              {isToday && <a className="rt-go" href="/play?race=today"><IconPlay /><span>{n ? t('Beat these times', 'Побей эти времена', 'Supera estos tiempos', 'Schlag diese Zeiten', 'Bu süreleri geç', 'Bats ces temps') : t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour')}</span></a>}
            </section>

            <aside className="rt-card rt-month" aria-labelledby="rt-month-h">
              {isToday ? <RivalLine lang={lang} /> : null}
              <MyMonth day={day} lang={lang} />
              <div className="rt-card-h"><span className="lbl-ink" id="rt-month-h">{t(`${month} standings`, `Итоги: ${month}`, `Clasificación de ${month}`, `Stand ${month}`, `${month} sıralaması`, `Classement de ${month}`)}</span><span className="lbl">{t(`${data.month.days} race ${data.month.days === 1 ? 'day' : 'days'}`, `${data.month.days} ${ruPlural(data.month.days, ['день', 'дня', 'дней'])} гонок`, `${data.month.days} ${data.month.days === 1 ? 'día' : 'días'} de regata`, `${data.month.days} ${data.month.days === 1 ? 'Regattatag' : 'Regattatage'}`, `${data.month.days} yarış günü`, `${data.month.days} ${data.month.days === 1 ? 'jour' : 'jours'} de régate`)}</span></div>
              {data.month.rows.length ? (
                <ol className="rt-lb rt-lb-m">
                  {data.month.rows.slice(0, 20).map((r, i) => (
                    <li key={r.k} className={i === 0 ? 'first' : i < 3 ? 'pod' : ''} style={{ ['--i' as string]: Math.min(i, 12) }}>
                      <span className="rt-n">{i + 1}</span>
                      <span className="rt-mw">
                        <Who fl={r.fl} name={r.name || t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız', 'Sans nom')} lang={lang} />
                        <small>{t(`${r.days} ${r.days === 1 ? 'day' : 'days'}`, `${r.days} ${ruPlural(r.days, ['день', 'дня', 'дней'])}`, `${r.days} ${r.days === 1 ? 'día' : 'días'}`, `${r.days} ${r.days === 1 ? 'Tag' : 'Tage'}`, `${r.days} gün`, `${r.days} ${r.days === 1 ? 'jour' : 'jours'}`)}{r.wins ? <> · <span className="is-gold">{t(`${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`, `${r.wins} ${ruPlural(r.wins, ['победа', 'победы', 'побед'])}`, `${r.wins} ${r.wins === 1 ? 'victoria' : 'victorias'}`, `${r.wins} ${r.wins === 1 ? 'Sieg' : 'Siege'}`, `${r.wins} galibiyet`, `${r.wins} ${r.wins === 1 ? 'victoire' : 'victoires'}`)}</span></> : null}{r.podiums - r.wins > 0 ? <> · {t(`${r.podiums} ${r.podiums === 1 ? 'podium' : 'podiums'}`, `подиумов: ${r.podiums}`, `${r.podiums} ${r.podiums === 1 ? 'podio' : 'podios'}`, `${r.podiums} ${r.podiums === 1 ? 'Podium' : 'Podien'}`, `${r.podiums} podyum`, `${r.podiums} ${r.podiums === 1 ? 'podium' : 'podiums'}`)}</> : null}</small>
                      </span>
                      <span className="rt-p"><b><CountUp v={String(r.pts)} /></b><small>{t(r.pts === 1 ? 'pt' : 'pts', ruPlural(r.pts, ['очко', 'очка', 'очков']), r.pts === 1 ? 'pto' : 'ptos', r.pts === 1 ? 'Pkt.' : 'Pkt.', 'puan', r.pts < 2 ? 'pt' : 'pts')}</small></span>
                    </li>
                  ))}
                </ol>
              ) : <p className="rt-none">{t('No points yet this month.', 'В этом месяце очков ещё нет.', 'Aún no hay puntos este mes.', 'Noch keine Punkte in diesem Monat.', 'Bu ay henüz puan yok.', 'Pas encore de points ce mois-ci.')}</p>}
              <div className="rt-how">
                <span className="lbl-ink">{t('How the points work', 'Как считаются очки', 'Cómo funcionan los puntos', 'So funktionieren die Punkte', 'Puanlar nasıl çalışır', 'Comment marchent les points')}</span>
                <p>{t('Each day, your best time in that day’s race counts. You get a point for finishing and one more for every sailor you beat: first of ten takes 10, last takes 1. The month adds up the days, so racing every day pays.', 'Каждый день считается твоё лучшее время в гонке дня. Очко за финиш и ещё по одному за каждого, кого ты обогнал: первый из десяти получает 10, последний — 1. За месяц очки складываются, так что гоняться каждый день выгодно.', 'Cada día cuenta tu mejor tiempo en la regata de ese día. Recibes un punto por llegar y uno más por cada navegante al que superas: el primero de diez recibe 10, el último 1. El mes suma los días, así que regatear cada día compensa.', 'Jeden Tag zählt deine beste Zeit in der Regatta dieses Tages. Du bekommst einen Punkt fürs Ziel und einen weiteren für jeden Segler, den du schlägst: Der Erste von zehn bekommt 10, der Letzte 1. Der Monat zählt die Tage zusammen, jeden Tag zu segeln lohnt sich also.', 'Her gün, o günün yarışındaki en iyi süren sayılır. Bitirdiğin için bir puan alırsın, geçtiğin her yarışçı için bir puan daha: ondan birinci 10, sonuncu 1 alır. Ay günleri toplar, yani her gün yarışmak işe yarar.', 'Chaque jour, c’est ton meilleur temps dans la régate du jour qui compte. Tu gagnes un point pour avoir fini, plus un pour chaque marin que tu bats : le premier sur dix en prend 10, le dernier 1. Le mois additionne les jours : régater tous les jours, ça paie.')}</p>
                <p className="rt-ex">{isToday ? t('Today:', 'Сегодня:', 'Hoy:', 'Heute:', 'Bugün:', 'Aujourd’hui :') : t('That day:', 'В тот день:', 'Ese día:', 'Dieser Tag:', 'O gün:', 'Ce jour-là :')}{' '}{n ? t(`${n} ranked, so the winner takes ${pts(n)}.`, `в рейтинге ${n}, победитель получает ${pts(n)}.`, `${n} clasificados, así que el ganador recibe ${pts(n)}.`, `${n} gerankt, der Sieger bekommt also ${pts(n)}.`, `${n} sıralandı, yani kazanan ${pts(n)} alır.`, `${n} classés, donc le vainqueur prend ${pts(n)}.`) : t('no one ranked yet.', 'в рейтинге пока никого.', 'nadie clasificado aún.', 'noch niemand gerankt.', 'henüz sıralanan yok.', 'personne n’est encore classé.')}</p>
              </div>
            </aside>
          </div>
        )}
        {/* the flags, for a sailor wondering where theirs is */}
        <p className="rt-foot">{t('The flag is the one you fly on ', 'Флаг — тот, что ты поднял на странице ', 'La bandera es la que ondeas en ', 'Die Flagge ist die, die du fährst auf ', 'Bayrak, uçurduğun bayraktır: ', 'Le pavillon est celui que tu arbores sur ')}<Link href="/boat">{t('your yacht', 'своей яхты', 'tu yate', 'deiner Yacht', 'yatın', 'ton yacht')}</Link>.</p>
      </main>
    </>
  );
}
