import { isLang, ruPlural, tx, type Lang } from '@/lib/lang';
import { describe, getResult, ordEn, ordEs } from '@/lib/result';
import { card, C } from '@/lib/og';
import { OG_IMAGE } from '@/lib/seo';

// /og/result/<id>?lang=ru — the picture a shared result link shows in Telegram, WhatsApp, X…, in the logo's look
// (lib/og.tsx): the place on its plate as the leaderboard's and the time beside it, and the call to beat it. A race
// that isn't online (yet) gets the site's own picture. The result page names it in its metadata
// (app/[lang]/race/result/[id]/page.tsx).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const t = tx(lang);
  const res = await getResult(id);
  if (!res) return new Response(null, { status: 302, headers: { location: OG_IMAGE.url, 'cache-control': 'public, max-age=60' } });
  const d = describe(res, lang);
  const img = await card({
    bg: 'drone',
    kind: `${res.daily ? t('Race of the day', 'Гонка дня', 'Regata del día') : t('Custom race', 'Своя гонка', 'Regata personalizada')} · ${t(`${d.boats} boats`, `${d.boats} ${ruPlural(d.boats, ['лодка', 'лодки', 'лодок'])}`, `${d.boats} barcos`)}`,
    tag: { text: d.date.replace(/\.$/, '') },
    hero: d.time
      ? { label: t(`Finished ${ordEn(d.place)} of ${d.boats}`, `Финиш: ${d.place}-е место из ${d.boats}`, `Puesto ${ordEs(d.place)} de ${d.boats}`), value: d.time, plate: { text: t(ordEn(d.place), `${d.place}`, ordEs(d.place)), bg: d.place === 1 ? C.gold : C.you } }
      : { label: t('Result', 'Результат', 'Resultado'), value: t('Disqualified', 'Дисквалификация', 'Descalificado'), color: C.live },
    call: d.call,
  });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, immutable'); // a posted result never changes
  return img;
}
