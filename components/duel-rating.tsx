'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { levelName, nextLevel } from '@/lib/levels';
import { provisional, shown, signed, PROVISIONAL } from '@/lib/elo';
import { parseRating, whyText, type DuelRating as R } from '@/lib/duel-rating';
import '@/styles/duel-rating.css';

// What your 1-on-1 race did to your rating, on its result page under the results (components/result-view.tsx): the new
// rating and the change, the level and the bar to the next one (a provisional rating instead says which of its first five
// races this was), and the other sailor's change. Asked of GET /connect/rating, again every 4 s while the other screen's end
// is still to come, for 90 s at the most. Nothing at all for a sailor not signed in, or a race that isn't theirs.
const EVERY_MS = 4000, FOR_MS = 90000;

export function DuelRating({ duel, lang }: { duel: { code: string; seed: number }; lang: Lang }) {
  const [r, setR] = useState<R>({ status: 'none' });
  useEffect(() => {
    let on = true, timer: ReturnType<typeof setTimeout> | null = null;
    const first = Date.now();
    const ask = async () => {
      let next: R = { status: 'none' };
      try {
        const res = await fetch(`/connect/rating?code=${encodeURIComponent(duel.code)}&seed=${duel.seed}&lang=${lang}`, { cache: 'no-store', credentials: 'same-origin' });
        if (res.ok) next = parseRating(await res.json());
      } catch {}
      if (!on) return;
      setR(next);
      if (next.status === 'waiting' && Date.now() - first < FOR_MS) timer = setTimeout(ask, EVERY_MS);
    };
    ask();
    return () => { on = false; if (timer) clearTimeout(timer); };
  }, [duel.code, duel.seed, lang]);
  return <DuelRatingView r={r} lang={lang} />;
}

// the block for one answer (drawn on the server in the tests)
export function DuelRatingView({ r, lang }: { r: R; lang: Lang }) {
  const t = tx(lang);
  const label = t('1-on-1 rating', 'Рейтинг 1 на 1', 'Rating 1 contra 1', '1-gegen-1-Wertung', 'Bire bir reyting', 'Classement en duel', 'Rating 1 contro 1', 'Rating 1 contra 1');
  if (r.status === 'none') return null;
  if (r.status === 'waiting') return (
    <div className="dr" aria-live="polite"><span className="dr-k">{label}</span>
      <p className="dr-note">{t('Waiting for both screens to tell the result…', 'Ждём, пока оба экрана сообщат итог…', 'Esperando a que las dos pantallas den el resultado…', 'Warte, bis beide Bildschirme das Ergebnis melden …', 'İki ekranın da sonucu bildirmesi bekleniyor…', 'On attend que les deux écrans donnent le résultat…', 'In attesa che entrambi gli schermi diano il risultato…', 'Esperando as duas telas informarem o resultado…')}</p>
    </div>
  );
  if (r.status === 'unrated') return (
    <div className="dr" aria-live="polite"><span className="dr-k">{label}</span>
      <p className="dr-note">{t('Not rated', 'Без рейтинга', 'Sin rating', 'Nicht gewertet', 'Reytinge sayılmadı', 'Hors classement', 'Non valida per il rating', 'Não conta para o rating')}: {whyText(r.reason, lang)}.</p>
      <a className="dr-help" href="/help/duel#h-fair">{t('How 1-on-1 races work', 'Как устроены гонки 1 на 1', 'Cómo funcionan las regatas 1 contra 1', 'So funktionieren 1-gegen-1-Regatten', 'Bire bir yarışlar nasıl işler', 'Comment marchent les duels', 'Come funzionano le regate 1 contro 1', 'Como funcionam os duelos')} ›</a>
    </div>
  );

  const { me, them } = r, prov = provisional(me.races), next = prov ? null : nextLevel(me.after);
  const dir = me.delta > 0 ? 'up' : me.delta < 0 ? 'down' : '';
  return (
    <div className="dr" aria-live="polite">
      <span className="dr-k">{label}</span>
      <div className="dr-top">
        <b className="dr-n">{shown(me.after, me.races)}</b>
        <span className={`dr-d ${dir}`}>{signed(me.delta)}</span>
        {prov
          ? <span className="dr-lvl">{t(`Race ${me.races} of ${PROVISIONAL}`, `Гонка ${me.races} из ${PROVISIONAL}`, `Regata ${me.races} de ${PROVISIONAL}`, `Regatta ${me.races} von ${PROVISIONAL}`, `${PROVISIONAL} yarıştan ${me.races}.`, `Régate ${me.races} sur ${PROVISIONAL}`, `Regata ${me.races} di ${PROVISIONAL}`, `Regata ${me.races} de ${PROVISIONAL}`)}</span>
          : <span className="dr-lvl">{levelName(me.after, lang)}</span>}
        <span className="dr-was">{t(`from ${me.before}`, `было ${me.before}`, `antes ${me.before}`, `vorher ${me.before}`, `önce ${me.before}`, `avant ${me.before}`, `prima ${me.before}`, `antes ${me.before}`)}</span>
      </div>
      {next && (
        <div className="dr-next">
          <span className="dr-bar" aria-hidden="true"><i style={{ width: `${Math.round(next.at * 100)}%` }} /></span>
          <span className="dr-to">{t(`${next.to} to ${levelName(next.level.min, 'en')}`, `${next.to} до уровня «${levelName(next.level.min, 'ru')}»`, `${next.to} para ${levelName(next.level.min, 'es')}`, `${next.to} bis ${levelName(next.level.min, 'de')}`, `${levelName(next.level.min, 'tr')} seviyesine ${next.to}`, `${next.to} avant ${levelName(next.level.min, 'fr')}`, `${next.to} a ${levelName(next.level.min, 'it')}`, `${next.to} para ${levelName(next.level.min, 'pt')}`)}</span>
        </div>
      )}
      {prov && <p className="dr-note">{t('Your first five rated races count double, so the rating finds your level fast. It shows with a ~ until they’re done.', 'Первые пять рейтинговых гонок идут в двойном размере, чтобы рейтинг быстро нашёл твой уровень. До их конца он показан с ~.', 'Tus cinco primeras regatas con rating cuentan doble, para que el rating encuentre pronto tu nivel. Hasta entonces se muestra con ~.', 'Deine ersten fünf gewerteten Regatten zählen doppelt, damit die Wertung dein Niveau schnell findet. Bis dahin steht sie mit ~.', 'İlk beş reytingli yarışın iki kat sayılır, böylece reyting seviyeni çabuk bulur. O zamana kadar ~ ile gösterilir.', 'Tes cinq premières régates classées comptent double, pour que le classement trouve vite ton niveau. D’ici là, il s’affiche avec un ~.', 'Le tue prime cinque regate valide contano doppio, così il rating trova presto il tuo livello. Fino ad allora si vede con ~.', 'Suas cinco primeiras regatas valendo rating contam em dobro, para o rating achar logo o seu nível. Até lá ele aparece com ~.')}</p>}
      <p className="dr-them">{them.name || t('The other sailor', 'Соперник', 'El otro regatista', 'Der andere Segler', 'Diğer denizci', 'L’autre marin', 'L’altro velista', 'O outro velejador')} <b>{shown(them.after, them.races)}</b> <span className={them.delta > 0 ? 'up' : them.delta < 0 ? 'down' : ''}>{signed(them.delta)}</span></p>
      <a className="dr-help" href="/help/duel#h-rating">{t('How 1-on-1 races work', 'Как устроены гонки 1 на 1', 'Cómo funcionan las regatas 1 contra 1', 'So funktionieren 1-gegen-1-Regatten', 'Bire bir yarışlar nasıl işler', 'Comment marchent les duels', 'Come funzionano le regate 1 contro 1', 'Como funcionam os duelos')} ›</a>
    </div>
  );
}
