import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { isLang, tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { BADGES } from '@/lib/badges';
import { readPassport } from '@/lib/passport-share';
import { font, W, H } from '@/lib/og';
import { BadgePennant } from '@/components/badge-pennant';

// /og/passport?s=5&v=12&b=4&vs=…&bb=…&n=Anna&lang=ru — the share card of a player's passport (lib/passport-share.ts),
// as the site's broadcast draws: their name on a tag, their streak (or their venues) as the headline, the venues raced
// a square each, and on the right the twelve badges as their pennants, those earned lit.
const BG = '#070c14', SURF = '#0b1420', YOU = '#3db8ff', GOLD = '#f5c400', INK_ON = '#04121e', INK3 = 'rgba(255,255,255,0.62)';

// a block with its right edge cut on the slant, as the site's kicks and buttons
const Slant = ({ bg, h, children, style }: { bg: string; h: number; children: ReactNode; style?: object }) => (
  <div style={{ display: 'flex', alignSelf: 'flex-start' }}>
    <div style={{ display: 'flex', alignItems: 'center', height: h, background: bg, ...style }}>{children}</div>
    <svg width={Math.round(h * 0.28)} height={h} viewBox={`0 0 ${Math.round(h * 0.28)} ${h}`}><path d={`M0 0H${Math.round(h * 0.28)}L0 ${h}Z`} fill={bg} /></svg>
  </div>
);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get('lang'), lang: Lang = isLang(q) ? q : 'en', t = tx(lang);
  const p = readPassport(Object.fromEntries(sp));
  const kind = p.n ? t(`${p.n}’s passport`, `Паспорт: ${p.n}`) : t('A sailor’s passport', 'Паспорт гонщика');
  const headline = p.s >= 2 ? t(`${p.s} days in a row`, `${p.s} ${ruPlural(p.s, ['день', 'дня', 'дней'])} подряд`) : t(`${p.v} of ${VENUES.length} venues`, `${p.v} из ${VENUES.length} акваторий`);
  const venuesLabel = p.s >= 2 ? t('Venues raced', 'Пройдено акваторий') : t('Every day, another famous regatta venue', 'Каждый день — новая регатная акватория');
  const call = t('Sail today’s race', 'Пройди гонку дня'), url = 'upandown.rycrentals.com', badges = t('Badges', 'Значки');
  const text = `UP AND DOWN ${kind}${headline}${venuesLabel}${call}${url}${badges} 0123456789/→`;
  const fonts = (await Promise.all([font('Sofia Sans Condensed', 800, text + text.toUpperCase()), font('Sofia Sans Condensed', 700, text + text.toUpperCase())])).filter((f) => f !== null);
  const rows = [0, 1, 2].map((r) => BADGES.slice(r * 4, r * 4 + 4));
  const img = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Sofia Sans Condensed', color: '#fff', backgroundColor: BG, backgroundImage: 'linear-gradient(210deg, #0d2a44 0%, #070c14 46%)' }}>
        <div style={{ position: 'absolute', left: 64, top: 56, bottom: 56, width: 620, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', alignItems: 'center', height: 52, padding: '0 20px', background: '#0f1a28', borderLeft: `6px solid ${YOU}`, fontSize: 26, fontWeight: 800, letterSpacing: 2 }}>UP AND DOWN</div>
          <div style={{ display: 'flex', marginTop: 30 }}>
            <Slant bg={YOU} h={44} style={{ padding: '0 8px 0 16px', color: INK_ON, fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>{kind}</Slant>
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 96, fontWeight: 800, lineHeight: 0.92, textTransform: 'uppercase' }}>{headline}</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
            {p.s >= 2 ? <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 40, fontWeight: 800 }}>{p.v}<span style={{ marginLeft: 6, fontSize: 24, color: INK3 }}>/ {VENUES.length}</span></div> : null}
            <div style={{ display: 'flex', marginTop: 6, fontSize: 16, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase', color: INK3 }}>{venuesLabel}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
              {VENUES.map((v, i) => <div key={v.id} style={{ display: 'flex', width: 14, height: 14, background: p.raced[i] ? YOU : 'rgba(255,255,255,0.12)' }} />)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 'auto' }}>
            <Slant bg={YOU} h={64} style={{ padding: '0 14px 0 28px', color: INK_ON, fontSize: 26, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>{call} →</Slant>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: INK3 }}>{url}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 56, top: 56, width: 432, height: 518, display: 'flex', flexDirection: 'column', padding: '26px 22px 20px', background: SURF }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px' }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, letterSpacing: 2.8, textTransform: 'uppercase' }}>{badges}</div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: GOLD }}>{`${p.b} / ${BADGES.length}`}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-around' /* the renderer has no space-evenly */ }}>
            {rows.map((row, r) => (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-around' }}>
                {row.map((b) => <BadgePennant key={b.id} id={b.id} on={p.got[BADGES.indexOf(b)]} width={92} height={101} />)}
              </div>
            ))}
          </div>
          {/* the panel's corner cut, as the site's tiles */}
          <svg width={20} height={20} viewBox="0 0 20 20" style={{ position: 'absolute', right: 0, bottom: 0 }}><path d="M20 0V20H0Z" fill={BG} /></svg>
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=31536000, immutable'); // the address is the picture
  return img;
}
