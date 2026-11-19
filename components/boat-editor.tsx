'use client';
import { LoadBar, ScenePoster } from './skeleton';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { IconPlay, IconGrid, IconHull, IconSail, IconKite, IconHash, IconCrew, IconRestart, IconFlag, IconCheck } from './ui';
import { FLAGS, findFlag, flagSrc, type Flag } from '@/lib/flags';
import { NoFlag } from './flag';
import { SceneBrand } from './scene-brand';
import { PauseCard } from './pause-card';
import { BOAT_EVENT, DEFAULT_BOAT, NAME_MAX, PRESETS, SWATCHES, cleanName, readBoat, saveBoat, type Boat, type Deck } from '@/lib/boat';
import { syncAccount } from './bests-sync';
import { useSceneStart } from '@/lib/scene-start';

// The boat page, laid out like the race's pause screen: the game's own scene behind it all (your yacht on Lake Garda,
// /boat-view), her name and numbers over it, and the choices (the ready schemes, the hull, the sails, the gennaker, the
// flag, the sail number and the team) in the panel every scene page has (pause-card.tsx). The scene is told what the card and the
// heading cover, so she stands in the part left clear. Every change shows on her at once, and is kept when you press
// Save (beside the way to the race, at the panel's top): then it's saved where the game reads it and, for a signed-in player, in the account.
// Until then Save stands out and leaving asks first; going to race in her saves her on the way. The boat as it was read
// (from this device, or from the account when the sync brings it) is never saved back, so a first visit doesn't stamp
// the default as a choice.
export function BoatEditor({ lang, back }: { lang: Lang; back?: ReactNode }) {
  const t = tx(lang);
  const [b, setB] = useState<Boat>(DEFAULT_BOAT);
  const [ready, setReady] = useState(false);
  const [down, setDown] = useState(false);
  const [err, setErr] = useState('');
  const [shots, setShots] = useState<Record<string, string>>({});
  const [live, setLive] = useState(false); // the 3D scene has drawn its first frame
  const scene = useSceneStart(false); // (it is what this page edits: never left out, only started once the page is up)
  const frame = useRef<HTMLIFrameElement>(null);
  const card = useRef<HTMLElement>(null), info = useRef<HTMLDivElement>(null);
  const latest = useRef({ b, down });
  latest.current = { b, down };
  // the boat as she was last kept (saved here, or read): Save has something to do while what you see differs from it
  const [kept, setKept] = useState(() => lookKey(DEFAULT_BOAT));
  const [justSaved, setJustSaved] = useState(false);
  const dirty = ready && lookKey(b) !== kept;
  const dirtyRef = useRef(false); dirtyRef.current = dirty;

  const post = (msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin);
  useEffect(() => {
    // the account's boat, just brought to this device: shown, unless you're in the middle of changing her (then Save
    // keeps your changes over it)
    const load = (first = false) => { const s = readBoat(); setKept(lookKey(s)); if (first || !dirtyRef.current) setB(s); };
    load(true); setReady(true);
    const synced = () => load();
    addEventListener(BOAT_EVENT, synced);
    return () => removeEventListener(BOAT_EVENT, synced);
  }, []);
  useEffect(() => { if (ready) post({ type: 'look', boat: b }); setJustSaved(false); }, [b, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    if (!saveBoat(b)) { setErr(t('This browser didn’t keep your yacht: its storage may be full or blocked.', 'Браузер не сохранил яхту: возможно, его хранилище заполнено или заблокировано.', 'Este navegador no guardó tu yate: puede que su almacenamiento esté lleno o bloqueado.', 'Dieser Browser hat deine Yacht nicht gespeichert: Vielleicht ist der Speicher voll oder gesperrt.', 'Bu tarayıcı yatını saklamadı: depolama alanı dolu ya da engellenmiş olabilir.')); return false; }
    setErr(''); setKept(lookKey(b)); setJustSaved(true); dirtyRef.current = false; // kept: going on to race asks nothing
    syncAccount().catch(() => {});
    return true;
  };
  // leaving with changes not saved asks first: closing the tab or reloading, and the page's own links
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    const link = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[href]');
      if (!a || a.classList.contains('bt-go') || e.defaultPrevented) return;
      if (!confirm(t('Leave without saving your yacht? Your changes will be lost.', 'Уйти, не сохранив яхту? Изменения пропадут.', '¿Salir sin guardar tu yate? Perderás los cambios.', 'Verlassen, ohne deine Yacht zu speichern? Deine Änderungen gehen verloren.', 'Yatını kaydetmeden çıkılsın mı? Değişikliklerin kaybolacak.'))) { e.preventDefault(); e.stopPropagation(); }
    };
    addEventListener('beforeunload', unload);
    document.addEventListener('click', link, true);
    return () => { removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true); };
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { post({ type: 'pose', down }); }, [down]);
  // what the card and the heading cover, so the scene stands her in the rest: beside the card on a wide screen, between
  // the heading and the card upright
  const inset = () => {
    const c = card.current?.getBoundingClientRect(), h = info.current?.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    const p = info.current?.querySelector('.bt-p')?.getBoundingClientRect(), st = info.current?.querySelector('.bt-stats')?.getBoundingClientRect();
    if (!c || !h) return;
    const tall = c.width > W * 0.7, head = (p && p.height ? p.bottom : h.top + 120) / H;
    post({ type: 'inset', l: 0, r: tall ? 0 : (W - c.left) / W, t: Math.min(0.4, tall ? h.bottom / H : head * 0.6), b: tall ? (H - c.top) / H : st ? (H - st.top) / H * 0.5 : 0 });
  };
  useEffect(() => {
    const ro = new ResizeObserver(inset);
    if (card.current) ro.observe(card.current);
    if (info.current) ro.observe(info.current);
    addEventListener('resize', inset);
    return () => { ro.disconnect(); removeEventListener('resize', inset); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the preview says when it's up: then it gets the boat as it is now, and draws the presets' pictures (once a visit:
  // they're kept for the session, until the presets or the pictures' version, v5, change)
  useEffect(() => {
    let cached: Record<string, string> | null = null, asked = false;
    try { const c = JSON.parse(sessionStorage.getItem(SHOTS_KEY) || 'null'); if (c?.v === SHOTS_V) { cached = c.shots; setShots(c.shots); } } catch {}
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'ready') {
        post({ type: 'look', boat: latest.current.b }); post({ type: 'pose', down: latest.current.down }); inset();
        if (!cached && !asked) (asked = true), post({ type: 'thumbs', items: PRESETS.map((p) => ({ id: p.id, boat: { ...p.boat, nat: '', num: '' } })) });
      }
      if (e.data?.type === 'live') setLive(true);
      if (e.data?.type === 'thumbs' && e.data.shots) {
        cached = e.data.shots; setShots(e.data.shots);
        try { sessionStorage.setItem(SHOTS_KEY, JSON.stringify({ v: SHOTS_V, shots: e.data.shots })); } catch {}
      }
    };
    addEventListener('message', on);
    post({ type: 'hello' }); // in case the preview was up before this page listened: it answers ready again
    return () => removeEventListener('message', on);
  }, []);

  const set = (patch: Partial<Boat>) => setB((x) => ({ ...x, ...patch, preset: undefined }));

  // one setting: a small caps label, then the swatches; a part of a bigger group gets a quieter label
  const swatches = (k: 'hull' | 'cloth' | 'ink' | 'kite' | 'bottom' | 'crew' | 'pants', label: string, sub = false) => (
    <div className={sub ? 'bt-part' : 'bt-g'}>
      {sub ? <span className="bt-sub" id={`l-${k}`}>{label}</span> : null}
      <Swatches label={`l-${k}`} value={b[k] || ''} options={SWATCHES[k]} onChange={(v) => { set({ [k]: v }); if (k.startsWith('kite')) setDown(true); else if (k !== 'crew' && k !== 'pants') setDown(false); }} t={t} />
    </div>
  );
  const kicker = (id: string, ico: ReactNode, label: string) => <span className="bt-k" id={id}>{ico}{label}</span>;
  // a choice as the pause menu's quick switches: a pill with a light that's on
  const tags = <V extends string | boolean>(label: string, value: V, opts: [V, string][], pick: (v: V) => void) => (
    <div className="bt-pills" role="radiogroup" aria-labelledby={label}>
      {opts.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} className="bt-pill" onClick={() => pick(v)}>{l}</button>)}
    </div>
  );
  const preset = PRESETS.find((p) => p.id === b.preset);
  const flag = findFlag(b.flag);
  // a flag on the main: the boat then carries that country's letters too
  const setFlag = (code: string) => { const f = findFlag(code); setB((x) => ({ ...x, flag: f?.code, ...(f ? { nat: f.ioc } : {}) })); setDown(false); };

  return (
    <div className="bt">
      <LoadBar label={t('Loading your yacht', 'Загружаем яхту', 'Cargando tu yate', 'Deine Yacht wird geladen', 'Yatın yükleniyor')} on={!live} />
      <iframe ref={frame} className="bt-scene" src={scene.go ? '/boat-view?wind=light' : undefined} onLoad={() => post({ type: 'hello' })} title={t('Your yacht in 3D', 'Твоя яхта в 3D', 'Tu yate en 3D', 'Deine Yacht in 3D', 'Yatın 3D')} />
      {/* over the scene, which doesn't fade in: it shows until her first frame, then fades away */}
      <ScenePoster label={t('Loading your yacht', 'Загружаем яхту', 'Cargando tu yate', 'Deine Yacht wird geladen', 'Yatın yükleniyor')} on={!live} />

      <div className="bt-info" ref={info}>
        <div className="bt-top">{back}<SceneBrand lang={lang} /></div>
        <span className="bt-kick">{t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın')}</span>
        {/* her flag and sail number, as the race calls her */}
        <h1 className="bt-h bt-h-boat">{/* eslint-disable-next-line @next/next/no-img-element */}{flag ? <img className="bt-h-flag" src={flagSrc(flag.code)} alt={t(flag.en, flag.ru, flag.es, flag.de, flag.tr)} /> : <NoFlag className="bt-h-flag" />}<span className="vh">{t('Your yacht: ', 'Твоя яхта: ', 'Tu yate: ', 'Deine Yacht: ', 'Yatın: ')}</span><span>{`${b.nat} ${b.num || '1'}`.trim()}</span></h1>
        <p className="bt-p">{t('Lake Garda, a summer evening. Drag to circle her.', 'Озеро Гарда, летний вечер. Тяни, чтобы облететь яхту.', 'Lago de Garda, una tarde de verano. Arrastra para rodearla.', 'Gardasee, ein Sommerabend. Ziehen, um sie zu umkreisen.', 'Garda Gölü, bir yaz akşamı. Çevresinde dönmek için sürükle.')}</p>
        <div className="bt-stats bt-stats-fit">
          <div><span className="bt-sk">{t('Colours', 'Цвета', 'Colores', 'Farben', 'Renkler')}</span><b>{preset ? t(preset.en, preset.ru, preset.es, preset.de, preset.tr) : t('Your own', 'Свои', 'El tuyo', 'Eigene', 'Kendine ait')}</b></div>
          <div><span className="bt-sk">{t('Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler')}</span><b>{b.laminate ? t('Laminate', 'Ламинат', 'Laminado', 'Laminat', 'Laminat') : t('Dacron', 'Дакрон', 'Dacron', 'Dacron', 'Dacron')}</b></div>
        </div>
      </div>

      <PauseCard lang={lang} back="/boat" title={t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın')} className="bt-boat" cardRef={card} foot={['yachts', 'venues']}
        tools={<button type="button" className="bt-mini" title={t('Back to the RYC colours', 'Вернуть цвета RYC', 'Volver a los colores del RYC', 'Zurück zu den RYC-Farben', 'RYC renklerine dön')} aria-label={t('Back to the RYC colours', 'Вернуть цвета RYC', 'Volver a los colores del RYC', 'Zurück zu den RYC-Farben', 'RYC renklerine dön')} onClick={() => { setB({ ...DEFAULT_BOAT, name: b.name }); setDown(false); }}>
          <IconRestart s={14} /><span>{t('RYC colours', 'Цвета RYC', 'Colores del RYC', 'RYC-Farben', 'RYC renkleri')}</span>
        </button>}
        action={<>
          <a className="bt-go" href="/play?race=today" onClick={(e) => { if (dirty && !save()) e.preventDefault(); }}><IconPlay /><span>{t('Race her today', 'В гонку дня', 'Regatea hoy con ella', 'Heute mit ihr segeln', 'Bugün onunla yarış')}</span></a>
          <button type="button" className={`bt-save${dirty ? ' on' : ''}`} onClick={save} disabled={!dirty}>
            {dirty ? <span>{t('Save', 'Сохранить', 'Guardar', 'Speichern', 'Kaydet')}</span> : <><IconCheck s={16} /><span>{t('Saved', 'Сохранено', 'Guardado', 'Gespeichert', 'Kaydedildi')}</span></>}
          </button>
          {err && <p className="bt-err" role="alert">{err}</p>}
        </>}>
        <div className="bt-seg" role="radiogroup" aria-label={t('Point of sail', 'Курс', 'Rumbo', 'Kurs zum Wind', 'Seyir yönü')}>
          <button type="button" role="radio" aria-checked={!down} onClick={() => setDown(false)}>{t('Upwind', 'Бейдевинд', 'Ceñida', 'Am Wind', 'Orsa')}</button>
          <button type="button" role="radio" aria-checked={down} onClick={() => setDown(true)}>{t('Gennaker', 'Генакер', 'Gennaker', 'Gennaker', 'Gennaker')}</button>
        </div>

        <div className="bt-g">
          {kicker('l-presets', <IconGrid />, t('Presets', 'Готовые схемы', 'Preajustes', 'Vorlagen', 'Hazır ayarlar'))}
          <div className="presets" role="list" aria-labelledby="l-presets">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" role="listitem" className={`preset ${b.preset === p.id ? 'on' : ''}`} aria-pressed={b.preset === p.id}
                aria-label={t(p.en, p.ru, p.es, p.de, p.tr)} title={t(p.en, p.ru, p.es, p.de, p.tr)} style={{ ['--c' as string]: p.boat.hull }}
                onClick={() => setB((x) => ({ ...x, ...p.boat, preset: p.id }))}>
                <span className={`preset-pic${shots[p.id] ? '' : ' sk'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {shots[p.id] ? <img src={shots[p.id]} alt="" /> : null}
                </span>
                <span className="preset-n" aria-hidden="true">{t(p.en, p.ru, p.es, p.de, p.tr)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* the colours two to a row on a wide screen */}
        <div className="bt-grid2">
          <div className="bt-g">
            {kicker('l-hull', <IconHull />, t('Hull', 'Корпус', 'Casco', 'Rumpf', 'Gövde'))}
            <Swatches label="l-hull" value={b.hull} options={SWATCHES.hull} onChange={(v) => { set({ hull: v }); setDown(false); }} t={t} />
            {swatches('bottom', t('Bottom paint', 'Днище', 'Pintura de fondo', 'Unterwasserfarbe', 'Alt boya'), true)}
            <div className="bt-part">
              <span className="bt-sub" id="l-deck">{t('Deck', 'Палуба', 'Cubierta', 'Deck', 'Güverte')}</span>
              {tags('l-deck', b.deck, [['nonskid', t('Non-skid', 'Нескользящая', 'Antideslizante', 'Rutschfest', 'Kaymaz yüzey')], ['teak', t('Teak', 'Тик', 'Teca', 'Teak', 'Tik')], ['hull', t('Hull colour', 'В цвет корпуса', 'Color del casco', 'Rumpffarbe', 'Gövde rengi')]] as [Deck, string][], (v) => { set({ deck: v }); setDown(false); })}
            </div>
          </div>

          <div className="bt-g">
            {kicker('l-sails', <IconSail s={14} />, t('Sails', 'Паруса', 'Velas', 'Segel', 'Yelkenler'))}
            {tags('l-sails', b.laminate, [[false, t('Dacron', 'Дакрон', 'Dacron', 'Dacron', 'Dacron')], [true, t('Laminate', 'Ламинат', 'Laminado', 'Laminat', 'Laminat')]], (v) => { set({ laminate: v }); setDown(false); })}
            {swatches('cloth', t('Colour', 'Цвет', 'Color', 'Farbe', 'Renk'), true)}
          </div>

          <div className="bt-g">
            {kicker('l-kite', <IconKite />, t('Gennaker', 'Генакер', 'Gennaker', 'Gennaker', 'Gennaker'))}
            <Swatches label="l-kite" value={b.kite} options={SWATCHES.kite} onChange={(v) => { set({ kite: v }); setDown(true); }} t={t} />
          </div>

          <div className="bt-g">
            {kicker('l-team', <IconCrew />, t('Team', 'Команда', 'Equipo', 'Team', 'Takım'))}
            {swatches('crew', t('Jackets', 'Куртки', 'Chaquetas', 'Jacken', 'Ceketler'), true)}
            {swatches('pants', t('Trousers', 'Брюки', 'Pantalones', 'Hosen', 'Pantolonlar'), true)}
          </div>
        </div>

        {/* the flag and the number side by side; the flag's list, open, takes the row */}
        <div className="bt-pair">
          <div className="bt-g">
            {kicker('l-flag', <IconFlag />, t('Flag on the main', 'Флаг на гроте', 'Bandera en la mayor', 'Flagge im Groß', 'Ana yelkende bayrak'))}
            <FlagPicker value={flag?.code} onChange={setFlag} t={t} />
          </div>
          <div className="bt-g">
            <label className="bt-k" htmlFor="b-num"><IconHash />{t('Sail number', 'Номер на парусе', 'Número de vela', 'Segelnummer', 'Yelken numarası')}</label>
            <div className="num-pair">
              <input className="num-in" aria-label={t('Letters on the sail', 'Буквы на парусе', 'Letras en la vela', 'Buchstaben auf dem Segel', 'Yelkendeki harfler')} value={b.nat} maxLength={3} onChange={(e) => set({ nat: e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '') })} />
              <input id="b-num" className="num-in" inputMode="numeric" value={b.num} maxLength={4} onChange={(e) => set({ num: e.target.value.replace(/[^0-9]/g, '') })} onBlur={() => { if (!b.num) set({ num: '1' }); }} />
            </div>
          </div>
        </div>
        {swatches('ink', t('Sail number colour', 'Цвет номера', 'Color del número de vela', 'Farbe der Segelnummer', 'Yelken numarası rengi'), true)}

        <div className="bt-g">
          <label className="bt-k" htmlFor="b-name"><IconHull />{t('Name on the hull', 'Имя на корпусе', 'Nombre en el casco', 'Name am Rumpf', 'Gövdedeki isim')}</label>
          <input id="b-name" className="num-in boat-name" value={b.name || ''} maxLength={NAME_MAX} placeholder={t('No name', 'Без имени', 'Sin nombre', 'Kein Name', 'Adsız')} autoComplete="off" spellCheck={false}
            onChange={(e) => { set({ name: cleanName(e.target.value) || undefined }); setDown(false); }} onBlur={() => { const n = b.name?.trim(); if (n !== b.name) set({ name: n || undefined }); }} />
        </div>

        <p className="bt-saved" role="status">{dirty
          ? t('Changes not saved yet.', 'Изменения ещё не сохранены.', 'Cambios sin guardar.', 'Änderungen noch nicht gespeichert.', 'Değişiklikler henüz kaydedilmedi.')
          : justSaved
            ? t('Saved. You race in her from the next start.', 'Сохранено. В гонке — со следующего старта.', 'Guardado. Regatearás con ella desde la próxima salida.', 'Gespeichert. Du segelst ab dem nächsten Start mit ihr.', 'Kaydedildi. Bir sonraki startta onunla yarışırsın.')
            : t('Kept on this device, and in your account when you’re signed in.', 'Хранится на этом устройстве, а если ты вошёл — и в аккаунте.', 'Se guarda en este dispositivo, y en tu cuenta cuando has iniciado sesión.', 'Auf diesem Gerät gespeichert, und in deinem Konto, wenn du angemeldet bist.', 'Bu cihazda saklanır, giriş yaptıysan hesabında da.')}</p>
      </PauseCard>
    </div>
  );
}

// the flag on the main: a dropdown showing the flag you fly, opening (in the card, so it scrolls with it) on a search
// box and the countries A to Z in your language, No flag first. Arrows move, Enter picks, Escape closes.
function FlagPicker({ value, onChange, t }: { value?: string; onChange: (code: string) => void; t: (en: string, ru: string, es?: string, de?: string, tr?: string) => string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null), search = useRef<HTMLInputElement>(null);
  const cur = findFlag(value);
  const name = (f: Flag) => t(f.en, f.ru, f.es, f.de, f.tr);
  const sorted = useMemo(() => [...FLAGS].sort((a, b) => name(a).localeCompare(name(b))), [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const needle = q.trim().toLowerCase();
  const items: (Flag | null)[] = [
    ...(needle ? [] : [null]),
    ...sorted.filter((f) => !needle || [f.en, f.ru, f.ioc, f.code].some((s) => s.toLowerCase().includes(needle))),
  ];
  const show = (o: boolean) => {
    setOpen(o); setQ('');
    if (o) setHi(Math.max(0, items.findIndex((f) => (f?.code ?? '') === (value ?? ''))));
  };
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', away);
    return () => removeEventListener('pointerdown', away);
  }, [open]);
  useEffect(() => { list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }); }, [hi, open]);
  const pick = (f: Flag | null | undefined) => { if (f === undefined) return; onChange(f?.code ?? ''); setOpen(false); root.current?.querySelector('button')?.focus(); };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(items[hi]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); root.current?.querySelector('button')?.focus(); }
  };
  const thumb = (f: Flag | null | undefined) => f
    ? <img className="fp-img" src={flagSrc(f.code)} alt="" /> // eslint-disable-line @next/next/no-img-element
    : <i className="fp-img fp-none" aria-hidden="true" />;
  return (
    <div className="fp" ref={root}>
      <button type="button" className="fp-btn" aria-haspopup="listbox" aria-expanded={open} aria-labelledby="l-flag fp-val"
        onClick={() => show(!open)} onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show(true); } }}>
        {thumb(cur)}
        <span className="fp-name" id="fp-val">{cur ? name(cur) : t('No flag', 'Без флага', 'Sin bandera', 'Keine Flagge', 'Bayrak yok')}</span>
        {cur && <span className="fp-code">{cur.ioc}</span>}
        <svg className="fp-chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="fp-pop">
          <input ref={search} className="fp-q" type="search" value={q} placeholder={t('Search a country', 'Найти страну', 'Busca un país', 'Land suchen', 'Ülke ara')} aria-label={t('Search a country', 'Найти страну', 'Busca un país', 'Land suchen', 'Ülke ara')}
            aria-controls="fp-list" aria-activedescendant={items[hi] !== undefined ? `fp-o-${items[hi]?.code ?? 'none'}` : undefined}
            onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={key} />
          <ul className="fp-list" id="fp-list" role="listbox" ref={list} aria-label={t('Flag on the main', 'Флаг на гроте', 'Bandera en la mayor', 'Flagge im Groß', 'Ana yelkende bayrak')}>
            {items.map((f, i) => (
              <li key={f?.code ?? 'none'} id={`fp-o-${f?.code ?? 'none'}`} data-i={i} role="option" aria-selected={(f?.code ?? '') === (value ?? '')}
                className={`fp-o ${i === hi ? 'hi' : ''}`} onPointerMove={() => setHi(i)} onClick={() => pick(f)}>
                {thumb(f)}
                <span className="fp-name">{f ? name(f) : t('No flag', 'Без флага', 'Sin bandera', 'Keine Flagge', 'Bayrak yok')}</span>
                {f && <span className="fp-code">{f.ioc}</span>}
              </li>
            ))}
            {!items.length && <li className="fp-empty">{t('No such country here', 'Такой страны нет', 'No hay ningún país así', 'Kein solches Land hier', 'Burada böyle bir ülke yok')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// the boat as a key to compare by: everything she is but when she was saved, in one order
const lookKey = ({ at: _, ...r }: Boat) => JSON.stringify(r, Object.keys(r).sort());

const SHOTS_KEY = 'regatta-boat-shots', SHOTS_V = 'v5:' + PRESETS.map((p) => p.id + JSON.stringify(p.boat)).join('|');

// a row of colour swatches, named for the screen reader and on hover by the preset that colour comes from
function Swatches({ label, value, options, onChange, t }: { label: string; value: string; options: string[]; onChange: (v: string) => void; t: (en: string, ru: string, es?: string, de?: string, tr?: string) => string }) {
  return (
    <div className="sws" role="radiogroup" aria-labelledby={label}>
      {options.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase(), name = colourName(c, t);
        return <button key={c} type="button" role="radio" aria-checked={on} aria-label={name} title={name} className="sw" style={{ ['--c' as string]: c }} onClick={() => onChange(c)} />;
      })}
    </div>
  );
}

const NAMES: Record<string, [en: string, ru: string, es?: string, de?: string, tr?: string]> = {
  '#ffffff': ['White', 'Белый', 'Blanco', 'Weiß', 'Beyaz'], '#1d1d1d': ['Black', 'Чёрный', 'Negro', 'Schwarz', 'Siyah'], '#f4f2ea': ['Sailcloth white', 'Белая парусина', 'Blanco velero', 'Segeltuchweiß', 'Yelken beyazı'], '#ebe3cd': ['Cream', 'Кремовый', 'Crema', 'Creme', 'Krem'],
  '#dfe4e8': ['Mylar', 'Майлар', 'Mylar', 'Mylar', 'Mylar'], '#868c93': ['Grey laminate', 'Серый ламинат', 'Laminado gris', 'Graues Laminat', 'Gri laminat'], '#3a3d42': ['Charcoal', 'Графит', 'Antracita', 'Anthrazit', 'Antrasit'], '#2a2c30': ['Carbon', 'Карбон', 'Carbono', 'Carbon', 'Karbon'],
  '#8a4b2f': ['Tanbark', 'Красно-коричневый', 'Rojo teja', 'Lohbraun', 'Kızıl kahve'], '#8cc63f': ['Lime', 'Лайм', 'Lima', 'Limette', 'Limon yeşili'], '#3fb6e8': ['Sky blue', 'Голубой', 'Celeste', 'Himmelblau', 'Gök mavisi'], '#ff6f59': ['Coral', 'Коралловый', 'Coral', 'Koralle', 'Mercan'],
  '#262a31': ['Dark grey', 'Тёмно-серый', 'Gris oscuro', 'Dunkelgrau', 'Koyu gri'], '#5b1f24': ['Antifouling red', 'Тёмно-красный', 'Rojo antifouling', 'Antifouling-Rot', 'Antifouling kırmızısı'],
};
function colourName(c: string, t: (en: string, ru: string, es?: string, de?: string, tr?: string) => string) {
  const k = c.toLowerCase(), p = PRESETS.find((x) => x.boat.hull.toLowerCase() === k), n = NAMES[k];
  return p ? t(p.en, p.ru, p.es, p.de, p.tr) : n ? t(...n) : c;
}

