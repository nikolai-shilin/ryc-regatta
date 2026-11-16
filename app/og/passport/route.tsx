import { isLang, tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { BADGES } from '@/lib/badges';
import { readPassport } from '@/lib/passport-share';
import { card, C, PANEL } from '@/lib/og';
import { BadgePennant } from '@/components/badge-pennant';

// /og/passport?s=5&v=12&b=4&vs=…&bb=…&n=Anna&lang=ru — the share card of a player's passport (lib/passport-share.ts),
// as the race's HUD draws (lib/og.tsx): their name under the title, their streak (or their venues) as the big figure in
// gold, the streak, the venues and the badges as the lower third with the venues raced a square each under them, and on
// the right the twelve badges as their plates, those earned lit.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get('lang'), lang: Lang = isLang(q) ? q : 'en', t = tx(lang);
  const p = readPassport(Object.fromEntries(sp));
  const streak = p.s >= 2;
  const rows = [0, 1, 2].map((r) => BADGES.slice(r * 4, r * 4 + 4));
  const img = await card({
    kind: p.n ? t(`${p.n}’s passport`, `Паспорт: ${p.n}`) : t('A sailor’s passport', 'Паспорт гонщика'),
    hero: streak
      ? { label: t('Days in a row', ruPlural(p.s, ['День подряд', 'Дня подряд', 'Дней подряд'])), value: String(p.s), color: C.gold }
      : { label: t('Venues raced', 'Пройдено акваторий'), value: `${p.v} / ${VENUES.length}`, color: C.gold },
    cells: [
      { label: t('Streak', 'Серия'), value: p.s, unit: t(p.s === 1 ? 'day' : 'days', ruPlural(p.s, ['день', 'дня', 'дней'])) },
      { label: t('Venues', 'Акватории'), value: p.v, unit: `/ ${VENUES.length}` },
      { label: t('Badges', 'Достижения'), value: p.b, unit: `/ ${BADGES.length}` },
    ],
    strip: (
      <div style={{ display: 'flex', gap: 5 }}>
        {VENUES.map((v, i) => <div key={v.id} style={{ display: 'flex', width: 14, height: 14, background: p.raced[i] ? C.you : 'rgba(255,255,255,0.12)' }} />)}
      </div>
    ),
    call: t('Sail today’s race', 'Пройди гонку дня'),
    panel: {
      title: t('Badges', 'Достижения'), aside: `${p.b} / ${BADGES.length}`, asideColor: C.gold,
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-around' /* the renderer has no space-evenly */, padding: '10px 14px 18px', width: PANEL.w }}>
          {rows.map((row, r) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'space-around' }}>
              {row.map((b) => <BadgePennant key={b.id} id={b.id} on={p.got[BADGES.indexOf(b)]} width={88} height={97} />)}
            </div>
          ))}
        </div>
      ),
    },
  });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=31536000, immutable'); // the address is the picture
  return img;
}
