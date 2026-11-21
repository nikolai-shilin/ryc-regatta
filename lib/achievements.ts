// Achievements (release 7c of the 1-on-1 plan). Each is a rule the database runs over what it already holds (iyt-test
// supabase/migrations/20261122040000_regatta_achievements.sql, regatta_achievements()): the account's races and its
// log of today's race and the venues, and its 1-on-1 races and rating. The day each came is worked out from that
// history and kept (regatta_achievement), so every device shows the same ones on the same days. Here: their names and
// what earns them, in every language, the answer checked, and the line under one had.
import { tx, type Lang, type Pair } from './lang.ts'; // with their extensions, so npm test's Node finds them too
import { plainName } from './name.ts';

export type Kind = 'race' | 'venues' | 'duel';
export type Def = { key: string; kind: Kind; icon: string; name: Pair; how: Pair };
export const ACHIEVEMENTS: readonly Def[] = [
  { key: 'first_race', kind: 'race', icon: '1', name: ['First race', 'Первая гонка', 'Primera regata', 'Erste Regatta', 'İlk yarış', 'Première régate', 'Prima regata', 'Primeira regata'],
    how: ['Finish your first race.', 'Пройди первую гонку до финиша.', 'Termina tu primera regata.', 'Beende deine erste Regatta.', 'İlk yarışını bitir.', 'Termine ta première régate.', 'Finisci la tua prima regata.', 'Termine sua primeira regata.'] },
  { key: 'week', kind: 'race', icon: '7', name: ['A week on the water', 'Неделя на воде', 'Una semana en el agua', 'Eine Woche auf dem Wasser', 'Suda bir hafta', 'Une semaine sur l’eau', 'Una settimana in acqua', 'Uma semana na água'],
    how: ['Keep a streak of today’s race for seven days.', 'Держи серию гонки дня семь дней.', 'Mantén una racha de la regata del día durante siete días.', 'Halte eine Serie der Regatta des Tages sieben Tage lang.', 'Günün yarışında yedi günlük seri yap.', 'Tiens une série de la régate du jour sept jours.', 'Tieni una serie della regata del giorno per sette giorni.', 'Mantenha uma sequência da regata do dia por sete dias.'] },
  { key: 'month', kind: 'race', icon: '30', name: ['A month on the water', 'Месяц на воде', 'Un mes en el agua', 'Ein Monat auf dem Wasser', 'Suda bir ay', 'Un mois sur l’eau', 'Un mese in acqua', 'Um mês na água'],
    how: ['Keep a streak of today’s race for thirty days.', 'Держи серию гонки дня тридцать дней.', 'Mantén una racha de la regata del día durante treinta días.', 'Halte eine Serie der Regatta des Tages dreißig Tage lang.', 'Günün yarışında otuz günlük seri yap.', 'Tiens une série de la régate du jour trente jours.', 'Tieni una serie della regata del giorno per trenta giorni.', 'Mantenha uma sequência da regata do dia por trinta dias.'] },
  { key: 'podium', kind: 'race', icon: '3', name: ['Podium', 'Подиум', 'Podio', 'Podium', 'Podyum', 'Podium', 'Podio', 'Pódio'],
    how: ['Finish in the top three of a day’s race.', 'Войди в тройку лучших в гонке дня.', 'Termina entre los tres primeros de la regata del día.', 'Komm in der Regatta des Tages unter die ersten drei.', 'Günün yarışında ilk üçe gir.', 'Finis dans les trois premiers de la régate du jour.', 'Arriva tra i primi tre della regata del giorno.', 'Termine entre os três primeiros da regata do dia.'] },
  { key: 'day_winner', kind: 'race', icon: '★', name: ['The day’s winner', 'Победитель дня', 'Ganador del día', 'Tagessieger', 'Günün galibi', 'Vainqueur du jour', 'Vincitore del giorno', 'Vencedor do dia'],
    how: ['Win a day’s race outright.', 'Выиграй гонку дня.', 'Gana la regata del día.', 'Gewinne die Regatta des Tages.', 'Günün yarışını kazan.', 'Gagne la régate du jour.', 'Vinci la regata del giorno.', 'Vença a regata do dia.'] },
  { key: 'venues_10', kind: 'venues', icon: '10', name: ['Ten venues', 'Десять акваторий', 'Diez sedes', 'Zehn Reviere', 'On yarış alanı', 'Dix plans d’eau', 'Dieci campi', 'Dez raias'],
    how: ['Race at ten of the venues.', 'Пройди гонки на десяти акваториях.', 'Regatea en diez de las sedes.', 'Segle in zehn der Reviere.', 'On yarış alanında yarış.', 'Cours sur dix des plans d’eau.', 'Corri in dieci dei campi.', 'Velejar em dez das raias.'] },
  { key: 'venues_33', kind: 'venues', icon: '33', name: ['Half the world', 'Полмира', 'Medio mundo', 'Die halbe Welt', 'Dünyanın yarısı', 'La moitié du monde', 'Mezzo mondo', 'Meio mundo'],
    how: ['Race at 33 of the 66 venues.', 'Пройди гонки на 33 из 66 акваторий.', 'Regatea en 33 de las 66 sedes.', 'Segle in 33 der 66 Reviere.', '66 yarış alanının 33’ünde yarış.', 'Cours sur 33 des 66 plans d’eau.', 'Corri in 33 dei 66 campi.', 'Velejar em 33 das 66 raias.'] },
  { key: 'first_duel', kind: 'duel', icon: '1v1', name: ['First 1-on-1', 'Первая гонка 1 на 1', 'Primera 1 contra 1', 'Erstes 1 gegen 1', 'İlk bire bir', 'Premier duel', 'Prima 1 contro 1', 'Primeiro duelo'],
    how: ['Finish a 1-on-1 race.', 'Пройди гонку 1 на 1 до финиша.', 'Termina una regata 1 contra 1.', 'Beende eine 1-gegen-1-Regatta.', 'Bir bire bir yarışı bitir.', 'Termine un duel.', 'Finisci una regata 1 contro 1.', 'Termine um duelo.'] },
  { key: 'first_win', kind: 'duel', icon: 'W', name: ['First win', 'Первая победа', 'Primera victoria', 'Erster Sieg', 'İlk galibiyet', 'Première victoire', 'Prima vittoria', 'Primeira vitória'],
    how: ['Win a rated 1-on-1.', 'Выиграй рейтинговую гонку 1 на 1.', 'Gana una 1 contra 1 con rating.', 'Gewinne ein gewertetes 1 gegen 1.', 'Reytingli bir bire biri kazan.', 'Gagne un duel classé.', 'Vinci una 1 contro 1 con rating.', 'Vença um duelo com rating.'] },
  { key: 'settled', kind: 'duel', icon: '5', name: ['Rated', 'В рейтинге', 'Con rating', 'Gewertet', 'Reytingli', 'Au classement', 'Nel rating', 'No rating'],
    how: ['Sail your first five rated races: your level shows.', 'Пройди первые пять рейтинговых гонок — появится уровень.', 'Navega tus cinco primeras regatas con rating: aparece tu nivel.', 'Segle deine ersten fünf gewerteten Regatten: deine Stufe erscheint.', 'İlk beş reytingli yarışını yap: seviyen görünür.', 'Cours tes cinq premières régates classées : ton niveau apparaît.', 'Corri le prime cinque regate con rating: appare il tuo livello.', 'Faça suas cinco primeiras regatas com rating: seu nível aparece.'] },
  { key: 'giant', kind: 'duel', icon: '▲', name: ['Giant-killer', 'Гроза сильных', 'Matagigantes', 'Riesentöter', 'Dev avcısı', 'Tueur de géants', 'Ammazzagiganti', 'Mata-gigante'],
    how: ['Beat a sailor 200 or more above you.', 'Обыграй соперника, который выше тебя на 200 и больше.', 'Gana a alguien 200 o más por encima de ti.', 'Schlag jemanden, der 200 oder mehr über dir steht.', 'Senden 200 ve daha fazla yukarıdaki birini yen.', 'Bats un régatier 200 ou plus au-dessus de toi.', 'Batti qualcuno 200 o più sopra di te.', 'Vença alguém 200 ou mais acima de você.'] },
  { key: 'run_5', kind: 'duel', icon: '5W', name: ['Five in a row', 'Пять подряд', 'Cinco seguidas', 'Fünf in Folge', 'Üst üste beş', 'Cinq d’affilée', 'Cinque di fila', 'Cinco seguidas'],
    how: ['Win five rated 1-on-1s in a row.', 'Выиграй пять рейтинговых гонок 1 на 1 подряд.', 'Gana cinco 1 contra 1 con rating seguidas.', 'Gewinne fünf gewertete 1 gegen 1 in Folge.', 'Üst üste beş reytingli bire bir kazan.', 'Gagne cinq duels classés d’affilée.', 'Vinci cinque 1 contro 1 con rating di fila.', 'Vença cinco duelos com rating seguidos.'] },
  { key: 'regional', kind: 'duel', icon: 'R', name: ['Regional', 'Региональный', 'Regional', 'Regional', 'Bölgesel', 'Régional', 'Regionale', 'Regional'],
    how: ['Reach 1600 once your first five are done.', 'Дойди до 1600 после первых пяти гонок.', 'Llega a 1600 tras tus cinco primeras.', 'Erreiche 1600 nach deinen ersten fünf.', 'İlk beşinden sonra 1600’e ulaş.', 'Atteins 1600 après tes cinq premières.', 'Arriva a 1600 dopo le prime cinque.', 'Chegue a 1600 depois das cinco primeiras.'] },
  { key: 'rival', kind: 'duel', icon: 'H', name: ['Rival tamed', 'Соперник покорён', 'Rival domado', 'Rivale gezähmt', 'Rakip evcilleşti', 'Rival dompté', 'Rivale domato', 'Rival domado'],
    how: ['Lead the head-to-head with a sailor you’ve raced ten times.', 'Веди в личном счёте с соперником, с которым было десять гонок.', 'Ve por delante en el cara a cara con alguien con quien has regateado diez veces.', 'Führe den direkten Vergleich mit jemandem an, gegen den du zehnmal gesegelt bist.', 'On kez yarıştığın biriyle ikili sicilde önde ol.', 'Mène le face-à-face avec un régatier affronté dix fois.', 'Sii avanti nello scontro diretto con qualcuno affrontato dieci volte.', 'Esteja à frente no confronto direto com alguém que você enfrentou dez vezes.'] },
  { key: 'hour_5', kind: 'duel', icon: '19', name: ['Duel hour regular', 'Завсегдатай часа дуэлей', 'Habitual de la hora de duelos', 'Stammgast der Duell-Stunde', 'Düello saatinin müdavimi', 'Fidèle de l’heure des duels', 'Fedele dell’ora dei duelli', 'Fiel da hora dos duelos'],
    how: ['Race 1-on-1 in five duel hours, 19:00–20:00 UTC.', 'Гоняйся 1 на 1 в пять часов дуэлей, 19:00–20:00 UTC.', 'Regatea 1 contra 1 en cinco horas de duelos, 19:00–20:00 UTC.', 'Segle 1 gegen 1 in fünf Duell-Stunden, 19:00–20:00 UTC.', 'Beş düello saatinde bire bir yarış, 19:00–20:00 UTC.', 'Fais des duels pendant cinq heures des duels, 19:00–20:00 UTC.', 'Corri 1 contro 1 in cinque ore dei duelli, 19:00–20:00 UTC.', 'Faça duelos em cinco horas dos duelos, 19:00–20:00 UTC.'] },
];

export type Got = { key: string; at: string; detail: Record<string, unknown> };
export type Achievements = { got: Got[]; progress: Record<string, [number, number] | null> };
const known = new Set(ACHIEVEMENTS.map((a) => a.key));
export function parseAchievements(j: unknown): Achievements | null {
  const o = j as { got?: unknown; progress?: unknown } | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.got)) return null;
  const got: Got[] = [];
  for (const g of o.got as Record<string, unknown>[]) {
    if (typeof g?.key !== 'string' || !known.has(g.key) || typeof g.at !== 'string' || !Number.isFinite(Date.parse(g.at))) continue;
    got.push({ key: g.key, at: g.at, detail: g.detail && typeof g.detail === 'object' ? (g.detail as Record<string, unknown>) : {} });
  }
  const progress: Achievements['progress'] = {};
  const p = o.progress && typeof o.progress === 'object' ? (o.progress as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(p)) {
    if (!known.has(k)) continue;
    progress[k] = Array.isArray(v) && v.length === 2 && v.every((x) => Number.isInteger(x) && x >= 0) && v[1] > 0 ? [v[0], v[1]] : null;
  }
  return { got, progress };
}

// what an achievement had was: "3rd of 25", "Bea S. · 1720", "Anna K."; empty when there is nothing more to say
export function detailOf(g: Got, lang: Lang, ord: (n: number) => string): string {
  const t = tx(lang), d = g.detail, them = typeof d.them === 'string' ? plainName(d.them) : null, rating = Number.isInteger(d.rating) ? (d.rating as number) : null;
  if ((g.key === 'podium' || g.key === 'day_winner') && Number.isInteger(d.place) && Number.isInteger(d.of)) {
    const p = d.place as number, n = d.of as number;
    return t(`${ord(p)} of ${n}`, `${p}-е из ${n}`, `${ord(p)} de ${n}`, `${ord(p)} von ${n}`, `${n} içinde ${ord(p)}`, `${ord(p)} sur ${n}`, `${ord(p)} su ${n}`, `${ord(p)} de ${n}`);
  }
  if ((g.key === 'first_win' || g.key === 'giant') && them) return rating != null ? `${them} · ${rating}` : them;
  if (g.key === 'rival' && them) return them;
  if ((g.key === 'settled' || g.key === 'regional') && rating != null) return String(rating);
  return '';
}
