'use client';
import { useEffect, useState } from 'react';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, saveOpts, DEFAULTS, type Opts } from '@/lib/opts';
import Link from 'next/link';
import { IconArrow, IconSail, IconScreen } from './ui';

type Keys = 'autoTrim' | 'guides' | 'camera' | 'gfx' | 'sound' | 'voice' | 'vibration' | 'music' | 'sea';

// S3 · How you sail and how the game runs. Every change is saved at once where the game reads it.
export function SettingsForm({ lang, langRow, accountRow }: { lang: Lang; langRow: React.ReactNode; accountRow: React.ReactNode }) {
  const t = tx(lang);
  const [o, setO] = useState<Pick<Opts, Keys>>(DEFAULTS);
  useEffect(() => { setO(readOpts()); }, []);
  const set = <K extends Keys>(k: K, v: Opts[K]) => { saveOpts({ [k]: v }); setO((x) => ({ ...x, [k]: v })); };

  const seg = <K extends Keys>(k: K, label: string, opts: [Opts[K], string][]) => (
    <div className="srow">
      <span className="srow-k" id={`l-${k}`}>{label}</span>
      <div className="segc" role="radiogroup" aria-labelledby={`l-${k}`}>
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={o[k] === v} className={o[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{l}</button>
        ))}
      </div>
    </div>
  );
  const sw = (k: 'guides' | 'sound' | 'voice' | 'vibration', label: string, cls = '') => (
    <div className={`srow ${cls}`}>
      <span className="srow-k" id={`l-${k}`}>{label}</span>
      <button type="button" className="tgl" role="switch" aria-checked={!!o[k]} aria-labelledby={`l-${k}`} onClick={() => set(k, o[k] ? 0 : 1)}><i /></button>
    </div>
  );

  return (
    <div className="set-grid">
      <div>
      {accountRow}
      <div className="set-sec">
        <div className="group-k"><IconSail /><span className="kicker">{t('Sailing', 'Яхта')}</span></div>
        {seg('autoTrim', t('Sails', 'Паруса'), [[0, t('I trim', 'Сам')], [1, t('Auto', 'Авто')], [2, t('Main + jib', 'Грот + стаксель')]])}
        {sw('guides', t('Guides on the water', 'Подсказки на воде'))}
        {seg('camera', t('First camera', 'Камера'), [['drone', t('Drone', 'Дрон')], ['top', t('Top', 'Сверху')], ['helm', t('Helm', 'Штурвал')]])}
        <div className="srow">
          <span className="srow-k">{t('Colours, logo and number', 'Цвета, логотип и номер')}</span>
          <Link className="srow-link" href="/boat?from=settings" aria-label={t('Edit your boat', 'Изменить яхту')}>{t('Edit', 'Изменить')}<IconArrow s={14} /></Link>
        </div>
      </div>
      </div>
      <div className="set-sec">
        <div className="group-k"><IconScreen /><span className="kicker">{t('Screen and sound', 'Экран и звук')}</span></div>
        {seg('gfx', t('Graphics', 'Графика'), [['auto', t('Auto', 'Авто')], ['high', t('High', 'Макс.')], ['medium', t('Medium', 'Сред.')], ['low', t('Low', 'Мин.')]])}
        {sw('sound', t('Sound', 'Звук'))}
        {sw('voice', t('Voice on board', 'Голос шкипера'))}
        {seg('music', t('Music', 'Музыка'), [['ambient', t('Ambient', 'Эмбиент')], ['film', t('Film', 'Кино')], ['folk', t('Folk', 'Фолк')], ['racing', t('Racing', 'Гонка')], ['off', t('Off', 'Выкл')]])}
        {seg('sea', t('Sea', 'Море'), [['loud', t('Loud', 'Громко')], ['normal', t('Normal', 'Обычно')], ['quiet', t('Quiet', 'Тихо')], ['off', t('Off', 'Выкл')]])}
        {sw('vibration', t('Vibration', 'Вибрация'), 'no-desk')}
        {langRow}
      </div>
    </div>
  );
}
