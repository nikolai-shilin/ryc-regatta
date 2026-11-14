import type { Lang } from '@/lib/lang';
import { CountUp } from './count-up';

// The RYC logo and the line icons of the design (24px grid, 2px stroke, currentColor).
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} width="50" height="25" viewBox="0 0 50 25" fill="none" role="img" aria-label="RYC">
      <path d="M47.4023 1.25L39.041 11.7197L38.418 12.5L39.041 13.2803L47.4023 23.75H1.25V1.25H47.4023Z" stroke="currentColor" strokeWidth="2.5" />
      <path d="M9.9906 18H7.3866V7.598C7.4846 7.598 7.5826 7.598 7.6806 7.598C7.78327 7.598 7.8836 7.598 7.9816 7.598C8.08427 7.598 8.1846 7.598 8.2826 7.598C8.65594 7.598 9.08527 7.57933 9.5706 7.542C10.0606 7.50467 10.6766 7.486 11.4186 7.486C11.8759 7.486 12.3333 7.53733 12.7906 7.64C13.2479 7.738 13.6656 7.91067 14.0436 8.158C14.4216 8.40067 14.7249 8.73667 14.9536 9.166C15.1823 9.59533 15.2966 10.1367 15.2966 10.79C15.2966 11.4993 15.1776 12.085 14.9396 12.547C14.7063 13.0043 14.3819 13.359 13.9666 13.611C13.5513 13.8583 13.0706 14.024 12.5246 14.108C12.3426 14.1407 12.1606 14.1733 11.9786 14.206C11.7966 14.2387 11.5539 14.2667 11.2506 14.29C10.9519 14.3087 10.5319 14.318 9.9906 14.318V18ZM9.9906 12.512C10.0839 12.526 10.2099 12.5377 10.3686 12.547C10.5273 12.5563 10.6883 12.5633 10.8516 12.568C11.0149 12.568 11.1526 12.568 11.2646 12.568C11.7966 12.568 12.1839 12.4 12.4266 12.064C12.6693 11.7233 12.7906 11.3127 12.7906 10.832C12.7906 10.5753 12.7439 10.3327 12.6506 10.104C12.5619 9.87067 12.3939 9.68167 12.1466 9.537C11.9039 9.39233 11.5539 9.32 11.0966 9.32C10.9099 9.32 10.7186 9.33167 10.5226 9.355C10.3313 9.37367 10.1539 9.404 9.9906 9.446V12.512ZM13.1266 18C13.0706 17.93 13.0169 17.846 12.9656 17.748C12.9189 17.6453 12.8466 17.482 12.7486 17.258C12.6086 16.9453 12.4826 16.6187 12.3706 16.278C12.2586 15.9327 12.1443 15.6107 12.0276 15.312C11.9156 15.0133 11.7849 14.7707 11.6356 14.584C11.4863 14.3927 11.3019 14.2947 11.0826 14.29L11.6846 13.814L13.3366 13.59C13.5979 13.7067 13.8243 13.898 14.0156 14.164C14.2116 14.43 14.3889 14.738 14.5476 15.088C14.7109 15.4333 14.8719 15.795 15.0306 16.173C15.1893 16.5463 15.3666 16.9033 15.5626 17.244C15.6326 17.37 15.7049 17.496 15.7796 17.622C15.8543 17.748 15.9266 17.874 15.9966 18H13.1266ZM19.1217 18V13.856L19.3457 14.78L15.6917 7.598H18.5477L20.0877 10.958L20.7177 12.61H20.3677L20.8997 10.958L22.4677 7.598H25.2257L21.5437 14.794L21.7817 13.856V18H19.1217ZM25.3116 12.82C25.3116 11.938 25.447 11.1657 25.7176 10.503C25.9883 9.83567 26.3663 9.278 26.8516 8.83C27.337 8.382 27.9016 8.046 28.5456 7.822C29.1896 7.598 29.885 7.486 30.6316 7.486C31.1123 7.486 31.5136 7.514 31.8356 7.57C32.1623 7.62133 32.4423 7.67967 32.6756 7.745C32.9136 7.81033 33.1376 7.864 33.3476 7.906L33.0116 10.146C32.9136 10.0807 32.7736 10.0013 32.5916 9.908C32.4143 9.81 32.181 9.726 31.8916 9.656C31.607 9.58133 31.257 9.544 30.8416 9.544C30.3096 9.544 29.829 9.66533 29.3996 9.908C28.9703 10.146 28.6296 10.4983 28.3776 10.965C28.1256 11.427 27.9996 11.994 27.9996 12.666C27.9996 13.352 28.1093 13.9517 28.3286 14.465C28.5526 14.9783 28.884 15.3797 29.3226 15.669C29.7613 15.9537 30.305 16.096 30.9536 16.096C31.2476 16.096 31.5463 16.061 31.8496 15.991C32.153 15.9163 32.426 15.8277 32.6686 15.725C32.9113 15.6223 33.091 15.522 33.2076 15.424V17.566C33.0303 17.6407 32.8203 17.72 32.5776 17.804C32.3396 17.888 32.062 17.9603 31.7446 18.021C31.4273 18.0817 31.0656 18.112 30.6596 18.112C29.5116 18.112 28.5386 17.895 27.7406 17.461C26.9473 17.027 26.343 16.4133 25.9276 15.62C25.517 14.8267 25.3116 13.8933 25.3116 12.82Z" fill="currentColor" />
    </svg>
  );
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const IconBack = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const IconArrow = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconPlay = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} strokeWidth={2.2} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
export const IconRestart = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} strokeWidth={2.2} aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>;
export const IconSliders = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
export const IconHelp = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M9.2 9a3 3 0 0 1 5.6 1.4c0 2-2.8 2.4-2.8 4.1" /><circle cx="12" cy="18.2" r="0.6" fill="currentColor" /></svg>;
export const IconLock = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} strokeWidth={2.2} aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const IconWind = ({ s = 13 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} strokeWidth={2.2} aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" /></svg>;
export const IconSail = ({ s = 18 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M12 3v14M12 4l7 11h-7M12 7l-6 8h6M4 19c2.5 1.5 13.5 1.5 16 0" /></svg>;
export const IconScreen = ({ s = 18 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M8 21h8" /></svg>;
// small marks for kickers and tiles, as rycrentals puts one before a label
export const IconFlag = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
export const IconRoute = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /></svg>;
export const IconLaps = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" /></svg>;
export const IconClock = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M10 2h4" /></svg>;
export const IconPin = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>;
export const IconTide = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M3 9c3-2 6 2 9 0s6-2 9 0M3 15c3-2 6 2 9 0s6-2 9 0" /></svg>;
export const IconSun = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
export const IconBoats = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M8 4v12H3zM16 7v9h-4zM2 19c3 1.5 17 1.5 20 0" /></svg>;
export const IconGrid = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>;
export const IconHull = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M2 11h20l-3 6.5a1 1 0 0 1-.9.5H5.9a1 1 0 0 1-.9-.5z" /></svg>;
export const IconKite = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M6 3v18M6 4c7 1.5 12 7 12 15H6" /></svg>;
export const IconHash = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M5 9h15M4 15h15M10 4 8 20M16 4l-2 16" /></svg>;
export const IconImage = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5L5 20" /></svg>;
export const IconCrew = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20.5a7 7 0 0 1 14 0" /></svg>;
export const IconTrophy = ({ s = 16 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></svg>;
export const IconDevice = ({ s = 16 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>;
export const IconSend = ({ s = 20 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M21 3 3 10.5l7 2.5 2.5 7zM21 3 10 13" /></svg>;
export const IconCheck = ({ s = 18 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconBook = ({ s = 18 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></svg>;
export const IconOut = ({ s = 14 }) => <svg viewBox="0 0 24 24" width={s} height={s} {...S} aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></svg>;
export const IconGoogle = ({ s = 20 }) => (
  <svg viewBox="0 0 48 48" width={s} height={s} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// EN | RU: plain links through /lang, so they work without JavaScript and the game sees the same choice.
export function Langs({ lang, back, className = '' }: { lang: Lang; back: string; className?: string }) {
  // the page itself with ?lang= (proxy.ts keeps the choice as the cookie): a link a search engine follows to the page in
  // the other language, which /lang, a redirect kept out of robots.txt, never was
  const href = (to: Lang) => {
    const u = new URL(back, 'https://x');
    u.searchParams.set('lang', to);
    return u.pathname + u.search + u.hash;
  };
  return (
    <nav className={`langs ${className}`} aria-label={lang === 'ru' ? 'Язык' : 'Language'}>
      <a className={`lang ${lang === 'en' ? 'lang-on' : ''}`} href={href('en')} hrefLang="en" lang="en">EN</a>
      <a className={`lang ${lang === 'ru' ? 'lang-on' : ''}`} href={href('ru')} hrefLang="ru" lang="ru">RU</a>
    </nav>
  );
}

// a number and its unit ("12 kn"), the unit set small after it, as the broadcast sets them; the number counts up the
// first time it's seen
export const Num = ({ v }: { v: string }) => { const [n, ...u] = v.split(' '); return <><CountUp v={n} />{u.length ? <span className="unit">{u.join(' ')}</span> : null}</>; };

export const clock = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
};
