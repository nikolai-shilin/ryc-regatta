import { isLang, tx, ruPlural, type Lang } from '@/lib/lang';
import { VENUES } from '@/lib/venues';
import { readPassport } from '@/lib/passport-share';
import { card, C } from '@/lib/og';

// /og/passport?s=5&v=12&vs=…&n=Anna&lang=ru — the share card of a player's passport (lib/passport-share.ts),
// in the logo's look (lib/og.tsx): their name beside the logo, and their streak (or their venues) as the big figure in
// gold.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get('lang'), lang: Lang = isLang(q) ? q : 'en', t = tx(lang);
  const p = readPassport(Object.fromEntries(sp));
  const streak = p.s >= 2;
  const img = await card({ lang,
    bg: 'helm',
    kind: p.n ? t(`${p.n}’s passport`, `Паспорт: ${p.n}`, `Pasaporte de ${p.n}`, `Pass von ${p.n}`, `Pasaport: ${p.n}`) : t('A sailor’s passport', 'Паспорт гонщика', 'Pasaporte de un regatista', 'Der Pass eines Seglers', 'Bir denizcinin pasaportu'),
    hero: streak
      ? { label: t('Days in a row', ruPlural(p.s, ['День подряд', 'Дня подряд', 'Дней подряд']), 'Días seguidos', 'Tage in Folge', 'Art arda gün'), value: String(p.s), color: C.gold }
      : { label: t('Venues raced', 'Пройдено акваторий', 'Sedes navegadas', 'Gesegelte Reviere', 'Yarışılan alanlar'), value: `${p.v} / ${VENUES.length}`, color: C.gold },
    call: t('Sail today’s race', 'Пройди гонку дня', 'Navega la regata del día', 'Die Regatta des Tages segeln', 'Günün yarışına çık'),
  });
  img.headers.set('cache-control', 'public, max-age=86400, s-maxage=31536000, immutable'); // the address is the picture
  return img;
}
