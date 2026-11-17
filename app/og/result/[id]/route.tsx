import { isLang, ruPlural, tx, type Lang } from '@/lib/lang';
import { describe, getResult, ordEn } from '@/lib/result';
import { card, CourseSvg, C } from '@/lib/og';
import { OG_IMAGE } from '@/lib/seo';

// /og/result/<id>?lang=ru — the picture a shared result link shows in Telegram, WhatsApp, X…, in the logo's look
// (lib/og.tsx): the place on its plate as the leaderboard's and the time beside it, the wind, the fleet, the laps and
// the length as the lower third, the call to beat it, and every boat's track on the course map, yours in blue. A race
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
  const laps = t(res.laps > 1 ? 'laps' : 'lap', res.laps > 1 ? 'круга' : 'круг');
  const img = await card({
    kind: res.daily ? t('Race of the day', 'Гонка дня') : t('Free race', 'Свободная гонка'),
    tag: { text: d.date.replace(/\.$/, '') },
    hero: d.time
      ? { label: t(`Finished ${ordEn(d.place)} of ${d.boats}`, `Финиш: ${d.place}-е место из ${d.boats}`), value: d.time, plate: { text: t(ordEn(d.place), `${d.place}`), bg: d.place === 1 ? C.gold : C.you } }
      : { label: t('Result', 'Результат'), value: t('Disqualified', 'Дисквалификация'), color: C.live },
    cells: [
      { label: t('Wind', 'Ветер'), value: d.kn, unit: t('kn', 'уз') },
      { label: t('Fleet', 'Флот'), value: d.boats, unit: t('boats', ruPlural(d.boats, ['лодка', 'лодки', 'лодок'])) },
      { label: t('Laps', 'Круги'), value: res.laps, unit: laps },
      ...(d.length ? [{ label: t('Course', 'Дистанция'), value: d.length }] : []),
    ],
    call: d.call,
    panel: {
      title: t('Course', 'Дистанция'), aside: d.shape,
      body: <CourseSvg course={res.course} tracks={res.boats.map((b) => ({ pts: b.track || [], me: b.me }))} />,
      keys: [
        { kind: 'line', color: C.you, label: t('You', 'Вы') },
        { kind: 'line', color: 'rgba(255,255,255,0.35)', label: t('Fleet', 'Флот') },
        { kind: 'dot', color: C.buoy, label: t('Marks', 'Знаки') },
      ],
    },
  });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, immutable'); // a posted result never changes
  return img;
}
