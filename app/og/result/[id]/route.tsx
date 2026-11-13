import { ImageResponse } from 'next/og';
import { isLang, type Lang } from '@/lib/lang';
import { describe, getResult, type SharedResult, type XZ } from '@/lib/result';
import { OG_IMAGE } from '@/lib/seo';

// /og/result/<id>?lang=ru — the picture a shared result link shows in Telegram, WhatsApp, X…: the place and the time
// and the call to beat it on the left, the boats' tracks on the course on the right, on the deep blue of the site's
// sea. Drawn, not a photo, so the PNG stays small enough for WhatsApp. 1200 × 630, as every card. A race that isn't
// online (yet) gets the site's own picture.
// The result page names it in its metadata (app/race/result/[id]/page.tsx).
const W = 1200, H = 630, ME = '#3db8ff', MARK = '#ff8a1e', SEA = '#0b2c48', ACCENT = '#0290d7';

// Merriweather Light and Carlito Bold, the site's own, cut to the letters on the card (Google Fonts serves TrueType
// to a client that isn't a browser, which is what the renderer reads). Without them it falls back to its own font.
async function font(family: string, weight: number, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? { name: family, data: await (await fetch(url)).arrayBuffer(), weight: weight as 300 | 700, style: 'normal' as const } : null;
  } catch { return null; }
}

function Tracks({ res, w, h }: { res: SharedResult; w: number; h: number }) {
  const c = res.course, marks: XZ[] = [c.windward, ...c.gate, ...(c.wing ? [c.wing] : [])];
  const pts: XZ[] = [...marks, c.pin, c.committee, ...res.boats.flatMap((b) => b.track || [])];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), pad = 28;
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (z1 - z0 || 1));
  const ox = (w - (x1 - x0) * s) / 2, oz = (h - (z1 - z0) * s) / 2;
  const X = (x: number) => ox + (x - x0) * s, Z = (z: number) => oz + (z - z0) * s;
  const path = (tr: XZ[]) => tr.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Z(z).toFixed(1)}`).join(' ');
  const mine = res.boats.find((b) => b.me);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={X(c.pin[0])} y1={Z(c.pin[1])} x2={X(c.committee[0])} y2={Z(c.committee[1])} stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeDasharray="6 6" />
      {res.boats.filter((b) => !b.me && b.track?.length > 1).map((b, i) => <path key={i} d={path(b.track)} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={2.5} strokeLinejoin="round" />)}
      {mine && mine.track?.length > 1 && <path d={path(mine.track)} fill="none" stroke={ME} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />}
      {marks.map((m, i) => <circle key={i} cx={X(m[0])} cy={Z(m[1])} r={7} fill={MARK} />)}
    </svg>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const res = await getResult(id);
  if (!res) return new Response(null, { status: 302, headers: { location: OG_IMAGE.url, 'cache-control': 'public, max-age=60' } });
  const d = describe(res, lang);
  const text = `UP AND DOWN ${d.headline}${d.kind}${d.detail}${d.call} → regatta.rycrentals.com`;
  const fonts = (await Promise.all([font('Merriweather', 300, text), font('Carlito', 700, text)])).filter((f) => f !== null);
  const panel = { w: 400, h: 502 };

  const img = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Carlito', color: '#fff', background: 'linear-gradient(135deg, #0b3550 0%, #041626 100%)' }}>
        <div style={{ position: 'absolute', left: 64, top: 64, bottom: 64, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 3, opacity: 0.8 }}>UP AND DOWN</div>
            <div style={{ display: 'flex', fontSize: 32, color: ME }}>{d.kind}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', fontFamily: 'Merriweather', fontWeight: 300, fontSize: Math.min(104, Math.floor(640 / (d.headline.length * 0.47))), lineHeight: 1.05 }}>{d.headline}</div>
            <div style={{ display: 'flex', fontSize: 30, opacity: 0.88, lineHeight: 1.3 }}>{d.detail}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', background: ACCENT, borderRadius: 999, padding: '14px 30px', fontSize: 30 }}>{d.call} →</div>
            <div style={{ display: 'flex', fontSize: 26, opacity: 0.8 }}>regatta.rycrentals.com</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 64, top: 64, width: panel.w, height: panel.h, display: 'flex', background: SEA, borderRadius: 28, border: '2px solid rgba(143, 211, 255, 0.25)' }}>
          <Tracks res={res} w={panel.w} h={panel.h} />
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, immutable'); // a posted result never changes
  return img;
}
