'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { hh, parseMsg, QUIET, type Msg } from '@/lib/messages';
import '@/styles/messages.css';

// The Messages card on /settings, for a signed-in sailor (release 5d of the 1-on-1 plan; lib/messages.ts): Match found
// while away, by the browsers they have allowed and from the Telegram bot, each a switch, with what each needs if it
// can't reach them yet; and quiet hours in their own time zone (the browser's), when nothing is sent. Each change is
// saved at once (POST /connect/messages).
export function MessagesForm({ lang }: { lang: Lang }) {
  const [m, setM] = useState<Msg | null>(null);
  const [tz, setTz] = useState('UTC');
  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); } catch { /* UTC */ }
    fetch('/connect/messages', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => setM(parseMsg(j)), () => {});
  }, []);
  const save = (next: Msg) => {
    setM(next);
    fetch('/connect/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ push: next.push, telegram: next.telegram, quietFrom: next.quietFrom, quietTo: next.quietTo, tz }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { const p = parseMsg(j); if (p) setM(p); }, () => {});
  };
  return m ? <MessagesView lang={lang} m={m} tz={tz} save={save} /> : null;
}

export function MessagesView({ lang, m, tz, save }: { lang: Lang; m: Msg; tz: string; save: (m: Msg) => void }) {
  const t = tx(lang);
  const sw = (k: 'push' | 'telegram', label: string, note: React.ReactNode) => (
    <>
      <div className="srow">
        <span className="srow-k" id={`l-msg-${k}`}>{label}</span>
        <button type="button" className="tgl" role="switch" aria-checked={m[k]} aria-labelledby={`l-msg-${k}`} onClick={() => save({ ...m, [k]: !m[k] })}><i /></button>
      </div>
      <p className="small st-note">{note}</p>
    </>
  );
  const on = (q: readonly [number, number] | null) => (q ? m.quietFrom === q[0] && m.quietTo === q[1] : m.quietFrom == null);
  return (
    <div className="st-msg">
      <div className="st-sub"><span className="lbl-ink">{t('1-on-1: Match found while you’re away', '1 на 1: соперник найден, пока тебя нет', '1 contra 1: rival encontrado mientras no estás', '1 gegen 1: Gegner gefunden, während du weg bist', 'Bire bir: sen yokken rakip bulundu', 'Duel : adversaire trouvé pendant ton absence', '1 contro 1: avversario trovato mentre sei via', '1 contra 1: adversário encontrado enquanto você está fora')}</span></div>
      {sw('push', t('In the browsers you’ve allowed', 'В разрешённых браузерах', 'En los navegadores que permitiste', 'In den Browsern, die du erlaubt hast', 'İzin verdiğin tarayıcılarda', 'Dans les navigateurs autorisés', 'Nei browser che hai autorizzato', 'Nos navegadores que você permitiu'),
        m.browsers
          ? t(`${m.browsers} ${m.browsers === 1 ? 'browser' : 'browsers'} allowed.`, `Разрешено браузеров: ${m.browsers}.`, `${m.browsers} ${m.browsers === 1 ? 'navegador permitido' : 'navegadores permitidos'}.`, `${m.browsers} ${m.browsers === 1 ? 'Browser' : 'Browser'} erlaubt.`, `${m.browsers} tarayıcıya izin verildi.`, `${m.browsers} ${m.browsers === 1 ? 'navigateur autorisé' : 'navigateurs autorisés'}.`, `${m.browsers} ${m.browsers === 1 ? 'browser autorizzato' : 'browser autorizzati'}.`, `${m.browsers} ${m.browsers === 1 ? 'navegador permitido' : 'navegadores permitidos'}.`)
          : <>{t('None yet: turn on “Keep looking if I leave” on ', 'Пока ни одного: включи «Искать, даже если я уйду» на ', 'Ninguno aún: activa «Seguir buscando si salgo» en ', 'Noch keiner: Schalte „Weitersuchen, wenn ich gehe“ ein auf ', 'Henüz yok: şurada “Çıkarsam aramaya devam et”i aç: ', 'Aucun pour l’instant : active « Continuer si je pars » sur ', 'Nessuno per ora: attiva «Continua a cercare se esco» nella ', 'Nenhum ainda: ative “Continuar procurando se eu sair” na ')}<Link href="/duel">{t('the 1-on-1 page', 'странице 1 на 1', 'la página 1 contra 1', 'der 1-gegen-1-Seite', 'bire bir sayfası', 'la page duel', 'pagina 1 contro 1', 'página 1 contra 1')}</Link>.</>)}
      {sw('telegram', t('From the Telegram bot', 'От бота в Telegram', 'Del bot de Telegram', 'Vom Telegram-Bot', 'Telegram botundan', 'Par le bot Telegram', 'Dal bot Telegram', 'Do bot no Telegram'),
        m.bot
          ? t('The bot can write to you.', 'Бот может тебе писать.', 'El bot puede escribirte.', 'Der Bot darf dir schreiben.', 'Bot sana yazabilir.', 'Le bot peut t’écrire.', 'Il bot può scriverti.', 'O bot pode te escrever.')
          : t('Sign in with Telegram and start the bot to get these there.', 'Чтобы получать их там, войди через Telegram и запусти бота.', 'Inicia sesión con Telegram y abre el bot para recibirlos allí.', 'Melde dich mit Telegram an und starte den Bot, um sie dort zu bekommen.', 'Orada almak için Telegram ile giriş yap ve botu başlat.', 'Connecte-toi avec Telegram et lance le bot pour les recevoir là.', 'Accedi con Telegram e avvia il bot per riceverli lì.', 'Entre com o Telegram e inicie o bot para recebê-los lá.'))}
      <div className="st-sub"><span className="lbl-ink" id="l-msg-quiet">{t('Quiet hours', 'Тихие часы', 'Horas de silencio', 'Ruhezeiten', 'Sessiz saatler', 'Heures calmes', 'Ore di silenzio', 'Horário de silêncio')}</span></div>
      <div className="segc" role="radiogroup" aria-labelledby="l-msg-quiet">
        {QUIET.map((q) => (
          <button key={q ? q.join('-') : 'off'} type="button" role="radio" aria-checked={on(q)} className={on(q) ? 'on' : ''} onClick={() => save({ ...m, quietFrom: q ? q[0] : null, quietTo: q ? q[1] : null })}>
            {q ? `${hh(q[0])}–${hh(q[1])}` : t('Off', 'Выкл.', 'No', 'Aus', 'Kapalı', 'Non', 'No', 'Não')}
          </button>
        ))}
      </div>
      <p className="small st-note">{t(`In your time (${tz}): no Match found and no daily reminder in these hours.`, `По твоему времени (${tz}): в эти часы ни «Соперник найден», ни ежедневного напоминания.`, `En tu hora (${tz}): ni rival encontrado ni recordatorio diario en esas horas.`, `In deiner Zeit (${tz}): in diesen Stunden kein „Gegner gefunden“ und keine tägliche Erinnerung.`, `Senin saatinle (${tz}): bu saatlerde ne rakip bulundu ne de günlük hatırlatma.`, `À ton heure (${tz}) : ni « adversaire trouvé » ni rappel quotidien pendant ces heures.`, `Nel tuo orario (${tz}): in queste ore niente avversario trovato né promemoria giornaliero.`, `No seu horário (${tz}): nessas horas, nem adversário encontrado nem lembrete diário.`)}{m.quietNow ? ` ${t('It’s quiet hours now.', 'Сейчас тихие часы.', 'Ahora es hora de silencio.', 'Gerade ist Ruhezeit.', 'Şu an sessiz saatler.', 'C’est l’heure calme.', 'Ora sono ore di silenzio.', 'Agora é horário de silêncio.')}` : ''}</p>
    </div>
  );
}
