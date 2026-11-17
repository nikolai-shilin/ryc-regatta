import { isLang, ruPlural, tx, type Lang, type T } from '@/lib/lang';
import { dailyRace, plannedCourse, KN, BEAT_ANGLE, SHAPE_NAME } from '@/lib/race';
import { YACHTS, yachtOf } from '@/lib/yachts';
import { VENUES, venueOf } from '@/lib/venues';
import { BADGES, FAMS } from '@/lib/badges';
import { DRILLS, LEVELS } from '@/lib/drills';
import { GUIDES, guide, guideNo, isGuide } from '@/lib/guides';
import { glossaryGroups } from '@/lib/glossary';
import { faqGroups, HOME } from '@/lib/faq';
import { CHANNELS } from '@/lib/social';
import { IYT_LEVELS, IYT_TOTAL } from '@/lib/iyt';
import { getRating, todayUtc, validDay } from '@/lib/rating';
import { getPlayer, getPlayers, KEY_RE } from '@/lib/players';
import { parseCode } from '@/lib/code';
import { card, CourseSvg, Rows, C, PANEL, type Row } from '@/lib/og';
import { BadgePennant } from '@/components/badge-pennant';

// /og/page/<key>?lang=ru — the share card of a page that has no race or passport of its own, drawn as the race's HUD
// draws (lib/og.tsx) with what that page is about: a guide's sections, the day's top five, a player's numbers, the
// fleet by length, the drills by level… The page names it in its metadata (lib/seo.ts pageMeta's card). An unknown key
// gets the site's own picture.
type Q = URLSearchParams;
type Build = (t: T, lang: Lang, q: Q) => Promise<Parameters<typeof card>[0] | null> | Parameters<typeof card>[0] | null;

const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const num = (n: number, lang: Lang) => n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB');
const dayLabel = (day: string, lang: Lang) => new Date(day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
const place = (p: number) => ({ lead: String(p), leadBg: p === 1 ? C.gold : p <= 3 ? C.you : undefined });
const rules = / \(rules? [^)]*\)| \(правил[ао] [^)]*\)/;
const lengthOf = (y: (typeof YACHTS)[number]) => parseFloat(y.specs.find((s) => s.k[0] === 'Length')!.v[0]);

const CARDS: Record<string, Build> = {
  // Learn to race: the six guides by number
  learn: (t, lang) => {
    const gs = GUIDES.map((s) => guide(s, t, lang));
    const terms = glossaryGroups(t).reduce((a, g) => a + g.terms.length, 0);
    return {
      kind: t('Learn to race', 'Учись гоняться'),
      hero: { label: t('Short guides to sailboat racing', 'Короткие пособия по парусным гонкам'), value: t('Learn to race', 'Учись гоняться'), wrap: true },
      cells: [
        { label: t('Guides', 'Пособия'), value: gs.length },
        { label: t('Sections', 'Разделы'), value: gs.reduce((a, g) => a + g.sections.length, 0) },
        { label: t('Glossary', 'Словарь'), value: terms, unit: t('terms', ruPlural(terms, ['термин', 'термина', 'терминов'])) },
      ],
      call: t('Read, then race', 'Читай и гоняйся'),
      panel: { title: t('The guides', 'Пособия'), aside: `${gs.length}`, body: <Rows rows={gs.map((g, i) => ({ lead: String(i + 1), text: g.short }))} /> },
    };
  },
  // a guide: its name, and its sections in order
  guide: (t, lang, q) => {
    const slug = q.get('g') || '';
    if (!isGuide(slug)) return null;
    const g = guide(slug, t, lang);
    const words = g.sections.reduce((a, s) => a + s.p.join(' ').split(/\s+/).length + (s.tip || '').split(/\s+/).length, g.intro.split(/\s+/).length);
    const min = Math.max(1, Math.round(words / 200));
    const tips = g.sections.filter((s) => s.tip).length;
    return {
      kind: `${t('Learn to race', 'Учись гоняться')} · ${t(`Guide ${guideNo(slug)} of ${GUIDES.length}`, `Пособие ${guideNo(slug)} из ${GUIDES.length}`)}`,
      hero: { label: g.kicker.split(' · ')[1] || t('Guide', 'Пособие'), value: g.short, wrap: true },
      cells: [
        { label: t('Sections', 'Разделы'), value: g.sections.length },
        { label: t('Tips', 'Советы'), value: tips },
        { label: t('Reading', 'Чтение'), value: min, unit: t('min', 'мин') },
      ],
      call: t('Read the guide', 'Читать пособие'),
      panel: { title: t('In this guide', 'В пособии'), body: <Rows rows={g.sections.map((s, i) => ({ lead: String(i + 1), leadBg: s.pen ? C.live : undefined, text: s.h.replace(rules, '') }))} /> },
    };
  },
  // the glossary: its groups and how many words each
  glossary: (t) => {
    const gs = glossaryGroups(t), n = gs.reduce((a, g) => a + g.terms.length, 0), most = Math.max(...gs.map((g) => g.terms.length));
    return {
      kind: `${t('Learn to race', 'Учись гоняться')} · ${t('Glossary', 'Словарь')}`,
      hero: { label: t('The words of sailboat racing', 'Слова парусных гонок'), value: t(`${n} terms`, `${n} ${ruPlural(n, ['термин', 'термина', 'терминов'])}`) },
      cells: [
        { label: t('Groups', 'Разделы'), value: gs.length },
        { label: t('Terms', 'Термины'), value: n },
        { label: t('Linked to a guide', 'Со ссылкой на пособие'), value: gs.reduce((a, g) => a + g.terms.filter((x) => x.see).length, 0) },
      ],
      call: t('Look a word up', 'Найди слово'),
      panel: { title: t('Glossary', 'Словарь'), aside: `${n}`, body: <Rows rows={gs.map((g) => ({ text: g.title, sub: g.terms.slice(0, 4).map((x) => x.term).join(' · '), value: g.terms.length, bar: g.terms.length / most }))} /> },
    };
  },
  // the yachts, biggest first, a bar for each one's length
  yachts: (t) => {
    const ys = YACHTS.slice().sort((a, b) => lengthOf(b) - lengthOf(a)), big = lengthOf(ys[0]), small = ys[ys.length - 1];
    const fast = YACHTS.reduce((a, y) => (y.speed.down > a.speed.down ? y : a));
    return {
      kind: t('The yachts', 'Яхты'),
      hero: { label: t(`From the ${t(...small.name)} to the ${t(...ys[0].name)}`, `От ${t(...small.name)} до ${t(...ys[0].name)}`), value: t(`${ys.length} yachts`, `${ys.length} яхт`) },
      cells: [
        { label: t('Biggest', 'Самая большая'), value: big.toLocaleString('en-GB'), unit: t('m', 'м') },
        { label: t('Smallest', 'Самая маленькая'), value: lengthOf(small).toLocaleString('en-GB'), unit: t('m', 'м') },
        { label: t(`Fastest · ${t(...fast.name)}`, `Быстрее всех · ${t(...fast.name)}`), value: fast.speed.down, unit: t('kn', 'уз') },
      ],
      call: t('Pick your yacht', 'Выбери яхту'),
      panel: { title: t('By length', 'По длине'), body: <Rows rows={ys.map((y) => ({ text: t(...y.name), value: t(`${y.specs.find((s) => s.k[0] === 'Length')!.v[0]}`, y.specs.find((s) => s.k[0] === 'Length')!.v[1]), bar: Math.sqrt(lengthOf(y) / big) }))} /> },
    };
  },
  // a day's rating (today's without ?day): the winner's time, the top five
  rating: async (t, lang, q) => {
    const today = todayUtc(), want = q.get('day'), day = want && validDay(want) ? want : today, live = day === today;
    const r = await getRating(day);
    const d = dailyRace(new Date(day + 'T12:00:00Z'));
    const rows = (r?.rows || []).slice().sort((a, b) => a.s - b.s); // ranked by their best time, as the page
    const top = rows.slice(0, 5), first = top[0];
    const who = (n: string | null) => n || t('A sailor', 'Гонщик');
    return {
      kind: `${live ? t('Today’s rating', 'Рейтинг дня') : t('Rating', 'Рейтинг')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
      tag: { text: dayLabel(day, lang), live },
      hero: first
        ? { label: t(`First · ${who(first.name)}`, `Первое место · ${who(first.name)}`), value: clock(first.s), color: C.gold, plate: { text: t('1st', '1'), bg: C.gold } }
        : { label: t('No time yet', 'Пока никто не финишировал'), value: t('Be first', 'Будь первым') },
      cells: [
        { label: t('Ranked', 'В рейтинге'), value: rows.length, unit: t(rows.length === 1 ? 'sailor' : 'sailors', ruPlural(rows.length, ['гонщик', 'гонщика', 'гонщиков'])) },
        { label: t('Races', 'Гонки'), value: r?.races || 0 },
        { label: t('Wind', 'Ветер'), value: KN[d.preset], unit: t('kn', 'уз') },
      ],
      call: live ? t('Beat the time', 'Побей время') : t('See the rating', 'Смотри рейтинг'),
      panel: top.length
        ? { title: t('Top five', 'Первая пятёрка'), aside: rows.length > 5 ? t(`of ${rows.length}`, `из ${rows.length}`) : undefined, body: <Rows rows={top.map((x, i) => ({ ...place(i + 1), text: who(x.name), value: clock(x.s), valueColor: i ? undefined : C.gold }))} /> }
        : { title: t('Course', 'Дистанция'), aside: t(...SHAPE_NAME[d.course]), body: <CourseSvg course={plannedCourse(d.preset, d.length, d.fleet, d.course, yachtOf(d.yacht))} route={BEAT_ANGLE[d.preset]} wind /> },
    };
  },
  // the players: how many, the most points first
  players: async (t, lang) => {
    const l = await getPlayers(1);
    if (!l || !l.rows.length) return null;
    const top = l.rows.slice(0, 7), lead = top[0];
    return {
      kind: t('The players', 'Игроки'),
      hero: { label: t('Sailors racing signed in', 'Гонщики с аккаунтом'), value: num(l.total, lang), color: C.gold },
      cells: [
        { label: t('Most points', 'Больше всех очков'), value: num(lead.pts, lang) },
        { label: t('Most wins', 'Больше всех побед'), value: Math.max(...l.rows.map((r) => r.wins)) },
        { label: t('Most races', 'Больше всех гонок'), value: num(Math.max(...l.rows.map((r) => r.n)), lang) },
      ],
      call: t('Join them', 'Присоединяйся'),
      panel: { title: t('Most points', 'Больше всех очков'), body: <Rows rows={top.map((r, i) => ({ ...place(i + 1), text: r.name || t('A sailor', 'Гонщик'), value: num(r.pts, lang), valueColor: i ? undefined : C.gold }))} /> },
    };
  },
  // one player's card: their name, their numbers, the yachts and venues they sail most
  player: async (t, lang, q) => {
    const k = q.get('p') || '';
    const p = KEY_RE.test(k) ? await getPlayer(k) : null;
    if (!p) return CARDS.players(t, lang, q);
    const ys = p.yachts.slice(0, 3), vs = p.venues.slice(0, 3);
    const most = Math.max(1, ...ys.map((x) => x.n), ...vs.map((x) => x.n));
    const rows: Row[] = [
      ...(ys.length ? [{ head: true, text: t('Yachts', 'Яхты') }, ...ys.map((x) => ({ text: t(...yachtOf(x.id).name), value: x.n, bar: x.n / most }))] : []),
      ...(vs.length ? [{ head: true, text: t('Venues', 'Акватории') }, ...vs.map((x) => ({ text: t(...venueOf(x.id).name), value: x.n, bar: x.n / most }))] : []),
    ];
    return {
      kind: t('Player card', 'Карточка игрока'),
      hero: { label: t(`${num(p.pts, lang)} points`, `${num(p.pts, lang)} ${ruPlural(p.pts, ['очко', 'очка', 'очков'])}`), value: p.name || t('A sailor', 'Гонщик'), wrap: true },
      cells: [
        { label: t('Races', 'Гонки'), value: num(p.n, lang) },
        { label: t('Wins', 'Победы'), value: p.wins, color: p.wins ? C.gold : undefined },
        { label: t('Podiums', 'Подиумы'), value: p.podiums },
        ...(p.best != null ? [{ label: t('Best place', 'Лучшее место'), value: p.best }] : [{ label: t('Days', 'Дни'), value: p.days }]),
      ],
      call: t('Race them', 'Обгони'),
      panel: rows.length
        ? { title: t('Sails most', 'Чаще всего'), aside: t('races', 'гонки'), body: <Rows rows={rows} /> }
        : { title: t('Their yacht', 'Яхта'), aside: t(...yachtOf(p.yacht).name), body: <Rows rows={[{ text: t(...yachtOf(p.yacht).name), sub: t(...yachtOf(p.yacht).kind) }]} /> },
    };
  },
  // the drills by level, how many each and what they are
  drills: (t) => {
    const most = Math.max(...LEVELS.map((l) => DRILLS.filter((d) => d.level === l.id).length));
    return {
      kind: t('Drills', 'Тренировки'),
      hero: { label: t('Four levels, beginner to expert', 'Четыре уровня, от новичка до эксперта'), value: t(`${DRILLS.length} drills`, `${DRILLS.length} ${ruPlural(DRILLS.length, ['тренировка', 'тренировки', 'тренировок'])}`) },
      cells: [
        { label: t('Levels', 'Уровни'), value: LEVELS.length },
        { label: t('Each', 'Каждая'), value: `${Math.min(...DRILLS.map((d) => d.min))}–${Math.max(...DRILLS.map((d) => d.min))}`, unit: t('min', 'мин') },
        { label: t('Stars', 'Звёзды'), value: 3, unit: t('each', 'в каждой') },
      ],
      call: t('Start a drill', 'Начни тренировку'),
      panel: { title: t('Levels', 'Уровни'), body: <Rows rows={LEVELS.map((l, i) => {
        const ds = DRILLS.filter((d) => d.level === l.id);
        return { lead: String(i + 1), text: t(...l.name), sub: ds.map((d) => t(...d.name)).join(' · '), value: ds.length, bar: ds.length / most };
      })} /> },
    };
  },
  // the badges, all twelve lit
  badges: (t) => {
    const rows = [0, 1, 2].map((r) => BADGES.slice(r * 4, r * 4 + 4));
    return {
      kind: t('Badges', 'Достижения'),
      hero: { label: t('Earned on the water', 'Заслужено на воде'), value: t(`${BADGES.length} badges`, `${BADGES.length} ${ruPlural(BADGES.length, ['достижение', 'достижения', 'достижений'])}`), color: C.gold },
      cells: FAMS.map((f) => ({ label: t(...f.many), value: BADGES.filter((b) => b.fam === f.id).length })),
      call: t('Earn them', 'Заслужи их'),
      panel: {
        title: t('Badges', 'Достижения'), aside: `${BADGES.length}`, asideColor: C.gold,
        body: (
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-around', padding: '10px 14px 18px', width: PANEL.w }}>
            {rows.map((row, r) => (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-around' }}>
                {row.map((b) => <BadgePennant key={b.id} id={b.id} on width={88} height={97} />)}
              </div>
            ))}
          </div>
        ),
      },
    };
  },
  // the free race: what you choose
  free: (t) => {
    const shapes = Object.values(SHAPE_NAME);
    return {
      kind: t('Free race', 'Свободная гонка'),
      hero: { label: t('Your venue, your yacht, your wind', 'Твоя акватория, твоя яхта, твой ветер'), value: t('Free race', 'Свободная гонка'), wrap: true },
      cells: [
        { label: t('Venues', 'Акватории'), value: VENUES.length },
        { label: t('Yachts', 'Яхты'), value: YACHTS.length },
        { label: t('Courses', 'Дистанции'), value: shapes.length },
      ],
      call: t('Set up a race', 'Настрой гонку'),
      panel: { title: t('You choose', 'Ты выбираешь'), body: <Rows rows={[
        { text: t('Venue', 'Акватория'), sub: VENUES.slice(0, 5).map((v) => t(...v.name)).join(' · '), value: VENUES.length },
        { text: t('Yacht', 'Яхта'), sub: YACHT_LIST(t), value: YACHTS.length },
        { text: t('Wind', 'Ветер'), value: `${Object.values(KN).join(' · ')} ${t('kn', 'уз')}` },
        { text: t('Course', 'Дистанция'), sub: shapes.map((s) => t(...s)).join(' · '), value: shapes.length },
        { text: t('Fleet', 'Флот'), value: t('up to 6', 'до 6') },
      ]} /> },
    };
  },
  // a match: one on one, at the host's venue in the host's boat, on the course they'll sail
  match: (t, _lang, q) => {
    const code = parseCode(q.get('c') || '');
    const v = venueOf(q.get('v') || undefined), y = yachtOf(q.get('b'));
    return {
      kind: `${t('Match race', 'Матчевая гонка')} · ${t(...v.name)}`,
      hero: { label: t('You and a friend, one on one', 'Вы и друг, один на один'), value: t('Race me', 'Сыграем матч'), color: C.gold },
      cells: [
        ...(code ? [{ label: t('Code', 'Код'), value: code }] : []),
        { label: t('Venue', 'Акватория'), value: t(...v.name) },
        { label: t('Yacht', 'Яхта'), value: t(...y.name) },
      ],
      call: t('Join the match', 'Войти в матч'),
      panel: {
        title: t('Course', 'Дистанция'), aside: t(...SHAPE_NAME.wl),
        body: <CourseSvg course={plannedCourse('medium', 'short', 2, 'wl', y)} route={BEAT_ANGLE.medium} wind />,
        keys: [{ kind: 'line', color: C.gold, label: t('Start', 'Старт') }, { kind: 'dot', color: C.buoy, label: t('Marks', 'Знаки') }, { kind: 'arrow', color: C.you, label: t('Wind', 'Ветер') }],
      },
    };
  },
  // the exam trainer: its courses and how many questions each
  iyt: (t, lang) => ({
    kind: t('Sailing Certification Test', 'Sailing Certification Test'),
    hero: { label: t('Exam practice, VHF to Yachtmaster Ocean', 'Тренажёр от VHF до Yachtmaster Ocean'), value: num(IYT_TOTAL, lang), color: C.gold },
    cells: [
      { label: t('Questions', 'Вопросы'), value: num(IYT_TOTAL, lang) },
      { label: t('Courses', 'Курсы'), value: IYT_LEVELS.length },
      { label: t('Price', 'Цена'), value: t('Free', 'Бесплатно') },
    ],
    call: t('Practise now', 'Тренируйся'),
    panel: { title: t('Courses', 'Курсы'), aside: t('questions', 'вопросы'), body: <Rows rows={IYT_LEVELS.map((l) => ({ text: t(...l.name), value: num(l.n, lang), bar: l.n / 1000 }))} /> },
  }),
  // how to play: the keys
  help: (t) => ({
    kind: t('How to play', 'Как играть'),
    hero: { label: t('Steer, trim, tack and win the start', 'Руль, паруса, поворот и старт'), value: t('How to play', 'Как играть'), wrap: true },
    cells: [
      { label: t('Phone', 'Телефон'), value: t('Thumbs', 'Пальцы') },
      { label: t('Computer', 'Компьютер'), value: t('Keys', 'Клавиши') },
      { label: t('Views', 'Виды'), value: 3 },
    ],
    call: t('Learn the boat', 'Освой лодку'),
    panel: { title: t('The keys', 'Клавиши'), body: <Rows rows={[
      { lead: '← →', text: t('Steer', 'Руль') },
      { lead: '↑ ↓', text: t('Trim the sails', 'Настрой паруса') },
      { lead: t('Space', 'Пробел'), text: t('Tack or gybe', 'Поворот или фордевинд') },
      { lead: 'K', text: t('Hoist the gennaker', 'Поставь генакер') },
      { lead: 'X C V', text: t('Drone, top and helm views', 'Дрон, сверху и со штурвала') },
    ]} /> },
  }),
  // the questions, the first few
  faq: (t) => {
    const gs = faqGroups(t), all = gs.flatMap((g) => g.items), first = HOME.map((id) => all.find((x) => x.id === id)).filter((x) => !!x);
    return {
      kind: t('Questions', 'Вопросы'),
      hero: { label: t('About the game, the race and the rules', 'Об игре, гонке и правилах'), value: t(`${all.length} answers`, `${all.length} ${ruPlural(all.length, ['ответ', 'ответа', 'ответов'])}`) },
      cells: [
        { label: t('Is it free?', 'Бесплатно?'), value: t('Yes', 'Да') },
        { label: t('On a phone?', 'На телефоне?'), value: t('Yes', 'Да') },
        { label: t('Sign in?', 'Вход?'), value: t('If you like', 'По желанию') },
      ],
      call: t('Find the answer', 'Найди ответ'),
      panel: { title: t('Asked most', 'Чаще всего'), body: <Rows size={23} rows={first.map((x) => ({ lead: '?', text: x.q }))} /> },
    };
  },
  // the game's channels
  social: (t) => {
    const ch = CHANNELS[0];
    return {
      kind: t('Follow the game', 'Игра в соцсетях'),
      hero: { label: t(`On ${ch.name}`, `В ${ch.name}`), value: ch.handle, wrap: true },
      cells: [
        { label: t('Channels', 'Каналы'), value: CHANNELS.length },
        { label: t('Language', 'Язык'), value: ch.lang === 'ru' ? t('Russian', 'Русский') : ch.lang === 'en' ? t('English', 'Английский') : t('Both', 'Оба') },
      ],
      call: t('Follow', 'Подписаться'),
      panel: { title: t('What it posts', 'О чём пишет'), body: <Rows rows={[
        { lead: '1', text: t('The game’s news', 'Новости игры') },
        { lead: '2', text: t('The day’s best races', 'Лучшие гонки дня') },
        { lead: '3', text: t('The racing rules', 'Правила гонок'), sub: t('a situation at a time', 'разбор за разбором') },
      ]} /> },
    };
  },
  // your boat: a yacht in your colours, your number on the main
  boat: (t) => ({
    kind: t('Your boat', 'Твоя яхта'),
    hero: { label: t('Hull, sails, logo and number', 'Корпус, паруса, логотип и номер'), value: t('Your boat', 'Твоя яхта'), wrap: true },
    cells: [
      { label: t('Yachts', 'Яхты'), value: YACHTS.length },
      { label: t('Seen in', 'Вид'), value: '3D' },
      { label: t('Every race', 'Каждая гонка'), value: t('Yours', 'Твоя') },
    ],
    call: t('Paint your boat', 'Раскрась яхту'),
    panel: { title: t('Sail plan', 'Парусность'), aside: 'JPK 1050', body: <Sloop /> },
  }),
};
const YACHT_LIST = (t: T) => YACHTS.slice(0, 5).map((y) => t(...y.name)).join(' · ');

// a sloop from the side, as the boat page's picture: the main with a number on it, the jib, the hull in your blue
function Sloop() {
  const w = PANEL.w, h = PANEL.h - PANEL.head;
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={`M0 ${h - 70}H${w}`} stroke={C.rule} strokeWidth={1} />
        <path d={`M60 ${h - 112}L380 ${h - 112}L352 ${h - 78}Q220 ${h - 66} 96 ${h - 82}Z`} fill={C.you} />
        <path d={`M232 40V${h - 112}`} stroke="#fff" strokeWidth={5} />
        <path d={`M226 52L226 ${h - 126}L104 ${h - 126}Z`} fill="rgba(255,255,255,0.92)" />
        <path d={`M240 58L364 ${h - 118}L240 ${h - 118}Z`} fill="rgba(255,255,255,0.7)" />
      </svg>
      <div style={{ display: 'flex', position: 'absolute', left: 150, top: h - 236, fontSize: 38, fontWeight: 800, color: C.inkOn }}>1050</div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = new URL(request.url).searchParams;
  const ql = q.get('lang'), lang: Lang = isLang(ql) ? ql : 'en';
  const build = CARDS[key];
  const c = build ? await build(tx(lang), lang, q) : null;
  if (!c) return new Response(null, { status: 302, headers: { location: '/images/og-v8.jpg', 'cache-control': 'public, max-age=60' } });
  const img = await card(c);
  // the rating and the players move through the day; the rest only with a deploy
  const live = key === 'rating' || key === 'players' || key === 'player';
  img.headers.set('cache-control', live ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return img;
}
