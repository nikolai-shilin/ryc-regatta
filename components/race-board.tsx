import Link from 'next/link';
import { LOCALE, ruPlural, type Lang, type T } from '@/lib/lang';
import { clock } from '@/lib/clock';
import type { Rating } from '@/lib/rating';
import type { DuelBoard } from '@/lib/duel-board';
import { levelName } from '@/lib/levels';
import { provisional, shown } from '@/lib/elo';
import { IconPlay } from './ui';
import { Who } from './flag';
import { CountUp } from './count-up';
import { MyMonth } from './my-month';
import { howPoints, ptsOf } from './rating-view';
import '@/styles/race-board.css';

// The leaderboard on the race hub (release 6a of the 1-on-1 plan): a sheet over the hub's scene, opened by its address,
// /race#board (where /race/rating now leads, next.config.ts), with three boards that never move one another: Today (every
// ranked sailor's best time, the points each took), the month (the points added up day by day, and your own month) and
// the 1-on-1 rating (settled ratings first, then provisional ones). Tabs are radio buttons, so it works without script;
// the days before keep their own pages (/race/rating/YYYY-MM-DD). Built once for everyone every five minutes, as the hub is.
export function RaceBoard({ lang, t, day, venue, data, duel }: { lang: Lang; t: T; day: string; venue: string; data: Rating | null; duel: DuelBoard | null }) {
  const loc = LOCALE[lang];
  const at = new Date(day + 'T12:00:00Z');
  const date = at.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const month = at.toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' });
  const before = new Date(at.getTime() - 864e5).toISOString().slice(0, 10);
  const noName = t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız', 'Sans nom', 'Senza nome', 'Sem nome');
  const rows = data?.rows || [], n = rows.length, best = rows[0]?.s;
  const down = <p className="rb-none">{t('The leaderboard can’t be loaded right now. Times are still being kept: try again in a minute.', 'Рейтинг сейчас не загружается. Время всё равно записывается — попробуй через минуту.', 'La clasificación no se puede cargar ahora. Los tiempos se siguen guardando: inténtalo en un minuto.', 'Die Rangliste lässt sich gerade nicht laden. Die Zeiten werden weiter gespeichert: versuch es in einer Minute.', 'Sıralama şu an yüklenemiyor. Süreler yine kaydediliyor: bir dakika sonra dene.', 'Le classement ne se charge pas pour l’instant. Les temps sont toujours gardés : réessaie dans une minute.', 'La classifica non si carica ora. I tempi vengono comunque salvati: riprova tra un minuto.', 'A classificação não carrega agora. Os tempos continuam guardados: tente em um minuto.')}</p>;
  const tab = (id: string, label: string, on = false) => (
    <><input type="radio" name="rb-tab" id={`rb-t-${id}`} className="rb-radio" defaultChecked={on} /><label htmlFor={`rb-t-${id}`} className="rb-tab">{label}</label></>
  );
  return (
    <section id="board" className="rb bc" aria-labelledby="rb-h">
      <div className="rb-in">
        <div className="rb-top">
          <span className="bt-kick">{t('The leaderboard', 'Рейтинг', 'La clasificación', 'Die Rangliste', 'Sıralama', 'Le classement', 'La classifica', 'A classificação')}</span>
          <a className="rb-close" href="#" aria-label={t('Close the leaderboard', 'Закрыть рейтинг', 'Cerrar la clasificación', 'Rangliste schließen', 'Sıralamayı kapat', 'Fermer le classement', 'Chiudi la classifica', 'Fechar a classificação')}>×</a>
        </div>
        <h2 className="rb-h" id="rb-h">{date} · {venue}</h2>
        <div className="rb-tabs">
          {tab('day', t('Today', 'Сегодня', 'Hoy', 'Heute', 'Bugün', 'Aujourd’hui', 'Oggi', 'Hoje'), true)}
          {tab('month', month.charAt(0).toLocaleUpperCase(loc) + month.slice(1))}
          {tab('duel', t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1'))}

          <div className="rb-p rb-p-day">
            {!data ? down : n ? (
              <ol className="rt-lb rb-lb">
                {rows.map((r, i) => {
                  const place = rows.findIndex((x) => x.s === r.s) + 1; // equal times share a place
                  return (
                    <li key={r.k} className={place === 1 ? 'first' : place <= 3 ? 'pod' : ''}>
                      <span className="rt-n">{place}</span>
                      <Who fl={r.fl} name={r.name || noName} lang={lang} />
                      <span className="rt-t">{clock(r.s)}{i > 0 && best != null ? <small>+{(r.s - best).toFixed(1)}</small> : null}</span>
                      <span className="rt-p"><b>+{r.pts}</b></span>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="rb-none">{t('No ranked times yet today. The first to finish takes the top.', 'Сегодня ещё нет результатов в рейтинге. Первый на финише — первый в рейтинге.', 'Aún no hay tiempos clasificados hoy. El primero en llegar se lleva el primer puesto.', 'Heute noch keine gerankten Zeiten. Wer zuerst ins Ziel kommt, steht oben.', 'Bugün henüz sıralı süre yok. İlk bitiren zirveye oturur.', 'Pas encore de temps classé aujourd’hui. Le premier arrivé prend la tête.', 'Ancora nessun tempo in classifica oggi. Il primo ad arrivare prende la vetta.', 'Ainda não há tempos classificados hoje. Quem chegar primeiro fica no topo.')}</p>}
            {data && data.guests > 0 && <p className="rb-note">{t(`${data.guests} ${data.guests === 1 ? 'race was' : 'races were'} sailed signed out and ${data.guests === 1 ? 'doesn’t' : 'don’t'} rank.`, `${data.guests} ${ruPlural(data.guests, ['заезд пройден', 'заезда пройдено', 'заездов пройдено'])} без входа и в рейтинг не ${data.guests === 1 ? 'попадает' : 'попадают'}.`, `${data.guests} ${data.guests === 1 ? 'regata se navegó' : 'regatas se navegaron'} sin iniciar sesión y no ${data.guests === 1 ? 'clasifica' : 'clasifican'}.`, `${data.guests} ${data.guests === 1 ? 'Regatta wurde' : 'Regatten wurden'} ohne Anmeldung gesegelt und ${data.guests === 1 ? 'zählt' : 'zählen'} nicht.`, `${data.guests} yarış giriş yapmadan yapıldı ve sıralamaya girmiyor.`, `${data.guests} ${data.guests === 1 ? 'régate a été courue' : 'régates ont été courues'} sans connexion et ne ${data.guests === 1 ? 'compte' : 'comptent'} pas.`, `${data.guests} ${data.guests === 1 ? 'regata è stata corsa' : 'regate sono state corse'} senza accesso e non ${data.guests === 1 ? 'conta' : 'contano'}.`, `${data.guests} ${data.guests === 1 ? 'regata foi velejada' : 'regatas foram velejadas'} sem entrar e não ${data.guests === 1 ? 'conta' : 'contam'}.`)}</p>}
            <div className="rb-acts">
              <a className="rt-go" href="/play?race=today"><IconPlay /><span>{n ? t('Beat these times', 'Побей эти времена', 'Supera estos tiempos', 'Schlag diese Zeiten', 'Bu süreleri geç', 'Bats ces temps', 'Batti questi tempi', 'Bata estes tempos') : t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia')}</span></a>
              <Link className="rb-link" href={`/race/rating/${before}`} prefetch={false}>{t('The days before', 'Прошлые дни', 'Los días anteriores', 'Die Tage davor', 'Önceki günler', 'Les jours précédents', 'I giorni precedenti', 'Os dias anteriores')} ›</Link>
            </div>
          </div>

          <div className="rb-p rb-p-month">
            <MyMonth day={day} lang={lang} />
            {!data ? down : data.month.rows.length ? (
              <ol className="rt-lb rt-lb-m rb-lb">
                {data.month.rows.slice(0, 50).map((r, i) => (
                  <li key={r.k} className={i === 0 ? 'first' : i < 3 ? 'pod' : ''}>
                    <span className="rt-n">{i + 1}</span>
                    <span className="rt-mw"><Who fl={r.fl} name={r.name || noName} lang={lang} /><small>{t(`${r.days} ${r.days === 1 ? 'day' : 'days'}`, `${r.days} ${ruPlural(r.days, ['день', 'дня', 'дней'])}`, `${r.days} ${r.days === 1 ? 'día' : 'días'}`, `${r.days} ${r.days === 1 ? 'Tag' : 'Tage'}`, `${r.days} gün`, `${r.days} ${r.days === 1 ? 'jour' : 'jours'}`, `${r.days} ${r.days === 1 ? 'giorno' : 'giorni'}`, `${r.days} ${r.days === 1 ? 'dia' : 'dias'}`)}</small></span>
                    <span className="rt-p"><b><CountUp v={String(r.pts)} /></b><small>{ptsOf(t, r.pts).replace(/^\d+\s*/, '')}</small></span>
                  </li>
                ))}
              </ol>
            ) : <p className="rb-none">{t('No points yet this month.', 'В этом месяце очков ещё нет.', 'Aún no hay puntos este mes.', 'Noch keine Punkte in diesem Monat.', 'Bu ay henüz puan yok.', 'Pas encore de points ce mois-ci.', 'Ancora nessun punto questo mese.', 'Nenhum ponto este mês ainda.')}</p>}
            <div className="rb-how">
              <span className="lbl-ink">{t('How the points work', 'Как считаются очки', 'Cómo funcionan los puntos', 'So funktionieren die Punkte', 'Puanlar nasıl çalışır', 'Comment marchent les points', 'Come funzionano i punti', 'Como funcionam os pontos')}</span>
              <p>{howPoints(t)}</p>
              <Link className="rb-link" href="/help/race">{t('How today’s race works', 'Как устроена гонка дня', 'Cómo funciona la regata del día', 'So funktioniert die Regatta des Tages', 'Günün yarışı nasıl işler', 'Comment marche la régate du jour', 'Come funziona la regata del giorno', 'Como funciona a regata do dia')} ›</Link>
            </div>
          </div>

          <div className="rb-p rb-p-duel">
            {!duel ? down : duel.rows.length ? (
              <ol className="rt-lb rb-lb rb-duel">
                {duel.rows.map((r, i) => {
                  const settled = !provisional(r.races);
                  return (
                    <li key={i} className={settled && i === 0 ? 'first' : settled && i < 3 ? 'pod' : ''}>
                      <span className="rt-n">{settled ? i + 1 : '~'}</span>
                      <span className="rt-mw"><span className="rb-name">{r.name || noName}</span><small>{settled ? levelName(r.rating, lang) : t('provisional', 'предварительный', 'provisional', 'vorläufig', 'geçici', 'provisoire', 'provvisorio', 'provisório')} · {r.wins}–{r.losses}</small></span>
                      <span className="rt-p"><b>{shown(r.rating, r.races)}</b></span>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="rb-none">{t('No 1-on-1 ratings yet. A rating starts at 1500 and settles after five rated races, against sailors at your level.', 'Рейтингов 1 на 1 пока нет. Рейтинг начинается с 1500 и устанавливается после пяти рейтинговых гонок с соперниками твоего уровня.', 'Aún no hay ratings 1 contra 1. Un rating empieza en 1500 y se asienta tras cinco regatas con rating, contra regatistas de tu nivel.', 'Noch keine 1-gegen-1-Wertungen. Eine Wertung beginnt bei 1500 und steht nach fünf gewerteten Regatten gegen Segler deines Niveaus.', 'Henüz bire bir reyting yok. Reyting 1500’den başlar ve seviyendeki denizcilerle beş reytingli yarıştan sonra oturur.', 'Pas encore de classement en duel. Il part de 1500 et se stabilise après cinq régates classées contre des marins de ton niveau.', 'Ancora nessun rating 1 contro 1. Un rating parte da 1500 e si stabilizza dopo cinque regate valide contro velisti del tuo livello.', 'Ainda não há ratings 1 contra 1. Um rating começa em 1500 e se firma depois de cinco regatas valendo rating, contra velejadores do seu nível.')}</p>}
            {duel && duel.rows.length > 0 && <p className="rb-note">{t(`${duel.settled} settled · ${duel.provisional} still on their first five rated races (~). Only races against one other sailor count here.`, `Устоявшихся: ${duel.settled} · ещё в первых пяти рейтинговых гонках (~): ${duel.provisional}. Здесь считаются только гонки один на один.`, `${duel.settled} asentados · ${duel.provisional} aún en sus cinco primeras regatas con rating (~). Aquí solo cuentan las regatas contra otro regatista.`, `${duel.settled} feste · ${duel.provisional} noch in den ersten fünf gewerteten Regatten (~). Hier zählen nur Regatten gegen einen anderen Segler.`, `${duel.settled} oturmuş · ${duel.provisional} hâlâ ilk beş reytingli yarışında (~). Burada yalnızca bire bir yarışlar sayılır.`, `${duel.settled} stabilisés · ${duel.provisional} encore dans leurs cinq premières régates classées (~). Seuls les duels comptent ici.`, `${duel.settled} stabili · ${duel.provisional} ancora nelle prime cinque regate valide (~). Qui contano solo le regate contro un altro velista.`, `${duel.settled} firmes · ${duel.provisional} ainda nas cinco primeiras regatas com rating (~). Aqui só contam regatas contra outro velejador.`)}</p>}
            <div className="rb-acts">
              <Link className="rt-go" href="/duel"><IconPlay /><span>{t('Find a 1-on-1 race', 'Найти гонку 1 на 1', 'Buscar una regata 1 contra 1', 'Eine 1-gegen-1-Regatta finden', 'Bire bir yarış bul', 'Trouver un duel', 'Trova una regata 1 contro 1', 'Encontrar um duelo 1 contra 1')}</span></Link>
            </div>
          </div>
        </div>
        <p className="rb-foot">{t('Three boards, none moving another: today ranks best times, the month adds up points, and the 1-on-1 rating counts only races against one other sailor.', 'Три рейтинга, не влияющих друг на друга: сегодня — лучшие времена, за месяц — сумма очков, рейтинг 1 на 1 — только гонки один на один.', 'Tres clasificaciones que no se afectan: hoy ordena los mejores tiempos, el mes suma puntos y el rating 1 contra 1 solo cuenta regatas contra otro regatista.', 'Drei Ranglisten, keine bewegt die andere: heute zählen die besten Zeiten, der Monat addiert Punkte, und die 1-gegen-1-Wertung zählt nur Regatten gegen einen anderen Segler.', 'Birbirini etkilemeyen üç sıralama: bugün en iyi süreleri sıralar, ay puanları toplar, bire bir reyting yalnızca bire bir yarışları sayar.', 'Trois classements indépendants : aujourd’hui range les meilleurs temps, le mois additionne les points, et le classement en duel ne compte que les duels.', 'Tre classifiche indipendenti: oggi ordina i tempi migliori, il mese somma i punti e il rating 1 contro 1 conta solo le regate contro un altro velista.', 'Três classificações independentes: hoje ordena os melhores tempos, o mês soma pontos e o rating 1 contra 1 só conta regatas contra outro velejador.')}</p>
      </div>
    </section>
  );
}
