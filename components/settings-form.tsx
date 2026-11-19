'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { cleanName, NAME_MAX } from '@/lib/name';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BOAT_EVENT, readBoat } from '@/lib/boat';
import { findFlag, flagSrc } from '@/lib/flags';
import { IconArrow } from './ui';
import { NoFlag } from './flag';
import { AvRow } from './av-row';
import { SailingOpts } from './sailing-opts';

// The name on the ranking, edited in place. The Supabase client loads only when it's saved, so guests never get it.
export function NameRow({ lang, name: saved }: { lang: Lang; name: string }) {
  const t = tx(lang);
  const router = useRouter();
  const [name, setName] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  useEffect(() => { setName(saved); }, [saved]);
  const dirty = cleanName(name) !== saved;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = cleanName(name);
    if (v === saved) return;
    if (v.length < 2) { setMsg({ err: true, text: t('Two letters at least.', 'Хотя бы две буквы.', 'Mínimo dos letras.', 'Mindestens zwei Buchstaben.') }); return; }
    setBusy(true); setMsg(null);
    const { supabaseBrowser } = await import('@/lib/supabase/client');
    const { error } = await supabaseBrowser().auth.updateUser({ data: { display_name: v } });
    setBusy(false);
    if (error) { setMsg({ err: true, text: t('Couldn’t save it. Try again.', 'Не удалось сохранить. Попробуй ещё раз.', 'No se pudo guardar. Inténtalo de nuevo.', 'Konnte nicht gespeichert werden. Versuch es nochmal.') }); return; }
    setName(v); setMsg({ text: t('Saved. The ranking shows this name now.', 'Сохранено. В рейтинге теперь это имя.', 'Guardado. La clasificación muestra ahora este nombre.', 'Gespeichert. Die Rangliste zeigt jetzt diesen Namen.') });
    router.refresh();
  };
  return (
    <form className="name-row" onSubmit={save}>
      <div className="srow">
        <label className="srow-k" htmlFor="set-name">{t('Name on the ranking', 'Имя в рейтинге', 'Nombre en la clasificación', 'Name in der Rangliste')}</label>
        <div className="name-in">
          <input id="set-name" className="field" type="text" autoComplete="nickname" maxLength={NAME_MAX} placeholder={t('Anna P.', 'Анна П.', 'Anna P.', 'Anna P.')}
            value={name} onChange={(e) => { setName(e.target.value); setMsg(null); }} disabled={busy} />
          {dirty && <button className="mini" type="submit" disabled={busy}><span className="btn-t">{t('Save', 'Сохранить', 'Guardar', 'Speichern')}</span></button>}
        </div>
      </div>
      {msg ? <p className={msg.err ? 'err' : 'hint'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>
        : <p className="hint">{t('Only this name is public. Your email stays private.', 'Всем видно только это имя. Почта остаётся скрытой.', 'Solo este nombre es público. Tu correo sigue siendo privado.', 'Nur dieser Name ist öffentlich. Deine E-Mail bleibt privat.')}</p>}
    </form>
  );
}

// One of the settings' cards over the scene: its name on top, its rows under it
function Card({ id, title, wide = false, children }: { id: string; title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`st-card${wide ? ' st-wide' : ''}`} aria-labelledby={id}>
      <div className="st-card-h"><span className="lbl-ink" id={id}>{title}</span></div>
      <div className="st-card-b">{children}</div>
    </section>
  );
}

// Your boat in the account's card: her flag and sail number as the boat saved on this device has them, and Edit
function BoatLine({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const [b, setB] = useState<{ name: string; flag?: string; land?: string } | null>(null);
  useEffect(() => {
    const load = () => {
      const x = readBoat(), f = findFlag(x.flag);
      setB({ name: `${x.nat} ${x.num || '1'}`.trim(), flag: f?.code, land: f ? t(f.en, f.ru, f.es, f.de) : undefined });
    };
    load();
    addEventListener(BOAT_EVENT, load); // the account's boat, just brought to this device
    return () => removeEventListener(BOAT_EVENT, load);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Link className="st-boat" href="/boat?from=settings" aria-label={t('Edit your yacht', 'Изменить яхту', 'Edita tu yate', 'Deine Yacht bearbeiten')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {b?.flag ? <img className="fl" src={flagSrc(b.flag)} alt={b.land || ''} /> : <NoFlag />}
      <b>{b ? b.name : '\u00a0'}</b>
      <span className="st-boat-k">{t('Colours, flag and number', 'Цвета, флаг и номер', 'Colores, bandera y número', 'Farben, Flagge und Nummer')}</span>
      <span className="st-boat-e">{t('Edit', 'Изменить', 'Editar', 'Bearbeiten')}<IconArrow s={14} /></span>
    </Link>
  );
}

// S3 · Who you are, how you sail, and the way to Audio & graphics, in cards over the scene. Every change is saved at
// once where the game reads it.
export function SettingsForm({ lang, langSeg, account }: { lang: Lang; langSeg: React.ReactNode; account: React.ReactNode }) {
  const t = tx(lang);
  return (
    <div className="st-cards">
      <Card id="st-acct" title={t('Account', 'Аккаунт', 'Cuenta', 'Konto')}>
        {account}
        <div className="st-sub"><span className="lbl-ink">{t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht')}</span></div>
        <BoatLine lang={lang} />
        <div className="st-sub"><span className="lbl-ink" id="l-lang">{t('Language', 'Язык', 'Idioma', 'Sprache')}</span></div>
        {langSeg}
      </Card>
      <Card id="st-sail" title={t('Sailing', 'Яхта', 'Navegando', 'Segeln')}><SailingOpts lang={lang} /></Card>
      <section className="st-card st-wide" aria-label={t('Audio & graphics', 'Звук и графика', 'Sonido y gráficos', 'Ton & Grafik')}><div className="st-card-b"><AvRow lang={lang} wide /></div></section>
    </div>
  );
}
