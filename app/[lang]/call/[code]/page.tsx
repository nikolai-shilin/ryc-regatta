import type { Metadata } from 'next';
import { getT, type LangParams } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { getAccount, supabaseServer } from '@/lib/supabase/server';
import { callCode, parseCall, type Call } from '@/lib/duel-call';
import { levelName } from '@/lib/levels';
import { provisional, shown } from '@/lib/elo';
import { venueOf } from '@/lib/venues';
import { yachtOf } from '@/lib/yachts';
import { BackLink } from '@/components/back-link';
import { SceneBrand } from '@/components/scene-brand';
import { IconPlay } from '@/components/ui';
import '@/styles/duel-rating.css';

// An open call's link, /call/K7M2QZ (release 5a of the 1-on-1 plan, lib/duel-call.ts): who is calling, their rating and
// level, where and in what if they wished it, and the band of ratings that may take it. Open: a signed-in sailor in the
// band takes it (/duel?take=, both then get Match found), a visitor signs in and comes back to take it, anyone else is
// told whose call it is for. Taken (by whom), away (the caller isn't looking just now) and closed say so, with Find a race.
// Read afresh on every visit, never cached and never indexed: it changes as the call does.
export const dynamic = 'force-dynamic';
type Params = LangParams & { params: Promise<{ lang: string; code: string }> };

async function readCall(raw: string): Promise<Call | null> {
  const code = callCode(raw);
  if (!code) return null;
  try { const { data, error } = await (await supabaseServer()).rpc('regatta_call_view', { p_code: code }); return error ? null : parseCall(data); } catch { return null; }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ lang, t }, { code: raw }] = await Promise.all([getT(params), params]);
  const c = await readCall(raw);
  if (!c) return pageMeta(lang, { title: t('An open 1-on-1 call', 'Открытый вызов 1 на 1', 'Un reto abierto 1 contra 1', 'Eine offene 1-gegen-1-Herausforderung', 'Açık bire bir çağrı', 'Un appel ouvert en duel', 'Una sfida aperta 1 contro 1', 'Um desafio aberto 1 contra 1'), index: false });
  const who = c.name || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const card = `/og/page/call?${new URLSearchParams({ ...(c.name && { n: c.name }), r: String(c.rating), p: String(c.races), lo: String(c.lo), hi: String(c.hi), ...(c.venue && { v: c.venue }), ...(c.yacht && { b: c.yacht }) })}`;
  return pageMeta(lang, {
    title: t(`${who} wants a 1-on-1 race: take the call`, `${who} зовёт на гонку 1 на 1: прими вызов`, `${who} busca una regata 1 contra 1: acepta el reto`, `${who} sucht eine 1-gegen-1-Regatta: nimm die Herausforderung an`, `${who} bire bir yarış arıyor: çağrıyı kabul et`, `${who} cherche un duel : prends l’appel`, `${who} cerca una regata 1 contro 1: accetta la sfida`, `${who} quer um duelo 1 contra 1: aceite o desafio`),
    description: t(`Rated, about 4 minutes, in your browser. For ratings ${c.lo}–${c.hi}: the first to take it races.`, `Рейтинговая, около 4 минут, в браузере. Для рейтинга ${c.lo}–${c.hi}: гоняется первый, кто примет.`, `Con rating, unos 4 minutos, en tu navegador. Para ratings ${c.lo}–${c.hi}: regatea el primero que lo acepte.`, `Gewertet, etwa 4 Minuten, im Browser. Für Wertungen ${c.lo}–${c.hi}: Wer zuerst annimmt, segelt.`, `Reytingli, yaklaşık 4 dakika, tarayıcında. ${c.lo}–${c.hi} reyting için: ilk kabul eden yarışır.`, `Classé, environ 4 minutes, dans ton navigateur. Pour les classements ${c.lo}–${c.hi} : le premier qui le prend court.`, `Valida per il rating, circa 4 minuti, nel browser. Per rating ${c.lo}–${c.hi}: corre il primo che la prende.`, `Vale rating, cerca de 4 minutos, no navegador. Para ratings ${c.lo}–${c.hi}: corre o primeiro a aceitar.`),
    card, index: false,
  });
}

export default async function CallPage({ params }: Params) {
  const [{ lang, t }, { code: raw }, account] = await Promise.all([getT(params), params, getAccount()]);
  const c = await readCall(raw);
  const find = <a className="bt-show" href="/duel">{t('Find a race', 'Найти гонку', 'Buscar una regata', 'Regatta finden', 'Yarış bul', 'Trouver une régate', 'Trova una regata', 'Encontrar uma regata')}</a>;
  const top = (
    <div className="bt-top">
      <BackLink href="/duel" label={t('The 1-on-1 page', 'Страница 1 на 1', 'La página 1 contra 1', 'Die 1-gegen-1-Seite', 'Bire bir sayfası', 'La page duel', 'La pagina 1 contro 1', 'A página 1 contra 1')} />
      <SceneBrand lang={lang} />
    </div>
  );
  const kick = <span className="bt-kick bt-kick-w">{t('Open call · 1-on-1 · rated', 'Открытый вызов · 1 на 1 · рейтинг', 'Reto abierto · 1 contra 1 · con rating', 'Offene Herausforderung · 1 gegen 1 · gewertet', 'Açık çağrı · bire bir · reytingli', 'Appel ouvert · duel · classé', 'Sfida aperta · 1 contro 1 · valida', 'Desafio aberto · 1 contra 1 · vale rating')}</span>;
  if (!c) return (
    <div className="scr bt-scr bc" lang={lang}><div className="bt"><div className="bt-info">
      {top}{kick}
      <h1 className="bt-h">{t('This call link doesn’t work', 'Эта ссылка на вызов не работает', 'Este enlace de reto no funciona', 'Dieser Link funktioniert nicht', 'Bu çağrı bağlantısı çalışmıyor', 'Ce lien d’appel ne marche pas', 'Questo link di sfida non funziona', 'Este link de desafio não funciona')}</h1>
      <p className="bt-p">{t('Its code is missing or mistyped, or the call is gone. Find a race of your own: you’re matched by rating.', 'В ней нет кода или он с опечаткой, либо вызова уже нет. Найди свою гонку: соперника подберут по рейтингу.', 'Le falta el código o está mal escrito, o el reto ya no existe. Busca tu propia regata: te emparejamos por rating.', 'Der Code fehlt oder ist vertippt, oder die Herausforderung gibt es nicht mehr. Finde deine eigene Regatta: nach Wertung gepaart.', 'Kodu eksik ya da hatalı, veya çağrı artık yok. Kendi yarışını bul: reytinge göre eşleşirsin.', 'Son code manque ou est mal tapé, ou l’appel n’existe plus. Trouve ta propre régate : on t’apparie par classement.', 'Il codice manca o è sbagliato, oppure la sfida non c’è più. Trova la tua regata: abbinati per rating.', 'O código está faltando ou errado, ou o desafio não existe mais. Encontre sua própria regata: o pareamento é por rating.')}</p>
      <div className="df-acts">{find}</div>
    </div></div></div>
  );
  const who = c.name || t('A sailor', 'Соперник', 'Un regatista', 'Ein Segler', 'Bir denizci', 'Un marin', 'Un velista', 'Um velejador');
  const where = [c.venue ? t(...venueOf(c.venue).name) : null, c.yacht ? t(...yachtOf(c.yacht).name) : null].filter(Boolean).join(' · ');
  const mins = Math.max(1, Math.ceil(c.left / 60));
  const take = `/duel?take=${c.code}`;
  let body;
  if (c.state === 'open' && c.mine) body = <><p className="bt-p">{t('This is your call. It stays open while you look on the 1-on-1 page, an hour at most.', 'Это твой вызов. Он открыт, пока ты ищешь гонку на странице 1 на 1, не дольше часа.', 'Es tu reto. Sigue abierto mientras buscas en la página 1 contra 1, una hora como mucho.', 'Das ist deine Herausforderung. Sie bleibt offen, solange du auf der 1-gegen-1-Seite suchst, höchstens eine Stunde.', 'Bu senin çağrın. Bire bir sayfasında aradığın sürece açık kalır, en fazla bir saat.', 'C’est ton appel. Il reste ouvert tant que tu cherches sur la page duel, une heure au plus.', 'È la tua sfida. Resta aperta finché cerchi nella pagina 1 contro 1, un’ora al massimo.', 'É o seu desafio. Fica aberto enquanto você procura na página 1 contra 1, no máximo uma hora.')}</p><div className="df-acts">{find}</div></>;
  else if (c.state === 'open' && !account) body = <><p className="bt-p">{t('Rated races need an account on both sides. Sign in, and the call is yours to take.', 'Для рейтинговых гонок у обоих нужен аккаунт. Войди — и вызов можно принять.', 'Las regatas con rating necesitan cuenta en los dos lados. Inicia sesión y el reto es tuyo.', 'Gewertete Regatten brauchen auf beiden Seiten ein Konto. Melde dich an, dann kannst du annehmen.', 'Reytingli yarışlar için iki tarafta da hesap gerekir. Giriş yap, çağrı senin olsun.', 'Les régates classées demandent un compte des deux côtés. Connecte-toi, et l’appel est à toi.', 'Le regate valide richiedono un account da entrambe le parti. Accedi e la sfida è tua.', 'Regatas valendo rating pedem conta dos dois lados. Entre, e o desafio é seu.')}</p>
    <div className="df-acts"><a className="bt-go df-go" href={`/sign-in?next=${encodeURIComponent(take)}`}><IconPlay /><span>{t('Sign in to take it', 'Войти и принять', 'Inicia sesión para aceptar', 'Anmelden und annehmen', 'Giriş yap ve kabul et', 'Se connecter pour le prendre', 'Accedi per accettare', 'Entrar para aceitar')}</span></a></div></>;
  else if (c.state === 'open' && c.fits === false) body = <><p className="bt-p">{t(`This call is for ratings ${c.lo}–${c.hi}, and yours is outside it. Find a race nearer your level.`, `Этот вызов для рейтинга ${c.lo}–${c.hi}, а твой вне диапазона. Найди гонку ближе к своему уровню.`, `Este reto es para ratings ${c.lo}–${c.hi} y el tuyo está fuera. Busca una regata más cerca de tu nivel.`, `Diese Herausforderung ist für Wertungen ${c.lo}–${c.hi}, deine liegt außerhalb. Finde eine Regatta näher an deinem Niveau.`, `Bu çağrı ${c.lo}–${c.hi} reyting için, seninki dışında. Seviyene daha yakın bir yarış bul.`, `Cet appel est pour les classements ${c.lo}–${c.hi}, et le tien est en dehors. Trouve une régate plus proche de ton niveau.`, `Questa sfida è per rating ${c.lo}–${c.hi} e il tuo è fuori. Trova una regata più vicina al tuo livello.`, `Este desafio é para ratings ${c.lo}–${c.hi}, e o seu está fora. Encontre uma regata mais perto do seu nível.`)}</p><div className="df-acts">{find}</div></>;
  else if (c.state === 'open') body = <><div className="df-acts"><a className="bt-go df-go" href={take}><IconPlay /><span>{t('Take it', 'Принять', 'Aceptar', 'Annehmen', 'Kabul et', 'Le prendre', 'Accetta', 'Aceitar')}</span></a>{find}</div>
    <p className="iv-note">{t(`Then ten seconds to say Ready, as with any match. Open for ${mins} more min.`, `Потом десять секунд, чтобы нажать «Готов», как в любом матче. Открыт ещё ${mins} мин.`, `Luego diez segundos para decir Listo, como en cualquier emparejamiento. Abierto ${mins} min más.`, `Dann zehn Sekunden, um Bereit zu sagen, wie bei jeder Partie. Noch ${mins} Min. offen.`, `Sonra her eşleşmede olduğu gibi hazır demek için on saniye. ${mins} dk daha açık.`, `Puis dix secondes pour dire Prêt, comme pour tout duel. Ouvert encore ${mins} min.`, `Poi dieci secondi per dire Pronto, come in ogni abbinamento. Aperta ancora ${mins} min.`, `Depois dez segundos para dizer Pronto, como em qualquer pareamento. Aberto por mais ${mins} min.`)}</p></>;
  else if (c.state === 'taken') body = <><p className="bt-p">{c.takenBy
    ? t(`${c.takenBy} took it. Find a race of your own: you’re matched by rating.`, `${c.takenBy} принял(а) вызов. Найди свою гонку: соперника подберут по рейтингу.`, `${c.takenBy} lo aceptó. Busca tu propia regata: te emparejamos por rating.`, `${c.takenBy} hat angenommen. Finde deine eigene Regatta: nach Wertung gepaart.`, `${c.takenBy} kabul etti. Kendi yarışını bul: reytinge göre eşleşirsin.`, `${c.takenBy} l’a pris. Trouve ta propre régate : on t’apparie par classement.`, `${c.takenBy} l’ha presa. Trova la tua regata: abbinati per rating.`, `${c.takenBy} aceitou. Encontre sua própria regata: o pareamento é por rating.`)
    : t('Taken. Find a race of your own: you’re matched by rating.', 'Вызов уже приняли. Найди свою гонку: соперника подберут по рейтингу.', 'Aceptado. Busca tu propia regata: te emparejamos por rating.', 'Angenommen. Finde deine eigene Regatta: nach Wertung gepaart.', 'Kabul edildi. Kendi yarışını bul: reytinge göre eşleşirsin.', 'Pris. Trouve ta propre régate : on t’apparie par classement.', 'Presa. Trova la tua regata: abbinati per rating.', 'Aceito. Encontre sua própria regata: o pareamento é por rating.')}</p><div className="df-acts">{find}</div></>;
  else if (c.state === 'away') body = <><p className="bt-p">{t(`${who} isn’t looking for a race right now. The call is still theirs for ${mins} min, if they come back.`, `${who} сейчас не ищет гонку. Вызов действует ещё ${mins} мин — на случай, если ${who} вернётся.`, `${who} no está buscando regata ahora. El reto sigue siendo suyo ${mins} min, si vuelve.`, `${who} sucht gerade keine Regatta. Die Herausforderung gilt noch ${mins} Min., falls ${who} zurückkommt.`, `${who} şu an yarış aramıyor. Dönerse çağrı ${mins} dk daha onun.`, `${who} ne cherche pas de régate en ce moment. L’appel tient encore ${mins} min, en cas de retour.`, `${who} ora non cerca una regata. La sfida resta sua per ${mins} min, se torna.`, `${who} não está procurando regata agora. O desafio continua valendo por ${mins} min, se voltar.`)}</p><div className="df-acts">{find}</div></>;
  else body = <><p className="bt-p">{t('This call has closed. Find a race of your own: you’re matched by rating.', 'Этот вызов закрыт. Найди свою гонку: соперника подберут по рейтингу.', 'Este reto está cerrado. Busca tu propia regata: te emparejamos por rating.', 'Diese Herausforderung ist beendet. Finde deine eigene Regatta: nach Wertung gepaart.', 'Bu çağrı kapandı. Kendi yarışını bul: reytinge göre eşleşirsin.', 'Cet appel est clos. Trouve ta propre régate : on t’apparie par classement.', 'Questa sfida è chiusa. Trova la tua regata: abbinati per rating.', 'Esse desafio foi encerrado. Encontre sua própria regata: o pareamento é por rating.')}</p><div className="df-acts">{find}</div></>;
  const STATE = { open: t('Open', 'Открыт', 'Abierto', 'Offen', 'Açık', 'Ouvert', 'Aperta', 'Aberto'), taken: t('Taken', 'Принят', 'Aceptado', 'Vergeben', 'Alındı', 'Pris', 'Presa', 'Aceito'), away: t('Waiting', 'Ждёт', 'En espera', 'Wartet', 'Bekliyor', 'En attente', 'In attesa', 'Aguardando'), closed: t('Closed', 'Закрыт', 'Cerrado', 'Beendet', 'Kapandı', 'Clos', 'Chiusa', 'Encerrado') };
  return (
    <div className="scr bt-scr bc" lang={lang}>
      <div className="bt">
        <div className="bt-info">
          {top}{kick}
          <h1 className="bt-h">{t('Race me', 'Сыграем', 'Rétame', 'Segle gegen mich', 'Bana karşı yarış', 'Défie-moi', 'Sfidami', 'Me desafie')}</h1>
          <p className="iv-who"><b>{who}</b><span className="dr-lvl">{provisional(c.races) ? t('New to 1-on-1', 'Новичок в 1 на 1', 'Nuevo en 1 contra 1', 'Neu im 1 gegen 1', 'Bire birde yeni', 'Nouveau en duel', 'Nuovo all’1 contro 1', 'Novo no 1 contra 1') : levelName(c.rating, lang)}</span><span className="iv-r">{shown(c.rating, c.races)}</span></p>
          <p className="df-where">{[where, t('one lap · about 4 min', 'один круг · около 4 мин', 'una vuelta · unos 4 min', 'eine Runde · etwa 4 Min.', 'tek tur · yaklaşık 4 dk', 'un tour · environ 4 min', 'un giro · circa 4 min', 'uma volta · cerca de 4 min'), t(`for ${c.lo}–${c.hi}`, `для ${c.lo}–${c.hi}`, `para ${c.lo}–${c.hi}`, `für ${c.lo}–${c.hi}`, `${c.lo}–${c.hi} için`, `pour ${c.lo}–${c.hi}`, `per ${c.lo}–${c.hi}`, `para ${c.lo}–${c.hi}`)].filter(Boolean).join(' · ')}</p>
          <span className={`df-state df-state-${c.state}`}>{STATE[c.state]}</span>
          {body}
        </div>
      </div>
    </div>
  );
}
