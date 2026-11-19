'use client';
import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { pick as inLang, tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { supabaseBrowser } from '@/lib/supabase/client';
import { sponsorChanged } from '@/app/[lang]/admin/actions';
import { IconArrow, IconImage } from './ui';

// The pictures every boat carries on her sails (public/game/yacht.js): the ad on the jib, as large as the sail takes it
// (a banner printed on a colour dyes the whole jib that colour), the logo on the mainsail above the sail number and the
// one on the gennaker, which no player can set. Each is a picture in the public bucket regatta-ads and its address in
// public.regatta_settings ('jib_ad', 'main_logo', 'kite_logo'), which /sponsor hands the game. Those are for every
// venue; a set of venues can have its own (the row 'sail_sets', { [set id]: { name, venues, jib?, main?, kite?: { url,
// path }, colors? } }, a venue in one set at most), and what its set doesn't set a venue takes from every venue's
// (app/sponsor/route.ts). A set is made once and its venues picked by country, so a look goes on many venues at once.
// Each upload gets a new name, so no cache anywhere keeps the old one; the old file is removed once the new one is set.
const BUCKET = 'regatta-ads', MAX = 2 * 1024 * 1024;
export type Pic = { url: string; path?: string };
export type SailSet = { name: string; venues: string[]; jib?: Pic; main?: Pic; kite?: Pic; colors?: SailColors };
export type SetMap = Record<string, SailSet>;
const SETS_KEY = 'sail_sets', SET_NAME_MAX = 40;
// a set's name after a section's heading, when the page sets that set's own
const atSet = (set: string | null, sets: SetMap) => (set && sets[set] ? ` · ${sets[set].name}` : '');
// the sets written as they are to be: every set the page last read, with `change` made to them; the row dropped when
// none is left
function writeSets(map: SetMap, change: (m: SetMap) => SetMap) {
  const sb = supabaseBrowser(), next = change(structuredClone(map));
  for (const x of Object.values(next)) if (x.colors && !Object.keys(x.colors).length) delete x.colors;
  return Object.keys(next).length
    ? sb.from('regatta_settings').upsert({ key: SETS_KEY, value: next, updated_at: new Date().toISOString() })
    : sb.from('regatta_settings').delete().eq('key', SETS_KEY);
}
const writeSet = (map: SetMap, set: string, change: (x: SailSet) => SailSet) => writeSets(map, (m) => ({ ...m, [set]: change(m[set] ?? { name: '', venues: [] }) }));
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const SLOTS = { jib: { key: 'jib_ad', dir: 'jib' }, main: { key: 'main_logo', dir: 'main' }, kite: { key: 'kite_logo', dir: 'kite' } } as const;

// set: a set's own picture (from `sets`, the row as the page read it), shown over every venue's (`inherited`) until it
// has one; none, every venue's. extra: more of the same sail in its card (its colour, SailColorForm inline)
export function SailAdForm({ lang, slot, current, set = null, sets = {}, inherited = null, extra = null }: { lang: Lang; slot: keyof typeof SLOTS; current: Pic | null; set?: string | null; sets?: SetMap; inherited?: Pic | null; extra?: ReactNode }) {
  const t = tx(lang);
  const { key: KEY, dir } = SLOTS[slot];
  const words = slot === 'main' ? {
    kicker: t('On every mainsail', 'На каждом гроте', 'En cada mayor', 'Auf jedem Großsegel', 'Her ana yelkende'),
    none: t('No logo', 'Без логотипа', 'Sin logo', 'Kein Logo', 'Logo yok'),
    hint: t('A square or wide logo on a transparent background reads best: 1.5 m wide on the sail, above the sail number, on your boat and every computer boat. Players can’t change it.', 'Лучше всего читается квадратный или широкий логотип на прозрачном фоне: 1,5 м в ширину, над номером на парусе, на вашей яхте и на всех соперниках. Игроки не могут его изменить.', 'Un logo cuadrado o ancho sobre fondo transparente se lee mejor: 1,5 m de ancho en la vela, sobre el número de vela, en tu barco y en cada barco del ordenador. Los jugadores no pueden cambiarlo.', 'Ein quadratisches oder breites Logo auf transparentem Hintergrund liest sich am besten: 1,5 m breit auf dem Segel, über der Segelnummer, auf deinem Boot und jedem Computerboot. Spieler können es nicht ändern.', 'Saydam arka planlı kare ya da geniş bir logo en iyi okunur: yelkende 1,5 m genişliğinde, yelken numarasının üstünde, teknende ve her bilgisayar teknesinde. Oyuncular değiştiremez.'),
    saved: t('Saved. Every boat carries it from the next race.', 'Сохранено. Со следующей гонки он на каждой яхте.', 'Guardado. Todos los barcos lo llevan desde la próxima regata.', 'Gespeichert. Jedes Boot trägt es ab der nächsten Regatta.', 'Kaydedildi. Her tekne bunu bir sonraki yarıştan itibaren taşır.'),
    removed: t('Removed. The mainsails carry no logo again.', 'Убрано. На гротах снова нет логотипа.', 'Quitado. Las mayores vuelven a no llevar logo.', 'Entfernt. Die Großsegel tragen wieder kein Logo.', 'Kaldırıldı. Ana yelkenlerde yine logo yok.'),
    put: t('Put it on the mainsails', 'Поставить на гроты', 'Ponlo en las mayores', 'Auf die Großsegel setzen', 'Ana yelkenlere koy'),
    remove: t('Remove the logo', 'Убрать логотип', 'Quitar el logo', 'Das Logo entfernen', 'Logoyu kaldır'),
  } : slot === 'kite' ? {
    kicker: t('On every gennaker', 'На каждом генакере', 'En cada gennaker', 'Auf jedem Gennaker', 'Her balonda'),
    none: t('No logo', 'Без логотипа', 'Sin logo', 'Kein Logo', 'Logo yok'),
    hint: t('A logo or a flag, as large as the gennaker takes it: about three quarters of its width, upright on both sides of the sail, on your boat and every computer boat. Players can’t change it.', 'Логотип или флаг — такой большой, какой помещается на генакер: около трёх четвертей его ширины, ровно с обеих сторон паруса, на вашей яхте и на всех соперниках. Игроки не могут его изменить.', 'Un logo o una bandera, tan grande como lo admite el gennaker: unas tres cuartas partes de su ancho, derecho por ambas caras de la vela, en tu barco y en cada barco del ordenador. Los jugadores no pueden cambiarlo.', 'Ein Logo oder eine Flagge, so groß, wie der Gennaker es zulässt: etwa drei Viertel seiner Breite, aufrecht auf beiden Seiten des Segels, auf deinem Boot und jedem Computerboot. Spieler können es nicht ändern.', 'Bir logo ya da bayrak, balonun aldığı kadar büyük: genişliğinin dörtte üçü kadar, yelkenin iki yüzünde de dik, teknende ve her bilgisayar teknesinde. Oyuncular değiştiremez.'),
    saved: t('Saved. Every boat carries it from the next race.', 'Сохранено. Со следующей гонки он на каждой яхте.', 'Guardado. Todos los barcos lo llevan desde la próxima regata.', 'Gespeichert. Jedes Boot trägt es ab der nächsten Regatta.', 'Kaydedildi. Her tekne bunu bir sonraki yarıştan itibaren taşır.'),
    removed: t('Removed. The gennakers carry no logo again.', 'Убрано. На генакерах снова нет логотипа.', 'Quitado. Los gennakers vuelven a no llevar logo.', 'Entfernt. Die Gennaker tragen wieder kein Logo.', 'Kaldırıldı. Balonlarda yine logo yok.'),
    put: t('Put it on the gennakers', 'Поставить на генакеры', 'Ponlo en los gennakers', 'Auf die Gennaker setzen', 'Balonlara koy'),
    remove: t('Remove the logo', 'Убрать логотип', 'Quitar el logo', 'Das Logo entfernen', 'Logoyu kaldır'),
  } : {
    kicker: t('On every jib', 'На каждом стакселе', 'En cada foque', 'Auf jeder Fock', 'Her flokta'),
    none: t('No ad', 'Без рекламы', 'Sin anuncio', 'Keine Werbung', 'Reklam yok'),
    hint: t('As large as the jib takes it, turned to read down along the luff when that comes out larger. A banner printed on a colour of its own (white words on red, say) dyes the whole jib that colour, so the ad takes the full sail; a logo on a transparent background goes on the boat’s own cloth. On your boat and every computer boat.', 'Так крупно, как позволяет стаксель, — повёрнуто вдоль передней шкаторины, если так выходит крупнее. Баннер на своём цвете (например, белые слова на красном) окрашивает в этот цвет весь стаксель — реклама на весь парус; логотип на прозрачном фоне ложится на собственную ткань яхты. На вашей яхте и на всех соперниках.', 'Tan grande como lo admite el foque, girado para leerse a lo largo del grátil si así sale mayor. Un anuncio impreso sobre un color propio (palabras blancas sobre rojo, por ejemplo) tiñe todo el foque de ese color, así ocupa la vela entera; un logo sobre fondo transparente va sobre la tela del barco. En tu barco y en cada barco del ordenador.', 'So groß, wie die Fock es zulässt, gedreht, um am Vorliek entlang zu lesen, wenn es so größer wird. Ein Banner auf eigener Farbe (etwa weiße Schrift auf Rot) färbt die ganze Fock in dieser Farbe, so nimmt die Werbung das ganze Segel ein; ein Logo auf transparentem Hintergrund kommt auf das eigene Tuch des Bootes. Auf deinem Boot und jedem Computerboot.', 'Flokun aldığı kadar büyük; böyle daha büyük oluyorsa orsa yakası boyunca okunacak şekilde döndürülür. Kendi renginde basılmış bir pankart (örneğin kırmızı üstüne beyaz yazı) tüm floku o renge boyar, reklam bütün yelkeni kaplar; saydam arka planlı bir logo teknenin kendi kumaşına gelir. Teknende ve her bilgisayar teknesinde.'),
    saved: t('Saved. Every boat carries it from the next race.', 'Сохранено. Со следующей гонки она на каждой яхте.', 'Guardado. Todos los barcos lo llevan desde la próxima regata.', 'Gespeichert. Jedes Boot trägt sie ab der nächsten Regatta.', 'Kaydedildi. Her tekne bunu bir sonraki yarıştan itibaren taşır.'),
    removed: t('Removed. The jibs are plain again.', 'Убрано. Стаксели снова чистые.', 'Quitado. Los foques vuelven a estar lisos.', 'Entfernt. Die Focks sind wieder schlicht.', 'Kaldırıldı. Floklar yine sade.'),
    put: t('Put it on the jibs', 'Поставить на стаксели', 'Ponlo en los foques', 'Auf die Focks setzen', 'Floklara koy'),
    remove: t('Remove the ad', 'Убрать рекламу', 'Quitar el anuncio', 'Werbung entfernen', 'Reklamı kaldır'),
  };
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const shown = preview || current?.url || inherited?.url || null, borrowed = !preview && !current && !!inherited;

  const pick = (f: File | undefined) => {
    setErr(''); setDone('');
    if (!f) return;
    if (!TYPES[f.type]) return setErr(t('A PNG, JPEG, WebP or SVG picture, please.', 'Нужна картинка PNG, JPEG, WebP или SVG.', 'Una imagen PNG, JPEG, WebP o SVG, por favor.', 'Bitte ein PNG-, JPEG-, WebP- oder SVG-Bild.', 'Lütfen PNG, JPEG, WebP veya SVG bir resim seç.'));
    if (f.size > MAX) return setErr(t('Up to 2 MB, please.', 'Не больше 2 МБ.', 'Hasta 2 MB, por favor.', 'Bitte höchstens 2 MB.', 'En fazla 2 MB olsun.'));
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const finish = async (msg: string) => {
    await sponsorChanged();
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setDone(msg); router.refresh();
  };
  const save = async () => {
    if (!file) return;
    setBusy(true); setErr(''); setDone('');
    const sb = supabaseBrowser();
    const path = `${dir}/${set ? `${set}-` : ''}${Date.now()}.${TYPES[file.type]}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (up.error) { setBusy(false); return setErr(up.error.message); }
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const row = set
      ? await writeSet(sets, set, (v) => ({ ...v, [slot]: { url, path } }))
      : await sb.from('regatta_settings').upsert({ key: KEY, value: { url, path }, updated_at: new Date().toISOString() });
    if (row.error) { await sb.storage.from(BUCKET).remove([path]); setBusy(false); return setErr(row.error.message); }
    if (current?.path) await sb.storage.from(BUCKET).remove([current.path]);
    await finish(words.saved);
    setBusy(false);
  };
  const clear = async () => {
    setBusy(true); setErr(''); setDone('');
    const sb = supabaseBrowser();
    const row = set
      ? await writeSet(sets, set, (v) => { delete v[slot]; return v; })
      : await sb.from('regatta_settings').delete().eq('key', KEY);
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    if (current?.path) await sb.storage.from(BUCKET).remove([current.path]);
    await finish(set ? t('Removed. Boats at this set’s venues carry every venue’s again.', 'Убрано. Яхты в местах этого набора снова несут то, что для всех мест.', 'Quitado. Los barcos en las sedes de este conjunto vuelven a llevar el de todas las sedes.', 'Entfernt. Die Boote in den Revieren dieses Sets tragen wieder das für alle Reviere.', 'Kaldırıldı. Bu setin mekânlarındaki tekneler yine tüm mekânlarınkini taşır.') : words.removed);
    setBusy(false);
  };

  return (
    <section className={`set-grid adm adm-${slot}`} aria-labelledby={`adm-k-${slot}`}>
      <div className="set-sec">
        <div className="adm-k"><span className="kicker" id={`adm-k-${slot}`}>{words.kicker}{atSet(set, sets)}</span></div>
        <div className="adm-prev" aria-label={t('How it reads on white and on black sails', 'Как это смотрится на белых и чёрных парусах', 'Cómo se lee en velas blancas y negras', 'So wirkt es auf weißen und schwarzen Segeln', 'Beyaz ve siyah yelkende nasıl görünür')}>
          {['#f4f2ea', '#2a2c30'].map((c) => (
            <div key={c} className="adm-sail" style={{ background: c }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shown ? <img src={shown} alt="" /> : <span className="hint">{words.none}</span>}
            </div>
          ))}
        </div>
        {borrowed && <p className="hint adm-from">{t('Every venue’s, until this set has its own.', 'Общая для всех мест, пока у этого набора нет своей.', 'La de todas las sedes, hasta que este conjunto tenga la suya.', 'Die für alle Reviere, bis dieses Set ein eigenes hat.', 'Bu setin kendisi olana dek tüm mekânlarınki.')}</p>}
        <p className="hint">{words.hint}</p>
      </div>
      <div className="set-sec">
        <span className="srow-k adm-pic-k">{t('Picture', 'Картинка', 'Imagen', 'Bild', 'Resim')}</span>
        <div className="btn-row adm-go adm-pic">
          <input id={`adm-file-${slot}`} className="vh" type="file" accept={Object.keys(TYPES).join(',')} disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          <label className="adm-pick" htmlFor={`adm-file-${slot}`}><IconImage /><span>{file ? file.name : t('Choose a picture', 'Выбрать картинку', 'Elige una imagen', 'Bild wählen', 'Resim seç')}</span></label>
          <button type="button" className="pill pill-primary pill-xs" disabled={!file || busy} onClick={save}><span className="btn-t">{busy && file ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…') : words.put}</span></button>
          {current && <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={clear}><span className="btn-t">{words.remove}</span></button>}
        </div>
        {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : null}
        {extra}
        <div className="srow">
          <span className="srow-k">{t('See it on the water', 'Посмотреть на воде', 'Verlo en el agua', 'Auf dem Wasser ansehen', 'Suyun üstünde gör')}</span>
          {set
            ? sets[set]?.venues[0] && <a className="srow-link" href={`/venues/${sets[set].venues[0]}`}>{inLang(VENUES.find((v) => v.id === sets[set].venues[0])!.name, lang)}<IconArrow s={14} /></a>
            : <a className="srow-link" href="/boat">{t('Your yacht', 'Ваша яхта', 'Tu yate', 'Deine Yacht', 'Yatın')}<IconArrow s={14} /></a>}
        </div>
      </div>
    </section>
  );
}

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
      ? t('Removed. The plane tows the RYC banner again from the next race.', 'Убрано. Со следующей гонки самолёт снова тянет баннер RYC.', 'Quitado. La avioneta vuelve a remolcar la pancarta de RYC desde la próxima regata.', 'Entfernt. Das Flugzeug zieht ab der nächsten Regatta wieder das RYC-Banner.', 'Kaldırıldı. Uçak bir sonraki yarıştan itibaren yine RYC pankartını çeker.')
      : t('Saved. The plane tows it from the next race.', 'Сохранено. Со следующей гонки самолёт тянет его.', 'Guardado. La avioneta la remolca desde la próxima regata.', 'Gespeichert. Das Flugzeug zieht es ab der nächsten Regatta.', 'Kaydedildi. Uçak bunu bir sonraki yarıştan itibaren çeker.'));
    setBusy(false); router.refresh();
  };

  return (
    <section className="set-grid adm adm-banner" aria-labelledby="adm-k-ban">
      <div className="set-sec">
        <div className="adm-k"><span className="kicker" id="adm-k-ban">{t('On the plane’s banner', 'На баннере самолёта', 'En la pancarta de la avioneta', 'Auf dem Banner des Flugzeugs', 'Uçağın pankartında')}</span></div>
        <div className="adm-tow"><div className="adm-ban" aria-label={t('How the banner reads', 'Как читается баннер', 'Cómo se lee la pancarta', 'So liest sich das Banner', 'Pankart nasıl görünür')}>
          {lines.length ? (
            <>
              <span className="adm-ban-a">{lines[0]}</span>
              {lines[1] && <><span className="adm-ban-dot" aria-hidden="true" /><span className="adm-ban-b">{lines[1]}</span></>}
            </>
          ) : (
            <><span className="adm-ban-a">RYCRENTALS.COM</span><span className="adm-ban-dot" aria-hidden="true" /><span className="adm-ban-b">RENT YACHTS HERE!</span></>
          )}
        </div></div>
        <p className="hint">{t('A light plane tows it low across the course every minute or two, side-on to the camera. Leave both empty for the RYC banner.', 'Лёгкий самолёт проносит его низко над дистанцией каждые минуту-две, боком к камере. Оставьте оба поля пустыми — будет баннер RYC.', 'Una avioneta ligera la remolca a baja altura por el recorrido cada uno o dos minutos, de lado a la cámara. Deja ambas vacías para la pancarta de RYC.', 'Ein Leichtflugzeug zieht es alle ein, zwei Minuten tief über die Bahn, seitlich zur Kamera. Lass beide Felder leer für das RYC-Banner.', 'Hafif bir uçak, pankartı bir iki dakikada bir parkurun üzerinden alçaktan, kameraya yandan çeker. RYC pankartı için ikisini de boş bırak.')}</p>
      </div>
      <div className="set-sec">
        <div className="srow adm-field">
          <label className="srow-k" htmlFor="adm-ban-a">{t('First words (navy)', 'Первые слова (синие)', 'Primeras palabras (azul marino)', 'Erste Wörter (Marine)', 'İlk sözcükler (lacivert)')}</label>
          <span className="adm-in"><input id="adm-ban-a" className="field" type="text" maxLength={BANNER_MAX} value={a} disabled={busy} onChange={(e) => { setA(e.target.value); setDone(''); }} /><span className="adm-n" aria-hidden="true">{a.length}/{BANNER_MAX}</span></span>
        </div>
        <div className="srow adm-field">
          <label className="srow-k" htmlFor="adm-ban-b">{t('Then (red)', 'Затем (красные)', 'Luego (rojo)', 'Dann (rot)', 'Sonra (kırmızı)')}</label>
          <span className="adm-in"><input id="adm-ban-b" className="field" type="text" maxLength={BANNER_MAX} value={b} disabled={busy} onChange={(e) => { setB(e.target.value); setDone(''); }} /><span className="adm-n" aria-hidden="true">{b.length}/{BANNER_MAX}</span></span>
        </div>
        <div className="btn-row adm-go">
          <button type="button" className="pill pill-primary pill-xs" disabled={!lines.length || same || busy} onClick={() => write(false)}><span className="btn-t">{busy ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…') : t('Put it on the banner', 'Поставить на баннер', 'Ponla en la pancarta', 'Auf das Banner setzen', 'Pankarta koy')}</span></button>
          {current && <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={() => write(true)}><span className="btn-t">{t('Back to the RYC banner', 'Вернуть баннер RYC', 'Volver a la pancarta de RYC', 'Zurück zum RYC-Banner', 'RYC pankartına dön')}</span></button>}
        </div>
        {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : null}
      </div>
    </section>
  );
}

// The colours every boat's jib and gennaker is dyed in the game (public/game/yacht.js), over what each player picked:
// public.regatta_settings 'sail_colors' as { jib?: 'own' | '#rrggbb', kite?: '#rrggbb' }, which /sponsor hands the
// game. Unset, the jib follows its ad (a banner printed on red dyes it red, a logo on a clear ground leaves each boat's
// own cloth) and the gennaker keeps each boat's own colour. A gennaker is one colour all over (a list saved when it
// could be striped reads as its first). Each form writes its own part of the row and keeps
// the other's as the page last read it.
// A set's own (in 'sail_sets', its colors) can also be 'as every venue' (not set), and set back to following the ad
// (jib 'auto') or each boat's own (kite 'own') where every venue's says otherwise.
const COLORS_KEY = 'sail_colors', HEX = /^#[0-9a-f]{6}$/i;
export type SailColors = { jib?: string; kite?: string };
type Dye = 'inherit' | 'auto' | 'own' | 'one';

// inline: in the sail's own card (SailAdForm's extra), its choice, colour and save on a few rows, without a card of its own
export function SailColorForm({ lang, slot, current, set = null, sets = {}, inline = false }: { lang: Lang; slot: 'jib' | 'kite'; current: SailColors | null; set?: string | null; sets?: SetMap; inline?: boolean }) {
  const t = tx(lang);
  const router = useRouter();
  const venue = set, cur = set ? sets[set]?.colors : current, was = slot === 'jib' ? cur?.jib : cur?.kite;
  const saved = typeof was === 'string' && HEX.test(was) ? was : null;
  const savedMode: Dye = was === undefined ? (venue ? 'inherit' : slot === 'jib' ? 'auto' : 'own') : was === 'auto' || was === 'own' ? was : 'one';
  const [mode, setMode] = useState<Dye>(savedMode);
  const [col, setColor] = useState(saved ?? '#ae0000');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const value = mode === 'one' ? col : mode === 'inherit' ? undefined
    : slot === 'jib' ? (mode === 'own' ? 'own' : venue ? 'auto' : undefined) : venue ? 'own' : undefined;
  const same = JSON.stringify(value ?? null) === JSON.stringify(was ?? null);
  const pick = (m: Dye) => { setMode(m); setDone(''); setErr(''); };
  const setCol = (c: string) => { setColor(c); setDone(''); };

  const save = async () => {
    setBusy(true); setErr(''); setDone('');
    const next: SailColors = { ...(cur ?? {}) };
    if (value === undefined) delete next[slot];
    else next[slot] = value;
    const sb = supabaseBrowser();
    const row = set
      ? await writeSet(sets, set, (v) => ({ ...v, colors: next }))
      : Object.keys(next).length
        ? await sb.from('regatta_settings').upsert({ key: COLORS_KEY, value: next, updated_at: new Date().toISOString() })
        : await sb.from('regatta_settings').delete().eq('key', COLORS_KEY);
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    await sponsorChanged();
    setDone(t('Saved. Every boat carries it from the next race.', 'Сохранено. Со следующей гонки так на каждой яхте.', 'Guardado. Todos los barcos lo llevan desde la próxima regata.', 'Gespeichert. Jedes Boot trägt es ab der nächsten Regatta.', 'Kaydedildi. Her tekne bunu bir sonraki yarıştan itibaren taşır.'));
    setBusy(false); router.refresh();
  };

  const asAll: [Dye, string][] = venue ? [['inherit', t('As every venue', 'Как для всех мест', 'Como en todas las sedes', 'Wie in allen Revieren', 'Tüm mekânlardaki gibi')]] : [];
  const modes: [Dye, string][] = slot === 'jib'
    ? [...asAll, ['auto', t('Follow the ad', 'По рекламе', 'Según el anuncio', 'Nach der Werbung', 'Reklama göre')], ['own', t('Each boat’s own', 'Свой у каждой', 'El de cada barco', 'Jedes Boot sein eigenes', 'Her teknenin kendi')], ['one', t('One colour for all', 'Один цвет для всех', 'Un color para todos', 'Eine Farbe für alle', 'Herkese tek renk')]]
    : [...asAll, ['own', t('Each boat’s own', 'Свой у каждой', 'El de cada barco', 'Jedes Boot sein eigenes', 'Her teknenin kendi')], ['one', t('One colour for all', 'Один цвет для всех', 'Un color para todos', 'Eine Farbe für alle', 'Herkese tek renk')]];
  const hint = mode === 'inherit' ? t('Boats at this set’s venues take what is set for every venue.', 'Яхты в местах этого набора берут то, что задано для всех мест.', 'Los barcos en las sedes de este conjunto toman lo que está puesto para todas las sedes.', 'Die Boote in den Revieren dieses Sets nehmen, was für alle Reviere gilt.', 'Bu setin mekânlarındaki tekneler tüm mekânlar için ayarlananı alır.')
    : slot === 'jib'
    ? mode === 'auto' ? t('A banner printed on a colour of its own dyes the whole jib that colour; a logo on a transparent background leaves each boat’s own cloth.', 'Баннер на своём цвете окрашивает в него весь стаксель; логотип на прозрачном фоне оставляет каждой яхте её собственную ткань.', 'Un anuncio impreso sobre un color propio tiñe todo el foque de ese color; un logo sobre fondo transparente deja la tela de cada barco.', 'Ein Banner auf eigener Farbe färbt die ganze Fock in dieser Farbe; ein Logo auf transparentem Hintergrund lässt jedem Boot sein eigenes Tuch.', 'Kendi renginde basılmış bir pankart tüm floku o renge boyar; saydam arka planlı bir logo her teknenin kendi kumaşını bırakır.')
      : mode === 'own' ? t('Every jib keeps the cloth its player picked, under the ad.', 'Каждый стаксель остаётся той ткани, что выбрал игрок, под рекламой.', 'Cada foque conserva la tela que eligió su jugador, bajo el anuncio.', 'Jede Fock behält das Tuch, das ihr Spieler gewählt hat, unter der Werbung.', 'Her flok, oyuncusunun seçtiği kumaşı reklamın altında korur.')
      : t('Every jib in the fleet dyed this colour, with or without an ad, whatever its player picked.', 'Каждый стаксель во флоте этого цвета, с рекламой или без, что бы ни выбрал игрок.', 'Todos los foques de la flota teñidos de este color, con anuncio o sin él, elija lo que elija su jugador.', 'Jede Fock der Flotte in dieser Farbe, mit oder ohne Werbung, egal, was ihr Spieler gewählt hat.', 'Filodaki her flok, reklamlı ya da reklamsız, oyuncusu ne seçerse seçsin bu renkte.')
    : mode === 'own' ? t('Every gennaker keeps the colour its player picked.', 'Каждый генакер остаётся того цвета, что выбрал игрок.', 'Cada gennaker conserva el color que eligió su jugador.', 'Jeder Gennaker behält die Farbe, die sein Spieler gewählt hat.', 'Her balon, oyuncusunun seçtiği rengi korur.')
      : t('Every gennaker in the fleet this colour all over, under its logo, whatever its player picked.', 'Каждый генакер во флоте целиком этого цвета, под логотипом, что бы ни выбрал игрок.', 'Todos los gennakers de la flota enteros de este color, bajo su logo, elija lo que elija su jugador.', 'Jeder Gennaker der Flotte ganz in dieser Farbe, unter seinem Logo, egal, was sein Spieler gewählt hat.', 'Filodaki her balon, oyuncusu ne seçerse seçsin, logosunun altında baştan sona bu renkte.');
  const swatch = mode === 'one' ? col : undefined;
  const id = `adm-dye-${slot}`;

  const controls = (
    <>
      <div className="bt-pills adm-modes" role="radiogroup" aria-labelledby={`${id}-k`}>
        {modes.map(([m, l]) => <button key={m} type="button" role="radio" aria-checked={mode === m} className="bt-pill" disabled={busy} onClick={() => pick(m)}>{l}</button>)}
      </div>
      <div className="btn-row adm-go adm-dye-go">
        {mode === 'one' && <span className="adm-color"><input id={`${id}-c`} type="color" aria-label={t('Colour', 'Цвет', 'Color', 'Farbe', 'Renk')} value={col} disabled={busy} onChange={(e) => setCol(e.target.value)} /><span className="adm-v">{col.toUpperCase()}</span></span>}
        <button type="button" className="pill pill-primary pill-xs" disabled={same || busy} onClick={save}><span className="btn-t">{busy ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…') : t('Save the colour', 'Сохранить цвет', 'Guardar el color', 'Farbe speichern', 'Rengi kaydet')}</span></button>
      </div>
      {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : <p className="hint">{hint}</p>}
    </>
  );
  if (inline) return (
    <div className={`adm-dye-in adm-dye-${slot}`} role="group" aria-labelledby={`${id}-k`}>
      <span className="srow-k" id={`${id}-k`}>{slot === 'jib' ? t('Colour of the jibs', 'Цвет стакселей', 'Color de los foques', 'Farbe der Focks', 'Flokların rengi') : t('Colour of the gennakers', 'Цвет генакеров', 'Color de los gennakers', 'Farbe der Gennaker', 'Balonların rengi')}</span>
      {controls}
    </div>
  );
  return (
    <section className={`set-grid adm adm-dye adm-dye-${slot}`} aria-labelledby={`${id}-k`}>
      <div className="set-sec">
        <div className="adm-k"><span className="kicker" id={`${id}-k`}>{slot === 'jib' ? t('Every jib’s colour', 'Цвет каждого стакселя', 'El color de cada foque', 'Die Farbe jeder Fock', 'Her flokun rengi') : t('Every gennaker’s colour', 'Цвет каждого генакера', 'El color de cada gennaker', 'Die Farbe jedes Gennakers', 'Her balonun rengi')}{atSet(set, sets)}</span></div>
        <div className="adm-prev adm-prev-1">
          <div className={`adm-sail adm-sail-${slot}`} style={swatch ? { background: swatch } : undefined}>
            {!swatch && <span className="hint">{mode === 'inherit' ? t('As every venue', 'Как для всех мест', 'Como en todas las sedes', 'Wie in allen Revieren', 'Tüm mekânlardaki gibi') : mode === 'auto' ? t('From the ad', 'По рекламе', 'Según el anuncio', 'Nach der Werbung', 'Reklamdan') : t('The boat’s own', 'Свой у яхты', 'El del barco', 'Das eigene des Bootes', 'Teknenin kendi')}</span>}
          </div>
        </div>
      </div>
      <div className="set-sec">{controls}</div>
    </section>
  );
}

// Whose sails the page sets: every venue's, or a set's (?set= in the address), and a new set, made at once and opened.
export function SetPicker({ lang, set, sets }: { lang: Lang; set: string | null; sets: SetMap }) {
  const t = tx(lang);
  const router = useRouter(), path = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = (k: number) => t(`${k} venue${k === 1 ? '' : 's'}`, `мест: ${k}`, `${k} sede${k === 1 ? '' : 's'}`, `${k} ${k === 1 ? 'Revier' : 'Reviere'}`, `${k} mekân`);
  const make = async () => {
    setBusy(true); setErr('');
    const id = `s${Date.now().toString(36)}`;
    const row = await writeSet(sets, id, () => ({ name: t('New set', 'Новый набор', 'Conjunto nuevo', 'Neues Set', 'Yeni set'), venues: [] }));
    setBusy(false);
    if (row.error) return setErr(row.error.message);
    await sponsorChanged();
    router.push(`${path}?set=${id}`);
  };
  return (
    <section className="adm adm-where" aria-labelledby="adm-k-where">
      <div className="adm-where-row">
        <span className="kicker" id="adm-k-where">{t('Sails for', 'Паруса для', 'Velas para', 'Segel für', 'Yelkenler')}</span>
        <select id="adm-set" className="field" aria-labelledby="adm-k-where" value={set ?? ''} onChange={(e) => router.push(e.target.value ? `${path}?set=${e.target.value}` : path)}>
          <option value="">{t('Every venue', 'Всех мест', 'Todas las sedes', 'Alle Reviere', 'Tüm mekânlar')}</option>
          {Object.entries(sets).map(([id, x]) => <option key={id} value={id}>{`${x.name} · ${n(x.venues.length)}`}</option>)}
        </select>
        <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={make}><span className="btn-t">{t('New set', 'Новый набор', 'Conjunto nuevo', 'Neues Set', 'Yeni set')}</span></button>
      </div>
      <p className="hint">{t('A set gives the venues in it their own sails; anything it leaves unset, and every other venue, takes every venue’s. The plane’s banner is the same everywhere.', 'Набор даёт своим местам собственные паруса; всё, что он не задаёт, и все остальные места берут общие. Баннер самолёта везде один.', 'Un conjunto da a sus sedes velas propias; lo que no fija, y todas las demás sedes, toman las de todas las sedes. La pancarta de la avioneta es la misma en todas partes.', 'Ein Set gibt seinen Revieren eigene Segel; was es nicht festlegt, und jedes andere Revier, nimmt die für alle Reviere. Das Banner des Flugzeugs ist überall dasselbe.', 'Bir set, içindeki mekânlara kendi yelkenlerini verir; ayarlamadığı her şey ve diğer tüm mekânlar, tüm mekânlarınkini alır. Uçağın pankartı her yerde aynıdır.')}</p>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}

// A set's name and its venues, picked by the venue or a country's at once. A venue already in another set is named with
// it, and moves here when it's picked. Deleting the set takes its pictures out of the bucket and leaves its venues to
// every venue's sails.
export function SetEditor({ lang, set, sets }: { lang: Lang; set: string; sets: SetMap }) {
  const t = tx(lang);
  const router = useRouter(), path = usePathname();
  const me = sets[set];
  const [name, setName] = useState(me?.name ?? '');
  const [picked, setPicked] = useState<string[]>(me?.venues ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  if (!me) return null;
  const owner = (v: string) => Object.entries(sets).find(([id, x]) => id !== set && x.venues.includes(v))?.[1];
  const countries = [...new Set(VENUES.map((v) => v.nation))].map((nation) => {
    const vs = VENUES.filter((v) => v.nation === nation), where = inLang(vs[0].place, lang);
    return { nation, vs, label: where.includes(',') ? where.slice(where.lastIndexOf(',') + 1).trim() : where };
  });
  const has = (v: string) => picked.includes(v);
  const toggle = (ids: string[], on: boolean) => { setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((v) => !ids.includes(v)))); setDone(''); };
  const clean = name.trim().slice(0, SET_NAME_MAX);
  const same = clean === me.name && [...picked].sort().join() === [...me.venues].sort().join();
  const save = async () => {
    setBusy(true); setErr(''); setDone('');
    const order: string[] = VENUES.map((v) => v.id).filter(has);
    const row = await writeSets(sets, (m) => {
      for (const [id, x] of Object.entries(m)) if (id !== set) x.venues = x.venues.filter((v) => !order.includes(v)); // moved here
      m[set] = { ...m[set], name: clean, venues: order };
      return m;
    });
    setBusy(false);
    if (row.error) return setErr(row.error.message);
    await sponsorChanged();
    setDone(t('Saved. Races at these venues carry the set from the next race.', 'Сохранено. Со следующей гонки в этих местах паруса из набора.', 'Guardado. Las regatas en estas sedes llevan el conjunto desde la próxima.', 'Gespeichert. Regatten in diesen Revieren tragen das Set ab der nächsten.', 'Kaydedildi. Bu mekânlardaki yarışlar bir sonraki yarıştan itibaren seti taşır.'));
    router.refresh();
  };
  const remove = async () => {
    setBusy(true); setErr(''); setDone('');
    const row = await writeSets(sets, (m) => { delete m[set]; return m; });
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    const files = [me.jib, me.main, me.kite].map((x) => x?.path).filter((x): x is string => !!x);
    if (files.length) await supabaseBrowser().storage.from(BUCKET).remove(files);
    await sponsorChanged();
    setBusy(false);
    router.push(path);
  };
  return (
    <section className="set-grid adm adm-set" aria-labelledby="adm-k-set">
      <div className="set-sec">
        <div className="adm-k"><span className="kicker" id="adm-k-set">{t('The set', 'Набор', 'El conjunto', 'Das Set', 'Set')}{atSet(set, sets)}</span></div>
        <div className="srow adm-field">
          <label className="srow-k" htmlFor="adm-set-name">{t('Name', 'Название', 'Nombre', 'Name', 'Ad')}</label>
          <span className="adm-in"><input id="adm-set-name" className="field" type="text" maxLength={SET_NAME_MAX} value={name} disabled={busy} onChange={(e) => { setName(e.target.value); setDone(''); }} /></span>
        </div>
        <p className="hint">{t(`${picked.length} venue${picked.length === 1 ? '' : 's'} picked. Pick a country’s name for all of its venues.`, `Выбрано мест: ${picked.length}. Нажмите на страну, чтобы выбрать все её места.`, `${picked.length} sede${picked.length === 1 ? '' : 's'} elegida${picked.length === 1 ? '' : 's'}. Elige el nombre de un país para todas sus sedes.`, `${picked.length} ${picked.length === 1 ? 'Revier' : 'Reviere'} gewählt. Wähle den Namen eines Landes für all seine Reviere.`, `${picked.length} mekân seçildi. Bir ülkenin tüm mekânları için adını seç.`)}</p>
        <div className="btn-row adm-go">
          <button type="button" className="pill pill-primary pill-xs" disabled={same || !clean || busy} onClick={save}><span className="btn-t">{busy ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…') : t('Save the set', 'Сохранить набор', 'Guardar el conjunto', 'Set speichern', 'Seti kaydet')}</span></button>
          <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={remove}><span className="btn-t">{t('Delete the set', 'Удалить набор', 'Borrar el conjunto', 'Set löschen', 'Seti sil')}</span></button>
        </div>
        {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : null}
      </div>
      <div className="set-sec adm-venues">
        {countries.map(({ nation, vs, label }) => {
          const all = vs.every((v) => has(v.id)), some = vs.some((v) => has(v.id));
          return (
            <div className="adm-country" key={nation}>
              <button type="button" role="checkbox" aria-checked={all ? 'true' : some ? 'mixed' : 'false'} className="bt-pill adm-country-k" disabled={busy} onClick={() => toggle(vs.map((v) => v.id), !all)}>{label}</button>
              <div className="bt-pills">
                {vs.map((v) => {
                  const other = owner(v.id);
                  return <button key={v.id} type="button" role="checkbox" aria-checked={has(v.id)} className="bt-pill" disabled={busy} title={other && !has(v.id) ? t(`In “${other.name}”: picking it moves it here`, `В «${other.name}»: если выбрать, перейдёт сюда`, `En «${other.name}»: elegirla la trae aquí`, `In „${other.name}“: Wählen holt es hierher`, `“${other.name}” içinde: seçersen buraya taşınır`) : undefined} onClick={() => toggle([v.id], !has(v.id))}>{inLang(v.name, lang)}{other && !has(v.id) ? <span className="adm-in-set"> · {other.name}</span> : null}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
