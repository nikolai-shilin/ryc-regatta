'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { pick, tx, type Lang } from '@/lib/lang';
import { levelName } from '@/lib/levels';
import { provisional, shown, stakes, signed as sgn } from '@/lib/elo';
import { isHandle, parseReady, parseSeek, raceHref, type Pair, type Ready, type Seek } from '@/lib/duel-seek';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { track } from '@/lib/track';
import { preloadRace } from '@/lib/duel-preload';
import { callCode, callHref, parsePosted } from '@/lib/duel-call';
import { shareHref } from '@/lib/share';
import { linkPush, pushable, subscribe } from '@/lib/push';
import { readLog } from '@/lib/log';
import { IconPlay } from './ui';
import { SHAPE_NAME } from '@/lib/race';
import { DuelHour } from './duel-hour';
import { hourAt } from '@/lib/duel-hour';
import { parseMine, type MyRating } from '@/lib/duel-rating';
import { parseCalls, parseNear, type Call, type Near } from '@/lib/duel-page';
import { HudCells, ReadyTable, OpenCalls, LastRaces, NearTable, RATING_HREF } from './duel-page';
import { GameScene } from './game-scene';
import { BackLink } from './back-link';
import { SceneBrand } from './scene-brand';
import type { ReactNode } from 'react';
import '@/styles/duel-rating.css';
import '@/styles/duel-page.css';

// Find a race (app/[lang]/duel/page.tsx): a signed-in sailor is matched with another of about their rating (POST
// /connect/seek, the database's regatta_seek): Looking (how long, the band, how many are looking), then Match found with ten
// seconds to say Ready (a sailor with fewer than five rated races sees the short one: who, about how long, Ready; the rest
// also their chance and what a win or a loss would do), then both are sent into the same race: the host's screen hosts it
// with the pair's settings, as a race set up on /match/new is, and starts it once the guest is in (?auto). Asked every 3 s
// while looking, every second once found. Nobody after 1:30: keep looking, or send a friend a link instead.
// Ready now: who else is looking at this moment, nearest your rating first (read every 10 s), each with Race, which
// challenges that sailor directly whatever the gap in rating (regatta_seek_challenge): both get Match found as above.
// The race's files start loading the moment a match is found (lib/duel-preload.ts), and the card says how far: by
// Ready the game opens on a browser that has them.
// While looking, Post an open call gives a link for any chat (lib/duel-call.ts): the first sailor in the band who opens
// it and takes it (/call/[code] → /duel?take=<code>) is paired with this one, as a challenge is.
// Keep looking if I leave: on a device that can take a push (lib/push.ts, tied to the account), the search goes on for
// 30 minutes after the page is gone, and Match found comes as a message with a minute to say Ready (lib/push-send.ts);
// its tap opens /duel?resume, which looks again and finds the pair waiting.
// The duel hour (components/duel-hour.tsx): every day 19:00–20:00 UTC, in Ready now; its message opens /duel?hour, which
// starts looking, and while it's on Ready now says so.
// Opened from the home's Race (/duel?challenge=<handle>, components/duel-home.tsx), it challenges that sailor at once.
// The wishes, a venue and a yacht, kept on this device, are the race's from a sailor's fourth rated race (the host's first).
// Laid out as the page was designed (components/duel-page.tsx): the hero with your rating, then the set-up card (whatever
// the search is doing) beside Ready now as a table, the open calls to take (read with Ready now), your last races and
// the 1-on-1 rating around you (GET /connect/rating/me and /connect/rating/near, once).
type Phase = 'idle' | 'looking' | 'found' | 'go' | 'missed' | 'error';
type Note = '' | 'noanswer' | 'declined' | 'gone' | 'taken' | 'away' | 'closed' | 'band' | 'mine' | 'nocall' | 'nopush' | 'pushdenied' | 'noaway' | 'nobot' | 'quiet' | 'msgoff';
export type OpenCall = { code: string; lo: number; hi: number; url: string };
export type Wishes = { venue?: string; yacht?: string };
const LOOK_MS = 3000, FOUND_MS = 1000, OFFER_AFTER_S = 90, LIST_MS = 10000, WISH_KEY = 'regatta-duel-wishes';

const post = async (body: object): Promise<Seek> => {
  try {
    const r = await fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body), keepalive: true });
    return r.ok ? parseSeek(await r.json()) : { status: 'none', reason: null };
  } catch { return { status: 'none', reason: null }; }
};

// the host's screen is given the race as /match/new gives it (components/free-setup.tsx): its code and settings
function handOver(p: Pair) {
  if (p.role === 'host') {
    try {
      localStorage.setItem('regatta-match-host', JSON.stringify({ code: p.code }));
      localStorage.setItem('regatta-match-settings', JSON.stringify(p.settings));
    } catch { /* storage blocked: the game still opens at the code */ }
  }
  location.href = raceHref(p);
}

const readWishes = (): Wishes => { try { const w = JSON.parse(localStorage.getItem(WISH_KEY) || '{}'); return { ...(VENUES.some((v) => v.id === w.venue) && { venue: w.venue }), ...(YACHTS.some((y) => y.id === w.yacht) && { yacht: w.yacht }) }; } catch { return {}; } };

export function DuelFinder({ lang, signed, children }: { lang: Lang; signed: boolean; children?: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [list, setList] = useState<Ready[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [mine, setMine] = useState<MyRating | null | undefined>(signed ? undefined : null);
  const [near, setNear] = useState<Near | null | undefined>(signed ? undefined : null);
  const [filter, setFilter] = useState<'level' | 'all' | null>(null); // null: my level when anyone is near it, else everyone
  const wantCall = useRef(false); // Open call chosen while not looking: posted once the first answer says looking
  const [wishes, setWishes] = useState<Wishes>({});
  const wishesRef = useRef<Wishes>({});
  const [look, setLook] = useState<{ waited: number; band: number; online: number; near?: number }>({ waited: 0, band: 100, online: 0 });
  const [pair, setPair] = useState<Pair | null>(null);
  const [said, setSaid] = useState(false); // this sailor said Ready to the pair on screen
  const [note, setNote] = useState<Note>('');
  const [call, setCall] = useState<OpenCall | null>(null); // this sailor's open call, posted while looking
  const [away, setAway] = useState(false); const awayRef = useRef(false); // looked for after leaving the page
  const keepAway = (v: boolean) => { awayRef.current = v; setAway(v); };
  const [left, setLeft] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null); // the share of the race's files fetched, once a match is found
  const preload = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), on = useRef(false), pairRef = useRef<Pair | null>(null), saidRef = useRef(false), started = useRef(0), foundAt = useRef(0);

  const stopTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const apply = useCallback((s: Seek) => {
    if (!on.current) return;
    if (s.status === 'go') { on.current = false; setPair(s.pair); setPhase('go'); track('Duel match', { role: s.pair.role }); handOver(s.pair); return; }
    if (s.status === 'found') {
      if (pairRef.current?.id !== s.pair.id) {
        foundAt.current = Date.now(); setCall(null); keepAway(false);
        preload.current?.abort(); const ac = preload.current = new AbortController(); setLoaded(0);
        preloadRace(s.pair.settings.venue, s.pair.settings.yacht, (x) => { if (!ac.signal.aborted) setLoaded(x); }, ac.signal);
      }
      pairRef.current = s.pair; setPair(s.pair); setLeft(s.pair.left); setPhase('found');
      timer.current = setTimeout(ask, FOUND_MS);
      return;
    }
    // the pair gone: before its time was up the other said no; after it, whoever hadn't said Ready let it go. This sailor's
    // own silence is a miss (the database dropped her; asking again would only look afresh): stop, and say so
    const had = pairRef.current, wasReady = saidRef.current, early = had && Date.now() - foundAt.current < (had.ttl - 1) * 1000;
    if (had) { preload.current?.abort(); preload.current = null; setLoaded(null); }
    pairRef.current = null; saidRef.current = false; setSaid(false); setPair(null);
    if (had && !wasReady && !early) { on.current = false; setPhase('missed'); post({ do: 'stop' }); return; }
    if (had) setNote(early ? 'declined' : 'noanswer');
    if (s.status === 'looking') {
      setLook({ waited: s.waited, band: s.band, online: s.online, near: s.near }); keepAway(s.away); setPhase('looking');
      if (wantCall.current) { wantCall.current = false; postCall(); }
      timer.current = setTimeout(ask, LOOK_MS);
      return;
    }
    // none: the pair missed while this sailor didn't say Ready, or the asking failed
    on.current = false; setPhase(had ? 'missed' : 'error');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = useCallback(async () => { if (!on.current) return; apply(await post({ do: 'seek', wishes: wishesRef.current })); }, [apply]);

  const find = () => { stopTimer(); on.current = true; started.current = Date.now(); setNote(''); setPhase('looking'); track('Duel find', {}); ask(); };
  const stop = () => { stopTimer(); on.current = false; pairRef.current = null; setPair(null); setCall(null); keepAway(false); setPhase('idle'); post({ do: 'stop' }); };
  // Keep looking if I leave: the browser's permission and subscription (the daily reminder's), tied to this account,
  // then the database told; or back to looking only while here
  const awayOn = async () => {
    setNote('');
    const ask = async () => {
      try { const r = await fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ do: 'away', on: true }) }); return r.ok ? await r.json().catch(() => null) : null; } catch { return null; }
    };
    // a device already tied to the account, or the Telegram bot, may reach this sailor: asked first
    let j = await ask();
    if (j?.status !== 'away' && j?.reason === 'no_push') {
      const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; requestWriteAccess?: (cb: (ok: boolean) => void) => void } } }).Telegram?.WebApp;
      if (tg?.initData && tg.requestWriteAccess) {
        // inside Telegram: the bot's leave to write (it hears the answer, and remembers this sailor), then asked again
        const ok = await new Promise<boolean>((res) => { try { tg.requestWriteAccess!((a) => res(!!a)); } catch { res(false); } });
        if (!ok) { setNote('nobot'); return; }
        await new Promise((r) => setTimeout(r, 1500));
        j = await ask();
      } else if (pushable()) {
        const st = await subscribe(lang, readLog());
        if (st !== 'on') { setNote(st === 'denied' ? 'pushdenied' : 'nopush'); return; }
        await linkPush();
        j = await ask();
      } else { setNote('nopush'); return; }
    }
    if (j?.status === 'away') { keepAway(true); track('Duel away', {}); } else setNote(j?.reason === 'no_push' ? 'nopush' : j?.reason === 'quiet' ? 'quiet' : j?.reason === 'off' ? 'msgoff' : 'noaway');
  };
  const callNow = () => { if (on.current && phase === 'looking') postCall(); else { wantCall.current = true; find(); } };
  const awayOff = () => { keepAway(false); fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ do: 'away', on: false }) }).catch(() => {}); };
  // an open call, while looking: its link to share (the call lives while this page goes on looking, an hour at most)
  const postCall = async () => {
    let r = null;
    try { r = await fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ do: 'call', wishes: wishesRef.current }) }); } catch { /* said below */ }
    const p = parsePosted(r?.ok ? await r.json().catch(() => null) : null);
    if (p.status === 'open') { setCall({ code: p.code, lo: p.lo, hi: p.hi, url: `${location.origin}${callHref(p.code)}` }); track('Duel call', {}); } else setNote('nocall');
  };
  // an open call taken, from its page (/call/[code] → /duel?take=): paired at once, or told why not
  const take = async (code: string) => {
    stopTimer(); on.current = true; setNote('');
    const s = await post({ do: 'take', code, wishes: wishesRef.current });
    if (s.status === 'none') {
      on.current = false; setPhase('idle');
      setNote((['taken', 'away', 'closed', 'band', 'mine'] as const).find((x) => x === s.reason) ?? 'closed');
      return;
    }
    track('Duel take', {}); apply(s);
  };
  const ready = async () => {
    const p = pairRef.current; if (!p) return;
    saidRef.current = true; setSaid(true);
    stopTimer(); apply(await post({ do: 'ready', pair: p.id }));
  };
  // Race beside a sailor in Ready now: paired with them at once, or told they've gone (looking goes on if it was on)
  const challenge = async (handle: string) => {
    const was = on.current; stopTimer(); on.current = true; setNote('');
    const s = await post({ do: 'challenge', handle, wishes: wishesRef.current });
    if (s.status === 'none') {
      setNote('gone'); readList();
      if (was) timer.current = setTimeout(ask, LOOK_MS); else { on.current = false; setPhase('idle'); }
      return;
    }
    track('Duel challenge', {}); apply(s);
  };
  const setWish = (k: keyof Wishes, v: string) => {
    const w = { ...wishesRef.current }; if (v) w[k] = v; else delete w[k];
    wishesRef.current = w; setWishes(w);
    try { localStorage.setItem(WISH_KEY, JSON.stringify(w)); } catch { /* not kept: still sent while the page is open */ }
  };
  const readList = useCallback(async () => {
    try {
      const r = await fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ do: 'ready_now' }) });
      const j = r.ok ? await r.json() : null;
      setList(parseReady(j?.list)); setCalls(parseCalls(j?.calls));
    } catch { /* the list stays as it was */ }
  }, []);
  const decline = () => { const p = pairRef.current; stopTimer(); preload.current?.abort(); setLoaded(null); on.current = false; pairRef.current = null; setPair(null); setPhase('idle'); if (p) post({ do: 'decline', pair: p.id }); };

  useEffect(() => {
    const w = readWishes(); wishesRef.current = w; setWishes(w);
    // Race on the home: the challenge it names, once (the address loses it, so a reload doesn't ask again)
    const h = new URLSearchParams(location.search).get('challenge');
    if (h !== null) history.replaceState(history.state, '', location.pathname);
    if (signed && isHandle(h)) challenge(h);
    // Take it on a call's page: that call, once
    const c = new URLSearchParams(location.search).get('take');
    if (c !== null) history.replaceState(history.state, '', location.pathname);
    if (signed && callCode(c)) take(callCode(c)!);
    // a Match found message tapped (lib/push-send.ts): look again, and the pair waiting is found
    const resume = new URLSearchParams(location.search).has('resume');
    if (resume) history.replaceState(history.state, '', location.pathname);
    if (signed && resume) find();
    // the duel hour's message tapped (lib/duel-hour.ts): looking at once
    const hour = new URLSearchParams(location.search).has('hour') || new URLSearchParams(location.search).has('find'); // (?find: the home's Find a race, a result's Another 1-on-1 race)
    if (hour) history.replaceState(history.state, '', location.pathname);
    if (signed && hour && !resume) find();
    // a browser that already takes the site's messages: tied to this account, so away works without asking again
    if (signed && pushable() && Notification.permission === 'granted') linkPush();
    // your rating (the hero's panel, the chances in Ready now, your last races) and the rating around you, once
    if (signed) {
      fetch('/connect/rating/me', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => setMine(parseMine(j)), () => setMine(null));
      fetch('/connect/rating/near', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => setNear(parseNear(j)), () => setNear(null));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the duel hour on: marked beside Ready now (checked every 30 s)
  const [hourOn, setHourOn] = useState(false);
  useEffect(() => { const c = () => setHourOn(hourAt().on); c(); const i = setInterval(c, 30_000); return () => clearInterval(i); }, []);
  // Ready now, read every 10 s while the list is on screen (not once a match is found), and not in a hidden tab
  const listed = signed && phase !== 'found' && phase !== 'go';
  useEffect(() => {
    if (!listed) return;
    readList();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') readList(); }, LIST_MS);
    return () => clearInterval(t);
  }, [listed, readList]);
  // the ten seconds, counted down here between answers
  useEffect(() => { if (phase !== 'found') return; const t = setInterval(() => setLeft((x) => Math.max(0, x - 0.25)), 250); return () => clearInterval(t); }, [phase]);
  // leaving the page stops looking
  useEffect(() => {
    const away = () => { if (on.current && !awayRef.current) navigator.sendBeacon?.('/connect/seek', new Blob([JSON.stringify({ do: 'stop' })], { type: 'application/json' })); };
    addEventListener('pagehide', away);
    return () => { removeEventListener('pagehide', away); stopTimer(); preload.current?.abort(); };
  }, []);

  const me = mine?.rating ?? 1500, nearCount = list.filter((r) => Math.abs(r.rating - me) <= 100).length;
  return <DuelFinderView lang={lang} signed={signed} phase={phase} look={look} pair={pair} said={said} left={left} note={note}
    longWait={phase === 'looking' && look.waited >= OFFER_AFTER_S} find={find} stop={stop} ready={ready} decline={decline}
    list={list} challenge={challenge} wishes={wishes} setWish={setWish} loaded={loaded} call={call} postCall={callNow} away={away} awayOn={awayOn} awayOff={awayOff} hourOn={hourOn}
    mine={mine} near={near} calls={calls} take={take} filter={filter ?? (nearCount ? 'level' : 'all')} setFilter={setFilter}>{children}</DuelFinderView>;
}

type ViewProps = { lang: Lang; signed: boolean; phase: Phase; look: { waited: number; band: number; online: number; near?: number }; pair: Pair | null; said: boolean; left: number;
  note: Note; longWait: boolean; find: () => void; stop: () => void; ready: () => void; decline: () => void;
  list?: Ready[]; challenge?: (handle: string) => void; wishes?: Wishes; setWish?: (k: keyof Wishes, v: string) => void; loaded?: number | null;
  call?: OpenCall | null; postCall?: () => void; away?: boolean; awayOn?: () => void; awayOff?: () => void; hourOn?: boolean;
  mine?: MyRating | null; near?: Near | null; calls?: Call[]; take?: (code: string) => void; filter?: 'level' | 'all'; setFilter?: (f: 'level' | 'all') => void; children?: ReactNode };

export function DuelFinderView({ lang, signed, phase, look, pair, said, left, note, longWait, find, stop, ready, decline, list = [], challenge = () => {}, wishes = {}, setWish = () => {}, loaded = null, call = null, postCall = () => {}, away = false, awayOn = () => {}, awayOff = () => {}, hourOn = false,
  mine = signed ? undefined : null, near = signed ? undefined : null, calls = [], take = () => {}, filter = 'all', setFilter = () => {}, children }: ViewProps) {
  const t = tx(lang);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const friend = <Link className="bt-show" href="/match/new">{t('Challenge a friend instead', 'Позвать друга', 'Reta a un amigo', 'Lieber einen Freund herausfordern', 'Bunun yerine bir arkadaşını çağır', 'Défier plutôt un ami', 'Sfida invece un amico', 'Desafiar um amigo')}</Link>;
  const anyone = t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  // why a call couldn't be taken, or posted
  const NOTES: Partial<Record<Note, string>> = {
    taken: t('That call has been taken: someone else got there first.', 'Этот вызов уже приняли: кто-то успел раньше.', 'Ese reto ya está aceptado: alguien llegó antes.', 'Diese Herausforderung ist schon vergeben: jemand war schneller.', 'Bu çağrı alındı: biri senden önce davrandı.', 'Cet appel a déjà été pris : quelqu’un a été plus rapide.', 'Quella sfida è già stata presa: qualcuno è arrivato prima.', 'Esse desafio já foi aceito: alguém chegou antes.'),
    away: t('The sailor who posted that call isn’t looking right now.', 'Автор вызова сейчас не ищет гонку.', 'Quien publicó ese reto no está buscando ahora.', 'Wer diese Herausforderung gestellt hat, sucht gerade nicht.', 'Bu çağrıyı yapan denizci şu an aramıyor.', 'Le marin qui a lancé cet appel ne cherche pas en ce moment.', 'Chi ha lanciato quella sfida ora non sta cercando.', 'Quem publicou esse desafio não está procurando agora.'),
    closed: t('That call has closed.', 'Этот вызов закрыт.', 'Ese reto está cerrado.', 'Diese Herausforderung ist beendet.', 'Bu çağrı kapandı.', 'Cet appel est clos.', 'Quella sfida è chiusa.', 'Esse desafio foi encerrado.'),
    band: t('Your rating is outside that call’s range.', 'Твой рейтинг вне диапазона этого вызова.', 'Tu rating está fuera del rango de ese reto.', 'Deine Wertung liegt außerhalb des Bereichs dieser Herausforderung.', 'Reytingin bu çağrının aralığı dışında.', 'Ton classement est hors de la fourchette de cet appel.', 'Il tuo rating è fuori dall’intervallo di quella sfida.', 'Seu rating está fora da faixa desse desafio.'),
    mine: t('That’s your own call: share it, and someone else takes it.', 'Это твой собственный вызов: поделись им, и его примет кто-то другой.', 'Es tu propio reto: compártelo y otro lo aceptará.', 'Das ist deine eigene Herausforderung: teil sie, dann nimmt sie jemand anderes an.', 'Bu senin çağrın: paylaş, başkası kabul etsin.', 'C’est ton propre appel : partage-le, quelqu’un d’autre le prendra.', 'È la tua sfida: condividila e la prenderà qualcun altro.', 'É o seu próprio desafio: compartilhe e outra pessoa aceita.'),
    nocall: t('The call couldn’t be posted just now. Try again.', 'Вызов сейчас не удалось опубликовать. Попробуй ещё раз.', 'No se pudo publicar el reto ahora. Inténtalo de nuevo.', 'Die Herausforderung ließ sich gerade nicht stellen. Versuch es noch einmal.', 'Çağrı şu an yayınlanamadı. Tekrar dene.', 'L’appel n’a pas pu être lancé. Réessaie.', 'Non è stato possibile lanciare la sfida. Riprova.', 'Não deu para publicar o desafio agora. Tente de novo.'),
    nopush: t('This browser can’t take the site’s messages. On an iPhone, add the site to your Home Screen first.', 'Этот браузер не принимает сообщения сайта. На iPhone сначала добавь сайт на экран «Домой».', 'Este navegador no recibe los mensajes del sitio. En un iPhone, añade antes el sitio a la pantalla de inicio.', 'Dieser Browser kann keine Nachrichten der Seite empfangen. Auf dem iPhone füge die Seite zuerst zum Home-Bildschirm hinzu.', 'Bu tarayıcı sitenin mesajlarını alamıyor. iPhone’da önce siteyi Ana Ekrana ekle.', 'Ce navigateur ne peut pas recevoir les messages du site. Sur iPhone, ajoute d’abord le site à l’écran d’accueil.', 'Questo browser non riceve i messaggi del sito. Su iPhone, aggiungi prima il sito alla schermata Home.', 'Este navegador não recebe as mensagens do site. No iPhone, adicione antes o site à Tela de Início.'),
    pushdenied: t('Messages from this site are blocked in your browser’s settings. Allow them there, then try again.', 'Сообщения этого сайта запрещены в настройках браузера. Разреши их там и попробуй снова.', 'Los mensajes de este sitio están bloqueados en los ajustes del navegador. Permítelos allí y vuelve a intentarlo.', 'Nachrichten dieser Seite sind in den Browser-Einstellungen blockiert. Erlaube sie dort und versuch es noch einmal.', 'Bu sitenin mesajları tarayıcı ayarlarında engelli. Orada izin ver ve tekrar dene.', 'Les messages de ce site sont bloqués dans les réglages du navigateur. Autorise-les là, puis réessaie.', 'I messaggi di questo sito sono bloccati nelle impostazioni del browser. Consentili lì e riprova.', 'As mensagens deste site estão bloqueadas nas configurações do navegador. Permita-as lá e tente de novo.'),
    quiet: t('It’s your quiet hours, so we can’t message you now. You can change them in Settings.', 'Сейчас твои тихие часы — написать тебе не сможем. Их можно поменять в настройках.', 'Son tus horas de silencio: ahora no podemos escribirte. Puedes cambiarlas en Ajustes.', 'Es ist deine Ruhezeit, wir können dir jetzt nicht schreiben. Du kannst sie in den Einstellungen ändern.', 'Sessiz saatlerindesin, şu an sana yazamayız. Ayarlardan değiştirebilirsin.', 'Ce sont tes heures calmes : on ne peut pas t’écrire maintenant. Tu peux les changer dans les Réglages.', 'Sono le tue ore di silenzio: ora non possiamo scriverti. Puoi cambiarle nelle Impostazioni.', 'É o seu horário de silêncio: não podemos te escrever agora. Você pode mudá-lo nas Configurações.'),
    msgoff: t('Match found messages are off in your Settings.', 'Сообщения «Соперник найден» выключены в настройках.', 'Los mensajes de rival encontrado están desactivados en tus Ajustes.', 'Nachrichten „Gegner gefunden“ sind in deinen Einstellungen aus.', 'Rakip bulundu mesajları ayarlarında kapalı.', 'Les messages « adversaire trouvé » sont désactivés dans tes Réglages.', 'I messaggi «avversario trovato» sono disattivati nelle Impostazioni.', 'As mensagens de adversário encontrado estão desligadas nas suas Configurações.'),
    nobot: t('Without the bot’s messages we can’t reach you while you’re away. You can still look while you’re here.', 'Без сообщений от бота мы не сможем позвать тебя, пока тебя нет. Искать, пока ты здесь, можно и так.', 'Sin los mensajes del bot no podemos avisarte mientras no estás. Puedes seguir buscando mientras estés aquí.', 'Ohne Nachrichten vom Bot erreichen wir dich nicht, während du weg bist. Solange du hier bist, kannst du trotzdem suchen.', 'Botun mesajları olmadan sen yokken sana ulaşamayız. Buradayken yine de arayabilirsin.', 'Sans les messages du bot, on ne peut pas te prévenir pendant ton absence. Tu peux toujours chercher tant que tu es là.', 'Senza i messaggi del bot non possiamo avvisarti mentre sei via. Puoi comunque cercare mentre sei qui.', 'Sem as mensagens do bot não conseguimos te avisar enquanto você está fora. Você ainda pode procurar enquanto estiver aqui.'),
    noaway: t('Couldn’t keep looking for you just now. Try again.', 'Сейчас не получилось продолжить поиск без тебя. Попробуй ещё раз.', 'No se pudo seguir buscando por ti ahora. Inténtalo de nuevo.', 'Die Suche ließ sich gerade nicht für dich fortsetzen. Versuch es noch einmal.', 'Senin için aramaya şu an devam edilemedi. Tekrar dene.', 'Impossible de continuer à chercher pour toi pour l’instant. Réessaie.', 'Non è stato possibile continuare a cercare per te. Riprova.', 'Não deu para continuar procurando por você agora. Tente de novo.'),
  };
  const noted = NOTES[note] ? <p className="dr-note">{NOTES[note]}</p> : null;
  // the open call: posted, its link and the ways to send it; else the button that posts one
  const callText = call ? t(`Race me 1-on-1 on Up and down: rated, about 4 minutes, for ratings ${call.lo}–${call.hi}.`, `Гонка 1 на 1 в Up and down: рейтинговая, около 4 минут, для рейтинга ${call.lo}–${call.hi}.`, `Rétame 1 contra 1 en Up and down: con rating, unos 4 minutos, para ratings ${call.lo}–${call.hi}.`, `Segle 1 gegen 1 gegen mich bei Up and down: gewertet, etwa 4 Minuten, für Wertungen ${call.lo}–${call.hi}.`, `Up and down’da bana karşı bire bir yarış: reytingli, yaklaşık 4 dakika, ${call.lo}–${call.hi} reyting için.`, `Affronte-moi en duel sur Up and down : classé, environ 4 minutes, pour les classements ${call.lo}–${call.hi}.`, `Sfidami 1 contro 1 su Up and down: valida per il rating, circa 4 minuti, per rating ${call.lo}–${call.hi}.`, `Me desafie 1 contra 1 no Up and down: vale rating, cerca de 4 minutos, para ratings ${call.lo}–${call.hi}.`) : '';
  const callBox = call ? (
    <div className="df-call">
      <span className="bt-k">{t('Your open call', 'Твой открытый вызов', 'Tu reto abierto', 'Deine offene Herausforderung', 'Açık çağrın', 'Ton appel ouvert', 'La tua sfida aperta', 'Seu desafio aberto')}</span>
      <p className="df-band">{t(`For ratings ${call.lo}–${call.hi}: the first to take it races you. Open while you look, an hour at most.`, `Для рейтинга ${call.lo}–${call.hi}: первый, кто примет, гоняется с тобой. Открыт, пока ты ищешь, не дольше часа.`, `Para ratings ${call.lo}–${call.hi}: el primero que lo acepte regatea contigo. Abierto mientras buscas, una hora como mucho.`, `Für Wertungen ${call.lo}–${call.hi}: Wer zuerst annimmt, segelt gegen dich. Offen, solange du suchst, höchstens eine Stunde.`, `${call.lo}–${call.hi} reyting için: ilk kabul eden seninle yarışır. Aradığın sürece açık, en fazla bir saat.`, `Pour les classements ${call.lo}–${call.hi} : le premier qui le prend court contre toi. Ouvert tant que tu cherches, une heure au plus.`, `Per rating ${call.lo}–${call.hi}: il primo che la prende sfida te. Aperta finché cerchi, un’ora al massimo.`, `Para ratings ${call.lo}–${call.hi}: o primeiro a aceitar corre com você. Aberto enquanto você procura, no máximo uma hora.`)}</p>
      <div className="df-acts">
        <a className="bt-show" href={shareHref('telegram', { url: call.url, text: callText })} target="_blank" rel="noopener noreferrer">Telegram</a>
        <a className="bt-show" href={shareHref('whatsapp', { url: call.url, text: callText })} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button type="button" className="bt-show" onClick={(e) => { const b = e.currentTarget; navigator.clipboard?.writeText(`${callText} ${call.url}`).then(() => { b.textContent = t('Copied', 'Скопировано', 'Copiado', 'Kopiert', 'Kopyalandı', 'Copié', 'Copiato', 'Copiado'); }, () => {}); }}>{t('Copy link', 'Скопировать ссылку', 'Copiar enlace', 'Link kopieren', 'Bağlantıyı kopyala', 'Copier le lien', 'Copia link', 'Copiar link')}</button>
      </div>
      <input className="df-url" readOnly value={call.url} aria-label={t('The call’s link', 'Ссылка на вызов', 'El enlace del reto', 'Der Link der Herausforderung', 'Çağrının bağlantısı', 'Le lien de l’appel', 'Il link della sfida', 'O link do desafio')} onFocus={(e) => e.currentTarget.select()} />
    </div>
  ) : (
    <div className="df-call">
      <div className="df-acts"><button type="button" className="bt-show" onClick={postCall}>{t('Post an open call', 'Открытый вызов', 'Publicar un reto abierto', 'Offene Herausforderung stellen', 'Açık çağrı yap', 'Lancer un appel ouvert', 'Lancia una sfida aperta', 'Publicar um desafio aberto')}</button></div>
      <p className="iv-note">{t('A link for any chat: the first sailor near your rating to take it races you.', 'Ссылка для любого чата: первый соперник твоего уровня, кто её примет, гоняется с тобой.', 'Un enlace para cualquier chat: el primer regatista de tu nivel que lo acepte regatea contigo.', 'Ein Link für jeden Chat: Der erste Segler auf deinem Niveau, der annimmt, segelt gegen dich.', 'Her sohbet için bir bağlantı: seviyendeki ilk kabul eden seninle yarışır.', 'Un lien pour n’importe quel chat : le premier marin de ton niveau qui le prend court contre toi.', 'Un link per qualsiasi chat: il primo velista del tuo livello che la prende sfida te.', 'Um link para qualquer conversa: o primeiro velejador do seu nível que aceitar corre com você.')}</p>
    </div>
  );
  const gone = note === 'gone' && <p className="dr-note">{t('That sailor has just gone: paired with someone else, or stopped looking.', 'Этот соперник уже ушёл: нашёл гонку или перестал искать.', 'Ese regatista ya se fue: emparejado con otro o dejó de buscar.', 'Dieser Segler ist schon weg: mit jemand anderem gepaart oder nicht mehr auf der Suche.', 'O denizci az önce gitti: başkasıyla eşleşti ya da aramayı bıraktı.', 'Ce marin vient de partir : apparié avec un autre ou plus en recherche.', 'Quel velista se n’è appena andato: abbinato a un altro o ha smesso di cercare.', 'Esse velejador acabou de sair: pareado com outro ou parou de procurar.')}</p>;
  // who else is looking now, nearest your rating first, each with your chance and Race: a challenge whatever the gap
  const now = <ReadyTable lang={lang} list={list} mine={mine} filter={filter} setFilter={setFilter} challenge={challenge} hour={hourOn} />;
  const anyOpt = t('Any', 'Любая', 'Cualquiera', 'Egal', 'Fark etmez', 'Peu importe', 'Qualsiasi', 'Qualquer');
  const fixed: [string, string][] = [
    [t('Wind', 'Ветер', 'Viento', 'Wind', 'Rüzgâr', 'Vent', 'Vento', 'Vento'), t('Medium', 'Средний', 'Medio', 'Mittel', 'Orta', 'Moyen', 'Medio', 'Médio')],
    [t('Course', 'Дистанция', 'Recorrido', 'Bahn', 'Parkur', 'Parcours', 'Percorso', 'Percurso'), t('Up and down', 'Вверх-вниз', 'Barlovento–sotavento', 'Up and Down', 'Orsa–pupa', 'Banane', 'Bastone', 'Barlavento–sotavento')],
    [t('Length', 'Длина', 'Duración', 'Länge', 'Uzunluk', 'Longueur', 'Lunghezza', 'Duração'), t('Short · 1 lap · ~4 min', 'Короткая · 1 круг · ~4 мин', 'Corta · 1 vuelta · ~4 min', 'Kurz · 1 Runde · ~4 Min.', 'Kısa · 1 tur · ~4 dk', 'Courte · 1 tour · ~4 min', 'Corta · 1 giro · ~4 min', 'Curta · 1 volta · ~4 min')],
    [t('Start', 'Старт', 'Salida', 'Start', 'Start', 'Départ', 'Partenza', 'Largada'), t('1 min', '1 мин', '1 min', '1 Min.', '1 dk', '1 min', '1 min', '1 min')],
  ];
  const wish = (
    <div className="df-wish dp-grid">
      <label className="df-sel dp-cell"><span className="lbl">{t('Venue', 'Акватория', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau', 'Campo', 'Raia')}</span>
        <select value={wishes.venue || ''} onChange={(e) => setWish('venue', e.target.value)}><option value="">{anyOpt}</option>{[...VENUES].sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang))).map((v) => <option key={v.id} value={v.id}>{pick(v.name, lang)}</option>)}</select></label>
      <label className="df-sel dp-cell"><span className="lbl">{t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Bateau', 'Barca', 'Barco')}</span>
        <select value={wishes.yacht || ''} onChange={(e) => setWish('yacht', e.target.value)}><option value="">{anyOpt}</option>{YACHTS.map((y) => <option key={y.id} value={y.id}>{pick(y.name, lang)}</option>)}</select></label>
      {fixed.map(([k, v]) => <span key={k} className="dp-cell"><span className="lbl">{k}</span><b>{v}</b></span>)}
    </div>
  );
  const wishNote = <p className="dp-note">{t('Your wishes count from your fourth rated race; the host’s come first.', 'Пожелания действуют с четвёртой рейтинговой гонки; у хозяина гонки — в первую очередь.', 'Tus preferencias cuentan desde tu cuarta regata con rating; las del anfitrión van primero.', 'Deine Wünsche zählen ab deiner vierten gewerteten Regatta; die des Gastgebers zuerst.', 'İstekler dördüncü reytingli yarışından itibaren geçerli; önce ev sahibininkiler.', 'Tes souhaits comptent à partir de ta quatrième régate classée ; ceux de l’hôte d’abord.', 'Le tue preferenze contano dalla quarta regata valida; prima quelle di chi ospita.', 'Suas preferências valem a partir da quarta regata com rating; as do anfitrião primeiro.')}</p>;
  // the ratings a search starts with: yours ±100, drawn on a bar of ±350 (as far as it ever widens)
  const me = mine?.rating ?? 1500, wide = phase === 'looking' ? look.band : 100, at = (x: number) => `${50 + ((x - me) / 700) * 100}%`;
  const band = (
    <div className="dp-band">
      <div className="dp-band-h"><span className="lbl">{t('Ratings to race', 'Рейтинги соперников', 'Ratings a regatear', 'Wertungen der Gegner', 'Rakip reytingleri', 'Classements à affronter', 'Rating da sfidare', 'Ratings para correr')}</span><b>{me - wide} – {me + wide}</b></div>
      <span className="dp-band-bar" aria-hidden="true"><i style={{ left: at(me - wide), right: `calc(100% - ${at(me + wide)})` }} /><em style={{ left: '50%' }} /></span>
      <p className="dp-note">{t('±100 to start. It widens to ±200 at 0:20 and ±350 at 0:45 if nobody is free.', '±100 в начале. Если никого нет, к 0:20 расширяется до ±200, к 0:45 — до ±350.', '±100 al principio. Se amplía a ±200 a los 0:20 y a ±350 a los 0:45 si no hay nadie libre.', '±100 zu Beginn. Ist niemand frei, wird es bei 0:20 auf ±200 und bei 0:45 auf ±350 breiter.', 'Başta ±100. Kimse boşta değilse 0:20’de ±200’e, 0:45’te ±350’ye genişler.', '±100 au départ. Elle s’élargit à ±200 à 0:20 et à ±350 à 0:45 si personne n’est libre.', '±100 all’inizio. Si allarga a ±200 a 0:20 e a ±350 a 0:45 se nessuno è libero.', '±100 no início. Abre para ±200 aos 0:20 e ±350 aos 0:45 se ninguém estiver livre.')}</p>
    </div>
  );
  // a sailor's first three rated races are set for them (regatta_make_pair: a light venue, the J/70, the short course)
  const easy = mine && mine.races < 3 ? (
    <div className="dp-easy">
      <span className="lbl">{t('Your first three rated races', 'Твои первые три рейтинговые гонки', 'Tus tres primeras regatas con rating', 'Deine ersten drei gewerteten Regatten', 'İlk üç reytingli yarışın', 'Tes trois premières régates classées', 'Le tue prime tre regate valide', 'Suas três primeiras regatas valendo rating')}</span>
      <p>{t('They’re set for you: a light venue, the J/70, a medium breeze, the short course, one lap, about 4 minutes. After them your venue and yacht count.', 'Их задаём мы: лёгкая акватория, J/70, средний ветер, короткая дистанция, один круг, около 4 минут. После них учитываются твои акватория и яхта.', 'Te las fijamos: una sede ligera, el J/70, viento medio, recorrido corto, una vuelta, unos 4 minutos. Después cuentan tu sede y tu yate.', 'Sie sind vorgegeben: ein leichtes Revier, die J/70, mittlerer Wind, kurze Bahn, eine Runde, etwa 4 Minuten. Danach zählen dein Revier und deine Yacht.', 'Bunları biz belirleriz: hafif bir alan, J/70, orta rüzgâr, kısa parkur, tek tur, yaklaşık 4 dakika. Sonrasında alanın ve yatın dikkate alınır.', 'Elles sont fixées pour toi : un plan d’eau léger, le J/70, un vent moyen, le parcours court, un tour, environ 4 minutes. Ensuite, ton plan d’eau et ton bateau comptent.', 'Sono fissate per te: un campo leggero, il J/70, vento medio, percorso corto, un giro, circa 4 minuti. Dopo contano il tuo campo e la tua barca.', 'Elas são definidas para você: uma raia leve, o J/70, vento médio, percurso curto, uma volta, cerca de 4 minutos. Depois valem sua raia e seu barco.')}</p>
    </div>
  ) : null;
  // who: find one, a friend's link, or an open call for any chat
  const who = (
    <div className="bt-g">
      <span className="bt-k" id="dp-who">{t('Who', 'С кем', 'Con quién', 'Mit wem', 'Kiminle', 'Avec qui', 'Con chi', 'Com quem')}</span>
      <div className="bt-pills" role="group" aria-labelledby="dp-who">
        <span className="bt-pill" aria-checked="true" role="radio">{t('Find one', 'Найти', 'Buscar', 'Finden', 'Bul', 'En trouver un', 'Trovane uno', 'Encontrar')}</span>
        <Link className="bt-pill" href="/match/new">{t('A friend', 'Друг', 'Un amigo', 'Ein Freund', 'Bir arkadaş', 'Un ami', 'Un amico', 'Um amigo')}</Link>
        <button type="button" className="bt-pill" onClick={postCall}>{t('Open call', 'Открытый вызов', 'Reto abierto', 'Offene', 'Açık çağrı', 'Appel ouvert', 'Sfida aperta', 'Desafio aberto')}</button>
      </div>
    </div>
  );
  const body = (() => {
  if (!signed) return (
    <div className="df">
      <p className="bt-p">{t('Rated races need an account on both sides, so finding a race takes one. Signing in takes ten seconds.', 'Для рейтинговых гонок у обоих нужен аккаунт, поэтому для поиска гонки тоже. Вход — десять секунд.', 'Las regatas con rating necesitan cuenta en los dos lados, así que buscar una también. Iniciar sesión lleva diez segundos.', 'Gewertete Regatten brauchen auf beiden Seiten ein Konto, die Suche also auch. Die Anmeldung dauert zehn Sekunden.', 'Reytingli yarışlar için iki tarafta da hesap gerekir, bu yüzden yarış aramak da gerektirir. Giriş on saniye sürer.', 'Les régates classées demandent un compte des deux côtés, donc la recherche aussi. Se connecter prend dix secondes.', 'Le regate valide richiedono un account da entrambe le parti, quindi anche la ricerca. L’accesso richiede dieci secondi.', 'Regatas valendo rating pedem conta dos dois lados, então a busca também. Entrar leva dez segundos.')}</p>
      <div className="df-acts"><a className="bt-go dp-go" href="/sign-in?next=/duel"><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</span></a>{friend}</div>
    </div>
  );
  if (phase === 'found' && pair) {
    const first = provisional(pair.me.races), them = pair.them.name || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
    const st = stakes(pair.me.rating, pair.them.rating, pair.me.races);
    const S = pair.settings;
    const wind = { light: t('light breeze', 'слабый ветер', 'viento flojo', 'leichter Wind', 'hafif rüzgâr', 'petit vent', 'vento leggero', 'vento fraco'), medium: t('medium breeze', 'средний ветер', 'viento medio', 'mittlerer Wind', 'orta rüzgâr', 'vent moyen', 'vento medio', 'vento médio'), strong: t('strong breeze', 'сильный ветер', 'viento fuerte', 'starker Wind', 'kuvvetli rüzgâr', 'vent fort', 'vento forte', 'vento forte') }[S.preset];
    const shape = S.course in SHAPE_NAME ? pick(SHAPE_NAME[S.course as keyof typeof SHAPE_NAME], lang) : null;
    const laps = t(`${S.laps} ${S.laps === 1 ? 'lap' : 'laps'}`, `${S.laps} ${S.laps === 1 ? 'круг' : 'круга'}`, `${S.laps} ${S.laps === 1 ? 'vuelta' : 'vueltas'}`, `${S.laps} ${S.laps === 1 ? 'Runde' : 'Runden'}`, `${S.laps} tur`, `${S.laps} ${S.laps === 1 ? 'tour' : 'tours'}`, `${S.laps} ${S.laps === 1 ? 'giro' : 'giri'}`, `${S.laps} ${S.laps === 1 ? 'volta' : 'voltas'}`);
    const start = t(`${S.start}-min start`, `старт ${S.start} мин`, `salida de ${S.start} min`, `${S.start}-Min.-Start`, `${S.start} dk start`, `départ ${S.start} min`, `partenza di ${S.start} min`, `largada de ${S.start} min`);
    const where = [pick(VENUES.find((v) => v.id === S.venue)?.name, lang), pick(YACHTS.find((y) => y.id === S.yacht)?.name, lang), wind, shape, laps, start].filter(Boolean).join(' · ');
    return (
      <div className="df df-found" aria-live="assertive">
        <p className="iv-who"><b>{them}</b><span className="dr-lvl">{provisional(pair.them.races) ? t('New to 1-on-1', 'Новичок в 1 на 1', 'Nuevo en 1 contra 1', 'Neu im 1 gegen 1', 'Bire birde yeni', 'Nouveau en duel', 'Nuovo all’1 contro 1', 'Novo no 1 contra 1') : levelName(pair.them.rating, lang)}</span>{!first && <span className="iv-r">{shown(pair.them.rating, pair.them.races)}</span>}
          {pair.minutes ? <span className="iv-m">{t(`about ${pair.minutes} min`, `около ${pair.minutes} мин`, `unos ${pair.minutes} min`, `etwa ${pair.minutes} Min.`, `yaklaşık ${pair.minutes} dk`, `environ ${pair.minutes} min`, `circa ${pair.minutes} min`, `cerca de ${pair.minutes} min`)}</span> : null}</p>
        {where && !first && <p className="df-where">{where}</p>}{/* (a first match: who, about how long, Ready: fewer numbers) */}
        {loaded !== null && (() => {
          const v = pick(VENUES.find((x) => x.id === pair.settings.venue)?.name, lang) ?? '', pct = Math.round(loaded * 100);
          return <p className="df-load">{pct < 100
            ? t(`Loading ${v} · ${pct}%`, `Загружается ${v} · ${pct}%`, `Cargando ${v} · ${pct}%`, `${v} lädt · ${pct} %`, `${v} yükleniyor · %${pct}`, `Chargement de ${v} · ${pct} %`, `Caricamento di ${v} · ${pct}%`, `Carregando ${v} · ${pct}%`)
            : t(`${v} is loaded: the race opens at once`, `${v} загружен: гонка откроется сразу`, `${v} está cargado: la regata abre al instante`, `${v} ist geladen: die Regatta öffnet sofort`, `${v} yüklendi: yarış hemen açılır`, `${v} est chargé : la régate s’ouvre aussitôt`, `${v} è caricato: la regata si apre subito`, `${v} está carregado: a regata abre na hora`)}</p>;
        })()}
        {!first && <p className="df-stakes">{t(`Your chance ${Math.round(st.chance * 100)}% · win `, `Твой шанс ${Math.round(st.chance * 100)}% · победа `, `Tu probabilidad ${Math.round(st.chance * 100)}% · ganar `, `Deine Chance ${Math.round(st.chance * 100)} % · Sieg `, `Şansın %${Math.round(st.chance * 100)} · galibiyet `, `Ta chance ${Math.round(st.chance * 100)} % · victoire `, `La tua probabilità ${Math.round(st.chance * 100)}% · vittoria `, `Sua chance ${Math.round(st.chance * 100)}% · vitória `)}<b className="up">{sgn(st.win)}</b>{t(' · lose ', ' · поражение ', ' · perder ', ' · Niederlage ', ' · yenilgi ', ' · défaite ', ' · sconfitta ', ' · derrota ')}<b className="down">{sgn(-st.loss)}</b></p>}
        {said
          ? <p className="df-wait">{t(`Ready. Waiting for ${them}…`, `Готов. Ждём ${them}…`, `Listo. Esperando a ${them}…`, `Bereit. Warte auf ${them} …`, `Hazırsın. ${them} bekleniyor…`, `Prêt. On attend ${them}…`, `Pronto. In attesa di ${them}…`, `Pronto. Esperando ${them}…`)}</p>
          : <div className="df-acts">
              <button type="button" className="bt-go df-ready" onClick={ready}><IconPlay /><span>{t('Ready', 'Готов', 'Listo', 'Bereit', 'Hazırım', 'Prêt', 'Pronto', 'Pronto')}</span><span className="df-left">{Math.ceil(left)}</span></button>
              <button type="button" className="bt-show" onClick={decline}>{first ? t('Not now', 'Не сейчас', 'Ahora no', 'Nicht jetzt', 'Şimdi değil', 'Pas maintenant', 'Non ora', 'Agora não') : t('Decline', 'Отказаться', 'Rechazar', 'Ablehnen', 'Reddet', 'Refuser', 'Rifiuta', 'Recusar')}</button>
            </div>}
        {first && <p className="dp-note">{t('It counts for your rating; what it did to it is on the result.', 'Гонка идёт в рейтинг; как она его изменила — в результате.', 'Cuenta para tu rating; lo que le hizo está en el resultado.', 'Sie zählt für deine Wertung; was sie bewirkt hat, steht im Ergebnis.', 'Reytingine sayılır; ona etkisi sonuçta yazar.', 'Elle compte pour ton classement ; ce qu’elle y a fait est dans le résultat.', 'Conta per il tuo rating; cosa gli ha fatto è nel risultato.', 'Vale para o seu rating; o que fez com ele está no resultado.')}</p>}
        <span className="dr-bar df-bar" aria-hidden="true"><i style={{ width: `${Math.round((left / pair.ttl) * 100)}%` }} /></span>
      </div>
    );
  }
  if (phase === 'go') return <div className="df" aria-live="assertive"><p className="df-wait">{t('Both ready. Off to the race…', 'Оба готовы. К гонке…', 'Los dos listos. A la regata…', 'Beide bereit. Auf zur Regatta …', 'İkiniz de hazırsınız. Yarışa…', 'Prêts tous les deux. En route pour la régate…', 'Entrambi pronti. Alla regata…', 'Os dois prontos. Para a regata…')}</p></div>;
  if (phase === 'looking') return (
    <div className="df" aria-live="polite">
      <p className="df-look"><span className="df-time" aria-label={t('Looking for', 'Ищем уже', 'Buscando desde hace', 'Suche seit', 'Aranıyor', 'Recherche depuis', 'Cerchiamo da', 'Procurando há')}>{mmss(look.waited)}</span></p>{/* (the card's title says Looking for a sailor) */}
      <p className="df-band">{t(`Within ${look.band} of your rating`, `В пределах ${look.band} от твоего рейтинга`, `A ${look.band} o menos de tu rating`, `Bis ${look.band} um deine Wertung`, `Reytingine ${look.band} yakın`, `À ${look.band} de ton classement au plus`, `Entro ${look.band} dal tuo rating`, `Até ${look.band} do seu rating`)}{look.band < 350 ? t(' · wider as you wait', ' · шире по мере ожидания', ' · más amplio mientras esperas', ' · breiter, je länger du wartest', ' · bekledikçe genişler', ' · plus large à mesure que tu attends', ' · più ampio mentre aspetti', ' · mais amplo enquanto você espera') : ''}{look.near ? t(` · ${look.near} in your band`, ` · в твоём диапазоне: ${look.near}`, ` · ${look.near} en tu rango`, ` · ${look.near} in deinem Bereich`, ` · aralığında ${look.near}`, ` · ${look.near} dans ta fourchette`, ` · ${look.near} nel tuo intervallo`, ` · ${look.near} na sua faixa`) : ''}{look.online > 1 ? t(` · ${look.online - 1} other looking now`, ` · ещё ищут: ${look.online - 1}`, ` · ${look.online - 1} más buscando`, ` · ${look.online - 1} weitere suchen gerade`, ` · şu an ${look.online - 1} kişi daha arıyor`, ` · ${look.online - 1} autre(s) en recherche`, ` · altri ${look.online - 1} in cerca`, ` · mais ${look.online - 1} procurando`) : ''}</p>
      {note === 'noanswer' && <p className="dr-note">{t('The other sailor didn’t say Ready. Still looking.', 'Соперник не нажал «Готов». Ищем дальше.', 'El otro regatista no dijo Listo. Seguimos buscando.', 'Der andere Segler hat nicht Bereit gesagt. Wir suchen weiter.', 'Diğer denizci hazır demedi. Aramaya devam.', 'L’autre marin n’a pas dit Prêt. On continue de chercher.', 'L’altro velista non ha detto Pronto. Continuiamo a cercare.', 'O outro velejador não disse Pronto. Seguimos procurando.')}</p>}
      {note === 'declined' && <p className="dr-note">{t('The other sailor declined. Still looking.', 'Соперник отказался. Ищем дальше.', 'El otro regatista rechazó. Seguimos buscando.', 'Der andere Segler hat abgelehnt. Wir suchen weiter.', 'Diğer denizci reddetti. Aramaya devam.', 'L’autre marin a refusé. On continue de chercher.', 'L’altro velista ha rifiutato. Continuiamo a cercare.', 'O outro velejador recusou. Seguimos procurando.')}</p>}
      {gone}{noted}
      {longWait && <p className="dr-note">{t('Nobody near your level is looking yet. Keep looking, or send a friend a link: it’s ready in a tap.', 'Пока никто твоего уровня не ищет. Ищи дальше или отправь другу ссылку — это одно касание.', 'Aún nadie de tu nivel está buscando. Sigue buscando o envía un enlace a un amigo: está en un toque.', 'Noch sucht niemand auf deinem Niveau. Such weiter oder schick einem Freund einen Link: ein Tipp genügt.', 'Henüz senin seviyende arayan yok. Aramaya devam et ya da bir arkadaşına bağlantı gönder: tek dokunuş.', 'Personne de ton niveau ne cherche encore. Continue, ou envoie un lien à un ami : un geste suffit.', 'Ancora nessuno del tuo livello sta cercando. Continua o manda un link a un amico: basta un tocco.', 'Ninguém do seu nível está procurando ainda. Continue ou mande um link a um amigo: é um toque.')}</p>}
      <div className="df-acts"><button type="button" className="bt-show" onClick={stop}>{t('Stop looking', 'Перестать искать', 'Dejar de buscar', 'Suche beenden', 'Aramayı bırak', 'Arrêter de chercher', 'Smetti di cercare', 'Parar de procurar')}</button>{longWait && friend}</div>
      <div className="df-call df-away">
        {away ? <>
          <span className="bt-k">{t('Looking for you while you’re away', 'Ищем, пока тебя нет', 'Buscando mientras no estás', 'Wir suchen, während du weg bist', 'Sen yokken arıyoruz', 'On cherche pendant ton absence', 'Cerchiamo mentre sei via', 'Procurando enquanto você está fora')}</span>
          <p className="df-band">{t('You can leave this page. We’ll message you the moment a sailor is found, for 30 minutes; then a minute to say Ready.', 'Можно закрыть страницу. Как только найдём соперника, пришлём тебе сообщение — в течение 30 минут; потом будет минута, чтобы нажать «Готов».', 'Puedes salir de esta página. Te avisaremos en cuanto haya rival, durante 30 minutos; luego tendrás un minuto para decir Listo.', 'Du kannst die Seite verlassen. Wir schicken dir eine Nachricht, sobald ein Segler gefunden ist, 30 Minuten lang; dann hast du eine Minute für Bereit.', 'Bu sayfadan çıkabilirsin. Bir denizci bulunur bulunmaz sana mesaj göndeririz, 30 dakika boyunca; sonra hazırım demek için bir dakikan olur.', 'Tu peux quitter cette page. On t’envoie un message dès qu’un marin est trouvé, pendant 30 minutes ; puis une minute pour dire Prêt.', 'Puoi lasciare questa pagina. Ti mandiamo un messaggio appena troviamo un velista, per 30 minuti; poi un minuto per dire Pronto.', 'Você pode sair desta página. Mandamos uma mensagem assim que acharmos um velejador, por 30 minutos; depois um minuto para dizer Pronto.')}</p>
          <div className="df-acts"><button type="button" className="bt-show" onClick={awayOff}>{t('Only while I’m here', 'Только пока я здесь', 'Solo mientras estoy aquí', 'Nur solange ich hier bin', 'Sadece buradayken', 'Seulement quand je suis là', 'Solo mentre sono qui', 'Só enquanto estou aqui')}</button></div>
        </> : <>
          <div className="df-acts"><button type="button" className="bt-show" onClick={awayOn}>{t('Keep looking if I leave', 'Искать, даже если я уйду', 'Seguir buscando si salgo', 'Weitersuchen, wenn ich gehe', 'Çıkarsam aramaya devam et', 'Continuer si je pars', 'Continua a cercare se esco', 'Continuar procurando se eu sair')}</button></div>
          <p className="iv-note">{t('A message when a sailor is found, for 30 minutes: to this browser, or from our Telegram bot.', 'Сообщение, когда соперник найдётся, — в течение 30 минут: в этот браузер или от нашего бота в Telegram.', 'Un mensaje cuando haya rival, durante 30 minutos: en este navegador o de nuestro bot de Telegram.', 'Eine Nachricht, wenn ein Segler gefunden ist, 30 Minuten lang: in diesem Browser oder von unserem Telegram-Bot.', 'Bir denizci bulunduğunda mesaj, 30 dakika boyunca: bu tarayıcıya ya da Telegram botumuzdan.', 'Un message quand un marin est trouvé, pendant 30 minutes : dans ce navigateur ou par notre bot Telegram.', 'Un messaggio quando troviamo un velista, per 30 minuti: in questo browser o dal nostro bot Telegram.', 'Uma mensagem quando acharmos um velejador, por 30 minutos: neste navegador ou do nosso bot no Telegram.')}</p>
        </>}
      </div>
      {band}
      {callBox}
    </div>
  );
  return (
    <div className="df">
      {phase === 'missed' && <p className="dr-note">{t('The match went: Ready wasn’t said in time.', 'Соперник ушёл: «Готов» не нажали вовремя.', 'El emparejamiento se perdió: no se dijo Listo a tiempo.', 'Die Partie ist weg: Bereit kam nicht rechtzeitig.', 'Eşleşme kaçtı: zamanında hazır denmedi.', 'Le duel est passé : Prêt n’a pas été dit à temps.', 'L’abbinamento è sfumato: Pronto non è arrivato in tempo.', 'O pareamento se foi: Pronto não foi dito a tempo.')}</p>}
      {gone}{noted}
      {phase === 'error' && <p className="dr-note">{t('Finding a race didn’t work just now. Try again.', 'Поиск гонки сейчас не удался. Попробуй ещё раз.', 'Buscar una regata no funcionó ahora. Inténtalo de nuevo.', 'Die Suche hat gerade nicht geklappt. Versuch es noch einmal.', 'Yarış arama şu an olmadı. Tekrar dene.', 'La recherche n’a pas marché. Réessaie.', 'La ricerca non ha funzionato. Riprova.', 'A busca não funcionou agora. Tente de novo.')}</p>}
      {who}
      {band}
      {easy}
      {wish}
      {wishNote}
    </div>
  );
  })();

  const title = !signed ? t('Sign in to race', 'Войди, чтобы гоняться', 'Inicia sesión para regatear', 'Zum Segeln anmelden', 'Yarışmak için giriş yap', 'Connecte-toi pour régater', 'Accedi per gareggiare', 'Entre para correr')
    : phase === 'found' ? t('Match found', 'Соперник найден', 'Rival encontrado', 'Gegner gefunden', 'Rakip bulundu', 'Adversaire trouvé', 'Avversario trovato', 'Adversário encontrado')
    : phase === 'looking' || phase === 'go' ? t('Looking for a sailor', 'Ищем соперника', 'Buscando un regatista', 'Suche einen Segler', 'Denizci aranıyor', 'Recherche d’un marin', 'Cerchiamo un velista', 'Procurando um velejador')
    : t('Set up your race', 'Настрой гонку', 'Prepara tu regata', 'Stell deine Regatta ein', 'Yarışını ayarla', 'Prépare ta régate', 'Imposta la tua regata', 'Monte sua regata');
  const readyN = list.length;
  const heroP = t('One race, one rival, the same wind. Win and your rating goes up; beat someone stronger and it goes up more.', 'Одна гонка, один соперник, один ветер. Победишь — рейтинг вырастет; победишь сильнее себя — вырастет больше.', 'Una regata, un rival, el mismo viento. Gana y tu rating sube; vence a alguien más fuerte y sube más.', 'Eine Regatta, ein Gegner, derselbe Wind. Gewinnst du, steigt deine Wertung; schlägst du jemand Stärkeren, steigt sie mehr.', 'Bir yarış, bir rakip, aynı rüzgâr. Kazan, reytingin yükselsin; daha güçlüsünü yen, daha çok yükselsin.', 'Une régate, un adversaire, le même vent. Gagne et ton classement monte ; bats plus fort que toi et il monte davantage.', 'Una regata, un avversario, lo stesso vento. Vinci e il tuo rating sale; batti qualcuno più forte e sale di più.', 'Uma regata, um adversário, o mesmo vento. Vença e seu rating sobe; vença alguém mais forte e sobe mais.');
  const readyLine = readyN > 0 ? t(` ${readyN} ready now.`, ` Сейчас готовы: ${readyN}.`, ` ${readyN} listos ahora.`, ` ${readyN} jetzt bereit.`, ` Şu an ${readyN} kişi hazır.`, ` ${readyN} prêts maintenant.`, ` ${readyN} pronti ora.`, ` ${readyN} prontos agora.`) : '';
  const idle = phase === 'idle' || phase === 'missed' || phase === 'error';
  const nearN = list.filter((r) => Math.abs(r.rating - me) <= 100).length;
  // Find a race, docked at the top of the card as the race hub's action is, over the set-up that scrolls under it
  const findBtn = (
<button type="button" className="bt-go df-go dp-go" onClick={find}><IconPlay /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</span><span className="dp-go-sub">{t('~4 min race', 'гонка ~4 мин', 'regata de ~4 min', '~4 Min. Regatta', '~4 dk yarış', 'régate de ~4 min', 'regata di ~4 min', 'regata de ~4 min')}</span></button>
  );
  const rows = (
    <nav className="bt-rows" aria-label={t('More', 'Ещё', 'Más', 'Mehr', 'Daha fazla', 'Plus', 'Altro', 'Mais')}>
      {signed && <Link className="bt-row" href="/duel/rating"><span>{t('Your rating, race by race', 'Твой рейтинг по гонкам', 'Tu rating, regata a regata', 'Deine Wertung, Regatta für Regatta', 'Yarış yarış reytingin', 'Ton classement, régate par régate', 'Il tuo rating, regata per regata', 'Seu rating, regata a regata')}</span></Link>}
      <Link className="bt-row" href={RATING_HREF}><span>{t('Everyone’s 1-on-1 rating', 'Рейтинг 1 на 1 у всех', 'El rating 1 contra 1 de todos', 'Die 1-gegen-1-Wertung aller', 'Herkesin bire bir reytingi', 'Le classement en duel de tous', 'Il rating 1 contro 1 di tutti', 'O rating 1 contra 1 de todos')}</span></Link>
      <Link className="bt-row" href="/help/duel"><span>{t('How 1-on-1 races work', 'Как устроены гонки 1 на 1', 'Cómo funcionan las regatas 1 contra 1', 'So funktionieren 1-gegen-1-Regatten', 'Bire bir yarışlar nasıl işler', 'Comment marchent les duels', 'Come funzionano le regate 1 contro 1', 'Como funcionam os duelos')}</span></Link>
    </nav>
  );
  return (
    <>
      {/* the top: a race page over the game's own scene, as the HUD's "/race/free" board draws it: the heading, the HUD's
          cells, and the card where the race is set up, looked for and found */}
      <div className="scr bt-scr bc dp-hud">
        <div className="bt">
          <GameScene venue="phuket" boat="j70" wind="medium" title={t('A 1-on-1 race’s venue in 3D', 'Место гонки 1 на 1 в 3D', 'La sede de una regata 1 contra 1 en 3D', 'Das Revier einer 1-gegen-1-Regatta in 3D', 'Bire bir yarışın alanı 3D', 'Le plan d’eau d’un duel en 3D', 'Il campo di un duello in 3D', 'A raia de um duelo em 3D')} />
          <div className="bt-info">
            <div className="bt-top">
              <BackLink href="/race" label={t('Back to the race hub', 'Назад в меню гонок', 'Volver al centro de regatas', 'Zurück zum Regatta-Hub', 'Yarış merkezine dön', 'Retour au centre de régate', 'Torna al centro regate', 'Voltar à central de regatas')} />
              <SceneBrand lang={lang} />
              <span className="bt-top-r">
                <span className="bt-tick"><span className="dot-live" aria-hidden="true" />{signed ? t(`1-on-1 · ${readyN} ready now`, `1 на 1 · готовы: ${readyN}`, `1 contra 1 · ${readyN} listos`, `1 gegen 1 · ${readyN} bereit`, `Bire bir · ${readyN} hazır`, `Duel · ${readyN} prêts`, `1 contro 1 · ${readyN} pronti`, `1 contra 1 · ${readyN} prontos`) : t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1', 'Duelo 1 contra 1')}</span>
                <Link className="bt-ico" href="/help/duel" aria-label={t('How 1-on-1 races work', 'Как устроены гонки 1 на 1', 'Cómo funcionan las regatas 1 contra 1', 'So funktionieren 1-gegen-1-Regatten', 'Bire bir yarışlar nasıl işler', 'Comment marchent les duels', 'Come funzionano le regate 1 contro 1', 'Como funcionam os duelos')} title={t('How 1-on-1 races work', 'Как устроены гонки 1 на 1', 'Cómo funcionan las regatas 1 contra 1', 'So funktionieren 1-gegen-1-Regatten', 'Bire bir yarışlar nasıl işler', 'Comment marchent les duels', 'Come funzionano le regate 1 contro 1', 'Como funcionam os duelos')}>?</Link>
              </span>
            </div>
            <span className="bt-kick">{t('1-on-1 race · rated', 'Гонка 1 на 1 · рейтинговая', 'Regata 1 contra 1 · con rating', '1-gegen-1-Regatta · gewertet', 'Bire bir yarış · reytingli', 'Duel · classé', 'Duello 1 contro 1 · valido', 'Duelo 1 contra 1 · vale rating')}</span>
            <h1 className="bt-h bt-hero">{t('Race someone your level', 'Гонка с соперником твоего уровня', 'Regatea con alguien de tu nivel', 'Segle gegen jemanden auf deinem Niveau', 'Seviyende biriyle yarış', 'Régate contre quelqu’un de ton niveau', 'Sfida qualcuno del tuo livello', 'Corra contra alguém do seu nível')}</h1>
            <p className="bt-p">{heroP}<b>{readyLine}</b></p>
            <HudCells lang={lang} mine={mine} ready={signed ? readyN : null} near={nearN} />
          </div>
          <section className="bt-card bt-docked dp-card" aria-labelledby="dp-setup">
            <div className="bt-card-h">
              <span className="lbl-ink bt-card-t" id="dp-setup">{title}</span>
              {idle && signed && <Link className="bt-mini" href="/match/new">{t('Challenge a friend', 'Позвать друга', 'Reta a un amigo', 'Freund herausfordern', 'Arkadaşını çağır', 'Défier un ami', 'Sfida un amico', 'Desafiar um amigo')}</Link>}
            </div>
            {signed && idle && <div className="bt-dock bt-dock-t">{findBtn}</div>}
            <div className="bt-body">
              {body}
              {rows}
            </div>
          </section>
        </div>
      </div>
      <div className="dp-main hm-page">
        <div className="dp-side">
          {signed && phase !== 'found' && phase !== 'go' && now}{/* (gone once a match is found: the card is the match) */}
          <DuelHour lang={lang} signed={signed} looking={phase === 'looking'} onFind={find} />
          {signed && <div className="dp-two"><OpenCalls lang={lang} calls={calls} take={take} post={postCall} canPost={!call && (phase === 'idle' || phase === 'looking')} /><LastRaces lang={lang} mine={mine} /></div>}
          {signed && <NearTable lang={lang} near={near} />}
          {children}
        </div>
      </div>
    </>
  );
}
