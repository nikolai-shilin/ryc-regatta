import { isLang, tx, type Lang } from '@/lib/lang';
import { dailyRace } from '@/lib/race';
import { yachtOf } from '@/lib/yachts';
import { venueOf } from '@/lib/venues';
import { todayTop } from '@/lib/today';
import { card, C } from '@/lib/og';

// /og/today?lang=ru&d=2026-11-14 — the share card of the home page and Today's race, in the logo's look (lib/og.tsx):
// today's race, its venue and yacht and its day, and the time to beat so far in gold (or the call to be first). A new
// picture every day (and as the time to beat falls), so a link to the game shared today doesn't look like one shared
// last week; `d` is only there so chat apps, which cache a preview by its address, fetch the new day's.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('lang');
  const lang: Lang = isLang(q) ? q : 'en';
  const t = tx(lang);
  const d = dailyRace(), today = await todayTop();
  const best = today && today.d === d.day ? today.top[0] : null;
  const clock = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
  const img = await card({
    bg: 'drone',
    kind: `${t('Today’s race', 'Гонка дня')} · ${t(...venueOf(d.venue).name)} · ${t(...yachtOf(d.yacht).name)}`,
    tag: { text: date, live: true },
    hero: best
      ? { label: best.name ? `${t('Time to beat', 'Лучшее время')} · ${best.name}` : t('Time to beat', 'Лучшее время'), value: clock(best.s), color: C.gold }
      : { label: t('No time yet today', 'Сегодня ещё никто не финишировал'), value: t('Be first', 'Будь первым') },
    call: t('Sail today’s race', 'Пройди гонку дня'),
  });
  img.headers.set('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'); // the time to beat moves
  return img;
}
