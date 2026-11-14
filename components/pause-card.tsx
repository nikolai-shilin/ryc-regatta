'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { readOpts, saveOpts, DEFAULTS, type Opts } from '@/lib/opts';
import { IconScreen, IconSail, IconCrew } from './ui';

// Who is signed in, as the card's settings show them (from the server's account)
export type Who = { name: string; email: string; via: string; initials: string } | null;

const Open = createContext<(open: boolean) => void>(() => {});

// The glass card of the pages laid out as the race's pause screen (the race hub, the free race's set-up). Like the
// pause menu it has a second view: Settings opens in the card itself, in place of what it holds, and Back returns to it,
// without leaving the page. back: this page's own path, for the language switch and signing in to come back to.
export function PauseCard({ lang, who, back, label, children }: { lang: Lang; who: Who; back: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);
  return (
    <section className="bt-card" ref={card} aria-label={label}>
      <Open.Provider value={setOpen}>
        <div className="bt-view" hidden={open}>{children}</div>
        {open && <Settings lang={lang} who={who} back={back} close={() => setOpen(false)} />}
      </Open.Provider>
    </section>
  );
}

// the row that opens them, as the pause menu's rows
export function SettingsRow({ lang }: { lang: Lang }) {
  const open = useContext(Open), t = tx(lang);
  return <button type="button" className="bt-row" onClick={() => open(true)}><IconScreen /><span>{t('Settings', 'Настройки')}</span></button>;
}

type Keys = 'autoTrim' | 'guides' | 'camera' | 'gfx' | 'sound' | 'voice' | 'vibration';

// How you sail and how the game runs, as /settings has them: every change is saved at once where the game reads it
function Settings({ lang, who, back, close }: { lang: Lang; who: Who; back: string; close: () => void }) {
  const t = tx(lang), to = encodeURIComponent(back);
  const [o, setO] = useState<Pick<Opts, Keys>>(DEFAULTS);
  const [touch, setTouch] = useState(false);
  useEffect(() => { setO(readOpts()); setTouch(matchMedia('(pointer: coarse)').matches); }, []);
  const set = <K extends Keys>(k: K, v: Opts[K]) => { saveOpts({ [k]: v }); setO((x) => ({ ...x, [k]: v })); };

  const seg = <K extends Keys>(k: K, label: string, opts: [Opts[K], string][]) => (
    <div className="bt-part">
      <span className="bt-sub" id={`st-${k}`}>{label}</span>
      <div className="bt-seg" style={{ ['--n' as string]: opts.length }} role="radiogroup" aria-labelledby={`st-${k}`}>
        {opts.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={o[k] === v} onClick={() => set(k, v)}>{l}</button>)}
      </div>
    </div>
  );
  const sw = (k: 'guides' | 'sound' | 'voice' | 'vibration', label: string) => (
    <button key={k} type="button" role="switch" aria-checked={!!o[k]} className="bt-pill" onClick={() => set(k, o[k] ? 0 : 1)}>{label}</button>
  );

  return (
    <div className="bt-view bt-set">
      <button type="button" className="bt-row bt-row-back" onClick={close} autoFocus><span>{t('Settings', 'Настройки')}</span><span className="bt-row-m">{t('Back', 'Назад')}</span></button>

      <div className="bt-g">
        <span className="bt-k"><IconSail s={13} />{t('Sailing', 'Яхта')}</span>
        {seg('autoTrim', t('Sails', 'Паруса'), [[0, t('I trim', 'Сам')], [1, t('Auto', 'Авто')], [2, t('Main + jib', 'Грот + стаксель')]])}
        {seg('camera', t('First camera', 'Камера'), [['drone', t('Drone', 'Дрон')], ['top', t('Top', 'Сверху')], ['helm', t('Helm', 'Штурвал')]])}
        <div className="bt-pills">{sw('guides', t('Guides on the water', 'Подсказки на воде'))}</div>
      </div>

      <div className="bt-g">
        <span className="bt-k"><IconScreen />{t('Screen and sound', 'Экран и звук')}</span>
        {seg('gfx', t('Graphics', 'Графика'), [['auto', t('Auto', 'Авто')], ['high', t('High', 'Макс.')], ['medium', t('Medium', 'Сред.')], ['low', t('Low', 'Мин.')]])}
        <div className="bt-pills">
          {sw('sound', t('Sound', 'Звук'))}
          {sw('voice', t('Voice on board', 'Голос шкипера'))}
          {touch && sw('vibration', t('Vibration', 'Вибрация'))}
        </div>
      </div>

      <div className="bt-g">
        <span className="bt-k" id="st-lang">{t('Language', 'Язык')}</span>
        <nav className="bt-seg" style={{ ['--n' as string]: 2 }} aria-labelledby="st-lang">
          <a href={`/lang?to=en&back=${to}`} aria-current={lang === 'en' ? 'true' : undefined}>English</a>
          <a href={`/lang?to=ru&back=${to}`} aria-current={lang === 'ru' ? 'true' : undefined}>Русский</a>
        </nav>
      </div>

      <div className="bt-g">
        <span className="bt-k"><IconCrew />{t('Account', 'Аккаунт')}</span>
        {who ? (
          <div className="bt-acct">
            <span className="bt-av">{who.initials}</span>
            <span className="bt-acct-t"><b>{who.name || who.email}</b><small>{[who.email, who.via].filter(Boolean).join(' · ')}</small></span>
            <Link className="bt-mini" href={`/sign-in/name?next=${to}`}>{t('Name', 'Имя')}</Link>
            <form action="/auth/sign-out" method="post"><button className="bt-mini" type="submit">{t('Sign out', 'Выйти')}</button></form>
          </div>
        ) : (
          <div className="bt-acct">
            <span className="bt-acct-t"><b>{t('Guest', 'Гость')}</b><small>{t('Times stay on this device', 'Результаты только на этом устройстве')}</small></span>
            <Link className="bt-mini bt-mini-on" href={`/sign-in?next=${to}`}>{t('Sign in', 'Войти')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
