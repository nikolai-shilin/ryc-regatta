import Link from 'next/link';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { LEVELS, levelName, levelOf, nextLevel } from '@/lib/levels';
import { provisional, shown, signed as sgn, PROVISIONAL, START } from '@/lib/elo';
import { bands, whyMoved, type Change, type RatingPage } from '@/lib/rating-page';
import { venueOf } from '@/lib/venues';
import { IconPlay } from './ui';

// The 1-on-1 rating's own page (release 7b of the 1-on-1 plan; app/[lang]/duel/rating): the rating with its level, the
// day's change, the record and the place; every rated race as a line, the first five shaded; the seven levels and how
// many hold each; the spread of all settled sailors with you in it; the record against stronger, level and weaker
// sailors; and why each of the last five races moved it as far as it did (lib/rating-page.ts). Drawn on the server.
const W = 1000, H = 260, PAD = 72; // (PAD: room for the ratings on the left, drawn larger on a phone)
function Chart({ d, lang }: { d: RatingPage; lang: Lang }) {
  const t = tx(lang), pts = [START, ...d.history.map((c) => c.after)], n = pts.length;
  let lo = Math.min(...pts), hi = Math.max(...pts);
  if (hi - lo < 200) { const m = (hi + lo) / 2; lo = m - 100; hi = m + 100; }
  lo -= 20; hi += 20;
  const x = (i: number) => PAD + (n > 1 ? (i * (W - PAD - 16)) / (n - 1) : (W - PAD) / 2);
  const y = (v: number) => 12 + (H - 36) * (1 - (v - lo) / (hi - lo));
  const lines: { v: number; lvl: boolean; name: string }[] = LEVELS.filter((l) => l.min > lo && l.min < hi).map((l) => ({ v: l.min, lvl: true, name: pick(l.name, lang) }));
  for (let v = Math.ceil(lo / 100) * 100; v < hi; v += 100) if (!lines.some((l) => l.v === v)) lines.push({ v, lvl: false, name: '' });
  const firstEnd = Math.min(PROVISIONAL, n - 1), best = pts.indexOf(Math.max(...pts)), low = pts.indexOf(Math.min(...pts));
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t(`Your rating after each of your ${n - 1} rated races, from ${START} to ${pts[n - 1]}; best ${pts[best]}, lowest ${pts[low]}.`, `Твой рейтинг после каждой из ${n - 1} рейтинговых гонок: от ${START} до ${pts[n - 1]}; лучший ${pts[best]}, худший ${pts[low]}.`, `Tu rating tras cada una de tus ${n - 1} regatas con rating, de ${START} a ${pts[n - 1]}; mejor ${pts[best]}, más bajo ${pts[low]}.`, `Deine Wertung nach jeder deiner ${n - 1} gewerteten Regatten, von ${START} bis ${pts[n - 1]}; beste ${pts[best]}, tiefste ${pts[low]}.`, `${n - 1} reytingli yarışının her birinden sonra reytingin: ${START}’den ${pts[n - 1]}’e; en iyi ${pts[best]}, en düşük ${pts[low]}.`, `Ton classement après chacune de tes ${n - 1} régates classées, de ${START} à ${pts[n - 1]} ; meilleur ${pts[best]}, plus bas ${pts[low]}.`, `Il tuo rating dopo ognuna delle ${n - 1} regate con rating, da ${START} a ${pts[n - 1]}; migliore ${pts[best]}, più basso ${pts[low]}.`, `Seu rating depois de cada uma das ${n - 1} regatas com rating, de ${START} a ${pts[n - 1]}; melhor ${pts[best]}, mais baixo ${pts[low]}.`)}>
      {firstEnd > 0 && <rect className="rp-first" x={x(0)} y={6} width={x(firstEnd) - x(0)} height={H - 30} />}
      {firstEnd > 0 && <text className="rp-first-t" x={x(0) + 8} y={22}>{t('FIRST FIVE · ×2', 'ПЕРВЫЕ ПЯТЬ · ×2', 'CINCO PRIMERAS · ×2', 'ERSTE FÜNF · ×2', 'İLK BEŞ · ×2', 'CINQ PREMIÈRES · ×2', 'PRIME CINQUE · ×2', 'CINCO PRIMEIRAS · ×2')}</text>}
      {lines.map((l) => (
        <g key={l.v} className={l.lvl ? 'rp-lvl' : 'rp-grid'}>
          <line x1={PAD} x2={W - 8} y1={y(l.v)} y2={y(l.v)} />
          <text x={PAD - 6} y={y(l.v) + 4} textAnchor="end">{l.v}</text>
          {l.lvl && <text className="rp-lvl-n" x={W - 10} y={y(l.v) - 5} textAnchor="end">{l.name.toLocaleUpperCase(LOCALE[lang])}</text>}
        </g>
      ))}
      <path className="rp-line" d={path} />
      {pts.slice(1).map((v, j) => <circle key={j} className={v > pts[j] ? 'rp-up' : 'rp-down'} cx={x(j + 1)} cy={y(v)} r={n > 60 ? 2.5 : 4} />)}
      <circle className="rp-now" cx={x(n - 1)} cy={y(pts[n - 1])} r={7} />
      {n > 3 && best !== n - 1 && <text className="rp-note up" x={x(best)} y={y(pts[best]) - 12} textAnchor="middle">{t(`BEST ${pts[best]}`, `ЛУЧШИЙ ${pts[best]}`, `MEJOR ${pts[best]}`, `BESTE ${pts[best]}`, `EN İYİ ${pts[best]}`, `MEILLEUR ${pts[best]}`, `MIGLIORE ${pts[best]}`, `MELHOR ${pts[best]}`)}</text>}
      {n > 3 && low !== 0 && <text className="rp-note" x={x(low)} y={y(pts[low]) + 22} textAnchor="middle">{t(`LOWEST ${pts[low]}`, `ХУДШИЙ ${pts[low]}`, `MÁS BAJO ${pts[low]}`, `TIEFSTE ${pts[low]}`, `EN DÜŞÜK ${pts[low]}`, `PLUS BAS ${pts[low]}`, `PIÙ BASSO ${pts[low]}`, `MAIS BAIXO ${pts[low]}`)}</text>}
    </svg>
  );
}

export function RatingPageView({ d, lang }: { d: RatingPage; lang: Lang }) {
  const t = tx(lang), loc = LOCALE[lang], num = (n: number) => n.toLocaleString(loc);
  const prov = provisional(d.races), next = prov ? null : nextLevel(d.rating), lvlIdx = LEVELS.indexOf(levelOf(d.rating));
  const ahead = d.below != null && d.of > 1 ? Math.round((d.below / (d.of - 1)) * 100) : null;
  const dayS = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const stat = (k: string, v: string, sub: string, cls = '') => <div className="rm-stat"><span className="lbl">{k}</span><b className={cls || undefined}>{v}</b><small>{sub}</small></div>;
  const maxLvl = Math.max(1, ...d.levels), maxBin = Math.max(1, ...d.spread.map((s) => s.n));
  const myBin = Math.floor(d.rating / 50) * 50, last = d.history.slice(-5).reverse();
  const bandName = (k: 'above' | 'level' | 'below') => k === 'above'
    ? t('Stronger · 100 or more above', 'Сильнее · на 100 и больше выше', 'Más fuertes · 100 o más por encima', 'Stärker · 100 oder mehr darüber', 'Daha güçlü · 100 ve üzeri yukarıda', 'Plus forts · 100 ou plus au-dessus', 'Più forti · 100 o più sopra', 'Mais fortes · 100 ou mais acima')
    : k === 'level' ? t('About your level · within 100', 'Твой уровень · в пределах 100', 'De tu nivel · a menos de 100', 'Etwa dein Niveau · bis 100', 'Senin seviyende · 100 içinde', 'À ton niveau · à moins de 100', 'Al tuo livello · entro 100', 'Do seu nível · até 100')
      : t('Weaker · 100 or more below', 'Слабее · на 100 и больше ниже', 'Más flojos · 100 o más por debajo', 'Schwächer · 100 oder mehr darunter', 'Daha zayıf · 100 ve üzeri aşağıda', 'Moins forts · 100 ou plus en dessous', 'Più deboli · 100 o più sotto', 'Mais fracos · 100 ou mais abaixo');
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador');
  const result = (c: Change) => (c.won
    ? t('Won', 'Победа', 'Ganada', 'Gewonnen', 'Kazandı', 'Gagnée', 'Vinta', 'Venceu')
    : t('Lost', 'Поражение', 'Perdida', 'Verloren', 'Kaybetti', 'Perdue', 'Persa', 'Perdeu')) + (c.forfeit ? ` · ${t('forfeit', 'сдача', 'abandono', 'Aufgabe', 'hükmen', 'forfait', 'ritiro', 'desistência')}` : c.margin != null ? ` · ${c.margin.toFixed(1)} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}` : '');

  return (
    <>
      <header className="hm-page hm-ph rm-head">
        <span className="kicker">{t('Your 1-on-1 rating', 'Твой рейтинг 1 на 1', 'Tu rating 1 contra 1', 'Deine 1-gegen-1-Wertung', 'Bire bir reytingin', 'Ton classement en duel', 'Il tuo rating 1 contro 1', 'Seu rating 1 contra 1')}</span>
        <h1 className="hm-ph-h rm-total"><b>{shown(d.rating, d.races)}</b> <span>{prov ? t(`Race ${d.races} of ${PROVISIONAL}`, `Гонка ${d.races} из ${PROVISIONAL}`, `Regata ${d.races} de ${PROVISIONAL}`, `Regatta ${d.races} von ${PROVISIONAL}`, `${PROVISIONAL} yarıştan ${d.races}.`, `Régate ${d.races} sur ${PROVISIONAL}`, `Regata ${d.races} di ${PROVISIONAL}`, `Regata ${d.races} de ${PROVISIONAL}`) : levelName(d.rating, lang)}</span></h1>
        <p className="rm-line">
          {d.today ? <span className={d.today > 0 ? 'rm-up' : 'rp-dn'}>{t(`${sgn(d.today)} today`, `${sgn(d.today)} сегодня`, `${sgn(d.today)} hoy`, `${sgn(d.today)} heute`, `bugün ${sgn(d.today)}`, `${sgn(d.today)} aujourd’hui`, `${sgn(d.today)} oggi`, `${sgn(d.today)} hoje`)}</span> : null}
          <span>{t(`${d.wins} won · ${d.losses} lost`, `${d.wins} побед · ${d.losses} поражений`, `${d.wins} ganadas · ${d.losses} perdidas`, `${d.wins} gewonnen · ${d.losses} verloren`, `${d.wins} galibiyet · ${d.losses} yenilgi`, `${d.wins} gagnées · ${d.losses} perdues`, `${d.wins} vinte · ${d.losses} perse`, `${d.wins} vitórias · ${d.losses} derrotas`)}</span>
          {d.place ? <b>{t(`#${num(d.place)} of ${num(d.of)}`, `№${num(d.place)} из ${num(d.of)}`, `#${num(d.place)} de ${num(d.of)}`, `#${num(d.place)} von ${num(d.of)}`, `${num(d.of)} içinde #${num(d.place)}`, `#${num(d.place)} sur ${num(d.of)}`, `#${num(d.place)} su ${num(d.of)}`, `#${num(d.place)} de ${num(d.of)}`)}</b> : null}
        </p>
        {d.races ? (
          <div className="rm-stats rp-stats">
            {stat(t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Posição'), d.place ? `#${num(d.place)}` : '—', d.place ? t(`of ${num(d.of)} settled sailors`, `из ${num(d.of)} с устоявшимся рейтингом`, `de ${num(d.of)} con rating asentado`, `von ${num(d.of)} mit fester Wertung`, `oturmuş reytingli ${num(d.of)} denizci içinde`, `sur ${num(d.of)} au classement établi`, `su ${num(d.of)} con rating stabile`, `de ${num(d.of)} com rating firme`) : t(`after your first ${PROVISIONAL}`, `после первых ${PROVISIONAL}`, `tras tus ${PROVISIONAL} primeras`, `nach deinen ersten ${PROVISIONAL}`, `ilk ${PROVISIONAL} yarıştan sonra`, `après tes ${PROVISIONAL} premières`, `dopo le prime ${PROVISIONAL}`, `depois das ${PROVISIONAL} primeiras`))}
            {stat(t('Record', 'Счёт', 'Balance', 'Bilanz', 'Sicil', 'Bilan', 'Record', 'Retrospecto'), `${d.wins}–${d.losses}`, t(`${d.races} rated · ${Math.round((d.wins / d.races) * 100)}% won`, `${d.races} рейтинговых · ${Math.round((d.wins / d.races) * 100)}% побед`, `${d.races} con rating · ${Math.round((d.wins / d.races) * 100)}% ganadas`, `${d.races} gewertet · ${Math.round((d.wins / d.races) * 100)} % gewonnen`, `${d.races} reytingli · %${Math.round((d.wins / d.races) * 100)} galibiyet`, `${d.races} classées · ${Math.round((d.wins / d.races) * 100)} % gagnées`, `${d.races} con rating · ${Math.round((d.wins / d.races) * 100)}% vinte`, `${d.races} com rating · ${Math.round((d.wins / d.races) * 100)}% vencidas`))}
            {stat(t('Best ever', 'Лучший', 'Mejor', 'Beste', 'En iyi', 'Meilleur', 'Migliore', 'Melhor'), String(d.best), t(`lowest ${d.lowest}`, `худший ${d.lowest}`, `más bajo ${d.lowest}`, `tiefste ${d.lowest}`, `en düşük ${d.lowest}`, `plus bas ${d.lowest}`, `più basso ${d.lowest}`, `mais baixo ${d.lowest}`), 'up')}
            {next ? stat(t(`To ${levelName(next.level.min, 'en')}`, `До уровня «${levelName(next.level.min, 'ru')}»`, `Para ${levelName(next.level.min, 'es')}`, `Bis ${levelName(next.level.min, 'de')}`, `${levelName(next.level.min, 'tr')} için`, `Jusqu’à ${levelName(next.level.min, 'fr')}`, `Per ${levelName(next.level.min, 'it')}`, `Até ${levelName(next.level.min, 'pt')}`), String(next.to), t('points to the next level', 'очков до следующего уровня', 'puntos para el siguiente nivel', 'Punkte bis zur nächsten Stufe', 'sonraki seviyeye puan', 'points jusqu’au niveau suivant', 'punti al livello successivo', 'pontos até o próximo nível'), 'gold')
              : prov ? stat(t('To go', 'Осталось', 'Faltan', 'Noch', 'Kalan', 'Encore', 'Mancano', 'Faltam'), String(PROVISIONAL - d.races), t('races until your level shows', 'гонок, пока не появится уровень', 'regatas hasta que se vea tu nivel', 'Regatten, bis deine Stufe erscheint', 'seviyen görünene kadar yarış', 'régates avant que ton niveau s’affiche', 'regate prima che appaia il livello', 'regatas até seu nível aparecer'), 'gold') : null}
          </div>
        ) : null}
      </header>
      <nav className="hm-page rp-tabs" aria-label={t('Boards', 'Таблицы', 'Clasificaciones', 'Ranglisten', 'Tablolar', 'Classements', 'Classifiche', 'Classificações')}>
        <span className="rp-tab on" aria-current="page">{t('Your 1-on-1 rating', 'Твой рейтинг 1 на 1', 'Tu rating 1 contra 1', 'Deine 1-gegen-1-Wertung', 'Bire bir reytingin', 'Ton classement en duel', 'Il tuo rating 1 contro 1', 'Seu rating 1 contra 1')}</span>
        <Link className="rp-tab" href="/rating#duel">{t('Everyone’s 1-on-1 rating', 'Рейтинг 1 на 1 у всех', 'El rating 1 contra 1 de todos', 'Die 1-gegen-1-Wertung aller', 'Herkesin bire bir reytingi', 'Le classement en duel de tous', 'Il rating 1 contro 1 di tutti', 'O rating 1 contra 1 de todos')}</Link>
      </nav>

      <div className="hm-page rm-main">
        {d.history.length ? (
          <section className="rm-sec" aria-labelledby="rp-chart-h">
            <h2 className="rm-h" id="rp-chart-h">{t(`All ${d.history.length} rated races`, `Все рейтинговые гонки: ${d.history.length}`, `Tus ${d.history.length} regatas con rating`, `Alle ${d.history.length} gewerteten Regatten`, `${d.history.length} reytingli yarışın tümü`, `Tes ${d.history.length} régates classées`, `Tutte le ${d.history.length} regate con rating`, `Todas as ${d.history.length} regatas com rating`)}</h2>
            <Chart d={d} lang={lang} />
            <p className="rp-note-p">{t('A point for each rated race, green after a win and orange after a loss. In the first five, shaded, every race counted double; since then a race moves the rating by 32 × what you weren’t expected to do.', 'Точка — одна рейтинговая гонка: зелёная после победы, оранжевая после поражения. В первых пяти (затенены) каждая гонка шла вдвойне; дальше гонка меняет рейтинг на 32 × то, чего от тебя не ждали.', 'Un punto por regata con rating, verde tras ganar y naranja tras perder. En las cinco primeras, sombreadas, cada regata contó doble; desde entonces una regata mueve el rating 32 × lo que no se esperaba de ti.', 'Ein Punkt je gewerteter Regatta, grün nach einem Sieg, orange nach einer Niederlage. In den ersten fünf, schattiert, zählte jede doppelt; seitdem bewegt eine Regatta die Wertung um 32 × das, was man nicht von dir erwartet hat.', 'Her reytingli yarış bir nokta: galibiyetten sonra yeşil, yenilgiden sonra turuncu. Gölgeli ilk beşte her yarış iki kat sayıldı; o zamandan beri bir yarış reytingi, senden beklenmeyenin 32 katı kadar oynatır.', 'Un point par régate classée, vert après une victoire, orange après une défaite. Dans les cinq premières, ombrées, chaque régate comptait double ; depuis, une régate bouge le classement de 32 × ce qu’on n’attendait pas de toi.', 'Un punto per regata con rating, verde dopo una vittoria e arancione dopo una sconfitta. Nelle prime cinque, ombreggiate, ogni regata contava doppio; da allora una regata muove il rating di 32 × quanto non ci si aspettava da te.', 'Um ponto por regata com rating, verde depois de vitória e laranja depois de derrota. Nas cinco primeiras, sombreadas, cada regata contou em dobro; desde então uma regata mexe no rating 32 × o que não se esperava de você.')}</p>
          </section>
        ) : (
          <section className="rm-sec">
            <p className="lead">{t(`No rated races yet: everyone starts at ${START}. Race someone 1-on-1, both signed in, and your first five find your level.`, `Рейтинговых гонок пока нет: все начинают с ${START}. Сыграй 1 на 1, оба в аккаунтах, — и первые пять гонок найдут твой уровень.`, `Aún no hay regatas con rating: todos empiezan en ${START}. Regatea 1 contra 1, los dos con sesión, y tus cinco primeras encontrarán tu nivel.`, `Noch keine gewerteten Regatten: alle beginnen bei ${START}. Segle 1 gegen 1, beide angemeldet, und deine ersten fünf finden dein Niveau.`, `Henüz reytingli yarış yok: herkes ${START}’den başlar. İkiniz de giriş yapmışken bire bir yarış; ilk beşin seviyeni bulur.`, `Pas encore de régate classée : tout le monde part de ${START}. Fais un duel, connectés tous les deux, et tes cinq premières trouveront ton niveau.`, `Ancora nessuna regata con rating: tutti partono da ${START}. Corri 1 contro 1, entrambi connessi, e le prime cinque troveranno il tuo livello.`, `Ainda sem regatas com rating: todos começam em ${START}. Faça um duelo, os dois conectados, e as cinco primeiras acham seu nível.`)}</p>
            <div className="rb-acts"><a className="rt-go" href="/duel"><IconPlay /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata')}</span></a></div>
          </section>
        )}

        <div className="rp-two">
          <section className="rm-sec" aria-labelledby="rp-lvl-h">
            <h2 className="rm-h" id="rp-lvl-h">{t('The seven levels', 'Семь уровней', 'Los siete niveles', 'Die sieben Stufen', 'Yedi seviye', 'Les sept niveaux', 'I sette livelli', 'Os sete níveis')}</h2>
            <ol className="rp-levels">{[...LEVELS.keys()].reverse().map((i) => (
              <li key={LEVELS[i].key} className={!prov && i === lvlIdx ? 'me' : undefined} aria-current={!prov && i === lvlIdx ? 'true' : undefined}>
                <b>{pick(LEVELS[i].name, lang)}</b><span className="rp-r">{i === 0 ? `< ${LEVELS[1].min}` : i === LEVELS.length - 1 ? `${LEVELS[i].min}+` : `${LEVELS[i].min}–${LEVELS[i + 1].min - 1}`}</span>
                <span className="rp-bar"><i style={{ width: `${Math.round((d.levels[i] / maxLvl) * 100)}%` }} /></span><span className="rp-c">{num(d.levels[i])}</span>
              </li>
            ))}</ol>
            <p className="rp-note-p">{t(`How many of the ${num(d.of)} settled sailors hold each level. A level shows once the first five races are done.`, `Сколько из ${num(d.of)} гонщиков с устоявшимся рейтингом на каждом уровне. Уровень появляется после первых пяти гонок.`, `Cuántos de los ${num(d.of)} regatistas con rating asentado hay en cada nivel. El nivel se ve tras las cinco primeras regatas.`, `Wie viele der ${num(d.of)} Segler mit fester Wertung jede Stufe halten. Eine Stufe erscheint nach den ersten fünf Regatten.`, `Oturmuş reytingli ${num(d.of)} denizciden kaçının hangi seviyede olduğu. Seviye ilk beş yarıştan sonra görünür.`, `Combien des ${num(d.of)} régatiers au classement établi tiennent chaque niveau. Le niveau s’affiche après les cinq premières régates.`, `Quanti dei ${num(d.of)} velisti con rating stabile stanno in ogni livello. Il livello appare dopo le prime cinque regate.`, `Quantos dos ${num(d.of)} velejadores com rating firme estão em cada nível. O nível aparece depois das cinco primeiras regatas.`)}</p>
          </section>
          {d.spread.length ? (
            <section className="rm-sec" aria-labelledby="rp-spread-h">
              <h2 className="rm-h" id="rp-spread-h">{t(`Among ${num(d.of)} sailors`, `Среди ${num(d.of)} гонщиков`, `Entre ${num(d.of)} regatistas`, `Unter ${num(d.of)} Seglern`, `${num(d.of)} denizci arasında`, `Parmi ${num(d.of)} régatiers`, `Fra ${num(d.of)} velisti`, `Entre ${num(d.of)} velejadores`)}</h2>
              <ol className="rp-hist" aria-label={t('Settled ratings in steps of 50', 'Устоявшиеся рейтинги, шаг 50', 'Ratings asentados, de 50 en 50', 'Feste Wertungen in Schritten von 50', '50’lik adımlarla oturmuş reytingler', 'Classements établis par pas de 50', 'Rating stabili a passi di 50', 'Ratings firmes de 50 em 50')}>
                {d.spread.map((s) => <li key={s.at} className={!prov && s.at === myBin ? 'me' : s.at < myBin ? 'lo' : undefined} style={{ ['--h' as string]: (s.n / maxBin).toFixed(3) }} title={`${s.at}–${s.at + 49}: ${s.n}`}><i /><small>{s.at % 200 === 0 ? s.at : ''}</small></li>)}
              </ol>
              {ahead != null && !prov ? <p className="rm-line"><b>{t(`Ahead of ${ahead}%`, `Выше ${ahead}%`, `Por delante del ${ahead}%`, `Vor ${ahead} %`, `%${ahead} önünde`, `Devant ${ahead} %`, `Davanti al ${ahead}%`, `À frente de ${ahead}%`)}</b><span>{t(`of the settled sailors`, `гонщиков с устоявшимся рейтингом`, `de los regatistas con rating asentado`, `der Segler mit fester Wertung`, `oturmuş reytingli denizcilerin`, `des régatiers au classement établi`, `dei velisti con rating stabile`, `dos velejadores com rating firme`)}</span></p> : null}
            </section>
          ) : null}
        </div>

        {d.history.length ? (
          <section className="rm-sec" aria-labelledby="rp-vs-h">
            <h2 className="rm-h" id="rp-vs-h">{t('Against whom', 'Против кого', 'Contra quién', 'Gegen wen', 'Kime karşı', 'Contre qui', 'Contro chi', 'Contra quem')}</h2>
            <ul className="rp-vs">{bands(d.history).map((b) => { const all = b.wins + b.losses, bn = b.best?.them || anyone; return (
              <li key={b.key}><span className="lbl">{bandName(b.key)}</span><b>{b.wins}–{b.losses}</b>
                <span className="rp-bar"><i style={{ width: `${all ? Math.round((b.wins / all) * 100) : 0}%` }} /></span>
                <small>{b.best ? t(`Your best: ${bn}, ${b.best.themBefore}, on ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `Лучшая: ${bn}, ${b.best.themBefore}, ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `Tu mejor: ${bn}, ${b.best.themBefore}, el ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `Dein bester: ${bn}, ${b.best.themBefore}, am ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `En iyin: ${bn}, ${b.best.themBefore}, ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `Ton meilleur : ${bn}, ${b.best.themBefore}, le ${dayS(b.best.at)} : ${sgn(b.best.delta)}.`, `Il tuo migliore: ${bn}, ${b.best.themBefore}, il ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`, `Seu melhor: ${bn}, ${b.best.themBefore}, em ${dayS(b.best.at)}: ${sgn(b.best.delta)}.`) : all ? '' : t('None yet.', 'Пока нет.', 'Ninguna aún.', 'Noch keine.', 'Henüz yok.', 'Aucune encore.', 'Nessuna ancora.', 'Nenhuma ainda.')}</small>
              </li>
            ); })}</ul>
          </section>
        ) : null}

        {last.length ? (
          <section className="rm-sec" aria-labelledby="rp-why-h">
            <h2 className="rm-h" id="rp-why-h">{t('Why it moved', 'Почему он изменился', 'Por qué cambió', 'Warum sie sich bewegte', 'Neden değişti', 'Pourquoi il a bougé', 'Perché si è mosso', 'Por que mudou')}</h2>
            <ol className="rp-why">{last.map((c) => (
              <li key={c.at}>
                <span className="rp-why-top"><span className="rp-d">{dayS(c.at)}</span><b>{c.them || anyone} · {c.themBefore}</b>
                  <span className={c.won ? 'rp-res up' : 'rp-res dn'}>{result(c)}</span>{c.venue ? <span className="rp-d">{pick(venueOf(c.venue).name, lang)}</span> : null}
                  <span className="rp-move"><span className={c.delta > 0 ? 'rp-ch up' : c.delta < 0 ? 'rp-ch dn' : 'rp-ch'}>{sgn(c.delta)}</span><span className="rp-after">{c.after}</span></span></span>
                <span className="rp-why-t">{whyMoved(c, lang)}</span>
              </li>
            ))}</ol>
          </section>
        ) : null}
        <div className="rb-acts">
          <a className="rt-go" href="/duel"><IconPlay /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata')}</span></a>
          <Link className="rb-link" href="/help/duel#h-rating">{t('How the rating works', 'Как устроен рейтинг', 'Cómo funciona el rating', 'So funktioniert die Wertung', 'Reyting nasıl işler', 'Comment marche le classement', 'Come funziona il rating', 'Como funciona o rating')} ›</Link>
          <Link className="rb-link" href="/rating#duel">{t('Everyone’s ratings', 'Рейтинг всех', 'Los ratings de todos', 'Alle Wertungen', 'Herkesin reytingi', 'Tous les classements', 'I rating di tutti', 'Os ratings de todos')} ›</Link>
        </div>
      </div>
    </>
  );
}
