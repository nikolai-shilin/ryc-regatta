import Image from 'next/image';
import { tx, type Lang } from '@/lib/lang';
import { SiteHead } from './site-chrome';

// A1–A3: under the site header, the course from above beside (or above, on a phone held upright) the form.
// Nobody is signed in on these pages (sign-in sends a signed-in visitor on).
export function AuthShell({ lang, caption, children }: { lang: Lang; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="scr app bc" lang={lang}>
      <SiteHead lang={lang} t={tx(lang)} page="signin" />
      <div className="lay split split-auth">
        <div className="split-photo">
          <Image className="bgimg" src="/images/top-v3.jpg" alt="" fill priority sizes="(orientation: portrait) 100vw, 50vw" />
          <div className="photo-fade" />
          {caption && <div className="cap no-port">{caption}</div>}
        </div>
        <div className="split-panel">{children}</div>
      </div>
    </div>
  );
}
