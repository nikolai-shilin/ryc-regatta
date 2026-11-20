'use client';
import { useEffect, useRef } from 'react';
import { tx, type Lang } from '@/lib/lang';

// S2 · Today's race is fixed. Today's conditions on the race hub (the numbers under the venue) open this sheet rather
// than quietly turning the race into a free one: it says why they can't change, that a race in other conditions
// doesn't go on today's ranking, and offers the way out, the same race as a free race, prefilled, to change from
// there. Anything marked data-lock on the page opens it.
export function DailyLock({ lang, chips }: { lang: Lang; chips: string[] }) {
  const t = tx(lang);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const el = (e.target as Element | null)?.closest('[data-lock]');
      if (!el) return;
      e.preventDefault();
      dlg.current?.showModal();
    };
    const key = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element | null)?.closest('[data-lock][role="button"]')) open(e); };
    document.addEventListener('click', open);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', open); document.removeEventListener('keydown', key); };
  }, []);
  // a tap on the backdrop closes it too
  const backdrop = (e: React.MouseEvent<HTMLDialogElement>) => { if (e.target === dlg.current) dlg.current?.close(); };
  return (
    <dialog ref={dlg} className="dl" aria-labelledby="dl-h" onClick={backdrop}>
      <div className="dl-in">
        <span className="dl-k">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour')}</span>
        <h2 className="dl-h" id="dl-h">{t('Today’s race is fixed', 'Гонка дня неизменна', 'La regata de hoy es fija', 'Die Regatta des Tages steht fest', 'Günün yarışı sabit', 'La régate du jour est fixée')}</h2>
        <p className="dl-p">{t('Everyone sails today’s race in the same place, wind and course, so the times compare fairly. A race in other conditions doesn’t go on today’s ranking.', 'Сегодня все проходят гонку в одном месте, при одном ветре и на одной дистанции — так время сравнивается честно. Гонка в других условиях в рейтинг дня не идёт.', 'Todos navegan la regata de hoy en el mismo lugar, con el mismo viento y recorrido, para que los tiempos se comparen con justicia. Una regata en otras condiciones no entra en la clasificación de hoy.', 'Alle segeln die Regatta des Tages am selben Ort, bei gleichem Wind und auf gleicher Bahn, damit die Zeiten fair vergleichbar sind. Eine Regatta unter anderen Bedingungen kommt nicht in die Rangliste des Tages.', 'Herkes günün yarışını aynı yerde, aynı rüzgârda ve parkurda yarışır, böylece süreler adil karşılaştırılır. Başka koşullardaki bir yarış günün sıralamasına girmez.', 'Tout le monde court la régate du jour au même endroit, avec le même vent et le même parcours, pour que les temps se comparent équitablement. Une régate dans d’autres conditions n’entre pas au classement du jour.')}</p>
        <ul className="dl-chips" aria-label={t('Today’s conditions', 'Условия сегодня', 'Condiciones de hoy', 'Heutige Bedingungen', 'Günün koşulları', 'Les conditions du jour')}>{chips.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="dl-p dl-s">{t('To change them, make it a custom race: it opens with today’s settings, for you to change.', 'Чтобы их изменить, сделай свою гонку: она откроется с сегодняшними настройками, и их можно поменять.', 'Para cambiarlas, hazla una regata personalizada: se abre con los ajustes de hoy, para que los cambies.', 'Um sie zu ändern, mach daraus eine eigene Regatta: Sie öffnet sich mit den heutigen Einstellungen, damit du sie ändern kannst.', 'Değiştirmek için serbest yarış yap: günün ayarlarıyla açılır, sen değiştirirsin.', 'Pour les changer, fais-en une régate libre : elle s’ouvre avec les réglages du jour, à toi de les modifier.')}</p>
        <div className="dl-btns">
          <button type="button" className="dl-keep" onClick={() => dlg.current?.close()} autoFocus>{t('Keep today’s race', 'Остаться в гонке дня', 'Mantener la regata de hoy', 'Regatta des Tages behalten', 'Günün yarışı kalsın', 'Garder la régate du jour')}</button>
          <a className="dl-free" href="/race/free?from=today">{t('Make it a custom race', 'Сделать своей', 'Hacerla personalizada', 'Eigene Regatta daraus machen', 'Serbest yarış yap', 'En faire une régate libre')}</a>
        </div>
      </div>
    </dialog>
  );
}
