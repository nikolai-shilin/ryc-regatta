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
import { duelFrom } from '@/lib/duel-share';

// /og/page/<key>?lang=ru — the share card of a page that has no race or passport of its own, in the logo's look
// (lib/og.tsx) over a picture of the game that suits it: what the page is, and the one thing about it worth a link (a
// guide's name, the day's winning time, a player's name, how many yachts…). The page names it in its metadata
// (lib/seo.ts pageMeta's card). An unknown key gets the site's own picture.
type Q = URLSearchParams;
type Built = Parameters<typeof card>[0];
type Build = (t: T, lang: Lang, q: Q) => Promise<Built | null> | Built | null;

const num = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang]);
const dayLabel = (day: string, lang: Lang) => new Date(day + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
const learn = (t: T) => t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata', 'Guias de regata');
// the picture behind each guide: what it teaches, as the game shows it
const GUIDE_BG: Record<GuideSlug, Bg> = { sail: 'wind', tack: 'helm', rules: 'fleet', start: 'start', shifts: 'wind', marks: 'aerial', downwind: 'fleet', trim: 'trim' };

const CARDS: Record<string, Build> = {
  learn: (t) => ({
    bg: 'aerial', kind: t(`${GUIDES.length} short guides and a glossary`, `${GUIDES.length} коротких пособий и словарь`, `${GUIDES.length} guías breves y un glosario`, `${GUIDES.length} kurze Anleitungen und ein Glossar`, `${GUIDES.length} kısa rehber ve bir sözlük`, `${GUIDES.length} guides courts et un glossaire`, `${GUIDES.length} brevi guide e un glossario`, `${GUIDES.length} guias curtos e um glossário`),
    hero: { label: t('Sailboat racing, step by step', 'Парусные гонки шаг за шагом', 'Regatas a vela, paso a paso', 'Segelregatten, Schritt für Schritt', 'Yelken yarışı, adım adım', 'La régate à la voile, pas à pas', 'Le regate a vela, passo per passo', 'Regata a vela, passo a passo'), value: learn(t), wrap: true },
    call: t('Read, then race', 'Читай и гоняйся', 'Lee, luego compite', 'Lesen, dann segeln', 'Oku, sonra yarış', 'Lis, puis régate', 'Leggi, poi regata', 'Leia e depois corra'),
  }),
  guide: (t, lang, q) => {
    const slug = q.get('g') || '';
    if (!isGuide(slug)) return null;
    const g = guide(slug, t, lang);
    return {
      bg: GUIDE_BG[slug], kind: `${learn(t)} · ${t(`Guide ${guideNo(slug)} of ${GUIDES.length}`, `Пособие ${guideNo(slug)} из ${GUIDES.length}`, `Guía ${guideNo(slug)} de ${GUIDES.length}`, `Anleitung ${guideNo(slug)} von ${GUIDES.length}`, `Rehber ${guideNo(slug)} / ${GUIDES.length}`, `Guide ${guideNo(slug)} sur ${GUIDES.length}`, `Guida ${guideNo(slug)} di ${GUIDES.length}`, `Guia ${guideNo(slug)} de ${GUIDES.length}`)}`,
      hero: { label: g.kicker.split(' · ')[1] || t('Guide', 'Пособие', 'Guía', 'Anleitung', 'Rehber', 'Guide', 'Guida', 'Guia'), value: g.short, wrap: true },
      call: t('Read the guide', 'Читать пособие', 'Lee la guía', 'Die Anleitung lesen', 'Rehberi oku', 'Lire le guide', 'Leggi la guida', 'Leia o guia'),
    };
  },
  glossary: (t) => {
    const n = glossaryGroups(t).reduce((a, g) => a + g.terms.length, 0);
    return {
      bg: 'wind', kind: `${learn(t)} · ${t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario', 'Glossário')}`,
      hero: { label: t('The words of sailboat racing', 'Слова парусных гонок', 'Las palabras de las regatas a vela', 'Die Wörter des Segelregattasports', 'Yelken yarışının sözcükleri', 'Les mots de la régate', 'Le parole delle regate a vela', 'As palavras da regata a vela'), value: t(`${n} terms`, `${n} ${ruPlural(n, ['термин', 'термина', 'терминов'])}`, `${n} términos`, `${n} Begriffe`, `${n} terim`, `${n} termes`, `${n} termini`, `${n} termos`) },
      call: t('Look a word up', 'Найди слово', 'Busca una palabra', 'Ein Wort nachschlagen', 'Bir sözcük ara', 'Cherche un mot', 'Cerca una parola', 'Procure uma palavra'),
    };
  },
  rulebook: (t) => {
    const n = ruleCount(rulebook(t));
    return {
      bg: 'fleet', kind: t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları', 'Règles de course', 'Regole di regata', 'Regras de regata'),
      hero: { label: t('The Racing Rules of Sailing in plain words', 'Правила парусных гонок простыми словами', 'El Reglamento de Regatas a Vela en palabras llanas', 'Die Wettfahrtregeln Segeln in einfachen Worten', 'Yelken Yarış Kuralları sade sözlerle', 'Les Règles de course à la voile en mots simples', 'Le Regole di Regata della Vela in parole semplici', 'As Regras de Regata a Vela em palavras simples'), value: t(`${n} rules`, `${n} ${ruPlural(n, ['правило', 'правила', 'правил'])}`, `${n} reglas`, `${n} Regeln`, `${n} kural`, `${n} règles`, `${n} regole`, `${n} regras`) },
      call: t('Look a rule up', 'Найди правило', 'Busca una regla', 'Eine Regel nachschlagen', 'Bir kural ara', 'Cherche une règle', 'Cerca una regola', 'Procure uma regra'),
    };
  },
  yachts: (t) => {
    const len = (y: (typeof YACHTS)[number]) => parseFloat(y.specs.find((s) => s.k[0] === 'Length')!.v[0]);
    const ys = YACHTS.slice().sort((a, b) => len(b) - len(a));
    return {
      bg: 'fleet', kind: t('The yachts', 'Яхты', 'Los yates', 'Die Yachten', 'Yatlar', 'Les yachts', 'Gli yacht', 'Os veleiros'),
      hero: { label: t(`From the ${t(...ys[ys.length - 1].name)} to the ${t(...ys[0].name)}`, `От ${t(...ys[ys.length - 1].name)} до ${t(...ys[0].name)}`, `Del ${t(...ys[ys.length - 1].name)} al ${t(...ys[0].name)}`, `Vom ${t(...ys[ys.length - 1].name)} bis zum ${t(...ys[0].name)}`, `${t(...ys[ys.length - 1].name)} ile ${t(...ys[0].name)} arası`, `De l’${t(...ys[ys.length - 1].name)} au ${t(...ys[0].name)}`, `Da ${t(...ys[ys.length - 1].name)} a ${t(...ys[0].name)}`, `Do ${t(...ys[ys.length - 1].name)} ao ${t(...ys[0].name)}`), value: t(`${ys.length} yachts`, `${ys.length} яхт`, `${ys.length} yates`, `${ys.length} Yachten`, `${ys.length} yat`, `${ys.length} yachts`, `${ys.length} yacht`, `${ys.length} veleiros`) },
      call: t('Pick your yacht', 'Выбери яхту', 'Elige tu yate', 'Wähle deine Yacht', 'Yatını seç', 'Choisis ton yacht', 'Scegli il tuo yacht', 'Escolha seu veleiro'),
    };
  },
  // a day's rating (today's without ?day): the winner and their time
  rating: async (t, lang, q) => {
    const today = todayUtc(), want = q.get('day'), day = want && validDay(want) ? want : today, live = day === today;
    const r = await getRating(day);
    const d = dailyRace(new Date(day + 'T12:00:00Z'));
    const first = (r?.rows || []).slice().sort((a, b) => a.s - b.s)[0];
    return {
      bg: 'fleet', kind: `${live ? t('Today’s leaderboard', 'Рейтинг дня', 'Clasificación de hoy', 'Rangliste von heute', 'Günün sıralaması', 'Classement du jour', 'Classifica di oggi', 'A classificação do dia') : t('Leaderboard', 'Рейтинг', 'Clasificación', 'Rangliste', 'Sıralama', 'Classement', 'Classifica', 'Classificação')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
      tag: { text: dayLabel(day, lang), live },
      hero: first
        ? { label: t(`First · ${first.name || 'a sailor'}`, `Первое место · ${first.name || 'гонщик'}`, `Primero · ${first.name || 'un regatista'}`, `Erster · ${first.name || 'ein Segler'}`, `Birinci · ${first.name || 'bir denizci'}`, `En tête · ${first.name || 'un régatier'}`, `In testa · ${first.name || 'un velista'}`, `Primeiro · ${first.name || 'um velejador'}`), value: clock(first.s), color: C.gold, plate: { text: t('1st', '1', '1.º', '1.', '1.'), bg: C.gold } }
        : { label: t('No time yet', 'Пока никто не финишировал', 'Aún sin tiempo', 'Noch keine Zeit', 'Henüz süre yok', 'Pas encore de temps', 'Ancora nessun tempo', 'Ainda sem tempo'), value: t('Be first', 'Будь первым', 'Sé el primero', 'Sei der Erste', 'İlk ol', 'Prends la tête', 'Sii il primo', 'Seja o primeiro') },
      call: live ? t('Beat the time', 'Побей время', 'Bate el tiempo', 'Die Zeit schlagen', 'Süreyi geç', 'Bats ce temps', 'Batti il tempo', 'Bata o tempo') : t('See the leaderboard', 'Смотри рейтинг', 'Ver la clasificación', 'Zur Rangliste', 'Sıralamayı gör', 'Voir le classement', 'Vedi la classifica', 'Ver a classificação'),
    };
  },
  players: async (t, lang) => {
    const l = await getPlayers(1);
    return {
      bg: 'helm', kind: t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores'),
      hero: l && l.total ? { label: t('Sailors racing signed in', 'Гонщики с аккаунтом', 'Regatistas con sesión iniciada', 'Angemeldete Segler', 'Giriş yaparak yarışan denizciler', 'Des régatiers connectés', 'Velisti in regata con accesso', 'Velejadores que correm com conta'), value: num(l.total, lang), color: C.gold } : { label: t('Everyone who races', 'Все, кто гоняется', 'Todos los que compiten', 'Alle, die segeln', 'Yarışan herkes', 'Tous ceux qui régatent', 'Tutti quelli che regatano', 'Todos que correm regata'), value: t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores'), wrap: true },
      call: t('Join them', 'Присоединяйся', 'Únete', 'Mach mit', 'Onlara katıl', 'Rejoins-les', 'Unisciti a loro', 'Junte-se a eles'),
    };
  },
  // one player: their name, and their points and wins
  player: async (t, lang, q) => {
    const k = q.get('p') || '';
    const p = KEY_RE.test(k) ? await getPlayer(k) : null;
    if (!p) return CARDS.players(t, lang, q);
    const pts = t(`${num(p.pts, lang)} points`, `${num(p.pts, lang)} ${ruPlural(p.pts, ['очко', 'очка', 'очков'])}`, `${num(p.pts, lang)} ${p.pts === 1 ? 'punto' : 'puntos'}`, `${num(p.pts, lang)} Punkte`, `${num(p.pts, lang)} puan`, `${num(p.pts, lang)} ${p.pts === 1 ? 'point' : 'points'}`, `${num(p.pts, lang)} ${p.pts === 1 ? 'punto' : 'punti'}`, `${num(p.pts, lang)} ${p.pts === 1 ? 'ponto' : 'pontos'}`);
    const wins = p.wins ? t(`${p.wins} ${p.wins === 1 ? 'win' : 'wins'}`, `${p.wins} ${ruPlural(p.wins, ['победа', 'победы', 'побед'])}`, `${p.wins} ${p.wins === 1 ? 'victoria' : 'victorias'}`, `${p.wins} ${p.wins === 1 ? 'Sieg' : 'Siege'}`, `${p.wins} galibiyet`, `${p.wins} ${p.wins === 1 ? 'victoire' : 'victoires'}`, `${p.wins} ${p.wins === 1 ? 'vittoria' : 'vittorie'}`, `${p.wins} ${p.wins === 1 ? 'vitória' : 'vitórias'}`) : '';
    return {
      bg: 'helm', kind: t('Player card', 'Карточка игрока', 'Tarjeta de jugador', 'Spielerkarte', 'Oyuncu kartı', 'Carte de joueur', 'Tessera del giocatore', 'Cartão do jogador'),
      hero: { label: [pts, wins].filter(Boolean).join(' · '), value: p.name || t('A sailor', 'Гонщик', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un régatier', 'Un velista', 'Um velejador'), wrap: true },
      call: t('Race them', 'Обгони', 'Rétalos', 'Segle gegen sie', 'Onlara karşı yarış', 'Affronte-les', 'Sfidali', 'Desafie-os'),
    };
  },
  drills: (t) => ({
    bg: 'start', kind: t('Drills', 'Тренировки', 'Ejercicios', 'Übungen', 'Alıştırmalar', 'Entraînements', 'Esercizi', 'Treinos'),
    hero: { label: t(`${LEVELS.length} levels, beginner to expert`, `${LEVELS.length} уровня, от новичка до эксперта`, `${LEVELS.length} niveles, de principiante a experto`, `${LEVELS.length} Stufen, vom Anfänger bis zum Experten`, `${LEVELS.length} seviye, acemiden uzmana`, `${LEVELS.length} niveaux, de débutant à expert`, `${LEVELS.length} livelli, dal principiante all’esperto`, `${LEVELS.length} níveis, de iniciante a expert`), value: t(`${DRILLS.length} drills`, `${DRILLS.length} ${ruPlural(DRILLS.length, ['тренировка', 'тренировки', 'тренировок'])}`, `${DRILLS.length} ejercicios`, `${DRILLS.length} Übungen`, `${DRILLS.length} alıştırma`, `${DRILLS.length} entraînements`, `${DRILLS.length} esercizi`, `${DRILLS.length} treinos`) },
    call: t('Start a drill', 'Начни тренировку', 'Empezar un ejercicio', 'Eine Übung starten', 'Bir alıştırma başlat', 'Commencer un entraînement', 'Inizia un esercizio', 'Começar um treino'),
  }),
  free: (t) => ({
    bg: 'drone', kind: t(`${VENUES.length} venues · ${YACHTS.length} yachts`, `${VENUES.length} ${ruPlural(VENUES.length, ['акватория', 'акватории', 'акваторий'])} · ${YACHTS.length} яхт`, `${VENUES.length} sedes · ${YACHTS.length} yates`, `${VENUES.length} Reviere · ${YACHTS.length} Yachten`, `${VENUES.length} yarış alanı · ${YACHTS.length} yat`, `${VENUES.length} plans d’eau · ${YACHTS.length} yachts`, `${VENUES.length} campi di regata · ${YACHTS.length} yacht`, `${VENUES.length} raias · ${YACHTS.length} veleiros`),
    hero: { label: t('Your venue, your yacht, your wind', 'Твоя акватория, твоя яхта, твой ветер', 'Tu sede, tu yate, tu viento', 'Dein Revier, deine Yacht, dein Wind', 'Senin alanın, senin yatın, senin rüzgârın', 'Ton plan d’eau, ton yacht, ton vent', 'Il tuo campo di regata, il tuo yacht, il tuo vento', 'Sua raia, seu veleiro, seu vento'), value: t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera', 'Regata livre'), wrap: true },
    call: t('Set up a race', 'Настрой гонку', 'Preparar una regata', 'Eine Regatta einrichten', 'Bir yarış kur', 'Préparer une régate', 'Organizza una regata', 'Montar uma regata'),
  }),
  // a 1-on-1 race: the host's venue and boat, its code on the tag
  match: (t, _lang, q) => {
    const code = parseCode(q.get('c') || '');
    const v = venueOf(q.get('v') || undefined), y = yachtOf(q.get('b'));
    return {
      bg: 'drone', kind: `${t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')} · ${t(...v.name)} · ${t(...y.name)}`,
      ...(code ? { tag: { text: code } } : {}),
      hero: { label: t('You and a friend, one on one', 'Вы и друг, один на один', 'Tú y un amigo, uno contra uno', 'Du und ein Freund, eins gegen eins', 'Sen ve bir arkadaşın, bire bir', 'Toi et un ami, en duel', 'Tu e un amico, uno contro uno', 'Você e um amigo, um contra um'), value: t('Race me', 'Сыграем', 'Rétame', 'Segle gegen mich', 'Bana karşı yarış', 'Défie-moi', 'Sfidami', 'Me desafie'), color: C.gold },
      call: t('Join the race', 'Войти в гонку', 'Unirse a la regata', 'An der Regatta teilnehmen', 'Yarışa katıl', 'Rejoindre la régate', 'Entra in regata', 'Entrar na regata'),
    };
  },
  // a 1-on-1 race's result, shared: who beat whom and by how much, where and in what; the call to race them next
  // (lib/duel-share.ts: the race's own link carries it)
  duel: (t, lang, q) => {
    const d = duelFrom((k) => q.get(k));
    if (!d) return null;
    const v = venueOf(q.get('v') || undefined), y = yachtOf(q.get('b'));
    const by = d.m != null ? `${d.m.toFixed(1).replace('.', lang === 'en' ? '.' : ',')} ${t('s', 'с', 's', 's', 'sn', 's', 's', 's')}` : null;
    return {
      bg: 'start', kind: `${t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')} · ${t(...v.name)} · ${t(...y.name)}`,
      hero: { label: by ? t(`${by} ahead of ${d.l}`, `на ${by} впереди ${d.l}`, `${by} por delante de ${d.l}`, `${by} vor ${d.l}`, `${d.l} önünde ${by}`, `${by} devant ${d.l}`, `${by} davanti a ${d.l}`, `${by} à frente de ${d.l}`)
          : t(`ahead of ${d.l}`, `впереди ${d.l}`, `por delante de ${d.l}`, `vor ${d.l}`, `${d.l} önünde`, `devant ${d.l}`, `davanti a ${d.l}`, `à frente de ${d.l}`),
        value: t(`${d.w} won`, `${d.w} побеждает`, `${d.w} ganó`, `${d.w} gewinnt`, `${d.w} kazandı`, `${d.w} gagne`, `${d.w} vince`, `${d.w} venceu`), wrap: true },
      call: t('Race the winner', 'Сразись с победителем', 'Reta al ganador', 'Fordere den Sieger', 'Kazananla yarış', 'Défie le vainqueur', 'Sfida il vincitore', 'Desafie o vencedor'),
    };
  },
  iyt: (t, lang) => ({
    bg: 'helm', kind: 'Sailing Certification Test',
    hero: { label: t('Questions, VHF to Yachtmaster Ocean', 'Вопросов, от VHF до Yachtmaster Ocean', 'Preguntas, de VHF a Yachtmaster Ocean', 'Fragen, von VHF bis Yachtmaster Ocean', 'VHF’den Yachtmaster Ocean’a sorular', 'Des questions, de la VHF au Yachtmaster Ocean', 'Domande, dal VHF a Yachtmaster Ocean', 'Perguntas, do VHF ao Yachtmaster Ocean'), value: num(IYT_TOTAL, lang), color: C.gold },
    call: t('Practise free', 'Тренируйся бесплатно', 'Practica gratis', 'Kostenlos üben', 'Ücretsiz çalış', 'S’entraîner gratuitement', 'Esercitati gratis', 'Treine de graça'),
  }),
  help: (t) => ({
    bg: 'trim', kind: t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca', 'Como jogar'),
    hero: { label: t('Steer, trim, tack and win the start', 'Руль, паруса, поворот и старт', 'Gobierna, trima, vira y gana la salida', 'Steuern, trimmen, wenden und den Start gewinnen', 'Dümen tut, trim et, tramola at ve startı kazan', 'Barrer, régler, virer et gagner le départ', 'Governa, regola, vira e vinci la partenza', 'Governe, regule, cambe e ganhe a largada'), value: t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca', 'Como jogar'), wrap: true },
    call: t('Learn the boat', 'Освой лодку', 'Aprende el barco', 'Das Boot kennenlernen', 'Tekneyi öğren', 'Prendre le bateau en main', 'Impara a condurre la barca', 'Conheça o barco'),
  }),
  faq: (t) => {
    const n = faqGroups(t).reduce((a, g) => a + g.items.length, 0);
    return {
      bg: 'drone', kind: t('FAQ', 'Вопросы и ответы', 'Preguntas', 'FAQ', 'SSS', 'FAQ', 'Domande frequenti', 'Perguntas'),
      hero: { label: t('About the game, the race and the rules', 'Об игре, гонке и правилах', 'Sobre el juego, la regata y las reglas', 'Über das Spiel, die Regatta und die Regeln', 'Oyun, yarış ve kurallar hakkında', 'Le jeu, la régate et les règles', 'Sul gioco, la regata e le regole', 'Sobre o jogo, a regata e as regras'), value: t(`${n} answers`, `${n} ${ruPlural(n, ['ответ', 'ответа', 'ответов'])}`, `${n} respuestas`, `${n} Antworten`, `${n} cevap`, `${n} réponses`, `${n} risposte`, `${n} respostas`) },
      call: t('Find the answer', 'Найди ответ', 'Encuentra la respuesta', 'Die Antwort finden', 'Cevabı bul', 'Trouver la réponse', 'Trova la risposta', 'Encontre a resposta'),
    };
  },
  social: (t) => {
    const ch = CHANNELS[0];
    return {
      bg: 'fleet', kind: t('Social media', 'Соцсети', 'Redes sociales', 'Soziale Medien', 'Sosyal medya', 'Réseaux sociaux', 'Social', 'Redes sociais'),
      hero: { label: t(`On ${ch.name}`, `В ${ch.name}`, `En ${ch.name}`, `Auf ${ch.name}`, `${ch.name} üzerinde`, `Sur ${ch.name}`, `Su ${ch.name}`, `No ${ch.name}`), value: ch.handle, wrap: true },
      call: t('Follow', 'Подписаться', 'Seguir', 'Folgen', 'Takip et', 'Suivre', 'Segui', 'Seguir'),
    };
  },
  sponsorship: (t) => ({
    bg: 'fleet', kind: t('Sponsorship', 'Спонсорство', 'Patrocinio', 'Sponsoring', 'Sponsorluk', 'Sponsoring', 'Sponsorizzazione', 'Patrocínio'),
    hero: { label: t('On the sails and over the course', 'На парусах и над дистанцией', 'En las velas y sobre el recorrido', 'Auf den Segeln und über der Bahn', 'Yelkenlerde ve parkurun üstünde', 'Sur les voiles et sur le parcours', 'Sulle vele e sopra il percorso', 'Nas velas e sobre o percurso'), value: t('Your brand in the race', 'Ваш бренд в гонке', 'Tu marca en la regata', 'Deine Marke in der Regatta', 'Markan yarışta', 'Ta marque dans la régate', 'Il tuo marchio in regata', 'Sua marca na regata'), wrap: true },
    call: t('See the options', 'Посмотреть варианты', 'Ver las opciones', 'Die Optionen ansehen', 'Seçenekleri gör', 'Voir les options', 'Vedi le opzioni', 'Ver as opções'),
  }),
  boat: (t) => ({
    bg: 'drone', kind: t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht', 'Il tuo yacht', 'Seu veleiro'),
    hero: { label: t('Hull, sails, flag and number', 'Корпус, паруса, флаг и номер', 'Casco, velas, bandera y número', 'Rumpf, Segel, Flagge und Nummer', 'Gövde, yelkenler, bayrak ve numara', 'Coque, voiles, pavillon et numéro', 'Scafo, vele, bandiera e numero', 'Casco, velas, bandeira e número'), value: t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht', 'Il tuo yacht', 'Seu veleiro'), wrap: true },
    call: t('Paint your yacht', 'Раскрась яхту', 'Pinta tu yate', 'Deine Yacht bemalen', 'Yatını boya', 'Peins ton yacht', 'Colora il tuo yacht', 'Pinte seu veleiro'),
  }),
};

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = new URL(request.url).searchParams;
  const ql = q.get('lang'), lang: Lang = isLang(ql) ? ql : 'en';
  const build = Object.hasOwn(CARDS, key) ? CARDS[key] : null; // (not the names every object has: /og/page/constructor)
  const c = build ? await build(tx(lang), lang, q) : null;
  if (!c) return new Response(null, { status: 302, headers: { location: '/images/og-v10.jpg', 'cache-control': 'public, max-age=60' } });
  const img = await card({ ...c, lang });
  // the rating and the players move through the day; the rest only with a deploy
  const live = key === 'rating' || key === 'players' || key === 'player';
  img.headers.set('cache-control', live ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return img;
}
