import { isLang, type Lang } from '@/lib/lang';
import { describe, getResult } from '@/lib/result';
import { card, CourseSvg } from '@/lib/og';
import { OG_IMAGE } from '@/lib/seo';

// /og/result/<id>?lang=ru — the picture a shared result link shows in Telegram, WhatsApp, X…: the place and the time
// and the call to beat it, beside every boat's track on the course (lib/og.tsx). A race that isn't online (yet) gets
// the site's own picture. The result page names it in its metadata (app/[lang]/race/result/[id]/page.tsx).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const res = await getResult(id);
  if (!res) return new Response(null, { status: 302, headers: { location: OG_IMAGE.url, 'cache-control': 'public, max-age=60' } });
  const d = describe(res, lang);
  const img = await card({ ...d, panel: <CourseSvg course={res.course} tracks={res.boats.map((b) => ({ pts: b.track || [], me: b.me }))} /> });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, immutable'); // a posted result never changes
  return img;
}
