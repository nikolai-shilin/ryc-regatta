import { NextResponse } from 'next/server';

// What an admin sets on /admin, from public.regatta_settings: the ad on every boat's jib (the row 'jib_ad') and the logo
// on every boat's mainsail (the row 'main_logo'), each a picture in the public Supabase bucket regatta-ads or one of the
// site's own, and the words on the banner the light plane tows over the course (the row 'plane_banner'). The game
// (public/game/sponsor.js) is static and has no Supabase client, so it asks here. Cached at the CDN for a minute, and
// dropped at once when an admin saves (app/[lang]/admin/actions.ts).
//
//   GET /sponsor → { jib: 'https://…/regatta-ads/…png' | '/images/ryc-sponsor.svg' | null,
//                    main: 'https://…/regatta-ads/…png' | '/images/ryc-badge.svg' | null,
//                    banner: ['first words', 'second words'?] | null }
export const revalidate = 60;

const BANNER_MAX = 40; // characters in each half of the banner

export async function GET() {
  let jib: string | null = null, main: string | null = null, banner: string[] | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/regatta_settings?key=in.(jib_ad,main_logo,plane_banner)&select=key,value`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      next: { revalidate: 60, tags: ['sponsor'] }, signal: AbortSignal.timeout(6000),
    });
    const rows: { key: string; value: Record<string, unknown> }[] = r.ok ? await r.json() : [];
    const val = (k: string) => rows.find((row) => row.key === k)?.value;
    // a picture an admin uploaded, or one of the site's own (the sample: /images/ryc-sponsor.svg, the club's logo)
    const picture = (k: string) => {
      const url = val(k)?.url;
      if (typeof url !== 'string') return null;
      const uploaded = url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/regatta-ads/`);
      const ours = /^\/images\/[\w.-]+\.(svg|png|jpe?g|webp)$/.test(url);
      return uploaded || ours ? url : null;
    };
    jib = picture('jib_ad');
    main = picture('main_logo');
    const lines = val('plane_banner')?.lines;
    if (Array.isArray(lines)) {
      const clean = lines.filter((l): l is string => typeof l === 'string').map((l) => l.trim().slice(0, BANNER_MAX)).filter(Boolean).slice(0, 2);
      if (clean.length) banner = clean;
    }
  } catch {
    // nothing set: the sails stay plain and the banner keeps the game's own words
  }
  return NextResponse.json({ jib, main, banner }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' } });
}
