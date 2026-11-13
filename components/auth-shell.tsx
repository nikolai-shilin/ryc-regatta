import Image from 'next/image';
import type { Lang } from '@/lib/lang';

// A1–A3: the course from above beside (or above, on a phone held upright) the form.
export function AuthShell({ lang, caption, children }: { lang: Lang; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="scr" lang={lang}>
      <div className="lay split split-auth">
        <div className="split-photo">
          <Image className="bgimg" src="/images/top.jpg" alt="" fill priority sizes="(orientation: portrait) 100vw, 50vw" />
          <div className="photo-fade" />
          {caption && <div className="cap no-port">{caption}</div>}
        </div>
        <div className="split-panel">{children}</div>
      </div>
    </div>
  );
}
