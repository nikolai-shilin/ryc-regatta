'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, ruPlural, type Lang } from '@/lib/lang';
import { track } from '@/lib/track';
import { keptResults, readLog, streakOf, LOG_EVENT, type Log } from '@/lib/log';
import { pushable, currentSub, subscribe, unsubscribe, pushSync } from '@/lib/push';
import { useLog } from './passport';
import { Countdown } from './home-client';
import { clock } from './ui';

// Home for the player who has been before. Home is one cached page for everyone, so who has raced is the browser's
// to know: the head script in app/[lang]/layout.tsx marks <html data-back> before the first paint when this device has
// raced (its log or a kept result), and styles/home-back.css shows the strip and folds the explainers by it. The strip
// itself is drawn here from the log (lib/log.ts): the streak and what today's race does to it, and today's time against
// the board.

const BACK = 'data-back';
export const markBack = (log: Log | null) => { if (log && Object.keys(log.d).length) document.documentElement.setAttribute(BACK, ''); };

const ord = (n: number, lang: Lang) => (lang === 'ru' ? `${n}-е` : lang === 'es' ? `${n}.º` : lang === 'fr' ? (n === 1 ? '1er' : `${n}e`) : lang === 'de' || lang === 'tr' ? `${n}.` : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`);

export function BackStrip({ lang, day, top, cap = 5 }: { lang: Lang; day: string; top: { s: number }[]; cap?: number }) {
  const t = tx(lang), log = useLog();
  useEffect(() => markBack(log), [log]);
  if (!log || !Object.keys(log.d).length && !keptResults().length) return <div className="ho-back" aria-hidden="true" />;
  // one race behind them and it was the first (the game's easy race: its record says first), today's not yet: the way in
  // goes on, the first race done, today's race next (the designs' "after the first race")
  const firstOnly = !Object.keys(log.d).length ? (keptResults() as (ReturnType<typeof keptResults>[number] & { id?: string; first?: boolean })[]).find((r) => r.first) : null;
  if (firstOnly) return <AfterFirst lang={lang} res={firstOnly} />;
  const st = streakOf(log.d), mine = log.d[day] ?? null;
  // where today's time stands: its place when the board's rows reach it, else its gap to the leader
  const place = mine != null && top.length && (top.length < cap || mine <= top[top.length - 1].s + 0.05) ? top.filter((r) => r.s < mine - 0.05).length + 1 : 0;
  const gap = mine != null && top.length ? mine - top[0].s : 0;
  const days = (n: number) => t(`${n}-day streak`, `${n} ${ruPlural(n, ['день', 'дня', 'дней'])} подряд`, `Racha de ${n} ${n === 1 ? 'día' : 'días'}`, `${n}-Tage-Serie`, `${n} günlük seri`, `Série de ${n} ${n === 1 ? 'jour' : 'jours'}`);
  return (
    <div className="ho-back" aria-label={t('Your racing', 'Твои гонки', 'Tus regatas', 'Dein Segeln', 'Yarışların', 'Tes régates')} role="group">
      <div className={`ho-back-i${st.risk ? ' risk' : ''}`}>
        <span className="lbl">{t('Streak', 'Серия', 'Racha', 'Serie', 'Seri', 'Série')}</span>
        <b>{st.n ? days(st.n) : t('No streak yet', 'Серии пока нет', 'Aún sin racha', 'Noch keine Serie', 'Henüz seri yok', 'Pas encore de série')}</b>
        <small>{st.today ? t('Today’s is in. Back tomorrow for the next', 'Сегодняшняя есть. Завтра — следующая', 'La de hoy está hecha. Vuelve mañana para la siguiente', 'Die von heute ist drin. Morgen wieder für die nächste', 'Bugünküsü tamam. Sonraki için yarın gel', 'Celle d’aujourd’hui est faite. Reviens demain pour la suivante')
          : st.risk ? t('Sail today’s race or it ends', 'Пройди гонку дня, иначе серия прервётся', 'Navega la regata de hoy o se acaba', 'Segle die Regatta des Tages, sonst endet sie', 'Günün yarışını yarış, yoksa biter', 'Cours la régate du jour, sinon elle s’arrête')
          : st.n ? t(`Sail today’s race to make it ${st.n + 1}`, `Пройди гонку дня — будет ${st.n + 1}`, `Navega la regata de hoy para llegar a ${st.n + 1}`, `Segle die Regatta des Tages, damit es ${st.n + 1} werden`, `Seriyi ${st.n + 1} yapmak için günün yarışını yarış`, `Cours la régate du jour pour passer à ${st.n + 1}`)
          : t('Finish today’s race to start one', 'Пройди гонку дня, чтобы начать серию', 'Termina la regata de hoy para empezar una', 'Beende die Regatta des Tages, um eine zu beginnen', 'Bir seri başlatmak için günün yarışını bitir', 'Termine la régate du jour pour en commencer une')}</small>
      </div>
      <div className="ho-back-i">
        <span className="lbl">{t('Your time today', 'Твоё время сегодня', 'Tu tiempo de hoy', 'Deine Zeit heute', 'Bugünkü süren', 'Ton temps du jour')}</span>
        {mine != null ? <>
          <b>{clock(mine)}</b>
          <small>{place === 1 ? t('The time to beat is yours', 'Время дня — твоё', 'El tiempo a batir es el tuyo', 'Die Zeit zum Schlagen ist deine', 'Geçilecek süre senin', 'Le temps à battre est le tien') : place ? t(`${ord(place, lang)} today · ${gap.toFixed(1)} s off the lead`, `${ord(place, lang)} место · ${gap.toFixed(1).replace('.', ',')} с до лидера`, `${ord(place, lang)} hoy · a ${gap.toFixed(1).replace('.', ',')} s del líder`, `${ord(place, lang)} heute · ${gap.toFixed(1).replace('.', ',')} s hinter der Spitze`, `Bugün ${ord(place, lang)} · liderden ${gap.toFixed(1).replace('.', ',')} sn geride`, `${place}${place === 1 ? 'er' : 'e'} aujourd’hui · à ${gap.toFixed(1).replace('.', ',')} s du premier`) : gap > 0 ? t(`${gap.toFixed(1)} s off the lead`, `${gap.toFixed(1).replace('.', ',')} с до лидера`, `A ${gap.toFixed(1).replace('.', ',')} s del líder`, `${gap.toFixed(1).replace('.', ',')} s hinter der Spitze`, `Liderden ${gap.toFixed(1).replace('.', ',')} sn geride`, `À ${gap.toFixed(1).replace('.', ',')} s du premier`) : t('On today’s board', 'В рейтинге дня', 'En la clasificación de hoy', 'In der heutigen Rangliste', 'Günün tablosunda', 'Au classement du jour')}</small>
        </> : <>
          <b>{t('Not sailed yet', 'Ещё не пройдена', 'Sin navegar aún', 'Noch nicht gesegelt', 'Henüz yarışılmadı', 'Pas encore courue')}</b>
          <small>{t('Closes in', 'Закроется через', 'Cierra en', 'Schließt in', 'Kapanmasına kalan', 'Ferme dans')} <Countdown /></small>
        </>}
      </div>
      <div className="ho-back-i ho-back-push"><PushButton lang={lang} where="back" /></div>
    </div>
  );
}

// After the first race: the three steps with the first done and today's race now, the first race's place and time (and
// the way to sail it again), today's race not sailed yet and the time it has left, and the reminder
function AfterFirst({ lang, res }: { lang: Lang; res: { boats?: { me?: boolean; done?: boolean; dsq?: boolean; secs?: number | null }[] } }) {
  const t = tx(lang), boats = res.boats || [], me = boats.find((b) => b.me), place = me ? boats.indexOf(me) + 1 : 0;
  const how = !me ? '–' : me.dsq ? 'DSQ' : me.done && me.secs != null ? t(`${ord(place, lang)} of ${boats.length}`, `${place}-е из ${boats.length}`, `${ord(place, lang)} de ${boats.length}`, `${ord(place, lang)} von ${boats.length}`, `${boats.length} içinde ${ord(place, lang)}`, `${place}${place === 1 ? 'er' : 'e'} sur ${boats.length}`) : 'DNF';
  return (
    <div className="ho-back ho-after" aria-label={t('Your way in', 'Как начать', 'Por dónde empezar', 'Dein Einstieg', 'Başlangıç yolun', 'Par où commencer')} role="group">
      <ol className="ho-after-steps">
        <li className="done"><span className="ho-n" aria-hidden="true">✓</span>{t('First race', 'Первая гонка', 'Primera regata', 'Erste Regatta', 'İlk yarış', 'Première régate')}</li>
        <li className="now"><span className="ho-n">2</span>{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour')}</li>
        <li><Link href="/sign-in"><span className="ho-n">3</span>{t('Keep it', 'Сохранить', 'Guárdalo', 'Behalten', 'Sakla', 'La garder')}</Link></li>
      </ol>
      <div className="ho-back-i">
        <span className="lbl">{t('Your first race', 'Твоя первая гонка', 'Tu primera regata', 'Deine erste Regatta', 'İlk yarışın', 'Ta première régate')}</span>
        <b>{how}</b>
        <small>{me?.secs != null && !me.dsq ? `${clock(me.secs)} · ` : ''}<a className="ho-push-x" href="/play?race=first">{t('Sail it again', 'Пройти ещё раз', 'Navégala otra vez', 'Nochmal segeln', 'Tekrar yarış', 'La recourir')}</a></small>
      </div>
      <div className="ho-back-i">
        <span className="lbl">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour')}</span>
        <b>{t('Not sailed yet', 'Ещё не пройдена', 'Sin navegar aún', 'Noch nicht gesegelt', 'Henüz yarışılmadı', 'Pas encore courue')}</b>
        <small>{t('Closes in', 'Закроется через', 'Cierra en', 'Schließt in', 'Kapanmasına kalan', 'Ferme dans')} <Countdown /></small>
      </div>
      <div className="ho-back-i ho-back-push"><PushButton lang={lang} where="after-first" /></div>
    </div>
  );
}

// The daily reminder's switch (lib/push.ts): nothing where the browser can't take one, a word on adding the site to
// the Home Screen on an iPhone (where Safari takes them only there), and the reminder's own time, in local time.
export function PushButton({ lang, where }: { lang: Lang; where: string }) {
  const t = tx(lang);
  const [st, setSt] = useState<'wait' | 'na' | 'ios' | 'off' | 'on' | 'denied' | 'busy' | 'failed'>('wait');
  useEffect(() => {
    if (!pushable()) {
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone;
      setSt(ios ? 'ios' : 'na');
      return;
    }
    if (Notification.permission === 'denied') { setSt('denied'); return; }
    currentSub().then((s) => setSt(s && Notification.permission === 'granted' ? 'on' : 'off')).catch(() => setSt('off'));
  }, []);
  const at = (() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 17)).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }); })();
  const on = async () => {
    setSt('busy');
    const r = await subscribe(lang, readLog());
    track('Reminder', { where, result: r });
    setSt(r === 'on' ? 'on' : r);
  };
  const off = async () => { setSt('busy'); await unsubscribe(); track('Reminder', { where, result: 'off' }); setSt('off'); };
  if (st === 'wait' || st === 'na') return null;
  if (st === 'ios') return <p className="ho-push-t">{t('For a daily reminder on an iPhone: Share › Add to Home Screen, then open it from there.', 'Чтобы получать напоминание на iPhone: «Поделиться» › «На экран Домой», и открой оттуда.', 'Para un recordatorio diario en un iPhone: Compartir › Añadir a pantalla de inicio, y ábrela desde ahí.', 'Für eine tägliche Erinnerung auf dem iPhone: Teilen › Zum Home-Bildschirm, dann von dort öffnen.', 'iPhone’da günlük hatırlatma için: Paylaş › Ana Ekrana Ekle, sonra oradan aç.', 'Pour un rappel quotidien sur iPhone : Partager › Sur l’écran d’accueil, puis ouvre-le depuis là.')}</p>;
  if (st === 'denied') return <p className="ho-push-t">{t('Reminders are blocked for this site in the browser’s settings.', 'Напоминания для этого сайта выключены в настройках браузера.', 'Los recordatorios están bloqueados para este sitio en los ajustes del navegador.', 'Erinnerungen sind für diese Seite in den Browser-Einstellungen gesperrt.', 'Hatırlatmalar bu site için tarayıcı ayarlarında engellenmiş.', 'Les rappels sont bloqués pour ce site dans les réglages du navigateur.')}</p>;
  if (st === 'on') return (
    <div className="ho-push">
      <span className="lbl">{t('Reminder on', 'Напоминание включено', 'Recordatorio activado', 'Erinnerung an', 'Hatırlatma açık', 'Rappel activé')}</span>
      <b>{t(`Daily at ${at}`, `Каждый день в ${at}`, `A diario a las ${at}`, `Täglich um ${at}`, `Her gün ${at}`, `Tous les jours à ${at}`)}</b>
      <small>{t('Only on days you haven’t sailed yet. ', 'Только в дни, когда ты ещё не прошёл гонку. ', 'Solo los días que aún no has navegado. ', 'Nur an Tagen, an denen du noch nicht gesegelt bist. ', 'Yalnızca henüz yarışmadığın günlerde. ', 'Seulement les jours où tu n’as pas encore couru. ')}<button type="button" className="ho-push-x" onClick={off}>{t('Turn off', 'Выключить', 'Desactivar', 'Ausschalten', 'Kapat', 'Désactiver')}</button></small>
    </div>
  );
  return (
    <div className="ho-push">
      <button type="button" className="ho-ghost ho-push-go" onClick={on} disabled={st === 'busy'}>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>
        <span>{t('Remind me before it closes', 'Напомни до закрытия', 'Recuérdamelo antes de que cierre', 'Erinnere mich vor Schluss', 'Kapanmadan önce hatırlat', 'Préviens-moi avant la fermeture')}</span>
      </button>
      <small>{st === 'failed' ? t('That didn’t work. Try again in a moment.', 'Не получилось. Попробуй ещё раз чуть позже.', 'No ha funcionado. Inténtalo de nuevo en un momento.', 'Das hat nicht geklappt. Versuch es gleich nochmal.', 'Olmadı. Biraz sonra yeniden dene.', 'Ça n’a pas marché. Réessaie dans un instant.') : t(`At ${at}, only on days you haven’t sailed.`, `В ${at}, только в дни без гонки.`, `A las ${at}, solo los días que no has navegado.`, `Um ${at}, nur an Tagen, an denen du nicht gesegelt bist.`, `Saat ${at}, yalnızca yarışmadığın günlerde.`, `À ${at}, seulement les jours où tu n’as pas couru.`)}</small>
    </div>
  );
}

// On every page (app/[lang]/layout.tsx): the reminder's row kept up with the last day finished and the streak
export function PushSync({ lang }: { lang: Lang }) {
  useEffect(() => {
    const go = () => { if (pushable() && Notification.permission === 'granted') pushSync(lang, readLog()).catch(() => {}); };
    go();
    addEventListener(LOG_EVENT, go);
    return () => removeEventListener(LOG_EVENT, go);
  }, [lang]);
  return null;
}

// Which of Home's buttons lead where (Vercel Analytics, "Home CTA"): anything marked data-cta, with whether the
// reader has raced before. Captured as the click goes, so a link to /play (a page outside the app) still counts.
export function CtaTrack() {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLElement>('[data-cta]');
      if (!a) return;
      track('Home CTA', { where: a.dataset.cta || '', to: a.getAttribute('href') || '', back: document.documentElement.hasAttribute(BACK) ? 1 : 0 });
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, []);
  return null;
}

// The explainers, folded away for a reader who has raced (styles/home-back.css): one button opens them. Open as they
// are for everyone else, and opened by a link to anything inside them (/#faq).
export function Fold({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = tx(lang), ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1)), el = id ? document.getElementById(id) : null;
      // the browser's own jump came while it was folded away, so once it's open, the jump again
      if (el && ref.current?.contains(el) && !el.checkVisibility()) { setOpen(true); setTimeout(() => el.scrollIntoView(), 60); }
    };
    go();
    addEventListener('hashchange', go);
    return () => removeEventListener('hashchange', go);
  }, []);
  return (
    <div className={`ho-fold${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="ho-ghost ho-fold-btn" aria-expanded={open} onClick={() => { setOpen(!open); track('Home CTA', { where: 'fold', to: open ? 'close' : 'open', back: 1 }); }}>
        {open ? t('Less about the game', 'Свернуть', 'Menos sobre el juego', 'Weniger zum Spiel', 'Oyun hakkında daha az', 'Moins sur le jeu') : t('About the game: what’s inside, the questions, the rules', 'Об игре: что внутри, вопросы, правила', 'Sobre el juego: qué hay dentro, las preguntas, las reglas', 'Zum Spiel: was drinsteckt, die Fragen, die Regeln', 'Oyun hakkında: içinde ne var, sorular, kurallar', 'À propos du jeu : ce qu’il contient, les questions, les règles')}
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg>
      </button>
      <div className="ho-fold-in">{children}</div>
    </div>
  );
}

// Home's way to a 1-on-1 race against a friend, behind the same gate as the hub's (components/hub-client.tsx MatchCard):
// until the owner's test race it shows only when the address has ?match.
export function MatchLink({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(new URLSearchParams(location.search).has('match')); }, []);
  if (!on) return null;
  return <Link className="ho-ghost" href="/match/new" data-cta="friend-match">{t('Race a friend, 1-on-1', 'Гонка с другом 1 на 1', 'Regatea con un amigo, 1 contra 1', 'Fordere einen Freund heraus, 1 gegen 1', 'Bir arkadaşınla yarış, bire bir', 'Défie un ami en duel')}</Link>;
}
