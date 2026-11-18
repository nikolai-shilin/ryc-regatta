import { isLang, ruPlural, tx, type Lang, type T } from '@/lib/lang';
import { dailyRace } from '@/lib/race';
import { YACHTS, yachtOf } from '@/lib/yachts';
import { VENUES, venueOf } from '@/lib/venues';
import { DRILLS, LEVELS } from '@/lib/drills';
import { GUIDES, guide, guideNo, isGuide, type GuideSlug } from '@/lib/guides';
import { glossaryGroups } from '@/lib/glossary';
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

const num = (n: number, lang: Lang) => n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB');
const dayLabel = (day: string, lang: Lang) => new Date(day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
const learn = (t: T) => t('Learn to race', 'Учись гоняться');
// the picture behind each guide: what it teaches, as the game shows it
const GUIDE_BG: Record<GuideSlug, Bg> = { sail: 'wind', tack: 'helm', rules: 'fleet', start: 'start', shifts: 'wind', marks: 'aerial', downwind: 'fleet', trim: 'trim' };

const CARDS: Record<string, Build> = {
  learn: (t) => ({
    bg: 'aerial', kind: t(`${GUIDES.length} short guides and a glossary`, `${GUIDES.length} коротких пособий и словарь`),
    hero: { label: t('Sailboat racing, step by step', 'Парусные гонки шаг за шагом'), value: learn(t), wrap: true },
    call: t('Read, then race', 'Читай и гоняйся'),
  }),
  guide: (t, lang, q) => {
    const slug = q.get('g') || '';
    if (!isGuide(slug)) return null;
    const g = guide(slug, t, lang);
    return {
      bg: GUIDE_BG[slug], kind: `${learn(t)} · ${t(`Guide ${guideNo(slug)} of ${GUIDES.length}`, `Пособие ${guideNo(slug)} из ${GUIDES.length}`)}`,
      hero: { label: g.kicker.split(' · ')[1] || t('Guide', 'Пособие'), value: g.short, wrap: true },
      call: t('Read the guide', 'Читать пособие'),
    };
  },
  glossary: (t) => {
    const n = glossaryGroups(t).reduce((a, g) => a + g.terms.length, 0);
    return {
      bg: 'wind', kind: `${learn(t)} · ${t('Glossary', 'Словарь')}`,
      hero: { label: t('The words of sailboat racing', 'Слова парусных гонок'), value: t(`${n} terms`, `${n} ${ruPlural(n, ['термин', 'термина', 'терминов'])}`) },
      call: t('Look a word up', 'Найди слово'),
    };
  },
  yachts: (t) => {
    const len = (y: (typeof YACHTS)[number]) => parseFloat(y.specs.find((s) => s.k[0] === 'Length')!.v[0]);
    const ys = YACHTS.slice().sort((a, b) => len(b) - len(a));
    return {
      bg: 'fleet', kind: t('The yachts', 'Яхты'),
      hero: { label: t(`From the ${t(...ys[ys.length - 1].name)} to the ${t(...ys[0].name)}`, `От ${t(...ys[ys.length - 1].name)} до ${t(...ys[0].name)}`), value: t(`${ys.length} yachts`, `${ys.length} яхт`) },
      call: t('Pick your yacht', 'Выбери яхту'),
    };
  },
  // a day's rating (today's without ?day): the winner and their time
  rating: async (t, lang, q) => {
    const today = todayUtc(), want = q.get('day'), day = want && validDay(want) ? want : today, live = day === today;
    const r = await getRating(day);
    const d = dailyRace(new Date(day + 'T12:00:00Z'));
    const first = (r?.rows || []).slice().sort((a, b) => a.s - b.s)[0];
    return {
      bg: 'fleet', kind: `${live ? t('Today’s rating', 'Рейтинг дня') : t('Rating', 'Рейтинг')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
      tag: { text: dayLabel(day, lang), live },
      hero: first
        ? { label: t(`First · ${first.name || 'a sailor'}`, `Первое место · ${first.name || 'гонщик'}`), value: clock(first.s), color: C.gold, plate: { text: t('1st', '1'), bg: C.gold } }
        : { label: t('No time yet', 'Пока никто не финишировал'), value: t('Be first', 'Будь первым') },
      call: live ? t('Beat the time', 'Побей время') : t('See the rating', 'Смотри рейтинг'),
    };
  },
  players: async (t, lang) => {
    const l = await getPlayers(1);
    return {
      bg: 'helm', kind: t('The players', 'Игроки'),
      hero: l && l.total ? { label: t('Sailors racing signed in', 'Гонщики с аккаунтом'), value: num(l.total, lang), color: C.gold } : { label: t('Everyone who races', 'Все, кто гоняется'), value: t('The players', 'Игроки'), wrap: true },
      call: t('Join them', 'Присоединяйся'),
    };
  },
  // one player: their name, and their points and wins
  player: async (t, lang, q) => {
    const k = q.get('p') || '';
    const p = KEY_RE.test(k) ? await getPlayer(k) : null;
    if (!p) return CARDS.players(t, lang, q);
    const pts = t(`${num(p.pts, lang)} points`, `${num(p.pts, lang)} ${ruPlural(p.pts, ['очко', 'очка', 'очков'])}`);
    const wins = p.wins ? t(`${p.wins} ${p.wins === 1 ? 'win' : 'wins'}`, `${p.wins} ${ruPlural(p.wins, ['победа', 'победы', 'побед'])}`) : '';
    return {
      bg: 'helm', kind: t('Player card', 'Карточка игрока'),
      hero: { label: [pts, wins].filter(Boolean).join(' · '), value: p.name || t('A sailor', 'Гонщик'), wrap: true },
      call: t('Race them', 'Обгони'),
    };
  },
  drills: (t) => ({
    bg: 'start', kind: t('Drills', 'Тренировки'),
    hero: { label: t(`${LEVELS.length} levels, beginner to expert`, `${LEVELS.length} уровня, от новичка до эксперта`), value: t(`${DRILLS.length} drills`, `${DRILLS.length} ${ruPlural(DRILLS.length, ['тренировка', 'тренировки', 'тренировок'])}`) },
    call: t('Start a drill', 'Начни тренировку'),
  }),
  free: (t) => ({
    bg: 'drone', kind: t(`${VENUES.length} venues · ${YACHTS.length} yachts`, `${VENUES.length} ${ruPlural(VENUES.length, ['акватория', 'акватории', 'акваторий'])} · ${YACHTS.length} яхт`),
    hero: { label: t('Your venue, your yacht, your wind', 'Твоя акватория, твоя яхта, твой ветер'), value: t('Free race', 'Свободная гонка'), wrap: true },
    call: t('Set up a race', 'Настрой гонку'),
  }),
  // a 1-on-1 race: the host's venue and boat, its code on the tag
  match: (t, _lang, q) => {
    const code = parseCode(q.get('c') || '');
    const v = venueOf(q.get('v') || undefined), y = yachtOf(q.get('b'));
    return {
      bg: 'drone', kind: `${t('1-on-1 race', 'Гонка один на один')} · ${t(...v.name)} · ${t(...y.name)}`,
      ...(code ? { tag: { text: code } } : {}),
      hero: { label: t('You and a friend, one on one', 'Вы и друг, один на один'), value: t('Race me', 'Сыграем'), color: C.gold },
      call: t('Join the race', 'Войти в гонку'),
    };
  },
  iyt: (t, lang) => ({
    bg: 'helm', kind: 'Sailing Certification Test',
    hero: { label: t('Questions, VHF to Yachtmaster Ocean', 'Вопросов, от VHF до Yachtmaster Ocean'), value: num(IYT_TOTAL, lang), color: C.gold },
    call: t('Practise free', 'Тренируйся бесплатно'),
  }),
  help: (t) => ({
    bg: 'trim', kind: t('How to play', 'Как играть'),
    hero: { label: t('Steer, trim, tack and win the start', 'Руль, паруса, поворот и старт'), value: t('How to play', 'Как играть'), wrap: true },
    call: t('Learn the boat', 'Освой лодку'),
  }),
  faq: (t) => {
    const n = faqGroups(t).reduce((a, g) => a + g.items.length, 0);
    return {
      bg: 'drone', kind: t('Questions', 'Вопросы'),
      hero: { label: t('About the game, the race and the rules', 'Об игре, гонке и правилах'), value: t(`${n} answers`, `${n} ${ruPlural(n, ['ответ', 'ответа', 'ответов'])}`) },
      call: t('Find the answer', 'Найди ответ'),
    };
  },
  social: (t) => {
    const ch = CHANNELS[0];
    return {
      bg: 'fleet', kind: t('Follow the game', 'Игра в соцсетях'),
      hero: { label: t(`On ${ch.name}`, `В ${ch.name}`), value: ch.handle, wrap: true },
      call: t('Follow', 'Подписаться'),
    };
  },
  sponsorship: (t) => ({
    bg: 'fleet', kind: t('Sponsorship', 'Спонсорство'),
    hero: { label: t('On the sails and over the course', 'На парусах и над дистанцией'), value: t('Your brand in the race', 'Ваш бренд в гонке'), wrap: true },
    call: t('See the options', 'Посмотреть варианты'),
  }),
  boat: (t) => ({
    bg: 'drone', kind: t('Your boat', 'Твоя яхта'),
    hero: { label: t('Hull, sails, flag and number', 'Корпус, паруса, флаг и номер'), value: t('Your boat', 'Твоя яхта'), wrap: true },
    call: t('Paint your boat', 'Раскрась яхту'),
  }),
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = new URL(request.url).searchParams;
  const ql = q.get('lang'), lang: Lang = isLang(ql) ? ql : 'en';
  const build = Object.hasOwn(CARDS, key) ? CARDS[key] : null; // (not the names every object has: /og/page/constructor)
  const c = build ? await build(tx(lang), lang, q) : null;
  if (!c) return new Response(null, { status: 302, headers: { location: '/images/og-v8.jpg', 'cache-control': 'public, max-age=60' } });
  const img = await card(c);
  // the rating and the players move through the day; the rest only with a deploy
  const live = key === 'rating' || key === 'players' || key === 'player';
  img.headers.set('cache-control', live ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return img;
}
