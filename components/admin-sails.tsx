'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pick as inLang, tx, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { supabaseBrowser } from '@/lib/supabase/client';
import { sponsorChanged } from '@/app/[lang]/admin/actions';
import { IconImage } from './ui';

// The sails every boat carries in the game (public/game/yacht.js), as presets: every venue's, and sets of venues with
// their own. A preset is the logo on the mainsail, the ad on the jib, the logo on the gennaker, and the colours the
// jibs and gennakers are dyed. Every venue's are the rows 'main_logo', 'jib_ad', 'kite_logo' (each { url, path }) and
// 'sail_colors' ({ jib?: 'own' | '#rrggbb', kite?: '#rrggbb' }) in public.regatta_settings; the sets are the row
// 'sail_sets', { [id]: { name, venues, main?, jib?, kite?, colors? } }, a venue in one set at most, and what a set
// doesn't set its venues take from every venue's (app/sponsor/route.ts, which hands the game the sails of its venue).
// The page is a table of the presets; one is made or changed in a dialog and saved at once. A picture is uploaded to
// the public bucket regatta-ads under a name of its own, so no cache keeps the old one, and the old file is removed once
// the new one is saved.
const BUCKET = 'regatta-ads', MAX = 2 * 1024 * 1024, SETS_KEY = 'sail_sets', COLORS_KEY = 'sail_colors', NAME_MAX = 40;
const HEX = /^#[0-9a-f]{6}$/i;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const SLOTS = { main: { key: 'main_logo', dir: 'main' }, jib: { key: 'jib_ad', dir: 'jib' }, kite: { key: 'kite_logo', dir: 'kite' } } as const;
type Slot = keyof typeof SLOTS;
export type Pic = { url: string; path?: string };
// a set's colours can also be 'auto', its jibs following their ad where every venue's dye them, and 'own', its
// gennakers each boat's own where every venue's are one colour
export type SailColors = { jib?: string; kite?: string };
export type SailSet = { name: string; venues: string[]; main?: Pic; jib?: Pic; kite?: Pic; colors?: SailColors };
export type SetMap = Record<string, SailSet>;
export type EveryVenue = { main: Pic | null; jib: Pic | null; kite: Pic | null; colors: SailColors | null };
type Dye = 'inherit' | 'auto' | 'own' | 'one';
const EVERY = '*', NEW = '+'; // the dialog's preset: every venue's, a new set, or a set's id

// the sets written as they are to be, the others as the page last read them; the row dropped when none is left
function writeSets(map: SetMap, change: (m: SetMap) => SetMap) {
  const sb = supabaseBrowser(), next = change(structuredClone(map));
  for (const x of Object.values(next)) if (x.colors && !Object.keys(x.colors).length) delete x.colors;
  return Object.keys(next).length
    ? sb.from('regatta_settings').upsert({ key: SETS_KEY, value: next, updated_at: new Date().toISOString() })
    : sb.from('regatta_settings').delete().eq('key', SETS_KEY);
}

export function SailPresets({ lang, every, sets }: { lang: Lang; every: EveryVenue; sets: SetMap }) {
  const t = tx(lang);
  const [open, setOpen] = useState<string | null>(null);
  const names = (ids: string[]) => ids.map((id) => inLang(VENUES.find((v) => v.id === id)!.name, lang));
  const taken = new Set(Object.values(sets).flatMap((x) => x.venues)), rest = VENUES.length - taken.size;
  const rows: { id: string; name: string; venues: string; own: Partial<Record<Slot, Pic>>; colors: SailColors | null }[] = [
    { id: EVERY, name: t('Every venue', 'Все места', 'Todas las sedes', 'Alle Reviere', 'Tüm mekânlar'), venues: t(`The other ${rest}`, `Остальные ${rest}`, `Las otras ${rest}`, `Die übrigen ${rest}`, `Diğer ${rest}`),
      own: { main: every.main ?? undefined, jib: every.jib ?? undefined, kite: every.kite ?? undefined }, colors: every.colors },
    ...Object.entries(sets).map(([id, x]) => {
      const v = names(x.venues);
      return { id, name: x.name, venues: v.length ? (v.length > 4 ? `${v.slice(0, 3).join(', ')} +${v.length - 3}` : v.join(', ')) : '—', own: { main: x.main, jib: x.jib, kite: x.kite }, colors: x.colors ?? null };
    }),
  ];
  // a set's cell: its own, or every venue's faded, as it inherits it
  const pic = (id: string, own: Pic | undefined, slot: Slot) => {
    const p = own ?? (id === EVERY ? undefined : every[slot] ?? undefined);
    if (!p) return <span className="sp-none">—</span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={`sp-pic${own ? '' : ' sp-inh'}`} title={own ? undefined : t('As every venue', 'Как для всех мест', 'Como en todas las sedes', 'Wie in allen Revieren', 'Tüm mekânlardaki gibi')}><img src={p.url} alt="" /></span>;
  };
  const dye = (id: string, c: string | undefined, slot: 'jib' | 'kite') => {
    const inherit = c === undefined && id !== EVERY, v = inherit ? every.colors?.[slot] : c;
    const label = v === undefined || v === 'auto' ? (slot === 'jib' ? t('From the ad', 'По рекламе', 'Según el anuncio', 'Nach der Werbung', 'Reklamdan') : t('Boat’s own', 'Свой у яхты', 'El del barco', 'Das eigene', 'Teknenin')) : v === 'own' ? t('Boat’s own', 'Свой у яхты', 'El del barco', 'Das eigene', 'Teknenin') : v.toUpperCase();
    return <span className={`sp-dye${inherit ? ' sp-inh' : ''}`}>{v && HEX.test(v) ? <i style={{ background: v }} /> : null}{label}</span>;
  };
  return (
    <section className="adm adm-sails" aria-labelledby="sp-h">
      <div className="sp-bar">
        <h2 className="kicker" id="sp-h">{t('Sail presets', 'Пресеты парусов', 'Ajustes de velas', 'Segel-Vorlagen', 'Yelken ön ayarları')}</h2>
        <button type="button" className="pill pill-primary pill-xs" onClick={() => setOpen(NEW)}><span className="btn-t">{t('New preset', 'Новый пресет', 'Ajuste nuevo', 'Neue Vorlage', 'Yeni ön ayar')}</span></button>
      </div>
      <p className="hint">{t('Every venue’s sails, and presets for sets of venues: a race at one of a preset’s venues carries its sails, and every venue’s for anything the preset leaves to them (shown faded). The plane’s banner is on Ads.', 'Паруса для всех мест и пресеты для наборов мест: гонка в месте из пресета несёт его паруса, а то, что пресет оставляет общим (бледное), — общие. Баннер самолёта — в «Рекламе».', 'Las velas de todas las sedes y ajustes para conjuntos de sedes: una regata en una de sus sedes lleva sus velas, y las de todas las sedes para lo que el ajuste les deja (en claro). La pancarta de la avioneta está en Anuncios.', 'Die Segel aller Reviere und Vorlagen für Gruppen von Revieren: Eine Regatta in einem ihrer Reviere trägt ihre Segel und für alles, was die Vorlage offen lässt (blass), die aller Reviere. Das Banner des Flugzeugs ist unter Werbung.', 'Tüm mekânların yelkenleri ve mekân grupları için ön ayarlar: bir ön ayarın mekânındaki yarış onun yelkenlerini, ön ayarın bıraktıkları için (soluk) tüm mekânlarınkini taşır. Uçağın pankartı Reklamlar’dadır.')}</p>
      <div className="adm-tab sp-tab">
        <div className="adm-tab-scroll" tabIndex={0} role="region" aria-labelledby="sp-h">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('Preset', 'Пресет', 'Ajuste', 'Vorlage', 'Ön ayar')}</th>
                <th scope="col">{t('Venues', 'Места', 'Sedes', 'Reviere', 'Mekânlar')}</th>
                <th scope="col">{t('Mainsail', 'Грот', 'Mayor', 'Großsegel', 'Ana yelken')}</th>
                <th scope="col">{t('Jib', 'Стаксель', 'Foque', 'Fock', 'Flok')}</th>
                <th scope="col">{t('Jib colour', 'Цвет стакселя', 'Color del foque', 'Fockfarbe', 'Flok rengi')}</th>
                <th scope="col">{t('Gennaker', 'Генакер', 'Gennaker', 'Gennaker', 'Balon')}</th>
                <th scope="col">{t('Gennaker colour', 'Цвет генакера', 'Color del gennaker', 'Gennakerfarbe', 'Balon rengi')}</th>
                <th scope="col"><span className="vh">{t('Edit', 'Изменить', 'Editar', 'Bearbeiten', 'Düzenle')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.id === EVERY ? 'sp-every' : undefined}>
                  <th scope="row">{r.name}</th>
                  <td className="sp-venues">{r.venues}</td>
                  <td>{pic(r.id, r.own.main, 'main')}</td>
                  <td>{pic(r.id, r.own.jib, 'jib')}</td>
                  <td>{dye(r.id, r.colors?.jib, 'jib')}</td>
                  <td>{pic(r.id, r.own.kite, 'kite')}</td>
                  <td>{dye(r.id, r.colors?.kite, 'kite')}</td>
                  <td><button type="button" className="pill pill-quiet pill-xs sp-edit" aria-label={`${t('Edit', 'Изменить', 'Editar', 'Bearbeiten', 'Düzenle')} ${r.name}`} onClick={() => setOpen(r.id)}><span className="btn-t">{t('Edit', 'Изменить', 'Editar', 'Bearbeiten', 'Düzenle')}</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="hint sp-req">
        <p>{t('Pictures: PNG, JPEG, WebP or SVG, up to 2 MB. Crop each to its artwork, with no empty margin: its own shape sets how large it stands on the sail. An SVG stays sharp; a bitmap wants to be at least 1024 px on its long side.', 'Картинки: PNG, JPEG, WebP или SVG, до 2 МБ. Обрежьте по рисунку, без пустых полей: размер на парусе задаёт его собственная форма. SVG остаётся чётким; растровой картинке нужно от 1024 px по длинной стороне.', 'Imágenes: PNG, JPEG, WebP o SVG, hasta 2 MB. Recórtala a su dibujo, sin márgenes vacíos: su propia forma decide su tamaño en la vela. Un SVG queda nítido; un mapa de bits pide al menos 1024 px en su lado largo.', 'Bilder: PNG, JPEG, WebP oder SVG, bis 2 MB. Auf das Motiv zuschneiden, ohne leeren Rand: Seine eigene Form bestimmt, wie groß es auf dem Segel steht. Ein SVG bleibt scharf; eine Rastergrafik braucht mindestens 1024 px an der langen Seite.', 'Resimler: PNG, JPEG, WebP veya SVG, en fazla 2 MB. Boş kenar bırakmadan çizime göre kırp: yelkendeki boyunu kendi biçimi belirler. SVG net kalır; bitmap uzun kenarında en az 1024 px olmalı.')}</p>
        <ul>
          <li><b>{t('Mainsail logo', 'Логотип на гроте', 'Logo en la mayor', 'Logo auf dem Großsegel', 'Ana yelken logosu')}</b> — {t('stands upright under the number; a logo of one colour on a transparent ground (a white cut-out) is printed in the boat’s sail-number colour, one of more colours or on a ground of its own as it is.', 'стоит прямо под номером; логотип одного цвета на прозрачном фоне (белый силуэт) печатается цветом номера яхты, многоцветный или на своём фоне — как есть.', 'va derecho bajo el número; un logo de un color sobre fondo transparente (un recorte blanco) se imprime en el color del número del barco, uno de más colores o con fondo propio tal cual.', 'steht aufrecht unter der Nummer; ein einfarbiges Logo auf transparentem Grund (weiß ausgeschnitten) wird in der Farbe der Segelnummer gedruckt, ein mehrfarbiges oder eines mit eigenem Grund so, wie es ist.', 'numaranın altında dik durur; saydam zemin üzerinde tek renkli bir logo (beyaz kesik) teknenin yelken numarası renginde, çok renkli ya da kendi zemini olan bir logo olduğu gibi basılır.')}</li>
          <li><b>{t('Jib ad', 'Реклама на стакселе', 'Anuncio en el foque', 'Werbung auf der Fock', 'Flok reklamı')}</b> — {t('a long banner (about 4:1 or longer) runs up the luff, a squarer one stands level. With a solid ground of one colour to all four corners, the jib is dyed that colour (when its colour follows the ad) and the banner drawn 15% larger, its edges running off the sail: keep the words clear of the edges.', 'длинный баннер (примерно 4:1 и длиннее) идёт вдоль передней шкаторины, более квадратный стоит ровно. Если фон сплошной и одного цвета во всех четырёх углах, стаксель красится в этот цвет (когда цвет «по рекламе»), а баннер рисуется на 15% больше и края уходят за парус: держите слова подальше от краёв.', 'una pancarta larga (unos 4:1 o más) sube por el grátil, una más cuadrada va a nivel. Con un fondo liso de un color en las cuatro esquinas, el foque se tiñe de ese color (si su color sigue al anuncio) y la pancarta se dibuja un 15% mayor, sus bordes fuera de la vela: deja las letras lejos de los bordes.', 'ein langes Banner (etwa 4:1 oder länger) läuft am Vorliek hinauf, ein eher quadratisches steht waagerecht. Ist der Grund in allen vier Ecken einfarbig, wird die Fock in dieser Farbe gefärbt (wenn ihre Farbe der Werbung folgt) und das Banner 15 % größer gezeichnet, seine Ränder über das Segel hinaus: Schrift von den Rändern fernhalten.', 'uzun bir pankart (yaklaşık 4:1 ya da daha uzun) orsa yakası boyunca uzanır, daha kare olanı düz durur. Zemin dört köşede de tek ve düz bir renkse flok o renge boyanır (rengi reklama göreyse) ve pankart %15 büyük çizilir, kenarları yelkenin dışına taşar: yazıyı kenarlardan uzak tut.')}</li>
          <li><b>{t('Gennaker logo', 'Логотип на генакере', 'Logo en el gennaker', 'Logo auf dem Gennaker', 'Balon logosu')}</b> — {t('stands upright in the middle of the sail, as it is, best on a transparent ground.', 'стоит прямо посередине паруса, как есть; лучше на прозрачном фоне.', 'va derecho en el centro de la vela, tal cual; mejor sobre fondo transparente.', 'steht aufrecht in der Mitte des Segels, so wie es ist; am besten auf transparentem Grund.', 'yelkenin ortasında olduğu gibi dik durur; en iyisi saydam zeminde.')}</li>
        </ul>
      </div>
      {open !== null && <PresetDialog key={open} lang={lang} id={open} every={every} sets={sets} onClose={() => setOpen(null)} />}
    </section>
  );
}

// a picture as the dialog holds it: the one saved, a new file chosen for it, or taken off
type PicDraft = { cur: Pic | null; file: File | null; preview: string | null; drop: boolean };

// The dialog that makes or changes one preset: for a set, its name and venues (by the venue or a country's at once, a
// venue in another set named with it and moved here when picked); the three pictures; the two colours. Save writes it
// all; a set can be deleted, its pictures taken out of the bucket and its venues left to every venue's sails.
function PresetDialog({ lang, id, every, sets, onClose }: { lang: Lang; id: string; every: EveryVenue; sets: SetMap; onClose: () => void }) {
  const t = tx(lang);
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const isEvery = id === EVERY, isNew = id === NEW, me: SailSet | null = isEvery ? null : isNew ? { name: '', venues: [] } : sets[id];
  const ownPics = { main: isEvery ? every.main : me?.main ?? null, jib: isEvery ? every.jib : me?.jib ?? null, kite: isEvery ? every.kite : me?.kite ?? null };
  const ownColors = (isEvery ? every.colors : me?.colors) ?? {};
  const [name, setName] = useState(me?.name ?? '');
  const [picked, setPicked] = useState<string[]>(me?.venues ?? []);
  const [pics, setPics] = useState<Record<Slot, PicDraft>>(() => ({
    main: { cur: ownPics.main, file: null, preview: null, drop: false }, jib: { cur: ownPics.jib, file: null, preview: null, drop: false }, kite: { cur: ownPics.kite, file: null, preview: null, drop: false },
  }));
  const modeOf = (v: string | undefined, slot: 'jib' | 'kite'): Dye => (v === undefined ? (isEvery ? (slot === 'jib' ? 'auto' : 'own') : 'inherit') : v === 'auto' || v === 'own' ? v : 'one');
  const [jib, setJib] = useState<{ mode: Dye; col: string }>({ mode: modeOf(ownColors.jib, 'jib'), col: HEX.test(ownColors.jib ?? '') ? ownColors.jib! : '#111214' });
  const [kite, setKite] = useState<{ mode: Dye; col: string }>({ mode: modeOf(ownColors.kite, 'kite'), col: HEX.test(ownColors.kite ?? '') ? ownColors.kite! : '#e30a17' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { dlg.current?.showModal(); }, []);
  const close = () => { for (const p of Object.values(pics)) if (p.preview) URL.revokeObjectURL(p.preview); dlg.current?.close(); onClose(); };

  const title = isEvery ? t('Every venue’s sails', 'Паруса для всех мест', 'Las velas de todas las sedes', 'Die Segel aller Reviere', 'Tüm mekânların yelkenleri') : isNew ? t('New preset', 'Новый пресет', 'Ajuste nuevo', 'Neue Vorlage', 'Yeni ön ayar') : me!.name;
  const has = (v: string) => picked.includes(v);
  const toggle = (ids: string[], on: boolean) => setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((v) => !ids.includes(v))));
  const owner = (v: string) => Object.entries(sets).find(([sid, x]) => sid !== id && x.venues.includes(v))?.[1];
  const countries = [...new Set(VENUES.map((v) => v.nation))].map((nation) => {
    const vs = VENUES.filter((v) => v.nation === nation), where = inLang(vs[0].place, lang);
    return { nation, vs, label: where.includes(',') ? where.slice(where.lastIndexOf(',') + 1).trim() : where };
  });
  const choose = (slot: Slot, f: File | undefined) => {
    setErr('');
    if (!f) return;
    if (!TYPES[f.type]) return setErr(t('A PNG, JPEG, WebP or SVG picture, please.', 'Нужна картинка PNG, JPEG, WebP или SVG.', 'Una imagen PNG, JPEG, WebP o SVG, por favor.', 'Bitte ein PNG-, JPEG-, WebP- oder SVG-Bild.', 'Lütfen PNG, JPEG, WebP veya SVG bir resim seç.'));
    if (f.size > MAX) return setErr(t('Up to 2 MB, please.', 'Не больше 2 МБ.', 'Hasta 2 MB, por favor.', 'Bitte höchstens 2 MB.', 'En fazla 2 MB olsun.'));
    setPics((p) => { if (p[slot].preview) URL.revokeObjectURL(p[slot].preview!); return { ...p, [slot]: { ...p[slot], file: f, preview: URL.createObjectURL(f), drop: false } }; });
  };
  const drop = (slot: Slot) => setPics((p) => { if (p[slot].preview) URL.revokeObjectURL(p[slot].preview!); return { ...p, [slot]: { ...p[slot], file: null, preview: null, drop: true } }; });
  // what a colour choice saves: nothing for as every venue (and, for every venue's, its defaults)
  const value = (d: { mode: Dye; col: string }, slot: 'jib' | 'kite') =>
    d.mode === 'one' ? d.col : d.mode === 'inherit' ? undefined : slot === 'jib' ? (d.mode === 'own' ? 'own' : isEvery ? undefined : 'auto') : isEvery ? undefined : 'own';
  const clean = name.trim().slice(0, NAME_MAX);

  const save = async () => {
    setBusy(true); setErr('');
    const sb = supabaseBrowser(), sid = isNew ? `s${Date.now().toString(36)}` : id, fresh: Partial<Record<Slot, Pic>> = {};
    const fail = async (msg: string) => {
      const paths = Object.values(fresh).map((p) => p.path!);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      setBusy(false); setErr(msg);
    };
    for (const slot of Object.keys(SLOTS) as Slot[]) {
      const f = pics[slot].file;
      if (!f) continue;
      const path = `${SLOTS[slot].dir}/${isEvery ? '' : `${sid}-`}${Date.now()}.${TYPES[f.type]}`;
      const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, cacheControl: '31536000', upsert: false });
      if (up.error) return fail(up.error.message);
      fresh[slot] = { url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path };
    }
    const next = (slot: Slot) => fresh[slot] ?? (pics[slot].drop ? null : pics[slot].cur);
    const colors: SailColors = {};
    const jv = value(jib, 'jib'), kv = value(kite, 'kite');
    if (jv) colors.jib = jv;
    if (kv) colors.kite = kv;
    if (isEvery) {
      for (const slot of Object.keys(SLOTS) as Slot[]) {
        if (!fresh[slot] && !pics[slot].drop) continue;
        const p = next(slot), row = p
          ? await sb.from('regatta_settings').upsert({ key: SLOTS[slot].key, value: p, updated_at: new Date().toISOString() })
          : await sb.from('regatta_settings').delete().eq('key', SLOTS[slot].key);
        if (row.error) return fail(row.error.message);
      }
      if (JSON.stringify(colors) !== JSON.stringify(every.colors ?? {})) {
        const row = Object.keys(colors).length
          ? await sb.from('regatta_settings').upsert({ key: COLORS_KEY, value: colors, updated_at: new Date().toISOString() })
          : await sb.from('regatta_settings').delete().eq('key', COLORS_KEY);
        if (row.error) return fail(row.error.message);
      }
    } else {
      const order: string[] = VENUES.map((v) => v.id).filter(has);
      const row = await writeSets(sets, (m) => {
        for (const [oid, x] of Object.entries(m)) if (oid !== sid) x.venues = x.venues.filter((v) => !order.includes(v)); // moved here
        const x: SailSet = { name: clean, venues: order };
        for (const slot of Object.keys(SLOTS) as Slot[]) { const p = next(slot); if (p) x[slot] = p; }
        if (Object.keys(colors).length) x.colors = colors;
        m[sid] = x;
        return m;
      });
      if (row.error) return fail(row.error.message);
    }
    const old = (Object.keys(SLOTS) as Slot[]).filter((s) => (fresh[s] || pics[s].drop) && pics[s].cur?.path).map((s) => pics[s].cur!.path!);
    if (old.length) await sb.storage.from(BUCKET).remove(old);
    await sponsorChanged();
    setBusy(false); close(); router.refresh();
  };
  const remove = async () => {
    setBusy(true); setErr('');
    const row = await writeSets(sets, (m) => { delete m[id]; return m; });
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    const files = [me!.main, me!.jib, me!.kite].map((x) => x?.path).filter((x): x is string => !!x);
    if (files.length) await supabaseBrowser().storage.from(BUCKET).remove(files);
    await sponsorChanged();
    setBusy(false); close(); router.refresh();
  };

  const slotName: Record<Slot, string> = { main: t('Mainsail logo', 'Логотип на гроте', 'Logo en la mayor', 'Logo auf dem Großsegel', 'Ana yelken logosu'), jib: t('Jib ad', 'Реклама на стакселе', 'Anuncio en el foque', 'Werbung auf der Fock', 'Flok reklamı'), kite: t('Gennaker logo', 'Логотип на генакере', 'Logo en el gennaker', 'Logo auf dem Gennaker', 'Balon logosu') };
  const asAll: [Dye, string][] = isEvery ? [] : [['inherit', t('As every venue', 'Как для всех мест', 'Como en todas las sedes', 'Wie in allen Revieren', 'Tüm mekânlardaki gibi')]];
  const dyeRow = (slot: 'jib' | 'kite', d: { mode: Dye; col: string }, set: (d: { mode: Dye; col: string }) => void) => {
    const modes: [Dye, string][] = slot === 'jib'
      ? [...asAll, ['auto', t('Follow the ad', 'По рекламе', 'Según el anuncio', 'Nach der Werbung', 'Reklama göre')], ['own', t('Each boat’s own', 'Свой у каждой', 'El de cada barco', 'Jedes Boot sein eigenes', 'Her teknenin kendi')], ['one', t('One colour for all', 'Один цвет для всех', 'Un color para todos', 'Eine Farbe für alle', 'Herkese tek renk')]]
      : [...asAll, ['own', t('Each boat’s own', 'Свой у каждой', 'El de cada barco', 'Jedes Boot sein eigenes', 'Her teknenin kendi')], ['one', t('One colour for all', 'Один цвет для всех', 'Un color para todos', 'Eine Farbe für alle', 'Herkese tek renk')]];
    const lid = `sp-dye-${slot}`;
    return (
      <div className="sp-row">
        <span className="srow-k" id={lid}>{slot === 'jib' ? t('Jib colour', 'Цвет стакселя', 'Color del foque', 'Fockfarbe', 'Flok rengi') : t('Gennaker colour', 'Цвет генакера', 'Color del gennaker', 'Gennakerfarbe', 'Balon rengi')}</span>
        <div className="sp-ctl">
          <div className="bt-pills" role="radiogroup" aria-labelledby={lid}>
            {modes.map(([m, l]) => <button key={m} type="button" role="radio" aria-checked={d.mode === m} className="bt-pill" disabled={busy} onClick={() => set({ ...d, mode: m })}>{l}</button>)}
          </div>
          {d.mode === 'one' && <span className="adm-color"><input type="color" aria-labelledby={lid} value={d.col} disabled={busy} onChange={(e) => set({ ...d, col: e.target.value })} /><span className="adm-v">{d.col.toUpperCase()}</span></span>}
        </div>
      </div>
    );
  };

  return (
    <dialog ref={dlg} className="dl sp-dlg" aria-labelledby="sp-dlg-h" onCancel={(e) => { e.preventDefault(); if (!busy) close(); }}>
      <div className="dl-in sp-in">
        <span className="dl-k">{t('Sail preset', 'Пресет парусов', 'Ajuste de velas', 'Segel-Vorlage', 'Yelken ön ayarı')}</span>
        <h2 className="dl-h" id="sp-dlg-h">{title || t('New preset', 'Новый пресет', 'Ajuste nuevo', 'Neue Vorlage', 'Yeni ön ayar')}</h2>
        {!isEvery && (
          <>
            <div className="sp-row">
              <label className="srow-k" htmlFor="sp-name">{t('Name', 'Название', 'Nombre', 'Name', 'Ad')}</label>
              <input id="sp-name" className="field" type="text" maxLength={NAME_MAX} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="sp-row sp-row-top">
              <span className="srow-k">{t(`Venues (${picked.length})`, `Места (${picked.length})`, `Sedes (${picked.length})`, `Reviere (${picked.length})`, `Mekânlar (${picked.length})`)}</span>
              <div className="adm-venues sp-venues">
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
            </div>
          </>
        )}
        {(Object.keys(SLOTS) as Slot[]).map((slot) => {
          const p = pics[slot], shown = p.preview ?? (p.drop ? null : p.cur?.url ?? null), inherited = !shown && !isEvery ? every[slot]?.url ?? null : null;
          return (
            <div className="sp-row" key={slot}>
              <span className="srow-k">{slotName[slot]}</span>
              <div className="sp-ctl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className={`sp-pic sp-pic-l${inherited ? ' sp-inh' : ''}`}>{shown || inherited ? <img src={(shown || inherited)!} alt="" /> : <span className="sp-none">—</span>}</span>
                <input id={`sp-file-${slot}`} className="vh" type="file" accept={Object.keys(TYPES).join(',')} disabled={busy} onChange={(e) => choose(slot, e.target.files?.[0])} />
                <label className="adm-pick" htmlFor={`sp-file-${slot}`}><IconImage /><span>{p.file ? p.file.name : t('Choose a picture', 'Выбрать картинку', 'Elige una imagen', 'Bild wählen', 'Resim seç')}</span></label>
                {shown && <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={() => drop(slot)}><span className="btn-t">{isEvery ? t('No picture', 'Без картинки', 'Sin imagen', 'Kein Bild', 'Resim yok') : t('As every venue', 'Как для всех мест', 'Como en todas las sedes', 'Wie in allen Revieren', 'Tüm mekânlardaki gibi')}</span></button>}
              </div>
            </div>
          );
        })}
        {dyeRow('jib', jib, setJib)}
        {dyeRow('kite', kite, setKite)}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="dl-btns sp-btns">
          <button type="button" className="pill pill-primary pill-xs" disabled={busy || (!isEvery && !clean)} onClick={save}><span className="btn-t">{busy ? t('Saving…', 'Сохраняю…', 'Guardando…', 'Speichern …', 'Kaydediliyor…') : t('Save', 'Сохранить', 'Guardar', 'Speichern', 'Kaydet')}</span></button>
          <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={close}><span className="btn-t">{t('Cancel', 'Отмена', 'Cancelar', 'Abbrechen', 'Vazgeç')}</span></button>
          {!isEvery && !isNew && <button type="button" className="pill pill-quiet pill-xs sp-del" disabled={busy} onClick={remove}><span className="btn-t">{t('Delete the preset', 'Удалить пресет', 'Borrar el ajuste', 'Vorlage löschen', 'Ön ayarı sil')}</span></button>}
        </div>
      </div>
    </dialog>
  );
}
