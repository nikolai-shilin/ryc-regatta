'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tx, type Lang } from '@/lib/lang';
import { supabaseBrowser } from '@/lib/supabase/client';
import { sponsorChanged } from '@/app/[lang]/admin/actions';
import { IconArrow, IconImage } from './ui';

// The ad on every boat's jib (public/game/yacht.js draws it low on the jib, at most 2 × 1 m): a picture in the
// public bucket regatta-ads and its address in public.regatta_settings 'jib_ad', which /sponsor hands the game.
// Each upload gets a new name, so no cache anywhere keeps the old one; the old file is removed once the new one is set.
const BUCKET = 'regatta-ads', KEY = 'jib_ad', MAX = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export function AdminForm({ lang, current }: { lang: Lang; current: { url: string; path?: string } | null }) {
  const t = tx(lang);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const shown = preview || current?.url || null;

  const pick = (f: File | undefined) => {
    setErr(''); setDone('');
    if (!f) return;
    if (!TYPES[f.type]) return setErr(t('A PNG, JPEG, WebP or SVG picture, please.', 'Нужна картинка PNG, JPEG, WebP или SVG.'));
    if (f.size > MAX) return setErr(t('Up to 2 MB, please.', 'Не больше 2 МБ.'));
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
    const path = `jib/${Date.now()}.${TYPES[file.type]}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (up.error) { setBusy(false); return setErr(up.error.message); }
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const row = await sb.from('regatta_settings').upsert({ key: KEY, value: { url, path }, updated_at: new Date().toISOString() });
    if (row.error) { await sb.storage.from(BUCKET).remove([path]); setBusy(false); return setErr(row.error.message); }
    if (current?.path) await sb.storage.from(BUCKET).remove([current.path]);
    await finish(t('Saved. Every boat carries it from the next race.', 'Сохранено. Со следующей гонки она на каждой яхте.'));
    setBusy(false);
  };
  const clear = async () => {
    setBusy(true); setErr(''); setDone('');
    const sb = supabaseBrowser();
    const row = await sb.from('regatta_settings').delete().eq('key', KEY);
    if (row.error) { setBusy(false); return setErr(row.error.message); }
    if (current?.path) await sb.storage.from(BUCKET).remove([current.path]);
    await finish(t('Removed. The jibs are plain again.', 'Убрано. Стаксели снова чистые.'));
    setBusy(false);
  };

  return (
    <div className="set-grid">
      <div className="set-sec">
        <div className="group-k"><IconImage /><span className="kicker">{t('On every jib', 'На каждом стакселе')}</span></div>
        <div className="adm-prev" aria-label={t('How it reads on white and on black sails', 'Как она смотрится на белых и чёрных парусах')}>
          {['#f4f2ea', '#2a2c30'].map((c) => (
            <div key={c} className="adm-sail" style={{ background: c }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shown ? <img src={shown} alt="" /> : <span className="hint">{t('No ad', 'Без рекламы')}</span>}
            </div>
          ))}
        </div>
        <p className="hint">{t('A wide logo on a transparent background reads best: up to 2 m wide and 1 m tall on the sail, low under the battens, on your boat and every computer boat.', 'Лучше всего читается широкий логотип на прозрачном фоне: до 2 м в ширину и 1 м в высоту, низко под латами, на вашей яхте и на всех соперниках.')}</p>
      </div>
      <div className="set-sec">
        <div className="srow">
          <label className="srow-k" htmlFor="adm-file">{t('Picture', 'Картинка')}</label>
          <input id="adm-file" type="file" accept={Object.keys(TYPES).join(',')} disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <div className="btn-row adm-go">
          <button type="button" className="pill pill-primary pill-xs" disabled={!file || busy} onClick={save}><span className="btn-t">{busy && file ? t('Saving…', 'Сохраняю…') : t('Put it on the jibs', 'Поставить на стаксели')}</span></button>
          {current && <button type="button" className="pill pill-quiet pill-xs" disabled={busy} onClick={clear}><span className="btn-t">{t('Remove the ad', 'Убрать рекламу')}</span></button>}
        </div>
        {err ? <p className="err" role="alert">{err}</p> : done ? <p className="hint" role="status">{done}</p> : null}
        <div className="srow">
          <span className="srow-k">{t('See it on the water', 'Посмотреть на воде')}</span>
          <a className="srow-link" href="/boat">{t('Your boat', 'Ваша яхта')}<IconArrow s={14} /></a>
        </div>
      </div>
    </div>
  );
}
