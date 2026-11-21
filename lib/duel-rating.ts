import { tx, type Lang } from './lang';
import { levelName } from './levels';
import { provisional, shown, signed, PROVISIONAL } from './elo';
import { plainName } from './name';

// What a 1-on-1 race did to the rating, as the database's regatta_duel_rating(code, seed) tells the signed-in sailor of
// it (iyt-test supabase/migrations/20261121140000_regatta_rating.sql), and the line the game's card and the result page say it
// in. GET /connect/rating (app/connect/rating/route.ts) answers it; components/duel-rating.tsx draws it on the result page.
export type Why = 'account' | 'same' | 'claimed' | 'abandoned' | 'no_winner' | 'disputed' | 'limit' | 'one_screen';
export type Rated = {
  status: 'rated'; side: 'host' | 'guest';
  me: { before: number; after: number; delta: number; won: boolean; k: number; chance: number; races: number; rating: number; all_races: number };
  them: { name: string | null; before: number; after: number; delta: number; races: number };
};
export type DuelRating = Rated | { status: 'waiting'; side: 'host' | 'guest' } | { status: 'unrated'; side: 'host' | 'guest'; reason: Why } | { status: 'none' };

const WHYS: readonly Why[] = ['account', 'same', 'claimed', 'abandoned', 'no_winner', 'disputed', 'limit', 'one_screen'];
const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);

// the database's answer, checked: anything that isn't one of the four is 'none'
export function parseRating(j: unknown): DuelRating {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return { status: 'none' };
  const side = o.side === 'host' || o.side === 'guest' ? o.side : null;
  if (o.status === 'waiting' && side) return { status: 'waiting', side };
  if (o.status === 'unrated' && side && WHYS.includes(o.reason as Why)) return { status: 'unrated', side, reason: o.reason as Why };
  if (o.status === 'rated' && side) {
    const me = o.me as Rated['me'] | undefined, them = o.them as Rated['them'] | undefined;
    if (me && them && [me.before, me.after, me.delta, me.k, me.races, me.rating, me.all_races, them.before, them.after, them.delta, them.races].every(int) && typeof me.chance === 'number')
      return { status: 'rated', side, me: { ...me, won: !!me.won }, them: { ...them, name: plainName(them.name) ?? null } };
  }
  return { status: 'none' };
}

// one line for the game's card after a race: "1-on-1 rating 1558 (+18) · Fleet", "~1532 (+32) · race 1 of 5", or why it
// doesn't count; null when there is nothing to say (not signed in, not this sailor's race)
export function ratingLine(r: DuelRating, lang: Lang): string | null {
  const t = tx(lang);
  if (r.status === 'none') return null;
  if (r.status === 'waiting') return t('1-on-1 rating: waiting for both screens…', 'Рейтинг 1 на 1: ждём оба экрана…', 'Rating 1 contra 1: esperando a las dos pantallas…', '1-gegen-1-Wertung: warte auf beide Bildschirme …', 'Bire bir reyting: iki ekran bekleniyor…', 'Classement en duel : on attend les deux écrans…', 'Rating 1 contro 1: in attesa dei due schermi…', 'Rating 1 contra 1: esperando as duas telas…');
  if (r.status === 'unrated') return `${t('Not rated', 'Без рейтинга', 'Sin rating', 'Nicht gewertet', 'Reytinge sayılmadı', 'Hors classement', 'Non valida per il rating', 'Não conta para o rating')}: ${whyText(r.reason, lang)}`;
  const { after, delta, races } = r.me, label = t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1');
  const tail = provisional(races)
    ? t(`race ${races} of ${PROVISIONAL}`, `гонка ${races} из ${PROVISIONAL}`, `regata ${races} de ${PROVISIONAL}`, `Regatta ${races} von ${PROVISIONAL}`, `${PROVISIONAL} yarıştan ${races}.`, `régate ${races} sur ${PROVISIONAL}`, `regata ${races} di ${PROVISIONAL}`, `regata ${races} de ${PROVISIONAL}`)
    : levelName(after, lang);
  return `${label} ${shown(after, races)} (${signed(delta)}) · ${tail}`;
}

export function whyText(why: Why, lang: Lang): string {
  const t = tx(lang);
  switch (why) {
    case 'account': return t('both sailors need to be signed in', 'оба гонщика должны войти в аккаунт', 'los dos regatistas tienen que iniciar sesión', 'beide Segler müssen angemeldet sein', 'iki denizcinin de giriş yapması gerekir', 'les deux marins doivent être connectés', 'entrambi i velisti devono aver effettuato l’accesso', 'os dois velejadores precisam estar conectados');
    case 'same': return t('the same account sailed both boats', 'на обеих лодках один аккаунт', 'la misma cuenta llevó los dos barcos', 'dasselbe Konto segelte beide Boote', 'iki tekneyi de aynı hesap yönetti', 'le même compte menait les deux bateaux', 'lo stesso account ha portato entrambe le barche', 'a mesma conta velejou os dois barcos');
    case 'claimed': return t('it was sailed signed out and kept after', 'гонка прошла без аккаунта и сохранена после', 'se navegó sin sesión y se guardó después', 'sie wurde ohne Anmeldung gesegelt und danach gespeichert', 'giriş yapılmadan yarışıldı ve sonra saklandı', 'elle a été courue sans être connecté et gardée après', 'è stata corsa senza accesso e salvata dopo', 'foi corrida sem conta e guardada depois');
    case 'abandoned': return t('the race was abandoned', 'гонка брошена', 'la regata se abandonó', 'die Regatta wurde abgebrochen', 'yarış terk edildi', 'la régate a été abandonnée', 'la regata è stata abbandonata', 'a regata foi abandonada');
    case 'no_winner': return t('the race had no winner', 'у гонки нет победителя', 'la regata no tuvo ganador', 'die Regatta hatte keinen Sieger', 'yarışın kazananı yok', 'la régate n’a pas de vainqueur', 'la regata non ha un vincitore', 'a regata não teve vencedor');
    case 'disputed': return t('the two screens saw different results', 'экраны увидели разный итог', 'las dos pantallas vieron resultados distintos', 'die beiden Bildschirme sahen verschiedene Ergebnisse', 'iki ekran farklı sonuçlar gördü', 'les deux écrans ont vu des résultats différents', 'i due schermi hanno visto risultati diversi', 'as duas telas viram resultados diferentes');
    case 'limit': return t('you’ve had three rated races with this sailor today', 'с этим гонщиком сегодня уже три рейтинговые гонки', 'ya llevas tres regatas con rating con este regatista hoy', 'mit diesem Segler hattest du heute schon drei gewertete Regatten', 'bugün bu denizciyle zaten üç reytingli yarışın oldu', 'tu as déjà fait trois régates classées avec ce marin aujourd’hui', 'oggi hai già fatto tre regate valide con questo velista', 'você já fez três regatas valendo rating com este velejador hoje');
    case 'one_screen': return t('only one screen reported the end', 'конец гонки пришёл только с одного экрана', 'solo una pantalla informó del final', 'nur ein Bildschirm hat das Ende gemeldet', 'bitişi yalnızca bir ekran bildirdi', 'un seul écran a signalé la fin', 'solo uno schermo ha segnalato la fine', 'só uma tela informou o fim');
  }
}

// The signed-in sailor's own rating, as regatta_my_rating() tells it: the number, the record, the place among settled
// ratings (null while provisional), best and lowest, and the last rated races, newest first
export type MyRace = { at: string; won: boolean; before: number; after: number; delta: number; them: string | null; them_before: number; venue: string | null; yacht: string | null; margin: number | null; forfeit: boolean };
// recent: the last ten 1-on-1 races, rated or not (delta null: just for fun, or not rated), the player page's history
export type Recent = { at: string; state: 'finished' | 'abandoned' | 'no_result'; won: boolean | null; them: string | null; venue: string | null; yacht: string | null; delta: number | null };
export type MyRating = { rating: number; races: number; wins: number; losses: number; best: number; lowest: number; place: number | null; of: number; changes: MyRace[]; recent: Recent[] };

export function parseMine(j: unknown): MyRating | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || ![o.rating, o.races, o.wins, o.losses, o.best, o.lowest, o.of].every(int) || !(o.place === null || int(o.place)) || !Array.isArray(o.changes)) return null;
  const changes = (o.changes as Record<string, unknown>[]).filter((c) => c && typeof c.at === 'string' && [c.before, c.after, c.delta, c.them_before].every(int)).map((c) => ({
    at: c.at as string, won: !!c.won, before: c.before as number, after: c.after as number, delta: c.delta as number, them: plainName(c.them as string) ?? null,
    them_before: c.them_before as number, venue: typeof c.venue === 'string' ? c.venue : null, yacht: typeof c.yacht === 'string' ? c.yacht : null,
    margin: typeof c.margin === 'number' && Number.isFinite(c.margin) ? c.margin : null, forfeit: !!c.forfeit }));
  const recent = (Array.isArray(o.recent) ? (o.recent as Record<string, unknown>[]) : []).filter((c) => c && typeof c.at === 'string' && ['finished', 'abandoned', 'no_result'].includes(c.state as string)).map((c) => ({
    at: c.at as string, state: c.state as Recent['state'], won: typeof c.won === 'boolean' ? c.won : null, them: plainName(c.them as string) ?? null,
    venue: typeof c.venue === 'string' ? c.venue : null, yacht: typeof c.yacht === 'string' ? c.yacht : null, delta: int(c.delta) ? (c.delta as number) : null }));
  return { rating: o.rating as number, races: o.races as number, wins: o.wins as number, losses: o.losses as number, best: o.best as number, lowest: o.lowest as number,
    place: o.place as number | null, of: o.of as number, changes, recent };
}
