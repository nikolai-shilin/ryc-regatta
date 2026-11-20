'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { IconBoats, IconCrew, IconPin, IconSail, IconScreen } from './ui';
import { useWho } from './me';
import { AvButton, AvRow } from './av-row';
import { SailingOpts } from './sailing-opts';

// what a panel's foot leads to: your boat, the yachts (the yachts' own page has the venues there instead), and Settings
const FOOT = {
  boat: { href: '/boat', ico: <IconSail s={18} />, name: ['Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht'] },
  yachts: { href: '/yachts', ico: <IconBoats s={18} />, name: ['The yachts', 'Яхты', 'Los yates', 'Die Yachten', 'Yatlar', 'Les yachts'] },
  venues: { href: '/venues', ico: <IconPin s={18} />, name: ['The venues', 'Акватории', 'Las sedes', 'Die Reviere', 'Yarış alanları', 'Les plans d’eau'] },
} as const;
type FootKey = keyof typeof FOOT;

// The panel of the pages over a 3D scene (the race hub, the free race's set-up, the yachts, the venues, the players),
// the same way down on each: the head (what it holds, and Audio & graphics a tap away), the page's one action if it has
// one, what it holds, the only part that scrolls, and the foot. Like the race's pause menu it has a second view:
// Settings opens in the panel itself, in place of what it holds, and Back returns to it, without leaving the page.
// back: this page's own path, for the language switch and signing in to come back to. note: a word by the title; tools:
// the page's own control in the head; foot: the two links before Settings, each a key or a key and its own address.
export function PauseCard({ lang, back, title, icon, note, tools, action, foot = ['boat', 'yachts'], cardRef, className = '', busy, children }: {
  lang: Lang; back: string; title: string; icon?: ReactNode; note?: ReactNode; tools?: ReactNode; action?: ReactNode;
  foot?: (FootKey | [FootKey, string])[]; cardRef?: RefObject<HTMLElement | null>; className?: string; busy?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null), id = useId(), t = tx(lang);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);
  return (
    <section className={`bt-card bt-docked ${className}`.trim()} ref={cardRef} aria-labelledby={id} aria-busy={busy}>
      <div className="bt-card-h">
        <span className="lbl-ink bt-card-t" id={id} title={title}>{icon}<span>{title}</span></span>
        {note && <span className="lbl bt-card-n">{note}</span>}
        <span className="bt-card-tools">{tools}<AvButton lang={lang} /></span>
      </div>
      {action && !open && <div className="bt-dock bt-dock-t">{action}</div>}
      <div className="bt-body" ref={body}>
        <div className="bt-view" hidden={open}>{children}</div>
        {open && <Settings lang={lang} back={back} close={() => setOpen(false)} />}
      </div>
      {!open && (
        <div className="bt-dock bt-dock-b">
          <div className="bt-rows">
            {foot.map((f) => {
              const [k, href] = typeof f === 'string' ? [f, FOOT[f].href] : f;
              return <Link key={k} className="bt-row" href={href}>{FOOT[k].ico}<span>{t(FOOT[k].name[0], FOOT[k].name[1], FOOT[k].name[2], FOOT[k].name[3], FOOT[k].name[4], FOOT[k].name[5])}</span></Link>;
            })}
            <button type="button" className="bt-row" onClick={() => setOpen(true)}><IconScreen /><span>{t('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages')}</span></button>
          </div>
        </div>
      )}
    </section>
  );
}

// How you sail, as /settings has it, and the way to Audio & graphics; the language and the account
// the account: who is signed in, read from the session cookie (the pages with this card are cached for everyone)
function Settings({ lang, back, close }: { lang: Lang; back: string; close: () => void }) {
  const who = useWho(lang);
  const t = tx(lang), to = encodeURIComponent(back);

  return (
    <div className="bt-view bt-set">
      <button type="button" className="bt-row bt-row-back" onClick={close} autoFocus><span>{t('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages')}</span><span className="bt-row-m">{t('Back', 'Назад', 'Atrás', 'Zurück', 'Geri', 'Retour')}</span></button>

      <div className="bt-g">
        <span className="bt-k"><IconSail s={13} />{t('Sailing', 'Яхта', 'Navegando', 'Segeln', 'Yelken', 'Navigation')}</span>
        <SailingOpts lang={lang} />
      </div>

      <div className="bt-rows"><AvRow lang={lang} /></div>

      <div className="bt-g">
        <span className="bt-k" id="st-lang">{t('Language', 'Язык', 'Idioma', 'Sprache', 'Dil', 'Langue')}</span>
        <nav className="bt-seg" style={{ ['--n' as string]: 6 }} aria-labelledby="st-lang">
          <a href={`/lang?to=en&back=${to}`} aria-current={lang === 'en' ? 'true' : undefined} lang="en">English</a>
          <a href={`/lang?to=ru&back=${to}`} aria-current={lang === 'ru' ? 'true' : undefined} lang="ru">Русский</a>
          <a href={`/lang?to=es&back=${to}`} aria-current={lang === 'es' ? 'true' : undefined} lang="es">Español</a>
          <a href={`/lang?to=de&back=${to}`} aria-current={lang === 'de' ? 'true' : undefined} lang="de">Deutsch</a>
          <a href={`/lang?to=tr&back=${to}`} aria-current={lang === 'tr' ? 'true' : undefined} lang="tr">Türkçe</a>
          <a href={`/lang?to=fr&back=${to}`} aria-current={lang === 'fr' ? 'true' : undefined} lang="fr">Français</a>
        </nav>
      </div>

      <div className="bt-g">
        <span className="bt-k"><IconCrew />{t('Account', 'Аккаунт', 'Cuenta', 'Konto', 'Hesap', 'Compte')}</span>
        {who ? (
          <div className="bt-acct">
            <span className="bt-av">{who.initials}</span>
            <span className="bt-acct-t"><b>{who.name || who.email}</b><small>{[who.email, who.via].filter(Boolean).join(' · ')}</small></span>
            <Link className="bt-mini" href={`/sign-in/name?next=${to}`}>{t('Name', 'Имя', 'Nombre', 'Name', 'İsim', 'Nom')}</Link>
            <form action="/auth/sign-out" method="post"><button className="bt-mini" type="submit">{t('Sign out', 'Выйти', 'Cerrar sesión', 'Abmelden', 'Çıkış yap', 'Se déconnecter')}</button></form>
          </div>
        ) : (
          <div className="bt-acct">
            <span className="bt-acct-t"><b>{t('Guest', 'Гость', 'Invitado', 'Gast', 'Misafir', 'Invité')}</b><small>{t('Times stay on this device', 'Результаты только на этом устройстве', 'Los tiempos se quedan en este dispositivo', 'Zeiten bleiben auf diesem Gerät', 'Süreler bu cihazda kalır', 'Les temps restent sur cet appareil')}</small></span>
            <Link className="bt-mini bt-mini-on" href={`/sign-in?next=${to}`}>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
