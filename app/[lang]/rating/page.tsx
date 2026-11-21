import Link from 'next/link';
import { getT, titled, type LangParams } from '@/lib/i18n';
import { LOCALE, pick } from '@/lib/lang';
import { dailyRace } from '@/lib/race';
import { venueOf } from '@/lib/venues';
import { getRating } from '@/lib/rating';
import { getDuelBoard } from '@/lib/duel-board';
import { SiteHead, SiteFoot } from '@/components/site-chrome';
import { DayBoard, MonthBoard, DuelList } from '@/components/race-board';
import { MyDuelLine } from '@/components/my-duel-line';
import '@/styles/race-board.css';
import '@/styles/rating-both.css';

// The site's two ratings, side by side and kept apart (the header's and the footer's Leaderboard): the 1-on-1 rating
// (#duel: Elo, moved only by races against one other sailor; settled ratings first, then provisional ones, and your own
// line) and today's race (#race: today's best times and the points they took, and the month's points added up, as tabs).
// Neither moves the other. Built for everyone alike every five minutes, as the race hub is; your own line is the browser's.
export const revalidate = 300;

export const generateMetadata = titled('Leaderboards: the 1-on-1 rating and today’s race', 'Рейтинги: рейтинг 1 на 1 и гонка дня', 'Clasificaciones: el rating 1 contra 1 y la regata del día', 'Ranglisten: die 1-gegen-1-Wertung und die Regatta des Tages', 'Sıralamalar: bire bir reyting ve günün yarışı', 'Classements : le classement en duel et la régate du jour', 'Classifiche: il rating 1 contro 1 e la regata del giorno', 'Classificações: o rating 1 contra 1 e a regata do dia', {
  path: '/rating',
  description: [
    'Two leaderboards that never move each other: the 1-on-1 rating, an Elo rating moved only by races against one other sailor, and today’s race, ranked by the day’s best times and added up in points over the month.',
    'Два рейтинга, которые не влияют друг на друга: рейтинг 1 на 1 — рейтинг Эло, который меняют только гонки один на один, и гонка дня — лучшие времена дня и сумма очков за месяц.',
    'Dos clasificaciones que nunca se mueven entre sí: el rating 1 contra 1, un rating Elo que solo mueven las regatas contra otro regatista, y la regata del día, ordenada por los mejores tiempos del día y sumada en puntos durante el mes.',
    'Zwei Ranglisten, die sich nie gegenseitig bewegen: die 1-gegen-1-Wertung, eine Elo-Wertung, die nur Regatten gegen einen anderen Segler bewegen, und die Regatta des Tages, geordnet nach den besten Zeiten des Tages und über den Monat in Punkten addiert.',
    'Birbirini hiç etkilemeyen iki sıralama: yalnızca bir rakibe karşı yarışlarla değişen bir Elo reytingi olan bire bir reyting ve günün en iyi sürelerine göre sıralanıp ay boyunca puanla toplanan günün yarışı.',
    'Deux classements qui ne se font jamais bouger : le classement en duel, un classement Elo que seules font bouger les régates contre un autre marin, et la régate du jour, classée par les meilleurs temps du jour et additionnée en points sur le mois.',
    'Due classifiche che non si muovono mai a vicenda: il rating 1 contro 1, un rating Elo mosso solo dalle regate contro un altro velista, e la regata del giorno, ordinata per i tempi migliori del giorno e sommata in punti nel mese.',
    'Duas classificações que nunca mexem uma na outra: o rating 1 contra 1, um rating Elo movido só por regatas contra outro velejador, e a regata do dia, ordenada pelos melhores tempos do dia e somada em pontos ao longo do mês.',
  ],
});

export default async function Ratings({ params }: LangParams) {
  const { lang, t } = await getT(params);
  const d = dailyRace();
  const [rating, duel] = await Promise.all([getRating(d.day), getDuelBoard()]);
  const data = rating && rating.d === d.day ? rating : null;
  const loc = LOCALE[lang], at = new Date(d.day + 'T12:00:00Z');
  const date = at.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const month = at.toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' });
  const tab = (id: string, label: string, on = false) => (
    <><input type="radio" name="rb-tab" id={`rb-t-${id}`} className="rb-radio" defaultChecked={on} /><label htmlFor={`rb-t-${id}`} className="rb-tab">{label}</label></>
  );
  return (
    <div className="scr help hp bc rtg" lang={lang}>
      <SiteHead lang={lang} t={t} page="rating" />
      <header className="hm-page hm-ph rtg-head">
        <span className="kicker">{t('Leaderboards', 'Рейтинги', 'Clasificaciones', 'Ranglisten', 'Sıralamalar', 'Classements', 'Classifiche', 'Classificações')}</span>
        <h1 className="hm-ph-h">{t('Two ratings, kept apart', 'Два рейтинга, каждый сам по себе', 'Dos ratings, cada uno por su lado', 'Zwei Wertungen, getrennt geführt', 'İki reyting, ayrı ayrı', 'Deux classements, chacun le sien', 'Due rating, separati', 'Dois ratings, cada um por si')}</h1>
        <p className="lead">{t('The 1-on-1 rating moves only with races against one other sailor. Today’s race ranks the day’s best times, and its points add up over the month. Neither moves the other.', 'Рейтинг 1 на 1 меняют только гонки один на один. Гонка дня ранжирует лучшие времена дня, а её очки складываются за месяц. Одно на другое не влияет.', 'El rating 1 contra 1 solo se mueve con regatas contra otro regatista. La regata del día ordena los mejores tiempos del día, y sus puntos se suman en el mes. Uno no mueve al otro.', 'Die 1-gegen-1-Wertung bewegen nur Regatten gegen einen anderen Segler. Die Regatta des Tages ordnet die besten Zeiten des Tages, ihre Punkte summieren sich über den Monat. Keins bewegt das andere.', 'Bire bir reyting yalnızca bir rakibe karşı yarışlarla değişir. Günün yarışı günün en iyi sürelerini sıralar, puanları ay boyunca toplanır. Biri diğerini etkilemez.', 'Le classement en duel ne bouge qu’avec des régates contre un autre marin. La régate du jour classe les meilleurs temps du jour, et ses points s’additionnent sur le mois. L’un ne fait pas bouger l’autre.', 'Il rating 1 contro 1 si muove solo con le regate contro un altro velista. La regata del giorno ordina i tempi migliori del giorno, e i suoi punti si sommano nel mese. Uno non muove l’altro.', 'O rating 1 contra 1 só se move com regatas contra outro velejador. A regata do dia ordena os melhores tempos do dia, e seus pontos somam no mês. Um não mexe no outro.')}</p>
        <nav className="rtg-jump" aria-label={t('The two ratings', 'Два рейтинга', 'Los dos ratings', 'Die zwei Wertungen', 'İki reyting', 'Les deux classements', 'I due rating', 'Os dois ratings')}>
          <a href="#duel">{t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1')}</a>
          <a href="#race">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')}</a>
        </nav>
      </header>
      <div className="hm-page rtg-cols">
        <section id="duel" className="rtg-col rtg-duel" aria-labelledby="rtg-duel-h">
          <span className="kicker">{t('1-on-1 rating · Elo', 'Рейтинг 1 на 1 · Эло', 'Rating 1 contra 1 · Elo', '1-gegen-1-Wertung · Elo', 'Bire bir reyting · Elo', 'Classement en duel · Elo', 'Rating 1 contro 1 · Elo', 'Rating 1 contra 1 · Elo')}</span>
          <h2 className="rtg-h" id="rtg-duel-h">{t('Who wins head to head', 'Кто сильнее один на один', 'Quién gana cara a cara', 'Wer im Duell gewinnt', 'Kafa kafaya kim kazanır', 'Qui gagne en face à face', 'Chi vince testa a testa', 'Quem vence frente a frente')}</h2>
          <p className="rtg-p">{t('Everyone starts at 1500. A win takes points from the other sailor, more from someone rated higher; the first five rated races count double and are marked ~.', 'У всех старт с 1500. Победа забирает очки у соперника, больше — у того, кто выше; первые пять рейтинговых гонок считаются вдвойне и отмечены ~.', 'Todos empiezan en 1500. Ganar quita puntos al otro regatista, más si tiene más rating; las cinco primeras regatas con rating cuentan doble y se marcan con ~.', 'Alle beginnen bei 1500. Ein Sieg nimmt dem anderen Segler Punkte ab, mehr, wenn er höher steht; die ersten fünf gewerteten Regatten zählen doppelt und sind mit ~ markiert.', 'Herkes 1500 ile başlar. Galibiyet rakipten puan alır, daha yüksek reytinglisinden daha fazla; ilk beş reytingli yarış çift sayılır ve ~ ile işaretlenir.', 'Tout le monde part de 1500. Une victoire prend des points à l’autre marin, davantage s’il est mieux classé ; les cinq premières régates classées comptent double et sont marquées ~.', 'Tutti partono da 1500. Una vittoria toglie punti all’altro velista, di più se ha un rating più alto; le prime cinque regate valide contano doppio e sono segnate con ~.', 'Todos começam em 1500. Vencer tira pontos do outro velejador, mais se o rating dele for maior; as cinco primeiras regatas valendo rating contam em dobro e levam ~.')}</p>
          <MyDuelLine lang={lang} />
          <DuelList lang={lang} t={t} duel={duel} />
        </section>
        <section id="race" className="rtg-col rtg-race" aria-labelledby="rtg-race-h">
          <span className="kicker">{t('Today’s race · points', 'Гонка дня · очки', 'La regata del día · puntos', 'Regatta des Tages · Punkte', 'Günün yarışı · puanlar', 'La régate du jour · points', 'La regata del giorno · punti', 'A regata do dia · pontos')}</span>
          <h2 className="rtg-h" id="rtg-race-h">{date} · {pick(venueOf(d.venue).name, lang)}</h2>
          <p className="rtg-p">{t('Everyone sails the same race today; your best time counts. Points are the sailors that day minus your place plus one, and they add up over the month.', 'Сегодня у всех одна и та же гонка; засчитывается твоё лучшее время. Очки — число гонщиков за день минус твоё место плюс один, и за месяц они складываются.', 'Hoy todos navegan la misma regata; cuenta tu mejor tiempo. Los puntos son los regatistas del día menos tu puesto más uno, y se suman en el mes.', 'Heute segeln alle dieselbe Regatta; deine beste Zeit zählt. Punkte sind die Segler des Tages minus dein Platz plus eins, und sie summieren sich über den Monat.', 'Bugün herkes aynı yarışı yapar; en iyi süren sayılır. Puan, o günkü denizci sayısı eksi sıran artı birdir ve ay boyunca toplanır.', 'Aujourd’hui tout le monde court la même régate ; ton meilleur temps compte. Les points valent le nombre de marins du jour moins ta place plus un, et s’additionnent sur le mois.', 'Oggi tutti corrono la stessa regata; conta il tuo tempo migliore. I punti sono i velisti del giorno meno la tua posizione più uno, e si sommano nel mese.', 'Hoje todos correm a mesma regata; vale o seu melhor tempo. Os pontos são os velejadores do dia menos a sua posição mais um, e somam no mês.')}</p>
          <div className="rb-tabs">
            {tab('day', t('Today', 'Сегодня', 'Hoy', 'Heute', 'Bugün', 'Aujourd’hui', 'Oggi', 'Hoje'), true)}
            {tab('month', month.charAt(0).toLocaleUpperCase(loc) + month.slice(1))}
            <div className="rb-p rb-p-day"><DayBoard lang={lang} t={t} day={d.day} data={data} /></div>
            <div className="rb-p rb-p-month"><MonthBoard lang={lang} t={t} day={d.day} data={data} /></div>
          </div>
        </section>
      </div>
      <p className="hm-page rtg-foot"><Link className="rb-link" href="/help/duel#h-rating">{t('How the 1-on-1 rating works', 'Как устроен рейтинг 1 на 1', 'Cómo funciona el rating 1 contra 1', 'So funktioniert die 1-gegen-1-Wertung', 'Bire bir reyting nasıl işler', 'Comment marche le classement en duel', 'Come funziona il rating 1 contro 1', 'Como funciona o rating 1 contra 1')} ›</Link> <Link className="rb-link" href="/help/race">{t('How today’s race works', 'Как устроена гонка дня', 'Cómo funciona la regata del día', 'So funktioniert die Regatta des Tages', 'Günün yarışı nasıl işler', 'Comment marche la régate du jour', 'Come funziona la regata del giorno', 'Como funciona a regata do dia')} ›</Link></p>
      <SiteFoot lang={lang} t={t} back="/rating" />
    </div>
  );
}
