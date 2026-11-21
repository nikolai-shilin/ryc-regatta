'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALE, pick, tx, type Lang } from '@/lib/lang';
import { levelName, nextLevel } from '@/lib/levels';
import { provisional, shown, signed, PROVISIONAL, START } from '@/lib/elo';
import { parseMine, type MyRating } from '@/lib/duel-rating';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { IconCrew } from './ui';
import '@/styles/duel-rating.css';

// Your 1-on-1 rating on your own card on /players (components/players-view.tsx, `mine`): the number and the level (a ~ and
// how many of the first five are done while provisional), the record, your place among the settled ratings, best and lowest,
// the bar to the next level, and your last five rated races. From GET /connect/rating/me; nothing for a sailor not signed in.
// On /duel itself (`here`) it has no link to race 1-on-1: the page is that.
export function MyDuelRating({ lang, here }: { lang: Lang; here?: boolean }) {
  const [mine, setMine] = useState<MyRating | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    fetch('/connect/rating/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setMine(parseMine(j)); }, () => { if (on) setMine(null); });
    return () => { on = false; };
  }, []);
  return mine ? <MyDuelRatingView mine={mine} lang={lang} here={here} /> : null;
}

export function MyDuelRatingView({ mine, lang, here }: { mine: MyRating; lang: Lang; here?: boolean }) {
  const t = tx(lang), num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const head = <span className="bt-k"><IconCrew s={14} />{t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1')}</span>;
  if (!mine.races) return (
    <div className="bt-g">
      {head}
      <p className="bt-hint">{t(`Not rated yet: everyone starts at ${START}. Race someone 1-on-1, both signed in, and your first five races find your level.`, `Рейтинга пока нет: у всех старт с ${START}. Проведи гонку 1 на 1, оба с аккаунтом, и первые пять гонок найдут твой уровень.`, `Aún sin rating: todos empiezan en ${START}. Haz una regata 1 contra 1, los dos con sesión iniciada, y tus cinco primeras regatas encontrarán tu nivel.`, `Noch keine Wertung: alle beginnen bei ${START}. Segle eine 1-gegen-1-Regatta, beide angemeldet, und deine ersten fünf Regatten finden dein Niveau.`, `Henüz reyting yok: herkes ${START} ile başlar. İkiniz de giriş yapmış olarak bire bir yarış; ilk beş yarışın seviyeni bulur.`, `Pas encore classé : tout le monde part de ${START}. Fais un duel, tous deux connectés, et tes cinq premières régates trouveront ton niveau.`, `Ancora senza rating: tutti partono da ${START}. Fai una regata 1 contro 1, entrambi con l’accesso, e le prime cinque regate troveranno il tuo livello.`, `Ainda sem rating: todos começam em ${START}. Corra um duelo 1 contra 1, os dois conectados, e suas cinco primeiras regatas acham o seu nível.`)}</p>
      <History mine={mine} lang={lang} />
      {!here && <Link className="bt-row" href="/duel"><IconCrew s={18} /><span>{t('Race someone 1-on-1', 'Гонка 1 на 1', 'Una regata 1 contra 1', 'Eine 1-gegen-1-Regatta', 'Bire bir yarış', 'Un duel 1 contre 1', 'Una regata 1 contro 1', 'Um duelo 1 contra 1')}</span></Link>}
    </div>
  );
  const prov = provisional(mine.races), next = prov ? null : nextLevel(mine.rating);
  return (
    <div className="bt-g">
      {head}
      <div className="dr dr-card">
        <div className="dr-top">
          <b className="dr-n">{shown(mine.rating, mine.races)}</b>
          <span className="dr-lvl">{prov ? t(`${mine.races} of ${PROVISIONAL} races`, `${mine.races} из ${PROVISIONAL} гонок`, `${mine.races} de ${PROVISIONAL} regatas`, `${mine.races} von ${PROVISIONAL} Regatten`, `${PROVISIONAL} yarıştan ${mine.races}`, `${mine.races} régates sur ${PROVISIONAL}`, `${mine.races} regate su ${PROVISIONAL}`, `${mine.races} de ${PROVISIONAL} regatas`) : levelName(mine.rating, lang)}</span>
        </div>
        {next && (
          <div className="dr-next">
            <span className="dr-bar" aria-hidden="true"><i style={{ width: `${Math.round(next.at * 100)}%` }} /></span>
            <span className="dr-to">{t(`${next.to} to ${levelName(next.level.min, 'en')}`, `${next.to} до уровня «${levelName(next.level.min, 'ru')}»`, `${next.to} para ${levelName(next.level.min, 'es')}`, `${next.to} bis ${levelName(next.level.min, 'de')}`, `${levelName(next.level.min, 'tr')} seviyesine ${next.to}`, `${next.to} avant ${levelName(next.level.min, 'fr')}`, `${next.to} a ${levelName(next.level.min, 'it')}`, `${next.to} para ${levelName(next.level.min, 'pt')}`)}</span>
          </div>
        )}
      </div>
      <dl className="yt-spec pl-spec">
        <div><dt>{t('Record', 'Счёт', 'Balance', 'Bilanz', 'Kayıt', 'Bilan', 'Bilancio', 'Retrospecto')}</dt><dd>{num(mine.wins)}–{num(mine.losses)}</dd></div>
        <div><dt>{t('Place', 'Место', 'Puesto', 'Platz', 'Sıra', 'Place', 'Posizione', 'Colocação')}</dt><dd>{mine.place ? t(`#${num(mine.place)} of ${num(mine.of)}`, `${num(mine.place)}-е из ${num(mine.of)}`, `n.º ${num(mine.place)} de ${num(mine.of)}`, `Nr. ${num(mine.place)} von ${num(mine.of)}`, `${num(mine.of)} içinde ${num(mine.place)}.`, `${num(mine.place)}e sur ${num(mine.of)}`, `${num(mine.place)}º su ${num(mine.of)}`, `${num(mine.place)}º de ${num(mine.of)}`) : t('After five races', 'После пяти гонок', 'Tras cinco regatas', 'Nach fünf Regatten', 'Beş yarıştan sonra', 'Après cinq régates', 'Dopo cinque regate', 'Depois de cinco regatas')}</dd></div>
        <div><dt>{t('Best', 'Лучший', 'Mejor', 'Bestwert', 'En iyi', 'Meilleur', 'Migliore', 'Melhor')}</dt><dd>{mine.best}</dd></div>
        <div><dt>{t('Lowest', 'Худший', 'Más bajo', 'Tiefstwert', 'En düşük', 'Plus bas', 'Più basso', 'Mais baixo')}</dt><dd>{mine.lowest}</dd></div>
      </dl>
      <History mine={mine} lang={lang} />
      <Link className="df-help" href="/duel/rating">{t('Your rating, race by race', 'Твой рейтинг по гонкам', 'Tu rating, regata a regata', 'Deine Wertung, Regatta für Regatta', 'Yarış yarış reytingin', 'Ton classement, régate par régate', 'Il tuo rating, regata per regata', 'Seu rating, regata a regata')} ›</Link>
    </div>
  );
}

// your last races, newest first: every 1-on-1 (recent), the rated ones with their change, the rest just for fun; the last
// five rated ones (changes) where the database is older than recent
function History({ mine, lang }: { mine: MyRating; lang: Lang }) {
  const t = tx(lang);
  const date = (s: string) => new Date(s).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const venue = (id: string | null) => (id ? pick(VENUES.find((v) => v.id === id)?.name, lang) ?? id : null);
  const yacht = (id: string | null) => (id ? pick(YACHTS.find((y) => y.id === id)?.name, lang) ?? id : null);
  const rows = mine.recent.length
    ? mine.recent.slice(0, 5).map((c) => ({ at: c.at, won: c.won, state: c.state, them: c.them, venue: c.venue, yacht: c.yacht, delta: c.delta, before: null as number | null }))
    : mine.changes.slice(0, 5).map((c) => ({ at: c.at, won: c.won as boolean | null, state: 'finished' as const, them: c.them, venue: c.venue, yacht: c.yacht, delta: c.delta as number | null, before: c.them_before as number | null }));
  if (!rows.length) return null;
  const someone = t('a sailor', 'соперник', 'un regatista', 'einen Segler', 'bir denizci', 'un marin', 'un velista', 'um velejador');
  const verb = (r: (typeof rows)[number]) => r.state !== 'finished' || r.won === null
    ? t('Raced', 'Гонка с', 'Regateó con', 'Regatta mit', 'Yarıştı:', 'Régate avec', 'Regata con', 'Correu com')
    : r.won ? t('Beat', 'Победа над', 'Ganó a', 'Sieg gegen', 'Yendi:', 'Victoire sur', 'Batte', 'Venceu') : t('Lost to', 'Проигрыш', 'Perdió con', 'Niederlage gegen', 'Kaybetti:', 'Défaite contre', 'Perde con', 'Perdeu para');
  return (
    <ol className="dr-list" aria-label={t('Your last 1-on-1 races', 'Последние гонки 1 на 1', 'Tus últimas regatas 1 contra 1', 'Deine letzten 1-gegen-1-Regatten', 'Son bire bir yarışların', 'Tes derniers duels', 'Le tue ultime regate 1 contro 1', 'Suas últimas regatas 1 contra 1')}>
      {rows.map((r, i) => (
        <li key={i}>
          <span className="dr-when">{date(r.at)}</span>
          <span className="dr-who"><span>{verb(r)} {r.them || someone}{r.before != null && <> <i>{r.before}</i></>}</span>
            <span className="dr-at">{[venue(r.venue), yacht(r.yacht)].filter(Boolean).join(' · ')}</span></span>
          {r.delta != null
            ? <b className={r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}>{signed(r.delta)}</b>
            : <span className="dr-fun">{r.state === 'abandoned' ? t('Abandoned', 'Брошена', 'Abandonada', 'Abgebrochen', 'Terk edildi', 'Abandonnée', 'Abbandonata', 'Abandonada') : t('For fun', 'Для себя', 'Por diversión', 'Zum Spaß', 'Eğlence', 'Pour le plaisir', 'Per divertimento', 'Por diversão')}</span>}
        </li>
      ))}
    </ol>
  );
}
