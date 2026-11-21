'use client';
import { useEffect, useState } from 'react';
import { LOCALE, tx, type Lang } from '@/lib/lang';
import { hms, hourAt, parseHour, type HourState } from '@/lib/duel-hour';
import { linkPush, pushable, subscribe } from '@/lib/push';
import { readLog } from '@/lib/log';
import { track } from '@/lib/track';

// The duel hour in Ready now on /duel (release 6d of the 1-on-1 plan; lib/duel-hour.ts): every day 19:00–20:00 UTC,
// when it starts (counted down) or that it's on, how many are in for it and how many of them near your rating; I'm in,
// for a message 15 minutes before (asking this browser for the site's messages, or the Telegram bot for leave to write,
// if nothing can reach you yet), or out again. While it's on, Find a race. Read every minute while the page is seen.
const READ_MS = 60_000;
const hourPost = async (body: object): Promise<HourState | null> => {
  try {
    const r = await fetch('/connect/seek', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    return r.ok ? parseHour((await r.json())?.hour) : null;
  } catch { return null; }
};

export function DuelHour({ lang, signed, looking, onFind }: { lang: Lang; signed: boolean; looking: boolean; onFind: () => void }) {
  const t = tx(lang);
  const [now, setNow] = useState<number | null>(null); // (null until mounted: the clock is the reader's, not the server's)
  const [st, setSt] = useState<HourState | null>(null);
  const [note, setNote] = useState<'' | 'nomsg' | 'denied'>('');
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (!signed) return;
    const read = () => { if (document.visibilityState !== 'hidden') hourPost({ do: 'hour' }).then((s) => s && setSt(s)); };
    read();
    const i = setInterval(read, READ_MS);
    return () => clearInterval(i);
  }, [signed]);

  // in: and if no message can reach this sailor yet, this browser asked for the site's messages, or the bot inside Telegram
  const join = async () => {
    setNote('');
    let s = await hourPost({ do: 'hour_in', on: true });
    if (s) setSt(s);
    track('Duel hour in', {});
    if (!s || s.reach) return;
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; requestWriteAccess?: (cb: (ok: boolean) => void) => void } } }).Telegram?.WebApp;
    if (tg?.initData && tg.requestWriteAccess) {
      const ok = await new Promise<boolean>((res) => { try { tg.requestWriteAccess!((a) => res(!!a)); } catch { res(false); } });
      if (!ok) { setNote('denied'); return; }
      await new Promise((r) => setTimeout(r, 1500));
    } else if (pushable()) {
      const on = await subscribe(lang, readLog());
      if (on !== 'on') { setNote(on === 'denied' ? 'denied' : 'nomsg'); return; }
      await linkPush();
    } else { setNote('nomsg'); return; }
    s = await hourPost({ do: 'hour' });
    if (s) setSt(s);
    if (s && !s.reach) setNote('nomsg');
  };
  const leave = async () => { setNote(''); const s = await hourPost({ do: 'hour_in', on: false }); if (s) setSt(s); };

  const h = hourAt(now ?? 0), local = (ms: number) => new Date(ms).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' });
  const count = st ? (st.near != null
    ? t(`${st.in} in · ${st.near} at your level`, `Записались: ${st.in} · твоего уровня: ${st.near}`, `${st.in} apuntados · ${st.near} de tu nivel`, `${st.in} dabei · ${st.near} auf deinem Niveau`, `${st.in} katılıyor · ${st.near} senin seviyende`, `${st.in} inscrits · ${st.near} à ton niveau`, `${st.in} iscritti · ${st.near} al tuo livello`, `${st.in} confirmados · ${st.near} do seu nível`)
    : t(`${st.in} in`, `Записались: ${st.in}`, `${st.in} apuntados`, `${st.in} dabei`, `${st.in} katılıyor`, `${st.in} inscrits`, `${st.in} iscritti`, `${st.in} confirmados`)) : null;
  return (
    <div className={`df-hour${now != null && h.on ? ' on' : ''}`}>
      <span className="bt-k">{t('Duel hour · every day · 19:00 UTC', 'Час дуэлей · каждый день · 19:00 UTC', 'Hora de duelos · cada día · 19:00 UTC', 'Duell-Stunde · täglich · 19:00 UTC', 'Düello saati · her gün · 19:00 UTC', 'Heure des duels · chaque jour · 19:00 UTC', 'Ora dei duelli · ogni giorno · 19:00 UTC', 'Hora dos duelos · todo dia · 19:00 UTC')}</span>
      {now == null ? null : h.on ? (
        <p className="df-hour-t"><b>{t('On now', 'Идёт сейчас', 'En marcha', 'Läuft jetzt', 'Şu an sürüyor', 'En cours', 'In corso', 'Acontecendo agora')}</b>
          <span>{t(`until ${local(h.end)} your time · ${hms(h.left)} left`, `до ${local(h.end)} по твоему времени · осталось ${hms(h.left)}`, `hasta las ${local(h.end)} en tu hora · quedan ${hms(h.left)}`, `bis ${local(h.end)} deiner Zeit · noch ${hms(h.left)}`, `senin saatinle ${local(h.end)} kadar · ${hms(h.left)} kaldı`, `jusqu’à ${local(h.end)} chez toi · encore ${hms(h.left)}`, `fino alle ${local(h.end)} ora tua · mancano ${hms(h.left)}`, `até ${local(h.end)} no seu horário · faltam ${hms(h.left)}`)}</span></p>
      ) : (
        <p className="df-hour-t"><b>{t(`Starts in ${hms(h.left)}`, `Начнётся через ${hms(h.left)}`, `Empieza en ${hms(h.left)}`, `Beginnt in ${hms(h.left)}`, `${hms(h.left)} sonra başlıyor`, `Commence dans ${hms(h.left)}`, `Inizia tra ${hms(h.left)}`, `Começa em ${hms(h.left)}`)}</b>
          <span>{t(`${local(h.start)} your time, for an hour`, `в ${local(h.start)} по твоему времени, на час`, `a las ${local(h.start)} en tu hora, durante una hora`, `um ${local(h.start)} deiner Zeit, eine Stunde lang`, `senin saatinle ${local(h.start)}, bir saat`, `à ${local(h.start)} chez toi, pendant une heure`, `alle ${local(h.start)} ora tua, per un’ora`, `às ${local(h.start)} no seu horário, por uma hora`)}</span></p>
      )}
      {count ? <p className="df-band">{count}</p> : null}
      {!signed ? (
        <p className="iv-note">{t('Every evening sailors gather for an hour of 1-on-1 races, so there is someone at your level. Sign in to say you’re in.', 'Каждый вечер гонщики собираются на час гонок 1 на 1, так что соперник твоего уровня найдётся. Войди, чтобы записаться.', 'Cada tarde los regatistas se juntan una hora para regatas 1 contra 1, así siempre hay alguien de tu nivel. Inicia sesión para apuntarte.', 'Jeden Abend treffen sich Segler für eine Stunde 1-gegen-1-Regatten, so findet sich jemand auf deinem Niveau. Melde dich an, um dabei zu sein.', 'Her akşam denizciler bir saatlik bire bir yarışlar için toplanır; seviyende biri mutlaka olur. Katılmak için giriş yap.', 'Chaque soir, les régatiers se retrouvent une heure pour des duels : il y a toujours quelqu’un à ton niveau. Connecte-toi pour t’inscrire.', 'Ogni sera i velisti si ritrovano per un’ora di regate 1 contro 1, così c’è sempre qualcuno al tuo livello. Accedi per iscriverti.', 'Toda noite os velejadores se juntam por uma hora de regatas 1 contra 1, então sempre há alguém do seu nível. Entre para confirmar presença.')}</p>
      ) : now != null && h.on ? (
        !looking && <div className="df-acts"><button type="button" className="bt-show" onClick={onFind}>{t('Find a race now', 'Найти гонку сейчас', 'Buscar una regata ya', 'Jetzt eine Regatta finden', 'Şimdi yarış bul', 'Trouver une régate maintenant', 'Trova una regata ora', 'Achar uma regata agora')}</button></div>
      ) : st?.me ? (
        <>
          <p className="iv-note">{st.reach
            ? t('You’re in. A message 15 minutes before, to this browser or from our Telegram bot.', 'Ты в списке. Сообщение придёт за 15 минут — в этот браузер или от нашего Telegram-бота.', 'Estás dentro. Un mensaje 15 minutos antes, a este navegador o de nuestro bot de Telegram.', 'Du bist dabei. Eine Nachricht 15 Minuten vorher, an diesen Browser oder von unserem Telegram-Bot.', 'Katılıyorsun. 15 dakika önce bu tarayıcıya ya da Telegram botumuzdan bir mesaj gelecek.', 'C’est noté. Un message 15 minutes avant, sur ce navigateur ou par notre bot Telegram.', 'Sei dentro. Un messaggio 15 minuti prima, a questo browser o dal nostro bot Telegram.', 'Você está dentro. Uma mensagem 15 minutos antes, neste navegador ou do nosso bot do Telegram.')
            : t('You’re in. Nothing can message you yet, so come back at 19:00 UTC.', 'Ты в списке. Сообщения пока не доходят, так что возвращайся в 19:00 UTC.', 'Estás dentro. Aún no podemos enviarte mensajes, así que vuelve a las 19:00 UTC.', 'Du bist dabei. Noch erreicht dich keine Nachricht, also komm um 19:00 UTC wieder.', 'Katılıyorsun. Henüz sana mesaj ulaşamıyor; 19:00 UTC’de geri gel.', 'C’est noté. Aucun message ne peut encore t’arriver : reviens à 19:00 UTC.', 'Sei dentro. Ancora non possiamo scriverti, quindi torna alle 19:00 UTC.', 'Você está dentro. Ainda não conseguimos te enviar mensagens, então volte às 19:00 UTC.')}</p>
          <div className="df-acts"><button type="button" className="bt-show" onClick={leave}>{t('Not tonight', 'Не сегодня', 'Hoy no', 'Heute nicht', 'Bu akşam değil', 'Pas ce soir', 'Non stasera', 'Hoje não')}</button></div>
        </>
      ) : (
        <div className="df-acts"><button type="button" className="bt-show" onClick={join}>{t('I’m in · remind me', 'Я в деле · напомнить', 'Me apunto · avísame', 'Ich bin dabei · erinnere mich', 'Katılıyorum · hatırlat', 'J’en suis · préviens-moi', 'Ci sono · avvisami', 'Estou dentro · me avise')}</button></div>
      )}
      {note === 'nomsg' && <p className="dr-note">{t('This browser can’t take messages, so come back at 19:00 UTC.', 'Этот браузер не принимает сообщения — возвращайся в 19:00 UTC.', 'Este navegador no recibe mensajes: vuelve a las 19:00 UTC.', 'Dieser Browser nimmt keine Nachrichten an: komm um 19:00 UTC wieder.', 'Bu tarayıcı mesaj alamıyor; 19:00 UTC’de geri gel.', 'Ce navigateur ne reçoit pas de messages : reviens à 19:00 UTC.', 'Questo browser non riceve messaggi: torna alle 19:00 UTC.', 'Este navegador não recebe mensagens: volte às 19:00 UTC.')}</p>}
      {note === 'denied' && <p className="dr-note">{t('Messages are turned off for this site, so come back at 19:00 UTC.', 'Сообщения от сайта выключены — возвращайся в 19:00 UTC.', 'Los mensajes de este sitio están desactivados: vuelve a las 19:00 UTC.', 'Nachrichten dieser Seite sind aus: komm um 19:00 UTC wieder.', 'Bu sitenin mesajları kapalı; 19:00 UTC’de geri gel.', 'Les messages de ce site sont coupés : reviens à 19:00 UTC.', 'I messaggi di questo sito sono disattivati: torna alle 19:00 UTC.', 'As mensagens deste site estão desligadas: volte às 19:00 UTC.')}</p>}
    </div>
  );
}
