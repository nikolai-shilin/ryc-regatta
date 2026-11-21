'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { pick, tx, type Lang } from '@/lib/lang';
import { levelName } from '@/lib/levels';
import { provisional, shown, stakes, signed as sgn } from '@/lib/elo';
import { parseSeek, raceHref, type Pair, type Seek } from '@/lib/duel-seek';
import { VENUES } from '@/lib/venues';
import { YACHTS } from '@/lib/yachts';
import { track } from '@/lib/track';
import { IconPlay } from './ui';
import '@/styles/duel-rating.css';

// Find a race (app/[lang]/duel/page.tsx): a signed-in sailor is matched with another of about their rating (POST
// /connect/seek, the database's regatta_seek): Looking (how long, the band, how many are looking), then Match found with ten
// seconds to say Ready (a sailor with fewer than five rated races sees the short one: who, about how long, Ready; the rest
// also their chance and what a win or a loss would do), then both are sent into the same race: the host's screen hosts it
// with the pair's settings, as a race set up on /match/new is, and starts it once the guest is in (?auto). Asked every 3 s
// while looking, every second once found. Nobody after 1:30: keep looking, or send a friend a link instead.
type Phase = 'idle' | 'looking' | 'found' | 'go' | 'missed' | 'error';
const LOOK_MS = 3000, FOUND_MS = 1000, OFFER_AFTER_S = 90;

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

export function DuelFinder({ lang, signed }: { lang: Lang; signed: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [look, setLook] = useState<{ waited: number; band: number; online: number }>({ waited: 0, band: 100, online: 0 });
  const [pair, setPair] = useState<Pair | null>(null);
  const [said, setSaid] = useState(false); // this sailor said Ready to the pair on screen
  const [note, setNote] = useState<'' | 'noanswer' | 'declined'>('');
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), on = useRef(false), pairRef = useRef<Pair | null>(null), saidRef = useRef(false), started = useRef(0), foundAt = useRef(0);

  const stopTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const apply = useCallback((s: Seek) => {
    if (!on.current) return;
    if (s.status === 'go') { on.current = false; setPair(s.pair); setPhase('go'); track('Duel match', { role: s.pair.role }); handOver(s.pair); return; }
    if (s.status === 'found') {
      if (pairRef.current?.id !== s.pair.id) foundAt.current = Date.now();
      pairRef.current = s.pair; setPair(s.pair); setLeft(s.pair.left); setPhase('found');
      timer.current = setTimeout(ask, FOUND_MS);
      return;
    }
    // the pair gone: before its time was up the other said no; after it, whoever hadn't said Ready let it go. This sailor's
    // own silence is a miss (the database dropped her; asking again would only look afresh): stop, and say so
    const had = pairRef.current, wasReady = saidRef.current, early = had && Date.now() - foundAt.current < 11000;
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
  const ask = useCallback(async () => { if (!on.current) return; apply(await post({ do: 'seek' })); }, [apply]);

  const find = () => { stopTimer(); on.current = true; started.current = Date.now(); setNote(''); setPhase('looking'); track('Duel find', {}); ask(); };
  const stop = () => { stopTimer(); on.current = false; pairRef.current = null; setPair(null); setPhase('idle'); post({ do: 'stop' }); };
  const ready = async () => {
    const p = pairRef.current; if (!p) return;
    saidRef.current = true; setSaid(true);
    stopTimer(); apply(await post({ do: 'ready', pair: p.id }));
  };
  const decline = () => { const p = pairRef.current; stopTimer(); on.current = false; pairRef.current = null; setPair(null); setPhase('idle'); if (p) post({ do: 'decline', pair: p.id }); };

  // the ten seconds, counted down here between answers
  useEffect(() => { if (phase !== 'found') return; const t = setInterval(() => setLeft((x) => Math.max(0, x - 0.25)), 250); return () => clearInterval(t); }, [phase]);
  // leaving the page stops looking
  useEffect(() => {
    const away = () => { if (on.current) navigator.sendBeacon?.('/connect/seek', new Blob([JSON.stringify({ do: 'stop' })], { type: 'application/json' })); };
    addEventListener('pagehide', away);
    return () => { removeEventListener('pagehide', away); stopTimer(); };
  }, []);

  return <DuelFinderView lang={lang} signed={signed} phase={phase} look={look} pair={pair} said={said} left={left} note={note}
    longWait={phase === 'looking' && look.waited >= OFFER_AFTER_S} find={find} stop={stop} ready={ready} decline={decline} />;
}

type ViewProps = { lang: Lang; signed: boolean; phase: Phase; look: { waited: number; band: number; online: number }; pair: Pair | null; said: boolean; left: number;
  note: '' | 'noanswer' | 'declined'; longWait: boolean; find: () => void; stop: () => void; ready: () => void; decline: () => void };

export function DuelFinderView({ lang, signed, phase, look, pair, said, left, note, longWait, find, stop, ready, decline }: ViewProps) {
  const t = tx(lang);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const friend = <Link className="bt-show" href="/match/new">{t('Challenge a friend instead', 'Позвать друга', 'Reta a un amigo', 'Lieber einen Freund herausfordern', 'Bunun yerine bir arkadaşını çağır', 'Défier plutôt un ami', 'Sfida invece un amico', 'Desafiar um amigo')}</Link>;
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
      {longWait && <p className="dr-note">{t('Nobody near your level is looking yet. Keep looking, or send a friend a link: it’s ready in a tap.', 'Пока никто твоего уровня не ищет. Ищи дальше или отправь другу ссылку — это одно касание.', 'Aún nadie de tu nivel está buscando. Sigue buscando o envía un enlace a un amigo: está en un toque.', 'Noch sucht niemand auf deinem Niveau. Such weiter oder schick einem Freund einen Link: ein Tipp genügt.', 'Henüz senin seviyende arayan yok. Aramaya devam et ya da bir arkadaşına bağlantı gönder: tek dokunuş.', 'Personne de ton niveau ne cherche encore. Continue, ou envoie un lien à un ami : un geste suffit.', 'Ancora nessuno del tuo livello sta cercando. Continua o manda un link a un amico: basta un tocco.', 'Ninguém do seu nível está procurando ainda. Continue ou mande um link a um amigo: é um toque.')}</p>}
      <div className="df-acts"><button type="button" className="bt-show" onClick={stop}>{t('Stop looking', 'Перестать искать', 'Dejar de buscar', 'Suche beenden', 'Aramayı bırak', 'Arrêter de chercher', 'Smetti di cercare', 'Parar de procurar')}</button>{longWait && friend}</div>
    </div>
  );
  return (
    <div className="df">
      {phase === 'missed' && <p className="dr-note">{t('The match went: Ready wasn’t said in time.', 'Соперник ушёл: «Готов» не нажали вовремя.', 'El emparejamiento se perdió: no se dijo Listo a tiempo.', 'Die Partie ist weg: Bereit kam nicht rechtzeitig.', 'Eşleşme kaçtı: zamanında hazır denmedi.', 'Le duel est passé : Prêt n’a pas été dit à temps.', 'L’abbinamento è sfumato: Pronto non è arrivato in tempo.', 'O pareamento se foi: Pronto não foi dito a tempo.')}</p>}
      {phase === 'error' && <p className="dr-note">{t('Finding a race didn’t work just now. Try again.', 'Поиск гонки сейчас не удался. Попробуй ещё раз.', 'Buscar una regata no funcionó ahora. Inténtalo de nuevo.', 'Die Suche hat gerade nicht geklappt. Versuch es noch einmal.', 'Yarış arama şu an olmadı. Tekrar dene.', 'La recherche n’a pas marché. Réessaie.', 'La ricerca non ha funzionato. Riprova.', 'A busca não funcionou agora. Tente de novo.')}</p>}
      <div className="df-acts">
        <button type="button" className="bt-go" onClick={find}><IconPlay /><span>{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</span></button>
        {friend}
      </div>
      <p className="iv-note">{t('Matched by rating: within 100 at first, wider as you wait. About 4 minutes, one lap; your first three are easy ones.', 'Подбор по рейтингу: сначала в пределах 100, потом шире. Около 4 минут, один круг; первые три — лёгкие.', 'Emparejado por rating: a 100 al principio, más amplio mientras esperas. Unos 4 minutos, una vuelta; las tres primeras son fáciles.', 'Nach Wertung: zuerst bis 100, breiter, je länger du wartest. Etwa 4 Minuten, eine Runde; die ersten drei sind leicht.', 'Reytinge göre eşleşme: önce 100 içinde, bekledikçe daha geniş. Yaklaşık 4 dakika, tek tur; ilk üçü kolay.', 'Par classement : à 100 près au début, plus large à mesure que tu attends. Environ 4 minutes, un tour ; tes trois premières sont faciles.', 'Abbinati per rating: entro 100 all’inizio, più ampio mentre aspetti. Circa 4 minuti, un giro; le prime tre sono facili.', 'Pareado por rating: até 100 no início, mais amplo enquanto espera. Cerca de 4 minutos, uma volta; as três primeiras são fáceis.')}</p>
    </div>
  );
}
