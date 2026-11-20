'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tx, type Lang } from '@/lib/lang';
import { supabaseBrowser } from '@/lib/supabase/client';
import { sponsorChanged } from '@/app/[lang]/admin/actions';

// The admin's ads that aren't on the sails (those are components/admin-sails.tsx): the plane's banner.
// The words on the banner the light plane tows over the course now and then (public/game/plane.js): the first part in
// navy, then a red dot and the second part in red, in public.regatta_settings 'plane_banner' as { lines: [a, b] }, which
// /sponsor hands the game. Nothing set: the game's own RYCRENTALS.COM · RENT YACHTS HERE!
const BANNER_KEY = 'plane_banner', BANNER_MAX = 40;

export function BannerForm({ lang, current }: { lang: Lang; current: string[] | null }) {
  const t = tx(lang);
  const router = useRouter();
  const [a, setA] = useState(current?.[0] ?? '');
  const [b, setB] = useState(current?.[1] ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const lines = [a.trim(), b.trim()].filter(Boolean);
  const same = lines.join('\n') === (current ?? []).join('\n');

  const write = async (clear: boolean) => {
    setBusy(true); setErr(''); setDone('');
    const sb = supabaseBrowser();
    const row = clear
      ? await sb.from('regatta_settings').delete().eq('key', BANNER_KEY)
      : await sb.from('regatta_settings').upsert({ key: BANNER_KEY, value: { lines }, updated_at: new Date().toISOString() });
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    await sponsorChanged();
    if (clear) { setA(''); setB(''); }
    setDone(clear
      ? t('Removed. The plane tows the RYC banner again from the next race.', 'Убрано. Со следующей гонки самолёт снова тянет баннер RYC.', 'Quitado. La avioneta vuelve a remolcar la pancarta de RYC desde la próxima regata.', 'Entfernt. Das Flugzeug zieht ab der nächsten Regatta wieder das RYC-Banner.', 'Kaldırıldı. Uçak bir sonraki yarıştan itibaren yine RYC pankartını çeker.', 'Retirée. L’avion remorque de nouveau la banderole RYC dès la prochaine régate.', 'Rimosso. L’aereo traina di nuovo lo striscione RYC dalla prossima regata.')
      : t('Saved. The plane tows it from the next race.', 'Сохранено. Со следующей гонки самолёт тянет его.', 'Guardado. La avioneta la remolca desde la próxima regata.', 'Gespeichert. Das Flugzeug zieht es ab der nächsten Regatta.', 'Kaydedildi. Uçak bunu bir sonraki yarıştan itibaren çeker.', 'Enregistrée. L’avion la remorque dès la prochaine régate.', 'Salvato. L’aereo lo traina dalla prossima regata.'));
    setBusy(false); router.refresh();
  };

  return (
    <section className="set-grid adm adm-banner" aria-labelledby="adm-k-ban">
      <div className="set-sec">
        <div className="adm-k"><span className="kicker" id="adm-k-ban">{t('On the plane’s banner', 'На баннере самолёта', 'En la pancarta de la avioneta', 'Auf dem Banner des Flugzeugs', 'Uçağın pankartında', 'Sur la banderole de l’avion', 'Sullo striscione dell’aereo')}</span></div>
        <div className="adm-tow"><div className="adm-ban" aria-label={t('How the banner reads', 'Как читается баннер', 'Cómo se lee la pancarta', 'So liest sich das Banner', 'Pankart nasıl görünür', 'Le texte de la banderole', 'Come si legge lo striscione')}>
          {lines.length ? (
            <>
              <span className="adm-ban-a">{lines[0]}</span>
              {lines[1] && <><span className="adm-ban-dot" aria-hidden="true" /><span className="adm-ban-b">{lines[1]}</span></>}
            </>
          ) : (
            <><span className="adm-ban-a">RYCRENTALS.COM</span><span className="adm-ban-dot" aria-hidden="true" /><span className="adm-ban-b">RENT YACHTS HERE!</span></>
          )}
        </div></div>
        <p className="hint">{t('A light plane tows it low across the course every minute or two, side-on to the camera. Leave both empty for the RYC banner.', 'Лёгкий самолёт проносит его низко над дистанцией каждые минуту-две, боком к камере. Оставьте оба поля пустыми — будет баннер RYC.', 'Una avioneta ligera la remolca a baja altura por el recorrido cada uno o dos minutos, de lado a la cámara. Deja ambas vacías para la pancarta de RYC.', 'Ein Leichtflugzeug zieht es alle ein, zwei Minuten tief über die Bahn, seitlich zur Kamera. Lass beide Felder leer für das RYC-Banner.', 'Hafif bir uçak, pankartı bir iki dakikada bir parkurun üzerinden alçaktan, kameraya yandan çeker. RYC pankartı için ikisini de boş bırak.', 'Un avion léger la remorque à basse altitude au-dessus du parcours toutes les une à deux minutes, de profil face à la caméra. Laisse les deux champs vides pour la banderole RYC.', 'Un aereo leggero lo traina basso sopra il percorso ogni minuto o due, di fianco rispetto alla telecamera. Lascia vuoti entrambi per lo striscione RYC.')}</p>
      </div>
      <div className="set-sec">
        <div className="srow adm-field">
          <label className="srow-k" htmlFor="adm-ban-a">{t('First words (navy)', 'Первые слова (синие)', 'Primeras palabras (azul marino)', 'Erste Wörter (Marine)', 'İlk sözcükler (lacivert)', 'Premiers mots (bleu marine)', 'Prime parole (blu navy)')}</label>
          <span className="adm-in"><input id="adm-ban-a" className="field" type="text" maxLength={BANNER_MAX} value={a} disabled={busy} onChange={(e) => { setA(e.target.value); setDone(''); }} /><span className="adm-n" aria-hidden="true">{a.length}/{BANNER_MAX}</span></span>
        </div>
        <div className="srow adm-field">
          <label className="srow-k" htmlFor="adm-ban-b">{t('Then (red)', 'Затем (красные)', 'Luego (rojo)', 'Dann (rot)', 'Sonra (kırmızı)', 'Puis (rouge)', 'Poi (rosso)')}</label>
          <span className="adm-in"><input id="adm-ban-b" className="field" type="text" maxLength={BANNER_MAX} value={b} disabled={busy} onChange={(e) => { setB(e.target.value); setDone(''); }} /><span className="adm-n" aria-hidden="true">{b.length}/{BANNER_MAX}</span></span>
        </div>
        <div className="btn-row adm-go">
          <button type="button" className="pill pill-primary pill-xs" disabled={!lines.length || same || busy} onClick={() => write(false)}><span className="btn-t">{busy ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…', 'Enregistrement…', 'Salvataggio…') : t('Put it on the banner', 'Поставить на баннер', 'Ponla en la pancarta', 'Auf das Banner setzen', 'Pankarta koy', 'La mettre sur la banderole', 'Mettilo sullo striscione')}</span></button>
          {current && <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={() => write(true)}><span className="btn-t">{t('Back to the RYC banner', 'Вернуть баннер RYC', 'Volver a la pancarta de RYC', 'Zurück zum RYC-Banner', 'RYC pankartına dön', 'Revenir à la banderole RYC', 'Torna allo striscione RYC')}</span></button>}
        </div>
        {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : null}
      </div>
    </section>
  );
}
