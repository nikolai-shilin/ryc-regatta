import { LOCALE, isLang, ruPlural, tx, type Lang, type T } from '@/lib/lang';
import { dailyRace } from '@/lib/race';
import { YACHTS, yachtOf } from '@/lib/yachts';
import { VENUES, venueOf } from '@/lib/venues';
import { DRILLS, LEVELS } from '@/lib/drills';
import { GUIDES, guide, guideNo, isGuide, type GuideSlug } from '@/lib/guides';
import { glossaryGroups } from '@/lib/glossary';
import { rulebook, ruleCount } from '@/lib/rulebook';
import { faqGroups } from '@/lib/faq';
import { CHANNELS } from '@/lib/social';
import { IYT_TOTAL } from '@/lib/iyt';
import { getRating, todayUtc, validDay } from '@/lib/rating';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';
import { clock } from '@/lib/clock';
import { parseCode } from '@/lib/code';
import { card, C, type Bg } from '@/lib/og';

// /og/page/<key>?lang=ru — the share card of a page that has no race or passport of its own, in the logo's look
// (lib/og.tsx) over a picture of the game that suits it: what the page is, and the one thing about it worth a link (a
// guide's name, the day's winning time, a player's name, how many yachts…). The page names it in its metadata
// (lib/seo.ts pageMeta's card). An unknown key gets the site's own picture.
type Q = URLSearchParams;
type Built = Parameters<typeof card>[0];
type Build = (t: T, lang: Lang, q: Q) => Promise<Built | null> | Built | null;

const num = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang]);
const dayLabel = (day: string, lang: Lang) => new Date(day + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
const learn = (t: T) => t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen');
// the picture behind each guide: what it teaches, as the game shows it
const GUIDE_BG: Record<GuideSlug, Bg> = { sail: 'wind', tack: 'helm', rules: 'fleet', start: 'start', shifts: 'wind', marks: 'aerial', downwind: 'fleet', trim: 'trim' };

const CARDS: Record<string, Build> = {
  learn: (t) => ({
    bg: 'aerial', kind: t(`${GUIDES.length} short guides and a glossary`, `${GUIDES.length} коротких пособий и словарь`, `${GUIDES.length} guías breves y un glosario`, `${GUIDES.length} kurze Anleitungen und ein Glossar`),
    hero: { label: t('Sailboat racing, step by step', 'Парусные гонки шаг за шагом', 'Regatas a vela, paso a paso', 'Segelregatten, Schritt für Schritt'), value: learn(t), wrap: true },
    call: t('Read, then race', 'Читай и гоняйся', 'Lee, luego compite', 'Lesen, dann segeln'),
  }),
  guide: (t, lang, q) => {
    const slug = q.get('g') || '';
    if (!isGuide(slug)) return null;
    const g = guide(slug, t, lang);
    return {
      bg: GUIDE_BG[slug], kind: `${learn(t)} · ${t(`Guide ${guideNo(slug)} of ${GUIDES.length}`, `Пособие ${guideNo(slug)} из ${GUIDES.length}`, `Guía ${guideNo(slug)} de ${GUIDES.length}`, `Anleitung ${guideNo(slug)} von ${GUIDES.length}`)}`,
      hero: { label: g.kicker.split(' · ')[1] || t('Guide', 'Пособие', 'Guía', 'Anleitung'), value: g.short, wrap: true },
      call: t('Read the guide', 'Читать пособие', 'Lee la guía', 'Die Anleitung lesen'),
    };
  },
  glossary: (t) => {
    const n = glossaryGroups(t).reduce((a, g) => a + g.terms.length, 0);
    return {
      bg: 'wind', kind: `${learn(t)} · ${t('Glossary', 'Словарь', 'Glosario', 'Glossar')}`,
      hero: { label: t('The words of sailboat racing', 'Слова парусных гонок', 'Las palabras de las regatas a vela', 'Die Wörter des Segelregattasports'), value: t(`${n} terms`, `${n} ${ruPlural(n, ['термин', 'термина', 'терминов'])}`, `${n} términos`, `${n} Begriffe`) },
      call: t('Look a word up', 'Найди слово', 'Busca una palabra', 'Ein Wort nachschlagen'),
    };
  },
  rulebook: (t) => {
    const n = ruleCount(rulebook(t));
    return {
      bg: 'fleet', kind: t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln'),
      hero: { label: t('The Racing Rules of Sailing in plain words', 'Правила парусных гонок простыми словами', 'El Reglamento de Regatas a Vela en palabras llanas', 'Die Wettfahrtregeln Segeln in einfachen Worten'), value: t(`${n} rules`, `${n} ${ruPlural(n, ['правило', 'правила', 'правил'])}`, `${n} reglas`, `${n} Regeln`) },
      call: t('Look a rule up', 'Найди правило', 'Busca una regla', 'Eine Regel nachschlagen'),
    };
  },
  yachts: (t) => {
    const len = (y: (typeof YACHTS)[number]) => parseFloat(y.specs.find((s) => s.k[0] === 'Length')!.v[0]);
    const ys = YACHTS.slice().sort((a, b) => len(b) - len(a));
    return {
      bg: 'fleet', kind: t('The yachts', 'Яхты', 'Los yates', 'Die Yachten'),
      hero: { label: t(`From the ${t(...ys[ys.length - 1].name)} to the ${t(...ys[0].name)}`, `От ${t(...ys[ys.length - 1].name)} до ${t(...ys[0].name)}`, `Del ${t(...ys[ys.length - 1].name)} al ${t(...ys[0].name)}`, `Vom ${t(...ys[ys.length - 1].name)} bis zum ${t(...ys[0].name)}`), value: t(`${ys.length} yachts`, `${ys.length} яхт`, `${ys.length} yates`, `${ys.length} Yachten`) },
      call: t('Pick your yacht', 'Выбери яхту', 'Elige tu yate', 'Wähle deine Yacht'),
    };
  },
  // a day's rating (today's without ?day): the winner and their time
  rating: async (t, lang, q) => {
    const today = todayUtc(), want = q.get('day'), day = want && validDay(want) ? want : today, live = day === today;
    const r = await getRating(day);
    const d = dailyRace(new Date(day + 'T12:00:00Z'));
    const first = (r?.rows || []).slice().sort((a, b) => a.s - b.s)[0];
    return {
      bg: 'fleet', kind: `${live ? t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute') : t('Leaderboard', 'Рейтинг', 'Clasificación', 'Rangliste')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
      tag: { text: dayLabel(day, lang), live },
      hero: first
        ? { label: t(`First · ${first.name || 'a sailor'}`, `Первое место · ${first.name || 'гонщик'}`, `Primero · ${first.name || 'un regatista'}`, `Erster · ${first.name || 'ein Segler'}`), value: clock(first.s), color: C.gold, plate: { text: t('1st', '1', '1.º', '1.'), bg: C.gold } }
        : { label: t('No time yet', 'Пока никто не финишировал', 'Aún sin tiempo', 'Noch keine Zeit'), value: t('Be first', 'Будь первым', 'Sé el primero', 'Sei der Erste') },
      call: live ? t('Beat the time', 'Побей время', 'Bate el tiempo', 'Die Zeit schlagen') : t('See the leaderboard', 'Смотри рейтинг', 'Ver la clasificación', 'Zur Rangliste'),
    };
  },
  players: async (t, lang) => {
    const l = await getPlayers(1);
    return {
      bg: 'helm', kind: t('The players', 'Игроки', 'Los jugadores', 'Die Spieler'),
      hero: l && l.total ? { label: t('Sailors racing signed in', 'Гонщики с аккаунтом', 'Regatistas con sesión iniciada', 'Angemeldete Segler'), value: num(l.total, lang), color: C.gold } : { label: t('Everyone who races', 'Все, кто гоняется', 'Todos los que compiten', 'Alle, die segeln'), value: t('The players', 'Игроки', 'Los jugadores', 'Die Spieler'), wrap: true },
      call: t('Join them', 'Присоединяйся', 'Únete', 'Mach mit'),
    };
  },
  // one player: their name, and their points and wins
  player: async (t, lang, q) => {
    const k = q.get('p') || '';
    const p = KEY_RE.test(k) ? await getPlayer(k) : null;
    if (!p) return CARDS.players(t, lang, q);
    const pts = t(`${num(p.pts, lang)} points`, `${num(p.pts, lang)} ${ruPlural(p.pts, ['очко', 'очка', 'очков'])}`, `${num(p.pts, lang)} ${p.pts === 1 ? 'punto' : 'puntos'}`, `${num(p.pts, lang)} Punkte`);
    const wins = p.wins ? t(`${p.wins} ${p.wins === 1 ? 'win' : 'wins'}`, `${p.wins} ${ruPlural(p.wins, ['победа', 'победы', 'побед'])}`, `${p.wins} ${p.wins === 1 ? 'victoria' : 'victorias'}`, `${p.wins} ${p.wins === 1 ? 'Sieg' : 'Siege'}`) : '';
    return {
      bg: 'helm', kind: t('Player card', 'Карточка игрока', 'Tarjeta de jugador', 'Spielerkarte'),
      hero: { label: [pts, wins].filter(Boolean).join(' · '), value: p.name || t('A sailor', 'Гонщик', 'Un regatista', 'Ein Segler'), wrap: true },
      call: t('Race them', 'Обгони', 'Rétalos', 'Segle gegen sie'),
    };
  },
  drills: (t) => ({
    bg: 'start', kind: t('Drills', 'Тренировки', 'Ejercicios', 'Übungen'),
    hero: { label: t(`${LEVELS.length} levels, beginner to expert`, `${LEVELS.length} уровня, от новичка до эксперта`, `${LEVELS.length} niveles, de principiante a experto`, `${LEVELS.length} Stufen, vom Anfänger bis zum Experten`), value: t(`${DRILLS.length} drills`, `${DRILLS.length} ${ruPlural(DRILLS.length, ['тренировка', 'тренировки', 'тренировок'])}`, `${DRILLS.length} ejercicios`, `${DRILLS.length} Übungen`) },
    call: t('Start a drill', 'Начни тренировку', 'Empezar un ejercicio', 'Eine Übung starten'),
  }),
  free: (t) => ({
    bg: 'drone', kind: t(`${VENUES.length} venues · ${YACHTS.length} yachts`, `${VENUES.length} ${ruPlural(VENUES.length, ['акватория', 'акватории', 'акваторий'])} · ${YACHTS.length} яхт`, `${VENUES.length} sedes · ${YACHTS.length} yates`, `${VENUES.length} Reviere · ${YACHTS.length} Yachten`),
    hero: { label: t('Your venue, your yacht, your wind', 'Твоя акватория, твоя яхта, твой ветер', 'Tu sede, tu yate, tu viento', 'Dein Revier, deine Yacht, dein Wind'), value: t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta'), wrap: true },
    call: t('Set up a race', 'Настрой гонку', 'Preparar una regata', 'Eine Regatta einrichten'),
  }),
  // a 1-on-1 race: the host's venue and boat, its code on the tag
  match: (t, _lang, q) => {
    const code = parseCode(q.get('c') || '');
    const v = venueOf(q.get('v') || undefined), y = yachtOf(q.get('b'));
    return {
      bg: 'drone', kind: `${t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta')} · ${t(...v.name)} · ${t(...y.name)}`,
      ...(code ? { tag: { text: code } } : {}),
      hero: { label: t('You and a friend, one on one', 'Вы и друг, один на один', 'Tú y un amigo, uno contra uno', 'Du und ein Freund, eins gegen eins'), value: t('Race me', 'Сыграем', 'Rétame', 'Segle gegen mich'), color: C.gold },
      call: t('Join the race', 'Войти в гонку', 'Unirse a la regata', 'An der Regatta teilnehmen'),
    };
  },
  iyt: (t, lang) => ({
    bg: 'helm', kind: 'Sailing Certification Test',
    hero: { label: t('Questions, VHF to Yachtmaster Ocean', 'Вопросов, от VHF до Yachtmaster Ocean', 'Preguntas, de VHF a Yachtmaster Ocean', 'Fragen, von VHF bis Yachtmaster Ocean'), value: num(IYT_TOTAL, lang), color: C.gold },
    call: t('Practise free', 'Тренируйся бесплатно', 'Practica gratis', 'Kostenlos üben'),
  }),
  help: (t) => ({
    bg: 'trim', kind: t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du'),
    hero: { label: t('Steer, trim, tack and win the start', 'Руль, паруса, поворот и старт', 'Gobierna, trima, vira y gana la salida', 'Steuern, trimmen, wenden und den Start gewinnen'), value: t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du'), wrap: true },
    call: t('Learn the boat', 'Освой лодку', 'Aprende el barco', 'Das Boot kennenlernen'),
  }),
  faq: (t) => {
    const n = faqGroups(t).reduce((a, g) => a + g.items.length, 0);
    return {
      bg: 'drone', kind: t('FAQ', 'Вопросы и ответы', 'Preguntas', 'FAQ'),
      hero: { label: t('About the game, the race and the rules', 'Об игре, гонке и правилах', 'Sobre el juego, la regata y las reglas', 'Über das Spiel, die Regatta und die Regeln'), value: t(`${n} answers`, `${n} ${ruPlural(n, ['ответ', 'ответа', 'ответов'])}`, `${n} respuestas`, `${n} Antworten`) },
      call: t('Find the answer', 'Найди ответ', 'Encuentra la respuesta', 'Die Antwort finden'),
    };
  },
  social: (t) => {
    const ch = CHANNELS[0];
    return {
      bg: 'fleet', kind: t('Social media', 'Соцсети', 'Redes sociales', 'Soziale Medien'),
      hero: { label: t(`On ${ch.name}`, `В ${ch.name}`, `En ${ch.name}`, `Auf ${ch.name}`), value: ch.handle, wrap: true },
      call: t('Follow', 'Подписаться', 'Seguir', 'Folgen'),
    };
  },
  sponsorship: (t) => ({
    bg: 'fleet', kind: t('Sponsorship', 'Спонсорство', 'Patrocinio', 'Sponsoring'),
    hero: { label: t('On the sails and over the course', 'На парусах и над дистанцией', 'En las velas y sobre el recorrido', 'Auf den Segeln und über der Bahn'), value: t('Your brand in the race', 'Ваш бренд в гонке', 'Tu marca en la regata', 'Deine Marke in der Regatta'), wrap: true },
    call: t('See the options', 'Посмотреть варианты', 'Ver las opciones', 'Die Optionen ansehen'),
  }),
  boat: (t) => ({
    bg: 'drone', kind: t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht'),
    hero: { label: t('Hull, sails, flag and number', 'Корпус, паруса, флаг и номер', 'Casco, velas, bandera y número', 'Rumpf, Segel, Flagge und Nummer'), value: t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht'), wrap: true },
    call: t('Paint your yacht', 'Раскрась яхту', 'Pinta tu yate', 'Deine Yacht bemalen'),
  }),
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = new URL(request.url).searchParams;
  const ql = q.get('lang'), lang: Lang = isLang(ql) ? ql : 'en';
  const build = Object.hasOwn(CARDS, key) ? CARDS[key] : null; // (not the names every object has: /og/page/constructor)
  const c = build ? await build(tx(lang), lang, q) : null;
  if (!c) return new Response(null, { status: 302, headers: { location: '/images/og-v9.jpg', 'cache-control': 'public, max-age=60' } });
  const img = await card(c);
  // the rating and the players move through the day; the rest only with a deploy
  const live = key === 'rating' || key === 'players' || key === 'player';
  img.headers.set('cache-control', live ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return img;
}
