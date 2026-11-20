import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type { Lang, T } from '@/lib/lang';
import { SITE, jsonLd, langUrl } from '@/lib/seo';
import { Logo, Langs } from './ui';
import { SiteMenu } from './home-client';
import '@/styles/first-race.css';

type Page = 'home' | 'help' | 'faq' | 'race' | 'free' | 'boat' | 'result' | 'settings' | 'signin' | 'iyt' | 'learn' | 'rating' | 'drills' | 'social' | 'players' | 'venues' | 'yachts' | 'sponsorship' | 'rulebook';

// Where each page sits under Home, for the breadcrumb trail search engines show instead of the bare address
// (BreadcrumbList). A guide passes its own trail: Home › Racing guides › the guide.
export type Crumb = [name: string, path: string];
const CRUMBS: Partial<Record<Page, [en: string, ru: string, path: string, es?: string, de?: string, tr?: string, fr?: string, it?: string]>> = {
  help: ['How to play', 'Как играть', '/help', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca'], faq: ['FAQ', 'Вопросы и ответы', '/faq', 'Preguntas', 'Fragen', 'Sorular', 'FAQ', 'Domande frequenti'], race: ['Today’s race', 'Гонка дня', '/race', 'La regata del día', 'Die Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno'],
  free: ['Custom race', 'Своя гонка', '/race/free', 'Regata libre', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera'], boat: ['Your yacht', 'Твоя яхта', '/boat', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht', 'Il tuo yacht'],
  iyt: ['Sailing exam practice', 'Тренажёр к яхтенному экзамену', '/iyt', 'Práctica de examen de vela', 'Prüfungstraining Segeln', 'Yelken sınavı alıştırması', 'Révisions pour les examens de voile', 'Preparazione all’esame di vela'], learn: ['Racing guides', 'Пособия по гонкам', '/learn', 'Guías de regata', 'Regatta-Leitfäden', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata'],
  drills: ['Drills', 'Тренировки', '/race/drills', 'Ejercicios', 'Übungen', 'Alıştırmalar', 'Entraînements', 'Esercizi'],
  social: ['Social media', 'Соцсети', '/social', 'Redes sociales', 'Soziale Medien', 'Sosyal medya', 'Réseaux sociaux', 'Social'], players: ['The players', 'Игроки', '/players', 'Los jugadores', 'Die Spieler', 'Oyuncular', 'Les joueurs', 'I giocatori'],
  venues: ['The venues', 'Акватории', '/venues', 'Las sedes', 'Die Reviere', 'Yarış alanları', 'Les plans d’eau', 'I campi di regata'], yachts: ['The yachts', 'Яхты', '/yachts', 'Los yates', 'Die Yachten', 'Yatlar', 'Les yachts', 'Gli yacht'],
  sponsorship: ['Sponsorship', 'Спонсорство', '/sponsorship', 'Patrocinio', 'Sponsoring', 'Sponsorluk', 'Sponsoring', 'Sponsorizzazione'], rulebook: ['Racing rules', 'Правила гонок', '/rulebook', 'Reglas de regata', 'Wettfahrtregeln', 'Yarış kuralları', 'Règles de course', 'Regole di regata'],
};
function Breadcrumbs({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const c = CRUMBS[page];
  const trail: Crumb[] = crumbs || (c ? [[t(c[0], c[1], c[3], c[4], c[5], c[6], c[7]), c[2]]] : []);
  if (!trail.length) return null;
  const items = [[t('Home', 'Главная', 'Inicio', 'Start', 'Ana sayfa', 'Accueil', 'Home'), '/'] as Crumb, ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + langUrl(path, lang) }));
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })} />;
}

// The same trail where the reader sees it, over a guide's or the glossary's head: without Home (the name in the header
// goes there), the last step the page itself.
export function Trail({ t, crumbs }: { t: T; crumbs: Crumb[] }) {
  return (
    <nav className="rd-trail" aria-label={t('Breadcrumb', 'Навигационная цепочка', 'Ruta de navegación', 'Brotkrümelnavigation', 'Gezinti yolu', 'Fil d’Ariane', 'Percorso di navigazione')}>
      {crumbs.map(([name, path], i) => (i < crumbs.length - 1
        ? <Fragment key={path}><Link href={path}>{name}</Link><span aria-hidden="true">/</span></Fragment>
        : <span key={path} aria-current="page">{name}</span>))}
    </nav>
  );
}

// The site's header, as on rycrentals.com: the logo, the site's pages in the middle (from 1100 px wide), and the menu
// (the burger and your avatar) at the right; your account, your boat and passport, Drills, Players, Venues, Yachts,
// How to play, Racing guides, Racing rules and FAQ are in the menu alone. On a page in the broadcast look (.bc,
// styles/broadcast.css) it is the broadcast's bar: the name with the blue mark, the pages as tabs (from 1280 px wide),
// Sign in (a guest's) and Play now beside the menu. On every page: the scrolling ones (home, help, the race result) and the
// app screens, where it sits over the screen and stays short on a phone held sideways.
// Who is signed in isn't known here (the pages are cached): the avatar and the account link are filled in by lib/me.ts.
export function SiteHead({ lang, t, page, crumbs }: { lang: Lang; t: T; page: Page; crumbs?: Crumb[] }) {
  const cur = (p: Page) => (p === page ? ({ 'aria-current': 'page' } as const) : {});
  return (
    <header className="hm-head">
      <Breadcrumbs lang={lang} t={t} page={page} crumbs={crumbs} />
      <div className="hm-page hm-head-in">
        <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /><span className="hm-brand-t">Up and down</span></Link>
        <nav className="hm-nav" aria-label={t('Main', 'Главное', 'Principal', 'Hauptmenü', 'Ana', 'Principal', 'Principale')}>
          {/* the easy race, an Optimist's three minutes, first: the way in for a newcomer, and back to it for anyone (public/game/classes.js firstRaceHere) */}
          <a className="hm-tab hm-tab-first" href="/play?race=first&intro">{t('First race', 'Первая гонка', 'Primera regata', 'Erste Regatta', 'İlk yarış', 'Première régate', 'Prima regata')}<span className="hm-tag">{t('3 min', '3 мин', '3 min', '3 Min.', '3 dk', '3 min', '3 min')}</span></a>
          <Link className="hm-tab" href="/race" {...cur('race')}>{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno')}</Link>
          <Link className="hm-tab" href="/race/free" {...cur('free')}>{t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera')}</Link>
          <Link className="hm-tab" href="/match/new">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1')}</Link>
          <Link className="hm-tab" href="/race/rating" {...cur('rating')}>{t('Leaderboard', 'Рейтинг', 'Clasificación', 'Rangliste', 'Sıralama', 'Classement', 'Classifica')}</Link>
        </nav>
        {/* a guest's way to sign in, in the bar where there's room (else in the menu); signed in, the avatar says who */}
        <Link className="hm-signin if-guest" href="/sign-in" {...cur('signin')}>{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi')}</Link>
        {/* the broadcast look's way in, always at hand (hidden in the old look, styles/ryc.css) */}
        <a className="hm-play" href="/play?race=today">{t('Play now', 'Играть', 'Jugar ya', 'Jetzt spielen', 'Şimdi oyna', 'Jouer maintenant', 'Gioca ora')}</a>
        <SiteMenu lang={lang} />
      </div>
    </header>
  );
}

function FootGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="hm-foot-g"><h2 className="hm-foot-h">{title}</h2><ul>{children}</ul></div>;
}
function FootLink({ href, only, children }: { href: string; only?: 'if-guest'; children: ReactNode }) {
  return <li className={only}><Link href={href}>{children}</Link></li>;
}

// The site's footer, the map of the site: the name, who makes it and the language switch, then every page that stands
// on its own in five columns (a venue, a yacht or a guide is found from its list); under them, that the game has nothing
// to do with the America's Cup, whose boat it sails (the AC75). Your account follows the menu: Settings for everyone, and
// Sign in for a guest.
export function SiteFoot({ lang, t, back }: { lang: Lang; t: T; back: string }) {
  return (
    <div className="hm-page hm-foot-wrap">
      <footer className="hm-foot">
        <div className="hm-foot-id">
          <Link className="hm-brand" href="/" aria-label="RYC · Up and down"><Logo /><span className="hm-brand-t">Up and down</span></Link>
          <span className="hm-foot-by">{t('RYC race office', 'Офис регаты RYC', 'Oficina de regatas del RYC', 'RYC-Regattabüro', 'RYC yarış ofisi', 'Secrétariat de course du RYC', 'Segreteria di regata RYC')}</span>
        </div>
        <Langs lang={lang} back={back} />
        <nav className="hm-foot-map" aria-label={t('All pages', 'Все страницы', 'Todas las páginas', 'Alle Seiten', 'Tüm sayfalar', 'Toutes les pages', 'Tutte le pagine')}>
          <FootGroup title={t('Race', 'Гонки', 'Regata', 'Regatta', 'Yarış', 'Régater', 'Regata')}>
            <li><a href="/play?race=first&intro">{t('First race', 'Первая гонка', 'Primera regata', 'Erste Regatta', 'İlk yarış', 'Première régate', 'Prima regata')}</a></li>
            <FootLink href="/race">{t('Today’s race', 'Гонка дня', 'La regata del día', 'Regatta des Tages', 'Günün yarışı', 'La régate du jour', 'La regata del giorno')}</FootLink>
            <FootLink href="/race/free">{t('Custom race', 'Своя гонка', 'Regata personalizada', 'Freie Regatta', 'Serbest yarış', 'Régate libre', 'Regata libera')}</FootLink>
            <FootLink href="/match/new">{t('1-on-1 race', 'Гонка 1 на 1', 'Regata 1 contra 1', '1-gegen-1-Regatta', 'Bire bir yarış', 'Duel 1 contre 1', 'Duello 1 contro 1')}</FootLink>
            <FootLink href="/race/drills">{t('Drills', 'Тренировки', 'Ejercicios', 'Übungen', 'Alıştırmalar', 'Entraînements', 'Esercizi')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Explore', 'Мир игры', 'Explorar', 'Entdecken', 'Keşfet', 'Explorer', 'Esplora')}>
            <FootLink href="/race/rating">{t('Leaderboard', 'Рейтинг', 'Clasificación', 'Rangliste', 'Sıralama', 'Classement', 'Classifica')}</FootLink>
            <FootLink href="/players">{t('Players', 'Игроки', 'Jugadores', 'Spieler', 'Oyuncular', 'Joueurs', 'Giocatori')}</FootLink>
            <FootLink href="/venues">{t('Venues', 'Акватории', 'Sedes', 'Reviere', 'Yarış alanları', 'Plans d’eau', 'Campi di regata')}</FootLink>
            <FootLink href="/yachts">{t('Yachts', 'Яхты', 'Yates', 'Yachten', 'Yatlar', 'Yachts', 'Yacht')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Learn', 'Обучение', 'Aprender', 'Lernen', 'Öğren', 'Apprendre', 'Impara')}>
            <FootLink href="/help">{t('How to play', 'Как играть', 'Cómo jugar', 'So spielst du', 'Nasıl oynanır', 'Comment jouer', 'Come si gioca')}</FootLink>
            <FootLink href="/learn">{t('Racing guides', 'Пособия по гонкам', 'Guías de regatas', 'Regatta-Anleitungen', 'Yarış rehberleri', 'Guides de régate', 'Guide alla regata')}</FootLink>
            <FootLink href="/rulebook">{t('Racing rules', 'Правила гонок', 'Reglas de regatas', 'Wettfahrtregeln', 'Yarış kuralları', 'Règles de course', 'Regole di regata')}</FootLink>
            <FootLink href="/learn/glossary">{t('Glossary', 'Словарь', 'Glosario', 'Glossar', 'Sözlük', 'Glossaire', 'Glossario')}</FootLink>
            <FootLink href="/iyt">{t('Sailing exam practice', 'Тренажёр к яхтенному экзамену', 'Práctica del examen de vela', 'Prüfungsvorbereitung Segeln', 'Yelken sınavı alıştırması', 'Révisions pour les examens de voile', 'Preparazione all’esame di vela')}</FootLink>
            <FootLink href="/faq">{t('FAQ', 'Вопросы и ответы', 'Preguntas', 'FAQ', 'SSS', 'FAQ', 'Domande frequenti')}</FootLink>
          </FootGroup>
          <FootGroup title={t('Your account', 'Твой аккаунт', 'Tu cuenta', 'Dein Konto', 'Hesabın', 'Ton compte', 'Il tuo account')}>
            <FootLink href="/sign-in" only="if-guest">{t('Sign in', 'Войти', 'Iniciar sesión', 'Anmelden', 'Giriş yap', 'Se connecter', 'Accedi')}</FootLink>
            <FootLink href="/boat">{t('Your yacht', 'Твоя яхта', 'Tu yate', 'Deine Yacht', 'Yatın', 'Ton yacht', 'Il tuo yacht')}</FootLink>
            <FootLink href="/players?me=1">{t('Your player card', 'Твоя карточка игрока', 'Tu tarjeta de jugador', 'Deine Spielerkarte', 'Oyuncu kartın', 'Ta carte de joueur', 'La tua tessera del giocatore')}</FootLink>
            <FootLink href="/settings">{t('Settings', 'Настройки', 'Ajustes', 'Einstellungen', 'Ayarlar', 'Réglages', 'Impostazioni')}</FootLink>
          </FootGroup>
          <FootGroup title={t('About', 'О проекте', 'Acerca de', 'Über uns', 'Hakkında', 'À propos', 'Info')}>
            <FootLink href="/social">{t('Social media', 'Соцсети', 'Redes sociales', 'Soziale Medien', 'Sosyal medya', 'Réseaux sociaux', 'Social')}</FootLink>
            <FootLink href="/sponsorship">{t('Sponsorship', 'Спонсорство', 'Patrocinio', 'Sponsoring', 'Sponsorluk', 'Sponsoring', 'Sponsorizzazione')}</FootLink>
            <li><a href="https://www.rycrentals.com/">RYC Rentals</a></li>
            <li><a href="https://www.rycsailing.com/">RYC Sailing</a></li>
          </FootGroup>
        </nav>
        <p className="hm-foot-note">{t('This simulator is an independent project and is not affiliated with, sponsored by, or endorsed by America’s Cup or its organizers.',
          'Этот симулятор — независимый проект, не связанный с America’s Cup и его организаторами, не спонсируемый и не одобренный ими.', 'Este simulador es un proyecto independiente y no está afiliado, patrocinado ni respaldado por la Copa América ni por sus organizadores.', 'Dieser Simulator ist ein unabhängiges Projekt und steht in keiner Verbindung zum America’s Cup oder seinen Veranstaltern und wird weder von ihnen gesponsert noch unterstützt.', 'Bu simülatör bağımsız bir projedir; America’s Cup ya da organizatörleriyle bağlantılı değildir, onlar tarafından desteklenmemekte ya da onaylanmamıştır.', 'Ce simulateur est un projet indépendant, sans lien avec l’America’s Cup ni ses organisateurs, qui ne le parrainent ni ne le cautionnent.', 'Questo simulatore è un progetto indipendente e non è affiliato, sponsorizzato o approvato dall’America’s Cup o dai suoi organizzatori.')}</p>
      </footer>
    </div>
  );
}
