import { isLang, tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { readPassport } from '@/lib/passport-share';
import { card } from '@/lib/og';

// /og/passport?s=5&v=12&b=4&vs=…&n=Anna&lang=ru — the share card of a player's passport (lib/passport-share.ts): their
// streak or their venues as the headline, and the venues raced, lit, one square each in the venues' order
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get('lang'), lang: Lang = isLang(q) ? q : 'en', t = tx(lang);
  const p = readPassport(Object.fromEntries(sp));
  const days = t(`${p.s} days in a row`, `${p.s} ${ruPlural(p.s, ['день', 'дня', 'дней'])} подряд`);
  const venues = t(`${p.v} of ${VENUES.length} venues`, `${p.v} из ${VENUES.length} акваторий`);
  const badges = t(`${p.b} ${p.b === 1 ? 'badge' : 'badges'}`, `${p.b} ${ruPlural(p.b, ['значок', 'значка', 'значков'])}`);
  const img = await card({
    kind: p.n ? t(`${p.n} on the water`, `${p.n} на воде`) : t('A sailor’s passport', 'Паспорт гонщика'),
    headline: p.s >= 2 ? days : venues,
    // the headline the streak (when there is one), else the venues; under it the rest
    detail: [p.s >= 2 ? t(`${venues} raced`, `Пройдено ${p.v} из ${VENUES.length} акваторий`) : t('Every day, another famous regatta venue', 'Каждый день — новая регатная акватория'), p.b ? badges : ''].filter(Boolean).join(' · '),
    call: t('Sail today’s race', 'Пройди гонку дня'),
    panel: (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 10, width: 400, height: 502, padding: 28 }}>
        {VENUES.map((v, i) => (
          <div key={v.id} style={{ display: 'flex', width: 74, height: 46, borderRadius: 6, background: p.raced[i] ? '#3db8ff' : 'rgba(143, 211, 255, 0.12)', border: p.raced[i] ? '2px solid #8fd3ff' : '2px solid rgba(143, 211, 255, 0.18)' }} />
        ))}
      </div>
    ),
  });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=31536000, immutable'); // the address is the picture
  return img;
}
