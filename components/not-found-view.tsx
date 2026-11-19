import Link from 'next/link';
import { tx, type Lang } from '@/lib/lang';
import { SiteHead, SiteFoot } from './site-chrome';

// The site's 404 (app/global-not-found.tsx): the site's header and footer round a short note and the ways on
export function NotFoundView({ lang }: { lang: Lang }) {
  const t = tx(lang);
  return (
    <div className="scr help hp bc" lang={lang}>
      <SiteHead lang={lang} t={t} page="result" />
      <header className="hm-page hm-ph">
        <span className="kicker">404</span>
        <h1 className="hm-ph-h">{t('This page isn’t here', 'Такой страницы нет', 'Esta página no está aquí', 'Diese Seite gibt es nicht')}</h1>
        <p className="hm-text">{t('The address may be mistyped, or the page has moved. Today’s race is still on.', 'Возможно, в адресе опечатка или страница переехала. Гонка дня на месте.', 'Puede que la dirección esté mal escrita, o que la página se haya movido. La regata de hoy sigue en marcha.', 'Vielleicht hat sich die Adresse vertippt, oder die Seite ist umgezogen. Die Regatta des Tages läuft trotzdem.')}</p>
        <div className="btn-row">
          <Link className="pill pill-primary pill-s" href="/race"><span className="btn-t">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages')}</span></Link>
          <Link className="pill pill-s" href="/"><span className="btn-t">{t('Home', 'Главная', 'Inicio', 'Start')}</span></Link>
        </div>
      </header>
      <SiteFoot lang={lang} t={t} back="/" />
    </div>
  );
}
