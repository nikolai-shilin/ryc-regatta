import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { isLang, type Lang } from '@/lib/lang';
import { applyMe } from '@/lib/me';
import { FONT_VARS } from '@/lib/fonts';
import { NotFoundView } from '@/components/not-found-view';
import { Me } from '@/components/me';
import '@/styles/tokens.css';
import '@/styles/ryc.css';
import '@/public/ui/tokens.css';
import '@/styles/broadcast.css';

// The site's 404, for any address no page answers (next.config.ts: experimental.globalNotFound). The root layout is
// under app/[lang]/, so a 404 rendered inside it comes out of the server empty and is drawn in the browser; this one is
// a document of its own, the layout's faces, styles and avatar script with it. Its language is the one proxy.ts chose
// for the address (it hands it on as the request's lang cookie).
async function lang(): Promise<Lang> {
  const l = (await cookies()).get('lang')?.value;
  return isLang(l) ? l : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await lang()) === 'ru' ? 'Страница не найдена · Up and down' : 'Page not found · Up and down', robots: { index: false } };
}

export default async function GlobalNotFound() {
  const l = await lang();
  return (
    <html lang={l} className={FONT_VARS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `;(${applyMe.toString()})();` }} />
      </head>
      <body>
        <NotFoundView lang={l} />
        <Me />
      </body>
    </html>
  );
}
