import Link from 'next/link';
import { LOCALE, pick, ruPlural, tx, type Lang } from '@/lib/lang';
import { clock } from '@/lib/clock';
import { dailyRace } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import { lastDay, monthName, ordinal, type PlayerMonth } from '@/lib/player-month';
import { ptsOf } from './rating-view';
import { Who } from './flag';
import { IconPlay } from './ui';

// Your month, day by day (release 6c of the 1-on-1 plan; app/[lang]/race/month): the month's points and your place on
// its table; a bar for each day of the month, its points; every day you sailed, where and in what, your time, your
// place of how many and the points it took, added up to the month's total (the board's own: lib/player-month.ts); the
// table around you; and how far the next place up is. Built on the server, no script.
const day1 = (d: string) => new Date(`${d}T12:00:00Z`);
export function RaceMonth({ lang, data, today, own, name, nav }: { lang: Lang; data: PlayerMonth; today: string; own: boolean; name: string | null; nav?: React.ReactNode }) {
  const t = tx(lang), loc = LOCALE[lang], m = data.m, mon = monthName(m, lang), end = lastDay(m), now = m === today.slice(0, 7);
  const ord = (n: number) => ordinal(n, lang), pts = (k: number) => ptsOf(t, k);
  const by = new Map(data.days.map((x) => [x.d, x]));
  const all: string[] = []; for (let i = 1; i <= +end.slice(8); i++) all.push(`${m}-${String(i).padStart(2, '0')}`);
  const sofar = now ? +today.slice(8) : all.length, max = Math.max(1, ...data.days.map((x) => x.pts));
  // the best day: the most of the field beaten (first: all of it), then the most points
  const share = (x: { place: number; of: number }) => (x.of <= 1 ? 1 : (x.of - x.place) / (x.of - 1));
  const best = data.days.length ? data.days.reduce((a, b) => (share(b) > share(a) || (share(b) === share(a) && b.pts > a.pts) ? b : a)) : null;
  const ofN = (p: number, n: number) => t(`${ord(p)} of ${n}`, `${p}-е из ${n}`, `${ord(p)} de ${n}`, `${ord(p)} von ${n}`, `${n} içinde ${ord(p)}`, `${ord(p)} sur ${n}`, `${ord(p)} su ${n}`, `${ord(p)} de ${n}`);
  const where = (d: string) => { const r = dailyRace(day1(d)); return { v: pick(venueOf(r.venue).name, lang), y: pick(yachtOf(r.yacht).name, lang) }; };
  const dateS = (d: string) => day1(d).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const todayRow = now ? by.get(today) : undefined;
  const stat = (k: string, v: string, sub?: string, gold = false) => (
    <div className="rm-stat"><span className="lbl">{k}</span><b className={gold ? 'is-gold' : undefined}>{v}</b>{sub ? <small>{sub}</small> : null}</div>
  );
  const kick = own ? t(`Your month · ${mon}`, `Твой месяц · ${mon}`, `Tu mes · ${mon}`, `Dein Monat · ${mon}`, `Senin ayın · ${mon}`, `Ton mois · ${mon}`, `Il tuo mese · ${mon}`, `Seu mês · ${mon}`)
    : `${name || t('A sailor', 'Гонщик', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador')} · ${mon}`;
  const sailedOf = t(`${data.days.length} of ${sofar} days sailed`, `${data.days.length} из ${sofar} ${ruPlural(sofar, ['дня', 'дней', 'дней'])} в гонке`, `${data.days.length} de ${sofar} días navegados`, `${data.days.length} von ${sofar} Tagen gesegelt`, `${sofar} günün ${data.days.length} günü yarıştı`, `${data.days.length} jours courus sur ${sofar}`, `${data.days.length} giorni corsi su ${sofar}`, `${data.days.length} de ${sofar} dias velejados`);

  return (
    <>
      <header className="hm-page hm-ph rm-head">
        <span className="kicker">{kick}</span>
        <h1 className="hm-ph-h rm-total"><b>{data.pts}</b> <span>{pts(data.pts).replace(/^\d+\s*/, '')}</span></h1>
        <p className="rm-line">
          {data.place ? <b>{t(`${ord(data.place)} of ${data.of} in ${mon}`, `${data.place}-е из ${data.of} в месяце`, `${ord(data.place)} de ${data.of} en ${mon.toLowerCase()}`, `${ord(data.place)} von ${data.of} im ${mon}`, `${mon} ayında ${data.of} içinde ${ord(data.place)}`, `${ord(data.place)} sur ${data.of} en ${mon.toLowerCase()}`, `${ord(data.place)} su ${data.of} a ${mon.toLowerCase()}`, `${ord(data.place)} de ${data.of} em ${mon.toLowerCase()}`)}</b> : null}
          {todayRow ? <span className="rm-up">{t(`+${todayRow.pts} today`, `+${todayRow.pts} сегодня`, `+${todayRow.pts} hoy`, `+${todayRow.pts} heute`, `bugün +${todayRow.pts}`, `+${todayRow.pts} aujourd’hui`, `+${todayRow.pts} oggi`, `+${todayRow.pts} hoje`)}</span> : null}
          <span>{sailedOf}</span>
        </p>
        {data.days.length ? (
          <div className="rm-stats">
            {best ? stat(t('Best day', 'Лучший день', 'Mejor día', 'Bester Tag', 'En iyi gün', 'Meilleur jour', 'Giorno migliore', 'Melhor dia'), ofN(best.place, best.of), `${dateS(best.d)} · ${where(best.d).v} · ${pts(best.pts)}`, best.place === 1) : null}
            {stat(t('Wins', 'Победы', 'Victorias', 'Siege', 'Galibiyet', 'Victoires', 'Vittorie', 'Vitórias'), String(data.wins), undefined, data.wins > 0)}
            {stat(t('Podiums', 'Подиумы', 'Podios', 'Podien', 'Podyum', 'Podiums', 'Podi', 'Pódios'), String(data.podiums))}
          </div>
        ) : null}
      </header>
      {nav}

      <div className="hm-page rm-main">
        {data.days.length ? (
          <>
            <section className="rm-sec" aria-labelledby="rm-chart-h">
              <h2 className="rm-h" id="rm-chart-h">{t(`${mon}, day by day`, `${mon} по дням`, `${mon}, día a día`, `${mon}, Tag für Tag`, `Gün gün ${mon}`, `${mon}, jour par jour`, `${mon}, giorno per giorno`, `${mon}, dia a dia`)}</h2>
              {/* a bar a day, as tall as its points against the month's best day; a podium gold, today ringed, days to come empty */}
              <ol className="rm-bars" style={{ ['--n' as string]: all.length }}>
                {all.map((d) => {
                  const x = by.get(d), cls = `${x ? ' has' : ''}${x && x.place <= 3 ? ' pod' : ''}${now && d === today ? ' on' : ''}${now && d > today ? ' later' : ''}`;
                  return (
                    <li key={d} className={`rm-bar${cls}`} style={x ? { ['--h' as string]: (x.pts / max).toFixed(3) } : undefined}>
                      <span className="rm-bar-v">{x ? x.pts : ''}</span>
                      <i aria-hidden="true" />
                      <small>{+d.slice(8)}</small>
                      <span className="vh">{x ? `${dateS(d)}: ${ofN(x.place, x.of)}, ${pts(x.pts)}` : `${dateS(d)}: —`}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rm-sec" aria-labelledby="rm-days-h">
              <h2 className="rm-h" id="rm-days-h">{own ? t('Every day you sailed', 'Каждый твой день', 'Cada día que navegaste', 'Jeder Tag, den du gesegelt bist', 'Yarıştığın her gün', 'Chaque jour couru', 'Ogni giorno in regata', 'Cada dia que você velejou') : t('Every day sailed', 'Каждый день в гонке', 'Cada día navegado', 'Jeder gesegelte Tag', 'Yarışılan her gün', 'Chaque jour couru', 'Ogni giorno in regata', 'Cada dia velejado')}</h2>
              <div className="rm-scroll">
                <table className="rh-table rm-table">
                  <thead><tr>
                    <th scope="col">{t('Day', 'День', 'Día', 'Tag', 'Gün', 'Jour', 'Giorno', 'Dia')}</th>
                    <th scope="col">{t('Venue · yacht', 'Акватория · яхта', 'Sede · yate', 'Revier · Yacht', 'Alan · yat', 'Plan d’eau · yacht', 'Campo · yacht', 'Raia · veleiro')}</th>
                    <th scope="col">{t('Time', 'Время', 'Tiempo', 'Zeit', 'Süre', 'Temps', 'Tempo', 'Tempo')}</th>
                    <th scope="col">{t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Posição')}</th>
                    <th scope="col" className="n">{t('Points', 'Очки', 'Puntos', 'Punkte', 'Puan', 'Points', 'Punti', 'Pontos')}</th>
                  </tr></thead>
                  <tbody>
                    {data.days.map((x) => { const w = where(x.d); return (
                      <tr key={x.d} className={x.place === 1 ? 'win' : x.place <= 3 ? 'pod' : undefined}>
                        <td>{dateS(x.d)}</td>
                        <td>{w.v}<small>{w.y}</small></td>
                        <td>{clock(x.s)}</td>
                        <td>{ofN(x.place, x.of)}<small>{t(`${x.of} ranked − ${x.place} + 1`, `${x.of} в рейтинге − ${x.place} + 1`, `${x.of} clasificados − ${x.place} + 1`, `${x.of} gerankt − ${x.place} + 1`, `${x.of} sıralanan − ${x.place} + 1`, `${x.of} classés − ${x.place} + 1`, `${x.of} in classifica − ${x.place} + 1`, `${x.of} classificados − ${x.place} + 1`)}</small></td>
                        <td className="n">{x.pts}</td>
                      </tr>
                    ); })}
                  </tbody>
                  <tfoot><tr>
                    <th scope="row" colSpan={4}>{now ? t(`${mon} so far`, `${mon} на сегодня`, `${mon} hasta hoy`, `${mon} bis jetzt`, `Şimdiye kadar ${mon}`, `${mon} jusqu’ici`, `${mon} finora`, `${mon} até agora`) : t(`${mon} in all`, `${mon} всего`, `${mon} en total`, `${mon} insgesamt`, `${mon} toplam`, `${mon} au total`, `${mon} in tutto`, `${mon} no total`)}</th>
                    <td className="n">{data.pts}</td>
                  </tr></tfoot>
                </table>
              </div>
            </section>

            {data.near.length ? (
              <section className="rm-sec" aria-labelledby="rm-near-h">
                <h2 className="rm-h" id="rm-near-h">{own ? t('The month, near you', 'Месяц рядом с тобой', 'El mes, cerca de ti', 'Der Monat um dich herum', 'Ayın tablosunda yanındakiler', 'Le mois, autour de toi', 'Il mese, vicino a te', 'O mês, perto de você') : t('The month, around them', 'Месяц рядом', 'El mes, alrededor', 'Der Monat drumherum', 'Ayın tablosunda yanındakiler', 'Le mois, autour', 'Il mese, intorno', 'O mês, ao redor')}</h2>
                <ol className="rt-lb rt-lb-m rm-near">
                  {data.near.map((r) => (
                    <li key={r.k} className={[r.place === 1 ? 'first' : r.place <= 3 ? 'pod' : '', r.me ? 'me' : ''].filter(Boolean).join(' ') || undefined} aria-current={r.me ? 'true' : undefined}>
                      <span className="rt-n">{r.place}</span>
                      <span className="rt-mw"><Who fl={r.fl} name={r.name || t('A sailor', 'Гонщик', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador')} lang={lang} /></span>
                      <span className="rt-p"><b>{r.pts}</b><small>{pts(r.pts).replace(/^\d+\s*/, '')}</small></span>
                    </li>
                  ))}
                </ol>
                <Link className="rb-link" href="/race#board">{t('The whole month', 'Весь месяц', 'Todo el mes', 'Der ganze Monat', 'Ayın tamamı', 'Tout le mois', 'Tutto il mese', 'O mês inteiro')} ›</Link>
              </section>
            ) : null}
          </>
        ) : (
          <section className="rm-sec">
            <p className="lead">{now ? t('No points this month yet. Finish today’s race signed in and the day shows here, with its points.', 'В этом месяце очков пока нет. Пройди гонку дня, войдя в аккаунт, — и день появится здесь с его очками.', 'Aún no hay puntos este mes. Termina la regata del día con tu cuenta y el día aparecerá aquí, con sus puntos.', 'Noch keine Punkte in diesem Monat. Beende die Regatta des Tages angemeldet, dann steht der Tag hier, mit seinen Punkten.', 'Bu ay henüz puan yok. Günün yarışını giriş yapmış olarak bitir, gün puanlarıyla burada görünür.', 'Pas encore de points ce mois-ci. Termine la régate du jour connecté et la journée s’affiche ici, avec ses points.', 'Ancora nessun punto questo mese. Finisci la regata del giorno con l’accesso fatto e il giorno appare qui, con i suoi punti.', 'Nenhum ponto este mês ainda. Termine a regata do dia com sua conta e o dia aparece aqui, com os pontos.') : t(`No points in ${mon}.`, 'В этом месяце очков нет.', `Sin puntos en ${mon.toLowerCase()}.`, `Keine Punkte im ${mon}.`, `${mon} ayında puan yok.`, `Pas de points en ${mon.toLowerCase()}.`, `Nessun punto a ${mon.toLowerCase()}.`, `Nenhum ponto em ${mon.toLowerCase()}.`)}</p>
          </section>
        )}

        {now && own ? <RaceNext lang={lang} data={data} today={today} /> : null}
      </div>
    </>
  );
}

// what's next: the points to the next place up (more than theirs, so the place is yours), today's race, tomorrow's venue
function RaceNext({ lang, data, today }: { lang: Lang; data: PlayerMonth; today: string }) {
  const t = tx(lang), ord = (n: number) => ordinal(n, lang);
  const need = data.above ? data.above.pts - data.pts + 1 : 0, next = dailyRace(new Date(Date.parse(`${today}T12:00:00Z`) + 864e5));
  const head = data.place === 1 ? t('You lead the month', 'Ты ведёшь месяц', 'Lideras el mes', 'Du führst den Monat an', 'Ayın lideri sensin', 'Tu mènes le mois', 'Guidi il mese', 'Você lidera o mês')
    : data.above ? t(`To ${ord(data.above.place)}: ${ptsOf(t, need)}`, `До ${data.above.place}-го места: ${ptsOf(t, need)}`, `Al ${ord(data.above.place)}: ${ptsOf(t, need)}`, `Bis Platz ${data.above.place}: ${ptsOf(t, need)}`, `${ord(data.above.place)} sıraya: ${ptsOf(t, need)}`, `Jusqu’à la ${ord(data.above.place)} place : ${ptsOf(t, need)}`, `Al ${ord(data.above.place)} posto: ${ptsOf(t, need)}`, `Até o ${ord(data.above.place)} lugar: ${ptsOf(t, need)}`)
    : t('Your first points', 'Твои первые очки', 'Tus primeros puntos', 'Deine ersten Punkte', 'İlk puanların', 'Tes premiers points', 'I tuoi primi punti', 'Seus primeiros pontos');
  return (
    <section className="rm-sec rm-next" aria-labelledby="rm-next-h">
      <h2 className="rm-h" id="rm-next-h">{head}</h2>
      <p className="lead">{t('Every sailor you finish ahead of today is a point, and so is finishing. Your best time of the day is the one that counts: sail it again to better it.', 'Каждый гонщик, которого ты сегодня обойдёшь, — очко, и сам финиш — тоже. Засчитывается лучшее время дня: пройди ещё раз, чтобы его улучшить.', 'Cada regatista al que terminas por delante hoy es un punto, y terminar también. Cuenta tu mejor tiempo del día: navégala otra vez para mejorarlo.', 'Jeder Segler, vor dem du heute ins Ziel kommst, ist ein Punkt, und das Ankommen auch. Es zählt deine beste Zeit des Tages: segle noch einmal, um sie zu verbessern.', 'Bugün önünde bitirdiğin her denizci bir puan, bitirmek de öyle. Günün en iyi süren sayılır: geliştirmek için yeniden yarış.', 'Chaque régatier que tu devances aujourd’hui vaut un point, et finir aussi. Ton meilleur temps du jour compte : recours pour l’améliorer.', 'Ogni velista che oggi arriva dietro di te è un punto, e anche arrivare. Conta il tuo tempo migliore del giorno: corri di nuovo per migliorarlo.', 'Cada velejador que você termina à frente hoje é um ponto, e terminar também. Vale seu melhor tempo do dia: veleje de novo para melhorá-lo.')}</p>
      <div className="rb-acts">
        <a className="rt-go" href="/play?race=today"><IconPlay /><span>{t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia')}</span></a>
        <span className="rm-tom">{t('Tomorrow', 'Завтра', 'Mañana', 'Morgen', 'Yarın', 'Demain', 'Domani', 'Amanhã')}: <b>{pick(venueOf(next.venue).name, lang)}</b> · {pick(yachtOf(next.yacht).name, lang)}</span>
      </div>
    </section>
  );
}
