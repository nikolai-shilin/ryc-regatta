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
import { IconPlay } from './ui';
import '@/styles/duel-rating.css';

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
// Opened from the home's Race (/duel?challenge=<handle>, components/duel-home.tsx), it challenges that sailor at once.
// The wishes, a venue and a yacht, kept on this device, are the race's from a sailor's fourth rated race (the host's first).
type Phase = 'idle' | 'looking' | 'found' | 'go' | 'missed' | 'error';
type Note = '' | 'noanswer' | 'declined' | 'gone' | 'taken' | 'away' | 'closed' | 'band' | 'mine' | 'nocall';
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

export function DuelFinder({ lang, signed }: { lang: Lang; signed: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [list, setList] = useState<Ready[]>([]);
  const [wishes, setWishes] = useState<Wishes>({});
  const wishesRef = useRef<Wishes>({});
  const [look, setLook] = useState<{ waited: number; band: number; online: number }>({ waited: 0, band: 100, online: 0 });
  const [pair, setPair] = useState<Pair | null>(null);
  const [said, setSaid] = useState(false); // this sailor said Ready to the pair on screen
  const [note, setNote] = useState<Note>('');
  const [call, setCall] = useState<OpenCall | null>(null); // this sailor's open call, posted while looking
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
        foundAt.current = Date.now(); setCall(null);
        preload.current?.abort(); const ac = preload.current = new AbortController(); setLoaded(0);
        preloadRace(s.pair.settings.venue, s.pair.settings.yacht, (x) => { if (!ac.signal.aborted) setLoaded(x); }, ac.signal);
      }
      pairRef.current = s.pair; setPair(s.pair); setLeft(s.pair.left); setPhase('found');
      timer.current = setTimeout(ask, FOUND_MS);
      return;
    }
    // the pair gone: before its time was up the other said no; after it, whoever hadn't said Ready let it go. This sailor's
    // own silence is a miss (the database dropped her; asking again would only look afresh): stop, and say so
    const had = pairRef.current, wasReady = saidRef.current, early = had && Date.now() - foundAt.current < 11000;
    if (had) { preload.current?.abort(); preload.current = null; setLoaded(null); }
    pairRef.current = null; saidRef.current = false; setSaid(false); setPair(null);
    if (had && !wasReady && !early) { on.current = false; setPhase('missed'); post({ do: 'stop' }); return; }
    if (had) setNote(early ? 'declined' : 'noanswer');
    if (s.status === 'looking') {
      setLook({ waited: s.waited, band: s.band, online: s.online }); setPhase('looking');
      timer.current = setTimeout(ask, LOOK_MS);
      return;
    }
    // none: the pair missed while this sailor didn't say Ready, or the asking failed
    on.current = false; setPhase(had ? 'missed' : 'error');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = useCallback(async () => { if (!on.current) return; apply(await post({ do: 'seek', wishes: wishesRef.current })); }, [apply]);

  const find = () => { stopTimer(); on.current = true; started.current = Date.now(); setNote(''); setPhase('looking'); track('Duel find', {}); ask(); };
  const stop = () => { stopTimer(); on.current = false; pairRef.current = null; setPair(null); setCall(null); setPhase('idle'); post({ do: 'stop' }); };
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
      setList(r.ok ? parseReady((await r.json())?.list) : []);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    const away = () => { if (on.current) navigator.sendBeacon?.('/connect/seek', new Blob([JSON.stringify({ do: 'stop' })], { type: 'application/json' })); };
    addEventListener('pagehide', away);
    return () => { removeEventListener('pagehide', away); stopTimer(); preload.current?.abort(); };
  }, []);

  return <DuelFinderView lang={lang} signed={signed} phase={phase} look={look} pair={pair} said={said} left={left} note={note}
    longWait={phase === 'looking' && look.waited >= OFFER_AFTER_S} find={find} stop={stop} ready={ready} decline={decline}
    list={list} challenge={challenge} wishes={wishes} setWish={setWish} loaded={loaded} call={call} postCall={postCall} />;
}

type ViewProps = { lang: Lang; signed: boolean; phase: Phase; look: { waited: number; band: number; online: number }; pair: Pair | null; said: boolean; left: number;
  note: Note; longWait: boolean; find: () => void; stop: () => void; ready: () => void; decline: () => void;
  list?: Ready[]; challenge?: (handle: string) => void; wishes?: Wishes; setWish?: (k: keyof Wishes, v: string) => void; loaded?: number | null;
  call?: OpenCall | null; postCall?: () => void };

export function DuelFinderView({ lang, signed, phase, look, pair, said, left, note, longWait, find, stop, ready, decline, list = [], challenge = () => {}, wishes = {}, setWish = () => {}, loaded = null, call = null, postCall = () => {} }: ViewProps) {
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
  // who else is looking now, nearest your rating first, each with Race: a challenge whatever the gap
  const now = (
    <div className="df-now">
      <span className="bt-k">{t('Ready now', 'Готовы сейчас', 'Listos ahora', 'Jetzt bereit', 'Şu an hazır', 'Prêts maintenant', 'Pronti ora', 'Prontos agora')}</span>
      {list.length ? (
        <ul className="df-list">{list.map((r) => (
          <li key={r.handle} className="df-row">
            <span className="df-who"><b className="df-n">{r.name || anyone}</b><span className="df-meta">
            <span className="df-lv">{provisional(r.races) ? t('New', 'Новичок', 'Nuevo', 'Neu', 'Yeni', 'Nouveau', 'Nuovo', 'Novo') : levelName(r.rating, lang)}</span>
            <span className="iv-r">{shown(r.rating, r.races)}</span>
            <span className="iv-m">{t(`waiting ${mmss(r.waited)}`, `ждёт ${mmss(r.waited)}`, `esperando ${mmss(r.waited)}`, `wartet ${mmss(r.waited)}`, `${mmss(r.waited)} bekliyor`, `attend ${mmss(r.waited)}`, `aspetta ${mmss(r.waited)}`, `esperando ${mmss(r.waited)}`)}</span></span></span>
            <button type="button" className="bt-show df-race" onClick={() => challenge(r.handle)} aria-label={t(`Race ${r.name || 'this sailor'}`, `Гонка с ${r.name || 'этим соперником'}`, `Regatear con ${r.name || 'este regatista'}`, `Gegen ${r.name || 'diesen Segler'} segeln`, `${r.name || 'Bu denizci'} ile yarış`, `Régater contre ${r.name || 'ce marin'}`, `Sfida ${r.name || 'questo velista'}`, `Correr contra ${r.name || 'este velejador'}`)}>{t('Race', 'Гонка', 'Regatear', 'Segeln', 'Yarış', 'Régater', 'Sfida', 'Correr')}</button>
          </li>))}
        </ul>
      ) : <p className="iv-note">{t('Nobody else is looking right now. Find a race, and you’re the first one the next sailor sees.', 'Сейчас больше никто не ищет. Начни поиск — и следующий соперник увидит тебя первым.', 'Ahora nadie más está buscando. Busca una regata y serás lo primero que vea el próximo regatista.', 'Gerade sucht sonst niemand. Starte die Suche, dann sieht dich der nächste Segler zuerst.', 'Şu an başka arayan yok. Yarış ara; sıradaki denizci ilk seni görür.', 'Personne d’autre ne cherche pour l’instant. Lance la recherche : le prochain marin te verra en premier.', 'Ora nessun altro sta cercando. Cerca una regata e sarai il primo che vedrà il prossimo velista.', 'Ninguém mais está procurando agora. Procure uma regata e você será o primeiro que o próximo velejador vê.')}</p>}
    </div>
  );
  const anyOpt = t('Any', 'Любая', 'Cualquiera', 'Egal', 'Fark etmez', 'Peu importe', 'Qualsiasi', 'Qualquer');
  const wish = (
    <div className="df-wish">
      <label className="df-sel"><span>{t('Venue', 'Акватория', 'Sede', 'Revier', 'Yarış alanı', 'Plan d’eau', 'Campo', 'Raia')}</span>
        <select value={wishes.venue || ''} onChange={(e) => setWish('venue', e.target.value)}><option value="">{anyOpt}</option>{[...VENUES].sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang))).map((v) => <option key={v.id} value={v.id}>{pick(v.name, lang)}</option>)}</select></label>
      <label className="df-sel"><span>{t('Yacht', 'Яхта', 'Yate', 'Yacht', 'Yat', 'Bateau', 'Barca', 'Barco')}</span>
        <select value={wishes.yacht || ''} onChange={(e) => setWish('yacht', e.target.value)}><option value="">{anyOpt}</option>{YACHTS.map((y) => <option key={y.id} value={y.id}>{pick(y.name, lang)}</option>)}</select></label>
      <p className="iv-note">{t('Your wishes count from your fourth rated race; the host’s come first.', 'Пожелания действуют с четвёртой рейтинговой гонки; у хозяина гонки — в первую очередь.', 'Tus preferencias cuentan desde tu cuarta regata con rating; las del anfitrión van primero.', 'Deine Wünsche zählen ab deiner vierten gewerteten Regatta; die des Gastgebers zuerst.', 'İstekler dördüncü reytingli yarışından itibaren geçerli; önce ev sahibininkiler.', 'Tes souhaits comptent à partir de ta quatrième régate classée ; ceux de l’hôte d’abord.', 'Le tue preferenze contano dalla quarta regata valida; prima quelle di chi ospita.', 'Suas preferências valem a partir da quarta regata com rating; as do anfitrião primeiro.')}</p>
    </div>
  );
  if (!signed) return (
    <div className="df">
      <p className="bt-p">{t('Rated races need an account on both sides, so finding a race takes one. Signing in takes ten seconds.', 'Для рейтинговых гонок у обоих нужен аккаунт, поэтому для поиска гонки тоже. Вход — десять секунд.', 'Las regatas con rating necesitan cuenta en los dos lados, así que buscar una también. Iniciar sesión lleva diez segundos.', 'Gewertete Regatten brauchen auf beiden Seiten ein Konto, die Suche also auch. Die Anmeldung dauert zehn Sekunden.', 'Reytingli yarışlar için iki tarafta da hesap gerekir, bu yüzden yarış aramak da gerektirir. Giriş on saniye sürer.', 'Les régates classées demandent un compte des deux côtés, donc la recherche aussi. Se connecter prend dix secondes.', 'Le regate valide richiedono un account da entrambe le parti, quindi anche la ricerca. L’accesso richiede dieci secondi.', 'Regatas valendo rating pedem conta dos dois lados, então a busca também. Entrar leva dez segundos.')}</p>
      <div className="df-acts"><a className="bt-go" href="/sign-in?next=/duel"><span>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi', 'Entrar')}</span></a>{friend}</div>
    </div>
  );
  if (phase === 'found' && pair) {
    const first = provisional(pair.me.races), them = pair.them.name || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
    const st = stakes(pair.me.rating, pair.them.rating, pair.me.races);
    const where = [pick(VENUES.find((v) => v.id === pair.settings.venue)?.name, lang), pick(YACHTS.find((y) => y.id === pair.settings.yacht)?.name, lang)].filter(Boolean).join(' · ');
    return (
      <div className="df df-found" aria-live="assertive">
        <span className="bt-kick bt-kick-w">{t('Match found', 'Соперник найден', 'Rival encontrado', 'Gegner gefunden', 'Rakip bulundu', 'Adversaire trouvé', 'Avversario trovato', 'Adversário encontrado')}</span>
        <p className="iv-who"><b>{them}</b><span className="dr-lvl">{provisional(pair.them.races) ? t('New to 1-on-1', 'Новичок в 1 на 1', 'Nuevo en 1 contra 1', 'Neu im 1 gegen 1', 'Bire birde yeni', 'Nouveau en duel', 'Nuovo all’1 contro 1', 'Novo no 1 contra 1') : levelName(pair.them.rating, lang)}</span><span className="iv-r">{shown(pair.them.rating, pair.them.races)}</span>
          {pair.minutes ? <span className="iv-m">{t(`about ${pair.minutes} min`, `около ${pair.minutes} мин`, `unos ${pair.minutes} min`, `etwa ${pair.minutes} Min.`, `yaklaşık ${pair.minutes} dk`, `environ ${pair.minutes} min`, `circa ${pair.minutes} min`, `cerca de ${pair.minutes} min`)}</span> : null}</p>
        {where && <p className="df-where">{where}</p>}
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
              <button type="button" className="bt-show" onClick={decline}>{t('Decline', 'Отказаться', 'Rechazar', 'Ablehnen', 'Reddet', 'Refuser', 'Rifiuta', 'Recusar')}</button>
            </div>}
        <span className="dr-bar df-bar" aria-hidden="true"><i style={{ width: `${Math.round((left / 12) * 100)}%` }} /></span>
      </div>
    );
  }
  if (phase === 'go') return <div className="df" aria-live="assertive"><p className="df-wait">{t('Both ready. Off to the race…', 'Оба готовы. К гонке…', 'Los dos listos. A la regata…', 'Beide bereit. Auf zur Regatta …', 'İkiniz de hazırsınız. Yarışa…', 'Prêts tous les deux. En route pour la régate…', 'Entrambi pronti. Alla regata…', 'Os dois prontos. Para a regata…')}</p></div>;
  if (phase === 'looking') return (
    <div className="df" aria-live="polite">
      <p className="df-look"><b>{t('Looking for a sailor', 'Ищем соперника', 'Buscando un regatista', 'Suche einen Segler', 'Denizci aranıyor', 'Recherche d’un marin', 'Cerchiamo un velista', 'Procurando um velejador')}</b><span className="df-time">{mmss(look.waited)}</span></p>
      <p className="df-band">{t(`Within ${look.band} of your rating`, `В пределах ${look.band} от твоего рейтинга`, `A ${look.band} o menos de tu rating`, `Bis ${look.band} um deine Wertung`, `Reytingine ${look.band} yakın`, `À ${look.band} de ton classement au plus`, `Entro ${look.band} dal tuo rating`, `Até ${look.band} do seu rating`)}{look.band < 350 ? t(' · wider as you wait', ' · шире по мере ожидания', ' · más amplio mientras esperas', ' · breiter, je länger du wartest', ' · bekledikçe genişler', ' · plus large à mesure que tu attends', ' · più ampio mentre aspetti', ' · mais amplo enquanto você espera') : ''}{look.online > 1 ? t(` · ${look.online - 1} other looking now`, ` · ещё ищут: ${look.online - 1}`, ` · ${look.online - 1} más buscando`, ` · ${look.online - 1} weitere suchen gerade`, ` · şu an ${look.online - 1} kişi daha arıyor`, ` · ${look.online - 1} autre(s) en recherche`, ` · altri ${look.online - 1} in cerca`, ` · mais ${look.online - 1} procurando`) : ''}</p>
      {note === 'noanswer' && <p className="dr-note">{t('The other sailor didn’t say Ready. Still looking.', 'Соперник не нажал «Готов». Ищем дальше.', 'El otro regatista no dijo Listo. Seguimos buscando.', 'Der andere Segler hat nicht Bereit gesagt. Wir suchen weiter.', 'Diğer denizci hazır demedi. Aramaya devam.', 'L’autre marin n’a pas dit Prêt. On continue de chercher.', 'L’altro velista non ha detto Pronto. Continuiamo a cercare.', 'O outro velejador não disse Pronto. Seguimos procurando.')}</p>}
      {note === 'declined' && <p className="dr-note">{t('The other sailor declined. Still looking.', 'Соперник отказался. Ищем дальше.', 'El otro regatista rechazó. Seguimos buscando.', 'Der andere Segler hat abgelehnt. Wir suchen weiter.', 'Diğer denizci reddetti. Aramaya devam.', 'L’autre marin a refusé. On continue de chercher.', 'L’altro velista ha rifiutato. Continuiamo a cercare.', 'O outro velejador recusou. Seguimos procurando.')}</p>}
      {gone}{noted}
      {longWait && <p className="dr-note">{t('Nobody near your level is looking yet. Keep looking, or send a friend a link: it’s ready in a tap.', 'Пока никто твоего уровня не ищет. Ищи дальше или отправь другу ссылку — это одно касание.', 'Aún nadie de tu nivel está buscando. Sigue buscando o envía un enlace a un amigo: está en un toque.', 'Noch sucht niemand auf deinem Niveau. Such weiter oder schick einem Freund einen Link: ein Tipp genügt.', 'Henüz senin seviyende arayan yok. Aramaya devam et ya da bir arkadaşına bağlantı gönder: tek dokunuş.', 'Personne de ton niveau ne cherche encore. Continue, ou envoie un lien à un ami : un geste suffit.', 'Ancora nessuno del tuo livello sta cercando. Continua o manda un link a un amico: basta un tocco.', 'Ninguém do seu nível está procurando ainda. Continue ou mande um link a um amigo: é um toque.')}</p>}
      <div className="df-acts"><button type="button" className="bt-show" onClick={stop}>{t('Stop looking', 'Перестать искать', 'Dejar de buscar', 'Suche beenden', 'Aramayı bırak', 'Arrêter de chercher', 'Smetti di cercare', 'Parar de procurar')}</button>{longWait && friend}</div>
      {callBox}
      {now}
    </div>
  );
  return (
    <div className="df">
      {phase === 'missed' && <p className="dr-note">{t('The match went: Ready wasn’t said in time.', 'Соперник ушёл: «Готов» не нажали вовремя.', 'El emparejamiento se perdió: no se dijo Listo a tiempo.', 'Die Partie ist weg: Bereit kam nicht rechtzeitig.', 'Eşleşme kaçtı: zamanında hazır denmedi.', 'Le duel est passé : Prêt n’a pas été dit à temps.', 'L’abbinamento è sfumato: Pronto non è arrivato in tempo.', 'O pareamento se foi: Pronto não foi dito a tempo.')}</p>}
      {gone}{noted}
      {phase === 'error' && <p className="dr-note">{t('Finding a race didn’t work just now. Try again.', 'Поиск гонки сейчас не удался. Попробуй ещё раз.', 'Buscar una regata no funcionó ahora. Inténtalo de nuevo.', 'Die Suche hat gerade nicht geklappt. Versuch es noch einmal.', 'Yarış arama şu an olmadı. Tekrar dene.', 'La recherche n’a pas marché. Réessaie.', 'La ricerca non ha funzionato. Riprova.', 'A busca não funcionou agora. Tente de novo.')}</p>}
      <div className="df-acts">
        <button type="button" className="bt-go df-go" onClick={find}><IconPlay /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</span></button>
        {friend}
      </div>
      <p className="iv-note">{t('Matched by rating: within 100 at first, wider as you wait. About 4 minutes, one lap; your first three are easy ones.', 'Подбор по рейтингу: сначала в пределах 100, потом шире. Около 4 минут, один круг; первые три — лёгкие.', 'Emparejado por rating: a 100 al principio, más amplio mientras esperas. Unos 4 minutos, una vuelta; las tres primeras son fáciles.', 'Nach Wertung: zuerst bis 100, breiter, je länger du wartest. Etwa 4 Minuten, eine Runde; die ersten drei sind leicht.', 'Reytinge göre eşleşme: önce 100 içinde, bekledikçe daha geniş. Yaklaşık 4 dakika, tek tur; ilk üçü kolay.', 'Par classement : à 100 près au début, plus large à mesure que tu attends. Environ 4 minutes, un tour ; tes trois premières sont faciles.', 'Abbinati per rating: entro 100 all’inizio, più ampio mentre aspetti. Circa 4 minuti, un giro; le prime tre sono facili.', 'Pareado por rating: até 100 no início, mais amplo enquanto espera. Cerca de 4 minutos, uma volta; as três primeiras são fáceis.')}</p>
      {wish}
      {now}
    </div>
  );
}
