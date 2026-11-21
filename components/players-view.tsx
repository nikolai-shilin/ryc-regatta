'use client';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LOCALE, tx, ruPlural, type Lang } from '@/lib/lang';
import { DEFAULT_BOAT, type Boat } from '@/lib/boat';
import { findFlag, flagSrc } from '@/lib/flags';
import { yachtOf, isYacht } from '@/lib/yachts';
import { VENUES } from '@/lib/venues';
import type { PlayerCard, PlayerList } from '@/lib/players';
import type { PassportShare } from '@/lib/passport-share';
import { passport as passportOf, streakOf } from '@/lib/log';
import { useCardKey } from '@/lib/card-key';
import { IconBack, IconArrow, IconCrew, IconSail, IconTrophy, IconKite } from './ui';
import { LoadBar, ScenePoster } from './skeleton';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';
import { FlagImg, NoFlag } from './flag';
import { passportShare, useLog } from './passport';
import { PassportBlock, type PassportFacts } from './passport-card';
import { ShareButton } from './share-sheet';
import { MyDuelRating } from './my-duel-rating';
import { MyAchievements } from './achievements';
import { TabBar, DuelTab, DailyTab, VenueCounts, type Tab } from './player-tabs';
import '@/styles/players.css';
import { useSceneStart } from '@/lib/scene-start';

// The players: the game's own scene (/boat-view: a JPK 1050 on Lake Garda on a summer evening, the drone circling her)
// behind the page, as on /yachts and /boat, the players' table in the card on the right, a page at a time, the most
// points first (the rating's, every day of today's race added up). Picking one
// (?p=<k>, a navigation the server answers, so the address can be shared) dresses the yacht in their colours and turns
// the card to their numbers: the races, the wins and podiums, their passport, today's race, the yachts they sail, their
// boat. A player whose boat the site never kept (one who only races inside Telegram) is shown the boat everyone starts in.
// The passport's venues are the scores API's, so every card has them; the streak is kept in a player's own log
// (lib/log.ts), so only your own card shows it. The card also holds a passport shared as a link and, at ?me=1,
// what this device has for someone with no card yet (passport below); a player with a card is sent to it.

const href = (page: number, k?: string | null) => {
  const q = new URLSearchParams();
  if (page > 1) q.set('page', String(page));
  if (k) q.set('p', k);
  const s = q.toString();
  return s ? `/players?${s}` : '/players';
};

export function PlayersView({ lang, list, player, missing, back, passport }: {
  lang: Lang; list: PlayerList | null; player: PlayerCard | null; missing: boolean; back: ReactNode;
  passport?: { shared: PassportShare | null; path: string }; // a shared one, or (null) this device's
}) {
  const t = tx(lang);
  const router = useRouter();
  const log = useLog();
  const [myKey, askKey] = useCardKey();
  const mine = !!player && myKey === player.k;
  const own = !!passport && !passport.shared;
  useEffect(() => { if (player || own) askKey(); }); // asks once: the hook remembers
  useEffect(() => { if (own && myKey) router.replace(href(1, myKey)); }, [own, myKey, router]);
  // the card's tabs (components/player-tabs.tsx): the overview again for each player; 1-on-1 is your own card's alone
  const [tab, setTab] = useState<Tab>('over');
  useEffect(() => { setTab('over'); }, [player?.k]);
  const shown: Tab = tab === 'duel' && !mine ? 'over' : tab;
  const [pending, start] = useTransition();
  const [going, setGoing] = useState<string | null>(null); // the row clicked, while its card comes
  const [down, setDown] = useState(false);
  const [live, setLive] = useState(false);
  const backdrop = useSceneStart();
  const frame = useRef<HTMLIFrameElement>(null), card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const page = list?.page ?? 1;

  // the boat in the scene: the player's, over the default for whatever their account doesn't say; none picked, the default
  const boat: Boat = player?.boat ? { ...DEFAULT_BOAT, ...player.boat, preset: undefined } : DEFAULT_BOAT;
  const look = useRef({ boat, down }); look.current = { boat, down };

  const post = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  const inset = useCallback(() => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? ((H - st.top) / H) * 0.5 : 0 });
  }, [post]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') {
        post({ type: 'look', boat: look.current.boat }); post({ type: 'pose', down: look.current.down }); inset();
        // up before this page listened (it says live once): its canvas tells
        try { if (frame.current?.contentDocument?.querySelector('canvas.live')) setLive(true); } catch {}
      }
      if (e.data?.type === 'live') setLive(true);
    };
    addEventListener('message', on); addEventListener('resize', inset);
    const ro = new ResizeObserver(inset);
    for (const el of [card.current, info.current]) if (el) ro.observe(el);
    post({ type: 'hello' }); // in case the preview was up before this page listened: it answers ready again
    return () => { removeEventListener('message', on); removeEventListener('resize', inset); ro.disconnect(); };
  }, [inset, post]);
  const lookKey = JSON.stringify(boat);
  useEffect(() => { post({ type: 'look', boat: look.current.boat }); }, [lookKey, post]);
  useEffect(() => { post({ type: 'pose', down }); }, [down, post]);
  useEffect(() => { if (!pending) setGoing(null); }, [pending]);
  useEffect(() => { setDown(false); }, [player?.k]);
  useEffect(() => { card.current?.querySelector('.bt-body')?.scrollTo({ top: 0 }); }, [player?.k, page]); // a new page or player starts at the card's top

  const go = (to: string, k: string | null) => { setGoing(k); start(() => router.push(to, { scroll: false })); };

  // a number the API may not send yet (an answer cached from before it did) is a dash, not an error
  const num = (n: number | undefined) => (typeof n === 'number' ? n.toLocaleString(LOCALE[lang]) : '–');
  const place = (p: number | null) => (p == null ? '–' : lang === 'ru' ? `${p}-е` : lang === 'es' ? `${p}.º` : lang === 'pt' ? `${p}º` : lang === 'it' ? `${p}º` : lang === 'fr' ? (p === 1 ? '1er' : `${p}e`) : lang === 'de' || lang === 'tr' ? `${p}.` : `${p}${p % 10 === 1 && p % 100 !== 11 ? 'st' : p % 10 === 2 && p % 100 !== 12 ? 'nd' : p % 10 === 3 && p % 100 !== 13 ? 'rd' : 'th'}`);
  const date = (s: string, year = true) => new Date(s).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', ...(year && { year: 'numeric' }), timeZone: 'UTC' });
  const races = (n: number) => (lang === 'ru' ? `${num(n)} ${ruPlural(n, ['гонка', 'гонки', 'гонок'])}` : lang === 'es' ? `${num(n)} ${n === 1 ? 'regata' : 'regatas'}` : lang === 'de' ? `${num(n)} ${n === 1 ? 'Regatta' : 'Regatten'}` : lang === 'tr' ? `${num(n)} yarış` : lang === 'fr' ? `${num(n)} ${n < 2 ? 'régate' : 'régates'}` : lang === 'it' ? `${num(n)} ${n === 1 ? 'regata' : 'regate'}` : lang === 'pt' ? `${num(n)} ${n === 1 ? 'regata' : 'regatas'}` : `${num(n)} race${n === 1 ? '' : 's'}`);
  const nameOf = (x: { name: string | null }) => x.name || t('A player', 'Игрок', 'Un jugador', 'Ein Spieler', 'Bir oyuncu', 'Un joueur', 'Un giocatore', 'Um jogador');
  const yachtName = (id: string | null) => t(...yachtOf(isYacht(id) ? id : 'jpk1050').name);
  const flag = findFlag(boat.flag);

  // the passport on a player's card: the venues they have raced, and on your own what this device's log adds to them
  const known = new Set<string>(VENUES.map((v) => v.id));
  const cardFacts = (p: PlayerCard): PassportFacts => {
    const raced = new Set([...p.venues.map((v) => v.id).filter((id) => known.has(id)), ...(mine && log ? passportOf(log).raced : [])]);
    const st = mine && log ? streakOf(log.d) : null;
    return { raced, n: raced.size, counts: Object.fromEntries(p.venues.map((v) => [v.id, v.n])), streak: st };
  };
  // the passport in the link, or this device's
  const shared = passport?.shared;
  const passFacts: PassportFacts | null = shared
    ? { raced: new Set(VENUES.filter((_, i) => shared.raced[i]).map((v) => v.id)), n: shared.v, streak: { n: shared.s } }
    : own && log ? { raced: passportOf(log).raced, n: passportOf(log).n, streak: streakOf(log.d) } : null;
  const passTitle = shared ? (shared.n ? t(`${shared.n}’s passport`, `Паспорт: ${shared.n}`, `Pasaporte de ${shared.n}`, `Pass von ${shared.n}`, `${shared.n} adlı oyuncunun pasaportu`, `Carte de joueur de ${shared.n}`, `La tessera di ${shared.n}`, `Cartão do jogador de ${shared.n}`) : t('A sailor’s passport', 'Паспорт гонщика', 'Pasaporte de un regatista', 'Der Pass eines Seglers', 'Bir denizcinin pasaportu', 'La carte de joueur d’un régatier', 'La tessera di un velista', 'O cartão de um velejador')) : t('Your player card', 'Твоя карточка игрока', 'Tu tarjeta de jugador', 'Deine Spielerkarte', 'Oyuncu kartın', 'Ta carte de joueur', 'La tua tessera del giocatore', 'Seu cartão do jogador');
  const passN = passFacts?.n ?? 0, passS = passFacts?.streak?.n ?? 0;
  const shareBtn = (l: NonNullable<typeof log>) => <ShareButton lang={lang} data={() => passportShare(l, lang)} className="bt-show" title={t('Share your passport', 'Поделиться паспортом', 'Comparte tu pasaporte', 'Teile deinen Pass', 'Pasaportunu paylaş', 'Partager ta carte de joueur', 'Condividi la tua tessera', 'Compartilhar seu cartão do jogador')} />;

  return (
    <div className="bt pl-view">
      <LoadBar label={t('Loading the boat', 'Загружаем яхту', 'Cargando el barco', 'Das Boot wird geladen', 'Tekne yükleniyor', 'Chargement du bateau', 'Caricamento della barca', 'Carregando o barco')} on={(!live && !backdrop.off) || pending} />
      <iframe ref={frame} className={`bt-scene bt-fade ${live ? 'on' : ''}`} src={backdrop.go ? '/boat-view?wind=light' : undefined} title={t('The player’s boat in 3D', 'Яхта игрока в 3D', 'El barco del jugador en 3D', 'Das Boot des Spielers in 3D', 'Oyuncunun teknesi 3D', 'Le bateau du joueur en 3D', 'La barca del giocatore in 3D', 'O barco do jogador em 3D')}
        onLoad={() => post({ type: 'hello' })} />
      <ScenePoster label={backdrop.off ? undefined : t('Loading the boat', 'Загружаем яхту', 'Cargando el barco', 'Das Boot wird geladen', 'Tekne yükleniyor', 'Chargement du bateau', 'Caricamento della barca', 'Carregando o barco')} on={!live} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand lang={lang} /></div>
        <span className="bt-kick">{passport ? passTitle : t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores')}</span>
        {passport ? (<>
          <h1 className="bt-h">{passS >= 2 ? t(`${passS} days in a row`, `${passS} ${ruPlural(passS, ['день', 'дня', 'дней'])} подряд`, `${passS} días seguidos`, `${passS} Tage in Folge`, `Üst üste ${passS} gün`, `${passS} jours d’affilée`, `${passS} giorni di fila`, `${passS} dias seguidos`) : t(`${passN} of ${VENUES.length} venues`, `${passN} из ${VENUES.length} акваторий`, `${passN} de ${VENUES.length} sedes`, `${passN} von ${VENUES.length} Revieren`, `${passN} / ${VENUES.length} yarış alanı`, `${passN} plans d’eau sur ${VENUES.length}`, `${passN} campi di regata su ${VENUES.length}`, `${passN} de ${VENUES.length} raias`)}</h1>
          <p className="bt-p">{shared
            ? t(`Every day the race moves to another of ${VENUES.length} famous regatta venues, the same race for everyone. ${passN} raced so far. Can you get further?`, `Каждый день гонка переезжает на другую из ${VENUES.length} знаменитых регатных акваторий, и она у всех одна. Пройдено ${passN}. Сможешь дальше?`, `Cada día la regata se traslada a otra de ${VENUES.length} famosas sedes de regata, la misma regata para todos. ${passN} regateadas hasta ahora. ¿Puedes llegar más lejos?`, `Jeden Tag zieht die Regatta zu einem anderen von ${VENUES.length} berühmten Regattarevieren, für alle dieselbe Regatta. ${passN} gesegelt. Kommst du weiter?`, `Her gün yarış, ünlü ${VENUES.length} regata yarış alanından birine taşınır, herkes için aynı yarış. Şimdiye kadar ${passN} tanesinde yarışıldı. Sen daha ileri gidebilir misin?`, `Chaque jour, la régate change de plan d’eau parmi ${VENUES.length} plans d’eau de régate célèbres, la même pour tous. ${passN} courus jusqu’ici. Iras-tu plus loin ?`, `Ogni giorno la regata si sposta in un altro di ${VENUES.length} celebri campi di regata, la stessa regata per tutti. ${passN} regatati finora. Riesci ad andare più lontano?`, `A cada dia a regata muda para outra das ${VENUES.length} raias de regata famosas, a mesma regata para todos. ${passN} corridas até agora. Você consegue ir mais longe?`)
            : t('Your venues and streak on this device. Sign in and race to get on the players’ list.', 'Твои акватории и серия на этом устройстве. Войди и пройди гонку, чтобы попасть в список игроков.', 'Tus sedes y tu racha en este dispositivo. Inicia sesión y regatea para entrar en la lista de jugadores.', 'Deine Reviere und deine Serie auf diesem Gerät. Melde dich an und segle, um in die Spielerliste zu kommen.', 'Bu cihazdaki yarış alanların ve serin. Oyuncu listesine girmek için giriş yap ve yarış.', 'Tes plans d’eau et ta série sur cet appareil. Connecte-toi et régate pour figurer dans la liste des joueurs.', 'I tuoi campi di regata e la tua serie su questo dispositivo. Accedi e regata per entrare nella lista dei giocatori.', 'Suas raias e sua sequência neste aparelho. Entre e corra para aparecer na lista de jogadores.')}</p>
        </>) : player ? (<>
          <h1 className="bt-h bt-h-boat" key={player.k}>{/* eslint-disable-next-line @next/next/no-img-element */}{(() => { const f = findFlag(player.fl || undefined); return f ? <img className="bt-h-flag" src={flagSrc(f.code)} alt={t(f.en, f.ru, f.es, f.de, f.tr, f.fr, f.it, f.pt)} /> : <NoFlag className="bt-h-flag" />; })()}<span>{nameOf(player)}</span></h1>
          <p className="bt-p">{player.boat
            ? <>{boat.name ? `${boat.name} · ` : null}{`${boat.nat} ${boat.num || '1'}`.trim()} · {t('Their colours on the JPK 1050. Drag to circle her.', 'Их цвета на JPK 1050. Тяни, чтобы облететь яхту.', 'Sus colores en el JPK 1050. Arrastra para rodearlo.', 'Ihre Farben auf der JPK 1050. Ziehen, um sie zu umkreisen.', 'JPK 1050’deki renkleri. Çevresinde dönmek için sürükle.', 'Ses couleurs sur le JPK 1050. Fais glisser pour tourner autour.', 'I suoi colori sul JPK 1050. Trascina per girarle intorno.', 'As cores do jogador no JPK 1050. Arraste para dar a volta nele.')}</>
            : t('Their colours aren’t kept online, so this is the boat everyone starts in. Drag to circle her.', 'Их цвета не сохранены онлайн, поэтому здесь яхта, с которой начинают все. Тяни, чтобы облететь её.', 'Sus colores no se guardan en línea, así que este es el barco con el que empieza todo el mundo. Arrastra para rodearlo.', 'Ihre Farben werden nicht online gespeichert, das hier ist also das Boot, mit dem alle starten. Ziehen, um sie zu umkreisen.', 'Renkleri çevrimiçi saklanmıyor, bu yüzden bu, herkesin başladığı tekne. Çevresinde dönmek için sürükle.', 'Ses couleurs ne sont pas gardées en ligne : voici le bateau avec lequel tout le monde commence. Fais glisser pour tourner autour.', 'I suoi colori non sono conservati online, quindi questa è la barca con cui partono tutti. Trascina per girarle intorno.', 'As cores do jogador não ficam guardadas online, então este é o barco com que todo mundo começa. Arraste para dar a volta nele.')}</p>
        </>) : (<>
          <h1 className="bt-h">{t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores')}</h1>
          <p className="bt-p">{missing
            ? t('That player isn’t on the list any more. Pick one from the table to see their numbers and their boat.', 'Этого игрока больше нет в списке. Выбери игрока в таблице, чтобы увидеть его цифры и яхту.', 'Ese jugador ya no está en la lista. Elige uno de la tabla para ver sus números y su barco.', 'Dieser Spieler steht nicht mehr auf der Liste. Wähl einen aus der Tabelle, um seine Zahlen und sein Boot zu sehen.', 'Bu oyuncu artık listede değil. Rakamlarını ve teknesini görmek için tablodan birini seç.', 'Ce joueur n’est plus dans la liste. Choisis-en un dans le tableau pour voir ses chiffres et son bateau.', 'Quel giocatore non è più nella lista. Scegline uno dalla tabella per vedere i suoi numeri e la sua barca.', 'Esse jogador não está mais na lista. Escolha um na tabela para ver os números e o barco dele.')
            : t('Everyone who races signed in, the most points first. Pick a player to see their numbers and their boat in their own colours.', 'Все, кто гоняется со входом в аккаунт, — больше всего очков сверху. Выбери игрока, чтобы увидеть его цифры и яхту в его цветах.', 'Todos los que regatean con sesión iniciada, primero los de más puntos. Elige un jugador para ver sus números y su barco con sus propios colores.', 'Alle, die angemeldet segeln, die meisten Punkte zuerst. Wähl einen Spieler, um seine Zahlen und sein Boot in seinen eigenen Farben zu sehen.', 'Giriş yapıp yarışan herkes, en çok puanlı önce. Rakamlarını ve teknesini kendi renklerinde görmek için bir oyuncu seç.', 'Tous ceux qui régatent connectés, les plus de points en premier. Choisis un joueur pour voir ses chiffres et son bateau à ses couleurs.', 'Tutti quelli che regatano con l’accesso, prima chi ha più punti. Scegli un giocatore per vedere i suoi numeri e la sua barca nei suoi colori.', 'Todos que correm conectados, os com mais pontos primeiro. Escolha um jogador para ver os números dele e o barco com as cores dele.')}</p>
        </>)}
      </div>

      <PauseCard lang={lang} back={passport ? passport.path : href(page, player?.k)} className="pl-card" cardRef={card} busy={pending}
        title={passport ? passTitle : player ? nameOf(player) : `${t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores')}${list ? ` · ${num(list.total)}` : ''}`} icon={player || passport ? undefined : <IconCrew s={14} />}
        note={!player && !passport && list && list.pages > 1 ? t(`Page ${page} of ${list.pages}`, `Страница ${page} из ${list.pages}`, `Página ${page} de ${list.pages}`, `Seite ${page} von ${list.pages}`, `Sayfa ${page} / ${list.pages}`, `Page ${page} sur ${list.pages}`, `Pagina ${page} di ${list.pages}`, `Página ${page} de ${list.pages}`) : undefined}
        action={passport ? <a className="bt-go" href="/play?race=today">{t('Sail today’s race', 'Пройди гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık', 'Cours la régate du jour', 'Corri la regata del giorno', 'Velejar a regata do dia')}</a> : undefined}
        tools={player || passport ? <Link className="bt-mini" href={href(player ? page : 1)} scroll={false} onClick={(e) => { e.preventDefault(); go(href(player ? page : 1), null); }}><IconBack s={14} /><span>{t('All players', 'Все игроки', 'Todos los jugadores', 'Alle Spieler', 'Tüm oyuncular', 'Tous les joueurs', 'Tutti i giocatori', 'Todos os jogadores')}</span></Link> : undefined}>
        {passport ? (<>
          {passFacts ? <PassportBlock lang={lang} facts={passFacts} mine={own} share={own && log && passFacts.n ? shareBtn(log) : undefined} /> : null}
          <div className="bt-rows">
            {own ? <Link className="bt-row if-guest" href={`/sign-in?next=${encodeURIComponent('/players?me=1')}`}><IconCrew s={18} /><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</span><span className="bt-row-m">{t('Keep it on every device', 'Сохрани на всех устройствах', 'Guárdalo en todos tus dispositivos', 'Auf jedem Gerät behalten', 'Her cihazda sakla', 'À retrouver sur tous tes appareils', 'Conservalo su ogni dispositivo', 'Guarde em todos os aparelhos')}</span></Link> : null}
            <Link className="bt-row" href="/"><IconSail s={18} /><span>{t('What the game is', 'Что это за игра', 'Qué es el juego', 'Was das Spiel ist', 'Oyun nedir', 'Le jeu, c’est quoi', 'Cos’è il gioco', 'O que é o jogo')}</span></Link>
          </div>
        </>) : player ? (<>
          <div className="bt-seg" role="radiogroup" aria-label={t('Point of sail', 'Курс', 'Rumbo', 'Kurs zum Wind', 'Seyir yönü', 'Allure', 'Andatura', 'Rumo')}>
            <button type="button" role="radio" aria-checked={!down} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд', 'Ceñida', 'Am Wind', 'Orsa', 'Au près', 'Di bolina', 'Contravento')}</button>
            <button type="button" role="radio" aria-checked={down} onClick={() => setDown(true)}>{t('Gennaker', 'Генакер', 'Gennaker', 'Gennaker', 'Gennaker', 'Gennaker', 'Gennaker', 'Gennaker')}</button>
          </div>
          <TabBar lang={lang} tab={shown} set={setTab} duel={mine} />

          {shown === 'over' && (<div className="pt-p" role="tabpanel" id="pt-p-over" aria-labelledby="pt-over">
          <div className="fl-stats pl-stats">
            <div><span className="bt-sk">{t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas')}</span><b>{num(player.n)}</b></div>
            <div><span className="bt-sk">{t('Finished', 'Финиш', 'Terminada', 'Beendet', 'Bitirdi', 'Terminée', 'Finita', 'Terminada')}</span><b>{player.n ? `${Math.round((100 * player.fin) / player.n)}%` : '–'}</b></div>
            <div><span className="bt-sk">{t('Wins', 'Побед', 'Victorias', 'Siege', 'Galibiyet', 'Victoires', 'Vittorie', 'Vitórias')}</span><b>{num(player.wins)}</b></div>
            <div><span className="bt-sk">{t('Podiums', 'Подиумов', 'Podios', 'Podien', 'Podyum', 'Podiums', 'Podi', 'Pódios')}</span><b>{num(player.podiums)}</b></div>
            <div><span className="bt-sk">{t('Days', 'Дней', 'Días', 'Tage', 'Gün', 'Jours', 'Giorni', 'Dias')}</span><b>{num(player.days)}</b></div>
            <div><span className="bt-sk">{t('Best place', 'Лучшее место', 'Mejor puesto', 'Bester Platz', 'En iyi sıra', 'Meilleure place', 'Miglior posizione', 'Melhor posição')}</span><b>{place(player.best)}</b></div>
            <div><span className="bt-sk">DSQ</span><b>{player.dsq ? num(player.dsq) : '–'}</b></div>
            <div><span className="bt-sk">{t('Last race', 'Последняя', 'Última regata', 'Letzte Regatta', 'Son yarış', 'Dernière régate', 'Ultima regata', 'Última regata')}</span><b className="pl-d">{date(player.last, false)}</b></div>
            <span className="bt-sv">{player.best && player.fleet ? t(`Best: ${place(player.best)} of ${player.fleet} boats. `, `Лучшее: ${player.best}-е из ${player.fleet}. `, `Mejor: ${place(player.best)} de ${player.fleet} barcos. `, `Beste: ${place(player.best)} von ${player.fleet} Booten. `, `En iyi: ${player.fleet} tekne içinde ${place(player.best)}. `, `Meilleure : ${place(player.best)} sur ${player.fleet} bateaux. `, `Miglior piazzamento: ${place(player.best)} su ${player.fleet} barche. `, `Melhor: ${place(player.best)} de ${player.fleet} barcos. `) : ''}{t(`Racing since ${date(player.first)}.`, `Гоняется с ${date(player.first)}.`, `Regatea desde ${date(player.first)}.`, `Segelt seit ${date(player.first)}.`, `${date(player.first)} tarihinden beri yarışıyor.`, `Régate depuis le ${date(player.first)}.`, `In regata dal ${date(player.first)}.`, `Corre desde ${date(player.first)}.`)}</span>
          </div>

          {mine && <MyDuelRating lang={lang} />}{/* your 1-on-1 rating: your own card alone */}
          {mine && <MyAchievements lang={lang} />}{/* your achievements, the same on every device: your own card alone */}

          <div className="bt-g">
            <span className="bt-k"><IconTrophy s={14} />{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno', 'A regata do dia')}</span>
            {player.daily.n ? (
              <dl className="yt-spec pl-spec">
                <div><dt>{t('Points', 'Очков', 'Puntos', 'Punkte', 'Puan', 'Points', 'Punti', 'Pontos')}</dt><dd>{num(player.pts)}</dd></div>
                <div><dt>{t('Days ranked', 'Дней в рейтинге', 'Días clasificado', 'Tage in der Rangliste', 'Sıralanan günler', 'Jours classés', 'Giorni in classifica', 'Dias classificado')}</dt><dd>{num(player.daily.days)}</dd></div>
                <div><dt>{t('Days won', 'Дней первым', 'Días ganados', 'Tage gewonnen', 'Kazanılan günler', 'Jours gagnés', 'Giorni vinti', 'Dias com vitória')}</dt><dd>{num(player.daily.wins)}</dd></div>
                <div><dt>{t('Days in the top 3', 'Дней в топ-3', 'Días en el top 3', 'Tage in den Top 3', 'İlk 3’te geçen günler', 'Jours dans le top 3', 'Giorni nei primi 3', 'Dias no top 3')}</dt><dd>{num(player.daily.podiums)}</dd></div>
              </dl>
            ) : <p className="bt-hint">{t('Not sailed yet: every day a new race, the same for everyone.', 'Ещё не ходил: каждый день новая гонка, одна для всех.', 'Aún sin navegar: cada día una regata nueva, la misma para todos.', 'Noch nicht gesegelt: jeden Tag eine neue Regatta, für alle dieselbe.', 'Henüz yarışılmadı: her gün yeni bir yarış, herkes için aynı.', 'Pas encore navigué : chaque jour une nouvelle régate, la même pour tous.', 'Non ancora regatato: ogni giorno una nuova regata, la stessa per tutti.', 'Ainda não correu: todo dia uma regata nova, a mesma para todos.')}</p>}
          </div>

          <div className="bt-g">
            <span className="bt-k"><IconKite s={14} />{t('Their boat', 'Их яхта', 'Su barco', 'Ihr Boot', 'Teknesi', 'Son bateau', 'La sua barca', 'O barco dele')}</span>
            {player.boat ? (
              <dl className="yt-spec pl-spec">
                {boat.name && <div><dt>{t('Name', 'Имя', 'Nombre', 'Name', 'İsim', 'Nom', 'Nome', 'Nome')}</dt><dd>{boat.name}</dd></div>}
                <div><dt>{t('Sail number', 'Номер', 'Número de vela', 'Segelnummer', 'Yelken numarası', 'Numéro de voile', 'Numero velico', 'Número de vela')}</dt><dd>{`${boat.nat} ${boat.num || '1'}`.trim()}</dd></div>
                <div><dt>{t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler', 'Couleurs', 'Colori', 'Cores')}</dt><dd className="pl-sws">
                  {[boat.hull, boat.cloth, boat.kite, boat.crew].filter(Boolean).map((c, i) => <i key={i} style={{ background: c }} />)}
                </dd></div>
                <div><dt>{t('Deck', 'Палуба', 'Cubierta', 'Deck', 'Güverte', 'Pont', 'Coperta', 'Convés')}</dt><dd>{boat.deck === 'teak' ? t('Teak', 'Тик', 'Teca', 'Teak', 'Tik', 'Teck', 'Teak', 'Teca') : boat.deck === 'hull' ? t('Hull colour', 'В цвет корпуса', 'Color del casco', 'Rumpffarbe', 'Gövde rengi', 'Couleur de coque', 'Colore dello scafo', 'Cor do casco') : t('Non-skid', 'Нескользящая', 'Antideslizante', 'Rutschfest', 'Kaymaz yüzey', 'Antidérapant', 'Antiscivolo', 'Antiderrapante')}</dd></div>
                <div><dt>{t('Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler', 'Voiles', 'Vele', 'Velas')}</dt><dd>{boat.laminate ? t('Laminate', 'Ламинат', 'Laminado', 'Laminat', 'Laminat', 'Laminé', 'Laminato', 'Laminado') : t('Dacron', 'Дакрон', 'Dacron', 'Dacron', 'Dacron', 'Dacron', 'Dacron', 'Dacron')}</dd></div>
                <div><dt>{t('Flag', 'Флаг', 'Bandera', 'Flagge', 'Bayrak', 'Pavillon', 'Bandiera', 'Bandeira')}</dt><dd>{flag ? t(flag.en, flag.ru, flag.es, flag.de, flag.tr, flag.fr, flag.it, flag.pt) : '–'}</dd></div>
              </dl>
            ) : <p className="bt-hint">{t('They race inside Telegram or haven’t changed their boat, so the site doesn’t keep their colours: the scene shows the boat everyone starts in.', 'Они гоняются в Telegram или не меняли яхту, поэтому сайт не хранит их цвета: в сцене яхта, с которой начинают все.', 'Regatean dentro de Telegram o no han cambiado su barco, así que el sitio no guarda sus colores: la escena muestra el barco con el que empieza todo el mundo.', 'Sie segeln in Telegram oder haben ihr Boot nicht geändert, also speichert die Seite ihre Farben nicht: Die Szene zeigt das Boot, mit dem alle starten.', 'Telegram içinde yarışıyor ya da teknesini değiştirmedi, bu yüzden site renklerini saklamıyor: sahne herkesin başladığı tekneyi gösteriyor.', 'Ce joueur régate dans Telegram ou n’a pas modifié son bateau, donc le site ne garde pas ses couleurs : la scène montre le bateau avec lequel tout le monde commence.', 'Regata dentro Telegram o non ha cambiato la sua barca, quindi il sito non conserva i suoi colori: la scena mostra la barca con cui partono tutti.', 'Esse jogador corre dentro do Telegram ou não mudou o barco, então o site não guarda as cores dele: a cena mostra o barco com que todo mundo começa.')}</p>}
          </div>

          <div className="bt-g">
            <span className="bt-k"><IconSail s={14} />{t('Yachts they sail', 'На чём ходят', 'Yates en los que navegan', 'Yachten, die sie segeln', 'Yarıştığı yatlar', 'Ses yachts', 'Gli yacht con cui regata', 'Veleiros em que corre')}</span>
            <dl className="yt-spec pl-spec">
              {player.yachts.slice(0, 6).map((y) => <div key={y.id}><dt>{yachtName(y.id)}</dt><dd>{races(y.n)}</dd></div>)}
            </dl>
          </div>

          </div>)}
          {shown === 'duel' && mine && <DuelTab lang={lang} />}
          {shown === 'daily' && <DailyTab lang={lang} k={player.k} mine={mine} />}
          {shown === 'venues' && (<div className="pt-p" role="tabpanel" id="pt-p-venues" aria-labelledby="pt-venues">
            <PassportBlock lang={lang} facts={cardFacts(player)} mine={mine} share={mine && log ? shareBtn(log) : undefined} />
            <VenueCounts lang={lang} venues={player.venues} />
          </div>)}

          <div className="bt-rows">
            <Link className="bt-row" href="/race#board"><IconTrophy s={18} /><span>{t('The leaderboard', 'Рейтинг', 'La clasificación', 'Die Rangliste', 'Sıralama', 'Le classement', 'La classifica', 'A classificação')}</span><span className="bt-row-m">{t('Today and the month', 'День и месяц', 'Hoy y el mes', 'Heute und der Monat', 'Bugün ve ay', 'Aujourd’hui et le mois', 'Oggi e il mese', 'Hoje e o mês')}</span></Link>
          </div>
        </>) : (<>
          {!list ? (
            <p className="bt-hint">{t('The players can’t be had just now. Try again in a minute.', 'Список игроков сейчас недоступен. Попробуй через минуту.', 'Ahora mismo no se pueden obtener los jugadores. Inténtalo de nuevo en un minuto.', 'Die Spieler lassen sich gerade nicht laden. Versuch es in einer Minute nochmal.', 'Oyunculara şu an ulaşılamıyor. Bir dakika sonra yeniden dene.', 'Impossible d’afficher les joueurs pour l’instant. Réessaie dans une minute.', 'I giocatori non sono disponibili in questo momento. Riprova tra un minuto.', 'Não foi possível buscar os jogadores agora. Tente de novo em um minuto.')}</p>
          ) : list.rows.length === 0 ? (
            <p className="bt-hint">{t('Nobody yet. Sign in and race to be the first.', 'Пока никого. Войди и пройди гонку — будешь первым.', 'Nadie todavía. Inicia sesión y regatea para ser el primero.', 'Noch niemand. Melde dich an und segle, um der Erste zu sein.', 'Henüz kimse yok. Giriş yap ve ilk olmak için yarış.', 'Personne pour l’instant. Connecte-toi et régate pour être le premier.', 'Ancora nessuno. Accedi e regata per essere il primo.', 'Ninguém ainda. Entre e corra para ser o primeiro.')}</p>
          ) : (<>
            <div className="pl-tab" role="table" aria-label={t('The players', 'Игроки', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori', 'Os jogadores')}>
              <div className="pl-tr pl-th" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">{t('Player', 'Игрок', 'Jugador', 'Spieler', 'Oyuncu', 'Joueur', 'Giocatore', 'Jogador')}</span>
                <span role="columnheader" title={t('Points on the leaderboard, every day added up', 'Очки рейтинга за все дни', 'Puntos de la clasificación, sumando todos los días', 'Punkte in der Rangliste, jeder Tag zusammengezählt', 'Sıralamadaki puanlar, her günün toplamı', 'Points au classement, tous les jours additionnés', 'Punti in classifica, sommati giorno per giorno', 'Pontos na classificação, todos os dias somados')} aria-sort="descending">{t('Pts', 'Очки', 'Pts', 'Pkt', 'Puan', 'Pts', 'Pt', 'Pts')}</span>
                <span role="columnheader" title={t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas')}>{t('Races', 'Гонок', 'Regatas', 'Regatten', 'Yarışlar', 'Régates', 'Regate', 'Regatas')}</span>
                <span role="columnheader" title={t('Wins', 'Побед', 'Victorias', 'Siege', 'Galibiyet', 'Victoires', 'Vittorie', 'Vitórias')}>{t('Wins', 'Побед', 'Victorias', 'Siege', 'Galibiyet', 'Victoires', 'Vittorie', 'Vitórias')}</span>
                <span role="columnheader" title={t('Podiums', 'Подиумов', 'Podios', 'Podien', 'Podyum', 'Podiums', 'Podi', 'Pódios')}>{t('Top 3', 'Топ-3', 'Top 3', 'Top 3', 'İlk 3', 'Top 3', 'Primi 3', 'Top 3')}</span>
              </div>
              {list.rows.map((r, i) => {
                const to = href(page, r.k);
                return (
                  <Link key={r.k} href={to} scroll={false} role="row" className="pl-tr" aria-busy={going === r.k}
                    onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(to, r.k); }}>
                    <span role="cell" className="pl-i">{(page - 1) * list.per + i + 1}</span>
                    <span role="cell" className="pl-who">
                      <span className="pl-fl"><FlagImg code={r.fl} lang={lang} /></span>
                      <span className="pl-nm"><b>{nameOf(r)}</b><small>{yachtName(r.yacht)}</small></span>
                    </span>
                    <span role="cell" className="pl-pts">{num(r.pts)}</span>
                    <span role="cell">{num(r.n)}</span>
                    <span role="cell">{r.wins ? num(r.wins) : '–'}</span>
                    <span role="cell">{r.podiums ? num(r.podiums) : '–'}</span>
                  </Link>
                );
              })}
            </div>
            {list.pages > 1 && (
              <nav className="pl-pages" aria-label={t('Pages', 'Страницы', 'Páginas', 'Seiten', 'Sayfalar', 'Pages', 'Pagine', 'Páginas')}>
                <Link className="fl-btn" href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} scroll={false}
                  onClick={(e) => { e.preventDefault(); if (page > 1) go(href(page - 1), null); }} aria-label={t('Previous page', 'Предыдущая страница', 'Página anterior', 'Vorherige Seite', 'Önceki sayfa', 'Page précédente', 'Pagina precedente', 'Página anterior')}><IconBack s={16} /></Link>
                {Array.from({ length: list.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === list.pages || Math.abs(n - page) <= 1).map((n, i, a) => (
                  <span key={n} className="pl-pn">
                    {i > 0 && n - a[i - 1] > 1 && <span className="pl-gap" aria-hidden="true">…</span>}
                    <Link className="fl-btn" href={href(n)} scroll={false} aria-current={n === page ? 'page' : undefined}
                      onClick={(e) => { e.preventDefault(); if (n !== page) go(href(n), null); }}>{n}</Link>
                  </span>
                ))}
                <Link className="fl-btn" href={href(page + 1)} aria-disabled={page >= list.pages} tabIndex={page >= list.pages ? -1 : undefined} scroll={false}
                  onClick={(e) => { e.preventDefault(); if (page < list.pages) go(href(page + 1), null); }} aria-label={t('Next page', 'Следующая страница', 'Página siguiente', 'Nächste Seite', 'Sonraki sayfa', 'Page suivante', 'Pagina successiva', 'Próxima página')}><IconArrow s={16} /></Link>
              </nav>
            )}
            <p className="bt-hint">{t('Points are the leaderboard’s, every day of today’s race added up: of N players ranked on a day, the first gets N and the last 1. Wins and podiums count every race, custom races too. Guests aren’t on it: sign in and race to be.', 'Очки — рейтинговые, за все дни гонки дня: из N игроков в рейтинге дня первый получает N, последний — 1. Победы и подиумы — во всех гонках, и в свободных тоже. Гостей здесь нет: войди и пройди гонку, чтобы попасть сюда.', 'Los puntos son los de la clasificación, sumando cada día de la regata del día: de N jugadores clasificados en un día, el primero recibe N y el último 1. Las victorias y los podios cuentan todas las regatas, también las personalizadas. Los invitados no entran: inicia sesión y regatea para entrar.', 'Die Punkte sind die der Rangliste, jeder Tag der Regatta des Tages zusammengezählt: von N an einem Tag gerankten Spielern bekommt der Erste N und der Letzte 1. Siege und Podien zählen jede Regatta, auch eigene. Gäste sind nicht dabei: Melde dich an und segle, um dabei zu sein.', 'Puanlar sıralamadaki puanlardır, günün yarışının her günü toplanarak: bir günde sıralanan N oyuncudan birinci N, sonuncu 1 puan alır. Galibiyetler ve podyumlar tüm yarışları sayar, serbest yarışlar da. Misafirler listede değil: girmek için giriş yap ve yarış.', 'Les points sont ceux du classement, tous les jours de la régate du jour additionnés : sur N joueurs classés un jour, le premier reçoit N et le dernier 1. Les victoires et les podiums comptent toutes les régates, régates libres comprises. Les invités n’y figurent pas : connecte-toi et régate pour y être.', 'I punti sono quelli della classifica, sommati per ogni giorno della regata del giorno: su N giocatori in classifica in un giorno, il primo ne prende N e l’ultimo 1. Vittorie e podi contano ogni regata, anche le regate libere. Gli ospiti non ci sono: accedi e regata per esserci.', 'Os pontos são os da classificação, somando cada dia da regata do dia: de N jogadores classificados em um dia, o primeiro ganha N e o último 1. Vitórias e pódios contam todas as regatas, as regatas livres também. Convidados não aparecem: entre e corra para aparecer.')}</p>
          </>)}
        </>)}
      </PauseCard>
    </div>
  );
}
