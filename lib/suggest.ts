// For you (release 7e of the 1-on-1 plan): what this sailor could do next, three at a time, best first, each with its
// reason in a line (components/for-you.tsx draws it, on the home page and on /duel). Rules, not machine learning:
//   1 · gather: from what the page already knows (this device's log, today's race and its ranked times, the account's
//       1-on-1 rating, who is looking now, the duel hour, the achievements under way), the cards that apply
//   2 · score: each card's reasons multiply (FACTOR: something live ×3, a close rating ×2, a goal in reach ×2, closing
//       soon ×1.5, something new ×1, shown before and not tapped ×0.5), then this sailor's weight for its kind
//   3 · filter: a kind held out (dismissed in the last seven days) never shows; three at most, never two of a group;
//       a device that hasn't raced gets only its first race
//   4 · show, and learn: the reason that scored highest is the card's "Why"; a tap adds 10% to the kind's weight, a ×
//       takes 20% off and holds the kind out a week, "Fewer like this" halves it (the database keeps it for a signed-in
//       sailor, iyt-test supabase/migrations/20261122060000_regatta_suggest.sql; this device for a guest)
import { tx, pick, type Lang } from './lang.ts'; // with their extensions, so npm test's Node finds them too
import { clock } from './clock.ts';
import { dailyRace } from './race.ts';
import { venueOf, VENUES } from './venues.ts';
import { yachtOf } from './yachts.ts';
import { streakOf, passport, shiftDay, type Log } from './log.ts';
import { levelName, nextLevel } from './levels.ts';
import { provisional } from './elo.ts';
import { ordinal } from './player-month.ts';
import { ACHIEVEMENTS, type Achievements } from './achievements.ts';
import type { Ready } from './duel-seek.ts';
import type { HourState } from './duel-hour.ts';

export type Kind = 'first_race' | 'sign_in' | 'today' | 'today_better' | 'ready' | 'hour' | 'level' | 'first_duel' | 'goal';
export const KINDS: readonly Kind[] = ['first_race', 'sign_in', 'today', 'today_better', 'ready', 'hour', 'level', 'first_duel', 'goal'];
// never two of a group: today's race is one group, a 1-on-1 with someone another
const GROUP: Record<Kind, string> = { first_race: 'start', sign_in: 'account', today: 'today', today_better: 'today', ready: 'duel', first_duel: 'duel', hour: 'event', level: 'goal', goal: 'goal' };
export const FACTOR = { live: 3, close: 2, goal: 2, soon: 1.5, fresh: 1, stale: 0.5 } as const;
type Reason = keyof typeof FACTOR;

export type Inputs = {
  now: number; back: boolean; signed: boolean; log: Log | null;
  field: number[] | null; // today's ranked times (the day's brief), when this device finished today's race
  rating: { rating: number; races: number } | null; ready: Ready[]; hour: HourState | null; achievements: Achievements | null;
};
export type State = { weights: Record<string, number>; out: string[]; stale: string[] };
export type Card = { kind: Kind; title: string; why: string; act: string; href: string; live: boolean; score: number };

const H = 3600e3;
// every card that applies, each with its reasons (the first one written is the one said, unless another scores higher)
export function gather(i: Inputs, lang: Lang): { kind: Kind; title: string; act: string; href: string; reasons: [Reason, string][] }[] {
  const t = tx(lang), ord = (n: number) => ordinal(n, lang), out: ReturnType<typeof gather> = [];
  // a device that hasn't raced: its first race, nothing else
  if (!i.back) {
    out.push({ kind: 'first_race', href: '/play?race=first&intro', act: t('Sail it', 'Пройти', 'Navegarla', 'Lossegeln', 'Yarış', 'C’est parti', 'Corrila', 'Velejar'),
      title: t('Your first race: three minutes', 'Первая гонка: три минуты', 'Tu primera regata: tres minutos', 'Deine erste Regatta: drei Minuten', 'İlk yarışın: üç dakika', 'Ta première régate : trois minutes', 'La tua prima regata: tre minuti', 'Sua primeira regata: três minutos'),
      reasons: [['fresh', t('an Optimist at the Tobago Cays, with four beginners.', 'Оптимист на Тобаго-Кейс, с четырьмя новичками.', 'un Optimist en los Tobago Cays, con cuatro principiantes.', 'ein Optimist in den Tobago Cays, mit vier Anfängern.', 'Tobago Cays’de bir Optimist, dört acemiyle.', 'un Optimist aux Tobago Cays, avec quatre débutants.', 'un Optimist alle Tobago Cays, con quattro principianti.', 'um Optimist em Tobago Cays, com quatro iniciantes.')]] });
    return out;
  }
  const today = new Date(i.now).toISOString().slice(0, 10), d = dailyRace(new Date(i.now)), v = pick(venueOf(d.venue).name, lang), y = pick(yachtOf(d.yacht).name, lang);
  const left = Date.parse(`${shiftDay(today, 1)}T00:00:00Z`) - i.now, soon = left < 6 * H, hours = Math.max(1, Math.round(left / H));
  const closes: [Reason, string] = ['soon', t(`today’s race closes in ${hours} h, at midnight UTC.`, `гонка дня закроется через ${hours} ч, в полночь UTC.`, `la regata del día cierra en ${hours} h, a medianoche UTC.`, `die Regatta des Tages schließt in ${hours} Std., um Mitternacht UTC.`, `günün yarışı ${hours} saat sonra, gece yarısı UTC’de kapanır.`, `la régate du jour ferme dans ${hours} h, à minuit UTC.`, `la regata del giorno chiude tra ${hours} h, a mezzanotte UTC.`, `a regata do dia fecha em ${hours} h, à meia-noite UTC.`)];
  const mine = i.log?.d[today];
  if (!i.signed) out.push({ kind: 'sign_in', href: '/sign-in?next=%2F', act: t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar'),
    title: t('Keep your times on every device', 'Сохрани время на всех устройствах', 'Guarda tus tiempos en todos tus dispositivos', 'Behalte deine Zeiten auf jedem Gerät', 'Sürelerini her cihazda sakla', 'Garde tes temps sur tous tes appareils', 'Tieni i tuoi tempi su ogni dispositivo', 'Guarde seus tempos em todos os aparelhos'),
    reasons: [['fresh', t('signed in, your best time each day goes on the leaderboard and earns the month’s points.', 'со входом твоё лучшее время дня попадает в рейтинг и приносит очки месяца.', 'con sesión, tu mejor tiempo de cada día entra en la clasificación y suma puntos del mes.', 'angemeldet kommt deine beste Zeit jedes Tages auf die Rangliste und bringt Monatspunkte.', 'giriş yapınca her günün en iyi süren tabloya girer ve ayın puanlarını kazanır.', 'connecté, ton meilleur temps de chaque jour va au classement et rapporte les points du mois.', 'con l’accesso, il tuo miglior tempo di ogni giorno va in classifica e porta punti del mese.', 'conectado, seu melhor tempo de cada dia vai para a classificação e soma pontos do mês.')]] });
  if (mine == null) {
    // today's race not sailed yet: the streak at stake first, then a venue new to this sailor, then the time left
    const st = i.log ? streakOf(i.log.d, today) : null, reasons: [Reason, string][] = [];
    if (st && st.n >= 2) reasons.push(['goal', st.risk
      ? t(`you missed yesterday: finish today or your ${st.n}-day streak ends.`, `вчера пропуск: пройди сегодня, иначе серия в ${st.n} дн. прервётся.`, `ayer no navegaste: termina hoy o tu racha de ${st.n} días se acaba.`, `gestern ausgelassen: segle heute, sonst endet deine Serie von ${st.n} Tagen.`, `dün kaçırdın: bugün bitir yoksa ${st.n} günlük serin biter.`, `tu as manqué hier : finis aujourd’hui ou ta série de ${st.n} jours s’arrête.`, `ieri l’hai saltata: finisci oggi o la tua serie di ${st.n} giorni finisce.`, `você perdeu ontem: termine hoje ou sua sequência de ${st.n} dias acaba.`)
      : t(`it keeps your ${st.n}-day streak going.`, `это продлит твою серию в ${st.n} дн.`, `mantiene tu racha de ${st.n} días.`, `es hält deine Serie von ${st.n} Tagen am Leben.`, `${st.n} günlük serini sürdürür.`, `elle prolonge ta série de ${st.n} jours.`, `tiene viva la tua serie di ${st.n} giorni.`, `mantém sua sequência de ${st.n} dias.`)]);
    const pp = i.log ? passport(i.log) : null;
    if (pp && !pp.raced.has(d.venue)) reasons.push(['fresh', t(`${v} would be your ${ord(pp.n + 1)} of ${VENUES.length} venues.`, `${v} станет твоей ${pp.n + 1}-й акваторией из ${VENUES.length}.`, `${v} sería tu ${ord(pp.n + 1)} sede de ${VENUES.length}.`, `${v} wäre dein ${ord(pp.n + 1)} von ${VENUES.length} Revieren.`, `${v}, ${VENUES.length} alandan ${ord(pp.n + 1)} olur.`, `${v} serait ton ${ord(pp.n + 1)} plan d’eau sur ${VENUES.length}.`, `${v} sarebbe il tuo ${ord(pp.n + 1)} campo su ${VENUES.length}.`, `${v} seria sua ${ord(pp.n + 1)} raia de ${VENUES.length}.`)]);
    if (soon) reasons.push(closes);
    if (!reasons.length) reasons.push(['fresh', t('the same race for everyone today: your best time counts.', 'сегодня одна гонка для всех: считается твоё лучшее время.', 'hoy la misma regata para todos: cuenta tu mejor tiempo.', 'heute dieselbe Regatta für alle: deine beste Zeit zählt.', 'bugün herkes için aynı yarış: en iyi süren sayılır.', 'la même régate pour tous aujourd’hui : ton meilleur temps compte.', 'oggi la stessa regata per tutti: conta il tuo tempo migliore.', 'hoje a mesma regata para todos: vale seu melhor tempo.')]);
    out.push({ kind: 'today', href: '/play?race=today', act: t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia'),
      title: t(`Today’s race: ${v}, ${y}`, `Гонка дня: ${v}, ${y}`, `Regata del día: ${v}, ${y}`, `Regatta des Tages: ${v}, ${y}`, `Günün yarışı: ${v}, ${y}`, `Régate du jour : ${v}, ${y}`, `Regata del giorno: ${v}, ${y}`, `Regata do dia: ${v}, ${y}`), reasons });
  } else if (i.field && i.field.length > 1) {
    // sailed today: the next group up (the top ten, the podium, first) and the time that would reach it
    const place = 1 + i.field.filter((s) => s < mine - 0.05).length, n = Math.max(i.field.length, place);
    const target = place > 10 ? 10 : place > 3 ? 3 : place > 1 ? 1 : 0;
    if (target) {
      const need = i.field[target - 1], gap = Math.max(0.1, mine - need);
      out.push({ kind: 'today_better', href: '/play?race=today', act: t(`Beat ${clock(mine)}`, `Побить ${clock(mine)}`, `Mejorar ${clock(mine)}`, `${clock(mine)} schlagen`, `${clock(mine)} geç`, `Battre ${clock(mine)}`, `Battere ${clock(mine)}`, `Bater ${clock(mine)}`),
        title: target === 1
          ? t(`You’re ${ord(place)} of ${n}: first is ${gap.toFixed(1)} s away`, `Ты на ${place}-м месте из ${n}: до первого ${gap.toFixed(1)} с`, `Vas ${ord(place)} de ${n}: el primero está a ${gap.toFixed(1)} s`, `Du bist ${ord(place)} von ${n}: Platz 1 ist ${gap.toFixed(1)} s entfernt`, `${n} içinde ${ord(place)} sıradasın: birinci ${gap.toFixed(1)} sn önde`, `Tu es ${ord(place)} sur ${n} : la 1re place est à ${gap.toFixed(1)} s`, `Sei ${ord(place)} su ${n}: il primo è a ${gap.toFixed(1)} s`, `Você é ${ord(place)} de ${n}: o primeiro está a ${gap.toFixed(1)} s`)
          : t(`You’re ${ord(place)} of ${n}: the top ${target} is ${gap.toFixed(1)} s away`, `Ты на ${place}-м месте из ${n}: до топ-${target} ${gap.toFixed(1)} с`, `Vas ${ord(place)} de ${n}: el top ${target} está a ${gap.toFixed(1)} s`, `Du bist ${ord(place)} von ${n}: die Top ${target} sind ${gap.toFixed(1)} s entfernt`, `${n} içinde ${ord(place)} sıradasın: ilk ${target} ${gap.toFixed(1)} sn önde`, `Tu es ${ord(place)} sur ${n} : le top ${target} est à ${gap.toFixed(1)} s`, `Sei ${ord(place)} su ${n}: la top ${target} è a ${gap.toFixed(1)} s`, `Você é ${ord(place)} de ${n}: o top ${target} está a ${gap.toFixed(1)} s`),
        reasons: [['goal', t(`a ${clock(need)} puts you ${ord(target)}.`, `${clock(need)} — и ты на ${target}-м месте.`, `un ${clock(need)} te pone ${ord(target)}.`, `eine ${clock(need)} bringt dich auf Platz ${target}.`, `${clock(need)} seni ${ord(target)} yapar.`, `un ${clock(need)} te met ${ord(target)}.`, `un ${clock(need)} ti mette ${ord(target)}.`, `um ${clock(need)} te deixa em ${ord(target)}.`)], ...(soon ? [closes] : [])] });
    }
  }
  if (!i.signed) return out;
  // 1-on-1: someone looking now, nearest your rating; the duel hour; your next level; your first 1-on-1
  const r = i.rating, mineR = r?.rating ?? 1500;
  const near = [...i.ready].sort((a, b) => Math.abs(a.rating - mineR) - Math.abs(b.rating - mineR))[0];
  if (near) {
    const name = near.name || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador'), gap = near.rating - mineR;
    const reasons: [Reason, string][] = [['live', t(`${name} is looking for a race right now.`, `${name} ищет гонку прямо сейчас.`, `${name} busca regata ahora mismo.`, `${name} sucht gerade eine Regatta.`, `${name} şu anda yarış arıyor.`, `${name} cherche une régate en ce moment.`, `${name} cerca una regata proprio ora.`, `${name} está procurando regata agora.`)]];
    if (Math.abs(gap) <= 100) reasons.push(['close', gap === 0
      ? t('at your rating exactly.', 'ровно твой рейтинг.', 'justo tu rating.', 'genau deine Wertung.', 'tam senin reytingin.', 'pile ton classement.', 'esattamente il tuo rating.', 'exatamente seu rating.')
      : gap > 0 ? t(`${gap} above your rating.`, `на ${gap} выше твоего рейтинга.`, `${gap} por encima de tu rating.`, `${gap} über deiner Wertung.`, `reytinginden ${gap} yukarıda.`, `${gap} au-dessus de ton classement.`, `${gap} sopra il tuo rating.`, `${gap} acima do seu rating.`)
        : t(`${-gap} below your rating.`, `на ${-gap} ниже твоего рейтинга.`, `${-gap} por debajo de tu rating.`, `${-gap} unter deiner Wertung.`, `reytinginden ${-gap} aşağıda.`, `${-gap} en dessous de ton classement.`, `${-gap} sotto il tuo rating.`, `${-gap} abaixo do seu rating.`)]);
    out.push({ kind: 'ready', href: `/duel?challenge=${near.handle}`, act: t(`Race ${name}`, `Гонка: ${name}`, `Regatear con ${name}`, `Gegen ${name} segeln`, `${name} ile yarış`, `Défier ${name}`, `Sfida ${name}`, `Desafiar ${name}`),
      title: t(`${name} is ready for a race`, `${name} ждёт соперника`, `${name} espera rival`, `${name} ist bereit für eine Regatta`, `${name} yarışa hazır`, `${name} attend un adversaire`, `${name} aspetta un avversario`, `${name} espera um rival`), reasons });
  }
  if (i.hour) {
    const startIn = (() => { const d0 = new Date(i.now), s = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate(), 19); return i.now < s + H ? s - i.now : s + 24 * H - i.now; })();
    const on = startIn <= 0, withinTwo = startIn > 0 && startIn <= 2 * H;
    if (on || startIn <= 3 * H) {
      const reasons: [Reason, string][] = [];
      if (on) reasons.push(['live', t(`it’s on now: ${i.hour.in} said they’re in.`, `час идёт: записались ${i.hour.in}.`, `está en marcha: ${i.hour.in} apuntados.`, `sie läuft: ${i.hour.in} sind dabei.`, `şu an sürüyor: ${i.hour.in} kişi katılıyor.`, `elle a lieu : ${i.hour.in} inscrits.`, `è in corso: ${i.hour.in} iscritti.`, `está acontecendo: ${i.hour.in} confirmados.`)]);
      if (i.hour.near) reasons.push(['close', t(`${i.hour.near} of those in are near your rating.`, `${i.hour.near} из записавшихся — твоего уровня.`, `${i.hour.near} de los apuntados son de tu nivel.`, `${i.hour.near} der Angemeldeten sind auf deinem Niveau.`, `katılanlardan ${i.hour.near} kişi senin seviyende.`, `${i.hour.near} des inscrits sont à ton niveau.`, `${i.hour.near} degli iscritti sono al tuo livello.`, `${i.hour.near} dos confirmados são do seu nível.`)]);
      if (withinTwo) reasons.push(['soon', t(`it starts in ${Math.max(1, Math.round(startIn / 60000))} minutes.`, `начнётся через ${Math.max(1, Math.round(startIn / 60000))} мин.`, `empieza en ${Math.max(1, Math.round(startIn / 60000))} minutos.`, `sie beginnt in ${Math.max(1, Math.round(startIn / 60000))} Minuten.`, `${Math.max(1, Math.round(startIn / 60000))} dakika sonra başlıyor.`, `elle commence dans ${Math.max(1, Math.round(startIn / 60000))} minutes.`, `inizia tra ${Math.max(1, Math.round(startIn / 60000))} minuti.`, `começa em ${Math.max(1, Math.round(startIn / 60000))} minutos.`)]);
      if (!reasons.length) reasons.push(['fresh', t('an hour of 1-on-1s, with someone at your level.', 'час гонок 1 на 1 с соперниками твоего уровня.', 'una hora de 1 contra 1, con alguien de tu nivel.', 'eine Stunde 1 gegen 1, mit jemandem auf deinem Niveau.', 'seviyende biriyle bir saatlik bire bir.', 'une heure de duels, avec quelqu’un à ton niveau.', 'un’ora di 1 contro 1, con qualcuno al tuo livello.', 'uma hora de duelos, com alguém do seu nível.')]);
      out.push({ kind: 'hour', href: '/duel', act: on ? t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata') : i.hour.me ? t('See who’s in', 'Кто записался', 'Ver quién va', 'Wer dabei ist', 'Kimler var', 'Voir les inscrits', 'Vedi chi c’è', 'Ver quem vai') : t('I’m in', 'Я в деле', 'Me apunto', 'Ich bin dabei', 'Katılıyorum', 'J’en suis', 'Ci sono', 'Estou dentro'),
        title: on ? t('The duel hour is on', 'Час дуэлей идёт', 'La hora de duelos está en marcha', 'Die Duell-Stunde läuft', 'Düello saati sürüyor', 'L’heure des duels a commencé', 'L’ora dei duelli è in corso', 'A hora dos duelos começou') : t(`Duel hour at 19:00 UTC: ${i.hour.in} are in`, `Час дуэлей в 19:00 UTC: записались ${i.hour.in}`, `Hora de duelos a las 19:00 UTC: ${i.hour.in} apuntados`, `Duell-Stunde um 19:00 UTC: ${i.hour.in} dabei`, `Düello saati 19:00 UTC’de: ${i.hour.in} katılıyor`, `Heure des duels à 19:00 UTC : ${i.hour.in} inscrits`, `Ora dei duelli alle 19:00 UTC: ${i.hour.in} iscritti`, `Hora dos duelos às 19:00 UTC: ${i.hour.in} confirmados`), reasons });
    }
  }
  if (r && r.races && !provisional(r.races)) {
    const nx = nextLevel(r.rating);
    if (nx && nx.to <= 50) out.push({ kind: 'level', href: '/duel', act: t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata'),
      title: t(`${nx.to} to ${levelName(nx.level.min, 'en')}`, `${nx.to} до уровня «${levelName(nx.level.min, 'ru')}»`, `${nx.to} para ${levelName(nx.level.min, 'es')}`, `${nx.to} bis ${levelName(nx.level.min, 'de')}`, `${levelName(nx.level.min, 'tr')} için ${nx.to}`, `${nx.to} jusqu’à ${levelName(nx.level.min, 'fr')}`, `${nx.to} per ${levelName(nx.level.min, 'it')}`, `${nx.to} até ${levelName(nx.level.min, 'pt')}`),
      reasons: [['goal', t(`about ${Math.max(1, Math.ceil(nx.to / 16))} win(s) against sailors at your level.`, `примерно ${Math.max(1, Math.ceil(nx.to / 16))} побед(ы) над соперниками твоего уровня.`, `unas ${Math.max(1, Math.ceil(nx.to / 16))} victorias contra gente de tu nivel.`, `etwa ${Math.max(1, Math.ceil(nx.to / 16))} Siege gegen Segler auf deinem Niveau.`, `seviyendeki denizcilere karşı yaklaşık ${Math.max(1, Math.ceil(nx.to / 16))} galibiyet.`, `environ ${Math.max(1, Math.ceil(nx.to / 16))} victoire(s) contre des régatiers de ton niveau.`, `circa ${Math.max(1, Math.ceil(nx.to / 16))} vittorie contro velisti del tuo livello.`, `cerca de ${Math.max(1, Math.ceil(nx.to / 16))} vitórias contra velejadores do seu nível.`)]] });
  }
  if (!r || !r.races) out.push({ kind: 'first_duel', href: '/duel', act: t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata'),
    title: t('Race someone at your level', 'Гонка с соперником твоего уровня', 'Regatea con alguien de tu nivel', 'Segle gegen jemanden auf deinem Niveau', 'Seviyende biriyle yarış', 'Affronte quelqu’un à ton niveau', 'Sfida qualcuno al tuo livello', 'Regateie com alguém do seu nível'),
    reasons: [['fresh', t('live, one rival, the same course; your first three are easy ones.', 'вживую, один соперник, одна дистанция; первые три — лёгкие.', 'en vivo, un rival, el mismo recorrido; tus tres primeras son fáciles.', 'live, ein Gegner, dieselbe Bahn; deine ersten drei sind leicht.', 'canlı, tek rakip, aynı parkur; ilk üçün kolay.', 'en direct, un rival, le même parcours ; tes trois premières sont faciles.', 'dal vivo, un rivale, lo stesso percorso; le prime tre sono facili.', 'ao vivo, um rival, o mesmo percurso; as três primeiras são fáceis.')]] });
  // an achievement half done or more: the nearest
  if (i.achievements) {
    const had = new Set(i.achievements.got.map((g) => g.key));
    const best = ACHIEVEMENTS.map((a) => ({ a, p: i.achievements!.progress[a.key] })).filter((x) => !had.has(x.a.key) && x.p && x.p[0] / x.p[1] >= 0.5 && x.p[0] < x.p[1])
      .sort((x, y) => y.p![0] / y.p![1] - x.p![0] / x.p![1])[0];
    if (best) {
      const left = best.p![1] - best.p![0], name = pick(best.a.name, lang);
      out.push({ kind: 'goal', href: best.a.kind === 'duel' ? '/duel' : '/play?race=today', act: best.a.kind === 'duel' ? t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Achar uma regata') : t('Sail today’s race', 'Пройти гонку дня', 'Navega la regata del día', 'Regatta des Tages segeln', 'Günün yarışına çık', 'Courir la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia'),
        title: t(`${left} more for “${name}”`, `Ещё ${left} до «${name}»`, `${left} más para «${name}»`, `Noch ${left} bis „${name}“`, `“${name}” için ${left} kaldı`, `Encore ${left} pour « ${name} »`, `Ancora ${left} per «${name}»`, `Faltam ${left} para “${name}”`),
        reasons: [['goal', `${pick(best.a.how, lang)} ${best.p![0]} / ${best.p![1]}.`]] });
    }
  }
  return out;
}

// scored and filtered: each card's reasons multiplied, the sailor's weight for its kind, ×0.5 when it has gone stale;
// held-out kinds left out; three at most, one of a group, best first; its "Why" the reason that scored highest
export function suggest(i: Inputs, lang: Lang, s: State | null): Card[] {
  const out = new Set(s?.out ?? []), stale = new Set(s?.stale ?? []);
  const scored = gather(i, lang).filter((c) => !out.has(c.kind)).map((c) => {
    const factors: number[] = c.reasons.map(([r]) => FACTOR[r]);
    const top = c.reasons.reduce((a, b) => (FACTOR[b[0]] > FACTOR[a[0]] ? b : a));
    const score = factors.reduce((a, b) => a * b, 1) * (s?.weights[c.kind] ?? 1) * (stale.has(c.kind) ? FACTOR.stale : 1);
    return { kind: c.kind, title: c.title, why: top[1], act: c.act, href: c.href, live: c.reasons.some(([r]) => r === 'live'), score };
  }).sort((a, b) => b.score - a.score);
  const groups = new Set<string>(), picked: Card[] = [];
  for (const c of scored) { if (picked.length >= 3 || groups.has(GROUP[c.kind])) continue; groups.add(GROUP[c.kind]); picked.push(c); }
  return picked;
}

// the database's state, checked
export function parseState(j: unknown): State | null {
  const o = j as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const w = o.weights && typeof o.weights === 'object' ? (o.weights as Record<string, unknown>) : {};
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []);
  return { weights: Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => [k, v as number])), out: list(o.out), stale: list(o.stale) };
}

// a guest's state, kept on this device: the same steps as the database's (a tap ×1.1 up to 3, × ×0.8 and out a week,
// fewer ×0.5 and out a week, down to 0.2)
export type Local = { w: Record<string, number>; out: Record<string, number> };
export function markLocal(l: Local, ev: 'tap' | 'dismiss' | 'fewer', kind: string, now = Date.now()): Local {
  const w = l.w[kind] ?? 1, next: Local = { w: { ...l.w }, out: { ...l.out } };
  next.w[kind] = ev === 'tap' ? Math.min(3, w * 1.1) : Math.max(0.2, w * (ev === 'dismiss' ? 0.8 : 0.5));
  if (ev !== 'tap') next.out[kind] = now + 7 * 24 * H;
  return next;
}
export const localState = (l: Local, now = Date.now()): State => ({ weights: l.w, out: Object.entries(l.out).filter(([, t]) => t > now).map(([k]) => k), stale: [] });
